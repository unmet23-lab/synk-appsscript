// Atlas 재설계 단계 4 관문 2 — 스위치(기능 atlasNext)가 꺼진 공개 동작은 지금과 같다(단계4_계획 §0 · §6 · §11, Fable 설계 P2-5 ①).
// 꺼진 판: 새 길 입구(world-atlas-next.mjs · /atlas/)를 부르지 않고, IndexedDB를 열지 않고, 짧은 연습은 지금 판 코치로 돈다.
// 지금 판 연습 모듈(world-reading-practice.mjs)은 전환 뒤 지우기(4-9)까지 바이트 그대로다 — 새 길은 옆 모듈(world-practice-next.mjs)에 짓는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createWorldEducation} from '../world-learning-ui.mjs';
import {worldPosition} from '../world-position-kit.mjs';
import {worldLearning} from '../world-learning-map.mjs';
import {sourceStatements} from '../../../tests/lib/source-statements.cjs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const acorn=createRequire(import.meta.url)('acorn');
const parse=source=>acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'});
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
 // 생활 화면은 시도마다 그때의 판으로 기록부를 고른다 — 셸이 감시의 판(엔진 · 확인 중 · 지금 판)을 넘긴다(GPT · 카본 합친 끝 판 GB2 · B1).
 assert.match(shell,/const lifeNext=lifeDue\?\{[^}]*state:\(\)=>lifeDue\.state\(\)\}/);
 assert.match(shell,/\n  atlasNext,\r?\n/,'학습 화면에도 같은 입구');
 assert.equal(shell.match(/import\(['"]\.\/world-atlas-next\.mjs['"]\)/g)?.length,1,'새 길 입구를 부르는 곳은 lazyAtlasNext 하나');
 for(const file of ['app-shell.mjs','world-learning-ui.mjs','world-position-ui.mjs','world-reading-practice.mjs','operating-mode.mjs'])
  assert.doesNotMatch(read(file),/^import[^;]*(world-atlas-next|world-practice-next|\/atlas\/)/m,`${file}이 새 길을 정적으로 부르지 않는다`);
});

// 셸은 node에서 못 올려 글이 유일한 지킴이다 — 4-2가 더한 줄 가운데 꺼진 판 갈래의 식을 잡는다(새 길 쪽에 조건이 한 겹 더 붙어도 견디게).
// Fable 5.2 합친 끝 판 F6 (나)(atlas-redesign-stage4-acct-life-final-20261113 — 검수자 변형 shell-next-always · shell-plan-due · shell-reminder-*).
test('꺼진 판의 셸 배선 — 생활 화면의 next · 홈 계획의 due는 입구가 있을 때만 넘기고, 알림 입력은 판정이 없으면 진도의 dueAt 그대로다(Fable 5.2 합친 끝 판 F6 (나))',()=>{
 const shell=read('app-shell.mjs'),line=head=>shell.split(/\r?\n/).filter(text=>text.includes(head));
 // 생활 화면: 판 겉 입구(next)는 lifeNext가 있을 때만 — 꺼진 판은 { coach · prepare · life } 그대로(4-2 앞).
 assert.match(shell,/learning:\{coach:[^\n]*?life:worldLearning\.life,\.\.\.\(lifeNext\b[^?\n]*\?\{next:lifeNext\b[^}\n]*\}:\{\}\)\}/);
 // 홈 계획: 판정(due)은 lifeDue가 있을 때만 — 꺼진 판은 진도의 간격으로 고른다. due를 넘기는 자리는 그 하나다.
 const plan=line('const createPlan=options=>');
 assert.equal(plan.length,1);
 assert.match(plan[0],/\.\.\.\(lifeDue\b[^?]*\?\{due:[^]*\}:\{\}\)\}\);\s*$/);
 assert.equal(plan[0].match(/\bdue:/g)?.length,1,'due를 넘기는 자리는 lifeDue 갈래 하나');
 // 알림 입력: 판정이 없으면(judged null — 입구가 없어 lifeDue도 없다) 복습 기록의 dueAt 그대로, 돌아올 것은 그 dueAt이 있는가.
 assert.match(shell,/const judged=[^,\n]*?life\.lifeDue\?\.judge\((?:[^()\n]|\([^()\n]*\))*\)\?\?null,records=Object\.values\(snapshot\.reviews\|\|\{\}\);/);
 assert.match(shell,/const reviews=judged\?[^\n]*:records\.map\(review=>review\?\.dueAt\)\.filter\(Number\.isFinite\);/);
 assert.match(shell,/hasReturn:\(judged\?[^\n]*?:reviews\.length>0\)\|\|/);
});

