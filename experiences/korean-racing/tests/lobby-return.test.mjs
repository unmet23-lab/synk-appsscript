// 지적 A1: 잠긴 코스를 보고 있을 때 맞춤 연습 안내와 단추가 실제 동작과 같은지 입구를 그려서 본다.
import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CAMPAIGN,campaignUnlocked,recommendedStage} from '../campaign.js';
import {recordRound} from '../learning.js';
import {racingItem,personalizedStage,missedRacing} from '../personalization.js';

const require=createRequire(import.meta.url),{createGame}=require('../../../atlas/game-learning.js'),{createMap}=require('../../../strata/index.js');
const map=createMap(require('../../../strata/topik-i').topikMap());
let clock=Date.parse('2026-10-02T09:00:00Z');
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const node=()=>{const n={hidden:false,textContent:'',attrs:{},classes:new Set(),classList:{toggle(c,on){on?n.classes.add(c):n.classes.delete(c);}},focused:0,addEventListener(){},setAttribute(k,v){n.attrs[k]=v;},querySelector:()=>node(),replaceChildren(){},append(){},focus(){dom.activeElement=n;n.focused++;}};return n;};
const els=new Map();
const dom={activeElement:null,querySelector:s=>{if(!els.has(s))els.set(s,node());return els.get(s);},querySelectorAll:()=>[],createElement:()=>node()};
// 입구를 그릴 때만 문서를 둔다. 문서가 있으면 학습 기록이 브라우저 잠금을 기다려 이 시험의 기록이 저장되지 않는다.
const withDom=(fn)=>{globalThis.document=dom;try{return fn();}finally{delete globalThis.document;}};
const {createLobby}=await import('../lobby.js');
const lobby=withDom(()=>createLobby({view:()=>({}),select(){},journey(){},mission(){}}));
const LOCK='앞 코스를 다섯 문제 중 넷 이상 맞히면 열려요.';

function missed(){
  // 지적의 경로: 코스 1을 끝까지 달려 다 보고 셋만 맞혀 코스 2가 잠긴 채, 같은 듣기 패턴의 새 문항은 코스 2에 있다.
  const coach=createGame({gameId:'korean-racing',map,storage:storage(),clock:()=>new Date(clock+=60000).toISOString()});
  CAMPAIGN[0].items.forEach((q,i)=>{const pid=coach.present(racingItem(q));coach.delivery(pid,{audio:'completed'});coach.answer(pid,{correct:i<3,assessable:true});});
  return {coach,plan:missedRacing(coach)};
}
const view=(stage,progress,returnPlan,extra={})=>({stage,progress,returnPlan,target:null,unlocked:campaignUnlocked(progress,stage),firstRun:false,...extra});
const paint=(v)=>withDom(()=>{lobby.renderReturn(v);const r=dom.querySelector('#l-reason');return {reason:r.textContent,hidden:dom.querySelector('#return-practice').hidden,returning:r.classes.has('returning')};});
const lockedHost=(plan)=>{const s=CAMPAIGN.find(x=>x.number>1&&x.items.some(q=>q.id===plan.target.id));assert.ok(s,`대상이 잠길 수 있는 코스 안에 있어야 재현이다: ${plan.target.id}`);return s;};

