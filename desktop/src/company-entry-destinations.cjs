'use strict';
// 회사 공통 진입 · 로그인한 회원 본인의 회사 배정 조회(B안)와, 그 조회가 확인한 고정 목적지 열기. main만 부른다.
// 원문: .tmp/solio-quality-20261114/company-entry-native-assignment.md 2·4절, company-entry-contract-v1.md 6절,
// portal-company-native-interface-finish.md(열기와 취소 연결).
// - 화면은 {requestId,accountGeneration} 두 키만 보낸다. 주소, 헤더, 계정 ID, partition은 화면에서 받지 않는다.
// - main이 고정 주소 하나에 POST한다. Authorization은 auth의 현재 access token, 본문은 정확히 {expectedAccountId}이고
//   그 값은 main이 확인한 지금의 SYNK ID다. 쿠키를 보내거나 받지 않고(credentials omit), 이동을 따르지 않고(redirect error),
//   12초와 64KB로 묶는다. 렌더러 요청 허용 목록, 세션 partition, CORS, CSP는 이 조회 때문에 바뀌지 않는다.
// - 시작한 계정 세대, 숫자 epoch, SYNK ID, 물어본 창과 프레임을 토큰을 받은 뒤, 응답 머리를 받은 뒤, 본문을 읽은 뒤마다 다시
//   확인한다. 그 사이 계정이 바뀌었으면 응답이 무엇이든 AUTH_CHANGED로 끝내고, 401·403을 이유로 로그아웃하지 않는다.
// - 정확한 성공 모양만 배정 결과가 된다. 실패를 빈 배정으로 바꾸지 않는다. 토큰, 쿠키, 원본 오류는 기록하지도 돌려주지도 않는다.
// - 이 조회는 배정을 알려 줄 뿐 SSO나 회사·고객·프로젝트 세션을 만들지 않는다. 제품을 열 때는 각 제품의 기존 인증이 다시 돈다.
// - 가장 나중에 시작한 조회의 성공만 메모리에 기록한다. 기록에는 그 요청 ID, 계정 세대, 숫자 epoch, SYNK ID, 물어본 창과
//   프레임, 확인된 고정 목적지만 든다. 새 조회, 그 요청의 취소, 다른 계정·세대·epoch, 물어본 문서의 교체가 기록을 지운다.
// - 열기는 정확히 {destination,requestId,accountGeneration}을 받아 기록에 든 고정 목적지 하나만 main이 넘긴 기존 제품 기능으로
//   연다. '/'는 플랫폼 창 안의 Workspace 열기(workspaceApp.open(), 4단계부터), '/pulse-app/'는 PULSE 창 열기(pulseApp.open())다.
//   partial 결과도 확인된 목적지는 열 수 있다. 여는 앞뒤로 계정, 세대, epoch, 청한 창과 프레임을 다시 확인한다.
//   주소나 partition은 받지 않고, 입장 권한이나 세션을 새로 만들지 않는다.
// - 열기 기능을 부른 뒤에는 제품 창이 이미 열렸을 수 있다. 그 사이 기록이 끝났으면 열기 기능의 답이 무엇이든 성공으로 알리지
//   않는다. 기록을 끝내는 것은 그 요청의 취소, 새 조회, 문서 교체, 계정 변경 알림, 끝냄이다. 계정이나 청한 문서가 바뀐 것은 그
//   이유의 code로 답하고, 그 밖은 HANDOFF_UNCONFIRMED(다시 시도 불가)로 답한다. 열린 창이나 앱은 닫거나 다시 불러오지 않는다.
// - 취소는 정확히 같은 두 ID의 진행 중 조회(요청을 끊는다)나 기록 하나만 끝낸다. 다른 요청이나 다른 세대는 건드리지 않는다.
//   그 기록으로 부른 열기 기능이 아직 답하지 않았으면 취소했다고 단정하지 않고 HANDOFF_UNCONFIRMED(다시 시도 불가)로 답한다.
const DESTINATIONS_URL='https://workspace.synk.im/api/native/entry/destinations';
const TIMEOUT_MS=12000,MAX_BYTES=65536,MAX_TOKEN=16384,RECENT_REQUESTS=64;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STATUSES=new Set(['signed-in','signed-out','restoring','error']);
// 서버의 정확한 오류(HTTP 상태와 {error:{code,retryable}}의 code)를 공개 code와 다시 시도 여부로 바꾼다. 표에 없는 조합은
// 일시적으로 조회할 수 없음이며, 429와 5xx만 다시 시도할 수 있다. 비활성 계정(ACCOUNT_UNAVAILABLE)은 다시 로그인해야 하는 경우로 본다.
const SERVER_ERRORS=new Map([
  ['400 INVALID_INPUT',['TEMPORARY_UNAVAILABLE',false]],
  ['401 AUTH_REQUIRED',['LOGIN_REQUIRED',false]],
  ['403 CLIENT_FORBIDDEN',['CLIENT_FORBIDDEN',false]],
  ['403 ACCOUNT_UNAVAILABLE',['LOGIN_REQUIRED',false]],
  ['409 ACCOUNT_MISMATCH',['ACCOUNT_MISMATCH',false]],
  ['429 RATE_LIMITED',['TEMPORARY_UNAVAILABLE',true]],
  ['503 TEMPORARY_UNAVAILABLE',['TEMPORARY_UNAVAILABLE',true]],
]);
const WORKSPACE_STATES=new Set(['assigned','unassigned']),PULSE_STATES=new Set(['assigned','unassigned','unavailable']);
// 열 수 있는 고정 목적지 둘. 조회 결과의 destinations도 이 순서다.
const DESTINATIONS=Object.freeze(['/','/pulse-app/']);
// 기존 제품 열기의 실패를 이 계약의 공개 code와 다시 시도 여부로 바꾼다. PULSE 창 열기(pulse-app.cjs open)의 code와
// Workspace 앱 실행(installations.cjs launch)의 일시적 실패만 표에 있다. 그 밖(설치되지 않음, 확인되지 않은 설치, 지원하지 않는
// 환경, 모르는 답)은 이 PC에서 바로 열 수 없음(HANDOFF_UNAVAILABLE, 다시 시도 불가)이다.
const OPEN_FAILURES=new Map([
  ['PULSE_APP_ACCOUNT_CHANGED',['ACCOUNT_CHANGED',false]],
  ['PULSE_APP_ACCOUNT_PENDING',['TEMPORARY_UNAVAILABLE',true]],
  ['PULSE_APP_STORAGE_UNAVAILABLE',['TEMPORARY_UNAVAILABLE',true]],
  ['PULSE_APP_OPEN_FAILED',['HANDOFF_UNAVAILABLE',true]],
  // 창 안의 Workspace(workspace-app.cjs)도 PULSE와 같은 뜻으로 옮긴다(GPT 엔진 검수 pc-orb-step4-engine-20261122 GA7)
  ['WORKSPACE_APP_ACCOUNT_CHANGED',['ACCOUNT_CHANGED',false]],
  ['WORKSPACE_APP_ACCOUNT_PENDING',['TEMPORARY_UNAVAILABLE',true]],
  ['WORKSPACE_APP_STORAGE_UNAVAILABLE',['TEMPORARY_UNAVAILABLE',true]],
  ['WORKSPACE_APP_OPEN_FAILED',['HANDOFF_UNAVAILABLE',true]],
  ['LAUNCH_FAILED',['HANDOFF_UNAVAILABLE',true]],
]);

