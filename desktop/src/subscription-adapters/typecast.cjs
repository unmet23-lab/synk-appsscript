'use strict';
const fs=require('node:fs'),path=require('node:path');
const TYPECAST_SUBSCRIPTION='https://api.typecast.ai/v1/users/me/subscription';
const spec=Object.freeze({label:'Typecast',kind:'credit',bin:null,home:null,folders:true,apiKey:true});
const policy=Object.freeze({login:null});
// 공급자 명령·출력·로그인 방식은 이 어댑터가 함께 소유한다.
function create({runtime,accounts,system,now,helpers}){
 const {accountsDir,secrets}=accounts;
 const {fetch:fetchImpl}=system;

 const {cleanText,clampNumber}=helpers;
const secretsReady=()=>{try{return !!secrets&&secrets.available()===true;}catch{return false;}};

const keyFile=folder=>path.join(accountsDir,folder,'key.bin');

function readKey(folder){try{return String(secrets.decrypt(fs.readFileSync(keyFile(folder))));}catch{return null;}}

async function typecastSubscription(key){
    if(typeof fetchImpl!=='function')return {ok:false,code:'NETWORK'};
    let res,data;
    try{res=await fetchImpl(TYPECAST_SUBSCRIPTION,{headers:{'X-API-KEY':key,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});}
    catch{return {ok:false,code:'NETWORK'};}
    if(res.status===401||res.status===403)return {ok:false,code:'INVALID_KEY'};
    if(!res.ok)return {ok:false,code:'KEY_CHECK_FAILED'};
    try{data=await res.json();}catch{return {ok:false,code:'KEY_CHECK_FAILED'};}
    const total=clampNumber(data?.credits?.plan_credits,0,1e12),used=clampNumber(data?.credits?.used_credits,0,1e12);
    if(total===null||used===null)return {ok:false,code:'KEY_CHECK_FAILED'};
    const plan=typeof data.plan==='string'?data.plan:typeof data.plan?.name==='string'?data.plan.name:null;
    // planCredits(3차): 이번 요금제의 한 달 크레딧 — 한 달 요약이 「4주 동안 쓴 크레딧 ÷ 한 달 크레딧」을 셀 때 요금표보다 먼저 쓴다.
    return {ok:true,plan:plan?cleanText(plan,40):null,credits:total-used,planCredits:total};
  }

async function readTypecast(row){
    if(!secretsReady())return {state:'error',message:'이 PC에서 저장한 API 키를 열 수 없어요. 키를 다시 넣어 주세요.'};
    const key=row.folder?readKey(row.folder):null;
    if(!key)return {state:'needs-login',message:'저장한 Typecast API 키를 찾지 못했어요. 키를 다시 넣어 주세요.'};
    const sub=await typecastSubscription(key);
    if(sub.ok)return {state:'ok',plan:sub.plan,live:{readAt:now(),credits:sub.credits,planCredits:sub.planCredits}};
    if(sub.code==='INVALID_KEY')return {state:'needs-login',message:'Typecast API 키가 더 이상 맞지 않아요. 새 키로 다시 연결해 주세요.'};
    return {state:'error',message:sub.code==='NETWORK'?'Typecast에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 확인해 주세요.':'Typecast 크레딧을 읽지 못했어요. 잠시 뒤 다시 확인해 주세요.'};
  }
 return {read:readTypecast,key:{ready:secretsReady,file:keyFile,validate:typecastSubscription}};
}
module.exports={spec,policy,create};
