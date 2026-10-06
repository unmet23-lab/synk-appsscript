'use strict';
const {assertProductSender,productDocument}=require('./product-preview.cjs');
const {publicError}=require('./auth-service.cjs');
const OPERATIONS=new Set(['load','careLoad','careSave','careDelete']);

// This broker owns only Care data. Account-wide deletion, learning, classroom,
// company and arbitrary HTTP operations are not renderer capabilities.
function careAccountRequest(auth,operation,params={}){
  if(!OPERATIONS.has(operation))return Promise.resolve({ok:false,error:{code:'INVALID_REQUEST',message:'플레저에서 지원하는 계정 요청을 확인해 주세요.',retryable:false}});
  return auth.accountRequest(operation,params);
}
function bindCareIPC({ipcMain,getWindow,auth}){
  const handlers={
    'synk-care:auth-status':()=>auth.status(),
    'synk-care:auth-sign-in':()=>auth.signIn(),
    'synk-care:auth-cancel':()=>auth.cancel(),
    'synk-care:auth-sign-out':()=>auth.signOut(),
    'synk-care:account-request':(operation,params)=>careAccountRequest(auth,operation,params),
  };
  for(const [channel,handler]of Object.entries(handlers)){
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel,async(event,...args)=>{
      assertProductSender(event,getWindow(),'care');
      try{return await handler(...args);}catch(error){return {ok:false,error:publicError(error)};}
    });
  }
  return ()=>{for(const channel of Object.keys(handlers))ipcMain.removeHandler(channel);};
}
function sendCareAuth(window,state){
  if(window&&!window.isDestroyed()&&productDocument('care',window.webContents.getURL()))window.webContents.send('synk-care:auth-changed',state);
}
module.exports={careAccountRequest,bindCareIPC,sendCareAuth};
