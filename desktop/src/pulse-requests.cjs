'use strict';
const {randomUUID}=require('node:crypto');

const ORIGIN='https://workspace.synk.im',ENTRY=ORIGIN+'/pulse/';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const INVITE=/^[A-Za-z0-9_-]{43}$/;
const MESSAGES={
  INVALID_REQUEST:'프로젝트 연결 요청을 확인해 주세요.',
  INVALID_INVITE:'담당자가 보낸 PULSE 초대 링크를 확인해 주세요.',
  AUTH_CHANGED:'계정 상태가 바뀌었어요. 프로젝트를 다시 연결해 주세요.',
  AUTH_PENDING:'로그인 상태를 확인한 뒤 프로젝트를 연결해 주세요.',
  NOT_CONNECTED:'담당자가 보낸 초대 링크로 프로젝트를 연결해 주세요.',
  PULSE_BUSY:'앞선 요청을 처리하고 있어요. 잠시 뒤 다시 시도해 주세요.',
  PULSE_UNAVAILABLE:'프로젝트 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  INVITE_EXPIRED:'고객 초대가 없거나 만료됐어요. 담당자에게 새 초대 링크를 요청해 주세요.',
  REVISION_CONFLICT:'프로젝트가 변경됐어요. 새로 불러온 뒤 다시 확인해 주세요.',
  PENDING_FEEDBACK:'이 시안에 남긴 수정 의견이 있어요. 수정본을 받은 뒤 승인해 주세요.',
  INVALID_RESPONSE:'프로젝트 응답을 확인하지 못했어요. 다시 연결해 주세요.',
};
const fault=(code,status)=>Object.assign(new Error(MESSAGES[code]||MESSAGES.PULSE_UNAVAILABLE),{code,status});
function scopeOf(account){
  const id=account?.account?.synk_user_id;
  if(account?.signedIn===true&&account.status==='signed-in'&&typeof id==='string'&&/^[a-zA-Z0-9_.-]{1,120}$/.test(id)&&id!=='anonymous-local')return 'account:'+id;
  if(account?.signedIn===false&&!account.error&&['signed-out','unconfigured'].includes(account.status))return 'guest';
  return null;
}
function parseInvite(value){
  if(typeof value!=='string'||value.length>2048)throw fault('INVALID_INVITE');
  const raw=value.trim();if(INVITE.test(raw))return raw;
  // An invitation is a capability. Do not accept lookalike hosts, redirects,
  // credentials, query tokens, percent-encoded paths or additional fragments.
  if(!raw.startsWith(ENTRY+'#invite='))throw fault('INVALID_INVITE');
  const token=raw.slice((ENTRY+'#invite=').length);
  if(!INVITE.test(token))throw fault('INVALID_INVITE');
  return token;
}
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function text(value,max=3000){return typeof value==='string'?value.slice(0,max):'';}
function publicProject(raw){
  if(!object(raw)||!UUID.test(raw.id)||!Number.isSafeInteger(raw.revision)||raw.revision<0||!Array.isArray(raw.versions)||raw.versions.length>100||!Array.isArray(raw.messages)||raw.messages.length>400)throw fault('INVALID_RESPONSE');
  const versions=raw.versions.map(value=>{
    if(!object(value)||!UUID.test(value.id)||!['preview','final'].includes(value.kind))throw fault('INVALID_RESPONSE');
    const out={id:value.id,label:text(value.label,120),kind:value.kind,url:text(value.url,2000),guide:text(value.guide),createdAt:text(value.createdAt,80),approvedAt:value.approvedAt?text(value.approvedAt,80):null};
    if(value.approvedPreviewId&&UUID.test(value.approvedPreviewId))out.approvedPreviewId=value.approvedPreviewId;
    if(value.media){
      if(!object(value.media)||!UUID.test(value.media.id)||!['video/mp4','video/webm','image/png','image/jpeg'].includes(value.media.mimeType)||!Number.isSafeInteger(value.media.byteSize)||value.media.byteSize<0||value.media.byteSize>100*1024*1024)throw fault('INVALID_RESPONSE');
      out.media={id:value.media.id,mimeType:value.media.mimeType,fileName:text(value.media.fileName,300),byteSize:value.media.byteSize,url:'/pulse/api/media/'+value.media.id};
    }
    return out;
  });
  const messages=raw.messages.filter(value=>object(value)&&value.visibility==='customer').map(value=>{
    if(!UUID.test(value.id)||!['staff','customer'].includes(value.author))throw fault('INVALID_RESPONSE');
    return {id:value.id,text:text(value.text),visibility:'customer',author:value.author,authorName:text(value.authorName,100),at:text(value.at,80),resolved:value.resolved===true,versionId:UUID.test(value.versionId)?value.versionId:null,seconds:typeof value.seconds==='number'&&Number.isFinite(value.seconds)&&value.seconds>=0&&value.seconds<=86400?value.seconds:null,...(['feedback','approve','support'].includes(value.action)?{action:value.action}:{}),...(value.resolvedAt?{resolvedAt:text(value.resolvedAt,80)}:{})};
  });
  return {id:raw.id,title:text(raw.title,160),customerName:text(raw.customerName,100),summary:text(raw.summary),terms:text(raw.terms),stage:text(raw.stage,30),stageLabel:text(raw.stageLabel,80),dueDate:text(raw.dueDate,10),nextStep:text(raw.nextStep,600),revision:raw.revision,updatedAt:text(raw.updatedAt,80),ownerName:text(raw.ownerName,100),versions,messages};
}

