import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {Store} from './store.mjs';

async function fixture(t,{enabled=true,collector,oauthFetch,expired=false}={}){
  const keys=['SYNK_COMPANY_BACKGROUND_JOBS_ENABLED','SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED'],before=keys.map(k=>process.env[k]);
  process.env[keys[0]]='0';process.env[keys[1]]='1';
  const directory=await mkdtemp(join(tmpdir(),'synk-channel-collection-')),seed=new Store(directory);
  const user=seed.createUser({name:'Synthetic admin',email:'collection@example.test',role:'admin'}),at=new Date().toISOString();
  seed.put('settings','company',{enabled:true,hourKst:0});
  for(const id of ['lab','brief','excluded'])seed.put('channels',id,{id,platform:'youtube',canonicalUrl:'https://www.youtube.com/@'+id,handle:id,ownerIds:[user.id],active:true,status:'not-connected'});
  seed.setSecret('collection:youtube-public',{clientId:'synthetic-client',clientSecret:'synthetic-secret',accessToken:'synthetic-access',refreshToken:'synthetic-refresh',expiresAt:new Date(Date.now()+(expired?-10000:3600000)).toISOString(),connectedBy:user.id,channelIds:['lab','brief']});seed.close();
  let otherWork=0;
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,channelCollectionEnabled:enabled,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,collector,oauthFetch,dailyTrendsCollector:async()=>{otherWork++;throw Error('Unrelated background work');}});
  t.after(async()=>{await app.stop();for(let i=0;i<keys.length;i++)if(before[i]===undefined)delete process.env[keys[i]];else process.env[keys[i]]=before[i];await rm(directory,{recursive:true,force:true});});
  await app.start();await app.waitForIdle();
  return {app,user,otherWork:()=>otherWork,at};
}
const result=c=>({channel:{externalId:c.id,followers:0,views:13,metrics:{posts:1}},posts:[{externalId:'abcdefghijk',url:'https://www.youtube.com/watch?v=abcdefghijk',title:'Public',publishedAt:'2026-10-10T00:00:00Z',metrics:{views:13,likes:0,comments:0}}],coverage:{status:'complete',inventoryComplete:true,ownerAuthorized:false}});

test('workroom scheduling collects only bound public channels while unrelated background work stays off',async t=>{
  const calls=[],f=await fixture(t,{collector:async(c,credentials)=>{calls.push(c.id);assert.deepEqual(Object.keys(credentials).sort(),['accessToken','publicOnly']);assert.equal(credentials.publicOnly,true);return result(c);}});
  assert.deepEqual(calls.sort(),['brief','lab']);assert.equal(f.otherWork(),0);
  assert.equal(f.app.store.all('snapshots').length,2);assert.equal(f.app.store.all('channelSnapshots')[0].postCount,1);
  assert.equal(f.app.store.secret('channel:brief'),null,'no publishing/owner connection is created');
  await f.app.scheduledTick();await f.app.waitForIdle();assert.equal(calls.length,2,'same-day full and fresh recent data are not fetched again');
});

test('channel collection can remain disabled independently of the workroom',async t=>{
  let calls=0;await fixture(t,{enabled:false,collector:async c=>{calls++;return result(c);}});assert.equal(calls,0);
});

