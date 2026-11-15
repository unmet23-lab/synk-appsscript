import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyEntryReceiver} from './public/pulse-app/entry-handoff.mjs';

const ORIGIN='https://workspace.synk.im',HOST='https://synk.im';
const DOC='11111111-1111-4111-8111-111111111111';
const REQUEST='22222222-2222-4222-8222-222222222222';
const GENERATION='33333333-3333-4333-8333-333333333333';
const ACCOUNT='44444444-4444-4444-8444-444444444444';
const OTHER='55555555-5555-4555-8555-555555555555';
const SECRET='synthetic-private-invite';
const paths={receiver:'/entry/',employee:'/',customer:'/pulse-app/'};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(role='employee',options={}){
  const sent=[],states=[],navigated=[],fetches=[],attrs=new Map(),listeners=new Map(),timers=new Map();
  let clock=0,nextTimer=0;
  const opener={postMessage:(value,origin)=>{sent.push({peer:'web',value,origin});}};
  const win={
    location:{href:ORIGIN+paths[role],replace:destination=>navigated.push(destination)},
    opener,crypto:{randomUUID:()=>DOC},performance:{now:()=>clock},AbortController,
    document:{documentElement:{setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key)}},
    addEventListener:(type,handler)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(handler);},
    removeEventListener:(type,handler)=>listeners.get(type)?.delete(handler),
    setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{at:clock+ms,fn});return id;},clearTimeout:id=>timers.delete(id),
    postMessage:(value,origin)=>{sent.push({peer:'native',value,origin});},
    fetch:async(url,init)=>{fetches.push({url,init});return {ok:true,status:200,json:async()=>({version:1,kind:'employee',destination:'/'})};}
  };
  win.top=win;
  Object.assign(win,options.window);
  // Throwing accessors prove this module never uses a secret persistence channel.
  for(const name of ['localStorage','sessionStorage','name'])Object.defineProperty(win,name,{get(){throw new Error('secret persistence forbidden');},set(){throw new Error('secret persistence forbidden');}});
  const supplied=options.hooks||{};
  const receiver=createCompanyEntryReceiver({window:win,role,queueInvite:async()=>({queued:true}),...supplied,onState:state=>{states.push(state);supplied.onState?.(state);}});
  const dispatch=(data,{peer='web',source,origin}={})=>{
    for(const fn of [...(listeners.get('message')||[])])fn({data,origin:origin??(peer==='web'?HOST:ORIGIN),source:source??(peer==='web'?opener:win)});
  };
  const packet=(type,extra={})=>({channel:'synk.company.entry',version:1,type,requestId:REQUEST,accountGeneration:GENERATION,documentId:DOC,...extra});
  const bind=(phase=role==='receiver'?'classify':'deliver',extra={},peer='web')=>dispatch(packet('bind',{phase,expectedAccountId:null,...extra}),{peer});
  const offer=(token=SECRET,extra={},peer='web')=>dispatch(packet('offer',{token,...extra}),{peer});
  const advance=(ms,fire=true)=>{
    const end=clock+ms;
    if(fire){for(;;){const due=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;clock=due[1].at;timers.delete(due[0]);due[1].fn();}}
    clock=end;
  };
  return {win,receiver,sent,states,navigated,fetches,attrs,listeners,timers,dispatch,packet,bind,offer,advance,
    replies:type=>sent.filter(item=>item.value.type===type),pagehide:()=>{for(const fn of [...(listeners.get('pagehide')||[])])fn();}};
}

for(const role of Object.keys(paths))test(`${role}: listener and exact capability precede token-free ready`,()=>{
  const f=fixture(role);assert.equal(f.listeners.get('message').size,1);
  assert.deepEqual([...f.attrs],[[role==='customer'?'data-pulse-invite-receiver':'data-synk-company-entry',role==='customer'?'2':'1']]);
  assert.equal(f.replies('ready').length,2);
  for(const ready of f.replies('ready'))assert.deepEqual(ready.value,{channel:'synk.company.entry',version:1,type:'ready',documentId:DOC,documentRole:role});
  assert.deepEqual(f.sent.map(x=>x.origin),[ORIGIN,HOST]);f.receiver.dispose();assert.equal(f.attrs.size,0);
});

