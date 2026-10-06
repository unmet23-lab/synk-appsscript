'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Preview metadata and a fixed browser destination. No tokens or platform operations.
contextBridge.exposeInMainWorld('synkProduct',Object.freeze({
  getEnvironment:()=>ipcRenderer.invoke('synk-product:environment'),
  authStatus:()=>ipcRenderer.invoke('synk-product:auth-status'),
  openInBrowser:()=>ipcRenderer.invoke('synk-product:open-browser'),
}));
// Main grants this bridge only to the isolated Fortune preview process. Every
// operation is checked again against its exact top-level document in main.
if(typeof process!=='undefined'&&process.argv.includes('--synk-fortune-account'))contextBridge.exposeInMainWorld('synkFortuneAccount',Object.freeze({
  authStatus:()=>ipcRenderer.invoke('synk-fortune:auth-status'),
  authSignIn:()=>ipcRenderer.invoke('synk-fortune:auth-sign-in'),
  authCancelSignIn:()=>ipcRenderer.invoke('synk-fortune:auth-cancel'),
  authSignOut:()=>ipcRenderer.invoke('synk-fortune:auth-sign-out'),
  request:(operation,params={})=>ipcRenderer.invoke('synk-fortune:request',operation,params),
  onAuthChanged:callback=>{if(typeof callback!=='function')throw new TypeError('A callback is required');const listener=(_event,state)=>callback(state);ipcRenderer.on('synk-fortune:auth-changed',listener);return()=>ipcRenderer.removeListener('synk-fortune:auth-changed',listener);},
}));
