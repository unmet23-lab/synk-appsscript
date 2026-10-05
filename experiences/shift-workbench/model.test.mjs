import test from 'node:test';
import assert from 'node:assert/strict';
import engine from '../../atlas/personalization.js';
import core from '../../atlas/engine.js';
import temper from '../../atlas/temper-outcomes.js';
import {TASKS,STORAGE_KEY,SCOPE,practiceObservations,decisionEvidence,practiceBasis,practiceReason,recordPracticeExposure,practiceEvaluation,newState,startRun,nextTaskSuggestion,evaluate,completeRun,giveFeedback,restore,persist,exportText,escapeHTML} from './model.mjs';
const at='2026-10-02T00:00:00.000Z',later='2026-10-02T00:00:01.000Z';
const start=(settings={})=>startRun(newState(),{task:'meeting',goal:'clarity',minutes:5,support:'step',...settings},engine,at);
const filled=()=>{const state=start();state.run.prompt=TASKS.meeting.template;for(const id of state.run.checkIds){const c=TASKS.meeting.checks.find(c=>c.id===id);state.run.answers[id]={kind:c.answer,source:c.source};}state.run.result=evaluate(state.run);state.run.draft='지안은 10월 8일까지 안내 초안을 작성합니다. 다국어 예산 80만 원은 승인 대기입니다. 도윤은 10월 6일까지 접근성 검토 항목을 전달합니다.';state.run.reviewed=true;return state;};
test('Core limits a short session and only receives actual declared settings',()=>{const s=start();assert.equal(s.run.checkIds.length,2);assert.equal(s.run.support,'step');assert.match(s.run.reason,/5분/);assert.ok(s.events.some(e=>e.type==='decision.made'));assert.equal(s.profile.scope.domain,'SHIFT');assert.deepEqual(Object.keys(s.profile.values).sort(),['goal','minutes','support']);assert.equal(s.profile.provenance.experience,undefined);assert.equal(s.profile.provenance.audio,undefined);});
test('different purpose and time change the actual practice scope',()=>{const s=start({task:'planning',goal:'work',minutes:10,support:'independent'});assert.equal(s.run.variant,'full');assert.equal(s.run.checkIds.length,3);assert.equal(s.run.support,'independent');});
test('more-practice feedback selects a deeper feasible practice, without forcing it just because time is available',()=>{let s=start({goal:'prepare',minutes:15});assert.equal(s.run.variant,'full');s=completeRun(filled(),engine,later);s=giveFeedback(s,'want_more',engine,'2026-10-02T00:00:02.000Z');s=startRun(s,{task:'meeting',goal:'prepare',minutes:15,support:'step'},engine,'2026-10-02T00:00:03.000Z');assert.equal(s.run.variant,'deep');assert.equal(s.run.goal,'prepare');});
test('wrong source is not credited even when the judgment matches',()=>{const s=filled();s.run.answers.deadline.source='M2';const result=evaluate(s.run);assert.equal(result[0].correct,false);assert.equal(result[1].correct,true);});
test('incomplete answers cannot complete the practice',()=>{const s=filled();delete s.run.answers.approval;assert.throws(()=>completeRun(s,engine,later),/모든 항목/);});
test('unchanged sample and unconfirmed edits cannot masquerade as completion',()=>{const s=filled();s.run.draft=TASKS.meeting.sample;assert.throws(()=>completeRun(s,engine,later),/직접 수정/);s.run.draft='직접 수정한 내용으로 충분히 길게 작성된 검토 결과입니다. 원문과 비교합니다.';s.run.reviewed=false;assert.throws(()=>completeRun(s,engine,later),/직접 읽고/);});
test('completion and explicit feedback use existing Core events exactly once',()=>{let s=completeRun(filled(),engine,later);assert.equal(s.history.length,1);assert.equal(s.history[0].correct,2);assert.equal(s.run.step,'result');assert.ok(s.events.find(e=>e.type==='experience.completed'));s=giveFeedback(s,'too_much',engine,'2026-10-02T00:00:02.000Z');assert.ok(s.events.find(e=>e.type==='feedback.given'));assert.throws(()=>giveFeedback(s,'helpful',engine,'2026-10-02T00:00:03.000Z'),/한 번/);});
test('missed evidence controls the next check order without declaring an ability',()=>{let s=filled();s.run.answers.approval.kind='match';s.run.result=evaluate(s.run);s=completeRun(s,engine,later);s=startRun(s,{task:'meeting',goal:'clarity',minutes:5,support:'step'},engine,'2026-10-02T00:00:02.000Z');assert.equal(s.run.checkIds[0],'approval');assert.match(s.run.reason,/주장과 근거/);});
test('a missed completeness check suggests a matching new task but never claims an absent focus in an explicitly chosen task',()=>{
  let s=start({goal:'work',minutes:10});s.run.prompt=TASKS.meeting.template;s.run.draft=filled().run.draft;s.run.reviewed=true;
  for(const c of TASKS.meeting.checks)s.run.answers[c.id]={kind:c.id==='missing'?'match':c.answer,source:c.source};
  s.run.result=evaluate(s.run);s=completeRun(s,engine,later);
  assert.deepEqual(s.history[0].missed,['completeness']);assert.deepEqual(nextTaskSuggestion(s),{task:'planning',focus:'completeness'});
  const explicit=startRun(s,{task:'research',goal:'work',minutes:10,support:'step'},engine,'2026-10-02T00:00:02.000Z');
  assert.equal(explicit.run.task,'research');assert.equal(explicit.run.checkIds[0],'ratio');assert.doesNotMatch(explicit.run.reason,/누락·성공 기준|지난 실습의/);
  const suggested=startRun(s,{task:'planning',goal:'work',minutes:10,support:'step'},engine,'2026-10-02T00:00:02.000Z');
  assert.equal(suggested.run.checkIds[0],'criteria');assert.match(suggested.run.reason,/지난 실습의 누락·성공 기준 확인/);
});
test('storage is opt in, failure is visible, and restart preserves only this scope',()=>{const calls=[],storage={setItem:(...args)=>calls.push(args)};let s=filled();assert.equal(persist(storage,s).saved,false);assert.equal(calls.length,0);s.save=true;assert.equal(persist(storage,s).saved,true);assert.equal(calls[0][0],STORAGE_KEY);assert.deepEqual(restore(calls[0][1],engine,SCOPE,temper).run.checkIds,s.run.checkIds);assert.equal(persist({setItem(){throw Error('quota');}},s).ok,false);const foreign=structuredClone(s);foreign.profile.scope.productId='world';assert.throws(()=>restore(JSON.stringify(foreign),engine),/다른 실습/);});
test('tampered and oversized stored sessions are rejected',()=>{const s=filled();s.save=true;s.run.checkIds=['nonexistent'];assert.throws(()=>restore(JSON.stringify(s),engine),/진행 내용/);assert.throws(()=>restore('x'.repeat(1000001),engine),/읽을 수/);});
test('text output preserves literal user text while HTML rendering escapes it',()=>{const s=filled();s.run.prompt='<img src=x onerror=alert(1)> & example';assert.match(exportText(s),/<img src=x/);assert.equal(escapeHTML(s.run.prompt),'&lt;img src=x onerror=alert(1)&gt; &amp; example');assert.match(exportText(s),/실제 AI 호출·업무 효과 검증 없음/);});
test('company hosts use an explicit member scope for selection, completion, feedback and restore',()=>{
  const scope={personId:'company-member-A',productId:'company',contextId:'workroom-practice',domain:'SHIFT'},other={...scope,personId:'company-member-B'};
  let s=startRun(newState(),{task:'meeting',goal:'clarity',minutes:5,support:'step'},engine,at,scope);
  assert.deepEqual(s.profile.scope,scope);s.run.prompt=TASKS.meeting.template;
  for(const id of s.run.checkIds){const c=TASKS.meeting.checks.find(c=>c.id===id);s.run.answers[id]={kind:c.answer,source:c.source};}
  s.run.result=evaluate(s.run);s.run.draft=filled().run.draft;s.run.reviewed=true;
  assert.throws(()=>completeRun(s,engine,later,other));s=completeRun(s,engine,later,scope);
  s=giveFeedback(s,'helpful',engine,'2026-10-02T00:00:02.000Z',scope);s.save=true;
  assert.deepEqual(restore(JSON.stringify(s),engine,scope,temper).profile.scope,scope);
  assert.throws(()=>restore(JSON.stringify(s),engine,other),/다른 실습/);
  assert.throws(()=>restore(JSON.stringify(s),engine),/다른 실습/);
  const writes=[];persist({setItem:(...args)=>writes.push(args)},s,'synk-workroom:ai-practice:v1:company-member-A');
  assert.equal(writes[0][0],'synk-workroom:ai-practice:v1:company-member-A');
});

