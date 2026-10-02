import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname,join,resolve } from 'node:path';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { Store } from './store.mjs';
import { createDailyTrendsService } from './daily-trends-service.mjs';
import { createCompanyApp } from './server.mjs';

const before='2026-10-01T20:59:00.000Z',due='2026-10-01T21:00:00.000Z'; // 2026-10-02 06:00 KST.
const minutes=(at,n)=>new Date(Date.parse(at)+n*60000).toISOString();
const source=(id='google-kr',region='KR',platform='google',status='ok',at=due)=>({id,region,platform,status,label:'Fixture source',url:'https://example.test/source',message:'Fixture source coverage',count:1,collectedAt:status==='ok'?at:null});
const item=(id='one',sourceId='google-kr',region='KR',platform='google',at=due)=>({id,sourceId,region,platform,title:'Fixture '+id,url:'https://example.test/'+id,publishedAt:null,rank:1,metric:{label:'Fixture metric',value:0,display:'0'},related:[{title:'Fixture article',url:'https://example.test/article',source:'Fixture news'}],collectedAt:at,category:platform==='youtube-culture'?'analysis':'search'});
const success=(at=due)=>({items:[item('one','google-kr','KR','google',at),item('analysis','youtube-culture-global','GLOBAL','youtube-culture',at)],sources:[source('google-kr','KR','google','ok',at),source('youtube-culture-global','GLOBAL','youtube-culture','ok',at)]});
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
async function removeFixture(directory){assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-daily-trends-'));await rm(directory,{recursive:true,force:true});}
async function fixture(t,collector=async({at})=>success(at)){
  const directory=await mkdtemp(join(tmpdir(),'synk-daily-trends-')),store=new Store(directory),cleanups=[];let at=due;
  const service=createDailyTrendsService({store,clock:()=>at,collector});
  t.after(async()=>{for(const cleanup of cleanups)await cleanup();await service.stop();if(store.db.isOpen)store.close();await removeFixture(directory);});
  return {store,service,setAt:value=>{at=value;},getAt:()=>at,onCleanup:fn=>cleanups.push(fn)};
}
async function apiFixture(t,collector=async({at})=>success(at)){
  const directory=await mkdtemp(join(tmpdir(),'synk-daily-trends-'));let at=due;
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,clock:()=>at,dailyTrendsCollector:collector});
  const address=await app.start(),base='http://127.0.0.1:'+address.port,users={},cookies={};
  for(const role of ['admin','manager','member','viewer']){users[role]=app.store.createUser({name:role,email:role+'@example.test',role});cookies[role]='synk_company_session='+app.store.mint('session',users[role].id,{csrfToken:'daily-fixture-csrf'},10);}
  t.after(async()=>{await app.stop();await removeFixture(directory);});
  async function request(path,body,role='admin',overrides={}){
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(role?{Cookie:cookies[role]}:{}),...(body===undefined?{}:{'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':'daily-fixture-csrf'}),...overrides},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,data:await response.json()};
  }
  return {app,users,request,setAt:value=>{at=value;}};
}

test('defaults and strict regional settings leave company settings and encrypted connections untouched',async t=>{
  const {service,store}=await fixture(t);const company=store.get('settings','company');
  store.setSecret('provider:youtube',{apiKey:'fixture-protected-api-key'});
  const beforeCredentials=store.db.prepare('SELECT ciphertext FROM credentials').all();
  assert.deepEqual(service.state().settings,{enabled:true,hourKst:6,minuteKst:0,regions:['KR','US','CN']});
  assert.equal(store.get('settings','daily-trends'),null,'a read does not initialize persistent settings');
  for(const input of [null,[],{enabled:1},{hourKst:'6'},{hourKst:24},{hourKst:-1},{minuteKst:60},{minuteKst:1.5},{regions:[]},{regions:['MN']},{regions:['GLOBAL']},{regions:['KR','KR']},{regions:'KR'},{apiKey:'forbidden'}])assert.throws(()=>service.configure(input),{status:400});
  assert.equal(store.get('settings','daily-trends'),null);
  assert.deepEqual(service.configure({enabled:false,hourKst:23,minuteKst:59,regions:['CN','KR']}).settings,{enabled:false,hourKst:23,minuteKst:59,regions:['KR','CN']});
  assert.equal(service.state().nextRunAt,null);
  assert.deepEqual(store.get('settings','company'),company);assert.deepEqual(store.db.prepare('SELECT ciphertext FROM credentials').all(),beforeCredentials);
});

