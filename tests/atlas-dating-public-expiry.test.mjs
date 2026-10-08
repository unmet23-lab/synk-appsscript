import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizePublicExpirations, projectPublicAnswers } from '../experiences/atlas-lab/public-profile.mjs';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';

const START='2026-10-10T03:00:00.000Z',END='2026-10-10T03:01:00.000Z',LATER='2026-10-10T03:02:00.000Z';
const profile=(values,required=[],expirations)=>({nickname:'가상 공개기한',region:'자유 소개지역',intro:'합성 소개',values,required,...(expirations?{expirations}:{})});
const normalization=(input,extra={})=>normalizePublicExpirations(input,{values:{'self.contact':'daily'},at:START,...extra});

test('public deadlines are independent and omitted keys preserve an already-ended saved deadline',()=>{
  const args={values:{'self.contact':'daily','self.plan':'planned'},previousValues:{'self.contact':'daily','self.plan':'planned'},previousExpirations:{'self.contact':END,'self.plan':LATER},at:LATER};
  assert.deepEqual(normalizePublicExpirations(undefined,args),args.previousExpirations);
  assert.deepEqual(normalizePublicExpirations({'self.plan':null},args),{'self.contact':END,'self.plan':null});
});
test('an unchanged past deadline round-trips only its exact unchanged saved answer',()=>{
  const extra={previousValues:{'self.contact':'daily'},previousExpirations:{'self.contact':END},at:LATER};
  assert.deepEqual(normalization({'self.contact':END},extra),{'self.contact':END});
  assert.throws(()=>normalization({'self.contact':END},{...extra,values:{'self.contact':'few-days'}}),/Public profile/);
  assert.throws(()=>normalization({'self.contact':START},extra),/Public profile/);
});
test('changing a saved answer while omitting deadlines cannot resurrect its expired publication',()=>{
  const map=normalization(undefined,{values:{'self.contact':'few-days'},previousValues:{'self.contact':'daily'},previousExpirations:{'self.contact':END},at:LATER});
  assert.deepEqual(projectPublicAnswers(profile({'self.contact':'few-days'},[],map),LATER),{values:{},required:[],expiredFields:['self.contact']});
});
test('only explicit null clears a public deadline and a new deadline must be canonical and future',()=>{
  assert.deepEqual(normalization({'self.contact':null},{previousExpirations:{'self.contact':END},at:LATER}),{'self.contact':null});
  for(const value of[undefined,'','2026-10-10T03:01:00Z','2026-10-10T12:01:00+09:00',START,12,false])assert.throws(()=>normalization({'self.contact':value}),/Public profile/);
  assert.deepEqual(normalization({'self.contact':END}),{'self.contact':END});
});
test('orphan deadline keys and executable expiration getters are rejected',()=>{
  assert.throws(()=>normalization({'self.plan':END}),/Public profile/);
  const input={};Object.defineProperty(input,'self.contact',{get(){throw new Error('must not run');},enumerable:true});assert.throws(()=>normalization(input),/Public profile/);
});
test('the exact public deadline removes only the current value and retains its required guard and raw owner record',()=>{
  const source=profile({'wants.contact':'daily','self.plan':'planned'},['wants.contact'],{'wants.contact':END});const before=structuredClone(source);
  assert.deepEqual(projectPublicAnswers(source,START),{values:{'wants.contact':'daily','self.plan':'planned'},required:['wants.contact'],expiredFields:[]});
  const expired=projectPublicAnswers(source,END);assert.deepEqual(expired,{values:{'self.plan':'planned'},required:['wants.contact'],expiredFields:['wants.contact']});expired.required.length=0;assert.deepEqual(source,before);
});
test('a projected meeting-region array is an independent copy and malformed stored deadlines fail closed',()=>{
  const source=profile({'self.meetingRegions':['seoul-center']});const projected=projectPublicAnswers(source,START);projected.values['self.meetingRegions'].push('busan');assert.deepEqual(source.values['self.meetingRegions'],['seoul-center']);
  assert.throws(()=>projectPublicAnswers(profile({'self.contact':'daily'},[],{'self.contact':'bad'}),START),/Public profile/);
});

