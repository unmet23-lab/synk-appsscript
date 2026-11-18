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

// 11-19: 페이스북 수집기가 남기는 열쇠 둘(pagePostId · videoId)로 서버가 같은 게시물의 저장 줄을 찾아 잇는다(설계 검토 B · 설계 검토 2).
// 장면 번호는 .tmp/검수/설계검토_수집기pagePostId_20261119_2.md의 시험 장면이다. 페이지 123, 영상 555, 게시물 700.
async function fbFixture(t,collector){
  const keys=['SYNK_COMPANY_BACKGROUND_JOBS_ENABLED','SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED'],before=keys.map(k=>process.env[k]);
  process.env[keys[0]]='0';process.env[keys[1]]='1';
  const directory=await mkdtemp(join(tmpdir(),'synk-fb-collection-')),seed=new Store(directory);
  const user=seed.createUser({name:'Synthetic admin',email:'fb-collection@example.test',role:'admin'});
  seed.put('settings','company',{enabled:true,hourKst:0});
  seed.put('channels','fb',{id:'fb',platform:'facebook',canonicalUrl:'https://www.facebook.com/profile.php?id=123',handle:null,externalId:'123',ownerIds:[user.id],active:true,status:'ready'});
  seed.setSecret('channel:fb',{accessToken:'synthetic-page-token',connectedBy:user.id});seed.close();
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,channelCollectionEnabled:true,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,collector,dailyTrendsCollector:async()=>{throw Error('Unrelated background work');}});
  t.after(async()=>{await app.stop();for(let i=0;i<keys.length;i++)if(before[i]===undefined)delete process.env[keys[i]];else process.env[keys[i]]=before[i];await rm(directory,{recursive:true,force:true});});
  await app.start();await app.waitForIdle();
  const again=async()=>{const c=app.store.get('channels','fb');app.store.put('channels','fb',{...c,lastCollectedAt:null,lastAttemptAt:null,recentLastCollectedAt:null,recentLastAttemptAt:null});await app.scheduledTick();await app.waitForIdle();};
  const rows=()=>app.store.all('posts').filter(p=>p.channelId==='fb').map(p=>({id:p.id,externalId:p.externalId,pagePostId:p.pagePostId??null,videoId:p.videoId??null,url:p.url,publishedAt:p.publishedAt,retired:!!p.unavailableAt})).sort((x,y)=>x.id.localeCompare(y.id));
  return {app,again,rows};
}
const fbResult=(posts,coverage={status:'complete',inventoryComplete:true,ownerAuthorized:true})=>({channel:{externalId:'123',followers:0,views:null,metrics:{}},posts,coverage});
const REEL='https://www.facebook.com/reel/555/',FEED='https://www.facebook.com/synk/posts/700',AT='2026-10-10T00:00:00.000Z',AT_VIDEO='2026-10-10T00:10:00.000Z';
const fbPost=(externalId,fields={})=>({externalId,url:REEL,title:'릴스',publishedAt:AT,pagePostId:null,videoId:null,...fields,metrics:{views:null,likes:null,comments:null,shares:null,...fields.metrics}});
const PARTIAL={status:'partial',inventoryComplete:false,ownerAuthorized:true};

test('a page post id is stored only in its exact form, a video id only as digits, and both stay when a later collection lacks them',async t=>{
  let round=1;
  const f=await fbFixture(t,async()=>fbResult(round===1
    ?[fbPost('123_456',{pagePostId:'123_456',videoId:'456'}),fbPost('123_457',{pagePostId:'123_457&x',videoId:'45x'})]
    :[fbPost('123_456'),fbPost('123_457')]));
  const keys=()=>f.rows().map(r=>[r.externalId,r.pagePostId,r.videoId]);
  assert.deepEqual(keys(),[['123_456','123_456','456'],['123_457',null,null]]);
  round=2;await f.again();
  assert.deepEqual(keys(),[['123_456','123_456','456'],['123_457',null,null]]);
});