test('KST due time, day/config idempotence and restart preserve issue history and GLOBAL analysis',async t=>{
  let calls=0;const {service,store,setAt}=await fixture(t,async({at,regions})=>{calls++;return {items:[item('one','google-'+regions[0].toLowerCase(),regions[0],'google',at),item('analysis','youtube-culture-global','GLOBAL','youtube-culture',at)],sources:[source('google-'+regions[0].toLowerCase(),regions[0],'google','ok',at),source('youtube-culture-global','GLOBAL','youtube-culture','ok',at)]};});
  setAt(before);assert.equal(service.state().today,'2026-10-02');assert.equal(service.state().nextRunAt,due);await service.tick();assert.equal(calls,0);
  setAt(due);await service.tick();await service.tick();assert.equal(calls,1);
  assert.equal(service.state().snapshot.items[1].region,'GLOBAL');assert.equal(service.state().snapshot.items[0].metric.value,0);
  const restarted=createDailyTrendsService({store,clock:()=>due,collector:async()=>{calls++;return success();}});await restarted.tick();assert.equal(calls,1);await restarted.stop();
  service.configure({regions:['US']});await service.tick();assert.equal(calls,2);await service.tick();assert.equal(calls,2);
  service.configure({hourKst:5,minuteKst:30});await service.tick();assert.equal(calls,2,'a time-only change does not rerun the same regional issue');
  setAt('2026-10-02T20:29:00.000Z');await service.tick();assert.equal(calls,2);
  setAt('2026-10-02T20:30:00.000Z');await service.tick();assert.equal(calls,3);
  assert.deepEqual(service.state().dates,['2026-10-03','2026-10-02']);assert.ok(service.state({date:'2026-10-02'}).snapshot.items.length>=2);
  assert.equal(store.all('dailyTrendSnapshots').length,3,'successful attempts keep immutable snapshot versions');
});

test('automatic failures use bounded persistent backoff and never expose collector credentials',async t=>{
  let calls=0;const {service,store,setAt}=await fixture(t,async()=>{calls++;throw new Error('Bearer fixture-private-token key=fixture-private-key');});
  await service.tick();assert.equal(calls,1);assert.equal(service.state().nextRunAt,minutes(due,15));
  setAt(minutes(due,14));await service.tick();assert.equal(calls,1);
  for(const elapsed of [15,75,255]){setAt(minutes(due,elapsed));await service.tick();}
  assert.equal(calls,4);assert.equal(service.state().lastAttempt.retryAt,null);
  setAt(minutes(due,600));await service.tick();assert.equal(calls,4);
  assert.doesNotMatch(JSON.stringify(store.all('dailyTrendRuns')),/fixture-private/);
  setAt(minutes(due,1440));await service.tick();assert.equal(calls,5);assert.equal(service.state().lastAttempt.automaticAttempts,1);
});

