// Atlas 재설계 단계 4-3 — 새 길 홈의 셸(world-learning-ui.mjs refresh)을 가짜 홈과 가짜 홈 입구로 돈다. 세 줄 자체는 atlas-next-home.test.mjs가
// 진짜 엔진으로 본다. 여기서는 셸이 판을 그리는 차례를 본다.
//   · 판이 지금 판으로 내려와도(플래너를 못 받음 · 생활 판정이 지금 판) 지금 판으로 다시 그린 뒤 열린 배우기 허브를 맞춘다(카본 엔진급 끝 판 B3).
//   · 허브 맞춤은 잠금을 푼 뒤에 부른다 — 허브가 다시 그리며 부른 refresh가 버려지지 않는다(Fable 엔진급 끝 판 F1).
//   · 홈 코치는 공개 TOPIK 은행을 기다리고, 늦게 오면 온 뒤 한 번 다시 연다(Fable 엔진급 끝 판 F2).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorldEducation} from '../world-learning-ui.mjs';
import {worldPosition} from '../world-position-kit.mjs';
import {worldLearning} from '../world-learning-map.mjs';
import * as homeToday from '../world-today.mjs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
worldPosition.topik.use(JSON.parse(read('world-topik-items.json')));

// 손님 셸 하나 — 홈이 받은 판(새 길이면 today.state, 지금 판이면 old)과 허브 맞춤(painted)을 차례로 남긴다.
function world(homeNext,{log=[],position=worldPosition}={}){
 const values=new Map();
 const progress={owner:'guest',learningProfile:()=>({profile:{status:'active',revision:1,consent:true}}),learningProfileValues:()=>({audio:'on'}),
  status:()=>({phase:'synced',rejected:false,scoped:false,message:''}),exportSnapshot:()=>({}),flush:async()=>{},hangulReading:()=>({answer:'reads'})};
 const home={updateStudy:plan=>log.push(plan?.today?`study:${plan.today.state}`:'study:old'),toast(){},closePanel(){},attachPanelResource(){},showPanel(){}};
 const target={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},
  addEventListener(){},removeEventListener(){},setTimeout,document:{querySelector:()=>null}};
 const education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:()=>({selected:null,reason:''}),launchGame(){},startLesson(){},startReview(){},
  position,target,homeNext:{judge:()=>null,answers:()=>null,openGames:()=>null,coach:async()=>null,retired:()=>()=>{},painted:()=>log.push('painted'),...homeNext}});
 return {education,log};
}
const ticks=async()=>{for(let i=0;i<20;i+=1)await new Promise(resolve=>setTimeout(resolve,0));};
async function until(ready,label,limit=10000){
 const end=Date.now()+limit;
 while(!ready()&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,20));
 assert.ok(ready(),`셸이 한도 안에 닿았다: ${label}`);
}
// 엔진 판의 가짜 플래너 — 세 줄은 비고 판은 엔진이다(감시도 가짜).
function enginePlanner(){
 const today={items:[],minutes:0,line:null,empty:{code:'done',text:null},capped:false,cappedText:null,firstDay:false,state:'engine',redrawAt:null};
 return {todayKey:()=>'2026-11-16',say:()=>null,
  createWorldTodayPlan:()=>({status:'empty',selected:null,selectedKind:null,reason:'',resume:null,candidates:[],examPlan:null,today}),
  watchHomePlan:()=>({phase:()=>'engine',coach:()=>null,redrawAt(){},dispose(){}})};
}

test('플래너를 못 받아 지금 판으로 내려오면 지금 판으로 다시 그리고 열린 배우기 허브도 맞춘다 — 확인 중 포스터에 굳지 않는다(카본 엔진급 끝 판 B3)',async()=>{
 const w=world({planner:async()=>null,life:()=>'engine'});
 w.education.refresh();
 assert.deepEqual(w.log,['study:checking','painted'],'플래너를 받기 전에는 확인 중');
 await ticks();
 assert.deepEqual(w.log.slice(-2),['study:old','painted'],'지금 판으로 다시 그린 뒤 허브를 맞춘다');
 assert.equal(w.education.today(),null);
 w.education.dispose();
});

