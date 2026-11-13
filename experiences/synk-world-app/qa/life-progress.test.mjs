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
test('the review count on screens is expressions, not scenes: the same words back in two lessons are one expression',()=>{
 const question=(id,expressionId)=>({id,skillId:'cafe-skill-0',expressionId,review:{id:`${id}-transfer`}});
 const first={id:'count-first',packId:'cafe',expressions:[{id:'hello',korean:'안녕하세요.'},{id:'thanks',korean:'감사합니다.'}],questions:[question('count-a','hello'),question('count-b','hello'),question('count-c','thanks')]};
 const second={id:'count-second',packId:'cafe',expressions:[{id:'hi-story',korean:'안녕하세요.'}],questions:[question('count-d','hi-story')]};
 const clock=options(),progress=createLifeProgress({storage:storage(),now:clock.now}),pack=[{id:'cafe',lessons:[first,second]}];
 for(const lesson of [first,second]){progress.startLesson(lesson);answerAll(progress,lesson,{correct:false});}
 clock.advance(60000);const summary=progress.summary(pack);
 assert.equal(summary.dueCount,4,'장면 수는 그대로');assert.equal(summary.dueExpressions,2,'표현은 글자 기준으로 둘');
 // 표현 정보가 없는 레슨은 복습 하나를 표현 하나로 센다(수가 사라지지 않는다).
 const plain=createLifeProgress({storage:storage(),now:clock.now});plain.startLesson(lessons[0]);answerAll(plain,lessons[0],{correct:false});clock.advance(60000);
 assert.equal(plain.summary(packs).dueExpressions,3);
 // 글이 있는 복습과 없는 복습이 섞이면 글 있는 표현만 센다 — 화면 목록과 같은 기준이다(글 없는 줄은 목록에 없다).
 const blank={id:'count-blank',packId:'cafe',expressions:[{id:'hello',korean:'안녕하세요.'}],questions:[question('count-e','hello'),question('count-f','missing')]};
 const mixed=createLifeProgress({storage:storage(),now:clock.now});mixed.startLesson(blank);answerAll(mixed,blank,{correct:false});clock.advance(60000);
 const shown=mixed.summary([{id:'cafe',lessons:[blank]}]);assert.equal(shown.dueCount,2);assert.equal(shown.dueExpressions,1);
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

test('a requested subset opens only those due reviews, with the requested first item',()=>{
 const clock=options(),p=createLifeProgress({storage:storage(),now:clock.now});
 for(const lesson of lessons.slice(0,2)){p.startLesson(lesson);answerAll(p,lesson,{correct:false});}
 clock.advance(60000);assert.equal(p.dueReviews().length,6);
 const requested=[lessons[1].questions[0].review.id,lessons[1].questions[2].review.id],preferred=requested[1];
 const before=p.exportSnapshot(),run=p.startReview(6,preferred,requested);
 assert.deepEqual(run.ids,[preferred,requested[0]]);assert.equal(run.ids.length,2);
 assert.deepEqual(p.exportSnapshot().reviews,before.reviews,'selection does not change due times or results');
 assert.deepEqual(p.exportSnapshot().lessons,before.lessons);
});

test('requesting known future reviews does not start a run or move their schedules',()=>{
 const clock=options(),p=createLifeProgress({storage:storage(),now:clock.now});
 p.startLesson(lessons[0]);answerAll(p,lessons[0],{correct:true});
 p.startLesson(lessons[1]);answerAll(p,lessons[1],{correct:false});clock.advance(60000);
 const future=lessons[0].questions.map(q=>q.review.id),before=p.exportSnapshot();
 assert.equal(p.dueReviews().length,3);assert.equal(p.startReview(6,future[0],future),null);
 assert.deepEqual(p.exportSnapshot(),before);
 const mixed=p.startReview(6,future[0],[future[0],lessons[1].questions[1].review.id]);
 assert.deepEqual(mixed.ids,[lessons[1].questions[1].review.id]);
 assert.deepEqual(p.exportSnapshot().reviews,before.reviews);
});

test('an in-progress mixed review batch keeps its original order, answers and help after a narrower request and reload',()=>{
 const cache=storage(),clock=options(),p=createLifeProgress({storage:cache,now:clock.now});
 for(const lesson of lessons.slice(0,2)){p.startLesson(lesson);answerAll(p,lesson,{correct:false});}
 clock.advance(60000);const original=p.startReview(6);
 assert.equal(new Set(original.ids.map(id=>p.exportSnapshot().reviews[id].lessonId)).size,2);
 p.answerReview({id:original.ids[0],correct:true});p.markReviewHelp(original.ids[1]);
 const before=p.exportSnapshot(),resumed=createLifeProgress({storage:cache,now:clock.now});
 const narrower=original.ids.filter(id=>before.reviews[id].lessonId===lessons[1].id);
 const result=resumed.startReview(1,narrower.at(-1),narrower);
 assert.deepEqual(result,before.activeReview);assert.deepEqual(resumed.exportSnapshot(),before);
 assert.equal(result.answers[original.ids[0]].correct,true);assert.equal(result.pendingHelp[original.ids[1]],true);
});

test('invalid review selections are rejected without creating a run or modifying records',()=>{
 const clock=options(),p=createLifeProgress({storage:storage(),now:clock.now});
 p.startLesson(lessons[0]);answerAll(p,lessons[0],{correct:false});clock.advance(60000);
 const known=lessons[0].questions[0].review.id,before=p.exportSnapshot();
 for(const selection of ['all',{},[null],['bad id'],['unknown-review'],[known,known],Array.from({length:101},(_,i)=>`review-${i}`)]){
  assert.throws(()=>p.startReview(6,null,selection),/Invalid review selection/);
  assert.deepEqual(p.exportSnapshot(),before);
 }
 assert.equal(p.startReview(6,null,[]),null);assert.deepEqual(p.exportSnapshot(),before);
});
// 새 길(판정이 있을 때)에서만 학습일 경계를 넘긴 도움을 오늘 판에 잇지 않는다 — 판정이 없는 문서(라이브)와 지금 판으로 정해진 문서(판정 null)는
// 4-2 앞과 같이 앞선 날 판을 그대로 잇고 어제 본 표현도 도움으로 단다(Fable 5.2 합친 끝 판 F3 — 문서를 연 채 날을 넘긴 차례 포함).
test('앞선 날의 도움(남은 판 · 본 표현)은 새 길 판정이 있을 때만 오늘 판에 잇지 않는다 — 판정 없음 · 지금 판(null)은 4-2 앞과 같다(Fable 5.2 합친 끝 판 F3)',()=>{
 const DAY=86400000;
 const sources=[['판정 없음',null,false],['지금 판(null)',()=>null,false],['엔진',state=>({state:'engine',ids:Object.keys(state.reviews),nextAt:null,times:[],upcoming:[]}),true]];
 for(const [label,source,next] of sources){
  // ① 앞선 날 판 — 안내 연습이 연 1문항 판에 답 없이 남은 도움 표시
  const clock=options(),p=createLifeProgress({storage:storage(),now:clock.now});if(source)p.setDueSource(source);
  const q=lessons[0].questions[0],id=q.review.id;p.startLesson(lessons[0]);p.recordAnswer({lessonId:lessons[0].id,questionId:q.id,correct:false});
  const first=p.startReview(1,id,null,{ids:[id]});p.markReviewHelp(id);
  clock.advance(DAY);
  assert.equal(p.summary(packs).dueRenew,next?true:undefined,`${label}: 요약의 dueRenew`);
  const again=p.startReview(1,id,null,{ids:[id]});
  assert.equal(again.id===first.id,!next,`${label}: ${next?'새 판':'앞선 날 판을 그대로 잇는다'}`);
  assert.equal(again.pendingHelp?.[id]===true,!next,`${label}: 앞선 날의 도움 표시`);
  // ② 어제 본 표현(화면 exposedTransfers의 때) — 오늘 새로 연 판에 도움으로 다는가
  const c2=options(),p2=createLifeProgress({storage:storage(),now:c2.now});if(source)p2.setDueSource(source);
  p2.startLesson(lessons[0]);p2.recordAnswer({lessonId:lessons[0].id,questionId:q.id,correct:false});
  const seen=c2.now();c2.advance(DAY);p2.startReview(1,id,null,{ids:[id]});
  assert.equal(p2.markReviewHelp(id,{seenAt:seen}).pendingHelp?.[id]===true,!next,`${label}: 어제 본 표현`);
  assert.equal(p2.markReviewHelp(id,{seenAt:c2.now()}).pendingHelp?.[id],true,`${label}: 오늘 본 표현은 도움`);
 }
});

// 새 길에서 어제 연 판을 오늘 이어 풀다 본 도움은 오늘 것이다 — 도움을 달 때 판의 날을 오늘로 옮기고(앞선 날 표시는 비움), 다시 열어도 그 판을
// 잇고 그 답은 도움 받은 답이다. 판정이 없으면(라이브) 4-2 앞 그대로(GPT Fable 처리 다시 검수 GA1).
test('어제 연 복습 판을 오늘 이어 풀다 본 도움은 다시 열어도 남는다 — 새 길은 판의 날을 오늘로 옮기고 앞선 날 표시만 비운다, 판정이 없으면 4-2 앞 그대로(GPT GA1)',()=>{
 const DAY=86400000;
 const engineSource=state=>({state:'engine',ids:Object.keys(state.reviews),nextAt:null,times:[],upcoming:[]});
 for(const [label,source] of [['판정 없음',null],['엔진',engineSource]]){
  const clock=options(),p=createLifeProgress({storage:storage(),now:clock.now});if(source)p.setDueSource(source);
  const [q1,q2]=lessons[0].questions,[id1,id2]=[q1.review.id,q2.review.id];
  p.startLesson(lessons[0]);p.recordAnswer({lessonId:lessons[0].id,questionId:q1.id,correct:false});p.recordAnswer({lessonId:lessons[0].id,questionId:q2.id,correct:false});
  const first=p.startReview(2,id1,null,{ids:[id1,id2]});
  clock.advance(DAY); // 어제 연 판 — 도움 없이 다음 날 이어 연다
  const resumed=p.startReview(2,id1,null,{ids:[id1,id2]});
  assert.equal(resumed.id,first.id,`${label}: 도움 표시가 없으면 앞선 날 판을 잇는다`);
  p.markReviewHelp(id1); // 오늘 해설을 봤다
  const reopened=p.startReview(2,id1,null,{ids:[id1,id2]}); // 닫았다 다시 연다
  assert.equal(reopened.id,first.id,`${label}: 오늘 본 도움이 있는 판을 그대로 잇는다`);
  assert.equal(reopened.pendingHelp?.[id1],true,`${label}: 오늘 본 도움 표시가 남는다`);
  p.answerReview({id:id1,correct:true,runId:reopened.id});
  assert.equal(p.exportSnapshot().activeReview.answers[id1].helped,true,`${label}: 그 답은 도움 받은 답`);
 }
 // 문서를 연 채 날을 넘김 — 어제 단 표시가 남은 판에 오늘 다른 문항의 도움을 달면 어제 표시는 비우고 오늘 표시만(새 길만)
 for(const [label,source,next] of [['판정 없음',null,false],['엔진',engineSource,true]]){
  const clock=options(),p=createLifeProgress({storage:storage(),now:clock.now});if(source)p.setDueSource(source);
  const [q1,q2]=lessons[0].questions,[id1,id2]=[q1.review.id,q2.review.id];
  p.startLesson(lessons[0]);p.recordAnswer({lessonId:lessons[0].id,questionId:q1.id,correct:false});p.recordAnswer({lessonId:lessons[0].id,questionId:q2.id,correct:false});
  const run=p.startReview(2,id1,null,{ids:[id1,id2]});p.markReviewHelp(id1);
  clock.advance(DAY);
  const marked=p.markReviewHelp(id2);
  assert.deepEqual(marked.pendingHelp,next?{[id2]:true}:{[id1]:true,[id2]:true},`${label}: 표시`);
  assert.equal(marked.startedAt===run.startedAt,!next,`${label}: ${next?'판의 날을 오늘로':'판의 날 그대로'}`);
 }
});
