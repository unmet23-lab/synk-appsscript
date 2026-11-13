// Atlas × WORLD 2단계 D(2026-11-08): 생활 한국어의 Trail 거울(life-trail.mjs) — 실제 WORLD 코치 · 실제 생활 진도로 계약을 본다.
// 보임은 보인 순간(엔진 노출 계약), 도움은 제품 진실대로, 계열 덩어리, 카페 장면 · 검수 자격, 제품 이력 대조, Temper 재확인 · 공급.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createLifeProgress,LIFE_PROGRESS_KEY} from '../life-progress.mjs';
import {PACKS,LESSONS,lessonById} from '../life-content.mjs';
import {worldLearning} from '../world-learning-map.mjs';
import {createLifeTrail,lessonSlot,reviewSlot,productMet} from '../life-trail.mjs';
import {lifeItem,lifeItems,sameChoices,lifeAssessable} from '../life-items.mjs';
import {lifeFollowupRows} from '../life-followups.mjs';
import {weekActivity,buildExamPlan,examInfo,examEvidenceSkills} from '../world-exam-plan.mjs';
import {followupCards} from '../world-learning-ui.mjs';
import {createPositionView} from '../world-position-ui.mjs';
const require=createRequire(import.meta.url);
const Trail=require('../../../atlas/trail.js');
const MINUTE=60000,DAY=86400000,START=Date.UTC(2026,10,9,1);
const SCOPE={domain:'LAB',workspace:'learning',subject:'device'};

function fixture({assessable=()=>true,owner='life-trail-test'}={}){
 let tick=START,seq=0;const values=new Map(),coachValues=new Map();
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
 const progress=createLifeProgress({storage,owner,now:()=>tick,uuid:()=>`life-run-${++seq}`});progress.summary(PACKS,LESSONS);
 const coach=worldLearning.engine.createGame({gameId:'world-life',followups:true,storage:{getItem:k=>coachValues.get(k)??null,setItem:(k,v)=>coachValues.set(k,String(v))},clock:()=>new Date(tick).toISOString()});
 let available=true;
 const trail=createLifeTrail({coach:()=>available?coach:null,snapshot:()=>progress.exportSnapshot(),assessable});
 const f={progress,coach,trail,values,now:()=>tick,advance:ms=>{tick+=ms;},offline:()=>{available=false;},online:()=>{available=true;},
  attempts:()=>Trail.summarize(coach.events(),{scope:SCOPE,asOf:new Date(tick).toISOString()}).attempts,
  presented:()=>coach.events().filter(e=>e.type==='practice.presented'),
  raw:()=>values.get(`${LIFE_PROGRESS_KEY}:${owner}`)};
 // 생활 화면(life-ui.mjs)이 하는 그대로: 레슨 문항이 보이고 → (도움) → 제품이 첫 답을 저장하면 거울도 저장된 답 그대로.
 f.lesson=id=>{const lesson=lessonById(id),state=progress.startLesson(lesson,{replay:progress.lessonState(id).status==='completed'});return {lesson,attempt:state.attemptId};};
 f.show=(run,q,{helped=false}={})=>trail.shown(lessonSlot(run.attempt,q.id),lifeItem({lesson:run.lesson,question:q}),{helped});
 f.answer=(run,q,{correct=true,helped=false,helpSource}={})=>{
  const choiceId=correct?q.answerId:q.choices.find(c=>c.id!==q.answerId).id;
  const saved=progress.recordAnswer({lessonId:run.lesson.id,questionId:q.id,choiceId,correct,helped,helpSource});
  if(saved.duplicate===false){const stored=saved.answers[q.id];trail.answer(lessonSlot(run.attempt,q.id),{correct:stored.correct,choiceId:stored.choiceId,correctId:q.answerId,helped:stored.helped});}
  return saved;
 };
 f.review=(reviewIds,{correct=true,helped=false}={})=>{
  const runReview=progress.startReview(reviewIds.length,reviewIds[0],reviewIds);assert.ok(runReview,'review run started');
  for(const id of runReview.ids){
   const record=progress.exportSnapshot().reviews[id],lesson=lessonById(record.lessonId),q=lesson.questions.find(x=>x.id===record.questionId);
   const slot=reviewSlot(runReview.id,id);trail.shown(slot,lifeItem({lesson,question:q,review:true}),{helped:runReview.pendingHelp?.[id]===true});
   if(helped)trail.help(slot,'explanation');
   const saved=progress.answerReview({id,runId:runReview.id,correct,helped});
   const stored=progress.exportSnapshot().activeReview.answers[id];
   if(saved.duplicate===false)trail.answer(slot,{correct:stored.correct,choiceId:correct?q.review.answerId:'zz',correctId:q.review.answerId,helped:stored.helped});
  }
 };
 return f;
}
const lessonOf=id=>LESSONS.find(l=>l.id===id);
const q=(lessonId,qid)=>lessonOf(lessonId).questions.find(x=>x.id===qid);

