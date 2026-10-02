import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {TRACKS,RoundState} from './core.mjs';
import {rhythmItem,RHYTHM_CANDIDATES} from './personalization.mjs';
const {createGame}=createRequire(import.meta.url)('../../atlas/game-browser.js');
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};
test('song, spoken claim and transfer item have stable identities without counting O/X variants as new content',()=>{
  const first=new RoundState(TRACKS[0]).questions[0],other=new RoundState(TRACKS[1]).questions[0];
  const a=rhythmItem(0,first),b=rhythmItem(1,other),variant=rhythmItem(0,{...first,variant:1-first.variant});
  assert.notEqual(a.itemKey,b.itemKey);assert.notEqual(a.itemKey,variant.itemKey);assert.equal(a.familyKey,variant.familyKey);
  // 2026-10-02 decision: a recall swaps only a number or a time and follows the answer, so it shares the family.
  assert.equal(a.familyKey,rhythmItem(0,first,{recall:true}).familyKey);
  assert.notEqual(a.itemKey,rhythmItem(0,first,{recall:true}).itemKey);
  assert.equal(a.responseFormat,'binary-choice');
  assert.equal(rhythmItem(0,first,{recall:true}).responseFormat,'binary-choice');
  assert(RHYTHM_CANDIDATES.every(q=>q.responseFormat==='binary-choice'));
});
test('independent listening and transfer responses select a different actual track',()=>{
  const coach=createGame({gameId:'korean-rhythm',storage:storage()});
  assert.equal(coach.recommend(RHYTHM_CANDIDATES).selected.trackId,0);
  for(const question of new RoundState(TRACKS[0]).questions)for(const recall of [false,true]){
    const pid=coach.present(rhythmItem(0,question,{recall}));coach.delivery(pid,{audio:'completed'});coach.answer(pid,{correct:true,assessable:true});
  }
  assert.equal(coach.recommend(RHYTHM_CANDIDATES).selected.trackId,1);
  const reading=coach.summary().skills.filter(s=>s.domain==='reading');assert(reading.every(s=>s.status==='unseen'&&s.n===0));
});
test('a recall right after its original question is practice, not a fresh independent answer',()=>{
  const coach=createGame({gameId:'korean-rhythm',storage:storage()}),q=new RoundState(TRACKS[0]).questions[0];
  const first=coach.present(rhythmItem(0,q));coach.delivery(first,{audio:'completed'});
  assert.equal(coach.answer(first,{correct:true,assessable:true}).independent,true);
  const recall=coach.present(rhythmItem(0,q,{recall:true}));coach.delivery(recall,{audio:'completed'});
  const result=coach.answer(recall,{correct:true,assessable:true});
  assert.equal(result.independent,false);assert.equal(result.exposure,'repeat');
});
test('a later O/X claim of an already answered sentence is practice, not a fresh independent answer',()=>{
  const coach=createGame({gameId:'korean-rhythm',storage:storage()}),q=new RoundState(TRACKS[0]).questions[0];
  for(const [i,variant] of [0,1].entries()){
    const pid=coach.present(rhythmItem(0,{...q,variant}));coach.delivery(pid,{audio:'completed'});
    assert.equal(coach.answer(pid,{correct:true,assessable:true}).independent,i===0);
  }
});