test('same-day partial, empty and thrown responses retain prior items with their original collection time',async t=>{
  let attempt=0;const {service,store,setAt}=await fixture(t,async({at})=>{
    attempt++;if(attempt===1)return {items:[item('old-a'),item('old-b','baidu-cn','CN','baidu')],sources:[source(),source('baidu-cn','CN','baidu')]};
    if(attempt===2)return {items:[item('new-a','google-kr','KR','google',at)],sources:[source('google-kr','KR','google','ok',at),source('baidu-cn','CN','baidu','error',at)]};
    if(attempt===3)return {items:[],sources:[source('google-kr','KR','google','ok',at),source('baidu-cn','CN','baidu','unavailable',at)]};
    throw new Error('Fixture unavailable');
  });
  await service.collect();setAt(minutes(due,5));await service.collect({force:true});let state=service.state();
  assert.deepEqual(state.snapshot.items.map(row=>row.id).sort(),['new-a','old-b']);assert.equal(state.lastAttempt.status,'partial');
  const retained=state.snapshot.sources.find(row=>row.id==='baidu-cn');assert.equal(retained.status,'error');assert.equal(retained.retained,true);assert.equal(retained.retainedAt,due);assert.equal(retained.count,1);assert.equal(retained.collectedAt,null);
  assert.equal(state.snapshot.items.find(row=>row.id==='old-b').collectedAt,due);
  setAt(minutes(due,10));await service.collect({force:true});state=service.state();assert.deepEqual(state.snapshot.items.map(row=>row.id).sort(),['new-a','old-b']);assert.ok(state.snapshot.sources.every(row=>row.retained));
  const saved=JSON.stringify(state.snapshot);setAt(minutes(due,15));await service.collect({force:true});assert.equal(JSON.stringify(service.state().snapshot),saved);
  assert.equal(store.all('dailyTrendSnapshots').length,3);assert.equal(store.all('dailyTrendRuns').length,4);
});

test('concurrent manual, forced and scheduled requests share one collection and all receive state',async t=>{
  const reached=deferred(),release=deferred();let calls=0;
  const {service}=await fixture(t,async({at})=>{calls++;reached.resolve();await release.promise;return success(at);});
  const first=service.collect();await reached.promise;const second=service.collect({force:true}),scheduled=service.tick();
  assert.equal(service.state().running,true);assert.equal(calls,1);release.resolve();
  const results=await Promise.all([first,second,scheduled]);assert.ok(results.every(state=>state.snapshot.items.length===2));assert.equal(service.state().running,false);assert.equal(calls,1);
  await service.collect();assert.equal(calls,1);await service.collect({force:true});assert.equal(calls,2);
});

test('a fresh running lease survives restart and only an expired lease is interrupted and retried',async t=>{
  let calls=0,at=minutes(due,1);const {service,store}=await fixture(t);await service.collect();const snapshot=service.state().snapshot;
  store.put('dailyTrendRuns','interrupted-fixture',{id:'interrupted-fixture',date:'2026-10-02',configKey:'2026-10-02:KR,US,CN',regions:['KR','US','CN'],status:'running',startedAt:at,automaticAttempts:1});
  const restored=createDailyTrendsService({store,clock:()=>at,collector:async()=>{calls++;return success(at);}});
  assert.equal(restored.state().lastAttempt.status,'running');assert.equal(restored.state().running,true);assert.deepEqual(restored.state().snapshot,snapshot);await restored.tick();assert.equal(calls,0);
  at=minutes(due,27);assert.equal(restored.state().nextRunAt,at);assert.equal(store.get('dailyTrendRuns','interrupted-fixture').status,'running','reading an expired lease does not mutate it');await restored.tick();assert.equal(calls,1);assert.equal(store.get('dailyTrendRuns','interrupted-fixture').status,'interrupted');await restored.stop();
});

test('a manual issue before 06:00 does not suppress that day scheduled refresh',async t=>{
  let calls=0;const {service,setAt}=await fixture(t,async({at})=>{calls++;return success(at);});
  setAt(before);await service.collect();assert.equal(calls,1);assert.equal(service.state().nextRunAt,due);
  setAt(due);await service.tick();assert.equal(calls,2);await service.tick();assert.equal(calls,2);
});

test('changing only the time after scheduled success applies tomorrow without repeating today issue',async t=>{
  let calls=0;const {service,setAt}=await fixture(t,async({at})=>{calls++;return success(at);});
  await service.tick();service.configure({hourKst:22,minuteKst:30});assert.equal(service.state().nextRunAt,'2026-10-03T13:30:00.000Z');
  setAt('2026-10-02T13:30:00.000Z');await service.tick();assert.equal(calls,1);
  setAt('2026-10-03T13:30:00.000Z');await service.tick();assert.equal(calls,2);
});

