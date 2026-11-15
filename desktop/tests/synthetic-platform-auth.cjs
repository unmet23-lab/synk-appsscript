'use strict';
// Shared by pulse-auth-renewal.test.cjs and purpose-onboarding.test.cjs; not a test file itself.
// createPlatformAuth runs the real auth service (auth-service.cjs) over a synthetic transport. Nothing leaves this
// process except the auth service's own sign-in callback on 127.0.0.1, which the test calls itself. No browser,
// real login, server, database or stored secret is used. Each synthetic SYNK ID has its own Auth subject, account
// ID and tokens, so a token reaching the account server always names its owner.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {configuration}=require('../src/auth-config.cjs');
const {createAuthService}=require('../src/auth-service.cjs');
const {PLATFORM_ENTRY}=require('../src/catalog.cjs');

const SRC=path.join(__dirname,'../src'),ORIGIN='https://synthetic-platform-auth.invalid',HOUR=3600*1000;
const PEOPLE=Object.freeze({
  a:Object.freeze({subject:'synthetic-subject-a',id:'00000000-0000-4000-8000-00000000000a',name:'합성 회원 A',session:'00000000-0000-4000-8000-0000000000aa'}),
  b:Object.freeze({subject:'synthetic-subject-b',id:'00000000-0000-4000-8000-00000000000b',name:'합성 회원 B',session:'00000000-0000-4000-8000-0000000000bb'}),
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function waitFor(check,label){for(let i=0;i<1500;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,2));}assert.fail('Timed out waiting for '+label);}
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
async function freePort(){const probe=http.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const {port}=probe.address();await new Promise(resolve=>probe.close(resolve));return port;}