test('생활 판정이 엔진에서 지금 판으로 바뀌어도 지금 판으로 다시 그리고 허브를 맞춘다(카본 엔진급 끝 판 B3)',async()=>{
 let life='engine';
 const w=world({planner:async()=>enginePlanner(),life:()=>life});
 await ticks();
 assert.deepEqual(w.log.slice(-2),['study:engine','painted'],'엔진 판');
 life='old';
 w.education.refresh();
 assert.deepEqual(w.log.slice(-2),['study:old','painted'],'지금 판으로 다시 그린 뒤 허브를 맞춘다');
 assert.equal(w.education.today(),null);
 w.education.dispose();
});

test('허브를 연 채 세 줄이 바뀌어 허브가 다시 그려도 홈에 마지막으로 닿는 것은 세 줄 판이다 — 허브 맞춤은 잠금을 푼 뒤에 부른다(Fable 엔진급 끝 판 F1)',async()=>{
 const log=[];let w=null,redraw=false;
 // 허브가 다시 그리면 홈의 진도 요약 줄을 고치고(updateLearning) 학습 화면에 다시 계획하라고 한다(life-ui.mjs updateHome → onSummary).
 // 세 줄이 그대로면 허브는 다시 그리지 않는다(syncToday).
 const painted=()=>{log.push('painted');if(!redraw)return;redraw=false;log.push('learning');w.education.refresh();};
 w=world({planner:async()=>enginePlanner(),life:()=>'engine',painted},{log});
 await ticks();
 assert.deepEqual(log.slice(-2),['study:engine','painted']);
 redraw=true;
 w.education.refresh();
 assert.deepEqual(log.slice(-5),['study:engine','painted','learning','study:engine','painted'],'허브가 다시 그린 뒤 세 줄 판을 다시 그린다');
 w.education.dispose();
});

test('공개 TOPIK 은행이 홈 코치보다 늦게 오면 은행이 온 뒤 홈 코치를 한 번 다시 연다 — 은행 문항의 단위를 알게(Fable 엔진급 끝 판 F2)',async()=>{
 const log=[];let release=null;
 const pool=[{itemKey:'game.a',skillId:'ko.reading.a',modality:'reading'}];
 const topik={ready:false,load:()=>new Promise(resolve=>{release=()=>{topik.ready=true;pool.push({itemKey:'topik.b',skillId:'ko.reading.b',modality:'reading'});resolve();};})};
 // 진짜 위치 도구(얼린 객체라 Proxy로는 못 덮는다)를 바탕으로 두고 은행과 짧은 연습 풀만 제 칸으로 덮는다.
 const practice=Object.create(worldPosition.practice,{pool:{get:()=>pool}});
 const position=Object.create(worldPosition,{topik:{value:topik},practice:{value:practice}});
 // 새 길 홈 코치는 받기 알림(watch)을 낸다 — 겉에 watch가 없으면 셸이 이 문서를 지금 판으로 내린다(4-4b 다시 검수 -d Fable P3).
 const coach={plan:()=>[],summary:()=>({storage:{base:true,waiting:false}}),due:()=>[],itemUnits:()=>[],watch:()=>()=>{}};
 // 플래너는 진짜 세 줄 모듈(감시 · 계획)이고, 홈 입구의 코치만 가짜다 — 연 때의 풀 크기를 남긴다.
 const w=world({planner:async()=>({...homeToday,say:()=>null}),life:()=>'engine',judge:()=>({state:'engine',items:[],times:[]}),
  coach:async items=>{log.push(`coach:${items.length}`);return coach;}},{log,position});
 await until(()=>log.includes('coach:1'),'은행을 기다린 뒤 은행 없이 연 홈 코치');
 assert.ok(release,'은행을 받기 시작했다');
 release();
 await until(()=>log.includes('coach:2'),'은행이 온 뒤 다시 연 홈 코치');
 assert.deepEqual(log.filter(line=>line.startsWith('coach:')),['coach:1','coach:2'],'은행을 잠깐 기다린 뒤 은행 없이 열고, 은행이 온 뒤 한 번 다시 연다');
 w.education.dispose();
});
