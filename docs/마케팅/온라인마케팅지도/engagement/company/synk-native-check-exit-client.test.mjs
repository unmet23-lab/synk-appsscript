import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// 2026-10-22 the Workspace window stayed on 「플랫폼의 SYNK ID 연결을 확인하고 있어요.」 until it was closed.
// These cases reproduce the ways the platform check could hang or never run again. Synthetic only.
const source=readFileSync(new URL('./public/synk-id.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const apiSource=appSource.slice(appSource.indexOf('async function api('),appSource.indexOf('function notify('));
const initialize=appSource.slice(appSource.indexOf('async function initialize()'),appSource.indexOf('async function loadState()'));
const load=appSource.slice(appSource.indexOf('async function loadState()'),appSource.indexOf('async function loadReport()'));
const renderAuthSource=appSource.slice(appSource.indexOf('function renderAuth()'),appSource.indexOf('function shell('));
const id='11111111-1111-4111-8111-111111111111';
const signedIn=(account=id,generation=1)=>({configured:true,signedIn:true,status:'signed-in',sessionGeneration:generation,account:{synk_user_id:account}});
const flush=async(times=8)=>{for(let i=0;i<times;i++)await new Promise(resolve=>setImmediate(resolve));};
const never=()=>new Promise(()=>{});
function fixture({auth=signedIn(),me={user:{id:'company-A'},csrfToken:'csrf-A',synkUserId:id},request,onFetch,guard=false}={}){
  const calls=[],moves=[],events=new Map(),windowEvents=new Map(),listeners=new Set(),notes=[],notices=[],timers=new Map(),signals=[];
  let currentAuth=auth,currentMe=me,timerId=0,focused=true;
  const element=(tag='div')=>({tag,style:{display:''},inert:false,innerHTML:'',textContent:'',className:'',children:[],attributes:{},isConnected:true,disabled:false,setAttribute(key,value){this.attributes[key]=value;},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=[...nodes];},before(note){notes.push(note);},remove(){this.isConnected=false;}});
  const content=element(),overlay=element(),toast=element(),panel=element(),messenger=element();
  const state={user:null,csrf:'',data:null,report:null,authMode:'login',hypeRequest:0,tab:'messenger'};
  const document={hidden:false,hasFocus:()=>focused,addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},
    querySelector:selector=>({'#app':content,'#overlay':overlay,'#toast':toast,'#main .empty':panel,'#workspace-messenger':messenger})[selector]||null,
    querySelectorAll:selector=>selector.split(',').map(value=>document.querySelector(value.trim())).filter(Boolean),
    getElementById:key=>document.querySelector('#'+key),createElement:tag=>element(tag)};
  const desktop={authStatus:async()=>currentAuth,onAuthChanged(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    accountRequest:async()=>({ok:true}),
    authSignOut:async()=>({ok:true,serverRevoked:true}),
    companyRequest:async(operation,params)=>{calls.push({operation,params});if(request){const value=await request(operation,params,f);if(value!==undefined)return value;}
      if(operation==='status')return {enabled:true,browserEnabled:true,session:currentMe.user&&currentMe.synkUserId?'synk':'company',synkUserId:currentMe.synkUserId};
      if(operation==='challenge')return {challenge:'synthetic-challenge'};
      if(operation==='exchange')currentMe={user:{id:'company-A'},csrfToken:'csrf-restored',synkUserId:currentAuth.account.synk_user_id};
      if(operation==='logout')currentMe={user:null,csrfToken:'',synkUserId:null};return {ok:true};}};
  // Each page request may receive a time limit. Firing it aborts that request like Chromium does.
  const AbortSignalShim={timeout(ms){const controller=new AbortController();signals.push({ms,fire:()=>controller.abort(Object.assign(new Error('The operation was aborted due to timeout'),{name:'TimeoutError'}))});return controller.signal;}};
  const abortable=(pending,signal)=>!signal?pending:new Promise((resolve,reject)=>{if(signal.aborted)return reject(signal.reason);signal.addEventListener('abort',()=>reject(signal.reason),{once:true});pending.then(resolve,reject);});
  // Leaving the page dispatches beforeunload to the page listeners in order. A dirty draft guard cancels it.
  const unload=()=>{const event={defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const fn of [...(windowEvents.get('beforeunload')||[]),...(guard?[e=>e.preventDefault()]:[])]){fn(event);if(event.stopped)break;}return event;};
  const timer=repeat=>(fn,ms)=>{const key=++timerId;timers.set(key,{fn,ms,repeat});return key;};
  const context=vm.createContext({window:{synkDesktop:desktop,addEventListener(name,fn){if(!windowEvents.has(name))windowEvents.set(name,[]);windowEvents.get(name).push(fn);}},document,state,URL,URLSearchParams,app:content,overlay,
    fetch:async(path,options={})=>{calls.push({path,options});const result=onFetch?await abortable(Promise.resolve(onFetch(path,options,f)),options.signal):null;if(result)return {ok:(result.status||200)<400,status:result.status||200,json:async()=>result.data};const data=path==='/api/me'?currentMe:{user:currentMe.user,channels:[]};return {ok:true,status:200,json:async()=>data};},
    location:{href:'https://workspace.synk.im/?tab=messenger',pathname:'/',search:'?tab=messenger',hash:'',replace:v=>{moves.push(v);unload();},reload:()=>moves.push('reload')},history:{replaceState(){}},
    demoApiUrl:v=>v,isDemoMode:()=>false,selectWorkspaceView(){},initializeDemoRange(){},resetTeamOverview(){},normalizeMarketingScope(){},resetContentWorkspace(){},resetStudioWorkspace(){},closeModal(){overlay.innerHTML='';},
    render(){},resetWorkspaceModule(){},icon:()=>'',reportTabs:()=>false,startPolling(){},escape:value=>String(value),button:(text,action)=>`<button data-action="${action}">${text}</button>`,notify:v=>notices.push(v),
    AbortSignal:AbortSignalShim,setInterval:timer(true),clearInterval:key=>timers.delete(key),setTimeout:timer(false),clearTimeout:key=>timers.delete(key),pollTimer:null,hypePollTimer:null});
  const run=code=>vm.runInContext(code,context);
  vm.runInContext(source+'\n'+apiSource+'\n'+load+'\n'+initialize+'\n'+renderAuthSource,context);
  function emit(next){currentAuth=next;for(const fn of listeners)fn(next);}
  // Runs the timers that are due within `ms`. Intervals stay registered.
  function advance(ms){for(const [key,value]of [...timers]){if(value.ms<=ms&&timers.has(key)){if(!value.repeat)timers.delete(key);value.fn();}}}
  const f={run,state,calls,moves,content,notes,notices,desktop,document,emit,signals,timers,advance,windowEvents,
    setFocus(value){focused=value;},windowEvent(name){for(const fn of windowEvents.get(name)||[])fn({type:name});},
    get me(){return currentMe;},setMe:v=>{currentMe=v;},get auth(){return currentAuth;},
    bootEvents(){for(const fn of events.get('DOMContentLoaded')||[])fn();},renewals:()=>calls.filter(row=>row.operation==='renew').length,
    masked:()=>content.style.display==='none'&&content.inert===true,intervalRunning:()=>[...timers.values()].some(value=>value.repeat&&value.ms===20_000)};
  return f;
}
const failStatus=(f,times)=>{let left=times;return (operation)=>operation==='status'&&left-->0?{ok:false,error:{code:'COMPANY_UNAVAILABLE',message:'회사 서버에 요청하지 못했어요. 잠시 뒤 다시 해 주세요.'}}:undefined;};

test('moving focus into the chat frame keeps the 20-second renewal running',async()=>{
  const f=fixture();f.bootEvents();await f.run('initialize()');assert.equal(f.intervalRunning(),true);
  // Clicking inside the messenger iframe fires blur on the top window while the document keeps focus.
  f.windowEvent('blur');f.advance(0);await flush();
  assert.equal(f.intervalRunning(),true,'chat use must not stop renewing the company session');
  // Leaving the window for real still stops it.
  f.setFocus(false);f.windowEvent('blur');f.advance(0);await flush();
  assert.equal(f.intervalRunning(),false);assert.equal(f.run('synkNativeNeedsRecheck'),true);
});

test('a masked page checks again by itself when no focus event arrives',async()=>{
  let fail=1;const f=fixture({request:operation=>operation==='status'&&fail-->0?{ok:false,error:{code:'COMPANY_UNAVAILABLE',message:'회사 서버에 요청하지 못했어요. 잠시 뒤 다시 해 주세요.'}}:undefined});
  f.bootEvents();await f.run('initialize()');
  // The chat frame had focus, so the top window got blur earlier and will not get focus again.
  f.windowEvent('blur');f.run('clearInterval(synkRenewTimer);synkRenewTimer=null');
  await f.run('renewSynkCompanySession()');assert.equal(f.masked(),true,'a failed check masks company content');
  const before=f.renewals();f.advance(5_000);await flush();
  assert.equal(f.masked(),false,'the next automatic check unmasks without a focus event');assert.ok(f.renewals()>before);assert.deepEqual(f.moves,[]);
});

test('a masked check also runs while the window is shown but not focused, but not while hidden',async()=>{
  let fail=1;const f=fixture({request:operation=>operation==='status'&&fail-->0?{ok:false,error:{code:'COMPANY_UNAVAILABLE',message:'회사 서버에 요청하지 못했어요. 잠시 뒤 다시 해 주세요.'}}:undefined});
  f.bootEvents();await f.run('initialize()');await f.run('renewSynkCompanySession()');assert.equal(f.masked(),true);
  f.document.hidden=true;f.setFocus(false);const hiddenCalls=f.calls.length;f.advance(5_000);await flush();
  assert.equal(f.calls.length,hiddenCalls,'a hidden window makes no requests');assert.equal(f.masked(),true);
  f.document.hidden=false;f.advance(30_000);await flush();
  assert.equal(f.masked(),false,'a visible window recovers even before the crew clicks into it');
});

test('repeated failures show the reason and a reconnect button instead of an endless check',async()=>{
  const f=fixture({request:operation=>operation==='status'?{ok:false,error:{code:'COMPANY_UNAVAILABLE',message:'회사 서버에 요청하지 못했어요. 잠시 뒤 다시 해 주세요.'}}:undefined});
  f.bootEvents();await f.run('initialize()');await f.run('renewSynkCompanySession()');
  assert.equal(f.run('synkNativeMask.help'),false,'one failure keeps the calm checking note');
  f.advance(5_000);await flush();assert.equal(f.run('synkNativeMask.help'),false,'a short blip does not interrupt with the exit yet');
  f.advance(10_000);await flush();
  assert.equal(f.run('synkNativeMask.help'),true,'the third failed check shows why and a way out');
  assert.match(f.run('synkNativeMask.reason.textContent'),/회사 서버에 요청하지 못했어요/);
  assert.equal(f.run('synkNativeMask.action.textContent'),'다시 연결');
  // The reconnect button checks once more, then opens the workspace again the way the platform does.
  await f.run('reconnectNativeSynkCompany()');assert.deepEqual(f.moves,['/?tab=messenger']);
});

test('a long silent check shows the exit even without an error message',async()=>{
  const f=fixture();f.bootEvents();await f.run('initialize()');
  // Restoring/signing-in waits without an error, so only time can tell that it is stuck.
  f.emit({...signedIn(),status:'restoring',signedIn:false,account:null});await flush();assert.equal(f.masked(),true);
  f.advance(20_000);await flush();
  assert.equal(f.run('synkNativeMask.help'),true);assert.ok(f.run('synkNativeMask.reason.textContent').length>0);
  f.emit(signedIn());await flush();f.advance(30_000);await flush();assert.equal(f.masked(),false,'a later confirmation still removes the mask and its exit');
  assert.equal(f.run('synkNativeMask'),null);
});

test('a check request that never answers is cut off instead of holding the mask forever',async()=>{
  let hang=true;
  const f=fixture({onFetch:path=>path==='/api/me'&&hang?never():path==='/api/synk-id/challenge'?{data:{challenge:'recovery'}}:null});
  f.bootEvents();hang=false;await f.run('initialize()');hang=true;
  // The company session ended on the server (the access token expired while nobody renewed it).
  f.setMe({user:null,csrfToken:null,synkUserId:null});
  const task=f.run('renewSynkCompanySession()');await flush();
  assert.equal(f.masked(),true);assert.equal(f.run('synkRenewPending'),true,'the recovery is waiting on /api/me');
  const limits=f.signals.filter(row=>row.ms>0);assert.ok(limits.length>0,'page requests in the check carry a time limit');
  for(const limit of limits)limit.fire();await task;
  assert.equal(f.run('synkRenewPending'),false,'the stuck request no longer blocks later checks');assert.equal(f.masked(),true);
  hang=false;f.advance(5_000);await flush();f.advance(10_000);await flush();
  assert.equal(f.masked(),false,'a later check recovers once the server answers');assert.equal(f.state.csrf,'csrf-restored');
});

test('when unsaved work cancels the reopen, the mask says so and only an explicit choice leaves without saving',async()=>{
  const f=fixture({guard:true,request:operation=>operation==='status'?{ok:false,error:{code:'COMPANY_UNAVAILABLE',message:'회사 서버에 요청하지 못했어요. 잠시 뒤 다시 해 주세요.'}}:undefined});
  f.bootEvents();await f.run('initialize()');await f.run('renewSynkCompanySession()');f.advance(20_000);await flush();assert.equal(f.run('synkNativeMask.help'),true);
  // Dispatch like the browser does, with the dirty draft guard after the page listeners. True = the guard was skipped.
  const leave=()=>{let stopped=false;const event={type:'beforeunload',defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){stopped=true;}};for(const fn of [...(f.windowEvents.get('beforeunload')||[]),e=>e.preventDefault()]){fn(event);if(stopped)break;}return stopped;};
  // The Workspace window has no prompt for unsaved work: a guard keeps the page and location.replace does nothing.
  await f.run('reconnectNativeSynkCompany()');assert.deepEqual(f.moves,['/?tab=messenger']);assert.equal(leave(),false,'a normal reconnect keeps the unsaved-work guards');
  f.advance(3_000);await flush();
  assert.equal(f.run('synkNativeMask.blocked'),true);assert.equal(f.run('synkNativeMask.action.textContent'),'저장하지 않고 다시 열기');assert.equal(f.run('synkNativeMask.action.disabled'),false);
  assert.match(f.run('synkNativeMask.reason.textContent'),/저장하지 않은 작업이 있어 다시 열지 못했어요/);
  f.advance(5_000);await flush();assert.match(f.run('synkNativeMask.reason.textContent'),/저장하지 않은 작업/,'a later failure does not hide why the reopen stopped');
  await f.run('reconnectNativeSynkCompany()');assert.deepEqual(f.moves,['/?tab=messenger','/?tab=messenger']);assert.equal(leave(),true,'only the explicit choice passes the guards');
  f.advance(3_000);await flush();assert.equal(leave(),false,'the bypass never outlives that one reopen');
});

test('a reopen that is still loading is not blamed on unsaved work',async()=>{
  const f=fixture({request:operation=>operation==='status'?{ok:false,error:{code:'COMPANY_UNAVAILABLE',message:'회사 서버에 요청하지 못했어요. 잠시 뒤 다시 해 주세요.'}}:undefined});
  f.bootEvents();await f.run('initialize()');await f.run('renewSynkCompanySession()');f.advance(20_000);await flush();
  // No guard cancelled leaving; the server just has not answered the reopen within 3 seconds.
  await f.run('reconnectNativeSynkCompany()');f.advance(3_000);await flush();
  assert.equal(f.run('synkNativeMask.blocked'),false);assert.equal(f.run('synkNativeMask.action.textContent'),'다시 연결');
  assert.doesNotMatch(f.run('synkNativeMask.reason.textContent'),/저장하지 않은 작업/);assert.match(f.run('synkNativeMask.reason.textContent'),/회사 서버가 답하지 않아 아직 다시 열지 못했어요/);
});

test('a dropped connection while the app starts reads as Korean, not the browser error',async()=>{
  const f=fixture({onFetch:path=>{if(path==='/api/me')throw new TypeError('Failed to fetch');return null;}});f.bootEvents();
  await f.run('initialize()');
  assert.match(f.content.innerHTML,/회사 서버가 답하지 않아 SYNK ID 연결을 확인하지 못했어요/);assert.doesNotMatch(f.content.innerHTML,/Failed to fetch/);
});

test('a /api/me that never answers while the app starts ends on the error screen, not a blank page',async()=>{
  const f=fixture({onFetch:path=>path==='/api/me'?never():null});f.bootEvents();
  let settled=false;const boot=f.run('initialize()').finally(()=>{settled=true;});await flush();
  assert.equal(settled,false);
  for(const limit of f.signals)limit.fire();await boot;
  assert.equal(settled,true);assert.match(f.content.innerHTML,/워크스페이스를 열지 못했어요/);
  assert.doesNotMatch(f.content.innerHTML,/aborted|timeout/i,'the crew reads Korean, not the browser error');
});