function finishPractice(state,task,wrongIds,startedAt,completedAt){
  const s=startRun(state,{task,goal:'work',minutes:10,support:'step'},engine,startedAt);
  s.run.prompt=TASKS[task].template;
  for(const id of s.run.checkIds){const check=TASKS[task].checks.find(c=>c.id===id);s.run.answers[id]={kind:wrongIds.includes(id)?(check.answer==='match'?'wrong':'match'):check.answer,source:check.source};}
  s.run.result=evaluate(s.run);s.run.draft='제공한 자료의 담당과 기한을 대조하고, 승인 여부와 확인해야 할 내용을 직접 고친 충분히 긴 결과입니다.';s.run.reviewed=true;
  return completeRun(s,engine,completedAt);
}
test('unobserved focus survives another successful task and the shown reason refers to its actual completion',()=>{
  let s=finishPractice(newState(),'meeting',['missing'],at,later);const missed=s.run.completionId;
  s=finishPractice(s,'research',[],'2026-10-02T00:01:00.000Z','2026-10-02T00:02:00.000Z');
  assert.equal(nextTaskSuggestion(s).focus,'completeness');assert.notEqual(nextTaskSuggestion(s).task,'research');
  s=startRun(s,{task:'planning',goal:'clarity',minutes:5,support:'step'},engine,'2026-10-02T00:03:00.000Z');
  assert.equal(s.run.checkIds[0],'criteria');assert.equal(s.run.focusDecision.selected.id,'criteria');
  assert.deepEqual(s.run.focusDecision.selected.reasons.find(r=>r.field==='completeness').evidence,[`${missed}.completeness`]);
  assert.equal(decisionEvidence(s,s.run.focusDecision)[0].task,'meeting');
  assert.match(practiceBasis(s)[0],/회의를 실행으로.*누락.*안내 사용/);
  assert.match(s.run.reason,/업무 능력 평가는 아닙니다/);
});
test('conflicting checks stay unresolved rather than becoming a fixed weakness or silently erased',()=>{
  let s=finishPractice(newState(),'meeting',['missing'],at,later);
  s=finishPractice(s,'planning',[],'2026-10-02T00:01:00.000Z','2026-10-02T00:02:00.000Z');
  s=startRun(s,{task:'meeting',goal:'work',minutes:10,support:'step'},engine,'2026-10-02T00:03:00.000Z');
  const field=s.run.focusDecision.understanding.fields.find(f=>f.id==='completeness');
  assert.equal(field.status,'conflicted');assert.equal(field.usable,false);assert.equal(field.evidence.length,2);
  assert.deepEqual(s.run.checkIds,['deadline','approval','missing']);assert.match(practiceBasis(s).join(' '),/결과가 엇갈려/);
});
test('legacy missed summaries do not invent unpresented successes and expire after their declared lifetime',()=>{
  let s=finishPractice(newState(),'meeting',['missing'],at,later);delete s.history[0].review;delete s.history[0].completionId;
  assert.deepEqual(practiceObservations(s).map(o=>[o.field,o.value]),[['completeness','incorrect']]);
  s=startRun(s,{task:'planning',goal:'work',minutes:10,support:'step'},engine,'2026-11-03T00:00:00.000Z');
  assert.equal(s.run.focusDecision.understanding.fields.find(f=>f.id==='completeness').status,'expired');
  assert.deepEqual(s.run.checkIds,['audience','budget','criteria']);assert.doesNotMatch(s.run.reason,/지난 실습의/);
});
test('decision, displayed practice and result are separate; no display or unanswered display is not failure',()=>{
  let s=filled();assert.equal(s.evaluation.decisions.length,1);assert.equal(s.evaluation.exposures.length,0);
  const undelivered=completeRun(s,engine,later);assert.equal(undelivered.evaluation.outcomes.length,0);
  assert.equal(practiceEvaluation(undelivered,temper,'2026-10-03T00:01:00.000Z').byPolicy[0].counts.undelivered,1);
  s=recordPracticeExposure(s,at);s=recordPracticeExposure(s,later);assert.equal(s.evaluation.exposures.length,1);
  const unanswered=practiceEvaluation(s,temper,'2026-10-03T00:01:00.000Z');assert.equal(unanswered.byPolicy[0].counts.missing,1);assert.equal(unanswered.byPolicy[0].mean,null);
  s=completeRun(s,engine,later);const pending=practiceEvaluation(s,temper,later);assert.equal(pending.byPolicy[0].counts.pending,1);
  const report=practiceEvaluation(s,temper,'2026-10-03T00:01:00.000Z');assert.equal(report.byPolicy[0].mean,1);assert.equal(report.byPolicy[0].status,'insufficient_evidence');
  assert.equal(report.comparison.direction,'unknown');assert.equal(report.causalClaim,false);assert.equal(report.policyPromotion,false);
  assert.equal(report.byPolicy[1].counts.decisions,0);assert.equal(report.byPolicy[1].mean,null);
});
test('restoring outcome records rejects another purpose and keeps the declared storage boundary',()=>{
  const s=recordPracticeExposure(filled(),at);s.save=true;
  assert.equal(restore(JSON.stringify(s),engine,SCOPE,temper).evaluation.exposures.length,1);
  s.evaluation.exposures[0].scope.purpose='different-purpose';
  assert.throws(()=>restore(JSON.stringify(s),engine,SCOPE,temper),/outside authorized/);
});
test('restoring a summary verifies its actual completion, decision, task, time and presented checks',()=>{
  const completed=completeRun(recordPracticeExposure(filled(),at),engine,later);completed.save=true;
  assert.equal(restore(JSON.stringify(completed),engine,SCOPE,temper).history[0].correct,2);
  const changedTask=structuredClone(completed);
  Object.assign(changedTask.history[0],{task:'research',review:[{id:'effect',focus:'evidence',correct:false}],correct:0,total:1,missed:['evidence']});
  assert.throws(()=>restore(JSON.stringify(changedTask),engine,SCOPE,temper),/완료 근거/);
  // The original run is no longer current: validation must follow its recorded
  // decision and presentation, not rely solely on the current answer form.
  const following=startRun(completed,{task:'planning',goal:'clarity',minutes:5,support:'step'},engine,'2026-10-02T00:00:02.000Z');
  for(const mutate of [
    h=>{h.task='research';h.review=[{id:'ratio',focus:'numbers',correct:true},{id:'scope',focus:'evidence',correct:true}];},
    h=>{h.decisionId='different-decision';},
    h=>{h.at='2026-10-02T00:00:03.000Z';},
    h=>{h.review[1]={id:'missing',focus:'completeness',correct:true};},
    h=>{h.correct=1;}
  ]){
    const mixed=structuredClone(following);mutate(mixed.history[0]);
    assert.throws(()=>restore(JSON.stringify(mixed),engine,SCOPE,temper),/완료 근거/);
  }
});
test('restoring outcome values and times agrees with the actual completed review',()=>{
  const completed=completeRun(recordPracticeExposure(filled(),at),engine,later);completed.save=true;
  const restored=restore(JSON.stringify(completed),engine,SCOPE,temper);
  assert.equal(practiceEvaluation(restored,temper,'2026-10-03T00:01:00.000Z').byPolicy[0].mean,1);
  for(const mutate of [row=>{row.value=0;},row=>{row.at='2026-10-02T00:00:02.000Z';}]){
    const mixed=structuredClone(completed);mutate(mixed.evaluation.outcomes[0]);
    assert.throws(()=>restore(JSON.stringify(mixed),engine,SCOPE,temper),/완료 근거/);
  }
  const missing=structuredClone(completed);missing.events=missing.events.filter(e=>e.type!=='experience.completed');missing.history=[];missing.run=null;
  assert.throws(()=>restore(JSON.stringify(missing),engine,SCOPE,temper),/완료 근거/);
});
test('25 practice roundtrips retain complete evaluable chains only while their review summaries remain',()=>{
  let s=newState();s.save=true;const previousRetention={decisions:[],exposures:[],outcomes:[]};
  for(let i=0;i<25;i++){
    const begin=new Date(Date.parse(at)+i*60000).toISOString(),end=new Date(Date.parse(begin)+1000).toISOString();
    s=recordPracticeExposure(startRun(s,{task:'meeting',goal:'clarity',minutes:5,support:'step'},engine,begin),begin);
    s.run.prompt=TASKS.meeting.template;s.run.draft=filled().run.draft;s.run.reviewed=true;
    for(const id of s.run.checkIds){const c=TASKS.meeting.checks.find(c=>c.id===id);s.run.answers[id]={kind:c.answer,source:c.source};}
    s.run.result=evaluate(s.run);s=completeRun(s,engine,end);
    for(const key of Object.keys(previousRetention))previousRetention[key].push(structuredClone(s.evaluation[key].at(-1)));
    s=restore(JSON.stringify(s),engine,SCOPE,temper);
    assert.equal(s.history.length,Math.min(i+1,20));
    for(const key of Object.keys(previousRetention))assert.equal(s.evaluation[key].length,Math.min(i+1,20));
  }
  // Prior snapshots retained 200 metric decisions but only 20 review summaries.
  // Their old result values cannot be checked, so prune the entire old chain.
  s.evaluation=previousRetention;s.evaluation.outcomes[0].value=0;
  const before=practiceEvaluation(s,temper,'2026-10-04T00:00:00.000Z').byPolicy[0];
  assert.equal(before.counts.observed,20);assert.equal(before.counts.missing,0);assert.equal(before.mean,1);
  s=restore(JSON.stringify(s),engine,SCOPE,temper);
  for(const key of Object.keys(previousRetention))assert.equal(s.evaluation[key].length,20);
  assert.ok(s.evaluation.decisions.every(row=>s.history.some(h=>row.id===`review.${h.decisionId}`)));
});
test('malformed stored recommendation cannot select a nonexistent task or render foreign evidence',()=>{
  const s=completeRun(filled(),engine,later);s.save=true;s.run.nextDecision.selected.id='nonexistent';
  assert.throws(()=>restore(JSON.stringify(s),engine,SCOPE,temper),/추천 근거/);
  const other=filled();other.save=true;other.run.focusDecision.scope.subject='another-person';
  assert.throws(()=>restore(JSON.stringify(other),engine,SCOPE,temper),/추천 근거/);
});
test('the ordering policy measures all initially reviewed checks, not only its first selected check',()=>{
  let s=recordPracticeExposure(filled(),at);s.run.answers.approval.kind='match';s.run.result=evaluate(s.run);
  assert.equal(s.run.result[0].correct,true);assert.equal(s.run.result[1].correct,false);
  s=completeRun(s,engine,later);const report=practiceEvaluation(s,temper,'2026-10-03T00:01:00.000Z');
  assert.equal(report.contract.outcome.id,'initial-review-match-ratio');assert.equal(report.byPolicy[0].mean,0.5);
});
for(const target of ['completion','decision'])test(`excluding a ${target} removes its observations, cached explanation and next recommendation`,()=>{
  let s=finishPractice(newState(),'meeting',['approval'],at,later);
  const former=s.run.nextDecision;
  const session=core.createSession({scope:engine.coreScope(s.profile),events:s.events,clock:()=> '2026-10-02T00:00:02.000Z',id:()=>`exclude-${target}`});
  session.exclude(target==='completion'?s.run.completionId:s.run.decisionId);s.events=session.events();
  assert.deepEqual(practiceObservations(s),[]);assert.deepEqual(decisionEvidence(s,former),[]);assert.equal(nextTaskSuggestion(s).focus,null);
  s=startRun(s,{task:'meeting',goal:'clarity',minutes:5,support:'step'},engine,'2026-10-02T00:00:03.000Z');
  assert.equal(s.run.checkIds[0],'deadline');assert.doesNotMatch(s.run.reason,/지난 실습의/);assert.deepEqual(practiceBasis(s),[]);
});
for(const target of ['completion','decision'])test(`excluding a ${target} also removes its result from descriptive outcome accounting`,()=>{
  let s=completeRun(recordPracticeExposure(filled(),at),engine,later);
  const session=core.createSession({scope:engine.coreScope(s.profile),events:s.events,clock:()=> '2026-10-02T00:00:02.000Z',id:()=>`exclude-evaluation-${target}`});
  session.exclude(target==='completion'?s.run.completionId:s.run.decisionId);s.events=session.events();
  const result=practiceEvaluation(s,temper,'2026-10-03T00:01:00.000Z').byPolicy[0];
  assert.equal(result.mean,null);assert.equal(result.counts.observed,0);
  assert.equal(result.counts.decisions,target==='decision'?0:1);
  assert.equal(result.counts.missing,target==='completion'?1:0);
});
test('an already prepared screen stops explaining its order with subsequently excluded evidence',()=>{
  let s=finishPractice(newState(),'meeting',['approval'],at,later);const completionId=s.run.completionId;
  s=startRun(s,{task:'meeting',goal:'clarity',minutes:5,support:'step'},engine,'2026-10-02T00:00:02.000Z');assert.match(practiceReason(s),/지난 실습의/);
  const session=core.createSession({scope:engine.coreScope(s.profile),events:s.events,clock:()=> '2026-10-02T00:00:03.000Z',id:()=> 'withdrawn-prepared-screen'});
  session.exclude(completionId);s.events=session.events();
  assert.doesNotMatch(practiceReason(s),/지난 실습의/);assert.deepEqual(practiceBasis(s),[]);
});
