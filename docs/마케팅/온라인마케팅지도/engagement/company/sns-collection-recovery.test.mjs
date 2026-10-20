import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {Store} from './store.mjs';
import {collectChannel} from './collectors.mjs';
import {planFailure,shouldCollect} from './collection-policy.mjs';
import {createSocialPublishingService} from './social-publishing.mjs';
import {createSocialPublishingProvider} from './social-publishing-provider.mjs';

// 10-20 집계 점검에서 확인한 멈춤·오분류·쌓임을 고친 동작.
const ok=value=>({ok:true,status:200,json:async()=>value});
const reply=(status,value)=>({ok:status>=200&&status<300,status,json:async()=>value});

test('platform limits and transient errors are retried instead of asking to reconnect or giving up',async()=>{
  const youtube=reason=>collectChannel('https://youtube.com/@synk',{apiKey:'TEST_ONLY_KEY'},{fetchImpl:async()=>reply(403,{error:{code:403,errors:[{reason}]}})});
  for(const reason of ['rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded','quotaExceeded'])await assert.rejects(youtube(reason),error=>error.code==='RATE_LIMITED'&&error.retryable===true,reason);
  await assert.rejects(youtube('forbidden'),error=>error.code==='AUTH_REQUIRED');
  const facebook=(status,error)=>collectChannel('https://www.facebook.com/synkworld',{accessToken:'fixture'},{fetchImpl:async()=>reply(status,{error})});
  for(const code of [80001,80002])await assert.rejects(facebook(400,{code,message:'too many calls'}),error=>error.code==='RATE_LIMITED'&&error.retryable===true,String(code));
  await assert.rejects(facebook(400,{code:1,is_transient:true}),error=>error.code==='API_ERROR'&&error.retryable===true);
  await assert.rejects(facebook(400,{code:100}),error=>error.code==='API_ERROR'&&error.retryable===false,'a rejected parameter stays a settings problem');
  const broken=await collectChannel('https://youtube.com/@synk',{apiKey:'TEST_ONLY_KEY'},{fetchImpl:async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('terminated');}})}).catch(error=>error);
  assert.equal(broken.code,'INVALID_RESPONSE');assert.equal(broken.retryable,true);
});

test('failure plans keep unknown and connection-change errors recoverable and send owner loss to reconnect',()=>{
  const at='2026-10-20T01:00:00.000Z',code=(value,extra={})=>Object.assign(new Error('x'),{code:value,...extra});
  assert.deepEqual([planFailure(code('CONNECTION_CHANGED'),{},at).failureKind,planFailure(code('CONNECTION_CHANGED'),{},at).retryCount],['transient',1]);
  assert.equal(planFailure(code('CONNECTION_OWNER_INACTIVE'),{},at).failureKind,'auth');
  assert.equal(planFailure(code('CONNECTION_OWNER_INACTIVE'),{},at).requiresReconnect,true);
  const unknown=planFailure(new Error('no code'),{},at);
  assert.deepEqual([unknown.failureKind,unknown.nextRetryAt],['transient',null],'no burst of retries, but not permanent either');
  assert.equal(planFailure(code('INVALID_RESPONSE',{retryable:true}),{},at).nextRetryAt,'2026-10-20T01:05:00.000Z');
  assert.equal(planFailure(code('CHANNEL_NOT_FOUND'),{},at).failureKind,'permanent');
  // 다음 날 수집 시각에는 다시 돈다.
  const channel={platform:'youtube',active:true,connected:true,status:'error',...unknown,lastAttemptAt:at};
  assert.equal(shouldCollect(channel,{at:'2026-10-20T02:00:00.000Z',hourKst:9}),false);
  assert.equal(shouldCollect(channel,{at:'2026-10-21T00:05:00.000Z',hourKst:9}),true);
});