test('permanent unavailable sources do not cause repeated automatic collection',async t=>{
  let calls=0;const {service,setAt}=await fixture(t,async({at})=>{calls++;const result=success(at);result.sources.push(source('xiaohongshu-cn','CN','xiaohongshu','unavailable',at));return result;});
  await service.tick();assert.equal(service.state().lastAttempt.status,'partial');assert.equal(service.state().lastAttempt.retryAt,null);
  for(const elapsed of [15,75,255]){setAt(minutes(due,elapsed));await service.tick();}assert.equal(calls,1);
});

test('two service instances sharing one Store cannot collect concurrently, including forced requests',async t=>{
  const reached=deferred(),release=deferred();let calls=0;const {service,store}=await fixture(t,async()=>{calls++;reached.resolve();await release.promise;return success();});
  const peer=createDailyTrendsService({store,clock:()=>due,collector:async()=>{calls++;return success();}});
  const work=service.collect();await reached.promise;const response=await peer.collect({force:true});
  assert.equal(response.running,true);assert.equal(peer.state().running,true);assert.equal(calls,1);assert.equal(peer.state().nextRunAt,minutes(due,25));
  await peer.stop();assert.equal(service.state().running,true,'stopping a peer does not release another collector lease');release.resolve();await work;assert.equal(service.state().running,false);assert.equal(calls,1);
});

test('two SQLite connections share the atomic lease and expired responses cannot replace the new issue',async t=>{
  const reached=deferred(),release=deferred();let calls=0;
  const {service,store,setAt,onCleanup}=await fixture(t,async()=>{calls++;reached.resolve();await release.promise;return {items:[item('stale')],sources:[source()]};});
  const peerStore=new Store(store.directory);let peerAt=due;
  const peer=createDailyTrendsService({store:peerStore,clock:()=>peerAt,collector:async({at})=>{calls++;return {items:[item('fresh','google-kr','KR','google',at)],sources:[source('google-kr','KR','google','ok',at)]};}});
  onCleanup(async()=>{release.resolve();await peer.stop();if(peerStore.db.isOpen)peerStore.close();});
  const oldWork=service.collect();await reached.promise;assert.equal((await peer.collect({force:true})).running,true);assert.equal(calls,1);
  peerAt=minutes(due,26);setAt(peerAt);await peer.tick();assert.equal(calls,2);const newest=JSON.stringify(peer.state().snapshot);assert.equal(peer.state().snapshot.items[0].id,'fresh');
  release.resolve();await oldWork;assert.equal(JSON.stringify(service.state().snapshot),newest);assert.equal(service.state().snapshot.collectedAt,peerAt);
  assert.deepEqual(store.all('dailyTrendRuns').map(row=>row.status),['interrupted','success']);assert.equal(store.all('dailyTrendSnapshots').length,1);
});

test('disabling the schedule keeps manual collection available and stop waits for outstanding writes',async t=>{
  const reached=deferred(),release=deferred();let calls=0;
  const {service,store}=await fixture(t,async()=>{calls++;reached.resolve();await release.promise;return success();});
  service.configure({enabled:false});await service.tick();assert.equal(calls,0);
  const manual=service.collect();await reached.promise;let stopped=false;const stopping=service.stop().then(()=>{stopped=true;});await nextTurn();
  assert.equal(stopped,false);assert.equal(store.db.isOpen,true);assert.equal(service.state().nextRunAt,null);await assert.rejects(service.collect(),{status:503});
  release.resolve();await Promise.all([manual,stopping]);assert.equal(stopped,true);assert.equal(store.all('dailyTrendIssues').length,1);assert.equal(service.state().running,false);
});

test('invalid collector shapes and unsafe item URLs cannot overwrite a successful issue',async t=>{
  let result=success();const {service}=await fixture(t,async()=>result);await service.collect();const saved=JSON.stringify(service.state().snapshot);
  for(const value of [{items:[],sources:[source('bad','MN')]},{items:[{...item(),url:'javascript:alert(1)'}],sources:[source()]},{items:[item('bad','missing')],sources:[source()]},{items:[],sources:[source(),source()]},{items:null,sources:[]}]){result=value;await service.collect({force:true});assert.equal(service.state().lastAttempt.status,'error');assert.equal(JSON.stringify(service.state().snapshot),saved);}
});

