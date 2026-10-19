// 10-19 고장 묶음 1번 합성 시나리오: 「한 단계씩 도움받기」 학습자가 8일 동안 하루 세 번(09·13·20시 KST) 「다음 연습」을 누른다.
// 실제 생활 콘텐츠·진도(life-progress.mjs)·추천(world-learning-plan.mjs + Core recommendActivities)을 그대로 돌리고, 화면(life-ui.mjs)이
// 하는 일만 흉내 낸다: 레슨 문제는 설정이 도움을 먼저 펼치고(출처 setting), 모든 답은 맞힌다. 게임이 뽑히면 놀지 않고 넘긴다.
//   before: 10-19 전 화면 — 도움 출처를 넘기지 않고(사람이 연 도움처럼 셈) 복습에서도 도움을 먼저 펼친다.
//   after : 고친 화면 — 레슨의 설정 도움은 출처 setting, 복습은 먼저 혼자 고른다.
//   choose: 대조군 — 「골라 보며 익히기」(도움 없음).
// 사용: node experiences/synk-world-app/qa/review-loop-20261019/scenario.mjs [--json 결과파일]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createLifeProgress} from '../../life-progress.mjs';
import {createWorldLearningPlan} from '../../world-learning-plan.mjs';
import {PACKS,LESSONS} from '../../life-content.mjs';
const require=createRequire(import.meta.url);
const Learning=require('../../../../atlas/learning.js');
const HOUR=3600000,DAY=24*HOUR,START=Date.parse('2026-10-19T00:00:00+09:00'),TIMES=[9,13,20];
const lessonById=id=>LESSONS.find(l=>l.id===id);
export function runScenario(mode){
 let tick=START,sequence=0;const values=new Map();
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
 const progress=createLifeProgress({storage,owner:`scenario-${mode}`,now:()=>tick,uuid:()=>`scenario-${++sequence}`});
 progress.summary(PACKS,LESSONS);
 const settings=mode==='choose'?{support:'choose'}:{support:'step'};
 const presses=[],firstReviews=lessonById('greetings-expressions').questions.map(q=>q.review.id),intervals=Object.fromEntries(firstReviews.map(id=>[id,[]]));
 for(let day=0;day<8;day++)for(const hour of TIMES){
  tick=START+day*DAY+(hour-0)*HOUR;
  const plan=createWorldLearningPlan({progress:progress.exportSnapshot(),settings,now:tick,recommendActivities:Learning.recommendActivities});
  const s=plan.selected,row={day:day+1,hour,route:s?.route||null,label:s?.label||null};
  if(s?.route==='lesson'){
   const lesson=lessonById(s.lessonId);progress.startLesson(lesson);
   for(const q of lesson.questions){
    if(progress.lessonState(lesson.id).answers[q.id])continue;
    tick+=20000;
    const help=mode==='choose'?{helped:false}:mode==='after'?{helped:true,helpSource:'setting'}:{helped:true};
    progress.recordAnswer({lessonId:lesson.id,questionId:q.id,correct:true,choiceId:q.answerId,...help});
   }
   progress.finishLesson(lesson.id);
  }else if(s?.route==='review'){
   const ids=s.reviewIds||null,review=progress.startReview(ids?Math.min(6,ids.length):6,ids?.[0]||null,ids);
   row.reviewIds=review?.ids||[];
   for(const id of review?.ids||[]){
    tick+=20000;
    if(mode==='before')progress.markReviewHelp(id); // the old screen opened help before the answer in reviews too
    progress.answerReview({id,runId:review.id,correct:true,helped:false});
   }
  }else row.skipped=true; // a game: not played in this synthetic run
  const snap=progress.exportSnapshot();
  for(const id of firstReviews){const r=snap.reviews[id];if(r&&intervals[id].at(-1)!==r.intervalDays)intervals[id].push(r.intervalDays);}
  presses.push(row);
 }
 const s=progress.summary(PACKS,LESSONS),reviewPresses=presses.filter(p=>p.route==='review');
 const sameReview=reviewPresses.length?Math.max(...Object.values(reviewPresses.reduce((n,p)=>{const k=p.reviewIds.join(',');n[k]=(n[k]||0)+1;return n;},{}))):0;
 return {mode,completedLessons:s.completed,reviewPresses:reviewPresses.length,lessonPresses:presses.filter(p=>p.route==='lesson').length,skippedGames:presses.filter(p=>p.skipped).length,
  mostRepeatedReview:sameReview,firstLessonIntervals:intervals,presses};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result={scenario:'step support, 8 days x 3 presses (09/13/20 KST), every answer correct',startedAt:new Date(START).toISOString(),
  runs:['before','after','choose'].map(runScenario)};
 for(const r of result.runs)console.log(`${r.mode.padEnd(6)} lessons ${String(r.completedLessons).padStart(2)} · review presses ${String(r.reviewPresses).padStart(2)} (same batch up to ${r.mostRepeatedReview}) · games skipped ${r.skippedGames} · first lesson intervals ${JSON.stringify(Object.values(r.firstLessonIntervals))}`);
 const out=process.argv.includes('--json')?process.argv[process.argv.indexOf('--json')+1]:null;
 if(out)fs.writeFileSync(out,JSON.stringify(result,null,1)+'\n');
}
