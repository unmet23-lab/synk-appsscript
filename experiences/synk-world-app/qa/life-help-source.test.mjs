// 10-19 고장 묶음 · 생활 진도: 「한 단계씩 도움받기」가 스스로 연 도움(helpSource:'setting')은 기록에 남되 복습 간격을 되돌리지 않는다.
// 답한 레슨만 「하던 자리」, 결과 화면의 새 장면 복습, 첫 실행 「한글을 읽을 수 있어요?」 답 저장도 함께 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLifeProgress,LIFE_PROGRESS_KEY,lifeDayKey} from '../life-progress.mjs';
import {PACKS,LESSONS} from '../life-content.mjs';
import {runScenario} from './review-loop-20261019/scenario.mjs';
const MINUTE=60000,DAY=86400000,START=Date.UTC(2026,9,19,0);
function fixture({owner='help-source-test',raw}={}){
 let tick=START,sequence=0;const values=new Map();
 if(raw!==undefined)values.set(`${LIFE_PROGRESS_KEY}:${owner}`,raw);
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
 const progress=createLifeProgress({storage,owner,now:()=>tick,uuid:()=>`help-attempt-${++sequence}`});
 progress.summary(PACKS,LESSONS);
 return {progress,now:()=>tick,advance:ms=>{tick+=ms;},record:()=>JSON.parse(values.get(`${LIFE_PROGRESS_KEY}:${owner}`))};
}
const greeting=LESSONS.find(l=>l.id==='greetings-expressions');
const choose=(q,correct)=>correct?q.answerId:q.choices.find(c=>c.id!==q.answerId).id;

test('help the step setting opened by itself is kept as help but does not pull the review back to a minute',()=>{
 const f=fixture();f.progress.startLesson(greeting);
 const [a,b,c]=greeting.questions;
 f.progress.recordAnswer({lessonId:greeting.id,questionId:a.id,correct:true,helped:true,helpSource:'setting',choiceId:choose(a,true)});
 f.progress.recordAnswer({lessonId:greeting.id,questionId:b.id,correct:true,helped:true,choiceId:choose(b,true)});
 f.progress.recordAnswer({lessonId:greeting.id,questionId:c.id,correct:false,helped:true,helpSource:'setting',choiceId:choose(c,false)});
 const snap=f.progress.exportSnapshot(),answers=snap.lessons[greeting.id].answers;
 assert.deepEqual([answers[a.id].helped,answers[a.id].helpSource],[true,'setting']);
 assert.deepEqual([answers[b.id].helped,answers[b.id].helpSource],[true,undefined],'help without a stated source counts as asked for');
 const review=q=>snap.reviews[q.review.id];
 assert.deepEqual({due:review(a).dueAt-START,interval:review(a).intervalDays,lapses:review(a).lapses},{due:DAY,interval:1,lapses:0});
 assert.deepEqual({due:review(b).dueAt-START,interval:review(b).intervalDays,lapses:review(b).lapses},{due:MINUTE,interval:0,lapses:1});
 assert.deepEqual({due:review(c).dueAt-START,interval:review(c).intervalDays,lapses:review(c).lapses},{due:MINUTE,interval:0,lapses:1},'a wrong answer is still difficult');
 const day=snap.daily.days[lifeDayKey(START)].items;
 assert.equal(day[a.id].outcome,'assisted','the day record stays honest: it was a helped answer');
});

test('a saved stage carries the setting source for its own question only, and an answer reads it',()=>{
 const f=fixture();f.progress.startLesson(greeting);
 f.progress.setStage(greeting.id,{phase:'questions',sceneIndex:0,questionIndex:0,helped:true,helpSource:'setting'});
 assert.equal(f.progress.lessonState(greeting.id).stage.helpSource,'setting');
 const q=greeting.questions[0];
 f.progress.recordAnswer({lessonId:greeting.id,questionId:q.id,correct:true,choiceId:q.answerId});
 assert.equal(f.progress.exportSnapshot().lessons[greeting.id].answers[q.id].helpSource,'setting');
 assert.equal(f.progress.exportSnapshot().reviews[q.review.id].intervalDays,1);
 const next=f.progress.lessonState(greeting.id).stage;
 assert.equal(next.helped,false,'the next question starts without the old help');
 assert.equal(next.helpSource,undefined);
 f.progress.setStage(greeting.id,{phase:'questions',sceneIndex:0,questionIndex:1,helped:false,helpSource:'setting'});
 assert.equal(f.progress.lessonState(greeting.id).stage.helpSource,undefined,'no help, no source');
 assert.throws(()=>f.progress.setStage(greeting.id,{phase:'questions',questionIndex:1,helped:true,helpSource:'tutor'}),TypeError);
 assert.throws(()=>f.progress.recordAnswer({lessonId:greeting.id,questionId:greeting.questions[1].id,correct:true,helped:true,helpSource:'auto'}),TypeError);
});

