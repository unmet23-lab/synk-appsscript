'use strict';
// PULSE keeps its window, drafts and storage through a token renewal of the same SYNK ID. Before 2026-11-14 a
// same-account refresh passed 'restoring' without the account, and PULSE took it for an account change: it closed
// the window and cleared its storage (reproduced with the real auth and PULSE services). Another account, a sign-out
// and a confirmed rejection still close and clear it. The real auth service and the real PULSE service are wired
// here as main.cjs wires them; only the transport is synthetic.
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{randomUUID}=require('node:crypto');
const {createPulseApp,pulseAppPartition,PULSE_APP_ENTRY:ENTRY}=require('../src/pulse-app.cjs');
const {createPlatformAuth,loadPlatformMain,PEOPLE,HOUR,tick,reply}=require('./synthetic-platform-auth.cjs');
const {fakePage,pulseContents}=require('./pulse-page-double.cjs');
const A=PEOPLE.a,B=PEOPLE.b,TOKEN='SYNTHETIC_invite-token_0001',DRAFT='합성 초안: 아직 보내지 않은 글',UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Stand-ins for Electron's BrowserWindow, session and dialog that record what PULSE does with them. Each document is
// a pulse-page-double.cjs page that keeps the receipt contract, with the window's real preload over it.
function electron(){
  const windows=[],jars=new Map(),dialogs=[];
  class Window extends EventEmitter{
    constructor(options){super();this.options=options;this.destroyed=false;this.loads=[];this.sent=[];this.webContents=pulseContents(this);windows.push(this);}
    get page(){return this.document;}set page(value){this.document=value;value.attach(this.webContents);}
    async loadURL(url){this.url=url;this.loads.push(url);this.page=fakePage(url);}
    isDestroyed(){return this.destroyed;}isMinimized(){return false;}restore(){}show(){}focus(){}destroy(){this.destroyed=true;this.emit('closed');}
  }
  const session={fromPartition(partition){if(!jars.has(partition)){const jar=new EventEmitter();Object.assign(jar,{partition,cleared:0,cacheCleared:0,setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onBeforeRequest(){}},async clearStorageData(){this.cleared++;},async clearCache(){this.cacheCleared++;}});jars.set(partition,jar);}return jars.get(partition);}};
  return {Window,session,windows,dialogs,dialog:{showMessageBoxSync:(_window,options)=>{dialogs.push(options);return 0;}},jar:scope=>session.fromPartition(pulseAppPartition(scope))};
}
// A signed-in A with an open PULSE window holding an unsent draft.
async function fixture(t){
  let pulse;const e=electron();
  const auth=await createPlatformAuth(t,{onChange:state=>pulse?.syncContext(state)});
  assert.equal((await auth.service.initialize()).signedIn,true);
  pulse=createPulseApp({clientId:'platform',getAccount:()=>auth.service.status(),getRenewingAccount:()=>auth.service.renewingAccountId(),getAccountGeneration:()=>auth.service.accountGeneration(),BrowserWindow:e.Window,session:e.session,dialog:e.dialog,openExternal:async()=>{},getDownloads:()=>'/synthetic/downloads',loadTimeoutMs:1000,inviteTimeoutMs:1000});
  t.after(()=>pulse.dispose());
  assert.equal((await pulse.open()).ok,true);const window=e.windows[0];window.draft=DRAFT;
  return {auth,pulse,e,window,jarA:e.jar('account:'+A.id)};
}
const kept=(f,label)=>{assert.equal(f.window.destroyed,false,label);assert.equal(f.window.draft,DRAFT,label);assert.equal(f.jarA.cleared,0,label);assert.equal(f.jarA.cacheCleared,0,label);assert.deepEqual(f.e.dialogs,[],label);};
const closed=(f,label)=>{assert.equal(f.window.destroyed,true,label);assert.equal(f.jarA.cleared,1,label);assert.equal(f.jarA.cacheCleared,1,label);};

