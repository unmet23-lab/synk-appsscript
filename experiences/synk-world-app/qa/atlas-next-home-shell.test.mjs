// Atlas 재설계 단계 4-3 — 새 길 홈의 셸(world-learning-ui.mjs refresh)을 가짜 홈과 가짜 홈 입구로 돈다. 판이 지금 판으로 내려와도(플래너를
// 못 받음 · 생활 판정이 지금 판) 지금 판으로 다시 그린 뒤 열린 배우기 허브를 맞추는지(painted → 허브 syncToday) 본다(카본 엔진급 끝 판 B3).
// 세 줄 자체는 atlas-next-home.test.mjs가 진짜 엔진으로 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorldEducation} from '../world-learning-ui.mjs';
import {worldPosition} from '../world-position-kit.mjs';
import {worldLearning} from '../world-learning-map.mjs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
worldPosition.topik.use(JSON.parse(read('world-topik-items.json')));

// 손님 셸 하나 — 홈이 받은 판(새 길이면 today.state, 지금 판이면 old)과 허브 맞춤(painted)을 차례로 남긴다.
function world(homeNext){
 const log=[];
 const values=new Map();
 const progress={owner:'guest',learningProfile:()=>({profile:{status:'active',revision:1,consent:true}}),learningProfileValues:()=>({audio:'on'}),
  status:()=>({phase:'synced',rejected:false,scoped:false,message:''}),exportSnapshot:()=>({}),flush:async()=>{},hangulReading:()=>({answer:'reads'})};
 const home={updateStudy:plan=>log.push(plan?.today?`study:${plan.today.state}`:'study:old'),toast(){},closePanel(){},attachPanelResource(){},showPanel(){}};
 const target={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},
  addEventListener(){},removeEventListener(){},setTimeout,document:{querySelector:()=>null}};
 const education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:()=>({selected:null,reason:''}),launchGame(){},startLesson(){},startReview(){},
  position:worldPosition,target,homeNext:{judge:()=>null,answers:()=>null,openGames:()=>null,coach:async()=>null,retired:()=>()=>{},painted:()=>log.push('painted'),...homeNext}});
 return {education,log};
}
const ticks=async()=>{for(let i=0;i<20;i+=1)await new Promise(resolve=>setTimeout(resolve,0));};

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
 const today={items:[],minutes:0,line:null,empty:{code:'done',text:null},capped:false,cappedText:null,firstDay:false,state:'engine',redrawAt:null};
 const planner={todayKey:()=>'2026-11-16',say:()=>null,
  createWorldTodayPlan:()=>({status:'empty',selected:null,selectedKind:null,reason:'',resume:null,candidates:[],examPlan:null,today}),
  watchHomePlan:()=>({phase:()=>'engine',coach:()=>null,redrawAt(){},dispose(){}})};
 const w=world({planner:async()=>planner,life:()=>life});
 await ticks();
 assert.deepEqual(w.log.slice(-2),['study:engine','painted'],'엔진 판');
 life='old';
 w.education.refresh();
 assert.deepEqual(w.log.slice(-2),['study:old','painted'],'지금 판으로 다시 그린 뒤 허브를 맞춘다');
 assert.equal(w.education.today(),null);
 w.education.dispose();
});
