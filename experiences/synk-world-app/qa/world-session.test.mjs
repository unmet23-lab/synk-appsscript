import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createLifeSession,sheetResource} from '../world-session.mjs';

// WORLD 자원 수명 경계(E01): 실제 createLifeSession·sheetResource를 앱 셸과 같은 단계 함수 모양으로 돌린다.
// 단계 함수는 만든 것(made)과 버린 것(log)을 남긴다. 통로·호스트·「내 성향」 답은 주인마다 문(gate)을 걸어 늦게 끝낼 수 있다.
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const A='acc-a',B='acc-b';

function fixture({failMount=()=>false}={}){
 let identity={owner:'guest',generation:0},serial=0;
 const log=[],made=[],statusHooks=[],gates={port:new Map(),host:new Map(),answers:new Map()};
 const piece=(kind,owner,extra={})=>{const value={kind,owner,id:`${kind}:${owner}#${++serial}`,disposed:0,...extra,dispose(){this.disposed++;log.push(`dispose ${this.id}`);}};made.push(value);return value;};
 const through=(map,owner,value)=>{const gate=map.get(owner);if(!gate)return value;map.delete(owner);return gate.promise.then(()=>value);};
 const life=createLifeSession({
  identity:()=>identity,
  openPort:({owner,guard,onStatus})=>{const port=piece('port',owner,{guard:()=>{guard();log.push('port guard');},status:()=>({phase:'synced'})});statusHooks.push({owner,onStatus});return through(gates.port,owner,port);},
  createProgress:({owner,port,guard,fallback})=>{const progress={kind:'progress',owner,id:`progress:${owner}#${++serial}`,port,guard,fallback,stopped:0,stop(){this.stopped++;log.push(`stop ${this.id}`);}};made.push(progress);return progress;},
  prepareHost:({owner})=>owner==='guest'?null:through(gates.host,owner,piece('host',owner)),
  readAnswers:({owner})=>gates.answers.get(owner)?.promise??null,
  mountView:({owner,progress,keep})=>{
   assert.equal(progress,life.progress,'배우기 화면은 지금 기록의 진도로 선다');
   keep('ui',piece('ui',owner));
   if(failMount(owner))throw Object.assign(Error('mount failed'),{code:'MOUNT_FAILED'});
   keep('education',piece('education',owner));keep('trail',piece('trail',owner));
   keep('reminders',piece('reminders',owner,{forgetPending(){log.push(`forget ${this.id}`);}}));
   log.push(`mount ${owner}`);
  },
  onLoading:({owner})=>log.push(`loading ${owner}`),
  onStatus:status=>log.push(`status ${status.phase}`),
  onReady:()=>log.push(`ready ${life.owner}`),
  onAnswers:()=>log.push(`answers ${life.owner}`),
  onError:error=>log.push(`error ${error.code}`),
 });
 const find=(kind,owner)=>made.filter(value=>value.kind===kind&&value.owner===owner);
 return {life,log,made,statusHooks,find,
  set(value){identity={...identity,...value};},
  gate(kind,owner){const gate=deferred();gates[kind].set(owner,gate);return gate;},
  count:entry=>log.filter(line=>line===entry).length};
}

test('계정 A를 준비하는 사이 B로 바뀌면 늦게 끝난 A의 통로는 그 자리에서 버리고 A의 진도·화면·상태는 붙지 않는다',async()=>{
 const f=fixture(),portGate=f.gate('port',A);
 f.set({owner:A,generation:1});assert.equal(f.life.sync(),true);const readyA=f.life.ready;
 f.set({owner:B,generation:2});assert.equal(f.life.sync(),true);await f.life.ready;
 assert.equal(f.life.owner,B);assert.equal(f.life.mounted,true);const portB=f.find('port',B)[0];assert.equal(f.life.port,portB);
 portGate.resolve();await readyA;
 const [portA]=f.find('port',A);
 assert.equal(portA.disposed,1,'늦게 온 A의 통로는 버린다');assert.equal(f.life.port,portB,'B의 통로는 그대로');
 assert.deepEqual(f.find('progress',A),[],'A의 진도는 만들지 않는다');assert.deepEqual(f.find('ui',A),[]);
 assert.equal(f.count(`mount ${A}`),0);assert.equal(f.count(`ready ${A}`),0);assert.equal(f.log.filter(line=>line.startsWith('error')).length,0,'버린 기록의 실패는 알리지 않는다');
 f.statusHooks.find(hook=>hook.owner===A).onStatus({phase:'conflict'});assert.equal(f.count('status conflict'),0,'버린 기록의 통로 상태는 화면에 오지 않는다');
 f.statusHooks.find(hook=>hook.owner===B).onStatus({phase:'conflict'});assert.equal(f.count('status conflict'),1);
});

