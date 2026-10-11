import {readTutorChoice,saveTutorChoice} from '../brand-opening/tutor-choice.mjs';

const error=(code,message)=>Object.assign(new Error(message),{code});
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
 if(!progress?.status().scoped)throw error('TUTOR_ACCOUNT_UNAVAILABLE','계정에 연결한 뒤 다시 골라 주세요. 기존 튜터는 그대로 두었어요.');
 progress.selectTutor(tutor);
 let failure=null;
 try{await progress.flush();}catch(cause){failure=cause;}
 guard();
 const status=progress.status();
 if(status.phase==='conflict'||status.rejected)throw error('REVISION_CONFLICT','다른 화면에서도 기록이 바뀌었어요. 저장 확인에서 사용할 기록을 골라 주세요.');
 if(['unreadable','stopped'].includes(status.phase))throw failure||error('TUTOR_SAVE_UNAVAILABLE','기록을 확인한 뒤 다시 골라 주세요.');
 // An offline queue is durable; a quota failure only has an in-memory draft.
 // Continue with the former and leave the chooser open for the latter.
 if(!status.saved&&!(status.pending>0&&status.phase!=='unsaved'))throw failure||error('TUTOR_SAVE_UNAVAILABLE','튜터 선택을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
 saveTutorChoice(storage,owner,tutor);
 return {saved:true,mode:'account',message:status.saved?'고른 튜터를 SYNK 계정에 저장했어요.':'선택은 이 기기에 보관했어요. 다시 연결되면 계정에 저장해요.'};
}

export function tutorSelectionStatus({owner,progress,ready}){
 if(owner==='guest')return {phase:'device',mode:'device',message:'선택은 이 기기에 기억해요.'};
 if(!ready||!progress)return {phase:'loading',mode:'account',message:'계정의 튜터를 불러오고 있어요.'};
 const value=progress.status(),blocked=!!value.rejected||['conflict','unreadable','stopped'].includes(value.phase);
 const message=blocked?'저장 확인에서 사용할 기록을 골라 주세요.':!value.scoped?'계정 연결을 다시 확인한 뒤 선택을 저장해요.':value.phase==='synced'?'선택은 SYNK 계정에 기억해요. 다른 기기에서도 함께해요.':value.phase==='saving'?'선택과 학습 기록을 계정에 저장하고 있어요.':'선택을 아직 계정에 저장하지 못했어요. 연결되면 다시 시도해요.';
 return {phase:value.phase,mode:'account',blocked,message};
}
