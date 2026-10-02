'use strict';
const {redact}=require('./account-requests.cjs');
function createCompanyRequests({entry,clientId,session,auth}){
  return async function companyRequest(operation,params={}){
    const bad=()=>{throw Object.assign(new Error('회사 연결 요청을 확인해 주세요.'),{code:'INVALID_REQUEST'});};
    try{if(clientId!=='messenger'||!params||typeof params!=='object'||Array.isArray(params))bad();
      const allowed={status:[],challenge:['action','currentPassword','csrfToken','confirm'],exchange:['challenge','confirm'],renew:['csrfToken'],logout:['csrfToken']}[operation];if(!allowed||Object.keys(params).some(k=>!allowed.includes(k)))bad();
      const headers={Origin:new URL(entry).origin},body={};
      if(['challenge','renew','logout'].includes(operation)&&params.csrfToken!==undefined){if(typeof params.csrfToken!=='string'||params.csrfToken.length>2048||/[\r\n]/.test(params.csrfToken))bad();headers['X-CSRF-Token']=params.csrfToken;}
      if(operation==='challenge'){if(!['login','link','unlink'].includes(params.action))bad();body.action=params.action;if(params.confirm!==undefined)body.confirm=params.confirm===true;if(params.action!=='login'){if(typeof params.currentPassword!=='string'||!params.currentPassword||params.currentPassword.length>1024||!params.csrfToken||params.confirm!==true)bad();body.currentPassword=params.currentPassword;}}
      if(operation==='exchange'){if(typeof params.challenge!=='string'||!params.challenge||params.challenge.length>256||params.confirm!==true)bad();body.challenge=params.challenge;body.confirm=true;}
      if(['exchange','renew'].includes(operation))headers.Authorization='Bearer '+await auth.getAccessToken();
      const url=new URL(operation==='logout'?'/api/logout':'/api/synk-id/'+operation,entry).href;
      if(operation!=='status')headers['Content-Type']='application/json';
      const response=await session.fetch(url,{method:operation==='status'?'GET':'POST',headers,credentials:'include',redirect:'error',signal:AbortSignal.timeout(12000),...(operation==='status'?{}:{body:JSON.stringify(body)})});
      const raw=await response.text();if(raw.length>1048576)bad();const data=JSON.parse(raw);
      if(!response.ok)return {ok:false,error:{code:typeof data.code==='string'&&/^[A-Z_]{1,80}$/.test(data.code)?data.code:'COMPANY_UNAVAILABLE',message:typeof data.error==='string'?data.error.slice(0,500):'회사 연결 요청을 완료하지 못했어요.',status:response.status}};
      return redact(data);
    }catch(error){return {ok:false,error:{code:error.code||'COMPANY_UNAVAILABLE',message:'회사 연결 요청을 완료하지 못했어요.'}};}
  };
}
module.exports={createCompanyRequests};