test('계정 A의 학습 호스트를 기다리는 사이 B로 바뀌면 A의 진도는 멈추고 늦게 온 호스트는 버린다',async()=>{
 const f=fixture(),hostGate=f.gate('host',A);
 f.set({owner:A,generation:1});f.life.sync();const readyA=f.life.ready;await settle();
 const [progressA]=f.find('progress',A);assert.ok(progressA,'통로를 받은 뒤 진도를 세웠다');assert.equal(f.life.mounted,false);
 f.set({owner:B,generation:2});f.life.sync();
 assert.equal(progressA.stopped,1);assert.equal(f.find('port',A)[0].disposed,1);
 hostGate.resolve();await readyA;await f.life.ready;
 assert.equal(f.find('host',A)[0].disposed,1,'늦게 온 A의 호스트는 버린다');assert.equal(progressA.stopped,1,'멈춤은 한 번');
 assert.equal(f.count(`mount ${A}`),0);assert.equal(f.life.owner,B);assert.equal(f.life.mounted,true);
});

test('같은 주인의 새 세대는 옛 기록을 만든 반대 순서로 한 번씩 버리고 새로 세운다 — 알림 예약은 지우지 않는다',async()=>{
 const f=fixture();
 f.set({owner:A,generation:1});f.life.sync();await f.life.ready;
 const old={ui:f.life.ui,education:f.life.education,trail:f.life.trail,reminders:f.life.reminders,host:f.find('host',A)[0],progress:f.life.progress,port:f.life.port};
 assert.ok(Object.values(old).every(Boolean));
 f.log.length=0;f.set({generation:2});assert.equal(f.life.sync(),true);
 assert.deepEqual(f.log.slice(0,7),[`dispose ${old.reminders.id}`,`dispose ${old.trail.id}`,`dispose ${old.education.id}`,`dispose ${old.ui.id}`,`dispose ${old.host.id}`,`stop ${old.progress.id}`,`dispose ${old.port.id}`]);
 assert.equal(f.log.filter(line=>line.startsWith('forget')).length,0,'같은 주인이면 보내지 않은 알림 예약을 그대로 둔다');
 assert.throws(()=>old.progress.guard(),{code:'ACCOUNT_CHANGED'},'옛 진도의 확인은 던진다');
 await f.life.ready;
 assert.notEqual(f.life.port,old.port);assert.notEqual(f.life.ui,old.ui);assert.equal(f.life.mounted,true);assert.doesNotThrow(()=>f.life.progress.guard());
 assert.equal(f.life.sync(),false,'같은 주인·세대면 다시 세우지 않는다');
 for(const value of Object.values(old))assert.equal(value.disposed??value.stopped,1,value.id);
});

test('보내지 않은 알림 예약은 주인이 바뀔 때만 지운다 — 같은 주인을 다시 세우거나 새 세대일 때는 그대로',async()=>{
 const f=fixture();
 f.life.sync();await f.life.ready;const guestReminders=f.life.reminders;assert.equal(guestReminders.owner,'guest');
 f.set({owner:A,generation:1});f.life.sync();
 assert.ok(f.log.indexOf(`forget ${guestReminders.id}`)>=0&&f.log.indexOf(`forget ${guestReminders.id}`)<f.log.indexOf(`dispose ${guestReminders.id}`),'버리기 전에 옛 주인의 예약부터 지운다');
 await f.life.ready;
 const before=f.log.filter(line=>line.startsWith('forget')).length;
 await f.life.reload();
 f.set({generation:2});f.life.sync();await f.life.ready;
 assert.equal(f.log.filter(line=>line.startsWith('forget')).length,before,'같은 주인: 다시 세우기·새 세대');
 const accountReminders=f.life.reminders;
 f.set({owner:B,generation:3});f.life.sync();
 assert.equal(f.count(`forget ${accountReminders.id}`),1,'A → B는 A의 예약을 지운다');await f.life.ready;
 // 아직 화면이 서지 않은 기록(알림 없음)에서 주인이 바뀌어도 깨지지 않는다.
 const gate=f.gate('port',A);f.set({owner:A,generation:4});f.life.sync();f.set({owner:'guest',generation:5});assert.doesNotThrow(()=>f.life.sync());gate.resolve();await f.life.ready;
 assert.equal(f.life.owner,'guest');assert.equal(f.life.mounted,true);
});

