// Atlas 재설계 단계 4 관문 2 — 스위치(기능 atlasNext)가 꺼진 공개 동작은 지금과 같다(단계4_계획 §0 · §6 · §11, Fable 설계 P2-5 ①).
// 꺼진 판: 새 길 입구(world-atlas-next.mjs · /atlas/)를 부르지 않고, IndexedDB를 열지 않고, 짧은 연습은 지금 판 코치로 돈다.
// 지금 판 연습 모듈(world-reading-practice.mjs)은 전환 뒤 지우기(4-9)까지 바이트 그대로다 — 새 길은 옆 모듈(world-practice-next.mjs)에 짓는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {createWorldEducation} from '../world-learning-ui.mjs';
import {worldPosition} from '../world-position-kit.mjs';
import {worldLearning} from '../world-learning-map.mjs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const BANK=JSON.parse(read('world-topik-items.json'));
worldPosition.topik.use(BANK);
const KEY='synk.atlas.learning.v1.device';
// 단계 4-1 시작 때의 지금 판 연습 모듈(945ce3714b). 이 값이 바뀌면 꺼진 판의 동작이 바뀐 것이다 — 고칠 일은 새 길 모듈에 한다.
// 줄끝은 LF로 맞춰 잰다(윈도우 작업본은 CRLF로 풀린다).
const PRACTICE_SHA256='7467d775500e51949ac5400769b148b54904682e847e39bcf065d5d842571fd3';

