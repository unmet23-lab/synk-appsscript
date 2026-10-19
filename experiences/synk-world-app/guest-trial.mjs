import {PLAY_WALLET_KEY,isPlayRecordKey,validatePlayValue,emptyPlayState} from '../play-common/play-data.mjs';

// 10-19 결정 「WORLD 손님」(공개판 설계 §2): 공개판(계정 모드) 손님은 바람길·말의 리듬을 한 판씩 해 볼 수 있고,
// 기록·코인 저장만 로그인 뒤다. 체험 판은 이 기기에서 게임마다 한 번이고, 판이 끝나면(결과 화면) 그 게임은 로그인부터 연다.
// 추천도 같은 목록(open)을 써서, 체험을 마친 게임으로 손님을 다시 보내 로그인 창을 맴돌게 하지 않는다.
export const GUEST_TRIAL_GAMES=Object.freeze(['runner','rhythm']);
export const GUEST_TRIAL_KEY='synk.world.guest-trial.v1';
const trialObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const trialTime=value=>Number.isSafeInteger(value)&&value>=0;
const trialFail=(code,message)=>Object.assign(new Error(message||code),{code});
const trialClone=value=>JSON.parse(JSON.stringify(value));

// 끝낸 체험은 이 기기에 남긴다. 저장소를 쓸 수 없으면 이 화면(페이지) 동안만 기억한다 — 체험 자체는 막지 않는다.
export function createGuestTrials({storage=globalThis.localStorage,now=Date.now}={}){
 const finished=new Map();
 function stored(){
  try{const value=JSON.parse(storage?.getItem(GUEST_TRIAL_KEY)||'null');return trialObject(value)&&value.version===1&&trialObject(value.games)?value.games:{};}catch{return {};}
 }
 const used=game=>GUEST_TRIAL_GAMES.includes(game)&&(finished.has(game)||trialTime(stored()[game]?.finishedAt));
 function finish(game){
  if(!GUEST_TRIAL_GAMES.includes(game))throw TypeError('Unknown guest trial game');
  if(used(game))return false;
  const at=now();finished.set(game,at);
  try{storage?.setItem(GUEST_TRIAL_KEY,JSON.stringify({version:1,games:{...stored(),[game]:{finishedAt:at}}}));}catch{/* 이 화면 동안만 기억한다 */}
  return true;
 }
 return Object.freeze({games:GUEST_TRIAL_GAMES,used,finish,open:()=>GUEST_TRIAL_GAMES.filter(game=>!used(game))});
}

// 손님 체험 판의 놀이 호스트. 게임 틀은 계정 호스트와 같은 계약(SynkPlayAccount)으로 이것을 받지만, 진도는 이 화면의 메모리에만 두고
// 코인은 주지 않는다. 판이 끝나며 오는 보상 요청(awardMiniGame)이 「한 판을 마쳤다」는 신호다.
// phase는 'guest'라서 WORLD 게임 화면의 계정 띠는 그대로 숨고, trial을 본 결과 화면이 로그인 안내를 낸다.
export function createGuestTrialPlayHost({game,onRound=()=>{},signIn=()=>{}}={}){
 if(!GUEST_TRIAL_GAMES.includes(game))throw TypeError('Unknown guest trial game');
 const records=new Map(),listeners=new Set(),purse=emptyPlayState().wallet;
 let stopped=false,used=false;
 const check=()=>{if(stopped)throw trialFail('PLAY_SESSION_ENDED','체험 판 연결이 끝났어요.');};
 const status=()=>({accountId:null,phase:stopped?'stopped':'guest',trial:true,game,used,pending:0,rejected:0,revision:0,canImport:false,
  message:used?'체험 판을 마쳤어요. 기록과 코인은 SYNK ID로 로그인한 뒤부터 저장돼요.':'체험 판이에요. 기록과 코인은 SYNK ID로 로그인한 뒤부터 저장돼요.'});
 function emit(){const value=status();for(const fn of listeners)try{fn(value);}catch{}}
 const storage=Object.freeze({
  get length(){check();return records.size+1;},
  key(index){check();return [PLAY_WALLET_KEY,...records.keys()][index]??null;},
  getItem(key){check();if(key===PLAY_WALLET_KEY)return JSON.stringify(purse);if(!isPlayRecordKey(key))throw trialFail('INVALID_PLAY_KEY');return records.get(key)??null;},
  setItem(key,value){check();if(key===PLAY_WALLET_KEY||!isPlayRecordKey(key))throw trialFail('INVALID_PLAY_KEY');records.set(key,validatePlayValue(key,value));},
  removeItem(key){check();if(key===PLAY_WALLET_KEY||!isPlayRecordKey(key))throw trialFail('INVALID_PLAY_KEY');records.delete(key);}
 });
 async function wallet(method,args=[]){
  check();
  if(['awardMiniGame','awardBeginnerPractice'].includes(method)){
   const round=args[0];
   if(!used&&trialObject(round)&&round.game===game&&round.automatic!==true){used=true;try{onRound({game,round:trialClone(round)});}catch{}emit();}
   return {coins:0,reason:'guest-trial',saved:false,state:trialClone(purse),breakdown:[],newAchievements:[]};
  }
  // 사기·입기·목표 정하기는 계정의 지갑에서만 한다.
  return {ok:false,reason:'guest-trial',saved:false,state:trialClone(purse)};
 }
 return Object.freeze({trial:true,game,status,wallet,ready:async()=>{check();return status();},retry:async()=>status(),flush:async()=>status(),
  storage:()=>{check();return storage;},snapshot:()=>{check();return {accountId:null,revision:0,state:{wallet:trialClone(purse),records:Object.fromEntries(records),imported:false}};},
  hasLegacy:()=>false,importLegacy:async()=>{throw trialFail('PLAY_GUEST_TRIAL','체험 판은 계정에 옮기지 않아요.');},resolve:async()=>{throw trialFail('PLAY_GUEST_TRIAL');},
  subscribe(fn){check();listeners.add(fn);fn(status());return()=>listeners.delete(fn);},
  signIn(){if(!stopped)signIn(game);},
  stop(){if(stopped)return;stopped=true;emit();listeners.clear();}});
}