// 셸의 알림 입력(reminderInputs) 원문을 떼어 돌린다(tests/lib/source-statements.cjs — 셸은 node에서 못 올린다). 바깥 이름은 life · studyTimes 둘이다.
let reminderSource=null;
const reminderInputs=(life,studyTimes=()=>['공부한 시각'])=>new Function('life','studyTimes',`'use strict';${reminderSource??=sourceStatements(read('app-shell.mjs')).function('reminderInputs')}\nreturn reminderInputs;`)(life,studyTimes)();

test('꺼진 판의 알림 입력(셸 원문) — 판정 없이 진도의 dueAt 그대로 · 돌아올 것은 그 dueAt이나 시험 날짜가 있는가(Fable 5.2 합친 끝 판 F6 (나))',()=>{
 const at=Date.UTC(2026,10,13,3,0,0);
 const reviews={'r-1':{id:'r-1',dueAt:at+60000},'r-2':{id:'r-2',dueAt:at-86400000},'r-3':{id:'r-3',dueAt:null},'r-4':{id:'r-4',dueAt:at+3*86400000}};
 const exam={metrics:()=>({plan:{examPlan:{exam:{date:'2027-01-17'},goals:[]}}})};
 // 꺼진 판의 세션은 lifeDue 자리가 비어 있다(world-session part() → null). 넣은 판정이 아예 없는 꼴(undefined)도 같다.
 for(const lifeDue of [null,undefined]){
  const life=(snapshot,education=null)=>({progress:{exportSnapshot:()=>snapshot},education,lifeDue});
  assert.deepEqual(reminderInputs(life({reviews,hangul:{answer:'reads'}})),{reviews:[at+60000,at-86400000,at+3*86400000],exam:null,examPlan:null,studyTimes:['공부한 시각'],hangulStage:false,hasReturn:true},'복습 기록의 dueAt 그대로(차례 · 지난 것 포함, 수가 아닌 것만 뺀다)');
  assert.deepEqual(reminderInputs(life({reviews:{},hangul:{answer:'new'}})),{reviews:[],exam:null,examPlan:null,studyTimes:['공부한 시각'],hangulStage:true,hasReturn:false},'복습도 시험도 없으면 돌아올 것이 없다');
  assert.equal(reminderInputs(life({reviews:{'r-3':reviews['r-3']}})).hasReturn,false,'꺼진 판에서 돌아올 것은 때(dueAt)가 있는 복습이다');
  const withExam=reminderInputs(life({reviews:{}},exam));
  assert.deepEqual([withExam.reviews,withExam.exam,withExam.hasReturn],[[],{date:'2027-01-17'},true],'시험 날짜(YYYY-MM-DD)만 있어도 돌아올 것이 있다');
  assert.equal(reminderInputs(life({reviews:{}},{metrics:()=>({plan:{examPlan:{exam:{date:'2027-01'}}}})})).hasReturn,false,'달만 아는 시험은 돌아올 것이 아니다');
  assert.equal(reminderInputs({progress:null,education:null,lifeDue}),null,'진도가 없으면 알림 입력도 없다');
 }
});