test('a same-account token renewal keeps the PULSE window, its draft and its storage, and opens nothing new until verified',async t=>{
  const f=await fixture(t),generation=f.auth.service.accountGeneration(),verifying=f.auth.hold('/auth/v1/user');f.auth.advance(HOUR);
  // The wire generation is a UUID auth issued for its epoch, never the numeric sessionGeneration.
  assert.match(generation,UUID);assert.equal(f.auth.service.status().accountGeneration,generation);assert.equal(typeof f.auth.service.status().sessionGeneration,'number');
  const renewal=f.auth.service.getAccessToken();await verifying.arrived;
  // The renderer's state still says restoring without the account; only main's private question names it.
  const status=f.auth.service.status();
  assert.equal(status.status,'restoring');assert.equal(status.signedIn,false);assert.equal(status.account,null);assert.deepEqual(status.library,{status:'unavailable',appIds:[]});
  assert.equal(f.auth.service.renewingAccountId(),A.id);assert.doesNotMatch(JSON.stringify(status),new RegExp(A.id));
  // The renewal stays in auth's epoch, so the generation a renderer holds stays valid.
  assert.equal(status.accountGeneration,generation);assert.equal(f.auth.service.accountGeneration(),generation);
  kept(f,'during the renewal');
  assert.deepEqual(await f.pulse.open(),{ok:false,code:'PULSE_APP_ACCOUNT_PENDING'});
  const waiting={token:TOKEN,requestId:randomUUID(),accountGeneration:generation};
  assert.deepEqual(await f.pulse.openInvite(waiting),{ok:false,requestId:waiting.requestId,accountGeneration:generation,code:'PULSE_APP_ACCOUNT_PENDING',retryable:true});
  // A lone {token} is malformed whatever the account is doing, and names no request.
  assert.deepEqual(await f.pulse.openInvite({token:TOKEN}),{ok:false,requestId:null,accountGeneration:null,code:'PULSE_APP_INVITE_INVALID',retryable:false});
  assert.equal(f.e.windows.length,1);assert.deepEqual(f.window.sent,[]);
  verifying.release();assert.match(await renewal,/^synthetic-access-a-/);
  assert.equal(f.auth.service.status().signedIn,true);assert.equal(f.auth.service.renewingAccountId(),null);assert.match(f.auth.vault.refreshToken,/^synthetic-refresh-a-/);
  kept(f,'after the renewal');
  assert.deepEqual(await f.pulse.open(),{ok:true,id:'pulse',independentWindow:true,reused:true});
  // A request the renderer made before the renewal is still this account's, and reaches the open document in memory.
  const requestId=randomUUID();
  assert.deepEqual(await f.pulse.openInvite({token:TOKEN,requestId,accountGeneration:generation}),{ok:true,requestId,accountGeneration:generation,state:'received',destination:'/pulse-app/'});
  assert.equal(f.e.windows.length,1);assert.deepEqual(f.window.loads,[ENTRY]);assert.deepEqual(f.window.page.received,[TOKEN]);
});

test('a retryable renewal failure keeps the window until the retry verifies the same account',async t=>{
  for(const failure of ['token-connection','auth-user-unavailable','account-unavailable']){
    const f=await fixture(t);f.auth.advance(HOUR);
    if(failure==='token-connection')f.auth.next('/auth/v1/oauth/token',{method:'POST'},()=>{throw Error('synthetic transport loss');});
    if(failure==='auth-user-unavailable')f.auth.next('/auth/v1/user',{},()=>reply({msg:'unavailable'},503));
    if(failure==='account-unavailable')f.auth.next('/functions/v1/synk-account',{},()=>reply({ok:false,error:{code:'SERVER_UNAVAILABLE'}},503));
    await assert.rejects(f.auth.service.getAccessToken(),error=>error.retryable===true,failure);
    const status=f.auth.service.status();assert.equal(status.status,'error',failure);assert.equal(status.signedIn,false,failure);assert.equal(status.account,null,failure);assert.equal(status.error.retryable,true,failure);
    assert.equal(f.auth.service.renewingAccountId(),A.id,failure);kept(f,failure);
    assert.equal((await f.pulse.open()).code,'PULSE_APP_ACCOUNT_PENDING',failure);assert.equal((await f.pulse.openInvite({token:TOKEN,requestId:randomUUID(),accountGeneration:f.auth.service.accountGeneration()})).code,'PULSE_APP_ACCOUNT_PENDING',failure);
    // The retry verifies the same account: the same window comes forward and nothing was cleared.
    assert.match(await f.auth.service.getAccessToken(),/^synthetic-access-a-/,failure);
    assert.equal(f.auth.service.status().signedIn,true,failure);kept(f,failure+' retried');
    assert.equal((await f.pulse.open()).reused,true,failure);assert.equal(f.e.windows.length,1,failure);
  }
});

