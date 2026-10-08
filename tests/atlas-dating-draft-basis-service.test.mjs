import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';

const schedule = (patch={}) => ({startsAt:'2026-10-07T03:10:00.000Z',endsAt:'2026-10-07T03:50:00.000Z',timeZone:'Asia/Seoul',place:'가상 카페',note:'',...patch});
async function fixture(t) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'synk-draft-basis-'));
  const store=createDatingStore({path:path.join(dir,'test.sqlite'),mode:'demo'});let time=Date.parse('2026-10-07T03:00:00.000Z');
  const service=createDatingService({store,clock:()=>time}),server=http.createServer((req,res)=>service.handle(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));service.close();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('synk-draft-basis-'));await fs.rm(dir,{recursive:true,force:true});});
  const call=async(route,token,json)=>{const response=await fetch(origin+'/api/atlas-dating'+route,{method:json?'POST':'GET',headers:{Origin:origin,...(token?{Authorization:`Bearer ${token}`} :{}),...(json?{'Content-Type':'application/json'}:{})},...(json?{body:JSON.stringify(json)}:{})});return{status:response.status,...await response.json()};};
  const login=async role=>(await call('/demo/session',null,{role})).token;
  const get=async token=>{const r=await call('/state',token);assert.equal(r.status,200);return r.view;};
  const act=async(token,action,extra={})=>call('/action',token,{requestId:randomUUID(),expectedRevision:(await get(token)).revision,action,...extra});
  const ok=async(token,action)=>{const r=await act(token,action);assert.equal(r.status,200,JSON.stringify(r));return r;};
  const a=await login('sample-3'),b=await login('sample-1'),outsider=await login('sample-2');
  for(const [field,value] of Object.entries({consent:true,availability:'weekend'}))await ok(a,{kind:'discovery',action:{kind:'set',field,value}});
  const connected=await ok(a,{kind:'connect',targetAccountId:'demo:sample-1'}),pairId=connected.result.pairId;
  const pair=async token=>(await get(token)).pairs.find(item=>item.pairId===pairId);
  const intro=async(token,action)=>ok(token,{kind:'introduction',pairId,expectedIntroductionRevision:(await pair(token)).introduction.revision,action});
  await intro(b,{kind:'respond',introductionId:connected.result.introductionId,value:'accept'});
  const appointment=async(token,action)=>ok(token,{kind:'appointment',pairId,expectedPairRevision:(await pair(token)).revision,action});
  const basis=async token=>(await pair(token)).scheduleDraftBasis;
  const complete=async()=>{await appointment(a,{kind:'propose',schedule:schedule()});const id=(await pair(a)).view.currentId;
    for(const person of [a,b])await appointment(person,{kind:'respond',appointmentId:id,proposalVersion:1,value:'accept'});
    time+=2*3600000;for(const person of [a,b])await appointment(person,{kind:'complete',appointmentId:id});return id;};
  return{a,b,outsider,pairId,store,call,get,act,ok,pair,intro,appointment,basis,complete,advance:ms=>{time+=ms;}};
}

test('authorized actor-specific opaque draft guards stay stable across reads, notification settings and private goals',async t=>{
  const f=await fixture(t),initial=await f.basis(f.a);assert.match(initial,/^[a-f0-9]{64}$/);assert.notEqual(initial,await f.basis(f.b));
  for(let i=0;i<3;i++){f.advance(100);assert.equal(await f.basis(f.a),initial);}
  await f.appointment(f.a,{kind:'notifications',enabled:false});assert.equal(await f.basis(f.a),initial);
  await f.ok(f.a,{kind:'experience',action:{kind:'goal',value:'comfortable'}});assert.equal(await f.basis(f.a),initial);
  await f.ok(f.b,{kind:'experience',action:{kind:'goal',value:'pace'}});assert.equal(await f.basis(f.a),initial);
  await f.appointment(f.a,{kind:'propose',schedule:schedule()});const proposed=await f.basis(f.a),peerBasis=await f.basis(f.b),notice=(await f.pair(f.b)).view.inbox[0];
  await f.appointment(f.b,{kind:'read',notificationId:notice.id});assert.equal(await f.basis(f.a),proposed);assert.equal(await f.basis(f.b),peerBasis);
  const projected=await f.pair(f.a);for(const key of ['ownerGeneration','partnerGeneration','scheduleEvents','actor'])assert.equal(projected[key],undefined);
  assert.equal((await f.get(f.a)).allowanceGeneration,undefined);assert.equal((await f.get(f.a)).alignmentGeneration,undefined);
});

