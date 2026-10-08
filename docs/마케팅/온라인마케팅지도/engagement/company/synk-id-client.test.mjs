import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
const source=readFileSync(new URL('./public/synk-id.js',import.meta.url),'utf8');
function fixture(request){
  const calls=[],notices=[],moves=[],intervals=[],cleared=[],state={user:{id:'company-one'},csrf:'csrf-one'};
  const document={hidden:false,hasFocus:()=>true,addEventListener(){}};
  const desktop={authStatus:async()=>({signedIn:true,sessionGeneration:1}),authSignOut:async()=>{calls.push({operation:'native-signout'});return {ok:true,serverRevoked:true};},companyRequest:async(operation,params)=>{calls.push({operation,params});return request?request(operation,params):operation==='status'?{session:'synk'}:{ok:true};}};
  const context=vm.createContext({window:{synkDesktop:desktop},document,state,location:{replace:value=>moves.push(value)},notify:value=>notices.push(value),setInterval:(fn,ms)=>{intervals.push({fn,ms});return intervals.length;},clearInterval:id=>cleared.push(id),setTimeout,clearTimeout});
  vm.runInContext(source,context);return {calls,notices,moves,intervals,cleared,state,document,desktop,run:code=>vm.runInContext(code,context)};
}
test('classic login script coexists with the non-configurable preload bridge and renders native login',async()=>{
  const calls=[],button={disabled:true},note={textContent:''};let inserted=false;
  const section={get isConnected(){return inserted;},querySelector:selector=>selector==='button'?button:note};
  const form={before(value){assert.equal(value,section);inserted=true;}};
  const desktop={companyRequest:async operation=>{calls.push(operation);return {enabled:true,browserEnabled:false};}};
  const context=vm.createContext({desktop,document:{addEventListener(){},querySelector:selector=>selector==='#auth-form'?form:null,createElement:()=>section},fetch(){throw Error('Native login must use its bridge, not browser fetch');}});
  // contextBridge exposes a non-configurable property on the real window/global object.
  vm.runInContext("globalThis.window=globalThis;Object.defineProperty(globalThis,'synkDesktop',{value:desktop,writable:false,configurable:false})",context);
  vm.runInContext(source,context,{filename:'synk-id.js'});
  await vm.runInContext('installSynkLogin()',context);
  assert.equal(inserted,true);assert.match(section.innerHTML,/id="synk-id-login"/);
  assert.equal(button.disabled,false);assert.equal(typeof button.onclick,'function');
  assert.match(note.textContent,/회사 계정에 연결한 SYNK ID/);assert.deepEqual(calls,['status']);
  assert.equal(vm.runInContext('window.synkDesktop',context),desktop);
  assert.equal(vm.runInContext("Object.getOwnPropertyDescriptor(window,'synkDesktop').configurable",context),false);
});

test('native session renewal is single-flight and uses the current company CSRF',async()=>{
  let finish;const waiting=new Promise(resolve=>finish=resolve),f=fixture(operation=>operation==='status'?waiting:{ok:true});const first=f.run('renewSynkCompanySession()');await Promise.resolve();const concurrent=f.run('renewSynkCompanySession()');finish({session:'synk'});await Promise.all([first,concurrent]);
  assert.deepEqual(f.calls.map(row=>row.operation),['status','renew']);assert.equal(f.calls[1].params.csrfToken,'csrf-one');
});

test('an already verified native account enters the linked company without another button or login prompt',async()=>{
  const f=fixture(operation=>operation==='challenge'?{challenge:'synthetic-challenge'}:{ok:true});f.state.user=null;
  const button={isConnected:true},note={isConnected:true,textContent:'',append(){}};
  f.document.querySelector=selector=>selector==='#synk-id-login'?button:note;f.document.createElement=()=>({remove(){}});f.document.createTextNode=value=>value;
  let prompts=0;f.desktop.authStatus=async()=>({signedIn:true,status:'signed-in',sessionGeneration:7,account:{synk_user_id:'native-account'}});f.desktop.authSignIn=async()=>{prompts++;};
  f.run('synkCompanyStatus={enabled:true}');await f.run('automaticallyEnterSynkCompany()');await f.run('automaticallyEnterSynkCompany()');
  assert.deepEqual(f.calls.map(value=>value.operation),['challenge','exchange']);assert.equal(prompts,0);assert.deepEqual(f.moves,['/?tab=messenger']);
});

test('unlinked or denied native automatic entry stops after one attempt and never changes company membership',async()=>{
  const f=fixture(operation=>operation==='challenge'?{challenge:'synthetic-challenge'}:{ok:false,error:{code:'SYNK_NOT_LINKED',message:'초대가 필요해요.'}});f.state.user=null;
  const button={isConnected:true},note={isConnected:true,textContent:'',append(){}};
  f.document.querySelector=selector=>selector==='#synk-id-login'?button:note;f.document.createElement=()=>({remove(){}});f.document.createTextNode=value=>value;
  f.desktop.authStatus=async()=>({signedIn:true,status:'signed-in',sessionGeneration:7,account:{synk_user_id:'native-account'}});f.run('synkCompanyStatus={enabled:true}');
  await f.run('automaticallyEnterSynkCompany()');await f.run('automaticallyEnterSynkCompany()');assert.equal(f.calls.length,2);assert.equal(f.calls[0].params.action,'login');assert.equal(f.moves.length,0);assert.match(note.textContent,/초대/);
});

