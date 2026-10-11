import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createLifeProgress,LIFE_PROGRESS_KEY} from '../life-progress.mjs';
import {createLifeProgressPort} from '../life-progress-port.mjs';
import {PACKS,LESSONS} from '../life-content.mjs';
import {resumeCafe,advanceCafe,chooseCafe,cafeQuestion,CAFE_LESSON_ID} from '../cafe-activity.mjs';

const require=createRequire(import.meta.url);
const {createPlayFixture}=require('../../../../SYNK-talk/tests/lib/play-fixture.js');
const AT=Date.UTC(2026,9,12,2),DAY='2026-10-12';
function storage(){
 const data=new Map();
 return {data,get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
}
async function portFor(actor,{cache=storage(),guard=()=>{},mutate}={}){
 const unpack=async body=>{const data=await actor.call(body);if(data.status!==200)throw Object.assign(Error(data.error.code),data.error);return data;};
 const initial=await unpack();
 return createLifeProgressPort({accountId:initial.accountId,client:{load:()=>unpack(),mutate:mutate||unpack},guard,storage:cache,target:{}});
}
function progressFor(port){
 const progress=createLifeProgress({storage:port.storage,owner:port.accountId,mode:'account',guard:port.guard,save:port.flush,getSaveStatus:port.status,now:()=>AT});
 progress.summary(PACKS,LESSONS);return progress;
}
const cloudRecord=async actor=>JSON.parse((await actor.call()).state.records[LIFE_PROGRESS_KEY]);

test('chosen tutor crosses real JSONB and a fresh device without changing answers, cafe checkpoint or historical tutor attribution',async()=>{
 const fixture=await createPlayFixture();let port,fresh;
 try{
  const actor=await fixture.actor();port=await portFor(actor);const progress=progressFor(port),lesson=LESSONS[0],q=lesson.questions[0];
  assert.equal(progress.selectedTutor(),null);
  progress.startLesson(lesson);
  progress.recordAnswer({lessonId:lesson.id,questionId:q.id,choiceId:q.choices.find(c=>c.id!==q.answerId).id,correct:false});
  progress.recordGuidedPractice({questionId:q.id,tutorId:'kkamong'});
  const cafeLesson=LESSONS.find(value=>value.id===CAFE_LESSON_ID),cq=cafeQuestion(0),wrong=cq.choices.find(c=>c.id!==cq.answerId).id;
  progress.startLesson(cafeLesson);
  const cafe=chooseCafe(advanceCafe(resumeCafe(progress.lessonState(cafeLesson.id))),wrong);
  progress.recordAnswer({lessonId:cafeLesson.id,questionId:cq.id,choiceId:wrong,correct:false,stage:{phase:'questions',sceneIndex:0,questionIndex:0,cafe,helped:false}});
  progress.recordGuidedPractice({questionId:cq.id,tutorId:'marin'});
  progress.markDayComplete();await progress.flush();
  const before=progress.exportSnapshot();
  for(const tutor of ['marin','kkamong','mongle'])assert.equal(progress.selectTutor(tutor).tutor,tutor);
  const after=progress.exportSnapshot();
  for(const key of Object.keys(before).filter(key=>key!=='revision'))assert.deepEqual(after[key],before[key],`${key} stays unchanged by tutor selection`);
  assert.deepEqual(after.tutor,{version:1,selected:'mongle'});
  assert.equal(after.daily.days[DAY].items[q.id].tutorId,'kkamong');
  assert.equal(after.daily.days[DAY].items[cq.id].tutorId,'marin');
  await progress.flush();assert.equal(progress.status().saved,true);port.dispose();
  fresh=await portFor(actor);const restored=progressFor(fresh);
  assert.equal(restored.selectedTutor(),'mongle');assert.deepEqual(restored.exportSnapshot(),after);
  assert.deepEqual(resumeCafe(restored.lessonState(cafeLesson.id)),cafe);
  const [row]=await fixture.sql`select jsonb_typeof(state) kind,state->'records'->>${LIFE_PROGRESS_KEY} record from engine.synk_play_state where synk_user_id=${fresh.accountId}::uuid`;
  assert.equal(row.kind,'object');assert.equal(JSON.parse(row.record).tutor.selected,'mongle');
 }finally{port?.dispose();fresh?.dispose();await fixture.close();}
});

test('account A, account B and guest keep separate tutors and old account callbacks cannot read or write a choice',async()=>{
 const fixture=await createPlayFixture(),cache=storage();let a,b,freshA,valid=true;
 try{
  const actorA=await fixture.actor(),actorB=await fixture.actor();
  a=await portFor(actorA,{cache,guard:()=>{if(!valid)throw Object.assign(Error('owner changed'),{code:'ACCOUNT_CHANGED'});}});
  const pa=progressFor(a);pa.selectTutor('kkamong');await pa.flush();
  valid=false;
  assert.throws(()=>pa.selectedTutor(),{code:'ACCOUNT_CHANGED'});
  assert.throws(()=>pa.selectTutor('marin'),{code:'ACCOUNT_CHANGED'});
  await assert.rejects(pa.flush(),{code:'ACCOUNT_CHANGED'});a.dispose();
  b=await portFor(actorB,{cache});const pb=progressFor(b);assert.equal(pb.selectedTutor(),null);
  pb.selectTutor('marin');await pb.flush();
  const guest=createLifeProgress({storage:cache,now:()=>AT});assert.equal(guest.selectedTutor(),null);
  guest.selectTutor('mongle');assert.equal(guest.selectedTutor(),'mongle');
  freshA=await portFor(actorA,{cache});assert.equal(progressFor(freshA).selectedTutor(),'kkamong');
  assert.equal((await cloudRecord(actorB)).tutor.selected,'marin');
  assert.equal(JSON.parse(cache.getItem(`${LIFE_PROGRESS_KEY}:guest`)).tutor.selected,'mongle');
  pb.stop();assert.throws(()=>pb.selectTutor('mongle'),{code:'ACCOUNT_CHANGED'});
  assert.throws(()=>pb.selectedTutor(),{code:'ACCOUNT_CHANGED'});
 }finally{a?.dispose();b?.dispose();freshA?.dispose();await fixture.close();}
});

test('a tutor save with a lost acknowledgement retries the same command and arrives once on a fresh device',async()=>{
 const fixture=await createPlayFixture();let port,fresh,drop=true;const commands=[];
 try{
  const actor=await fixture.actor();
  port=await portFor(actor,{mutate:async body=>{
   commands.push(structuredClone(body));const result=await actor.call(body);
   if(result.status!==200)throw Object.assign(Error(result.error.code),result.error);
   if(drop){drop=false;throw Error('synthetic lost acknowledgement');}return result;
  }});
  const progress=progressFor(port);progress.selectTutor('kkamong');
  await assert.rejects(progress.flush(),/lost acknowledgement/);
  assert.equal(progress.status().saved,false);assert.equal(port.status().pending,1);
  assert.equal((await cloudRecord(actor)).tutor.selected,'kkamong','the server committed before the lost response');
  await progress.flush();assert.equal(progress.status().saved,true);
  assert.equal(commands.length,2);assert.equal(commands[0].id,commands[1].id);
  const [count]=await fixture.sql`select count(*)::int n from engine.synk_play_commands where synk_user_id=${port.accountId}::uuid`;
  assert.equal(count.n,1);port.dispose();fresh=await portFor(actor);
  assert.equal(progressFor(fresh).selectedTutor(),'kkamong');
 }finally{port?.dispose();fresh?.dispose();await fixture.close();}
});

test('concurrent tutor choices preserve both drafts until the account record is explicitly chosen',async()=>{
 const fixture=await createPlayFixture(),secondCache=storage();let first,second,fresh;
 try{
  const actor=await fixture.actor();first=await portFor(actor);second=await portFor(actor,{cache:secondCache});
  const a=progressFor(first),b=progressFor(second);
  a.selectTutor('marin');b.selectTutor('kkamong');await a.flush();
  await assert.rejects(b.flush(),{code:'REVISION_CONFLICT'});
  assert.equal(second.status().phase,'conflict');assert.equal(b.selectedTutor(),'kkamong');
  assert.equal((await cloudRecord(actor)).tutor.selected,'marin');
  assert.throws(()=>b.selectTutor('mongle'),{code:'REVISION_CONFLICT'});
  await second.resolve('remote');
  assert.ok([...secondCache.data.keys()].some(key=>key.includes(':recovery:')),'the previous local draft is retained in recovery storage');
  assert.equal(progressFor(second).selectedTutor(),'marin');
  fresh=await portFor(actor);assert.equal(progressFor(fresh).selectedTutor(),'marin');
 }finally{first?.dispose();second?.dispose();fresh?.dispose();await fixture.close();}
});

test('a full local queue preserves the tutor draft for retry and does not claim account storage',async()=>{
 const fixture=await createPlayFixture(),cache=storage();let port,full=false;
 const write=cache.setItem;cache.setItem=(key,value)=>{if(full)throw Object.assign(Error('synthetic quota exceeded'),{name:'QuotaExceededError'});write(key,value);};
 try{
  const actor=await fixture.actor();port=await portFor(actor,{cache});const progress=progressFor(port);
  progress.selectTutor('marin');await progress.flush();
  full=true;progress.selectTutor('mongle');assert.equal(progress.selectedTutor(),'mongle');
  assert.equal(progress.status().saved,false);assert.equal(progress.status().phase,'unsaved');
  assert.equal((await cloudRecord(actor)).tutor.selected,'marin');
  await assert.rejects(progress.flush(),{name:'QuotaExceededError'});
  full=false;await progress.flush();assert.equal(progress.status().saved,true);
  assert.equal((await cloudRecord(actor)).tutor.selected,'mongle');
 }finally{port?.dispose();await fixture.close();}
});

test('same tutor is a no-op, old records remain readable, and malformed tutor fields cannot overwrite their source',async()=>{
 const fixture=await createPlayFixture();let port;
 try{
  const actor=await fixture.actor();port=await portFor(actor);const progress=progressFor(port);
  assert.equal(progress.selectedTutor(),null);progress.selectTutor('kkamong');await progress.flush();
  const before=await actor.call(),revision=progress.exportSnapshot().revision;
  assert.equal(progress.selectTutor('kkamong').duplicate,true);await progress.flush();
  assert.equal(progress.exportSnapshot().revision,revision);
  assert.equal((await actor.call()).revision,before.revision);
  const [count]=await fixture.sql`select count(*)::int n from engine.synk_play_commands where synk_user_id=${port.accountId}::uuid`;
  assert.equal(count.n,1);
  assert.throws(()=>progress.selectTutor('unknown'),TypeError);
  for(const tutor of [null,[],{},'kkamong',{version:2,selected:'kkamong'},{version:1,selected:'unknown'},{version:1,selected:'marin',owner:'different'},{version:1,selected:'marin',updatedAt:AT}]){
   const cache=storage(),key=`${LIFE_PROGRESS_KEY}:guest`,base={version:1,owner:'guest',revision:0,activeLessonId:null,activeReview:null,lessons:{},reviews:{},tutor},raw=JSON.stringify(base);
   cache.setItem(key,raw);const invalid=createLifeProgress({storage:cache});
   assert.equal(invalid.status().phase,'unreadable');
   assert.throws(()=>invalid.selectedTutor(),{code:'LIFE_PROGRESS_UNREADABLE'});
   assert.throws(()=>invalid.selectTutor('mongle'),{code:'LIFE_PROGRESS_UNREADABLE'});
   assert.equal(cache.getItem(key),raw);
  }
 }finally{port?.dispose();await fixture.close();}
});

test('tutor selection never trims a near-capacity daily record and refuses unreadable growth',()=>{
 const cache=storage(),key=`${LIFE_PROGRESS_KEY}:guest`;
 const daily={version:1,days:{[DAY]:{items:{q:{lessonId:'lesson',guidedAt:AT,tutorId:'marin'}}}}};
 const base={version:1,owner:'guest',revision:0,activeLessonId:null,activeReview:null,lessons:{},reviews:{},daily,preservedExtension:{parts:Array.from({length:16},()=> 'x'.repeat(30000))}};
 cache.setItem(key,JSON.stringify(base));const progress=createLifeProgress({storage:cache});
 progress.selectTutor('kkamong');assert.deepEqual(progress.exportSnapshot().daily,daily);
 const oversized=structuredClone(base);oversized.preservedExtension.parts.push('');
 oversized.preservedExtension.parts[16]='x'.repeat(499990-JSON.stringify(oversized).length);
 const raw=JSON.stringify(oversized);assert.equal(raw.length,499990);cache.setItem(key,raw);
 const bounded=createLifeProgress({storage:cache});
 assert.throws(()=>bounded.selectTutor('mongle'),{code:'PLAY_DATA_TOO_LARGE'});
 assert.equal(cache.getItem(key),raw);assert.equal(bounded.selectedTutor(),null);
 assert.deepEqual(bounded.exportSnapshot().daily,daily);
});
