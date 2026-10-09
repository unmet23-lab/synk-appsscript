'use strict';
const {assertSender,trustedEntry}=require('./security.cjs');
const {teacherAccountRequest}=require('./teacher-account.cjs');
const {publicError}=require('./auth-service.cjs');

// Messenger owns the window, while the teacher OAuth client owns this vault and
// API broker. Company cookies and Messenger bearer tokens never enter it.
function createMessengerTeacherService({config,directory,scope,safeStorage,openExternal,appVersion,onChange=()=>{},suiteStore,createTokenStore,createAuthService,createSuiteFollower}){
  const store=createTokenStore({directory,safeStorage,scope,configFingerprint:config?.fingerprint||'unconfigured'});
  const auth=createAuthService({config,store,openExternal,appVersion,onChange});
  const follower=suiteStore?createSuiteFollower({store:suiteStore,auth}):null;
  return Object.freeze({
    initialize:()=>follower?follower.start():auth.initialize(),
    authStatus:()=>auth.status(),authSignIn:()=>auth.signIn(),authCancelSignIn:()=>auth.cancel(),authSignOut:()=>auth.signOut(),
    accountRequest:(operation,params={})=>operation==='classroom'?teacherAccountRequest(auth,operation,params):Promise.resolve({ok:false,error:{code:'INVALID_REQUEST',message:'내 수업에서 지원하는 수업 요청을 확인해 주세요.',retryable:false}}),
    dispose(){follower?.dispose();auth.dispose();},
  });
}

function assertMessengerTeacherSender(event,window,entry,clientId){
  if(clientId!=='messenger'||new URL(entry).pathname!=='/')throw Error('UNTRUSTED_SENDER');
  assertSender(event,window,entry,clientId);
  if(new URL(event.senderFrame.url).pathname!=='/')throw Error('UNTRUSTED_SENDER');
}
function bindMessengerTeacherIPC({ipcMain,getWindow,service,entry,clientId,environment={}}){
  if(clientId!=='messenger')return ()=>{};
  const handlers={
    'synk:teacher-environment':()=>({...environment,clientId:'teacher',authProduct:'world',embedded:true,hostClientId:'messenger'}),
    'synk:teacher-auth-status':()=>service.authStatus(),
    'synk:teacher-auth-sign-in':()=>service.authSignIn(),
    'synk:teacher-auth-cancel':()=>service.authCancelSignIn(),
    'synk:teacher-auth-sign-out':()=>service.authSignOut(),
    'synk:teacher-account-request':(operation,params)=>service.accountRequest(operation,params),
  };
  for(const [channel,handler]of Object.entries(handlers)){
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel,async(event,...args)=>{
      assertMessengerTeacherSender(event,getWindow(),entry,clientId);
      try{return await handler(...args);}catch(error){return {ok:false,error:publicError(error)};}
    });
  }
  return ()=>{for(const channel of Object.keys(handlers))ipcMain.removeHandler(channel);};
}
function sendMessengerTeacherAuth(window,state,entry,clientId){
  if(clientId==='messenger'&&window&&!window.isDestroyed()&&new URL(entry).pathname==='/'&&trustedEntry(window.webContents.getURL(),entry,clientId))window.webContents.send('synk:teacher-auth-changed',state);
}
function messengerViewEntry(entry,clientId,argv=[]){
  if(clientId!=='messenger'||!Array.isArray(argv)||!argv.includes('--view=teaching'))return entry;
  const url=new URL(entry);if(url.pathname!=='/'||url.username||url.password)return entry;
  url.search='';url.searchParams.set('tab','teaching');url.hash='';return url.href;
}
module.exports={createMessengerTeacherService,assertMessengerTeacherSender,bindMessengerTeacherIPC,sendMessengerTeacherAuth,messengerViewEntry};
