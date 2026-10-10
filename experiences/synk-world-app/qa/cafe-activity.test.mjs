import test from 'node:test';
import assert from 'node:assert/strict';
import {PACKS,LESSONS,lessonById} from '../life-content.mjs';
import {createLifeProgress} from '../life-progress.mjs';
import {CAFE_LESSON_ID,CAFE_STEPS,isCafeCheckpoint,resumeCafe,chooseCafe,advanceCafe,chooseCafeSeat,cafeReceipt,cafeQuestion} from '../cafe-activity.mjs';
const memory=()=>{const data=new Map();let writes=0;return {getItem:key=>data.get(key)??null,setItem(key,value){writes++;data.set(key,String(value));},get writes(){return writes;},data};};
const stage=(cafe,helped=false)=>({phase:'questions',sceneIndex:cafe.step,questionIndex:cafe.step,cafe,helped});
function fixture(owner='guest',storage=memory()){
 const p=createLifeProgress({owner,storage,now:()=>1000000});p.summary(PACKS,LESSONS);p.startLesson(lessonById(CAFE_LESSON_ID));
 return {p,storage,state:resumeCafe(p.lessonState(CAFE_LESSON_ID))};
}
function select(p,state,id,{helped=false}={}){
 const next=chooseCafe(state,id),q=cafeQuestion(state.step);
 if(!p.lessonState(CAFE_LESSON_ID).answers[q.id])p.recordAnswer({lessonId:CAFE_LESSON_ID,questionId:q.id,choiceId:id,correct:id===q.answerId,helped,stage:stage(next,helped)});
 else p.setStage(CAFE_LESSON_ID,stage(next,helped));return next;
}
function advance(p,state){const next=advanceCafe(state);p.setStage(CAFE_LESSON_ID,stage(next));return next;}

