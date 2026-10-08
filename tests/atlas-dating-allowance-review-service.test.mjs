import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';
import { createDiscoveryAdapter } from '../experiences/atlas-lab/discovery.mjs';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';

const exp = action => ({kind:'experience',action});
const set = (field,value,extra={}) => ({kind:'discovery',action:{kind:'set',field,value,target:'baseline',...extra}});
async function fixture(t) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'synk-allowance-review-')),filename=path.join(dir,'demo.sqlite');
  let store,service,server,origin,time=Date.parse('2026-10-07T03:00:00.000Z'),a,b,c;
  const start=async()=>{store=createDatingStore({path:filename,mode:'demo'});service=createDatingService({store,clock:()=>time});server=http.createServer((req,res)=>service.handle(req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;};
  const close=async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));service.close();};
  await start();t.after(async()=>{await close();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('synk-allowance-review-'));await fs.rm(dir,{recursive:true,force:true});});
  const call=async(route,token,json)=>{const response=await fetch(origin+'/api/atlas-dating'+route,{method:json?'POST':'GET',headers:{Origin:origin,...(token?{Authorization:`Bearer ${token}`} :{}),...(json?{'Content-Type':'application/json'}:{})},...(json?{body:JSON.stringify(json)}:{})});return{status:response.status,...await response.json()};};
  const login=async role=>(await call('/demo/session',null,{role})).token;
  const get=async token=>{const r=await call('/state',token);assert.equal(r.status,200);return r.view;};
  const act=async(token,action)=>call('/action',token,{requestId:randomUUID(),expectedRevision:(await get(token)).revision,action});
  const ok=async(token,action)=>{const r=await act(token,action);assert.equal(r.status,200,JSON.stringify(r));return r;};
  const preview=async(token,input)=>call('/preview',token,{expectedRevision:(await get(token)).revision,...input});
  const apply=async(token,p)=>{assert.equal(p.status,200,JSON.stringify(p));return ok(token,{kind:'apply-preview',preview:p.preview.token});};
  const rule=async(extra={})=>apply(a,await preview(a,{action:{kind:'conditional-set',ruleId:'contact-with-notice',target:'baseline',...extra}}));
  const issue=async(delivered=true)=>{const v=await get(a);assert.equal(v.discovery.topCandidateId,'demo:sample-1');const r=await ok(a,exp({kind:'view-result',token:v.experience.recommendationToken})),id=r.result.decisionId;if(delivered)await ok(a,exp({kind:'deliver',decisionId:id}));return id;};
  const review=async(id,value,token=a)=>act(token,exp({kind:'allowance-review',decisionId:id,value}));
  const record=async(id,token=a)=>(await get(token)).experience.records.find(x=>x.id===id);
  const profile=async(token,changes)=>{const v=await get(token);return ok(token,{kind:'profile',profile:{...v.profile,...changes,values:{...v.profile.values,...changes.values}}});};
  a=await login('sample-3');b=await login('sample-1');c=await login('sample-2');
  for(const [field,value] of Object.entries({consent:true,availability:'weekend','self.pace':'listen','self.plan':'planned','wants.pace':'lead','wants.contact':'daily','wants.notice':'advance'}))await ok(a,set(field,value,field==='wants.pace'?{required:true}:{}));
  await profile(b,{values:{'self.contact':'few-days','self.notice':'advance'}});
  return{call,get,act,ok,preview,apply,rule,issue,review,record,profile,get store(){return store;},get a(){return a;},get b(){return b;},get c(){return c;},advance:ms=>{time+=ms;},restart:async()=>{await close();await start();a=await login('sample-3');b=await login('sample-1');c=await login('sample-2');}};
}

