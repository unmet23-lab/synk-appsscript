import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';
import { createDatingLifecycleVerifier } from '../experiences/atlas-lab/dating-lifecycle.mjs';

const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',C='10000000-0000-4000-8000-000000000003';
const SECRET='local-fixture-only-no-real-credential-00001';
const config={token:SECRET,issuer:'synk-account',audience:'atlas-dating'};
const START='2026-10-07T03:00:00.000Z';
const event=(patch={})=>({version:1,type:'account.deleted',eventId:randomUUID(),subjectId:A,occurredAt:START,issuer:'synk-account',audience:'atlas-dating',...patch});
const consents={profilePublic:true,receiveInvitations:true,storePreferences:true};
async function fixture(t,{mode='account',configured=true}={}) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'synk-lifecycle-')),filename=path.join(dir,'account.sqlite');
  let store,service,server,origin,failReceipt=false,time=Date.parse(START);
  const verify=async token=>({accountId:({'user-a':A,'user-b':B,'user-c':C})[token]||'demo:foreign'});
  const start=async()=>{store=createDatingStore({path:filename,mode});const port={mode,path:filename,close:()=>store.close(),transaction:fn=>store.transaction(tx=>fn({...tx,putLifecycleReceipt(...args){if(failReceipt)throw new Error('synthetic receipt failure');return tx.putLifecycleReceipt(...args);}}))};
    service=createDatingService({store:port,mode,...(mode==='account'?{verify,...(configured?{lifecycle:config}:{})}:{}),clock:()=>time});
    server=http.createServer((req,res)=>service.handle(req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;};
  const close=async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));service.close();};await start();
  t.after(async()=>{await close();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('synk-lifecycle-'));await fs.rm(dir,{recursive:true,force:true});});
  const call=async(route,token,json,{browser=true,headers={},method=json===undefined?'GET':'POST'}={})=>{const response=await fetch(origin+'/api/atlas-dating'+route,{method,headers:{...(browser?{Origin:origin}:{}),...(token?{Authorization:`Bearer ${token}`} :{}),...(json===undefined?{}:{'Content-Type':'application/json'}),...headers},...(json===undefined?{}:{body:JSON.stringify(json)})});return{status:response.status,...await response.json()};};
  const get=async(token='user-a')=>{const r=await call('/state',token);assert.equal(r.status,200,JSON.stringify(r));return r.view;};
  const act=async(token,action)=>call('/action',token,{requestId:randomUUID(),expectedRevision:(await get(token)).revision,action});
  const ok=async(token,action)=>{const r=await act(token,action);assert.equal(r.status,200,JSON.stringify(r));return r;};
  const deliver=(input,options={})=>call('/lifecycle',SECRET,input,{browser:false,...options});
  const onboard=async token=>{await ok(token,{kind:'profile',profile:{nickname:token,region:'가상 지역',intro:'합성 자료',values:{availability:'weekend','self.pace':'lead','self.plan':'planned'},required:[]}});await ok(token,{kind:'adult',declared:true});await ok(token,{kind:'consents',consents});};
  const connected=async()=>{await onboard('user-a');await onboard('user-b');for(const [field,value] of Object.entries({consent:true,availability:'weekend'}))await ok('user-a',{kind:'discovery',action:{kind:'set',field,value}});
    const sent=await ok('user-a',{kind:'connect',targetAccountId:B}),pairId=sent.result.pairId;let p=(await get('user-b')).pairs.find(row=>row.pairId===pairId);
    await ok('user-b',{kind:'introduction',pairId,expectedIntroductionRevision:p.introduction.revision,action:{kind:'respond',introductionId:sent.result.introductionId,value:'accept'}});return pairId;};
  const appointment=async(token,pairId,action)=>{const p=(await get(token)).pairs.find(row=>row.pairId===pairId);return ok(token,{kind:'appointment',pairId,expectedPairRevision:p.revision,action});};
  return{get,call,act,ok,deliver,onboard,connected,appointment,get store(){return store;},get filename(){return filename;},fault:value=>{failReceipt=value;},advance:ms=>{time+=ms;},restart:async()=>{await close();await start();}};
}

test('lifecycle verifier is explicitly configured, server-only and constant-length digest comparison accepts only its configured token',()=>{
  for(const value of [undefined,{...config,token:'short'},{...config,token:'x'.repeat(32)+'\n'},{...config,issuer:'other'},{...config,audience:'other'},{...config,extra:true}])assert.throws(()=>createDatingLifecycleVerifier(value));
  const verifier=createDatingLifecycleVerifier(config),request={headers:{authorization:`Bearer ${SECRET}`},socket:{remoteAddress:'127.0.0.1',localAddress:'127.0.0.1'}};
  assert.doesNotThrow(()=>verifier.authenticate(request));
  for(const headers of [{authorization:'Bearer user-a'},{authorization:`Bearer ${SECRET}`,origin:'http://localhost'},{authorization:`Bearer ${SECRET}`,'sec-fetch-site':'same-origin'},{}])assert.throws(()=>verifier.authenticate({...request,headers}));
  assert.throws(()=>verifier.authenticate({...request,socket:{remoteAddress:'192.0.2.1',localAddress:'192.0.2.2'}}),/secure-transport/);
  assert.doesNotThrow(()=>verifier.authenticate({...request,socket:{encrypted:true}}));
});

