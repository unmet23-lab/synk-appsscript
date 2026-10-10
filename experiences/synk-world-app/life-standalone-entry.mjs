import {createLifeProgress} from './life-progress.mjs';
import {createLifeExperience} from './life-ui.mjs';
export function setupLife(home,asset){
 let ui;
 const progress=createLifeProgress({owner:'guest',now:()=>Date.now(),onChange:()=>ui?.refresh()});
 ui=createLifeExperience({home,getProgress:()=>progress,asset});
 window.__synkLife=ui;
 return ui;
}
