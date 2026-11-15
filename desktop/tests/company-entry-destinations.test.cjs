'use strict';
// 회사 공통 진입 · 로그인한 회원 본인의 회사 배정 조회(desktop/src/company-entry-destinations.cjs) 시험.
// 가짜 계정 결속, 가짜 access token, 가짜 fetch와 가짜 시계로 돌린다. 실제 회사 서버, 계정, 토큰은 쓰지 않는다.
// 실행: node --test desktop/tests/company-entry-destinations.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createCompanyEntryDestinations,DESTINATIONS_URL,TIMEOUT_MS,MAX_BYTES}=require('../src/company-entry-destinations.cjs');

const ACCOUNT=crypto.randomUUID(),OTHER_ACCOUNT=crypto.randomUUID();
const TOKEN='synthetic-native-access-token-0123456789';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(rounds=20){for(let index=0;index<rounds;index+=1)await tick();}
function deferred(){let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};}
function fakeTimers(){
  let now=0,sequence=0;
  const pending=new Map();
  return {
    setTimeout(fn,ms){sequence+=1;pending.set(sequence,{at:now+ms,fn});return sequence;},
    clearTimeout(id){pending.delete(id);},
    advance(ms){
      now+=ms;
      for(;;){
        let next=null;
        for(const entry of pending)if(entry[1].at<=now&&(!next||entry[1].at<next[1].at))next=entry;
        if(!next)break;
        pending.delete(next[0]);
        next[1].fn();
      }
    },
    get size(){return pending.size;},
  };
}
const assigned=(workspace,pulse)=>({version:1,accountMatch:true,workspace:{state:workspace,destination:'/'},pulse:{state:pulse,destination:'/pulse-app/'}});
// Node fetch처럼 본문을 조각으로 읽는 응답.
function response(status,data,{raw=null,chunks=null}={}){
  const text=raw!==null?raw:data===undefined?'':JSON.stringify(data);
  const parts=chunks||[text];
  return {status,body:{async *[Symbol.asyncIterator](){for(const part of parts)yield Buffer.from(part);}}};
}
function harness({binding}={}){
  let current=binding||{accountGeneration:crypto.randomUUID(),expectedAccountId:ACCOUNT,epoch:3,status:'signed-in'};
  let tokenSource=()=>Promise.resolve(TOKEN),reply=()=>Promise.resolve(response(200,assigned('assigned','assigned')));
  const timers=fakeTimers(),fetched=[],tokenCalls=[],opened=[];
  // 고정 목적지 열기의 대역. main은 '/'에 Workspace 앱 실행, '/pulse-app/'에 PULSE 창 열기를 넘긴다. 인자는 받지 않는다.
  const openAnswers={'/':()=>Promise.resolve({ok:true}),'/pulse-app/':()=>Promise.resolve({ok:true,id:'pulse',independentWindow:true})};
  // 이 모듈이 받는 것은 결속, 토큰, fetch와 두 열기 기능뿐이다. 로그아웃 같은 다른 auth 기능을 읽으면 바로 실패한다.
  const deps={getBinding:()=>(current?{...current}:current),getAccessToken:()=>{tokenCalls.push(1);return tokenSource();},
    fetcher:(url,options)=>{fetched.push({url,options});return reply(url,options);},setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout,
    openWorkspace:(...args)=>{opened.push(['/',...args]);return openAnswers['/']();},openPulse:(...args)=>{opened.push(['/pulse-app/',...args]);return openAnswers['/pulse-app/']();}};
  for(const name of ['signOut','discard','accountRequest','status'])Object.defineProperty(deps,name,{get(){throw new Error('배정 조회는 '+name+'을 쓰지 않는다');}});
  const lookups=createCompanyEntryDestinations(deps);
  return {lookups,timers,fetched,tokenCalls,
    // 열린 목적지 목록. 열기 기능은 어떤 인자도 받지 않았어야 한다.
    get opened(){for(const call of opened)assert.equal(call.length,1,'열기 기능에 인자가 넘어갔다');return opened.map(([destination])=>destination);},
    get binding(){return current;},setBinding(value){current=value;},setToken(fn){tokenSource=fn;},setReply(fn){reply=fn;},setOpen(destination,fn){openAnswers[destination]=fn;},
    ids(){return {requestId:crypto.randomUUID(),accountGeneration:current.accountGeneration};}};
}
const opening=(destination,ids)=>({destination,...ids});
function quietConsole(t){
  const names=['log','info','warn','error','debug','trace'],saved=names.map(name=>console[name]),calls=[];
  for(const name of names)console[name]=(...args)=>{calls.push({name,args});};
  t.after(()=>{names.forEach((name,index)=>{console[name]=saved[index];});});
  return calls;
}

