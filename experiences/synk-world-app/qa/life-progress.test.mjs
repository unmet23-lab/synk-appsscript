import test from 'node:test';
import assert from 'node:assert/strict';
import {createLifeProgress,LIFE_PROGRESS_KEY} from '../life-progress.mjs';
import {createWorldAccount} from '../world-account.mjs';
import {emptyPlayState,validatePlayValue,validatePlayChanges} from '../../play-common/play-data.mjs';

const storage=()=>{const data=new Map();return {get length(){return data.size;},key:index=>[...data.keys()][index]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key),data};};
const lesson=id=>({id,packId:'cafe',questions:['one','two','three'].map((name,index)=>({id:`${id}-${name}`,skillId:`cafe-skill-${index}`,review:{id:`${id}-${name}-transfer`}}))});
const lessons=[lesson('cafe-expressions'),lesson('cafe-story'),lesson('cafe-apply')],packs=[{id:'cafe',lessons}];
const options=()=>{let tick=1000000;return {now:()=>tick,advance:amount=>tick+=amount};};
function answerAll(progress,lesson,{correct=true,helped=false}={}){for(const q of lesson.questions)progress.recordAnswer({lessonId:lesson.id,questionId:q.id,correct,helped,choiceId:'a'});}

test('the life key is allowed directly, with no borrowing another game record',()=>{
 assert.equal(validatePlayValue(LIFE_PROGRESS_KEY,'{"version":1}'),' {"version":1}'.trim());
 assert.equal(validatePlayChanges([{key:LIFE_PROGRESS_KEY,previous:null,value:'{"version":1}'}])[0].key,LIFE_PROGRESS_KEY);
});
test('lesson starts, intermediate story stage and answer resume across reloads',()=>{
 const cache=storage(),clock=options(),first=createLifeProgress({storage:cache,owner:'guest',now:clock.now});
 first.summary(packs);first.startLesson(lessons[1]);first.setStage(lessons[1].id,{phase:'story',sceneIndex:4,questionIndex:0});
 const resumed=createLifeProgress({storage:cache,owner:'guest',now:clock.now});resumed.summary(packs);
 assert.equal(resumed.lessonState(lessons[1].id).stage.sceneIndex,4);assert.equal(resumed.summary(packs).nextLesson.id,lessons[1].id);
 resumed.setStage(lessons[1].id,{phase:'questions',questionIndex:0});resumed.recordAnswer({lessonId:lessons[1].id,questionId:lessons[1].questions[0].id,correct:true});
 assert.equal(createLifeProgress({storage:cache,owner:'guest',now:clock.now}).lessonState(lessons[1].id).cursor,1);
});
test('first answers persist; a retry cannot erase an error or a help-used review',()=>{
 const clock=options(),progress=createLifeProgress({storage:storage(),now:clock.now});progress.startLesson(lessons[0]);
 const first=lessons[0].questions[0];progress.recordAnswer({lessonId:lessons[0].id,questionId:first.id,correct:false});
 const duplicate=progress.recordAnswer({lessonId:lessons[0].id,questionId:first.id,correct:true});assert.equal(duplicate.duplicate,true);
 assert.equal(progress.lessonState(lessons[0].id).answers[first.id].correct,false);
 progress.recordAnswer({lessonId:lessons[0].id,questionId:lessons[0].questions[1].id,correct:true,helped:true});
 clock.advance(60000);assert.equal(progress.dueReviews().length,2);
 progress.startLesson(lessons[0],{replay:true});progress.recordAnswer({lessonId:lessons[0].id,questionId:first.id,correct:true});
 assert.equal(progress.dueReviews().some(r=>r.questionId===first.id),true,'an easy replay must retain the difficult review');
});
test('lesson replay preserves scheduled transfer review, and new errors only bring it forward',()=>{
 const clock=options(),progress=createLifeProgress({storage:storage(),now:clock.now}),l=lessons[0],q=l.questions[0],id=q.review.id;
 progress.startLesson(l);answerAll(progress,l,{correct:false});progress.finishLesson(l.id);
 const initial=progress.exportSnapshot().reviews[id];clock.advance(30000);
 progress.startLesson(l,{replay:true});answerAll(progress,l);progress.finishLesson(l.id);
 let current=progress.exportSnapshot().reviews[id];assert.equal(current.dueAt,initial.dueAt,'correct replay before due time must retain the first-error appointment');assert.equal(current.intervalDays,initial.intervalDays);assert.equal(current.streak,initial.streak);
 clock.advance(10000);progress.startLesson(l,{replay:true});answerAll(progress,l,{correct:false});progress.finishLesson(l.id);
 current=progress.exportSnapshot().reviews[id];assert.equal(current.dueAt,initial.dueAt,'a second error must not delay an earlier appointment');
 clock.advance(60000);progress.startLesson(l,{replay:true});answerAll(progress,l,{correct:false});progress.finishLesson(l.id);
 assert.equal(progress.exportSnapshot().reviews[id].dueAt,initial.dueAt,'an already due review must remain due');
 let run=progress.startReview(3);for(const reviewId of run.ids)progress.answerReview({id:reviewId,runId:run.id,correct:true});clock.advance(86400000);
 run=progress.startReview(3);for(const reviewId of run.ids)progress.answerReview({id:reviewId,runId:run.id,correct:true});
 const spaced=progress.exportSnapshot().reviews[id];assert.equal(spaced.intervalDays,3);
 progress.startLesson(l,{replay:true});answerAll(progress,l);progress.finishLesson(l.id);current=progress.exportSnapshot().reviews[id];
 assert.equal(current.dueAt,spaced.dueAt);assert.equal(current.intervalDays,spaced.intervalDays);assert.equal(current.streak,spaced.streak,'only a transfer review can advance the review streak');
});
test('help opened before choosing is remembered through reload in lessons and reviews',()=>{
 const cache=storage(),clock=options(),first=createLifeProgress({storage:cache,now:clock.now});first.startLesson(lessons[0]);first.setStage(lessons[0].id,{phase:'questions',questionIndex:0,helped:true});
 const resumed=createLifeProgress({storage:cache,now:clock.now});resumed.summary(packs);resumed.recordAnswer({lessonId:lessons[0].id,questionId:lessons[0].questions[0].id,correct:true});
 assert.equal(resumed.lessonState(lessons[0].id).answers[lessons[0].questions[0].id].helped,true);
 clock.advance(60000);const run=resumed.startReview();resumed.markReviewHelp(run.ids[0]);
 const reviewResumed=createLifeProgress({storage:cache,now:clock.now});assert.equal(reviewResumed.answerReview({id:run.ids[0],correct:true}).intervalDays,0);
});
test('completion requires all questions, is idempotent, and selects the next lesson',()=>{
 const progress=createLifeProgress({storage:storage()});progress.summary(packs);progress.startLesson(lessons[0]);
 assert.throws(()=>progress.finishLesson(lessons[0].id),{code:'LIFE_LESSON_INCOMPLETE'});
 answerAll(progress,lessons[0]);assert.equal(progress.finishLesson(lessons[0].id).totalCompleted,1);
 assert.equal(progress.finishLesson(lessons[0].id).duplicate,true);assert.equal(progress.summary(packs).nextLesson.id,lessons[1].id);
 progress.startLesson(lessons[0],{replay:true});answerAll(progress,lessons[0]);assert.equal(progress.finishLesson(lessons[0].id).totalCompleted,1);
});
test('wrong/help reviews become due in a minute; successful transfer reviews expand intervals',()=>{
 const clock=options(),progress=createLifeProgress({storage:storage(),now:clock.now});progress.startLesson(lessons[0]);answerAll(progress,lessons[0],{correct:false});
 assert.equal(progress.dueReviews().length,0);clock.advance(60000);assert.equal(progress.summary(packs).dueCount,3);
 const run=progress.startReview(1),id=run.ids[0];assert.equal(progress.answerReview({id,runId:run.id,correct:true}).intervalDays,1);
 assert.equal(progress.answerReview({id,runId:run.id,correct:false}).duplicate,true);
 clock.advance(86400000);const another=progress.startReview(3);assert.notEqual(another.id,run.id);
 assert.equal(progress.answerReview({id,runId:another.id,correct:true}).intervalDays,3);
 const wrong=another.ids.find(value=>value!==id);assert.equal(progress.answerReview({id:wrong,runId:another.id,correct:true,helped:true}).intervalDays,0);
 clock.advance(60000);assert.equal(progress.dueReviews().some(value=>value.id===wrong),true);
});
test('a review session resumes from remaining questions after reload',()=>{
 const cache=storage(),clock=options(),p=createLifeProgress({storage:cache,now:clock.now});p.startLesson(lessons[0]);answerAll(p,lessons[0],{correct:false});clock.advance(60000);
 const run=p.startReview(3);p.answerReview({id:run.ids[0],correct:true});
 const resumed=createLifeProgress({storage:cache,now:clock.now}),same=resumed.startReview(3);assert.equal(same.id,run.id);assert.equal(Object.keys(same.answers).length,1);
});
test('guest, account A and account B retain separate local progress without implicit import',()=>{
 const cache=storage(),a=createLifeProgress({storage:cache,owner:'account-a'}),b=createLifeProgress({storage:cache,owner:'account-b'}),guest=createLifeProgress({storage:cache,owner:'guest'});
 a.startLesson(lessons[0]);answerAll(a,lessons[0]);a.finishLesson(lessons[0].id);
 assert.equal(a.summary(packs).completed,1);assert.equal(b.summary(packs).completed,0);assert.equal(guest.summary(packs).completed,0);assert.notEqual(a.key,b.key);
 assert.equal(a.status().phase,'device');assert.equal(a.status().message,'이 기기에 저장돼요.');
});
test('malformed and wrong-owner originals remain untouched instead of being silently reset',()=>{
 for(const original of ['{"version":1','{"version":1,"owner":"other"}']){
  const cache=storage(),key=`${LIFE_PROGRESS_KEY}:guest`;cache.setItem(key,original);
  const progress=createLifeProgress({storage:cache});assert.equal(progress.status().phase,'unreadable');assert.throws(()=>progress.startLesson(lessons[0]),{code:'LIFE_PROGRESS_UNREADABLE'});assert.equal(cache.getItem(key),original);
 }
});
test('a failed local write retains an unsaved draft and retry saves it explicitly',async()=>{
 const cache=storage(),write=cache.setItem;let full=true;cache.setItem=(...args)=>{if(full)throw Error('quota');write(...args);};
 const progress=createLifeProgress({storage:cache});progress.startLesson(lessons[0]);assert.equal(progress.status().saved,false);assert.equal(progress.exportSnapshot().activeLessonId,lessons[0].id);
 full=false;await progress.flush();assert.equal(progress.status().saved,true);assert.ok(cache.getItem(progress.key));
});
test('an owner guard and stop prevent old callbacks from changing progress',async()=>{
 let valid=true;const progress=createLifeProgress({storage:storage(),guard:()=>{if(!valid)throw Object.assign(Error(),{code:'ACCOUNT_CHANGED'});}});
 progress.startLesson(lessons[0]);valid=false;assert.throws(()=>answerAll(progress,lessons[0]),{code:'ACCOUNT_CHANGED'});await assert.rejects(progress.flush(),{code:'ACCOUNT_CHANGED'});
 valid=true;progress.stop();assert.throws(()=>progress.exportSnapshot(),{code:'ACCOUNT_CHANGED'});
});

