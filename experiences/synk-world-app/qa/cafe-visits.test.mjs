import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PACKS,LESSONS,lessonById} from '../life-content.mjs';
import {createLifeProgress} from '../life-progress.mjs';
import {CAFE_LESSON_IDS,CAFE_VISITS,resumeCafe,chooseCafe,advanceCafe,chooseCafeSeat,cafeReceipt,isCafeCheckpoint} from '../cafe-activity.mjs';
import {cafeMarkup,cafeCompletionMarkup} from '../cafe-ui.mjs';
const cache=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value))};};
const stage=cafe=>({phase:'questions',sceneIndex:cafe.step,questionIndex:cafe.step,cafe,helped:false});
const storyVisits=CAFE_LESSON_IDS.filter(id=>id!=='cafe-compose');
const progress=(storage=cache(),owner='guest')=>{const p=createLifeProgress({storage,owner,now:()=>1000000});p.summary(PACKS,LESSONS);return p;};
function select(p,id,state,choiceId){const l=lessonById(id),q=l.questions[state.step],next=chooseCafe(state,choiceId,id);if(!p.lessonState(id).answers[q.id])p.recordAnswer({lessonId:id,questionId:q.id,choiceId,correct:choiceId===q.answerId,stage:stage(next)});else p.setStage(id,stage(next));return next;}
function forward(p,id,state){const next=advanceCafe(state,id);p.setStage(id,stage(next));return next;}
function complete(p,id){p.startLesson(lessonById(id));let s=forward(p,id,resumeCafe(p.lessonState(id),id));while(s.phase!=='complete'){if(s.phase==='break')s=forward(p,id,s);else{s=select(p,id,s,lessonById(id).questions[s.step].answerId);s=forward(p,id,s);}}p.finishLesson(id);return s;}

test('all eighteen earlier lesson and review meanings retain their exact stable data',()=>{
 const signatures=JSON.parse(fs.readFileSync(new URL('./cafe-visits-20261010/previous-lessons.json',import.meta.url),'utf8'));
 assert.equal(signatures.length,18);
 for(const old of signatures)assert.equal(createHash('sha256').update(JSON.stringify(lessonById(old.id))).digest('hex'),old.sha256,old.id);
});
test('every new visit restores corrections and keeps completion behind actual pickup',()=>{
 for(const id of storyVisits.slice(1)){
  const storage=cache(),p=progress(storage);p.startLesson(lessonById(id));let s=forward(p,id,resumeCafe(p.lessonState(id),id));
  for(const q of lessonById(id).questions){
   const wrong=q.choices.find(c=>c.id!==q.answerId).id;s=select(p,id,s,wrong);assert.equal(s.phase,'repair');assert.throws(()=>advanceCafe(s,id));
   const fresh=progress(storage);assert.deepEqual(resumeCafe(fresh.lessonState(id),id),s);assert.equal(fresh.summary(PACKS,LESSONS).nextLesson.id,id);
   s=select(p,id,s,q.answerId);assert.equal(p.lessonState(id).answers[q.id].choiceId,wrong);
   if(s.step===2){assert.equal(cafeReceipt(s,id).received,false);assert.throws(()=>p.finishLesson(id),{code:'LIFE_CAFE_NOT_RECEIVED'});}
   s=forward(p,id,s);
  }
  assert.equal(cafeReceipt(s,id).received,true);assert.equal(p.finishLesson(id).duplicate,false);assert.equal(p.finishLesson(id).duplicate,true);
  assert.equal(Object.keys(p.exportSnapshot().reviews).length,3);
 }
});
test('sold out choices never create a drink and adding or removing a cup matches the spoken request',()=>{
 const state={version:1,step:0,phase:'choose',seat:'window',choiceId:null};
 for(const choice of ['b','c']){const receipt=cafeReceipt(chooseCafe(state,choice,'cafe-visit-soldout'),'cafe-visit-soldout');assert.equal(receipt.drink,null);assert.equal(receipt.count,0);assert.equal(receipt.received,false);}
 const count={...state,step:1};
 for(const [choice,expected]of [['a',1],['b',3],['c',2]])assert.equal(cafeReceipt(chooseCafe(count,choice,'cafe-visit-change'),'cafe-visit-change').count,expected);
});
test('seat selection is available only for store use and survives the final received checkpoint',()=>{
 const id='cafe-visit-taste',p=progress();p.startLesson(lessonById(id));let s=forward(p,id,resumeCafe(p.lessonState(id),id));
 assert.throws(()=>chooseCafeSeat(s,'garden',id));
 for(const q of lessonById(id).questions){s=select(p,id,s,q.answerId);if(s.step===2){s=chooseCafeSeat(s,'garden',id);p.setStage(id,stage(s));}s=forward(p,id,s);}
 assert.equal(cafeReceipt(s,id).place,'화분 옆 자리');
 assert.throws(()=>chooseCafeSeat({version:1,step:2,phase:'response',choiceId:'b',seat:'window'},'garden','cafe-visit-soldout'));
});
test('home follows four cafe visits, an active other lesson takes priority, and an old completed visit stays completed',()=>{
 const storage=cache(),p=progress(storage);assert.equal(p.summary(PACKS,LESSONS).nextLesson.id,'greetings-expressions');
 for(const [index,id]of storyVisits.entries()){complete(p,id);const s=p.summary(PACKS,LESSONS);assert.equal(s.cafe.completed,index+1);assert.equal(s.nextLesson.id,CAFE_LESSON_IDS[index+1]);}
 const restored=progress(storage);assert.equal(restored.summary(PACKS,LESSONS).cafe.completed,4);
 restored.startLesson(lessonById('transit-story'));assert.equal(restored.summary(PACKS,LESSONS).nextLesson.id,'transit-story');
 const other=progress(storage,'player-b');assert.equal(other.summary(PACKS,LESSONS).cafe.completed,0);
});
test('new checkpoints cannot use another visit answer or the old mid-visit break',()=>{
 const wrong={version:1,step:0,phase:'response',choiceId:'a',seat:'window'};
 assert.equal(isCafeCheckpoint(wrong,'cafe-visit-change'),true);assert.equal(isCafeCheckpoint(wrong,'cafe-visit-taste'),false);
 for(const id of storyVisits.slice(1))assert.equal(isCafeCheckpoint({...wrong,step:2,phase:'break',choiceId:null},id),false);
 const p=progress();p.startLesson(lessonById('cafe-visit-taste'));const original=p.exportSnapshot();assert.throws(()=>p.setStage('cafe-visit-taste',stage(wrong)));assert.deepEqual(p.exportSnapshot(),original);
});
test('each new opening and ending exposes all three approved voices in the actual rendered UI',()=>{
 for(const visit of CAFE_VISITS.filter(v=>v.id!=='cafe-compose').slice(1)){
  const opening=cafeMarkup(resumeCafe({answers:{}},visit.id),{lessonId:visit.id,photo:id=>`<img alt="${id}">`});
  for(const line of lessonById(visit.id).scenes)assert.ok(opening.includes(line.text),visit.id);
  const ending=cafeCompletionMarkup({lessonId:visit.id,photo:id=>`<img alt="${id}">`,state:{version:1,step:3,phase:'complete',choiceId:null,seat:'window'}});
  for(const line of visit.ending.lines)assert.ok(ending.includes(line.text),visit.id);
  for(const step of visit.steps)for(const text of [step.friend,...Object.values(step.options).map(o=>o.friend)]){
   if(step.speaker==='marine')assert.doesNotMatch(text,/[!?！？]/,visit.id);
   if(step.speaker==='mongle')assert.match(text,/[!?]/,visit.id);
  }
 }
});
