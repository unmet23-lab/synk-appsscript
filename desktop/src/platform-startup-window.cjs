'use strict';
const path=require('node:path');
const {createNativeContent}=require('./native-content.cjs');
const {preferences}=require('./security.cjs');
const STARTUP_ENTRY='synk-desktop://platform/startup-update.html';
// 시작 창이 받는 동작은 모두 인자가 없다(1-가 구현 설계 2절 「시작 창에서 앱 창으로」). 화면이 값을 만들어 넘기지 않는다.
const STARTUP_ACTIONS=Object.freeze(['status','retry','open-current','install','minimize','toggle-maximize','close']);
// 화면이 이 시간 안에 상태를 묻지 않으면(화면 스크립트가 멈춤) 본체가 지금 판을 연다(5절 「시작 창의 다리가 끊김」)
const BRIDGE_WATCHDOG_MS=10000;
// 앱 창 위에 업데이트 장면을 덮을 때 투명에서 다 덮기까지. 창 하나가 바뀌는 것으로 보이게 짧게 둔다
const FADE_MS=420;
function assertStartupSender(event,window){if(!window||window.isDestroyed()||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame?.url!==STARTUP_ENTRY)throw Error('UNTRUSTED_SENDER');}
// 시작 창은 앱 창과 같은 자리와 크기로 띄운다. 테두리가 없고 바탕은 검정이다. 창 단추는 앱 창의 단추와 같은 모양으로 화면이 그린다.
// placement()는 앱 창이 기억한 자리(window-placement.cjs의 restore), boot()는 구가 드러나기 시작한 시각과 움직임 종류다.
function createStartupUpdateWindow({BrowserWindow,session,ipcMain,appRoot,gate,onClose=()=>{},placement=()=>null,boot=()=>null,icon,onBridgeLost=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
  let window=null,disposed=false,registered=false,quitPrepared=false,watchdog=null,asked=false,shownWaiters=[];
  const partition='synk-startup-update';
  const isolated=session.fromPartition(partition);
  isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
  isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,callback)=>callback({cancel:true}));
  isolated.protocol.handle('synk-desktop',createNativeContent({appRoot}));
  isolated.on('will-download',event=>event.preventDefault());
  const windowState=()=>({maximized:!!window&&!window.isDestroyed()&&window.isMaximized?.()===true});
  const actions={
    status:()=>{asked=true;clearTimer(watchdog);watchdog=null;return {...gate.snapshot(),boot:boot(),window:windowState()};},
    retry:()=>gate.retry(),'open-current':()=>gate.openCurrent(),install:()=>gate.install(),
    minimize:()=>{window?.minimize();return {ok:true};},
    'toggle-maximize':()=>{if(window?.isMaximized())window.unmaximize();else window?.maximize();return {ok:true};},
    close:()=>{window?.close();return {ok:true};},
  };
  for(const [action,handler]of Object.entries(actions))ipcMain.handle('startup-update:'+action,event=>{assertStartupSender(event,window);return handler();});
  registered=true;
  /* inactive: 앞으로 나서지 않고 보인다. fade: 투명에서 서서히 덮는다(앱 창 위에 업데이트 장면을 덮을 때, 1-가 구현 설계 2절 「보이는 업데이트」) */
  function show({inactive=false,fade=false}={}){
    if(disposed||!gate.isBlocking())return;
    if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();if(inactive)window.showInactive();else{window.show();window.focus();}return;}
    quitPrepared=false;asked=false;
    const at=placement()||{width:1440,height:940,minWidth:960,minHeight:680};
    window=new BrowserWindow({...(Number.isFinite(at.x)&&Number.isFinite(at.y)?{x:at.x,y:at.y}:{}),width:at.width,height:at.height,minWidth:at.minWidth,minHeight:at.minHeight,resizable:true,minimizable:true,maximizable:true,frame:false,title:'SYNK Platform',...(icon?{icon}:{}),show:false,autoHideMenuBar:true,backgroundColor:'#000000',webPreferences:preferences(path.join(appRoot,'src','startup-update-preload.cjs'),partition)});
    const contents=window.webContents;
    contents.setWindowOpenHandler(()=>({action:'deny'}));contents.on('will-attach-webview',event=>event.preventDefault());
    for(const event of ['will-navigate','will-redirect'])contents.on(event,(action,url)=>{if(url!==STARTUP_ENTRY)action.preventDefault();});
    for(const event of ['maximize','unmaximize'])window.on(event,()=>{if(!disposed&&window&&!window.isDestroyed()&&contents.getURL()===STARTUP_ENTRY)contents.send('startup-update:window-state',windowState());});
    // 최대화는 창을 보일 때만 한다(숨은 채 시작을 지키려고 앱 창이 최대화를 미루는 것과 같다)
    window.once('ready-to-show',()=>{
      if(!window||window.isDestroyed())return;
      if(fade)window.setOpacity?.(0);
      if(at.maximized)window.maximize();
      if(inactive)window.showInactive();else{window.show();window.focus();}
      publish(gate.snapshot());
      if(fade){const started=Date.now(),step=()=>{if(disposed||!window||window.isDestroyed())return;const k=Math.min(1,(Date.now()-started)/FADE_MS);window.setOpacity?.(1-Math.pow(1-k,3));if(k<1)setTimer(step,16);else settleShown();};step();}
      else setTimer(settleShown,120);
    });
    window.on('close',()=>{if(!disposed)onClose();});
    void window.loadURL(STARTUP_ENTRY).then(()=>{
      if(disposed||asked)return;
      watchdog=setTimer(()=>{watchdog=null;if(!disposed&&!asked&&gate.isBlocking())onBridgeLost();},BRIDGE_WATCHDOG_MS);watchdog?.unref?.();
    }).catch(()=>{if(!disposed)onClose();});
  }
  function publish(value){if(disposed||!window||window.isDestroyed())return;window.setClosable(quitPrepared||value.state!=='installing');if(window.webContents.getURL()===STARTUP_ENTRY)window.webContents.send('startup-update:changed',{...value,boot:boot(),window:windowState()});}
  // Windows also honors closable=false during app.quit(). Unlock only when the
  // application begins normal quit so its existing draft guards can still run.
  function prepareForQuit(){quitPrepared=true;if(!disposed&&window&&!window.isDestroyed())window.setClosable(true);}
  function cancelQuit(){quitPrepared=false;publish(gate.snapshot());}
  /* 앱 창이 같은 자리에 숨은 채 만들어질 때 쓰는 자리. 사람이 시작 창을 옮겼으면 그 자리를 따른다 */
  function bounds(){if(!window||window.isDestroyed())return null;const b=window.getNormalBounds?.()||window.getBounds();return {...b,maximized:window.isMaximized?.()===true,visible:window.isVisible?.()!==false};}
  function isVisible(){return !!window&&!window.isDestroyed()&&window.isVisible?.()!==false;}
  function settleShown(){const waiters=shownWaiters;shownWaiters=[];for(const resolve of waiters)resolve(true);}
  /* 창이 보이고 첫 장을 그릴 시간이 지나면 풀린다(덮기를 마친 뒤). 이미 보이면 바로 풀린다 */
  function whenShown(){if(isVisible()&&window.getOpacity?.()!==0)return Promise.resolve(true);return new Promise(resolve=>shownWaiters.push(resolve));}
  /* 넘김 쪽지에 적을 창의 핸들(Buffer)과 창 */
  function nativeHandle(){try{return window&&!window.isDestroyed()?window.getNativeWindowHandle():null;}catch{return null;}}
  function browserWindow(){return window&&!window.isDestroyed()?window:null;}
  function dispose(){if(disposed)return;disposed=true;settleShown();clearTimer(watchdog);watchdog=null;if(registered)for(const action of Object.keys(actions))ipcMain.removeHandler('startup-update:'+action);registered=false;isolated.protocol.unhandle('synk-desktop');if(window&&!window.isDestroyed())window.destroy();}
  return {show,publish,prepareForQuit,cancelQuit,dispose,bounds,isVisible,whenShown,nativeHandle,browserWindow};
}
module.exports={STARTUP_ENTRY,STARTUP_ACTIONS,BRIDGE_WATCHDOG_MS,assertStartupSender,createStartupUpdateWindow};
