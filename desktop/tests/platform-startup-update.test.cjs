'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createStartupUpdateGate}=require('../src/platform-startup-update.cjs');
const {assertStartupSender,STARTUP_ENTRY,createStartupUpdateWindow}=require('../src/platform-startup-window.cjs');
const {launchWindowsUpdate}=require('../src/platform-update-handoff.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('installing startup window blocks manual close but normal application quit explicitly unlocks it',()=>{
  let nativeWindow,closes=0,state='installing';const app=new EventEmitter(),handlers=new Map();
  class TestWindow extends EventEmitter {
    constructor(){super();nativeWindow=this;this.closable=true;this.destroyed=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{setWindowOpenHandler(){},getURL:()=>STARTUP_ENTRY,send(){}});}
    isDestroyed(){return this.destroyed;}isMinimized(){return false;}show(){}focus(){}setClosable(value){this.closable=value;}loadURL(){return Promise.resolve();}destroy(){this.destroyed=true;}
    close(){if(this.closable)this.emit('close');}
  }
  const isolated={setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onBeforeRequest(){}},protocol:{handle(){},unhandle(){}},on(){}};
  const startupWindow=createStartupUpdateWindow({BrowserWindow:TestWindow,session:{fromPartition:()=>isolated},ipcMain:{handle:(name,handler)=>handlers.set(name,handler),removeHandler:name=>handlers.delete(name)},appRoot:path.resolve(__dirname,'..'),gate:{isBlocking:()=>true,snapshot:()=>({state})},onClose:()=>closes++});
  assert.doesNotThrow(()=>startupWindow.prepareForQuit());startupWindow.show();startupWindow.publish({state});nativeWindow.close();assert.equal(closes,0);assert.equal(nativeWindow.closable,false);
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8'),line=main.split('\n').find(value=>value.startsWith("app.on('before-quit'"));
  const context={app,startupWindow,handoffCover:null,quittingRequested:false};vm.createContext(context);vm.runInContext(line,context);app.emit('before-quit');assert.equal(context.quittingRequested,true);assert.equal(nativeWindow.closable,true);startupWindow.publish({state});assert.equal(nativeWindow.closable,true,'late installing event cannot relock normal quit');startupWindow.cancelQuit();assert.equal(nativeWindow.closable,false,'cancelled quit restores manual close protection');app.emit('before-quit');nativeWindow.close();assert.equal(closes,1);
  startupWindow.publish({state:'checking'});assert.equal(nativeWindow.closable,true);startupWindow.dispose();assert.doesNotThrow(()=>startupWindow.prepareForQuit());assert.equal(handlers.size,0);
});
function fixture({platform='win32',check={ok:true,state:'available'},download={ok:true,state:'ready'},install={ok:true,state:'opening'},recoveryCode=null,hidden=false,initialError=null,earlyOpenMs=0,setTimer,clearTimer,keepDeferred=false}={}){
  let value={currentVersion:'0.4.4',latestVersion:'0.4.5',progress:0,state:'idle'},proceeds=0,cancels=0;const calls=[],changes=[];
  const updater={snapshot:()=>value,checkForUpdate:async()=>{calls.push('check');const next=typeof check==='function'?await check():check;value={...value,...next};return value;},downloadUpdate:async()=>{calls.push('download');value={...value,...download};return value;},installUpdate:async options=>{calls.push(['install',options]);value={...value,...install};return value;},start:options=>calls.push(['periodic',options]),cancelPending:()=>cancels++};
  const silent=[];const gate=createStartupUpdateGate({updater,platform,recoveryCode,hidden,initialError,keepDeferred,earlyOpenMs,...(setTimer?{setTimer,clearTimer}:{}),onSilentFailure:value=>silent.push(value),onChange:state=>changes.push(state),proceed:()=>proceeds++});
  return {gate,updater,calls,changes,silent,get proceeds(){return proceeds;},get cancels(){return cancels;},setState:next=>{value={...value,...next};gate.observe(value);}};
}
test('new Windows version checks, downloads and requests automatic guarded install before main initialization',async()=>{
  const f=fixture();await f.gate.start();assert.deepEqual(f.calls,['check','download',['install',{automatic:true}]]);assert.equal(f.proceeds,0);assert.equal(f.gate.snapshot().state,'installing');assert.equal(f.gate.snapshot().canOpenCurrent,false);assert.equal(f.gate.isBlocking(),true);
  assert.equal(f.gate.openCurrent().code,'UPDATE_BUSY');await f.gate.start();assert.equal(f.calls.length,3);
});
test('current version releases main exactly once and schedules six-hour checks without a duplicate startup request',async()=>{
  const f=fixture({check:{ok:true,state:'current'}});await f.gate.start();await f.gate.start();f.gate.openCurrent();assert.equal(f.proceeds,1);assert.deepEqual(f.calls,['check',['periodic',{check:false}]]);assert.equal(f.gate.isBlocking(),false);
});
test('disabled development updater releases the gate without attempting a download',async()=>{
  const f=fixture({check:{ok:false,state:'disabled'}});await f.gate.start();assert.equal(f.proceeds,1);assert.equal(f.calls.some(value=>value==='download'),false);
});
test('internet failure while checking opens the current version without a failure scene and remembers it for the settings line',async()=>{
  // 1-가 구현 설계 5절: 확인 단계의 UPDATE_NETWORK_FAILED와 UPDATE_TIMEOUT만 글 없이 지금 판을 연다
  for(const code of ['UPDATE_NETWORK_FAILED','UPDATE_TIMEOUT']){
    const f=fixture({check:{ok:false,state:'error',code}});await f.gate.start();await settle();
    assert.equal(f.proceeds,1);assert.deepEqual(f.calls,['check',['periodic',{check:false}]]);assert.equal(f.gate.isBlocking(),false);
    assert.equal(f.changes.some(c=>c.state==='error'),false,'no failure scene');assert.deepEqual(f.silent.map(v=>[v.code,v.silent]),[[code,true]]);
  }
  // 그 밖의 확인 실패(서명, 피드 주소)는 실패 장면을 보인다
  for(const code of ['UPDATE_SIGNATURE_INVALID','UPDATE_HTTP_FAILED']){
    const f=fixture({check:{ok:false,state:'error',code}});await f.gate.start();await settle();
    assert.equal(f.proceeds,0);assert.equal(f.gate.snapshot().state,'error');assert.equal(f.gate.snapshot().stage,'check');assert.equal(f.gate.snapshot().canOpenCurrent,true);
  }
  // 받다가 인터넷이 끊기면 실패 장면을 보인다(받기 단계)
  const g=fixture({download:{ok:false,state:'error',code:'UPDATE_NETWORK_FAILED'}});await g.gate.start();await settle();
  assert.equal(g.proceeds,0);assert.equal(g.gate.snapshot().state,'error');assert.equal(g.gate.snapshot().stage,'download');
});
test('a slow check opens the current version first and leaves a later new version to the background path',async()=>{
  let release,fire=null;const background=[];
  const f=fixture({check:()=>new Promise(resolve=>{release=resolve;}),earlyOpenMs:4000,setTimer:(fn)=>{fire=fn;return {unref(){}};},clearTimer:()=>{}});
  f.updater.checkInBackground=()=>{background.push('background');return Promise.resolve();};
  const pending=f.gate.start();await settle();assert.equal(f.proceeds,0);assert.ok(fire);
  fire();await pending;assert.equal(f.proceeds,1,'opened before the check answered');assert.equal(f.gate.isBlocking(),false);
  release({ok:true,state:'available'});await settle();await settle();assert.deepEqual(background,['background']);
  assert.equal(f.calls.some(c=>c==='download'),false,'the gate itself never downloads after opening');
});
test('hidden login start never shows a failure scene: it opens hidden and keeps the failure for the next opening',async()=>{
  const f=fixture({hidden:true,download:{ok:false,state:'error',code:'UPDATE_STORAGE_FAILED'}});await f.gate.start();await settle();
  assert.equal(f.proceeds,1);assert.equal(f.changes.some(c=>c.state==='error'),false);
  assert.deepEqual(f.gate.unseenFailure(),{code:'UPDATE_STORAGE_FAILED',stage:'download',releaseId:null});assert.equal(f.silent[0].code,'UPDATE_STORAGE_FAILED');
  // 확인 중에 사람이 창을 부르면 그 뒤로는 보이는 길이다
  const g=fixture({hidden:true,download:{ok:false,state:'error',code:'UPDATE_STORAGE_FAILED'}});g.gate.reveal();await g.gate.start();await settle();
  assert.equal(g.proceeds,0);assert.equal(g.gate.snapshot().state,'error');
});
test('a reopening with an unseen failure shows that scene first and keeps the deferred release',async()=>{
  const seen=[];const f=fixture({initialError:{code:'UPDATE_RECOVERED',stage:'handoff'},keepDeferred:true});
  f.updater.setStartupActive=(value,options)=>seen.push([value,options?.keepDeferred===true]);
  // 시험의 업데이터를 바꾼 뒤 관문을 새로 만든다
  const gate=require('../src/platform-startup-update.cjs').createStartupUpdateGate({updater:f.updater,platform:'win32',initialError:{code:'UPDATE_RECOVERED',stage:'handoff'},keepDeferred:true,earlyOpenMs:0});
  assert.deepEqual(seen[0],[true,true]);await gate.start();assert.equal(gate.snapshot().state,'error');assert.equal(gate.snapshot().code,'UPDATE_RECOVERED');assert.deepEqual(f.calls,[]);
});
test('known newer version download failure is not retried automatically; duplicate explicit retries cannot start another operation',async()=>{
  let fail=true,release;const f=fixture({check:async()=>{if(!fail)await new Promise(resolve=>{release=resolve;});return {ok:true,state:'available'};},download:{ok:false,state:'error',code:'UPDATE_INTEGRITY_FAILED'}});
  await f.gate.start();assert.deepEqual(f.calls,['check','download']);assert.equal(f.gate.snapshot().state,'error');fail=false;const first=f.gate.retry(),second=f.gate.retry();await settle();assert.equal(f.calls.filter(v=>v==='check').length,2);assert.equal((await second).code,'UPDATE_BUSY');release();await first;assert.equal(f.proceeds,0);
});
test('Mac automatically downloads then waits for explicit disk-image opening or current-version choice',async()=>{
  const f=fixture({platform:'darwin',install:{ok:true,state:'ready',code:'UPDATE_MANUAL_INSTALL'}});await f.gate.start();assert.deepEqual(f.calls,['check','download']);assert.equal(f.gate.snapshot().state,'ready');assert.equal(f.gate.snapshot().canInstall,true);assert.equal(f.proceeds,0);
  await f.gate.install();assert.deepEqual(f.calls[2],['install',undefined]);assert.equal(f.gate.snapshot().code,'UPDATE_MANUAL_INSTALL');assert.equal(f.gate.snapshot().canOpenCurrent,true);f.gate.openCurrent();assert.equal(f.proceeds,1);
});
test('failed native handoff exposes recovery actions and never opens main automatically',async()=>{
  const f=fixture();await f.gate.start();f.setState({state:'error',code:'UPDATE_HANDOFF_FAILED'});assert.equal(f.gate.snapshot().canRetry,true);assert.equal(f.gate.snapshot().canOpenCurrent,true);assert.equal(f.proceeds,0);
});
test('keeping an existing draft cancels installation and restores the existing main only once',async()=>{
  const f=fixture();await f.gate.start();f.setState({state:'ready',code:'UPDATE_EXIT_CANCELLED'});f.gate.cancelInstall();f.gate.cancelInstall();assert.equal(f.proceeds,1);assert.equal(f.gate.isBlocking(),false);assert.equal(f.updater.snapshot().state,'ready');
});
test('keeping a draft when exiting a checking gate cancels the pending check without a delayed automatic install',async()=>{
  let release;const f=fixture({check:()=>new Promise(resolve=>{release=resolve;})});const pending=f.gate.start();await settle();f.gate.cancelInstall();release({ok:true,state:'available'});await pending;assert.equal(f.cancels,1);assert.equal(f.proceeds,1);assert.equal(f.calls.includes('download'),false);
});
test('authenticated rollback recovery shows failure before any network/download; retry is explicit',async()=>{
  const f=fixture({recoveryCode:'UPDATE_RECOVERED'});await f.gate.start();assert.deepEqual(f.calls,[]);assert.equal(f.gate.snapshot().code,'UPDATE_RECOVERED');assert.equal(f.gate.snapshot().canOpenCurrent,true);await f.gate.retry();assert.equal(f.gate.snapshot().state,'installing');
});
test('closed/disposed gate never proceeds or starts an install after a pending network reply',async()=>{
  let release;const f=fixture({check:()=>new Promise(resolve=>{release=resolve;})});const pending=f.gate.start();await settle();f.gate.dispose();release({ok:true,state:'current'});await pending;assert.equal(f.proceeds,0);
});
test('startup IPC accepts only the exact trusted top-level startup window, excluding main, remote and subframes',()=>{
  const contents={mainFrame:{url:STARTUP_ENTRY}},window={isDestroyed:()=>false,webContents:contents};const good={sender:contents,senderFrame:contents.mainFrame};assert.doesNotThrow(()=>assertStartupSender(good,window));
  for(const event of [{...good,sender:{}},{...good,senderFrame:{url:STARTUP_ENTRY}},{...good,senderFrame:{url:'synk-desktop://platform/index.html'}}])assert.throws(()=>assertStartupSender(event,window),/UNTRUSTED_SENDER/);
  contents.mainFrame.url=STARTUP_ENTRY+'?redirect=1';assert.throws(()=>assertStartupSender(good,window));
});
function spawnFixture(){const child=new EventEmitter();child.stdout=new EventEmitter();child.stdout.destroy=()=>{child.destroyed=true;};child.unref=()=>{child.unreffed=true;};let args,options;return {child,spawn:(file,a,o)=>{args=a;options=o;return child;},get args(){return args;},get options(){return options;}};}
test('automatic Windows handoff waits for nonce-matched READY and closes stdout before permitting parent exit',async()=>{
  const f=spawnFixture(),nonce='a'.repeat(64);let complete=false;const promise=launchWindowsUpdate({spawn:f.spawn,file:'synthetic.exe',pid:10,automatic:true,nonce}).then(()=>{complete=true;});f.child.emit('spawn');await settle();assert.equal(complete,false);f.child.stdout.emit('data',Buffer.from('SYNK_UPDATE_READY '+nonce.slice(0,12)));await settle();assert.equal(complete,false);f.child.stdout.emit('data',Buffer.from(nonce.slice(12)+'\r\n'));await promise;assert.equal(f.child.destroyed,true);assert.equal(f.child.unreffed,true);assert.deepEqual(f.args,['--auto-update','--wait-pid=10','--handoff-token='+nonce]);assert.deepEqual(f.options.stdio,['ignore','pipe','ignore']);
});
test('wrong nonce, extra output, child failure and timeout cannot authorize quitting',async()=>{
  const nonce='a'.repeat(64);
  for(const action of [f=>f.child.stdout.emit('data',Buffer.from('SYNK_UPDATE_READY '+'b'.repeat(64)+'\n')),f=>f.child.stdout.emit('data',Buffer.from('x'.repeat(257))),f=>f.child.emit('exit',1),f=>f.child.emit('error',Error('synthetic'))]){
    const f=spawnFixture(),pending=launchWindowsUpdate({spawn:f.spawn,file:'synthetic.exe',pid:10,automatic:true,nonce});action(f);await assert.rejects(pending);assert.equal(f.child.destroyed,true);
  }
  const f=spawnFixture(),hold=setTimeout(()=>{},100);try{await assert.rejects(launchWindowsUpdate({spawn:f.spawn,file:'synthetic.exe',pid:10,automatic:true,nonce,timeoutMs:5}),{updateCode:'UPDATE_HANDOFF_TIMEOUT'});}finally{clearTimeout(hold);}
});
test('manual handoff preserves ordinary Signal installer behavior and requires no automatic nonce',async()=>{
  const f=spawnFixture(),pending=launchWindowsUpdate({spawn:f.spawn,file:'synthetic.exe',pid:10});f.child.emit('spawn');await pending;assert.deepEqual(f.args,['--wait-pid=10']);assert.equal(f.options.stdio,'ignore');
});
test('all platform reveal entry points share the pre-show gate and createWindow cannot initialize auth around it',()=>{
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
  for(const event of ['second-instance','activate'])assert.match(main,new RegExp("app.on\\('"+event+"',[^\\n]*requestPlatformWindow\\(\\)"));
  assert.match(main,/function createWindow\(\)\{\s*if\(!startupAllowed\)\{showStartupWindow\(\);return;\}/);
  assert.match(main,/onShow:action=>requestPlatformWindow\(action\)/);assert.match(main,/onShow:\(\)=>requestPlatformWindow\(\)/);
  // 미룬 실패를 보이는 한 함수(showKeptFailure)도 함께 읽는다(0.4.97 엔진 다시 검수 설계 정리)
  const body=main.match(/function showKeptFailure\(\)\{([\s\S]*?)\n\}/)[0]+'\n'+main.match(/function requestPlatformWindow\(action\)\{([\s\S]*?)\n\}/)[0];const calls=[];
  const context={window:{isDestroyed:()=>false,isVisible:()=>false,isMinimized:()=>false},mainWindowReady:true,startupAllowed:true,startupGate:null,unseenFailure:null,pendingDesktopAction:null,showStartupWindow:()=>calls.push('gate-focus'),platformUpdate:{snapshot:()=>({state:'current'}),reopenCheck:()=>calls.push('reopen-check')},quittingRequested:false,beginPlatformStartup:(...args)=>calls.push(['begin',args[2]?.initialError?.code]),showPlatformMain:()=>calls.push('main')};
  let reclaimCancellations=0;
  context.trayMemory={cancel(){reclaimCancellations++;}};
  vm.createContext(context);vm.runInContext(body,context);
  // 다시 열 때는 시작 창 없이 앱 창을 바로 보이고, 미뤄 둔 판 목록을 비운 뒤 뒤에서 확인한다(1-가 구현 설계 2절)
  context.requestPlatformWindow();assert.deepEqual(calls,['main','reopen-check']);
  assert.equal(reclaimCancellations,1);
  context.window.isVisible=()=>true;context.requestPlatformWindow();assert.deepEqual(calls,['main','reopen-check','main']);
  context.mainWindowReady=false;context.requestPlatformWindow();assert.deepEqual(calls,['main','reopen-check','main']);
  context.startupAllowed=false;context.requestPlatformWindow();assert.deepEqual(calls.at(-1),'gate-focus');
  // 아직 보이지 않은 실패가 있으면 그 장면부터 보인다
  calls.length=0;context.startupAllowed=true;context.mainWindowReady=true;context.window.isVisible=()=>false;context.unseenFailure={code:'UPDATE_STORAGE_FAILED',stage:'download'};
  context.requestPlatformWindow();assert.deepEqual(calls,[['begin','UPDATE_STORAGE_FAILED']]);assert.equal(context.unseenFailure,null);
});
// 얼굴의 첫 장 알림이 ready-to-show보다 먼저 와서 넘기기가 창을 이미 보였으면, ready-to-show는 창을 다시 보이거나 앞으로 내지 않는다(0.4.96 카본 C4)
test('a ready-to-show that comes after the handoff already showed the window does not show it again',()=>{
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8'),line=main.split('\n').find(value=>value.trim().startsWith("window.once('ready-to-show'"));assert.ok(line);
  const calls=[];const window=new EventEmitter();window.show=()=>calls.push('show');window.showInactive=()=>calls.push('showInactive');window.minimize=()=>calls.push('minimize');window.isVisible=()=>true;
  const context={window,mainWindowReady:false,smoke:false,isPlatform:true,startupAllowed:true,startupHandoff:null,arrivalShow:null,process:{argv:[]},desktopPreferences:{snapshot:()=>({preferences:{}})},platformTray:{isActive:()=>true}};
  vm.createContext(context);vm.runInContext(line,context);window.emit('ready-to-show');
  assert.deepEqual(calls,[]);assert.equal(context.mainWindowReady,true);
});
test('late main ready-to-show marks readiness but cannot expose the launcher while a gate blocks it',()=>{
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8'),line=main.split('\n').find(value=>value.trim().startsWith("window.once('ready-to-show'"));assert.ok(line);
  let shown=0;const window=new EventEmitter();window.show=()=>shown++;
  const context={window,mainWindowReady:false,smoke:false,isPlatform:true,startupAllowed:false,process:{argv:[]},desktopPreferences:{snapshot:()=>({preferences:{}})},platformTray:{isActive:()=>true}};
  vm.createContext(context);vm.runInContext(line,context);window.emit('ready-to-show');assert.equal(shown,0);assert.equal(context.mainWindowReady,true);
});
test('an unseen failure from the hidden start clears once the background updater has moved past it',()=>{
  // 숨은 채 시작해 받기에서 실패한 뒤 뒤에서 다 받았거나 새 판이 없어졌으면, 창을 열 때 옛 실패 장면을 보이지 않는다(0.4.96 카본 D2)
  const {unseenFailureResolved}=require('../src/platform-startup-update.cjs');
  const cases=[
    ['check','checking',false],['check','current',true],['check','available',true],['check','downloading',true],['check','ready',true],['check','error',false],
    ['download','downloading',false],['download','available',false],['download','error',false],['download','ready',true],['download','current',true],
    ['handoff','ready',false],['handoff','opening',false],['handoff','current',true],
  ];
  for(const [stage,state,want] of cases)assert.equal(unseenFailureResolved({code:'UPDATE_FAILED',stage},{state}),want,stage+' '+state);
  assert.equal(unseenFailureResolved(null,{state:'current'}),false);
});
test('an internet failure the updater announces while checking does not flash the failure scene or leave an unseen failure',async()=>{
  // 업데이터는 확인 실패를 오류 상태로 먼저 알린다(관문의 observe가 먼저 받는다). 그 알림으로 실패 장면을 띄우거나, 숨은 채 시작한 길에서
  // 다음에 창을 열 때 보일 실패로 남기지 않는다. 확인 결과를 받은 쪽이 글 없이 지금 판을 연다(0.4.96 공개 후보 카본 D2)
  for(const hidden of [false,true])for(const code of ['UPDATE_NETWORK_FAILED','UPDATE_TIMEOUT']){
    let f;f=fixture({hidden,check:async()=>{f.setState({state:'error',code});return {ok:false,state:'error',code};}});
    await f.gate.start();await settle();
    const label=code+(hidden?' hidden':' visible');
    assert.equal(f.changes.some(c=>c.state==='error'),false,label+': no failure scene');
    assert.equal(f.proceeds,1,label);assert.equal(f.gate.unseenFailure(),null,label);
    assert.deepEqual(f.silent.map(v=>[v.code,v.silent]),[[code,true]],label);
  }
  // 그 밖의 확인 실패는 그대로 실패 장면이다
  let g2;g2=fixture({check:async()=>{g2.setState({state:'error',code:'UPDATE_SIGNATURE_INVALID'});return {ok:false,state:'error',code:'UPDATE_SIGNATURE_INVALID'};}});
  await g2.gate.start();await settle();assert.equal(g2.gate.snapshot().state,'error');assert.equal(g2.proceeds,0);
});
// 0.4.96 검수 F2: 조용한 업데이트가 실패해 되돌려 켠 앱(숨은 채 시작한 길)은 실패 장면을 지금 띄우지 않고 지금 판을 숨은 채 연다.
// 그 실패는 다음에 창을 열 때 보이고, 실패한 판은 전처럼 미뤄 둔다
test('a hidden start that begins with a recovered update failure opens the current version hidden and keeps the failure for later',async()=>{
  const deferred=[],started=[],silent=[],changes=[];let proceeds=0,checks=0;
  const updater={snapshot:()=>({state:'idle',releaseId:null,currentVersion:'0.4.96'}),setStartupActive(){},deferAutomaticRelease:id=>deferred.push(id),start:options=>started.push(options),checkForUpdate:async()=>{checks++;return {ok:true,state:'current'};}};
  const gate=createStartupUpdateGate({updater,platform:'win32',recoveryCode:'UPDATE_RECOVERED',recoveryReleaseId:'platform-preview-0.4.97',hidden:true,onSilentFailure:value=>silent.push(value),onChange:state=>changes.push(state),proceed:()=>proceeds++});
  await gate.start();
  assert.equal(proceeds,1,'the current version opens without waiting for a person');
  assert.equal(checks,0);
  assert.deepEqual(deferred,['platform-preview-0.4.97']);
  assert.deepEqual(silent,[{code:'UPDATE_RECOVERED',stage:'handoff',releaseId:'platform-preview-0.4.97'}]);
  assert.deepEqual(gate.unseenFailure(),silent[0]);
  assert.ok(!changes.some(state=>state.state==='error'),'no failure scene is published while hidden');
  assert.equal(gate.isBlocking(),false);
  // 보이는 길은 전처럼 실패 장면부터 보인다
  const shown=[];const visible=createStartupUpdateGate({updater,platform:'win32',recoveryCode:'UPDATE_RECOVERED',recoveryReleaseId:'platform-preview-0.4.97',onChange:state=>shown.push(state),proceed:()=>{throw Error('must wait');}});
  await visible.start();assert.equal(visible.snapshot().state,'error');assert.equal(visible.snapshot().code,'UPDATE_RECOVERED');assert.equal(visible.isBlocking(),true);
});
// 0.4.96 검수 C3: 다른 창 뒤로 보이는 시작 창은 최대화로 활성화되지 않는다. 처음 눌릴 때 최대화하고, 그동안 넘김 자리는 최대화로 알린다
test('a startup window shown behind other windows maximizes only when it is first focused',()=>{
  const made=[];
  class TestWindow extends EventEmitter {
    constructor(){super();made.push(this);this.calls=[];this.max=false;this.destroyed=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{setWindowOpenHandler(){},getURL:()=>STARTUP_ENTRY,send(){}});}
    isDestroyed(){return this.destroyed;}isMinimized(){return false;}isMaximized(){return this.max;}isVisible(){return true;}getNormalBounds(){return {x:10,y:20,width:1200,height:800};}getBounds(){return this.getNormalBounds();}
    maximize(){this.calls.push('maximize');this.max=true;}show(){this.calls.push('show');}showInactive(){this.calls.push('inactive');}focus(){this.calls.push('focus');}
    setClosable(){}loadURL(){return Promise.resolve();}destroy(){this.destroyed=true;}
  }
  const isolated={setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onBeforeRequest(){}},protocol:{handle(){},unhandle(){}},on(){}};
  const open=({inactive})=>{
    const startup=createStartupUpdateWindow({BrowserWindow:TestWindow,session:{fromPartition:()=>isolated},ipcMain:{handle(){},removeHandler(){}},appRoot:path.resolve(__dirname,'..'),gate:{isBlocking:()=>true,snapshot:()=>({state:'checking'})},placement:()=>({x:10,y:20,width:1200,height:800,minWidth:960,minHeight:680,maximized:true}),onClose(){},setTimer:()=>0,clearTimer(){}});
    startup.show({inactive});const window=made[made.length-1];window.emit('ready-to-show');return {startup,window};
  };
  const behind=open({inactive:true});
  assert.deepEqual(behind.window.calls,['inactive'],'maximize would activate the window and pull it in front');
  assert.equal(behind.startup.bounds().maximized,true,'the handoff keeps the maximized place for the app window');
  behind.window.emit('focus');assert.deepEqual(behind.window.calls,['inactive','maximize']);
  behind.window.emit('focus');assert.equal(behind.window.calls.filter(c=>c==='maximize').length,1);
  behind.startup.dispose();
  const front=open({inactive:false});
  assert.deepEqual(front.window.calls,['maximize','show','focus']);
  front.startup.dispose();
});
