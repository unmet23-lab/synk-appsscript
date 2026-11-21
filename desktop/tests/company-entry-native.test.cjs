'use strict';
// 회사 공통 진입 · main과 공개 preload 연결 시험. 실제 main.cjs를 가짜 Electron, auth, PULSE, Workspace와 회사 관리자·배정 조회 대역으로 돌려
// main이 무엇을 받고 무엇을 넘기는지만 본다. 관리자와 배정 조회의 동작 자체는 company-entry.test.cjs와
// company-entry-destinations.test.cjs가 본다. 실제 창, 프로필, 계정, 서버는 쓰지 않는다.
// 실행: node --test desktop/tests/company-entry-native.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {randomUUID}=require('node:crypto');
const {PLATFORM_ENTRY,DEV_URLS}=require('../src/catalog.cjs');
const companyEntryModule=require('../src/company-entry.cjs');
const destinationsModule=require('../src/company-entry-destinations.cjs');
const {pulseAppPartition}=require('../src/pulse-app.cjs');

const ACCOUNT='3f0b3d2a-6a1e-4c3b-9d2e-7f6a5b4c3d2e';
const TOKEN='Inv1te_T0ken-For-Company-Entry-0123456789';
const LINK='https://workspace.synk.im/#invite='+TOKEN;
const CHANNELS=['synk:company-invite-handoff','synk:company-invite-inspect','synk:company-entry-cancel','synk:company-entry-destinations','synk:company-entry-open-destination'];
// main.cjs는 vm 안에서 돈다. 그 안에서 만든 객체는 다른 Object.prototype을 가지므로 값만 비교한다.
const plain=value=>JSON.parse(JSON.stringify(value));
const signedIn=()=>({configured:true,status:'signed-in',signedIn:true,sessionGeneration:3,account:{synk_user_id:ACCOUNT,display_name:'합성 회원'},error:null});

