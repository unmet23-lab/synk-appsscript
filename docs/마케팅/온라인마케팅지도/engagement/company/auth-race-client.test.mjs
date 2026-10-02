import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const apiSource=source.slice(source.indexOf('async function api('),source.indexOf('function notify('));
const loadSource=source.slice(source.indexOf('async function loadState()'),source.indexOf('async function loadReport()'));
const initializeSource=source.slice(source.indexOf('async function initialize()'),source.indexOf('async function loadState()'));
const logoutSource=source.split('\n').find(line=>line.includes("if (action === 'logout')")).trim().replace("if (action === 'logout')",'async function logoutAction()');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const reply=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
function fixture({user={id:'A',role:'member'},csrf='csrf-A',fetch:fetchOverride,demo=false}={}){
  const pending=[],calls=[];let renders=0,authRenders=0,resets=0,polls=0;
  const context=vm.createContext({state:{user,csrf,data:{user},report:{old:true},authMode:'login',authToken:'',hypeRequest:0,tab:'workroom'},URLSearchParams,
    fetch:fetchOverride||((url,options)=>{const wait=deferred();pending.push(wait);calls.push({url,options});return wait.promise;}),demoApiUrl:value=>value,isDemoMode:()=>demo,
    initializeDemoRange(){},resetTeamOverview(){},normalizeMarketingScope(){},resetContentWorkspace(){resets++;},resetStudioWorkspace(){resets++;},closeModal(){},
    render(){renders++;},renderAuth(){authRenders++;},notify(){},clearInterval(){},pollTimer:null,hypePollTimer:null,logoutSynkCompany:async()=>({done:true}),
    location:{hash:'',search:'',pathname:'/'},history:{replaceState(){}},selectWorkspaceView(){},reportTabs:()=>false,startPolling(){polls++;},app:{innerHTML:''},escape:String});
  const run=code=>vm.runInContext(code,context);run(apiSource+'\n'+loadSource+'\n'+initializeSource+'\n'+logoutSource);
  return {context,run,pending,calls,get state(){return context.state;},get counts(){return {renders,authRenders,resets,polls};}};
}
test('an in-flight collection refresh cannot resurrect a completed logout',async()=>{
  const f=fixture(),request=f.run('loadState()');await f.run('logoutAction()');assert.equal(f.state.user,null);
  f.pending[0].resolve(reply({user:{id:'A'},channels:['private-A']}));await assert.rejects(request,{code:'SESSION_CHANGED'});
  assert.equal(f.state.user,null);assert.equal(f.state.data,null);assert.equal(f.counts.renders,0);assert.equal(f.counts.authRenders,1);
});
test('same-account login after logout has a new generation and rejects the prior response',async()=>{
  const f=fixture(),old=f.run('loadState()');await f.run('logoutAction()');f.run("state.user={id:'A',role:'member'};state.csrf='csrf-A';state.data={fresh:true}");
  f.pending[0].resolve(reply({user:{id:'A'},channels:['old-session']}));await assert.rejects(old,{code:'SESSION_CHANGED'});assert.equal(f.state.data.fresh,true);assert.equal(f.counts.renders,0);
});
test('a previous account 401 cannot sign out the new account or clear its workroom',async()=>{
  const f=fixture(),old=f.run("api('/api/content-workspace')");f.run("state.user=null;state.user={id:'B'};state.csrf='csrf-B';state.data={current:'B'}");
  f.pending[0].resolve(reply({error:'expired'},401));await assert.rejects(old,{code:'SESSION_CHANGED'});
  assert.equal(f.state.user.id,'B');assert.equal(f.state.csrf,'csrf-B');assert.equal(f.state.data.current,'B');assert.equal(f.counts.authRenders,0);assert.equal(f.counts.resets,0);
});
test('an old 401 is ignored after same-account reauthentication or CSRF rotation',async()=>{
  for(const transition of ["state.user=null;state.user={id:'A'}","state.csrf='csrf-new'"]){const f=fixture(),old=f.run("api('/api/workroom-guide')");f.run(transition);f.pending[0].resolve(reply({error:'expired'},401));await assert.rejects(old,{code:'SESSION_CHANGED'});assert.equal(f.state.user.id,'A');assert.equal(f.counts.authRenders,0);}
});
test('messenger expiry assignments invalidate pending responses without editing that module',async()=>{
  const f=fixture(),old=f.run('loadState()');f.run("state.user=null;state.data=null;state.report=null;renderAuth()");
  f.pending[0].resolve(reply({user:{id:'A'}}));await assert.rejects(old,{code:'SESSION_CHANGED'});assert.equal(f.state.user,null);assert.equal(f.counts.renders,0);
});
test('response parsing is guarded too, so a slow JSON body cannot return previous-account data',async()=>{
  const body=deferred(),f=fixture({fetch:async()=>({ok:true,status:200,json:()=>body.promise})}),old=f.run("api('/api/workroom-guide')");
  await Promise.resolve();f.run("state.user={id:'B'}");body.resolve({private:'A'});await assert.rejects(old,{code:'SESSION_CHANGED'});
});
test('current-session 401 still clears company data and a mismatched state account fails closed',async()=>{
  for(const response of [reply({error:'expired'},401),reply({user:{id:'B'}})]){const f=fixture(),request=f.run('loadState()');f.pending[0].resolve(response);await assert.rejects(request);assert.equal(f.state.user,null);assert.equal(f.state.csrf,'');assert.equal(f.state.data,null);assert.equal(f.counts.authRenders,1);}
});
test('normal refresh keeps the same identity and applies updated role and company data',async()=>{
  const f=fixture(),request=f.run('loadState()');f.pending[0].resolve(reply({user:{id:'A',role:'manager'},channels:['current']}));await request;
  assert.equal(f.state.user.role,'manager');assert.equal(f.state.data.channels[0],'current');assert.equal(f.counts.renders,1);assert.equal(f.counts.authRenders,0);
});
test('an unauthenticated refresh never requests or installs company state',async()=>{
  const f=fixture({user:null,csrf:''});await assert.rejects(f.run('loadState()'),{code:'SESSION_CHANGED'});assert.equal(f.calls.length,0);
});
test('boot with a valid session and setup without a session retain their existing flow',async()=>{
  const active=fixture({user:null,csrf:'',fetch:async url=>reply(url==='/api/me'?{user:{id:'A'},csrfToken:'boot-csrf'}:{user:{id:'A'},channels:[]})});
  await active.run('initialize()');assert.equal(active.state.user.id,'A');assert.equal(active.state.initialized,true);assert.equal(active.counts.renders,1);assert.equal(active.counts.polls,1);
  const setup=fixture({user:null,csrf:'',fetch:async()=>reply({user:null,needsSetup:true})});await setup.run('initialize()');assert.equal(setup.state.authMode,'setup');assert.equal(setup.counts.authRenders,1);assert.equal(setup.counts.polls,0);
});
test('synthetic demo identities still render through the authorized demo route',async()=>{
  const f=fixture({demo:true}),request=f.run('loadState()');f.pending[0].resolve(reply({user:{id:'demo-crew'},demo:{enabled:true},channels:[]}));await request;assert.equal(f.state.user.id,'demo-crew');assert.equal(f.counts.renders,1);
});
