import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorldEducation} from '../world-learning-ui.mjs';
import {worldPosition} from '../world-position-kit.mjs';
import {worldLearning} from '../world-learning-map.mjs';
import {createWorldLearningPlan} from '../world-learning-plan.mjs';
worldPosition.topik.use(JSON.parse(fs.readFileSync(new URL('../world-topik-items.json',import.meta.url))));
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
const node=()=>({isConnected:true,innerHTML:'',listeners:{},focus(){},closest(){return null;},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(type,fn){this.listeners[type]=fn;}});
for(const exam of ['topik1','topik2'])for(const audio of ['off','available'])test(`normal ${exam} diagnostic preserves the exam and results on completion and return, audio ${audio}`,async()=>{
 const panels=[],maps=[],errors=[],doneMaps=[],deliveries=[];let panel='',session=null,stage=null;
 const board=node(),diagnostic=node();
 const home={updateStudy(){},toast(message){errors.push(String(message));},closePanel(){},attachPanelResource(){},showPanel(title,html,options){panels.push({title,html,options});panel=html;if(html.includes('data-position-stage'))stage=node();}};
 const position={...worldPosition,buildPositionMap(args){const result=worldPosition.buildPositionMap(args);maps.push(result);return result;},createDiagnosticSession(args){session=worldPosition.createDiagnosticSession(args);return session;},createView(args){const original=worldPosition.createView(args);return {...original,renderDiagnosticDone(props){doneMaps.push(props);return original.renderDiagnosticDone(props);}};}};
 const storage=memory(),progress={owner:'guest',learningProfile:()=>({profile:{status:'active',revision:1,consent:true}}),learningProfileValues:()=>({audio,primaryReason:'exam',reasons:['exam'],examType:exam,targetGrade:exam==='topik1'?2:4}),status:()=>({phase:'synced',rejected:false,scoped:false,message:''}),exportSnapshot:()=>({}),flush:async()=>{},hangulReading:()=>null};
 class AudioPort{constructor(url){this.url=url;this.listeners={};}addEventListener(name,fn){this.listeners[name]=fn;}play(){deliveries.push(this.url);queueMicrotask(()=>this.listeners.ended?.());return Promise.resolve();}pause(){}}
 const target={Audio:AudioPort,localStorage:storage,addEventListener(){},removeEventListener(){},document:{querySelector(selector){if(selector==='#panel-content [data-position-stage]')return stage;if(selector==='#panel-content [data-position-board]'&&panel.includes('data-position-board'))return board;if(selector==='#panel-content [data-position-diagnostic]'&&panel.includes('data-position-diagnostic'))return diagnostic;return null;}}};
 const education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:createWorldLearningPlan,launchGame(){throw Error('unexpected game');},startLesson(){throw Error('unexpected lesson');},startReview(){throw Error('unexpected review');},position,target});
 const click=(attribute,value)=>{const button={disabled:false,dataset:attribute==='data-position-choice'?{positionChoice:value}:{},hasAttribute:key=>key===attribute};stage.listeners.click({target:{closest:()=>button}});};
 try{
  await education.position();assert.match(panels.at(-1).html,new RegExp(`data-exam="${exam}"`));assert.equal(maps.at(-1).exam,exam);
  diagnostic.listeners.click();assert.ok(session);let answered=0,listened=0;
  while(session.current){assert.ok(++answered<30);const current=session.current;assert.match(current.item.skillId,exam==='topik2'?/^ko2\./:/^ko\./);
   if(current.item.modality==='listening'){assert.equal(audio,'available');click('data-position-listen');await Promise.resolve();await Promise.resolve();listened++;}
   click('data-position-choice',current.item.correctId);
  }
  assert.deepEqual(errors,[]);assert.equal(doneMaps.length,1);const done=doneMaps[0];assert.equal(done.map.exam,exam,'completed result must use selected exam');assert.equal(done.map.total,exam==='topik2'?12:16);assert.equal(done.results.length,answered);assert.ok(done.results.every(r=>r.verdict==='correct'&&!r.skipped));
  assert.match(stage.innerHTML,new RegExp(`TOPIK ${exam==='topik2'?'II':'I'} ${done.map.total}개 항목`));assert.equal(done.map.counts.practicing,answered);assert.equal(deliveries.length,listened);if(audio==='available')assert.ok(listened>0);else assert.equal(listened,0);
  click('data-position-back');assert.equal(maps.at(-1).exam,exam);assert.deepEqual(maps.at(-1).counts,done.map.counts);assert.match(panels.at(-1).html,new RegExp(`data-exam="${exam}"`));
 }finally{education.dispose();}
});
