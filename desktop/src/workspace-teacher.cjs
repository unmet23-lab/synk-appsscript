'use strict';
const fs=require('node:fs'),path=require('node:path');
const {teacherAccountRequest}=require('./teacher-account.cjs');

/*
  창 안 Workspace 뷰의 「내 수업」 로그인(4단계 구현 설계 14.3). 회사 화면의 내 수업은 교사(teacher) 클라이언트의 토큰으로 수업 API를 부른다.
  따로 설치하던 Workspace 앱이 주던 이 연결(messenger-teacher.cjs)을 플랫폼이 Workspace 뷰에 준다.
  - 금고는 따로 하나다(userData/WorkspaceTeacher). 플랫폼 Suite 기록을 따라가 같은 SYNK ID로만 선다. Workspace 로그인(main.cjs ensureWorkspaceAuth)과 같다.
  - 따라가기는 저장된 교사 로그인을 되살리고, 플랫폼 계정이 바뀌거나 로그아웃하면 교사 로그인을 끊는다.
  - 시스템 브라우저 로그인은 사람이 내 수업에서 로그인을 누른 직후 한 번만 연다(표 한 장). 따라가기가 혼자서는 브라우저를 열지 않는다.
    회사 업무 로그아웃이 교사 상태를 묻고 로그아웃할 때(teaching.js logoutTeachingForCompany), 내 수업에서 로그아웃한 뒤 플랫폼에 다시 로그인할 때
    브라우저가 뜻밖에 뜨지 않게 한다(GPT pc-retire-workspace-20261123 GA2 · GA3).
  - 교사 로그인의 SYNK ID가 지금 플랫폼 계정과 다르면 보이지도 쓰이지도 않는다. 상태를 묻거나 요청하거나 로그인을 누를 때마다 Suite 기록을
    다시 읽어(500ms 감시를 기다리지 않고) 따라가기가 앞 계정의 로그인을 바로 끊게 한다(같은 검수 GA1).
  - 수업 요청은 classroom 하나만 받는다.
*/
const SESSION_FILE='auth-session.enc'; // auth-store.cjs가 쓰는 금고 파일 이름
const NONE=Object.freeze({configured:false,signedIn:false,status:'unconfigured',sessionGeneration:0,account:null,error:null});
const IDLE=Object.freeze({configured:true,signedIn:false,status:'signed-out',sessionGeneration:0,account:null,error:null});
const NOT_SIGNED_IN=Object.freeze({ok:false,error:Object.freeze({code:'AUTH_REQUIRED',message:'내 수업에 먼저 로그인해 주세요.',retryable:false})});
const CHANGED=Object.freeze({ok:false,error:Object.freeze({code:'AUTH_CHANGED',message:'로그인한 계정이 바뀌었어요. 내 수업을 다시 열어 주세요.',retryable:false})});
const INVALID=Object.freeze({ok:false,error:Object.freeze({code:'INVALID_REQUEST',message:'내 수업에서 지원하는 수업 요청을 확인해 주세요.',retryable:false})});

function createWorkspaceTeacher({config,directory,scope,safeStorage,openExternal,appVersion,getDevice=()=>null,getPlatformAccount=()=>null,onChange=()=>{},suiteStore,createTokenStore,createAuthService,createSuiteFollower,exists=fs.existsSync}){
  let auth=null,follower=null,firstPass=null,disposed=false,ticket=false;
  const usable=()=>!disposed&&!!config&&!!suiteStore&&typeof directory==='string'&&directory.length>0;
  const platformAccount=()=>{try{const id=getPlatformAccount();return typeof id==='string'&&id?id:null;}catch{return null;}};
  // 교사 로그인이 지금 플랫폼 계정의 것인지. 아니면 그 로그인은 없는 것으로 본다
  function owned(state){return !!state?.signedIn&&!!state.account?.synk_user_id&&state.account.synk_user_id===platformAccount();}
  function view(state){return !state?.signedIn||owned(state)?state:{...state,signedIn:false,status:'restoring',account:null};}
  // 따라가기에 주는 로그인. 다른 일은 그대로 넘기고, 브라우저 로그인만 사람이 준 표가 있을 때 한 번 연다
  function followed(service){
    return {bindPlatform:next=>service.bindPlatform(next),initialize:()=>service.initialize(),status:()=>service.status(),signOut:()=>service.signOut(),getAccessToken:()=>service.getAccessToken(),
      signIn:async()=>{if(!ticket)return service.status();ticket=false;return service.signIn();}};
  }
  function make(){
    if(auth||!usable())return auth;
    const store=createTokenStore({directory,safeStorage,scope,configFingerprint:config.fingerprint});
    auth=createAuthService({config,store,openExternal,appVersion,device:getDevice(),onChange:state=>{if(!disposed)onChange(view(state));}});
    follower=createSuiteFollower({store:suiteStore,auth:followed(auth)});
    return auth;
  }
  function saved(){try{return exists(path.join(directory,SESSION_FILE))===true;}catch{return false;}}
  // 따라가기를 켠다. 저장된 로그인을 되살리고, 플랫폼과 같은 SYNK ID가 아니면 끊는다
  function start(){if(!make())return null;if(!firstPass)firstPass=Promise.resolve(follower.start()).catch(()=>{});return auth;}
  // Suite 기록을 지금 다시 읽는다. 바뀐 것이 없으면 따라가기가 바로 돌아온다
  function follow(){if(!firstPass||!follower||disposed)return Promise.resolve();try{return Promise.resolve(follower.refresh()).catch(()=>{});}catch{return Promise.resolve();}}
  return Object.freeze({
    environment:()=>({clientId:'teacher',authProduct:'world',embedded:true,hostClientId:'platform'}),
    status(){
      if(!usable())return NONE;
      if(!firstPass&&!saved())return IDLE;
      const service=start();void follow();return view(service.status());
    },
    // 사람이 누른 로그인. 따라가기의 첫 차례를 기다린 뒤에도 이 계정으로 서지 않았으면 브라우저로 한 번 로그인한다
    async signIn(){
      const service=start();if(!service)return NONE;
      ticket=true;
      await firstPass;await follow();if(disposed){ticket=false;return NONE;}
      const now=service.status();
      if(owned(now)||now.status==='signing-in'||now.status==='restoring'){ticket=false;return view(now);}
      ticket=false;await service.signIn();return view(service.status());
    },
    async cancelSignIn(){ticket=false;if(!firstPass||!auth)return this.status();return view(await auth.cancel());},
    // 켜지 않은 채 로그아웃하면 저장된 로그인만 되살려 끊는다. 따라가기는 켜지 않는다
    async signOut(){
      ticket=false;
      if(!usable())return {ok:true,status:NONE};
      if(!firstPass){if(!saved())return {ok:true,status:IDLE};const service=make();await service.initialize();if(disposed)return {ok:false,status:NONE};}
      return auth.signOut();
    },
    async accountRequest(operation,params){
      if(operation!=='classroom'||!params||typeof params!=='object'||Array.isArray(params))return INVALID;
      if(!firstPass||!auth)return NOT_SIGNED_IN;
      void follow();const now=auth.status();if(!now.signedIn)return NOT_SIGNED_IN;if(!owned(now))return CHANGED;
      return teacherAccountRequest(auth,operation,params);
    },
    started:()=>!!firstPass,
    dispose(){disposed=true;ticket=false;follower?.dispose();auth?.dispose();},
  });
}
module.exports={createWorkspaceTeacher,WORKSPACE_TEACHER_SESSION_FILE:SESSION_FILE};