// 꺼진 판이 정적으로 받는 모듈(첫 화면 · 계정 묶음 · 생활 단독 묶음에 실리는 것)은 새 길 입구 · 판 · 엔진을 부르지 않는다. import 글은 파서로 읽는다
// (한 줄에 이어 붙인 import도 잡는다). 묶음에 실리는 모듈의 동적 import는 묶음에 같이 실리므로(esbuild는 쪼개지 않고 싣는다) 그것도 본다.
// 새 길 표지: 입구(world-atlas-next) · 연습 판(world-practice-next) · 엔진(/atlas/… — 서버가 내는 절대 주소 · packages/atlas 원천).
// 지금 판 엔진(저장소의 atlas/ — ../../atlas/game-browser.js 등)은 4-2 앞부터 첫 화면 묶음에 있다.
const NEXT_PATH=specifier=>/world-atlas-next|world-practice-next/.test(specifier)||specifier.startsWith('/atlas/')||/(^|\/)packages\/atlas\//.test(specifier);
function importsOf(source){
 const found=[],stack=[parse(source)];
 while(stack.length){
  const node=stack.pop();
  if(!node||typeof node.type!=='string')continue;
  if(['ImportDeclaration','ExportAllDeclaration','ExportNamedDeclaration'].includes(node.type)&&node.source)found.push({kind:'static',specifier:String(node.source.value)});
  if(node.type==='ImportExpression')found.push({kind:'dynamic',specifier:node.source.type==='Literal'?String(node.source.value):'(식)'});
  for(const value of Object.values(node))if(value&&typeof value==='object')stack.push(...(Array.isArray(value)?value:[value]));
 }
 return found;
}
const FIRST_SCREEN=['app-shell.mjs','world-learning-ui.mjs','world-position-ui.mjs','world-reading-practice.mjs','operating-mode.mjs'];
// 4-2가 첫 화면 닫힘(계정 묶음 · 생활 단독 묶음)에 넣은 모듈 — world-learning-map이 world-life-next를 정적으로 받는다.
const LIFE_CLOSURE=['world-learning-map.mjs','world-life-next.mjs','life-ui.mjs','life-progress.mjs'];
test('첫 화면 · 생활 묶음에 실리는 모듈은 새 길을 부르지 않고, 생성 묶음 둘에 새 길 입구 · IndexedDB · /atlas/ 글이 없다(Fable 5.2 합친 끝 판 F6 (다))',()=>{
 for(const file of [...FIRST_SCREEN,...LIFE_CLOSURE]){
  const imports=importsOf(read(file));
  if(LIFE_CLOSURE.includes(file))assert.ok(imports.length>0,`${file}: import를 읽었다`);
  assert.deepEqual(imports.filter(row=>row.kind==='static'&&NEXT_PATH(row.specifier)).map(row=>row.specifier),[],`${file}이 새 길을 정적으로 부르지 않는다`);
 }
 for(const file of LIFE_CLOSURE)
  assert.deepEqual(importsOf(read(file)).filter(row=>row.kind==='dynamic'&&(row.specifier==='(식)'||NEXT_PATH(row.specifier))).map(row=>row.specifier),[],`${file}(묶음에 실림)은 새 길을 동적으로도 부르지 않는다`);
 // 생성 묶음(node tools/build-world-account.mjs · build-world-life.mjs가 굽는다): 다시 구워 짝 검사가 지나가도 새 길이 실리면 여기서 깨진다.
 for(const bundle of ['world-account.bundle.mjs','../brand-opening/content/life-standalone.mjs']){
  const text=read(bundle);
  assert.ok(text.length>100000,`${bundle}을 읽었다`);
  for(const marker of ['world-atlas-next','world-practice-next','indexedDB','/atlas/'])assert.ok(!text.includes(marker),`${bundle}에 「${marker}」 글이 없다`);
 }
});