test('main만 고정 주소에 정확한 본문으로 묻는다: Bearer 토큰, 쿠키 없음, 이동 없음, 계정은 main 값',async()=>{
  const h=harness(),ids=h.ids();
  const answer=await h.lookups.resolve(ids);
  assert.deepEqual(answer,{ok:true,...ids,result:{status:'resolved',destinations:['/','/pulse-app/'],unavailable:[]}});
  assert.equal(DESTINATIONS_URL,'https://workspace.synk.im/api/native/entry/destinations');
  assert.equal(h.fetched.length,1);
  const [{url,options}]=h.fetched;
  assert.equal(url,DESTINATIONS_URL);
  assert.deepEqual(Object.keys(options).sort(),['body','cache','credentials','headers','method','redirect','signal']);
  assert.equal(options.method,'POST');
  assert.equal(options.credentials,'omit');
  assert.equal(options.redirect,'error');
  assert.equal(options.cache,'no-store');
  assert.deepEqual(options.headers,{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'});
  assert.equal(options.body,JSON.stringify({expectedAccountId:ACCOUNT}));
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(h.tokenCalls.length,1);
  assert.equal(h.timers.size,0);
  assert.equal(JSON.stringify(answer).includes(TOKEN),false);
});

test('화면은 정확한 {requestId,accountGeneration}만 보내고 주소, 계정 ID, partition을 고르지 못한다',async()=>{
  const h=harness(),requestId=crypto.randomUUID(),accountGeneration=h.binding.accountGeneration;
  const inputs=[
    {requestId,accountGeneration,url:'https://evil.invalid/'},{requestId,accountGeneration,expectedAccountId:OTHER_ACCOUNT},{requestId,accountGeneration,partition:'persist:x'},
    {requestId,accountGeneration,headers:{Cookie:'x'}},{requestId},{requestId,accountGeneration:3},{requestId:requestId.toUpperCase(),accountGeneration},
    {requestId:'00000000-0000-0000-0000-000000000000',accountGeneration},Object.defineProperty({requestId},'accountGeneration',{get:()=>accountGeneration,enumerable:true}),
    [requestId,accountGeneration],null,undefined,'x',
  ];
  for(const [index,input] of inputs.entries()){
    const answer=await h.lookups.resolve(input);
    assert.equal(answer.ok,false,'입력 '+index);
    assert.equal(answer.code,'INVALID_INPUT','입력 '+index);
    assert.equal(answer.retryable,false,'입력 '+index);
  }
  assert.equal(h.fetched.length,0);
  assert.equal(h.tokenCalls.length,0);
});

test('다른 세대, guest, 확인 중인 계정, 읽지 못한 결속은 토큰을 읽기 전에 끝난다',async()=>{
  const h=harness();
  const stale={requestId:crypto.randomUUID(),accountGeneration:crypto.randomUUID()};
  assert.deepEqual(await h.lookups.resolve(stale),{ok:false,...stale,code:'AUTH_CHANGED',retryable:false});
  const states=[
    [{status:'signed-out',expectedAccountId:null},'LOGIN_REQUIRED',false],
    [{status:'restoring',expectedAccountId:null},'TEMPORARY_UNAVAILABLE',true],
    [{status:'error',expectedAccountId:null},'TEMPORARY_UNAVAILABLE',true],
  ];
  const base=h.binding;
  for(const [state,code,retryable] of states){
    h.setBinding({...base,...state});
    const ids=h.ids();
    assert.deepEqual(await h.lookups.resolve(ids),{ok:false,...ids,code,retryable},state.status);
  }
  const ids={requestId:crypto.randomUUID(),accountGeneration:base.accountGeneration};
  for(const value of [null,{...base,epoch:-1},{...base,expectedAccountId:'synthetic-owner-a'},{...base,extra:1}]){
    h.setBinding(value);
    const answer=await h.lookups.resolve({...ids,requestId:crypto.randomUUID()});
    assert.equal(answer.code,'TEMPORARY_UNAVAILABLE',JSON.stringify(value));
    assert.equal(answer.retryable,true);
  }
  assert.equal(h.fetched.length,0);
  assert.equal(h.tokenCalls.length,0);
});

test('배정 0개, 1개, 2개는 resolved이고 PULSE를 확인하지 못하면 partial이다',async()=>{
  const cases=[
    [['assigned','assigned'],{status:'resolved',destinations:['/','/pulse-app/'],unavailable:[]}],
    [['assigned','unassigned'],{status:'resolved',destinations:['/'],unavailable:[]}],
    [['unassigned','assigned'],{status:'resolved',destinations:['/pulse-app/'],unavailable:[]}],
    [['unassigned','unassigned'],{status:'resolved',destinations:[],unavailable:[]}],
    [['assigned','unavailable'],{status:'partial',destinations:['/'],unavailable:['pulse']}],
    [['unassigned','unavailable'],{status:'partial',destinations:[],unavailable:['pulse']}],
  ];
  for(const [[workspace,pulse],result] of cases){
    const h=harness();
    h.setReply(()=>Promise.resolve(response(200,assigned(workspace,pulse))));
    const ids=h.ids();
    assert.deepEqual(await h.lookups.resolve(ids),{ok:true,...ids,result},workspace+' '+pulse);
  }
});

test('다른 모양의 성공 본문은 배정이 아니며, 실패를 빈 배정으로 바꾸지 않는다',async()=>{
  const good=assigned('assigned','assigned');
  const bad=[
    {...good,names:['합성 회사']},{...good,extra:1},{...good,version:2},{...good,accountMatch:false},{...good,accountMatch:'true'},
    {...good,workspace:{...good.workspace,destination:'/admin/'}},{...good,workspace:{...good.workspace,destination:'https://evil.invalid/'}},
    {...good,pulse:{...good.pulse,destination:'/pulse/'}},{...good,workspace:{...good.workspace,state:'unavailable'}},{...good,pulse:{...good.pulse,state:'pending'}},
    {...good,workspace:{...good.workspace,name:'합성 회사'}},{...good,pulse:{...good.pulse,projectId:crypto.randomUUID()}},
    {version:1,accountMatch:true,workspace:good.workspace},{version:1,accountMatch:true,workspace:good.workspace,pulse:null},[good],null,'assigned',{},
    {ok:true,destinations:['/']},
  ];
  for(const [index,data] of bad.entries()){
    const h=harness();
    h.setReply(()=>Promise.resolve(response(200,data)));
    const ids=h.ids();
    assert.deepEqual(await h.lookups.resolve(ids),{ok:false,...ids,code:'TEMPORARY_UNAVAILABLE',retryable:true},'본문 '+index);
  }
  const raws=['','not json','{"version":1',
    '{"version":1,"accountMatch":true,"workspace":{"state":"assigned","destination":"/"},"pulse":{"state":"assigned","destination":"/pulse-app/"},"__proto__":{"x":1}}'];
  for(const raw of raws){
    const h=harness();
    h.setReply(()=>Promise.resolve(response(200,undefined,{raw})));
    const ids=h.ids();
    assert.deepEqual(await h.lookups.resolve(ids),{ok:false,...ids,code:'TEMPORARY_UNAVAILABLE',retryable:true},raw);
  }
  // 조각으로 나뉘어 와도 같은 본문이면 같은 결과다.
  const text=JSON.stringify(assigned('unassigned','assigned'));
  const h=harness();
  h.setReply(()=>Promise.resolve(response(200,undefined,{raw:text,chunks:[text.slice(0,10),text.slice(10,40),text.slice(40)]})));
  const ids=h.ids();
  assert.deepEqual(await h.lookups.resolve(ids),{ok:true,...ids,result:{status:'resolved',destinations:['/pulse-app/'],unavailable:[]}});
});

test('서버 오류는 상태와 정확한 오류 본문이 계약과 맞을 때만 그 공개 code가 된다',async()=>{
  const body=(code,retryable)=>({error:{code,retryable}});
  const cases=[
    [401,body('AUTH_REQUIRED',false),'LOGIN_REQUIRED',false],
    [403,body('CLIENT_FORBIDDEN',false),'CLIENT_FORBIDDEN',false],
    [403,body('ACCOUNT_UNAVAILABLE',false),'LOGIN_REQUIRED',false],
    [409,body('ACCOUNT_MISMATCH',false),'ACCOUNT_MISMATCH',false],
    [429,body('RATE_LIMITED',true),'TEMPORARY_UNAVAILABLE',true],
    [503,body('TEMPORARY_UNAVAILABLE',true),'TEMPORARY_UNAVAILABLE',true],
    [400,body('INVALID_INPUT',false),'TEMPORARY_UNAVAILABLE',false],
    // 표에 없는 조합, 정확하지 않은 오류 본문, 본문 없는 응답은 그 code로 믿지 않는다.
    [401,undefined,'TEMPORARY_UNAVAILABLE',false],
    [401,{error:{code:'AUTH_REQUIRED',retryable:false,detail:'중앙 응답 원문'}},'TEMPORARY_UNAVAILABLE',false],
    [401,{error:'AUTH_REQUIRED'},'TEMPORARY_UNAVAILABLE',false],
    [403,body('ACCOUNT_MISMATCH',false),'TEMPORARY_UNAVAILABLE',false],
    [409,{error:{code:'ACCOUNT_MISMATCH',retryable:'no'}},'TEMPORARY_UNAVAILABLE',false],
    [404,undefined,'TEMPORARY_UNAVAILABLE',false],
    [405,body('INVALID_INPUT',false),'TEMPORARY_UNAVAILABLE',false],
    [500,undefined,'TEMPORARY_UNAVAILABLE',true],
    [502,body('TEMPORARY_UNAVAILABLE',true),'TEMPORARY_UNAVAILABLE',true],
    [429,undefined,'TEMPORARY_UNAVAILABLE',true],
    [204,undefined,'TEMPORARY_UNAVAILABLE',false],
    [201,assigned('assigned','assigned'),'TEMPORARY_UNAVAILABLE',false],
  ];
  for(const [status,data,code,retryable] of cases){
    const h=harness();
    h.setReply(()=>Promise.resolve(response(status,data)));
    const ids=h.ids();
    assert.deepEqual(await h.lookups.resolve(ids),{ok:false,...ids,code,retryable},status+' '+JSON.stringify(data));
  }
});

test('토큰, 응답 머리, 본문을 기다리는 사이 계정이 바뀌면 응답이 무엇이든 AUTH_CHANGED이고 로그아웃하지 않는다',async()=>{
  // 토큰을 기다리는 사이 다른 계정으로 바뀌었다. 묻지도 않는다.
  {
    const h=harness(),ids=h.ids(),token=deferred();
    h.setToken(()=>token.promise);
    const pending=h.lookups.resolve(ids);
    await settle(3);
    h.setBinding({accountGeneration:crypto.randomUUID(),expectedAccountId:OTHER_ACCOUNT,epoch:4,status:'signed-in'});
    token.resolve(TOKEN);
    assert.deepEqual(await pending,{ok:false,...ids,code:'AUTH_CHANGED',retryable:false});
    assert.equal(h.fetched.length,0);
  }
  // 응답을 기다리는 사이 로그아웃했다. main의 알림(syncAccount)이 바로 끝내고 요청을 끊으며, 늦은 401은 아무것도 바꾸지 않는다.
  {
    const reply=deferred(),h=harness();
    h.setReply(()=>reply.promise);
    const ids=h.ids(),pending=h.lookups.resolve(ids);
    await settle(3);
    assert.equal(h.fetched.length,1);
    h.setBinding({accountGeneration:crypto.randomUUID(),expectedAccountId:null,epoch:4,status:'signed-out'});
    h.lookups.syncAccount();
    assert.deepEqual(await pending,{ok:false,...ids,code:'AUTH_CHANGED',retryable:false});
    assert.equal(h.fetched[0].options.signal.aborted,true);
    reply.resolve(response(401,{error:{code:'AUTH_REQUIRED',retryable:false}}));
    await settle();
    assert.equal(h.timers.size,0);
  }
  // 응답 머리를 받은 뒤 확인: epoch만 바뀌어도(옛 epoch의 답) 401을 그대로 믿지 않는다.
  {
    const h=harness(),ids=h.ids();
    h.setReply(()=>{h.setBinding({...h.binding,epoch:h.binding.epoch+1});return Promise.resolve(response(401,{error:{code:'AUTH_REQUIRED',retryable:false}}));});
    assert.deepEqual(await h.lookups.resolve(ids),{ok:false,...ids,code:'AUTH_CHANGED',retryable:false});
  }
  // 본문을 다 읽은 뒤 확인: 읽는 사이 세대가 바뀌었으면 배정 결과를 쓰지 않는다.
  {
    const h=harness(),ids=h.ids(),text=JSON.stringify(assigned('assigned','assigned'));
    h.setReply(()=>Promise.resolve({status:200,body:{async *[Symbol.asyncIterator](){yield Buffer.from(text.slice(0,20));h.setBinding({...h.binding,accountGeneration:crypto.randomUUID()});yield Buffer.from(text.slice(20));}}}));
    assert.deepEqual(await h.lookups.resolve(ids),{ok:false,...ids,code:'AUTH_CHANGED',retryable:false});
  }
  // 같은 세대에서 다른 계정이 보이면(있을 수 없는 상태) 그것도 바뀐 것이다.
  {
    const h=harness(),ids=h.ids();
    h.setReply(()=>{h.setBinding({...h.binding,expectedAccountId:OTHER_ACCOUNT});return Promise.resolve(response(200,assigned('assigned','assigned')));});
    assert.deepEqual(await h.lookups.resolve(ids),{ok:false,...ids,code:'AUTH_CHANGED',retryable:false});
  }
});

test('같은 계정의 토큰 갱신은 조회를 끊지 않고, 답을 읽을 때 아직 갱신 중이면 다시 시도할 수 있다',async()=>{
  {
    const reply=deferred(),h=harness();
    h.setReply(()=>reply.promise);
    const ids=h.ids(),pending=h.lookups.resolve(ids),verified=h.binding;
    await settle(3);
    h.setBinding({...verified,status:'restoring',expectedAccountId:null});
    h.lookups.syncAccount();
    assert.equal(h.fetched[0].options.signal.aborted,false);
    h.setBinding(verified);
    h.lookups.syncAccount();
    reply.resolve(response(200,assigned('assigned','unassigned')));
    assert.deepEqual(await pending,{ok:true,...ids,result:{status:'resolved',destinations:['/'],unavailable:[]}});
  }
  {
    const h=harness(),ids=h.ids();
    h.setReply(()=>{h.setBinding({...h.binding,status:'restoring',expectedAccountId:null});return Promise.resolve(response(200,assigned('assigned','assigned')));});
    assert.deepEqual(await h.lookups.resolve(ids),{ok:false,...ids,code:'TEMPORARY_UNAVAILABLE',retryable:true});
  }
});

test('물어본 창이나 프레임이 바뀌면 답을 읽지 않는다',async()=>{
  const h=harness(),ids=h.ids();
  let asking=true;
  h.setReply(()=>{asking=false;return Promise.resolve(response(200,assigned('assigned','assigned')));});
  assert.deepEqual(await h.lookups.resolve(ids,{isCurrentSender:()=>asking}),{ok:false,...ids,code:'TEMPORARY_UNAVAILABLE',retryable:false});
  const g=harness(),gone=g.ids();
  assert.deepEqual(await g.lookups.resolve(gone,{isCurrentSender:()=>false}),{ok:false,...gone,code:'TEMPORARY_UNAVAILABLE',retryable:false});
  assert.equal(g.fetched.length,0);
  const throwing=harness(),other=throwing.ids();
  assert.deepEqual(await throwing.lookups.resolve(other,{isCurrentSender:()=>{throw new Error('합성 오류');}}),{ok:false,...other,code:'TEMPORARY_UNAVAILABLE',retryable:false});
});

test('조회는 12초와 64KB로 묶이고, 이동이나 연결 실패는 일시적 실패다',async()=>{
  assert.equal(TIMEOUT_MS,12000);
  assert.equal(MAX_BYTES,65536);
  {
    const h=harness();
    h.setReply((_url,options)=>new Promise((_resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted '+TOKEN),{name:'AbortError'})));}));
    const ids=h.ids(),pending=h.lookups.resolve(ids);
    let done=false;
    pending.then(()=>{done=true;});
    await settle(3);
    h.timers.advance(TIMEOUT_MS-1);
    await settle(3);
    assert.equal(done,false);
    h.timers.advance(1);
    assert.deepEqual(await pending,{ok:false,...ids,code:'TIMEOUT',retryable:true});
  }
  // fetch가 끊김을 알리지 않아도 12초에 답한다.
  {
    const h=harness();
    h.setReply(()=>new Promise(()=>{}));
    const ids=h.ids(),pending=h.lookups.resolve(ids);
    await settle(3);
    h.timers.advance(TIMEOUT_MS);
    assert.deepEqual(await pending,{ok:false,...ids,code:'TIMEOUT',retryable:true});
    assert.equal(h.fetched[0].options.signal.aborted,true);
    assert.equal(h.timers.size,0);
  }
  {
    const h=harness(),text=JSON.stringify(assigned('assigned','assigned'));
    h.setReply((_url,options)=>Promise.resolve({status:200,body:{async *[Symbol.asyncIterator](){yield Buffer.from(text.slice(0,10));await new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))));}}}));
    const ids=h.ids(),pending=h.lookups.resolve(ids);
    await settle(5);
    h.timers.advance(TIMEOUT_MS);
    assert.deepEqual(await pending,{ok:false,...ids,code:'TIMEOUT',retryable:true});
  }
  {
    const big='x'.repeat(MAX_BYTES+1),h=harness();
    h.setReply(()=>Promise.resolve(response(200,undefined,{raw:big,chunks:[big.slice(0,40000),big.slice(40000)]})));
    const ids=h.ids();
    assert.deepEqual(await h.lookups.resolve(ids),{ok:false,...ids,code:'TEMPORARY_UNAVAILABLE',retryable:true});
    assert.equal(h.fetched[0].options.signal.aborted,true);
  }
  for(const failure of [new TypeError('fetch failed: redirect '+TOKEN),Object.assign(new Error('ECONNRESET '+TOKEN),{code:'ECONNRESET'})]){
    const h=harness();
    h.setReply(()=>Promise.reject(failure));
    const ids=h.ids();
    assert.deepEqual(await h.lookups.resolve(ids),{ok:false,...ids,code:'TEMPORARY_UNAVAILABLE',retryable:true});
  }
});

test('토큰을 얻지 못한 이유는 고정 code로만 나뉘고 묻지 않는다',async()=>{
  const failures=[
    [Object.assign(new Error('x'),{code:'AUTH_REQUIRED'}),'LOGIN_REQUIRED',false],
    [Object.assign(new Error('x'),{code:'AUTH_CHANGED'}),'AUTH_CHANGED',false],
    [Object.assign(new Error('x'),{code:'NETWORK',retryable:true}),'TEMPORARY_UNAVAILABLE',true],
    [Object.assign(new Error('x'),{code:'AUTH_SERVER_UNAVAILABLE',retryable:true}),'TEMPORARY_UNAVAILABLE',true],
    [Object.assign(new Error('x'),{code:'SECURE_STORAGE_UNAVAILABLE'}),'TEMPORARY_UNAVAILABLE',false],
    [new Error('원문 '+TOKEN),'TEMPORARY_UNAVAILABLE',false],
  ];
  for(const [index,[error,code,retryable]] of failures.entries()){
    const h=harness(),ids=h.ids();
    h.setToken(()=>Promise.reject(error));
    const answer=await h.lookups.resolve(ids);
    assert.deepEqual(answer,{ok:false,...ids,code,retryable},'실패 '+index);
    assert.equal(JSON.stringify(answer).includes(TOKEN),false);
    assert.equal(h.fetched.length,0);
  }
  for(const value of [null,'',42,'x'.repeat(16385)]){
    const h=harness(),ids=h.ids();
    h.setToken(()=>Promise.resolve(value));
    assert.deepEqual(await h.lookups.resolve(ids),{ok:false,...ids,code:'TEMPORARY_UNAVAILABLE',retryable:true});
    assert.equal(h.fetched.length,0);
  }
});

test('같은 requestId는 한 번만 쓰고, 끝낼 때는 진행 중인 조회를 끊는다',async()=>{
  const h=harness(),ids=h.ids();
  assert.equal((await h.lookups.resolve(ids)).ok,true);
  assert.deepEqual(await h.lookups.resolve(ids),{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
  assert.equal(h.fetched.length,1);
  const reply=deferred();
  h.setReply(()=>reply.promise);
  const next=h.ids(),pending=h.lookups.resolve(next);
  await settle(3);
  h.lookups.dispose();
  assert.deepEqual(await pending,{ok:false,...next,code:'TEMPORARY_UNAVAILABLE',retryable:false});
  assert.equal(h.fetched[1].options.signal.aborted,true);
  const after=h.ids();
  assert.deepEqual(await h.lookups.resolve(after),{ok:false,...after,code:'TEMPORARY_UNAVAILABLE',retryable:false});
  assert.deepEqual(await createCompanyEntryDestinations({}).resolve(after),{ok:false,...after,code:'TEMPORARY_UNAVAILABLE',retryable:false});
  assert.deepEqual(await createCompanyEntryDestinations().resolve(after),{ok:false,...after,code:'TEMPORARY_UNAVAILABLE',retryable:false});
  reply.resolve(response(200,assigned('assigned','assigned')));
  await settle();
});

test('토큰, 쿠키, 원본 오류는 기록하지도 돌려주지도 않는다',async t=>{
  const logs=quietConsole(t),answers=[];
  const scenarios=[
    h=>h.setReply(()=>Promise.resolve(response(200,assigned('assigned','unavailable')))),
    h=>h.setReply(()=>Promise.resolve(response(401,{error:{code:'AUTH_REQUIRED',retryable:false}}))),
    h=>h.setReply(()=>Promise.reject(new Error('원문 '+TOKEN))),
    h=>h.setReply(()=>Promise.resolve(response(500,undefined,{raw:'서버 원문 '+TOKEN}))),
    h=>h.setToken(()=>Promise.reject(new Error('원문 '+TOKEN))),
  ];
  for(const setup of scenarios){
    const h=harness();
    setup(h);
    answers.push(await h.lookups.resolve(h.ids()));
  }
  assert.equal(JSON.stringify(answers).includes(TOKEN),false);
  assert.equal(JSON.stringify(answers).includes('원문'),false);
  assert.deepEqual(logs,[]);
});

// ── 조회가 확인한 고정 목적지 열기 ──

test('조회가 확인한 고정 목적지만 기존 제품 기능으로 열고, 답은 같은 두 ID와 그 목적지다',async()=>{
  const h=harness(),ids=h.ids();
  assert.equal((await h.lookups.resolve(ids)).ok,true);
  assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:true,...ids,destination:'/'});
  assert.deepEqual(await h.lookups.open(opening('/pulse-app/',ids)),{ok:true,...ids,destination:'/pulse-app/'});
  // 같은 기록으로 다시 열 수 있다. 창을 앞으로 가져오는 일은 각 제품 기능이 한다.
  assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:true,...ids,destination:'/'});
  assert.deepEqual(h.opened,['/','/pulse-app/','/']);
  // 열기는 토큰을 읽지도 서버에 묻지도 않는다.
  assert.equal(h.tokenCalls.length,1);
  assert.equal(h.fetched.length,1);
});

