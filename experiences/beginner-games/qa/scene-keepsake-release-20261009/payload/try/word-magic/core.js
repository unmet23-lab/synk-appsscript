import {SPELLS,CHAPTERS,PUZZLES,LAB_OBJECTS,LAB_SETS} from './content.js';
import {normalizeKeepsakes} from './keepsakes.js';
export const SAVE_KEY='synk.word-magic.progress.v1';
export const clone=x=>JSON.parse(JSON.stringify(x));
export function initialProgress(){return {version:1,completed:[],introduced:[],checks:[],last:0,language:'en',lab:clone(LAB_OBJECTS),labs:Object.fromEntries(Object.entries(LAB_SETS).map(([id,set])=>[id,clone(set.objects)])),labSet:'default',adventureResume:null,resume:null,keepsakes:[]};}
export function restoreProgress(raw){
 let v;try{v=typeof raw==='string'?JSON.parse(raw):raw;}catch{return initialProgress();}
 const p=initialProgress();if(!v||v.version!==1)return p;
 p.completed=[...new Set((Array.isArray(v.completed)?v.completed:[]).filter(id=>PUZZLES.some(x=>x.id===id)))];
 // Do not let malformed future progress bypass earlier chapters.
 p.introduced=[...new Set((Array.isArray(v.introduced)?v.introduced:[]).filter(id=>CHAPTERS.some(x=>x.id===id)))];
 p.checks=(Array.isArray(v.checks)?v.checks:[]).filter(x=>x&&Object.hasOwn(SPELLS,x.spell)&&typeof x.correct==='boolean').slice(-60);
 p.last=Math.min(PUZZLES.length-1,Math.max(0,Number.isInteger(v.last)?v.last:0));
 p.language=v.language==='ko'?'ko':'en';
 p.keepsakes=normalizeKeepsakes(v.keepsakes);
 for(const [id,set] of Object.entries(LAB_SETS))p.labs[id]=safeObjects(set.objects,v.labs?.[id]||(id==='default'?v.lab:null));p.lab=clone(p.labs.default);p.labSet=Object.hasOwn(LAB_SETS,v.labSet)?v.labSet:'default';
 p.resume=restoreResume(v.resume,p);const adventure=restoreResume(v.adventureResume,p);p.adventureResume=adventure&&['tutorial','puzzle','checkpoint'].includes(adventure.screen)&&!adventure.pendingLab?adventure:null;return p;
}
const safeObjects=(base,input)=>base.map(o=>{const v=Array.isArray(input)?input.find(x=>x?.id===o.id):null;return {...o,size:[.62,1,1.55].includes(v?.size)?v.size:o.size,open:typeof v?.open==='boolean'?v.open:o.open,level:[0,1].includes(v?.level)?v.level:o.level};});
export function tutorialObject(chapter){return {id:'teacher',asset:CHAPTERS[chapter].object,x:505,y:chapter===2?404:360,size:chapter===0?.62:1,open:false,level:0};}
/** Restore only canonical objects and legal transforms. Saved input never supplies assets/positions. */
export function restoreResume(raw,progress){
 if(!raw||!['tutorial','puzzle','checkpoint','ending','lab'].includes(raw.screen)||!Number.isInteger(raw.sceneIndex)||!PUZZLES[raw.sceneIndex])return null;
 const chapter=PUZZLES[raw.sceneIndex].chapter;if(chapter>unlockedChapter(progress))return null;const pair=CHAPTERS[chapter].pair;
 const r={screen:raw.screen,pendingLab:raw.screen==='tutorial'&&raw.pendingLab===true,sceneIndex:raw.sceneIndex,spell:Object.hasOwn(SPELLS,raw.spell)?raw.spell:null,selected:null,tutorSeen:[...new Set((Array.isArray(raw.tutorSeen)?raw.tutorSeen:[]).filter(s=>pair.includes(s)))],objects:[],attempt:0,checkIndex:0,checkRound:[],labSet:Object.hasOwn(LAB_SETS,raw.labSet)?raw.labSet:progress.labSet||'default'};
 if(r.screen==='lab'&&!progress.introduced.length)return null;
 if(r.screen==='puzzle')r.objects=safeObjects(PUZZLES[r.sceneIndex].objects,raw.objects);
 if(r.screen==='tutorial')r.objects=safeObjects([tutorialObject(chapter)],raw.objects);
 if(r.screen==='lab')r.objects=safeObjects(LAB_SETS[r.labSet].objects,progress.labs?.[r.labSet]||(r.labSet==='default'?progress.lab:null));
 if(r.screen==='checkpoint'){
  if(!Array.isArray(raw.checkRound)||raw.checkRound.length!==2||new Set(raw.checkRound.map(q=>q?.spell)).size!==2||raw.checkRound.some(q=>!pair.includes(q?.spell)))return null;
  r.checkRound=raw.checkRound.map(q=>({...checkpoint(chapter,pair.indexOf(q.spell)),choices:Array.isArray(q.choices)&&q.choices.length===2&&new Set(q.choices).size===2&&q.choices.every(s=>pair.includes(s))?[...q.choices]:[...pair]}));
  r.checkIndex=raw.checkIndex===1?1:0;r.check=r.checkRound[r.checkIndex];r.attempt=Math.min(99,Math.max(0,Number.isInteger(raw.attempt)?raw.attempt:0));r.objects=safeObjects([r.check.object],raw.objects);
 }
 if(r.screen!=='lab'&&!pair.includes(r.spell))r.spell=null;
 r.selected=r.objects.some(o=>o.id===raw.selected)?raw.selected:null;return r;
}
export function unlockedChapter(progress){for(let c=0;c<3;c++){if(PUZZLES.filter(p=>p.chapter===c).some(p=>!progress.completed.includes(p.id)))return c;}return 2;}
export function availableSpells(progress){return CHAPTERS.filter(c=>progress.introduced.includes(c.id)).flatMap(c=>c.pair);}
export function canTransform(object,spell){const s=SPELLS[spell];if(!s||!object)return false;return s.property!=='open'||['door','chest','book'].includes(object.asset);}
export function transform(objects,objectId,spell){const next=clone(objects),o=next.find(x=>x.id===objectId);if(!canTransform(o,spell))return {objects:next,changed:false,unsupported:true};const s=SPELLS[spell],changed=o[s.property]!==s.value;o[s.property]=s.value;return {objects:next,changed,unsupported:false};}
export function isSolved(scene,objects){return scene.goals.every(g=>objects.find(o=>o.id===g.id)?.[g.property]===g.value);}
export function complete(progress,scene){return {...progress,completed:[...new Set([...progress.completed,scene.id])],last:Math.min(PUZZLES.length-1,PUZZLES.findIndex(p=>p.id===scene.id)+1)};}
export function nextUnfinished(progress){const i=PUZZLES.findIndex(p=>!progress.completed.includes(p.id));return i<0?0:i;}
/** Discovery and listening confirmation are separate. A first answer completes the
 * confirmation step; correctness/assistance remain in the original check record. */
