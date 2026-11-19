'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {createConnectionRecovery}=require('../src/connection-recovery.cjs');
const ENTRY='http://127.0.0.1:4280/synk-account/client.html?product=world',STATUS='synk-desktop://status/';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const failure=(code=-102)=>Object.assign(Error(code===-3?'ERR_ABORTED':'ERR_CONNECTION_REFUSED'),{errno:code,code:code===-3?'ERR_ABORTED':'ERR_CONNECTION_REFUSED'});
// 살아 있는 프로세스 번호(이 시험 프로세스). 0이면 주 프레임에 화면 프로세스가 없다
const ALIVE=process.pid;
/* 창의 webContents를 흉내 낸다. 화면 프로세스의 값은 설계 검토의 실측(Electron 44.5.1)을 따른다.
   주 프레임 이동이 시작되면 싣는 중이다. 사라진 프레임에서 시작하면 곧바로 새 프로세스로 바뀌고 주 프레임 주소는 빈다.
   실리면 주소가 찬다. 실리거나 실패하거나 취소되면 did-stop-loading과 함께 끝난다. 사라진 채로 mainFrame을 읽으면 예외가 난다 */
class Contents extends EventEmitter{
  constructor(){super();this.url='';this.loads=[];this.destroyed=false;this.loading=false;this.pid=ALIVE;this.frameUrl='';this.crashed=false;}
  emit(name,...args){
    if(name==='did-start-navigation'&&args[3]&&!args[2]){this.loading=true;if(!this.pid){this.pid=ALIVE;this.frameUrl='';this.crashed=false;}}
    return super.emit(name,...args);
  }
  getURL(){return this.url;}
  isDestroyed(){return this.destroyed;}
  isLoadingMainFrame(){return this.loading;}
  isCrashed(){return this.crashed;}
  getOSProcessId(){return this.pid;}
  get mainFrame(){if(!this.pid)throw Error('Render frame was disposed before WebFrameMain could be accessed');return {url:this.frameUrl};}
  stopLoading(){this.loading=false;this.emit('did-stop-loading');}
  cancel(url){this.emit('did-fail-load',{},-3,'ERR_ABORTED',url,true);this.stopLoading();}
  commit(url){this.url=url;this.frameUrl=url;this.pid=this.pid||ALIVE;this.crashed=false;this.emit('did-navigate',{},url,200,'OK');this.stopLoading();}
  // 화면 프로세스가 사라진다. 종료 코드 0이면 isCrashed()는 거짓이다. notify가 거짓이면 종료 알림이 오지 않는다
  die(reason='crashed',{notify=true}={}){this.pid=0;this.crashed=reason!=='clean-exit';if(notify)this.emit('render-process-gone',{},{reason,exitCode:reason==='clean-exit'?0:1});}
  send(){}
  setWindowOpenHandler(){}
  loadURL(url){
    this.emit('did-start-navigation',{},url,false,true);
    let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
    this.loads.push({url,resolve,reject});return promise;
  }
  success(index){const item=this.loads[index];this.commit(item.url);item.resolve();}
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

/* 화면 프로세스가 사라진 창은 첫 화면을 다시 싣는다(11-19 트레이에 숨은 채 켜진 0.4.97 창이 검게 남음).
   판정은 사건의 순서가 아니라 지금 상태로 한다(2026-11-19 설계 검토) */
const NEXT='http://127.0.0.1:4280/learning-hub/',STOPPED='synk-desktop://status/stopped';
function goneFixture({quitting=false}={}){
  const contents=new Contents();
  let clock=0;const timers=[];
  const recovery=createConnectionRecovery({contents,entry:ENTRY,isQuitting:()=>quitting,now:()=>clock,setTimer:(fn,ms)=>{const t={fn,ms,done:false};timers.push(t);return t;},clearTimer:t=>{if(t)t.done=true;}});
  const run=()=>{for(const t of timers.splice(0))if(!t.done)t.fn();};
  return {contents,recovery,run,gone:(reason,options)=>contents.die(reason,options),tick:ms=>{clock+=ms;},timers};
}
async function loaded(options){const f=goneFixture(options),loading=f.recovery.connect();await settle();f.contents.success(0);await loading;return f;}
test('a main window whose renderer is gone loads the entry again after a short pause',async()=>{
  const f=await loaded();
  f.gone('killed');assert.equal(f.contents.loads.length,1,'the reload waits for the pause');
  assert.equal(f.timers[0].ms,400);f.run();await settle();
  assert.deepEqual(f.contents.loads.map(row=>row.url),[ENTRY,ENTRY]);f.contents.success(1);await settle();f.recovery.dispose();
});
test('after three automatic reloads in ten minutes the next loss loads the stopped page instead, and the entry again once the window passes (설계 검토 P2-2 · 화면 다시 검수 -g)',async()=>{
  const f=await loaded();
  for(let i=1;i<=3;i++){f.gone();f.run();await settle();assert.equal(f.contents.loads[i].url,ENTRY);f.contents.success(i);await settle();f.tick(60000);}
  // 보이고 초점 있는 창이 네 번째로 사라져도 검게 남지 않는다. 「화면이 잇달아 멈췄어요」 안내를 싣고, 「다시 연결」이 첫 화면으로 잇는다
  f.gone();f.run();await settle();assert.equal(f.contents.loads[4].url,STOPPED);f.contents.success(4);await settle();
  assert.equal(f.recovery.recoverIfGone(),false,'the stopped page is a screen');
  // 사람이 트레이에서 다시 열면(Platform의 showPlatformMain) 안내 화면에서 첫 화면으로 다시 잇는다. 「다시 연결」 고리도 잡는다
  const reopened=f.recovery.retryIfDisconnected();await settle();assert.equal(f.contents.loads[5].url,ENTRY);f.contents.success(5);await reopened;
  f.tick(10*60000);f.gone();f.run();await settle();assert.equal(f.contents.loads[6].url,ENTRY);f.contents.success(6);await settle();
  f.contents.url=STOPPED;assert.equal(f.contents.click(ENTRY).defaultPrevented,true,'the retry link on the stopped page is handled');f.recovery.dispose();
});
test('loss notices that arrive while the page is fine do not use up the automatic reloads (화면 다시 검수 -g)',async()=>{
  const f=await loaded();
  for(let i=0;i<3;i++){f.contents.emit('render-process-gone',{},{reason:'clean-exit',exitCode:0});f.run();await settle();}
  assert.equal(f.contents.loads.length,1,'nothing is loaded over a live page');
  f.gone();f.run();await settle();assert.equal(f.contents.loads[1].url,ENTRY,'the first real loss still loads the entry');f.recovery.dispose();
});
test('a person opening the window while an automatic recovery waits gets the entry, and it is not counted (화면 다시 검수 -g)',async()=>{
  const f=await loaded();
  for(let i=1;i<=3;i++){f.gone();f.run();await settle();f.contents.success(i);await settle();}
  // 한도에 닿은 채 다른 이동이 도는 동안 저절로의 되살리기와 사람의 창 열기가 겹친다
  f.gone();f.contents.emit('did-start-navigation',{},NEXT,false,true);f.run();await settle();
  assert.equal(f.recovery.recoverIfGone(),false,'both wait for the navigation');f.contents.cancel(NEXT);await settle();
  assert.equal(f.contents.loads[4].url,ENTRY,'the person asked, so the entry');f.contents.success(4);await settle();
  // 사람 쪽은 세지 않아, 다음 저절로의 사라짐은 여전히 한도에 걸린다
  f.gone();f.run();await settle();assert.equal(f.contents.loads[5].url,STOPPED);f.contents.success(5);await settle();
  // 400ms 안에 사람이 창을 열어도 사람 쪽을 따른다
  f.gone();assert.equal(f.recovery.recoverIfGone(),false,'the pause still runs');f.run();await settle();assert.equal(f.contents.loads[6].url,ENTRY);f.recovery.dispose();
});
test('renderer recovery does nothing while quitting, after dispose, or before the window ever connected',async()=>{
  const quitting=await loaded({quitting:true});quitting.gone();quitting.run();await settle();assert.equal(quitting.recovery.recoverIfGone(),false);assert.equal(quitting.contents.loads.length,1);quitting.recovery.dispose();
  const disposed=await loaded();disposed.gone();disposed.recovery.dispose();disposed.run();await settle();assert.equal(disposed.contents.loads.length,1);
  const fresh=goneFixture();fresh.gone();fresh.run();await settle();assert.equal(fresh.recovery.recoverIfGone(),false);assert.equal(fresh.contents.loads.length,0,'the first load is the caller’s');fresh.recovery.dispose();
});
test('a renderer that exits cleanly with no replacement is reloaded even though isCrashed() says false (엔진 검수 GA3)',async()=>{
  const f=await loaded();
  f.gone('clean-exit');assert.equal(f.contents.isCrashed(),false);f.run();await settle();
  assert.deepEqual(f.contents.loads.map(row=>row.url),[ENTRY,ENTRY]);f.recovery.dispose();
});
test('a loss with no notice at all is recovered when the window is shown, focused or opened (설계 검토 P2-1)',async()=>{
  const f=await loaded();
  assert.equal(f.recovery.recoverIfGone(),false,'a live page is left alone');
  f.gone('crashed',{notify:false});assert.equal(f.timers.length,0);
  assert.equal(f.recovery.recoverIfGone(),true);await settle();assert.deepEqual(f.contents.loads.map(row=>row.url),[ENTRY,ENTRY]);
  f.contents.success(1);await settle();assert.equal(f.recovery.recoverIfGone(),false,'once the entry is back nothing more is loaded');f.recovery.dispose();
});
test('a navigation that started before the old renderer went away and then commits in the new one is not reloaded (화면 다시 검수 -d)',async()=>{
  for(const early of [false,true]){
    const f=await loaded();
    f.contents.emit('did-start-navigation',{},NEXT,false,true);f.gone();
    // 400ms가 실리기 전에 지나면 이동이 끝나기를 기다린다
    if(early){f.run();await settle();assert.equal(f.contents.loads.length,1,'waits while the navigation is loading');}
    f.contents.commit(NEXT);f.run();await settle();
    assert.equal(f.contents.loads.length,1,'the committed page is kept');assert.equal(f.recovery.recoverIfGone(),false);f.recovery.dispose();
  }
});
test('a navigation that starts after the renderer went away but ends with no document still gets the entry back (엔진 다시 검수 -b GA1 · 설계 검토 P2-3)',async()=>{
  // 사라진 프레임에서 이동이 시작되면 새 프로세스가 살아나도 주 프레임 주소는 비어 있다. 그 이동이 취소되면 화면이 없다
  const f=await loaded();
  f.gone();f.contents.emit('did-start-navigation',{},NEXT,false,true);assert.equal(f.contents.getOSProcessId(),ALIVE);
  f.run();await settle();assert.equal(f.contents.loads.length,1,'waits while the other navigation is still loading');
  f.contents.cancel(NEXT);await settle();assert.deepEqual(f.contents.loads.map(row=>row.url),[ENTRY,ENTRY]);f.recovery.dispose();
  // 400ms 전에 취소돼도 같다
  const g=await loaded();
  g.gone();g.contents.emit('did-start-navigation',{},NEXT,false,true);g.contents.cancel(NEXT);g.run();await settle();
  assert.deepEqual(g.contents.loads.map(row=>row.url),[ENTRY,ENTRY]);g.recovery.dispose();
  // 알림 없이 같은 일이 나도 사람이 창을 연 때 싣는다
  const h=await loaded();
  h.gone('crashed',{notify:false});h.contents.emit('did-start-navigation',{},NEXT,false,true);h.contents.cancel(NEXT);
  assert.equal(h.recovery.recoverIfGone(),true);await settle();assert.deepEqual(h.contents.loads.map(row=>row.url),[ENTRY,ENTRY]);h.recovery.dispose();
  // 기다리던 중에 창을 버리면 아무것도 싣지 않고 듣던 것을 거둔다
  const d=await loaded();
  d.gone();d.contents.emit('did-start-navigation',{},NEXT,false,true);d.run();d.recovery.dispose();assert.equal(d.contents.listenerCount('did-stop-loading'),0);
  d.contents.cancel(NEXT);await settle();assert.equal(d.contents.loads.length,1);
});
test('a late loss notice from the old renderer arriving after the new document committed leaves the live page alone (엔진 다시 검수 -c Q1)',async()=>{
  const f=await loaded();
  // 새 문서가 새 화면 프로세스에 먼저 실리고, 옛 프로세스의 종료 알림은 작업 큐를 거쳐 뒤에 온다
  f.contents.emit('did-start-navigation',{},NEXT,false,true);f.contents.commit(NEXT);
  f.contents.emit('render-process-gone',{},{reason:'clean-exit',exitCode:0});f.run();await settle();
  assert.equal(f.contents.loads.length,1,'the live page is not replaced');assert.equal(f.recovery.recoverIfGone(),false);
  // 지금 화면 프로세스가 정말 사라졌으면 싣는다
  f.gone();f.run();await settle();assert.deepEqual(f.contents.loads.map(row=>row.url),[ENTRY,ENTRY]);f.recovery.dispose();
});
test('a relaunch retry that is in flight when the guide renderer went away finishes into the guide before any reload (엔진 다시 검수 -c GA1)',async()=>{
  const f=goneFixture(),loading=f.recovery.connect();await settle();f.contents.fail(0);await settle();
  assert.equal(f.contents.loads[1].url,STATUS);f.contents.success(1);await loading;
  // 안내 화면의 화면 프로세스가 사라진 뒤 400ms 안에 다시 실행해 다시 잇기가 걸린다
  f.gone();const retry=f.recovery.retryIfDisconnected();await settle();assert.equal(f.contents.loads[2].url,ENTRY);
  f.run();await settle();assert.equal(f.contents.loads.length,3,'the reload waits for the retry');
  // 다시 잇기가 문서 없이 끝나면(204 따위) 그 시도가 안내 화면을 띄운다. 되살리기는 한 번 더 싣지 않는다
  f.contents.fail(2,failure(-2));await settle();assert.equal(f.contents.loads[3].url,STATUS);f.contents.success(3);await retry;await settle();
  assert.deepEqual(f.contents.loads.map(row=>row.url),[ENTRY,STATUS,ENTRY,STATUS]);f.recovery.dispose();
});
// Electron 44.5.1 실측: 오류 문서가 실리면 주 프레임 did-fail-provisional-load와 did-fail-load, did-finish-load가 오고 did-navigate는 오지 않는다. 주 프레임 주소는 실패한 주소다.
// 실린 문서의 본문을 받다 끊기면 did-navigate 뒤에 did-fail-load(-354, -355)만 온다
function errorPage(contents,url,code=-102){contents.emit('did-start-navigation',{},url,false,true);contents.url=url;contents.frameUrl=url;contents.emit('did-fail-provisional-load',{},code,'ERR_CONNECTION_REFUSED',url,true);contents.emit('did-fail-load',{},code,'ERR_CONNECTION_REFUSED',url,true);contents.emit('did-finish-load');contents.stopLoading();}
test('an error document is not a screen: after a loss, or on a live window, the entry comes back (엔진 다시 검수 -e GA1)',async()=>{
  const f=await loaded();
  f.gone();errorPage(f.contents,NEXT);assert.equal(f.contents.getOSProcessId(),ALIVE);f.run();await settle();
  assert.deepEqual(f.contents.loads.map(row=>row.url),[ENTRY,ENTRY],'the error document left after the loss is replaced');f.contents.success(1);await settle();
  // 멀쩡한 창에서 다른 이동이 실패해 오류 문서가 실려도, 창을 열거나 초점을 주면 첫 화면으로 돌아온다
  errorPage(f.contents,NEXT);assert.equal(f.recovery.recoverIfGone(),true);await settle();assert.equal(f.contents.loads[2].url,ENTRY);
  f.contents.success(2);await settle();assert.equal(f.recovery.recoverIfGone(),false,'a normal document after the error is a screen again');
  // 다른 이동에 밀려 그만둔 것(-3)은 오류 문서가 아니다
  f.contents.emit('did-fail-provisional-load',{},-3,'ERR_ABORTED',NEXT,true);assert.equal(f.recovery.recoverIfGone(),false);f.recovery.dispose();
});
test('a document that committed but lost the rest of its body is still a screen (화면 다시 검수 -h)',async()=>{
  const f=await loaded();
  for(const code of [-354,-355]){
    f.contents.emit('did-start-navigation',{},NEXT,false,true);f.contents.commit(NEXT);f.contents.emit('did-fail-load',{},code,'ERR_CONTENT_LENGTH_MISMATCH',NEXT,true);
    assert.equal(f.recovery.recoverIfGone(),false,'the drawn document is kept ('+code+')');
  }
  assert.equal(f.contents.loads.length,1);f.recovery.dispose();
});
test('when even the stopped page keeps going away, it is loaded automatically once per ten minutes; a person still gets the entry (엔진 다시 검수 -e GA2)',async()=>{
  const f=await loaded();
  for(let i=1;i<=3;i++){f.gone();f.run();await settle();f.contents.success(i);await settle();}
  f.gone();f.run();await settle();assert.equal(f.contents.loads[4].url,STOPPED);f.contents.success(4);await settle();
  f.gone();f.run();await settle();assert.equal(f.contents.loads.length,5,'the stopped page is not reloaded again by itself');
  assert.equal(f.recovery.recoverIfGone(),true);await settle();assert.equal(f.contents.loads[5].url,ENTRY,'a person opening the window gets the entry');f.contents.success(5);await settle();
  f.tick(10*60000+1);f.gone();f.run();await settle();assert.equal(f.contents.loads[6].url,ENTRY,'after ten minutes the count starts again');f.recovery.dispose();
});
test('after a person reconnects from the stopped page, the next loss within ten minutes shows the stopped page again instead of a black window (화면 다시 검수 -h)',async()=>{
  const f=await loaded();
  for(let i=1;i<=3;i++){f.gone();f.run();await settle();f.contents.success(i);await settle();}
  f.gone();f.run();await settle();assert.equal(f.contents.loads[4].url,STOPPED);f.contents.success(4);await settle();
  // 「다시 연결」(또는 창 열기)로 첫 화면을 다시 잇는다
  const again=f.recovery.retryIfDisconnected();await settle();assert.equal(f.contents.loads[5].url,ENTRY);f.contents.success(5);await again;
  f.gone();f.run();await settle();assert.equal(f.contents.loads[6].url,STOPPED,'the stopped page once more');f.contents.success(6);await settle();
  f.gone();f.run();await settle();assert.equal(f.contents.loads.length,7,'but not again by itself');f.recovery.dispose();
});
test('Workspace reloads a lost renderer after a quit is cancelled to keep unsaved work, but not after leaving without saving (엔진 다시 검수 -b GA2)',async()=>{
  for(const [choice,reloads] of [[0,1],[1,0]]){
    const dialog={showMessageBoxSync:()=>choice};
    const f=await mainFixture({clientId:'messenger',mode:'development',entry:CLOUD_ENTRY,messengerCloudPreview:true,auth:null},{dialog});
    f.contents.success(0);await settle();
    f.app.emit('before-quit');
    const unload={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};f.contents.emit('will-prevent-unload',unload);
    assert.equal(unload.defaultPrevented,choice===1,'the draft prompt decides');
    f.contents.die('crashed');await new Promise(resolve=>setTimeout(resolve,460));
    assert.equal(f.contents.loads.length-1,reloads,choice===0?'「돌아가서 저장」 keeps the window, so it is reloaded':'leaving without saving is quitting');
    f.contents.emit('destroyed');
  }
});
test('main resets the quit flag for every client when unsaved writing cancels the quit, and asks for recovery on show and focus (엔진 검수 GA1 · GA2)',()=>{
  const main=fs.readFileSync(path.join(__dirname,'..','src','main.cjs'),'utf8');
  assert.match(main,/\n  contents\.on\('will-prevent-unload',event=>\{if\(!event\.defaultPrevented\)\{quittingRequested=false;if\(isPlatform\)\{/);
  assert.match(main,/window\.on\('show',\(\)=>\{connectionRecovery\?\.recoverIfGone\?\.\(\);\}\);/);
  assert.match(main,/window\.on\('focus',async\(\)=>\{connectionRecovery\?\.recoverIfGone\?\.\(\);/);
  // 이미 보이고 초점이 있는 창에는 show · focus가 오지 않으므로, 사람이 연 때도 부른다(화면 다시 검수 -d)
  // 안내 화면이 떠 있으면 사람이 연 때 첫 화면으로 다시 잇는다(화면 다시 검수 -g)
  assert.match(main,/function showPlatformMain\(\)\{[\s\S]{0,500}window\.show\(\);window\.focus\(\);if\(!connectionRecovery\?\.recoverIfGone\?\.\(\)\)void connectionRecovery\?\.retryIfDisconnected\?\.\(\);\}/);
  assert.match(main,/sendTeachingView\(\);if\(!connectionRecovery\?\.recoverIfGone\?\.\(\)\)void connectionRecovery\?\.retryIfDisconnected\(\);/);
});
test('main passes the quit flag so a window closing for quit is not reloaded',()=>{
  const main=fs.readFileSync(path.join(__dirname,'..','src','main.cjs'),'utf8');
  assert.match(main,/createConnectionRecovery\(\{contents,entry,isQuitting:\(\)=>quittingRequested\}\)/);
});