test('unsupported origin, path, query, hash, frame or missing queue never advertises readiness',async()=>{
  for(const window of [{location:{href:'https://other.example/'}},{location:{href:ORIGIN+'/other/'}},{location:{href:ORIGIN+'/?x=1'}},{location:{href:ORIGIN+'/#invite=legacy'}},{top:{}}]){
    const f=fixture('employee',{window});assert.equal(f.sent.length,0);assert.equal(f.attrs.size,0);assert.equal(await f.receiver.waitForFirstHandoff(),false);
  }
  const f=fixture('customer',{hooks:{queueInvite:undefined}});assert.equal(f.sent.length,0);
});

test('untrusted source/origin, malformed fields, foreign IDs and offers without bind have no queue effects',async()=>{
  let calls=0;const f=fixture('employee',{hooks:{queueInvite:async()=>{calls++;return {queued:true};}}});
  const bind=f.packet('bind',{phase:'deliver',expectedAccountId:null});
  f.dispatch(bind,{origin:ORIGIN,source:{}});f.dispatch(bind,{origin:HOST,source:{}});f.dispatch(bind,{origin:'https://evil.example'});
  for(const bad of [[],{...bind,unknown:true},{...bind,requestId:'invalid'},{...bind,documentId:OTHER},{...bind,accountGeneration:4},Object.assign(Object.create({}),bind)])f.dispatch(bad);
  f.offer();await flush();assert.equal(calls,0);assert.equal(f.replies('bound').length,0);
  f.bind();f.offer(SECRET,{accountGeneration:OTHER});f.offer(SECRET,{requestId:OTHER});f.offer(SECRET,{documentId:OTHER});await flush();assert.equal(calls,0);
  f.offer();await flush();assert.equal(calls,1);assert.equal(f.replies('received').length,1);
});

test('web messages with null opener and frame-like sources do not bind',()=>{
  const f=fixture('receiver',{window:{opener:null}});f.bind();assert.equal(f.replies('bound').length,0);
  f.dispatch(f.packet('bind',{phase:'classify',expectedAccountId:null}),{origin:ORIGIN,source:{parent:f.win}});assert.equal(f.replies('bound').length,0);
});

test('role/phase and expected-account shape must match the exact protocol',()=>{
  for(const [role,phase] of [['receiver','deliver'],['employee','classify'],['customer','classify'],['employee','resolve']]){
    const f=fixture(role);f.bind(phase);assert.equal(f.replies('bound').length,0);assert.equal(f.replies('error')[0].value.code,'INVALID_INPUT');
  }
  const f=fixture('receiver');f.bind('resolve');f.bind('resolve',{expectedAccountId:'some-user'});assert.equal(f.replies('bound').length,0);
});

for(const kind of ['employee','customer'])test(`web classification ${kind} reads once and navigates only to the fixed path`,async()=>{
  let calls=0;const f=fixture('receiver',{hooks:{inspectInvite:async args=>{calls++;assert.equal(args.token,SECRET);assert.equal(args.isCurrent(),true);return {version:1,kind,destination:paths[kind]};}}});
  const waiting=f.receiver.waitForFirstHandoff();let settled=false;waiting.then(()=>settled=true);f.bind();await flush();assert.equal(settled,false);
  f.offer();await flush();assert.equal(await waiting,true);assert.equal(calls,1);assert.deepEqual(f.navigated,[paths[kind]]);assert.equal(f.replies('classified').length,1);assert.equal(f.replies('received').length,0);
  assert.equal(JSON.stringify(f.sent).includes(SECRET),false);assert.equal(JSON.stringify(f.states).includes(SECRET),false);
});

test('native classification never navigates and native resolve never calls web cookie APIs',async()=>{
  const f=fixture('receiver');f.bind('classify',{},'native');f.offer(SECRET,{},'native');await flush();assert.equal(f.replies('classified').length,1);assert.deepEqual(f.navigated,[]);
  const g=fixture('customer',{hooks:{resolveDestinations:()=>{throw new Error('native must not use cookie callback');}}});g.bind('resolve',{expectedAccountId:ACCOUNT},'native');await flush();assert.equal(g.fetches.length,0);assert.equal(g.replies('assignment')[0].value.result.status,'unavailable');
});

