'use strict';
// 시작 창에서 앱 창으로 넘길 때, 시작 창이 하나뿐인 창이면 앱 창을 먼저 만들어야 한다.
// 시작 창을 먼저 없애면 「모든 창이 닫힘」이 app.quit()를 불러 앱이 켜지자마자 멈췄다. 확인이 시작 창이 보이기 전에 끝나는 실행
// (빠른 인터넷, 공개 CI의 Windows 검사기)이 이 길을 탄다(0.4.96 대역 빌드 검사에서 찾음).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
function handoffSource(){
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8').replace(/\r\n/g,'\n');
  const found=main.match(/function handoffToMain\(\{waitedForStart=false\}=\{\}\)\{[\s\S]*?\n\}\n/);
  assert.ok(found,'handoffToMain is no longer where this test reads it');
  return found[0];
}
function run({visible=false,kind='first',reduced=false,mainReady=false}={}){
  const open=new Set(['startup']),events=[];
  const closeWindow=name=>{open.delete(name);events.push('close '+name);if(open.size===0)events.push('all-closed');};
  const startupWindow={isVisible:()=>visible,bounds:()=>({x:0,y:0,width:1440,height:940,maximized:false}),whenShown:()=>new Promise(()=>{}),dispose:()=>closeWindow('startup')};
  const context={
    orbBoot:{kind,startedAt:Date.now()},startupWindow,window:mainReady?{isDestroyed:()=>false}:null,mainWindowReady:mainReady,startupHandoff:null,startupAllowed:false,ARRIVE_SCENE_MS:1800,
    prefersReducedMotion:()=>reduced,
    showPlatformMain:()=>{open.add('main');events.push('main');},
    setTimeout:(fn,ms)=>{events.push('timer '+ms);return 0;},Promise,Date,
  };
  vm.createContext(context);vm.runInContext(handoffSource(),context);
  context.handoffToMain();
  return {events,context};
}
test('a startup window that never became visible is closed only after the app window exists',()=>{
  for(const kind of ['first','back']){
    const {events,context}=run({kind});
    assert.deepEqual(events,['main','close startup'],kind);
    assert.equal(context.startupWindow,null,kind);
    assert.equal(context.startupAllowed,true,kind);
    // 시작 창을 보지 못했으니 앱 창 얼굴은 처음부터 드러난다(드러남 값을 넘기지 않는다, 0.4.96 공개 후보 Fable P2)
    assert.equal(context.orbBoot,null,kind);
  }
  // 움직임 줄이기에서는 도착 장면을 기다리지 않고 같은 길로 간다
  const reduced=run({kind:'arrive',reduced:true});
  assert.deepEqual(reduced.events,['main','close startup']);
  assert.ok(!reduced.events.includes('all-closed'));
});
test('the arrival scene waits for the startup window, then still opens the app window before closing it',()=>{
  const {events,context}=run({kind:'arrive'});
  // 시작 창이 보이기를 기다리는 동안(3초까지)은 아무 창도 없애지 않는다
  assert.deepEqual(events,['timer 3000']);
  context.handoffToMain({waitedForStart:true});
  assert.deepEqual(events,['timer 3000','main','close startup']);
});
test('a visible startup window stays until the app window takes over',()=>{
  const {events,context}=run({visible:true});
  assert.deepEqual(events,['main']);
  assert.equal(context.startupHandoff?.done,false);
  assert.ok(context.startupWindow,'the startup window is closed later by finishHandoff');
  assert.ok(context.orbBoot,'the app window face continues the reveal the person is watching');
});
test('an app window that is already loaded takes over without the reveal value',()=>{
  const {events,context}=run({visible:true,mainReady:true});
  assert.deepEqual(events,['main','timer 50']);
  assert.equal(context.orbBoot,null);
});
function mainSource(){return fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8').replace(/\r\n/g,'\n');}
function extract(pattern,name){const found=mainSource().match(pattern);assert.ok(found,name+' is no longer where this test reads it');return found[0];}
// 0.4.96 검수 D6: 사람이 최소화해 둔 시작 창은 보이는 창으로 세지 않는다(Electron은 최소화한 창도 isVisible()이 참). 앱 창도 최소화한 채 연다
test('a minimized startup window hands over without pulling the app window in front',()=>{
  for(const mainReady of [false,true]){
    const events=[];
    const startupWindow={isVisible:()=>true,browserWindow:()=>({isMinimized:()=>true}),bounds:()=>({x:0,y:0,width:1440,height:940,maximized:false}),whenShown:()=>new Promise(()=>{}),dispose:()=>events.push('close startup')};
    const context={orbBoot:{kind:'first',startedAt:Date.now()},startupWindow,arrivalShow:null,window:mainReady?{isDestroyed:()=>false,minimize:()=>events.push('minimize')}:null,mainWindowReady:mainReady,startupHandoff:null,startupAllowed:false,ARRIVE_SCENE_MS:1800,
      prefersReducedMotion:()=>false,showPlatformMain:()=>events.push('main:'+context.arrivalShow),deliverPendingAction:()=>events.push('deliver'),setTimeout:(fn,ms)=>{events.push('timer '+ms);return 0;},Promise,Date};
    vm.createContext(context);vm.runInContext(handoffSource(),context);context.handoffToMain();
    assert.equal(context.startupHandoff,null,'no visible overlap handoff');
    assert.deepEqual(events,mainReady?['minimize','deliver','close startup']:['main:minimized','close startup']);
  }
});
// 0.4.96 검수 C3: 다른 창 뒤로 넘길 때는 최대화로 창을 활성화하지 않는다
test('handing over behind other windows never maximizes the app window into the front',()=>{
  const source=extract(/function finishHandoff\(\)\{[\s\S]*?\n\}\n/,'finishHandoff');
  for(const behind of [true,false]){
    const events=[];
    const window={isDestroyed:()=>false,isMaximized:()=>false,maximize:()=>events.push('maximize'),show:()=>events.push('show'),focus:()=>events.push('focus'),showInactive:()=>events.push('inactive')};
    const context={startupHandoff:{bounds:{maximized:true},done:false,timer:null},window,arrivalShow:behind?'behind':null,showBehind:()=>events.push('behind'),startupWindow:null,orbBoot:null,clearTimeout(){},setTimeout(){}};
    vm.createContext(context);vm.runInContext(source,context);context.finishHandoff();
    assert.deepEqual(events,behind?['behind']:['maximize','show','focus']);
  }
});
// 0.4.96 검수 F2: 조용히 바꾸던 앱(쪽지에 숨음이나 최소화로 적음)의 넘김이 실패하면 창을 그 상태 그대로 되돌린다
test('a failed quiet handoff restores the app to the state written in the handoff note',async()=>{
  const source=extract(/app\.on\('will-quit',event=>\{[\s\S]*?\n\}\);\n/,'will-quit');
  const {EventEmitter}=require('node:events');
  for(const [was,hasWindow,expected,waitingForFirstWindow=false,trayActive=true] of [
    ['hidden',false,['create:hidden','end']],['hidden',false,['end'],true],
    ['hidden',false,['create:hidden','end'],true,false],['minimized',true,['end']],['minimized',false,['create:minimized','end'],true],
    ['front',true,['show','focus','end-when-shown']],['behind',false,['create:null','end-when-shown']],
  ]){
    const events=[];const app=new EventEmitter();
    const context={app,handoffVisibility:was,waitingForFirstWindow,arrivalShow:null,quittingRequested:true,curtain:null,startupGate:null,startupWindow:null,
      window:hasWindow?{isDestroyed:()=>false,show:()=>events.push('show'),focus:()=>events.push('focus')}:null,
      platformTray:{cancelQuit(){},isActive:()=>trayActive},platformUpdate:{needsInstallHandoff:()=>true,isBusy:()=>false,completeInstall:async()=>({ok:false})},
      createWindow:()=>events.push('create:'+context.arrivalShow),endHandoff:()=>events.push('end'),endHandoffWhenShown:()=>events.push('end-when-shown'),showStartupWindow:()=>events.push('startup'),Promise};
    vm.createContext(context);vm.runInContext(source,context);app.emit('will-quit',{preventDefault(){}});
    await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(events,expected,was);assert.equal(context.quittingRequested,false,was);
  }
});
// 0.4.96 검수 D5: 로그인 때의 숨은 시작은 첫 창에만 쓴다. 넘김 실패로 다시 만든 창이나 사람이 연 창은 숨기지 않는다
test('the login hidden start is used once and cleared when a person opens the window',()=>{
  const main=mainSource();
  assert.equal(main.split("process.argv.includes('--synk-autostart')").length-1,1,'only the one-shot flag reads the login argument');
  const ready=main.split('\n').find(line=>line.includes("window.once('ready-to-show',()=>{mainWindowReady=true;"));
  assert.ok(ready&&ready.includes('autostartHidden&&desktopPreferences')&&ready.includes('if(isPlatform)autostartHidden=false;'),'the first app window clears the login hidden start');
  const request=extract(/function requestPlatformWindow\(action\)\{[\s\S]*?\n\}\n/,'requestPlatformWindow');
  assert.ok(request.includes('autostartHidden=false'),'a window a person asks for is never hidden by the login start');
});
// 0.4.97 엔진 검수 GA1: 업데이트 뒤 「뒤」로 보이던(또는 앞에 보이던) 시작 창을 사람이 최소화했으면 앱 창도 최소화로 넘긴다
test('a startup window minimized by a person hands over minimized even when it arrived behind other windows',()=>{
  for(const arrived of ['behind',null]){
    const events=[];
    const startupWindow={isVisible:()=>true,browserWindow:()=>({isMinimized:()=>true}),bounds:()=>({x:0,y:0,width:1440,height:940,maximized:false}),whenShown:()=>new Promise(()=>{}),dispose:()=>events.push('close startup')};
    const context={orbBoot:{kind:'first',startedAt:Date.now()},startupWindow,arrivalShow:arrived,window:null,mainWindowReady:false,startupHandoff:null,startupAllowed:false,ARRIVE_SCENE_MS:1800,
      prefersReducedMotion:()=>false,showPlatformMain:()=>events.push('main:'+context.arrivalShow),setTimeout:(fn,ms)=>{events.push('timer '+ms);return 0;},Promise,Date};
    vm.createContext(context);vm.runInContext(handoffSource(),context);context.handoffToMain();
    assert.deepEqual(events,['main:minimized','close startup'],String(arrived));
  }
  // 0.4.97 엔진 다시 검수(-c GPT GA1): 앱 창이 이미 있으면 보이지 않는다. 준비됐으면 바로 최소화하고, 준비 전이면 도착 값을 최소화로 두어 ready-to-show가 최소화한 채 켠다
  for(const ready of [true,false]){
    const events=[];
    const startupWindow={isVisible:()=>true,browserWindow:()=>({isMinimized:()=>true}),bounds:()=>({x:0,y:0,width:1440,height:940,maximized:false}),whenShown:()=>new Promise(()=>{}),dispose:()=>events.push('close startup')};
    const context={orbBoot:{kind:'first',startedAt:Date.now()},startupWindow,arrivalShow:null,window:{isDestroyed:()=>false,minimize:()=>events.push('minimize')},mainWindowReady:ready,startupHandoff:null,startupAllowed:false,ARRIVE_SCENE_MS:1800,
      prefersReducedMotion:()=>false,showPlatformMain:()=>events.push('main'),deliverPendingAction:()=>events.push('deliver'),setTimeout:(fn,ms)=>{events.push('timer '+ms);return 0;},Promise,Date};
    vm.createContext(context);vm.runInContext(handoffSource(),context);context.handoffToMain();
    // 창은 보이지 않아도 단축키로 미뤄 둔 요청(명령 메뉴 등)은 전달한다(0.4.97 엔진 다시 검수 -e GPT GA1)
    assert.deepEqual(events,ready?['minimize','deliver','close startup']:['deliver','close startup'],'ready '+ready);
    assert.equal(context.arrivalShow,ready?null:'minimized','ready '+ready);
  }
});
// 0.4.97 엔진 검수 GA2: 최소화한 채 되돌려 켠 앱의 미룬 실패는 사람이 창을 열 때 보인다. 최소화한 창도 isVisible()이 참이라 앞에서 그냥 돌아가던 길이다
test('a failure kept back while the app was restored minimized is shown when a person opens the window',()=>{
  const kept=extract(/function showKeptFailure\(\)\{[\s\S]*?\n\}\n/,'showKeptFailure');
  const source=kept+extract(/function requestPlatformWindow\(action\)\{[\s\S]*?\n\}\n/,'requestPlatformWindow');
  // 마지막 둘은 0.4.97 엔진 다시 검수(GPT GA1): 최소화로 되돌려 켠 직후 창이 아직 준비되지 않았을 때 연 경우. 실패가 있으면 기다리지 않고 실패부터, 없으면 준비를 기다린다
  for(const [minimized,failure,expected,ready=true] of [[true,true,['begin:UPDATE_RECOVERED']],[false,true,['main']],[true,false,['main']],[false,true,['begin:UPDATE_RECOVERED'],false],[false,false,[],false]]){
    const events=[];
    const context={arrivalShow:'minimized',autostartHidden:false,pendingDesktopAction:null,startupAllowed:true,startupGate:null,quittingRequested:false,mainWindowReady:ready,trayMemory:null,
      window:{isDestroyed:()=>false,isVisible:()=>true,isMinimized:()=>minimized},unseenFailure:failure?{code:'UPDATE_RECOVERED',stage:'check'}:null,
      platformUpdate:{snapshot:()=>({state:'current'}),reopenCheck(){}},showStartupWindow:()=>events.push('startup'),showPlatformMain:()=>events.push('main'),
      beginPlatformStartup:(a,b,o)=>{events.push('begin:'+o.initialError.code);return Promise.resolve();},Boolean};
    vm.createContext(context);vm.runInContext(source,context);context.requestPlatformWindow();
    assert.deepEqual(events,expected,`minimized ${minimized}, failure ${failure}, ready ${ready}`);
    if(expected[0]?.startsWith('begin'))assert.equal(context.unseenFailure,null,'the failure is shown once');
  }
  // 작업 표시줄에서 되살릴 때와 준비된 창을 처음 보일 때도 같은 한 함수로 실패를 한 번 보인다(0.4.97 엔진 다시 검수 설계 정리)
  const lines=mainSource().split('\n');
  const restore=lines.find(line=>line.includes("window.on('restore',"));
  assert.ok(restore&&restore.includes('showKeptFailure()'),'restoring the minimized window shows the kept failure once');
  const ready=lines.find(line=>line.includes("window.once('ready-to-show',"));
  assert.ok(ready&&ready.includes("if(isPlatform&&showKeptFailure())return;if(isPlatform&&arrivalShow==='behind')"),'the first show of a ready window shows the kept failure before the window');
  assert.ok(kept.includes('startupGate?.isBlocking()')&&kept.includes("platformUpdate.snapshot().state==='disabled'")&&kept.includes('unseenFailure=null'),'the one function shows the failure once and only when the update works');
  for(const [state,blocking,quitting,expected] of [['current',false,false,true],['disabled',false,false,false],['current',true,false,false],['current',false,true,false]]){
    const events=[];
    const context={unseenFailure:{code:'UPDATE_RECOVERED'},quittingRequested:quitting,startupAllowed:true,startupGate:{isBlocking:()=>blocking},platformUpdate:{snapshot:()=>({state})},
      beginPlatformStartup:(a,b,o)=>{events.push(o.initialError.code);return Promise.resolve();}};
    vm.createContext(context);vm.runInContext(kept,context);
    assert.equal(context.showKeptFailure(),expected,`${state} ${blocking} ${quitting}`);
    assert.deepEqual(events,expected?['UPDATE_RECOVERED']:[]);
    assert.equal(context.unseenFailure===null,expected);
  }
});
// 0.4.97 엔진 다시 검수 -e GPT GA1: 단축키로 미뤄 둔 요청은 창을 보이는 일과 따로 한 번 전달한다. 창이 불러오는 중이면 다 불러온 뒤에 보낸다
test('a request kept back by a shortcut reaches the app screen once, whether or not the window is shown',()=>{
  const source=extract(/function deliverPendingAction\(\)\{[\s\S]*?\n\}\n/,'deliverPendingAction');
  const listeners=extract(/const contents=window\.webContents;\n  contents\.on\('did-finish-load',sendTeachingView\);[\s\S]*?(?=\n  if\(isPlatform\)\{placementControl)/,'platform load listeners');
  for(const initial of ['blank','loading','ready']){
    let url=initial==='blank'?'about:blank':'synk-desktop://platform/index.html',loading=initial==='loading';
    const sent=[];
    const webContents=Object.assign(new EventEmitter(),{isLoading:()=>loading,getURL:()=>url});
    const context={pendingDesktopAction:{type:'command-menu'},entry:'synk-desktop://platform/index.html',runtime:{clientId:'platform'},
      isPlatform:true,sendTeachingView(){},trustedEntry:(page,entry)=>page===entry,window:{isDestroyed:()=>false,isVisible:()=>false,webContents},
      sendDesktop:(channel,value)=>sent.push([channel,value.type])};
    vm.createContext(context);vm.runInContext(source+listeners,context);
    context.deliverPendingAction();
    if(initial!=='ready'){
      assert.deepEqual(sent,[]);
      url=context.entry;loading=false;webContents.emit('did-stop-loading');
    }
    webContents.emit('did-stop-loading');
    assert.deepEqual(sent,[['synk:desktop-action','command-menu']],initial);
    assert.equal(context.pendingDesktopAction,null);
  }
  assert.ok(extract(/function showPlatformMain\(\)\{[\s\S]*?\n\}\n/,'showPlatformMain').includes('deliverPendingAction();'));
});
// 엔진 다시 검수 -g GA2: 첫 화면이 실린 뒤 다 싣기 전에 화면 프로세스가 사라져도 did-stop-loading이 온다. 그때는 보내지 않고, 되살린 화면이 다 실린 뒤 보낸다
test('a kept request is not spent on a renderer that went away while loading, and reaches the recovered screen',()=>{
  const source=extract(/function deliverPendingAction\(\)\{[\s\S]*?\n\}\n/,'deliverPendingAction');
  const listeners=extract(/const contents=window\.webContents;\n  contents\.on\('did-finish-load',sendTeachingView\);[\s\S]*?(?=\n  if\(isPlatform\)\{placementControl)/,'platform load listeners');
  for(const reason of ['crashed','clean-exit']){
    let pid=0,crashed=reason==='crashed';const sent=[];
    const webContents=Object.assign(new EventEmitter(),{isLoading:()=>false,getURL:()=>'synk-desktop://platform/index.html',isCrashed:()=>crashed,getOSProcessId:()=>pid});
    const context={pendingDesktopAction:{type:'command-menu'},entry:'synk-desktop://platform/index.html',runtime:{clientId:'platform'},
      isPlatform:true,sendTeachingView(){},trustedEntry:(page,entry)=>page===entry,window:{isDestroyed:()=>false,isVisible:()=>false,webContents},
      sendDesktop:(channel,value)=>sent.push([channel,value.type])};
    vm.createContext(context);vm.runInContext(source+listeners,context);
    webContents.emit('did-stop-loading');
    assert.deepEqual(sent,[],reason);assert.notEqual(context.pendingDesktopAction,null);
    pid=4242;crashed=false;webContents.emit('did-stop-loading');
    assert.deepEqual(sent,[['synk:desktop-action','command-menu']],reason);assert.equal(context.pendingDesktopAction,null);
  }
});


test('only an accessible hidden platform cold start initializes the tray without a window',()=>{
  const source=extract(/function initializeMain\(\)\{[\s\S]*?\n\}\n/,'initializeMain');
  for(const [startupAllowed,appLocationReady] of [[false,true],[true,false],[false,false]]){
    const context=vm.createContext({mainInitialized:false,startupAllowed,appLocationReady});
    vm.runInContext(source,context);context.initializeMain();
    assert.equal(context.mainInitialized,false,'startup waits for both gates');
  }
  for(const [arrival,autostart,startHidden,closeToTray,tray,expected] of [
    [null,true,true,true,true,'background'],['hidden',false,false,true,true,'background'],
    ['minimized',true,true,true,true,'window'],['behind',false,false,true,true,'window'],
    [null,false,true,true,true,'window'],[null,true,false,true,true,'window'],
    [null,true,true,true,false,'window'],['hidden',false,true,false,true,'window'],
  ]){
    const calls=[];
    const app=Object.assign(new EventEmitter(),{getPath:()=>'/profile',getAppPath:()=>'/app'});
    const memory={schedule(){},cancel(){}};
    let services,options;
    const context={mainInitialized:false,startupAllowed:true,appLocationReady:true,waitingForFirstWindow:false,trayMemory:null,
      runtime:{clientId:'platform'},app,current:{appId:'platform',productName:'SYNK'},
      process:{platform:'win32',arch:'x64'},path,smoke:false,authConfig:null,windowPlacement:{},packaged:true,
      quittingRequested:false,platformUpdate:{snapshot:()=>({state:'current'})},
      screen:{},safeStorage:{},globalShortcut:{},Tray:{},Menu:{},accountStatus:()=>null,createWindow:()=>calls.push('window'),
      initializeAccountServices:()=>calls.push('background'),createDesktopPreferences:()=>({initialize(){calls.push('settings');},snapshot:()=>({preferences:{startHidden,closeToTray}})}),
      createDraftRecovery:()=>({}),createDraftRecoveryRequests:()=>({}),
      createTrayMemoryReclaimer(settings){services=settings;return memory;},
      createPlatformTray(settings){options=settings;return {isActive:()=>tray};},
      autostartHidden:autostart,arrivalShow:arrival,sendDesktop(){},requestPlatformWindow(){},
      trayAppsTick:null,ticks:[],setInterval(fn,ms){const timer={fn,ms,unref(){}};context.ticks.push(timer);return timer;},syncTrayApps(){},launchFromTray(id){calls.push('launch '+id);}};
    vm.createContext(context);vm.runInContext(source,context);
    context.initializeMain();context.initializeMain();
    assert.equal(options.onCloseToTray,memory.schedule);
    // 트레이의 앱 줄은 본체가 실행한다. 창을 열지 않고, 트레이가 있으면 10분마다 설치를 다시 본다(PC 0.5.0 설계 1.3)
    assert.equal(typeof options.onLaunchApp,'function');assert.equal(options.onAction,undefined);
    assert.deepEqual(context.ticks.map(timer=>timer.ms),tray?[600000]:[]);
    assert.deepEqual(app.listeners('before-quit'),[memory.cancel]);
    assert.equal(services.busy(),!tray);
    for(const state of ['downloading','opening']){
      context.platformUpdate.snapshot=()=>({state});
      assert.equal(services.busy(),true);
    }
    assert.deepEqual(calls,['settings',expected],JSON.stringify([arrival,autostart,startHidden,closeToTray,tray]));
    assert.equal(context.waitingForFirstWindow,expected==='background');
    if(expected==='background'){assert.equal(context.arrivalShow,null);assert.equal(context.autostartHidden,false);}
  }
});
