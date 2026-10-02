'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Preview metadata and a fixed PATH browser destination only. No tokens or platform operations.
contextBridge.exposeInMainWorld('synkProduct',Object.freeze({
  getEnvironment:()=>ipcRenderer.invoke('synk-product:environment'),
  authStatus:()=>ipcRenderer.invoke('synk-product:auth-status'),
  openInBrowser:()=>ipcRenderer.invoke('synk-product:open-browser'),
}));
