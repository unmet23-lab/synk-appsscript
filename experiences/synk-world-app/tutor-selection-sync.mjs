import {readTutorChoice,saveTutorChoice} from '../brand-opening/tutor-choice.mjs';

const error=(code,message)=>Object.assign(new Error(message),{code});
// 로그인이 끝났다는 뜻의 계정 오류(world-account.mjs authErrors 가운데 세션이 끝난 것).
const SIGNED_OUT=new Set(['AUTH_REQUIRED','AUTH_SESSION_MISSING','SESSION_REVOKED','UNAUTHORIZED']);
// The selected companion shares the curriculum's existing account record and
// writer. Old clients preserve this optional field; a new Play key would make
// their strict account-state reader reject all progress.
export function restoreTutorSelection({progress,owner,storage,apply}){
 const status=progress.status();
 if(!status.scoped||['loading','conflict','unreadable','stopped'].includes(status.phase)||status.rejected)return;
 let tutor=progress.selectedTutor();
 // Legacy choices have no ordering timestamp. They can seed an empty account,
 // but must never overwrite a choice already saved on another device.
 if(!tutor){tutor=readTutorChoice(storage,owner);if(tutor)progress.selectTutor(tutor);}
 apply(tutor,owner);
}

export async function commitTutorSelection({progress,owner,tutor,storage,guard}){
 guard();
 if(owner==='guest')return {saved:saveTutorChoice(storage,owner,tutor),mode:'device'};
 if(!progress?.status().scoped)throw error('TUTOR_ACCOUNT_UNAVAILABLE','계정 저장이 준비된 뒤 다시 골라 주세요. 지금 튜터는 그대로예요.');
 progress.selectTutor(tutor);
 let failure=null;
 try{await progress.flush();}catch(cause){failure=cause;}
 guard();
 const status=progress.status();
 if(status.phase==='conflict'||status.rejected)throw error('REVISION_CONFLICT','다른 화면에서 기록이 바뀌었어요. 이어 갈 기록을 먼저 골라 주세요.');
 if(['unreadable','stopped'].includes(status.phase))throw failure||error('TUTOR_SAVE_UNAVAILABLE','기록을 읽지 못해 튜터를 저장하지 못했어요. 잠시 뒤 다시 골라 주세요.');
 // An offline queue is durable; a quota failure only has an in-memory draft.
 // Continue with the former and leave the chooser open for the latter.
 if(!status.saved&&!(status.pending>0&&status.phase!=='unsaved'))throw failure||error('TUTOR_SAVE_UNAVAILABLE','튜터 선택을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
 saveTutorChoice(storage,owner,tutor);
 return {saved:true,mode:'account',message:status.saved?'고른 튜터를 SYNK 계정에 저장했어요.':'고른 튜터는 이 기기에 두었어요. 인터넷이 연결되면 계정에 저장해요.'};
}

export function tutorSelectionStatus({owner,progress,ready}){
 if(owner==='guest')return {phase:'device',mode:'device',message:'고른 튜터는 이 기기에 저장돼요.'};
 if(!ready||!progress)return {phase:'loading',mode:'account',message:'계정의 튜터를 불러오고 있어요.'};
 const value=progress.status(),blocked=!!value.rejected||['conflict','unreadable','stopped'].includes(value.phase);
 const message=blocked?'이어 갈 기록을 먼저 골라 주세요.':!value.scoped?'계정 저장이 준비되면 고른 튜터를 저장해요.':value.phase==='synced'?'고른 튜터는 SYNK 계정에 저장돼요. 다른 기기에서도 같은 튜터예요.':value.phase==='saving'?'고른 튜터와 학습 기록을 계정에 저장하고 있어요.':'고른 튜터를 아직 계정에 저장하지 못했어요. 인터넷이 연결되면 다시 저장해요.';
 return {phase:value.phase,mode:'account',blocked,message};
}

// A title can finish before account restoration. Never make the first choice
// against that temporary guest, or let an old owner's chooser open their home.
// offer: 로그인 뒤 한 번 묻는 일(이 기기의 손님 기록 옮기기, 공개판 설계 §2). 물을 것이 없으면 거짓값을, 판을 띄웠으면
// 고르거나 닫으면 끝나는 약속을 돌려준다. 튜터 고르기 앞에서 열고, 옮기지 못해도 들어가는 길은 막지 않는다.
export function createWorldEntryGate({restore,prepare,read,choose,offer=null,onState=()=>{},onEnter=()=>{},onError=()=>{}}){
 let revision=0,phase='idle',selectedOwner=null;
 const identity=value=>`${value.owner}:${value.generation}`;
 const state=(next,extra={})=>{phase=next;onState({phase:next,...extra});};
 function invalidate(next='restoring'){revision++;selectedOwner=null;state(next);}
 async function start(){
  const ticket=++revision;state('restoring');
  try{
   await restore();if(ticket!==revision)return false;
   let value;
   for(;;){
    const before=read(),ready=await prepare();if(ticket!==revision)return false;
    value=read();if(identity(before)!==identity(value))continue;
    if(!ready){state('error',{message:'들어가기 전에 고를 것이 있어요. 열린 창에서 골라 주세요.'});return false;}
    break;
   }
   selectedOwner=identity(value);
   let offered=null;try{offered=offer?.(value)||null;}catch{offered=null;}
   if(offered){
    state('offering');
    try{await offered;}catch{/* 옮기기를 못 해도 이어 간다 */}
    if(ticket!==revision)return false;
    const latest=read();if(identity(latest)!==selectedOwner){void start();return false;}
    value=latest;
   }
   const enter=()=>{
    if(ticket!==revision)return false;
    if(phase==='ready')return true;
    const latest=read();
    if(identity(latest)!==selectedOwner){void start();return false;}
    if(!latest.tutor)return false;
    state('ready');onEnter(latest);return true;
   };
   if(value.tutor)return enter();
   state('choosing');await choose(enter);return phase==='ready';
  }catch(error){
   if(ticket!==revision)return false;
   // 입장 준비(되살리기·튜터·진도 읽기)의 모든 오류가 여기로 온다. 원인을 아는 것은 로그인이 끝난 경우뿐이고,
   // 나머지(인터넷 끊김·서버 오류·이 기기 저장소)는 함께 뜨는 복구 창의 단추 이름으로 안내한다.
   state('error',{message:SIGNED_OUT.has(error?.code)?'로그인이 끝났어요. 다시 로그인해 주세요.':'WORLD를 열지 못했어요. 「다시 불러오기」를 눌러 주세요.'});onError(error);return false;
  }
 }
 return Object.freeze({start,invalidate,cancel:()=>invalidate('idle'),state:()=>({phase,identity:selectedOwner})});
}
