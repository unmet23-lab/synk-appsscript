'use strict';
// 회사 공통 진입 · native 회사 초대 전송 관리자.
// 원문: .tmp/solio-quality-20261114/company-entry-contract-v1.md 3·5·7절과 company-entry-native-addendum.md.
// - 맨 코드는 종류를 추정하지 않고 고정 receiver(https://workspace.synk.im/entry/)에서 비소모 분류를 받는다.
//   직원이면 같은 회사 창을 고정 https://workspace.synk.im/ 로 옮기고, 고객이면 주입받은 deliverCustomer에 소유권을 한 번 넘긴다.
// - 엄격히 검사한 직원 전체 링크는 분류 없이 고정 / 로 간다. PULSE 전체 링크는 이 모듈이 받지 않는다(기존 고객 경로).
// - 토큰은 main 메모리에만 있다. 분류 단계에는 복사본만 내주고, 최종 직원 문서의 commit에서 원본을 지운다.
//   URL·쿠키·저장소·로그·응답에 토큰을 넣지 않는다.
// - 최종 문서의 실제 received만 성공이다. 최종 commit 뒤 ACK를 잃으면 HANDOFF_UNCONFIRMED이며 다시 보내지 않는다.
// - 분류는 비소모 조회다. receiver가 토큰 사본을 받은 뒤 알린 분류 실패는 정해진 공개 code와 retryable의 짝
//   (INVITE_REJECTED와 false, RATE_LIMITED와 true, TEMPORARY_UNAVAILABLE과 true)일 때만 그대로 답한다. 그 밖의 분류 실패는
//   HANDOFF_UNAVAILABLE이다. 최종 문서의 실패에서는 원인을 받지 않으므로 최종 commit 뒤는 지금처럼 미확인이다.
// - 취소는 정확히 같은 {requestId,accountGeneration}의 요청 하나만 끝낸다. 토큰이 main을 떠나기 전이면 CANCELLED이고 원본을
//   지운다. 최종 commit 뒤면 HANDOFF_UNCONFIRMED다. 고객 경로로 넘긴 요청은 PULSE의 같은 요청도 함께 취소하고, PULSE가 아직
//   토큰을 내주지 않았을 때만 CANCELLED다. 토큰이 떠나기 전의 취소는 이 관리자가 연 회사 창을 닫으므로 그 창의 preload도 함께 끝난다.
// - 회사 창은 main이 고른 계정·세대별 메모리 partition(companyEntryPartition)에서만 열린다. 플랫폼, Workspace 앱, PULSE의
//   기존 쿠키는 복사하지도 지우지도 않는다. 다른 계정, 로그아웃, 새 로그인이 되면 이전 세대의 창과 그 저장소를 정리한다.
// - 검정 구 4단계(구현 설계 3.4): 분류(receiver) 창은 보이지 않는다. 직원 문서(employee)는 따로 뜨는 창이 아니라 플랫폼 창 안의
//   Workspace 뷰에 싣는다. 그 겉은 main이 주는 openEmployeeSurface(binding)가 그 계정의 Workspace 통에서 만든다. 손님은 직원 문서로
//   가지 않고 SIGN_IN_REQUIRED로 끝난다(분류는 토큰을 쓰지 않으므로 코드는 남는다). 열린 Workspace가 바쁘면 BUSY다.
const path=require('node:path');
const crypto=require('node:crypto');
const {preferences}=require('./security.cjs');
const {installDraftExitGuard,WORKSPACE_EXIT_TEXT}=require('./draft-exit.cjs');

const COMPANY_ORIGIN='https://workspace.synk.im';
const RECEIVER_URL=COMPANY_ORIGIN+'/entry/';
const EMPLOYEE_URL=COMPANY_ORIGIN+'/';
const PRELOAD_PATH=path.join(__dirname,'company-entry-preload.cjs');
const CHANNELS=Object.freeze({offer:'synk:company-invite-offer',commit:'synk:company-invite-commit',result:'synk:company-invite-result'});
const STAGE_MS=15000,TOTAL_MS=60000;
const UNCONFIRMED_CODE='HANDOFF_UNCONFIRMED';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HANDOFF_ID=/^[A-Za-z0-9_-]{32}$/;
const TOKEN=/^[A-Za-z0-9_-]{16,200}$/;
// https, 정확한 호스트, 표준 포트(생략), 사용자 정보 없음, 경로 /, 쿼리 없음, invite 조각 하나. 아래 new URL 비교로 한 번 더 확인한다.
const EMPLOYEE_LINK=/^https:\/\/workspace\.synk\.im\/#invite=([A-Za-z0-9_-]{16,200})$/;
const PUBLIC_CODES=new Set(['INVALID_INPUT','INVITE_REJECTED','TEMPORARY_UNAVAILABLE','RATE_LIMITED','ACCOUNT_CHANGED','ACCOUNT_MISMATCH','BUSY','CANCELLED','HANDOFF_TIMEOUT','HANDOFF_UNAVAILABLE','SIGN_IN_REQUIRED',UNCONFIRMED_CODE]);
const STAGES=Object.freeze({classify:Object.freeze({role:'receiver',url:RECEIVER_URL}),deliver:Object.freeze({role:'employee',url:EMPLOYEE_URL})});
const CLASSIFIED=new Map([['employee','/'],['customer','/pulse-app/']]);
const FINAL_OUTCOMES=new Set(['delivered','unavailable','demo','not-received']);
// receiver가 분류 조회의 실패로 알릴 수 있는 공개 code와 그 retryable의 정확한 짝이다(계약 4절의 무효·만료 403, 빈도 제한 429,
// 서버와 네트워크 실패). 이 짝만 분류 실패 결과(outcome 'classify-failed')가 되어 호스트에 그대로 간다.
const CLASSIFY_FAILURES=new Map([['INVITE_REJECTED',false],['RATE_LIMITED',true],['TEMPORARY_UNAVAILABLE',true]]);
const STATUSES=new Set(['signed-in','signed-out','restoring','error']);
const WINDOW_DEFAULTS=Object.freeze({title:'SYNK Workspace',width:1180,height:860,minWidth:720,minHeight:580,backgroundColor:'#ffffff'});
const COSMETIC_KEYS=Object.freeze([...Object.keys(WINDOW_DEFAULTS),'icon']);
const RECENT_REQUESTS=64;