test('company waits for an in-progress platform OAuth flow without cancelling it to start another',async()=>{
  const f=fixture();let listener,announce,stopped=false;const subscribed=new Promise(resolve=>{announce=resolve;});f.desktop.authStatus=async()=>({signedIn:false,status:'signing-in'});f.desktop.onAuthChanged=fn=>{listener=fn;announce();return()=>{stopped=true;};};f.desktop.authSignIn=()=>{throw Error('must not restart');};
  const waiting=f.run('waitForNativeSynk()');await subscribed;listener({signedIn:true,status:'signed-in',account:{synk_user_id:'same'}});assert.equal((await waiting).signedIn,true);assert.equal(stopped,true);
});
test('retrying a saved-login error uses native load and never starts a new OAuth transaction',async()=>{
  const f=fixture();let loads=0,oauth=0,recovered=false;
  f.desktop.authStatus=async()=>recovered?{signedIn:true,status:'signed-in',sessionGeneration:3,account:{synk_user_id:'saved-account'}}:{signedIn:false,status:'error',sessionGeneration:3,error:{code:'AUTH_SERVER_UNAVAILABLE',message:'temporary outage',retryable:true}};
  f.desktop.accountRequest=async operation=>{assert.equal(operation,'load');loads++;recovered=true;return {ok:true};};
  f.desktop.onAuthChanged=()=>()=>{};f.desktop.authSignIn=async()=>{oauth++;return {signedIn:true,status:'signed-in',sessionGeneration:4,account:{synk_user_id:'new-oauth-account'}};};
  const restored=await f.run('waitForNativeSynk()');assert.equal(loads,1);assert.equal(oauth,0);assert.equal(restored.account.synk_user_id,'saved-account');
});
test('a late response from before logout or company account replacement never renews the new account',async()=>{
  for(const user of [null,{id:'company-two'}]){let finish,began;const waiting=new Promise(resolve=>finish=resolve),started=new Promise(resolve=>began=resolve),f=fixture(()=>{began();return waiting;}),pending=f.run('renewSynkCompanySession()');await started;f.state.user=user;f.state.csrf='csrf-two';finish({session:'synk'});await pending;assert.deepEqual(f.calls.map(row=>row.operation),['status']);assert.equal(f.moves.length,0);}
});
test('identity mismatch clears only the current company session and returns to login',async()=>{
  const f=fixture(operation=>operation==='status'?{session:'synk'}:operation==='renew'?{ok:false,error:{code:'SYNK_ACCOUNT_CHANGED',message:'계정 변경'}}:{ok:true});await f.run('renewSynkCompanySession()');assert.deepEqual(f.calls.map(row=>row.operation),['status','renew','logout']);assert.deepEqual(f.moves,['/?tab=messenger']);
});
test('temporary renewal errors preserve the session and recover on the next attempt',async()=>{
  let unavailable=true;const f=fixture(operation=>operation==='status'?{session:'synk'}:unavailable?{ok:false,error:{code:'SYNK_IDENTITY_UNAVAILABLE',message:'잠시 후 재시도'}}:{ok:true});await f.run('renewSynkCompanySession()');assert.equal(f.moves.length,0);assert.equal(f.state.user.id,'company-one');unavailable=false;await f.run('renewSynkCompanySession()');assert.equal(f.calls.filter(row=>row.operation==='renew').length,2);assert.equal(f.calls.some(row=>row.operation==='logout'),false);
});
test('renewal runs every 20 seconds only while the native window is visible and focused',async()=>{
  const f=fixture();f.document.hidden=true;await f.run('renewSynkCompanySession()');f.run('syncSynkRenewLoop()');assert.equal(f.calls.length,0);assert.equal(f.intervals.length,0);f.document.hidden=false;f.document.hasFocus=()=>false;f.run('syncSynkRenewLoop()');assert.equal(f.intervals.length,0);f.document.hasFocus=()=>true;f.run('syncSynkRenewLoop()');assert.equal(f.intervals[0].ms,20_000);await Promise.resolve();
});
test('legacy-shaped HTTP errors from the native bridge are not interpreted as successful challenges',async()=>{
  const f=fixture(()=>({error:'현재 비밀번호를 확인해 주세요.',code:'SYNK_REAUTH_REQUIRED'}));await assert.rejects(f.run("synkCompanyRequest('challenge',{action:'link'})"),error=>error.code==='SYNK_REAUTH_REQUIRED');
});

