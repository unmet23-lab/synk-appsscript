// Atlas 재설계 단계 4 ④ — WORLD 새 길 입구(world-atlas-next.mjs)의 계정 판 정하기(단계4_계획 §18-2 1 · §18-5-5 B4 · F6 · G4 · F7),
// 셸 알림(onAccount)에 따른 다시 정하기, 손님 → 계정 옮기기 물음(§18-5-3), 리허설 나르개 · 옛 POST 묶음.
// 앞쪽은 가짜 코치로 갈래를 하나씩 돌고, 끝의 한 바퀴는 진짜 엔진 코치 + 리허설 trail(rehearsal-trail.mjs)로 돈다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import {createAtlasNext,rehearsalTrail,postLegacyBatches,askSwitch,NEXT_MARK,LEGACY_KEY} from '../world-atlas-next.mjs';
import {createRehearsalTrail} from '../rehearsal-trail.mjs';
import {createPracticeNextSession} from '../world-practice-next.mjs';
import {bankItems} from '../world-topik-items.mjs';
import {allowedPlays,nextPlay} from '../world-exam-form.mjs';

const POOL=[{itemKey:'topik-items.x1'}];
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function until(check,ms=8000){const end=Date.now()+ms;for(;;){const value=await check();if(value)return value;if(Date.now()>end)throw Error('기다린 일이 오지 않았다');await new Promise(resolve=>setTimeout(resolve,20));}}

function memoryStorage(entries=[]){
 const map=new Map(entries);
 return {map,getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>{map.set(key,String(value));},removeItem:key=>{map.delete(key);}};
}
const markOf=(storage,owner)=>JSON.parse(storage.getItem(NEXT_MARK+owner)??'{}');

// 가짜 계정 길 — 셸의 trail()처럼 부를 때마다 지금 값을 돌려준다. get(since, revision)은 state.get이 정한다.
function accountLine({enabled=true,revision=1,learningSync=true,get=async()=>({summary:null,serverTime:0})}={}){
 const state={enabled,revision,learningSync,get,reads:0,gets:[],legacy:[]};
 state.trail=async()=>{
  state.reads+=1;
  return {learning:{enabled:state.enabled,revision:state.revision},learningSync:state.learningSync,
   transport:at=>({get:since=>{state.gets.push({at,since});return state.get(since,at);},post:async()=>({accepted:[],clamped:[],summary:null,serverTime:0})}),
   postLegacy:async events=>{state.legacy.push(events);return {ok:true};}};
 };
 return state;
}
const fail=(status,code,extra={})=>Object.assign(Error(code),{status,code,...extra});

// 가짜 코치 · 로더 — 엔진 모듈(SynkAtlas.load)은 storeName · createHealth만.
function fakeCoach({base=false,synced={ok:true,base:true},ready=Promise.resolve(),guestRecords=async()=>null}={}){
 const made={options:null,disposed:0,syncedCalls:0,ready,summary:()=>({storage:{base}}),synced:async()=>{made.syncedCalls+=1;return synced;},
  guestRecords:async options=>guestRecords(options),dispose(){made.disposed+=1;}};
 return made;
}
function fakeLoader(make=()=>fakeCoach(),{health=null}={}){
 const opened=[];
 const engine={storeName:atlas.storeName,...(health?{createHealth:()=>health}:{})};
 return {opened,load:async()=>({coach:options=>{const made=make(options);made.options=options;opened.push(made);return made;},SynkAtlas:{load:async()=>engine}})};
}
function recorder(){const notes=[];return {notes,note:(kind,outcome)=>notes.push([kind,outcome]),snapshot:()=>({notes:notes.length})};}

test('처음인 기기 — 첫 받기가 요약(빈 요약 포함)을 받으면 새 길이고 「새 길 간 적 있음」을 남긴다, 다음 연습은 연 코치를 다시 쓴다',async()=>{
 const storage=memoryStorage(),line=accountLine(),{opened,load}=fakeLoader(),health=recorder();
 const next=createAtlasNext({owner:'acct-1',storage,trail:line.trail,load,health});
 const coach=await next.practiceCoach(POOL);
 assert.equal(coach,opened[0]);
 const host=coach.options.host;
 assert.equal(host.account,'acct-1');assert.equal(host.revision,1);assert.equal(host.guest,undefined);assert.equal(host.legacy,undefined,'계정 길에는 손님 옛 기록 읽개가 없다');
 assert.equal(typeof host.transport.get,'function');assert.equal(typeof host.onAccount,'function');assert.equal(host.health,health);
 assert.equal(coach.syncedCalls,1,'처음인 기기는 첫 받기를 기다린다');
 assert.deepEqual(markOf(storage,'acct-1'),{went:true});
 assert.equal(await next.practiceCoach(POOL),coach);assert.equal(opened.length,1);
 assert.deepEqual(health.notes.at(-1),['load',{ok:true}]);
 next.dispose();
});

test('처음인 기기 — 첫 받기가 안 되면 이번 문서는 지금 판(까닭은 계기), 연습마다 첫 받기를 다시 기다리지 않는다',async()=>{
 const storage=memoryStorage(),line=accountLine(),health=recorder();
 const {opened,load}=fakeLoader(()=>fakeCoach({synced:{ok:false,kind:'offline',code:'NETWORK'}}));
 const next=createAtlasNext({owner:'acct-2',storage,trail:line.trail,load,health});
 assert.equal(await next.practiceCoach(POOL),null);
 assert.equal(opened[0].disposed,1,'연 코치를 닫는다');
 assert.deepEqual(health.notes.at(-1),['load',{ok:false,code:'PATH_NETWORK'}]);
 assert.equal(await next.practiceCoach(POOL),null);
 assert.equal(opened.length,1,'이번 문서에서는 다시 열지 않는다');
 assert.deepEqual(markOf(storage,'acct-2'),{});
});

