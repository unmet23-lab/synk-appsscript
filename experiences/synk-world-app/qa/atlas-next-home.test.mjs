// 4-3 WORLD 홈의 세 줄(단계4_계획 §20-10 「세 줄 장면 시험」 · §11 시험 8) — 진짜 엔진 코치(손님 · 메모리 포트)와 진짜 지도로 plan()을 돌려
// 세 줄을 본다. 가짜 plan()으로는 순위의 차이(할 것의 수 · 앞지르는 사실)를 못 잡는다(설계 검토 H14). 생활 판정은 진짜 lifeDue다.
// 진도는 꼴만 갖춘 가짜다(진도 요약의 다음 레슨 규칙은 life-progress.mjs의 일 — 여기서는 팩 차례의 첫 미완 레슨).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import {pathToFileURL} from 'node:url';
// 변형 시험(qa/today-mutants.mjs)은 깬 사본을 SYNK_TODAY_MODULE로 넘긴다. 그 밖에는 원본이다.
const {createWorldTodayPlan,pickRow,reviewFact,watchHomePlan,todayKey,nextDayStart,todayRows,todayActivities,LIFE_REVIEW_ID}=await import(process.env.SYNK_TODAY_MODULE?pathToFileURL(process.env.SYNK_TODAY_MODULE).href:'../world-today.mjs');
import {lifeDue,lifeUnitsOf} from '../world-life-next.mjs';
import {PACKS,LESSONS} from '../life-content.mjs';
import {lifeTargets} from '../life-plan.mjs';
import {bankItems} from '../world-topik-items.mjs';
import {examWeek} from '../world-exam-plan.mjs';

const readJson=url=>JSON.parse(fs.readFileSync(new URL(url,import.meta.url),'utf8'));
const MAP_DATA={index:readJson('../../../packages/atlas/map/index.json'),units:readJson('../../../packages/atlas/map/units.json')};
const BANK=bankItems(readJson('../world-topik-items.json'));
// 낱말 표 — 앱의 코치는 낱말 이름을 실어 연다(world-atlas-next.mjs words: true). 낱말 단위의 이유 문장이 이름을 말하려면 든다.
const WORDS=readJson('../../../packages/atlas/map/words.json');
const MIN=60_000,HOUR=3_600_000,DAY=86_400_000;
const T0=Date.UTC(2026,10,16,1,0,0); // 11-16 10:00 KST
const ORDER=PACKS.flatMap(pack=>pack.lessons.map(lesson=>lesson.id));
const lessonOf=id=>LESSONS.find(lesson=>lesson.id===id);

let stores=0;
// 홈 코치 — 지도 전체(생활 · TOPIK 은행)를 안다. start: 코치의 시계가 시작하는 때(그 앞의 답을 지어 넣으려고 앞당긴다). words: 낱말 표를 싣는다.
async function homeCoach({start=T0,params=null,words=false}={}){
 stores+=1;let now=start;const time={now:()=>now,advance:ms=>{now+=ms;},at:value=>{now=value;},get t(){return now;}};
 const coach=atlas.createCoach({gameId:'world-home',mapData:words?{...MAP_DATA,words:WORDS}:MAP_DATA,dayOffset:540,...(params?{params:{...atlas.PARAMS,...params}}:{}),
  host:{guest:true,port:atlas.memoryPort(),key:`synk-atlas:world-home-test-${process.pid}-${stores}`,now:time.now}});
 await coach.ready;return {coach,time};
}
async function answer(coach,itemKey,correct){const pid=coach.present({itemKey});await coach.answer(pid,{correct,assessable:true}).stored;}
const mainKeys=id=>lifeTargets(lessonOf(id),lessonOf(id).questions).map(target=>target.itemKey);

function reviewOf(lessonId,index,{lapses=0,streak=0,lastAt=T0-DAY,dueAt=T0}={}){
 const lesson=lessonOf(lessonId),question=lesson.questions[index];
 return {id:question.review.id,lessonId,questionId:question.id,packId:lesson.packId,skillId:question.skillId,lapses,streak,lastAt,dueAt};
}
// 생활 진도의 꼴 — exportSnapshot()과 summary(PACKS, LESSONS)의 다음 레슨만.
function progressOf({completed=[],reviews=[],hangul=null,active=null,answers={}}={}){
 const lessons={};for(const id of completed)lessons[id]={completedAt:T0-2*DAY,startedAt:T0-2*DAY-MIN,answers:{}};
 if(active)lessons[active]={completedAt:null,startedAt:T0-10*MIN,answers,stage:{phase:'questions',sceneIndex:0,questionIndex:1}};
 const snapshot={owner:'guest',lessons,reviews:Object.fromEntries(reviews.map(review=>[review.id,review])),...(hangul?{hangul:{answer:hangul}}:{}),...(active?{activeLessonId:active}:{})};
 const next=active?lessonOf(active):ORDER.map(lessonOf).find(lesson=>!completed.includes(lesson.id))||null;
 return {exportSnapshot:()=>snapshot,summary:()=>({nextLesson:next?{...next}:null,resume:Boolean(active)&&Object.keys(answers).length>0})};
}
const judgeOf=(coach,progress,now)=>{const summary=coach.summary();return {state:'engine',...lifeDue({snapshot:progress.exportSnapshot(),lessons:LESSONS,unitsOf:lifeUnitsOf(coach,LESSONS),memory:summary.units,due:coach.due(),now})};};
function planOf({coach,progress,now,settings={},pool=[],opened=new Set(),lang='ko',openGames=null,judged,week=null}){
 const say=why=>atlas.renderReason(why,{lang});
 return createWorldTodayPlan({coach,progress,judged:judged===undefined?judgeOf(coach,progress,now):judged,settings,now,pool,opened,lang,openGames,say,labels:id=>id,week});
}
const kinds=plan=>plan.today.items.map(row=>row.kind);

test('첫날 — 목표 없음 · 「여행」 · 「시험」 · 체험이 남은 손님 모두 오늘 공부 줄이 첫 레슨이다(§11 시험 8 장면 넷 · 설계 검토 H14)',async()=>{
 const {coach,time}=await homeCoach();
 const progress=progressOf();
 for(const settings of [{},{reasons:['travel'],primaryReason:'travel'},{reasons:['exam'],primaryReason:'exam',examType:'topik1'}])
  for(const openGames of [null,['hangul']]){
   const plan=planOf({coach,progress,now:time.t,settings,openGames});
   assert.equal(plan.status,'ready');
   assert.deepEqual(kinds(plan),['new'],JSON.stringify(settings));
   assert.equal(plan.selected.lessonId,'greetings-expressions','바람길 · 시험 형식 연습이 아니라 첫 레슨(바뀌는 장면 — 시험 학생의 첫 줄)');
   assert.equal(plan.today.items[0].why.code,'unit.new');
   assert.match(plan.reason,/처음 만나요/);
   assert.ok(!plan.candidates.some(candidate=>['game','mock','position'].includes(candidate.route)),'게임 · 시험 형식은 후보가 아니고, 짧은 진단은 이번 주 계획(셸의 week)이 있을 때만이다(4-4b — qa/atlas-next-plan.test.mjs)');
   assert.equal(plan.examPlan,null,'이번 주 계획은 셸이 넘긴 week로만 싣는다 — 넘기지 않은 이 장면에는 없다(4-4b가 뒤집은 단정은 qa/atlas-next-plan.test.mjs가 본다)');
   assert.equal(plan.today.firstDay,true);
  }
 coach.dispose();
});

test('「인사 · 이야기」 뒤 — 다음 레슨 「인사 · 적용」이 채우기여도 오늘 공부 줄이고, 기록을 단정하지 않는 문장이다(설계 검토 H14 · H8)',async()=>{
 const {coach,time}=await homeCoach({start:T0-20*MIN});
 for(const key of [...mainKeys('greetings-expressions'),...mainKeys('greetings-story')])await answer(coach,key,true);
 time.at(T0);
 const progress=progressOf({completed:['greetings-expressions','greetings-story']});
 const plan=planOf({coach,progress,now:time.t});
 assert.deepEqual(kinds(plan),['new']);
 assert.equal(plan.selected.lessonId,'greetings-apply');
 assert.equal(plan.today.items[0].why.code,'host.next');
 assert.equal(plan.reason,'생활 팩의 다음 레슨이에요.');
 coach.dispose();
});

test('방금 놓친 복습(①) — 복습 줄이 오늘 공부보다 앞이고, 문장의 단위는 근거의 단위다 · 연 칸은 건너뛴다(§20-6의 5 · §20-8)',async()=>{
 const {coach,time}=await homeCoach({start:T0-3*MIN});
 await answer(coach,mainKeys('greetings-expressions')[0],false);
 time.at(T0);
 const progress=progressOf({completed:['greetings-expressions'],reviews:[reviewOf('greetings-expressions',0,{lapses:1,lastAt:T0-3*MIN,dueAt:T0-2*MIN})]});
 const judged=judgeOf(coach,progress,time.t);
 assert.equal(judged.items[0]?.why,'soon');
 assert.deepEqual(reviewFact(judged.items),{kind:'missed',unit:'ko.life.greet-hello'});
 const plan=planOf({coach,progress,now:time.t,judged});
 assert.deepEqual(kinds(plan),['again','new']);
 const [review]=plan.today.items;
 assert.equal(review.activityId,LIFE_REVIEW_ID);
 assert.equal(review.why.code,'host.missed');
 assert.equal(review.why.text,'놓친 「안녕하세요.」, 오늘은 다른 장면에서 다시 해 봐요.');
 assert.deepEqual(review.why.evidence,{fact:'review',review:'missed',unit:'ko.life.greet-hello'});
 assert.equal(plan.selected.route,'review');
 assert.deepEqual(plan.selected.reviewIds,['greetings-expressions-hello-transfer']);
 const later=planOf({coach,progress,now:time.t,judged,opened:new Set(['again'])});
 assert.equal(later.selected.lessonId,'greetings-story','복습 칸을 열었으면 단추는 오늘 공부를 연다');
 assert.equal(later.today.items[0].opened,true);
 const again=planOf({coach,progress,now:time.t,judged,opened:new Set(['again','new'])});
 assert.equal(again.selected.route,'review','다 열었으면 다시 첫 줄부터');
 coach.dispose();
});

test('생활 단위가 없는 놓친 복습은 이름 없는 문장으로 선다 — 지도에 생활 단위가 없는 진짜 복습 문항 모두(설계 주인 11-15 조건 2 · 카본 엔진급 끝 판 B6)',async()=>{
 assert.deepEqual(reviewFact([{id:'a',unit:null,why:'soon'}]),{kind:'missed'});
 assert.deepEqual(reviewFact([{id:'a',unit:null,why:'soon'},{id:'b',unit:'u',why:'soon'}]),{kind:'missed',unit:'u'});
 assert.deepEqual(reviewFact([{id:'b',unit:'u',why:'first'}]),{kind:'bridge',unit:'u'});
 assert.equal(reviewFact([{id:'c',unit:'u',why:'due'}]),null);
 // 단위를 덮어 지운 가짜가 아니라 진짜 문항마다 그 문항을 방금 놓친 날을 짓는다. 후보가 서지 않는 문항이 있으면 복습 줄이 통째로 빠지므로
 // 하나씩 본다. 이름 없는 사실은 생활 복습 활동에만 붙고, 다른 줄이 이 사실로 앞지르지 않는다(설계 주인 11-15 조건).
 const {coach:look}=await homeCoach();
 const unitsOf=lifeUnitsOf(look,LESSONS);
 const bare=LESSONS.flatMap(lesson=>lesson.questions.map((question,index)=>({lesson,index,question})))
  .filter(({question})=>question.review?.id&&!(unitsOf({id:question.review.id})??[]).length);
 look.dispose();
 assert.ok(bare.length>0,'생활 단위가 없는 복습 문항이 있다');
 for(const {lesson,index,question} of bare){
  const {coach,time}=await homeCoach();
  const progress=progressOf({completed:ORDER.slice(0,ORDER.indexOf(lesson.id)+1),reviews:[reviewOf(lesson.id,index,{lapses:1,lastAt:T0-3*MIN,dueAt:T0-2*MIN})]});
  const judged=judgeOf(coach,progress,time.t),label=question.review.id;
  assert.deepEqual(reviewFact(judged.items),{kind:'missed'},label);
  const plan=planOf({coach,progress,now:time.t,judged});
  const [first]=plan.today.items;
  assert.equal(first?.activityId,LIFE_REVIEW_ID,`${label}: 복습 줄이 맨 앞`);
  assert.equal(first.why.code,'host.missed',label);
  assert.equal(first.why.text,'놓친 표현을 오늘은 다른 장면에서 다시 해 봐요.',label);
  assert.deepEqual(first.why.evidence,{fact:'review',review:'missed'},label);
  assert.deepEqual(plan.today.items.filter(row=>row.why.code==='host.missed').map(row=>row.activityId),[LIFE_REVIEW_ID],label);
  coach.dispose();
 }
});

