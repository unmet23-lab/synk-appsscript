import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import engine from '../../atlas/personalization.js';
import temper from '../../atlas/temper-outcomes.js';
import * as M from './model.mjs';

const base=Date.parse('2026-10-06T01:00:00.000Z');
const at=n=>new Date(base+n*1000).toISOString();
const settings={task:'meeting',goal:'work',minutes:10,support:'independent'};
const authored={prompt:'가상 자료를 근거로 승인 여부와 기한을 구분한 실행 목록을 작성해 주세요.',draft:'직접 작성한 결과입니다. 원문 자료의 담당과 기한을 옮기고, 승인이 끝나지 않은 예산과 미확인 효과를 따로 기록했습니다. <img src=x onerror=bad()>'};
function fill(state,module=M){
  Object.assign(state.run,authored,{reviewed:true});
  for(const id of state.run.checkIds){const c=module.TASKS[state.run.task].checks.find(c=>c.id===id);state.run.answers[id]={kind:c.answer,source:c.source};}
  state.run.result=module.evaluate(state.run);return state;
}
function fixture(scope=M.SCOPE){
  let state=M.startRun(M.newState(),settings,engine,at(0),scope);state.save=true;
  state=M.completeRun(fill(M.recordPracticeExposure(state,at(1),scope)),engine,at(2),scope);
  state=M.giveFeedback(state,'helpful',engine,at(3),scope);
  state=M.startRun(state,{...settings,task:'planning'},engine,at(4),scope);
  Object.assign(state.run,authored);
  return state;
}
const restore=(state,module=M,scope=M.SCOPE)=>module.restore(JSON.stringify(state),engine,scope,temper);
async function revised(edit){
  const original=await readFile(new URL('./model.mjs',import.meta.url),'utf8');
  const source=edit(original).replace("'./storage-upgrade.mjs'",JSON.stringify(new URL('./storage-upgrade.mjs',import.meta.url).href));
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}

test('the current storage version retains ongoing work and analytical identity',()=>{
  const state=fixture(),before=structuredClone(state),loaded=restore(state);
  assert.deepEqual(state,before);
  assert.equal(loaded.run.draft,authored.draft);
  assert.equal(loaded.run.decisionId,state.run.decisionId);
  assert.equal(loaded.history[0].completionId,state.history[0].completionId);
  assert.equal(loaded.evaluation.outcomes[0].value,1);
  assert.deepEqual(restore(loaded),loaded);
});

test('reordering the serialized manifest keys does not discard compatible analytics',()=>{
  const state=fixture();state.manifest=Object.fromEntries(Object.entries(state.manifest).reverse());
  const loaded=restore(state);assert.equal(loaded.run.decisionId,state.run.decisionId);assert.deepEqual(loaded.events,state.events);assert.ok(loaded.history.every(h=>!M.isSavedWork(h)));
});

test('unsupported outer envelopes are rejected without partial recovery',()=>{
  for(const edit of [s=>{s.version=99;},s=>{s.save=false;},s=>{s.events={};},s=>{s.history={};},s=>{s.manifest=null;},s=>{s.manifest=false;}]){
    const state=fixture();edit(state);
    assert.throws(()=>restore(state));
  }
});

test('a pre-marker untouched sample is not recovered as authored work when its task disappears',async()=>{
  const old=fixture();old.run.prompt='';old.run.draft=M.TASKS.planning.sample;delete old.manifest;delete old.run.initialDraft;delete old.run.taskName;
  const next=await revised(s=>s.replace('export const TASKS = Object.freeze({','const ORIGINAL_TASKS = Object.freeze({').replace('export const ANSWERS =',"export const TASKS=Object.freeze(Object.fromEntries(Object.entries(ORIGINAL_TASKS).filter(([id])=>id!=='planning')));\nexport const ANSWERS ="));
  const loaded=restore(old,next);assert.equal(loaded.history.length,1);assert.equal(loaded.history[0].status,'completed');
});

test('a malformed current recommendation cannot turn into an authored-work recovery',()=>{
  for(const edit of [
    s=>{s.run.focusDecision.scope.subject='foreign-user';},
    s=>{s.run.focusDecision.contract.version='unannounced';},
    s=>{s.run.focusDecision.practicePlan.selectedId='unknown-check';},
    s=>{s.evaluation.decisions[0].policy.version='unannounced';},
    s=>{s.evaluation.outcomes[0].value=0;},
    s=>{s.history[0].correct=0;},
    s=>{s.run.checkIds=['unknown-check'];}
  ]){
    const state=fixture();edit(state);
    assert.throws(()=>restore(state),String(edit));
  }
});

test('both stored owner and caller owner remain mandatory',()=>{
  const scope={personId:'storage-user-a',productId:'company',contextId:'workroom-practice',domain:'SHIFT'};
  const state=fixture(scope);
  assert.throws(()=>restore(state,M,{...scope,personId:'storage-user-b'}));
  for(const edit of [
    s=>{s.events[0].scope.subject='storage-user-b';},
    s=>{s.events[0].scope.workspace='p.company:c.somewhere-else:g.1';},
    s=>{s.events[0].scope.workspace='p.company:c.workroom-practice:g.999';},
    s=>{s.evaluation.outcomes[0].subject='storage-user-b';},
    s=>{s.evaluation.outcomes[0].scope.purpose='other-use';}
  ]){const bad=structuredClone(state);edit(bad);assert.throws(()=>restore(bad,M,scope),String(edit));}
});

