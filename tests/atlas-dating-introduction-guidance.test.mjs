import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getIntroductionGuidance } from '../experiences/atlas-lab/introduction-guidance.mjs';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';

const base = extra => ({ canConnect: false, ownReceiveInvitations: true, ...extra });
const area = ['seoul-center'];
const expectAction = (result, action) => { assert.deepEqual(result.action, action); assert.deepEqual(Object.keys(result).sort(), ['action','body','id','title']); };
const throws = () => { throw new Error('a forbidden getter was evaluated'); };
const guarded = (values, keys) => Object.defineProperties(values, Object.fromEntries(keys.map(key => [key, { get: throws, enumerable: true }])));

test('a current connect permission returns null without evaluating any other getter', () => {
  assert.equal(getIntroductionGuidance(guarded({ canConnect: true }, ['ownReceiveInvitations','ownPrivateRegions','ownPublicRegions','peerPublicRegions','introduction','peer','private','name','id'])), null);
});
test('an unknown or malformed connect projection never invents a settings or area cause', () => {
  for (const canConnect of [undefined, null, 'true', 'false', 0, 1]) {
    const result = getIntroductionGuidance(guarded({ canConnect }, ['ownReceiveInvitations','ownPrivateRegions','ownPublicRegions','peerPublicRegions','introduction']));
    assert.equal(result.id, 'introduction-confirmation-pending'); expectAction(result, { kind: 'refresh', label: '최신 소개 상태 확인' });
  }
});
test('the owner invitation setting provides a direct settings action before region or history reads', () => {
  const result = getIntroductionGuidance(guarded(base({ ownReceiveInvitations: false }), ['ownPrivateRegions','ownPublicRegions','peerPublicRegions','introduction','peerPrivateSettings']));
  assert.equal(result.id, 'own-invitations-off'); expectAction(result, { kind: 'navigate', page: 'settings', label: '내 초대 설정 확인' });
});
test('missing areas on both sides retain the legacy comparison instead of requiring a new answer', () => {
  assert.equal(getIntroductionGuidance(base()).id, 'introduction-confirmation-pending');
});
test('a current authorized public peer area requires a direct owner private answer without copying it', () => {
  const input = base({ peerPublicRegions: Object.freeze(area.slice()) }), result = getIntroductionGuidance(input);
  assert.equal(result.id, 'own-meeting-regions-missing'); expectAction(result, { kind: 'answer', field: 'self.meetingRegions', label: '내 만남 가능 지역 고르기' });
  assert.equal(input.ownPrivateRegions, undefined); assert.doesNotMatch(JSON.stringify(result), /seoul-center|서울 도심/);
});
test('the owner public area is evidence that a current private choice is needed and is never that choice', () => {
  const input = base({ ownPublicRegions: area }), result = getIntroductionGuidance(input);
  assert.equal(result.id, 'own-meeting-regions-missing'); assert.equal(input.ownPrivateRegions, undefined);
});
test('known owner private areas and absent own publication navigate to disclosure rather than private editing', () => {
  const result = getIntroductionGuidance(base({ ownPrivateRegions: area }));
  assert.equal(result.id, 'own-public-meeting-regions-missing'); expectAction(result, { kind: 'navigate', page: 'profile', target: 'disclosure', label: '공개할 만남 지역 확인' });
});
test('disjoint owner private and owner public choices are described only as an own observable difference', () => {
  const result = getIntroductionGuidance(base({ ownPrivateRegions: area, ownPublicRegions: ['busan'], peerPublicRegions: area }));
  assert.equal(result.id, 'own-meeting-regions-disjoint'); assert.equal(result.action.target, 'disclosure');
  assert.doesNotMatch(JSON.stringify(result), /busan|부산|seoul-center|상대가|상대의 비공개/);
});
test('overlapping own areas do not reveal a hidden peer private incompatibility or peer settings', () => {
  const result = getIntroductionGuidance(guarded(base({ ownPrivateRegions: area, ownPublicRegions: [...area,'busan'], peerPublicRegions: area }), ['peerPrivateRegions','peerReceiveInvitations','peerName','peerId','rawPeer']));
  assert.equal(result.id, 'introduction-confirmation-pending'); assert.doesNotMatch(JSON.stringify(result), /busan|부산|비공개 지역|상대의 초대/);
});
test('free-form area descriptions and malformed lists never map into a direct meeting-area declaration', () => {
  for (const value of ['서울 강남', [], ['busan','busan'], ['secret-region'], Array(7).fill('busan')]) assert.equal(getIntroductionGuidance(base({ ownPrivateRegions:value,ownPublicRegions:value,peerPublicRegions:value })).id, 'introduction-confirmation-pending');
});
test('accessors inside an alleged public area array are never evaluated', () => {
  const list = ['seoul-center']; Object.defineProperty(list,'0',{get:throws,enumerable:true});
  assert.equal(getIntroductionGuidance(base({peerPublicRegions:list})).id,'introduction-confirmation-pending');
});
test('an existing owner reopen permission produces a pair action without an identifier', () => {
  const result=getIntroductionGuidance(base({introduction:guarded({hasHistory:true,canReopen:true},['name','id','peer','private'])}));
  assert.equal(result.id,'own-introduction-reopen'); expectAction(result,{kind:'focus-pair',label:'내 소개받기 다시 열기 확인'});
});
test('an unbound alleged reopen right cannot create a pair navigation', () => {
  assert.equal(getIntroductionGuidance(base({introduction:{hasHistory:false,canReopen:true}})).id,'introduction-confirmation-pending');
});
test('accepted introductions navigate to the existing owner pair rather than submitting another request', () => {
  const result=getIntroductionGuidance(base({introduction:{hasHistory:true,accepted:true}}));assert.equal(result.id,'existing-introduction-accepted');assert.equal(result.action.kind,'focus-pair');
});
test('a current accepted pair takes precedence over new-introduction area gaps without reading those areas', () => {
  const result=getIntroductionGuidance(guarded(base({introduction:{hasHistory:true,accepted:true}}),['ownPrivateRegions','ownPublicRegions','peerPublicRegions']));assert.equal(result.id,'existing-introduction-accepted');
});
test('a receiver with only decline permission gets the existing request action and no invented acceptance claim', () => {
  const result=getIntroductionGuidance(base({introduction:{hasHistory:true,canRespond:false,canDecline:true}}));
  assert.equal(result.id,'existing-introduction-response');assert.doesNotMatch(result.body,/수락할 수|자동 수락/);
});
test('a sent pending request describes only known own history and does not speculate about silence', () => {
  const result=getIntroductionGuidance(base({introduction:{hasHistory:true,status:'pending',canWithdraw:true}}));assert.equal(result.id,'existing-introduction-pending');assert.equal(result.action.kind,'focus-pair');
});
test('expired requests without an own current right get generic refresh rather than a hidden receiving cause', () => {
  const result=getIntroductionGuidance(base({introduction:{hasHistory:true,status:'expired',canReopen:false,canRespond:false,canWithdraw:false}}));assert.equal(result.id,'introduction-confirmation-pending');
});
test('returned navigation cannot mutate frozen source areas or a later independent result', () => {
  const input=Object.freeze(base({ownPrivateRegions:Object.freeze(area.slice()),ownPublicRegions:Object.freeze(['busan'])}));
  const first=getIntroductionGuidance(input);first.action.page='unexpected';assert.equal(getIntroductionGuidance(input).action.page,'profile');assert.deepEqual(input.ownPrivateRegions,area);
});

