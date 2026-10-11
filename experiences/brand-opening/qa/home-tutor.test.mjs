import test from 'node:test';
import assert from 'node:assert/strict';
import {homeTutorRecommendation,homeTutorLine} from '../home-tutor-lines.mjs';
import {LESSONS,PACKS} from '../../synk-world-app/life-content.mjs';
import {createLifeProgress} from '../../synk-world-app/life-progress.mjs';

const DAY=86400000;
const greeting=LESSONS.find(l=>l.id==='greetings-expressions');
const cafe=LESSONS.find(l=>l.id==='cafe-apply');
function fixture({owner='home-tutor-test',packs=PACKS,lessons=LESSONS,phase=null,code=null,rejected=false,raw=null}={}){
 const values=new Map();let tick=1000000,sequence=0,writes=0;
 const storage={getItem:key=>values.get(key)??raw,setItem(key,value){writes++;values.set(key,String(value));}};
 const progress=createLifeProgress({storage,owner,now:()=>tick,uuid:()=>`home-attempt-${++sequence}`,
  ...(phase?{mode:'account',getSaveStatus:()=>({phase,code,rejected})}:{})});
 const input=()=>({owner,summary:progress.summary(packs,lessons),snapshot:progress.exportSnapshot(),lessons,now:tick});
 const recommend=extra=>homeTutorRecommendation({...input(),...extra});
 progress.summary(packs,lessons);
 return {owner,progress,input,recommend,advance:ms=>tick+=ms,writes:()=>writes,stored:()=>[...values]};
}
function answer(f,lesson,index,{correct=false,helped=false}={}){
 f.progress.startLesson(lesson);const q=lesson.questions[index];
 f.progress.recordAnswer({lessonId:lesson.id,questionId:q.id,correct,helped,
  choiceId:correct?q.answerId:q.choices.find(c=>c.id!==q.answerId).id});
 return q;
}
function freezeDeep(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freezeDeep(child);}return value;}

test('home waits for the same owner and does not turn unreadable or conflicted records into a new learner',()=>{
 const f=fixture(),input=f.input();
 assert.deepEqual(homeTutorRecommendation(),{kind:'loading'});
 assert.deepEqual(homeTutorRecommendation({...input,owner:'another-account'}),{kind:'loading'});
 assert.deepEqual(homeTutorRecommendation({...input,snapshot:{...input.snapshot,owner:'another-account'}}),{kind:'loading'});
 assert.deepEqual(homeTutorRecommendation({...input,summary:{...input.summary,owner:'another-account'}}),{kind:'loading'});
 assert.deepEqual(fixture({phase:'loading'}).recommend(),{kind:'loading'});
 assert.deepEqual(fixture({phase:'conflict'}).recommend(),{kind:'unavailable'});
 assert.deepEqual(fixture({phase:'unsaved',code:'LIFE_PROGRESS_REJECTED'}).recommend(),{kind:'unavailable'});
 assert.equal(fixture({phase:'unsaved'}).recommend().kind,'start','a readable unsaved draft still belongs to this learner');
 const rejected=fixture({phase:'synced',rejected:true});
 assert.equal(rejected.progress.status().phase,'unsaved');
 assert.equal(rejected.progress.status().rejected,true);
 assert.deepEqual(rejected.recommend(),{kind:'unavailable'},'a rejected write blocks recommendations even without an error code');
 const unreadable=fixture({raw:'{"version":1'});
 assert.equal(unreadable.progress.status().phase,'unreadable');
 assert.deepEqual(unreadable.recommend(),{kind:'unavailable'});
 assert.equal(unreadable.writes(),0);
});

test('a first visit offers its real first lesson and an interrupted lesson keeps its own title and position',()=>{
 const f=fixture();
 assert.deepEqual(f.recommend(),{kind:'start',title:greeting.title,command:'learn',label:'오늘의 학습 시작'});
 const lesson=LESSONS.find(l=>l.id==='plans-story');f.progress.startLesson(lesson);
 f.progress.setStage(lesson.id,{phase:'story',sceneIndex:1,questionIndex:0});
 const before=f.progress.exportSnapshot();
 assert.deepEqual(f.recommend(),{kind:'resume',title:lesson.title,command:'learn',label:'하던 학습 이어 하기'});
 assert.deepEqual(f.progress.exportSnapshot(),before);
});

