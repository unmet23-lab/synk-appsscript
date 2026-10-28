import {readConfig,beginOAuth,tokenRequest} from '../../synk-account/src/core.mjs';
import {rememberStudyLogin,STUDY_SESSION,STUDY_INTENT} from '../../synk-account/src/study-login.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const error=code=>Object.assign(new Error(code),{code});
// 기존 쓰기 함수에 연결하는 제품 어댑터. 키·모델·금액·횟수 선택기는 서버가 소유한다.
export function createFeedbackClient({storage=globalThis.sessionStorage,fetcher=(...a)=>fetch(...a),base=globalThis.location?.href,
 navigate=url=>globalThis.location.assign(url),now=Date.now,cryptoAPI=globalThis.crypto}={}){
 let config=null,credentials=null,identity=null,capability=null,epoch=0,refreshing=null,active=null,requestPending=null;
 const progressActive=new Set();
 const current=rev=>{if(rev!==epoch)throw error('ACCOUNT_CHANGED');};
 const load=()=>{try{const c=JSON.parse(storage.getItem(STUDY_SESSION)||'null');return typeof c?.access_token==='string'&&c.access_token?c:null;}catch{return null;}};
 function sessionCheck(rev,owner){
  current(rev);const live=load();
  if(!live&&!credentials)throw error('AUTH_REQUIRED');
  if(!live||live.access_token!==credentials?.access_token||owner&&identity!==owner)throw error('ACCOUNT_CHANGED');
 }
 async function configuration(check=()=>{}){
  check();if(config)return config;
  const response=await fetcher(new URL('/account/config.json',base),{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});
  check();if(!response.ok)throw error('CONFIG_UNAVAILABLE');const raw=await response.json();check();const candidate=readConfig(raw,base);
  const callback=new URL(candidate.clients.world.redirectUri),site=new URL(base);
  if(callback.origin!==site.origin||callback.pathname!=='/account/client.html'||callback.search!=='?product=world')throw error('STUDY_LOGIN_NOT_CONFIGURED');
  config=candidate;return config;
 }
 function forgetConnection(erase=false){epoch++;active?.abort();active=null;if(requestPending)requestPending.cancelled=true;requestPending=null;for(const controller of progressActive)controller.abort();progressActive.clear();identity=null;capability=null;credentials=null;refreshing=null;
  if(erase)try{storage.removeItem(STUDY_SESSION);storage.removeItem(STUDY_INTENT);}catch{throw error('STORAGE');}}
 function settled(rev,owner){try{sessionCheck(rev,owner);}catch(e){if(rev===epoch)forgetConnection(e.code!=='ACCOUNT_CHANGED');throw e;}}
 const disconnect=()=>forgetConnection(true);
 function cancel(){if(!requestPending)return;requestPending.cancelled=true;requestPending=null;active?.abort();active=null;}
 async function token(rev){
  const owner=identity;sessionCheck(rev,owner);const live=load();
  credentials=live;
  if(Number.isFinite(credentials.expires_at)&&credentials.expires_at>now()+30000)return credentials.access_token;
  if(!credentials.refresh_token)throw error('AUTH_REQUIRED');
  refreshing||=(async()=>{const old=credentials;const next=await tokenRequest(config,{grant_type:'refresh_token',client_id:config.clients.world.clientId,refresh_token:old.refresh_token},fetcher);
   sessionCheck(rev,owner);if(load()?.access_token!==old.access_token)throw error('ACCOUNT_CHANGED');credentials={...next,refresh_token:next.refresh_token||old.refresh_token};storage.setItem(STUDY_SESSION,JSON.stringify(credentials));return credentials.access_token;})().finally(()=>{if(rev===epoch)refreshing=null;});
  return refreshing;
 }
 async function send(kind,{method='POST',payload,revision,timeout=15000,cancelled=()=>false}={}){
  const endpoint={ai:'world-writing',account:'synk-account',study:'synk-learning'}[kind];if(!endpoint)throw error('INVALID_REQUEST');
  const rev=epoch,owner=identity;let controller,timer;credentials||=load();
  const check=()=>{sessionCheck(rev,owner);if(cancelled())throw error('CANCELLED');};
  try{
   check();await configuration(check);check();const access=await token(rev);check();
   controller=new AbortController();if(kind==='ai')active=controller;else progressActive.add(controller);timer=setTimeout(()=>controller.abort(),timeout);
   const url=new URL(`/functions/v1/${endpoint}`,config.accountApiUrl);
   if(kind==='study'){url.searchParams.set('view','study');if(method==='GET')url.searchParams.set('revision',String(revision));}
   const r=await fetcher(url,{method,credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal,
    headers:{'Content-Type':'application/json',authorization:`Bearer ${access}`,apikey:config.supabasePublishableKey,'X-SYNK-Contract':'1','X-SYNK-Product':'world'},...(method==='POST'?{body:JSON.stringify(payload)}:{})});
   check();let data;try{data=await r.json();}catch(e){check();if(r.status===401)throw Object.assign(error('AUTH_REQUIRED'),{status:401});throw e;}check();
   if(!r.ok||!data?.ok)throw Object.assign(error(data?.error?.code||data?.code||'UNAVAILABLE'),{status:r.status,...(Number.isSafeInteger(data?.revision)?{revision:data.revision}:{})});
   const accountId=kind==='account'?data.account?.synk_user_id:data.accountId;
   if(!UUID.test(accountId||''))throw error('INVALID_RESPONSE');
   if(identity&&accountId!==identity)throw error('ACCOUNT_CHANGED');
   return data;
  }catch(e){try{check();}catch(stale){e=stale;}
   if(rev===epoch&&(e.status===401||['ACCOUNT_CHANGED','AUTH_REQUIRED','AUTH_SESSION_MISSING','SESSION_REVOKED'].includes(e.code)))forgetConnection(e.code!=='ACCOUNT_CHANGED');throw e;
  }finally{clearTimeout(timer);if(active===controller)active=null;progressActive.delete(controller);}
 }
 const post=(payload,options={})=>send('ai',{payload,timeout:90000,...options});
 return {
  owner:()=>identity?`user-${identity}`:null,
  status:()=>({...capability,connected:!!identity}),
  async init(){const rev=epoch,owner=identity;if(!load()){if(credentials||identity)forgetConnection();return null;}try{const data=await post({action:'status'},{timeout:15000});settled(rev,owner);identity=data.accountId;capability=data;return data;}catch(e){if(rev===epoch)capability={error:e.code||'UNAVAILABLE'};return null;}},
  async learningSession(){
   const rev=epoch,owner=identity;if(!load()){if(credentials||identity)forgetConnection();return null;}
   const data=await send('account',{method:'GET'});settled(rev,owner);
   if(typeof data.learning?.enabled!=='boolean'||!Number.isSafeInteger(data.learning?.revision)||data.learning.revision<1)throw error('INVALID_RESPONSE');
   if(identity&&identity!==data.account.synk_user_id)throw error('ACCOUNT_CHANGED');
   identity=data.account.synk_user_id;return {accountId:identity,enabled:data.learning.enabled,revision:data.learning.revision};
  },
  async studyProgress({method='GET',revision,baseVersion,study}={}){
   if(!['GET','POST'].includes(method)||!Number.isSafeInteger(revision)||revision<1)throw error('INVALID_REQUEST');
   if(method==='POST'&&(!Number.isSafeInteger(baseVersion)||baseVersion<0||study?.v!==2||Object.keys(study).some(key=>!['v','seq','obs','trail','seen','recentCards'].includes(key))))throw error('INVALID_REQUEST');
   if(!identity)throw error('AUTH_REQUIRED');const rev=epoch,owner=identity;
   const data=await send('study',{method,revision,payload:{revision,baseVersion,study}});settled(rev,owner);
   if(data.revision!==revision||!Number.isSafeInteger(data.version)||data.version<0||!(data.study===null||data.study?.v===2))throw error('INVALID_RESPONSE');
   return data;
  },
  async login(){forgetConnection();const rev=epoch,stored=load()?.access_token,check=()=>{current(rev);if(load()?.access_token!==stored||identity)throw error('ACCOUNT_CHANGED');};await configuration(check);check();
   const url=await beginOAuth({config,product:'world',storage,now:now(),cryptoAPI});check();rememberStudyLogin(storage,{now:now()});navigate(url);},
  disconnect,cancel,
  async request({itemId,bankHash,answer,lang,stage='initial',focusSkill=null,focusTarget='other',history=[],consent}){
   if(consent!=='send-once')throw error('CONSENT_REQUIRED');
   if(!identity||!capability?.enabled||capability.studyVersion!==1)throw error('STUDY_UNAVAILABLE');
   if(bankHash!==capability.bankHash)throw error('ITEM_CHANGED');
   if(active||requestPending)throw error('BUSY');
   const pending={};requestPending=pending;
   const study={stage,focusSkill,...(capability.studyContextVersion===1?{focusTarget,history}:{})};
   try{return await post({action:'feedback',mode:'study',request_id:cryptoAPI.randomUUID(),consent,item_id:itemId,bank_hash:bankHash,answer,lang,study},{cancelled:()=>pending.cancelled===true});}
   finally{if(requestPending===pending)requestPending=null;}
  }
 };
}
