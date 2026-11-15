'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events'),{randomUUID}=require('node:crypto');
const {PORTAL_PURPOSE_URLS,portalPurposeDestination,createPortalNavigation}=require('../src/portal-navigation.cjs');
const {PLATFORM_ENTRY,DEV_URLS}=require('../src/catalog.cjs');
const {externalDestination,allowedNavigation}=require('../src/security.cjs');
const SHIFT='https://synk.im/shift/',TOKEN='SYNTHETIC_invite-token_0001';

test('the visit purpose shift names one fixed public page, and the window link allow-list stays as it was',()=>{
  assert.deepEqual(PORTAL_PURPOSE_URLS,{shift:SHIFT});assert.equal(Object.isFrozen(PORTAL_PURPOSE_URLS),true);
  assert.equal(portalPurposeDestination('shift'),SHIFT);
  for(const id of ['__proto__','constructor','toString','hasOwnProperty','SHIFT','shift/','shift ','../shift',SHIFT,'solio','studio','care','pulse','',null,undefined,{},['shift'],{id:'shift'}])assert.equal(portalPurposeDestination(id),null,String(id));
  // Only the fixed IPC opens SHIFT; a link or navigation to it from the platform window is not newly allowed.
  for(const mode of ['development','release'])assert.equal(externalDestination(SHIFT,PLATFORM_ENTRY,'platform',mode),null,mode);
  assert.equal(allowedNavigation(SHIFT,PLATFORM_ENTRY,'platform'),false);
});

test('SHIFT succeeds only after the browser call completes, and a double click joins that one call',async()=>{
  let complete;const calls=[],service=createPortalNavigation({clientId:'platform',openExternal:url=>{calls.push(url);return new Promise(resolve=>{complete=resolve;});}});
  let settled=false;const first=service.openPurpose('shift');first.then(()=>{settled=true;});assert.equal(service.openPurpose('shift'),first);
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,[SHIFT]);assert.equal(settled,false);
  complete();assert.deepEqual(await first,{ok:true,id:'shift',externalBrowser:true});
  const again=service.openPurpose('shift');assert.notEqual(again,first);await new Promise(resolve=>setImmediate(resolve));complete();
  assert.deepEqual(await again,{ok:true,id:'shift',externalBrowser:true});assert.deepEqual(calls,[SHIFT,SHIFT]);
});

test('a failed browser call is a clear failure without its details, and the next click can retry',async()=>{
  let calls=0;const service=createPortalNavigation({clientId:'platform',openExternal:()=>{calls++;if(calls===1)throw Error('private browser details');if(calls===2)return Promise.reject(Error('private browser details'));}});
  for(let i=0;i<2;i++){const result=await service.openPurpose('shift');assert.deepEqual(result,{ok:false,code:'PORTAL_PURPOSE_OPEN_FAILED'});assert.doesNotMatch(JSON.stringify(result),/private/);}
  assert.deepEqual(await service.openPurpose('shift'),{ok:true,id:'shift',externalBrowser:true});assert.equal(calls,3);
});

test('other IDs, sibling clients and smoke runs never reach the browser',async()=>{
  let calls=0;const openExternal=async()=>{calls++;},service=createPortalNavigation({clientId:'platform',openExternal});
  for(const id of ['solio','studio','care','pulse',SHIFT,'SHIFT','shift?x=1','__proto__','constructor',{id:'shift'},['shift'],null,undefined])assert.deepEqual(await service.openPurpose(id),{ok:false,code:'UNKNOWN_PORTAL_PURPOSE'});
  for(const options of [{clientId:'world'},{clientId:'messenger'},{clientId:undefined},{clientId:'platform',smoke:true},{clientId:'platform',openExternal:null}])
    assert.deepEqual(await createPortalNavigation({openExternal,...options}).openPurpose('shift'),{ok:false,code:'PORTAL_PURPOSE_UNAVAILABLE'},JSON.stringify(options));
  assert.equal(calls,0);
});

test('preload passes only the purpose ID shift, never a URL or object',async()=>{
  const calls=[];let bridge;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>{bridge=value;}},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return {ok:true};}}})});
  assert.equal((await bridge.openPortalPurpose('shift',SHIFT)).ok,true);assert.deepEqual(calls,[['synk:open-portal-purpose','shift']]);
  for(const id of ['solio',SHIFT,'SHIFT','shift?x=1','__proto__',{},['shift'],null,undefined])assert.equal((await bridge.openPortalPurpose(id)).code,'UNKNOWN_PORTAL_PURPOSE');
  assert.equal(calls.length,1);assert.deepEqual(Object.keys(bridge).filter(key=>/portal|purpose/i.test(key)),['openPortalPurpose']);
});

