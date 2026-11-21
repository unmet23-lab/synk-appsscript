'use strict';
// 회사 공통 진입 native 초대 전송 시험. 관리자(desktop/src/company-entry.cjs)와 회사 창 preload(desktop/src/company-entry-preload.cjs)를
// 가짜 BrowserWindow, webContents, 프레임, IPC와 가짜 회사 문서(receiver, employee)로 돌린다. 실제 창, 프로필, 서버는 쓰지 않는다.
// 실행: node --test desktop/tests/company-entry.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const crypto=require('node:crypto');
const path=require('node:path');
const {createCompanyEntryManager,createCompanyEntryPartitions,companyEntryPartition,companyEntryRequestAllowed,companyAnswerFromPulse,entryRefusal,bindingFromAuth,readBinding,CHANNELS,RECEIVER_URL,EMPLOYEE_URL,PRELOAD_PATH,STAGE_MS,TOTAL_MS,UNCONFIRMED_CODE}=require('../src/company-entry.cjs');
const {installCompanyEntryPreload}=require('../src/company-entry-preload.cjs');
const {createCompanyEntryDestinations}=require('../src/company-entry-destinations.cjs');
const {createAuthService,publicError}=require('../src/auth-service.cjs');

const ORIGIN='https://workspace.synk.im';
const TOKEN='Inv1te_T0ken-For-Company-Entry-0123456789';
const OTHER_TOKEN='Other_T0ken-For-Company-Entry-9876543210';
const PARTITION='persist:company-entry-test';
// 직원 문서를 싣는 Workspace 겉의 통. 분류 창의 partition과 다르다.
const WORKSPACE_PARTITION='persist:synk-workspace-test';
const ACCOUNT=crypto.randomUUID();
const CAPABILITY='data-synk-company-entry';
const LINK=`${ORIGIN}/#invite=${TOKEN}`;

const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(rounds=60){for(let index=0;index<rounds;index+=1)await tick();}
function within(promise,ms=3000){let timer;return Promise.race([promise,new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('시험 시간 초과')),ms);})]).finally(()=>clearTimeout(timer));}
function track(promise){const box={settled:false,value:undefined};promise.then(value=>{box.settled=true;box.value=value;});return box;}
const message=(type,fields)=>({channel:'synk.company.entry',version:1,type,...fields});
const signedIn=(overrides={})=>({accountGeneration:crypto.randomUUID(),expectedAccountId:ACCOUNT,epoch:1,status:'signed-in',...overrides});
const nav=()=>({prevented:false,preventDefault(){this.prevented=true;}});
const offersOf=frame=>frame.sent.filter(item=>item.channel===CHANNELS.offer).map(item=>item.payload);
const idsFor=h=>({requestId:crypto.randomUUID(),accountGeneration:h.binding.accountGeneration});

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

function fakeElectron(){
  const sessions=new Map(),windows=[],hooks={onCreate:null};
  const session={fromPartition(partition){if(!sessions.has(partition))sessions.set(partition,{partition});return sessions.get(partition);}};
  class Frame{
    constructor(url){this.url=url;this.sent=[];this.listener=null;}
    send(channel,payload){
      const copy=structuredClone(payload);
      this.sent.push({channel,payload:copy});
      if(this.listener){const listener=this.listener;setImmediate(()=>listener(channel,structuredClone(copy)));}
    }
  }
  class Ipc{
    constructor(){this.handlers=new Map();this.listeners=new Map();}
    handle(channel,fn){if(this.handlers.has(channel))throw new Error('같은 채널에 두 번째 handler');this.handlers.set(channel,fn);}
    on(channel,fn){this.listeners.set(channel,[...(this.listeners.get(channel)||[]),fn]);}
    invoke(channel,event,payload){
      const fn=this.handlers.get(channel),copy=structuredClone(payload);
      return Promise.resolve().then(()=>(fn?fn(event,copy):undefined)).then(value=>structuredClone(value));
    }
    emit(channel,event,payload){const copy=structuredClone(payload);for(const fn of this.listeners.get(channel)||[])fn(event,copy);}
  }
  class WebContents extends EventEmitter{
    constructor(partitionSession){super();this.session=partitionSession;this.ipc=new Ipc();this.mainFrame=null;this.loads=[];this.openHandler=null;this.destroyed=false;this.navigator=null;this.pendingLoad=null;this.preloadSent=[];}
    setWindowOpenHandler(fn){this.openHandler=fn;}
    loadURL(url){
      this.loads.push(url);
      return new Promise((resolve,reject)=>{
        const load={url,resolve,reject};
        if(this.navigator){const navigator=this.navigator;setImmediate(()=>navigator(load));}
        else this.pendingLoad=load;
      });
    }
    isDestroyed(){return this.destroyed;}
  }
  class BrowserWindow extends EventEmitter{
    constructor(options){
      super();
      this.options=options;this.visible=false;this.destroyed=false;this.closeCalls=0;
      this.webContents=new WebContents(session.fromPartition(options.webPreferences.partition));
      windows.push(this);
      if(hooks.onCreate)hooks.onCreate(this);
    }
    isDestroyed(){return this.destroyed;}
    isVisible(){return this.visible;}
    show(){this.visible=true;}
    close(){this.closeCalls+=1;this.destroy();}
    destroy(){if(this.destroyed)return;this.destroyed=true;this.webContents.destroyed=true;this.emit('closed');}
  }
  return {BrowserWindow,session,windows,Frame,hooks};
}

// 페이지 window의 가짜. postMessage는 실제처럼 비동기로 같은 window의 모든 message 리스너(preload와 페이지)에 전달한다.
function fakePage(url){
  const listeners=new Map(),attributes=new Map(),posted=[];
  let alive=true;
  const win={
    location:{href:url},
    document:{documentElement:{getAttribute:name=>(attributes.has(name)?attributes.get(name):null),setAttribute:(name,value)=>{attributes.set(name,String(value));}}},
    addEventListener(type,fn){listeners.set(type,[...(listeners.get(type)||[]),fn]);},
    postMessage(data,targetOrigin){
      const copy=structuredClone(data);
      posted.push(copy);
      if(targetOrigin!==new URL(win.location.href).origin)return;
      setImmediate(()=>{if(!alive)return;for(const fn of listeners.get('message')||[])fn({source:win,origin:ORIGIN,data:structuredClone(copy)});});
    },
  };
  win.top=win;
  return {
    win,posted,attributes,
    dispatch(data,{source=win,origin=ORIGIN}={}){for(const fn of listeners.get('message')||[])fn({source,origin,data:structuredClone(data)});},
    hide(){alive=false;for(const fn of listeners.get('pagehide')||[])fn({persisted:false});},
  };
}

function rendererIpc(){
  const listeners=new Map(),sent=[],invokes=[];
  return {
    sent,invokes,
    on(channel,fn){listeners.set(channel,[...(listeners.get(channel)||[]),fn]);},
    send(channel,payload){sent.push({channel,payload:structuredClone(payload)});},
    invoke(channel,payload){return new Promise((resolve,reject)=>{invokes.push({channel,payload:structuredClone(payload),resolve:value=>resolve(structuredClone(value)),reject});});},
    emit(channel,payload,event={}){for(const fn of listeners.get(channel)||[])fn(event,structuredClone(payload));},
  };
}

// preload의 ipcRenderer를 관리자 창의 webContents.ipc와 프레임에 잇는다. 보낸 프레임은 언제나 그 문서의 프레임이다.
// preload가 main에 보낸 결과는 그 창의 preloadSent에도 남긴다.
function bridge(contents,frame){
  const listeners=new Map(),event={sender:contents,senderFrame:frame};
  frame.listener=(channel,payload)=>{for(const fn of listeners.get(channel)||[])fn({},payload);};
  return {
    on(channel,fn){listeners.set(channel,[...(listeners.get(channel)||[]),fn]);},
    send(channel,payload){const copy=structuredClone(payload);contents.preloadSent.push({channel,payload:structuredClone(copy)});setImmediate(()=>contents.ipc.emit(channel,event,copy));},
    invoke(channel,payload){return contents.ipc.invoke(channel,event,payload);},
  };
}

// 회사 문서의 가짜. 리스너를 붙이고 capability를 단 뒤 ready를 한 번 보낸다. bind에 bound로 답하고,
// receiver는 offer의 토큰으로 분류 결과를, employee는 실제 큐에 넣은 뒤에만 received를 보낸다.
function companyScript(role,behavior={}){
  return page=>{
    const documentId=crypto.randomUUID(),phase=role==='receiver'?'classify':'deliver';
    const state={documentId,binds:[],tokens:[],queue:[],acks:0};
    let bound=null;
    page.win.addEventListener('message',event=>{
      if(event.source!==page.win||event.origin!==ORIGIN)return;
      const data=event.data;
      if(!data||data.channel!=='synk.company.entry'||data.version!==1)return;
      if(data.type==='bind'){
        state.binds.push(data);
        if(bound||data.documentId!==documentId||data.phase!==phase)return;
        bound={requestId:data.requestId,accountGeneration:data.accountGeneration};
        page.win.postMessage(message('bound',{requestId:data.requestId,accountGeneration:data.accountGeneration,documentId,phase}),ORIGIN);
        return;
      }
      if(data.type!=='offer'||!bound||data.documentId!==documentId||data.requestId!==bound.requestId)return;
      state.tokens.push(data.token);
      const ids={requestId:data.requestId,accountGeneration:data.accountGeneration,documentId};
      if(role==='receiver'){
        const answer=behavior.classify?behavior.classify(data.token):{kind:'employee',destination:'/'};
        page.win.postMessage(answer.code?message('error',{...ids,code:answer.code,retryable:answer.retryable}):message('classified',{...ids,kind:answer.kind,destination:answer.destination}),ORIGIN);
        return;
      }
      state.queue.push({requestId:data.requestId,accountGeneration:data.accountGeneration,token:data.token});
      if(behavior.dropAck)return;
      state.acks+=1;
      page.win.postMessage(message('received',{...ids,kind:'employee',destination:'/',state:'queued'}),ORIGIN);
    });
    if(!behavior.noCapability)page.win.document.documentElement.setAttribute(CAPABILITY,'1');
    if(!behavior.noReady)page.win.postMessage(message('ready',{documentId,documentRole:role}),ORIGIN);
    return state;
  };
}

// 직원 문서의 겉. main의 Workspace 관리자(surfaceForInvite)처럼 따로 된 통의 새 창을 만들어 그 창과 세션을 준다.
function workspaceSurface(electron,{partition=WORKSPACE_PARTITION,guarded=false}={}){
  const surface=new electron.BrowserWindow({show:false,webPreferences:{partition}});
  if(guarded)surface.workspaceGuarded=true;
  return {surface,session:surface.webContents.session};
}

function manual({binding=signedIn(),selectCompanyPartition=()=>PARTITION,deliverCustomer,cancelCustomer,dialog,onUnloadKept,openEmployeeSurface}={}){
  const electron=fakeElectron(),timers=fakeTimers(),customer=[],surfaces=[];
  let current=binding;
  const surfaceFor=openEmployeeSurface||(()=>workspaceSurface(electron));
  const manager=createCompanyEntryManager({
    BrowserWindow:electron.BrowserWindow,session:electron.session,getBinding:()=>(current?{...current}:current),
    deliverCustomer:deliverCustomer||(request=>{customer.push(request);return new Promise(()=>{});}),cancelCustomer,
    // 관리자가 겉을 청할 때 받은 결속을 남긴다.
    openEmployeeSurface:value=>{surfaces.push(value);return surfaceFor(value,electron);},
    selectCompanyPartition,dialog,onUnloadKept,setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout,
  });
  return {manager,electron,timers,customer,surfaces,get binding(){return current;},setBinding(value){current=value;}};
}

function navigate(h,win,load,scripts,documents){
  const contents=win.webContents;
  if(contents.destroyed){load.reject(new Error('창이 닫혔다'));return;}
  const previous=documents.filter(doc=>doc.contents===contents).at(-1);
  if(previous)previous.page.hide();
  contents.emit('did-start-navigation',{url:load.url,isSameDocument:false,isMainFrame:true});
  const frame=new h.electron.Frame(load.url),page=fakePage(load.url);
  contents.mainFrame=frame;
  installCompanyEntryPreload({ipcRenderer:bridge(contents,frame),window:page.win});
  const script=scripts[load.url];
  documents.push({contents,url:load.url,page,frame,state:script?script(page):null});
  contents.emit('dom-ready');
  load.resolve();
}

function integrated({binding,scripts={},customerAnswer,selectCompanyPartition,openEmployeeSurface}={}){
  const calls=[],documents=[];
  const h=manual({binding,selectCompanyPartition,openEmployeeSurface,deliverCustomer:async request=>{
    calls.push(request);
    return customerAnswer?customerAnswer(request):{ok:true,requestId:request.requestId,accountGeneration:request.accountGeneration,state:'received',destination:'/pulse-app/'};
  }});
  h.electron.hooks.onCreate=win=>{win.webContents.navigator=load=>navigate(h,win,load,scripts,documents);};
  return Object.assign(h,{documents,customer:calls});
}

// 관리자 단독 시험용: main이 연 고정 문서가 이 URL로 준비됐다고 알린다.
function commitDocument(h,url,win=h.electron.windows.at(-1)){
  const contents=win.webContents,frame=new h.electron.Frame(url);
  contents.emit('did-start-navigation',{url,isSameDocument:false,isMainFrame:true});
  contents.mainFrame=frame;
  contents.emit('dom-ready');
  const load=contents.pendingLoad;
  contents.pendingLoad=null;
  if(load)load.resolve();
  return {win,contents,frame,event:{sender:contents,senderFrame:frame},offer:offersOf(frame)[0]};
}
// 직원 문서는 관리자가 겉을 받은 뒤(비동기) 그 겉에 싣는다. 겉을 붙일 때까지 기다린 뒤 고정 /가 준비됐다고 알린다.
async function employeeDocument(h){await settle(5);return commitDocument(h,EMPLOYEE_URL);}
const commit=(doc,payload,event=doc.event)=>doc.contents.ipc.invoke(CHANNELS.commit,event,payload);
const result=(doc,payload,event=doc.event)=>doc.contents.ipc.emit(CHANNELS.result,event,payload);

function quietConsole(t){
  const names=['log','info','warn','error','debug','trace'],saved=names.map(name=>console[name]),calls=[];
  for(const name of names)console[name]=(...args)=>{calls.push({name,args});};
  t.after(()=>{names.forEach((name,index)=>{console[name]=saved[index];});});
  return calls;
}
// 토큰은 preload가 회사 문서에 보내는 offer 메시지에만 있어야 한다. 창 옵션, 이동 URL, main→preload 메시지, preload→main 결과,
// 다른 문서 메시지, 응답에는 없다.
function assertTokenOnlyInOffers(h,responses){
  const outside={
    windows:h.electron.windows.map(win=>({options:win.options,loads:win.webContents.loads})),
    mainToPreload:(h.documents||[]).map(doc=>doc.frame.sent),
    preloadToMain:h.electron.windows.map(win=>win.webContents.preloadSent),
    pagePosts:(h.documents||[]).flatMap(doc=>doc.page.posted.filter(item=>item.type!=='offer')),
    responses,
  };
  assert.equal(JSON.stringify(outside).includes(TOKEN),false);
}

// ── 관리자와 preload를 함께 돌리는 흐름 ──

