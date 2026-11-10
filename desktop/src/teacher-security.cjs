'use strict';
const {teacherNavigation,teacherResource,teacherFrame,teacherPolicy,TEACHER}=require('./teacher-preview.cjs');
// gate: local-server-owner.cjs — requests to the fixed local port wait until this OS user's program is found there.
function secureTeacherSession(ownSession,entry=TEACHER.entry,gate=null){
  ownSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  ownSession.setPermissionCheckHandler(()=>false);
  ownSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*','file://*/*']},(details,callback)=>{if(!teacherResource(details.url,entry)){callback({cancel:true});return;}if(gate)gate.decide(details.url,callback);else callback({});});
  ownSession.webRequest.onHeadersReceived((details,callback)=>callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':[teacherPolicy(details.resourceType)]}}));
  ownSession.removeAllListeners('will-download');ownSession.on('will-download',event=>event.preventDefault());
}
function secureTeacherWindow(window,entry=TEACHER.entry){
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  for(const name of ['will-navigate','will-redirect'])window.webContents.on(name,(event,url)=>{if(!teacherNavigation(url,entry))event.preventDefault();});
  window.webContents.on('will-frame-navigate',event=>{if(!(event.isMainFrame?teacherNavigation(event.url,entry):teacherFrame(event.url,entry)))event.preventDefault();});
}
module.exports={secureTeacherSession,secureTeacherWindow};