test('partial은 확인된 목적지만 열고, 미배정이거나 확인되지 않은 목적지, 빈 배정, 실패한 조회로는 열지 않는다',async()=>{
  const invalid=ids=>({ok:false,...ids,code:'INVALID_INPUT',retryable:false});
  const h=harness();
  h.setReply(()=>Promise.resolve(response(200,assigned('assigned','unavailable'))));
  const ids=h.ids();
  assert.deepEqual((await h.lookups.resolve(ids)).result,{status:'partial',destinations:['/'],unavailable:['pulse']});
  assert.deepEqual(await h.lookups.open(opening('/pulse-app/',ids)),invalid(ids));
  assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:true,...ids,destination:'/'});
  assert.deepEqual(h.opened,['/']);
  const pulseOnly=harness();
  pulseOnly.setReply(()=>Promise.resolve(response(200,assigned('unassigned','assigned'))));
  const only=pulseOnly.ids();
  assert.equal((await pulseOnly.lookups.resolve(only)).ok,true);
  assert.deepEqual(await pulseOnly.lookups.open(opening('/',only)),invalid(only));
  const none=harness();
  none.setReply(()=>Promise.resolve(response(200,assigned('unassigned','unassigned'))));
  const empty=none.ids();
  assert.deepEqual((await none.lookups.resolve(empty)).result,{status:'resolved',destinations:[],unavailable:[]});
  for(const destination of ['/','/pulse-app/'])assert.deepEqual(await none.lookups.open(opening(destination,empty)),invalid(empty));
  const failed=harness();
  failed.setReply(()=>Promise.resolve(response(503,{error:{code:'TEMPORARY_UNAVAILABLE',retryable:true}})));
  const lost=failed.ids();
  assert.equal((await failed.lookups.resolve(lost)).ok,false);
  assert.deepEqual(await failed.lookups.open(opening('/',lost)),invalid(lost));
  assert.deepEqual([...pulseOnly.opened,...none.opened,...failed.opened],[]);
});

