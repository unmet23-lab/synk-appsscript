'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const subscribe=(channel,callback)=>{const listener=(_event,value)=>callback(value);ipcRenderer.on(channel,listener);return ()=>ipcRenderer.removeListener(channel,listener);};
const denied=async()=>({ok:false,code:'QA_DISABLED'});
contextBridge.exposeInMainWorld('synkDesktop',Object.freeze({
  getEnvironment:async()=>({platform:'win32',arch:'x64',version:'synthetic',mode:'development'}),
  getClients:async()=>[],authStatus:()=>ipcRenderer.invoke('qa:auth'),onAuthChanged:callback=>subscribe('qa:auth-changed',callback),onClientsChanged:()=>()=>{},onClientProgress:()=>()=>{},
  launch:denied,authSignIn:denied,authSignOut:denied,prepareClient:denied,openInstaller:denied,cancelPreparation:denied,
  draftRecoveryStatus:owner=>ipcRenderer.invoke('qa:draft-status',owner),setDraftRecoveryEnabled:(enabled,owner)=>ipcRenderer.invoke('qa:draft-enabled',enabled,owner),
  draftRecoveryLoad:(slot,owner)=>ipcRenderer.invoke('qa:draft-load',slot,owner),draftRecoverySave:(slot,payload,owner)=>ipcRenderer.invoke('qa:draft-save',slot,payload,owner),draftRecoveryClear:(slot,owner)=>ipcRenderer.invoke('qa:draft-clear',slot,owner),
  onDraftRecoveryChanged:callback=>subscribe('qa:draft-changed',callback),
}));
contextBridge.exposeInMainWorld('__convenienceHomeQA',Object.freeze({switchAccount:account=>ipcRenderer.invoke('qa:switch',account)}));
