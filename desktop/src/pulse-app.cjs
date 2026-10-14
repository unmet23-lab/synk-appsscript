'use strict';
const {createHash}=require('node:crypto');
const path=require('node:path');
const {scopeOf}=require('./pulse-requests.cjs');

const PULSE_APP_ORIGIN='https://workspace.synk.im';
const PULSE_APP_ENTRY=PULSE_APP_ORIGIN+'/pulse-app/';
const PULSE_STAFF_ENTRY=PULSE_APP_ENTRY+'?mode=staff';
const MEDIA=/^\/pulse\/api\/(?:studio\/)?media\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function fixedUrl(value){try{if(typeof value!=='string'||value.length>4096)return null;const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url:null;}catch{return null;}}
function pulseAppNavigationAllowed(value){const url=fixedUrl(value);return !!url&&url.origin===PULSE_APP_ORIGIN&&url.pathname==='/pulse-app/'&&!url.search;}
function pulseAppResourceAllowed(value){const url=fixedUrl(value);return !!url&&url.origin===PULSE_APP_ORIGIN&&(url.pathname.startsWith('/pulse-app/')||url.pathname.startsWith('/pulse/api/')||url.pathname.startsWith('/messenger/assets/')||['/wordmark.svg','/font.woff2'].includes(url.pathname));}
function pulseAppRequestAllowed(details){
  if(details.resourceType==='subFrame')return false;
  if(details.resourceType==='mainFrame')return pulseAppNavigationAllowed(details.url);
  if(pulseAppResourceAllowed(details.url))return true;
  const url=fixedUrl(details.url),referrer=fixedUrl(details.referrer);
  return !!url&&url.origin!==PULSE_APP_ORIGIN&&['image','media'].includes(details.resourceType)&&referrer?.origin===PULSE_APP_ORIGIN&&(!details.initiatorOrigin||details.initiatorOrigin===PULSE_APP_ORIGIN);
}
function pulseAppMediaAllowed(value){const url=fixedUrl(value);return !!url&&url.origin===PULSE_APP_ORIGIN&&MEDIA.test(url.pathname)&&!url.search&&!url.hash;}
function pulseAppExternalDestination(value){if(value===PULSE_STAFF_ENTRY)return value;const url=fixedUrl(value);return url&&url.origin!==PULSE_APP_ORIGIN?url.href:null;}
function pulseAppPartition(scope){return 'persist:synk-pulse-app-'+createHash('sha256').update('pulse-app-v1\0'+scope).digest('hex').slice(0,40);}

