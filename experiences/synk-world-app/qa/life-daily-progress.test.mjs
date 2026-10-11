import test from 'node:test';
import assert from 'node:assert/strict';
import {createLifeProgress,LIFE_PROGRESS_KEY,lifeDayKey} from '../life-progress.mjs';

const START=Date.parse('2026-10-11T01:00:00.000Z'),DAY=86400000;
const memory=()=>{const data=new Map();let writes=0;return {getItem:key=>data.get(key)??null,setItem(key,value){writes++;data.set(key,String(value));},get writes(){return writes;},data};};
const lesson=(id='daily-life',count=3)=>({id,packId:'greetings',questions:Array.from({length:count},(_,i)=>({id:`${id}-${i}`,skillId:`skill-${i}`,review:{id:`${id}-${i}-transfer`}}))});
const sample=lesson();
function fixture({storage=memory(),owner='guest',at=START,...rest}={}){
 let tick=at;const p=createLifeProgress({storage,owner,now:()=>tick,...rest});p.registerLesson(sample);
 return {p,storage,setTime:value=>tick=value,advance:value=>tick+=value,now:()=>tick};
}
const item=(p,id=sample.questions[0].id,at=START)=>p.exportSnapshot().daily?.days[lifeDayKey(at)]?.items[id];
const answer=(p,i=0,options={})=>p.recordAnswer({lessonId:sample.id,questionId:sample.questions[i].id,correct:false,...options});

test('learning dates use KST midnight and reject invalid timestamps',()=>{
 assert.equal(lifeDayKey(Date.parse('2026-10-11T14:59:59.999Z')),'2026-10-11');
 assert.equal(lifeDayKey(Date.parse('2026-10-11T15:00:00.000Z')),'2026-10-12');
 for(const at of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER,'100'])assert.throws(()=>lifeDayKey(at),TypeError);
});

test('first outcomes and guided success survive reload without changing first answers or spacing',()=>{
 const {p,storage}=fixture();p.startLesson(sample);
 answer(p,0,{correct:true});answer(p,1,{correct:true,helped:true});answer(p,2);
 const before=p.exportSnapshot(),writes=storage.writes;
 assert.equal(item(p,sample.questions[0].id).outcome,'independent');assert.equal(item(p,sample.questions[1].id).outcome,'assisted');assert.equal(item(p,sample.questions[2].id).outcome,'retry');
 const saved=p.recordGuidedPractice({questionId:sample.questions[2].id,tutorId:'kkamong'});assert.equal(saved.duplicate,false);
 assert.equal(storage.writes,writes+1);assert.deepEqual(p.exportSnapshot().lessons,before.lessons);assert.deepEqual(p.exportSnapshot().reviews,before.reviews);
 const restored=fixture({storage}).p;assert.equal(item(restored,sample.questions[2].id).tutorId,'kkamong');assert.equal(item(restored,sample.questions[2].id).outcome,'retry');assert.ok(item(restored,sample.questions[2].id).guidedAt>=START);
 const unchanged=storage.getItem(p.key);assert.equal(restored.recordGuidedPractice({questionId:sample.questions[2].id,tutorId:'mongle'}).duplicate,true);assert.equal(storage.getItem(p.key),unchanged);
 assert.equal(answer(restored,2,{correct:true}).duplicate,true);assert.equal(storage.getItem(p.key),unchanged);
});

test('same-day guided transfer is assisted after reload; next-day fresh review can be independent',()=>{
 const f=fixture(),{p,storage}=f,q=sample.questions[0];p.startLesson(sample);answer(p);
 p.recordGuidedPractice({questionId:q.id,tutorId:'marin'});f.advance(60000);
 const resumed=fixture({storage,at:f.now()}),run=resumed.p.startReview(1);assert.deepEqual(run.pendingHelp,{});
 assert.equal(resumed.p.answerReview({id:q.review.id,correct:true}).intervalDays,0);
 assert.equal(resumed.p.exportSnapshot().activeReview.answers[q.review.id].helped,true);assert.equal(item(resumed.p).outcome,'assisted');
 const next=fixture({storage,at:START+DAY});next.p.startReview(1);assert.equal(next.p.answerReview({id:q.review.id,correct:true}).intervalDays,1);
 assert.equal(next.p.exportSnapshot().activeReview.answers[q.review.id].helped,false);assert.equal(item(next.p,q.id,START+DAY).outcome,'independent');
 assert.equal(item(next.p,q.id,START).outcome,'assisted');
});

test('new first review response refreshes one daily item and permits a new guided completion',()=>{
 const f=fixture(),{p}=f,q=sample.questions[0];p.startLesson(sample);answer(p);p.recordGuidedPractice({questionId:q.id,tutorId:'marin'});
 const first=item(p).guidedAt;f.advance(60000);p.startReview(1);p.answerReview({id:q.review.id,correct:false});
 assert.ok(item(p).observedAt>first);assert.equal(p.recordGuidedPractice({questionId:q.id,tutorId:'mongle'}).duplicate,false);assert.ok(item(p).guidedAt>item(p).observedAt);
 assert.equal(Object.keys(p.exportSnapshot().daily.days[lifeDayKey(START)].items).length,1);
 const before=p.exportSnapshot();assert.equal(p.answerReview({id:q.review.id,correct:true}).duplicate,true);assert.deepEqual(p.exportSnapshot(),before);
});

