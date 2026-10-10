import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createLifeProgress,LIFE_PROGRESS_KEY} from '../life-progress.mjs';
import {createLifeProgressPort} from '../life-progress-port.mjs';
import {PACKS,LESSONS} from '../life-content.mjs';
import {resumeCafe,advanceCafe,chooseCafe,cafeQuestion,CAFE_LESSON_ID,CAFE_LESSON_IDS,CAFE_COMPOSE_ID,updateCafeOrder,submitCafeOrder} from '../cafe-activity.mjs';
const require=createRequire(import.meta.url);
const {createPlayFixture}=require('../../../../SYNK-talk/tests/lib/play-fixture.js');
const storage=()=>{const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};};
const portFor=async actor=>{
 const initial=await actor.call(),client={load:async()=>{const data=await actor.call();if(data.status!==200)throw Object.assign(Error(data.error.code),data.error);return data;},mutate:async body=>{const data=await actor.call(body);if(data.status!==200)throw Object.assign(Error(data.error.code),data.error);return data;}};
 return createLifeProgressPort({accountId:initial.accountId,client,guard:()=>{},storage:storage(),target:{}});
};

test('the complete real life record survives canonical JSONB storage and a fresh device',async()=>{
 const fixture=await createPlayFixture();let port,fresh;
 try{
  const actor=await fixture.actor();port=await portFor(actor);
  const progress=createLifeProgress({storage:port.storage,owner:port.accountId,mode:'account',guard:port.guard,save:port.flush,getSaveStatus:port.status});
  progress.summary(PACKS,LESSONS);progress.startLesson(LESSONS[0]);
  for(const question of LESSONS[0].questions)progress.recordAnswer({lessonId:LESSONS[0].id,questionId:question.id,choiceId:question.answerId,correct:true});
  progress.finishLesson(LESSONS[0].id);progress.startLesson(LESSONS[1]);progress.setStage(LESSONS[1].id,{phase:'story',sceneIndex:3});await progress.flush();port.dispose();
  fresh=await portFor(actor);const restored=createLifeProgress({storage:fresh.storage,owner:fresh.accountId,mode:'account',guard:fresh.guard,save:fresh.flush,getSaveStatus:fresh.status});
  const summary=restored.summary(PACKS,LESSONS);assert.equal(summary.completed,1);assert.equal(summary.nextLesson.id,LESSONS[1].id);assert.equal(restored.lessonState(LESSONS[1].id).stage.sceneIndex,3);assert.equal(restored.status().saved,true);
  const [row]=await fixture.sql`select jsonb_typeof(state) kind, state->'records'->>${LIFE_PROGRESS_KEY} record from engine.synk_play_state where synk_user_id=${fresh.accountId}::uuid`;
  assert.equal(row.kind,'object');assert.equal(JSON.parse(row.record).owner,fresh.accountId);assert.equal(JSON.parse(row.record).lessons[LESSONS[0].id].completedAt!==null,true);
 }finally{port?.dispose();fresh?.dispose();await fixture.close();}
});
test('the real server preserves the alternate device until an explicit progress choice',async()=>{
 const fixture=await createPlayFixture();let first,second;
 try{
  const actor=await fixture.actor();first=await portFor(actor);second=await portFor(actor);
  const a=createLifeProgress({storage:first.storage,owner:first.accountId,mode:'account',guard:first.guard,save:first.flush,getSaveStatus:first.status});
  const b=createLifeProgress({storage:second.storage,owner:second.accountId,mode:'account',guard:second.guard,save:second.flush,getSaveStatus:second.status});
  a.startLesson(LESSONS[0]);b.startLesson(LESSONS[1]);await a.flush();await assert.rejects(b.flush(),{code:'REVISION_CONFLICT'});assert.equal(second.status().phase,'conflict');
  const cloudBefore=await actor.call();assert.equal(JSON.parse(cloudBefore.state.records[LIFE_PROGRESS_KEY]).activeLessonId,LESSONS[0].id);
  await second.resolve('local');const cloudAfter=await actor.call();assert.equal(JSON.parse(cloudAfter.state.records[LIFE_PROGRESS_KEY]).activeLessonId,LESSONS[1].id);
 }finally{first?.dispose();second?.dispose();await fixture.close();}
});

test('the physical cafe checkpoint and immutable first response survive a fresh official device port',async()=>{
 const fixture=await createPlayFixture();let port,fresh;
 try{
  const actor=await fixture.actor();port=await portFor(actor);
  const p=createLifeProgress({storage:port.storage,owner:port.accountId,mode:'account',guard:port.guard,save:port.flush,getSaveStatus:port.status});p.summary(PACKS,LESSONS);p.startLesson(LESSONS.find(l=>l.id===CAFE_LESSON_ID));
  let cafe=advanceCafe(resumeCafe(p.lessonState(CAFE_LESSON_ID)));cafe=chooseCafe(cafe,'a');const q=cafeQuestion(0);
  p.recordAnswer({lessonId:CAFE_LESSON_ID,questionId:q.id,choiceId:'a',correct:false,stage:{phase:'questions',sceneIndex:0,questionIndex:0,cafe,helped:false}});await p.flush();port.dispose();
  fresh=await portFor(actor);const restored=createLifeProgress({storage:fresh.storage,owner:fresh.accountId,mode:'account',guard:fresh.guard,save:fresh.flush,getSaveStatus:fresh.status});restored.summary(PACKS,LESSONS);
  assert.deepEqual(resumeCafe(restored.lessonState(CAFE_LESSON_ID)),cafe);assert.equal(restored.lessonState(CAFE_LESSON_ID).answers[q.id].correct,false);assert.equal(restored.lessonState(CAFE_LESSON_ID).completedAt,null);
  cafe=chooseCafe(cafe,'b');restored.setStage(CAFE_LESSON_ID,{phase:'questions',sceneIndex:0,questionIndex:0,cafe,helped:false});await restored.flush();const saved=await actor.call();const record=JSON.parse(saved.state.records[LIFE_PROGRESS_KEY]);
  assert.equal(record.lessons[CAFE_LESSON_ID].stage.cafe.phase,'response');assert.equal(record.lessons[CAFE_LESSON_ID].answers[q.id].choiceId,'a');assert.equal(record.lessons[CAFE_LESSON_ID].completedAt,null);
 }finally{port?.dispose();fresh?.dispose();await fixture.close();}
});