test('레슨 첫 답: 도움 없이 처음 보는 문항이면 독립 근거 · 보임은 보인 순간 하나(다시 그려도 하나)', () => {
 const f=fixture(),run=f.lesson('cafe-expressions'),order=q('cafe-expressions','cafe-expressions-order');
 f.show(run,order);f.show(run,order);
 assert.equal(f.presented().length,1,'보인 순간 코치에 보이고, 같은 판을 다시 그려도 하나다');
 f.answer(run,order);
 const [row]=f.attempts();
 assert.equal(f.presented().length,1);assert.equal(row.exposure,'new');assert.equal(row.assisted,false);assert.equal(row.independent,true);
 assert.equal(row.measure.skillId,'ko.reading.detail');assert.equal(row.measure.familyKey,lifeItem({lesson:run.lesson,question:order}).familyKey);
});

test('흘끗 보고 새로고침한 문항: Trail 근거 · 앵커로는 남지만 Temper 짝은 못 되고, 보기만 한 문항은 재확인 공급의 처음 문항이 아니다(엔진 노출 계약 — 끝 판 검수 GPT GB1 · Fable F1)', () => {
 const f=fixture(),run=f.lesson('cafe-expressions'),[order,here]=lessonOf('cafe-expressions').questions;
 f.show(run,order);f.answer(run,order);
 f.advance(DAY+MINUTE);
 // 다음 날 같은 칸(세부)의 정답이 바뀐 복습을 흘끗 보고, 새로고침 뒤(거울이 새로 선다 — 같은 판 열쇠) 혼자 맞힌다.
 const review=f.progress.startReview(1,'cafe-expressions-order-transfer',['cafe-expressions-order-transfer']);
 const item=lifeItem({lesson:run.lesson,question:order,review:true}),slot=reviewSlot(review.id,'cafe-expressions-order-transfer');
 f.trail.shown(slot,item);
 const fresh=createLifeTrail({coach:()=>f.coach,snapshot:()=>f.progress.exportSnapshot(),assessable:()=>true});
 fresh.shown(slot,item);
 f.progress.answerReview({id:'cafe-expressions-order-transfer',runId:review.id,correct:true});
 fresh.answer(slot,{correct:true,choiceId:order.review.answerId,correctId:order.review.answerId,helped:false});
 const row=f.attempts().find(r=>r.itemKey===item.itemKey);
 assert.equal(f.presented().filter(e=>e.itemKey===item.itemKey).length,2,'보인 순간마다 보임');
 assert.equal(row.exposure,'new');assert.equal(row.independent,true,'Trail: 보기만 한 것은 처음을 깨지 않는다(trail.js firstExposure — 답 · 정답 보임만)');
 const d1=f.coach.followups().items.find(r=>r.gameId==='world-life'&&r.window==='d1');
 assert.equal(d1.status,'due');assert.equal(d1.outcome??null,null,'Temper 짝은 그 문항 · 계열의 첫 보임 판의 답만(temper.js fresh) — 흘끗 본 뒤 새로고침한 답은 짝이 아니다');
 // 보기만 한 다른 문항(답 없음)도 코치 노출로는 이미 본 문항이다 — 재확인 공급(life-followups.mjs fresh)이 이것으로 거른다.
 const glimpsed=lifeItem({lesson:run.lesson,question:here});
 assert.equal(f.coach.exposure(glimpsed).seen,false);
 f.show(run,here);
 assert.equal(f.coach.exposure(glimpsed).seen,true);
});

test('코치가 없을 때 연 튜터 안내 연습은 코치가 생긴 첫 자리에서 먼저 보여, 그 뒤 복습 답은 도움 받은 답이다(끝 판 검수 Fable F2)', () => {
 const f=fixture(),run=f.lesson('cafe-expressions'),order=q('cafe-expressions','cafe-expressions-order');
 f.show(run,order);f.answer(run,order);
 f.offline();f.trail.guided(lifeItem({lesson:run.lesson,question:order,review:true}));
 assert.equal(f.presented().length,1,'코치가 없어 아직 보이지 않았다');
 f.online();f.advance(DAY+MINUTE);f.review(['cafe-expressions-order-transfer']);
 const row=f.attempts().find(r=>r.itemKey==='life.cafe-expressions-order-transfer');
 assert.equal(row.assisted,true);assert.equal(row.independent,false);
 const shown=f.presented().filter(e=>e.itemKey==='life.cafe-expressions-order-transfer');
 assert.equal(shown.length,2,'안내 연습 판이 복습 판보다 먼저 보였다');
});

test('도움(사람 · 「한 단계씩」 설정 · 새로고침 뒤 이어 하기)은 Trail에 도움이다', () => {
 const f=fixture(),run=f.lesson('cafe-expressions'),[order,here,takeout]=lessonOf('cafe-expressions').questions;
 f.show(run,order);f.trail.help(lessonSlot(run.attempt,order.id),'explanation');f.answer(run,order,{helped:true});
 f.show(run,here,{helped:true});f.answer(run,here,{helped:true,helpSource:'setting'});
 // 제품 진도가 도움을 기억하는데(단계) 거울 판에는 도움이 없던 경우 — 답할 때 제품의 도움을 먼저 적는다.
 f.show(run,takeout);f.progress.setStage('cafe-expressions',{phase:'questions',sceneIndex:0,questionIndex:2,helped:true});f.answer(run,takeout);
 const rows=f.attempts();
 assert.deepEqual(rows.map(r=>[r.assisted,r.independent]),[[true,false],[true,false],[true,false]]);
});

