import {APP_IDS,INSTALLABLE_IDS,APPS,clientRows,matchesLibrary,bytes,statusLabel,primaryAction,installerLabel,progressValue,parsePreferences,appArt} from './state.mjs';
import {createPlatformPersonalization,previewPurpose,CONTEXTS,PERSONAL_KEY,PLATFORM_SCOPE,STUDY_ON_PHONE} from './personalization.mjs';
import {resolveLibrary,accountStorageKey,visibleSelection,libraryCopy,displayLibraryAppId,displayLibraryAppIds,visibleLibraryAppIds,UNLISTED_APP_IDS,moveLibraryFavorite,projectLibraryPreferences} from './library.mjs';
import {MEMBER_BENEFITS,MEMBER_INSIGHT,memberBenefit,benefitPreviewAvailable} from './benefits.mjs';
import {SOLIO,SOLIO_SECTIONS,SOLIO_SUBSCRIPTIONS,SOLIO_BACKUP,SOLIO_LEGACY_BENEFITS,SOLIO_SEARCH,solioSection,solioMigrateRoute,solioSearch} from './solio.mjs';
import {createMemberInsight} from './member-insight.mjs';
import {createMemberActivity} from './member-activity-controller.mjs';
import {createMemberUnderstanding} from './member-understanding-controller.mjs';
import {createMemberSettings} from './member-settings.mjs';
import {bindMemberUnderstandingEditor,captureMemberUnderstandingFocus} from './member-understanding-host.mjs';
import {renderMemberInsight} from './member-insight-view.mjs';
import {createSubscriptionsBoard} from './subscriptions.mjs';
import {mountPulseClient} from './pulse-client.mjs';
import {mountMemberHome} from './member-home.mjs';
import {mountPlatformLibrary} from './platform-continuity.mjs';
import {mountConvenience} from './convenience.mjs';
import {mountPlatformUpdates} from './update-view.mjs';
import {mountAccountPage} from './account-page.mjs';
import {createAccountLifecycle} from './account-lifecycle.mjs';
import {rememberSignIn,recentSignIn,recentSignInText} from './recent-sign-in.mjs';
const $=id=>document.getElementById(id),bridge=globalThis.synkDesktop,asset='/assets/launcher/';
const apps=APPS;
const localStore={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)};
let auth={status:bridge?'restoring':'unconfigured',configured:false,signedIn:false},library=resolveLibrary(auth),authRevision=0,ownerEpoch=0;
let personal=createPersonal(),personalState=personal.current({appIds:displayLibraryAppIds(library)});
// WORLD 「놀이」의 게임 셋(브랜드 오프닝 글 표 game.*와 같은 이름). 그림은 지금 WORLD 게임 화면을 찍은 것이다.
const games={runner:{name:'바람길',image:'runner.jpg',tag:'들은 말대로 90초 동안 달려요',description:'짧은 한국어 지시를 듣고 그대로 움직이는 달리기 게임이에요. 하라는 말도, 하지 말라는 말도 끝까지 듣고 길을 바꾸거나 뛰어요.'},rhythm:{name:'말의 리듬',image:'rhythm.jpg',tag:'노래를 듣다가 O·X로 답해요',description:'노래를 들으며 두 단추로 박자를 맞추고, 들은 내용이 맞으면 O, 아니면 X를 골라요. 박자 점수와 듣기 답은 따로 기록해요.'},hangul:{name:'한글 만나기',image:'hangul.jpg',tag:'소리와 글자를 짝지어요',description:'한글을 처음 배우는 사람을 위한 게임이에요. 소리를 듣고 글자를 고르거나 글자를 보고 소리를 고르고, 손가락으로 글자를 따라 써요.'}};
const worldExtras=[['TOPIK 연습','짧은 진단으로 TOPIK I 내 위치를 보고, 듣기·읽기 연습과 TOPIK II 쓰기 연습을 해요.'],['첫 문장 놀이','짧은 문장 세 개를 읽고 상황에 어울리는 답을 골라요.'],['싱크타운','내가 고른 차림 그대로 광장을 걸어요.'],['옷장','세 친구에게 옷을 입혀 보고 사진으로 남겨요.'],['노래 듣기','한글 노래와 뮤직비디오를 들어요.']];
let prefs=parsePreferences(readPrefs()),clients=clientRows([],{native:!!bridge}),environment=null,view='home',detail='overview',filter='all',search='',busy=new Set(),toastTimer,toastSeq=0;
let selectedBenefit=null,solioTab='home',profileOpen=false,environmentRevision=0,sessionPurpose=null,sessionPurposeOwner=null,leaveDecision=null;
let continuity=null,convenience=null,platformUpdates=null,libraryActionQueue=Promise.resolve(),pendingLibraryActions=0;
let accountRetryPending=false,signUpPending=false,signUpOpened=false,pulseLegacyView=false,signOutPending=false,rememberedOwner=null,signInLanding=false,landing=null;
// 라이브러리는 격자(앱 선반 칸)와 앱 소개 두 상태다. 경로의 appId가 있으면 앱 소개, 없으면 격자(convenience가 뒤로 · 앞으로를 기억한다).
let libraryDetail=false,libraryOrigin='library',libraryEmpty=false;
// Screens register their account-change reset, render and draft hooks here (the list after the library mount).
// ownerEpoch mirrors the registry's ownership generation so every existing guard keeps reading one variable.
const accountLifecycle=createAccountLifecycle({onEpoch:epoch=>{ownerEpoch=epoch;}});
const memberActivity=createMemberActivity({getIdentity:()=>auth,request:(operation,params)=>bridge.accountRequest(operation,params),getFavorites:()=>effectivePrefs().favorites});
const memberUnderstanding=createMemberUnderstanding({getIdentity:()=>auth,request:(operation,params)=>bridge.accountRequest(operation,params)});
const memberSettings=createMemberSettings({getIdentity:()=>auth,request:(operation,params)=>bridge.accountRequest(operation,params)});
const memberInsight=createMemberInsight({getIdentity:()=>auth,request:(operation,params)=>bridge.accountRequest(operation,params),activity:memberActivity,understanding:memberUnderstanding,settings:memberSettings,onChange:()=>{if(view==='insight')renderInsight();}});
bindMemberUnderstandingEditor($('insight-detail'),{controller:memberUnderstanding,getReport:()=>memberInsight.read().report,settings:memberSettings,getSettingsContext:()=>memberInsight.settingsContext(),onSettingsSaved:()=>void memberInsight.refresh({quiet:true})});
function renderInsight(){const restoreInsightFocus=captureMemberUnderstandingFocus($('insight-detail'));const target=$('insight-detail'),active=target.contains(document.activeElement),action=document.activeElement?.dataset.insightAction,app=document.activeElement?.dataset.insightTarget;target.innerHTML=renderMemberInsight(memberInsight.read(),{native:true,poster:insightPoster()});if(active)(action?[...target.querySelectorAll('[data-insight-action]')].find(node=>node.dataset.insightAction===action&&node.dataset.insightTarget===app):target.querySelector('#benefit-title'))?.focus({preventScroll:true});restoreInsightFocus();}
const memberHome=mountMemberHome($('view-home'),{storage:localStore,getSnapshot:()=>({library,personal:personalState,prefs:effectivePrefs(),clients:clients.map(row=>client(row.id)),who:auth.signedIn?auth.account?.display_name||'SYNK 회원':null,}),getAppAction,onLaunch:launchFromHome,onRetry:()=>refreshAuth({reload:true}),onApp:id=>selectApp(id,{intro:true}),onPurpose:choosePurpose,onAccount:()=>openAccount(),onBenefits:()=>showView('benefits'),onBenefit:id=>openBenefit(id),onSolio:()=>showView('solio',{section:'home'}),onLibrary:()=>showView('library'),onUpdates:()=>showView('downloads'),onToast:toast});
const pulseClient=mountPulseClient($('pulse-client'),{storage:localStore,getContext:()=>({owner:library.owner,status:library.status}),getFavorite:()=>effectivePrefs().favorites.includes('pulse'),onFavorite:toggleSelectedFavorite,onToast:toast,onOpenApp:()=>command('pulse-app','pulse')});
// 「내 계정」: signed-in entry points open it; signed out they keep the sign-in dialog.
const accountPage=mountAccountPage($('view-account'),{bridge,getIdentity:()=>auth,getAppIds:()=>library.appIds,onBack:()=>showView('settings'),onSignIn:()=>openAccount(),onSignOut:signOut,onInsight:()=>showView('insight'),onWorkspace:()=>{if(allowed('messenger'))launchFromHome('messenger');else toast('이 계정에서는 작업실을 열 수 없어요.');},onAccountChanged:()=>void refreshAuth({reload:true}),toast:message=>toast(message)});
// Signed out, a sign-in entry starts the browser sign-in at once and the dialog shows how it goes; a saved sign-in that
// failed to load (status 'error') or one in progress keeps the dialog first, where 「저장된 로그인 다시 확인」 lives.
function openAccount(){if(bridge&&auth.signedIn){showView('account');return;}if(!$('account-dialog').open)$('account-dialog').showModal();if(bridge&&auth.configured&&auth.status==='signed-out')void startSignIn();}
const continuityRoot=document.createElement('aside');continuityRoot.setAttribute('aria-label','계정 라이브러리');$('view-home').before(continuityRoot);
const continuityStyle=document.createElement('link');continuityStyle.rel='stylesheet';continuityStyle.href='./platform-continuity.css';document.head.append(continuityStyle);
continuity=mountPlatformLibrary(continuityRoot,{native:true,getHost:()=>bridge,signIn:{guest:()=>!!bridge&&auth.configured===true&&!auth.signedIn&&(['signed-out','signing-in'].includes(auth.status)||auth.status==='error'&&auth.error?.retryable!==true),open:()=>openAccount()},getAppIds:()=>visibleLibraryAppIds(library),getDevice:()=>({favorites:prefs.favorites,recent:Object.entries(prefs.lastLaunch).filter(([,at])=>at).map(([id,at])=>({id,at,mode:'client'}))}),onChange:()=>{renderLibrary();renderSelected();syncBenefitPin();memberHome.render();convenience?.refresh();},onFavoritesChanged:()=>memberActivity.syncFavorites(),onOpen:id=>{if(allowed(id))launchFromHome(id);else toast('아직 설치하지 않았거나 이 계정에서 쓸 수 없는 앱이에요. 「설치·업데이트」에서 설치 상태를 봐 주세요.');},storage:localStorage});
function effectivePrefs(){const cloud=continuity?.projection();return projectLibraryPreferences(cloud?{...prefs,accountLibrary:true,favorites:cloud.favorites,lastLaunch:Object.fromEntries(cloud.recent.map(row=>[row.entryId||row.id,row.at]))}:prefs,library);}
// Account lifecycle participants. Registration order is the order every phase runs in: identity updates,
// resets after an account change, renders, unsaved-draft checks (first hit wins), discards and flushes.
// A new account-scoped screen registers here instead of editing setAuth or the draft guards.
accountLifecycle.register('member-activity',{onIdentity:()=>memberActivity.read()});
accountLifecycle.register('personalization',{onIdentity:()=>{if(sessionPurpose&&((library.owner&&library.owner!==sessionPurposeOwner)||['signed-out','signing-out','unconfigured'].includes(auth.status))){sessionPurpose=null;sessionPurposeOwner=null;}},render:()=>applyPersonalization()});
accountLifecycle.register('commands',{onAccountChange:()=>{busy=new Set();}});
accountLifecycle.register('library-view',{onAccountChange:({ownerChanged})=>{if(ownerChanged){detail='overview';filter='all';search='';$('search').value='';pulseLegacyView=false;}},render:()=>reconcileSelection()});
accountLifecycle.register('dialogs-and-toast',{onAccountChange:({ownerChanged})=>{
  if($('leave-dialog').open)$('leave-dialog').close('keep');
  for(const id of ['content-dialog','personal-dialog'])if($(id).open)$(id).close();
  $('content-title').textContent='';$('content-description').textContent='';$('content-image').removeAttribute('src');$('personal-message').textContent='';
  // A notice belongs to the person it was said to: only a change of person clears it. The same account's library or session
  // arriving again (right after a browser sign-in, for one) keeps 「○○ 님으로 로그인했어요」 up.
  if(ownerChanged){toastSeq++;clearTimeout(toastTimer);$('toast').hidden=true;$('toast').textContent='';}
}});
accountLifecycle.register('device-preferences',{onAccountChange:({ownerChanged})=>{if(ownerChanged){prefs=parsePreferences(readPrefs());personal=createPersonal();}}});
accountLifecycle.register('pulse-drafts',{hasUnsavedDrafts:()=>pulseClient.hasUnsavedChanges(),discardDraft:()=>pulseClient.discard()});
accountLifecycle.register('member-home',{hasUnsavedDrafts:()=>memberHome.hasUnsavedChanges(),discardDraft:()=>memberHome.discardDraft(),flushDraft:()=>memberHome.flushDraft?.()});
accountLifecycle.register('account-library',{render:()=>continuity?.render(),hasUnsavedDrafts:()=>!!continuity?.hasUnsavedDraft(),discardDraft:()=>continuity?.discardDraft(),flushDraft:()=>continuity?.flushDraft?.()});
accountLifecycle.register('library',{render:()=>renderLibrary()});
accountLifecycle.register('app-detail',{render:()=>renderSelected()});
accountLifecycle.register('downloads',{render:()=>renderDownloads()});
accountLifecycle.register('account',{render:()=>renderAuth()});
accountLifecycle.register('benefits',{render:()=>renderBenefits()});
// 솔리오(AI 구독 관리)와 맞춤 정보(내 성향)도 계정이 바뀌면 다시 그린다 — 계정판은 로그인 문맥으로, 내 성향은 새 계정의 기록으로(2026-11-13).
accountLifecycle.register('solio',{render:()=>renderSolio()});
accountLifecycle.register('insight',{render:()=>renderInsightView()});
accountLifecycle.register('convenience',{beforeOwnerChange:()=>convenience?.capture(),afterRender:()=>convenience?.refresh()});
function enqueueLibraryAction(id,action){
  const epoch=ownerEpoch;
  pendingLibraryActions++;
  const pending=libraryActionQueue.then(async()=>{
    if(epoch!==ownerEpoch||!allowed(id))return;
    const ready=await continuity?.ready();
    if(epoch!==ownerEpoch||!allowed(id))return;
    if(ready===false){toast('계정 기록을 불러오지 못해 저장하지 않았어요. 인터넷 연결을 확인한 뒤 다시 해 주세요.');return;}
    await action();
  });
  libraryActionQueue=pending.catch(error=>{if(epoch===ownerEpoch)toast(error.message);}).finally(()=>{pendingLibraryActions--;});
  return libraryActionQueue;
}
function recordLaunch(id,mode='client'){void memberActivity.trackLaunch(id);return enqueueLibraryAction(id,async()=>{if(continuity?.connected())await continuity.dispatch({type:'launch',id,mode});else{prefs.lastLaunch[id]=Date.now();savePrefs();renderLibrary();renderSelected();memberHome.render();}});}
// Presentation helpers: sprite icons, status LEDs and the device-level night/day theme.
const icon=name=>'<svg class="i" aria-hidden="true"><use href="#i-'+name+'"/></svg>';
const THEME_KEY='synk-platform-theme',THEMES=['night','day','system'];
// 머리는 영문 꼬리표 없이 한글 회색 한 줄과 상태만 둔다(3차 A 진열대). 2026-11-13 솔리오 판: 내 성향은 「맞춤 정보」, AI 구독 관리는 「솔리오」 머리.
// 혜택 상태 글은 웹과 같이 쓰는 benefits.mjs 그대로 두고, 로그인한 회원에게 「로그인하면 바로」만 「바로 보기」로 바꿔 그린다.
const benefitState=item=>auth.signedIn&&item?.statusLabel==='로그인하면 바로'?'바로 보기':item?.statusLabel;
const insightPoster=()=>({art:asset+MEMBER_INSIGHT.asset,label:'맞춤 정보',badge:benefitState(MEMBER_INSIGHT),status:MEMBER_INSIGHT.status});
const subscriptionsBoard=createSubscriptionsBoard({bridge,toast:message=>toast(message),poster:{art:asset+SOLIO_SUBSCRIPTIONS.asset,label:'솔리오',badge:SOLIO_SUBSCRIPTIONS.statusLabel,status:'integrated'}});
function statusTone(row){if(!row)return 'wait';const stage=apps[row.id]?.stage;if(stage==='planned'||row.status==='planned')return 'planned';if(row.publicWebAvailable)return 'ok';if(stage==='preview'||row.status==='preview')return 'preview';if(row.reason==='CHECKING')return 'wait';if(row.canLaunch)return row.updateAvailable?'wait':'ok';if(row.installer?.status==='preparing')return 'wait';if(row.reason==='INVALID_INSTALLATION')return 'alert';return 'off';}
// 낮이 기본(2026-11-08 A 진열대). 전에 고른 밤 · 기기 설정은 그대로 따른다.
function readTheme(){try{const value=localStorage.getItem(THEME_KEY);return THEMES.includes(value)?value:'day';}catch{return 'day';}}
function applyTheme(value){document.documentElement.dataset.theme=value;document.querySelectorAll('[data-theme-choice]').forEach(el=>el.setAttribute('aria-checked',String(el.dataset.themeChoice===value)));}
function setTheme(value){if(!THEMES.includes(value))return;try{localStorage.setItem(THEME_KEY,value);}catch{/* The theme still applies for this window. */}applyTheme(value);}
applyTheme(readTheme());
function createPersonal(){return createPlatformPersonalization(globalThis.SynkAtlasPersonalization,localStore,{key:accountStorageKey(PERSONAL_KEY,library.owner),scope:{...PLATFORM_SCOPE,personId:library.owner||'pending-account'}});}
function readPrefs(){try{return library.owner?localStorage.getItem(accountStorageKey('synk-launcher-view-v1',library.owner)):null;}catch{return null;}}
function savePrefs(){if(!library.owner)return;try{localStorage.setItem(accountStorageKey('synk-launcher-view-v1',library.owner),JSON.stringify(prefs));}catch{/* In-memory view state still works. */}convenience?.refresh();}
function allowed(id){return library.appIds.includes(id);}
function reconcileSelection(){if(['ready','guest'].includes(library.status))prefs.selected=visibleSelection(displayLibraryAppId(prefs.selected,library),personalState.order);}
function setAuth(snapshot,{environmentOnly=false}={}){
  if(!environmentOnly)authRevision++;
  const next=resolveLibrary(snapshot,environment),changed=JSON.stringify([library.owner,library.status,library.appIds,auth.sessionGeneration])!==JSON.stringify([next.owner,next.status,next.appIds,snapshot?.sessionGeneration]);
  // The registered screens own the resets and renders; changed accounts also advance ownerEpoch.
  const wasSignedIn=auth.signedIn===true;
  // Where a sign-in or sign-out lands (see takeLanding): a session the server ended opens the guest home, like 「로그아웃」.
  if(wasSignedIn&&next.owner==='anonymous-local')landing={route:{view:'home'},guest:true};
  accountLifecycle.transition({changed,ownerChanged:library.owner!==next.owner,commit:()=>{auth=snapshot||{status:'error',signedIn:false};library=next;}});
  // A sign-in that ended without an account (cancelled, refused, timed out) has no screen to come back to any more. A retryable
  // 'error' keeps it: 「계정 연결 다시 확인」 can still finish that sign-in. One that failed before the browser drops it in startSignIn.
  if(landing&&!landing.guest&&!auth.signedIn&&auth.status==='signed-out'&&auth.error)landing=null;
  if(bridge&&auth.signedIn&&library.owner)void continuity?.connect();
  // 「지난번 이 PC」 for the sign-in dialog: the main process's own reading of the account's address, once per account.
  if(bridge&&auth.signedIn&&library.owner&&rememberedOwner!==library.owner&&typeof bridge.accountIdentity==='function'){const owner=rememberedOwner=library.owner;const retry=()=>{if(rememberedOwner===owner)rememberedOwner=null;};void Promise.resolve(bridge.accountIdentity()).then(identity=>{if(identity?.ok===true&&library.owner===owner)rememberSignIn(localStore,identity);else retry();}).catch(retry);}
  // A session the server ended (a password changed elsewhere, 「모두 로그아웃」) says so once instead of a silent 「로그인」.
  if(wasSignedIn&&!auth.signedIn&&!signOutPending&&auth.status==='signed-out'&&auth.error?.code==='AUTH_REQUIRED')toast('로그인이 끝났어요. 다시 쓰려면 「로그인」을 눌러 주세요.');
  // Back from the browser signed in: the dialog's work is done. The main process answers authSignIn once the browser opens
  // ('signing-in'); the finished sign-in arrives here through onAuthChanged, by way of 'restoring' while auth-service install()
  // checks the new session. So a browser sign-in stays remembered from 'signing-in' until it lands signed in or ends otherwise
  // (a token refresh or the start-up restore also passes 'restoring' and says nothing).
  if(auth.status==='signing-in')signInLanding=true;
  else if(auth.signedIn&&signInLanding){signInLanding=false;if($('account-dialog').open)$('account-dialog').close();toast(`${auth.account?.display_name||'SYNK 회원'} 님으로 로그인했어요.`);}
  else if(auth.status!=='restoring'){
    // Ended without signing in while the dialog is closed (the home banner asked to wait there): say why once. A cancel is the member's own doing.
    if(signInLanding&&!auth.signedIn&&auth.error&&auth.error.code!=='AUTH_CANCELLED'&&!$('account-dialog').open)toast(auth.error.message||'로그인을 마치지 못했어요. 다시 해 주세요.');
    signInLanding=false;
  }
}
async function refreshAuth({reload=false}={}){
  if(!bridge)return;const revision=authRevision;
  try{
    if(reload&&(auth.signedIn||auth.status==='error'&&auth.error?.retryable===true)&&typeof bridge.accountRequest==='function')await bridge.accountRequest('load');
    if(revision!==authRevision)return;
    const snapshot=await bridge.authStatus();if(revision===authRevision){setAuth(snapshot);return authRevision;}
  }catch{if(revision===authRevision){setAuth({...auth,library:{status:'unavailable',appIds:[]},error:{...auth.error,message:'앱 목록을 불러오지 못했어요. 「다시 불러오기」를 눌러 주세요.'}});return authRevision;}}
}
function escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function client(id=prefs.selected){const row=clients.find(row=>row.id===id);return row&&typeof bridge?.openPublicApp==='function'&&Array.isArray(environment?.publicAppsAvailable)&&environment.publicAppsAvailable.includes(id)?{...row,publicWebAvailable:true}:row;}
function getAppAction(id){const action=primaryAction(client(id),{native:!!bridge,busy:false,teacherPreviewAvailable:typeof bridge?.openTeacherPreview==='function'&&environment?.teacherPreviewAvailable===true,productPreviewsAvailable:typeof bridge?.openProductPreview==='function'?environment?.productPreviewsAvailable:[],publicAppsAvailable:typeof bridge?.openPublicApp==='function'?environment?.publicAppsAvailable:[]});return busy.has(id)?{...action,disabled:true,pending:true,label:'여는 중…'}:action;}
function launchFromHome(id){if(!allowed(id))return;const action=getAppAction(id);if(!action.disabled&&['launch','teacher-preview','product-preview','public-web','pulse-app'].includes(action.action))return command(action.action,id);selectApp(id);}
function choosePurpose(context,{remember=false}={}){if(!Object.hasOwn(CONTEXTS,context))return;if(remember){openPersonalization();$('personal-context').value=context;$('personal-goal').value=CONTEXTS[context].goal;return;}sessionPurpose=context;sessionPurposeOwner=library.owner;applyPersonalization();renderLibrary();renderSelected();}
function openLibrarySearch(){$('search').focus();$('search').select();}
// 회색 선반 칸에 세우는 물건 그림(모두 누끼).
function stageImage(id,{alt=''}={}){const art=appArt(id);return art?'<img src="'+escape(art.src)+'" alt="'+escape(alt)+'" decoding="async">':'';}
function downloadSummary(){const preparing=clients.filter(row=>allowed(row.id)&&row.installer?.status==='preparing').length,ready=clients.filter(row=>allowed(row.id)&&row.installer?.status==='ready').length;return preparing?`설치 파일 준비 중 · ${preparing}개`:ready?`설치 준비됨 · ${ready}개`:'설치 중인 앱 없음';}
function homeFoot(){const os=environment?({win32:'Windows',darwin:'macOS',linux:'Linux'})[environment.platform]||environment.platform:'';return [downloadSummary(),'SYNK Platform'+(environment?.version?' '+environment.version:''),environment?os+' '+environment.arch:'브라우저 미리보기'].join(' · ');}
function hasUnsavedDrafts(){return accountLifecycle.hasUnsavedDrafts();}
function confirmDraftExit(message){
  if(pendingLibraryActions){toast('즐겨찾기와 실행 기록을 저장하는 중이에요. 끝난 뒤 다시 해 주세요.');return Promise.resolve(false);}
  if(!hasUnsavedDrafts())return Promise.resolve(true);
  if(leaveDecision)return Promise.resolve(false);
  $('leave-description').textContent=message;
  $('leave-dialog').returnValue='keep';
  return new Promise(resolve=>{leaveDecision=resolve;$('leave-dialog').showModal();});
}
async function confirmUpdateInstall(){const epoch=ownerEpoch;return await confirmDraftExit('돌아가서 저장하거나, 메모를 버리고 업데이트할 수 있어요.')&&epoch===ownerEpoch&&!hasUnsavedDrafts();}
async function windowAction(action){if(!bridge?.windowAction)return;const epoch=ownerEpoch;if(action==='close'&&environment?.closeToTray!==true&&(!await confirmDraftExit('돌아가서 저장하거나, 메모를 버리고 창을 닫을 수 있어요.')||epoch!==ownerEpoch))return;try{await bridge.windowAction(action);}catch{toast('창을 바꾸지 못했어요.');}}
// A longer notice stays longer (about the time to read it), and one said while the window was behind another (a sign-in
// that timed out in the browser) starts counting only once the window is back in front.
function toast(message){
  const seq=++toastSeq,wait=Math.min(12000,Math.max(5500,2000+90*[...String(message)].length));
  $('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);
  const start=()=>{if(seq!==toastSeq)return;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{if(seq===toastSeq)$('toast').hidden=true;},wait);};
  if(globalThis.document?.hasFocus?.()===false&&typeof globalThis.addEventListener==='function')globalThis.addEventListener('focus',start,{once:true});else start();
}
function errorText(result){const code=result?.code||result?.error?.code;return ({
  RELEASE_UNAVAILABLE:'이 기기에 맞는 설치 파일이 아직 없어요.',INVALID_INSTALLATION:'설치된 앱을 열 수 없는 상태예요. 설치 파일을 다시 준비해 주세요.',NOT_INSTALLED:'앱을 설치한 뒤 열어 주세요.',LAUNCH_FAILED:'앱을 열지 못했어요. 다시 눌러 보고, 계속 안 되면 다시 설치해 주세요.',AUTH_NOT_CONFIGURED:'로그인 설정을 찾지 못해 로그인할 수 없어요. synk.im에서 PC 앱을 다시 받아 설치해 주세요.',AUTH_CANCELLED:'로그인을 취소했어요.',PACKAGE_HASH_MISMATCH:'설치 파일이 온전하지 않아요. 다시 준비해 주세요.',PACKAGE_SIZE_MISMATCH:'설치 파일 크기가 맞지 않아요. 다시 준비해 주세요.',PACKAGE_NOT_FOUND:'플랫폼 안에서 설치 파일을 찾지 못했어요. 플랫폼을 업데이트해 주세요.',INSTALLER_OPEN_FAILED:'설치 파일을 열지 못했어요. 다시 준비해 주세요.',PREPARATION_CANCELLED:'설치 파일 준비를 취소했어요.',PACKAGE_NOT_READY:'먼저 설치 파일을 준비해 주세요.',PREVIEW_DEVELOPMENT_ONLY:'이 판에서는 열 수 없어요. 웹에서 열어 주세요.',PREVIEW_LAUNCH_FAILED:'앱을 열지 못했어요. 잠시 뒤 다시 눌러 주세요.',PREVIEW_NOT_IN_LIBRARY:'이 계정에는 이 앱이 열려 있지 않아요. 학교나 회사 담당자에게 물어봐 주세요.',UNKNOWN_CLIENT:'알 수 없는 앱이에요. 플랫폼을 다시 열어 주세요.'})[code]||'처리하지 못했어요. 잠시 뒤 다시 눌러 주세요.';}
