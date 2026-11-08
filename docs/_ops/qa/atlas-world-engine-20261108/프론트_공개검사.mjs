// 개인화 화면 프론트 다시 검수(2026-11-08) — 공개본 계정 묶음에 끼운 줄을 실제로 돌린다(D_공개검사.mjs와 같은 방식).
// 프론트_공개묶음.cjs가 만든 check/ 폴더(고친 묶음 · 끼우기 전 공개본 묶음 + 공개본의 D 엔진 판 · 생활 원고 · 진도)에서 묶음을 import하고,
// 같은 일을 이 작업본의 원천 판으로도 해서 시험 계획의 시작점 · 계획 밖 영역 표시 · 이유 문장이 같은지 본다. 다르면 멈춘다(종료 코드 1).
//   node docs/_ops/qa/atlas-world-engine-20261108/프론트_공개검사.mjs <check 폴더>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const dir=path.resolve(process.argv[2]||'');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const at=file=>pathToFileURL(path.join(dir,file)).href,src=file=>pathToFileURL(path.join(ROOT,file)).href;
const live=await import(at('world-account.bundle.mjs')),before=await import(at('live-account.bundle.mjs'));
const liveContent=await import(at('life-content.mjs')),liveProgress=await import(at('life-progress.mjs'));
const source={...await import(src('experiences/synk-world-app/world-learning-map.mjs')),position:(await import(src('experiences/synk-world-app/world-position-kit.mjs'))).worldPosition};
const sourceContent=await import(src('experiences/synk-world-app/life-content.mjs')),sourceProgress=await import(src('experiences/synk-world-app/life-progress.mjs'));
const DAY=86400000,START=Date.UTC(2026,10,9,1);
const checks=[];const check=(name,fn)=>{fn();checks.push(name);};

check('시험 계획 내보내기: examEvidenceSkills가 있고 끼우기 전 공개본에는 없다',()=>{
 assert.equal(typeof live.worldPosition.exam.examEvidenceSkills,'function');
 assert.equal(before.worldPosition.exam.examEvidenceSkills,undefined);
});

// 생활 레슨 한 판을 그 묶음의 생활 거울로 적는다(D_공개검사 mirror와 같은 꼴, 레슨 첫 판만).
function lifeOnly(side,content,progressModule){
 let tick=START,seq=0;const values=new Map(),coachValues=new Map();
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};
 const progress=progressModule.createLifeProgress({storage,owner:'front-pub',now:()=>tick,uuid:()=>`run-${++seq}`});progress.summary(content.PACKS,content.LESSONS);
 const coach=side.worldLearning.engine.createGame({gameId:'world-life',followups:true,storage:{getItem:k=>coachValues.get(k)??null,setItem:(k,v)=>coachValues.set(k,String(v))},clock:()=>new Date(tick).toISOString()});
 const life=side.worldLearning.life,trail=life.createLifeTrail({coach:()=>coach,snapshot:()=>progress.exportSnapshot()});
 const lesson=content.LESSONS.find(l=>l.id==='cafe-expressions'),run=progress.startLesson(lesson);
 for(const q of lesson.questions){
  const slot=life.lessonSlot(run.attemptId,q.id);trail.shown(slot,life.lifeItem({lesson,question:q}));
  const saved=progress.recordAnswer({lessonId:lesson.id,questionId:q.id,choiceId:q.answerId,correct:true,helped:false});
  const stored=saved.answers[q.id];trail.answer(slot,{correct:stored.correct,choiceId:stored.choiceId,correctId:q.answerId,helped:stored.helped});
 }
 progress.finishLesson(lesson.id);
 return {coach,progress,now:tick};
}
function plan(side,run){
 const exam=side.position?side.position.exam:side.worldPosition.exam;
 const info=exam.examInfo({reasons:['exam'],primaryReason:'exam',examType:'topik1',examDate:'2027-04'});
 const events=run.coach.events(),summary=run.coach.summary(),week=exam.examWeek(run.now);
 const done=exam.weekActivity({events,progress:run.progress.exportSnapshot(),week});
 const available={reading:{'ko.reading.detail':3},listening:{},recheck:15,life:true};
 return {with:exam.buildExamPlan({exam:info,summary,now:run.now,done,available,examSkills:exam.examEvidenceSkills(events)}),
  without:exam.buildExamPlan({exam:info,summary,now:run.now,done,available}),skills:[...exam.examEvidenceSkills(events)]};
}
const livePlan=plan(live,lifeOnly(live,liveContent,liveProgress)),sourcePlan=plan(source,lifeOnly(source,sourceContent,sourceProgress));
check('생활 거울만 있으면 시험 계획은 짧은 진단부터(시작점) — 원천 판과 같다',()=>{
 assert.deepEqual(livePlan.skills,[]);assert.ok(livePlan.with.notes.includes('start'));
 assert.equal(livePlan.with.areas.find(row=>row.area==='recheck')?.planned,1);
 assert.ok(!livePlan.without.notes.includes('start'),'examSkills 없이 부르면 끼우기 전 판단 그대로');
 assert.deepEqual(livePlan.with.notes,sourcePlan.with.notes);assert.deepEqual(livePlan.with.areas,sourcePlan.with.areas);
 assert.deepEqual(livePlan.with.reach,sourcePlan.with.reach);
});
check('이번 주 계획: 계획에 없던 생활 레슨은 「N번 함」 — 원천 판과 같다',()=>{
 // 화면 글은 posEscape를 거치므로 따옴표 없는 꼴로 키 · 값을 찍는다.
 const t=(key,values)=>values?`${key}(${Object.entries(values).map(([k,v])=>`${k}=${v}`).join(',')})`:key,view=side=>side.createView({t,has:()=>true});
 const life=livePlan.with.areas.find(row=>row.area==='life');
 assert.ok(life&&life.planned===0&&life.done>=1,`생활 칸: ${JSON.stringify(life)}`);
 const a=view(live.worldPosition).renderExamPlan({plan:livePlan.with}),b=view(source.position).renderExamPlan({plan:sourcePlan.with});
 assert.match(a,/plan\.area\.extraDays\(done=1\)/);assert.doesNotMatch(a,/plan\.area\.count\(done=1,planned=0\)/);assert.equal(a,b);
});
check('홈 이유 문장: 새 글 하나 · 옛 글 없음',()=>{
 const text=fs.readFileSync(path.join(dir,'world-account.bundle.mjs'),'utf8');
 const esc=s=>s.replace(/[^\x00-\x7f]/g,c=>{const n=c.codePointAt(0);return n<0x100?`\\x${n.toString(16).toUpperCase().padStart(2,'0')}`:`\\u${n.toString(16).toUpperCase().padStart(4,'0')}`;});
 assert.equal(text.split(esc('생활 팩의 다음 레슨이에요. 아직 기록이 없는 표현을 새로 만나요.')).length-1,1);
 assert.equal(text.split(esc('진도 순서대로 이어서 배워요')).length-1,0);
});
check('지도판은 끼우기 전 공개본과 같다(이번 공개는 지도를 건드리지 않는다)',()=>{
 const version=side=>side.worldLearning.engine.createGame({gameId:'front-pub-map',storage:null,clock:()=>new Date(START).toISOString()}).mapVersion;
 assert.equal(version(live),version(before));
});
console.log(`프론트 공개 검사 ${checks.length}/${checks.length} 통과: ${checks.join(' · ')}`);