test('계정을 못 읽은 실패(네트워크 · 인증)는 붙들지 않는다 — 이번 연습은 지금 판, 다음 연습에서 다시 읽는다',async()=>{
 const line=accountLine();let down=true;const real=line.trail;
 line.trail=async()=>{if(down)throw Object.assign(Error('NETWORK'),{code:'NETWORK'});return real();};
 const health=recorder(),{load}=fakeLoader();
 const next=createAtlasNext({owner:'acct-19',storage:memoryStorage(),trail:()=>line.trail(),load,health});
 assert.equal(await next.practiceCoach(POOL),null);
 assert.deepEqual(health.notes.at(-1),['load',{ok:false,code:'PATH_NETWORK'}]);
 down=false;
 assert.ok(await next.practiceCoach(POOL),'다음 연습에서 다시 읽어 새 길');
 next.dispose();
});

test('새 길 간 적 있는 기기 — 판이 오른 직후 그 판의 요약이 없고 받기가 실패해도 새 길 그대로(B4)',async()=>{
 const storage=memoryStorage([[NEXT_MARK+'acct-3',JSON.stringify({went:true})]]),line=accountLine({revision:4});
 const {opened,load}=fakeLoader(()=>fakeCoach({synced:{ok:false,kind:'offline',code:'NETWORK'}}));
 const next=createAtlasNext({owner:'acct-3',storage,trail:line.trail,load,health:recorder()});
 const coach=await next.practiceCoach(POOL);
 assert.equal(coach,opened[0]);assert.equal(coach.options.host.revision,4);
 assert.equal(coach.syncedCalls,0,'받기를 기다리지 않는다');
 next.dispose();
});

test('스위치 꺼짐 — 첫 받기가 FEATURE_DISABLED면 꺼짐 표지, 다음 시작은 곧장 지금 판이고 뒤에서 다시 물어 열리면 그다음 시작부터 새 길',async()=>{
 const storage=memoryStorage(),line=accountLine({get:async()=>{throw fail(403,'FEATURE_DISABLED');}});
 const first=fakeLoader(()=>fakeCoach({synced:{ok:false,kind:'switch',code:'FEATURE_DISABLED'}}));
 const a=createAtlasNext({owner:'acct-4',storage,trail:line.trail,load:first.load,health:recorder()});
 assert.equal(await a.practiceCoach(POOL),null);
 assert.deepEqual(markOf(storage,'acct-4'),{off:true});
 a.dispose();
 // 다음 시작: 표지가 있으면 엔진도 받지 않고 지금 판, 뒤에서 묻는다(아직 꺼짐 — 표지 그대로)
 const second=fakeLoader();
 const b=createAtlasNext({owner:'acct-4',storage,trail:line.trail,load:second.load,health:recorder()});
 assert.equal(await b.practiceCoach(POOL),null);assert.equal(second.opened.length,0);
 await until(()=>line.gets.length>=1);await tick();
 assert.deepEqual(markOf(storage,'acct-4'),{off:true});
 b.dispose();
 // 서버가 스위치를 켰다 — 이번 연습은 아직 지금 판, 뒤에서 물어 표지를 지우고 같은 문서의 다음 연습부터 새 길(GPT 끝 판 GB2 — 새로고침을 기다리지 않는다)
 line.get=async()=>({summary:null,serverTime:0});
 const c=createAtlasNext({owner:'acct-4',storage,trail:line.trail,load:second.load,health:recorder()});
 assert.equal(await c.practiceCoach(POOL),null);
 await until(()=>!markOf(storage,'acct-4').off);
 await tick();
 assert.ok(await c.practiceCoach(POOL),'같은 문서의 다음 연습부터 새 길');
 c.dispose();
 const d=createAtlasNext({owner:'acct-4',storage,trail:line.trail,load:second.load,health:recorder()});
 assert.ok(await d.practiceCoach(POOL),'그다음 시작부터 새 길');
 d.dispose();
});

test('기기 길로 확인된 계정이 엔진만 못 받으면 옮기기 물음은 지금 판 물음(null)이고, 판은 붙들지 않아 다음 연습에서 기기 길로 연다(카본 다시 A2)',async()=>{
 const storage=memoryStorage(),line=accountLine({enabled:false,revision:3,get:async()=>{throw fail(403,'LEARNING_DISABLED',{revision:3});}});
 let broken=true;const working=fakeLoader();
 const load=async()=>{if(broken)return {coach:()=>{throw Error('엔진 없음');},SynkAtlas:{load:async()=>{throw Error('offline');}}};return working.load();};
 const health=recorder();
 const next=createAtlasNext({owner:'acct-a2',storage,trail:line.trail,load,health});
 assert.equal(await next.guestMove({watermarks:{}}),null,'기기 길은 손님 기록을 올리지 않는다 — 못 셈({failed})이 아니다');
 assert.equal(await next.practiceCoach(POOL),null,'이번 연습은 지금 판');
 assert.ok(health.notes.some(([kind,outcome])=>kind==='load'&&outcome.code==='PATH_DEVICE_UNLOADED'),'까닭은 계기에');
 broken=false;
 const coach=await next.practiceCoach(POOL);
 assert.ok(coach,'다음 연습에서 다시 정해 기기 길로');
 assert.equal(coach.options.host.guest,true);
 next.dispose();
});

