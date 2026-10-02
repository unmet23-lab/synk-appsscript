'use strict';
const {app,BrowserWindow,ipcMain,session,protocol,Menu}=require('electron');
const path=require('node:path');
const {preferences}=require('./security.cjs');
const {TEACHER,teacherNavigation,teacherResource,teacherPolicy,assertTeacherSender}=require('./teacher-preview.cjs');
if(app.isPackaged||!process.argv.includes('--synk-teacher-preview'))throw Error('Teacher preview is available only from the local development launcher.');
const smoke=process.argv.includes('--synk-smoke'),sessionScope=TEACHER.sessionScope+(smoke?'.smoke':'');
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{scheme:'synk-teacher',privileges:{standard:true,secure:true}}]);
app.setName(TEACHER.name+' Preview');
app.setPath('userData',path.join(app.getPath('appData'),'SYNK Desktop',sessionScope));
app.setPath('sessionData',path.join(app.getPath('userData'),'Session'));
if(process.platform==='win32')app.setAppUserModelId(TEACHER.appId);
let window,registered=false;
if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',()=>{if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
  app.on('activate',()=>{if(!window||window.isDestroyed())createWindow();});
  app.whenReady().then(createWindow);
}
function createWindow(){
  const partition='persist:'+sessionScope,ownSession=session.fromPartition(partition);
  ownSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  ownSession.setPermissionCheckHandler(()=>false);
  ownSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*','file://*/*']},(details,callback)=>callback({cancel:!teacherResource(details.url)}));
  ownSession.webRequest.onHeadersReceived((details,callback)=>callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':[teacherPolicy()]}}));
  ownSession.removeAllListeners('will-download');ownSession.on('will-download',event=>event.preventDefault());
  if(!registered)ownSession.protocol.handle('synk-teacher',()=>new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>WORLD · 교사</title><h1>WORLD · 교사</h1><p>교사 앱의 로컬 연결을 준비하고 있어요.</p><p>미리보기 서버를 시작한 뒤 앱을 다시 열어 주세요.</p></html>',{headers:{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; frame-ancestors 'none'"}}));
  registered=true;
  window=new BrowserWindow({width:1320,height:900,minWidth:780,minHeight:600,title:TEACHER.name+' Preview',icon:path.join(__dirname,'..','assets','world.png'),show:false,autoHideMenuBar:true,backgroundColor:'#ffffff',webPreferences:preferences(path.join(__dirname,'teacher-preload.cjs'),partition)});
  Menu.setApplicationMenu(process.platform==='darwin'?Menu.buildFromTemplate([{label:TEACHER.name,submenu:[{role:'about'},{role:'quit'}]},{label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]}]):null);
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  for(const name of ['will-navigate','will-redirect'])window.webContents.on(name,(event,url)=>{if(!teacherNavigation(url))event.preventDefault();});
  const handlers={
    'synk-teacher:environment':()=>({clientId:TEACHER.id,mode:'development',platform:process.platform,arch:process.arch,sessionScope,separateClient:true,productionReady:false}),
    'synk-teacher:auth-status':()=>({configured:false,signedIn:false,status:'unconfigured',productionReady:false}),
  };
  for(const [channel,handler]of Object.entries(handlers)){ipcMain.removeHandler(channel);ipcMain.handle(channel,event=>{assertTeacherSender(event,window);return handler();});}
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
