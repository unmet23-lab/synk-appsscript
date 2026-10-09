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


// Added to the unchanged existing native-entry VM fixture. Synthetic only.
const suppressEventRenewal=(f,auth)=>{f.run('synkConnectionPending=true');f.emit(auth);f.run('synkConnectionPending=false');};
const recoveryFixture=()=>fixture({onFetch:path=>path==='/api/synk-id/challenge'?{data:{challenge:'recovery-challenge'}}:null,request(operation,_params,current){
  if(operation==='status')return {enabled:true,session:current.me.user?'synk':'company',synkUserId:current.me.synkUserId};
  if(operation==='exchange')current.setMe({user:{id:'company-A'},csrfToken:'csrf-restored',synkUserId:id});
  return {ok:true};
}});

test('server-confirmed renewal commits the same SYNK ID new generation before later expiry recovery',async()=>{
  const f=recoveryFixture();f.bootEvents();await f.run('initialize()');f.overlay.innerHTML='open modal draft';f.messenger.innerHTML='iframe draft';const renders=f.counts().renders;
  suppressEventRenewal(f,signedIn(id,2));assert.equal(f.run('synkNativeVerifiedGeneration'),1,'an event is not a server verification');
  await f.run('renewSynkCompanySession()');assert.equal(f.run('synkNativeVerifiedGeneration'),2);
  f.setMe({user:null,csrfToken:null,synkUserId:null});await f.run('renewSynkCompanySession()');
  assert.equal(f.state.csrf,'csrf-restored');assert.equal(f.state.user.id,'company-A');assert.equal(f.run('synkNativeRestorePending'),false);assert.equal(f.content.inert,false);
  assert.equal(f.overlay.innerHTML,'open modal draft');assert.equal(f.messenger.innerHTML,'iframe draft');assert.equal(f.counts().renders,renders);assert.deepEqual(f.moves,[]);
  const challenge=f.calls.find(r=>r.path==='/api/synk-id/challenge');assert.equal(JSON.parse(challenge.options.body).expectedAccountId,id);
});
test('each successive server-confirmed same-account generation can later recover without a reload',async()=>{
  const f=recoveryFixture();f.bootEvents();await f.run('initialize()');
  for(const generation of [2,3,4]){suppressEventRenewal(f,signedIn(id,generation));await f.run('renewSynkCompanySession()');assert.equal(f.run('synkNativeVerifiedGeneration'),generation);f.setMe({user:null,csrfToken:null,synkUserId:null});await f.run('renewSynkCompanySession()');assert.equal(f.state.user.id,'company-A');assert.equal(f.run('synkNativeRestorePending'),false);assert.equal(f.content.inert,false);}
  assert.deepEqual(f.moves,[]);assert.equal(f.calls.filter(r=>r.operation==='exchange').length,3);
});
test('same-account newer native generation can recover only after expected-account server confirmation',async()=>{
  const f=recoveryFixture();f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));f.setMe({user:null,csrfToken:null,synkUserId:null});
  assert.equal(f.run('synkNativeVerifiedGeneration'),1);await f.run('renewSynkCompanySession()');
  assert.equal(f.run('synkNativeVerifiedGeneration'),2);assert.equal(f.run('synkNativeRestorePending'),false);assert.equal(f.content.inert,false);assert.equal(f.state.csrf,'csrf-restored');assert.equal(f.calls.filter(r=>r.operation==='exchange').length,1);assert.deepEqual(f.moves,[]);
});