// client: an auth-config client ID. saved: whose sign-in the encrypted vault already holds.
// onboarding: each person's server state, 'pending', 'none' or 'missing' (an older server without the field).
// server.completions lists the completions the server stored, one at most per person.
async function createPlatformAuth(t,{client='platform',saved='a',onboarding={},onChange=()=>{}}={}){
  const raw={version:1,supabaseUrl:ORIGIN,accountApiUrl:ORIGIN,supabasePublishableKey:'sb_publishable_synthetic',clients:{[client]:{clientId:'synthetic-'+client,redirectUri:`http://127.0.0.1:${await freePort()}/synk/oauth/${client}/callback`}}};
  const config=configuration(raw,client,'development'),server={onboarding:{a:'pending',b:'pending',...onboarding},completions:[]};
  const calls=[],intercepts=[],opened=[],states=[],codes=new Map(),refreshTokens=new Map(),accessTokens=new Map();let clock=1_000_000,serial=0;
  const issue=who=>{serial++;const accessToken=`synthetic-access-${who}-${serial}`,refreshToken=`synthetic-refresh-${who}-${serial}`;accessTokens.set(accessToken,who);refreshTokens.set(refreshToken,who);return {accessToken,refreshToken};};
  let vault=saved?{refreshToken:issue(saved).refreshToken,subject:PEOPLE[saved].subject}:null;
  // The synthetic servers: Auth (token, user, logout) and the SYNK account function as the SYNK-talk contract answers.
  function answer(call){
    const who=call.owner;
    if(call.path==='/auth/v1/oauth/token'){
      const refreshing=call.form.get('grant_type')==='refresh_token',book=refreshing?refreshTokens:codes,key=call.form.get(refreshing?'refresh_token':'code'),person=book.get(key);
      book.delete(key);if(!person)return reply({error:'invalid_grant'},400);
      const issued=issue(person);return reply({token_type:'bearer',access_token:issued.accessToken,refresh_token:issued.refreshToken,expires_in:3600});
    }
    if(call.path==='/auth/v1/user')return who?reply({id:PEOPLE[who].subject}):reply({msg:'invalid token'},401);
    if(call.path==='/auth/v1/logout')return new Response(null,{status:204});
    if(call.path==='/functions/v1/synk-account'){
      if(!who)return reply({ok:false,error:{code:'AUTH_REQUIRED',message:'AUTH_REQUIRED'}},401);
      if(call.method==='GET'){
        // Like SYNK-talk lib/synk-account-purpose-onboarding.js: only a platform GET without a query carries the state.
        const state=server.onboarding[who],carries=call.headers['X-SYNK-Product']==='platform'&&!call.query&&state!=='missing';
        return reply({ok:true,account:{synk_user_id:PEOPLE[who].id,status:'active',profile:{display_name:PEOPLE[who].name}},memberships:[],entitlements:[{product:'platform',key:'library.pulse'}],sessions:[{id:PEOPLE[who].session,current:true,revoked:false}],...(carries?{onboarding:{purpose:state}}:{})});
      }
      const body=JSON.parse(call.body);
      // As SYNK-talk closes it (④): only an open question closes, and the outcome that first closed it stays. A repeat,
      // or an account without an open question, stores nothing and still answers none.
      if(body.action==='purpose-onboarding-complete'){if(server.onboarding[who]==='pending'){server.completions.push({who,outcome:body.outcome});server.onboarding[who]='none';}return reply({ok:true,onboarding:{purpose:'none'}});}
      if(body.action==='revoke-session')return reply({ok:true,current:true,refreshRevoked:true});
      return reply({ok:false,error:{code:'INVALID_ACTION',message:'INVALID_ACTION'}},400);
    }
    throw Error('Unexpected synthetic path '+call.path);
  }
  // Abort signals are ignored on purpose: a held answer still arrives late, as a slow network can deliver it.
  const fetcher=async(url,options={})=>{
    const parsed=new URL(url);assert.equal(parsed.origin,ORIGIN,'only the synthetic transport is called');
    const headers=options.headers||{},token=/^Bearer (.+)$/.exec(headers.Authorization||'')?.[1]||null;
    const call={path:parsed.pathname,query:parsed.search,method:options.method||'GET',headers,token,owner:accessTokens.get(token)||null,form:options.body instanceof URLSearchParams?options.body:null,body:typeof options.body==='string'?options.body:null};
    call.respond=()=>answer(call);calls.push(call);
    const at=intercepts.findIndex(entry=>entry.path===call.path&&entry.method===call.method&&(!entry.when||entry.when(call)));
    if(at<0)return answer(call);
    const [entry]=intercepts.splice(at,1);return entry.handle(call);
  };
  // The next matching call waits for release(). Its answer is the server's at the moment it arrived (a late
  // response) unless release() gets a replacement; respondAtCall:false leaves the server untouched until then.
  function hold(pathname,{method='GET',when,respondAtCall=true}={}){
    let release,reached;const gate=new Promise(resolve=>{release=resolve;}),arrived=new Promise(resolve=>{reached=resolve;});
    intercepts.push({path:pathname,method,when,handle:async call=>{const early=respondAtCall?call.respond():null;reached(call);const replacement=await gate;return replacement||early||call.respond();}});
    return {arrived,release:replacement=>release(replacement)};
  }
  // The next matching call gets this answer instead; a handler that throws is a lost connection.
  function next(pathname,{method='GET',when}={},handle){intercepts.push({path:pathname,method,when,handle:async call=>handle(call)});}
  const store={available:()=>true,load:async()=>vault&&{...vault},save:async value=>{vault={...value};},clear:async()=>{vault=null;}};
  const launch=(changed=()=>{})=>{const value=createAuthService({config,store,fetcher,now:()=>clock,timeoutMs:5000,openExternal:async url=>{opened.push(url);},onChange:state=>{states.push(state);changed(state);}});t.after(()=>value.dispose());return value;};
  const service=launch(onChange);
  // The app's next launch: a new auth service over the same encrypted vault and synthetic servers, as main.cjs builds it.
  const relaunch=({onChange:changed}={})=>launch(changed);
  // A browser sign-in finished by the test: the loopback callback gets a fresh code for that person.
  async function signInAs(who){
    const before=opened.length;await service.signIn();assert.equal(opened.length,before+1,'the sign-in opened the browser page once');
    const authorize=new URL(opened.at(-1)),callback=new URL(authorize.searchParams.get('redirect_uri')),code=`synthetic-code-${who}-${++serial}`;
    codes.set(code,who);callback.search=new URLSearchParams({code,state:authorize.searchParams.get('state')}).toString();
    const response=await fetch(callback);await response.text();assert.equal(response.status,200);
    await waitFor(()=>service.status().signedIn===true&&service.status().account?.synk_user_id===PEOPLE[who].id,'the synthetic sign-in of '+who);
  }
  const completionCalls=()=>calls.filter(call=>call.path==='/functions/v1/synk-account'&&call.method==='POST'&&JSON.parse(call.body).action==='purpose-onboarding-complete');
  return {service,config,server,calls,states,hold,next,signInAs,completionCalls,relaunch,advance:ms=>{clock+=ms;},get vault(){return vault;}};
}

