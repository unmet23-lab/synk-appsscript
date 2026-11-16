'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Startup-only fixed operations. This window receives no account or app bridge.
// 모든 동작은 인자가 없다. 창 단추 셋(최소화, 최대화, 닫기)도 같다(1-가 구현 설계 2절).
const listen=(channel,callback)=>{
  if(typeof callback!=='function')throw new TypeError('A callback is required');
  const listener=(_event,value)=>callback(value);
  ipcRenderer.on(channel,listener);
  return ()=>ipcRenderer.removeListener(channel,listener);
};
contextBridge.exposeInMainWorld('synkStartupUpdate',Object.freeze({
  getStatus:()=>ipcRenderer.invoke('startup-update:status'),
  retry:()=>ipcRenderer.invoke('startup-update:retry'),
  openCurrent:()=>ipcRenderer.invoke('startup-update:open-current'),
  install:()=>ipcRenderer.invoke('startup-update:install'),
  minimize:()=>ipcRenderer.invoke('startup-update:minimize'),
  toggleMaximize:()=>ipcRenderer.invoke('startup-update:toggle-maximize'),
  close:()=>ipcRenderer.invoke('startup-update:close'),
  onChanged:callback=>listen('startup-update:changed',callback),
  onWindowState:callback=>listen('startup-update:window-state',callback),
}));
