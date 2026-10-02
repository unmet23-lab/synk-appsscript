import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {today} from './store.mjs';
import {recentNextCheckAt,shouldCollectRecent,planFailure,recentPolicyChannel} from './collection-policy.mjs';

const advance=(at,n)=>new Date(Date.parse(at)+n*60000).toISOString();
const failure=(code,retryable=true)=>Object.assign(new Error('fixture failure'),{code,retryable});
async function fixture(t,collector){
  const dir=await mkdtemp(join(tmpdir(),'synk-hype-'));let at=today()+'T00:00:00.000Z';
  const app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false,clock:()=>at,collector});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(dir.includes('synk-hype-'));await rm(dir,{recursive:true,force:true});});
  const admin=app.store.createUser({name:'Admin',email:'admin@example.test',role:'admin'});
  const member=app.store.createUser({name:'Member',email:'member@example.test',role:'member',teamId:'team-a'});
  const other=app.store.createUser({name:'Other',email:'other@example.test',role:'member',teamId:'team-b'});
  app.store.put('settings','company',{companyName:'Test',enabled:true,hourKst:9});
  const sessions=new Map([admin,member,other].map(u=>[u.id,app.store.mint('session',u.id,{csrfToken:'csrf-test'},10)]));
  const call=async(path,body,user=admin)=>{const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(user?{Cookie:`synk_company_session=${sessions.get(user.id)}`} : {}),...(body!==undefined?{'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':'csrf-test'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
  const add=(id,owner=admin,connected=true)=>{const c={id,platform:'youtube',canonicalUrl:`https://www.youtube.com/@${id}`,handle:id,displayName:id,active:true,ownerIds:[owner.id],teamId:owner.teamId||null,status:'ready',connectionVersion:0,createdAt:at};app.store.put('channels',id,c);if(connected)app.store.setSecret('channel:'+id,{apiKey:'fixture-key',connectedBy:owner.id});return c;};
  return{app,admin,member,other,add,call,getAt:()=>at,setAt:x=>{at=x;},tick:async x=>{at=x;await app.scheduledTick(x);await app.waitForIdle();}};
}
function result(channel,at,views=9500){return{channel:{externalId:channel.id,displayName:channel.id,followers:100},posts:[{externalId:'recent',url:'https://www.youtube.com/watch?v=abcdefghijk',title:'recent '+channel.id,publishedAt:advance(at,-60),metrics:{views,likes:0,comments:2,shares:null,saves:null,reach:null}},{externalId:'old',url:'https://www.youtube.com/watch?v=oldoldoldol',title:'old',publishedAt:advance(at,-8*1440),metrics:{views:100}}],warnings:[],coverage:{status:'complete',ownerAuthorized:false}};}

test('full daily scan and 30-minute bounded recent scan preserve separate status and same-day observations',async t=>{
  const calls=[];let f;f=await fixture(t,async(c,credentials,options)=>{assert.equal(credentials.apiKey,'fixture-key');calls.push(options);return result(c,f.getAt(),calls.length===1?9500:11000);});
  f.add('first');const start=f.getAt();await f.tick(start);
  assert.equal(calls.length,1);assert.equal(calls[0],undefined);
  await f.tick(advance(start,29));assert.equal(calls.length,1);
  await f.tick(advance(start,30));assert.equal(calls.length,2);
  assert.equal(calls[1].recentSince,advance(start,30-7*1440));assert.equal(calls[1].now,advance(start,30));
  const channel=f.app.store.get('channels','first');assert.equal(channel.lastCollectedAt,start);assert.equal(channel.recentLastCollectedAt,advance(start,30));assert.equal(channel.status,'success');
  assert.equal(f.app.store.all('snapshots').length,2,'one daily snapshot per post');
  assert.equal(f.app.store.get('snapshots','first:recent:'+today()).views,9500,'30-minute observations must not rewrite the full daily snapshot');
  assert.equal(f.app.store.all('channelSnapshots')[0].checkedAt,start);
  const obs=f.app.store.all('hypeObservations');assert.equal(obs.length,2);assert.ok(obs.every(o=>o.postId==='first:recent'));assert.equal(obs[1].likes,0);assert.equal(obs[1].shares,null);assert.equal(obs[1].expiresAt,advance(start,30+8*1440));
  const feed=await f.call('/api/hype');assert.equal(feed.status,200);assert.equal(feed.data.collection.nextCheckAt,advance(start,60));assert.equal(feed.data.collection.connectedChannels,1);assert.equal(feed.data.items[0].kind,'milestone');
});

test('hype endpoint requires a login and applies channel ownership, team and scope filters',async t=>{
  let f;f=await fixture(t,async c=>result(c,f.getAt()));f.add('mine',f.member);f.add('hidden',f.other);const start=f.getAt();await f.tick(start);await f.tick(advance(start,30));
  assert.equal((await f.call('/api/hype',undefined,null)).status,401);
  const member=await f.call('/api/hype',undefined,f.member);assert.equal(member.status,200);assert.equal(member.data.collection.activeChannels,1);assert.equal(member.data.eligiblePostCount,1);assert.ok(!JSON.stringify(member.data).includes('hidden'));
  const inaccessible=await f.call('/api/hype?teamId=team-b',undefined,f.member);assert.equal(inaccessible.data.collection.activeChannels,0);assert.deepEqual(inaccessible.data.items,[]);
  assert.equal((await f.call('/api/hype?scope=mine',undefined,f.admin)).data.collection.activeChannels,0);
  assert.equal((await f.call('/api/hype?teamId=team-b')).data.collection.activeChannels,1);
});

test('recent retry respects backoff without overwriting full success and reconnect clears the incident',async t=>{
  let calls=0,f;f=await fixture(t,async(c,_,options)=>{calls++;if(options&&calls===2)throw failure('TIMEOUT');return result(c,f.getAt());});
  f.add('retry');const start=f.getAt();await f.tick(start);await f.tick(advance(start,30));
  const saved=f.app.store.get('channels','retry');assert.equal(saved.status,'success');assert.equal(saved.lastCollectedAt,start);assert.equal(saved.recentStatus,'error');assert.equal(saved.recentNextRetryAt,advance(start,35));
  await f.tick(advance(start,34));assert.equal(calls,2);
  const waiting=(await f.call('/api/hype')).data.collection;assert.equal(waiting.backoffChannels,1);assert.equal(waiting.nextCheckAt,advance(start,35));
  await f.tick(advance(start,35));assert.equal(calls,3);assert.equal(f.app.store.get('channels','retry').recentFailureKind,null);
  f.app.store.put('channels','retry',{...f.app.store.get('channels','retry'),recentFailureKind:'auth',recentRequiresReconnect:true,recentStatus:'error'});
  await f.tick(advance(start,100));assert.equal(calls,3);
  assert.equal((await f.call('/api/channels/retry/connection',{apiKey:'fixture-key'})).status,200);assert.equal(f.app.store.get('channels','retry').recentRequiresReconnect,false);
});

test('rate limiting, no connection, archive and pause never create 30-minute retry storms',()=>{
  const at='2026-09-27T00:00:00.000Z',failureState=planFailure(failure('RATE_LIMITED'),{},at);
  const c={id:'x',platform:'youtube',active:true,connected:true,status:'success',lastCollectedAt:at,recentStatus:'error',...Object.fromEntries(Object.entries(failureState).map(([k,v])=>['recent'+k[0].toUpperCase()+k.slice(1),v]))};
  assert.equal(recentNextCheckAt(c,{at:advance(at,30)}),advance(at,1440));assert.equal(shouldCollectRecent(c,{at:advance(at,30)}),false);
  for(const override of [{active:false},{connected:false},{collectionDisabled:true},{recentStatus:'collecting'}])assert.equal(shouldCollectRecent({...c,...override},{at:advance(at,1440)}),false);
  assert.equal(shouldCollectRecent(c,{at:advance(at,1440),enabled:false}),false);assert.equal(shouldCollectRecent(c,{at:advance(at,1440)}),true);
  assert.equal(recentPolicyChannel(c).failureKind,'rate-limit');
  const evening='2026-09-27T12:00:00.000Z';
  const exhausted={...c,recentLastFailureAt:evening,recentLastAttemptAt:evening,recentNextRetryAt:null,recentRetryCount:3};
  assert.equal(recentNextCheckAt(exhausted,{at:advance(evening,1)}),advance(evening,1440),'midnight cannot shorten quota cooldown after retry exhaustion');
});

test('disconnect deletes API hype observations and retention cleanup removes expired or orphaned rows',async t=>{
  let f;f=await fixture(t,async c=>result(c,f.getAt()));f.add('cleanup');const start=f.getAt();await f.tick(start);
  assert.equal(f.app.store.all('hypeObservations').length,1);
  const sample=f.app.store.all('hypeObservations')[0];
  f.app.store.put('hypeObservations','expired',{...sample,id:'expired',expiresAt:advance(start,-1)});
  f.app.store.put('hypeObservations','too-old',{...sample,id:'too-old',checkedAt:advance(start,-9*1440),expiresAt:advance(start,1440)});
  f.app.store.put('hypeObservations','orphan',{...sample,id:'orphan',postId:'missing'});
  await f.call('/api/hype');assert.equal(f.app.store.all('hypeObservations').length,1);
  await f.call('/api/channels/cleanup/disconnect',{});assert.equal(f.app.store.all('hypeObservations').length,0);assert.equal((await f.call('/api/hype')).data.collection.connectedChannels,0);
});

test('partial recent collection retains measurements but applies collectionError cooldown',async t=>{
  let calls=0,f;f=await fixture(t,async(c,_,options)=>{calls++;const data=result(c,f.getAt());if(options)data.coverage={status:'partial',scope:'recent',collectionError:{code:'RATE_LIMITED',retryable:true}};return data;});
  f.add('partial');const start=f.getAt();await f.tick(start);await f.tick(advance(start,30));assert.equal(calls,2);
  assert.equal(f.app.store.all('hypeObservations').length,2);const c=f.app.store.get('channels','partial');assert.equal(c.status,'success');assert.equal(c.recentFailureKind,'rate-limit');
  await f.tick(advance(start,60));assert.equal(calls,2);assert.equal((await f.call('/api/hype')).data.collection.backoffs[0].nextRetryAt,advance(start,1470));
});

test('recent null metrics cannot erase full daily measurements and queued work stays sequential',async t=>{
  let active=0,maxActive=0,f;f=await fixture(t,async(c,_,options)=>{active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,5));active--;const data=result(c,f.getAt());if(options){data.posts[0].metrics.views=null;data.coverage.status='partial';}return data;});
  f.add('one');f.add('two');const start=f.getAt();await f.tick(start);await f.tick(advance(start,30));
  assert.equal(maxActive,1);
  assert.ok(f.app.store.all('snapshots').filter(x=>x.postId.endsWith(':recent')).every(x=>x.views===9500&&x.checkedAt===start));
  assert.ok(f.app.store.all('hypeObservations').filter(x=>x.checkedAt===advance(start,30)).every(x=>x.views===null));
  const c=f.app.store.get('channels','one');assert.equal(c.coverage.status,'complete');assert.equal(c.recentCoverage.status,'partial');
});

test('a connection version change while recent collection runs rejects stale observations and releases busy status',async t=>{
  let release,entered;const pending=new Promise(resolve=>{entered=resolve;});let f;
  f=await fixture(t,async(c,_,options)=>{if(options){entered();await new Promise(resolve=>{release=resolve;});}return result(c,f.getAt());});
  f.add('versioned');const start=f.getAt();await f.tick(start);f.setAt(advance(start,30));
  await f.app.scheduledTick(f.getAt());await pending;
  const c=f.app.store.get('channels','versioned');f.app.store.put('channels',c.id,{...c,connectionVersion:c.connectionVersion+1});release();await f.app.waitForIdle();
  assert.equal(f.app.store.all('hypeObservations').length,1);assert.equal(f.app.store.get('channels',c.id).recentStatus,'ready');
});
