import test from 'node:test';
import assert from 'node:assert/strict';
import {CafeSession,ORDERS,makeCup,judgeOrder,DEFAULT_TUNING} from './core.mjs';
import {orderMetadata,orderAnswer,FLOW_RUSH,FLOW_PRACTICE,FLOW_SKILLS,FLOW_WORDS,tuningFrom,chooseOrderLive,pressureOf,describeChanges,easierSuggestion,closingObservation} from './learning.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createGame}=require('../../atlas/game-learning.js'),{createMap}=require('../../strata/index.js'),Flow=require('../../atlas/flow.js');
const map=createMap(require('../../strata/maps/topik-i.json'));
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
const clock=()=>{let t=Date.parse('2026-10-02T09:00:00.000Z');return ()=>new Date(t+=1000).toISOString();};
const cupsFor=order=>order.cups.map(c=>({...makeCup(),...c}));

// One rush shift driven by the real engine. `quick` serves at a share of patience; `missEvery`
// lets a customer leave now and then. Returns the tuning the session ended with.
function shift({quick=0.3,missEvery=0,mode='auto'}={}){
 const coach=createGame({gameId:'order-rush',map,storage:memory(),clock:clock()});
 const live=coach.live(FLOW_RUSH,{skillIds:FLOW_SKILLS,words:FLOW_WORDS,declared:mode==='fixed'?{mode:'fixed'}:{}});
 const session=new CafeSession('rush',7,{deck:ORDERS,selectOrder:orders=>chooseOrderLive(live,orders).selected,tuning:tuningFrom(live.settings().values)});
 const lines=[];
 for(let served=0;served<14;served++){
  const t=session.queue[0];if(!t)break;
  const pid=live.present(orderMetadata(t.order));
  if(missEvery&&served%missEvery===0){
   session.time=t.born+t.patience;session.step(0);
   const out=live.answer(pid,{correct:null,assessable:false,reason:'unanswered'},{outcome:'timeout'});
   session.tune(tuningFrom(out.settings.values));if(out.line)lines.push(out.line.text);continue;
  }
  session.time=t.born+t.patience*quick;
  const judged=judgeOrder(t.order,cupsFor(t.order));
  const out=live.answer(pid,{...orderAnswer(judged,{audioCompleted:true}),attemptNo:1},{pressure:pressureOf(t,session)});
  session.submit(t.uid,cupsFor(t.order));session.tune(tuningFrom(out.settings.values));if(out.line)lines.push(out.line.text);
  if(!session.queue.length)session.spawn();
 }
 return {tuning:session.tuning,lines,live};
}

test('the rush declaration is valid and its defaults are the original rush',()=>{
 const spec=Flow.defineContent(FLOW_RUSH),run=Flow.start({spec,now:'2026-10-02T09:00:00.000Z'});
 const values=run.settings().values;
 assert.equal(values.patience,DEFAULT_TUNING.patience);assert.equal(values.spawnEvery,DEFAULT_TUNING.spawnEvery);assert.equal(values.queueMax,DEFAULT_TUNING.queueMax);
 Flow.defineContent(FLOW_PRACTICE);
});

test('a quick, accurate person gets a busier cafe; a person whose customers leave gets more time',()=>{
 const quick=shift({quick:0.25}),missing=shift({quick:0.6,missEvery:2});
 assert.ok(quick.tuning.patience<=DEFAULT_TUNING.patience||quick.tuning.spawnEvery<=DEFAULT_TUNING.spawnEvery,'busier for the quick person');
 assert.ok(quick.lines.length>0,'each change is said in the cafe');
 assert.ok(missing.tuning.patience>DEFAULT_TUNING.patience,'customers wait longer for the person who needs time');
 assert.ok(missing.lines.includes(FLOW_WORDS['ease.pace']));
});

test('fixed speed keeps the original rush whatever happens',()=>{
 const fixed=shift({quick:0.6,missEvery:2,mode:'fixed'});
 assert.deepEqual({patience:fixed.tuning.patience,spawnEvery:fixed.tuning.spawnEvery,queueMax:fixed.tuning.queueMax},{patience:42,spawnEvery:10,queueMax:3});
 assert.equal(fixed.lines.length,0);
});