test('close(pagehide)는 몇 번 불러도 한 번만 버리고, 그 뒤 계정 정리·다시 맞추기가 생활 화면을 다시 세우지 않는다',async()=>{
 const f=fixture();
 f.set({owner:A,generation:1});f.life.sync();await f.life.ready;
 f.set({owner:B,generation:2});f.life.sync();await f.life.ready;
 f.life.close();f.life.close();
 for(const value of f.made)assert.equal(value.disposed??value.stopped,1,value.id);
 assert.equal(f.life.closed,true);assert.equal(f.life.owner,null);assert.equal(f.life.ui,null);assert.equal(f.life.progress,null);assert.equal(f.life.mounted,false);
 // pagehide의 account.stop() → onInvalidate → client.invalidate() → onChange처럼 주인·세대가 바뀌어도 새 기록을 세우지 않는다.
 const loads=f.log.filter(line=>line.startsWith('loading')).length;
 f.set({owner:'guest',generation:3});assert.equal(f.life.sync(),false);await f.life.ensure();await f.life.reload();
 assert.equal(f.log.filter(line=>line.startsWith('loading')).length,loads);assert.equal(f.life.remount(f.life.epoch),false);
 await f.life.refresh();assert.equal(f.life.refreshing,null);
});

test('pagehide 뒤에 늦게 끝난 통로·호스트·「내 성향」 답은 버리거나 무시하고 화면을 다시 세우지 않는다',async()=>{
 const port=fixture(),portGate=port.gate('port',A);
 port.set({owner:A,generation:1});port.life.sync();const portReady=port.life.ready;
 port.life.close();portGate.resolve();await portReady;
 assert.equal(port.find('port',A)[0].disposed,1);assert.deepEqual(port.find('progress',A),[]);
 assert.equal(port.count(`mount ${A}`),0);assert.equal(port.count(`ready ${A}`),0);assert.equal(port.log.filter(line=>line.startsWith('error')).length,0);

 const host=fixture(),hostGate=host.gate('host',A);
 host.set({owner:A,generation:1});host.life.sync();const hostReady=host.life.ready;await settle();
 const [progress]=host.find('progress',A);assert.ok(progress);
 host.life.close();assert.equal(progress.stopped,1);assert.equal(host.find('port',A)[0].disposed,1);
 hostGate.resolve();await hostReady;
 assert.equal(host.find('host',A)[0].disposed,1);assert.equal(host.count(`mount ${A}`),0);assert.equal(host.log.filter(line=>line.startsWith('error')).length,0);

 const answers=fixture(),answersGate=answers.gate('answers',A);
 answers.set({owner:A,generation:1});answers.life.sync();await answers.life.ready;
 answers.life.close();answersGate.resolve({topics:['food']});await settle();
 assert.equal(answers.count(`answers ${A}`),0);assert.equal(answers.life.answers,null);
});

