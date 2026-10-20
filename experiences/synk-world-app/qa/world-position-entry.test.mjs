// 「내 위치」 입구(10-19 결정): world-learning-ui.mjs가 묶음(world-position-kit.mjs)을 받아 판을 여는지 —
// 처음 온 손님은 15개 항목 지도와 짧은 진단, 「아직 못 읽어요」를 고른 사람은 한글 판, 학습 목표 창에는 「내 위치 보기」 한 줄.
// 실제 Core 코치(atlas/game-browser.js)와 이 기기 저장소 흉내로 돈다. 화면 그리기는 home.showPanel이 받은 HTML로 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createWorldEducation} from '../world-learning-ui.mjs';
import {worldPosition} from '../world-position-kit.mjs';

const require=createRequire(import.meta.url);
const worldLearning=require('../../../atlas/game-browser.js');
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
const count=(html,pattern)=>(html.match(pattern)||[]).length;
function setup({reading=null,hangul=null,position=worldPosition,audio='available'}={}){
 const panels=[],storage=memory(),launched=[];
 if(hangul)storage.setItem('synk.hangul-stage.v1',JSON.stringify(hangul));
 const progress={owner:'guest',learningProfile:()=>({profile:{status:'active',revision:1,consent:true}}),learningProfileValues:()=>({audio}),
  status:()=>({phase:'synced',rejected:false,scoped:false,message:''}),exportSnapshot:()=>({}),flush:async()=>{},hangulReading:()=>reading};
 const home={updateStudy(){},toast(){},closePanel(){},showPanel:(title,html,options)=>panels.push({title,html,options})};
 const education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:()=>({selected:null,reason:''}),
  launchGame:id=>launched.push(id),startLesson(){},startReview(){},position,target:{localStorage:storage,document:{querySelector:()=>null},addEventListener(){},removeEventListener(){}}});
 return {education,panels,storage,launched};
}

test('처음 온 손님: 15개 항목 지도 · 짧은 진단 12문항 · 예상 급수는 「아직」 · 이 기기 기록',async()=>{
 const {education,panels}=setup();
 assert.equal(typeof education.position,'function');
 await education.position();
 const board=panels.at(-1);
 assert.equal(board.options.type,'life-position');assert.equal(board.options.nav,'packs','배우기 탭에 불이 들어온다');
 assert.equal(count(board.html,/<details class="wpos-skill"/g),15);
 assert.match(board.html,/data-diagnostic="ready"/);assert.match(board.html,/처음 보는 문항 12개로 시작점을 정해요/);
 assert.match(board.html,/진단 문항이 아직 없는 항목 3개: 낱말 듣기 · 읽고 이유 이해하기 · 읽고 핵심 이해하기/);
 assert.match(board.html,/data-estimate="too-early"/);assert.match(board.html,/아직 판단하기 일러요/);
 assert.match(board.html,/이 기기의 학습 기록으로 보여요/);
 assert.doesNotMatch(board.html,/data-position-incomplete/);
});

test('오늘 소리를 끈 사람은 듣기 문항 없이 읽기 진단만',async()=>{
 const {education,panels}=setup({audio:'off'});
 await education.position();
 assert.match(panels.at(-1).html,/처음 보는 문항 6개로 시작점을 정해요/);
 assert.match(panels.at(-1).html,/오늘은 소리를 끈 날이라 듣기 항목 6개는 빼요/);
});

test('「아직 못 읽어요」를 고른 사람은 한글 판, 졸업하면 항목 지도',async()=>{
 const reading={version:1,answer:'new',at:1,via:'question'};
 const fresh=setup({reading});
 await fresh.education.position();
 assert.match(fresh.panels.at(-1).html,/data-position-board="hangul"/);
 assert.match(fresh.panels.at(-1).html,/아직 한글 만나기를 시작하지 않았어요/);
 const core=await import('../../hangul-stage/core.mjs');
 const layer=JSON.parse(fs.readFileSync(new URL('../../../strata/hangul.json',import.meta.url),'utf8'));
 const started=core.meet(core.emptyProgress(),layer.units[0].letters,'2026-10-19T01:00:00.000Z');
 const going=setup({reading,hangul:started});
 await going.education.position();
 assert.match(going.panels.at(-1).html,new RegExp(`만난 글자 ${layer.units[0].letters.length} / 49`));
 assert.match(going.panels.at(-1).html,/한글 만나기 이어 하기/);
 const graduated=setup({reading,hangul:core.graduate(started,'2026-10-20T01:00:00.000Z')});
 await graduated.education.position();
 assert.match(graduated.panels.at(-1).html,/data-position-board(?!=)/,'졸업 뒤에는 항목 지도');
});

test('학습 목표 창: 「연습에서 본 것」 대신 「내 위치 보기」 한 줄(세 칸 수와 함께)',()=>{
 const {education,panels}=setup();
 education.open();
 const goal=panels.at(-1).html;
 assert.match(goal,/<button type="button" class="life-row study-position-row" data-view="position">/);
 assert.match(goal,/내 위치 보기[\s\S]*TOPIK I 15개 항목: 혼자 해냄 0 · 연습 중 0 · 아직 15/);
 assert.doesNotMatch(goal,/study-understanding|연습에서 본 것/);
});

test('묶음을 받지 않은 화면은 내 위치를 열지 않는다',()=>{
 const {education,panels}=setup({position:null});
 assert.equal(education.position,undefined);
 education.open();
 assert.doesNotMatch(panels.at(-1).html,/data-view="position"/);
});

test('묶음: 진단 문항 97 · 한글 층 49글자 · 한글 진도 자리는 한글 만나기와 같다',async()=>{
 assert.equal(worldPosition.items.length,97);
 assert.equal(worldPosition.hangulLayer.letters.length,49);
 const learning=await import('../../hangul-stage/learning.mjs');
 assert.equal(worldPosition.hangulProgressKey,learning.progressKey);
 assert.equal(worldPosition.hangulProgressKey({},null),'synk.hangul-stage.v1','손님은 이 기기 자리');
 const host={SYNKLearningHost:{status:()=>({accountKey:'acct-1',revision:3})}};
 assert.equal(worldPosition.hangulProgressKey(host,{assignment(){}}),'synk.account.acct-1.r3.hangul-stage.v1','계정은 그 계정·학습 동의 판 자리');
 for(const name of ['buildPositionMap','selectDiagnostic','createDiagnosticSession','hangulStageProgress','showsHangulBoard','estimateGate','label','createView'])assert.equal(typeof worldPosition[name],'function',name);
 assert.ok(Object.isFrozen(worldPosition));
});