function preserveFocus(render){const el=document.activeElement,key=el?.dataset?.focusKey;render();if(key){const found=[...document.querySelectorAll('[data-focus-key]')].find(node=>node.dataset.focusKey===key);found?.focus({preventScroll:true});}}
function renderLibrary(){
  const prefs=effectivePrefs();
  memberHome.render();
  renderBenefitSearch();
  const sidebarIds=displayLibraryAppIds(library).filter(id=>!memberBenefit(id));
  const copy=libraryCopy({...library,appIds:sidebarIds},{granted:library.appIds});
  $('library-count').textContent='앱 '+sidebarIds.length+'개';$('library-caption').textContent=copy.caption==='내 라이브러리'?'이 계정에서 쓰는 앱':copy.caption;$('library-access-note').textContent=copy.note;
  // 빈 화면은 권한 수가 아니라 보이는 앱 수로 판단한다 — WORLD 권한만 있으면 목록은 비고 휴대폰 칸으로 가는 단추가 선다(2026-11-11).
  // 혜택 앱(플레저 등)만 있는 계정은 전처럼 빈 화면을 띄우지 않고, WORLD 권한이 있는데 격자에 그릴 앱이 없을 때만 휴대폰 안내를 띄운다.
  const listedCount=displayLibraryAppIds(library).length;
  libraryEmpty=!sidebarIds.length&&(!listedCount||copy.worldOnPhone);$('library-empty-title').textContent=copy.title;$('library-empty-description').textContent=copy.description;$('library-world-phone').hidden=!copy.worldOnPhone;
  $('library-account').textContent=auth.signedIn?'내 계정':'로그인 안내';$('library-retry').hidden=library.status!=='unavailable';
  $('personal-entry').hidden=!listedCount;
  // 격자: 앱마다 회색 선반 칸 하나(물건 · 이름 · 한 줄 · 상태). 누르면 앱 소개, PULSE는 전용 창(11-04 결정)이다.
  preserveFocus(()=>{let count=0;const order=filter==='favorites'?[...new Set([...prefs.favorites,...personalState.order])].filter(allowed):personalState.order;$('app-list').innerHTML=order.filter(id=>sidebarIds.includes(id)).map(id=>{const app=apps[id],row=client(id),favorite=prefs.favorites.includes(id);if(!matchesLibrary(id,{search,filter,favorites:prefs.favorites,client:row,teacherAvailable:allowed('teacher')}))return '';count++;const at=prefs.lastLaunch[id],go=id==='pulse'?'전용 창 열기':'앱 소개 보기';return `<button class="shelf-item brand-${id}" data-app="${id}" data-focus-key="app-${id}" aria-label="${escape(app.name)}, ${escape(statusLabel(row))}${favorite?', 즐겨찾기':''}"><span class="stage">${stageImage(id)}</span>${favorite?'<span class="favorite-mark" aria-hidden="true">'+icon('star')+'</span>':''}<span class="shelf-label"><span class="name">${escape(app.name)}</span><span class="desc">${escape(app.description)}</span><span class="meta"><span class="dot" data-tone="${statusTone(row)}" aria-hidden="true"></span>${escape(statusLabel(row))}${at?' · '+escape(new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric'}).format(new Date(at)))+'에 열었어요':''}</span><span class="go">${go} ${icon(id==='pulse'?'arrow-up-right':'arrow-right')}</span></span></button>`;}).join('');$('empty-search').hidden=count>0||!sidebarIds.length;$('world-search-hint').hidden=!search||!matchesLibrary('world',{search});});document.querySelectorAll('[data-filter]').forEach(el=>{el.setAttribute('aria-pressed',String(el.dataset.filter===filter));el.hidden=!sidebarIds.length||(el.dataset.filter==='planned'&&!sidebarIds.some(id=>apps[id].stage==='planned'))||(el.dataset.filter==='development'&&(!sidebarIds.some(id=>apps[id].stage!=='planned')||!sidebarIds.some(id=>apps[id].stage==='planned')));});
  syncLibraryMode();}