test('stored records with a forged help source or Hangul answer are unreadable and kept as they are',()=>{
 const f=fixture();f.progress.startLesson(greeting);const q=greeting.questions[0];
 f.progress.recordAnswer({lessonId:greeting.id,questionId:q.id,correct:true,helped:true,helpSource:'setting',choiceId:q.answerId});
 const good=f.record();
 const forge=edit=>{const value=structuredClone(good);edit(value);return JSON.stringify(value);};
 for(const raw of [
  forge(v=>{v.lessons[greeting.id].answers[q.id].helped=false;}),
  forge(v=>{v.lessons[greeting.id].answers[q.id].helpSource='user';}),
  forge(v=>{v.lessons[greeting.id].stage={phase:'questions',sceneIndex:0,questionIndex:1,helped:false,helpSource:'setting'};}),
  forge(v=>{v.hangul={version:1,answer:'maybe',at:START,via:'question'};}),
  forge(v=>{v.hangul={version:1,answer:'new',at:START,via:'question',level:3};}),
 ]){
  const copy=fixture({raw});
  assert.equal(copy.progress.status().phase,'unreadable');
 }
 assert.equal(fixture({raw:JSON.stringify(good)}).progress.status().phase,'device');
});

test('only a lesson with an answered question is the place to resume',()=>{
 const f=fixture();f.progress.startLesson(greeting);
 let s=f.progress.summary(PACKS,LESSONS);
 assert.equal(s.resume,false);assert.equal(s.nextLesson.id,greeting.id,'it is still the next lesson');
 const q=greeting.questions[0];f.progress.recordAnswer({lessonId:greeting.id,questionId:q.id,correct:true,choiceId:q.answerId});
 s=f.progress.summary(PACKS,LESSONS);
 assert.equal(s.resume,true);
});

test('a lesson result can open its just-missed expressions in a new scene without waiting the minute',()=>{
 const f=fixture();f.progress.startLesson(greeting);
 for(const [i,q] of greeting.questions.entries())f.progress.recordAnswer({lessonId:greeting.id,questionId:q.id,correct:i!==1,choiceId:choose(q,i!==1)});
 f.progress.finishLesson(greeting.id);f.advance(5000);
 const missed=greeting.questions[1].review.id;
 assert.equal(f.progress.startReview(1,null,[missed]),null,'not due yet without the result screen request');
 assert.throws(()=>f.progress.startReview(6,null,null,{soon:true}),TypeError,'an early review names its expressions');
 const run=f.progress.startReview(1,missed,[missed],{soon:true});
 assert.deepEqual(run.ids,[missed]);
 const done=f.progress.answerReview({id:missed,runId:run.id,correct:true,helped:false});
 assert.equal(done.intervalDays,1);
});

test('the first-run Hangul answer is kept in the progress record next to the tutor choice',()=>{
 const f=fixture();
 assert.equal(f.progress.hangulReading(),null);
 const first=f.progress.setHangulReading('new');
 assert.deepEqual(first.hangul,{version:1,answer:'new',at:START,via:'question'});
 assert.equal(first.duplicate,false);
 assert.equal(f.progress.setHangulReading('new').duplicate,true);
 f.advance(DAY);
 assert.deepEqual(f.progress.setHangulReading('reads',{via:'graduation'}).hangul,{version:1,answer:'reads',at:START+DAY,via:'graduation'});
 assert.deepEqual(f.record().hangul,{version:1,answer:'reads',at:START+DAY,via:'graduation'});
 assert.throws(()=>f.progress.setHangulReading('some'),TypeError);
 assert.throws(()=>f.progress.setHangulReading('new',{via:'guess'}),TypeError);
});

test('8 days of three 「다음 연습」 a day: step support now spaces 1→3→7 days and moves on like choosing alone',()=>{
 const before=runScenario('before'),after=runScenario('after'),alone=runScenario('choose');
 assert.equal(before.completedLessons,1,'the 10-19 loop: one lesson, then the same review every time');
 assert.ok(before.mostRepeatedReview>=20);
 assert.equal(after.completedLessons,alone.completedLessons);
 assert.ok(after.completedLessons>=6,'new lessons keep coming');
 for(const intervals of Object.values(after.firstLessonIntervals))assert.deepEqual(intervals,[1,3,7]);
 assert.ok(after.mostRepeatedReview<=3);
});