test('scene 1 and 4: a reel that loses its post_id, or comes back from the feed with a general post address, stays one row with its reel address',async t=>{
  let round=1;
  const f=await fbFixture(t,async()=>fbResult(round===1?[fbPost('123_700',{pagePostId:'123_700',videoId:'555',publishedAt:AT_VIDEO,metrics:{views:9}})]
    :round===2?[fbPost('555',{videoId:'555',publishedAt:AT_VIDEO,metrics:{views:11}})]
    :[fbPost('123_700',{pagePostId:'123_700',url:FEED,publishedAt:AT,metrics:{likes:3}})],PARTIAL));
  round=2;await f.again();
  assert.deepEqual(f.rows().map(r=>[r.id,r.pagePostId,r.videoId,r.retired]),[['fb:123_700','123_700','555',false]],'no fb:555 row');
  round=3;await f.again();
  const [row]=f.rows();
  assert.equal(f.rows().length,1);assert.equal(row.url,REEL,'the stored address auto-registration reads stays the reel address');assert.equal(row.publishedAt,AT_VIDEO,'with its own time');
});

test('scene 2: a numberless video row keeps its id and only gains the page post id; the feed row of that post joins it',async t=>{
  let round=1;
  const f=await fbFixture(t,async()=>fbResult(round===1?[fbPost('555',{videoId:'555'})]
    :round===2?[fbPost('123_700',{pagePostId:'123_700',videoId:'555'})]
    :[fbPost('123_700',{pagePostId:'123_700',url:FEED})],PARTIAL));
  round=2;await f.again();round=3;await f.again();
  assert.deepEqual(f.rows().map(r=>[r.id,r.externalId,r.pagePostId,r.videoId,r.url]),[['fb:555','555','123_700','555',REEL]]);
});

test('scene 3: a same-day full collection without video views keeps the views of the day, while the new observation keeps what it got',async t=>{
  let round=1;const recent=new Date(Date.now()-3600000).toISOString();
  const f=await fbFixture(t,async()=>fbResult([fbPost('123_700',{pagePostId:'123_700',videoId:round===1?'555':null,publishedAt:recent,metrics:round===1?{views:9,likes:1}:{views:null,likes:2}})]));
  round=2;await f.again();
  const day=f.app.store.all('snapshots').filter(s=>s.postId==='fb:123_700');
  assert.equal(day.length,1);assert.equal(day[0].views,9);assert.equal(day[0].likes,2);
  const seen=f.app.store.all('hypeObservations').filter(o=>o.postId==='fb:123_700').sort((x,y)=>x.checkedAt.localeCompare(y.checkedAt));
  assert.equal(seen.length,2);assert.equal(seen.at(-1).views,null,'an observation is what this collection got');assert.equal(seen.at(-1).likes,2);
});

test('scene 9: two rows of one collection that resolve to the same stored row merge with the first as the base',async t=>{
  let round=1;
  const f=await fbFixture(t,async()=>fbResult(round===1?[fbPost('123_700',{pagePostId:'123_700',videoId:'555',metrics:{views:1,likes:1}})]
    :[fbPost('123_700',{pagePostId:'123_700',url:FEED,title:'게시물',metrics:{likes:3,shares:1}}),fbPost('555',{videoId:'555',title:'영상',metrics:{views:9,likes:7}})]));
  round=2;await f.again();
  assert.deepEqual(f.rows().map(r=>r.id),['fb:123_700']);
  const day=f.app.store.all('snapshots').filter(s=>s.postId==='fb:123_700');
  assert.equal(day.length,1);assert.deepEqual([day[0].likes,day[0].shares,day[0].views],[3,1,9]);
  assert.equal(f.app.store.get('posts','fb:123_700').title,'게시물');
});

test('scene 10 and 11: a retired row comes back instead of a new one, and a video id never joins a different page post',async t=>{
  let round=1;
  const f=await fbFixture(t,async()=>fbResult(round===1?[fbPost('123_700',{pagePostId:'123_700',videoId:'555'})]
    :round===2?[fbPost('123_800',{pagePostId:'123_800'})]
    :round===3?[fbPost('555',{videoId:'555'}),fbPost('123_800',{pagePostId:'123_800'})]
    :[fbPost('123_701',{pagePostId:'123_701',videoId:'555'}),fbPost('123_800',{pagePostId:'123_800'})],round===3?PARTIAL:undefined));
  round=2;await f.again();
  assert.deepEqual(f.rows().map(r=>[r.id,r.retired]),[['fb:123_700',true],['fb:123_800',false]]);
  round=3;await f.again();
  assert.deepEqual(f.rows().map(r=>[r.id,r.retired]),[['fb:123_700',false],['fb:123_800',false]],'the retired row is revived, no fb:555');
  round=4;await f.again();
  assert.deepEqual(f.rows().map(r=>[r.id,r.pagePostId,r.videoId,r.retired]),[['fb:123_700','123_700','555',true],['fb:123_701','123_701','555',false],['fb:123_800','123_800',null,false]]);
});