// Runs the shipped main.cjs for the platform with Electron, auth, suite and PULSE stand-ins, as
// portal-navigation.test.cjs does, to read what main hands to PULSE and to the window.
// control.status is the auth snapshot, control.renewing what auth's renewingAccountId answers,
// and control.suiteAvailable whether the sign-in suite masks it (suite-session.cjs project).
async function loadPlatformMain({status,renewing=null,suiteAvailable=true}={}){
  const control={status,renewing,suiteAvailable},runtime={clientId:'platform',mode:'development',entry:PLATFORM_ENTRY,auth:null};
  const app=new EventEmitter(),handlers=new Map(),sent=[],frame={url:PLATFORM_ENTRY};let pulseOptions=null,authOptions=null;
  Object.assign(app,{isPackaged:true,enableSandbox(){},setName(){},setPath(){},getPath:name=>name==='home'?'C:\\Users\\synthetic':'/synthetic',getAppPath:()=>'/synthetic/app',getVersion:()=> '0.4.0',setAppUserModelId(){},getLoginItemSettings:()=>({openAtLogin:false}),requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve()});
  const contents=new EventEmitter();Object.assign(contents,{mainFrame:frame,getURL:()=>frame.url,setWindowOpenHandler(){},setZoomFactor(){},send:(channel,value)=>{sent.push([channel,value]);}});
  class Window extends EventEmitter{constructor(options){super();this.webContents=contents;this.options=options;}isDestroyed(){return false;}isMinimized(){return false;}isMaximized(){return false;}getNormalBounds(){return {x:this.options.x||0,y:this.options.y||0,width:this.options.width,height:this.options.height};}show(){}focus(){}}
  const ownSession={setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onBeforeRequest(){},onHeadersReceived(){}},removeAllListeners(){},on(){},protocol:{handle(){}}};
  const noop=()=>({});
  const publisher={initialize:async()=>{},refresh:()=>control.suiteAvailable,available:()=>control.suiteAvailable,publish(){},beginSignIn:()=>true,signOut:()=>true,dispose(){},
    project:state=>control.suiteAvailable?state:{...state,status:'error',signedIn:false,account:null,library:{status:'unavailable',appIds:[]},error:{code:'SUITE_UNAVAILABLE',message:'synthetic',retryable:true}}};
  const stubs={
    electron:{app,BrowserWindow:Window,ipcMain:{removeHandler(){},handle:(name,handler)=>handlers.set(name,handler)},session:{fromPartition:()=>ownSession},protocol:{registerSchemesAsPrivileged(){}},Menu:{setApplicationMenu(){}},shell:{openExternal:async()=>{throw Error('No browser allowed');}},dialog:{},safeStorage:{isEncryptionAvailable:()=>false},screen:{getAllDisplays:()=>[{workArea:{x:0,y:0,width:1920,height:1080}}],getPrimaryDisplay:()=>({workArea:{x:0,y:0,width:1920,height:1080}})},globalShortcut:{register:()=>false,unregister(){}},clipboard:{writeText(){throw Error('No clipboard operation allowed');}}},
    'node:fs':{readFileSync:()=>JSON.stringify(runtime)},'node:child_process':{spawn(){throw Error('No process allowed');}},
    './auth-config.cjs':{configuration:()=>({fingerprint:'synthetic-suite-binding'})},'./auth-config-path.cjs':{resolveAuthConfigPath:()=>null},'./auth-store.cjs':{createTokenStore:noop},
    './auth-service.cjs':{createAuthService:options=>{authOptions=options;return {initialize:async()=>{},status:()=>control.status,renewingAccountId:()=>control.renewing,accountGeneration:()=>control.generation??null,accountRequest:()=>{throw Error('No account request allowed');}};},publicError:noop},
    './pulse-app.cjs':{createPulseApp:options=>{pulseOptions=options;return {open:async()=>({ok:true}),openInvite:async()=>({ok:true}),syncContext(){},dispose(){}};},pulseInviteRefusal:require('../src/pulse-app.cjs').pulseInviteRefusal},
    './client-lifecycle.cjs':{createClientLifecycle:()=>({getClients:async()=>[]})},'./teacher-preview.cjs':{createTeacherPreview:()=>({available:()=>false})},'./product-preview.cjs':{createProductPreviews:()=>({available:()=>[]})},
    './company-requests.cjs':{createCompanyRequests:()=>()=>{throw Error('No company request allowed');}},'./downloads.cjs':{createDownloadHandler:noop},
    './native-content.cjs':{createNativeContent:noop},'./connection-content.cjs':{createConnectionContent:noop},'./connection-recovery.cjs':{createConnectionRecovery:()=>({connect:async()=>{},dispose(){}})},
    './suite-session.cjs':{suiteKey:()=> 'synthetic-suite',suiteDevice:()=> 'synthetic-device',createSuiteStore:()=>({}),createSuitePublisher:()=>publisher,createSuiteFollower:()=>({start:async()=>{},dispose(){}})},
  };
  const filename=path.join(SRC,'main.cjs');
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:id=>Object.hasOwn(stubs,id)?stubs[id]:id.startsWith('./')?require(path.join(SRC,id)):require(id),__dirname:SRC,process:{argv:[],platform:'win32',arch:'x64',env:{},resourcesPath:'/synthetic/resources'},console,Buffer,setTimeout,clearTimeout},{filename});
  await waitFor(()=>!!pulseOptions&&!!authOptions&&handlers.has('synk:auth-status'),'the synthetic platform window');
  return {control,handlers,sent,event:{sender:contents,senderFrame:frame},pulseOptions,authOptions};
}

module.exports={createPlatformAuth,loadPlatformMain,PEOPLE,HOUR,tick,waitFor,reply};
