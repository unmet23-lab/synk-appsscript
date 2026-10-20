export {startTeacherClient} from './teacher-session.mjs';

// Browser classroom credentials stay in the company's teacher-only BFF. This
// adapter exposes the same small contract as the native teacher broker.
export function createBrowserTeacherBridge({fetcher=fetch,navigate=url=>location.assign(url),windowObject=window,pollMs=30000}={}){
  let csrf='',closed=false,generation=0,identity=null,pending=null,timer=null,requestEpoch=0;
  const listeners=new Set();
  let current={configured:false,signedIn:false,status:'unconfigured',sessionGeneration:0};
  async function send(operation,body){
    if(closed)throw new Error('수업 연결이 끝났어요.');
    const response=await fetcher('/api/teaching/'+operation,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const result=await response.json();
    if(!response.ok||result?.ok===false)throw Object.assign(new Error(result?.error?.message||result?.error||'수업 연결을 확인하지 못했어요.'),{code:result?.error?.code||result?.code,status:response.status,retryable:response.status>=500});
    return result;
  }
  function update(result){
    if(closed)return current;
    csrf=result.csrfToken||csrf;
    const next=(result.signedIn||result.status==='restoring')&&result.account?.synk_user_id?result.account.synk_user_id+':'+(result.sessionGeneration??0):null;
    if(identity!==next){generation++;identity=next;}
    current={configured:result.configured===true,signedIn:result.signedIn===true&&Boolean(next),status:result.status||(next?'signed-in':result.configured?'signed-out':'unconfigured'),account:next?result.account:null,sessionGeneration:generation,canSignOut:result.canSignOut===true||Boolean(next),...(result.error?{error:result.error}:{})};
    for(const callback of listeners)callback(current);
    return current;
  }
  async function status(){
    if(pending)return pending;
    const expected=requestEpoch,task=send('status').then(result=>expected===requestEpoch?update(result):current).catch(error=>{
      if(closed||expected!==requestEpoch)return current;
      if(identity&&(error.retryable===true||!error.status)){
        // A transport failure cannot establish logout or replace the last verified
        // owner. Keep its generation, but suspend requests until verification returns.
        current={...current,signedIn:false,status:'restoring',canSignOut:true,error:{code:error.code||'NETWORK_ERROR',message:error.message,retryable:true}};
        for(const callback of listeners)callback(current);
        return current;
      }
      throw error;
    });pending=task;
    try{return await task;}finally{if(pending===task)pending=null;}
  }
  async function post(operation,body={}){if(!csrf)await status();return send(operation,body);}
  function check(){if(closed||windowObject.document?.hidden)return;void status().catch(error=>update({...current,signedIn:false,status:'error',error:{code:error.code||'NETWORK_ERROR',message:error.message,retryable:error.retryable===true}}));}
  windowObject.addEventListener('focus',check);
  return Object.freeze({
    getEnvironment:async()=>({clientId:'teacher',authProduct:'world',embedded:true,hostClientId:'messenger'}),
    authStatus:status,
    async authSignIn(){requestEpoch++;pending=null;const result=await post('start');navigate(result.authorizationUrl);return current;},
    async authCancelSignIn(){requestEpoch++;pending=null;await post('cancel');return status();},
    async authSignOut(){requestEpoch++;pending=null;const result=await post('logout');update({configured:current.configured,signedIn:false,status:'signed-out'});csrf='';await status();return result;},
    async accountRequest(operation,params={}){
      if(operation!=='classroom'||!['classes','teacherOverview','workspace','care','careSave','homework','homeworkSave','enrollmentInvite','assignments','assignmentUpdate','assignmentCancel','observations'].includes(params.operation))return {ok:false,error:{code:'INVALID_REQUEST',message:'지원하지 않는 수업 요청입니다.'}};
      try{return await post('request',params);}catch(error){return {ok:false,error:{code:error.code||'CLASSROOM_UNAVAILABLE',message:error.message,status:error.status,retryable:error.retryable===true}};}
    },
    onAuthChanged(callback){listeners.add(callback);if(!timer)timer=setInterval(check,pollMs);return()=>{listeners.delete(callback);if(!listeners.size){clearInterval(timer);timer=null;}};},
    dispose(){closed=true;requestEpoch++;pending=null;listeners.clear();clearInterval(timer);windowObject.removeEventListener('focus',check);},
  });
}
