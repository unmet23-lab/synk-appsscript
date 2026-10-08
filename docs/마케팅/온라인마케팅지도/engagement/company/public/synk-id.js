'use strict';
let synkCompanyStatus=null,synkConnectionPending=false,synkRenewPending=false,synkRenewTimer=null,synkPageClosed=false,synkLogoutPending=false;
const getSynkDesktopBridge=()=>window.synkDesktop?.companyRequest?window.synkDesktop:null;
async function synkCompanyRequest(operation,params={}){
  let data;
  if(getSynkDesktopBridge())data=await getSynkDesktopBridge().companyRequest(operation,params);
  else {
    const response=await fetch('/api/synk-id/'+operation,{method:operation==='status'?'GET':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(params.csrfToken?{'X-CSRF-Token':params.csrfToken}:{})},...(operation==='status'?{}:{body:JSON.stringify(params)})});
    data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'SYNK ID 연결을 완료하지 못했어요.'),{code:data.code,status:response.status});
  }
  if(data?.ok===false||data?.error)throw Object.assign(new Error(data.error?.message||data.error||'SYNK ID 연결을 완료하지 못했어요.'),{code:data.error?.code||data.code,status:data.error?.status});return data;
}
async function renewSynkCompanySession(){
  if(!getSynkDesktopBridge()||synkRenewPending||synkConnectionPending||synkLogoutPending||synkPageClosed||document.hidden||!document.hasFocus()||!state.user)return;
  const userId=state.user.id,csrf=state.csrf,current=()=>!synkPageClosed&&!synkLogoutPending&&state.user?.id===userId&&state.csrf===csrf;
  synkRenewPending=true;
  try{
    const auth=await getSynkDesktopBridge().authStatus();if(!current())return;
    const status=await synkCompanyRequest('status');if(!current()||status.session!=='synk')return;
    if(['restoring','signing-in'].includes(auth.status))return;
    if(!auth.signedIn&&!auth.error?.retryable)throw Object.assign(new Error('SYNK ID로 다시 로그인해 주세요.'),{code:'AUTH_REQUIRED'});
    await synkCompanyRequest('renew',{csrfToken:csrf});
    const latest=await getSynkDesktopBridge().authStatus();if(!current()||latest.sessionGeneration!==auth.sessionGeneration)return;
    synkCompanyStatus=status;
  }catch(error){
    if(!current())return;
    if(['SYNK_ACCOUNT_CHANGED','SYNK_IDENTITY_REJECTED','AUTH_REQUIRED','AUTH_CHANGED','SYNK_CSRF'].includes(error.code)){
      await synkCompanyRequest('logout',{csrfToken:csrf}).catch(()=>{});if(current())location.replace('/?tab=messenger');return;
    }
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
}
async function waitForNativeSynk(){
  const desktop=getSynkDesktopBridge(),current=await desktop.authStatus();if(current.signedIn)return current;
  return new Promise((resolve,reject)=>{
    let stop=()=>{},settled=false,started=false,returned=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);stop();error?reject(error):resolve(value);};
    const timer=setTimeout(()=>{void desktop.authCancelSignIn();finish(new Error('로그인 확인이 만료됐어요. 다시 시작해 주세요.'));},4*60_000);
    const observe=value=>{if(['signing-in','restoring'].includes(value.status))started=true;if(value.signedIn)finish(null,value);else if(value.status==='error'||value.error)finish(new Error(value.error?.message||'SYNK ID 로그인을 완료하지 못했어요.'));else if(value.status==='signed-out'&&(started||returned))finish(new Error('SYNK ID 로그인을 취소했어요.'));};
    stop=desktop.onAuthChanged(observe);
    desktop.authSignIn().then(value=>{returned=true;observe(value);}).catch(error=>finish(error));
  });
}
async function beginSynkCompany(action,params={},button,note){
  if(synkConnectionPending)return;synkConnectionPending=true;if(button)button.disabled=true;
  try{
    const values={action,...params,csrfToken:state.csrf,confirm:true};
    if(!getSynkDesktopBridge()){const result=await synkCompanyRequest('start',values);location.assign(result.authorizationUrl);return;}
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
    getSynkDesktopBridge().onAuthChanged(()=>{if(!synkConnectionPending)void renewSynkCompanySession();});
    syncSynkRenewLoop();window.addEventListener('focus',syncSynkRenewLoop);window.addEventListener('blur',()=>{clearInterval(synkRenewTimer);synkRenewTimer=null;});document.addEventListener('visibilitychange',syncSynkRenewLoop);
    window.addEventListener('pagehide',()=>{synkPageClosed=true;clearInterval(synkRenewTimer);synkRenewTimer=null;});
  }
});