test('「내 성향」 답은 늦게 와도 그 주인의 기록이 지금일 때만 붙고, 주인이 바뀐 뒤 온 답은 버린다',async()=>{
 const f=fixture(),gate=f.gate('answers',A);
 f.set({owner:A,generation:1});f.life.sync();await f.life.ready;
 assert.equal(f.life.answers,null,'답을 기다리는 동안에도 화면은 선다');assert.equal(f.life.mounted,true);
 gate.resolve({topics:['food']});await settle();
 assert.deepEqual(f.life.answers,{owner:A,topics:['food']});assert.equal(f.count(`answers ${A}`),1);
 const late=f.gate('answers',A);f.set({generation:2});f.life.sync();await f.life.ready;
 f.set({owner:B,generation:3});f.life.sync();await f.life.ready;
 late.resolve({topics:['travel']});await settle();
 assert.equal(f.life.answers,null,'B의 기록에 A의 답이 붙지 않는다');assert.equal(f.count(`answers ${A}`),1);assert.equal(f.count(`answers ${B}`),0);
 const empty=f.gate('answers',B);f.set({generation:4});f.life.sync();await f.life.ready;empty.resolve(null);await settle();
 assert.equal(f.life.answers,null,'빈 답은 붙이지 않는다');
});

test('저장 충돌을 고른 뒤 remount는 같은 통로로 진도와 배우기 화면만 다시 세우고, 기록이 바뀌었으면 아무것도 하지 않는다',async()=>{
 const f=fixture();
 f.set({owner:A,generation:1});f.life.sync();await f.life.ready;
 const port=f.life.port,progress=f.life.progress,ui=f.life.ui,reminders=f.life.reminders,host=f.find('host',A)[0],epoch=f.life.epoch;
 f.life.recoveryShown=true;
 assert.equal(f.life.remount(epoch-1),false);assert.equal(progress.stopped,0);assert.equal(ui.disposed,0);assert.equal(f.life.recoveryShown,true);
 assert.equal(f.life.remount(epoch),true);
 assert.equal(f.life.port,port);assert.equal(port.disposed,0,'통로는 그대로');assert.equal(host.disposed,0,'학습 호스트도 그대로');
 assert.equal(progress.stopped,1);assert.equal(ui.disposed,1);assert.equal(reminders.disposed,1);assert.equal(f.count(`forget ${reminders.id}`),0);
 assert.notEqual(f.life.progress,progress);assert.equal(f.life.progress.port,port);assert.equal(f.life.progress.fallback,false);
 f.life.progress.guard();assert.equal(f.count('port guard'),1,'다시 세운 진도는 그 통로의 확인을 쓴다');
 assert.notEqual(f.life.ui,ui);assert.equal(f.life.mounted,true);assert.equal(f.life.recoveryShown,false);
 const guest=fixture();guest.life.sync();await guest.life.ready;assert.equal(guest.life.remount(guest.life.epoch),false,'통로 없는 기록(손님)은 remount하지 않는다');
});

test('계정 통로를 못 열면 기기 기록으로 이어 가고, 지금 기록의 실패만 알리며 실패 전에 붙은 조각도 다음 기록에서 버린다',async()=>{
 const fallback=fixture(),gate=fallback.gate('port',A);
 fallback.set({owner:A,generation:1});fallback.life.sync();gate.reject(Object.assign(Error('offline'),{code:'NETWORK_UNAVAILABLE'}));await fallback.life.ready;
 assert.equal(fallback.life.port,null);assert.equal(fallback.life.progress.fallback,true);assert.equal(fallback.life.mounted,true);assert.equal(fallback.log.filter(line=>line.startsWith('error')).length,0);

 const stale=fixture(),staleGate=stale.gate('port',A);
 stale.set({owner:A,generation:1});stale.life.sync();const staleReady=stale.life.ready;stale.set({owner:B,generation:2});stale.life.sync();
 staleGate.reject(Error('offline'));await staleReady;
 assert.deepEqual(stale.find('progress',A),[],'버린 기록은 기기 기록으로도 이어 가지 않는다');

 const failing=fixture({failMount:owner=>owner===A});
 failing.set({owner:A,generation:1});failing.life.sync();await failing.life.ready;
 assert.equal(failing.count('error MOUNT_FAILED'),1);assert.equal(failing.life.mounted,false);assert.equal(failing.count(`ready ${A}`),0);
 const [ui]=failing.find('ui',A);assert.equal(ui.disposed,0);
 failing.set({owner:B,generation:2});failing.life.sync();assert.equal(ui.disposed,1,'실패 전에 붙은 생활 화면도 다음 기록에서 버린다');
});

