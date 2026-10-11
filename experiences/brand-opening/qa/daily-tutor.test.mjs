import test from 'node:test';
import assert from 'node:assert/strict';
import {homeDayKey,homeTutorDays,homeTutorDayLine,homeTutorMemoryLine} from '../home-tutor-days.mjs';
import {homeTutorRecommendation,homeTutorLine} from '../home-tutor-lines.mjs';
import {lifeTutorExpression} from '../life-tutor-lines.mjs';
import {LESSONS,PACKS} from '../../synk-world-app/life-content.mjs';
import {createLifeProgress,lifeDayKey} from '../../synk-world-app/life-progress.mjs';

const DAY=86400000,MINUTE=60000,START=Date.parse('2026-10-11T10:00:00+09:00');
const greeting=LESSONS.find(l=>l.id==='greetings-expressions');
const story=LESSONS.find(l=>l.id==='greetings-story');
const cafe=LESSONS.find(l=>l.id==='cafe-apply');
const tutors=['marin','kkamong','mongle'];

function fixture({owner='daily-tutor-test',at=START,raw=null,phase=null}={}){
 const values=new Map();let tick=at,sequence=0,writes=0,progress;
 const storage={getItem:key=>values.get(key)??raw,setItem(key,value){writes++;values.set(key,String(value));}};
 const create=()=>createLifeProgress({storage,owner,now:()=>tick,uuid:()=>`daily-attempt-${++sequence}`,
  ...(phase?{mode:'account',getSaveStatus:()=>({phase})}:{})});
 progress=create();progress.summary(PACKS,LESSONS);
 const input=()=>({owner,summary:progress.summary(PACKS,LESSONS),snapshot:progress.exportSnapshot(),lessons:LESSONS,now:tick});
 return {get progress(){return progress;},now:()=>tick,advance:ms=>tick+=ms,setTime:at=>tick=at,
  reload(){progress.stop();progress=create();progress.summary(PACKS,LESSONS);return progress;},
  input,recommend:extra=>homeTutorRecommendation({...input(),...extra}),
  days:()=>homeTutorDays(progress.exportSnapshot(),LESSONS,tick),writes:()=>writes,
  replaceSnapshot(snapshot){values.set(progress.key,JSON.stringify(snapshot));},stored:()=>[...values]};
}

function answer(f,lesson,index,{correct=false,helped=false}={}){
 f.progress.startLesson(lesson);const q=lesson.questions[index];
 f.progress.recordAnswer({lessonId:lesson.id,questionId:q.id,correct,helped,
  choiceId:correct?q.answerId:q.choices.find(c=>c.id!==q.answerId).id});
 return q;
}

function guided(f,q,tutorId='marin'){
 f.advance(1);return f.progress.recordGuidedPractice({questionId:q.id,tutorId});
}

function signature(id,text){
 assert.ok(text,`${id} has a line`);
 if(id==='marin'){assert.doesNotMatch(text,/[!?？！]/);assert.match(text,/기록|확인|완료|수칙|…/);}
 if(id==='kkamong')assert.match(text,/이 몸|내|나/);
 if(id==='mongle')assert.match(text,/[!?]/);
 assert.doesNotMatch(text,/숙달|완벽|모두 해결|영원히 기억/);
}

test('the Korean learning day agrees at midnight across persistence and home helpers',()=>{
 for(const [at,key]of [[Date.parse('2026-10-10T14:59:59.999Z'),'2026-10-10'],[Date.parse('2026-10-10T15:00:00Z'),'2026-10-11']]){
  assert.equal(lifeDayKey(at),key);assert.equal(homeDayKey(at),key);
 }
 const f=fixture({at:Date.parse('2026-10-10T23:59:59+09:00')});answer(f,greeting,0,{correct:true});
 f.advance(1000);assert.equal(f.days().when,'어제');assert.equal(f.days().today.count,0);
});

