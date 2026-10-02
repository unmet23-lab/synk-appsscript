import test from 'node:test';
import assert from 'node:assert/strict';
import {CafeSession,ORDERS,REVIEW,makeCup,editCup,judgeOrder} from './core.mjs';
const cupsFor=order=>order.cups.map(c=>({...makeCup(),...c}));
test('all authored orders and new-sentence orders accept their conditions',()=>{
 for(const order of [...ORDERS,...REVIEW])assert.equal(judgeOrder(order,cupsFor(order)).correct,true,order.id);
});
test('negative instruction rejects sugar, while an unspecified ingredient is not a hidden requirement',()=>{
 const without=ORDERS.find(o=>o.id==='o03'),unspecified=ORDERS[0];
 assert.equal(judgeOrder(without,cupsFor(without).map(c=>({...c,sugar:true}))).kind,'sugar');
 assert.equal(judgeOrder(unspecified,cupsFor(unspecified).map(c=>({...c,sugar:true}))).correct,true);
});
test('two differently conditioned cups can be served in either order but cannot reuse a match',()=>{
 const o=ORDERS.find(o=>o.id==='o06'),cups=cupsFor(o);
 assert.equal(judgeOrder(o,[cups[1],cups[0]]).correct,true);
 assert.equal(judgeOrder(o,[cups[0],cups[0]]).correct,false);
 assert.equal(judgeOrder(o,[cups[0]]).kind,'quantity');
});
test('instead requires the replacement drink',()=>{
 const o=ORDERS.find(o=>o.id==='o09');assert.equal(judgeOrder(o,[{...makeCup(),base:'coffee'}]).kind,'drink');
});
test('removing ice preserves cold temperature; warming a cup removes ice',()=>{
 let c=editCup(makeCup(),'ice');assert.equal(c.temp,'cold');c=editCup(c,'ice');assert.equal(c.ice,false);assert.equal(c.temp,'cold');
 c=editCup(editCup(c,'ice'),'cold');assert.equal(c.temp,'hot');assert.equal(c.ice,false);
});
test('choosing tea removes milk, choosing the active base empties the drink',()=>{
 let c=editCup(editCup(makeCup(),'coffee'),'milk');c=editCup(c,'tea');assert.equal(c.milk,false);assert.equal(c.base,'tea');
 c=editCup(c,'tea');assert.equal(c.base,null);
});
test('a corrected order earns serving points but keeps the wrong first answer',()=>{
 const s=new CafeSession('practice'),t=s.queue[0];t.help=true;
 assert.equal(s.submit(t.uid,[makeCup()]).correct,false);assert.equal(s.submit(t.uid,cupsFor(t.order)).correct,true);
 assert.deepEqual(s.stats(),{served:1,answered:1,firstCorrect:0,help:1,unanswered:0});assert.equal(s.score,110);
});
test('practice finishes after eight served orders without a timer deadline',()=>{
 const s=new CafeSession('practice');s.step(5000);assert.equal(s.done,false);
 for(let i=0;i<8;i++){const t=s.queue[0];s.submit(t.uid,cupsFor(t.order));}
 assert.equal(s.done,true);assert.equal(s.stats().firstCorrect,8);assert.equal(s.queue.length,0);
});
test('rush has bounded queues, expiry records and a 90 second finish',()=>{
 const s=new CafeSession('rush',77);for(let i=0;i<90;i++){s.step(1);assert.ok(s.queue.length<=3);}
 assert.equal(s.done,true);assert.ok(s.records.some(r=>r.outcome==='missed'));assert.ok(s.stats().unanswered>0);assert.equal(s.stats().answered,0);
});
test('early finish separates a wrong attempted order from an unanswered one',()=>{
 const s=new CafeSession('rush',1);s.submit(s.queue[0].uid,[makeCup()]);s.step(8);s.finish();
 assert.equal(s.stats().answered,1);assert.equal(s.stats().unanswered,1);assert.equal(s.stats().served,0);
});
