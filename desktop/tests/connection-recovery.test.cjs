'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {createConnectionRecovery}=require('../src/connection-recovery.cjs');
const ENTRY='http://127.0.0.1:4280/synk-account/client.html?product=world',STATUS='synk-desktop://status/';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const failure=(code=-102)=>Object.assign(Error(code===-3?'ERR_ABORTED':'ERR_CONNECTION_REFUSED'),{errno:code,code:code===-3?'ERR_ABORTED':'ERR_CONNECTION_REFUSED'});
class Contents extends EventEmitter{
  constructor(){super();this.url='';this.loads=[];this.destroyed=false;}
  getURL(){return this.url;}
  isDestroyed(){return this.destroyed;}
  send(){}
  setWindowOpenHandler(){}
  loadURL(url){
    this.emit('did-start-navigation',{},url,false,true);
    let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
    this.loads.push({url,resolve,reject});return promise;
  }
  success(index){const item=this.loads[index];this.url=item.url;this.emit('did-navigate',{},item.url,200,'OK');item.resolve();}
  fail(index,error=failure()){const item=this.loads[index];this.emit('did-fail-load',{},error.errno,error.code,item.url,true);item.reject(error);}
  click(url){const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};this.emit('will-navigate',event,url);return event;}
}
async function mainFixture(runtime={clientId:'world',mode:'development',entry:ENTRY,auth:null}){
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
  const ownSession={setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onHeadersReceived(handler){headersHandler=handler;}},removeAllListeners(){},on(){},protocol:{handle(_scheme,handler){protocolHandler=handler;}}};
  const noop=()=>({});
  const stubs={
    electron:{app,BrowserWindow:Window,ipcMain:{removeHandler(){},handle(){}},session:{fromPartition:()=>ownSession},protocol:{registerSchemesAsPrivileged(){}},Menu:{setApplicationMenu(){}},shell:{},dialog:{},safeStorage:{}},
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
  for(const event of ['did-start-navigation','did-navigate','will-navigate','destroyed'])assert.equal(contents.listenerCount(event),0);recovery.dispose();
});

const CLOUD_ENTRY='https://workspace.synk.im/?tab=messenger';
test('main accepts explicit cloud Messenger and passes opt-in to its real fallback and fixed retry',async()=>{
  const f=await mainFixture({clientId:'messenger',mode:'development',entry:CLOUD_ENTRY,messengerCloudPreview:true,auth:null});
  assert.equal(f.contents.loads[0].url,CLOUD_ENTRY);await offline(f);
  const html=await (await f.content({url:STATUS,method:'GET'})).text();assert.ok(html.includes('href="'+CLOUD_ENTRY+'"'));assert.match(html,/인터넷 연결/);assert.doesNotMatch(html,/이 기기의 앱 서비스/);
  const click=f.contents.click(CLOUD_ENTRY);assert.equal(click.defaultPrevented,true);await settle();assert.equal(f.contents.loads[2].url,CLOUD_ENTRY);f.contents.success(2);await settle();
});
test('main rejects cloud runtime without exact boolean, client, mode and fixed entry before creating a window',async()=>{
  const valid={clientId:'messenger',mode:'development',entry:CLOUD_ENTRY,messengerCloudPreview:true,auth:null};
  for(const change of [{messengerCloudPreview:undefined},{messengerCloudPreview:'true'},{messengerCloudPreview:1},{clientId:'world'},{clientId:'platform'},{mode:'release'},{entry:CLOUD_ENTRY+'&next=evil'},{entry:ENTRY}])await assert.rejects(()=>mainFixture({...valid,...change}),/Invalid desktop runtime configuration/);
});