test('the session clamps tuning and each customer keeps the patience they arrived with',()=>{
 const session=new CafeSession('rush',3,{deck:ORDERS,tuning:{patience:999,spawnEvery:1,queueMax:9}});
 assert.deepEqual({patience:session.tuning.patience,spawnEvery:session.tuning.spawnEvery,queueMax:session.tuning.queueMax},{patience:90,spawnEvery:4,queueMax:5});
 const first=session.queue[0];session.tune({patience:30});
 assert.equal(first.patience,90);
 session.time=first.born+40;session.step(0);
 assert.ok(session.queue.includes(first),'an earlier customer is not rushed by a later change');
});

test('when the rush keeps easing and still gets away, the shift points to the calmer mode',()=>{
 const missing=shift({quick:0.6,missEvery:1});
 const end=missing.live.end();
 assert.ok(end.changes.filter(c=>c.kind==='pace'&&c.direction<0).length>=2);
 assert.match(easierSuggestion(FLOW_RUSH,end,{answered:1,unanswered:9,firstCorrect:0}),/한가한 오픈/);
 assert.equal(easierSuggestion(FLOW_RUSH,end,{answered:9,unanswered:0,firstCorrect:8}),null,'not when the shift went well');
 assert.equal(easierSuggestion(FLOW_PRACTICE,end,{answered:1,unanswered:9,firstCorrect:0}),null);
});

test('the shift summary names settings in the cafe words, never the person',()=>{
 const lines=describeChanges(FLOW_RUSH,{'item.difficulty':1,patience:42,spawnEvery:10,queueMax:3},{'item.difficulty':2,patience:48,spawnEvery:10,queueMax:3});
 assert.deepEqual(lines,['손님이 기다리는 시간 42초 → 48초','주문 종류 한 잔 기본 주문 → 빼기·바꾸기가 있는 주문']);
 for(const text of lines)assert.doesNotMatch(text,/실력|점수|잘|못/);
});

test('a customer who leaves is time running out, also after a wrong cup; nothing is counted twice',()=>{
 assert.deepEqual(closingObservation({presentationId:'p1',attempts:0,outcome:'missed'}),{answer:true,outcome:'timeout'});
 assert.deepEqual(closingObservation({presentationId:'p1',attempts:0,outcome:'unanswered'}),{answer:true,outcome:'skip'},'the shift ended: not evidence');
 assert.deepEqual(closingObservation({presentationId:'p1',attempts:1,outcome:'missed'}),{answer:false,outcome:'timeout'},'left while the wrong cup was being fixed');
 assert.deepEqual(closingObservation({attempts:0,outcome:'missed'}),{answer:false,outcome:'timeout'},'left before the order was even heard');
 assert.equal(closingObservation({presentationId:'p1',attempts:1,outcome:'served'}),null);
 assert.equal(closingObservation({presentationId:'p1',attempts:0,outcome:'missed',learningClosed:true}),null);
 assert.equal(closingObservation({presentationId:'p1',attempts:1,outcome:'missed',flowClosed:true}),null);
});

test('the shift follows the practice Core asked for: with missed negation orders, a negation order comes first even at the easiest level',()=>{
 const coach=createGame({gameId:'order-rush',map,storage:memory(),clock:clock()});
 for(let i=0;i<3;i++){
  const meta={...orderMetadata(ORDERS[2]),id:`probe.negation.${i}`,itemKey:`probe.negation.${i}`,familyKey:`probe.negation.${i}`};
  const pid=coach.present(meta);coach.delivery(pid,{audio:'completed'});coach.answer(pid,{correct:false,assessable:true});
 }
 for(const spec of [FLOW_PRACTICE,FLOW_RUSH]){
  const live=coach.live(spec,{skillIds:FLOW_SKILLS,words:FLOW_WORDS});
  assert.equal(live.settings().level,1,'the flow starts at plain orders');
  const pick=chooseOrderLive(live,ORDERS);
  assert.equal(orderMetadata(pick.selected).skillId,'ko.listening.negation',`${spec.id}: Core's practice first`);
  assert.equal(pick.focusSkillId,'ko.listening.negation');
 }
});
