import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {Store} from './store.mjs';
import {collectChannel} from './collectors.mjs';

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

// 11-19: 페이스북 저장 줄에는 수집기가 준 페이지 게시물 번호(pagePostId)와 영상 번호(videoId)를 칸으로만 적는다. 같은 게시물의 줄을 잇거나 합치지 않는다
// (11-19 유호님 결정). 페이지 123, 영상 555, 게시물 700.
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
  const rows=()=>app.store.all('posts').filter(p=>p.channelId==='fb').map(p=>({id:p.id,externalId:p.externalId,pagePostId:p.pagePostId??null,videoId:p.videoId??null,url:p.url,retired:!!p.unavailableAt})).sort((x,y)=>x.id.localeCompare(y.id));
  return {app,again,rows};
}
const fbResult=(posts,coverage={status:'complete',inventoryComplete:true,ownerAuthorized:true})=>({channel:{externalId:'123',followers:0,views:null,metrics:{}},posts,coverage});
const REEL='https://www.facebook.com/reel/555/',FEED='https://www.facebook.com/synk/posts/700',AT='2026-10-10T00:00:00.000Z';
const fbPost=(externalId,fields={})=>({externalId,url:REEL,title:'릴스',publishedAt:AT,videoId:null,...fields,metrics:{views:null,likes:null,comments:null,shares:null,...fields.metrics}});
const PARTIAL={status:'partial',inventoryComplete:false,ownerAuthorized:true};

test('a page post id is stored only in its exact form, a video id only as digits, and both stay when a later collection lacks them',async t=>{
  let round=1;
  const f=await fbFixture(t,async()=>fbResult(round===1
    ?[fbPost('123_456',{pagePostId:'123_456',videoId:'456'}),fbPost('123_457',{pagePostId:'123_457&x',videoId:'45x'})]
    :round===2?[fbPost('123_456'),fbPost('123_457')]
    :[fbPost('123_456',{pagePostId:'123_456',videoId:'458'}),fbPost('123_457')]));
  const keys=()=>f.rows().map(r=>[r.externalId,r.pagePostId,r.videoId]);
  assert.deepEqual(keys(),[['123_456','123_456','456'],['123_457',null,null]]);
  round=2;await f.again();
  assert.deepEqual(keys(),[['123_456','123_456','456'],['123_457',null,null]]);
  round=3;await f.again();
  assert.deepEqual(keys(),[['123_456','123_456','458'],['123_457',null,null]],'a new value replaces the stored one');
});

test('rows of one post are never joined: a reel row and the feed row of its post stay two rows under their own ids',async t=>{
  let round=1;
  const f=await fbFixture(t,async()=>fbResult(round===1?[fbPost('555',{pagePostId:'123_700',videoId:'555',metrics:{views:9}})]
    :[fbPost('555',{pagePostId:'123_700',videoId:'555',metrics:{views:11}}),fbPost('123_700',{url:FEED,pagePostId:'123_700',metrics:{likes:3}})],PARTIAL));
  round=2;await f.again();
  assert.deepEqual(f.rows().map(r=>[r.id,r.externalId,r.pagePostId,r.videoId,r.url,r.retired]),[['fb:123_700','123_700','123_700',null,FEED,false],['fb:555','555','123_700','555',REEL,false]]);
  const views=id=>f.app.store.all('snapshots').filter(s=>s.postId===id).map(s=>s.views);
  assert.deepEqual(views('fb:555'),[11]);assert.deepEqual(views('fb:123_700'),[null]);
});

test('other platforms never store the facebook fields',async t=>{
  const f=await fixture(t,{collector:async c=>({...result(c),posts:result(c).posts.map(p=>({...p,pagePostId:'123_700',videoId:'555'}))})});
  const rows=f.app.store.all('posts');
  assert.ok(rows.length>0);
  for(const row of rows){assert.equal(row.pagePostId,undefined);assert.equal(row.videoId,undefined);}
});

