// Atlas × WORLD 2단계 D(2026-11-08) — 공개본 계정 묶음에 끼운 줄을 실제로 돌린다(현장 노트 배포 · 공개: node --check와 도움 함수 대조만으로는 호출 줄이 안 돈다).
// D_공개묶음.cjs가 만든 check/ 폴더(고친 묶음 · D 엔진 판 + 공개본의 생활 원고 · 진도)에서 묶음을 import하고, 같은 일을 이 작업본의 원천 판으로도 해서
// 지도 · 거울 · 계획 · 이번 주 활동 · 출처 이름이 같은지 본다. 다르면 멈춘다(종료 코드 1).
//   node docs/_ops/qa/atlas-world-engine-20261108/D_공개검사.mjs <check 폴더>
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const dir=path.resolve(process.argv[2]||'');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const at=file=>pathToFileURL(path.join(dir,file)).href,src=file=>pathToFileURL(path.join(ROOT,file)).href;
const live=await import(at('world-account.bundle.mjs'));
const liveContent=await import(at('life-content.mjs')),liveProgress=await import(at('life-progress.mjs'));
const source={...await import(src('experiences/synk-world-app/world-learning-map.mjs')),...await import(src('experiences/synk-world-app/world-learning-plan.mjs')),
 position:(await import(src('experiences/synk-world-app/world-position-kit.mjs'))).worldPosition};
const sourceContent=await import(src('experiences/synk-world-app/life-content.mjs')),sourceProgress=await import(src('experiences/synk-world-app/life-progress.mjs'));
const Trail=createRequire(import.meta.url)(path.join(ROOT,'atlas/trail.js'));
const SCOPE={domain:'LAB',workspace:'learning',subject:'device'},DAY=86400000,MINUTE=60000,START=Date.UTC(2026,10,9,1);
const checks=[];const check=(name,fn)=>{fn();checks.push(name);};

// 1. 거울 부품 · 지도판 그대로(공개본 계정 묶음의 Temper는 1단계 전 판이라 지도판이 바뀌면 이미 잡힌 재확인이 짝을 잃는다 — D_공개묶음.cjs 머리).
const before=await import(at('live-account.bundle.mjs'));
check('worldLearning.life 부품',()=>{
 for(const name of ['createLifeTrail','lifeItem','lifeItems','lifeAssessable','productMet','lessonSlot','reviewSlot'])assert.equal(typeof live.worldLearning.life?.[name],'function',name);
});
check('공개본 WORLD 코치 지도판 · 마디가 끼우기 전과 같다',()=>{
 const version=side=>side.worldLearning.engine.createGame({gameId:'d-pub-map',storage:null,clock:()=>new Date(START).toISOString()}).mapVersion;
 assert.equal(version(live),version(before));
 assert.deepEqual(live.worldLearning.SKILLS.map(node=>node.id),before.worldLearning.SKILLS.map(node=>node.id));
 assert.ok(!live.worldLearning.SKILLS.some(node=>String(node.id).startsWith('life.task.')));
});

// 2. 거울: 같은 학습을 두 판으로 — 레슨(도움 없이 · 도움 뒤 · 틀림) → 다음 날 새 상황 복습.
function mirror(side,content,progressModule){
 let tick=START,seq=0;const values=new Map(),coachValues=new Map();
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};
 const progress=progressModule.createLifeProgress({storage,owner:'d-pub',now:()=>tick,uuid:()=>`run-${++seq}`});progress.summary(content.PACKS,content.LESSONS);
 const coach=side.worldLearning.engine.createGame({gameId:'world-life',followups:true,storage:{getItem:k=>coachValues.get(k)??null,setItem:(k,v)=>coachValues.set(k,String(v))},clock:()=>new Date(tick).toISOString()});
 const life=side.worldLearning.life,trail=life.createLifeTrail({coach:()=>coach,snapshot:()=>progress.exportSnapshot()});
 const lesson=content.LESSONS.find(l=>l.id==='cafe-expressions'),run=progress.startLesson(lesson);
 lesson.questions.forEach((q,index)=>{
  const slot=life.lessonSlot(run.attemptId,q.id);trail.shown(slot,life.lifeItem({lesson,question:q}));
  if(index===1)trail.help(slot,'explanation');
  const correct=index!==2,choiceId=correct?q.answerId:q.choices.find(c=>c.id!==q.answerId).id;
  const saved=progress.recordAnswer({lessonId:lesson.id,questionId:q.id,choiceId,correct,helped:index===1});
  const stored=saved.answers[q.id];trail.answer(slot,{correct:stored.correct,choiceId:stored.choiceId,correctId:q.answerId,helped:stored.helped});
 });
 progress.finishLesson(lesson.id);tick+=DAY+MINUTE;
 const review=progress.startReview(1,'cafe-expressions-order-transfer',['cafe-expressions-order-transfer']),q=lesson.questions[0];
 const slot=life.reviewSlot(review.id,'cafe-expressions-order-transfer');trail.shown(slot,life.lifeItem({lesson,question:q,review:true}));
 progress.answerReview({id:'cafe-expressions-order-transfer',runId:review.id,correct:true});
 trail.answer(slot,{correct:true,choiceId:q.review.answerId,correctId:q.review.answerId,helped:false});
 const attempts=Trail.summarize(coach.events(),{scope:SCOPE,asOf:new Date(tick).toISOString()}).attempts
  .map(a=>[a.itemKey,a.measure.familyKey,a.measure.skillId,a.verdict,a.exposure,a.assisted,a.independent]);
 const d1=coach.followups().items.filter(r=>r.gameId==='world-life').map(r=>[r.window,r.status,r.outcome??null]);
 return {attempts,d1,events:coach.events(),snapshot:progress.exportSnapshot(),tick};
}
const liveRun=mirror(live,liveContent,liveProgress),sourceRun=mirror(source,sourceContent,sourceProgress);
check('거울 시도 · 판정 · 계열이 원천 판과 같다',()=>{
 assert.equal(liveRun.attempts.length,4);assert.deepEqual(liveRun.attempts,sourceRun.attempts);
 assert.ok(liveRun.attempts.some(a=>a[3]==='correct')&&liveRun.attempts.some(a=>a[3]==='incorrect'),'판정 자격 있는 문항이 근거가 된다');
});
check('재확인 줄이 원천 판과 같다',()=>assert.deepEqual(liveRun.d1,sourceRun.d1));