test('동의 꺼진 계정 — 받기 한 번으로 스위치를 묻고(LEARNING_DISABLED = 켜짐) 그 계정 · 그 판의 기기 저장소로, 옛 기록 읽개 · 나르개 없이(F6 · E1 · E2)',async()=>{
 const storage=memoryStorage([[LEGACY_KEY,JSON.stringify({version:1,events:[{schema:1,id:'old'}]})]]);
 const line=accountLine({enabled:false,revision:3,get:async()=>{throw fail(403,'LEARNING_DISABLED',{revision:3});}});
 const {opened,load}=fakeLoader();
 const next=createAtlasNext({owner:'acct-5',storage,trail:line.trail,load,health:recorder()});
 const coach=await next.practiceCoach(POOL);
 assert.equal(coach,opened[0]);
 const host=coach.options.host;
 assert.deepEqual({guest:host.guest,account:host.account,revision:host.revision,key:host.key},
  {guest:true,account:'acct-5',revision:3,key:atlas.storeName({account:'acct-5',revision:3,local:true})});
 assert.equal(host.legacy,undefined);assert.equal(host.transport,undefined);assert.equal(host.onAccount,undefined);
 assert.equal(coach.syncedCalls,0);
 assert.deepEqual(markOf(storage,'acct-5'),{went:true});
 next.dispose();
 // 스위치가 꺼진 계정은 지금 판(꺼짐 표지), 모르면(네트워크) 처음인 기기는 지금 판 · 새 길 간 적 있으면 기기 길
 const off=accountLine({enabled:false,revision:3,get:async()=>{throw fail(403,'FEATURE_DISABLED');}});
 const s2=memoryStorage();
 const n2=createAtlasNext({owner:'acct-6',storage:s2,trail:off.trail,load:fakeLoader().load,health:recorder()});
 assert.equal(await n2.practiceCoach(POOL),null);assert.deepEqual(markOf(s2,'acct-6'),{off:true});
 const lost=accountLine({enabled:false,revision:3,get:async()=>{throw Object.assign(Error('NETWORK'),{code:'NETWORK'});}});
 const health=recorder();
 const n3=createAtlasNext({owner:'acct-7',storage:memoryStorage(),trail:lost.trail,load:fakeLoader().load,health});
 assert.equal(await n3.practiceCoach(POOL),null);assert.deepEqual(health.notes.at(-1),['load',{ok:false,code:'PATH_SWITCH_UNKNOWN'}]);
 const n4=createAtlasNext({owner:'acct-8',storage:memoryStorage([[NEXT_MARK+'acct-8','{"went":true}']]),trail:lost.trail,load:fakeLoader().load,health:recorder()});
 assert.equal((await n4.practiceCoach(POOL)).options.host.guest,true);
});

test('쓰기 문만 닫힌 계정(learningSync 거짓)도 처음부터 올리지 않는 기기 길 — 받기가 되면 스위치는 켜짐',async()=>{
 const line=accountLine({learningSync:false,revision:2});
 const {load}=fakeLoader();
 const next=createAtlasNext({owner:'acct-9',storage:memoryStorage(),trail:line.trail,load,health:recorder()});
 const coach=await next.practiceCoach(POOL);
 assert.equal(coach.options.host.key,atlas.storeName({account:'acct-9',revision:2,local:true}));
 next.dispose();
});

test('판 · 동의 알림(onAccount account) — 연 코치를 닫고(그 코치의 연습 화면에 먼저 알림) 다음 연습은 계정을 다시 읽어 오른 판의 저장소로 연다',async()=>{
 const storage=memoryStorage(),line=accountLine(),{opened,load}=fakeLoader();
 const next=createAtlasNext({owner:'acct-10',storage,trail:line.trail,load,health:recorder()});
 const coach=await next.practiceCoach(POOL);
 const seen=[];
 next.retired(coach,detail=>seen.push([detail.reason,coach.disposed]));
 line.revision=2;
 coach.options.host.onAccount({kind:'account',code:'REVISION_CONFLICT',status:409,revision:2});
 await until(()=>coach.disposed===1);
 assert.deepEqual(seen,[['account',0]],'닫기 전에 화면에 알린다');
 const again=await next.practiceCoach(POOL);
 assert.notEqual(again,coach);assert.equal(again.options.host.revision,2);
 assert.equal(again.syncedCalls,0,'새 길 간 적이 있어 오른 판도 바로 연다');
 assert.equal(line.reads,2);assert.equal(opened.length,2);
 next.dispose();
});

test('알림 갈래 — 스위치 꺼짐은 표지와 닫기(다음은 지금 판), 쓰기만 막힘은 계정을 다시 읽어 문이 열려 있으면 그대로 · 닫혔으면 다시 정함, 인증은 셸에 맡김',async()=>{
 const storage=memoryStorage(),line=accountLine(),{load}=fakeLoader();
 const next=createAtlasNext({owner:'acct-11',storage,trail:line.trail,load,health:recorder()});
 let coach=await next.practiceCoach(POOL);
 coach.options.host.onAccount({kind:'auth',code:'AUTH_REQUIRED',status:401});
 coach.options.host.onAccount({kind:'writes',code:'WRITES_DISABLED',status:403});
 await until(()=>line.reads>=2);await tick();
 assert.equal(coach.disposed,0,'인증 · 문이 열린 쓰기 막힘은 닫지 않는다');
 line.learningSync=false;
 coach.options.host.onAccount({kind:'writes',code:'WRITES_DISABLED',status:403});
 await until(()=>coach.disposed===1);
 coach=await next.practiceCoach(POOL);
 assert.equal(coach.options.host.guest,true,'쓰기 문이 닫혔으면 기기 길로');
 line.learningSync=true;
 next.dispose();
 const n2=createAtlasNext({owner:'acct-12',storage,trail:line.trail,load,health:recorder()});
 const up=await n2.practiceCoach(POOL);
 up.options.host.onAccount({kind:'switch',code:'FEATURE_DISABLED',status:403});
 await until(()=>up.disposed===1);
 assert.deepEqual(markOf(storage,'acct-12'),{went:true,off:true});
 assert.equal(await n2.practiceCoach(POOL),null);
 n2.dispose();
});

