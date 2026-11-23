'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('solioEstimate',Object.freeze({
  snapshot:selectedIds=>ipcRenderer.invoke('synk:estimate-read',selectedIds),
  action:(name,input={})=>ipcRenderer.invoke('synk:estimate-action',name,input),
  onChanged:listener=>{
    if(typeof listener!=='function')return ()=>{};
    const change=()=>listener();
    ipcRenderer.on('synk:estimate-updated',change);
    return ()=>ipcRenderer.removeListener('synk:estimate-updated',change);
  },
}));
