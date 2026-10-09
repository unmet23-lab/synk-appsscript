import {SPELLS,CHAPTERS} from './content.js';
import {clone,checkpoint,transform} from './core.js';

/** Optional practice from already introduced words. No progress, reward or assessment
 * is produced here. Prefer a previous missed first choice without creating mastery. */
export function recallRound(progress,random=Math.random){
 const known=CHAPTERS.flatMap((c,chapter)=>progress.introduced.includes(c.id)?c.pair.map((spell,index)=>({spell,chapter,index})):[]);
 const missed=new Set(progress.checks.filter(q=>q.correct===false).map(q=>q.spell));
 const shuffled=known.map(q=>({...q,order:random()})).sort((a,b)=>Number(missed.has(b.spell))-Number(missed.has(a.spell))||a.order-b.order).slice(0,3);
 return shuffled.map(q=>{const check=checkpoint(q.chapter,q.index),choices=[...CHAPTERS[q.chapter].pair];if(random()<.5)choices.reverse();return {...check,id:`recall-${check.meaningKey}`,object:{...check.object,asset:['bear','book','camera'][q.chapter]},choices};});
}
/** Before answering only both alternatives are visible, with no target cue or text. */
export function recallView(check,{answered=false,objects=[]}={}){
 return {objects:answered?clone(objects):[],reveal:answered,choices:check.choices.map(id=>({id,objects:transform([check.object],check.object.id,id).objects,korean:answered?SPELLS[id].ko:null,meaning:answered?SPELLS[id].en:null}))};
}