// A customer app gets its own account-scoped persisted cookie jar. Neither the
// employee workspace nor the platform's SYNK ID session is shared with it.
function createPulseApp({clientId,getAccount,BrowserWindow,session,openExternal,getDownloads,loadTimeoutMs=25000}){
  let owner=scopeOf(getAccount?.()),epoch=0,activeWindow=null,activeSession=null,pending=null,disposed=false,cleanup=Promise.resolve();
  const dirtySessions=new Set();
  function clearOldSessions(){cleanup=cleanup.catch(()=>{}).then(async()=>{for(const old of dirtySessions){await old.clearStorageData();await old.clearCache?.();dirtySessions.delete(old);}}).catch(()=>{});return cleanup;}
  function closeWindow(){const old=activeWindow;activeWindow=null;if(old&&!old.isDestroyed())old.destroy();}
  function syncContext(account=getAccount?.()){
    const next=scopeOf(account);if(next===owner)return next;
    ++epoch;const old=activeSession||(owner?session.fromPartition(pulseAppPartition(owner)):null);owner=next;activeSession=null;pending=null;closeWindow();
    if(old){dirtySessions.add(old);void clearOldSessions();}
    return owner;
  }
  function createSession(scope){
    const isolated=session.fromPartition(pulseAppPartition(scope));
    isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    isolated.setPermissionCheckHandler(()=>false);
    isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>callback({cancel:!pulseAppRequestAllowed(details)}));
    return isolated;
  }
  function sameContext(expected,isolated){syncContext();return !disposed&&expected===epoch&&isolated===activeSession;}
  function createWindow(isolated){
    const window=new BrowserWindow({width:1240,height:880,minWidth:720,minHeight:560,title:'SYNK PULSE',show:false,autoHideMenuBar:true,backgroundColor:'#f8f5f2',webPreferences:{session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false,nodeIntegrationInWorker:false,nodeIntegrationInSubFrames:false,webviewTag:false,webSecurity:true,allowRunningInsecureContent:false,experimentalFeatures:false,devTools:false}});
    const contents=window.webContents;
    const openReference=value=>{if(pulseAppMediaAllowed(value)){contents.downloadURL(value);return;}const destination=pulseAppExternalDestination(value);if(destination)void Promise.resolve(openExternal(destination)).catch(()=>{});};
    contents.setWindowOpenHandler(({url})=>{openReference(url);return {action:'deny'};});
    contents.on('will-attach-webview',event=>event.preventDefault());
    contents.on('will-navigate',(event,url)=>{if(!pulseAppNavigationAllowed(url)){event.preventDefault();openReference(url);}});
    contents.on('will-redirect',(event,url)=>{if(!pulseAppNavigationAllowed(url))event.preventDefault();});
    const download=(event,item,source)=>{
      const max=100*1024*1024;
      if(source!==contents||!pulseAppMediaAllowed(item.getURL())||!['video/mp4','video/webm','image/png','image/jpeg'].includes(item.getMimeType())||item.getTotalBytes()>max){event.preventDefault();return;}
      item.on('updated',()=>{if(item.getTotalBytes()>max||item.getReceivedBytes()>max)item.cancel();});
      item.setSaveDialogOptions({title:'PULSE 프로젝트 파일 저장',defaultPath:path.join(getDownloads(),path.basename(item.getFilename()))});
    };
    isolated.on('will-download',download);
    window.once('closed',()=>{isolated.removeListener('will-download',download);if(activeWindow===window)activeWindow=null;});
    return window;
  }
  function open(){
    if(clientId!=='platform'||disposed)return Promise.resolve({ok:false,code:'PULSE_APP_UNAVAILABLE'});
    if(!syncContext())return Promise.resolve({ok:false,code:'PULSE_APP_ACCOUNT_PENDING'});
    if(pending)return pending;
    if(activeWindow&&!activeWindow.isDestroyed()){if(activeWindow.isMinimized())activeWindow.restore();activeWindow.show();activeWindow.focus();return Promise.resolve({ok:true,id:'pulse',independentWindow:true,reused:true});}
    const expected=epoch;
    const operation=(async()=>{
      await clearOldSessions();if(disposed||expected!==epoch)return {ok:false,code:'PULSE_APP_ACCOUNT_CHANGED'};
      if(dirtySessions.size)return {ok:false,code:'PULSE_APP_STORAGE_UNAVAILABLE'};
      let window,timer;
      try{
        const isolated=activeSession||(activeSession=createSession(owner));
        window=createWindow(isolated);activeWindow=window;
        let httpFailure=false;
        const navigated=(_event,_url,status)=>{if(status>=400)httpFailure=true;};window.webContents.on('did-navigate',navigated);
        try{await Promise.race([window.loadURL(PULSE_APP_ENTRY),new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('PULSE_LOAD_TIMEOUT')),loadTimeoutMs);})]);}
        finally{clearTimeout(timer);window.webContents.removeListener('did-navigate',navigated);}
        if(!sameContext(expected,isolated)){if(!window.isDestroyed())window.destroy();return {ok:false,code:'PULSE_APP_ACCOUNT_CHANGED'};}
        if(window.isDestroyed()||httpFailure)throw Error('PULSE_LOAD_FAILED');
        window.show();window.focus();return {ok:true,id:'pulse',independentWindow:true};
      }catch{clearTimeout(timer);if(window&&!window.isDestroyed())window.destroy();return {ok:false,code:expected===epoch?'PULSE_APP_OPEN_FAILED':'PULSE_APP_ACCOUNT_CHANGED'};}
    })();
    pending=operation;void operation.finally(()=>{if(pending===operation)pending=null;});return operation;
  }
  return {open,syncContext,dispose(){disposed=true;++epoch;pending=null;closeWindow();activeSession=null;}};
}
module.exports={createPulseApp,pulseAppPartition,pulseAppNavigationAllowed,pulseAppResourceAllowed,pulseAppRequestAllowed,pulseAppMediaAllowed,pulseAppExternalDestination,PULSE_APP_ORIGIN,PULSE_APP_ENTRY,PULSE_STAFF_ENTRY};
