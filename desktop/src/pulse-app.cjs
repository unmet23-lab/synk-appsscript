'use strict';
const {createHash,randomBytes}=require('node:crypto');
const path=require('node:path');
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
// files under /pulse-app/assets/. The shell itself never leaves the window.
const PULSE_LIBRARY='/pulse-app/production-library/',LIBRARY_QUERY=/^\?model=[A-Z][0-9]{2}$/,PUBLIC_ASSET=/^\/pulse-app\/assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:mp4|webp|png|jpe?g|mp3)$/;
const PULSE_WINDOW_BACKGROUND='#000000';
const PULSE_EXIT_TEXT={title:'SYNK PULSE',message:'아직 저장하거나 보내지 않은 내용이 있어요.',detail:'돌아가서 마저 저장하거나 보낼 수 있어요. 이미 저장하거나 보낸 내용은 그대로 남아요.'};
// The entry portal checks a complete customer invite link and sends its token
// with the request it belongs to, as exactly {token,requestId,accountGeneration}
// (company-entry-contract-v1 §7). requestId is the portal's own UUID.
// accountGeneration is the UUID auth issued for its current epoch
// (auth-service.cjs accountGeneration, read here through getAccountGeneration),
// never the numeric sessionGeneration. The company entry's customer delivery
// (main.cjs deliverCustomer) sends the same exact form. A lone {token} is
// refused like every other form: taking it under the live generation would
// apply a request made before an account change to the account that replaced it.
// The UUIDs are lowercase, of versions 1 to 8 with the RFC variant, as the
// company entry checks them (company-entry.cjs); auth issues v4 today.
const PULSE_INVITE_TOKEN=/^[A-Za-z0-9_-]{16,200}$/,PULSE_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// Every window opens only the fixed shell, never an address with the token.
// The window's own preload carries the token in memory to the document's
// receiver (pulse-invite-preload.cjs states that contract). Main offers it a
// hand-off, never the token, as exactly {id,requestId,accountGeneration,
// expectedAccountId}. Once the ready document is bound, the preload asks with
// exactly {id,requestId,accountGeneration,documentId}, and main answers the
// token once, as exactly {id,requestId,accountGeneration,documentId,token}.
// The preload reports how the hand-off ended, as exactly {id,requestId,
// accountGeneration,documentId,outcome}. The token never enters an address, a
// result or a log. When the portal cancels the invite (cancelInvite), main tells
// that window's preload to drop the hand-off, as exactly {id,requestId,
// accountGeneration}: the preload then binds nothing more for it, asks main for
// nothing and tells a document still bound without the token to drop the binding.
const PULSE_INVITE_PRELOAD=path.join(__dirname,'pulse-invite-preload.cjs');
const PULSE_INVITE_CHANNEL=Object.freeze({offer:'synk:pulse-invite-offer',commit:'synk:pulse-invite-commit',result:'synk:pulse-invite-result',abort:'synk:pulse-invite-abort'});
const PULSE_INVITE_OUTCOMES=['delivered','unavailable','demo','not-received'];
// The codes for which the same request may be asked again as it is. A request
// of another generation, a demo in use and an unconfirmed hand-off are not.
// CANCELLED is the portal's own cancel before the token left main.
const PULSE_INVITE_RETRYABLE=new Set(['SUITE_UNAVAILABLE','PULSE_APP_ACCOUNT_PENDING','PULSE_APP_BUSY','PULSE_APP_STORAGE_UNAVAILABLE','PULSE_APP_OPEN_FAILED','PULSE_APP_INVITE_RECEIVER_UNAVAILABLE','PULSE_APP_INVITE_FAILED','CANCELLED']);
function fixedUrl(value){try{if(typeof value!=='string'||value.length>4096)return null;const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url:null;}catch{return null;}}
const isUuid=value=>typeof value==='string'&&PULSE_UUID.test(value);
// The own data fields of a plain object that has exactly these keys, or null.
function exactFields(input,keys){
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const own=Reflect.ownKeys(input);if(own.length!==keys.length||!keys.every(key=>own.includes(key)))return null;
  const fields={};
  for(const key of keys){const field=Object.getOwnPropertyDescriptor(input,key);if(!field||!('value' in field))return null;fields[key]=field.value;}
  return fields;
}
// Exactly {token,requestId,accountGeneration}, or null for anything else, a lone {token} included.
function pulseInviteRequest(input){
  const fields=exactFields(input,['token','requestId','accountGeneration']);
  return fields&&typeof fields.token==='string'&&PULSE_INVITE_TOKEN.test(fields.token)&&isUuid(fields.requestId)&&isUuid(fields.accountGeneration)?fields:null;
}
// A refused input still names its request when it named one well-formed.
function namedId(input,key){try{const field=input&&typeof input==='object'?Object.getOwnPropertyDescriptor(input,key):null;return field&&'value' in field&&isUuid(field.value)?field.value:null;}catch{return null;}}
// The only two answers an invite gets (company-entry-contract-v1 §7). Neither
// carries the token, an address or an original error.
function inviteFailure(request,code){return {ok:false,requestId:request.requestId,accountGeneration:request.accountGeneration,code,retryable:PULSE_INVITE_RETRYABLE.has(code)};}
function inviteReceived(request){return {ok:true,requestId:request.requestId,accountGeneration:request.accountGeneration,state:'received',destination:'/pulse-app/'};}
// A refusal made before the PULSE service sees the invite (main.cjs: another
// client, the smoke run, an unavailable sign-in suite), in the same form.
function pulseInviteRefusal(input,code){return inviteFailure({requestId:namedId(input,'requestId'),accountGeneration:namedId(input,'accountGeneration')},code);}
// 'shell' is the customer shell itself; 'demo' is the fictional project the
// page fixes when it boots, so a later hash cannot turn it into a real invite.
function pulseShellPage(value){const url=fixedUrl(value);if(!url||url.origin!==PULSE_APP_ORIGIN||url.pathname!=='/pulse-app/')return null;return url.search===PULSE_DEMO_SEARCH?'demo':url.search?null:'shell';}
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
// The cookie jar follows the signed-in SYNK ID or a signed-out guest; a
// restoring, failed or anonymous-local account opens nothing. The guest is a
// confirmed sign-out, read as company-entry.cjs bindingFromAuth reads it: not
// signed in, signed out or unconfigured, no account left, and either no error
// or a plain one that cannot be retried. Auth's discard (an expired or revoked
// session, AUTH_REQUIRED; a cancelled sign-in, AUTH_CANCELLED) empties the
// session and keeps its reason that way, so the reason keeps no guest out. A
// sign-out mark with a retryable error left (auth still waiting to retry the
// same session), an account left or an error of unknown shape is no guest.
const accountScope=id=>typeof id==='string'&&/^[a-zA-Z0-9_.-]{1,120}$/.test(id)&&id!=='anonymous-local'?'account:'+id:null;
function scopeOf(account){
  const scope=accountScope(account?.account?.synk_user_id);
  if(account?.signedIn===true&&account.status==='signed-in'&&scope)return scope;
  if(account?.signedIn!==false||!['signed-out','unconfigured'].includes(account.status)||(account.account!==null&&account.account!==undefined))return null;
  const error=account.error;
  return !error||(typeof error==='object'&&!Array.isArray(error)&&Object.getPrototypeOf(error)===Object.prototype&&error.retryable!==true)?'guest':null;
}
function pulseAppPartition(scope){return 'persist:synk-pulse-app-'+createHash('sha256').update('pulse-app-v1\0'+scope).digest('hex').slice(0,40);}