test('server-rejected renewal cannot commit an unverified generation',async()=>{
  const f=fixture({request:operation=>operation==='status'?{enabled:true,session:'synk'}:operation==='renew'?{ok:false,error:{code:'SYNK_ACCOUNT_CHANGED',message:'synthetic server mismatch'}}:{ok:true}});f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));await f.run('renewSynkCompanySession()');
  assert.equal(f.run('synkNativeVerifiedGeneration'),1);assert.equal(f.state.csrf,'csrf-A');assert.deepEqual(f.moves,['/?tab=messenger']);
});
test('temporary renewal failure retains the verified generation until a later server success',async()=>{
  let available=false;const f=fixture({request:operation=>operation==='status'?{enabled:true,session:'synk'}:operation==='renew'&&!available?{ok:false,error:{code:'SYNK_IDENTITY_UNAVAILABLE',message:'synthetic outage'}}:{ok:true}});f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));await f.run('renewSynkCompanySession()');assert.equal(f.run('synkNativeVerifiedGeneration'),1);assert.equal(f.content.inert,true);
  available=true;await f.run('renewSynkCompanySession()');assert.equal(f.run('synkNativeVerifiedGeneration'),2);assert.equal(f.content.inert,false);assert.deepEqual(f.moves,[]);
});
test('same-account generation racing a renewal never installs that stale renewal stamp',async()=>{
  const f=fixture({request(operation,_params,current){if(operation==='status')return {enabled:true,session:'synk'};if(operation==='renew')current.emit(signedIn(id,3));return {ok:true};}});f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));await f.run('renewSynkCompanySession()');
  assert.equal(f.run('synkNativeVerifiedGeneration'),1);assert.equal(f.state.csrf,'csrf-A');assert.equal(f.calls.some(r=>r.operation==='exchange'),false);
});
test('different account racing a renewal preserves masking and never updates the verified stamp',async()=>{
  const f=fixture({request(operation,_params,current){if(operation==='status')return {enabled:true,session:'synk'};if(operation==='renew')current.emit(signedIn(other,3));return {ok:true};}});f.bootEvents();await f.run('initialize()');f.overlay.innerHTML='private A modal';suppressEventRenewal(f,signedIn(id,2));await f.run('renewSynkCompanySession()');
  assert.equal(f.run('synkNativeVerifiedGeneration'),1);assert.equal(f.content.inert,true);assert.equal(f.overlay.inert,true);assert.equal(f.overlay.innerHTML,'private A modal');assert.equal(f.state.user.id,'company-A');
});
test('company employee or CSRF replacement during renewal never updates an old page stamp',async()=>{
  for(const replacement of ['employee','csrf']){const f=fixture({request(operation,_params,current){if(operation==='status')return {enabled:true,session:'synk'};if(operation==='renew'){if(replacement==='employee')current.state.user={id:'company-B'};else current.state.csrf='csrf-newer';}return {ok:true};}});f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));await f.run('renewSynkCompanySession()');assert.equal(f.run('synkNativeVerifiedGeneration'),1);assert.deepEqual(f.moves,[]);}
});
test('recovery after confirmed new generation rejects a different employee and keeps original CSRF',async()=>{
  const f=fixture({onFetch:path=>path==='/api/synk-id/challenge'?{data:{challenge:'recovery'}}:null,request(operation,_params,current){if(operation==='status')return {enabled:true,session:current.me.user?'synk':'company'};if(operation==='exchange')current.setMe({user:{id:'company-B'},csrfToken:'not-for-A',synkUserId:id});return {ok:true};}});f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));await f.run('renewSynkCompanySession()');assert.equal(f.run('synkNativeVerifiedGeneration'),2);f.setMe({user:null,synkUserId:null});await f.run('renewSynkCompanySession()');
  assert.equal(f.state.user.id,'company-A');assert.equal(f.state.csrf,'csrf-A');assert.equal(f.content.inert,true);assert.equal(f.run('synkNativeRestorePending'),true);assert.deepEqual(f.moves,[]);
});
test('recovery after confirmed new generation rejects missing CSRF without revealing the old company',async()=>{
  const f=fixture({onFetch:path=>path==='/api/synk-id/challenge'?{data:{challenge:'recovery'}}:null,request(operation,_params,current){if(operation==='status')return {enabled:true,session:current.me.user?'synk':'company'};if(operation==='exchange')current.setMe({user:{id:'company-A'},csrfToken:null,synkUserId:id});return {ok:true};}});f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));await f.run('renewSynkCompanySession()');f.setMe({user:null,synkUserId:null});await f.run('renewSynkCompanySession()');
  assert.equal(f.state.user.id,'company-A');assert.equal(f.state.csrf,'csrf-A');assert.equal(f.content.inert,true);assert.deepEqual(f.moves,[]);
});
test('explicit native signed-out reaches login even when the company session already expired',async()=>{
  const f=recoveryFixture();f.bootEvents();await f.run('initialize()');f.setMe({user:null,csrfToken:null,synkUserId:null});suppressEventRenewal(f,{configured:true,signedIn:false,status:'signed-out',sessionGeneration:2,account:null});await f.run('renewSynkCompanySession()');
  assert.deepEqual(f.moves,['/?tab=messenger']);assert.equal(f.calls.filter(r=>r.operation==='logout').length,1);assert.equal(f.calls.some(r=>r.path==='/api/synk-id/challenge'||r.operation==='exchange'),false);
});
test('explicit signed-out escapes a previous failed restoration instead of retaining a permanent recovery loop',async()=>{
  const f=fixture({request:operation=>operation==='status'?{enabled:true,session:'company'}:{ok:true},onFetch:path=>path==='/api/synk-id/challenge'?{status:503,data:{error:'synthetic network'}}:null});f.bootEvents();await f.run('initialize()');f.setMe({user:null,synkUserId:null});await f.run('renewSynkCompanySession()');assert.equal(f.run('synkNativeRestorePending'),true);assert.equal(f.content.inert,true);const attempts=f.calls.filter(r=>r.path==='/api/synk-id/challenge').length;
  suppressEventRenewal(f,{configured:true,signedIn:false,status:'signed-out',sessionGeneration:2,account:null});await f.run('renewSynkCompanySession()');assert.deepEqual(f.moves,['/?tab=messenger']);assert.equal(f.calls.filter(r=>r.path==='/api/synk-id/challenge').length,attempts);
});
test('a preserved legacy company session in an unconfigured native preview is not logged out',async()=>{
  const f=fixture({auth:{configured:false,signedIn:false,status:'unconfigured'},me:{user:{id:'legacy'},csrfToken:'legacy-csrf',synkUserId:null}});f.bootEvents();await f.run('initialize()');await f.run('renewSynkCompanySession()');assert.equal(f.state.user.id,'legacy');assert.equal(f.calls.some(r=>r.operation==='logout'),false);assert.deepEqual(f.moves,[]);
});
test('POST waits for new-generation recovery and is never automatically submitted across a new CSRF',async()=>{
  const f=recoveryFixture();f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));await f.run('renewSynkCompanySession()');assert.equal(f.run('synkNativeVerifiedGeneration'),2);f.setMe({user:null,synkUserId:null});f.run('synkNativeNeedsRecheck=true');
  await assert.rejects(f.run("api('/api/user-action',{save:'draft'})"),{code:'SESSION_CHANGED'});assert.equal(f.state.csrf,'csrf-restored');assert.equal(f.calls.some(r=>r.path==='/api/user-action'),false);await f.run("api('/api/user-action',{save:'draft'})");assert.equal(f.calls.filter(r=>r.path==='/api/user-action').length,1);
});

