'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {createConnectionRecovery}=require('../src/connection-recovery.cjs');
const ENTRY='http://127.0.0.1:4280/synk-account/client.html?product=world',STATUS='synk-desktop://status/';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const failure=(code=-102)=>Object.assign(Error(code===-3?'ERR_ABORTED':'ERR_CONNECTION_REFUSED'),{errno:code,code:code===-3?'ERR_ABORTED':'ERR_CONNECTION_REFUSED'});
class Contents extends EventEmitter{
  constructor(){super();this.url='';this.loads=[];this.destroyed=false;this.loading=false;}
  // 주 프레임 이동이 시작되면 싣는 중이다. 실리거나 실패하거나 취소되면 did-stop-loading과 함께 끝난다
  emit(name,...args){if(name==='did-start-navigation'&&args[3]&&!args[2])this.loading=true;return super.emit(name,...args);}
  getURL(){return this.url;}
  isDestroyed(){return this.destroyed;}
  isLoadingMainFrame(){return this.loading;}
  stopLoading(){this.loading=false;this.emit('did-stop-loading');}
  cancel(url){this.emit('did-fail-load',{},-3,'ERR_ABORTED',url,true);this.stopLoading();}
  send(){}
  setWindowOpenHandler(){}
  loadURL(url){
    this.emit('did-start-navigation',{},url,false,true);
    let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
    this.loads.push({url,resolve,reject});return promise;
  }
  success(index){const item=this.loads[index];this.url=item.url;this.emit('did-navigate',{},item.url,200,'OK');this.stopLoading();item.resolve();}
  fail(index,error=failure()){const item=this.loads[index];this.emit('did-fail-load',{},error.errno,error.code,item.url,true);this.stopLoading();item.reject(error);}
  click(url){const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};this.emit('will-navigate',event,url);return event;}
}
async function mainFixture(runtime={clientId:'world',mode:'development',entry:ENTRY,auth:null},{dialog={}}={}){
  const app=new EventEmitter(),contents=new Contents();let window,headersHandler,protocolHandler;
  Object.assign(app,{isPackaged:true,enableSandbox(){},setName(){},setPath(){},getPath:name=>name==='home'?'C:\\Users\\synthetic':'/synthetic',getAppPath:()=>'/synthetic/app',getVersion:()=> '0.4.0',setAppUserModelId(){},requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve()});
  class Window extends EventEmitter{
    constructor(){super();this.webContents=contents;window=this;}
    isDestroyed(){return false;}
    isMinimized(){return false;}
    show(){}
    focus(){}
    loadURL(url){return contents.loadURL(url);}
  }
  const ownSession={setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onBeforeRequest(){},onHeadersReceived(handler){headersHandler=handler;}},removeAllListeners(){},on(){},protocol:{handle(_scheme,handler){protocolHandler=handler;}}};
  const noop=()=>({});
  const stubs={
    electron:{app,BrowserWindow:Window,ipcMain:{removeHandler(){},handle(){}},session:{fromPartition:()=>ownSession},protocol:{registerSchemesAsPrivileged(){}},Menu:{setApplicationMenu(){}},shell:{},dialog,safeStorage:{}},
    'node:fs':{readFileSync:()=>JSON.stringify(runtime)},
    'node:child_process':{spawn(){throw Error('No process allowed');}},
    './auth-config.cjs':{configuration:()=>null},'./auth-config-path.cjs':{resolveAuthConfigPath:()=>null},
    './auth-store.cjs':{createTokenStore:noop},'./auth-service.cjs':{createAuthService:()=>({initialize:async()=>{},status:noop}),publicError:noop},
    './client-lifecycle.cjs':{createClientLifecycle:()=>({getClients:async()=>[]})},
    './teacher-preview.cjs':{createTeacherPreview:()=>({available:()=>false})},
    './product-preview.cjs':{createProductPreviews:()=>({available:()=>[]})},
    './company-requests.cjs':{createCompanyRequests:noop},'./downloads.cjs':{createDownloadHandler:noop},
    './connection-content.cjs':require('../src/connection-content.cjs'),
  };
  const filename=path.join(__dirname,'../src/main.cjs');
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:id=>Object.hasOwn(stubs,id)?stubs[id]:id.startsWith('./')?require(path.join(__dirname,'../src',id)):require(id),__dirname:path.dirname(filename),process:{argv:[],platform:'win32',arch:'x64',env:{},resourcesPath:'/synthetic/resources'},console,Response,Buffer,setTimeout,clearTimeout},{filename});
  await settle();return {app,contents,content:request=>protocolHandler(request),get window(){return window;},headers(url){let result;headersHandler({url,resourceType:'mainFrame',responseHeaders:{}},value=>{result=value;});return result;}};
}
async function offline(f){f.contents.fail(0);await settle();assert.equal(f.contents.loads[1].url,STATUS);f.contents.success(1);await settle();}

