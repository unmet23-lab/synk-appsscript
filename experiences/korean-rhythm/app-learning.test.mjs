import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {TRACKS,LEVELS,RoundState} from './core.mjs';
import {rhythmItem,RHYTHM_CANDIDATES,assignmentTracks,assignmentTrack,rhythmTargetLabel} from './personalization.mjs';
const require=createRequire(import.meta.url);
const {createGame}=require('../../atlas/game-learning.js');
const {createMap}=require('../../strata');
const map=createMap(require('../../strata/maps/topik-i.json'));
const app=fs.readFileSync(new URL('./app.mjs',import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'');

// Execute the real page entry and click its registered button. Only browser
// surfaces unrelated to record deletion (audio, stage and DOM drawing) are faked.
function mount(coach,storage,{confirm=()=>true}={}){
  const elements=new Map();
  const element=()=>({children:[],dataset:{},classList:{add(){},remove(){},toggle(){}},style:{},
    listeners:new Map(),textContent:'',setAttribute(){},querySelectorAll(){return [];},
    addEventListener(name,fn){this.listeners.set(name,fn);},append(child){this.children.push(child);},
    replaceChildren(...children){this.children=children;},focus(){},click(){this.listeners.get('click')?.();}});
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const document={getElementById:get,createElement:element,querySelectorAll:()=>[],addEventListener(){},body:element()};
  const context={TRACKS,LEVELS,RoundState,rhythmItem,RHYTHM_CANDIDATES,assignmentTracks,assignmentTrack,rhythmTargetLabel,document,localStorage:storage,
    MusicPlayer:class{},Stage:class{},SynkLearning:{createGame:()=>coach},
    matchMedia:()=>({matches:false}),setTimeout:()=>1,clearTimeout(){},addEventListener(){},scrollTo(){},confirm};
  context.window=context;
  vm.runInNewContext(app,context,{filename:'korean-rhythm/app.mjs'});
  return {reset:()=>get('reset-learning').click(),toast:()=>get('toast').textContent,scope:()=>get('learning-scope').textContent,
    tracks:()=>get('track-grid').children,selected:()=>context.synkRhythm.snapshot().track,reason:()=>get('recommendation-reason').textContent};
}

test('actual lobby selects the target song and refuses another song even through its old click handler',()=>{
  const m=rhythmItem(2,{sourceIndex:0}),target={...m,familyKeys:[m.familyKey],requiredAttempts:1};
  const coach={assignment:()=>target,recommend:()=>null,summary:()=>({storage:{available:true}})};
  const page=mount(coach,{getItem:()=>null,setItem(){}});
  assert.equal(page.selected(),2);assert.match(page.reason(),/조건 표현/);
  assert.equal(page.tracks()[0].disabled,true);page.tracks()[0].click();assert.equal(page.selected(),2);
});

function fixture(account=false,options={}){
  const values=new Map();let fail=false;
  const storage={getItem:k=>values.get(k)??null,setItem(k,v){if(fail)throw Error('synthetic quota');values.set(k,v);}};
  const coach=createGame({gameId:'korean-rhythm',map,storage,...(account?{storageScope:'account',accountKey:'synthetic-account'}:{})});
  const pid=coach.present(rhythmItem(0,new RoundState(TRACKS[0]).questions[0]));
  coach.delivery(pid,{audio:'completed'});coach.answer(pid,{correct:true,assessable:true});
  return {coach,storage,values,fail:value=>{fail=value;},page:mount(coach,storage,options)};
}

test('the real reset button reports an account restriction without claiming deletion',()=>{
  const f=fixture(true),before=JSON.stringify([...f.values]);
  f.page.reset();
  assert.match(f.page.toast(),/계정|WORLD/);
  assert.doesNotMatch(f.page.toast(),/지웠어요/);
  assert.equal(JSON.stringify([...f.values]),before);
  assert.equal(f.coach.summary().independent,1);
});

test('failed durable reset does not announce success; a later successful retry does',()=>{
  const f=fixture(),before=JSON.stringify([...f.values]);f.fail(true);
  f.page.reset();
  assert.doesNotMatch(f.page.toast(),/지웠어요/);
  assert.match(f.page.toast(),/못|실패/);
  assert.equal(JSON.stringify([...f.values]),before);
  f.fail(false);f.page.reset();
  assert.match(f.page.toast(),/지웠어요/);
  assert.equal(f.coach.events().length,0);
  assert.doesNotMatch(f.page.scope(),/연결하지 못했어요/);
});

test('missing learning runtime cannot announce a deleted record',()=>{
  const page=mount(null,{getItem:()=>null,setItem(){}});page.reset();
  assert.doesNotMatch(page.toast(),/지웠어요/);
  assert.match(page.toast(),/못|실패|연결/);
});

test('a successful local reset clears actual persisted events and reports success',()=>{
  const f=fixture();f.page.reset();
  assert.match(f.page.toast(),/지웠어요/);
  const reopened=createGame({gameId:'korean-rhythm',map,storage:f.storage});
  assert.equal(reopened.events().length,0);assert.equal(reopened.summary().independent,0);
});

test('the reset asks first, and cancelling keeps every record and announces nothing',()=>{
  let asked='';const f=fixture(false,{confirm:q=>{asked=q;return false;}}),before=JSON.stringify([...f.values]);
  f.page.reset();
  assert.match(asked,/모든 SYNK 게임의 학습 기록을 지울까요/);
  assert.equal(JSON.stringify([...f.values]),before);
  assert.equal(f.page.toast(),'');
  assert.equal(f.coach.summary().independent,1);
});
