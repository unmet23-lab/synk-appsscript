import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorldEducation} from '../world-learning-ui.mjs';
import {worldPosition} from '../world-position-kit.mjs';
import {worldLearning} from '../world-learning-map.mjs';
import {createWorldLearningPlan} from '../world-learning-plan.mjs';
worldPosition.topik.use(JSON.parse(fs.readFileSync(new URL('../world-topik-items.json',import.meta.url))));
const memory=()=>{const rows=new Map();return {getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,String(v)),removeItem:k=>rows.delete(k)};};
const node=()=>({isConnected:true,innerHTML:'',listeners:{},dataset:{},focus(){},closest(){return null;},querySelector(){return null;},querySelectorAll(){return [];},insertAdjacentHTML(where,html){assert.equal(where,'beforeend');this.innerHTML+=html;},addEventListener(name,fn){this.listeners[name]=fn;}});
for(const mode of ['missing-host','throwing-summary','normal-host'])test(`position fallback preserves incomplete evidence and event bindings: ${mode}`,async()=>{
 const board=node(),diagnostic=node(),switchExam=node(),panels=[],maps=[],summaries=[];switchExam.dataset.positionExam='topik2';let homeReads=0,readsAtRender=0,prepared=0;
 board.querySelectorAll=selector=>selector==='[data-position-exam]'?[switchExam]:[];
 const storage=memory(),progress={owner:'account-fixture',learningProfile:()=>({profile:{status:'active',revision:1,consent:true}}),learningProfileValues:()=>({audio:'off',primaryReason:'exam',reasons:['exam'],examType:'topik1',targetGrade:2}),status:()=>({phase:'blocked',scoped:true}),exportSnapshot:()=>({}),flush:async()=>{},hangulReading:()=>null};
 const position={...worldPosition,buildPositionMap(args){summaries.push(args.summary);const map=worldPosition.buildPositionMap(args);maps.push(map);return map;},createView(args){const base=worldPosition.createView(args);return {...base,renderPositionBoard(props){readsAtRender=homeReads;return base.renderPositionBoard(props);}};}};
 const target={localStorage:storage,addEventListener(){},removeEventListener(){},document:{querySelector(selector){if(selector==='#panel-content [data-position-board]')return board;if(selector==='#panel-content [data-position-diagnostic]')return diagnostic;return null;}}};
 if(mode!=='missing-host')target.SYNKLearningHost={ready:async()=>{},createGame(options){const coach=worldLearning.engine.createGame({...options,storage});return {...coach,summary(){if(options.gameId==='world-home')homeReads++;if(mode==='throwing-summary')throw Error('synthetic unavailable evidence');return coach.summary();}};}};
 const home={updateStudy(){},toast(){},closePanel(){},attachPanelResource(){},showPanel(title,html){panels.push({title,html});board.innerHTML='';}};
 const education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:createWorldLearningPlan,launchGame(){},startLesson(){},startReview(){},prepare:async()=>{prepared++;if(mode==='missing-host')throw Error('synthetic prepare failure');},position,target});
 try{
  await assert.doesNotReject(education.position());assert.equal(prepared,1);assert.ok(panels.length);assert.match(board.innerHTML,/wpos-followups/);
  assert.equal(homeReads,readsAtRender,'showBoard must reuse the captured summary instead of reading the host again');
  assert.equal(summaries.at(-1).evidenceComplete,mode==='normal-host');
  if(mode!=='normal-host'){assert.equal(maps.at(-1).evidenceComplete,false);assert.equal(maps.at(-1).abilityClaim,false);assert.equal(maps.at(-1).grade,null);assert.match(panels.at(-1).html,/data-position-incomplete/);assert.doesNotMatch(board.innerHTML,/wpos-advisory/);}
  assert.equal(typeof diagnostic.listeners.click,'function');assert.equal(typeof switchExam.listeners.click,'function');switchExam.listeners.click();assert.equal(maps.at(-1).exam,'topik2');assert.equal(typeof diagnostic.listeners.click,'function');
 }finally{education.dispose();}
});