test('an actual content update recovers completed and ongoing authored text, never old analytics',async()=>{
  const next=await revised(s=>s.replace('80만 원 예산은 승인됐다.','예산 승인 사실을 확인했나요?'));
  const old=fixture(),before=structuredClone(old),loaded=restore(old,next);
  assert.deepEqual(old,before);assert.equal(loaded.run,null);assert.deepEqual(loaded.events,[]);assert.deepEqual(loaded.evaluation,{decisions:[],exposures:[],outcomes:[]});assert.deepEqual(loaded.visits,[]);
  assert.equal(loaded.history.length,2);assert.deepEqual(loaded.history.map(h=>h.status),['completed','in-progress']);
  for(const h of loaded.history){assert.equal(h.kind,'recovered-work');assert.equal(h.prompt,authored.prompt);assert.equal(h.draft,authored.draft);assert.equal(h.correct,undefined);assert.equal(h.review,undefined);assert.equal(h.decisionId,undefined);}
  assert.deepEqual(restore(loaded,next),loaded);assert.match(next.exportSavedWork(loaded,1),/업데이트 전 작성한 내용/);
  const time=new Date(Date.now()+1000).toISOString();let current=next.startRun(loaded,settings,engine,time);
  assert.equal(next.practiceHistoryUsed(current),false);assert.deepEqual(next.practiceObservations(current),[]);
  current=next.completeRun(fill(current,next),engine,new Date(Date.now()+2000).toISOString());
  assert.equal(current.history.filter(next.isSavedWork).length,2);
});

test('contract and policy revisions recover text through their explicit product marker',async()=>{
  for(const edit of [s=>s.replace("id:'shift-practice-review',version:'1'","id:'shift-practice-review',version:'2'"),s=>s.replace("id:'evidence-check-order',version:'2'","id:'evidence-check-order',version:'3'")]){
    const next=await revised(edit),loaded=restore(fixture(),next);
    assert.equal(loaded.history.length,2);assert.ok(loaded.history.every(h=>h.kind==='recovered-work'));assert.equal(loaded.evaluation.decisions.length,0);
    assert.deepEqual(restore(loaded,next),loaded);
  }
});

test('starting directly with obsolete in-memory product state preserves its writing before creating a new decision',async()=>{
  const old=fixture(),before=structuredClone(old),next=await revised(s=>s.replace('80만 원 예산은 승인됐다.','문항을 업데이트했습니다.'));
  const started=next.startRun(old,settings,engine,at(12));
  assert.deepEqual(old,before);assert.equal(started.run.step,'practice');assert.equal(started.history.length,2);
  assert.ok(started.history.every(next.isSavedWork));assert.equal(next.practiceHistoryUsed(started),false);
  assert.ok(started.events.every(e=>!old.events.some(prior=>prior.id===e.id)));
});

test('a removed task remains readable and exportable including pre-marker v1 saves',async()=>{
  const next=await revised(s=>s.replace('export const TASKS = Object.freeze({','const ORIGINAL_TASKS = Object.freeze({').replace('export const ANSWERS =',"export const TASKS = Object.freeze(Object.fromEntries(Object.entries(ORIGINAL_TASKS).filter(([id])=>id!=='planning')));\nexport const ANSWERS ="));
  for(const legacy of [false,true]){
    const old=fixture();if(legacy){delete old.manifest;delete old.retention;delete old.visits;delete old.run.initialDraft;delete old.run.taskName;delete old.history[0].taskName;}
    const loaded=restore(old,next),archive=loaded.history.find(h=>h.task==='planning');
    assert.equal(loaded.settings.task,'meeting');assert.equal(archive.status,'in-progress');assert.equal(next.historyLabel(archive),'기획을 검증하기');
    assert.match(next.exportSavedWork(loaded,loaded.history.indexOf(archive)),/기획을 검증하기/);assert.deepEqual(restore(loaded,next),loaded);
  }
});

test('twenty stored completions and an ongoing draft all survive an update and later practice',async()=>{
  let old=M.newState();old.save=true;
  for(let i=0;i<20;i++){old=M.startRun(old,settings,engine,at(i*3));old=M.completeRun(fill(old),engine,at(i*3+1));}
  old=M.startRun(old,{...settings,task:'planning'},engine,at(65));Object.assign(old.run,authored);
  const next=await revised(s=>s.replace('80만 원 예산은 승인됐다.','새 문항으로 교체했습니다.')),loaded=restore(old,next);
  assert.equal(loaded.history.length,21);assert.equal(loaded.history.filter(h=>h.status==='in-progress').length,1);
  const started=next.startRun(loaded,settings,engine,at(70)),finished=next.completeRun(fill(started,next),engine,at(71));
  assert.equal(finished.history.filter(next.isSavedWork).length,21);assert.equal(finished.history.length,22);
  assert.deepEqual(restore(finished,next),finished);
});

test('an obsolete product marker cannot hide foreign ownership or inconsistent source records',async()=>{
  const next=await revised(s=>s.replace('80만 원 예산은 승인됐다.','예산을 다시 확인합니다.'));
  for(const edit of [
    s=>{s.events[0].scope.subject='foreign';},s=>{s.events[0].scope.workspace='p.shift:c.workbench:g.99';},
    s=>{s.history[0].decisionId='missing';},s=>{s.history[0].correct=0;},s=>{s.evaluation.outcomes[0].value=0;},
    s=>{s.evaluation.exposures[0].candidateId='missing';},s=>{s.evaluation.outcomes[0].scope.purpose='other';},
    s=>{s.run.focusDecision.scope.subject='foreign';},s=>{s.run.startedAt=at(1);},s=>{s.evaluation.revisions=[];},
    s=>{s.manifest.format=99;}
  ]){const old=fixture();edit(old);assert.throws(()=>restore(old,next),String(edit));}
});