// world-life-next.mjs(새 길의 판 겉 · 판정)는 world-learning-map.mjs가 정적으로 받아 꺼진 판의 계정 묶음 · 생활 단독 묶음에도 실린다 — 맨 위에서
// 아무것도 돌지 않아야 한다(import · 상수 · 함수 선언뿐). 맨 위에 부름 · 읽기 · 바꾸기가 들면 라이브 첫 화면에서 바로 돈다(Fable 5.2 합친 끝 판 넘친 #28).
// 상수의 값은 글자 · 수 · 배열 · 객체 · 함수 식과 그 모듈의 이름만(전역 읽기도 막는다 — 게터가 돌 수 있다). Object.freeze · new Set/Map만 둔다.
function topLevelEffects(source){
 const body=parse(source).body,names=new Set(['undefined','NaN','Infinity']);
 for(const node of body){
  const declaration=node.type.startsWith('Export')&&node.declaration?node.declaration:node;
  if(node.type==='ImportDeclaration')for(const s of node.specifiers)names.add(s.local.name);
  if(declaration.type==='VariableDeclaration')for(const d of declaration.declarations)if(d.id.type==='Identifier')names.add(d.id.name);
  if(['FunctionDeclaration','ClassDeclaration'].includes(declaration.type)&&declaration.id)names.add(declaration.id.name);
 }
 const pure=node=>{
  switch(node?.type){
   case 'Literal':case 'ArrowFunctionExpression':case 'FunctionExpression':return true; // 함수의 몸은 맨 위에서 돌지 않는다
   case 'Identifier':return names.has(node.name);
   case 'TemplateLiteral':return node.expressions.every(pure);
   case 'ArrayExpression':return node.elements.every(element=>element===null||element.type!=='SpreadElement'&&pure(element));
   case 'ObjectExpression':return node.properties.every(p=>p.type==='Property'&&!p.computed&&pure(p.value));
   case 'UnaryExpression':return node.operator!=='delete'&&pure(node.argument);
   case 'BinaryExpression':case 'LogicalExpression':return pure(node.left)&&pure(node.right);
   case 'ConditionalExpression':return pure(node.test)&&pure(node.consequent)&&pure(node.alternate);
   case 'CallExpression':return node.callee.type==='MemberExpression'&&!node.callee.computed&&node.callee.object.name==='Object'&&node.callee.property.name==='freeze'&&node.arguments.every(pure);
   case 'NewExpression':return node.callee.type==='Identifier'&&['Set','Map','WeakSet','WeakMap'].includes(node.callee.name)&&node.arguments.every(pure);
   default:return false;
  }
 };
 const quiet=node=>{
  if(node.type==='ImportDeclaration')return node.specifiers.length>0; // 이름 없는 import는 맨 위 부수 효과만을 위한 것이다
  if(node.type==='ExportNamedDeclaration')return node.declaration?quiet(node.declaration):true;
  if(node.type==='ExportDefaultDeclaration')return ['FunctionDeclaration','ClassDeclaration'].includes(node.declaration.type)?quiet(node.declaration):pure(node.declaration);
  if(node.type==='FunctionDeclaration'||node.type==='EmptyStatement')return true;
  if(node.type==='VariableDeclaration')return node.kind!=='var'&&node.declarations.every(d=>d.id.type==='Identifier'&&(d.init===null||pure(d.init)));
  if(node.type==='ClassDeclaration')return (!node.superClass||pure(node.superClass))&&node.body.body.every(member=>member.type==='MethodDefinition'&&!member.computed||member.type==='PropertyDefinition'&&!member.static&&!member.computed);
  return false;
 };
 return body.filter(node=>!quiet(node)).map(node=>source.slice(node.start,Math.min(node.end,node.start+80)));
}
test('world-life-next.mjs는 꺼진 판 묶음에 정적으로 실리므로 맨 위에서 아무것도 돌지 않는다 — import · 상수 · 함수 선언뿐(Fable 5.2 합친 끝 판 넘친 #28)',()=>{
 const source=read('world-life-next.mjs');
 assert.deepEqual(topLevelEffects(source),[],'맨 위의 실행 문장');
 assert.ok(parse(source).body.some(node=>node.type==='ExportNamedDeclaration'&&node.declaration?.type==='FunctionDeclaration'&&node.declaration.id.name==='watchLifeDue'),'판정 감시는 함수 선언으로만 실린다');
 // 시험이 실행 문장을 실제로 잡는지 — 한 줄씩 더한 꼴.
 for(const extra of ["globalThis.indexedDB?.open?.('synk');","const STORE=globalThis.localStorage;","const READY=watchLifeDue({});","import './world-atlas-next.mjs';","await Promise.resolve();","let n=0;n++;"])
  assert.equal(topLevelEffects(`${source}\n${extra}\n`).length,1,extra);
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
