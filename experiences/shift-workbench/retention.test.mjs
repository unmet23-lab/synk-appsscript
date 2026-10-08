import test from 'node:test';
import assert from 'node:assert/strict';
import engine from '../../atlas/personalization.js';
import core from '../../atlas/engine.js';
import temper from '../../atlas/temper-outcomes.js';
import * as M from './model.mjs';

const base=Date.parse('2026-10-02T00:00:00.000Z');
const at=n=>new Date(base+n*1000).toISOString();
const settings=task=>({task,goal:'work',minutes:10,support:'step'});
function begin(state,task,n,shown=true){
  const started=M.startRun(state,settings(task),engine,at(n));
  return shown?M.recordPracticeExposure(started,at(n+1)):started;
}
function finish(state,n){
  const task=M.TASKS[state.run.task];
  state.run.prompt=task.template;
  state.run.draft='제공된 자료의 기한, 대상, 비용을 대조하고 확인하지 못한 내용은 분리하여 직접 작성한 결과입니다.';
  state.run.reviewed=true;
  for(const id of state.run.checkIds){const check=task.checks.find(row=>row.id===id);state.run.answers[id]={kind:check.answer,source:check.source};}
  state.run.result=M.evaluate(state.run);
  return M.completeRun(state,engine,at(n));
}
function exclude(state,target,n){
  const session=core.createSession({scope:engine.coreScope(state.profile),events:state.events,clock:()=>at(n),id:()=>`retention-exclusion-${n}`});
  session.exclude(target);return {...state,events:session.events()};
}
function roundtrip(state){return M.restore(JSON.stringify({...state,save:true}),engine,M.SCOPE,temper);}
function expectedChains(attempts){
  const retained=attempts.slice(-20);
  return {decisions:retained.map(row=>row.id),exposures:retained.filter(row=>row.shown).map(row=>`seen.${row.id}`),outcomes:retained.filter(row=>row.completed&&row.shown).map(row=>`result.${row.id}`)};
}

test('completed, abandoned and undelivered attempts share the same last-20 decision cohort',()=>{
  let state=M.newState();const attempts=[];
  for(let i=0;i<36;i++){
    const shown=i%3!==2,completed=i%3===0;
    state=begin(state,'meeting',i*10,shown);
    attempts.push({id:state.run.reviewDecisionId,shown,completed});
    if(completed)state=finish(state,i*10+2);
    const expected=expectedChains(attempts);
    for(const key of Object.keys(expected))assert.deepEqual(state.evaluation[key].map(row=>row.id),expected[key],`${key} after attempt ${i+1}`);
  }
  const expected=attempts.slice(-20),report=M.practiceEvaluation(state,temper,at(172800)),baseline=report.byPolicy.find(row=>row.policy.id==='fixed-check-order');
  assert.equal(baseline.counts.decisions,20);
  assert.equal(baseline.counts.observed,expected.filter(row=>row.completed&&row.shown).length);
  assert.equal(baseline.counts.missing,expected.filter(row=>!row.completed&&row.shown).length);
  assert.equal(baseline.counts.undelivered,expected.filter(row=>!row.shown).length);
  assert.equal(baseline.measurementCompletion,baseline.counts.observed/(baseline.counts.observed+baseline.counts.missing));
  assert.equal(baseline.mean,1,'abandonment is an absent outcome, never a fabricated failure');
  assert.equal(report.causalClaim,false);assert.equal(report.policyPromotion,false);
});

test('authored completion history survives outside the evaluation cohort without biasing its denominator',()=>{
  let state=M.newState();
  for(let i=0;i<12;i++)state=finish(begin(state,'meeting',i*10),i*10+2);
  const completedIds=state.history.map(row=>row.completionId);
  for(let i=12;i<37;i++)state=begin(state,'meeting',i*10);
  assert.deepEqual(state.history.map(row=>row.completionId),completedIds);
  assert.equal(state.evaluation.decisions.length,20);assert.equal(state.evaluation.exposures.length,20);assert.equal(state.evaluation.outcomes.length,0);
  const row=M.practiceEvaluation(state,temper,at(172800)).byPolicy.find(row=>row.policy.id==='fixed-check-order');
  assert.equal(row.counts.missing,20);assert.equal(row.counts.observed,0);assert.equal(row.mean,null);
  const restored=roundtrip(state);assert.deepEqual(restored.history,state.history);assert.deepEqual(restored.evaluation,state.evaluation);
});

test('mixed attempts retain their full chains through repeated save and restore',()=>{
  let state=M.newState();const attempts=[];
  for(let i=0;i<27;i++){
    const shown=i%4!==3,completed=i%4===0||i%4===1;
    state=begin(state,'meeting',i*10,shown);
    attempts.push({id:state.run.reviewDecisionId,shown,completed});
    if(completed)state=finish(state,i*10+2);
    state=roundtrip(state);
    const expected=expectedChains(attempts);
    for(const key of Object.keys(expected))assert.deepEqual(state.evaluation[key].map(row=>row.id),expected[key]);
    assert.deepEqual(roundtrip(state),state,'restoring an already migrated state is stable');
  }
});

