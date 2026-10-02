'use strict';
// Two isolated application windows, sharing only the local classroom API.
const {app,BrowserWindow,session,dialog,Menu}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises'),{pathToFileURL}=require('node:url'),{randomBytes}=require('node:crypto');
const {classroomURL}=require('./classroom-policy.cjs');
if(app.isPackaged||!process.argv.includes('--synk-classroom-preview'))throw Error('Local classroom development only');
const smoke=process.argv.includes('--synk-smoke'),windows=new Map();let server,origin,opening;
app.enableSandbox();app.setName('SYNK WORLD Classroom Preview');
app.setPath('userData',path.join(app.getPath(smoke?'temp':'appData'),'SYNK Desktop',smoke?'classroom-smoke':'classroom-preview'));
if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',()=>{if(origin)void openWindows().catch(()=>{});});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',()=>{server?.close();server?.closeAllConnections();});
  app.whenReady().then(start).catch(error=>{console.error('CLASSROOM_START_FAILED',error.code||'ERROR',error.message);if(!smoke)dialog.showErrorBox('WORLD 수업 연결을 열지 못했어요',error.code==='EADDRINUSE'?'다른 프로그램이 수업 연결 포트 4295를 사용하고 있어요. 기존 프로그램을 확인해 주세요.':'수업 연결 서버를 시작하지 못했어요. 개발 서버와 저장 공간을 확인해 주세요.');app.exit(1);});
}
async function start(){
  const teacherRoot=path.resolve(__dirname,'../../experiences/teacher-world'),{createLinkedServer}=await import(pathToFileURL(path.join(teacherRoot,'linked-server.mjs')).href);
  let ownerKey,persistPath;if(!smoke){const folder=path.join(teacherRoot,'.local');await fs.mkdir(folder,{recursive:true});const keyFile=path.join(folder,'linked-owner.key');
    try{ownerKey=(await fs.readFile(keyFile,'utf8')).trim();}catch(error){if(error.code!=='ENOENT')throw error;ownerKey=randomBytes(32).toString('hex');await fs.writeFile(keyFile,ownerKey,{flag:'wx',mode:0o600});}persistPath=path.join(folder,'linked-state.json');}
  server=await createLinkedServer({ownerKey,persistPath});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(smoke?0:4295,'127.0.0.1',resolve);});origin=`http://127.0.0.1:${server.address().port}`;
  Menu.setApplicationMenu(null);
  await openWindows();
  if(smoke){
    // A role window can be closed independently; a second launcher request must restore it.
    windows.get('teacher').destroy();await openWindows();const teacherReopened=windows.has('teacher');
    windows.get('world').destroy();await openWindows();const worldReopened=windows.has('world');
    for(let i=0;i<100;i++){if(await windows.get('teacher').webContents.executeJavaScript(`document.documentElement.dataset.ready==='true'`))break;await new Promise(r=>setTimeout(r,50));}
    const teacher=await windows.get('teacher').webContents.executeJavaScript(`({ready:document.documentElement.dataset.ready==='true',path:location.pathname,hash:location.hash,hasNode:typeof require!=='undefined'})`),world=await windows.get('world').webContents.executeJavaScript(`({path:location.pathname,join:!!document.getElementById('local-join-form'),hasNode:typeof require!=='undefined'})`);
    const ok=teacherReopened&&worldReopened&&teacher.ready&&!teacher.hash&&!teacher.hasNode&&world.join&&!world.hasNode&&windows.get('teacher').webContents.session!==windows.get('world').webContents.session;
    console.log('SYNK_CLASSROOM_SMOKE '+JSON.stringify({ok,teacher,world,teacherReopened,worldReopened,separateSessions:true,productionConnected:false}));app.exit(ok?0:1);
  }
}
async function openWindows(){
  if(opening)return opening;
  opening=(async()=>{for(const role of ['teacher','world']){
    const existing=windows.get(role);if(existing&&!existing.isDestroyed()){if(!smoke){if(existing.isMinimized())existing.restore();existing.show();existing.focus();}continue;}
    const partition=`persist:synk-classroom-${role}${smoke?'-smoke':''}`,own=session.fromPartition(partition);
    own.setPermissionRequestHandler((_w,_p,callback)=>callback(false));own.setPermissionCheckHandler(()=>false);own.removeAllListeners('will-download');own.on('will-download',event=>event.preventDefault());
    own.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!classroomURL(details.url,origin,role,{resource:true})}));
    const win=new BrowserWindow({width:role==='teacher'?1320:1100,height:900,minWidth:360,minHeight:500,show:false,title:role==='teacher'?'SYNK WORLD · 교사':'SYNK WORLD',icon:path.join(__dirname,'../assets/world.png'),backgroundColor:'#ffffff',autoHideMenuBar:true,webPreferences:{partition,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
    windows.set(role,win);win.on('closed',()=>windows.delete(role));win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-attach-webview',e=>e.preventDefault());
    for(const name of ['will-navigate','will-redirect'])win.webContents.on(name,(event,url)=>{if(!classroomURL(url,origin,role))event.preventDefault();});
    win.webContents.on('will-frame-navigate',event=>{if(!classroomURL(event.url,origin,role,{frame:!event.isMainFrame}))event.preventDefault();});
    await win.loadURL(role==='teacher'?`${origin}/#teacher-key=${server.ownerKey}`:`${origin}/synk-account/local-world.html`);if(!smoke)win.show();
  }})();try{return await opening;}finally{opening=null;}
}
