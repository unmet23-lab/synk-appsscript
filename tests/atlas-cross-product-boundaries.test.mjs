import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import Core from '../atlas/engine.js';
import Personalization from '../atlas/personalization.js';
import Game from '../atlas/game-learning.js';
import Strata from '../strata/index.js';
import Topik from '../strata/topik-i.js';
import TemperOutcomes from '../atlas/temper-outcomes.js';
import { VENUES } from '../experiences/entry-check/content.mjs';
import { caseMetadata, answerPayload, skillReport } from '../experiences/entry-check/learning.mjs';
import { TASKS, newState, startRun, recordPracticeExposure, evaluate, completeRun, practiceEvaluation, restore } from '../experiences/shift-workbench/model.mjs';

// These tests execute existing product adapters and authored product content.
// The people and answers are synthetic; no customer or learning effect is measured.
const START=Date.parse('2026-10-06T00:00:00.000Z');
const at=seconds=>new Date(START+seconds*1000).toISOString();
const map=Strata.createMap(Topik.topikMap());
const cases=VENUES.flatMap(venue=>venue.cases);
function storage(){const rows=new Map();return {getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value)};}
function lab(options={}){
  let tick=0;
  const disk=options.storage||storage();
  const coach=Game.createGame({gameId:'entry-check',map,storage:disk,clock:()=>at(tick),...options});
  return {coach,disk,answer(index,correct,{help=false}={}){
    tick+=1;const pid=coach.present(caseMetadata(cases[index]));
    if(help)coach.help(pid,'hint');
    const response=coach.answer(pid,answerPayload(correct));
    return {pid,response};
  }};
}
const SHIFT_SCOPE={personId:'synthetic-member',productId:'company',contextId:'workroom-practice',domain:'SHIFT'};
function shift({wrong=true,scope=SHIFT_SCOPE,seen=true}={}){
  let state=startRun(newState(),{task:'meeting',goal:'clarity',minutes:5,support:'step'},Personalization,at(0),scope);
  if(seen)state=recordPracticeExposure(state,at(1),scope);
  state.run.prompt=TASKS.meeting.template;
  for(const [index,id] of state.run.checkIds.entries()){
    const check=TASKS.meeting.checks.find(row=>row.id===id);
    state.run.answers[id]={kind:wrong&&index===1?'match':check.answer,source:check.source};
  }
  state.run.result=evaluate(state.run);
  state.run.draft='제공한 자료의 담당과 기한을 대조하고 승인 대기 상태와 빠진 기한을 직접 고친 충분히 긴 결과입니다.';
  state.run.reviewed=true;
  return completeRun(state,Personalization,at(2),scope);
}

test('actual LAB entry checks and SHIFT workroom reuse Core with distinct evidence and success contracts',()=>{
  const learning=lab();learning.answer(0,false);learning.answer(1,true);learning.answer(2,true,{help:true});learning.answer(0,true);
  const summary=learning.coach.summary(),practice=shift(),outcome=practiceEvaluation(practice,TemperOutcomes,at(86403),SHIFT_SCOPE);
  assert.deepEqual(summary.counts.independent,{evaluated:2,correct:1,incorrect:1,accuracy:0.5});
  assert.equal(summary.counts.assisted,1);assert.equal(summary.counts.repeat,1);
  assert.ok(skillReport(summary).some(row=>row.n>0),'the existing product report consumes the same practice summary');
  assert.equal(outcome.contract.outcome.id,'initial-review-match-ratio');
  assert.equal(outcome.byPolicy[0].mean,0.5,'SHIFT checks every initial judgment and source, despite guided practice');
  assert.equal(practice.history[0].assisted,true);
  assert.equal(summary.counts.learningEffectClaim,false);assert.equal(outcome.causalClaim,false);assert.equal(outcome.policyPromotion,false);
  assert.ok(learning.coach.events().some(row=>row.type==='decision.made'&&row.scope.domain==='LAB'));
  assert.ok(practice.events.some(row=>row.type==='decision.made'&&row.scope.domain==='SHIFT'));
  assert.ok(learning.coach.events().some(row=>row.type==='practice.attempted'));
  assert.equal(practice.events.some(row=>row.type==='practice.attempted'),false,'a reviewed business exercise is not silently converted into Korean practice');
});