test('closing requires real practice, is idempotent, and same-ms or backwards-clock work reopens the day',()=>{
 const f=fixture(),{p,storage}=f;p.startLesson(sample);let writes=storage.writes;
 assert.equal(p.markDayComplete().empty,true);assert.equal(storage.writes,writes);
 answer(p);const closed=p.markDayComplete();assert.equal(closed.empty,false);writes=storage.writes;
 assert.equal(p.markDayComplete().duplicate,true);assert.equal(storage.writes,writes);
 f.setTime(START-100);answer(p,1,{correct:true});assert.ok(item(p,sample.questions[1].id).observedAt>closed.closedAt);
 const second=p.markDayComplete();assert.equal(second.duplicate,false);assert.ok(second.closedAt>closed.closedAt);
 p.recordGuidedPractice({questionId:sample.questions[0].id,tutorId:'marin'});assert.ok(item(p).guidedAt>second.closedAt);
 assert.equal(p.markDayComplete().duplicate,false);
 const restored=fixture({storage,at:START}).p;assert.equal(restored.markDayComplete().duplicate,true);
});

test('KST day rollover separates new guided work from yesterday and preserves yesterday close',()=>{
 const end=Date.parse('2026-10-11T14:59:59.999Z'),f=fixture({at:end}),{p}=f,q=sample.questions[0];p.startLesson(sample);answer(p);p.markDayComplete();
 f.advance(1);const result=p.recordGuidedPractice({questionId:q.id,tutorId:'mongle'});assert.equal(result.dayKey,'2026-10-12');assert.equal(result.duplicate,false);
 const daily=p.exportSnapshot().daily;assert.equal(daily.days['2026-10-11'].closedAt,end);assert.equal(daily.days['2026-10-12'].closedAt,undefined);
 assert.equal(daily.days['2026-10-12'].items[q.id].outcome,undefined);
});

test('last millisecond of a day stays valid when new learning follows its close',()=>{
 const end=Date.parse('2026-10-11T14:59:59.999Z'),{p,storage}=fixture({at:end});p.startLesson(sample);answer(p);p.markDayComplete();answer(p,1);
 assert.equal(p.exportSnapshot().daily.days['2026-10-11'].closedAt,undefined);assert.equal(p.markDayComplete().duplicate,false);
 assert.equal(fixture({storage,at:end}).p.status().phase,'device');
});

test('legacy history is backfilled only from retained first answers, without changing its original bytes',()=>{
 const f=fixture(),{p,storage}=f,q=sample.questions[0];p.startLesson(sample);answer(p);f.advance(60000);p.startReview(1);p.answerReview({id:q.review.id,correct:true});
 const old=p.exportSnapshot();delete old.daily;const raw=JSON.stringify(old);storage.setItem(p.key,raw);const writes=storage.writes;
 const restored=fixture({storage,at:f.now()}).p;assert.equal(item(restored).outcome,'independent');assert.equal(item(restored).observedAt,f.now());
 assert.equal(item(restored).guidedAt,undefined);assert.equal(restored.exportSnapshot().revision,old.revision);assert.equal(storage.writes,writes);assert.equal(storage.getItem(p.key),raw);
 restored.markDayComplete();assert.ok(JSON.parse(storage.getItem(p.key)).daily);assert.deepEqual(restored.exportSnapshot().lessons,old.lessons);assert.deepEqual(restored.exportSnapshot().reviews,old.reviews);
});

test('guided practice requires current canonical catalog, a started question, and an approved tutor',()=>{
 const {p,storage}=fixture();p.startLesson(sample);const original=storage.getItem(p.key),other=lesson('unstarted');p.registerLesson(other);
 for(const values of [{questionId:'unknown',tutorId:'marin'},{questionId:other.questions[0].id,tutorId:'marin'},{questionId:sample.questions[0].id,tutorId:'marine'},{questionId:sample.questions[0].id,tutorId:'constructor'}])assert.throws(()=>p.recordGuidedPractice(values),TypeError);
 assert.equal(storage.getItem(p.key),original);
 const withoutCatalog=createLifeProgress({storage,now:()=>START});assert.throws(()=>withoutCatalog.recordGuidedPractice({questionId:sample.questions[0].id,tutorId:'marin'}),TypeError);
 assert.equal(storage.getItem(p.key),original);
});

test('daily writes block unreadable, loading, conflict and rejected state while retaining originals',()=>{
 for(const [transport,code]of [[{phase:'loading'},'LIFE_PROGRESS_LOADING'],[{phase:'conflict'},'REVISION_CONFLICT'],[{phase:'unreadable'},'LIFE_PROGRESS_UNREADABLE'],[{phase:'unsaved',rejected:1},'LIFE_PROGRESS_REJECTED']]){
  const {p,storage}=fixture({mode:'account',getSaveStatus:()=>transport});p.startLesson(sample);const original=storage.getItem(p.key);
  assert.throws(()=>p.recordGuidedPractice({questionId:sample.questions[0].id,tutorId:'marin'}),{code});assert.throws(()=>p.markDayComplete(),{code});assert.equal(storage.getItem(p.key),original);
 }
});