async function mainFixture({clientId='platform',argv=[],suite=null}={}){
  const entry=clientId==='platform'?PLATFORM_ENTRY:DEV_URLS[clientId],runtime={clientId,mode:'development',entry,auth:null},smoke=argv.includes('--synk-smoke');
  const app=new EventEmitter(),handlers=new Map(),frame={url:entry},jars=new Map(),authCalls=[],fetched=[];
  const control={status:signedIn(),generation:randomUUID(),token:'synthetic-native-access-token',suiteAvailable:suite!=='unavailable'};
  Object.assign(app,{isPackaged:true,enableSandbox(){},setName(){},setPath(){},getPath:name=>name==='home'?'C:\\Users\\synthetic':'/synthetic',getAppPath:()=>'/synthetic/app',getVersion:()=> '0.4.0',setAppUserModelId(){},getLoginItemSettings:()=>({openAtLogin:false}),requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve()});
  const contents=new EventEmitter();
  Object.assign(contents,{mainFrame:frame,getURL:()=>frame.url,setWindowOpenHandler(){},setZoomFactor(){},send(){}});
  class Window extends EventEmitter{constructor(options){super();this.webContents=contents;this.options=options;this.destroyed=false;}isDestroyed(){return this.destroyed;}isMinimized(){return false;}isMaximized(){return false;}getNormalBounds(){return {x:this.options.x||0,y:this.options.y||0,width:this.options.width,height:this.options.height};}show(){}focus(){}}
  // partition마다 다른 저장소. 플랫폼 자기 partition과 회사 창 partition을 나눠 본다.
  const jar=partition=>{
    if(!jars.has(partition)){
      const value=new EventEmitter();
      Object.assign(value,{partition,cleared:0,permission:null,check:null,filter:null,
        setPermissionRequestHandler(fn){value.permission=fn;},setPermissionCheckHandler(fn){value.check=fn;},
        webRequest:{onBeforeRequest(filter,fn){value.filter={filter,fn};},onHeadersReceived(){}},protocol:{handle(){}},
        async clearStorageData(){value.cleared+=1;},async clearCache(){}});
      jars.set(partition,value);
    }
    return jars.get(partition);
  };
  const publisher={initialize:async()=>{},refresh:()=>control.suiteAvailable,available:()=>control.suiteAvailable,project:state=>state,publish(){},beginSignIn:()=>true,signOut:()=>true,dispose(){}};
  const manager={options:null,calls:[],answers:{}},lookups={options:null,calls:[],answers:{}},pulse={calls:[],answer:null,cancels:[],cancelAnswer:null,opens:0},launches=[];
  const workspace={options:null,opens:0,invites:[],surfaceAnswer:null};
  let authOptions=null;
  const stubs={
    electron:{app,BrowserWindow:Window,ipcMain:{removeHandler(){},handle:(name,handler)=>handlers.set(name,handler)},session:{fromPartition:jar},protocol:{registerSchemesAsPrivileged(){}},Menu:{setApplicationMenu(){}},shell:{openExternal:async()=>{throw Error('No browser allowed');}},dialog:{showMessageBoxSync:()=>0},safeStorage:{isEncryptionAvailable:()=>false},screen:{getAllDisplays:()=>[{workArea:{x:0,y:0,width:1920,height:1080}}],getPrimaryDisplay:()=>({workArea:{x:0,y:0,width:1920,height:1080}})},globalShortcut:{register:()=>false,unregister(){}},clipboard:{writeText(){throw Error('No clipboard operation allowed');}}},
    'node:fs':{readFileSync:()=>JSON.stringify(runtime)},'node:child_process':{spawn(){throw Error('No process allowed');}},
    './auth-config.cjs':{configuration:()=>suite&&clientId==='platform'?{fingerprint:'synthetic-suite-binding'}:null},'./auth-config-path.cjs':{resolveAuthConfigPath:()=>null},'./auth-store.cjs':{createTokenStore:()=>({})},
    './auth-service.cjs':{createAuthService:options=>{authOptions=options;return {
      initialize:async()=>{},status:()=>({...control.status,accountGeneration:control.generation}),accountGeneration:()=>control.generation,renewingAccountId:()=>null,
      getAccessToken:async()=>{authCalls.push('getAccessToken');return control.token;},signOut:async()=>{authCalls.push('signOut');return {ok:true};},
      accountRequest:()=>{throw Error('No account request allowed');}};},publicError:()=>({})},
    './pulse-app.cjs':{createPulseApp:()=>({open:async()=>{pulse.opens+=1;return {ok:true,id:'pulse',independentWindow:true};},openInvite:async request=>{pulse.calls.push(request);return pulse.answer?pulse.answer(request):{ok:true,requestId:request.requestId,accountGeneration:request.accountGeneration,state:'received',destination:'/pulse-app/'};},
      cancelInvite:input=>{pulse.cancels.push(input);return pulse.cancelAnswer?pulse.cancelAnswer(input):null;},syncContext(){},dispose(){}}),pulseInviteRefusal:require('../src/pulse-app.cjs').pulseInviteRefusal},
    // 창 안의 Workspace 관리자도 대역이다. 배정 열기와 직원 초대의 겉 요청이 무엇으로 오는지만 본다.
    './workspace-app.cjs':{...require('../src/workspace-app.cjs'),createWorkspaceApp:options=>{workspace.options=options;return {
      open:async(...args)=>{workspace.opens+=1;workspace.openArgs=args;return {ok:true,id:'workspace'};},surfaceForInvite:async binding=>{workspace.invites.push(binding);return workspace.surfaceAnswer;},
      syncContext(){},publishAuth(){},busy:()=>false,hasSurface:()=>false,dispose(){}};}},
    './company-entry.cjs':{...companyEntryModule,createCompanyEntryManager:options=>{
      manager.options=options;
      const call=name=>input=>{manager.calls.push([name,input]);return manager.answers[name]?manager.answers[name](input):Promise.resolve({ok:true,requestId:input.requestId,accountGeneration:input.accountGeneration,state:'received',destination:'/'});};
      return {handoffLink:call('handoffLink'),inspectCode:call('inspectCode'),cancel:input=>{manager.calls.push(['cancel',input]);return manager.answers.cancel?manager.answers.cancel(input):null;},syncAccount:()=>{manager.calls.push(['syncAccount']);},dispose:()=>{manager.calls.push(['dispose']);}};
    }},
    './company-entry-destinations.cjs':{...destinationsModule,createCompanyEntryDestinations:options=>{
      lookups.options=options;
      return {resolve:(input,extra)=>{lookups.calls.push(['resolve',input,extra]);return Promise.resolve({ok:true,requestId:input.requestId,accountGeneration:input.accountGeneration,result:{status:'resolved',destinations:[],unavailable:[]}});},
        open:(input,extra)=>{lookups.calls.push(['open',input,extra]);return Promise.resolve(lookups.answers.open?lookups.answers.open(input):{ok:true,requestId:input.requestId,accountGeneration:input.accountGeneration,destination:input.destination});},
        cancel:input=>{lookups.calls.push(['cancel',input]);return lookups.answers.cancel?lookups.answers.cancel(input):null;},
        invalidate:()=>{lookups.calls.push(['invalidate']);},syncAccount:()=>{lookups.calls.push(['syncAccount']);},dispose:()=>{lookups.calls.push(['dispose']);}};
    }},
    './client-lifecycle.cjs':{createClientLifecycle:()=>({getClients:async()=>[],launch:async id=>{launches.push(id);return {ok:true};}})},'./teacher-preview.cjs':{createTeacherPreview:()=>({available:()=>false})},'./product-preview.cjs':{createProductPreviews:()=>({available:()=>[]})},
    './company-requests.cjs':{createCompanyRequests:()=>()=>{throw Error('No company request allowed');}},'./downloads.cjs':{createDownloadHandler:()=>()=>{}},
    './native-content.cjs':{createNativeContent:()=>({})},'./connection-content.cjs':{createConnectionContent:()=>({})},'./connection-recovery.cjs':{createConnectionRecovery:()=>({connect:async()=>{},dispose(){}})},
    ...(suite?{'./suite-session.cjs':{suiteKey:()=> 'synthetic-suite',suiteDevice:()=> 'synthetic-device',createSuiteStore:()=>({}),createSuitePublisher:()=>publisher,createSuiteFollower:()=>({start:async()=>{},dispose(){}})}}:{}),
  };
  const fetch=async(...args)=>{fetched.push(args);return {status:200,body:null};};
  const filename=path.join(__dirname,'../src/main.cjs');
  // smoke 실행은 자기 확인용 20초 종료 타이머를 건다. 이 시험은 그 타이머를 돌리지 않는다.
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:id=>Object.hasOwn(stubs,id)?stubs[id]:id.startsWith('./')?require(path.join(__dirname,'../src',id)):require(id),__dirname:path.dirname(filename),process:{argv,platform:'win32',arch:'x64',env:{},resourcesPath:'/synthetic/resources'},console,Buffer,fetch,setTimeout:smoke?()=>0:setTimeout,clearTimeout:smoke?()=>{}:clearTimeout},{filename});
  for(let waited=0;!handlers.has('synk:company-invite-handoff')&&waited<2000;waited+=5)await new Promise(resolve=>setTimeout(resolve,5));
  assert.ok(handlers.has('synk:company-invite-handoff'),'the synthetic platform window');
  return {handlers,frame,contents,event:{sender:contents,senderFrame:frame},control,manager,lookups,pulse,workspace,launches,jars,authCalls,fetched,get authOptions(){return authOptions;}};
}
const call=(f,channel,...args)=>f.handlers.get(channel)(f.event,...args);

