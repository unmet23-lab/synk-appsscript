'use strict';
// 시작 창에서 앱 창으로 넘길 때, 시작 창이 하나뿐인 창이면 앱 창을 먼저 만들어야 한다.
// 시작 창을 먼저 없애면 「모든 창이 닫힘」이 app.quit()를 불러 앱이 켜지자마자 멈췄다. 확인이 시작 창이 보이기 전에 끝나는 실행
// (빠른 인터넷, 공개 CI의 Windows 검사기)이 이 길을 탄다(0.4.96 대역 빌드 검사에서 찾음).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
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
      prefersReducedMotion:()=>false,showPlatformMain:()=>events.push('main:'+context.arrivalShow),setTimeout:(fn,ms)=>{events.push('timer '+ms);return 0;},Promise,Date};
    vm.createContext(context);vm.runInContext(handoffSource(),context);context.handoffToMain();
    assert.equal(context.startupHandoff,null,'no visible overlap handoff');
    assert.deepEqual(events,mainReady?['minimize','close startup']:['main:minimized','close startup']);
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
  for(const [was,hasWindow,expected] of [['hidden',false,['create:hidden','end']],['minimized',true,['end']],['front',true,['show','focus','end-when-shown']],['behind',false,['create:null','end-when-shown']]]){
    const events=[];const app=new EventEmitter();
    const context={app,handoffVisibility:was,arrivalShow:null,quittingRequested:true,curtain:null,startupGate:null,startupWindow:null,
      window:hasWindow?{isDestroyed:()=>false,show:()=>events.push('show'),focus:()=>events.push('focus')}:null,
      platformTray:{cancelQuit(){}},platformUpdate:{needsInstallHandoff:()=>true,isBusy:()=>false,completeInstall:async()=>({ok:false})},
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
