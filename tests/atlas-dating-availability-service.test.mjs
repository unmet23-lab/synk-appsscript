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

const A='20000000-0000-4000-8000-000000000001', B='20000000-0000-4000-8000-000000000002', C='20000000-0000-4000-8000-000000000003';
const SECRET='local-availability-fixture-only-secret-00001', START='2026-10-07T03:00:00.000Z';
const config={token:SECRET,issuer:'synk-account',audience:'atlas-dating'};
const event=(status='deletion-requested',sequence=1,patch={})=>({version:2,type:'account.availability',eventId:randomUUID(),subjectId:A,occurredAt:START,issuer:'synk-account',audience:'atlas-dating',status,sequence,...patch});
const deletion=(patch={})=>({version:1,type:'account.deleted',eventId:randomUUID(),subjectId:A,occurredAt:START,issuer:'synk-account',audience:'atlas-dating',...patch});
const consents={profilePublic:true,receiveInvitations:true,storePreferences:true};
async function fixture(t) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'synk-availability-')),filename=path.join(dir,'account.sqlite');
  let store,service,server,origin,failReceipt=false,pauseVerify=null,time=Date.parse(START);
  const verify=async token=>{if(pauseVerify?.token===token){const pause=pauseVerify;pauseVerify=null;pause.entered();await pause.release;}return{accountId:{a:A,b:B,c:C}[token]};};
  const start=async()=>{store=createDatingStore({path:filename,mode:'account'});
    const wrapped={mode:'account',close:()=>store.close(),transaction:fn=>store.transaction(tx=>fn({...tx,putLifecycleReceipt(...args){if(failReceipt)throw Error('fixture receipt unavailable');return tx.putLifecycleReceipt(...args);}}))};
    service=createDatingService({store:wrapped,mode:'account',verify,operatorIds:[C],lifecycle:config,clock:()=>time});
    server=http.createServer((req,res)=>service.handle(req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;};
  const close=async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));service.close();};await start();
  t.after(async()=>{await close();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('synk-availability-'));await fs.rm(dir,{recursive:true,force:true});});
  const call=async(route,token,body,{browser=true}={})=>{const response=await fetch(origin+'/api/atlas-dating'+route,{method:body===undefined?'GET':'POST',headers:{...(browser?{Origin:origin}:{}),...(token?{Authorization:`Bearer ${token}`} :{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return{httpStatus:response.status,...await response.json()};};
  const get=async(token='a')=>{const r=await call('/state',token);assert.equal(r.httpStatus,200,JSON.stringify(r));return r.view;};
  const envelope=async(token,action)=>({requestId:randomUUID(),expectedRevision:(await get(token)).revision,action});
  const act=async(token,action)=>call('/action',token,await envelope(token,action));
  const ok=async(token,action)=>{const r=await act(token,action);assert.equal(r.httpStatus,200,JSON.stringify(r));return r;};
  const deliver=packet=>call('/lifecycle',SECRET,packet,{browser:false});
  const onboard=async token=>{await ok(token,{kind:'profile',profile:{nickname:'가상 '+token,region:'가상 지역',intro:'original-private-sentinel',values:{availability:'weekend','self.pace':'lead','self.plan':'planned'},required:[]}});await ok(token,{kind:'adult',declared:true});await ok(token,{kind:'consents',consents});};
  const connected=async()=>{await onboard('a');await onboard('b');for(const [field,value]of Object.entries({consent:true,availability:'weekend'}))await ok('a',{kind:'discovery',action:{kind:'set',field,value}});
    const sent=await ok('a',{kind:'connect',targetAccountId:B}),pairId=sent.result.pairId,p=(await get('b')).pairs.find(row=>row.pairId===pairId);
    await ok('b',{kind:'introduction',pairId,expectedIntroductionRevision:p.introduction.revision,action:{kind:'respond',introductionId:sent.result.introductionId,value:'accept'}});return pairId;};
  const intro=async(token,pairId,action)=>{const p=(await get(token)).pairs.find(row=>row.pairId===pairId);return ok(token,{kind:'introduction',pairId,expectedIntroductionRevision:p.introduction.revision,action});};
  const appointment=async(token,pairId,action)=>{const p=(await get(token)).pairs.find(row=>row.pairId===pairId);return ok(token,{kind:'appointment',pairId,expectedPairRevision:p.revision,action});};
  return{call,get,envelope,act,ok,deliver,onboard,connected,intro,appointment,get store(){return store;},
    fault:value=>{failReceipt=value;},advance:ms=>{time+=ms;},restart:async()=>{await close();await start();},
    pause(token){let entered,release;const started=new Promise(resolve=>{entered=resolve;}),waiting=new Promise(resolve=>{release=resolve;});pauseVerify={token,entered,release:waiting};return{started,release};}};
}
const state=f=>f.store.transaction(tx=>({account:tx.account(A),availability:tx.centralAvailability(A),pairs:tx.pairs(A),intros:tx.introductions(A),archived:tx.archivedIntroductions(A)}));

test('availability uses exactly the authenticated v2 nine-field contract and preserves v1 deletion',()=>{
  const verifier=createDatingLifecycleVerifier(config);for(const status of ['active','deletion-requested','disabled'])assert.equal(verifier.event(event(status,1),START).status,status);
  assert.equal(verifier.event(deletion(),START).type,'account.deleted');
  for(const patch of [{sequence:0},{sequence:-1},{sequence:1.1},{sequence:Number.MAX_SAFE_INTEGER+1},{status:'deleted'},{status:'suspended'},{version:1},{type:'account.disabled'},{extra:true},{occurredAt:'2026-10-07T03:06:00.000Z'}])assert.throws(()=>verifier.event(event('active',1,patch),START));
  const missing=event();delete missing.status;assert.throws(()=>verifier.event(missing,START));
});

test('a central request hides an inactive owner from a peer without owner reconnection and preserves own records',async t=>{
  const f=await fixture(t),pairId=await f.connected();await f.ok('a',{kind:'preferences',preferences:{'wants.contact':'daily'}});
  const before=state(f),packet=event();const ack=await f.deliver(packet);assert.equal(ack.status,'applied');assert.equal(ack.sequence,1);
  const after=state(f);assert.equal(after.account.status,'active');assert.deepEqual(after.account.document.preferences,before.account.document.preferences);
  assert.deepEqual(after.account.document.discovery,before.account.document.discovery);assert.deepEqual(after.account.document.experience,before.account.document.experience);
  assert.equal(after.account.document.consents.storePreferences,true);assert.equal(after.account.document.consents.profilePublic,false);assert.equal(after.account.document.consents.receiveInvitations,false);
  assert.deepEqual(after.pairs[0].document,before.pairs[0].document);assert.equal(after.pairs[0].status,'closed');assert.deepEqual(after.archived[0].document,before.intros[0].document);
  const peer=await f.get('b');assert.equal(peer.candidates.some(p=>p.accountId===A),false);assert.equal(peer.pairs.find(p=>p.pairId===pairId).view,null);
  const own=await f.get();assert.equal(own.centralAvailability.status,'deletion-requested');assert.equal(own.centralAvailability.canResume,false);assert.doesNotMatch(JSON.stringify(own),/original-private-sentinel/);
  assert.equal(own.profile,undefined);assert.equal(own.experience,undefined);
  assert.equal((await f.act('a',{kind:'consents',consents})).httpStatus,403);
});

test('cancellation permits explicit consent resume and a new introduction, never an old appointment or acceptance',async t=>{
  const f=await fixture(t),pairId=await f.connected();await f.appointment('a',pairId,{kind:'propose',schedule:{startsAt:'2026-10-07T04:00:00.000Z',endsAt:'2026-10-07T04:30:00.000Z',timeZone:'Asia/Seoul',place:'가상 장소',note:'과거 제안'}});
  const appointmentId=(await f.get()).pairs[0].view.currentId;for(const who of ['a','b'])await f.appointment(who,pairId,{kind:'respond',appointmentId,proposalVersion:1,value:'accept'});
  await f.deliver(event('deletion-requested',1));await f.deliver(event('active',2));let owner=await f.get();
  assert.equal(owner.centralAvailability.resumeRequired,true);assert.equal(owner.centralAvailability.canResume,true);assert.equal(owner.consents.storePreferences,true);
  assert.equal(owner.consents.profilePublic,false);assert.equal(owner.pairs[0].view,null);assert.equal((await f.get('b')).candidates.some(p=>p.accountId===A),false);
  const held=state(f);await f.ok('a',{kind:'consents',consents});owner=await f.get();assert.equal(owner.centralAvailability.resumeRequired,false);
  assert.equal(owner.pairs[0].view,null);assert.equal(owner.pairs[0].introduction.accepted,false);assert.equal((await f.get('b')).candidates.some(p=>p.accountId===A),true);
  assert.equal((await f.act('a',{kind:'appointment',pairId,expectedPairRevision:held.pairs[0].revision,action:{kind:'respond',appointmentId,proposalVersion:1,value:'accept'}})).httpStatus,410);
  await f.intro('a',pairId,{kind:'reopen'});const sent=await f.ok('a',{kind:'connect',targetAccountId:B});
  assert.notEqual(sent.result.pairId,pairId);const fresh=(await f.get()).pairs.find(p=>p.pairId===sent.result.pairId);assert.equal(fresh.introduction.accepted,false);assert.deepEqual(fresh.view.appointments,[]);
  await f.intro('b',fresh.pairId,{kind:'respond',introductionId:sent.result.introductionId,value:'accept'});
  assert.equal((await f.get()).pairs.find(p=>p.pairId===fresh.pairId).introduction.accepted,true);assert.equal(state(f).pairs.find(p=>p.id===pairId).status,'closed');
});

test('duplicates survive restart, older states are ignored and a sequence cannot represent two statuses',async t=>{
  const f=await fixture(t);await f.onboard('a');const hold=event('disabled',2),first=await f.deliver(hold),snapshot=state(f);
  assert.deepEqual(await f.deliver(hold),first);await f.restart();assert.deepEqual(await f.deliver(hold),first);assert.deepEqual(state(f),snapshot);
  assert.equal((await f.deliver(event('active',1))).status,'ignored');assert.equal(state(f).availability.status,'disabled');
  assert.equal((await f.deliver(event('deletion-requested',2))).httpStatus,409);assert.equal((await f.deliver(event('disabled',2))).status,'ignored');
  assert.equal((await f.deliver({...hold,status:'active'})).httpStatus,409);
  assert.equal((await f.deliver(event('disabled',1))).httpStatus,409);assert.equal(state(f).availability.status,'disabled');
});

test('active-first reordering conservatively requires resume while the baseline active one preserves healthy consent',async t=>{
  const f=await fixture(t);await f.onboard('a');await f.deliver(event('active',1));assert.equal((await f.get()).consents.profilePublic,true);
  assert.equal((await f.get()).centralAvailability.resumeRequired,false);await f.deliver(event('active',3));
  assert.equal((await f.get()).consents.profilePublic,false);assert.equal((await f.get()).centralAvailability.resumeRequired,true);
  assert.equal((await f.deliver(event('disabled',2))).status,'ignored');assert.equal(state(f).availability.status,'active');
  const g=await fixture(t);await g.onboard('a');await g.deliver(event('active',2));assert.equal((await g.get()).consents.profilePublic,false);
});

test('availability received before the product account exists stays fenced through creation and restart',async t=>{
  const f=await fixture(t);await f.deliver(event('disabled',1));assert.equal(state(f).account,null);await f.restart();
  const own=await f.get();assert.equal(own.centralAvailability.status,'disabled');assert.equal(own.profile,undefined);assert.equal((await f.act('a',{kind:'adult',declared:true})).httpStatus,403);
  await f.deliver(event('active',2));assert.equal((await f.get()).consents.profilePublic,false);assert.equal((await f.get()).centralAvailability.resumeRequired,true);
  assert.equal((await f.deliver(event('disabled',1))).status,'ignored');await f.onboard('a');assert.equal((await f.get()).centralAvailability.resumeRequired,false);
});

test('central release cannot clear a local suspension or silently reactivate consent set under suspension',async t=>{
  const f=await fixture(t);await f.onboard('a');await f.onboard('b');const report=await f.ok('b',{kind:'report',targetAccountId:A,reason:'other',details:'가상 보고'});
  await f.ok('c',{kind:'admin-report',reportId:report.result.reportId,status:'reviewing',decision:'suspend-target',note:'가상 처리'});
  await f.deliver(event('disabled',1));await f.deliver(event('active',2));let own=await f.get();assert.equal(own.status,'suspended');assert.equal(own.centralAvailability.canResume,false);
  await f.ok('a',{kind:'consents',consents});assert.equal((await f.get()).centralAvailability.resumeRequired,true);
  await f.ok('c',{kind:'admin-report',reportId:report.result.reportId,status:'resolved',decision:'restore-target',note:'가상 해제'});
  own=await f.get();assert.equal(own.status,'active');assert.equal((await f.get('b')).candidates.some(p=>p.accountId===A),false);
  await f.ok('a',{kind:'consents',consents});assert.equal((await f.get('b')).candidates.some(p=>p.accountId===A),true);
});

test('terminal v1 deletion dominates every later availability event and removes preserved invitation archives',async t=>{
  const f=await fixture(t);await f.connected();await f.deliver(event());assert.equal(state(f).archived.length,1);const final=deletion(),ack=await f.deliver(final);
  assert.equal(ack.status,'deleted');assert.equal(state(f).archived.length,0);const snapshot=state(f);assert.equal((await f.deliver(event('active',999))).status,'ignored');
  assert.deepEqual(state(f),snapshot);await f.restart();assert.deepEqual(await f.deliver(final),ack);assert.equal((await f.get()).deleted,true);
  const unknown=await fixture(t);await unknown.deliver(deletion());await unknown.deliver(event('active',2));assert.equal((await unknown.get()).deleted,true);
});

test('receipt replay returns only the current restricted view; late verified GET reads current gates',async t=>{
  const f=await fixture(t);await f.connected();const body=await f.envelope('a',{kind:'preferences',preferences:{'wants.notice':'advance'}});await f.call('/action','a',body);
  const pause=f.pause('b'),pending=f.call('/state','b');await pause.started;await f.deliver(event());pause.release();const peer=(await pending).view;
  assert.equal(peer.candidates.some(p=>p.accountId===A),false);const replay=await f.call('/action','a',body);assert.equal(replay.httpStatus,200);assert.equal(replay.replayed,true);assert.equal(replay.view.profile,undefined);
  assert.equal((await f.call(`/receipt?requestId=${body.requestId}`,'a')).httpStatus,403);assert.equal((await f.call('/preview','a',{expectedRevision:replay.view.revision,action:{kind:'set',field:'wants.notice',value:'advance'}})).httpStatus,403);
  assert.equal((await f.call('/action','a',{...body,requestId:randomUUID()})).httpStatus,403);
});

test('a missing lifecycle receipt rolls the gate, original history and consent changes back as one transaction',async t=>{
  const f=await fixture(t);await f.connected();const before=state(f),packet=event();f.fault(true);assert.equal((await f.deliver(packet)).httpStatus,500);
  assert.deepEqual(state(f),before);assert.equal(f.store.transaction(tx=>tx.availabilitySequence(A,1)),undefined);f.fault(false);assert.equal((await f.deliver(packet)).status,'applied');
});

test('a full introduction history cannot prevent availability enforcement or erase the original',async t=>{
  const f=await fixture(t),pairId=await f.connected();f.store.transaction(tx=>{const old=tx.introduction(A,B),document=structuredClone(old.document);
    while(document.events.length<2000){const count=document.events.length;document.events.push({kind:'close',actor:A,requestId:`full-${count}`,expectedRevision:count,at:document.events.at(-1).at});document.revision++;}tx.putIntroduction(A,B,document,old.revision);});
  const original=state(f).intros[0].document;assert.equal((await f.deliver(event())).status,'applied');assert.deepEqual(state(f).archived[0].document,original);
  assert.equal(state(f).pairs.find(p=>p.id===pairId).status,'closed');assert.ok(state(f).intros[0].document.events.length<=2);
});

test('completed appointment facts and both private reflections survive a temporary central hold',async t=>{
  const f=await fixture(t),pairId=await f.connected();await f.appointment('a',pairId,{kind:'propose',schedule:{startsAt:'2026-10-07T03:05:00.000Z',endsAt:'2026-10-07T03:35:00.000Z',timeZone:'Asia/Seoul',place:'가상 완료 장소',note:''}});
  const appointmentId=(await f.get()).pairs[0].view.currentId;for(const who of ['a','b'])await f.appointment(who,pairId,{kind:'respond',appointmentId,proposalVersion:1,value:'accept'});
  f.advance(3600000);for(const who of ['a','b']){await f.appointment(who,pairId,{kind:'complete',appointmentId});await f.appointment(who,pairId,{kind:'reflect',appointmentId,value:'good',note:`가상 ${who} 비공개 회고`});}
  const original=state(f).pairs[0].document;await f.deliver(event('disabled',1));assert.deepEqual(state(f).pairs[0].document,original);
  assert.equal((await f.get('b')).archivedReflections[0].note,'가상 b 비공개 회고');await f.deliver(event('active',2));assert.equal((await f.get()).archivedReflections[0].note,'가상 a 비공개 회고');
});

test('a peer reopen prepared before retirement cannot match a reused introduction revision after central resume',async t=>{
  const f=await fixture(t);await f.onboard('a');await f.onboard('b');
  for(const [field,value]of Object.entries({consent:true,availability:'weekend'}))await f.ok('a',{kind:'discovery',action:{kind:'set',field,value}});
  const sent=await f.ok('a',{kind:'connect',targetAccountId:B}),pairId=sent.result.pairId;
  await f.intro('b',pairId,{kind:'respond',introductionId:sent.result.introductionId,value:'decline'});
  const before=await f.get('b'),oldIntro=before.pairs.find(row=>row.pairId===pairId).introduction;
  assert.equal(oldIntro.canReopen,true);assert.equal(oldIntro.revision,2);
  const stale=await f.envelope('b',{kind:'introduction',pairId,expectedIntroductionRevision:oldIntro.revision,action:{kind:'reopen'}});
  await f.deliver(event('disabled',1));await f.deliver(event('active',2));await f.ok('a',{kind:'consents',consents});
  const current=await f.get('b');assert.equal(current.revision,before.revision);
  const rejected=await f.call('/action','b',stale);assert.equal(rejected.httpStatus,409,JSON.stringify(rejected));
  assert.equal(rejected.error.code,'introduction-revision-conflict');
  const next=current.pairs.find(row=>row.pairId===pairId).introduction;
  assert.ok(next.revision>oldIntro.revision);assert.equal(next.canReopen,true);
  const retained=state(f);assert.equal(retained.intros[0].document.revision,2);assert.equal(retained.intros[0].document.events.length,2);
  assert.deepEqual(retained.archived[0].document.events.map(row=>row.kind),['send','respond']);
  await f.restart();assert.equal((await f.get('b')).pairs.find(row=>row.pairId===pairId).introduction.revision,next.revision);
  await f.intro('b',pairId,{kind:'reopen'});assert.ok((await f.get('b')).pairs.find(row=>row.pairId===pairId).introduction.revision>next.revision);
  const after=state(f);assert.equal(after.intros[0].document.revision,3);assert.equal(after.intros[0].document.events.length,3);
});