test('여는 사이에 판을 다시 정하면 앞 판에서 열던 코치는 돌려주지 않고 닫는다',async()=>{
 let release;const slow=new Promise(resolve=>{release=resolve;});
 const line=accountLine();
 const {load}=fakeLoader(options=>fakeCoach({ready:options.banks.includes('entry-check')?slow:Promise.resolve()}));
 const next=createAtlasNext({owner:'acct-13',storage:memoryStorage([[NEXT_MARK+'acct-13','{"went":true}']]),trail:line.trail,load,health:recorder()});
 const first=await next.practiceCoach(POOL);
 const pending=next.practiceCoach([{itemKey:'entry-check.x1'}]);
 await until(()=>true);await tick();
 first.options.host.onAccount({kind:'account',code:'LEARNING_DISABLED',status:403});
 release();
 assert.equal(await pending,null);
 next.dispose();
});

test('옮기기 물음 — 올리는 길이면 손님 저장소를 옆으로(옛 기록 읽개 · 만들지 않음) 열어, 옛 꼴은 지금 판 규칙으로 고른 것만 세고 옛 POST로 보낸다',async()=>{
 const storage=memoryStorage([[LEGACY_KEY,JSON.stringify({version:1,events:[]})]]);
 const line=accountLine();
 const calls=[];
 const legacy=[
  {id:'d1',type:'decision.made',keep:true},{id:'p1',type:'practice.presented',keep:true},{id:'a1',type:'practice.attempted',attemptNo:1,keep:true},
  {id:'a0',type:'practice.attempted',attemptNo:1,keep:false},
 ];
 const current=[{id:'c1',type:'practice.presented'},{id:'c2',type:'practice.attempted',attemptNo:1},{id:'c3',type:'practice.attempted',attemptNo:2}];
 const aside={
  plan:async watermarks=>{calls.push(['plan',watermarks]);return {legacy,current,until:9,touches:new Map()};},
  move:async how=>{calls.push(['move',how.watermarks]);const sent=await how.postLegacy(legacy);calls.push(['sent',sent]);return {ok:sent===true||sent?.ok===true,legacy:legacy.length,current:current.length,until:9};},
  keep:async()=>{calls.push(['keep']);return 10;},note:async mark=>{calls.push(['note',mark]);return true;},close:()=>calls.push(['close']),
 };
 let asked=null;
 const {load}=fakeLoader(()=>fakeCoach({guestRecords:async options=>{asked=options;return aside;}}));
 const next=createAtlasNext({owner:'acct-14',storage,trail:line.trail,load,health:recorder()});
 const watermarks={others:5,all:7};
 const found=await next.guestMove({watermarks,pick:events=>events.filter(e=>e.keep)});
 assert.equal(typeof asked.legacy,'function');assert.equal(asked.create,false);
 assert.deepEqual(asked.legacy(),{log:[],ledger:null});
 assert.deepEqual(calls[0],['plan',watermarks]);
 assert.equal(found.attempts,2,'고른 옛 꼴 첫 답 1 + 2판 첫 답 1');
 assert.equal(found.events,6);
 const moved=await found.move();
 assert.equal(moved.ok,true);
 assert.deepEqual(line.legacy.map(batch=>batch.map(e=>e.id)),[['d1','p1','a1']],'고른 것만 부모 먼저');
 const answered=calls.find(call=>call[0]==='sent')[1];
 assert.deepEqual({ok:answered.ok,ids:[...answered.ids].sort()},{ok:true,ids:['a1','d1','p1']},'보낸 옛 꼴 번호를 엔진에 돌려준다(옮김 표지 ids — GPT 다시 GA2)');
 await found.note('visited');await found.keep();found.close();
 assert.deepEqual(calls.slice(1).map(call=>call[0]),['move','sent','note','keep','close']);
 // 손님 저장소가 없으면 만들지 않고 0, 지금 판이면 null, 엔진을 못 열면 failed
 const none=createAtlasNext({owner:'acct-15',storage,trail:line.trail,load:fakeLoader(()=>fakeCoach()).load,health:recorder()});
 assert.deepEqual((({attempts,events,none:empty})=>({attempts,events,empty}))(await none.guestMove({watermarks})),{attempts:0,events:0,empty:true});
 const old=createAtlasNext({owner:'acct-16',storage:memoryStorage([[NEXT_MARK+'acct-16','{"off":true}']]),trail:line.trail,load,health:recorder()});
 assert.equal(await old.guestMove({watermarks}),null);
 const broken=createAtlasNext({owner:'acct-17',storage:memoryStorage([[NEXT_MARK+'acct-17','{"went":true}']]),trail:line.trail,
  load:async()=>{throw Object.assign(Error('offline'),{reason:'IMPORT'});},health:recorder()});
 assert.deepEqual(await broken.guestMove({watermarks}),{failed:true});
 assert.equal(await createAtlasNext({owner:'guest',storage,load,health:recorder()}).guestMove({watermarks}),null,'손님에게는 옮길 계정이 없다');
 next.dispose();
});