test('another account signing in during the renewal closes A\'s window and storage, and the late A answer restores nothing',async t=>{
  const f=await fixture(t),generationA=f.auth.service.accountGeneration(),verifying=f.auth.hold('/auth/v1/user',{when:call=>call.owner==='a'});f.auth.advance(HOUR);
  const renewal=f.auth.service.getAccessToken();await verifying.arrived;kept(f,'before B');
  await f.auth.signInAs('b');await tick();
  closed(f,'B signed in');assert.equal(f.auth.service.renewingAccountId(),null);
  verifying.release();await assert.rejects(renewal,{code:'AUTH_CHANGED'});await tick();
  const status=f.auth.service.status();assert.equal(status.signedIn,true);assert.equal(status.account.synk_user_id,B.id);
  closed(f,'after the late A answer');
  // B's sign-in moved auth's epoch: a request a stale screen made for A's generation opens nothing for B.
  assert.notEqual(status.accountGeneration,generationA);assert.equal(status.accountGeneration,f.auth.service.accountGeneration());
  const requestId=randomUUID(),stale=await f.pulse.openInvite({token:TOKEN,requestId,accountGeneration:generationA});
  assert.deepEqual(stale,{ok:false,requestId,accountGeneration:generationA,code:'PULSE_APP_ACCOUNT_CHANGED',retryable:false});assert.equal(f.e.windows.length,1);
  const opened=await f.pulse.open();assert.equal(opened.ok,true);assert.equal(opened.reused,undefined);
  assert.equal(f.e.windows.length,2);assert.equal(f.e.windows[1].options.webPreferences.session,f.e.jar('account:'+B.id));assert.notEqual(f.e.jar('account:'+B.id),f.jarA);
});

test('signing out during the renewal closes the window and clears its storage, and the late answer restores nothing',async t=>{
  const f=await fixture(t),generationA=f.auth.service.accountGeneration(),verifying=f.auth.hold('/auth/v1/user');f.auth.advance(HOUR);
  const renewal=f.auth.service.getAccessToken();await verifying.arrived;
  assert.equal((await f.auth.service.signOut()).status.signedIn,false);await tick();
  closed(f,'signed out');assert.equal(f.auth.service.renewingAccountId(),null);assert.notEqual(f.auth.service.accountGeneration(),generationA);
  verifying.release();await assert.rejects(renewal,{code:'AUTH_CHANGED'});await tick();
  assert.equal(f.auth.service.status().status,'signed-out');assert.equal(f.auth.vault,null);closed(f,'after the late answer');
  // Only a guest window opens now, in the guest storage.
  assert.equal((await f.pulse.open()).ok,true);assert.equal(f.e.windows[1].options.webPreferences.session,f.e.jar('guest'));
});

test('a confirmed rejection of the renewal clears the account window and lets the signed-out guest open a separate window',async t=>{
  for(const rejection of ['refresh-token-refused','auth-user-refused','session-revoked']){
    const f=await fixture(t);f.auth.advance(HOUR);
    if(rejection==='refresh-token-refused')f.auth.next('/auth/v1/oauth/token',{method:'POST'},()=>reply({error:'invalid_grant'},400));
    if(rejection==='auth-user-refused')f.auth.next('/auth/v1/user',{},()=>reply({msg:'invalid token'},401));
    if(rejection==='session-revoked')f.auth.next('/functions/v1/synk-account',{},()=>reply({ok:false,error:{code:'SESSION_REVOKED'}},403));
    await assert.rejects(f.auth.service.getAccessToken(),{code:'AUTH_REQUIRED'},rejection);await tick();
    const status=f.auth.service.status();assert.equal(status.status,'signed-out',rejection);assert.equal(status.error.code,'AUTH_REQUIRED',rejection);assert.equal(f.auth.vault,null,rejection);
    assert.equal(f.auth.service.renewingAccountId(),null,rejection);closed(f,rejection);
    assert.equal((await f.pulse.open()).ok,true,rejection);assert.equal(f.e.windows.length,2,rejection);
    assert.equal(f.e.windows[1].options.webPreferences.session,f.e.jar('guest'),rejection);
    assert.notEqual(f.e.jar('guest'),f.jarA,rejection);closed(f,rejection+' after guest open');
  }
});