test('classification accepts neither arbitrary destination nor extra server data',async()=>{
  for(const result of [{version:1,kind:'employee',destination:'/pulse-app/'},{version:1,kind:'customer',destination:'https://evil.example/'},{version:1,kind:'employee',destination:'/',token:SECRET},null]){
    const f=fixture('receiver',{hooks:{inspectInvite:async()=>result}});f.bind();f.offer();await flush();assert.deepEqual(f.navigated,[]);assert.equal(f.replies('classified').length,0);assert.equal(f.replies('error')[0].value.code,'TEMPORARY_UNAVAILABLE');
  }
});

test('default inspect is same-origin non-consuming POST and maps real HTTP failures',async()=>{
  for(const [status,code] of [[400,'INVALID_INPUT'],[413,'INVALID_INPUT'],[403,'INVITE_REJECTED'],[429,'RATE_LIMITED'],[500,'TEMPORARY_UNAVAILABLE']]){
    const calls=[];const f=fixture('receiver',{window:{fetch:async(url,init)=>{calls.push({url,init});return {ok:false,status,json:async()=>({error:'private server data'})};}}});f.bind();f.offer();await flush();
    assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/invite/inspect');assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.redirect,'error');assert.deepEqual(JSON.parse(calls[0].init.body),{token:SECRET});assert.equal(f.replies('error')[0].value.code,code);assert.equal(JSON.stringify(f.sent).includes('private server data'),false);
  }
});

for(const role of ['employee','customer'])test(`${role}: bound and in-flight queue never ACK; actual queue completion does`,async()=>{
  const queue=deferred();let args;const f=fixture(role,{hooks:{queueInvite:value=>{args=value;return queue.promise;}}});
  const waiting=f.receiver.waitForFirstHandoff(20);let settled=false;waiting.then(()=>settled=true);f.bind();f.advance(30);f.offer();await flush();assert.equal(settled,false);assert.equal(f.replies('received').length,0);
  assert.equal(args.token,SECRET);assert.equal(args.requestId,REQUEST);assert.equal(args.accountGeneration,GENERATION);assert.equal(args.expectedAccountId,null);assert.equal(args.isCurrent(),true);assert.equal(args.signal.aborted,false);
  queue.resolve({queued:true});await flush();assert.equal(await waiting,true);assert.equal(f.replies('received').length,1);assert.deepEqual(f.replies('received')[0].value,{channel:'synk.company.entry',version:1,type:'received',requestId:REQUEST,accountGeneration:GENERATION,documentId:DOC,kind:role,destination:paths[role],state:'queued'});
});

test('non-queue callback results cannot claim receipt or unblock initialization successfully',async()=>{
  for(const result of [true,false,undefined,{queued:false},{queued:true,token:SECRET},{state:'queued'}]){
    const f=fixture('employee',{hooks:{queueInvite:async()=>result}});const pending=f.receiver.waitForFirstHandoff();f.bind();f.offer();await flush();assert.equal(await pending,false);assert.equal(f.replies('received').length,0);assert.equal(f.replies('error')[0].value.code,'HANDOFF_UNAVAILABLE');
  }
});

test('same-token retries ACK one actual queue; different token/new request never overwrite it',async()=>{
  let calls=0;const queue=deferred();const f=fixture('employee',{hooks:{queueInvite:()=>{calls++;return queue.promise;}}});f.bind();f.offer();f.offer();f.offer('another-secret');f.bind('deliver',{requestId:OTHER});await flush();assert.equal(calls,1);assert.equal(f.replies('received').length,0);
  queue.resolve({queued:true});await flush();f.offer();await flush();assert.equal(calls,1);assert.equal(f.replies('received').length,2);assert.deepEqual(f.replies('error').map(x=>x.value.code),['BUSY','BUSY']);
});