test('버려진 기록에 화면 조각을 붙이려 하면 그 조각을 바로 버리고 ACCOUNT_CHANGED로 멈춘다',async()=>{
 let switchDuringMount=true,keepError=null,identity={owner:A,generation:1};const parts=[];
 const life=createLifeSession({identity:()=>identity,openPort:async()=>({dispose(){}}),createProgress:()=>({stop(){}}),
  mountView:({keep})=>{
   const ui={disposed:0,dispose(){this.disposed++;}};parts.push(ui);keep('ui',ui);
   if(switchDuringMount){switchDuringMount=false;identity={owner:B,generation:2};life.sync();}
   const education={disposed:0,dispose(){this.disposed++;}};parts.push(education);
   try{keep('education',education);}catch(error){keepError=error;throw error;}
  },onError:()=>assert.fail('버린 기록의 실패는 알리지 않는다')});
 life.sync();await new Promise(resolve=>setImmediate(resolve));await life.ready;
 assert.equal(keepError?.code,'ACCOUNT_CHANGED');assert.equal(parts[0].disposed,1);assert.equal(parts[1].disposed,1,'늦게 붙이려던 조각은 그 자리에서 버린다');
 assert.equal(life.owner,B);assert.equal(life.mounted,true);
});

test('다시 연결 refresh는 화면이 선 기록에서만 돌고, 보내는 동안의 부름은 같은 약속을 쓴다',async()=>{
 const gate=deferred();let flushes=0,loads=0;
 const life=createLifeSession({identity:()=>({owner:A,generation:1}),openPort:async()=>({dispose(){}}),
  createProgress:()=>({flush:async()=>{flushes++;await gate.promise;},stop(){}}),onLoading:()=>{loads++;}});
 assert.equal(await life.refresh(),undefined);assert.equal(flushes,0,'아직 세우지 않았으면 보내지 않는다');
 life.sync();const loading=life.refresh();assert.equal(life.refreshing,null);await loading;assert.equal(flushes,0,'준비 중인 기록은 보내지 않는다');
 await life.ready;
 const first=life.refresh({rebuild:()=>false});assert.equal(life.refresh(),first);assert.equal(flushes,1);
 gate.resolve();await first;assert.equal(loads,1,'rebuild가 거짓이면 다시 세우지 않는다');assert.equal(life.refreshing,null);
 await life.refresh();assert.equal(loads,2,'열린 시트가 없으면 계정 진도를 다시 읽는다');
});

test('시트 자원은 다른 시트 열기·닫기·패널 close 이벤트·pagehide가 겹쳐 불러도 한 번만 버리고, 시트가 알릴 것(hasDraft)을 그대로 준다',()=>{
 let disposed=0;const resource=sheetResource(()=>{disposed++;},{hasDraft:()=>true});
 assert.equal(resource.hasDraft(),true);assert.ok(Object.isFrozen(resource));
 resource.dispose();resource.dispose();resource.dispose();
 assert.equal(disposed,1);
});

// 앱 셸의 실제 시트 줄(show·attachSheet·releaseSheet·close·패널 close 이벤트)과 원고 닫기 확인 줄을 진짜 sheetResource로 돌린다.
function shellSheets(){
 const source=readFileSync(new URL('../app-shell.mjs',import.meta.url),'utf8').replaceAll('\r\n','\n').split('\n');
 const line=prefix=>{const found=source.filter(text=>text.startsWith(prefix));assert.equal(found.length,1,prefix);return found[0];};
 const code=[line('function show('),line('function attachSheet('),line('function releaseSheet('),line('const confirmCourseExit='),line("document.addEventListener('click',event=>{if(!sheet?.hasDraft?.())"),
  line("document.addEventListener('keydown',"),line('function close(){'),line("worldPanel.addEventListener('close',()=>{if(!worldPanel.open)")].join('\n');
 const listeners={},panel={},asked=[];let answer=false;
 const context={sheet:null,gameLaunch:0,gameRecovery:null,screen:'',hangerSignature:'',EYEBROWS:{},sheetResource,client:{snapshot:null},renderHomeHanger(){},
  home:{showPanel(){context.worldPanel.open=true;},closePanel(){/* 닫기 효과(160ms) 뒤에 패널 close 이벤트가 온다 */}},
  worldPanel:{open:false,addEventListener:(type,fn)=>{panel[type]=fn;}},
  window:{confirm:text=>{asked.push(text);return answer;}},document:{addEventListener:(type,fn)=>{listeners[type]=fn;}}};
 vm.createContext(context);vm.runInContext(code,context);
 const click=dataset=>{const event={target:{id:'',closest:()=>({dataset})},prevented:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){}};listeners.click(event);return event.prevented;};
 const escape=()=>{const event={key:'Escape',preventDefault(){},stopImmediatePropagation(){}};listeners.keydown(event);};
 const run=name=>vm.runInContext(name,context);
 return {context,asked,click,escape,answer:value=>{answer=value;},show:type=>run('show')('제목','',type),attach:(dispose,extra)=>run('attachSheet')(dispose,extra),
  close:()=>run('close')(),release:()=>run('releaseSheet')(),panelClosed:open=>{context.worldPanel.open=open;panel.close();}};
}

