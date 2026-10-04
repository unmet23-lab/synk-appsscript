'use strict';
const {app,BrowserWindow,ipcMain,session,protocol,Menu,safeStorage,shell}=require('electron');
const path=require('node:path'),fs=require('node:fs');
const {preferences}=require('./security.cjs');
const {TEACHER}=require('./teacher-preview.cjs');
const {secureTeacherSession,secureTeacherWindow}=require('./teacher-security.cjs');
const {configuration}=require('./auth-config.cjs');
const {createTokenStore}=require('./auth-store.cjs');
const {createAuthService}=require('./auth-service.cjs');
const {bindTeacherIPC,sendTeacherAuth}=require('./teacher-account.cjs');
if(app.isPackaged||!process.argv.includes('--synk-teacher-preview'))throw Error('Teacher preview is available only from the local development launcher.');
const smoke=process.argv.includes('--synk-smoke'),sessionScope=TEACHER.sessionScope+(smoke?'.smoke':'');
const authConfigPath=process.argv.find(a=>a.startsWith('--auth-config='))?.slice(14);
const authConfig=configuration(authConfigPath?JSON.parse(fs.readFileSync(path.resolve(authConfigPath),'utf8')):null,'teacher','development');
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{scheme:'synk-teacher',privileges:{standard:true,secure:true}}]);
app.setName(TEACHER.name+' Preview');
app.setPath('userData',path.join(app.getPath('appData'),'SYNK Desktop',sessionScope));
app.setPath('sessionData',path.join(app.getPath('userData'),'Session'));
if(process.platform==='win32')app.setAppUserModelId(TEACHER.appId);
let window,registered=false,auth,unbind;
if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',()=>{if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
  app.on('activate',()=>{if(!window||window.isDestroyed())createWindow();});
  app.on('before-quit',()=>{auth?.dispose();unbind?.();});
  app.whenReady().then(createWindow);
}
function createWindow(){
  const partition='persist:'+sessionScope,ownSession=session.fromPartition(partition);
  secureTeacherSession(ownSession);
  if(!registered)ownSession.protocol.handle('synk-teacher',()=>new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>WORLD · 교사</title><h1>WORLD · 교사</h1><p>교사 앱의 로컬 연결을 준비하고 있어요.</p><p>미리보기 서버를 시작한 뒤 앱을 다시 열어 주세요.</p></html>',{headers:{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; frame-ancestors 'none'"}}));
  registered=true;
  window=new BrowserWindow({width:1320,height:900,minWidth:360,minHeight:500,title:TEACHER.name+' Preview',icon:path.join(__dirname,'..','assets','world.png'),show:false,autoHideMenuBar:true,backgroundColor:'#ffffff',webPreferences:preferences(path.join(__dirname,'teacher-preload.cjs'),partition)});
  if(!auth){
    const store=createTokenStore({directory:app.getPath('userData'),safeStorage,scope:sessionScope,configFingerprint:authConfig?.fingerprint||'unconfigured'});
    auth=createAuthService({config:authConfig,store,openExternal:url=>shell.openExternal(url),appVersion:app.getVersion(),onChange:state=>sendTeacherAuth(window,state)});
    void auth.initialize();
  }
  Menu.setApplicationMenu(process.platform==='darwin'?Menu.buildFromTemplate([{label:TEACHER.name,submenu:[{role:'about'},{role:'quit'}]},{label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]}]):null);
  secureTeacherWindow(window);
  unbind?.();unbind=bindTeacherIPC({ipcMain,getWindow:()=>window,auth,environment:{clientId:TEACHER.id,authProduct:'world',mode:'development',platform:process.platform,arch:process.arch,sessionScope,separateClient:true,productionReady:false}});
  window.once('ready-to-show',()=>{if(!smoke)window.show();});
  if(smoke){
    const errors=[],timer=setTimeout(()=>{process.stdout.write('SYNK_TEACHER_SMOKE '+JSON.stringify({ok:false,error:'TIMEOUT'})+'\n');app.exit(1);},20000);
    window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message.slice(0,300));});
    window.webContents.once('did-finish-load',async()=>{try{
      for(let i=0;i<200;i++){if(await window.webContents.executeJavaScript(`document.documentElement.dataset.ready==='true'`))break;await new Promise(resolve=>setTimeout(resolve,50));}
      const result=await window.webContents.executeJavaScript(`(async()=>({url:location.href,ready:document.documentElement.dataset.ready==='true',title:document.title,bodyCharacters:document.body.innerText.length,node:typeof require,platformBridge:typeof window.synkDesktop,bridgeKeys:Object.keys(window.synkTeacher||{}),environment:await window.synkTeacher.getEnvironment(),auth:await window.synkTeacher.authStatus(),frames:document.querySelectorAll('iframe,webview').length}))()`);
      const ok=result.url===TEACHER.entry&&result.ready&&result.bodyCharacters>100&&result.node==='undefined'&&result.platformBridge==='undefined'&&result.frames===0&&result.auth.configured===false&&result.auth.signedIn===false&&result.environment.separateClient===true&&errors.length===0&&!window.isVisible();
      process.stdout.write('SYNK_TEACHER_SMOKE '+JSON.stringify({ok,...result,errors,visible:window.isVisible()})+'\n');clearTimeout(timer);app.exit(ok?0:1);
    }catch(error){process.stdout.write('SYNK_TEACHER_SMOKE '+JSON.stringify({ok:false,error:error.message})+'\n');clearTimeout(timer);app.exit(1);}});
  }
  window.loadURL(TEACHER.entry).catch(()=>window.loadURL('synk-teacher://status/'));
}
