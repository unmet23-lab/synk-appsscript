// 10-19 고장 묶음 6번 합성 실행: TOPIK 목표 학습자가 첫날 바람길 확인 문항 12개를 다 맞힌 뒤 30일 동안 하루 세 번 「다음 연습」을 누른다.
// 실제 생활 진도·추천(world-learning-plan.mjs)·Core(atlas)를 쓰고, 뽑힌 놀이는 같은 학습 기록(coach)에 문항을 내고 맞힌 것으로 흉내 낸다
// (바람길은 이미 낸 확인 문항을 다시 낸다 — 실제 게임도 새 문항이 없으면 그렇다). 레슨·복습은 모두 혼자 맞힌다.
//   before: 10-19 전 홈 — Core에 프로필만 넘긴다(이미 낸 문항을 모른다).
//   after : 고친 홈 — 코치의 recommendActivities로 이미 낸 문항까지 넘긴다(바닥난 활동은 급함 층에서 빠진다).
// 사용: node experiences/synk-world-app/qa/review-loop-20261019/topik-runner.mjs [--json 결과파일]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createLifeProgress} from '../../life-progress.mjs';
import {createWorldLearningPlan} from '../../world-learning-plan.mjs';
import {PACKS,LESSONS} from '../../life-content.mjs';
import {LISTENING_CHECKS,checkMetadata} from '../../../korean-runner/listening-check.mjs';
import {RHYTHM_CANDIDATES} from '../../../korean-rhythm/personalization.mjs';
const require=createRequire(import.meta.url);
const Learning=require('../../../../atlas/learning.js');
const browser=require('../../../../atlas/game-browser.js');
const HOUR=3600000,DAY=24*HOUR,START=Date.parse('2026-10-19T00:00:00+09:00'),TIMES=[9,13,20];
const settings={reasons:['exam'],primaryReason:'exam'};
const lessonById=id=>LESSONS.find(l=>l.id===id);
export function runTopik(mode,days=30){
 let tick=START,sequence=0;
 const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
 const progress=createLifeProgress({storage:memory(),owner:`topik-${mode}`,now:()=>tick,uuid:()=>`topik-${++sequence}`});
 progress.summary(PACKS,LESSONS);
 const coach=browser.engine.createGame({gameId:'world-home',storage:memory(),clock:()=>new Date(tick).toISOString()});
 const present=(meta,correct=true)=>{tick+=1000;const pid=coach.present(meta);coach.delivery(pid,{audio:'completed'});coach.answer(pid,{correct,assessable:true});};
 const runnerItems=LISTENING_CHECKS.map(checkMetadata);let runnerTurn=0;
 const playRunner=()=>{for(let i=0;i<3;i++)present(runnerItems[runnerTurn++%runnerItems.length]);};
 const playRhythm=trackId=>{const track=RHYTHM_CANDIDATES.find(c=>c.trackId===trackId)||RHYTHM_CANDIDATES[0];
  for(const [i,family] of track.familyKeys.entries())present({id:`${track.id}-q${i}`,itemKey:family,familyKey:family,skillId:track.skillIds[i%track.skillIds.length],modality:'listening',difficulty:track.difficulty,responseFormat:track.responseFormat,audioRequired:true,confounded:false});};
 // Day 0 before the first press: the whole 바람길 check set, all correct and independent, and two life lessons
 // the person opened from 배우기 themselves (their reviews come due the next day).
 tick=START+8*HOUR;for(let i=0;i<4;i++)playRunner();
 for(const id of ['greetings-expressions','cafe-expressions']){const l=lessonById(id);progress.startLesson(l);for(const q of l.questions){tick+=20000;progress.recordAnswer({lessonId:id,questionId:q.id,correct:true,choiceId:q.answerId});}progress.finishLesson(id);}
 const waits=new Map(),log=[];let runner=0,rhythm=0,hangul=0;
 for(let day=0;day<days;day++)for(const hour of TIMES){
  tick=START+day*DAY+hour*HOUR;
  const snap=progress.exportSnapshot();
  for(const r of Object.values(snap.reviews))if(r.dueAt<=tick&&!waits.has(`${r.id}@${r.dueAt}`))waits.set(`${r.id}@${r.dueAt}`,{id:r.id,dueAt:r.dueAt,doneAt:null});
  const recommendActivities=mode==='after'?input=>coach.recommendActivities(input.candidates,{settings:input.settings,at:input.at}):Learning.recommendActivities;
  const plan=createWorldLearningPlan({summary:coach.summary(),progress:snap,settings,now:tick,recommendActivities});
  const s=plan.selected;log.push({day:day+1,hour,route:s?.route||null,id:s?.id||null});
  if(s?.route==='game'){if(s.gameId==='runner'){runner++;playRunner();}else if(s.gameId==='rhythm'){rhythm++;playRhythm(rhythm%3);}else hangul++;}
  else if(s?.route==='lesson'){const l=lessonById(s.lessonId);progress.startLesson(l);for(const q of l.questions){if(progress.lessonState(l.id).answers[q.id])continue;tick+=20000;progress.recordAnswer({lessonId:l.id,questionId:q.id,correct:true,choiceId:q.answerId});}progress.finishLesson(l.id);}
  else if(s?.route==='review'){const ids=s.reviewIds||null,run=progress.startReview(ids?Math.min(6,ids.length):6,ids?.[0]||null,ids);
   for(const id of run?.ids||[]){const before=progress.exportSnapshot().reviews[id];tick+=20000;progress.answerReview({id,runId:run.id,correct:true});const w=waits.get(`${id}@${before.dueAt}`);if(w&&w.doneAt===null)w.doneAt=tick;}}
 }
 const end=tick,delays=[...waits.values()].map(w=>((w.doneAt??end)-w.dueAt)/DAY);
 return {mode,days,presses:log.length,runnerPresses:runner,rhythmPresses:rhythm,hangulPresses:hangul,lessonPresses:log.filter(p=>p.route==='lesson').length,reviewPresses:log.filter(p=>p.route==='review').length,
  completedLessons:progress.summary(PACKS,LESSONS).completed,dueReviews:waits.size,unansweredDue:[...waits.values()].filter(w=>w.doneAt===null).length,maxReviewWaitDays:Math.round(Math.max(0,...delays)*10)/10,log};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result={scenario:'TOPIK goal, all 12 바람길 checks and two life lessons on day 1, then 30 days x 3 presses (09/13/20 KST)',startedAt:new Date(START).toISOString(),runs:['before','after'].map(mode=>runTopik(mode))};
 for(const r of result.runs)console.log(`${r.mode.padEnd(6)} 바람길 ${String(r.runnerPresses).padStart(2)} · 리듬 ${String(r.rhythmPresses).padStart(2)} · 한글 ${r.hangulPresses} · 레슨 ${String(r.lessonPresses).padStart(2)}(마침 ${r.completedLessons}) · 복습 ${String(r.reviewPresses).padStart(2)} · 예정 복습 ${r.dueReviews}개 중 못 한 것 ${r.unansweredDue} · 가장 오래 밀린 복습 ${r.maxReviewWaitDays}일`);
 const out=process.argv.includes('--json')?process.argv[process.argv.indexOf('--json')+1]:null;
 if(out)fs.writeFileSync(out,JSON.stringify(result,null,1)+'\n');
}
