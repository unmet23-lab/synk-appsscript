import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-alignment-service-')), filename = path.join(dir, 'demo.sqlite');
  let time = Date.parse('2026-10-07T03:00:00.000Z'), store, service, server, origin;
  const start = async () => { store = createDatingStore({ path: filename, mode: 'demo' }); service = createDatingService({ store, clock: () => time });
    server = http.createServer((req,res) => service.handle(req,res)); await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); origin = `http://127.0.0.1:${server.address().port}`; };
  const close = async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); store.close(); };
  await start(); t.after(close);
  const call = async (route, token, json) => { const res = await fetch(origin + '/api/atlas-dating' + route, { method: json ? 'POST' : 'GET', headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}) }, ...(json ? { body: JSON.stringify(json) } : {}) }); return { status: res.status, ...await res.json() }; };
  const login = async role => (await call('/demo/session',null,{role})).token;
  const get = async token => { const res = await call('/state',token); assert.equal(res.status,200); return res.view; };
  const act = async (token,action,overrides = {}) => call('/action',token,{ requestId:randomUUID(),expectedRevision:(await get(token)).revision,action,...overrides });
  const ok = async (token,action) => { const res = await act(token,action); assert.equal(res.status,200,JSON.stringify(res)); return res; };
  let a = await login('sample-1'), b = await login('sample-3');
  for (let i=0;i<18;i++) { const q = (await get(a)).discovery.question; if (!q || q.optional) break;
    const values = {consent:true,availability:'weekend','self.pace':'lead','self.plan':'planned'};
    await ok(a,{kind:'discovery',action:{kind:'set',field:q.field,value:values[q.field] ?? q.options[0].value,target:'baseline'}}); }
  const connected = await ok(a,{kind:'connect',targetAccountId:'demo:sample-3'}), pairId = connected.result.pairId;
  const pair = async token => (await get(token)).pairs.find(p=>p.pairId===pairId);
  await ok(b,{kind:'introduction',pairId,expectedIntroductionRevision:(await pair(b)).introduction.revision,action:{kind:'respond',introductionId:connected.result.introductionId,value:'accept'}});
  const answer = async (token,value,overrides = {}) => { const p = await pair(token); return act(token,{kind:'alignment',pairId,expectedAlignmentRevision:p.alignment.revision,action:{key:p.alignment.key,value},...overrides}); };
  const yes = async token => { const res=await answer(token,'yes'); assert.equal(res.status,200,JSON.stringify(res)); };
  const alternative = async (token, optionId, overrides = {}) => { const p = await pair(token); return act(token,
    {kind:'alignment',pairId,expectedAlignmentRevision:p.alignment.revision,action:{key:p.alignment.key,kind:'propose-option',optionId},...overrides}); };
  const publicPlan = async (token,value) => { const profile=(await get(token)).profile, values={...profile.values}; if(value===null) delete values['self.plan']; else values['self.plan']=value; return ok(token,{kind:'profile',profile:{...profile,values}}); };
  const appointment = async (token,action) => ok(token,{kind:'appointment',pairId,expectedPairRevision:(await pair(token)).revision,action});
  const restart = async () => { await close(); await start(); a=await login('sample-1'); b=await login('sample-3'); return {a,b}; };
  return { get,act,ok,pair,answer,yes,alternative,publicPlan,appointment,restart,call,login,get a(){return a;},get b(){return b;},pairId,store:()=>store,advance:ms=>{time+=ms;} };
}
test('two explicit responses persist across restart; receipts prevent duplicate writes and no preference changes',async t=>{
  const f=await fixture(t), initial=await f.get(f.a); await f.yes(f.a); assert.equal((await f.pair(f.b)).alignment.status,'waiting');
  const p=await f.pair(f.b), envelope={requestId:randomUUID(),expectedRevision:(await f.get(f.b)).revision,action:{kind:'alignment',pairId:f.pairId,expectedAlignmentRevision:p.alignment.revision,action:{key:p.alignment.key,value:'yes'}}};
  assert.equal((await f.call('/action',f.b,envelope)).status,200); const replay=await f.call('/action',f.b,envelope); assert.equal(replay.replayed,true);
  const revision=(await f.pair(f.a)).alignment.revision; await f.restart(); assert.equal((await f.pair(f.a)).alignment.status,'agreed'); assert.equal((await f.pair(f.a)).alignment.revision,revision);
  const final=await f.get(f.a); assert.deepEqual(final.profile,initial.profile); assert.deepEqual(final.discovery.changes,initial.discovery.changes); assert.equal((await f.pair(f.a)).view.appointments.length,0);
});
test('public answer removed and restored or pause resumed never revives agreement',async t=>{
  const f=await fixture(t); await f.yes(f.a); await f.yes(f.b); const old=(await f.pair(f.a)).alignment;
  await f.publicPlan(f.b,null); await f.publicPlan(f.b,'spontaneous'); let current=(await f.pair(f.a)).alignment;
  assert.equal(current.status,'optional'); assert.notEqual(current.key,old.key);
  const stale=await f.answer(f.a,'yes',{expectedAlignmentRevision:old.revision,action:{key:old.key,value:'yes'}}); assert.equal(stale.status,409);
  await f.yes(f.a); await f.yes(f.b); await f.ok(f.b,{kind:'pause',paused:true}); assert.equal((await f.pair(f.a)).alignment.status,'unavailable');
  await f.ok(f.b,{kind:'pause',paused:false}); assert.equal((await f.pair(f.a)).alignment.status,'optional');
});
test('private preference changes do not change public question, and another account cannot answer',async t=>{
  const f=await fixture(t), before=(await f.pair(f.a)).alignment;
  await f.ok(f.b,{kind:'discovery',action:{kind:'set',field:'self.plan',value:'planned',target:'baseline'}});
  assert.equal((await f.pair(f.a)).alignment.key,before.key);
  const outsider=await f.login('sample-2');
  const bad=await f.act(outsider,{kind:'alignment',pairId:f.pairId,expectedAlignmentRevision:before.revision,action:{key:before.key,value:'yes'}}); assert.equal(bad.status,404);
  const injected=await f.act(f.a,{kind:'alignment',pairId:f.pairId,expectedAlignmentRevision:before.revision,action:{key:before.key,value:'yes',actor:'demo:sample-3'}}); assert.equal(injected.status,400);
});
test('peer response CAS and public permission withdrawal reject stale decisions atomically',async t=>{
  const f=await fixture(t), before=(await f.pair(f.a)).alignment, accountRevision=(await f.get(f.a)).revision;
  await f.yes(f.b);
  const conflict=await f.answer(f.a,'yes',{expectedAlignmentRevision:before.revision,action:{key:before.key,value:'yes'}});
  assert.equal(conflict.status,409); assert.equal(conflict.error.code,'alignment-revision-conflict'); assert.equal((await f.get(f.a)).revision,accountRevision);
  await f.yes(f.a); const current=await f.get(f.b);
  await f.ok(f.b,{kind:'consents',consents:{...current.consents,profilePublic:false}});
  assert.equal((await f.pair(f.a)).status,'closed');
  const attempt=await f.act(f.a,{kind:'alignment',pairId:f.pairId,expectedAlignmentRevision:before.revision,action:{key:before.key,value:'yes'}});
  assert.equal(attempt.status,409); assert.equal((await f.pair(f.a)).alignment,undefined);
});
test('a confirmed appointment cancelled before starting keeps preparation available',async t=>{
  const f=await fixture(t), schedule={startsAt:'2026-10-07T04:00:00.000Z',endsAt:'2026-10-07T04:30:00.000Z',timeZone:'Asia/Seoul',place:'가상 장소',note:''};
  await f.appointment(f.a,{kind:'propose',schedule}); const meeting=(await f.pair(f.a)).view.appointments.at(-1);
  for(const token of [f.a,f.b]) await f.appointment(token,{kind:'respond',appointmentId:meeting.id,proposalVersion:1,value:'accept'});
  await f.appointment(f.a,{kind:'cancel',appointmentId:meeting.id}); f.advance(61*60000);
  assert.equal((await f.pair(f.a)).alignment.status,'optional');
});
test('first confirmed start consumes coordination even if cancelled afterwards, and schedules are independent',async t=>{
  const f=await fixture(t); await f.yes(f.a); await f.yes(f.b);
  const schedule={startsAt:'2026-10-07T04:00:00.000Z',endsAt:'2026-10-07T04:30:00.000Z',timeZone:'Asia/Seoul',place:'가상 장소',note:''};
  await f.appointment(f.a,{kind:'propose',schedule}); let p=await f.pair(f.a), meeting=p.view.appointments.at(-1);
  assert.ok(meeting.people.every(person=>person.response==='unanswered'));
  for(const token of [f.a,f.b]) await f.appointment(token,{kind:'respond',appointmentId:meeting.id,proposalVersion:1,value:'accept'});
  await f.answer(f.a,null); assert.equal((await f.pair(f.a)).view.appointments.at(-1).status,'confirmed');
  f.advance(61*60000); assert.equal((await f.pair(f.a)).alignment.status,'unavailable');
  await f.appointment(f.a,{kind:'cancel',appointmentId:meeting.id}); assert.equal((await f.pair(f.a)).alignment.reason,'first-meeting-started');
});
test('withdrawn introduction and new introduction cannot inherit old responses; delete erases alignment storage',async t=>{
  const f=await fixture(t); await f.yes(f.a); await f.yes(f.b); let p=await f.pair(f.b);
  await f.ok(f.b,{kind:'introduction',pairId:f.pairId,expectedIntroductionRevision:p.introduction.revision,action:{kind:'withdraw',introductionId:p.introduction.current.id}});
  assert.equal((await f.pair(f.a)).alignment.status,'unavailable'); p=await f.pair(f.b);
  await f.ok(f.b,{kind:'introduction',pairId:f.pairId,expectedIntroductionRevision:p.introduction.revision,action:{kind:'reopen'}});
  const res=await f.ok(f.a,{kind:'connect',targetAccountId:'demo:sample-3'}); p=await f.pair(f.b);
  await f.ok(f.b,{kind:'introduction',pairId:f.pairId,expectedIntroductionRevision:p.introduction.revision,action:{kind:'respond',introductionId:res.result.introductionId,value:'accept'}});
  assert.equal((await f.pair(f.a)).alignment.status,'optional'); await f.yes(f.a);
  await f.ok(f.b,{kind:'delete'}); assert.equal(f.store().transaction(tx=>tx.alignment(f.pairId)),null);
  assert.equal((await f.pair(f.a)).status,'closed');
});