const A='11111111-1111-4111-8111-111111111111';
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/portal/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
function accountFixture({lostAck=false,reject=false,delay=null}={}){
 const tab=storage(),cache=storage(),state=emptyPlayState(),commands=[],receipts=new Map();let revision=0;
 tab.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-local-fixture',refresh_token:null,expires_at:Date.now()+3600000}));
 const account=createWorldAccount({config,storage:tab,getUrl:()=>config.clients.world.redirectUri,replaceUrl:()=>{},fetcher:async()=>({ok:true,status:200,json:async()=>({})}),accountFactory:()=>({
  load:async()=>({ok:true,account:{synk_user_id:A,status:'active'},sessions:[],learning:{enabled:false,revision:1},capabilities:{learningSync:true}}),
  play:{load:async()=>({ok:true,scope:'synk-play',accountId:A,revision,state:structuredClone(state)}),mutate:async body=>{
   commands.push(structuredClone(body));if(delay)await delay;
   if(reject)throw Object.assign(Error('contract not ready'),{code:'INVALID_PLAY_COMMAND'});
   if(receipts.has(body.id))return receipts.get(body.id);
   const changes=validatePlayChanges(body.changes);for(const change of changes){if((state.records[change.key]??null)!==change.previous)throw Object.assign(Error(),{code:'REVISION_CONFLICT'});state.records[change.key]=change.value;}
   const response={ok:true,scope:'synk-play',accountId:A,revision:++revision,state:structuredClone(state)};receipts.set(body.id,response);
   if(lostAck){lostAck=false;throw Error('lost acknowledgement');}return response;
  }}})});
 return {account,tab,cache,state,commands,allowContract(){reject=false;}};
}
async function connected(f){await f.account.restore();const port=await f.account.prepareLifeProgress({storage:f.cache,target:{}});
 const progress=createLifeProgress({storage:port.storage,owner:A,mode:'account',guard:port.guard,save:port.flush,getSaveStatus:port.status});return {port,progress};}
