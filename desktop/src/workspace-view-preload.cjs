'use strict';
// 플랫폼 창 안의 Workspace 뷰 preload(검정 구 4단계 구현 설계 3.3). contextIsolation과 sandbox 아래에서 돈다.
// Workspace 앱이 회사 화면에 주던 window.synkDesktop 가운데 회사 화면이 실제로 부르는 일곱 이름만 준다(synk-id.js의 native 연결).
// 통로는 이 뷰의 webContents.ipc에만 달려 있고(workspace-app.cjs bindNative), 본체가 보낸 프레임과 주소를 다시 확인한다.
// 회사 출처의 최상위 문서(/ 경로)에서만 내보인다. 같은 출처 iframe(메신저)이나 다른 문서에는 아무것도 주지 않는다.
const CHANNEL=Object.freeze({status:'synk:workspace-native-auth-status',changed:'synk:workspace-native-auth-changed',account:'synk:workspace-native-account-request',signIn:'synk:workspace-native-sign-in',cancel:'synk:workspace-native-sign-in-cancel',signOut:'synk:workspace-native-sign-out',company:'synk:workspace-native-company-request'});
const OPERATIONS=Object.freeze(['status','challenge','exchange','renew','logout']);

function workspaceTop(win){
  try{
    if(win.top!==win)return false;
    const url=new URL(win.location.href);
    return url.protocol==='https:'&&url.origin==='https://workspace.synk.im'&&url.pathname==='/'&&!url.username&&!url.password;
  }catch{return false;}
}
function plainParams(value){return value===undefined?{}:value&&typeof value==='object'&&!Array.isArray(value)?value:null;}

function installWorkspaceViewPreload({ipcRenderer,contextBridge,window:win}={}){
  if(!ipcRenderer||!contextBridge||!win||!workspaceTop(win))return null;
  const subscribe=callback=>{if(typeof callback!=='function')throw new TypeError('A callback is required');const listener=(_event,value)=>callback(value);ipcRenderer.on(CHANNEL.changed,listener);return ()=>ipcRenderer.removeListener(CHANNEL.changed,listener);};
  const api=Object.freeze({
    companyRequest:(operation,params)=>{const value=plainParams(params);return typeof operation==='string'&&OPERATIONS.includes(operation)&&value?ipcRenderer.invoke(CHANNEL.company,operation,value):Promise.resolve({ok:false,error:{code:'INVALID_REQUEST',message:'회사 요청을 처리하지 못했어요. 다시 해 주세요.'}});},
    authStatus:()=>ipcRenderer.invoke(CHANNEL.status),
    onAuthChanged:subscribe,
    accountRequest:operation=>operation==='load'?ipcRenderer.invoke(CHANNEL.account,'load'):Promise.resolve({ok:false,code:'INVALID_REQUEST'}),
    authSignIn:()=>ipcRenderer.invoke(CHANNEL.signIn),
    authCancelSignIn:()=>ipcRenderer.invoke(CHANNEL.cancel),
    authSignOut:()=>ipcRenderer.invoke(CHANNEL.signOut),
  });
  try{contextBridge.exposeInMainWorld('synkDesktop',api);}catch{return null;}
  return api;
}

(function(){
  let electron=null;
  try{electron=require('electron');}catch{electron=null;}
  if(!electron||typeof electron!=='object'||!electron.ipcRenderer)return;
  installWorkspaceViewPreload({ipcRenderer:electron.ipcRenderer,contextBridge:electron.contextBridge,window});
})();

if(typeof module==='object'&&module&&module.exports)module.exports={installWorkspaceViewPreload,CHANNEL};
