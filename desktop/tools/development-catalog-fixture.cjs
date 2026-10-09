'use strict';
// Test-only preload. No production account, token, API, browser, installer or app is used.
const {contextBridge}=require('electron');
const scenario=process.argv.find(value=>value.startsWith('--catalog-fixture='))?.slice(18)||'development';
const mode=scenario==='release'?'release':'development';
const listeners=new Set(),calls=[];
let auth={configured:true,status:'signed-out',signedIn:false,sessionGeneration:0};
if(scenario==='development-delayed')auth={configured:true,status:'signed-in',signedIn:true,sessionGeneration:1,account:{synk_user_id:'delayed-empty'},library:{status:'ready',appIds:[]}};
const observations={environmentResolvedAt:null,authStatusResolvedAt:null};
const clone=value=>JSON.parse(JSON.stringify(value));
const publish=value=>{auth=clone(value);for(const listener of listeners)listener(clone(auth));};
const clients=['world','messenger'].map(id=>({id,status:'installed',version:'synthetic-catalog',canLaunch:true,installer:{status:'idle'}}));
const blocked=operation=>async()=>{calls.push({operation,blocked:true});return {ok:false,code:'QA_OPERATION_DISABLED'};};
const fixedCall=(operation,ids)=>async id=>{if(!ids.includes(id))return {ok:false,code:'UNKNOWN_CLIENT'};calls.push({operation,id,synthetic:true});return {ok:true};};
contextBridge.exposeInMainWorld('synkDesktop',Object.freeze({
  getEnvironment:async()=>{observations.environmentResolvedAt=Date.now();return {clientId:'platform',nativeShell:true,platform:'win32',arch:'x64',version:'synthetic-catalog',mode,teacherPreviewAvailable:false,productPreviewsAvailable:[],publicAppsAvailable:['care','fortune','rehearsal']};},
  getClients:async()=>clone(clients),authStatus:async()=>{const snapshot=clone(auth);if(scenario==='development-delayed')await new Promise(resolve=>setTimeout(resolve,150));observations.authStatusResolvedAt=Date.now();return snapshot;},
  onAuthChanged:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},onClientsChanged:()=>()=>{},onClientProgress:()=>()=>{},
  launch:fixedCall('launch',['world','messenger']),openPublicApp:fixedCall('public-web',['care','fortune','rehearsal']),
  openTeacherPreview:blocked('teacher-preview'),openProductPreview:blocked('product-preview'),prepareClient:blocked('prepare'),openInstaller:blocked('install'),cancelPreparation:blocked('cancel'),authSignIn:blocked('login'),accountRequest:blocked('account-request'),
  authSignOut:async()=>{publish({configured:true,status:'signed-out',signedIn:false,sessionGeneration:auth.sessionGeneration+1});return {ok:true,serverRevoked:true,serverSessionRevoked:true};},
  getWindowState:async()=>({maximized:false,minimized:false,focused:false,platform:'win32'}),onWindowStateChanged:()=>()=>{},windowAction:blocked('window-action'),
}));
contextBridge.exposeInMainWorld('__synkCatalogFixture',Object.freeze({switchAccount:publish,calls:()=>clone(calls),snapshot:()=>clone(auth),observations:()=>clone(observations)}));