test('scene 12: production-form rows without keys keep their ids and only gain the page post id',async t=>{
  let round=1;
  const f=await fbFixture(t,async()=>fbResult(round===1?[fbPost('123_700'),fbPost('123_701')]:[fbPost('123_700',{pagePostId:'123_700'}),fbPost('123_701',{pagePostId:'123_701'})]));
  round=2;await f.again();
  assert.deepEqual(f.rows().map(r=>[r.id,r.pagePostId,r.retired]),[['fb:123_700','123_700',false],['fb:123_701','123_701',false]]);
});

// 5회차 GA5: 한 회차에 같은 저장 줄로 풀린 뒤 줄의 주소(릴스)는 버리지 않고 별칭으로 남는다. 저장 줄의 릴스 주소는 피드 주소로 바뀌지 않고 피드 주소가 별칭이다.
test('a later row of one collection leaves its reel address as an alias, and a stored reel address keeps the feed address as an alias',async t=>{
  let round=1;
  const f=await fbFixture(t,async()=>fbResult(round===1?[fbPost('123_700',{pagePostId:'123_700',videoId:'555',url:FEED})]
    :round===2?[fbPost('123_700',{pagePostId:'123_700',url:FEED}),fbPost('555',{videoId:'555',url:REEL,publishedAt:AT_VIDEO})]
    :[fbPost('123_701',{pagePostId:'123_701',videoId:'556',url:'https://www.facebook.com/reel/556/',publishedAt:AT_VIDEO}),fbPost('123_701',{pagePostId:'123_701',url:'https://www.facebook.com/synk/posts/701'})],PARTIAL));
  round=2;await f.again();
  const row=f.app.store.get('posts','fb:123_700');
  assert.deepEqual([row.url,row.aliasUrls],[FEED,[{url:REEL,publishedAt:AT_VIDEO}]]);
  round=3;await f.again();
  const reel=f.app.store.get('posts','fb:123_701');
  assert.deepEqual([reel.url,reel.publishedAt,reel.aliasUrls],['https://www.facebook.com/reel/556/',AT_VIDEO,[{url:'https://www.facebook.com/synk/posts/701',publishedAt:AT}]]);
  assert.equal(f.app.store.get('posts','fb:123_700').aliasUrls.length,1,'stored aliases stay');
});