test('hidden same-account new generation recovers on first foreground after company expiry without any successful renew',async()=>{
  const f=recoveryFixture();f.bootEvents();await f.run('initialize()');f.overlay.innerHTML='preserved modal';f.messenger.innerHTML='preserved iframe';const renders=f.counts().renders;
  f.document.hidden=true;f.emit(signedIn(id,2));await flush();assert.equal(f.run('synkNativeVerifiedGeneration'),1);assert.equal(f.calls.filter(row=>row.operation==='renew').length,0);
  f.setMe({user:null,csrfToken:null,synkUserId:null});f.visibility();await f.run('renewSynkCompanySession()');assert.equal(f.calls.some(row=>row.operation==='exchange'),false);
  f.document.hidden=false;f.visibility();await f.run('renewSynkCompanySession()');
  assert.equal(f.run('synkNativeVerifiedGeneration'),2);assert.equal(f.run('synkNativeRestorePending'),false);assert.equal(f.state.user.id,'company-A');assert.equal(f.state.csrf,'csrf-restored');assert.equal(f.content.inert,false);
  assert.equal(f.overlay.innerHTML,'preserved modal');assert.equal(f.messenger.innerHTML,'preserved iframe');assert.equal(f.counts().renders,renders);assert.deepEqual(f.moves,[]);
  const challenge=f.calls.find(row=>row.path==='/api/synk-id/challenge');assert.equal(JSON.parse(challenge.options.body).expectedAccountId,id);
});

