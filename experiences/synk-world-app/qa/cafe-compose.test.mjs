import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PACKS,LESSONS,lessonById} from '../life-content.mjs';
import {createLifeProgress} from '../life-progress.mjs';
import {CAFE_COMPOSE_ID,resumeCafe,advanceCafe,updateCafeOrder,submitCafeOrder,cafeReceipt,cafeOrderText,chooseCafe,chooseCafeSeat,isCafeCheckpoint} from '../cafe-activity.mjs';
const cache=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value))};};
const stage=cafe=>({phase:'questions',sceneIndex:cafe.step,questionIndex:cafe.step,cafe,helped:false});
const setup=(storage=cache(),owner='guest')=>{const p=createLifeProgress({storage,owner,now:()=>1000000});p.summary(PACKS,LESSONS);p.startLesson(lessonById(CAFE_COMPOSE_ID));return p;};
const fill=(s,order)=>Object.entries(order).reduce((s,[key,value])=>updateCafeOrder(s,key,value),s);
test('all 21 earlier lessons and transfers retain their exact data',()=>{
 const baseline=JSON.parse(fs.readFileSync(new URL('./cafe-complete-20261010/previous-lessons.json',import.meta.url)));assert.equal(baseline.length,21);
 for(const l of baseline)assert.equal(createHash('sha256').update(JSON.stringify(lessonById(l.id))).digest('hex'),l.sha256,l.id);
});
test('all 12 order combinations update the full sentence, cup count and temperature',()=>{
 for(const drink of ['juice','tea'])for(const temperature of ['cold','warm'])for(const count of [1,2,3]){
  const s=fill(advanceCafe(resumeCafe({answers:{}},CAFE_COMPOSE_ID),CAFE_COMPOSE_ID),{drink,temperature,count});
  const r=cafeReceipt(s,CAFE_COMPOSE_ID);assert.equal(r.count,count);assert.ok(cafeOrderText(s.order).includes(drink==='tea'?'차':'주스'));assert.ok(cafeOrderText(s.order).startsWith(temperature==='cold'?'차가운':'따뜻한'));
  const submitted=submitCafeOrder(s);assert.equal(submitted.phase,drink==='tea'&&temperature==='warm'&&count===2?'response':'repair');assert.ok(isCafeCheckpoint(submitted,CAFE_COMPOSE_ID));
 }
});
test('partial order survives reload and cannot be submitted until every field is set',()=>{
 const storage=cache(),p=setup(storage);let s=advanceCafe(resumeCafe(p.lessonState(CAFE_COMPOSE_ID)),CAFE_COMPOSE_ID);s=updateCafeOrder(s,'drink','tea');p.setStage(CAFE_COMPOSE_ID,stage(s));
 const restored=setup(storage);assert.deepEqual(resumeCafe(restored.lessonState(CAFE_COMPOSE_ID)),s);assert.throws(()=>submitCafeOrder(s));assert.equal(cafeReceipt(s,CAFE_COMPOSE_ID).count,0);
 assert.throws(()=>updateCafeOrder(s,'count',20));assert.throws(()=>updateCafeOrder(s,'unexpected','x'));
});
test('correction preserves the exact original assembled order and due review',()=>{
 const p=setup();let s=fill(advanceCafe(resumeCafe(p.lessonState(CAFE_COMPOSE_ID)),CAFE_COMPOSE_ID),{drink:'tea',temperature:'cold',count:3});s=submitCafeOrder(s);
 p.recordAnswer({lessonId:CAFE_COMPOSE_ID,questionId:'cafe-compose-order',choiceId:s.choiceId,correct:false,order:s.order,stage:stage(s),input:{mode:'listen',heard:true,textShown:false}});
 s=submitCafeOrder(fill(s,{temperature:'warm',count:2}));p.setStage(CAFE_COMPOSE_ID,stage(s));const first=p.lessonState(CAFE_COMPOSE_ID).answers['cafe-compose-order'];
 assert.deepEqual(first.order,{drink:'tea',temperature:'cold',count:3});assert.equal(first.correct,false);assert.equal(first.input.heard,true);assert.equal(p.exportSnapshot().reviews['cafe-compose-order-transfer'].dueAt,1060000);
});
test('order assembly continues through confirmation, seating and explicit pickup exactly once',()=>{
 const p=setup();let s=submitCafeOrder(fill(advanceCafe(resumeCafe(p.lessonState(CAFE_COMPOSE_ID)),CAFE_COMPOSE_ID),{drink:'tea',temperature:'warm',count:2}));
 for(const q of lessonById(CAFE_COMPOSE_ID).questions){if(s.step>0)s=chooseCafe(s,q.answerId,CAFE_COMPOSE_ID);p.recordAnswer({lessonId:CAFE_COMPOSE_ID,questionId:q.id,choiceId:q.answerId,correct:true,stage:stage(s),...(s.step===0?{order:s.order}:{})});if(s.step===2){s=chooseCafeSeat(s,'garden',CAFE_COMPOSE_ID);p.setStage(CAFE_COMPOSE_ID,stage(s));assert.throws(()=>p.finishLesson(CAFE_COMPOSE_ID),{code:'LIFE_CAFE_NOT_RECEIVED'});}s=advanceCafe(s,CAFE_COMPOSE_ID);p.setStage(CAFE_COMPOSE_ID,stage(s));}
 assert.equal(cafeReceipt(s,CAFE_COMPOSE_ID).place,'화분 옆 자리');assert.equal(p.finishLesson(CAFE_COMPOSE_ID).duplicate,false);assert.equal(p.finishLesson(CAFE_COMPOSE_ID).duplicate,true);
 const b=setup(cache(),'player-b');assert.equal(Object.keys(b.lessonState(CAFE_COMPOSE_ID).answers).length,0);
});
test('invalid response metadata cannot overwrite stored learning data',()=>{
 const p=setup(),before=p.exportSnapshot();assert.throws(()=>p.recordAnswer({lessonId:CAFE_COMPOSE_ID,questionId:'cafe-compose-order',choiceId:'a',correct:true,order:{drink:'tea',temperature:'warm',count:999}}));assert.deepEqual(p.exportSnapshot(),before);
 const invalid={...resumeCafe(p.lessonState(CAFE_COMPOSE_ID)),listen:{mode:'listen',heard:true,textShown:false,extra:true}};assert.throws(()=>p.setStage(CAFE_COMPOSE_ID,stage(invalid)));assert.deepEqual(p.exportSnapshot(),before);
});
