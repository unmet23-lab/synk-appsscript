'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {PUBLIC_APP_URLS,publicAppDestination,publicAppsAvailable,createPublicApps}=require('../src/public-apps.cjs');
const {PLATFORM_ENTRY,DEV_URLS}=require('../src/catalog.cjs');
const {externalDestination,allowedNavigation}=require('../src/security.cjs');

test('only the development Platform capability exposes the four fixed public destinations',async()=>{
  assert.deepEqual(publicAppsAvailable({clientId:'platform',mode:'development'}),['care','fortune','rehearsal','path']);
  for(const values of [{clientId:'platform',mode:'release'},{clientId:'world',mode:'development'},{clientId:'messenger',mode:'development'},{clientId:'platform',mode:'Development'},{}]){
    let calls=0;const service=createPublicApps({...values,openExternal:()=>{calls++;}});
    assert.deepEqual(service.available(),[]);assert.equal((await service.open('care')).code,'PUBLIC_APP_UNAVAILABLE');assert.equal(calls,0);
  }
  for(const id of ['__proto__','constructor','toString','CARE','care/','../care','https://synk.im/care/',null,{},['care']])assert.equal(publicAppDestination(id),null);
});

test('public opening takes only a known ID and returns success after the browser promise resolves',async()=>{
  let complete;const calls=[],service=createPublicApps({clientId:'platform',mode:'development',openExternal:url=>{calls.push(url);return new Promise(resolve=>{complete=resolve;});}});
  const available=service.available();available.push('world');assert.deepEqual(service.available(),['care','fortune','rehearsal','path']);
  let settled=false;const first=service.open('fortune');first.then(()=>{settled=true;});assert.equal(service.open('fortune'),first);
  await Promise.resolve();assert.deepEqual(calls,['https://synk.im/fortune/']);assert.equal(settled,false);complete();
  assert.deepEqual(await first,{ok:true,id:'fortune',externalBrowser:true});
  for(const id of ['__proto__','constructor','world','messenger','https://evil.invalid/',{id:'care'},null])assert.equal((await service.open(id)).code,'UNKNOWN_PUBLIC_APP');
  assert.equal(calls.length,1);
});

test('browser failures are returned without exposing error details and can be retried',async()=>{
  let calls=0;const service=createPublicApps({clientId:'platform',mode:'development',openExternal:()=>{calls++;if(calls===1)throw Error('private browser details');if(calls===2)return Promise.reject(Error('private browser details'));}});
  for(let i=0;i<2;i++)assert.deepEqual(await service.open('care'),{ok:false,code:'PUBLIC_APP_OPEN_FAILED'});
  assert.deepEqual(await service.open('care'),{ok:true,id:'care',externalBrowser:true});assert.equal(calls,3);
});

test('public opening carries only the latest verified platform ID and never authentication credentials',async()=>{
 const calls=[],a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 let state={status:'signed-in',signedIn:true,account:{synk_user_id:a},accessToken:'must-stay-private'};
 const service=createPublicApps({clientId:'platform',mode:'development',accountStatus:()=>state,openExternal:async url=>calls.push(url)});
 const pending=service.open('care');state={...state,account:{synk_user_id:b}};await pending;
 assert.equal(calls[0],'https://synk.im/care/#synk-platform-account='+b);assert.doesNotMatch(calls[0],/must-stay-private|token/);
 state={...state,signedIn:false};await service.open('fortune');assert.equal(calls[1],'https://synk.im/fortune/');
 state={...state,signedIn:true,account:{synk_user_id:'not-a-canonical-id'}};await service.open('care');assert.equal(calls[2],'https://synk.im/care/');
});

test('PATH opens the standalone HTTPS interview without reading or sharing a member identity',async()=>{
 const calls=[],service=createPublicApps({clientId:'platform',mode:'development',accountStatus:()=>{throw Error('Standalone PATH must not inspect an account');},openExternal:async url=>calls.push(url)});
 assert.deepEqual(await service.open('path'),{ok:true,id:'path',externalBrowser:true});
 assert.deepEqual(calls,['https://synk.im/path/interview/film/rehearsal.html']);
 assert.equal(new URL(calls[0]).hash,'');assert.equal(new URL(calls[0]).search,'');
});

