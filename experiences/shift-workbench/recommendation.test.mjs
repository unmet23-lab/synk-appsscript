import test from 'node:test';
import assert from 'node:assert/strict';
import engine from '../../atlas/personalization.js';
import core from '../../atlas/engine.js';
import temper from '../../atlas/temper-outcomes.js';
import {
  TASKS,SCOPE,newState,startRun,evaluate,completeRun,recordPracticeExposure,
  practiceObservations,practiceReason,practiceBasis,decisionEvidence,
  nextTaskSuggestion,practiceEvaluation,restore
} from './model.mjs';

const base=Date.parse('2026-10-02T00:00:00.000Z');
const minute=60000,day=86400000;
const at=n=>new Date(base+n*minute).toISOString();
const settings=task=>({task,goal:'work',minutes:10,support:'step'});
const field=(state,id)=>state.run.focusDecision.understanding.fields.find(row=>row.id===id);
function begin(state,task,n,{shown=true}={}){
  const next=startRun(state,settings(task),engine,at(n));
  return shown?recordPracticeExposure(next,at(n)):next;
}
function finish(state,wrongIds,n){
  const task=TASKS[state.run.task];
  state.run.prompt=task.template;
  for(const id of state.run.checkIds){
    const check=task.checks.find(row=>row.id===id);
    state.run.answers[id]={kind:wrongIds.includes(id)?(check.answer==='match'?'wrong':'match'):check.answer,source:check.source};
  }
  state.run.result=evaluate(state.run);
  state.run.draft='제공 자료의 기한과 승인 여부를 대조하고, 알려지지 않은 효과와 확인해야 할 항목을 구분한 직접 수정 결과입니다.';
  state.run.reviewed=true;
  return completeRun(state,engine,at(n));
}
const practice=(state,task,wrongIds,n,options)=>finish(begin(state,task,n,options),wrongIds,n+0.5);
function exclude(state,target,n){
  const session=core.createSession({scope:engine.coreScope(state.profile),events:state.events,clock:()=>at(n),id:()=>`recommendation-exclusion-${n}`});
  session.exclude(target);
  return {...state,events:session.events()};
}

test('repeating one fixed question does not create independent evidence each time',()=>{
  let state=newState();
  for(let i=0;i<5;i++)state=practice(state,'meeting',['approval'],i*2);
  state=begin(state,'planning',12);
  const observed=practiceObservations(state,SCOPE,at(12)).filter(row=>row.field==='evidence');
  assert.equal(new Set(observed.map(row=>row.independentKey)).size,1);
  assert.equal(field(state,'evidence').independent,1);
  assert.equal(field(state,'evidence').value,'incorrect');
});

test('a recent unresolved miss is reviewed even when independent questions mostly succeeded',()=>{
  let state=practice(newState(),'meeting',[],0);
  state=practice(state,'planning',[],2);
  state=practice(state,'research',[],4);
  state=practice(state,'meeting',['approval'],6);
  const missedCompletion=state.run.completionId;
  assert.equal(nextTaskSuggestion(state,at(7)).focus,'evidence');
  state=begin(state,'research',8);
  const aggregate=field(state,'evidence');
  assert.equal(aggregate.status,'supported');
  assert.equal(aggregate.value,'correct');
  assert.equal(aggregate.independent,4);
  assert.equal(state.run.focusDecision.practicePlan.focus,'evidence');
  assert.equal(TASKS.research.checks.find(row=>row.id===state.run.checkIds[0]).focus,'evidence');
  const evidence=decisionEvidence(state,state.run.focusDecision,at(8));
  assert.ok(evidence.some(row=>row.id.startsWith(missedCompletion)&&row.task==='meeting'&&row.correct===false));
  assert.match(practiceReason(state,at(8)),/주장과 근거/);
  assert.match(practiceBasis(state,at(8)).join(' '),/회의를 실행으로/);
});

