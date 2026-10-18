import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const signedIn=()=>({user:{id:'user-a',name:'합성 사용자'},workspace:{name:'시험 공간'},channels:[],members:[]});
function fixture({embedded=false,ignoreAbort=false}={}){
  const nodes=new Map(),listeners=new Map(),requests=[],notices=[],timers=new Map();let now=0,next=0;
  const get=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',value:'',open:false,style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector:get,querySelectorAll:()=>[],setAttribute(){},close(){}});return nodes.get(selector);};
  const listen=(target,type,handler)=>{const key=target+':'+type;if(!listeners.has(key))listeners.set(key,[]);listeners.get(key).push(handler);};
  const parent={postMessage:message=>notices.push(message)},window={parent,matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener:(type,handler)=>listen('window',type,handler)};
  const document={hidden:false,body:get('body'),querySelector:get,querySelectorAll:()=>[],addEventListener:(type,handler)=>listen('document',type,handler)};
  const context=vm.createContext({window,document,location:{pathname:embedded?'/messenger/':'/',origin:'http://localhost',replace(){}},URL,URLSearchParams,AbortController,localStorage:{getItem(){return null;},setItem(){},removeItem(){}},
    setTimeout(callback,delay){timers.set(++next,{at:now+delay,delay,callback});return next;},clearTimeout:id=>timers.delete(id),
    fetch(path,options){return new Promise((resolve,reject)=>{const request={path,options,resolve,reject};requests.push(request);if(!ignoreAbort)options.signal?.addEventListener('abort',()=>reject(options.signal.reason),{once:true});});},
  });
  const run=code=>vm.runInContext(code,context);run(source);
  run("renderShell=()=>{app.innerHTML='workspace ready';};voiceController=()=>null;clearChannelSelection=()=>{};connectEvents=()=>{};refreshChannels=async()=>{};refreshMessages=async()=>{};refreshVisibleWorkday=async()=>{};cancelWorkdayRefresh=()=>{};");
  if(embedded)run('moduleVisible=true');
  const event=async(target,type,value={})=>{for(const handler of listeners.get(target+':'+type)||[])await handler(value);await settle();};
  const respond=(index,status,data={})=>requests[index].resolve({ok:status>=200&&status<300,status,json:async()=>data});
  const advance=async ms=>{const end=now+ms;while(true){const due=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].callback();await settle();}now=end;};
  return{run,context,document,parent,requests,notices,timers,get,respond,advance,event,state:run('state')};
}

test('temporary bootstrap failure retries without a click and success clears recovery',async()=>{
  const f=fixture();const first=f.run('boot()');f.respond(0,503,{error:'잠시 후 다시 시도'});await first;
  assert.match(f.get('#app').innerHTML,/자동으로 다시 연결/);assert.equal(f.requests.length,1);
  await f.advance(1999);assert.equal(f.requests.length,1);await f.advance(1);assert.equal(f.requests.length,2);
  assert.match(f.get('#app').innerHTML,/다시 연결하고 있어요/);
  f.respond(1,200,signedIn());await settle();assert.equal(f.get('#app').innerHTML,'workspace ready');assert.equal(f.timers.size,0);
  await f.event('window','online');await f.advance(60000);assert.equal(f.requests.length,2);
});

test('retry backoff grows to thirty seconds and repeated visible messages do not bypass it',async()=>{
  const f=fixture({embedded:true});let pending=f.run('boot()');
  for(const delay of [2000,4000,8000,16000,30000,30000]){
    const count=f.requests.length;f.respond(count-1,429,{error:'잠시 대기'});if(pending){await pending;pending=null;}else await settle();
    await f.event('window','message',{origin:'http://localhost',source:f.parent,data:{type:'workspace:visible',visible:true}});
    assert.deepEqual([...f.timers.values()].map(timer=>timer.delay),[delay]);
    await f.advance(delay-1);assert.equal(f.requests.length,count);await f.advance(1);assert.equal(f.requests.length,count+1);
  }
  await f.event('window','pagehide');
});

test('a timed-out bootstrap is aborted and an ignored late response cannot replace a new session',async()=>{
  const f=fixture({ignoreAbort:true}),first=f.run('boot()');
  await f.advance(10000);await first;assert.equal(f.requests[0].options.signal.aborted,true);
  await f.advance(2000);f.respond(1,200,signedIn());await settle();
  f.respond(0,200,{...signedIn(),user:{id:'old-user'}});await settle();
  assert.equal(f.state.user.id,'user-a');assert.equal(f.get('#app').innerHTML,'workspace ready');assert.equal(f.timers.size,0);
});

test('manual retry and online events never duplicate an active bootstrap',async()=>{
  const f=fixture();const first=f.run('boot()');f.requests[0].reject(new TypeError('network disconnected'));await first;
  await f.event('window','online');await f.event('window','online');await f.advance(0);
  assert.equal(f.requests.length,2);await f.run('boot()');await f.event('window','online');await f.advance(0);assert.equal(f.requests.length,2);
  f.respond(1,200,signedIn());await settle();assert.equal(f.timers.size,0);
});