test('셸은 기능이 켜졌을 때만 새 길 입구를 동적으로 부르고, 첫 화면 모듈은 새 길을 정적으로 부르지 않는다',()=>{
 const shell=read('app-shell.mjs');
 assert.match(shell,/const atlasNextOn=connection\.features\?\.atlasNext===true;/);
 // 기능이 꺼지면 null — 켜졌을 때만 주인 수명(keep)에 걸어 둔 새 길 입구를 넘긴다(주인이 바뀌면 닫힌다, 화면 검수 카본 A6).
 // 4-2(§19-1 ⑤ M7): 입구는 생활 화면보다 먼저 서고, 생활 판정(lifeDue)도 입구가 있을 때만 — 꺼진 판은 판정을 넣지 않아 지금 판 그대로다.
 // 손님 깃발(atlasNextGuest)이 꺼져 있으면 손님 주인은 atlasNext가 켜져도 입구가 없다(null — 아래 꺼진 판의 짧은 연습과 같은 길: 새 길 모듈 ·
 // IndexedDB 0건, Fable 5.2 끝 판 둘째 F1).
 assert.match(shell,/const atlasNextGuestOn=atlasNextOn&&connection\.features\?\.atlasNextGuest===true;/);
 assert.match(shell,/const atlasNext=atlasNextOn&&\(owner!=='guest'\|\|atlasNextGuestOn\)\?keep\('atlasNext',lazyAtlasNext\(owner\)\):null;/);
 assert.match(shell,/const lifeDue=atlasNext&&progress&&/);
 assert.match(shell,/\n  atlasNext,\r?\n/,'학습 화면에도 같은 입구');
 assert.equal(shell.match(/import\(['"]\.\/world-atlas-next\.mjs['"]\)/g)?.length,1,'새 길 입구를 부르는 곳은 lazyAtlasNext 하나');
 for(const file of ['app-shell.mjs','world-learning-ui.mjs','world-position-ui.mjs','world-reading-practice.mjs','operating-mode.mjs'])
  assert.doesNotMatch(read(file),/^import[^;]*(world-atlas-next|world-practice-next|\/atlas\/)/m,`${file}이 새 길을 정적으로 부르지 않는다`);
});

test('손님 깃발 — 설정 거름은 atlasNextGuest를 알고 리허설에서만 넘기며, atlasNext 없이 손님 깃발만으로는 셸이 입구를 주지 않는다',async()=>{
 const {publicWorldConfig}=await import('../operating-mode.mjs');
 assert.deepEqual(publicWorldConfig({mode:'rehearsal',features:{atlasNext:true}}).features,{atlasNext:true},'손님 깃발 없이 켜면 계정만');
 assert.deepEqual(publicWorldConfig({mode:'rehearsal',features:{atlasNext:true,atlasNextGuest:true}}).features,{atlasNext:true,atlasNextGuest:true});
 assert.deepEqual(publicWorldConfig({mode:'rehearsal',features:{atlasNext:true,atlasNextGuest:false}}).features,{atlasNext:true});
 const shell=read('app-shell.mjs');
 assert.match(shell,/const atlasNextGuestOn=atlasNextOn&&/,'손님 깃발은 atlasNext가 켜졌을 때만 뜻이 있다');
});

test('지금 판 연습 모듈은 바이트 그대로다(전환 뒤 지우기 4-9까지)',()=>{
 assert.equal(crypto.createHash('sha256').update(read('world-reading-practice.mjs').replace(/\r\n/g,'\n')).digest('hex'),PRACTICE_SHA256);
});

// 판 상자: innerHTML 글을 들고 단추 누르기만 흉내 낸다(world-set-response.test.mjs와 같은 방식, 이 저장소에 DOM 도구가 없다).
function stage(){
 const clicks=[];
 const box={html:'',isConnected:true,get innerHTML(){return this.html;},set innerHTML(value){this.html=String(value);},
  addEventListener(type,fn){if(type==='click')clicks.push(fn);},contains:()=>true,closest:()=>null,focus(){},querySelectorAll:()=>[],
  querySelector:()=>({focus(){},addEventListener(){}})};
 box.press=(attr,value='')=>{
  const camel=attr.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
  const button={dataset:{[camel]:value},disabled:false,hasAttribute:name=>name===attr};
  for(const fn of [...clicks])fn({target:{closest:selector=>selector==='button'||selector.includes(attr)?button:null}});
 };
 return box;
}

test('꺼진 판의 짧은 연습: IndexedDB · /atlas/ 요청 없이 지금 판 코치로 돌고, 기록은 지금 판 저장소에 남는다',async()=>{
 const touched={idb:0,atlas:0};
 const idb=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
 const fetch=globalThis.fetch;
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,get(){touched.idb+=1;return undefined;}});
 globalThis.fetch=async(url,...rest)=>{if(String(url).includes('/atlas/'))touched.atlas+=1;return fetch(url,...rest);};
 try{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  let box=null;
  const progress={owner:'guest',learningProfile:()=>({profile:{status:'active',revision:1,consent:true}}),learningProfileValues:()=>({audio:'off'}),
   status:()=>({phase:'synced',rejected:false,scoped:false,message:''}),exportSnapshot:()=>({}),flush:async()=>{},hangulReading:()=>({answer:'reads'})};
  const home={updateStudy(){},toast(){},closePanel(){},attachPanelResource(){},showPanel:(title,html)=>{if(/data-practice-stage/.test(html))box=stage();}};
  const target={localStorage:storage,addEventListener(){},removeEventListener(){},setTimeout,document:{querySelector:selector=>/data-practice-stage/.test(selector)?box:null}};
  // atlasNext를 넘기지 않는다 — 셸이 기능 꺼짐에서 넘기는 값(null)과 같다.
  const education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:()=>({selected:null,reason:''}),launchGame(){},startLesson(){},startReview(){},position:worldPosition,target});
  const skillId=worldPosition.practice.pool.find(item=>/^ko\.reading\./.test(item.skillId)).skillId;
  await education.practice(skillId);
  assert.ok(box,'짧은 연습 판이 열렸다');
  for(let guard=0;guard<40&&!box.html.includes('data-practice-done');guard+=1){
   if(box.html.includes('data-practice-feedback'))box.press('data-practice-next');
   else box.press('data-practice-choice',/data-practice-choice="([^"]+)"/.exec(box.html)[1]);
  }
  assert.match(box.html,/data-practice-done/);
  assert.doesNotMatch(box.html,/data-practice-ending/,'새 판 끝 화면이 아니다');
  const events=JSON.parse(values.get(KEY)||'{"events":[]}').events;
  assert.ok(events.some(event=>event.type==='practice.presented'),'지금 판 코치가 제시를 남겼다');
  assert.ok(events.every(event=>event.schema!==2),'2판 사건이 없다');
  assert.deepEqual(touched,{idb:0,atlas:0},'IndexedDB · /atlas/를 건드리지 않는다');
 }finally{
  if(idb)Object.defineProperty(globalThis,'indexedDB',idb);else delete globalThis.indexedDB;
  globalThis.fetch=fetch;
 }
});