test('열기는 정확한 {destination,requestId,accountGeneration}만 받고 주소, partition, 계정 ID를 고르지 못한다',async()=>{
  const h=harness(),ids=h.ids();
  await h.lookups.resolve(ids);
  const inputs=[
    {...ids},{destination:'/',...ids,url:'https://evil.invalid/'},{destination:'/',...ids,partition:'persist:x'},{destination:'/',...ids,expectedAccountId:OTHER_ACCOUNT},
    {destination:'https://workspace.synk.im/',...ids},{destination:'/pulse/',...ids},{destination:'/pulse-app',...ids},{destination:'workspace',...ids},{destination:'pulse',...ids},
    {destination:'/',requestId:ids.requestId},{destination:'/',...ids,requestId:ids.requestId.toUpperCase()},{destination:'/',...ids,accountGeneration:3},
    Object.defineProperty({...ids},'destination',{get:()=>'/',enumerable:true}),[opening('/',ids)],null,undefined,'/',
  ];
  for(const [index,input] of inputs.entries()){
    const answer=await h.lookups.open(input);
    assert.equal(answer.ok,false,'입력 '+index);
    assert.equal(answer.code,'INVALID_INPUT','입력 '+index);
    assert.equal(answer.retryable,false,'입력 '+index);
  }
  assert.deepEqual(h.opened,[]);
  // 잘못된 입력은 기록을 지우지 않는다.
  assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:true,...ids,destination:'/'});
});