test('scheduled expressions take precedence over another lesson without being called a mistake',()=>{
 const f=fixture(),q=answer(f,greeting,0,{correct:true});
 assert.equal(f.progress.exportSnapshot().reviews[q.review.id].lapses,0);
 assert.equal(f.recommend().kind,'resume');
 f.advance(DAY);
 assert.equal(f.recommend().kind,'review');assert.equal(f.recommend().command,'review');assert.equal(f.recommend().label,'오늘의 복습 열기');
 assert.equal(f.recommend().memory.kind,'independent');assert.equal(f.recommend().memory.when,'어제');
});

test('finishing the available canonical lessons offers the library until an actual review becomes due',()=>{
 const pack=PACKS.find(p=>p.id==='greetings'),lessons=LESSONS.filter(l=>l.packId===pack.id);
 const f=fixture({packs:[pack],lessons});
 for(const lesson of lessons){for(let index=0;index<lesson.questions.length;index++)answer(f,lesson,index,{correct:true});f.progress.finishLesson(lesson.id);}
 assert.equal(f.input().summary.allCompleted,true);
 assert.deepEqual(f.recommend(),{kind:'complete',command:'packs',label:'생활 팩 둘러보기'});
 f.advance(DAY);assert.equal(f.recommend().kind,'review');
});

test('wrong or assisted answers are remembered, but an independent successful transfer retires that difficulty',()=>{
 const f=fixture(),wrong=answer(f,greeting,0),right=answer(f,greeting,1,{correct:true});
 assert.equal(f.recommend().id,wrong.id);
 assert.equal(f.progress.exportSnapshot().reviews[right.review.id].lapses,0);
 f.advance(1);const assisted=answer(f,cafe,0,{correct:true,helped:true});
 assert.equal(f.recommend().id,assisted.id);
 f.advance(60000);const run=f.progress.startReview();
 for(const id of run.ids)f.progress.answerReview({id,runId:run.id,correct:true});
 for(const q of [wrong,assisted]){const record=f.progress.exportSnapshot().reviews[q.review.id];assert.equal(record.lapses,1);assert.equal(record.streak,1);}
 assert.equal(f.recommend().kind,'resume','historical lapses alone must not keep calling a solved expression difficult');
});

test('an already due difficulty precedes a more recent future one; within due expressions the latest comes first',()=>{
 const f=fixture(),older=answer(f,greeting,0);
 f.advance(60001);const newer=answer(f,cafe,0);
 assert.equal(f.recommend().id,older.id,'finish the earlier appointment before a not-yet-due difficulty');
 f.advance(60000);
 assert.equal(f.recommend().id,newer.id,'both are due, so the most recent unresolved expression is first');
 assert.equal(f.recommend().lastAt,f.progress.exportSnapshot().reviews[newer.review.id].lastAt);
});

test('guided practice suppresses only that exposure during this visit and a new difficult review brings it back',()=>{
 const f=fixture(),q=answer(f,greeting,0),first=f.progress.exportSnapshot().reviews[q.review.id];
 const practised=new Map([[q.id,first.lastAt]]);
 assert.equal(f.recommend({practised}).kind,'resume');
 f.advance(60000);
 assert.equal(f.recommend({practised}).kind,'review','guided work must not erase the scheduled review');
 const run=f.progress.startReview();f.progress.answerReview({id:q.review.id,runId:run.id,correct:false});
 const next=f.recommend({practised});
 assert.equal(next.kind,'difficult');assert.equal(next.id,q.id);assert.ok(next.lastAt>first.lastAt);
 assert.equal(practised.get(q.id),first.lastAt,'selection must not silently mark a newer exposure practised');
});

test('stored review IDs must map to the canonical lesson, original question and transfer before their wording is used',()=>{
 const f=fixture(),q=answer(f,cafe,0),input=f.input(),record=input.snapshot.reviews[q.review.id];
 for(const patch of [{lessonId:'missing-lesson'},{questionId:'missing-question'},{id:'missing-transfer'}]){
  const snapshot=structuredClone(input.snapshot);snapshot.reviews[q.review.id]={...record,...patch};
  assert.equal(homeTutorRecommendation({...input,snapshot}).kind,'resume');
 }
 const snapshot=structuredClone(input.snapshot);snapshot.reviews[q.review.id].title='untrusted stored expression';
 const recommendation=homeTutorRecommendation({...input,snapshot});
 assert.equal(recommendation.title,cafe.expressions.find(e=>e.id===q.expressionId).korean);
 assert.equal(recommendation.lessonTitle,cafe.title);assert.equal(recommendation.id,q.id);
 assert.doesNotMatch(JSON.stringify(recommendation),/untrusted/);
});

