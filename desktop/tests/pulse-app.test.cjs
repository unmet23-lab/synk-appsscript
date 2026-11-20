'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const {createPulseApp,scopeOf,pulseAppPartition,pulseInviteRequest,pulseInviteRefusal,pulseAppNavigationAllowed,pulseAppResourceAllowed,pulseAppRequestAllowed,pulseAppMediaAllowed,pulseAppExternalDestination,PULSE_APP_ORIGIN:ORIGIN,PULSE_APP_ENTRY:ENTRY,PULSE_STAFF_ENTRY:STAFF,PULSE_DEMO_ENTRY:DEMO,PULSE_WINDOW_BACKGROUND,PULSE_INVITE_PRELOAD}=require('../src/pulse-app.cjs');
const {fakePage,heldRenderer,pulseContents,PRELOAD_FILE}=require('./pulse-page-double.cjs');
const guest={signedIn:false,status:'signed-out'},member=id=>({signedIn:true,status:'signed-in',account:{synk_user_id:id},accessToken:'SYNTHETIC-PRIVATE-TOKEN'}),restoring={signedIn:false,status:'restoring'};
// auth-service.cjs discard(code) ends a session for good: it empties the session and its vault, moves the epoch and its
// generation, and keeps the reason as an error that cannot be retried, in publicError's shape. An expired or revoked
// session leaves AUTH_REQUIRED and a cancelled sign-in AUTH_CANCELLED; company-entry.cjs bindingFromAuth reads both as
// the guest. A sign-out mark with a retryable error left is the platform binding's sign-out while auth still waits to
// retry the same session.
const discarded=code=>({signedIn:false,status:'signed-out',account:null,error:{code,message:'합성 종료 이유',retryable:false}});
const retrying={signedIn:false,status:'signed-out',account:null,error:{code:'NETWORK',message:'합성 재시도',retryable:true}};
// Neither a verified account nor a confirmed sign-out: restoring, signing in or an error status whatever error comes
// with it, a sign-out mark with a retryable error left, and one with an account left.
const unsettled=[
  restoring,{signedIn:false,status:'restoring',account:null,error:{code:'AUTH_REQUIRED',message:'합성',retryable:false}},
  {signedIn:false,status:'signing-in',account:null,error:null},{signedIn:false,status:'signing-in',account:null,error:{code:'AUTH_CANCELLED',message:'합성',retryable:false}},
  {signedIn:false,status:'error',account:null,error:{code:'SECURE_STORAGE_UNAVAILABLE',message:'합성',retryable:false}},{...retrying,status:'error'},
  retrying,{...retrying,status:'unconfigured'},
  {...discarded('AUTH_REQUIRED'),account:{synk_user_id:'synthetic-owner-a'}},{signedIn:false,status:'signed-out',account:{synk_user_id:'synthetic-owner-a'},error:null}];
