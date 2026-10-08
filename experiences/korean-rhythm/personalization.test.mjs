import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
import {spoken} from './listening.mjs';
import {TRACKS,RoundState} from './core.mjs';
import {rhythmItem,RHYTHM_CANDIDATES,nextTrackLine} from './personalization.mjs';
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
test('the next-song line takes the particle the title needs: ‘해안선’을 · ‘네 시’를',()=>{
  const titles=RHYTHM_CANDIDATES.map(c=>c.label);
  assert.ok(titles.includes('해안선')&&titles.includes('네 시'),'the shipped songs have titles with and without a final consonant');
  assert.equal(nextTrackLine('해안선',null),'다음 곡으로 ‘해안선’을 추천해요.');
  assert.equal(nextTrackLine('네 시',null),'다음 곡으로 ‘네 시’를 추천해요.');
  assert.equal(nextTrackLine('초록','놓친 문장을 다시 들어요.'),'다음 곡으로 ‘초록’을 추천해요. 놓친 문장을 다시 들어요.');
});

// Rewording a spoken line needs a new version for that item (personalization.mjs ITEM_VERSION, learning standard §7-2).
// The digest is the first 12 hex of [spoken line, answer]; after raising a version, change both here. A new line joins at version 1.
const SPOKEN={t0q0v0:[1,'04b61a7678cc'],t0q0v1:[1,'58825513b7a3'],t0q0r:[1,'89b0e1658bca'],t0q1v0:[1,'453c8318ea9a'],t0q1v1:[1,'f177c900b954'],t0q1r:[1,'fd8530fde702'],
  t0q2v0:[1,'84a73eefabf0'],t0q2v1:[1,'005c44fbd8f1'],t0q2r:[1,'62ed46a59329'],t0q3v0:[1,'1a41e5d22e83'],t0q3v1:[1,'aa085b4d0e96'],t0q3r:[1,'6d62dbfaa399'],
  t0q4v0:[1,'4d99563f2cf1'],t0q4v1:[1,'b3515c69cdaf'],t0q4r:[1,'dad6ed2a0605'],t1q0v0:[1,'6cf60a7fc3a5'],t1q0v1:[1,'d74974e4270d'],t1q0r:[1,'55806fa3eac1'],
  t1q1v0:[1,'1f05e8fc355f'],t1q1v1:[1,'f761410a5338'],t1q1r:[1,'8c692b1e3899'],t1q2v0:[1,'57a77bf7beb2'],t1q2v1:[1,'2617c50d2f52'],t1q2r:[2,'c4f84e768669'],
  t1q3v0:[1,'aa61fdc9451c'],t1q3v1:[1,'c8a255724efe'],t1q3r:[1,'da85fb82567a'],t1q4v0:[1,'309c0a3a738d'],t1q4v1:[1,'f419f8f8039b'],t1q4r:[1,'9c8996ea5dbb'],
  t2q0v0:[1,'0b30740d128e'],t2q0v1:[1,'9cf4e55278d1'],t2q0r:[1,'cc7e039d6d49'],t2q1v0:[1,'70569198755c'],t2q1v1:[1,'7f142b2c92c1'],t2q1r:[1,'2ac8da599943'],
  t2q2v0:[1,'bd427efc9d26'],t2q2v1:[1,'ff97fbc893fb'],t2q2r:[1,'059c13eb4177'],t2q3v0:[1,'d768bbaff979'],t2q3v1:[1,'38a52e920880'],t2q3r:[1,'59ce20e03673'],
  t2q4v0:[1,'4fc615c62f5b'],t2q4v1:[1,'211b70564e70'],t2q4r:[1,'c192dc383475']};
test('item versions: a reworded spoken line raises its version while the family stays',()=>{
  const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,12),lines=[];
  for(const track of TRACKS)track.questions.forEach((q,i)=>{
    for(const variant of [0,1])lines.push({item:rhythmItem(track.id,{sourceIndex:i,variant}),said:[spoken({...q,...q.claims[variant]}),q.claims[variant].answer]});
    lines.push({item:rhythmItem(track.id,{sourceIndex:i},{recall:true}),said:[spoken(q.recall),q.recall.answer]});
  });
  assert.deepEqual(Object.keys(SPOKEN).sort(),lines.map(x=>x.item.id).sort(),'a new line joins this table at version 1');
  for(const {item,said} of lines){
    const [version,hash]=SPOKEN[item.id];
    assert.equal(digest(said),hash,`${item.id}: the spoken line changed — raise ITEM_VERSION and update this table`);
    assert.equal(item.itemKey.match(/:v(\d+)$/)?.[1]??'1',String(version),item.id);
    assert.equal(item.familyKey,`korean-rhythm:t${item.id.slice(1,2)}q${item.id.slice(3,4)}:v1`,item.id);
  }
});