test('another question succeeding leaves the actual missed question unresolved without declaring a general weakness',()=>{
  let state=practice(newState(),'meeting',['missing'],0);
  state=practice(state,'planning',[],2);
  state=begin(state,'meeting',4);
  assert.equal(field(state,'completeness').status,'conflicted');
  assert.equal(field(state,'completeness').usable,false);
  assert.equal(state.run.checkIds[0],'missing');
  assert.equal(state.run.focusDecision.practicePlan.focus,'completeness');
  assert.doesNotMatch(practiceBasis(state,at(4)).join(' '),/결과가 엇갈려 순서에 반영하지 않았어요/);
});

test('a later correct review of the same question clears its old miss',()=>{
  let state=practice(newState(),'meeting',['approval'],0);
  state=practice(state,'meeting',[],2);
  assert.equal(nextTaskSuggestion(state,at(3)).focus,null);
  state=begin(state,'meeting',4);
  assert.equal(state.run.focusDecision.practicePlan.focus,null);
  assert.equal(state.run.checkIds[0],'deadline');
  assert.doesNotMatch(practiceReason(state,at(4)),/지난 실습의/);
  assert.equal(field(state,'evidence').independent,1);
  assert.equal(field(state,'evidence').value,'correct');
});

test('the first displayed check, product plan, exposure and evaluation all agree',()=>{
  let state=practice(newState(),'meeting',['approval'],0);
  state=begin(state,'research',2);
  const first=state.run.checkIds[0];
  assert.equal(state.run.focusDecision.practicePlan.selectedId,first);
  assert.equal(state.evaluation.decisions.at(-1).selectedId,first);
  assert.equal(state.evaluation.exposures.at(-1).candidateId,first);
  assert.equal(TASKS.research.checks.find(row=>row.id===first).focus,'evidence');
  assert.deepEqual(state.evaluation.decisions.at(-1).policy,{id:'evidence-check-order',version:'2'});
});

test('a suggested focus agrees with the first check of the suggested practice',()=>{
  let state=practice(newState(),'planning',['audience','budget'],0);
  const suggestion=nextTaskSuggestion(state,at(1));
  assert.ok(suggestion.focus);
  state=begin(state,suggestion.task,2);
  assert.equal(TASKS[suggestion.task].checks.find(row=>row.id===state.run.checkIds[0]).focus,suggestion.focus);
});

test('an unseen equally suitable task wins over a completed task, regardless of its name',()=>{
  let state=practice(newState(),'planning',[],0);
  state=practice(state,'meeting',['approval'],2);
  assert.deepEqual(nextTaskSuggestion(state,at(3)),{task:'research',focus:'evidence'});
  assert.equal(state.run.nextDecision.practicePlan.selectedId,'research');
});

test('when every suitable task has been seen, the least recent one wins a tie',()=>{
  let state=practice(newState(),'research',[],0);
  state=practice(state,'planning',[],2);
  state=practice(state,'meeting',['approval'],4);
  assert.deepEqual(nextTaskSuggestion(state,at(5)),{task:'research',focus:'evidence'});
});

test('an unshown planned task is still unseen, while an abandoned displayed task has been seen',()=>{
  let state=practice(newState(),'meeting',[],0);
  const unshown=begin(state,'research',2,{shown:false});
  const planned=practice(unshown,'meeting',[],4);
  assert.deepEqual(nextTaskSuggestion(planned,at(5)),{task:'research',focus:null});
  const shown=begin(state,'research',2);
  const delivered=practice(shown,'meeting',[],4);
  assert.deepEqual(nextTaskSuggestion(delivered,at(5)),{task:'planning',focus:null});
});

test('tie diversity does not replace the only task that contains the unresolved focus',()=>{
  let state=practice(newState(),'planning',[],0);
  state=practice(state,'meeting',['missing'],2);
  // Research is unseen, but it has no completeness check.
  assert.deepEqual(nextTaskSuggestion(state,at(3)),{task:'planning',focus:'completeness'});
});