test('옮기기 물음 — 옮길 것이 없으면(손님 저장소 · 고를 옛 기록 없음) 계정 코치를 열지 않고, 옛 기록만 있는 기기는 손님 저장소를 만들어 센다(R7)',async()=>{
 const line=accountLine();
 const watermarks={others:0,all:0};
 const realIdb=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
 let names=[];
 Object.defineProperty(globalThis,'indexedDB',{value:{databases:async()=>names.map(name=>({name}))},configurable:true,writable:true});
 try{
  // ① 손님 저장소도 옛 기록도 없다 — 입장마다 계정 코치(지도 · 저장소 · 첫 받기)를 열지 않는다
  const empty=fakeLoader();
  const a=createAtlasNext({owner:'acct-30',storage:memoryStorage(),trail:line.trail,load:empty.load,health:recorder()});
  const none=await a.guestMove({watermarks});
  assert.equal(none.none,true);assert.equal(none.attempts,0);
  assert.equal(empty.opened.length,0,'계정 코치를 열지 않았다');
  assert.equal(await none.note('visited'),false,'다녀감 표지도 쓰지 않는다');
  // ② 옛 기록이 있어도 지금 판 규칙으로 고를 것이 없으면(기준 시각 앞) 같다
  const old=memoryStorage([[LEGACY_KEY,JSON.stringify({version:1,events:[{id:'o1',type:'practice.attempted',attemptNo:1}]})]]);
  const b=createAtlasNext({owner:'acct-31',storage:old,trail:line.trail,load:empty.load,health:recorder()});
  assert.equal((await b.guestMove({watermarks,pick:()=>[]})).none,true);
  assert.equal(empty.opened.length,0);
  // ③ 손님 저장소가 있으면 열어 센다(만들지 않음)
  names=[atlas.storeName({})];
  let asked=null;
  const some=fakeLoader(()=>fakeCoach({guestRecords:async options=>{asked=options;return null;}}));
  const c=createAtlasNext({owner:'acct-32',storage:memoryStorage(),trail:line.trail,load:some.load,health:recorder()});
  assert.equal((await c.guestMove({watermarks})).none,true);
  assert.equal(some.opened.length,1);assert.equal(asked.create,false);
  // ④ 옛 기록만 있는 기기(새 길을 켜기 전에 손님으로만 연습 — 손님 저장소 없음) — 손님 저장소를 만들어 옛 기록 옮기기를 돌린 뒤 센다
  names=[];asked=null;
  const d=createAtlasNext({owner:'acct-33',storage:old,trail:line.trail,load:some.load,health:recorder()});
  await d.guestMove({watermarks,pick:events=>events});
  assert.equal(asked.create,true,'고를 옛 기록이 있으면 만든다');
  assert.equal(typeof asked.legacy,'function');assert.equal(asked.legacy().log.length,1);
  // ⑤ 고르기가 던지면 있다고 본다(빠뜨리지 않는 쪽)
  asked=null;
  const e=createAtlasNext({owner:'acct-34',storage:old,trail:line.trail,load:some.load,health:recorder()});
  await e.guestMove({watermarks,pick:()=>{throw Error('bad');}});
  assert.equal(asked.create,true);
  for(const x of [a,b,c,d,e])x.dispose();
 }finally{
  if(realIdb)Object.defineProperty(globalThis,'indexedDB',realIdb);else delete globalThis.indexedDB;
 }
});

test('끝 판 B — 엔진을 한 번 못 받아도 문서 내내 굳지 않는다(기기 길은 다음 연습에서 다시 정한다)',async()=>{
 const line=accountLine({enabled:false});
 let fails=1;
 const engine={storeName:atlas.storeName};
 const opened=[];
 const load=async()=>({coach:options=>{const made=fakeCoach();made.options=options;opened.push(made);return made;},
  SynkAtlas:{load:async()=>{if(fails-->0)throw Object.assign(Error('offline'),{reason:'IMPORT'});return engine;}}});
 const next=createAtlasNext({owner:'acct-40',storage:memoryStorage(),trail:line.trail,load,health:recorder()});
 assert.equal(await next.practiceCoach(POOL),null,'이번 연습은 지금 판');
 const made=await next.practiceCoach(POOL);
 assert.ok(made,'다음 연습은 엔진을 다시 받아 기기 길');
 assert.equal(made.options.host.key,atlas.storeName({account:'acct-40',revision:1,local:true}));
 next.dispose();
});

test('끝 판 B — 이미 새 길로 간 계정이 계정을 못 읽으면(일시 실패) 옮기기 물음은 「못 셈」, 스위치 꺼짐은 지금 판 물음',async()=>{
 const storage=memoryStorage([[NEXT_MARK+'acct-41','{"went":true}']]);
 let broken=true;
 const line=accountLine();
 const trail=async()=>{if(broken)throw Object.assign(Error('net'),{code:'NETWORK',retryable:true});return line.trail();};
 const {load}=fakeLoader();
 const next=createAtlasNext({owner:'acct-41',storage,trail,load,health:recorder()});
 assert.deepEqual(await next.guestMove({watermarks:{others:0,all:0}}),{failed:true},'기준 시각을 올리지 않게 못 셈');
 broken=false;
 const later=await next.guestMove({watermarks:{others:0,all:0}});
 assert.equal(later.none,true,'다시 읽으면 새 길로 센다(이 기기엔 옮길 것 없음)');
 next.dispose();
 const off=createAtlasNext({owner:'acct-42',storage:memoryStorage([[NEXT_MARK+'acct-42','{"off":true}']]),trail:line.trail,load,health:recorder()});
 assert.equal(await off.guestMove({watermarks:{others:0,all:0}}),null,'정해진 지금 판은 지금 판 물음');
 off.dispose();
});

test('끝 판 B — 앞 판 코치의 늦은 알림 · 늦게 끝난 쓰기 다시 확인은 새 판의 코치를 닫지 않고, 같은 판의 겹친 쓰기 알림은 한 번만 읽는다',async()=>{
 const line=accountLine();
 let hold=false,release=()=>{};
 // 다음 한 번의 계정 읽기만 붙든다(쓰기 다시 확인) — 그사이 새 판의 코치를 연다
 const trail=async()=>{if(hold){hold=false;await new Promise(resolve=>{release=resolve;});}return line.trail();};
 const {load,opened}=fakeLoader();
 const next=createAtlasNext({owner:'acct-43',storage:memoryStorage([[NEXT_MARK+'acct-43','{"went":true}']]),trail,load,health:recorder()});
 const a=await next.practiceCoach(POOL);
 const notifyA=a.options.host.onAccount;
 const reads=line.reads;
 hold=true;
 notifyA({kind:'writes'});notifyA({kind:'writes'}); // 겹친 쓰기 알림
 notifyA({kind:'account'}); // 그사이 판 알림 — 다시 정하고 앞 코치를 닫는다
 await tick();
 assert.ok(a.disposed>0,'앞 코치는 닫힌다');
 const b=await next.practiceCoach(POOL);
 assert.ok(b&&b!==a,'새 판의 코치');
 // 붙든 쓰기 다시 확인이 이제 끝난다 — 쓰기 문이 닫힌 것으로 읽혀도 앞 판의 확인이라 새 코치를 닫지 않는다
 line.learningSync=false;release();
 for(let i=0;i<5;i++)await tick();
 line.learningSync=true;
 assert.equal(b.disposed,0,'늦게 끝난 앞 판의 쓰기 확인이 새 코치를 닫지 않는다');
 assert.equal(line.reads-reads,2,'겹친 쓰기 알림은 계정을 한 번만 다시 읽는다(+ 새 판 정하기 한 번)');
 // 앞 판 코치의 늦은 알림(판 · 쓰기)도 새 코치를 닫지 않는다
 notifyA({kind:'account'});notifyA({kind:'writes'});
 for(let i=0;i<5;i++)await tick();
 assert.equal(b.disposed,0,'새 판의 코치는 그대로');
 assert.equal(await next.practiceCoach(POOL),b,'다음 연습도 같은 코치');
 assert.equal(opened.length,2);
 next.dispose();
});

