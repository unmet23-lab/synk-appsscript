'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Only the isolated Care preview receives this preload. PKCE and access/refresh
// credentials stay in the shared auth service in main and the OS-backed vault.
contextBridge.exposeInMainWorld('synkProduct',Object.freeze({
  getEnvironment:()=>ipcRenderer.invoke('synk-product:environment'),
  openInBrowser:()=>ipcRenderer.invoke('synk-product:open-browser'),
  authStatus:()=>ipcRenderer.invoke('synk-care:auth-status'),
  authSignIn:()=>ipcRenderer.invoke('synk-care:auth-sign-in'),
  authCancelSignIn:()=>ipcRenderer.invoke('synk-care:auth-cancel'),
  authSignOut:()=>ipcRenderer.invoke('synk-care:auth-sign-out'),
  accountRequest:(operation,params={})=>ipcRenderer.invoke('synk-care:account-request',operation,params),
  onAuthChanged:callback=>{if(typeof callback!=='function')throw new TypeError('A callback is required');const listener=(_event,state)=>callback(state);ipcRenderer.on('synk-care:auth-changed',listener);return()=>ipcRenderer.removeListener('synk-care:auth-changed',listener);},
}));