test('authenticated staff may read feed history while administrator mutations require Origin and CSRF',async t=>{
  let calls=0;const {app,request}=await apiFixture(t,async({at})=>{calls++;return success(at);});
  const company=app.store.get('settings','company');app.store.setSecret('provider:youtube',{apiKey:'fixture-encrypted-provider-key'});
  assert.equal((await request('/api/daily-trends',undefined,null)).status,401);
  for(const role of ['admin','manager','member','viewer']){const result=await request('/api/daily-trends',undefined,role);assert.equal(result.status,200);assert.equal(result.data.snapshot,null);}
  for(const role of ['manager','member','viewer'])for(const path of ['/api/daily-trends/collect','/api/daily-trends/settings'])assert.equal((await request(path,{},role)).status,403);
  assert.equal((await request('/api/daily-trends/collect',{},'admin',{'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await request('/api/daily-trends/settings',{enabled:false},'admin',{Origin:'https://invalid.example'})).status,403);assert.equal(calls,0);
  assert.equal((await request('/api/daily-trends?date=2026-02-30')).status,400);assert.equal((await request('/api/daily-trends?date=wrong')).status,400);
  assert.equal((await request('/api/daily-trends?demo=1')).status,400);
  assert.equal((await request('/api/daily-trends/collect',{force:'true'})).status,400);
  const collected=await request('/api/daily-trends/collect',{});assert.equal(collected.status,200);assert.equal(collected.data.running,false);assert.equal(collected.data.snapshot.items.length,2);
  await request('/api/daily-trends/collect',{});assert.equal(calls,1);await request('/api/daily-trends/collect',{force:true});assert.equal(calls,2);
  const changed=await request('/api/daily-trends/settings',{enabled:true,hourKst:7,minuteKst:30,regions:['KR','CN']});assert.equal(changed.status,200);assert.equal(changed.data.settings.minuteKst,30);
  assert.equal((await request('/api/daily-trends/settings',{minuteKst:60})).status,400);
  const read=await request('/api/daily-trends?date=2026-10-02',undefined,'viewer');assert.equal(read.data.snapshot.date,'2026-10-02');assert.doesNotMatch(JSON.stringify(read.data),/fixture-encrypted-provider-key/);
  assert.deepEqual(app.store.get('settings','company'),company);assert.equal(app.store.secret('provider:youtube').apiKey,'fixture-encrypted-provider-key');
  assert.equal(app.store.all('audit').filter(row=>row.action==='daily-trends-settings').length,1);assert.equal(app.store.all('audit').filter(row=>row.action==='daily-trends-collect').length,3);
});

test('server scheduled tick is independent of company SNS settings and waitForIdle includes trends',async t=>{
  const reached=deferred(),release=deferred();let calls=0;
  const {app,setAt}=await apiFixture(t,async({at})=>{calls++;reached.resolve();await release.promise;return success(at);});
  const company={...app.store.get('settings','company'),enabled:false};app.store.put('settings','company',company);
  setAt(before);await app.scheduledTick();assert.equal(calls,0);
  setAt(due);await app.scheduledTick();await reached.promise;let idle=false;const waiting=app.waitForIdle().then(()=>{idle=true;});await nextTurn();assert.equal(idle,false);
  release.resolve();await waiting;assert.equal(idle,true);assert.equal(calls,1);assert.equal(app.dailyTrends.state().snapshot.items.length,2);assert.deepEqual(app.store.get('settings','company'),company);
  await app.scheduledTick();await app.waitForIdle();assert.equal(calls,1);
});

test('server stop finishes an active trend collection before closing SQLite',async t=>{
  const reached=deferred(),release=deferred();const {app}=await apiFixture(t,async()=>{reached.resolve();await release.promise;return success();});
  const collecting=app.dailyTrends.collect();await reached.promise;let closed=false;const stopping=app.stop().then(()=>{closed=true;});await nextTurn();assert.equal(closed,false);assert.equal(app.store.db.isOpen,true);
  release.resolve();const result=await collecting;assert.equal(result.snapshot.items.length,2);await stopping;assert.equal(app.store.db.isOpen,false);assert.equal(closed,true);
});