test('a displayed abandoned practice stays experienced after its evaluation chain ages out',()=>{
  let state=begin(M.newState(),'research',0),oldId=state.run.reviewDecisionId;
  for(let i=1;i<=22;i++)state=begin(state,'meeting',i*10,false);
  assert.equal(state.evaluation.decisions.length,20);
  assert.ok(!state.evaluation.decisions.some(row=>row.id===oldId));
  assert.deepEqual(M.nextTaskSuggestion(state,at(230)),{task:'planning',focus:null});
  assert.match(M.nextTaskReason(state,at(230)),/아직 경험한 이력이 없는/);
  assert.deepEqual(M.nextTaskSuggestion(roundtrip(state),at(230)),{task:'planning',focus:null});
});

test('two displayed practices retain their real least-recent order outside the evaluation window',()=>{
  let state=begin(M.newState(),'research',0);
  state=begin(state,'planning',10);
  for(let i=2;i<=23;i++)state=begin(state,'meeting',i*10,false);
  assert.equal(state.evaluation.exposures.length,0);
  assert.deepEqual(M.nextTaskSuggestion(state,at(240)),{task:'research',focus:null});
  assert.match(M.nextTaskReason(state,at(240)),/가장 오래전에 경험한/);
  assert.deepEqual(M.nextTaskSuggestion(roundtrip(state),at(240)),{task:'research',focus:null});
});

test('starting without display never becomes an experienced practice after retention',()=>{
  let state=begin(M.newState(),'research',0,false);
  state=begin(state,'planning',10,true);
  for(let i=2;i<=23;i++)state=begin(state,'meeting',i*10,false);
  assert.deepEqual(M.nextTaskSuggestion(state,at(240)),{task:'research',focus:null});
  assert.match(M.nextTaskReason(state,at(240)),/아직 경험한 이력이 없는/);
});

test('excluding a displayed decision removes its retained experience even after evaluation eviction',()=>{
  let state=begin(M.newState(),'research',0),decisionId=state.run.decisionId;
  for(let i=1;i<=22;i++)state=begin(state,'meeting',i*10,false);
  state=exclude(state,decisionId,225);
  assert.deepEqual(M.nextTaskSuggestion(state,at(230)),{task:'research',focus:null});
  assert.match(M.nextTaskReason(state,at(230)),/아직 경험한 이력이 없는/);
  assert.deepEqual(M.nextTaskSuggestion(roundtrip(state),at(230)),{task:'research',focus:null});
});

test('a new personalization generation cannot reuse the previous exposure diary',()=>{
  let state=begin(M.newState(),'research',0);
  for(let i=1;i<=22;i++)state=begin(state,'meeting',i*10,false);
  state.profile=engine.clearProfile(state.profile,{mode:'delete',at:at(225)});
  state=begin(state,'meeting',230,false);
  assert.equal(state.evaluation.decisions.length,1);assert.equal(state.evaluation.exposures.length,0);
  assert.deepEqual(M.nextTaskSuggestion(state,at(240)),{task:'research',focus:null});
  assert.match(M.nextTaskReason(state,at(240)),/아직 경험한 이력이 없는/);
});

test('a legacy cohort missing completed chains resets the analytical window without inventing outcomes',()=>{
  let state=M.newState();state.save=true;
  for(let i=0;i<6;i++)state=finish(begin(state,'meeting',i*10),i*10+2);
  for(let i=6;i<14;i++)state=begin(state,'research',i*10,true);
  delete state.retention;delete state.visits;
  const missing=state.evaluation.decisions[1].id;
  state.evaluation.decisions=state.evaluation.decisions.filter(d=>d.id!==missing);
  state.evaluation.exposures=state.evaluation.exposures.filter(e=>e.decisionId!==missing);
  state.evaluation.outcomes=state.evaluation.outcomes.filter(o=>o.id!==`result.${missing}`);
  const before=structuredClone(state),restored=roundtrip(state);
  assert.deepEqual(state,before);assert.deepEqual(restored.history,state.history);
  assert.equal(restored.retention.resetReason,'legacy-incomplete');assert.equal(restored.evaluation.decisions.length,0);
  assert.equal(restored.visits.length,2);assert.match(M.storageRecoveryNotice(restored),/新|새 실습/);
  const report=M.practiceEvaluation(state,temper,new Date().toISOString());
  assert.equal(report.coverage.resetReason,'legacy-incomplete');assert.ok(report.byPolicy.every(r=>r.counts.decisions===0));
  assert.deepEqual(roundtrip(restored),restored);
  const next=M.startRun(restored,settings('meeting'),engine,new Date(Date.now()+1000).toISOString());
  assert.equal(next.evaluation.decisions.length,1);assert.equal(next.history.length,6);
});

test('decision chronology controls the cohort even when serialized arrays are shuffled',()=>{
  let state=M.newState();
  for(let i=0;i<23;i++)state=begin(state,'meeting',i*10,i%2===0);
  const before=M.practiceEvaluation(state,temper,at(172800));
  state.evaluation.decisions.reverse();state.evaluation.exposures.reverse();
  const after=M.practiceEvaluation(state,temper,at(172800));
  assert.deepEqual(after.byPolicy,before.byPolicy);assert.deepEqual(after.coverage,before.coverage);
});

test('retained visit ownership and time cannot be forged during a storage roundtrip',()=>{
  for(const edit of [s=>{s.visits[0].scope.subject='foreign';},s=>{s.visits[0].decisionId='made-up';},s=>{s.visits[0].at=at(-1);},s=>{s.visits[0].recordedAt=new Date(Date.now()+86400000).toISOString();}]){
    const state=begin(M.newState(),'research',0);edit(state);assert.throws(()=>roundtrip(state));
  }
});
