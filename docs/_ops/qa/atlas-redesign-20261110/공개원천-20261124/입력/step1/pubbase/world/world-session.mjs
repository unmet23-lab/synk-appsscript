// WORLD 자원 수명 경계(E01, 2026-10-23). 앱 셸(app-shell.mjs)의 자원을 수명 두 갈래로 나눈다.
// · 계정 수명 — createLifeSession: 지금 주인(계정 id·손님)과 세대(WorldClient.generation)에 묶인 생활 학습 자원.
// · 시트 수명 — sheetResource: 시트 하나에 딸린 자원. 앱 셸의 한 칸(sheet)이 갖고 시트를 바꾸거나 닫을 때 버린다.

const accountChanged=()=>Object.assign(Error('로그인한 계정이 바뀌었어요. 생활 한국어를 다시 열어 주세요.'),{code:'ACCOUNT_CHANGED'});
const pending=value=>!!value&&typeof value.then==='function';
// 한 조각을 버리다 실패해도 나머지는 버린다(계정이 바뀐 뒤 옛 조각이 남지 않게).
function release(dispose,value){try{dispose(value);}catch(error){console.warn('WORLD cleanup failed',error);}}
const disposeOf=value=>value?.dispose?.();

// 생활 기록 하나 = 주인·세대·회차(epoch) + 생활 진도 통로(port) · 학습 호스트(host) · 진도(progress) · 「내 성향」 답(answers)
// · 배우기 화면 조각(mountView가 keep으로 붙인 ui·education·trail·reminders).
// 무엇을 어떻게 만들지는 단계 함수(앱 셸)가 정하고, 이 경계는 언제 세우고 버리는지와 늦게 끝난 준비를 어떻게 다룰지만 정한다.
// - sync(): WorldClient가 바뀔 때마다 부른다. 주인이나 세대가 다르면 옛 기록을 버리고 새로 세운다. 주인이 바뀔 때만
//   (손님 ↔ 계정, 계정 ↔ 계정) 옛 주인의 보내지 않은 알림 예약을 지운다(forgetPending) — 같은 주인의 새 세대·다시 세우기는 그대로 둔다.
// - 버린 기록에 늦게 도착한 통로·호스트·화면 조각은 붙이지 않고 그 자리에서 버린다. 버린 기록의 통로 상태·답·실패는 알리지 않는다.
// - close()(pagehide) 뒤에는 다시 세우지 않는다 — 늦게 끝난 준비나 계정 정리(account.stop)가 닫히는 문서에 화면을 다시 붙이지 않는다.
// - 버리기는 기록마다 한 번만 돈다. 순서는 만든 반대: 화면 조각(나중에 붙인 것부터) → 학습 호스트 → 진도 → 통로.
//
// 단계 함수(모두 지금 기록의 주인과 guard를 받는다. guard는 기록이 버려졌거나 주인·세대가 바뀌면 ACCOUNT_CHANGED로 던진다):
//  identity() → {owner,generation}            지금 WorldClient의 주인·세대
//  openPort({owner,guard,onStatus}) → port     계정 생활 진도 통로(손님에게는 부르지 않는다). 실패하면 기기 기록으로 이어 간다(fallback).
//  createProgress({owner,port,guard,fallback}) 생활 진도. remount에서는 그 통로의 확인(port.guard)으로 다시 만든다.
//  prepareHost({owner,guard}) → host|null      학습 호스트(버릴 것을 돌려줄 때만 이 기록이 갖는다). 약속이어도 된다.
//  readAnswers({owner}) → Promise|null         「내 성향」 답. 늦게 와도 그 기록이 지금일 때만 붙인다.
//  mountView({owner,progress,keep})            배우기 화면. keep(name,value,dispose?)로 붙인 조각을 이 기록이 갖는다(이름마다 하나).
//  onLoading({owner}) · onStatus(status) · onReady() · onAnswers() · onError(error) — 모두 지금 기록일 때만 부른다.
export function createLifeSession({identity,openPort,createProgress,prepareHost=()=>null,readAnswers=()=>null,mountView=()=>{},
 onLoading=()=>{},onStatus=()=>{},onReady=()=>{},onAnswers=()=>{},onError=()=>{}}){
 let current=null,epoch=0,ready=null,refreshing=null,closed=false;
 const same=(record,next)=>record.owner===next.owner&&record.generation===next.generation;
 const active=record=>!closed&&!record.retired&&record===current&&same(record,identity());
 const part=name=>current?.parts.get(name)?.value??null;
 function keep(record,name,value,dispose=disposeOf){
  if(record.retired){release(dispose,value);throw accountChanged();}
  record.parts.set(name,{value,dispose});return value;
 }
 // 버린 기록이면 늦게 온 것을 그 자리에서 버리고 false.
 function adopt(record,key,value){
  if(!active(record)){release(disposeOf,value);return false;}
  record[key]=value;return true;
 }
 function disposeView(record){
  for(const [name,{value,dispose}] of [...record.parts].reverse()){release(dispose,value);record.parts.delete(name);}
 }
 function retire(record){
  if(record.retired)return;
  record.retired=true;record.mounted=false;
  disposeView(record);
  if(record.host)release(disposeOf,record.host);
  if(record.progress)release(value=>value.stop?.(),record.progress);
  if(record.port)release(disposeOf,record.port);
  record.host=record.progress=record.port=null;
 }
 async function build(record){
  const {owner,guard}=record;
  let fallback=false;
  if(owner!=='guest'){
   let port=null;
   try{port=await openPort({owner,guard,onStatus:status=>{if(active(record))onStatus(status);}});}
   catch{if(!active(record))return;fallback=true;}
   if(port&&!adopt(record,'port',port))return;
  }
  guard();
  record.progress=createProgress({owner,port:record.port,guard,fallback});
  let host=prepareHost({owner,guard});
  if(pending(host))host=await host;
  if(host&&!adopt(record,'host',host))return;
  guard();
  const answers=readAnswers({owner});
  if(pending(answers))answers.then(value=>{if(value&&active(record)){record.answers={owner,...value};onAnswers();}},()=>{});
  mountView({owner,progress:record.progress,keep:(name,value,dispose)=>keep(record,name,value,dispose)});
  guard();
  record.mounted=true;onReady();
 }
 function start(next){
  const previous=current;epoch++;
  if(previous){
   if(previous.owner!==next.owner)release(value=>value?.forgetPending?.(),previous.parts.get('reminders')?.value);
   retire(previous);
  }
  const record={owner:next.owner,generation:next.generation,epoch,port:null,host:null,progress:null,answers:null,parts:new Map(),mounted:false,recoveryShown:false,retired:false};
  record.guard=()=>{if(!active(record))throw accountChanged();};
  current=record;
  onLoading({owner:record.owner});
  ready=build(record).catch(error=>{if(active(record))onError(error);});
  return ready;
 }
 const settled=()=>ready??Promise.resolve();
 // WorldClient가 바뀔 때: 주인·세대가 다르면 새 기록. 같으면 아무것도 하지 않는다.
 function sync(){if(closed)return false;const next=identity();if(current&&same(current,next))return false;start(next);return true;}
 // 아직 세운 적이 없을 때만 세우고, 지금 기록의 준비를 돌려준다.
 function ensure(){if(!current&&!closed)start(identity());return settled();}
 // 같은 주인·세대라도 새 기록으로 다시 세운다(계정 진도를 다시 읽기 · 기기 기록에서 계정으로 다시 잇기).
 function reload(){if(!closed)start(identity());return settled();}
 // 저장 충돌을 고른 뒤: 같은 기록의 통로는 그대로 두고 진도와 배우기 화면만 다시 세운다. 그 사이 기록이 바뀌었으면 false.
 function remount(token){
  const record=current;
  if(!record||!active(record)||record.epoch!==token||!record.port)return false;
  record.mounted=false;record.recoveryShown=false;
  disposeView(record);
  if(record.progress)release(value=>value.stop?.(),record.progress);
  record.progress=createProgress({owner:record.owner,port:record.port,guard:record.port.guard||record.guard,fallback:false});
  mountView({owner:record.owner,progress:record.progress,keep:(name,value,dispose)=>keep(record,name,value,dispose)});
  record.mounted=true;
  return true;
 }
 // 다시 연결·창으로 돌아옴: 보낼 줄을 보내고 rebuild()가 참이면 계정 진도를 다시 읽는다. 한 번에 하나만 돌고(겹친 부름은 같은 약속),
 // 보내는 사이 기록이 바뀌었으면 다시 세우지 않는다. 계정 통로 없이 기기 기록으로 이어 가던 기록은 보낼 줄 없이 다시 잇는다.
 function refresh({rebuild=()=>true}={}){
  if(refreshing)return refreshing;
  const record=current;
  if(!record||!record.mounted||!active(record))return Promise.resolve();
  const task=(async()=>{
   try{
    if(!record.port){if(rebuild())await reload();return;}
    await record.progress.flush();
    if(active(record)&&rebuild())await reload();
   }catch{/* 보낼 줄과 지금 화면은 그대로 둔다. */}
  })();
  refreshing=task;
  task.then(()=>{if(refreshing===task)refreshing=null;});
  return task;
 }
 // pagehide: 지금 기록을 버리고 닫는다. 그 뒤로는 sync·ensure·reload가 다시 세우지 않는다. 몇 번 불러도 한 번만 돈다.
 function close(){if(closed)return;closed=true;epoch++;const record=current;if(record)retire(record);current=null;}
 return Object.freeze({sync,ensure,reload,remount,refresh,close,
  get epoch(){return epoch;},get ready(){return ready;},get refreshing(){return refreshing;},get closed(){return closed;},
  get owner(){return current?.owner??null;},get mounted(){return !!current?.mounted;},
  get port(){return current?.port??null;},get progress(){return current?.progress??null;},get answers(){return current?.answers??null;},
  get ui(){return part('ui');},get education(){return part('education');},get trail(){return part('trail');},get reminders(){return part('reminders');},
  // 저장 충돌 확인 창을 이 기록에서 이미 띄웠는지(새 기록·remount마다 처음으로 돌아간다).
  get recoveryShown(){return !!current?.recoveryShown;},set recoveryShown(value){if(current)current.recoveryShown=!!value;},
 });
}

// 시트 하나에 딸린 자원: dispose는 몇 번 불러도 한 번만 돈다(다른 시트 열기·닫기·패널 close 이벤트·pagehide가 겹쳐 불러도 된다).
// extra는 그 시트가 알려 줄 것(예: hasDraft — 내지 않은 원고가 있는지).
export function sheetResource(dispose,extra={}){
 let done=false;
 return Object.freeze({...extra,dispose(){if(done)return;done=true;dispose();}});
}