test('excluded current evidence disappears from the cached recommendation and its explanation',()=>{
  let state=practice(newState(),'meeting',['approval'],0);
  const completionId=state.run.completionId;
  state=begin(state,'research',2);
  const previous=structuredClone(state.run.focusDecision);
  assert.ok(decisionEvidence(state,previous,at(2)).length);
  state=exclude(state,completionId,3);
  assert.deepEqual(decisionEvidence(state,previous,at(3)),[]);
  assert.doesNotMatch(practiceReason(state,at(3)),/지난 실습의/);
  state=begin(state,'meeting',4);
  assert.equal(state.run.focusDecision.practicePlan.focus,null);
});

test('excluding the newest correction does not revive an older miss of the same question',()=>{
  let state=practice(newState(),'meeting',['approval'],0);
  state=practice(state,'meeting',[],2);
  state=exclude(state,state.run.completionId,3);
  state=begin(state,'meeting',4);
  assert.equal(state.run.focusDecision.practicePlan.focus,null);
  assert.equal(state.run.checkIds[0],'deadline');
});

test('old focus-only summaries do not become additional independent questions after detailed review',()=>{
  let state=practice(newState(),'meeting',['approval'],0);
  delete state.history[0].review;
  state=practice(state,'meeting',['approval'],2);
  state=begin(state,'planning',4);
  assert.equal(field(state,'evidence').independent,1);
});

test('cached recommendations and visible explanations stop using evidence after thirty days',()=>{
  let state=practice(newState(),'meeting',['missing'],0);
  const expired=new Date(base+31*day).toISOString();
  assert.equal(nextTaskSuggestion(state,expired).focus,null);
  state=begin(state,'planning',2);
  assert.match(practiceReason(state,at(2)),/누락/);
  assert.deepEqual(decisionEvidence(state,state.run.focusDecision,expired),[]);
  assert.doesNotMatch(practiceReason(state,expired),/지난 실습의/);
  assert.ok(practiceBasis(state,expired).every(line=>!line.includes('회의를 실행으로')));
});

test('the exact thirty-day boundary expires both Domain evidence and the product review priority',()=>{
  const state=practice(newState(),'meeting',['approval'],0);
  const expires=Date.parse(state.history[0].at)+30*day;
  const before=new Date(expires-1).toISOString(),boundary=new Date(expires).toISOString();
  assert.equal(nextTaskSuggestion(state,before).focus,'evidence');
  assert.equal(nextTaskSuggestion(state,boundary).focus,null);
  const prepared=begin(state,'research',2);
  assert.match(practiceReason(prepared,before),/지난 실습의/);
  assert.doesNotMatch(practiceReason(prepared,boundary),/지난 실습의/);
  assert.deepEqual(decisionEvidence(prepared,prepared.run.focusDecision,boundary),[]);
  const started=startRun(state,settings('research'),engine,boundary);
  assert.equal(field(started,'evidence').status,'expired');
  assert.equal(started.run.focusDecision.practicePlan.focus,null);
});

test('legacy evidence-policy records restore unchanged and stay outside the new policy result',()=>{
  let state=practice(newState(),'meeting',['approval'],0);
  state=practice(state,'research',[],2);
  const legacyId=state.evaluation.decisions.at(-1).id;
  state.evaluation.decisions.at(-1).policy={id:'evidence-check-order',version:'1'};
  delete state.run.focusDecision.practicePlan;
  delete state.run.nextDecision.practicePlan;
  state.save=true;
  state=restore(JSON.stringify(state),engine,SCOPE,temper);
  assert.deepEqual(state.evaluation.decisions.find(row=>row.id===legacyId).policy,{id:'evidence-check-order',version:'1'});
  state=practice(state,'planning',[],4);
  const report=practiceEvaluation(state,temper,'2026-10-04T00:00:00.000Z');
  const current=report.byPolicy.find(row=>row.policy.id==='evidence-check-order');
  assert.equal(current.policy.version,'2');
  assert.equal(current.counts.decisions,1);
  assert.equal(current.counts.observed,1);
  assert.equal(report.causalClaim,false);
});