test('all three tutors use distinct canonical speech and quote the actual recommended expression',()=>{
 const f=fixture();answer(f,cafe,0);const recommendation=f.recommend();
 for(const kind of ['loading','unavailable','difficult','review','resume','start','complete']){
  const r={...recommendation,kind};
  const marin=homeTutorLine('marin',r),kkamong=homeTutorLine('kkamong',r),mongle=homeTutorLine('mongle',r);
  assert.ok(marin);assert.doesNotMatch(marin,/[!?？！]/);assert.match(marin,/확인|기록|준비/);
  assert.match(kkamong,/이 몸|내가/);assert.match(mongle,/[!?]/);assert.equal(new Set([marin,kkamong,mongle]).size,3);
  if(['difficult','resume','start'].includes(kind))for(const text of [marin,kkamong,mongle])assert.ok(text.includes(`「${r.title}」`));
 }
 for(const id of ['marin','kkamong','mongle']){
  const text=homeTutorLine(id,recommendation,{completed:recommendation.id});
  assert.ok(text);assert.doesNotMatch(text,/숙달|완벽|독립 정답|모두 해결/);
  if(id==='marin')assert.doesNotMatch(text,/[!?？！]/);
 }
 assert.equal(homeTutorLine('unknown',recommendation),'');
});

test('recommendations and their dialogue never write progress, clear a first error, or move review appointments',()=>{
 const f=fixture(),q=answer(f,cafe,0);f.advance(60000);f.progress.startReview();
 const input=freezeDeep(f.input()),before=f.progress.exportSnapshot(),stored=f.stored(),writes=f.writes(),practised=new Map();
 for(let i=0;i<4;i++){
  const recommendation=homeTutorRecommendation({...input,practised});
  for(const id of ['marin','kkamong','mongle'])homeTutorLine(id,recommendation,{completed:i%2?q.id:''});
 }
 assert.deepEqual(f.progress.exportSnapshot(),before);assert.deepEqual(f.stored(),stored);assert.equal(f.writes(),writes);assert.equal(practised.size,0);
 assert.equal(before.lessons[cafe.id].answers[q.id].correct,false);
 assert.equal(before.reviews[q.review.id].dueAt,input.snapshot.reviews[q.review.id].dueAt);
});

test('a preferred due expression enters the first review slot even when it was outside the batch limit',()=>{
 const f=fixture();
 for(const lesson of LESSONS.slice(0,3))for(let index=0;index<lesson.questions.length;index++){answer(f,lesson,index);f.advance(1);}
 f.advance(60000);const due=f.progress.dueReviews(),preferred=due[8].id,before=f.progress.exportSnapshot();
 const run=f.progress.startReview(6,preferred);
 assert.deepEqual(run.ids,[preferred,...due.slice(0,5).map(r=>r.id)]);
 assert.equal(new Set(run.ids).size,6);
 assert.deepEqual(f.progress.exportSnapshot().reviews,before.reviews,'prioritizing an appointment must not change its timing or grade');
 assert.deepEqual(f.progress.exportSnapshot().lessons,before.lessons);
});

test('preferring another expression never replaces or reorders an unfinished review and its assistance',()=>{
 const f=fixture();for(let index=0;index<greeting.questions.length;index++)answer(f,greeting,index);
 f.advance(60000);const run=f.progress.startReview(2);
 f.progress.answerReview({id:run.ids[0],runId:run.id,correct:true});f.progress.markReviewHelp(run.ids[1]);
 const before=f.progress.exportSnapshot(),writes=f.writes(),outside=greeting.questions[2].review.id;
 assert.deepEqual(f.progress.startReview(6,outside),before.activeReview);
 assert.deepEqual(f.progress.exportSnapshot(),before);assert.equal(f.writes(),writes);
});

test('a preferred future or missing expression cannot become due or displace a real due appointment',()=>{
 for(const value of ['future','missing']){
  const f=fixture(),due=answer(f,greeting,0),future=answer(f,greeting,1,{correct:true});
  f.advance(60000);const preferred=value==='future'?future.review.id:'missing-transfer';
  assert.deepEqual(f.progress.startReview(1,preferred).ids,[due.review.id]);
 }
 const f=fixture(),future=answer(f,greeting,0,{correct:true}),before=f.progress.exportSnapshot();
 assert.equal(f.progress.startReview(6,future.review.id),null);
 assert.equal(f.progress.startReview(6,'missing-transfer'),null);
 assert.deepEqual(f.progress.exportSnapshot(),before);
});