test('계열: 정답이 바뀐 새 상황 복습은 새 문항(독립 근거), 정답이 같은 쌍둥이 · 같은 보기 묶음 복습은 반복', () => {
 const f=fixture();
 const cafe=f.lesson('cafe-expressions');for(const x of lessonOf('cafe-expressions').questions){f.show(cafe,x);f.answer(cafe,x);}
 f.progress.finishLesson('cafe-expressions');
 const greet=f.lesson('greetings-expressions');for(const x of lessonOf('greetings-expressions').questions){f.show(greet,x);f.answer(greet,x);}
 f.advance(DAY+MINUTE);
 f.review(['cafe-expressions-order-transfer','greetings-expressions-hello-transfer']);
 const byKey=new Map(f.attempts().map(r=>[r.itemKey,r]));
 const changed=byKey.get('life.cafe-expressions-order-transfer'),twin=byKey.get('life.greetings-expressions-hello-transfer');
 assert.equal(changed.exposure,'new');assert.equal(changed.independent,true,'정답 · 보기가 바뀐 복습은 처음 보는 문항');
 assert.equal(twin.exposure,'repeat');assert.equal(twin.independent,false,'「안녕하세요」 쌍둥이 복습은 같은 계열의 반복');
 // 같은 보기 묶음 9쌍: 복습이 본문항 계열을 쓴다.
 const pairs=LESSONS.flatMap(l=>l.questions.filter(sameChoices).map(x=>[l,x]));
 assert.equal(pairs.length,9);
 for(const [l,x] of pairs)assert.equal(lifeItem({lesson:l,question:x,review:true}).familyKey,lifeItem({lesson:l,question:x}).familyKey,x.id);
});

test('같은 복습을 두 번째(1 · 3 · 7일 회차) 풀면 반복이다 — 제품 일정은 그대로', () => {
 const f=fixture(),run=f.lesson('cafe-expressions'),order=q('cafe-expressions','cafe-expressions-order');
 f.show(run,order);f.answer(run,order);f.advance(DAY+MINUTE);f.review(['cafe-expressions-order-transfer']);
 const before=f.progress.exportSnapshot().reviews['cafe-expressions-order-transfer'];
 f.advance(DAY+MINUTE);f.review(['cafe-expressions-order-transfer']);
 const rows=f.attempts().filter(r=>r.itemKey==='life.cafe-expressions-order-transfer');
 assert.deepEqual(rows.map(r=>r.exposure),['new','repeat']);
 const after=f.progress.exportSnapshot().reviews['cafe-expressions-order-transfer'];
 assert.deepEqual([before.streak,after.streak,after.intervalDays],[1,2,3],'제품의 1 · 3 · 7 · 14 · 30일 약속은 그대로 돈다');
});

test('튜터 안내 연습으로 미리 본 복습은 도움 받은 · 처음이 아닌 시도라 근거 · 짝이 아니다', () => {
 const f=fixture(),run=f.lesson('cafe-expressions'),order=q('cafe-expressions','cafe-expressions-order');
 f.show(run,order);f.answer(run,order);
 f.trail.guided(lifeItem({lesson:run.lesson,question:order,review:true}));
 f.advance(DAY+MINUTE);f.review(['cafe-expressions-order-transfer']);
 const row=f.attempts().find(r=>r.itemKey==='life.cafe-expressions-order-transfer');
 assert.equal(row.assisted,true);assert.equal(row.independent,false);
});

test('카페 방문 장면 문항은 보임 · 도움 · 소리만 남고 근거가 없다(visual)', () => {
 const f=fixture(),run=f.lesson('cafe-apply'),[first]=lessonOf('cafe-apply').questions;
 const slot=lessonSlot(run.attempt,first.id);f.show(run,first);f.trail.delivery(slot,'pending');f.trail.delivery(slot,'completed');f.answer(run,first);
 const [row]=f.attempts();
 assert.equal(row.measure.confounded,true);assert.equal(row.exclusionReason,'visual');assert.equal(row.independent,false);
 assert.equal(f.coach.events().filter(e=>e.type==='practice.delivery').length,2);
});

test('AI 2중 검수 판정이 없는 문항은 노출만 남는다(판정 자격 없음)', () => {
 // 판정 목록(existing-verdicts.json)에 이 문항 줄이 없을 때 — 2중 검수 전에는 생활 문항 전부가 이 상태다.
 const f=fixture({assessable:item=>lifeAssessable({...item,itemKey:'life.not-reviewed-yet'})}),run=f.lesson('cafe-expressions'),order=q('cafe-expressions','cafe-expressions-order');
 f.show(run,order);f.answer(run,order);
 const [row]=f.attempts();assert.equal(row.verdict,'unassessed');assert.equal(row.independent,false);
});