test('main reconnects the disconnected existing window on a second launch',async()=>{
  const f=await mainFixture();await offline(f);f.app.emit('second-instance');await settle();
  assert.equal(f.contents.loads.length,3,'relaunch must retry the configured entry');assert.equal(f.contents.loads[2].url,ENTRY);f.contents.success(2);await settle();
  f.app.emit('second-instance');await settle();assert.equal(f.contents.loads.length,3,'a healthy window must not reload');
});
test('main handles the fixed offline retry link and returns to the guide after another failure',async()=>{
  const f=await mainFixture();await offline(f);const click=f.contents.click(ENTRY);await settle();
  assert.equal(click.defaultPrevented,true,'the fixed retry must use guarded main-frame loading');assert.equal(f.contents.loads[2]?.url,ENTRY);
  f.contents.fail(2);await settle();assert.equal(f.contents.loads[3].url,STATUS);f.contents.success(3);await settle();
});
test('main preserves the offline guide CSP instead of replacing it with the network document policy',async()=>{
  const f=await mainFixture();
  for(const url of [STATUS,STATUS+'assets/mark.svg']){const policy=f.headers(url).responseHeaders['Content-Security-Policy'][0];assert.match(policy,/script-src 'none'/);assert.match(policy,/connect-src 'none'/);}
  assert.match(f.headers(ENTRY).responseHeaders['Content-Security-Policy'][0],/connect-src 'self' https: wss:/);
  f.contents.success(0);await settle();
});