const ids=['public-expiry:a','public-expiry:b'];
async function fixture(t){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'synk-public-expiry-'));let time=Date.parse(START);
  const server=createDatingServer({mode:'account',databasePath:path.join(dir,'account.sqlite'),verify:async accountId=>ids.includes(accountId)?{accountId}:null,clock:()=>new Date(time)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('synk-public-expiry-'));await fs.rm(dir,{recursive:true,force:true});});
  const call=async(route,index,json)=>{const response=await fetch(origin+'/api/atlas-dating'+route,{method:json?'POST':'GET',headers:{Authorization:`Bearer ${ids[index]}`,...(json?{Origin:origin,'Content-Type':'application/json'}:{})},...(json?{body:JSON.stringify(json)}:{})});return{status:response.status,body:await response.json()};};
  const state=async index=>{const r=await call('/state',index);assert.equal(r.status,200,JSON.stringify(r.body));return r.body.view;};
  const rawAction=async(index,action)=>call('/action',index,{requestId:randomUUID(),expectedRevision:(await state(index)).revision,action});
  const action=async(index,event)=>{const r=await rawAction(index,event);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
  const update=async(index,patch)=>action(index,{kind:'profile',profile:{...(await state(index)).profile,...patch}});
  async function seed(index,{values={},required=[],expirations,answers={}}={}){
    await action(index,{kind:'profile',profile:profile({availability:'weekend',...values},required,expirations)});await action(index,{kind:'adult',declared:true});await action(index,{kind:'consents',consents:{profilePublic:true,receiveInvitations:true,storePreferences:true}});
    for(const[field,value]of Object.entries({consent:true,availability:'weekend',...answers}))await action(index,{kind:'discovery',action:{kind:'set',field,value}});
  }
  const candidate=async index=>(await state(index)).discovery.candidates.find(c=>c.id===ids[1-index]);
  const pending=async()=>{const sent=await action(0,{kind:'connect',targetAccountId:ids[1]});return{pairId:sent.result.pairId,introductionId:sent.result.introductionId};};
  const respond=async(index,request,value)=>{const current=await state(index),pair=current.pairs.find(p=>p.pairId===request.pairId);return rawAction(index,{kind:'introduction',pairId:request.pairId,expectedIntroductionRevision:pair.introduction.revision,action:{kind:'respond',introductionId:request.introductionId,value}});};
  const accepted=async()=>{const sent=await pending(),r=await respond(1,sent,'accept');assert.equal(r.status,200,JSON.stringify(r.body));return sent;};
  const appointment=async(index,pairId,event)=>{const current=await state(index),pair=current.pairs.find(p=>p.pairId===pairId);return action(index,{kind:'appointment',pairId,expectedPairRevision:pair.view.revision,action:event});};
  return{call,state,rawAction,action,update,seed,candidate,pending,respond,accepted,appointment,advance:ms=>{time+=ms;}};
}

