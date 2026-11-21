'use strict';
// 트레이 메뉴의 앱 줄과 트레이 실행, 숨은 시작의 로그인 다시 잇기(PC 0.5.0 설계 1절). main.cjs의 그 함수들을 꺼내 대역 위에서 돌린다.
// 되돌린 시도(d41609473c)의 GPT P1 넷: 사라지는 실행 요청, 빈 목록 덮어쓰기, 오래된 권한, 첫 숨은 시작의 빈 기억이 다시 생기지 않는지 본다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function block(){
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8').replace(/\r\n/g,'\n');
  const found=main.match(/const TRAY_APP='messenger';[\s\S]*?\nfunction scheduleHiddenAuthRetry\(state\)\{[\s\S]*?\n\}\n/);
  assert.ok(found,'the tray apps block is no longer where this test reads it');
  return found[0];
}
const signedIn=(appIds=['messenger'],extra={})=>({status:'signed-in',signedIn:true,sessionGeneration:1,library:{status:'ready',appIds},...extra});
function harness({state=signedIn(),installed=true,windowOpen=false}={}){
  const calls={setApps:[],probes:[],launches:[],windows:0,actions:[],loads:[],timers:[]};
  const probes=[];let launchImpl=async(id,{confirm})=>confirm()?{ok:true}:{ok:false,code:'LAUNCH_CANCELLED'};
  const context={
    platformTray:{isActive:()=>true,setApps:ids=>{calls.setApps.push([...ids]);return {ok:true};}},
    quittingRequested:false,window:windowOpen?{isDestroyed:()=>false}:null,runtime:{clientId:'platform'},
    accountStatus:()=>context.state,state,
    auth:{accountRequest:async(operation,params)=>{calls.loads.push(JSON.stringify([operation,params]));if(context.loadGate)await context.loadGate;return {ok:true};}},
    ensureInstallations:()=>({
      probe:id=>{calls.probes.push(id);if(context.manualProbe)return new Promise(resolve=>probes.push(resolve));return Promise.resolve({id,installed:context.installed});},
      launch:(id,options)=>{calls.launches.push(id);return launchImpl(id,options);},
    }),
    installed,manualProbe:false,
    requireSuite:operation=>operation(),
    requestPlatformWindow:action=>{calls.windows++;calls.actions.push(action??null);},
    setTimeout:(fn,ms)=>{const timer={fn,ms,unref(){}};calls.timers.push(timer);return timer;},
    clearTimeout:timer=>{const index=calls.timers.indexOf(timer);if(index>=0)calls.timers.splice(index,1);},
    Promise,Array,
  };
  vm.createContext(context);vm.runInContext(block(),context);
  return {context,calls,probes,setLaunch:fn=>{launchImpl=fn;}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('a hidden start shows SYNK Workspace from the account and the installation alone, with nothing remembered',async()=>{
  const {context,calls}=harness();
  await context.syncTrayApps();
  assert.deepEqual(calls.setApps,[['messenger']]);
  assert.deepEqual(calls.probes,['messenger']);
  for(const [name,state] of [['signed out',{status:'signed-out',signedIn:false,library:{status:'unavailable',appIds:[]}}],['no Workspace permission',signedIn(['pulse'])],['library still loading',signedIn([],{library:{status:'unavailable',appIds:[]}})],['masked suite sign-in',{status:'restoring',signedIn:false,library:{status:'unavailable',appIds:[]}}]]){
    const h=harness({state});await h.context.syncTrayApps();
    assert.deepEqual(h.calls.setApps,[[]],name);assert.deepEqual(h.calls.probes,[],name+' does not even probe');
  }
  const missing=harness({installed:false});await missing.context.syncTrayApps();
  assert.deepEqual(missing.calls.setApps,[[]]);
});

test('signing out empties the menu at once, and a late probe of the earlier state never puts the row back',async()=>{
  const {context,calls,probes}=harness();
  context.manualProbe=true;
  const first=context.syncTrayApps();
  context.state={status:'signed-out',signedIn:false,library:{status:'unavailable',appIds:[]}};
  await context.syncTrayApps();
  assert.deepEqual(calls.setApps,[[]],'no wait for the probe');
  probes[0]({id:'messenger',installed:true});await first;
  assert.deepEqual(calls.setApps,[[]],'the earlier probe is dropped');
});

test('a newer check wins over an older one that finishes later',async()=>{
  const {context,calls,probes}=harness();
  context.manualProbe=true;
  const older=context.syncTrayApps(),newer=context.syncTrayApps();
  probes[1]({id:'messenger',installed:false});await newer;
  probes[0]({id:'messenger',installed:true});await older;
  assert.deepEqual(calls.setApps,[[]]);
});

// 검정 구 4단계(구현 설계 3.5): 트레이의 Workspace 줄은 따로 설치한 앱을 실행하지 않는다. 플랫폼 창을 부르고 화면이 창 안의 Workspace를 연다
test('pressing SYNK Workspace opens the Platform window into the Workspace inside it, never the installed app',async()=>{
  const {context,calls}=harness();
  await context.launchFromTray('messenger');await flush();
  assert.deepEqual(calls.launches,[],'the installed Workspace app is not started');
  assert.equal(calls.windows,1);
  // vm 안에서 만든 값이라 꼴만 견준다
  assert.equal(JSON.stringify(calls.actions),JSON.stringify([{type:'open-space',space:'workspace'}]));
});

test('a press without the Workspace right only opens the Platform window',async()=>{
  const revoked=harness();revoked.context.state=signedIn(['pulse']);
  await revoked.context.launchFromTray('messenger');
  assert.deepEqual(revoked.calls.launches,[]);assert.equal(revoked.calls.windows,1);assert.deepEqual(revoked.calls.actions,[null]);
  const signedOut=harness({state:{status:'signed-out',signedIn:false,library:{status:'unavailable',appIds:[]}}});
  await signedOut.context.launchFromTray('messenger');
  assert.deepEqual(signedOut.calls.actions,[null]);
});

test('every press asks again, and nothing happens while quitting',async()=>{
  const {context,calls}=harness();
  await context.launchFromTray('messenger');await context.launchFromTray('messenger');
  assert.equal(calls.windows,2);assert.deepEqual(calls.launches,[]);
  context.quittingRequested=true;
  await context.launchFromTray('messenger');
  assert.equal(calls.windows,2);
  await context.syncTrayApps();
  assert.deepEqual(calls.setApps.at(-1),[],'a quitting app keeps no app row');
});

test('a hidden start whose sign-in restore failed for a while tries again, longer each time, until a window takes over',async()=>{
  const error={status:'error',signedIn:false,error:{code:'NETWORK',retryable:true},library:{status:'unavailable',appIds:[]}};
  const {context,calls}=harness({state:error});
  context.scheduleHiddenAuthRetry(error);context.scheduleHiddenAuthRetry(error);
  assert.deepEqual(calls.timers.map(timer=>timer.ms),[5000],'one retry at a time');
  calls.timers.shift().fn();await flush();await flush();
  assert.deepEqual(calls.loads,['["load",{}]'],'the same load the retry button sends');
  assert.deepEqual(calls.timers.map(timer=>timer.ms),[10000]);
  calls.timers.shift().fn();await flush();await flush();
  assert.deepEqual(calls.timers.map(timer=>timer.ms),[20000]);
  context.window={isDestroyed:()=>false};
  context.scheduleHiddenAuthRetry(error);
  assert.deepEqual(calls.timers,[],'the window takes over the retry');
  context.window=null;
  context.state=signedIn();context.scheduleHiddenAuthRetry(context.state);
  context.state=error;context.scheduleHiddenAuthRetry(error);
  assert.deepEqual(calls.timers.map(timer=>timer.ms),[5000],'a success starts the wait over');
  const final=harness({state:{status:'error',signedIn:false,error:{code:'AUTH_REQUIRED',retryable:false}}});
  final.context.scheduleHiddenAuthRetry(final.context.state);
  assert.deepEqual(final.calls.timers,[],'a failure that cannot be retried waits for a person');
});

test('the hidden retry never overlaps its own load, and a passing restore does not start the wait over',async()=>{
  // GPT 검수 GA1 · GA3: 읽기가 시작하며 내는 error 상태로 두 번째 읽기가 겹쳤고, 그 사이의 restoring이 대기 시간을 처음으로 돌렸다
  const error={status:'error',signedIn:false,error:{code:'NETWORK',retryable:true},library:{status:'unavailable',appIds:[]}};
  const restoring={status:'restoring',signedIn:false,library:{status:'unavailable',appIds:[]}};
  const {context,calls}=harness({state:error});
  let release;context.loadGate=new Promise(resolve=>{release=resolve;});
  context.scheduleHiddenAuthRetry(error);
  calls.timers.shift().fn();await flush();
  assert.deepEqual(calls.loads,['["load",{}]']);
  context.scheduleHiddenAuthRetry(restoring);context.scheduleHiddenAuthRetry(error);context.scheduleHiddenAuthRetry(error);
  assert.deepEqual(calls.timers,[],'no retry is booked while the load is still out');
  release();await flush();await flush();
  assert.equal(calls.loads.length,1,'one load per retry');
  assert.deepEqual(calls.timers.map(timer=>timer.ms),[10000],'one retry after the load ends, longer than the first');
  context.loadGate=null;
  calls.timers.shift().fn();context.scheduleHiddenAuthRetry(restoring);await flush();await flush();
  assert.deepEqual(calls.timers.map(timer=>timer.ms),[20000],'restoring on the way keeps the longer wait');
});