test('first-time learners have no invented day, memory, or successful expression',()=>{
 const f=fixture(),before=f.progress.exportSnapshot(),writes=f.writes(),days=f.days();
 assert.equal(days.today.count,0);assert.equal(days.today.closed,false);assert.equal(days.previous,null);assert.equal(days.when,null);
 assert.equal(f.recommend().kind,'start');assert.equal(f.recommend().memory,undefined);
 assert.equal(f.progress.markDayComplete().empty,true);assert.equal(f.writes(),writes);
 for(const id of tutors){
  const line=homeTutorDayLine(id,days.today);signature(id,line);assert.match(line,/첫 표현/);
  assert.doesNotMatch(line,/어제|지난번|찾은 말|해냈/);assert.equal(homeTutorMemoryLine(id,null),'');
 }
 assert.deepEqual(f.progress.exportSnapshot(),before);
});

test('guided success survives reload and suppresses today\'s repeated recommendation without changing assessment',()=>{
 const f=fixture(),q=answer(f,cafe,0),before=f.progress.exportSnapshot();
 assert.equal(f.recommend().id,q.id);const saved=guided(f,q,'kkamong');
 assert.equal(saved.duplicate,false);assert.equal(f.days().today.together[0].kind,'guided');
 f.reload();f.advance(MINUTE);
 assert.equal(f.recommend().kind,'resume');assert.equal(f.recommend().id,undefined);
 assert.equal(f.input().summary.dueCount,1,'guided practice has not erased the scheduled appointment');
 const after=f.progress.exportSnapshot();assert.deepEqual(after.lessons,before.lessons);assert.deepEqual(after.reviews,before.reviews);
 assert.equal(after.daily.days[lifeDayKey(f.now())].items[q.id].tutorId,'kkamong');
 assert.equal(f.days().today.independent.length,0);
});

test('a later wrong answer reopens the expression even after a saved guided success',()=>{
 const f=fixture(),q=answer(f,greeting,0);guided(f,q);f.reload();f.advance(MINUTE);
 const run=f.progress.startReview();f.progress.answerReview({id:q.review.id,runId:run.id,correct:false});
 assert.equal(f.days().today.retry[0].id,q.id);assert.equal(f.days().today.together.length,0);
 const r=f.recommend();assert.equal(r.kind,'difficult');assert.equal(r.id,q.id);
 assert.equal(f.progress.exportSnapshot().activeReview.answers[q.review.id].helped,true);
});

test('same-day recall after guided exposure stays assisted while the next day permits independent recall',()=>{
 const f=fixture(),q=answer(f,greeting,0);guided(f,q);f.reload();f.advance(MINUTE);
 let run=f.progress.startReview();f.progress.answerReview({id:q.review.id,runId:run.id,correct:true});
 assert.equal(f.progress.exportSnapshot().activeReview.answers[q.review.id].helped,true);
 assert.equal(f.progress.exportSnapshot().reviews[q.review.id].streak,0);
 assert.equal(f.days().today.together[0].kind,'assisted');
 f.advance(DAY);const r=f.recommend();assert.equal(r.kind,'recall');assert.equal(r.command,'review');
 assert.equal(r.id,q.id);assert.equal(r.memory.kind,'assisted');assert.equal(r.memory.when,'어제');
 run=f.progress.startReview();f.progress.answerReview({id:q.review.id,runId:run.id,correct:true});
 assert.equal(f.progress.exportSnapshot().activeReview.answers[q.review.id].helped,false);
 assert.equal(f.progress.exportSnapshot().reviews[q.review.id].streak,1);
 assert.equal(f.days().today.independent[0].id,q.id);assert.equal(f.recommend().kind,'resume');
});

test('returning after guided work recalls yesterday or the previous visit only when that evidence exists',()=>{
 for(const distance of [DAY,4*DAY]){
  const f=fixture(),q=answer(f,cafe,0);guided(f,q,'mongle');f.progress.markDayComplete();f.advance(distance);f.reload();
  const r=f.recommend(),when=distance===DAY?'어제':'지난번';
  assert.equal(r.kind,'recall');assert.equal(r.memory.when,when);assert.equal(r.memory.id,q.id);
  assert.equal(r.memory.title,lifeTutorExpression(cafe,q));assert.equal(f.days().today.count,0);assert.equal(f.days().today.closed,false);
  for(const id of tutors){const line=homeTutorLine(id,r);signature(id,line);assert.ok(line.includes(when));assert.ok(line.includes(r.memory.title));assert.match(line,/함께|같이/);}
 }
});