test('alternative proposal clears both answers, persists across restart and requires both fresh confirmations',async t=>{
  const f=await fixture(t), before=await f.get(f.a); await f.yes(f.a); await f.yes(f.b); const legacy=(await f.pair(f.a)).alignment;
  assert.equal((await f.alternative(f.b,'full-plan')).status,200); let current=(await f.pair(f.a)).alignment;
  assert.equal(current.status,'optional'); assert.equal(current.selectedOptionId,'full-plan'); assert.equal(current.me.value,null); assert.equal(current.partner.value,null);
  assert.equal(current.contextKey,legacy.key); assert.notEqual(current.key,legacy.key); const newKey=current.key;
  await f.restart(); current=(await f.pair(f.a)).alignment; assert.equal(current.key,newKey); assert.equal(current.status,'optional');
  const stale=await f.answer(f.a,'yes',{action:{key:legacy.key,value:'yes'}}); assert.equal(stale.status,409); assert.equal(stale.error.code,'alignment-stale');
  await f.yes(f.a); assert.equal((await f.pair(f.b)).alignment.status,'waiting'); await f.yes(f.b); assert.equal((await f.pair(f.a)).alignment.status,'agreed');
  const after=await f.get(f.a); assert.deepEqual(after.profile,before.profile); assert.deepEqual(after.discovery.changes,before.discovery.changes);
  assert.equal((await f.pair(f.a)).view.appointments.length,0);
});

