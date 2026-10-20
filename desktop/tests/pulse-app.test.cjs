'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createPulseApp,pulseAppPartition,pulseAppNavigationAllowed,pulseAppResourceAllowed,pulseAppRequestAllowed,pulseAppMediaAllowed,pulseAppExternalDestination,PULSE_APP_ORIGIN:ORIGIN,PULSE_APP_ENTRY:ENTRY,PULSE_STAFF_ENTRY:STAFF,PULSE_DEMO_ENTRY:DEMO}=require('../src/pulse-app.cjs');
const guest={signedIn:false,status:'signed-out'},member=id=>({signedIn:true,status:'signed-in',account:{synk_user_id:id},accessToken:'SYNTHETIC-PRIVATE-TOKEN'});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({state=member('synthetic-owner-a'),clientId='platform',load=()=>Promise.resolve(),sessions=new Map()}={}){
  const windows=[],external=[],partitions=[];let current=state;
  class Window extends EventEmitter{
    constructor(options){super();this.options=options;this.destroyed=false;this.shown=0;this.focused=0;this.webContents=new EventEmitter();Object.assign(this.webContents,{getURL:()=>this.url,setWindowOpenHandler:handler=>{this.popup=handler;},downloadURL:url=>{this.download=url;}});windows.push(this);}
    loadURL(url){this.url=url;return load(this);}
    isDestroyed(){return this.destroyed;}isMinimized(){return !!this.minimized;}restore(){this.minimized=false;this.restored=true;}show(){this.shown++;}focus(){this.focused++;}destroy(){this.destroyed=true;this.emit('closed');}
  }
  const session={fromPartition(partition){partitions.push(partition);if(!sessions.has(partition)){const value=new EventEmitter();Object.assign(value,{partition,cleared:0,cacheCleared:0,setPermissionRequestHandler(fn){this.permission=fn;},setPermissionCheckHandler(fn){this.permissionCheck=fn;},webRequest:{onBeforeRequest(_filter,handler){value.request=handler;}},async clearStorageData(){this.cleared++;},async clearCache(){this.cacheCleared++;}});sessions.set(partition,value);}return sessions.get(partition);}};
  const service=createPulseApp({clientId,getAccount:()=>current,BrowserWindow:Window,session,openExternal:async url=>external.push(url),getDownloads:()=>'/synthetic/downloads',loadTimeoutMs:250});
  return {service,windows,external,partitions,sessions,setAccount(value){current=value;service.syncContext(value);},get latestSession(){return sessions.get(partitions.at(-1));}};
}
test('only fixed PULSE shell, its demo entry, customer API and public assets load inside the remote window',()=>{
  assert.equal(DEMO,ENTRY+'?demo=coffee');
  for(const value of [ENTRY,ENTRY+'#invite=SYNTHETIC',ENTRY+'#models',DEMO,DEMO+'#guide'])assert.equal(pulseAppNavigationAllowed(value),true,value);
  for(const value of [STAFF,ORIGIN+'/messenger/',ORIGIN+'/api/login',ENTRY+'?token=x',DEMO+'&token=x',ENTRY+'?token=x&demo=coffee',ENTRY+'?demo=tea',ORIGIN+'/messenger/?demo=coffee','http://workspace.synk.im/pulse-app/','http://workspace.synk.im/pulse-app/?demo=coffee','https://workspace.synk.im.evil/pulse-app/','https://user@workspace.synk.im/pulse-app/','file:///pulse-app/'])assert.equal(pulseAppNavigationAllowed(value),false,value);
  for(const value of [ENTRY+'app.js',ORIGIN+'/pulse/api/project',ORIGIN+'/pulse/api/studio/media/00000000-0000-4000-8000-000000000001',ORIGIN+'/messenger/assets/font.woff2',ORIGIN+'/font.woff2'])assert.equal(pulseAppResourceAllowed(value),true,value);
  for(const value of [ORIGIN+'/api/login',ORIGIN+'/messenger/',ORIGIN+'/pulse/',ORIGIN+'/pulse-app/../api/login','https://evil.invalid/font.woff2','http://workspace.synk.im/pulse/api/project'])assert.equal(pulseAppResourceAllowed(value),false,value);
});
test('staff mode goes only to the exact browser link, never the customer cookie jar',()=>{
  assert.equal(pulseAppExternalDestination(STAFF),STAFF);
  for(const value of [STAFF+'&x=1',STAFF+'#x',ORIGIN+'/api/login',ORIGIN+'/messenger/',ENTRY,'javascript:alert(1)','file:///secret'])assert.equal(pulseAppExternalDestination(value),null);
  assert.equal(pulseAppExternalDestination('https://synk.im/portfolio/'),'https://synk.im/portfolio/');
});
test('external HTTPS references allow only image/media from the PULSE origin, never scripts, frames or fetch',()=>{
  const request={url:'https://reference.invalid/photo.webp',referrer:ENTRY,initiatorOrigin:ORIGIN};
  for(const resourceType of ['image','media'])assert.equal(pulseAppRequestAllowed({...request,resourceType}),true);
  for(const resourceType of ['script','stylesheet','font','mainFrame','subFrame','xhr','ping','webSocket','other'])assert.equal(pulseAppRequestAllowed({...request,resourceType}),false,resourceType);
  for(const override of [{referrer:''},{referrer:'https://evil.invalid/'},{initiatorOrigin:'https://evil.invalid'},{url:'http://reference.invalid/a.png'},{url:'https://user:pass@reference.invalid/a.png'},{url:ORIGIN+'/api/login'}])assert.equal(pulseAppRequestAllowed({...request,resourceType:'image',...override}),false);
  assert.equal(pulseAppRequestAllowed({url:ENTRY,resourceType:'subFrame'}),false);
  assert.equal(pulseAppRequestAllowed({url:ORIGIN+'/pulse/api/project',resourceType:'mainFrame'}),false);
  assert.equal(pulseAppRequestAllowed({url:DEMO,resourceType:'mainFrame'}),true);
});
test('persistent partition is deterministic per owner without exposing account IDs or tokens',()=>{
  assert.match(pulseAppPartition('account:synthetic-owner-a'),/^persist:synk-pulse-app-[a-f0-9]{40}$/);
  assert.notEqual(pulseAppPartition('account:synthetic-owner-a'),pulseAppPartition('account:synthetic-owner-b'));
  assert.notEqual(pulseAppPartition('guest'),pulseAppPartition('account:synthetic-owner-a'));
  assert.doesNotMatch(pulseAppPartition('account:synthetic-owner-a'),/synthetic-owner/);
});
test('opening creates an independent sandboxed window and waits for loading, with duplicate opens joined',async()=>{
  let done;const f=fixture({load:()=>new Promise(resolve=>{done=resolve;})});let completed=false;
  const first=f.service.open();first.then(()=>{completed=true;});assert.equal(f.service.open(),first);await tick();
  const w=f.windows[0];assert.equal(w.shown,0);assert.equal(completed,false);assert.equal(w.url,ENTRY);
  assert.equal(w.options.parent,undefined);assert.equal(w.options.webPreferences.preload,undefined);
  for(const key of ['sandbox','contextIsolation','webSecurity'])assert.equal(w.options.webPreferences[key],true);
  for(const key of ['nodeIntegration','nodeIntegrationInWorker','nodeIntegrationInSubFrames','webviewTag','allowRunningInsecureContent','experimentalFeatures','devTools'])assert.equal(w.options.webPreferences[key],false);
  assert.doesNotMatch(JSON.stringify(w.options),/SYNTHETIC-PRIVATE-TOKEN|synthetic-owner-a/);
  done();assert.equal((await first).ok,true);assert.equal(w.shown,1);assert.equal(w.focused,1);
  w.minimized=true;assert.equal((await f.service.open()).reused,true);assert.equal(w.restored,true);assert.equal(f.windows.length,1);
});
test('closing or quitting preserves only this owner customer session for reopening',async()=>{
  const sessions=new Map(),f=fixture({sessions});await f.service.open();const old=f.latestSession,key=f.partitions[0];
  f.windows[0].destroy();await f.service.open();assert.equal(f.latestSession,old);assert.equal(old.cleared,0);
  f.service.dispose();assert.equal(old.cleared,0);assert.equal((await f.service.open()).code,'PULSE_APP_UNAVAILABLE');
  const reopened=fixture({sessions});await reopened.service.open();assert.equal(reopened.partitions[0],key);assert.equal(reopened.latestSession,old);
});
test('account switching closes the old app and clears its cookies/storage before opening a new scope',async()=>{
  const f=fixture();await f.service.open();const a=f.windows[0],aSession=f.latestSession,aPartition=f.partitions[0];
  f.setAccount(member('synthetic-owner-b'));assert.equal(a.destroyed,true);await f.service.open();
  assert.equal(aSession.cleared,1);assert.equal(aSession.cacheCleared,1);assert.notEqual(f.partitions[1],aPartition);
  const b=f.windows[1],bSession=f.latestSession;f.setAccount(guest);assert.equal(b.destroyed,true);await f.service.open();assert.equal(bSession.cleared,1);assert.equal(f.partitions[2],pulseAppPartition('guest'));
});
test('an account change while loading cannot show the former customer project',async()=>{
  let done;const f=fixture({load:()=>new Promise(resolve=>{done=resolve;})});const opening=f.service.open();await tick();f.setAccount(member('synthetic-owner-b'));
  assert.equal(f.windows[0].destroyed,true);done();assert.equal((await opening).code,'PULSE_APP_ACCOUNT_CHANGED');assert.equal(f.windows[0].shown,0);
});
test('logout also clears a persisted previous session before PULSE has opened in this process',async()=>{
  const f=fixture();f.setAccount(guest);await tick();const previous=f.sessions.get(pulseAppPartition('account:synthetic-owner-a'));assert.equal(previous.cleared,1);assert.equal(f.windows.length,0);
});
test('failed old-account storage cleanup blocks reopening until cleanup succeeds',async()=>{
  const f=fixture();await f.service.open();const old=f.latestSession;old.clearStorageData=async()=>{throw Error('synthetic storage lock');};f.setAccount(member('synthetic-owner-b'));
  assert.equal((await f.service.open()).code,'PULSE_APP_STORAGE_UNAVAILABLE');assert.equal(f.windows.length,1);
  old.clearStorageData=async()=>{old.cleared++;};assert.equal((await f.service.open()).ok,true);assert.equal(old.cleared,1);assert.equal(f.windows.length,2);
});
test('network and HTTP failures never claim successful opening and can be retried',async()=>{
  let attempts=0;const f=fixture({load:window=>{attempts++;if(attempts===1)throw Error('SYNTHETIC SECRET URL');if(attempts===2)window.webContents.emit('did-navigate',{},ENTRY,503,'Unavailable');return Promise.resolve();}});
  for(let i=0;i<2;i++){const result=await f.service.open();assert.deepEqual(result,{ok:false,code:'PULSE_APP_OPEN_FAILED'});assert.equal(f.windows[i].destroyed,true);assert.equal(f.windows[i].shown,0);}
  assert.equal((await f.service.open()).ok,true);
});
test('unresolved accounts and non-platform clients cannot create a remote window',async()=>{
  const waiting=fixture({state:{status:'restoring',signedIn:false}});assert.equal((await waiting.service.open()).code,'PULSE_APP_ACCOUNT_PENDING');assert.equal(waiting.windows.length,0);
  for(const clientId of ['messenger','world']){const f=fixture({clientId});assert.equal((await f.service.open()).code,'PULSE_APP_UNAVAILABLE');assert.equal(f.windows.length,0);}
});
test('requests, popup, redirects and webviews stay inside their allowed boundaries',async()=>{
  const f=fixture();await f.service.open();const w=f.windows[0],s=f.latestSession;let answer;
  s.request({url:ORIGIN+'/api/login'},value=>{answer=value;});assert.equal(answer.cancel,true);s.request({url:ENTRY+'app.js'},value=>{answer=value;});assert.equal(answer.cancel,false);
  s.permission(null,'media',value=>{answer=value;});assert.equal(answer,false);assert.equal(s.permissionCheck(),false);
  assert.equal(w.popup({url:STAFF}).action,'deny');await tick();assert.deepEqual(f.external,[STAFF]);
  let prevented=0;const event={preventDefault(){prevented++;}};w.webContents.emit('will-redirect',event,'https://evil.invalid/');w.webContents.emit('will-attach-webview',event);w.webContents.emit('will-navigate',event,ORIGIN+'/messenger/');assert.equal(prevented,3);assert.deepEqual(f.external,[STAFF]);
  w.webContents.emit('will-navigate',event,DEMO);w.webContents.emit('will-navigate',event,ENTRY);await tick();assert.equal(prevented,3);assert.deepEqual(f.external,[STAFF]);
});
test('downloads accept only customer media routes, safe MIME and bounded size',async()=>{
  const id='00000000-0000-4000-8000-000000000001';for(const prefix of ['/pulse/api/media/','/pulse/api/studio/media/'])assert.equal(pulseAppMediaAllowed(ORIGIN+prefix+id),true);
  for(const value of [ORIGIN+'/api/media/'+id,ORIGIN+'/pulse/api/media/'+id+'?x=1',ORIGIN+'/pulse/api/media/not-id','https://evil.invalid/pulse/api/media/'+id])assert.equal(pulseAppMediaAllowed(value),false);
  const f=fixture();await f.service.open();const w=f.windows[0],s=f.latestSession;let prevented=0,options;const event={preventDefault(){prevented++;}};
  const item=new EventEmitter();Object.assign(item,{getURL:()=>ORIGIN+'/pulse/api/studio/media/'+id,getMimeType:()=> 'image/png',getTotalBytes:()=>1024,getReceivedBytes:()=>1024,getFilename:()=> 'preview.png',setSaveDialogOptions:value=>{options=value;},cancel(){this.cancelled=true;}});
  s.emit('will-download',event,item,w.webContents);assert.equal(prevented,0);assert.match(options.defaultPath,/preview\.png$/);
  s.emit('will-download',event,item,{});assert.equal(prevented,1);item.getTotalBytes=()=>101*1024*1024;item.emit('updated');assert.equal(item.cancelled,true);
});
test('preload exposes only a zero-argument fixed PULSE operation',async()=>{
  let bridge;const calls=[];vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>{bridge=value;}},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return {ok:true};}}})});
  await bridge.openPulseApp('https://evil.invalid/',{token:'SYNTHETIC'});assert.deepEqual(calls,[['synk:pulse-app-open']]);
});
