import {clientRows,primaryAction} from './state.mjs';
import {createPlatformPersonalization,PERSONAL_KEY,PLATFORM_SCOPE} from './personalization.mjs';
import {resolveLibrary,accountStorageKey,displayLibraryAppIds} from './library.mjs';
import {mountConvenience} from './convenience.mjs';
import {safeDiagnostics} from './convenience-state.mjs';
import {mountAccountPage} from './account-page.mjs';
import {createAccountLifecycle} from './account-lifecycle.mjs';
import {mountDesktopPortalHost} from './portal-host.mjs';
import {mountOrbFace,ORB_LOOK} from './orb-face.mjs';

// PC 앱의 화면 호스트. 검정 구 얼굴(orb-face)과 계정 논리(portal-host)를 붙이고, 얼굴이 쓰는 다리와 옛 내 계정 화면 하나만 든다.
// 옛 런처의 보기 일곱(내 홈, 라이브러리, 솔리오, 회원 혜택, 맞춤 정보, 설치·업데이트, 설정)과 그 그림은 PC 0.5.0에서 거뒀다(PC 0.5.0 설계 4절).
// 옛 내 계정은 내 계정 방의 마을 기록과 연습 기록 내려받기가 연다(2단계 둘째 조각 설계 14절 D4).
const $=id=>document.getElementById(id),bridge=globalThis.synkDesktop;
const localStore={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)};
let auth={status:bridge?'restoring':'unconfigured',configured:false,signedIn:false},library=resolveLibrary(auth),authRevision=0,ownerEpoch=0;
let personal=createPersonal();
let clients=clientRows([],{native:!!bridge}),environment=null,view=null,busy=new Set(),toastTimer,toastSeq=0,environmentRevision=0,leaveDecision=null;
let convenience=null,portalHost=null,signUpPending=false,signOutPending=false,signInLanding=false;
// Screens register their account-change reset, render and draft hooks here.
// ownerEpoch mirrors the registry's ownership generation so every existing guard keeps reading one variable.
const accountLifecycle=createAccountLifecycle({onEpoch:epoch=>{ownerEpoch=epoch;}});
// 「내 계정」(옛 화면): 내 계정 방의 마을 기록 · 연습 기록 내려받기가 연다. 그 화면의 「← 설정」과 맞춤 정보 줄은 얼굴 CSS가 가린다
const accountPage=mountAccountPage($('view-account'),{bridge,getIdentity:()=>auth,getAppIds:()=>library.appIds,onBack:()=>{},onSignIn:()=>openAccount(),onSignOut:signOut,onInsight:()=>{},onWorkspace:()=>void launchWorkspace(),onAccountChanged:()=>void refreshAuth({reload:true}),toast:message=>toast(message)});
// 새 얼굴의 내 계정 방(2단계 둘째 조각 설계 1.3절)이 넘겨준 손잡이와, 그 방에서 「로그인과 보안」을 연 때. 옛 내 계정에서 연 때와 같이 로그인 화면의 비밀번호 안내에 쓴다
let orbRooms=null,orbSecurityOpenedAt=0;
const ORB_SECURITY_HINT_MS=30*60000;
const orbSecurityRecent=()=>!!orbSecurityOpenedAt&&Date.now()-orbSecurityOpenedAt<ORB_SECURITY_HINT_MS;
// 쓰던 글 확인 대화상자의 글은 새 얼굴 위에 뜨므로 합니다체다(2단계 둘째 조각 설계 14절 D2)
const SIGN_OUT_DRAFT='저장하지 않은 내용은 로그아웃하면 사라집니다. 돌아가서 저장하거나, 저장 없이 로그아웃할 수 있습니다.';
// 로그인한 회원은 옛 내 계정을, 로그인 전이면 저장된 로그인을 다시 확인한다(대화상자는 두지 않는다)
function openAccount(){if(bridge&&auth.signedIn){showView('account');return;}if(bridge)void refreshAuth({reload:true});}
// Account lifecycle participants. Registration order is the order every phase runs in: identity updates,
// resets after an account change, renders, unsaved-draft checks (first hit wins), discards and flushes.
accountLifecycle.register('personalization',{render:()=>applyPersonalization()});
accountLifecycle.register('commands',{onAccountChange:()=>{busy=new Set();}});
accountLifecycle.register('dialogs-and-toast',{onAccountChange:({ownerChanged})=>{
  if($('leave-dialog').open)$('leave-dialog').close('keep');
  // A notice belongs to the person it was said to: only a change of person clears it.
  if(ownerChanged){toastSeq++;clearTimeout(toastTimer);$('toast').hidden=true;$('toast').textContent='';}
}});
accountLifecycle.register('device-preferences',{onAccountChange:({ownerChanged})=>{if(ownerChanged)personal=createPersonal();}});
accountLifecycle.register('account',{render:()=>renderAuth()});
// 계정 · 세션이 바뀌면 새 얼굴의 내 계정 방이 보이던 자료와 오는 중인 답을 버린다(2단계 둘째 조각 설계 1.3절)
accountLifecycle.register('orb-rooms',{onAccountChange:()=>orbRooms?.accountChanged?.()});
// 밤낮 값은 옛 내 계정 화면의 색에만 쓴다. 고르는 자리는 거뒀고 전에 고른 값은 그대로 따른다
const THEME_KEY='synk-platform-theme',THEMES=['night','day','system'];
function readTheme(){try{const value=localStorage.getItem(THEME_KEY);return THEMES.includes(value)?value:'day';}catch{return 'day';}}
document.documentElement.dataset.theme=readTheme();
function createPersonal(){return createPlatformPersonalization(globalThis.SynkAtlasPersonalization,localStore,{key:accountStorageKey(PERSONAL_KEY,library.owner),scope:{...PLATFORM_SCOPE,personId:library.owner||'pending-account'}});}
function allowed(id){return library.appIds.includes(id);}
function setAuth(snapshot,{environmentOnly=false}={}){
  if(!environmentOnly)authRevision++;
  const next=resolveLibrary(snapshot,environment),changed=JSON.stringify([library.owner,library.status,library.appIds,auth.sessionGeneration])!==JSON.stringify([next.owner,next.status,next.appIds,snapshot?.sessionGeneration]);
  // The registered screens own the resets and renders; changed accounts also advance ownerEpoch.
  const wasSignedIn=auth.signedIn===true;
  accountLifecycle.transition({changed,ownerChanged:library.owner!==next.owner,commit:()=>{auth=snapshot||{status:'error',signedIn:false};library=next;}});
  // A session the server ended (a password changed elsewhere, 「모두 로그아웃」) says so once instead of a silent sign-in screen.
  if(wasSignedIn&&!auth.signedIn&&!signOutPending&&auth.status==='signed-out'&&auth.error?.code==='AUTH_REQUIRED')toast('로그인이 끝났습니다. 다시 쓰려면 로그인해 주세요.'+(accountPage.securityVisitedRecently()||orbSecurityRecent()?' 비밀번호를 바꿨다면 새 비밀번호로 로그인해 주세요.':''));
  // A browser sign-in passes 'signing-in', then 'restoring' while the main process checks the new session. One that ends without an
  // account says why once (a cancel is the member's own doing). The face shows the signed-in account itself.
  if(auth.status==='signing-in')signInLanding=true;
  else if(auth.signedIn)signInLanding=false;
  else if(auth.status!=='restoring'){
    if(signInLanding&&auth.error&&auth.error.code!=='AUTH_CANCELLED'&&!portalHost?.isActive?.())toast(auth.error.message||'로그인을 마치지 못했습니다. 다시 해 주세요.');
    signInLanding=false;
  }
  portalHost?.syncAuth(auth);
}
async function refreshAuth({reload=false}={}){
  if(!bridge)return;const revision=authRevision;
  try{
    if(reload&&(auth.signedIn||auth.status==='error'&&auth.error?.retryable===true)&&typeof bridge.accountRequest==='function')await bridge.accountRequest('load');
    if(revision!==authRevision)return;
    const snapshot=await bridge.authStatus();if(revision===authRevision){setAuth(snapshot);return authRevision;}
  }catch{if(revision===authRevision){setAuth({...auth,library:{status:'unavailable',appIds:[]},error:{...auth.error,message:'앱 목록을 불러오지 못했습니다. 잠시 뒤 다시 해 주세요.'}});return authRevision;}}
}
function client(id){return clients.find(row=>row.id===id);}
function getAppAction(id){const action=primaryAction(client(id),{native:!!bridge,busy:false});return busy.has(id)?{...action,disabled:true,pending:true}:action;}
// 옛 내 계정의 「작업실 열기」. 설치된 Workspace 앱만 연다.
// synk.im에는 Workspace 설치 파일을 받는 곳이 없어, 없을 때는 웹 계정 화면과 같은 말로 브라우저의 Workspace 주소를 안내한다(0.5.0 최종 검수 F5)
async function launchWorkspace(){
  const id='messenger';
  if(!bridge||!allowed(id)){toast('이 계정에서는 Workspace를 열 수 없습니다.');return;}
  // 여는 중에 다시 누르면 아무것도 하지 않는다. 앱 줄을 아직 못 읽었으면 「설치 안 됨」이 아니라 확인 중이라고 말한다(카본 검수 B1)
  if(busy.has(id))return;
  if(client(id)?.reason==='CHECKING'){toast('Workspace 설치 상태를 확인하는 중입니다. 잠시 뒤 다시 눌러 주세요.');return;}
  const action=getAppAction(id);
  if(action.disabled||action.action!=='launch'){toast('이 PC에 Workspace 앱이 설치돼 있지 않습니다. 회사에서 안내받은 Workspace 주소로 브라우저에서 열어 주세요.');return;}
  const epoch=ownerEpoch;busy.add(id);
  try{const result=await bridge.launch(id);if(epoch!==ownerEpoch)return;toast(result?.ok?'Workspace를 열었습니다.':'Workspace를 열지 못했습니다. 다시 눌러 보고, 계속 안 되면 다시 설치해 주세요.');}
  catch{if(epoch===ownerEpoch)toast('Workspace를 열지 못했습니다. 잠시 뒤 다시 눌러 주세요.');}
  finally{busy.delete(id);}
}
function hasUnsavedDrafts(){return accountLifecycle.hasUnsavedDrafts();}
// 쓰던 글 확인의 틀. 지금 얼굴에는 지킬 글이 없어 묻지 않고 넘어간다. 글을 쓰는 방이 생기면 그 방이 생명주기에 등록한다
function confirmDraftExit(message){
  if(!hasUnsavedDrafts())return Promise.resolve(true);
  if(leaveDecision)return Promise.resolve(false);
  $('leave-description').textContent=message;
  $('leave-dialog').returnValue='keep';
  return new Promise(resolve=>{leaveDecision=resolve;$('leave-dialog').showModal();});
}
async function confirmUpdateInstall(){const epoch=ownerEpoch;return await confirmDraftExit('돌아가서 저장하거나, 메모를 버리고 업데이트할 수 있습니다.')&&epoch===ownerEpoch&&!hasUnsavedDrafts();}
async function windowAction(action){if(!bridge?.windowAction)return;const epoch=ownerEpoch;if(action==='close'&&environment?.closeToTray!==true&&(!await confirmDraftExit('돌아가서 저장하거나, 메모를 버리고 창을 닫을 수 있습니다.')||epoch!==ownerEpoch))return;try{await bridge.windowAction(action);}catch{toast('창을 바꾸지 못했습니다.');}}
// A longer notice stays longer (about the time to read it), and one said while the window was behind another (a sign-in
// that timed out in the browser) starts counting only once the window is back in front.
function toast(message){
  const seq=++toastSeq,wait=Math.min(12000,Math.max(5500,2000+90*[...String(message)].length));
  $('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);
  const start=()=>{if(seq!==toastSeq)return;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{if(seq===toastSeq)$('toast').hidden=true;},wait);};
  if(globalThis.document?.hasFocus?.()===false&&typeof globalThis.addEventListener==='function')globalThis.addEventListener('focus',start,{once:true});else start();
}
function errorText(result){const code=result?.code||result?.error?.code;return ({AUTH_NOT_CONFIGURED:'로그인 설정을 찾지 못해 로그인할 수 없습니다. synk.im에서 PC 앱을 다시 받아 설치해 주세요.',AUTH_CANCELLED:'로그인을 취소했습니다.'})[code]||'처리하지 못했습니다. 잠시 뒤 다시 눌러 주세요.';}
// 옛 내 계정이 로그인 변화를 받는다(옛 런처의 renderAuth 가운데 남는 것)
function renderAuth(){accountPage.authChanged();}
// 화면은 옛 내 계정 하나다. 다른 이름은 받지 않는다. 얼굴 밑에 다른 화면을 그리지 않는다(PC 0.5.0 설계 4.2-2)
function showView(next){
  if(next!=='account'){hideAccount();return;}
  view='account';$('view-account').hidden=false;accountPage.show();
  document.documentElement.dataset.view='account';$('main').scrollTop=0;
}
function hideAccount(){if(view!=='account')return;view=null;accountPage.hide();$('view-account').hidden=true;delete document.documentElement.dataset.view;}
function focusCurrentViewHeading(){if(portalHost?.isActive?.()||['portal','app'].includes(portalHost?.clientMode?.())||document.querySelector('dialog[open]'))return;if(view==='account')$('account-page-title')?.focus?.({preventScroll:true});}
function setClients(snapshot){if(!Array.isArray(snapshot))return;const previous=clients;clients=clientRows(snapshot,{native:!!bridge});convenience?.clientsChanged(previous,clients);}
async function loadEnvironment(){
  const revision=++environmentRevision,snapshot=await bridge.getEnvironment();
  if(revision===environmentRevision){environment=snapshot;setAuth(auth,{environmentOnly:true});}
  return snapshot;
}
async function refresh(){
  if(!bridge)return;
  const results=await Promise.allSettled([loadEnvironment(),bridge.getClients()]);
  if(results[1].status==='fulfilled')setClients(results[1].value);
}
$('leave-dialog').addEventListener('close',async()=>{const done=leaveDecision;leaveDecision=null;if(!done)return;const discard=$('leave-dialog').returnValue==='discard';if(discard){const clearing=await accountLifecycle.discardDrafts();if(clearing.some(result=>result.status==='rejected'||result.value===false)){toast('임시 저장한 글을 지우지 못했습니다. 잠시 뒤 다시 해 주세요.');done(false);return;}}done(discard);});
$('leave-dialog').addEventListener('cancel',()=>{$('leave-dialog').returnValue='keep';});
window.addEventListener('beforeunload',event=>{if(hasUnsavedDrafts()){event.preventDefault();event.returnValue='';}});
// The face's sign-out and 「내 계정」's sign-out share this action. signOutPending keeps a second logout from starting meanwhile.
async function signOut(){
  if(signOutPending||!bridge||!auth.signedIn)return;const leaveEpoch=ownerEpoch;
  if(!await confirmDraftExit(SIGN_OUT_DRAFT)||leaveEpoch!==ownerEpoch||!auth.signedIn)return;
  signOutPending=true;
  const signedOutGeneration=Number.isSafeInteger(auth.sessionGeneration)?auth.sessionGeneration+1:null;
  setAuth({status:'signing-out',configured:auth.configured,signedIn:false});const revision=authRevision;
  const sameLogout=()=>revision===authRevision||signedOutGeneration!==null&&auth.sessionGeneration===signedOutGeneration&&auth.status==='signed-out'&&!auth.signedIn;
  try{
    const result=await bridge.authSignOut();if(!sameLogout())return;
    const refreshedRevision=await refreshAuth();
    if((authRevision!==refreshedRevision&&!sameLogout())||auth.status==='signing-in')return;
    if(!auth.signedIn){
      const notice=result?.ok===false?'로그아웃하지 못했습니다. 잠시 뒤 다시 눌러 주세요.':(result?.serverSessionRevoked===false||result?.serverRevoked===false?'이 PC에서는 로그아웃했습니다. 서버 쪽 로그인은 인터넷이 연결된 뒤 다시 로그인했다 로그아웃하면 정리됩니다.':'로그아웃했습니다.')+' 브라우저의 SYNK ID 로그인은 그대로라, 다른 계정으로 바꾸려면 브라우저에서도 로그아웃해 주세요.';
      const cleanupNotice=result?.draftRecoveryCleanup?.ok===false?' 이 PC에 임시 저장한 글을 지우지 못했습니다. 앱을 다시 켜면 다시 지웁니다.':'';
      toast(notice+cleanupNotice);
    }
  }catch{if(sameLogout())setAuth({status:'error',configured:auth.configured,signedIn:false,error:{message:'로그아웃됐는지 확인하지 못했습니다. 창을 닫았다 다시 열어 주세요.'}});}
  finally{signOutPending=false;}
}
window.addEventListener('focus',()=>{refresh();refreshAuth({reload:true});});
function applyPersonalization(){const state=personal.current({appIds:displayLibraryAppIds(library)});document.documentElement.dataset.textSize=state.presentation.textSize;document.documentElement.dataset.explanation=state.presentation.explanation;document.documentElement.dataset.motion=state.presentation.motion;portalHost?.syncReducedMotion?.(state.presentation.motion==='reduced');}
let windowMaximized=false,portalWindowChrome=null;
// 임시로 여는 옛 화면(2단계 둘째 조각 설계 9.1, 설계 검토 D4). 남는 갈래는 내 계정 하나다
function openOrbLegacy(kind){if(kind==='account')showView('account');}
// 새 얼굴의 방이 쓰는 다리(설계 1.3절 「자료 어댑터」). 내 계정 요청은 부를 때의 계정 세대를 잡아 두고, 답이 왔을 때 세대가 바뀌었으면 버린다(옛 내 계정의 epoch 약속과 같다)
function orbAccountCall(run){const epoch=accountLifecycle.epoch();return Promise.resolve().then(run).then(result=>epoch===accountLifecycle.epoch()?result:{ok:false,code:'changed'});}
function orbRoomOptions(){
  const account=typeof bridge?.accountRequest==='function'&&typeof bridge?.accountIdentity==='function'?{
    request:(operation,params)=>orbAccountCall(()=>bridge.accountRequest(operation,params)),
    identity:()=>orbAccountCall(()=>bridge.accountIdentity()),
    security:section=>typeof bridge.authSecurity==='function'?bridge.authSecurity(section):{ok:false},
    securityOpened:()=>{orbSecurityOpenedAt=Date.now();},
    changed:()=>void refreshAuth({reload:true}),
    signedOutAll:()=>toast('모든 SYNK 앱에서 로그아웃했습니다.'),
    name:()=>auth.account?.display_name||'',
  }:null;
  // 설정 방의 다리(설계 1.3절 표, 6.4). 쓰던 글 되살리기는 지킬 편집기가 없어 다리를 두지 않는다. 다리가 없으면 그 줄을 세우지 않는다(PC 0.5.0 설계 4.2-4).
  // 알림은 편의의 통로로 바꿔 배너 판단에 바로 쓰이게 한다. 업데이트 설치는 쓰던 글 확인(confirmUpdateInstall)을 먼저 거친다
  const desktop=typeof bridge?.getDesktopPreferences==='function'&&typeof bridge?.updateDesktopPreferences==='function'?{get:()=>bridge.getDesktopPreferences(),update:patch=>bridge.updateDesktopPreferences(patch),onChange:fn=>bridge.onDesktopPreferences?.(fn)}:null;
  const updates=['updateStatus','checkForUpdate','downloadUpdate','installUpdate','onUpdateChanged'].every(name=>typeof bridge?.[name]==='function')?{status:()=>bridge.updateStatus(),check:()=>bridge.checkForUpdate(),download:()=>bridge.downloadUpdate(),install:()=>bridge.installUpdate(),confirmInstall:()=>confirmUpdateInstall(),onChange:fn=>bridge.onUpdateChanged(fn)}:null;
  const notices={get:()=>convenience?.notifications?.get?.()??null,set:patch=>convenience?.notifications?.set?.(patch)??null};
  // 플레저 PC 알림을 켜 둔 사람이 끌 자리(PC 0.5.0 설계 4.2-3). 옛 설정 화면에만 있던 칸이다
  const care=['status','configure','onChanged'].every(name=>typeof bridge?.careNotifications?.[name]==='function')?{status:()=>bridge.careNotifications.status(),configure:patch=>bridge.careNotifications.configure(patch),onChange:fn=>bridge.careNotifications.onChanged(fn)}:null;
  const copyDiagnostics=async()=>{const summary=safeDiagnostics({environment,auth,clients,view:'settings',online:navigator.onLine});try{if(bridge?.copyPlatformDiagnostics)return (await bridge.copyPlatformDiagnostics(summary))?.ok===true;await navigator.clipboard.writeText(JSON.stringify(summary,null,2));return true;}catch{return false;}};
  // 모든 곳에서 로그아웃 전의 쓰던 글 확인은 펼침의 「로그아웃」과 같은 대화상자다(설계 8.3)
  return {account,confirmLeave:()=>confirmDraftExit(SIGN_OUT_DRAFT),bind:api=>{orbRooms=api||null;},desktop,drafts:null,notices,care,updates,environment:()=>environment,copyDiagnostics};
}
function syncMaximizeButton(button,maximized){if(!button)return;button.setAttribute('aria-label',maximized?'창 크기 복원':'최대화');button.dataset.maximized=String(Boolean(maximized));}
function windowState(state){windowMaximized=Boolean(state?.maximized);portalWindowChrome?.syncMaximize(windowMaximized);hostFallback?.syncMaximize(windowMaximized);}
function buildWindowBar(){
  const fromTemplate=$('portal-window-chrome')?.content?.firstElementChild?.cloneNode?.(true);
  if(fromTemplate)return fromTemplate;
  const el=document.createElement('div');
  el.className='portal-window-bar';
  el.dataset.portalWindowBar='';
  el.hidden=true;
  el.innerHTML='<div class="portal-window-drag" data-portal-window-drag aria-hidden="true"></div><div class="portal-window-actions" role="group" aria-label="창 조절"><button type="button" data-window="minimize" aria-label="최소화"><svg class="i" aria-hidden="true"><use href="#i-minus"/></svg></button><button type="button" data-window="toggle-maximize" data-portal-maximize data-maximized="false" aria-label="최대화"><svg class="i when-normal" aria-hidden="true"><use href="#i-square"/></svg><svg class="i when-maximized" aria-hidden="true"><use href="#i-restore"/></svg></button><button type="button" data-window="close" class="window-close" aria-label="닫기"><svg class="i" aria-hidden="true"><use href="#i-x"/></svg></button></div>';
  return el;
}
function createPortalWindowChrome(portalRoot){
  if(!portalRoot)return null;
  const hasWindowAction=()=>typeof bridge?.windowAction==='function';
  const bar=buildWindowBar();
  const maximizeBtn=bar.querySelector?.('[data-portal-maximize]')||null;
  let disposed=false,syncing=false;
  const onClick=event=>{
    if(disposed)return;
    const origin=event.target?.nodeType===1?event.target:event.target?.parentElement;
    const button=origin?.closest?.('button[data-window]');
    if(!button||!bar.contains(button)||button.disabled)return;
    event.stopPropagation();
    void windowAction(button.dataset.window);
  };
  bar.addEventListener('click',onClick);
  const sync=forcedActive=>{
    if(disposed||syncing)return;
    syncing=true;
    try{
      for(const node of portalRoot.querySelectorAll?.('[data-portal-window-bar]')||[]){if(node!==bar)node.remove();}
      if(!hasWindowAction()||!portalRoot.querySelector?.('[data-portal-stage]')){
        if(!bar.hidden&&document.activeElement&&bar.contains(document.activeElement))document.activeElement.blur?.();
        bar.hidden=true;
        if(bar.parentNode)bar.remove();
        return;
      }
      if(bar.parentElement!==portalRoot)portalRoot.append(bar);
      syncMaximizeButton(maximizeBtn,windowMaximized);
      // 새 얼굴은 들어온 뒤에도 옛 제목 줄 자리를 가리므로 창 단추가 이 막대뿐이다
      const orbShown=['app','legacy'].includes(portalRoot.dataset?.orbClient);
      const active=typeof forcedActive==='boolean'?(forcedActive||orbShown)&&!portalRoot.hidden:!portalRoot.hidden&&(portalRoot.dataset?.portalActive==='true'||orbShown);
      if(!active&&document.activeElement&&bar.contains(document.activeElement))document.activeElement.blur?.();
      if(bar.hidden===active)bar.hidden=!active;
    }finally{syncing=false;}
  };
  const onPortalState=event=>{sync(typeof event?.detail?.active==='boolean'?event.detail.active:undefined);};
  portalRoot.addEventListener?.('synk:portal-state',onPortalState);
  const observer=typeof MutationObserver==='function'?new MutationObserver(()=>{sync();}):null;
  observer?.observe(portalRoot,{childList:true,attributes:true,attributeFilter:['hidden','data-portal-active','data-orb-client']});
  const dispose=()=>{
    if(disposed)return;
    disposed=true;
    observer?.disconnect();
    portalRoot.removeEventListener?.('synk:portal-state',onPortalState);
    bar.removeEventListener('click',onClick);
    if(document.activeElement&&bar.contains(document.activeElement))document.activeElement.blur?.();
    bar.hidden=true;
    if(bar.parentNode)bar.remove();
  };
  return {sync,syncMaximize:maximized=>syncMaximizeButton(maximizeBtn,maximized),dispose};
}
// 얼굴을 붙이지 못하면 빈 창이 남지 않게 창 단추와 한 줄 안내를 띄운다. 옛 제목 줄이 받쳐 주던 자리다(PC 0.5.0 설계 4.3, 설계 검토 R9)
let hostFallback=null;
function showHostFallback(){
  if(hostFallback)return;
  const box=document.createElement('div');box.className='host-fallback';box.setAttribute('role','alert');
  const bar=buildWindowBar();bar.hidden=!bridge?.windowAction;
  bar.addEventListener('click',event=>{const button=event.target?.closest?.('button[data-window]');if(button&&bar.contains(button))void windowAction(button.dataset.window);});
  const note=document.createElement('p');note.textContent='화면을 준비하지 못했습니다. 앱을 끄고 다시 열어 주세요.';
  box.append(bar,note);document.body.append(box);
  hostFallback={syncMaximize:maximized=>syncMaximizeButton(bar.querySelector('[data-portal-maximize]'),maximized)};
}
convenience=mountConvenience({bridge,storage:localStore,getAppIds:()=>library.appIds,isPortalBlocked:()=>Boolean(portalHost?.shouldBlockShortcuts?.()),onToast:toast,onDesktopPreferences:snapshot=>{if(environment)environment.closeToTray=snapshot.preferences?.closeToTray===true&&snapshot.capabilities?.tray===true;}});
portalWindowChrome=createPortalWindowChrome($('portal-entry'));
try{
  portalHost=mountDesktopPortalHost({
    root:$('portal-entry'),
    mountFace:mountOrbFace,
    // PC 쪽 옵션(설계 4절). 검사 실행 길은 본체가 열어 준 때만 열린다(설계 11절). embed는 창 안의 PULSE 뷰다(3단계 구현 설계 4절)
    faceOptions:{orbBoot:typeof bridge?.orbBoot==='function'?()=>bridge.orbBoot():null,onFirstFrame:typeof bridge?.orbFirstFrame==='function'?()=>bridge.orbFirstFrame():null,onOpenLegacy:openOrbLegacy,onCloseLegacy:()=>hideAccount(),onSignOut:()=>signOut(),subscriptions:bridge?.subscriptions||null,solioBackup:bridge?.solioBackup||null,rooms:orbRoomOptions(),siteVisits:bridge?.siteVisits||null,snsHealth:bridge?.snsHealth||null,office:bridge?.office||null,embed:bridge?.pulseView||null,allowGuestEntry:()=>environment?.qaGuestEntry===true,look:ORB_LOOK},
    hostElements:[document.querySelector('.launcher')].filter(Boolean),
    bridge,
    getAuth:()=>auth,
    getReducedMotion:()=>document.documentElement.dataset.motion==='reduced'||Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches),
    onActiveChange:active=>{portalWindowChrome?.sync(active);if(!active)focusCurrentViewHeading();},
    onStartSignIn:async()=>{
      if(!bridge||typeof bridge.authSignIn!=='function')return {ok:false,code:'AUTH_UNAVAILABLE',message:'로그인은 SYNK Platform PC 앱에서 할 수 있습니다.'};
      if(!auth.configured)return {ok:false,code:'AUTH_NOT_CONFIGURED',message:errorText({code:'AUTH_NOT_CONFIGURED'})};
      if(signUpPending||auth.status==='signing-out')return {ok:false,code:'AUTH_BUSY',message:'이전 계정 작업을 마무리하고 있습니다. 잠시 뒤 다시 눌러 주세요.'};
      try{
        const result=await bridge.authSignIn();
        await refreshAuth();
        if(result?.ok===false||auth.status==='error'||(auth.status==='signed-out'&&!auth.signedIn)){
          const code=result?.code||result?.error?.code||auth.error?.code||'AUTH_FAILED';
          return {ok:false,code,message:result?.error?.message||auth.error?.message||errorText({code})};
        }
        return {ok:true};
      }catch(error){
        await refreshAuth();
        return {ok:false,code:auth.error?.code||error?.code||'AUTH_FAILED',message:auth.error?.message||'로그인 창을 열지 못했습니다. 다시 해 주세요.'};
      }
    },
    onStartSignUp:async()=>{
      if(typeof bridge?.authSignUp!=='function')return {ok:false,code:'AUTH_SIGNUP_UNAVAILABLE',message:'회원가입은 SYNK Platform PC 앱에서 할 수 있습니다.'};
      if(signUpPending||['restoring','signing-in','signing-out'].includes(auth.status))return {ok:false,code:'AUTH_SIGNUP_BUSY',message:'계정 상태를 확인하고 있습니다. 잠시 뒤 다시 눌러 주세요.'};
      signUpPending=true;
      try{
        const result=await bridge.authSignUp();
        if(result?.ok===true)return {ok:true};
        return {ok:false,code:result?.code||'AUTH_SIGNUP_OPEN_FAILED',message:'회원가입 페이지를 열지 못했습니다. 잠시 뒤 다시 눌러 주세요.'};
      }catch{
        return {ok:false,code:'AUTH_SIGNUP_OPEN_FAILED',message:'회원가입 페이지를 열지 못했습니다. 잠시 뒤 다시 눌러 주세요.'};
      }finally{signUpPending=false;}
    },
    onCancelSignIn:async()=>{
      const revision=authRevision;
      await bridge?.authCancelSignIn?.();
      if(revision===authRevision)await refreshAuth();
    },
    onRetryAuth:async()=>{
      if(!bridge)return {ok:false,message:'브라우저 미리보기에서는 저장된 로그인을 확인할 수 없습니다.'};
      await refreshAuth({reload:true});
      if(auth.status==='error'){
        const extra=auth.error?.code==='SUITE_UNAVAILABLE'?' PC 저장 공간이 부족하면 공간을 비운 뒤 다시 해 주세요.':'';
        return {ok:false,message:(auth.error?.message||'저장된 로그인을 다시 확인하지 못했습니다.')+extra};
      }
      return {ok:true};
    },
    onSwitchAccount:async()=>{
      if(!bridge)throw new Error('BRIDGE_UNAVAILABLE');
      if(auth.signedIn){
        await signOut();
        if(auth.signedIn)throw new Error('SIGN_OUT_CANCELLED');
      }
    },
    // 옛 고르기 화면(WORLD · PATH · 솔리오 · 홈)의 갈래는 얼굴에서 닿지 않는다. 화면 없이 「됐다」고만 답한다(PC 0.5.0 설계 4.2-2, 설계 검토 R5)
    describePurposeTarget:()=>({external:false}),
    onOpenPurposeTarget:async()=>({ok:true}),
    onApplyHashRoute:()=>{},
    onEnsureEnteredView:()=>({ok:true}),
  });
}catch{showHostFallback();}
portalWindowChrome?.sync();
if(portalHost&&typeof portalHost.dispose==='function'){
  const disposePortalHost=portalHost.dispose.bind(portalHost);
  portalHost={...portalHost,dispose:()=>{try{return disposePortalHost();}finally{portalWindowChrome?.dispose();}}};
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)accountLifecycle.flushDrafts();});
async function init(){
  accountLifecycle.render();
  accountLifecycle.afterRender();
  if(bridge){
    if(bridge.getWindowState)bridge.getWindowState().then(windowState).catch(()=>{});bridge.onWindowStateChanged?.(windowState);
    let clientEvents=0;const revision=authRevision;
    bridge.onAuthChanged?.(setAuth);
    // 조용한 업데이트는 쓰다 만 글이 없을 때만 한다(1-가 구현 설계 2절)
    bridge.answerDraftCheck?.(()=>hasUnsavedDrafts());
    const receiveClients=snapshot=>{clientEvents++;setClients(snapshot);};bridge.onClientsChanged?.(receiveClients);
    const results=await Promise.allSettled([loadEnvironment(),bridge.getClients(),bridge.authStatus()]);
    if(results[1].status==='fulfilled'&&clientEvents===0)setClients(results[1].value);
    if(results[2].status==='fulfilled'&&authRevision===revision)setAuth(results[2].value);
    else if(results[2].status==='rejected'&&authRevision===revision)setAuth({status:'error',signedIn:false});
    if(results.some(result=>result.status==='rejected'))toast('일부 정보를 불러오지 못했습니다. 창을 닫았다 다시 열어 주세요.');
  }
  document.documentElement.dataset.ready='true';
}
init().catch(()=>{toast('플랫폼을 준비하지 못했습니다. 앱을 다시 열어 주세요.');document.documentElement.dataset.ready='error';});