test('two concurrent option proposals use pair CAS and cancelling cannot resurrect baseline agreement',async t=>{
  const f=await fixture(t); await f.yes(f.a); await f.yes(f.b); const old=(await f.pair(f.a)).alignment;
  const envelopes=await Promise.all([f.a,f.b].map(async (token,index)=>({token,body:{requestId:randomUUID(),expectedRevision:(await f.get(token)).revision,
    action:{kind:'alignment',pairId:f.pairId,expectedAlignmentRevision:old.revision,action:{key:old.key,kind:'propose-option',optionId:index?'on-day':'full-plan'}}}})));
  const results=await Promise.all(envelopes.map(({token,body})=>f.call('/action',token,body))); assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const successful=results.findIndex(r=>r.status===200), proposer=successful===0?f.a:f.b, peer=successful===0?f.b:f.a;
  await f.yes(f.a); await f.yes(f.b); let current=(await f.pair(proposer)).alignment;
  const forbidden=await f.act(peer,{kind:'alignment',pairId:f.pairId,expectedAlignmentRevision:current.revision,action:{key:current.key,kind:'cancel-option'}});
  assert.equal(forbidden.status,403); current=(await f.pair(proposer)).alignment;
  await f.ok(proposer,{kind:'alignment',pairId:f.pairId,expectedAlignmentRevision:current.revision,action:{key:current.key,kind:'cancel-option'}});
  current=(await f.pair(f.a)).alignment; assert.equal(current.selectedOptionId,'baseline'); assert.equal(current.status,'optional'); assert.notEqual(current.key,old.key);
  assert.equal(current.me.value,null); assert.equal(current.partner.value,null); await f.restart(); assert.equal((await f.pair(f.a)).alignment.status,'optional');
});