test('three distinct cafe visits roundtrip through real JSONB without leaking into another account',async()=>{
 const fixture=await createPlayFixture();let port,fresh,other;
 try{
  const actor=await fixture.actor();port=await portFor(actor);
  const p=createLifeProgress({storage:port.storage,owner:port.accountId,mode:'account',guard:port.guard,save:port.flush,getSaveStatus:port.status});p.summary(PACKS,LESSONS);
  const checkpoints=new Map();
  for(const id of CAFE_LESSON_IDS.filter(id=>id!=='cafe-compose').slice(1)){
   p.startLesson(LESSONS.find(l=>l.id===id));let cafe=advanceCafe(resumeCafe(p.lessonState(id),id),id);
   const q=cafeQuestion(0,id),choice=q.choices.find(c=>c.id!==q.answerId).id;cafe=chooseCafe(cafe,choice,id);
   p.recordAnswer({lessonId:id,questionId:q.id,choiceId:choice,correct:false,stage:{phase:'questions',sceneIndex:0,questionIndex:0,cafe,helped:false}});checkpoints.set(id,cafe);
  }
  await p.flush();port.dispose();fresh=await portFor(actor);
  const restored=createLifeProgress({storage:fresh.storage,owner:fresh.accountId,mode:'account',guard:fresh.guard,save:fresh.flush,getSaveStatus:fresh.status});restored.summary(PACKS,LESSONS);
  for(const [id,cafe]of checkpoints){assert.deepEqual(resumeCafe(restored.lessonState(id),id),cafe);assert.equal(restored.lessonState(id).answers[cafeQuestion(0,id).id].correct,false);}
  assert.equal(restored.summary(PACKS,LESSONS).nextLesson.id,'cafe-visit-change');
  other=await portFor(await fixture.actor());const separated=createLifeProgress({storage:other.storage,owner:other.accountId,mode:'account',guard:other.guard,save:other.flush,getSaveStatus:other.status});separated.summary(PACKS,LESSONS);
  for(const id of CAFE_LESSON_IDS.filter(id=>id!=='cafe-compose').slice(1))assert.equal(separated.lessonState(id).status,'new');
 }finally{port?.dispose();fresh?.dispose();other?.dispose();await fixture.close();}
});

test('assembled order and listening help roundtrip atomically through actual JSONB',async()=>{
 const fixture=await createPlayFixture();let port,fresh;
 try{
  const actor=await fixture.actor();port=await portFor(actor);
  const p=createLifeProgress({storage:port.storage,owner:port.accountId,mode:'account',guard:port.guard,save:port.flush,getSaveStatus:port.status});p.summary(PACKS,LESSONS);p.startLesson(LESSONS.find(l=>l.id===CAFE_COMPOSE_ID));
  let cafe=advanceCafe(resumeCafe(p.lessonState(CAFE_COMPOSE_ID)),CAFE_COMPOSE_ID);cafe=updateCafeOrder(cafe,'drink','tea');p.setStage(CAFE_COMPOSE_ID,{phase:'questions',sceneIndex:0,questionIndex:0,cafe,helped:false});await p.flush();
  fresh=await portFor(actor);const r=createLifeProgress({storage:fresh.storage,owner:fresh.accountId,mode:'account',guard:fresh.guard,save:fresh.flush,getSaveStatus:fresh.status});r.summary(PACKS,LESSONS);assert.deepEqual(resumeCafe(r.lessonState(CAFE_COMPOSE_ID)),cafe);
  cafe=updateCafeOrder(updateCafeOrder(cafe,'temperature','cold'),'count',3);cafe=submitCafeOrder(cafe);
  r.recordAnswer({lessonId:CAFE_COMPOSE_ID,questionId:'cafe-compose-order',choiceId:cafe.choiceId,correct:false,order:cafe.order,input:{mode:'listen',heard:false,textShown:true},stage:{phase:'questions',sceneIndex:0,questionIndex:0,cafe,helped:false}});await r.flush();
  const data=JSON.parse((await actor.call()).state.records[LIFE_PROGRESS_KEY]);assert.deepEqual(data.lessons[CAFE_COMPOSE_ID].answers['cafe-compose-order'].order,{drink:'tea',temperature:'cold',count:3});assert.equal(data.lessons[CAFE_COMPOSE_ID].answers['cafe-compose-order'].helped,true);assert.equal(data.lessons[CAFE_COMPOSE_ID].stage.cafe.phase,'repair');
 }finally{port?.dispose();fresh?.dispose();await fixture.close();}
});
