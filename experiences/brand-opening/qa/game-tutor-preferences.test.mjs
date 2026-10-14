import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameTutor,gameTutorPresentation} from '../game-tutor.mjs';
import {obstacleSupport} from '../game-tutor-support.mjs';

const cache=()=>{const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};};
class Element {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.children=[];this.nodes=new Map();this.listeners=new Map();this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.isConnected=true;this.open=false;this.innerHTML='';}
 setAttribute(){} focus(){} before(){}
 append(...nodes){this.children.push(...nodes);} prepend(...nodes){this.children.unshift(...nodes);} replaceChildren(...nodes){this.children=[...nodes];}
 querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new Element());return this.nodes.get(selector);}
 querySelectorAll(){return [];}
 addEventListener(name,fn){this.listeners.set(name,fn);} removeEventListener(name){this.listeners.delete(name);}
 showModal(){this.open=true;} close(){this.open=false;} remove(){this.isConnected=false;}
 fire(name){this.listeners.get(name)?.({preventDefault(){},stopPropagation(){},currentTarget:this});}
}
let sequence=0;
function environment(){
 const keys=['document','window','location','localStorage','sessionStorage','matchMedia','requestAnimationFrame','cancelAnimationFrame'];
 const originals=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const elements=[];
 const document={hidden:false,createElement:tag=>{const element=new Element(tag);elements.push(element);return element;},addEventListener(){},removeEventListener(){}};
 const window={addEventListener(){},removeEventListener(){}},local=cache(),session=cache();
 const values={document,window,location:{origin:'http://127.0.0.1'},localStorage:local,sessionStorage:session,matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}}),requestAnimationFrame:()=>0,cancelAnimationFrame(){}};
 for(const [key,value]of Object.entries(values))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const container=new Element(),commands=[],frame={isConnected:true,inert:false,focus(){},contentWindow:{postMessage:body=>commands.push(body)}};
 const owner=`preference-unit-${++sequence}`;
 return {container,commands,frame,owner,local,elements,restore(){for(const [key,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}};
}
const mount=(env,options={})=>createGameTutor({tutorId:'marin',game:'runner',container:env.container,frame:env.frame,owner:env.owner,reduced:()=>true,...options});
const microtask=()=>new Promise(resolve=>queueMicrotask(resolve));

test('only known explicit display preferences cross the tutor boundary and the snapshot is immutable',()=>{
 const raw={support:'independent',explanation:'brief',accountId:'ignored',grade:6},value=gameTutorPresentation(raw);
 assert.deepEqual(value,{support:'independent',explanation:'brief'});assert.equal(Object.isFrozen(value),true);
 raw.support='step';assert.equal(value.support,'independent');
 assert.deepEqual(gameTutorPresentation({support:'personality',explanation:'unlimited'}),{support:'choose',explanation:'standard'});
});

test('independent starts at the real game lobby without a popup or invented practice completion',async()=>{
 const env=environment();let tutor;
 try{
  tutor=mount(env,{presentation:{support:'independent',explanation:'brief'}});await microtask();
  assert.equal(tutor.metrics().guideOpen,false);assert.equal(tutor.metrics().practice,null);assert.equal(tutor.metrics().practiced,false);
  assert.equal(env.frame.inert,false);assert.equal(env.commands.some(command=>command.action==='practice-complete'),false);
  assert.equal([...env.local.data.keys()].some(key=>key.includes('practice')),false);
  tutor.setPhase('playing');tutor.openGuide();assert.equal(tutor.metrics().guideOpen,true);assert.equal(env.frame.inert,true);
  assert.equal(env.commands.at(-1).action,'help');
  env.container.children.find(node=>node.tagName==='DIALOG').querySelector('.game-tutor-continue').fire('click');
  assert.equal(tutor.metrics().guideOpen,false);assert.equal(env.frame.inert,false);assert.equal(env.commands.at(-1).action,'help-close');
 }finally{tutor?.dispose();env.restore();}
});

test('step retains the first hands-on practice without writing success before any input',async()=>{
 const env=environment();let tutor;
 try{
  tutor=mount(env,{presentation:{support:'step',explanation:'detailed'}});await microtask();
  assert.ok(tutor.metrics().practice);assert.equal(tutor.metrics().practiced,false);assert.equal(env.frame.inert,true);
  assert.equal(env.commands.some(command=>command.action==='practice-complete'),false);
  assert.equal([...env.local.data.keys()].some(key=>key.includes('practice')),false);
 }finally{tutor?.dispose();env.restore();}
});

test('a queued first guide cannot interrupt gameplay that has already begun or a disposed companion',async()=>{
 for(const dispose of [false,true]){
  const env=environment();let tutor;
  try{
   tutor=mount(env,{practiceEnabled:false,presentation:{support:'step'}});
   if(dispose)tutor.dispose();else tutor.setPhase('playing');await microtask();
   assert.equal(tutor.metrics().guideOpen,false);assert.equal(tutor.metrics().practice,null);
   assert.equal(env.commands.some(command=>command.action==='help'),false);
  }finally{tutor?.dispose();env.restore();}
 }
});

test('an independent learner can cancel requested practice back to the same game instead of exiting',async()=>{
 const env=environment();let tutor,exits=0;
 try{
  tutor=mount(env,{presentation:{support:'independent'},onExit:()=>exits++});await microtask();tutor.openPractice();
  const practice=env.container.children.find(node=>node.className==='tutor-practice');assert.ok(practice);
  assert.match(practice.innerHTML,/연습을 닫고 놀이로 돌아가기/);practice.fire('cancel');
  assert.equal(exits,0);assert.equal(tutor.metrics().practice,null);assert.equal(tutor.metrics().practiced,false);assert.equal(env.frame.inert,false);
  assert.equal(env.commands.some(command=>command.action==='practice-complete'),false);
 }finally{tutor?.dispose();env.restore();}
});

test('closing the first control practice closes only the practice and keeps the same game open',async()=>{
 // 10-14 리드: 처음 열린 조작 연습의 ×가 놀이 판까지 닫던 문제. 연습만 닫고 그 게임의 시작 화면으로 돌아간다.
 for(const support of ['choose','step']){
  const env=environment();let tutor,exits=0;
  try{
   tutor=mount(env,{presentation:{support},onExit:()=>exits++});await microtask();
   const practice=env.container.children.find(node=>node.className==='tutor-practice');assert.ok(practice);assert.equal(env.frame.inert,true);
   assert.match(practice.innerHTML,/연습을 닫고 놀이로 돌아가기/);practice.fire('cancel');
   assert.equal(exits,0,'the game panel stays open');assert.equal(tutor.metrics().practice,null);assert.equal(tutor.metrics().practiced,false);
   assert.equal(env.frame.inert,false);assert.equal(env.commands.at(-1).action,'help-close');
   assert.equal(env.commands.some(command=>command.action==='practice-complete'),false);
   assert.equal([...env.local.data.keys()].some(key=>key.includes('practice')),false);
  }finally{tutor?.dispose();env.restore();}
 }
});

test('brief and detailed keep the same instructions and hint facts with different initial disclosure',async()=>{
 const texts=[];
 for(const explanation of ['brief','detailed']){
  const env=environment();let tutor;
  try{
   tutor=mount(env,{presentation:{support:'independent',explanation}});await microtask();
   const guide=env.container.children.find(node=>node.className==='game-tutor-guide');
   assert.equal(guide.dataset.explanation,explanation);assert.match(guide.innerHTML,/조작 설명 더 보기/);assert.match(guide.innerHTML,/왼쪽·오른쪽 단추로 한 칸씩 이동한다/);
   assert.equal(/<details class="game-tutor-explanation" open>/.test(guide.innerHTML),explanation==='detailed');
   const support=obstacleSupport('fence');tutor.react('retry',{support});
   const section=env.elements.find(node=>node.className==='tutor-support-list'),row=section.children[0];
   const detail=row.children.find(node=>node.tagName==='DETAILS');assert.ok(detail);assert.equal(detail.open,explanation==='detailed');
   assert.equal(detail.children.find(node=>node.className==='tutor-support-fact').textContent,support[0].hint);
   assert.equal(row.children.at(-1).className,'tutor-support-retry','the retry button remains available outside the collapsed detail');
   const ledger=tutor.metrics().difficulties;assert.equal(ledger.length,1);assert.equal(ledger[0].hint,support[0].hint);
   texts.push(guide.innerHTML.replace(/ open/g,'').replace(/ >/g, '>'));
   assert.equal(tutor.metrics().guideOpen,false,'receiving a hint does not open a modal');
  }finally{tutor?.dispose();env.restore();}
 }
 assert.equal(texts[0],texts[1]);
});