function plain(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
// 정확한 키 집합만 받는다. 접근자 속성은 값이 바뀔 수 있으므로 거절한다.
function exact(value,keys){
  if(!plain(value))return false;
  if(Reflect.ownKeys(value).length!==keys.length)return false;
  for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!('value' in descriptor))return false;}
  return true;
}
const uuid=value=>typeof value==='string'&&UUID.test(value);
const handoffId=value=>typeof value==='string'&&HANDOFF_ID.test(value);
function echoIds(input){
  try{return {requestId:plain(input)&&uuid(input.requestId)?input.requestId:null,accountGeneration:plain(input)&&uuid(input.accountGeneration)?input.accountGeneration:null};}
  catch{return {requestId:null,accountGeneration:null};}
}
function employeeLinkToken(href){
  if(typeof href!=='string'||href.length>300)return null;
  const match=EMPLOYEE_LINK.exec(href);
  if(!match)return null;
  let url;try{url=new URL(href);}catch{return null;}
  if(url.href!==href||url.origin!==COMPANY_ORIGIN||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash!=='#invite='+match[1])return null;
  return match[1];
}
function readLink(input){
  if(!exact(input,['href','requestId','accountGeneration']))return null;
  const {href,requestId,accountGeneration}=input;
  if(!uuid(requestId)||!uuid(accountGeneration))return null;
  const token=employeeLinkToken(href);
  return token?{requestId,accountGeneration,token,stage:'deliver'}:null;
}
function readCode(input){
  if(!exact(input,['code','requestId','accountGeneration']))return null;
  const {code,requestId,accountGeneration}=input;
  if(!uuid(requestId)||!uuid(accountGeneration)||typeof code!=='string'||!TOKEN.test(code))return null;
  return {requestId,accountGeneration,token:code,stage:'classify'};
}
function readResult(payload){
  const base=['id','requestId','accountGeneration','documentId','outcome'];
  let value;
  if(exact(payload,base)&&FINAL_OUTCOMES.has(payload.outcome))value={id:payload.id,requestId:payload.requestId,accountGeneration:payload.accountGeneration,documentId:payload.documentId,outcome:payload.outcome};
  else if(exact(payload,[...base,'kind','destination'])&&payload.outcome==='classified'&&typeof payload.kind==='string'&&CLASSIFIED.has(payload.kind)&&CLASSIFIED.get(payload.kind)===payload.destination&&payload.documentId!==null)
    value={id:payload.id,requestId:payload.requestId,accountGeneration:payload.accountGeneration,documentId:payload.documentId,outcome:'classified',kind:payload.kind,destination:payload.destination};
  // 분류 실패는 정확히 일곱 키이고, code와 retryable은 정해진 짝 하나여야 한다. 원본 문구나 다른 키가 붙으면 결과가 아니다.
  // commit한 문서만 보낼 수 있으므로 documentId가 null이면 받지 않는다.
  else if(exact(payload,[...base,'code','retryable'])&&payload.outcome==='classify-failed'&&typeof payload.code==='string'&&CLASSIFY_FAILURES.has(payload.code)&&CLASSIFY_FAILURES.get(payload.code)===payload.retryable&&payload.documentId!==null)
    value={id:payload.id,requestId:payload.requestId,accountGeneration:payload.accountGeneration,documentId:payload.documentId,outcome:'classify-failed',code:payload.code,retryable:payload.retryable};
  else return null;
  if(!handoffId(value.id)||!uuid(value.requestId)||!uuid(value.accountGeneration)||(value.documentId!==null&&!uuid(value.documentId)))return null;
  return value;
}
function readBinding(getBinding){
  let value;try{value=getBinding();}catch{return null;}
  if(!exact(value,['accountGeneration','expectedAccountId','epoch','status']))return null;
  const {accountGeneration,expectedAccountId,epoch,status}=value;
  if(!uuid(accountGeneration)||!Number.isSafeInteger(epoch)||epoch<0||!STATUSES.has(status))return null;
  if(expectedAccountId!==null&&!uuid(expectedAccountId))return null;
  return Object.freeze({accountGeneration,expectedAccountId,epoch,status});
}
// main의 인증 상태(auth status 모양)와 auth의 현재 accountGeneration으로 관리자와 배정 조회가 쓰는 결속을 만든다.
// 확정 로그인만 signed-in(auth가 확인한 SYNK ID)이다. 확정 로그아웃과 미설정은 guest(signed-out)다. 그 밖에 오류가 남아 있으면
// error이고, 나머지(같은 계정 토큰 갱신, 로그인 중, 플랫폼 결속 확인 중)는 restoring이다. 화면이 보낸 값은 쓰지 않는다.
// 모양 검사는 readBinding이 한다.
function bindingFromAuth(state,accountGeneration){
  if(!state||typeof state!=='object')return null;
  const id=state.account&&typeof state.account==='object'?state.account.synk_user_id:undefined;
  const status=state.signedIn===true&&state.status==='signed-in'&&typeof id==='string'?'signed-in'
    :confirmedSignOut(state)?'signed-out'
    :state.status==='error'||state.error?'error':'restoring';
  return {accountGeneration:accountGeneration??null,expectedAccountId:status==='signed-in'?id:null,epoch:state.sessionGeneration,status};
}
// 확정 로그아웃인지 본다. 로그인하지 않았고, 계정이 없고, 상태가 로그아웃이나 미설정이어야 한다. auth는 세션 만료와 폐기
// (discard('AUTH_REQUIRED')), 로그인 취소, 로그인 시간 초과 때 세션과 금고를 비운 뒤에도 그 이유를 다시 시도할 수 없는 오류로
// 남긴다. 이 이유 표시는 손님을 막지 않는다. 다시 시도할 수 있는 오류가 남은 로그아웃 표시는 확정이 아니다. 플랫폼 결속이
// 로그아웃을 알렸지만 auth가 아직 같은 세션의 재시도를 기다리는 사이가 그렇다. status가 error나 restoring이면 auth가 그 세션을
// 아직 확인하지 못한 것이므로 여기에 들지 않는다.
function confirmedSignOut(state){
  if(state.signedIn!==false||(state.status!=='signed-out'&&state.status!=='unconfigured'))return false;
  if(state.account!==null&&state.account!==undefined)return false;
  const error=state.error;
  return !error||(plain(error)&&error.retryable!==true);
}
// 인증된 계정 UUID 또는 확정 guest(null)만 쓴다. 복원 중이거나 오류 상태는 쓰지 않는다.
const settled=binding=>!!binding&&(binding.status==='signed-in'?binding.expectedAccountId!==null:binding.status==='signed-out'&&binding.expectedAccountId===null);
// Electron은 이동 이벤트의 세부 정보를 첫 인자로 주고, 옛 판은 위치 인자로 준다. 둘 다 읽는다.
function navigation(details,url,isInPlace,isMainFrame){
  const info=details&&typeof details==='object'?details:{};
  return {url:typeof info.url==='string'?info.url:typeof url==='string'?url:'',sameDocument:typeof info.isSameDocument==='boolean'?info.isSameDocument:isInPlace===true,mainFrame:typeof info.isMainFrame==='boolean'?info.isMainFrame:isMainFrame!==false};
}
function companyNavigation(value){try{const url=new URL(value);return url.protocol==='https:'&&url.origin===COMPANY_ORIGIN&&!url.username&&!url.password;}catch{return false;}}
// 회사 창 partition이 내보내는 요청. 하위 프레임은 없다. 최상위 문서는 고정 회사 origin만, 그 밖의 자원은 회사 호스트의
// https·wss만 받는다. PULSE 창처럼 회사 문서가 청한 다른 https 호스트의 그림과 영상만 더 받는다. 다른 서비스나 다른 곳의
// 로그인 화면은 이 창에서 열리지 않는다.
function companyEntryRequestAllowed(details){
  try{
    if(!details||typeof details.url!=='string'||details.resourceType==='subFrame')return false;
    if(details.resourceType==='mainFrame')return companyNavigation(details.url);
    const url=new URL(details.url);
    if(url.username||url.password)return false;
    if(url.host==='workspace.synk.im'&&(url.protocol==='https:'||url.protocol==='wss:'))return true;
    if(url.protocol!=='https:'||!['image','media'].includes(details.resourceType))return false;
    let referrer=null;try{referrer=typeof details.referrer==='string'&&details.referrer?new URL(details.referrer).origin:null;}catch{referrer=null;}
    return referrer===COMPANY_ORIGIN&&(!details.initiatorOrigin||details.initiatorOrigin===COMPANY_ORIGIN);
  }catch{return false;}
}
// 회사 창의 저장소 partition. main이 확인한 계정(또는 guest)과 그 계정 세대 하나에 묶인다. persist: 접두가 없어 메모리에만 있고
// 사용자 프로필에 아무것도 쓰지 않는다. 플랫폼, Workspace 앱, PULSE partition과 이름이 겹치지 않는다. 다른 계정, 로그아웃,
// 새 로그인은 새 세대라 새 partition을 쓰고, 같은 계정의 토큰 갱신은 세대가 그대로라 같은 partition을 쓴다.
// 복원 중이거나 오류 상태, 화면이 보낸 값은 partition을 고르지 못한다.
function companyEntryPartition(binding){
  if(!binding||typeof binding!=='object'||!uuid(binding.accountGeneration))return null;
  const scope=binding.status==='signed-in'&&uuid(binding.expectedAccountId)?'account:'+binding.expectedAccountId:binding.status==='signed-out'&&binding.expectedAccountId===null?'guest':null;
  if(!scope)return null;
  return 'synk-company-entry-'+crypto.createHash('sha256').update('company-entry-v1\0'+scope+'\0'+binding.accountGeneration).digest('hex').slice(0,40);
}
// main이 관리자에 넘기는 partition 고르기. 처음 쓰는 partition에는 권한 거절, 위 요청 거름, 내려받기 막기를 건다.
// 하나라도 걸지 못하면 null이고 관리자는 HANDOFF_UNAVAILABLE로 끝낸다. sync는 지금 세대가 아닌 partition의 저장소를 지운다.
function createCompanyEntryPartitions({session,getBinding}={}){
  const made=new Map();
  function secure(jar){
    jar.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    jar.setPermissionCheckHandler(()=>false);
    jar.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>callback({cancel:!companyEntryRequestAllowed(details)}));
    jar.on('will-download',event=>event.preventDefault());
  }
  function select(binding){
    const partition=companyEntryPartition(binding);
    if(!partition||!session||typeof session.fromPartition!=='function')return null;
    if(made.has(partition))return partition;
    try{const jar=session.fromPartition(partition);secure(jar);made.set(partition,{generation:binding.accountGeneration,jar});return partition;}
    catch{return null;}
  }
  function sync(){
    const binding=typeof getBinding==='function'?readBinding(getBinding):null;
    if(!binding)return;
    for(const [partition,{generation,jar}] of [...made]){
      if(generation===binding.accountGeneration)continue;
      made.delete(partition);
      void Promise.resolve().then(()=>jar.clearStorageData()).then(()=>jar.clearCache?.()).catch(()=>{});
    }
  }
  return Object.freeze({select,sync});
}
// 고객 경로의 답. main은 PULSE 관리자(pulse-app.cjs openInvite, cancelInvite)의 답을 이 계약의 공개 code로 바꿔 관리자와
// 공개 취소 경로에 돌려준다. 같은 요청의 정확한 두 모양만 바꾸고, 그 밖의 답은 null이라 관리자가 미확인으로 끝낸다(토큰은 이미
// PULSE로 넘어갔다). CANCELLED는 PULSE가 토큰을 문서에 내주기 전에 취소된 것이다.
const PULSE_CODES=new Map([
  ['PULSE_APP_UNAVAILABLE','HANDOFF_UNAVAILABLE'],['SUITE_UNAVAILABLE','TEMPORARY_UNAVAILABLE'],['PULSE_APP_INVITE_INVALID','INVALID_INPUT'],
  ['PULSE_APP_ACCOUNT_PENDING','TEMPORARY_UNAVAILABLE'],['PULSE_APP_ACCOUNT_CHANGED','ACCOUNT_CHANGED'],['PULSE_APP_BUSY','BUSY'],
  ['PULSE_APP_STORAGE_UNAVAILABLE','TEMPORARY_UNAVAILABLE'],['PULSE_APP_OPEN_FAILED','HANDOFF_UNAVAILABLE'],['PULSE_APP_DEMO_ACTIVE','HANDOFF_UNAVAILABLE'],
  ['PULSE_APP_INVITE_RECEIVER_UNAVAILABLE','HANDOFF_UNAVAILABLE'],['PULSE_APP_INVITE_FAILED','HANDOFF_UNAVAILABLE'],['PULSE_APP_INVITE_UNCONFIRMED',UNCONFIRMED_CODE],
  ['CANCELLED','CANCELLED'],
]);
function companyAnswerFromPulse(answer){
  if(exact(answer,['ok','requestId','accountGeneration','state','destination'])&&answer.ok===true)
    return {ok:true,requestId:answer.requestId,accountGeneration:answer.accountGeneration,state:answer.state,destination:answer.destination};
  if(!exact(answer,['ok','requestId','accountGeneration','code','retryable'])||answer.ok!==false||typeof answer.retryable!=='boolean'||typeof answer.code!=='string'||!PULSE_CODES.has(answer.code))return null;
  const code=PULSE_CODES.get(answer.code);
  return {ok:false,requestId:answer.requestId,accountGeneration:answer.accountGeneration,code,retryable:code===UNCONFIRMED_CODE?false:answer.retryable};
}
// main이 관리자에 닿기 전에 거절할 때(다른 클라이언트, smoke, 묶음 로그인 준비 전)의 공개 응답. 입력이 정확한 UUID로
// 요청을 밝혔을 때만 그 값을 되돌린다. 접근자 속성은 읽지 않는다.
function entryRefusal(input,code,retryable){
  const named=key=>{try{const field=plain(input)?Object.getOwnPropertyDescriptor(input,key):null;return field&&'value' in field&&uuid(field.value)?field.value:null;}catch{return null;}};
  return {ok:false,requestId:named('requestId'),accountGeneration:named('accountGeneration'),code,retryable:retryable===true};
}
function cosmetic(options){
  const picked={...WINDOW_DEFAULTS};
  if(plain(options))for(const key of COSMETIC_KEYS)if(Object.hasOwn(options,key))picked[key]=options[key];
  return picked;
}
function destroy(win){try{if(win&&!win.isDestroyed())win.destroy();}catch{}}