test('temporary new-generation renew failure followed by expiry recovers instead of fencing forever',async()=>{
  const f=fixture({onFetch:path=>path==='/api/synk-id/challenge'?{data:{challenge:'recovery'}}:null,request(operation,_params,current){
    if(operation==='status')return {enabled:true,session:current.me.user?'synk':'company',synkUserId:current.me.synkUserId};
    if(operation==='renew')return {ok:false,error:{code:'SYNK_IDENTITY_UNAVAILABLE',message:'synthetic temporary renewal failure'}};
    if(operation==='exchange')current.setMe({user:{id:'company-A'},csrfToken:'csrf-restored',synkUserId:id});return {ok:true};
  }});f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));await f.run('renewSynkCompanySession()');
  assert.equal(f.run('synkNativeVerifiedGeneration'),1);assert.equal(f.content.inert,true);assert.equal(f.calls.filter(row=>row.operation==='renew').length,1);
  f.document.hidden=true;f.setMe({user:null,csrfToken:null,synkUserId:null});await f.run('renewSynkCompanySession()');f.document.hidden=false;await f.run('renewSynkCompanySession()');
  assert.equal(f.run('synkNativeVerifiedGeneration'),2);assert.equal(f.run('synkNativeRestorePending'),false);assert.equal(f.content.inert,false);assert.equal(f.state.csrf,'csrf-restored');assert.deepEqual(f.moves,[]);
});

test('new-generation recovery rejects rollback and malformed generations before server exchange',async()=>{
  for(const generation of [0,-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'2',null,undefined,false]){
    const f=recoveryFixture();f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,{...signedIn(id),sessionGeneration:generation});f.setMe({user:null,csrfToken:null,synkUserId:null});await f.run('renewSynkCompanySession()');
    assert.equal(f.run('synkNativeVerifiedGeneration'),1,String(generation));assert.equal(f.state.csrf,'csrf-A');assert.equal(f.state.user.id,'company-A');assert.equal(f.content.inert,true);assert.equal(f.calls.some(row=>row.operation==='exchange'),false);assert.deepEqual(f.moves,[]);
  }
});

test('new-generation recovery commits neither generation nor CSRF for a different employee or missing server identity',async()=>{
  for(const replacement of [
    {user:{id:'company-B'},csrfToken:'not-A',synkUserId:id},
    {user:{id:'company-A'},csrfToken:'not-A',synkUserId:other},
    {user:{id:'company-A'},csrfToken:null,synkUserId:id},
    {user:{id:'company-A'},csrfToken:17,synkUserId:id},
    {user:{id:'company-A'},csrfToken:'csrf-A',synkUserId:id}
  ]){
    const f=fixture({onFetch:path=>path==='/api/synk-id/challenge'?{data:{challenge:'recovery'}}:null,request(operation,_params,current){if(operation==='status')return {enabled:true,session:current.me.user?'synk':'company'};if(operation==='exchange')current.setMe(replacement);return {ok:true};}});
    f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));f.setMe({user:null,csrfToken:null,synkUserId:null});await f.run('renewSynkCompanySession()');
    assert.equal(f.calls.filter(row=>row.operation==='exchange').length,1,'exercise the server-result guard');assert.equal(f.run('synkNativeVerifiedGeneration'),1);assert.equal(f.state.csrf,'csrf-A');assert.equal(f.state.user.id,'company-A');assert.equal(f.content.inert,true);assert.deepEqual(f.moves,[]);
  }
});

test('native account or generation change during new-generation exchange cannot commit the old page stamp',async()=>{
  for(const latest of [signedIn(id,3),signedIn(other,3)]){
    const f=fixture({onFetch:path=>path==='/api/synk-id/challenge'?{data:{challenge:'recovery'}}:null,request(operation,_params,current){if(operation==='status')return {enabled:true,session:current.me.user?'synk':'company'};if(operation==='exchange'){current.setMe({user:{id:'company-A'},csrfToken:'csrf-restored',synkUserId:id});current.emit(latest);}return {ok:true};}});
    f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));f.setMe({user:null,csrfToken:null,synkUserId:null});await f.run('renewSynkCompanySession()');
    assert.equal(f.calls.filter(row=>row.operation==='exchange').length,1);assert.equal(f.run('synkNativeVerifiedGeneration'),1);assert.equal(f.state.csrf,'csrf-A');assert.equal(f.content.inert,true);assert.equal(f.overlay.inert,true);assert.deepEqual(f.moves,[]);
  }
});

test('final native status/event-sequence fence rejects a late generation event after server recovery',async()=>{
  const f=recoveryFixture();f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));f.setMe({user:null,csrfToken:null,synkUserId:null});let reads=0;
  f.desktop.authStatus=async()=>{const captured=f.auth;if(++reads===7)f.emit(signedIn(id,3));return captured;};await f.run('renewSynkCompanySession()');
  assert.equal(reads,7,'the final post-server native fence must run');assert.equal(f.run('synkNativeVerifiedGeneration'),1);assert.equal(f.state.csrf,'csrf-A');assert.equal(f.content.inert,true);assert.deepEqual(f.moves,[]);
});