// 3. 이번 주 활동 · 출처 이름(위치 묶음의 생활 줄).
check('이번 주 활동: 생활 거울은 읽기로 다시 세지 않는다',()=>{
 const week={start:START-DAY,end:START+6*DAY};
 const a=live.worldPosition.exam.weekActivity({events:liveRun.events,progress:liveRun.snapshot,week});
 const b=source.position.exam.weekActivity({events:sourceRun.events,progress:sourceRun.snapshot,week});
 assert.equal(a.reading,0);assert.deepEqual(a,b);
});
check('출처 이름: world-life = 생활 한국어 줄',()=>{
 const view=side=>side.createView({t:key=>key,has:()=>true});
 assert.equal(view(live.worldPosition).itemSource('life.cafe-expressions-order','world-life'),'position.source.life');
 assert.equal(view(source.position).itemSource('life.cafe-expressions-order','world-life'),'position.source.life');
});

// 4. 홈 계획: 생활 레슨 · 복습 후보의 targets와 고른 길(검수 F1 · FA1 · FA3 꼴).
function profile(side,{help=false,wrongFirst=false,lessons=['greetings-expressions']}={}){
 const values=new Map(),coach=side.worldLearning.engine.createGame({gameId:'d-pub-plan',storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))},clock:()=>new Date(START).toISOString()});
 for(const id of lessons){const lesson=sourceContent.LESSONS.find(l=>l.id===id);lesson.questions.forEach((q,i)=>{const item=side.worldLearning.life.lifeItem({lesson,question:q});if(!item||item.confounded)return;
  const pid=coach.present({id:item.id,itemKey:item.itemKey,familyKey:item.familyKey,skillId:item.skillId,modality:item.modality,difficulty:item.difficulty,responseFormat:item.responseFormat,audioRequired:false,confounded:false});
  if(help)coach.help(pid,'explanation');coach.answer(pid,{correct:!(wrongFirst&&i===0),assessable:true});});}
 return coach.summary();
}
const empty=()=>({version:1,owner:'d',revision:0,activeLessonId:null,activeReview:null,lessons:{},reviews:{}});
function withDueReview(due){
 const p=empty(),lesson=sourceContent.LESSONS.find(l=>l.id==='greetings-expressions'),q=lesson.questions[0],at=START-DAY;
 p.lessons[lesson.id]={startedAt:at-1000,completedAt:at+1,answers:{[q.id]:{correct:true,helped:true,at,choiceId:'a'}},questionIds:lesson.questions.map(x=>x.id)};
 p.reviews[q.review.id]={id:q.review.id,questionId:q.id,lessonId:lesson.id,packId:lesson.packId,skillId:q.skillId,dueAt:due,lastAt:at,streak:0,lapses:1,intervalDays:0};
 return p;
}
const plan=(side,options)=>side.createWorldLearningPlan({now:START,recommendActivities:side.worldLearning.recommendActivities,settings:{reasons:['travel'],support:'step'},...options});
const shape=result=>({selected:result.selected?.route??null,reason:result.reason??null,reasons:[...(result.reasons||[])],life:result.candidates.filter(c=>c.route==='lesson'||c.route==='review').map(c=>[c.id,c.targets.map(t=>t.itemKey)])});
for(const [name,options] of [
 ['FA1 돌아온 복습이 레슨보다 앞',{progress:withDueReview(START-1000),summaryOf:side=>profile(side,{help:true})}],
 ['FA1 복습이 없으면 놓친 칸 레슨을 당김',{progress:withDueReview(START+DAY),summaryOf:side=>profile(side,{help:true})}],
 ['F1 첫 레슨 뒤에도 생활 레슨이 먼저',{progress:empty(),summaryOf:side=>profile(side)}],
 ['FA3 틀린 답이 있는 확인 중 칸은 당김',{progress:empty(),summaryOf:side=>profile(side,{wrongFirst:true})}],
]){
 check(`계획: ${name}`,()=>{
  const a=shape(plan(live,{progress:structuredClone(options.progress),summary:options.summaryOf(live)}));
  const b=shape(plan(source,{progress:structuredClone(options.progress),summary:options.summaryOf(source)}));
  assert.deepEqual(a,b);
 });
}
check('계획: 장면 레슨 · 기록 없는 칸은 targets가 없고 복습은 늘 싣는다',()=>{
 const result=plan(live,{progress:withDueReview(START-1000),summary:profile(live,{help:true})});
 assert.ok(result.candidates.find(c=>c.route==='review').targets.length>0);
 assert.ok(result.candidates.filter(c=>c.route==='lesson').every(c=>c.targets.length===0));
});

console.log(JSON.stringify({ok:true,checks},null,1));
