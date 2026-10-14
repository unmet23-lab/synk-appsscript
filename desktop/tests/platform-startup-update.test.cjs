'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createStartupUpdateGate}=require('../src/platform-startup-update.cjs');
const {assertStartupSender,STARTUP_ENTRY}=require('../src/platform-startup-window.cjs');
const {launchWindowsUpdate}=require('../src/platform-update-handoff.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({platform='win32',check={ok:true,state:'available'},download={ok:true,state:'ready'},install={ok:true,state:'opening'},recoveryCode=null}={}){
  let value={currentVersion:'0.4.4',latestVersion:'0.4.5',progress:0,state:'idle'},proceeds=0,cancels=0;const calls=[],changes=[];
  const updater={snapshot:()=>value,checkForUpdate:async()=>{calls.push('check');const next=typeof check==='function'?await check():check;value={...value,...next};return value;},downloadUpdate:async()=>{calls.push('download');value={...value,...download};return value;},installUpdate:async options=>{calls.push(['install',options]);value={...value,...install};return value;},start:options=>calls.push(['periodic',options]),cancelPending:()=>cancels++};
  const gate=createStartupUpdateGate({updater,platform,recoveryCode,onChange:state=>changes.push(state),proceed:()=>proceeds++});
  return {gate,updater,calls,changes,get proceeds(){return proceeds;},get cancels(){return cancels;},setState:next=>{value={...value,...next};gate.observe(value);}};
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
test('offline and timeout wait for an explicit retry/current-version choice and never loop or initialize accounts',async()=>{
  for(const code of ['UPDATE_NETWORK_FAILED','UPDATE_TIMEOUT']){
    const f=fixture({check:{ok:false,state:'error',code}});await f.gate.start();await settle();assert.deepEqual(f.calls,['check']);assert.equal(f.proceeds,0);assert.equal(f.gate.snapshot().canRetry,true);assert.equal(f.gate.snapshot().canOpenCurrent,true);
    f.gate.openCurrent();assert.equal(f.proceeds,1);assert.deepEqual(f.calls,['check',['periodic',{check:false}]]);
  }
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
  assert.match(main,/function createWindow\(\)\{\s*if\(!startupAllowed\)\{startupWindow\?\.show\(\);return;\}/);
  assert.match(main,/onShow:action=>requestPlatformWindow\(action\)/);assert.match(main,/onShow:\(\)=>requestPlatformWindow\(\)/);
  const body=main.match(/function requestPlatformWindow\(action\)\{([\s\S]*?)\n\}/)[0];const calls=[];
  const context={window:{isDestroyed:()=>false,isVisible:()=>false},mainWindowReady:true,startupAllowed:true,startupGate:null,startupWindow:{show:()=>calls.push('gate-focus')},platformUpdate:{snapshot:()=>({state:'current'})},quittingRequested:false,beginPlatformStartup:()=>calls.push('begin'),showPlatformMain:()=>calls.push('main')};
  vm.createContext(context);vm.runInContext(body,context);context.requestPlatformWindow();assert.deepEqual(calls,['begin']);context.window.isVisible=()=>true;context.requestPlatformWindow();assert.deepEqual(calls,['begin','main']);context.mainWindowReady=false;context.requestPlatformWindow();assert.deepEqual(calls,['begin','main']);context.startupAllowed=false;context.requestPlatformWindow();assert.deepEqual(calls,['begin','main','gate-focus']);
});
test('late main ready-to-show marks readiness but cannot expose the launcher while a gate blocks it',()=>{
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8'),line=main.split('\n').find(value=>value.trim().startsWith("window.once('ready-to-show'"));assert.ok(line);
  let shown=0;const window=new EventEmitter();window.show=()=>shown++;
  const context={window,mainWindowReady:false,smoke:false,isPlatform:true,startupAllowed:false,process:{argv:[]},desktopPreferences:{snapshot:()=>({preferences:{}})},platformTray:{isActive:()=>true}};
  vm.createContext(context);vm.runInContext(line,context);window.emit('ready-to-show');assert.equal(shown,0);assert.equal(context.mainWindowReady,true);
});