// 5회차 GA6: 번호 없는 영상 줄과 영상 정보 없는 피드 줄이 따로 생긴 뒤 두 번호가 함께 오면 활성 줄은 하나다. 내린 줄의 다른 날 스냅샷 · 관측은 옮겨 온다.
test('a row with both keys absorbs the active rows that each held one of them, with their history',async t=>{
  let round=1;
  const f=await fbFixture(t,async()=>fbResult(round===1?[fbPost('555',{videoId:'555',publishedAt:AT_VIDEO,metrics:{views:9}})]
    :round===2?[fbPost('123_700',{pagePostId:'123_700',url:FEED,metrics:{likes:3}})]
    :round===3?[fbPost('123_700',{pagePostId:'123_700',videoId:'555',url:FEED,aliasUrls:[{url:REEL,publishedAt:AT_VIDEO}],metrics:{views:12,likes:4}})]
    :[fbPost('555',{videoId:'555',publishedAt:AT_VIDEO,metrics:{views:13}})],PARTIAL));
  round=2;await f.again();
  assert.deepEqual(f.rows().map(r=>[r.id,r.retired]),[['fb:123_700',false],['fb:555',false]]);
  f.app.store.put('snapshots','fb:555:2026-10-11',{id:'fb:555:2026-10-11',postId:'fb:555',date:'2026-10-11',views:5,likes:null,comments:null,shares:null,source:'api:facebook'});
  f.app.store.put('hypeObservations','fb:555:2026-10-11T00:00:00.000Z',{id:'fb:555:2026-10-11T00:00:00.000Z',postId:'fb:555',channelId:'fb',views:5});
  round=3;await f.again();
  assert.deepEqual(f.rows().map(r=>[r.id,r.pagePostId,r.videoId,r.url,r.retired]),[['fb:123_700','123_700','555',FEED,false],['fb:555',null,'555',REEL,true]]);
  assert.equal(f.app.store.get('posts','fb:555').mergedInto,'fb:123_700');
  assert.deepEqual(f.app.store.get('posts','fb:123_700').aliasUrls,[{url:REEL,publishedAt:AT_VIDEO}]);
  assert.equal(f.app.store.get('snapshots','fb:123_700:2026-10-11')?.views,5,'another day moves over');
  assert.equal(f.app.store.get('hypeObservations','fb:123_700:2026-10-11T00:00:00.000Z')?.postId,'fb:123_700');
  const today=f.app.store.all('snapshots').filter(s=>s.postId==='fb:123_700'&&s.date!=='2026-10-11');
  assert.equal(today.length,1);assert.deepEqual([today[0].views,today[0].likes],[12,4]);
  // 설계 검토 3 장면 2 · 7: 합친 뒤 번호 없는 영상만 오는 회차 — 내린 줄은 되살아나지 않고 활성 줄은 하나다. 주 주소는 릴스가 되고 피드 주소가 별칭이다.
  round=4;await f.again();
  assert.deepEqual(f.rows().map(r=>[r.id,r.url,r.retired]),[['fb:123_700',REEL,false],['fb:555',REEL,true]]);
  assert.equal(f.app.store.get('posts','fb:555').mergedInto,'fb:123_700');
  assert.deepEqual(f.app.store.get('posts','fb:123_700').aliasUrls,[{url:FEED,publishedAt:AT}]);
});

// 설계 검토 3 조건 1: 한 게시물에 영상이 둘이고 게시물을 차지한 영상이 회차 사이에 바뀌면, 게시물 줄은 새 영상을 갖고 다른 영상은 자기 줄이다.
// 다른 영상의 주소는 게시물 줄의 별칭에 남지 않는다.
test('when the video that holds a post changes, the post row follows the new video and the other video keeps its own row',async t=>{
  let round=1;const R556='https://www.facebook.com/reel/556/';
  const f=await fbFixture(t,async()=>fbResult(round===1?[fbPost('123_700',{pagePostId:'123_700',videoId:'556',url:FEED,aliasUrls:[{url:R556,publishedAt:AT_VIDEO}],metrics:{views:90}}),fbPost('555',{videoId:'555',url:REEL,publishedAt:AT_VIDEO,metrics:{views:9}})]
    :[fbPost('123_700',{pagePostId:'123_700',videoId:'555',url:FEED,aliasUrls:[{url:REEL,publishedAt:AT_VIDEO}],metrics:{views:9}}),fbPost('556',{videoId:'556',url:R556,publishedAt:AT_VIDEO,metrics:{views:90}})]));
  assert.deepEqual(f.rows().map(r=>[r.id,r.videoId,r.retired]),[['fb:123_700','556',false],['fb:555','555',false]]);
  round=2;await f.again();
  assert.deepEqual(f.rows().map(r=>[r.id,r.pagePostId,r.videoId,r.url,r.retired]),[['fb:123_700','123_700','555',FEED,false],['fb:555',null,'555',REEL,true],['fb:556',null,'556',R556,false]]);
  assert.deepEqual(f.app.store.get('posts','fb:123_700').aliasUrls,[{url:REEL,publishedAt:AT_VIDEO}]);
  assert.equal(f.app.store.get('posts','fb:555').mergedInto,undefined,'an unseen row is not a merged row');
  const views=id=>f.app.store.all('snapshots').filter(s=>s.postId===id).map(s=>s.views);
  assert.deepEqual([views('fb:123_700'),views('fb:556')],[[9],[90]]);
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
