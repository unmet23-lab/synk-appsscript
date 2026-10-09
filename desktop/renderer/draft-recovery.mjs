// The bridge owns consent, encryption, expiration and account binding. No draft
// content or account identifier is ever written to browser storage here.
export function createDraftRecovery({bridge,slot,getContext,getDraft,onCandidate=()=>{},onError=()=>{},delay=250}) {
  let key='',revision=0,enabled=false,timer=null,candidate=null,disposed=false,loading=false;
  const contextKey=()=>{const context=getContext();return context?.status==='ready'&&context.owner&&context.owner!=='anonymous-local'?JSON.stringify([context.owner,[...context.appIds].sort()]):'';};
  const matches=(expected,k)=>!disposed&&expected===revision&&k===key&&k===contextKey();
  function cancel(){clearTimeout(timer);timer=null;}
  function present(value){candidate=value;onCandidate(value);}
  async function refresh({force=false}={}){
    if(disposed||typeof bridge?.draftRecoveryStatus!=='function')return;
    const next=contextKey();
    if(next===key&&!force)return;
    cancel();key=next;enabled=false;loading=!!next;const expected=++revision;present(null);
    if(!next){loading=false;return;}
    try{
      const status=await bridge.draftRecoveryStatus(getContext().owner);
      if(!matches(expected,next))return;
      enabled=status?.ok===true&&status.available===true&&status.enabled===true;
      if(!enabled)return;
      const result=await bridge.draftRecoveryLoad(slot,getContext().owner);
      if(!matches(expected,next)||!result?.ok||!result.enabled)return;
      const draft=result.draft;
      if(draft&&getContext().appIds.includes(draft.appId))present({draft,updatedAt:result.updatedAt});
      // Typing that happened while consent was loading is still backed up.
      if(getDraft())changed();
    }catch{if(matches(expected,next))onError('초안 복구 상태를 확인하지 못했어요. 작성 내용은 이 창에 남아 있어요.');}
    finally{if(matches(expected,next))loading=false;}
  }
  async function persist(expected,k,payload){
    if(!enabled||!matches(expected,k))return false;
    try{
      const result=await bridge.draftRecoverySave(slot,payload,getContext().owner);
      if(!matches(expected,k))return false;
      if(!result?.ok){onError('초안 복구본을 보관하지 못했어요. 창을 닫기 전에 메모를 저장해 주세요.');return false;}
      return true;
    }catch{if(matches(expected,k))onError('초안 복구본을 보관하지 못했어요. 창을 닫기 전에 메모를 저장해 주세요.');return false;}
  }
  function changed(){
    cancel();if(!enabled||!key||contextKey()!==key)return;
    const payload=getDraft();if(!payload)return;
    const expected=revision,k=key;
    timer=setTimeout(()=>{timer=null;void persist(expected,k,payload);},delay);
  }
  async function clear(){
    cancel();++revision;loading=false;present(null);if(!key||key!==contextKey())return true;
    const expected=revision,k=key;
    try{const result=await bridge.draftRecoveryClear?.(slot,getContext().owner);if(!matches(expected,k))return false;if(result?.ok===false)onError('복구본을 지우지 못했어요. 설정에서 초안 복구를 껐다가 다시 켜 주세요.');else enabled=result?.available===true&&result?.enabled===true;return result?.ok===true;}
    catch{if(matches(expected,k))onError('복구본을 지우지 못했어요. 설정에서 초안 복구를 껐다가 다시 켜 주세요.');return false;}
  }
  function take(){
    if(!candidate||!enabled||!key||key!==contextKey())return null;
    cancel();++revision;loading=false;
    const result=candidate.draft;present(null);return result;
  }
  async function flush(){cancel();const payload=getDraft();return payload?persist(revision,key,payload):false;}
  const unsubscribe=bridge?.onDraftRecoveryChanged?.(()=>{void refresh({force:true});});
  return {refresh,changed,clear,take,flush,get pending(){return loading;},dispose(){disposed=true;++revision;cancel();unsubscribe?.();}};
}