const identities=['guidance:a','guidance:b'];
async function fixture(t){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'synk-introduction-guidance-'));let now=Date.parse('2026-10-10T03:00:00.000Z');
  const server=createDatingServer({mode:'account',databasePath:path.join(dir,'account.sqlite'),verify:async accountId=>identities.includes(accountId)?{accountId}:null,clock:()=>new Date(now)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('synk-introduction-guidance-'));await fs.rm(dir,{recursive:true,force:true});});
  const request=async(route,index,body)=>{const response=await fetch(origin+'/api/atlas-dating'+route,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${identities[index]}`,...(body?{Origin:origin,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,body:await response.json()};};
  const state=async index=>{const result=await request('/state',index);assert.equal(result.status,200,JSON.stringify(result.body));return result.body.view;};
  const rawAction=async(index,action,revision)=>(request('/action',index,{requestId:randomUUID(),expectedRevision:revision??(await state(index)).revision,action}));
  const action=async(index,event)=>{const result=await rawAction(index,event);assert.equal(result.status,200,JSON.stringify(result.body));return result.body;};
  async function seed(index,{privateRegions,publicRegions,receiveInvitations=true}={}){
    await action(index,{kind:'profile',profile:{nickname:`소개행동 가상${index}`,region:'서울이라는 소개글',intro:'합성 공개 소개',values:{availability:'weekend',...(publicRegions?{'self.meetingRegions':publicRegions}:{})},required:[]}});
    await action(index,{kind:'adult',declared:true});await action(index,{kind:'consents',consents:{profilePublic:true,receiveInvitations,storePreferences:true}});
    for(const[field,value]of Object.entries({consent:true,availability:'weekend',...(privateRegions?{'self.meetingRegions':privateRegions}:{})}))await action(index,{kind:'discovery',action:{kind:'set',field,value}});
  }
  return{request,state,rawAction,action,seed,advance:ms=>{now+=ms;},candidate:async index=>(await state(index)).discovery.candidates.find(candidate=>candidate.id===identities[1-index])};
}

test('HTTP own invitation-off guidance opens settings and does not mutate consent or permit a stale connect',async t=>{
  const f=await fixture(t);await f.seed(0,{receiveInvitations:false});await f.seed(1);const before=await f.state(0),candidate=await f.candidate(0);assert.equal(candidate.status,'eligible');assert.equal(candidate.canConnect,false);assert.equal(candidate.introductionGuidance.id,'own-invitations-off');assert.equal(candidate.introductionGuidance.action.page,'settings');assert.equal((await f.state(0)).revision,before.revision);assert.equal((await f.rawAction(0,{kind:'connect',targetAccountId:identities[1]})).status,403);assert.equal((await f.state(0)).consents.receiveInvitations,false);
});
test('HTTP a current private owner region without own publication points only to separate disclosure',async t=>{
  const f=await fixture(t);await f.seed(0,{privateRegions:area});await f.seed(1,{privateRegions:area,publicRegions:area});const candidate=await f.candidate(0);assert.equal(candidate.status,'eligible');assert.equal(candidate.canConnect,false);assert.equal(candidate.introductionGuidance.id,'own-public-meeting-regions-missing');assert.equal(candidate.introductionGuidance.action.target,'disclosure');assert.equal((await f.state(0)).profile.values['self.meetingRegions'],undefined);
});
test('HTTP a disclosed region cannot invent an owner private declaration and produces the direct answer action',async t=>{
  const f=await fixture(t);await f.seed(0,{publicRegions:area});await f.seed(1,{privateRegions:area,publicRegions:area});const candidate=await f.candidate(0);assert.equal(candidate.canConnect,false);assert.equal(candidate.introductionGuidance.id,'own-meeting-regions-missing');assert.equal(candidate.introductionGuidance.action.field,'self.meetingRegions');assert.equal((await f.state(0)).discovery.fields.find(field=>field.id==='self.meetingRegions').value,null);
});
test('HTTP hidden counterpart private incompatibility and invitation-off cases share generic refresh without leaking their cause',async t=>{
  const f=await fixture(t);await f.seed(0,{privateRegions:area,publicRegions:area});await f.seed(1,{privateRegions:['busan'],publicRegions:area});let candidate=await f.candidate(0);assert.equal(candidate.status,'eligible');assert.equal(candidate.canConnect,false);const regionGuidance=candidate.introductionGuidance;assert.equal(regionGuidance.id,'introduction-confirmation-pending');assert.doesNotMatch(JSON.stringify(regionGuidance),/guidance:|소개행동|부산|busan|상대의 초대|비공개 지역/);
  await f.action(1,{kind:'discovery',action:{kind:'set',field:'self.meetingRegions',value:area}});await f.action(1,{kind:'consents',consents:{profilePublic:true,receiveInvitations:false,storePreferences:true}});candidate=await f.candidate(0);assert.equal(candidate.canConnect,false);assert.deepEqual(candidate.introductionGuidance,regionGuidance);
});
test('HTTP a saved connectable projection is not authority after hidden peer region expiry',async t=>{
  const f=await fixture(t);for(const index of[0,1])await f.seed(index,{privateRegions:area,publicRegions:area});await f.action(1,{kind:'discovery',action:{kind:'set',field:'self.meetingRegions',value:area,until:'2026-10-10T03:01:00.000Z'}});const before=await f.state(0);assert.equal(before.discovery.candidates[0].canConnect,true);assert.equal(before.discovery.candidates[0].introductionGuidance,null);f.advance(60000);const current=await f.candidate(0);assert.equal(current.canConnect,false);assert.equal(current.introductionGuidance.id,'introduction-confirmation-pending');assert.equal((await f.rawAction(0,{kind:'connect',targetAccountId:identities[1]},before.revision)).status,403);assert.equal((await f.state(0)).pairs.length,0);
});
test('HTTP own private expiry asks for a new direct answer and never copies the still-public old region',async t=>{
  const f=await fixture(t);for(const index of[0,1])await f.seed(index,{privateRegions:area,publicRegions:area});await f.action(0,{kind:'discovery',action:{kind:'set',field:'self.meetingRegions',value:area,until:'2026-10-10T03:01:00.000Z'}});f.advance(60000);const own=await f.state(0),candidate=own.discovery.candidates[0];assert.equal(candidate.canConnect,false);assert.equal(candidate.introductionGuidance.id,'own-meeting-regions-missing');assert.equal(own.discovery.fields.find(field=>field.id==='self.meetingRegions').value,null);assert.deepEqual(own.profile.values['self.meetingRegions'],area);
});
test('HTTP closed receiving history exposes only the owner reopen action while the other account gets generic refresh',async t=>{
  const f=await fixture(t);for(const index of[0,1])await f.seed(index);const sent=await f.action(0,{kind:'connect',targetAccountId:identities[1]});let own=await f.state(1),pair=own.pairs.find(pair=>pair.pairId===sent.result.pairId);await f.action(1,{kind:'introduction',pairId:pair.pairId,expectedIntroductionRevision:pair.introduction.revision,action:{kind:'respond',introductionId:sent.result.introductionId,value:'decline'}});assert.equal((await f.candidate(1)).introductionGuidance.id,'own-introduction-reopen');assert.equal((await f.candidate(1)).introductionGuidance.action.kind,'focus-pair');assert.equal((await f.candidate(0)).introductionGuidance.id,'introduction-confirmation-pending');
});
test('HTTP expiry respects the distinct sender cooldown and recipient current reopening right',async t=>{
  const f=await fixture(t);for(const index of[0,1])await f.seed(index);await f.action(0,{kind:'connect',targetAccountId:identities[1]});assert.equal((await f.candidate(0)).introductionGuidance.id,'existing-introduction-pending');assert.equal((await f.candidate(1)).introductionGuidance.id,'existing-introduction-response');f.advance(73*3600000);assert.equal((await f.candidate(0)).introductionGuidance.id,'introduction-confirmation-pending');assert.equal((await f.candidate(1)).introductionGuidance.id,'own-introduction-reopen');assert.equal((await f.rawAction(0,{kind:'connect',targetAccountId:identities[1]})).status,429);
});
test('HTTP an already accepted introduction remains an existing-pair action when next-introduction area requirements change',async t=>{
  const f=await fixture(t);for(const index of[0,1])await f.seed(index);const sent=await f.action(0,{kind:'connect',targetAccountId:identities[1]});const received=(await f.state(1)).pairs.find(pair=>pair.pairId===sent.result.pairId);await f.action(1,{kind:'introduction',pairId:received.pairId,expectedIntroductionRevision:received.introduction.revision,action:{kind:'respond',introductionId:sent.result.introductionId,value:'accept'}});await f.action(0,{kind:'discovery',action:{kind:'set',field:'self.meetingRegions',value:['busan']}});const own=await f.state(0),candidate=own.discovery.candidates[0];assert.equal(candidate.canConnect,false);assert.equal(candidate.introductionGuidance.id,'existing-introduction-accepted');assert.equal(candidate.introductionGuidance.action.kind,'focus-pair');assert.equal(own.pairs.find(pair=>pair.pairId===sent.result.pairId).introduction.accepted,true);assert.equal(own.profile.values['self.meetingRegions'],undefined);
});