test('cancel aborts pending queue, supplies only matching IDs to cleanup and ignores late success',async()=>{
  const queue=deferred(),cleanup=[];let args;const f=fixture('employee',{hooks:{queueInvite:value=>{args=value;return queue.promise;},cancelInvite:value=>cleanup.push(value)}});const pending=f.receiver.waitForFirstHandoff();f.bind();f.offer();f.dispatch(f.packet('cancel'));queue.resolve({queued:true});await flush();
  assert.equal(await pending,false);assert.equal(args.signal.aborted,true);assert.equal(args.isCurrent(),false);assert.equal(cleanup.length,1);assert.equal(cleanup[0].requestId,REQUEST);assert.equal(Object.hasOwn(cleanup[0],'token'),false);assert.equal(f.replies('received').length,0);assert.equal(f.attrs.size,1);assert.equal(f.listeners.get('message').size,1);
});

test('foreign generation cancel does not cancel the current queue',async()=>{
  const queue=deferred();const f=fixture('customer',{hooks:{queueInvite:()=>queue.promise}});f.bind();f.offer();f.dispatch(f.packet('cancel',{accountGeneration:OTHER}));queue.resolve({queued:true});await flush();assert.equal(f.replies('received').length,1);
});

test('pagehide removes listeners/capability, aborts inspect and ignores late navigation',async()=>{
  const query=deferred();let args;const f=fixture('receiver',{hooks:{inspectInvite:value=>{args=value;return query.promise;}}});const pending=f.receiver.waitForFirstHandoff();f.bind();f.offer();f.pagehide();query.resolve({version:1,kind:'employee',destination:'/'});await flush();
  assert.equal(await pending,false);assert.equal(args.signal.aborted,true);assert.equal(f.listeners.get('message').size,0);assert.equal(f.listeners.get('pagehide').size,0);assert.equal(f.attrs.size,0);assert.deepEqual(f.navigated,[]);assert.equal(f.replies('classified').length,0);
});

test('timeout before bind returns false without closing a resident document',async()=>{
  const f=fixture();const pending=f.receiver.waitForFirstHandoff(15001);f.advance(14999);assert.equal(f.states.at(-1).status,'ready');f.advance(1);assert.equal(await pending,false);assert.equal(f.states.at(-1).code,'HANDOFF_TIMEOUT');assert.equal(f.attrs.size,1);f.bind('deliver',{requestId:OTHER});f.offer(SECRET,{requestId:OTHER});await flush();assert.equal(f.replies('received').length,1);
});

test('offer and queue stage each receive at most fifteen seconds',async()=>{
  const f=fixture();const pending=f.receiver.waitForFirstHandoff();f.bind();f.advance(15000);assert.equal(await pending,false);
  const queue=deferred();const g=fixture('employee',{hooks:{queueInvite:()=>queue.promise}});const done=g.receiver.waitForFirstHandoff();g.bind();g.advance(14999);g.offer();g.advance(14999);assert.equal(g.replies('error').length,0);g.advance(1);queue.resolve({queued:true});await flush();assert.equal(await done,false);assert.equal(g.replies('received').length,0);
});

test('late promise cannot beat an overdue stage timer while event loop delivery is delayed',async()=>{
  const queue=deferred();const f=fixture('employee',{hooks:{queueInvite:()=>queue.promise}});const pending=f.receiver.waitForFirstHandoff();f.bind();f.offer();f.advance(15001,false);queue.resolve({queued:true});await flush();assert.equal(await pending,false);assert.equal(f.replies('received').length,0);assert.equal(f.replies('error')[0].value.code,'HANDOFF_TIMEOUT');
});

test('duplicate binds do not extend the total or active stage lifetime',async()=>{
  const f=fixture();const pending=f.receiver.waitForFirstHandoff();f.bind();for(let i=0;i<14;i++){f.advance(1000);f.bind();}f.advance(1000);assert.equal(await pending,false);assert.equal(f.replies('error').at(-1).value.code,'HANDOFF_TIMEOUT');
});

test('overdue bind/offer and queue isCurrent reject before delayed timers run',async()=>{
  const f=fixture();const first=f.receiver.waitForFirstHandoff();f.advance(15001,false);f.bind();assert.equal(await first,false);assert.equal(f.replies('bound').length,0);
  const g=fixture();g.bind();g.advance(15001,false);g.offer();await flush();assert.equal(g.replies('received').length,0);assert.equal(g.replies('error')[0].value.code,'HANDOFF_TIMEOUT');
  let args;const queue=deferred();const h=fixture('customer',{hooks:{queueInvite:value=>{args=value;return queue.promise;}}});h.bind();h.offer();h.advance(15001,false);assert.equal(args.isCurrent(),false);assert.equal(args.signal.aborted,true);queue.resolve({queued:true});await flush();assert.equal(h.replies('received').length,0);
});

