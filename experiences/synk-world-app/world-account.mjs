import {readConfig,beginOAuth,consumeCallback,tokenRequest} from '../synk-account/src/core.mjs';
import {createPlatformEntry} from '../synk-account/src/platform-entry.mjs';
import accountClient from '../synk-account/src/generated/account-client.cjs';
import {createDesktopAccountClient,createDesktopClassroomClient} from '../synk-account/src/desktop-account.mjs';
import {createClassroomTransport} from '../synk-account/src/classroom-client.mjs';
export {mountCourseWritingEntry} from './course-writing-entry.mjs';
import {createWorldGameHost} from './world-game-host.mjs';
export {createLocalWorldLearningHost} from './world-game-host.mjs';
// WORLD 코치는 TOPIK I·II를 합친 지도로(world-learning-map.mjs, 10-21 ④). 게임 엔진(atlas/game-browser.js)은 그대로다.
export {worldLearning} from './world-learning-map.mjs';
export {createWorldLearningPlan} from './world-learning-plan.mjs';
import {worldTopicAnswers} from './world-learning-plan.mjs';
import {createLifeProgressPort} from './life-progress-port.mjs';
import {createHangulProgressPort} from './hangul-progress-port.mjs';
export {createLifeProgressPort} from './life-progress-port.mjs';
export {GUEST_TRIAL_GAMES,createGuestTrials,createGuestTrialPlayHost} from './guest-trial.mjs';
export {createDeviceRecordsOffer,noteDeviceSignOut,noteDeviceAccount} from './device-records.mjs';
// 「내 위치」(판단 · 진단 문항 · 그림): 진단 문항이 앱 서버가 내주지 않는 게임 원고에서 오므로 이 묶음에 싣는다(world-position-kit.mjs).
export {worldPosition} from './world-position-kit.mjs';
// 싱크타운 「마을 준비 확인」·첫 장면 배치의 화면 쪽 계산(판정은 서버). Trail을 함께 실으려고 이 묶음에 싣는다.
export * as worldTownCheck from './world-town-check.mjs';
import {classroomEndpoint,classroomReply,requestClassrooms} from './classroom-client.mjs';
import {homeworkReply,homeworkSubmission,homeworkUnavailable} from './homework-client.mjs';
const changed=()=>Object.assign(Error('로그인한 계정이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});
const authErrors=new Set(['AUTH_REQUIRED','AUTH_SESSION_MISSING','SESSION_REVOKED','UNAUTHORIZED','ACCOUNT_UNAVAILABLE','PRODUCT_FORBIDDEN','PLATFORM_ACCOUNT_MISMATCH']);
// 반 연결(classId)이 붙지 않는 타운 경로: 입장 조회·입장 확인·첫 장면 배치는 계정 하나의 일이다.
const TOWN_ACCOUNT_ROUTES=new Set(['town/entry','town/check','town/placement']);
const routes=new Map([['bootstrap','GET'],['play/start','POST'],['play/complete','POST'],['avatar/outfit','PUT'],['wardrobe/looks','PUT'],['town/entry','GET'],['town/state','GET'],['town/sharing','POST'],['town/command','POST'],['town/presence','POST'],['town/pulse','POST'],['town/boundary','POST'],['town/check','POST'],['town/placement','POST'],['enrollment/preview','POST'],['enrollment/claim','POST'],['homework','GET'],['homework/submit','POST'],['homework/key','POST'],['writing','POST'],['speaking','POST']]);

// Credentials are owned by the WORLD entry. A game receives only scoped methods.
export function createWorldAccount({config:raw,storage=globalThis.sessionStorage,fetcher=(...args)=>globalThis.fetch(...args),
 getUrl=()=>location.href,replaceUrl=url=>history.replaceState(null,'',url),navigate=url=>location.assign(url),
 onInvalidate=()=>{},onConnect=()=>{},bridge=globalThis.synkDesktop,accountFactory=accountClient.createAccountClient,requestToken=tokenRequest,now=Date.now}={}){
 const native=typeof bridge?.accountRequest==='function'&&typeof bridge?.authStatus==='function';
 const config=readConfig(raw,getUrl()),key='synk.oauth.session.world';
 const binding=[config.supabaseUrl,config.accountApiUrl,config.clients.world.clientId,config.clients.world.redirectUri].join('|');
 const entry=createPlatformEntry({clientKey:'world',getUrl,replaceUrl});
 let session=null,rawSession=null,owner=null,currentSessionId=null,currentAccount=null,epoch=0,closed=false,refreshing=null,pendingExchange=null,townBinding=null,townStateRevision=-1,townVerifiedAt=-Infinity,verifiedClient=null,gameHost=null,gameLaunch=0,lifeHost=null,lifeLaunch=0,verification=0;
 let nativeIdentity=null,nativeAccountId=null,nativeGeneration=-1,signedOutGeneration=-1,nativeEvents=0,nativeReady=null,unsubscribe=null,nativeClassroom=false,nativeHomework=false,nativeTownCheck=false,nativeTownPulse=false,hangulHost=null,hangulLaunch=0;
 const controllers=new Set();
 const guard=expected=>{if(closed||expected!==epoch)throw changed();if(!native&&session&&storage.getItem(key)!==rawSession){clear();throw changed();}};
 const forgetSession=()=>{if(!native)storage.removeItem(key);};
 const clientFor=expected=>native?createDesktopAccountClient({bridge,product:'world',guard:()=>guard(expected)}):accountFactory({url:config.accountApiUrl,anonKey:config.supabasePublishableKey,product:'world',getAccessToken:()=>session?.access_token,refresh:()=>renew(expected),guard:()=>guard(expected),fetch:fetcher});
 const gameBinding=data=>JSON.stringify([data?.account?.synk_user_id,data?.account?.status,data?.learning?.enabled,data?.learning?.revision,data?.capabilities?.learningSync]);
 function stopGames(){gameHost?.dispose();gameHost=null;}
 function clear(){epoch++;gameLaunch++;lifeLaunch++;hangulLaunch++;verification++;stopGames();lifeHost?.dispose();lifeHost=null;hangulHost?.dispose();hangulHost=null;session=null;owner=null;currentSessionId=null;currentAccount=null;verifiedClient=null;townBinding=null;townStateRevision=-1;townVerifiedAt=-Infinity;nativeIdentity=null;nativeAccountId=null;for(const c of controllers)c.abort();onInvalidate();}
 function nativeStatus(state){
  if(closed)return false;
  const generation=state?.sessionGeneration,id=state?.account?.synk_user_id;
  if(!Number.isSafeInteger(generation)||generation<nativeGeneration)return !!session;
  nativeGeneration=generation;
  // A credential refresh keeps the same session; an account switch ends its hosts.
  if(state.status==='restoring'&&!state.error&&nativeIdentity&&nativeIdentity===`${nativeAccountId}:${generation}`)return true;
  if(state.signedIn===true&&typeof id==='string'&&id&&generation>signedOutGeneration){
   const identity=`${id}:${generation}`;
   if(identity!==nativeIdentity){clear();nativeIdentity=identity;nativeAccountId=id;session={native:true};}
   return true;
  }
  if(session||owner)clear();
  return false;
 }
 async function prepareNative(){
  if(nativeReady)return nativeReady;
  const expected=epoch;
  const pending=(async()=>{
   if(typeof bridge.getEnvironment!=='function'||typeof bridge.onAuthChanged!=='function'||typeof bridge.authSignIn!=='function'||typeof bridge.authSignOut!=='function')throw Object.assign(Error('PC 앱을 최신 버전으로 업데이트한 뒤 다시 열어 주세요.'),{code:'INVALID_BRIDGE'});
   const environment=await bridge.getEnvironment();guard(expected);
   if(environment?.clientId!=='world')throw Object.assign(Error('PC 앱을 최신 버전으로 업데이트한 뒤 다시 열어 주세요.'),{code:'INVALID_BRIDGE'});
   // 「우리 반 수업」은 본체가 classroom 경로를 알릴 때만 연다. 그 경로가 없는 옛 PC 앱에서는 칸을 숨긴다.
   nativeClassroom=Array.isArray(environment.worldRoutes)&&environment.worldRoutes.includes('classroom');
   // 「이번 주 과제」도 같다: 본체가 읽기·내기 두 경로를 다 알릴 때만 칸을 연다.
   nativeHomework=Array.isArray(environment.worldRoutes)&&['homework','homework/submit'].every(route=>environment.worldRoutes.includes(route));
   // 「마을 준비 확인」(입장 확인·첫 장면 배치)도 본체가 두 경로를 알릴 때만. 옛 PC 앱은 웹에서 확인을 마치면 여기서도 열린다고 알린다.
   nativeTownCheck=Array.isArray(environment.worldRoutes)&&['town/check','town/placement'].every(route=>environment.worldRoutes.includes(route));
   nativeTownPulse=Array.isArray(environment.worldRoutes)&&['town/pulse','town/boundary'].every(route=>environment.worldRoutes.includes(route));
   unsubscribe=bridge.onAuthChanged(state=>{
    const before=nativeIdentity;nativeEvents++;
    if(nativeStatus(state)&&nativeIdentity!==before){const identity=nativeIdentity;queueMicrotask(()=>{if(!closed&&nativeIdentity===identity)onConnect();});}
   });
  })();
  nativeReady=pending;try{await pending;}catch(error){if(nativeReady===pending)nativeReady=null;throw error;}
 }
 function save(value){session=value;rawSession=JSON.stringify({...value,configKey:binding});storage.setItem(key,rawSession);}
 async function renew(expected){
  guard(expected);if(refreshing)return refreshing;if(!session?.refresh_token)return null;
  const old=session,promise=(async()=>{const next=await requestToken(config,{grant_type:'refresh_token',client_id:config.clients.world.clientId,refresh_token:old.refresh_token},fetcher);guard(expected);save({...next,refresh_token:next.refresh_token||old.refresh_token});return session.access_token;})();
  refreshing=promise;try{return await promise;}finally{if(refreshing===promise)refreshing=null;}
 }
 async function verify(expected){
  guard(expected);if(!session)return false;const read=++verification;
  if(!native&&session.expires_at<=now()+30000){await renew(expected);guard(expected);}
  const client=clientFor(expected);
  const data=await client.load();guard(expected);if(read!==verification)throw changed();
  const id=data.account?.synk_user_id;
  if(data.ok!==true||typeof id!=='string'||!id||data.account.status!=='active')throw Object.assign(Error('이 SYNK ID는 지금 쓸 수 없어요. 다른 계정으로 로그인해 주세요.'),{code:'ACCOUNT_UNAVAILABLE'});
  if(!native)entry.assertAccount(id);if(owner&&id!==owner||native&&id!==nativeAccountId){clear();throw changed();}owner=id;
  if(currentAccount&&gameBinding(currentAccount)!==gameBinding(data))stopGames();
  currentSessionId=data.sessions?.find(s=>s.current&&!s.revoked)?.id||null;currentAccount=data;verifiedClient=client;return true;
 }
 async function restore(){
  if(native){
   await prepareNative();guard(epoch);const observed=nativeEvents,state=await bridge.authStatus();guard(epoch);
   if(observed===nativeEvents)nativeStatus(state);
   if(!session)return false;
   const expected=epoch;
   try{return await verify(expected);}catch(error){if(expected===epoch&&authErrors.has(error.code))clear();throw error;}
  }
  const expected=epoch;entry.capture(storage);entry.restore(storage);guard(expected);
  if(entry.isCancelled())return false;
  if(!config.configured||!config.clients.world.clientId||!config.clients.world.redirectUri)throw Object.assign(Error('지금은 로그인을 시작할 수 없어요. 잠시 뒤 다시 시도해 주세요.'),{code:'AUTH_CONFIG'});
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
  try{return await verify(expected);}catch(error){if(authErrors.has(error.code)){clear();forgetSession();}throw error;}
 }
 async function signIn(){
  if(native){await prepareNative();guard(epoch);clear();const result=await bridge.authSignIn();if(result?.ok===false)throw Object.assign(Error(result.error?.message||'SYNK ID 로그인을 시작하지 못했어요.'),{code:result.error?.code||'AUTH_REQUIRED'});return;}
  clear();entry.resume();entry.stop();const expected=epoch;const url=await beginOAuth({config,product:'world',storage,now:now()});guard(expected);navigate(url);
 }
 async function prepareGame(options={}){
  const expected=epoch,launch=++gameLaunch;guard(expected);
  if(!owner||!session)throw Object.assign(Error('SYNK ID로 로그인한 뒤 놀이를 이어가요.'),{code:'AUTH_REQUIRED',status:401});
  stopGames();
  try{
   await verify(expected);guard(expected);if(launch!==gameLaunch)throw changed();
   const id=owner,bound=gameBinding(currentAccount),client=verifiedClient,prefs=currentAccount.learning;
   if(!client?.play||!prefs||typeof prefs.enabled!=='boolean'||!Number.isSafeInteger(prefs.revision)||prefs.revision<1)throw Object.assign(Error('계정의 게임 저장이 아직 준비되지 않았어요. 잠시 뒤 놀이를 다시 열어 주세요.'),{code:'PLAY_NOT_READY'});
   const check=()=>{guard(expected);if(launch!==gameLaunch||owner!==id||gameBinding(currentAccount)!==bound)throw changed();};
   const wrap=port=>port&&Object.freeze(Object.fromEntries(Object.entries(port).filter(([,fn])=>typeof fn==='function').map(([name,fn])=>[name,async(...args)=>{
    check();try{const value=await fn(...args);check();return value;}catch(error){if(expected===epoch&&authErrors.has(error.code)){clear();forgetSession();}throw error;}
   }])));
   const current=createWorldGameHost({...options,accountId:id,revision:prefs.revision,connected:prefs.enabled&&currentAccount.capabilities?.learningSync===true,
    play:wrap(client.play),learning:wrap(client.learning),memory:wrap(client.memory),guard:check});
   gameHost=current;
   try{await current.ready();check();current.install();return current.publicHandle;}
   catch(error){current.dispose();if(gameHost===current)gameHost=null;throw error;}
  }catch(error){if(expected===epoch&&authErrors.has(error.code)){clear();forgetSession();}throw error;}
 }
 // 「내 성향」 answers about practised topics, read only to choose practice. Until the account server
 // opens this read to WORLD it refuses it (PRODUCT_FORBIDDEN): WORLD then chooses as before, and that
 // refusal never ends the session the way an authentication error does.
 async function topicAnswers(){
  const expected=epoch;
  if(closed||!owner||!session||typeof verifiedClient?.understandingLoad!=='function')return null;
  const id=owner,client=verifiedClient;
  try{
   const data=await client.understandingLoad();
   if(closed||expected!==epoch||owner!==id)return null;
   if(data?.ok!==true||data.scope!=='synk-personal'||data.resource!=='member-understanding'||data.accountId!==id)return null;
   return worldTopicAnswers(data.state,{now:now()});
  }catch{return null;}
 }
 async function prepareLifeProgress({storage:cache=globalThis.localStorage,onStatus=()=>{},target=globalThis}={}){
  const expected=epoch,launch=++lifeLaunch;guard(expected);
  if(!owner||!session)throw Object.assign(Error('SYNK ID로 로그인한 뒤 생활 한국어를 이어가요.'),{code:'AUTH_REQUIRED',status:401});
  lifeHost?.dispose();lifeHost=null;
  try{await verify(expected);guard(expected);if(launch!==lifeLaunch)throw changed();}
  catch(error){if(expected===epoch&&authErrors.has(error.code)){clear();forgetSession();}throw error;}
  const id=owner,client=verifiedClient;
  if(typeof client?.play?.load!=='function'||typeof client?.play?.mutate!=='function')throw Object.assign(Error('계정의 생활 한국어 저장이 아직 준비되지 않았어요. 잠시 뒤 다시 열어 주세요.'),{code:'PLAY_NOT_READY'});
  const check=()=>{guard(expected);if(launch!==lifeLaunch||owner!==id)throw changed();};
  const wrap=fn=>async(...args)=>{check();try{const value=await fn(...args);check();return value;}catch(error){if(expected===epoch&&authErrors.has(error.code)){clear();forgetSession();}throw error;}};
  const port=await createLifeProgressPort({accountId:id,client:{load:wrap(()=>client.play.load()),mutate:wrap(body=>client.play.mutate(body))},guard:check,storage:cache,target,onStatus,
   onDispose:value=>{if(lifeHost===value)lifeHost=null;}});
  check();lifeHost=port;return port;
 }
 // 손님 기기 학습 기록 옮기기(10-20, device-records.mjs): 지금 세운 계정 게임 호스트의 기록장으로만. 호스트가 없거나 계정이 바뀌었으면 받지 않는다.
 async function importDeviceLearning(events){
  const expected=epoch;guard(expected);
  if(!owner||!session||!gameHost)throw Object.assign(Error('계정 학습 기록 연결을 다시 열어 주세요.'),{code:'LEARNING_NOT_READY'});
  const host=gameHost,result=await host.importDeviceLearning(events);guard(expected);if(gameHost!==host)throw changed();return result;
 }
 async function prepareHangulProgress({storage:cache=globalThis.localStorage,target=globalThis}={}){
  const expected=epoch,launch=++hangulLaunch;guard(expected);
  if(!owner||!session)throw Object.assign(Error('SYNK ID로 로그인해 주세요.'),{code:'AUTH_REQUIRED'});
  hangulHost?.dispose();hangulHost=null;
  try{await verify(expected);guard(expected);}
  catch(error){if(expected===epoch&&authErrors.has(error.code)){clear();forgetSession();}throw error;}
  const id=owner,client=verifiedClient;
  const check=()=>{guard(expected);if(launch!==hangulLaunch||owner!==id)throw changed();};
  const wrap=fn=>async(...args)=>{check();try{const value=await fn(...args);check();return value;}catch(error){if(expected===epoch&&authErrors.has(error.code)){clear();forgetSession();}throw error;}};
  const port=await createHangulProgressPort({accountId:id,storage:cache,target,guard:check,client:{
   load:wrap(()=>client.play.load()),
   mutate:wrap(body=>client.play.mutate(body)),
  }});
  try{check();hangulHost=port;return port;}catch(error){port.dispose();throw error;}
 }
 async function request(path,options={}){
  if(!routes.has(path)||(options.method||'GET')!==routes.get(path))throw new TypeError('Unsupported WORLD request');
  const expected=epoch;guard(expected);if(!owner||!session)throw Object.assign(Error('SYNK ID로 로그인해 주세요.'),{code:'AUTH_REQUIRED',status:401});
  // Recheck account revocation before entering a long-lived town from another surface — then at most once a minute,
  // as the town reads itself again during timed scenes and at due times (W3).
  if(path==='town/state'&&now()-townVerifiedAt>=60000){await verify(expected);townVerifiedAt=now();}
  if(path==='town/entry'){townBinding=null;townStateRevision=-1;townVerifiedAt=-Infinity;}
  if(path==='town/sharing'&&!townBinding?.classId)throw Object.assign(Error('CLASSROOM_FORBIDDEN'),{code:'CLASSROOM_FORBIDDEN',status:403});
  if((path==='town/check'||path==='town/placement')&&native&&!nativeTownCheck)throw Object.assign(Error('PC 앱에서는 아직 마을 준비 확인을 열 수 없어요.'),{code:'TOWN_CHECK_UNSUPPORTED'});
  if((path==='town/pulse'||path==='town/boundary')&&native&&!nativeTownPulse)throw Object.assign(Error('PC 앱에서는 아직 이 마을 화면을 열 수 없어요. 브라우저의 SYNK WORLD에서 열어 주세요.'),{code:'TOWN_PULSE_UNSUPPORTED'});
  const accept=(data,ok,status)=>{
   guard(expected);
   if(status===401||authErrors.has(data?.error?.code)){clear();forgetSession();}
   if(ok&&path!=='town/sharing'&&!path.startsWith('enrollment/')&&data?.accountId!==owner)throw Object.assign(Error('다른 계정의 정보라서 반영하지 않았어요.'),{code:'ACCOUNT_MISMATCH'});
   if(ok&&data.binding){const next=data.binding;if(townBinding&&(next.classId!==townBinding.classId||Number(next.sharing?.revision)<Number(townBinding.sharing?.revision)||Number(next.membershipRevision)<Number(townBinding.membershipRevision)||next.sharing?.revision===townBinding.sharing?.revision&&townBinding.sharing?.enabled===false&&next.sharing?.enabled===true))throw Object.assign(Error('TOWN_SNAPSHOT_CHANGED'),{code:'TOWN_SNAPSHOT_CHANGED'});townBinding=next;}
   if(ok&&path.startsWith('town/')&&Number.isSafeInteger(data.state?.revision)){if(data.state.revision<townStateRevision)throw Object.assign(Error('TOWN_SNAPSHOT_CHANGED'),{code:'TOWN_SNAPSHOT_CHANGED'});townStateRevision=data.state.revision;}
   return {ok,status,json:async()=>{guard(expected);return data;}};
  };
  if(native){
   const body=options.body===undefined?undefined:JSON.parse(options.body);
   if(body!==undefined&&(!body||typeof body!=='object'||Array.isArray(body)))throw new TypeError('Invalid WORLD request body');
   const data=await bridge.accountRequest('worldRequest',{route:path,...(body===undefined?{}:{body}),...(path.startsWith('town/')&&!TOWN_ACCOUNT_ROUTES.has(path)&&townBinding?.classId?{classId:townBinding.classId}:{}),...(path==='homework/submit'||path==='homework/key'?{classId:body.classId}:{})});
   return accept(data,data?.ok===true,data?.ok===true?200:data?.error?.status||503);
  }
  const homework=path==='homework'||path.startsWith('homework/');
  const endpoint=path==='writing'?'world-writing':path==='speaking'?'world-speaking':path==='town/sharing'||path.startsWith('enrollment/')||homework?'synk-classroom':path.startsWith('town/')?'synk-town':'synk-world-v1',suffix=path==='writing'||path==='speaking'?'feedback':path==='town/sharing'?'api/world/town/sharing':path.startsWith('enrollment/')?`api/${path}`:homework?'api/world/homework'+(path==='homework/key'?'/key':''):path.startsWith('town/')?path.slice(5):path;
  const url=new URL(config.accountApiUrl);url.pathname=url.pathname.replace(/\/$/,'').replace(/\/functions\/v1(?:\/synk-(?:account|world-v1|town))?$/,'')+`/functions/v1/${endpoint}/${suffix}`;url.search='';url.hash='';if(path.startsWith('town/')&&!TOWN_ACCOUNT_ROUTES.has(path)&&townBinding?.classId)url.searchParams.set('classId',townBinding.classId);
  if(path==='homework/submit'||path==='homework/key')url.searchParams.set('classId',JSON.parse(options.body).classId);
  // 쓰기·말하기 자동 피드백은 한 번에 수십 초가 걸린다(서버 쪽 마감 85~90초).
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),path==='writing'||path==='speaking'?95000:12000);controllers.add(controller);
  try{
   if(session.expires_at<=now()+30000)await renew(expected);guard(expected);
   for(let attempt=0;attempt<2;attempt++){
    const token=session.access_token;const response=await fetcher(url.href,{method:options.method||'GET',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal,
     headers:{apikey:config.supabasePublishableKey,Authorization:`Bearer ${token}`,'X-SYNK-Product':'world','X-SYNK-Contract':'1','X-SYNK-App-Version':'1.0.0',...(options.body?{'Content-Type':'application/json'}:{})},...(options.body?{body:options.body}:{})});guard(expected);
    if(response.status===401&&attempt===0&&session.refresh_token){await renew(expected);guard(expected);continue;}
    const data=await response.json();guard(expected);
    return accept(data,response.ok,response.status);
   }
  }finally{clearTimeout(timer);controllers.delete(controller);}
 }
 // 「우리 반 수업」: 학생 앱과 같은 classroom 함수다. 계정 응답이 아니라 accountId가 없고, 함수의 401(명부 없음)은 로그아웃이 아니다(classroom-client.mjs).
 // PC 앱(native)은 토큰을 가진 본체가 같은 규칙으로 묻는다(desktop/src/world-requests.cjs의 classroom 경로). 그 경로를 알리지 않는 옛 PC 앱에서는 부르지 않는다.
 async function readClassrooms(){
  if(native&&!nativeClassroom)throw Object.assign(Error('PC 앱에서는 아직 수업 목록을 열 수 없어요.'),{code:'CLASSROOM_UNSUPPORTED'});
  const expected=epoch;guard(expected);if(!owner||!session)throw Object.assign(Error('SYNK ID로 로그인해 주세요.'),{code:'AUTH_REQUIRED',status:401});
  if(native){const data=await bridge.accountRequest('worldRequest',{route:'classroom'});guard(expected);return classroomReply(data);}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);controllers.add(controller);
  try{
   if(session.expires_at<=now()+30000){await renew(expected);guard(expected);}
   return await requestClassrooms({url:classroomEndpoint(config.accountApiUrl),publishableKey:config.supabasePublishableKey,token:()=>session.access_token,
    renew:()=>renew(expected),fetch:(url,init)=>fetcher(url,{...init,signal:controller.signal}),guard:()=>guard(expected)});
  }finally{clearTimeout(timer);controllers.delete(controller);}
 }
 // 「이번 주 과제」: 반 연결과 같은 synk-classroom 경로(웹은 이 탭의 SYNK ID 토큰, PC 앱은 본체). 과제 경로가 아직 없는 서버나 꺼진 반 기능이면
 // 빈 목록으로 보아 칸을 숨긴다(homework-client.mjs). 응답은 다른 계정 요청처럼 accountId가 이 계정과 같아야 쓴다.
 async function readHomework(){
  if(native&&!nativeHomework)throw Object.assign(Error('PC 앱에서는 아직 과제를 열 수 없어요.'),{code:'HOMEWORK_UNSUPPORTED'});
  const response=await request('homework'),data=await response.json();
  try{return homeworkReply(data,response.status);}catch(error){if(homeworkUnavailable(error))return {classes:[],emptyReason:'UNAVAILABLE'};throw error;}
 }
 async function readHomeworkKey({classId,week,kind}){
  if(!/^[0-9a-f-]{36}$/i.test(classId||'')||!Number.isInteger(week)||week<1||week>8||!['reading','writing'].includes(kind))throw new TypeError('과제 정답을 열 수 없어요. 과제를 다시 열어 주세요.');
  const response=await request('homework/key',{method:'POST',body:JSON.stringify({classId,week,kind})}),data=await response.json();
  if(!response.ok||data.ok!==true)throw Object.assign(Error('낸 과제의 정답을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'),{code:data.error?.code||'HOMEWORK_KEY_UNAVAILABLE',status:response.status});
  return data.key;
 }
 async function courseRequest(operation,params={}){
  if(!['classes','courseRead','courseSubmit','courseGroupSharing'].includes(operation))throw new TypeError('Unknown course operation');
  const expected=epoch;guard(expected);if(!owner||!session)throw Object.assign(Error('SYNK ID로 로그인해 주세요.'),{code:'AUTH_REQUIRED'});
  const scoped=()=>guard(expected),transport=native?createDesktopClassroomClient({bridge,product:'world',guard:scoped}):createClassroomTransport({url:config.accountApiUrl,anonKey:config.supabasePublishableKey,product:'world',getAccessToken:()=>session?.access_token,refresh:()=>renew(expected),guard:scoped,fetcher});
  const value=await transport(operation,params);scoped();return value;
 }
 // 「쓰기 연습」 자동 피드백(SYNK-talk world-writing 함수, TOPIK II 51~54). 웹만 — PC 앱 본체는 아직 이 경로를 모른다(칸이 숨는다).
 // 응답은 다른 계정 요청처럼 accountId가 이 계정과 같아야 쓴다. 꺼짐·한도·실패는 200 + status로 온다.
 async function writingRequest(payload){
  if(native)throw Object.assign(Error('PC 앱에서는 아직 자동 피드백을 쓸 수 없어요.'),{code:'WRITING_UNSUPPORTED'});
  const response=await request('writing',{method:'POST',body:JSON.stringify(payload)}),data=await response.json();
  if(!response.ok)throw Object.assign(Error(data?.code||'WRITING_UNAVAILABLE'),{code:data?.code||'WRITING_UNAVAILABLE',status:response.status});
  return data;
 }
 // 「말하기 연습」 자동 피드백(SYNK-talk world-speaking 함수 — 시험 형식 6유형·카페 역할극 한 차례). 쓰기와 같은 규칙: 웹만이고(PC 앱 본체는
 // 이 경로를 모른다), 응답은 accountId가 이 계정과 같아야 쓰며, 꺼짐·한도·실패는 200 + status, 형식 오류(400)·문항 바뀜(409)은 던진다.
 async function speakingRequest(payload){
  if(native)throw Object.assign(Error('PC 앱에서는 아직 말하기 자동 피드백을 쓸 수 없어요.'),{code:'SPEAKING_UNSUPPORTED'});
  const response=await request('speaking',{method:'POST',body:JSON.stringify(payload)}),data=await response.json();
  if(!response.ok)throw Object.assign(Error(data?.code||'SPEAKING_UNAVAILABLE'),{code:data?.code||'SPEAKING_UNAVAILABLE',status:response.status});
  return data;
 }
 // 「학습 알림 · 앱을 닫아도 받기」(SYNK-talk world-push 함수, 설계 qa/push-reminders-20261022). 웹만 — PC 앱 창은 푸시 서비스가 없다.
 // pushRequest는 이 탭의 SYNK ID로(status·subscribe·sync·unsubscribe), pushAnonymous는 로그인 없이 공개 키만으로(알림 누름 · 주소 + 기기 식별자 끄기).
 // 응답은 다른 계정 요청처럼 accountId가 있으면 이 계정과 같아야 쓴다. keepalive는 페이지를 떠날 때의 마지막 요약에만 쓴다.
 const pushUrl=()=>{const url=new URL(config.accountApiUrl);url.pathname=url.pathname.replace(/\/$/,'').replace(/\/functions\/v1(?:\/synk-(?:account|world-v1|town))?$/,'')+'/functions/v1/world-push/api';url.search='';url.hash='';return url.href;};
 const pushHeaders=token=>({apikey:config.supabasePublishableKey,Authorization:`Bearer ${token}`,'X-SYNK-Product':'world','X-SYNK-Contract':'1','X-SYNK-App-Version':'1.0.0','Content-Type':'application/json'});
 async function pushRequest(action,body={},{keepalive=false}={}){
  if(native)throw Object.assign(Error('PUSH_UNSUPPORTED'),{code:'PUSH_UNSUPPORTED'});
  const expected=epoch;guard(expected);if(!owner||!session)throw Object.assign(Error('SYNK ID로 로그인해 주세요.'),{code:'AUTH_REQUIRED',status:401});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);controllers.add(controller);
  try{
   if(session.expires_at<=now()+30000)await renew(expected);guard(expected);
   for(let attempt=0;attempt<2;attempt++){
    const response=await fetcher(pushUrl(),{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',keepalive,signal:keepalive?undefined:controller.signal,
     headers:pushHeaders(session.access_token),body:JSON.stringify({action,...body})});guard(expected);
    if(response.status===401&&attempt===0&&session.refresh_token){await renew(expected);guard(expected);continue;}
    const data=await response.json();guard(expected);
    if(response.status===401||authErrors.has(data?.error?.code)){clear();forgetSession();}
    if(!response.ok||data?.ok!==true)throw Object.assign(Error(data?.error?.code||'PUSH_UNAVAILABLE'),{code:data?.error?.code||'PUSH_UNAVAILABLE',status:response.status});
    if(data.accountId!==undefined&&data.accountId!==owner)throw Object.assign(Error('다른 계정의 정보라서 반영하지 않았어요.'),{code:'ACCOUNT_MISMATCH'});
    return data;
   }
   throw Object.assign(Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED',status:401});
  }finally{clearTimeout(timer);controllers.delete(controller);}
 }
 async function pushAnonymous(action,body={},{keepalive=false}={}){
  if(native||!['opened','unsubscribe'].includes(action))throw Object.assign(Error('PUSH_UNSUPPORTED'),{code:'PUSH_UNSUPPORTED'});
  // 로그인 없는 길도 12초에서 끊는다 — 멈춘 연결에 로그아웃·켜기가 묶이지 않게(10-23 화면 검수). 떠날 때(keepalive)는 끊지 않는다.
  const controller=new AbortController(),timer=keepalive?null:setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetcher(pushUrl(),{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',keepalive,signal:keepalive?undefined:controller.signal,headers:pushHeaders(config.supabasePublishableKey),body:JSON.stringify({action,...body})});
   const data=await response.json();
   if(!response.ok||data?.ok!==true)throw Object.assign(Error(data?.error?.code||'PUSH_UNAVAILABLE'),{code:data?.error?.code||'PUSH_UNAVAILABLE',status:response.status});
   return data;
  }finally{clearTimeout(timer);}
 }
 async function submitHomework(input){
  if(native&&!nativeHomework)throw Object.assign(Error('PC 앱에서는 아직 과제를 낼 수 없어요.'),{code:'HOMEWORK_UNSUPPORTED'});
  const response=await request('homework/submit',{method:'POST',body:JSON.stringify(homeworkSubmission(input))}),data=await response.json();
  return homeworkReply(data,response.status);
 }
 async function logout(){
  if(native){signedOutGeneration=Math.max(signedOutGeneration,nativeGeneration);clear();const result=await bridge.authSignOut();return {serverRevoked:result?.ok===true&&result.serverRevoked===true};}
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
 return Object.freeze({mode:'account',restore,signIn,request,logout,prepareGame,prepareLifeProgress,prepareHangulProgress,importDeviceLearning,topicAnswers,readClassrooms,readHomework,submitHomework,readHomeworkKey,courseRequest,writingRequest,speakingRequest,pushRequest,pushAnonymous,get supportsPush(){return !native;},get supportsWriting(){return !native;},get supportsSpeaking(){return !native;},get supportsClassroom(){return !native||nativeClassroom;},get supportsHomework(){return !native||nativeHomework;},get supportsTownCheck(){return !native||nativeTownCheck;},identity:()=>({accountId:owner,generation:epoch}),assertActive(){guard(epoch);if(!owner)throw changed();},
  preferences(){const learning=currentAccount?.learning;return learning&&typeof learning.enabled==='boolean'&&Number.isSafeInteger(learning.revision)?{enabled:learning.enabled,revision:learning.revision}:null;},
  async setLearning(enabled,expectedRevision){const expected=epoch;guard(expected);if(!owner||typeof enabled!=='boolean'||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new TypeError('Invalid account learning preference');
   const client=clientFor(expected);
   try{await client.setLearning(enabled,expectedRevision);guard(expected);await verify(expected);guard(expected);return this.preferences();}
   catch(error){if(authErrors.has(error.code)){clear();forgetSession();}throw error;}},
  async enrollmentRequest(operation,body){if(!['preview','claim'].includes(operation))throw new TypeError('Unknown enrollment operation');const response=await request(`enrollment/${operation}`,{method:'POST',body:JSON.stringify(body)});const data=await response.json();if(!response.ok||data.ok===false)throw Object.assign(Error(data.error?.message||'반 정보를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'),{code:data.error?.code||'ENROLLMENT_UNAVAILABLE',status:response.status});return data;},
  stop(){clear();closed=true;unsubscribe?.();unsubscribe=null;}});
}

export {loadWorldConfig,publicWorldConfig} from './operating-mode.mjs';
