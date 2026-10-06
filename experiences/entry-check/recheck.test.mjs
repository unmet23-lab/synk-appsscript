import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { VENUES } from './content.mjs';
import { caseMetadata, answerPayload } from './learning.mjs';
import { followUpResult } from './correction.mjs';
const {createGame}=createRequire(import.meta.url)('../../atlas/game-browser.js');
const pool=VENUES.find(v=>v.id==='pool');
const find=id=>pool.cases.find(c=>c.id===id);
function scenario(helped=false){
  const data=new Map(),coach=createGame({gameId:'entry-check',storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});
  const first=coach.answer(coach.present(caseMetadata(find('pool-01'))),answerPayload(false));
  const next=find('pool-09'),pid=coach.present(caseMetadata(next));
  if(helped)coach.help(pid,'hint');
  const result=coach.answer(pid,answerPayload(true));
  return {coach,next,result,link:{id:next.id,status:'new',sourceAttemptId:first.eventId}};
}
test('Entry only compares the explicitly queued new guest and preserves helped answers',()=>{
  for(const helped of [false,true]){
    const {coach,next,result,link}=scenario(helped);
    const comparison=followUpResult(coach,link,next,result);
    assert.equal(comparison.status,helped?'assisted-correct':'independent-correct');
    assert.equal(comparison.targetAttemptId,result.eventId);
    assert.equal(followUpResult(coach,link,find('pool-02'),result),null);
    assert.equal(followUpResult(coach,{...link,status:'review'},next,result),null);
    assert.equal(followUpResult(coach,null,next,result),null);
  }
});
test('Entry closed host, older bundle and unrecorded answer cannot claim successful recheck',()=>{
  const {next,result,link}=scenario();
  assert.equal(followUpResult({},link,next,result),null);
  assert.equal(followUpResult({recheck(){throw Error('RUN_ENDED');}},link,next,result),null);
  assert.equal(followUpResult({recheck(){throw Error('should not call');}},link,next,null),null);
});