test('UI cancellation during queueing notification prevents invoking the real queue',async()=>{
  let receiver,calls=0;const f=fixture('employee',{hooks:{onState:state=>{if(state.status==='queueing')receiver.cancel();},queueInvite:async()=>{calls++;return {queued:true};}}});receiver=f.receiver;f.bind();f.offer();await flush();assert.equal(calls,0);assert.equal(f.replies('received').length,0);
});

test('UI cancellation after classified ACK prevents navigation',async()=>{
  let receiver;const f=fixture('receiver',{hooks:{onState:state=>{if(state.status==='classified')receiver.cancel();}}});receiver=f.receiver;f.bind();f.offer();await flush();assert.equal(f.replies('classified').length,1);assert.deepEqual(f.navigated,[]);
});

test('detached peer cannot turn an unsent queue ACK into initialization success',async()=>{
  const queue=deferred();const f=fixture('employee',{hooks:{queueInvite:()=>queue.promise}});const pending=f.receiver.waitForFirstHandoff();f.bind();f.offer();f.win.opener.postMessage=()=>{throw new Error('detached');};queue.resolve({queued:true});await flush();assert.equal(await pending,false);assert.equal(f.replies('received').length,0);
});

for(const [workspace,pulse,status,destinations,missing] of [
  ['unassigned','unassigned','resolved',[],[]],['assigned','unassigned','resolved',['/'],[]],['unassigned','assigned','resolved',['/pulse-app/'],[]],['assigned','assigned','resolved',['/','/pulse-app/'],[]],['assigned','unavailable','partial',['/'],['pulse']]
])test(`web resolve ${workspace}/${pulse} returns only verified minimal assignment`,async()=>{
  const f=fixture('receiver',{hooks:{resolveDestinations:async args=>{assert.equal(args.expectedAccountId,ACCOUNT);return {version:1,accountMatch:true,workspace:{state:workspace,destination:'/'},pulse:{state:pulse,destination:'/pulse-app/'}};}}});const pending=f.receiver.waitForFirstHandoff();f.bind('resolve',{expectedAccountId:ACCOUNT});await flush();assert.equal(await pending,true);assert.deepEqual(f.replies('assignment')[0].value.result,{status,destinations,unavailable:missing});assert.deepEqual(f.navigated,[]);
});

test('web resolve uses expectedAccountId only as same-origin request body and distinguishes failures',async()=>{
  for(const [http,status] of [[401,'login_required'],[409,'account_mismatch'],[429,'unavailable'],[503,'unavailable'],[200,'unavailable']]){
    const calls=[];const f=fixture('customer',{window:{fetch:async(url,init)=>{calls.push({url,init});return {ok:http===200,status:http,json:async()=>({error:{code:'PRIVATE_FAILURE'},token:SECRET})};}}});f.bind('resolve',{expectedAccountId:ACCOUNT});await flush();assert.equal(calls[0].url,'/api/customer/entry/destinations');assert.deepEqual(JSON.parse(calls[0].init.body),{expectedAccountId:ACCOUNT});assert.equal(calls[0].init.credentials,'same-origin');assert.equal(f.replies('assignment')[0].value.result.status,status);assert.equal(JSON.stringify(f.sent).includes(SECRET),false);
  }
});

test('resolve cancellation prevents late assignment and aborts its request',async()=>{
  const query=deferred();let args;const f=fixture('receiver',{hooks:{resolveDestinations:value=>{args=value;return query.promise;}}});const done=f.receiver.waitForFirstHandoff();f.bind('resolve',{expectedAccountId:ACCOUNT});f.receiver.cancel('ACCOUNT_CHANGED');query.resolve({version:1,accountMatch:true,workspace:{state:'assigned',destination:'/'},pulse:{state:'assigned',destination:'/pulse-app/'}});await flush();assert.equal(await done,false);assert.equal(args.signal.aborted,true);assert.equal(f.replies('assignment').length,0);
});

