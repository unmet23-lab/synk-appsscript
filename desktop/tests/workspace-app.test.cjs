'use strict';
// 검정 구 4단계 구현 설계 3.2 · 3.4 · 4절: 플랫폼 창 안의 Workspace 관리자. 가짜 겉(뷰 자리의 겉과 같은 이름)과 가짜 세션으로 본다.
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{createHash}=require('node:crypto'),path=require('node:path');
const {createWorkspaceApp,workspaceScopeOf,workspaceAppPartition,workspaceNavigationAllowed,workspaceRequestAllowed,workspaceExternalDestination,workspaceFrame,WORKSPACE_ORIGIN:ORIGIN,WORKSPACE_ENTRY:ENTRY,WORKSPACE_VIEW_PRELOAD,WORKSPACE_BACKGROUND,NATIVE_CHANNEL}=require('../src/workspace-app.cjs');
const {WORKSPACE_EXIT_TEXT}=require('../src/draft-exit.cjs');

const SRC=path.join(__dirname,'..','src');
const A='synthetic-owner-a',B='synthetic-owner-b',U='00000000-0000-4000-8000-00000000000a';
const guest={signedIn:false,status:'signed-out',account:null,error:null},restoring={signedIn:false,status:'restoring'};
const member=id=>({signedIn:true,status:'signed-in',account:{synk_user_id:id},accessToken:'SYNTHETIC-PRIVATE-TOKEN'});
const PENDING={ok:false,code:'WORKSPACE_APP_ACCOUNT_PENDING'},UNAVAILABLE={ok:false,code:'WORKSPACE_APP_UNAVAILABLE'},FAILED={ok:false,code:'WORKSPACE_APP_OPEN_FAILED'},CHANGED={ok:false,code:'WORKSPACE_APP_ACCOUNT_CHANGED'};
const SOURCE=Object.freeze({id:'screen:1:0',name:'합성 화면 1'});
const tick=()=>new Promise(resolve=>setImmediate(resolve)),settle=async()=>{for(let i=0;i<8;i++)await tick();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
// 손으로 움직이는 시계. 시한 시험이 바쁜 실행과 겨루지 않는다
function manualClock(){let next=1;const due=new Map();return {setTimeout(fn){const id=next++;due.set(id,fn);return {id,unref(){}};},clearTimeout(handle){if(handle)due.delete(handle.id);},fire(){const fns=[...due.values()];due.clear();for(const fn of fns)fn();},get pending(){return due.size;}};}
const preventable=(extra={})=>({defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra});

// Electron의 주 프레임(WebFrameMain)처럼 top이 자기 자신이다. 새 문서는 새 주 프레임이다
function frameAt(url,top=null){const frame={url};frame.top=top||frame;return frame;}
function fakeContents(){
  const c=new EventEmitter();c.setMaxListeners(0);const handlers=new Map();
  Object.assign(c,{destroyed:false,url:'',mainFrame:null,audible:false,captured:false,sent:[],openHandler:null,handlers,
    ipc:{handle(channel,fn){assert.equal(handlers.has(channel),false,'one handler per channel: '+channel);handlers.set(channel,fn);}},
    setWindowOpenHandler(fn){this.openHandler=fn;},getURL(){return this.url;},isDestroyed(){return this.destroyed;},
    isCurrentlyAudible(){return this.audible;},isBeingCaptured(){return this.captured;},send(channel,value){this.sent.push([channel,value]);},
    navigate(url,{status=200}={}){this.mainFrame=frameAt(url);this.url=url;this.emit('did-navigate',{},url,status);},
    // history.replaceState · 해시 바꿈: 같은 문서(같은 주 프레임)에서 주소만 바뀐다
    inPage(url){this.mainFrame.url=url;this.url=url;this.emit('did-navigate-in-page',{},url,true);},
    // 처리기에 보내는 IPC. 기본은 이 겉의 주 프레임이 보낸 것이다
    call(channel,{sender=c,senderFrame=c.mainFrame}={},...args){return handlers.get(channel)({sender,senderFrame},...args);}});
  return c;
}
function fakeSession(partition,{preloadApi=true,preloadThrows=false}={}){
  const s=new EventEmitter();s.setMaxListeners(0);
  Object.assign(s,{partition,cleared:0,cacheCleared:0,preloads:[],fetches:[],counts:{permission:0,check:0,display:0,request:0,preload:0},
    setPermissionRequestHandler(fn){this.counts.permission++;this.permission=fn;},
    setPermissionCheckHandler(fn){this.counts.check++;this.permissionCheck=fn;},
    setDisplayMediaRequestHandler(fn){this.counts.display++;this.displayMedia=fn;},
    webRequest:{onBeforeRequest(filter,fn){s.counts.request++;s.requestFilter=filter;s.request=fn;}},
    async clearStorageData(){this.cleared++;},async clearCache(){this.cacheCleared++;},
    async fetch(url,options){this.fetches.push({url,options});return {ok:true,text:async()=>JSON.stringify({user:{id:'synthetic-staff',active:true}})};}});
  if(preloadApi)s.registerPreloadScript=function(spec){this.counts.preload++;if(preloadThrows)throw Error('합성 실패');this.preloads.push(spec);};
  return s;
}
function fixture({state=member(A),clientId='platform',platform='win32',status=200,load=()=>Promise.resolve(),visible=true,chooseShare=async()=>null,closeForExit=null,sessionOptions={},sessions=new Map(),native=null,timers=null,now=null,openExternal=null}={}){
  const surfaces=[],partitions=[],external=[],dialogs=[],answers=[],log=[],shares=[];let current=state,renewing=null,kept=0,shown=visible,clock=1e6;
  const parent=new EventEmitter();Object.assign(parent,{destroyed:false,isDestroyed(){return this.destroyed;}});
  class Surface extends EventEmitter{
    constructor(options){super();this.options=options;this.destroyed=false;this.shown=0;this.focused=0;this.restored=0;this.minimized=false;this.loads=[];this.webContents=fakeContents();surfaces.push(this);log.push('surface');}
    isDestroyed(){return this.destroyed;}
    destroy(){if(this.destroyed)return;this.destroyed=true;this.webContents.destroyed=true;this.emit('closed');}
    loadURL(url){this.loads.push(url);this.webContents.navigate(url,{status});return load(this,url);}
    show(){this.shown++;}focus(){this.focused++;}isMinimized(){return this.minimized;}restore(){this.minimized=false;this.restored++;}dialogParent(){return parent;}
  }
  const session={fromPartition(partition){partitions.push(partition);if(!sessions.has(partition))sessions.set(partition,fakeSession(partition,sessionOptions));return sessions.get(partition);}};
  const dialog={showMessageBoxSync(win,options){dialogs.push({win,options});return answers.length?answers.shift():0;},showMessageBox(win,options){dialogs.push({win,options,async:true});return Promise.resolve({response:0});}};
  const work=(name,value)=>(...args)=>{log.push([name,...args]);return value;};
  const nativeDefault={prepare:work('prepare'),status:work('status',{configured:true,signedIn:true,status:'signed-in'}),accountLoad:work('accountLoad',{ok:true,account:{display_name:'합성'}}),
    signIn:work('signIn',{status:'signing-in'}),cancelSignIn:work('cancelSignIn',{status:'signed-out'}),signOut:work('signOut',{ok:true}),
    companyRequest(jar){log.push(['companyRequest',jar]);return (operation,params)=>{log.push(['company',operation,params]);return {ok:true,operation};};}};
  const f={surfaces,partitions,external,dialogs,answers,log,shares,parent,sessions,get kept(){return kept;},
    get surface(){return surfaces.at(-1);},session(id){return sessions.get(workspaceAppPartition('account:'+id));},
    setAccount(value,{notify=true}={}){current=value;if(notify)f.app.syncContext(value);},
    renew(id){renewing=id;f.setAccount(restoring);},verified(value){renewing=null;f.setAccount(value);},
    setVisible(value){shown=value;}};
  f.app=createWorkspaceApp({clientId,platform,getAccount:()=>current,getRenewingAccount:()=>renewing,createSurface:options=>new Surface(options),
    ...(closeForExit?{closeSurfaceForExit:()=>closeForExit(f)}:{}),isSurfaceVisible:()=>shown,session,dialog,
    openExternal:openExternal||(async url=>{external.push(url);}),getDownloads:()=>'/synthetic/downloads',native:native??nativeDefault,
    chooseShare:options=>{shares.push(options);return chooseShare(options);},onUnloadKept:()=>{kept++;},loadTimeoutMs:250,
    // 바깥 열기는 1.5초에 한 번이다. 따로 주지 않으면 부를 때마다 2초씩 간다
    now:now||(()=>clock+=2000),...(timers?{timers}:{})});
  return f;
}
const permit=(f,id,contents,permission,details)=>{let answer;f.session(id).permission(contents,permission,value=>{answer=value;},details);return answer;};
const checked=(f,id,contents,permission,origin,details)=>f.session(id).permissionCheck(contents,permission,origin,details);
function share(f,id,request){const got=[];f.session(id).displayMedia(request,value=>got.push(value));return got;}

test('the jar scope is a verified SYNK ID only; a guest, a restore, anonymous-local or an odd ID has no jar',()=>{
  assert.equal(workspaceScopeOf(member(A)),'account:'+A);assert.equal(workspaceScopeOf(member(U)),'account:'+U);
  for(const value of [undefined,null,{},guest,restoring,{signedIn:true,status:'restoring',account:{synk_user_id:A}},{signedIn:false,status:'signed-in',account:{synk_user_id:A}},{signedIn:true,status:'signed-in',account:null},{signedIn:'true',status:'signed-in',account:{synk_user_id:A}},
    member('anonymous-local'),member('../evil'),member(''),member('a b'),member('a'.repeat(121)),member(7),member(null)])
    assert.equal(workspaceScopeOf(value),null,JSON.stringify(value));
});
test('each account has its own persistent partition named from a hash, without the ID',()=>{
  const name=workspaceAppPartition('account:'+A);
  assert.match(name,/^persist:synk-workspace-app-[a-f0-9]{40}$/);
  assert.equal(name,'persist:synk-workspace-app-'+createHash('sha256').update('workspace-app-v1\0account:'+A).digest('hex').slice(0,40));
  assert.notEqual(name,workspaceAppPartition('account:'+B));assert.doesNotMatch(name,/synthetic-owner/);
});

test('open makes one sandboxed surface in this account\'s jar, loads the messenger entry and brings the platform window forward',async()=>{
  const f=fixture();const first=f.app.open();assert.equal(f.app.open(),first,'a second open joins the first');
  assert.deepEqual(await first,{ok:true,id:'workspace'});
  const s=f.surface,prefs=s.options.webPreferences;assert.equal(f.surfaces.length,1);
  assert.deepEqual(s.loads,[ENTRY]);assert.equal(ENTRY,'https://workspace.synk.im/?tab=messenger');
  assert.equal(s.options.backgroundColor,WORKSPACE_BACKGROUND);assert.equal(WORKSPACE_BACKGROUND,'#ffffff');
  assert.equal(prefs.session,f.session(A));assert.equal(prefs.preload,WORKSPACE_VIEW_PRELOAD);assert.equal(WORKSPACE_VIEW_PRELOAD,path.join(SRC,'workspace-view-preload.cjs'));
  for(const key of ['sandbox','contextIsolation','webSecurity'])assert.equal(prefs[key],true,key);
  for(const key of ['nodeIntegration','nodeIntegrationInWorker','nodeIntegrationInSubFrames','webviewTag','allowRunningInsecureContent','experimentalFeatures','devTools'])assert.equal(prefs[key],false,key);
  assert.doesNotMatch(JSON.stringify({...s.options,webPreferences:{...prefs,session:null}}),/SYNTHETIC-PRIVATE-TOKEN|synthetic-owner/);
  assert.deepEqual(f.log[0],['prepare'],'open prepares the native link before the surface');
  assert.equal(s.shown,1);assert.equal(s.focused,1);assert.equal(s.workspaceGuarded,true);assert.equal(f.app.hasSurface(),true);
  s.minimized=true;assert.deepEqual(await f.app.open(),{ok:true,id:'workspace',reused:true});
  assert.equal(s.restored,1);assert.equal(s.shown,2);assert.equal(s.focused,2);assert.equal(f.surfaces.length,1);assert.deepEqual(s.loads,[ENTRY]);
});
test('a guest or an unsettled account gets no surface; another client never opens one',async()=>{
  for(const state of [guest,restoring,member('anonymous-local'),member('../evil'),{signedIn:true,status:'restoring',account:{synk_user_id:A}}]){
    const f=fixture({state});assert.deepEqual(await f.app.open(),PENDING,JSON.stringify(state));assert.equal(f.surfaces.length,0);assert.deepEqual(f.partitions,[],'no jar for a guest');
  }
  for(const clientId of ['messenger','world','']){
    const f=fixture({clientId});assert.deepEqual(await f.app.open(),UNAVAILABLE);assert.equal(f.surfaces.length,0);assert.deepEqual(f.log,[],'nothing is prepared');
    assert.equal(await f.app.surfaceForInvite({status:'signed-in',expectedAccountId:A}),null);
  }
  const throwing=fixture({native:{prepare(){throw Error('합성');}}});assert.equal((await throwing.app.open()).ok,true,'a failing prepare does not stop the open');
});
test('an HTTP error, a failed or slow load, or a view lost while loading fails the open and closes that surface',async()=>{
  for(const status of [400,404,500,503]){const f=fixture({status});assert.deepEqual(await f.app.open(),FAILED,String(status));assert.equal(f.surface.destroyed,true);assert.equal(f.app.hasSurface(),false);}
  assert.equal((await fixture({status:399}).app.open()).ok,true);
  const rejected=fixture({load:()=>Promise.reject(Error('ERR_NAME_NOT_RESOLVED'))});assert.deepEqual(await rejected.app.open(),FAILED);assert.equal(rejected.surface.destroyed,true);
  const lost=fixture({load:s=>{s.destroy();return Promise.resolve();}});assert.deepEqual(await lost.app.open(),FAILED);
  const clock=manualClock(),slow=fixture({timers:clock,load:()=>new Promise(()=>{})});const opening=slow.app.open();await settle();
  assert.equal(clock.pending,1);clock.fire();assert.deepEqual(await opening,FAILED);assert.equal(slow.surface.destroyed,true);assert.equal(slow.app.hasSurface(),false);
  // 실패 뒤의 열기는 새 겉을 만든다. 끝난 열기의 시계는 남지 않는다
  const again=fixture({status:500});await again.app.open();assert.equal(again.surfaces.length,1);
  const ok=fixture();await ok.app.open();assert.equal(ok.app.hasSurface(),true);
});
test('an account change while loading closes the new surface and answers ACCOUNT_CHANGED',async()=>{
  const gate=deferred(),f=fixture({load:()=>gate.promise});const opening=f.app.open();await settle();const s=f.surface;
  f.setAccount(member(B));assert.equal(s.destroyed,true);gate.resolve();assert.deepEqual(await opening,CHANGED);assert.equal(f.app.hasSurface(),false);
});

test('another account, a sign-out or another account\'s renewal closes the surface and clears the old jar; a same-account renewal keeps both',async()=>{
  const f=fixture();await f.app.open();const s=f.surface,jar=f.session(A);
  f.renew(A);assert.equal(s.destroyed,false,'a same-account renewal keeps the view');await settle();assert.equal(jar.cleared,0);
  f.verified(member(A));assert.equal(s.destroyed,false);assert.equal((await f.app.open()).reused,true);
  f.setAccount(member(B));assert.equal(s.destroyed,true,'another account closes without asking');assert.deepEqual(f.dialogs,[]);
  await settle();assert.equal(jar.cleared,1);assert.equal(jar.cacheCleared,1);
  assert.equal((await f.app.open()).ok,true);const jarB=f.session(B);assert.equal(f.surface.options.webPreferences.session,jarB);assert.notEqual(jarB,jar);
  f.renew(A);assert.equal(f.surface.destroyed,true,'a renewal of another account is no renewal of this one');await settle();assert.equal(jarB.cleared,1);
  f.verified(member(B));await f.app.open();f.setAccount(guest);assert.equal(f.surface.destroyed,true);await settle();assert.equal(jarB.cleared,2);
  assert.deepEqual(await f.app.open(),PENDING);
  // 열지 않았어도 계정이 바뀌면 앞 계정의 통을 지운다
  const idle=fixture();idle.setAccount(guest);await settle();assert.equal(idle.session(A).cleared,1);assert.equal(idle.surfaces.length,0);
});
test('the jar gets its handlers and the company entry preload once, also when it was cleared and the same account comes back (검토 R7)',async()=>{
  const f=fixture();await f.app.open();const jar=f.session(A),once={permission:1,check:1,display:1,request:1,preload:1};
  assert.deepEqual(jar.counts,once);
  assert.deepEqual(jar.preloads,[{type:'frame',id:'synk-company-entry',filePath:path.join(SRC,'company-entry-preload.cjs')}]);
  assert.deepEqual(jar.requestFilter,{urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']});
  f.setAccount(guest);await settle();assert.equal(jar.cleared,1);
  f.setAccount(member(A));await f.app.open();assert.equal(f.surface.options.webPreferences.session,jar,'Electron gives the same session for the same partition');
  f.setAccount(member(B));await f.app.open();f.setAccount(member(A));await f.app.surfaceForInvite({status:'signed-in',expectedAccountId:A});
  assert.deepEqual(jar.counts,once);assert.equal(jar.preloads.length,1);
});

test('requests: the top document is the company / only, frames the company origin, scripts and workers the company origin, LiveKit and what the company page asks',()=>{
  const ref=ENTRY,cases=[
    [{resourceType:'mainFrame',url:ORIGIN+'/'},true],[{resourceType:'mainFrame',url:ENTRY},true],[{resourceType:'mainFrame',url:ORIGIN+'/?tab=social&section=inbox#x'},true],
    [{resourceType:'mainFrame',url:ORIGIN+'/messenger/'},false],[{resourceType:'mainFrame',url:ORIGIN+'/entry/'},false],[{resourceType:'mainFrame',url:'http://workspace.synk.im/'},false],
    [{resourceType:'mainFrame',url:'https://workspace.synk.im.evil/'},false],[{resourceType:'mainFrame',url:'https://user@workspace.synk.im/'},false],[{resourceType:'mainFrame',url:'https://workspace.synk.im:8443/'},false],
    [{resourceType:'subFrame',url:ORIGIN+'/messenger/'},true],[{resourceType:'subFrame',url:ORIGIN+'/messenger/?room=1'},true],
    [{resourceType:'subFrame',url:'https://evil.invalid/',referrer:ref},false],[{resourceType:'subFrame',url:'http://workspace.synk.im/messenger/'},false],[{resourceType:'subFrame',url:'https://synk-room.livekit.cloud/'},false],
    [{resourceType:'script',url:ORIGIN+'/app.js'},true],[{resourceType:'worker',url:ORIGIN+'/worker.js'},true],[{resourceType:'serviceWorker',url:ORIGIN+'/sw.js'},true],
    [{resourceType:'webSocket',url:'wss://workspace.synk.im/socket'},true],[{resourceType:'xhr',url:ORIGIN+'/api/me'},true],
    [{resourceType:'webSocket',url:'ws://workspace.synk.im/socket'},false],[{resourceType:'xhr',url:'http://workspace.synk.im/api/me'},false],
    [{resourceType:'script',url:'https://cdn.invalid/x.js',referrer:ref},false],[{resourceType:'worker',url:'https://cdn.invalid/w.js',referrer:ref},false],
    [{resourceType:'sharedWorker',url:'https://cdn.invalid/w.js',referrer:ref},false],[{resourceType:'serviceWorker',url:'https://cdn.invalid/sw.js',referrer:ref},false],
    [{resourceType:'object',url:'https://cdn.invalid/o',referrer:ref},false],[{resourceType:'script',url:'https://synk-room.livekit.cloud/x.js'},false],
    [{resourceType:'webSocket',url:'wss://synk-room.livekit.cloud/rtc?access_token=x'},true],[{resourceType:'xhr',url:'https://synk-room.livekit.cloud/settings'},true],
    [{resourceType:'webSocket',url:'wss://synk-room.livekit.cloud:7880/rtc'},false],[{resourceType:'webSocket',url:'ws://synk-room.livekit.cloud/rtc'},false],
    [{resourceType:'webSocket',url:'wss://a.b.livekit.cloud/rtc'},false],[{resourceType:'webSocket',url:'wss://livekit.cloud.evil.invalid/rtc'},false],[{resourceType:'webSocket',url:'wss://user:pw@synk-room.livekit.cloud/rtc'},false],
    [{resourceType:'image',url:'https://images.invalid/a.png',referrer:ref},true],[{resourceType:'xhr',url:'https://api.invalid/x',referrer:ORIGIN+'/messenger/'},true],[{resourceType:'webSocket',url:'wss://push.invalid/',referrer:ref},true],
    [{resourceType:'image',url:'https://images.invalid/a.png'},false],[{resourceType:'image',url:'https://images.invalid/a.png',referrer:''},false],[{resourceType:'image',url:'https://images.invalid/a.png',referrer:'https://evil.invalid/'},false],
    [{resourceType:'image',url:'http://images.invalid/a.png',referrer:ref},false],[{resourceType:'image',url:'https://user:pass@images.invalid/a.png',referrer:ref},false],[{resourceType:'image',url:'ftp://images.invalid/a.png',referrer:ref},false],
    [{resourceType:'image',url:'https://images.invalid/'+'a'.repeat(4100),referrer:ref},false],[{resourceType:'image',url:'not a url',referrer:ref},false],
  ];
  for(const [details,expected] of cases)assert.equal(workspaceRequestAllowed(details),expected,JSON.stringify(details));
  for(const value of [undefined,null,{},{url:5,resourceType:'image'}])assert.equal(workspaceRequestAllowed(value),false);
});
test('the jar\'s request filter cancels what the rule refuses',async()=>{
  const f=fixture();await f.app.open();const request=f.session(A).request,answer=details=>{let value;request(details,v=>{value=v;});return value;};
  assert.deepEqual(answer({resourceType:'mainFrame',url:ENTRY}),{cancel:false});assert.deepEqual(answer({resourceType:'mainFrame',url:ORIGIN+'/messenger/'}),{cancel:true});
  assert.deepEqual(answer({resourceType:'script',url:'https://cdn.invalid/x.js',referrer:ENTRY}),{cancel:true});assert.deepEqual(answer({resourceType:'webSocket',url:'wss://synk-room.livekit.cloud/rtc'}),{cancel:false});
});
test('a top document stays at the company / ; the system browser gets http and https without user info that the view does not load',()=>{
  for(const value of [ORIGIN+'/',ENTRY,ORIGIN+'/?tab=messenger#chat',ORIGIN+'/?invite=x'])assert.equal(workspaceNavigationAllowed(value),true,value);
  for(const value of [ORIGIN,ORIGIN+'/messenger/',ORIGIN+'/entry/','http://workspace.synk.im/','https://user@workspace.synk.im/','https://workspace.synk.im.evil/','javascript:alert(1)',ORIGIN+'/?'+'a'.repeat(4100),null,7])assert.equal(workspaceNavigationAllowed(value),value===ORIGIN,String(value).slice(0,80));
  assert.equal(workspaceExternalDestination('https://synk.im/portfolio/'),'https://synk.im/portfolio/');
  assert.equal(workspaceExternalDestination('http://example.invalid/a?b=1#c'),'http://example.invalid/a?b=1#c');
  assert.equal(workspaceExternalDestination(ORIGIN+'/messenger/'),ORIGIN+'/messenger/','a company page the view does not load opens outside');
  for(const value of [ENTRY,ORIGIN+'/','javascript:alert(1)','file:///C:/secret','mailto:a@example.invalid','synk-desktop://platform/','https://user:pass@example.invalid/','ftp://example.invalid/',null,'']) assert.equal(workspaceExternalDestination(value),null,String(value));
});
test('a frame counts only when it is this contents\' main frame or a company frame under it',()=>{
  const c=fakeContents();c.navigate(ENTRY);
  assert.equal(workspaceFrame(c,c.mainFrame),true);assert.equal(workspaceFrame(c,frameAt(ORIGIN+'/messenger/',c.mainFrame)),true);
  assert.equal(workspaceFrame(c,frameAt('https://evil.invalid/',c.mainFrame)),false);assert.equal(workspaceFrame(c,frameAt(ENTRY)),false,'another contents\' main frame');
  assert.equal(workspaceFrame(c,null),false);assert.equal(workspaceFrame(null,c.mainFrame),false);
  assert.equal(workspaceFrame(c,{get top(){throw Error('합성');}}),false);
});

test('new windows are always denied and their http and https addresses go to the system browser at most once in 1.5 s',async()=>{
  let t=100000;const f=fixture({now:()=>t});await f.app.open();const c=f.surface.webContents;
  assert.deepEqual(c.openHandler({url:'https://example.invalid/a'}),{action:'deny'});
  t+=1499;assert.deepEqual(c.openHandler({url:'https://example.invalid/b'}),{action:'deny'});
  t+=1;c.openHandler({url:'https://example.invalid/c'});
  t+=5000;assert.deepEqual(c.openHandler({url:'file:///C:/secret'}),{action:'deny'});c.openHandler({url:'https://example.invalid/d'});
  t+=5000;c.openHandler({url:ENTRY});c.openHandler({url:'https://user:pw@example.invalid/'});c.openHandler({url:'https://example.invalid/e'});
  await settle();assert.deepEqual(f.external,['https://example.invalid/a','https://example.invalid/c','https://example.invalid/d','https://example.invalid/e'],'refused addresses do not use up the slot');
  const failing=fixture({openExternal:()=>{throw Error('합성');}});await failing.app.open();failing.surface.webContents.openHandler({url:'https://example.invalid/'});await settle();
});
test('the top document cannot leave the company / ; a frame that leaves the company origin is stopped and opened outside (검토 R16)',async()=>{
  const f=fixture();await f.app.open();const c=f.surface.webContents;
  let event=preventable();c.emit('will-navigate',event,'https://example.invalid/x');assert.equal(event.defaultPrevented,true);
  event=preventable({url:'https://example.invalid/y'});c.emit('will-navigate',event,ENTRY);assert.equal(event.defaultPrevented,true,'Electron\'s event.url wins over the old argument');
  event=preventable();c.emit('will-navigate',event,ORIGIN+'/messenger/');assert.equal(event.defaultPrevented,true);
  event=preventable({url:ORIGIN+'/?tab=social'});c.emit('will-navigate',event);assert.equal(event.defaultPrevented,false);
  event=preventable({url:'https://example.invalid/frame',isMainFrame:false});c.emit('will-frame-navigate',event);assert.equal(event.defaultPrevented,true);
  event=preventable({url:ORIGIN+'/messenger/?room=2',isMainFrame:false});c.emit('will-frame-navigate',event);assert.equal(event.defaultPrevented,false,'the company messenger frame moves freely');
  event=preventable({url:'https://example.invalid/main',isMainFrame:true});c.emit('will-frame-navigate',event);assert.equal(event.defaultPrevented,false,'the main frame is will-navigate\'s');
  event=preventable({url:'javascript:alert(1)',isMainFrame:false});c.emit('will-frame-navigate',event);assert.equal(event.defaultPrevented,true);
  event=preventable({url:'https://example.invalid/r',isMainFrame:true});c.emit('will-redirect',event);assert.equal(event.defaultPrevented,true);
  event=preventable({url:'https://example.invalid/r',isMainFrame:false});c.emit('will-redirect',event);assert.equal(event.defaultPrevented,false);
  event=preventable();c.emit('will-redirect',event,'https://example.invalid/r');assert.equal(event.defaultPrevented,true,'an old-style redirect counts as the main frame');
  event=preventable();c.emit('will-attach-webview',event,{},{});assert.equal(event.defaultPrevented,true);
  await settle();assert.deepEqual(f.external,['https://example.invalid/x','https://example.invalid/y',ORIGIN+'/messenger/','https://example.invalid/frame']);
});
test('a draft asks with the Workspace wording on the platform window; 「돌아가서 저장」 calls onUnloadKept, leaving does not',async()=>{
  const f=fixture();await f.app.open();const c=f.surface.webContents;const unload=()=>{const event=preventable();c.emit('will-prevent-unload',event);return event.defaultPrevented;};
  f.answers.push(0);assert.equal(unload(),false);assert.equal(f.kept,1);
  const {win,options}=f.dialogs[0];assert.equal(win,f.parent);
  assert.deepEqual({title:options.title,message:options.message,detail:options.detail,buttons:options.buttons,cancelId:options.cancelId,defaultId:options.defaultId},
    {title:WORKSPACE_EXIT_TEXT.title,message:WORKSPACE_EXIT_TEXT.message,detail:WORKSPACE_EXIT_TEXT.detail,buttons:['돌아가서 저장',WORKSPACE_EXIT_TEXT.leave],cancelId:0,defaultId:0});
  f.answers.push(1);assert.equal(unload(),true);assert.equal(f.kept,1);assert.equal(f.dialogs.length,2);
  f.parent.destroyed=true;assert.equal(unload(),false);assert.equal(f.dialogs.length,2,'no dialog without the platform window');
});
test('downloads: only this surface\'s downloads are judged; other files are refused with a note',async()=>{
  const f=fixture();await f.app.open();const jar=f.session(A),c=f.surface.webContents;
  const item=fakeItem({filename:'secret.exe',mime:'application/octet-stream'});let event=preventable();jar.emit('will-download',event,item,c);
  assert.equal(event.defaultPrevented,true);assert.equal(f.dialogs.at(-1).options.message,'이 파일은 앱에서 저장할 수 없어요.');assert.equal(f.dialogs.at(-1).win,f.parent);
  const other=fakeContents();event=preventable();jar.emit('will-download',event,fakeItem(),other);assert.equal(event.defaultPrevented,false,'another contents\' download is not this handler\'s');
  f.surface.destroy();assert.equal(jar.listenerCount('will-download'),0,'a closed surface leaves no download listener');
});
function fakeItem({filename='synk-shift-practice.txt',mime='text/plain; charset=utf-8',size=1200,url='blob:https://workspace.synk.im/0b6f1f6e-0000-4000-8000-000000000001'}={}){
  const item=new EventEmitter();
  Object.assign(item,{state:'progressing',paused:0,resumed:0,cancelled:0,saveOptions:null,getURL:()=>url,getMimeType:()=>mime,getFilename:()=>filename,getTotalBytes:()=>size,getReceivedBytes:()=>0,
    getState(){return this.state;},pause(){this.paused++;},resume(){this.resumed++;},cancel(){this.cancelled++;this.state='cancelled';},setSaveDialogOptions(options){this.saveOptions=options;}});
  return item;
}
// downloads.cjs는 세션 확인 뒤 getWindow()가 처음과 같은 물건인지 본다. 부를 때마다 새 물건을 주면 이 하나도 늘 취소된다(11-21 고침)
test('the one Workspace download waits for the company session check and then goes on',async()=>{
  const f=fixture();await f.app.open();const jar=f.session(A),c=f.surface.webContents;
  const item=fakeItem(),event=preventable();jar.emit('will-download',event,item,c);
  assert.equal(event.defaultPrevented,false);assert.equal(item.paused,1);
  assert.deepEqual(item.saveOptions,{title:'SYNK 기록 저장',defaultPath:path.join('/synthetic/downloads','synk-shift-practice.txt'),filters:[{name:'Text',extensions:['txt']}]});
  await settle();assert.equal(jar.fetches[0]?.url,ORIGIN+'/api/me');
  assert.equal(item.cancelled,0,'a signed-in company session keeps the download');assert.equal(item.resumed,1);
});

test('permissions: on Windows only, this surface\'s company frames get the microphone (sound only)',async()=>{
  const f=fixture();const before=fakeContents();
  await f.app.open();const c=f.surface.webContents,mic={requestingUrl:ENTRY,mediaTypes:['audio']};
  assert.equal(permit(f,A,c,'media',mic),true);assert.equal(permit(f,A,c,'media',{requestingUrl:ORIGIN+'/messenger/',mediaTypes:['audio']}),true,'the same-origin messenger frame');
  for(const mediaTypes of [['audio','video'],['video'],undefined,'audio'])assert.equal(permit(f,A,c,'media',{requestingUrl:ENTRY,mediaTypes}),false,JSON.stringify(mediaTypes));
  for(const permission of ['notifications','geolocation','clipboard-read','openExternal','fullscreen','pointerLock','midi','hid','serial','usb'])assert.equal(permit(f,A,c,permission,{requestingUrl:ENTRY}),false,permission);
  for(const requestingUrl of ['https://evil.invalid/','http://workspace.synk.im/','https://user@workspace.synk.im/',undefined])assert.equal(permit(f,A,c,'media',{requestingUrl,mediaTypes:['audio']}),false,String(requestingUrl));
  assert.equal(permit(f,A,before,'media',mic),false,'another contents');
  f.surface.destroy();assert.equal(permit(f,A,c,'media',mic),false,'a closed surface');
  const mac=fixture({platform:'darwin'});await mac.app.open();const m=mac.surface.webContents;
  assert.equal(permit(mac,A,m,'media',{requestingUrl:ENTRY,mediaTypes:['audio']}),false);
});
test('permission checks: sound and speaker selection for the company origin, also without a contents (검토 R15)',async()=>{
  const f=fixture();await f.app.open();const c=f.surface.webContents;
  assert.equal(checked(f,A,null,'media',ORIGIN,{mediaType:'audio'}),true);assert.equal(checked(f,A,c,'media',ORIGIN,{mediaType:'audio',embeddingOrigin:ORIGIN}),true);
  assert.equal(checked(f,A,null,'speaker-selection',ORIGIN,{}),true);assert.equal(checked(f,A,null,'media','https://evil.invalid',{mediaType:'audio',requestingUrl:ORIGIN+'/messenger/'}),true,'the requesting company frame');
  assert.equal(checked(f,A,null,'media',ORIGIN,{mediaType:'audio',embeddingOrigin:'https://evil.invalid'}),false);
  assert.equal(checked(f,A,null,'media',ORIGIN,{mediaType:'video'}),false);assert.equal(checked(f,A,null,'media',ORIGIN,{}),false);
  assert.equal(checked(f,A,null,'media','https://evil.invalid',{mediaType:'audio'}),false);assert.equal(checked(f,A,fakeContents(),'media',ORIGIN,{mediaType:'audio'}),false);
  for(const permission of ['notifications','display-capture','clipboard-sanitized-write','background-sync'])assert.equal(checked(f,A,null,permission,ORIGIN,{}),false,permission);
  const mac=fixture({platform:'darwin'});await mac.app.open();assert.equal(checked(mac,A,null,'media',ORIGIN,{mediaType:'audio'}),false);assert.equal(checked(mac,A,null,'speaker-selection',ORIGIN,{}),false);
  f.surface.destroy();assert.equal(checked(f,A,null,'speaker-selection',ORIGIN,{}),false);
});

test('busy: sound, capture, or the document that got the microphone still showing (검토 R11)',async()=>{
  const f=fixture();assert.equal(f.app.busy(),false);await f.app.open();const c=f.surface.webContents;
  assert.equal(f.app.busy(),false);c.audible=true;assert.equal(f.app.busy(),true);c.audible=false;c.captured=true;assert.equal(f.app.busy(),true);c.captured=false;
  assert.equal(permit(f,A,c,'media',{requestingUrl:ENTRY,mediaTypes:['audio','video']}),false);assert.equal(f.app.busy(),false,'a refused camera request is no call');
  assert.equal(permit(f,A,c,'media',{requestingUrl:ORIGIN+'/messenger/',mediaTypes:['audio']}),true);assert.equal(f.app.busy(),true,'a silent call is still a call');
  c.navigate(ENTRY);assert.equal(f.app.busy(),false,'a new document ends the count');
  permit(f,A,c,'media',{requestingUrl:ENTRY,mediaTypes:['audio']});assert.equal(f.app.busy(),true);
  f.surface.destroy();assert.equal(f.app.busy(),false);await f.app.open();assert.equal(f.app.busy(),false,'a new surface starts without a call');
});
// 회사 화면은 같은 문서에서 replaceState로 주소를 바꾼다(social-workspace.js의 '/?tab=social&section=…'). 주소로 견주면 조용한 통화 중에
// busy가 거짓이 되어 초대가 통화 중인 Workspace를 묻지 않고 닫을 수 있다(검토 R6, 11-21 고침)
test('busy: a call stays busy when the company page changes its address inside the same document',async()=>{
  const f=fixture();await f.app.open();const c=f.surface.webContents;
  permit(f,A,c,'media',{requestingUrl:ENTRY,mediaTypes:['audio']});assert.equal(f.app.busy(),true);
  c.inPage(ORIGIN+'/?tab=social&section=inbox');assert.equal(f.app.busy(),true);
});

// 화면 공유(설계 4.2). Electron 44의 getDisplayMedia는 표시 처리기보다 먼저 장치 종류가 빈 media 권한 요청으로 온다. 옛 화면 캡처
// (getUserMedia의 chromeMediaSource)도 같은 요청으로 와서 허락하면 고르기 없이 화면을 잡는다(tools/workspace-view-smoke.cjs로 잰 것).
// 그래서 그 권한 요청에서 고르기를 묻고, 고른 것을 뒤따르는 표시 처리기가 한 번 쓴다. 거절은 null이다
const SCREEN={requestingUrl:ORIGIN+'/messenger/',mediaTypes:[]};
async function ask(f,id,contents,details=SCREEN,permission='media'){let answer;f.session(id).permission(contents,permission,value=>{answer=value;},details);await settle();return answer;}
function display(f,id,request){const got=[];f.session(id).displayMedia(request,value=>got.push(value));return got;}
test('screen sharing: the screen request asks the platform picker once, and the display request that follows gets only the picked video, never sound',async()=>{
  const f=fixture({chooseShare:async()=>({video:SOURCE})});await f.app.open();const c=f.surface.webContents;
  assert.equal(await ask(f,A,c),true);assert.equal(f.shares.length,1);
  let got=display(f,A,{videoRequested:true,audioRequested:true,frame:frameAt(ORIGIN+'/messenger/',c.mainFrame)});
  assert.deepEqual(got,[{video:SOURCE}],'the same-origin messenger frame; no screen sound even when asked');assert.deepEqual(Object.keys(got[0]),['video']);
  got=display(f,A,{videoRequested:true,frame:c.mainFrame});assert.deepEqual(got,[null],'a pick is used once');
  assert.equal(await ask(f,A,c,{requestingUrl:ENTRY},'display-capture'),true,'a display-capture request asks the same way');assert.equal(f.shares.length,2);
  assert.deepEqual(display(f,A,{videoRequested:true,frame:c.mainFrame}),[{video:SOURCE}]);
  // 고르기가 소리를 돌려줘도 첫 판은 화면 소리를 주지 않는다(설계 4.2, 검토 R10)
  const loud=fixture({chooseShare:async()=>({video:SOURCE,audio:'loopback'})});await loud.app.open();
  assert.equal(await ask(loud,A,loud.surface.webContents),true);
  assert.deepEqual(display(loud,A,{videoRequested:true,audioRequested:true,frame:loud.surface.webContents.mainFrame}),[{video:SOURCE}]);
});
test('a screen request is refused without asking when hidden, from another contents or origin, off Windows or without a surface',async()=>{
  const f=fixture({chooseShare:async()=>({video:SOURCE})});
  assert.equal(f.session(A),undefined,'no jar, so no handler, before an open');
  await f.app.open();const c=f.surface.webContents,other=fakeContents();other.navigate(ENTRY);
  assert.equal(await ask(f,A,other),false,'another contents');
  for(const requestingUrl of ['https://evil.invalid/','http://workspace.synk.im/',undefined])assert.equal(await ask(f,A,c,{requestingUrl,mediaTypes:[]}),false,String(requestingUrl));
  f.setVisible(false);assert.equal(await ask(f,A,c),false,'a hidden view');f.setVisible(true);
  assert.deepEqual(f.shares,[]);
  f.surface.destroy();assert.equal(await ask(f,A,c),false,'no surface');
  const mac=fixture({platform:'darwin',chooseShare:async()=>({video:SOURCE})});await mac.app.open();
  assert.equal(await ask(mac,A,mac.surface.webContents),false);assert.deepEqual(mac.shares,[]);
});
test('a display request without a fresh pick, or from a foreign frame, is refused with null; a legacy capture never gets a pick it did not ask for',async()=>{
  let clock=1000;const f=fixture({chooseShare:async()=>({video:SOURCE}),now:()=>clock});await f.app.open();const c=f.surface.webContents;
  assert.deepEqual(display(f,A,{videoRequested:true,frame:c.mainFrame}),[null],'no pick at all');
  const refusals=[{videoRequested:false,audioRequested:true,frame:c.mainFrame},{videoRequested:true,frame:fakeContents().mainFrame},{videoRequested:true,frame:frameAt('https://evil.invalid/',c.mainFrame)},{videoRequested:true,frame:null},{videoRequested:true},null];
  for(const [index,request] of refusals.entries()){assert.equal(await ask(f,A,c),true);assert.deepEqual(display(f,A,request),[null],'refusal '+index);assert.deepEqual(display(f,A,{videoRequested:true,frame:c.mainFrame}),[null],'the pick is spent by the refusal '+index);}
  assert.equal(await ask(f,A,c),true);clock+=10001;assert.deepEqual(display(f,A,{videoRequested:true,frame:c.mainFrame}),[null],'a pick older than ten seconds');
  assert.equal(await ask(f,A,c),true);f.surface.destroy();await f.app.open();
  assert.deepEqual(display(f,A,{videoRequested:true,frame:f.surface.webContents.mainFrame}),[null],'a pick for a closed surface');
  const mac=fixture({platform:'darwin'});await mac.app.open();assert.deepEqual(display(mac,A,{videoRequested:true,frame:mac.surface.webContents.mainFrame}),[null]);
});
test('screen requests ask one at a time; no pick, a failure, an account change or a closed view while asking refuses',async()=>{
  let pick=deferred();const f=fixture({chooseShare:()=>pick.promise});await f.app.open();const c=f.surface.webContents;
  let first;f.session(A).permission(c,'media',value=>{first=value;},SCREEN);await settle();
  assert.equal(await ask(f,A,c),false,'a second request while asking');assert.equal(first,undefined);assert.equal(f.shares.length,1);
  pick.resolve({video:SOURCE});await settle();assert.equal(first,true);assert.deepEqual(display(f,A,{videoRequested:true,frame:c.mainFrame}),[{video:SOURCE}]);
  for(const answer of [null,{},{video:null},{audio:'loopback'}]){pick=deferred();let got;f.session(A).permission(c,'media',value=>{got=value;},SCREEN);pick.resolve(answer);await settle();assert.equal(got,false,JSON.stringify(answer));}
  pick=deferred();let got;f.session(A).permission(c,'media',value=>{got=value;},SCREEN);pick.reject(Error('합성'));await settle();assert.equal(got,false);
  pick=deferred();f.session(A).permission(c,'media',value=>{got=value;},SCREEN);await settle();f.setAccount(member(B));pick.resolve({video:SOURCE});await settle();assert.equal(got,false,'an account change while asking');
  f.setAccount(member(A));await f.app.open();const d=f.surface.webContents;
  pick=deferred();got=undefined;f.session(A).permission(d,'media',value=>{got=value;},SCREEN);await settle();f.surface.destroy();pick.resolve({video:SOURCE});await settle();assert.equal(got,false,'a closed view');
  await f.app.open();pick=deferred();got=undefined;f.session(A).permission(f.surface.webContents,'media',value=>{got=value;},SCREEN);await settle();f.app.dispose();pick.resolve({video:SOURCE});await settle();assert.equal(got,false,'disposed');
  // 답은 한 번뿐이다. callback이 던져도 묻기는 풀린다
  const once=fixture({chooseShare:async()=>({video:SOURCE})});await once.app.open();const calls=[],oc=once.surface.webContents;
  once.session(A).permission(oc,'media',value=>{calls.push(value);throw Error('합성');},SCREEN);await settle();
  once.session(A).displayMedia({videoRequested:true,frame:oc.mainFrame},value=>{calls.push(value);throw Error('합성');});
  assert.deepEqual(calls,[true,{video:SOURCE}]);assert.equal(await ask(once,A,oc),true,'asking is free again');
});

test('surfaceForInvite gives this account\'s jar and a guarded surface that is not loaded, only for the same signed-in SYNK ID',async()=>{
  const f=fixture({state:member(U)}),binding={status:'signed-in',expectedAccountId:U};
  for(const other of [{status:'signed-in',expectedAccountId:A},{status:'signed-out',expectedAccountId:null},{status:'signed-out',expectedAccountId:U},null,undefined])
    assert.equal(await f.app.surfaceForInvite(other),null,JSON.stringify(other));
  assert.equal(f.surfaces.length,0);
  const answer=await f.app.surfaceForInvite(binding);
  assert.deepEqual(Object.keys(answer).sort(),['session','surface']);assert.equal(answer.surface,f.surface);assert.equal(answer.session,f.session(U));
  assert.equal(answer.surface.workspaceGuarded,true);assert.deepEqual(answer.surface.loads,[],'company entry loads the employee document itself');
  assert.equal(answer.surface.options.webPreferences.session,f.session(U));assert.equal(f.app.hasSurface(),true);assert.ok(f.log.some(entry=>entry[0]==='prepare'));
  assert.equal((await f.app.open()).reused,true,'the invite surface stays this manager\'s surface');
  const g=fixture({state:guest});assert.equal(await g.app.surfaceForInvite(binding),null);
  const r=fixture({state:restoring});assert.equal(await r.app.surfaceForInvite(binding),null);
});
test('surfaceForInvite never closes a call, asks a draft first and answers busy when it is kept',async()=>{
  const binding={status:'signed-in',expectedAccountId:U};let asked=0;
  const call=fixture({state:member(U),closeForExit:()=>{asked++;return 'closed';}});await call.app.open();call.surface.webContents.audible=true;
  assert.deepEqual(await call.app.surfaceForInvite(binding),{busy:true});assert.equal(asked,0,'a call is never asked to close');assert.equal(call.surface.destroyed,false);
  call.surface.webContents.audible=false;permit(call,U,call.surface.webContents,'media',{requestingUrl:ENTRY,mediaTypes:['audio']});
  assert.deepEqual(await call.app.surfaceForInvite(binding),{busy:true},'a silent call too');assert.equal(asked,0);
  const kept=fixture({state:member(U),closeForExit:()=>'kept'});await kept.app.open();assert.deepEqual(await kept.app.surfaceForInvite(binding),{busy:true});assert.equal(kept.surfaces.length,1);assert.equal(kept.surface.destroyed,false);
  const failing=fixture({state:member(U),closeForExit:()=>{throw Error('합성');}});await failing.app.open();assert.deepEqual(await failing.app.surfaceForInvite(binding),{busy:true});
  const closed=fixture({state:member(U),closeForExit:f=>{f.surface.destroy();return 'closed';}});await closed.app.open();const old=closed.surface;
  const answer=await closed.app.surfaceForInvite(binding);assert.equal(old.destroyed,true);assert.notEqual(answer.surface,old);assert.equal(closed.surfaces.length,2);assert.equal(answer.surface.workspaceGuarded,true);
  // 'closed'라 답했는데 겉이 남았으면 관리자가 닫는다
  const stale=fixture({state:member(U),closeForExit:()=>'closed'});await stale.app.open();const left=stale.surface;const fresh=await stale.app.surfaceForInvite(binding);
  assert.equal(left.destroyed,true);assert.equal(fresh.surface,stale.surface);
  const loading=fixture({state:member(U),load:()=>new Promise(()=>{})});void loading.app.open();await settle();assert.deepEqual(await loading.app.surfaceForInvite(binding),{busy:true},'an open in flight');
});
test('surfaceForInvite answers null when the account changes while asking or the jar cannot take the company entry preload',async()=>{
  const binding={status:'signed-in',expectedAccountId:U};const ask=deferred();
  const f=fixture({state:member(U),closeForExit:()=>ask.promise});await f.app.open();const waiting=f.app.surfaceForInvite(binding);await settle();
  f.setAccount(member(B));ask.resolve('closed');assert.equal(await waiting,null);assert.equal(f.surfaces.length,1,'no new surface for the old binding');
  const bare=fixture({state:member(U),sessionOptions:{preloadApi:false}});assert.equal(await bare.app.surfaceForInvite(binding),null);assert.equal(bare.surfaces.length,0);
  assert.equal((await bare.app.open()).ok,true,'without the session preload the view itself still opens');
  const throwing=fixture({state:member(U),sessionOptions:{preloadThrows:true}});assert.equal(await throwing.app.surfaceForInvite(binding),null);
  const disposed=fixture({state:member(U)});disposed.app.dispose();assert.equal(await disposed.app.surfaceForInvite(binding),null);
});

test('the native link: six handled channels on this surface\'s own ipc, answered only for its main frame at the company /',async()=>{
  const f=fixture();await f.app.open();const s=f.surface,c=s.webContents,jar=f.session(A);
  const handled=Object.entries(NATIVE_CHANNEL).filter(([name])=>name!=='changed').map(([,channel])=>channel);
  assert.deepEqual([...c.handlers.keys()].sort(),handled.sort());assert.equal(Object.keys(NATIVE_CHANNEL).length,7);
  assert.deepEqual(f.log.filter(entry=>entry[0]==='companyRequest'),[['companyRequest',jar]],'company requests use this surface\'s jar');
  assert.deepEqual(await c.call(NATIVE_CHANNEL.status),{configured:true,signedIn:true,status:'signed-in'});
  assert.deepEqual(await c.call(NATIVE_CHANNEL.account,{},'load'),{ok:true,account:{display_name:'합성'}});
  for(const operation of ['renew','logout','status',undefined,{op:'load'}])assert.deepEqual(await c.call(NATIVE_CHANNEL.account,{},operation),{ok:false,code:'INVALID_REQUEST'},String(operation));
  assert.deepEqual(await c.call(NATIVE_CHANNEL.signIn),{status:'signing-in'});assert.deepEqual(await c.call(NATIVE_CHANNEL.cancel),{status:'signed-out'});assert.deepEqual(await c.call(NATIVE_CHANNEL.signOut),{ok:true});
  assert.deepEqual(await c.call(NATIVE_CHANNEL.company,{},'challenge',{nonce:'x'}),{ok:true,operation:'challenge'});assert.deepEqual(f.log.at(-1),['company','challenge',{nonce:'x'}]);
  assert.equal(f.log.filter(entry=>entry[0]==='accountLoad').length,1);
  const untrusted={ok:false,code:'UNTRUSTED_SENDER'},before=f.log.length;
  assert.deepEqual(await c.call(NATIVE_CHANNEL.status,{senderFrame:frameAt(ORIGIN+'/messenger/',c.mainFrame)}),untrusted,'the messenger iframe');
  assert.deepEqual(await c.call(NATIVE_CHANNEL.signOut,{sender:fakeContents()}),untrusted,'another contents');
  assert.deepEqual(await c.call(NATIVE_CHANNEL.status,{senderFrame:null}),untrusted);
  c.mainFrame.url=ORIGIN+'/messenger/';assert.deepEqual(await c.call(NATIVE_CHANNEL.account,{},'load'),untrusted,'a main frame away from the company /');
  c.mainFrame.url='https://evil.invalid/';assert.deepEqual(await c.call(NATIVE_CHANNEL.company,{},'status',{}),untrusted);
  c.mainFrame.url=ORIGIN+'/?tab=social';assert.deepEqual(await c.call(NATIVE_CHANNEL.status),{configured:true,signedIn:true,status:'signed-in'});
  assert.equal(f.log.length,before+1,'no native work for an untrusted sender');
  s.destroy();assert.deepEqual(await c.call(NATIVE_CHANNEL.status),untrusted,'a closed surface');
  await f.app.open();assert.deepEqual(await c.call(NATIVE_CHANNEL.status),untrusted,'the old surface\'s channels stay closed after a new open');
  assert.deepEqual(await f.surface.webContents.call(NATIVE_CHANNEL.status),{configured:true,signedIn:true,status:'signed-in'});
});
test('the native link answers a failure code when its work throws or is missing',async()=>{
  const f=fixture({native:{status(){throw Error('합성');},accountLoad:async()=>{throw Error('합성');}}});await f.app.open();const c=f.surface.webContents;
  assert.deepEqual(await c.call(NATIVE_CHANNEL.status),{ok:false,code:'WORKSPACE_NATIVE_FAILED'});assert.deepEqual(await c.call(NATIVE_CHANNEL.account,{},'load'),{ok:false,code:'WORKSPACE_NATIVE_FAILED'});
  assert.deepEqual(await c.call(NATIVE_CHANNEL.company,{},'status',{}),{ok:false,error:{code:'COMPANY_UNAVAILABLE'}});
  assert.equal(await c.call(NATIVE_CHANNEL.signIn),null);assert.equal(await c.call(NATIVE_CHANNEL.cancel),null);assert.deepEqual(await c.call(NATIVE_CHANNEL.signOut),{ok:false});
  const none=fixture({native:{}});await none.app.open();assert.deepEqual(await none.surface.webContents.call(NATIVE_CHANNEL.account,{},'load'),{ok:false,code:'INVALID_REQUEST'});
});
test('publishAuth reaches only the current surface\'s company / document',async()=>{
  const f=fixture();const state={signedIn:true,status:'signed-in'};f.app.publishAuth(state);
  await f.app.open();const c=f.surface.webContents;f.app.publishAuth(state);assert.deepEqual(c.sent,[[NATIVE_CHANNEL.changed,state]]);
  c.url=ORIGIN+'/messenger/';f.app.publishAuth(state);c.url='https://evil.invalid/';f.app.publishAuth(state);assert.equal(c.sent.length,1);
  c.url=ENTRY;c.send=()=>{throw Error('합성');};f.app.publishAuth(state);
  f.surface.destroy();delete c.send;f.app.publishAuth(state);assert.equal(c.sent.length,1);
});
test('dispose closes the surface and every later open is unavailable, keeping the jar',async()=>{
  const f=fixture();await f.app.open();const s=f.surface,jar=f.session(A);f.app.dispose();
  assert.equal(s.destroyed,true);assert.equal(f.app.hasSurface(),false);assert.deepEqual(await f.app.open(),UNAVAILABLE);assert.equal(f.surfaces.length,1);
  assert.equal(f.app.syncContext(guest),null);await settle();assert.equal(jar.cleared,0,'quitting is no sign-out');
});
test('the native link refuses a same-origin frame even at the company / ; only the main frame is the company page',async()=>{
  const f=fixture();await f.app.open();const c=f.surface.webContents,before=f.log.length;
  for(const url of [ORIGIN+'/',ENTRY])assert.deepEqual(await c.call(NATIVE_CHANNEL.status,{senderFrame:frameAt(url,c.mainFrame)}),{ok:false,code:'UNTRUSTED_SENDER'},url);
  assert.deepEqual(await c.call(NATIVE_CHANNEL.signOut,{senderFrame:frameAt(ENTRY)}),{ok:false,code:'UNTRUSTED_SENDER'},'a look-alike main frame object');
  assert.equal(f.log.length,before);
});