test('verified life port exposes only the dedicated key and saves actual record through the official contract',async()=>{
 const f=accountFixture(),{port,progress}=await connected(f);assert.throws(()=>port.storage.getItem('synk.windrun.best'),TypeError);assert.equal(progress.key,LIFE_PROGRESS_KEY);
 progress.startLesson(lessons[0]);answerAll(progress,lessons[0]);progress.finishLesson(lessons[0].id);await progress.flush();
 assert.equal(progress.status().phase,'synced');assert.equal(JSON.parse(f.state.records[LIFE_PROGRESS_KEY]).lessons[lessons[0].id].answers[lessons[0].questions[0].id].correct,true);
 assert.equal(f.cache.getItem(`${LIFE_PROGRESS_KEY}:${A}`),null);port.dispose();
});
test('a lost acknowledgement retries the same cryptographic command id, without duplicating completion',async()=>{
 const f=accountFixture({lostAck:true}),{port,progress}=await connected(f);progress.startLesson(lessons[0]);
 await assert.rejects(progress.flush());assert.ok(f.cache.data.size>0);await progress.flush();
 assert.equal(f.commands[0].id,f.commands[1].id);assert.match(f.commands[0].id,/^[0-9a-f-]{36}$/i);assert.equal(progress.status().saved,true);port.dispose();
});
test('an unprepared remote key rejects and preserves draft, and cannot be called account-saved',async()=>{
 const f=accountFixture({reject:true}),{port,progress}=await connected(f);progress.startLesson(lessons[0]);await progress.flush();
 assert.equal(progress.status().phase,'unsaved');assert.equal(progress.status().saved,false);assert.equal(port.status().rejected,1);
 assert.ok([...f.cache.data.entries()].some(([key,value])=>key.includes(':rejected:')&&value.includes(LIFE_PROGRESS_KEY)));assert.equal(f.state.records[LIFE_PROGRESS_KEY],undefined);port.dispose();
});
test('a rejected draft survives a new port and requires an explicit local/remote choice',async()=>{
 const f=accountFixture({reject:true}),initial=await connected(f);initial.progress.startLesson(lessons[0]);initial.progress.setStage(lessons[0].id,{phase:'story',sceneIndex:2});await initial.progress.flush();
 const restored=await f.account.prepareLifeProgress({storage:f.cache,target:{}});assert.equal(restored.recoverySnapshot().lessons[lessons[0].id].stage.sceneIndex,2);
 assert.throws(()=>restored.storage.getItem(LIFE_PROGRESS_KEY),{code:'LIFE_PROGRESS_REJECTED'});assert.equal(restored.status().phase,'unsaved');
 await restored.resolve('local');assert.equal(restored.status().phase,'unsaved','an unchanged remote contract cannot report a save');
 f.allowContract();await restored.resolve('local');assert.equal(restored.status().phase,'synced');assert.equal(JSON.parse(restored.storage.getItem(LIFE_PROGRESS_KEY)).lessons[lessons[0].id].stage.sceneIndex,2);
 assert.ok([...f.cache.data.keys()].some(key=>key.includes(':rejected:')),'rejected originals remain archived');restored.dispose();
});
test('choosing remote progress keeps the rejected original archived without silently importing it',async()=>{
 const f=accountFixture({reject:true}),initial=await connected(f);initial.progress.startLesson(lessons[0]);await initial.progress.flush();
 const restored=await f.account.prepareLifeProgress({storage:f.cache,target:{}});await restored.resolve('remote');assert.equal(restored.storage.getItem(LIFE_PROGRESS_KEY),null);assert.equal(restored.status().rejected,0);
 assert.ok([...f.cache.data.keys()].some(key=>key.includes(':rejected:')));restored.dispose();
});
test('logout beats a delayed life save; old port cannot read, save or apply its acknowledgement',async()=>{
 let release;const held=new Promise(resolve=>release=resolve),f=accountFixture({delay:held}),{port,progress}=await connected(f);
 progress.startLesson(lessons[0]);const pending=progress.flush();await new Promise(r=>setImmediate(r));await f.account.logout();release();
 await assert.rejects(pending,{code:'ACCOUNT_CHANGED'});assert.throws(()=>port.storage.getItem(LIFE_PROGRESS_KEY),{code:'ACCOUNT_CHANGED'});assert.throws(()=>progress.summary(packs),{code:'ACCOUNT_CHANGED'});
});
