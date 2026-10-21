// 「내 위치」 입구(10-19 결정): world-learning-ui.mjs가 묶음(world-position-kit.mjs)을 받아 판을 여는지 —
// 처음 온 손님은 16개 항목 지도와 짧은 진단, 「아직 못 읽어요」를 고른 사람은 한글 판, 학습 목표 창에는 「내 위치 보기」 한 줄.
// 실제 Core 코치(atlas/game-browser.js)와 이 기기 저장소 흉내로 돈다. 화면 그리기는 home.showPanel이 받은 HTML로 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createWorldEducation} from '../world-learning-ui.mjs';
import {worldPosition} from '../world-position-kit.mjs';
import {worldLearning} from '../world-learning-map.mjs';
import STRINGS from '../../brand-opening/world-strings.mjs';

const require=createRequire(import.meta.url);
// 10-21 ④: WORLD 코치는 TOPIK I·II를 합친 지도(world-learning-map.mjs), 문항은 검수 통과 기존 문항 + 공개 TOPIK 은행(world-topik-items.json).
// 은행은 화면이 필요할 때 불러오므로 여기서는 실제 공개 은행 파일을 미리 넣는다. 기대값은 은행 내용에서 센다(문항이 늘어도 맞게).
const BANK=JSON.parse(fs.readFileSync(new URL('../world-topik-items.json',import.meta.url),'utf8'));
worldPosition.topik.use(BANK);
const TOPIK1=require('../../../strata/topik-i.skills.json').skills.map(([id])=>id);
const covered=(modality=null)=>TOPIK1.filter(id=>(!modality||id.split('.')[1]===modality)&&worldPosition.items.some(item=>item.skillId===id));
const skillKo=id=>STRINGS[`position.skill.${id}`].ko;
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

test('처음 온 손님: 16개 항목 지도 · 짧은 진단은 검수 통과 문항이 있는 항목마다 하나 · 예상 급수는 「아직」 · 이 기기 기록',async()=>{
 const {education,panels}=setup();
 assert.equal(typeof education.position,'function');
 await education.position();
 const board=panels.at(-1);
 assert.equal(board.options.type,'life-position');assert.equal(board.options.nav,'packs','배우기 탭에 불이 들어온다');
 assert.equal(count(board.html,/<details class="wpos-skill"/g),16);
 assert.match(board.html,/TOPIK I 16개 항목: 혼자 해냄 0 · 연습 중 0 · 아직 16/,'판 위 요약 줄도 지도의 항목 수(16)를 받는다');
 // 짧은 진단: 검수 통과 문항이 있는 항목마다 하나(10-21 ④ — 게임 지시문·질문 없는 O/X는 빠지고 듣기는 문항 묶음의 대화형 문항).
 const ready=covered(),gaps=TOPIK1.filter(id=>!ready.includes(id));
 assert.ok(ready.length>=15,'읽기 8 + 듣기 7 이상(낱말 듣기는 레이싱 낱말 판정 뒤)');
 assert.match(board.html,/data-diagnostic="ready"/);assert.match(board.html,new RegExp(`처음 보는 문항 ${ready.length}개로 시작점을 정해요`));
 if(gaps.length)assert.match(board.html,new RegExp(`진단 문항이 아직 없는 항목 ${gaps.length}개: ${gaps.map(skillKo).join(' · ')}<`),'검수 통과 문항이 없는 항목은 이름과 함께 알린다');
 else assert.doesNotMatch(board.html,/진단 문항이 아직 없는 항목/);
 assert.match(board.html,/data-estimate="too-early"/);assert.match(board.html,/아직 판단하기 일러요/);
 assert.match(board.html,/이 기기의 학습 기록으로 보여요/);
 assert.doesNotMatch(board.html,/data-position-incomplete/);
});

test('오늘 소리를 끈 사람은 듣기 문항 없이 읽기 진단만',async()=>{
 const {education,panels}=setup({audio:'off'});
 await education.position();
 const listening=covered('listening'),gaps=TOPIK1.filter(id=>!covered().includes(id));
 assert.match(panels.at(-1).html,new RegExp(`처음 보는 문항 ${covered('reading').length}개로 시작점을 정해요`));
 assert.match(panels.at(-1).html,new RegExp(`오늘은 소리를 끈 날이라 듣기 항목 ${listening.length}개는 빼요`));
 if(gaps.length)assert.match(panels.at(-1).html,new RegExp(`진단 문항이 아직 없는 항목 ${gaps.length}개`),'문항이 없는 항목은 소리 탓이 아니라 문항 없음으로 센다');
});

test('진단 문항 풀은 검수를 통과한 것만: 게임 지시문·질문 없는 O/X는 없고, 듣기는 문항 묶음의 대화형 문항(허용 재생 수가 있는 시험형)',()=>{
 const items=worldPosition.items;
 assert.ok(!items.some(item=>['korean-runner','korean-rhythm'].includes(item.source)),'바람길 지시문·리듬 O/X는 진단에서 빠졌다');
 const listening=items.filter(item=>item.modality==='listening');
 assert.ok(listening.length>0);
 // 문항 묶음 듣기의 허용 재생 수는 공식 유형표 그대로(TOPIK I 두 번, TOPIK II 1~20번 한 번·21~50번 두 번 — 10-21 TOPIK II 듣기가 은행에 들어옴).
 const officialPlays=item=>BANK.forms[item.exam]?.types.find(type=>type.id===item.officialType)?.plays;
 for(const item of listening)assert.ok(item.source==='topik-items'?worldPosition.mock.allowedPlays(item)===officialPlays(item)&&[1,2].includes(officialPlays(item)):item.source==='korean-racing',`${item.id}: 문항 묶음 듣기(공식 재생 수) 또는 판정을 받은 레이싱 낱말`);
 assert.ok(listening.filter(item=>item.source==='topik-items').every(item=>Array.isArray(item.script)&&item.script.length&&item.question),'대화형: 대본과 물음이 있다');
 const bankIds=new Set(BANK.items.map(row=>row.id));
 assert.ok(items.filter(item=>item.source==='topik-items').every(item=>bankIds.has(item.id)),'문항 묶음 문항은 공개 은행(검수 통과)에서만');
});