// Runs the shipped main.cjs with Electron, auth and PULSE stand-ins, as public-apps.test.cjs does.
// `suite` adds a sign-in suite whose refresh answers 'available' or not; `argv` can make it a smoke run.
async function mainFixture({clientId='platform',mode='development',argv=[],suite=null,externalFailure=false}={}){
  const entry=clientId==='platform'?PLATFORM_ENTRY:DEV_URLS[clientId],runtime={clientId,mode,entry,auth:null},smoke=argv.includes('--synk-smoke');
  const app=new EventEmitter(),handlers=new Map(),calls=[],pulseCalls=[],frame={url:entry};
  Object.assign(app,{isPackaged:true,enableSandbox(){},setName(){},setPath(){},getPath:name=>name==='home'?'C:\\Users\\synthetic':'/synthetic',getAppPath:()=>'/synthetic/app',getVersion:()=> '0.4.0',setAppUserModelId(){},getLoginItemSettings:()=>({openAtLogin:false}),requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve()});
  const contents=new EventEmitter();Object.assign(contents,{mainFrame:frame,getURL:()=>frame.url,setWindowOpenHandler(){},setZoomFactor(){},send(){}});
  class Window extends EventEmitter{constructor(options){super();this.webContents=contents;this.options=options;}isDestroyed(){return false;}isMinimized(){return false;}isMaximized(){return false;}getNormalBounds(){return {x:this.options.x||0,y:this.options.y||0,width:this.options.width,height:this.options.height};}show(){}focus(){}}
  const ownSession={setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onBeforeRequest(){},onHeadersReceived(){}},removeAllListeners(){},on(){},protocol:{handle(){}}};
  const noop=()=>({}),pulse=(name,result)=>(...args)=>{pulseCalls.push([name,...args]);return Promise.resolve(result);};
  const publisher={initialize:async()=>{},refresh:()=>suite==='available',project:state=>state,publish(){},beginSignIn:()=>true,signOut:()=>true,dispose(){}};
  const stubs={
    electron:{app,BrowserWindow:Window,ipcMain:{removeHandler(){},handle:(name,handler)=>handlers.set(name,handler)},session:{fromPartition:()=>ownSession},protocol:{registerSchemesAsPrivileged(){}},Menu:{setApplicationMenu(){}},shell:{openExternal:async url=>{calls.push(url);if(externalFailure)throw Error('synthetic browser failure');}},dialog:{},safeStorage:{isEncryptionAvailable:()=>false},screen:{getAllDisplays:()=>[{workArea:{x:0,y:0,width:1920,height:1080}}],getPrimaryDisplay:()=>({workArea:{x:0,y:0,width:1920,height:1080}})},globalShortcut:{register:()=>false,unregister(){}},clipboard:{writeText(){throw Error('No clipboard operation allowed');}}},
    'node:fs':{readFileSync:()=>JSON.stringify(runtime)},'node:child_process':{spawn(){throw Error('No process allowed');}},
    './auth-config.cjs':{configuration:()=>suite&&clientId==='platform'?{fingerprint:'synthetic-suite-binding'}:null},'./auth-config-path.cjs':{resolveAuthConfigPath:()=>null},'./auth-store.cjs':{createTokenStore:noop},
    './auth-service.cjs':{createAuthService:()=>({initialize:async()=>{},status:()=>({signedIn:false,status:'signed-out'}),accountRequest:()=>{throw Error('No account request allowed');}}),publicError:noop},
    './pulse-app.cjs':{createPulseApp:()=>({open:pulse('open',{ok:true,id:'pulse',independentWindow:true}),openInvite:pulse('openInvite',{ok:true,requestId:null,accountGeneration:null,state:'received',destination:'/pulse-app/'}),syncContext(){},dispose(){}}),pulseInviteRefusal:require('../src/pulse-app.cjs').pulseInviteRefusal},
    './client-lifecycle.cjs':{createClientLifecycle:()=>({getClients:async()=>[]})},'./teacher-preview.cjs':{createTeacherPreview:()=>({available:()=>false})},'./product-preview.cjs':{createProductPreviews:()=>({available:()=>[]})},
    './company-requests.cjs':{createCompanyRequests:()=>()=>{throw Error('No company request allowed');}},'./downloads.cjs':{createDownloadHandler:noop},
    './native-content.cjs':{createNativeContent:noop},'./connection-content.cjs':{createConnectionContent:noop},'./connection-recovery.cjs':{createConnectionRecovery:()=>({connect:async()=>{},dispose(){}})},
    ...(suite?{'./suite-session.cjs':{suiteKey:()=> 'synthetic-suite',suiteDevice:()=> 'synthetic-device',createSuiteStore:()=>({}),createSuitePublisher:()=>publisher,createSuiteFollower:()=>({start:async()=>{},dispose(){}})}}:{}),
  };
  const filename=path.join(__dirname,'../src/main.cjs');
  // A smoke run arms a 20-second exit timer for its own probe; this harness never lets it run.
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:id=>Object.hasOwn(stubs,id)?stubs[id]:id.startsWith('./')?require(path.join(__dirname,'../src',id)):require(id),__dirname:path.dirname(filename),process:{argv,platform:'win32',arch:'x64',env:{},resourcesPath:'/synthetic/resources'},console,Buffer,setTimeout:smoke?()=>0:setTimeout,clearTimeout:smoke?()=>{}:clearTimeout},{filename});
  await new Promise(resolve=>setImmediate(resolve));
  return {handlers,calls,pulseCalls,frame,event:{sender:contents,senderFrame:frame}};
}

