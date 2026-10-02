'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Fixed operations only. Tokens, raw IPC, paths, URLs and commands stay in main.
contextBridge.exposeInMainWorld('synkDesktop',Object.freeze({
  getEnvironment:()=>ipcRenderer.invoke('synk:environment'),
  getClients:()=>ipcRenderer.invoke('synk:clients'),
  openTeacherPreview:()=>ipcRenderer.invoke('synk:teacher-preview'),
  openProductPreview:id=>typeof id==='string'&&id==='path'?ipcRenderer.invoke('synk:product-preview',id):Promise.resolve({ok:false,code:'UNKNOWN_PREVIEW'}),
  prepareClient:id=>typeof id==='string'&&['world','messenger'].includes(id)?ipcRenderer.invoke('synk:prepare-client',id):Promise.resolve({ok:false,code:'UNKNOWN_CLIENT'}),
  cancelPreparation:id=>typeof id==='string'&&['world','messenger'].includes(id)?ipcRenderer.invoke('synk:cancel-preparation',id):Promise.resolve({ok:false,code:'UNKNOWN_CLIENT'}),
  openInstaller:id=>typeof id==='string'&&['world','messenger'].includes(id)?ipcRenderer.invoke('synk:open-installer',id):Promise.resolve({ok:false,code:'UNKNOWN_CLIENT'}),
  launch:id=>typeof id==='string'&&['platform','world','messenger'].includes(id)?ipcRenderer.invoke('synk:launch',id):Promise.resolve({ok:false,code:'UNKNOWN_CLIENT'}),
  getWindowState:()=>ipcRenderer.invoke('synk:window-state'),
  windowAction:action=>['minimize','toggle-maximize','close'].includes(action)?ipcRenderer.invoke('synk:window-action',action):Promise.resolve({ok:false,code:'INVALID_WINDOW_ACTION'}),
  authStatus:()=>ipcRenderer.invoke('synk:auth-status'),
  authSignIn:()=>ipcRenderer.invoke('synk:auth-sign-in'),
  authCancelSignIn:()=>ipcRenderer.invoke('synk:auth-cancel'),
  authSignOut:()=>ipcRenderer.invoke('synk:auth-sign-out'),
  accountRequest:(operation,params={})=>ipcRenderer.invoke('synk:account-request',operation,params),
  companyRequest:(operation,params={})=>ipcRenderer.invoke('synk:company-request',operation,params),
  onAuthChanged:callback=>{if(typeof callback!=='function')throw new TypeError('A callback is required');const listener=(_event,status)=>callback(status);ipcRenderer.on('synk:auth-changed',listener);return ()=>ipcRenderer.removeListener('synk:auth-changed',listener);},
  onClientsChanged:callback=>subscribe('synk:clients-changed',callback),
  onClientProgress:callback=>subscribe('synk:client-progress',callback),
  onWindowStateChanged:callback=>subscribe('synk:window-state-changed',callback),
}));
function subscribe(channel,callback){if(typeof callback!=='function')throw new TypeError('A callback is required');const listener=(_event,value)=>callback(value);ipcRenderer.on(channel,listener);return ()=>ipcRenderer.removeListener(channel,listener);}