test('binding a public reader clears prior authentication and recent retry failures so automatic collection resumes',async t=>{
  const calls=[],f=await fixture(t,{collector:async(c,credentials)=>{calls.push(c.id);assert.equal(credentials.publicOnly,true);return result(c);}});
  const previous=new Date(Date.now()-86400000).toISOString(),next=new Date(Date.now()+86400000).toISOString();
  f.app.store.put('channels','excluded',{...f.app.store.get('channels','excluded'),status:'error',collectionDisabled:true,connectionVersion:3,
    lastCollectedAt:previous,lastError:'Previous authentication failure',failureKind:'auth',failureCode:'TOKEN_EXPIRED',retryCount:2,nextRetryAt:next,requiresReconnect:true,lastFailureAt:previous,lastAttemptAt:previous,
    recentStatus:'error',recentLastCollectedAt:previous,recentLastError:'Previous rate limit',recentFailureKind:'rate-limit',recentFailureCode:'QUOTA_EXCEEDED',recentRetryCount:2,recentNextRetryAt:next,recentRequiresReconnect:true,recentLastFailureAt:previous,recentLastAttemptAt:previous});
  const csrf='fixture-csrf',session=f.app.store.mint('session',f.user.id,{csrfToken:csrf},10),base='http://127.0.0.1:'+f.app.server.address().port;
  const response=await fetch(base+'/api/channels/excluded/public-collection',{method:'POST',headers:{Cookie:'synk_company_session='+session,Origin:f.app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf},body:'{}'});
  assert.equal(response.status,200);const saved=f.app.store.get('channels','excluded');
  assert.equal(saved.lastCollectedAt,previous);assert.equal(saved.recentLastCollectedAt,previous,'connection reset preserves real collection history');
  await f.app.scheduledTick();await f.app.waitForIdle();
  assert.equal(calls.filter(id=>id==='excluded').length,1,'a newly connected public reader must not inherit the prior connection retry/auth block');
  for(const prefix of ['','recent']){
    const key=name=>prefix?prefix+name[0].toUpperCase()+name.slice(1):name;
    assert.equal(saved[key('status')],'ready');assert.equal(saved[key('retryCount')],0);assert.equal(saved[key('requiresReconnect')],false);
    for(const field of ['lastError','failureKind','failureCode','nextRetryAt','lastFailureAt','lastAttemptAt'])assert.equal(saved[key(field)],null, key(field));
  }
  assert.equal(saved.collectionDisabled,false);assert.equal(saved.connectionVersion,4);
  assert.equal(f.app.store.secret('channel:excluded'),null,'public binding never creates owner or publishing credentials');
});

test('the shared public reader renews once with its original client and never supplies owner authorization',async t=>{
  let renewals=0,calls=0;const f=await fixture(t,{expired:true,oauthFetch:async(raw,options)=>{assert.equal(new URL(raw).origin,'https://oauth2.googleapis.com');assert.equal(new URLSearchParams(options.body).get('client_id'),'synthetic-client');renewals++;return new Response(JSON.stringify({access_token:'synthetic-new',expires_in:3600,scope:'https://www.googleapis.com/auth/youtube.force-ssl'}),{status:200});},collector:async(c,credentials)=>{calls++;assert.equal(credentials.accessToken,'synthetic-new');assert.equal(credentials.publicOnly,true);return result(c);}});
  assert.equal(renewals,1);assert.equal(calls,2);assert.equal(f.app.store.secret('collection:youtube-public').refreshToken,'synthetic-refresh');
});

// 11-19: 페이스북 수집기가 남기는 페이지 게시물 번호(pagePostId). 게시 성과 판정이 게시결과의 번호를 서버 게시물과 짝짓는 데 쓴다.
// 설계 검토 B: 이 번호가 있는 줄은 externalId도 같은 번호다. 서버는 둘이 같고 꼴이 맞을 때만 적는다.
const again=async(f,set)=>{set();for(const c of f.app.store.all('channels'))if(c.id!=='excluded')f.app.store.put('channels',c.id,{...c,lastCollectedAt:null,lastAttemptAt:null,recentLastCollectedAt:null,recentLastAttemptAt:null});await f.app.scheduledTick();await f.app.waitForIdle();};
const fbRow=(externalId,pagePostId,url)=>({...result({}).posts[0],externalId,pagePostId,url});
test('a page post id is stored only in its exact form, only on the row whose externalId it is, and stays when a later collection lacks it',async t=>{
  let round=1;
  const reel='https://www.facebook.com/reel/555/';
  const f=await fixture(t,{collector:async c=>({...result(c),posts:round===1
    ?[fbRow('123_456','123_456',reel),fbRow('123_457','123_457&x',reel),fbRow('555','123_789',reel),fbRow('123_458','123_999',reel)]
    :[fbRow('123_456',undefined,reel)]})});
  const stored=()=>Object.fromEntries(f.app.store.all('posts').filter(p=>p.channelId==='lab').map(p=>[p.externalId,p.pagePostId]));
  assert.deepEqual(stored(),{'123_456':'123_456','123_457':undefined,'555':undefined,'123_458':undefined});
  await again(f,()=>{round=2;});
  assert.deepEqual(stored(),{'123_456':'123_456','123_457':undefined,'555':undefined,'123_458':undefined});
});

