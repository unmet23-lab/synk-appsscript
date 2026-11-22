'use strict';
const {createHash}=require('node:crypto');
const path=require('node:path');
const {installDraftExitGuard,WORKSPACE_EXIT_TEXT}=require('./draft-exit.cjs');
const {createDownloadHandler}=require('./downloads.cjs');

// Workspace를 플랫폼 창 안의 뷰로 연다(검정 구 4단계 구현 설계 3.2). PULSE 관리자(pulse-app.cjs)의 창 관리와 계정 결속을 따른다.
// - 로그인 길은 플랫폼의 SYNK ID 하나다(설계 2절). 뷰의 preload(workspace-view-preload.cjs)가 Workspace 앱과 같은 native 연결을 준다.
//   회사 화면은 그 연결로 플랫폼의 SYNK ID에 이어진 회사 세션을 받는다. 손님 통은 없다.
// - 쿠키 통은 로그인한 SYNK ID마다 하나다. 같은 계정의 토큰 갱신은 통과 뷰를 그대로 둔다. 다른 계정, 로그아웃, 확정 거절은
//   뷰를 묻지 않고 닫고 앞 계정의 통을 지운다. 지워도 다음 로그인에서 native 연결이 회사 세션을 다시 받는다.
// - 직원 초대는 회사 입구(company-entry.cjs)가 surfaceForInvite로 받은 이 계정의 겉에 싣는다. 회사 입구 preload는 이 통에 세션 preload로 건다.
//   그 preload는 고정 두 문서(https://workspace.synk.im/, /entry/)에서만 움직여 평소의 /?tab=messenger에서는 아무것도 하지 않는다.
// - 권한은 Windows의 마이크(소리만)와 화면 공유만, 지금 Workspace 겉의 회사 출처 프레임에만 연다(설계 4절). 그 밖은 Workspace 앱처럼 거절한다.
const WORKSPACE_ORIGIN='https://workspace.synk.im';
const WORKSPACE_ENTRY=WORKSPACE_ORIGIN+'/?tab=messenger';
const WORKSPACE_VIEW_PRELOAD=path.join(__dirname,'workspace-view-preload.cjs');
const COMPANY_ENTRY_PRELOAD=path.join(__dirname,'company-entry-preload.cjs');
// Workspace 앱 창의 바탕과 같다. 회사 화면은 밝은 바탕이라 느린 그리기에도 검은 틀이 비치지 않는다
const WORKSPACE_BACKGROUND='#ffffff';
const LIVEKIT_HOST=/^[a-z0-9-]+\.livekit\.cloud$/;
// 뷰의 native 연결 통로(workspace-view-preload.cjs와 같은 이름). 이 뷰의 webContents.ipc에만 단다
const NATIVE_CHANNEL=Object.freeze({status:'synk:workspace-native-auth-status',changed:'synk:workspace-native-auth-changed',account:'synk:workspace-native-account-request',signIn:'synk:workspace-native-sign-in',cancel:'synk:workspace-native-sign-in-cancel',signOut:'synk:workspace-native-sign-out',company:'synk:workspace-native-company-request'});
// 「내 수업」 교사 로그인 통로(workspace-view-preload.cjs와 같은 이름, 4단계 구현 설계 14.3). 이 뷰의 webContents.ipc에만 단다
const TEACHER_CHANNEL=Object.freeze({environment:'synk:workspace-teacher-environment',status:'synk:workspace-teacher-auth-status',changed:'synk:workspace-teacher-auth-changed',signIn:'synk:workspace-teacher-sign-in',cancel:'synk:workspace-teacher-sign-in-cancel',signOut:'synk:workspace-teacher-sign-out',account:'synk:workspace-teacher-account-request'});
const TEACHER_NONE=Object.freeze({configured:false,signedIn:false,status:'unconfigured',sessionGeneration:0,account:null,error:null});
const TEACHER_ENVIRONMENT=Object.freeze({clientId:'teacher',authProduct:'world',embedded:true,hostClientId:'platform'});
const EXTERNAL_GAP_MS=1500;
// 화면 공유에서 사람이 고른 것이 뒤따르는 표시 처리기에 쓰일 수 있는 시간
const SHARE_TICKET_MS=10000;