test('actual products preserve host identity boundaries instead of merging the same synthetic person across brands',()=>{
  const learning=lab({storageScope:'account',accountKey:'account-a'});learning.answer(0,true);
  const saved=learning.disk.getItem(`${Game.KEY}.device`);
  const wrongAccount=lab({storage:learning.disk,storageScope:'account',accountKey:'account-b'});
  assert.equal(wrongAccount.coach.summary().storage.available,false);
  assert.equal(wrongAccount.coach.summary().independent,0);
  assert.equal(learning.disk.getItem(`${Game.KEY}.device`),saved,'refusing another owner does not destroy the original record');
  const practice=shift();practice.save=true;
  assert.throws(()=>restore(JSON.stringify(practice),Personalization,{...SHIFT_SCOPE,personId:'different-member'},TemperOutcomes),/다른 실습/);
  const labEvents=learning.coach.events();
  assert.throws(()=>Core.createSession({scope:labEvents[0].scope,events:[...labEvents,...practice.events],clock:()=>at(10)}),/scope/);
  const foreign=structuredClone(practice);foreign.evaluation.outcomes[0].scope.domain='LAB';
  assert.throws(()=>practiceEvaluation(foreign,TemperOutcomes,at(86403),SHIFT_SCOPE),/authorized/);
  const changedDefinition=structuredClone(practice);changedDefinition.evaluation.exposures[0].contract.id='independent-language-answer';
  assert.throws(()=>practiceEvaluation(changedDefinition,TemperOutcomes,at(86403),SHIFT_SCOPE),/contract/);
});

test('withdrawal removes analytical use in each product without rewriting what was shown or answered',()=>{
  const learning=lab(),answer=learning.answer(0,true);
  learning.coach.exclude(answer.response.eventId);
  assert.equal(learning.coach.summary().independent,0);
  assert.equal(learning.answer(0,true).response.independent,false,'excluded exposure never becomes a new language item again');
  const practice=shift({wrong:false}),original=structuredClone(practice.evaluation.outcomes[0]);
  const session=Core.createSession({scope:Personalization.coreScope(practice.profile),events:practice.events,clock:()=>at(3),id:()=> 'source-workroom-withdrawal'});
  session.exclude(practice.run.completionId);practice.events=session.events();
  const result=practiceEvaluation(practice,TemperOutcomes,at(86403),SHIFT_SCOPE);
  assert.equal(result.byPolicy[0].mean,null);
  assert.equal(result.provenance.chains[0].status,'withdrawn');
  assert.equal(result.provenance.chains[0].revisions[0].sourceRef,'source-workroom-withdrawal');
  assert.deepEqual(practice.evaluation.outcomes[0],original);
  const notShown=practiceEvaluation(shift({seen:false}),TemperOutcomes,at(86403),SHIFT_SCOPE);
  assert.equal(notShown.byPolicy[0].counts.undelivered,1);assert.equal(notShown.byPolicy[0].mean,null);
});

test('the existing generated LAB browser consumer executes its real item adapter',()=>{
  const context=vm.createContext({console});
  vm.runInContext(fs.readFileSync(new URL('../experiences/entry-check/atlas-learning.js',import.meta.url),'utf8'),context);
  const browser=context.SynkLearning;
  assert.equal(typeof browser?.createGame,'function');
  const coach=browser.createGame({gameId:'entry-check',storage:storage(),clock:()=>at(10)});
  const pid=coach.present(caseMetadata(cases[0]));
  assert.equal(coach.answer(pid,answerPayload(true)).independent,true);
  assert.equal(coach.summary().counts.independent.correct,1);
  assert.equal(skillReport(coach.summary()).find(row=>row.id===cases[0].skill).correct,1);
});