test('public proposal and response lineage changes the guard without replacing existing pair CAS checks',async t=>{
  const f=await fixture(t);let previous=await f.basis(f.a);await f.appointment(f.a,{kind:'propose',schedule:schedule()});const id=(await f.pair(f.a)).view.currentId;
  assert.notEqual(await f.basis(f.a),previous);previous=await f.basis(f.a);
  await f.appointment(f.a,{kind:'revise',appointmentId:id,schedule:schedule({place:'다른 가상 카페'})});assert.notEqual(await f.basis(f.a),previous);previous=await f.basis(f.a);
  await f.appointment(f.b,{kind:'respond',appointmentId:id,proposalVersion:2,value:'accept'});assert.notEqual(await f.basis(f.a),previous);
  const stale=await f.act(f.a,{kind:'appointment',pairId:f.pairId,expectedPairRevision:0,action:{kind:'cancel',appointmentId:id}});assert.equal(stale.status,409);assert.equal(stale.error.code,'pair-revision-conflict');
  previous=await f.basis(f.a);await f.appointment(f.a,{kind:'cancel',appointmentId:id});assert.notEqual(await f.basis(f.a),previous);
});

test('public completion changes the guard; counterpart private reflection and form hints do not alter mine',async t=>{
  const f=await fixture(t),before=await f.basis(f.a),id=await f.complete();const finished=await f.basis(f.a);assert.notEqual(finished,before);
  await f.appointment(f.b,{kind:'reflect',appointmentId:id,value:'too-long',note:'상대에게 공개하지 않는 회고'});assert.equal(await f.basis(f.a),finished);
  const peerSuggestion=(await f.pair(f.b)).view.me.suggestions[0];await f.appointment(f.b,{kind:'apply-suggestion',suggestionId:peerSuggestion.id,suggestionRevision:peerSuggestion.revision});assert.equal(await f.basis(f.a),finished);
  await f.appointment(f.a,{kind:'reflect',appointmentId:id,value:'too-long',note:'나의 회고'});assert.equal(await f.basis(f.a),finished);
  const ownSuggestion=(await f.pair(f.a)).view.me.suggestions[0];await f.appointment(f.a,{kind:'apply-suggestion',suggestionId:ownSuggestion.id,suggestionRevision:ownSuggestion.revision});assert.notEqual(await f.basis(f.a),finished);
  assert.equal(JSON.stringify(await f.pair(f.a)).includes('상대에게 공개하지 않는 회고'),false);
});

test('pause and own storage withdrawal round trips between reads cannot revive an old draft guard',async t=>{
  const f=await fixture(t);let before=await f.basis(f.a);
  await f.ok(f.a,{kind:'pause',paused:true});await f.ok(f.a,{kind:'pause',paused:false});assert.notEqual(await f.basis(f.a),before);before=await f.basis(f.a);
  await f.ok(f.b,{kind:'pause',paused:true});await f.ok(f.b,{kind:'pause',paused:false});assert.notEqual(await f.basis(f.a),before);before=await f.basis(f.a);
  const own=(await f.get(f.a)).consents;await f.ok(f.a,{kind:'consents',consents:{...own,storePreferences:false}});await f.ok(f.a,{kind:'consents',consents:own});assert.notEqual(await f.basis(f.a),before);
  before=await f.basis(f.a);const peer=(await f.get(f.b)).consents;await f.ok(f.b,{kind:'consents',consents:{...peer,storePreferences:false}});await f.ok(f.b,{kind:'consents',consents:peer});assert.equal(await f.basis(f.a),before);
});

test('public availability and introduction withdrawal change the guard; another actor has no pair or guard',async t=>{
  const f=await fixture(t),before=await f.basis(f.a),peer=(await f.get(f.b)).profile;
  await f.ok(f.b,{kind:'profile',profile:{...peer,values:{...peer.values,availability:'weekday'}}});assert.notEqual(await f.basis(f.a),before);
  const changed=await f.basis(f.a),pair=await f.pair(f.a);await f.intro(f.a,{kind:'withdraw',introductionId:pair.introduction.current.id});
  const withdrawn=await f.pair(f.a);assert.equal(withdrawn.introduction.accepted,false);assert.equal(withdrawn.view.canPropose,false);assert.notEqual(withdrawn.scheduleDraftBasis,changed);
  const outsider=await f.get(f.outsider);assert.equal(outsider.pairs.some(item=>item.pairId===f.pairId),false);assert.equal(JSON.stringify(outsider).includes(changed),false);
});

test('public withdrawal closes the pair and neither restoring disclosure nor missing legacy counters leaks a guard',async t=>{
  const f=await fixture(t),first=await f.basis(f.a);
  f.store.transaction(tx=>{for(const id of ['demo:sample-3','demo:sample-1']){const row=tx.account(id),doc={...row.document};delete doc.allowanceGeneration;delete doc.alignmentGeneration;tx.updateAccount(row,doc);}});
  assert.match(await f.basis(f.a),/^[a-f0-9]{64}$/);
  const consents=(await f.get(f.a)).consents;await f.ok(f.a,{kind:'consents',consents:{...consents,profilePublic:false}});
  assert.equal((await f.pair(f.a)).scheduleDraftBasis,undefined);assert.equal((await f.pair(f.b)).scheduleDraftBasis,undefined);
  await f.ok(f.a,{kind:'consents',consents});const closed=await f.pair(f.a);assert.equal(closed.status,'closed');assert.equal(closed.scheduleDraftBasis,undefined);assert.equal(JSON.stringify(closed).includes(first),false);
});