test('main은 회사 진입 다섯 채널을 플랫폼 창의 신뢰 프레임에서만 받고, 화면 입력을 관리자에 그대로 넘긴다',async()=>{
  const f=await mainFixture();
  for(const channel of CHANNELS)assert.equal(typeof f.handlers.get(channel),'function',channel);
  const ids={requestId:randomUUID(),accountGeneration:f.control.generation},link={href:LINK,...ids},code={code:TOKEN,...ids};
  assert.deepEqual(await call(f,'synk:company-invite-handoff',link,'https://evil.invalid/'),{ok:true,...ids,state:'received',destination:'/'});
  assert.deepEqual(await call(f,'synk:company-invite-inspect',code,'persist:other'),{ok:true,...ids,state:'received',destination:'/'});
  const asked=f.manager.calls.filter(([name])=>name!=='syncAccount');
  assert.deepEqual(asked.map(([name])=>name),['handoffLink','inspectCode']);
  assert.equal(asked[0][1],link);
  assert.equal(asked[1][1],code);
  // 취소는 그 요청의 응답을, 끝낸 것이 없으면 null을 돌려준다.
  assert.equal(await call(f,'synk:company-entry-cancel',{...ids}),null);
  f.manager.answers.cancel=input=>({ok:false,...input,code:'CANCELLED',retryable:true});
  assert.deepEqual(await call(f,'synk:company-entry-cancel',{...ids}),{ok:false,...ids,code:'CANCELLED',retryable:true});
  // 배정 조회는 입력과, 물어본 창·프레임이 그대로인지 답하는 함수만 넘긴다.
  assert.deepEqual(await call(f,'synk:company-entry-destinations',{...ids}),{ok:true,...ids,result:{status:'resolved',destinations:[],unavailable:[]}});
  const [[,input,extra]]=f.lookups.calls.filter(([name])=>name==='resolve');
  assert.deepEqual(input,ids);
  assert.deepEqual(Object.keys(extra),['isCurrentSender']);
  assert.equal(extra.isCurrentSender(),true);
  f.frame.url='https://synk.im/shift/';
  assert.equal(extra.isCurrentSender(),false);
  f.frame.url=PLATFORM_ENTRY;
  assert.equal(extra.isCurrentSender(),true);
  const originalFrame=f.contents.mainFrame;
  f.contents.mainFrame={url:PLATFORM_ENTRY};
  assert.equal(extra.isCurrentSender(),false);
  f.contents.mainFrame=originalFrame;
  // 확인된 목적지 열기도 입력과, 열기를 청한 창·프레임이 그대로인지 답하는 함수만 넘긴다. 주소나 partition은 받지 않는다.
  const destination={destination:'/pulse-app/',...ids};
  assert.deepEqual(await call(f,'synk:company-entry-open-destination',destination,'https://evil.invalid/','persist:other'),{ok:true,...ids,destination:'/pulse-app/'});
  const [[,opened,openExtra]]=f.lookups.calls.filter(([name])=>name==='open');
  assert.equal(opened,destination);
  assert.deepEqual(Object.keys(openExtra),['isCurrentSender']);
  assert.equal(openExtra.isCurrentSender(),true);
  f.contents.mainFrame={url:PLATFORM_ENTRY};
  assert.equal(openExtra.isCurrentSender(),false);
  f.contents.mainFrame=originalFrame;
  // 다른 창, 하위 프레임, 다른 문서는 다섯 채널 모두 받지 않는다.
  const before=f.manager.calls.length,lookupsBefore=f.lookups.calls.length;
  for(const event of [{...f.event,sender:{}},{...f.event,senderFrame:{url:PLATFORM_ENTRY}},{...f.event,senderFrame:null}])
    for(const channel of CHANNELS)await assert.rejects(f.handlers.get(channel)(event,link),/UNTRUSTED_SENDER/,channel);
  f.frame.url='https://synk.im/shift/';
  for(const channel of CHANNELS)await assert.rejects(call(f,channel,link),/UNTRUSTED_SENDER/,channel);
  assert.equal(f.manager.calls.length,before);
  assert.equal(f.lookups.calls.length,lookupsBefore);
  assert.deepEqual(f.authCalls,[]);
});