test('다른 요청 ID, 다른 세대, 새 조회, 그 요청의 취소, 문서 교체가 지난 기록으로는 열지 못한다',async()=>{
  const invalid=ids=>({ok:false,...ids,code:'INVALID_INPUT',retryable:false});
  {
    const h=harness(),ids=h.ids();
    await h.lookups.resolve(ids);
    const other={requestId:crypto.randomUUID(),accountGeneration:ids.accountGeneration};
    assert.deepEqual(await h.lookups.open(opening('/',other)),invalid(other));
    // 화면이 아는 세대가 지금과 다르면 계정이 바뀐 것이다.
    const stale={requestId:ids.requestId,accountGeneration:crypto.randomUUID()};
    assert.deepEqual(await h.lookups.open(opening('/',stale)),{ok:false,...stale,code:'ACCOUNT_CHANGED',retryable:false});
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:true,...ids,destination:'/'});
  }
  // 새 조회는 앞 기록을 지운다. 새 조회가 거절되더라도 그렇다.
  {
    const h=harness(),first=h.ids();
    await h.lookups.resolve(first);
    assert.equal((await h.lookups.resolve({requestId:'x'})).code,'INVALID_INPUT');
    assert.deepEqual(await h.lookups.open(opening('/',first)),invalid(first));
    const second=h.ids();
    assert.equal((await h.lookups.resolve(second)).ok,true);
    assert.deepEqual(await h.lookups.open(opening('/',first)),invalid(first));
    assert.deepEqual(await h.lookups.open(opening('/',second)),{ok:true,...second,destination:'/'});
  }
  // 늦게 끝난 앞 조회는 뒤 조회가 시작된 뒤에는 기록이 되지 못한다.
  {
    const h=harness(),slow=deferred();
    h.setReply(()=>slow.promise);
    const first=h.ids(),pending=h.lookups.resolve(first);
    await settle(3);
    h.setReply(()=>Promise.resolve(response(503,{error:{code:'TEMPORARY_UNAVAILABLE',retryable:true}})));
    const second=h.ids();
    assert.equal((await h.lookups.resolve(second)).ok,false);
    slow.resolve(response(200,assigned('assigned','assigned')));
    assert.equal((await pending).ok,true);
    assert.deepEqual(await h.lookups.open(opening('/',first)),invalid(first));
  }
  // 그 요청의 취소는 기록을 지운다. 다른 요청이나 다른 세대, 다른 모양의 취소는 아무것도 바꾸지 않는다.
  {
    const h=harness(),ids=h.ids();
    await h.lookups.resolve(ids);
    for(const value of [{requestId:ids.requestId,accountGeneration:crypto.randomUUID()},{requestId:crypto.randomUUID(),accountGeneration:ids.accountGeneration},{...ids,extra:1},{requestId:ids.requestId},[ids],null])
      assert.equal(h.lookups.cancel(value),null,JSON.stringify(value));
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:true,...ids,destination:'/'});
    assert.deepEqual(h.lookups.cancel({...ids}),{ok:false,...ids,code:'CANCELLED',retryable:true});
    assert.equal(h.lookups.cancel({...ids}),null);
    assert.deepEqual(await h.lookups.open(opening('/',ids)),invalid(ids));
    assert.deepEqual(h.opened,['/']);
  }
  // 플랫폼 창의 문서 교체(main의 did-navigate)는 기록을 지우고, 진행 중인 조회는 답을 읽지 않고 끝낸다.
  {
    const h=harness(),ids=h.ids();
    await h.lookups.resolve(ids);
    h.lookups.invalidate();
    assert.deepEqual(await h.lookups.open(opening('/',ids)),invalid(ids));
    const reply=deferred();
    h.setReply(()=>reply.promise);
    const next=h.ids(),pending=h.lookups.resolve(next);
    await settle(3);
    h.lookups.invalidate();
    assert.deepEqual(await pending,{ok:false,...next,code:'TEMPORARY_UNAVAILABLE',retryable:false});
    assert.equal(h.fetched.at(-1).options.signal.aborted,true);
    reply.resolve(response(200,assigned('assigned','assigned')));
    await settle();
    assert.deepEqual(await h.lookups.open(opening('/',next)),invalid(next));
    assert.deepEqual(h.opened,[]);
  }
});