// Quitting is no sign-out. main.cjs disposes PULSE only in will-quit, after the draft guards accepted, and disposes
// auth right after; auth keeps the encrypted vault, so the next launch restores the same SYNK ID and its PULSE jar.
test('quitting during a same-account renewal closes the window with the app, and A\'s jar and sign-in open again at the next launch',async t=>{
  const f=await fixture(t),verifying=f.auth.hold('/auth/v1/user');f.auth.advance(HOUR);
  const renewal=f.auth.service.getAccessToken();await verifying.arrived;kept(f,'before quitting');
  f.pulse.dispose();f.auth.service.dispose();
  assert.equal(f.window.destroyed,true);await tick();assert.equal(f.jarA.cleared,0);assert.equal(f.jarA.cacheCleared,0);
  verifying.release();await assert.rejects(renewal,{code:'AUTH_CHANGED'});await tick();
  assert.equal(f.jarA.cleared,0);assert.equal(f.jarA.cacheCleared,0);
  assert.match(f.auth.vault.refreshToken,/^synthetic-refresh-a-/);assert.equal(f.auth.vault.subject,A.subject);
  const next=f.auth.relaunch();assert.equal((await next.initialize()).account.synk_user_id,A.id);
  const pulse=createPulseApp({clientId:'platform',getAccount:()=>next.status(),getRenewingAccount:()=>next.renewingAccountId(),getAccountGeneration:()=>next.accountGeneration(),BrowserWindow:f.e.Window,session:f.e.session,dialog:f.e.dialog,openExternal:async()=>{},getDownloads:()=>'/synthetic/downloads'});
  t.after(()=>pulse.dispose());
  assert.equal((await pulse.open()).ok,true);assert.equal(f.e.windows.length,2);assert.equal(f.e.windows[1].options.webPreferences.session,f.jarA);
  assert.equal(f.jarA.cleared,0);assert.equal(f.jarA.cacheCleared,0);
});

test('main hands PULSE the renewal it reads privately from auth, and none while the sign-in suite masks the account',async()=>{
  const restoring={configured:true,status:'restoring',signedIn:false,sessionGeneration:2,secureStorage:true,account:null,learningSync:false,library:{status:'unavailable',appIds:[]},onboarding:null,error:null};
  const f=await loadPlatformMain({status:restoring,renewing:A.id});
  assert.equal(f.pulseOptions.getRenewingAccount(),A.id);assert.equal(f.pulseOptions.getAccount().status,'restoring');
  // auth's generation reaches PULSE from main the same way, and is masked with the renewal.
  const generation=randomUUID();f.control.generation=generation;assert.equal(f.pulseOptions.getAccountGeneration(),generation);
  f.control.suiteAvailable=false;assert.equal(f.pulseOptions.getRenewingAccount(),null);assert.equal(f.pulseOptions.getAccountGeneration(),null);
  f.control.suiteAvailable=true;assert.equal(f.pulseOptions.getAccountGeneration(),generation);f.control.renewing=null;assert.equal(f.pulseOptions.getRenewingAccount(),null);
  // The renderer never receives it: neither the status call nor the change notice names the account.
  f.control.renewing=A.id;assert.doesNotMatch(JSON.stringify(await f.handlers.get('synk:auth-status')(f.event)),new RegExp(A.id));
  f.authOptions.onChange(restoring);assert.ok(f.sent.some(([channel])=>channel==='synk:auth-changed'));assert.doesNotMatch(JSON.stringify(f.sent),new RegExp(A.id));
});