test('코치가 늦게 준비되면 첫 도움 · 답 때 이어 적고, 끝내 없으면 레슨은 그대로 · 제품 기록은 거울과 상관없다', () => {
 const f=fixture(),run=f.lesson('cafe-expressions'),[order,here]=lessonOf('cafe-expressions').questions;
 f.offline();f.show(run,order);f.trail.help(lessonSlot(run.attempt,order.id),'explanation');
 f.online();f.answer(run,order,{helped:true});
 const [row]=f.attempts();assert.equal(row.assisted,true,'코치가 없을 때 연 도움도 답 때 적힌다');
 f.offline();f.show(run,here);assert.doesNotThrow(()=>f.answer(run,here));
 assert.equal(f.attempts().length,1,'코치가 없던 답은 Trail에 없다');
 // 같은 진행을 거울 없이 한 제품 기록과 바이트가 같다(거울이 제품 기록을 바꾸지 않는다).
 const g=fixture(),run2=g.lesson('cafe-expressions');g.offline();
 g.show(run2,order);g.trail.help(lessonSlot(run2.attempt,order.id),'explanation');g.answer(run2,order,{helped:true});g.show(run2,here);g.answer(run2,here);
 assert.equal(f.raw(),g.raw());
});

test('코치 호출이 던져도 레슨은 막히지 않는다', () => {
 let tick=START;const progress=createLifeProgress({storage:{getItem:()=>null,setItem(){}},owner:'throw',now:()=>tick,uuid:()=>'run-1'});progress.summary(PACKS,LESSONS);
 const broken={present(){throw Error('boom');},help(){throw Error('boom');},answer(){throw Error('boom');},delivery(){throw Error('boom');}};
 const trail=createLifeTrail({coach:()=>broken,snapshot:()=>progress.exportSnapshot(),assessable:()=>true});
 const lesson=lessonOf('cafe-expressions'),order=lesson.questions[0];progress.startLesson(lesson);
 const slot=lessonSlot('run-1',order.id);
 assert.doesNotThrow(()=>{trail.shown(slot,lifeItem({lesson,question:order}));trail.help(slot,'explanation');trail.answer(slot,{correct:true,choiceId:'a',correctId:'b',helped:true});});
});

test('제품 이력 대조: 거울이 빠졌던 문항을 다시 보이면(다시 하기 · 이미 푼 복습) 근거로 세지 않는다', () => {
 const f=fixture(),lesson=lessonOf('cafe-expressions');
 f.offline();const run=f.lesson('cafe-expressions');for(const x of lesson.questions){f.show(run,x);f.answer(run,x);}f.progress.finishLesson('cafe-expressions');
 f.advance(DAY+MINUTE);f.review(['cafe-expressions-order-transfer']);
 f.online();
 // 마친 레슨을 다시 하는 판: Trail은 처음이라 보지만 제품은 이미 풀었다.
 const again=f.lesson('cafe-expressions'),order=lesson.questions[0];
 assert.equal(productMet(lifeItem({lesson:again.lesson,question:order}),f.progress.exportSnapshot()),true);
 f.show(again,order);f.answer(again,order);
 // 이미 맞힌 복습(streak 1)을 다음 회차에 다시 풀기.
 f.advance(DAY+MINUTE);f.review(['cafe-expressions-order-transfer']);
 const rows=f.attempts();
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.verdict==='unassessed'&&!r.independent),'거울이 빠졌던 문항의 재노출은 근거 없음');
 // 처음 푸는 복습은 대조에 걸리지 않는다(본문항 답 뒤 갱신 없음 · 맞힌 적 없음).
 const g=fixture(),run2=g.lesson('cafe-expressions');g.show(run2,order);g.answer(run2,order);
 assert.equal(productMet(lifeItem({lesson:run2.lesson,question:order,review:true}),g.progress.exportSnapshot()),false);
});

test('제품 이력 대조: 레슨 도중 튜터 안내 연습으로 본 복습 원고는 복습 기록이 생기기 전에도 「만남」이다(검수 아르곤 A2)', () => {
 const f=fixture(),run=f.lesson('cafe-expressions'),order=q('cafe-expressions','cafe-expressions-order');
 const transfer=lifeItem({lesson:run.lesson,question:order,review:true});
 assert.equal(productMet(transfer,f.progress.exportSnapshot()),false);
 f.progress.recordGuidedPractice({questionId:order.id,tutorId:'mongle'});
 const snapshot=f.progress.exportSnapshot();
 assert.equal(snapshot.reviews['cafe-expressions-order-transfer'],undefined,'본문항 답 전이라 복습 기록은 아직 없다');
 assert.equal(productMet(transfer,snapshot),true);
 // 판정에서도: 그 계열을 거울이 보이지 않았으면(코치 없음) 처음이 아니다.
 const g=fixture(),run2=g.lesson('cafe-expressions');g.offline();g.progress.recordGuidedPractice({questionId:order.id,tutorId:'mongle'});g.online();
 g.show(run2,order);g.answer(run2,order);g.advance(DAY+MINUTE);g.review(['cafe-expressions-order-transfer']);
 const row=g.attempts().find(r=>r.itemKey==='life.cafe-expressions-order-transfer');
 assert.equal(row.verdict,'unassessed');
});