for(const role of ['employee','customer'])test(`${role}: reused native document receives a second invitation only after the first app queue is consumed`,async()=>{
  let pending=null;const calls=[],cleanup=[],queries=[];
  const f=fixture(role,{hooks:{queueInvite:async request=>{calls.push(request);pending=request.requestId;return {queued:true};},isInvitePending:request=>{queries.push(request);return pending===request.requestId;},cancelInvite:request=>cleanup.push(request)}});
  f.bind('deliver',{},'native');f.offer(SECRET,{},'native');await flush();assert.equal(calls.length,1);
  f.bind('deliver',{requestId:OTHER},'native');assert.equal(f.replies('error').at(-1).value.code,'BUSY');assert.equal(calls[0].signal.aborted,false);
  pending=null;f.bind('deliver',{requestId:OTHER},'native');f.offer('second-synthetic-invite',{requestId:OTHER},'native');await flush();
  assert.equal(calls.length,2);assert.deepEqual(f.replies('received').map(x=>x.value.requestId),[REQUEST,OTHER]);assert.equal(calls[0].signal.aborted,true);assert.equal(calls[0].isCurrent(),false);assert.equal(calls[1].isCurrent(),true);assert.equal(cleanup.length,0);
  assert.deepEqual(queries,[{requestId:REQUEST,accountGeneration:GENERATION},{requestId:REQUEST,accountGeneration:GENERATION}]);
});

test('consumed queue keeps same-request same-token retries idempotent before the next bind',async()=>{
  let calls=0,queries=0;const f=fixture('customer',{hooks:{queueInvite:async()=>{calls++;return {queued:true};},isInvitePending:()=>{queries++;return false;}}});
  f.bind();f.offer();await flush();f.bind();f.offer();await flush();assert.equal(calls,1);assert.equal(queries,0);assert.equal(f.replies('received').length,2);
  f.offer('different-token');await flush();assert.equal(calls,1);assert.equal(f.replies('error').at(-1).value.code,'BUSY');
  f.bind('deliver',{requestId:OTHER});f.offer('second-token',{requestId:OTHER});await flush();assert.equal(calls,2);
});

test('queue reuse requires a synchronous explicit false, not an absent/throwing/unknown hook',async()=>{
  for(const isInvitePending of [undefined,()=>true,()=>undefined,()=>null,()=>Promise.resolve(false),()=>{throw new Error('unknown queue');}]){
    let calls=0;const f=fixture('customer',{hooks:{isInvitePending,queueInvite:async()=>{calls++;return {queued:true};}}});f.bind();f.offer();await flush();f.bind('deliver',{requestId:OTHER});f.offer('second-token',{requestId:OTHER});await flush();assert.equal(calls,1);assert.equal(f.replies('error').at(-1).value.code,'BUSY');
  }
});

test('queueing is still BUSY even when pending hook claims false',async()=>{
  const queue=deferred();let queries=0,calls=0;const f=fixture('customer',{hooks:{queueInvite:()=>{calls++;return queue.promise;},isInvitePending:()=>{queries++;return false;}}});
  f.bind();f.offer();f.bind('deliver',{requestId:OTHER});f.offer('second-token',{requestId:OTHER});assert.equal(queries,0);assert.equal(calls,1);assert.equal(f.replies('error').at(-1).value.code,'BUSY');queue.resolve({queued:true});await flush();assert.equal(f.replies('received').length,1);
});

test('second invitation gets fresh offer/queue deadlines and cannot inherit the first successful wait result',async()=>{
  const second=deferred();let calls=0;const cleanup=[];
  const f=fixture('customer',{hooks:{queueInvite:()=>++calls===1?Promise.resolve({queued:true}):second.promise,isInvitePending:()=>false,cancelInvite:request=>cleanup.push(request)}});
  f.bind();f.offer();await flush();assert.equal(await f.receiver.waitForFirstHandoff(),true);f.advance(120000);
  f.bind('deliver',{requestId:OTHER});const done=f.receiver.waitForFirstHandoff();let settled=false;done.then(()=>settled=true);f.advance(14999);f.offer('second-token',{requestId:OTHER});await flush();assert.equal(settled,false);assert.equal(calls,2);
  f.advance(14999);assert.equal(settled,false);f.advance(1);second.resolve({queued:true});await flush();assert.equal(await done,false);assert.equal(f.replies('received').length,1);assert.equal(f.replies('error').at(-1).value.requestId,OTHER);assert.equal(f.replies('error').at(-1).value.code,'HANDOFF_TIMEOUT');assert.deepEqual(cleanup.map(x=>x.requestId),[OTHER]);
});

