import {publicUrl} from './core.mjs';
const routes=Object.freeze({classes:['/api/classes'],workspace:['/api/workspace'],account:['/api/world/account'],student:['/api/student'],practice:['/api/world/practice'],practiceSubmit:['/api/world/practice','POST'],submit:['/api/submissions','POST'],sharing:['/api/world/sharing','POST'],startRun:['/api/world/runs/start','POST'],stopRun:['/api/world/runs/stop','POST'],learningGet:['/api/world/learning'],learningPost:['/api/world/learning','POST'],townRead:['/api/world/town'],townCommand:['/api/world/town/command','POST'],assignments:['/api/assignments','POST'],assignmentUpdate:['/api/assignments/update','POST'],assignmentCancel:['/api/assignments/cancel','POST'],observations:['/api/observations','POST']});
const failure=(code,message,status)=>Object.assign(new Error(message),{code,status});
// Browser credentials stay at the account entry; games/teacher frames receive scoped methods.
export function createClassroomTransport({url,anonKey,getAccessToken,refresh,guard,product='world',fetcher=fetch,timeoutMs=12000}){
  const base=publicUrl(url);if(!['platform','world'].includes(product))throw new TypeError('Invalid classroom product');
  base.pathname=base.pathname.replace(/\/$/,'').replace(/\/functions\/v1(?:\/synk-(?:account|classroom))?$/,'')+'/functions/v1/synk-classroom';base.search='';base.hash='';
  return async(operation,{classId,query={},body}={}, {signal}={})=>{
    const route=routes[operation];if(!route||operation!=='classes'&&(typeof classId!=='string'||!classId))throw new TypeError('Invalid classroom request');
    const target=new URL(base);target.pathname+=route[0];if(classId)target.searchParams.set('classId',classId);
    for(const [key,value] of Object.entries(query)) {if(operation!=='learningGet'||!['after','revision'].includes(key))throw new TypeError('Invalid classroom query');target.searchParams.set(key,String(value));}
    if(body?.classId&&body.classId!==classId)throw new TypeError('Class scope mismatch');
    guard();const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,timeoutMs);
    try{
      for(let attempt=0;attempt<2;attempt++){
        guard();const token=await getAccessToken();guard();if(!token)throw failure('AUTH_REQUIRED','SYNK ID로 다시 로그인해 주세요.',401);
        const response=await fetcher(target.href,{method:route[1]||'GET',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{Authorization:`Bearer ${token}`,apikey:anonKey,'X-SYNK-Product':product,'X-SYNK-Contract':'1','X-SYNK-App-Version':'1.0.0',...(route[1]?{'Content-Type':'application/json'}:{})},...(route[1]?{body:JSON.stringify(body||{})}:{})});guard();
        if(response.status===401&&attempt===0&&refresh){await refresh();guard();continue;}
        let result;try{result=await response.json();}catch{throw failure('CLASSROOM_UNAVAILABLE','수업 연결 서비스가 아직 준비되지 않았거나 응답하지 않아요.',response.status);}guard();
        if(!response.ok||result?.ok===false)throw failure(result?.error?.code||result?.code||'CLASSROOM_UNAVAILABLE',result?.error?.message||'수업 연결을 확인하지 못했어요. 다시 불러와 주세요.',response.status);
        return result;
      }
    }catch(error){guard();if(error.name==='AbortError')throw failure('NETWORK_ERROR','수업 응답을 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.');throw error;}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  };
}
export function createClassroomClient({transport,classId,guard}){
  const call=(operation,body,options,query)=>{guard();return transport(operation,{classId,...(body===undefined?{}:{body}),...(query?{query}:{})},options).then(value=>{guard();return value;});};
  return Object.freeze({
    classes:()=>call('classes'),load:()=>call('account'),student:options=>call('student',undefined,options),practice:options=>call('practice',undefined,options),
    setSharing:(enabled,revision)=>call('sharing',{enabled,revision}),submit:body=>call('submit',body),practiceSubmit:body=>call('practiceSubmit',body),startRun:body=>call('startRun',body),stopRun:runId=>call('stopRun',{runId}),
    townRead:()=>call('townRead'),townCommand:body=>call('townCommand',body),
    learning:Object.freeze({get:({after,revision,signal})=>call('learningGet',undefined,{signal},{after,revision}),post:({revision,events,runId,signal})=>call('learningPost',{revision,events,...(runId?{runId}:{})},{signal})}),
    request(path,body){const entry=Object.entries(routes).find(([,r])=>r[0]===path&&(r[1]==='POST')===(body!==undefined));if(!entry||!['workspace','assignments','assignmentUpdate','assignmentCancel','observations'].includes(entry[0]))throw failure('FORBIDDEN','지원하지 않는 교사 요청입니다.',403);return call(entry[0],body);}
  });
}
