'use strict';
const {app,BrowserWindow,ipcMain,session,protocol,Menu,Tray,shell,dialog,safeStorage,screen,globalShortcut,clipboard}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {CLIENTS,DEV_URLS,PLATFORM_ENTRY,identity}=require('./catalog.cjs');
const {safeEntry,assertSender,trustedEntry,preferences,allowedNavigation,externalDestination,contentSecurityPolicy,nativeContentSecurityPolicy}=require('./security.cjs');
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
const {suiteKey,createSuiteStore,createSuitePublisher,createSuiteFollower}=require('./suite-session.cjs');
const {createCompanyRequests}=require('./company-requests.cjs');
const {createTeacherPreview}=require('./teacher-preview.cjs');
const {createMessengerTeacherService,bindMessengerTeacherIPC,sendMessengerTeacherAuth,messengerViewEntry}=require('./messenger-teacher.cjs');
const {createProductPreviews}=require('./product-preview.cjs');
const {createPublicApps}=require('./public-apps.cjs');
const {createDownloadHandler}=require('./downloads.cjs');
const {installDraftExitGuard}=require('./draft-exit.cjs');
const {createPlatformTray}=require('./platform-tray.cjs');
const {createDesktopPreferences}=require('./desktop-preferences.cjs');
const {createWindowPlacement}=require('./window-placement.cjs');
const {createDraftRecovery}=require('./draft-recovery.cjs');
const {createDraftRecoveryRequests}=require('./draft-recovery-ipc.cjs');
const {copyDiagnostics}=require('./diagnostics-clipboard.cjs');
const {createPulseRequests,PULSE_ORIGIN,PULSE_ENTRY}=require('./pulse-requests.cjs');
const {createPulseApp}=require('./pulse-app.cjs');
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
const current=identity(runtime.clientId,runtime.mode),entry=messengerViewEntry(runtime.entry,runtime.clientId,process.argv);
const publicApps=createPublicApps({clientId:runtime.clientId,mode:runtime.mode,openExternal:url=>shell.openExternal(url),accountStatus:()=>accountStatus()});
const teacherPreview=createTeacherPreview({packaged,mode:runtime.mode,clientId:runtime.clientId,executable:process.execPath,appRoot:app.getAppPath(),spawn,authConfigPath:developmentAuthConfigPath});
const smokeArtifacts=smoke?(packaged?path.join(app.getPath('temp'),'SYNK Desktop Smoke',current.sessionScope):path.join(__dirname,'..','artifacts')):null;
const authConfig=configuration(runtime.mode==='development'&&!runtime.auth?.clients?.[runtime.clientId]?null:runtime.auth,runtime.clientId,runtime.mode);
const teacherAuthConfig=runtime.clientId==='messenger'?configuration(runtime.auth?.clients?.teacher?runtime.auth:null,'teacher',runtime.mode):null;
app.setName(current.productName);
app.setPath('userData',path.join(app.getPath('appData'),'SYNK Desktop',current.sessionScope+(smoke?'.smoke':'')));
app.setPath('sessionData',path.join(app.getPath('userData'),'Session'));
if(process.platform==='win32')app.setAppUserModelId(current.appId);
let window,platformTray,desktopPreferences,windowPlacement,draftRecovery,draftRecoveryRequests,pulseRequests,pulseApp,protocolRegistered=false,auth,installations,connectionRecovery,suiteFollower,teacherService,unbindTeacher,pendingTeachingView=false;
const suiteBindingKey=authConfig?suiteKey(authConfig,runtime.mode):null;
const suiteStore=!smoke&&authConfig?createSuiteStore({directory:path.join(app.getPath('appData'),'SYNK Desktop','Suite',runtime.mode,suiteBindingKey),key:suiteBindingKey}):null;
function publishAuthState(state){pulseRequests?.syncContext(state);pulseApp?.syncContext(state);platformTray?.setShortcuts([]);if(window&&!window.isDestroyed()&&trustedEntry(window.webContents.getURL(),entry,runtime.clientId))window.webContents.send('synk:auth-changed',state);}
function sendDesktop(channel,value){if(window&&!window.isDestroyed()&&trustedEntry(window.webContents.getURL(),entry,runtime.clientId))window.webContents.send(channel,value);}
function desktopSnapshot(){const result=desktopPreferences?.snapshot()||{ok:false,code:'LAUNCHER_ONLY'};return {...result,capabilities:{...result.capabilities,tray:!!platformTray?.isActive(),encryptedDrafts:!!draftRecovery?.available()}};}
async function signOutAccount(){
  const owner=accountStatus()?.account?.synk_user_id;
  if(suitePublisher&&!suitePublisher.signOut())return {ok:false,status:accountStatus(),error:{code:'SUITE_UNAVAILABLE',message:'앱 계정 연결을 저장하지 못해 로그아웃을 완료하지 못했어요.'}};
  const result=await auth.signOut();
  // Authentication has its own confirmed result. An encrypted draft cleanup
  // failure must not discard its server flags or become an auth failure.
  try{if(owner)await draftRecovery?.clearAccount(owner);}
  catch{return {...result,draftRecoveryCleanup:{ok:false,code:'DRAFT_STORAGE_FAILED'}};}
  return result;
}
function sendTeachingView(){if(pendingTeachingView&&runtime.clientId==='messenger'&&window&&!window.isDestroyed()&&trustedEntry(window.webContents.getURL(),entry,runtime.clientId)){window.webContents.send('synk:open-view','teaching');pendingTeachingView=false;}}
const suitePublisher=suiteStore&&runtime.clientId==='platform'?createSuitePublisher({store:suiteStore,key:suiteBindingKey,onChange:()=>{if(auth)publishAuthState(suitePublisher.project(auth.status()));}}):null;
const accountStatus=()=>suitePublisher?suitePublisher.project(auth.status()):auth?.status();
const requireSuite=operation=>suitePublisher&&!suitePublisher.refresh()?Promise.resolve({ok:false,code:'SUITE_UNAVAILABLE'}):operation();
const productPreviews=createProductPreviews({packaged,mode:runtime.mode,clientId:runtime.clientId,executable:process.execPath,appRoot:app.getAppPath(),spawn,authConfigPath:developmentAuthConfigPath,accountStatus:()=>accountStatus()});
function pulseResourceAllowed(value){
  try{const url=new URL(value);return url.origin===PULSE_ORIGIN&&!url.username&&!url.password&&(url.pathname.startsWith('/pulse/')||url.pathname.startsWith('/messenger/assets/')||['/wordmark.svg','/font.woff2'].includes(url.pathname));}catch{return false;}
}
function createPulseSession(partition){
  // No persist: prefix: customer capabilities never enter the platform's
  // SYNK ID/employee cookie jar or survive closing the desktop application.
  const isolated=session.fromPartition(partition);
  isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  isolated.setPermissionCheckHandler(()=>false);
  isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>callback({cancel:!pulseResourceAllowed(details.url)}));
  return isolated;
}
function openPulseReview({session:isolated,url}){
  if(url!==PULSE_ENTRY)throw Error('Invalid PULSE entry');
  const review=new BrowserWindow({width:1180,height:860,minWidth:720,minHeight:580,title:'SYNK PULSE · 프로젝트 라운지',parent:window,show:false,autoHideMenuBar:true,backgroundColor:'#ffffff',webPreferences:{session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false,nodeIntegrationInWorker:false,nodeIntegrationInSubFrames:false,webviewTag:false,webSecurity:true,allowRunningInsecureContent:false,experimentalFeatures:false,devTools:false}});
  const contents=review.webContents,mediaUrl=value=>{try{const next=new URL(value);return next.origin===PULSE_ORIGIN&&!next.username&&!next.password&&/^\/pulse\/api\/media\/[a-f0-9-]{36}$/.test(next.pathname)&&!next.search&&!next.hash;}catch{return false;}};
  const navigationAllowed=value=>value===PULSE_ENTRY;
  const openReference=value=>{try{const next=new URL(value);if(mediaUrl(value)){contents.downloadURL(value);return;}if(next.protocol==='https:'&&!next.username&&!next.password&&next.origin!==PULSE_ORIGIN)void shell.openExternal(next.href).catch(()=>{});}catch{}};
  contents.setWindowOpenHandler(({url:next})=>{openReference(next);return {action:'deny'};});
  contents.on('will-attach-webview',event=>event.preventDefault());
  contents.on('will-navigate',(event,next)=>{if(!navigationAllowed(next)){event.preventDefault();openReference(next);}});
  contents.on('will-redirect',(event,next)=>{if(!navigationAllowed(next))event.preventDefault();});
  const download=(event,item,source)=>{
    const max=100*1024*1024;
    if(source!==contents||!mediaUrl(item.getURL())||!['video/mp4','video/webm','image/png','image/jpeg'].includes(item.getMimeType())||item.getTotalBytes()>max){event.preventDefault();return;}
    item.on('updated',()=>{if(item.getTotalBytes()>max||item.getReceivedBytes()>max)item.cancel();});
    item.setSaveDialogOptions({title:'PULSE 프로젝트 파일 저장',defaultPath:path.join(app.getPath('downloads'),path.basename(item.getFilename()))});
  };
  isolated.on('will-download',download);
  review.once('closed',()=>isolated.removeListener('will-download',download));
  review.once('ready-to-show',()=>{review.show();review.focus();});
  review.pulseReady=review.loadURL(url).catch(error=>{if(!review.isDestroyed())review.destroy();throw error;});
  return review;
}
app.on('will-quit',()=>{pulseApp?.dispose();pulseRequests?.dispose();desktopPreferences?.dispose();unbindTeacher?.();teacherService?.dispose();suiteFollower?.dispose();suitePublisher?.dispose();auth?.dispose();installations?.dispose();connectionRecovery?.dispose();});
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',(_event,argv)=>{if(runtime.clientId==='messenger'&&Array.isArray(argv)&&argv.includes('--view=teaching'))pendingTeachingView=true;if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();sendTeachingView();void connectionRecovery?.retryIfDisconnected();}});
  app.on('window-all-closed',()=>{if(process.platform!=='darwin'&&(!platformTray?.isActive()||platformTray.isQuitting()||desktopPreferences?.snapshot().preferences.closeToTray===false))app.quit();});
  app.on('activate',()=>{if(platformTray?.isActive())platformTray.show();else if(!window||window.isDestroyed())createWindow();});
  app.whenReady().then(()=>{
    if(runtime.clientId==='platform'){
      desktopPreferences=createDesktopPreferences({directory:app.getPath('userData'),app,globalShortcut,getWindow:()=>window,onAction:action=>sendDesktop('synk:desktop-action',action),onChange:()=>sendDesktop('synk:desktop-preferences',desktopSnapshot()),enabled:!smoke,packaged,appRoot:app.getAppPath(),name:current.appId});
      desktopPreferences.initialize();
      windowPlacement=createWindowPlacement({directory:app.getPath('userData'),screen,enabled:!smoke});
      draftRecovery=createDraftRecovery({directory:path.join(app.getPath('userData'),'DraftRecovery'),safeStorage,getAccount:accountStatus,configFingerprint:authConfig?.fingerprint||'unconfigured',enabled:!smoke,onChange:status=>sendDesktop('synk:draft-recovery-changed',status)});
      draftRecoveryRequests=createDraftRecoveryRequests({getAccount:accountStatus,recovery:draftRecovery});
    }
    platformTray=createPlatformTray({app,Tray,Menu,icon:path.join(app.getAppPath(),'assets','platform.ico'),productName:current.productName,getWindow:()=>window,createWindow,enabled:runtime.clientId==='platform'&&process.platform==='win32'&&!smoke,shouldHide:()=>desktopPreferences?.snapshot().preferences.closeToTray!==false,onAction:action=>sendDesktop('synk:desktop-action',action)});
    createWindow();
  });
}
function createWindow(){
  let smokeDownload=null;const smokeNetworkRequests=[],smokeConsoleErrors=[];
  const partition='persist:'+current.sessionScope,ownSession=session.fromPartition(partition);
  if(!auth){const store=createTokenStore({directory:app.getPath('userData'),safeStorage,scope:current.sessionScope,configFingerprint:authConfig?.fingerprint||'unconfigured'});
    auth=createAuthService({config:authConfig,store,openExternal:url=>shell.openExternal(url),appVersion:app.getVersion(),onChange:state=>{suitePublisher?.publish(state);publishAuthState(suitePublisher?suitePublisher.project(state):state);}});
    if(suiteStore&&runtime.clientId!=='platform'){suiteFollower=createSuiteFollower({store:suiteStore,auth});void suiteFollower.start();}else if(suitePublisher)void suitePublisher.initialize(auth);else void auth.initialize();
  }
  if(runtime.clientId==='platform'&&!pulseRequests)pulseRequests=createPulseRequests({clientId:runtime.clientId,getAccount:accountStatus,createSession:createPulseSession,createReviewWindow:openPulseReview});
  if(runtime.clientId==='platform'&&!pulseApp)pulseApp=createPulseApp({clientId:runtime.clientId,getAccount:accountStatus,BrowserWindow,session,openExternal:url=>shell.openExternal(url),getDownloads:()=>app.getPath('downloads')});
  if(runtime.clientId==='messenger'&&!teacherService){
    const teacherKey=teacherAuthConfig?suiteKey(teacherAuthConfig,runtime.mode):null;
    const teacherSuite=!smoke&&teacherAuthConfig?createSuiteStore({directory:path.join(app.getPath('appData'),'SYNK Desktop','Suite',runtime.mode,teacherKey),key:teacherKey}):null;
    teacherService=createMessengerTeacherService({config:teacherAuthConfig,directory:path.join(app.getPath('userData'),'Teacher'),scope:current.sessionScope+'.teacher',safeStorage,openExternal:url=>shell.openExternal(url),appVersion:app.getVersion(),onChange:state=>sendMessengerTeacherAuth(window,state,entry,runtime.clientId),suiteStore:teacherSuite,createTokenStore,createAuthService,createSuiteFollower});
    void teacherService.initialize();
  }
  // Same page permissions are not implicit desktop permissions. Media remains unavailable until a deliberate consent flow is implemented.
  ownSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  ownSession.setPermissionCheckHandler(()=>false);
  if(smoke&&runtime.clientId==='platform')ownSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{smokeNetworkRequests.push(details.url);callback({cancel:true});});
  ownSession.webRequest.onHeadersReceived((details,callback)=>callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':[details.url.startsWith('synk-desktop://platform/')?nativeContentSecurityPolicy():details.url.startsWith('synk-desktop://status/')?connectionContentSecurityPolicy():contentSecurityPolicy(details.resourceType)]}}));
  ownSession.removeAllListeners('will-download');
  ownSession.on('will-download',createDownloadHandler({getWindow:()=>window,session:ownSession,entry,clientId:runtime.clientId,
    configureSave(item,spec){
      if(smoke){const dir=smokeArtifacts;fs.mkdirSync(dir,{recursive:true});item.setSavePath(path.join(dir,runtime.clientId+'-synthetic-export.'+spec.extension));item.once('done',(_event,state)=>{smokeDownload={state,mime:item.getMimeType(),size:item.getReceivedBytes()};});return;}
      item.setSaveDialogOptions({title:'SYNK 기록 저장',defaultPath:path.join(app.getPath('downloads'),item.getFilename()),filters:[{name:spec.filterName,extensions:[spec.extension]}]});
    },
    onDenied(reason){if(smoke||!window||window.isDestroyed())return;dialog.showMessageBox(window,{type:'info',title:'SYNK 기록 저장',message:reason==='session'?'회사 로그인을 확인한 뒤 다시 저장해 주세요.':'이 파일은 앱에서 저장할 수 없어요.',detail:runtime.clientId==='messenger'?'내 작업실의 AI 업무 연습 TXT 기록만 최대 64 KiB까지 저장할 수 있어요.':'연결된 JSON 기록만 최대 32 MiB까지 저장할 수 있어요. 더 큰 기록은 웹에서 내보내 주세요.'});},
  }));
  if(!protocolRegistered){const nativeContent=createNativeContent({appRoot:app.getAppPath()}),connectionContent=createConnectionContent({appRoot:app.getAppPath(),clientId:runtime.clientId,mode:runtime.mode,entry,messengerCloudPreview:runtime.messengerCloudPreview,worldCloudPreview:runtime.worldCloudPreview,productName:current.productName});ownSession.protocol.handle('synk-desktop',request=>request.url.startsWith('synk-desktop://platform/')&&runtime.clientId==='platform'?nativeContent(request):connectionContent(request));}
  protocolRegistered=true;
  const isPlatform=runtime.clientId==='platform';
  const placement=isPlatform?windowPlacement.restore():null;
  window=new BrowserWindow({width:isPlatform?1440:1180,height:isPlatform?940:860,minWidth:isPlatform?960:720,minHeight:isPlatform?680:580,...(placement?{x:placement.x,y:placement.y,width:placement.width,height:placement.height,minWidth:placement.minWidth,minHeight:placement.minHeight}:{}),title:current.productName,icon:path.join(app.getAppPath(),'assets',runtime.clientId+'.png'),show:false,autoHideMenuBar:true,frame:!isPlatform,backgroundColor:isPlatform?'#08090C':'#ffffff',webPreferences:preferences(path.join(__dirname,'preload.cjs'),partition)});
  Menu.setApplicationMenu(process.platform==='darwin'?Menu.buildFromTemplate([{label:current.productName,submenu:[{role:'about'},{role:'quit'}]},{label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]}]):null);
  const contents=window.webContents;
  contents.on('did-finish-load',sendTeachingView);
  if(isPlatform){windowPlacement.attach(window,{maximized:placement.maximized});contents.on('did-finish-load',()=>desktopPreferences.applyWindow(window));}
  if(isPlatform)installDraftExitGuard({contents,window,dialog,getRecoveryAvailable:()=>!!draftRecovery?.available()});
  platformTray?.attachWindow(window);
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
  const programRoot=resolveProgramRoot({platform:process.platform,env:process.env,getHome:()=>app.getPath('home')});
  if(!installations)installations=createClientLifecycle({clientId:runtime.clientId,mode:runtime.mode,platform:process.platform,arch:process.arch,programRoot,packageRoot:packaged?path.join(process.resourcesPath,'clients'):path.join(app.getAppPath(),'dist'),cacheRoot:path.join(app.getPath('userData'),'Installers'),releases:runtime.releases||[],spawn,openPath:file=>shell.openPath(file),onChange:async()=>{try{const state=await installations.getClients();send('synk:clients-changed',state);send('synk:client-progress',state);}catch{}}});
  window.on('focus',async()=>{try{send('synk:clients-changed',await installations.getClients());}catch{}});
  const companyRequest=createCompanyRequests({entry,clientId:runtime.clientId,session:ownSession,auth});
  const handlers={
    'synk:environment':()=>({clientId:runtime.clientId,mode:runtime.mode,platform:process.platform,arch:process.arch,version:app.getVersion(),sessionScope:current.sessionScope,nativeShell:isPlatform,closeToTray:!!platformTray?.isActive()&&desktopPreferences?.snapshot().preferences.closeToTray!==false,teacherPreviewAvailable:teacherPreview.available(),productPreviewsAvailable:productPreviews.available(),publicAppsAvailable:publicApps.available()}),
    'synk:desktop-preferences':()=>desktopSnapshot(),
    'synk:desktop-preferences-update':patch=>{if(!isPlatform)return {ok:false,code:'LAUNCHER_ONLY'};const result=desktopPreferences.update(patch);return result.ok?desktopSnapshot():result;},
    'synk:copy-platform-diagnostics':input=>isPlatform&&!smoke?copyDiagnostics({clipboard,input,environment:{platform:process.platform,arch:process.arch,version:app.getVersion(),mode:runtime.mode},account:accountStatus()}):{ok:false,code:'CLIPBOARD_UNAVAILABLE'},
    'synk:tray-shortcuts':items=>isPlatform?platformTray.setShortcuts(items):{ok:false,code:'LAUNCHER_ONLY'},
    'synk:draft-recovery-status':owner=>isPlatform?draftRecoveryRequests.status(owner):{ok:false,code:'LAUNCHER_ONLY'},
    'synk:draft-recovery-enabled':(value,owner)=>isPlatform?draftRecoveryRequests.setEnabled(value,owner):{ok:false,code:'LAUNCHER_ONLY'},
    'synk:draft-recovery-load':(slot,owner)=>isPlatform?draftRecoveryRequests.load(slot,owner):{ok:false,code:'LAUNCHER_ONLY'},
    'synk:draft-recovery-save':(slot,value,owner)=>isPlatform?draftRecoveryRequests.save(slot,value,owner):{ok:false,code:'LAUNCHER_ONLY'},
    'synk:draft-recovery-clear':(slot,owner)=>isPlatform?draftRecoveryRequests.clear(slot,owner):{ok:false,code:'LAUNCHER_ONLY'},
    'synk:open-public-app':id=>requireSuite(()=>publicApps.open(id)),
    'synk:teacher-preview':()=>requireSuite(()=>teacherPreview.open()),
    'synk:product-preview':id=>requireSuite(()=>productPreviews.open(id)),
    'synk:clients':()=>installations.getClients(),'synk:launch':id=>requireSuite(()=>installations.launch(id)),
    'synk:prepare-client':id=>installations.prepareClient(id),'synk:cancel-preparation':id=>installations.cancelPreparation(id),'synk:open-installer':id=>installations.openInstaller(id),
    'synk:window-state':windowState,'synk:window-action':action=>{if(!isPlatform)return {ok:false,code:'LAUNCHER_ONLY'};if(action==='minimize')window.minimize();else if(action==='toggle-maximize'){if(window.isMaximized())window.unmaximize();else window.maximize();}else if(action==='close')window.close();else return {ok:false,code:'INVALID_WINDOW_ACTION'};return {ok:true};},
    'synk:auth-status':accountStatus,'synk:auth-sign-in':async()=>{if(suitePublisher&&!suitePublisher.beginSignIn())return accountStatus();await auth.signIn();return accountStatus();},'synk:auth-cancel':()=>auth.cancel(),'synk:auth-sign-out':signOutAccount,
    'synk:account-request':(operation,params)=>requireSuite(()=>auth.accountRequest(operation,params)),'synk:company-request':companyRequest,
    'synk:pulse-request':(operation,params)=>isPlatform&&!smoke?requireSuite(()=>pulseRequests.request(operation,params)):{ok:false,error:{code:'PULSE_UNAVAILABLE',message:'현재 창에서는 프로젝트를 연결할 수 없어요.'}},
    'synk:pulse-app-open':()=>isPlatform&&!smoke?requireSuite(()=>pulseApp.open()):{ok:false,code:'PULSE_APP_UNAVAILABLE'},
  };
  for(const [channel,handler]of Object.entries(handlers)){ipcMain.removeHandler(channel);ipcMain.handle(channel,async(event,...args)=>{assertSender(event,window,entry,runtime.clientId);try{return await handler(...args);}catch(error){return {ok:false,error:publicError(error)};}});}
  unbindTeacher?.();unbindTeacher=bindMessengerTeacherIPC({ipcMain,getWindow:()=>window,service:teacherService,entry,clientId:runtime.clientId,environment:{mode:runtime.mode,platform:process.platform,arch:process.arch,version:app.getVersion()}});
  window.once('ready-to-show',()=>{if(smoke)return;const hidden=isPlatform&&process.argv.includes('--synk-autostart')&&desktopPreferences.snapshot().preferences.startHidden&&platformTray.isActive();if(!hidden)window.show();});
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
        if(runtime.clientId==='platform'){result.nativeShell=await contents.executeJavaScript(`({url:location.href,ready:document.documentElement.dataset.ready==='true',html:document.body.innerText.length,remoteResources:performance.getEntriesByType('resource').filter(r=>/^https?:/.test(r.name)).map(r=>r.name)})`);result.nativeShell.networkBlocked=true;result.nativeShell.networkRequests=smokeNetworkRequests;result.nativeShell.consoleErrors=smokeConsoleErrors;}
        process.stdout.write('SYNK_SMOKE '+JSON.stringify({ok:result.node==='undefined'&&result.rejected.code==='UNKNOWN_CLIENT'&&(runtime.clientId!=='world'||smokeDownload?.state==='completed')&&(runtime.clientId!=='platform'||result.ui?.ok&&result.nativeShell.ready&&result.nativeShell.url===PLATFORM_ENTRY&&result.nativeShell.html>100&&result.nativeShell.remoteResources.length===0&&smokeNetworkRequests.length===0&&smokeConsoleErrors.length===0),...result,download:smokeDownload,visible:window.isVisible(),preferences:contents.getLastWebPreferences()})+'\n');clearTimeout(timer);app.exit(0);
      }catch(error){process.stdout.write('SYNK_SMOKE '+JSON.stringify({ok:false,clientId:runtime.clientId,error:error.message})+'\n');clearTimeout(timer);app.exit(1);}
    });
  }
  connectionRecovery=createConnectionRecovery({contents,entry});
  void connectionRecovery.connect();
}
