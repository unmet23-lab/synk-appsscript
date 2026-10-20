// 10-20 TOPIK 맞춤 재설계 합성 학생 시뮬레이션(완료 기준 확인용 보조 · 시험은 ../topik-personalization.test.mjs).
// 실제 Core(atlas/learning.js)·Trail 코치·짧은 진단 문항·생활 진도·읽기 짧은 연습·시험 계획을 그대로 돌려, 학생 유형마다
// 첫 추천·첫 실제 문항·이유 한 줄·이번 주 계획을 표로 찍는다. 화면·서버·네트워크는 쓰지 않는다. 문항 검수 판정은 대역(읽기 모두 통과).
// node experiences/synk-world-app/qa/topik-personalization-review-20261020/simulate-redesign.mjs > 시뮬레이션_결과.md
import {createRequire} from 'node:module';
import {createWorldLearningPlan,positionCheckCandidate} from '../../world-learning-plan.mjs';
import {DIAGNOSTIC_ITEMS} from '../../world-diagnostic-items.mjs';
import * as position from '../../world-position.mjs';
import * as practice from '../../world-reading-practice.mjs';
import * as exam from '../../world-exam-plan.mjs';
import {createLifeProgress} from '../../life-progress.mjs';
import {PACKS,LESSONS} from '../../life-content.mjs';
const require=createRequire(import.meta.url);
const browser=require('../../../../atlas/game-browser.js');
const Learning=require('../../../../atlas/learning.js');
const DAY=86400000,MONDAY=Date.UTC(2026,9,19,0)-9*3600000;
const memory=()=>{const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
const POOL=practice.practicePool({items:DIAGNOSTIC_ITEMS,verdicts:{version:'topik-existing-verdicts-1',items:DIAGNOSTIC_ITEMS.filter(i=>i.modality==='reading').map(i=>({itemKey:i.itemKey,verdict:'pass',skillId:i.skillId,difficulty:i.difficulty,responseFormat:i.responseFormat??'unknown',familyKey:i.familyKey||i.itemKey}))}});
const LISTENING={'ko.listening.detail':['world.play.runner'],'ko.listening.negation':['world.play.runner'],'ko.listening.sequence':['world.play.runner'],'ko.listening.reason':['world.play.rhythm'],'ko.listening.condition':['world.play.rhythm'],'ko.listening.main':['world.play.rhythm']};
function student(){
 let clock=MONDAY+DAY,n=0;const storage=memory(),at=()=>new Date(clock).toISOString();
 const coach=browser.engine.createGame({gameId:'world-home',storage,clock:at}),drill=browser.engine.createGame({gameId:'world-practice',storage,clock:at});
 const life=createLifeProgress({storage,owner:'sim',now:()=>clock,uuid:()=>`sim-${++n}`});life.summary(PACKS,LESSONS);
 return {coach,drill,life,now:()=>clock,tick(){clock+=1000;}};
}
function diagnose(s,wrong){
 const plan=position.selectDiagnostic({summary:s.coach.summary(),items:DIAGNOSTIC_ITEMS,seen:i=>s.coach.exposure(i).seen,audioAvailable:true});
 const run=position.createDiagnosticSession({coach:s.coach,items:plan.items});
 for(let v=run.next();v;v=run.next()){s.tick();if(v.audio==='pending')run.delivery('completed');run.answer(wrong(v.item)?v.item.choices.find(c=>c.id!==v.item.correctId).id:v.item.correctId);}
}
function recommend(s,examPlan=null){
 const summary=s.coach.summary(),seen=i=>s.coach.exposure(i).seen;
 return createWorldLearningPlan({summary,progress:s.life.exportSnapshot(),settings:{reasons:['exam'],primaryReason:'exam'},now:s.now(),examPlan,
  // 화면(world-learning-ui.mjs planWith)과 같다: 시험을 고른 사람에게는 새 문항이 남은 짧은 진단도 후보다.
  extra:[...(examPlan&&position.selectDiagnostic({summary,items:DIAGNOSTIC_ITEMS,seen,audioAvailable:true}).status==='ready'?[positionCheckCandidate()]:[]),...practice.practiceCandidates({pool:POOL,seen,summary})],recommendActivities:input=>s.coach.recommendActivities(input.candidates,{settings:input.settings,at:input.at})});
}
const label=(s,id)=>s.coach.summary().skills.find(k=>k.id===id)?.label||id;
const rows=[];
for(const [name,wrong]of [['듣기 강 · 읽기 약',i=>i.modality==='reading'],['읽기 강 · 듣기 약',i=>i.modality==='listening'],['처음 온 학생',null]]){
 const s=student();if(wrong){diagnose(s,wrong);diagnose(s,wrong);}
 const summary=s.coach.summary(),seen=i=>s.coach.exposure(i).seen;
 for(const weeks of [4,12])for(const weekly of [30,120]){
  const date=new Date(MONDAY+weeks*7*DAY+9*3600000).toISOString().slice(0,10);
  const info=exam.examInfo({reasons:['exam'],primaryReason:'exam',examType:'topik1',targetGrade:2,examDate:date,examMode:'pbt',weeklyMinutes:weekly});
  const plan=exam.buildExamPlan({exam:info,summary,now:s.now(),done:exam.weekActivity({events:s.coach.events(),progress:s.life.exportSnapshot(),week:exam.examWeek(s.now())}),
   available:{reading:practice.practiceSupply({pool:POOL,seen}),listening:LISTENING,recheck:15,life:true}});
  const pick=recommend(s,plan),selected=pick.selected;
  const first=selected.route==='practice'?practice.selectPractice({summary:s.drill.summary(),pool:POOL,seen:i=>s.drill.exposure(i).seen,skillId:selected.skillId}).items[0]?.skillId
   :selected.route==='game'?Learning.recommend({profile:summary,candidates:selected.targets}).selected?.skillIds?.[0]:selected.route;
  rows.push([name,`${weeks}주 전`,`주 ${weekly}분`,`${plan.sessions.total}번 · ${plan.sessions.minutes}분`,plan.areas.map(a=>`${a.area} ${a.planned}`).join(', '),
   plan.homework.map(h=>`${label(s,h.skillId)}${h.shortage?'(모자람)':''}`).join(', ')||'—',plan.checks.length,selected.label,first&&first.startsWith('ko.')?label(s,first):first,pick.reason]);
 }
}
console.log('# 합성 학생 시뮬레이션 — 10-20 TOPIK 맞춤 재설계\n');
console.log(`> ${new Date().toISOString().slice(0,10)} 실행 · \`node experiences/synk-world-app/qa/topik-personalization-review-20261020/simulate-redesign.mjs\`. 실제 Core·Trail·진단 문항·생활 진도·읽기 짧은 연습·시험 계획 모듈. 문항 검수 판정은 대역(읽기 문항 모두 통과 — 실제 목록은 ② 세션이 채운다). 학생은 짧은 진단을 두 번(약한 영역만 틀리게) 푼 뒤의 상태다. 학습 효과·만족도를 잰 것이 아니다.\n`);
console.log('| 학생 | 시험까지 | 주당 시간 | 이번 주 | 영역 배분(계획 횟수) | 숙제 묶음(다시 볼 항목) | 다시 확인 일정(앞으로 3번 중) | 홈 추천 | 첫 실제 문항의 항목 | 이유 한 줄 |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for(const row of rows)console.log(`| ${row.join(' | ')} |`);