test('restoring and signing-in wait while a retryable main error can renew and recover',async()=>{
  for(const status of ['restoring','signing-in']){const f=fixture();f.desktop.authStatus=async()=>({signedIn:false,status,sessionGeneration:1});await f.run('renewSynkCompanySession()');assert.deepEqual(f.calls.map(row=>row.operation),['status']);assert.equal(f.moves.length,0);}
  const f=fixture();let recovered=false;f.desktop.authStatus=async()=>recovered?{signedIn:true,status:'signed-in',sessionGeneration:1}:{signedIn:false,status:'error',error:{retryable:true},sessionGeneration:1};
  await f.run('renewSynkCompanySession()');recovered=true;await f.run('renewSynkCompanySession()');assert.equal(f.calls.filter(row=>row.operation==='renew').length,2);assert.equal(f.calls.some(row=>row.operation==='logout'),false);
});
test('company SYNK logout also clears native credentials; legacy company logout leaves native identity alone',async()=>{
  for(const session of ['synk','company']){const f=fixture(operation=>operation==='status'?{session}:{ok:true});const result=await f.run('logoutSynkCompany()');assert.equal(result.done,true);assert.equal(result.warning,'');assert.equal(f.calls.some(row=>row.operation==='native-signout'),session==='synk');}
});
test('native logout failures report incomplete credential deletion after the company session is closed',async()=>{
  const f=fixture();f.desktop.authSignOut=async()=>({ok:false,error:{code:'AUTH_FAILED'}});const result=await f.run('logoutSynkCompany()');assert.equal(result.done,true);assert.match(result.warning,/삭제를 완료하지 못/);assert.ok(f.calls.some(row=>row.operation==='logout'));
  f.desktop.authSignOut=async()=>({ok:true,serverRevoked:false});assert.match((await f.run('logoutSynkCompany()')).warning,/서버의 세션 종료/);
});
test('logout does not clear a replacement account or apply an old page response',async()=>{
  const f=fixture();let reads=0;f.desktop.authStatus=async()=>({signedIn:true,sessionGeneration:++reads});assert.match((await f.run('logoutSynkCompany()')).warning,/새로 바뀐/);assert.equal(f.calls.some(row=>row.operation==='native-signout'),false);
  for(const change of ['account','page']){let release,started;const began=new Promise(r=>started=r),wait=new Promise(r=>release=r),g=fixture(operation=>{if(operation==='logout'){started();return wait;}return {session:'synk'};});const pending=g.run('logoutSynkCompany()');await began;if(change==='account'){g.state.user={id:'company-two'};g.state.csrf='csrf-two';}else g.run('synkPageClosed=true');release({ok:true});assert.equal((await pending).done,false);assert.equal(g.calls.some(row=>row.operation==='native-signout'),false);}
});
test('actual desktop main discard, signing-in and callback events complete the company login wait',async t=>{
  const require=createRequire(import.meta.url),{createAuthService}=require('../../../../../desktop/src/auth-service.cjs'),{configuration}=require('../../../../../desktop/src/auth-config.cjs');
  const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  const config=configuration({version:1,supabaseUrl:'http://127.0.0.1:39999',accountApiUrl:'http://127.0.0.1:39999',supabasePublishableKey:'sb_publishable_synthetic',clients:{messenger:{clientId:'synthetic-messenger',redirectUri:`http://127.0.0.1:${port}/synk/oauth/messenger/callback`}}},'messenger','development');
  const listeners=new Set(),states=[];let opened,announce;const launched=new Promise(r=>announce=r),service=createAuthService({config,store:{available:()=>true,load:async()=>null,save:async()=>{},clear:async()=>{}},openExternal:async url=>{opened=url;announce();},onChange:value=>{states.push(value.status);for(const listener of listeners)listener(value);},fetcher:async url=>new Response(JSON.stringify(String(url).endsWith('/oauth/token')?{token_type:'bearer',access_token:'synthetic-main-access',refresh_token:'synthetic-main-refresh',expires_in:3600}:String(url).endsWith('/user')?{id:'synthetic-auth-user'}:{ok:true,account:{synk_user_id:'synthetic-stable-id',status:'active'}}),{status:200,headers:{'Content-Type':'application/json'}})});t.after(()=>service.dispose());
  const f=fixture();Object.assign(f.desktop,{authStatus:async()=>service.status(),authSignIn:()=>service.signIn(),authCancelSignIn:()=>service.cancel(),onAuthChanged:listener=>{listeners.add(listener);return()=>listeners.delete(listener);}});
  const pending=f.run('waitForNativeSynk()');await launched;const callback=new URL(config.redirectUri);callback.search=new URLSearchParams({state:new URL(opened).searchParams.get('state'),code:'synthetic-company-code'});assert.equal((await fetch(callback)).status,200);const result=await pending;assert.equal(result.signedIn,true);assert.deepEqual(states,['signed-out','signing-in','restoring','signed-in']);assert.equal(listeners.size,0);
});