async function appFixture(t,{collector,seed=()=>{}}={}){
  const keys=['SYNK_COMPANY_BACKGROUND_JOBS_ENABLED','SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED'],before=keys.map(key=>process.env[key]);
  process.env[keys[0]]='0';process.env[keys[1]]='1';
  const directory=await mkdtemp(join(tmpdir(),'synk-collection-recovery-')),store=new Store(directory);
  const admin=store.createUser({name:'Synthetic admin',email:'recovery@example.test',role:'admin'});
  store.put('settings','company',{enabled:true,hourKst:9});seed(store,admin);store.close();
  let at='2026-10-20T00:05:00.000Z';
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,channelCollectionEnabled:true,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,clock:()=>at,collector});
  t.after(async()=>{await app.stop();for(let i=0;i<keys.length;i++)if(before[i]===undefined)delete process.env[keys[i]];else process.env[keys[i]]=before[i];await rm(directory,{recursive:true,force:true});});
  return {app,admin,setClock:value=>{at=value;},tick:async()=>{await app.scheduledTick(at);await app.waitForIdle();}};
}
const youtubeChannel=(id,admin,extra={})=>({id,platform:'youtube',canonicalUrl:'https://www.youtube.com/@'+id,handle:id,ownerIds:[admin.id],active:true,status:'ready',connectionVersion:1,lastCollectedAt:'2026-10-19T00:10:00.000Z',lastAttemptAt:'2026-10-19T00:10:00.000Z',...extra});
const collected=c=>({channel:{externalId:c.id,followers:1,views:1,metrics:{posts:0}},posts:[],coverage:{status:'complete',inventoryComplete:true,ownerAuthorized:false}});

test('a failed recent scan no longer stops the daily full scan; only an active platform limit holds both',async t=>{
  const calls=[];
  const f=await appFixture(t,{collector:async(c,credentials,options)=>{calls.push([c.id,options?.recentSince?'recent':'full']);return collected(c);},seed:(store,admin)=>{
    store.put('channels','broken',youtubeChannel('broken',admin,{recentStatus:'error',recentFailureKind:'permanent',recentFailureCode:'INVALID_CONFIG',recentLastFailureAt:'2026-10-19T23:30:00.000Z',recentLastAttemptAt:'2026-10-19T23:30:00.000Z',recentLastCollectedAt:'2026-10-19T23:00:00.000Z'}));
    store.put('channels','limited',youtubeChannel('limited',admin,{recentStatus:'error',recentFailureKind:'rate-limit',recentFailureCode:'RATE_LIMITED',recentRetryCount:1,recentNextRetryAt:'2026-10-20T20:00:00.000Z',recentLastFailureAt:'2026-10-19T23:30:00.000Z',recentLastAttemptAt:'2026-10-19T23:30:00.000Z',recentLastCollectedAt:'2026-10-19T23:00:00.000Z'}));
    for(const id of ['broken','limited'])store.setSecret('channel:'+id,{apiKey:'synthetic-key'});
  }});
  await f.tick();
  assert.deepEqual(calls,[['broken','full']],'09:05 KST full scan runs despite the recent failure; the rate-limited channel waits');
  const broken=f.app.store.get('channels','broken');
  assert.equal(broken.status,'success');assert.equal(broken.recentFailureKind,null,'a full success also clears the recent incident');
});

test('a channel archived while queued is not left failed or busy and collects again when restored',async t=>{
  let release;const gate=new Promise(resolve=>{release=resolve;}),calls=[];
  const f=await appFixture(t,{collector:async c=>{calls.push(c.id);if(c.id==='first')await gate;return collected(c);},seed:(store,admin)=>{for(const id of ['first','second']){store.put('channels',id,youtubeChannel(id,admin));store.setSecret('channel:'+id,{apiKey:'synthetic-key'});}}});
  const tick=f.app.scheduledTick('2026-10-20T00:05:00.000Z');await tick;
  const second=f.app.store.get('channels','second');f.app.store.put('channels','second',{...second,active:false});release();await f.app.waitForIdle();
  const archived=f.app.store.get('channels','second');
  assert.deepEqual([archived.status,archived.failureKind??null,archived.lastAttemptAt],['ready',null,null]);
  assert.equal(f.app.store.all('runs').find(run=>run.channelId==='second').status,'cancelled');
  f.app.store.put('channels','second',{...archived,active:true});await f.tick();
  assert.deepEqual(calls,['first','second']);
});