function plain(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
function exact(value,keys){
  if(!plain(value))return false;
  if(Reflect.ownKeys(value).length!==keys.length)return false;
  for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!('value' in descriptor))return false;}
  return true;
}
const uuid=value=>typeof value==='string'&&UUID.test(value);
function echoIds(input){
  const named=key=>{try{const field=plain(input)?Object.getOwnPropertyDescriptor(input,key):null;return field&&'value' in field&&uuid(field.value)?field.value:null;}catch{return null;}};
  return {requestId:named('requestId'),accountGeneration:named('accountGeneration')};
}
// main의 계정 결속(company-entry.cjs readBinding과 같은 모양). 읽지 못하거나 모양이 다르면 null이다.
function readBinding(getBinding){
  let value;try{value=getBinding();}catch{return null;}
  if(!exact(value,['accountGeneration','expectedAccountId','epoch','status']))return null;
  const {accountGeneration,expectedAccountId,epoch,status}=value;
  if(!uuid(accountGeneration)||!Number.isSafeInteger(epoch)||epoch<0||!STATUSES.has(status))return null;
  if(expectedAccountId!==null&&!uuid(expectedAccountId))return null;
  return {accountGeneration,expectedAccountId,epoch,status};
}
// 200 응답의 정확한 모양: {version:1,accountMatch:true,workspace:{state,destination:'/'},pulse:{state,destination:'/pulse-app/'}}.
// 이름, 역할, 내부 ID, 임의 목적지, 모르는 키가 하나라도 있으면 배정 결과가 아니다.
function assignment(data){
  if(!exact(data,['version','accountMatch','workspace','pulse'])||data.version!==1||data.accountMatch!==true)return null;
  const {workspace,pulse}=data;
  if(!exact(workspace,['state','destination'])||workspace.destination!=='/'||!WORKSPACE_STATES.has(workspace.state))return null;
  if(!exact(pulse,['state','destination'])||pulse.destination!=='/pulse-app/'||!PULSE_STATES.has(pulse.state))return null;
  const destinations=[];
  if(workspace.state==='assigned')destinations.push('/');
  if(pulse.state==='assigned')destinations.push('/pulse-app/');
  // PULSE를 확인하지 못한 결과는 부분 결과다. 미배정이라고 단정하지 않는다.
  const unavailable=pulse.state==='unavailable'?['pulse']:[];
  return {status:unavailable.length?'partial':'resolved',destinations,unavailable};
}
// 서버 오류 본문 {error:{code,retryable}}의 code. 정확한 모양이 아니면 null이다.
function serverErrorCode(data){
  if(!exact(data,['error'])||!exact(data.error,['code','retryable']))return null;
  return typeof data.error.code==='string'&&typeof data.error.retryable==='boolean'?data.error.code:null;
}
async function readBody(response){
  const body=response&&response.body;
  if(!body)return '';
  const chunks=[];let size=0;
  for await(const chunk of body){
    const bytes=Buffer.from(chunk);
    size+=bytes.length;
    if(size>MAX_BYTES)throw Error('RESPONSE_TOO_LARGE');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function createCompanyEntryDestinations(deps={}){
  const {getBinding,getAccessToken,fetcher}=deps||{};
  const later=typeof deps?.setTimeout==='function'?deps.setTimeout:setTimeout;
  const cancelLater=typeof deps?.clearTimeout==='function'?deps.clearTimeout:clearTimeout;
  const timeoutMs=Number.isSafeInteger(deps?.timeoutMs)&&deps.timeoutMs>0?deps.timeoutMs:TIMEOUT_MS;
  const wired=typeof getBinding==='function'&&typeof getAccessToken==='function'&&typeof fetcher==='function';
  // 고정 목적지마다 main이 넘긴 기존 제품 열기 기능 하나. 화면은 목적지 이름만 대고 이 표나 그 인자를 고르지 못한다.
  const openers=new Map([['/',typeof deps?.openWorkspace==='function'?deps.openWorkspace:null],['/pulse-app/',typeof deps?.openPulse==='function'?deps.openPulse:null]]);
  const inflight=new Set(),recent=[];
  // latest는 가장 나중에 시작한 조회이고, confirmed는 그 조회의 성공 기록이다. opening은 진행 중인 열기가 쓴 기록이다. 그 열기는
  // 열기 기능을 이미 불렀고 아직 답을 받지 못했다. 진행 중인 열기가 없으면 null이다.
  let disposed=false,latest=null,confirmed=null,opening=null;

  const failure=(ids,code,retryable)=>({ok:false,requestId:ids.requestId,accountGeneration:ids.accountGeneration,code,retryable});
  function finish(record,response){
    if(record.done)return;
    record.done=true;inflight.delete(record);
    cancelLater(record.timer);record.timer=null;
    try{record.controller?.abort();}catch{}
    record.controller=null;
    // 가장 나중에 시작한 조회의 성공만 기록이 된다. 그 뒤에 다른 조회가 시작됐으면 이 답은 기록이 되지 못한다.
    if(record===latest){
      latest=null;
      if(response.ok===true&&response.result.destinations.length)
        confirmed=Object.freeze({requestId:record.requestId,accountGeneration:record.accountGeneration,epoch:record.epoch,accountId:record.accountId,isCurrentSender:record.isCurrentSender,destinations:Object.freeze([...response.result.destinations])});
    }
    record.resolve(response);
  }
  const fail=(record,[code,retryable])=>finish(record,failure(record,code,retryable));
  const asking=entry=>{try{return entry.isCurrentSender()===true;}catch{return false;}};
  // 조회나 기록의 계정이 지금도 그대로인지. null이면 그대로, 'renewing'이면 같은 epoch에서 토큰을 갱신하거나 재시도를 기다리는
  // 중, 'changed'면 다른 계정·세대·epoch이거나 결속을 읽지 못한 것이다.
  function accountOf(entry){
    const binding=readBinding(getBinding);
    if(!binding||binding.accountGeneration!==entry.accountGeneration||binding.epoch!==entry.epoch)return 'changed';
    if(binding.status==='signed-in')return binding.expectedAccountId===entry.accountId?null:'changed';
    return binding.status==='restoring'||binding.status==='error'?'renewing':'changed';
  }
  // 이 조회를 시작한 계정 세대, epoch, SYNK ID, 물어본 창이 그대로면 null, 아니면 끝낼 [code, retryable]이다.
  function moved(record){
    if(disposed)return ['TEMPORARY_UNAVAILABLE',false];
    if(!asking(record))return ['TEMPORARY_UNAVAILABLE',false];
    const account=accountOf(record);
    // renewing: 계정이 바뀌지는 않았지만 지금은 답을 읽지 않는다.
    return account==='changed'?['AUTH_CHANGED',false]:account==='renewing'?['TEMPORARY_UNAVAILABLE',true]:null;
  }
  function authFailure(error){
    const code=error&&typeof error==='object'?error.code:null;
    if(code==='AUTH_REQUIRED')return ['LOGIN_REQUIRED',false];
    if(code==='AUTH_CHANGED'||code==='PLATFORM_ACCOUNT_MISMATCH')return ['AUTH_CHANGED',false];
    return ['TEMPORARY_UNAVAILABLE',error?.retryable===true];
  }
  function decide(record,status,data){
    if(status===200){
      const result=assignment(data);
      return result?{ok:true,requestId:record.requestId,accountGeneration:record.accountGeneration,result}:failure(record,'TEMPORARY_UNAVAILABLE',true);
    }
    const mapped=SERVER_ERRORS.get(status+' '+serverErrorCode(data));
    if(mapped)return failure(record,mapped[0],mapped[1]);
    return failure(record,'TEMPORARY_UNAVAILABLE',status===429||status>=500);
  }

  async function run(record){
    let token=null;
    try{
      try{token=await getAccessToken();}
      catch(error){if(!record.done)fail(record,moved(record)||authFailure(error));return;}
      if(record.done){token=null;return;}
      const afterToken=moved(record);
      if(afterToken){token=null;fail(record,afterToken);return;}
      if(typeof token!=='string'||!token||token.length>MAX_TOKEN){token=null;fail(record,['TEMPORARY_UNAVAILABLE',true]);return;}
      const controller=new AbortController();
      record.controller=controller;
      // 12초가 지나면 fetch가 끊김을 알리기를 기다리지 않고 바로 TIMEOUT으로 답한다(finish가 요청도 끊는다).
      record.timer=later(()=>{record.timedOut=true;fail(record,['TIMEOUT',true]);},timeoutMs);
      let response;
      try{
        response=await fetcher(DESTINATIONS_URL,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({expectedAccountId:record.accountId}),credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});
      }catch{
        token=null;
        if(!record.done)fail(record,moved(record)||(record.timedOut?['TIMEOUT',true]:['TEMPORARY_UNAVAILABLE',true]));
        return;
      }
      token=null;
      if(record.done)return;
      const afterResponse=moved(record);
      if(afterResponse){fail(record,afterResponse);return;}
      const status=response&&Number.isSafeInteger(response.status)?response.status:0;
      let text;
      try{text=await readBody(response);}
      catch{if(!record.done)fail(record,moved(record)||(record.timedOut?['TIMEOUT',true]:['TEMPORARY_UNAVAILABLE',true]));return;}
      if(record.done)return;
      cancelLater(record.timer);record.timer=null;
      let data;try{data=text?JSON.parse(text):undefined;}catch{data=undefined;}
      text=null;
      const afterBody=moved(record);
      if(afterBody){fail(record,afterBody);return;}
      finish(record,decide(record,status,data));
    }catch{
      token=null;
      if(!record.done)fail(record,['TEMPORARY_UNAVAILABLE',true]);
    }
  }

  // input은 정확히 {requestId,accountGeneration}이다. options.isCurrentSender는 main이 물어본 창과 프레임이 그대로인지 답한다.
  function resolve(input,options){
    const ids=echoIds(input);
    // 새 조회는 앞 조회가 확인한 기록을 바로 지우고, 아직 진행 중인 앞 조회도 기록이 되지 못하게 한다. 이 조회가 거절되더라도
    // 앞 조회의 결과로는 더 열지 않는다.
    confirmed=null;latest=null;
    if(disposed||!wired)return Promise.resolve(failure(ids,'TEMPORARY_UNAVAILABLE',false));
    if(!exact(input,['requestId','accountGeneration'])||!uuid(input.requestId)||!uuid(input.accountGeneration))return Promise.resolve(failure(ids,'INVALID_INPUT',false));
    const binding=readBinding(getBinding);
    if(!binding)return Promise.resolve(failure(ids,'TEMPORARY_UNAVAILABLE',true));
    if(binding.accountGeneration!==ids.accountGeneration)return Promise.resolve(failure(ids,'AUTH_CHANGED',false));
    if(binding.status==='restoring'||binding.status==='error')return Promise.resolve(failure(ids,'TEMPORARY_UNAVAILABLE',true));
    if(binding.status!=='signed-in'||binding.expectedAccountId===null)return Promise.resolve(failure(ids,'LOGIN_REQUIRED',false));
    // 같은 requestId는 다시 쓰지 않는다. 늦게 온 답이 새 요청의 답으로 읽히지 않게 한다.
    if(recent.includes(ids.requestId))return Promise.resolve(failure(ids,'INVALID_INPUT',false));
    recent.push(ids.requestId);if(recent.length>RECENT_REQUESTS)recent.shift();
    const isCurrentSender=typeof options?.isCurrentSender==='function'?options.isCurrentSender:()=>true;
    const record={requestId:ids.requestId,accountGeneration:ids.accountGeneration,epoch:binding.epoch,accountId:binding.expectedAccountId,isCurrentSender,
      done:false,timer:null,controller:null,timedOut:false,resolve:null};
    const promise=new Promise(done=>{record.resolve=done;});
    inflight.add(record);latest=record;
    void run(record);
    return promise;
  }

  // 기록의 계정과 열기를 청한 창·프레임이 지금도 그대로인지. 그대로면 null, 아니면 끝낼 [code, retryable]이다. 계정이 바뀌었거나
  // 기록을 만든 문서가 아니면 그 기록을 지운다. 같은 epoch의 토큰 갱신은 기록을 남기고 지금만 열지 않는다.
  // called는 열기 기능을 부른 뒤의 확인이다. 그때는 제품 창이 이미 열렸을 수 있다. 그 사이 끝냈거나 기록이 끝났으면(그 요청의
  // 취소, 새 조회, 문서 교체, 계정 변경 알림) 성공도 실패도 단정하지 않는 HANDOFF_UNCONFIRMED다. 기록이 없으니 같은 두 ID로
  // 다시 열 수 없어 다시 시도할 수 없다. 계정이 바뀐 것과 청한 문서가 바뀐 것은 그 이유의 code가 앞선다.
  function current(record,isCurrentSender,called=false){
    if(disposed)return called?['HANDOFF_UNCONFIRMED',false]:['HANDOFF_UNAVAILABLE',false];
    const account=accountOf(record);
    if(account==='changed'){if(confirmed===record)confirmed=null;return ['ACCOUNT_CHANGED',false];}
    if(!asking(record)||!asking({isCurrentSender})){if(confirmed===record)confirmed=null;return ['INVALID_INPUT',false];}
    if(called&&confirmed!==record)return ['HANDOFF_UNCONFIRMED',false];
    return account==='renewing'?['TEMPORARY_UNAVAILABLE',true]:null;
  }

  // 화면의 {destination,requestId,accountGeneration}. 기록에 든 고정 목적지 하나만 main이 넘긴 기존 제품 기능으로 연다.
  // options.isCurrentSender는 열기를 청한 창과 프레임이 그대로인지 답한다. 성공은 정확히 {ok:true,requestId,accountGeneration,
  // destination}이고, 실패는 {ok:false,requestId,accountGeneration,code,retryable}이다. 열린 창이나 앱을 닫거나 다시 불러오지 않는다.
  // 열기 기능을 부른 뒤 그 기록이 끝났으면 성공으로 답하지 않는다(current의 called).
  async function open(input,options){
    const ids=echoIds(input);
    if(disposed||typeof getBinding!=='function')return failure(ids,'HANDOFF_UNAVAILABLE',false);
    if(!exact(input,['destination','requestId','accountGeneration'])||!uuid(input.requestId)||!uuid(input.accountGeneration)||!DESTINATIONS.includes(input.destination))return failure(ids,'INVALID_INPUT',false);
    const destination=input.destination,opener=openers.get(destination);
    if(!opener)return failure(ids,'HANDOFF_UNAVAILABLE',false);
    const binding=readBinding(getBinding);
    if(!binding)return failure(ids,'TEMPORARY_UNAVAILABLE',true);
    // 화면이 아는 세대가 지금 세대와 다르면 계정이 바뀐 것이다.
    if(binding.accountGeneration!==ids.accountGeneration){if(confirmed&&accountOf(confirmed)==='changed')confirmed=null;return failure(ids,'ACCOUNT_CHANGED',false);}
    const record=confirmed;
    // 기록이 없거나(새 조회, 취소, 문서 교체로 지워졌거나 조회가 성공하지 않았다) 다른 요청의 것이거나, 그 조회가 확인하지 않은
    // 목적지면 열지 않는다. 화면은 다시 조회한다.
    if(!record||record.requestId!==ids.requestId||record.accountGeneration!==ids.accountGeneration||!record.destinations.includes(destination))return failure(ids,'INVALID_INPUT',false);
    const isCurrentSender=typeof options?.isCurrentSender==='function'?options.isCurrentSender:()=>true;
    const before=current(record,isCurrentSender);
    if(before)return failure(ids,before[0],before[1]);
    if(opening)return failure(ids,'BUSY',true);
    // 열기 기능을 부르기 직전에 이 기록의 열기가 진행 중이라고 적는다. 그 사이의 취소는 이것을 보고 미확인으로 답한다.
    opening=record;
    let result=null;
    try{result=await opener();}catch{result=null;}
    finally{opening=null;}
    // 여는 사이 계정, 세대, epoch, 청한 문서가 바뀌었거나 그 기록이 끝났으면 성공으로 알리지 않는다.
    const after=current(record,isCurrentSender,true);
    if(after)return failure(ids,after[0],after[1]);
    if(result&&typeof result==='object'&&result.ok===true)return {ok:true,requestId:ids.requestId,accountGeneration:ids.accountGeneration,destination};
    const [code,retryable]=OPEN_FAILURES.get(result&&typeof result==='object'&&typeof result.code==='string'?result.code:'')||['HANDOFF_UNAVAILABLE',false];
    if(code==='ACCOUNT_CHANGED'&&confirmed===record)confirmed=null;
    return failure(ids,code,retryable);
  }

  // 그 요청 하나만 취소한다. 진행 중인 조회면 요청을 끊고(AbortController) CANCELLED로 답하며 늦은 응답은 읽지 않는다. 이미 끝나
  // 기록이 된 조회면 기록만 지운다. 그 기록으로 부른 열기 기능이 아직 답하지 않았으면 제품 창이 이미 열렸을 수 있다. 그때는
  // 취소했다고 단정하지 않고 HANDOFF_UNCONFIRMED(다시 시도 불가)로 답하며, 그 열기도 성공으로 답하지 않는다. 열린 창이나 앱은
  // 닫지 않는다. 정확한 {requestId,accountGeneration}이 아니거나 다른 요청·세대의 이름이면 아무것도 바꾸지 않고 null이다.
  function cancel(input){
    if(!exact(input,['requestId','accountGeneration'])||!uuid(input.requestId)||!uuid(input.accountGeneration))return null;
    const {requestId,accountGeneration}=input;
    for(const record of inflight)if(record.requestId===requestId&&record.accountGeneration===accountGeneration){
      const response=failure(record,'CANCELLED',true);
      finish(record,response);
      return {...response};
    }
    if(confirmed&&confirmed.requestId===requestId&&confirmed.accountGeneration===accountGeneration){
      const handedOff=opening===confirmed;
      confirmed=null;
      return handedOff?failure({requestId,accountGeneration},'HANDOFF_UNCONFIRMED',false):failure({requestId,accountGeneration},'CANCELLED',true);
    }
    return null;
  }

  // 플랫폼 창에 새 문서가 열렸다(main의 did-navigate). 앞 문서가 확인한 기록을 지우고, 앞 문서가 시작한 조회는 답을 읽지
  // 않고 끝낸다(물어본 창이나 프레임이 바뀐 것과 같은 답). 그 기록으로 진행 중인 열기는 성공으로 답하지 않는다.
  function invalidate(){
    confirmed=null;
    for(const record of [...inflight])fail(record,['TEMPORARY_UNAVAILABLE',false]);
  }

  // 계정이 바뀌면(다른 계정, 로그아웃, 새 로그인) 진행 중인 조회를 바로 끝내고 요청을 끊는다. 같은 epoch의 토큰 갱신은 다음 확인에서 판단한다.
  // 기록은 그것을 조회한 계정·세대·epoch의 것이므로 계정이 바뀌면 지운다. 같은 계정의 토큰 갱신은 기록을 남긴다.
  // 그 기록으로 진행 중인 열기는 성공으로 답하지 않는다. 열기 기능이 답할 때도 계정이 바뀐 채면 ACCOUNT_CHANGED다.
  function syncAccount(){
    for(const record of [...inflight]){
      const change=moved(record);
      if(change&&change[0]==='AUTH_CHANGED')fail(record,change);
    }
    if(confirmed&&accountOf(confirmed)==='changed')confirmed=null;
  }

  // 끝낸다. 진행 중인 열기는 열기 기능이 답한 뒤 미확인으로 답한다.
  function dispose(){
    if(disposed)return;
    disposed=true;confirmed=null;latest=null;
    for(const record of [...inflight])fail(record,['TEMPORARY_UNAVAILABLE',false]);
  }

  return Object.freeze({resolve,open,cancel,invalidate,syncAccount,dispose});
}

module.exports={createCompanyEntryDestinations,DESTINATIONS_URL,TIMEOUT_MS,MAX_BYTES};
