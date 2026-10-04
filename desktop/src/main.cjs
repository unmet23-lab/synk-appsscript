'use strict';
const {app,BrowserWindow,ipcMain,session,protocol,Menu,shell,dialog,safeStorage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {CLIENTS,DEV_URLS,PLATFORM_ENTRY,identity}=require('./catalog.cjs');
const {safeEntry,assertSender,trustedEntry,preferences,allowedNavigation,externalDestination,contentSecurityPolicy,nativeContentSecurityPolicy}=require('./security.cjs');
const {createClientLifecycle}=require('./client-lifecycle.cjs');
const {loadDevelopmentReleases}=require('./local-releases.cjs');
const {createNativeContent}=require('./native-content.cjs');
const {configuration}=require('./auth-config.cjs');
const {createTokenStore}=require('./auth-store.cjs');
const {createAuthService,publicError}=require('./auth-service.cjs');
const {createCompanyRequests}=require('./company-requests.cjs');
const {createTeacherPreview}=require('./teacher-preview.cjs');
const {createProductPreviews}=require('./product-preview.cjs');
const {createDownloadHandler}=require('./downloads.cjs');
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
  developmentAuthConfigPath=process.argv.find(a=>a.startsWith('--auth-config='))?.slice(14);
  if(developmentAuthConfigPath)runtime.auth=JSON.parse(fs.readFileSync(path.resolve(developmentAuthConfigPath),'utf8'));
}
if(!Object.hasOwn(CLIENTS,runtime.clientId)||!['development','release'].includes(runtime.mode)||!safeEntry(runtime.entry,runtime.mode)||(runtime.clientId==='platform'&&runtime.entry!==PLATFORM_ENTRY)||(runtime.clientId!=='platform'&&runtime.entry===PLATFORM_ENTRY))throw Error('Invalid desktop runtime configuration');
const smoke=runtime.mode==='development'&&process.argv.includes('--synk-smoke');
const current=identity(runtime.clientId,runtime.mode),entry=runtime.entry;
const teacherPreview=createTeacherPreview({packaged,mode:runtime.mode,clientId:runtime.clientId,executable:process.execPath,appRoot:app.getAppPath(),spawn,authConfigPath:developmentAuthConfigPath});
const smokeArtifacts=smoke?(packaged?path.join(app.getPath('temp'),'SYNK Desktop Smoke',current.sessionScope):path.join(__dirname,'..','artifacts')):null;
const authConfig=configuration(runtime.auth,runtime.clientId,runtime.mode);
app.setName(current.productName);
app.setPath('userData',path.join(app.getPath('appData'),'SYNK Desktop',current.sessionScope+(smoke?'.smoke':'')));
app.setPath('sessionData',path.join(app.getPath('userData'),'Session'));
if(process.platform==='win32')app.setAppUserModelId(current.appId);
let window,protocolRegistered=false,auth,installations;
const productPreviews=createProductPreviews({packaged,mode:runtime.mode,clientId:runtime.clientId,executable:process.execPath,appRoot:app.getAppPath(),spawn,accountStatus:()=>auth?.status()});
app.on('before-quit',()=>{auth?.dispose();installations?.dispose();});
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
  app.on('activate',()=>{if(!window||window.isDestroyed())createWindow();});
  app.whenReady().then(createWindow);
}
function createWindow(){
  let smokeDownload=null;const smokeNetworkRequests=[],smokeConsoleErrors=[];
  const partition='persist:'+current.sessionScope,ownSession=session.fromPartition(partition);
  if(!auth){const store=createTokenStore({directory:app.getPath('userData'),safeStorage,scope:current.sessionScope,configFingerprint:authConfig?.fingerprint||'unconfigured'});
    auth=createAuthService({config:authConfig,store,openExternal:url=>shell.openExternal(url),appVersion:app.getVersion(),onChange:state=>{if(window&&!window.isDestroyed()&&trustedEntry(window.webContents.getURL(),entry,runtime.clientId))window.webContents.send('synk:auth-changed',state);}});
    void auth.initialize();
  }
  // Same page permissions are not implicit desktop permissions. Media remains unavailable until a deliberate consent flow is implemented.
  ownSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  ownSession.setPermissionCheckHandler(()=>false);
  if(smoke&&runtime.clientId==='platform')ownSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{smokeNetworkRequests.push(details.url);callback({cancel:true});});
  ownSession.webRequest.onHeadersReceived((details,callback)=>callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':[details.url.startsWith('synk-desktop://platform/')?nativeContentSecurityPolicy():contentSecurityPolicy(details.resourceType)]}}));
  ownSession.removeAllListeners('will-download');
  ownSession.on('will-download',createDownloadHandler({getWindow:()=>window,session:ownSession,entry,clientId:runtime.clientId,
    configureSave(item,spec){
      if(smoke){const dir=smokeArtifacts;fs.mkdirSync(dir,{recursive:true});item.setSavePath(path.join(dir,runtime.clientId+'-synthetic-export.'+spec.extension));item.once('done',(_event,state)=>{smokeDownload={state,mime:item.getMimeType(),size:item.getReceivedBytes()};});return;}
      item.setSaveDialogOptions({title:'SYNK 기록 저장',defaultPath:path.join(app.getPath('downloads'),item.getFilename()),filters:[{name:spec.filterName,extensions:[spec.extension]}]});
    },
    onDenied(reason){if(smoke||!window||window.isDestroyed())return;dialog.showMessageBox(window,{type:'info',title:'SYNK 기록 저장',message:reason==='session'?'회사 로그인을 확인한 뒤 다시 저장해 주세요.':'이 파일은 앱에서 저장할 수 없어요.',detail:runtime.clientId==='messenger'?'내 작업실의 AI 업무 연습 TXT 기록만 최대 64 KiB까지 저장할 수 있어요.':'연결된 JSON 기록만 최대 32 MiB까지 저장할 수 있어요. 더 큰 기록은 웹에서 내보내 주세요.'});},
  }));
  if(!protocolRegistered){const nativeContent=createNativeContent({appRoot:app.getAppPath()});ownSession.protocol.handle('synk-desktop',request=>request.url.startsWith('synk-desktop://platform/')&&runtime.clientId==='platform'?nativeContent(request):new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${current.productName}</title><h1>${current.name}</h1><p>앱 연결을 준비하고 있어요.</p><p>${runtime.mode==='development'?'개발 미리보기입니다. 해당 로컬 서버를 시작한 뒤 앱을 다시 열어 주세요.':'지금은 연결할 수 없어요. 잠시 뒤 다시 열어 주세요.'}</p></html>`,{headers:{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'"}}));}
  protocolRegistered=true;
  const isPlatform=runtime.clientId==='platform';
  window=new BrowserWindow({width:isPlatform?1440:1180,height:isPlatform?940:860,minWidth:isPlatform?960:720,minHeight:isPlatform?680:580,title:current.productName,icon:path.join(app.getAppPath(),'assets',runtime.clientId+'.png'),show:false,autoHideMenuBar:true,frame:!isPlatform,backgroundColor:isPlatform?'#f6f4ef':'#ffffff',webPreferences:preferences(path.join(__dirname,'preload.cjs'),partition)});
  Menu.setApplicationMenu(process.platform==='darwin'?Menu.buildFromTemplate([{label:current.productName,submenu:[{role:'about'},{role:'quit'}]},{label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]}]):null);
  const contents=window.webContents;
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
  const programRoot=process.platform==='win32'?path.join(process.env.LOCALAPPDATA||app.getPath('appData'),'Programs'):'/Applications';
  if(!installations)installations=createClientLifecycle({clientId:runtime.clientId,mode:runtime.mode,platform:process.platform,arch:process.arch,programRoot,packageRoot:packaged?path.join(process.resourcesPath,'clients'):path.join(app.getAppPath(),'dist'),cacheRoot:path.join(app.getPath('userData'),'Installers'),releases:runtime.releases||[],spawn,openPath:file=>shell.openPath(file),onChange:async()=>{try{const state=await installations.getClients();send('synk:clients-changed',state);send('synk:client-progress',state);}catch{}}});
  window.on('focus',async()=>{try{send('synk:clients-changed',await installations.getClients());}catch{}});
  const companyRequest=createCompanyRequests({entry,clientId:runtime.clientId,session:ownSession,auth});
  const handlers={
    'synk:environment':()=>({clientId:runtime.clientId,mode:runtime.mode,platform:process.platform,arch:process.arch,version:app.getVersion(),sessionScope:current.sessionScope,nativeShell:isPlatform,teacherPreviewAvailable:teacherPreview.available(),productPreviewsAvailable:productPreviews.available()}),
    'synk:teacher-preview':()=>teacherPreview.open(),
    'synk:product-preview':id=>productPreviews.open(id),
    'synk:clients':()=>installations.getClients(),'synk:launch':id=>installations.launch(id),
    'synk:prepare-client':id=>installations.prepareClient(id),'synk:cancel-preparation':id=>installations.cancelPreparation(id),'synk:open-installer':id=>installations.openInstaller(id),
    'synk:window-state':windowState,'synk:window-action':action=>{if(!isPlatform)return {ok:false,code:'LAUNCHER_ONLY'};if(action==='minimize')window.minimize();else if(action==='toggle-maximize'){if(window.isMaximized())window.unmaximize();else window.maximize();}else if(action==='close')window.close();else return {ok:false,code:'INVALID_WINDOW_ACTION'};return {ok:true};},
    'synk:auth-status':()=>auth.status(),'synk:auth-sign-in':()=>auth.signIn(),'synk:auth-cancel':()=>auth.cancel(),'synk:auth-sign-out':()=>auth.signOut(),
    'synk:account-request':(operation,params)=>auth.accountRequest(operation,params),'synk:company-request':companyRequest,
  };
  for(const [channel,handler]of Object.entries(handlers)){ipcMain.removeHandler(channel);ipcMain.handle(channel,async(event,...args)=>{assertSender(event,window,entry,runtime.clientId);try{return await handler(...args);}catch(error){return {ok:false,error:publicError(error)};}});}
  window.once('ready-to-show',()=>{if(!smoke)window.show();});
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
  window.loadURL(entry).catch(()=>window.loadURL('synk-desktop://status/'));
}
