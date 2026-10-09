import {createDesktopClassroomClient,authMessage} from './desktop-account.mjs';
import {createTeacherWorkspace} from './teacher-workspace.mjs';

export async function startTeacherClient({bridge,documentObject=document,windowObject=window,locationHref=location.href,workspaceFactory=createTeacherWorkspace}){
  const $=id=>documentObject.getElementById(id),notice=(text,error=false)=>{$('notice').textContent=text;$('notice').className=`notice${error?' error':''}`;};
  if(typeof bridge?.authStatus!=='function'){
    $('setup').hidden=false;notice('싱크 워크스페이스의 내 수업에서 열면 SYNK ID로 연결할 수 있어요.');return {stop(){}};
  }
  const env=await bridge.getEnvironment();
  if(env.clientId!=='teacher'||env.authProduct!=='world')throw new Error('워크스페이스의 교사 로그인 입구에서 다시 열어 주세요.');
  let stopped=false,epoch=0,revision=0,action=0,identity=null,sessionGeneration=null,workspace=null,unsubscribe,exiting=false,logoutError=false;
  function clear(){epoch++;workspace?.stop();workspace=null;identity=null;sessionGeneration=null;$('teacher-workspace').replaceChildren();$('teacher-workspace').hidden=true;$('sign-out').hidden=true;$('teacher-intro').hidden=false;}
  const report=error=>{if(!stopped)notice(error.message||'계정 연결을 다시 확인해 주세요.',true);};
  async function show(state){
    if(stopped)return;const request=++revision;
    if(exiting)return;
    $('setup').hidden=!!state.configured;$('connect').hidden=!state.configured||state.signedIn;$('connect').disabled=['restoring','signing-in'].includes(state.status);$('connect').textContent=$('connect').disabled?'로그인 확인 중…':'SYNK ID로 로그인';$('cancel-connect').hidden=state.status!=='signing-in';notice(state.configured?authMessage(state):'교사 앱의 SYNK ID 연결 설정을 준비하고 있어요.',!!state.error);
    if(!logoutError&&state.status==='restoring'&&workspace&&identity&&Number.isSafeInteger(state.sessionGeneration)&&state.sessionGeneration===sessionGeneration&&(!state.account?.synk_user_id||identity===`${state.account.synk_user_id}:${state.sessionGeneration}`)){$('connect').hidden=true;$('sign-out').hidden=false;return;}
    if(!state.signedIn||!state.account?.synk_user_id){clear();$('sign-out').hidden=state.canSignOut!==true;return;}
    if(logoutError){clear();$('sign-out').hidden=false;$('connect').hidden=true;notice('로그아웃을 확인하지 못했어요. 다시 로그아웃해 주세요.',true);return;}
    const key=`${state.account.synk_user_id}:${state.sessionGeneration??0}`;
    if(identity===key&&workspace)return;
    clear();identity=key;sessionGeneration=state.sessionGeneration??null;const version=epoch;
    const guard=()=>{if(stopped||version!==epoch||!identity)throw Object.assign(new Error('로그인 계정이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});};
    const transport=createDesktopClassroomClient({bridge,product:'world',guard});
    workspace=workspaceFactory({root:$('teacher-workspace'),transport,guard,notice,documentObject,windowObject,locationHref});
    $('sign-out').hidden=false;$('teacher-intro').hidden=true;$('connect').hidden=true;
    try{await workspace.load();guard();if(request===revision)notice('SYNK ID로 연결했어요. 담당 수업에서 이어서 준비하세요.');}
    catch(error){if(version===epoch)report(error);}
  }
  async function authAction(method){const version=++action,before=revision;try{const state=await bridge[method]();if(!stopped&&version===action&&before===revision)await show(state);}catch(error){if(!stopped&&version===action){report(error);$('connect').disabled=false;}}}
  $('connect').onclick=()=>{$('connect').disabled=true;return authAction('authSignIn');};
  $('cancel-connect').onclick=()=>authAction('authCancelSignIn');
  $('sign-out').onclick=async()=>{
    // Close every scoped renderer before a network attempt. A delayed reply must
    // never restore another account's classroom or hide an unsuccessful logout.
    const version=++action;exiting=true;logoutError=false;clear();$('connect').hidden=true;$('sign-out').disabled=true;
    try{const result=await bridge.authSignOut();if(stopped||version!==action)return;const latest=await bridge.authStatus();if(stopped||version!==action)return;exiting=false;logoutError=!!latest.signedIn;await show(latest);
      if(!latest.signedIn)notice(result.message||(!result.ok?'기기 로그인을 지우지 못했어요. 다시 시도해 주세요.':result.serverRevoked===false?'이 앱에서 로그아웃했어요. 서버의 로그인 종료는 연결 후 다시 확인해 주세요.':'이 앱에서 로그아웃했어요.'),!result.ok||result.serverRevoked===false);
    }catch(error){if(!stopped&&version===action){exiting=false;logoutError=true;report(error);$('sign-out').hidden=false;$('connect').hidden=true;}}finally{if(!stopped)$('sign-out').disabled=false;}
  };
  unsubscribe=bridge.onAuthChanged(state=>{void show(state).catch(report);});
  const stop=()=>{if(stopped)return;stopped=true;revision++;action++;clear();unsubscribe?.();windowObject.removeEventListener('pagehide',stop);};
  windowObject.addEventListener('pagehide',stop);
  const initialRevision=revision,initial=await bridge.authStatus();if(initialRevision===revision)await show(initial);
  return Object.freeze({stop});
}