test('제품 이력 대조는 Trail이 처음 볼 때만 — 거울이 이은 같은 표현 계열의 다른 문항은 반복 근거로 남는다(다시 검수 그록 KA1)', () => {
 // 다른 레슨에 있는 같은 계열 본문항 둘(「안녕하세요」 같은 표현 계열).
 const mains=lifeItems().filter(i=>!i.review&&!i.confounded);
 const pair=mains.map(a=>[a,mains.find(b=>b.familyKey===a.familyKey&&b.lessonId!==a.lessonId)]).find(([,b])=>b);
 assert.ok(pair,'다른 레슨의 같은 계열 본문항 둘');
 const [a,b]=pair;
 const finish=(f,id)=>{const run=f.lesson(id);for(const x of lessonOf(id).questions){f.show(run,x);f.answer(run,x);}f.progress.finishLesson(id);};
 const one=(f,item)=>{const run=f.lesson(item.lessonId),x=q(item.lessonId,item.questionId);f.show(run,x);f.answer(run,x);};
 const f=fixture();finish(f,a.lessonId);one(f,b);
 const row=f.attempts().find(r=>r.itemKey===b.itemKey);
 assert.equal(row.exposure,'repeat');assert.notEqual(row.verdict,'unassessed','Trail이 이미 본 계열이면 대조로 근거를 지우지 않는다');
 // 앞 레슨을 거울이 놓쳤으면(코치 없음) 뒤 문항은 Trail에 처음이지만 제품은 이미 만났다 — 대조가 근거를 지운다.
 const g=fixture();g.offline();finish(g,a.lessonId);g.online();one(g,b);
 const rows=g.attempts();assert.deepEqual(rows.map(r=>[r.itemKey,r.verdict]),[[b.itemKey,'unassessed']]);
});

test('이번 주 활동: 생활 거울의 답은 읽기로 다시 세지 않고, 생활 칸이 진도로 하루 한 번 센다', () => {
 const f=fixture(),run=f.lesson('cafe-expressions');for(const x of lessonOf('cafe-expressions').questions){f.show(run,x);f.answer(run,x);}
 assert.equal(f.attempts().length,3,'거울은 적혔다');
 assert.ok(f.coach.events().some(e=>e.type==='decision.made'&&e.experienceId==='world-life'),'거울 답은 경험 world-life의 결정 아래 있다');
 const done=weekActivity({events:f.coach.events(),progress:f.progress.exportSnapshot(),week:{start:START-DAY,end:START+6*DAY}});
 assert.equal(done.reading,0,'생활 답이 읽기 연습으로 한 번 더 세지 않는다');assert.equal(done.life,1);
});

// 11-08 프론트 검수(아르곤 A2 · B6): 「시간을 두고 다시 확인」이 창마다 같은 줄을 늘어놓고 생활 줄을 TOPIK 줄 뒤에 그대로 이었다.
test('다시 확인 카드: 기준 답마다 하나 · 창은 1 · 7 · 30일 차례 · 지금 확인할 카드 먼저, 그다음 가까운 날짜 · 같은 항목 카드가 둘이면 twin', () => {
 const at=d=>new Date(START+d*DAY).toISOString(),order=['d1','d7','d30'];
 const rows=(src,skillId,difficulty,{shift=0,status={}}={})=>['d30','d1','d7'].map(window=>({id:`${src}:${window}`,sourceAttemptId:src,measure:{skillId,difficulty},window,
  status:status[window]||'not_due',dueAt:at(shift+{d1:1,d7:7,d30:30}[window])}));
 const later=rows('topik-late','ko.reading.vocabulary',2,{shift:5}),now=rows('topik-due','ko.reading.detail',1,{shift:-1,status:{d1:'due'}});
 const soon=rows('life-soon','ko.reading.vocabulary',1),twinA=rows('life-twin-a','ko.reading.grammar',1,{shift:2}),twinB=rows('life-twin-b','ko.reading.grammar',2,{shift:3});
 const cards=followupCards([...later,...now],[...soon,...twinA,...twinB]);
 assert.deepEqual(cards.map(card=>card.rows[0].sourceAttemptId),['topik-due','life-soon','life-twin-a','life-twin-b','topik-late'],'지금 확인할 카드 → 가까운 날짜 차례');
 assert.ok(cards.every(card=>card.rows.length===3&&card.rows.map(row=>row.window).join()===order.join()),'카드마다 세 창, 1 · 7 · 30일 차례');
 assert.deepEqual(cards.map(card=>[card.life,card.twin]),[[false,false],[true,false],[true,true],[true,true],[false,false]],'같은 출처 · 같은 항목 카드가 둘일 때만 twin(TOPIK 낱말과 생활 낱말은 따로)');
 assert.deepEqual(followupCards([{id:'x',window:'d1'}],null),[],'항목이 없는 줄 · 배열이 아닌 입력은 버린다');
});

