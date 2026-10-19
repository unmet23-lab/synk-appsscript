import test from 'node:test';
import assert from 'node:assert/strict';
import { recallPlan } from './starbook.mjs';
const expedition=(words=['red','up','one'])=>({expeditionId:'a'.repeat(32),completedAt:1791500400000,records:Array.from({length:18},(_,round)=>({round,stage:['color','position','count'][Math.floor(round/6)],word:words[Math.floor(round/6)]}))});
test('return recall uses only words from a validated completed expedition',()=>{
  for(const random of[()=>0,()=>.999999])assert.deepEqual(recallPlan(expedition(),random),{expeditionId:'a'.repeat(32),words:['red','up','one']});
  assert.deepEqual(recallPlan(expedition(['blue','down','three']),()=>0).words,['blue','down','three']);
});
test('an unfinished, malformed or target-only record cannot create return practice',()=>{
  const item=expedition();assert.equal(recallPlan({...item,records:item.records.slice(0,17)}),null);
  assert.equal(recallPlan({...item,records:item.records.map(r=>({...r,word:'red'}))}),null);
  assert.equal(recallPlan({target:'red'}),null);assert.equal(recallPlan(null),null);
});