export function chapterProgress(progress,index){const c=CHAPTERS[index];if(!c)return null;const discoveries=PUZZLES.filter(p=>p.chapter===index&&progress.completed.includes(p.id)).length,confirmed=c.pair.filter(spell=>progress.checks.some(q=>q.spell===spell));return {discoveries,confirmed:confirmed.length,missing:c.pair.filter(spell=>!confirmed.includes(spell)),finished:discoveries===6&&confirmed.length===2};}
export function nextAwaitingCheck(progress){return CHAPTERS.findIndex((_,i)=>{const p=chapterProgress(progress,i);return p.discoveries===6&&p.missing.length>0;});}
export function solution(scene){return scene.goals.map(g=>({objectId:g.id,spell:Object.keys(SPELLS).find(k=>SPELLS[k].property===g.property&&SPELLS[k].value===g.value)}));}
export function checkpoint(chapter,index=0){const c=CHAPTERS[chapter],spell=c.pair[index%2];return {id:`${c.id}-${index}`,meaningKey:`${c.id}.${spell}`,chapter,spell,object:{id:'check-object',asset:chapter===1?'chest':chapter===2?'purse':'rabbit',x:490,y:chapter===2?404:370,size:1,open:false,level:0}};}
/** Draw once per chapter check round. Request order and each choice order are independent;
 * keep both meanings, and never reshuffle while replaying/rendering the same question. */
export function checkpointRound(chapter,random=Math.random){const order=random()<.5?[1,0]:[0,1];return order.map(index=>{const choices=[...CHAPTERS[chapter].pair];if(random()<.5)choices.reverse();return {...checkpoint(chapter,index),choices};});}
/** A heard word must be the only answer cue. Before a first choice, both requests in a
 * pair have byte-identical presentation data: no target, initial object or Korean spelling.
 * Once answered, showing the transformed object and Korean words is corrective teaching. */
export function checkpointView(check,{answered=false,objects=[]}={}){
 return {objects:answered?clone(objects):[],choices:(check.choices||CHAPTERS[check.chapter].pair).map(id=>({id,label:SPELLS[id].en,korean:answered?SPELLS[id].ko:null})),reveal:answered};
}
export function checkAnswer(check,spell,{heard=false,help=false,attempt=0}={}){return {version:2,spell:check.spell,correct:spell===check.spell,assessable:heard&&!help&&attempt===0,heard,help,attempt};}
