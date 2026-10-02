import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WORDS, STAGES, WORD_BY_ID, PROGRESS_KEY, makeQuestions, emptyProgress, recordRound, loadProgress, reviewStage } from '../learning.js';

test('400 stages cover 2,000 distinct words with pronounceable, unambiguous choices',async()=>{
  assert.equal(STAGES.length,400);assert.equal(WORDS.length,2000);
  assert.equal(new Set(WORDS.map(w=>w.word)).size,2000);
  const assigned=STAGES.flatMap(s=>s.words);assert.equal(assigned.length,2000);assert.equal(new Set(assigned).size,2000);
  const manifest=JSON.parse(await fs.readFile(new URL('../assets/narration/manifest.json',import.meta.url),'utf8'));
  const clips=Object.fromEntries(manifest.clips.map(c=>[c.id,c]));
  for(const s of STAGES){
    assert.equal(s.words.length,5);
    for(const q of makeQuestions(s)){
      assert.equal(q.options.length,3);assert.equal(new Set(q.options.map(id=>WORD_BY_ID[id].word)).size,3);assert(q.options.includes(q.answer));
      assert(clips[q.answer].duration>.1);assert(clips[q.answer].rms>50);
      assert.equal((await fs.stat(new URL(`../assets/narration/${q.answer}.mp3`,import.meta.url))).size,clips[q.answer].bytes);
      if(s.mode==='picture')for(const id of q.options)assert(WORD_BY_ID[id].icon,'picture choices need an image');
      else assert.equal(q.prompt,'들리는 단어를 골라줘!','same instruction for every listening word');
    }
  }
});

test('automatic demo cannot create progress, even with five correct answers',()=>{
  const s=STAGES[0],p=emptyProgress(),answers=makeQuestions(s).map(q=>({...q,correct:true}));
  const result=recordRound(p,s,answers,{automatic:true});assert.deepEqual(result,emptyProgress());assert.equal(reviewStage(result),null);
});

test('manual play persists scores and reviews wrong answers before correct answers',()=>{
  const s=STAGES[0],answers=makeQuestions(s).map((q,i)=>({...q,correct:i!==3}));
  const p=recordRound(emptyProgress(),s,answers,{now:12345});
  assert.equal(p.rounds,1);assert.equal(p.stages[s.id].bestScore,4);assert.equal(p.stages[s.id].cleared,true);
  const review=reviewStage(p);assert.equal(review.mode,'listen');assert.equal(review.words[0],answers[3].answer);
  const restored=loadProgress({getItem:key=>key===PROGRESS_KEY?JSON.stringify(p):null});assert.deepEqual(restored,p);
  const again=recordRound(p,s,answers.map(a=>({...a,correct:false})),{now:12346});
  assert.equal(again.stages[s.id].bestScore,4);assert.equal(again.stages[s.id].cleared,true);assert.equal(again.words[answers[3].answer].wrong,2);
});

test('three correct answers do not clear a five-word stage; corrupt storage is recoverable',()=>{
  const s=STAGES[0],answers=makeQuestions(s).map((q,i)=>({...q,correct:i<3}));
  const p=recordRound(emptyProgress(),s,answers);assert.equal(p.stages[s.id].cleared,false);
  for(const data of ['bad JSON','null','{"version":99,"words":{},"stages":{}}'])assert.deepEqual(loadProgress({getItem:()=>data}),emptyProgress());
  assert.deepEqual(loadProgress({getItem:()=>{throw Error('Storage denied');}}),emptyProgress());
});

test('review of a single wrong word has three valid choices and cannot invent a stage completion',()=>{
  const s=STAGES[0],answer=makeQuestions(s)[0],p=recordRound(emptyProgress(),s,[{...answer,correct:false}]);
  const review=reviewStage(p);assert.equal(review.words.length,1);
  const q=makeQuestions(review)[0];assert.equal(q.options.length,3);assert(q.options.includes(answer.answer));
  const after=recordRound(p,review,[{...q,correct:true}]);assert.equal(after.stages.review,undefined);assert.equal(after.words[answer.answer].correct,1);
});