test('only an explicitly viewed qualified top captures a review; delivery gates saving but not the form',async t=>{
  const f=await fixture(t),legacy=await f.issue();assert.equal((await f.record(legacy)).allowance,undefined);
  await f.rule();const before=await f.get(f.a);assert.equal(before.experience.records.length,1);
  const id=await f.issue(false),pending=await f.record(id);assert.equal(pending.allowance.valid,true);assert.equal(pending.allowance.canReview,true);assert.equal(pending.allowance.canRespond,false);
  assert.equal((await f.review(id,'keep')).status,409);await f.ok(f.a,exp({kind:'deliver',decisionId:id}));
  const delivered=await f.get(f.a);assert.equal((await f.review(id,'keep')).status,200);const kept=await f.get(f.a),row=kept.experience.records.find(r=>r.id===id);
  assert.equal(row.allowance.response.value,'keep');assert.equal(row.allowance.canRespond,true);assert.equal(row.allowance.canPreviewClear,false);
  assert.deepEqual(kept.discovery.conditionalPreference,delivered.discovery.conditionalPreference);assert.deepEqual(kept.profile,delivered.profile);assert.deepEqual(kept.pairs,delivered.pairs);
  assert.equal((await f.record(legacy)).allowance,undefined);assert.equal((await f.get(f.b)).experience.records.length,0);
  for(const key of ['binding','ruleKey','source','candidatePublicKey','ownerGeneration','ownKey','responseRevision'])assert.equal(row.allowance[key],undefined);
  assert.equal(kept.allowanceGeneration,undefined);
});

test('stop preview is read-only and clears only its exact effective layer while preserving the original answer',async t=>{
  const f=await fixture(t);await f.rule();await f.rule({target:'context'});const id=await f.issue();assert.equal((await f.review(id,'stop')).status,200);
  const before=await f.get(f.a),p=await f.preview(f.a,{allowanceReview:{decisionId:id}});assert.equal(p.status,200,JSON.stringify(p));
  assert.equal((await f.get(f.a)).revision,before.revision);assert.equal((await f.record(id)).allowance.target,'context');
  await f.apply(f.a,p);const after=await f.get(f.a);assert.equal(after.discovery.conditionalPreference.context.status,'none');assert.equal(after.discovery.conditionalPreference.baseline.status,'active');
  assert.equal(after.discovery.fields.find(x=>x.id==='wants.contact').value,'daily');assert.deepEqual(after.profile,before.profile);assert.equal((await f.record(id)).allowance.valid,false);
});

test('unknown, keep, withdrawal, foreign records and changed reviews cannot authorize an old clear preview',async t=>{
  const f=await fixture(t);await f.rule();const id=await f.issue();
  for(const value of ['unknown','keep',null]){assert.equal((await f.review(id,value)).status,200);assert.equal((await f.preview(f.a,{allowanceReview:{decisionId:id}})).status,409);}
  assert.equal((await f.review(id,'stop',f.b)).status,409);assert.equal((await f.preview(f.b,{allowanceReview:{decisionId:id}})).status,409);
  assert.equal((await f.preview(f.a,{allowanceReview:{decisionId:id,target:'context'}})).status,400);
  assert.equal((await f.act(f.a,exp({kind:'allowance-review',decisionId:id,value:'stop',target:'context'}))).status,400);
  assert.equal((await f.review(id,'stop')).status,200);const p=await f.preview(f.a,{allowanceReview:{decisionId:id}});
  await f.review(id,null);await f.review(id,'stop');const stale=await f.act(f.a,{kind:'apply-preview',preview:p.preview.token});assert.equal(stale.status,409);
  assert.equal((await f.get(f.a)).discovery.conditionalPreference.baseline.status,'active');
});

test('same-value original redeclaration, replacement and a new context never revive a past allowance source',async t=>{
  const f=await fixture(t);await f.rule();const id=await f.issue();await f.review(id,'stop');const p=await f.preview(f.a,{allowanceReview:{decisionId:id}});
  await f.ok(f.a,set('wants.contact','daily'));assert.equal((await f.record(id)).allowance.valid,false);await f.rule();assert.equal((await f.record(id)).allowance.valid,false);
  assert.equal((await f.act(f.a,{kind:'apply-preview',preview:p.preview.token})).status,409);
  const next=await f.issue();await f.ok(f.a,{kind:'discovery',action:{kind:'start-context'}});assert.equal((await f.record(next)).allowance.valid,false);assert.equal((await f.review(next,'stop')).status,409);
});

test('public edits restored without an intervening read remain invalid, while private peer answers stay private',async t=>{
  const f=await fixture(t);await f.rule();const id=await f.issue();await f.review(id,'stop');
  await f.ok(f.b,exp({kind:'goal',value:'comfortable'}));assert.equal((await f.record(id)).allowance.valid,true);
  const original=(await f.get(f.b)).profile;await f.profile(f.b,{values:{'self.notice':'when-free'}});await f.ok(f.b,{kind:'profile',profile:original});
  assert.equal((await f.record(id)).allowance.valid,false);assert.equal((await f.preview(f.a,{allowanceReview:{decisionId:id}})).status,409);
  assert.equal((await f.review(id,null)).status,200);assert.equal((await f.record(id)).allowance.response,undefined);
});