// 격자 · 빈 화면 안내 · 앱 소개 중 하나만 보인다. 앱이 없으면 격자 대신 빈 화면 안내가 서고,
// 앱 소개를 열면 빈 화면 안내도 접는다 — WORLD와 혜택 권한만 있는 계정이 홈에서 플레저 소개를 열 때 둘이 겹치지 않게(2026-11-12).
function syncLibraryMode(){const app=allowed(prefs.selected),isPulse=app&&prefs.selected==='pulse'&&pulseLegacyView,detailShown=!!(libraryDetail&&app);$('library-empty').hidden=!libraryEmpty||detailShown;$('library-grid').hidden=!displayLibraryAppIds(library).length||libraryEmpty||detailShown;$('pulse-client').hidden=!detailShown||!isPulse;$('app-detail').hidden=!detailShown||isPulse;const origin=$('breadcrumb-origin');if(origin){origin.textContent=libraryOrigin==='home'?'내 홈':'라이브러리';origin.dataset.view=libraryOrigin==='home'?'home':'library';}}
function renderSelected(){
  reconcileSelection();pulseClient.syncContext();const app=allowed(prefs.selected)?apps[prefs.selected]:null,isPulse=!!app&&prefs.selected==='pulse'&&pulseLegacyView;syncLibraryMode();if(!app)$('app-detail').hidden=true;if(isPulse){document.documentElement.dataset.product='pulse';$('brand-scope').textContent=app.brand;$('breadcrumb-app').textContent=app.name;renderActions();pulseClient.render();return;}
  if(!app){document.documentElement.dataset.product='platform';for(const id of ['brand-scope','breadcrumb-app','hero-category','hero-title','hero-description','product-stage','detail-content','action-notice','install-status','install-version','last-launch'])$(id).textContent='';$('hero-art').removeAttribute('src');$('teacher-web-link').hidden=true;$('primary-action').disabled=true;$('primary-action').dataset.action='none';$('teaching-action').hidden=true;renderPersonalization();return;}
document.documentElement.dataset.product=prefs.selected;$('brand-scope').textContent=app.brand;$('breadcrumb-app').textContent=app.name;$('hero').className='app-media brand-'+prefs.selected+(app.stage==='planned'||app.stage==='preview'?' expansion':'');const art=appArt(prefs.selected);$('hero-art').src=art?.src||'';$('hero-art').alt=app.alt;$('hero-category').textContent=app.audience;$('hero-title').textContent=app.name;$('hero-description').textContent=app.description;$('product-stage').textContent=app.stage==='planned'?'준비 중':app.stage==='preview'?statusLabel(client()):'따로 설치하는 PC 앱';const contentTab=document.querySelector('[data-detail="content"]');if(contentTab){contentTab.textContent=app.stage==='planned'?'준비 중인 기능':prefs.selected==='teacher'?'하는 일':app.stage==='preview'?'할 수 있는 것':'들어 있는 것';
  // 둘째 탭은 WORLD의 「들어 있는 것」(게임·연습 목록)에만 개요와 다른 내용이 있다. 다른 앱은 개요를 되풀이해서 숨긴다.
  contentTab.hidden=prefs.selected!=='world';if(contentTab.hidden&&detail==='content')detail='overview';}renderActions();renderDetails();renderPersonalization();}