test('wrong cup count changes the physical order, while correction retains the first error',()=>{
 const {p,storage}=fixture();let state=advanceCafe(resumeCafe(p.lessonState(CAFE_LESSON_ID)));p.setStage(CAFE_LESSON_ID,stage(state));
 const writes=storage.writes;state=select(p,state,'a');assert.equal(storage.writes,writes+1,'answer and checkpoint are written atomically');assert.equal(cafeReceipt(state).count,1);assert.equal(state.phase,'repair');assert.throws(()=>advanceCafe(state));
 state=select(p,state,'b');assert.equal(cafeReceipt(state).count,2);assert.equal(state.phase,'response');assert.equal(p.lessonState(CAFE_LESSON_ID).answers['cafe-apply-order'].correct,false);assert.equal(Object.keys(p.exportSnapshot().reviews).length,1);
 const restored=createLifeProgress({storage,now:()=>1000000});restored.summary(PACKS,LESSONS);assert.deepEqual(resumeCafe(restored.lessonState(CAFE_LESSON_ID)),state);
 assert.equal(restored.exportSnapshot().reviews['cafe-apply-order-transfer'].dueAt,1060000);
});
test('temperature, cancellation, and takeaway visibly match each actual choice',()=>{
 let state=advanceCafe(resumeCafe({answers:{}}));state=chooseCafe(state,'c');assert.equal(cafeReceipt(state).drink,'warm');assert.equal(cafeReceipt(state).count,2);
 state={version:1,step:2,phase:'choose',choiceId:null,seat:'window'};
 assert.equal(cafeReceipt(chooseCafe(state,'c')).count,0);assert.equal(cafeReceipt(chooseCafe(state,'b')).drink,'tea');assert.equal(cafeReceipt(chooseCafe(state,'a')).drink,'takeout');
});
test('all three responses cannot complete the activity until the takeaway is explicitly received',()=>{
 const {p}=fixture();let state=advance(p,resumeCafe(p.lessonState(CAFE_LESSON_ID)));
 state=select(p,state,'b');state=advance(p,state);state=select(p,state,'c');state=chooseCafeSeat(state,'garden');p.setStage(CAFE_LESSON_ID,stage(state));state=advance(p,state);
 assert.equal(state.phase,'break');assert.equal(cafeReceipt(state).received,true);assert.equal(cafeReceipt(state).place,'화분 옆 자리');
 state=advance(p,state);state=select(p,state,'a');assert.equal(cafeReceipt(state).received,false);
 assert.throws(()=>p.finishLesson(CAFE_LESSON_ID),{code:'LIFE_CAFE_NOT_RECEIVED'});
 state=advance(p,state);assert.equal(cafeReceipt(state).received,true);assert.equal(p.finishLesson(CAFE_LESSON_ID).duplicate,false);assert.equal(p.finishLesson(CAFE_LESSON_ID).duplicate,true);assert.equal(p.summary(PACKS,LESSONS).completed,1);
});
test('help before selecting survives a reload and is registered even when the language choice is correct',()=>{
 const {p,storage}=fixture();const state=advanceCafe(resumeCafe(p.lessonState(CAFE_LESSON_ID)));p.setStage(CAFE_LESSON_ID,stage(state,true));
 const restored=createLifeProgress({storage,now:()=>1000000});restored.summary(PACKS,LESSONS);const current=restored.lessonState(CAFE_LESSON_ID);select(restored,resumeCafe(current),'b',{helped:current.stage.helped});
 assert.equal(restored.lessonState(CAFE_LESSON_ID).answers['cafe-apply-order'].helped,true);assert.equal(restored.exportSnapshot().reviews['cafe-apply-order-transfer'].dueAt,1060000);
});
test('paused seat selection and physical pickup checkpoint survive owner-scoped reload',()=>{
 const {p,storage}=fixture('player-a');let state=advance(p,resumeCafe(p.lessonState(CAFE_LESSON_ID)));state=select(p,state,'b');state=advance(p,state);state=select(p,state,'c');state=chooseCafeSeat(state,'garden');p.setStage(CAFE_LESSON_ID,stage(state));
 const restored=createLifeProgress({owner:'player-a',storage});restored.summary(PACKS,LESSONS);assert.deepEqual(resumeCafe(restored.lessonState(CAFE_LESSON_ID)),state);assert.equal(cafeReceipt(state).received,false);
 const other=createLifeProgress({owner:'player-b',storage});other.summary(PACKS,LESSONS);assert.equal(other.lessonState(CAFE_LESSON_ID).status,'new');
});
test('legacy reading records retain their answers and reopen the last explicit physical action',()=>{
 const {p}=fixture();const l=lessonById(CAFE_LESSON_ID);for(const q of l.questions)p.recordAnswer({lessonId:l.id,questionId:q.id,choiceId:q.answerId,correct:true});
 const migrated=resumeCafe(p.lessonState(l.id));assert.equal(migrated.step,2);assert.equal(migrated.phase,'response');assert.equal(cafeReceipt(migrated).received,false);assert.equal(Object.keys(p.lessonState(l.id).answers).length,3);
 const fresh=resumeCafe({answers:{}});assert.equal(fresh.phase,'welcome');
});
test('invalid action checkpoints cannot overwrite the preserved record or manufacture pickup',()=>{
 const {p,storage,state}=fixture(),original=storage.getItem(p.key);
 for(const invalid of [{...state,step:3,phase:'complete'},{...state,phase:'response',choiceId:'a'},{...state,phase:'break'},{...state,seat:'roof'},{...state,extra:true}]){
  assert.throws(()=>p.setStage(CAFE_LESSON_ID,stage(invalid)));assert.equal(storage.getItem(p.key),original);
 }
 assert.equal(isCafeCheckpoint({...state,phase:'choose',choiceId:'b'}),false);
 const invalidStage={...state,phase:'response',choiceId:'a'};
 assert.throws(()=>p.recordAnswer({lessonId:CAFE_LESSON_ID,questionId:'cafe-apply-order',choiceId:'a',correct:false,stage:stage(invalidStage)}));assert.equal(storage.getItem(p.key),original,'an invalid atomic checkpoint must retain the original');
});
test('corrupt saved cafe checkpoints preserve the original and reject further writes',()=>{
 const {p,storage}=fixture();const raw=JSON.parse(storage.getItem(p.key));raw.lessons[CAFE_LESSON_ID].stage=stage({version:1,step:1,phase:'response',choiceId:'a',seat:'window'});const original=JSON.stringify(raw);storage.setItem(p.key,original);
 const restored=createLifeProgress({storage});assert.equal(restored.status().phase,'unreadable');assert.throws(()=>restored.startLesson(lessonById(CAFE_LESSON_ID)),{code:'LIFE_PROGRESS_UNREADABLE'});assert.equal(storage.getItem(p.key),original);
});
test('cafe choices use exactly the existing stable learning and transfer identifiers',()=>{
 const lesson=lessonById(CAFE_LESSON_ID);
 assert.equal(lesson.questions.length,CAFE_STEPS.length);
 for(const [index,q]of lesson.questions.entries()){assert.equal(cafeQuestion(index),q);assert.deepEqual(Object.keys(CAFE_STEPS[index].options),q.choices.map(c=>c.id));assert.ok(isCafeCheckpoint(chooseCafe({version:1,step:index,phase:'choose',choiceId:null,seat:'window'},q.answerId)));}
});
