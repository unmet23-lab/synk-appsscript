import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorldEducation} from '../world-learning-ui.mjs';
import {worldPosition} from '../world-position-kit.mjs';
import {worldLearning} from '../world-learning-map.mjs';
import {createWorldLearningPlan} from '../world-learning-plan.mjs';
worldPosition.topik.use(JSON.parse(fs.readFileSync(new URL('../world-topik-items.json',import.meta.url))));
// The existing bank loader and private Hangul reader also expose deferred seams.
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const node=()=>({isConnected:true,innerHTML:'',listeners:{},dataset:{},focus(){},closest(){return null;},querySelector(){return null;},querySelectorAll(){return [];},insertAdjacentHTML(where,html){this.innerHTML+=html;},addEventListener(name,fn){this.listeners[name]=fn;}});
function setup({prepare=null,ready=null,bank=null,hangul=null}={}){
 const entered=Object.fromEntries(['prepare','ready','bank','hangul'].map(stage=>[stage,deferred()]));
 const board=node(),panels=[],rows=new Map(),coaches=[];let writes=0,resource=null,panelKind='';
 const storage={getItem:k=>rows.get(k)??null,setItem:(k,v)=>{writes++;rows.set(k,String(v));},removeItem:k=>{writes++;rows.delete(k);}};
 const progress={owner:'account-fixture',learningProfile:()=>({profile:{status:'active',revision:1,consent:true}}),learningProfileValues:()=>({audio:'off',primaryReason:'exam',reasons:['exam'],examType:'topik1',targetGrade:2}),status:()=>({phase:'blocked',scoped:true}),exportSnapshot:()=>({}),flush:async()=>{},hangulReading:()=>null};
 const target={localStorage:storage,addEventListener(){},removeEventListener(){},document:{querySelector(selector){return panelKind!=='other'&&selector==='#panel-content [data-position-board]'?board:null;}},
  SYNKLearningHost:{ready:()=>{entered.ready.resolve();return ready?ready.promise:Promise.resolve();},createGame(options){const coach=worldLearning.engine.createGame({...options,storage});coaches.push(coach);return coach;}}};
 const drop=()=>{const r=resource;resource=null;r?.dispose?.();};
 // Closing keeps the old DOM connected during the real home's 160ms fade.
 const home={updateStudy(){},toast(){},openPanel:()=>panelKind,attachPanelResource(r){if(r===resource)return;const p=resource;resource=r;p?.dispose?.();},closePanel(){panelKind='';drop();},showPanel(title,html,options={}){drop();panelKind=options.type||'panel';panels.push({title,html});board.innerHTML='';}};
 const position={...worldPosition,topik:bank?{...worldPosition.topik,ready:true,load(){entered.bank.resolve();return bank.promise;}}:worldPosition.topik};
 const education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:createWorldLearningPlan,launchGame(){},startLesson(){},startReview(){},prepare:()=>{entered.prepare.resolve();return prepare?prepare.promise:Promise.resolve();},readHangulProgress:hangul?()=>{entered.hangul.resolve();return hangul.promise;}:undefined,position,target});
 if(bank)position.topik.ready=false;
 return {education,home,panels,entered,writes:()=>writes,events:()=>coaches.flatMap(coach=>coach.events?.()||[]),pending:()=>resource};
}
for(const stage of ['prepare','ready','bank','hangul'])test(`closing the panel during the ${stage} wait keeps the position board closed`,async()=>{
 const gate=deferred(),fixture=setup({[stage]:gate});
 try{
  const opening=fixture.education.position();
  await fixture.entered[stage].promise;
  assert.ok(fixture.pending(),'a pending panel resource is registered before waiting');
  const writesAtClose=fixture.writes();fixture.home.closePanel();gate.resolve(null);await opening;
  assert.equal(fixture.panels.length,0,'the closed board must not reopen');assert.equal(fixture.events().length,0,'cancellation creates no learning events');
  // Bank completion also refreshes the home recommendation and may write its empty coach cache.
  if(stage!=='bank')assert.equal(fixture.writes(),writesAtClose,'the cancelled continuation performs no writes');
  if(stage==='prepare'||stage==='ready')assert.equal(writesAtClose,0);
 }finally{fixture.education.dispose();}
});

for(const stage of ['prepare','ready','bank'])test(`leaving during the ${stage} wait cancels a short practice launch`,async()=>{
 const gate=deferred(),fixture=setup({[stage]:gate});
 try{
  const opening=fixture.education.practice('ko.reading.negation');await fixture.entered[stage].promise;
  fixture.home.showPanel('다른 화면','다른 화면',{type:'other'});gate.resolve();await opening;
  assert.equal(fixture.panels.length,1);assert.equal(fixture.home.openPanel(),'other');assert.equal(fixture.events().length,0);if(stage!=='bank')assert.equal(fixture.writes(),0);
 }finally{gate.resolve();fixture.education.dispose();}
});
test('a newer opening replaces the old pending resource without cancelling itself',async()=>{
 const gate=deferred(),fixture=setup({prepare:gate});
 try{const first=fixture.education.position(),old=fixture.pending(),second=fixture.education.position();old.dispose();gate.resolve();await Promise.all([first,second]);assert.equal(fixture.panels.length,1);}
 finally{fixture.education.dispose();}
});
test('a normal opening still shows the board and its own showPanel does not cancel it',async()=>{
 const fixture=setup();
 try{
  await assert.doesNotReject(fixture.education.position());
  assert.equal(fixture.panels.length,1);assert.equal(fixture.pending(),null,'showPanel disposed the pending resource');
 }finally{fixture.education.dispose();}
});