test('a stored product plan cannot name a nonexistent task or check',()=>{
  const completed=practice(newState(),'meeting',['approval'],0);completed.save=true;
  const task=structuredClone(completed);task.run.nextDecision.practicePlan.selectedId='not-a-task';
  assert.throws(()=>restore(JSON.stringify(task),engine,SCOPE,temper));
  const running=begin(completed,'research',2);running.save=true;
  running.run.focusDecision.practicePlan.selectedId='not-a-check';
  assert.throws(()=>restore(JSON.stringify(running),engine,SCOPE,temper));
});

test('a cached explanation cannot use a correct answer or a different focus as its missed-question proof',()=>{
  let state=practice(newState(),'planning',[],-2);
  state=practice(state,'meeting',['approval'],0);
  state=begin(state,'research',2);
  state.save=true;
  const differentFocus=structuredClone(state);
  differentFocus.run.focusDecision.practicePlan.focus='numbers';
  assert.deepEqual(decisionEvidence(differentFocus,differentFocus.run.focusDecision,at(2)),[]);
  assert.doesNotMatch(practiceReason(differentFocus,at(2)),/지난 실습의/);
  assert.throws(()=>restore(JSON.stringify(differentFocus),engine,SCOPE,temper),/추천 근거|완료 근거/);
  const correctAnswer=structuredClone(state);
  const observed=practiceObservations(state,SCOPE,at(2)).find(row=>row.value==='correct'&&row.field==='evidence');
  correctAnswer.run.focusDecision.practicePlan.evidence=[observed.id];
  correctAnswer.run.focusDecision.practicePlan.focus=observed.field;
  assert.deepEqual(decisionEvidence(correctAnswer,correctAnswer.run.focusDecision,at(2)),[]);
  assert.throws(()=>restore(JSON.stringify(correctAnswer),engine,SCOPE,temper),/추천 근거|완료 근거/);
});

test('a structurally valid saved plan must still match the actual first check and evaluation policy',()=>{
  const completed=practice(newState(),'meeting',['approval'],0);
  const running=begin(completed,'research',2);running.save=true;
  const wrongFirst=structuredClone(running);
  wrongFirst.run.focusDecision.practicePlan.selectedId=wrongFirst.run.checkIds[1];
  assert.throws(()=>restore(JSON.stringify(wrongFirst),engine,SCOPE,temper));
  const wrongPolicy=structuredClone(running);
  wrongPolicy.evaluation.decisions.at(-1).policy={id:'fixed-check-order',version:'1'};
  assert.throws(()=>restore(JSON.stringify(wrongPolicy),engine,SCOPE,temper));
});

for(const kind of ['order','count'])test(`an in-progress saved practice rejects a changed check ${kind}`,()=>{
  const completed=practice(newState(),'meeting',['approval'],0);
  const running=begin(completed,'research',2);running.save=true;
  if(kind==='order')[running.run.checkIds[1],running.run.checkIds[2]]=[running.run.checkIds[2],running.run.checkIds[1]];
  else running.run.checkIds=running.run.checkIds.slice(0,1);
  assert.throws(()=>restore(JSON.stringify(running),engine,SCOPE,temper),/추천 근거|완료 근거/);
});

test('a later exclusion does not erase review evidence from an earlier asOf reading',()=>{
  let state=practice(newState(),'meeting',['approval'],0);
  const missed=state.run.completionId;
  state=begin(state,'research',2);
  state=exclude(state,missed,8);
  assert.ok(decisionEvidence(state,state.run.focusDecision,at(3)).some(row=>row.id.startsWith(missed)));
  assert.match(practiceReason(state,at(3)),/지난 실습의/);
  assert.deepEqual(decisionEvidence(state,state.run.focusDecision,at(9)),[]);
});

test('a later decision exclusion changes seen-task tie breaking only from that time onward',()=>{
  let state=begin(newState(),'research',0);
  const researchDecision=state.run.decisionId;
  state=practice(state,'meeting',[],2);
  state=exclude(state,researchDecision,8);
  assert.deepEqual(nextTaskSuggestion(state,at(3)),{task:'planning',focus:null});
  assert.deepEqual(nextTaskSuggestion(state,at(9)),{task:'research',focus:null});
});