function parsed(value){try{if(typeof value!=='string'||value.length>4096)return null;const url=new URL(value);return url.username||url.password?null:url;}catch{return null;}}
const originOf=value=>parsed(value)?.origin||null;
// 최상위 문서는 회사 출처의 / 경로(쿼리 아무거나)만이다. Workspace 앱의 규칙과 같다(security.cjs allowedNavigation의 messenger)
function workspaceNavigationAllowed(value){const url=parsed(value);return !!url&&url.protocol==='https:'&&url.origin===WORKSPACE_ORIGIN&&url.pathname==='/';}
// 이 통이 내보내는 요청. 최상위는 위의 문서만, 하위 프레임은 회사 출처만(메신저 iframe /messenger/), 스크립트와 작업자도 회사 출처만이다.
// LiveKit 통화 서버(wss · https *.livekit.cloud)는 받는다. 그 밖의 https · wss는 회사 문서가 청한 것만 받는다(referrer가 회사 출처).
// 이것은 Workspace 앱이 덮어쓰던 CSP(connect-src https: wss:, img-src https:)와 같은 넓이다. 서버의 CSP는 덮어쓰지 않는다
function workspaceRequestAllowed(details){
  try{
    if(!details||typeof details.url!=='string')return false;
    if(details.resourceType==='mainFrame')return workspaceNavigationAllowed(details.url);
    const url=parsed(details.url);if(!url)return false;
    if(details.resourceType==='subFrame')return url.protocol==='https:'&&url.origin===WORKSPACE_ORIGIN;
    if(url.host==='workspace.synk.im')return url.protocol==='https:'||url.protocol==='wss:';
    if(['script','worker','sharedWorker','serviceWorker','object','wasm'].includes(details.resourceType))return false;
    if(LIVEKIT_HOST.test(url.hostname)&&!url.port)return url.protocol==='wss:'||url.protocol==='https:';
    if(url.protocol!=='https:'&&url.protocol!=='wss:')return false;
    // 회사 서버는 Referrer-Policy: no-referrer라 referrer가 빈다. 브라우저가 적는 요청 출처(initiatorOrigin)로 본다(GPT 엔진 검수 GA4)
    return originOf(details.initiatorOrigin)===WORKSPACE_ORIGIN||originOf(details.referrer)===WORKSPACE_ORIGIN;
  }catch{return false;}
}
/*
  회사 요청(exchange · renew)에 싣는 Workspace 토큰은 이 뷰의 SYNK ID 것이어야 한다.
  - 플랫폼 계정을 바꾼 뒤 Suite 따라가기(500ms마다)가 아직 못 따라왔으면 앞 계정의 토큰이 새 계정의 통에서 나간다(GPT 엔진 검수 b GA1).
  - 뷰를 만든 계정이 지금 플랫폼 계정이 아니거나 그 뷰가 닫혔으면 그 통에서 아무것도 보내지 않는다(c GA4). current가 그것을 본다.
  토큰은 먼저 받는다. 받기가 막혔던 갱신을 되살리기 때문이다(c GA3). 받은 뒤 그 토큰의 계정과 뷰가 아직 살아 있는지를 견준다
*/
async function workspaceAccessToken(service,accountId,{refresh,current}={}){
  const fail=code=>Object.assign(new Error(code),{code});
  if(!service)throw fail('AUTH_UNAVAILABLE');
  const live=()=>{try{return typeof current!=='function'||current()===true;}catch{return false;}};
  const same=()=>{try{const status=service.status();return status?.signedIn===true&&status.account?.synk_user_id===accountId;}catch{return false;}};
  if(typeof accountId!=='string'||accountId===''||!live())throw fail('WORKSPACE_ACCOUNT_CHANGED');
  const token=await service.getAccessToken();
  if(!live())throw fail('WORKSPACE_ACCOUNT_CHANGED');
  if(!same()){void Promise.resolve().then(()=>refresh?.()).catch(()=>{});throw fail('WORKSPACE_ACCOUNT_PENDING');}
  return token;
}
// 시스템 브라우저로 넘길 주소. http · https이고 사용자 정보가 없으며 뷰 안에서 열 문서가 아니어야 한다
function workspaceExternalDestination(value){const url=parsed(value);return url&&['http:','https:'].includes(url.protocol)&&!workspaceNavigationAllowed(value)?url.href:null;}
// 계정 통은 확인된 SYNK ID 하나에만 묶인다. 손님, 복원 중, 오류, anonymous-local은 통이 없다
const accountScope=id=>typeof id==='string'&&/^[a-zA-Z0-9_.-]{1,120}$/.test(id)&&id!=='anonymous-local'?'account:'+id:null;
function workspaceScopeOf(account){const scope=accountScope(account?.account?.synk_user_id);return account?.signedIn===true&&account.status==='signed-in'&&scope?scope:null;}
function workspaceAppPartition(scope){return 'persist:synk-workspace-app-'+createHash('sha256').update('workspace-app-v1\0'+scope).digest('hex').slice(0,40);}
// 요청한 프레임이 이 웹 내용의 회사 출처 프레임(주 프레임이나 같은 출처 iframe)인지
function workspaceFrame(contents,frame){try{return !!frame&&!!contents&&frame.top===contents.mainFrame&&originOf(frame.url)===WORKSPACE_ORIGIN;}catch{return false;}}