function fixture(){const contents=new Contents();return {contents,recovery:createConnectionRecovery({contents,entry:ENTRY})};}
test('subframe failures and delayed main-frame failure events cannot replace a successfully loaded page',async()=>{
  const {contents,recovery}=fixture(),loading=recovery.connect();await settle();contents.success(0);assert.equal(await loading,true);
  contents.emit('did-fail-load',{},-102,'ERR_CONNECTION_REFUSED',ENTRY,false);
  contents.emit('did-fail-load',{},-102,'ERR_CONNECTION_REFUSED',ENTRY,true);
  await settle();assert.deepEqual(contents.loads.map(row=>row.url),[ENTRY]);recovery.dispose();
});
test('ERR_ABORTED by numeric or named code never opens the offline guide',async()=>{
  for(const error of [failure(-3),Object.assign(Error('cancelled'),{code:'ERR_ABORTED'}),Object.assign(Error('cancelled'),{errno:-3})]){
    const {contents,recovery}=fixture(),loading=recovery.connect();await settle();contents.fail(0,error);
    assert.equal(await loading,false);assert.equal(contents.loads.length,1);recovery.dispose();
  }
});
test('an unavailable local guide stops after one attempt without recursive navigation',async()=>{
  const {contents,recovery}=fixture(),loading=recovery.connect();await settle();contents.fail(0);await settle();contents.fail(1);
  assert.equal(await loading,false);assert.deepEqual(contents.loads.map(row=>row.url),[ENTRY,STATUS]);recovery.dispose();
});
test('an older load rejection cannot cover a newer successful navigation',async()=>{
  const {contents,recovery}=fixture(),older=recovery.connect();await settle();
  contents.emit('did-start-navigation',{},'http://127.0.0.1:4280/learning-hub/',false,true);
  const newer=recovery.connect();await settle();contents.success(1);assert.equal(await newer,true);
  contents.fail(0);assert.equal(await older,false);assert.equal(contents.getURL(),ENTRY);assert.equal(contents.loads.length,2);recovery.dispose();
});
test('an older failure also leaves a newer pending attempt in control of its own result',async()=>{
  const {contents,recovery}=fixture(),older=recovery.connect();await settle();
  contents.emit('did-start-navigation',{},'http://127.0.0.1:4280/learning-hub/',false,true);
  const newer=recovery.connect();await settle();contents.fail(0);assert.equal(await older,false);assert.equal(contents.loads.length,2);
  contents.fail(1);await settle();assert.equal(contents.loads[2].url,STATUS);contents.success(2);assert.equal(await newer,false);recovery.dispose();
});
test('a committed main document is retained when its pending load promise rejects late',async()=>{
  const {contents,recovery}=fixture(),loading=recovery.connect();await settle();contents.url=ENTRY;contents.emit('did-navigate',{},ENTRY,200,'OK');contents.fail(0);
  assert.equal(await loading,false);assert.equal(contents.loads.length,1);assert.equal(contents.getURL(),ENTRY);recovery.dispose();
});
test('subframe and in-page navigation do not supersede the pending main-frame load',async()=>{
  const {contents,recovery}=fixture(),loading=recovery.connect();await settle();
  contents.emit('did-start-navigation',{},'https://frame.invalid/',false,false);
  contents.emit('did-start-navigation',{},ENTRY+'#fragment',true,true);
  contents.fail(0);await settle();assert.equal(contents.loads[1].url,STATUS);contents.success(1);assert.equal(await loading,false);recovery.dispose();
});
test('parallel retry clicks and relaunches share one fixed entry load',async()=>{
  const {contents,recovery}=fixture();contents.url=STATUS;
  const first=recovery.retryIfDisconnected(),second=recovery.retryIfDisconnected();assert.equal(first,second);
  assert.equal(contents.click(ENTRY).defaultPrevented,true);await settle();assert.deepEqual(contents.loads.map(row=>row.url),[ENTRY]);
  contents.success(0);assert.equal(await first,true);assert.equal(await recovery.retryIfDisconnected(),false);assert.equal(contents.loads.length,1);recovery.dispose();
});
test('only the exact main-frame retry link on the exact guide is intercepted',async()=>{
  const {contents,recovery}=fixture();contents.url=STATUS;
  for(const url of ['https://evil.invalid/',ENTRY+'&next=evil',ENTRY+'#fragment','file:///C:/bad',STATUS])assert.equal(contents.click(url).defaultPrevented,false);
  const childEvent={preventDefault(){throw Error('Subframe navigation must not become a retry');}};
  contents.emit('will-frame-navigate',childEvent,{url:ENTRY,isMainFrame:false});await settle();assert.equal(contents.loads.length,0);
  contents.url=STATUS+'?next=evil';assert.equal(await recovery.retryIfDisconnected(),false);assert.equal(contents.click(ENTRY).defaultPrevented,false);
  contents.url=ENTRY;assert.equal(contents.click(ENTRY).defaultPrevented,false);assert.equal(contents.loads.length,0);recovery.dispose();
});
test('main retains its navigation guard for arbitrary links from the guide',async()=>{
  const f=await mainFixture();await offline(f);
  const click=f.contents.click('https://evil.invalid/');assert.equal(click.defaultPrevented,true);await settle();assert.equal(f.contents.loads.length,2);
});
test('destroying the window invalidates pending work and removes recovery listeners',async()=>{
  const {contents,recovery}=fixture(),loading=recovery.connect();await settle();contents.destroyed=true;contents.emit('destroyed');contents.fail(0);
  assert.equal(await loading,false);assert.equal(await recovery.connect(),false);assert.equal(await recovery.retryIfDisconnected(),false);assert.equal(contents.loads.length,1);
  for(const event of ['did-start-navigation','did-navigate','will-navigate','render-process-gone','did-stop-loading','destroyed'])assert.equal(contents.listenerCount(event),0);recovery.dispose();
});

const CLOUD_ENTRY='https://workspace.synk.im/?tab=messenger';
test('main accepts explicit cloud Messenger and passes opt-in to its real fallback and fixed retry',async()=>{
  const f=await mainFixture({clientId:'messenger',mode:'development',entry:CLOUD_ENTRY,messengerCloudPreview:true,auth:null});
  assert.equal(f.contents.loads[0].url,CLOUD_ENTRY);await offline(f);
  const html=await (await f.content({url:STATUS,method:'GET'})).text();assert.ok(html.includes('href="'+CLOUD_ENTRY+'"'));assert.match(html,/인터넷 연결/);assert.doesNotMatch(html,/이 PC에서 앱 서비스/);
  const click=f.contents.click(CLOUD_ENTRY);assert.equal(click.defaultPrevented,true);await settle();assert.equal(f.contents.loads[2].url,CLOUD_ENTRY);f.contents.success(2);await settle();
});
test('main rejects cloud runtime without exact boolean, client, mode and fixed entry before creating a window',async()=>{
  const valid={clientId:'messenger',mode:'development',entry:CLOUD_ENTRY,messengerCloudPreview:true,auth:null};
  for(const change of [{messengerCloudPreview:undefined},{messengerCloudPreview:'true'},{messengerCloudPreview:1},{clientId:'world'},{clientId:'platform'},{mode:'release'},{entry:CLOUD_ENTRY+'&next=evil'},{entry:ENTRY}])await assert.rejects(()=>mainFixture({...valid,...change}),/Invalid desktop runtime configuration/);
});

