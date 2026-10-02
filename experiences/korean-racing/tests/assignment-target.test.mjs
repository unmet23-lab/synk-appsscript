import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {RACING_CANDIDATES,assignmentCandidates,personalizedStage,racingItem} from '../personalization.js';
const {createGame}=createRequire(import.meta.url)('../../../atlas/game-browser.js');
const goalFor=c=>({skillId:c.skillIds[0],difficulty:c.difficulty,modality:c.modality,responseFormat:c.responseFormat,familyKeys:[c.itemKey],itemKeys:[c.itemKey],requiredAttempts:1});
test('every assigned racing item is actually selected despite older mastery or another available domain',()=>{
 for(const candidate of RACING_CANDIDATES){
  const data=new Map(),coach=createGame({gameId:'korean-racing',storage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}}),target=goalFor(candidate);
  coach.assignment=()=>target;
  const out=personalizedStage(coach);
  assert.deepEqual(out.stage.items.map(q=>racingItem(q).itemKey),target.itemKeys);
  assert.match(out.reason,/이번 목표/);
 }
});
test('racing never falls back to unrelated content for a mismatched contract',()=>{
 const c=RACING_CANDIDATES[0],target=goalFor(c);
 assert.equal(assignmentCandidates({...target,skillId:'ko.reading.detail'}).length,0);
 assert.equal(assignmentCandidates({...target,itemKeys:['foreign']}).length,0);
 assert.equal(assignmentCandidates({...target,familyKeys:[]}).length,0);
});
