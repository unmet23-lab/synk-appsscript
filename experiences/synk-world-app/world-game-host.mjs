import {createWorldPlayHost} from '../play-common/account-host.mjs';
import learningHost from '../synk-account/src/generated/world-learning-host.cjs';
import learningBrowser from '../../atlas/game-browser.js';
import {scopedStorage} from '../synk-account/src/core.mjs';

// The rehearsal keeps each synthetic account's learning separate too. This uses
// the same host contract as account games, without claiming a server connection.
export function createLocalWorldLearningHost({owner,guard=()=>{},target=globalThis,storage=globalThis.localStorage}){
 const accountKey=`local:${owner}`,revision=1;
 const host=learningHost.createWorldLearningHost({accountKey,revision,connected:false,guard,engine:learningBrowser.engine,
  storage:scopedStorage(storage,accountKey,revision,guard)});
 target.SYNKLearningHost=host;
 return {dispose(){if(target.SYNKLearningHost===host)delete target.SYNKLearningHost;host.stop();}};
}

// The verified WORLD entry owns both ports. Frames get the existing public host
// contracts; neither a credential nor a general account request crosses here.
export function createWorldGameHost({accountId,revision,connected,play,learning,memory,guard,
 target=globalThis,storage=globalThis.localStorage,onStatus=()=>{},engine=learningBrowser.engine}){
 let disposed=false,installed=false;
 const check=()=>{guard();if(disposed)throw Object.assign(Error('이 놀이는 닫혔어요. 놀이를 다시 열어 주세요.'),{code:'ACCOUNT_CHANGED'});};
 const accountKey=connected?accountId:`local:${accountId}`;
 const notify=()=>{try{onStatus(status());}catch{/* Observers cannot change save ownership. */}};
 const playHost=createWorldPlayHost({accountId,client:play,guard:check,storage,locks:target.navigator?.locks,onStatus:()=>notify()});
 const learnHost=learningHost.createWorldLearningHost({accountKey,revision,connected,guard:check,engine,
  storage:scopedStorage(storage,accountKey,revision,check),transport:learning,
  personalMemory:{accountKey,revision,connected,storage:scopedStorage(storage,accountKey,revision,check),transport:memory},onStatus:()=>notify()});
 function status(){return {accountId,play:playHost.status(),learning:learnHost.status(),disposed};}
 const flush=async()=>{check();if(playHost.status().phase==='conflict')throw Object.assign(Error(playHost.status().message),{code:playHost.status().code||'REVISION_CONFLICT'});await Promise.all([playHost.flush(),learnHost.flush()]);check();};
 const retry=()=>{if(disposed||['conflict','stopped'].includes(playHost.status().phase))return;void Promise.resolve().then(()=>Promise.all([playHost.retry(),learnHost.retry()])).catch(()=>{});};
 const visibility=()=>{if(target.document?.visibilityState==='hidden')void flush().catch(()=>{});else retry();};
 function dispose(){
  if(disposed)return;disposed=true;
  target.document?.removeEventListener?.('visibilitychange',visibility);target.removeEventListener?.('online',retry);
  // A stale launch may finish after its successor; remove only its own globals.
  if(target.SYNKPlayHost===playHost)delete target.SYNKPlayHost;
  if(target.SYNKLearningHost===learnHost)delete target.SYNKLearningHost;
  playHost.stop();learnHost.stop();
 }
 // 손님 기기 학습 기록 옮기기(10-20, device-records.mjs guestLearningEvents): 학생이 「옮기기」를 고른 뒤에만 이 계정의 학습 기록에
 // 사건 그대로 더한다(atlas/game-learning.js importEvents — 사건 ID로 중복을 빼고, 같은 ID에 다른 내용이면 받지 않는다).
 // 이 기록장은 learnHost의 동기화가 맡은 계정 기록과 같은 자리라, 동기화가 다음에 보낼 때 서버로 올린다.
 // 서버가 받았다고 답해 보낼 것이 남지 않았을 때만 confirmed다(못 받으면 손님 기록은 그대로이고 다시 고를 수 있다).
 async function importDeviceLearning(events,{timeoutMs=20000,pollMs=250,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  check();
  if(!Array.isArray(events)||!events.length)return {added:0,skipped:0,confirmed:true};
  const adapter=engine.createGame({gameId:'world-device-import',storage:scopedStorage(storage,accountKey,revision,check),learnerKey:'device',storageScope:'account',accountKey,
   historyComplete:!connected,fold:false});
  const result=adapter.syncPort.importEvents(events);check();
  if(!connected)return {added:result.added,skipped:result.skipped.length,confirmed:true,local:true};
  // 동기화가 아직 없으면(놀이 충돌로 준비가 일찍 끝난 경로) 세운다. 없는 동기화의 'idle'은 보낸 것이 아니다(10-21 검수).
  try{learnHost.preferences?.();}catch{/* the status below decides */}
  const until=Date.now()+timeoutMs;let timer,retried;
  try{retried=await Promise.race([Promise.resolve().then(()=>learnHost.retry?.()).then(()=>true,()=>true),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),Math.max(0,until-Date.now()));})]);}finally{clearTimeout(timer);}
  check();
  for(;;){
   check();const state=learnHost.status();
   if(['blocked','stopped','offline'].includes(state.phase))return {added:result.added,skipped:result.skipped.length,confirmed:false,code:state.code||state.phase.toUpperCase()};
   if(!state.queued&&(state.phase==='synced'||!result.added&&state.phase==='idle'))return {added:result.added,skipped:result.skipped.length,confirmed:true};
   if(!retried||Date.now()>=until)return {added:result.added,skipped:result.skipped.length,confirmed:false,code:'TIMEOUT'};
   await sleep(Math.min(pollMs,Math.max(0,until-Date.now())));
  }
 }
 const publicHandle=Object.freeze({status,flush,async resolve(choice){check();await playHost.resolve(choice);check();return status();},closeGame(){
  if(disposed)return;
  try{check();learnHost.closeRun();void flush().catch(()=>{});}catch{/* Account invalidation already fenced old ports. */}
 },dispose});
 return Object.freeze({publicHandle,async ready(){
  check();
  try{await playHost.ready();}catch(error){if(playHost.status().phase==='conflict'){check();return;}throw error;}
  check();
  // Build the parent's account-wide engine before the frame snapshots settings.
  learnHost.preferences();await learnHost.ready();check();
 },install(){
  check();if(playHost.status().phase==='conflict')return;
  target.SYNKPlayHost=playHost;target.SYNKLearningHost=learnHost;
  if(!installed){installed=true;target.document?.addEventListener?.('visibilitychange',visibility);target.addEventListener?.('online',retry);}
 },dispose,importDeviceLearning});
}