test('existing public benefit links allow exact routes only and never share the native window',()=>{
  for(const destination of Object.values(PUBLIC_APP_URLS)){
    for(const mode of ['development','release'])assert.equal(externalDestination(destination,PLATFORM_ENTRY,'platform',mode),destination);
    assert.equal(allowedNavigation(destination,PLATFORM_ENTRY,'platform'),false);
    for(const clientId of ['world','messenger'])assert.equal(externalDestination(destination,DEV_URLS[clientId],clientId,'development'),null);
    for(const value of [destination+'?token=synthetic',destination+'#synthetic',destination+'child',destination.replace('https:','http:'),destination.replace('synk.im','synk.im.evil.invalid'),destination.replace('synk.im','user:pass@synk.im'),destination.replace('synk.im','synk.im:443'),destination.replace('synk.im','synk.im:444'),destination+'/../care/'])assert.equal(externalDestination(value,PLATFORM_ENTRY,'platform','development'),null,value);
  }
  assert.equal(externalDestination('https://synk.im/unknown/',PLATFORM_ENTRY,'platform','development'),null);
});

test('preload forwards exactly the fixed public IDs and refuses URL or prototype input before IPC',async()=>{
  const calls=[];let bridge;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>{bridge=value;}},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return {ok:true};}}})});
  for(const id of ['care','fortune','rehearsal','path'])assert.equal((await bridge.openPublicApp(id)).ok,true);
  assert.deepEqual(calls,[['synk:open-public-app','care'],['synk:open-public-app','fortune'],['synk:open-public-app','rehearsal'],['synk:open-public-app','path']]);
  for(const id of ['__proto__','constructor','https://synk.im/care/','world','care?x=1',{},null])assert.equal((await bridge.openPublicApp(id)).code,'UNKNOWN_PUBLIC_APP');
  assert.equal(calls.length,4);
});

async function mainFixture({clientId='platform',mode='development',authState={signedIn:false,status:'signed-out'},externalFailure=false}={}){
  const entry=clientId==='platform'?PLATFORM_ENTRY:DEV_URLS[clientId],runtime={clientId,mode,entry,auth:null};
  const app=new EventEmitter(),handlers=new Map(),calls=[],frame={url:entry};let window,accountCalls=0;
  Object.assign(app,{isPackaged:true,enableSandbox(){},setName(){},setPath(){},getPath:name=>name==='home'?'C:\\Users\\synthetic':'/synthetic',getAppPath:()=>'/synthetic/app',getVersion:()=> '0.4.0',setAppUserModelId(){},getLoginItemSettings:()=>({openAtLogin:false}),requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve()});
  const contents=new EventEmitter();Object.assign(contents,{mainFrame:frame,getURL:()=>frame.url,setWindowOpenHandler(){},setZoomFactor(){},send(){}});
  class Window extends EventEmitter{constructor(options){super();this.webContents=contents;this.options=options;window=this;}isDestroyed(){return false;}isMinimized(){return false;}isMaximized(){return false;}getNormalBounds(){return {x:this.options.x||0,y:this.options.y||0,width:this.options.width,height:this.options.height};}show(){}focus(){}}
  const ownSession={setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onHeadersReceived(){}},removeAllListeners(){},on(){},protocol:{handle(){}}};
  const noop=()=>({});
  const stubs={
    electron:{app,BrowserWindow:Window,ipcMain:{removeHandler(){},handle:(name,handler)=>handlers.set(name,handler)},session:{fromPartition:()=>ownSession},protocol:{registerSchemesAsPrivileged(){}},Menu:{setApplicationMenu(){}},shell:{openExternal:async url=>{calls.push(url);if(externalFailure)throw Error('synthetic browser failure');}},dialog:{},safeStorage:{isEncryptionAvailable:()=>false},screen:{getAllDisplays:()=>[{workArea:{x:0,y:0,width:1920,height:1080}}],getPrimaryDisplay:()=>({workArea:{x:0,y:0,width:1920,height:1080}})},globalShortcut:{register:()=>false,unregister(){}},clipboard:{writeText(){throw Error('No clipboard operation allowed');}}},
    'node:fs':{readFileSync:()=>JSON.stringify(runtime)},'node:child_process':{spawn(){throw Error('No process allowed');}},
    './auth-config.cjs':{configuration:()=>null},'./auth-config-path.cjs':{resolveAuthConfigPath:()=>null},'./auth-store.cjs':{createTokenStore:noop},
    './auth-service.cjs':{createAuthService:()=>({initialize:async()=>{},status:()=>authState,accountRequest:()=>{accountCalls++;throw Error('No account request allowed');}}),publicError:noop},
    './client-lifecycle.cjs':{createClientLifecycle:()=>({getClients:async()=>[]})},'./teacher-preview.cjs':{createTeacherPreview:()=>({available:()=>false})},'./product-preview.cjs':{createProductPreviews:()=>({available:()=>[]})},
    './company-requests.cjs':{createCompanyRequests:()=>()=>{accountCalls++;throw Error('No company request allowed');}},'./downloads.cjs':{createDownloadHandler:noop},
    './native-content.cjs':{createNativeContent:noop},'./connection-content.cjs':{createConnectionContent:noop},'./connection-recovery.cjs':{createConnectionRecovery:()=>({connect:async()=>{},dispose(){}})},
  };
  const filename=path.join(__dirname,'../src/main.cjs');
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:id=>Object.hasOwn(stubs,id)?stubs[id]:id.startsWith('./')?require(path.join(__dirname,'../src',id)):require(id),__dirname:path.dirname(filename),process:{argv:[],platform:'win32',arch:'x64',env:{},resourcesPath:'/synthetic/resources'},console,Buffer,setTimeout,clearTimeout},{filename});
  await new Promise(resolve=>setImmediate(resolve));
  return {handlers,calls,frame,contents,window,event:{sender:contents,senderFrame:frame},get accountCalls(){return accountCalls;}};
}

