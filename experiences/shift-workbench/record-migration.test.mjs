import test from 'node:test';
import assert from 'node:assert/strict';
import engine from '../../atlas/personalization.js';
import temper from '../../atlas/temper-outcomes.js';
import core from '../../atlas/engine.js';
import * as M from './model.mjs';

const base=Date.parse('2026-10-06T00:00:00.000Z');
const at=n=>new Date(base+n*1000).toISOString();
const settings={task:'meeting',goal:'work',minutes:10,support:'independent'};
const draft='<script>literal text</script> 제공 자료의 담당·기한·승인 여부를 대조하고 사람이 직접 고친 내용입니다.';
function fill(s){
  s.run.prompt=M.TASKS[s.run.task].template;
  s.run.draft=draft;s.run.reviewed=true;
  for(const id of s.run.checkIds){const c=M.TASKS[s.run.task].checks.find(c=>c.id===id);s.run.answers[id]={kind:c.answer,source:c.source};}
  s.run.result=M.evaluate(s.run);return s;
}
function fixture(scope=M.SCOPE){
  let s=M.startRun(M.newState(),settings,engine,at(0),scope);s.save=true;
  s=M.completeRun(fill(M.recordPracticeExposure(s,at(1),scope)),engine,at(2),scope);
  s=M.giveFeedback(s,'want_more',engine,at(3),scope);
  s=M.startRun(s,{...settings,task:'planning'},engine,at(4),scope);
  s.run.prompt='이전에 직접 쓴 요청문 <img src=x onerror=bad()> 입니다.';s.run.draft=draft;
  return s;
}
const changes={
  disable:p=>engine.clearProfile(p,{mode:'disable',at:at(10)}),
  delete:p=>engine.clearProfile(p,{mode:'delete',at:at(10)}),
  skip:p=>engine.clearProfile(p,{mode:'skip',at:at(10)}),
  reconsent:p=>engine.updateProfile(engine.clearProfile(p,{mode:'disable',at:at(9)}),{consent:true,values:{}},at(10)),
  forget:p=>engine.updateProfile(p,{values:{support:null}},at(10))
};
for(const [name,change] of Object.entries(changes))test(`${name}: old authored work survives; old analysis never joins the next generation`,()=>{
  const s=fixture(),sourceGeneration=s.profile.generation,oldProfile=structuredClone(s.profile);
  s.profile=change(s.profile);const original=structuredClone(s),oldIds=new Set(s.events.map(e=>e.id));
  const report=M.practiceEvaluation(s,temper,at(11));
  assert.ok(report.byPolicy.every(row=>row.counts.decisions===0&&row.mean===null));
  assert.equal(M.practiceHistoryUsed(s),false);assert.deepEqual(M.practiceBasis(s),[]);
  assert.match(M.practiceReason(s),/조건이 변경/);
  const migrated=M.restore(JSON.stringify(s),engine,M.SCOPE,temper);
  assert.deepEqual(s,original,'migration must not mutate the source');
  assert.deepEqual(migrated.events,[]);assert.equal(migrated.run,null);
  assert.deepEqual(migrated.evaluation,{decisions:[],exposures:[],outcomes:[]});
  assert.equal(migrated.history.length,2);
  for(const row of migrated.history){
    assert.equal(row.kind,'saved-work');assert.equal(row.sourceGeneration,sourceGeneration);assert.equal(row.draft,draft);
    assert.deepEqual(Object.keys(row).sort(),['at','draft','kind','prompt','scope','sourceGeneration','status','task']);
    assert.notEqual(row.sourceGeneration,migrated.profile.generation);
  }
  assert.deepEqual(migrated.history.map(h=>h.status),['completed','in-progress']);
  assert.match(M.exportSavedWork(migrated,1),/이전에 직접 쓴 요청문 <img/);
  assert.doesNotMatch(M.exportSavedWork(migrated,0),/근거 확인 일치|점수|실습 완료/);
  assert.deepEqual(M.restore(JSON.stringify(migrated),engine,M.SCOPE,temper),migrated,'second restore is idempotent');
  assert.equal(migrated.profile.values.support,undefined);
  assert.notEqual(migrated.settings.support,oldProfile.values.support,'forgotten setting uses a display default without provenance');
  let next=M.startRun(migrated,{...settings,support:'step'},engine,at(20));
  assert.equal(M.practiceHistoryUsed(next),false);assert.deepEqual(M.practiceObservations(next),[]);
  assert.ok(next.events.every(e=>!oldIds.has(e.id)));
  next=M.completeRun(fill(M.recordPracticeExposure(next,at(21))),engine,at(22));
  assert.equal(next.run.step,'result');assert.equal(next.history.length,3);
  assert.ok(M.practiceEvaluation(next,temper,at(86423)).byPolicy.some(row=>row.counts.observed===1));
  const writes=[];assert.equal(M.persist({setItem:(key,value)=>writes.push([key,value])},next).saved,true);
  assert.deepEqual(M.restore(writes[0][1],engine,M.SCOPE,temper),next);
});

test('ordinary profile revisions keep current generation records and ongoing drafts',()=>{
  const s=fixture();s.profile=engine.updateProfile(s.profile,{values:{minutes:15}},at(10));
  const restored=M.restore(JSON.stringify(s),engine,M.SCOPE,temper);
  assert.deepEqual(restored,s);assert.ok(M.practiceObservations(restored).length);
  assert.ok(restored.history.every(h=>h.kind!=='saved-work'));assert.equal(restored.run.draft,draft);
});

