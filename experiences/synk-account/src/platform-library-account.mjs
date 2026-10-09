// A narrow notebook adapter over the platform's existing authenticated host.
// Never reads or copies tokens, and never accepts an arbitrary endpoint/resource.
export function platformLibraryAccount({ host, native=false, onLogin=()=>{}, onManage=()=>{}, onStatus=()=>{} }) {
  let current={signedIn:false,configured:false,status:'unconfigured',accountId:null,sessionGeneration:0},closed=false,unsubscribe=null,epoch=0,notification=0,nativeRetry=null;
  const receive=source=>{
    if(closed)return current;
    if(Number.isSafeInteger(source?.sessionGeneration)&&Number.isSafeInteger(current.sessionGeneration)&&source.sessionGeneration<current.sessionGeneration)return {...current};
    notification++;
    const accountId=native?source?.account?.synk_user_id:source?.accountId;
    current={...source,accountId:source?.signedIn===true&&typeof accountId==='string'?accountId:null};
    current.signedIn=!!current.accountId;
    onStatus({...current});return {...current};
  };
  async function nativeAction(action,recheck=false){
    const attempt=++epoch,observed=notification,result=await action();
    if(closed||attempt!==epoch)return {...current};
    const readObserved=recheck?notification:observed;
    if(recheck||observed===notification){const value=await host.authStatus();if(!closed&&attempt===epoch&&readObserved===notification)receive(value);}
    if(closed||attempt!==epoch)return {...current};
    return {...current,...(result?.ok===false?{ok:false}:{}),...(typeof result?.serverRevoked==='boolean'?{serverRevoked:result.serverRevoked}:{})};
  }
  async function retryNativeIdentity(){
    if(closed)return {...current};
    if(nativeRetry)return nativeRetry;
    if(typeof host.accountRequest!=='function')throw Object.assign(new Error('저장된 계정 연결을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.'),{code:'AUTH_REQUEST_UNAVAILABLE',retryable:true});
    const task=nativeAction(()=>host.accountRequest('load',{}),true);nativeRetry=task;
    try{return await task;}finally{if(nativeRetry===task)nativeRetry=null;}
  }
  async function retryWebIdentity(){
    const attempt=++epoch,observed=notification;
    await host.refresh();
    if(closed||attempt!==epoch)return {...current};
    return observed===notification?receive(host.identity()):{...current};
  }
  return {
    async start(){const attempt=++epoch;unsubscribe?.();unsubscribe=native?host.onAuthChanged(receive):host.subscribe(receive);const observed=notification;const value=native?await host.authStatus():(await host.refresh(),host.identity());if(!closed&&attempt===epoch&&(!native||observed===notification))return receive(value);return {...current};},
    status:()=>({...current}),
    async request(operation,params){
      const mapped={personalLoad:'platformLoad',personalSave:'platformSave',personalDelete:'platformDelete'}[operation];
      if(!mapped||closed||!current.signedIn)throw Object.assign(new Error('플랫폼 계정 연결을 다시 확인해 주세요.'),{code:'AUTH_REQUIRED'});
      const owner=current.accountId,generation=current.sessionGeneration;
      const result=await (native?host.accountRequest(mapped,params):host.request(mapped,params));
      if(closed||!current.signedIn||owner!==current.accountId||generation!==current.sessionGeneration)throw Object.assign(new Error('계정 연결이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});
      if(result?.ok===false)throw Object.assign(new Error(result.error?.message||'계정 연결을 확인해 주세요.'),result.error||{},Number.isSafeInteger(result.revision)?{revision:result.revision}:{});
      return result?.data||result;
    },
    async signIn(){
      if(native)return !current.signedIn&&current.error?.retryable===true?retryNativeIdentity():nativeAction(()=>host.authSignIn());
      if(closed)return {...current};
      // An uncertain session needs a fresh identity before an explicit login navigation.
      if(current.status!=='signed-out'||current.signedIn||current.error?.retryable)return retryWebIdentity();
      onLogin();return {...current};
    },
    async retryConnection(){if(!native||closed||current.signedIn||current.error?.retryable!==true)return {...current};return retryNativeIdentity();},
    async signOut(){if(native)return nativeAction(()=>host.authSignOut());onManage();return {ok:false,message:'계정 관리에서 로그아웃을 완료해 주세요.'};},
    dispose(){closed=true;epoch++;unsubscribe?.();},
  };
}
