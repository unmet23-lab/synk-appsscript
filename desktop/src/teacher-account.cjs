'use strict';
const {assertTeacherSender,teacherDocument,TEACHER}=require('./teacher-preview.cjs');
const {publicError}=require('./auth-service.cjs');
const ACCOUNT=new Set(['load','release','updateProfile','revokeSession','revokeAll','requestDeletion','exportPage']);
const CLASSROOM=new Set(['classes','teacherOverview','workspace','care','careSave','enrollmentInvite','assignments','assignmentUpdate','assignmentCancel','observations']);
function teacherAccountRequest(auth,operation,params={}){
  if(!ACCOUNT.has(operation)&&!(operation==='classroom'&&params&&CLASSROOM.has(params.operation)))
    return Promise.resolve({ok:false,error:{code:'INVALID_REQUEST',message:'교사 앱에서 지원하는 요청을 확인해 주세요.',retryable:false}});
  return auth.accountRequest(operation,params);
}
function bindTeacherIPC({ipcMain,getWindow,auth,entry=TEACHER.entry,environment}){
  const handlers={
    'synk-teacher:environment':()=>environment,
    'synk-teacher:auth-status':()=>auth.status(),
    'synk-teacher:auth-sign-in':()=>auth.signIn(),
    'synk-teacher:auth-cancel':()=>auth.cancel(),
    'synk-teacher:auth-sign-out':()=>auth.signOut(),
    'synk-teacher:account-request':(operation,params)=>teacherAccountRequest(auth,operation,params),
  };
  for(const [channel,handler]of Object.entries(handlers)){
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel,async(event,...args)=>{assertTeacherSender(event,getWindow(),entry);try{return await handler(...args);}catch(error){return{ok:false,error:publicError(error)};}});
  }
  return ()=>{for(const channel of Object.keys(handlers))ipcMain.removeHandler(channel);};
}
function sendTeacherAuth(window,state,entry=TEACHER.entry){if(window&&!window.isDestroyed()&&teacherDocument(window.webContents.getURL(),entry))window.webContents.send('synk-teacher:auth-changed',state);}
module.exports={teacherAccountRequest,bindTeacherIPC,sendTeacherAuth};