test('맨 코드는 숨은 receiver 창에서 분류한 뒤 Workspace 겉의 고정 /에서 실제 큐에 들어간 다음에만 성공한다',async t=>{
  const logs=quietConsole(t);
  const h=integrated({scripts:{[RECEIVER_URL]:companyScript('receiver'),[EMPLOYEE_URL]:companyScript('employee')}});
  const ids=idsFor(h);
  const response=await within(h.manager.inspectCode({code:TOKEN,...ids}));
  assert.deepEqual(response,{ok:true,...ids,state:'received',destination:'/'});
  assert.equal(h.electron.windows.length,2);
  const [classifier,win]=h.electron.windows,[receiver,employee]=h.documents;
  // 분류 창은 회사 partition에서 receiver만 싣고, 보이지 않은 채 직원 분류 뒤 닫힌다.
  assert.equal(classifier.options.webPreferences.partition,PARTITION);
  assert.deepEqual(classifier.webContents.loads,[RECEIVER_URL]);
  assert.equal(classifier.isVisible(),false);
  assert.equal(classifier.isDestroyed(),true);
  assert.equal(receiver.contents,classifier.webContents);
  // 직원 문서는 openEmployeeSurface가 그 결속으로 준 겉에 실린다.
  assert.equal(h.surfaces.length,1);
  assert.deepEqual({...h.surfaces[0]},h.binding);
  assert.equal(win.options.webPreferences.partition,WORKSPACE_PARTITION);
  assert.equal(employee.contents,win.webContents);
  assert.deepEqual(win.webContents.loads,[EMPLOYEE_URL]);
  assert.deepEqual(receiver.state.tokens,[TOKEN]);
  assert.deepEqual(employee.state.queue,[{requestId:ids.requestId,accountGeneration:ids.accountGeneration,token:TOKEN}]);
  assert.equal(employee.state.acks,1);
  const receiverOffers=offersOf(receiver.frame),employeeOffers=offersOf(employee.frame);
  assert.equal(receiverOffers.length,1);
  assert.equal(employeeOffers.length,1);
  assert.notEqual(receiverOffers[0].id,employeeOffers[0].id);
  for(const offer of [receiverOffers[0],employeeOffers[0]]){
    assert.deepEqual(Object.keys(offer),['id','requestId','accountGeneration','expectedAccountId']);
    assert.match(offer.id,/^[A-Za-z0-9_-]{32}$/);
    assert.equal(offer.expectedAccountId,ACCOUNT);
  }
  assert.notEqual(receiver.state.documentId,employee.state.documentId);
  assert.deepEqual(receiver.state.binds.map(bind=>bind.phase),['classify']);
  assert.deepEqual(employee.state.binds.map(bind=>bind.phase),['deliver']);
  assert.equal(win.isDestroyed(),false);
  assert.equal(win.isVisible(),true);
  assert.equal(h.timers.size,0);
  assertTokenOnlyInOffers(h,[response]);
  assert.deepEqual(logs,[]);
});

test('엄격한 직원 전체 링크는 분류 창 없이 Workspace 겉의 고정 /로만 간다',async t=>{
  const logs=quietConsole(t);
  const h=integrated({scripts:{[EMPLOYEE_URL]:companyScript('employee')}});
  const ids=idsFor(h);
  const response=await within(h.manager.handoffLink({href:LINK,...ids}));
  assert.deepEqual(response,{ok:true,...ids,state:'received',destination:'/'});
  // 첫 창이 곧 겉이다. 회사 partition의 분류 창은 만들지 않는다.
  assert.equal(h.electron.windows.length,1);
  assert.equal(h.surfaces.length,1);
  assert.equal(h.electron.windows[0].options.webPreferences.partition,WORKSPACE_PARTITION);
  assert.equal(h.electron.windows[0].isVisible(),true);
  assert.deepEqual(h.electron.windows[0].webContents.loads,[EMPLOYEE_URL]);
  assert.deepEqual(h.documents[0].state.tokens,[TOKEN]);
  assertTokenOnlyInOffers(h,[response]);
  assert.deepEqual(logs,[]);
});

test('고객 분류는 receiver 창을 닫고 deliverCustomer에 한 번 넘긴 결과만 돌려준다',async t=>{
  const logs=quietConsole(t);
  const h=integrated({scripts:{[RECEIVER_URL]:companyScript('receiver',{classify:()=>({kind:'customer',destination:'/pulse-app/'})}),[EMPLOYEE_URL]:companyScript('employee')}});
  const ids=idsFor(h);
  const response=await within(h.manager.inspectCode({code:TOKEN,...ids}));
  assert.deepEqual(response,{ok:true,...ids,state:'received',destination:'/pulse-app/'});
  assert.deepEqual(h.customer,[{token:TOKEN,...ids}]);
  assert.deepEqual(Object.keys(h.customer[0]),['token','requestId','accountGeneration']);
  const [win]=h.electron.windows;
  assert.deepEqual(win.webContents.loads,[RECEIVER_URL]);
  assert.equal(win.isDestroyed(),true);
  assert.equal(h.timers.size,0);
  assertTokenOnlyInOffers(h,[response]);
  assert.deepEqual(logs,[]);
});

test('receiver의 classified만으로는 끝나지 않는다. 최종 문서가 준비되지 않으면 시간 초과 실패다',async()=>{
  const h=integrated({scripts:{[RECEIVER_URL]:companyScript('receiver'),[EMPLOYEE_URL]:companyScript('employee',{noReady:true})}});
  const ids=idsFor(h);
  const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
  await settle();
  const [classifier,win]=h.electron.windows;
  assert.deepEqual(classifier.webContents.loads,[RECEIVER_URL]);
  assert.equal(classifier.isDestroyed(),true);
  assert.deepEqual(win.webContents.loads,[EMPLOYEE_URL]);
  assert.equal(box.settled,false);
  h.timers.advance(STAGE_MS);
  await settle(5);
  assert.deepEqual(box.value,{ok:false,...ids,code:'HANDOFF_TIMEOUT',retryable:true});
  assert.equal(win.isDestroyed(),true);
  assert.deepEqual(h.documents[1].state.tokens,[]);
});

test('직원 문서가 큐에 넣은 뒤 ACK가 사라지면 미확인이며 다시 보내지 않는다',async()=>{
  const h=integrated({scripts:{[RECEIVER_URL]:companyScript('receiver'),[EMPLOYEE_URL]:companyScript('employee',{dropAck:true})}});
  const ids=idsFor(h);
  const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
  await settle();
  const [classifier,win]=h.electron.windows,employee=h.documents[1];
  assert.equal(employee.contents,win.webContents);
  assert.equal(employee.state.queue.length,1);
  assert.equal(box.settled,false);
  h.timers.advance(STAGE_MS);
  await settle(5);
  assert.deepEqual(box.value,{ok:false,...ids,code:UNCONFIRMED_CODE,retryable:false});
  h.timers.advance(TOTAL_MS);
  await settle();
  assert.deepEqual(classifier.webContents.loads,[RECEIVER_URL]);
  assert.deepEqual(win.webContents.loads,[EMPLOYEE_URL]);
  assert.equal(offersOf(employee.frame).length,1);
  assert.deepEqual(employee.state.tokens,[TOKEN]);
  assert.equal(win.isDestroyed(),false);
});

test('receiver의 분류 실패는 정해진 code와 retryable 짝만 그대로 답하고, 다른 종류로 추측하지 않으며 receiver 창을 닫는다',async t=>{
  const logs=quietConsole(t);
  const run=async(code,retryable)=>{
    const h=integrated({scripts:{[RECEIVER_URL]:companyScript('receiver',{classify:()=>({code,retryable})}),[EMPLOYEE_URL]:companyScript('employee')}});
    const ids=idsFor(h),label=code+' '+retryable;
    const response=await within(h.manager.inspectCode({code:TOKEN,...ids}));
    const [win]=h.electron.windows,[receiver]=h.documents;
    assert.deepEqual(h.customer,[],label);
    assert.deepEqual(win.webContents.loads,[RECEIVER_URL],label);
    assert.equal(h.documents.length,1,label);
    assert.deepEqual(receiver.state.tokens,[TOKEN],label);
    assert.equal(win.isDestroyed(),true,label);
    assert.equal(h.timers.size,0,label);
    assertTokenOnlyInOffers(h,[response]);
    const base={id:offersOf(receiver.frame)[0].id,...ids,documentId:receiver.state.documentId};
    return {ids,response,base,results:win.webContents.preloadSent.filter(item=>item.channel===CHANNELS.result).map(item=>item.payload)};
  };
  // 무효·만료(403), 빈도 제한(429), 서버와 네트워크 실패의 원인이 호스트까지 간다. main에 간 결과는 commit한 receiver 문서의
  // 일곱 키뿐이고 원본 문구, 다른 키, 토큰은 없다.
  for(const [code,retryable] of [['INVITE_REJECTED',false],['RATE_LIMITED',true],['TEMPORARY_UNAVAILABLE',true]]){
    const {ids,response,base,results}=await run(code,retryable);
    assert.deepEqual(response,{ok:false,...ids,code,retryable},code);
    assert.deepEqual(results,[{...base,outcome:'classify-failed',code,retryable}],code);
  }
  // 정해진 짝이 아닌 retryable이나 분류 실패가 아닌 code는 원인을 넘기지 않는다. 다른 종류로 추측하지 않고 HANDOFF_UNAVAILABLE이다.
  for(const [code,retryable] of [['INVITE_REJECTED',true],['RATE_LIMITED',false],['TEMPORARY_UNAVAILABLE',false],['INVALID_INPUT',false],['ACCOUNT_MISMATCH',false],['ACCOUNT_CHANGED',true],['BUSY',true],['CANCELLED',true],['HANDOFF_TIMEOUT',true],['HANDOFF_UNAVAILABLE',false]]){
    const {ids,response,base,results}=await run(code,retryable);
    assert.deepEqual(response,{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:true},code+' '+retryable);
    assert.deepEqual(results,[{...base,outcome:'not-received'}],code+' '+retryable);
  }
  assert.deepEqual(logs,[]);
});

test('capability 속성이 없는 문서는 결속하지 않고 토큰을 받지 않는다',async()=>{
  const h=integrated({scripts:{[RECEIVER_URL]:companyScript('receiver',{noCapability:true})}});
  const ids=idsFor(h);
  const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
  await settle();
  const [receiver]=h.documents;
  assert.deepEqual(receiver.state.binds,[]);
  assert.deepEqual(receiver.state.tokens,[]);
  assert.equal(receiver.page.posted.some(item=>item.type==='offer'),false);
  h.timers.advance(STAGE_MS);
  await settle(5);
  assert.equal(box.value.code,'HANDOFF_TIMEOUT');
});

test('다른 계정 세대가 되면 인계가 끝난 직원 문서의 겉을 바로 없애고, 같은 세대의 갱신은 겉을 남긴다',async()=>{
  const h=integrated({scripts:{[EMPLOYEE_URL]:companyScript('employee')}});
  const ids=idsFor(h);
  assert.equal((await within(h.manager.handoffLink({href:LINK,...ids}))).ok,true);
  const [win]=h.electron.windows;
  assert.equal(win.options.webPreferences.partition,WORKSPACE_PARTITION);
  h.setBinding({...h.binding,epoch:h.binding.epoch+1});
  h.manager.syncAccount();
  assert.equal(win.isDestroyed(),false);
  // 같은 세대의 토큰 갱신(복원 중)과 읽지 못한 결속은 창을 건드리지 않는다.
  h.setBinding({...h.binding,status:'restoring',expectedAccountId:null});
  h.manager.syncAccount();
  h.setBinding(null);
  h.manager.syncAccount();
  assert.equal(win.isDestroyed(),false);
  // 로그아웃은 새 세대다. 페이지의 떠나기 확인에 맡기지 않고 바로 없애므로 이전 계정 화면이 남지 않는다.
  h.setBinding(signedIn({status:'signed-out',expectedAccountId:null}));
  h.manager.syncAccount();
  assert.equal(win.closeCalls,0);
  assert.equal(win.isDestroyed(),true);
});

// ── 관리자 단독 ──