test('다리 복습(②) — 이유가 「처음 만나요」가 아니라 레슨 다음 날의 새 상황 복습이다(설계 검토 H2)',async()=>{
 const {coach,time}=await homeCoach();
 const progress=progressOf({completed:['greetings-expressions'],reviews:[reviewOf('greetings-expressions',0,{lastAt:T0-2*DAY,dueAt:T0-DAY})]});
 const judged=judgeOf(coach,progress,time.t);
 assert.equal(judged.items[0]?.why,'first');
 const plan=planOf({coach,progress,now:time.t,judged});
 assert.deepEqual(kinds(plan),['again','new']);
 assert.equal(plan.today.items[0].why.code,'host.bridge');
 assert.equal(plan.today.items[0].why.text,'레슨에서 만난 「안녕하세요.」, 오늘은 새 상황에서 다시 만나요.');
 coach.dispose();
});

test('돌아온 단위(③) — 복습 줄이고 이유는 엔진의 문장이다',async()=>{
 const {coach,time}=await homeCoach({start:T0-3*DAY});
 await answer(coach,mainKeys('greetings-expressions')[0],true);
 time.at(T0);
 const progress=progressOf({completed:['greetings-expressions'],reviews:[reviewOf('greetings-expressions',0,{streak:1,lastAt:T0-3*DAY,dueAt:T0})]});
 const judged=judgeOf(coach,progress,time.t);
 assert.equal(judged.items[0]?.why,'due');
 const plan=planOf({coach,progress,now:time.t,judged});
 assert.deepEqual(kinds(plan),['again','new']);
 assert.equal(plan.today.items[0].why.code,'unit.due');
 assert.match(plan.today.items[0].why.text,/「안녕하세요\.」/);
 coach.dispose();
});

test('돌아온 단위가 하나인 짧은 연습보다 돌아온 표현이 셋인 생활 복습이 복습 줄이다 — 짧은 연습은 돌아온 단위마다 문항 하나(§20-2 · 설계 검토 H14 넷째 장면)',async()=>{
 const {coach,time}=await homeCoach({start:T0-3*DAY});
 const one=BANK.find(item=>item.skillId.includes('.reading.')&&coach.itemUnits(item.itemKey).length===1);
 assert.ok(one,'단위가 하나인 읽기 문항');
 const pool=BANK.filter(item=>item.skillId===one.skillId);
 await answer(coach,one.itemKey,true);
 for(const key of mainKeys('greetings-expressions'))await answer(coach,key,true);
 time.at(T0);
 const reviews=[0,1,2].map(index=>reviewOf('greetings-expressions',index,{streak:1,lastAt:T0-3*DAY,dueAt:T0}));
 const progress=progressOf({completed:['greetings-expressions'],reviews});
 const plan=planOf({coach,progress,now:time.t,pool});
 const practice=plan.candidates.find(candidate=>candidate.route==='practice');
 assert.ok(practice,'돌아온 단위가 든 짧은 연습도 후보다');
 assert.equal(plan.today.items[0].activityId,LIFE_REVIEW_ID,'돌아온 것이 많은 생활 복습이 복습 줄');
 assert.deepEqual(kinds(plan),['again','new'],'칸마다 한 줄 — 짧은 연습은 같은 칸의 둘째라 줄이 아니다');
 coach.dispose();
});

test('하던 레슨과 돌아온 복습 — 하던 레슨이 먼저이고 단추는 하던 것을 건너뛰지 않는다(설계 검토 H4 · H7)',async()=>{
 const {coach,time}=await homeCoach({start:T0-3*DAY});
 await answer(coach,mainKeys('greetings-expressions')[0],true);
 time.at(T0);
 const progress=progressOf({completed:['greetings-expressions'],active:'greetings-story',answers:{'greetings-story-1':{correct:true,helped:false,at:T0-5*MIN}},
  reviews:[reviewOf('greetings-expressions',0,{streak:1,lastAt:T0-3*DAY,dueAt:T0})]});
 const plan=planOf({coach,progress,now:time.t,opened:new Set(['new'])});
 assert.deepEqual(kinds(plan),['new','again']);
 assert.equal(plan.today.items[0].why.code,'host.resume');
 assert.equal(plan.selected.lessonId,'greetings-story','연 칸이어도 하던 것은 먼저 잇는다');
 assert.ok(plan.resume,'하던 것');
 coach.dispose();
});

test('한글 먼저 — 열 수 있을 때만 오늘 공부 줄이고, 소리를 끈 학생 · 닫힌 게임이면 다음 레슨이다(설계 검토 H15)',async()=>{
 const {coach,time}=await homeCoach();
 const progress=progressOf({hangul:'new'});
 const plan=planOf({coach,progress,now:time.t});
 assert.deepEqual(kinds(plan),['new']);
 assert.equal(plan.selected.gameId,'hangul');
 assert.equal(plan.today.items[0].why.code,'host.prerequisite');
 const quiet=planOf({coach,progress,now:time.t,settings:{audio:'off'}});
 assert.equal(quiet.selected.lessonId,'greetings-expressions','소리를 끈 날은 한글 만나기를 권하지 않는다');
 const shut=planOf({coach,progress,now:time.t,openGames:[]});
 assert.equal(shut.selected.lessonId,'greetings-expressions','열 수 없는 한글 만나기는 잠김');
 coach.dispose();
});

test('시간 제한 — 정한 시간보다 긴 활동은 잠기고, 남는 줄이 없으면 조건을 바꾸라는 판이다',async()=>{
 const {coach,time}=await homeCoach();
 const plan=planOf({coach,progress:progressOf(),now:time.t,settings:{minutes:1}});
 assert.equal(plan.today.items.length,0);
 assert.equal(plan.status,'unavailable');
 // 다 한 날(done)이 아니다 — 빈 줄은 blocked이고 이유는 지금 판과 같은 조건 문장이다(홈이 tMessage로 화면 언어로 바꾼다).
 assert.deepEqual(plan.today.empty,{code:'blocked',text:null});
 assert.equal(plan.reason,'지금 조건에 맞는 활동이 없어요. 시간이나 소리 설정을 바꿔 볼 수 있어요.');
 coach.dispose();
});

// 읽기 문항 하나로 만난 낱말이 든 듣기 문항 — 듣기 답은 소리를 들려준 기록(delivery)이 있어야 근거라, 낱말은 읽기 답으로 돌아오게 한다.
function listeningPair(coach){
 const unitsOf=item=>coach.itemUnits(item.itemKey).map(row=>row.unit);
 const heard=BANK.filter(item=>item.skillId.split('.')[1]==='listening').map(item=>({item,units:new Set(unitsOf(item))}));
 for(const item of BANK){
  if(item.skillId.split('.')[1]!=='reading')continue;
  const units=unitsOf(item);
  if(units.length!==1||!units[0].startsWith('ko.word.'))continue;
  const other=heard.find(row=>row.units.has(units[0]));
  if(other)return {read:item,heard:other.item,unit:units[0]};
 }
 assert.fail('읽기로 만난 낱말이 든 듣기 문항');
}
test('소리를 끈 날 — 듣기 짧은 연습은 빠지지 않고 잠긴다 · 듣기 연습에만 돌아온 단위가 있으면 다 한 날이 아니라 조건에 걸린 날이다(카본 엔진급 끝 판 B1)',async()=>{
 // 읽기 문항으로 만난 낱말이 돌아왔고, 짧은 연습 풀에는 그 낱말이 든 듣기 문항의 항목만 있다. 레슨은 모두 마쳤다.
 const {coach,time}=await homeCoach({start:T0-3*DAY,words:true});
 const pair=listeningPair(coach);
 await answer(coach,pair.read.itemKey,true);
 time.at(T0);
 assert.deepEqual(coach.due().map(row=>row.unit),[pair.unit],'그 낱말이 돌아왔다');
 const pool=BANK.filter(item=>item.skillId===pair.heard.skillId);
 const progress=progressOf({completed:ORDER});
 const on=planOf({coach,progress,now:time.t,pool});
 assert.deepEqual(on.today.items.map(row=>[row.kind,row.route]),[['again','practice']],'소리를 켠 날은 듣기 짧은 연습이 복습 줄');
 assert.equal(on.today.items[0].why.code,'unit.due');
 const off=planOf({coach,progress,now:time.t,pool,settings:{audio:'off'}});
 assert.equal(off.today.items.length,0);
 assert.equal(off.status,'unavailable');
 assert.deepEqual(off.today.empty,{code:'blocked',text:null},'다 한 날(done)이 아니다');
 assert.equal(off.reason,'지금 조건에 맞는 활동이 없어요. 시간이나 소리 설정을 바꿔 볼 수 있어요.');
 assert.ok(off.candidates.some(candidate=>candidate.route==='practice'&&candidate.audioRequired),'잠긴 듣기 연습도 후보에 남는다');
 coach.dispose();
});

test('하루 복습 상한 — 복습 줄이 없고 복습 칸 자리에 상한 문장, 오늘 공부는 선다 · 다 마친 학생은 빈 줄이 상한 문장이다(§20-3 · 설계 주인 11-15 조건 3)',async()=>{
 const {coach,time}=await homeCoach({start:T0-3*DAY,params:{reviewsPerDay:0}});
 await answer(coach,mainKeys('greetings-expressions')[0],true);
 time.at(T0);
 const reviews=[reviewOf('greetings-expressions',0,{streak:1,lastAt:T0-3*DAY,dueAt:T0})];
 const plan=planOf({coach,progress:progressOf({completed:['greetings-expressions'],reviews}),now:time.t});
 assert.equal(plan.today.capped,true);
 assert.deepEqual(kinds(plan),['new']);
 assert.equal(plan.today.cappedText,'오늘은 여기까지예요. 남은 것은 내일 만나요.');
 const done=planOf({coach,progress:progressOf({completed:ORDER,reviews}),now:time.t});
 assert.deepEqual(done.today.empty,{code:'day.capped',text:'오늘은 여기까지예요. 남은 것은 내일 만나요.'});
 coach.dispose();
});