test('main opens SHIFT from the trusted platform window through the fixed constant only',async()=>{
  const f=await mainFixture(),open=f.handlers.get('synk:open-portal-purpose');
  const opened=await open(f.event,'shift',SHIFT);assert.equal(opened.ok,true);assert.equal(opened.id,'shift');assert.deepEqual(f.calls,[SHIFT]);
  for(const id of [SHIFT,'solio','studio','__proto__',{id:'shift'},null])assert.equal((await open(f.event,id)).code,'UNKNOWN_PORTAL_PURPOSE');
  for(const event of [{...f.event,sender:{}},{...f.event,senderFrame:{url:PLATFORM_ENTRY}},{...f.event,senderFrame:null}])await assert.rejects(open(event,'shift'),/UNTRUSTED_SENDER/);
  f.frame.url=SHIFT;await assert.rejects(open(f.event,'shift'),/UNTRUSTED_SENDER/);
  assert.deepEqual(f.calls,[SHIFT]);
  const failed=await mainFixture({externalFailure:true}),result=await failed.handlers.get('synk:open-portal-purpose')(failed.event,'shift');
  assert.equal(result.ok,false);assert.equal(result.code,'PORTAL_PURPOSE_OPEN_FAILED');assert.deepEqual(failed.calls,[SHIFT]);
});

test('main refuses SHIFT for sibling clients, smoke runs and an unavailable sign-in suite before the browser',async()=>{
  for(const clientId of ['world','messenger']){const f=await mainFixture({clientId});assert.equal((await f.handlers.get('synk:open-portal-purpose')(f.event,'shift')).code,'PORTAL_PURPOSE_UNAVAILABLE',clientId);assert.equal(f.calls.length,0);}
  const smoke=await mainFixture({argv:['--synk-smoke']});assert.equal((await smoke.handlers.get('synk:open-portal-purpose')(smoke.event,'shift')).code,'PORTAL_PURPOSE_UNAVAILABLE');assert.equal(smoke.calls.length,0);
  const locked=await mainFixture({suite:'unavailable'});assert.equal((await locked.handlers.get('synk:open-portal-purpose')(locked.event,'shift')).code,'SUITE_UNAVAILABLE');assert.equal(locked.calls.length,0);
  const ready=await mainFixture({suite:'available'});assert.equal((await ready.handlers.get('synk:open-portal-purpose')(ready.event,'shift')).ok,true);assert.deepEqual(ready.calls,[SHIFT]);
});

test('main hands the invite IPC input to PULSE unchanged from the platform window only, and keeps the zero-argument opening',async()=>{
  const f=await mainFixture(),invite=f.handlers.get('synk:pulse-app-open-invite'),input={token:TOKEN,requestId:randomUUID(),accountGeneration:randomUUID()};
  assert.equal((await invite(f.event,input,'https://evil.invalid/')).ok,true);
  assert.equal(f.pulseCalls.length,1);assert.equal(f.pulseCalls[0].length,2);assert.equal(f.pulseCalls[0][0],'openInvite');assert.equal(f.pulseCalls[0][1],input);
  await f.handlers.get('synk:pulse-app-open')(f.event,'https://evil.invalid/',input);assert.deepEqual(f.pulseCalls[1],['open']);
  for(const event of [{...f.event,sender:{}},{...f.event,senderFrame:{url:PLATFORM_ENTRY}},{...f.event,senderFrame:null}])await assert.rejects(invite(event,input),/UNTRUSTED_SENDER/);
  f.frame.url=SHIFT;await assert.rejects(invite(f.event,input),/UNTRUSTED_SENDER/);assert.equal(f.pulseCalls.length,2);
  for(const clientId of ['world','messenger']){const g=await mainFixture({clientId});assert.equal((await g.handlers.get('synk:pulse-app-open-invite')(g.event,input)).code,'PULSE_APP_UNAVAILABLE',clientId);assert.equal(g.pulseCalls.length,0);}
  const smoke=await mainFixture({argv:['--synk-smoke']});assert.equal((await smoke.handlers.get('synk:pulse-app-open-invite')(smoke.event,input)).code,'PULSE_APP_UNAVAILABLE');assert.equal(smoke.pulseCalls.length,0);
  const locked=await mainFixture({suite:'unavailable'});assert.equal((await locked.handlers.get('synk:pulse-app-open-invite')(locked.event,input)).code,'SUITE_UNAVAILABLE');assert.equal(locked.pulseCalls.length,0);
});