const tick=()=>new Promise(resolve=>setImmediate(resolve)),settle=async()=>{for(let i=0;i<8;i++)await tick();};
// The contract's UUIDs are lowercase, of versions 1 to 8 with the RFC variant; auth issues v4 today. V1 and V7 are
// other valid versions that must not be refused, and the nil UUID and a version 9 are no request IDs.
const TOKEN='SYNTHETIC_invite-token_0001',OTHER='SYNTHETIC_invite-token_0002',UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const V1='c232ab00-9414-11ec-b3c8-9f6bdeced846',V7='018f6b2e-7c1a-7d3e-9a4b-5c6d7e8f9a0b',NIL='00000000-0000-0000-0000-000000000000',V9='018f6b2e-7c1a-9d3e-9a4b-5c6d7e8f9a0b';
// Values made inside a vm context have that context's prototypes; strict deepEqual compares them as plain data.
const plain=value=>JSON.parse(JSON.stringify(value)),pick=offer=>({id:offer.id,requestId:offer.requestId,accountGeneration:offer.accountGeneration});
// Each window's document is a pulse-page-double.cjs page with the window's real preload over it. The hand-off tests
// run against a page that keeps the receiver contract stated in the preload; today's app.mjs, which keeps none, has its
// own test. renderer holds what main sends a busy page (heldRenderer). generation is auth's UUID for its current
// epoch: another account, a sign-out or a new sign-in moves it. renew() is the same SYNK ID renewing its token: the
// state says restoring while auth's private renewingAccountId names the account, as main.cjs passes it, and the epoch
// and its generation stay. request() is the portal's own request for the current generation.
function fixture({state=member('synthetic-owner-a'),clientId='platform',load=()=>Promise.resolve(),sessions=new Map(),page={},renderer,inviteTimeoutMs=250}={}){
  const windows=[],external=[],partitions=[],dialogs=[],answers=[];let current=state,renewing=null,kept=0,generation=randomUUID();
  class Window extends EventEmitter{
    constructor(options){super();this.options=options;this.destroyed=false;this.shown=0;this.focused=0;this.loads=[];this.sent=[];this.webContents=pulseContents(this,{renderer});windows.push(this);}
    get page(){return this.document;}set page(value){this.document=value;value.attach(this.webContents);}
    loadURL(url){this.url=url;this.loads.push(url);this.page=fakePage(url,page);return load(this);}
    isDestroyed(){return this.destroyed;}isMinimized(){return !!this.minimized;}restore(){this.minimized=false;this.restored=true;}show(){this.shown++;}focus(){this.focused++;}destroy(){this.destroyed=true;this.emit('closed');}dialogParent(){return this;}
  }
  const session={fromPartition(partition){partitions.push(partition);if(!sessions.has(partition)){const value=new EventEmitter();Object.assign(value,{partition,cleared:0,cacheCleared:0,setPermissionRequestHandler(fn){this.permission=fn;},setPermissionCheckHandler(fn){this.permissionCheck=fn;},webRequest:{onBeforeRequest(_filter,handler){value.request=handler;}},async clearStorageData(){this.cleared++;},async clearCache(){this.cacheCleared++;}});sessions.set(partition,value);}return sessions.get(partition);}};
  const dialog={showMessageBoxSync(window,options){dialogs.push({window,options});return answers.length?answers.shift():0;}};
  const service=createPulseApp({clientId,getAccount:()=>current,getRenewingAccount:()=>renewing,getAccountGeneration:()=>generation,createSurface:options=>new Window(options),session,dialog,openExternal:async url=>external.push(url),getDownloads:()=>'/synthetic/downloads',onUnloadKept:()=>{kept++;},loadTimeoutMs:250,inviteTimeoutMs});
  return {service,windows,external,partitions,sessions,dialogs,answers,get kept(){return kept;},get generation(){return generation;},
    setAccount(value,{notify=true,epoch=true}={}){current=value;if(epoch)generation=randomUUID();if(notify)service.syncContext(value);},
    renew(id,options){renewing=id;this.setAccount(restoring,{...options,epoch:false});},verified(value){renewing=null;this.setAccount(value,{epoch:false});},
    // Auth moves its epoch before PULSE hears of anything.
    moveEpoch(){generation=randomUUID();},
    request(token=TOKEN){return {token,requestId:randomUUID(),accountGeneration:generation};},
    get latestSession(){return sessions.get(partitions.at(-1));}};
}
// The only two answers an invite gets (company-entry-contract-v1 §7). Neither carries the token.
function delivered(result,{requestId,accountGeneration}={}){
  assert.deepEqual(Object.keys(result).sort(),['accountGeneration','destination','ok','requestId','state'],JSON.stringify(result));
  assert.equal(result.ok,true);assert.equal(result.state,'received');assert.equal(result.destination,'/pulse-app/');assert.match(result.requestId,UUID);assert.match(result.accountGeneration,UUID);
  if(requestId!==undefined)assert.equal(result.requestId,requestId);if(accountGeneration!==undefined)assert.equal(result.accountGeneration,accountGeneration);
  return result;
}
function refused(result,code,{requestId,accountGeneration,retryable}={}){
  assert.deepEqual(Object.keys(result).sort(),['accountGeneration','code','ok','requestId','retryable'],JSON.stringify(result));
  assert.equal(result.ok,false);assert.equal(result.code,code,JSON.stringify(result));assert.equal(typeof result.retryable,'boolean');
  for(const key of ['requestId','accountGeneration'])if(result[key]!==null)assert.match(result[key],UUID);
  if(requestId!==undefined)assert.equal(result.requestId,requestId);if(accountGeneration!==undefined)assert.equal(result.accountGeneration,accountGeneration);if(retryable!==undefined)assert.equal(result.retryable,retryable);
  return result;
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
test('the cookie jar scope is the signed-in SYNK ID or a signed-out guest, never a pending or failed account',()=>{
  assert.equal(scopeOf(member('synthetic-owner-a')),'account:synthetic-owner-a');
  for(const status of ['signed-out','unconfigured'])assert.equal(scopeOf({signedIn:false,status}),'guest',status);
  // The reason auth keeps once it confirmed a sign-out keeps no guest out, with or without the account key.
  for(const code of ['AUTH_REQUIRED','AUTH_CANCELLED']){const {account:_account,...bare}=discarded(code);for(const value of [discarded(code),bare,{...discarded(code),status:'unconfigured'}])assert.equal(scopeOf(value),'guest',JSON.stringify(value));}
  // An error of unknown shape is no reason auth kept, and an empty account object is still an account left.
  for(const value of [undefined,null,{},...unsettled,{...discarded('AUTH_REQUIRED'),error:'AUTH_REQUIRED'},{...discarded('AUTH_REQUIRED'),error:[{code:'AUTH_REQUIRED',retryable:false}]},{...discarded('AUTH_REQUIRED'),account:{}},{signedIn:true,status:'restoring',account:{synk_user_id:'synthetic-owner-a'}},member('anonymous-local'),member('../evil'),member(''),member('a'.repeat(121))])assert.equal(scopeOf(value),null,JSON.stringify(value));
});
test('persistent partition is deterministic per owner without exposing account IDs or tokens',()=>{
  assert.match(pulseAppPartition('account:synthetic-owner-a'),/^persist:synk-pulse-app-[a-f0-9]{40}$/);
  assert.notEqual(pulseAppPartition('account:synthetic-owner-a'),pulseAppPartition('account:synthetic-owner-b'));
  assert.notEqual(pulseAppPartition('guest'),pulseAppPartition('account:synthetic-owner-a'));
  assert.doesNotMatch(pulseAppPartition('account:synthetic-owner-a'),/synthetic-owner/);
});
// The window paints this before the page and on every resize, so it must be the
// customer app's own page colour (html.sx background and theme-color), not a light frame.
const CUSTOMER_PAGE=path.join(__dirname,'..','..','docs','마케팅','온라인마케팅지도','engagement','company','public','pulse-app');
test('the PULSE window background is the customer app page colour',{skip:!fs.existsSync(CUSTOMER_PAGE)&&'customer app source not in this checkout'},()=>{
  const css=fs.readFileSync(path.join(CUSTOMER_PAGE,'film.css'),'utf8'),html=fs.readFileSync(path.join(CUSTOMER_PAGE,'index.html'),'utf8');
  assert.match(html,/<html[^>]*class="sx"/);assert.equal(html.match(/<meta name="theme-color" content="(#[0-9a-f]{6})">/i)?.[1].toLowerCase(),PULSE_WINDOW_BACKGROUND);
  const page=css.match(/:where\(html\.sx\),:where\(html\.sx\) body\{margin:0;background:#([0-9a-f]{3}|[0-9a-f]{6});/i)?.[1].toLowerCase();
  assert.equal(page&&'#'+(page.length===3?[...page].map(c=>c+c).join(''):page),PULSE_WINDOW_BACKGROUND,'film.css page background');
});
test('opening creates an independent sandboxed window with only its private preload and waits for loading, with duplicate opens joined',async()=>{
  let done;const f=fixture({load:()=>new Promise(resolve=>{done=resolve;})});let completed=false;
  const first=f.service.open();first.then(()=>{completed=true;});assert.equal(f.service.open(),first);await tick();
  const w=f.windows[0];assert.equal(w.shown,0);assert.equal(completed,false);assert.equal(w.url,ENTRY);
  assert.equal(w.options.parent,undefined);assert.equal(w.options.webPreferences.preload,PRELOAD_FILE);assert.equal(PULSE_INVITE_PRELOAD,PRELOAD_FILE);
  for(const key of ['sandbox','contextIsolation','webSecurity'])assert.equal(w.options.webPreferences[key],true);
  for(const key of ['nodeIntegration','nodeIntegrationInWorker','nodeIntegrationInSubFrames','webviewTag','allowRunningInsecureContent','experimentalFeatures','devTools'])assert.equal(w.options.webPreferences[key],false);
  assert.doesNotMatch(JSON.stringify(w.options),/SYNTHETIC-PRIVATE-TOKEN|synthetic-owner-a/);
  assert.equal(w.options.backgroundColor,PULSE_WINDOW_BACKGROUND);assert.equal(PULSE_WINDOW_BACKGROUND,'#000000');
  done();assert.equal((await first).ok,true);assert.equal(w.shown,1);assert.equal(w.focused,1);
  w.minimized=true;assert.equal((await f.service.open()).reused,true);assert.equal(w.restored,true);assert.equal(f.windows.length,1);
});
test('closing or quitting preserves only this owner customer session for reopening',async()=>{
  const sessions=new Map(),f=fixture({sessions});await f.service.open();const old=f.latestSession,key=f.partitions[0];
  f.windows[0].destroy();await f.service.open();assert.equal(f.latestSession,old);assert.equal(old.cleared,0);
  f.service.dispose();await settle();assert.equal(old.cleared,0);assert.equal(old.cacheCleared,0);assert.equal((await f.service.open()).code,'PULSE_APP_UNAVAILABLE');
  const reopened=fixture({sessions});await reopened.service.open();assert.equal(reopened.partitions[0],key);assert.equal(reopened.latestSession,old);
});
// Disposal is main.cjs will-quit only, after the draft guards accepted, followed by auth.dispose(), which keeps the
// saved sign-in and emits nothing. A quit is no sign-out: the jar that sign-in uses stays for the next launch.
test('quitting during a same-account renewal closes the window with the app and keeps that account\'s jar for the next launch',async()=>{
  const sessions=new Map(),f=fixture({sessions});await f.service.open();const w=f.windows[0],jar=f.latestSession;
  f.renew('synthetic-owner-a');assert.equal(w.destroyed,false);
  f.service.dispose();assert.equal(w.destroyed,true);await settle();assert.equal(jar.cleared,0);assert.equal(jar.cacheCleared,0);
  // An account notice after quitting clears nothing either.
  f.setAccount(guest);await settle();assert.equal(jar.cleared,0);assert.equal(jar.cacheCleared,0);
  const next=fixture({sessions});await next.service.open();assert.equal(next.latestSession,jar);assert.equal(jar.cleared,0);
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
test('a token renewal that begins while the former account\'s storage is cleared opens no window and hands no invite over',async()=>{
  const f=fixture();await f.service.open();const aJar=f.latestSession;let clear;
  aJar.clearStorageData=()=>new Promise(resolve=>{clear=()=>{aJar.cleared++;resolve();};});
  f.setAccount(member('synthetic-owner-b'));assert.equal(f.windows[0].destroyed,true);
  const inviting=f.service.openInvite(f.request()),joined=f.service.open();await tick();
  // B renews its token before A's storage is gone. The epoch stays, as it must for a window B already had.
  f.renew('synthetic-owner-b');clear();
  refused(await inviting,'PULSE_APP_ACCOUNT_PENDING',{accountGeneration:f.generation,retryable:true});assert.deepEqual(await joined,{ok:false,code:'PULSE_APP_ACCOUNT_PENDING'});
  assert.equal(f.windows.length,1);assert.equal(aJar.cleared,1);assert.equal(f.partitions.includes(pulseAppPartition('account:synthetic-owner-b')),false);
  // Verified again, the invite opens in B's own jar and reaches its document in memory.
  f.verified(member('synthetic-owner-b'));
  delivered(await f.service.openInvite(f.request()),{accountGeneration:f.generation});
  const b=f.windows[1];assert.equal(b.options.webPreferences.session,f.sessions.get(pulseAppPartition('account:synthetic-owner-b')));assert.deepEqual(b.loads,[ENTRY]);assert.deepEqual(b.page.received,[TOKEN]);
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
// The two ends auth confirms after which the member is a guest again: an expired session and a cancelled sign-in.
// Either door, the zero-argument opening and an invite, opens the guest's own window, and only the document's own
// queued receipt is a success.
test('once auth confirms a sign-out for an expired session or a cancelled sign-in, the guest opens PULSE in the guest jar and its document queues the invite',async()=>{
  const guestJar=pulseAppPartition('guest');
  // An expired session: the account's window closes and its jar is cleared as at any sign-out, and the guest opens its own window.
  const f=fixture();await f.service.open();const a=f.windows[0],aJar=f.latestSession;
  f.setAccount(discarded('AUTH_REQUIRED'));assert.equal(a.destroyed,true);
  assert.deepEqual(await f.service.open(),{ok:true,id:'pulse'});assert.equal(aJar.cleared,1);assert.equal(aJar.cacheCleared,1);
  const w=f.windows[1];assert.equal(f.partitions.at(-1),guestJar);assert.equal(w.options.webPreferences.session,f.sessions.get(guestJar));assert.notEqual(f.sessions.get(guestJar),aJar);
  const request=f.request();delivered(await f.service.openInvite(request),{requestId:request.requestId,accountGeneration:f.generation});
  assert.deepEqual(w.page.received,[TOKEN]);assert.deepEqual(w.loads,[ENTRY]);assert.equal(f.windows.length,2);
  // Offered and bound for no SYNK ID, as for any guest.
  assert.deepEqual(w.sent.map(([,offer])=>offer.expectedAccountId),[null]);assert.deepEqual(w.page.binds.map(bind=>bind.expectedAccountId),[null]);
  // A cancelled sign-in the guest began: nothing opens while signing in, and once auth signs it out an invite opens the fixed shell in the guest jar.
  const g=fixture({state:guest});g.setAccount({signedIn:false,status:'signing-in',account:null,error:null});
  refused(await g.service.openInvite(g.request()),'PULSE_APP_ACCOUNT_PENDING',{retryable:true});assert.equal(g.windows.length,0);
  g.setAccount(discarded('AUTH_CANCELLED'));
  const invite=g.request();delivered(await g.service.openInvite(invite),{requestId:invite.requestId,accountGeneration:g.generation});
  const v=g.windows[0];assert.equal(g.windows.length,1);assert.equal(v.options.webPreferences.session,g.sessions.get(guestJar));assert.ok(g.partitions.every(partition=>partition===guestJar),JSON.stringify(g.partitions));
  assert.deepEqual(v.loads,[ENTRY]);assert.deepEqual(v.page.received,[TOKEN]);assert.equal(v.sent[0][1].expectedAccountId,null);
  assert.deepEqual(await g.service.open(),{ok:true,id:'pulse',reused:true});
  // Either reason alike from launch, by either door.
  for(const code of ['AUTH_REQUIRED','AUTH_CANCELLED']){
    const opened=fixture({state:discarded(code)});assert.deepEqual(await opened.service.open(),{ok:true,id:'pulse'},code);
    delivered(await opened.service.openInvite(opened.request()));assert.deepEqual(opened.partitions,[guestJar],code);assert.deepEqual(opened.windows[0].page.received,[TOKEN],code);
    const invited=fixture({state:discarded(code)});delivered(await invited.service.openInvite(invited.request()));
    assert.deepEqual(invited.partitions,[guestJar],code);assert.equal(invited.windows.length,1,code);assert.deepEqual(invited.windows[0].loads,[ENTRY],code);assert.deepEqual(invited.windows[0].page.received,[TOKEN],code);
  }
});
test('a restoring, signing-in or failed account, a sign-out with a retryable error left and one with an account left open no window and offer no invite',async()=>{
  for(const state of unsettled){
    const f=fixture({state}),request=f.request();
    assert.deepEqual(await f.service.open(),{ok:false,code:'PULSE_APP_ACCOUNT_PENDING'},JSON.stringify(state));
    refused(await f.service.openInvite(request),'PULSE_APP_ACCOUNT_PENDING',{requestId:request.requestId,accountGeneration:request.accountGeneration,retryable:true});
    assert.equal(f.windows.length,0,JSON.stringify(state));assert.deepEqual(f.partitions,[],JSON.stringify(state));
  }
  // While auth still waits to retry the verified session, the platform binding's sign-out mark keeps the account's
  // window and jar as they are and offers nothing until the account is verified again.
  const kept=fixture();await kept.service.open();const w=kept.windows[0],jar=kept.latestSession,generation=kept.generation;
  kept.renew('synthetic-owner-a');kept.setAccount(retrying,{epoch:false});
  assert.deepEqual(await kept.service.open(),{ok:false,code:'PULSE_APP_ACCOUNT_PENDING'});
  refused(await kept.service.openInvite(kept.request()),'PULSE_APP_ACCOUNT_PENDING',{accountGeneration:generation,retryable:true});
  assert.equal(w.destroyed,false);assert.deepEqual(w.sent,[]);assert.equal(jar.cleared,0);assert.equal(kept.windows.length,1);
  kept.verified(member('synthetic-owner-a'));delivered(await kept.service.openInvite(kept.request()),{accountGeneration:generation});assert.deepEqual(w.page.received,[TOKEN]);
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
  // MP3·WAV project attachments (「첨부 받기」) are the server's other accepted types.
  for(const [mime,ok] of [['audio/mpeg',true],['audio/wav',true],['audio/x-wav',false],['audio/ogg',false],['text/html',false]]){const before=prevented;item.getMimeType=()=>mime;item.getTotalBytes=()=>1024;s.emit('will-download',event,item,w.webContents);assert.equal(prevented===before,ok,mime);}
});
test('the demo download accepts only its two prepared sample MP4s, bounded like customer media',async()=>{
  for(const file of ['preview-v1.mp4','preview-v2.mp4'])assert.equal(pulseAppMediaAllowed(ENTRY+'demo-assets/'+file),true,file);
  for(const value of [ENTRY+'demo-assets/preview-v3.mp4',ENTRY+'demo-assets/scene-1.png',ENTRY+'demo-assets/reference-warm.png',ENTRY+'demo-assets/preview-v1.mp4?x=1',ENTRY+'demo-assets/preview-v1.mp4#t=1',ENTRY+'demo-assets/PREVIEW-V1.MP4',ORIGIN+'/demo-assets/preview-v1.mp4',ENTRY+'assets/casting/video/M03-mv-happy-gangster-full-v1.mp4','http://workspace.synk.im/pulse-app/demo-assets/preview-v1.mp4','https://evil.invalid/pulse-app/demo-assets/preview-v1.mp4'])assert.equal(pulseAppMediaAllowed(value),false,value);
  const f=fixture();await f.service.open();const w=f.windows[0],s=f.latestSession;
  const attempt=({url=ENTRY+'demo-assets/preview-v2.mp4',mime='video/mp4',total=223356,source=w.webContents}={})=>{let prevented=false,options=null;const item=new EventEmitter();Object.assign(item,{getURL:()=>url,getMimeType:()=>mime,getTotalBytes:()=>total,getReceivedBytes:()=>0,getFilename:()=> '霜の肌理 광고_시안 v2.mp4',setSaveDialogOptions:value=>{options=value;},cancel(){this.cancelled=true;}});s.emit('will-download',{preventDefault(){prevented=true;}},item,source);return {prevented,options,item};};
  const saved=attempt();assert.equal(saved.prevented,false);assert.equal(saved.options.title,'PULSE 프로젝트 파일 저장');assert.match(saved.options.defaultPath,/霜の肌理 광고_시안 v2\.mp4$/);
  for(const mime of ['video/webm','image/png','audio/mpeg','text/html','application/octet-stream'])assert.equal(attempt({mime}).prevented,true,mime);
  assert.equal(attempt({url:ENTRY+'demo-assets/scene-1.png',mime:'image/png'}).prevented,true);assert.equal(attempt({total:101*1024*1024}).prevented,true);assert.equal(attempt({source:{}}).prevented,true);
  const growing=attempt({total:0});assert.equal(growing.prevented,false);growing.item.getReceivedBytes=()=>101*1024*1024;growing.item.emit('updated');assert.equal(growing.item.cancelled,true);
  // A new-tab link to a sample downloads it instead of leaving the window.
  assert.equal(w.popup({url:ENTRY+'demo-assets/preview-v1.mp4'}).action,'deny');assert.equal(w.download,ENTRY+'demo-assets/preview-v1.mp4');await tick();assert.deepEqual(f.external,[]);
});
test('same-origin public pages open in the browser while the shell, invites and APIs never leave the window',async()=>{
  const library=ENTRY+'production-library/';
  for(const value of [library,library+'?model=F02',library+'?model=M03',ENTRY+'assets/casting/video/M03-mv-happy-gangster-full-v1.mp4',ENTRY+'assets/production/01-harin-coffee-v3.webp',ENTRY+'assets/casting/f02.webp',ENTRY+'assets/casting/voice/F02-1.mp3'])assert.equal(pulseAppExternalDestination(value),value,value);
  // A bare ? or # parses as an empty query or fragment and carries nothing.
  for(const value of [library+'?',library+'#'])assert.equal(pulseAppExternalDestination(value),value,value);
  for(const value of [ENTRY+'#invite=SYNTHETIC',ENTRY+'?invite=SYNTHETIC',ENTRY+'index.html',ENTRY+'Index.html',ENTRY+'index.html/',ENTRY+'index.html#invite=SYNTHETIC',DEMO,ENTRY+'app.mjs',ENTRY+'sw.js',ENTRY+'demo-assets/scene-1.png',library+'index.html',ENTRY+'production-library',library+'#invite=SYNTHETIC',library+'?model=F02&token=SYNTHETIC',library+'?model=F02&',library+'?token=SYNTHETIC',library+'?model=f02',ENTRY+'assets/casting/f02.webp?token=SYNTHETIC',ENTRY+'assets/casting/video/M03-mv-happy-gangster-full-v1.mp4#t=1',ENTRY+'assets/casting/page.html',ENTRY+'assets/casting%2Fvideo/M03.mp4',ENTRY+'/production-library/',ENTRY+'..%2Fpulse/api/project',ENTRY+'%2e%2e/api/login',ENTRY+'assets/../../api/login',ORIGIN+'/pulse-app',ENTRY+'../api/login',ORIGIN+'/pulse/api/project',ORIGIN+'/pulse/api/media/00000000-0000-4000-8000-000000000001',ORIGIN+'/?tab=workroom&section=clients','http://workspace.synk.im/pulse-app/production-library/','https://user@workspace.synk.im/pulse-app/production-library/'])assert.equal(pulseAppExternalDestination(value),null,value);
  const f=fixture();await f.service.open();const w=f.windows[0];let prevented=0;const event={preventDefault(){prevented++;}};
  assert.equal(w.popup({url:library+'?model=F02'}).action,'deny');w.webContents.emit('will-navigate',event,library);
  assert.equal(w.popup({url:ENTRY+'#invite=SYNTHETIC'}).action,'deny');assert.equal(w.popup({url:ORIGIN+'/pulse/api/project'}).action,'deny');
  // A server redirect to a public page is only stopped, never opened outside.
  w.webContents.emit('will-redirect',event,library);
  await tick();assert.equal(prevented,2);assert.deepEqual(f.external,[library+'?model=F02',library]);assert.equal(w.download,undefined);
});
test('unsaved PULSE text asks before leaving or closing, and keeping it cancels an app quit',async()=>{
  const f=fixture();await f.service.open();const w=f.windows[0];
  const unload=()=>{const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};w.webContents.emit('will-prevent-unload',event);return event.defaultPrevented;};
  f.answers.push(0);assert.equal(unload(),false);assert.equal(f.kept,1);
  f.answers.push(1);assert.equal(unload(),true);assert.equal(f.kept,1);
  assert.equal(f.dialogs.length,2);const [{window,options}]=f.dialogs;assert.equal(window,w);
  assert.deepEqual(options.buttons,['돌아가서 저장','저장 없이 나가기']);assert.equal(options.defaultId,0);assert.equal(options.cancelId,0);assert.equal(options.noLink,true);
  assert.equal(options.title,'SYNK PULSE');assert.match(options.message,/저장하거나 보내지 않은 내용/);assert.doesNotMatch(options.message+options.detail,/메모|복구본/);
  w.destroyed=true;unload();assert.equal(f.dialogs.length,2);assert.equal(f.kept,1);
});
test('the platform passes its dialog and cancels only a quit in progress when PULSE keeps a draft',()=>{
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
  const line=main.split(/\r?\n/).find(value=>value.includes('pulseApp=createPulseApp('));
  assert.match(line,/createPulseApp\(\{[^\n]*\bsession,dialog,[^\n]*onUnloadKept:\(\)=>\{if\(!quittingRequested\)return;quittingRequested=false;platformTray\?\.cancelQuit\(\);startupWindow\?\.cancelQuit\(\);platformUpdate\?\.cancelInstall\(\);startupGate\?\.cancelInstall\(\);\}\}\);$/);
  // Run the real callback against recorded stand-ins: only a quit in progress is undone.
  const calls=[],stub=name=>({cancelQuit:()=>calls.push(name+'.cancelQuit'),cancelInstall:()=>calls.push(name+'.cancelInstall')});
  const context={quittingRequested:false,platformTray:stub('tray'),startupWindow:stub('startupWindow'),platformUpdate:stub('update'),startupGate:stub('gate')};
  const callback=vm.runInNewContext('('+line.match(/onUnloadKept:(\(\)=>\{[^\n]*?\})\}\);$/)[1]+')',context);
  callback();assert.deepEqual(calls,[]);
  context.quittingRequested=true;callback();assert.deepEqual(calls,['tray.cancelQuit','startupWindow.cancelQuit','update.cancelInstall','gate.cancelInstall']);
});
// main.cjs hands PULSE auth's own generation, never one a renderer sent, and answers every invite in the same two
// forms (pulse-auth-renewal.test.cjs runs the wiring against main itself).
test('main binds PULSE invites to auth\'s generation and refuses them in the same form before the service sees them',()=>{
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8'),lines=main.split(/\r?\n/);
  assert.match(lines.find(value=>value.includes('pulseApp=createPulseApp(')),/getRenewingAccount:renewingAccount,getAccountGeneration:pulseAccountGeneration,createSurface:options=>pulseView\.createSurface\(options\),/);
  assert.ok(lines.includes('const pulseAccountGeneration=()=>suitePublisher&&!suitePublisher.available()?null:auth?.accountGeneration?.()??null;'));
  assert.match(main,/'synk:pulse-app-open-invite':input=>isPlatform&&!smoke\?requireSuite\(\(\)=>pulseApp\.openInvite\(input\)\)\.then\(result=>result\?\.code==='SUITE_UNAVAILABLE'\?pulseInviteRefusal\(input,'SUITE_UNAVAILABLE'\):result\):pulseInviteRefusal\(input,'PULSE_APP_UNAVAILABLE'\),/);
  const request={token:TOKEN,requestId:randomUUID(),accountGeneration:randomUUID()};
  assert.deepEqual(pulseInviteRefusal(request,'SUITE_UNAVAILABLE'),{ok:false,requestId:request.requestId,accountGeneration:request.accountGeneration,code:'SUITE_UNAVAILABLE',retryable:true});
  assert.deepEqual(pulseInviteRefusal({token:TOKEN},'PULSE_APP_UNAVAILABLE'),{ok:false,requestId:null,accountGeneration:null,code:'PULSE_APP_UNAVAILABLE',retryable:false});
  assert.deepEqual(pulseInviteRefusal({token:TOKEN,requestId:'x',accountGeneration:2},'PULSE_APP_UNAVAILABLE'),{ok:false,requestId:null,accountGeneration:null,code:'PULSE_APP_UNAVAILABLE',retryable:false});
});
test('the window keeps the Electron user agent that the PULSE web app reads to recognize it',()=>{
  // The web app (install.mjs installationEnvironment) finds this window by the `Electron/` token and then drops its
  // install help and device-notification switch. Overriding the user agent here or app-wide would bring them back.
  for(const file of ['pulse-app.cjs','main.cjs'])assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),/setUserAgent|userAgentFallback|userAgent\s*:|appendSwitch\(\s*['"`]user-agent/,file);
});
test('preload keeps the zero-argument PULSE opening and passes an invite only as a fresh exact {token,requestId,accountGeneration}, never a lone {token}',async()=>{
  let bridge;const calls=[];vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>{bridge=value;}},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return {ok:true};}}})});
  await bridge.openPulseApp('https://evil.invalid/',{token:'SYNTHETIC'});assert.deepEqual(calls,[['synk:pulse-app-open']]);
  assert.deepEqual(Object.keys(bridge).filter(key=>/pulse/i.test(key)),['openPulseApp','pulseView','openPulseAppInvite']);
  const requestId=randomUUID(),accountGeneration=randomUUID(),input={token:TOKEN,requestId,accountGeneration};
  assert.equal((await bridge.openPulseAppInvite(input,'https://evil.invalid/')).ok,true);
  assert.equal(calls.length,2);assert.equal(calls[1].length,2);assert.equal(calls[1][0],'synk:pulse-app-open-invite');
  assert.notEqual(calls[1][1],input);assert.deepEqual(Reflect.ownKeys(calls[1][1]),['token','requestId','accountGeneration']);assert.deepEqual(plain(calls[1][1]),input);
  // Another valid UUID version crosses as well.
  assert.equal((await bridge.openPulseAppInvite({token:TOKEN,requestId:V7,accountGeneration:V1})).ok,true);assert.equal(calls.length,3);assert.deepEqual(plain(calls[2][1]),{token:TOKEN,requestId:V7,accountGeneration:V1});
  const accessor=Object.defineProperty({},'token',{get:()=>TOKEN,enumerable:true}),hidden=Object.defineProperty({token:TOKEN},'extra',{value:1}),late=Object.defineProperty({token:TOKEN,requestId},'accountGeneration',{get:()=>accountGeneration,enumerable:true});
  // A lone {token} would be taken under whatever generation is live by then, so it no longer crosses.
  for(const value of [{token:TOKEN},undefined,null,TOKEN,[TOKEN],{},{token:''},{token:'a'.repeat(15)},{token:'a'.repeat(201)},{token:TOKEN+'='},{token:ENTRY+'#invite='+TOKEN},{token:TOKEN,url:'https://evil.invalid/'},{token:TOKEN,[Symbol('extra')]:1},Object.create({token:TOKEN}),accessor,hidden,late,
    {token:TOKEN,requestId},{...input,url:'https://evil.invalid/'},{...input,accountGeneration:2},{...input,accountGeneration:'2'},{...input,requestId:requestId.toUpperCase()},{...input,token:TOKEN+'#x'},{...input,requestId:accountGeneration.slice(1)},{...input,requestId:NIL},{...input,accountGeneration:V9}])
    assert.equal((await bridge.openPulseAppInvite(value)).code,'PULSE_APP_INVITE_INVALID');
  assert.equal(calls.length,3);
  // A refusal here has main's answer form and names only a well-formed request.
  assert.deepEqual(plain(await bridge.openPulseAppInvite({...input,token:''})),{ok:false,requestId,accountGeneration,code:'PULSE_APP_INVITE_INVALID',retryable:false});
  assert.deepEqual(plain(await bridge.openPulseAppInvite({token:TOKEN,requestId:'x',accountGeneration:2})),{ok:false,requestId:null,accountGeneration:null,code:'PULSE_APP_INVITE_INVALID',retryable:false});
});
test('the PULSE window preload gives the page nothing, listens only to this window, and asks main for nothing until a well-formed offer',()=>{
  const listened=[],calls=[],events=[];
  const electron={ipcRenderer:{on:(channel,listener)=>{listened.push([channel,listener]);},send:(...args)=>{calls.push(['send',...args]);},sendSync:(...args)=>{calls.push(['sendSync',...args]);return null;},invoke:()=>assert.fail('no invoke')},contextBridge:{exposeInMainWorld:()=>assert.fail('nothing is exposed to the page')}};
  const window={addEventListener:type=>{events.push(type);},removeEventListener(){},postMessage:(...args)=>{calls.push(['postMessage',...args]);}};
  const location={origin:'https://evil.invalid',pathname:'/',search:'',hash:''},document={documentElement:{getAttribute:()=>null}};
  const context=vm.createContext({require:id=>{calls.push(['require',id]);return electron;},window,location,document,setTimeout,clearTimeout}),before=Object.keys(context);
  vm.runInContext(fs.readFileSync(PRELOAD_FILE,'utf8'),context);
  // Main's offer of a hand-off, and main's end of one when the portal cancels it.
  assert.deepEqual(Object.keys(context),before);assert.deepEqual(calls,[['require','electron']]);assert.deepEqual(listened.map(([channel])=>channel),['synk:pulse-invite-offer','synk:pulse-invite-abort']);
  // Only this window's messages and its leaving: never its address or a DOM event.
  assert.deepEqual(events,['message','pagehide']);
  // Main offers exactly {id,requestId,accountGeneration,expectedAccountId}. The old single ID, the token and any other form ask main for nothing.
  const id='x'.repeat(32),requestId=randomUUID(),accountGeneration=randomUUID(),offer={id,requestId,accountGeneration,expectedAccountId:null};
  for(const value of [undefined,null,7,'',TOKEN,id,'x'.repeat(31),{id},[offer],{id,requestId,accountGeneration},{...offer,id:'x'.repeat(31)},{...offer,id:'x'.repeat(31)+'='},{...offer,token:TOKEN},{...offer,requestId:'x'},{...offer,accountGeneration:2},{...offer,accountGeneration:requestId.toUpperCase()},{...offer,expectedAccountId:''},{...offer,expectedAccountId:'../evil'},{...offer,expectedAccountId:7}])listened[0][1]({},value);
  assert.deepEqual(calls,[['require','electron']]);
  // A well-formed offer on another page only reports that no receiver is there: no token request and no message.
  listened[0][1]({},offer);
  assert.deepEqual(plain(calls.slice(1)),[['send','synk:pulse-invite-result',{id,requestId,accountGeneration,documentId:null,outcome:'unavailable'}]]);
});
test('the window preload writes no token to an address, storage, window.name or a log',()=>{
  const source=fs.readFileSync(PRELOAD_FILE,'utf8').replace(/^\s*\/\/.*$/gm,'');
  assert.doesNotMatch(source,/location\.(?:hash|href|search)\s*=|history\.|Storage|indexedDB|document\.cookie|window\.name|\bname\s*=|console\.|CustomEvent|hashchange/);
  assert.match(source,/window\.postMessage\(\{channel:CHANNEL,version:1,type,\.\.\.fields\},ORIGIN\)/);
});
test('main takes exactly {token,requestId,accountGeneration} and refuses everything else, a lone {token} included, before any window',async()=>{
  const f=fixture(),requestId=randomUUID(),accountGeneration=f.generation;
  const accessor=Object.defineProperty({},'token',{get:()=>TOKEN,enumerable:true}),hidden=Object.defineProperty({token:TOKEN},'extra',{value:1});
  for(const input of [{token:TOKEN},{token:OTHER},undefined,null,TOKEN,[TOKEN],{},{token:''},{token:'a'.repeat(15)},{token:'a'.repeat(201)},{token:TOKEN+'='},{token:TOKEN+'#x'},{token:'SYNTHETIC invite token 01'},{token:ENTRY+'#invite='+TOKEN},{token:123},{token:[TOKEN]},
    {token:TOKEN,url:'https://evil.invalid/'},{token:TOKEN,mode:'staff'},{token:TOKEN,[Symbol('extra')]:1},Object.create({token:TOKEN}),accessor,hidden,
    {token:TOKEN,requestId},{token:TOKEN,requestId,accountGeneration,url:'https://evil.invalid/'},{token:TOKEN,requestId,accountGeneration:2},{token:TOKEN,requestId,accountGeneration:'2'},{token:TOKEN,requestId:requestId.toUpperCase(),accountGeneration},{token:TOKEN,requestId:'x'.repeat(36),accountGeneration},{token:TOKEN+'=',requestId,accountGeneration},
    {token:TOKEN,requestId:NIL,accountGeneration},{token:TOKEN,requestId:V9,accountGeneration}])
    refused(await f.service.openInvite(input),'PULSE_APP_INVITE_INVALID',{retryable:false});
  assert.equal(f.windows.length,0);assert.deepEqual(f.partitions,[]);
  // A refusal names the request only when the input named one well-formed. A lone {token} names none.
  refused(await f.service.openInvite({token:TOKEN}),'PULSE_APP_INVITE_INVALID',{requestId:null,accountGeneration:null});
  refused(await f.service.openInvite({token:TOKEN+'=',requestId,accountGeneration}),'PULSE_APP_INVITE_INVALID',{requestId,accountGeneration});
  refused(await f.service.openInvite({token:TOKEN,requestId,accountGeneration:2}),'PULSE_APP_INVITE_INVALID',{requestId,accountGeneration:null});
  for(const token of ['a'.repeat(16),'Z'.repeat(200),'abc_DEF-0123456789',TOKEN])assert.deepEqual(pulseInviteRequest({token,requestId,accountGeneration}),{token,requestId,accountGeneration});
  assert.deepEqual(pulseInviteRequest({token:TOKEN,requestId:V7,accountGeneration:V1}),{token:TOKEN,requestId:V7,accountGeneration:V1});
  for(const input of [{token:TOKEN},{token:TOKEN,requestId},{token:TOKEN,requestId:NIL,accountGeneration},{token:TOKEN,requestId,accountGeneration:V9}])assert.equal(pulseInviteRequest(input),null,JSON.stringify(input));
});
test('a first invite opens only the fixed shell and succeeds on the ready document\'s own queued receipt, never carrying the token in an address or a result',async()=>{
  const f=fixture({state:guest}),request=f.request(),result=await f.service.openInvite(request);
  delivered(result,{requestId:request.requestId,accountGeneration:f.generation});
  const w=f.windows[0];assert.deepEqual(w.loads,[ENTRY]);assert.deepEqual(w.page.received,[TOKEN]);assert.equal(w.page.href,ENTRY);assert.equal(w.shown,2);assert.equal(w.focused,2);
  // Main offered the window the request, never the token. A guest has no SYNK ID to expect.
  assert.equal(w.sent.length,1);const [[channel,offer]]=w.sent;assert.equal(channel,'synk:pulse-invite-offer');assert.match(offer.id,/^[A-Za-z0-9_-]{32}$/);
  assert.deepEqual(offer,{id:offer.id,requestId:request.requestId,accountGeneration:f.generation,expectedAccountId:null});
  // The token crossed once, as main's answer to the bound document's request, and reached the page in one message only.
  assert.deepEqual(w.page.commits,[{id:offer.id,requestId:request.requestId,accountGeneration:f.generation,documentId:w.page.documentId,token:TOKEN}]);
  // The offer is the contract §3 message exactly: the token travels as token, never as code.
  assert.deepEqual(w.page.posted.filter(([data])=>JSON.stringify(data).includes(TOKEN)),[[{channel:'synk.company.entry',version:1,type:'offer',requestId:request.requestId,accountGeneration:f.generation,documentId:w.page.documentId,token:TOKEN},ORIGIN]]);
  assert.deepEqual(w.page.strays,[]);
  assert.doesNotMatch(JSON.stringify([w.sent,w.loads,result,f.partitions,w.options]),new RegExp(TOKEN));
  assert.deepEqual(f.partitions,[pulseAppPartition('guest')]);assert.equal(w.options.webPreferences.session,f.latestSession);
  for(const key of ['sandbox','contextIsolation','webSecurity'])assert.equal(w.options.webPreferences[key],true);assert.equal(w.options.webPreferences.preload,PRELOAD_FILE);
  assert.equal(f.latestSession.permissionCheck(),false);let answer;f.latestSession.request({url:ORIGIN+'/api/login',resourceType:'xhr'},value=>{answer=value;});assert.equal(answer.cancel,true);
  // The zero-argument opening afterwards only brings this window forward.
  assert.deepEqual(await f.service.open(),{ok:true,id:'pulse',reused:true});assert.deepEqual(w.loads,[ENTRY]);
});
test('an open customer window takes the invite in memory, a delivery only on its document\'s queued receipt: no address, no reload, no second window',async()=>{
  const f=fixture();await f.service.open();const w=f.windows[0];w.minimized=true;
  const request=f.request();
  delivered(await f.service.openInvite(request),{requestId:request.requestId,accountGeneration:f.generation});
  assert.deepEqual(w.loads,[ENTRY]);assert.equal(f.windows.length,1);assert.equal(w.destroyed,false);
  assert.deepEqual(w.page.received,[TOKEN]);assert.equal(w.page.href,ENTRY);
  assert.equal(w.restored,true);assert.equal(w.shown,2);assert.equal(w.focused,2);
  // The offer named the request and the SYNK ID main verified, and the bound document was told the same.
  assert.equal(w.sent.length,1);assert.equal(w.sent[0][0],'synk:pulse-invite-offer');const offer=w.sent[0][1];
  assert.deepEqual(offer,{id:offer.id,requestId:request.requestId,accountGeneration:f.generation,expectedAccountId:'synthetic-owner-a'});
  // The bind is the contract §3 message exactly, phase 'deliver' included.
  assert.deepEqual(w.page.binds,[{channel:'synk.company.entry',version:1,type:'bind',requestId:request.requestId,accountGeneration:f.generation,documentId:w.page.documentId,phase:'deliver',expectedAccountId:'synthetic-owner-a'}]);
  assert.doesNotMatch(JSON.stringify(w.sent),new RegExp(TOKEN));assert.deepEqual(w.page.commits.map(answer=>answer?.token),[TOKEN]);assert.deepEqual(w.page.strays,[]);
  // A lone {token} is refused before anything is offered; the next exact request of this generation goes the same way.
  refused(await f.service.openInvite({token:OTHER}),'PULSE_APP_INVITE_INVALID',{requestId:null,accountGeneration:null,retryable:false});assert.equal(w.sent.length,1);
  const next=f.request(OTHER),second=delivered(await f.service.openInvite(next),{requestId:next.requestId,accountGeneration:f.generation});
  assert.equal(w.sent[1][1].requestId,second.requestId);assert.notEqual(w.sent[1][1].id,offer.id);
  assert.deepEqual(w.page.received,[TOKEN,OTHER]);assert.deepEqual(w.loads,[ENTRY]);
});
test('today\'s PULSE page declares no receiver, so a window is handed no token and nothing claims a delivery',async()=>{
  const f=fixture({page:{receiver:false}});await f.service.open();const w=f.windows[0];
  refused(await f.service.openInvite(f.request()),'PULSE_APP_INVITE_RECEIVER_UNAVAILABLE',{accountGeneration:f.generation,retryable:true});
  assert.equal(w.sent.length,1);assert.deepEqual(w.page.commits,[]);assert.deepEqual(w.page.received,[]);assert.deepEqual(w.page.posted,[]);assert.equal(w.page.href,ENTRY);
  assert.deepEqual(w.loads,[ENTRY]);assert.equal(f.windows.length,1);assert.equal(w.destroyed,false);assert.equal(w.shown,1);assert.equal(w.focused,1);
  // A window opened for the invite fails the same way and is not reported as opened.
  const g=fixture({page:{receiver:false}});refused(await g.service.openInvite(g.request()),'PULSE_APP_INVITE_RECEIVER_UNAVAILABLE');
  assert.deepEqual(g.windows[0].loads,[ENTRY]);assert.deepEqual(g.windows[0].page.commits,[]);assert.deepEqual(g.windows[0].page.posted,[]);
});
test('a changed address, a hashchange or the old DOM receipt event is no receipt: the token the page kept stays unconfirmed and is never sent again',async()=>{
  const f=fixture({page:{drift:'#models'}});await f.service.open();const w=f.windows[0];
  refused(await f.service.openInvite(f.request()),'PULSE_APP_INVITE_UNCONFIRMED',{retryable:false});
  assert.deepEqual(w.page.received,[TOKEN]);assert.equal(w.page.href,ENTRY+'#models');assert.equal(w.shown,1);assert.equal(w.focused,1);
  assert.equal(w.sent.length,1);assert.equal(w.page.commits.length,1);
});
test('a ready document that never binds is handed no token, and a new document that binds takes the next invite',async()=>{
  // The refusal waits out the invite time limit; at 250ms a loaded test run timed out before the page's own bind (11-20).
  const f=fixture({page:{bind:false},inviteTimeoutMs:2000});await f.service.open();const w=f.windows[0];
  refused(await f.service.openInvite(f.request()),'PULSE_APP_INVITE_FAILED',{retryable:true});
  assert.equal(w.page.binds.length,1);assert.deepEqual(w.page.commits,[]);assert.deepEqual(w.page.received,[]);
  assert.doesNotMatch(JSON.stringify(w.page.posted),new RegExp(TOKEN));assert.equal(w.page.href,ENTRY);
  w.page=fakePage(ENTRY);await settle();
  delivered(await f.service.openInvite(f.request()));assert.deepEqual(w.page.received,[TOKEN]);assert.deepEqual(w.loads,[ENTRY]);
});
test('a running demo keeps its fictional project: the invite fails without a token, reload or new window',async()=>{
  const f=fixture();await f.service.open();const w=f.windows[0],address=w.webContents.getURL;
  // The member chose 「try a project」, so the shell reloaded itself as ?demo=coffee.
  w.page=fakePage(DEMO);
  refused(await f.service.openInvite(f.request()),'PULSE_APP_DEMO_ACTIVE',{retryable:false});
  assert.deepEqual(w.sent,[]);assert.equal(w.page.href,DEMO);assert.deepEqual(w.page.received,[]);
  // An address read just before the demo started still meets the document's own check.
  w.webContents.getURL=()=>ENTRY;
  refused(await f.service.openInvite(f.request()),'PULSE_APP_DEMO_ACTIVE');
  assert.equal(w.sent.length,1);assert.equal(w.page.href,DEMO);assert.deepEqual(w.page.received,[]);assert.deepEqual(w.page.commits,[]);assert.deepEqual(w.page.binds,[]);
  w.webContents.getURL=address;
  assert.deepEqual(w.loads,[ENTRY]);assert.equal(f.windows.length,1);assert.equal(w.destroyed,false);assert.equal(w.shown,1);assert.equal(w.focused,1);assert.deepEqual(f.dialogs,[]);
  // The zero-argument opening still brings the demo forward unchanged.
  assert.equal((await f.service.open()).reused,true);assert.equal(w.page.href,DEMO);assert.deepEqual(w.loads,[ENTRY]);
});
test('the hand-off checks the exact origin, path and query inside the document before binding anything',async()=>{
  const f=fixture();await f.service.open();const w=f.windows[0],address=w.webContents.getURL;
  w.webContents.getURL=()=>ENTRY;
  for(const href of [ORIGIN+'/messenger/','https://evil.invalid/pulse-app/','http://workspace.synk.im/pulse-app/',ENTRY+'?mode=staff',ENTRY+'?token=x',ENTRY+'index.html']){
    w.page=fakePage(href);assert.equal((await f.service.openInvite(f.request())).code,'PULSE_APP_INVITE_RECEIVER_UNAVAILABLE',href);
    assert.equal(w.page.href,href);assert.deepEqual(w.page.received,[]);assert.deepEqual(w.page.commits,[],href);assert.deepEqual(w.page.binds,[],href);
  }
  // Main reads the address first as well, and offers nothing to another page.
  w.webContents.getURL=address;const offered=w.sent.length;
  for(const href of [ORIGIN+'/messenger/',ENTRY+'?mode=staff']){w.page=fakePage(href);refused(await f.service.openInvite(f.request()),'PULSE_APP_INVITE_FAILED');}
  assert.equal(w.sent.length,offered);assert.deepEqual(w.loads,[ENTRY]);assert.equal(f.windows.length,1);
  // A window in the middle of loading a document is busy, not offered anything.
  w.page=fakePage(ENTRY);w.loadingMainFrame=true;refused(await f.service.openInvite(f.request()),'PULSE_APP_BUSY',{retryable:true});assert.equal(w.sent.length,offered);
});
test('main answers the token only to the offered main frame on the shell, for that offer\'s own IDs, and only once',async()=>{
  const busy=heldRenderer(),f=fixture({renderer:busy.renderer});await f.service.open();const w=f.windows[0];
  const commit=(payload,frame=w.webContents.mainFrame)=>{const event={sender:w.webContents,senderFrame:frame};w.webContents.ipc.emit('synk:pulse-invite-commit',event,payload);return event.returnValue;};
  const documentId=randomUUID();
  // Requests naming no offer of this window get null and leave the offer as it is.
  const first=f.service.openInvite(f.request());await tick();const ids=pick(w.sent[0][1]);
  for(const value of [undefined,null,ids.id,'x'.repeat(32),{id:ids.id},{...ids},{...ids,documentId,extra:1},{...ids,id:ids.id+'x',documentId},{...ids,id:'x'.repeat(32),documentId},[{...ids,documentId}]])assert.equal(commit(value),null,JSON.stringify(value));
  // The request for this offer from another frame or page ends it without the token.
  assert.equal(commit({...ids,documentId},{parent:w.webContents.mainFrame,url:ENTRY}),null);refused(await first,'PULSE_APP_INVITE_FAILED');
  const second=f.service.openInvite(f.request());await tick();
  assert.equal(commit({...pick(w.sent[1][1]),documentId},{parent:null,url:ENTRY}),null);refused(await second,'PULSE_APP_INVITE_FAILED');
  // So does one with this offer's ID but another request, another generation or no document ID.
  for(const change of [{requestId:randomUUID()},{accountGeneration:randomUUID()},{documentId:'not-a-document'},{documentId:null}]){
    const pending=f.service.openInvite(f.request());await tick();
    assert.equal(commit({...pick(w.sent.at(-1)[1]),documentId,...change}),null,JSON.stringify(change));refused(await pending,'PULSE_APP_INVITE_FAILED');
  }
  // The busy page runs all those offers late; none gets the token.
  busy.releaseAll();await settle();assert.ok(w.page.commits.length>0);assert.ok(w.page.commits.every(answer=>answer===null));assert.deepEqual(w.page.received,[]);
  assert.doesNotMatch(JSON.stringify(w.page.posted),new RegExp(TOKEN));assert.equal(w.page.href,ENTRY);
  // Handed over once; the same request never gets it again.
  const third=f.service.openInvite(f.request(OTHER));await tick();busy.release();delivered(await third);
  const answered=w.page.commits.at(-1);assert.equal(answered.token,OTHER);
  assert.equal(commit({id:answered.id,requestId:answered.requestId,accountGeneration:answered.accountGeneration,documentId:answered.documentId}),null);
  assert.deepEqual(w.page.received,[OTHER]);
});
test('an invite while the window opens or takes another invite is busy, never folded into that success',async()=>{
  // A first invite still loading: the second token is refused, and a plain opening joins the window only.
  let loaded;const f=fixture({load:()=>new Promise(resolve=>{loaded=resolve;})});
  const first=f.service.openInvite(f.request());await tick();
  refused(await f.service.openInvite(f.request(OTHER)),'PULSE_APP_BUSY',{retryable:true});
  const joined=f.service.open();loaded();
  delivered(await first);assert.deepEqual(await joined,{ok:true,id:'pulse'});
  assert.equal(f.windows.length,1);assert.deepEqual(f.windows[0].loads,[ENTRY]);assert.deepEqual(f.windows[0].page.received,[TOKEN]);
  // A plain opening still loading is not an invite's success either.
  let opened;const g=fixture({load:()=>new Promise(resolve=>{opened=resolve;})});const opening=g.service.open();await tick();
  refused(await g.service.openInvite(g.request()),'PULSE_APP_BUSY');opened();assert.equal((await opening).ok,true);
  assert.deepEqual(g.windows[0].loads,[ENTRY]);assert.deepEqual(g.windows[0].page.received,[]);
  // While the busy page has not run one hand-off, another invite is busy and a plain opening only shows the window.
  const busy=heldRenderer(),h=fixture({renderer:busy.renderer});await h.service.open();const w=h.windows[0];
  const handing=h.service.openInvite(h.request());await tick();assert.equal(busy.count,1);
  refused(await h.service.openInvite(h.request(OTHER)),'PULSE_APP_BUSY');assert.equal((await h.service.open()).reused,true);
  assert.equal(w.sent.length,1);assert.deepEqual(w.page.commits,[]);
  busy.release();delivered(await handing);assert.deepEqual(w.page.received,[TOKEN]);
  // Once settled, the next invite is handed over normally.
  const next=h.service.openInvite(h.request(OTHER));await tick();busy.release();delivered(await next);assert.deepEqual(w.page.received,[TOKEN,OTHER]);
  assert.equal(h.windows.length,1);assert.deepEqual(w.loads,[ENTRY]);
});
test('an account change during an invite opening or hand-off is refused by the epoch and leaves nothing for the new account',async()=>{
  let loaded;const f=fixture({load:()=>new Promise(resolve=>{loaded=resolve;})});const opening=f.service.openInvite(f.request());await tick();
  const old=f.latestSession;f.setAccount(member('synthetic-owner-b'));assert.equal(f.windows[0].destroyed,true);loaded();
  refused(await opening,'PULSE_APP_ACCOUNT_CHANGED',{retryable:false});assert.equal(f.windows[0].shown,0);await tick();assert.equal(old.cleared,1);
  assert.deepEqual(f.windows[0].page.commits,[]);assert.deepEqual(f.windows[0].page.received,[]);
  const busy=heldRenderer(),g=fixture({renderer:busy.renderer});await g.service.open();const w=g.windows[0],jar=g.latestSession;
  const handing=g.service.openInvite(g.request());await tick();g.setAccount(member('synthetic-owner-b'));
  refused(await handing,'PULSE_APP_ACCOUNT_CHANGED');assert.equal(w.destroyed,true);
  // The closed page runs the offer only now and gets nothing.
  busy.release();await settle();assert.deepEqual(w.page.commits,[null]);assert.deepEqual(w.page.received,[]);assert.equal(w.shown,1);assert.equal(w.focused,1);assert.equal(jar.cleared,1);
  // The next invite opens in the new account's own jar.
  const next=g.service.openInvite(g.request(OTHER));await settle();busy.release();
  delivered(await next,{accountGeneration:g.generation});assert.equal(g.partitions.at(-1),pulseAppPartition('account:synthetic-owner-b'));
  assert.deepEqual(g.windows[1].loads,[ENTRY]);assert.deepEqual(g.windows[1].page.received,[OTHER]);
});
// company-entry-contract-v1 §7: the wire generation is auth's UUID for its epoch, never the numeric sessionGeneration.
test('a request made for another account generation is never applied to the current account, before or during the hand-off',async()=>{
  const f=fixture();await f.service.open();const a=f.windows[0],stale=f.request();
  f.setAccount(member('synthetic-owner-b'));assert.equal(a.destroyed,true);
  refused(await f.service.openInvite(stale),'PULSE_APP_ACCOUNT_CHANGED',{requestId:stale.requestId,accountGeneration:stale.accountGeneration,retryable:false});
  assert.equal(f.windows.length,1);assert.equal(f.partitions.includes(pulseAppPartition('account:synthetic-owner-b')),false);assert.deepEqual(a.sent,[]);
  // The numeric auth epoch is no generation at all.
  for(const accountGeneration of [2,'2'])refused(await f.service.openInvite({token:TOKEN,requestId:randomUUID(),accountGeneration}),'PULSE_APP_INVITE_INVALID');
  // B's own request opens B's window.
  delivered(await f.service.openInvite(f.request()),{accountGeneration:f.generation});assert.equal(f.windows[1].options.webPreferences.session,f.sessions.get(pulseAppPartition('account:synthetic-owner-b')));
  // Auth moves its epoch while the busy page has not run the offer, before PULSE hears of it: the document is handed nothing.
  const busy=heldRenderer(),g=fixture({renderer:busy.renderer});await g.service.open();const w=g.windows[0];
  const handing=g.service.openInvite(g.request());await tick();g.moveEpoch();busy.release();
  refused(await handing,'PULSE_APP_ACCOUNT_CHANGED');await settle();assert.deepEqual(w.page.commits,[null]);assert.deepEqual(w.page.received,[]);
  assert.doesNotMatch(JSON.stringify(w.page.posted),new RegExp(TOKEN));
});
test('a token renewal before the busy page runs the offer hands no token over, then or later, and keeps the window and its generation',async()=>{
  const busy=heldRenderer(),f=fixture({renderer:busy.renderer});await f.service.open();const w=f.windows[0],jar=f.latestSession,generation=f.generation;
  // PULSE hears of the renewal: the offer ends as pending at once.
  const handing=f.service.openInvite(f.request());await tick();f.renew('synthetic-owner-a');
  refused(await handing,'PULSE_APP_ACCOUNT_PENDING',{accountGeneration:generation,retryable:true});
  // PULSE has not heard of the next renewal when the page asks: the account is read at that moment.
  f.verified(member('synthetic-owner-a'));const quiet=f.service.openInvite(f.request(OTHER));await tick();f.renew('synthetic-owner-a',{notify:false});
  busy.releaseAll();refused(await quiet,'PULSE_APP_ACCOUNT_PENDING');await settle();
  assert.ok(w.page.commits.every(answer=>answer===null));assert.deepEqual(w.page.received,[]);assert.equal(w.page.href,ENTRY);
  assert.doesNotMatch(JSON.stringify(w.page.posted),/SYNTHETIC_invite-token/);
  assert.equal(w.destroyed,false);assert.equal(w.shown,1);assert.equal(jar.cleared,0);assert.equal(f.windows.length,1);assert.equal(f.generation,generation);
  // Verified again, the next invite is handed over under the same generation.
  f.verified(member('synthetic-owner-a'));const next=f.service.openInvite(f.request(OTHER));await tick();busy.release();
  delivered(await next,{accountGeneration:generation});assert.deepEqual(w.page.received,[OTHER]);
});
test('closing the window during a hand-off fails it at once, and a retry opens a fresh shell that takes the invite in memory',async()=>{
  const busy=heldRenderer(),g=fixture({renderer:busy.renderer,inviteTimeoutMs:60000});await g.service.open();const w=g.windows[0];
  const handing=g.service.openInvite(g.request());await tick();w.destroy();
  refused(await handing,'PULSE_APP_INVITE_FAILED');assert.equal(w.listenerCount('closed'),0);
  const retry=g.service.openInvite(g.request());await settle();assert.equal(g.windows.length,2);
  // The closed window's page runs its offer first and gets nothing; the new shell takes the retry.
  busy.releaseAll();delivered(await retry);
  assert.deepEqual(g.windows[1].loads,[ENTRY]);assert.deepEqual(g.windows[1].page.received,[TOKEN]);
  await settle();assert.deepEqual(w.page.commits,[null]);assert.deepEqual(w.page.received,[]);
});
test('a new document in the window ends the hand-off: before the token left main a failure, after it unconfirmed, and its late receipt changes nothing',async()=>{
  const busy=heldRenderer(),f=fixture({renderer:busy.renderer,inviteTimeoutMs:60000});await f.service.open();const w=f.windows[0];
  const before=f.service.openInvite(f.request());let ended=false;before.then(()=>{ended=true;});await tick();
  // A move inside the same document, or in a subframe, is no new document (current and older Electron arguments).
  w.webContents.emit('did-start-navigation',{isMainFrame:true,isSameDocument:true});w.webContents.emit('did-start-navigation',{},ENTRY+'#models',true,true);
  w.webContents.emit('did-start-navigation',{isMainFrame:false,isSameDocument:false});await tick();assert.equal(ended,false);
  w.webContents.emit('did-start-navigation',{isMainFrame:true,isSameDocument:false});
  refused(await before,'PULSE_APP_INVITE_FAILED');
  busy.release();await settle();assert.deepEqual(w.page.commits,[null]);assert.deepEqual(w.page.received,[]);
  // Once the token left main, a new document leaves the hand-off unconfirmed.
  w.page=fakePage(ENTRY,{stall:true});await settle();
  const after=f.service.openInvite(f.request(OTHER));await tick();busy.release();await settle();assert.deepEqual(w.page.commits.map(answer=>answer?.token),[OTHER]);
  w.webContents.emit('did-start-navigation',{},ENTRY,false,true);
  refused(await after,'PULSE_APP_INVITE_UNCONFIRMED',{retryable:false});
  // The page gets to the offer only now; its receipt is no delivery.
  w.page.resume();await settle();assert.deepEqual(w.page.received,[OTHER]);assert.equal(w.shown,1);assert.equal(w.sent.length,2);
});
test('a report in the old (id, outcome) form, from another frame, with other IDs, before the token left main or for an ended hand-off is never a delivery',async()=>{
  const busy=heldRenderer(),f=fixture({renderer:busy.renderer,inviteTimeoutMs:60000});await f.service.open();const w=f.windows[0];
  const report=(payload,frame=w.webContents.mainFrame)=>w.webContents.ipc.emit('synk:pulse-invite-result',{sender:w.webContents,senderFrame:frame},payload);
  const handing=f.service.openInvite(f.request());let ended=false;handing.then(()=>{ended=true;});await tick();const ids=pick(w.sent[0][1]);
  w.webContents.ipc.emit('synk:pulse-invite-result',{sender:w.webContents,senderFrame:w.webContents.mainFrame},ids.id,'delivered');
  report({...ids,documentId:null,outcome:'delivered'},{parent:null,url:ENTRY});
  for(const change of [{requestId:randomUUID()},{accountGeneration:randomUUID()},{id:'x'.repeat(32)},{outcome:'received'},{documentId:'not-a-document'}])report({...ids,documentId:null,outcome:'unavailable',...change});
  report({...ids,documentId:null,outcome:'delivered',extra:1});
  await tick();assert.equal(ended,false);
  // A delivery claimed before the token left main is only a failure.
  report({...ids,documentId:randomUUID(),outcome:'delivered'});
  refused(await handing,'PULSE_APP_INVITE_FAILED');
  // A late delivery for that ended hand-off changes nothing; the next hand-off decides on its own receipt.
  const next=f.service.openInvite(f.request(OTHER));await tick();report({...ids,documentId:randomUUID(),outcome:'delivered'});
  busy.releaseAll();delivered(await next);assert.deepEqual(w.page.received,[OTHER]);assert.equal(w.shown,2);
});
test('a received of another kind, destination or state, in another form, or for another request or document is no delivery',async()=>{
  for(const answer of [{kind:'staff'},{destination:'/'},{state:'pending'},{state:'received'}]){
    const f=fixture({page:{answer}});await f.service.open();
    refused(await f.service.openInvite(f.request()),'PULSE_APP_INVITE_UNCONFIRMED',{retryable:false});assert.deepEqual(f.windows[0].page.received,[TOKEN],JSON.stringify(answer));assert.equal(f.windows[0].shown,1);
  }
  for(const answer of [{extra:1},{requestId:randomUUID()},{accountGeneration:randomUUID()},{documentId:randomUUID()},{version:2},{channel:'synk.other'},null]){
    const f=fixture({page:{answer},inviteTimeoutMs:50});await f.service.open();
    refused(await f.service.openInvite(f.request()),'PULSE_APP_INVITE_UNCONFIRMED');assert.equal(f.windows[0].shown,1,JSON.stringify(answer));
  }
});
test('only a ready from this window and origin, for a receiver declared on the shell with a fresh document ID, makes the document ready',async()=>{
  const f=fixture({page:{ready:false},inviteTimeoutMs:50});await f.service.open();const w=f.windows[0];
  const ready={channel:'synk.company.entry',version:1,type:'ready',documentId:w.page.documentId,documentRole:'customer'};
  w.page.post(ready,{source:{}});w.page.post(ready,{origin:'https://evil.invalid'});
  for(const change of [{documentRole:'staff'},{version:2},{documentId:'not-a-document'},{extra:1}])w.page.post({...ready,...change});
  await settle();
  refused(await f.service.openInvite(f.request()),'PULSE_APP_INVITE_FAILED');assert.deepEqual(w.page.binds,[]);assert.deepEqual(w.page.commits,[]);
  // The document's own ready counts, and the next invite is handed over.
  w.page.announce();await settle();
  delivered(await f.service.openInvite(f.request()));assert.deepEqual(w.page.received,[TOKEN]);
  // A document put away takes its receiver along, and the same document ID declared again counts no more.
  w.page.hide();w.page.announce();await settle();
  refused(await f.service.openInvite(f.request(OTHER)),'PULSE_APP_INVITE_FAILED');assert.deepEqual(w.page.received,[TOKEN]);
});
test('an offer the busy page runs only after the bound gets no token: the window stays and the next attempt is free',async()=>{
  const busy=heldRenderer(),g=fixture({renderer:busy.renderer,inviteTimeoutMs:20});await g.service.open();const w=g.windows[0];
  for(const token of [TOKEN,OTHER])refused(await g.service.openInvite(g.request(token)),'PULSE_APP_INVITE_FAILED');
  assert.equal(w.destroyed,false);assert.equal(w.shown,1);assert.equal(w.sent.length,2);assert.equal(w.listenerCount('closed'),1);assert.equal(busy.count,2);
  // The page gets to both offers after main failed them: neither token reaches it.
  busy.releaseAll();await settle();
  assert.ok(w.page.commits.every(answer=>answer===null));assert.deepEqual(w.page.received,[]);assert.equal(w.page.href,ENTRY);
  assert.doesNotMatch(JSON.stringify(w.page.posted),/SYNTHETIC_invite-token/);
});
test('a token handed over without a receipt by the bound is reported unconfirmed, neither a delivery nor a plain failure, and is never sent again',async()=>{
  const f=fixture({page:{stall:true},inviteTimeoutMs:50});await f.service.open();const w=f.windows[0];
  refused(await f.service.openInvite(f.request()),'PULSE_APP_INVITE_UNCONFIRMED',{retryable:false});assert.deepEqual(w.page.commits.map(answer=>answer?.token),[TOKEN]);
  // The busy page gets to the offer only now and keeps the token, which is why the result did not say it failed.
  w.page.resume();await settle();assert.deepEqual(w.page.received,[TOKEN]);assert.equal(w.page.href,ENTRY);assert.equal(w.shown,1);
  assert.equal(w.sent.length,1);assert.equal(w.page.commits.length,1);
});
test('invites need the platform client and a settled account, and stop after disposal',async()=>{
  for(const clientId of ['messenger','world']){const f=fixture({clientId});refused(await f.service.openInvite(f.request()),'PULSE_APP_UNAVAILABLE',{retryable:false});assert.equal(f.windows.length,0);}
  const waiting=fixture({state:{status:'restoring',signedIn:false}}),pendingRequest=waiting.request();refused(await waiting.service.openInvite(pendingRequest),'PULSE_APP_ACCOUNT_PENDING',{requestId:pendingRequest.requestId,accountGeneration:pendingRequest.accountGeneration,retryable:true});assert.equal(waiting.windows.length,0);
  const f=fixture();await f.service.open();f.service.dispose();refused(await f.service.openInvite(f.request()),'PULSE_APP_UNAVAILABLE');assert.equal(f.windows.length,1);assert.deepEqual(f.windows[0].sent,[]);
});
// The window preload alone, with this window's messages put to it directly: what it posts, asks main and reports.
// Main's commit answer is the token for the request it was asked.
function preloadAlone(href=ENTRY){
  const url=new URL(href),listeners=new Map(),posted=[],sent=[],commits=[],fromMain=new Map();
  const window={addEventListener:(type,listener)=>{listeners.set(type,listener);},postMessage:(data,origin)=>{posted.push([structuredClone(data),origin]);}};
  const location={origin:url.origin,pathname:url.pathname,search:url.search,hash:url.hash},document={documentElement:{getAttribute:name=>name==='data-pulse-invite-receiver'?'2':null}};
  const ipcRenderer={on:(channel,listener)=>{fromMain.set(channel,listener);},send:(channel,payload)=>{sent.push([channel,structuredClone(payload)]);},sendSync:(channel,payload)=>{commits.push([channel,structuredClone(payload)]);return {...structuredClone(payload),token:TOKEN};}};
  vm.runInContext(fs.readFileSync(PRELOAD_FILE,'utf8'),vm.createContext({require:()=>({ipcRenderer}),window,location,document,setTimeout:()=>0,clearTimeout:()=>{}}),{filename:PRELOAD_FILE});
  return {posted,sent,commits,say:data=>listeners.get('message')({source:window,origin:ORIGIN,data:structuredClone(data)}),
    offer:value=>fromMain.get('synk:pulse-invite-offer')({},structuredClone(value)),abort:value=>fromMain.get('synk:pulse-invite-abort')({},structuredClone(value))};
}
const quick=(promise,ms=1000)=>Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve('slow'),ms).unref())]);
test('the window preload speaks the contract §3 messages exactly: phase deliver on bind and bound, token on offer, and only exact answers count',()=>{
  const head={channel:'synk.company.entry',version:1},documentId=randomUUID(),offer={id:'x'.repeat(32),requestId:randomUUID(),accountGeneration:randomUUID(),expectedAccountId:null};
  const p=preloadAlone(),ids={requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId};
  p.say({...head,type:'ready',documentId,documentRole:'customer'});p.offer(offer);
  assert.deepEqual(plain(p.posted),[[{...head,type:'bind',...ids,phase:'deliver',expectedAccountId:null},ORIGIN]]);
  // A bound without its phase, of another phase, or with a key more or less asks main for nothing.
  const bound={...head,type:'bound',...ids,phase:'deliver'},{phase:_phase,...noPhase}=bound;
  for(const value of [noPhase,{...bound,phase:'classify'},{...bound,phase:'resolve'},{...bound,extra:1},{...bound,expectedAccountId:null},{...bound,documentId:randomUUID()},{...bound,version:2}])p.say(value);
  assert.deepEqual(p.commits,[]);
  p.say(bound);
  assert.deepEqual(plain(p.commits),[['synk:pulse-invite-commit',{id:offer.id,...ids}]]);
  assert.deepEqual(plain(p.posted[1]),[{...head,type:'offer',...ids,token:TOKEN},ORIGIN]);assert.equal(Object.hasOwn(p.posted[1][0],'code'),false);assert.equal(p.posted.length,2);
  // An error with an unknown code, a retryable that is no boolean, another key, or for another request or document reports nothing.
  const error={...head,type:'error',...ids,code:'BUSY',retryable:true};
  for(const value of [{...error,code:'NOT_A_CODE'},{...error,code:'PULSE_APP_BUSY'},{...error,retryable:'true'},{...error,detail:'server text'},{...error,documentId:randomUUID()},{...error,requestId:randomUUID()}])p.say(value);
  assert.deepEqual(p.sent,[]);
  // The document's exact error once the token left main: a hand-off it did not confirm, which main keeps unconfirmed.
  p.say(error);assert.deepEqual(plain(p.sent),[['synk:pulse-invite-result',{id:offer.id,...ids,outcome:'not-received'}]]);
  // An error answering the bind ends that hand-off before main is asked for the token.
  const q=preloadAlone(),other={...offer,requestId:randomUUID()},otherIds={requestId:other.requestId,accountGeneration:other.accountGeneration,documentId};
  q.say({...head,type:'ready',documentId,documentRole:'customer'});q.offer(other);q.say({...head,type:'error',...otherIds,code:'ACCOUNT_MISMATCH',retryable:false});
  assert.deepEqual(q.commits,[]);assert.deepEqual(plain(q.sent),[['synk:pulse-invite-result',{id:other.id,...otherIds,outcome:'not-received'}]]);
  // Request IDs of other valid UUID versions are taken; only the exact received is a delivery.
  const r=preloadAlone(),third={...offer,requestId:V7,accountGeneration:V1},thirdIds={requestId:V7,accountGeneration:V1,documentId};
  r.say({...head,type:'ready',documentId,documentRole:'customer'});r.offer(third);r.say({...head,type:'bound',...thirdIds,phase:'deliver'});
  const received={...head,type:'received',...thirdIds,kind:'customer',destination:'/pulse-app/',state:'queued'};
  r.say({...received,token:TOKEN});r.say({...received,phase:'deliver'});assert.deepEqual(r.sent,[]);
  r.say(received);assert.deepEqual(plain(r.sent),[['synk:pulse-invite-result',{id:third.id,...thirdIds,outcome:'delivered'}]]);
  // A nil UUID or a version 9 is no request ID, and such an offer starts nothing.
  const s=preloadAlone();s.say({...head,type:'ready',documentId,documentRole:'customer'});
  for(const value of [{...offer,requestId:NIL},{...offer,accountGeneration:V9}])s.offer(value);
  assert.deepEqual(s.posted,[]);assert.deepEqual(s.sent,[]);
});
test('a bound of another phase or form gets no token, and the document\'s error ends the hand-off: on the bind a failure, after the offer unconfirmed and never sent again',async()=>{
  for(const boundAs of [value=>({...value,phase:'classify'}),value=>{const {phase:_phase,...rest}=value;return rest;},value=>({...value,extra:1})]){
    const f=fixture({page:{boundAs}});await f.service.open();const w=f.windows[0];
    refused(await f.service.openInvite(f.request()),'PULSE_APP_INVITE_FAILED',{retryable:true});
    assert.equal(w.page.binds.length,1);assert.deepEqual(w.page.commits,[]);assert.deepEqual(w.page.received,[]);assert.doesNotMatch(JSON.stringify(w.page.posted),new RegExp(TOKEN));
  }
  const atBind=fixture({page:{refuse:{at:'bind',code:'BUSY',retryable:true}},inviteTimeoutMs:60000});await atBind.service.open();
  const bindAnswer=await quick(atBind.service.openInvite(atBind.request()));
  refused(bindAnswer,'PULSE_APP_INVITE_FAILED',{retryable:true});
  assert.deepEqual(atBind.windows[0].page.commits,[]);assert.doesNotMatch(JSON.stringify(atBind.windows[0].page.posted),new RegExp(TOKEN));
  const atOffer=fixture({page:{refuse:{at:'offer',code:'BUSY',retryable:true}},inviteTimeoutMs:60000});await atOffer.service.open();const w=atOffer.windows[0];
  const offerAnswer=await quick(atOffer.service.openInvite(atOffer.request()));
  refused(offerAnswer,'PULSE_APP_INVITE_UNCONFIRMED',{retryable:false});
  assert.deepEqual(w.page.commits.map(answer=>answer?.token),[TOKEN]);assert.deepEqual(w.page.received,[]);assert.equal(w.sent.length,1);assert.deepEqual(w.page.strays,[]);
});
test('a request ID of another valid UUID version is taken end to end and answered with that same ID',async()=>{
  const f=fixture();await f.service.open();
  delivered(await f.service.openInvite({token:TOKEN,requestId:V7,accountGeneration:f.generation}),{requestId:V7,accountGeneration:f.generation});
  assert.deepEqual(f.windows[0].page.received,[TOKEN]);assert.equal(f.windows[0].sent[0][1].requestId,V7);
});
// main.cjs deliverCustomer: Promise.resolve(pulseApp.openInvite(request)).then(companyAnswerFromPulse).
test('the company entry\'s customer delivery reaches the open window in memory: its draft stays, nothing reloads, and the answer comes in the contract\'s codes',async()=>{
  const {companyAnswerFromPulse,UNCONFIRMED_CODE}=require('../src/company-entry.cjs');
  const f=fixture();await f.service.open();const w=f.windows[0];w.draft='합성 초안: 아직 보내지 않은 글';
  const request=f.request(),answer=companyAnswerFromPulse(await f.service.openInvite(request));
  assert.deepEqual(answer,{ok:true,requestId:request.requestId,accountGeneration:f.generation,state:'received',destination:'/pulse-app/'});
  assert.equal(w.draft,'합성 초안: 아직 보내지 않은 글');assert.equal(w.destroyed,false);assert.deepEqual(w.loads,[ENTRY]);assert.equal(f.windows.length,1);assert.deepEqual(w.page.received,[TOKEN]);
  // A request of another generation, a demo in use and a hand-off left unconfirmed come back in the contract's codes.
  const stale={token:OTHER,requestId:randomUUID(),accountGeneration:randomUUID()};
  assert.deepEqual(companyAnswerFromPulse(await f.service.openInvite(stale)),{ok:false,requestId:stale.requestId,accountGeneration:stale.accountGeneration,code:'ACCOUNT_CHANGED',retryable:false});
  const stalled=fixture({page:{stall:true},inviteTimeoutMs:50});await stalled.service.open();const late=stalled.request();
  assert.deepEqual(companyAnswerFromPulse(await stalled.service.openInvite(late)),{ok:false,requestId:late.requestId,accountGeneration:stalled.generation,code:UNCONFIRMED_CODE,retryable:false});
  w.page=fakePage(DEMO);const demo=f.request();
  assert.deepEqual(companyAnswerFromPulse(await f.service.openInvite(demo)),{ok:false,requestId:demo.requestId,accountGeneration:f.generation,code:'HANDOFF_UNAVAILABLE',retryable:false});
  assert.equal(w.draft,'합성 초안: 아직 보내지 않은 글');assert.deepEqual(w.loads,[ENTRY]);assert.doesNotMatch(JSON.stringify(answer),new RegExp(TOKEN));
});
// The portal's one public cancel (main.cjs, the company entry's cancel) reaches pulse-app.cjs cancelInvite with the
// invite's own {requestId,accountGeneration}; a customer code the company entry passed on is cancelled the same way.
test('the portal\'s cancel before the token left main ends the invite CANCELLED: the window, its document and drafts stay, and the busy page binds nothing more and asks for nothing',async()=>{
  const busy=heldRenderer(),f=fixture({renderer:busy.renderer,inviteTimeoutMs:60000});await f.service.open();const w=f.windows[0];
  w.draft='합성 초안: 아직 보내지 않은 글';
  const request=f.request(),handing=f.service.openInvite(request);await tick();
  const ids={requestId:request.requestId,accountGeneration:request.accountGeneration};
  // A cancel naming another request or generation, or in another form, changes nothing.
  for(const value of [{requestId:randomUUID(),accountGeneration:ids.accountGeneration},{requestId:ids.requestId,accountGeneration:randomUUID()},{...ids,extra:1},{requestId:ids.requestId},{...ids,requestId:ids.requestId.toUpperCase()},{...request},null,[ids]])
    assert.equal(f.service.cancelInvite(value),null,JSON.stringify(value));
  assert.equal(w.sent.length,1);
  refused(f.service.cancelInvite({...ids}),'CANCELLED',{...ids,retryable:true});
  refused(await handing,'CANCELLED',{...ids,retryable:true});
  // Main told the window's preload, after the offer and by the offer's own IDs.
  assert.equal(w.sent.length,2);assert.equal(w.sent[1][0],'synk:pulse-invite-abort');assert.deepEqual(w.sent[1][1],pick(w.sent[0][1]));
  // The busy page runs the offer and then the abort: the bound document is told to drop the binding, and main is never asked for the token.
  busy.releaseAll();await settle();
  assert.equal(w.page.binds.length,1);assert.deepEqual(w.page.commits,[]);assert.deepEqual(w.page.received,[]);
  assert.deepEqual(w.page.postedOf('cancel'),[{channel:'synk.company.entry',version:1,type:'cancel',...ids,documentId:w.page.documentId}]);
  assert.doesNotMatch(JSON.stringify(w.page.posted),new RegExp(TOKEN));
  // Nothing is closed, cleared or reloaded, and nothing claims a delivery.
  assert.equal(w.destroyed,false);assert.deepEqual(w.loads,[ENTRY]);assert.equal(f.windows.length,1);assert.equal(w.draft,'합성 초안: 아직 보내지 않은 글');assert.equal(w.shown,1);assert.equal(f.latestSession.cleared,0);
  // The same cancel again changes nothing, and the next invite is handed over normally.
  assert.equal(f.service.cancelInvite({...ids}),null);
  const next=f.service.openInvite(f.request(OTHER));await tick();busy.releaseAll();delivered(await next);
  assert.deepEqual(w.page.received,[OTHER]);assert.deepEqual(w.loads,[ENTRY]);
});
test('the portal\'s cancel once the token left main is unconfirmed, never undone or sent again, and leaves the document and its drafts alone',async()=>{
  const f=fixture({page:{stall:true},inviteTimeoutMs:60000});await f.service.open();const w=f.windows[0];
  w.draft='합성 초안';
  const request=f.request(),handing=f.service.openInvite(request);await settle();
  // The page was handed the token and will keep it when it gets to the offer.
  assert.deepEqual(w.page.commits.map(answer=>answer?.token),[TOKEN]);
  const ids={requestId:request.requestId,accountGeneration:request.accountGeneration};
  refused(f.service.cancelInvite({...ids}),'PULSE_APP_INVITE_UNCONFIRMED',{...ids,retryable:false});
  refused(await handing,'PULSE_APP_INVITE_UNCONFIRMED',{...ids,retryable:false});
  assert.equal(w.sent.at(-1)[0],'synk:pulse-invite-abort');
  await settle();
  // The preload only stops: the document holding the token is told nothing, and nothing is reported.
  assert.deepEqual(w.page.postedOf('cancel'),[]);
  w.page.resume();await settle();
  assert.deepEqual(w.page.received,[TOKEN]);assert.equal(w.page.commits.length,1);assert.equal(w.sent.filter(([channel])=>channel==='synk:pulse-invite-offer').length,1);
  assert.equal(w.destroyed,false);assert.deepEqual(w.loads,[ENTRY]);assert.equal(w.draft,'합성 초안');assert.equal(w.shown,1);
  assert.equal(f.service.cancelInvite({...ids}),null);
});
test('a cancel while the shell is still opening answers CANCELLED at once: the window opens as an ordinary opening and is handed nothing',async()=>{
  let loaded;const f=fixture({load:()=>new Promise(resolve=>{loaded=resolve;})});
  const request=f.request(),inviting=f.service.openInvite(request);await tick();
  const ids={requestId:request.requestId,accountGeneration:request.accountGeneration};
  refused(f.service.cancelInvite({...ids}),'CANCELLED',{...ids,retryable:true});
  refused(await inviting,'CANCELLED',{...ids,retryable:true});
  // The shell is still opening: another invite is busy, and a plain opening joins it.
  refused(await f.service.openInvite(f.request(OTHER)),'PULSE_APP_BUSY');
  const joined=f.service.open();loaded();
  assert.deepEqual(await joined,{ok:true,id:'pulse'});await settle();
  const w=f.windows[0];assert.equal(f.windows.length,1);assert.deepEqual(w.loads,[ENTRY]);assert.deepEqual(w.sent,[]);assert.deepEqual(w.page.commits,[]);assert.deepEqual(w.page.received,[]);assert.equal(w.destroyed,false);
  // The next invite goes to the open window.
  delivered(await f.service.openInvite(f.request(OTHER)));assert.deepEqual(w.page.received,[OTHER]);assert.deepEqual(w.loads,[ENTRY]);
});
test('the window preload drops a hand-off main ended: a bound document without the token is told to drop the binding, and nothing more is asked or reported',()=>{
  const head={channel:'synk.company.entry',version:1},documentId=randomUUID(),offer={id:'x'.repeat(32),requestId:randomUUID(),accountGeneration:randomUUID(),expectedAccountId:null};
  const ids={requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId},end=pick(offer);
  // Bound but not yet handed the token.
  const p=preloadAlone();
  p.say({...head,type:'ready',documentId,documentRole:'customer'});p.offer(offer);
  assert.equal(p.posted.length,1);
  // An abort in another form, or for another hand-off, changes nothing.
  for(const value of [{...end,id:'y'.repeat(32)},{...end,requestId:randomUUID()},{...end,accountGeneration:randomUUID()},{...end,extra:1},{id:end.id,requestId:end.requestId},{...end,id:'x'.repeat(31)},{...end,requestId:NIL},null,end.id])p.abort(value);
  assert.equal(p.posted.length,1);
  p.abort(end);
  assert.deepEqual(plain(p.posted[1]),[{...head,type:'cancel',...ids},ORIGIN]);
  // The document's late bound asks main for nothing, and nothing is reported.
  p.say({...head,type:'bound',...ids,phase:'deliver'});
  assert.deepEqual(p.commits,[]);assert.deepEqual(p.sent,[]);assert.equal(p.posted.length,2);
  // Still waiting for a ready document: nothing was posted, so nothing is posted now, and a later ready binds nothing.
  const q=preloadAlone();q.offer(offer);q.abort(end);q.say({...head,type:'ready',documentId,documentRole:'customer'});
  assert.deepEqual(q.posted,[]);assert.deepEqual(q.commits,[]);assert.deepEqual(q.sent,[]);
  // Once the document holds the token the preload only stops: no cancel, no report, the document is left as it is.
  const r=preloadAlone();
  r.say({...head,type:'ready',documentId,documentRole:'customer'});r.offer(offer);r.say({...head,type:'bound',...ids,phase:'deliver'});
  assert.equal(r.commits.length,1);assert.equal(r.posted.length,2);
  r.abort(end);
  r.say({...head,type:'received',...ids,kind:'customer',destination:'/pulse-app/',state:'queued'});
  assert.equal(r.posted.length,2);assert.deepEqual(r.sent,[]);
});
test('the PC app no longer opens the old customer lounge, which now redirects to the PULSE app',()=>{
  // workspace.synk.im/pulse/ answers 302 → /pulse-app/; the platform's own invite
  // broker and review window were removed with it. Only the customer API stays.
  // 옛 PULSE 요청 화면(renderer/pulse-client.mjs)은 PC 0.5.0에서 옛 보기와 함께 거뒀다
  const files=['src/main.cjs','src/preload.cjs','src/pulse-app.cjs','renderer/launcher.mjs'];
  const source=files.map(file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8')).join('\n');
  assert.doesNotMatch(source,/synk:pulse-request|pulseRequest\b|pulse-requests|pulse-workflow/);
  for(const [found] of source.matchAll(/\/pulse\/[^'"`\s)]*/g))assert.match(found,/^\/pulse\/api\//,found);
  for(const file of ['src/pulse-requests.cjs','renderer/pulse-workflow.mjs','renderer/pulse-workflow.css','renderer/pulse-client.mjs'])assert.equal(fs.existsSync(path.join(__dirname,'..',file)),false,file);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'../renderer/index.html'),'utf8'),/pulse-workflow/);
});