test('old cancel/offer/generation cannot alter a second active invitation',async()=>{
  const second=deferred();let calls=0;const cleanup=[];
  const f=fixture('customer',{hooks:{queueInvite:()=>++calls===1?Promise.resolve({queued:true}):second.promise,isInvitePending:()=>false,cancelInvite:request=>cleanup.push(request)}});
  f.bind();f.offer();await flush();f.bind('deliver',{requestId:OTHER,accountGeneration:ACCOUNT});f.offer('second-token',{requestId:OTHER,accountGeneration:ACCOUNT});
  f.dispatch(f.packet('cancel'));f.offer();f.dispatch(f.packet('cancel',{requestId:OTHER}));second.resolve({queued:true});await flush();assert.equal(cleanup.length,0);assert.deepEqual(f.replies('received').map(x=>[x.value.requestId,x.value.accountGeneration]),[[REQUEST,GENERATION],[OTHER,ACCOUNT]]);
});

test('same request ID cannot be reused with a changed generation or phase to discard its queue',async()=>{
  let queries=0;const f=fixture('customer',{hooks:{isInvitePending:()=>{queries++;return false;}}});f.bind();f.offer();await flush();f.bind('deliver',{accountGeneration:OTHER});assert.equal(queries,0);assert.equal(f.replies('error').at(-1).value.code,'BUSY');
});


for(const role of ['employee','customer'])for(const reason of ['cancel','timeout','BUSY'])test(role+': request '+reason+' retires only that request and permits a fresh handoff',async()=>{
  let calls=0;const cleanup=[];
  const f=fixture(role,{hooks:{queueInvite:async()=>{calls++;if(reason==='BUSY'&&calls===1)throw Object.assign(new Error('synthetic busy'),{code:'BUSY'});return {queued:true};},cancelInvite:request=>cleanup.push(request),isInvitePending:()=>false}});
  f.bind('deliver',{},'native');
  if(reason==='cancel')f.dispatch(f.packet('cancel'),{peer:'native'});
  if(reason==='timeout')f.advance(15000);
  if(reason==='BUSY'){f.offer(SECRET,{},'native');await flush();}
  assert.equal(await f.receiver.waitForFirstHandoff(),false);
  assert.equal(f.listeners.get('message').size,1);assert.equal(f.attrs.size,1);
  f.bind('deliver',{},'native');f.offer(SECRET,{},'native');await flush();
  assert.equal(f.replies('bound').length,1,'retired bind and offer cannot revive the cancelled request');
  f.bind('deliver',{requestId:OTHER},'native');const done=f.receiver.waitForFirstHandoff();
  f.offer('second-synthetic-invite',{requestId:OTHER},'native');await flush();
  assert.equal(await done,true);assert.deepEqual(f.replies('received').map(x=>x.value.requestId),[OTHER]);
  assert.deepEqual(cleanup.map(x=>x.requestId),[REQUEST]);
});

for(const peer of ['native','web'])for(const phase of ['deliver','resolve'])test('customer: '+peer+' assignment permits next '+phase+' request',async()=>{
  let calls=0;const cleanup=[];const f=fixture('customer',{hooks:{queueInvite:async()=>{calls++;return {queued:true};},cancelInvite:request=>cleanup.push(request),resolveDestinations:async()=>({version:1,accountMatch:true,workspace:{state:'assigned',destination:'/'},pulse:{state:'assigned',destination:'/pulse-app/'}})}});
  f.bind('resolve',{expectedAccountId:ACCOUNT},peer);await flush();assert.equal(f.replies('assignment').length,1);
  f.bind(phase,{requestId:OTHER,expectedAccountId:phase==='resolve'?ACCOUNT:null},peer);
  if(phase==='deliver')f.offer('second-synthetic-invite',{requestId:OTHER},peer);await flush();
  assert.equal(f.replies('error').length,0);assert.equal(f.replies('bound').length,2);
  assert.equal(f.replies(phase==='deliver'?'received':'assignment').at(-1).value.requestId,OTHER);
  assert.equal(calls,phase==='deliver'?1:0);assert.equal(cleanup.length,0);
});