test('다른 클라이언트, smoke 실행, 준비되지 않은 묶음 로그인은 관리자에 닿기 전에 같은 응답 모양으로 거절된다',async()=>{
  const refusals=(f,ids)=>Promise.all([
    call(f,'synk:company-invite-handoff',{href:LINK,...ids}),call(f,'synk:company-invite-inspect',{code:TOKEN,...ids}),
    call(f,'synk:company-entry-cancel',{...ids}),call(f,'synk:company-entry-destinations',{...ids}),
    call(f,'synk:company-entry-open-destination',{destination:'/',...ids}),
  ]);
  for(const clientId of ['world','messenger']){
    const f=await mainFixture({clientId}),ids={requestId:randomUUID(),accountGeneration:randomUUID()};
    assert.deepEqual(await refusals(f,ids),[
      {ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false},{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false},
      null,{ok:false,...ids,code:'TEMPORARY_UNAVAILABLE',retryable:false},{ok:false,...ids,code:'HANDOFF_UNAVAILABLE',retryable:false},
    ],clientId);
    assert.equal(f.manager.options,null,clientId);
    assert.equal(f.lookups.options,null,clientId);
    assert.deepEqual(f.launches,[],clientId);
    assert.deepEqual(f.pulse.cancels,[],clientId);
  }
  const smoke=await mainFixture({argv:['--synk-smoke']}),smokeIds={requestId:randomUUID(),accountGeneration:smoke.control.generation};
  assert.deepEqual(await refusals(smoke,smokeIds),[
    {ok:false,...smokeIds,code:'HANDOFF_UNAVAILABLE',retryable:false},{ok:false,...smokeIds,code:'HANDOFF_UNAVAILABLE',retryable:false},
    null,{ok:false,...smokeIds,code:'TEMPORARY_UNAVAILABLE',retryable:false},{ok:false,...smokeIds,code:'HANDOFF_UNAVAILABLE',retryable:false},
  ]);
  assert.deepEqual(smoke.manager.calls.filter(([name])=>name!=='syncAccount'),[]);
  assert.deepEqual(smoke.lookups.calls.filter(([name])=>name!=='syncAccount'),[]);
  assert.deepEqual(smoke.pulse.cancels,[]);
  const locked=await mainFixture({suite:'unavailable'}),lockedIds={requestId:randomUUID(),accountGeneration:locked.control.generation};
  assert.deepEqual(await refusals(locked,lockedIds),[
    {ok:false,...lockedIds,code:'TEMPORARY_UNAVAILABLE',retryable:true},{ok:false,...lockedIds,code:'TEMPORARY_UNAVAILABLE',retryable:true},
    null,{ok:false,...lockedIds,code:'TEMPORARY_UNAVAILABLE',retryable:true},{ok:false,...lockedIds,code:'TEMPORARY_UNAVAILABLE',retryable:true},
  ]);
  assert.deepEqual(locked.manager.calls.filter(([name])=>name!=='syncAccount'),[]);
  assert.deepEqual(locked.lookups.calls.filter(([name])=>name!=='syncAccount'),[]);
  assert.deepEqual(locked.pulse.cancels,[]);
  // 잘못된 요청 ID는 되돌리지 않는다.
  const world=await mainFixture({clientId:'world'});
  assert.deepEqual(await call(world,'synk:company-invite-handoff',{href:LINK,requestId:'x',accountGeneration:2}),{ok:false,requestId:null,accountGeneration:null,code:'HANDOFF_UNAVAILABLE',retryable:false});
});

