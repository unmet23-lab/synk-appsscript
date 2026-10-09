'use strict';
// expectedOwner is a precondition, never an identity selector. The encrypted
// store always binds its operation to the verified main-process account.
function createDraftRecoveryRequests({getAccount,recovery}){
  function invoke(expectedOwner,operation,{guestStatus=false}={}){
    const state=getAccount(),owner=state?.signedIn===true&&state.status==='signed-in'?state.account?.synk_user_id:null;
    if(!owner&&guestStatus&&expectedOwner==null)return {ok:true,available:recovery.available(),enabled:false};
    if(typeof expectedOwner!=='string'||!expectedOwner||!owner||expectedOwner!==owner)return {ok:false,code:'AUTH_CHANGED'};
    return operation();
  }
  return {
    status:owner=>invoke(owner,()=>recovery.status(),{guestStatus:true}),
    setEnabled:(enabled,owner)=>invoke(owner,()=>recovery.setEnabled(enabled)),
    load:(slot,owner)=>invoke(owner,()=>recovery.load(slot)),
    save:(slot,value,owner)=>invoke(owner,()=>recovery.save(slot,value)),
    clear:(slot,owner)=>invoke(owner,()=>recovery.clear(slot)),
  };
}
module.exports={createDraftRecoveryRequests};