test('daily groups distinguish actual independent, assisted, retry, and guided results',()=>{
 const f=fixture(),independent=answer(f,greeting,0,{correct:true});f.advance(1);
 const assisted=answer(f,greeting,1,{correct:true,helped:true});f.advance(1);
 const retry=answer(f,greeting,2);f.advance(1);
 const withTutor=answer(f,cafe,0);guided(f,withTutor,'mongle');
 const day=f.days().today;
 assert.equal(day.count,4);assert.deepEqual(day.independent.map(i=>i.id),[independent.id]);
 assert.deepEqual(day.retry.map(i=>i.id),[retry.id]);assert.deepEqual(day.together.map(i=>i.id),[withTutor.id,assisted.id]);
 assert.deepEqual(new Set(day.together.map(i=>i.kind)),new Set(['guided','assisted']));
 assert.equal(day.independent.length+day.together.length+day.retry.length,day.count);
 assert.equal(f.progress.exportSnapshot().lessons[cafe.id].answers[withTutor.id].correct,false);
});

test('the same canonical expression across lessons counts once with its most recent observed result',()=>{
 const f=fixture(),first=answer(f,greeting,0,{correct:true});f.advance(1000);
 const later=answer(f,story,story.questions.findIndex(q=>q.expressionId===first.expressionId));assert.equal(first.expressionId,later.expressionId);
 let day=f.days().today;assert.equal(day.count,1);assert.equal(day.items[0].id,later.id);assert.equal(day.retry.length,1);assert.equal(day.independent.length,0);
 guided(f,later,'kkamong');f.reload();day=f.days().today;
 assert.equal(day.count,1);assert.equal(day.together[0].id,later.id);assert.equal(day.retry.length,0);
 const snapshot=f.progress.exportSnapshot();assert.equal(snapshot.lessons[greeting.id].answers[first.id].correct,true);assert.equal(snapshot.lessons[story.id].answers[later.id].correct,false);
});

test('guided success suppresses the whole expression family after reload until a newer wrong answer reopens it',()=>{
 const f=fixture(),first=answer(f,greeting,0);f.advance(1);
 const second=answer(f,story,story.questions.findIndex(q=>q.expressionId===first.expressionId));
 guided(f,second,'mongle');f.reload();f.advance(MINUTE);
 assert.equal(f.days().today.count,1);assert.equal(f.days().today.together[0].expressionId,first.expressionId);
 assert.equal(f.input().summary.dueCount,2,'both original review appointments remain available');
 assert.equal(f.recommend().kind,'resume','the other lesson must not immediately recommend the same expression again');
 const run=f.progress.startReview(6,first.review.id);
 f.progress.answerReview({id:first.review.id,runId:run.id,correct:false});
 const next=f.recommend();assert.equal(next.kind,'difficult');assert.ok([first.id,second.id].includes(next.id));
 assert.equal(next.title,lifeTutorExpression(greeting,first),'due-order priority may select either question in the same reopened family');
 assert.equal(f.days().today.retry[0].id,first.id,'a real later error restores the family\'s need for practice');
});

test('daily wording uses canonical expressions and ignores unknown or mismatched stored question identities',()=>{
 const f=fixture(),q=answer(f,cafe,0),input=f.input(),dayKey=lifeDayKey(f.now());
 input.snapshot.daily.days[dayKey].items[q.id].title='untrusted stored sentence';
 input.snapshot.daily.days[dayKey].items.unknown={lessonId:cafe.id,observedAt:f.now(),outcome:'independent'};
 let day=homeTutorDays(input.snapshot,LESSONS,f.now()).today;
 assert.equal(day.count,1);assert.equal(day.items[0].title,lifeTutorExpression(cafe,q));assert.doesNotMatch(JSON.stringify(day),/untrusted|unknown/);
 input.snapshot.daily.days[dayKey].items[q.id].lessonId=greeting.id;
 assert.equal(homeTutorDays(input.snapshot,LESSONS,f.now()).today.count,0);
});