test('끝 판 B — 처음인 기기에서 같은 판의 두 코치가 겹치면, 한쪽이 첫 받기를 놓쳐도 다른 쪽이 새 길을 확인하면 다음 연습은 새 길',async()=>{
 const storage=memoryStorage();
 const line=accountLine();
 const POOL2=[{itemKey:'blank-slice.x1'}];
 // 은행 조합마다 다른 코치 — topik-items는 첫 받기를 놓치고(먼저), blank-slice는 받는다(뒤)
 const make=options=>fakeCoach({synced:options.banks.includes('topik-items')
  ? new Promise(resolve=>setTimeout(()=>resolve({ok:false,code:'TIMEOUT'}),20))
  : new Promise(resolve=>setTimeout(()=>resolve({ok:true,base:true}),60))});
 const loader=fakeLoader(options=>{const made=make(options);const synced=made.synced;made.synced=async()=>synced();return made;});
 const next=createAtlasNext({owner:'acct-44',storage,trail:line.trail,load:loader.load,health:recorder()});
 const [a,b]=await Promise.all([next.practiceCoach(POOL),next.practiceCoach(POOL2)]);
 assert.equal(a,null,'놓친 쪽은 이번에 지금 판');
 assert.ok(b,'받은 쪽은 새 길');
 assert.equal(markOf(storage,'acct-44').went,true);
 assert.ok(await next.practiceCoach(POOL),'다음 연습은 새 길(낮춘 판을 다시 정함)');
 // 반대 차례: 받은 쪽이 먼저 끝나면 놓친 쪽도 그대로 새 길
 const storage2=memoryStorage();
 const make2=options=>fakeCoach({synced:options.banks.includes('topik-items')
  ? new Promise(resolve=>setTimeout(()=>resolve({ok:false,code:'TIMEOUT'}),60))
  : new Promise(resolve=>setTimeout(()=>resolve({ok:true,base:true}),20))});
 const loader2=fakeLoader(options=>{const made=make2(options);const synced=made.synced;made.synced=async()=>synced();return made;});
 const next2=createAtlasNext({owner:'acct-45',storage:storage2,trail:line.trail,load:loader2.load,health:recorder()});
 const [c,d]=await Promise.all([next2.practiceCoach(POOL),next2.practiceCoach(POOL2)]);
 assert.ok(c&&d,'둘 다 새 길');
 next.dispose();next2.dispose();
});

test('로그아웃 표지 — 이미 연 계정 코치가 있고 손님 저장소가 있을 때만 쓴다(되는 만큼만)',async()=>{
 const line=accountLine(),marks=[];
 const aside={note:async mark=>{marks.push(mark);return true;},close(){marks.push('close');}};
 const {load}=fakeLoader(()=>fakeCoach({guestRecords:async options=>options.create===false?aside:null}));
 const next=createAtlasNext({owner:'acct-18',storage:memoryStorage(),trail:line.trail,load,health:recorder()});
 assert.equal(await next.noteLogout(),false,'연 코치가 없으면 쓰지 않는다');
 await next.practiceCoach(POOL);
 assert.equal(await next.noteLogout(),true);
 assert.deepEqual(marks,['logout','close']);
 next.dispose();
});

test('계기(F7) — 셸이 계기를 주지 않으면 엔진을 받은 뒤 엔진의 계기를 만들고, 그전 실패(저장소 막힘)를 옮겨 호스트에 건다',async()=>{
 const before=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Object.assign(Error('insecure'),{name:'SecurityError'});}});
 try{
  const made=recorder();
  const {load}=fakeLoader(()=>fakeCoach(),{health:made});
  const next=createAtlasNext({owner:'guest',load});
  assert.deepEqual(next.health(),{early:[{kind:'save',ok:false,code:'LEGACY_STORAGE'}]});
  const coach=await next.practiceCoach(POOL);
  assert.equal(coach.options.host.health,made);
  assert.deepEqual(made.notes,[['save',{ok:false,code:'LEGACY_STORAGE'}],['load',{ok:true}]]);
  next.dispose();
 }finally{if(before)Object.defineProperty(globalThis,'localStorage',before);else delete globalThis.localStorage;}
});