function renderActions(){const prefs=effectivePrefs();if(!allowed(prefs.selected))return;const row=client(),action=getAppAction(prefs.selected),favorite=prefs.favorites.includes(prefs.selected);$('primary-action').textContent=action.label;$('primary-action').disabled=action.disabled;$('primary-action').dataset.action=action.action;$('favorite').setAttribute('aria-pressed',String(favorite));$('favorite').setAttribute('aria-label',favorite?'즐겨찾기에서 제거':'즐겨찾기에 추가');$('install-status').textContent=statusLabel(row);$('install-status').parentElement?.parentElement?.setAttribute?.('data-tone',statusTone(row));$('install-version').textContent=row?.version||'—';const versionRow=$('install-version').parentElement;if(versionRow)versionRow.hidden=!row?.version;const time=prefs.lastLaunch[prefs.selected];$('last-launch').textContent=time?new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(time)):'기록 없음';
  $('teaching-action').hidden=prefs.selected!=='messenger'||!allowed('teacher');$('teaching-action').disabled=getAppAction('teacher').disabled;
  $('teacher-web-link').hidden=!!bridge||prefs.selected!=='teacher';let notice='';if(action.action==='pulse-app')notice='PULSE 창이 따로 열려요. 웹브라우저와 로그인은 따로예요.';else if(action.action==='public-web')notice=prefs.selected==='path'?'기본 브라우저에서 면접 연습이 열려요. Quest 브라우저에서도 같은 주소로 열 수 있어요. 답은 계정에 저장하지 않아요.':'기본 브라우저에서 열려요. 기록을 계정에 남기려면 열린 화면에서 SYNK ID로 로그인해 주세요.';else if(apps[prefs.selected].stage==='planned')notice=apps[prefs.selected].boundary;else if(prefs.selected==='teacher')notice=apps.teacher.boundary+' '+(!bridge?'아래 링크로 이 컴퓨터의 워크스페이스에서 「내 수업」을 열 수 있어요.':action.action==='teacher-preview'?'누르면 워크스페이스 창의 「내 수업」 탭이 열려요.':'PC 앱에서 여는 기능은 아직 준비 중이에요.');else if(apps[prefs.selected].stage==='preview')notice=apps[prefs.selected].boundary+' '+(bridge?'창이 따로 열려요.':'SYNK Platform PC 앱에서 열려요.');else if(!bridge)notice='브라우저에서는 화면만 볼 수 있어요. 설치와 실행은 SYNK Platform PC 앱에서 해요.';else if(row?.canLaunch)notice=row.updateAvailable?`새 버전(${row.latestVersion})이 있어요. 「설치·업데이트」에서 받을 수 있어요.`:'따로 설치한 PC 앱으로 열려요.';else if(row?.installer?.status==='preparing')notice=`설치 파일을 준비하고 있어요. ${bytes(row.installer.transferredBytes)} / ${bytes(row.installer.totalBytes)}`;else if(row?.installer?.status==='installer-opened')notice=environment?.platform==='darwin'?'열린 창에서 앱을 Applications 폴더로 옮긴 뒤 「설치 상태 확인」을 눌러 주세요.':'설치 창에서 설치를 마친 뒤 「설치 상태 확인」을 눌러 주세요.';else if(row?.installer?.canOpen)notice=environment?.platform==='darwin'?'「설치 시작」을 누르면 설치 파일이 열려요. 앱을 Applications 폴더로 옮겨 주세요.':'설치 파일이 준비됐어요. 「설치 시작」을 누르면 설치 창이 열려요.';else if(row?.installer?.canPrepare)notice=`${row.latestVersion?'v'+row.latestVersion+' · ':''}${Number(row.installer.totalBytes)>0?'설치 파일 '+bytes(row.installer.totalBytes)+' · ':''}이 PC에 따로 설치해요.`;else notice='이 기기에 맞는 설치 파일이 아직 없어요.';if(prefs.selected==='messenger'&&allowed('teacher')&&bridge&&row?.canLaunch&&getAppAction('teacher').disabled)notice+=' 「내 수업」은 워크스페이스를 실행한 뒤 그 안의 「내 수업」 탭에서 열 수 있어요.';$('action-notice').textContent=notice;
}
function renderDetails(){if(!allowed(prefs.selected)){$('detail-content').innerHTML='';return;}document.querySelectorAll('[data-detail]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.detail===detail)));if(['planned','preview'].includes(apps[prefs.selected].stage)){renderExpansion();return;}const world=prefs.selected==='world';if(detail==='info'){const row=client();$('detail-content').innerHTML=`<dl class="info-grid"><dt>앱</dt><dd>${escape(apps[prefs.selected].name)}</dd><dt>여는 방식</dt><dd>이 PC에 따로 설치하는 앱</dd><dt>이 기기</dt><dd>${escape(systemName())}</dd><dt>설치 상태</dt><dd>${escape(statusLabel(row))}</dd><dt>최신 버전</dt><dd>${escape(row?.latestVersion||'확인 중')}</dd><dt>계정</dt><dd>${world?'SYNK ID로 로그인해요. 학습 기록은 WORLD에 저장돼요.':'SYNK ID로 로그인하고, 회사 구성원으로 등록돼 있어야 해요.'}</dd><dt>판</dt><dd>시험판(Preview)이에요. 아직 서명 전이라 설치할 때 Windows가 경고를 띄울 수 있어요.</dd></dl>`;return;}
  if(!world){$('detail-content').innerHTML=`<div class="overview-heading"><h2>Workspace에서 하는 일</h2><span>SYNK 팀 업무 앱</span></div><p class="product-summary">${escape(apps.messenger.summary)}</p><div class="feature-list">${apps.messenger.features.map((feature,index)=>`<article><h3>${escape(feature[0])}</h3><p>${escape(feature[1])}</p></article>`).join('')}</div><div class="overview-foot"><p>회사 구성원으로 등록된 SYNK ID로 써요. 고객과 함께하는 광고 제작은 PULSE에서 해요.</p><button class="text-link" data-show-detail="info">앱 정보 ${icon('arrow-right')}</button></div>`;return;}
  if(detail==='content'){$('detail-content').innerHTML=`<div class="overview-heading"><h2>WORLD에 들어 있는 것</h2><span>WORLD 앱 안에서 해요</span></div><div class="content-list">${Object.entries(games).map(([id,game])=>`<div class="content-row"><h3>${game.name}</h3><p>${game.tag}</p><button class="ghost-button" data-game="${id}">화면 보기 ${icon('arrow-up-right')}</button></div>`).join('')}${worldExtras.map(([name,tag])=>`<div class="content-row"><h3>${escape(name)}</h3><p>${escape(tag)}</p></div>`).join('')}</div>`;return;}
  $('detail-content').innerHTML=`<div class="overview-heading"><h2>WORLD에서 하는 일</h2><span>한국어 학습 앱</span></div><p class="product-summary">${escape(apps.world.summary)}</p><div class="feature-list">${apps.world.features.map((feature,index)=>`<article><h3>${escape(feature[0])}</h3><p>${escape(feature[1])}</p>${index===1?Object.entries(games).map(([id,game])=>`<button class="text-link" data-game="${id}" aria-label="${game.name} 화면 보기">${escape(game.name)} ${icon('arrow-up-right')}</button>`).join(''):''}</article>`).join('')}</div><div class="overview-foot"><p>WORLD에 들어 있는 연습과 게임을 하나씩 볼 수 있어요.</p><button class="text-link" data-show-detail="content">전부 보기 ${icon('arrow-right')}</button></div>`;
}
function renderExpansion(){const app=apps[prefs.selected],preview=app.stage==='preview',teacher=prefs.selected==='teacher',stage=preview?statusLabel(client()):'준비 중';
  if(prefs.selected==='pulse'&&detail!=='info'){$('detail-content').innerHTML='<div class="overview-heading"><h2>PULSE에서 하는 일</h2><span>전용 창에서 열려요</span></div><p class="product-summary">'+escape(app.summary)+'</p><div class="feature-list is-even">'+app.features.map((feature,index)=>'<article><h3>'+escape(feature[0])+'</h3><p>'+escape(feature[1])+'</p></article>').join('')+'</div><section class="product-maker" aria-labelledby="product-maker-title"><p class="label">만드는 사람</p><h3 id="product-maker-title">'+escape(app.maker.title)+'</h3><p>'+escape(app.maker.body)+'</p><p class="product-maker-credits">'+escape(app.maker.credits)+'</p></section><div class="overview-foot"><p>PULSE 창은 이 PC에 로그인이 남아 있어요. 웹브라우저에서 열 때는 따로 로그인해요. 제작자 화면은 웹브라우저에서 열려요.</p><button class="text-link" data-pulse-legacy="open">이 PC에 저장한 이전 요청 초안 '+icon('arrow-right')+'</button></div>';return;}
  const opens={path:'기본 브라우저에서 열려요(synk.im).',care:'기본 브라우저에서 열려요(synk.im).',fortune:'기본 브라우저에서 열려요(synk.im).'}[prefs.selected],access={path:'로그인 없이 써요. 답은 저장하지 않아요.',care:'로그인 없이 시작하고, 로그인하면 사람·일정·장부를 계정에 보관해요.',fortune:'로그인 없이 보고, 로그인하면 담아 둔 운세와 메모를 계정에 보관해요.'}[prefs.selected];
  if(detail==='info'){$('detail-content').innerHTML='<dl class="info-grid"><dt>앱</dt><dd>'+escape(app.name)+'</dd><dt>쓰는 사람</dt><dd>'+escape(app.audience)+'</dd><dt>상태</dt><dd>'+stage+'</dd><dt>여는 방식</dt><dd>'+(teacher?'워크스페이스 창의 「내 수업」 탭':opens||(preview?'창이 따로 열려요':'준비 중'))+'</dd><dt>계정</dt><dd>'+(teacher?'「내 수업」에 SYNK ID로 로그인하면 담당 반이 열려요.':access||(preview?'이 계정에서 쓸 수 있는 앱이에요.':'아직 계정으로 쓸 수 없어요.'))+'</dd><dt>알아 둘 것</dt><dd>'+escape(memberBenefit(prefs.selected)?.availability||app.boundary)+'</dd></dl>';return;}
  const heading=detail==='content'?(teacher?'내 수업에서 하는 일':preview?'할 수 있는 것':'준비 중인 기능'):(teacher?'담당 반을 한눈에':preview?app.short+'에서 하는 일':'준비 중인 일');
  $('detail-content').innerHTML='<div class="overview-heading"><h2>'+heading+'</h2><span>'+stage+'</span></div><p class="product-summary">'+escape(app.summary)+'</p><div class="audience-line"><span>쓰는 사람</span><strong>'+escape(app.audience)+'</strong></div><div class="feature-list">'+app.features.map((feature,index)=>'<article><h3>'+escape(feature[0])+'</h3><p>'+escape(feature[1])+'</p></article>').join('')+'</div><div class="overview-foot"><p>'+escape(app.boundary)+'</p><button class="text-link" data-show-detail="info">앱 정보 '+icon('arrow-right')+'</button></div>';
}
function downloadButtons(row){const id=row.id,i=row.installer||{},disabled=busy.has(id)?'disabled':'';if(i.status==='preparing')return `<button class="ghost-button" data-command="cancel" data-client="${id}" data-focus-key="cancel-${id}" ${disabled}>취소</button>`;if(i.canOpen)return `<button class="solid-button" data-command="open" data-client="${id}" data-focus-key="open-${id}" ${disabled}>${i.status==='installer-opened'?'설치 다시 열기':'설치 시작'}</button>`;if(i.canPrepare)return `<button class="solid-button" data-command="prepare" data-client="${id}" data-focus-key="prepare-${id}" ${disabled}>${icon('download')}${row.updateAvailable?'업데이트 준비':i.status==='error'?'다시 준비':'설치 파일 준비'}</button>`;return '<span class="field-label">아직 설치 파일 없음</span>';}
function renderDownloads(){preserveFocus(()=>{$('download-list').innerHTML=INSTALLABLE_IDS.filter(id=>allowed(id)&&!UNLISTED_APP_IDS.includes(id)).map(id=>{const row=client(id)||{id},i=row.installer||{},progress=progressValue(i);return `<article class="download-row brand-${id}"><span class="download-thumb" aria-hidden="true">${stageImage(id)}</span><div><h2>${apps[id].name}</h2><p>${bridge?escape(!i.status||i.status==='idle'?(row.updateAvailable?'업데이트 가능':row.canLaunch?'설치됨':'설치 가능'):installerLabel(i)):'PC 앱에서 설치할 수 있어요'}${row.latestVersion?' · v'+escape(row.latestVersion):''}</p>${i.status==='preparing'?`<progress value="${progress}" max="100" aria-label="${apps[id].name} 설치 파일 준비"></progress><span class="download-bytes">${bytes(i.transferredBytes)} / ${bytes(i.totalBytes)} · ${Math.floor(progress)}%</span>`:i.totalBytes?`<span class="download-bytes">${bytes(i.totalBytes)}</span>`:''}${i.error?`<p>${escape(errorText({code:i.error.code||i.error}))}</p>`:''}</div><div class="download-actions">${bridge?downloadButtons(row):''}</div></article>`;}).join('')||'<p class="download-empty">이 계정으로 설치할 앱이 없어요.</p>';});
  const preparing=clients.filter(row=>allowed(row.id)&&row.installer?.status==='preparing'),ready=clients.filter(row=>allowed(row.id)&&row.installer?.status==='ready');$('queue-count').hidden=!preparing.length&&!ready.length;$('queue-count').textContent=preparing.length+ready.length;$('download-status').textContent=downloadSummary();$('home-foot-text').textContent=homeFoot();document.querySelector('.footer-progress').hidden=!preparing.length;$('footer-progress-fill').style.width=(preparing.length?progressValue(preparing[0].installer):0)+'%';
}
function systemName(){return environment?`${({win32:'Windows',darwin:'macOS',linux:'Linux'})[environment.platform]||environment.platform} · ${environment.arch}`:'브라우저 미리보기';}
function renderSettings(){renderPersonalization();$('density').value=prefs.density;document.documentElement.classList.toggle('compact',prefs.density==='compact');$('platform-version').textContent=environment?`v${environment.version} · ${systemName()}`:'화면 미리보기';$('diagnostics').innerHTML=`<dt>화면</dt><dd>${bridge?'PC 앱에 들어 있음':'브라우저 미리보기'}</dd><dt>SYNK ID</dt><dd>${auth.signedIn?'로그인됨':auth.configured?'로그인 안 함':'로그인 설정 없음'}</dd><dt>판</dt><dd>${environment?.mode==='release'?'정식판':'시험판(Preview)'}</dd><dt>앱 실행</dt><dd>${bridge?'앱마다 따로 열림':'PC 앱에서'}</dd>${allowed('pulse')?'<dt>PULSE 이전 초안</dt><dd><button class="text-link" data-pulse-legacy="open">이 PC에 저장한 요청 초안 보기</button></dd>':''}`;}
function renderAuth(){
  const signedIn=auth.signedIn,signing=['signing-in','restoring','signing-out'].includes(auth.status),retryable=!!bridge&&auth.configured&&!signedIn&&!signing&&auth.status==='error'&&auth.error?.retryable===true&&typeof bridge.accountRequest==='function',name=auth.account?.display_name||'SYNK 회원';
  $('account-button').dataset.signedIn=String(!!signedIn);$('account-button').setAttribute('aria-label',signedIn&&bridge?'내 계정 메뉴':signedIn?'내 계정':'SYNK ID 로그인');$('settings-login').textContent=signedIn?'내 계정':'로그인';
  const phase=auth.status==='signing-in'?'signing-in':auth.status==='restoring'?'restoring':auth.status==='signing-out'?'signing-out':null;
  $('account-label').textContent=signedIn?name:phase==='signing-out'?'로그아웃 중':phase==='restoring'?'로그인 확인 중':signing?'로그인 중':'로그인';
  const avatar=$('account-button').querySelector?.('.avatar'),initial=signedIn?[...name][0]||'S':'S';if(avatar&&avatar.textContent!==initial)avatar.textContent=initial;
  $('account-title').textContent=signedIn?`${name} 님`:phase==='signing-in'?'브라우저에서 로그인 중':phase==='restoring'?'로그인 확인 중':phase==='signing-out'?'로그아웃 중':'SYNK 시작하기';
  $('account-description').textContent=signedIn?'앱마다 쓸 수 있는 범위는 따로 정해져 있어요.':phase==='signing-in'?'기본 브라우저에 SYNK ID 화면을 열었어요. Google과 이메일 중 하나로 로그인한 뒤 「연결하기」를 누르면 이 앱으로 돌아와요.':retryable?'저장된 로그인을 다시 불러오거나 새로 로그인해 주세요.':'SYNK ID 하나로 Workspace·PULSE·솔리오를 써요.';
  let message=signedIn?'로그인돼 있어요.':!bridge?'회원가입과 로그인은 SYNK Platform PC 앱에서 해요.':!auth.configured?'로그인 설정을 찾지 못해 로그인할 수 없어요. synk.im에서 PC 앱을 다시 받아 설치해 주세요.':phase==='signing-in'?'브라우저 창에서 로그인하고 「연결하기」를 눌러 주세요. 창이 안 보이면 「로그인 취소」를 누른 뒤 다시 로그인해 주세요.':phase==='restoring'?'저장된 로그인을 확인하고 있어요.':phase==='signing-out'?'로그아웃하고 있어요.':signUpOpened?'회원가입 페이지를 열었어요. 가입을 마쳤다면 「로그인」을 눌러 주세요.':'아직 로그인하지 않았어요.';
  if(auth.error)message+='\n'+(auth.error.message||'로그인을 완료하지 못했어요. 다시 시도해 주세요.');
  // A password changed in the browser's SYNK ID ends this app's session too.
  if(!signedIn&&auth.error?.code==='AUTH_REQUIRED'&&accountPage.securityVisitedRecently())message+='\n비밀번호를 바꿨다면 새 비밀번호로 다시 로그인해 주세요.';$('account-state').textContent=message;
  for(const id of ['signup-button','sign-up']){$(id).hidden=!!signedIn;$(id).disabled=typeof bridge?.authSignUp!=='function'||signing||signUpPending||accountRetryPending;$(id).textContent=signUpPending?'여는 중…':'회원가입';}
  $('signup-help').hidden=!!signedIn||signing||retryable;
  $('forgot-password').hidden=!!signedIn||signing||!bridge||!auth.configured;$('forgot-password').disabled=typeof bridge?.authRecover!=='function';
  const recent=!signedIn&&auth.status!=='signing-out'?recentSignIn(localStore):null;$('account-recent').hidden=!recent;$('account-recent').textContent=recentSignInText(recent);
  $('account-retry').hidden=!retryable;$('account-retry').className=retryable?'primary':'ghost-button';$('sign-in').className=retryable?'ghost-button':'primary';$('account-retry').disabled=accountRetryPending||signUpPending;
  $('sign-in').textContent=retryable?'새로 로그인':'로그인';$('sign-in').hidden=signedIn||signing;$('sign-in').disabled=!bridge||!auth.configured||accountRetryPending||signUpPending;
  $('sign-out').hidden=!signedIn;$('cancel-sign-in').hidden=auth.status!=='signing-in';continuity?.authChanged?.();$('settings-account').textContent=signedIn?`${name} 님으로 로그인됨`:auth.configured?'로그인하지 않음':'로그인 설정 없음';renderSettings();accountPage.authChanged();$('profile-menu-who').textContent=signedIn?`${name} 님`:'';syncProfileMenu();if(view==='solio')renderSolio();
}
function readRoute(){return {view,appId:view==='library'&&!libraryDetail?null:prefs.selected,detail,benefitId:view==='benefits'?selectedBenefit:null,section:view==='solio'?solioTab:null,scroll:$('main').scrollTop,pageScroll:globalThis.scrollY||0};}
// 화면 이동. 옛 회원 혜택 경로(내 성향 · 구독 계정판)는 새 자리로 바꿔 받는다(2026-11-13). 화면을 떠나면 그 화면의 개인 글 · 다시 그리기를 끈다 —
// 내 성향은 #insight-detail을 비우고 보이기를 끄며, AI 구독 관리는 솔리오의 그 탭이 아닐 때 보이기를 끄고 그릇을 비운다(1분 다시 그리기가 다른 화면을 덮지 않게).
const VIEW_IDS=['home','library','solio','benefits','downloads','settings','account','insight'];
function showView(next,{restore=false,...route}={}){if(next==='benefits'&&Object.hasOwn(SOLIO_LEGACY_BENEFITS,route.benefitId||'')){const moved=solioMigrateRoute({view:next,...route});next=moved.view;route={...route,benefitId:null,section:moved.section};}if(!VIEW_IDS.includes(next))return;closeProfileMenu();if(convenience&&!restore){convenience.navigate({view:next,appId:next==='library'?null:prefs.selected,...route});return;}view=next;if(view==='library'){libraryDetail=allowed(route.appId);if(!libraryDetail)libraryOrigin='library';}if(view!=='benefits')$('benefit-detail').innerHTML='';if(view!=='insight'){memberInsight.setVisible(false);$('insight-detail').innerHTML='';}if(view==='solio')solioTab=solioSection(route.section);if(!(view==='solio'&&solioTab==='subscriptions')){subscriptionsBoard.setVisible(false);$('solio-subscriptions').innerHTML='';}if(allowed(route.appId))prefs.selected=route.appId;detail=route.detail||'overview';selectedBenefit=view==='benefits'&&memberBenefit(route.benefitId)?route.benefitId:null;for(const name of VIEW_IDS)$('view-'+name).hidden=name!==view;
  // 「내 계정」 sits under 설정, so that tab stays lit; an app intro opened from 내 홈 keeps 내 홈 lit (its 위치 줄 says 「내 홈 / …」).
  const tab=['account','insight'].includes(view)?'settings':view==='library'&&libraryDetail&&libraryOrigin==='home'?'home':view;if(view!=='account')accountPage.hide();document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===tab);if(el.dataset.view===tab)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});if(view==='home'){memberHome.render();$('member-home-title').focus({preventScroll:true});}if(view==='library'){renderLibrary();renderSelected();(libraryDetail?$('hero-title'):$('main'))?.focus?.({preventScroll:true});}if(view==='downloads')renderDownloads();if(view==='settings')renderSettings();if(view==='account')accountPage.show();if(view==='benefits'){renderBenefits();$(selectedBenefit?'benefit-title':'benefits-title').focus({preventScroll:true});}if(view==='solio'){renderSolio();$(solioTab==='subscriptions'?'benefit-title':'solio-title')?.focus?.({preventScroll:true});}if(view==='insight'){renderInsightView();$('benefit-title')?.focus?.({preventScroll:true});}document.documentElement.dataset.view=view;$('main').scrollTop=route.scroll||0;globalThis.scrollTo?.(0,route.pageScroll||0);$('titlebar')?.classList.toggle('scrolled',(route.scroll||0)>4);}
