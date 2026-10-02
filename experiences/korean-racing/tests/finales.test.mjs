import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { CAMPAIGN } from '../campaign.js';
import { FINALES, FINALE_BY_ID, FINALE_QUESTION_BY_ID, FINALE_CHOICE_BY_ID, finaleUnlocked, finaleReward } from '../finales.js';

test('six finales introduce 30 original transfer questions with complete narration metadata',()=>{
  assert.equal(FINALES.length,6);
  const originals=new Set(CAMPAIGN.flatMap(s=>s.items.map(q=>q.passage)));
  const questions=new Set(),audio=new Set();
  for(const [i,s] of FINALES.entries()){
    assert.equal(s.id,`finale-${i+1}`);assert.equal(s.chapter,i+1);assert.equal(s.level,i+1);
    assert.equal(s.campaign,true);assert.equal(s.finale,true);assert.equal(s.items.length,5);assert.deepEqual(s.words,[]);
    assert.equal(FINALE_BY_ID[s.id],s);
    for(const q of s.items){
      assert(!originals.has(q.passage),'a finale must transfer familiar expressions to a new passage');
      assert(!questions.has(q.id));questions.add(q.id);assert.equal(FINALE_QUESTION_BY_ID[q.id],q);
      assert(['reading','sentence'].includes(q.mode));assert(q.prompt&&q.spoken&&q.explanation);
      assert.equal(q.options.length,3);assert.equal(new Set(q.choices.map(c=>c.word)).size,3);
      assert.equal(q.choices.find(c=>c.id===q.answer)?.word,q.word);
      assert(q.options.includes(q.answer));assert(!q.spoken.includes('(　)'));
      for(const choice of q.choices)assert.equal(FINALE_CHOICE_BY_ID[choice.id],choice);
      for(const id of [...q.audio,...q.answerAudio,...q.options]){assert(!audio.has(id));audio.add(id);}
    }
  }
  assert.equal(questions.size,30);assert.equal(audio.size,150);
  assert(FINALES[5].items[3].passage.length>FINALES[0].items[0].passage.length);
  assert(FINALES.some(s=>s.items.some(q=>q.spoken.includes('빈칸'))));
});

test('a finale opens only after both of its own chapter courses are cleared',()=>{
  for(const stage of FINALES){
    const courses=CAMPAIGN.filter(s=>s.chapter===stage.chapter),progress={stages:{}};
    assert(!finaleUnlocked(progress,stage));
    progress.stages[courses[0].id]={cleared:true,bestScore:5};assert(!finaleUnlocked(progress,stage));
    progress.stages[courses[1].id]={cleared:false,bestScore:3};assert(!finaleUnlocked(progress,stage));
    progress.stages[courses[1].id]={cleared:true,bestScore:4};assert(finaleUnlocked(progress,stage));
    progress.stages[courses[0].id]={cleared:1};assert(!finaleUnlocked(progress,stage),'a truthy corrupt flag does not unlock a finale');
  }
  const allExceptFirst={stages:Object.fromEntries(CAMPAIGN.filter(s=>s.chapter!==1).map(s=>[s.id,{cleared:true}]))};
  assert(!finaleUnlocked(allExceptFirst,FINALES[0]));
  assert(!finaleUnlocked(null,FINALES[0]));
  assert(!finaleUnlocked({stages:{}},{id:'finale-99',finale:true}));
});

test('each finale carries one distinct cosmetic reward and all 150 audio jobs match current items',async()=>{
  assert.deepEqual(FINALES.map(s=>finaleReward(s).id),['paint-aurora','wheel-blossom','trail-starlight','badge-coast','paint-sunset','vehicle-finale']);
  assert.equal(finaleReward('unknown'),null);assert.equal(finaleReward('finale-6').kind,'vehicle');
  const jobs=JSON.parse(await fs.readFile(new URL('../audio-source/finale-jobs.json',import.meta.url),'utf8'));
  assert.equal(jobs.length,150);assert.equal(new Set(jobs.map(j=>j.id)).size,150);
  const byId=Object.fromEntries(jobs.map(j=>[j.id,j.text]));
  for(const q of FINALES.flatMap(s=>s.items)){
    assert.equal(byId[q.audio[0]],q.spoken);
    assert.equal(byId[q.answerAudio[0]],`${q.word}. ${q.explanation}`);
    for(const c of q.choices)assert.equal(byId[c.id],c.word);
  }
});