test('옛 POST 묶음 — 부모 먼저(결정 → 제시 → 딸린 것 → 마침 → 응답 → 제외), 건수 · 바이트로 자르고, 한 묶음이라도 받지 않으면 거짓',async()=>{
 const events=[
  {id:'x',type:'record.excluded',at:'2026-11-01T00:00:05.000Z'},{id:'f',type:'feedback.given',at:'2026-11-01T00:00:04.000Z'},
  {id:'a',type:'practice.attempted',at:'2026-11-01T00:00:02.000Z'},{id:'c',type:'experience.completed',at:'2026-11-01T00:00:03.000Z'},
  {id:'p',type:'practice.presented',at:'2026-11-01T00:00:01.000Z'},{id:'d',type:'decision.made',at:'2026-11-01T00:00:00.000Z'},
 ];
 const sent=[];
 assert.equal(await postLegacyBatches(events,async batch=>{sent.push(batch.map(e=>e.id));return {ok:true};},{limit:4}),true);
 assert.deepEqual(sent,[['d','p','a','c'],['f','x']]);
 sent.length=0;
 assert.equal(await postLegacyBatches(events,async batch=>{sent.push(batch.map(e=>e.id));return {ok:true};},{bytes:120}),true);
 assert.ok(sent.length>1&&sent.flat().join()==='d,p,a,c,f,x','바이트로도 자른다');
 assert.equal(await postLegacyBatches(events,async batch=>({ok:batch[0].id!=='f'}),{limit:4}),false);
 assert.equal(await postLegacyBatches([],async()=>{throw Error('부르지 않는다');}),true);
});

test('스위치 묻기 — 받기의 답으로 켜짐 · 꺼짐 · 모름을 가르고 한도를 넘으면 모름',async()=>{
 assert.equal(await askSwitch({get:async()=>({})}),'on');
 assert.equal(await askSwitch({get:async()=>{throw fail(403,'FEATURE_DISABLED');}}),'off');
 assert.equal(await askSwitch({get:async()=>{throw fail(403,'LEARNING_DISABLED');}}),'on');
 assert.equal(await askSwitch({get:async()=>{throw fail(409,'REVISION_CONFLICT');}}),'on');
 assert.equal(await askSwitch({get:async()=>{throw fail(500,'SERVER_UNAVAILABLE');}}),'unknown');
 assert.equal(await askSwitch({get:()=>new Promise(()=>{})},20),'unknown');
 assert.equal(await askSwitch(null),'unknown');
});

test('리허설 나르개 — 운영 계정 클라이언트와 같은 꼴(머리말 · since 쿼리 · 본문), 오류는 { code, status, retryable, revision?, ids? }',async()=>{
 const calls=[];
 const replies=[
  {status:200,body:{ok:true,learning:{enabled:true,revision:3},capabilities:{learningSync:true}}},
  {status:200,body:{ok:true,summary:null,serverTime:1}},
  {status:409,body:{ok:false,error:{code:'EVENT_CONFLICT'},ids:['e1']}},
  {status:503,body:{ok:false,error:{code:'REHEARSAL_UNAVAILABLE'}}},
  {status:200,body:{ok:true,accepted:['o1'],revision:3}},
 ];
 const fetcher=async(url,init)=>{calls.push([url,init]);const reply=replies.shift();return {ok:reply.status<400,status:reply.status,json:async()=>reply.body};};
 const line=await rehearsalTrail({fetcher,headers:()=>({Authorization:'Bearer t','X-Synk-Rehearsal-Tab':'tab-1'})})();
 assert.deepEqual(line.learning,{enabled:true,revision:3});assert.equal(line.learningSync,true);
 const carrier=line.transport(3);
 await carrier.get({edition:'params-1+index-3',seq:4,gen:'1794441600000.abcdefgh'});
 assert.equal(calls[1][0],'/api/world/rehearsal/trail?revision=3&edition=params-1%2Bindex-3&since=4&gen=1794441600000.abcdefgh');
 assert.equal(calls[1][1].headers['X-Synk-Contract'],'1');assert.equal(calls[1][1].headers['X-Synk-Product'],'world');
 assert.equal(calls[1][1].headers.Authorization,'Bearer t');assert.equal(calls[1][1].headers['X-Synk-Rehearsal-Tab'],'tab-1');
 await assert.rejects(carrier.post([{id:'e1'}],null),e=>e.code==='EVENT_CONFLICT'&&e.status===409&&e.ids.join()==='e1'&&!e.retryable);
 assert.deepEqual(JSON.parse(calls[2][1].body),{revision:3,events:[{id:'e1'}]},'since가 없으면 싣지 않는다');
 await assert.rejects(carrier.get(null),e=>e.status===503&&e.retryable===true);
 assert.equal((await line.postLegacy([{id:'o1'}])).ok,true);
 assert.deepEqual(JSON.parse(calls[4][1].body),{revision:3,events:[{id:'o1'}]});
 const lost=rehearsalTrail({fetcher:async()=>{throw TypeError('fetch failed');}});
 await assert.rejects(lost(),e=>e.code==='NETWORK'&&e.retryable===true&&e.status===undefined);
});

// ── 진짜 엔진 코치 + 리허설 trail 한 바퀴 ─────────────────────────────────────────────────────
const readJson=url=>JSON.parse(fs.readFileSync(new URL(url,import.meta.url),'utf8'));
const MAP_DATA={index:readJson('../../../packages/atlas/map/index.json'),units:readJson('../../../packages/atlas/map/units.json')};
const BANK=bankItems(readJson('../world-topik-items.json'));
const READING=(()=>{const by=new Map();for(const item of BANK){if(!by.has(item.skillId))by.set(item.skillId,[]);by.get(item.skillId).push(item);}
 return [...by].filter(([id,items])=>id.includes('.reading.')&&items.length>=8).sort((a,b)=>b[1].length-a[1].length)[0][1];})();
const A_ID='33333333-3333-4333-8333-333333333333';

