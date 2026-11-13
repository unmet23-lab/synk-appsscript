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
import {watchLifeDue} from '../world-life-next.mjs';
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
 assert.deepEqual(markOf(storage,'acct-1'),{went:true,path:'upload',revision:1},'마지막으로 정한 길 · 판도 적는다(F1)');
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

test('새 길에 다녀간 계정이 오프라인으로 다시 열면(계정 읽기 실패) 표지의 마지막 길 · 판으로 새 길 — 인증 실패 · 표지 없는 계정 · 다른 주인은 열지 않는다(Fable 5.2 끝 판 F1)',async()=>{
 const storage=memoryStorage([[NEXT_MARK+'acct-f1',JSON.stringify({went:true,path:'upload',revision:5})]]);
 const line=accountLine({revision:5});const real=line.trail;let down=true;
 line.trail=async()=>{if(down)throw Object.assign(Error('NETWORK'),{code:'NETWORK',retryable:true});return real();};
 const {opened,load}=fakeLoader(()=>fakeCoach({synced:{ok:false,kind:'offline',code:'NETWORK'}}));
 const next=createAtlasNext({owner:'acct-f1',storage,trail:()=>line.trail(),load,health:recorder()});
 const coach=await next.practiceCoach(POOL);
 assert.equal(coach,opened[0],'오프라인이어도 새 길');assert.equal(coach.options.host.revision,5,'표지의 판으로');
 assert.equal(coach.syncedCalls,0,'첫 받기를 기다리지 않는다');
 await assert.rejects(coach.options.host.transport.get(null),{code:'NETWORK'},'나르개는 부를 때 계정을 다시 읽는다 — 못 닿으면 그 실패');
 assert.deepEqual(await next.guestMove({watermarks:{}}),{failed:true},'계정을 못 읽은 채 연 판은 옮기기를 세지 않는다');
 down=false;
 await coach.options.host.transport.get(null);
 assert.deepEqual(line.gets.map(row=>row.at),[5],'닿으면 표지의 판으로 부른다(판이 달랐으면 서버가 409)');
 // 읽힌 계정이 그 판 그대로면 줄을 채워 미확인을 푼다 — 문서 내내 「못 셈」으로 남지 않는다(카본 끝 판 둘째 C)
 const readsAfter=line.reads;
 assert.equal(await next.practiceCoach(POOL),coach,'같은 코치 그대로');
 assert.equal(line.reads,readsAfter,'풀린 판은 연습마다 다시 읽지 않는다');
 assert.equal((await next.guestMove({watermarks:{}})).none,true,'다시 읽은 뒤에는 센다(이 기기엔 옮길 것 없음)');
 next.dispose();
 // 판을 다시 정한 뒤(앞 세대)에 그 코치의 나르개가 불리면, 계정이 판 6이어도 표지의 판 5로 부른다 — 서버가 판 울타리로 답한다(F5 ③)
 const s4=memoryStorage([[NEXT_MARK+'acct-f1s',JSON.stringify({went:true,path:'upload',revision:5})]]);
 const l4=accountLine({revision:6});let off4=true;
 const n4=createAtlasNext({owner:'acct-f1s',storage:s4,trail:async()=>{if(off4)throw fail(0,'NETWORK',{retryable:true});return l4.trail();},load:fakeLoader().load,health:recorder()});
 const c4=await n4.practiceCoach(POOL);assert.equal(c4.options.host.revision,5);
 n4.redecide('account');off4=false;
 await c4.options.host.transport.get(null);
 assert.deepEqual(l4.gets.map(row=>row.at),[5],'앞 세대 판의 나르개는 표지의 판으로(읽은 판 6이 아니다)');
 n4.dispose();
 // 다시 읽은 계정의 쓰기 문이 닫혔으면(받기는 200으로 지나간다) 판을 다시 정한다
 const s5=memoryStorage([[NEXT_MARK+'acct-f1c',JSON.stringify({went:true,path:'upload',revision:5})]]);
 const l5=accountLine({revision:5});let off5=true;
 const n5=createAtlasNext({owner:'acct-f1c',storage:s5,trail:async()=>{if(off5)throw fail(0,'NETWORK',{retryable:true});return l5.trail();},load:fakeLoader().load,health:recorder()});
 const c5=await n5.practiceCoach(POOL);
 off5=false;l5.learningSync=false;
 await assert.rejects(c5.options.host.transport.get(null),{code:'PLAN_CHANGED'},'달라진 판으로는 부르지 않는다');
 await until(()=>c5.disposed===1);
 assert.equal((await n5.practiceCoach(POOL)).options.host.guest,true,'다시 정해 기기 길로');
 n5.dispose();
 // 쓰기 · 그 밖 알림의 다시 확인으로 읽혀도 풀린다
 const s6=memoryStorage([[NEXT_MARK+'acct-f1d',JSON.stringify({went:true,path:'upload',revision:5})]]);
 const l6=accountLine({revision:5});let off6=true;
 const n6=createAtlasNext({owner:'acct-f1d',storage:s6,trail:async()=>{if(off6)throw fail(0,'NETWORK',{retryable:true});return l6.trail();},load:fakeLoader().load,health:recorder()});
 const c6=await n6.practiceCoach(POOL);
 off6=false;const r6=l6.reads;
 c6.options.host.onAccount({kind:'other',code:'CONTRACT_UNSUPPORTED',status:426});
 await until(()=>l6.reads>r6);await tick();await tick();
 assert.equal(c6.disposed,0);
 const r6b=l6.reads;
 assert.equal((await n6.guestMove({watermarks:{}})).none,true,'다시 확인으로 읽힌 판도 센다');
 assert.equal(l6.reads,r6b,'다시 확인이 이미 풀었다 — 물음이 또 읽지 않는다');
 n6.dispose();
 // 나르개 · 다시 확인 없이 곧바로 물음이 읽어도 풀린다
 const s7=memoryStorage([[NEXT_MARK+'acct-f1e',JSON.stringify({went:true,path:'upload',revision:5})]]);
 const l7=accountLine({revision:5});let off7=true;
 const n7=createAtlasNext({owner:'acct-f1e',storage:s7,trail:async()=>{if(off7)throw fail(0,'NETWORK',{retryable:true});return l7.trail();},load:fakeLoader().load,health:recorder()});
 assert.deepEqual(await n7.guestMove({watermarks:{}}),{failed:true});
 off7=false;
 assert.equal((await n7.guestMove({watermarks:{}})).none,true,'다시 읽어 그 판 그대로면 센다');
 n7.dispose();
 // 인증 실패는 그 값으로 열지 않는다 · 표지 없는 계정은 지금 판 · 꼴에 안 맞는 계정 줄은 붙들지 않는다
 const denied=createAtlasNext({owner:'acct-f1',storage,trail:async()=>{throw Object.assign(Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED',status:401});},load,health:recorder()});
 assert.equal(await denied.practiceCoach(POOL),null,'인증 실패는 지금 판');denied.dispose();
 // 재시도 표시가 붙어도 인증 실패 · 주인 바뀜 · 그 밖의 거절은 표지로 열지 않는다(시험이 그 줄을 지키게 — Fable 5.2 끝 판 둘째 F5 ①)
 for(const error of [fail(401,'AUTH_REQUIRED',{retryable:true}),fail(undefined,'ACCOUNT_CHANGED',{retryable:true}),fail(403,'ACCOUNT_UNAVAILABLE',{retryable:false}),fail(503,'TRAIL_NOT_READY',{retryable:false})]){
  const kind=createAtlasNext({owner:'acct-f1',storage,trail:async()=>{throw error;},load:fakeLoader().load,health:recorder()});
  assert.equal(await kind.practiceCoach(POOL),null,`${error.code}(${error.status}) — 표지가 있어도 지금 판`);kind.dispose();
 }
 // 꼴에 안 맞는 표지(판 0 · 음수 · 글자 · 길 없음)는 열지 않는다(F5 ⑥)
 for(const mark of [{went:true,path:'upload',revision:0},{went:true,path:'upload',revision:-3},{went:true,path:'upload',revision:'5'},{went:true,revision:5},{went:true,path:'cloud',revision:5}]){
  const odd=createAtlasNext({owner:'acct-f1m',storage:memoryStorage([[NEXT_MARK+'acct-f1m',JSON.stringify(mark)]]),trail:async()=>{throw fail(0,'NETWORK',{retryable:true});},load:fakeLoader().load,health:recorder()});
  assert.equal(await odd.practiceCoach(POOL),null,`표지 ${JSON.stringify(mark)}는 열지 않는다`);odd.dispose();
 }
 const other=createAtlasNext({owner:'acct-f1-other',storage,trail:async()=>{throw Object.assign(Error('NETWORK'),{code:'NETWORK',retryable:true});},load,health:recorder()});
 assert.equal(await other.practiceCoach(POOL),null,'표지는 계정마다 — 다른 주인은 열지 않는다');other.dispose();
 let shape=false;const odd=createAtlasNext({owner:'acct-f1b',storage:memoryStorage(),trail:async()=>shape?real():({learning:null}),load:fakeLoader().load,health:recorder()});
 assert.equal(await odd.practiceCoach(POOL),null,'꼴에 안 맞는 계정 줄은 이번 연습만 지금 판');
 shape=true;assert.ok(await odd.practiceCoach(POOL),'다음 연습에서 다시 읽는다(ACCOUNT_UNREAD를 붙들지 않는다)');odd.dispose();
});

test('셸 알림 — 그 밖(426 등)은 계정을 다시 읽어 그대로면 코치를 두고 달라졌으면 닫는다, 저장소 닫힘(store)은 닫는다, 셸이 동의를 바꾸면 다시 정한다(넘친 #7 · F5 · #18)',async()=>{
 const line=accountLine();const {opened,load}=fakeLoader();
 const next=createAtlasNext({owner:'acct-f7',storage:memoryStorage(),trail:line.trail,load,health:recorder()});
 const coach=await next.practiceCoach(POOL);
 const reads=line.reads;
 coach.options.host.onAccount({kind:'other',code:'CONTRACT_UNSUPPORTED',status:426});
 await until(()=>line.reads>reads);await tick();await tick();
 assert.equal(coach.disposed,0,'판 · 동의 · 쓰기 문이 그대로면 코치를 둔다');
 line.revision=2;
 coach.options.host.onAccount({kind:'other',code:'CONTRACT_UNSUPPORTED',status:426});
 await until(()=>coach.disposed===1);
 const second=await next.practiceCoach(POOL);assert.equal(second.options.host.revision,2);
 const closed=[];next.retired(second,detail=>closed.push(detail.reason));
 second.options.host.onAccount({kind:'store',code:'STORE_CLOSED'});
 // 기기 길 코치도 저장소 닫힘을 받는다(서버와 오가지 않아 알림은 그것뿐 — F5 · 설계 주인 11-13)
 const deviceLine=accountLine({enabled:false,learningSync:false,revision:4});
 const devicePath=createAtlasNext({owner:'acct-f7d',storage:memoryStorage(),trail:deviceLine.trail,load:fakeLoader().load,health:recorder()});
 const deviceCoach=await devicePath.practiceCoach(POOL);
 assert.equal(deviceCoach.options.host.guest,true,'기기 길');assert.equal(typeof deviceCoach.options.host.onAccount,'function','기기 길 호스트에도 알림 통로');
 deviceCoach.options.host.onAccount({kind:'store',code:'STORE_CLOSED'});
 await until(()=>deviceCoach.disposed===1);devicePath.dispose();
 await until(()=>second.disposed===1);assert.deepEqual(closed,['store'],'저장소가 닫히면 닫는다');
 const third=await next.practiceCoach(POOL);
 next.redecide('account');
 await until(()=>third.disposed===1);
 assert.equal(opened.length,3);
 next.dispose();
});

test('지금 판이 풀리면 알린다 — 계정을 못 읽은 일시 실패 뒤 다시 읽어 새 길 · 꺼짐 표지 뒤 켜짐 · 첫 받기로 낮춘 판을 다른 코치가 되돌림 · 엔진을 못 받은 뒤 됨(계정 · 손님) — 알린 뒤 다시 물어 새 길을 받으면 또 알리지 않는다(§19-3 7 · Fable 5.2 끝 판 둘째 F2)',async()=>{
 // ㉠ 표지 없는 계정이 계정을 못 읽으면 이번은 지금 판 — 다음에 다시 읽어 새 길로 정해지면 알린다
 const line=accountLine();const real=line.trail;let down=true;
 line.trail=async()=>{if(down)throw fail(0,'NETWORK',{retryable:true});return real();};
 const a=createAtlasNext({owner:'acct-r1',storage:memoryStorage(),trail:()=>line.trail(),load:fakeLoader().load,health:recorder()});
 const heardA=[];const stop=a.reopened(detail=>heardA.push(detail.reason));
 assert.equal(await a.practiceCoach(POOL),null);assert.deepEqual(heardA,[],'지금 판으로 정한 때는 알리지 않는다');
 down=false;assert.ok(await a.practiceCoach(POOL));
 assert.deepEqual(heardA,['decided'],'지금 판 뒤 새 길로 정해지면 알린다');
 stop();a.redecide('account');assert.ok(await a.practiceCoach(POOL));assert.deepEqual(heardA,['decided'],'끊은 뒤 · 새 길 → 새 길은 알리지 않는다');
 a.dispose();
 // ㉡ 꺼짐 표지 — 뒤에서 다시 물어 켜졌으면 알린다(GB2와 같은 길)
 const storage=memoryStorage([[NEXT_MARK+'acct-r2',JSON.stringify({off:true})]]);
 const b=createAtlasNext({owner:'acct-r2',storage,trail:accountLine().trail,load:fakeLoader().load,health:recorder()});
 const heardB=[];b.reopened(detail=>heardB.push(detail.reason));
 assert.equal(await b.practiceCoach(POOL),null);
 await until(()=>heardB.includes('switch'));assert.equal(markOf(storage,'acct-r2').off,undefined);
 assert.ok(await b.lifeCoach(),'알림을 받은 면이 다시 물으면 새 길');assert.deepEqual(heardB,['switch'],'알린 뒤 다시 물어 받은 새 길은 또 알리지 않는다');
 b.dispose();
 // ㉢ 처음인 기기 — 연습 코치는 첫 받기를 못 해 이번 문서를 지금 판으로 낮추고, 같이 열던 생활 코치가 그 뒤 요약을 받으면 되돌리며 알린다
 let release=null;const late=new Promise(resolve=>{release=resolve;});
 const loader=fakeLoader(options=>options.banks.includes('world-life')?fakeCoach({synced:late}):fakeCoach({synced:{ok:false,kind:'offline',code:'NETWORK'}}));
 const c=createAtlasNext({owner:'acct-r3',storage:memoryStorage(),trail:accountLine().trail,load:loader.load,health:recorder()});
 const heardC=[];c.reopened(detail=>heardC.push(detail.reason));
 const life=c.lifeCoach();
 assert.equal(await c.practiceCoach(POOL),null,'첫 받기를 못 한 연습은 지금 판으로 낮춘다');
 release({ok:true,base:true});
 assert.ok(await life,'생활 코치는 요약을 받아 새 길');
 assert.deepEqual(heardC,['lowered'],'낮춘 판을 되돌리면 알린다');
 assert.ok(await c.practiceCoach(POOL),'다시 묻는 연습은 새 길');assert.deepEqual(heardC,['lowered'],'새 길을 준 뒤 새 길은 알리지 않는다');
 c.dispose();
 assert.equal(typeof c.reopened(()=>{}),'function','닫은 뒤에도 끊는 함수를 돌려준다');
 // ㉣ 새 길로 정해진 판(표지 went)도 그 연습에서 엔진을 못 받으면 지금 판 — 다음 연습에서 코치를 열면 알린다(갈래를 세지 않는다)
 let broken=true;const working=fakeLoader();const hD=recorder();
 const flaky=async()=>{if(broken)return {coach:()=>{throw Error('엔진 없음');},SynkAtlas:{load:async()=>{throw Error('offline');}}};return working.load();};
 const d=createAtlasNext({owner:'acct-r4',storage:memoryStorage([[NEXT_MARK+'acct-r4',JSON.stringify({went:true,path:'upload',revision:1})]]),trail:accountLine().trail,load:flaky,health:hD});
 const heardD=[];d.reopened(detail=>heardD.push(detail.reason));
 assert.equal(await d.lifeCoach(),null,'엔진을 못 받은 생활 코치는 지금 판');
 assert.ok(hD.notes.some(([kind,outcome])=>kind==='load'&&outcome.code==='PATH_ENGINE'),'까닭(PATH_ENGINE)은 계기에');
 broken=false;assert.ok(await d.practiceCoach(POOL),'다음 연습은 새 길');
 assert.deepEqual(heardD,['opened'],'지금 판을 준 뒤 새 길 코치를 주면 알린다');
 assert.ok(await d.lifeCoach());assert.deepEqual(heardD,['opened'],'그 뒤 다시 물어 받은 새 길은 또 알리지 않는다');
 d.dispose();
 // ㉤ 손님도 같다 — 판을 정하지 않아도 지금 판을 준 뒤 새 길이면 알린다
 broken=true;
 const e=createAtlasNext({owner:'guest',storage:memoryStorage(),load:flaky,health:recorder()});
 const heardE=[];e.reopened(detail=>heardE.push(detail.reason));
 assert.equal(await e.practiceCoach(POOL),null);assert.deepEqual(heardE,[],'지금 판을 줄 때는 알리지 않는다');
 broken=false;assert.ok(await e.lifeCoach());assert.deepEqual(heardE,['opened']);
 e.dispose();
});

test('표지의 판은 새 판으로 적는다 — 판이 오른 계정을 새 판으로 연 코치가 확인되면 표지도 새 판(F5 ④ — 오프라인 재개가 지워진 앞 판을 열지 않게)',async()=>{
 const storage=memoryStorage([[NEXT_MARK+'acct-m6',JSON.stringify({went:true,path:'upload',revision:1})]]);
 const next=createAtlasNext({owner:'acct-m6',storage,trail:accountLine({revision:2}).trail,load:fakeLoader().load,health:recorder()});
 assert.ok(await next.practiceCoach(POOL));
 assert.deepEqual(markOf(storage,'acct-m6'),{went:true,path:'upload',revision:2});
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

test('스위치 꺼짐 — 첫 받기가 FEATURE_DISABLED면 꺼짐 표지, 다음 시작은 곧장 지금 판이고 뒤에서 다시 물어 열리면 같은 문서의 다음 연습부터 새 길(GB2 — 다음에 판을 정할 때부터)',async()=>{
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
 assert.ok(await d.practiceCoach(POOL),'다음 문서도 새 길');
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
 assert.equal(host.legacy,undefined);assert.equal(host.transport,undefined);
 assert.equal(typeof host.onAccount,'function','알림 통로는 준다 — 서버와 오가지 않아 오는 것은 저장소 닫힘뿐(F5 · 설계 주인 11-13)');
 assert.equal(coach.syncedCalls,0);
 assert.deepEqual(markOf(storage,'acct-5'),{went:true,path:'device',revision:3});
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
 assert.deepEqual(markOf(storage,'acct-12'),{went:true,off:true,path:'upload',revision:1});
 assert.equal(await n2.practiceCoach(POOL),null);
 n2.dispose();
});

test('여는 사이에 판을 다시 정하면 앞 판에서 열던 코치는 돌려주지 않고 닫는다 — 그 면은 한 번 다시 정해 그 판의 코치를 받는다(지금 판으로 떨어지지 않는다, 카본 합친 끝 판 C1)',async()=>{
 let release;const slow=new Promise(resolve=>{release=resolve;});
 const line=accountLine();
 const {opened,load}=fakeLoader(options=>fakeCoach({ready:options.banks.includes('entry-check')?slow:Promise.resolve()}));
 const next=createAtlasNext({owner:'acct-13',storage:memoryStorage([[NEXT_MARK+'acct-13','{"went":true}']]),trail:line.trail,load,health:recorder()});
 const first=await next.practiceCoach(POOL);
 const pending=next.practiceCoach([{itemKey:'entry-check.x1'}]);
 await until(()=>true);await tick();
 first.options.host.onAccount({kind:'account',code:'LEARNING_DISABLED',status:403});
 release();
 const got=await pending;
 const checks=opened.filter(made=>made.options.banks.includes('entry-check'));
 assert.equal(checks.length,2,'다시 정한 판으로 한 번 더 열었다');
 assert.equal(checks[0].disposed,1,'앞 판에서 열던 코치는 닫았다');
 assert.equal(got,checks[1],'앞 판 코치가 아니라 다시 정한 판의 코치');
 assert.equal(got.disposed,0);
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
  move:async how=>{calls.push(['move',how.watermarks]);const sent=await how.postLegacy(legacy);calls.push(['sent',sent]);return {ok:sent?.ok===true,legacy:legacy.length,current:current.length,until:9};},
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
 // 옛 POST가 한 옛 꼴 묶음을 409로 걸면 그 묶음 번호는 ids에 싣지 않고(그것을 겨눈 2판 제외가 따라가지 않게) 계기에 남긴다(F5 ⑤)
 const clash=accountLine();const legacyLine=clash.trail;
 clash.trail=async()=>{const value=await legacyLine();return {...value,postLegacy:async events=>{if(events.some(e=>e.id==='p1'))throw fail(409,'EVENT_CONFLICT');clash.legacy.push(events);return {ok:true};}};};
 const health=recorder();
 const legacy2=[{id:'p1',type:'practice.presented',keep:true},{id:'a1',type:'practice.attempted',presentationId:'p1',attemptNo:1,keep:true},
  {id:'p2',type:'practice.presented',keep:true},{id:'a2',type:'practice.attempted',presentationId:'p2',attemptNo:1,keep:true}];
 let sent2=null;
 const aside2={plan:async()=>({legacy:legacy2,current:[],until:9,touches:new Map()}),
  move:async how=>{sent2=await how.postLegacy(legacy2);return {ok:sent2?.ok===true,legacy:legacy2.length,current:0,until:9};},keep:async()=>10,note:async()=>true,close:()=>{}};
 const moving=createAtlasNext({owner:'acct-18',storage,trail:()=>clash.trail(),load:fakeLoader(()=>fakeCoach({guestRecords:async()=>aside2})).load,health});
 const asked2=await moving.guestMove({watermarks,pick:events=>events.filter(e=>e.keep)});
 assert.equal((await asked2.move()).ok,true);
 assert.deepEqual([...sent2.ids].sort(),['a2','p2'],'걸린 묶음(p1 · a1)의 번호는 싣지 않는다');
 assert.ok(health.notes.some(([kind,outcome])=>kind==='save'&&outcome.code==='LEGACY_CONFLICT'),'건너뛴 것은 계기에');
 moving.dispose();
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
 // 낮춘 판을 되돌린 뒤(정한 판이 빈 채) 열린 코치에 그 밖 알림 — 계정이 그대로면 코치를 둔다(알린 코치의 판으로 견준다 — Fable 5.2 넘친 #21)
 const reads=line.reads;
 b.options.host.onAccount({kind:'other',code:'UPGRADE_REQUIRED',status:426});
 await until(()=>line.reads>reads);await tick();await tick();
 assert.equal(b.disposed,0,'계정이 그대로면 코치를 둔다');
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
 assert.equal((await postLegacyBatches(events,async batch=>{sent.push(batch.map(e=>e.id));return {ok:true};},{limit:4})).ok,true);
 assert.deepEqual(sent,[['d','p','a','c'],['f','x']]);
 sent.length=0;
 assert.equal((await postLegacyBatches(events,async batch=>{sent.push(batch.map(e=>e.id));return {ok:true};},{bytes:120})).ok,true);
 assert.ok(sent.length>1&&sent.flat().join()==='d,p,a,c,f,x','바이트로도 자른다');
 assert.equal((await postLegacyBatches(events,async batch=>({ok:batch[0].id!=='f'}),{limit:4})).ok,false);
 assert.deepEqual(await postLegacyBatches([],async()=>{throw Error('부르지 않는다');}),{ok:true,ids:[],skipped:0,gaveUp:false});
});

test('옛 POST 409 EVENT_CONFLICT — 그 옛 꼴 묶음은 다른 판으로 이미 서버에 있다: 번호가 없으면 묶음 단위로 반씩 가려 걸린 묶음만, 번호가 있으면 그 묶음만 건너뛰고, 여덟을 넘으면 옛 꼴 몫 전체를(F3)',async()=>{
 const at=n=>`2026-11-01T00:00:${String(n).padStart(2,'0')}.000Z`;
 const bundle=(p,n)=>[{id:p,type:'practice.presented',at:at(n)},{id:`${p}a`,type:'practice.attempted',presentationId:p,at:at(n+1)}];
 const events=[...bundle('p1',0),...bundle('p2',2),...bundle('p3',4),...bundle('p4',6)];
 const onServer=new Set(['p2','p2a']);const posts=[];
 const conflict=(extra={})=>Object.assign(Error('EVENT_CONFLICT'),{status:409,code:'EVENT_CONFLICT',...extra});
 const post=async batch=>{posts.push(batch.map(e=>e.id));if(batch.some(e=>onServer.has(e.id)))throw conflict();return {ok:true};};
 const sifted=await postLegacyBatches(events,post);
 assert.equal(sifted.ok,true);assert.equal(sifted.skipped,1);assert.equal(sifted.gaveUp,false);
 assert.deepEqual(sifted.ids.sort(),['p1','p1a','p3','p3a','p4','p4a'],'걸린 묶음(p2 — 머리와 답 함께)만 빼고 받았다');
 assert.ok(posts.every(batch=>!(batch.includes('p2')!==batch.includes('p2a'))),'묶음을 쪼개지 않는다');
 const named=await postLegacyBatches(events,async batch=>{if(batch.some(e=>e.id==='p3a'))throw conflict({ids:['p3a']});return {ok:true};});
 assert.deepEqual(named.ids.sort(),['p1','p1a','p2','p2a','p4','p4a'],'번호를 실은 409면 그 번호의 묶음만');
 const eight=Array.from({length:9},(_,i)=>bundle(`r${i}`,i*2)).flat();
 const atCap=await postLegacyBatches(eight,async batch=>{if(batch.some(e=>/^r[0-7]/.test(e.id)))throw conflict();return {ok:true};});
 assert.deepEqual([atCap.ok,atCap.gaveUp,atCap.skipped,[...atCap.ids].sort()],[true,false,8,['r8','r8a']],'건너뛴 묶음이 여덟이면 아직 가려낸다');
 const overCap=await postLegacyBatches(eight,async()=>{throw conflict();});
 assert.deepEqual([overCap.gaveUp,overCap.skipped],[true,9],'아홉째에 포기한다');
 const many=Array.from({length:10},(_,i)=>bundle(`q${i}`,i*2)).flat();
 const all=await postLegacyBatches(many,async()=>{throw conflict();});
 assert.deepEqual([all.ok,all.gaveUp,all.ids.length],[true,true,0],'여덟을 넘으면 옛 꼴 몫 전체를 건너뛴다');
 const down=await postLegacyBatches(events,async()=>{throw Object.assign(Error('NETWORK'),{code:'NETWORK',retryable:true});});
 assert.equal(down.ok,false,'그 밖의 실패는 다음에 다시');
 // 포기할 때 이미 머리를 보낸 묶음은 나머지까지 — 종류 먼저 차례라 첫 묶음은 머리(결정 · 제시)뿐이다(Fable 5.2 끝 판 둘째 넘친 #20)
 const tree=r=>[{id:`d${r}`,type:'decision.made',at:at(r)},{id:`p${r}`,type:'practice.presented',decisionId:`d${r}`,at:at(r+10)},
  {id:`a${r}`,type:'practice.attempted',presentationId:`p${r}`,at:at(r+20)}];
 const roots=[...tree(1),...tree(2),...tree(3)];
 const sent=[];
 const half=await postLegacyBatches(roots,async batch=>{if(batch.some(e=>/2$/.test(e.id)&&e.id!=='d2'))throw conflict();sent.push(...batch.map(e=>e.id));return {ok:true};},{limit:4,cap:0});
 assert.equal(half.gaveUp,true,'걸린 묶음 하나로 몫을 넘어 포기');
 assert.deepEqual([...half.ids].sort(),['a1','a3','d1','d2','d3','p1','p3'],'머리를 보낸 묶음(1 · 3)은 답까지 마저 보낸다 — 걸린 묶음(2)만 남는다');
 const lost=await postLegacyBatches(roots,async batch=>{if(batch.some(e=>/2$/.test(e.id)&&e.id!=='d2'))throw conflict();if(batch.some(e=>e.id==='a3'))throw Object.assign(Error('NETWORK'),{code:'NETWORK',retryable:true});return {ok:true};},{limit:4,cap:0});
 assert.equal(lost.ok,false,'마저 보내다 실패하면 실패(표지 없이 다음에 다시)');
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
 // 401 — 셸이 받는다(운영 나르개가 세션을 닫는 것과 같은 자리, Fable 5.2 끝 판 둘째 넘친 #9). 그 밖의 거절에는 부르지 않는다.
 let expired=0;
 const ended=rehearsalTrail({fetcher:async()=>({ok:false,status:401,json:async()=>({ok:false,error:{code:'AUTH_REQUIRED'}})}),onAuth:()=>{expired+=1;}});
 await assert.rejects(ended(),e=>e.code==='AUTH_REQUIRED'&&e.status===401);
 assert.equal(expired,1,'401이면 셸에 알린다');
 const refused=rehearsalTrail({fetcher:async()=>({ok:false,status:403,json:async()=>({ok:false,error:{code:'PRODUCT_FORBIDDEN'}})}),onAuth:()=>{expired+=1;}});
 await assert.rejects(refused());assert.equal(expired,1,'그 밖의 거절에는 알리지 않는다');
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
 assert.deepEqual(markOf(storage,A_ID),{went:true,path:'upload',revision:1});
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

test('생활 코치를 여는 사이 판을 다시 정하면 앞 판 코치는 닫고 한 번만 다시 정해 새 판 코치를 준다 — 이번 생활이 지금 판으로 떨어지지 않는다(GPT · 카본 합친 끝 판 GC2 · C1)',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 const line=accountLine(),{opened,load}=fakeLoader(()=>fakeCoach({ready:opened.length?Promise.resolve():gate}));
 const next=createAtlasNext({owner:'acct-gc2o',storage:memoryStorage(),trail:line.trail,load,health:recorder()});
 const asking=next.lifeCoach();
 await until(()=>opened.length===1);
 next.redecide('account'); // 여는 사이 — 설정 토글 등
 release();
 const coach=await asking;
 assert.ok(coach,'지금 판으로 떨어지지 않는다');
 assert.equal(coach,opened[1],'다시 정한 판의 코치');
 assert.equal(opened[0].disposed,1,'앞 판 코치는 닫혔다');
 assert.equal(line.reads,2,'다시 정하기는 한 번');
 next.dispose();
});

test('옮기기 물음 — 표지로 연 판을 다시 읽는 사이 판을 다시 정하면 앞 판(미확인)으로 「못 셈」하지 않고 다시 정해 센다(GPT 끝 판 둘째 GC2 · 합친 끝 판 C1)',async()=>{
 const storage=memoryStorage([[NEXT_MARK+'acct-gm',JSON.stringify({went:true,path:'upload',revision:3})]]);
 const line=accountLine({revision:3});const real=line.trail;let down=true,gate=null,release=()=>{};
 line.trail=async()=>{if(down)throw Object.assign(Error('NETWORK'),{code:'NETWORK',retryable:true});if(gate)await gate;return real();};
 const next=createAtlasNext({owner:'acct-gm',storage,trail:()=>line.trail(),load:fakeLoader().load,health:recorder()});
 assert.ok(await next.practiceCoach(POOL),'오프라인 — 표지의 판으로 새 길(미확인)');
 down=false;gate=new Promise(resolve=>{release=()=>{gate=null;resolve();};});
 const asking=next.guestMove({watermarks:{}});
 await tick();await tick();
 next.redecide('account'); // 다시 읽는 사이 — 설정 토글 등
 release();
 const answer=await asking;
 assert.notDeepEqual(answer,{failed:true},'앞 판(미확인)으로 「못 셈」하지 않는다');
 assert.equal(answer?.none,true,'다시 정한 판으로 센다(이 기기엔 옮길 것 없음)');
 next.dispose();
});

test('판을 다시 정해 이미 닫은 코치에 건 retired도 울린다 — 닫히기 직전에 그 코치를 받은 면이 닫힌 코치를 붙들지 않는다(카본 합친 끝 판 C2)',async()=>{
 const line=accountLine(),{opened,load}=fakeLoader();
 const next=createAtlasNext({owner:'acct-c2',storage:memoryStorage(),trail:line.trail,load,health:recorder()});
 const coach=await next.lifeCoach();
 assert.equal(coach,opened[0]);
 next.redecide('account');
 await tick();
 assert.equal(coach.disposed,1,'판을 다시 정해 닫았다');
 const heard=[];
 next.retired(coach,detail=>heard.push(detail.reason));
 const off=next.retired(coach,()=>heard.push('끊음'));off();
 await tick();
 assert.deepEqual(heard,['account'],'닫은 뒤에 건 알림도 그 까닭으로 울리고, 끊은 알림은 울리지 않는다');
 next.dispose();
});

test('생활 코치를 받은 직후 판을 다시 정해도 판정은 닫힌 코치를 붙들지 않고 새 판 코치로 간다(GPT · 카본 합친 끝 판 GC2 · C1 · C2)',async()=>{
 const line=accountLine();
 const {opened,load}=fakeLoader(()=>{const made=fakeCoach({base:true});made.summary=()=>{if(made.disposed)throw Object.assign(Error('DISPOSED'),{code:'DISPOSED'});return {storage:{base:true}};};made.due=()=>[];made.itemUnits=()=>[];return made;});
 const next=createAtlasNext({owner:'acct-gc2',storage:memoryStorage(),trail:line.trail,load,health:recorder()});
 let first=true;
 const w=watchLifeDue({open:()=>next.lifeCoach().then(made=>{if(first&&made){first=false;next.redecide('account');}return made;}),
  retired:(made,fn)=>next.retired(made,fn),reopened:fn=>next.reopened(fn),progress:{setDueSource(){}},lessons:[]});
 const coach=await until(async()=>{const made=await w.coach();return made&&made!==opened[0]?made:null;},3000);
 assert.equal(opened[0].disposed,1,'앞 판 코치는 닫혔다');
 assert.equal(coach.disposed,0,'새 판 코치');
 assert.equal(w.state(),'engine');
 w.dispose();next.dispose();
});

test('리허설 나르개의 늦은 401은 주인이 그대로일 때만 셸에 알린다 — 앞 계정의 늦은 요청이 새 세션을 로그인으로 돌리지 않는다(GPT · 카본 합친 끝 판 GC1 · C5)',async()=>{
 let who='acct-a',auths=0,release;const gate=new Promise(resolve=>{release=resolve;});
 const account={ok:true,status:200,json:async()=>({learning:{enabled:true,revision:1},capabilities:{learningSync:true}})};
 const denied=()=>({ok:false,status:401,json:async()=>({error:'AUTH_REQUIRED'})});
 const fetcher=async url=>{if(String(url).includes('trail-account'))return account;await gate;return denied();};
 const line=await rehearsalTrail({fetcher,owner:()=>who,onAuth:()=>{auths+=1;}})();
 const late=line.transport(1).get(null);
 who='acct-b';release();
 await assert.rejects(late,{code:'ACCOUNT_CHANGED'},'주인이 바뀌었으면 그 답은 버린다');
 assert.equal(auths,0,'앞 계정의 늦은 401은 셸에 알리지 않는다');
 const same=rehearsalTrail({fetcher:async()=>denied(),owner:()=>who,onAuth:()=>{auths+=1;}});
 await assert.rejects(same(),{status:401});
 assert.equal(auths,1,'주인이 그대로인 401은 셸에 알린다(로그인으로)');
});

test('면이 판을 묻는 사이 판이 풀렸으면(다른 면이 지금 판 뒤 새 길을 받음) 그 면이 지금 판을 준 직후 다시 알린다(카본 합친 끝 판 C3 ②)',async()=>{
 const line=accountLine();const real=line.trail;let down=true;
 line.trail=async()=>{if(down)throw Object.assign(Error('NETWORK'),{code:'NETWORK',retryable:true});return real();};
 let fail;const lifeReady=new Promise((resolve,reject)=>{fail=reject;});lifeReady.catch(()=>{});
 const {load}=fakeLoader(options=>fakeCoach(options.gameId==='world-life'?{ready:lifeReady}:{}));
 const next=createAtlasNext({owner:'acct-c3',storage:memoryStorage(),trail:()=>line.trail(),load,health:recorder()});
 const heard=[];next.reopened(detail=>heard.push(detail.reason));
 assert.equal(await next.practiceCoach(POOL),null,'계정을 못 읽어 지금 판');
 down=false;
 const life=next.lifeCoach(); // 생활 은행이 늦게 실패한다
 await until(()=>line.reads>=1); // 생활이 판을 정했다(은행은 아직)
 await tick();
 assert.ok(await next.practiceCoach(POOL),'짧은 연습은 새 길');
 assert.deepEqual(heard,['decided'],'지금 판 뒤 새 길로 정해진 순간 한 번 알렸다(그 뒤 새 길 코치는 또 알리지 않는다)');
 fail(Object.assign(Error('bank'),{code:'BANK'}));
 assert.equal(await life,null,'생활은 은행을 못 받아 이번은 지금 판');
 assert.deepEqual(heard,['decided','loosened'],'생활이 묻는 사이 판이 풀렸으니 지금 판을 준 직후 다시 알린다');
 next.dispose();
});

test('문서 시작 — 면이 판을 묻는 사이 다른 면이 새 길 코치를 처음 받았으면(지금 판을 준 적 없음) 그 면이 지금 판을 준 직후 알린다(카본 처리 판 A2)',async()=>{
 const line=accountLine();
 let fail;const lifeReady=new Promise((resolve,reject)=>{fail=reject;});lifeReady.catch(()=>{});
 const {load}=fakeLoader(options=>fakeCoach(options.gameId==='world-life'?{ready:lifeReady}:{}));
 const next=createAtlasNext({owner:'acct-a2',storage:memoryStorage(),trail:()=>line.trail(),load,health:recorder()});
 const heard=[];next.reopened(detail=>heard.push(detail.reason));
 try{
  const life=next.lifeCoach(); // 문서 시작 때 미리 연 생활 코치 — 은행이 늦게 실패한다
  await until(()=>line.reads>=1);
  await tick();
  assert.ok(await next.practiceCoach(POOL),'짧은 연습은 처음 정한 새 길');
  assert.deepEqual(heard,[],'처음 정한 새 길은 알릴 일이 아니다');
  fail(Object.assign(Error('bank'),{code:'BANK'}));
  assert.equal(await life,null,'생활은 은행을 못 받아 이번은 지금 판');
  assert.deepEqual(heard,['loosened'],'생활이 묻는 사이 다른 면이 새 길을 받았으니 지금 판을 준 직후 알린다 — 짧은 연습만 새 길로 가고 생활 판정이 알림 없이 지금 판에 남지 않게');
 }finally{next.dispose();} // 단정이 실패해도 입구를 닫는다(변형 실행에서 열린 채 남아 시험 프로세스가 멈췄다)
});

test('한 바퀴 — 켠 계정이 오프라인으로 다시 열어도 새 길이고 어제 단위가 보인다 · 푼 답은 그 판 저장소에 쌓였다가 온라인이면 올라가고, 판이 올랐으면 다시 정한다(계획 §6 시험 문장 · Fable 5.2 끝 판 둘째 F5)',{timeout:60_000},async()=>{
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
 const load=async()=>({SynkAtlas:{load:async()=>atlas},coach:options=>atlas.createCoach({...options,mapData:MAP_DATA,dayOffset:540,host:{...options.host,port:portOf(keyOf(options.host)),now:time.now}})});
 const storage=memoryStorage();
 const plays={allowedPlays,nextPlay};
 async function practise(coach,length){
  const session=createPracticeNextSession({plays,coach,pool:READING,length});
  while(session.next()){if(!session.current.heard)session.delivery('completed');session.answer(session.current.item.correctId);time.advance(30_000);}
  return session.settled();
 }
 const served=async()=>(await (await fetcher('/api/world/rehearsal/trail?revision=1',{headers:{'x-synk-contract':'1','x-synk-product':'world'}})).json()).summary;
 // 첫날 — 온라인으로 새 길(첫 받기), 연습 셋이 서버에 오른다
 const first=createAtlasNext({owner:A_ID,storage,trail:rehearsalTrail({fetcher}),load,health:recorder()});
 const day1=await first.practiceCoach(READING);
 assert.ok(day1);
 await practise(day1,3);
 await until(()=>day1.summary().storage.unsent===0,15_000);
 const yesterday=day1.summary().units.map(row=>row.unit);
 assert.ok(yesterday.length>0);
 first.dispose();
 // 다음 날 — 오프라인으로 다시 연다
 time.advance(20*3_600_000);
 let down=true;
 const line=rehearsalTrail({fetcher});
 const trail=async()=>{if(down)throw Object.assign(Error('NETWORK'),{code:'NETWORK',retryable:true});return line();};
 const second=createAtlasNext({owner:A_ID,storage,trail,load,health:recorder()});
 const day2=await second.practiceCoach(READING);
 assert.ok(day2,'오프라인으로 다시 열어도 새 길');
 assert.equal(day2.summary().storage.guest,false);
 for(const unit of yesterday)assert.ok(day2.summary().units.some(row=>row.unit===unit),`어제 단위 ${unit}가 보인다`);
 await practise(day2,2);
 assert.ok(day2.summary().storage.unsent>0,'오프라인 — 그 판 저장소에 쌓였다');
 down=false;
 await until(()=>day2.summary().storage.unsent===0,20_000);
 const after=await until(async()=>{const summary=await served();return summary&&summary.lines.length?summary:null;},15_000);
 assert.ok(after.lines.length>0,'온라인이면 그 판으로 올라갔다');
 second.dispose();
 // 오프라인인 사이 판이 올랐으면(다른 기기의 비움 · 동의 왕복) 온라인이 될 때 다시 정한다
 down=true;
 const third=createAtlasNext({owner:A_ID,storage,trail,load,health:recorder()});
 const day3=await third.practiceCoach(READING);
 assert.ok(day3);
 const closed=[];third.retired(day3,detail=>closed.push(detail.reason));
 await control({action:'revision'});
 await practise(day3,1);
 down=false;
 await until(()=>closed.length,20_000);
 assert.deepEqual(closed,['account'],'판이 달라졌다 — 앞 판 코치를 닫는다');
 const fresh=await third.practiceCoach(READING);
 assert.ok(fresh);assert.notEqual(fresh,day3);
 assert.ok(ports.has(atlas.storeName({account:A_ID,revision:2})),'오른 판의 저장소로 연다');
 assert.deepEqual(markOf(storage,A_ID),{went:true,path:'upload',revision:2});
 third.dispose();
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

test('리허설 나르개 — 받은 때의 주인과 지금 주인이 다르면 요청 앞뒤에서 ACCOUNT_CHANGED로 던진다(운영 check와 같은 꼴 — 넘친 #19)',async()=>{
 let who='player-a';const seen=[];
 const answer={ok:true,learning:{enabled:true,revision:1},capabilities:{learningSync:true},summary:null,serverTime:0};
 const line=await rehearsalTrail({fetcher:async url=>{seen.push(url);return {ok:true,status:200,json:async()=>answer};},owner:()=>who})();
 const transport=line.transport(1);
 await transport.get(null);
 who='player-b';
 await assert.rejects(transport.get(null),{code:'ACCOUNT_CHANGED'});
 await assert.rejects(line.postLegacy([{id:'o1'}]),{code:'ACCOUNT_CHANGED'});
 assert.equal(seen.length,2,'바뀐 뒤에는 보내지 않는다');
 who='player-a';
 const slow=rehearsalTrail({fetcher:async()=>{who='player-b';return {ok:true,status:200,json:async()=>answer};},owner:()=>who});
 await assert.rejects(slow(),{code:'ACCOUNT_CHANGED'},'답이 오는 사이 바뀌어도 그 답을 버린다');
});

test('끝 판 둘째 GC1 — 늦게 준비된 앞 판 코치는 표지를 앞 판으로 되돌리지 않는다',async()=>{
 const storage=memoryStorage([[NEXT_MARK+'acct-g1',JSON.stringify({went:true,path:'upload',revision:1})]]);
 const line=accountLine({revision:1});
 let release;const slow=new Promise(resolve=>{release=resolve;});let first=true;
 const {opened,load}=fakeLoader(()=>{const made=fakeCoach({ready:first?slow:Promise.resolve()});first=false;return made;});
 const next=createAtlasNext({owner:'acct-g1',storage,trail:line.trail,load,health:recorder()});
 const pending=next.practiceCoach(POOL);
 await until(()=>opened.length===1);
 line.revision=2;next.redecide('account');
 const second=await next.practiceCoach(POOL);
 assert.equal(second.options.host.revision,2);
 assert.deepEqual(markOf(storage,'acct-g1'),{went:true,path:'upload',revision:2});
 release();
 assert.equal(await pending,second,'앞 판 코치는 돌려주지 않고, 한 번 다시 정해 판 2 코치를 준다(카본 합친 끝 판 C1)');
 assert.equal(opened[0].disposed,1);
 assert.deepEqual(markOf(storage,'acct-g1'),{went:true,path:'upload',revision:2},'표지는 판 2 그대로');
 // 처음인 기기의 첫 받기가 늦게 끝나도 앞 판이면 표지를 쓰지 않는다
 const s2=memoryStorage(),l2=accountLine({revision:1});
 let done;const late=new Promise(resolve=>{done=resolve;});let made2=0;
 // 앞 판 코치의 첫 받기만 늦게 꺼짐을 알린다 — 다시 정한 판의 코치는 받는다
 const n2=createAtlasNext({owner:'acct-g1b',storage:s2,trail:l2.trail,load:fakeLoader(()=>fakeCoach({synced:made2++===0?late:{ok:true,base:true}})).load,health:recorder()});
 const waiting=n2.practiceCoach(POOL);
 await until(()=>l2.reads===1);await tick();
 n2.redecide('account');done({ok:false,kind:'switch',code:'FEATURE_DISABLED'});
 assert.ok(await waiting,'앞 판의 늦은 첫 받기 대신 한 번 다시 정한 판으로 연다(카본 합친 끝 판 C1)');
 assert.notEqual(markOf(s2,'acct-g1b').off,true,'앞 판의 첫 받기가 늦게 알린 꺼짐은 표지에 쓰지 않는다');
 assert.deepEqual(markOf(s2,'acct-g1b'),{went:true,path:'upload',revision:1},'표지는 다시 정한 판의 첫 받기가 쓴 것');
 // 기기 길 — 스위치를 묻는 사이 판을 다시 정하면 앞 판은 표지(기기 길 · 꺼짐)를 쓰지 않는다
 for(const late of [{},fail(403,'FEATURE_DISABLED')]){
  const s3=memoryStorage();let held=null;
  const l3=accountLine({enabled:false,revision:1,get:(since,at)=>at===1?new Promise((resolve,reject)=>{held=()=>late instanceof Error?reject(late):resolve(late);}):Promise.reject(fail(403,'LEARNING_DISABLED',{revision:at}))});
  const n3=createAtlasNext({owner:'acct-g1c',storage:s3,trail:l3.trail,load:fakeLoader().load,health:recorder(),switchAskMs:5000});
  const first3=n3.practiceCoach(POOL);
  await until(()=>held);
  l3.revision=2;n3.redecide('account');
  const now3=await n3.practiceCoach(POOL);
  assert.equal(now3.options.host.revision,2);
  assert.deepEqual(markOf(s3,'acct-g1c'),{went:true,path:'device',revision:2});
  held();
  assert.equal(await first3,now3,'늦게 온 앞 판은 지금 판으로');
  assert.deepEqual(markOf(s3,'acct-g1c'),{went:true,path:'device',revision:2},'앞 판의 스위치 답은 표지를 바꾸지 않는다');
  n3.dispose();
 }
 next.dispose();n2.dispose();
});

test('끝 판 둘째 GC2 — 계정을 읽는 사이 판을 다시 정하면 늦게 온 앞 판으로 열지 않고 지금 판으로',async()=>{
 const line=accountLine({revision:1});
 let hold=true,go=()=>{};
 const trail=async()=>{const value=await line.trail();if(hold){hold=false;await new Promise(resolve=>{go=resolve;});}return value;};
 const {opened,load}=fakeLoader();
 const next=createAtlasNext({owner:'acct-g2',storage:memoryStorage([[NEXT_MARK+'acct-g2','{"went":true}']]),trail,load,health:recorder()});
 const late=next.practiceCoach(POOL);
 await until(()=>line.reads===1);
 line.revision=2;next.redecide('account');
 const now=await next.practiceCoach(POOL);
 assert.equal(now.options.host.revision,2);
 go();
 assert.equal(await late,now,'늦게 온 판 1은 버리고 지금 판의 코치');
 assert.equal(opened.length,1,'판 1 코치는 열지 않는다');
 // 옮기기 물음도 같은 길 — 기다리는 사이 판이 바뀌면 지금 판으로 센다
 let hold2=true,go2=()=>{};
 const trail2=async()=>{const value=await line.trail();if(hold2){hold2=false;await new Promise(resolve=>{go2=resolve;});}return value;};
 const n2=createAtlasNext({owner:'acct-g2b',storage:memoryStorage([[NEXT_MARK+'acct-g2b','{"went":true}']]),trail:trail2,load:fakeLoader().load,health:recorder()});
 const asking=n2.guestMove({watermarks:{}});
 await until(()=>!hold2);
 line.revision=3;n2.redecide('account');go2();
 assert.equal((await asking).none,true,'판 3으로 다시 정해 센다');
 next.dispose();n2.dispose();
});

test('끝 판 둘째 GC3 — 표지로 연 기기 길(계정을 못 읽음)도 미확인: 옮기기 물음은 못 셈, 읽히면 처음부터 다시 정한다',async()=>{
 const storage=memoryStorage([[NEXT_MARK+'acct-g3',JSON.stringify({went:true,path:'device',revision:7})]]);
 const line=accountLine({enabled:false,revision:7,get:async()=>{throw fail(403,'LEARNING_DISABLED',{revision:7});}});
 let down=true;
 const {opened,load}=fakeLoader();
 const next=createAtlasNext({owner:'acct-g3',storage,trail:async()=>{if(down)throw fail(0,'NETWORK',{retryable:true});return line.trail();},load,health:recorder()});
 assert.deepEqual(await next.guestMove({watermarks:{}}),{failed:true},'표지로 연 기기 길은 못 셈');
 const offline=await next.practiceCoach(POOL);
 assert.equal(offline.options.host.key,atlas.storeName({account:'acct-g3',revision:7,local:true}),'오프라인이면 표지의 기기 길');
 down=false;
 const fresh=await next.practiceCoach(POOL);
 assert.equal(offline.disposed,1,'읽히면 처음부터 다시 정한다(스위치를 묻지 못했다)');
 assert.equal(fresh.options.host.revision,7);assert.equal(opened.length,2);
 assert.equal(await next.guestMove({watermarks:{}}),null,'확인된 기기 길은 지금 판 물음');
 next.dispose();
});

test('끝 판 둘째 GC3 — 표지로 연 기기 길이 엔진까지 못 받으면 옮기기 물음은 못 셈이다(기기 길로 확인된 계정의 지금 판 물음과 가른다 — 설계 주인 11-13)',async()=>{
 const storage=memoryStorage([[NEXT_MARK+'acct-g3b',JSON.stringify({went:true,path:'device',revision:7})]]);
 let broken=true;const working=fakeLoader();
 const load=async()=>{if(broken)return {coach:()=>{throw Error('엔진 없음');},SynkAtlas:{load:async()=>{throw Error('offline');}}};return working.load();};
 const health=recorder();
 const next=createAtlasNext({owner:'acct-g3b',storage,trail:async()=>{throw fail(0,'NETWORK',{retryable:true});},load,health});
 assert.deepEqual(await next.guestMove({watermarks:{}}),{failed:true},'계정 판을 확인하지 못했다 — 못 셈');
 assert.equal(await next.practiceCoach(POOL),null,'이번 연습은 지금 판');
 assert.ok(health.notes.some(([kind,outcome])=>kind==='load'&&outcome.code==='PATH_DEVICE_UNREAD'),'까닭은 확인된 기기 길(PATH_DEVICE_UNLOADED)과 따로');
 assert.equal(health.notes.some(([kind,outcome])=>kind==='load'&&outcome.code==='PATH_DEVICE_UNLOADED'),false);
 broken=false;
 const offline=await next.practiceCoach(POOL);
 assert.equal(offline.options.host.key,atlas.storeName({account:'acct-g3b',revision:7,local:true}),'엔진을 받으면 표지의 기기 길(판은 붙들지 않는다)');
 next.dispose();
});

test('끝 판 둘째 카본 C — 처음인 기기의 첫 받기가 스위치 꺼짐을 알리면 지금 판으로 정해진 것: 옮기기 물음은 지금 판 물음',async()=>{
 const storage=memoryStorage(),line=accountLine(),health=recorder();
 const {load}=fakeLoader(()=>fakeCoach({synced:{ok:false,kind:'switch',code:'FEATURE_DISABLED'}}));
 const next=createAtlasNext({owner:'acct-g4',storage,trail:line.trail,load,health});
 assert.equal(await next.guestMove({watermarks:{}}),null,'첫 받기가 꺼짐을 알린 옮기기 물음은 지금 판 물음');
 assert.deepEqual(markOf(storage,'acct-g4'),{off:true});
 assert.ok(health.notes.some(([kind,outcome])=>kind==='load'&&outcome.code==='PATH_SWITCH_OFF'),'까닭은 꺼짐으로 센다');
 assert.equal(await next.guestMove({watermarks:{}}),null,'같은 문서에서 다시 물어도 지금 판 물음');
 assert.equal(await next.practiceCoach(POOL),null);
 next.dispose();
 // 진짜 호스트의 차례 — 첫 받기 결과보다 먼저 셸 알림(switch)이 와서 판을 다시 정한 뒤에도 같다(Fable 5.2 — 알림 먼저 · 알림 없음 둘 다)
 const loudStorage=memoryStorage();
 const loud=createAtlasNext({owner:'acct-g4c',storage:loudStorage,trail:line.trail,load:fakeLoader(()=>{
  const made=fakeCoach({synced:{ok:false,kind:'switch',code:'FEATURE_DISABLED'}});const plain=made.synced;
  made.synced=async ms=>{made.options.host.onAccount({kind:'switch',code:'FEATURE_DISABLED',status:403});return plain(ms);};
  return made;}).load,health:recorder()});
 assert.equal(await loud.guestMove({watermarks:{}}),null,'알림이 먼저 와도 지금 판 물음');
 assert.deepEqual(markOf(loudStorage,'acct-g4c'),{off:true});
 assert.equal(await loud.guestMove({watermarks:{}}),null,'다시 물어도 지금 판 물음');
 loud.dispose();
 // 그 밖의 첫 받기 실패는 그대로 「못 셈」
 const lost=createAtlasNext({owner:'acct-g4b',storage:memoryStorage(),trail:line.trail,load:fakeLoader(()=>fakeCoach({synced:{ok:false,kind:'offline',code:'NETWORK'}})).load,health:recorder()});
 assert.deepEqual(await lost.guestMove({watermarks:{}}),{failed:true});
 lost.dispose();
});

test('끝 판 둘째 카본 C — 쓰기 · 그 밖 알림 뒤 계정을 못 읽으면(일시 실패) 코치는 두되 다음 연습이 다시 읽어 정하고, 인증 실패 등은 곧 다시 정한다',async()=>{
 const line=accountLine();let down=false;
 const {load}=fakeLoader();
 const next=createAtlasNext({owner:'acct-g6',storage:memoryStorage([[NEXT_MARK+'acct-g6','{"went":true}']]),trail:async()=>{if(down)throw fail(0,'NETWORK',{retryable:true});return line.trail();},load,health:recorder()});
 const coach=await next.practiceCoach(POOL);
 down=true;
 coach.options.host.onAccount({kind:'writes',code:'WRITES_DISABLED',status:403});
 for(let i=0;i<5;i++)await tick();
 assert.equal(coach.disposed,0,'못 읽은 동안은 코치를 둔다');
 assert.equal(await next.practiceCoach(POOL),coach,'아직 못 읽으면 그대로');
 down=false;line.learningSync=false;
 const after=await next.practiceCoach(POOL);
 assert.equal(coach.disposed,1,'다음 연습이 다시 읽어 쓰기 문이 닫혔으면 다시 정한다');
 assert.equal(after.options.host.guest,true);
 line.learningSync=true;
 // 다시 읽어 그대로면 표시를 풀고 그 뒤로는 읽지 않는다
 const l2=accountLine();let down2=false;
 const n2=createAtlasNext({owner:'acct-g6b',storage:memoryStorage([[NEXT_MARK+'acct-g6b','{"went":true}']]),trail:async()=>{if(down2)throw fail(0,'NETWORK',{retryable:true});return l2.trail();},load,health:recorder()});
 const c2=await n2.practiceCoach(POOL);
 down2=true;c2.options.host.onAccount({kind:'other',code:'CONTRACT_UNSUPPORTED',status:426});
 for(let i=0;i<5;i++)await tick();
 down2=false;const r2=l2.reads;
 assert.equal(await n2.practiceCoach(POOL),c2);assert.equal(l2.reads,r2+1,'한 번 다시 읽는다');
 assert.equal(await n2.practiceCoach(POOL),c2);assert.equal(l2.reads,r2+1,'그대로면 표시를 푼다');
 // 일시 실패가 아니면(인증 등) 곧 다시 정한다
 const l3=accountLine();let deny=false;
 const n3=createAtlasNext({owner:'acct-g6c',storage:memoryStorage([[NEXT_MARK+'acct-g6c','{"went":true}']]),trail:async()=>{if(deny)throw fail(401,'AUTH_REQUIRED');return l3.trail();},load,health:recorder()});
 const c3=await n3.practiceCoach(POOL);
 deny=true;c3.options.host.onAccount({kind:'other',code:'CONTRACT_UNSUPPORTED',status:426});
 await until(()=>c3.disposed===1);
 next.dispose();n2.dispose();n3.dispose();
});

test('끝 판 둘째 카본 C — 계정 줄의 주인이 입구의 주인과 다르면 쓰지 않고(표지 · 판 없이), 리허설 나르개는 손님 세션에서 묻지 않는다',async()=>{
 let who='guest';const seen=[];
 const answer={ok:true,learning:{enabled:true,revision:1},capabilities:{learningSync:true},summary:null,serverTime:0};
 const trail=rehearsalTrail({fetcher:async url=>{seen.push(url);return {ok:true,status:200,json:async()=>answer};},owner:()=>who});
 await assert.rejects(trail(),{code:'ACCOUNT_CHANGED'});assert.equal(seen.length,0,'손님 세션에서는 계정 줄을 읽지 않는다');
 who='player-b';
 assert.equal((await trail()).account,'player-b','줄에 주인을 싣는다');
 const storage=memoryStorage(),health=recorder(),{opened,load}=fakeLoader();
 const next=createAtlasNext({owner:'player-a',storage,trail,load,health});
 assert.equal(await next.practiceCoach(POOL),null,'다른 주인의 줄로는 열지 않는다');
 assert.equal(opened.length,0);assert.deepEqual(markOf(storage,'player-a'),{});
 assert.deepEqual(health.notes.at(-1),['load',{ok:false,code:'PATH_ACCOUNT_CHANGED'}]);
 who='player-a';
 assert.ok(await next.practiceCoach(POOL),'붙들지 않는다 — 주인이 맞으면 다음 연습에서 연다');
 next.dispose();
 // 주인을 모르는 나르개(owner 없음)는 줄에 주인을 싣지 않는다 — 견주지 않는다
 const plain=await rehearsalTrail({fetcher:async()=>({ok:true,status:200,json:async()=>answer})})();
 assert.equal('account' in plain,false);
});

test('끝 판 둘째 GC2 — 기기 길을 다시 읽는 사이 판을 다시 정하면 지금 판으로 열고, 옮기기 물음이 저장소를 보는 사이 판이 바뀌면 앞 판의 코치를 열지 않고 못 셈',async()=>{
 const line=accountLine({enabled:false,revision:3,get:async()=>{throw fail(403,'LEARNING_DISABLED',{revision:3});}});
 let hold=false,go=()=>{};
 const trail=async()=>{const value=await line.trail();if(hold){hold=false;await new Promise(resolve=>{go=resolve;});}return value;};
 const {opened,load}=fakeLoader();
 const next=createAtlasNext({owner:'acct-g2c',storage:memoryStorage(),trail,load,health:recorder()});
 const device=await next.practiceCoach(POOL);
 assert.equal(device.options.host.guest,true);
 hold=true;
 const again=next.practiceCoach(POOL); // 기기 길은 연습마다 계정을 다시 읽는다 — 그 읽기를 붙든다
 await until(()=>!hold);
 line.revision=4;next.redecide('account');
 go();
 const now=await again;
 assert.ok(now,'다시 읽는 사이 바뀐 판의 코치');
 assert.equal(now.options.host.revision,4);
 assert.equal(device.disposed,1);assert.equal(opened.length,2);
 next.dispose();
 // 옮기기 물음 — 손님 저장소가 있는지 보는 사이 판이 바뀐다
 const realIdb=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
 let called=false,release=()=>{};
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{databases:()=>{called=true;return new Promise(resolve=>{release=()=>resolve([{name:atlas.storeName({})}]);});}}});
 try{
  const l2=accountLine();
  const {opened:o2,load:load2}=fakeLoader();
  const n2=createAtlasNext({owner:'acct-g2d',storage:memoryStorage([[NEXT_MARK+'acct-g2d','{"went":true}']]),trail:l2.trail,load:load2,health:recorder()});
  const asking=n2.guestMove({watermarks:{}});
  await until(()=>called);
  n2.redecide('account');release();
  assert.deepEqual(await asking,{failed:true},'판이 바뀐 물음은 못 셈(기준 시각을 올리지 않는다)');
  assert.equal(o2.length,0,'앞 판의 코치는 열지 않는다');
  n2.dispose();
 }finally{
  if(realIdb)Object.defineProperty(globalThis,'indexedDB',realIdb);else delete globalThis.indexedDB;
 }
});