test('상한 날의 빈 날 — 판 · 이유 · 빈 날 코드는 한 차례(확인 중 → 조건 → 상한 → 다 한 날)다 · 상한 날 걸린 복습 칸 활동은 조건이 아니다(Fable 엔진급 끝 판 F5)',async()=>{
 const {coach,time}=await homeCoach({start:T0-3*DAY,params:{reviewsPerDay:0},words:true});
 await answer(coach,mainKeys('greetings-expressions')[0],true);
 // 읽기로 만난 낱말도 돌아온다 — 짧은 연습 풀에는 그 낱말이 든 듣기 문항의 항목만 둔다(소리를 끄면 잠긴다)
 const pair=listeningPair(coach);
 await answer(coach,pair.read.itemKey,true);
 time.at(T0);
 const reviews=[reviewOf('greetings-expressions',0,{streak:1,lastAt:T0-3*DAY,dueAt:T0})];
 // 레슨이 정한 시간에 걸린 상한 날 — 시간을 늘리면 레슨이 줄이 되므로 조건에 걸린 날이고, 세 곳이 같은 까닭을 말한다
 const timed=planOf({coach,progress:progressOf({completed:['greetings-expressions'],reviews}),now:time.t,settings:{minutes:1}});
 assert.equal(timed.today.capped,true);
 assert.deepEqual([timed.status,timed.today.empty],['unavailable',{code:'blocked',text:null}]);
 assert.equal(timed.reason,'지금 조건에 맞는 활동이 없어요. 시간이나 소리 설정을 바꿔 볼 수 있어요.');
 // 레슨을 다 마친 상한 날에 복습 칸 활동(듣기 짧은 연습)만 걸렸으면 풀려도 줄이 아니다 — 빈 날은 상한이고 조건 문장을 쓰지 않는다
 const pool=BANK.filter(item=>item.skillId===pair.heard.skillId);
 const quiet=planOf({coach,progress:progressOf({completed:ORDER,reviews}),now:time.t,pool,settings:{audio:'off'}});
 assert.equal(quiet.today.capped,true,'상한을 읽을 항목(생활 복습)이 있다');
 assert.ok(quiet.candidates.some(candidate=>candidate.route==='practice'&&candidate.audioRequired),'듣기 짧은 연습은 잠긴 채 후보에 있다');
 assert.deepEqual([quiet.status,quiet.today.empty],['empty',{code:'day.capped',text:'오늘은 여기까지예요. 남은 것은 내일 만나요.'}]);
 assert.equal(quiet.reason,'');
 coach.dispose();
});

test('레슨을 다 마친 상한 날에 소리를 끄면 잠긴 듣기 짧은 연습만 남아도 빈 날은 상한이다 — plan 머리의 상한(설계 주인 11-15 · §20-14)',async()=>{
 const {coach,time}=await homeCoach({start:T0-3*DAY,params:{reviewsPerDay:0},words:true});
 const pair=listeningPair(coach);
 await answer(coach,pair.read.itemKey,true);
 time.at(T0);
 const pool=BANK.filter(item=>item.skillId===pair.heard.skillId);
 const plan=planOf({coach,progress:progressOf({completed:ORDER}),now:time.t,pool,settings:{audio:'off'}});
 assert.equal(plan.today.capped,true,'후보를 넘긴 열린 활동이 없어도 상한을 읽는다');
 assert.deepEqual([plan.status,plan.today.empty],['empty',{code:'day.capped',text:'오늘은 여기까지예요. 남은 것은 내일 만나요.'}],'고치기 전에는 조건에 걸린 날이었다');
 assert.equal(plan.reason,'');
 // 홈은 plan 쪽 칸을 먼저 읽는다 — 항목이 상한을 모르는 꼴로 줘도 plan 쪽 칸이 상한이면 상한 날이다
 const told=Object.create(coach,{plan:{value:list=>Object.assign(list.map(act=>({id:act.id,locked:true,fact:-1,tier:9,todo:0,offered:0,capped:false})),{capped:true})}});
 assert.equal(planOf({coach:told,progress:progressOf({completed:ORDER}),now:time.t,pool,settings:{audio:'off'}}).today.capped,true);
 coach.dispose();
});

test('엔진 판에서 plan()이 실패하면 확인 중 판으로 내려 제품 사실 줄만 그린다 — 다음 레슨이 남았는데 다 한 날이 되지 않는다(Fable 엔진급 끝 판 F3)',async()=>{
 const {coach,time}=await homeCoach();
 // 코치는 얼린 객체라 Proxy로 못 덮는다 — 바탕으로 두고 plan()만 던지게 덮는다.
 const broken=Object.create(coach,{plan:{value:()=>{throw new Error('plan');}}});
 const progress=progressOf({completed:['greetings-expressions']});
 const plan=planOf({coach:broken,progress,now:time.t});
 assert.equal(plan.today.state,'checking');
 assert.deepEqual(kinds(plan),['new']);
 assert.equal(plan.today.items[0].why.code,'host.next');
 assert.equal(plan.selected.lessonId,'greetings-story');
 const all=planOf({coach:broken,progress:progressOf({completed:ORDER}),now:time.t});
 assert.deepEqual([all.status,all.today.empty],['checking',{code:'checking',text:null}],'다 마친 학생도 다 한 날이 아니라 확인 중이다');
 coach.dispose();
});

// 점검 칸 활동을 넘기는 이번 주 계획(셸 weekNext의 꼴) — 짧은 진단 · 시험 형식 · 쓰기 · 말하기의 이번 주 몫이 모두 남은 주.
const checkWeekOf=now=>{
 const area=(name,remaining)=>({area:name,planned:1,done:1-remaining,remaining,classwork:[]});
 return {examPlan:{week:examWeek(now),areas:[area('recheck',1),area('writing',1),area('speaking',1)],homework:[],next:{area:'recheck',skillId:null},notes:['start']},fresh:()=>false,diagnostic:{ready:true},
  mock:{minutes:26,audioRequired:false,done:false},writing:{label:'쓰기 연습 · 53',routeId:'writing:53',minutes:18,focus:'ending-53',need:null,needAt:null},
  speaking:{label:'말하기 연습',routeId:'speaking:3',minutes:4,type:'narrate',untried:2}};
};
const CHECK_IDS=['world.position.check','world.mock','topik2-writing-53','world.speaking.check'];
test('엔진 판에서 plan()이 실패해도 계획이 넘긴 점검 칸 활동은 확인 중 판의 「다음 레슨」 줄로 서지 않는다(Fable 끝 판 F10)',async()=>{
 const {coach,time}=await homeCoach();
 const progress=progressOf({completed:['greetings-expressions']});
 const settings={reasons:['exam'],primaryReason:'exam',examType:'topik2',speaking:true};
 const week=checkWeekOf(time.t);
 const live=planOf({coach,progress,now:time.t,settings,week});
 assert.ok(live.today.items.some(row=>CHECK_IDS.includes(row.activityId)),'장면의 전제 — 엔진 판에서는 점검 칸 줄이 선다');
 const broken=Object.create(coach,{plan:{value:()=>{throw new Error('plan');}}});
 const plan=planOf({coach:broken,progress,now:time.t,settings,week});
 assert.equal(plan.today.state,'checking');
 assert.ok(!plan.today.items.some(row=>CHECK_IDS.includes(row.activityId)),'계획이 넘긴 활동은 확인 중 판의 줄이 아니다');
 assert.deepEqual(kinds(plan),['new'],'생활의 다음 레슨 줄만');
 assert.equal(plan.today.items[0].why.code,'host.next');
 coach.dispose();
});

test('하루 새 단위 한도 — 다음 레슨은 줄이고, 막힌 다리 복습은 줄이 아니며 「다 만났어요」는 어디에도 없다(§20-3 · 설계 검토 H13)',async()=>{
 const {coach,time}=await homeCoach({params:{newPerDay:0}});
 const progress=progressOf({completed:['greetings-expressions'],reviews:[reviewOf('greetings-expressions',0,{lastAt:T0-2*DAY,dueAt:T0-DAY})]});
 const plan=planOf({coach,progress,now:time.t});
 assert.deepEqual(kinds(plan),['new']);
 assert.equal(plan.today.items[0].why.code,'host.next');
 assert.doesNotMatch(JSON.stringify(plan),/다 만났어요/);
 coach.dispose();
});

test('다 한 날 — 줄이 없으면 빈 날은 done이다(Vellum idle 「다 만났어요」를 쓰지 않는다)',async()=>{
 const {coach,time}=await homeCoach();
 const plan=planOf({coach,progress:progressOf({completed:ORDER}),now:time.t});
 assert.equal(plan.status,'empty');
 assert.deepEqual(plan.today.empty,{code:'done',text:null});
 assert.equal(plan.selected,null);
 coach.dispose();
});

test('확인 중 — 엔진에 기대는 줄(생활 복습 · 짧은 연습)은 그리지 않고 제품 사실 줄만, 기록을 말하지 않는다(설계 검토 H8 · H12)',async()=>{
 const {coach,time}=await homeCoach({start:T0-3*MIN});
 await answer(coach,mainKeys('greetings-expressions')[0],false);
 time.at(T0);
 const progress=progressOf({completed:['greetings-expressions'],reviews:[reviewOf('greetings-expressions',0,{lapses:1,lastAt:T0-3*MIN,dueAt:T0-2*MIN})]});
 const judged=judgeOf(coach,progress,time.t);
 for(const [label,input] of [['홈 코치 없음',{coach:null,judged}],['생활 판정 확인 중',{coach,judged:{state:'checking'}}]]){
  const plan=planOf({progress,now:time.t,...input});
  assert.equal(plan.today.state,'checking',label);
  assert.deepEqual(kinds(plan),['new'],label);
  assert.equal(plan.today.items[0].why.code,'host.next',label);
  assert.equal(plan.reason,'생활 팩의 다음 레슨이에요.',label);
 }
 const empty=planOf({progress:progressOf({completed:ORDER}),now:time.t,coach:null,judged:null});
 assert.deepEqual(empty.today.empty,{code:'checking',text:null});
 assert.equal(empty.status,'checking');
 coach.dispose();
});

test('이유 문장이 없는 언어 — 줄이 아니다(Vellum은 언어를 물러서지 않는다)',async()=>{
 const {coach,time}=await homeCoach();
 const plan=planOf({coach,progress:progressOf(),now:time.t,lang:'fr'});
 assert.equal(plan.today.items.length,0);
 const en=planOf({coach,progress:progressOf(),now:time.t,lang:'en'});
 assert.match(en.reason,/for the first time/);
 coach.dispose();
});

test('단추의 차례 — 하던 것 → 열지 않은 칸의 첫 줄 → 다 열었으면 첫 줄',()=>{
 const row=(kind,resume=false)=>({kind,open:{id:kind,...(resume?{resume:true}:{})}});
 assert.equal(pickRow([row('again'),row('new')],new Set(['again'])).kind,'new');
 assert.equal(pickRow([row('new',true),row('again')],new Set(['new'])).kind,'new');
 assert.equal(pickRow([row('again'),row('new')],new Set(['again','new'])).kind,'again');
 assert.equal(pickRow([],new Set()),null);
});

