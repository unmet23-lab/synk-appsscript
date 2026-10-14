'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Startup-only fixed operations. This window receives no account or app bridge.
contextBridge.exposeInMainWorld('synkStartupUpdate',Object.freeze({
  getStatus:()=>ipcRenderer.invoke('startup-update:status'),
  retry:()=>ipcRenderer.invoke('startup-update:retry'),
  openCurrent:()=>ipcRenderer.invoke('startup-update:open-current'),
  install:()=>ipcRenderer.invoke('startup-update:install'),
  onChanged:callback=>{
    if(typeof callback!=='function')throw new TypeError('A callback is required');
    const listener=(_event,snapshot)=>callback(snapshot);
    ipcRenderer.on('startup-update:changed',listener);
    return ()=>ipcRenderer.removeListener('startup-update:changed',listener);
  },
}));
