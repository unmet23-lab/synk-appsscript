// The bridge owns consent, encryption, expiration and account binding. No draft
// content or account identifier is ever written to browser storage here.
export function createDraftRecovery({bridge,slot,getContext,getDraft,onCandidate=()=>{},onError=()=>{},onStateChange=()=>{},delay=250}) {
  let key='',revision=0,enabled=false,readReady=false,protectedDraft=false,timer=null,candidate=null,disposed=false,loading=false,error=null;
  const contextKey=()=>{const context=getContext();return context?.status==='ready'&&context.owner&&context.owner!=='anonymous-local'?JSON.stringify([context.owner,[...context.appIds].sort()]):'';};
  const matches=(expected,k)=>!disposed&&expected===revision&&k===key&&k===contextKey();
  const state=()=>({error:error?{...error}:null,retryable:!!error&&!loading&&!!key&&key===contextKey(),pending:loading});
  let lastState='';
  function notify(){const value=state(),serialized=JSON.stringify(value);if(serialized!==lastState){lastState=serialized;onStateChange(value);}}
  function cancel(){clearTimeout(timer);timer=null;}
  function present(value){if(candidate===value)return;candidate=value;onCandidate(value);}
  function failure(result,message){const code=result?.code||result?.error?.code;error={code:typeof code==='string'&&/^[A-Z_]{1,80}$/.test(code)?code:'DRAFT_STORAGE_FAILED',message};notify();onError(message);}
  async function refresh({force=false}={},invalidatePending=false){
    if(disposed||typeof bridge?.draftRecoveryStatus!=='function')return;
    const next=contextKey();
    // Consumers refresh while rendering, including from our own callbacks.
    // Same-context failures only retry through retry()/force or a bridge event.
    if(next===key&&(!force||loading&&!invalidatePending))return;
    const same=next===key;
    cancel();key=next;enabled=false;readReady=false;protectedDraft=false;loading=!!next;if(!same)error=null;
    const expected=++revision;present(null);notify();
    if(!next)return;
    try{
      const status=await bridge.draftRecoveryStatus(getContext().owner);
      if(!matches(expected,next))return;
      if(status?.ok!==true)throw status;
      if(typeof status.available!=='boolean'||typeof status.enabled!=='boolean')throw {code:'DRAFT_RESPONSE_INVALID'};
      enabled=status.available&&status.enabled;
      if(!enabled){readReady=true;error=null;return;}
      const result=await bridge.draftRecoveryLoad(slot,getContext().owner);
      if(!matches(expected,next))return;
      if(result?.ok!==true)throw result;
      if(typeof result.enabled!=='boolean'||result.enabled&&!Object.hasOwn(result,'draft'))throw {code:'DRAFT_RESPONSE_INVALID'};
      enabled=result.enabled;readReady=true;error=null;
      if(!enabled)return;
      const draft=result.draft;
      // Permission controls visibility, not permission to overwrite this slot.
      // A hidden draft remains protected until its app access is restored.
      protectedDraft=draft!==null&&draft!==undefined;
      if(draft&&getContext().appIds.includes(draft.appId))present({draft,updatedAt:result.updatedAt});
    }catch(result){if(matches(expected,next)){enabled=false;readReady=false;failure(result,'초안 복구 상태를 확인하지 못했어요. 작성 내용은 이 창에 남아 있어요.');}}
    finally{if(matches(expected,next)){loading=false;notify();if(readReady&&enabled&&!protectedDraft&&getDraft())changed();}}
  }
  async function persist(expected,k,payload){
    if(!enabled||!readReady||loading||protectedDraft||!matches(expected,k))return false;
    try{
      const result=await bridge.draftRecoverySave(slot,payload,getContext().owner);
      if(!matches(expected,k))return false;
      if(result?.ok!==true){failure(result,'초안 복구본을 보관하지 못했어요. 창을 닫기 전에 메모를 저장해 주세요.');return false;}
      error=null;notify();return true;
    }catch(result){if(matches(expected,k))failure(result,'초안 복구본을 보관하지 못했어요. 창을 닫기 전에 메모를 저장해 주세요.');return false;}
  }
  function changed(){
    cancel();if(!enabled||!readReady||loading||protectedDraft||!key||contextKey()!==key)return;
    const payload=getDraft();if(!payload)return;
    const expected=revision,k=key;
    timer=setTimeout(()=>{timer=null;void persist(expected,k,payload);},delay);
  }
  async function clear({discardCandidate=false}={}){
    cancel();
    if(disposed)return false;
    if(!contextKey()||typeof bridge?.draftRecoveryStatus!=='function')return true;
    // Empty input and successful note saves also call clear(). Neither is an
    // instruction to discard an unread or not-yet-selected recovery candidate.
    if(!key||key!==contextKey()||loading||!readReady||protectedDraft&&(!discardCandidate||!candidate))return false;
    if(!enabled)return true;
    const expected=++revision,k=key;readReady=false;
    try{
      const result=await bridge.draftRecoveryClear?.(slot,getContext().owner);
      if(!matches(expected,k))return false;
      if(result?.ok!==true){failure(result,'복구본을 지우지 못했어요. 다시 확인한 뒤 시도해 주세요.');return false;}
      enabled=result.available===true&&result.enabled===true;readReady=true;protectedDraft=false;error=null;present(null);notify();return true;
    }catch(result){if(matches(expected,k))failure(result,'복구본을 지우지 못했어요. 다시 확인한 뒤 시도해 주세요.');return false;}
  }
  function take(){
    if(!candidate||!enabled||!readReady||loading||!key||key!==contextKey())return null;
    cancel();++revision;
    const result=candidate.draft;protectedDraft=false;present(null);return result;
  }
  async function flush(){cancel();const payload=getDraft();return payload?persist(revision,key,payload):false;}
  // A changed native consent state supersedes an in-flight read. Repeated user
  // retry clicks are coalesced, but a real consent change must invalidate it.
  const unsubscribe=bridge?.onDraftRecoveryChanged?.(()=>{void refresh({force:true},true);});
  return {refresh,retry:()=>refresh({force:true}),changed,clear,take,flush,get state(){return state();},get hasUnselectedDraft(){return !disposed&&readReady&&protectedDraft&&key===contextKey();},get pending(){return loading;},dispose(){disposed=true;++revision;cancel();unsubscribe?.();}};
}
