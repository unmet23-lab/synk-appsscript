import {TUTOR_IDS} from './tutor-choice.mjs';
import {KEY_ACTIONS} from '../korean-runner/controls.mjs';

// A safe control rehearsal. It never creates learning evidence or awards coins.
export const PRACTICES={
 runner:{title:'바람길',steps:[
  {id:'left',title:'왼쪽으로 한 칸',action:'left'},
  {id:'right',title:'오른쪽으로 한 칸',action:'right'},
  {id:'jump',title:'위로 폴짝',action:'jump'},
  {id:'slide',title:'아래로 쏙',action:'slide'},
  {id:'listen',title:'끝까지 듣고 움직이기',action:'left',audio:'runner'}
 ]},
 rhythm:{title:'말의 리듬',steps:[
  {id:'left',title:'왼쪽 단추 만나기',action:'left'},
  {id:'right',title:'오른쪽 단추 만나기',action:'right'},
  {id:'beat',title:'듣고, O를 선에서 누르기',action:'left',audio:'rhythm',timed:true},
  {id:'beat-x',title:'이번에는 X로 고르기',action:'right',audio:'rhythm',timed:true}
 ]},
 hangul:{title:'한글 만나기',steps:[
  {id:'listen',title:'소리 듣고 고르기',action:'a',audio:'hangul'},
  {id:'next',title:'다음으로 이어가기',action:'next'}
 ]},
 first:{title:'첫 문장 놀이',steps:[
  {id:'choose',title:'어울리는 답 고르기',action:'hello'},
  {id:'next',title:'다음 문장으로',action:'next'}
 ]}
};
export const BEAT_PERIOD=2600,BEAT_AT=2100,BEAT_WINDOW=360;
const EXTRAS={runner:{middle:{id:'middle',title:'가운데로 한 칸',action:'right',startPose:'left',pose:'middle'},stay:{id:'stay',title:'그대로 기다리기',action:'stay',quiet:2100}},rhythm:{'beat-left':{id:'beat-left',title:'왼쪽 단추, 선에서 누르기',action:'left',timed:true},'beat-right':{id:'beat-right',title:'오른쪽 단추, 선에서 누르기',action:'right',timed:true},'hold-left':{id:'hold-left',title:'왼쪽 긴 노트 끝까지',action:'left',hold:1200},'hold-right':{id:'hold-right',title:'오른쪽 긴 노트 끝까지',action:'right',hold:1200}}};
export function practiceStep(game,id){return PRACTICES[game]?.steps.find(s=>s.id===id)||Object.hasOwn(EXTRAS[game]||{},id)&&EXTRAS[game][id]||null;}
export function beatPosition(now,start){return ((Math.max(0,now-start)%BEAT_PERIOD)/BEAT_PERIOD);}
export function inputForKey(game,code){
 if(game==='runner')return KEY_ACTIONS[code]||null;
 if(game==='rhythm')return ({KeyF:'left',ArrowLeft:'left',KeyJ:'right',ArrowRight:'right'})[code]||null;
 return null;
}
export class PracticeRun{
 constructor(game,{steps=null,timed=false}={}){
  if(!PRACTICES[game])throw new TypeError('Unknown game');
  if(steps!==null&&(!Array.isArray(steps)||!steps.length||steps.length>8||new Set(steps).size!==steps.length||steps.some(id=>!practiceStep(game,id))))throw new TypeError('Unknown practice steps');
  this.game=game;this.fullIntro=steps===null&&!timed;this.steps=(steps?steps.map(id=>practiceStep(game,id)):PRACTICES[game].steps).map(s=>({...s,...(timed&&!s.quiet&&!s.hold?{timed:true}:{})}));
  this.index=0;this.phase='demo';this.heard=false;this.cycleStart=0;this.passed=[];this.holding=null;
 }
 get step(){return this.steps[this.index];}
 demonstrate(){if(this.phase==='complete')return false;this.phase='demo';this.heard=false;this.holding=null;return true;}
 tryIt(now,{heard=false}={}){if(this.phase!=='demo'||this.step.audio&&!heard)return false;this.heard=heard;this.phase='try';this.cycleStart=now;this.holding=null;return true;}
 pass(){this.phase='success';this.passed[this.index]=this.step.id;return {accepted:true,correct:true};}
 input(action,now){
  if(this.phase!=='try')return {accepted:false};
  if(this.step.quiet){if(action==='stay')return {accepted:false};this.cycleStart=now;return {accepted:true,correct:false,reason:'direction'};}
  if(action!==this.step.action)return {accepted:true,correct:false,reason:'direction'};
  if(this.step.hold){if(this.holding!==null)return {accepted:false};this.holding=now;return {accepted:true,correct:null,holding:true};}
  if(this.step.timed&&Math.abs(beatPosition(now,this.cycleStart)*BEAT_PERIOD-BEAT_AT)>BEAT_WINDOW)return {accepted:true,correct:false,reason:'timing'};
  return this.pass();
 }
 release(action,now){if(this.phase!=='try'||!this.step.hold||action!==this.step.action||this.holding===null)return {accepted:false};const held=now-this.holding;this.holding=null;return held>=this.step.hold?this.pass():{accepted:true,correct:false,reason:'direction'};}
 wait(now){return this.phase==='try'&&this.step.quiet&&now-this.cycleStart>=this.step.quiet?this.pass():{accepted:false};}
 next(){
  if(this.phase!=='success')return false;
  if(this.index===this.steps.length-1){this.phase='complete';return true;}
  this.index++;this.heard=false;this.phase='demo';return true;
 }
 get complete(){return this.phase==='complete'&&this.passed.length===this.steps.length&&this.passed.every((id,i)=>id===this.steps[i].id);}
}
export const practiceKey=(owner,tutor,game)=>`synk.world.tutor.practice.v1:${encodeURIComponent(owner||'guest')}:${tutor}:${game}`;
export function readPractice(storage,owner,tutor,game){
 if(!TUTOR_IDS.includes(tutor)||!PRACTICES[game])return false;
 try{const value=JSON.parse(storage?.getItem(practiceKey(owner,tutor,game))||'null');return value?.version===1&&value.completed===true&&value.tutor===tutor&&value.game===game;}catch{return false;}
}
export function savePractice(storage,owner,tutor,run){
 if(!TUTOR_IDS.includes(tutor)||!run?.complete||!run.fullIntro)return false;
 try{storage.setItem(practiceKey(owner,tutor,run.game),JSON.stringify({version:1,completed:true,tutor,game:run.game}));return true;}catch{return false;}
}
