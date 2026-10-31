import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {createPostPerformanceService} from './post-performance.mjs';

// 10-20 성과 수집 점검: 일시 오류 한 번이 핵심 지표 없이 기록을 끝내거나, 자체 시간 제한이 재시도 없이 끝나거나, 형식이 섞여 비교되던 것.
const BASE='2026-10-10T00:00:00.000Z',atHours=hours=>new Date(Date.parse(BASE)+hours*3600000).toISOString();
function fixture(t,{platform='instagram',collector,collectTimeoutMs,windowCollector}={}){
  const directory=mkdtempSync(join(tmpdir(),'synk-performance-recovery-')),store=new Store(directory);let at=BASE,calls=0;
  const owner={id:'owner',name:'Owner',active:true,role:'member',teamId:'a'};store.put('users',owner.id,owner);
  const channel={id:'channel',platform,handle:'synk',displayName:'SYNK',canonicalUrl:'https://example.invalid/synk',ownerIds:[owner.id],teamId:'a',active:true,connectionVersion:1};
  store.put('channels',channel.id,channel);store.setSecret('channel:channel',platform==='youtube'?{apiKey:'synthetic-key'}:{accessToken:'synthetic-token'});
  const service=createPostPerformanceService({store,clock:()=>at,collector:async(...args)=>{calls++;return collector(...args,calls);},...(collectTimeoutMs?{collectTimeoutMs}:{}),...(windowCollector?{windowCollector}:{})});
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  return {store,service,owner,now:hours=>{at=atHours(hours);},calls:()=>calls,checkpoint:(id,hours=24)=>store.get('postPerformanceEntries',id).checkpoints.find(item=>item.hours===hours)};
}
const reel='https://www.instagram.com/reel/REEL123/';

test('an insights outage is retried inside the window instead of closing the observation without views',async t=>{
  const f=fixture(t,{collector:(live,credentials,options,call)=>({posts:[{url:reel,publishedAt:BASE,metrics:call===1?{views:null,likes:5,comments:1,shares:null,saves:null,reach:null}:{views:900,likes:6,comments:1,shares:3,saves:2,reach:700}}],coverage:{source:'instagram-login-api',status:'partial',...(call===1?{collectionError:{code:'RATE_LIMITED',retryable:true},unavailableMetrics:['views','shares','saves','reach']}:{})}})});
  const entry=f.service.register(f.owner,{channelId:'channel',url:reel,publishedAt:BASE}).entry;
  f.now(24.01);const first=await f.service.collectDue();
  assert.equal(first.retried,1);assert.equal(f.checkpoint(entry.id).status,'retry');assert.equal(f.checkpoint(entry.id).lastErrorCode,'RATE_LIMITED');
  f.now(24.2);const second=await f.service.collectDue();
  assert.equal(second.recorded,1);const recorded=f.checkpoint(entry.id);
  assert.deepEqual([recorded.status,recorded.metrics.views,recorded.metrics.reach,recorded.metrics.shares],['recorded',900,700,3]);
});

test('when the outage lasts, the last chance records what arrived and says why the rest is missing',async t=>{
  const f=fixture(t,{collector:()=>({posts:[{url:reel,publishedAt:BASE,metrics:{views:null,likes:5,comments:1,shares:null,saves:null,reach:null}}],coverage:{source:'instagram-login-api',status:'partial',collectionError:{code:'TIMEOUT',retryable:true},unavailableMetrics:['views','shares','saves','reach']}})});
  const entry=f.service.register(f.owner,{channelId:'channel',url:reel,publishedAt:BASE}).entry;
  for(const hours of [24.01,24.2,24.6,25.2])f.now(hours),await f.service.collectDue();
  const recorded=f.checkpoint(entry.id);
  assert.equal(recorded.status,'recorded','after a bounded number of tries');assert.equal(recorded.metrics.likes,5);assert.equal(recorded.metrics.views,null);
  assert.match(recorded.unavailableReasons.views,/일시 오류/,'not "the platform does not provide this"');
  assert.match(recorded.unavailableReasons.subscribersGained,/제공하지 않는/,'metrics the platform never provides keep their reason');assert.match(recorded.unavailableReasons.completionRatePct,/API로 받을 수 없어요/);
  assert.doesNotMatch(recorded.unavailableReasons.earlyRetention3sPct,/일시 오류/,'a reel metric the response did not carry is not blamed on the outage');
});