test('another owner and unreadable or conflicted records never expose remembered expressions',()=>{
 const f=fixture(),q=answer(f,cafe,0);guided(f,q);f.advance(DAY);const input=f.input();
 for(const patch of [{owner:'another-owner'},{snapshot:{...input.snapshot,owner:'another-owner'}},{summary:{...input.summary,status:{phase:'loading'}}}])assert.deepEqual(homeTutorRecommendation({...input,...patch}),{kind:'loading'});
 for(const phase of ['unreadable','conflict'])assert.deepEqual(homeTutorRecommendation({...input,summary:{...input.summary,status:{phase}}}),{kind:'unavailable'});
 const broken=fixture({raw:'{"version":1'});assert.deepEqual(broken.recommend(),{kind:'unavailable'});assert.equal(broken.writes(),0);
 for(const kind of ['loading','unavailable'])for(const id of tutors){
  const line=homeTutorLine(id,{kind,memory:f.recommend().memory},{completed:q.id,day:{closed:true}});signature(id,line);
  assert.ok(!line.includes(lifeTutorExpression(cafe,q)));assert.doesNotMatch(line,/어제|마무리 확인|오늘 기록/);
 }
});

test('legacy records recover only surviving first answers and never manufacture guided success or a mistake date',()=>{
 const f=fixture(),q=answer(f,cafe,0),legacy=f.progress.exportSnapshot();delete legacy.daily;
 legacy.reviews[q.review.id].lastAt=START+2*DAY;legacy.reviews[q.review.id].lapses=5;
 f.replaceSnapshot(legacy);f.setTime(START+3*DAY);const writes=f.writes();f.reload();
 const days=f.days();assert.equal(days.previous.date,homeDayKey(START));assert.equal(days.when,'지난번');
 assert.equal(days.previous.count,1);assert.equal(days.previous.items[0].kind,'retry');assert.equal(days.previous.items[0].at,START);
 assert.equal(days.previous.items[0].guidedAt,0);assert.equal(f.writes(),writes,'reading a legacy record does not rewrite it');
 const onlySchedule=f.progress.exportSnapshot();delete onlySchedule.daily;onlySchedule.lessons={};onlySchedule.activeLessonId=null;f.replaceSnapshot(onlySchedule);f.reload();
 assert.equal(f.days().previous,null);assert.equal(f.recommend().memory,undefined,'review.lastAt/lapses alone is not a remembered day');
});

test('future records cannot invent a memory or suppress a real difficulty',()=>{
 const f=fixture(),q=answer(f,greeting,0),snapshot=f.progress.exportSnapshot(),key=lifeDayKey(f.now());
 snapshot.daily.days[key].items[q.id].guidedAt=f.now()+2*MINUTE;snapshot.daily.days[key].items[q.id].tutorId='marin';
 snapshot.daily.days[homeDayKey(f.now()+DAY)]={items:{[q.id]:{lessonId:greeting.id,observedAt:f.now()+DAY,outcome:'independent'}}};
 const days=homeTutorDays(snapshot,LESSONS,f.now());assert.equal(days.today.count,0);assert.equal(days.previous,null);
 const r=homeTutorRecommendation({...f.input(),snapshot});assert.equal(r.kind,'difficult');assert.equal(r.id,q.id);assert.equal(r.memory,undefined);
});