// 11-08 프론트 검수: 생활 레슨 두 개 뒤 「시험 · TOPIK I」을 고른 학생에게 짧은 진단(시작점) 대신 게임이 먼저 나왔고 그 주의 다시 확인이 사라졌다.
test('시험 계획의 시작점: 생활 거울의 답만 있으면 시험을 고른 학생도 짧은 진단부터 — 생활 답은 내 위치 칸의 근거로 그대로 센다', () => {
 const f=fixture(),run=f.lesson('cafe-expressions');for(const x of lessonOf('cafe-expressions').questions){f.show(run,x);f.answer(run,x);}
 const summary=f.coach.summary(),events=f.coach.events();
 assert.ok(summary.skills.some(skill=>(skill.n||0)>0),'생활 답은 내 위치 칸의 근거다');
 const info=examInfo({reasons:['exam'],primaryReason:'exam',examType:'topik1',examDate:'2027-04'});
 const available={reading:{'ko.reading.detail':3},listening:{},recheck:15,life:true};
 const only=examEvidenceSkills(events);
 assert.equal(only.size,0,'생활 거울(world-life)만 있으면 시험 형식 근거 항목이 없다');
 const plan=buildExamPlan({exam:info,summary,now:f.now(),available,examSkills:only});
 assert.ok(plan.notes.includes('start'),'짧은 진단부터');assert.equal(plan.areas.find(row=>row.area==='recheck').planned,1,'그 주에 다시 확인(짧은 진단) 한 번');
 assert.equal(plan.reach.observed,summary.skills.filter(skill=>(skill.n||0)>0||skill.status!=='unseen').filter(skill=>/^ko\.(listening|reading)\./.test(skill.id)).length,'도달 파악은 생활 근거도 그대로 센다');
 assert.ok(!buildExamPlan({exam:info,summary,now:f.now(),available}).notes.includes('start'),'examSkills 없이 부르면(옛 호출) 예전 판단 그대로');
 // 생활 밖 연습(읽기 짧은 연습 world-practice)에서 낸 답이 있는 항목은 시작점 근거다.
 const other=[{type:'decision.made',id:'d-practice',experienceId:'world-practice'},{type:'practice.presented',id:'p-practice',decisionId:'d-practice',measure:{skillId:'ko.reading.detail'}},
  {type:'practice.attempted',id:'a-practice',presentationId:'p-practice',attemptNo:1,verdict:'correct'}];
 const both=examEvidenceSkills([...events,...other]);
 assert.deepEqual([...both],['ko.reading.detail']);
 assert.ok(!buildExamPlan({exam:info,summary,now:f.now(),available,examSkills:both}).notes.includes('start'),'시험 형식 근거가 있는 항목이 요약에도 근거로 있으면 시작점이 있다');
 assert.ok(buildExamPlan({exam:info,summary,now:f.now(),available,examSkills:[]}).notes.includes('start'),'배열로 줘도 같다');
 // 이번 주 계획 칸(11-08 프론트 검수 아르곤 B3 · Fable F5): 계획에 없던 생활 칸은 「1 / 0」이 아니라 한 날 수로 — 레슨 수로 읽히지 않게.
 const done=weekActivity({events,progress:f.progress.exportSnapshot(),week:{start:START-DAY,end:START+6*DAY}});
 const withDone=buildExamPlan({exam:info,summary,now:f.now(),done,available,examSkills:only}),lifeRow=withDone.areas.find(row=>row.area==='life');
 assert.deepEqual([lifeRow?.planned,lifeRow?.done],[0,1],'주 3번 계획에는 생활 칸이 없고 오늘 한 날이 하나');
 const view=createPositionView({t:(key,values)=>values?`${key}(${Object.entries(values).map(([k,v])=>`${k}=${v}`).join(',')})`:key,has:()=>true});
 const html=view.renderExamPlan({plan:withDone});
 assert.match(html,/plan\.area\.extraDays\(done=1,n=1\)/);assert.doesNotMatch(html,/plan\.area\.count\(done=1,planned=0\)/);
});

test('판과 코치: 계정이 바뀌어 옛 거울을 버리면 늦은 사건은 어디에도 가지 않는다', () => {
 const f=fixture(),run=f.lesson('cafe-expressions'),order=q('cafe-expressions','cafe-expressions-order');
 const slot=lessonSlot(run.attempt,order.id);f.show(run,order);f.trail.delivery(slot,'pending');
 f.trail.dispose();
 f.trail.delivery(slot,'completed');f.trail.answer(slot,{correct:true,choiceId:order.answerId,correctId:order.answerId});
 assert.equal(f.coach.events().filter(e=>e.type==='practice.attempted').length,0);
 assert.equal(f.coach.events().filter(e=>e.type==='practice.delivery').length,1);
});

