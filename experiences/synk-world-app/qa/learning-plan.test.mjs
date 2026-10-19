// WORLD 학습 추천(world-learning-plan.mjs)의 10-19 고장 묶음: 손님 게임 · 열어만 본 레슨 · 한글부터 · 바닥난 바람길.
// 실제 생활 콘텐츠와 Core(atlas/learning.js)를 그대로 돌린다. 화면·계정 서버는 쓰지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createWorldLearningPlan} from '../world-learning-plan.mjs';
import {createLifeProgress} from '../life-progress.mjs';
import {PACKS,LESSONS} from '../life-content.mjs';
import {LISTENING_CHECKS,checkMetadata} from '../../korean-runner/listening-check.mjs';
const require=createRequire(import.meta.url);
const Learning=require('../../../atlas/learning.js');
const browser=require('../../../atlas/game-browser.js');
const DAY=86400000,START=Date.UTC(2026,9,19,0);
function memory(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
function life(owner='plan-test'){
 let tick=START,sequence=0;const storage=memory();
 const progress=createLifeProgress({storage,owner,now:()=>tick,uuid:()=>`plan-attempt-${++sequence}`});
 progress.summary(PACKS,LESSONS);
 return {progress,now:()=>tick,advance:ms=>{tick+=ms;}};
}
// 공개판(계정 모드) 손님이 지금 열 수 있는 게임: 10-19 결정 「WORLD 손님」으로 한글 만나기만(바람길·리듬은 로그인 뒤).
const GUEST=['hangul'];
const plan=(f,{settings={},openGames=null,summary=null,recommendActivities=Learning.recommendActivities}={})=>createWorldLearningPlan({summary,progress:f.progress.exportSnapshot(),settings,now:f.now(),recommendActivities,openGames});
const lesson=id=>LESSONS.find(l=>l.id===id);
function answerAll(f,id,{correct=true}={}){
 const l=lesson(id);f.progress.startLesson(l);
 for(const q of l.questions)f.progress.recordAnswer({lessonId:id,questionId:q.id,correct,choiceId:correct?q.answerId:q.choices.find(c=>c.id!==q.answerId).id});
 f.progress.finishLesson(id);
}
const exam={reasons:['exam'],primaryReason:'exam'};

test('a public guest is not sent to games that open only after sign-in, so the login loop cannot start',()=>{
 const f=life('guest');
 const open=plan(f,{settings:exam});
 assert.equal(open.selected.gameId,'runner','a signed-in TOPIK learner may still start with 바람길');
 const guest=plan(f,{settings:exam,openGames:GUEST});
 assert.notEqual(guest.selected.gameId,'runner');
 assert.equal(guest.selected.lessonId,'greetings-expressions');
 for(const id of ['world.play.runner','world.play.rhythm'])
  assert.deepEqual(guest.excluded.find(row=>row.id===id)?.reasons,['activity.unavailable']);
 assert.equal(guest.excluded.find(row=>row.id==='world.play.hangul'),undefined,'한글 만나기 is open to guests (10-19)');
 assert.ok(guest.candidates.filter(c=>c.route==='game'&&c.gameId!=='hangul').every(c=>c.available===false&&c.accountRequired===true));
 assert.ok(guest.alternatives.some(c=>c.gameId==='hangul'));
 assert.deepEqual(plan(f,{settings:exam,openGames:[]}).excluded.filter(row=>row.id.startsWith('world.play.')).length,3,'no game open at all');
});

test('an opened lesson with no answer does not jump ahead of a returned review; an answered one resumes',()=>{
 const f=life();
 answerAll(f,'greetings-expressions',{correct:false});
 f.advance(2*60000);
 f.progress.startLesson(lesson('cafe-expressions'));
 const opened=plan(f);
 assert.equal(opened.resume,null);
 assert.equal(opened.selected.route,'review','the returned review comes first');
 assert.ok(opened.reasons.includes('review.due'));
 const q=lesson('cafe-expressions').questions[0];
 f.progress.recordAnswer({lessonId:'cafe-expressions',questionId:q.id,correct:true,choiceId:q.answerId});
 const answered=plan(f);
 assert.equal(answered.selected.id,'world.resume.lesson.cafe-expressions');
 assert.deepEqual(answered.reasons,['progress.resume']);
 assert.ok(answered.alternatives.some(item=>item.route==='review'),'the returned review stays beside the resume');
});

test('a learner who cannot read Hangul yet meets 한글 만나기 first, until finishing or skipping it there',()=>{
 const f=life();
 f.progress.setHangulReading('new');
 const first=plan(f,{settings:exam});
 assert.equal(first.selected.gameId,'hangul');
 assert.deepEqual(first.reasons,['progress.prerequisite']);
 assert.equal(first.prerequisite.id,'world.play.hangul');
 assert.equal(first.basis,'host-prerequisite');
 // A guest on the public site can open 한글 만나기 (10-19 decision), so it comes first there too.
 assert.equal(plan(f,{settings:exam,openGames:GUEST}).selected.gameId,'hangul');
 // When it cannot be opened, there is no prerequisite and Core's order stands.
 const closed=plan(f,{settings:exam,openGames:[]});
 assert.equal(closed.prerequisite,null);
 assert.notEqual(closed.selected.route,'game');
 // Sound off excludes the listening game: no prerequisite either.
 assert.equal(plan(f,{settings:{audio:'off'}}).prerequisite,null);
 // A lesson the person answered still resumes first.
 const q=lesson('greetings-expressions').questions[0];f.progress.startLesson(lesson('greetings-expressions'));
 f.progress.recordAnswer({lessonId:'greetings-expressions',questionId:q.id,correct:true,choiceId:q.answerId});
 assert.deepEqual(plan(f).reasons,['progress.resume']);
 // Graduation or skipping in 한글 만나기 ends it.
 const g=life();g.progress.setHangulReading('new');g.progress.setHangulReading('reads',{via:'graduation'});
 const after=plan(g);
 assert.equal(after.prerequisite,null);
 assert.equal(after.selected.lessonId,'greetings-expressions');
 // Without any answer nothing changes (the 10-19 baseline: 44 new learners, 한글 first 0 times).
 assert.notEqual(plan(life()).selected.gameId,'hangul');
});

test('a TOPIK learner whose 바람길 checks are all used gets the due life review instead of 바람길 every time',()=>{
 const f=life('runner-topik');
 let clock=START;
 const coach=browser.engine.createGame({gameId:'world-home',storage:memory(),clock:()=>new Date(clock).toISOString()});
 for(const item of LISTENING_CHECKS){
  clock+=1000;const pid=coach.present(checkMetadata(item));coach.delivery(pid,{audio:'completed'});coach.answer(pid,{correct:true,assessable:true});
 }
 answerAll(f,'greetings-expressions');
 f.advance(9*DAY);clock=f.now(); // runner's newest independent answer is 9 days old ('review'); the life reviews are due
 const summary=coach.summary();
 const before=plan(f,{settings:exam,summary});
 assert.equal(before.selected.gameId,'runner','the 10-19 behaviour: profile alone, no presentations');
 const fixed=plan(f,{settings:exam,summary,recommendActivities:input=>coach.recommendActivities(input.candidates,{settings:input.settings,at:input.at})});
 assert.equal(fixed.selected.route,'review','with the presented history the spent 바람길 leaves the urgent tier');
 const runner=fixed.assessments.find(row=>row.id==='world.play.runner');
 assert.ok(runner.reasons.includes('practice.spent'));
});
