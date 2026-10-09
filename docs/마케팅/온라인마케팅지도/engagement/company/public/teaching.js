'use strict';
const teachingModule={host:null,client:null,bridge:null,pending:null,epoch:0,owner:null,observer:null};
function teachingWorkspacePage(){return '<section id="teaching-module-slot" class="teaching-module-slot" aria-label="내 수업"><p class="teaching-opening" role="status">담당 수업을 준비하고 있어요.</p></section>';}
function teachingOwner(){return JSON.stringify([state.user?.id||null,state.synkUserId||null]);}
function teachingPrepareRender(){
  if(!teachingModule.host)return;
  // Keep the iframe in one DOM location: moving it would reload unsent forms.
  teachingModule.host.hidden=true;teachingModule.host.inert=true;
}
function resetTeachingWorkspace(){
  teachingModule.epoch++;teachingModule.client?.stop();teachingModule.bridge?.dispose?.();teachingModule.observer?.disconnect();teachingModule.host?.remove();
  Object.assign(teachingModule,{host:null,client:null,bridge:null,pending:null,owner:null});
}
function syncTeachingGeometry(){
  const host=teachingModule.host,slot=document.getElementById('teaching-module-slot');if(!host)return;
  const visible=state.tab==='teaching'&&!!slot;host.hidden=!visible;
  host.inert=!visible||Boolean(document.getElementById('overlay')?.children.length);
  if(!visible)return;
  const rect=slot.getBoundingClientRect();host.style.left=(rect.left+window.scrollX)+'px';host.style.top=(rect.top+window.scrollY)+'px';host.style.width=rect.width+'px';
  slot.style.minHeight=Math.ceil(host.getBoundingClientRect().height)+'px';
}
function teachingBridgeForCompany(bridge,owner){
  const expected=state.synkUserId||null;
  const guard=()=>{if(owner!==teachingOwner())throw Object.assign(new Error('사용 중인 계정이 바뀌었어요. 수업을 다시 열어 주세요.'),{code:'ACCOUNT_CHANGED'});};
  const scopedStatus=value=>{guard();if(expected&&value.signedIn&&value.account?.synk_user_id!==expected)return {...value,signedIn:false,status:'error',canSignOut:true,error:{code:'ACCOUNT_MISMATCH',message:'회사와 수업의 SYNK ID가 달라요. 수업에서 로그아웃한 뒤 같은 계정으로 연결해 주세요.'}};return value;};
  return Object.freeze({
    getEnvironment:()=>bridge.getEnvironment(),
    authStatus:async()=>scopedStatus(await bridge.authStatus()),
    authSignIn:async()=>{guard();return scopedStatus(await bridge.authSignIn());},
    authCancelSignIn:async()=>scopedStatus(await bridge.authCancelSignIn()),
    authSignOut:()=>bridge.authSignOut(),
    accountRequest:async(...args)=>{guard();const auth=scopedStatus(await bridge.authStatus());if(!auth.signedIn){const restoring=auth.status==='restoring';return {ok:false,error:{code:auth.error?.code||(restoring?'ACCOUNT_VERIFY_UNAVAILABLE':'AUTH_REQUIRED'),message:auth.error?.message||'SYNK ID로 수업을 다시 연결해 주세요.',status:restoring?503:401,retryable:restoring}};}const result=await bridge.accountRequest(...args);guard();return result;},
    onAuthChanged:callback=>bridge.onAuthChanged(value=>{try{callback(scopedStatus(value));}catch{resetTeachingWorkspace();}}),
    dispose:()=>bridge.dispose?.(),
  });
}
function ensureTeachingWorkspace(){
  const slot=document.getElementById('teaching-module-slot');
  if(teachingModule.owner&&teachingModule.owner!==teachingOwner())resetTeachingWorkspace();
  if(!slot){teachingPrepareRender();return;}
  if(teachingModule.host){slot.replaceChildren();syncTeachingGeometry();return;}
  const host=document.createElement('section');host.id='workspace-teaching';host.className='teaching-workspace';
  host.innerHTML='<header class="teaching-heading"><div><p class="teaching-kicker">SYNK Workspace · 내 수업</p><h1>학생의 연습을, 다음 수업으로.</h1><p>담당 학생의 학습을 살펴보고 필요한 과제를 준비해요.</p></div><button id="sign-out" class="plain" hidden>수업에서 로그아웃</button></header><div id="teacher-intro"></div><p id="notice" class="notice" role="status" aria-live="polite">수업 계정을 확인하고 있어요.</p><section id="setup" class="teaching-setup" hidden><h2>수업 연결을 준비하고 있어요</h2><p>교사용 SYNK ID 연결이 준비되면 이곳에서 담당 수업을 열 수 있어요.</p></section><div class="teaching-login-actions"><button id="connect" class="teaching-connect" hidden>SYNK ID로 수업 연결</button><button id="cancel-connect" class="plain" hidden>로그인 취소</button></div><section id="teacher-workspace" hidden aria-label="나의 담당 수업"></section><footer class="teaching-footnote">담당 수업에서 공유된 학습 기록만 확인해요. 학생의 개인 맞춤 설정은 자동으로 공유하지 않아요.</footer>';
  teachingModule.host=host;teachingModule.owner=teachingOwner();slot.replaceChildren();document.body.append(host);syncTeachingGeometry();
  teachingModule.observer=new ResizeObserver(syncTeachingGeometry);teachingModule.observer.observe(host);
  const epoch=++teachingModule.epoch,owner=teachingModule.owner;
  teachingModule.pending=import('/teaching-host.js').then(async module=>{
    if(epoch!==teachingModule.epoch)return;
    const bridge=teachingBridgeForCompany(window.synkDesktop?.teacher||module.createBrowserTeacherBridge(),owner);teachingModule.bridge=bridge;
    const client=await module.startTeacherClient({bridge,locationHref:new URL('/synk-account/teacher.html',location.href).href});
    if(epoch!==teachingModule.epoch){client.stop();return;}teachingModule.client=client;
    const url=new URL(location.href),failed=url.searchParams.has('teachingError');
    if(failed){host.querySelector('#notice').textContent='수업 로그인을 완료하지 못했어요. 다시 연결해 주세요.';host.querySelector('#notice').className='notice error';}
    if(url.searchParams.has('teachingConnected')||failed){url.searchParams.delete('teachingConnected');url.searchParams.delete('teachingError');history.replaceState(null,'',url.pathname+url.search+url.hash);}
  }).catch(error=>{if(epoch===teachingModule.epoch){host.querySelector('#notice').textContent=error.message||'수업 연결을 다시 확인해 주세요.';host.querySelector('#notice').className='notice error';}});
}
function renderTeachingOnly(){
  teachingPrepareRender();
  app.innerHTML='<div class="teaching-only-shell"><header class="teaching-only-bar"><a href="/" aria-label="싱크 워크스페이스"><img src="/wordmark.svg" alt="싱ㅋ" width="92" height="38"></a><span>내 수업</span><a class="teaching-company-entry" href="/">회사 업무로 이동</a></header><main id="main" tabindex="-1">'+teachingWorkspacePage()+'</main></div>';
  resetWorkspaceModule();ensureTeachingWorkspace();
}
async function logoutTeachingForCompany(){
  let bridge=teachingModule.bridge,temporary=false,wasSignedIn=false;
  try{
    if(!bridge){const module=await import('/teaching-host.js');bridge=window.synkDesktop?.teacher||module.createBrowserTeacherBridge();temporary=!window.synkDesktop?.teacher;}
    const auth=await bridge.authStatus();wasSignedIn=auth.signedIn===true;
    const result=await bridge.authSignOut();
    if(result?.ok!==true)return '회사에서는 로그아웃했지만 수업 로그인 종료를 확인하지 못했어요. 내 수업에서 다시 로그아웃해 주세요.';
    return wasSignedIn&&result.serverRevoked===false?'이 기기의 수업 로그인은 종료했지만 서버의 종료 확인은 남아 있어요.':'';
  }catch{return '회사에서는 로그아웃했지만 수업 로그인 종료를 확인하지 못했어요. 내 수업에서 다시 로그아웃해 주세요.';}
  finally{if(temporary)bridge?.dispose?.();resetTeachingWorkspace();}
}
window.addEventListener('pagehide',resetTeachingWorkspace);
window.addEventListener('resize',syncTeachingGeometry);