/*
  getAccount, getRenewingAccount: PULSE 관리자와 같다(본체의 accountStatus, renewingAccount).
  createSurface: 뷰 자리(space-view.cjs)의 겉 만들기. closeSurfaceForExit: 그 자리의 closeForExit(쓰던 글을 묻고 닫는다).
  isSurfaceVisible: 지금 뷰가 보이는지(화면 공유는 보이는 뷰에서만 청할 수 있다).
  native: {prepare(), status(), accountLoad(), signIn(), cancelSignIn(), signOut(), retryLogin(), companyRequest(session, {accountId, current})} — 본체가 주는 native 연결의 실제 일.
  chooseShare(): 본체가 플랫폼 화면에서 고르게 하고 {video} 또는 null을 돌려준다. 소리는 쓰지 않는다(설계 4.2).
*/
// screenShare: 화면 공유를 열지(기본 끔). Electron 44는 getDisplayMedia와 옛 화면 캡처(getUserMedia의 chromeMediaSource)를 권한 단계에서
// 같은 빈 media 요청으로 준다. 옛 캡처는 표시 처리기를 거치지 않아 사람이 고른 창과 다른 화면 전체와 시스템 소리를 잡을 수 있다.
// 둘을 가를 길이 생길 때까지 본체는 끈 채로 둔다(GPT 엔진 검수 pc-orb-step4-engine-20261122 GA1). 고르기 길은 시험이 켜서 지킨다
function createWorkspaceApp({clientId,platform=process.platform,getAccount,getRenewingAccount=()=>null,createSurface,closeSurfaceForExit=async()=>'none',isSurfaceVisible=()=>false,session,dialog,openExternal,getDownloads,native={},chooseShare=async()=>null,screenShare=false,onUnloadKept=()=>{},loadTimeoutMs=25000,timers=globalThis,now=()=>Date.now()}){
  const setTimeout=(fn,ms)=>timers.setTimeout(fn,ms),clearTimeout=handle=>timers.clearTimeout(handle);
  let owner=workspaceScopeOf(getAccount?.()),epoch=0,activeSurface=null,activeSession=null,pending=null,disposed=false,cleanup=Promise.resolve(),lastExternal=0,sharing=false;
  // micDocument는 마이크를 허락한 문서(겉의 주 프레임)다. 그 문서가 사는 동안 통화 중으로 센다(검토 R11).
  // 문서는 새 문서 싣기(did-navigate)의 차례로 가린다. 회사 화면은 같은 문서에서 replaceState로 주소를 바꾸므로 주소로 견주지 않는다
  let micDocument=null,documentSeq=0;
  const dirtySessions=new Set(),made=new Map();
  function clearOldSessions(){cleanup=cleanup.catch(()=>{}).then(async()=>{for(const old of dirtySessions){await old.clearStorageData();await old.clearCache?.();dirtySessions.delete(old);}}).catch(()=>{});return cleanup;}
  function closeSurface(){const old=activeSurface;activeSurface=null;if(old&&!old.isDestroyed())old.destroy();}
  function renewing(){return owner!==null&&accountScope(getRenewingAccount())===owner;}
  function ownerAccount(){return typeof owner==='string'?owner.slice('account:'.length):null;}
  function alive(){return !!activeSurface&&!activeSurface.isDestroyed();}
  function syncContext(account=getAccount?.()){
    if(disposed)return null;
    const next=workspaceScopeOf(account);if(next===owner)return next;
    if(next===null&&renewing())return null;
    ++epoch;const old=activeSession||(owner?session.fromPartition(workspaceAppPartition(owner)):null);owner=next;activeSession=null;pending=null;closeSurface();
    if(old){dirtySessions.add(old);void clearOldSessions();}
    return owner;
  }
  // company: 회사 문서의 새 창 링크(_blank). 지금 뷰를 바꾸면 통화와 쓰던 화면이 내려가므로 회사 문서도 시스템 브라우저로 연다(GPT 엔진 검수 c GA2 · GA6)
  function openOutside(value,{company=false}={}){
    const destination=company&&workspaceNavigationAllowed(value)?parsed(value).href:workspaceExternalDestination(value);if(!destination)return;
    const at=now();if(at-lastExternal<EXTERNAL_GAP_MS)return;lastExternal=at;
    void Promise.resolve().then(()=>openExternal(destination)).catch(()=>{});
  }
  function permissionAllowed(contents,permission,details){
    if(platform!=='win32'||!alive()||contents!==activeSurface.webContents)return false;
    if(originOf(details?.requestingUrl)!==WORKSPACE_ORIGIN)return false;
    if(permission==='media'){const types=details?.mediaTypes;const ok=Array.isArray(types)&&types.length>0&&types.every(type=>type==='audio');if(ok)micDocument=documentOf(contents);return ok;}
    return false;
  }
  // 화면을 담는 요청인지. Electron 44의 getDisplayMedia는 장치 종류가 빈 media 요청으로 온다(진짜 Electron에서 잰 것, tools/workspace-view-smoke.cjs)
  const screenAsk=(permission,details)=>permission==='display-capture'||permission==='media'&&Array.isArray(details?.mediaTypes)&&details.mediaTypes.length===0;
  // 확인 처리기에는 웹 내용이 없을 수 있다. 이 통은 Workspace 전용이라 그때는 요청 출처와 품은 출처로 본다(검토 R15)
  function permissionChecked(contents,permission,requestingOrigin,details){
    if(platform!=='win32'||!alive())return false;
    if(contents&&contents!==activeSurface.webContents)return false;
    // Electron은 출처를 끝에 /가 붙은 URL 꼴로 넘기기도 한다. URL로 풀어 출처 단위로 견준다(GPT 엔진 검수 GA5)
    if(originOf(requestingOrigin)!==WORKSPACE_ORIGIN&&originOf(details?.requestingUrl)!==WORKSPACE_ORIGIN)return false;
    if(details?.embeddingOrigin&&originOf(details.embeddingOrigin)!==WORKSPACE_ORIGIN)return false;
    return permission==='media'&&details?.mediaType==='audio'||permission==='speaker-selection';
  }
  function documentOf(contents){try{return contents.mainFrame?{contents,frame:contents.mainFrame,seq:documentSeq}:null;}catch{return null;}}
  // 트레이 메모리 줄이기가 묻는다. 소리가 나거나, 캡처되거나, 마이크를 허락한 문서가 그대로면 통화 중이다
  function busy(){
    if(!alive())return false;
    const contents=activeSurface.webContents;
    try{if(contents.isCurrentlyAudible()||contents.isBeingCaptured())return true;}catch{}
    const now=documentOf(contents);
    return !!micDocument&&!!now&&micDocument.contents===now.contents&&micDocument.frame===now.frame&&micDocument.seq===now.seq;
  }
  /* 화면 공유(설계 4.2). Electron 44에서 getDisplayMedia는 표시 처리기보다 먼저 장치 종류가 빈 media 권한 요청으로 온다.
     옛 화면 캡처(getUserMedia의 chromeMediaSource:'desktop')도 똑같은 요청으로 오고, 허락하면 고르기 없이 화면과 시스템 소리를 잡는다.
     둘을 가를 수 없으므로 그 권한 요청에서 본체의 고르기를 묻는다. 사람이 고르지 않으면 어느 길도 열리지 않는다.
     고른 것(ticket)은 곧 이어 오는 표시 처리기가 한 번 쓴다. 지금 겉의 회사 출처 문서가 보이는 동안 청한 것만, 한 번에 하나만 묻는다 */
  let shareTicket=null;
  async function shareConsent(contents,details){
    try{
      if(platform!=='win32'||sharing||!alive()||contents!==activeSurface.webContents||originOf(details?.requestingUrl)!==WORKSPACE_ORIGIN||!isSurfaceVisible())return false;
      const surface=activeSurface,expected=epoch;
      shareTicket=null;sharing=true;
      let chosen=null;
      try{chosen=await chooseShare();}finally{sharing=false;}
      if(!chosen?.video||disposed||expected!==epoch||activeSurface!==surface||!alive())return false;
      shareTicket={contents,video:chosen.video,at:now()};
      return true;
    }catch{return false;}
  }
  function shareRequest(request,callback){
    // 거절은 null이다. 빈 물건({})은 Electron이 형식 오류를 던진다(진짜 Electron에서 잰 것)
    let answered=false;const answer=value=>{if(answered)return;answered=true;try{callback(value);}catch{}};
    try{
      const ticket=shareTicket;shareTicket=null;
      if(platform!=='win32'||!ticket||!alive()||ticket.contents!==activeSurface.webContents||now()-ticket.at>SHARE_TICKET_MS||!request?.videoRequested||!workspaceFrame(ticket.contents,request.frame)){answer(null);return;}
      // 소리는 청해도 주지 않는다(설계 4.2, 검토 R10)
      answer({video:ticket.video});
    }catch{answer(null);}
  }
  function createSession(scope){
    const isolated=session.fromPartition(workspaceAppPartition(scope));
    if(made.has(isolated))return isolated;
    isolated.setPermissionRequestHandler((contents,permission,callback,details)=>{
      let answered=false;const answer=value=>{if(answered)return;answered=true;try{callback(value===true);}catch{}};
      if(screenAsk(permission,details)){if(screenShare!==true){answer(false);return;}void shareConsent(contents,details).then(answer,()=>answer(false));return;}
      answer(permissionAllowed(contents,permission,details));
    });
    isolated.setPermissionCheckHandler((contents,permission,requestingOrigin,details)=>permissionChecked(contents,permission,requestingOrigin,details));
    isolated.setDisplayMediaRequestHandler?.((request,callback)=>shareRequest(request,callback));
    isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>callback({cancel:!workspaceRequestAllowed(details)}));
    // 직원 초대 문서의 건네기는 회사 입구 preload가 받는다. 걸지 못하면 초대만 이 통에서 받을 수 없다(surfaceForInvite가 거절한다)
    let invitable=false;
    try{if(typeof isolated.registerPreloadScript==='function'){isolated.registerPreloadScript({type:'frame',id:'synk-company-entry',filePath:COMPANY_ENTRY_PRELOAD});invitable=true;}}catch{invitable=false;}
    made.set(isolated,{invitable});
    return isolated;
  }
  function sameContext(expected,isolated){syncContext();return !disposed&&expected===epoch&&isolated===activeSession;}
  function bindNative(surface,isolated){
    const contents=surface.webContents;
    const fromPage=event=>{try{return !surface.isDestroyed()&&activeSurface===surface&&event?.sender===contents&&event.senderFrame===contents.mainFrame&&workspaceNavigationAllowed(event.senderFrame?.url);}catch{return false;}};
    const handle=(channel,work)=>contents.ipc.handle(channel,async(event,...args)=>{if(!fromPage(event))return {ok:false,code:'UNTRUSTED_SENDER'};try{return await work(...args);}catch{return {ok:false,code:'WORKSPACE_NATIVE_FAILED'};}});
    // 겉은 만든 때의 계정 것이다. 계정이 바뀌면 syncContext가 겉을 닫는다. 토큰은 그 계정의 것만, 그 겉이 살아 있고 그 계정이 지금 플랫폼 계정일 때만 싣는다(b GA1 · c GA4).
    // 플랫폼이 같은 계정의 토큰을 갱신하는 동안(renewing)은 계정이 잠깐 비어도 같은 계정으로 본다(syncContext와 같다)
    const boundEpoch=epoch,boundOwner=owner;
    const current=()=>{if(disposed||epoch!==boundEpoch||owner!==boundOwner||surface.isDestroyed()||activeSurface!==surface)return false;const now=workspaceScopeOf(getAccount?.());return now===boundOwner||now===null&&renewing();};
    const companyRequest=typeof native.companyRequest==='function'?native.companyRequest(isolated,{accountId:ownerAccount(),current}):null;
    handle(NATIVE_CHANNEL.status,()=>native.status?.()??null);
    // 회사 화면이 부르는 것은 load 하나다(synk-id.js retryNativeSynkRestore). 그 밖의 계정 요청은 이 뷰에 열지 않는다
    handle(NATIVE_CHANNEL.account,operation=>operation==='load'&&typeof native.accountLoad==='function'?native.accountLoad():{ok:false,code:'INVALID_REQUEST'});
    handle(NATIVE_CHANNEL.signIn,()=>native.signIn?.()??null);
    handle(NATIVE_CHANNEL.cancel,()=>native.cancelSignIn?.()??null);
    handle(NATIVE_CHANNEL.signOut,()=>native.signOut?.()??{ok:false});
    handle(NATIVE_CHANNEL.company,(operation,params)=>companyRequest?companyRequest(operation,params):{ok:false,error:{code:'COMPANY_UNAVAILABLE'}});
    // 「내 수업」 교사 로그인(14.3). 로그인과 수업 요청은 이 겉의 계정이 지금 플랫폼 계정일 때만 받는다. 수업 요청은 classroom 하나다
    const teacher=native.teacher&&typeof native.teacher==='object'?native.teacher:null;
    const teacherChanged={ok:false,error:{code:'AUTH_CHANGED',message:'로그인한 계정이 바뀌었어요. 내 수업을 다시 열어 주세요.',retryable:false}};
    handle(TEACHER_CHANNEL.environment,()=>teacher?.environment?.()??TEACHER_ENVIRONMENT);
    handle(TEACHER_CHANNEL.status,()=>teacher?teacher.status():TEACHER_NONE);
    handle(TEACHER_CHANNEL.signIn,()=>!teacher?TEACHER_NONE:current()?teacher.signIn():teacher.status());
    handle(TEACHER_CHANNEL.cancel,()=>teacher?teacher.cancelSignIn():TEACHER_NONE);
    handle(TEACHER_CHANNEL.signOut,()=>teacher?teacher.signOut():{ok:true,status:TEACHER_NONE});
    handle(TEACHER_CHANNEL.account,(operation,params)=>operation!=='classroom'||!params||typeof params!=='object'||Array.isArray(params)?{ok:false,error:{code:'INVALID_REQUEST',message:'내 수업에서 지원하는 수업 요청을 확인해 주세요.',retryable:false}}:!teacher?{ok:false,error:{code:'AUTH_UNAVAILABLE',message:'내 수업 로그인을 준비하지 못했어요.',retryable:false}}:current()?teacher.accountRequest('classroom',params):teacherChanged);
  }
  function createWorkspaceSurface(isolated){
    const surface=createSurface({backgroundColor:WORKSPACE_BACKGROUND,webPreferences:{session:isolated,preload:WORKSPACE_VIEW_PRELOAD,sandbox:true,contextIsolation:true,nodeIntegration:false,nodeIntegrationInWorker:false,nodeIntegrationInSubFrames:false,webviewTag:false,webSecurity:true,allowRunningInsecureContent:false,experimentalFeatures:false,devTools:false}});
    const contents=surface.webContents;
    // 회사 입구가 이 겉을 초대에 쓸 때 새 창 · 쓰던 글 확인을 다시 걸지 않게 한다(대화상자가 두 번 뜨지 않게, 설계 3.4)
    surface.workspaceGuarded=true;
    bindNative(surface,isolated);
    // 새 창 링크는 새 창을 만들지 않고 시스템 브라우저로 연다. 회사 문서(대화에서 공유받은 작업실 따위)도 그렇다. 뷰는 그대로 남는다(GPT 엔진 검수 b GA3 · c GA2 · GA6)
    contents.setWindowOpenHandler(({url})=>{openOutside(url,{company:true});return {action:'deny'};});
    contents.on('will-attach-webview',event=>event.preventDefault());
    // 메신저 iframe이 바깥 주소로 가려 하면 막고 브라우저로 연다. 요청 취소만으로 막으면 그 칸이 오류 화면이 된다(검토 R16)
    contents.on('will-frame-navigate',event=>{try{if(event.isMainFrame)return;const target=event.url;if(originOf(target)===WORKSPACE_ORIGIN)return;event.preventDefault();openOutside(target);}catch{}});
    // 새 문서가 실리면 앞 문서의 마이크 허락은 통화 중으로 세지 않는다
    contents.on('did-navigate',()=>{documentSeq++;if(micDocument?.contents===contents)micDocument=null;});
    contents.on('will-navigate',(event,url)=>{const target=typeof event?.url==='string'?event.url:url;if(!workspaceNavigationAllowed(target)){event.preventDefault();openOutside(target);}});
    contents.on('will-redirect',(event,url)=>{const target=typeof event?.url==='string'?event.url:url;const main=typeof event?.isMainFrame==='boolean'?event.isMainFrame:true;if(main&&!workspaceNavigationAllowed(target))event.preventDefault();});
    installDraftExitGuard({contents,window:surface.dialogParent(),dialog,text:WORKSPACE_EXIT_TEXT});
    contents.on('will-prevent-unload',event=>{if(!event.defaultPrevented&&!surface.isDestroyed())onUnloadKept();});
    // 내려받기는 Workspace 앱과 같은 하나(synk-shift-practice.txt)만 받는다. 그 규칙과 회사 세션 확인은 downloads.cjs가 그대로 한다
    // downloads.cjs는 세션 확인 뒤 같은 창인지 견준다. 그래서 늘 같은 물건을 준다
    const downloadWindow={webContents:contents,isDestroyed:()=>surface.isDestroyed()};
    const download=createDownloadHandler({getWindow:()=>surface.isDestroyed()?null:downloadWindow,session:isolated,entry:WORKSPACE_ENTRY,clientId:'messenger',
      configureSave(item,spec){item.setSaveDialogOptions({title:'SYNK 기록 저장',defaultPath:path.join(getDownloads(),item.getFilename()),filters:[{name:spec.filterName,extensions:[spec.extension]}]});},
      onDenied(reason){try{const parent=surface.dialogParent();if(parent&&!parent.isDestroyed())dialog.showMessageBox?.(parent,{type:'info',title:'SYNK 기록 저장',message:reason==='session'?'회사 계정으로 로그인한 뒤 다시 저장해 주세요.':'이 파일은 앱에서 저장할 수 없어요.',detail:'작업실의 AI 업무 연습 기록(TXT)만 64KB까지 저장할 수 있어요.'});}catch{}}});
    const downloading=(event,item,source)=>{if(source!==contents)return;download(event,item,source);};
    isolated.on('will-download',downloading);
    surface.once('closed',()=>{isolated.removeListener('will-download',downloading);if(activeSurface===surface)activeSurface=null;});
    return surface;
  }
  function launch(){
    const expected=epoch;
    const operation=(async()=>{
      await clearOldSessions();
      const settled=syncContext();
      if(disposed||expected!==epoch)return {ok:false,code:'WORKSPACE_APP_ACCOUNT_CHANGED'};
      if(!settled)return {ok:false,code:'WORKSPACE_APP_ACCOUNT_PENDING'};
      if(dirtySessions.size)return {ok:false,code:'WORKSPACE_APP_STORAGE_UNAVAILABLE'};
      let surface,timer;
      try{
        const isolated=activeSession||(activeSession=createSession(owner));
        surface=createWorkspaceSurface(isolated);activeSurface=surface;
        let httpFailure=false;
        const navigated=(_event,_url,status)=>{if(status>=400)httpFailure=true;};surface.webContents.on('did-navigate',navigated);
        try{await Promise.race([surface.loadURL(WORKSPACE_ENTRY),new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('WORKSPACE_LOAD_TIMEOUT')),loadTimeoutMs);})]);}
        finally{clearTimeout(timer);surface.webContents.removeListener('did-navigate',navigated);}
        if(!sameContext(expected,isolated)){if(!surface.isDestroyed())surface.destroy();return {ok:false,code:'WORKSPACE_APP_ACCOUNT_CHANGED'};}
        if(surface.isDestroyed()||httpFailure)throw Error('WORKSPACE_LOAD_FAILED');
        surface.show();surface.focus();return {ok:true,id:'workspace'};
      }catch{clearTimeout(timer);if(surface&&!surface.isDestroyed())surface.destroy();return {ok:false,code:expected===epoch?'WORKSPACE_APP_OPEN_FAILED':'WORKSPACE_APP_ACCOUNT_CHANGED'};}
    })();
    pending=operation;void operation.finally(()=>{if(pending===operation)pending=null;});return operation;
  }
  function open(){
    if(clientId!=='platform'||disposed)return Promise.resolve({ok:false,code:'WORKSPACE_APP_UNAVAILABLE'});
    try{native.prepare?.();}catch{}
    if(!syncContext())return Promise.resolve({ok:false,code:'WORKSPACE_APP_ACCOUNT_PENDING'});
    if(pending)return pending;
    if(alive()){if(activeSurface.isMinimized())activeSurface.restore();activeSurface.show();activeSurface.focus();return Promise.resolve({ok:true,id:'workspace',reused:true});}
    return launch();
  }
  /*
    회사 입구의 직원 초대가 이 계정의 통에서 문서를 싣게 겉을 준다(설계 3.4). binding은 회사 입구의 결속(company-entry.cjs readBinding)이다.
    결속의 SYNK ID가 이 관리자의 계정과 같아야 한다. 겉이 있으면 먼저 쓰던 글을 묻고 닫는다. 남기면 {busy:true}다.
    답은 {surface, session} · {busy:true} · null(계정이 다름, 손님, 세션 preload를 걸 수 없음, 닫힘) 가운데 하나다.
    준 겉은 이 관리자의 겉으로 남는다. 초대가 실패하면 회사 입구가 그 겉을 닫는다
  */
  async function surfaceForInvite(binding){
    if(clientId!=='platform'||disposed)return null;
    const expected=epoch;
    if(!syncContext()||binding?.status!=='signed-in'||ownerAccount()!==binding.expectedAccountId)return null;
    try{native.prepare?.();}catch{}
    // 회사 화면은 Workspace 로그인으로 그 회사 계정을 SYNK ID에 잇는다. 그 로그인이 같은 SYNK ID로 끝나기 전에 초대를 받으면 잇지 못한 채
    // 초대가 소모된다. 그래서 끝나기 전에는 {pending:true}로 답하고 회사 입구가 다시 시도할 수 있는 오류로 끝낸다(GPT 엔진 검수 GA2)
    let ready=false,status=null;try{status=native.status?.();ready=status?.signedIn===true&&status.account?.synk_user_id===binding.expectedAccountId;}catch{ready=false;}
    if(!ready){
      // Workspace에서 로그아웃했거나 로그인이 오류에 멈췄으면 Suite 따라가기는 다시 들어가지 않는다(Suite 기록이 그대로다). 초대를 넣은 것은
      // 들어가겠다는 뜻이라 따라가기를 한 번 더 돌린다(b GA2). 따라가기는 저장된 로그인을 먼저 되살리고 그래도 아니면 로그인한다.
      // 로그인을 여기서 바로 시작하면 켠 직후 되살리기 전에 저장된 로그인을 지운다(c GA1). 다시 시도하면 그 로그인이 끝난 뒤 초대를 받는다
      if(status?.configured!==false)void Promise.resolve().then(()=>native.retryLogin?.()).catch(()=>{});
      return {pending:true};
    }
    if(pending)return {busy:true};
    // 통화 중인 Workspace는 쓰던 글이 없어도 말없이 닫지 않는다(검토 R6)
    if(alive()&&busy())return {busy:true};
    if(alive()){
      let outcome='kept';
      try{outcome=await closeSurfaceForExit();}catch{outcome='kept';}
      if(outcome==='kept'&&alive())return {busy:true};
      if(alive())closeSurface();
    }
    await clearOldSessions();
    if(disposed||expected!==epoch||syncContext()===null||ownerAccount()!==binding.expectedAccountId||dirtySessions.size)return null;
    if(pending||alive())return {busy:true};
    try{
      const isolated=activeSession||(activeSession=createSession(owner));
      if(made.get(isolated)?.invitable!==true)return null;
      const surface=createWorkspaceSurface(isolated);activeSurface=surface;
      return {surface,session:isolated};
    }catch{return null;}
  }
  // 본체의 로그인 알림을 뷰에도 보낸다(회사 화면의 onAuthChanged). 지금 겉의 회사 문서에만 보낸다
  function publishAuth(state){
    if(!alive())return;
    try{const contents=activeSurface.webContents;if(workspaceNavigationAllowed(contents.getURL()))contents.send(NATIVE_CHANNEL.changed,state);}catch{}
  }
  // 「내 수업」 교사 로그인의 알림(14.3). 지금 겉의 회사 문서에만 보낸다
  function publishTeacherAuth(state){
    if(!alive())return;
    try{const contents=activeSurface.webContents;if(workspaceNavigationAllowed(contents.getURL()))contents.send(TEACHER_CHANNEL.changed,state);}catch{}
  }
  return {open,surfaceForInvite,syncContext,publishAuth,publishTeacherAuth,busy,hasSurface:alive,
    dispose(){disposed=true;++epoch;pending=null;closeSurface();activeSession=null;}};
}

module.exports={createWorkspaceApp,workspaceAccessToken,workspaceScopeOf,workspaceAppPartition,workspaceNavigationAllowed,workspaceRequestAllowed,workspaceExternalDestination,workspaceFrame,WORKSPACE_ORIGIN,WORKSPACE_ENTRY,WORKSPACE_VIEW_PRELOAD,WORKSPACE_BACKGROUND,NATIVE_CHANNEL,TEACHER_CHANNEL};