test('한 바퀴 — 손님 연습 → 계정 첫 받기로 새 길 → 손님 기록 옮기기 → 서버 접기, 판이 오르면 닫고 새 판으로, 동의를 끄면 기기 길',{timeout:60_000},async()=>{
 let now=Date.UTC(2026,10,12,1,0,0);
 const time={now:()=>now,advance:ms=>{now+=ms;}};
 const index=atlas.openMap({index:MAP_DATA.index}).foldIndex;
 const server=createRehearsalTrail({atlas,index,now:time.now,warn:()=>{}});
 const account={id:A_ID};
 const fetcher=async(url,init={})=>{
  const u=new URL(url,'http://local');
  const reply=await server.handle({account,path:u.pathname.replace('/api/world/rehearsal/',''),method:init.method??'GET',query:u.searchParams,
   body:init.body?Buffer.from(init.body):undefined,headers:new Headers(init.headers)});
  return {ok:reply.status<400,status:reply.status,json:async()=>reply.body};
 };
 const control=body=>fetcher('/api/world/rehearsal/trail-control',{method:'POST',body:JSON.stringify(body),headers:{'x-synk-contract':'1','x-synk-product':'world'}});
 const ports=new Map(),portOf=key=>{if(!ports.has(key))ports.set(key,atlas.memoryPort());return ports.get(key);};
 const keyOf=host=>host.key??(host.guest?atlas.storeName({}):atlas.storeName({account:host.account,revision:host.revision}));
 const load=async()=>({SynkAtlas:{load:async()=>atlas},coach:options=>{
  const made=atlas.createCoach({...options,mapData:MAP_DATA,dayOffset:540,host:{...options.host,port:portOf(keyOf(options.host)),now:time.now}});
  // 코치는 얼린 객체라 같은 메서드를 보통 객체에 옮기고, 손님 저장소 옆으로 열기에만 시험 포트를 준다(브라우저는 IndexedDB에서 찾는다).
  const wrapped=Object.fromEntries(Object.entries(made).map(([name,value])=>[name,typeof value==='function'?value.bind(made):value]));
  wrapped.guestRecords=opts=>made.guestRecords({...opts,...(ports.has(atlas.storeName({}))?{port:ports.get(atlas.storeName({}))}:{})});
  return wrapped;
 }});
 const storage=memoryStorage();
 const plays={allowedPlays,nextPlay};
 async function practise(coach,length=3){
  const session=createPracticeNextSession({plays,coach,pool:READING,length});
  while(session.next()){if(!session.current.heard)session.delivery('completed');session.answer(session.current.item.correctId);time.advance(30_000);}
  return session.settled();
 }
 // 손님 연습 셋
 const guest=createAtlasNext({owner:'guest',storage,load,health:recorder()});
 const guestCoach=await guest.practiceCoach(READING);
 assert.equal((await practise(guestCoach)).length,3);
 guest.dispose();
 // 계정: 처음인 기기 — 첫 받기(빈 요약)로 새 길
 const health=recorder();
 const next=createAtlasNext({owner:A_ID,storage,trail:rehearsalTrail({fetcher}),load,health});
 const coach=await next.practiceCoach(READING);
 assert.ok(coach,`새 길 — ${JSON.stringify(health.notes)}`);
 assert.deepEqual(markOf(storage,A_ID),{went:true});
 // 손님 → 계정 옮기기
 const found=await next.guestMove({watermarks:{others:0,all:0},pick:events=>events});
 assert.equal(found.attempts,3);
 const moved=await found.move();
 assert.equal(moved.ok,true);assert.ok(moved.current>=6,`옮긴 2판 사건 ${moved.current}`);
 found.close();
 const folded=await until(async()=>{const reply=await fetcher('/api/world/rehearsal/trail?revision=1',{headers:{'x-synk-contract':'1','x-synk-product':'world'}});
  const summary=(await reply.json()).summary;return summary&&summary.foldedUntil>=moved.current?summary:null;},15_000);
 assert.ok(folded.lines.length>0,'서버가 옮긴 기록을 접었다');
 // 다른 기기가 비움 · 동의 왕복 — 판이 오른다 → 다음 올리기가 REVISION_CONFLICT → 셸에 알림 → 코치를 닫는다
 const closed=[];next.retired(coach,detail=>closed.push(detail.reason));
 await control({action:'revision'});
 await practise(coach,1);
 await until(()=>closed.length,15_000);
 assert.deepEqual(closed,['account']);
 const second=await next.practiceCoach(READING);
 assert.equal(second.summary().storage.guest,false);
 assert.notEqual(second,coach);
 // 동의를 끄면(판이 또 오른다) 그 판의 기기 저장소 — 올리지 않는다
 const closedAgain=[];next.retired(second,detail=>closedAgain.push(detail.reason));
 await control({action:'consent',enabled:false});
 await practise(second,1);
 await until(()=>closedAgain.length,15_000);
 const device=await next.practiceCoach(READING);
 assert.equal(device.summary().storage.guest,true,'동의 꺼진 계정은 기기 길');
 assert.ok(ports.has(atlas.storeName({account:A_ID,revision:3,local:true})),'그 계정 · 그 판의 기기 저장소');
 next.dispose();
});

test('기기 길은 연습을 열 때마다 계정을 다시 읽어 — 동의를 다시 켜 판이 오르면 올리는 길로, 그대로면 연 기기 코치를 다시 쓴다',async()=>{
 const line=accountLine({enabled:false,revision:3,get:async()=>{throw fail(403,'LEARNING_DISABLED',{revision:3});}});
 const {opened,load}=fakeLoader();
 const next=createAtlasNext({owner:'acct-20',storage:memoryStorage(),trail:line.trail,load,health:recorder()});
 const device=await next.practiceCoach(POOL);
 assert.equal(device.options.host.guest,true);
 assert.equal(await next.practiceCoach(POOL),device,'그대로면 다시 쓴다');
 line.enabled=true;line.revision=4;line.get=async()=>({summary:null,serverTime:0});
 const upload=await next.practiceCoach(POOL);
 assert.equal(device.disposed,1,'앞 판의 기기 코치를 닫는다');
 assert.equal(upload.options.host.revision,4);assert.equal(upload.options.host.guest,undefined);
 assert.equal(opened.length,2);
 next.dispose();
});