test('계정이 바뀌면 기록을 지우고, 같은 계정의 토큰 갱신은 기록을 남긴 채 그동안만 열지 않는다',async()=>{
  {
    const h=harness(),ids=h.ids(),verified=h.binding;
    await h.lookups.resolve(ids);
    h.setBinding({...verified,status:'restoring',expectedAccountId:null});
    h.lookups.syncAccount();
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'TEMPORARY_UNAVAILABLE',retryable:true});
    h.setBinding(verified);
    h.lookups.syncAccount();
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:true,...ids,destination:'/'});
    // 같은 세대에서 숫자 epoch만 바뀌어도 그 기록은 쓰지 못하고 지워진다.
    h.setBinding({...verified,epoch:verified.epoch+1});
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'ACCOUNT_CHANGED',retryable:false});
    h.setBinding(verified);
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
    assert.deepEqual(h.opened,['/']);
  }
  // 로그아웃 알림은 기록을 지운다.
  {
    const h=harness(),ids=h.ids(),verified=h.binding;
    await h.lookups.resolve(ids);
    h.setBinding({accountGeneration:crypto.randomUUID(),expectedAccountId:null,epoch:4,status:'signed-out'});
    h.lookups.syncAccount();
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'ACCOUNT_CHANGED',retryable:false});
    h.setBinding(verified);
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
  }
  // 같은 세대에서 다른 SYNK ID가 보이거나(있을 수 없는 상태) 결속을 읽지 못하면 열지 않는다.
  {
    const h=harness(),ids=h.ids(),verified=h.binding;
    await h.lookups.resolve(ids);
    h.setBinding(null);
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'TEMPORARY_UNAVAILABLE',retryable:true});
    h.setBinding({...verified,expectedAccountId:OTHER_ACCOUNT});
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'ACCOUNT_CHANGED',retryable:false});
    assert.deepEqual(h.opened,[]);
  }
});

test('여는 사이 계정이나 청한 문서가 바뀌면 성공으로 알리지 않고, 기록을 만든 창·프레임이 아니면 열지 않는다',async()=>{
  {
    const h=harness(),ids=h.ids(),gate=deferred();
    await h.lookups.resolve(ids);
    h.setOpen('/',()=>gate.promise);
    const inFlight=h.lookups.open(opening('/',ids));
    // 열기 하나가 진행 중이면 다음 열기는 BUSY다.
    assert.deepEqual(await h.lookups.open(opening('/pulse-app/',ids)),{ok:false,...ids,code:'BUSY',retryable:true});
    h.setBinding({accountGeneration:crypto.randomUUID(),expectedAccountId:OTHER_ACCOUNT,epoch:4,status:'signed-in'});
    gate.resolve({ok:true});
    assert.deepEqual(await inFlight,{ok:false,...ids,code:'ACCOUNT_CHANGED',retryable:false});
    assert.deepEqual(h.opened,['/']);
  }
  {
    // 조회를 청한 창이나 프레임이 그대로가 아니면 그 기록으로 열지 않고 기록을 지운다.
    const h=harness(),ids=h.ids();
    let asking=true;
    await h.lookups.resolve(ids,{isCurrentSender:()=>asking});
    asking=false;
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
    asking=true;
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
    assert.deepEqual(h.opened,[]);
  }
  {
    // 열기를 청한 창이나 프레임이 여는 사이 바뀌면 성공으로 알리지 않는다.
    const h=harness(),ids=h.ids();
    await h.lookups.resolve(ids);
    let current=true;
    h.setOpen('/pulse-app/',()=>{current=false;return Promise.resolve({ok:true,id:'pulse',independentWindow:true});});
    assert.deepEqual(await h.lookups.open(opening('/pulse-app/',ids),{isCurrentSender:()=>current}),{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
    assert.deepEqual(h.opened,['/pulse-app/']);
  }
});

test('기존 제품 열기의 실패는 고정 공개 code로만 나뉘고 성공이나 빈 배정으로 바뀌지 않는다',async t=>{
  const logs=quietConsole(t);
  const cases=[
    ['/pulse-app/',{ok:false,code:'PULSE_APP_ACCOUNT_CHANGED'},'ACCOUNT_CHANGED',false],
    ['/pulse-app/',{ok:false,code:'PULSE_APP_ACCOUNT_PENDING'},'TEMPORARY_UNAVAILABLE',true],
    ['/pulse-app/',{ok:false,code:'PULSE_APP_STORAGE_UNAVAILABLE'},'TEMPORARY_UNAVAILABLE',true],
    ['/pulse-app/',{ok:false,code:'PULSE_APP_OPEN_FAILED'},'HANDOFF_UNAVAILABLE',true],
    ['/pulse-app/',{ok:false,code:'PULSE_APP_UNAVAILABLE'},'HANDOFF_UNAVAILABLE',false],
    ['/',{ok:false,code:'NOT_INSTALLED'},'HANDOFF_UNAVAILABLE',false],
    ['/',{ok:false,code:'INVALID_INSTALLATION'},'HANDOFF_UNAVAILABLE',false],
    ['/',{ok:false,code:'RELEASE_UNAVAILABLE'},'HANDOFF_UNAVAILABLE',false],
    ['/',{ok:false,code:'LAUNCH_FAILED'},'HANDOFF_UNAVAILABLE',true],
    ['/',{ok:false,code:'DISPOSED'},'HANDOFF_UNAVAILABLE',false],
    ['/',undefined,'HANDOFF_UNAVAILABLE',false],
    ['/',{ok:'true'},'HANDOFF_UNAVAILABLE',false],
  ];
  for(const [destination,answer,code,retryable] of cases){
    const h=harness(),ids=h.ids();
    await h.lookups.resolve(ids);
    h.setOpen(destination,()=>Promise.resolve(answer));
    assert.deepEqual(await h.lookups.open(opening(destination,ids)),{ok:false,...ids,code,retryable},destination+' '+JSON.stringify(answer));
  }
  // 열기 기능이 던지거나 거절해도 같은 실패이고 원본 오류는 돌려주지 않는다.
  for(const thrown of [()=>{throw new Error('합성 '+TOKEN);},()=>Promise.reject(new Error('합성 '+TOKEN))]){
    const h=harness(),ids=h.ids();
    await h.lookups.resolve(ids);
    h.setOpen('/',thrown);
    const answer=await h.lookups.open(opening('/',ids));
    assert.deepEqual(answer,{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false});
    assert.equal(JSON.stringify(answer).includes(TOKEN),false);
  }
  // PULSE가 계정이 바뀌었다고 답하면 기록도 지운다. 그 밖의 실패는 기록을 남겨 다시 열 수 있다.
  const h=harness(),ids=h.ids();
  await h.lookups.resolve(ids);
  h.setOpen('/',()=>Promise.resolve({ok:false,code:'LAUNCH_FAILED'}));
  assert.equal((await h.lookups.open(opening('/',ids))).code,'HANDOFF_UNAVAILABLE');
  h.setOpen('/',()=>Promise.resolve({ok:true}));
  assert.equal((await h.lookups.open(opening('/',ids))).ok,true);
  h.setOpen('/pulse-app/',()=>Promise.resolve({ok:false,code:'PULSE_APP_ACCOUNT_CHANGED'}));
  assert.equal((await h.lookups.open(opening('/pulse-app/',ids))).code,'ACCOUNT_CHANGED');
  h.setOpen('/pulse-app/',()=>Promise.resolve({ok:true}));
  assert.equal((await h.lookups.open(opening('/pulse-app/',ids))).code,'INVALID_INPUT');
  assert.deepEqual(logs,[]);
});

test('진행 중인 조회의 취소는 그 요청만 AbortController로 끊고 늦은 답을 읽지 않으며, 기록도 남기지 않는다',async()=>{
  const reply=deferred(),h=harness();
  h.setReply(()=>reply.promise);
  const ids=h.ids(),pending=h.lookups.resolve(ids);
  await settle(3);
  assert.equal(h.fetched.length,1);
  for(const value of [{requestId:ids.requestId,accountGeneration:crypto.randomUUID()},{requestId:crypto.randomUUID(),accountGeneration:ids.accountGeneration}])assert.equal(h.lookups.cancel(value),null);
  assert.equal(h.fetched[0].options.signal.aborted,false);
  assert.deepEqual(h.lookups.cancel({...ids}),{ok:false,...ids,code:'CANCELLED',retryable:true});
  assert.deepEqual(await pending,{ok:false,...ids,code:'CANCELLED',retryable:true});
  assert.equal(h.fetched[0].options.signal.aborted,true);
  assert.equal(h.timers.size,0);
  reply.resolve(response(200,assigned('assigned','assigned')));
  await settle();
  assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
  assert.equal(h.lookups.cancel({...ids}),null);
  // 토큰을 기다리는 사이의 취소면 서버에 묻지도 않는다.
  const token=deferred(),g=harness();
  g.setToken(()=>token.promise);
  const later=g.ids(),waiting=g.lookups.resolve(later);
  await settle(3);
  assert.deepEqual(g.lookups.cancel({...later}),{ok:false,...later,code:'CANCELLED',retryable:true});
  token.resolve(TOKEN);
  assert.deepEqual(await waiting,{ok:false,...later,code:'CANCELLED',retryable:true});
  await settle();
  assert.equal(g.fetched.length,0);
  // 같은 requestId는 취소한 뒤에도 다시 쓰지 못한다.
  assert.deepEqual(await g.lookups.resolve(later),{ok:false,...later,code:'INVALID_INPUT',retryable:false});
});

test('끝낸 뒤나 열기 기능을 받지 않았으면 열지 않는다',async()=>{
  const h=harness(),ids=h.ids();
  await h.lookups.resolve(ids);
  h.lookups.dispose();
  assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false});
  assert.equal(h.lookups.cancel({...ids}),null);
  assert.deepEqual(h.opened,[]);
  const generation=crypto.randomUUID(),timers=fakeTimers();
  const bare=createCompanyEntryDestinations({getBinding:()=>({accountGeneration:generation,expectedAccountId:ACCOUNT,epoch:3,status:'signed-in'}),getAccessToken:async()=>TOKEN,
    fetcher:async()=>response(200,assigned('assigned','assigned')),setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout});
  const bareIds={requestId:crypto.randomUUID(),accountGeneration:generation};
  assert.equal((await bare.resolve(bareIds)).ok,true);
  for(const destination of ['/','/pulse-app/'])assert.deepEqual(await bare.open(opening(destination,bareIds)),{ok:false,...bareIds,code:'HANDOFF_UNAVAILABLE',retryable:false});
  assert.deepEqual(await createCompanyEntryDestinations({}).open(opening('/',bareIds)),{ok:false,...bareIds,code:'HANDOFF_UNAVAILABLE',retryable:false});
  assert.deepEqual(await createCompanyEntryDestinations().open(opening('/',bareIds)),{ok:false,...bareIds,code:'HANDOFF_UNAVAILABLE',retryable:false});
});