test('관리자와 배정 조회는 auth의 현재 세대, 숫자 epoch, 확인된 SYNK ID, 확정 상태만으로 묶인다',async()=>{
  const f=await mainFixture(),bind=f.manager.options.getBinding;
  assert.equal(f.lookups.options.getBinding,bind);
  assert.deepEqual(plain(bind()),{accountGeneration:f.control.generation,expectedAccountId:ACCOUNT,epoch:3,status:'signed-in'});
  // 같은 계정의 토큰 갱신이나 플랫폼 결속 확인 중(auth가 restoring으로 알린다)에는 계정을 쓰지 않는다.
  f.control.status={...signedIn(),status:'restoring',signedIn:false,account:null};
  assert.deepEqual(plain(bind()),{accountGeneration:f.control.generation,expectedAccountId:null,epoch:3,status:'restoring'});
  f.control.status={...signedIn(),status:'signing-in',signedIn:false,account:null};
  assert.equal(bind().status,'restoring');
  f.control.status={...signedIn(),status:'error',signedIn:false,account:null,error:{code:'NETWORK',retryable:true}};
  assert.deepEqual(plain(bind()),{accountGeneration:f.control.generation,expectedAccountId:null,epoch:3,status:'error'});
  f.control.status={configured:true,status:'signed-out',signedIn:false,sessionGeneration:4,account:null,error:null};
  assert.deepEqual(plain(bind()),{accountGeneration:f.control.generation,expectedAccountId:null,epoch:4,status:'signed-out'});
  // 확정 로그아웃의 종료 이유는 손님 초대를 막지 않는다.
  f.control.status={...f.control.status,error:{code:'AUTH_REQUIRED',message:'합성',retryable:false}};
  assert.equal(bind().status,'signed-out');
  // 복구할 수 있는 오류가 남은 상태는 계속 막는다.
  f.control.status={...f.control.status,error:{code:'NETWORK',message:'합성',retryable:true}};
  assert.equal(bind().status,'error');
  f.control.status={configured:false,status:'unconfigured',signedIn:false,sessionGeneration:0,account:null,error:null};
  assert.equal(bind().status,'signed-out');
  // 묶음 로그인이 계정을 가리는 동안에는 세대가 없다.
  const masked=await mainFixture({suite:'available'});
  assert.equal(plain(masked.manager.options.getBinding()).accountGeneration,masked.control.generation);
  masked.control.suiteAvailable=false;
  assert.equal(masked.manager.options.getBinding().accountGeneration,null);
  // 토큰은 auth의 현재 값을 main 안에서만 읽고, fetch는 main의 기본 fetch다. 로그아웃은 넘기지 않는다.
  assert.equal(await f.lookups.options.getAccessToken(),'synthetic-native-access-token');
  assert.deepEqual(f.authCalls,['getAccessToken']);
  assert.equal(typeof f.lookups.options.fetcher,'function');
  await f.lookups.options.fetcher(destinationsModule.DESTINATIONS_URL,{method:'POST'});
  assert.equal(f.fetched.length,1);
  assert.deepEqual(Object.keys(f.lookups.options).sort(),['fetcher','getAccessToken','getBinding','openPulse','openWorkspace']);
  // 확인된 목적지는 기존 제품 기능으로만 연다. Workspace는 플랫폼 창 안의 Workspace 열기이고 따로 설치한 앱을 실행하지 않는다.
  // PULSE는 기존 창 열기다. 인자는 main이 고정한다.
  assert.deepEqual(await f.lookups.options.openWorkspace('https://evil.invalid/'),{ok:true,id:'workspace'});
  assert.equal(f.workspace.opens,1);
  assert.deepEqual(f.workspace.openArgs,[]);
  assert.deepEqual(f.launches,[]);
  assert.deepEqual(plain(await f.lookups.options.openPulse('persist:other')),{ok:true,id:'pulse',independentWindow:true});
  assert.equal(f.pulse.opens,1);
  // 직원 초대의 겉은 관리자가 넘긴 결속 그대로 창 안의 Workspace 관리자에 청하고, 그 답을 그대로 돌려준다.
  const binding=f.manager.options.getBinding(),answer={surface:{},session:{}};
  f.workspace.surfaceAnswer=answer;
  assert.equal(await f.manager.options.openEmployeeSurface(binding),answer);
  assert.equal(f.workspace.invites.length,1);
  assert.equal(f.workspace.invites[0],binding);
  assert.deepEqual(f.authCalls,['getAccessToken']);
});