function canPreviewBenefit(id){return typeof bridge?.openProductPreview==='function'&&benefitPreviewAvailable(id,{native:!!bridge,appIds:library.appIds,productPreviewsAvailable:environment?.productPreviewsAvailable});}
// 라이브러리 검색칸: 앱 아래에 솔리오 · 회원 혜택 · 맞춤 정보에서 찾은 곳을 보인다(옛 이름 「계정판」 · 「성향」으로 찾아도 새 자리, 2026-11-13).
function renderBenefitSearch(){const results=solioSearch(search);$('benefits-search').hidden=!results.length;$('benefits-search').innerHTML=results.length?'<span class="field-label">솔리오·회원 혜택에서 찾은 것</span>'+results.map(item=>'<button type="button" data-solio-find="'+item.id+'"><strong>'+escape(item.title)+'</strong><small>'+escape(item.where)+' · 열기</small></button>').join(''):'';}
function openSolioFind(id){const item=SOLIO_SEARCH.find(entry=>entry.id===id);if(item)showView(item.route.view,{...item.route});}
// 회원 혜택(오른쪽 프로필 → 회원 혜택 · 설정 「회원 혜택」 줄): 플레저 하나. 소개의 「홈에 고정」(= 즐겨찾기)은 이 계정에 플레저 권한이 있을 때만 — 권한 · 여는 길은 그대로다.
function renderBenefits(){
  $('benefits-grid').innerHTML=MEMBER_BENEFITS.map(item=>'<li><button class="shelf-item benefit-card benefit-'+item.id+'" data-benefit="'+item.id+'" aria-label="'+escape(item.name)+' 소개 보기"><span class="stage"><img src="'+asset+item.asset+'" alt="'+escape(item.alt)+'" decoding="async"></span><span class="shelf-label"><span class="name">'+escape(item.name)+'</span><span class="desc">'+escape(item.description)+'</span><span class="meta"><span class="dot" data-tone="'+(item.status==='integrated'?'ok':'preview')+'" aria-hidden="true"></span>'+escape(benefitState(item))+' · '+escape(item.kicker)+'</span><span class="go">소개 보기 '+icon('arrow-right')+'</span></span></button></li>').join('');
  const item=memberBenefit(selectedBenefit);$('benefits-overview').hidden=!!item;$('benefit-detail').hidden=!item;
  if(!item){$('benefit-detail').innerHTML='';return;}
  const canPreview=canPreviewBenefit(item.id),launchBusy=busy.has(item.id);
  const canOpenPublic=allowed(item.id)&&typeof bridge?.openPublicApp==='function'&&Array.isArray(environment?.publicAppsAvailable)&&environment.publicAppsAvailable.includes(item.id);
  const publicAction=!item.publicUrl?'':bridge?'<button class="primary" data-benefit-public="'+item.id+'" '+(launchBusy||!canOpenPublic?'disabled':'')+'>'+(launchBusy?'여는 중…':'웹에서 열기')+' '+icon('arrow-up-right')+'</button>':'<a class="primary" href="'+escape(item.publicUrl)+'" target="_blank" rel="noopener noreferrer">웹에서 열기 '+icon('arrow-up-right')+'</a>';
  // 혜택 소개: 위치 줄 → 7:5(왼쪽 회색 무대 위 물건, 오른쪽 이름 · 한 줄 · 단추 · 상태) → 할 수 있는 것 1px 줄 목록.
  const pinned=effectivePrefs().favorites.includes(item.id),pin=item.id!=='care'||!bridge?'':allowed(item.id)?'<div class="benefit-pin"><button class="ghost-button" type="button" data-benefit-pin="'+item.id+'" aria-pressed="'+pinned+'" data-focus-key="benefit-pin-'+item.id+'">'+icon('star')+(pinned?'홈에 고정됨':'홈에 고정')+'</button><p>고정하면 내 홈 선반에 나와요. 라이브러리의 즐겨찾기와 같아요.</p></div>':auth.signedIn&&library.status==='ready'?'<p class="benefit-pin-note">이 계정에서는 PC 앱에서 플레저를 열 수 없어요. 웹 synk.im/care에서는 로그인 없이 써요.</p>':'';
  const others=MEMBER_BENEFITS.filter(other=>other.id!==item.id);
  // 혜택 소개: 위치 줄 → 7:5(왼쪽 회색 무대 위 물건, 오른쪽 이름 · 한 줄 · 단추 · 상태 · 홈에 고정) → 할 수 있는 것 1px 줄 목록.
  preserveFocus(()=>{$('benefit-detail').innerHTML='<nav class="crumb" aria-label="위치"><button class="benefit-back" data-view="benefits">회원 혜택</button><span aria-hidden="true">/</span><strong aria-current="page">'+escape(item.name)+'</strong></nav><div class="benefit-detail benefit-'+item.id+'"><figure class="app-stage"><div class="stage"><img src="'+asset+item.asset+'" alt="'+escape(item.alt)+'" decoding="async"></div></figure><div class="app-text"><p class="aud">회원 혜택 · '+escape(item.kicker)+'</p><h1 id="benefit-title" tabindex="-1">'+escape(item.name)+'</h1><p class="sum">'+escape(item.headline)+'</p><div class="acts">'+publicAction+(canPreview?'<button class="'+(publicAction?'ghost-button':'primary')+'" data-benefit-preview="'+item.id+'" '+(launchBusy?'disabled':'')+'>'+(launchBusy?'여는 중…':escape(item.name)+' PC 앱에서 열기')+'</button>':'')+'</div><p class="readouts"><span class="dot" aria-hidden="true"></span>'+escape(benefitState(item))+'</p>'+pin+'<div class="benefit-availability"><p>'+escape(item.availability)+'</p></div><section class="benefit-story" aria-labelledby="benefit-story-title"><h2 id="benefit-story-title">'+(item.status==='preview'?'할 수 있는 것':'준비 중인 것')+'</h2><p class="product-summary">'+escape(item.description)+'</p><ol class="benefit-steps">'+item.steps.map((step,index)=>'<li><span class="benefit-step-number">'+(index+1)+'</span><div><h3>'+escape(step.title)+'</h3><p>'+escape(step.body)+'</p></div></li>').join('')+'</ol></section>'+(others.length?'<div class="benefit-next"><span class="eyebrow">다른 회원 혜택</span>'+others.map(other=>'<button class="text-link" data-benefit="'+other.id+'">'+escape(other.name)+' '+icon('arrow-right')+'</button>').join('')+'</div>':'')+'</div></div>';});
}
function syncBenefitPin(id=selectedBenefit){if(view!=='benefits'||!id||selectedBenefit!==id||!allowed(id))return;const detail=$('benefit-detail'),pinned=effectivePrefs().favorites.includes(id);if(typeof detail.querySelector!=='function'){renderBenefits();return;}const pin=detail.querySelector('[data-benefit-pin="'+id+'"]');if(pin){pin.setAttribute('aria-pressed',String(pinned));pin.innerHTML=icon('star')+(pinned?'홈에 고정됨':'홈에 고정');}}
// 옛 혜택 단추 · 경로(내 성향 · 구독 계정판)는 새 자리로, 플레저는 회원 혜택 소개로.
function openBenefit(id){if(Object.hasOwn(SOLIO_LEGACY_BENEFITS,id||'')){const moved=SOLIO_LEGACY_BENEFITS[id];showView(moved.view,moved.section?{section:moved.section}:{});return;}if(!memberBenefit(id))return;showView('benefits',{benefitId:id});}
// 솔리오(위 메뉴): 탭(홈 · 백업·복구 · AI 구독 관리)과 두 그릇. 홈에는 쓸 수 있는 기능과 사실인 상태만, 백업·복구는 「준비 중」 안내만(단추 없음).
function solioHomeHtml(){
  const state=!bridge?'PC 앱에서 써요':auth.signedIn?'이 PC에서 바로 써요':'로그인하면 써요';
  return '<div class="detail-grid solio-home"><figure class="app-stage"><div class="stage"><img src="'+asset+SOLIO.asset+'" alt="'+escape(SOLIO.alt)+'" decoding="async"></div></figure><div class="app-text"><p class="aud">'+escape(SOLIO.tagline)+'</p><h1 id="solio-title" tabindex="-1">'+escape(SOLIO.menu)+'</h1><p class="sum">'+escape(SOLIO.summary)+'</p><div class="acts"><button class="primary" type="button" data-solio-section="subscriptions">AI 구독 관리 열기 '+icon('arrow-right')+'</button></div><p class="readouts"><span class="dot" data-tone="ok" aria-hidden="true"></span>AI 구독 관리 · '+escape(state)+' · 회원 무료</p>'
    +'<section class="solio-contents" aria-labelledby="solio-contents-title"><h2 id="solio-contents-title">들어 있는 것</h2><ul class="solio-rows">'
    +'<li><div><p class="solio-row-name"><strong>'+escape(SOLIO_SUBSCRIPTIONS.name)+'</strong><span class="solio-state" data-tone="ok">지금 써요</span></p><p>'+escape(SOLIO_SUBSCRIPTIONS.headline)+'</p></div><button class="text-link" type="button" data-solio-section="subscriptions">열기 '+icon('arrow-right')+'</button></li>'
    +'<li><div><p class="solio-row-name"><strong>'+escape(SOLIO_BACKUP.name)+'</strong><span class="solio-state" data-tone="planned">'+escape(SOLIO_BACKUP.statusLabel)+'</span></p><p>'+escape(SOLIO_BACKUP.headline)+'</p></div><button class="text-link" type="button" data-solio-section="backup">자세히 '+icon('arrow-right')+'</button></li>'
    +'</ul></section></div></div>';
}
function solioBackupHtml(){return '<section class="solio-backup" aria-labelledby="solio-title"><div class="section-title"><div><h1 id="solio-title" tabindex="-1">'+escape(SOLIO_BACKUP.name)+'</h1><p><span class="solio-state" data-tone="planned">'+escape(SOLIO_BACKUP.statusLabel)+'</span> '+escape(SOLIO_BACKUP.headline)+'</p></div></div><div class="settings-group">'+SOLIO_BACKUP.rows.map(([title,body])=>'<div class="setting-row"><div><h2>'+escape(title)+'</h2><p>'+escape(body)+'</p></div></div>').join('')+'</div></section>';}
function renderSolio(){
  if(view!=='solio'){subscriptionsBoard.setVisible(false);return;}
  $('solio-tabs').innerHTML='<p class="solio-kicker">'+escape(SOLIO.name)+'</p><div class="filters solio-tab-row">'+SOLIO_SECTIONS.map(([id,label])=>'<button type="button" data-solio-section="'+id+'"'+(solioTab===id?' aria-current="page"':'')+'>'+escape(label)+'</button>').join('')+'</div>';
  const subs=solioTab==='subscriptions';$('solio-panel').hidden=subs;$('solio-subscriptions').hidden=!subs;
  if(subs){$('solio-panel').innerHTML='';subscriptionsBoard.render($('solio-subscriptions'),{signedIn:!!auth.signedIn,native:!!bridge});return;}
  subscriptionsBoard.setVisible(false);$('solio-subscriptions').innerHTML='';$('solio-panel').innerHTML=solioTab==='backup'?solioBackupHtml():solioHomeHtml();
}
// 맞춤 정보(내 계정 → 맞춤 정보): 보일 때만 내 성향을 불러오고, 떠나거나 창이 뒤로 가면 끈다.
function renderInsightView(){if(view!=='insight'){memberInsight.setVisible(false);return;}memberInsight.setVisible(!document.hidden);renderInsight();}
// 오른쪽 프로필 메뉴: 로그인한 회원만. 펼침 단추(aria-expanded) — Esc · 초점 이탈 · 바깥 누름 · 항목 누름 · 화면 이동 · 로그아웃에 닫힌다.
function inProfileControl(node){return !!node&&(node===$('profile-menu')||node===$('account-button')||Boolean(node.closest?.('#profile-menu,#account-button'))||Boolean($('profile-menu').contains?.(node))||Boolean($('account-button').contains?.(node)));}
function syncProfileMenu(){const signedIn=!!bridge&&!!auth.signedIn;if(!signedIn)profileOpen=false;$('profile-menu').hidden=!profileOpen;if(signedIn){$('account-button').setAttribute('aria-expanded',String(profileOpen));$('account-button').setAttribute('aria-controls','profile-menu');}else{$('account-button').removeAttribute('aria-expanded');$('account-button').removeAttribute('aria-controls');}}
function closeProfileMenu({focus=false}={}){if(!profileOpen)return;profileOpen=false;syncProfileMenu();if(focus)$('account-button').focus?.();}
function onAccountButton(){if(!bridge||!auth.signedIn){openAccount();return;}profileOpen=!profileOpen;syncProfileMenu();if(profileOpen)$('profile-menu').querySelector?.('button')?.focus?.();}