test('retired audio/experience settings migrate on restore and direct next start',()=>{
  const s=fixture();s.profile=engine.updateProfile(s.profile,{values:{audio:'off',experience:'familiar'}},at(10));
  for(const migrated of [M.restore(JSON.stringify(s),engine,M.SCOPE,temper),M.startRun(s,settings,engine,at(20))]){
    assert.equal(migrated.profile.values.audio,undefined);assert.equal(migrated.profile.values.experience,undefined);
    assert.equal(migrated.history.filter(h=>h.kind==='saved-work').length,2);
    assert.deepEqual(M.practiceObservations(migrated),[]);
    const again=M.restore(JSON.stringify(migrated),engine,M.SCOPE,temper);assert.deepEqual(again,migrated);
  }
});

test('migration validates old records before dropping analysis, including while consent is disabled',()=>{
  const edits=[
    s=>{s.events[0].scope.subject='foreign';},
    s=>{s.events[0].scope.workspace='p.shift:c.other:g.1';},
    s=>{s.events[0].scope.workspace='p.shift:c.workbench:g.99';},
    s=>{s.evaluation.outcomes[0].scope.purpose='foreign';},
    s=>{s.evaluation.outcomes[0].contract.version='2';},
    s=>{s.evaluation.outcomes[0].value=0;},
    s=>{s.evaluation.outcomes[0].at=at(0);},
    s=>{s.evaluation.revisions=[];},
    s=>{s.history[0].correct=0;},
    s=>{s.history[0].decisionId='made-up';},
    s=>{s.run.focusDecision.scope.subject='foreign';},
    s=>{s.run.checkIds=['unknown'];}
  ];
  for(const change of [changes.disable,changes.forget])for(const edit of edits){
    const s=fixture();s.profile=change(s.profile);edit(s);
    assert.throws(()=>M.restore(JSON.stringify(s),engine,M.SCOPE,temper),String(edit));
  }
});

test('saved work stays outside analytics and cannot import foreign ownership or analysis fields',()=>{
  const scope={personId:'company-a',productId:'company',contextId:'workroom-practice',domain:'SHIFT'};
  const s=fixture(scope);s.profile=changes.forget(s.profile);
  const migrated=M.restore(JSON.stringify(s),engine,scope,temper);
  assert.throws(()=>M.restore(JSON.stringify(migrated),engine,{...scope,personId:'company-b'},temper),/다른 실습/);
  for(const edit of [h=>{h.scope.personId='company-b';},h=>{h.correct=3;},h=>{h.sourceGeneration=migrated.profile.generation;},h=>{h.draft='x'.repeat(10001);}]){
    const corrupt=structuredClone(migrated);edit(corrupt.history[0]);
    assert.throws(()=>M.restore(JSON.stringify(corrupt),engine,scope,temper));
  }
  assert.deepEqual(M.practiceObservations(migrated,scope),[]);
  assert.equal(M.practiceHistoryUsed(migrated),false);
});

test('save opt-in and write failures remain independent of profile migration',()=>{
  const s=fixture();s.profile=changes.disable(s.profile);let writes=0;
  s.save=false;assert.equal(M.persist({setItem(){writes++;}},s).saved,false);assert.equal(writes,0);
  s.save=true;assert.equal(M.persist({setItem(){throw Error('quota');}},s).ok,false);
  assert.equal(M.newState().history.length,0);
});

test('a stale in-progress run cannot become a new-generation completion or feedback',()=>{
  const s=fill(fixture());s.profile=changes.forget(s.profile);
  assert.throws(()=>M.completeRun(s,engine,at(20)),/조건이 변경/);
  assert.throws(()=>M.giveFeedback(s,'helpful',engine,at(20)),/완료한 실습/);
  const reconciled=M.reconcileRecords(s,M.SCOPE,at(20));assert.equal(reconciled.history.at(-1).draft,draft);
  assert.equal(reconciled.run,null);
});

test('a later exclusion does not invalidate an earlier evaluation date',()=>{
  let s=M.startRun(M.newState(),settings,engine,at(0));
  s=M.completeRun(fill(M.recordPracticeExposure(s,at(1))),engine,at(2));
  const session=core.createSession({scope:engine.coreScope(s.profile),events:s.events,clock:()=>at(90000),id:()=> 'later-exclusion'});
  session.exclude(s.run.completionId);s.events=session.events();
  const earlier=M.practiceEvaluation(s,temper,at(86402));
  assert.equal(earlier.byPolicy[0].counts.observed,1);assert.equal(earlier.byPolicy[0].mean,1);
  assert.equal(M.practiceEvaluation(s,temper,at(90001)).provenance.chains[0].status,'withdrawn');
});

test('direct next start cannot sanitize malformed old exposure or foreign cached recommendation',()=>{
  for(const edit of [s=>{s.evaluation.exposures[0].candidateId='made-up';},s=>{s.run.focusDecision.scope.subject='foreign';}]){
    const s=fixture();s.profile=changes.forget(s.profile);edit(s);const before=structuredClone(s);
    assert.throws(()=>M.startRun(s,settings,engine,at(20)));
    assert.deepEqual(s,before);
  }
});
