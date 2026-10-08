'use strict';
let synkCompanyStatus=null,synkConnectionPending=false,synkRenewPending=false,synkRenewTimer=null,synkPageClosed=false,synkLogoutPending=false,synkAutomaticAttempt=null;
const getSynkDesktopBridge=()=>window.synkDesktop?.companyRequest?window.synkDesktop:null;
const synkPlatformEntryKey='synk.company.platform-entry.v1';
let synkPlatformEntry;
let synkNativeVerifiedAccount=null,synkNativeGateFailure=false,synkNativeMask=null;
let synkNativeVerifiedGeneration=null,synkNativeNeedsRecheck=false,synkRenewTask=null,synkNativeRecovery=null,synkNativeConfigured=false,synkNativeRestorePending=false;
let synkNativeObserverInstalled=false,synkNativeEventSequence=0,synkNativeLatestEvent=null;
function installNativeSynkObserver(){
  const desktop=getSynkDesktopBridge();if(!desktop?.onAuthChanged||synkNativeObserverInstalled)return;
  synkNativeObserverInstalled=true;
  desktop.onAuthChanged(auth=>{synkNativeEventSequence++;synkNativeLatestEvent=auth;if(synkNativeVerifiedAccount&&state.user&&(!auth.signedIn||auth.account?.synk_user_id!==synkNativeVerifiedAccount))maskNativeSynkCompany(true);if(!synkConnectionPending){void renewSynkCompanySession();void automaticallyEnterSynkCompany();}});
}
async function currentNativeSynkStatus(){
  const sequence=synkNativeEventSequence,auth=await getSynkDesktopBridge().authStatus(),latest=synkNativeLatestEvent;
  const signature=value=>JSON.stringify([value.signedIn,value.account?.synk_user_id,value.sessionGeneration]);
  if(latest&&(synkNativeEventSequence!==sequence&&signature(auth)!==signature(latest)||Number.isSafeInteger(latest.sessionGeneration)&&latest.sessionGeneration>auth.sessionGeneration))throw Object.assign(new Error('확인하는 동안 플랫폼 계정이 바뀌었어요. 다시 연결해 주세요.'),{code:'SYNK_PLATFORM_ENTRY'});
  return auth;
}
async function retryNativeSynkRestore(auth){
  const desktop=getSynkDesktopBridge();let result;
  try{result=await desktop.accountRequest('load',{});}
  catch{result={error:{code:'AUTH_SERVER_UNAVAILABLE',message:'저장된 로그인을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.',retryable:true}};}
  const nativeSequence=synkNativeEventSequence;
  const latest=await currentNativeSynkStatus();
  if(synkPageClosed||synkLogoutPending||synkNativeEventSequence!==nativeSequence||latest.sessionGeneration!==auth.sessionGeneration)throw Object.assign(new Error('확인하는 동안 플랫폼 계정이 바뀌었어요. 다시 연결해 주세요.'),{code:'SYNK_PLATFORM_ENTRY'});
  if(latest.signedIn)return latest;
  const error=latest.error||result?.error||{code:'AUTH_REQUIRED',message:'저장된 로그인을 확인하지 못했어요. SYNK ID로 다시 로그인해 주세요.'};
  throw Object.assign(new Error(error.message),error);
}
function readSynkPlatformEntry(){
  if(synkPlatformEntry!==undefined)return synkPlatformEntry;
  const url=new URL(location.href),params=new URLSearchParams(url.hash.slice(1)),values=params.getAll('synk-platform-account');
  const valid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
  const invalid=()=>Object.assign(new Error('플랫폼의 계정 연결을 확인하지 못했어요. 플랫폼에서 메신저를 다시 열어 주세요.'),{code:'SYNK_PLATFORM_ENTRY'});
  try{
    if(values.length){synkPlatformEntry=values.length===1&&valid(values[0])?{version:1,accountId:values[0].toLowerCase(),attempted:false}:{version:1,invalid:true};sessionStorage.setItem(synkPlatformEntryKey,JSON.stringify(synkPlatformEntry));params.delete('synk-platform-account');url.hash=params.toString();history.replaceState(null,'',url.pathname+url.search+url.hash);}
    else {const saved=sessionStorage.getItem(synkPlatformEntryKey);if(saved&&saved.length>1024)throw invalid();synkPlatformEntry=saved?JSON.parse(saved):null;}
    if(synkPlatformEntry&&(synkPlatformEntry.version!==1||!valid(synkPlatformEntry.accountId)||typeof synkPlatformEntry.attempted!=='boolean'))throw invalid();
    return synkPlatformEntry;
  }catch{synkPlatformEntry=undefined;throw invalid();}
}
async function prepareSynkCompanyEntry(){
  // Run before /api/me installs an identity or any company content is loaded.
  if(getSynkDesktopBridge())return prepareNativeSynkCompanyEntry();
  const intent=readSynkPlatformEntry();if(!intent)return true;
  // /api/me restores and revalidates encrypted company sessions after a restart.
  // Keep this response local until the expectation has been checked.
  const me=await api('/api/me');
  if(me.user&&me.synkUserId===intent.accountId)return {me};
  if(intent.attempted)throw Object.assign(new Error('플랫폼과 같은 계정으로 회사 연결을 완료하지 못했어요. 기존 회사 로그인을 종료하고 다시 연결할 수 있어요.'),{code:'SYNK_PLATFORM_ENTRY'});
  const status=await synkCompanyRequest('status');
  if(!status.enabled||!status.browserEnabled)throw new Error('회사 SYNK ID 연결을 준비하고 있어요. 잠시 뒤 플랫폼에서 다시 열어 주세요.');
  intent.attempted=true;sessionStorage.setItem(synkPlatformEntryKey,JSON.stringify(intent));
  const result=await synkCompanyRequest('start',{action:'login',expectedAccountId:intent.accountId});
  location.assign(result.authorizationUrl);return false;
}
async function prepareNativeSynkCompanyEntry(){
  installNativeSynkObserver();
  synkConnectionPending=true;
  try{
    let auth=await currentNativeSynkStatus();
    synkNativeConfigured=auth.configured===true;
    if(auth.configured!==true)return true;
    if(!auth.signedIn&&auth.error?.retryable){
      try{auth=await retryNativeSynkRestore(auth);}
      catch(error){if(error.code==='SYNK_PLATFORM_ENTRY')throw error;renderAuth();notify(error.message);return false;}
    }
    if(!auth.signedIn||!auth.account?.synk_user_id){renderAuth();return false;}
    const id=auth.account.synk_user_id,generation=auth.sessionGeneration;
    const current=async()=>{const latest=await currentNativeSynkStatus();if(!latest.signedIn||latest.account?.synk_user_id!==id||latest.sessionGeneration!==generation)throw Object.assign(new Error('플랫폼 계정 연결이 바뀌었어요. 다시 연결해 주세요.'),{code:'SYNK_PLATFORM_ENTRY'});};
    let me=await api('/api/me');await current();
    if(me.synkUserId!==id){
      const status=await synkCompanyRequest('status');await current();
      if(!status.enabled)throw new Error('회사 SYNK ID 연결을 준비하고 있어요.');
      const challenge=await synkCompanyRequest('challenge',{action:'login'});await current();
      await synkCompanyRequest('exchange',{challenge:challenge.challenge,confirm:true});await current();
      me=await api('/api/me');await current();
    }
    if(!me.user||me.synkUserId!==id)throw new Error('플랫폼과 같은 SYNK ID로 회사 연결을 확인하지 못했어요.');
    synkNativeVerifiedAccount=id;synkNativeVerifiedGeneration=generation;synkNativeNeedsRecheck=false;synkNativeGateFailure=false;maskNativeSynkCompany(false);return {me,nativeStamp:{sequence:synkNativeEventSequence,accountId:id,generation}};
  }catch(error){synkNativeGateFailure=true;throw Object.assign(error,{code:'SYNK_PLATFORM_ENTRY'});}
  finally{synkConnectionPending=false;}
}
function maskNativeSynkCompany(mask){
  const content=document.querySelector('#app');if(!content?.style)return;
  if(mask&&!synkNativeMask){
    const note=document.createElement('p');note.className='initial-loading';note.setAttribute('role','status');note.textContent='플랫폼의 SYNK ID 연결을 확인하고 있어요.';content.before(note);
    const nodes=['#app','#overlay','#toast','#workspace-messenger'].map(selector=>document.querySelector(selector)).filter(node=>node?.style).map(node=>({node,display:node.style.display,inert:node.inert}));
    synkNativeMask={note,nodes};for(const {node}of nodes){node.style.display='none';node.inert=true;}
  }else if(!mask&&synkNativeMask){for(const {node,display,inert}of synkNativeMask.nodes){node.style.display=display;node.inert=inert;}synkNativeMask.note.remove();synkNativeMask=null;}
}
function resetNativeSynkCompanyView(){
  if(state.user)return;
  if(synkNativeMask){closeModal();const toast=document.querySelector('#toast');if(toast){toast.textContent='';toast.classList?.remove('show');}maskNativeSynkCompany(false);}
  synkNativeVerifiedAccount=null;synkNativeVerifiedGeneration=null;synkNativeRecovery=null;synkNativeRestorePending=false;
}
function assertSynkCompanyPasswordAllowed(){
  if(!getSynkDesktopBridge()&&readSynkPlatformEntry())throw new Error('플랫폼에서 연결한 메신저는 위의 SYNK ID 로그인 버튼으로 다시 연결해 주세요.');
}
function assertSynkPlatformIdentity(me,entry){
  if(entry?.nativeStamp&&(entry.nativeStamp.sequence!==synkNativeEventSequence||me.synkUserId!==entry.nativeStamp.accountId))throw Object.assign(new Error('화면을 여는 동안 플랫폼 계정이 바뀌었어요. 다시 연결해 주세요.'),{code:'SYNK_PLATFORM_ENTRY'});
  if(synkPlatformEntry&&(!me.user||me.synkUserId!==synkPlatformEntry.accountId))throw Object.assign(new Error('확인하는 동안 회사 계정이 바뀌었어요. 플랫폼에서 메신저를 다시 열어 주세요.'),{code:'SYNK_PLATFORM_ENTRY'});
}
function renderSynkPlatformEntryRecovery(error){
  resetNativeSynkCompanyView();
  if(error.code!=='SYNK_PLATFORM_ENTRY'||!synkPlatformEntry&&!synkNativeGateFailure)return;
  const main=document.querySelector('#main .empty');if(!main)return;
  const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='기존 회사 로그아웃 후 다시 연결';
  button.onclick=async()=>{button.disabled=true;try{
    const response=await fetch('/api/me',{credentials:'same-origin'});if(!response.ok)throw Error('현재 회사 로그인을 확인하지 못했어요.');const me=await response.json();
    if(me.user){if(getSynkDesktopBridge())await synkCompanyRequest('logout',{csrfToken:me.csrfToken});else {const ended=await fetch('/api/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrfToken},body:'{}'});if(!ended.ok)throw Error('회사 로그아웃을 완료하지 못했어요.');}}
    if(synkPlatformEntry){synkPlatformEntry.attempted=false;sessionStorage.setItem(synkPlatformEntryKey,JSON.stringify(synkPlatformEntry));}location.reload();
  }catch(failure){notify(failure.message);button.disabled=false;}};main.append(button);
}
async function synkCompanyRequest(operation,params={}){
  let data;
  if(getSynkDesktopBridge())data=await getSynkDesktopBridge().companyRequest(operation,params);
  else {
    const response=await fetch('/api/synk-id/'+operation,{method:operation==='status'?'GET':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(params.csrfToken?{'X-CSRF-Token':params.csrfToken}:{})},...(operation==='status'?{}:{body:JSON.stringify(params)})});
    data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'SYNK ID 연결을 완료하지 못했어요.'),{code:data.code,status:response.status});
  }
  if(data?.ok===false||data?.error)throw Object.assign(new Error(data.error?.message||data.error||'SYNK ID 연결을 완료하지 못했어요.'),{code:data.error?.code||data.code,status:data.error?.status});return data;
}
function ensureNativeSynkCompanySession(){
  if(!getSynkDesktopBridge()||!synkNativeConfigured)return null;
  if(!synkNativeVerifiedAccount||!state.user)throw Object.assign(new Error('플랫폼의 회사 계정을 다시 확인해 주세요.'),{code:'SYNK_RECOVERY_REQUIRED'});
  const userId=state.user.id,csrf=state.csrf,generation=synkNativeVerifiedGeneration;
  const result=()=>{
    const recovered=synkNativeRecovery?.userId===userId&&synkNativeRecovery.from===csrf&&synkNativeRecovery.to===state.csrf;
    if(synkPageClosed||synkLogoutPending||state.user?.id!==userId||synkNativeVerifiedGeneration!==generation||state.csrf!==csrf&&!recovered||synkNativeNeedsRecheck||synkNativeMask)throw Object.assign(new Error('SYNK ID 연결을 확인한 뒤 다시 시도해 주세요.'),{code:'SYNK_RECOVERY_REQUIRED'});
    return {companyUserId:userId,csrfToken:state.csrf};
  };
  if(synkRenewTask)return synkRenewTask.then(result);
  if(synkNativeNeedsRecheck||synkNativeMask)return renewSynkCompanySession().then(result);
  return result();
}
async function recoverNativeSynkCompanySession(auth,current){
  const userId=state.user.id,csrf=state.csrf,id=synkNativeVerifiedAccount,generation=synkNativeVerifiedGeneration;
  synkNativeNeedsRecheck=true;synkNativeRestorePending=true;maskNativeSynkCompany(true);
  const changed=()=>Object.assign(new Error('플랫폼과 같은 회사 계정을 확인하지 못했어요. 다시 연결해 주세요.'),{code:'SYNK_RECOVERY_REQUIRED'});
  const guard=async()=>{const sequence=synkNativeEventSequence,latest=await currentNativeSynkStatus();if(!current()||sequence!==synkNativeEventSequence||!latest.signedIn||latest.account?.synk_user_id!==id||latest.sessionGeneration!==generation)throw changed();};
  const request=async(path,body)=>{const response=await fetch(path,{credentials:'same-origin',...(body?{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)}:{})}),data=await response.json();await guard();if(!response.ok)throw changed();return data;};
  try{
    if(!auth.signedIn||auth.account?.synk_user_id!==id||auth.sessionGeneration!==generation)throw changed();
    await guard();let me=await request('/api/me');
    if(!me.user){
      // Pin the expected account on the server too, before main supplies a token.
      const challenge=await request('/api/synk-id/challenge',{action:'login',expectedAccountId:id});
      await synkCompanyRequest('exchange',{challenge:challenge.challenge,confirm:true});await guard();me=await request('/api/me');
    }
    if(me.user?.id!==userId||me.synkUserId!==id||typeof me.csrfToken!=='string'||!me.csrfToken)throw changed();
    synkNativeRecovery={userId,from:csrf,to:me.csrfToken};state.csrf=me.csrfToken;state.user=me.user;synkNativeNeedsRecheck=false;synkNativeRestorePending=false;maskNativeSynkCompany(false);
  }catch(error){throw Object.assign(new Error(error.message),{code:'SYNK_RECOVERY_REQUIRED'});}
}
async function renewSynkCompanySession(){
  if(synkRenewTask)return synkRenewTask;
  const task=performSynkCompanyRenewal();synkRenewTask=task;
  try{return await task;}finally{if(synkRenewTask===task)synkRenewTask=null;}
}
async function performSynkCompanyRenewal(){
  if(!getSynkDesktopBridge()||synkRenewPending||synkConnectionPending||synkLogoutPending||synkPageClosed||document.hidden||!document.hasFocus()||!state.user)return;
  const userId=state.user.id,csrf=state.csrf,current=()=>!synkPageClosed&&!synkLogoutPending&&state.user?.id===userId&&state.csrf===csrf;
  synkRenewPending=true;
  try{
    const auth=await currentNativeSynkStatus();if(!current())return;
    const status=await synkCompanyRequest('status');if(!current())return;
    if(status.session!=='synk'||synkNativeRestorePending){if(synkNativeVerifiedAccount){const restored=!auth.signedIn&&auth.error?.retryable?await retryNativeSynkRestore(auth):auth;if(current())await recoverNativeSynkCompanySession(restored,current);}return;}
    if(['restoring','signing-in'].includes(auth.status))return;
    if(!auth.signedIn&&!auth.error?.retryable)throw Object.assign(new Error('SYNK ID로 다시 로그인해 주세요.'),{code:'AUTH_REQUIRED'});
    await synkCompanyRequest('renew',{csrfToken:csrf});
    // Main can emit restoring/signed-in while renewing the same saved token.
    // Fence the final status read, while still requiring the original generation.
    const nativeSequence=synkNativeEventSequence;
    const latest=await currentNativeSynkStatus();if(!current()||synkNativeEventSequence!==nativeSequence||latest.sessionGeneration!==auth.sessionGeneration)return;
    synkCompanyStatus=status;if(latest.signedIn&&latest.account?.synk_user_id===synkNativeVerifiedAccount){synkNativeNeedsRecheck=false;maskNativeSynkCompany(false);}
  }catch(error){
    if(!current())return;
    if(['SYNK_ACCOUNT_CHANGED','SYNK_IDENTITY_REJECTED','AUTH_REQUIRED','AUTH_CHANGED','SYNK_CSRF'].includes(error.code)){
      await synkCompanyRequest('logout',{csrfToken:csrf}).catch(()=>{});if(current())location.replace('/?tab=messenger');return;
    }
    if(synkNativeVerifiedAccount){synkNativeNeedsRecheck=true;maskNativeSynkCompany(true);}
    notify(error.message); // A temporary outage retains the session and retries at the next tick.
  }finally{synkRenewPending=false;}
}
async function logoutSynkCompany(){
  if(synkLogoutPending||synkPageClosed||!state.user)return {done:false};
  const userId=state.user.id,csrf=state.csrf,current=()=>!synkPageClosed&&state.user?.id===userId&&state.csrf===csrf;
  synkLogoutPending=true;clearInterval(synkRenewTimer);synkRenewTimer=null;
  try{
    const desktop=getSynkDesktopBridge(),status=await synkCompanyRequest('status');if(!current())return {done:false};
    const native=status.session==='synk'&&desktop?await desktop.authStatus():null;if(!current())return {done:false};
    const result=desktop?await synkCompanyRequest('logout',{csrfToken:csrf}):await api('/api/logout',{});if(!current())return {done:false};
    let warning=result.serverRevoked===false?'회사에서는 로그아웃했지만 SYNK ID 서버의 세션 종료는 확인하지 못했어요.':'';
    if(native){
      try{
        const latest=await desktop.authStatus();if(!current())return {done:false};
        if(latest.sessionGeneration!==native.sessionGeneration)warning='회사에서는 로그아웃했어요. 새로 바뀐 SYNK ID 로그인은 유지했어요.';
        else {const signedOut=await desktop.authSignOut();if(!current())return {done:false};if(signedOut.ok!==true)warning='회사에서는 로그아웃했지만 이 기기의 SYNK ID 정보 삭제를 완료하지 못했어요. 앱의 SYNK ID 로그아웃을 다시 실행해 주세요.';else if(signedOut.serverRevoked===false)warning='이 기기에서는 로그아웃했지만 SYNK ID 서버의 세션 종료는 확인하지 못했어요.';}
      }catch{warning='회사에서는 로그아웃했지만 이 기기의 SYNK ID 정보 삭제를 확인하지 못했어요. 앱의 SYNK ID 로그아웃을 다시 실행해 주세요.';}
    }
    synkCompanyStatus=null;return {done:true,warning};
  }finally{synkLogoutPending=false;}
}
function syncSynkRenewLoop(){
  clearInterval(synkRenewTimer);synkRenewTimer=null;
  if(getSynkDesktopBridge()&&!synkPageClosed&&!document.hidden&&document.hasFocus()){void renewSynkCompanySession();synkRenewTimer=setInterval(()=>void renewSynkCompanySession(),20_000);}
}
async function installSynkLogin(){
  const form=document.querySelector('#auth-form');if(!form||document.querySelector('#synk-id-login'))return;
  const section=document.createElement('section');section.className='synk-login-entry';section.innerHTML='<button type="button" class="btn synk-id-button" id="synk-id-login" disabled>SYNK ID로 로그인</button><p class="table-foot" id="synk-id-login-note" role="status">연결 상태를 확인하고 있어요.</p>';form.before(section);
  const button=section.querySelector('button'),note=section.querySelector('p');
  try{synkCompanyStatus=await synkCompanyRequest('status');if(!section.isConnected)return;button.disabled=!synkCompanyStatus.enabled||(!getSynkDesktopBridge()&&!synkCompanyStatus.browserEnabled);note.textContent=button.disabled?'SYNK ID 로그인은 연결 준비 중이에요. 아래 회사 계정을 이용해 주세요.':'회사 계정에 연결한 SYNK ID로 들어가요. 처음에는 회사 계정에서 연결해 주세요.';button.onclick=()=>beginSynkCompany('login',{},button,note);}
  catch(error){if(note.isConnected)note.textContent=error.message;}
  void automaticallyEnterSynkCompany();
}
async function automaticallyEnterSynkCompany(){
  const desktop=getSynkDesktopBridge(),button=document.querySelector('#synk-id-login'),note=document.querySelector('#synk-id-login-note');
  if(!desktop?.authStatus||!button?.isConnected||synkPageClosed||synkLogoutPending||synkConnectionPending||state.user||!synkCompanyStatus?.enabled)return;
  try{
    const auth=await desktop.authStatus();
    if(!auth.signedIn||!auth.account?.synk_user_id||!button.isConnected||state.user||synkPageClosed||synkLogoutPending||synkConnectionPending)return;
    const marker=JSON.stringify([auth.account.synk_user_id,auth.sessionGeneration]);
    if(synkAutomaticAttempt===marker)return;synkAutomaticAttempt=marker;
    await beginSynkCompany('login',{},button,note);
  }catch(error){if(note?.isConnected)note.textContent=error.message;}
}
async function waitForNativeSynk(){
  const desktop=getSynkDesktopBridge(),current=await desktop.authStatus();if(current.signedIn)return current;
  if(current.error?.retryable)return retryNativeSynkRestore(current);
  return new Promise((resolve,reject)=>{
    let stop=()=>{},settled=false,started=false,returned=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);stop();error?reject(error):resolve(value);};
    const timer=setTimeout(()=>{void desktop.authCancelSignIn();finish(new Error('로그인 확인이 만료됐어요. 다시 시작해 주세요.'));},4*60_000);
    const observe=value=>{if(['signing-in','restoring'].includes(value.status))started=true;if(value.signedIn)finish(null,value);else if(value.status==='error'||value.error)finish(new Error(value.error?.message||'SYNK ID 로그인을 완료하지 못했어요.'));else if(value.status==='signed-out'&&(started||returned))finish(new Error('SYNK ID 로그인을 취소했어요.'));};
    stop=desktop.onAuthChanged(observe);
    if(['restoring','signing-in'].includes(current.status)){started=true;desktop.authStatus().then(observe).catch(error=>finish(error));}
    else desktop.authSignIn().then(value=>{returned=true;observe(value);}).catch(error=>finish(error));
  });
}
async function beginSynkCompany(action,params={},button,note){
  if(synkConnectionPending)return;synkConnectionPending=true;if(button)button.disabled=true;
  try{
    const values={action,...params,csrfToken:state.csrf,confirm:true};
    if(!getSynkDesktopBridge()){if(action==='login'){const intent=readSynkPlatformEntry();if(intent){intent.attempted=true;sessionStorage.setItem(synkPlatformEntryKey,JSON.stringify(intent));values.expectedAccountId=intent.accountId;}}const result=await synkCompanyRequest('start',values);location.assign(result.authorizationUrl);return;}
    const challenge=await synkCompanyRequest('challenge',values);if(note){note.textContent='열린 브라우저에서 SYNK ID 로그인을 완료해 주세요.';const cancel=document.createElement('button');cancel.type='button';cancel.className='text-button';cancel.textContent='로그인 취소';cancel.onclick=()=>{void getSynkDesktopBridge().authCancelSignIn();cancel.remove();};note.append(document.createTextNode(' '),cancel);}
    const account=await waitForNativeSynk();
    if(action!=='login'){
      const title=action==='link'?'이 SYNK ID를 연결할까요?':'이 SYNK ID 연결을 해제할까요?';
      modal(title,escape(account.account?.display_name||'인증한 SYNK ID'),`<p class="table-foot">${action==='link'?'현재 회사 계정에 이 SYNK ID를 연결합니다. 다른 직원의 계정으로 바뀌지 않아요.':'회사 기록은 유지하고 이 SYNK ID로 들어오는 연결을 해제합니다.'}</p><button type="button" class="btn synk-id-button" id="synk-id-confirm">${action==='link'?'확인하고 연결':'확인하고 해제'}</button><button type="button" class="text-button" id="synk-id-confirm-cancel">취소</button><p id="synk-id-confirm-note" role="status"></p>`);
      await new Promise((resolve,reject)=>{const confirm=document.querySelector('#synk-id-confirm');const timeout=setTimeout(()=>reject(new Error('연결 확인이 만료됐어요. 다시 시작해 주세요.')),60_000);confirm.onclick=()=>{clearTimeout(timeout);confirm.disabled=true;resolve();};document.querySelector('#synk-id-confirm-cancel').onclick=()=>{clearTimeout(timeout);closeModal();reject(new Error('SYNK ID 연결 변경을 취소했어요.'));};});
    }
    await synkCompanyRequest('exchange',{challenge:challenge.challenge,confirm:true});location.replace('/?tab=messenger');
  }catch(error){if(note?.isConnected)note.textContent=error.message;else if(typeof notify==='function')notify(error.message);}
  finally{synkConnectionPending=false;if(button?.isConnected)button.disabled=false;}
}
async function openSynkIdentityDialog(){
  modal('SYNK ID 연결','회사 계정과 공통 로그인', '<p role="status">연결 상태를 확인하고 있어요.</p>');
  try{
    const status=await synkCompanyRequest('status');synkCompanyStatus=status;
    if(!status.enabled||(!getSynkDesktopBridge()&&!status.browserEnabled)){modal('SYNK ID 연결','연결 준비 중','<p class="table-foot">현재는 기존 회사 계정으로 이용할 수 있어요. 공통 로그인 설정이 완료되면 여기에서 연결할 수 있어요.</p>');return;}
    if(!status.canLink){modal('SYNK ID 연결','회사 비밀번호 확인이 필요해요','<p class="table-foot">회사 비밀번호를 먼저 설정한 뒤 다시 연결해 주세요. 직원 권한과 기존 기록을 지키기 위해 현재 회사 계정의 비밀번호를 확인해요.</p>');return;}
    const action=status.linked?'unlink':'link',label=status.linked?'SYNK ID 연결 해제':'SYNK ID 연결';
    modal(label,escape(state.user?.name||'내 회사 계정'),`<form id="synk-id-link-form" class="form-stack"><p class="table-foot">${status.linked?'현재 연결된 SYNK ID로 다시 인증해 주세요. 회사 기록은 그대로 보관돼요.':'기존 회사 계정의 본인 확인 후 SYNK ID를 연결해요. 직원 초대와 권한은 회사에서 따로 관리해요.'}</p><label class="field">현재 회사 비밀번호<input name="currentPassword" type="password" autocomplete="current-password" required maxlength="256"></label><label class="synk-confirm-label"><input type="checkbox" required> 이 회사 계정의 SYNK ID ${status.linked?'연결 해제':'연결'}를 확인했어요.</label><button class="btn synk-id-button" type="submit">${label}</button><p id="synk-id-link-note" role="status"></p></form>`);
    document.querySelector('#synk-id-link-form').onsubmit=event=>{event.preventDefault();const form=event.currentTarget,values=Object.fromEntries(new FormData(form));form.elements.currentPassword.value='';void beginSynkCompany(action,values,form.querySelector('button'),form.querySelector('p[role="status"]'));};
  }catch(error){notify(error.message);}
}
document.addEventListener('click',event=>{if(event.target.closest?.('[data-action="synk-id-account"]'))void openSynkIdentityDialog();});
document.addEventListener('DOMContentLoaded',()=>{
  const params=new URLSearchParams(location.search),failure=params.get('synkError'),connected=params.has('synkConnected');
  if(failure||connected){params.delete('synkError');params.delete('synkConnected');history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():'')+location.hash);notify(failure?'SYNK ID 연결을 완료하지 못했어요. 기존 회사 계정에서 다시 확인해 주세요.':'SYNK ID 연결을 완료했어요.');}
  if(getSynkDesktopBridge()){
    installNativeSynkObserver();
    syncSynkRenewLoop();window.addEventListener('focus',syncSynkRenewLoop);window.addEventListener('blur',()=>{synkNativeNeedsRecheck=true;clearInterval(synkRenewTimer);synkRenewTimer=null;});document.addEventListener('visibilitychange',()=>{if(document.hidden)synkNativeNeedsRecheck=true;syncSynkRenewLoop();});
    window.addEventListener('pagehide',()=>{synkPageClosed=true;clearInterval(synkRenewTimer);synkRenewTimer=null;});
  }
});
