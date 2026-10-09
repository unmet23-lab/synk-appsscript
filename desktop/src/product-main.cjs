'use strict';
const {app,BrowserWindow,ipcMain,session,protocol,Menu,shell,safeStorage,dialog}=require('electron');
const path=require('node:path'),fs=require('node:fs');
const {preferences}=require('./security.cjs');
const {product,productDocument,productResource,productPolicy,assertProductSender,createProductBrowser,createProductDownloadHandler,productDownloadNotice,bindFortuneIPC,sendFortuneAuth}=require('./product-preview.cjs');
const {configuration}=require('./auth-config.cjs');
const {resolveAuthConfigPath}=require('./auth-config-path.cjs');
const {createTokenStore}=require('./auth-store.cjs');
const {createAuthService}=require('./auth-service.cjs');
const {suiteKey,createSuiteStore,createSuiteFollower}=require('./suite-session.cjs');
const {bindCareIPC,sendCareAuth}=require('./care-account.cjs');
const {bindPersonalIPC,sendPersonalAuth}=require('./personal-account.cjs');
const {RESOURCES:PERSONAL_RESOURCES}=require('./personal-requests.cjs');
const ids=process.argv.filter(arg=>arg.startsWith('--synk-product-preview='));
const current=ids.length===1?product(ids[0].slice('--synk-product-preview='.length)):null;
if(app.isPackaged||!current)throw Error('Product preview requires a fixed local development entry.');
const smoke=process.argv.includes('--synk-smoke'),sessionScope=current.sessionScope+(smoke?'.smoke':'');
const authConfigPath=resolveAuthConfigPath();
const personalProduct=PERSONAL_RESOURCES.includes(current.id),accountProduct=['fortune','care'].includes(current.id)||personalProduct;
const rawAuth=accountProduct&&authConfigPath?JSON.parse(fs.readFileSync(path.resolve(authConfigPath),'utf8')):null;
// Each preview needs its own public OAuth registration; never borrow the
// launcher's credentials or a sibling product's encrypted vault.
const authConfig=rawAuth?.clients?.[current.id]?configuration(rawAuth,current.id,'development'):null;
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{scheme:'synk-product',privileges:{standard:true,secure:true}}]);
app.setName(current.name+' Preview');
app.setPath('userData',path.join(app.getPath('appData'),'SYNK Desktop',sessionScope));
app.setPath('sessionData',path.join(app.getPath('userData'),'Session'));
if(process.platform==='win32')app.setAppUserModelId(current.appId);
let window,registered=false,auth,unbindFortune,unbindCare,unbindPersonal;
if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',()=>{if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
  app.on('activate',()=>{if(!window||window.isDestroyed())createWindow();});
  app.on('before-quit',()=>{auth?.dispose();unbindFortune?.();unbindCare?.();unbindPersonal?.();});
  app.whenReady().then(createWindow);
}
function createWindow(){
  const partition='persist:'+sessionScope,ownSession=session.fromPartition(partition);
  // Recording and immersive VR stay explicit browser actions; native permissions remain denied.
  ownSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  ownSession.setPermissionCheckHandler(()=>false);
  ownSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*','file://*/*']},(details,callback)=>callback({cancel:!productResource(current.id,details.url)}));
  ownSession.webRequest.onHeadersReceived((details,callback)=>callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':[productPolicy()]}}));
  ownSession.removeAllListeners('will-download');ownSession.on('will-download',createProductDownloadHandler({id:current.id,getWindow:()=>window,onDenied(reason){
    if(!smoke&&window&&!window.isDestroyed())void dialog.showMessageBox(window,productDownloadNotice(reason));
  },configureSave(item,spec){
    if(smoke){item.cancel();return;}
    item.setSaveDialogOptions({title:current.name+' 기록 저장',defaultPath:path.join(app.getPath('downloads'),item.getFilename()),filters:[{name:spec.filterName,extensions:[spec.extension]}]});
  }}));
  if(!registered)ownSession.protocol.handle('synk-product',()=>new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+current.name+'</title><h1>'+current.name+'</h1><p>앱의 로컬 연결을 준비하고 있어요.</p><p>미리보기 서버를 시작한 뒤 앱을 다시 열어 주세요.</p></html>',{headers:{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; frame-ancestors 'none'"}}));
  registered=true;
  window=new BrowserWindow({width:1320,height:900,minWidth:780,minHeight:600,title:current.name+' Preview',icon:path.join(__dirname,'..','assets','platform.png'),show:false,autoHideMenuBar:true,backgroundColor:'#ffffff',webPreferences:{...preferences(path.join(__dirname,current.id==='care'?'care-preload.cjs':personalProduct?'personal-preload.cjs':'product-preload.cjs'),partition),additionalArguments:current.id==='fortune'?['--synk-fortune-account']:[]}});
  if(accountProduct&&!auth){
    const store=createTokenStore({directory:app.getPath('userData'),safeStorage,scope:sessionScope,configFingerprint:authConfig?.fingerprint||'unconfigured'});
    auth=createAuthService({config:authConfig,store,openExternal:url=>shell.openExternal(url),appVersion:app.getVersion(),onChange:state=>personalProduct?sendPersonalAuth(window,current.id,state):(current.id==='care'?sendCareAuth:sendFortuneAuth)(window,state)});
    if(!smoke&&authConfig){const key=suiteKey(authConfig,'development'),suite=createSuiteFollower({store:createSuiteStore({directory:path.join(app.getPath('appData'),'SYNK Desktop','Suite','development',key),key}),auth});app.once('will-quit',()=>suite.dispose());void suite.start();}else void auth.initialize();
  }
  Menu.setApplicationMenu(process.platform==='darwin'?Menu.buildFromTemplate([{label:current.name,submenu:[{role:'about'},{role:'quit'}]},{label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]}]):null);
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  for(const name of ['will-navigate','will-redirect'])window.webContents.on(name,(event,url)=>{if(!productDocument(current.id,url))event.preventDefault();});
  const openInBrowser=createProductBrowser({id:current.id,enabled:!smoke,openExternal:url=>shell.openExternal(url)});
  const handlers={
    'synk-product:environment':()=>({clientId:current.id,mode:'development',platform:process.platform,arch:process.arch,sessionScope,separateClient:true,productionReady:false,immersiveVR:false,browserVRAvailable:current.id==='path'}),
    'synk-product:auth-status':()=>auth?auth.status():({configured:false,signedIn:false,status:'unconfigured',productionReady:false}),
    'synk-product:open-browser':openInBrowser,
  };
  for(const [channel,handler]of Object.entries(handlers)){ipcMain.removeHandler(channel);ipcMain.handle(channel,event=>{assertProductSender(event,window,current.id);return handler();});}
  if(current.id==='fortune'){unbindFortune?.();unbindFortune=bindFortuneIPC({ipcMain,getWindow:()=>window,auth});}
  if(current.id==='care'){unbindCare?.();unbindCare=bindCareIPC({ipcMain,getWindow:()=>window,auth});}
  if(personalProduct){unbindPersonal?.();unbindPersonal=bindPersonalIPC({ipcMain,getWindow:()=>window,auth,resource:current.id,config:authConfig});}
  window.once('ready-to-show',()=>{if(!smoke)window.show();});
  if(smoke){
    const errors=[],timer=setTimeout(()=>{process.stdout.write('SYNK_PRODUCT_SMOKE '+JSON.stringify({ok:false,clientId:current.id,error:'TIMEOUT'})+'\n');app.exit(1);},20000);
    window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message.slice(0,300));});
    window.webContents.once('did-finish-load',async()=>{try{
      for(let i=0;i<200;i++){if(await window.webContents.executeJavaScript(`document.documentElement.dataset.ready==='true'`))break;await new Promise(resolve=>setTimeout(resolve,50));}
      const result=await window.webContents.executeJavaScript(`(async()=>({url:location.href,ready:document.documentElement.dataset.ready==='true',title:document.title,bodyCharacters:document.body.innerText.length,node:typeof require,platformBridge:typeof window.synkDesktop,bridgeKeys:Object.keys(window.synkProduct||{}),fortuneBridgeKeys:Object.keys(window.synkFortuneAccount||{}),personalBridgeKeys:Object.keys(window.synkPersonalAccount||{}),environment:await window.synkProduct.getEnvironment(),auth:await window.synkProduct.authStatus(),frames:document.querySelectorAll('iframe,webview').length}))()`);
      if(current.id==='path')result.pathPC=await window.webContents.executeJavaScript(`(()=>{const canvas=document.querySelector('#viewport canvas'),gl=canvas?.getContext('webgl2');return {canvas:!!canvas,webgl:!!gl&&!gl.isContextLost(),browserButtonVisible:document.getElementById('vr-browser')?.hidden===false,nativeVRDisabled:document.getElementById('vr-button')?.disabled===true};})()`);
      const ok=result.url===current.entry&&result.ready&&result.bodyCharacters>100&&result.node==='undefined'&&result.platformBridge==='undefined'&&result.frames===0&&result.auth.configured===!!authConfig&&result.auth.signedIn===false&&result.environment.separateClient===true&&result.environment.clientId===current.id&&result.fortuneBridgeKeys.length===(current.id==='fortune'?6:0)&&result.personalBridgeKeys.length===(personalProduct?6:0)&&errors.length===0&&!window.isVisible()&&(current.id!=='path'||Object.values(result.pathPC||{}).length===4&&Object.values(result.pathPC).every(Boolean));
      process.stdout.write('SYNK_PRODUCT_SMOKE '+JSON.stringify({ok,...result,errors,visible:window.isVisible()})+'\n');clearTimeout(timer);app.exit(ok?0:1);
    }catch(error){process.stdout.write('SYNK_PRODUCT_SMOKE '+JSON.stringify({ok:false,error:error.message})+'\n');clearTimeout(timer);app.exit(1);}});
  }
  window.loadURL(current.entry).catch(()=>window.loadURL('synk-product://status/'));
}
