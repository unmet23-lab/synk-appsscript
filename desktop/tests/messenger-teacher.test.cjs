'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {createMessengerTeacherService,bindMessengerTeacherIPC,sendMessengerTeacherAuth,messengerViewEntry}=require('../src/messenger-teacher.cjs');
const {configuration}=require('../src/auth-config.cjs');
const {createSuiteFollower}=require('../src/suite-session.cjs');
const {DEV_URLS}=require('../src/catalog.cjs');
const raw={version:1,supabaseUrl:'https://synthetic.invalid',supabasePublishableKey:'sb_publishable_synthetic',clients:{messenger:{clientId:'messenger-only',redirectUri:'http://127.0.0.1:43823/synk/oauth/messenger/callback'},teacher:{clientId:'teacher-only',redirectUri:'http://127.0.0.1:43824/synk/oauth/teacher/callback'}}};
function fixture(overrides={}){
  const calls=[],stores=[],auths=[],config=configuration(raw,'teacher','development');
  const options={config,directory:path.resolve('/synthetic/Teacher'),scope:'im.synk.messenger.preview.teacher',safeStorage:{},openExternal:()=>{},appVersion:'0.4.0',
    createTokenStore:options=>{stores.push(options);return {available:()=>true};},
    createAuthService:options=>{const auth={initialize:async()=>calls.push(['initialize']),status:()=>({configured:true,signedIn:true,status:'signed-in',account:{synk_user_id:'teacher-a'}}),signIn:async()=>calls.push(['in']),cancel:async()=>calls.push(['cancel']),signOut:async()=>calls.push(['out']),accountRequest:async(...args)=>{calls.push(['request',...args]);return {ok:true};},dispose:()=>calls.push(['dispose'])};auths.push({options,auth});return auth;},
    createSuiteFollower,...overrides};
  return {calls,stores,auths,config,service:createMessengerTeacherService(options)};
}
test('embedded teacher auth uses its own teacher client, world API product and encrypted vault',async()=>{
  const f=fixture();assert.equal(f.stores[0].scope,'im.synk.messenger.preview.teacher');assert.equal(path.basename(f.stores[0].directory),'Teacher');
  assert.equal(f.auths[0].options.config.clientId,'teacher-only');assert.equal(f.auths[0].options.config.clientKey,'teacher');assert.equal(f.auths[0].options.config.product,'world');
  assert.notEqual(f.auths[0].options.config.fingerprint,configuration(raw,'messenger','development').fingerprint);
  await f.service.initialize();assert.deepEqual(f.calls,[['initialize']]);assert.equal(f.service.authStatus().account.synk_user_id,'teacher-a');
  for(const method of ['authSignIn','authCancelSignIn','authSignOut'])await f.service[method]();
  f.service.dispose();assert.deepEqual(f.calls.slice(1).map(row=>row[0]),['in','cancel','out','dispose']);
});
test('embedded teacher broker reuses teacher-only allowlist and never forwards learner or company APIs',async()=>{
  const f=fixture();for(const operation of ['classes','workspace','assignments','assignmentUpdate','assignmentCancel','observations'])assert.equal((await f.service.accountRequest('classroom',{operation})).ok,true);
  const count=f.calls.length;
  for(const operation of ['load','release','updateProfile','revokeSession','revokeAll','requestDeletion','exportPage','companyRequest','learningGet','learningPost','memoryGet','memoryPost','playMutate','atlasSummary','admin','__proto__'])assert.equal((await f.service.accountRequest(operation)).error.code,'INVALID_REQUEST');
  for(const operation of ['student','submit','sharing','account','townCommand','learningPost'])assert.equal((await f.service.accountRequest('classroom',{operation})).error.code,'INVALID_REQUEST');
  assert.equal(f.calls.length,count);
});
function binding(){
  const handlers=new Map(),ipcMain={removeHandler:k=>handlers.delete(k),handle:(k,v)=>handlers.set(k,v)},frame={url:'http://127.0.0.1:4191/?tab=teaching'},contents={mainFrame:frame,getURL:()=>frame.url,send:(...args)=>sent.push(args)},sent=[];
  const window={webContents:contents,isDestroyed:()=>false},f=fixture(),remove=bindMessengerTeacherIPC({ipcMain,getWindow:()=>window,service:f.service,entry:DEV_URLS.messenger,clientId:'messenger',environment:{mode:'development'}});
  return {handlers,frame,contents,sent,window,f,remove,event:{sender:contents,senderFrame:frame}};
}
test('teacher IPC accepts only Messenger root top frame and rejects sibling, child, WORLD and foreign origins',async()=>{
  const b=binding(),request=b.handlers.get('synk:teacher-account-request');
  assert.equal((await request(b.event,'classroom',{operation:'classes'})).ok,true);
  assert.deepEqual(await b.handlers.get('synk:teacher-environment')(b.event),{mode:'development',clientId:'teacher',authProduct:'world',embedded:true,hostClientId:'messenger'});
  for(const event of [{...b.event,sender:{}},{...b.event,senderFrame:{url:b.frame.url}},{...b.event,senderFrame:null}])await assert.rejects(request(event,'load'),/UNTRUSTED_SENDER/);
  for(const url of ['http://127.0.0.1:4191/teacher-world/?account=1','http://127.0.0.1:4280/synk-account/teacher.html','https://foreign.invalid/','http://user@127.0.0.1:4191/']){b.frame.url=url;await assert.rejects(request(b.event,'load'),/UNTRUSTED_SENDER/);}
  assert.equal(b.f.calls.length,1);b.remove();assert.equal(b.handlers.size,0);
});
test('teacher auth updates stay on trusted Messenger root and non-Messenger clients receive no teacher handlers',()=>{
  const b=binding(),state={signedIn:true,account:{synk_user_id:'teacher-a'}};sendMessengerTeacherAuth(b.window,state,DEV_URLS.messenger,'messenger');assert.deepEqual(b.sent,[['synk:teacher-auth-changed',state]]);
  b.frame.url='http://127.0.0.1:4191/teacher-world/?account=1';sendMessengerTeacherAuth(b.window,state,DEV_URLS.messenger,'messenger');assert.equal(b.sent.length,1);
  b.frame.url=DEV_URLS.messenger;sendMessengerTeacherAuth(b.window,state,DEV_URLS.messenger,'world');assert.equal(b.sent.length,1);
  const handlers=[];bindMessengerTeacherIPC({ipcMain:{handle:k=>handlers.push(k)},clientId:'platform'});assert.deepEqual(handlers,[]);
});
test('fixed teaching view changes only Messenger root; raw URLs and other views cannot redirect the app',()=>{
  const entry=DEV_URLS.messenger;assert.equal(messengerViewEntry(entry,'messenger',['--view=teaching']),'http://127.0.0.1:4191/?tab=teaching');
  for(const args of [[],['--view=https://foreign.invalid/'],['--view=admin'],['--view=teaching&token=x']])assert.equal(messengerViewEntry(entry,'messenger',args),entry);
  assert.equal(messengerViewEntry(entry,'world',['--view=teaching']),entry);assert.equal(messengerViewEntry('https://synthetic.invalid/other/','messenger',['--view=teaching']),'https://synthetic.invalid/other/');
});
test('preload provides frozen teacher-only adapter and keeps events separate from company auth',async()=>{
  let bridge;const calls=[],listeners=new Map();const ipcRenderer={invoke:async(...args)=>{calls.push(args);return {ok:true};},on:(k,v)=>listeners.set(k,v),removeListener:(k,v)=>{assert.equal(listeners.get(k),v);listeners.delete(k);}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_name,v)=>{bridge=v;}},ipcRenderer})});
  assert.equal(Object.isFrozen(bridge.teacher),true);assert.deepEqual(Object.keys(bridge.teacher).sort(),['accountRequest','authCancelSignIn','authSignIn','authSignOut','authStatus','getEnvironment','onAuthChanged']);
  await bridge.teacher.getEnvironment();await bridge.teacher.accountRequest('classroom',{operation:'classes'});assert.deepEqual(calls.map(row=>row[0]),['synk:teacher-environment','synk:teacher-account-request']);
  const states=[],views=[],off=bridge.teacher.onAuthChanged(state=>states.push(state)),offView=bridge.onOpenView(view=>views.push(view));
  listeners.get('synk:teacher-auth-changed')({},'teacher-state');listeners.get('synk:open-view')({},'teaching');assert.deepEqual(states,['teacher-state']);assert.deepEqual(views,['teaching']);off();offView();assert.equal(listeners.size,0);
  assert.throws(()=>bridge.teacher.onAuthChanged(null),/callback is required/);
});
test('teacher follows Platform account selection with its own verification and never copies Messenger tokens',async()=>{
  let selected={status:'signed-in',accountId:'teacher-a',generation:'first'},state={configured:true,status:'signed-in',signedIn:true,account:{synk_user_id:'teacher-a'}};const calls=[];
  const auth={bindPlatform:next=>{calls.push(['bind',next.accountId]);state={...state,signedIn:state.signedIn&&state.account?.synk_user_id===next.accountId};},initialize:async()=>calls.push(['verify-own-vault']),status:()=>state,signOut:async()=>{calls.push(['clear-own-vault']);state={status:'signed-out',signedIn:false};},signIn:async()=>calls.push(['teacher-oauth']),accountRequest:async()=>({ok:true}),dispose(){}};
  let follower;const f=fixture({suiteStore:{read:()=>selected},createAuthService:()=>auth,createSuiteFollower:options=>{follower=createSuiteFollower({...options,schedule:()=>1,unschedule:()=>{}});return follower;}});
  await f.service.initialize();assert.deepEqual(calls,[['bind','teacher-a'],['verify-own-vault']]);
  selected={status:'signed-in',accountId:'teacher-b',generation:'second'};await follower.refresh();assert.deepEqual(calls.slice(-4),[['bind','teacher-b'],['verify-own-vault'],['clear-own-vault'],['teacher-oauth']]);f.service.dispose();
});