// 도움 표시 2c(Fable 5.2 설계 확인 고1): 복습 칸을 놓고 새로 보이면 그 답이 붙는 제시에는 앞 도움이 없다 — 생활 도움 표시의 불변식 잣대는 「답이
// 붙는 제시의 도움 = 제품 helped」다. 옛 Trail의 assisted는 문항 · 계열의 이력(앞선 도움 · 정답 봄)이라 놓아도 참이고, 도움을 한 번도 안 연 보통
// 복습도 본문항 답(정답 봄) 뒤에는 참이다 — 라이브가 오늘도 내는 값이고 옛 Trail은 관문 2로 그대로 둔다.
test('복습 칸을 놓고 새로 보이면 답이 붙는 제시에 앞 도움이 없다 — 옛 Trail assisted는 문항 이력이라 놓아도 참, 도움 없는 보통 복습도 본문항 답 뒤엔 참(도움 표시 2c · Fable 설계 확인 고1)', () => {
 const lesson=lessonById('greetings-expressions'),q=lesson.questions[0],item=lifeItem({lesson,question:q,review:true});
 const scene=({help,release,mainFirst=false})=>{
  const f=fixture(),key=reviewSlot('run-1',q.review.id);
  if(mainFirst){const run=f.lesson(lesson.id);f.show(run,q);f.answer(run,q,{correct:false});f.advance(2*MINUTE);}
  f.trail.shown(key,item);if(help)f.trail.help(key,'explanation');
  f.advance(62*MINUTE);
  if(release)f.trail.release(key);
  f.trail.shown(key,item,{helped:false});
  f.trail.answer(key,{correct:true,choiceId:q.review.answerId,correctId:q.review.answerId,helped:false});
  const attempt=f.attempts().filter(a=>a.itemKey===item.itemKey).at(-1);
  const helps=f.coach.events().filter(e=>e.presentationId===attempt.presentationId&&e.level&&e.level!=='answer').map(e=>e.level);
  return {attempt,help:helps,presented:f.presented().filter(e=>e.itemKey===item.itemKey).length};
 };
 // ① 놓지 않으면(2판) 답이 앞 제시에 붙어 어제 해설이 그 제시의 도움이다
 const kept=scene({help:true,release:false});
 assert.equal(kept.presented,1);
 assert.deepEqual(kept.help,['explanation']);
 // ② 놓고 새로 보이면(2c) 답이 붙는 새 제시에는 도움이 없다 — 그래도 옛 Trail의 assisted는 참(어제 해설이 그 문항에 남음)
 const released=scene({help:true,release:true});
 assert.equal(released.presented,2,'새 제시가 선다');
 assert.deepEqual(released.help,[],'답이 붙는 제시에 도움 사건 없음');
 assert.equal(released.attempt.assisted,true,'옛 Trail은 문항 이력으로 읽는다 — 잣대가 아니다');
 // ③ 도움을 한 번도 안 연 보통 복습도 본문항 답(정답 봄) 뒤에는 옛 Trail assisted 참 — 라이브와 같은 값
 const plain=scene({help:false,release:false,mainFirst:true});
 assert.deepEqual(plain.help,[]);
 assert.equal(plain.attempt.assisted,true);
});

test('Temper 재확인: 같은 칸의 정답이 바뀐 복습을 다음 날 풀면 1일 짝(observed · 혼자 맞힘)', () => {
 const f=fixture(),run=f.lesson('cafe-expressions'),order=q('cafe-expressions','cafe-expressions-order');
 f.show(run,order);f.answer(run,order);
 f.advance(DAY+MINUTE);
 const due=f.coach.followups().items.find(r=>r.gameId==='world-life'&&r.window==='d1');
 assert.equal(due.status,'due');assert.equal(due.measure.skillId,'ko.reading.detail');assert.equal(due.current,true);
 // 공급: 돌아온 그 복습이 제품 길이다.
 const supply=lifeFollowupRows({life:worldLearning.life,projection:f.coach.followups(),seen:item=>f.coach.exposure(item).seen,snapshot:f.progress.exportSnapshot(),now:f.now(),assessable:()=>true});
 const row=supply.rows.find(r=>r.id===due.id);
 assert.equal(row.available,true);assert.deepEqual(row.route,{route:'review',lessonId:'cafe-expressions',reviewIds:['cafe-expressions-order-transfer']});
 f.review(['cafe-expressions-order-transfer']);
 const observed=f.coach.followups().items.find(r=>r.id===due.id);
 assert.equal(observed.status,'observed');assert.equal(observed.outcome,'independent-correct');
});

test('Temper 재확인: 틀린 첫 답은 1분 복습이 1일 창 전에 쓰여, 공급은 같은 칸의 다음 레슨 본문항', () => {
 const f=fixture(),run=f.lesson('cafe-expressions'),order=q('cafe-expressions','cafe-expressions-order');
 f.show(run,order);f.answer(run,order,{correct:false});
 f.advance(2*MINUTE);f.review(['cafe-expressions-order-transfer']);
 for(const x of lessonOf('cafe-expressions').questions.slice(1)){f.show(run,x);f.answer(run,x);}f.progress.finishLesson('cafe-expressions');
 f.advance(DAY+MINUTE);
 const projection=f.coach.followups(),anchor=projection.items.find(r=>r.gameId==='world-life'&&r.window==='d1'&&r.measure.skillId==='ko.reading.detail');
 assert.equal(anchor.kind,'recovery');
 const supply=lifeFollowupRows({life:worldLearning.life,projection,seen:item=>f.coach.exposure(item).seen,snapshot:f.progress.exportSnapshot(),now:f.now(),assessable:()=>true});
 const row=supply.rows.find(r=>r.id===anchor.id);
 assert.equal(row.available,true);assert.equal(row.route.route,'lesson');assert.equal(row.route.lessonId,'cafe-story');
 assert.equal(row.item.skillId,'ko.reading.detail');
});

