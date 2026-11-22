'use strict';
const fs=require('node:fs'),path=require('node:path');
const {teacherAccountRequest}=require('./teacher-account.cjs');

/*
  창 안 Workspace 뷰의 「내 수업」 로그인(4단계 구현 설계 14.3). 회사 화면의 내 수업은 교사(teacher) 클라이언트의 토큰으로 수업 API를 부른다.
  따로 설치하던 Workspace 앱이 주던 이 연결(messenger-teacher.cjs)을 플랫폼이 Workspace 뷰에 준다.
  - 금고는 따로 하나다(userData/WorkspaceTeacher). 플랫폼 Suite 기록을 따라가 같은 SYNK ID로만 선다. Workspace 로그인(main.cjs ensureWorkspaceAuth)과 같다.
  - 로그인은 사람이 로그인을 누를 때나 이 PC에 저장된 교사 로그인이 있을 때만 시작한다. 회사 업무에서 로그아웃하면 회사 화면이 교사 상태를 묻고
    로그아웃한다(teaching.js logoutTeachingForCompany). 그때 따라가기를 켜면 시스템 브라우저가 로그인하러 뜬다. 그래서 그때는 켜지 않는다.
  - 수업 요청은 classroom 하나만, 따라가기를 켠 뒤에만 받는다.
*/
const SESSION_FILE='auth-session.enc'; // auth-store.cjs가 쓰는 금고 파일 이름
const NONE=Object.freeze({configured:false,signedIn:false,status:'unconfigured',sessionGeneration:0,account:null,error:null});
const IDLE=Object.freeze({configured:true,signedIn:false,status:'signed-out',sessionGeneration:0,account:null,error:null});
const NOT_SIGNED_IN=Object.freeze({ok:false,error:Object.freeze({code:'AUTH_REQUIRED',message:'내 수업에 먼저 로그인해 주세요.',retryable:false})});
const INVALID=Object.freeze({ok:false,error:Object.freeze({code:'INVALID_REQUEST',message:'내 수업에서 지원하는 수업 요청을 확인해 주세요.',retryable:false})});

function createWorkspaceTeacher({config,directory,scope,safeStorage,openExternal,appVersion,getDevice=()=>null,onChange=()=>{},suiteStore,createTokenStore,createAuthService,createSuiteFollower,exists=fs.existsSync}){
  let auth=null,follower=null,firstPass=null,disposed=false;
  const usable=()=>!disposed&&!!config&&!!suiteStore&&typeof directory==='string'&&directory.length>0;
  function make(){
    if(auth||!usable())return auth;
    const store=createTokenStore({directory,safeStorage,scope,configFingerprint:config.fingerprint});
    auth=createAuthService({config,store,openExternal,appVersion,device:getDevice(),onChange:state=>{if(!disposed)onChange(state);}});
    follower=createSuiteFollower({store:suiteStore,auth});
    return auth;
  }
  function saved(){try{return exists(path.join(directory,SESSION_FILE))===true;}catch{return false;}}
  // 따라가기를 켠다. 저장된 로그인을 되살리고, 플랫폼과 같은 SYNK ID가 아니면 시스템 브라우저로 한 번 로그인한다
  function start(){if(!make())return null;if(!firstPass)firstPass=Promise.resolve(follower.start()).catch(()=>{});return auth;}
  return Object.freeze({
    environment:()=>({clientId:'teacher',authProduct:'world',embedded:true,hostClientId:'platform'}),
    status(){
      if(!usable())return NONE;
      if(!firstPass&&!saved())return IDLE;
      return start().status();
    },
    async signIn(){
      const service=start();if(!service)return NONE;
      await firstPass;if(disposed)return NONE;
      const now=service.status();
      if(now.signedIn||now.status==='signing-in'||now.status==='restoring')return now;
      await service.signIn();return service.status();
    },
    async cancelSignIn(){if(!firstPass||!auth)return this.status();return auth.cancel();},
    // 켜지 않은 채 로그아웃하면 저장된 로그인만 되살려 끊는다. 따라가기는 켜지 않는다(켜면 바로 다시 로그인한다)
    async signOut(){
      if(!usable())return {ok:true,status:NONE};
      if(!firstPass){if(!saved())return {ok:true,status:IDLE};const service=make();await service.initialize();if(disposed)return {ok:false,status:NONE};}
      return auth.signOut();
    },
    async accountRequest(operation,params){
      if(operation!=='classroom'||!params||typeof params!=='object'||Array.isArray(params))return INVALID;
      if(!firstPass||!auth)return NOT_SIGNED_IN;
      return teacherAccountRequest(auth,operation,params);
    },
    started:()=>!!firstPass,
    dispose(){disposed=true;follower?.dispose();auth?.dispose();},
  });
}
module.exports={createWorkspaceTeacher,WORKSPACE_TEACHER_SESSION_FILE:SESSION_FILE};