test('one failing write in error handling does not stop later collections',async t=>{
  const calls=[];
  const f=await appFixture(t,{collector:async c=>{calls.push(c.id);if(c.id==='first')throw Object.assign(new Error('boom'),{code:'API_ERROR',retryable:true});return collected(c);},seed:(store,admin)=>{store.put('channels','first',youtubeChannel('first',admin));store.setSecret('channel:first',{apiKey:'synthetic-key'});}});
  const put=f.app.store.put.bind(f.app.store);let fail=true;
  f.app.store.put=(kind,id,body)=>{if(fail&&kind==='channels'&&body?.status==='error'){fail=false;throw new Error('disk full');}return put(kind,id,body);};
  await f.tick();
  f.app.store.put=put;
  f.app.store.put('channels','second',youtubeChannel('second',f.admin));f.app.store.setSecret('channel:second',{apiKey:'synthetic-key'});
  f.setClock('2026-10-20T00:06:00.000Z');await f.tick();
  assert.ok(calls.includes('second'),'the queue keeps running after a rejected job');
});

test('production settings purge expired records and old collection runs once an hour',async t=>{
  const old='2026-10-01T00:00:00.000Z',recent='2026-10-19T00:00:00.000Z';
  const f=await appFixture(t,{collector:async c=>collected(c),seed:store=>{
    store.put('posts','expired',{id:'expired',channelId:'x',source:'api:youtube',expiresAt:'2026-10-19T00:00:00.000Z'});
    store.put('posts','kept',{id:'kept',channelId:'x',source:'api:instagram',expiresAt:null});
    store.put('snapshots','expired-snapshot',{id:'expired-snapshot',postId:'kept',expiresAt:'2026-10-19T00:00:00.000Z'});
    store.put('hypeObservations','stale',{id:'stale',postId:'kept',checkedAt:'2026-10-10T00:00:00.000Z'});
    store.put('hypeObservations','orphan',{id:'orphan',postId:'gone',checkedAt:recent});
    store.put('hypeObservations','fresh',{id:'fresh',postId:'kept',checkedAt:recent});
    for(const [id,status,startedAt] of [['old-success','success',old],['new-success','success',recent]])store.put('runs',id,{id,channelId:'x',status,startedAt});
  }});
  // 서버가 켜질 때 이전 프로세스의 대기 기록은 「중단」으로 바뀐다. 지금 프로세스가 기다리는 기록은 오래돼도 남긴다.
  f.app.store.put('runs','old-queued',{id:'old-queued',channelId:'x',status:'queued',startedAt:old});
  await f.tick();
  const ids=kind=>f.app.store.all(kind).map(row=>row.id).sort();
  assert.deepEqual(ids('posts'),['kept']);assert.deepEqual(ids('snapshots'),[]);assert.deepEqual(ids('hypeObservations'),['fresh']);
  assert.deepEqual(ids('runs'),['new-success','old-queued']);
  f.app.store.put('runs','older',{id:'older',channelId:'x',status:'error',startedAt:old});
  f.setClock('2026-10-20T00:30:00.000Z');await f.tick();assert.ok(ids('runs').includes('older'),'not again within the hour');
  f.setClock('2026-10-20T01:06:00.000Z');await f.tick();assert.ok(!ids('runs').includes('older'));
});

test('the newest runs for visible channels are read without loading every run',t=>{
  const directory=mkdtempSync(join(tmpdir(),'synk-latest-runs-')),store=new Store(directory);
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  for(let i=0;i<30;i++)store.put('runs','r'+i,{id:'r'+i,channelId:i%3===0?'hidden':'shown',startedAt:new Date(Date.UTC(2026,9,1,0,i)).toISOString()});
  const rows=store.latestIn('runs','channelId',new Set(['shown']),'startedAt',5);
  assert.deepEqual(rows.map(row=>row.id),['r29','r28','r26','r25','r23']);
  assert.throws(()=>store.latestIn('runs','channelId); DROP',['x'],'startedAt',1),/조회 항목/);
});

