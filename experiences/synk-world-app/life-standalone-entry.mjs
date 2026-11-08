import {createLifeProgress} from './life-progress.mjs';
import {createLifeExperience} from './life-ui.mjs';
// WORLD 코치는 TOPIK I·II를 합친 지도로(world-learning-map.mjs, 10-21 ④).
import {worldLearning} from './world-learning-map.mjs';
import {createWorldLearningPlan} from './world-learning-plan.mjs';
import {createWorldEducation} from './world-learning-ui.mjs';
import {worldPosition} from './world-position-kit.mjs';
export function setupLife(home,asset){
 let ui,education;
 const progress=createLifeProgress({owner:'guest',now:()=>Date.now(),onChange:()=>ui?.refresh()});
 // learning: 배움의 거울(Atlas × WORLD D, 11-08) — 생활 화면이 먼저 서므로 학습 호스트는 늦게 읽는다.
 ui=createLifeExperience({home,getProgress:()=>progress,asset,onSummary:()=>education?.refresh(),onNext:()=>education?.next(),presentation:()=>education?.presentation(),positionTotal:()=>education?.positionTotal?.(),
  learning:{coach:()=>education?.lifeLearning?.coach()??null,prepare:()=>education?.lifeLearning?.prepare(),life:worldLearning.life}});
 // 내 위치: asset은 brand-opening/assets/ 기준이라 두 칸 올라가 게임 폴더의 녹음을 부른다.
 education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:createWorldLearningPlan,launchGame:home.openLearningGame,startLesson:ui.start,startReview:ui.reviewStart,
  position:worldPosition,audioUrl:path=>asset(`../../${path}`),target:window});
 home.connectEducation(education);education.refresh();
 window.__synkEducation=education;
 window.__synkLife=ui;
 return ui;
}
