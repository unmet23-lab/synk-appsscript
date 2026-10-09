'use strict';
// Test-only native bridge. Accounts and CAS storage exist only in this isolated
// preload's memory; no token, user profile or remote endpoint is accessed.
const {contextBridge}=require('electron');
const listeners=new Set(),calls=[],records=new Map();
const clone=value=>JSON.parse(JSON.stringify(value));
const empty=()=>({version:1,consent:true,favorites:[],recent:[],rememberRecent:true,notes:[]});
for(const owner of ['exit-a','exit-b'])records.set(owner,{revision:1,state:empty()});
records.get('exit-a').state.notes.push({id:'existing-note',appId:'world',title:'이미 저장한 합성 메모',done:false,createdAt:1});
let auth={configured:true,status:'signed-in',signedIn:true,sessionGeneration:1,account:{synk_user_id:'exit-a'},library:{status:'ready',appIds:['world','care']}},saveGate=null;
const publish=value=>{auth=value;for(const listener of listeners)listener(clone(value));};
contextBridge.exposeInMainWorld('synkDesktop',Object.freeze({
  getEnvironment:async()=>({platform:'win32',arch:'x64',version:'synthetic-continuity-exit',mode:'development',teacherPreviewAvailable:true,productPreviewsAvailable:['care']}),
  getClients:async()=>[{id:'world',status:'installed',version:'synthetic',canLaunch:true,installer:{status:'idle'}}],
  authStatus:async()=>clone(auth),onAuthChanged:callback=>{listeners.add(callback);return()=>listeners.delete(callback);},onClientsChanged:()=>()=>{},
  launch:async id=>{calls.push({operation:'launch',id});return {ok:true};},openProductPreview:async()=>({ok:true}),
  accountRequest:async(operation,params={})=>{
    const owner=auth.account?.synk_user_id;calls.push({operation,owner,params:clone(params)});
    if(!auth.signedIn||!owner)return {ok:false,error:{code:'AUTH_REQUIRED'}};
    if(operation==='load')return {ok:true};
    if(!['platformLoad','platformSave','platformDelete'].includes(operation))return {ok:false,error:{code:'UNEXPECTED_TEST_OPERATION'}};
    if(operation==='platformSave'&&saveGate)await saveGate.promise;
    let row=records.get(owner)||{revision:0,state:null};
    if(operation!=='platformLoad'){
      if(params.expected_revision!==row.revision)return {ok:false,revision:row.revision,error:{code:'REVISION_CONFLICT'}};
      row={revision:row.revision+1,state:operation==='platformSave'?clone(params.state):null};records.set(owner,row);
    }
    return {ok:true,scope:'synk-personal',resource:'platform-library',accountId:owner,updatedAt:null,...clone(row)};
  },
  authSignOut:async()=>{calls.push({operation:'logout'});publish({configured:true,status:'signed-out',signedIn:false,sessionGeneration:auth.sessionGeneration+1});return {ok:true,serverRevoked:true};},
  windowAction:async action=>{calls.push({operation:'window:'+action});return {ok:true};},getWindowState:async()=>({maximized:false}),
}));
contextBridge.exposeInMainWorld('__continuityExitQA',Object.freeze({
  setAccount:publish,calls:()=>clone(calls),record:owner=>clone(records.get(owner)),
  holdSave:()=>{if(saveGate)throw Error('Save already held');let resolve;const promise=new Promise(done=>{resolve=done;});saveGate={promise,resolve};},
  releaseSave:()=>{if(saveGate){const gate=saveGate;saveGate=null;gate.resolve();}},
}));