async function mainFixture({argv=['--view=teaching'],authConfig=raw}={}){
  const entry=messengerViewEntry(DEV_URLS.messenger,'messenger',argv),runtime={clientId:'messenger',mode:'development',entry:DEV_URLS.messenger,auth:authConfig};
  const app=new EventEmitter(),handlers=new Map(),calls=[],stores=[],auths=[],frame={url:entry},sent=[],loaded=[];let window;
  Object.assign(app,{isPackaged:true,enableSandbox(){},setName(){},setPath(){},getPath:name=>name==='home'?'C:\\Users\\synthetic':'C:\\synthetic\\messenger',getAppPath:()=>'/synthetic/app',getVersion:()=> '0.4.0',setAppUserModelId(){},requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve()});
  const contents=new EventEmitter();Object.assign(contents,{mainFrame:frame,getURL:()=>frame.url,setWindowOpenHandler(){},send:(...args)=>sent.push(args)});
  class Window extends EventEmitter{constructor(){super();this.webContents=contents;window=this;}isDestroyed(){return false;}isMinimized(){return false;}show(){}focus(){}}
  const ownSession={setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onHeadersReceived(){}},removeAllListeners(){},on(){},protocol:{handle(){}}};
  const noop=()=>({});
  const stubs={
    electron:{app,BrowserWindow:Window,ipcMain:{removeHandler:k=>handlers.delete(k),handle:(k,v)=>handlers.set(k,v)},session:{fromPartition:()=>ownSession},protocol:{registerSchemesAsPrivileged(){}},Menu:{setApplicationMenu(){}},shell:{openExternal:()=>{throw Error('No external navigation allowed');}},dialog:{},safeStorage:{}},
    'node:fs':{readFileSync:()=>JSON.stringify(runtime)},'node:child_process':{spawn(){throw Error('No process allowed');}},
    './auth-config-path.cjs':{resolveAuthConfigPath:()=>null},
    './auth-store.cjs':{createTokenStore:options=>{stores.push(options);return {scope:options.scope,available:()=>true};}},
    './auth-service.cjs':{createAuthService:options=>{const auth={initialize:async()=>{},status:()=>({configured:!!options.config,status:options.config?'signed-in':'unconfigured',signedIn:!!options.config,account:options.config?{synk_user_id:options.config.clientKey==='teacher'?'teacher-a':'company-b'}:null}),accountRequest:async(...args)=>{calls.push([options.config?.clientKey||'messenger',...args]);return {ok:true};},signIn:async()=>{},cancel:async()=>{},signOut:async()=>({ok:true}),dispose(){}};auths.push({options,auth});return auth;},publicError:noop},
    './suite-session.cjs':{suiteKey:()=> 'synthetic-suite',createSuiteStore:()=>({}),createSuiteFollower:()=>({start:async()=>{},dispose(){}})},
    './client-lifecycle.cjs':{createClientLifecycle:()=>({getClients:async()=>[],dispose(){}})},'./teacher-preview.cjs':{createTeacherPreview:()=>({available:()=>false})},'./product-preview.cjs':{createProductPreviews:()=>({available:()=>[]})},
    './company-requests.cjs':{createCompanyRequests:()=>()=>{throw Error('No company request allowed');}},'./downloads.cjs':{createDownloadHandler:noop},
    './native-content.cjs':{createNativeContent:noop},'./connection-content.cjs':{createConnectionContent:noop},'./connection-recovery.cjs':{createConnectionRecovery:options=>({connect:async()=>loaded.push(options.entry),retryIfDisconnected:async()=>{},dispose(){}})},
  };
  const filename=path.join(__dirname,'../src/main.cjs');
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:id=>Object.hasOwn(stubs,id)?stubs[id]:id.startsWith('./')?require(path.join(__dirname,'../src',id)):require(id),__dirname:path.dirname(filename),process:{argv,platform:'win32',arch:'x64',env:{},resourcesPath:'/synthetic/resources'},console,Buffer,setTimeout,clearTimeout},{filename});
  await new Promise(resolve=>setImmediate(resolve));
  return {app,handlers,calls,stores,auths,frame,contents,sent,loaded,window,event:{sender:contents,senderFrame:frame}};
}
test('actual Messenger main wires separate teacher auth and teaching route without touching company access',async()=>{
  const f=await mainFixture();assert.deepEqual(f.loaded,['http://127.0.0.1:4191/?tab=teaching']);assert.equal(f.stores.length,2);
  assert.equal(f.stores[0].scope,'im.synk.messenger.preview');assert.equal(f.stores[1].scope,'im.synk.messenger.preview.teacher');assert.notEqual(f.stores[0].directory,f.stores[1].directory);
  assert.equal(f.auths[0].options.config.product,'messenger');assert.equal(f.auths[1].options.config.clientKey,'teacher');assert.equal(f.auths[1].options.config.product,'world');
  assert.equal((await f.handlers.get('synk:teacher-auth-status')(f.event)).account.synk_user_id,'teacher-a');
  assert.equal((await f.handlers.get('synk:auth-status')(f.event)).account.synk_user_id,'company-b');
  await f.handlers.get('synk:teacher-account-request')(f.event,'classroom',{operation:'classes'});assert.deepEqual(f.calls,[['teacher','classroom',{operation:'classes'}]]);
  assert.equal((await f.handlers.get('synk:teacher-account-request')(f.event,'memoryGet')).error.code,'INVALID_REQUEST');
  const before=f.sent.length;f.app.emit('second-instance',{},['--view=teaching']);assert.deepEqual(f.sent.slice(before),[['synk:open-view','teaching']]);
  f.app.emit('second-instance',{},['--view=https://foreign.invalid/']);assert.equal(f.sent.length,before+1);
  f.frame.url='synk-desktop://status/index.html';f.app.emit('second-instance',{},['--view=teaching']);assert.equal(f.sent.length,before+1);
  f.frame.url='http://127.0.0.1:4191/?tab=messenger';f.contents.emit('did-finish-load');assert.deepEqual(f.sent.at(-1),['synk:open-view','teaching']);assert.equal(f.sent.length,before+2);f.app.emit('will-quit');
});
test('teacher-only configured Messenger starts teaching with company auth unconfigured and unchanged',async()=>{
  const f=await mainFixture({authConfig:{...raw,clients:{teacher:raw.clients.teacher}}});
  assert.equal((await f.handlers.get('synk:auth-status')(f.event)).configured,false);assert.equal((await f.handlers.get('synk:teacher-auth-status')(f.event)).configured,true);
  assert.equal((await f.handlers.get('synk:teacher-environment')(f.event)).hostClientId,'messenger');assert.deepEqual(f.calls,[]);f.app.emit('will-quit');
});