test('the actual route fails closed for absent configuration, browser origins, user credentials, foreign events and demo identities',async t=>{
  const f=await fixture(t),packet=event();await f.onboard('user-a');const before=f.store.transaction(tx=>tx.account(A));
  for(const token of [undefined,'user-a','demo-token','wrong-service-token'])assert.equal((await f.call('/lifecycle',token,packet,{browser:false})).status,401);
  assert.equal((await f.deliver(packet,{browser:true})).status,403);
  assert.equal((await f.call('/lifecycle',SECRET,undefined,{browser:false})).status,405);
  assert.equal((await f.call('/lifecycle?subject=other',SECRET,packet,{browser:false})).status,400);
  for(const patch of [{issuer:'foreign'},{audience:'other-product'},{type:'account.disabled'},{type:'account.deletion-requested'},{type:'account.active'},{type:'account.restored'},{subjectId:'demo:adult-a'},{eventId:'not-a-uuid'},{occurredAt:'2026-10-07T03:00:00+00:00'},{version:2},{other:true}])assert.equal((await f.deliver({...packet,...patch})).status,400,JSON.stringify(patch));
  assert.deepEqual(f.store.transaction(tx=>tx.account(A)),before);assert.equal(f.store.transaction(tx=>tx.lifecycleReceipt('synk-account',packet.eventId)),undefined);
  const unconfigured=await fixture(t,{configured:false});assert.equal((await unconfigured.deliver(event())).status,503);
  const demo=await fixture(t,{mode:'demo'});assert.equal((await demo.deliver(event())).status,404);
  assert.throws(()=>createDatingService({store:demo.store,lifecycle:config}),/demo mode/);
});

test('central deletion reuses product erasure and preserves only the other person’s own private reflection',async t=>{
  const f=await fixture(t),pairId=await f.connected();await f.ok('user-a',{kind:'preferences',preferences:{'wants.contact':'daily'}});
  await f.ok('user-a',{kind:'report',targetAccountId:B,reason:'other',details:'소거할 신고 원문'});
  await f.appointment('user-a',pairId,{kind:'propose',schedule:{startsAt:'2026-10-07T03:05:00.000Z',endsAt:'2026-10-07T03:35:00.000Z',timeZone:'Asia/Seoul',place:'소거할 장소',note:'소거할 약속 원문'}});
  const appointmentId=(await f.get()).pairs[0].view.currentId;
  for(const who of ['user-a','user-b'])await f.appointment(who,pairId,{kind:'respond',appointmentId,proposalVersion:1,value:'accept'});
  f.advance(3600000);for(const who of ['user-a','user-b']){await f.appointment(who,pairId,{kind:'complete',appointmentId});await f.appointment(who,pairId,{kind:'reflect',appointmentId,value:'good',note:who==='user-a'?'소거할 본인 회고':'상대가 보존할 비공개 회고'});}
  const packet=event(),r=await f.deliver(packet);assert.deepEqual(r,{status:'deleted',ok:true,eventId:packet.eventId,subjectId:A});
  const state=f.store.transaction(tx=>({account:tx.account(A),pairs:tx.pairs(A),intros:tx.introductions(A),reports:tx.reports(null,true),alignment:tx.alignment(pairId)}));
  assert.equal(state.account.document,null);assert.equal(state.account.status,'deleted');assert.ok(state.pairs.every(pair=>pair.status==='closed'&&pair.document===null));assert.deepEqual(state.intros,[]);assert.equal(state.alignment,null);assert.ok(!JSON.stringify(state).includes('소거할'));
  const peer=await f.get('user-b');assert.equal(peer.pairs[0].view,null);assert.equal(peer.pairs[0].scheduleDraftBasis,undefined);assert.equal(peer.candidates.some(row=>row.accountId===A),false);assert.equal(peer.archivedReflections[0].note,'상대가 보존할 비공개 회고');
  assert.ok(!JSON.stringify(peer).includes('소거할'));assert.equal((await f.act('user-a',{kind:'adult',declared:true})).status,410);
});

