'use strict';
// Synthetic IPC only. The native smoke host owns all accounts and records in
// memory, and blocks every external request before the renderer is loaded.
const {contextBridge,ipcRenderer}=require('electron');
const invoke=(operation,params)=>ipcRenderer.invoke('library-auto-qa:request',operation,params);
contextBridge.exposeInMainWorld('synkDesktop',Object.freeze({
  getEnvironment:async()=>({platform:'win32',arch:'x64',version:'synthetic-library-auto',mode:'development'}),
  getClients:async()=>[{id:'world',status:'installed',version:'synthetic',canLaunch:true,installer:{status:'idle'}}],
  authStatus:()=>invoke('authStatus'),
  onAuthChanged:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('library-auto-qa:auth',listener);return()=>ipcRenderer.removeListener('library-auto-qa:auth',listener);},
  onClientsChanged:()=>()=>{},accountRequest:(operation,params)=>invoke(operation,params),
  authSignIn:()=>invoke('OAuth'),authSignOut:()=>invoke('logout'),authSignUp:()=>invoke('signup'),
  launch:id=>invoke('launch',{id}),windowAction:action=>invoke('window:'+action),getWindowState:async()=>({maximized:false}),
}));
