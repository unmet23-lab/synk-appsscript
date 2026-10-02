import test from 'node:test';
import assert from 'node:assert/strict';
import {ORDERS,REVIEW,CafeSession,makeCup} from './core.mjs';
import {orderMetadata,assignmentOrders} from './learning.mjs';
test('assigned orders include authored review requests and every selected family is served once',()=>{
 const all=[...ORDERS,...REVIEW];
 for(const order of all){
  const m=orderMetadata(order),target={...m,familyKeys:[m.familyKey],itemKeys:[m.itemKey],requiredAttempts:1};
  const deck=assignmentOrders(all,target);
  const session=new CafeSession('practice',1,{deck,orderLimit:deck.length});
  assert.equal(session.queue[0].order.id,order.id);
  session.submit(session.queue[0].uid,order.cups.map(c=>({...makeCup(),...c})));
  assert.equal(session.done,true);assert.equal(session.records.length,1);
 }
});
test('cup game cannot substitute a different difficulty or another family',()=>{
 const all=[...ORDERS,...REVIEW],m=orderMetadata(all[0]),target={...m,familyKeys:[m.familyKey]};
 assert.equal(assignmentOrders(all,{...target,difficulty:3}).length,0);
 assert.equal(assignmentOrders(all,{...target,itemKeys:['foreign']}).length,0);
});