test('a lagged YouTube Analytics metric missing after an outage does not hold the snapshot for retries',async t=>{
  // 늦게 반영되는 지표(laggedMetrics: 공유 등)는 24·72시간 스냅숏에 기록하지 않고 72시간 창이 채운다. 빈 칸 재시도가 그 칸을 기다리면 안 된다.
  const url='https://www.youtube.com/watch?v=aaaaaaaaaa1';
  const f=fixture(t,{platform:'youtube',collector:()=>({posts:[{url,publishedAt:BASE,metrics:{views:120,likes:4,comments:1,shares:null}}],coverage:{source:'youtube-data-api-v3',status:'partial',collectionError:{code:'RATE_LIMITED',retryable:true}}})});
  const entry=f.service.register(f.owner,{channelId:'channel',url,publishedAt:BASE}).entry;
  f.now(24.01);const summary=await f.service.collectDue();
  assert.equal(summary.recorded,1,'recorded on the first pass');const point=f.checkpoint(entry.id);
  assert.deepEqual([point.status,point.metrics.views,point.metrics.shares],['recorded',120,null]);assert.match(point.unavailableReasons.shares,/늦게 반영되는/);
});

test('a YouTube window waiting for a grant the connection never has closes after thirty days instead of retrying forever',async t=>{
  // 공개 읽기·API 키 연결에는 Analytics 권한이 없다. 창은 6시간마다 다시 보다가 창 시작(게시 5일 뒤)부터 30일이 지나면 닫고 더 부르지 않는다.
  const url='https://www.youtube.com/watch?v=bbbbbbbbbb2';let windowCalls=0;
  const f=fixture(t,{platform:'youtube',collector:()=>({posts:[{url,publishedAt:BASE,metrics:{views:50,likes:2,comments:0}}],coverage:{source:'youtube-data-api-v3',status:'complete'}}),
    windowCollector:async()=>{windowCalls++;throw Object.assign(new Error('no analytics grant'),{code:'AUTH_REQUIRED'});}});
  const entry=f.service.register(f.owner,{channelId:'channel',url,publishedAt:BASE}).entry;
  f.now(120.5);await f.service.collectDue();
  let plan=f.checkpoint(entry.id,72).window;assert.deepEqual([plan.status,plan.lastErrorCode,windowCalls],['retry','AUTH_REQUIRED',1]);
  f.now(120+30*24+1);await f.service.collectDue();
  plan=f.checkpoint(entry.id,72).window;assert.deepEqual([plan.status,plan.nextAttemptAt],['unavailable',null]);assert.match(plan.message,/30일/);
  const calls=windowCalls;f.now(120+40*24);await f.service.collectDue();assert.equal(windowCalls,calls,'a closed window is never asked again');
});

test('the collector running out of its own time limit is a timeout to retry, not a manual hand-off',async t=>{
  const f=fixture(t,{collectTimeoutMs:30,collector:(live,credentials,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('cancelled'),{code:'CANCELLED'})),{once:true});})});
  const entry=f.service.register(f.owner,{channelId:'channel',url:reel,publishedAt:BASE}).entry;
  f.now(24.01);const summary=await f.service.collectDue();
  assert.equal(summary.retried,1);assert.equal(f.checkpoint(entry.id).status,'retry');assert.equal(f.checkpoint(entry.id).lastErrorCode,'TIMEOUT');
});

test('a connection that changed during the check is checked again with the new connection, not handed to a person',async t=>{
  // 10-20: 재연결·토큰 갱신과 겹친 회차가 CONNECTION_CHANGED로 끝나면 관측 기간이 닫힐 때까지 사람 일로 남았다.
  const f=fixture(t,{collector:(live,credentials,options,call)=>{if(call===1)throw Object.assign(new Error('changed'),{code:'CONNECTION_CHANGED'});return {posts:[{url:reel,publishedAt:BASE,metrics:{views:900,likes:6,comments:1,shares:3,saves:2,reach:700}}],coverage:{source:'instagram-login-api',status:'complete'}};}});
  const entry=f.service.register(f.owner,{channelId:'channel',url:reel,publishedAt:BASE}).entry;
  f.now(24.01);const first=await f.service.collectDue();
  assert.equal(first.retried,1);assert.deepEqual([f.checkpoint(entry.id).status,f.checkpoint(entry.id).lastErrorCode],['retry','CONNECTION_CHANGED']);
  f.now(24.2);await f.service.collectDue();
  assert.deepEqual([f.checkpoint(entry.id).status,f.checkpoint(entry.id).metrics.views],['recorded',900]);
});

