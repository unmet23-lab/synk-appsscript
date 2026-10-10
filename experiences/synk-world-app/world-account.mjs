import {readConfig,beginOAuth,consumeCallback,tokenRequest} from '../synk-account/src/core.mjs';
import {createPlatformEntry} from '../synk-account/src/platform-entry.mjs';
import accountClient from '../synk-account/src/generated/account-client.cjs';
import {createWorldGameHost} from './world-game-host.mjs';
import {createLifeProgressPort} from './life-progress-port.mjs';
export {createLifeProgressPort} from './life-progress-port.mjs';
const changed=()=>Object.assign(Error('계정 연결이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});
const authErrors=new Set(['AUTH_REQUIRED','AUTH_SESSION_MISSING','SESSION_REVOKED','UNAUTHORIZED','ACCOUNT_UNAVAILABLE','PRODUCT_FORBIDDEN','PLATFORM_ACCOUNT_MISMATCH']);
const routes=new Map([['bootstrap','GET'],['play/start','POST'],['play/complete','POST'],['avatar/outfit','PUT'],['wardrobe/looks','PUT'],['town/entry','GET'],['town/state','GET'],['town/sharing','POST'],['town/command','POST'],['town/presence','POST'],['enrollment/preview','POST'],['enrollment/claim','POST']]);

// Credentials are owned by the WORLD entry. A game receives only scoped methods.
export function createWorldAccount({config:raw,storage=globalThis.sessionStorage,fetcher=(...args)=>globalThis.fetch(...args),
 getUrl=()=>location.href,replaceUrl=url=>history.replaceState(null,'',url),navigate=url=>location.assign(url),
 onInvalidate=()=>{},accountFactory=accountClient.createAccountClient,requestToken=tokenRequest,now=Date.now}={}){
 const config=readConfig(raw,getUrl()),key='synk.oauth.session.world';
 const binding=[config.supabaseUrl,config.accountApiUrl,config.clients.world.clientId,config.clients.world.redirectUri].join('|');
 const entry=createPlatformEntry({clientKey:'world',getUrl,replaceUrl});
 let session=null,rawSession=null,owner=null,currentSessionId=null,currentAccount=null,epoch=0,closed=false,refreshing=null,pendingExchange=null,townBinding=null,townStateRevision=-1,verifiedClient=null,gameHost=null,gameLaunch=0,lifeHost=null,lifeLaunch=0,verification=0;
 const controllers=new Set();
 const guard=expected=>{if(closed||expected!==epoch)throw changed();if(session&&storage.getItem(key)!==rawSession){clear();throw changed();}};
 const gameBinding=data=>JSON.stringify([data?.account?.synk_user_id,data?.account?.status,data?.learning?.enabled,data?.learning?.revision,data?.capabilities?.learningSync]);
 function stopGames(){gameHost?.dispose();gameHost=null;}
 function clear(){epoch++;gameLaunch++;lifeLaunch++;verification++;stopGames();lifeHost?.dispose();lifeHost=null;session=null;owner=null;currentSessionId=null;currentAccount=null;verifiedClient=null;townBinding=null;townStateRevision=-1;for(const c of controllers)c.abort();onInvalidate();}
 function save(value){session=value;rawSession=JSON.stringify({...value,configKey:binding});storage.setItem(key,rawSession);}
 async function renew(expected){
  guard(expected);if(refreshing)return refreshing;if(!session?.refresh_token)return null;
  const old=session,promise=(async()=>{const next=await requestToken(config,{grant_type:'refresh_token',client_id:config.clients.world.clientId,refresh_token:old.refresh_token},fetcher);guard(expected);save({...next,refresh_token:next.refresh_token||old.refresh_token});return session.access_token;})();
  refreshing=promise;try{return await promise;}finally{if(refreshing===promise)refreshing=null;}
 }
 async function verify(expected){
  guard(expected);if(!session)return false;const read=++verification;
  if(session.expires_at<=now()+30000){await renew(expected);guard(expected);}
  const client=accountFactory({url:config.accountApiUrl,anonKey:config.supabasePublishableKey,product:'world',getAccessToken:()=>session?.access_token,refresh:()=>renew(expected),guard:()=>guard(expected),fetch:fetcher});
  const data=await client.load();guard(expected);if(read!==verification)throw changed();
  const id=data.account?.synk_user_id;
  if(data.ok!==true||typeof id!=='string'||!id||data.account.status!=='active')throw Object.assign(Error('활성화된 SYNK ID를 확인해 주세요.'),{code:'ACCOUNT_UNAVAILABLE'});
  entry.assertAccount(id);if(owner&&id!==owner){clear();throw changed();}owner=id;
  if(currentAccount&&gameBinding(currentAccount)!==gameBinding(data))stopGames();
  currentSessionId=data.sessions?.find(s=>s.current&&!s.revoked)?.id||null;currentAccount=data;verifiedClient=client;return true;
 }
 async function restore(){
  const expected=epoch;entry.capture(storage);entry.restore(storage);guard(expected);
  if(entry.isCancelled())return false;
  if(!config.configured||!config.clients.world.clientId||!config.clients.world.redirectUri)throw Object.assign(Error('이 WORLD의 SYNK ID 공개 연결 설정을 확인해 주세요.'),{code:'AUTH_CONFIG'});
  const url=new URL(getUrl());
  if(url.searchParams.has('code')||url.searchParams.has('error')){
   try{pendingExchange=consumeCallback({config,product:'world',url:url.href,storage,now:now()});}
   finally{for(const p of ['code','state','error','error_description'])url.searchParams.delete(p);replaceUrl(url.href);}
  }
  if(pendingExchange){const next=await requestToken(config,pendingExchange,fetcher);guard(expected);pendingExchange=null;save(next);}
  else if(!session){rawSession=storage.getItem(key);let value;try{if(rawSession?.length>65536)throw Error();value=JSON.parse(rawSession||'null');}catch{value=null;}
   if(value&&(value.configKey!==undefined&&value.configKey!==binding||typeof value.access_token!=='string'||!value.access_token||value.access_token.length>16384||!Number.isFinite(value.expires_at)||value.refresh_token!==null&&typeof value.refresh_token!=='string')){storage.removeItem(key);rawSession=null;value=null;}
   session=value;
  }
  if(!session)return false;
  try{return await verify(expected);}catch(error){if(authErrors.has(error.code)){clear();storage.removeItem(key);}throw error;}
 }
 async function signIn(){clear();entry.resume();entry.stop();const expected=epoch;const url=await beginOAuth({config,product:'world',storage,now:now()});guard(expected);navigate(url);}
 async function prepareGame(options={}){
  const expected=epoch,launch=++gameLaunch;guard(expected);
  if(!owner||!session)throw Object.assign(Error('SYNK ID로 로그인한 뒤 놀이를 이어가요.'),{code:'AUTH_REQUIRED',status:401});
  stopGames();
  try{
   await verify(expected);guard(expected);if(launch!==gameLaunch)throw changed();
   const id=owner,bound=gameBinding(currentAccount),client=verifiedClient,prefs=currentAccount.learning;
   if(!client?.play||!prefs||typeof prefs.enabled!=='boolean'||!Number.isSafeInteger(prefs.revision)||prefs.revision<1)throw Object.assign(Error('계정의 게임 저장과 학습 설정을 다시 확인해 주세요.'),{code:'PLAY_NOT_READY'});
   const check=()=>{guard(expected);if(launch!==gameLaunch||owner!==id||gameBinding(currentAccount)!==bound)throw changed();};
   const wrap=port=>port&&Object.freeze(Object.fromEntries(Object.entries(port).filter(([,fn])=>typeof fn==='function').map(([name,fn])=>[name,async(...args)=>{
    check();try{const value=await fn(...args);check();return value;}catch(error){if(expected===epoch&&authErrors.has(error.code)){clear();storage.removeItem(key);}throw error;}
   }])));
   const current=createWorldGameHost({...options,accountId:id,revision:prefs.revision,connected:prefs.enabled&&currentAccount.capabilities?.learningSync===true,
    play:wrap(client.play),learning:wrap(client.learning),memory:wrap(client.memory),guard:check});
   gameHost=current;
   try{await current.ready();check();current.install();return current.publicHandle;}
   catch(error){current.dispose();if(gameHost===current)gameHost=null;throw error;}
  }catch(error){if(expected===epoch&&authErrors.has(error.code)){clear();storage.removeItem(key);}throw error;}
 }
 async function prepareLifeProgress({storage:cache=globalThis.localStorage,onStatus=()=>{},target=globalThis}={}){
  const expected=epoch,launch=++lifeLaunch;guard(expected);
  if(!owner||!session)throw Object.assign(Error('SYNK ID로 로그인한 뒤 생활 한국어를 이어가요.'),{code:'AUTH_REQUIRED',status:401});
  lifeHost?.dispose();lifeHost=null;
  try{await verify(expected);guard(expected);if(launch!==lifeLaunch)throw changed();}
  catch(error){if(expected===epoch&&authErrors.has(error.code)){clear();storage.removeItem(key);}throw error;}
  const id=owner,client=verifiedClient;
  if(typeof client?.play?.load!=='function'||typeof client?.play?.mutate!=='function')throw Object.assign(Error('계정의 생활 한국어 저장 연결을 확인해 주세요.'),{code:'PLAY_NOT_READY'});
  const check=()=>{guard(expected);if(launch!==lifeLaunch||owner!==id)throw changed();};
  const wrap=fn=>async(...args)=>{check();try{const value=await fn(...args);check();return value;}catch(error){if(expected===epoch&&authErrors.has(error.code)){clear();storage.removeItem(key);}throw error;}};
  const port=await createLifeProgressPort({accountId:id,client:{load:wrap(()=>client.play.load()),mutate:wrap(body=>client.play.mutate(body))},guard:check,storage:cache,target,onStatus,
   onDispose:value=>{if(lifeHost===value)lifeHost=null;}});
  check();lifeHost=port;return port;
 }
 async function request(path,options={}){
  if(!routes.has(path)||(options.method||'GET')!==routes.get(path))throw new TypeError('Unsupported WORLD request');
  const expected=epoch;guard(expected);if(!owner||!session)throw Object.assign(Error('SYNK ID로 로그인해 주세요.'),{code:'AUTH_REQUIRED',status:401});
  // Recheck account revocation before entering a long-lived town from another surface.
  if(path==='town/state')await verify(expected);
  if(path==='town/entry'){townBinding=null;townStateRevision=-1;}
  if(path==='town/sharing'&&!townBinding?.classId)throw Object.assign(Error('CLASSROOM_FORBIDDEN'),{code:'CLASSROOM_FORBIDDEN',status:403});
  const endpoint=path==='town/sharing'||path.startsWith('enrollment/')?'synk-classroom':path.startsWith('town/')?'synk-town':'synk-world-v1',suffix=path==='town/sharing'?'api/world/town/sharing':path.startsWith('enrollment/')?`api/${path}`:path.startsWith('town/')?path.slice(5):path;
  const url=new URL(config.accountApiUrl);url.pathname=url.pathname.replace(/\/$/,'').replace(/\/functions\/v1(?:\/synk-(?:account|world-v1|town))?$/,'')+`/functions/v1/${endpoint}/${suffix}`;url.search='';url.hash='';if(path.startsWith('town/')&&path!=='town/entry'&&townBinding?.classId)url.searchParams.set('classId',townBinding.classId);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);controllers.add(controller);
  try{
   if(session.expires_at<=now()+30000)await renew(expected);guard(expected);
   for(let attempt=0;attempt<2;attempt++){
    const token=session.access_token;const response=await fetcher(url.href,{method:options.method||'GET',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal,
     headers:{apikey:config.supabasePublishableKey,Authorization:`Bearer ${token}`,'X-SYNK-Product':'world','X-SYNK-Contract':'1','X-SYNK-App-Version':'1.0.0',...(options.body?{'Content-Type':'application/json'}:{})},...(options.body?{body:options.body}:{})});guard(expected);
    if(response.status===401&&attempt===0&&session.refresh_token){await renew(expected);guard(expected);continue;}
    const data=await response.json();guard(expected);
    if(response.status===401||authErrors.has(data?.error?.code)){clear();storage.removeItem(key);}
    if(response.ok&&path!=='town/sharing'&&!path.startsWith('enrollment/')&&data?.accountId!==owner)throw Object.assign(Error('다른 계정의 응답을 적용하지 않았어요.'),{code:'ACCOUNT_MISMATCH'});
    if(response.ok&&data.binding){const next=data.binding;if(townBinding&&(next.classId!==townBinding.classId||Number(next.sharing?.revision)<Number(townBinding.sharing?.revision)||Number(next.membershipRevision)<Number(townBinding.membershipRevision)||next.sharing?.revision===townBinding.sharing?.revision&&townBinding.sharing?.enabled===false&&next.sharing?.enabled===true))throw Object.assign(Error('TOWN_SNAPSHOT_CHANGED'),{code:'TOWN_SNAPSHOT_CHANGED'});townBinding=next;}
    if(response.ok&&path.startsWith('town/')&&Number.isSafeInteger(data.state?.revision)){if(data.state.revision<townStateRevision)throw Object.assign(Error('TOWN_SNAPSHOT_CHANGED'),{code:'TOWN_SNAPSHOT_CHANGED'});townStateRevision=data.state.revision;}
    return {ok:response.ok,status:response.status,json:async()=>{guard(expected);return data;}};
   }
  }finally{clearTimeout(timer);controllers.delete(controller);}
 }
 async function logout(){
  const captured=session,id=currentSessionId;clear();entry.cancel();storage.removeItem(key);rawSession=null;
  if(!captured)return {serverRevoked:true};
  let serverRevoked=false;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const revokeFetch=(url,options)=>fetcher(url,{...options,signal:controller.signal});
   if(id){const client=accountFactory({url:config.accountApiUrl,anonKey:config.supabasePublishableKey,product:'world',getAccessToken:()=>captured.access_token,guard:()=>{},fetch:revokeFetch});const result=await client.revokeSession(id);serverRevoked=result.refreshRevoked===true;}
   const response=await revokeFetch(new URL('/auth/v1/logout?scope=local',config.supabaseUrl).href,{method:'POST',credentials:'omit',cache:'no-store',headers:{apikey:config.supabasePublishableKey,Authorization:`Bearer ${captured.access_token}`}});serverRevoked=response.ok&&serverRevoked;
  }catch{}finally{clearTimeout(timer);}return {serverRevoked};
 }
 return Object.freeze({mode:'account',restore,signIn,request,logout,prepareGame,prepareLifeProgress,identity:()=>({accountId:owner,generation:epoch}),assertActive(){guard(epoch);if(!owner)throw changed();},
  preferences(){const learning=currentAccount?.learning;return learning&&typeof learning.enabled==='boolean'&&Number.isSafeInteger(learning.revision)?{enabled:learning.enabled,revision:learning.revision}:null;},
  async setLearning(enabled,expectedRevision){const expected=epoch;guard(expected);if(!owner||typeof enabled!=='boolean'||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new TypeError('Invalid account learning preference');
   const client=accountFactory({url:config.accountApiUrl,anonKey:config.supabasePublishableKey,product:'world',getAccessToken:()=>session?.access_token,refresh:()=>renew(expected),guard:()=>guard(expected),fetch:fetcher});
   try{await client.setLearning(enabled,expectedRevision);guard(expected);await verify(expected);guard(expected);return this.preferences();}
   catch(error){if(authErrors.has(error.code)){clear();storage.removeItem(key);}throw error;}},
  async enrollmentRequest(operation,body){if(!['preview','claim'].includes(operation))throw new TypeError('Unknown enrollment operation');const response=await request(`enrollment/${operation}`,{method:'POST',body:JSON.stringify(body)});const data=await response.json();if(!response.ok||data.ok===false)throw Object.assign(Error(data.error?.message||'교실 연결을 확인하지 못했어요.'),{code:data.error?.code||'ENROLLMENT_UNAVAILABLE',status:response.status});return data;},
  stop(){clear();closed=true;}});
}

export {loadWorldConfig,publicWorldConfig} from './operating-mode.mjs';