test('daily draft survives quota failure and flush retries without claiming it saved',async()=>{
 const {p,storage}=fixture();p.startLesson(sample);answer(p);const write=storage.setItem;let full=true;storage.setItem=(...values)=>{if(full)throw Error('quota');return write(...values);};
 const result=p.recordGuidedPractice({questionId:sample.questions[0].id,tutorId:'kkamong'});assert.equal(result.status.saved,false);assert.equal(p.status().phase,'unsaved');assert.ok(item(p).guidedAt);
 p.markDayComplete();assert.ok(p.exportSnapshot().daily.days[lifeDayKey(START)].closedAt);
 full=false;await p.flush();assert.equal(p.status().saved,true);assert.deepEqual(fixture({storage}).p.exportSnapshot(),p.exportSnapshot());
});

test('daily owner isolation and stale callback guards preserve the active account',()=>{
 const cache=memory();let valid=true;const a=fixture({storage:cache,owner:'account-a',guard:()=>{if(!valid)throw Object.assign(Error(),{code:'ACCOUNT_CHANGED'});}}).p;
 a.startLesson(sample);answer(a);a.recordGuidedPractice({questionId:sample.questions[0].id,tutorId:'marin'});a.markDayComplete();
 for(const owner of ['guest','account-b'])assert.equal(fixture({storage:cache,owner}).p.exportSnapshot().daily,undefined);
 const raw=cache.getItem(a.key);valid=false;assert.throws(()=>a.markDayComplete(),{code:'ACCOUNT_CHANGED'});assert.throws(()=>a.recordGuidedPractice({questionId:sample.questions[0].id,tutorId:'mongle'}),{code:'ACCOUNT_CHANGED'});assert.equal(cache.getItem(a.key),raw);
});

test('daily retention is bounded to the latest 30 days and latest 100 questions per day',()=>{
 const f=fixture(),{p,storage}=f;p.startLesson(sample);answer(p);
 for(let day=0;day<32;day++){f.setTime(START+day*DAY);p.recordGuidedPractice({questionId:sample.questions[0].id,tutorId:'marin'});}
 let daily=p.exportSnapshot().daily;assert.equal(Object.keys(daily.days).length,30);assert.equal(daily.days[lifeDayKey(START)],undefined);assert.equal(daily.days[lifeDayKey(START+DAY)],undefined);
 const many=lesson('many',100);p.startLesson(many);for(const q of many.questions){f.advance(1);p.recordGuidedPractice({questionId:q.id,tutorId:'kkamong'});}
 daily=p.exportSnapshot().daily;const today=daily.days[lifeDayKey(f.now())];assert.equal(Object.keys(today.items).length,100);assert.equal(today.items[sample.questions[0].id],undefined);
 assert.equal(fixture({storage,at:f.now()}).p.status().phase,'device');
});

test('invalid daily versions, IDs, timestamps, outcomes, tutors and limits preserve the raw original',()=>{
 const {p}=fixture();p.startLesson(sample);answer(p);const base=p.exportSnapshot(),key=`${LIFE_PROGRESS_KEY}:guest`,day=lifeDayKey(START),qid=sample.questions[0].id;
 const changes=[value=>value.daily.version=2,value=>value.daily.days[day].items[qid].outcome='mastered',value=>value.daily.days[day].items[qid].observedAt=START+DAY,value=>value.daily.days[day].closedAt=-1,value=>value.daily.days[day].items[qid].tutorId='marin',value=>Object.assign(value.daily.days[day].items[qid],{guidedAt:START,tutorId:'marine'}),value=>value.daily.days[day].items['bad id']=value.daily.days[day].items[qid],value=>value.daily.days['2026-02-30']=value.daily.days[day],value=>value.daily.days[day].extra=true,value=>{for(let i=0;i<101;i++)value.daily.days[day].items[`many-${i}`]={lessonId:sample.id,observedAt:START,outcome:'retry'};},value=>{for(let i=1;i<32;i++){const at=START+i*DAY;value.daily.days[lifeDayKey(at)]={items:{[qid]:{lessonId:sample.id,observedAt:at,outcome:'retry'}}};}}];
 for(const change of changes){const value=structuredClone(base);change(value);const raw=JSON.stringify(value),storage=memory();storage.setItem(key,raw);const restored=fixture({storage}).p;
  assert.equal(restored.status().phase,'unreadable');assert.throws(()=>restored.markDayComplete(),{code:'LIFE_PROGRESS_UNREADABLE'});assert.throws(()=>restored.recordGuidedPractice({questionId:qid,tutorId:'marin'}),{code:'LIFE_PROGRESS_UNREADABLE'});assert.equal(storage.getItem(key),raw);
 }
});