test('재확인 공급: 끝내지 않은 복습 회차가 있으면 그 회차의 남은 문항만 복습 길이다(다시 검수 GPT c2 GA2)', () => {
 const f=fixture(),cafe=f.lesson('cafe-expressions'),order=q('cafe-expressions','cafe-expressions-order');
 f.show(cafe,order);f.answer(cafe,order);
 const greet=f.lesson('greetings-expressions'),hello=q('greetings-expressions','greetings-expressions-hello');
 f.show(greet,hello);f.answer(greet,hello);
 f.advance(DAY+MINUTE);
 const run=f.progress.startReview(1,'greetings-expressions-hello-transfer',['greetings-expressions-hello-transfer']);
 assert.deepEqual(run.ids,['greetings-expressions-hello-transfer']);
 const anchor=f.coach.followups().items.find(r=>r.gameId==='world-life'&&r.window==='d1'&&r.measure.skillId==='ko.reading.detail');
 assert.equal(anchor.status,'due');
 const supply=()=>lifeFollowupRows({life:worldLearning.life,projection:f.coach.followups(),seen:item=>f.coach.exposure(item).seen,snapshot:f.progress.exportSnapshot(),now:f.now(),assessable:()=>true}).rows.find(r=>r.id===anchor.id);
 assert.notEqual(supply().route?.reviewIds?.[0],'cafe-expressions-order-transfer','다른 회차가 열려 있는 동안 그 복습을 약속하지 않는다(제품은 열린 회차를 연다)');
 // 회차를 마치면 돌아온 그 복습이 다시 길이다.
 f.progress.answerReview({id:'greetings-expressions-hello-transfer',runId:run.id,correct:true});
 assert.deepEqual(supply().route,{route:'review',lessonId:'cafe-expressions',reviewIds:['cafe-expressions-order-transfer']});
});

test('재확인 공급: current가 없는 옛 Temper 줄은 그 줄의 지도판을 지금 코치 지도판과 견준다(row.current ?? 옛 비교)', () => {
 const f=fixture(),run=f.lesson('cafe-expressions'),order=q('cafe-expressions','cafe-expressions-order');
 f.show(run,order);f.answer(run,order);f.advance(DAY+MINUTE);
 const projection=f.coach.followups(),anchor=projection.items.find(r=>r.gameId==='world-life'&&r.window==='d1');
 const old={...projection,items:projection.items.map(({current,...row})=>row)};
 const args={life:worldLearning.life,projection:old,seen:item=>f.coach.exposure(item).seen,snapshot:f.progress.exportSnapshot(),now:f.now(),assessable:()=>true};
 assert.equal(lifeFollowupRows({...args,taskVersion:anchor.measure.taskVersion}).rows.find(r=>r.id===anchor.id).available,true);
 assert.equal(lifeFollowupRows({...args,taskVersion:'other-map'}).rows.find(r=>r.id===anchor.id).available,false,'다른 지도판의 옛 줄은 공급하지 않는다');
 assert.equal(lifeFollowupRows({...args,life:null}).available,false,'부품이 없으면 쓸 수 없음(화면은 「기록 불완전」으로 읽지 않는다)');
});

test('재확인 공급에서 빠지는 것: 검수 자격 없음 · 장면 · 이미 본 계열 · 앵커 자신', () => {
 const f=fixture(),run=f.lesson('cafe-expressions'),order=q('cafe-expressions','cafe-expressions-order');
 f.show(run,order);f.answer(run,order);f.advance(DAY+MINUTE);
 const projection=f.coach.followups(),anchor=projection.items.find(r=>r.gameId==='world-life'&&r.window==='d1');
 const seen=item=>f.coach.exposure(item).seen,snapshot=f.progress.exportSnapshot();
 const none=lifeFollowupRows({life:worldLearning.life,projection,seen,snapshot,now:f.now(),assessable:()=>false}).rows.find(r=>r.id===anchor.id);
 assert.equal(none.available,false,'판정 자격 없는 문항은 공급이 아니다');
 const offered=lifeFollowupRows({life:worldLearning.life,projection,seen,snapshot,now:f.now(),assessable:()=>true}).rows.find(r=>r.id===anchor.id);
 const all=lifeItems().filter(i=>i.skillId===offered.item.skillId&&i.difficulty===offered.item.difficulty);
 assert.ok(!offered.item.confounded);assert.notEqual(offered.item.itemKey,'life.cafe-expressions-order');
 assert.notEqual(offered.item.familyKey,lifeItem({lesson:run.lesson,question:order}).familyKey);
 assert.ok(all.length>1);
});