test('main은 분류된 고객 초대를 PULSE 관리자에 정확한 세 필드로 한 번 넘기고, 답을 계약 code로 돌려준다',async()=>{
  const f=await mainFixture(),deliver=f.manager.options.deliverCustomer;
  const request={token:TOKEN,requestId:randomUUID(),accountGeneration:f.control.generation};
  assert.deepEqual(await deliver(request),{ok:true,requestId:request.requestId,accountGeneration:request.accountGeneration,state:'received',destination:'/pulse-app/'});
  assert.equal(f.pulse.calls.length,1);
  assert.equal(f.pulse.calls[0],request);
  const cases=[
    [{code:'PULSE_APP_BUSY',retryable:true},{code:'BUSY',retryable:true}],
    [{code:'PULSE_APP_ACCOUNT_CHANGED',retryable:false},{code:'ACCOUNT_CHANGED',retryable:false}],
    [{code:'PULSE_APP_INVITE_UNCONFIRMED',retryable:false},{code:companyEntryModule.UNCONFIRMED_CODE,retryable:false}],
    [{code:'PULSE_APP_INVITE_RECEIVER_UNAVAILABLE',retryable:true},{code:'HANDOFF_UNAVAILABLE',retryable:true}],
  ];
  for(const [answer,expected] of cases){
    f.pulse.answer=value=>({ok:false,requestId:value.requestId,accountGeneration:value.accountGeneration,...answer});
    assert.deepEqual(await deliver(request),{ok:false,requestId:request.requestId,accountGeneration:request.accountGeneration,...expected},answer.code);
  }
  // 모르는 답은 관리자가 미확인으로 끝내도록 null이 된다.
  f.pulse.answer=()=>({ok:true,id:'pulse',independentWindow:true});
  assert.equal(await deliver(request),null);
  assert.equal(f.pulse.calls.length,6);
  assert.equal(JSON.stringify(f.pulse.calls.map(value=>Object.keys(value))),JSON.stringify(Array(6).fill(['token','requestId','accountGeneration'])));
});

test('공개 취소 하나가 회사 관리자, 배정 조회와 그 기록, PULSE 직접 초대를 정확히 같은 두 ID로 끝내고 답은 회사 진입의 공개 모양이다',async()=>{
  const f=await mainFixture(),ids={requestId:randomUUID(),accountGeneration:f.control.generation};
  const asked=list=>list.filter(([name])=>name==='cancel').map(([,input])=>input);
  // 맞는 것이 없으면 세 곳 모두 같은 입력을 받고 답은 null이다.
  const input={...ids};
  assert.equal(await call(f,'synk:company-entry-cancel',input),null);
  assert.deepEqual(asked(f.manager.calls),[input]);
  assert.deepEqual(asked(f.lookups.calls),[input]);
  assert.deepEqual(f.pulse.cancels,[input]);
  // 배정 조회(진행 중이거나 기록이 된 것)를 끝냈으면 그 답이다.
  f.lookups.answers.cancel=value=>({ok:false,...value,code:'CANCELLED',retryable:true});
  assert.deepEqual(await call(f,'synk:company-entry-cancel',{...ids}),{ok:false,...ids,code:'CANCELLED',retryable:true});
  f.lookups.answers.cancel=null;
  // PULSE 직접 초대는 PULSE의 답을 회사 진입의 공개 code로 바꿔 돌려준다. 토큰이 떠나기 전이면 CANCELLED, 뒤면 미확인이다.
  f.pulse.cancelAnswer=value=>({ok:false,...value,code:'CANCELLED',retryable:true});
  assert.deepEqual(await call(f,'synk:company-entry-cancel',{...ids}),{ok:false,...ids,code:'CANCELLED',retryable:true});
  f.pulse.cancelAnswer=value=>({ok:false,...value,code:'PULSE_APP_INVITE_UNCONFIRMED',retryable:false});
  assert.deepEqual(await call(f,'synk:company-entry-cancel',{...ids}),{ok:false,...ids,code:companyEntryModule.UNCONFIRMED_CODE,retryable:false});
  // 회사 관리자가 끝낸 요청이 있으면 그 답이다.
  f.manager.answers.cancel=value=>({ok:false,...value,code:companyEntryModule.UNCONFIRMED_CODE,retryable:false});
  assert.deepEqual(await call(f,'synk:company-entry-cancel',{...ids}),{ok:false,...ids,code:companyEntryModule.UNCONFIRMED_CODE,retryable:false});
  // 고객 경로로 넘긴 요청: 관리자의 cancelCustomer는 같은 두 ID로 PULSE를 취소하고 그 답을 회사 진입의 공개 code로 바꾼다.
  const cancelCustomer=f.manager.options.cancelCustomer,customer={requestId:randomUUID(),accountGeneration:f.control.generation};
  f.pulse.cancels.length=0;
  f.pulse.cancelAnswer=value=>({ok:false,...value,code:'CANCELLED',retryable:true});
  assert.deepEqual(cancelCustomer(customer),{ok:false,...customer,code:'CANCELLED',retryable:true});
  assert.deepEqual(f.pulse.cancels,[customer]);
  f.pulse.cancelAnswer=()=>null;
  assert.equal(cancelCustomer(customer),null);
  // 토큰은 취소 입력에도 답에도 없다.
  assert.equal(JSON.stringify([f.pulse.cancels,f.manager.calls.filter(([name])=>name==='cancel')]).includes(TOKEN),false);
});