// ── 열기 기능을 부른 뒤 그 기록이 끝날 때 ──
// 열기 기능을 부른 뒤에는 제품 창이 이미 열렸을 수 있다. 그 사이 기록이 끝나면 늦은 답은 성공이 되지 못한다. 취소했다고 단정하지도 않는다.

const unconfirmed=ids=>({ok:false,...ids,code:'HANDOFF_UNCONFIRMED',retryable:false});

test('열기 기능을 부른 뒤의 취소는 CANCELLED가 아니라 미확인이고, 그 열기의 늦은 성공이나 실패도 미확인으로 답한다',async()=>{
  // GA1 재현: 열기 기능이 답하기 전에 같은 요청을 취소했다.
  {
    const h=harness(),ids=h.ids(),gate=deferred();
    await h.lookups.resolve(ids);
    h.setOpen('/',()=>gate.promise);
    const pending=h.lookups.open(opening('/',ids));
    assert.deepEqual(h.opened,['/']);
    assert.deepEqual(h.lookups.cancel({...ids}),unconfirmed(ids));
    // 그 요청은 이미 끝났으므로 다시 취소할 것이 없다.
    assert.equal(h.lookups.cancel({...ids}),null);
    gate.resolve({ok:true});
    assert.deepEqual(await pending,unconfirmed(ids));
    // 기록이 끝났으므로 같은 두 ID로 다시 열지 않는다. 취소 때문에 제품 기능을 다시 부르지도 않는다.
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
    assert.deepEqual(h.opened,['/']);
  }
  // 열기 기능이 늦게 실패하거나 던져도 미확인이다. 다시 시도할 수 있다고 알리지 않고 원본 오류도 돌려주지 않는다.
  const lateEndings=[
    ['/pulse-app/',gate=>gate.resolve({ok:false,code:'PULSE_APP_OPEN_FAILED'})],
    ['/',gate=>gate.resolve({ok:false,code:'LAUNCH_FAILED'})],
    ['/',gate=>gate.reject(new Error('합성 '+TOKEN))],
  ];
  for(const [index,[destination,end]] of lateEndings.entries()){
    const h=harness(),ids=h.ids(),gate=deferred();
    await h.lookups.resolve(ids);
    h.setOpen(destination,()=>gate.promise);
    const pending=h.lookups.open(opening(destination,ids));
    assert.deepEqual(h.lookups.cancel({...ids}),unconfirmed(ids),'늦은 끝 '+index);
    end(gate);
    const answer=await pending;
    assert.deepEqual(answer,unconfirmed(ids),'늦은 끝 '+index);
    assert.equal(JSON.stringify(answer).includes(TOKEN),false);
  }
  // 취소는 진행 중인 열기를 놓아주지 않는다. 열기 기능이 답하기 전에는 새 조회의 기록으로도 겹쳐 열지 않는다.
  {
    const h=harness(),ids=h.ids(),gate=deferred();
    await h.lookups.resolve(ids);
    h.setOpen('/',()=>gate.promise);
    const pending=h.lookups.open(opening('/',ids));
    assert.deepEqual(h.lookups.cancel({...ids}),unconfirmed(ids));
    const next=h.ids();
    assert.equal((await h.lookups.resolve(next)).ok,true);
    assert.deepEqual(await h.lookups.open(opening('/pulse-app/',next)),{ok:false,...next,code:'BUSY',retryable:true});
    gate.resolve({ok:true});
    assert.deepEqual(await pending,unconfirmed(ids));
    assert.deepEqual(await h.lookups.open(opening('/pulse-app/',next)),{ok:true,...next,destination:'/pulse-app/'});
    assert.deepEqual(h.opened,['/','/pulse-app/']);
  }
  // 열기 기능을 부르기 전의 취소는 기록만 지우는 CANCELLED다. 그 뒤의 열기는 제품 기능을 부르지 않는다.
  {
    const h=harness(),ids=h.ids();
    await h.lookups.resolve(ids);
    assert.deepEqual(h.lookups.cancel({...ids}),{ok:false,...ids,code:'CANCELLED',retryable:true});
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
    assert.deepEqual(h.opened,[]);
  }
  // 열기가 성공으로 끝난 뒤의 취소는 진행 중인 열기가 없으므로 기록만 지우는 CANCELLED다. 앞서 알린 성공은 그대로다.
  {
    const h=harness(),ids=h.ids();
    await h.lookups.resolve(ids);
    assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:true,...ids,destination:'/'});
    assert.deepEqual(h.lookups.cancel({...ids}),{ok:false,...ids,code:'CANCELLED',retryable:true});
    assert.deepEqual(h.opened,['/']);
  }
});

