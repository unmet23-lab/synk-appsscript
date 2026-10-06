'use strict';
// Test-only preload for hidden renderer QA. Production never loads this file.
// It exposes synthetic snapshots, never tokens, real account calls or app launch.
const {contextBridge,ipcRenderer}=require('electron');
let auth={configured:true,status:'signed-out',signedIn:false,sessionGeneration:0};
const listeners=new Set(),clientListeners=new Set(),calls=[];
const clients=[{id:'world',status:'installed',version:'synthetic',canLaunch:true,installer:{status:'idle'}},{id:'messenger',status:'installed',version:'synthetic',canLaunch:true,installer:{status:'idle'}}];
const denied=operation=>async()=>{calls.push(operation);return {ok:false,code:'QA_OPERATION_DISABLED'};};
contextBridge.exposeInMainWorld('synkDesktop',Object.freeze({
  getEnvironment:async()=>({platform:'win32',arch:'x64',version:'synthetic',mode:'development',teacherPreviewAvailable:true,productPreviewsAvailable:['path','care','fortune','rehearsal','family-album']}),
  getClients:async()=>clients,authStatus:async()=>auth,
  onAuthChanged:callback=>{listeners.add(callback);return ()=>listeners.delete(callback);},onClientsChanged:callback=>{clientListeners.add(callback);return ()=>clientListeners.delete(callback);},onClientProgress:()=>()=>{},
  openTeacherPreview:denied('teacher-preview'),openProductPreview:async id=>{calls.push('product-preview:'+id);return {ok:true};},launch:denied('launch'),prepareClient:denied('prepare'),openInstaller:denied('install'),cancelPreparation:denied('cancel'),authSignIn:denied('login'),
  authSignOut:async()=>{auth={configured:true,status:'signed-out',signedIn:false,sessionGeneration:auth.sessionGeneration+1};for(const callback of listeners)callback(auth);return {ok:true,serverRevoked:true,serverSessionRevoked:true};},
}));
contextBridge.exposeInMainWorld('__synkFixture',Object.freeze({
  switchAccount:snapshot=>{auth=snapshot;for(const callback of listeners)callback(auth);},
  setClients:snapshot=>{for(const callback of clientListeners)callback(snapshot);},calls:()=>[...calls],
}));
