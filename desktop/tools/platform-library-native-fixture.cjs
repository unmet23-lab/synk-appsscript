'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const subscribe=(channel,callback)=>{const receive=(_event,value)=>callback(value);ipcRenderer.on(channel,receive);return ()=>ipcRenderer.removeListener(channel,receive);};
contextBridge.exposeInMainWorld('libraryQA',Object.freeze({
  authStatus:()=>ipcRenderer.invoke('qa:auth'),onAuthChanged:callback=>subscribe('qa:auth-changed',callback),
  accountRequest:(operation,params)=>ipcRenderer.invoke('qa:account',operation,params),
  draftRecoveryStatus:owner=>ipcRenderer.invoke('qa:recovery-status',owner),draftRecoveryLoad:(slot,owner)=>ipcRenderer.invoke('qa:recovery-load',slot,owner),
  draftRecoverySave:(slot,payload,owner)=>ipcRenderer.invoke('qa:recovery-save',slot,payload,owner),draftRecoveryClear:(slot,owner)=>ipcRenderer.invoke('qa:recovery-clear',slot,owner),
  onDraftRecoveryChanged:callback=>subscribe('qa:recovery-changed',callback)
}));
