import {readConfig,beginOAuth,tokenRequest} from '../../synk-account/src/core.mjs';
import {rememberStudyLogin,STUDY_SESSION,STUDY_INTENT} from '../../synk-account/src/study-login.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const error=code=>Object.assign(new Error(code),{code});
// 기존 쓰기 함수에 연결하는 제품 어댑터. 키·모델·금액·횟수 선택기는 서버가 소유한다.
export function createFeedbackClient({storage=globalThis.sessionStorage,fetcher=(...a)=>fetch(...a),base=globalThis.location?.href,
 navigate=url=>globalThis.location.assign(url),now=Date.now,cryptoAPI=globalThis.crypto}={}){
 let config=null,credentials=null,identity=null,capability=null,epoch=0,refreshing=null,active=null,requestPending=null;
 const current=rev=>{if(rev!==epoch)throw error('ACCOUNT_CHANGED');};
 const load=()=>{try{const c=JSON.parse(storage.getItem(STUDY_SESSION)||'null');return typeof c?.access_token==='string'&&c.access_token?c:null;}catch{return null;}};
 async function configuration(){
  if(config)return config;
  const response=await fetcher(new URL('/account/config.json',base),{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw error('CONFIG_UNAVAILABLE');const candidate=readConfig(await response.json(),base);
  const callback=new URL(candidate.clients.world.redirectUri),site=new URL(base);
  if(callback.origin!==site.origin||callback.pathname!=='/account/client.html'||callback.search!=='?product=world')throw error('STUDY_LOGIN_NOT_CONFIGURED');
  config=candidate;return config;
 }
 function forgetConnection(erase=false){epoch++;active?.abort();active=null;identity=null;capability=null;credentials=null;refreshing=null;
  if(erase)try{storage.removeItem(STUDY_SESSION);storage.removeItem(STUDY_INTENT);}catch{throw error('STORAGE');}}
 const disconnect=()=>forgetConnection(true);
 function cancel(){if(!requestPending)return;requestPending.cancelled=true;requestPending=null;active?.abort();active=null;}
 async function token(rev){
  current(rev);const live=load();
  if(!live||credentials&&live.access_token!==credentials.access_token)throw error('ACCOUNT_CHANGED');
  credentials=live;
  if(Number.isFinite(credentials.expires_at)&&credentials.expires_at>now()+30000)return credentials.access_token;
  if(!credentials.refresh_token)throw error('AUTH_REQUIRED');
  refreshing||=(async()=>{const old=credentials;const next=await tokenRequest(config,{grant_type:'refresh_token',client_id:config.clients.world.clientId,refresh_token:old.refresh_token},fetcher);
   current(rev);if(load()?.access_token!==old.access_token)throw error('ACCOUNT_CHANGED');credentials={...next,refresh_token:next.refresh_token||old.refresh_token};storage.setItem(STUDY_SESSION,JSON.stringify(credentials));return credentials.access_token;})().finally(()=>{if(rev===epoch)refreshing=null;});
  return refreshing;
 }
 async function post(payload,{timeout=90000,cancelled=()=>false}={}){
  const rev=epoch;let controller,timer;const check=()=>{current(rev);if(cancelled())throw error('CANCELLED');};
  try{
   await configuration();check();const access=await token(rev);check();
   controller=new AbortController();active=controller;timer=setTimeout(()=>controller.abort(),timeout);
   const r=await fetcher(new URL('/functions/v1/world-writing',config.accountApiUrl),{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal,
    headers:{'Content-Type':'application/json',authorization:`Bearer ${access}`,apikey:config.supabasePublishableKey,'X-SYNK-Contract':'1','X-SYNK-Product':'world'},body:JSON.stringify(payload)});
   check();if(load()?.access_token!==credentials?.access_token)throw error('ACCOUNT_CHANGED');
   const data=await r.json();check();if(load()?.access_token!==credentials?.access_token)throw error('ACCOUNT_CHANGED');
   if(!r.ok||!data?.ok){if(r.status===401||r.status===403)disconnect();throw error(data?.code||'UNAVAILABLE');}
   if(!UUID.test(data.accountId||''))throw error('INVALID_RESPONSE');
   if(identity&&data.accountId!==identity)throw error('ACCOUNT_CHANGED');
   return data;
  }catch(e){if(rev===epoch&&['ACCOUNT_CHANGED','AUTH_REQUIRED','AUTH_SESSION_MISSING','SESSION_REVOKED'].includes(e.code))forgetConnection(e.code!=='ACCOUNT_CHANGED');throw e;}
  finally{clearTimeout(timer);if(active===controller)active=null;}
 }
 return {
  owner:()=>identity?`user-${identity}`:null,
  status:()=>({...capability,connected:!!identity}),
  async init(){const rev=epoch;credentials=load();if(!credentials)return null;try{const data=await post({action:'status'},{timeout:15000});current(rev);identity=data.accountId;capability=data;return data;}catch(e){if(rev===epoch)capability={error:e.code||'UNAVAILABLE'};return null;}},
  async login(){epoch++;active?.abort();identity=null;capability=null;const rev=epoch;await configuration();current(rev);
   const url=await beginOAuth({config,product:'world',storage,now:now(),cryptoAPI});current(rev);rememberStudyLogin(storage,{now:now()});navigate(url);},
  disconnect,cancel,
  async request({itemId,bankHash,answer,lang,stage='initial',focusSkill=null,consent}){
   if(consent!=='send-once')throw error('CONSENT_REQUIRED');
   if(!identity||!capability?.enabled||capability.studyVersion!==1)throw error('STUDY_UNAVAILABLE');
   if(bankHash!==capability.bankHash)throw error('ITEM_CHANGED');
   if(active||requestPending)throw error('BUSY');
   const pending={};requestPending=pending;
   try{return await post({action:'feedback',mode:'study',request_id:cryptoAPI.randomUUID(),consent,item_id:itemId,bank_hash:bankHash,answer,lang,study:{stage,focusSkill}},{cancelled:()=>pending.cancelled===true});}
   finally{if(requestPending===pending)requestPending=null;}
  }
 };
}