/* 화면 프로세스가 사라진 창은 첫 화면을 다시 싣는다(11-19 트레이에 숨은 채 켜진 0.4.97 창이 검게 남음) */
// 지금 주 프레임의 화면 프로세스: pid가 ALIVE면 살아 있다. 0이면 화면 프로세스가 없다
const ALIVE=4242;
function goneFixture({quitting=false}={}){
  const contents=new Contents();contents.crashed=false;contents.isCrashed=function(){return this.crashed;};
  contents.pid=0;contents.getOSProcessId=function(){return this.pid;};
  let clock=0;const timers=[];
  const recovery=createConnectionRecovery({contents,entry:ENTRY,isQuitting:()=>quitting,now:()=>clock,setTimer:(fn,ms)=>{const t={fn,ms,done:false};timers.push(t);return t;},clearTimer:t=>{if(t)t.done=true;},isProcessAlive:pid=>pid===ALIVE});
  const run=()=>{for(const t of timers.splice(0))if(!t.done)t.fn();};
  const gone=(reason='crashed')=>{contents.crashed=true;contents.emit('render-process-gone',{},{reason,exitCode:1});};
  return {contents,recovery,run,gone,tick:ms=>{clock+=ms;},timers};
}
test('a main window whose renderer is gone loads the entry again after a short pause',async()=>{
  const f=goneFixture(),loading=f.recovery.connect();await settle();f.contents.success(0);await loading;
  f.gone('killed');assert.equal(f.contents.loads.length,1,'the reload waits for the pause');
  assert.equal(f.timers[0].ms,400);f.run();await settle();
  assert.deepEqual(f.contents.loads.map(row=>row.url),[ENTRY,ENTRY]);f.contents.crashed=false;f.contents.success(1);await settle();f.recovery.dispose();
});
test('renderer recovery stops after three losses in ten minutes and starts again after the window passes',async()=>{
  const f=goneFixture(),loading=f.recovery.connect();await settle();f.contents.success(0);await loading;
  for(let i=1;i<=3;i++){f.gone();f.run();await settle();f.contents.crashed=false;f.contents.success(i);await settle();f.tick(60000);}
  f.gone();f.run();await settle();assert.equal(f.contents.loads.length,4,'a fourth loss within ten minutes is left alone');
  f.tick(10*60000);f.gone();f.run();await settle();assert.equal(f.contents.loads.length,5);f.recovery.dispose();
});
test('renderer recovery does nothing while quitting, after dispose, or when a new renderer already took over',async()=>{
  const quitting=goneFixture({quitting:true});quitting.gone();quitting.run();await settle();assert.equal(quitting.contents.loads.length,0);quitting.recovery.dispose();
  const disposed=goneFixture();disposed.gone();disposed.recovery.dispose();disposed.run();await settle();assert.equal(disposed.contents.loads.length,0);
  // 새 문서가 시작됐으면(다른 이동이 새 화면 프로세스를 맡았다) 싣지 않는다
  const swapped=goneFixture();swapped.gone();swapped.contents.emit('did-start-navigation',{},'http://127.0.0.1:4280/learning-hub/',false,true);swapped.run();await settle();assert.equal(swapped.contents.loads.length,0);swapped.recovery.dispose();
});
test('a renderer that exits cleanly with no replacement is reloaded even though isCrashed() says false (엔진 검수 GA3)',async()=>{
  const f=goneFixture(),loading=f.recovery.connect();await settle();f.contents.success(0);await loading;
  f.gone('clean-exit');f.contents.crashed=false;f.run();await settle();
  assert.deepEqual(f.contents.loads.map(row=>row.url),[ENTRY,ENTRY]);f.recovery.dispose();
});
test('a navigation that started before the old renderer went away and then commits in the new one is not reloaded (화면 다시 검수 -d)',async()=>{
  const f=goneFixture(),loading=f.recovery.connect();await settle();f.contents.success(0);await loading;
  const next='http://127.0.0.1:4280/learning-hub/';
  f.contents.emit('did-start-navigation',{},next,false,true);f.gone();f.contents.crashed=false;f.contents.url=next;f.contents.emit('did-navigate',{},next,200,'OK');
  f.run();await settle();assert.equal(f.contents.loads.length,1,'the committed page is kept');
  assert.equal(f.recovery.recoverIfGone(),false,'nothing is left to recover');f.recovery.dispose();
});
test('a navigation that starts after the renderer went away but is cancelled before it commits still gets the entry back (엔진 다시 검수 -b GA1)',async()=>{
  const next='http://127.0.0.1:4280/learning-hub/';
  // 이동이 도는 동안 400ms가 지나면 기다렸다가, 취소되면 싣는다
  const f=goneFixture(),loading=f.recovery.connect();await settle();f.contents.success(0);await loading;
  f.gone();f.contents.crashed=false;f.contents.emit('did-start-navigation',{},next,false,true);f.run();await settle();
  assert.equal(f.contents.loads.length,1,'waits while the other navigation is still loading');
  f.contents.cancel(next);await settle();assert.deepEqual(f.contents.loads.map(row=>row.url),[ENTRY,ENTRY]);f.recovery.dispose();
  // 400ms 전에 취소되면 타이머가 싣는다
  const g=goneFixture(),gl=g.recovery.connect();await settle();g.contents.success(0);await gl;
  g.gone();g.contents.emit('did-start-navigation',{},next,false,true);g.contents.cancel(next);g.run();await settle();
  assert.deepEqual(g.contents.loads.map(row=>row.url),[ENTRY,ENTRY]);g.recovery.dispose();
  // 자동 한도 뒤에는 사람이 창을 연 때 싣는다
  const h=goneFixture(),hl=h.recovery.connect();await settle();h.contents.success(0);await hl;
  for(let i=1;i<=3;i++){h.gone();h.run();await settle();h.contents.success(i);await settle();h.tick(60000);}
  h.gone();h.contents.emit('did-start-navigation',{},next,false,true);h.contents.cancel(next);h.run();await settle();
  assert.equal(h.contents.loads.length,4);assert.equal(h.recovery.recoverIfGone(),true);await settle();assert.equal(h.contents.loads.length,5);
  // 기다리던 중에 창을 버리면 아무것도 싣지 않고 듣던 것을 거둔다
  const d=goneFixture(),dl=d.recovery.connect();await settle();d.contents.success(0);await dl;
  d.gone();d.contents.emit('did-start-navigation',{},next,false,true);d.run();d.recovery.dispose();assert.equal(d.contents.listenerCount('did-stop-loading'),0);
  d.contents.cancel(next);await settle();assert.equal(d.contents.loads.length,1);h.recovery.dispose();
});
test('a late loss notice from the old renderer arriving after the new document committed leaves the live page alone (엔진 다시 검수 -c Q1)',async()=>{
  const f=goneFixture(),loading=f.recovery.connect();await settle();f.contents.success(0);await loading;
  const next='http://127.0.0.1:4280/learning-hub/';
  // 새 문서가 새 화면 프로세스에 먼저 실리고, 옛 프로세스의 종료 알림은 작업 큐를 거쳐 뒤에 온다
  f.contents.emit('did-start-navigation',{},next,false,true);f.contents.pid=ALIVE;f.contents.url=next;f.contents.emit('did-navigate',{},next,200,'OK');f.contents.stopLoading();
  f.contents.emit('render-process-gone',{},{reason:'clean-exit',exitCode:0});f.run();await settle();
  assert.equal(f.contents.loads.length,1,'the live page is not replaced');assert.equal(f.recovery.recoverIfGone(),false);
  // 지금 화면 프로세스가 정말 사라졌으면(pid가 없음) 싣는다
  f.contents.pid=0;f.contents.emit('render-process-gone',{},{reason:'crashed',exitCode:1});f.run();await settle();
  assert.deepEqual(f.contents.loads.map(row=>row.url),[ENTRY,ENTRY]);f.recovery.dispose();
});
test('a relaunch retry that is in flight when the guide renderer went away finishes into the guide before any reload (엔진 다시 검수 -c GA1)',async()=>{
  const f=goneFixture(),loading=f.recovery.connect();await settle();f.contents.fail(0);await settle();
  assert.equal(f.contents.loads[1].url,STATUS);f.contents.success(1);await loading;
  // 안내 화면의 화면 프로세스가 사라진 뒤 400ms 안에 다시 실행해 다시 잇기가 걸린다
  f.contents.url=STATUS;f.gone();const retry=f.recovery.retryIfDisconnected();await settle();assert.equal(f.contents.loads[2].url,ENTRY);
  f.run();await settle();assert.equal(f.contents.loads.length,3,'the reload waits for the retry');
  // 다시 잇기가 문서 없이 끝나면(204 따위) 그 시도가 안내 화면을 띄운다. 되살리기는 한 번 더 싣지 않는다
  f.contents.fail(2,failure(-2));await settle();assert.equal(f.contents.loads[3].url,STATUS);f.contents.success(3);await retry;await settle();
  assert.deepEqual(f.contents.loads.map(row=>row.url),[ENTRY,STATUS,ENTRY,STATUS]);f.recovery.dispose();
});
test('Workspace reloads a lost renderer after a quit is cancelled to keep unsaved work, but not after leaving without saving (엔진 다시 검수 -b GA2)',async()=>{
  for(const [choice,reloads] of [[0,1],[1,0]]){
    const dialog={showMessageBoxSync:()=>choice};
    const f=await mainFixture({clientId:'messenger',mode:'development',entry:CLOUD_ENTRY,messengerCloudPreview:true,auth:null},{dialog});
    f.contents.success(0);await settle();
    f.app.emit('before-quit');
    const unload={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};f.contents.emit('will-prevent-unload',unload);
    assert.equal(unload.defaultPrevented,choice===1,'the draft prompt decides');
    f.contents.emit('render-process-gone',{},{reason:'crashed',exitCode:1});await new Promise(resolve=>setTimeout(resolve,460));
    assert.equal(f.contents.loads.length-1,reloads,choice===0?'「돌아가서 저장」 keeps the window, so it is reloaded':'leaving without saving is quitting');
    f.contents.emit('destroyed');
  }
});
test('after the automatic limit, showing or focusing the window loads the entry again; nothing happens when the page is fine (엔진 검수 GA2)',async()=>{
  const f=goneFixture(),loading=f.recovery.connect();await settle();f.contents.success(0);await loading;
  assert.equal(f.recovery.recoverIfGone(),false,'a live page is left alone');
  for(let i=1;i<=3;i++){f.gone();f.run();await settle();f.contents.success(i);await settle();f.tick(60000);}
  f.gone();f.run();await settle();assert.equal(f.contents.loads.length,4,'the fourth loss in ten minutes is not reloaded by itself');
  assert.equal(f.recovery.recoverIfGone(),true);await settle();
  assert.equal(f.contents.loads.length,5,'a person bringing the window up reloads it');
  f.contents.success(4);await settle();
  assert.equal(f.recovery.recoverIfGone(),false,'once a document started, it is not loaded again');
  const q=goneFixture({quitting:true});q.gone();assert.equal(q.recovery.recoverIfGone(),false,'not while quitting');q.recovery.dispose();
  f.recovery.dispose();
});
test('main resets the quit flag for every client when unsaved writing cancels the quit, and asks for recovery on show and focus (엔진 검수 GA1 · GA2)',()=>{
  const main=fs.readFileSync(path.join(__dirname,'..','src','main.cjs'),'utf8');
  assert.match(main,/\n  contents\.on\('will-prevent-unload',event=>\{if\(!event\.defaultPrevented\)\{quittingRequested=false;if\(isPlatform\)\{/);
  assert.match(main,/window\.on\('show',\(\)=>\{connectionRecovery\?\.recoverIfGone\?\.\(\);\}\);/);
  assert.match(main,/window\.on\('focus',async\(\)=>\{connectionRecovery\?\.recoverIfGone\?\.\(\);/);
  // 이미 보이고 초점이 있는 창에는 show · focus가 오지 않으므로, 사람이 연 때도 부른다(화면 다시 검수 -d)
  assert.match(main,/function showPlatformMain\(\)\{[\s\S]{0,300}window\.show\(\);window\.focus\(\);connectionRecovery\?\.recoverIfGone\?\.\(\);\}/);
  assert.match(main,/sendTeachingView\(\);if\(!connectionRecovery\?\.recoverIfGone\?\.\(\)\)void connectionRecovery\?\.retryIfDisconnected\(\);/);
});
test('main passes the quit flag so a window closing for quit is not reloaded',()=>{
  const main=fs.readFileSync(path.join(__dirname,'..','src','main.cjs'),'utf8');
  assert.match(main,/createConnectionRecovery\(\{contents,entry,isQuitting:\(\)=>quittingRequested\}\)/);
});
