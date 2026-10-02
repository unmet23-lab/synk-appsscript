import test from 'node:test';
import assert from 'node:assert/strict';
import {CafeSession,ORDERS,REVIEW,makeCup,judgeOrder} from './core.mjs';
import {orderMetadata,chooseOrder,orderAnswer} from './learning.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createGame}=require('../../../../atlas/game-learning.js'),{createMap}=require('../../../../strata/index.js');
const map=createMap(require('../../../../strata/maps/topik-i.json'));
function actualCoach(){const data=new Map();return createGame({gameId:'order-rush',map,storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});}
const cupsFor=order=>order.cups.map(c=>({...makeCup(),...c}));

test('a shared need changes the actual next order while preserving the eight-order shift',()=>{
 const coach={recommend:candidates=>({selected:candidates.find(c=>c.skillIds.includes('ko.listening.negation'))||candidates[0]})};
 const session=new CafeSession('practice',1,{deck:ORDERS,orderLimit:8,selectOrder:orders=>chooseOrder(coach,orders).selected});
 assert.equal(session.queue[0].order.id,'o03');
 const played=[];
 while(!session.done){const t=session.queue[0];played.push(t.order.id);session.submit(t.uid,cupsFor(t.order));}
 assert.equal(played.length,8);assert.equal(new Set(played).size,8);assert.equal(session.stats().served,8);
});

test('review selection consumes only the authored review pool',()=>{
 const session=new CafeSession('practice',1,{deck:REVIEW,selectOrder:orders=>orders.at(-1)});
 const ids=[];while(!session.done){const t=session.queue[0];ids.push(t.order.id);session.submit(t.uid,cupsFor(t.order));}
 assert.deepEqual(ids,['r03','r02','r01']);
});

test('audio not completed is excluded even when the final cup happens to match',()=>{
 const result=judgeOrder(ORDERS[0],cupsFor(ORDERS[0]));
 assert.deepEqual(orderAnswer(result,{}),{correct:true,assessable:false,reason:'audio'});
 assert.equal(orderAnswer(result,{audioCompleted:true}).assessable,true);
});

test('content IDs are stable and changed requests do not inherit a plain quantity diagnosis',()=>{
 const all=[...ORDERS,...REVIEW].map(orderMetadata);
 assert.equal(new Set(all.map(m=>m.itemKey)).size,all.length);
 assert.ok(all.every(m=>m.audioRequired&&m.modality==='listening'&&!m.confounded));
 assert.equal(orderMetadata(ORDERS.find(o=>o.id==='o09')).skillId,'ko.listening.negation');
 assert.equal(orderMetadata(ORDERS.find(o=>o.id==='o06')).skillId,'ko.listening.condition');
});

test('real Atlas evidence changes the next order and excludes text-assisted or unheard answers',()=>{
 const coach=actualCoach();
 for(let i=0;i<3;i++){
  const meta={...orderMetadata(ORDERS[2]),id:`probe.negation.${i}`,itemKey:`probe.negation.${i}`,familyKey:`probe.negation.${i}`};
  const pid=coach.present(meta);coach.delivery(pid,{audio:'completed'});coach.answer(pid,{correct:false,assessable:true});
 }
 assert.equal(chooseOrder(coach,ORDERS).selected.id,'o03');
 const helped=coach.present(orderMetadata(ORDERS[0]));coach.delivery(helped,{audio:'completed'});coach.help(helped,'text');
 assert.equal(coach.answer(helped,{correct:true,assessable:true}).independent,false);
 const unheard=coach.present(orderMetadata(ORDERS[1]));coach.delivery(unheard,{audio:'failed'});
 assert.equal(coach.answer(unheard,{correct:true,assessable:true}).verdict,'unassessed');
 assert.equal(coach.summary().skills.find(s=>s.id==='ko.listening.detail').n,0);
});

test('a corrected serving retains the first wrong answer without counting a new independent success',()=>{
 const coach=actualCoach(),pid=coach.present(orderMetadata(ORDERS[0]));coach.delivery(pid,{audio:'completed'});
 const first=coach.answer(pid,{correct:false,assessable:true,attemptNo:1});coach.help(pid,'hint');
 const retry=coach.answer(pid,{correct:true,assessable:true,attemptNo:2});
 assert.equal(first.verdict,'incorrect');assert.equal(retry.verdict,'correct');assert.equal(retry.independent,false);
 assert.equal(coach.answer(pid,{correct:true,assessable:true,attemptNo:2}).eventId,retry.eventId);
 const skill=coach.summary().skills.find(s=>s.id==='ko.listening.detail');assert.equal(skill.n,1);assert.equal(skill.incorrect,1);assert.equal(skill.correct,0);
});
