'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Fixed operations only. Tokens, raw IPC, paths, URLs and commands stay in main.
const SUBSCRIPTION_SERVICES=['claude','gpt','higgsfield'],SUBSCRIPTION_KEY_SERVICES=['typecast'],SUBSCRIPTION_HELP=['node','claude-plans','chatgpt-plans','claude-install','codex-install','higgsfield-install','gemini-plans','typecast-api','higgsfield-credits','codex-resets','claude-resets','claude-usage','claude-api-credits','claude-console-billing','claude-benefit-settings','gpt-api-credits','gpt-credit-grants','gpt-benefit-settings','gemini-api-credits','gemini-ai-studio-billing','gemini-studio-usage','gemini-dev-benefits','flow-app','flow-activity','flow-credits','higgsfield-pricing','higgsfield-annual','typecast-api-pricing'];
const unknownSubscription=code=>Promise.resolve({ok:false,code});
// The entry portal names a visit purpose; main opens that purpose's fixed page.
const PORTAL_PURPOSES=['shift'];
// A customer's own invite, taken from a complete link the portal checked: its
// token crosses with the portal's request, as a fresh exact
// {token,requestId,accountGeneration} (company-entry-contract-v1 §7).
// accountGeneration is the UUID from the latest auth status, never the numeric
// sessionGeneration. A lone {token} and every other form are refused here
// without crossing. Main checks the same again; a refusal here has main's
// answer form. The UUIDs are lowercase, of versions 1 to 8 with the RFC
// variant, as main and the company entry check them.
const INVITE_TOKEN=/^[A-Za-z0-9_-]{16,200}$/,INVITE_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const inviteFields=(input,keys)=>{if(!input||typeof input!=='object'||Array.isArray(input))return null;const own=Reflect.ownKeys(input);if(own.length!==keys.length||!keys.every(key=>own.includes(key)))return null;const fields={};for(const key of keys){const field=Object.getOwnPropertyDescriptor(input,key);if(!field||!('value' in field))return null;fields[key]=field.value;}return fields;};
const inviteUuid=value=>typeof value==='string'&&INVITE_UUID.test(value);
const pulseInvite=input=>{
  const fields=inviteFields(input,['token','requestId','accountGeneration']);
  return fields&&typeof fields.token==='string'&&INVITE_TOKEN.test(fields.token)&&inviteUuid(fields.requestId)&&inviteUuid(fields.accountGeneration)?{token:fields.token,requestId:fields.requestId,accountGeneration:fields.accountGeneration}:null;
};
const inviteNamed=(input,key)=>{try{const field=input&&typeof input==='object'?Object.getOwnPropertyDescriptor(input,key):null;return field&&'value' in field&&inviteUuid(field.value)?field.value:null;}catch{return null;}};
// The company entry (company-entry.cjs, company-entry-destinations.cjs). Each
// call crosses as a fresh object with exactly its own keys. An employee's
// complete link is https://workspace.synk.im/#invite=<token> and nothing else;
// a bare code is the token alone, sent without guessing its kind. Main picks
// the window, its storage partition, the URL and the account itself and takes
// none of them from here. A refusal here has main's answer form, and a cancel
// refused here cancels nothing (null). A destination to open is one of the two
// fixed names the member's own lookup confirmed, '/' or '/pulse-app/', with that
// lookup's own two IDs; main opens it with an existing product function only.
const COMPANY_LINK=/^https:\/\/workspace\.synk\.im\/#invite=[A-Za-z0-9_-]{16,200}$/,COMPANY_DESTINATIONS=['/','/pulse-app/'];
const companyLink=input=>{const fields=inviteFields(input,['href','requestId','accountGeneration']);return fields&&typeof fields.href==='string'&&COMPANY_LINK.test(fields.href)&&inviteUuid(fields.requestId)&&inviteUuid(fields.accountGeneration)?{href:fields.href,requestId:fields.requestId,accountGeneration:fields.accountGeneration}:null;};
const companyCode=input=>{const fields=inviteFields(input,['code','requestId','accountGeneration']);return fields&&typeof fields.code==='string'&&INVITE_TOKEN.test(fields.code)&&inviteUuid(fields.requestId)&&inviteUuid(fields.accountGeneration)?{code:fields.code,requestId:fields.requestId,accountGeneration:fields.accountGeneration}:null;};
const companyEntryIds=input=>{const fields=inviteFields(input,['requestId','accountGeneration']);return fields&&inviteUuid(fields.requestId)&&inviteUuid(fields.accountGeneration)?{requestId:fields.requestId,accountGeneration:fields.accountGeneration}:null;};
const companyDestination=input=>{const fields=inviteFields(input,['destination','requestId','accountGeneration']);return fields&&typeof fields.destination==='string'&&COMPANY_DESTINATIONS.includes(fields.destination)&&inviteUuid(fields.requestId)&&inviteUuid(fields.accountGeneration)?{destination:fields.destination,requestId:fields.requestId,accountGeneration:fields.accountGeneration}:null;};
const companyInvalid=input=>Promise.resolve({ok:false,requestId:inviteNamed(input,'requestId'),accountGeneration:inviteNamed(input,'accountGeneration'),code:'INVALID_INPUT',retryable:false});
// 솔리오 「사무실」(구현설계.md 13절): 부서 번호와 세션 번호는 정해진 꼴만, 부서 폴더는 'choose'(본체의 고르기 창)나 {fromSession}(그 세션의 작업 폴더)뿐이다.
// 부서 폴더와 더할 보는 폴더는 경로 글자로 건너가지 않는다. 빼는 보는 폴더만 글자로 건너가고, 본체가 손님이 더한 목록에 있는지 다시 본다.
const OFFICE_ID=/^[A-Za-z0-9_-]{4,32}$/,OFFICE_SESSION=/^[A-Za-z0-9_-]{8,128}$/,OFFICE_VIEWS=['tilted','top'];
const OFFICE_SKINS=['black','walnut'],OFFICE_HATS=['beanie','beret','gat','phones','sprout'],OFFICE_SEAT=/^(?:d:[A-Za-z0-9_-]{4,32}|lobby):(?:0|[1-9]\d?)$/,OFFICE_DESK_SIZES=[1,2,3,4],OFFICE_DESK_FINISHES=['black','walnut'];
const officeId=value=>typeof value==='string'&&OFFICE_ID.test(value);
const officeSession=value=>typeof value==='string'&&OFFICE_SESSION.test(value);
const officeInvalid=()=>Promise.resolve({ok:false,code:'VALUE'});
const officeTaskId=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
function officeTaskInput(input){
  if(!input||!officeTaskId(input.id)||!['claude','codex'].includes(input.provider)||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>8000)return null;
  if(input.departmentId!=null&&!officeId(input.departmentId)||input.previousId!=null&&!officeTaskId(input.previousId))return null;
  if(input.mailSearch!=null&&(typeof input.mailSearch!=='boolean'||input.mailSearch&&input.provider!=='codex'))return null;
  if(input.quoteHandoff!=null&&(typeof input.quoteHandoff!=='boolean'||input.quoteHandoff&&(input.provider!=='codex'||input.mailSearch===false||input.mailRetry)))return null;
  if(input.quoteResumeOf!=null&&(!officeTaskId(input.quoteResumeOf)||input.quoteHandoff!==true||input.mailSearch!==true||input.previousId!=null))return null;
  if(input.mailRetry!=null&&(typeof input.mailRetry!=='boolean'||input.mailRetry&&(!input.mailSearch||!input.previousId)))return null;
  return {id:input.id,provider:input.provider,departmentId:input.departmentId??null,prompt:input.prompt,previousId:input.previousId??null,...(typeof input.mailSearch==='boolean'?{mailSearch:input.mailSearch}:{}),...(input.mailRetry===true?{mailRetry:true}:{}),...(input.quoteHandoff===true?{quoteHandoff:true}:{}),...(input.quoteResumeOf?{quoteResumeOf:input.quoteResumeOf}:{})};
}
// 기능(사업계획서_설계.md 9절): 기능 이름, 부서 번호, 정해 둔 동작과 그 동작의 칸만 건너간다. 경로는 건너가지 않는다(파일은 본체가 고르기 창으로 받는다)
const OFFICE_FEATURE=/^[a-z][a-z0-9-]{1,31}$/;
const OFFICE_FEATURE_ACTIONS=['pick-plan','pick-data','remove-data','criteria','start','choose','draft','save','reveal','handoff','clear'];
const officeText=(v,max)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
function officeFeatureArgs(action,a){
  if(a==null)a={};
  if(typeof a!=='object'||Array.isArray(a))return null;
  const out={};
  const take=(k,ok)=>{if(a[k]===undefined)return true;if(!ok(a[k]))return false;out[k]=a[k];return true;};
  const ok=take('index',v=>Number.isInteger(v)&&v>=0&&v<100)&&take('mode',v=>['default','pasted'].includes(v))&&take('text',v=>officeText(v,4000))&&
    take('provider',v=>['claude','codex'].includes(v))&&take('key',v=>typeof v==='string'&&/^n\d{1,3}$/.test(v))&&take('kind',v=>['fix','edit','keep','undo'].includes(v))&&
    take('item',v=>officeText(v,40))&&take('answers',v=>Array.isArray(v)&&v.length<=3&&v.every(x=>Number.isInteger(x)&&x>=0&&x<4))&&take('remove',v=>typeof v==='boolean')&&
    take('departmentId',officeId)&&take('extra',v=>officeText(v,2000))&&take('confirm',v=>typeof v==='boolean');
  return ok&&Object.keys(a).every(k=>k in out)&&OFFICE_FEATURE_ACTIONS.includes(action)?out:null;
}
// 번호가 있는 부서는 이름이나 폴더 가운데 하나만 건너갈 수 있다. 뺀 칸은 본체가 저장된 값으로 채운다(GPT 검수 GA3)
const officeDepartment=input=>{if(!input||typeof input!=='object'||(input.id!==undefined&&input.id!==null&&!officeId(input.id)))return null;const id=officeId(input.id);if(typeof input.name!=='string'&&!(input.name===undefined&&id))return null;const value={...(id?{id:input.id}:{}),...(typeof input.name==='string'?{name:input.name.slice(0,200)}:{})},folder=input.folder;if(folder==='choose')value.folder='choose';else if(folder&&typeof folder==='object'&&officeSession(folder.fromSession))value.folder={fromSession:folder.fromSession};else if(folder!==undefined||!value.id||value.name===undefined)return null;return value;};
// 꾸미기(사무실스킨 PC앱_설계.md 4절)는 스킨 하나나 자리 하나의 모자 · 이름 하나만, 다른 설정과 섞지 않고 보낸다. 본체가 다시 본다
const officeLook=input=>{if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.seat!=='string'||input.seat.length>48||!OFFICE_SEAT.test(input.seat))return null;const hat=input.hat!==undefined,name=input.name!==undefined;if(hat===name)return null;if(hat)return input.hat===null||OFFICE_HATS.includes(input.hat)?{seat:input.seat,hat:input.hat}:null;return typeof input.name==='string'&&input.name.length<=64?{seat:input.seat,name:input.name}:null;};
// 부서의 책상(사무실책상 README 5절)은 부서 하나의 칸 하나(크기 · 수 · 재질)만, 다른 설정과 섞지 않고 보낸다. 본체가 다시 본다
const officeDesk=input=>{if(!input||typeof input!=='object'||Array.isArray(input)||!officeId(input.department))return null;const given=['size','count','finish'].filter(k=>input[k]!==undefined);if(given.length!==1)return null;const k=given[0],v=input[k];const ok=k==='size'?OFFICE_DESK_SIZES.includes(v):k==='count'?Number.isInteger(v)&&v>=1&&v<=6:v===null||OFFICE_DESK_FINISHES.includes(v);return ok?{department:input.department,[k]:v}:null;};
const officeSettings=input=>{if(!input||typeof input!=='object')return null;const solo=['skin','look','desk'].filter(k=>input[k]!==undefined);if(solo.length){if(input.view!==undefined||input.manualCap!==undefined||solo.length!==1)return null;if(input.skin!==undefined)return OFFICE_SKINS.includes(input.skin)?{skin:input.skin}:null;if(input.desk!==undefined){const desk=officeDesk(input.desk);return desk?{desk}:null;}const look=officeLook(input.look);return look?{look}:null;}const value={};if(input.view!==undefined){if(!OFFICE_VIEWS.includes(input.view))return null;value.view=input.view;}if(input.manualCap!==undefined){if(input.manualCap!==null&&!Number.isInteger(input.manualCap))return null;value.manualCap=input.manualCap;}return 'view' in value||'manualCap' in value?value:null;};
const pulseViewPlace=input=>input&&typeof input==='object'&&typeof input.visible==='boolean'&&typeof input.top==='number'&&Number.isFinite(input.top)&&input.top>=0&&input.top<=160?{visible:input.visible,top:input.top}:null;
contextBridge.exposeInMainWorld('synkDesktop',Object.freeze({
  openEstimate:()=>ipcRenderer.invoke('synk:open-estimate'),
  teacher:Object.freeze({
    getEnvironment:()=>ipcRenderer.invoke('synk:teacher-environment'),
    authStatus:()=>ipcRenderer.invoke('synk:teacher-auth-status'),
    authSignIn:()=>ipcRenderer.invoke('synk:teacher-auth-sign-in'),
    authCancelSignIn:()=>ipcRenderer.invoke('synk:teacher-auth-cancel'),
    authSignOut:()=>ipcRenderer.invoke('synk:teacher-auth-sign-out'),
    accountRequest:(operation,params={})=>ipcRenderer.invoke('synk:teacher-account-request',operation,params),
    onAuthChanged:callback=>subscribe('synk:teacher-auth-changed',callback),
  }),
  getEnvironment:()=>ipcRenderer.invoke('synk:environment'),
  updateStatus:()=>ipcRenderer.invoke('synk:update-status'),
  checkForUpdate:()=>ipcRenderer.invoke('synk:check-for-update'),
  downloadUpdate:()=>ipcRenderer.invoke('synk:download-update'),
  installUpdate:()=>ipcRenderer.invoke('synk:install-update'),
  onUpdateChanged:callback=>subscribe('synk:update-changed',callback),
  // 조용한 업데이트(1-가 구현 설계 2절): 본체가 쓰다 만 초안이 있는지 물으면 화면의 판단(참, 거짓)만 돌려준다. 답하지 못하면 「있음」이다
  answerDraftCheck:callback=>{
    if(typeof callback!=='function')throw new TypeError('A callback is required');
    const listener=(_event,id)=>{let unsaved=true;try{unsaved=callback()!==false;}catch{unsaved=true;}if(Number.isSafeInteger(id))ipcRenderer.send('synk:draft-answer',id,unsaved);};
    ipcRenderer.on('synk:draft-check',listener);
    return ()=>ipcRenderer.removeListener('synk:draft-check',listener);
  },
  getDesktopPreferences:()=>ipcRenderer.invoke('synk:desktop-preferences'),
  careNotifications:Object.freeze({
    status:()=>ipcRenderer.invoke('synk:care-notifications-status'),
    configure:patch=>ipcRenderer.invoke('synk:care-notifications-configure',patch),
    test:()=>ipcRenderer.invoke('synk:care-notifications-test'),
    onChanged:callback=>subscribe('synk:care-notifications-changed',callback),
  }),
  updateDesktopPreferences:patch=>ipcRenderer.invoke('synk:desktop-preferences-update',patch),
  copyPlatformDiagnostics:summary=>ipcRenderer.invoke('synk:copy-platform-diagnostics',summary),
  onDesktopPreferences:callback=>subscribe('synk:desktop-preferences',callback),
  onDesktopAction:callback=>subscribe('synk:desktop-action',callback),
  draftRecoveryStatus:owner=>ipcRenderer.invoke('synk:draft-recovery-status',owner),
  setDraftRecoveryEnabled:(value,owner)=>ipcRenderer.invoke('synk:draft-recovery-enabled',value,owner),
  draftRecoveryLoad:(slot,owner)=>ipcRenderer.invoke('synk:draft-recovery-load',slot,owner),
  draftRecoverySave:(slot,value,owner)=>ipcRenderer.invoke('synk:draft-recovery-save',slot,value,owner),
  draftRecoveryClear:(slot,owner)=>ipcRenderer.invoke('synk:draft-recovery-clear',slot,owner),
  onDraftRecoveryChanged:callback=>subscribe('synk:draft-recovery-changed',callback),
  getClients:()=>ipcRenderer.invoke('synk:clients'),
  openTeacherPreview:()=>ipcRenderer.invoke('synk:teacher-preview'),
  openProductPreview:id=>typeof id==='string'&&['path','care','fortune'].includes(id)?ipcRenderer.invoke('synk:product-preview',id):Promise.resolve({ok:false,code:'UNKNOWN_PREVIEW'}),
  openPublicApp:id=>typeof id==='string'&&['care','fortune','path'].includes(id)?ipcRenderer.invoke('synk:open-public-app',id):Promise.resolve({ok:false,code:'UNKNOWN_PUBLIC_APP'}),
  openPortalPurpose:id=>typeof id==='string'&&PORTAL_PURPOSES.includes(id)?ipcRenderer.invoke('synk:open-portal-purpose',id):Promise.resolve({ok:false,code:'UNKNOWN_PORTAL_PURPOSE'}),
  prepareClient:id=>typeof id==='string'&&id==='world'?ipcRenderer.invoke('synk:prepare-client',id):Promise.resolve({ok:false,code:'UNKNOWN_CLIENT'}),
  cancelPreparation:id=>typeof id==='string'&&id==='world'?ipcRenderer.invoke('synk:cancel-preparation',id):Promise.resolve({ok:false,code:'UNKNOWN_CLIENT'}),
  openInstaller:id=>typeof id==='string'&&id==='world'?ipcRenderer.invoke('synk:open-installer',id):Promise.resolve({ok:false,code:'UNKNOWN_CLIENT'}),
  launch:id=>typeof id==='string'&&['platform','world'].includes(id)?ipcRenderer.invoke('synk:launch',id):Promise.resolve({ok:false,code:'UNKNOWN_CLIENT'}),
  getWindowState:()=>ipcRenderer.invoke('synk:window-state'),
  // 켜짐부터 열림까지: 구가 드러나기 시작한 때와 움직임 종류를 묻고, 첫 구를 그렸다고 알린다(인자 없음)
  orbBoot:()=>ipcRenderer.invoke('synk:orb-boot'),
  orbFirstFrame:()=>ipcRenderer.invoke('synk:orb-first-frame'),
  windowAction:action=>['minimize','toggle-maximize','close'].includes(action)?ipcRenderer.invoke('synk:window-action',action):Promise.resolve({ok:false,code:'INVALID_WINDOW_ACTION'}),
  authStatus:()=>ipcRenderer.invoke('synk:auth-status'),
  authSignIn:()=>ipcRenderer.invoke('synk:auth-sign-in'),
  authSignUp:()=>ipcRenderer.invoke('synk:auth-sign-up'),
  authCancelSignIn:()=>ipcRenderer.invoke('synk:auth-cancel'),
  authSignOut:()=>ipcRenderer.invoke('synk:auth-sign-out'),
  accountRequest:(operation,params={})=>ipcRenderer.invoke('synk:account-request',operation,params),
  accountIdentity:()=>ipcRenderer.invoke('synk:account-identity'),
  authSecurity:section=>ipcRenderer.invoke('synk:auth-security',['password','email','google'].includes(section)?section:null),
  authRecover:()=>ipcRenderer.invoke('synk:auth-recover'),
  companyRequest:(operation,params={})=>ipcRenderer.invoke('synk:company-request',operation,params),
  openPulseApp:()=>ipcRenderer.invoke('synk:pulse-app-open'),
  // 창 안의 PULSE 뷰(3단계 구현 설계 2.3). 자리는 꼭 {visible, top}으로만 건넌다. 본체가 다시 거른다(pulse-view.cjs)
  pulseView:Object.freeze({
    place:input=>{const value=pulseViewPlace(input);return value?ipcRenderer.invoke('synk:pulse-view-place',value):Promise.resolve({ok:false,code:'INVALID_INPUT'});},
    state:()=>ipcRenderer.invoke('synk:pulse-view-state'),
    focus:()=>ipcRenderer.invoke('synk:pulse-view-focus'),
    close:()=>ipcRenderer.invoke('synk:pulse-view-close'),
    open:()=>ipcRenderer.invoke('synk:pulse-app-open'),
    onChanged:callback=>subscribe('synk:pulse-view-changed',callback),
    onEvent:callback=>subscribe('synk:pulse-view-event',callback),
  }),
  // 창 안의 Workspace 뷰(4단계 구현 설계 3.5). PULSE 뷰와 같은 꼴이고, 화면 공유 고르기의 물음과 답이 더 있다(4.2)
  workspaceView:Object.freeze({
    place:input=>{const value=pulseViewPlace(input);return value?ipcRenderer.invoke('synk:workspace-view-place',value):Promise.resolve({ok:false,code:'INVALID_INPUT'});},
    state:()=>ipcRenderer.invoke('synk:workspace-view-state'),
    focus:()=>ipcRenderer.invoke('synk:workspace-view-focus'),
    close:()=>ipcRenderer.invoke('synk:workspace-view-close'),
    open:()=>ipcRenderer.invoke('synk:workspace-app-open'),
    onChanged:callback=>subscribe('synk:workspace-view-changed',callback),
    onEvent:callback=>subscribe('synk:workspace-view-event',callback),
    onShareAsk:callback=>subscribe('synk:workspace-share-ask',callback),
    answerShare:input=>input&&typeof input==='object'&&Number.isInteger(input.id)&&(input.pick===null||Number.isInteger(input.pick)&&input.pick>=0&&input.pick<24)?ipcRenderer.invoke('synk:workspace-share-answer',{id:input.id,pick:input.pick}):Promise.resolve({ok:false,code:'INVALID_INPUT'}),
  }),
  openPulseAppInvite:input=>{const invite=pulseInvite(input);return invite?ipcRenderer.invoke('synk:pulse-app-open-invite',invite):Promise.resolve({ok:false,requestId:inviteNamed(input,'requestId'),accountGeneration:inviteNamed(input,'accountGeneration'),code:'PULSE_APP_INVITE_INVALID',retryable:false});},
  handoffCompanyInviteLink:input=>{const value=companyLink(input);return value?ipcRenderer.invoke('synk:company-invite-handoff',value):companyInvalid(input);},
  inspectCompanyInviteCode:input=>{const value=companyCode(input);return value?ipcRenderer.invoke('synk:company-invite-inspect',value):companyInvalid(input);},
  cancelCompanyEntry:input=>{const value=companyEntryIds(input);return value?ipcRenderer.invoke('synk:company-entry-cancel',value):Promise.resolve(null);},
  resolveCompanyEntryDestinations:input=>{const value=companyEntryIds(input);return value?ipcRenderer.invoke('synk:company-entry-destinations',value):companyInvalid(input);},
  openAssignedCompanyDestination:input=>{const value=companyDestination(input);return value?ipcRenderer.invoke('synk:company-entry-open-destination',value):companyInvalid(input);},
  subscriptions:Object.freeze({
    snapshot:(options={})=>ipcRenderer.invoke('synk:subscriptions-snapshot',{refreshTools:options?.refreshTools===true}),
    check:(ids)=>ipcRenderer.invoke('synk:subscriptions-check',Array.isArray(ids)?ids.filter(id=>typeof id==='string').slice(0,200).map(id=>id.slice(0,80)):null),
    useExisting:service=>SUBSCRIPTION_SERVICES.includes(service)?ipcRenderer.invoke('synk:subscriptions-use-existing',service):unknownSubscription('UNKNOWN_SERVICE'),
    login:(service,options={})=>SUBSCRIPTION_SERVICES.includes(service)?ipcRenderer.invoke('synk:subscriptions-login',service,{email:typeof options?.email==='string'?options.email.trim().slice(0,254):undefined,console:options?.console===true}):unknownSubscription('UNKNOWN_SERVICE'),
    submitCode:(id,code)=>typeof id==='string'&&typeof code==='string'?ipcRenderer.invoke('synk:subscriptions-code',id,code.slice(0,2048)):unknownSubscription('INVALID_CODE'),
    cancel:id=>typeof id==='string'?ipcRenderer.invoke('synk:subscriptions-cancel',id):unknownSubscription('NO_LOGIN'),
    openLoginUrl:id=>typeof id==='string'?ipcRenderer.invoke('synk:subscriptions-open-url',id):unknownSubscription('NO_URL'),
    install:service=>SUBSCRIPTION_SERVICES.includes(service)?ipcRenderer.invoke('synk:subscriptions-install',service):unknownSubscription('UNKNOWN_SERVICE'),
    help:key=>SUBSCRIPTION_HELP.includes(key)?ipcRenderer.invoke('synk:subscriptions-help',key):unknownSubscription('UNKNOWN_LINK'),
    save:patch=>patch&&typeof patch==='object'?ipcRenderer.invoke('synk:subscriptions-save',JSON.parse(JSON.stringify(patch))):unknownSubscription('INVALID_REQUEST'),
    connectKey:(service,key,options={})=>SUBSCRIPTION_KEY_SERVICES.includes(service)&&typeof key==='string'?ipcRenderer.invoke('synk:subscriptions-key',service,key.trim().slice(0,512),{replace:typeof options?.replace==='string'?options.replace.slice(0,40):null}):unknownSubscription('INVALID_KEY_FORMAT'),
    onChanged:callback=>subscribe('synk:subscriptions-changed',callback),
    // 모델별 토큰(11-15): 이 PC의 AI 도구 기록으로 센 모델별 토큰. 켜기 · 끄기 · 다시 세기만 넘긴다.
    tokens:()=>ipcRenderer.invoke('synk:subscriptions-tokens'),
    tokensScan:(options={})=>ipcRenderer.invoke('synk:subscriptions-tokens-scan',{force:options?.force===true}),
    tokensEnable:on=>ipcRenderer.invoke('synk:subscriptions-tokens-enable',on===true),
    tokensLive:on=>ipcRenderer.invoke('synk:subscriptions-tokens-live',on===true),
    onTokens:callback=>subscribe('synk:subscriptions-tokens-changed',callback),
  }),
  // synk.im 방문자 분석(11-17): 요약 파일을 읽은 결과만 받는다. 넘기는 값은 없다.
  siteVisits:Object.freeze({snapshot:()=>ipcRenderer.invoke('synk:site-visits-snapshot')}),
  // 솔리오 계정 건강(11-19): 진단 요약을 읽은 결과만 받는다. 넘기는 값은 없다(계정은 본체가 로그인 상태에서 읽는다).
  snsHealth:Object.freeze({snapshot:()=>ipcRenderer.invoke('synk:sns-health-snapshot')}),
  // 솔리오 백업·복구(11-20): 엔진 상태를 읽은 결과만 받고, 넘기는 값은 정해진 낱말 하나뿐이다(경로 · 자유 글 없음).
  solioBackup:Object.freeze({
    snapshot:()=>ipcRenderer.invoke('synk:solio-backup-snapshot'),
    start:mode=>['protect','move'].includes(mode)?ipcRenderer.invoke('synk:solio-backup-start',mode):Promise.resolve({ok:false,code:'INVALID'}),
    open:topic=>typeof topic==='string'&&/^[a-z]{1,16}$/.test(topic)?ipcRenderer.invoke('synk:solio-backup-open',topic):Promise.resolve({ok:false,code:'INVALID'}),
    dismiss:()=>ipcRenderer.invoke('synk:solio-backup-dismiss'),
    oneClick:()=>ipcRenderer.invoke('synk:solio-backup-oneclick'),
  }),
  // 솔리오 「내 PC 진단」(11-24): 이 PC의 사양(수와 종류)만 받는다. 넘기는 값은 없다.
  pcProfile:Object.freeze({
    snapshot:()=>ipcRenderer.invoke('synk:pc-profile'),
    again:()=>ipcRenderer.invoke('synk:pc-profile-again'),
    seen:()=>ipcRenderer.invoke('synk:pc-profile-seen'),
    openStorage:()=>ipcRenderer.invoke('synk:pc-open-storage'),
  }),
  // 솔리오 「사무실」(11-20): 세션 모음의 모습을 받고, 부서 · 보낼 부서 · 설정 · 보는 폴더를 고친다. 인자는 위의 꼴로 다시 만든 것만 건너간다.
  chatgptConnection:Object.freeze({
    status:()=>ipcRenderer.invoke('synk:chatgpt-status'),
    connect:()=>ipcRenderer.invoke('synk:chatgpt-connect'),
    cancel:()=>ipcRenderer.invoke('synk:chatgpt-cancel'),
    disconnect:()=>ipcRenderer.invoke('synk:chatgpt-disconnect'),
    onChange:callback=>subscribe('synk:chatgpt-changed',callback),
  }),
  office:Object.freeze({
    snapshot:()=>ipcRenderer.invoke('synk:office-snapshot'),
    connectMail:p=>['gmail','outlook'].includes(p)?ipcRenderer.invoke('synk:office-mail-connect',p):officeInvalid(),
    disconnectMail:p=>['gmail','outlook'].includes(p)?ipcRenderer.invoke('synk:office-mail-disconnect',p):officeInvalid(),
    openMailResult:(task,item)=>officeTaskId(task)&&officeTaskId(item)?ipcRenderer.invoke('synk:office-mail-open',task,item):officeInvalid(),
    moreMail:(task,provider,page)=>officeTaskId(task)&&['gmail','outlook'].includes(provider)&&Number.isSafeInteger(page)&&page>=0
      ?ipcRenderer.invoke('synk:office-mail-more',task,provider,page):officeInvalid(),
    submitTask:input=>{const value=officeTaskInput(input);return value?ipcRenderer.invoke('synk:office-task-submit',value):officeInvalid();},
    taskAction:(id,action,text)=>{
      if(!officeTaskId(id))return officeInvalid();
      if(action==='saveAnswer')return typeof text==='string' && text.trim() && text.length<=524288
        ? ipcRenderer.invoke('synk:office-task-action',id,action,text) : officeInvalid();
      if(action==='reviewMail')return text===undefined?ipcRenderer.invoke('synk:office-task-action',id,action):officeInvalid();
      if(action==='confirmMail'){
        if(!text||typeof text!=='object'||Array.isArray(text)||!Object.hasOwn(text,'reviewId')||!Object.hasOwn(text,'filter')||!officeTaskId(text.reviewId))return officeInvalid();
        const choices=['allowUnboundedPeriod','omitUnmet'].filter(key=>Object.hasOwn(text,key));
        const hasRoles=Object.hasOwn(text,'roleDecisions'),roles=text.roleDecisions;
        if(Object.keys(text).length!==2+choices.length+Number(hasRoles)||choices.some(key=>typeof text[key]!=='boolean'))return officeInvalid();
        if(hasRoles&&(!roles||typeof roles!=='object'||Array.isArray(roles)||!Object.keys(roles).length||
          Object.keys(roles).some(k=>!['from','folder'].includes(k)||!['apply','exclude','edit'].includes(roles[k]))))return officeInvalid();
        const f=text.filter,fields=['from','after','before','folder','provider','attachment'];
        if(!f||Object.keys(f).length!==7||!Object.hasOwn(f,'terms')||!Array.isArray(f.terms)||f.terms.length>6||
          !f.terms.every(term=>typeof term==='string'&&term.length>0&&term.length<=80)||!fields.every(k=>Object.hasOwn(f,k)&&typeof f[k]==='string'&&f[k].length<=80)||
          !['received','inbox','sent','inbox_sent','all'].includes(f.folder)||!['gmail','outlook','all'].includes(f.provider)||!['','has'].includes(f.attachment))return officeInvalid();
        const filter={terms:[...f.terms],from:f.from,after:f.after,before:f.before,folder:f.folder,provider:f.provider,attachment:f.attachment};
        return ipcRenderer.invoke('synk:office-task-action',id,action,{reviewId:text.reviewId,filter,...Object.fromEntries(choices.map(key=>[key,text[key]])),
          ...(hasRoles?{roleDecisions:{...roles}}:{})});
      }
      return ['cancel','resume','terminal'].includes(action)?ipcRenderer.invoke('synk:office-task-action',id,action):officeInvalid();
    },
    featureSnapshot:(feature,departmentId)=>OFFICE_FEATURE.test(feature||'')&&officeId(departmentId)?ipcRenderer.invoke('synk:office-feature-snapshot',feature,departmentId):officeInvalid(),
    featureAction:(feature,departmentId,action,args)=>{const value=OFFICE_FEATURE.test(feature||'')&&officeId(departmentId)?officeFeatureArgs(action,args):null;return value?ipcRenderer.invoke('synk:office-feature-action',feature,departmentId,action,value):officeInvalid();},
    watch:on=>ipcRenderer.invoke('synk:office-watch',on===true),
    saveDepartment:input=>{const value=officeDepartment(input);return value?ipcRenderer.invoke('synk:office-department-save',value):officeInvalid();},
    removeDepartment:id=>officeId(id)?ipcRenderer.invoke('synk:office-department-remove',id):officeInvalid(),
    assign:(sessionId,departmentId)=>officeSession(sessionId)&&(departmentId===null||officeId(departmentId))?ipcRenderer.invoke('synk:office-session-assign',sessionId,departmentId):officeInvalid(),
    saveSettings:input=>{const value=officeSettings(input);return value?ipcRenderer.invoke('synk:office-settings-save',value):officeInvalid();},
    addRoot:()=>ipcRenderer.invoke('synk:office-roots-add'),
    removeRoot:dir=>typeof dir==='string'&&dir.length>0&&dir.length<=1024?ipcRenderer.invoke('synk:office-roots-remove',dir):officeInvalid(),
    seen:departmentId=>departmentId===null||officeId(departmentId)?ipcRenderer.invoke('synk:office-seen',departmentId):officeInvalid(),
    onChanged:callback=>subscribe('synk:office-changed',callback),
  }),
  onAuthChanged:callback=>{if(typeof callback!=='function')throw new TypeError('A callback is required');const listener=(_event,status)=>callback(status);ipcRenderer.on('synk:auth-changed',listener);return ()=>ipcRenderer.removeListener('synk:auth-changed',listener);},
  onClientsChanged:callback=>subscribe('synk:clients-changed',callback),
  onClientProgress:callback=>subscribe('synk:client-progress',callback),
  onWindowStateChanged:callback=>subscribe('synk:window-state-changed',callback),
  onOpenView:callback=>subscribe('synk:open-view',callback),
}));
function subscribe(channel,callback){if(typeof callback!=='function')throw new TypeError('A callback is required');const listener=(_event,value)=>callback(value);ipcRenderer.on(channel,listener);return ()=>ipcRenderer.removeListener(channel,listener);}
