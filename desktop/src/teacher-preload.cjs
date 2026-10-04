'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Only the teacher account entry receives this bridge. No token, company,
// launcher, filesystem or raw IPC capability enters the renderer.
contextBridge.exposeInMainWorld('synkTeacher',Object.freeze({
  getEnvironment:()=>ipcRenderer.invoke('synk-teacher:environment'),
  authStatus:()=>ipcRenderer.invoke('synk-teacher:auth-status'),
  authSignIn:()=>ipcRenderer.invoke('synk-teacher:auth-sign-in'),
  authCancelSignIn:()=>ipcRenderer.invoke('synk-teacher:auth-cancel'),
  authSignOut:()=>ipcRenderer.invoke('synk-teacher:auth-sign-out'),
  accountRequest:(operation,params={})=>ipcRenderer.invoke('synk-teacher:account-request',operation,params),
  onAuthChanged:callback=>{if(typeof callback!=='function')throw new TypeError('A callback is required');const listener=(_event,state)=>callback(state);ipcRenderer.on('synk-teacher:auth-changed',listener);return()=>ipcRenderer.removeListener('synk-teacher:auth-changed',listener);},
}));