test('signup preload and main open only the fixed registration URL without account operations',async()=>{
  let bridge;const calls=[];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>{bridge=value;}},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return {ok:true};}}})});
  await bridge.authSignUp('https://untrusted.invalid/',{token:'synthetic'});assert.deepEqual(calls,[['synk:auth-sign-up']]);
  for(const mode of ['development','release']){
    const f=await mainFixture({mode}),result=await f.handlers.get('synk:auth-sign-up')(f.event,'https://untrusted.invalid/');
    assert.equal(result.ok,true);assert.deepEqual(f.calls,['https://synk.im/id/?view=signup']);assert.equal(f.accountCalls,0);
  }
  const failure=await mainFixture({externalFailure:true});assert.equal((await failure.handlers.get('synk:auth-sign-up')(failure.event)).code,'AUTH_SIGNUP_OPEN_FAILED');
});
test('signup IPC refuses connected and changing sessions, sibling clients and untrusted senders',async()=>{
  for(const authState of [{signedIn:true,status:'signed-in'},...['signed-in','restoring','signing-in','signing-out'].map(status=>({signedIn:false,status}))]){
    const f=await mainFixture({authState});assert.equal((await f.handlers.get('synk:auth-sign-up')(f.event)).code,'AUTH_SIGNUP_UNAVAILABLE');assert.equal(f.calls.length,0);
  }
  for(const clientId of ['world','messenger']){const f=await mainFixture({clientId});assert.equal((await f.handlers.get('synk:auth-sign-up')(f.event)).code,'LAUNCHER_ONLY');assert.equal(f.calls.length,0);}
  const f=await mainFixture(),open=f.handlers.get('synk:auth-sign-up');
  for(const event of [{...f.event,sender:{}},{...f.event,senderFrame:{url:PLATFORM_ENTRY}},{...f.event,senderFrame:null}])await assert.rejects(open(event),/UNTRUSTED_SENDER/);
  f.frame.url='https://synk.im/id/';await assert.rejects(open(f.event),/UNTRUSTED_SENDER/);assert.equal(f.calls.length,0);
});

test('packaged development Platform wires the real public capability without account or company requests',async()=>{
  const f=await mainFixture(),environment=await f.handlers.get('synk:environment')(f.event);
  assert.deepEqual(environment.publicAppsAvailable,['care','fortune','rehearsal','path']);
  for(const [id,url]of Object.entries(PUBLIC_APP_URLS)){assert.equal((await f.handlers.get('synk:open-public-app')(f.event,id)).ok,true);assert.equal(f.calls.at(-1),url);}
  assert.equal(f.accountCalls,0);
  assert.equal((await f.handlers.get('synk:open-public-app')(f.event,'__proto__')).code,'UNKNOWN_PUBLIC_APP');assert.equal(f.calls.length,4);
});

test('main rejects release, other client, foreign window, subframe and foreign-document public IPC',async()=>{
  for(const options of [{clientId:'platform',mode:'release'},{clientId:'world'},{clientId:'messenger'}]){
    const f=await mainFixture(options);assert.deepEqual((await f.handlers.get('synk:environment')(f.event)).publicAppsAvailable,[]);
    assert.equal((await f.handlers.get('synk:open-public-app')(f.event,'care')).code,'PUBLIC_APP_UNAVAILABLE');assert.equal(f.calls.length,0);
  }
  const f=await mainFixture(),open=f.handlers.get('synk:open-public-app');
  for(const event of [{...f.event,sender:{}},{...f.event,senderFrame:{url:PLATFORM_ENTRY}},{...f.event,senderFrame:null}])await assert.rejects(open(event,'care'),/UNTRUSTED_SENDER/);
  f.frame.url='https://synk.im/care/';await assert.rejects(open(f.event,'care'),/UNTRUSTED_SENDER/);assert.equal(f.calls.length,0);
});
