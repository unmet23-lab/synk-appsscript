'use strict';
const {createHash}=require('node:crypto');
const path=require('node:path');
const {scopeOf}=require('./pulse-requests.cjs');
const {installDraftExitGuard}=require('./draft-exit.cjs');

const PULSE_APP_ORIGIN='https://workspace.synk.im';
const PULSE_APP_ENTRY=PULSE_APP_ORIGIN+'/pulse-app/';
const PULSE_STAFF_ENTRY=PULSE_APP_ENTRY+'?mode=staff';
// The customer entry's "try a project" link reloads this shell as a fictional
// demo kept on the device; that single query may stay inside the window.
const PULSE_DEMO_SEARCH='?demo=coffee',PULSE_DEMO_ENTRY=PULSE_APP_ENTRY+PULSE_DEMO_SEARCH;
// Customer media carries the types the server accepts for project files
// (studio-media.mjs, MP3·WAV attachments included).
const MEDIA=/^\/pulse\/api\/(?:studio\/)?media\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,MEDIA_TYPES=['video/mp4','video/webm','image/png','image/jpeg','audio/mpeg','audio/wav'];
// The demo's 「파일 받기」 serves only its two prepared sample videos.
const DEMO_MEDIA=/^\/pulse-app\/demo-assets\/preview-v[12]\.mp4$/,DEMO_MEDIA_TYPES=['video/mp4'];
// Public pages under the app open in the browser like other new-tab links: the
// production library (only its model query is passed on) and static media
// files under /pulse-app/assets/. The shell never leaves: its fragment can
// carry an invite.
const PULSE_LIBRARY='/pulse-app/production-library/',LIBRARY_QUERY=/^\?model=[A-Z][0-9]{2}$/,PUBLIC_ASSET=/^\/pulse-app\/assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:mp4|webp|png|jpe?g|mp3)$/;
const PULSE_EXIT_TEXT={title:'SYNK PULSE',message:'아직 저장하거나 보내지 않은 내용이 있어요.',detail:'돌아가서 마저 저장하거나 보낼 수 있어요. 이미 저장하거나 보낸 내용은 그대로 남습니다.'};
function fixedUrl(value){try{if(typeof value!=='string'||value.length>4096)return null;const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url:null;}catch{return null;}}
function pulseAppNavigationAllowed(value){const url=fixedUrl(value);return !!url&&url.origin===PULSE_APP_ORIGIN&&url.pathname==='/pulse-app/'&&(!url.search||url.search===PULSE_DEMO_SEARCH);}
function pulseAppResourceAllowed(value){const url=fixedUrl(value);return !!url&&url.origin===PULSE_APP_ORIGIN&&(url.pathname.startsWith('/pulse-app/')||url.pathname.startsWith('/pulse/api/')||url.pathname.startsWith('/messenger/assets/')||['/wordmark.svg','/font.woff2'].includes(url.pathname));}
function pulseAppRequestAllowed(details){
  if(details.resourceType==='subFrame')return false;
  if(details.resourceType==='mainFrame')return pulseAppNavigationAllowed(details.url);
  if(pulseAppResourceAllowed(details.url))return true;
  const url=fixedUrl(details.url),referrer=fixedUrl(details.referrer);
  return !!url&&url.origin!==PULSE_APP_ORIGIN&&['image','media'].includes(details.resourceType)&&referrer?.origin===PULSE_APP_ORIGIN&&(!details.initiatorOrigin||details.initiatorOrigin===PULSE_APP_ORIGIN);
}
function pulseAppMediaTypes(value){const url=fixedUrl(value);if(!url||url.origin!==PULSE_APP_ORIGIN||url.search||url.hash)return null;return MEDIA.test(url.pathname)?MEDIA_TYPES:DEMO_MEDIA.test(url.pathname)?DEMO_MEDIA_TYPES:null;}
function pulseAppMediaAllowed(value){return !!pulseAppMediaTypes(value);}
function pulseAppPublicPage(url){return url.origin===PULSE_APP_ORIGIN&&!url.hash&&(url.pathname===PULSE_LIBRARY?!url.search||LIBRARY_QUERY.test(url.search):PUBLIC_ASSET.test(url.pathname)&&!url.search);}
function pulseAppExternalDestination(value){if(value===PULSE_STAFF_ENTRY)return value;const url=fixedUrl(value);return url&&(url.origin!==PULSE_APP_ORIGIN||pulseAppPublicPage(url))?url.href:null;}
function pulseAppPartition(scope){return 'persist:synk-pulse-app-'+createHash('sha256').update('pulse-app-v1\0'+scope).digest('hex').slice(0,40);}

// A customer app gets its own account-scoped persisted cookie jar. Neither the
// employee workspace nor the platform's SYNK ID session is shared with it.
function createPulseApp({clientId,getAccount,BrowserWindow,session,dialog,openExternal,getDownloads,onUnloadKept=()=>{},loadTimeoutMs=25000}){
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
    // The page's beforeunload keeps unsaved text, which Electron would cancel
    // silently. Ask like the platform window; keeping it also cancels app quit.
    installDraftExitGuard({contents,window,dialog,text:PULSE_EXIT_TEXT});
    contents.on('will-prevent-unload',event=>{if(!event.defaultPrevented&&!window.isDestroyed())onUnloadKept();});
    const download=(event,item,source)=>{
      const max=100*1024*1024,types=pulseAppMediaTypes(item.getURL());
      if(source!==contents||!types?.includes(item.getMimeType())||item.getTotalBytes()>max){event.preventDefault();return;}
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
module.exports={createPulseApp,pulseAppPartition,pulseAppNavigationAllowed,pulseAppResourceAllowed,pulseAppRequestAllowed,pulseAppMediaAllowed,pulseAppExternalDestination,PULSE_APP_ORIGIN,PULSE_APP_ENTRY,PULSE_STAFF_ENTRY,PULSE_DEMO_ENTRY};