test('여는 사이 새 조회, 문서 교체, 끝냄이 기록을 끝내면 늦은 성공을 미확인으로 답하고, 계정이 바뀌면 ACCOUNT_CHANGED로 답한다',async()=>{
  // 새 조회는 진행 중인 열기의 기록을 끝낸다. 새 조회가 거절되더라도 그렇다.
  {
    const h=harness(),ids=h.ids(),gate=deferred();
    await h.lookups.resolve(ids);
    h.setOpen('/',()=>gate.promise);
    const pending=h.lookups.open(opening('/',ids));
    assert.equal((await h.lookups.resolve({requestId:'x'})).code,'INVALID_INPUT');
    gate.resolve({ok:true});
    assert.deepEqual(await pending,unconfirmed(ids));
  }
  // 새 조회가 성공해 새 기록이 생겨도 앞 열기는 성공이 되지 못한다. 앞 요청의 취소는 이미 끝난 기록의 이름이라 아무것도 바꾸지
  // 않고 새 기록도 지우지 않는다. 앞 열기가 답하기 전에는 새 기록으로도 겹쳐 열지 않는다.
  {
    const h=harness(),first=h.ids(),gate=deferred();
    await h.lookups.resolve(first);
    h.setOpen('/',()=>gate.promise);
    const pending=h.lookups.open(opening('/',first));
    const second=h.ids();
    assert.equal((await h.lookups.resolve(second)).ok,true);
    assert.equal(h.lookups.cancel({...first}),null);
    assert.deepEqual(await h.lookups.open(opening('/pulse-app/',second)),{ok:false,...second,code:'BUSY',retryable:true});
    gate.resolve({ok:true});
    assert.deepEqual(await pending,unconfirmed(first));
    assert.deepEqual(await h.lookups.open(opening('/pulse-app/',second)),{ok:true,...second,destination:'/pulse-app/'});
    assert.deepEqual(h.opened,['/','/pulse-app/']);
  }
  // 문서 교체(main의 did-navigate)가 기록을 지웠다. 청한 창과 프레임이 그대로 보이면 미확인이고, 바뀌었으면 그 이유의 INVALID_INPUT이다.
  for(const stillAsking of [true,false]){
    const h=harness(),ids=h.ids(),gate=deferred();
    let asking=true;
    await h.lookups.resolve(ids);
    h.setOpen('/',()=>gate.promise);
    const pending=h.lookups.open(opening('/',ids),{isCurrentSender:()=>asking});
    h.lookups.invalidate();
    asking=stillAsking;
    gate.resolve({ok:true});
    assert.deepEqual(await pending,stillAsking?unconfirmed(ids):{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
    assert.equal(h.lookups.cancel({...ids}),null);
  }
  // 끝냄(dispose)도 그 열기를 성공으로 알리지 않는다. 열기 기능을 이미 불렀으므로 이 PC에서 열 수 없다고도 단정하지 않는다.
  {
    const h=harness(),ids=h.ids(),gate=deferred();
    await h.lookups.resolve(ids);
    h.setOpen('/pulse-app/',()=>gate.promise);
    const pending=h.lookups.open(opening('/pulse-app/',ids));
    h.lookups.dispose();
    assert.equal(h.lookups.cancel({...ids}),null);
    gate.resolve({ok:true,id:'pulse',independentWindow:true});
    assert.deepEqual(await pending,unconfirmed(ids));
    assert.deepEqual(h.opened,['/pulse-app/']);
  }
  // 다른 계정으로 바뀌고 main이 알렸다(syncAccount). 기록은 지워지고 그 열기는 계정이 바뀐 이유로 답한다.
  {
    const h=harness(),ids=h.ids(),gate=deferred();
    await h.lookups.resolve(ids);
    h.setOpen('/',()=>gate.promise);
    const pending=h.lookups.open(opening('/',ids));
    h.setBinding({accountGeneration:crypto.randomUUID(),expectedAccountId:OTHER_ACCOUNT,epoch:4,status:'signed-in'});
    h.lookups.syncAccount();
    assert.equal(h.lookups.cancel({...ids}),null);
    gate.resolve({ok:true});
    assert.deepEqual(await pending,{ok:false,...ids,code:'ACCOUNT_CHANGED',retryable:false});
  }
});

test('같은 계정의 토큰 갱신은 진행 중인 열기의 기록을 남기고, 그 사이 그 요청을 취소했으면 갱신 중이어도 미확인이다',async()=>{
  const h=harness(),ids=h.ids(),verified=h.binding,renewing={...verified,status:'restoring',expectedAccountId:null};
  await h.lookups.resolve(ids);
  // 갱신 중에 답한 열기는 기존대로 다시 시도할 수 있는 실패다. 기록은 남아 갱신이 끝나면 같은 두 ID로 다시 연다.
  let gate=deferred();
  h.setOpen('/',()=>gate.promise);
  let pending=h.lookups.open(opening('/',ids));
  h.setBinding(renewing);
  h.lookups.syncAccount();
  gate.resolve({ok:true});
  assert.deepEqual(await pending,{ok:false,...ids,code:'TEMPORARY_UNAVAILABLE',retryable:true});
  h.setBinding(verified);
  h.lookups.syncAccount();
  h.setOpen('/',()=>Promise.resolve({ok:true}));
  assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:true,...ids,destination:'/'});
  // 갱신 중에 그 요청을 취소했으면 갱신 중이라는 이유로 다시 시도를 권하지 않는다.
  gate=deferred();
  h.setOpen('/',()=>gate.promise);
  pending=h.lookups.open(opening('/',ids));
  h.setBinding(renewing);
  h.lookups.syncAccount();
  assert.deepEqual(h.lookups.cancel({...ids}),unconfirmed(ids));
  gate.resolve({ok:true});
  assert.deepEqual(await pending,unconfirmed(ids));
  h.setBinding(verified);
  assert.deepEqual(await h.lookups.open(opening('/',ids)),{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
  assert.deepEqual(h.opened,['/','/','/']);
});

test('다른 요청 ID, 다른 세대, 다른 모양의 취소는 진행 중인 열기와 그 기록을 건드리지 않는다',async()=>{
  const h=harness(),ids=h.ids(),gate=deferred();
  await h.lookups.resolve(ids);
  h.setOpen('/',()=>gate.promise);
  const pending=h.lookups.open(opening('/',ids));
  const others=[
    {requestId:ids.requestId,accountGeneration:crypto.randomUUID()},{requestId:crypto.randomUUID(),accountGeneration:ids.accountGeneration},
    {...ids,extra:1},{requestId:ids.requestId},{accountGeneration:ids.accountGeneration},
    {requestId:ids.requestId.toUpperCase(),accountGeneration:ids.accountGeneration},
    Object.defineProperty({requestId:ids.requestId},'accountGeneration',{get:()=>ids.accountGeneration,enumerable:true}),
    [ids],null,undefined,'x',
  ];
  for(const [index,value] of others.entries())assert.equal(h.lookups.cancel(value),null,'취소 '+index);
  gate.resolve({ok:true});
  assert.deepEqual(await pending,{ok:true,...ids,destination:'/'});
  // 기록도 그대로라 같은 두 ID로 다시 열 수 있다.
  assert.deepEqual(await h.lookups.open(opening('/pulse-app/',ids)),{ok:true,...ids,destination:'/pulse-app/'});
  assert.deepEqual(h.opened,['/','/pulse-app/']);
});
