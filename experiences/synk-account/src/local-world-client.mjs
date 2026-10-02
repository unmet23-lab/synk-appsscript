const failure=(code,message,status)=>Object.assign(new Error(message),{code,status});
export function createLocalWorldClient({getToken,guard,onUnauthorized=()=>{},onSharing=()=>{},fetcher=fetch,timeoutMs=12000}){
  async function request(path,body,{signal,authenticated=true}={}){
    guard();const token=getToken(),controller=new AbortController(),abort=()=>controller.abort();
    if(authenticated&&!token)throw failure('AUTH_REQUIRED','먼저 선생님에게 받은 연결 코드로 들어와 주세요.',401);
    if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,timeoutMs);
    try{
      const response=await fetcher(path,{method:body===undefined?'GET':'POST',cache:'no-store',credentials:'omit',signal:controller.signal,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(authenticated?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
      guard();const result=await response.json();guard();
      if(!response.ok||result?.ok===false){const code=result?.error?.code||result?.code||'REQUEST_FAILED';if(authenticated&&response.status===401)onUnauthorized(token);throw failure(code,result?.error?.message||result?.message||'연결을 확인하지 못했어요. 다시 시도해 주세요.',response.status);}
      return result;
    }catch(error){guard();if(error.name==='AbortError')throw failure('NETWORK_ERROR','응답을 기다리다 연결이 끊겼어요. 같은 제출을 다시 확인할 수 있어요.');throw error;}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  return Object.freeze({
    join:(code,consent)=>request('/api/join',{code,consent},{authenticated:false}),
    load:()=>request('/api/world/account'),
    setLearning:async(enabled,revision)=>{const result=await request('/api/world/sharing',{enabled,revision});guard();onSharing(result);return result;},
    learning:Object.freeze({get:({after,revision,signal})=>request(`/api/world/learning?after=${encodeURIComponent(after)}&revision=${encodeURIComponent(revision)}`,undefined,{signal}),post:({revision,events,runId,signal})=>request('/api/world/learning',{revision,events,...(runId?{runId}:{})},{signal})}),
    student:options=>request('/api/student',undefined,options),
    practice:options=>request('/api/world/practice',undefined,options),
    submit:payload=>request('/api/submissions',payload),
    practiceSubmit:payload=>request('/api/world/practice',payload),
    startRun:payload=>request('/api/world/runs/start',payload),
    stopRun:runId=>request('/api/world/runs/stop',{runId}),
    townRead:()=>request('/api/world/town'),
    townCommand:payload=>request('/api/world/town/command',payload),
    logout:()=>request('/api/logout',{}),
    // Local linking offers a current session only; it cannot revoke production SYNK ID sessions.
    revokeSession:()=>Promise.reject(failure('LOCAL_SCOPE','이 개발 연결은 현재 창에서 종료할 수 있어요.')),
    revokeAll:()=>Promise.reject(failure('LOCAL_SCOPE','정식 SYNK ID의 다른 기기 로그인은 이 개발 연결에서 종료하지 않아요.')),
    requestDeletion:()=>Promise.reject(failure('LOCAL_SCOPE','개발 연결에서는 정식 계정 삭제를 요청하지 않아요.')),
  });
}
