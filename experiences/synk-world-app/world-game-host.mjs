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
 const check=()=>{guard();if(disposed)throw Object.assign(Error('게임 계정 연결이 끝났어요.'),{code:'ACCOUNT_CHANGED'});};
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
 },dispose});
}