test('option injection is rejected and restored public facts never restore a previous alternative',async t=>{
  const f=await fixture(t); const before=await f.get(f.a);
  const injected=await f.alternative(f.a,'full-plan',{action:{key:(await f.pair(f.a)).alignment.key,kind:'propose-option',optionId:'full-plan',value:'yes'}});
  assert.equal(injected.status,400); assert.equal((await f.get(f.a)).revision,before.revision);
  assert.equal((await f.alternative(f.a,'full-plan')).status,200); await f.yes(f.a); await f.yes(f.b); const old=(await f.pair(f.a)).alignment;
  await f.publicPlan(f.b,null); await f.publicPlan(f.b,'spontaneous'); const current=(await f.pair(f.a)).alignment;
  assert.equal(current.selectedOptionId,'baseline'); assert.equal(current.status,'optional'); assert.equal(current.proposal,null); assert.notEqual(current.contextKey,old.contextKey);
  const stale=await f.alternative(f.a,'on-day',{action:{key:old.key,kind:'propose-option',optionId:'on-day'}}); assert.equal(stale.status,409);
});

test('alternative request replay makes one proposal, and first meeting start rejects changing it',async t=>{
  const f=await fixture(t), initial=(await f.pair(f.a)).alignment;
  const envelope={requestId:randomUUID(),expectedRevision:(await f.get(f.a)).revision,action:{kind:'alignment',pairId:f.pairId,
    expectedAlignmentRevision:initial.revision,action:{key:initial.key,kind:'propose-option',optionId:'full-plan'}}};
  assert.equal((await f.call('/action',f.a,envelope)).status,200); const revision=(await f.pair(f.a)).alignment.revision;
  assert.equal((await f.call('/action',f.a,envelope)).replayed,true); assert.equal((await f.pair(f.a)).alignment.revision,revision);
  await f.yes(f.a); await f.yes(f.b);
  await f.appointment(f.a,{kind:'propose',schedule:{startsAt:'2026-10-07T04:00:00.000Z',endsAt:'2026-10-07T04:30:00.000Z',timeZone:'Asia/Seoul',place:'가상 장소',note:''}});
  const meeting=(await f.pair(f.a)).view.appointments.at(-1);
  for(const token of [f.a,f.b]) await f.appointment(token,{kind:'respond',appointmentId:meeting.id,proposalVersion:1,value:'accept'});
  const old=(await f.pair(f.a)).alignment; f.advance(61*60000); const current=(await f.pair(f.a)).alignment;
  assert.equal(current.reason,'first-meeting-started'); assert.equal(current.canProposeOption,false);
  const attempt=await f.alternative(f.a,'on-day',{action:{key:old.key,kind:'propose-option',optionId:'on-day'}});
  assert.equal(attempt.status,409); assert.equal(attempt.error.code,'alignment-stale');
});
