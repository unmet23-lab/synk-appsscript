'use strict';
const {app,BrowserWindow,ipcMain,session,protocol,Menu,Tray,shell,dialog,safeStorage,screen,globalShortcut,clipboard,Notification,systemPreferences}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {CLIENTS,DEV_URLS,PLATFORM_ENTRY,identity,sourceScope}=require('./catalog.cjs');
const {safeEntry,assertSender,trustedEntry,worldNotificationAllowed,preferences,allowedNavigation,externalDestination,contentSecurityPolicy,nativeContentSecurityPolicy}=require('./security.cjs');
const {createClientLifecycle}=require('./client-lifecycle.cjs');
const {resolveProgramRoot}=require('./program-root.cjs');
const {loadDevelopmentReleases}=require('./local-releases.cjs');
const {createNativeContent}=require('./native-content.cjs');
const {createConnectionContent,connectionContentSecurityPolicy}=require('./connection-content.cjs');
const {createConnectionRecovery}=require('./connection-recovery.cjs');
const {configuration}=require('./auth-config.cjs');
const {resolveAuthConfigPath}=require('./auth-config-path.cjs');
const {createTokenStore}=require('./auth-store.cjs');
const {createAuthService,publicError}=require('./auth-service.cjs');
const {createSignInReturn,bringToFront}=require('./sign-in-return.cjs');
const {WORLD_ROUTE_NAMES}=require('./world-requests.cjs');
const {suiteKey,suiteDevice,createSuiteStore,createSuitePublisher,createSuiteFollower}=require('./suite-session.cjs');
const {createCompanyRequests}=require('./company-requests.cjs');
const {createTeacherPreview}=require('./teacher-preview.cjs');
const {createMessengerTeacherService,bindMessengerTeacherIPC,sendMessengerTeacherAuth,messengerViewEntry}=require('./messenger-teacher.cjs');
const {createProductPreviews}=require('./product-preview.cjs');
const {createPublicApps}=require('./public-apps.cjs');
const {createPortalNavigation}=require('./portal-navigation.cjs');
const {createDownloadHandler}=require('./downloads.cjs');
const {installDraftExitGuard,WORKSPACE_EXIT_TEXT}=require('./draft-exit.cjs');
const {createPlatformTray}=require('./platform-tray.cjs');
const {createTrayMemoryReclaimer}=require('./platform-tray-memory.cjs');
const {createDesktopPreferences,readStartHidden}=require('./desktop-preferences.cjs');
const {createCareNotifications,validPatch:validCareNotificationPatch}=require('./care-notifications.cjs');
const {shouldNotify:careReminderDue}=require('./care-notification-model.cjs');
const {createWindowPlacement}=require('./window-placement.cjs');
const {createDraftRecovery}=require('./draft-recovery.cjs');
const {createDraftRecoveryRequests}=require('./draft-recovery-ipc.cjs');
const {copyDiagnostics}=require('./diagnostics-clipboard.cjs');
const {createPulseApp,pulseInviteRefusal}=require('./pulse-app.cjs');
const {createCompanyEntryManager,createCompanyEntryPartitions,companyAnswerFromPulse,entryRefusal,bindingFromAuth}=require('./company-entry.cjs');
const {createCompanyEntryDestinations}=require('./company-entry-destinations.cjs');
const {createPlatformUpdater}=require('./platform-update.cjs');
const {createStartupUpdateGate,unseenFailureResolved}=require('./platform-startup-update.cjs');
const {createStartupUpdateWindow}=require('./platform-startup-window.cjs');
const {launchWindowsUpdate,writeHandoffNote,removeHandoffNote,launchCurtain,consumeArrivalNote,curtainEventName,windowHandle}=require('./platform-update-handoff.cjs');
const {createUpdateRecovery}=require('./platform-update-recovery.cjs');
const {yieldToUpdatingInstaller}=require('./platform-update-marker.cjs');
const {createSiteVisits}=require('./site-visits.cjs');
const {createSnsHealth}=require('./sns-health.cjs');
const {createSolioBackup}=require('./solio-backup.cjs');
const {createMacApplicationLocationGate}=require('./mac-application-location.cjs');
const {createAiSubscriptions}=require('./ai-subscriptions.cjs');
const {createLocalServerGate}=require('./local-server-owner.cjs');
const {createOffice,loadOfficeModel}=require('./office.cjs');
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const packaged=app.isPackaged;
let runtime,developmentAuthConfigPath;
if(packaged)runtime=JSON.parse(fs.readFileSync(path.join(app.getAppPath(),'runtime.json'),'utf8'));
else {
  if(!process.argv.includes('--synk-dev'))throw Error('Development launch requires --synk-dev');
  const clientId=process.argv.find(a=>a.startsWith('--client='))?.slice(9)||'platform';
  runtime={clientId,mode:'development',entry:DEV_URLS[clientId],releases:[]};
  if(clientId==='platform')runtime.releases=loadDevelopmentReleases({root:path.resolve(__dirname,'..'),platform:process.platform,arch:process.arch});
  developmentAuthConfigPath=resolveAuthConfigPath();
  if(developmentAuthConfigPath)runtime.auth=JSON.parse(fs.readFileSync(path.resolve(developmentAuthConfigPath),'utf8'));
}
if(!Object.hasOwn(CLIENTS,runtime.clientId)||!['development','release'].includes(runtime.mode)||!safeEntry(runtime.entry,runtime.mode,runtime)||(runtime.clientId==='platform'&&runtime.entry!==PLATFORM_ENTRY)||(runtime.clientId!=='platform'&&runtime.entry===PLATFORM_ENTRY))throw Error('Invalid desktop runtime configuration');
const smoke=runtime.mode==='development'&&process.argv.includes('--synk-smoke');
const current=identity(runtime.clientId,runtime.mode,{packaged}),entry=messengerViewEntry(runtime.entry,runtime.clientId,process.argv);
const localServer=createLocalServerGate({entry:runtime.entry});
const publicApps=createPublicApps({clientId:runtime.clientId,mode:runtime.mode,openExternal:url=>shell.openExternal(url),accountStatus:()=>accountStatus()});
// The entry portal's visit purpose (SHIFT) opens one fixed public page by ID; no URL comes from the window.
const portalNavigation=createPortalNavigation({clientId:runtime.clientId,smoke,openExternal:url=>shell.openExternal(url)});
const teacherPreview=createTeacherPreview({packaged,mode:runtime.mode,clientId:runtime.clientId,executable:process.execPath,appRoot:app.getAppPath(),spawn,authConfigPath:developmentAuthConfigPath});
const smokeArtifacts=smoke?(packaged?path.join(app.getPath('temp'),'SYNK Desktop Smoke',current.sessionScope):path.join(__dirname,'..','artifacts')):null;
const authConfig=configuration(runtime.mode==='development'&&!runtime.auth?.clients?.[runtime.clientId]?null:runtime.auth,runtime.clientId,runtime.mode);
const teacherAuthConfig=runtime.clientId==='messenger'?configuration(runtime.auth?.clients?.teacher?runtime.auth:null,'teacher',runtime.mode):null;
app.setName(current.productName);
// 소스 실행은 current가 '.source' 범위라 이 폴더(그리고 이 폴더로 잡는 단일 실행 잠금)와 작업 표시줄 ID가 설치된 Preview와 갈린다(catalog.cjs sourceScope).
app.setPath('userData',path.join(app.getPath('appData'),'SYNK Desktop',current.sessionScope+(smoke?'.smoke':'')));
app.setPath('sessionData',path.join(app.getPath('userData'),'Session'));
if(process.platform==='win32')app.setAppUserModelId(current.appId);
let window,platformTray,trayMemory,desktopPreferences,careNotifications,windowPlacement,draftRecovery,draftRecoveryRequests,pulseApp,platformUpdate,protocolRegistered=false,auth,installations,connectionRecovery,suiteFollower,teacherService,unbindTeacher,pendingTeachingView=false;
// 켜짐부터 열림까지(1-가 구현 설계 2절). orbBoot는 구가 드러나기 시작한 시각과 움직임 종류다. 본체가 정해 시작 창과 앱 창에 같은 값을 준다.
// startupHandoff는 시작 창에서 앱 창으로 겹쳐 넘기는 동안의 상태, unseenFailure는 숨은 채 시작한 길에서 아직 보이지 않은 실패다.
let orbBoot=null,startupHandoff=null,unseenFailure=null;
// 앱에서 설치기로 넘길 때(2절 가림막, 6절 쪽지): curtain은 띄운 가림막의 손잡이, handoffCover는 앱 창 위에 덮어 띄운 업데이트 장면이다.
// arrivalShow는 업데이트 뒤 새 앱이 도착 쪽지에서 받은 보이는 상태(behind, minimized, hidden)다
// arrivalBoot는 도착 쪽지의 마지막 장이다. 시작 관문이 드러남 값을 비우므로 따로 두었다가 시작 창을 띄울 때 넘긴다
// handoffGen은 넘김을 거둘 때마다 는다. 기다림 뒤에 그 넘김이 아직 살아 있는지 본다
// quietQuit는 조용한 업데이트로 끝나는 중이라는 뜻이다(트레이가 끝낼 때 숨은 창을 보이지 않는다)
let curtain=null,handoffCover=null,arrivalShow=null,arrivalBoot=null,handoffGen=0,quietQuit=false,draftAskSeq=0;
// handoffVisibility는 넘김 쪽지에 적은 보이는 상태다. 넘김이 실패하면 창을 이 상태로 되돌린다(0.4.96 검수 F2)
// autostartHidden은 로그인 때 켜진 실행의 숨은 시작을 한 번만 쓰려고 둔다. 첫 창을 다룬 뒤나 사람이 창을 부르면 비운다(0.4.96 검수 D5)
// placementControl은 앱 창의 자리 기억이다. 다른 창 뒤로 보일 때 최대화를 미루는 데 쓴다(0.4.96 검수 C3)
let handoffVisibility=null,autostartHidden=process.argv.includes('--synk-autostart'),placementControl=null;
// 시작 창이 그리는 업데이트 뒤의 첫 장면 길이(renderer/startup-update.mjs의 ARRIVE_SCENE_MS). 이 시간이 지난 뒤 앱 창으로 넘긴다
const ARRIVE_SCENE_MS=4130;
let waitingForFirstWindow=false,openBeforeStartupGate=false;
let startupGate,startupWindow,updateRecovery,suiteStore,suitePublisher,suiteDeviceId=null,pendingDesktopAction,mainInitialized=false,mainWindowReady=false,quittingRequested=false;
let companyEntry,companyPartitions,companyDestinations;
let startupAllowed=runtime.clientId!=='platform'||!packaged||smoke;
let appLocationReady=process.platform!=='darwin'||!packaged||smoke;
const appLocation=createMacApplicationLocationGate({app,dialog,platform:process.platform,packaged,smoke,productName:current.productName});
const suiteBindingKey=authConfig?suiteKey(authConfig,runtime.mode):null;
function publishAuthState(state){careNotifications?.syncAccount();pulseApp?.syncContext(state);syncCompanyEntry();officeService?.accountChanged(officeAccountOf(state));solioBackupService?.accountChanged();scheduleHiddenAuthRetry(state);void syncTrayApps();if(window&&!window.isDestroyed()&&trustedEntry(window.webContents.getURL(),entry,runtime.clientId))window.webContents.send('synk:auth-changed',state);}
// 설치 생명주기는 창 밖에서 만든다. 숨은 시작의 트레이 메뉴도 설치 여부를 본다(PC 0.5.0 설계 1.5)
function ensureInstallations(){
  if(installations)return installations;
  const programRoot=resolveProgramRoot({platform:process.platform,env:process.env,getHome:()=>app.getPath('home')});
  installations=createClientLifecycle({clientId:runtime.clientId,mode:runtime.mode,platform:process.platform,arch:process.arch,programRoot,packageRoot:packaged?path.join(process.resourcesPath,'clients'):path.join(app.getAppPath(),'dist'),cacheRoot:path.join(app.getPath('userData'),'Installers'),releases:runtime.releases||[],spawn,openPath:file=>shell.openPath(file),onChange:async()=>{
    scheduleTrayApps();
    // 창이 없으면 모든 앱의 실행 파일과 asar를 해시하는 getClients를 부르지 않는다(설계 검토 D4)
    if(!window||window.isDestroyed())return;
    try{const state=await installations.getClients();sendDesktop('synk:clients-changed',state);sendDesktop('synk:client-progress',state);}catch{}
  }});
  return installations;
}
// 트레이 메뉴의 앱 줄(PC 0.5.0 설계 1.3). 본체가 화면에 주는 로그인 값(accountStatus)으로 권한을 보고, 설치는 해시 없는 확인으로 본다.
// 화면이 보내던 목록과 그 기억은 쓰지 않는다. 누르면 본체가 바로 실행하고, 못 하면 Platform 창을 연다
const TRAY_APP='messenger';
let trayAppsSeq=0,trayAppsTimer=null,trayAppsTick=null,trayLaunching=false;
function trayAppAllowed(id=TRAY_APP){const state=accountStatus();return id===TRAY_APP&&state?.signedIn===true&&state.library?.status==='ready'&&Array.isArray(state.library.appIds)&&state.library.appIds.includes(id);}
async function syncTrayApps(){
  if(!platformTray?.isActive())return;
  const seq=++trayAppsSeq;
  // 로그아웃이나 권한 없음은 설치 확인을 기다리지 않고 바로 뺀다(설계 검토 D6)
  if(quittingRequested||!trayAppAllowed()){platformTray.setApps([]);return;}
  let installed=false;
  try{installed=(await ensureInstallations().probe(TRAY_APP))?.installed===true;}catch{installed=false;}
  if(seq!==trayAppsSeq||!platformTray?.isActive())return;
  platformTray.setApps(installed&&!quittingRequested&&trayAppAllowed()?[TRAY_APP]:[]);
}
// 설치 파일 준비의 진행처럼 몰려 오는 알림은 0.3초 묶어 한 번 본다
function scheduleTrayApps(){if(!platformTray?.isActive())return;clearTimeout(trayAppsTimer);trayAppsTimer=setTimeout(()=>{trayAppsTimer=null;void syncTrayApps();},300);trayAppsTimer.unref?.();}
async function launchFromTray(id){
  if(quittingRequested||trayLaunching)return;
  if(!trayAppAllowed(id)){requestPlatformWindow();return;}
  // 해시를 마치고 띄우기 바로 앞에서 계정 세대와 조건을 다시 본다(설계 검토 D6)
  const generation=accountStatus()?.sessionGeneration;
  const unchanged=()=>!quittingRequested&&trayAppAllowed(id)&&accountStatus()?.sessionGeneration===generation;
  trayLaunching=true;let result=null;
  try{result=await requireSuite(()=>ensureInstallations().launch(id,{confirm:unchanged}));}catch{result=null;}
  finally{trayLaunching=false;}
  void syncTrayApps();
  if(quittingRequested)return;
  if(result?.ok!==true)requestPlatformWindow();
}
// 창이 없는 동안 로그인 복원이 다시 시도할 수 있는 실패로 멈추면 본체가 다시 잇는다. 5초에서 두 배씩 5분까지 늘린다.
// Windows 로그인 직후 망이 붙기 전에 숨은 채 켜지는 길이다. 창이 생기면 화면이 「다시 불러오기」를 맡는다(설계 검토 D1)
let hiddenAuthRetry=null,hiddenAuthDelay=5000,hiddenAuthLoading=false;
function scheduleHiddenAuthRetry(state){
  const waiting=!!auth&&runtime.clientId==='platform'&&(!window||window.isDestroyed())&&!quittingRequested&&state?.status==='error'&&state.error?.retryable===true;
  // 대기 시간은 로그인이 끝난 때(성공이나 다시 시도할 수 없는 끝)에만 처음으로 돌린다. 복원 중의 중간 상태(restoring)는 지나가는 값이다(GPT 검수 GA3)
  const settled=state?.signedIn===true||!['restoring','signing-in','signing-out','error'].includes(state?.status);
  if(!waiting){if(hiddenAuthRetry){clearTimeout(hiddenAuthRetry);hiddenAuthRetry=null;}if(settled)hiddenAuthDelay=5000;return;}
  // 다시 읽는 중이면 예약하지 않는다. 읽기가 시작하며 내는 error 상태로 두 번째 읽기가 겹쳤다. 끝난 뒤 그때의 상태로 한 번만 다시 본다(GPT 검수 GA1)
  if(hiddenAuthRetry||hiddenAuthLoading)return;
  const delay=hiddenAuthDelay;hiddenAuthDelay=Math.min(hiddenAuthDelay*2,300000);
  hiddenAuthRetry=setTimeout(()=>{
    hiddenAuthRetry=null;
    if(quittingRequested||window&&!window.isDestroyed())return;
    hiddenAuthLoading=true;
    void Promise.resolve().then(()=>requireSuite(()=>auth.accountRequest('load',{}))).catch(()=>{}).finally(()=>{hiddenAuthLoading=false;scheduleHiddenAuthRetry(accountStatus());});
  },delay);
  hiddenAuthRetry.unref?.();
}
// The suite can mask a verified sign-in (suite-session.cjs project). Only a verified sign-in carries the entry
// portal's visit-purpose state (auth-service.cjs), so a masked one never shows the question pending.
function projectAuth(state){const value=suitePublisher?suitePublisher.project(state):state;return value?.onboarding&&value.signedIn!==true?{...value,onboarding:null}:value;}
function sendDesktop(channel,value){if(window&&!window.isDestroyed()&&trustedEntry(window.webContents.getURL(),entry,runtime.clientId))window.webContents.send(channel,value);}
function desktopSnapshot(){const result=desktopPreferences?.snapshot()||{ok:false,code:'LAUNCHER_ONLY'};return {...result,capabilities:{...result.capabilities,tray:!!platformTray?.isActive(),encryptedDrafts:!!draftRecovery?.available()}};}
let careConfiguration=Promise.resolve();
function configureCareNotifications(patch){
  const expected=accountStatus();
  const sameAccount=()=>{const current=accountStatus();return expected?.signedIn===true&&current?.signedIn===true&&expected.account?.synk_user_id===current.account?.synk_user_id&&expected.sessionGeneration===current.sessionGeneration;};
  const operation=careConfiguration.then(async()=>{
    if(runtime.clientId!=='platform'||smoke)return {ok:false,code:'LAUNCHER_ONLY'};
    if(!validCareNotificationPatch(patch))return {ok:false,code:'INVALID_REQUEST'};
    if(!sameAccount())return {ok:false,code:'AUTH_CHANGED'};
    // A source run has no login item (desktop-preferences.cjs), so Care keeps only the tray there.
    let previous,loginItem=false;
    if(patch.enabled===true){const status=await careNotifications.status();if(!sameAccount())return {ok:false,code:'AUTH_CHANGED'};if(!status.available||!status.signedIn)return {ok:false,code:'AUTH_REQUIRED'};const settings=desktopPreferences.snapshot();previous=settings.preferences;loginItem=settings.capabilities.launchAtLogin===true;const result=desktopPreferences.update({closeToTray:true,...(loginItem&&!previous.launchAtLogin?{launchAtLogin:true,startHidden:true}:{})});if(!result.ok)return result;}
    const result=sameAccount()?await careNotifications.configure(patch):{ok:false,code:'AUTH_CHANGED'};
    if(!result.ok&&previous)desktopPreferences.update({closeToTray:previous.closeToTray,...(loginItem?{launchAtLogin:previous.launchAtLogin}:{}),startHidden:previous.startHidden});
    return result;
  });careConfiguration=operation.catch(()=>{});return operation;
}
async function openAccountSignUp(){
  if(runtime.clientId!=='platform'||smoke)return {ok:false,code:'LAUNCHER_ONLY'};
  const state=accountStatus();
  if(!state||state.signedIn||state.status==='signed-in'||['restoring','signing-in','signing-out'].includes(state.status))return {ok:false,code:'AUTH_SIGNUP_UNAVAILABLE'};
  try{await shell.openExternal('https://synk.im/id/?view=signup');return {ok:true};}
  catch{return {ok:false,code:'AUTH_SIGNUP_OPEN_FAILED'};}
}
// Password and login e-mail change in the browser's SYNK ID (「로그인과 보안」); this app never takes a password.
// The renderer may name one line to open (password · email · google); anything else opens the card's top.
const SECURITY_SECTIONS=new Set(['password','email','google']);
async function openAccountSecurity(section){
  if(runtime.clientId!=='platform'||smoke)return {ok:false,code:'LAUNCHER_ONLY'};
  if(!accountStatus()?.signedIn)return {ok:false,code:'AUTH_REQUIRED'};
  try{await shell.openExternal('https://synk.im/id/?view=security'+(SECURITY_SECTIONS.has(section)?'&focus='+section:''));return {ok:true};}
  catch{return {ok:false,code:'AUTH_SECURITY_OPEN_FAILED'};}
}
// 「비밀번호를 잊었어요」 before signing in: the browser's SYNK ID opens straight on the reset-mail step (?view=recover).
async function openAccountRecover(){
  if(runtime.clientId!=='platform'||smoke)return {ok:false,code:'LAUNCHER_ONLY'};
  const state=accountStatus();
  if(!state||state.signedIn||['restoring','signing-in','signing-out'].includes(state.status))return {ok:false,code:'AUTH_RECOVER_UNAVAILABLE'};
  try{await shell.openExternal('https://synk.im/id/?view=recover');return {ok:true};}
  catch{return {ok:false,code:'AUTH_RECOVER_OPEN_FAILED'};}
}
async function signOutAccount(){
  const owner=accountStatus()?.account?.synk_user_id;
  if(suitePublisher&&!suitePublisher.signOut())return {ok:false,status:accountStatus(),error:{code:'SUITE_UNAVAILABLE',message:'로그인 기록을 지우지 못해 로그아웃을 마치지 못했어요. 다시 해 주세요.'}};
  const result=await auth.signOut();
  // Authentication has its own confirmed result. An encrypted draft cleanup
  // failure must not discard its server flags or become an auth failure.
  try{if(owner)await draftRecovery?.clearAccount(owner);}
  catch{return {...result,draftRecoveryCleanup:{ok:false,code:'DRAFT_STORAGE_FAILED'}};}
  return result;
}
function sendTeachingView(){if(pendingTeachingView&&runtime.clientId==='messenger'&&window&&!window.isDestroyed()&&trustedEntry(window.webContents.getURL(),entry,runtime.clientId)){window.webContents.send('synk:open-view','teaching');pendingTeachingView=false;}}
const accountStatus=()=>projectAuth(suitePublisher?auth.status():auth?.status());
// A same-account token renewal keeps PULSE's window and drafts (pulse-app.cjs). Only auth knows it, and it reaches no
// renderer. While the suite masks the sign-in there is no renewal to keep, as before.
const renewingAccount=()=>suitePublisher&&!suitePublisher.available()?null:auth?.renewingAccountId?.()??null;
// The UUID auth issued for its current epoch (auth-service.cjs accountGeneration). PULSE binds every invite hand-off
// to it, so a request a renderer made for another account or epoch is never applied to this one. Masked like the renewal.
const pulseAccountGeneration=()=>suitePublisher&&!suitePublisher.available()?null:auth?.accountGeneration?.()??null;
// The company entry (company-entry.cjs, company-entry-destinations.cjs) binds every hand-off and lookup to main's own
// account: auth's UUID generation and numeric epoch (the generation masked like PULSE's while the suite hides the
// sign-in), the SYNK ID auth verified, and whether that sign-in is settled (company-entry.cjs bindingFromAuth). A
// renewal, a platform binding still being checked (auth reports it as restoring), a failure or a masked sign-in reads
// as restoring or error, so nothing is handed over or looked up for it. No renderer value takes part.
function companyBinding(){return bindingFromAuth(accountStatus(),pulseAccountGeneration());}
// An account change ends a company hand-off of another account or generation, drops a lookup in flight for another
// account, and removes the company windows and in-memory storage of earlier generations.
function syncCompanyEntry(){companyEntry?.syncAccount();companyDestinations?.syncAccount();companyPartitions?.sync();}
const requireSuite=operation=>suitePublisher&&!suitePublisher.refresh()?Promise.resolve({ok:false,code:'SUITE_UNAVAILABLE'}):operation();
const productPreviews=createProductPreviews({packaged,mode:runtime.mode,clientId:runtime.clientId,executable:process.execPath,appRoot:app.getAppPath(),spawn,authConfigPath:developmentAuthConfigPath,accountStatus:()=>accountStatus()});
// AI 구독 계정판: 플랫폼 창에서 로그인한 회원만, 공식 프로그램 출력만 읽는다(ai-subscriptions.cjs).
let aiSubscriptions=null;
// Typecast처럼 API 키로 읽는 서비스의 키는 safeStorage(Windows DPAPI·macOS 키체인)로만 이 PC에 둔다.
const subscriptionSecrets={available:()=>{try{return ['win32','darwin'].includes(process.platform)&&safeStorage.isEncryptionAvailable()&&safeStorage.getSelectedStorageBackend?.()!=='basic_text';}catch{return false;}},encrypt:value=>safeStorage.encryptString(value),decrypt:data=>safeStorage.decryptString(data)};
function subscriptions(){if(runtime.clientId!=='platform'||smoke)return null;if(!aiSubscriptions)aiSubscriptions=createAiSubscriptions({root:path.join(app.getPath('userData'),'AiSubscriptions'),secrets:subscriptionSecrets,priceFetch:typeof globalThis.fetch==='function'?globalThis.fetch.bind(globalThis):null,openExternal:url=>shell.openExternal(url),onChange:snapshot=>sendDesktop('synk:subscriptions-changed',snapshot),onTokens:state=>sendDesktop('synk:subscriptions-tokens-changed',state)});return aiSubscriptions;}
// synk.im 방문자 분석(11-17 유호님 「내가 솔리오에서 확인할수있게」): 운영 PC의 모으기(tools/사이트방문)가 남긴 요약 파일 하나만 읽는다.
// 파일이 없는 PC에서는 available:false라 화면에 나오지 않는다. 플랫폼 창에서 로그인한 회원만 묻고, 그 계정이 viewers.json에 있어야 보인다(site-visits.cjs).
let siteVisits=null;
function siteVisitsCall(){if(runtime.clientId!=='platform'||smoke)return {ok:false,code:'LAUNCHER_ONLY'};if(accountStatus()?.signedIn!==true)return {ok:false,code:'SIGN_IN_REQUIRED'};if(!siteVisits)siteVisits=createSiteVisits();return siteVisits.snapshot(accountStatus()?.account);}
// 솔리오 계정 건강(11-19 유호님 「PC 앱에 옮겨」): 이 PC의 진단 도구(tools/계정건강.js --요약쓰기)가 쓴 요약 한 장만 읽는다.
// 확인은 방문자 분석과 같다. 플랫폼 창에서 로그인한 회원만 묻고, 그 계정이 방문자 분석의 viewers.json에 있어야 보인다(sns-health.cjs).
let snsHealth=null;
function snsHealthCall(){if(runtime.clientId!=='platform'||smoke)return {ok:false,code:'LAUNCHER_ONLY'};if(accountStatus()?.signedIn!==true)return {ok:false,code:'SIGN_IN_REQUIRED'};if(!snsHealth)snsHealth=createSnsHealth();return snsHealth.snapshot(accountStatus()?.account);}
// 솔리오 「백업·복구」(11-20): 업무 백업 엔진의 입구. 플랫폼 창에서 로그인한 계정만 묻고, 실제 입구는 유호님 계정에만 보인다(solio-backup.cjs).
// 힌트는 SYNK ID에 Google 로그인이 이어져 있고 그 주소를 알 때만 엔진의 setup 요청에 넘긴다(STAGE1_DESIGN 4.13 「로그인」).
let solioBackupService=null;
function solioBackupCall(work){if(runtime.clientId!=='platform'||smoke)return {ok:false,code:'LAUNCHER_ONLY'};const status=accountStatus();if(status?.signedIn!==true||!status.account)return {ok:false,code:'SIGN_IN_REQUIRED'};if(!solioBackupService)solioBackupService=createSolioBackup({cacheRoot:path.join(app.getPath('userData'),'WorkBackupSetup'),openExternal:url=>shell.openExternal(url)});return work(solioBackupService,status.account);}
// 누른 계정과 지금 로그인한 계정이 같을 때만 그 계정의 Google 주소를 준다(GPT 검수 GA2)
async function solioBackupHint(account){const result=await auth.identity();if(!result?.ok||typeof account?.synk_user_id!=='string'||result.accountId!==account.synk_user_id)return null;const google=(result.identities||[]).find(row=>row?.provider==='google'&&typeof row.email==='string');return google?.email||null;}
// 솔리오 「사무실」(11-20, docs/디자인/솔리오_사무실_20261119/구현설계.md 11.1 · 13절, 15절 6단계): 플랫폼 창에서 로그인한 계정만 묻는다. 볼 계정인지는 office.cjs가 채널마다 viewers.json으로 본다.
// 처음 부를 때 office-model.mjs를 불러 한 번 만든다. 훅 서버(5단계)는 아직 없어 화면에는 hooks를 늘 꺼짐으로 준다. 로그인이 바뀌면 publishAuthState가 accountChanged를 부른다.
// 같은 계정의 토큰 갱신은 잠깐 restoring(계정 없음)으로 보이므로 그동안은 그 계정 그대로 본다(PULSE의 renewingAccount와 같다). 그래야 갱신마다 세션 기억과 기록 살피기가 끊기지 않는다.
let officeService=null,officeLoading=null;
const officeAccountOf=state=>{if(state?.signedIn===true&&state.account)return state.account;const renewing=renewingAccount();return renewing?{synk_user_id:renewing}:null;};
function office(){if(officeService)return Promise.resolve(officeService);if(!officeLoading)officeLoading=loadOfficeModel().then(model=>{officeService=createOffice({userData:app.getPath('userData'),model,onChange:()=>sendDesktop('synk:office-changed')});return officeService;}).finally(()=>{officeLoading=null;});return officeLoading;}
async function officeCall(work){if(runtime.clientId!=='platform'||smoke)return {ok:false,code:'LAUNCHER_ONLY'};const status=accountStatus();if(status?.signedIn!==true||!status.account)return {ok:false,code:'SIGN_IN_REQUIRED'};const service=await office();const now=accountStatus();if(now?.signedIn!==true||now.account?.synk_user_id!==status.account.synk_user_id)return {ok:false,code:'AUTH_CHANGED'};return work(service,now.account);}
// 폴더는 화면이 경로 글자로 보내지 않는다(13절). 고르기 창은 볼 계정에만 띄우고, 고르는 사이에 로그인이 바뀌었으면 고른 폴더를 버린다(백업 시작과 같은 확인)
async function officeChooseFolder(service,account){
  if(!await service.allowed(account))return {ok:false,code:'NOT_ALLOWED'};
  if(!window||window.isDestroyed())return {ok:false,code:'CANCELLED'};
  const generation=accountStatus()?.sessionGeneration;
  const result=await dialog.showOpenDialog(window,{properties:['openDirectory']});
  const folder=result&&!result.canceled&&Array.isArray(result.filePaths)&&typeof result.filePaths[0]==='string'?result.filePaths[0]:null;
  if(!folder)return {ok:false,code:'CANCELLED'};
  const now=accountStatus();
  if(now?.signedIn!==true||now.account?.synk_user_id!==account.synk_user_id||now.sessionGeneration!==generation)return {ok:false,code:'AUTH_CHANGED'};
  return {ok:true,folder};
}
// 부서 더하기 · 고치기. folder는 'choose'(고르기 창), {fromSession}(지금 선 세션의 작업 폴더), 없음(번호가 있는 부서의 이름만 고칠 때 저장된 폴더 그대로) 셋뿐이다
async function officeSaveDepartment(service,account,input){
  if(!input||typeof input!=='object'||(input.id!==undefined&&typeof input.id!=='string'))return {ok:false,code:'VALUE'};
  const id=input.id??null,given=input.folder;let folder;
  if(given==='choose'){const chosen=await officeChooseFolder(service,account);if(!chosen.ok)return chosen;folder=chosen.folder;}
  else{
    const snap=await service.snapshot(account);
    if(!snap?.ok||!snap.available)return {ok:false,code:'NOT_ALLOWED'};
    if(given&&typeof given==='object'&&typeof given.fromSession==='string'){const session=Object.hasOwn(snap.state.sessions,given.fromSession)?snap.state.sessions[given.fromSession]:null;if(typeof session?.cwd!=='string'||!path.isAbsolute(session.cwd))return {ok:false,code:'NOT_FOUND'};folder=session.cwd;}
    else if(given===undefined&&id!==null){const department=snap.departments.find(d=>d.id===id);if(!department)return {ok:false,code:'NOT_FOUND'};folder=department.folder;}
    else return {ok:false,code:'VALUE'};
  }
  return service.saveDepartment({...(id!==null?{id}:{}),name:input.name,folder},account);
}
// 보는 폴더: 더하기는 고르기 창으로만, 빼기는 손님이 더한 폴더(roots.added) 가운데 하나일 때만이다(큰 · 작은 글자는 가리지 않는다)
async function officeAddRoot(service,account){const chosen=await officeChooseFolder(service,account);if(!chosen.ok)return chosen;const snap=await service.snapshot(account);if(!snap?.ok||!snap.available)return {ok:false,code:'NOT_ALLOWED'};return service.saveRoots([...snap.roots.added,chosen.folder],account);}
async function officeRemoveRoot(service,account,dir){if(typeof dir!=='string')return {ok:false,code:'VALUE'};const snap=await service.snapshot(account);if(!snap?.ok||!snap.available)return {ok:false,code:'NOT_ALLOWED'};const added=snap.roots.added,kept=added.filter(d=>d.toLowerCase()!==dir.toLowerCase());if(kept.length===added.length)return {ok:false,code:'NOT_FOUND'};return service.saveRoots(kept,account);}
function subscriptionCall(operation){const service=subscriptions();if(!service)return {ok:false,code:'LAUNCHER_ONLY'};if(accountStatus()?.signedIn!==true)return {ok:false,code:'SIGN_IN_REQUIRED'};return operation(service);}
// 계정판 자동 읽기(지난 7일 사용량 기록용): 로그인한 회원이 계정판을 써 본 PC에서만, 앱이 켜 있는 동안 2분마다 읽을 때인지 본다.
// 읽을 때는 ai-subscriptions.cjs의 autoDue가 정한다(마지막 확인 6시간 뒤 · 계정마다 주간 초기화 10분 전 · 결제일 아침). 끄는 중에는 새로 읽지 않는다.
// 타이머는 node:timers에서 가져와 unref한다(앱은 창이 살아 있는 동안 돌고, main.cjs를 setInterval 없는 VM에서 돌리는 시험도 붙잡지 않는다).
const subscriptionBoardFile=()=>path.join(app.getPath('userData'),'AiSubscriptions','board.json');
// 모델별 토큰(11-15)도 같은 틱에서: 켜 둔 회원이면 3시간마다 뒤에서 센다(Claude Code가 오래된 대화를 지우기 전에 — 설계 검토 7). 판단은 ai-tokens.cjs auto.
require('node:timers').setInterval(()=>{if(quittingRequested||runtime.clientId!=='platform'||smoke||accountStatus()?.signedIn!==true||(!aiSubscriptions&&!fs.existsSync(subscriptionBoardFile())&&!fs.existsSync(path.join(app.getPath('userData'),'AiSubscriptions','token-usage.json'))))return;void Promise.resolve(subscriptions()?.autoTick()).catch(()=>{});void Promise.resolve(subscriptions()?.tokensAuto?.()).catch(()=>{});},2*60*1000).unref?.();
app.on('before-quit',()=>{quittingRequested=true;startupWindow?.prepareForQuit();handoffCover?.prepareForQuit();});
app.on('before-quit',()=>aiSubscriptions?.dispose());
app.on('before-quit',()=>officeService?.close());
app.on('will-quit',event=>{
  if(platformUpdate?.needsInstallHandoff()){
    // will-quit runs only after the normal window/draft guards accepted. Hold
    // this quit until the wrapper starts; it waits for our PID before installing.
    event.preventDefault();
    // 마지막 창이 닫혔다. 가림막은 이제 설치기의 알림을 기다린다(앱이 끝나며 입력이 닫혀도 끝나지 않는다).
    // 가림막에 알리다 난 실패는 넘김을 막지 않는다(가림막은 입력이 닫힌 뒤 10초에 스스로 끝난다)
    try{curtain?.closing();}catch{}
    // 넘김 준비(덮는 창, 가림막)를 기다리는 동안 사람이 끝내면, 설치 작업이 끝나기를 기다린 뒤 넘긴다(그 사이에는 넘김이 바쁘다고 돌아온다)
    void Promise.resolve(platformUpdate.isBusy()?platformUpdate.waitForIdle():null).then(()=>platformUpdate.completeInstall()).then(result=>{
      if(result.ok&&!platformUpdate.needsInstallHandoff())app.quit();
      else{quittingRequested=false;platformTray?.cancelQuit();startupWindow?.cancelQuit();
        // 조용히 바꾸던 앱(쪽지에 숨음이나 최소화로 적음)은 넘김이 실패해도 그 상태 그대로 둔다. 숨은 창이 다른 프로그램 창 위로 나서지 않는다(0.4.96 검수 F2)
        const was=handoffVisibility;
        if(was==='hidden'||was==='minimized'){
          const stayInTray=was==='hidden'&&waitingForFirstWindow&&platformTray?.isActive();
          if(!stayInTray&&!startupGate?.isBlocking()&&(!window||window.isDestroyed())){arrivalShow=was;createWindow();}
          endHandoff();
        }
        else{if(startupGate?.isBlocking())showStartupWindow();else if(!window||window.isDestroyed())createWindow();else{window.show();window.focus();}
        // 다시 만든 창이 보인 뒤에 가림막을 거둔다(2절 가림막 7번). 그 사이 화면이 비지 않는다
        endHandoffWhenShown();}}
    });return;
  }
  startupGate?.dispose();startupWindow?.dispose();platformUpdate?.dispose();companyEntry?.dispose();companyDestinations?.dispose();pulseApp?.dispose();careNotifications?.dispose();desktopPreferences?.dispose();unbindTeacher?.();teacherService?.dispose();suiteFollower?.dispose();suitePublisher?.dispose();auth?.dispose();installations?.dispose();connectionRecovery?.dispose();if(trayAppsTick)clearInterval(trayAppsTick);if(trayAppsTimer)clearTimeout(trayAppsTimer);if(hiddenAuthRetry)clearTimeout(hiddenAuthRetry);
});
// 장치 1(1-가 구현 설계 2절): 설치기가 이 앱을 바꾸는 중이면 창과 서비스를 만들기 전에 설치기에 창을 보이라고 청하고 끝난다. 옛 실행 파일이 켜져 바꾸기를 막지 않게 한다
const yielded=runtime.clientId==='platform'&&packaged&&!smoke&&process.platform==='win32'&&typeof process.env.LOCALAPPDATA==='string'&&yieldToUpdatingInstaller({localAppData:process.env.LOCALAPPDATA,exit:code=>app.exit(code)});
if(yielded){/* 설치기에 넘겼다. app.exit(0)이 끝낸다 */}
else if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',(_event,argv)=>{if(!appLocationReady)return;if(runtime.clientId==='platform'){requestPlatformWindow();return;}if(runtime.clientId==='messenger'&&Array.isArray(argv)&&argv.includes('--view=teaching'))pendingTeachingView=true;if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();sendTeachingView();connectionRecovery?.reopen?.();}});
  app.on('window-all-closed',()=>{if(process.platform!=='darwin'&&(!platformTray?.isActive()||platformTray.isQuitting()||desktopPreferences?.snapshot().preferences.closeToTray===false))app.quit();});
  app.on('activate',()=>{if(!appLocationReady)return;if(runtime.clientId==='platform'){requestPlatformWindow();return;}if(platformTray?.isActive())platformTray.show();else if(!window||window.isDestroyed())createWindow();});
  app.whenReady().then(async()=>{
    const location=await appLocation.run();
    if(!location.continueStartup||quittingRequested)return;
    appLocationReady=true;
    if(runtime.clientId==='platform'){
      const cacheRoot=path.join(app.getPath('userData'),'PlatformUpdates');
      platformUpdate=createPlatformUpdater({enabled:packaged&&!smoke,config:runtime.update,currentVersion:app.getVersion(),platform:process.platform,arch:process.arch,cacheRoot,onChange:state=>{if(['downloading','opening'].includes(state.state))trayMemory?.cancel();sendDesktop('synk:update-changed',state);startupGate?.observe(state);if(unseenFailureResolved(unseenFailure,state))unseenFailure=null;},
        requestQuit:()=>setImmediate(()=>app.quit()),openDiskImage:file=>shell.openPath(file),
        prepareHandoff:info=>prepareUpdateHandoff(info),onHandoffCancelled:info=>{if(info?.reason!=='failed')endHandoff();},
        openInstaller:async(file,options)=>{const nonce=options.automatic?await updateRecovery.prepare({targetVersion:options.version,installerSHA256:options.artifact.sha256,...(options.token?{nonce:options.token}:{})}):null;await launchWindowsUpdate({spawn,file,pid:process.pid,automatic:options.automatic,nonce});}});
      // 시작 창도 앱 창이 기억한 자리를 쓴다. 그래서 창 자리를 시작 관문 앞에서 읽는다
      windowPlacement=createWindowPlacement({directory:app.getPath('userData'),screen,enabled:!smoke});
      // 업데이트 뒤 새 앱: 설치기가 쓴 도착 쪽지에서 창의 자리, 보이는 상태, 마지막 장을 받는다(6절). 이 앱을 켠 프로세스가 쪽지를 쓴 설치기여야 한다
      const arrival=process.platform==='win32'&&packaged&&!smoke&&process.env.LOCALAPPDATA?consumeArrivalNote({localAppData:process.env.LOCALAPPDATA,version:app.getVersion(),parentPid:process.ppid}):null;
      if(arrival){
        try{if(arrival.bounds)windowPlacement.adopt(screen.screenToDipRect(null,arrival.bounds),{maximized:arrival.maximized});}catch{}
        arrivalShow=arrival.visibility==='front'?null:arrival.visibility;
        // 되돌린 앱은 실패 장면을 보이므로 도착 장면을 그리지 않는다. 숨은 채 켜지는 앱도 그리지 않는다
        if(arrival.kind!=='restored'&&(!arrivalShow||arrivalShow==='behind'))arrivalBoot={kind:'arrive',cut:arrival.cut,lit:arrival.lit};
      }
      if(!startupAllowed){
        let recovery;
        try{if(platformUpdate.snapshot().state!=='disabled'&&process.platform==='win32'){updateRecovery=createUpdateRecovery({cacheRoot,localAppData:process.env.LOCALAPPDATA,executablePath:process.execPath,asarPath:app.getAppPath(),currentVersion:app.getVersion()});recovery=await updateRecovery.consume(process.argv);}}
        catch{recovery={code:'UPDATE_RECOVERY_INVALID'};}
        // 로그인 때 숨은 채 시작이면 시작 창을 띄우지 않는다. 확인은 뒤에서 하고, 실패해도 지금 판을 숨은 채 연다
        // 도착 쪽지가 숨음이나 최소화면 시작 창을 띄우지 않고 숨은 채 시작한 길로 간다(2절)
        if(openBeforeStartupGate){arrivalShow=null;arrivalBoot=null;openBeforeStartupGate=false;}
        const hidden=process.platform==='win32'&&!smoke&&(autostartHidden&&readStartHidden(app.getPath('userData'))||arrivalShow==='hidden'||arrivalShow==='minimized');
        // 조용한 업데이트가 실패해 되돌려 켠 앱(도착 쪽지가 숨음이나 최소화)도 숨은 채 연다. 그 실패는 다음에 창을 열 때 보인다(0.4.96 검수 F2, 2절 151행 · 5절 311~312행)
        await beginPlatformStartup(recovery?.code,recovery?.releaseId,{hidden});return;
      }
      platformUpdate.start();
    }
    initializeMain();
  });
}
function showPlatformMain(){
  if(!mainInitialized)initializeMain();
  else if(!window||window.isDestroyed())createWindow();
  // 이미 보이고 초점이 있는 창에는 show · focus가 오지 않는다. 사람이 연 때도 화면이 없으면 되살린다(화면 다시 검수 -d).
  // 안내 화면이 떠 있으면 Workspace의 다시 실행처럼 첫 화면으로 다시 잇는다(화면 다시 검수 -g). 안내 화면을 싣는 중이면 다 실린 뒤 잇는다(엔진 다시 검수 -f GA1)
  else{if(window.isMinimized())window.restore();window.show();window.focus();connectionRecovery?.reopen?.();}
  deliverPendingAction();
}
/* 단축키 따위로 미뤄 둔 요청(명령 메뉴 열기 등)을 앱 창 화면에 한 번 전달한다. 창을 보이는 일과 따로 둔다.
   최소화한 채 넘기는 길도 창을 보이지 않고 이 요청만 전달한다(0.4.97 엔진 다시 검수 -e GA1) */
