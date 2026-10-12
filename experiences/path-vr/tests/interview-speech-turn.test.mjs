import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechTurn } from '../interview/film/speech-turn.mjs';

function setup() { let time = 0; const turn = createSpeechTurn({now:()=>time}); return {turn,at:n=>time=n}; }
test('no speech, background level or empty transcript never submits a silent answer',()=>{
  const {turn,at}=setup(); turn.start(); at(1000); turn.level(.4); turn.transcript(''); at(30000); assert.equal(turn.poll().submit,false);
});
test('a recognized answer needs the minimum speaking opportunity and sustained silence',()=>{
  const {turn,at}=setup(); turn.start(); at(1000); turn.transcript('지원했습니다'); at(7000); assert.equal(turn.poll().submit,false); at(10000); assert.equal(turn.poll().submit,true); assert.equal(turn.poll().submit,false);
});
test('a hesitation with renewed voice or newly decoded text postpones submission',()=>{
  const {turn,at}=setup(); turn.start(); at(6000); turn.transcript('경험이 있습니다'); at(10000); turn.level(.1); at(14500); assert.equal(turn.poll().submit,false); turn.transcript('경험이 있습니다 어르신을 도와드렸습니다'); at(19000); assert.equal(turn.poll().submit,false); at(20000); assert.equal(turn.poll().submit,true);
});
test('identical partials do not keep an ended turn open, but pause and reset disarm it',()=>{
  const {turn,at}=setup(); turn.start(); at(3000); turn.transcript('준비했습니다'); at(9000); turn.transcript('준비했습니다'); at(10000); assert.equal(turn.poll().submit,true); turn.reset(); at(60000); assert.equal(turn.poll().submit,false); turn.start(); assert.equal(turn.poll().hasAnswer,false);
});