async function credentialFixture(t,{platform,credentials,respond}){
  const directory=await mkdtemp(join(tmpdir(),'synk-credential-keep-'));let getCredentials,at=Date.parse('2026-10-20T00:00:00.000Z'),calls=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{calls++;return respond(new URL(url),options);});
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,clock:()=>new Date(at).toISOString(),socialProviderFactory:input=>{getCredentials=input.getCredentials;return createSocialPublishingProvider(input);}});
  t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  const user={id:'connector',name:'Synthetic connector',email:'connector@example.test',role:'admin',active:true},channel={id:'keep',platform,active:true,ownerIds:[user.id],connectionVersion:1};
  app.store.put('users',user.id,user);app.store.put('channels',channel.id,channel);app.store.setSecret('provider:youtube',{clientId:'synthetic-client',clientSecret:'synthetic-client-secret'});
  app.store.setSecret('channel:'+channel.id,{...credentials(at),connectedBy:user.id});
  return {app,get:()=>getCredentials(channel),calls:()=>calls,advance:ms=>{at+=ms;}};
}

test('an Instagram token with days left keeps working while its early refresh is failing',async t=>{
  const f=await credentialFixture(t,{platform:'instagram',credentials:at=>({accessToken:'synthetic-valid',authType:'instagram-login',longLived:true,issuedAt:new Date(at-50*86400000).toISOString(),expiresAt:new Date(at+3*86400000).toISOString()}),respond:url=>{assert.equal(url.origin,'https://graph.instagram.com');return {ok:false,status:503,json:async()=>({})};}});
  assert.equal((await f.get()).accessToken,'synthetic-valid');assert.equal(f.calls(),1);
  assert.ok(f.app.store.get('oauthRefreshStates','keep'),'the failed refresh still backs off');
  assert.equal((await f.get()).accessToken,'synthetic-valid');assert.equal(f.calls(),1,'no second refresh during the hold');
});

test('a token about to expire still stops when its refresh fails, and one with minutes left keeps going',async t=>{
  const failing=url=>{assert.equal(url.origin,'https://oauth2.googleapis.com');return {ok:false,status:503,json:async()=>({})};};
  const nearly=await credentialFixture(t,{platform:'youtube',credentials:at=>({accessToken:'synthetic-old',refreshToken:'synthetic-refresh',expiresAt:new Date(at+60000).toISOString()}),respond:failing});
  await assert.rejects(nearly.get(),{code:'oauth_unavailable'});
  const minutes=await credentialFixture(t,{platform:'youtube',credentials:at=>({accessToken:'synthetic-old',refreshToken:'synthetic-refresh',expiresAt:new Date(at+4*60000).toISOString()}),respond:failing});
  assert.equal((await minutes.get()).accessToken,'synthetic-old');
});

test('seven-day post counts use channels observed in the last three hours, across midnight',t=>{
  const directory=mkdtempSync(join(tmpdir(),'sns-observed-window-')),store=new Store(directory);let time='2026-10-19T15:05:00.000Z';
  const service=createSocialPublishingService({store,clock:()=>time,provider:{capability:()=>({mode:'automatic',canPublish:true})}});
  t.after(async()=>{await service.close();store.close();rmSync(directory,{recursive:true,force:true});});
  store.put('users','member',{id:'member',role:'member',active:true});
  store.put('channels','a',{id:'a',platform:'facebook',ownerIds:['member'],active:true,lastCollectedAt:'2026-10-19T14:50:00.000Z'});
  store.put('channels','b',{id:'b',platform:'facebook',ownerIds:['member'],active:true,lastCollectedAt:'2026-10-19T10:00:00.000Z',recentLastCollectedAt:'2026-10-19T11:00:00.000Z'});
  for(const [id,channelId] of [['p1','a'],['p2','b']])store.put('posts',id,{id,channelId,source:'api:facebook',publishedAt:'2026-10-18T00:00:00.000Z',expiresAt:null,unavailableAt:null});
  const observed=()=>service.workspace({id:'member',role:'member',active:true},{pageSize:50,section:'overview'}).observed;
  // 00:05 KST: 23:50 KST에 수집한 a는 센다(전에는 날짜가 바뀌어 「—」). 4시간 전인 b는 빼고 범위를 숫자 옆에 보인다.
  assert.deepEqual([observed().published7d,observed().channelsObserved,observed().channelsTotal],[1,1,2]);
  time='2026-10-19T18:00:00.000Z';assert.equal(observed().published7d,null,'no recent observation is not zero');
});