test('hidden failure screens pause retries until visible again',async()=>{
  const f=fixture({embedded:true});const first=f.run('boot()');
  await f.event('window','message',{origin:'http://localhost',source:f.parent,data:{type:'workspace:visible',visible:false}});
  f.respond(0,502,{error:'연결 실패'});await first;assert.equal(f.timers.size,0);
  await f.event('window','online');await f.advance(60000);assert.equal(f.requests.length,1);
  await f.event('window','message',{origin:'http://localhost',source:f.parent,data:{type:'workspace:visible',visible:true}});await f.advance(0);assert.equal(f.requests.length,2);
  f.document.hidden=true;f.respond(1,503);await settle();assert.equal(f.timers.size,0);
  f.document.hidden=false;await f.event('document','visibilitychange');await f.advance(0);assert.equal(f.requests.length,3);
  await f.event('window','pagehide');
});

test('an integrated 401 keeps the company login flow and does not schedule recovery',async()=>{
  const f=fixture({embedded:true}),pending=f.run('boot()');f.respond(0,401,{error:'로그인 필요'});await pending;
  assert.match(f.get('#app').innerHTML,/워크스페이스 로그인/);assert.doesNotMatch(f.get('#app').innerHTML,/자동으로 다시 연결/);
  assert.ok(f.notices.some(message=>message.type==='messenger:auth-expired'));assert.equal(f.timers.size,0);
  await f.event('window','online');await f.advance(60000);assert.equal(f.requests.length,1);
});

test('permission and other permanent bootstrap failures do not retry automatically',async()=>{
  for(const status of [400,403,404]){
    const f=fixture(),pending=f.run('boot()');f.respond(0,status,{error:'접근 확인 필요'});await pending;
    assert.doesNotMatch(f.get('#app').innerHTML,/자동으로 다시 연결/);assert.equal(f.timers.size,0);
    await f.event('window','online');await f.advance(60000);assert.equal(f.requests.length,1);
  }
});

test('a permanent failure screen restored from the browser cache still retries on the button',async()=>{
  const f=fixture(),pending=f.run('boot()');f.respond(0,403,{error:'접근 확인 필요'});await pending;
  await f.event('window','pagehide');await f.event('window','pageshow',{persisted:true});await f.advance(0);
  assert.equal(f.requests.length,1);assert.equal(f.timers.size,0);
  f.get('#retry-boot').onclick();await settle();assert.equal(f.requests.length,2);
  f.respond(1,200,signedIn());await settle();assert.equal(f.get('#app').innerHTML,'workspace ready');
});

test('auth and workspace transitions cancel pending bootstrap responses including late 401',async()=>{
  for(const transition of ['auth','workspace']){
    const f=fixture({embedded:transition==='workspace',ignoreAbort:true}),pending=f.run('boot()');
    if(transition==='auth')f.run("renderAuth('login')");else{f.context.nextSession=signedIn();f.run('enterWorkspace(nextSession)');}
    const expected=f.get('#app').innerHTML;assert.equal(f.requests[0].options.signal.aborted,true);
    f.respond(0,401,{error:'이전 세션'});await pending;
    assert.equal(f.get('#app').innerHTML,expected);assert.equal(f.timers.size,0);assert.ok(!f.notices.some(message=>message.type==='messenger:auth-expired'));
  }
});

test('page exit clears waiting timers and invalidates active bootstrap work',async()=>{
  for(const waiting of [false,true]){
    const f=fixture({ignoreAbort:true}),pending=f.run('boot()');
    if(waiting){f.respond(0,503);await pending;}
    await f.event('window','pagehide');const expected=f.get('#app').innerHTML;
    if(!waiting){f.respond(0,200,signedIn());await pending;}
    await f.event('window','online');await f.advance(60000);
    assert.equal(f.get('#app').innerHTML,expected);assert.equal(f.requests.length,1);assert.equal(f.timers.size,0);
  }
});

test('a bootstrap deadline also covers parent session recovery before fetch starts',async()=>{
  const f=fixture({embedded:true});let release;const recovery=new Promise(resolve=>{release=resolve;});
  f.context.window.parent={...f.parent,location:{origin:'http://localhost'},ensureNativeSynkCompanySession:()=>recovery};
  const pending=f.run('boot()');assert.equal(f.requests.length,0);await f.advance(10000);await pending;
  release(null);await settle();assert.equal(f.requests.length,0,'the aborted recovery must not start a late HTTP request');
  await f.advance(2000);assert.equal(f.requests.length,1);f.respond(0,200,signedIn());await settle();assert.equal(f.state.user.id,'user-a');
});

test('returning from the browser cache resumes an interrupted bootstrap but preserves a ready workspace',async()=>{
  for(const ready of [false,true]){
    const f=fixture(),pending=f.run('boot()');
    f.respond(0,ready?200:503,ready?signedIn():{});await pending;
    await f.event('window','pagehide');await f.event('window','pageshow',{persisted:true});await f.advance(0);
    assert.equal(f.requests.length,ready?1:2);
    if(!ready){f.respond(1,200,signedIn());await settle();}
    assert.equal(f.get('#app').innerHTML,'workspace ready');assert.equal(f.timers.size,0);
  }
});