test('temporary server recovery failure leaves generation uncommitted and a later foreground recovery succeeds',async()=>{
  let available=false;const f=fixture({onFetch:path=>path==='/api/synk-id/challenge'?(available?{data:{challenge:'recovery'}}:{status:503,data:{error:'temporary'}}):null,request(operation,_params,current){if(operation==='status')return {enabled:true,session:current.me.user?'synk':'company'};if(operation==='exchange')current.setMe({user:{id:'company-A'},csrfToken:'csrf-restored',synkUserId:id});return {ok:true};}});
  f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));f.setMe({user:null,csrfToken:null,synkUserId:null});await f.run('renewSynkCompanySession()');
  assert.equal(f.run('synkNativeVerifiedGeneration'),1);assert.equal(f.state.csrf,'csrf-A');assert.equal(f.content.inert,true);assert.equal(f.calls.filter(row=>row.path==='/api/synk-id/challenge').length,1);assert.equal(f.calls.some(row=>row.operation==='exchange'),false);
  available=true;await f.run('renewSynkCompanySession()');assert.equal(f.run('synkNativeVerifiedGeneration'),2);assert.equal(f.state.csrf,'csrf-restored');assert.equal(f.content.inert,false);assert.equal(f.calls.filter(row=>row.operation==='exchange').length,1);
});

test('explicit logout during new-generation recovery stays masked and reaches login on the next check',async()=>{
  const f=fixture({onFetch:path=>path==='/api/synk-id/challenge'?{data:{challenge:'recovery'}}:null,request(operation,_params,current){if(operation==='status')return {enabled:true,session:current.me.user?'synk':'company'};if(operation==='exchange'){current.setMe({user:{id:'company-A'},csrfToken:'csrf-restored',synkUserId:id});current.emit({configured:true,signedIn:false,status:'signed-out',sessionGeneration:3,account:null});}return {ok:true};}});
  f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));f.setMe({user:null,csrfToken:null,synkUserId:null});await f.run('renewSynkCompanySession()');
  assert.equal(f.run('synkNativeVerifiedGeneration'),1);assert.equal(f.state.csrf,'csrf-A');assert.equal(f.content.inert,true);const exchanges=f.calls.filter(row=>row.operation==='exchange').length;
  await f.run('renewSynkCompanySession()');assert.equal(exchanges,1);assert.equal(f.calls.filter(row=>row.operation==='exchange').length,1);assert.deepEqual(f.moves,['/?tab=messenger']);
});

test('first foreground POST cannot auto-submit across a recovered new generation and new CSRF',async()=>{
  const f=recoveryFixture();f.bootEvents();await f.run('initialize()');f.overlay.innerHTML='POST draft';f.document.hidden=true;f.emit(signedIn(id,2));await flush();f.setMe({user:null,csrfToken:null,synkUserId:null});f.document.hidden=false;f.visibility();
  await assert.rejects(f.run("api('/api/user-action',{save:'preserved draft'})"),error=>['SESSION_CHANGED','SYNK_RECOVERY_REQUIRED'].includes(error.code));
  assert.equal(f.run('synkNativeVerifiedGeneration'),2);assert.equal(f.state.csrf,'csrf-restored');assert.equal(f.content.inert,false);assert.equal(f.overlay.innerHTML,'POST draft');assert.equal(f.calls.some(row=>row.path==='/api/user-action'),false);
  await f.run("api('/api/user-action',{save:'preserved draft'})");assert.equal(f.calls.filter(row=>row.path==='/api/user-action').length,1);
});

test('page close during new-generation exchange never commits a page generation or reveals its drafts',async()=>{
  const f=fixture({onFetch:path=>path==='/api/synk-id/challenge'?{data:{challenge:'recovery'}}:null,request(operation,_params,current){if(operation==='status')return {enabled:true,session:current.me.user?'synk':'company'};if(operation==='exchange'){current.setMe({user:{id:'company-A'},csrfToken:'csrf-restored',synkUserId:id});current.run('synkPageClosed=true');}return {ok:true};}});
  f.bootEvents();await f.run('initialize()');suppressEventRenewal(f,signedIn(id,2));f.setMe({user:null,csrfToken:null,synkUserId:null});await f.run('renewSynkCompanySession()');assert.equal(f.run('synkNativeVerifiedGeneration'),1);assert.equal(f.state.csrf,'csrf-A');assert.equal(f.content.inert,true);assert.deepEqual(f.moves,[]);
});