// A customer app gets its own account-scoped persisted cookie jar. Neither the
// employee workspace nor the platform's SYNK ID session is shared with it.
// getRenewingAccount names the SYNK ID whose verified session is renewing its
// token in the same sign-in, or waiting to retry after a retryable failure
// (auth-service.cjs renewingAccountId, through main). getAccountGeneration is
// auth's UUID for its current epoch (auth-service.cjs accountGeneration,
// through main). Neither is ever read from the account state a renderer sees.
function createPulseApp({clientId,getAccount,getRenewingAccount=()=>null,getAccountGeneration=()=>null,BrowserWindow,session,dialog,openExternal,getDownloads,onUnloadKept=()=>{},loadTimeoutMs=25000,inviteTimeoutMs=5000}){
  // inviting is the invite openInvite is answering (one at a time; cancelInvite names it by its two IDs), and handoff
  // the window hand-off it began, if any.
  let owner=scopeOf(getAccount?.()),epoch=0,activeWindow=null,activeSession=null,pending=null,delivering=null,inviting=null,handoff=null,disposed=false,cleanup=Promise.resolve();
  const dirtySessions=new Set();
  function clearOldSessions(){cleanup=cleanup.catch(()=>{}).then(async()=>{for(const old of dirtySessions){await old.clearStorageData();await old.clearCache?.();dirtySessions.delete(old);}}).catch(()=>{});return cleanup;}
  function closeWindow(){const old=activeWindow;activeWindow=null;if(old&&!old.isDestroyed())old.destroy();}
  // A token renewal of the owner's own SYNK ID is not an account change: its
  // window, drafts and jar stay as they are. Like any unsettled account it
  // answers null, so nothing new opens and no invite is handed over until the
  // account is verified again. Another account, a sign-out and a confirmed
  // rejection still close the window and clear the old jar. Disposal is the
  // app quitting (main.cjs will-quit, with auth keeping its saved sign-in): it
  // closes the window and keeps every jar for the next launch.
  function renewing(){return owner!==null&&accountScope(getRenewingAccount())===owner;}
  // The generation an invite is bound to: auth's UUID for its current epoch,
  // read in main at every step. Anything else counts as none.
  function currentGeneration(){let value=null;try{value=getAccountGeneration();}catch{value=null;}return isUuid(value)?value:null;}
  // The SYNK ID main verified for this jar, or null for the guest.
  function ownerAccount(){return typeof owner==='string'&&owner.startsWith('account:')?owner.slice('account:'.length):null;}
  // The invite hand-off in progress (deliverInvite). Main keeps its token until
  // the window's preload asks for it; once settled it hands nothing more, and a
  // later report changes nothing.
  function settleInvite(request,result){if(request.state==='settled')return;request.state='settled';request.token=null;if(handoff===request)handoff=null;request.end(result);}
  // An offer the page has not taken ends; a token the page already holds is the page's.
  function refuseOffer(code){if(handoff?.state==='offered')settleInvite(handoff,inviteFailure(handoff,code));}
  function syncContext(account=getAccount?.()){
    if(disposed)return null;
    const next=scopeOf(account);if(next===owner)return next;
    if(next===null&&renewing()){refuseOffer('PULSE_APP_ACCOUNT_PENDING');return null;}
    ++epoch;const old=activeSession||(owner?session.fromPartition(pulseAppPartition(owner)):null);owner=next;activeSession=null;pending=null;delivering=null;closeWindow();
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
    // Black like the customer app's page (html.sx background, theme-color), so
    // a resize or a slow paint never flashes the old light frame.
    const window=new BrowserWindow({width:1240,height:880,minWidth:720,minHeight:560,title:'SYNK PULSE',show:false,autoHideMenuBar:true,backgroundColor:PULSE_WINDOW_BACKGROUND,webPreferences:{session:isolated,preload:PULSE_INVITE_PRELOAD,sandbox:true,contextIsolation:true,nodeIntegration:false,nodeIntegrationInWorker:false,nodeIntegrationInSubFrames:false,webviewTag:false,webSecurity:true,allowRunningInsecureContent:false,experimentalFeatures:false,devTools:false}});
    const contents=window.webContents;
    // Only this window's preload speaks here, and only about the hand-off main
    // offered it. A synchronous request always gets an answer, null when refused.
    contents.ipc.on(PULSE_INVITE_CHANNEL.commit,(event,payload)=>{let answer=null;try{answer=releaseInvite(window,event,payload);}catch{answer=null;}finally{event.returnValue=answer;}});
    contents.ipc.on(PULSE_INVITE_CHANNEL.result,(event,payload)=>{try{reportInvite(window,event,payload);}catch{}});
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
  // Creates the one window in this owner's jar and loads the fixed shell,
  // PULSE_APP_ENTRY. No address a window loads ever carries an invite.
  function launch(){
    const expected=epoch;
    const operation=(async()=>{
      await clearOldSessions();
      // The account is read again after the wait. A change ends this opening;
      // a token renewal that began meanwhile keeps what is already open but
      // starts no window and hands no invite over until the account is verified.
      const settled=syncContext();
      if(disposed||expected!==epoch)return {ok:false,code:'PULSE_APP_ACCOUNT_CHANGED'};
      if(!settled)return {ok:false,code:'PULSE_APP_ACCOUNT_PENDING'};
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
  function open(){
    if(clientId!=='platform'||disposed)return Promise.resolve({ok:false,code:'PULSE_APP_UNAVAILABLE'});
    if(!syncContext())return Promise.resolve({ok:false,code:'PULSE_APP_ACCOUNT_PENDING'});
    if(pending)return pending;
    if(activeWindow&&!activeWindow.isDestroyed()){if(activeWindow.isMinimized())activeWindow.restore();activeWindow.show();activeWindow.focus();return Promise.resolve({ok:true,id:'pulse',independentWindow:true,reused:true});}
    return launch();
  }
  function waitForShell(window,expected){
    const contents=window.webContents,frame=contents.mainFrame;
    return new Promise(resolve=>{
      let timer;
      const end=code=>{clearTimeout(timer);window.removeListener('closed',closed);contents.removeListener('did-stop-loading',stopped);contents.removeListener('did-start-navigation',navigating);contents.removeListener('did-fail-load',failed);contents.removeListener('render-process-gone',gone);resolve(code);};
      // At did-stop-loading, and once more at the bound, which also covers a stop
      // Electron did not report. A check that throws still ends the wait.
      const check=bound=>{
        try{
          if(!window.isDestroyed()&&contents.isLoadingMainFrame?.()){if(bound)end('PULSE_APP_BUSY');return;}
          syncContext();
          end(disposed||expected!==epoch||activeWindow!==window||window.isDestroyed()?deliveryFailure(expected):contents.mainFrame===frame?null:'PULSE_APP_BUSY');
        }catch{end('PULSE_APP_OPEN_FAILED');}
      };
      const closed=()=>end(deliveryFailure(expected)),stopped=()=>check(false),gone=()=>end('PULSE_APP_OPEN_FAILED');
      // Current and older Electron arguments, as in deliverInvite.
      const navigating=(details,_url,isInPlace,isMainFrame)=>{const main=details?.isMainFrame??isMainFrame,same=details?.isSameDocument??isInPlace;if(main===true&&same!==true)end('PULSE_APP_BUSY');};
      const failed=(_event,_code,_description,_url,isMainFrame)=>{if(isMainFrame===true)end('PULSE_APP_OPEN_FAILED');};
      window.once('closed',closed);contents.on('did-stop-loading',stopped);contents.on('did-start-navigation',navigating);contents.on('did-fail-load',failed);contents.on('render-process-gone',gone);
      timer=setTimeout(()=>check(true),inviteTimeoutMs);
    });
  }
  // A closed window, a page that did not confirm the receipt or an account
  // change during the hand-off is never a success. The epoch tells the account change.
  function deliveryFailure(expected){syncContext();return !disposed&&expected===epoch?'PULSE_APP_INVITE_FAILED':'PULSE_APP_ACCOUNT_CHANGED';}
  // A hand-off cut off by its window closing or a new document: before the
  // token left main a failure, after that unconfirmed, since the document may
  // have kept it. An account change says so either way.
  function cutOff(request){const code=deliveryFailure(request.expected);return inviteFailure(request,code==='PULSE_APP_INVITE_FAILED'&&request.state==='committed'?'PULSE_APP_INVITE_UNCONFIRMED':code);}
  // Whether the token may go to the document right now, read without changing
  // anything: the window's preload is waiting for this answer. The auth notice
  // that comes with an account change closes the window (syncContext). The
  // generation is auth's own, so a hand-off made for an epoch auth has since
  // left is refused here even before PULSE hears of the change.
  function handoffRefusal(request){
    if(disposed||request.expected!==epoch)return 'PULSE_APP_ACCOUNT_CHANGED';
    if(activeWindow!==request.window||request.window.isDestroyed())return 'PULSE_APP_INVITE_FAILED';
    const next=scopeOf(getAccount?.());
    if(next!==owner)return next===null&&renewing()?'PULSE_APP_ACCOUNT_PENDING':'PULSE_APP_ACCOUNT_CHANGED';
    return currentGeneration()===request.accountGeneration&&ownerAccount()===request.expectedAccountId?null:'PULSE_APP_ACCOUNT_CHANGED';
  }
  // This window's own main frame, the very one the offer went to.
  function offeredFrame(window,request,frame){return !!frame&&!frame.parent&&frame===request.frame&&frame===window.webContents.mainFrame;}
  // The preload's synchronous request, made once the ready document is bound to
  // this hand-off. Main answers the token once: to the offered frame on the
  // customer shell, for this offer's own IDs, while the same account, generation
  // and epoch hold, and fixes the document it went to. Anything else gets null.
  // A request naming no offer of this window leaves the offer as it is; one
  // naming this offer with anything else wrong ends it.
  function releaseInvite(window,event,payload){
    const request=handoff;
    if(!request||request.window!==window||request.state!=='offered')return null;
    const fields=exactFields(payload,['id','requestId','accountGeneration','documentId']);
    if(!fields||fields.id!==request.id)return null;
    const frame=event?.senderFrame;
    if(fields.requestId!==request.requestId||fields.accountGeneration!==request.accountGeneration||!isUuid(fields.documentId)||!offeredFrame(window,request,frame)||pulseShellPage(frame.url)!=='shell'){settleInvite(request,inviteFailure(request,'PULSE_APP_INVITE_FAILED'));return null;}
    const refused=handoffRefusal(request);
    if(refused){settleInvite(request,inviteFailure(request,refused));return null;}
    const token=request.token;request.token=null;request.documentId=fields.documentId;request.state='committed';
    return {id:request.id,requestId:request.requestId,accountGeneration:request.accountGeneration,documentId:request.documentId,token};
  }
  // How the preload's hand-off ended. Before the token left main the document
  // could only refuse it, so every outcome then is a failure. After that only
  // 'delivered' for the document the token went to, with the account, its
  // generation, the window and the epoch unchanged, is a delivery. Any other
  // report, like no report by the bound, is unconfirmed: the document may keep
  // the token, and main never sends it again. A report of another hand-off, in
  // another form or from another frame changes nothing.
  function reportInvite(window,event,payload){
    const request=handoff;
    if(!request||request.window!==window)return;
    const fields=exactFields(payload,['id','requestId','accountGeneration','documentId','outcome']),frame=event?.senderFrame;
    if(!fields||fields.id!==request.id||fields.requestId!==request.requestId||fields.accountGeneration!==request.accountGeneration||!PULSE_INVITE_OUTCOMES.includes(fields.outcome)||!offeredFrame(window,request,frame))return;
    if(request.state==='offered'){
      if(fields.documentId!==null&&!isUuid(fields.documentId))return;
      settleInvite(request,inviteFailure(request,fields.outcome==='demo'?'PULSE_APP_DEMO_ACTIVE':fields.outcome==='unavailable'?'PULSE_APP_INVITE_RECEIVER_UNAVAILABLE':'PULSE_APP_INVITE_FAILED'));return;
    }
    if(request.state!=='committed'||fields.documentId!==request.documentId)return;
    if(fields.outcome!=='delivered'||pulseShellPage(frame.url)!=='shell'){settleInvite(request,inviteFailure(request,'PULSE_APP_INVITE_UNCONFIRMED'));return;}
    syncContext();
    if(disposed||request.expected!==epoch||activeWindow!==window||window.isDestroyed()){settleInvite(request,cutOff(request));return;}
    if(currentGeneration()!==request.accountGeneration||ownerAccount()!==request.expectedAccountId){settleInvite(request,inviteFailure(request,'PULSE_APP_ACCOUNT_CHANGED'));return;}
    if(window.isMinimized())window.restore();window.show();window.focus();
    settleInvite(request,inviteReceived(request));
  }
  function deliverInvite(window,invite){
    const expected=epoch,contents=window.webContents,page=pulseShellPage(contents.getURL());
    // The demo window stays exactly as it is, drafts included: no reload and no
    // second window. The member finishes the demo and sends the invite again.
    if(page==='demo')return Promise.resolve(inviteFailure(invite,'PULSE_APP_DEMO_ACTIVE'));
    if(page!=='shell')return Promise.resolve(inviteFailure(invite,'PULSE_APP_INVITE_FAILED'));
    if(contents.isLoadingMainFrame?.())return Promise.resolve(inviteFailure(invite,'PULSE_APP_BUSY'));
    const frame=contents.mainFrame;
    if(!frame)return Promise.resolve(inviteFailure(invite,'PULSE_APP_INVITE_FAILED'));
    // From here the hand-off holds the token; the invite keeps only the hand-off.
    const token=invite.token;invite.token=null;
    let request;
    const operation=new Promise(resolve=>{
      let timer;
      const ended=()=>settleInvite(request,cutOff(request));
      // A new document in this window ends the hand-off; a move inside the same
      // document does not. Electron passes the details first, older versions
      // only (url, isInPlace, isMainFrame).
      const navigating=(details,_url,isInPlace,isMainFrame)=>{const main=details?.isMainFrame??isMainFrame,same=details?.isSameDocument??isInPlace;if(main===true&&same!==true)ended();};
      request={id:randomBytes(24).toString('base64url'),requestId:invite.requestId,accountGeneration:invite.accountGeneration,expectedAccountId:ownerAccount(),token,window,frame,expected,state:'offered',documentId:null,
        end(result){clearTimeout(timer);window.removeListener('closed',ended);contents.removeListener('did-start-navigation',navigating);resolve(result);}};
      invite.handoff=request;handoff=request;window.once('closed',ended);contents.on('did-start-navigation',navigating);
      // One bound for the whole hand-off. An offer not taken by then has expired
      // in main, so a busy page that runs it later is refused the token. A token
      // already handed over without a receipt by then is unconfirmed: the page
      // may still keep it, so this is reported neither as a delivery nor a failure.
      timer=setTimeout(()=>settleInvite(request,inviteFailure(request,request.state==='committed'?'PULSE_APP_INVITE_UNCONFIRMED':'PULSE_APP_INVITE_FAILED')),inviteTimeoutMs);
    });
    try{contents.send(PULSE_INVITE_CHANNEL.offer,{id:request.id,requestId:request.requestId,accountGeneration:request.accountGeneration,expectedAccountId:request.expectedAccountId});}catch{settleInvite(request,cutOff(request));}
    return operation;
  }
  // No window yet: the fixed shell opens first, and the invite then goes the
  // same way as to an open window. The window opening is no success of its own.
  async function launchInvite(invite){
    const expected=epoch,opened=await launch();
    // A cancel while the shell opened has answered the invite already: the
    // window stays an ordinary opening and is handed nothing.
    if(invite.done)return null;
    if(!opened.ok)return inviteFailure(invite,opened.code);
    const window=activeWindow;
    if(!window||window.isDestroyed()||disposed||expected!==epoch)return inviteFailure(invite,deliveryFailure(expected));
    // Just after loadURL the new shell may still count as loading (waitForShell).
    const refused=window.webContents.isLoadingMainFrame?.()?await waitForShell(window,expected):null;
    // A cancel during that wait has answered the invite as well.
    if(invite.done)return null;
    if(refused)return inviteFailure(invite,refused);
    if(currentGeneration()!==invite.accountGeneration)return inviteFailure(invite,'PULSE_APP_ACCOUNT_CHANGED');
    return deliverInvite(window,invite);
  }
  // The one answer of the invite openInvite took. Whatever answers first, the
  // hand-off's own end or the portal's cancel, is the answer; the token goes.
  function answerInvite(invite,result){if(invite.done)return;invite.done=true;invite.token=null;if(inviting===invite)inviting=null;invite.answer(result);}
  // The token never appears in a result. An invite while the window is still
  // opening or taking another invite is busy, so it is not folded into that
  // other request's success; the caller tries again.
  function openInvite(input){
    const parsed=pulseInviteRequest(input);
    const ids=parsed?{requestId:parsed.requestId,accountGeneration:parsed.accountGeneration}:{requestId:namedId(input,'requestId'),accountGeneration:namedId(input,'accountGeneration')};
    if(clientId!=='platform'||disposed)return Promise.resolve(inviteFailure(ids,'PULSE_APP_UNAVAILABLE'));
    if(!parsed)return Promise.resolve(inviteFailure(ids,'PULSE_APP_INVITE_INVALID'));
    if(!syncContext())return Promise.resolve(inviteFailure(ids,'PULSE_APP_ACCOUNT_PENDING'));
    const generation=currentGeneration();
    if(!generation)return Promise.resolve(inviteFailure(ids,'PULSE_APP_ACCOUNT_PENDING'));
    // A request made for another generation (a stale renderer's, the former
    // account's) is never applied to this one.
    if(ids.accountGeneration!==generation)return Promise.resolve(inviteFailure(ids,'PULSE_APP_ACCOUNT_CHANGED'));
    if(pending||delivering)return Promise.resolve(inviteFailure(ids,'PULSE_APP_BUSY'));
    const invite={requestId:ids.requestId,accountGeneration:ids.accountGeneration,token:parsed.token,handoff:null,done:false,answer:null};
    parsed.token=null;
    const operation=new Promise(resolve=>{invite.answer=resolve;});
    inviting=invite;
    const run=activeWindow&&!activeWindow.isDestroyed()?deliverInvite(activeWindow,invite):launchInvite(invite);
    void run.then(result=>answerInvite(invite,result),()=>answerInvite(invite,inviteFailure(invite,'PULSE_APP_INVITE_FAILED')));
    delivering=operation;void operation.finally(()=>{if(delivering===operation)delivering=null;});return operation;
  }
  // The portal's cancel of exactly this invite, {requestId,accountGeneration}
  // (main.cjs, the company entry's cancel). Before the bound document asked for
  // the token main still holds it, so dropping it here hands nothing over and the
  // invite ends CANCELLED. Once the token has left main the document may keep it:
  // the invite ends unconfirmed, never undone and never sent again. Either way
  // the window, its document and its drafts stay as they are; nothing is closed,
  // cleared or reloaded. The window's preload is told to drop the hand-off, so a
  // late offer binds nothing and asks main for nothing. A cancel naming another
  // request or generation, or an invite already answered, changes nothing (null).
  function cancelInvite(input){
    const fields=exactFields(input,['requestId','accountGeneration']),invite=inviting;
    if(!fields||!isUuid(fields.requestId)||!isUuid(fields.accountGeneration)||!invite||invite.done||invite.requestId!==fields.requestId||invite.accountGeneration!==fields.accountGeneration)return null;
    const request=invite.handoff;
    if(request?.state==='settled')return null;
    const result=inviteFailure(invite,request?.state==='committed'?'PULSE_APP_INVITE_UNCONFIRMED':'CANCELLED');
    invite.token=null;
    if(request){abortHandoff(request);settleInvite(request,result);}
    answerInvite(invite,result);
    return {...result};
  }
  function abortHandoff(request){try{if(!request.window.isDestroyed())request.window.webContents.send(PULSE_INVITE_CHANNEL.abort,{id:request.id,requestId:request.requestId,accountGeneration:request.accountGeneration});}catch{}}
  return {open,openInvite,cancelInvite,syncContext,dispose(){disposed=true;++epoch;pending=null;delivering=null;closeWindow();activeSession=null;}};
}
module.exports={createPulseApp,scopeOf,pulseAppPartition,pulseInviteRequest,pulseInviteRefusal,pulseAppNavigationAllowed,pulseAppResourceAllowed,pulseAppRequestAllowed,pulseAppMediaAllowed,pulseAppExternalDestination,PULSE_APP_ORIGIN,PULSE_APP_ENTRY,PULSE_STAFF_ENTRY,PULSE_DEMO_ENTRY,PULSE_WINDOW_BACKGROUND,PULSE_INVITE_PRELOAD};