test('exact duplicates keep response and revisions stable through restart while event ID content conflicts roll back',async t=>{
  const f=await fixture(t);await f.onboard('user-a');const packet=event(),first=await f.deliver(packet);assert.equal(first.ok,true);
  const snapshot=f.store.transaction(tx=>({account:tx.account(A),receipt:tx.lifecycleReceipt(packet.issuer,packet.eventId)}));
  assert.deepEqual(await f.deliver(packet),first);await f.restart();assert.deepEqual(await f.deliver(packet),first);
  assert.deepEqual(f.store.transaction(tx=>({account:tx.account(A),receipt:tx.lifecycleReceipt(packet.issuer,packet.eventId)})),snapshot);
  assert.equal((await f.deliver({...packet,subjectId:B})).status,409);assert.equal(f.store.transaction(tx=>tx.account(B)),null);
  const duplicateCase=await f.deliver({...packet,eventId:packet.eventId.toUpperCase(),subjectId:A.toUpperCase()});assert.deepEqual(duplicateCase,first);
  const second=event();assert.equal((await f.deliver(second)).ok,true);assert.equal(f.store.transaction(tx=>tx.account(A).revision),snapshot.account.revision);
});

test('delayed terminal deletion and unseen subjects create durable tombstones, while excessive future dates never erase',async t=>{
  const f=await fixture(t);const future=event({occurredAt:'2026-10-07T03:05:00.001Z'});assert.equal((await f.deliver(future)).status,400);assert.equal(f.store.transaction(tx=>tx.account(A)),null);
  assert.equal((await f.deliver(event({occurredAt:'2026-10-07T03:05:00.000Z'}))).ok,true);
  const delayed=event({subjectId:C,occurredAt:'2026-09-01T00:00:00.000Z'});assert.equal((await f.deliver(delayed)).ok,true);assert.equal((await f.get('user-c')).deleted,true);
  await f.restart();assert.equal((await f.get('user-c')).deleted,true);assert.equal((await f.act('user-c',{kind:'adult',declared:true})).status,410);
  assert.throws(()=>f.store.transaction(tx=>{const row=tx.account(C);tx.updateAccount(row,{profile:{}},'active');}),/account-deleted/);
});

test('receipt storage failure rolls erasure and peer archival back atomically, then the same event can retry',async t=>{
  const f=await fixture(t),pairId=await f.connected(),before=f.store.transaction(tx=>({a:tx.account(A),b:tx.account(B),pair:tx.pair(pairId),intro:tx.introduction(A,B)})),packet=event();
  f.fault(true);const failed=await f.deliver(packet);assert.equal(failed.status,500);assert.equal(f.store.transaction(tx=>tx.lifecycleReceipt(packet.issuer,packet.eventId)),undefined);
  assert.deepEqual(f.store.transaction(tx=>({a:tx.account(A),b:tx.account(B),pair:tx.pair(pairId),intro:tx.introduction(A,B)})),before);
  f.fault(false);assert.equal((await f.deliver(packet)).ok,true);assert.equal(f.store.transaction(tx=>tx.account(A).status),'deleted');
});

test('lifecycle and an ordinary stale CAS write cannot leave an active account, including a second SQLite connection',async t=>{
  const f=await fixture(t);await f.onboard('user-a');const before=await f.get(),packet=event();
  const second=createDatingStore({path:f.filename,mode:'account'});try {
  const [deleted,write]=await Promise.all([f.deliver(packet),f.call('/action','user-a',{requestId:randomUUID(),expectedRevision:before.revision,action:{kind:'profile',profile:{...before.profile,nickname:'지연된 수정'}}})]);
  assert.equal(deleted.ok,true);assert.ok([200,410].includes(write.status));assert.equal(second.transaction(tx=>tx.account(A).status),'deleted');assert.equal(second.transaction(tx=>tx.account(A).document),null);
  assert.throws(()=>second.transaction(tx=>tx.updateAccount({id:A,revision:before.revision,status:'active'},before,'active')),/revision-conflict/);
  } finally { second.close(); }
});

test('an already deleted local account stays deleted without an extra revision and deletion bypasses a full introduction log',async t=>{
  const f=await fixture(t);await f.onboard('user-a');await f.ok('user-a',{kind:'delete'});const before=f.store.transaction(tx=>tx.account(A));assert.equal((await f.deliver(event())).ok,true);assert.deepEqual(f.store.transaction(tx=>tx.account(A)),before);
  const full=await fixture(t),pairId=await full.connected();full.store.transaction(tx=>{const row=tx.introduction(A,B),state=structuredClone(row.document);
    while(state.events.length<2000){const index=state.events.length;state.events.push({kind:'close',actor:A,requestId:`full-${index}`,expectedRevision:index,at:state.events.at(-1).at});state.revision++;}
    tx.putIntroduction(A,B,state,row.revision);});
  assert.equal((await full.deliver(event())).ok,true);assert.equal(full.store.transaction(tx=>tx.pair(pairId).document),null);assert.deepEqual(full.store.transaction(tx=>tx.introductions(A)),[]);
});
