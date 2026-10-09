'use strict';
// Hidden QA only. All identities, launches and account replies are synthetic.
const {contextBridge}=require('electron');
const listeners=new Set(),calls=[];
let auth={configured:true,status:'signed-in',signedIn:true,sessionGeneration:1,account:{synk_user_id:'journey-a'},library:{status:'ready',appIds:['care']}},launchOk=true,verifiedAuth=auth;
const clients=[{id:'world',status:'installed',version:'synthetic',canLaunch:true,installer:{status:'idle'}}];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const publish=snapshot=>{auth=snapshot;if(snapshot.signedIn&&snapshot.library?.status==='ready')verifiedAuth=snapshot;for(const callback of listeners)callback(auth);};
contextBridge.exposeInMainWorld('synkDesktop',Object.freeze({
  getEnvironment:async()=>{await wait(100);return {platform:'win32',arch:'x64',version:'synthetic',mode:'development',teacherPreviewAvailable:true,productPreviewsAvailable:['care']};},
  getClients:async()=>clients,authStatus:async()=>auth,
  onAuthChanged:callback=>{listeners.add(callback);return ()=>listeners.delete(callback);},onClientsChanged:()=>()=>{},
  launch:async id=>{calls.push('launch:'+id);await wait(90);return launchOk?{ok:true}:{ok:false,code:'LAUNCH_FAILED'};},
  openProductPreview:async id=>{calls.push('preview:'+id);await wait(90);return {ok:true};},
  openTeacherPreview:async()=>({ok:false}),
  accountRequest:async operation=>{calls.push('account:'+operation);publish({...verifiedAuth,library:{status:'ready',appIds:['world','care']}});return {ok:true};},
  authSignOut:async()=>{calls.push('logout');publish({configured:true,status:'signed-out',signedIn:false,sessionGeneration:auth.sessionGeneration+1});return {ok:true,serverRevoked:true};},
  windowAction:async action=>{calls.push('window:'+action);return {ok:true};},getWindowState:async()=>({maximized:false}),
}));
contextBridge.exposeInMainWorld('__journeyQA',Object.freeze({
  setAccount:publish,setLaunchResult:value=>{launchOk=value===true;},calls:()=>[...calls],
}));
