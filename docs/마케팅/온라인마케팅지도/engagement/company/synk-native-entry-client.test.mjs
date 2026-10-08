import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./public/synk-id.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const apiSource=appSource.slice(appSource.indexOf('async function api('),appSource.indexOf('function notify('));
const initialize=appSource.slice(appSource.indexOf('async function initialize()'),appSource.indexOf('async function loadState()'));
const load=appSource.slice(appSource.indexOf('async function loadState()'),appSource.indexOf('async function loadReport()'));
const renderAuthSource=appSource.slice(appSource.indexOf('function renderAuth()'),appSource.indexOf('function shell('));
const logout=appSource.split('\n').find(line=>line.includes("if (action === 'logout')")).trim().replace("if (action === 'logout')",'async function logoutAction()');
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const signedIn=(account=id,generation=1)=>({configured:true,signedIn:true,status:'signed-in',sessionGeneration:generation,account:{synk_user_id:account}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({auth=signedIn(),me={user:{id:'company-A'},csrfToken:'csrf-A',synkUserId:id},request,onMe,onFetch}={}){
  const calls=[],moves=[],events=new Map(),listeners=new Set(),notes=[],notices=[];
  let renders=0,authRenders=0,polls=0,currentAuth=auth,currentMe=me;
  const element=()=>({style:{display:''},inert:false,innerHTML:'',draft:'unsaved company draft',isConnected:true,setAttribute(){},append(){},before(note){notes.push(note);},remove(){this.isConnected=false;}});
  const content=element(),overlay=element(),toast=element(),panel=element(),messenger=element();
  const state={user:null,csrf:'',data:null,report:null,authMode:'login',hypeRequest:0,tab:'messenger'};
  const document={hidden:false,hasFocus:()=>true,addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},
    querySelector:selector=>({'#app':content,'#overlay':overlay,'#toast':toast,'#main .empty':panel,'#workspace-messenger':messenger})[selector]||null,
    querySelectorAll:selector=>selector.split(',').map(value=>document.querySelector(value.trim())).filter(Boolean),
    getElementById:key=>document.querySelector('#'+key),createElement:()=>element()};
  const desktop={authStatus:async()=>currentAuth,onAuthChanged(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    authSignOut:async()=>{emit({configured:true,signedIn:false,status:'signed-out',sessionGeneration:currentAuth.sessionGeneration+1,account:null});return {ok:true,serverRevoked:true};},
    companyRequest:async(operation,params)=>{calls.push({operation,params});if(request)return request(operation,params,f);
      if(operation==='status')return {enabled:true,browserEnabled:true,session:currentMe.synkUserId?'synk':'company',synkUserId:currentMe.synkUserId};
      if(operation==='challenge')return {challenge:'synthetic-challenge'};
      if(operation==='exchange')currentMe={...currentMe,synkUserId:currentAuth.account.synk_user_id};
      if(operation==='logout')currentMe={user:null,csrfToken:'',synkUserId:null};return {ok:true};}};
  const context=vm.createContext({window:{synkDesktop:desktop,addEventListener(){}},document,state,URL,URLSearchParams,app:content,overlay,
    fetch:async(path,options)=>{calls.push({path,options});const result=onFetch?await onFetch(path,options,f):null;if(result)return {ok:(result.status||200)<400,status:result.status||200,json:async()=>result.data};const data=path==='/api/me'?(onMe?await onMe(f):currentMe):{user:currentMe.user,channels:['private-'+currentMe.user?.id]};return {ok:true,status:200,json:async()=>data};},
    location:{href:'https://workspace.synk.im/?tab=messenger',pathname:'/',search:'?tab=messenger',hash:'',replace:v=>moves.push(v),reload:()=>moves.push('reload')},history:{replaceState(){}},
    demoApiUrl:v=>v,isDemoMode:()=>false,selectWorkspaceView(){},initializeDemoRange(){},resetTeamOverview(){},normalizeMarketingScope(){},resetContentWorkspace(){},resetStudioWorkspace(){},closeModal(){overlay.innerHTML='';},
    render(){renders++;},resetWorkspaceModule(){authRenders++;},icon:()=>'',reportTabs:()=>false,startPolling(){polls++;},escape:String,button:()=>'',notify:v=>notices.push(v),
    setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,pollTimer:null,hypePollTimer:null});
  const run=code=>vm.runInContext(code,context);
  vm.runInContext(source+'\n'+apiSource+'\n'+load+'\n'+initialize+'\n'+renderAuthSource+'\n'+logout,context);
  function emit(next){currentAuth=next;for(const fn of listeners)fn(next);}
  const f={run,state,calls,moves,content,overlay,panel,messenger,notes,notices,desktop,document,emit,get me(){return currentMe;},setMe:v=>{currentMe=v;},get auth(){return currentAuth;},counts:()=>({renders,authRenders,polls}),bootEvents(){for(const fn of events.get('DOMContentLoaded')||[])fn();},visibility(){for(const fn of events.get('visibilitychange')||[])fn();}};
  return f;
}

test('configured native login waits without installing an existing company account or loading its data',async()=>{
  const f=fixture({auth:{configured:true,signedIn:false,status:'restoring',sessionGeneration:1}});f.bootEvents();await f.run('initialize()');
  assert.equal(f.state.user,null);assert.equal(f.calls.length,0);assert.equal(f.counts().renders,0);assert.equal(f.counts().authRenders,1);
});
test('unconfigured native preview retains the existing password company startup',async()=>{
  const f=fixture({auth:{configured:false,signedIn:false,status:'unconfigured'},me:{user:{id:'legacy'},csrfToken:'csrf-legacy',synkUserId:null}});await f.run('initialize()');
  assert.equal(f.state.user.id,'legacy');assert.deepEqual(f.calls.map(v=>v.path||v.operation),['/api/me','/api/state']);
});
test('verified native identity and company identity boot directly without an extra OAuth challenge',async()=>{
  const f=fixture();f.bootEvents();await f.run('initialize()');assert.equal(f.state.user.id,'company-A');assert.equal(f.counts().renders,1);
  assert.deepEqual(f.calls.map(v=>v.path||v.operation),['/api/me','/api/state']);
});
test('same company legacy session is promoted before identity or company data is installed',async()=>{
  const f=fixture({me:{user:{id:'company-A'},csrfToken:'csrf-A',synkUserId:null},request(operation,_params,current){assert.equal(current.state.user,null);assert.equal(current.counts().renders,0);if(operation==='status')return {enabled:true,session:'company'};if(operation==='challenge')return {challenge:'synthetic'};if(operation==='exchange')current.setMe({...current.me,synkUserId:id});return {ok:true};}});
  await f.run('initialize()');assert.equal(f.state.user.id,'company-A');assert.deepEqual(f.calls.map(v=>v.path||v.operation),['/api/me','status','challenge','exchange','/api/me','/api/state']);
});
test('a different existing company account stays hidden when the server rejects promotion',async()=>{
  const f=fixture({me:{user:{id:'company-B'},csrfToken:'csrf-B',synkUserId:null},request:operation=>operation==='status'?{enabled:true,session:'company'}:operation==='challenge'?{challenge:'synthetic'}:{ok:false,error:{code:'SYNK_ACCOUNT_CHANGED',message:'different company'}}});
  await f.run('initialize()');assert.equal(f.state.user,null);assert.equal(f.state.csrf,'');assert.equal(f.counts().renders,0);assert.equal(f.calls.some(v=>v.path==='/api/state'),false);assert.equal(f.me.user.id,'company-B');
});
test('native account replacement while company identity loads cannot install the old result',async()=>{
  let resolve,began;const pending=new Promise(r=>{resolve=r;}),started=new Promise(r=>{began=r;});
  const f=fixture({onMe:async()=>{began();return pending;}});f.bootEvents();const boot=f.run('initialize()');await started;f.emit(signedIn(other,2));resolve({user:{id:'company-A'},csrfToken:'csrf-A',synkUserId:id});await boot;
  assert.equal(f.state.user,null);assert.equal(f.calls.some(v=>v.path==='/api/state'),false);
});
test('an auth change delivered before an older final status reply cannot reveal the previous company',async()=>{
  const f=fixture();f.bootEvents();let reads=0;
  f.desktop.authStatus=async()=>{const snapshot=f.auth;if(++reads===2)queueMicrotask(()=>f.emit(signedIn(other,2)));return snapshot;};
  await f.run('initialize()');await flush();
  assert.equal(f.state.user,null,'account B was announced before the final A status reply completed');
  assert.equal(f.calls.some(v=>v.path==='/api/state'),false);
});
test('temporary native checking masks company content and an open modal without discarding drafts, then verified renewal restores both',async()=>{
  const f=fixture();f.bootEvents();await f.run('initialize()');f.overlay.innerHTML='<form>private company draft</form>';
  f.emit({configured:true,signedIn:false,status:'restoring',sessionGeneration:1,account:null});
  assert.equal(f.content.style.display,'none');assert.equal(f.content.inert,true);
  assert.equal(f.overlay.style.display,'none','the modal is a sibling of #app and must also be masked');assert.equal(f.overlay.inert,true);
  assert.equal(f.content.draft,'unsaved company draft');assert.match(f.overlay.innerHTML,/private company draft/);
  await flush();f.emit(signedIn());await flush();
  assert.equal(f.content.style.display,'');assert.equal(f.overlay.style.display,'');assert.equal(f.content.inert,false);assert.equal(f.overlay.inert,false);assert.match(f.overlay.innerHTML,/private company draft/);
});
test('explicit company logout leaves the new login screen visible after native sign-out emits synchronously',async()=>{
  const f=fixture();f.bootEvents();await f.run('initialize()');await f.run('logoutAction()');await flush();
  assert.equal(f.state.user,null);assert.equal(f.counts().authRenders,1);assert.equal(f.content.style.display,'');assert.equal(f.content.inert,false);
});

for(const delivery of ['before guarded reply','after guarded reply before caller'])test('native renewal never unmasks the old company after an account event '+delivery,async()=>{
  const f=fixture();f.bootEvents();await f.run('initialize()');f.overlay.innerHTML='<form>private company A draft</form>';
  let reads=0,maskedAtAccountChange=false;
  f.desktop.authStatus=async()=>{
    const snapshot=f.auth;
    if(++reads===2){const change=()=>{f.emit(signedIn(other,2));maskedAtAccountChange=f.content.style.display==='none';};if(delivery==='before guarded reply')queueMicrotask(change);else queueMicrotask(()=>queueMicrotask(change));}
    return snapshot;
  };
  await f.run('renewSynkCompanySession()');await flush();
  assert.equal(f.auth.account.synk_user_id,other);assert.equal(f.auth.sessionGeneration,2);assert.equal(maskedAtAccountChange,true);
  assert.equal(f.content.style.display,'none','stale renewal must not reveal company A after native account B');assert.equal(f.content.inert,true);
  assert.equal(f.overlay.style.display,'none');assert.equal(f.overlay.inert,true);assert.match(f.overlay.innerHTML,/private company A draft/);
  assert.equal(f.calls.some(v=>v.operation==='logout'),false,'a stale local reply does not revoke a newer native account');
});
test('native renewal account rejection still logs out the old company and redirects',async()=>{
  const f=fixture({request:operation=>operation==='status'?{enabled:true,session:'synk'}:operation==='renew'?{ok:false,error:{code:'SYNK_ACCOUNT_CHANGED',message:'different native account'}}:{ok:true}});
  f.bootEvents();await f.run('initialize()');await f.run('renewSynkCompanySession()');await flush();
  assert.deepEqual(f.calls.filter(v=>v.operation).map(v=>v.operation),['status','renew','logout']);assert.deepEqual(f.moves,['/?tab=messenger']);
});

test('same-account refresh emitted inside renewal immediately restores the preserved company draft',async()=>{
  const f=fixture({request(operation,_params,current){
    if(operation==='status')return {enabled:true,session:'synk'};
    if(operation==='renew'){
      current.emit({configured:true,signedIn:false,status:'restoring',sessionGeneration:1,account:null});
      assert.equal(current.content.style.display,'none');assert.equal(current.overlay.inert,true);
      current.emit(signedIn());
    }
    return {ok:true};
  }});
  f.bootEvents();await f.run('initialize()');f.overlay.innerHTML='<form>same account unsaved draft</form>';
  await f.run('renewSynkCompanySession()');
  assert.equal(f.content.style.display,'','the completed renewal must not wait for another 20-second tick');
  assert.equal(f.overlay.inert,false);assert.match(f.overlay.innerHTML,/same account unsaved draft/);
  assert.equal(f.calls.filter(row=>row.operation==='renew').length,1);assert.equal(f.moves.length,0);
});
test('startup retries a transient saved native login through load before installing company data',async()=>{
  const f=fixture({auth:{configured:true,signedIn:false,status:'error',sessionGeneration:1,account:null,error:{code:'AUTH_SERVER_UNAVAILABLE',message:'temporary outage',retryable:true}}});
  let loads=0,oauth=0;
  f.desktop.accountRequest=async operation=>{assert.equal(operation,'load');loads++;assert.equal(f.state.user,null);f.emit(signedIn());return {ok:true};};
  f.desktop.authSignIn=async()=>{oauth++;return signedIn();};
  f.bootEvents();await f.run('initialize()');
  assert.equal(loads,1);assert.equal(oauth,0);assert.equal(f.state.user.id,'company-A');assert.equal(f.counts().renders,1);
});
test('unavailable startup keeps company data hidden and a later retry restores the same saved identity',async()=>{
  const failure={configured:true,signedIn:false,status:'error',sessionGeneration:1,account:null,error:{code:'AUTH_SERVER_UNAVAILABLE',message:'temporary outage',retryable:true}};
  const f=fixture({auth:failure});let loads=0,available=false,oauth=0;
  f.desktop.accountRequest=async()=>{loads++;if(available){f.emit(signedIn());return {ok:true};}return {ok:false,error:failure.error};};
  f.desktop.authSignIn=async()=>{oauth++;return signedIn();};
  f.bootEvents();await f.run('initialize()');assert.equal(loads,1);assert.equal(f.state.user,null);assert.equal(f.calls.length,0);
  await assert.rejects(f.run('waitForNativeSynk()'),{code:'AUTH_SERVER_UNAVAILABLE'});assert.equal(loads,2);assert.equal(oauth,0);
  available=true;const restored=await f.run('waitForNativeSynk()');assert.equal(restored.account.synk_user_id,id);assert.equal(loads,3);assert.equal(oauth,0);
});
test('a replacement native account during saved-token retry cannot install the old company',async()=>{
  const f=fixture({auth:{configured:true,signedIn:false,status:'error',sessionGeneration:1,error:{retryable:true}}});
  f.desktop.accountRequest=async()=>{f.emit(signedIn(other,2));return {ok:true};};
  f.bootEvents();await f.run('initialize()');assert.equal(f.state.user,null);assert.equal(f.calls.length,0);assert.equal(f.counts().renders,0);
});
for(const delivery of ['before guarded reply','after guarded reply before caller'])test('saved-token retry fences a late identity response '+delivery,async()=>{
  const f=fixture({auth:{configured:true,signedIn:false,status:'error',sessionGeneration:1,error:{retryable:true}}});f.bootEvents();
  f.desktop.accountRequest=async()=>{f.emit(signedIn());return {ok:true};};
  let reads=0;f.desktop.authStatus=async()=>{const snapshot=f.auth;if(++reads===2){const change=()=>f.emit(signedIn(other,2));if(delivery==='before guarded reply')queueMicrotask(change);else queueMicrotask(()=>queueMicrotask(change));}return snapshot;};
  await assert.rejects(f.run('waitForNativeSynk()'),{code:'SYNK_PLATFORM_ENTRY'});assert.equal(f.state.user,null);assert.equal(f.calls.length,0);
});
test('native identity checking masks the body sibling messenger iframe without deleting its draft',async()=>{
  const f=fixture();f.bootEvents();await f.run('initialize()');f.messenger.innerHTML='unsaved iframe draft';
  f.emit({configured:true,signedIn:false,status:'restoring',sessionGeneration:1,account:null});
  assert.equal(f.messenger.style.display,'none');assert.equal(f.messenger.inert,true);assert.equal(f.messenger.innerHTML,'unsaved iframe draft');
  await flush();f.emit(signedIn());await flush();assert.equal(f.messenger.style.display,'');assert.equal(f.messenger.inert,false);
});
test('foreground renewal restores an expired company session for the same employee without rendering or losing drafts',async()=>{
  const f=fixture({onFetch:path=>path==='/api/synk-id/challenge'?{data:{challenge:'recovery-challenge'}}:null,request(operation,_params,current){
    if(operation==='status')return {enabled:true,session:current.me.user?'synk':'company'};
    if(operation==='exchange')current.setMe({user:{id:'company-A'},csrfToken:'csrf-restored',synkUserId:id});return {ok:true};
  }});
  f.bootEvents();await f.run('initialize()');f.overlay.innerHTML='modal draft';f.messenger.innerHTML='iframe draft';const renders=f.counts().renders;
  f.setMe({user:null,csrfToken:null,synkUserId:null});f.document.hidden=true;f.visibility();await f.run('renewSynkCompanySession()');assert.equal(f.calls.some(row=>row.operation==='exchange'),false);
  f.document.hidden=false;await f.run('renewSynkCompanySession()');
  assert.equal(f.state.csrf,'csrf-restored');assert.equal(f.state.user.id,'company-A');assert.equal(f.counts().renders,renders);assert.equal(f.overlay.innerHTML,'modal draft');assert.equal(f.messenger.innerHTML,'iframe draft');assert.equal(f.moves.length,0);
  const challenge=f.calls.find(row=>row.path==='/api/synk-id/challenge');assert.equal(JSON.parse(challenge.options.body).expectedAccountId,id);
});
test('foreground API waits for recovery and never automatically submits a mutation across CSRF replacement',async()=>{
  let release,began;const held=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{began=resolve;});
  const f=fixture({onFetch:async path=>{if(path==='/api/synk-id/challenge'){began();await held;return {data:{challenge:'recovery'}};}return null;},request(operation,_params,current){if(operation==='status')return {enabled:true,session:current.me.user?'synk':'company'};if(operation==='exchange')current.setMe({user:{id:'company-A'},csrfToken:'new-csrf',synkUserId:id});return {ok:true};}});
  f.bootEvents();await f.run('initialize()');f.setMe({user:null,synkUserId:null});f.document.hidden=true;f.visibility();f.document.hidden=false;
  const pending=f.run("api('/api/user-action',{save:'draft'})");const rejection=assert.rejects(pending,{code:'SESSION_CHANGED'});await started;
  assert.equal(f.calls.some(row=>row.path==='/api/user-action'),false);release();await rejection;
  assert.equal(f.state.user.id,'company-A');assert.equal(f.calls.some(row=>row.path==='/api/user-action'),false);
  await f.run("api('/api/user-action',{save:'draft'})");assert.equal(f.calls.filter(row=>row.path==='/api/user-action').length,1);
});
for(const failure of ['different employee','different native account','revoked','network'])test('foreground recovery retains masked drafts after '+failure,async()=>{
  const f=fixture({onFetch:path=>path==='/api/synk-id/challenge'?{data:{challenge:'recovery'}}:null,request(operation,_params,current){
    if(operation==='status')return {enabled:true,session:current.me.user?'synk':'company'};
    if(operation==='exchange'){
      if(failure==='revoked')return {ok:false,error:{code:'SYNK_IDENTITY_REJECTED',message:'revoked'}};
      if(failure==='network')throw Error('temporary network');
      if(failure==='different native account')current.emit(signedIn(other,2));
      current.setMe({user:{id:failure==='different employee'?'company-B':'company-A'},csrfToken:'must-not-install',synkUserId:id});
    }return {ok:true};
  }});
  f.bootEvents();await f.run('initialize()');f.messenger.innerHTML='private iframe draft';f.setMe({user:null,synkUserId:null});
  await f.run('renewSynkCompanySession()');assert.equal(f.state.user.id,'company-A');assert.equal(f.state.csrf,'csrf-A');assert.equal(f.messenger.inert,true);assert.equal(f.messenger.style.display,'none');assert.equal(f.messenger.innerHTML,'private iframe draft');assert.equal(f.moves.length,0);
  await assert.rejects(async()=>f.run('ensureNativeSynkCompanySession()'));
});
test('a foreground restore challenge is abandoned when the native account changes before exchange',async()=>{
  const f=fixture({onFetch:(path,_options,current)=>{if(path==='/api/synk-id/challenge'){current.emit(signedIn(other,2));return {data:{challenge:'old-account-challenge'}};}return null;}});
  f.bootEvents();await f.run('initialize()');f.setMe({user:null,synkUserId:null});await f.run('renewSynkCompanySession()');
  assert.equal(f.calls.some(row=>row.operation==='exchange'),false);assert.equal(f.state.csrf,'csrf-A');assert.equal(f.messenger.inert,true);
});