test('직원 전체 링크는 정확한 https workspace.synk.im /와 invite 조각 하나만 받는다',async()=>{
  const bad=[
    `http://workspace.synk.im/#invite=${TOKEN}`,`https://workspace.synk.im:443/#invite=${TOKEN}`,`https://workspace.synk.im:8443/#invite=${TOKEN}`,
    `https://user@workspace.synk.im/#invite=${TOKEN}`,`https://workspace.synk.im/?#invite=${TOKEN}`,`https://workspace.synk.im/?a=1#invite=${TOKEN}`,
    `https://workspace.synk.im/pulse-app/#invite=${TOKEN}`,`https://workspace.synk.im/entry/#invite=${TOKEN}`,`https://workspace.synk.im/#invite=${TOKEN}&invite=${OTHER_TOKEN}`,
    `https://workspace.synk.im/#invite=${TOKEN}&x=1`,`https://workspace.synk.im/#invite=short`,`https://workspace.synk.im/#invite=${'a'.repeat(201)}`,
    `https://WORKSPACE.synk.im/#invite=${TOKEN}`,`https://workspace.synk.im./#invite=${TOKEN}`,` ${LINK}`,`${LINK}\n`,`https://workspace.synk.im/#/join?invite=${TOKEN}`,
    `https://workspace.synk.im#invite=${TOKEN}`,TOKEN,
  ];
  for(const href of bad){
    const h=manual(),ids=idsFor(h);
    assert.deepEqual(await h.manager.handoffLink({href,...ids}),{ok:false,...ids,code:'INVALID_INPUT',retryable:false},href);
    assert.equal(h.electron.windows.length,0,href);
  }
  const h=manual(),ids=idsFor(h);
  for(const input of [{href:LINK,...ids,token:TOKEN},{href:LINK,requestId:ids.requestId},{href:LINK,...ids,expectedAccountId:ACCOUNT},{get href(){return LINK;},...ids},[LINK],null])
    assert.equal((await h.manager.handoffLink(input)).code,'INVALID_INPUT');
  assert.deepEqual(await h.manager.handoffLink({href:LINK,requestId:'not-uuid',accountGeneration:'x'}),{ok:false,requestId:null,accountGeneration:null,code:'INVALID_INPUT',retryable:false});
  assert.deepEqual(await h.manager.inspectCode({code:LINK,...ids}),{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
  assert.equal(h.electron.windows.length,0);
  const box=track(h.manager.handoffLink({href:LINK,...ids}));
  await settle(5);
  // 첫 창이 곧 Workspace 겉이다.
  assert.equal(h.electron.windows.length,1);
  assert.equal(h.surfaces.length,1);
  assert.equal(h.electron.windows[0].options.webPreferences.partition,WORKSPACE_PARTITION);
  assert.deepEqual(h.electron.windows[0].webContents.loads,[EMPLOYEE_URL]);
  assert.equal(box.settled,false);
});

test('계정 결속은 main의 현재 세대와 확정 계정만 쓴다',async()=>{
  const cases=[
    [signedIn({status:'restoring'}),'TEMPORARY_UNAVAILABLE',true],
    [signedIn({status:'error'}),'TEMPORARY_UNAVAILABLE',true],
    [signedIn({expectedAccountId:null}),'HANDOFF_UNAVAILABLE',false],
    [signedIn({status:'signed-out'}),'HANDOFF_UNAVAILABLE',false],
    [{...signedIn(),extra:true},'HANDOFF_UNAVAILABLE',false],
    [signedIn({epoch:-1}),'HANDOFF_UNAVAILABLE',false],
    [signedIn({expectedAccountId:'ACCOUNT'}),'HANDOFF_UNAVAILABLE',false],
    [null,'HANDOFF_UNAVAILABLE',false],
  ];
  for(const [binding,code,retryable] of cases){
    const h=manual({binding});
    const ids={requestId:crypto.randomUUID(),accountGeneration:binding?binding.accountGeneration:crypto.randomUUID()};
    assert.deepEqual(await h.manager.inspectCode({code:TOKEN,...ids}),{ok:false,...ids,code,retryable},JSON.stringify(binding));
    assert.equal(h.electron.windows.length,0);
  }
  const h=manual(),ids={requestId:crypto.randomUUID(),accountGeneration:crypto.randomUUID()};
  assert.deepEqual(await h.manager.inspectCode({code:TOKEN,...ids}),{ok:false,...ids,code:'ACCOUNT_CHANGED',retryable:true});
  assert.equal(h.electron.windows.length,0);
  const guest=manual({binding:signedIn({status:'signed-out',expectedAccountId:null})});
  track(guest.manager.inspectCode({code:TOKEN,...idsFor(guest)}));
  assert.equal(commitDocument(guest,RECEIVER_URL).offer.expectedAccountId,null);
});

test('맨 코드는 고른 partition과 신뢰 preload의 숨긴 창에서 고정 receiver를 열고, 분류 동안 그 창을 보이지 않는다',async()=>{
  const chosen=[];
  const h=manual({selectCompanyPartition:binding=>{chosen.push(binding);return PARTITION;}});
  const ids=idsFor(h);
  track(h.manager.inspectCode({code:TOKEN,...ids}));
  assert.equal(chosen.length,1);
  assert.deepEqual({...chosen[0]},h.binding);
  const [win]=h.electron.windows,preferences=win.options.webPreferences;
  assert.equal(preferences.preload,path.join(__dirname,'..','src','company-entry-preload.cjs'));
  assert.equal(PRELOAD_PATH,preferences.preload);
  assert.equal(preferences.partition,PARTITION);
  for(const [key,value] of Object.entries({sandbox:true,contextIsolation:true,nodeIntegration:false,nodeIntegrationInWorker:false,nodeIntegrationInSubFrames:false,webviewTag:false,webSecurity:true,allowRunningInsecureContent:false,devTools:false}))
    assert.equal(preferences[key],value,key);
  assert.equal(win.options.show,false);
  assert.equal(win.webContents.session,h.electron.session.fromPartition(PARTITION));
  assert.deepEqual(win.webContents.loads,[RECEIVER_URL]);
  assert.deepEqual(win.webContents.openHandler({url:EMPLOYEE_URL}),{action:'deny'});
  const navigation=nav(),webview=nav();
  win.webContents.emit('will-navigate',navigation,EMPLOYEE_URL);
  win.webContents.emit('will-attach-webview',webview);
  assert.equal(navigation.prevented,true);
  assert.equal(webview.prevented,true);
  assert.equal(win.isVisible(),false);
  const doc=commitDocument(h,RECEIVER_URL);
  // offer를 보낸 뒤에도 분류 창은 숨은 채다. 사람에게 보일 것이 없다.
  assert.equal(win.isVisible(),false);
  assert.deepEqual(doc.offer,{id:doc.offer.id,...ids,expectedAccountId:ACCOUNT});
  assert.equal(JSON.stringify(win.options).includes(TOKEN),false);
  // 창 옵션은 보안과 무관한 값만 바꿀 수 있다.
  const electron=fakeElectron();
  const custom=createCompanyEntryManager({BrowserWindow:electron.BrowserWindow,session:electron.session,getBinding:()=>({...h.binding}),deliverCustomer:()=>new Promise(()=>{}),selectCompanyPartition:()=>PARTITION,
    windowOptions:{title:'회사',show:true,parent:{},webPreferences:{nodeIntegration:true,preload:'other.cjs'}},setTimeout:()=>0,clearTimeout:()=>{}});
  track(custom.inspectCode({code:TOKEN,...idsFor(h)}));
  const options=electron.windows[0].options;
  assert.equal(options.title,'회사');
  assert.equal(options.show,false);
  assert.equal(Object.hasOwn(options,'parent'),false);
  assert.equal(options.webPreferences.nodeIntegration,false);
  assert.equal(options.webPreferences.preload,PRELOAD_PATH);
});

test('commit은 정확한 프레임, 고정 문서, 같은 id·요청·세대에서 한 번만 토큰을 준다',async()=>{
  const h=manual(),ids=idsFor(h);
  const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
  const doc=commitDocument(h,RECEIVER_URL),documentId=crypto.randomUUID();
  const good={id:doc.offer.id,...ids,documentId};
  const rejected=[
    [doc.event,{...good,extra:1}],[doc.event,{id:doc.offer.id,...ids}],[doc.event,{...good,id:'x'.repeat(32)}],[doc.event,{...good,id:'short'}],
    [doc.event,{...good,requestId:crypto.randomUUID()}],[doc.event,{...good,accountGeneration:crypto.randomUUID()}],[doc.event,{...good,documentId:'not-a-uuid'}],
    [doc.event,{...good,documentId:null}],[doc.event,[good]],[doc.event,null],
    [{sender:doc.contents,senderFrame:new h.electron.Frame(RECEIVER_URL)},good],[{sender:{},senderFrame:doc.frame},good],[{sender:doc.contents,senderFrame:null},good],[null,good],
  ];
  for(const [event,payload] of rejected)assert.equal(await commit(doc,payload,event),null,JSON.stringify(payload));
  for(const url of [RECEIVER_URL+'#x',RECEIVER_URL+'?x=1','https://workspace.synk.im/','https://workspace.synk.im/pulse-app/']){
    doc.frame.url=url;
    assert.equal(await commit(doc,good),null,url);
  }
  doc.frame.url=RECEIVER_URL;
  assert.deepEqual(await commit(doc,good),{...good,token:TOKEN});
  assert.equal(await commit(doc,good),null);
  assert.equal(await commit(doc,{...good,documentId:crypto.randomUUID()}),null);
  await settle(5);
  assert.equal(box.settled,false);
});

test('분류 단계는 정확한 classified만 받고 receiver의 delivered와 commit 전 성공을 거절한다',async()=>{
  const h=manual(),ids=idsFor(h);
  const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
  const doc=commitDocument(h,RECEIVER_URL),documentId=crypto.randomUUID(),base={id:doc.offer.id,...ids};
  result(doc,{...base,documentId:null,outcome:'delivered'});
  result(doc,{...base,documentId,outcome:'classified',kind:'employee',destination:'/'});
  result(doc,{...base,documentId,outcome:'not-received'});
  await settle(5);
  assert.equal(box.settled,false);
  assert.ok(await commit(doc,{...base,documentId}));
  for(const payload of [
    {...base,documentId,outcome:'delivered'},{...base,documentId:crypto.randomUUID(),outcome:'classified',kind:'employee',destination:'/'},
    {...base,documentId,outcome:'classified',kind:'employee',destination:'/pulse-app/'},{...base,documentId,outcome:'classified',kind:'customer',destination:'/'},
    {...base,documentId,outcome:'classified',kind:'employee',destination:'/',extra:1},{...base,documentId,outcome:'classified',kind:'employee'},
    {...base,documentId,outcome:'received'},{...base,documentId,outcome:'delivered',kind:'employee',destination:'/'},
    {...base,id:'y'.repeat(32),documentId,outcome:'classified',kind:'employee',destination:'/'},
  ])result(doc,payload);
  result(doc,{...base,documentId,outcome:'classified',kind:'employee',destination:'/'},{sender:doc.contents,senderFrame:new h.electron.Frame(RECEIVER_URL)});
  await settle(5);
  assert.equal(box.settled,false);
  assert.deepEqual(doc.contents.loads,[RECEIVER_URL]);
  result(doc,{...base,documentId,outcome:'classified',kind:'employee',destination:'/'});
  await settle(5);
  // 직원 분류 뒤 분류 창은 닫히고, 고정 /는 Workspace 겉에 실린다. 분류 성공만으로는 끝나지 않는다.
  assert.deepEqual(doc.contents.loads,[RECEIVER_URL]);
  assert.equal(doc.win.isDestroyed(),true);
  assert.equal(h.electron.windows.length,2);
  assert.deepEqual(h.electron.windows[1].webContents.loads,[EMPLOYEE_URL]);
  assert.equal(box.settled,false);
});

test('분류 실패 결과는 commit한 receiver 문서의 정확한 모양과 정해진 짝만 받고, commit 전과 최종 문서에서는 받지 않는다',async()=>{
  const allowed=[['INVITE_REJECTED',false],['RATE_LIMITED',true],['TEMPORARY_UNAVAILABLE',true]];
  for(const [code,retryable] of allowed){
    const h=manual(),ids=idsFor(h);
    const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
    const doc=commitDocument(h,RECEIVER_URL),documentId=crypto.randomUUID(),base={id:doc.offer.id,...ids};
    const failed={...base,documentId,outcome:'classify-failed',code,retryable};
    // commit 전에는 문서에 토큰 사본이 없으므로 분류 실패를 받지 않는다.
    result(doc,failed);
    result(doc,{...failed,documentId:null});
    await settle(5);
    assert.equal(box.settled,false,code);
    assert.equal((await commit(doc,{...base,documentId})).token,TOKEN,code);
    const forged=[
      {...failed,retryable:!retryable},{...failed,retryable:String(retryable)},{...failed,retryable:null},
      {...failed,code:'ACCOUNT_MISMATCH'},{...failed,code:'BUSY'},{...failed,code:'INVALID_INPUT'},{...failed,code:'HANDOFF_UNAVAILABLE'},{...failed,code:UNCONFIRMED_CODE},
      {...failed,code:'__proto__'},{...failed,code:code.toLowerCase()},{...failed,code:null},
      {...failed,message:'서버 원문'},{...failed,token:TOKEN},{...failed,status:403},{...failed,kind:'employee',destination:'/'},
      {...base,documentId,outcome:'classify-failed',code},{...base,documentId,outcome:'classify-failed',retryable},
      {...base,documentId,outcome:'not-received',code,retryable},{...base,documentId,outcome:'unavailable',code,retryable},{...base,documentId,outcome:'demo',code,retryable},
      {...failed,outcome:'error'},{...failed,outcome:'rejected'},
      {...failed,documentId:crypto.randomUUID()},{...failed,documentId:null},{...failed,documentId:'not-a-uuid'},
      {...failed,id:'y'.repeat(32)},{...failed,requestId:crypto.randomUUID()},{...failed,accountGeneration:crypto.randomUUID()},
      [failed],null,
    ];
    for(const payload of forged)result(doc,payload);
    // 다른 프레임이나 다른 webContents가 보낸 같은 결과도 받지 않는다.
    result(doc,failed,{sender:doc.contents,senderFrame:new h.electron.Frame(RECEIVER_URL)});
    result(doc,failed,{sender:{},senderFrame:doc.frame});
    await settle(5);
    assert.equal(box.settled,false,code);
    assert.equal(doc.win.isDestroyed(),false,code);
    result(doc,failed);
    await settle(5);
    assert.deepEqual(box.value,{ok:false,...ids,code,retryable},code);
    assert.equal(doc.win.isDestroyed(),true,code);
    assert.deepEqual(doc.contents.loads,[RECEIVER_URL],code);
    assert.deepEqual(h.customer,[],code);
    assert.equal(h.timers.size,0,code);
    assert.equal(JSON.stringify(box.value).includes(TOKEN),false,code);
    // 끝난 요청의 늦은 결과는 답을 바꾸지 않는다.
    result(doc,{...failed,code:'RATE_LIMITED',retryable:true});
    await settle(5);
    assert.deepEqual(box.value,{ok:false,...ids,code,retryable},code);
  }
  // 최종 문서는 분류 실패를 알릴 수 없다. 최종 commit 전의 같은 모양은 받지 않고, 최종 commit 뒤에는 원인과 관계없이 미확인이다.
  for(const [code,retryable] of allowed){
    const h=manual(),ids=idsFor(h);
    const box=track(h.manager.handoffLink({href:LINK,...ids}));
    const doc=await employeeDocument(h),documentId=crypto.randomUUID(),base={id:doc.offer.id,...ids,documentId};
    result(doc,{...base,outcome:'classify-failed',code,retryable});
    await settle(5);
    assert.equal(box.settled,false,code);
    assert.equal((await commit(doc,base)).token,TOKEN,code);
    result(doc,{...base,outcome:'classify-failed',code,retryable});
    await settle(5);
    assert.equal(box.settled,false,code);
    result(doc,{...base,outcome:'not-received'});
    await settle(5);
    assert.deepEqual(box.value,{ok:false,...ids,code:UNCONFIRMED_CODE,retryable:false},code);
    assert.equal(doc.win.isDestroyed(),false,code);
    assert.equal(offersOf(doc.frame).length,1,code);
  }
  // 분류 실패가 닿기 전에 계정 epoch가 바뀌었으면 그 원인이 아니라 ACCOUNT_CHANGED다.
  {
    const h=manual(),ids=idsFor(h);
    const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
    const doc=commitDocument(h,RECEIVER_URL),documentId=crypto.randomUUID(),base={id:doc.offer.id,...ids,documentId};
    assert.ok(await commit(doc,base));
    h.setBinding({...h.binding,epoch:h.binding.epoch+1});
    result(doc,{...base,outcome:'classify-failed',code:'INVITE_REJECTED',retryable:false});
    await settle(5);
    assert.deepEqual(box.value,{ok:false,...ids,code:'ACCOUNT_CHANGED',retryable:true});
    assert.equal(doc.win.isDestroyed(),true);
  }
});

test('직원 최종 단계는 Workspace 겉에서 새 id로 다시 결속하고 commit에서 원본을 지우며 delivered만 성공이다',async()=>{
  const h=manual(),ids=idsFor(h);
  const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
  const receiver=commitDocument(h,RECEIVER_URL),receiverDocument=crypto.randomUUID();
  assert.equal((await commit(receiver,{id:receiver.offer.id,...ids,documentId:receiverDocument})).token,TOKEN);
  result(receiver,{id:receiver.offer.id,...ids,documentId:receiverDocument,outcome:'classified',kind:'employee',destination:'/'});
  const employee=await employeeDocument(h);
  assert.notEqual(employee.win,receiver.win);
  assert.equal(receiver.win.isDestroyed(),true);
  assert.equal(employee.offer.expectedAccountId,ACCOUNT);
  assert.equal(employee.win.isVisible(),true);
  assert.notEqual(employee.offer.id,receiver.offer.id);
  assert.equal(await commit(receiver,{id:receiver.offer.id,...ids,documentId:receiverDocument}),null);
  const documentId=crypto.randomUUID(),base={id:employee.offer.id,...ids};
  assert.deepEqual(await commit(employee,{...base,documentId}),{...base,documentId,token:TOKEN});
  assert.equal(await commit(employee,{...base,documentId}),null);
  result(employee,{...base,documentId,outcome:'classified',kind:'employee',destination:'/'});
  result(receiver,{id:receiver.offer.id,...ids,documentId:receiverDocument,outcome:'delivered'});
  await settle(5);
  assert.equal(box.settled,false);
  result(employee,{...base,documentId,outcome:'delivered'});
  await settle(5);
  assert.deepEqual(box.value,{ok:true,...ids,state:'received',destination:'/'});
  assert.equal(employee.win.isDestroyed(),false);
  assert.equal(h.timers.size,0);
  const inside=nav(),outside=nav();
  employee.contents.emit('will-navigate',inside,'https://workspace.synk.im/join');
  employee.contents.emit('will-navigate',outside,'https://example.com/');
  assert.equal(inside.prevented,false);
  assert.equal(outside.prevented,true);
  result(employee,{...base,documentId,outcome:'not-received'});
  await settle(5);
  assert.equal(employee.win.isDestroyed(),false);
});

test('토큰이 떠나기 전의 끝맺음은 원인별 실패이고 회사 창을 닫는다',async()=>{
  const endings={
    timeout:[h=>h.timers.advance(STAGE_MS),'HANDOFF_TIMEOUT'],
    classifyCommittedTimeout:[async(h,doc,ids)=>{assert.ok(await commit(doc,{id:doc.offer.id,...ids,documentId:crypto.randomUUID()}));h.timers.advance(STAGE_MS);},'HANDOFF_TIMEOUT'],
    closed:[(h,doc)=>doc.win.destroy(),'CANCELLED'],
    navigation:[(h,doc)=>doc.contents.emit('did-start-navigation',{url:'https://workspace.synk.im/login/',isSameDocument:false,isMainFrame:true}),'HANDOFF_UNAVAILABLE'],
    hash:[(h,doc)=>doc.contents.emit('did-navigate-in-page',{},RECEIVER_URL+'#moved',true),'HANDOFF_UNAVAILABLE'],
    redirect:[(h,doc)=>{const event=nav();doc.contents.emit('will-redirect',event,'https://workspace.synk.im/login/',false,true);assert.equal(event.prevented,true);},'HANDOFF_UNAVAILABLE'],
    crash:[(h,doc)=>doc.contents.emit('render-process-gone',{},{reason:'crashed'}),'HANDOFF_UNAVAILABLE'],
    account:[h=>{h.setBinding(signedIn());h.manager.syncAccount();},'ACCOUNT_CHANGED'],
    epoch:[h=>{h.setBinding({...h.binding,epoch:h.binding.epoch+1});h.manager.syncAccount();},'ACCOUNT_CHANGED'],
    restoring:[h=>{h.setBinding({...h.binding,status:'restoring'});h.manager.syncAccount();},'ACCOUNT_CHANGED'],
    accountAtCommit:[async(h,doc,ids)=>{h.setBinding({...h.binding,accountGeneration:crypto.randomUUID()});assert.equal(await commit(doc,{id:doc.offer.id,...ids,documentId:crypto.randomUUID()}),null);},'ACCOUNT_CHANGED'],
    cancel:[(h,doc,ids)=>assert.deepEqual(h.manager.cancel({...ids}),{ok:false,...ids,code:'CANCELLED',retryable:true}),'CANCELLED'],
    dispose:[h=>h.manager.dispose(),'CANCELLED'],
    unavailable:[(h,doc,ids)=>result(doc,{id:doc.offer.id,...ids,documentId:null,outcome:'unavailable'}),'HANDOFF_UNAVAILABLE'],
  };
  for(const [name,[end,code]] of Object.entries(endings)){
    const h=manual(),ids=idsFor(h);
    const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
    const doc=commitDocument(h,RECEIVER_URL);
    await end(h,doc,ids);
    await settle(5);
    assert.deepEqual(box.value,{ok:false,...ids,code,retryable:true},name);
    assert.equal(doc.win.isDestroyed(),true,name);
    assert.equal(h.timers.size,0,name);
    assert.equal(await commit(doc,{id:doc.offer.id,...ids,documentId:crypto.randomUUID()}),null,name);
  }
});

test('최종 commit 뒤 ACK가 끊기면 어떤 끝맺음도 미확인이며 다시 보내지 않는다',async()=>{
  const endings={
    timeout:h=>h.timers.advance(STAGE_MS),
    closed:(h,doc)=>doc.win.destroy(),
    navigation:(h,doc)=>doc.contents.emit('did-start-navigation',{url:EMPLOYEE_URL,isSameDocument:false,isMainFrame:true}),
    hash:(h,doc)=>doc.contents.emit('did-navigate-in-page',{},EMPLOYEE_URL+'#x',true),
    crash:(h,doc)=>doc.contents.emit('render-process-gone',{},{reason:'crashed'}),
    epoch:h=>{h.setBinding({...h.binding,epoch:h.binding.epoch+1});h.manager.syncAccount();},
    cancel:(h,doc,ids)=>assert.deepEqual(h.manager.cancel({...ids}),{ok:false,...ids,code:UNCONFIRMED_CODE,retryable:false}),
    dispose:h=>h.manager.dispose(),
    notReceived:(h,doc,ids,documentId)=>result(doc,{id:doc.offer.id,...ids,documentId,outcome:'not-received'}),
  };
  for(const [name,end] of Object.entries(endings)){
    const h=manual(),ids=idsFor(h);
    const box=track(h.manager.handoffLink({href:LINK,...ids}));
    const doc=await employeeDocument(h),documentId=crypto.randomUUID();
    assert.equal((await commit(doc,{id:doc.offer.id,...ids,documentId})).token,TOKEN,name);
    end(h,doc,ids,documentId);
    await settle(5);
    assert.deepEqual(box.value,{ok:false,...ids,code:UNCONFIRMED_CODE,retryable:false},name);
    assert.deepEqual(doc.contents.loads,[EMPLOYEE_URL],name);
    assert.equal(offersOf(doc.frame).length,1,name);
    if(name!=='closed')assert.equal(doc.win.isDestroyed(),false,name);
    assert.equal(h.timers.size,0,name);
  }
});

test('고객 분류는 receiver 창을 닫고 deliverCustomer에 한 번만 소유권을 넘긴다',async()=>{
  let answer=null;
  const calls=[];
  const h=manual({deliverCustomer:request=>{calls.push(request);return new Promise(resolve=>{answer=resolve;});}});
  const ids=idsFor(h);
  const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
  const doc=commitDocument(h,RECEIVER_URL),documentId=crypto.randomUUID(),base={id:doc.offer.id,...ids,documentId};
  assert.ok(await commit(doc,base));
  result(doc,{...base,outcome:'classified',kind:'customer',destination:'/pulse-app/'});
  await settle(5);
  assert.deepEqual(calls,[{token:TOKEN,...ids}]);
  assert.equal(doc.win.isDestroyed(),true);
  assert.deepEqual(doc.contents.loads,[RECEIVER_URL]);
  assert.equal(await commit(doc,base),null);
  result(doc,{...base,outcome:'classified',kind:'customer',destination:'/pulse-app/'});
  h.setBinding({...h.binding,epoch:h.binding.epoch+1});
  h.manager.syncAccount();
  await settle(5);
  assert.equal(calls.length,1);
  assert.equal(box.settled,false);
  answer({ok:true,...ids,state:'received',destination:'/pulse-app/'});
  await settle(5);
  assert.deepEqual(box.value,{ok:true,...ids,state:'received',destination:'/pulse-app/'});
});

test('고객 경로의 응답은 같은 요청의 정확한 공개 응답만 쓰고, 넘긴 뒤의 나머지는 미확인이다',async()=>{
  const unconfirmed=ids=>({ok:false,...ids,code:UNCONFIRMED_CODE,retryable:false});
  const cases=[
    [ids=>({ok:false,...ids,code:'ACCOUNT_CHANGED',retryable:true}),ids=>({ok:false,...ids,code:'ACCOUNT_CHANGED',retryable:true})],
    [ids=>({ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false}),ids=>({ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false})],
    [ids=>({ok:true,...ids,state:'received',destination:'/'}),unconfirmed],
    [ids=>({ok:true,...ids,requestId:crypto.randomUUID(),state:'received',destination:'/pulse-app/'}),unconfirmed],
    [ids=>({ok:true,...ids,state:'received',destination:'/pulse-app/',token:TOKEN}),unconfirmed],
    [ids=>({ok:false,...ids,code:'SOMETHING_ELSE',retryable:true}),unconfirmed],
    [()=>{throw new Error('실패 '+TOKEN);},unconfirmed],
    [()=>Promise.reject(new Error('실패 '+TOKEN)),unconfirmed],
    [()=>undefined,unconfirmed],
  ];
  for(const [answer,expected] of cases){
    let ids;
    const h=manual({deliverCustomer:()=>answer(ids)});
    ids=idsFor(h);
    const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
    const doc=commitDocument(h,RECEIVER_URL),documentId=crypto.randomUUID(),base={id:doc.offer.id,...ids,documentId};
    assert.ok(await commit(doc,base));
    result(doc,{...base,outcome:'classified',kind:'customer',destination:'/pulse-app/'});
    await settle(5);
    assert.deepEqual(box.value,expected(ids));
    assert.equal(JSON.stringify(box.value).includes(TOKEN),false);
  }
});

test('고객 경로로 넘긴 뒤에는 전체 60초가 지나면 미확인으로 끝나고 다시 보내지 않는다',async()=>{
  const h=manual(),ids=idsFor(h);
  const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
  const doc=commitDocument(h,RECEIVER_URL),documentId=crypto.randomUUID(),base={id:doc.offer.id,...ids,documentId};
  assert.ok(await commit(doc,base));
  result(doc,{...base,outcome:'classified',kind:'customer',destination:'/pulse-app/'});
  h.timers.advance(STAGE_MS);
  await settle(5);
  assert.equal(box.settled,false);
  h.timers.advance(TOTAL_MS-STAGE_MS);
  await settle(5);
  assert.deepEqual(box.value,{ok:false,...ids,code:UNCONFIRMED_CODE,retryable:false});
  assert.equal(h.customer.length,1);
  assert.equal(h.timers.size,0);
});

test('고객 경로로 넘긴 요청의 취소는 같은 두 ID로 PULSE도 취소하고, PULSE가 토큰을 내주기 전일 때만 CANCELLED다',async()=>{
  const cancelled=ids=>({ok:false,...ids,code:'CANCELLED',retryable:true}),unconfirmed=ids=>({ok:false,...ids,code:UNCONFIRMED_CODE,retryable:false});
  const cases=[
    [cancelled,cancelled],
    [unconfirmed,unconfirmed],
    [()=>null,unconfirmed],
    [ids=>({...cancelled(ids),requestId:crypto.randomUUID()}),unconfirmed],
    [ids=>({...cancelled(ids),accountGeneration:crypto.randomUUID()}),unconfirmed],
    [ids=>({...cancelled(ids),extra:1}),unconfirmed],
    [ids=>({...cancelled(ids),ok:true}),unconfirmed],
    [()=>{throw new Error('합성 '+TOKEN);},unconfirmed],
  ];
  for(const [index,[answer,expected]] of cases.entries()){
    let settleCustomer=null,ids=null;
    const asked=[];
    const h=manual({deliverCustomer:()=>new Promise(resolve=>{settleCustomer=resolve;}),cancelCustomer:value=>{asked.push(value);return answer(ids);}});
    ids=idsFor(h);
    const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
    const doc=commitDocument(h,RECEIVER_URL),documentId=crypto.randomUUID(),base={id:doc.offer.id,...ids,documentId};
    assert.ok(await commit(doc,base));
    result(doc,{...base,outcome:'classified',kind:'customer',destination:'/pulse-app/'});
    await settle(5);
    assert.equal(typeof settleCustomer,'function','경우 '+index);
    // 다른 요청이나 다른 세대의 취소는 PULSE에 묻지도 않고 아무것도 끝내지 않는다.
    assert.equal(h.manager.cancel({requestId:crypto.randomUUID(),accountGeneration:ids.accountGeneration}),null,'경우 '+index);
    assert.equal(h.manager.cancel({requestId:ids.requestId,accountGeneration:crypto.randomUUID()}),null,'경우 '+index);
    assert.deepEqual(asked,[],'경우 '+index);
    assert.equal(box.settled,false,'경우 '+index);
    const response=h.manager.cancel({...ids});
    assert.deepEqual(response,expected(ids),'경우 '+index);
    assert.deepEqual(asked,[{requestId:ids.requestId,accountGeneration:ids.accountGeneration}],'경우 '+index);
    await settle(5);
    assert.deepEqual(box.value,expected(ids),'경우 '+index);
    assert.equal(JSON.stringify(response).includes(TOKEN),false,'경우 '+index);
    // PULSE의 늦은 답은 끝난 요청을 바꾸지 않고, 같은 취소를 다시 해도 PULSE에 다시 묻지 않는다.
    settleCustomer({ok:true,...ids,state:'received',destination:'/pulse-app/'});
    await settle(5);
    assert.deepEqual(box.value,expected(ids),'경우 '+index);
    assert.equal(h.manager.cancel({...ids}),null,'경우 '+index);
    assert.equal(asked.length,1,'경우 '+index);
    assert.equal(h.timers.size,0,'경우 '+index);
  }
  // cancelCustomer를 받지 않은 관리자는 넘긴 뒤의 취소를 미확인으로 끝낸다.
  const h=manual(),ids=idsFor(h);
  const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
  const doc=commitDocument(h,RECEIVER_URL),documentId=crypto.randomUUID(),base={id:doc.offer.id,...ids,documentId};
  assert.ok(await commit(doc,base));
  result(doc,{...base,outcome:'classified',kind:'customer',destination:'/pulse-app/'});
  await settle(5);
  assert.deepEqual(h.manager.cancel({...ids}),unconfirmed(ids));
  await settle(5);
  assert.deepEqual(box.value,unconfirmed(ids));
});

test('고정 문서를 여는 중의 실패와 다른 문서는 HANDOFF_UNAVAILABLE이다',async()=>{
  const cases={
    failLoad:h=>h.electron.windows[0].webContents.emit('did-fail-load',{},-105,'NAME_NOT_RESOLVED',RECEIVER_URL,true),
    rejected:h=>h.electron.windows[0].webContents.pendingLoad.reject(new Error('ERR_ABORTED')),
    otherDocument:h=>commitDocument(h,RECEIVER_URL+'?next=1'),
    redirect:h=>{const event=nav();h.electron.windows[0].webContents.emit('will-redirect',event,'https://workspace.synk.im/login/',false,true);assert.equal(event.prevented,true);},
  };
  for(const [name,run] of Object.entries(cases)){
    const h=manual(),ids=idsFor(h);
    const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
    run(h);
    await settle(5);
    const [win]=h.electron.windows;
    assert.deepEqual(box.value,{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:true},name);
    assert.equal(win.isDestroyed(),true,name);
    assert.equal(offersOf(win.webContents.mainFrame||{sent:[]}).length,0,name);
  }
});

test('partition을 고르지 못하거나 창 session이 고른 것과 다르면 HANDOFF_UNAVAILABLE이다',async()=>{
  for(const select of [()=>null,()=>'',()=>42,()=>{throw new Error('없음');}]){
    const h=manual({selectCompanyPartition:select}),ids=idsFor(h);
    assert.deepEqual(await h.manager.inspectCode({code:TOKEN,...ids}),{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false});
    assert.equal(h.electron.windows.length,0);
  }
  const h=manual(),ids=idsFor(h);
  h.electron.session.fromPartition=partition=>({partition});
  assert.deepEqual(await h.manager.inspectCode({code:TOKEN,...ids}),{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false});
  assert.equal(h.electron.windows.length,1);
  assert.equal(h.electron.windows[0].isDestroyed(),true);
  const empty=createCompanyEntryManager({});
  assert.deepEqual(await empty.inspectCode({code:TOKEN,...ids}),{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false});
});

test('처리 중 새 요청은 BUSY이고 기존 요청을 덮지 않으며, 같은 requestId는 다시 쓰지 못한다',async()=>{
  const h=manual(),first=idsFor(h),second=idsFor(h);
  const box=track(h.manager.inspectCode({code:TOKEN,...first}));
  assert.deepEqual(await h.manager.handoffLink({href:`${ORIGIN}/#invite=${OTHER_TOKEN}`,...second}),{ok:false,...second,code:'BUSY',retryable:true});
  assert.deepEqual(await h.manager.inspectCode({code:OTHER_TOKEN,...first}),{ok:false,...first,code:'BUSY',retryable:true});
  assert.equal(h.electron.windows.length,1);
  const doc=commitDocument(h,RECEIVER_URL);
  assert.equal((await commit(doc,{id:doc.offer.id,...first,documentId:crypto.randomUUID()})).token,TOKEN);
  assert.equal(h.manager.cancel({requestId:first.requestId,accountGeneration:crypto.randomUUID()}),null);
  assert.equal(h.manager.cancel({requestId:crypto.randomUUID(),accountGeneration:first.accountGeneration}),null);
  assert.equal(h.manager.cancel({requestId:first.requestId}),null);
  assert.equal(h.manager.cancel({...first,extra:1}),null);
  assert.deepEqual(h.manager.cancel({...first}),{ok:false,...first,code:'CANCELLED',retryable:true});
  await settle(5);
  assert.equal(box.value.code,'CANCELLED');
  assert.equal(h.manager.cancel({...first}),null);
  assert.deepEqual(await h.manager.inspectCode({code:TOKEN,...first}),{ok:false,...first,code:'INVALID_INPUT',retryable:false});
  track(h.manager.inspectCode({code:TOKEN,...second}));
  assert.equal(h.electron.windows.length,2);
  h.manager.dispose();
  await settle(5);
  const afterDispose=idsFor(h);
  assert.deepEqual(await h.manager.inspectCode({code:TOKEN,...afterDispose}),{ok:false,...afterDispose,code:'HANDOFF_UNAVAILABLE',retryable:false});
});

// ── 직원 문서의 Workspace 겉 ──

// 맨 코드를 숨은 분류 창의 receiver에서 직원으로 분류시킨다. 분류 창의 문서를 돌려준다.
async function classifyEmployee(h,ids){
  const receiver=commitDocument(h,RECEIVER_URL),documentId=crypto.randomUUID(),base={id:receiver.offer.id,...ids,documentId};
  assert.equal((await commit(receiver,base)).token,TOKEN);
  result(receiver,{...base,outcome:'classified',kind:'employee',destination:'/'});
  return receiver;
}

test('Workspace 관리자가 지킨 겉에는 창 열기 처리기와 쓰던 글 확인을 다시 걸지 않고, 나머지 지킴은 그대로 건다',async()=>{
  const dialogs=[];let kept=0;
  const h=manual({dialog:{showMessageBoxSync:(...args)=>{dialogs.push(args);return 1;}},onUnloadKept:()=>{kept+=1;},openEmployeeSurface:(_binding,electron)=>workspaceSurface(electron,{guarded:true})});
  const ids=idsFor(h);
  const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
  const receiver=await classifyEmployee(h,ids);
  // 숨은 분류 창은 회사 입구가 지킨다.
  assert.deepEqual(receiver.contents.openHandler({url:EMPLOYEE_URL}),{action:'deny'});
  assert.equal(receiver.contents.listenerCount('will-prevent-unload'),2);
  const doc=await employeeDocument(h),surface=doc.win;
  assert.equal(surface.workspaceGuarded,true);
  assert.equal(surface.webContents.openHandler,null);
  assert.equal(surface.webContents.listenerCount('will-prevent-unload'),0);
  const unload={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
  surface.webContents.emit('will-prevent-unload',unload);
  assert.equal(unload.defaultPrevented,false);
  assert.deepEqual(dialogs,[]);
  assert.equal(kept,0);
  // 이동 막기, webview 막기, 고정 문서의 offer와 commit은 그대로다.
  const outside=nav(),webview=nav();
  surface.webContents.emit('will-navigate',outside,'https://example.com/');
  surface.webContents.emit('will-attach-webview',webview);
  assert.equal(outside.prevented,true);
  assert.equal(webview.prevented,true);
  assert.equal(surface.isVisible(),true);
  const documentId=crypto.randomUUID(),base={id:doc.offer.id,...ids,documentId};
  assert.equal((await commit(doc,base)).token,TOKEN);
  result(doc,{...base,outcome:'delivered'});
  await settle(5);
  assert.deepEqual(box.value,{ok:true,...ids,state:'received',destination:'/'});
  assert.equal(surface.isDestroyed(),false);
});

test('Workspace가 바빠 겉을 주지 못하면 BUSY(다시 시도 됨)이고 분류 창은 닫힌다',async()=>{
  const h=manual({openEmployeeSurface:async()=>({busy:true})}),ids=idsFor(h);
  const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
  const receiver=await classifyEmployee(h,ids);
  await settle(5);
  assert.deepEqual(box.value,{ok:false,...ids,code:'BUSY',retryable:true});
  assert.equal(receiver.win.isDestroyed(),true);
  assert.equal(h.surfaces.length,1);
  assert.equal(h.electron.windows.length,1);
  assert.equal(h.timers.size,0);
  // 바쁨과 함께 온 겉도 닫는다.
  const g=manual({openEmployeeSurface:(_binding,electron)=>({...workspaceSurface(electron),busy:true})}),linkIds=idsFor(g);
  assert.deepEqual(await within(g.manager.handoffLink({href:LINK,...linkIds})),{ok:false,...linkIds,code:'BUSY',retryable:true});
  assert.equal(g.electron.windows[0].isDestroyed(),true);
  assert.deepEqual(g.electron.windows[0].webContents.loads,[]);
});

test('겉을 받지 못하면 HANDOFF_UNAVAILABLE(다시 시도 안 됨)이다',async()=>{
  const answers={null:()=>null,undefined:()=>undefined,thrown:()=>{throw new Error('합성');},rejected:()=>Promise.reject(new Error('합성')),noSurface:()=>({session:{}})};
  for(const [name,open] of Object.entries(answers)){
    const h=manual({openEmployeeSurface:open}),ids=idsFor(h);
    const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
    const receiver=await classifyEmployee(h,ids);
    await settle(5);
    assert.deepEqual(box.value,{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false},name);
    assert.equal(receiver.win.isDestroyed(),true,name);
    assert.equal(h.electron.windows.length,1,name);
    assert.equal(h.timers.size,0,name);
  }
  // 링크도 같다. 분류 창은 만들지 않는다.
  const h=manual({openEmployeeSurface:()=>null}),ids=idsFor(h);
  assert.deepEqual(await within(h.manager.handoffLink({href:LINK,...ids})),{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false});
  assert.equal(h.electron.windows.length,0);
  // openEmployeeSurface를 받지 않은 관리자는 직원 문서를 열지 못한다.
  const electron=fakeElectron(),binding=signedIn(),bareIds={requestId:crypto.randomUUID(),accountGeneration:binding.accountGeneration};
  const bare=createCompanyEntryManager({BrowserWindow:electron.BrowserWindow,session:electron.session,getBinding:()=>({...binding}),deliverCustomer:()=>new Promise(()=>{}),selectCompanyPartition:()=>PARTITION,setTimeout:()=>0,clearTimeout:()=>{}});
  assert.deepEqual(await within(bare.handoffLink({href:LINK,...bareIds})),{ok:false,...bareIds,code:'HANDOFF_UNAVAILABLE',retryable:false});
  assert.equal(electron.windows.length,0);
});

test('겉을 기다리는 동안 요청이 끝나면 그 답으로 끝나고, 뒤늦게 온 겉은 닫힌다',async()=>{
  const endings={
    cancel:[(h,ids)=>assert.deepEqual(h.manager.cancel({...ids}),{ok:false,...ids,code:'CANCELLED',retryable:true}),'CANCELLED'],
    timeout:[h=>h.timers.advance(TOTAL_MS),'HANDOFF_TIMEOUT'],
    dispose:[h=>h.manager.dispose(),'CANCELLED'],
  };
  for(const [name,[end,code]] of Object.entries(endings))for(const via of ['code','link']){
    const pending=deferred(),label=name+' '+via;
    const h=manual({openEmployeeSurface:()=>pending.promise}),ids=idsFor(h);
    const box=track(via==='code'?h.manager.inspectCode({code:TOKEN,...ids}):h.manager.handoffLink({href:LINK,...ids}));
    if(via==='code')await classifyEmployee(h,ids);
    await settle(5);
    assert.equal(h.surfaces.length,1,label);
    assert.equal(box.settled,false,label);
    end(h,ids);
    await settle(5);
    assert.deepEqual(box.value,{ok:false,...ids,code,retryable:true},label);
    const late=workspaceSurface(h.electron);
    pending.resolve(late);
    await settle(5);
    assert.equal(late.surface.isDestroyed(),true,label);
    assert.deepEqual(late.surface.webContents.loads,[],label);
    assert.equal(late.surface.webContents.ipc.handlers.size,0,label);
    assert.deepEqual(box.value,{ok:false,...ids,code,retryable:true},label);
    assert.equal(h.timers.size,0,label);
  }
});

test('겉을 기다리는 동안 결속이 다른 세대나 epoch가 되면 ACCOUNT_CHANGED이고 받은 겉은 닫힌다',async()=>{
  const changes={generation:h=>h.setBinding(signedIn()),epoch:h=>h.setBinding({...h.binding,epoch:h.binding.epoch+1})};
  // 계정 알림(syncAccount)이 먼저 오면 그때 끝나고, 오지 않았으면 겉이 온 때 결속을 다시 보고 끝낸다.
  for(const [name,change] of Object.entries(changes))for(const synced of [false,true]){
    const pending=deferred(),label=name+(synced?' syncAccount':'');
    const h=manual({openEmployeeSurface:()=>pending.promise}),ids=idsFor(h);
    const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
    await classifyEmployee(h,ids);
    await settle(5);
    change(h);
    if(synced)h.manager.syncAccount();
    await settle(5);
    assert.equal(box.settled,synced,label);
    const late=workspaceSurface(h.electron);
    pending.resolve(late);
    await settle(5);
    assert.deepEqual(box.value,{ok:false,...ids,code:'ACCOUNT_CHANGED',retryable:true},label);
    assert.equal(late.surface.isDestroyed(),true,label);
    assert.deepEqual(late.surface.webContents.loads,[],label);
    assert.equal(h.timers.size,0,label);
  }
});

test('직원 분류 뒤 분류 창이 닫혀도 요청은 CANCELLED로 끝나지 않고 같은 요청과 토큰으로 겉의 직원 문서에 이어진다',async()=>{
  const pending=deferred();
  const h=manual({openEmployeeSurface:()=>pending.promise}),ids=idsFor(h);
  const box=track(h.manager.inspectCode({code:TOKEN,...ids}));
  const receiver=await classifyEmployee(h,ids);
  await settle(5);
  // 관리자가 분류 창을 요청에서 먼저 떼고 닫았다. 그 창의 closed와 끊김이 다시 와도 요청은 그대로다.
  assert.equal(receiver.win.isDestroyed(),true);
  receiver.win.emit('closed');
  receiver.contents.emit('render-process-gone',{},{reason:'crashed'});
  await settle(5);
  assert.equal(box.settled,false);
  assert.equal(await commit(receiver,{id:receiver.offer.id,...ids,documentId:crypto.randomUUID()}),null);
  pending.resolve(workspaceSurface(h.electron));
  const doc=await employeeDocument(h);
  assert.notEqual(doc.win,receiver.win);
  assert.deepEqual(doc.contents.loads,[EMPLOYEE_URL]);
  assert.notEqual(doc.offer.id,receiver.offer.id);
  const documentId=crypto.randomUUID(),base={id:doc.offer.id,...ids,documentId};
  assert.deepEqual(await commit(doc,base),{...base,token:TOKEN});
  result(doc,{...base,outcome:'delivered'});
  await settle(5);
  assert.deepEqual(box.value,{ok:true,...ids,state:'received',destination:'/'});
  assert.equal(h.timers.size,0);
});

test('겉의 세션이 답의 세션과 다르거나 IPC가 없으면 HANDOFF_UNAVAILABLE이고 그 겉을 닫는다',async()=>{
  const answers={
    other:electron=>({surface:workspaceSurface(electron).surface,session:electron.session.fromPartition('persist:other-test')}),
    missing:electron=>({surface:workspaceSurface(electron).surface,session:null}),
    noIpc:electron=>{const answer=workspaceSurface(electron);answer.surface.webContents.ipc=null;return answer;},
  };
  for(const via of ['link','code'])for(const [name,answer] of Object.entries(answers)){
    const h=manual({openEmployeeSurface:(_binding,electron)=>answer(electron)}),ids=idsFor(h),label=name+' '+via;
    const box=track(via==='code'?h.manager.inspectCode({code:TOKEN,...ids}):h.manager.handoffLink({href:LINK,...ids}));
    if(via==='code')await classifyEmployee(h,ids);
    await settle(5);
    const surface=h.electron.windows.at(-1);
    assert.equal(h.electron.windows.length,via==='code'?2:1,label);
    assert.equal(h.electron.windows[0].isDestroyed(),true,label);
    assert.deepEqual(box.value,{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false},label);
    assert.equal(surface.isDestroyed(),true,label);
    assert.deepEqual(surface.webContents.loads,[],label);
    // 세션을 확인하기 전에는 그 겉에 지킴과 IPC를 걸지 않는다.
    assert.equal(surface.webContents.listenerCount('dom-ready'),0,label);
    assert.equal(h.timers.size,0,label);
  }
});

// ── preload 단독 ──

function preloadPage(url,{capability='1'}={}){
  const page=fakePage(url),ipc=rendererIpc();
  if(capability!==null)page.attributes.set(CAPABILITY,capability);
  const installed=installCompanyEntryPreload({ipcRenderer:ipc,window:page.win});
  return {page,ipc,installed};
}
const offerFor=(fields={})=>({id:crypto.randomBytes(24).toString('base64url'),requestId:crypto.randomUUID(),accountGeneration:crypto.randomUUID(),expectedAccountId:ACCOUNT,...fields});
const postsOf=(page,type)=>page.posted.filter(item=>item.type===type);
const roleOf=url=>(url===RECEIVER_URL?'receiver':'employee');
const phaseOf=url=>(url===RECEIVER_URL?'classify':'deliver');
const resultOf=(offer,documentId,outcome,extra={})=>({channel:CHANNELS.result,payload:{id:offer.id,requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId,outcome,...extra}});
function boundPage(url,offerFields){
  const {page,ipc}=preloadPage(url);
  const documentId=crypto.randomUUID(),offer=offerFor(offerFields);
  page.dispatch(message('ready',{documentId,documentRole:roleOf(url)}));
  ipc.emit(CHANNELS.offer,offer);
  page.dispatch(message('bound',{requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId,phase:phaseOf(url)}));
  assert.equal(ipc.invokes.length,1);
  const ids={requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId};
  return {page,ipc,offer,documentId,ids,good:{id:offer.id,...ids,token:TOKEN}};
}
async function committedPage(url){
  const state=boundPage(url);
  state.ipc.invokes[0].resolve(state.good);
  await settle(3);
  assert.equal(postsOf(state.page,'offer').length,1);
  return state;
}

test('preload는 고정 회사 최상위 문서 두 개에서만 설치된다',()=>{
  assert.deepEqual(preloadPage(RECEIVER_URL).installed,{role:'receiver'});
  assert.deepEqual(preloadPage(EMPLOYEE_URL).installed,{role:'employee'});
  for(const url of [RECEIVER_URL+'?a=1',RECEIVER_URL+'#x',`${EMPLOYEE_URL}#invite=${TOKEN}`,'https://workspace.synk.im/entry','https://workspace.synk.im/pulse-app/','http://workspace.synk.im/','https://example.com/entry/','https://workspace.synk.im:8443/'])
    assert.equal(preloadPage(url).installed,null,url);
  const page=fakePage(RECEIVER_URL);
  page.win.top={};
  assert.equal(installCompanyEntryPreload({ipcRenderer:rendererIpc(),window:page.win}),null);
});

test('preload는 offer와 정확한 ready가 모두 있어야 bind를 보내고 phase는 문서 역할에서 정한다',t=>{
  const logs=quietConsole(t);
  const {page,ipc}=preloadPage(RECEIVER_URL);
  const documentId=crypto.randomUUID(),offer=offerFor(),ready=message('ready',{documentId,documentRole:'receiver'});
  ipc.emit(CHANNELS.offer,offer);
  page.dispatch({...ready,documentRole:'employee'});
  page.dispatch({...ready,documentRole:'customer'});
  page.dispatch({...ready,extra:1});
  page.dispatch({...ready,version:2});
  page.dispatch({...ready,channel:'other'});
  page.dispatch({...ready,documentId:'not-a-uuid'});
  page.dispatch(ready,{source:{}});
  page.dispatch(ready,{origin:'https://synk.im'});
  page.dispatch([ready]);
  page.attributes.set(CAPABILITY,'2');
  page.dispatch(ready);
  page.attributes.delete(CAPABILITY);
  page.dispatch(ready);
  assert.deepEqual(postsOf(page,'bind'),[]);
  page.attributes.set(CAPABILITY,'1');
  page.dispatch(ready);
  assert.deepEqual(postsOf(page,'bind'),[message('bind',{requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId,phase:'classify',expectedAccountId:offer.expectedAccountId})]);
  page.dispatch(message('ready',{documentId:crypto.randomUUID(),documentRole:'receiver'}));
  ipc.emit(CHANNELS.offer,offerFor());
  assert.equal(postsOf(page,'bind').length,1);
  assert.deepEqual(ipc.invokes,[]);
  assert.deepEqual(ipc.sent,[]);
  assert.deepEqual(logs,[]);
});

test('preload는 잘못된 offer를 받지 않고, offer 때 문서가 고정 문서가 아니면 바로 unavailable이다',()=>{
  const {page,ipc}=preloadPage(RECEIVER_URL);
  for(const payload of [{...offerFor(),extra:1},{...offerFor(),id:'short'},{...offerFor(),expectedAccountId:'x'},{...offerFor(),requestId:'x'},'id',null])ipc.emit(CHANNELS.offer,payload);
  ipc.emit(CHANNELS.offer,offerFor(),{senderId:7});
  assert.deepEqual(ipc.sent,[]);
  page.win.location.href=RECEIVER_URL+'#moved';
  const offer=offerFor();
  ipc.emit(CHANNELS.offer,offer);
  assert.deepEqual(ipc.sent,[resultOf(offer,null,'unavailable')]);
  assert.deepEqual(postsOf(page,'bind'),[]);
});

test('preload는 bound를 확인한 뒤 commit을 한 번만 요청하고 토큰은 offer 메시지에만 싣는다',async t=>{
  const logs=quietConsole(t);
  const {page,ipc}=preloadPage(EMPLOYEE_URL);
  const documentId=crypto.randomUUID(),offer=offerFor({expectedAccountId:null});
  page.dispatch(message('ready',{documentId,documentRole:'employee'}));
  ipc.emit(CHANNELS.offer,offer);
  const [bind]=postsOf(page,'bind');
  assert.equal(bind.phase,'deliver');
  assert.equal(bind.expectedAccountId,null);
  const bound=message('bound',{requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId,phase:'deliver'});
  page.dispatch({...bound,phase:'classify'});
  page.dispatch({...bound,documentId:crypto.randomUUID()});
  page.dispatch({...bound,requestId:crypto.randomUUID()});
  page.dispatch({...bound,expectedAccountId:null});
  page.dispatch(bound,{origin:'https://synk.im'});
  page.dispatch(bound,{source:{}});
  assert.equal(ipc.invokes.length,0);
  page.dispatch(bound);
  page.dispatch(bound);
  await settle(3);
  assert.equal(ipc.invokes.length,1);
  assert.equal(ipc.invokes[0].channel,CHANNELS.commit);
  assert.deepEqual(ipc.invokes[0].payload,{id:offer.id,requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId});
  assert.deepEqual(postsOf(page,'offer'),[]);
  ipc.invokes[0].resolve({id:offer.id,requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId,token:TOKEN});
  await settle(3);
  assert.deepEqual(postsOf(page,'offer'),[message('offer',{requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId,token:TOKEN})]);
  assert.equal(JSON.stringify(page.posted.filter(item=>item.type!=='offer')).includes(TOKEN),false);
  const ids={requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId};
  const received=message('received',{...ids,kind:'employee',destination:'/',state:'queued'});
  page.dispatch(message('classified',{...ids,kind:'employee',destination:'/'}));
  page.dispatch({...received,state:'done'});
  page.dispatch({...received,kind:'customer',destination:'/pulse-app/'});
  page.dispatch({...received,documentId:crypto.randomUUID()});
  page.dispatch({...received,token:TOKEN});
  page.dispatch(received,{source:{}});
  assert.deepEqual(ipc.sent,[]);
  page.dispatch(received);
  page.dispatch(received);
  assert.deepEqual(ipc.sent,[resultOf(offer,documentId,'delivered')]);
  assert.deepEqual(logs,[]);
});

test('receiver preload는 정확한 classified 두 조합만 결과로 바꾸고 received는 받지 않는다',async()=>{
  const {page,ipc,offer,ids,documentId}=await committedPage(RECEIVER_URL);
  page.dispatch(message('received',{...ids,kind:'employee',destination:'/',state:'queued'}));
  page.dispatch(message('classified',{...ids,kind:'employee',destination:'/pulse-app/'}));
  page.dispatch(message('classified',{...ids,kind:'customer',destination:'/'}));
  page.dispatch(message('classified',{...ids,kind:'admin',destination:'/'}));
  page.dispatch(message('classified',{...ids,kind:'customer',destination:'/pulse-app/',token:TOKEN}));
  assert.deepEqual(ipc.sent,[]);
  page.dispatch(message('classified',{...ids,kind:'customer',destination:'/pulse-app/'}));
  assert.deepEqual(ipc.sent,[resultOf(offer,documentId,'classified',{kind:'customer',destination:'/pulse-app/'})]);
  page.dispatch(message('classified',{...ids,kind:'employee',destination:'/'}));
  page.dispatch(message('error',{...ids,code:'BUSY',retryable:true}));
  assert.equal(ipc.sent.length,1);
});

test('commit이 거절되거나 응답 모양이 다르면 토큰을 보내지 않고 commit 전 실패로 알린다',async()=>{
  const answers=[
    ()=>null,()=>TOKEN,good=>({...good,extra:1}),good=>({...good,token:'short'}),good=>({...good,token:TOKEN+'!'}),
    good=>({...good,documentId:crypto.randomUUID()}),good=>({...good,id:'y'.repeat(32)}),good=>({...good,requestId:crypto.randomUUID()}),
  ];
  for(const answer of answers){
    const {page,ipc,offer,good}=boundPage(RECEIVER_URL);
    ipc.invokes[0].resolve(answer(good));
    await settle(3);
    assert.deepEqual(postsOf(page,'offer'),[]);
    assert.deepEqual(ipc.sent,[resultOf(offer,null,'not-received')]);
  }
  const {page,ipc,offer}=boundPage(RECEIVER_URL);
  ipc.invokes[0].reject(new Error('거절 '+TOKEN));
  await settle(3);
  assert.deepEqual(postsOf(page,'offer'),[]);
  assert.deepEqual(ipc.sent,[resultOf(offer,null,'not-received')]);
});

test('pagehide 뒤에는 늦은 bound와 commit 응답을 무시하고 토큰을 보내지 않는다',async()=>{
  {
    const {page,ipc}=preloadPage(RECEIVER_URL);
    const documentId=crypto.randomUUID(),offer=offerFor();
    page.dispatch(message('ready',{documentId,documentRole:'receiver'}));
    ipc.emit(CHANNELS.offer,offer);
    page.hide();
    assert.deepEqual(ipc.sent,[resultOf(offer,null,'not-received')]);
    page.dispatch(message('bound',{requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId,phase:'classify'}));
    assert.equal(ipc.invokes.length,0);
    // 문서가 되살아나 새 ready를 보내도 그 문서는 새 offer를 받지 않는다.
    page.dispatch(message('ready',{documentId:crypto.randomUUID(),documentRole:'receiver'}));
    ipc.emit(CHANNELS.offer,offerFor());
    assert.equal(postsOf(page,'bind').length,1);
  }
  {
    const {page,ipc,offer,documentId,good}=boundPage(EMPLOYEE_URL);
    page.hide();
    assert.deepEqual(ipc.sent,[resultOf(offer,documentId,'not-received')]);
    ipc.invokes[0].resolve(good);
    await settle(3);
    assert.deepEqual(postsOf(page,'offer'),[]);
    assert.equal(ipc.sent.length,1);
  }
  {
    const {page,ipc,offer,documentId,ids}=await committedPage(EMPLOYEE_URL);
    page.hide();
    assert.deepEqual(ipc.sent,[resultOf(offer,documentId,'not-received')]);
    page.dispatch(message('received',{...ids,kind:'employee',destination:'/',state:'queued'}));
    assert.equal(ipc.sent.length,1);
  }
});

test('문서 오류는 commit 전이면 documentId null, commit 뒤면 그 documentId로 실패를 알린다',async()=>{
  {
    const {page,ipc}=preloadPage(RECEIVER_URL);
    const documentId=crypto.randomUUID(),offer=offerFor();
    page.dispatch(message('ready',{documentId,documentRole:'receiver'}));
    ipc.emit(CHANNELS.offer,offer);
    const ids={requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId};
    page.dispatch(message('error',{...ids,code:'NOT_A_CODE',retryable:true}));
    page.dispatch(message('error',{...ids,code:'BUSY',retryable:'yes'}));
    page.dispatch(message('error',{...ids,documentId:crypto.randomUUID(),code:'BUSY',retryable:true}));
    page.dispatch(message('error',{...ids,code:'BUSY',retryable:true,detail:'서버 원문'}));
    assert.deepEqual(ipc.sent,[]);
    page.dispatch(message('error',{...ids,code:'BUSY',retryable:true}));
    assert.deepEqual(ipc.sent,[resultOf(offer,null,'not-received')]);
  }
  {
    // commit 뒤 receiver의 정해진 분류 실패는 그 documentId와 원인을 싣고, 그 밖의 오류는 원인 없는 not-received다.
    const {page,ipc,offer,documentId,ids}=await committedPage(RECEIVER_URL);
    page.dispatch(message('error',{...ids,code:'INVITE_REJECTED',retryable:false}));
    assert.deepEqual(ipc.sent,[resultOf(offer,documentId,'classify-failed',{code:'INVITE_REJECTED',retryable:false})]);
    const other=await committedPage(RECEIVER_URL);
    other.page.dispatch(message('error',{...other.ids,code:'ACCOUNT_MISMATCH',retryable:false}));
    assert.deepEqual(other.ipc.sent,[resultOf(other.offer,other.documentId,'not-received')]);
  }
  {
    const {page,ipc,offer,documentId,ids,good}=boundPage(EMPLOYEE_URL);
    page.dispatch(message('error',{...ids,code:'ACCOUNT_MISMATCH',retryable:false}));
    assert.deepEqual(ipc.sent,[]);
    ipc.invokes[0].resolve(good);
    await settle(3);
    assert.deepEqual(postsOf(page,'offer'),[]);
    assert.deepEqual(ipc.sent,[resultOf(offer,documentId,'not-received')]);
  }
});

test('receiver preload는 토큰을 보낸 뒤의 분류 실패 중 정해진 code와 retryable 짝만 결과에 싣는다',async t=>{
  const logs=quietConsole(t);
  for(const [code,retryable] of [['INVITE_REJECTED',false],['RATE_LIMITED',true],['TEMPORARY_UNAVAILABLE',true]]){
    const {page,ipc,offer,documentId,ids}=await committedPage(RECEIVER_URL);
    // 다른 키가 붙었거나, 다른 창·origin·문서·요청에서 온 오류는 받지 않는다.
    page.dispatch(message('error',{...ids,code,retryable,detail:'서버 원문'}));
    page.dispatch(message('error',{...ids,code,retryable,token:TOKEN}));
    page.dispatch(message('error',{...ids,code,retryable}),{origin:'https://synk.im'});
    page.dispatch(message('error',{...ids,code,retryable}),{source:{}});
    page.dispatch(message('error',{...ids,documentId:crypto.randomUUID(),code,retryable}));
    page.dispatch(message('error',{...ids,requestId:crypto.randomUUID(),code,retryable}));
    assert.deepEqual(ipc.sent,[],code);
    page.dispatch(message('error',{...ids,code,retryable}));
    // 결과는 한 번뿐이다.
    page.dispatch(message('error',{...ids,code:'BUSY',retryable:true}));
    page.dispatch(message('classified',{...ids,kind:'employee',destination:'/'}));
    assert.deepEqual(ipc.sent,[resultOf(offer,documentId,'classify-failed',{code,retryable})],code);
  }
  // 짝이 맞지 않거나 분류 실패가 아닌 code, 고정 문서가 아니게 된 문서의 분류 실패는 원인 없는 not-received다.
  for(const [code,retryable,moved] of [['INVITE_REJECTED',true],['RATE_LIMITED',false],['TEMPORARY_UNAVAILABLE',false],['INVALID_INPUT',false],['ACCOUNT_MISMATCH',false],['BUSY',true],['HANDOFF_UNAVAILABLE',true],['INVITE_REJECTED',false,true]]){
    const {page,ipc,offer,documentId,ids}=await committedPage(RECEIVER_URL);
    if(moved)page.win.location.href=RECEIVER_URL+'#moved';
    page.dispatch(message('error',{...ids,code,retryable}));
    assert.deepEqual(ipc.sent,[resultOf(offer,documentId,'not-received')],`${code} ${retryable} ${moved===true}`);
  }
  // 토큰을 문서에 보내기 전의 오류는 정해진 짝이어도 원인을 싣지 않는다. commit 전과 commit 응답을 기다리는 사이가 그렇다.
  {
    const {page,ipc}=preloadPage(RECEIVER_URL);
    const documentId=crypto.randomUUID(),offer=offerFor();
    page.dispatch(message('ready',{documentId,documentRole:'receiver'}));
    ipc.emit(CHANNELS.offer,offer);
    page.dispatch(message('error',{requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId,code:'INVITE_REJECTED',retryable:false}));
    assert.deepEqual(ipc.sent,[resultOf(offer,null,'not-received')]);
  }
  {
    const {page,ipc,offer,documentId,ids,good}=boundPage(RECEIVER_URL);
    page.dispatch(message('error',{...ids,code:'RATE_LIMITED',retryable:true}));
    assert.deepEqual(ipc.sent,[]);
    ipc.invokes[0].resolve(good);
    await settle(3);
    assert.deepEqual(postsOf(page,'offer'),[]);
    assert.deepEqual(ipc.sent,[resultOf(offer,documentId,'not-received')]);
  }
  // employee 문서의 오류는 최종 전달의 실패라 원인을 싣지 않는다. main은 최종 commit 뒤를 미확인으로 끝낸다.
  for(const [code,retryable] of [['INVITE_REJECTED',false],['RATE_LIMITED',true],['TEMPORARY_UNAVAILABLE',true]]){
    const {page,ipc,offer,documentId,ids}=await committedPage(EMPLOYEE_URL);
    page.dispatch(message('error',{...ids,code,retryable}));
    assert.deepEqual(ipc.sent,[resultOf(offer,documentId,'not-received')],code);
  }
  assert.deepEqual(logs,[]);
});

test('commit을 기다리는 사이 capability가 사라지면 토큰을 보내지 않는다',async()=>{
  const {page,ipc,offer,documentId,good}=boundPage(EMPLOYEE_URL);
  page.attributes.delete(CAPABILITY);
  ipc.invokes[0].resolve(good);
  await settle(3);
  assert.deepEqual(postsOf(page,'offer'),[]);
  assert.deepEqual(ipc.sent,[resultOf(offer,documentId,'not-received')]);
});

// ── main 연결용 경계 ──

test('preload는 고정 두 문서에만, 리스너보다 먼저, 메서드 없는 synkCompanyEntryHost 표시 하나를 내보인다',()=>{
  for(const url of [RECEIVER_URL,EMPLOYEE_URL]){
    const page=fakePage(url),ipc=rendererIpc(),order=[],exposed=[];
    const listen=page.win.addEventListener.bind(page.win),subscribe=ipc.on.bind(ipc);
    page.win.addEventListener=(type,fn)=>{order.push('listen:'+type);listen(type,fn);};
    ipc.on=(channel,fn)=>{order.push('ipc:'+channel);subscribe(channel,fn);};
    const contextBridge={exposeInMainWorld:(name,value)=>{order.push('expose');exposed.push([name,value]);}};
    assert.deepEqual(installCompanyEntryPreload({ipcRenderer:ipc,contextBridge,window:page.win}),{role:url===RECEIVER_URL?'receiver':'employee'});
    assert.equal(order[0],'expose',url);
    assert.deepEqual(order.slice(1).sort(),['ipc:'+CHANNELS.offer,'listen:message','listen:pagehide'].sort(),url);
    assert.equal(exposed.length,1);
    const [[name,marker]]=exposed;
    assert.equal(name,'synkCompanyEntryHost');
    assert.deepEqual({...marker},{version:1});
    assert.equal(Object.isFrozen(marker),true);
    assert.deepEqual(Reflect.ownKeys(marker),['version']);
  }
  // 다른 문서, 쿼리나 조각이 붙은 문서, 하위 프레임에는 표시가 없다.
  for(const url of [RECEIVER_URL+'?a=1',`${EMPLOYEE_URL}#invite=${TOKEN}`,'https://workspace.synk.im/pulse-app/','https://workspace.synk.im/join','https://example.com/entry/']){
    const exposed=[];
    assert.equal(installCompanyEntryPreload({ipcRenderer:rendererIpc(),contextBridge:{exposeInMainWorld:(...args)=>exposed.push(args)},window:fakePage(url).win}),null,url);
    assert.deepEqual(exposed,[],url);
  }
  const framed=fakePage(EMPLOYEE_URL),exposed=[];
  framed.win.top={};
  installCompanyEntryPreload({ipcRenderer:rendererIpc(),contextBridge:{exposeInMainWorld:(...args)=>exposed.push(args)},window:framed.win});
  assert.deepEqual(exposed,[]);
  // 표시를 내보이지 못해도 인계는 그대로 설치된다.
  assert.deepEqual(installCompanyEntryPreload({ipcRenderer:rendererIpc(),contextBridge:{exposeInMainWorld(){throw new Error('이미 있음');}},window:fakePage(EMPLOYEE_URL).win}),{role:'employee'});
});

test('화면은 주소, partition, 프로필, 계정 ID를 고르지 못한다',async()=>{
  const h=manual(),ids=idsFor(h);
  for(const extra of [{url:'https://evil.invalid/'},{partition:'persist:other'},{profile:'Default'},{expectedAccountId:ACCOUNT},{accountId:crypto.randomUUID()},{destination:'/'},{phase:'deliver'}]){
    assert.deepEqual(await h.manager.handoffLink({href:LINK,...ids,...extra}),{ok:false,...ids,code:'INVALID_INPUT',retryable:false},JSON.stringify(extra));
    assert.deepEqual(await h.manager.inspectCode({code:TOKEN,...ids,...extra}),{ok:false,...ids,code:'INVALID_INPUT',retryable:false},JSON.stringify(extra));
  }
  assert.equal(h.electron.windows.length,0);
});

test('쓰던 글 확인을 걸지 않은 겉에는 회사 입구가 저장하지 않은 입력을 버리기 전에 묻고, 남기면 진행 중인 앱 종료를 멈춘다',async()=>{
  const answers=[],dialogs=[];let kept=0;
  const h=manual({dialog:{showMessageBoxSync:(win,options)=>{dialogs.push({win,options});return answers.shift();}},onUnloadKept:()=>{kept+=1;}});
  track(h.manager.handoffLink({href:LINK,...idsFor(h)}));
  await settle(5);
  const [win]=h.electron.windows;
  assert.equal(win.workspaceGuarded,undefined);
  const unload=target=>{const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};target.webContents.emit('will-prevent-unload',event);return event.defaultPrevented;};
  answers.push(0);assert.equal(unload(win),false);assert.equal(kept,1);
  answers.push(1);assert.equal(unload(win),true);assert.equal(kept,1);
  assert.equal(dialogs.length,2);
  assert.equal(dialogs[0].win,win);
  assert.equal(dialogs[0].options.title,'SYNK Workspace');
  assert.deepEqual(dialogs[0].options.buttons,['돌아가서 저장','저장하지 않고 나가기']);
  assert.equal(dialogs[0].options.cancelId,0);
  win.destroy();unload(win);
  assert.equal(dialogs.length,2);assert.equal(kept,1);
  // dialog가 없으면 묻지 못하지만, 페이지가 남긴 입력은 그대로 앱 종료를 멈춘다.
  let quiet=0;
  const g=manual({onUnloadKept:()=>{quiet+=1;}});
  track(g.manager.handoffLink({href:LINK,...idsFor(g)}));
  await settle(5);
  assert.equal(unload(g.electron.windows[0]),false);assert.equal(quiet,1);
  // onUnloadKept의 오류는 창을 깨뜨리지 않는다.
  const broken=manual({onUnloadKept:()=>{throw new Error('합성 오류');}});
  track(broken.manager.handoffLink({href:LINK,...idsFor(broken)}));
  await settle(5);
  assert.doesNotThrow(()=>unload(broken.electron.windows[0]));
});

test('회사 창 partition은 확인된 계정이나 guest와 그 계정 세대에 묶인 메모리 partition이다',()=>{
  const generation=crypto.randomUUID(),next=crypto.randomUUID(),other=crypto.randomUUID();
  const own=companyEntryPartition(signedIn({accountGeneration:generation}));
  assert.match(own,/^synk-company-entry-[0-9a-f]{40}$/);
  // 같은 계정, 같은 세대는 epoch가 달라도(토큰 갱신) 같은 partition이다.
  assert.equal(companyEntryPartition(signedIn({accountGeneration:generation,epoch:9})),own);
  const names=[own,companyEntryPartition(signedIn({accountGeneration:next})),companyEntryPartition(signedIn({accountGeneration:generation,expectedAccountId:other})),companyEntryPartition(signedIn({accountGeneration:generation,status:'signed-out',expectedAccountId:null}))];
  assert.equal(new Set(names).size,4);
  for(const name of names){assert.equal(name.startsWith('persist:'),false);assert.equal(name.includes(ACCOUNT),false);assert.equal(name.includes(generation),false);}
  const {pulseAppPartition}=require('../src/pulse-app.cjs');
  assert.equal(names.includes(pulseAppPartition('account:'+ACCOUNT)),false);
  assert.equal(names.includes(pulseAppPartition('guest')),false);
  for(const binding of [signedIn({status:'restoring'}),signedIn({status:'error'}),signedIn({expectedAccountId:null}),signedIn({status:'signed-out'}),signedIn({accountGeneration:'not-a-uuid'}),signedIn({expectedAccountId:'synthetic-owner-a'}),null,{},'guest'])
    assert.equal(companyEntryPartition(binding),null,JSON.stringify(binding));
});

function fakeJars(){
  const jars=new Map(),cleared=[];
  const session={fromPartition(partition){
    if(!jars.has(partition)){
      const jar=new EventEmitter();
      Object.assign(jar,{partition,secured:0,permission:null,check:null,filter:null,
        setPermissionRequestHandler(fn){jar.permission=fn;jar.secured+=1;},setPermissionCheckHandler(fn){jar.check=fn;},
        webRequest:{onBeforeRequest:(filter,fn)=>{jar.filter={filter,fn};}},
        async clearStorageData(){cleared.push(partition);},async clearCache(){cleared.push(partition+':cache');}});
      jars.set(partition,jar);
    }
    return jars.get(partition);
  }};
  return {session,jars,cleared};
}

test('main의 partition 고르기는 처음 쓰는 partition만 잠그고, 지금 세대가 아닌 partition의 저장소만 지운다',async()=>{
  let binding=signedIn();
  const {session,jars,cleared}=fakeJars();
  const partitions=createCompanyEntryPartitions({session,getBinding:()=>binding});
  const first=partitions.select(binding);
  assert.equal(first,companyEntryPartition(binding));
  assert.equal(partitions.select({...binding,epoch:binding.epoch+1}),first);
  const jar=jars.get(first);
  assert.equal(jar.secured,1);
  let permitted=null;
  jar.permission({},'media',value=>{permitted=value;});
  assert.equal(permitted,false);
  assert.equal(jar.check({},'notifications'),false);
  assert.deepEqual(jar.filter.filter,{urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']});
  const cancelled=details=>{let answer=null;jar.filter.fn(details,value=>{answer=value;});return answer.cancel;};
  assert.equal(cancelled({url:RECEIVER_URL,resourceType:'mainFrame'}),false);
  assert.equal(cancelled({url:'https://synk.im/id/',resourceType:'mainFrame'}),true);
  const download={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
  jar.emit('will-download',download);
  assert.equal(download.defaultPrevented,true);
  // 같은 세대의 토큰 갱신이나 읽지 못한 결속은 아무것도 지우지 않는다.
  binding={...binding,status:'restoring',expectedAccountId:null};partitions.sync();
  binding=null;partitions.sync();
  await settle(5);
  assert.deepEqual(cleared,[]);
  // 로그아웃은 새 세대다. guest는 다른 partition을 쓰고, 이전 세대 partition의 저장소와 캐시만 지운다.
  binding=signedIn({status:'signed-out',expectedAccountId:null});
  const guest=partitions.select(binding);
  assert.notEqual(guest,first);
  partitions.sync();
  await settle(5);
  assert.deepEqual(cleared,[first,first+':cache']);
  partitions.sync();
  await settle(5);
  assert.equal(cleared.length,2);
  // 잠그지 못하면 partition을 내주지 않고, 관리자는 창을 열지 않고 끝낸다.
  const broken=[
    null,{},{fromPartition(){throw new Error('없음');}},
    {fromPartition:()=>({setPermissionRequestHandler(){throw new Error('잠그지 못함');}})},
    {fromPartition:()=>({setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onBeforeRequest(){throw new Error('거르지 못함');}},on(){}})},
    {fromPartition:()=>({setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onBeforeRequest(){}}})},
  ];
  for(const value of broken){
    const selecting=createCompanyEntryPartitions({session:value,getBinding:()=>signedIn()});
    assert.equal(selecting.select(signedIn()),null);
    const h=manual({selectCompanyPartition:candidate=>selecting.select(candidate)}),ids=idsFor(h);
    assert.deepEqual(await h.manager.inspectCode({code:TOKEN,...ids}),{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false});
    assert.equal(h.electron.windows.length,0);
  }
});

test('회사 창의 요청은 고정 회사 문서와 그 자원, 회사 문서가 청한 그림과 영상만 지난다',()=>{
  const allowed=[
    {url:RECEIVER_URL,resourceType:'mainFrame'},{url:EMPLOYEE_URL,resourceType:'mainFrame'},{url:'https://workspace.synk.im/join',resourceType:'mainFrame'},
    {url:'https://workspace.synk.im/api/invite/inspect',resourceType:'xhr'},{url:'https://workspace.synk.im/entry/receiver.js',resourceType:'script'},
    {url:'wss://workspace.synk.im/socket',resourceType:'webSocket'},
    {url:'https://images.example.com/a.png',resourceType:'image',referrer:EMPLOYEE_URL},{url:'https://media.example.com/a.mp4',resourceType:'media',referrer:RECEIVER_URL,initiatorOrigin:'https://workspace.synk.im'},
  ];
  const refused=[
    {url:RECEIVER_URL,resourceType:'subFrame'},{url:'https://synk.im/id/',resourceType:'mainFrame'},{url:'http://workspace.synk.im/',resourceType:'mainFrame'},
    {url:'https://user@workspace.synk.im/',resourceType:'mainFrame'},{url:'https://workspace.synk.im:8443/',resourceType:'mainFrame'},
    {url:'https://synk.im/api/account',resourceType:'xhr'},{url:'https://evil.invalid/x.js',resourceType:'script',referrer:EMPLOYEE_URL},
    {url:'ws://workspace.synk.im/socket',resourceType:'webSocket'},{url:'https://user:pw@workspace.synk.im/api',resourceType:'xhr'},
    {url:'https://images.example.com/a.png',resourceType:'image',referrer:'https://evil.invalid/'},{url:'https://images.example.com/a.png',resourceType:'image'},
    {url:'https://images.example.com/a.png',resourceType:'image',referrer:EMPLOYEE_URL,initiatorOrigin:'https://evil.invalid'},
    {url:'http://images.example.com/a.png',resourceType:'image',referrer:EMPLOYEE_URL},{url:'not a url',resourceType:'xhr'},{resourceType:'xhr'},null,
  ];
  for(const details of allowed)assert.equal(companyEntryRequestAllowed(details),true,JSON.stringify(details));
  for(const details of refused)assert.equal(companyEntryRequestAllowed(details),false,JSON.stringify(details));
});

test('PULSE 관리자의 답은 같은 요청의 정확한 두 모양만 계약 code로 바뀌고, 나머지는 미확인이 된다',()=>{
  const ids={requestId:crypto.randomUUID(),accountGeneration:crypto.randomUUID()};
  const fail=(code,retryable)=>({ok:false,...ids,code,retryable});
  assert.deepEqual(companyAnswerFromPulse({ok:true,...ids,state:'received',destination:'/pulse-app/'}),{ok:true,...ids,state:'received',destination:'/pulse-app/'});
  const table=[
    ['PULSE_APP_UNAVAILABLE',false,'HANDOFF_UNAVAILABLE',false],['SUITE_UNAVAILABLE',true,'TEMPORARY_UNAVAILABLE',true],['PULSE_APP_INVITE_INVALID',false,'INVALID_INPUT',false],
    ['PULSE_APP_ACCOUNT_PENDING',true,'TEMPORARY_UNAVAILABLE',true],['PULSE_APP_ACCOUNT_CHANGED',false,'ACCOUNT_CHANGED',false],['PULSE_APP_BUSY',true,'BUSY',true],
    ['PULSE_APP_STORAGE_UNAVAILABLE',true,'TEMPORARY_UNAVAILABLE',true],['PULSE_APP_OPEN_FAILED',true,'HANDOFF_UNAVAILABLE',true],['PULSE_APP_DEMO_ACTIVE',false,'HANDOFF_UNAVAILABLE',false],
    ['PULSE_APP_INVITE_RECEIVER_UNAVAILABLE',true,'HANDOFF_UNAVAILABLE',true],['PULSE_APP_INVITE_FAILED',true,'HANDOFF_UNAVAILABLE',true],['PULSE_APP_INVITE_UNCONFIRMED',false,UNCONFIRMED_CODE,false],
    ['PULSE_APP_INVITE_UNCONFIRMED',true,UNCONFIRMED_CODE,false],
    // PULSE가 토큰을 문서에 내주기 전의 취소(pulse-app.cjs cancelInvite).
    ['CANCELLED',true,'CANCELLED',true],
  ];
  for(const [code,retryable,expected,expectedRetryable] of table)assert.deepEqual(companyAnswerFromPulse(fail(code,retryable)),fail(expected,expectedRetryable),code);
  for(const value of [fail('SOMETHING_ELSE',true),fail('__proto__',true),fail('constructor',true),{...fail('PULSE_APP_BUSY',true),token:TOKEN},{ok:false,...ids,code:'PULSE_APP_BUSY'},{...fail('PULSE_APP_BUSY','yes')},
    {ok:true,id:'pulse',independentWindow:true},{ok:true,...ids,state:'received',destination:'/pulse-app/',invite:'opened'},null,undefined,'ok',[fail('PULSE_APP_BUSY',true)]])
    assert.equal(companyAnswerFromPulse(value),null,JSON.stringify(value));
});

test('main이 관리자 전에 거절할 때는 정확한 UUID로 밝힌 요청만 되돌리고 접근자를 읽지 않는다',()=>{
  const ids={requestId:crypto.randomUUID(),accountGeneration:crypto.randomUUID()};
  assert.deepEqual(entryRefusal({href:LINK,...ids},'HANDOFF_UNAVAILABLE',false),{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false});
  assert.deepEqual(entryRefusal({...ids},'TEMPORARY_UNAVAILABLE',true),{ok:false,...ids,code:'TEMPORARY_UNAVAILABLE',retryable:true});
  let read=0;
  const accessor=Object.defineProperty({accountGeneration:ids.accountGeneration},'requestId',{get(){read+=1;return ids.requestId;},enumerable:true});
  const values=[accessor,{requestId:'x',accountGeneration:2},{requestId:ids.requestId.toUpperCase(),accountGeneration:null},null,undefined,[ids.requestId],'x'];
  values.forEach((value,index)=>assert.equal(entryRefusal(value,'HANDOFF_UNAVAILABLE',false).requestId,null,'입력 '+index));
  assert.equal(read,0);
  assert.equal(entryRefusal(accessor,'HANDOFF_UNAVAILABLE',false).accountGeneration,ids.accountGeneration);
});

test('main의 결속은 auth 상태에서만 만들고, 확정 로그인만 SYNK ID를 싣는다',()=>{
  const generation=crypto.randomUUID(),member={configured:true,status:'signed-in',signedIn:true,sessionGeneration:3,account:{synk_user_id:ACCOUNT,display_name:'합성'},error:null};
  const read=(state,...values)=>readBinding(()=>bindingFromAuth(state,values.length?values[0]:generation));
  assert.deepEqual({...read(member)},{accountGeneration:generation,expectedAccountId:ACCOUNT,epoch:3,status:'signed-in'});
  // auth의 discard(code)가 남기는 다시 시도할 수 없는 이유와, 다시 시도할 수 있는 실패의 실제 모양(auth-service.cjs publicError).
  const reason=code=>publicError({code}),retrying=code=>publicError({code,retryable:true});
  const signedOut={...member,status:'signed-out',signedIn:false,account:null};
  const cases=[
    [{...member,status:'restoring',signedIn:false,account:null},'restoring'],
    [{...member,status:'signing-in',signedIn:false,account:null},'restoring'],
    [{...member,status:'signed-in',signedIn:false},'restoring'],
    [{...member,status:'error',signedIn:false,account:null,error:{code:'NETWORK'}},'error'],
    [{...member,status:'error',signedIn:false,account:null,error:retrying('NETWORK')},'error'],
    [{...member,status:'restoring',signedIn:false,account:null,error:retrying('AUTH_SERVER_UNAVAILABLE')},'error'],
    // 다시 시도할 수 없어도 status error는 손님이 아니다(시작 때 암호화 저장소를 쓸 수 없는 경우, suite가 로그인을 가린 경우).
    [{...member,status:'error',signedIn:false,account:null,error:reason('SECURE_STORAGE_UNAVAILABLE')},'error'],
    [{...member,status:'error',signedIn:false,account:null,error:{code:'SUITE_UNAVAILABLE',message:'합성',retryable:true}},'error'],
    // 다시 시도할 수 있는 오류가 남은 로그아웃 표시는 확정이 아니다. 플랫폼 결속이 로그아웃을 알렸지만 auth가 아직 재시도를 기다리는 사이다.
    [{...signedOut,error:retrying('NETWORK')},'error'],
    [{...signedOut,status:'unconfigured',configured:false,error:retrying('NETWORK')},'error'],
    // 모양을 알 수 없는 오류와 계정이 남은 로그아웃 표시도 확정이 아니다.
    [{...signedOut,error:'AUTH_REQUIRED'},'error'],
    [{...signedOut,error:[reason('AUTH_REQUIRED')]},'error'],
    [{...member,status:'signed-out',signedIn:false},'restoring'],
    [{...member,status:'signed-out',signedIn:false,error:reason('AUTH_REQUIRED')},'error'],
    [{...signedOut,signedIn:undefined},'restoring'],
    // 확정 로그아웃과 미설정은 손님이다. 세션 만료·폐기, 로그인 취소, 시간 초과처럼 세션을 비운 뒤 남은 이유 표시는 손님을 막지 않는다.
    [signedOut,'signed-out'],
    [{...member,status:'unconfigured',signedIn:false,account:null,configured:false},'signed-out'],
    ...['AUTH_REQUIRED','AUTH_CANCELLED','AUTH_TIMEOUT','AUTH_FAILED','CALLBACK_UNAVAILABLE','SECURE_STORAGE_UNAVAILABLE'].map(code=>[{...signedOut,error:reason(code)},'signed-out']),
    [{...signedOut,error:{code:'AUTH_REQUIRED'}},'signed-out'],
    [{...signedOut,error:{code:'AUTH_REQUIRED',retryable:false}},'signed-out'],
    [{...member,status:'unconfigured',signedIn:false,account:null,configured:false,error:reason('AUTH_CONFIG')},'signed-out'],
  ];
  for(const [state,status] of cases)assert.deepEqual({...read(state)},{accountGeneration:generation,expectedAccountId:null,epoch:3,status},JSON.stringify(state));
  // 세대가 없거나(묶음 로그인이 가림) 숫자 epoch가 없거나 SYNK ID가 UUID가 아니면 결속이 없다.
  for(const [state,value] of [[member,null],[member,undefined],[member,'2'],[{...member,sessionGeneration:'3'},generation],[{...member,account:{synk_user_id:'synthetic-owner-a'}},generation],[null,generation],['signed-in',generation]])
    assert.equal(read(state,value),null);
});

// ── 실제 auth 상태로 만든 결속 ──
// main의 companyBinding과 같은 길이다. 실제 auth 서비스의 상태와 그 세대를 bindingFromAuth에 넣는다. 금고와 서버는 메모리 가짜이고,
// 로그인 창, 콜백 서버, 실제 계정, 네트워크는 쓰지 않는다.
const SYNTHETIC_AUTH=Object.freeze({supabaseUrl:'https://synthetic.invalid',accountApiUrl:'https://synthetic.invalid',publishableKey:'synthetic-public',clientId:'synthetic-client',product:'platform',redirectUri:'http://127.0.0.1:0/callback'});
const SAVED_SIGN_IN=Object.freeze({refreshToken:'synthetic-refresh-saved',subject:'synthetic-auth-subject'});
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
// tokens는 토큰 요청마다 차례로 쓰는 답이다. issued는 새 토큰, rejected는 서버의 거절(400 invalid_grant), offline은 연결 실패다.
function syntheticAuth(t,{load=async()=>({...SAVED_SIGN_IN}),clear=()=>undefined,tokens=[]}={}){
  let clock=1000000;
  const counts={save:0,clear:0},unexpected=[];
  const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  const fetcher=async url=>{
    const route=new URL(url).pathname,next=route==='/auth/v1/oauth/token'?tokens.shift():null;
    if(next==='issued')return reply(200,{token_type:'bearer',access_token:'synthetic-access',refresh_token:'synthetic-refresh-next',expires_in:3600});
    if(next==='rejected')return reply(400,{error:'invalid_grant'});
    if(next==='offline')throw new Error('합성 연결 끊김');
    if(route==='/auth/v1/user')return reply(200,{id:SAVED_SIGN_IN.subject});
    if(route==='/functions/v1/synk-account')return reply(200,{ok:true,account:{synk_user_id:ACCOUNT,status:'active',profile:{display_name:'합성 계정'}},sessions:[],memberships:[],entitlements:[]});
    unexpected.push(route);
    throw new Error('준비하지 않은 요청');
  };
  const store={available:()=>true,load,save:async()=>{counts.save+=1;},clear:()=>{counts.clear+=1;return clear(counts.clear);}};
  const service=createAuthService({config:SYNTHETIC_AUTH,store,fetcher,now:()=>clock,openExternal:async()=>{unexpected.push('openExternal');throw new Error('로그인 창을 열지 않는다');}});
  t.after(()=>service.dispose());
  return {service,counts,unexpected,advance:ms=>{clock+=ms;},binding:()=>bindingFromAuth(service.status(),service.accountGeneration())};
}
// 배정 조회의 첫 판단만 본다. 확정 손님과 확정되지 않은 결속은 토큰을 읽거나 서버에 묻기 전에 끝난다.
function lookupFor(getBinding){
  return createCompanyEntryDestinations({getBinding,getAccessToken:async()=>{throw new Error('토큰을 읽지 않는다');},fetcher:async()=>{throw new Error('서버에 묻지 않는다');}});
}
// receiver는 OTHER_TOKEN을 고객 초대로, 그 밖의 코드를 직원 초대로 분류한다.
const byToken=token=>(token===OTHER_TOKEN?{kind:'customer',destination:'/pulse-app/'}:{kind:'employee',destination:'/'});

test('세션 만료로 auth가 로그아웃을 확정하면 남은 AUTH_REQUIRED와 관계없이 확정 손님의 고객 초대는 넘어가고 직원 초대는 로그인이 필요하다고 답한다',async t=>{
  const auth=syntheticAuth(t,{tokens:['issued','offline','rejected']});
  const jars=fakeJars();
  let h=null;
  const partitions=createCompanyEntryPartitions({session:jars.session,getBinding:()=>h.binding});
  await auth.service.initialize();
  const member=auth.binding(),first=member.accountGeneration;
  assert.deepEqual(member,{accountGeneration:first,expectedAccountId:ACCOUNT,epoch:0,status:'signed-in'});
  h=integrated({binding:member,selectCompanyPartition:binding=>partitions.select(binding),scripts:{[RECEIVER_URL]:companyScript('receiver',{classify:byToken}),[EMPLOYEE_URL]:companyScript('employee')}});
  // main의 publishAuthState처럼 auth가 바뀔 때마다 결속을 다시 읽고 관리자와 partition을 맞춘다.
  const publish=()=>{h.setBinding(auth.binding());h.manager.syncAccount();partitions.sync();};
  // 회원의 맨 코드는 그 계정 partition의 숨은 창에서 분류되고, Workspace 겉의 직원 문서에서 실제 큐에 들어간다.
  const memberIds=idsFor(h);
  assert.deepEqual(await within(h.manager.inspectCode({code:TOKEN,...memberIds})),{ok:true,...memberIds,state:'received',destination:'/'});
  const [memberReceiver,memberWindow]=h.electron.windows,memberPartition=companyEntryPartition(member);
  assert.equal(memberReceiver.options.webPreferences.partition,memberPartition);
  assert.equal(memberReceiver.isDestroyed(),true);
  assert.equal(memberWindow.options.webPreferences.partition,WORKSPACE_PARTITION);
  assert.equal(h.surfaces.length,1);
  for(const doc of h.documents)assert.equal(offersOf(doc.frame)[0].expectedAccountId,ACCOUNT);

  // 같은 계정의 토큰 갱신이 다시 시도할 수 있게 실패했다. 세대는 그대로이고 결속은 error라 손님이 아니다.
  // 그 계정의 회사 창과 저장소, 저장된 로그인은 남고 새 인계와 조회는 다시 시도하라는 답으로 막힌다.
  auth.advance(3600*1000);
  await assert.rejects(auth.service.getAccessToken(),{code:'NETWORK'});
  assert.equal(auth.service.status().status,'error');
  publish();
  assert.deepEqual(h.binding,{accountGeneration:first,expectedAccountId:null,epoch:0,status:'error'});
  assert.equal(companyEntryPartition(h.binding),null);
  await settle(5);
  assert.equal(memberWindow.isDestroyed(),false);
  assert.deepEqual(jars.cleared,[]);
  const waitingInspect=idsFor(h),waitingLink=idsFor(h),waitingLookup=idsFor(h);
  assert.deepEqual(await h.manager.inspectCode({code:TOKEN,...waitingInspect}),{ok:false,...waitingInspect,code:'TEMPORARY_UNAVAILABLE',retryable:true});
  assert.deepEqual(await h.manager.handoffLink({href:LINK,...waitingLink}),{ok:false,...waitingLink,code:'TEMPORARY_UNAVAILABLE',retryable:true});
  assert.deepEqual(await lookupFor(()=>h.binding).resolve(waitingLookup),{ok:false,...waitingLookup,code:'TEMPORARY_UNAVAILABLE',retryable:true});
  assert.equal(h.electron.windows.length,2);
  assert.equal(h.surfaces.length,1);
  assert.equal(auth.counts.clear,0);

  // 서버가 그 세션을 거절했다. auth는 세션과 금고를 비우고 새 세대의 로그아웃을 확정하며, 그 이유로 AUTH_REQUIRED를 남긴다.
  await assert.rejects(auth.service.getAccessToken(),{code:'AUTH_REQUIRED'});
  const expired=auth.service.status();
  assert.deepEqual({status:expired.status,signedIn:expired.signedIn,account:expired.account,code:expired.error?.code,retryable:expired.error?.retryable},{status:'signed-out',signedIn:false,account:null,code:'AUTH_REQUIRED',retryable:false});
  assert.equal(auth.counts.clear,1);
  publish();
  const guest=h.binding;
  assert.notEqual(guest.accountGeneration,first);
  assert.deepEqual(guest,{accountGeneration:guest.accountGeneration,expectedAccountId:null,epoch:1,status:'signed-out'});
  // 이전 세대의 직원 문서 겉과 회사 창 저장소는 지금처럼 바로 정리된다.
  await settle(5);
  assert.equal(memberWindow.isDestroyed(),true);
  assert.deepEqual(jars.cleared,[memberPartition,memberPartition+':cache']);

  // 확정 손님의 맨 코드는 손님 partition의 새 숨은 창에서 receiver 분류를 거친다. 고객 코드는 PULSE 경로로 넘어가고,
  // 직원 코드는 Workspace 겉을 청하지 않고 SIGN_IN_REQUIRED로 끝난다. 직원 링크는 분류 창도 열지 않고 같은 답이다.
  const customerIds=idsFor(h),employeeIds=idsFor(h),linkIds=idsFor(h);
  const responses=[
    await within(h.manager.inspectCode({code:OTHER_TOKEN,...customerIds})),
    await within(h.manager.inspectCode({code:TOKEN,...employeeIds})),
    await within(h.manager.handoffLink({href:LINK,...linkIds})),
  ];
  assert.deepEqual(responses,[
    {ok:true,...customerIds,state:'received',destination:'/pulse-app/'},
    {ok:false,...employeeIds,code:'SIGN_IN_REQUIRED',retryable:false},
    {ok:false,...linkIds,code:'SIGN_IN_REQUIRED',retryable:false},
  ]);
  assert.deepEqual(h.customer,[{token:OTHER_TOKEN,...customerIds}]);
  assert.equal(h.surfaces.length,1);
  const guestWindows=h.electron.windows.slice(2);
  assert.equal(guestWindows.length,2);
  assert.notEqual(companyEntryPartition(guest),memberPartition);
  for(const win of guestWindows){
    assert.equal(win.options.webPreferences.partition,companyEntryPartition(guest));
    assert.deepEqual(win.webContents.loads,[RECEIVER_URL]);
    assert.equal(win.isVisible(),false);
    assert.equal(win.isDestroyed(),true);
  }
  const guestDocuments=h.documents.filter(doc=>guestWindows.some(win=>win.webContents===doc.contents));
  assert.deepEqual(guestDocuments.map(doc=>doc.url),[RECEIVER_URL,RECEIVER_URL]);
  for(const doc of guestDocuments)assert.equal(offersOf(doc.frame)[0].expectedAccountId,null);
  // 배정 조회는 다시 시도하라는 답 대신 로그인이 필요하다고 답한다.
  const lookup=idsFor(h);
  assert.deepEqual(await lookupFor(()=>h.binding).resolve(lookup),{ok:false,...lookup,code:'LOGIN_REQUIRED',retryable:false});
  assertTokenOnlyInOffers(h,responses);
  assert.deepEqual(auth.unexpected,[]);
});

test('로그인을 취소해 auth가 로그아웃을 확정하면 남은 AUTH_CANCELLED와 관계없이 확정 손님의 고객 초대는 넘어가고 직원 초대는 로그인이 필요하다고 답한다',async t=>{
  // auth-preparation 시험과 같은 길이다. 로그인 준비(금고 비우기) 중에 취소하므로 로그인 창과 콜백 서버는 열리지 않는다.
  const preparing=deferred();
  const auth=syntheticAuth(t,{load:async()=>null,clear:call=>(call===1?preparing.promise:undefined)});
  await auth.service.initialize();
  assert.equal(auth.binding().status,'signed-out');
  const login=auth.service.signIn(),interrupted=assert.rejects(login,{code:'AUTH_CHANGED'});
  await auth.service.cancel();
  preparing.resolve();
  await interrupted;
  const cancelled=auth.service.status();
  assert.deepEqual({status:cancelled.status,signedIn:cancelled.signedIn,account:cancelled.account,code:cancelled.error?.code,retryable:cancelled.error?.retryable},{status:'signed-out',signedIn:false,account:null,code:'AUTH_CANCELLED',retryable:false});
  const binding=auth.binding();
  assert.deepEqual(binding,{accountGeneration:auth.service.accountGeneration(),expectedAccountId:null,epoch:2,status:'signed-out'});
  assert.notEqual(companyEntryPartition(binding),null);
  const h=integrated({binding,scripts:{[RECEIVER_URL]:companyScript('receiver',{classify:byToken}),[EMPLOYEE_URL]:companyScript('employee')}});
  const customer=idsFor(h),inspect=idsFor(h),link=idsFor(h),lookup=idsFor(h);
  const responses=[
    await within(h.manager.inspectCode({code:OTHER_TOKEN,...customer})),
    await within(h.manager.inspectCode({code:TOKEN,...inspect})),
    await within(h.manager.handoffLink({href:LINK,...link})),
  ];
  assert.deepEqual(responses,[
    {ok:true,...customer,state:'received',destination:'/pulse-app/'},
    {ok:false,...inspect,code:'SIGN_IN_REQUIRED',retryable:false},
    {ok:false,...link,code:'SIGN_IN_REQUIRED',retryable:false},
  ]);
  assert.deepEqual(h.customer,[{token:OTHER_TOKEN,...customer}]);
  // 손님은 Workspace 겉을 청하지 않는다. 두 맨 코드만 receiver 문서에 닿는다.
  assert.deepEqual(h.surfaces,[]);
  assert.deepEqual(h.documents.map(doc=>doc.url),[RECEIVER_URL,RECEIVER_URL]);
  for(const doc of h.documents)assert.equal(offersOf(doc.frame)[0].expectedAccountId,null);
  assert.deepEqual(await lookupFor(()=>h.binding).resolve(lookup),{ok:false,...lookup,code:'LOGIN_REQUIRED',retryable:false});
  assertTokenOnlyInOffers(h,responses);
  assert.deepEqual(auth.unexpected,[]);
});

test('복원 중, 저장된 로그인의 재시도 대기, 다시 시도할 수 있는 오류가 남은 로그아웃 표시는 손님이 아니다',async t=>{
  const loading=deferred();
  const auth=syntheticAuth(t,{load:()=>loading.promise,tokens:['offline','offline']});
  // 회사 창을 열지 않고 인계와 조회 모두 다시 시도하라고 답한다.
  async function blocked(label,expected){
    const binding=auth.binding();
    assert.equal(binding.status,expected,label);
    assert.equal(companyEntryPartition(binding),null,label);
    const h=manual({binding}),inspect=idsFor(h),link=idsFor(h),lookup=idsFor(h);
    assert.deepEqual(await h.manager.inspectCode({code:TOKEN,...inspect}),{ok:false,...inspect,code:'TEMPORARY_UNAVAILABLE',retryable:true},label);
    assert.deepEqual(await h.manager.handoffLink({href:LINK,...link}),{ok:false,...link,code:'TEMPORARY_UNAVAILABLE',retryable:true},label);
    assert.deepEqual(await lookupFor(()=>binding).resolve(lookup),{ok:false,...lookup,code:'TEMPORARY_UNAVAILABLE',retryable:true},label);
    assert.equal(h.electron.windows.length,0,label);
  }
  // 저장된 로그인을 읽는 중이다.
  const starting=auth.service.initialize();
  assert.equal(auth.service.status().status,'restoring');
  await blocked('복원 중','restoring');
  // 저장된 로그인을 서버에 확인하지 못했다. 세션은 남아 다시 시도를 기다리고 금고도 그대로다.
  loading.resolve({...SAVED_SIGN_IN});
  await starting;
  const waiting=auth.service.status();
  assert.deepEqual({status:waiting.status,code:waiting.error?.code,retryable:waiting.error?.retryable},{status:'error',code:'NETWORK',retryable:true});
  await blocked('저장된 로그인의 재시도 대기','error');
  assert.equal(auth.counts.clear,0);
  // 플랫폼 결속이 로그아웃을 알렸지만 auth는 아직 그 세션의 재시도 오류를 남겼다. 로그아웃 표시여도 확정이 아니다.
  auth.service.bindPlatform({status:'signed-out',generation:'synthetic-platform-2'});
  const masked=auth.service.status();
  assert.deepEqual({status:masked.status,signedIn:masked.signedIn,account:masked.account,retryable:masked.error?.retryable},{status:'signed-out',signedIn:false,account:null,retryable:true});
  await blocked('재시도 오류가 남은 로그아웃 표시','error');
  // 로그아웃을 마치면(suite-session.cjs가 부르는 auth.signOut) 이유가 없는 확정 로그아웃이 된다. 손님의 고객 초대는 넘어가고,
  // 직원 초대는 다시 시도하라는 답이 아니라 로그인이 필요하다는 답이다.
  await auth.service.signOut();
  assert.equal(auth.service.status().error,null);
  const guest=auth.binding();
  assert.equal(guest.status,'signed-out');
  const h=integrated({binding:guest,scripts:{[RECEIVER_URL]:companyScript('receiver',{classify:byToken}),[EMPLOYEE_URL]:companyScript('employee')}});
  const customer=idsFor(h),employee=idsFor(h);
  assert.deepEqual(await within(h.manager.inspectCode({code:OTHER_TOKEN,...customer})),{ok:true,...customer,state:'received',destination:'/pulse-app/'});
  assert.deepEqual(await within(h.manager.inspectCode({code:TOKEN,...employee})),{ok:false,...employee,code:'SIGN_IN_REQUIRED',retryable:false});
  assert.deepEqual(h.surfaces,[]);
  assert.deepEqual(auth.unexpected,[]);
});