// The shared project stays on the existing company server. This broker owns
// its separate, memory-only Electron session; no SYNK ID token is requested.
function createPulseRequests({clientId,getAccount,createSession,createReviewWindow,timeoutMs=12000}){
  let owner,epoch=0,transport=null,project=null,csrf='',busy=false,reviewWindow=null,disposed=false;
  const controllers=new Set();
  function clearTransport(old){if(old)void Promise.resolve().then(()=>old.clearStorageData?.()).catch(()=>{});}
  function reset({clear=true}={}){
    ++epoch;for(const controller of controllers)controller.abort();controllers.clear();
    const old=transport;transport=null;project=null;csrf='';busy=false;
    if(reviewWindow&&!reviewWindow.isDestroyed?.())reviewWindow.destroy?.();reviewWindow=null;
    if(clear)clearTransport(old);return old;
  }
  function syncContext(account=getAccount?.()){
    const next=scopeOf(account);if(next!==owner){reset();owner=next;}return owner;
  }
  function check(expected,activeTransport){
    syncContext();if(disposed||expected!==epoch||activeTransport!==transport)throw fault('AUTH_CHANGED');
  }
  async function remote(activeTransport,path,body,requestCsrf,expected){
    const controller=new AbortController();controllers.add(controller);
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const headers={Origin:ORIGIN};if(body!==undefined){headers['Content-Type']='application/json';if(requestCsrf)headers['X-Pulse-CSRF']=requestCsrf;}
      const response=await activeTransport.fetch(ORIGIN+'/pulse/api/'+path,{method:body===undefined?'GET':'POST',headers,credentials:'include',redirect:'error',signal:controller.signal,...(body===undefined?{}:{body:JSON.stringify(body)})});
      if(expected!==undefined)check(expected,activeTransport);
      const raw=await response.text();if(raw.length>2*1024*1024)throw fault('INVALID_RESPONSE');
      if(expected!==undefined)check(expected,activeTransport);
      let data;try{data=JSON.parse(raw);}catch{throw fault('INVALID_RESPONSE');}
      if(!response.ok)throw fault(response.status===401?'INVITE_EXPIRED':response.status===409?'REVISION_CONFLICT':'PULSE_UNAVAILABLE',response.status);
      return data;
    }finally{clearTimeout(timer);controllers.delete(controller);}
  }
  function response(){return {ok:true,connected:!!project,...(project?{project:structuredClone(project)}:{})};}
  async function request(operation,params={}){
    let expected,activeTransport;
    try{
      if(clientId!=='platform'||disposed||!object(params)||typeof operation!=='string'||!Object.hasOwn({status:1,connect:1,refresh:1,action:1,disconnect:1,review:1},operation))throw fault('INVALID_REQUEST');
      const allowed=operation==='connect'?['invite']:operation==='action'?['action','versionId','revision','text','seconds']:[];
      if(Object.keys(params).some(key=>!allowed.includes(key)))throw fault('INVALID_REQUEST');
      syncContext();
      if(operation==='status')return response();
      if(operation==='disconnect'){
        const old=transport,oldCsrf=csrf,wasConnected=!!project;reset({clear:false});expected=epoch;
        let serverDisconnected=!wasConnected;
        try{if(old&&oldCsrf){await remote(old,'logout',{},oldCsrf);serverDisconnected=true;}}catch{}finally{clearTransport(old);}
        syncContext();if(expected!==epoch)throw fault('AUTH_CHANGED');
        return {ok:true,connected:false,serverDisconnected};
      }
      if(!owner)throw fault('AUTH_PENDING');
      if(busy)throw fault('PULSE_BUSY');
      if(operation==='connect'){
        const invite=parseInvite(params.invite);reset();
        transport=createSession('synk-pulse-'+randomUUID());expected=epoch;activeTransport=transport;busy=true;
        const data=await remote(activeTransport,'open',{invite},null,expected);
        if(typeof data.csrf!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(data.csrf))throw fault('INVALID_RESPONSE');
        const next=publicProject(data.project);check(expected,activeTransport);csrf=data.csrf;project=next;return response();
      }
      if(!project||!transport)throw fault('NOT_CONNECTED');
      expected=epoch;activeTransport=transport;
      if(operation==='review'){
        if(reviewWindow&&!reviewWindow.isDestroyed?.()){reviewWindow.show?.();reviewWindow.focus?.();return {ok:true,connected:true,opened:true};}
        busy=true;
        const opened=createReviewWindow({session:activeTransport,url:ENTRY});check(expected,activeTransport);reviewWindow=opened;
        opened.once?.('closed',()=>{if(reviewWindow===opened)reviewWindow=null;});
        // Keep the handle immediately so an account change can close a window
        // that is still loading. A failed load must not be reported as opened.
        await opened.pulseReady;check(expected,activeTransport);
        if(opened.isDestroyed?.())throw fault('PULSE_UNAVAILABLE');
        return {ok:true,connected:true,opened:true};
      }
      busy=true;
      if(operation==='refresh'){
        const data=await remote(activeTransport,'project',undefined,null,expected);
        if(typeof data.csrf!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(data.csrf))throw fault('INVALID_RESPONSE');
        const next=publicProject(data.project);check(expected,activeTransport);csrf=data.csrf;project=next;return response();
      }
      const {action,versionId,revision}=params;
      if(!['feedback','approve','support'].includes(action)||!Number.isSafeInteger(revision)||revision<0)throw fault('INVALID_REQUEST');
      if(revision!==project.revision)throw fault('REVISION_CONFLICT',409);
      const latest=project.versions.filter(version=>version.kind==='preview').at(-1);
      if(action!=='support'&&(!UUID.test(versionId)||versionId!==latest?.id||latest.approvedAt))throw fault('INVALID_REQUEST');
      if(action==='support'&&versionId!==undefined&&versionId!==null)throw fault('INVALID_REQUEST');
      if(action==='approve'&&project.messages.some(message=>message.author==='customer'&&message.action==='feedback'&&!message.resolved&&message.versionId===versionId))throw fault('PENDING_FEEDBACK',409);
      if(action!=='approve'&&(typeof params.text!=='string'||!params.text.trim()||params.text.length>3000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(params.text)))throw fault('INVALID_REQUEST');
      const seconds=params.seconds===undefined||params.seconds===null||params.seconds===''?null:params.seconds;
      if(seconds!==null&&(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<0||seconds>86400))throw fault('INVALID_REQUEST');
      const body={action,revision,versionId:action==='support'?null:versionId,...(action==='approve'?{}:{text:params.text.trim(),seconds})};
      const data=await remote(activeTransport,'action',body,csrf,expected);const next=publicProject(data.project);check(expected,activeTransport);project=next;return response();
    }catch(error){
      if(expected!==undefined&&(expected!==epoch||activeTransport&&activeTransport!==transport))return {ok:false,error:{code:'AUTH_CHANGED',message:MESSAGES.AUTH_CHANGED}};
      if(error.code==='INVITE_EXPIRED'||operation==='connect'&&activeTransport===transport)reset();
      const code=Object.hasOwn(MESSAGES,error.code)?error.code:'PULSE_UNAVAILABLE';
      return {ok:false,error:{code,message:MESSAGES[code],...(error.status?{status:error.status}:{})}};
    }finally{if(expected===epoch)busy=false;}
  }
  return {request,syncContext,dispose(){disposed=true;reset();}};
}
module.exports={createPulseRequests,parseInvite,scopeOf,publicProject,PULSE_ORIGIN:ORIGIN,PULSE_ENTRY:ENTRY};
