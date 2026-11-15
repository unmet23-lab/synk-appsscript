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
function planOf({coach,progress,now,settings={},pool=[],opened=new Set(),lang='ko',openGames=null,judged}){
 const say=why=>atlas.renderReason(why,{lang});
 return createWorldTodayPlan({coach,progress,judged:judged===undefined?judgeOf(coach,progress,now):judged,settings,now,pool,opened,lang,openGames,say,labels:id=>id});
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
   assert.ok(!plan.candidates.some(candidate=>['game','mock','position'].includes(candidate.route)),'게임 · 시험 형식 · 진단은 4-3 후보가 아니다');
   assert.equal(plan.examPlan,null,'이번 주 계획은 4-4');
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