test('TOPIK II를 고른 학생의 판은 TOPIK II 항목(듣기 5·읽기 7)이고, TOPIK I·II를 고를 수 있으며 쓰기는 칸 밖 한 줄',async()=>{
 const panels=[],storage=memory();
 const progress={owner:'guest',learningProfile:()=>({profile:{status:'active',revision:1,consent:true}}),learningProfileValues:()=>({audio:'available',primaryReason:'exam',reasons:['exam'],examType:'topik2',targetGrade:4}),
  status:()=>({phase:'synced',rejected:false,scoped:false,message:''}),exportSnapshot:()=>({}),flush:async()=>{},hangulReading:()=>null};
 const home={updateStudy(){},toast(){},closePanel(){},showPanel:(title,html,options)=>panels.push({title,html,options})};
 const education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:()=>({selected:null,reason:''}),launchGame(){},startLesson(){},startReview(){},position:worldPosition,
  writingPractice:{candidates:[{id:'topik2-writing-51',route:'writing:51',minutes:8}],open(){}},target:{localStorage:storage,document:{querySelector:()=>null},addEventListener(){},removeEventListener(){}}});
 await education.position();
 const board=panels.at(-1).html;
 assert.match(board,/data-exam="topik2"/);assert.equal(count(board,/<details class="wpos-skill"/g),12);
 assert.match(board,/TOPIK II 12개 항목: 혼자 해냄 0 · 연습 중 0 · 아직 12/);
 assert.match(board,/data-position-exam="topik1" aria-pressed="false">TOPIK I<[\s\S]*data-position-exam="topik2" aria-pressed="true">TOPIK II</);
 assert.match(board,/data-domain="writing"[\s\S]*쓰기는 맞음·틀림을 자동으로 매기지 않아[\s\S]*data-position-writing>쓰기 연습/);
 assert.match(board,/확인한 항목 0 \/ 5/);assert.match(board,/확인한 항목 0 \/ 7/);
 if(!BANK.items.some(row=>row.exam==='topik-ii'))assert.match(board,/TOPIK II 진단 문항은 준비되는 대로 열려요/,'검수 통과 TOPIK II 문항이 없으면 항목을 늘어놓지 않고 한 줄로');
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
 assert.match(goal,/내 위치 보기[\s\S]*TOPIK I 16개 항목: 혼자 해냄 0 · 연습 중 0 · 아직 16/);
 assert.doesNotMatch(goal,/study-understanding|연습에서 본 것/);
 assert.equal(education.positionTotal(),16,'「배우기」 목록의 내 위치 줄(life-ui.mjs)도 같은 항목 수를 받는다');
});

test('묶음을 받지 않은 화면은 내 위치를 열지 않는다',()=>{
 const {education,panels}=setup({position:null});
 assert.equal(education.position,undefined);
 education.open();
 assert.doesNotMatch(panels.at(-1).html,/data-view="position"/);
});

test('묶음: 진단 문항은 검수 통과 기존 문항 + 공개 은행 · 한글 층 49글자 · 한글 진도 자리는 한글 만나기와 같다',async()=>{
 const passed=worldPosition.practice.passedItems({items:(await import('../world-diagnostic-items.mjs')).DIAGNOSTIC_ITEMS,
  verdicts:(await import('../../topik-items/review/existing-verdicts.json',{with:{type:'json'}})).default,modalities:['listening','reading']});
 const examForm=passed.filter(item=>!['korean-runner','korean-rhythm'].includes(item.source));
 assert.equal(worldPosition.items.length,examForm.length+BANK.items.length,'검수 통과 기존 문항(바람길 지시문·리듬 O/X는 판정을 통과해도 빼고) + 은행 문항');
 for(const name of ['mockEvidence','selectMock','createMockSession','allowedPlays'])assert.equal(typeof worldPosition.mock[name],'function',name);
 assert.ok(worldPosition.mock.pool.some(item=>item.officialType==='TI-R-34'&&item.source==='blank-slice'),'빈칸 베기 검수 통과 문항이 34~39번 자리를 채운다');
 assert.equal(worldPosition.hangulLayer.letters.length,49);
 const learning=await import('../../hangul-stage/learning.mjs');
 assert.equal(worldPosition.hangulProgressKey,learning.progressKey);
 assert.equal(worldPosition.hangulProgressKey({},null),'synk.hangul-stage.v1','손님은 이 기기 자리');
 const host={SYNKLearningHost:{status:()=>({accountKey:'acct-1',revision:3})}};
 assert.equal(worldPosition.hangulProgressKey(host,{assignment(){}}),'synk.account.acct-1.r3.hangul-stage.v1','계정은 그 계정·학습 동의 판 자리');
 for(const name of ['buildPositionMap','selectDiagnostic','createDiagnosticSession','hangulStageProgress','showsHangulBoard','estimateGate','label','createView'])assert.equal(typeof worldPosition[name],'function',name);
 assert.ok(Object.isFrozen(worldPosition));
});
