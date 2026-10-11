import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createLifeProgress,LIFE_PROGRESS_KEY} from '../life-progress.mjs';
import {createLifeProgressPort} from '../life-progress-port.mjs';
import {PACKS,LESSONS} from '../life-content.mjs';
import {resumeCafe,advanceCafe,chooseCafe,cafeQuestion,CAFE_LESSON_ID} from '../cafe-activity.mjs';

const require=createRequire(import.meta.url);
const {createPlayFixture}=require('../../../../SYNK-talk/tests/lib/play-fixture.js');
const AT=Date.UTC(2026,9,11,2),DAY='2026-10-11',NEXT_DAY=AT+86400000;
function storage(){
 const data=new Map();
 return {data,get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
}
async function portFor(actor,{cache=storage(),guard=()=>{},mutate}={}){
 const unpack=async body=>{const data=await actor.call(body);if(data.status!==200)throw Object.assign(Error(data.error.code),data.error);return data;};
 const initial=await unpack();
 return createLifeProgressPort({accountId:initial.accountId,client:{load:()=>unpack(),mutate:mutate||unpack},guard,storage:cache,target:{}});
}
function progressFor(port,{now=()=>AT}={}){
 const progress=createLifeProgress({storage:port.storage,owner:port.accountId,mode:'account',guard:port.guard,save:port.flush,getSaveStatus:port.status,now});
 progress.summary(PACKS,LESSONS);return progress;
}
function answer(progress,lesson,question,{correct=true,helped=false}={}){
 const choiceId=correct?question.answerId:question.choices.find(choice=>choice.id!==question.answerId).id;
 return progress.recordAnswer({lessonId:lesson.id,questionId:question.id,choiceId,correct,helped});
}
const cloudRecord=async actor=>JSON.parse((await actor.call()).state.records[LIFE_PROGRESS_KEY]);

test('daily tutor memories, original answers, spacing and a cafe repair survive real JSONB and a fresh device',async()=>{
 const fixture=await createPlayFixture();let port,fresh;
 try{
  const actor=await fixture.actor();port=await portFor(actor);const progress=progressFor(port),lesson=LESSONS[0];
  progress.startLesson(lesson);
  answer(progress,lesson,lesson.questions[0]);
  answer(progress,lesson,lesson.questions[1],{helped:true});
  answer(progress,lesson,lesson.questions[2],{correct:false});
  const cafeLesson=LESSONS.find(value=>value.id===CAFE_LESSON_ID),q=cafeQuestion(0),wrong=q.choices.find(choice=>choice.id!==q.answerId).id;
  progress.startLesson(cafeLesson);
  const cafe=chooseCafe(advanceCafe(resumeCafe(progress.lessonState(cafeLesson.id))),wrong);
  progress.recordAnswer({lessonId:cafeLesson.id,questionId:q.id,choiceId:wrong,correct:false,stage:{phase:'questions',sceneIndex:0,questionIndex:0,cafe,helped:false}});
  const before=progress.exportSnapshot();
  progress.recordGuidedPractice({questionId:lesson.questions[2].id,tutorId:'kkamong'});
  progress.recordGuidedPractice({questionId:q.id,tutorId:'kkamong'});
  progress.markDayComplete();
  const desired=progress.exportSnapshot(),daily=desired.daily.days[DAY];
  assert.equal(daily.items[lesson.questions[0].id].outcome,'independent');
  assert.equal(daily.items[lesson.questions[1].id].outcome,'assisted');
  assert.equal(daily.items[lesson.questions[2].id].outcome,'retry');
  assert.equal(daily.items[q.id].tutorId,'kkamong');
  assert.ok(daily.items[q.id].guidedAt>=AT);assert.ok(daily.closedAt>=daily.items[q.id].guidedAt);
  assert.deepEqual(desired.lessons,before.lessons,'daily completion does not end the in-progress lesson or cafe visit');
  assert.deepEqual(desired.reviews,before.reviews,'guided success does not postpone due transfer reviews');
  await progress.flush();assert.equal(progress.status().saved,true);port.dispose();
  fresh=await portFor(actor);const restored=progressFor(fresh,{now:()=>NEXT_DAY});
  assert.deepEqual(restored.exportSnapshot(),desired,'a new device receives the exact persisted record');
  assert.deepEqual(resumeCafe(restored.lessonState(cafeLesson.id)),cafe);
  assert.equal(restored.lessonState(cafeLesson.id).completedAt,null);
  assert.equal(restored.lessonState(cafeLesson.id).answers[q.id].correct,false);
  assert.equal(restored.exportSnapshot().daily.days['2026-10-12'],undefined,'loading on a later day does not invent a new session');
  const [row]=await fixture.sql`select jsonb_typeof(state) kind,state->'records'->>${LIFE_PROGRESS_KEY} record from engine.synk_play_state where synk_user_id=${fresh.accountId}::uuid`;
  assert.equal(row.kind,'object');assert.deepEqual(JSON.parse(row.record).daily,desired.daily);
 }finally{port?.dispose();fresh?.dispose();await fixture.close();}
});

test('daily tutor records remain separate for A, B and guest, and an ended account rejects stale callbacks',async()=>{
 const fixture=await createPlayFixture();const cache=storage();let a,b,freshA,valid=true;
 try{
  const actorA=await fixture.actor(),actorB=await fixture.actor();
  a=await portFor(actorA,{cache,guard:()=>{if(!valid)throw Object.assign(Error('owner changed'),{code:'ACCOUNT_CHANGED'});}});
  const pa=progressFor(a),q=LESSONS[0].questions[0];pa.startLesson(LESSONS[0]);answer(pa,LESSONS[0],q,{correct:false});pa.recordGuidedPractice({questionId:q.id,tutorId:'marin'});pa.markDayComplete();await pa.flush();const savedA=pa.exportSnapshot();
  valid=false;
  assert.throws(()=>pa.recordGuidedPractice({questionId:q.id,tutorId:'mongle'}),{code:'ACCOUNT_CHANGED'});
  assert.throws(()=>pa.markDayComplete(),{code:'ACCOUNT_CHANGED'});
  await assert.rejects(pa.flush(),{code:'ACCOUNT_CHANGED'});a.dispose();
  b=await portFor(actorB,{cache});const pb=progressFor(b);
  assert.equal(pb.exportSnapshot().daily?.days?.[DAY],undefined);
  const guest=createLifeProgress({storage:cache,now:()=>AT});guest.summary(PACKS,LESSONS);
  assert.equal(guest.exportSnapshot().daily?.days?.[DAY],undefined);
  guest.startLesson(LESSONS[1]);answer(guest,LESSONS[1],LESSONS[1].questions[0],{correct:false});guest.recordGuidedPractice({questionId:LESSONS[1].questions[0].id,tutorId:'mongle'});guest.markDayComplete();
  const guestSaved=guest.exportSnapshot();assert.equal(guestSaved.owner,'guest');
  assert.equal(guestSaved.daily.days[DAY].items[q.id],undefined);
  pb.startLesson(LESSONS[2]);answer(pb,LESSONS[2],LESSONS[2].questions[0],{correct:false});pb.recordGuidedPractice({questionId:LESSONS[2].questions[0].id,tutorId:'kkamong'});await pb.flush();
  assert.equal(pb.exportSnapshot().daily.days[DAY].items[q.id],undefined);
  freshA=await portFor(actorA,{cache});const restored=progressFor(freshA);
  assert.deepEqual(restored.exportSnapshot(),savedA);
  assert.deepEqual(JSON.parse(cache.getItem(`${LIFE_PROGRESS_KEY}:guest`)),guestSaved);
  assert.equal((await cloudRecord(actorB)).owner,b.accountId);
  assert.notEqual(a.accountId,b.accountId);
 }finally{a?.dispose();b?.dispose();freshA?.dispose();await fixture.close();}
});

test('a server-committed daily save with a lost acknowledgement retries one command and retains one memory',async()=>{
 const fixture=await createPlayFixture();let port,fresh,drop=false;const commands=[];
 try{
  const actor=await fixture.actor();
  port=await portFor(actor,{mutate:async body=>{
   commands.push(structuredClone(body));const result=await actor.call(body);
   if(result.status!==200)throw Object.assign(Error(result.error.code),result.error);
   if(drop){drop=false;throw Error('synthetic lost acknowledgement after server commit');}return result;
  }});
  const progress=progressFor(port),lesson=LESSONS[0],q=lesson.questions[0];
  progress.startLesson(lesson);answer(progress,lesson,q,{correct:false});await progress.flush();
  const [before]=await fixture.sql`select count(*)::int n from engine.synk_play_commands where synk_user_id=${port.accountId}::uuid`;
  commands.length=0;drop=true;
  progress.recordGuidedPractice({questionId:q.id,tutorId:'mongle'});progress.markDayComplete();
  const desired=progress.exportSnapshot();await assert.rejects(progress.flush(),/lost acknowledgement/);
  assert.equal(progress.status().saved,false);assert.ok(port.status().pending>0);
  await progress.flush();assert.equal(progress.status().saved,true);
  assert.equal(commands[0].id,commands[1].id,'the accepted command is retried with its original id');
  assert.match(commands[0].id,/^[0-9a-f-]{36}$/i);
  const [after]=await fixture.sql`select count(*)::int n from engine.synk_play_commands where synk_user_id=${port.accountId}::uuid`;
  assert.equal(after.n-before.n,new Set(commands.map(command=>command.id)).size);
  assert.deepEqual(await cloudRecord(actor),desired);
  assert.equal(Object.keys(desired.daily.days[DAY].items).length,1);
  port.dispose();fresh=await portFor(actor);assert.deepEqual(progressFor(fresh).exportSnapshot(),desired);
 }finally{port?.dispose();fresh?.dispose();await fixture.close();}
});

test('a full local account queue cannot claim daily memory saved; explicit retry preserves the complete draft',async()=>{
 const fixture=await createPlayFixture(),cache=storage();const write=cache.setItem;let full=false,port;
 cache.setItem=(key,value)=>{if(full)throw Object.assign(Error('synthetic quota exceeded'),{name:'QuotaExceededError'});write(key,value);};
 try{
  const actor=await fixture.actor();port=await portFor(actor,{cache});const progress=progressFor(port),lesson=LESSONS[0],q=lesson.questions[0];
  progress.startLesson(lesson);answer(progress,lesson,q,{correct:false});await progress.flush();
  const remoteBefore=await cloudRecord(actor);full=true;
  progress.recordGuidedPractice({questionId:q.id,tutorId:'marin'});progress.markDayComplete();
  const draft=progress.exportSnapshot();assert.equal(progress.status().saved,false);assert.equal(progress.status().phase,'unsaved');
  assert.ok(draft.daily.days[DAY].items[q.id].guidedAt>=AT);assert.ok(draft.daily.days[DAY].closedAt>=draft.daily.days[DAY].items[q.id].guidedAt);
  assert.deepEqual(await cloudRecord(actor),remoteBefore,'the server still has its previous confirmed record');
  await assert.rejects(progress.flush(),{name:'QuotaExceededError'});assert.equal(progress.status().saved,false);
  full=false;await progress.flush();assert.equal(progress.status().saved,true);assert.deepEqual(await cloudRecord(actor),draft);
  assert.deepEqual(draft.lessons,remoteBefore.lessons);assert.deepEqual(draft.reviews,remoteBefore.reviews);
 }finally{port?.dispose();await fixture.close();}
});