test('the performance screen compares a post only with earlier posts of the same format',async t=>{
  const url=n=>`https://www.youtube.com/watch?v=${String(n).padStart(11,'a')}`;
  const f=fixture(t,{platform:'youtube',collector:()=>({posts:[1,2,3,4,5].map(n=>({url:url(n),publishedAt:atHours(n),metrics:{views:n===4?5000:100*n,likes:1,comments:0}})),coverage:{source:'youtube-data-api-v3'}})});
  const formats={1:'youtube-shorts',2:'youtube-shorts',3:'youtube-shorts',4:'youtube-video',5:'youtube-shorts'};
  f.now(6);const ids={};for(const n of [1,2,3,4,5])ids[n]=f.service.register(f.owner,{channelId:'channel',url:url(n),publishedAt:atHours(n),publicationPackageId:'package-'+n,publicationFormat:formats[n]}).entry.id;
  for(const hours of [25,26,27,28,29])f.now(hours),await f.service.collectDue();
  const latest=f.service.list(f.owner).entries.find(row=>row.id===ids[5]).checkpoints[0].comparison.views;
  assert.equal(latest.sampleCount,3,'three earlier shorts, not the long video');assert.equal(latest.median,200);
});

// 10-31 운영: 최근 3일 놓친 관측 다섯 건이 모두 POST_NOT_IN_RESPONSE — 지우고 다시 올린 인스타그램 글과, 공개 전에 집계된 페이스북 예약 릴스였다.
// 목록을 끝까지 받았는데 없는 글은 모을 기간 내내 다시 봐도 나오지 않는다. 주소·시각을 플랫폼이 준 기록만 그렇게 판정한다(GPT 검수 두 회차).
const inventory=(options,posts,{recent={},...coverage}={})=>({posts,coverage:{source:'instagram-login-api',status:'complete',scope:'recent',inventoryComplete:true,...coverage,
  recent:{since:options.recentSince,until:options.now,complete:true,uncertainOrder:false,invalidDates:0,...recent}}});
const other={url:'https://www.instagram.com/reel/OTHER1/',publishedAt:BASE,metrics:{views:5,likes:1,comments:0,shares:0,saves:0,reach:4}};
// 집계가 자동 등록한 기록(discover: 수집기가 준 주소·시각)과 같은 꼴.
const autoEntry=f=>{const entry=f.service.register(f.owner,{channelId:'channel',url:reel,publishedAt:BASE}).entry;f.store.put('postPerformanceEntries',entry.id,{...f.store.get('postPerformanceEntries',entry.id),origin:'auto'});return entry;};

test('an auto-registered post missing from two complete lists stops its collection instead of retrying until it is missed',async t=>{
  // 인사이트 일부가 한도에 걸린 응답(partial)이어도 목록 자체를 끝까지 받았으면 같다.
  const f=fixture(t,{collector:(live,credentials,options)=>inventory(options,[other],{status:'partial',collectionError:{code:'RATE_LIMITED',retryable:true}})});
  const entry=autoEntry(f);
  f.now(24.01);const first=await f.service.collectDue();let point=f.checkpoint(entry.id);
  assert.deepEqual([first.retried,first.gone,point.status,point.lastErrorCode,point.absentConfirmedAt],[1,0,'retry','POST_NOT_IN_RESPONSE',atHours(24.01)],'one empty answer is not enough');
  assert.notEqual(f.store.get('postPerformanceEntries',entry.id).active,false);
  f.now(24.2);const second=await f.service.collectDue();
  const row=f.store.get('postPerformanceEntries',entry.id);point=f.checkpoint(entry.id);
  assert.deepEqual([second.gone,row.active,row.inactiveReason,row.goneAt,point.status,point.lastErrorCode,point.nextAttemptAt],[1,false,'post-gone',atHours(24.2),'retry','POST_GONE',null]);
  assert.match(point.message,/자동 수집을 멈췄어요/);assert.equal('leaseToken' in point,false);
  const calls=f.calls();for(const hours of [24.6,25.2,31,72.1,79])f.now(hours),await f.service.collectDue();
  assert.equal(f.calls(),calls,'a stopped entry is not fetched again');
  assert.deepEqual(f.store.get('postPerformanceEntries',entry.id).checkpoints.map(item=>item.status),['retry','pending'],'never closed as missed');
});

test('a post deleted after its 24-hour point was read from the API stops at 72 hours',async t=>{
  let deleted=false;
  const f=fixture(t,{collector:(live,credentials,options)=>inventory(options,deleted?[other]:[{...other,url:reel}])});
  const entry=f.service.register(f.owner,{channelId:'channel',url:reel,publishedAt:BASE}).entry;
  f.now(24.01);await f.service.collectDue();assert.equal(f.checkpoint(entry.id).providerPublishedAt,BASE);
  deleted=true;f.now(72.01);await f.service.collectDue();f.now(72.2);const late=await f.service.collectDue();
  const row=f.store.get('postPerformanceEntries',entry.id);
  assert.deepEqual([late.gone,row.active,f.checkpoint(entry.id,24).status,f.checkpoint(entry.id,72).lastErrorCode],[1,false,'recorded','POST_GONE']);
});

