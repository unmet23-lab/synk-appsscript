import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CAMPAIGN} from '../campaign.js';
import {FINALES} from '../finales.js';
import {WORDS,STAGES,WORD_BY_ID,PROGRESS_KEY,makeQuestions,emptyProgress,recordRound,loadProgress,reviewStage} from '../learning.js';
import {racingItem,RACING_CANDIDATES,personalizedStage} from '../personalization.js';
const {SKILLS,createGame}=createRequire(import.meta.url)('../../../atlas/game-browser.js');
const round=(stage,score=5)=>makeQuestions(stage,()=>.43).map((q,i)=>({...q,correct:i<score}));

test('finale scores, choice IDs and errors survive browser storage and join sentence review',()=>{
  const stage=FINALES[0],responses=round(stage,4);
  for(const q of responses)for(const id of q.options)assert.equal(typeof WORD_BY_ID[id]?.word,'string');
  const progress=recordRound(emptyProgress(),stage,responses,{now:987,collisions:1});
  assert.deepEqual(progress.stages[stage.id],{plays:1,bestScore:4,cleared:true});
  assert.equal(Object.keys(progress.challenges).length,5);
  const restored=loadProgress({getItem:key=>key===PROGRESS_KEY?JSON.stringify(progress):null});
  assert.deepEqual(restored,progress);
  const review=reviewStage(restored,'campaign');assert.equal(review.items[0].id,responses[4].id);
  const improved=recordRound(restored,review,round(review));
  assert(improved.challenges[responses[4].id].lastCorrect);assert.equal(improved.stages['challenge-review'],undefined);
});

test('incomplete finale cannot clear a course, and automatic finale creates no records',()=>{
  const initial=emptyProgress(),stage=FINALES[5],responses=round(stage);
  assert.equal(recordRound(initial,stage,responses,{automatic:true}),initial);
  const incomplete=recordRound(initial,stage,responses.slice(0,4));
  assert.equal(incomplete.stages[stage.id],undefined);assert.equal(incomplete.cleanRuns,0);
  const completed=recordRound(initial,stage,responses);assert(completed.stages[stage.id].cleared);
});

test('adding finales preserves old word and campaign progress without inventing finale plays',()=>{
  let old=recordRound(emptyProgress(),STAGES[0],round(STAGES[0]),{now:12});
  old=recordRound(old,CAMPAIGN[0],round(CAMPAIGN[0],4),{now:13});
  const restored=loadProgress({getItem:()=>JSON.stringify(old)});
  assert.deepEqual(restored,old);assert.equal(Object.keys(restored.words).length,5);
  assert.equal(WORDS.length,2000);assert(FINALES.every(s=>!restored.stages[s.id]));
});

test('finale skill tags use existing Strata skills and preserve listening/reading assessment',()=>{
  const skills=new Map(SKILLS.map(s=>[s.id,s]));
  for(const stage of FINALES)for(const item of stage.items){
    const meta=racingItem(item),reading=item.mode==='reading';
    assert(skills.has(meta.skillId),meta.skillId);assert(meta.skillId.startsWith(`ko.${reading?'reading':'listening'}.`));
    assert.equal(meta.modality,reading?'reading':'listening');assert.equal(meta.audioRequired,!reading);
    assert.equal(meta.responseFormat,'single-choice');assert.equal(meta.difficulty,Math.min(3,Math.ceil(stage.chapter/2)));
  }
  const coach=createGame({gameId:'korean-racing',storage:{getItem:()=>null,setItem(){}}});
  for(const stage of FINALES){
    const item=stage.items[0],pid=coach.present(racingItem(item));
    if(item.mode!=='reading')coach.delivery(pid,{audio:'completed'});
    assert.equal(coach.answer(pid,{correct:true,assessable:true}).independent,true);
  }
  assert.equal(RACING_CANDIDATES.length,60);
  assert(!RACING_CANDIDATES.some(c=>c.id.startsWith('f')),'finale transfer passages stay outside recommendation candidates');
  const reading=personalizedStage(coach,{audioAvailable:false});
  assert(reading.stage.items.every(item=>item.mode==='reading'));
});