test('HTTP expired public self answers leave owner raw and private answers intact while peer comparison sees no old value',async t=>{
  const f=await fixture(t);await f.seed(0,{answers:{'wants.contact':'daily'}});await f.seed(1,{values:{'self.contact':'daily'},expirations:{'self.contact':END},answers:{'self.contact':'few-days'}});assert.equal((await f.candidate(0)).reasonDetails.find(d=>d.field==='wants.contact'&&d.owner==='self').comparison,'match');f.advance(60000);const own=await f.state(1),peer=await f.state(0);assert.equal(own.profile.values['self.contact'],'daily');assert.equal(own.discovery.fields.find(field=>field.id==='self.contact').value,'few-days');assert.equal(own.publicAnswers.values['self.contact'],undefined);assert.deepEqual(own.publicAnswers.expiredFields,['self.contact']);assert.equal(peer.candidates[0].values['self.contact'],undefined);assert.equal(peer.candidates[0].expirations,undefined);assert.equal(peer.discovery.candidates[0].reasonDetails.find(d=>d.field==='wants.contact'&&d.owner==='self').comparison,'unknown');
});
test('HTTP expired required public wants remains a pending mandatory guard, including formerly any',async t=>{
  for(const value of['daily','any']){const f=await fixture(t);await f.seed(0,{answers:{'self.contact':'daily'}});await f.seed(1,{values:{'wants.contact':value},required:['wants.contact'],expirations:{'wants.contact':END}});assert.equal((await f.candidate(0)).status,'eligible');f.advance(60000);const own=await f.state(1),candidate=await f.candidate(0);assert.deepEqual(own.profile.required,['wants.contact']);assert.deepEqual(own.publicAnswers.required,['wants.contact']);assert.equal(candidate.status,'pending');assert.equal(candidate.canConnect,false);assert.equal((await f.rawAction(0,{kind:'connect',targetAccountId:ids[1]})).status,403);}
});
test('HTTP old clients and unchanged past deadline round-trips cannot revive a saved expired public answer',async t=>{
  const f=await fixture(t);await f.seed(0);await f.seed(1,{values:{'self.contact':'daily'},expirations:{'self.contact':END}});f.advance(60000);let source=(await f.state(1)).profile;const {expirations:_omitted,...oldClient}=source;await f.action(1,{kind:'profile',profile:{...oldClient,intro:'구형 클라이언트 소개만 바꿈'}});let current=await f.state(1);assert.equal(current.profile.expirations['self.contact'],END);assert.equal(current.publicAnswers.values['self.contact'],undefined);await f.update(1,{intro:'현재 클라이언트 만료기한 그대로'});current=await f.state(1);assert.equal(current.publicAnswers.values['self.contact'],undefined);const invalid=await f.rawAction(1,{kind:'profile',profile:{...current.profile,values:{...current.profile.values,'self.contact':'few-days'}}});assert.equal(invalid.status,400);await f.update(1,{expirations:{'self.contact':null}});assert.equal((await f.state(1)).publicAnswers.values['self.contact'],'daily');
});
test('HTTP invalid expiry inputs reject atomically without changing profile or private state',async t=>{
  const f=await fixture(t);await f.seed(0,{values:{'self.contact':'daily'}});const before=await f.state(0);for(const expirations of[{'self.contact':START},{'self.contact':'2026-10-10T03:01:00Z'},{'self.contact':false},{'self.plan':END},{'unknown':END}]){const r=await f.rawAction(0,{kind:'profile',profile:{...before.profile,expirations}});assert.equal(r.status,400);assert.deepEqual((await f.state(0)).profile,before.profile);assert.deepEqual((await f.state(0)).discovery.fields,before.discovery.fields);}
});
test('HTTP baseline publication preserves an independent public deadline and never copies the private answer deadline',async t=>{
  const f=await fixture(t);await f.seed(0,{values:{'self.contact':'daily'},expirations:{'self.contact':END},answers:{'self.contact':'few-days','self.plan':'planned'}});await f.action(0,{kind:'discovery',action:{kind:'set',field:'self.plan',value:'planned',until:LATER}});await f.action(0,{kind:'publish-baseline',fields:['self.contact','self.plan']});const own=await f.state(0);assert.equal(own.profile.values['self.contact'],'few-days');assert.equal(own.profile.expirations['self.contact'],END);assert.equal(own.profile.expirations['self.plan'],undefined);f.advance(60000);assert.equal((await f.state(0)).publicAnswers.values['self.contact'],undefined);assert.equal((await f.state(0)).discovery.fields.find(field=>field.id==='self.contact').value,'few-days');
});
test('HTTP all public and private regions expiring together cannot fall through to the no-region legacy guard',async t=>{
  const f=await fixture(t);for(const index of[0,1]){await f.seed(index,{values:{'self.meetingRegions':['seoul-center']},expirations:{'self.meetingRegions':END}});await f.action(index,{kind:'discovery',action:{kind:'set',field:'self.meetingRegions',value:['seoul-center'],until:END}});}assert.equal((await f.candidate(0)).canConnect,true);f.advance(60000);for(const index of[0,1]){const own=await f.state(index);assert.equal(own.publicAnswers.values['self.meetingRegions'],undefined);assert.equal(own.discovery.fields.find(field=>field.id==='self.meetingRegions').value,null);assert.equal((await f.candidate(index)).canConnect,false);const rejected=await f.rawAction(index,{kind:'connect',targetAccountId:ids[1-index]});assert.equal(rejected.status,403,JSON.stringify(rejected.body));assert.equal((await f.state(index)).pairs.length,0);}
});
test('HTTP outstanding acceptance rechecks the sender current mandatory comparison and keeps explicit decline available',async t=>{
  const f=await fixture(t);await f.seed(0,{answers:{'wants.contact':'daily'}});await f.action(0,{kind:'discovery',action:{kind:'set',field:'wants.contact',value:'daily',required:true}});await f.seed(1,{values:{'self.contact':'daily'},expirations:{'self.contact':END}});const sent=await f.pending();f.advance(60000);const receiving=(await f.state(1)).pairs.find(p=>p.pairId===sent.pairId);assert.equal(receiving.introduction.canRespond,false);assert.equal(receiving.introduction.canDecline,true);assert.equal((await f.respond(1,sent,'accept')).status,403);assert.equal((await f.respond(1,sent,'decline')).status,200);
});
test('HTTP sender public required expiry blocks pending acceptance without demanding new recipient private answers',async t=>{
  const f=await fixture(t);await f.seed(0,{values:{'wants.contact':'daily'},required:['wants.contact'],expirations:{'wants.contact':END}});await f.seed(1,{values:{'self.contact':'daily'}});const sent=await f.pending();f.advance(60000);assert.equal((await f.respond(1,sent,'accept')).status,403);assert.equal((await f.state(1)).discovery.fields.find(field=>field.id==='self.contact').value,null);assert.equal((await f.respond(1,sent,'decline')).status,200);
});
test('HTTP normal profile-only recipient acceptance still works when current published answers have no deadlines',async t=>{
  const f=await fixture(t);await f.seed(0);await f.seed(1,{values:{'self.contact':'daily'}});const sent=await f.pending();const result=await f.respond(1,sent,'accept');assert.equal(result.status,200);assert.equal((await f.state(1)).discovery.fields.find(field=>field.id==='self.contact').value,null);
});
test('HTTP crossing a peer public deadline invalidates a live private preview without any saved revision changing',async t=>{
  const f=await fixture(t);await f.seed(0);await f.seed(1,{values:{'self.contact':'daily'},expirations:{'self.contact':END}});const before=await f.state(0),peerBefore=await f.state(1);const preview=await f.call('/preview',0,{expectedRevision:before.revision,action:{kind:'set',field:'wants.contact',value:'daily'}});assert.equal(preview.status,200);f.advance(60000);assert.equal((await f.state(0)).revision,before.revision);assert.equal((await f.state(1)).revision,peerBefore.revision);assert.equal((await f.rawAction(0,{kind:'apply-preview',preview:preview.body.preview.token})).status,409);assert.equal((await f.state(0)).discovery.fields.find(field=>field.id==='wants.contact').value,null);
});
test('HTTP crossing the owner own public deadline also invalidates a preview whose private criteria stayed the same',async t=>{
  const f=await fixture(t);await f.seed(0,{values:{'self.contact':'daily'},expirations:{'self.contact':END}});await f.seed(1);const before=await f.state(0);const preview=await f.call('/preview',0,{expectedRevision:before.revision,action:{kind:'set',field:'wants.plan',value:'planned'}});assert.equal(preview.status,200);f.advance(60000);assert.equal((await f.rawAction(0,{kind:'apply-preview',preview:preview.body.preview.token})).status,409);
});
test('HTTP accepted introductions and confirmed appointments survive public deadline expiry while schedule hints use only current availability',async t=>{
  const f=await fixture(t);await f.seed(0);await f.seed(1,{expirations:{availability:END}});const accepted=await f.accepted();const proposed=await f.appointment(0,accepted.pairId,{kind:'propose',schedule:{startsAt:'2026-10-10T04:00:00.000Z',endsAt:'2026-10-10T04:30:00.000Z',timeZone:'Asia/Seoul',place:'합성 약속 장소',note:''}});const appointmentId=proposed.view.pairs.find(p=>p.pairId===accepted.pairId).view.currentId;for(const index of[0,1])await f.appointment(index,accepted.pairId,{kind:'respond',appointmentId,proposalVersion:1,value:'accept'});f.advance(60000);const own=await f.state(0),pair=own.pairs.find(p=>p.pairId===accepted.pairId);assert.equal(pair.introduction.accepted,true);assert.equal(pair.status,'active');assert.equal(pair.view.appointments[0].people.every(person=>person.response==='accept'),true);assert.equal(pair.scheduleContext.partnerAvailability,null);assert.equal(own.discovery.candidates[0].publicAvailability,null);f.advance(90*60000);await f.appointment(0,accepted.pairId,{kind:'complete',appointmentId});assert.equal((await f.state(0)).pairs.find(p=>p.pairId===accepted.pairId).view.appointments[0].canReflect,true);
});
test('HTTP alignment consumes current public fields and a deadline-only edit invalidates the former alignment key',async t=>{
  const f=await fixture(t);for(const index of[0,1])await f.seed(index,{values:{'self.plan':index?'spontaneous':'planned','self.pace':'lead','self.notice':'advance'}});const sent=await f.accepted();const before=(await f.state(0)).pairs.find(p=>p.pairId===sent.pairId).alignment;assert.equal(before.field,'self.plan');await f.update(1,{expirations:{'self.plan':END}});const edited=(await f.state(0)).pairs.find(p=>p.pairId===sent.pairId).alignment;assert.notEqual(edited.key,before.key);f.advance(60000);const expired=(await f.state(0)).pairs.find(p=>p.pairId===sent.pairId);assert.equal(expired.introduction.accepted,true);assert.equal(expired.alignment.status,'unavailable');assert.equal(expired.alignment.reason,'no-public-difference');
});
test('HTTP owner public availability expiry blocks a new send even while current private availability remains known',async t=>{
  const f=await fixture(t);await f.seed(0,{expirations:{availability:END}});await f.seed(1);assert.equal((await f.candidate(0)).canConnect,true);f.advance(60000);const own=await f.state(0);assert.equal(own.discovery.fields.find(field=>field.id==='availability').value,'weekend');assert.equal(own.publicAnswers.values.availability,undefined);assert.equal((await f.candidate(0)).canConnect,false);assert.equal((await f.rawAction(0,{kind:'connect',targetAccountId:ids[1]})).status,403);assert.equal((await f.state(0)).pairs.length,0);
});
test('HTTP sender private required deadline ending before acceptance does not copy a public answer to revive the request',async t=>{
  const f=await fixture(t);await f.seed(0);await f.action(0,{kind:'discovery',action:{kind:'set',field:'wants.contact',value:'daily',required:true,until:END}});await f.seed(1,{values:{'self.contact':'daily'}});const sent=await f.pending();f.advance(60000);assert.equal((await f.state(0)).discovery.fields.find(field=>field.id==='wants.contact').value,null);assert.equal((await f.respond(1,sent,'accept')).status,403);assert.equal((await f.respond(1,sent,'decline')).status,200);
});
test('HTTP public notice expiry ends a conditional allowance record without changing the private original contact preference',async t=>{
  const f=await fixture(t);await f.seed(0,{answers:{'wants.contact':'daily'}});await f.seed(1,{values:{'self.contact':'few-days','self.notice':'advance'},expirations:{'self.notice':END}});const before=await f.state(0);const p=await f.call('/preview',0,{expectedRevision:before.revision,action:{kind:'conditional-set',ruleId:'contact-with-notice',target:'baseline'}});assert.equal(p.status,200);await f.action(0,{kind:'apply-preview',preview:p.body.preview.token});let own=await f.state(0);const issued=await f.action(0,{kind:'experience',action:{kind:'view-result',token:own.experience.recommendationToken}}),decisionId=issued.result.decisionId;await f.action(0,{kind:'experience',action:{kind:'deliver',decisionId}});own=await f.state(0);assert.equal(own.experience.records.find(row=>row.id===decisionId).allowance.valid,true);f.advance(60000);own=await f.state(0);assert.equal(own.experience.records.find(row=>row.id===decisionId).allowance.valid,false);assert.equal(own.discovery.fields.find(field=>field.id==='wants.contact').value,'daily');assert.equal((await f.state(1)).profile.values['self.notice'],'advance');assert.equal((await f.state(1)).publicAnswers.values['self.notice'],undefined);
});
