'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// This preview has no account token, product broker, launcher or filesystem bridge.
contextBridge.exposeInMainWorld('synkTeacher',Object.freeze({
  getEnvironment:()=>ipcRenderer.invoke('synk-teacher:environment'),
  authStatus:()=>ipcRenderer.invoke('synk-teacher:auth-status'),
}));