test('앱 셸 시트: 내지 않은 수업 원고가 있으면 닫기·다른 화면 전에 묻고, 로그아웃·버린 뒤·원고 없는 시트에서는 묻지 않는다',()=>{
 const f=shellSheets();let disposed=0;
 f.show('world-profile');const profile=f.attach(()=>{disposed++;},{hasDraft:()=>true});assert.equal(f.context.sheet,profile);
 assert.equal(f.click({world:'home'}),true,'원고가 있는데 「아니요」면 막는다');assert.equal(f.asked.length,1);
 f.answer(true);assert.equal(f.click({view:'me'}),false,'「예」면 그대로 간다');assert.equal(f.asked.length,2);
 assert.equal(f.click({world:'logout'}),false);assert.equal(f.asked.length,2,'로그아웃은 묻지 않고 계정 정리가 바로 버린다');
 f.answer(false);f.escape();assert.equal(disposed,0,'Esc에 「아니요」면 닫지 않는다');
 f.answer(true);f.escape();assert.equal(disposed,1,'Esc에 「예」면 닫으면서 시트 자원을 버린다');assert.equal(f.context.sheet,null);assert.equal(f.context.screen,'');
 f.release();profile.dispose();f.panelClosed(false);assert.equal(disposed,1,'패널 close 이벤트·pagehide가 다시 불러도 한 번');
 const asked=f.asked.length;assert.equal(f.click({world:'home'}),false);assert.equal(f.asked.length,asked,'버린 시트의 원고는 묻지 않는다');
 f.show('game');f.attach(()=>{});assert.equal(f.click({world:'home'}),false);assert.equal(f.asked.length,asked,'원고가 없는 시트(마을)에서는 묻지 않는다');
});

test('앱 셸 시트: 다른 시트를 열면 앞 시트를 열기 전에 버리고, home이 닫을 때는 닫기 효과가 끝난 close 이벤트에서 버리며, 늦게 온 close 이벤트는 새 시트를 버리지 않는다',()=>{
 const f=shellSheets();const order=[];
 f.show('game');const town=f.attach(()=>order.push('town'));
 f.context.home.showPanel=()=>{order.push('show');f.context.worldPanel.open=true;};
 f.show('world-profile');assert.deepEqual(order,['town','show'],'앞 시트(마을 호스트)는 새 시트를 열기 전에 버린다');assert.equal(f.context.sheet,null);
 let profile=0;f.attach(()=>{profile++;},{hasDraft:()=>false});
 // home이 스스로 닫는 길(닫기 단추·바깥 누름): 닫기 효과 동안은 칸이 그대로 있고, 패널이 다 닫힌 close 이벤트에서 버린다.
 f.context.worldPanel.open=true;assert.equal(profile,0);
 f.panelClosed(false);assert.equal(profile,1);assert.equal(f.context.screen,'');
 // 닫기 효과 사이에 새 시트가 열렸으면(패널이 다시 열림) 늦게 온 close 이벤트는 새 시트를 버리지 않는다.
 let next=0;f.show('world-profile');f.attach(()=>{next++;});f.panelClosed(true);assert.equal(next,0);
 f.close();assert.equal(next,1);town.dispose();assert.deepEqual(order.filter(x=>x==='town'),['town']);
});