test('플랫폼 창에 새 문서가 들어서면 확인된 배정 기록과 진행 중인 조회를 무효화하고, 같은 문서 안의 이동과 막힌 이동은 그대로 둔다',async()=>{
  const f=await mainFixture(),invalidations=()=>f.lookups.calls.filter(([name])=>name==='invalidate').length;
  // 시작만 한 이동(will-navigate가 막아 바깥 브라우저로 연 링크 포함), 같은 문서 안의 이동, 하위 프레임은 문서 교체가 아니다.
  f.contents.emit('did-start-navigation',{isMainFrame:true,isSameDocument:false,url:'https://synk.im/help/'});
  f.contents.emit('did-start-navigation',{},'https://synk.im/help/',false,true);
  f.contents.emit('did-navigate-in-page',{},PLATFORM_ENTRY+'#account',true);
  f.contents.emit('did-frame-navigate',{},'https://frame.invalid/',200,'OK',false);
  assert.equal(invalidations(),0);
  // 플랫폼 창의 mainFrame에 새 문서가 들어섰다(다시 불러오기 포함).
  f.contents.emit('did-navigate',{},PLATFORM_ENTRY,200,'OK');
  assert.equal(invalidations(),1);
  f.contents.emit('did-navigate',{},PLATFORM_ENTRY,200,'OK');
  assert.equal(invalidations(),2);
});

test('회사 창 partition은 확인된 계정과 세대에 묶인 메모리 partition이며, 계정이 바뀌면 이전 세대 저장소만 지운다',async()=>{
  const f=await mainFixture(),select=f.manager.options.selectCompanyPartition,binding=plain(f.manager.options.getBinding());
  const ownPartitions=[...f.jars.keys()],ownSettings=()=>ownPartitions.map(own=>{const value=f.jars.get(own);return [value.filter,value.permission,value.check,value.cleared];});
  const before=ownSettings();
  const name=select(binding);
  assert.equal(name,companyEntryModule.companyEntryPartition(binding));
  assert.equal(name.startsWith('persist:'),false);
  assert.equal(ownPartitions.includes(name),false);
  assert.equal(name===pulseAppPartition('account:'+ACCOUNT)||name===pulseAppPartition('guest'),false);
  const jar=f.jars.get(name);
  assert.equal(jar.check(),false);
  let permitted=null;
  jar.permission({},'clipboard-read',value=>{permitted=value;});
  assert.equal(permitted,false);
  const cancelled=details=>{let answer=null;jar.filter.fn(details,value=>{answer=value;});return answer.cancel;};
  assert.equal(cancelled({url:'https://workspace.synk.im/entry/',resourceType:'mainFrame'}),false);
  assert.equal(cancelled({url:'https://synk.im/id/',resourceType:'mainFrame'}),true);
  assert.equal(cancelled({url:'https://workspace.synk.im/',resourceType:'subFrame'}),true);
  // 플랫폼 자기 partition의 설정은 회사 창 때문에 바뀌지 않는다.
  assert.ok(ownPartitions.length>0);
  assert.deepEqual(ownSettings(),before);
  // 화면의 값이나 확인 중인 계정은 partition을 고르지 못한다.
  for(const value of [{...binding,status:'restoring',expectedAccountId:null},{...binding,expectedAccountId:'persist:evil'},{...binding,accountGeneration:'x'},null])assert.equal(select(value),null,JSON.stringify(value));
  // 로그아웃: auth의 알림이 관리자와 조회에 알리고, 이전 세대의 회사 저장소만 지운다.
  f.control.status={configured:true,status:'signed-out',signedIn:false,sessionGeneration:4,account:null,error:null};
  f.control.generation=randomUUID();
  f.authOptions.onChange({...f.control.status,accountGeneration:f.control.generation});
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(f.manager.calls.some(([callName])=>callName==='syncAccount'));
  assert.ok(f.lookups.calls.some(([callName])=>callName==='syncAccount'));
  assert.equal(jar.cleared,1);
  for(const [partition,value] of f.jars)if(partition!==name)assert.equal(value.cleared,0,partition);
});