// 설계 검토 B의 줄 수명: 영상 목록에서만 잡혔던 릴스(post_id를 받아 externalId가 게시물 번호)가 다음 회차에 게시물 목록으로 잡혀도 같은 줄이다.
// post_id를 못 받은 영상 번호 줄은 번호가 없고, 앞 판처럼 완전한 전체 수집만 안 보인 줄을 내린다.
test('a reel first seen only in the video list and later in the feed is one row; a numberless video row retires only on a complete full collection',async t=>{
  let round=1;
  const complete={status:'complete',inventoryComplete:true,ownerAuthorized:false},partial={status:'partial',inventoryComplete:false,ownerAuthorized:false};
  const f=await fixture(t,{collector:async c=>round===1
    ?{...result(c),posts:[fbRow('123_700','123_700','https://www.facebook.com/reel/555/'),fbRow('556',null,'https://www.facebook.com/reel/556/')],coverage:complete}
    :{...result(c),posts:[fbRow('123_700','123_700','https://www.facebook.com/synk/posts/700'),fbRow('123_701','123_701','https://www.facebook.com/reel/556/')],coverage:round===2?partial:complete}});
  const active=()=>f.app.store.all('posts').filter(p=>p.channelId==='lab'&&!p.unavailableAt).map(p=>[p.externalId,p.pagePostId??null]).sort();
  assert.deepEqual(active(),[['123_700','123_700'],['556',null]]);
  await again(f,()=>{round=2;});
  assert.deepEqual(active(),[['123_700','123_700'],['123_701','123_701'],['556',null]],'a partial collection keeps the unseen row; the feed row is the same row');
  assert.equal(f.app.store.get('posts','lab:123_700').url,'https://www.facebook.com/synk/posts/700');
  assert.equal(f.app.store.all('snapshots').filter(s=>s.postId==='lab:123_700').length,1,'its history stays on one row');
  await again(f,()=>{round=3;});
  assert.deepEqual(active(),[['123_700','123_700'],['123_701','123_701']],'the complete full collection retires the numberless row, as before this change');
});

test('complete inventory hides unavailable posts without erasing history; partial inventory never hides unseen posts',async t=>{
  let complete=true,items=true;
  const f=await fixture(t,{collector:async c=>({...result(c),posts:items?result(c).posts:[],coverage:{status:complete?'complete':'partial',inventoryComplete:complete,ownerAuthorized:false}})});
  const before=f.app.store.all('snapshots').length;items=false;complete=false;
  for(const c of f.app.store.all('channels'))if(c.id!=='excluded')f.app.store.put('channels',c.id,{...c,lastCollectedAt:null,lastAttemptAt:null,recentLastCollectedAt:null,recentLastAttemptAt:null});
  await f.app.scheduledTick();await f.app.waitForIdle();assert.ok(f.app.store.all('posts').every(p=>!p.unavailableAt));
  complete=true;for(const c of f.app.store.all('channels'))if(c.id!=='excluded')f.app.store.put('channels',c.id,{...c,lastCollectedAt:null,lastAttemptAt:null,recentLastCollectedAt:null,recentLastAttemptAt:null});
  await f.app.scheduledTick();await f.app.waitForIdle();assert.ok(f.app.store.all('posts').every(p=>p.unavailableAt));assert.equal(f.app.store.all('snapshots').length,before);
});
