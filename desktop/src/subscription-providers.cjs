'use strict';
const helpers=require('./subscription-common.cjs');
const {adapters}=require('./subscription-catalog.cjs');

// 공통 재시도·연결 확인만 맡으며 공급자별 명령과 로그인 분기는 어댑터로 보낸다.
function createSubscriptionProviders({runtime,accounts,system,now,retryDelay,definitions=adapters}){
 const {fetch:fetchImpl}=system;
 const instances=Object.fromEntries(Object.entries(definitions).map(([id,a])=>[id,{...a.create({runtime,accounts,system,now,helpers}),spec:a.spec,policy:a.policy}]));
 const get=id=>Object.hasOwn(instances,id)?instances[id]:null;
async function readRow(row){
    // Preserve the legacy error shape for a malformed stored service name.
    // Public registration still accepts only catalog-owned names.
    const spec=get(row.service)?.spec||helpers.SERVICES[row.service];
    if(!spec||row.source!=='auto')return null;
    if(!spec.apiKey&&!runtime.tools[row.service]?.path)return {state:'error',message:`${spec.label}용 공식 프로그램이 이 PC에서 보이지 않아요. 가이드의 설치 단계를 확인해 주세요.`};
    try{return await get(row.service).read(row);}
    catch{return {state:'error',message:'읽는 중 문제가 생겼어요. 잠시 뒤 다시 확인해 주세요.'};}
  }
async function reachable(service){
    const url=get(service)?.policy.reachable;if(!url||typeof fetchImpl!=='function')return true;
    try{await fetchImpl(url,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(5000)});return true;}catch{return false;}
  }
const offline=()=>({state:'error',message:'인터넷에 연결되지 않아 확인하지 못했어요. 로그인이 풀린 것은 아닐 수 있어요. 연결을 확인하고 다시 확인해 주세요.'});
async function readConfirmed(row){
    const first=await readRow(row);
    if(first?.state!=='needs-login'||get(row.service)?.spec.apiKey)return first;
    if(!await reachable(row.service))return offline();
    if(retryDelay>0)await new Promise(resolve=>setTimeout(resolve,retryDelay));
    const second=await readRow(row);
    if(second?.state==='needs-login'&&!await reachable(row.service))return offline();
    return second;
  }
 const verifyLogin=(service,folder)=>get(service).verify(folder);
 return {get,readConfirmed,verifyLogin};
}
module.exports={createSubscriptionProviders};