test('앱 종료는 회사 관리자와 배정 조회를 PULSE보다 먼저 끝낸다',()=>{
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
  assert.match(main,/app\.on\('will-quit',event=>\{[\s\S]*?companyEntry\?\.dispose\(\);companyDestinations\?\.dispose\(\);pulseApp\?\.dispose\(\);/);
  // 회사 진입 IPC는 공통 발신자 확인 반복문 안에 있다(그 반복문을 거치지 않는 별도 등록이 없다).
  assert.equal((main.match(/ipcMain\.handle\(/g)||[]).length,1);
  for(const channel of CHANNELS)assert.equal(main.split("'"+channel+"'").length-1,1,channel);
});

test('공개 preload는 회사 진입 다섯 함수만 더하고, 정확한 키의 새 객체로만 넘기며 주소·partition·계정 ID를 받지 않는다',async()=>{
  let bridge;
  const calls=[];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>{bridge=value;}},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return {ok:true};}}})});
  assert.deepEqual(Object.keys(bridge).filter(key=>/company/i.test(key)),['companyRequest','handoffCompanyInviteLink','inspectCompanyInviteCode','cancelCompanyEntry','resolveCompanyEntryDestinations','openAssignedCompanyDestination']);
  const requestId=randomUUID(),accountGeneration=randomUUID(),ids={requestId,accountGeneration};
  const cases=[
    ['handoffCompanyInviteLink','synk:company-invite-handoff',{href:LINK,...ids}],
    ['inspectCompanyInviteCode','synk:company-invite-inspect',{code:TOKEN,...ids}],
    ['cancelCompanyEntry','synk:company-entry-cancel',{...ids}],
    ['resolveCompanyEntryDestinations','synk:company-entry-destinations',{...ids}],
    ['openAssignedCompanyDestination','synk:company-entry-open-destination',{destination:'/',...ids}],
    ['openAssignedCompanyDestination','synk:company-entry-open-destination',{destination:'/pulse-app/',...ids}],
  ];
  for(const [name,channel,input] of cases){
    calls.length=0;
    assert.deepEqual(await bridge[name](input,'https://evil.invalid/','persist:other'),{ok:true},name);
    assert.equal(calls.length,1,name);
    assert.equal(calls[0].length,2,name);
    assert.equal(calls[0][0],channel,name);
    assert.notEqual(calls[0][1],input,name);
    assert.deepEqual(Reflect.ownKeys(calls[0][1]),Object.keys(input),name);
    assert.deepEqual(plain(calls[0][1]),input,name);
  }
  calls.length=0;
  const accessor=Object.defineProperty({...ids},'href',{get:()=>LINK,enumerable:true});
  const bad={
    handoffCompanyInviteLink:[{href:LINK,...ids,url:'https://evil.invalid/'},{href:LINK,...ids,partition:'persist:x'},{href:LINK,...ids,expectedAccountId:ACCOUNT},{href:LINK,requestId},
      {href:'https://workspace.synk.im/pulse-app/#invite='+TOKEN,...ids},{href:'https://evil.invalid/#invite='+TOKEN,...ids},{href:'http://workspace.synk.im/#invite='+TOKEN,...ids},
      {href:LINK+'&x=1',...ids},{href:TOKEN,...ids},{href:LINK,...ids,requestId:requestId.toUpperCase()},{href:LINK,...ids,accountGeneration:3},accessor,[LINK],null,undefined,LINK],
    inspectCompanyInviteCode:[{code:TOKEN,...ids,url:'https://evil.invalid/'},{code:LINK,...ids},{code:'short',...ids},{code:TOKEN,requestId},{code:TOKEN,...ids,accountGeneration:2},null],
    resolveCompanyEntryDestinations:[{...ids,url:'https://evil.invalid/'},{...ids,expectedAccountId:ACCOUNT},{...ids,partition:'x'},{requestId},{...ids,requestId:'00000000-0000-0000-0000-000000000000'},null,[ids]],
    openAssignedCompanyDestination:[{...ids},{destination:'/',...ids,url:'https://evil.invalid/'},{destination:'/',...ids,partition:'persist:x'},{destination:'/',...ids,expectedAccountId:ACCOUNT},
      {destination:'https://workspace.synk.im/',...ids},{destination:'/pulse/',...ids},{destination:'/admin/',...ids},{destination:'workspace',...ids},{destination:'pulse',...ids},{destination:'/pulse-app',...ids},
      {destination:'/',requestId},{destination:'/',...ids,accountGeneration:3},{destination:'/',...ids,requestId:requestId.toUpperCase()},Object.defineProperty({...ids},'destination',{get:()=>'/',enumerable:true}),null,'/',['/']],
  };
  for(const [name,values] of Object.entries(bad))for(const [index,value] of values.entries()){
    const answer=plain(await bridge[name](value));
    assert.equal(answer.ok,false,name+' '+index);
    assert.equal(answer.code,'INVALID_INPUT',name+' '+index);
    assert.equal(answer.retryable,false,name+' '+index);
  }
  for(const value of [{...ids,extra:1},{requestId},null,'x',[ids]])assert.equal(await bridge.cancelCompanyEntry(value),null);
  assert.equal(calls.length,0);
  // 거절은 정확한 UUID로 밝힌 요청만 되돌린다.
  assert.deepEqual(plain(await bridge.handoffCompanyInviteLink({href:'https://evil.invalid/',...ids})),{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
  assert.deepEqual(plain(await bridge.resolveCompanyEntryDestinations({requestId:'x',accountGeneration:2})),{ok:false,requestId:null,accountGeneration:null,code:'INVALID_INPUT',retryable:false});
  assert.deepEqual(plain(await bridge.openAssignedCompanyDestination({destination:'/admin/',...ids})),{ok:false,...ids,code:'INVALID_INPUT',retryable:false});
  assert.equal(calls.length,0);
});
