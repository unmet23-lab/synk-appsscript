'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Fixed operations only. Tokens, raw IPC, paths, URLs and commands stay in main.
const SUBSCRIPTION_SERVICES=['claude','gpt','higgsfield','gemini'],SUBSCRIPTION_KEY_SERVICES=['typecast'],SUBSCRIPTION_HELP=['node','claude-plans','chatgpt-plans','claude-install','codex-install','higgsfield-install','gemini-plans','antigravity-install','typecast-api','higgsfield-credits','codex-resets','claude-resets','claude-usage','claude-api-credits','claude-console-billing','gpt-api-credits','gpt-credit-grants','gemini-api-credits','gemini-ai-studio-billing','gemini-dev-benefits','flow-app','flow-credits','higgsfield-pricing','higgsfield-annual','typecast-api-pricing'];
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
contextBridge.exposeInMainWorld('synkDesktop',Object.freeze({
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
  prepareClient:id=>typeof id==='string'&&['world','messenger'].includes(id)?ipcRenderer.invoke('synk:prepare-client',id):Promise.resolve({ok:false,code:'UNKNOWN_CLIENT'}),
  cancelPreparation:id=>typeof id==='string'&&['world','messenger'].includes(id)?ipcRenderer.invoke('synk:cancel-preparation',id):Promise.resolve({ok:false,code:'UNKNOWN_CLIENT'}),
  openInstaller:id=>typeof id==='string'&&['world','messenger'].includes(id)?ipcRenderer.invoke('synk:open-installer',id):Promise.resolve({ok:false,code:'UNKNOWN_CLIENT'}),
  launch:id=>typeof id==='string'&&['platform','world','messenger'].includes(id)?ipcRenderer.invoke('synk:launch',id):Promise.resolve({ok:false,code:'UNKNOWN_CLIENT'}),
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
  }),
  onAuthChanged:callback=>{if(typeof callback!=='function')throw new TypeError('A callback is required');const listener=(_event,status)=>callback(status);ipcRenderer.on('synk:auth-changed',listener);return ()=>ipcRenderer.removeListener('synk:auth-changed',listener);},
  onClientsChanged:callback=>subscribe('synk:clients-changed',callback),
  onClientProgress:callback=>subscribe('synk:client-progress',callback),
  onWindowStateChanged:callback=>subscribe('synk:window-state-changed',callback),
  onOpenView:callback=>subscribe('synk:open-view',callback),
}));
function subscribe(channel,callback){if(typeof callback!=='function')throw new TypeError('A callback is required');const listener=(_event,value)=>callback(value);ipcRenderer.on(channel,listener);return ()=>ipcRenderer.removeListener(channel,listener);}