function deliverPendingAction(){
  if(!pendingDesktopAction||!window||window.isDestroyed())return;
  const contents=window.webContents;
  // 첫 화면이 실린 뒤 다 싣기 전에 화면 프로세스가 사라져도 did-stop-loading이 온다. 그때는 보내지 않고, 되살린 화면이 다 실린 뒤 보낸다(엔진 다시 검수 -g GA2)
  if(contents.isLoading()||contents.isCrashed?.()||contents.getOSProcessId?.()===0||!trustedEntry(contents.getURL(),entry,runtime.clientId))return;
  const action=pendingDesktopAction;pendingDesktopAction=null;
  sendDesktop('synk:desktop-action',action);
}
// 숨은 길(Windows의 숨은 시작)에서 미룬 실패는 사람이 앱을 처음 보는 자리에서 한 번 보인다. 그 자리는 셋이다:
// 열기 요청(트레이, 두 번째 실행, 단축키), 작업 표시줄에서 되살림, 준비된 앱 창을 처음 보일 때. 셋 모두 이 함수를 지난다(0.4.97 엔진 다시 검수 설계 정리)
function showKeptFailure(){
  if(!unseenFailure||quittingRequested||!startupAllowed||startupGate?.isBlocking()||!platformUpdate||platformUpdate.snapshot().state==='disabled')return false;
  const failure=unseenFailure;unseenFailure=null;void beginPlatformStartup(null,null,{initialError:failure});return true;
}
// 다시 열 때(트레이, 두 번째 실행, 단축키)는 숨어 있던 앱 창을 바로 보인다. 시작 창을 띄우지 않고, 미뤄 둔 판 목록을 비운 뒤 곧바로 뒤에서 확인한다.
// 다만 숨은 채 시작한 길에서 아직 보이지 않은 실패 장면이 있으면 그 장면을 먼저 보이고, 그 판은 목록에서 비우지 않는다(1-가 구현 설계 2절)
function requestPlatformWindow(action){
  trayMemory?.cancel();
  // 사람이 부른 열기는 늘 앞으로 띄운다. 도착 쪽지의 「뒤」는 업데이트 뒤 저절로 보일 때만 쓴다. 로그인 때의 숨은 시작도 여기서 끝난다(0.4.96 검수 D5)
  arrivalShow=null;autostartHidden=false;
  if(!startupAllowed&&!startupGate)openBeforeStartupGate=true;
  if(action)pendingDesktopAction=action;
  if(!startupAllowed||startupGate?.isBlocking()){showStartupWindow();return;}
  // 최소화한 창도 isVisible()이 참이다. 숨은 길에서 미룬 실패가 있으면 최소화한 창은 아직 보지 않은 창으로 보고 실패부터 보인다(0.4.97 엔진 검수 GA2)
  const unseenMinimized=Boolean(unseenFailure)&&window&&!window.isDestroyed()&&window.isMinimized();
  const updatable=platformUpdate&&platformUpdate.snapshot().state!=='disabled'&&!quittingRequested;
  // 아직 준비되지 않은 창(최소화로 되돌려 켠 직후)에 미룬 실패가 있으면 준비를 기다리지 않고 실패부터 보인다.
  // 기다리면 ready-to-show가 도착 쪽지를 지운 창을 그냥 보이고 실패는 남았다(0.4.97 엔진 다시 검수 -b GA1)
  const unseenNotReady=updatable&&Boolean(unseenFailure)&&window&&!window.isDestroyed()&&!mainWindowReady;
  if(window&&!window.isDestroyed()&&!unseenNotReady&&(!mainWindowReady||window.isVisible()&&!unseenMinimized)){if(mainWindowReady)showPlatformMain();return;}
  if(showKeptFailure())return;
  showPlatformMain();
  if(updatable)platformUpdate.reopenCheck?.();
}
/* 시작 창은 앱 창의 자리와 크기로 띄운다. 숨은 채 시작한 길에서 사람이 창을 부르면 그때 처음 만든다 */
function showStartupWindow(){
  if(!startupGate?.isBlocking())return;
  startupGate.reveal?.();
  if(!startupWindow){
    const arriving=arrivalBoot;arrivalBoot=null;
    // 도착 장면은 시작 창이 처음 보일 때 시작한다(그 시각부터 잰다)
    orbBoot=orbBoot||(arriving?{...arriving,startedAt:Date.now()}:null)||{startedAt:Date.now(),kind:fs.existsSync(path.join(app.getPath('userData'),'auth-session.enc'))?'back':'first'};
    startupWindow=createStartupUpdateWindow({BrowserWindow,session,ipcMain,appRoot:app.getAppPath(),gate:startupGate,placement:()=>windowPlacement?.restore()||null,boot:()=>orbBoot,icon:path.join(app.getAppPath(),'assets',process.platform==='win32'?'platform.ico':'platform.png'),
      onBridgeLost:()=>startupGate?.cancelInstall(),onClose:()=>{if(!quittingRequested){quittingRequested=true;app.quit();}}});
  }
  // 다른 창 뒤에서 넘어온 업데이트는 새 앱도 앞으로 나서지 않는다(2절 「보이는 업데이트」)
  startupWindow.show({inactive:arrivalShow==='behind'});
}
/* 관문이 풀리면 앱 창을 시작 창과 같은 자리에 숨긴 채 만든다. 얼굴이 첫 구를 그렸다고 알리면(또는 ready-to-show 뒤 3초) 앱 창을 보이고, 다음 장에 시작 창을 없앤다 */
function handoffToMain({waitedForStart=false}={}){
  // 업데이트 뒤의 첫 장면(한 바퀴)이 도는 동안은 넘기지 않는다. 끝나면 쉬는 구 그대로 앱 창이 잇는다.
  // 확인이 시작 창보다 먼저 끝났으면 시작 창이 보일 때까지(3초까지) 기다린 뒤 장면을 돈다. 움직임 줄이기에서는 장면이 없어 기다리지 않는다
  if(orbBoot?.kind==='arrive'&&!prefersReducedMotion()){
    if(startupWindow&&!startupWindow.isVisible()&&!waitedForStart){void Promise.race([startupWindow.whenShown(),new Promise(resolve=>setTimeout(resolve,3000))]).then(()=>handoffToMain({waitedForStart:true}));return;}
    if(startupWindow?.isVisible()){const left=orbBoot.startedAt+ARRIVE_SCENE_MS-Date.now();if(left>0){setTimeout(()=>handoffToMain({waitedForStart:true}),left);return;}}
  }
  startupAllowed=true;
  // 사람이 최소화해 둔 시작 창은 보이는 창으로 세지 않는다(Electron은 최소화한 창도 isVisible()이 참이다). 앱 창도 최소화한 채 연다(0.4.96 검수 D6)
  const startupMinimized=startupWindow?.browserWindow?.()?.isMinimized?.()===true;
  // 업데이트 뒤 「뒤」로 보이던 시작 창을 사람이 최소화했어도 최소화가 이긴다. 숨은 길만 그대로 둔다(0.4.97 엔진 검수 GA1)
  if(startupMinimized&&arrivalShow!=='hidden')arrivalShow='minimized';
  const from=startupWindow?.isVisible()&&!startupMinimized?startupWindow.bounds():null;
  // 앱 창을 먼저 만들고 시작 창을 없앤다. 시작 창이 그때 하나뿐인 창이면 먼저 없애는 순간 「모든 창이 닫힘」이 app.quit()를 불러,
  // 확인이 시작 창이 보이기 전에 끝난 실행(빠른 인터넷, 공개 CI 검사기)이 켜지자마자 멈췄다(0.4.96 대역 빌드 검사에서 찾음)
  // 드러남 값(orbBoot)은 겹쳐 넘기는 길에만 쓴다. 시작 창을 보지 못한 채 넘기거나 앱 창이 이미 준비됐으면 비워,
  // 앱 창 얼굴이 시작 창이 만들어진 때부터 지난 만큼을 건너뛰지 않고 처음부터 드러나게 한다(0.4.96 공개 후보 검수 P2)
  // 최소화한 시작 창에서 넘길 때 앱 창이 있으면 보이지 않는다. 준비됐으면 바로 최소화하고, 준비 전이면 ready-to-show가 도착 값(최소화)대로 최소화한 채 켠다.
  // 준비 전에 보이면 ready-to-show가 「이미 보인 창」으로 건너뛰어 최소화가 빠졌다(0.4.97 엔진 다시 검수 -c GA1)
  if(!from){orbBoot=null;if(startupMinimized&&window&&!window.isDestroyed()){if(mainWindowReady){arrivalShow=null;window.minimize();}deliverPendingAction();}else showPlatformMain();startupWindow?.dispose();startupWindow=null;return;}
  if(window&&!window.isDestroyed()&&mainWindowReady){orbBoot=null;showPlatformMain();setTimeout(()=>{startupWindow?.dispose();startupWindow=null;},50);return;}
  startupHandoff={bounds:from,done:false,timer:null};
  showPlatformMain();
}
/* 다른 창 뒤로 보인다. 최대화는 그 창이 처음 눌릴 때로 미룬다(0.4.96 검수 C3) */
function showBehind(){if(!window||window.isDestroyed())return;if(placementControl?.showBehind)placementControl.showBehind();else window.showInactive();}
function finishHandoff(){
  const handoff=startupHandoff;if(!handoff||handoff.done)return;handoff.done=true;clearTimeout(handoff.timer);startupHandoff=null;
  // 다른 창 뒤로 넘길 때는 최대화를 그 창이 처음 눌릴 때로 미룬다(0.4.96 검수 C3)
  if(window&&!window.isDestroyed()){if(arrivalShow==='behind'){arrivalShow=null;showBehind();}else{if(handoff.bounds.maximized&&!window.isMaximized())window.maximize();window.show();window.focus();}}
  setTimeout(()=>{startupWindow?.dispose();startupWindow=null;},50);
  // 드러남 값은 이 넘기기에만 쓴다. 나중에 앱 창을 다시 만들면 얼굴이 처음부터 드러난다
  setTimeout(()=>{if(!startupWindow)orbBoot=null;},2000);
}
/*
  앱에서 설치기로 넘기기 직전(1-가 구현 설계 2절 「앱에서 설치기로: 가림막」, 6절 「넘김 쪽지」). 쪽지와 가림막은 모양만 바꾼다.
  여기서 난 실패는 모두 삼키고, 그때는 가림막 없이 지금처럼 넘긴다.
  - 앱의 창 가운데 하나라도 보이고 앞에 있으면, 앱 창 위에 같은 자리로 업데이트 장면(절반 깎인 구와 글)을 서서히 덮은 뒤 그 아래에 가림막을 깐다.
  - 다른 창 뒤에 있으면 덮지 않고 그 창 바로 아래에 가림막을 깐다. 넘김 쪽지에 「뒤」로 적어 설치기와 새 앱도 앞으로 나서지 않게 한다.
  - 모든 창이 숨었거나 최소화면 가림막 없이 쪽지에 상태와 자리만 적는다(조용한 업데이트는 장치 1~3과 함께 다음 조각에서 한다).
*/
async function prepareUpdateHandoff({token,version,file}={}){
  try{
    const localAppData=process.env.LOCALAPPDATA;
    if(process.platform!=='win32'||!localAppData||smoke)return;
    endHandoff();
    const gen=handoffGen;
    const main=window&&!window.isDestroyed()?window:null;
    let shown=BrowserWindow.getAllWindows().filter(w=>!w.isDestroyed()&&w.isVisible()&&!w.isMinimized());
    const note={localAppData,token,appPid:process.pid,version,cut:0.5};
    if(!shown.length){
      // 모든 창이 숨었거나 최소화: 주 창 하나뿐이고 쓰다 만 초안이 없으면 조용히 바꾼다. 그 밖에는 설치기 창이 앱 창이 기억한 자리에 앞으로 뜬다
      // 시작 관문 단계(새 판을 받아 바로 넘기는 때)에는 앱 창이 아직 없다. 그때는 시작 창이 앱 창 자리이고 쓰다 만 초안도 없다.
      // 그래서 시작 창은 「다른 창」으로 세지 않고, 최소화는 시작 창이나 도착 쪽지로 본다(0.4.96 검수 D1 · F1)
      const startupWin=startupWindow?.browserWindow?.()||null;
      const others=BrowserWindow.getAllWindows().filter(w=>!w.isDestroyed()&&w!==main&&w!==startupWin);
      // 다만 시작 창이 있는데 보이지도 최소화되지도 않았으면 사람이 켠 실행에서 아직 그려지기 전이다(숨은 채 시작한 길에는 시작 창이 없다).
      // 그때는 조용히 가지 않는다. 설치기 창과 새 앱이 앞으로 뜬다(0.4.96 공개 후보 검수 D1 2차)
      const asked=!!startupWin&&!startupWin.isMinimized();
      const quiet=!asked&&others.length===0&&(!main||!(await draftsUnsaved(main)));
      const minimized=!!(main?.isMinimized()||startupWin?.isMinimized()||!main&&!startupWin&&arrivalShow==='minimized');
      if(gen!==handoffGen)return;
      // 초안을 묻는 사이(0.7초까지) 사람이 창을 열었으면 조용히 가지 않고 보이는 넘김으로 간다(0.4.96 검수 C5)
      const reopened=BrowserWindow.getAllWindows().filter(w=>!w.isDestroyed()&&w.isVisible()&&!w.isMinimized());
      if(!reopened.length){
        const at=windowPlacement?.restore();
        if(writeHandoffNote({...note,bounds:at?screen.dipToScreenRect(null,at):null,maximized:at?.maximized===true,visibility:minimized?'minimized':'hidden',quiet})){quietQuit=quiet;handoffVisibility=minimized?'minimized':'hidden';}
        return;
      }
      shown=reopened;
    }
    const front=!!BrowserWindow.getFocusedWindow();
    let target=null;
    if(startupWindow?.isVisible())target=startupWindow.browserWindow();
    else if(front&&!startupWindow){
      const at=main&&main.isVisible()&&!main.isMinimized()?{...main.getNormalBounds(),maximized:main.isMaximized()}:windowPlacement?.restore();
      const gate={snapshot:()=>({state:'installing',platform:process.platform,currentVersion:app.getVersion(),latestVersion:version,progress:100,automatic:true}),isBlocking:()=>true,retry:()=>({ok:false}),openCurrent:()=>({ok:false}),install:()=>({ok:false})};
      handoffCover=createStartupUpdateWindow({BrowserWindow,session,ipcMain,appRoot:app.getAppPath(),gate,placement:()=>at,boot:()=>({kind:'handoff',startedAt:Date.now()}),icon:path.join(app.getAppPath(),'assets','platform.ico'),onClose:()=>{}});
      handoffCover.show({fade:true});
      await Promise.race([handoffCover.whenShown(),new Promise(resolve=>setTimeout(resolve,2000))]);
      if(gen!==handoffGen)return;
      target=handoffCover.browserWindow();
    }
    else target=main&&main.isVisible()&&!main.isMinimized()?main:shown[0];
    if(!target||target.isDestroyed())return;
    const curtainEvent=curtainEventName();
    // 가림막의 60초는 주 창이 닫힌 뒤부터 잰다. 덮는 창은 먼저 닫히고 주 창은 초안 물음에 머물 수 있다(검수 P2-3)
    const watch=main&&main.isVisible()&&!main.isMinimized()?main:target;
    const written=writeHandoffNote({...note,window:windowHandle(target.getNativeWindowHandle()),watchWindow:windowHandle(watch.getNativeWindowHandle()),bounds:screen.dipToScreenRect(target,target.getNormalBounds()),maximized:target.isMaximized(),visibility:front?'front':'behind',curtainEvent});
    if(written)handoffVisibility=front?'front':'behind';
    if(!written||quittingRequested&&!platformUpdate?.needsInstallHandoff())return;
    const launched=await launchCurtain({spawn,file,token});
    // 가림막을 기다리는 동안 넘김이 거둬졌으면(끝내기 취소, 넘김 실패) 방금 띄운 가림막을 바로 거둔다(검수 P2-1)
    if(gen!==handoffGen){launched?.cancel();return;}
    curtain=launched;
  }catch{}
}
/* 다시 만든 창이 보이면(또는 8초가 지나면) 가림막을 거둔다. 그 사이에 새 넘김이 시작됐으면 건드리지 않는다 */
function endHandoffWhenShown(){
  const gen=handoffGen,started=Date.now();
  const visible=()=>{const shown=startupWindow?.browserWindow?.()||(window&&!window.isDestroyed()?window:null);return !!shown&&shown.isVisible();};
  const tick=()=>{if(gen!==handoffGen)return;if(visible()||Date.now()-started>8000)endHandoff();else setTimeout(tick,50);};
  tick();
}
function prefersReducedMotion(){try{return systemPreferences?.getAnimationSettings?.().prefersReducedMotion===true;}catch{return false;}}
/* 넘김이 취소되거나 실패했다: 가림막을 끝내고, 덮은 장면을 거두고, 쪽지를 지운다 */
/* 주 창 화면에 쓰다 만 초안이 있는지 묻는다. 0.7초 안에 답이 없거나 묻지 못하면 「있음」이다(조용히 가지 않는다) */
function draftsUnsaved(win,timeoutMs=700){
  return new Promise(resolve=>{
    if(!win||win.isDestroyed()||win.webContents.isLoading?.()){resolve(true);return;}
    const id=++draftAskSeq;let timer=null,done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);ipcMain.removeListener('synk:draft-answer',listener);resolve(value);};
    const listener=(event,answerId,unsaved)=>{if(win.isDestroyed()||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||answerId!==id)return;finish(unsaved!==false);};
    ipcMain.on('synk:draft-answer',listener);
    timer=setTimeout(()=>finish(true),timeoutMs);
    try{win.webContents.send('synk:draft-check',id);}catch{finish(true);}
  });
}
function endHandoff(){
  handoffGen++;quietQuit=false;handoffVisibility=null;
  const lifted=curtain;curtain=null;lifted?.cancel();
  const cover=handoffCover;handoffCover=null;cover?.dispose();
  if(process.platform==='win32'&&process.env.LOCALAPPDATA)removeHandoffNote({localAppData:process.env.LOCALAPPDATA});
}
function beginPlatformStartup(recoveryCode=null,recoveryReleaseId=null,{hidden=false,initialError=null}={}){
  if(startupGate?.isBlocking()){showStartupWindow();return Promise.resolve();}
  startupAllowed=false;startupGate?.dispose();startupWindow?.dispose();startupWindow=null;orbBoot=null;
  startupGate=createStartupUpdateGate({updater:platformUpdate,platform:process.platform,recoveryCode,recoveryReleaseId,initialError,hidden,keepDeferred:!!initialError,
    onSilentFailure:failure=>{if(!failure.silent)unseenFailure=failure;},onChange:state=>startupWindow?.publish(state),proceed:()=>handoffToMain()});
  if(!hidden&&(platformUpdate.snapshot().state!=='disabled'||recoveryCode||initialError))showStartupWindow();
  return startupGate.start();
}
function initializeMain(){
  if(mainInitialized||!startupAllowed||!appLocationReady)return;mainInitialized=true;
  const suiteDirectory=!smoke&&authConfig?path.join(app.getPath('appData'),'SYNK Desktop','Suite',sourceScope(runtime.mode,packaged),suiteBindingKey):null;
  suiteStore=suiteDirectory?createSuiteStore({directory:suiteDirectory,key:suiteBindingKey}):null;suiteDeviceId=suiteDirectory?suiteDevice({directory:suiteDirectory}):null;
  suitePublisher=suiteStore&&runtime.clientId==='platform'?createSuitePublisher({store:suiteStore,key:suiteBindingKey,onChange:()=>{if(auth)publishAuthState(projectAuth(auth.status()));}}):null;
  if(runtime.clientId==='platform'){
    desktopPreferences=createDesktopPreferences({directory:app.getPath('userData'),app,globalShortcut,getWindow:()=>window,onShow:action=>requestPlatformWindow(action),onAction:action=>sendDesktop('synk:desktop-action',action),onChange:()=>sendDesktop('synk:desktop-preferences',desktopSnapshot()),enabled:!smoke,packaged,name:current.appId});
    desktopPreferences.initialize();
    windowPlacement=windowPlacement||createWindowPlacement({directory:app.getPath('userData'),screen,enabled:!smoke});
    // 쓰던 글을 지키던 편집기는 PC 0.5.0에서 옛 화면과 함께 거뒀다. 남은 보관은 켤 때마다 지우고, 지우지 못하면 다음에 켤 때 다시 지운다(PC 0.5.0 설계 4.5 R4)
    try{fs.rmSync(path.join(app.getPath('userData'),'DraftRecovery'),{recursive:true,force:true});}catch{/* 다음에 켤 때 다시 지운다 */}
    draftRecovery=createDraftRecovery({directory:path.join(app.getPath('userData'),'DraftRecovery'),safeStorage,getAccount:accountStatus,configFingerprint:authConfig?.fingerprint||'unconfigured',enabled:!smoke,onChange:status=>sendDesktop('synk:draft-recovery-changed',status)});
    draftRecoveryRequests=createDraftRecoveryRequests({getAccount:accountStatus,recovery:draftRecovery});
  }
  if(runtime.clientId==='platform'&&process.platform==='win32'&&process.arch==='x64'&&packaged&&!smoke){
    const reported=new Set();
    trayMemory=createTrayMemoryReclaimer({getWindows:()=>BrowserWindow.getAllWindows(),getMetrics:()=>app.getAppMetrics(),
      busy:()=>quittingRequested||!platformTray?.isActive()||['downloading','opening'].includes(platformUpdate?.snapshot().state),
      reportError:code=>{
        if(reported.has(code))return;reported.add(code);
        void fs.promises.appendFile(path.join(app.getPath('userData'),'tray-memory.log'),new Date().toISOString()+' '+code+'\n').catch(()=>process.emitWarning(code));
      }});
    app.on('before-quit',trayMemory.cancel);
  }
  platformTray=createPlatformTray({app,Tray,Menu,icon:path.join(app.getAppPath(),'assets','platform.ico'),productName:current.productName,getWindow:()=>window,createWindow,onShow:()=>requestPlatformWindow(),onCloseToTray:trayMemory?.schedule,revealForQuit:()=>!quietQuit,enabled:runtime.clientId==='platform'&&process.platform==='win32'&&!smoke,shouldHide:()=>desktopPreferences?.snapshot().preferences.closeToTray!==false,onLaunchApp:id=>void launchFromTray(id)});
  // 숨어 있는 동안 따로 설치하거나 지운 Workspace를 늦어도 10분 안에 따라간다. 확인은 설치 표시 파일만 읽는다(설계 검토 D2)
  if(platformTray.isActive()&&!trayAppsTick&&typeof setInterval==='function'){trayAppsTick=setInterval(()=>void syncTrayApps(),600000);trayAppsTick.unref?.();}
  if(runtime.clientId==='platform'&&platformTray.isActive()&&arrivalShow!=='minimized'){
    const preferences=desktopPreferences.snapshot().preferences;
    const hidden=arrivalShow==='hidden'?preferences.closeToTray!==false:!arrivalShow&&autostartHidden&&preferences.startHidden;
    if(hidden){
      waitingForFirstWindow=true;autostartHidden=false;arrivalShow=null;
      initializeAccountServices();
      return;
    }
  }
  createWindow();
}
// 로그인 상태와 데스크톱 알림은 창을 한 번도 열지 않은 동안에도 동작한다.
function initializeAccountServices(){
  if(!auth){const store=createTokenStore({directory:app.getPath('userData'),safeStorage,scope:current.sessionScope,configFingerprint:authConfig?.fingerprint||'unconfigured'});
    const signInReturn=createSignInReturn();
    auth=createAuthService({config:authConfig,store,openExternal:url=>shell.openExternal(url),appVersion:app.getVersion(),device:suiteDeviceId,onChange:state=>{suitePublisher?.publish(state);publishAuthState(projectAuth(state));if(signInReturn(state))bringToFront(window,{app});}});
    if(suiteStore&&runtime.clientId!=='platform'){suiteFollower=createSuiteFollower({store:suiteStore,auth});void suiteFollower.start();}else if(suitePublisher)void suitePublisher.initialize(auth);else void auth.initialize();
  }
  if(runtime.clientId==='platform'&&!careNotifications){
    careNotifications=createCareNotifications({directory:path.join(app.getPath('userData'),'CareNotifications'),safeStorage,getAccount:accountStatus,loadCare:()=>auth.accountRequest('careLoad',{}),shouldNotify:careReminderDue,Notification,icon:path.join(app.getAppPath(),'assets','platform.ico'),openCare:()=>shell.openExternal('https://synk.im/care/#synk-platform-account='+encodeURIComponent(accountStatus().account.synk_user_id)),enabled:!smoke,configFingerprint:authConfig?.fingerprint||'unconfigured',onChange:value=>sendDesktop('synk:care-notifications-changed',value)});
    careNotifications.start();
  }
}
function createWindow(){
  if(!startupAllowed){showStartupWindow();return;}
  if(!appLocationReady)return;
  waitingForFirstWindow=false;
  mainWindowReady=false;
  let smokeDownload=null;const smokeNetworkRequests=[],smokeConsoleErrors=[];
  const partition='persist:'+current.sessionScope,ownSession=session.fromPartition(partition);
  initializeAccountServices();
  // Keeping an unsaved PULSE draft while quitting cancels the quit and a pending
  // update install, as the platform window's own will-prevent-unload handler
  // below does. The PULSE window is not attached to the tray, so its quit state
  // is reset here; leaving the page without quitting changes nothing.
  if(runtime.clientId==='platform'&&!pulseApp)pulseApp=createPulseApp({clientId:runtime.clientId,getAccount:accountStatus,getRenewingAccount:renewingAccount,getAccountGeneration:pulseAccountGeneration,BrowserWindow,session,dialog,openExternal:url=>shell.openExternal(url),getDownloads:()=>app.getPath('downloads'),onUnloadKept:()=>{if(!quittingRequested)return;quittingRequested=false;platformTray?.cancelQuit();startupWindow?.cancelQuit();platformUpdate?.cancelInstall();startupGate?.cancelInstall();}});
  // The company entry: one fixed company window at a time in an in-memory partition bound to the verified account and
  // its generation (company-entry.cjs), and main's own lookup of the member's company destinations
  // (company-entry-destinations.cjs). A customer invite the company receiver classified goes once to the PULSE manager
  // as exactly {token,requestId,accountGeneration}, and PULSE's answer returns in the contract's codes; cancelling that
  // request cancels the same PULSE invite by the same two IDs. Keeping an unsaved company draft while quitting cancels
  // the quit, as for PULSE. A destination the lookup confirmed opens only through the existing product functions: the
  // Workspace app launch and the PULSE window opening, each with its own sign-in and access checks.
  if(runtime.clientId==='platform'&&!companyEntry){
    companyPartitions=createCompanyEntryPartitions({session,getBinding:companyBinding});
    companyEntry=createCompanyEntryManager({BrowserWindow,session,getBinding:companyBinding,selectCompanyPartition:binding=>companyPartitions.select(binding),deliverCustomer:request=>Promise.resolve(pulseApp.openInvite(request)).then(companyAnswerFromPulse),cancelCustomer:request=>companyAnswerFromPulse(pulseApp.cancelInvite(request)),dialog,onUnloadKept:()=>{if(!quittingRequested)return;quittingRequested=false;platformTray?.cancelQuit();startupWindow?.cancelQuit();platformUpdate?.cancelInstall();startupGate?.cancelInstall();}});
    companyDestinations=createCompanyEntryDestinations({getBinding:companyBinding,getAccessToken:()=>auth.getAccessToken(),fetcher:typeof globalThis.fetch==='function'?globalThis.fetch.bind(globalThis):null,openWorkspace:()=>installations.launch('messenger'),openPulse:()=>pulseApp.open()});
  }
  if(runtime.clientId==='messenger'&&!teacherService){
    const teacherKey=teacherAuthConfig?suiteKey(teacherAuthConfig,runtime.mode):null;
    const teacherDirectory=!smoke&&teacherAuthConfig?path.join(app.getPath('appData'),'SYNK Desktop','Suite',sourceScope(runtime.mode,packaged),teacherKey):null;
    const teacherSuite=teacherDirectory?createSuiteStore({directory:teacherDirectory,key:teacherKey}):null;
    teacherService=createMessengerTeacherService({config:teacherAuthConfig,directory:path.join(app.getPath('userData'),'Teacher'),scope:current.sessionScope+'.teacher',safeStorage,openExternal:url=>shell.openExternal(url),appVersion:app.getVersion(),device:teacherDirectory?suiteDevice({directory:teacherDirectory}):null,onChange:state=>sendMessengerTeacherAuth(window,state,entry,runtime.clientId),suiteStore:teacherSuite,createTokenStore,createAuthService,createSuiteFollower});
    void teacherService.initialize();
  }
  // Same page permissions are not implicit desktop permissions. Media remains unavailable until a deliberate consent flow is implemented.
  // The one exception is WORLD's study reminders: notifications its own trusted page asks for in the main window (security.cjs).
  const worldNotification=(contents,permission,url,isMainFrame)=>!!window&&!window.isDestroyed()&&contents===window.webContents&&worldNotificationAllowed({clientId:runtime.clientId,permission,url,entry,isMainFrame});
  ownSession.setPermissionRequestHandler((contents,permission,callback,details)=>callback(worldNotification(contents,permission,details?.requestingUrl,details?.isMainFrame)));
  ownSession.setPermissionCheckHandler((contents,permission,_origin,details)=>worldNotification(contents,permission,details?.requestingUrl||contents?.getURL?.(),details?.isMainFrame));
  if(smoke&&runtime.clientId==='platform')ownSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{smokeNetworkRequests.push(details.url);callback({cancel:true});});
  // A development entry on a fixed local port is loaded only while this OS user's own program answers it.
  else if(localServer.required)ownSession.webRequest.onBeforeRequest({urls:['http://*/*','ws://*/*']},(details,callback)=>localServer.decide(details.url,callback));
  ownSession.webRequest.onHeadersReceived((details,callback)=>callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':[details.url.startsWith('synk-desktop://platform/')?nativeContentSecurityPolicy():details.url.startsWith('synk-desktop://status/')?connectionContentSecurityPolicy():contentSecurityPolicy(details.resourceType)]}}));
  ownSession.removeAllListeners('will-download');
  ownSession.on('will-download',createDownloadHandler({getWindow:()=>window,session:ownSession,entry,clientId:runtime.clientId,
    configureSave(item,spec){
      if(smoke){const dir=smokeArtifacts;fs.mkdirSync(dir,{recursive:true});item.setSavePath(path.join(dir,runtime.clientId+'-synthetic-export.'+spec.extension));item.once('done',(_event,state)=>{smokeDownload={state,mime:item.getMimeType(),size:item.getReceivedBytes()};});return;}
      item.setSaveDialogOptions({title:'SYNK 기록 저장',defaultPath:path.join(app.getPath('downloads'),item.getFilename()),filters:[{name:spec.filterName,extensions:[spec.extension]}]});
    },
    onDenied(reason){if(smoke||!window||window.isDestroyed())return;dialog.showMessageBox(window,{type:'info',title:'SYNK 기록 저장',message:reason==='session'?'회사 계정으로 로그인한 뒤 다시 저장해 주세요.':'이 파일은 앱에서 저장할 수 없어요.',detail:runtime.clientId==='messenger'?'작업실의 AI 업무 연습 기록(TXT)만 64KB까지 저장할 수 있어요.':'JSON 기록은 32MB까지만 저장할 수 있어요. 더 큰 기록은 웹에서 내보내 주세요.'});},
  }));
  if(!protocolRegistered){const nativeContent=createNativeContent({appRoot:app.getAppPath()}),connectionContent=createConnectionContent({appRoot:app.getAppPath(),clientId:runtime.clientId,mode:runtime.mode,entry,messengerCloudPreview:runtime.messengerCloudPreview,worldCloudPreview:runtime.worldCloudPreview,productName:current.productName});ownSession.protocol.handle('synk-desktop',request=>request.url.startsWith('synk-desktop://platform/')&&runtime.clientId==='platform'?nativeContent(request):connectionContent(request));}
  protocolRegistered=true;
  const isPlatform=runtime.clientId==='platform';
  // 시작 창에서 넘어올 때는 시작 창이 있던 자리 그대로 만든다(사람이 시작 창을 옮겼어도 따라간다)
  const handoffBounds=isPlatform?startupHandoff?.bounds:null;
  const placement=isPlatform?(handoffBounds?{...windowPlacement.restore(),x:handoffBounds.x,y:handoffBounds.y,width:handoffBounds.width,height:handoffBounds.height,maximized:handoffBounds.maximized}:windowPlacement.restore()):null;
  window=new BrowserWindow({width:isPlatform?1440:1180,height:isPlatform?940:860,minWidth:isPlatform?960:720,minHeight:isPlatform?680:580,...(placement?{x:placement.x,y:placement.y,width:placement.width,height:placement.height,minWidth:placement.minWidth,minHeight:placement.minHeight}:{}),title:current.productName,icon:path.join(app.getAppPath(),'assets',isPlatform&&process.platform==='win32'?'platform.ico':runtime.clientId+'.png'),show:false,autoHideMenuBar:true,frame:!isPlatform,backgroundColor:isPlatform?'#000000':'#ffffff',webPreferences:preferences(path.join(__dirname,'preload.cjs'),partition)});
  Menu.setApplicationMenu(process.platform==='darwin'?Menu.buildFromTemplate([{label:current.productName,submenu:[{role:'about'},{role:'quit'}]},{label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]}]):null);
  const contents=window.webContents;
  contents.on('did-finish-load',sendTeachingView);
  if(isPlatform)contents.on('did-stop-loading',deliverPendingAction);
  if(isPlatform){placementControl=windowPlacement.attach(window,{maximized:placement.maximized});contents.on('did-finish-load',()=>desktopPreferences.applyWindow(window));}
  // A new document committed in the platform window drops the company assignment its former document confirmed and
  // ends that document's lookup in flight (company-entry-destinations.cjs invalidate). Electron sends did-navigate only
  // for a main-frame document that actually changed: a move inside the same document, a subframe, and a navigation
  // will-navigate stopped (an outside link opened in the browser) keep the record.
  if(isPlatform)contents.on('did-navigate',()=>companyDestinations?.invalidate());
  // The Workspace page keeps unsaved drafts with beforeunload; without this prompt closing, reopening or quitting is cancelled with no word (10-22).
  if(isPlatform)installDraftExitGuard({contents,window,dialog,getRecoveryAvailable:()=>!!draftRecovery?.available()});else if(runtime.clientId==='messenger')installDraftExitGuard({contents,window,dialog,text:WORKSPACE_EXIT_TEXT});
  platformTray?.attachWindow(window);
  // 쓰던 글을 지키려고 끝내기를 그만두면 끝내는 중 표시를 되돌린다. Workspace도 같다. 되돌리지 않으면 화면 프로세스 되살리기가 끝내는 중으로 보고 멈춘다(엔진 검수 GA1)
  contents.on('will-prevent-unload',event=>{if(!event.defaultPrevented){quittingRequested=false;if(isPlatform){startupWindow?.cancelQuit();platformUpdate?.cancelInstall();startupGate?.cancelInstall();}}});
  if(smoke)contents.on('console-message',details=>{if(details.level==='error')smokeConsoleErrors.push({message:details.message.slice(0,300),source:details.sourceId.split('?')[0],line:details.lineNumber});});
  const send=(channel,value)=>{if(window&&!window.isDestroyed()&&trustedEntry(window.webContents.getURL(),entry,runtime.clientId))window.webContents.send(channel,value);};
  const windowState=()=>({maximized:window.isMaximized(),minimized:window.isMinimized(),focused:window.isFocused(),platform:process.platform});
  for(const event of ['maximize','unmaximize','minimize','restore','focus','blur'])window.on(event,()=>send('synk:window-state-changed',windowState()));
  contents.on('context-menu',(_event,params)=>{if(!isPlatform)return;const template=[];if(params.isEditable)template.push({role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'});else if(params.selectionText)template.push({role:'copy'});if(template.length)Menu.buildFromTemplate(template).popup({window});});
  let lastExternal=0;
  function external(url){const destination=externalDestination(url,entry,runtime.clientId,runtime.mode);if(destination&&Date.now()-lastExternal>1500&&!smoke){lastExternal=Date.now();shell.openExternal(destination).catch(()=>{});}}
  contents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
  contents.on('will-attach-webview',event=>event.preventDefault());
  contents.on('will-navigate',(event,url)=>{if(!allowedNavigation(url,entry,runtime.clientId)){event.preventDefault();external(url);}});
  contents.on('will-redirect',(event,url)=>{if(!allowedNavigation(url,entry,runtime.clientId))event.preventDefault();});
  ensureInstallations();
  // 창이 생기면 화면이 로그인 다시 확인을 맡는다
  if(hiddenAuthRetry){clearTimeout(hiddenAuthRetry);hiddenAuthRetry=null;}
  // 창이 보이거나 초점을 받을 때 지금 주 프레임에 화면이 없으면 첫 화면을 싣는다. 화면 프로세스의 종료 알림을 받지 못했어도 같다(2026-11-19 설계 검토).
  // 이미 보이고 초점이 있는 창은 트레이 열기와 다시 실행이 showPlatformMain(Workspace는 second-instance)에서 본다
  window.on('show',()=>{connectionRecovery?.recoverIfGone?.();});
  window.on('focus',async()=>{connectionRecovery?.recoverIfGone?.();try{send('synk:clients-changed',await installations.getClients());}catch{}});
  // 창이 보이거나 초점을 받으면 트레이의 앱 줄도 다시 본다. 설치 생명주기는 설치 · 삭제를 알리지 않는다(PC 0.5.0 설계 검토 D2)
  if(isPlatform)for(const event of ['show','focus'])window.on(event,()=>void syncTrayApps());
  // 최소화한 채 되돌려 켠 앱의 미룬 실패는 사람이 작업 표시줄에서 창을 되살릴 때 보인다(0.4.97 엔진 검수 GA2)
  if(isPlatform)window.on('restore',()=>{showKeptFailure();});
  const companyRequest=createCompanyRequests({entry,clientId:runtime.clientId,session:ownSession,auth});
  // The company entry's refusals before its own service sees a request (another client, the smoke run, the sign-in
  // suite not ready) have the same answer form (company-entry.cjs entryRefusal).
  const companyEntryCall=(operation,input,unavailable)=>{
    if(!isPlatform||smoke||!companyEntry||!companyDestinations)return entryRefusal(input,unavailable,false);
    return requireSuite(operation).then(result=>result?.code==='SUITE_UNAVAILABLE'?entryRefusal(input,'TEMPORARY_UNAVAILABLE',true):result);
  };
  // The platform window and main frame that asked, read just after the sender check accepted them. A lookup that
  // outlives them (another window, another document) ends without reading its answer, and the assignment it confirmed
  // opens only for that same window and frame.
  const platformSender=()=>{const asked=window,frame=asked?.webContents?.mainFrame;return ()=>!!asked&&asked===window&&!asked.isDestroyed()&&asked.webContents.mainFrame===frame&&frame?.detached!==true&&trustedEntry(frame?.url,entry,runtime.clientId);};
  // One public cancel for the request the portal names by exactly {requestId,accountGeneration}: a company invite
  // hand-off (and the PULSE invite a customer code was passed on to, by the same two IDs), a lookup in flight or the
  // assignment it confirmed, or the portal's own PULSE invite. Each part matches both IDs exactly, so another request
  // or generation is left alone. The answer is how the matched request ended, in the company entry's public form
  // (CANCELLED before its token left main, HANDOFF_UNCONFIRMED after), or null when nothing matched.
  const cancelCompanyEntry=input=>{const company=companyEntry.cancel(input),lookup=companyDestinations.cancel(input),pulse=companyAnswerFromPulse(pulseApp.cancelInvite(input));return company??lookup??pulse??null;};
  const handlers={
    'synk:environment':()=>({clientId:runtime.clientId,mode:runtime.mode,platform:process.platform,arch:process.arch,version:app.getVersion(),sessionScope:current.sessionScope,nativeShell:isPlatform,closeToTray:!!platformTray?.isActive()&&desktopPreferences?.snapshot().preferences.closeToTray!==false,teacherPreviewAvailable:teacherPreview.available(),productPreviewsAvailable:productPreviews.available(),publicAppsAvailable:publicApps.available(),qaGuestEntry:smoke||globalThis.__synkNativeQAGuestEntry===true,...(runtime.clientId==='world'?{worldRoutes:WORLD_ROUTE_NAMES}:{})}),
    'synk:desktop-preferences':()=>desktopSnapshot(),
    'synk:care-notifications-status':()=>isPlatform?careNotifications.status():{ok:false,code:'LAUNCHER_ONLY'},
    'synk:care-notifications-configure':configureCareNotifications,
    'synk:care-notifications-test':()=>isPlatform&&!smoke?careNotifications.test():{ok:false,code:'LAUNCHER_ONLY'},
    'synk:update-status':()=>platformUpdate?.snapshot()||{ok:false,state:'disabled',code:'UPDATE_UNAVAILABLE'},
    'synk:check-for-update':()=>platformUpdate?.checkForUpdate()||{ok:false,state:'disabled',code:'UPDATE_UNAVAILABLE'},
    'synk:download-update':()=>platformUpdate?.downloadUpdate()||{ok:false,state:'disabled',code:'UPDATE_UNAVAILABLE'},
    'synk:install-update':()=>platformUpdate?.installUpdate()||{ok:false,state:'disabled',code:'UPDATE_UNAVAILABLE'},
    'synk:desktop-preferences-update':patch=>{if(!isPlatform)return {ok:false,code:'LAUNCHER_ONLY'};const result=desktopPreferences.update(patch);return result.ok?desktopSnapshot():result;},
    'synk:copy-platform-diagnostics':input=>isPlatform&&!smoke?copyDiagnostics({clipboard,input,environment:{platform:process.platform,arch:process.arch,version:app.getVersion(),mode:runtime.mode},account:accountStatus()}):{ok:false,code:'CLIPBOARD_UNAVAILABLE'},
    'synk:draft-recovery-status':owner=>isPlatform?draftRecoveryRequests.status(owner):{ok:false,code:'LAUNCHER_ONLY'},
    'synk:draft-recovery-enabled':(value,owner)=>isPlatform?draftRecoveryRequests.setEnabled(value,owner):{ok:false,code:'LAUNCHER_ONLY'},
    'synk:draft-recovery-load':(slot,owner)=>isPlatform?draftRecoveryRequests.load(slot,owner):{ok:false,code:'LAUNCHER_ONLY'},
    'synk:draft-recovery-save':(slot,value,owner)=>isPlatform?draftRecoveryRequests.save(slot,value,owner):{ok:false,code:'LAUNCHER_ONLY'},
    'synk:draft-recovery-clear':(slot,owner)=>isPlatform?draftRecoveryRequests.clear(slot,owner):{ok:false,code:'LAUNCHER_ONLY'},
    'synk:open-public-app':id=>requireSuite(()=>publicApps.open(id)),
    'synk:open-portal-purpose':id=>isPlatform&&!smoke?requireSuite(()=>portalNavigation.openPurpose(id)):{ok:false,code:'PORTAL_PURPOSE_UNAVAILABLE'},
    'synk:teacher-preview':()=>requireSuite(()=>teacherPreview.open()),
    'synk:product-preview':id=>requireSuite(()=>productPreviews.open(id)),
    'synk:clients':()=>installations.getClients(),'synk:launch':id=>requireSuite(()=>installations.launch(id)),
    'synk:prepare-client':id=>installations.prepareClient(id),'synk:cancel-preparation':id=>installations.cancelPreparation(id),'synk:open-installer':id=>installations.openInstaller(id),
    // 업데이트 뒤의 첫 장면은 시작 창이 끝까지 그린다. 앱 창은 그 끝(쉬는 구, 뜬 눈)에서 잇는다
    'synk:orb-boot':()=>isPlatform?(orbBoot?.kind==='arrive'?{kind:'back',startedAt:orbBoot.startedAt-60000}:orbBoot):null,
    'synk:orb-first-frame':()=>{if(isPlatform)finishHandoff();return {ok:true};},
    'synk:window-state':windowState,'synk:window-action':action=>{if(!isPlatform)return {ok:false,code:'LAUNCHER_ONLY'};if(action==='minimize')window.minimize();else if(action==='toggle-maximize'){if(window.isMaximized())window.unmaximize();else window.maximize();}else if(action==='close')window.close();else return {ok:false,code:'INVALID_WINDOW_ACTION'};return {ok:true};},
    'synk:auth-status':accountStatus,'synk:auth-sign-in':async()=>{if(suitePublisher&&!suitePublisher.beginSignIn())return accountStatus();await auth.signIn();return accountStatus();},'synk:auth-sign-up':openAccountSignUp,'synk:auth-cancel':()=>auth.cancel(),'synk:auth-sign-out':signOutAccount,
    'synk:account-request':(operation,params)=>requireSuite(()=>auth.accountRequest(operation,params)),'synk:company-request':companyRequest,
    'synk:account-identity':()=>isPlatform?requireSuite(()=>auth.identity()):{ok:false,code:'LAUNCHER_ONLY'},'synk:auth-security':section=>openAccountSecurity(section),'synk:auth-recover':openAccountRecover,
    'synk:pulse-app-open':()=>isPlatform&&!smoke?requireSuite(()=>pulseApp.open()):{ok:false,code:'PULSE_APP_UNAVAILABLE'},
    // A customer invite with its request, exactly {token,requestId,accountGeneration}; any other form, a lone {token}
    // included, is refused. pulse-app.cjs checks it again, binds it to auth's current generation, waits for the
    // document's own receipt and keeps the token out of every result. Every answer, a refusal here included, has the
    // same two forms.
    'synk:pulse-app-open-invite':input=>isPlatform&&!smoke?requireSuite(()=>pulseApp.openInvite(input)).then(result=>result?.code==='SUITE_UNAVAILABLE'?pulseInviteRefusal(input,'SUITE_UNAVAILABLE'):result):pulseInviteRefusal(input,'PULSE_APP_UNAVAILABLE'),
    // The company entry (company-entry-contract-v1 §7, company-entry-native-assignment §4). The renderer names only its request: an employee's
    // complete link {href,requestId,accountGeneration}, a bare code {code,requestId,accountGeneration} whose kind the
    // company's receiver decides, the cancel of exactly that request {requestId,accountGeneration}, the lookup of
    // the member's own company destinations {requestId,accountGeneration}, and the opening of one fixed destination
    // that lookup confirmed {destination,requestId,accountGeneration}. Main picks the URL, the window, its partition,
    // the product function and the account. Each answer is {ok:true,...} or {ok:false,requestId,accountGeneration,code,
    // retryable}; a cancel answers with the response of the request it ended, or null.
    'synk:company-invite-handoff':input=>companyEntryCall(()=>companyEntry.handoffLink(input),input,'HANDOFF_UNAVAILABLE'),
    'synk:company-invite-inspect':input=>companyEntryCall(()=>companyEntry.inspectCode(input),input,'HANDOFF_UNAVAILABLE'),
    'synk:company-entry-cancel':input=>isPlatform&&!smoke&&companyEntry&&companyDestinations?requireSuite(()=>Promise.resolve(cancelCompanyEntry(input))).then(result=>result?.code==='SUITE_UNAVAILABLE'?null:result??null):null,
    'synk:company-entry-destinations':input=>{const asking=platformSender();return companyEntryCall(()=>companyDestinations.resolve(input,{isCurrentSender:asking}),input,'TEMPORARY_UNAVAILABLE');},
    'synk:company-entry-open-destination':input=>{const asking=platformSender();return companyEntryCall(()=>companyDestinations.open(input,{isCurrentSender:asking}),input,'HANDOFF_UNAVAILABLE');},
    'synk:subscriptions-snapshot':options=>subscriptionCall(s=>s.snapshot({refreshTools:options?.refreshTools===true})),
    'synk:subscriptions-check':ids=>subscriptionCall(s=>s.check(Array.isArray(ids)?{ids:ids.filter(id=>typeof id==='string')}:{})),
    'synk:subscriptions-use-existing':service=>subscriptionCall(s=>s.useExisting(service)),
    'synk:subscriptions-login':(service,options)=>subscriptionCall(s=>s.startLogin(service,{email:options?.email,console:options?.console===true})),
    'synk:subscriptions-code':(id,code)=>subscriptionCall(s=>s.submitCode(id,code)),
    'synk:subscriptions-cancel':id=>subscriptionCall(s=>s.cancelLogin(id)),
    'synk:subscriptions-open-url':id=>subscriptionCall(s=>s.openLoginUrl(id)),
    'synk:subscriptions-install':service=>subscriptionCall(s=>s.openInstaller(service)),
    'synk:subscriptions-help':key=>subscriptionCall(s=>s.openHelp(key)),
    'synk:subscriptions-save':patch=>subscriptionCall(s=>s.save(patch)),
    'synk:subscriptions-key':(service,key,options)=>subscriptionCall(s=>s.connectKey(service,key,{replace:typeof options?.replace==='string'?options.replace:null})),
    'synk:subscriptions-tokens':()=>subscriptionCall(s=>s.tokens()),
    'synk:subscriptions-tokens-scan':options=>subscriptionCall(s=>s.tokensScan({force:options?.force===true})),
    'synk:subscriptions-tokens-enable':on=>subscriptionCall(s=>s.tokensEnable(on===true)),
    'synk:subscriptions-tokens-live':on=>subscriptionCall(s=>s.tokensLive(on===true)),
    'synk:site-visits-snapshot':()=>siteVisitsCall(),
    'synk:sns-health-snapshot':()=>snsHealthCall(),
    'synk:solio-backup-snapshot':()=>solioBackupCall((service,account)=>service.snapshot(account)),
    // 누를 때의 계정과 로그인 세대를 잡아 둔다. 같은 계정이라도 다시 로그인했으면 다른 회차로 본다(GPT 셋째 검수 GA4)
    'synk:solio-backup-start':mode=>solioBackupCall((service,account)=>{const generation=accountStatus()?.sessionGeneration;return service.start(account,mode,{getHint:solioBackupHint,isCurrent:()=>{const now=accountStatus();return now?.signedIn===true&&now.account?.synk_user_id===account.synk_user_id&&now.sessionGeneration===generation;},isSameLogin:()=>{const now=accountStatus();if(now?.sessionGeneration!==generation)return false;return now?.signedIn===true?now.account?.synk_user_id===account.synk_user_id:renewingAccount()===account.synk_user_id;}});}),
    'synk:solio-backup-open':topic=>solioBackupCall((service,account)=>service.open(account,topic)),
    'synk:solio-backup-dismiss':()=>solioBackupCall((service,account)=>service.dismiss(account)),
    // 솔리오 「사무실」(구현설계.md 13절): 모두 officeCall을 거친다. 폴더는 본체가 고르기 창이나 지금 선 세션에서 받는다
    'synk:office-snapshot':()=>officeCall(async(service,account)=>{const result=await service.snapshot(account);return result?.ok?{...result,hooks:{on:false,available:false}}:result;}),
    'synk:office-watch':on=>officeCall((service,account)=>service.watch(on===true,account)),
    'synk:office-department-save':input=>officeCall((service,account)=>officeSaveDepartment(service,account,input)),
    'synk:office-department-remove':id=>officeCall((service,account)=>service.removeDepartment(id,account)),
    'synk:office-session-assign':(sessionId,departmentId)=>officeCall((service,account)=>service.assign(sessionId,departmentId??null,account)),
    'synk:office-settings-save':input=>officeCall((service,account)=>service.saveSettings(input,account)),
    'synk:office-roots-add':()=>officeCall((service,account)=>officeAddRoot(service,account)),
    'synk:office-roots-remove':dir=>officeCall((service,account)=>officeRemoveRoot(service,account,dir)),
    'synk:office-seen':departmentId=>officeCall((service,account)=>service.seen(departmentId,account)),
  };
  for(const [channel,handler]of Object.entries(handlers)){ipcMain.removeHandler(channel);ipcMain.handle(channel,async(event,...args)=>{assertSender(event,window,entry,runtime.clientId);try{return await handler(...args);}catch(error){return {ok:false,error:publicError(error)};}});}
  unbindTeacher?.();unbindTeacher=bindMessengerTeacherIPC({ipcMain,getWindow:()=>window,service:teacherService,entry,clientId:runtime.clientId,environment:{mode:runtime.mode,platform:process.platform,arch:process.arch,version:app.getVersion()}});
  window.once('ready-to-show',()=>{mainWindowReady=true;if(smoke||isPlatform&&!startupAllowed)return;if(isPlatform&&startupHandoff&&!startupHandoff.done){startupHandoff.timer=setTimeout(finishHandoff,3000);return;}/* 얼굴의 첫 장 알림이 이 이벤트보다 먼저 와서 넘기기가 이미 창을 보였으면 다시 보이지 않는다(「뒤」로 보인 창이 앞으로 나서지 않게, 0.4.96 검수 C4) */if(isPlatform&&window.isVisible())return;const tray=isPlatform&&platformTray.isActive(),hidden=isPlatform&&(!arrivalShow&&autostartHidden&&desktopPreferences.snapshot().preferences.startHidden&&tray||arrivalShow==='hidden'&&tray&&desktopPreferences.snapshot().preferences.closeToTray!==false);/* 로그인 때의 숨은 시작은 첫 창에만 쓴다. 넘김 실패로 다시 만든 창이나 사람이 연 창은 숨기지 않는다(0.4.96 검수 D5) */if(isPlatform)autostartHidden=false;/* 도착 쪽지가 최소화였으면(또는 숨음인데 트레이가 없으면) 최소화한 채 켠다(2절 「조용한 업데이트」의 새 앱) */if(isPlatform&&!hidden&&(arrivalShow==='minimized'||arrivalShow==='hidden')){arrivalShow=null;window.minimize();return;}if(isPlatform&&hidden)arrivalShow=null;if(!hidden){/* 숨은 길에서 미룬 실패가 있으면 창을 보이기 전에 실패부터 보인다(로그인 때 숨은 시작인데 트레이가 없어 창이 그냥 보이는 경우 따위) */if(isPlatform&&showKeptFailure())return;if(isPlatform&&arrivalShow==='behind'){arrivalShow=null;showBehind();}else window.show();}});
  if(smoke) {
    const timer=setTimeout(()=>{process.stdout.write('SYNK_SMOKE '+JSON.stringify({ok:false,clientId:runtime.clientId,error:'TIMEOUT'})+'\n');app.exit(1);},20000);
    contents.once('did-finish-load',async()=>{
      try {
        if(runtime.clientId==='platform')for(let i=0;i<100;i++){if(await contents.executeJavaScript(`document.documentElement.dataset.ready==='true'`))break;await new Promise(resolve=>setTimeout(resolve,50));}
        const result=await contents.executeJavaScript(`(async()=>({title:document.title,node:typeof require,environment:await window.synkDesktop.getEnvironment(),clients:await window.synkDesktop.getClients(),auth:await window.synkDesktop.authStatus(),rejected:await window.synkDesktop.launch('../cmd')}))()`);
        const probeOptions={directory:path.join(app.getPath('userData'),'StorageProbe'),safeStorage,scope:current.sessionScope,configFingerprint:'synthetic-only'};
        const storageProbe=createTokenStore(probeOptions);await storageProbe.save({refreshToken:'synthetic-dpapi-probe',subject:'synthetic-subject'});
        const encrypted=fs.readFileSync(path.join(probeOptions.directory,'auth-session.enc'));
        const restoredProbe=await createTokenStore(probeOptions).load();await storageProbe.clear();
        result.secureStorageRoundtrip={available:storageProbe.available(),encrypted:!encrypted.includes(Buffer.from('synthetic-dpapi-probe')),restored:restoredProbe.refreshToken==='synthetic-dpapi-probe',removed:!fs.existsSync(path.join(probeOptions.directory,'auth-session.enc'))};
        if(runtime.clientId==='world')result.frame=await contents.executeJavaScript(`new Promise(resolve=>{const f=document.createElement('iframe');f.src='/korean-racing/';f.hidden=true;f.onload=()=>resolve({title:f.contentDocument?.title,documentLoaded:f.contentDocument?.readyState==='complete'&&!!f.contentDocument?.title});document.body.append(f);setTimeout(()=>resolve({documentLoaded:false}),8000);})`);
        if(runtime.clientId==='world'){
          const filename=runtime.clientId==='world'?'synk-connected-learning.json':'synk-platform-device-settings.json';
          await contents.executeJavaScript(`(()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({synthetic:true})],{type:'application/json'}));a.download=${JSON.stringify(filename)};a.click();})()`);
          for(let i=0;i<100&&!smokeDownload;i++)await new Promise(resolve=>setTimeout(resolve,20));
        }
        const artifacts=smokeArtifacts;fs.mkdirSync(artifacts,{recursive:true});
        if(runtime.clientId==='platform')result.ui=packaged?{ok:true,packageBootOnly:true}:await require('../tools/native-ui-probe.cjs').probeNativeUI(contents,artifacts);
        result.packaged=packaged;result.capturePath=path.join(artifacts,runtime.clientId+'-hidden-preview.png');
        fs.writeFileSync(path.join(artifacts,runtime.clientId+'-hidden-preview.png'),(await contents.capturePage()).toPNG());
        if(runtime.clientId==='platform'){result.nativeShell=await contents.executeJavaScript(`({url:location.href,ready:document.documentElement.dataset.ready==='true',face:!!document.querySelector('#portal-entry [data-portal-stage]')&&!!document.getElementById('portal-entry')?.dataset.portalState&&!document.querySelector('.host-fallback'),html:document.body.innerText.length,remoteResources:performance.getEntriesByType('resource').filter(r=>/^https?:/.test(r.name)).map(r=>r.name)})`);result.nativeShell.networkBlocked=true;result.nativeShell.networkRequests=smokeNetworkRequests;result.nativeShell.consoleErrors=smokeConsoleErrors;}
        process.stdout.write('SYNK_SMOKE '+JSON.stringify({ok:result.node==='undefined'&&result.rejected.code==='UNKNOWN_CLIENT'&&(runtime.clientId!=='world'||smokeDownload?.state==='completed')&&(runtime.clientId!=='platform'||result.ui?.ok&&result.nativeShell.ready&&result.nativeShell.url===PLATFORM_ENTRY&&result.nativeShell.face&&result.nativeShell.remoteResources.length===0&&smokeNetworkRequests.length===0&&smokeConsoleErrors.length===0),...result,download:smokeDownload,visible:window.isVisible(),preferences:contents.getLastWebPreferences()})+'\n');clearTimeout(timer);app.exit(0);
      }catch(error){process.stdout.write('SYNK_SMOKE '+JSON.stringify({ok:false,clientId:runtime.clientId,error:error.message})+'\n');clearTimeout(timer);app.exit(1);}
    });
  }
  connectionRecovery=createConnectionRecovery({contents,entry,isQuitting:()=>quittingRequested});
  void connectionRecovery.connect();
}