test('a hand-registered post the platform has not matched yet is never stopped, even when two complete lists lack it',async t=>{
  // GPT 검수 10-31: 실제 10:00 글을 12:00으로 넣으면(또는 하루 넘게 어긋나면) 최근 목록 창 밖으로 빠져 살아 있어도 없어 보인다.
  const f=fixture(t,{collector:(live,credentials,options)=>inventory(options,[{...other,url:reel,publishedAt:BASE}].filter(post=>post.publishedAt>=options.recentSince))});
  f.now(27);const entry=f.service.register(f.owner,{channelId:'channel',url:reel,publishedAt:atHours(26)}).entry;let gone=0;
  for(const hours of [50.01,50.2,50.6,51.2,52])f.now(hours),gone+=(await f.service.collectDue()).gone;
  const point=f.checkpoint(entry.id);
  assert.deepEqual([gone,f.store.get('postPerformanceEntries',entry.id).active,point.status,point.lastErrorCode,'absentConfirmedAt' in point],[0,true,'retry','POST_NOT_IN_RESPONSE',false]);
  f.now(56.01);await f.service.collectDue();assert.equal(f.checkpoint(entry.id).status,'missed','as before the change');
});

test('turning a stopped entry back on forgets the verdict and records the post once it is listed',async t=>{
  let listed=false;
  const f=fixture(t,{collector:(live,credentials,options)=>inventory(options,listed?[other,{...other,url:reel,metrics:{...other.metrics,views:80}}]:[other])});
  const entry=autoEntry(f);
  f.now(24.01);await f.service.collectDue();f.now(24.2);await f.service.collectDue();
  assert.equal(f.store.get('postPerformanceEntries',entry.id).active,false);
  listed=true;f.now(24.3);const resumed=f.service.setActive(f.owner,entry.id,true).entry;
  assert.deepEqual([resumed.active,'inactiveReason' in resumed,'goneAt' in resumed,'absentConfirmedAt' in resumed.checkpoints[0]],[true,false,false,false]);
  const result=await f.service.collectDue(),point=f.checkpoint(entry.id);
  assert.deepEqual([result.recorded,point.status,point.metrics.views,point.lastErrorCode,'absentConfirmedAt' in point],[1,'recorded',80,null,false]);
});

test('a first absence is forgotten when the post shows up on the next try',async t=>{
  let call=0;
  const f=fixture(t,{collector:(live,credentials,options)=>inventory(options,++call===1?[other]:[{...other,url:reel}])});
  const entry=autoEntry(f);
  f.now(24.01);await f.service.collectDue();assert.equal(f.checkpoint(entry.id).absentConfirmedAt,atHours(24.01));
  f.now(24.2);await f.service.collectDue();const point=f.checkpoint(entry.id);
  assert.deepEqual([point.status,point.metrics.views,'absentConfirmedAt' in point,f.store.get('postPerformanceEntries',entry.id).active],['recorded',5,false,true]);
});

test('a list that may be cut short, or an error, keeps retrying inside the window and never stops the entry',async t=>{
  const cases={
    'more pages':options=>inventory(options,[other],{inventoryComplete:false}),
    'order unknown':options=>inventory(options,[other],{recent:{uncertainOrder:true}}),
    'a post without a date':options=>inventory(options,[other],{recent:{invalidDates:1}}),
    'list starts after the post':options=>inventory(options,[other],{recent:{since:atHours(1)}}),
    'full collection, not the recent list':options=>({posts:[other],coverage:{source:'instagram-login-api',status:'complete',inventoryComplete:true}}),
    'network error':()=>{throw Object.assign(new Error('offline'),{code:'NETWORK_ERROR',retryable:true});},
  };
  for(const [name,collector] of Object.entries(cases)){
    const f=fixture(t,{collector:(live,credentials,options)=>collector(options)});
    const entry=autoEntry(f);let gone=0;
    for(const hours of [24.01,24.2,24.6,25.2,26])f.now(hours),gone+=(await f.service.collectDue()).gone;
    const point=f.checkpoint(entry.id);
    assert.deepEqual([gone,f.store.get('postPerformanceEntries',entry.id).active,point.status,'absentConfirmedAt' in point],[0,true,'retry',false],name);
    f.now(30.01);await f.service.collectDue();assert.equal(f.checkpoint(entry.id).status,'missed',name);
  }
});