// 시간대를 잠시 바꿔 본다 — Node는 process.env.TZ를 바꾸면 바로 따른다. 지우기만 하면 처음 시간대로 돌아가지 않아, 처음 시간대를 다시 넣은 뒤 지운다.
function inZone(zone,fn){
 const env=process.env.TZ,first=Intl.DateTimeFormat().resolvedOptions().timeZone;
 process.env.TZ=zone;
 try{return fn();}finally{process.env.TZ=first;if(env===undefined)delete process.env.TZ;else process.env.TZ=env;}
}
test('학습일 — 서머타임이 바뀌는 날에도 열쇠가 바뀌는 때와 다시 그리는 때가 같은 현지 새벽 4시다(카본 엔진급 끝 판 B5)',()=>{
 const first=Intl.DateTimeFormat().resolvedOptions().timeZone;
 inZone('America/New_York',()=>{
  assert.equal(new Date(Date.UTC(2026,2,8,8,0)).getHours(),4,'시간대를 바꿨다');
  // 3월 8일 새벽 2시에 시계가 3시로 뛴다 — 현지 4시(08:00 UTC)에 다시 그리면 열쇠도 그날이다
  const spring=Date.UTC(2026,2,8,8,0);
  assert.equal(nextDayStart(spring-MIN),spring);
  assert.equal(todayKey(spring-MIN),'2026-3-7');
  assert.equal(todayKey(spring),'2026-3-8');
  // 11월 1일 새벽 2시에 시계가 1시로 돌아간다 — 현지 3시(08:00 UTC)는 아직 전날이고, 현지 4시(09:00 UTC)에 바뀐다
  const fall=Date.UTC(2026,10,1,9,0);
  assert.equal(nextDayStart(fall-HOUR),fall);
  assert.equal(todayKey(fall-HOUR),'2026-10-31');
  assert.equal(todayKey(fall),'2026-11-1');
 });
 assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone,first,'처음 시간대로 돌아왔다');
});

test('학습일 — 기기 현지 새벽 4시가 경계다',()=>{
 const at=new Date(2026,10,16,3,59).getTime(),after=new Date(2026,10,16,4,1).getTime();
 assert.notEqual(todayKey(at),todayKey(after));
 assert.equal(todayKey(after),todayKey(new Date(2026,10,17,3,0).getTime()));
 assert.equal(nextDayStart(at),new Date(2026,10,16,4,0).getTime());
 assert.equal(nextDayStart(after),new Date(2026,10,17,4,0).getTime());
});

// 판 셋(§20-4) — 생활 판정의 판을 따르고, 홈 코치는 생활이 엔진일 때 연다. 홈 코치만 못 받으면 확인 중에 머물며 간격을 늘려 다시 연다.
function fakeTimers(){const list=[];return {list,setTimeout:(fn,ms)=>{const timer={fn,ms};list.push(timer);return timer;},clearTimeout:timer=>{const i=list.indexOf(timer);if(i>=0)list.splice(i,1);},
 run(){const timer=list.shift();timer?.fn();return timer;}};}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('판 셋 — 생활이 지금 판이면 지금 판 · 확인 중이면 확인 중 · 엔진이면 홈 코치를 열고 자리를 잡으면 엔진, 닫히면 확인 중으로 돌아가 다시 연다',async()=>{
 let life='checking',opens=0,changes=0,settled=false,gone=null;const timers=fakeTimers();
 const made={plan:()=>[],summary:()=>({storage:{base:settled,waiting:false}})};
 const watch=watchHomePlan({open:async()=>{opens+=1;return made;},retired:(coach,fn)=>{gone=fn;return()=>{gone=null;};},lifeState:()=>life,onChange:()=>{changes+=1;},timers});
 assert.equal(watch.phase(),'checking');assert.equal(opens,0,'생활이 확인 중이면 홈 코치를 열지 않는다');
 life='old';assert.equal(watch.phase(),'old');
 life='engine';assert.equal(watch.phase(),'checking','열기 시작');await tick();
 assert.equal(opens,1);assert.equal(changes,1,'코치가 서면 다시 그린다');
 assert.equal(watch.phase(),'checking','요약이 자리를 잡기 전');assert.equal(watch.coach(),null);
 settled=true;timers.run();assert.equal(changes,2,'자리를 잡으면 다시 그린다');
 assert.equal(watch.phase(),'engine');assert.equal(watch.coach(),made);
 life='checking';assert.equal(watch.phase(),'checking','생활 판정이 다시 확인 중이면 홈도 확인 중이다(설계 검토 H12)');assert.equal(watch.coach(),null);
 life='engine';assert.equal(watch.phase(),'engine');
 gone();assert.equal(changes,3,'닫히면 다시 그린다');assert.equal(watch.phase(),'checking');await tick();assert.equal(opens,2,'다시 연다');
 watch.dispose();assert.equal(watch.phase(),'old');
});

test('판 셋 — 홈 코치만 못 받으면 지금 판으로 내려가지 않고 확인 중에 머물며, 간격을 늘려 다시 연다(설계 검토 H11 · H10)',async()=>{
 let opens=0;const timers=fakeTimers();
 const watch=watchHomePlan({open:async()=>{opens+=1;return null;},lifeState:()=>'engine',onChange:()=>{},timers,every:1000,most:4000});
 assert.equal(watch.phase(),'checking');await tick();assert.equal(opens,1);
 assert.equal(watch.phase(),'checking','다시 열 때를 기다리는 동안은 열지 않는다');await tick();assert.equal(opens,1);
 const waits=[];for(let i=0;i<4;i+=1){const timer=timers.run();waits.push(timer.ms);assert.equal(watch.phase(),'checking');await tick();}
 assert.deepEqual(waits,[1000,2000,4000,4000]);assert.equal(opens,5);
 watch.dispose();
});

test('판 셋 — reopen은 홈 코치를 내려놓고 다음 물음에서 새로 연다(은행이 늦게 온 때 — Fable 엔진급 끝 판 F2)',async()=>{
 let opens=0,changes=0;const timers=fakeTimers();
 const made=n=>({n,plan:()=>[],summary:()=>({storage:{base:true,waiting:false}})});
 const watch=watchHomePlan({open:async()=>made(opens+=1),lifeState:()=>'engine',onChange:()=>{changes+=1;},timers});
 assert.equal(watch.phase(),'checking');await tick();
 assert.equal(watch.phase(),'engine');assert.equal(watch.coach().n,1);assert.equal(changes,1);
 watch.reopen();assert.equal(changes,2,'내려놓으면 다시 그린다');
 assert.equal(watch.phase(),'checking','내려놓은 뒤에는 확인 중이고 새로 연다');await tick();
 assert.equal(opens,2);assert.equal(watch.phase(),'engine');assert.equal(watch.coach().n,2,'새로 연 코치');
 watch.dispose();watch.reopen();assert.equal(opens,2,'닫은 뒤에는 열지 않는다');
});