test('equality expiry invalidates review and a fresh recommendation token is required after public changes',async t=>{
  const f=await fixture(t);await f.rule({until:'2026-10-07T03:01:00.000Z'});const id=await f.issue();await f.review(id,'stop');const p=await f.preview(f.a,{allowanceReview:{decisionId:id}});
  f.advance(60000);assert.equal((await f.record(id)).allowance.valid,false);assert.equal((await f.review(id,'keep')).status,409);assert.equal((await f.act(f.a,{kind:'apply-preview',preview:p.preview.token})).status,409);assert.equal((await f.review(id,null)).status,200);
  await f.rule();const before=await f.get(f.a);await f.profile(f.b,{intro:'공개 문장을 직접 정정한 가상 역할'});
  assert.equal((await f.act(f.a,exp({kind:'view-result',token:before.experience.recommendationToken}))).status,409);
});

test('restart preserves a valid private review; CAS and idempotency preserve one response; storage withdrawal erases it',async t=>{
  const f=await fixture(t);await f.rule();const id=await f.issue();const before=await f.get(f.a),input={requestId:randomUUID(),expectedRevision:before.revision,action:exp({kind:'allowance-review',decisionId:id,value:'keep'})};
  const first=await f.call('/action',f.a,input);assert.equal(first.status,200);const replay=await f.call('/action',f.a,input);assert.equal(replay.status,200);assert.equal(replay.replayed,true);
  assert.equal((await f.call('/action',f.a,{...input,requestId:randomUUID()})).status,409);
  const response=(await f.record(id)).allowance.response;await f.restart();assert.deepEqual((await f.record(id)).allowance.response,response);assert.equal((await f.record(id)).allowance.valid,true);
  const v=await f.get(f.a);await f.ok(f.a,{kind:'consents',consents:{...v.consents,storePreferences:false}});assert.equal((await f.get(f.a)).experience.records.length,0);
});

test('peer withdrawal and own pause cannot block withdrawing a review, and restoring access never revives it',async t=>{
  const f=await fixture(t);await f.rule();const id=await f.issue();await f.review(id,'stop');
  const peer=await f.get(f.b);await f.ok(f.b,{kind:'consents',consents:{...peer.consents,profilePublic:false}});await f.ok(f.a,{kind:'pause',paused:true});
  assert.equal((await f.review(id,null)).status,200);const hidden=await f.record(id);assert.equal(hidden.selectedId,null);assert.equal(hidden.allowance.canReview,false);
  await f.ok(f.b,{kind:'consents',consents:peer.consents});await f.ok(f.a,{kind:'pause',paused:false});assert.equal((await f.record(id)).allowance.valid,false);assert.equal((await f.review(id,'keep')).status,409);
});

test('question convenience settings and private reaction notes do not invalidate evidence, but hiding and restoring that candidate does',async t=>{
  const f=await fixture(t);await f.ok(f.a,set('wants.pace','lead',{required:false}));
  await f.profile(f.b,{values:{'self.relationshipGoal':'committed'}});
  await f.profile(f.c,{values:{'self.relationshipGoal':'open'}});
  await f.ok(f.a,{kind:'discovery',action:{kind:'priorities',fields:['wants.relationshipGoal'],target:'baseline'}});
  await f.rule();const id=await f.issue();await f.review(id,'stop');
  for(const action of [{kind:'stop-questions'},{kind:'continue-questions'},{kind:'question-mode',mode:'brief'},
    {kind:'feedback',candidateId:'demo:sample-2',reason:'unknown',decision:'record-only'},
    {kind:'feedback',candidateId:'demo:sample-1',reason:'context',decision:'record-only'}]) {
    await f.ok(f.a,{kind:'discovery',action});assert.equal((await f.record(id)).allowance.valid,true,action.kind);
  }
  const question=(await f.get(f.a)).discovery.question;assert.equal(question.optional,true);
  await f.ok(f.a,{kind:'discovery',action:{kind:'defer-question',field:question.field}});assert.equal((await f.record(id)).allowance.valid,true);
  await f.ok(f.a,{kind:'discovery',action:{kind:'hide-candidate',candidateId:'demo:sample-1',days:7}});
  await f.ok(f.a,{kind:'discovery',action:{kind:'unhide-candidate',candidateId:'demo:sample-1'}});
  assert.equal((await f.record(id)).allowance.valid,false);
});

