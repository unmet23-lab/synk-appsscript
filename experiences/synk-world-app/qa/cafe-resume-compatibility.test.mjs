import test from 'node:test';
import assert from 'node:assert/strict';
import {PACKS,LESSONS,lessonById} from '../life-content.mjs';
import {createLifeProgress} from '../life-progress.mjs';
import {CAFE_COMPOSE_ID,resumeCafe,advanceCafe,chooseCafe,updateCafeOrder,submitCafeOrder,cafeReceipt,isCafeCheckpoint} from '../cafe-activity.mjs';
import {cafeMarkup} from '../cafe-ui.mjs';

const cache=()=>{const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};};
const stage=cafe=>({phase:'questions',sceneIndex:cafe.step,questionIndex:cafe.step,helped:false,cafe});
const progress=(storage,owner='guest')=>{const p=createLifeProgress({storage,owner,now:()=>1000000});p.summary(PACKS,LESSONS);return p;};
const fill=(state,order)=>Object.entries(order).reduce((s,[k,v])=>updateCafeOrder(s,k,v),state);

test('after removing one cup, the displayed repair adds two to reach the requested three',()=>{
 const id='cafe-visit-change',storage=cache(),p=progress(storage);p.startLesson(lessonById(id));
 let s=advanceCafe(resumeCafe(p.lessonState(id),id),id);s=chooseCafe(s,'a',id);
 p.recordAnswer({lessonId:id,questionId:lessonById(id).questions[0].id,choiceId:'a',correct:true,stage:stage(s)});
 s=advanceCafe(s,id);s=chooseCafe(s,'a',id);p.recordAnswer({lessonId:id,questionId:lessonById(id).questions[1].id,choiceId:'a',correct:false,stage:stage(s)});
 const current=resumeCafe(progress(storage).lessonState(id),id),receipt=cafeReceipt(current,id),html=cafeMarkup(current,{lessonId:id,photo:()=>''});
 assert.equal(receipt.count,1);assert.equal(current.phase,'repair');
 assert.match(html,/두 잔(?:을| 더)?(?: 더)? 추가/,'the repair instruction must add two cups to the displayed one');
 assert.doesNotMatch(html,/세 잔이 필요하시면 한 잔 더 추가/);
});

test('answers-only compose records accepted by storage and account import always resume to a usable checkpoint without rewriting answers',()=>{
 const id=CAFE_COMPOSE_ID,lesson=lessonById(id);
 for(const answered of [1,2,3])for(const firstChoice of ['a','b','c'])for(const order of [undefined,{drink:'tea',temperature:'warm',count:2},{drink:'tea',temperature:'warm',count:3},{drink:'juice',temperature:'cold',count:1}]){
  const storage=cache(),p=progress(storage);p.startLesson(lesson);
  for(const [i,q]of lesson.questions.slice(0,answered).entries()){
   const choiceId=i===0?firstChoice:q.answerId;
   p.recordAnswer({lessonId:id,questionId:q.id,choiceId,correct:choiceId===q.answerId,...(i===0&&order?{order}:{})});
  }
  const reopened=progress(storage);assert.notEqual(reopened.status().phase,'unreadable');
  const saved=reopened.exportSnapshot(),before=reopened.lessonState(id),resumed=resumeCafe(before,id);
  assert.ok(isCafeCheckpoint(resumed,id),JSON.stringify({answered,firstChoice,order,resumed}));
  assert.doesNotThrow(()=>cafeMarkup(resumed,{lessonId:id,photo:()=>''}));assert.doesNotThrow(()=>cafeReceipt(resumed,id));
  reopened.setStage(id,stage(resumed));assert.deepEqual(reopened.lessonState(id).answers,before.answers);assert.deepEqual(reopened.exportSnapshot().reviews,saved.reviews);
  assert.equal(reopened.lessonState(id).completedAt,null,'restoring a record must not invent completion');
  const accountStorage=cache(),account=progress(accountStorage,'account-a');account.importRecords({lessons:saved.lessons,reviews:saved.reviews,days:saved.daily?.days});
  const imported=progress(accountStorage,'account-a');assert.notEqual(imported.status().phase,'unreadable');const accountResume=resumeCafe(imported.lessonState(id),id);assert.ok(isCafeCheckpoint(accountResume,id));
  imported.setStage(id,stage(accountResume));assert.deepEqual(imported.lessonState(id).answers,before.answers);
  // The recovered state can still reach an explicit response/pickup while retaining immutable first answers.
  let next=resumed;if(next.phase==='welcome')next=advanceCafe(next,id);
  if(next.step===0&&['choose','repair'].includes(next.phase)){next=submitCafeOrder(fill(next,{drink:'tea',temperature:'warm',count:2}));}
  if(next.phase==='response')assert.doesNotThrow(()=>advanceCafe(next,id));
 }
});

test('valid compose checkpoints preserve partial orders, repairs, response, listening mode and each later step exactly',()=>{
 const id=CAFE_COMPOSE_ID,storage=cache(),p=progress(storage);p.startLesson(lessonById(id));
 const states=[resumeCafe(p.lessonState(id),id)];let s=advanceCafe(states[0],id);states.push(s);
 s=updateCafeOrder(s,'drink','tea');states.push(s);
 s=submitCafeOrder(fill(s,{drink:'tea',temperature:'cold',count:3}));states.push(s);
 s=submitCafeOrder(fill(s,{drink:'tea',temperature:'warm',count:2}));states.push(s);
 for(let step=1;step<3;step++){s=advanceCafe(s,id);states.push(s);s=chooseCafe(s,lessonById(id).questions[step].answerId,id);states.push(s);}
 for(const current of states)for(const listen of [undefined,{mode:'listen',heard:true,textShown:false},{mode:'read',heard:false,textShown:true}]){
  const checkpoint={...current,...(listen?{listen}:{})};assert.ok(isCafeCheckpoint(checkpoint,id));
  assert.deepEqual(resumeCafe({id,answers:{},stage:{cafe:checkpoint}},id),checkpoint);
 }
});