// 운영 꼴: 칸 없는 저장 줄(릴스 주소 하나, 피드 둘)에 영상 둘 게시물이 오는 첫 수집. 기존 줄 번호는 그대로이고 칸만 채워진다. 둘째 영상은 자기 번호의 새 줄이다.
test('production form: keyless stored rows keep their ids and gain the fields, and a second video of a post gets its own row',async t=>{
  let round=1;
  const ok=value=>({ok:true,status:200,json:async()=>value});
  const fetchImpl=async raw=>{const url=new URL(raw);
    if(url.pathname.endsWith('/me'))return ok({id:'123'});
    if(url.pathname.endsWith('/posts'))return ok({data:[{id:'123_700',created_time:AT,permalink_url:'https://www.facebook.com/reel/555/'},{id:'123_701',created_time:AT,permalink_url:'https://www.facebook.com/synk/posts/701',attachments:{data:[{target:{id:'557'}},{target:{id:'558'}}]}},{id:'123_702',created_time:AT,permalink_url:'https://www.facebook.com/synk/posts/702'}]});
    if(url.pathname.endsWith('/videos'))return round===1?ok({data:[]}):ok({data:[{id:'555',post_id:'700',permalink_url:'/reel/555/',views:5,published:true,created_time:AT},{id:'557',post_id:'701',permalink_url:'/reel/557/',views:7,published:true,created_time:AT},{id:'558',post_id:'701',permalink_url:'/reel/558/',views:8,published:true,created_time:'2026-10-10T00:10:00.000Z'}]});
    throw new Error('unexpected');};
  const f=await fbFixture(t,async(live,credentials,options)=>collectChannel(live.canonicalUrl,credentials,{...(options||{}),fetchImpl}));
  for(const row of f.app.store.all('posts'))if(row.channelId==='fb'){const {pagePostId:_p,videoId:_v,...rest}=row;f.app.store.put('posts',row.id,rest);}
  round=2;await f.again();
  assert.deepEqual(f.rows().map(r=>[r.id,r.pagePostId,r.videoId,r.retired]),[['fb:123_700','123_700','555',false],['fb:123_701','123_701','557',false],['fb:123_702','123_702',null,false],['fb:558',null,'558',false]]);
});

// 8회차 GA1: 같은 날 전체 수집이 못 받은(null) 수치는 그날 앞서 받은 값을 지우지 않는다. 조회수는 그 줄이 이번에 다른 영상을 가리키면 앞 값으로 채우지 않는다.
test('a same-day facebook snapshot keeps the views a later collection lacks, unless the row now names another video',async t=>{
  let round=1;
  const views={1:12,2:null,3:null},video={1:'555',2:null,3:'556'};
  const f=await fbFixture(t,async()=>fbResult([fbPost('123_700',{url:FEED,pagePostId:'123_700',videoId:video[round],metrics:{views:views[round],likes:round}})]));
  const snap=()=>f.app.store.all('snapshots').find(s=>s.postId==='fb:123_700');
  assert.deepEqual([snap().views,snap().videoId],[12,'555']);
  round=2;await f.again();
  assert.deepEqual([snap().views,snap().videoId,snap().likes],[12,'555',2],'the video list failed, so the views of the day stay');
  round=3;await f.again();
  assert.deepEqual([snap().views,snap().videoId,snap().likes],[null,null,3],'the row now names another video, so the earlier views are not its views');
});

// 9회차 perf GA1: 최근 수집이 줄의 영상 번호를 바꾼 뒤 영상 목록만 실패한 전체 수집은 앞 영상의 조회수를 채우지 않는다.
test('a same-day facebook snapshot does not carry the views of a video the row no longer holds',async t=>{
  let views=9;
  const f=await fbFixture(t,async()=>fbResult([fbPost('123_700',{url:FEED,pagePostId:'123_700',videoId:views===null?null:'555',metrics:{views,likes:2}})]));
  const row=f.app.store.get('posts','fb:123_700');f.app.store.put('posts',row.id,{...row,videoId:'556'});
  views=null;await f.again();
  const snap=f.app.store.all('snapshots').find(s=>s.postId==='fb:123_700');
  assert.deepEqual([snap.views,snap.videoId,snap.likes,f.app.store.get('posts','fb:123_700').videoId],[null,null,2,'556']);
});