test('migration of a valid legacy exclusion then restoration removes both synthetic candidate events together',async t=>{
  const f=await fixture(t),legacy=createDiscoveryAdapter({Domain,Ask,Personalization});
  let state=legacy.create('ready',{at:'2026-10-07T02:00:00.000Z'});
  state=legacy.record(state,{kind:'feedback',candidateId:'candidate-1',reason:'unknown',decision:'skip-current',at:'2026-10-07T02:00:01.000Z'});
  const feedbackId=legacy.inspect(state).excludedCandidates[0].feedbackId;
  state=legacy.record(state,{kind:'restore-candidate',candidateId:'candidate-1',feedbackId,at:'2026-10-07T02:00:02.000Z'});
  assert.equal(legacy.inspect(state).excludedCandidates.length,0);
  f.store.transaction(tx=>{const row=tx.account('demo:sample-3');tx.updateAccount(row,{...row.document,discovery:state});});
  const view=await f.get(f.a);assert.equal(view.discoveryMigration.from,'fixed-fictional-pool');assert.equal(view.discovery.selection,null);assert.deepEqual(view.discovery.excludedCandidates,[]);
  assert.equal(view.discovery.fields.find(field=>field.id==='wants.pace').value,'lead');assert.equal(view.legacyDiscovery,undefined);
  const stored=f.store.transaction(tx=>tx.account('demo:sample-3').document);assert.deepEqual(stored.legacyDiscovery,state);
  assert.ok(stored.discovery.events.every(event=>!['feedback','restore-candidate'].includes(event.kind)));
});

test('a suspended owner may withdraw a private answer and deletion removes its stored snapshot',async t=>{
  const f=await fixture(t);await f.rule();const id=await f.issue();await f.review(id,'stop');
  const operator=(await f.call('/demo/session',null,{role:'operator'})).token;
  const report=await f.ok(f.b,{kind:'report',targetAccountId:'demo:sample-3',reason:'other',details:'합성 경계 검사'});
  await f.ok(operator,{kind:'admin-report',reportId:report.result.reportId,status:'resolved',decision:'suspend-target',note:'합성 검사'});
  assert.equal((await f.get(f.a)).status,'suspended');assert.equal((await f.review(id,'keep')).status,403);assert.equal((await f.review(id,null)).status,200);
  assert.equal((await f.record(id)).allowance.response,undefined);assert.equal((await f.record(id)).allowance.canReview,false);
  await f.ok(f.a,{kind:'delete'});assert.equal(f.store.transaction(tx=>tx.account('demo:sample-3').document),null);
});

test('own public withdrawal already removes the recommendation pool; restoring it permits only a fresh allowance snapshot',async t=>{
  const f=await fixture(t);await f.rule();const id=await f.issue();await f.review(id,'stop');const before=await f.get(f.a);
  await f.ok(f.a,{kind:'consents',consents:{...before.consents,profilePublic:false}});
  const hidden=await f.get(f.a);assert.ok(hidden.discovery);assert.deepEqual(hidden.discovery.candidates,[]);assert.deepEqual(hidden.candidates,[]);
  assert.equal(hidden.discovery.topCandidateId,null);assert.equal(hidden.experience.recommendationToken,null);
  const old=hidden.experience.records.find(record=>record.id===id);assert.equal(old.selectedId,null);assert.equal(old.allowance.valid,false);
  assert.equal((await f.act(f.a,exp({kind:'view-result',token:before.experience.recommendationToken}))).status,409);
  assert.equal((await f.review(id,null)).status,200);
  await f.ok(f.a,{kind:'consents',consents:before.consents});assert.equal((await f.record(id)).allowance.valid,false);
  const fresh=await f.issue();assert.equal((await f.record(fresh)).allowance.valid,true);assert.equal((await f.review(fresh,'keep')).status,200);
});