test('맞춤 문항이 든 잠긴 코스: 시작 단추의 약속 대신 잠금과 맞춤 연습 단추를 함께 말한다',()=>{
  const {plan}=missed(),progress={stages:{}},stage=lockedHost(plan);
  assert.equal(campaignUnlocked(progress,stage),false);
  const {reason,hidden}=paint(view(stage,progress,plan));
  assert.equal(hidden,false,'맞춤 연습 단추가 보인다');
  assert.ok(reason.startsWith(LOCK),reason);
  assert.ok(reason.includes(plan.why));
  assert.ok(reason.includes('‘놓친 문제 바로 연습’의 첫 문제도'));
  assert.ok(!reason.includes('이 코스 첫 문제'));
});
test('맞춤 문항이 없는 다른 잠긴 코스도 이유 없이 단추만 보이지 않는다',()=>{
  const {plan}=missed(),progress={stages:{}};
  const stage=CAMPAIGN.find(s=>s.number>1&&!s.items.some(q=>q.id===plan.target.id));
  const {reason,hidden}=paint(view(stage,progress,plan));
  assert.equal(hidden,false);
  assert.ok(reason.startsWith(LOCK)&&reason.includes(plan.why));
});
test('열린 코스에 문항이 있으면 전처럼 시작 단추가 맡고 단추를 숨긴다',()=>{
  const {plan}=missed(),host=lockedHost(plan);
  const progress={stages:{[CAMPAIGN[host.number-2].id]:{cleared:true}}};
  const {reason,hidden}=paint(view(host,progress,plan));
  assert.equal(hidden,true);
  assert.ok(reason.includes('이 코스 첫 문제도'));
});
test('맞춤 기록이 없으면 잠긴 코스 문구와 단추는 그대로다',()=>{
  const progress={stages:{}},stage=CAMPAIGN[1];
  const {reason,hidden}=paint(view(stage,progress,null));
  assert.equal(hidden,true);
  assert.equal(reason,`${LOCK} 자동 시연은 지금도 볼 수 있어요.`);
});
test('누르고 있던 단추가 사라질 때만 시작 단추로 초점을 옮긴다',()=>{
  const {plan}=missed(),progress={stages:{}},stage=lockedHost(plan);
  paint(view(stage,progress,plan));
  dom.activeElement=dom.querySelector('#return-practice');
  const before=dom.querySelector('#start').focused;
  paint(view(stage,progress,plan));
  assert.equal(dom.querySelector('#start').focused,before,'단추가 남아 있어 옮기지 않는다');
  paint(view(stage,progress,null));
  assert.equal(dom.querySelector('#start').focused,before+1);
});
test('맞춤 단추의 판은 실행 가능하고, 다 맞혀도 잠긴 코스를 열지 않는다',()=>{
  const {coach,plan}=missed(),progress={stages:{}},stage=lockedHost(plan);
  const personal=personalizedStage(coach,{lead:plan.target.item}).stage;
  assert.equal(campaignUnlocked(progress,personal),true,'app.js start()가 거절하지 않는다');
  assert.equal(personal.items[0].id,plan.target.id);
  assert.equal(recommendedStage(progress).id,CAMPAIGN[0].id,'시작 단추는 앞 코스로 간다');
  const after=recordRound(progress,personal,personal.items.map(q=>({id:q.id,answer:q.answer,correct:true})));
  assert.equal(campaignUnlocked(after,stage),false,'맞춤 판은 정규 통과가 아니다');
});

// WORLD 입구(world-skin.css)는 안내 줄을 숨기고 .returning이 붙은 재방문 안내만 보인다. 첫 사용자·일반 코스 글은 전처럼 숨는다.
test('WORLD: 재방문 안내일 때만 안내 줄에 표식을 달고, 첫 사용자·목표 과제·일반 코스는 달지 않는다',()=>{
  const {plan}=missed(),host=lockedHost(plan);
  const open={stages:{[CAMPAIGN[host.number-2].id]:{cleared:true}}};
  const first=paint(view(CAMPAIGN[0],{stages:{}},null,{firstRun:true}));
  assert.equal(first.returning,false);
  assert.ok(first.reason.startsWith('처음이라'),first.reason);
  const back=paint(view(host,open,plan,{firstRun:true}));
  assert.equal(back.returning,true);
  assert.ok(back.reason.includes(plan.why)&&back.reason.includes('이 코스 첫 문제도')&&back.reason.includes('건너뛰면 바로 이어져요'),back.reason);
  assert.equal(back.hidden,true,'열린 코스에 있으면 출발이 맡는다');
  assert.equal(paint(view(host,{stages:{}},plan)).returning,true,'잠긴 코스는 잠금 안내와 함께 보인다');
  assert.equal(paint(view(host,open,null)).returning,false,'정답으로 풀려 맞춤 기록이 사라지면 표식도 거둔다');
  assert.equal(paint(view(host,open,plan,{target:{id:'x'},personal:{reason:'과제'}})).returning,false,'과제 화면은 맞춤 안내가 아니다');
});
test('WORLD 겉: #l-reason은 .returning이 없을 때만 숨는다',()=>{
  const css=readFileSync(new URL('../world-skin.css',import.meta.url),'utf8');
  assert.ok(!/:is\([^)]*#l-reason[^)]*\)\{display:none\}/.test(css),'통째로 숨기는 규칙이 없다');
  assert.ok(css.includes('#lobby #l-reason:not(.returning){display:none}'));
});
