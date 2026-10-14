'use strict';
const path=require('node:path');
const {createNativeContent}=require('./native-content.cjs');
const {preferences}=require('./security.cjs');
const STARTUP_ENTRY='synk-desktop://platform/startup-update.html';
function assertStartupSender(event,window){if(!window||window.isDestroyed()||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame?.url!==STARTUP_ENTRY)throw Error('UNTRUSTED_SENDER');}
function createStartupUpdateWindow({BrowserWindow,session,ipcMain,appRoot,gate,onClose=()=>{}}){
  let window=null,disposed=false,registered=false;
  const partition='synk-startup-update';
  const isolated=session.fromPartition(partition);
  isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
  isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,callback)=>callback({cancel:true}));
  isolated.protocol.handle('synk-desktop',createNativeContent({appRoot}));
  isolated.on('will-download',event=>event.preventDefault());
  const actions={status:()=>gate.snapshot(),retry:()=>gate.retry(),'open-current':()=>gate.openCurrent(),install:()=>gate.install()};
  for(const [action,handler]of Object.entries(actions))ipcMain.handle('startup-update:'+action,event=>{assertStartupSender(event,window);return handler();});
  registered=true;
  function show(){
    if(disposed||!gate.isBlocking())return;
    if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();return;}
    window=new BrowserWindow({width:560,height:440,minWidth:360,minHeight:400,resizable:false,minimizable:true,maximizable:false,title:'SYNK Platform 업데이트',show:false,autoHideMenuBar:true,backgroundColor:'#0B0D12',webPreferences:preferences(path.join(appRoot,'src','startup-update-preload.cjs'),partition)});
    const contents=window.webContents;
    contents.setWindowOpenHandler(()=>({action:'deny'}));contents.on('will-attach-webview',event=>event.preventDefault());
    for(const event of ['will-navigate','will-redirect'])contents.on(event,(action,url)=>{if(url!==STARTUP_ENTRY)action.preventDefault();});
    window.once('ready-to-show',()=>{if(window&&!window.isDestroyed()){window.show();window.focus();publish(gate.snapshot());}});
    window.on('close',()=>{if(!disposed)onClose();});
    void window.loadURL(STARTUP_ENTRY).catch(()=>{if(!disposed)onClose();});
  }
  function publish(value){if(disposed||!window||window.isDestroyed())return;window.setClosable(value.state!=='installing');if(window.webContents.getURL()===STARTUP_ENTRY)window.webContents.send('startup-update:changed',value);}
  function dispose(){if(disposed)return;disposed=true;if(registered)for(const action of Object.keys(actions))ipcMain.removeHandler('startup-update:'+action);registered=false;isolated.protocol.unhandle('synk-desktop');if(window&&!window.isDestroyed())window.destroy();}
  return {show,publish,dispose};
}
module.exports={STARTUP_ENTRY,assertStartupSender,createStartupUpdateWindow};