test('판 셋 — 요약이 자리를 잡기를 기다리는 동안은 받기 알림만 듣고 타이머를 두지 않는다 · 자리를 잡은 알림에 곧 다시 그리고 듣기를 그친다(받기 알림 설계 검토 D7 · 설계 주인 11-16 저녁 조건 4)',async()=>{
 let changes=0,settled=false;const timers=fakeTimers();const listeners=new Set();
 const made={plan:()=>[],summary:()=>({storage:{base:settled,waiting:false}}),watch:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
 const watch=watchHomePlan({open:async()=>made,lifeState:()=>'engine',onChange:()=>{changes+=1;},timers});
 assert.equal(watch.phase(),'checking');await tick();assert.equal(changes,1,'코치가 서면 다시 그린다');
 assert.equal(watch.phase(),'checking','요약이 자리를 잡기 전');assert.equal(listeners.size,1,'받은 코치의 받기 알림을 듣는다');
 assert.equal(timers.list.length,0,'받기 알림을 건 뒤에는 남은 타이머가 없다 — 길이 하나다');
 for(const fn of [...listeners])fn({kind:'receive'});
 assert.equal(changes,1,'자리를 잡지 않은 알림으로는 다시 그리지 않는다');assert.equal(timers.list.length,0);
 settled=true;for(const fn of [...listeners])fn({kind:'receive'});
 assert.equal(changes,1,'알림을 받은 자리에서는 그리지 않는다 — 다음 차례로 미룬다(셸의 받기 알림과 같은 규칙)');assert.equal(listeners.size,0,'자리를 잡으면 듣기를 그친다 — 그 뒤는 셸이 듣는다');
 await tick();assert.equal(changes,2,'자리를 잡은 알림에 곧 다시 그린다');assert.equal(timers.list.length,0,'미루기에도 타이머를 두지 않는다');
 assert.equal(watch.phase(),'engine');assert.equal(listeners.size,0,'자리를 잡은 코치에는 다시 걸지 않는다');
 settled=false;assert.equal(watch.phase(),'checking');assert.equal(listeners.size,1,'다시 기다리면 다시 듣는다');assert.equal(timers.list.length,0);
 watch.reopen();assert.equal(listeners.size,0,'코치를 내려놓으면 듣기를 되돌린다');
 watch.dispose();
});

test('다시 그리는 때 — 걸어 둔 때는 하나뿐이고 닫으면 지운다(설계 검토 H22)',()=>{
 let changes=0;const timers=fakeTimers();
 const watch=watchHomePlan({open:async()=>null,lifeState:()=>'old',onChange:()=>{changes+=1;},timers});
 watch.redrawAt(Date.now()+5000);watch.redrawAt(Date.now()+9000);
 assert.equal(timers.list.length,1);timers.run();assert.equal(changes,1);
 watch.redrawAt(Date.now()+5000);watch.dispose();assert.equal(timers.list.length,0);
});

// ── 변형 시험(qa/today-mutants.mjs)이 살아남은 변형으로 찾은 빈 곳 — 진짜 엔진으로는 만들기 어려운 줄 규칙은 todayRows · todayActivities를 바로 본다 ──
test('줄이 되는 규칙 — 상한 날의 생활 복습 · 돌아옴이 아닌 짧은 연습 · 채우기만 남은 생활 복습은 줄이 아니고, 다음 레슨은 새것의 엔진 문장 밖이면 다음 레슨 문장이다(§20-2 · §20-3)',()=>{
 const say=why=>atlas.renderReason(why,{lang:'ko'});
 const act=(kind,id,route,extra={})=>({kind,plan:{id},open:{id,route,label:id,minutes:3,...extra}});
 const lesson=act('new','world.life.01.greetings','lesson',{lessonId:'greetings-expressions'}),life=act('again',LIFE_REVIEW_ID,'review'),practice=act('again','world.practice.topik1.reading.x','practice',{skillId:'topik1.reading.x'});
 const entry=(id,extra)=>({id,locked:false,fact:-1,tier:2,offered:1,idle:false,none:false,capped:false,...extra});
 const rows=entries=>todayRows({entries,activities:[lesson,life,practice],say}).rows.map(row=>[row.kind,row.activityId,row.why.code]);
 // 상한 날 — 생활 복습에 낼 것이 있고(①이 새것이라 상한에 안 걸림) 사실이 있어도 줄이 아니다(설계 주인 11-15 조건 3)
 assert.deepEqual(rows([entry(LIFE_REVIEW_ID,{fact:2,capped:true,why:{code:'host.missed',line:'놓친 표현을 오늘은 다른 장면에서 다시 해 봐요.'}}),entry(lesson.plan.id,{why:{code:'unit.new',line:'「안녕하세요.」 처음 만나요.'}})]),[['new',lesson.plan.id,'unit.new']]);
 // 생활 복습 없이 짧은 연습만 상한에 걸린 날도 상한 날이다 — 상한은 엔진 전체의 값이라 어느 항목이든 같다(GPT 끝 판 GB1)
 const capOf=entries=>todayRows({entries,activities:[lesson,life,practice],say}).capped;
 assert.equal(capOf([entry(practice.plan.id,{capped:true,none:true,tier:9,why:{code:'day.capped',line:'오늘은 여기까지예요. 남은 것은 내일 만나요.'}})]),true,'짧은 연습만 상한');
 assert.equal(capOf([entry(lesson.plan.id,{capped:true,why:{code:'unit.new',line:'「안녕하세요.」 처음 만나요.'}})]),true,'다음 레슨 항목만 있어도 상한');
 assert.equal(capOf([entry(lesson.plan.id,{why:{code:'unit.new',line:'「안녕하세요.」 처음 만나요.'}})]),false);
 // plan 쪽 칸(plan 머리에서 한 번 센 상한)을 먼저 읽는다 — 항목의 capped는 옛 호출을 위해서만 남는다(설계 주인 11-15 · §20-14)
 const dayOf=(entries,dayCapped)=>todayRows({entries,activities:[lesson,life,practice],say,dayCapped}).capped;
 assert.equal(dayOf([entry(lesson.plan.id,{why:{code:'unit.new',line:'「안녕하세요.」 처음 만나요.'}})],true),true,'plan 쪽 칸이 상한');
 assert.equal(dayOf([entry(lesson.plan.id,{capped:true,why:{code:'unit.new',line:'「안녕하세요.」 처음 만나요.'}})],false),false,'plan 쪽 칸이 앞');
 // 짧은 연습은 돌아옴(층 1)일 때만 줄이다
 assert.deepEqual(rows([entry(practice.plan.id,{why:{code:'unit.new',line:'새 문항'}})]),[]);
 assert.deepEqual(rows([entry(practice.plan.id,{tier:1,why:{code:'unit.due',line:'돌아왔어요.'}})]),[['again',practice.plan.id,'unit.due']]);
 // 채우기만 남은 생활 복습(사실 없음 · 층 3)은 줄이 아니다 — 층 2 안쪽이면 줄이다
 assert.deepEqual(rows([entry(LIFE_REVIEW_ID,{tier:3,idle:true,why:{code:'idle',line:'가볍게 이어가요.'}})]),[]);
 assert.deepEqual(rows([entry(LIFE_REVIEW_ID,{tier:1,why:{code:'unit.due',line:'돌아왔어요.'}})]),[['again',LIFE_REVIEW_ID,'unit.due']]);
 // 다음 레슨 — 새것의 엔진 문장(unit.new)이 아니면 다음 레슨 문장이다. 관심 목표 문장은 4-3에서 상황 이름을 못 지어 쓰지 않는다(§20-13)
 assert.deepEqual(rows([entry(lesson.plan.id,{why:{code:'goal.match',line:'더 배우고 싶다고 알려 준 「인사」예요.'}})]),[['new',lesson.plan.id,'host.next']]);
 assert.deepEqual(rows([entry(lesson.plan.id,{tier:3,idle:true,why:{code:'idle',line:'가볍게 이어가요.'}})]),[['new',lesson.plan.id,'host.next']]);
});

test('짧은 연습 후보 — 항목마다 하나, 그 항목에서 돌아온 단위마다 문항 하나다 · 돌아온 단위가 없는 문항과 항목은 넘기지 않는다(§20-2)',()=>{
 const units={a1:['U'],a2:['U','V'],a3:['V'],b1:['W']};
 const pool=[['a1','topik1.reading.x'],['a2','topik1.reading.x'],['a3','topik1.reading.x'],['b1','topik1.reading.y']].map(([itemKey,skillId])=>({itemKey,skillId}));
 const acts=todayActivities({pool,dueUnits:new Set(['U']),itemUnits:key=>(units[key]||[]).map(unit=>({unit})),engine:true,labels:id=>id});
 const practice=acts.filter(act=>act.open.route==='practice');
 assert.deepEqual(practice.map(act=>[act.open.skillId,act.plan.candidates.map(item=>item.itemKey)]),[['topik1.reading.x',['a1']]]);
});

test('확인 중의 차례 — 하던 것이 한글 먼저보다 앞이다(같은 오늘 공부 칸이라 하던 레슨이 줄이다, 두뇌 PLAN_FACTS의 차례)',()=>{
 const progress=progressOf({active:'greetings-story',answers:{q:{choiceId:'a'}},hangul:'new'});
 const plan=planOf({coach:null,progress,now:T0,judged:null});
 assert.equal(plan.today.state,'checking');
 assert.deepEqual(kinds(plan),['new']);
 assert.equal(plan.selected.resume,true);assert.equal(plan.selected.lessonId,'greetings-story');
});

test('다시 그리는 때 — 생활 판정이 아는 앞으로 열릴 때 가운데 가장 이른 것(①이 열림 · 열린 복습이 있어도), 없으면 다음 학습일이다(설계 검토 H22)',async()=>{
 const {coach,time}=await homeCoach();
 const soon=progressOf({completed:['greetings-expressions'],reviews:[reviewOf('greetings-expressions',0,{lapses:1,lastAt:T0-30_000,dueAt:T0+30_000})]});
 const judged=judgeOf(coach,soon,time.t);
 assert.equal(judged.nextAt,T0+30_000,'①은 마지막 답 1분 뒤에 열린다');
 assert.equal(planOf({coach,progress:soon,now:time.t,judged}).today.redrawAt,T0+30_000);
 // 열린 복습이 있어 nextAt이 비어도 앞으로 열릴 때(times)로 다시 그린다
 assert.equal(planOf({coach,progress:soon,now:time.t,judged:{...judged,nextAt:null,times:[T0-MIN,T0+5*MIN,T0+2*MIN]}}).today.redrawAt,T0+2*MIN);
 assert.equal(planOf({coach,progress:progressOf(),now:time.t}).today.redrawAt,nextDayStart(time.t));
 coach.dispose();
});

/* ── 4-6e-1 복습 칸의 게임(단계4_계획 §25-1 · §25-2) ── */

// 변형 시험(qa/today-mutants.mjs)은 게임 목록의 깬 사본을 SYNK_HOME_GAMES_MODULE로도 넘긴다(홈 사본이 같은 사본을 부른다).
const HG=await import(process.env.SYNK_HOME_GAMES_MODULE?pathToFileURL(process.env.SYNK_HOME_GAMES_MODULE).href:'../world-home-games.mjs');
const {songItems}=await import('../../korean-rhythm/atlas-next-play.mjs');
const {practiceStarts}=await import('../../subway-rush/journeys.mjs');
const {decisionMeta}=await import('../../subway-rush/learning.mjs');
const {startLevel}=await import('../../subway-rush/level.mjs');
const {RACING_CANDIDATES,racingItem}=await import('../../korean-racing/personalization.js');
const {worldPosition}=await import('../world-position-kit.mjs');
// 그 학생의 짧은 연습 풀(셸 practiceFor와 같은 TOPIK I 몫) — 빈칸 베기 · 공개 TOPIK 은행.
const POOL=[...worldPosition.practice.pool,...BANK].filter(item=>!/^ko2\./.test(item.skillId));
// TOPIK II 학생의 짧은 연습 풀(셸 practiceFor의 topik2 — TOPIK II 문항이 있는 영역은 TOPIK II 문항, 없는 영역은 TOPIK I 문항).
const examOf=item=>(/^ko2./.test(item.skillId)?'topik2':'topik1');
const TWO=new Set([...worldPosition.practice.pool,...BANK].filter(item=>examOf(item)==='topik2').map(item=>item.modality));
const POOL2=[...worldPosition.practice.pool,...BANK].filter(item=>(TWO.has(item.modality)?examOf(item)==='topik2':examOf(item)==='topik1'));
const RUNNER_ONLY='korean-runner.listening-check.check-middle-left.v1'; // 단위 S340 · w0609 — w0609는 짧은 연습 · 생활에 없다(S340은 공개 TOPIK 은행에 있다)
// 소리가 드는 문항(게임 문항)은 전달을 마친 뒤 답한다 — 전달이 없으면 접기가 그 답을 쓰지 않는다.
async function heard(coach,itemKey,correct=true){const pid=coach.present({itemKey});coach.delivery(pid,{audio:'completed'});await coach.answer(pid,{correct,assessable:true}).stored;}
const storageOf=(values={})=>({getItem:key=>Object.hasOwn(values,key)?values[key]:null});
// 게임 목록을 직접 볼 때는 이 시험의 사본(HG)으로 짓는다 — 저장한 환승 난도는 넘긴 저장소에서 읽는다. 홈 계획 장면(gamePlan)은 셸과 같은 길로
// 돈다 — 게임 목록을 넣지 않고 홈이 homeGames를 스스로 부르며, 시험은 저장한 환승 난도를 읽을 저장소만 넘긴다(변형 시험의 게임 목록 사본은 홈
// 사본의 import가 가리킨다).
const gamesOf=({progress,settings={},openGames=null,storage=storageOf()})=>HG.homeGames({progress:progress.exportSnapshot(),settings,now:T0,openGames,storage});
// say는 셸(world-atlas-next.mjs homePlanner.say)과 같은 꼴이다 — 둘째 인자(단위 → 이름)가 오면 그것을 먼저 쓰고, 없으면 셸 이름표(능력 이름)다.
const shellSay=(lang='ko')=>(why,names)=>atlas.renderReason(why,{lang,label:id=>(typeof names==='function'?names(id):null)??null});
function gamePlan({coach,progress,now,settings={},pool=[],openGames=null,judged,storage,lang='ko'}){
 return createWorldTodayPlan({coach,progress,judged:judged===undefined?judgeOf(coach,progress,now):judged,settings,now,pool,opened:new Set(),lang,openGames,
  say:shellSay(lang),labels:id=>id,gameStorage:storage??storageOf()});
}
const gameActs=plan=>plan.candidates.filter(candidate=>candidate.route==='game');
const againRow=plan=>plan.today.items.find(row=>row.kind==='again')??null;

test('바람길에만 있는 단위가 돌아온 날 — 복습 줄이 바람길이고 이유는 unit.due다 · 목표를 싣지 않는다 · 오늘 공부 칸에는 게임 줄이 없다(§25-1)',async()=>{
 const {coach,time}=await homeCoach({start:T0-3*DAY,words:true});
 await heard(coach,RUNNER_ONLY);
 time.at(T0);
 const progress=progressOf({completed:ORDER});
 // S340이 든 짧은 연습 문항을 뺀 풀 — 돌아온 단위 둘을 모두 바람길이 맡는다.
 const pool=POOL.filter(item=>!coach.itemUnits(item.itemKey).some(r=>r.unit==='ko.grammar.S340'));
 const plan=gamePlan({coach,progress,now:time.t,pool});
 const row=againRow(plan);
 assert.equal(row?.activityId,'world.play.runner');
 assert.equal(row.why.code,'unit.due');
 assert.equal(row.open.gameId,'runner','단추는 셸의 짧은 이름으로 연다');
 assert.deepEqual(kinds(plan),['again'],'다음 레슨 · 숙제가 없는 날 오늘 공부 칸에 자유 게임 줄이 없다');
 const acts=todayActivities({snapshot:progress.exportSnapshot(),settings:{},now:time.t,pool:POOL,dueUnits:new Set(coach.due().map(r=>r.unit)),itemUnits:key=>coach.itemUnits(key),engine:true,labels:id=>id,games:gamesOf({progress})});
 const runner=acts.find(act=>act.plan.id==='world.play.runner');
 assert.ok(acts.some(act=>act.open.route==='practice'),'풀 전체면 S340은 짧은 연습이 맡는다');
 assert.equal(runner.kind,'again');
 assert.equal(runner.plan.facts.goals,undefined,'목표를 넘기지 않는다');
 assert.deepEqual(runner.plan.candidates,[{itemKey:RUNNER_ONLY}],'S340은 짧은 연습 풀이 맡고 w0609만 바람길이 맡는다 — 문항 하나');
 assert.ok(!acts.some(act=>act.kind==='new'&&act.open.route==='game'),'자유 게임은 오늘 공부 칸에 넘기지 않는다');
 coach.dispose();
});

test('게임 줄의 이유는 그 줄이 맡은 단위로만 짓는다 — TOPIK II 3분: 짧은 연습이 시간으로 잠긴 날 바람길 줄은 짧은 연습 몫 S340(「-은 다음에」)이 아니라 맡은 w0609를 말한다(설계 주인 11-23 GB2 결정)',async()=>{
 const {coach,time}=await homeCoach({start:T0-3*DAY,words:true});
 await heard(coach,RUNNER_ONLY);
 time.at(T0);
 const progress=progressOf({completed:ORDER});
 const S340=coach.itemUnits(RUNNER_ONLY).find(row=>row.unit==='ko.grammar.S340');
 const W0609=coach.itemUnits(RUNNER_ONLY).find(row=>row.unit==='ko.word.w0609');
 assert.equal(S340.label,'-은 다음에');
 assert.ok(W0609.label,'w0609에는 보일 이름이 있다');
 const settings={minutes:3,reasons:['exam'],primaryReason:'exam',examType:'topik2'};
 const plan=gamePlan({coach,progress,now:time.t,pool:POOL2,settings});
 const acts=todayActivities({snapshot:progress.exportSnapshot(),settings,now:time.t,pool:POOL2,dueUnits:new Set(coach.due().map(r=>r.unit)),itemUnits:key=>coach.itemUnits(key),engine:true,labels:id=>id,games:gamesOf({progress,settings})});
 const practice=acts.filter(act=>act.open.route==='practice'&&act.unlocked===undefined);
 assert.ok(POOL2.some(item=>item.skillId==='ko2.listening.main'&&coach.itemUnits(item.itemKey).some(r=>r.unit==='ko.grammar.S340')),'TOPIK II 풀에 S340이 든 듣기 문항이 있다');
 assert.ok(practice.length&&practice.every(act=>act.blocked==='time.limit'),'S340을 맡은 짧은 연습(듣기 4분)은 3분 설정에서 잠긴다');
 const runner=acts.find(act=>act.plan.id==='world.play.runner');
 assert.deepEqual(runner.plan.candidates,[{itemKey:RUNNER_ONLY}],'w0609만 실은 바람길 문항이 없어 S340을 함께 실은 문항을 낸다(문항 고르기는 그대로)');
 assert.deepEqual(runner.assigned.map(row=>row.unit),['ko.word.w0609'],'바람길이 맡은 단위는 w0609뿐이다');
 // 두뇌의 이유는 S340을 가리킨다(두뇌는 문항의 모든 단위로 짓는다) — 줄은 그것을 쓰지 않는다.
 const brain=coach.plan([runner.plan],{lang:'ko'})[0];
 assert.equal(brain.why.slots.unit,'ko.grammar.S340','이 장면의 두뇌 이유는 짧은 연습 몫이다(옛 코드는 이것을 그대로 보였다)');
 const row=againRow(plan);
 assert.equal(row?.activityId,'world.play.runner');
 assert.equal(row.why.code,'unit.due');
 assert.equal(row.why.slots.unit,'ko.word.w0609');
 assert.equal(row.why.slots.days,3);
 assert.ok(!row.why.text.includes('-은 다음에'),row.why.text);
 assert.ok(row.why.text.includes(`「${W0609.label}」`),row.why.text);
 assert.equal(row.why.text,atlas.renderReason({code:'unit.due',slots:{unit:'ko.word.w0609',days:3}},{lang:'ko',label:()=>W0609.label}));
 // 다른 화면 언어도 맡은 단위로 짓는다.
 for(const lang of ['en','mn']){
  const other=againRow(gamePlan({coach,progress,now:time.t,pool:POOL2,settings,lang}));
  assert.equal(other.why.slots.unit,'ko.word.w0609');
  assert.ok(other.why.text.includes(W0609.label)&&!other.why.text.includes('-은 다음에'),other.why.text);
 }
 coach.dispose();
});

test('게임 줄 — 맡은 단위에 보일 이름이 없으면 단위 이름 없는 줄이고 다른 활동 몫의 이름을 빌리지 않는다 · 놓친 적이 있으면 unit.shaky · 두뇌의 이유가 맡은 단위면 그대로(GB2 결정 2)',async()=>{
 const runnerOpen={id:'world.play.runner',route:'game',gameId:'runner',label:'바람길',minutes:3,audioRequired:true};
 const acts=todayActivities({pool:[{itemKey:'pp',skillId:'topik1.reading.x'}],dueUnits:new Set(['P','W']),
  itemUnits:key=>(key==='pp'?[{unit:'P',label:'짧은 연습 몫'}]:key==='g'?[{unit:'P',label:'짧은 연습 몫'},{unit:'W',label:null}]:[]),engine:true,
  games:[{id:'world.play.runner',gameId:'runner',open:runnerOpen,items:[{itemKey:'g'}]}]});
 const runner=acts.find(act=>act.plan.id==='world.play.runner');
 assert.deepEqual(runner.assigned,[{unit:'W',label:null}]);
 const due=new Map([['W',{unit:'W',days:2,lapses:0,sittings:1}],['P',{unit:'P',days:2,lapses:0,sittings:1}]]);
 const borrowed={id:'world.play.runner',locked:false,fact:-1,tier:1,none:false,why:{code:'unit.due',slots:{unit:'P',days:2},line:'「짧은 연습 몫」 본 지 2일 됐어요.'}};
 const say=shellSay('ko');
 const nameless=todayRows({entries:[borrowed],activities:[runner],say,due,lang:'ko'}).rows[0];
 assert.equal(nameless.why.code,'unit.due');
 assert.equal(nameless.why.slots.unit,'W');
 assert.ok(!nameless.why.text.includes('짧은 연습 몫'),nameless.why.text);
 assert.equal(nameless.why.text,'게임에서 만난 말이 돌아왔어요. 잊기 전에 한 번 더 만나요.');
 assert.ok(!todayRows({entries:[borrowed],activities:[runner],say,due,lang:'en'}).rows[0].why.text.includes('짧은'));
 // 이름이 있고 놓친 적이 있으면 unit.shaky
 const named={...runner,assigned:[{unit:'W',label:'왼쪽'}]};
 const shaky=todayRows({entries:[borrowed],activities:[named],say,due:new Map([['W',{unit:'W',days:2,lapses:1,sittings:3}]]),lang:'ko'}).rows[0];
 assert.equal(shaky.why.code,'unit.shaky');
 assert.deepEqual(shaky.why.slots,{unit:'W',misses:1,reviews:3,days:2});
 assert.ok(shaky.why.text.includes('「왼쪽」'),shaky.why.text);
 // 두뇌의 이유가 맡은 단위를 가리키면 두뇌의 문장 그대로
 const own={...borrowed,why:{code:'unit.due',slots:{unit:'W',days:2},line:'두뇌의 문장'}};
 assert.equal(todayRows({entries:[own],activities:[named],say,due,lang:'ko'}).rows[0].why.text,'두뇌의 문장');
});

test('같은 단위가 짧은 연습 풀에도 있으면 복습 줄은 짧은 연습이고 게임 활동은 넘기지 않는다 · 생활 복습이 실은 단위도 게임이 맡지 않는다(§25-1 단위 맡기)',async()=>{
 const {coach,time}=await homeCoach({start:T0-3*DAY,words:true});
 await heard(coach,'korean-runner.listening-check.check-star-middle.v1'); // 단위 G211 — 공개 TOPIK 은행에 있다
 time.at(T0);
 const plan=gamePlan({coach,progress:progressOf({completed:ORDER}),now:time.t,pool:POOL});
 assert.equal(againRow(plan)?.route,'practice');
 assert.deepEqual(gameActs(plan),[],'바람길 활동은 넘기지 않는다');
 // 생활 복습이 실은 단위(w0609 — 그날 생활 복습 문항 「길 · 적용」 돌기의 새 상황 문항)와 짧은 연습 풀의 단위(S340)만 돌아온 날 — 바람길
 // 「가운데 · 왼쪽」(S340 · w0609)이 맡을 단위가 없다.
 const second=await homeCoach({start:T0-3*DAY,words:true});
 await answer(second.coach,'life.directions-apply-turn-transfer',true); // 단위 w0609 · ko.life.directions-right
 await heard(second.coach,RUNNER_ONLY);
 second.time.at(T0);
 const progress=progressOf({completed:ORDER,reviews:[reviewOf('directions-apply',1,{streak:1,lastAt:T0-3*DAY,dueAt:T0})]});
 const life=gamePlan({coach:second.coach,progress,now:second.time.t,pool:POOL});
 assert.ok(life.candidates.some(candidate=>candidate.id===LIFE_REVIEW_ID),'그날 생활 복습이 선다');
 assert.deepEqual(gameActs(life),[],'생활 복습이 실은 단위 · 짧은 연습 풀의 단위는 게임 후보가 아니다');
 assert.notEqual(againRow(life)?.route,'game');
 coach.dispose();second.coach.dispose();
});

test('생활 하나 · 게임 하나(서로 다른 단위)면 생활 복습, 짧은 연습 하나 · 게임 하나면 짧은 연습이 복습 줄이다 · 생활 단위 둘과 바람길 단위 하나도 생활 복습이다(§25-1 · 25-0의 잰 장면)',async()=>{
 // 생활 하나 + 바람길 하나
 const a=await homeCoach({start:T0-3*DAY,words:true});
 await answer(a.coach,mainKeys('greetings-expressions')[0],true);
 await heard(a.coach,RUNNER_ONLY);
 a.time.at(T0);
 const oneLife=gamePlan({coach:a.coach,progress:progressOf({completed:ORDER,reviews:[reviewOf('greetings-expressions',0,{streak:1,lastAt:T0-3*DAY,dueAt:T0})]}),now:a.time.t,pool:[]});
 assert.ok(gameActs(oneLife).some(act=>act.id==='world.play.runner'),'게임 활동도 넘어간다');
 assert.equal(againRow(oneLife)?.activityId,LIFE_REVIEW_ID);
 // 생활 둘 + 바람길 하나(바람길 문항은 단위 둘 — 할 것의 수로는 겨루지 않는다)
 const b=await homeCoach({start:T0-3*DAY,words:true});
 for(const key of mainKeys('greetings-expressions').slice(0,2))await heard(b.coach,key);
 await heard(b.coach,RUNNER_ONLY);
 b.time.at(T0);
 const twoLife=gamePlan({coach:b.coach,progress:progressOf({completed:ORDER,reviews:[0,1].map(i=>reviewOf('greetings-expressions',i,{streak:1,lastAt:T0-3*DAY,dueAt:T0}))}),now:b.time.t,pool:[]});
 assert.equal(againRow(twoLife)?.activityId,LIFE_REVIEW_ID);
 // 짧은 연습 하나 + 바람길 하나
 const c=await homeCoach({start:T0-3*DAY,words:true});
 const one=BANK.find(item=>item.skillId.includes('.reading.')&&c.coach.itemUnits(item.itemKey).length===1);
 await answer(c.coach,one.itemKey,true);
 await heard(c.coach,RUNNER_ONLY);
 c.time.at(T0);
 const pool=BANK.filter(item=>item.skillId===one.skillId);
 const practice=gamePlan({coach:c.coach,progress:progressOf({completed:ORDER}),now:c.time.t,pool});
 assert.ok(gameActs(practice).some(act=>act.id==='world.play.runner'));
 assert.equal(againRow(practice)?.route,'practice');
 for(const x of [a,b,c])x.coach.dispose();
});

test('게임이 맡은 단위가 더 많아도 같은 층이면 뒤로 간다 — 바람길 단위 셋과 생활 하나는 생활 복습, 빈칸 베기 한 문항(단위 둘)과 환승 출구 둘은 짧은 연습(실제 은행)',async()=>{
 const a=await homeCoach({start:T0-3*DAY,words:true});
 await answer(a.coach,mainKeys('greetings-expressions')[0],true);
 for(const key of [RUNNER_ONLY,'korean-runner.listening-check.check-left-run.v1'])await heard(a.coach,key); // S340 · w0609 · w1199
 a.time.at(T0);
 const plan=gamePlan({coach:a.coach,progress:progressOf({completed:ORDER,reviews:[reviewOf('greetings-expressions',0,{streak:1,lastAt:T0-3*DAY,dueAt:T0})]}),now:a.time.t,pool:[]});
 const runner=todayActivities({snapshot:{},settings:{},pool:[],dueUnits:new Set(a.coach.due().map(r=>r.unit)),itemUnits:key=>a.coach.itemUnits(key),engine:true,games:gamesOf({progress:progressOf()})}).find(act=>act.plan.id==='world.play.runner');
 assert.equal(runner.plan.candidates.length,2,'단위 셋을 문항 둘이 덮는다');
 assert.equal(againRow(plan)?.activityId,LIFE_REVIEW_ID,'할 것의 수가 많은 게임이 생활 복습을 앞지르지 않는다');
 // 빈칸 베기 v03(단위 둘)과 환승 출구 문항 둘(짧은 연습 풀에 없는 단위)
 const b=await homeCoach({start:T0-3*DAY,words:true});
 const poolUnits=new Set(POOL.flatMap(item=>b.coach.itemUnits(item.itemKey).map(r=>r.unit)));
 const exits=HG.SUBWAY_ITEMS.basic.filter(item=>/\.exit\.\d\.v1$/.test(item.itemKey)&&b.coach.itemUnits(item.itemKey).every(r=>!poolUnits.has(r.unit))).slice(0,2);
 assert.equal(exits.length,2,'짧은 연습 풀에 없는 단위의 출구 문항 둘');
 assert.equal(b.coach.itemUnits('blank-slice.v03.v1').length,2);
 for(const key of ['blank-slice.v03.v1',...exits.map(item=>item.itemKey)])await heard(b.coach,key);
 b.time.at(T0);
 const progress=progressOf({completed:['greetings-expressions']});
 const rush=gamePlan({coach:b.coach,progress,now:b.time.t,pool:POOL});
 const subway=gameActs(rush).find(act=>act.id==='world.play.subway');
 assert.ok(subway,'환승 활동이 넘어간다');
 assert.equal(againRow(rush)?.route,'practice','짧은 연습이 복습 줄');
 a.coach.dispose();b.coach.dispose();
});

test('생활 은행에 있으나 그날 생활 복습이 싣지 않은 단위는 게임 후보다 — 학생이 아직 그 레슨을 하지 않았으면 게임이 맡는다(§25-1)',async()=>{
 const {coach,time}=await homeCoach({start:T0-3*DAY,words:true});
 await heard(coach,'korean-runner.listening-check.check-not-middle.v1'); // S226 · w0618(생활 은행의 낱말)
 time.at(T0);
 const progress=progressOf();
 const pool=POOL.filter(item=>!coach.itemUnits(item.itemKey).some(r=>r.unit==='ko.grammar.S226'));
 const acts=todayActivities({snapshot:progress.exportSnapshot(),settings:{},now:time.t,pool,dueUnits:new Set(coach.due().map(r=>r.unit)),itemUnits:key=>coach.itemUnits(key),engine:true,labels:id=>id,games:gamesOf({progress})});
 const runner=acts.find(act=>act.plan.id==='world.play.runner');
 assert.ok(runner?.plan.candidates.some(item=>item.itemKey==='korean-runner.listening-check.check-not-middle.v1'),'w0618 · S226을 바람길이 맡는다');
 coach.dispose();
});

test('상한 날에는 게임 줄이 없다 · 소리를 끈 날 게임에만 돌아온 단위가 있으면 조건에 걸린 날이다 · 손님에게 닫힌 게임은 후보가 아니고 그날을 조건에 걸린 날로 만들지 않는다(§25-1)',async()=>{
 const capped=await homeCoach({start:T0-3*DAY,words:true,params:{reviewsPerDay:0}});
 await heard(capped.coach,RUNNER_ONLY);
 capped.time.at(T0);
 const plan=gamePlan({coach:capped.coach,progress:progressOf({completed:ORDER}),now:capped.time.t,pool:[]});
 assert.equal(plan.today.capped,true);
 assert.equal(againRow(plan),null,'상한 날에는 게임 줄이 없다');
 const {coach,time}=await homeCoach({start:T0-3*DAY,words:true});
 await heard(coach,RUNNER_ONLY);
 time.at(T0);
 const progress=progressOf({completed:ORDER});
 const quiet=gamePlan({coach,progress,now:time.t,pool:[],settings:{audio:'off'}});
 assert.equal(quiet.today.items.length,0);
 assert.equal(quiet.status,'unavailable');
 assert.deepEqual(quiet.today.empty,{code:'blocked',text:null},'소리를 끈 날 게임은 빼지 않고 잠근다');
 assert.ok(gameActs(quiet).some(act=>act.id==='world.play.runner'));
 const guest=gamePlan({coach,progress,now:time.t,pool:[],openGames:['hangul']});
 assert.deepEqual(gameActs(guest),[],'손님에게 닫힌 게임은 후보가 아니다');
 assert.equal(guest.status,'empty');
 assert.deepEqual(guest.today.empty,{code:'done',text:null},'닫힌 게임이 그날을 조건에 걸린 날로 만들지 않는다');
 capped.coach.dispose();coach.dispose();
});

test('게임 코치의 복습 제시가 같은 호스트의 오늘 복습 수에 들어 상한에 닿은 날 — 홈은 상한 문장을 두고 복습 줄을 세우지 않으며 다음 레슨 줄은 선다(§25-2)',async()=>{
 stores+=1;let now=T0-3*DAY;const port=atlas.memoryPort(),key=`synk-atlas:world-home-cap-${process.pid}-${stores}`;
 const host=()=>({guest:true,port,key,now:()=>now});
 const params={...atlas.PARAMS,reviewsPerDay:3};
 const race=atlas.createCoach({gameId:'korean-racing',mapData:MAP_DATA,dayOffset:540,params,host:host()});
 const home=atlas.createCoach({gameId:'world-home',mapData:MAP_DATA,dayOffset:540,params,host:host()});
 await Promise.all([race.ready,home.ready]);
 const metas=RACING_CANDIDATES.slice(0,6).map(row=>racingItem(row.item));
 for(const meta of metas){const pid=race.present(meta);if(meta.audioRequired)race.delivery(pid,{audio:'completed'});await race.answer(pid,{correct:true,assessable:true}).stored;}
 now=T0;
 const progress=progressOf({completed:['greetings-expressions']});
 const before=planOf({coach:home,progress,now});
 assert.equal(before.today.capped,false);
 let reviews=0;
 for(let i=0;i<metas.length&&reviews<3;i+=1){
  const pick=race.recommend(metas,{audio:true});
  if(pick.status==='none')break;
  const pid=race.present(pick.selected);
  if(pick.selected.audioRequired)race.delivery(pid,{audio:'completed'});
  await race.answer(pid,{correct:true,assessable:true}).stored;
  if(pick.tier===1)reviews+=1;
 }
 assert.equal(reviews,3,'레이싱이 돌아온 단위 셋을 복습으로 냈다');
 const after=planOf({coach:home,progress,now});
 assert.equal(after.today.capped,true,'게임의 복습 제시가 홈의 오늘 복습 수에 든다');
 assert.equal(after.today.cappedText,'오늘은 여기까지예요. 남은 것은 내일 만나요.');
 assert.deepEqual(kinds(after),['new'],'복습 줄 없이 다음 레슨 줄만');
 race.dispose();home.dispose();
});

test('게임 목록 — 손님에게 닫힌 게임 · 해금 전 환승은 넣지 않는다, 환승은 그 난도에서 게임이 내는 결정만 싣는다(저장한 난도가 목표 급보다 먼저)(§25-1)',()=>{
 const ids=list=>list.map(game=>game.id);
 assert.deepEqual(ids(gamesOf({progress:progressOf()})),['world.play.runner','world.play.rhythm'],'해금 전 환승은 넣지 않는다');
 assert.deepEqual(ids(gamesOf({progress:progressOf(),openGames:['hangul']})),[],'손님에게 닫힌 게임은 잠그지 않고 뺀다');
 const done=progressOf({completed:['greetings-expressions']});
 const subway=(settings,storage)=>gamesOf({progress:done,settings,storage}).find(game=>game.id==='world.play.subway');
 const keys=game=>game.items.map(item=>item.itemKey);
 const upper=subway({targetGrade:3},storageOf());
 assert.ok(keys(upper).some(key=>/\.busy\./.test(key)),'저장한 난도가 없는 목표 3급 학생은 바쁜 아침');
 assert.ok(upper.items.some(item=>item.skillId.startsWith('ko2.')),'ko2 문항을 싣는다');
 const basic=subway({targetGrade:3},storageOf({[HG.SUBWAY_LEVEL_KEY]:'basic'}));
 assert.ok(!basic.items.some(item=>item.skillId.startsWith('ko2.')),'첫 등굣길을 저장한 목표 3급 학생의 후보에는 ko2가 없다');
 assert.equal(basic.items.length,25);
 for(const gone of ['subway-rush.fork.cheongnyangni.jonggak.v1','subway-rush.stop.jonggak.off.left.v1','subway-rush.stop.jonggak.off.right.v1','subway-rush.stop.euljiro3.off.left.v1','subway-rush.stop.euljiro3.off.right.v1'])
  assert.ok(!keys(basic).includes(gone),`첫 등굣길에는 ${gone}가 없다`);
 const busy=subway({},storageOf({[HG.SUBWAY_LEVEL_KEY]:'busy'}));
 assert.equal(busy.items.length,30);
 for(const key of keys(busy)){
  assert.doesNotMatch(key,/^subway-rush\.exit\.\d\.v1$/,'바쁜 아침에는 출구 1~8이 없다');
  assert.doesNotMatch(key,/dongdaemun/,'동대문 갈래와 하차가 없다');
  assert.doesNotMatch(key,/euljiro3\.pass/,'을지로3가 통과가 없다');
 }
 const runner=gamesOf({progress:done}).find(game=>game.id==='world.play.runner');
 assert.equal(runner.items.length,12,'바람길은 듣기 확인 12');
 assert.equal(runner.open.route,'game');
 assert.deepEqual(runner.open.targets,[],'옛 겨눔은 싣지 않는다');
});

test('홈 목록의 표 — 리듬 표는 songItems()의 같은 칸과 깊이 같고 다시 묻기 문항이 없다, 환승 표는 난도마다 practiceStarts(level)의 결정 문항과 깊이 같다(§25-1)',()=>{
 const cells=row=>({itemKey:row.itemKey,familyKey:row.familyKey,skillId:row.skillId,modality:row.modality,audioRequired:row.audioRequired});
 assert.deepEqual(HG.RHYTHM_ITEMS.map(cells),songItems().map(cells));
 assert.ok(!HG.RHYTHM_ITEMS.some(row=>/r$|:recall/.test(row.itemKey)),'다시 묻기 문항이 없다');
 for(const level of ['basic','busy'])
  assert.deepEqual(HG.SUBWAY_ITEMS[level].map(cells),[...practiceStarts(level).values()].map(start=>cells(decisionMeta(start.decision))),level);
});

test('원문 — 짧은 이름과 은행의 짝이 셸 games 표의 주소 폴더와 같고, 환승 난도 규칙 · 열쇠가 subway-rush의 startLevel · app.mjs와 같다 · 새 모듈은 리허설 서버와 공개 묶음의 새 길 목록에 있다',()=>{
 const shell=fs.readFileSync(new URL('../app-shell.mjs',import.meta.url),'utf8');
 const table=shell.slice(shell.indexOf('const games={'),shell.indexOf('\n',shell.indexOf("subway:{get title()",shell.indexOf('const games={'))));
 for(const [short,bank] of Object.entries(HG.GAME_BANK)){
  const at=table.indexOf(`${short}:{`);
  assert.ok(at>=0,`셸 games 표에 ${short}`);
  assert.match(table.slice(at,table.indexOf('}}',at)+2),new RegExp(`['\`]${bank}/`),`${short} → ${bank}`);
 }
 assert.deepEqual([...HG.HOME_GAME_BANKS],Object.values(HG.GAME_BANK).sort());
 const subwayApp=fs.readFileSync(new URL('../../subway-rush/app.mjs',import.meta.url),'utf8');
 assert.ok(subwayApp.includes(`localStorage.getItem('${HG.SUBWAY_LEVEL_KEY}')`)&&subwayApp.includes(`localStorage.setItem('${HG.SUBWAY_LEVEL_KEY}'`),'환승 난도 열쇠가 게임이 읽고 쓰는 열쇠와 같다');
 for(const saved of [null,'basic','busy','이상한 값'])for(const grade of [null,'1','2','3','6','x'])
  assert.equal(HG.subwayLevel({saved,grade}),startLevel({saved,grade}),`${saved} · ${grade}`);
 const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 const build=fs.readFileSync(new URL('../../../tools/build-world-app-public.mjs',import.meta.url),'utf8');
 assert.ok(server.includes("'/world-home-games.mjs'"),'리허설 서버가 낸다');
 assert.ok(build.includes("'world-home-games.mjs'"),'공개 묶음이 싣는다');
});

test('게임 줄 규칙 — 숙제가 아닌 게임은 맨 앞 층이 1일 때만 줄이고, 잠김 · 사실 · 층이 같으면 목표 수 · 할 것의 수와 상관없이 생활 복습 · 짧은 연습 뒤로 간다(§25-1)',()=>{
 const say=why=>atlas.renderReason(why,{lang:'ko'});
 const act=(kind,id,route,extra={})=>({kind,plan:{id},open:{id,route,label:id,minutes:3,...extra}});
 const life=act('again',LIFE_REVIEW_ID,'review'),practice=act('again','world.practice.topik1.reading.x','practice',{skillId:'topik1.reading.x'}),runner=act('again','world.play.runner','game',{gameId:'runner'}),lesson=act('new','world.life.01.greetings','lesson',{lessonId:'greetings-expressions'});
 const entry=(id,extra)=>({id,locked:false,fact:-1,tier:1,offered:1,idle:false,none:false,capped:false,goals:0,todo:1,why:{code:'unit.due',line:'돌아왔어요.'},...extra});
 const rows=(entries,dayCapped)=>todayRows({entries,activities:[life,practice,runner,lesson],say,dayCapped}).rows.map(row=>[row.kind,row.activityId]);
 assert.deepEqual(rows([entry(runner.plan.id)]),[['again','world.play.runner']],'층 1이면 줄');
 assert.deepEqual(rows([entry(runner.plan.id,{tier:2,why:{code:'unit.new',line:'처음 만나요.'}})]),[],'층 2는 줄이 아니다');
 assert.deepEqual(rows([entry(runner.plan.id,{none:true})]),[],'낼 것이 없으면 줄이 아니다');
 assert.deepEqual(rows([entry(runner.plan.id)],true),[],'상한 날에는 줄이 아니다');
 // 두뇌 차례가 게임 → 생활 복습(할 것 셋 · 목표 하나가 더 많다)이어도 같은 층이면 생활 복습이 앞이다.
 assert.deepEqual(rows([entry(runner.plan.id,{todo:3,goals:1}),entry(LIFE_REVIEW_ID),entry(lesson.plan.id,{tier:2,why:{code:'unit.new',line:'처음 만나요.'}})]),[['again',LIFE_REVIEW_ID],['new',lesson.plan.id]]);
 assert.deepEqual(rows([entry(runner.plan.id,{todo:2}),entry(practice.plan.id)]),[['again',practice.plan.id]]);
 // 층이 다르면 두뇌 차례 그대로 — 게임이 층 1이고 생활 복습이 층 2면 게임이 앞이다. 생활 복습과 짧은 연습 사이의 차례는 그대로다.
 assert.deepEqual(rows([entry(runner.plan.id),entry(LIFE_REVIEW_ID,{tier:2,fact:2,why:{code:'host.bridge',line:'다리.'}})]),[['again','world.play.runner']]);
 assert.deepEqual(todayRows({entries:[entry(practice.plan.id),entry(runner.plan.id),entry(LIFE_REVIEW_ID)],activities:[life,practice,runner],say}).rows.map(row=>row.activityId),[practice.plan.id]);
 // 단위마다 하나 — 돌아온 단위 하나(G211)를 덮는 바람길 문항이 다섯이어도 후보는 하나다.
 const units={a:['G211'],b:['G211'],c:['G211','X'],d:['Y']};
 const game={id:'world.play.runner',gameId:'runner',open:runner.open,items:['a','b','c','d'].map(itemKey=>({itemKey}))};
 const acts=todayActivities({pool:[],dueUnits:new Set(['G211','X']),itemUnits:key=>(units[key]||[]).map(unit=>({unit})),engine:true,games:[game]});
 assert.deepEqual(acts.find(one=>one.plan.id==='world.play.runner').plan.candidates,[{itemKey:'a'},{itemKey:'c'}]);
 // 게임 사이에서도 단위 하나는 한 활동만 — 앞 게임(바람길)이 맡은 W를 뒤 게임(환승)이 다시 세지 않는다. 다른 활동(짧은 연습)이 맡은 P를 함께 실은
 // 문항(p)보다 W만 실은 문항(w)을 먼저 고른다.
 const two={a:['P','W'],w:['W'],s1:['W'],s2:['Z']};
 const runnerRows=['a','w'].map(itemKey=>({itemKey})),subwayRows=['s1','s2'].map(itemKey=>({itemKey}));
 const subwayOpen={id:'world.play.subway',route:'game',gameId:'subway',label:'환승',minutes:3,audioRequired:true};
 const both=todayActivities({pool:[{itemKey:'pp',skillId:'topik1.reading.x'}],dueUnits:new Set(['P','W','Z']),itemUnits:key=>(key==='pp'?['P']:two[key]||[]).map(unit=>({unit})),engine:true,
  games:[{id:'world.play.runner',gameId:'runner',open:runner.open,items:runnerRows},{id:'world.play.subway',gameId:'subway',open:subwayOpen,items:subwayRows}]});
 assert.deepEqual(both.find(one=>one.plan.id==='world.play.runner').plan.candidates,[{itemKey:'w'}],'짧은 연습이 맡은 P를 실은 문항보다 W만 실은 문항');
 assert.deepEqual(both.find(one=>one.plan.id==='world.play.subway').plan.candidates,[{itemKey:'s2'}],'바람길이 맡은 W를 환승이 다시 세지 않는다');
 // 같은 게임이 앞에서 맡은 단위(A)는 다른 활동 몫이 아니다 — A · B를 실은 문항(ab)이 첫 훑기에서 B를 맡고, 짧은 연습 몫 P를 실은 문항(pb)은 고르지 않는다.
 const three={a:['A'],ab:['A','B'],pb:['P','B']};
 const one=todayActivities({pool:[{itemKey:'pp',skillId:'topik1.reading.x'}],dueUnits:new Set(['A','B','P']),itemUnits:key=>(key==='pp'?['P']:three[key]||[]).map(unit=>({unit})),engine:true,
  games:[{id:'world.play.runner',gameId:'runner',open:runner.open,items:['a','pb','ab'].map(itemKey=>({itemKey}))}]});
 assert.deepEqual(one.find(act=>act.plan.id==='world.play.runner').plan.candidates,[{itemKey:'a'},{itemKey:'ab'}],'같은 게임이 맡은 단위를 함께 실은 문항도 첫 훑기에서 고른다');
});

test('홈 은행에 게임 셋이 든다 — 짧은 연습 풀의 은행만으로는 바람길 · 환승이 빠진다, 홈 은행 조각만 받은 코치로도 바람길 복습 줄이 선다(4-6e 첫 묶음 Fable F1)',async()=>{
 const {homeBanksOf}=await import('../world-atlas-next.mjs');
 const {sliceOf}=await import('../../../packages/atlas/tools/map-ship.mjs');
 const banks=homeBanksOf(worldPosition.practice.pool);
 for(const bank of HG.HOME_GAME_BANKS)assert.ok(banks.includes(bank),`홈 은행에 ${bank}`);
 stores+=1;let now=T0-3*DAY;
 const coach=atlas.createCoach({gameId:'world-home',mapData:{index:banks.map(bank=>sliceOf(MAP_DATA.index,bank,WORDS)),units:MAP_DATA.units,words:WORDS},dayOffset:540,
  host:{guest:true,port:atlas.memoryPort(),key:`synk-atlas:world-home-banks-${process.pid}-${stores}`,now:()=>now}});
 await coach.ready;
 await heard(coach,RUNNER_ONLY);
 now=T0;
 const progress=progressOf({completed:ORDER});
 const pool=POOL.filter(item=>!coach.itemUnits(item.itemKey).some(r=>r.unit==='ko.grammar.S340'));
 const plan=gamePlan({coach,progress,now,pool});
 assert.equal(againRow(plan)?.activityId,'world.play.runner','조각만 받은 코치가 바람길 문항의 단위를 안다');
 coach.dispose();
});

test('실제 은행 — 바람길과 환승에 함께 든 돌아온 낱말(왼쪽 w0609)은 앞 게임인 바람길만 센다(4-6e 첫 묶음 GA1 · GB1)',async()=>{
 const {coach,time}=await homeCoach({start:T0-3*DAY,words:true});
 const both=HG.SUBWAY_ITEMS.basic.find(item=>item.itemKey==='subway-rush.stop.cityhall.off.left.v1');
 const dueOf=key=>coach.itemUnits(key).map(r=>r.unit);
 assert.ok(both&&dueOf(both.itemKey).includes('ko.word.w0609'),'환승 시청 왼쪽 하차 문항에 w0609가 든다');
 for(const key of [RUNNER_ONLY,both.itemKey,'subway-rush.exit.3.v1'])await heard(coach,key);
 time.at(T0);
 const progress=progressOf({completed:['greetings-expressions']});
 const acts=todayActivities({snapshot:progress.exportSnapshot(),settings:{},now:time.t,pool:[],dueUnits:new Set(coach.due().map(r=>r.unit)),itemUnits:key=>coach.itemUnits(key),engine:true,labels:id=>id,games:gamesOf({progress})});
 const keys=id=>acts.find(act=>act.plan.id===id)?.plan.candidates.map(item=>item.itemKey)??[];
 assert.ok(keys('world.play.runner').includes(RUNNER_ONLY));
 const subway=keys('world.play.subway');
 assert.ok(subway.some(key=>dueOf(key).some(unit=>dueOf('subway-rush.exit.3.v1').includes(unit))),'출구 3의 단위는 환승이 맡는다');
 // 바람길이 맡은 w0609를 실은 환승 문항(시청 왼쪽 하차 등)은 환승 후보가 아니다 — w0263은 w0609가 없는 문항으로 맡는다.
 assert.deepEqual(subway.filter(key=>dueOf(key).includes('ko.word.w0609')),[],'환승이 바람길 몫 w0609를 다시 세지 않는다');
 assert.ok(!subway.includes(both.itemKey));
 assert.ok(subway.some(key=>dueOf(key).includes('ko.word.w0263')),'w0263은 환승이 다른 문항으로 맡는다');
 coach.dispose();
});