test('after cancellation, old completion and packets cannot settle or cancel the new request',async()=>{
  const first=deferred(),second=deferred(),args=[],cleanup=[];
  const f=fixture('customer',{hooks:{queueInvite:request=>{args.push(request);return args.length===1?first.promise:second.promise;},cancelInvite:request=>cleanup.push(request)}});
  f.bind();f.offer();f.dispatch(f.packet('cancel'));const oldDone=f.receiver.waitForFirstHandoff();assert.equal(await oldDone,false);
  f.advance(120000);f.bind('deliver',{requestId:OTHER});const done=f.receiver.waitForFirstHandoff();let settled=false;done.then(()=>settled=true);f.offer('second-synthetic-invite',{requestId:OTHER});
  f.bind();f.offer();f.dispatch(f.packet('cancel'));first.resolve({queued:true});await flush();
  assert.equal(settled,false);assert.equal(args[0].signal.aborted,true);assert.equal(args[1].isCurrent(),true);assert.equal(f.replies('received').length,0);
  f.advance(14999);assert.equal(args[1].isCurrent(),true);second.resolve({queued:true});await flush();
  assert.equal(await done,true);assert.deepEqual(f.replies('received').map(x=>x.value.requestId),[OTHER]);assert.deepEqual(cleanup.map(x=>x.requestId),[REQUEST]);
});

test('a fresh request after timeout gets new stage and total deadlines',async()=>{
  const queue=deferred();const f=fixture('employee',{hooks:{queueInvite:()=>queue.promise}});
  f.bind();f.advance(15000);assert.equal(await f.receiver.waitForFirstHandoff(),false);f.advance(120000);
  f.bind('deliver',{requestId:OTHER});const done=f.receiver.waitForFirstHandoff();f.advance(14999);f.offer('second-synthetic-invite',{requestId:OTHER});f.advance(14999);
  assert.equal(f.replies('error').length,1);f.advance(1);queue.resolve({queued:true});await flush();
  assert.equal(await done,false);assert.equal(f.replies('received').length,0);assert.equal(f.replies('error').at(-1).value.requestId,OTHER);
});

for(const role of ['receiver','employee','customer'])test(role+': explicit dispose stays final and ignores a fresh bind',async()=>{
  const f=fixture(role);f.receiver.dispose();f.bind(undefined,{requestId:OTHER});f.offer(SECRET,{requestId:OTHER});await flush();
  assert.equal(f.attrs.size,0);assert.equal(f.listeners.get('message').size,0);assert.equal(f.replies('bound').length,0);assert.equal(await f.receiver.waitForFirstHandoff(),false);
});

test('temporary receiver cancellation remains final',async()=>{
  const f=fixture('receiver');f.bind();f.dispatch(f.packet('cancel'));f.bind('classify',{requestId:OTHER});f.offer(SECRET,{requestId:OTHER});await flush();
  assert.equal(f.listeners.get('message').size,0);assert.equal(f.attrs.size,0);assert.equal(f.replies('bound').length,1);assert.equal(f.replies('classified').length,0);
});

test('synchronous cleanup cannot bind a new request or undo explicit disposal',async()=>{
  let f;f=fixture('customer',{hooks:{cancelInvite:()=>f.bind('deliver',{requestId:OTHER})}});f.bind();f.dispatch(f.packet('cancel'));
  assert.equal(f.replies('bound').length,1);f.bind('deliver',{requestId:OTHER});assert.equal(f.replies('bound').length,2);
  let g;g=fixture('customer',{hooks:{cancelInvite:()=>g.receiver.dispose()}});g.bind();g.dispatch(g.packet('cancel'));g.bind('deliver',{requestId:OTHER});assert.equal(g.replies('bound').length,1);assert.equal(g.listeners.get('message').size,0);
});
