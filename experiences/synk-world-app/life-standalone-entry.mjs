import {createLifeProgress} from './life-progress.mjs';
import {createLifeExperience} from './life-ui.mjs';
import worldLearning from '../../atlas/game-browser.js';
import {createWorldLearningPlan} from './world-learning-plan.mjs';
import {createWorldEducation} from './world-learning-ui.mjs';
export function setupLife(home,asset){
 let ui,education;
 const progress=createLifeProgress({owner:'guest',now:()=>Date.now(),onChange:()=>ui?.refresh()});
 ui=createLifeExperience({home,getProgress:()=>progress,asset,onSummary:()=>education?.refresh(),onNext:()=>education?.next()});
 education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:createWorldLearningPlan,launchGame:home.openLearningGame,startLesson:ui.start,startReview:ui.reviewStart,target:window});
 home.connectEducation(education);education.refresh();
 window.__synkEducation=education;
 window.__synkLife=ui;
 return ui;
}