test('future completion does not claim a finished day while monotonic same-millisecond events remain visible',()=>{
 const f=fixture(),q=answer(f,greeting,0);
 f.progress.recordGuidedPractice({questionId:q.id,tutorId:'marin'});
 const completed=f.progress.markDayComplete();
 assert.equal(completed.closedAt,f.now()+1,'the real guided event shares the clock tick and is ordered one millisecond later');
 assert.equal(f.days().today.closed,true);f.reload();assert.equal(f.days().today.closed,true);
 const snapshot=f.progress.exportSnapshot();snapshot.daily.days[lifeDayKey(f.now())].closedAt=f.now()+2*MINUTE;
 const day=homeTutorDays(snapshot,LESSONS,f.now()).today;assert.equal(day.count,1);assert.equal(day.closed,false);
 const recommendation=homeTutorRecommendation({...f.input(),snapshot});
 for(const id of tutors){
  const line=homeTutorLine(id,recommendation,{day});
  assert.doesNotMatch(line,/오늘의 마무리 확인|오늘 기록은|오늘의 기록도 같이 봤어/);
 }
});

test('finishing a day preserves the learning checkpoint and new activity reopens the recap',()=>{
 const f=fixture(),q=answer(f,cafe,0);guided(f,q);const before=f.progress.exportSnapshot();
 const finished=f.progress.markDayComplete();assert.equal(finished.empty,false);assert.equal(f.days().today.closed,true);
 f.reload();assert.equal(f.days().today.closed,true);const writes=f.writes();assert.equal(f.progress.markDayComplete().duplicate,true);assert.equal(f.writes(),writes);
 const closed=f.progress.exportSnapshot();assert.deepEqual(closed.lessons,before.lessons);assert.deepEqual(closed.reviews,before.reviews);assert.equal(closed.activeLessonId,before.activeLessonId);assert.deepEqual(closed.activeReview,before.activeReview);
 // The clock need not advance between a close and the next real learner action.
 answer(f,cafe,1,{correct:true});assert.equal(f.days().today.closed,false);assert.equal(f.days().today.count,2);
 assert.equal(f.progress.exportSnapshot().activeLessonId,cafe.id);
});

test('all three tutors describe only the actual daily groups and the actual remembered outcome',()=>{
 const f=fixture();answer(f,greeting,0,{correct:true});f.advance(1);answer(f,greeting,1,{correct:true,helped:true});f.advance(1);answer(f,greeting,2);
 const day=f.days().today;
 for(const id of tutors){
  for(const finished of [false,true])signature(id,homeTutorDayLine(id,day,{finished}));
  const memory={...day.independent[0],when:'어제'},line=homeTutorMemoryLine(id,memory);signature(id,line);assert.match(line,/어제/);assert.match(line,/혼자/);assert.ok(line.includes(memory.title));
  for(const kind of ['assisted','guided']){const text=homeTutorMemoryLine(id,{...memory,kind});signature(id,text);assert.match(text,/함께|같이/);assert.doesNotMatch(text,/혼자 찾/);}
  const retry=homeTutorMemoryLine(id,{...memory,when:'지난번',kind:'retry'});signature(id,retry);assert.match(retry,/지난번/);assert.doesNotMatch(retry,/혼자 찾|함께 확인|같이 확인/);
 }
 assert.match(homeTutorDayLine('marin',day),/혼자 찾은 말 1개.*함께 확인한 말 1개.*다시 살필 말 1개/);
 const onlyHelp={...day,items:day.together,count:day.together.length,independent:[],retry:[]};
 for(const id of tutors)assert.doesNotMatch(homeTutorDayLine(id,onlyHelp),/혼자 찾은|0개/);
});

test('daily recommendation and copy are read-only consumers of actual progress',()=>{
 const f=fixture(),q=answer(f,greeting,0);guided(f,q);f.advance(DAY);
 const before=f.progress.exportSnapshot(),writes=f.writes(),stored=f.stored();
 for(let i=0;i<3;i++){
  const r=f.recommend(),days=f.days();for(const id of tutors){homeTutorLine(id,r);homeTutorDayLine(id,days.today);homeTutorMemoryLine(id,r.memory);}
 }
 assert.deepEqual(f.progress.exportSnapshot(),before);assert.deepEqual(f.stored(),stored);assert.equal(f.writes(),writes);
});