// 9회차 GA3 · GA6: 같은 날 앞 값은 담당이 같을 때만 채운다. 영상 번호가 적히기 전에 쓴 스냅샷(배포 전)은 같은 영상으로 본다.
test('a same-day facebook snapshot keeps earlier values only for the same owner, and treats a snapshot written before video ids as the same video',async t=>{
  let views=12;
  const f=await fbFixture(t,async()=>fbResult([fbPost('123_700',{url:FEED,pagePostId:'123_700',videoId:'555',metrics:{views,likes:4}})]));
  const snap=()=>f.app.store.all('snapshots').find(s=>s.postId==='fb:123_700');
  const {videoId:_v,...older}=snap();f.app.store.put('snapshots',older.id,older);
  views=null;await f.again();
  assert.deepEqual([snap().views,snap().videoId],[12,'555'],'a snapshot without a video id keeps its views for the video the row names');
  const owner=snap().ownership;f.app.store.put('snapshots',snap().id,{...snap(),ownership:{ownerIds:['earlier-owner'],teamId:'beta',known:true}});
  await f.again();
  assert.deepEqual([snap().views,snap().likes,snap().ownership],[null,4,owner],'the views an earlier owner got that day are not carried to the current owner');
});

// 8회차 GA3 · 9회차 GA1 · GA7: 게시물 번호는 수집기가 null(번호 없음)로 밝힌 줄에서만 지우고, 칸이 없으면 앞 값을 둔다. 영상 번호는 이번 회차가 다 알 수
// 있었을 때(전체 수집 · 목록 완전 · 영상 목록을 읽음)만 빈 값으로 지운다.
test('a page post id is cleared only when the collector says the row has none, and a video id only by a complete full collection that read the video list',async t=>{
  const KNOWN={status:'complete',inventoryComplete:true,ownerAuthorized:true,videoPostIds:{asked:true,videos:1,withPostId:1,matched:0,agreed:0,conflicts:0}};
  let coverage=KNOWN,fields={pagePostId:'123_700'},feed={videoId:'557'};
  const f=await fbFixture(t,async()=>fbResult([fbPost('556',{videoId:'556',...fields}),fbPost('123_701',{url:FEED,pagePostId:'123_701',...feed})],coverage));
  const keys=()=>f.rows().map(r=>[r.id,r.pagePostId,r.videoId]);
  assert.deepEqual(keys(),[['fb:123_701','123_701','557'],['fb:556','123_700','556']]);
  fields={};feed={};coverage=PARTIAL;await f.again();
  assert.deepEqual(keys(),[['fb:123_701','123_701','557'],['fb:556','123_700','556']],'an incomplete collection keeps both fields');
  coverage=KNOWN;await f.again();
  assert.deepEqual(keys(),[['fb:123_701','123_701',null],['fb:556','123_700','556']],'a complete collection clears the video id, and a row without the field keeps its page post id');
  fields={pagePostId:null};coverage=PARTIAL;await f.again();
  assert.deepEqual(keys(),[['fb:123_701','123_701',null],['fb:556',null,'556']],'a row the collector says has no number loses it, even in an incomplete collection');
});

// 8회차 perf GA2: 이번에 주소를 못 읽은 영상도 같은 줄에 저장된 주소가 있으면 그 줄을 갱신한다(다른 줄은 보지 않는다).
test('a facebook item whose address this collection could not read updates its own stored row with the stored address',async t=>{
  let round=1;
  const f=await fbFixture(t,async()=>fbResult(round===2?[]:[fbPost('555',{videoId:'555',url:round===1?REEL:null,metrics:{views:round===1?19:29}})],round===3?PARTIAL:undefined));
  round=2;await f.again();
  assert.equal(f.rows()[0].retired,true);
  round=3;await f.again();
  assert.deepEqual(f.rows().map(r=>[r.id,r.url,r.retired]),[['fb:555',REEL,false]]);
  assert.equal(f.app.store.all('snapshots').find(s=>s.postId==='fb:555').views,29);
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