// 사이드바와 실행 단추는 PULSE 전용 창을 열고, 홈의 「소개 보기」·「앱 소개」만 안내 쪽을 연다(2026-11-04).
// WORLD는 앱 소개 대신 내 홈의 휴대폰 칸으로 간다(2026-11-11) — 메모의 「앱 정보」 · 내 성향의 WORLD 단추 · 옛 경로가 모두 여기로 모인다.
function showWorldPhone(){showView('home');const focus=()=>{const title=document.getElementById('world-phone-title');if(!title)return;title.closest?.('.world-phone')?.scrollIntoView?.({block:'center',behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});title.focus?.({preventScroll:true});};if(typeof globalThis.requestAnimationFrame==='function')globalThis.requestAnimationFrame(focus);else setTimeout(focus,0);}
function selectApp(id,{legacy=false,intro=false}={}){if(id==='world')return showWorldPhone();if(!allowed(id))return;if(id==='pulse'&&!legacy&&!intro)return command('pulse-app',id);pulseLegacyView=id==='pulse'&&legacy;libraryOrigin=view==='home'?'home':'library';showView('library',{appId:displayLibraryAppId(id,library),detail:'overview'});savePrefs();}
function setClients(snapshot){if(!Array.isArray(snapshot))return;const previous=clients;clients=clientRows(snapshot,{native:!!bridge});convenience?.clientsChanged(previous,clients);renderLibrary();renderActions();renderDownloads();if(detail==='info')renderDetails();convenience?.refresh();}
async function loadEnvironment(){
  const revision=++environmentRevision,snapshot=await bridge.getEnvironment();
  if(revision===environmentRevision){environment=snapshot;setAuth(auth,{environmentOnly:true});platformUpdates?.refresh();$('runtime-label').textContent=`${systemName()} · ${environment?.mode==='release'?'SYNK Platform':'시험판'}`;$('home-foot-text').textContent=homeFoot();}
  return snapshot;
}
async function refresh(){
  if(!bridge)return;
  const results=await Promise.allSettled([loadEnvironment(),bridge.getClients()]);
  if(results[1].status==='fulfilled')setClients(results[1].value);
  if(results.some(result=>result.status==='rejected'))toast('설치 상태를 불러오지 못했어요. 잠시 뒤 「다시 확인」을 눌러 주세요.');
}
async function command(action,id=prefs.selected){
  if(action==='pulse-app'){
    if(id!=='pulse'||!allowed(id)||busy.has(id))return;
    if(!bridge){globalThis.location.assign('https://workspace.synk.im/pulse-app/');return;}
    const epoch=ownerEpoch,active=()=>epoch===ownerEpoch&&allowed(id),commandBusy=busy;commandBusy.add(id);memberHome.render();renderActions();
    try{const result=typeof bridge.openPulseApp==='function'?await bridge.openPulseApp():{ok:false,code:'PULSE_APP_UNAVAILABLE'};if(!active())return;if(result?.ok){recordLaunch(id);toast('PULSE 창을 열었어요.');}else toast(({PULSE_APP_ACCOUNT_PENDING:'로그인을 확인하는 중이에요. 잠시 뒤 PULSE를 다시 열어 주세요.',PULSE_APP_ACCOUNT_CHANGED:'계정이 바뀌었어요. PULSE를 다시 열어 주세요.',PULSE_APP_STORAGE_UNAVAILABLE:'전에 로그인한 계정의 PULSE 기록을 정리하지 못했어요. 플랫폼을 다시 시작한 뒤 열어 주세요.',PULSE_APP_UNAVAILABLE:'이 플랫폼 버전에서는 PULSE를 열 수 없어요. 업데이트한 뒤 다시 열어 주세요.'})[result?.code]||'PULSE를 열지 못했어요. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.');}
    catch{if(active())toast('PULSE를 열지 못했어요. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.');}
    finally{commandBusy.delete(id);if(active()){memberHome.render();renderActions();}}return;
  }
  if(!bridge||!allowed(id)||busy.has(id)||action==='none')return;
  const epoch=ownerEpoch,active=()=>epoch===ownerEpoch&&allowed(id),commandBusy=busy;
  commandBusy.add(id);memberHome.render();renderActions();renderDownloads();renderBenefits();
  try{
    let result;
    if(action==='teacher-preview'){if(id!=='teacher'||typeof bridge.openTeacherPreview!=='function'||environment?.teacherPreviewAvailable!==true)return;result=await bridge.openTeacherPreview();if(active()&&result?.ok){recordLaunch(id);toast('워크스페이스에서 내 수업을 열었어요.');}}
    else if(action==='product-preview'){if(!['path','care','fortune'].includes(id)||typeof bridge.openProductPreview!=='function'||!Array.isArray(environment?.productPreviewsAvailable)||!environment.productPreviewsAvailable.includes(id))return;result=await bridge.openProductPreview(id);if(active()&&result?.ok){recordLaunch(id);toast(`${apps[id].name} 창을 열었어요.`);}}
    else if(action==='public-web'){if(!['care','fortune','path'].includes(id)||typeof bridge.openPublicApp!=='function'||!Array.isArray(environment?.publicAppsAvailable)||!environment.publicAppsAvailable.includes(id))return;result=await bridge.openPublicApp(id);if(active()&&result?.ok){recordLaunch(id,'web');toast(`브라우저에서 ${apps[id].name} 화면을 열었어요.`);}}
    else if(!INSTALLABLE_IDS.includes(id))return;
    else if(action==='launch'){result=await bridge.launch(id);if(active()&&result.ok){recordLaunch(id);toast(`${apps[id].name} 앱을 열었어요.`);}}
    else if(action==='prepare'){showView('downloads');result=await bridge.prepareClient(id);}
    else if(action==='open'){result=await bridge.openInstaller(id);if(active()&&result.ok)toast(environment?.platform==='darwin'?'앱을 Applications 폴더로 옮긴 뒤 '+(view==='downloads'?'「다시 확인」':'「설치 상태 확인」')+'을 눌러 주세요.':'설치 창에서 설치를 마친 뒤 '+(view==='downloads'?'「다시 확인」':'「설치 상태 확인」')+'을 눌러 주세요.');}
    else if(action==='cancel'){result=await bridge.cancelPreparation(id);}
    else if(action==='refresh'){await refresh();return;}
    if(active()&&result?.ok===false)toast(errorText(result));
  }catch{if(active())toast('요청을 완료하지 못했어요. 다시 시도해 주세요.');}
  finally{commandBusy.delete(id);if(active()){await refresh();memberHome.render();renderActions();renderDownloads();renderBenefits();}}
}
document.addEventListener('click',event=>{if(profileOpen&&!event.target.closest('#profile-menu,#account-button'))closeProfileMenu();const button=event.target.closest('button');if(!button)return;if(button.dataset&&'worldPhone' in button.dataset){showWorldPhone();return;}if(button.dataset.profile){const action=button.dataset.profile;closeProfileMenu();if(action==='account')openAccount();else if(action==='benefits')showView('benefits');else if(action==='sign-out')void signOut();return;}if(button.dataset.solioSection){showView('solio',{section:button.dataset.solioSection});return;}if(button.dataset.solioFind){openSolioFind(button.dataset.solioFind);return;}if(button.dataset.benefitPin){void toggleFavorite(button.dataset.benefitPin);return;}if(['enable-activity','disable-activity'].includes(button.dataset.insightAction)){void memberActivity.setConsent(button.dataset.insightAction==='enable-activity');return;}if(button.dataset.insightAction==='activity'){const id=button.dataset.insightTarget;if(id==='world'){showWorldPhone();return;}if(['messenger','path','pulse'].includes(id)){if(allowed(id))void launchFromHome(id);else toast('아직 설치하지 않았거나 이 계정에서 쓸 수 없는 앱이에요. 「설치·업데이트」에서 설치 상태를 봐 주세요.');}return;}if(button.dataset.insightAction==='refresh'){void refreshAuth({reload:true}).then(()=>memberInsight.refresh());return;}else if(button.dataset.insightAction==='account'){openAccount();return;}else if(button.dataset.themeChoice)setTheme(button.dataset.themeChoice);else if(button.dataset.benefit)openBenefit(button.dataset.benefit);else if(button.dataset.benefitPublic)return command('public-web',button.dataset.benefitPublic);else if(button.dataset.benefitPreview){if(canPreviewBenefit(button.dataset.benefitPreview))return command('product-preview',button.dataset.benefitPreview);}else if(button.dataset.pulseLegacy)selectApp('pulse',{legacy:true});else if(button.dataset.app)selectApp(button.dataset.app);else if(button.dataset.personalApp)selectApp(button.dataset.personalApp);else if(button.dataset.view)showView(button.dataset.view);else if(button.dataset.filter){filter=button.dataset.filter;renderLibrary();}else if(button.dataset.detail||button.dataset.showDetail){showView('library',{appId:prefs.selected,detail:button.dataset.detail||button.dataset.showDetail});}else if(button.dataset.command)command(button.dataset.command,button.dataset.client);else if(button.dataset.window)void windowAction(button.dataset.window);else if(button.dataset.game){if(!allowed('world')||prefs.selected!=='world')return;const game=games[button.dataset.game];if(!game)return;$('content-image').src=asset+game.image;$('content-image').alt=game.name+' 게임 화면';$('content-title').textContent=game.name;$('content-description').textContent=game.description;$('content-dialog').showModal();}});
$('brand-home').addEventListener('click',()=>showView('home'));
// 본문을 내리면 위 막대 아래에 1px 선이 생긴다.
$('main').addEventListener('scroll',()=>{$('titlebar')?.classList.toggle('scrolled',$('main').scrollTop>4);},{passive:true});
$('leave-dialog').addEventListener('close',async()=>{const done=leaveDecision;leaveDecision=null;if(!done)return;const discard=$('leave-dialog').returnValue==='discard';if(discard){const clearing=await accountLifecycle.discardDrafts();if(clearing.some(result=>result.status==='rejected'||result.value===false)){toast('임시 저장한 메모를 지우지 못했어요. 설정에서 「쓰던 메모 되살리기」를 꺼 주세요.');done(false);return;}}else{if($('account-dialog').open)$('account-dialog').close();if(pulseClient.hasUnsavedChanges()){selectApp('pulse',{legacy:true});pulseClient.openBrief();}else showView('home');if(continuity?.hasUnsavedDraft())continuity.focusDraft();else memberHome.focusDraft();}done(discard);});
$('leave-dialog').addEventListener('cancel',()=>{$('leave-dialog').returnValue='keep';});
window.addEventListener('beforeunload',event=>{if(pendingLibraryActions||hasUnsavedDrafts()){event.preventDefault();event.returnValue='';if(pendingLibraryActions)toast('즐겨찾기와 실행 기록을 저장하는 중이에요. 끝난 뒤 다시 해 주세요.');}});
$('search').addEventListener('input',event=>{search=event.target.value.trim().toLowerCase();renderLibrary();});
$('primary-action').addEventListener('click',()=>command($('primary-action').dataset.action));
$('refresh').addEventListener('click',refresh);$('refresh-downloads').addEventListener('click',refresh);
function toggleFavorite(id){if(!allowed(id))return;return enqueueLibraryAction(id,async()=>{if(continuity?.connected()){await continuity.dispatch({type:'favorite',id});syncBenefitPin(id);}else{prefs.favorites=effectivePrefs().favorites.includes(id)?prefs.favorites.filter(entry=>displayLibraryAppId(entry,library)!==id):[...prefs.favorites,id];savePrefs();renderLibrary();renderActions();syncBenefitPin(id);void memberActivity.syncFavorites();}});}
function moveFavorite(id,direction){if(!allowed(id)||![-1,1].includes(direction))return;return enqueueLibraryAction(id,async()=>{if(continuity?.connected())return continuity.dispatch({type:'move-favorite',id,direction});const next=moveLibraryFavorite(effectivePrefs().favorites,visibleLibraryAppIds(library),id,direction);if(!next)return;prefs.favorites=next;savePrefs();renderLibrary();renderActions();toast('즐겨찾기 순서를 바꿨어요.');});}
// The favorite button and PULSE's own favorite control share this action.
function toggleSelectedFavorite(){return toggleFavorite(prefs.selected);}
$('favorite').addEventListener('click',toggleSelectedFavorite);
$('download-shortcut').addEventListener('click',()=>showView('downloads'));$('footer-settings').addEventListener('click',()=>showView('settings'));
$('account-button').addEventListener('click',onAccountButton);for(const id of ['settings-login','library-account'])$(id).addEventListener('click',openAccount);
// 프로필 메뉴는 Esc로 닫고 계정 단추로 초점을 돌려주며, Tab/Shift+Tab으로 초점이 메뉴·계정 단추 밖으로 나가면 초점을 되돌리지 않고 닫는다(문서 keydown은 명령 메뉴가 쓴다).
for(const id of ['profile-menu','account-button']){
  $(id).addEventListener('keydown',event=>{if(event.key==='Escape'&&profileOpen){event.preventDefault?.();closeProfileMenu({focus:true});}});
  $(id).addEventListener('focusout',event=>{const next=event.relatedTarget;if(profileOpen&&next&&!inProfileControl(next))closeProfileMenu();});
}
document.addEventListener('focusin',event=>{if(profileOpen&&!inProfileControl(event.target))closeProfileMenu();});
async function openSignUp(){
  if(typeof bridge?.authSignUp!=='function'||auth.signedIn||['restoring','signing-in','signing-out'].includes(auth.status)||signUpPending||accountRetryPending)return;
  if(!$('account-dialog').open)$('account-dialog').showModal();
  signUpPending=true;renderAuth();const revision=authRevision;
  // A modal dialog covers the toast (top layer), so a failure closes it first.
  const failed=()=>{if($('account-dialog').open)$('account-dialog').close();toast('회원가입 페이지를 열지 못했어요. 잠시 뒤 다시 눌러 주세요.');};
  try{const result=await bridge.authSignUp();if(revision!==authRevision)return;if(result?.ok===true)signUpOpened=true;else failed();}
  catch{if(revision===authRevision)failed();}
  finally{signUpPending=false;renderAuth();}
}
for(const id of ['signup-button','sign-up'])$(id).addEventListener('click',openSignUp);
$('density').addEventListener('change',event=>{prefs.density=event.target.value;savePrefs();renderSettings();});
$('reset-preferences').addEventListener('click',()=>{prefs=parsePreferences(null);reconcileSelection();filter='all';search='';$('search').value='';savePrefs();renderLibrary();renderSelected();renderSettings();toast('보기 설정을 처음 상태로 되돌렸어요.');});
$('content-go-world').addEventListener('click',()=>{if(!allowed('world'))return;$('content-dialog').close();selectApp('world');$('primary-action').focus();});
$('sign-in').addEventListener('click',()=>startSignIn());
// The answer is a toast, which the modal dialog would cover: the dialog closes first (the next step is in the browser either way).
$('forgot-password').addEventListener('click',async()=>{const say=text=>{if($('account-dialog').open)$('account-dialog').close();toast(text);};try{const result=await bridge?.authRecover?.();if(result?.ok===true)say('기본 브라우저에서 SYNK ID 「비밀번호를 다시 정해요」를 열었어요. 가입한 이메일로 새 비밀번호를 정하는 메일을 받아 주세요.');else say('브라우저를 열지 못했어요. synk.im/id에서 「비밀번호를 잊었어요」를 눌러 주세요.');}catch{say('브라우저를 열지 못했어요. synk.im/id에서 「비밀번호를 잊었어요」를 눌러 주세요.');}});
async function startSignIn(){
  if(!bridge||!auth.configured||auth.signedIn||['restoring','signing-in','signing-out'].includes(auth.status)||accountRetryPending||signUpPending)return;
  landing={route:readRoute(),guest:false};setAuth({...auth,status:'signing-in',signedIn:false,account:null,library:{status:'unavailable',appIds:[]}});const revision=authRevision;
  try{
    const result=await bridge.authSignIn();if(revision!==authRevision)return;await refreshAuth();
    if(result?.ok===false&&!auth.signedIn){if(!landing?.guest)landing=null;toast(errorText(result));}
  }
  catch{if(revision===authRevision){if(!landing?.guest)landing=null;setAuth({status:'error',configured:true,signedIn:false,error:{message:'로그인 창을 열지 못했어요. 다시 눌러 주세요.'}});}}
}
// The sign-out button and 「내 계정」's sign-out share this action. While a logout is pending the button is
// disabled, and signOutPending keeps the account page from starting a second one in that window.
async function signOut(){
  if(signOutPending||!bridge||!auth.signedIn)return;const leaveEpoch=ownerEpoch;
  if(!await confirmDraftExit('저장하지 않은 내용은 로그아웃하면 사라져요. 돌아가서 저장하거나, 저장 없이 로그아웃할 수 있어요.')||leaveEpoch!==ownerEpoch||!auth.signedIn)return;
  signOutPending=true;$('sign-out').disabled=true;
  const signedOutGeneration=Number.isSafeInteger(auth.sessionGeneration)?auth.sessionGeneration+1:null;
  landing={route:{view:'home'},guest:true};setAuth({status:'signing-out',configured:auth.configured,signedIn:false});const revision=authRevision;
  const sameLogout=()=>revision===authRevision||signedOutGeneration!==null&&auth.sessionGeneration===signedOutGeneration&&auth.status==='signed-out'&&!auth.signedIn;
  try{
    const result=await bridge.authSignOut();if(!sameLogout())return;
    const refreshedRevision=await refreshAuth();
    if((authRevision!==refreshedRevision&&!sameLogout())||auth.status==='signing-in')return;
    if(!auth.signedIn){
      const notice=result?.ok===false?'로그아웃하지 못했어요. 잠시 뒤 다시 눌러 주세요.':(result?.serverSessionRevoked===false||result?.serverRevoked===false?'이 PC에서는 로그아웃했어요. 서버 쪽 로그인은 인터넷이 연결된 뒤 다시 로그인했다 로그아웃하면 정리돼요.':'로그아웃했어요.')+' 브라우저의 SYNK ID 로그인은 그대로라, 다른 계정으로 바꾸려면 브라우저에서도 로그아웃해 주세요.';
      const cleanupNotice=result?.draftRecoveryCleanup?.ok===false?' 이 PC에 임시 저장한 메모를 지우지 못했어요. 같은 SYNK ID로 다시 로그인해 설정에서 「쓰던 메모 되살리기」를 꺼 주세요.':'';
      if($('account-dialog').open)$('account-dialog').close();
      toast(notice+cleanupNotice);
    }
  }catch{if(sameLogout())setAuth({status:'error',configured:auth.configured,signedIn:false,error:{message:'로그아웃됐는지 확인하지 못했어요. 창을 닫았다 다시 열어 주세요.'}});}
  finally{signOutPending=false;$('sign-out').disabled=false;}
}
$('sign-out').addEventListener('click',signOut);
$('account-retry').addEventListener('click',async()=>{
  if(accountRetryPending||!bridge||typeof bridge.accountRequest!=='function'||!auth.configured||auth.signedIn||auth.status!=='error'||auth.error?.retryable!==true)return;
  accountRetryPending=true;renderAuth();
  let refreshedRevision;
  try{refreshedRevision=await refreshAuth({reload:true});}
  finally{accountRetryPending=false;renderAuth();if(refreshedRevision===authRevision&&auth.status==='error'&&auth.error?.code==='SUITE_UNAVAILABLE')$('account-state').textContent+='\n다시 로그인하라는 안내가 보이면 「새로 로그인」을 눌러 주세요. PC 저장 공간이 부족하면 공간을 비운 뒤 「저장된 로그인 다시 확인」을 눌러 주세요.';}
});
$('cancel-sign-in').addEventListener('click',async()=>{const revision=authRevision;try{await bridge.authCancelSignIn();if(revision===authRevision)await refreshAuth();}catch{if(revision===authRevision)toast('로그인을 취소하지 못했어요. 창을 닫았다 다시 열어 주세요.');}});
$('library-retry').addEventListener('click',()=>refreshAuth({reload:true}));
window.addEventListener('focus',()=>{refresh();refreshAuth({reload:true});});
function renderPersonalization(){
  const state=personalState;
  $('personal-heading').textContent=state.active?'내가 고른 순서':'앱 순서 정하기';
  // 고른 일에 맞는 앱이 목록에 없으면(matched false — 「한국어 공부」의 WORLD는 휴대폰) 「먼저 볼 앱」으로 엉뚱한 앱을 세우지 않는다(2026-11-11).
  const unmatched=state.active&&state.matched===false,studyOnPhone=unmatched&&state.context==='student'&&['ready','guest'].includes(library.status);
  $('personal-summary').textContent=state.error||(unmatched?(studyOnPhone?'한국어 공부 앱 WORLD는 휴대폰에서 열어요. 앱 순서는 그대로예요.':'고른 일에 맞는 앱이 이 계정 목록에 없어요. 앱 순서는 그대로예요.'):state.active?'고른 일에 맞춰 앱 순서와 보기를 바꿨어요.':'하려는 일을 고르면 그 일에 맞는 앱이 먼저 나와요.');
  $('personal-open').textContent=state.active?'바꾸기':'고르기';
  $('personal-settings-summary').textContent=state.sessionOnly?CONTEXTS[state.context].label+' · 이 창에서만':state.active?CONTEXTS[state.context].label+' · 이 PC에 저장됨':'아직 고르지 않음';
  $('personal-settings-open').textContent=state.active?'바꾸기':'고르기';$('personal-settings-open').disabled=!library.owner;$('personal-open').disabled=!library.owner;
  $('recommendation').hidden=!studyOnPhone&&(!state.active||unmatched||!allowed(state.selected));$('recommendation').innerHTML='';
  if(studyOnPhone){$('recommendation').innerHTML='<span class="atlas-dot" aria-hidden="true"></span><div><span class="eyebrow">한국어 공부</span><strong>SYNK WORLD는 휴대폰에서</strong><p>'+escape(STUDY_ON_PHONE)+'</p></div><button class="ghost-button" type="button" data-world-phone>내 홈의 QR 보기 '+icon('arrow-right')+'</button>';}
  else if(state.active&&!unmatched&&allowed(state.selected)){const app=apps[state.selected];$('recommendation').innerHTML='<span class="atlas-dot" aria-hidden="true"></span><div><span class="eyebrow">먼저 볼 앱</span><strong>'+escape(app.name)+'</strong><p>'+escape(state.reason)+'</p><p class="recommendation-extra">고른 일에 맞춘 순서일 뿐, 실력이나 권한과는 상관없어요.</p><span class="recommendation-stage">'+escape(statusLabel(client(state.selected)))+'</span></div><button class="ghost-button" data-personal-app="'+state.selected+'">'+(app.stage==='planned'?'준비 중인 것 보기':'앱 보기')+' '+icon('arrow-right')+'</button>';}
}
function applyPersonalization(){const saved=personal.current({appIds:displayLibraryAppIds(library)});personalState=sessionPurpose&&library.owner===sessionPurposeOwner?previewPurpose(saved,sessionPurpose,displayLibraryAppIds(library)):saved;document.documentElement.dataset.textSize=personalState.presentation.textSize;document.documentElement.dataset.explanation=personalState.presentation.explanation;document.documentElement.dataset.motion=personalState.presentation.motion;renderPersonalization();}
function openPersonalization(){if(!library.owner)return;const state=personalState;const values=state.values||{};$('personal-context').value=state.context||'everyday';$('personal-goal').value=values.goal||'explore';$('personal-text').value=values.textSize||'standard';$('personal-explanation').value=values.explanation||'standard';$('personal-motion').value=values.motion||'full';$('personal-consent').checked=state.active&&!state.sessionOnly;$('personal-message').textContent=state.error||'';$('personal-dialog').showModal();}
for(const id of ['personal-open','personal-settings-open'])$(id).addEventListener('click',openPersonalization);
$('personal-context').addEventListener('change',()=>{$('personal-goal').value=CONTEXTS[$('personal-context').value]?.goal||'explore';});
$('personal-form').addEventListener('submit',event=>{event.preventDefault();if(!library.owner)return;try{personal.save({context:$('personal-context').value,goal:$('personal-goal').value,textSize:$('personal-text').value,explanation:$('personal-explanation').value,motion:$('personal-motion').value,consent:$('personal-consent').checked===true});sessionPurpose=null;applyPersonalization();renderLibrary();$('personal-dialog').close();toast('앱 순서와 보기 설정을 저장했어요.');}catch(error){$('personal-message').textContent=error.message;}});
$('personal-skip').addEventListener('click',()=>{$('personal-dialog').close();});
$('personal-clear').addEventListener('click',()=>{if(!library.owner)return;try{personal.clear();sessionPurpose=null;applyPersonalization();renderLibrary();$('personal-dialog').close();toast('저장한 설정을 지웠어요. 기본 순서로 돌아왔어요.');}catch(error){$('personal-message').textContent=error.message;}});
function windowState(state){$('maximize').setAttribute('aria-label',state?.maximized?'창 크기 복원':'최대화');$('maximize').dataset.maximized=String(!!state?.maximized);}
// A sign-in comes back to the screen it started from and a sign-out opens the guest home, not each account's last place.
// Each landing waits for its own side: the main process reports a plain signed-out (its discard) before 'signing-in', and
// that guest step must not use up the sign-in's landing. A sign-in that ends without an account drops it (see setAuth).
convenience=mountConvenience({takeLanding:owner=>{if(!landing||(owner==='anonymous-local')!==landing.guest)return null;const {route}=landing;landing=null;return route;},bridge,storage:localStore,apps,getSnapshot:()=>({owner:library.owner,appIds:visibleLibraryAppIds(library),prefs:effectivePrefs(),environment,auth,clients}),readRoute,applyRoute:route=>showView(route.view,{...route,restore:true}),launchApp:launchFromHome,onToast:toast,onFavorite:toggleFavorite,onMoveFavorite:moveFavorite,onLibrarySearch:()=>{showView('library');openLibrarySearch();},getNotes:query=>[...(memberHome.searchRecords?.(query)||[]).map(row=>({...row,source:'device'})),...(continuity?.searchNotes?.(query)||[]).map(row=>({...row,source:'account'}))],openNote:note=>note.source==='account'?continuity?.openNote?.(note.id):memberHome.focusRecord?.(note.id),onDesktopPreferences:snapshot=>{if(environment)environment.closeToTray=snapshot.preferences?.closeToTray===true&&snapshot.capabilities?.tray===true;}});
platformUpdates=mountPlatformUpdates({bridge,document,getEnvironment:()=>environment,confirmInstall:confirmUpdateInstall});
document.addEventListener('visibilitychange',()=>{if(document.hidden)accountLifecycle.flushDrafts();});
async function init(){
  // Home is the default view; the after-render hooks may then restore this owner's saved route.
  accountLifecycle.render();showView('home',{restore:true});accountLifecycle.afterRender();
  if(bridge){
    let clientEvents=0;const revision=authRevision;
    bridge.onAuthChanged?.(setAuth);
    const receiveClients=snapshot=>{clientEvents++;setClients(snapshot);};bridge.onClientsChanged?.(receiveClients);
    const results=await Promise.allSettled([loadEnvironment(),bridge.getClients(),bridge.authStatus()]);
    if(results[1].status==='fulfilled'&&clientEvents===0)setClients(results[1].value);
    if(results[2].status==='fulfilled'&&authRevision===revision)setAuth(results[2].value);
    else if(results[2].status==='rejected'&&authRevision===revision)setAuth({status:'error',signedIn:false});
    if(results.some(result=>result.status==='rejected'))toast('일부 정보를 불러오지 못했어요. 창을 닫았다 다시 열어 주세요.');
    $('window-actions').hidden=!bridge.windowAction;
    if(bridge.getWindowState)bridge.getWindowState().then(windowState).catch(()=>{});bridge.onWindowStateChanged?.(windowState);
  }
  $('edition').textContent=bridge?'':'화면 미리보기';$('runtime-label').textContent=bridge?`${systemName()} · ${environment?.mode==='release'?'SYNK Platform':'시험판'}`:'브라우저 미리보기';renderAuth();renderActions();renderBenefits();document.documentElement.dataset.ready='true';
}
init().catch(()=>{toast('플랫폼을 준비하지 못했어요. 앱을 다시 열어 주세요.');document.documentElement.dataset.ready='error';});

// Do not retain personal report text while the native window is in the background.
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){memberInsight.setVisible(false);if(view==='insight')renderInsight();}
 else if(view==='insight'){memberInsight.invalidate();void refreshAuth({reload:true}).then(()=>renderInsightView());}
});
window.addEventListener('pagehide',()=>{memberInsight.setVisible(false);if(view==='insight')renderInsight();});
