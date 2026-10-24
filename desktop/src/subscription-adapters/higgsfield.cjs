'use strict';
const spec=Object.freeze({label:'Higgsfield',kind:'credit',bin:'higgsfield',home:null,profileHome:true,folders:true});
const policy=Object.freeze({installer:"npm install -g @higgsfield/cli",macInstaller:"curl -fsSL https://raw.githubusercontent.com/higgsfield-ai/cli/main/install.sh | sh",reachable:"https://higgsfield.ai/",login:{domains:["higgsfield.ai"],args:()=>['auth','login']},requiresNpm:true});
// 공급자 명령·출력·로그인 방식은 이 어댑터가 함께 소유한다.
function create({runtime,accounts,system,now,helpers}){
 const {homeEnv}=accounts;

 const {runTool}=runtime;
 const {parseJson,clampNumber}=helpers;
async function pickHiggsfieldWorkspace(extraEnv){
    const list=parseJson((await runTool(runtime.tools.higgsfield.path,['workspace','list','--json'],{extraEnv,timeout:30000})).out);
    if(!Array.isArray(list))return false;
    const pick=list.find(w=>w&&w.user_role==='owner')||(list.length===1?list[0]:null);
    const id=typeof pick?.id==='string'&&/^[0-9A-Za-z-]{8,64}$/.test(pick.id)?pick.id:null;
    if(!id)return false;
    return (await runTool(runtime.tools.higgsfield.path,['workspace','set',id],{extraEnv,timeout:30000})).code===0;
  }

async function readHiggsfield(folder=null){
    const extraEnv=homeEnv('higgsfield',folder);
    let r=await runTool(runtime.tools.higgsfield.path,['account','status','--json'],{extraEnv,timeout:30000});
    const noWorkspace=/no workspace selected/i.test(r.out+'\n'+r.err);
    if(noWorkspace&&!folder)return {state:'error',code:'NO_WORKSPACE',message:'Higgsfield에서 쓸 작업공간이 골라져 있지 않아요. 터미널에서 「higgsfield workspace set」으로 고른 뒤 다시 확인해 주세요.'};
    if(noWorkspace&&await pickHiggsfieldWorkspace(extraEnv))r=await runTool(runtime.tools.higgsfield.path,['account','status','--json'],{extraEnv,timeout:30000});
    const data=parseJson(r.out);
    if(!data||typeof data!=='object'||data.credits===undefined)return /auth|login|expired|token/i.test(r.out+r.err)?{state:'needs-login',message:'Higgsfield 로그인이 필요해요. 다시 연결해 주세요.'}:{state:'error',message:'Higgsfield 계정 상태를 읽지 못했어요.'};
    return {state:'ok',email:typeof data.email==='string'?data.email:null,plan:typeof data.subscription_plan_type==='string'?data.subscription_plan_type:null,live:{readAt:now(),credits:clampNumber(data.credits,-1e9,1e12)}};
  }
 return {read:row=>readHiggsfield(row.folder),verify:async folder=>{const h=await readHiggsfield(folder);return h.state==='ok'?{ok:true,email:h.email,plan:h.plan}:{ok:false,code:h.code};}};
}
module.exports={spec,policy,create};