function createCompanyEntryManager(deps={}){
  const {BrowserWindow,session,getBinding,deliverCustomer,selectCompanyPartition,dialog}=deps||{};
  const allowNavigation=typeof deps?.allowNavigation==='function'?deps.allowNavigation:companyNavigation;
  const unloadKept=()=>{try{if(typeof deps?.onUnloadKept==='function')deps.onUnloadKept();}catch{}};
  // 고객 경로로 넘긴 요청을 같은 두 ID로 PULSE에서도 취소한다(main: pulseApp.cancelInvite의 답을 companyAnswerFromPulse로 바꾼 것).
  const cancelCustomer=typeof deps?.cancelCustomer==='function'?deps.cancelCustomer:()=>null;
  const later=typeof deps?.setTimeout==='function'?deps.setTimeout:setTimeout;
  const cancelLater=typeof deps?.clearTimeout==='function'?deps.clearTimeout:clearTimeout;
  // 직원 문서를 실을 Workspace 겉(4단계). 답은 {surface, session} · {busy:true} · null이다. 없으면 직원 문서를 열 수 없다
  const openEmployeeSurface=typeof deps?.openEmployeeSurface==='function'?deps.openEmployeeSurface:null;
  const windowOptions=cosmetic(deps?.windowOptions);
  const wired=typeof BrowserWindow==='function'&&!!session&&typeof session.fromPartition==='function'&&typeof getBinding==='function'&&typeof deliverCustomer==='function'&&typeof selectCompanyPartition==='function';
  const windows=new Map();   // 이 관리자가 만든 회사 창 → 만든 때의 계정 세대
  const recent=[];           // 최근 requestId. 같은 값의 재사용을 거절한다.
  let active=null,epoch=0,disposed=false;

  const failure=(ids,code,retryable)=>({ok:false,requestId:ids.requestId,accountGeneration:ids.accountGeneration,code,retryable});
  const success=(req,destination)=>({ok:true,requestId:req.requestId,accountGeneration:req.accountGeneration,state:'received',destination});
  const unconfirmed=req=>failure(req,UNCONFIRMED_CODE,false);
  // 최종 문서 commit이나 고객 경로 이관으로 토큰이 이 관리자를 떠났다. 그 뒤의 끊김은 실패가 아니라 미확인이다.
  const departed=req=>req.finalCommitted||req.transferred;
  const controls=win=>!!active&&!active.done&&!!win&&active.window===win;
  const allowed=url=>{try{return allowNavigation(url)===true;}catch{return false;}};

  function current(req){
    const binding=readBinding(getBinding);
    return settled(binding)&&binding.accountGeneration===req.accountGeneration&&binding.expectedAccountId===req.expectedAccountId&&binding.epoch===req.bindingEpoch;
  }
  function finish(req,response){
    if(!req||req.done)return;
    req.done=true;
    if(active===req)active=null;
    cancelLater(req.stageTimer);cancelLater(req.totalTimer);req.stageTimer=null;req.totalTimer=null;
    req.token=null;req.record=null;epoch+=1;
    const win=req.window;req.window=null;req.contents=null;
    // 성공과 미확인은 회사 창을 남긴다(최종 문서가 초대를 들고 있을 수 있다). 그 밖의 실패는 이 요청이 만든 창을 닫는다.
    if(win&&!(response.ok===true||response.code===UNCONFIRMED_CODE))destroy(win);
    req.resolve(response);
  }
  function interrupt(req,code){if(req&&!req.done)finish(req,departed(req)?unconfirmed(req):failure(req,code,true));}
  function changed(req){if(req&&!req.done)finish(req,departed(req)?unconfirmed(req):failure(req,'ACCOUNT_CHANGED',true));}
  function expire(req){if(req&&!req.done)finish(req,departed(req)?unconfirmed(req):failure(req,'HANDOFF_TIMEOUT',true));}
  function restartStage(req){cancelLater(req.stageTimer);req.stageTimer=later(()=>expire(req),STAGE_MS);}

  // 보낸 프레임이 이 기록의 정확한 webContents·mainFrame이고, 그 문서 URL이 고정 문서(origin·경로, 쿼리·조각 없음)와 같아야 한다.
  function fromDocument(req,record,event){
    try{
      const contents=req.contents;
      if(!event||!contents||event.sender!==contents||req.window.isDestroyed()||(typeof contents.isDestroyed==='function'&&contents.isDestroyed()))return false;
      const frame=event.senderFrame;
      return !!frame&&frame===record.frame&&frame===contents.mainFrame&&frame.detached!==true&&frame.url===record.url;
    }catch{return false;}
  }

  function open(req,binding){
    let partition=null,expectedSession=null,win=null;
    try{partition=selectCompanyPartition(binding);}catch{partition=null;}
    if(typeof partition!=='string'||!partition||partition.length>200)return false;
    try{expectedSession=session.fromPartition(partition);}catch{expectedSession=null;}
    if(!expectedSession)return false;
    try{win=new BrowserWindow({...windowOptions,show:false,autoHideMenuBar:true,webPreferences:preferences(PRELOAD_PATH,partition)});}catch{return false;}
    const contents=win&&win.webContents;
    if(!contents||contents.session!==expectedSession||!contents.ipc||typeof contents.ipc.handle!=='function'||typeof contents.ipc.on!=='function'||typeof contents.loadURL!=='function'){destroy(win);return false;}
    try{guard(win,contents);}catch{destroy(win);return false;}
    windows.set(win,req.accountGeneration);
    req.window=win;req.contents=contents;
    return true;
  }

  // 직원 문서의 겉(Workspace 뷰)을 이 요청에 붙인다. 그 겉의 세션이 받은 통이어야 하고, IPC와 싣기가 있어야 한다
  function attach(req,surface,expectedSession){
    const contents=surface&&surface.webContents;
    if(!contents||!expectedSession||contents.session!==expectedSession||!contents.ipc||typeof contents.ipc.handle!=='function'||typeof contents.ipc.on!=='function'||typeof contents.loadURL!=='function')return false;
    try{guard(surface,contents);}catch{return false;}
    windows.set(surface,req.accountGeneration);
    req.window=surface;req.contents=contents;
    return true;
  }
  // 직원 문서는 Workspace 뷰에 싣는다. 겉을 받는 동안(쓰던 글 물음) 요청이 끝났거나 결속이 달라졌으면 새 겉을 닫고 그대로 끝낸다(설계 검토 R6)
  async function deliverInWorkspace(req){
    const binding=readBinding(getBinding);
    if(!binding||!current(req)){changed(req);return;}
    if(binding.status!=='signed-in'){finish(req,failure(req,'SIGN_IN_REQUIRED',false));return;}
    if(!openEmployeeSurface){finish(req,failure(req,'HANDOFF_UNAVAILABLE',false));return;}
    req.step='preparing';
    let answer=null;
    try{answer=await openEmployeeSurface(binding);}catch{answer=null;}
    const surface=answer&&typeof answer==='object'?answer.surface:null;
    if(req.done){destroy(surface);return;}
    if(!current(req)){destroy(surface);changed(req);return;}
    if(answer&&answer.busy===true){destroy(surface);finish(req,failure(req,'BUSY',true));return;}
    // Workspace 로그인이 아직 끝나지 않았다. 초대를 소모하지 않고 다시 시도하게 한다(workspace-app surfaceForInvite, GPT 엔진 검수 GA2)
    if(answer&&answer.pending===true){destroy(surface);finish(req,failure(req,'TEMPORARY_UNAVAILABLE',true));return;}
    if(!surface||!attach(req,surface,answer.session)){destroy(surface);finish(req,failure(req,'HANDOFF_UNAVAILABLE',false));return;}
    enter(req,'deliver');
  }

  function guard(win,contents){
    // Workspace 관리자가 만든 겉은 새 창(바깥 링크)과 쓰던 글 확인을 이미 걸었다. 다시 걸면 대화상자가 두 번 뜬다(4단계 설계 3.4)
    const workspaceSurface=win&&win.workspaceGuarded===true;
    if(!workspaceSurface)contents.setWindowOpenHandler(()=>({action:'deny'}));
    contents.on('will-attach-webview',event=>event.preventDefault());
    contents.on('will-navigate',(details,url)=>{
      const nav=navigation(details,url);
      // 요청 중에는 페이지가 최상위 문서를 바꾸지 못한다. 단계 이동은 main의 고정 loadURL만 한다.
      if(controls(win)||!allowed(nav.url))details.preventDefault();
    });
    contents.on('will-redirect',(details,url,isInPlace,isMainFrame)=>{
      const nav=navigation(details,url,isInPlace,isMainFrame);
      if(!nav.mainFrame)return;
      if(controls(win)){details.preventDefault();interrupt(active,'HANDOFF_UNAVAILABLE');return;}
      if(!allowed(nav.url))details.preventDefault();
    });
    contents.on('did-start-navigation',(details,url,isInPlace,isMainFrame)=>{
      const nav=navigation(details,url,isInPlace,isMainFrame);
      // main이 고정 문서를 여는 동안이 아니면 최상위 문서 교체는 그 기록을 끝낸다.
      if(controls(win)&&nav.mainFrame&&!nav.sameDocument&&active.step!=='loading')interrupt(active,'HANDOFF_UNAVAILABLE');
    });
    contents.on('did-navigate-in-page',(details,url,isMainFrame)=>{
      const info=details&&typeof details==='object'?details:{};
      const target=typeof info.url==='string'?info.url:url,mainFrame=typeof info.isMainFrame==='boolean'?info.isMainFrame:isMainFrame!==false;
      if(controls(win)&&mainFrame&&active.record&&target!==active.record.url)interrupt(active,'HANDOFF_UNAVAILABLE');
    });
    contents.on('dom-ready',()=>loaded(win));
    contents.on('did-fail-load',(_event,_code,_description,url,isMainFrame)=>{
      if(controls(win)&&isMainFrame!==false&&active.step==='loading'&&(typeof url!=='string'||url===STAGES[active.stage].url))interrupt(active,'HANDOFF_UNAVAILABLE');
    });
    contents.on('render-process-gone',()=>{if(controls(win))interrupt(active,'HANDOFF_UNAVAILABLE');});
    // 직원 문서는 저장하지 않은 가입 입력을 beforeunload로 지킨다. Electron은 그 거절을 말없이 받아들여 창 닫기가 아무 일도
    // 하지 않으므로, 플랫폼·PULSE 창처럼 묻는다. 남기기를 고르면 진행 중인 앱 종료도 멈춘다(main의 onUnloadKept).
    if(!workspaceSurface&&dialog&&typeof dialog.showMessageBoxSync==='function')installDraftExitGuard({contents,window:win,dialog,text:WORKSPACE_EXIT_TEXT});
    if(!workspaceSurface)contents.on('will-prevent-unload',event=>{if(!event.defaultPrevented&&!win.isDestroyed())unloadKept();});
    win.on('closed',()=>{windows.delete(win);if(controls(win))interrupt(active,'CANCELLED');});
    // 이 창의 webContents에만 묶인 IPC다. 다른 창이나 전역 ipcMain에서 온 메시지는 여기 닿지 않는다.
    contents.ipc.handle(CHANNELS.commit,(event,payload)=>commit(win,event,payload));
    contents.ipc.on(CHANNELS.result,(event,payload)=>{result(win,event,payload);});
  }

  function enter(req,stageName){
    req.stage=stageName;req.step='loading';req.record=null;
    restartStage(req);
    const sequence=++req.loads;
    let pending;
    // 이동 URL은 고정 문서뿐이다. 토큰, requestId, receipt, 쿼리, 조각을 넣지 않는다.
    try{pending=req.contents.loadURL(STAGES[stageName].url);}catch{interrupt(req,'HANDOFF_UNAVAILABLE');return;}
    Promise.resolve(pending).catch(()=>{if(active===req&&!req.done&&req.step==='loading'&&req.loads===sequence)interrupt(req,'HANDOFF_UNAVAILABLE');});
  }

  function loaded(win){
    const req=active;
    if(!controls(win)||req.step!=='loading')return;
    const stage=STAGES[req.stage],frame=req.contents.mainFrame;
    if(!frame||frame.url!==stage.url||frame.detached===true){interrupt(req,'HANDOFF_UNAVAILABLE');return;}
    if(!current(req)){changed(req);return;}
    epoch+=1;
    const record={id:crypto.randomBytes(24).toString('base64url'),epoch,stage:req.stage,role:stage.role,url:stage.url,frame,documentId:null};
    req.record=record;req.step='offered';
    try{frame.send(CHANNELS.offer,{id:record.id,requestId:req.requestId,accountGeneration:req.accountGeneration,expectedAccountId:req.expectedAccountId});}
    catch{interrupt(req,'HANDOFF_UNAVAILABLE');return;}
    // 분류 창은 보이지 않는다. 직원 문서의 겉(Workspace 뷰)은 show()가 플랫폼 창을 앞으로 부를 뿐이고, 뷰를 보일지는 화면이 정한다
    if(req.stage==='deliver'){try{if(!win.isDestroyed())win.show();}catch{}}
  }

  function commit(win,event,payload){
    const req=active;
    if(!controls(win)||req.step!=='offered'||!req.record)return null;
    if(!exact(payload,['id','requestId','accountGeneration','documentId']))return null;
    const {id,requestId,accountGeneration,documentId}=payload,record=req.record;
    if(!handoffId(id)||!uuid(documentId)||id!==record.id||requestId!==req.requestId||accountGeneration!==req.accountGeneration)return null;
    if(record.epoch!==epoch||!fromDocument(req,record,event))return null;
    if(!current(req)){changed(req);return null;}
    // 첫 commit의 documentId를 고정한다. 같은 id의 두 번째 commit은 step이 offered가 아니므로 위에서 거절된다.
    record.documentId=documentId;req.step='committed';
    restartStage(req);
    const token=req.token;
    // 분류 단계는 복사본만 내준다. 원본은 최종 직원 문서의 commit에서만 지운다.
    if(record.stage==='deliver'){req.token=null;req.finalCommitted=true;}
    return {id,requestId,accountGeneration,documentId,token};
  }

  function result(win,event,payload){
    const req=active;
    if(!controls(win)||!req.record)return false;
    const value=readResult(payload);
    if(!value)return false;
    const record=req.record;
    if(value.id!==record.id||value.requestId!==req.requestId||value.accountGeneration!==req.accountGeneration)return false;
    if(record.epoch!==epoch||!fromDocument(req,record,event))return false;
    if(!current(req)){changed(req);return false;}
    if(req.step==='offered'){
      // commit 전에는 documentId가 null인 실패만 받는다. offered 단계의 delivered, classified, 분류 실패는 거절한다.
      if(value.documentId!==null||value.outcome==='delivered'||value.outcome==='classified'||value.outcome==='classify-failed')return false;
      interrupt(req,'HANDOFF_UNAVAILABLE');
      return true;
    }
    if(req.step!=='committed'||value.documentId!==record.documentId)return false;
    if(record.stage==='classify'){
      if(value.outcome==='delivered')return false;   // receiver의 delivered는 거절한다.
      if(value.outcome==='classified'){classified(req,value.kind);return true;}
      // 분류 실패는 다른 종류로 추측하지 않는다. 원본 토큰은 아직 main에만 있으므로 미확인이 아니다. receiver가 알린 정해진
      // 짝이면 그 code와 retryable로 끝내고, 호스트 화면이 그 code의 고정 문구로 원인을 알린다. 토큰 사본을 받은 receiver 창은
      // 다른 실패처럼 닫는다.
      if(value.outcome==='classify-failed'){finish(req,departed(req)?unconfirmed(req):failure(req,value.code,value.retryable));return true;}
      // 원인을 싣지 않은 분류 실패는 HANDOFF_UNAVAILABLE이다.
      interrupt(req,'HANDOFF_UNAVAILABLE');
      return true;
    }
    // employee의 classified와 분류 실패는 거절한다. 최종 commit 뒤의 실패는 원인과 관계없이 미확인이다.
    if(value.outcome==='classified'||value.outcome==='classify-failed')return false;
    finish(req,value.outcome==='delivered'?success(req,'/'):unconfirmed(req));
    return true;
  }

  function classified(req,kind){
    // 분류 단계는 끝났다. 분류 성공은 최종 성공이 아니다.
    cancelLater(req.stageTimer);req.stageTimer=null;req.record=null;epoch+=1;
    // 직원: 분류 창을 요청에서 먼저 떼고 닫는다(그 창의 closed가 요청을 CANCELLED로 끝내지 않게). 같은 요청과 토큰으로 Workspace 뷰에서 잇는다
    if(kind==='employee'){const receiver=req.window;req.window=null;req.contents=null;windows.delete(receiver);destroy(receiver);void deliverInWorkspace(req);return;}
    // 고객: receiver 창을 닫고, 같은 요청과 토큰의 소유권을 PULSE 현재 계정 경로에 한 번 넘긴다.
    // 회사 창의 쿠키나 partition은 PULSE로 옮기지 않는다. 넘긴 뒤에는 이 관리자가 토큰을 갖지 않는다.
    const token=req.token;
    req.token=null;req.transferred=true;req.stage='customer';req.step='transferred';
    const win=req.window;req.window=null;req.contents=null;
    destroy(win);
    let pending;
    try{pending=deliverCustomer({token,requestId:req.requestId,accountGeneration:req.accountGeneration});}catch{pending=null;}
    Promise.resolve(pending).then(value=>{if(!req.done)finish(req,customerResult(req,value));},()=>{if(!req.done)finish(req,unconfirmed(req));});
  }

  function customerResult(req,value){
    if(exact(value,['ok','requestId','accountGeneration','state','destination'])&&value.ok===true&&value.requestId===req.requestId&&value.accountGeneration===req.accountGeneration&&value.state==='received'&&value.destination==='/pulse-app/')return success(req,'/pulse-app/');
    if(exact(value,['ok','requestId','accountGeneration','code','retryable'])&&value.ok===false&&value.requestId===req.requestId&&value.accountGeneration===req.accountGeneration&&PUBLIC_CODES.has(value.code)&&typeof value.retryable==='boolean')return failure(req,value.code,value.retryable);
    // 소유권을 넘긴 뒤의 알 수 없는 응답은 성공도 확정 실패도 아니다.
    return unconfirmed(req);
  }

  function start(read,input){
    const ids=echoIds(input);
    if(disposed||!wired)return Promise.resolve(failure(ids,'HANDOFF_UNAVAILABLE',false));
    const parsed=read(input);
    if(!parsed)return Promise.resolve(failure(ids,'INVALID_INPUT',false));
    const binding=readBinding(getBinding);
    if(!binding)return Promise.resolve(failure(parsed,'HANDOFF_UNAVAILABLE',false));
    if(binding.status==='restoring'||binding.status==='error')return Promise.resolve(failure(parsed,'TEMPORARY_UNAVAILABLE',true));
    if(!settled(binding))return Promise.resolve(failure(parsed,'HANDOFF_UNAVAILABLE',false));
    if(binding.accountGeneration!==parsed.accountGeneration)return Promise.resolve(failure(parsed,'ACCOUNT_CHANGED',true));
    if(active&&!active.transferred&&!current(active))changed(active);
    if(active)return Promise.resolve(failure(parsed,'BUSY',true));
    if(recent.includes(parsed.requestId))return Promise.resolve(failure(parsed,'INVALID_INPUT',false));
    recent.push(parsed.requestId);if(recent.length>RECENT_REQUESTS)recent.shift();
    const req={requestId:parsed.requestId,accountGeneration:parsed.accountGeneration,expectedAccountId:binding.expectedAccountId,bindingEpoch:binding.epoch,token:parsed.token,
      window:null,contents:null,stage:null,step:null,record:null,loads:0,finalCommitted:false,transferred:false,done:false,stageTimer:null,totalTimer:null,resolve:null};
    parsed.token=null;
    const promise=new Promise(resolve=>{req.resolve=resolve;});
    active=req;
    req.totalTimer=later(()=>expire(req),TOTAL_MS);
    // 직원 전체 링크는 분류 없이 바로 Workspace 뷰로 간다. 맨 코드는 숨은 분류 창에서 시작한다
    if(parsed.stage==='deliver'){void deliverInWorkspace(req);return promise;}
    if(!open(req,binding)){finish(req,failure(req,'HANDOFF_UNAVAILABLE',false));return promise;}
    enter(req,parsed.stage);
    return promise;
  }

  // PULSE가 같은 요청을 토큰을 문서에 내주기 전에 취소했다는 정확한 답(CANCELLED)인지.
  function customerCancelled(req){
    let answer=null;
    try{answer=cancelCustomer({requestId:req.requestId,accountGeneration:req.accountGeneration});}catch{answer=null;}
    return exact(answer,['ok','requestId','accountGeneration','code','retryable'])&&answer.ok===false&&answer.requestId===req.requestId&&answer.accountGeneration===req.accountGeneration&&answer.code==='CANCELLED';
  }

  function cancel(input){
    if(!exact(input,['requestId','accountGeneration']))return null;
    const {requestId,accountGeneration}=input,req=active;
    if(!uuid(requestId)||!uuid(accountGeneration)||!req||req.done||req.requestId!==requestId||req.accountGeneration!==accountGeneration)return null;
    // 토큰이 이미 최종 문서로 떠났으면 되돌렸다고 말하지 않는다. 고객 경로로 넘긴 요청은 PULSE의 같은 요청도 같은 두 ID로
    // 취소한다. PULSE가 아직 토큰을 내주지 않았으면 main 어디에도 토큰이 남지 않은 취소(CANCELLED)이고, 이미 내줬거나 답을
    // 모르면 미확인이다.
    const response=req.transferred?(customerCancelled(req)?failure(req,'CANCELLED',true):unconfirmed(req))
      :departed(req)?unconfirmed(req):failure(req,'CANCELLED',true);
    finish(req,response);
    return response;
  }

  function syncAccount(){
    const req=active;
    // 고객 경로로 넘긴 요청은 PULSE 관리자의 계정 정책이 끝낸다.
    if(req&&!req.transferred&&!current(req))changed(req);
    const binding=readBinding(getBinding);
    if(!binding)return;
    // 다른 계정, 로그아웃, 새 로그인은 새 세대다. 이전 세대에 만든 회사 창은 바로 없앤다. 떠나기 확인에 맡기면 이전 계정의
    // 회사 화면이 새 계정 아래에 남을 수 있다(PULSE 창과 같은 정책). 같은 계정의 토큰 갱신은 세대가 같아 창이 남는다.
    for(const [win,generation] of [...windows])if(generation!==binding.accountGeneration&&!controls(win)){windows.delete(win);destroy(win);}
  }

  function dispose(){
    if(disposed)return;
    disposed=true;
    if(active)finish(active,departed(active)?unconfirmed(active):failure(active,'CANCELLED',true));
  }

  return Object.freeze({handoffLink:input=>start(readLink,input),inspectCode:input=>start(readCode,input),cancel,syncAccount,dispose});
}

module.exports={createCompanyEntryManager,createCompanyEntryPartitions,companyEntryPartition,companyEntryRequestAllowed,companyAnswerFromPulse,entryRefusal,bindingFromAuth,readBinding,CHANNELS,COMPANY_ORIGIN,RECEIVER_URL,EMPLOYEE_URL,PRELOAD_PATH,STAGE_MS,TOTAL_MS,UNCONFIRMED_CODE};
