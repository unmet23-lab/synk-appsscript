import {APP_IDS,INSTALLABLE_IDS,APPS,clientRows,matchesLibrary,bytes,statusLabel,primaryAction,installerLabel,progressValue,parsePreferences} from './state.mjs';
import {createPlatformPersonalization,previewPurpose,CONTEXTS,PERSONAL_KEY,PLATFORM_SCOPE} from './personalization.mjs';
import {resolveLibrary,accountStorageKey,visibleSelection,libraryCopy,displayLibraryAppId,displayLibraryAppIds,projectLibraryPreferences} from './library.mjs';
import {MEMBER_BENEFITS,memberBenefit,benefitPreviewAvailable} from './benefits.mjs';
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
const $=id=>document.getElementById(id),bridge=globalThis.synkDesktop,asset='/assets/launcher/';
const apps=APPS;
const localStore={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)};
let auth={status:bridge?'restoring':'unconfigured',configured:false,signedIn:false},library=resolveLibrary(auth),authRevision=0,ownerEpoch=0;
let personal=createPersonal(),personalState=personal.current({appIds:displayLibraryAppIds(library)});
// WORLD 「놀이」의 게임 셋(브랜드 오프닝 글 표 game.*와 같은 이름). 그림은 지금 WORLD 게임 화면을 찍은 것이다.
const games={runner:{name:'바람길',image:'runner.jpg',tag:'들은 말대로 90초 동안 달려요',description:'짧은 한국어 지시를 듣고 그대로 움직이는 달리기 게임이에요. 하라는 말도, 하지 말라는 말도 끝까지 듣고 길을 바꾸거나 뛰어요.'},rhythm:{name:'말의 리듬',image:'rhythm.jpg',tag:'노래를 듣다가 O·X로 답해요',description:'노래를 들으며 두 단추로 박자를 맞추고, 들은 내용이 맞으면 O, 아니면 X를 골라요. 박자 점수와 듣기 답은 따로 기록해요.'},hangul:{name:'한글 만나기',image:'hangul.jpg',tag:'소리와 글자를 짝지어요',description:'한글을 처음 배우는 사람을 위한 게임이에요. 소리를 듣고 글자를 고르거나 글자를 보고 소리를 고르고, 손가락으로 글자를 따라 써요.'}};
const worldExtras=[['TOPIK 연습','짧은 진단으로 TOPIK I 내 위치를 보고, 듣기·읽기 연습과 TOPIK II 쓰기 연습을 해요.'],['첫 문장 놀이','짧은 문장 세 개를 읽고 상황에 어울리는 답을 골라요.'],['싱크타운','내가 고른 차림 그대로 광장을 걸어요.'],['옷장','세 친구에게 옷을 입혀 보고 사진으로 남겨요.'],['노래 듣기','한글 노래와 뮤직비디오를 들어요.']];
let prefs=parsePreferences(readPrefs()),clients=clientRows([],{native:!!bridge}),environment=null,view='home',detail='overview',filter='all',search='',busy=new Set(),toastTimer;
let selectedBenefit=null,environmentRevision=0,sessionPurpose=null,sessionPurposeOwner=null,leaveDecision=null;
let continuity=null,convenience=null,platformUpdates=null,libraryActionQueue=Promise.resolve(),pendingLibraryActions=0;
let accountRetryPending=false,signUpPending=false,signUpOpened=false,pulseLegacyView=false;
const memberActivity=createMemberActivity({getIdentity:()=>auth,request:(operation,params)=>bridge.accountRequest(operation,params),getFavorites:()=>effectivePrefs().favorites});
const memberUnderstanding=createMemberUnderstanding({getIdentity:()=>auth,request:(operation,params)=>bridge.accountRequest(operation,params)});
const memberSettings=createMemberSettings({getIdentity:()=>auth,request:(operation,params)=>bridge.accountRequest(operation,params)});
const memberInsight=createMemberInsight({getIdentity:()=>auth,request:(operation,params)=>bridge.accountRequest(operation,params),activity:memberActivity,understanding:memberUnderstanding,settings:memberSettings,onChange:()=>{if(view==='benefits'&&selectedBenefit==='insight')renderInsight();}});
bindMemberUnderstandingEditor($('benefit-detail'),{controller:memberUnderstanding,getReport:()=>memberInsight.read().report,settings:memberSettings,getSettingsContext:()=>memberInsight.settingsContext(),onSettingsSaved:()=>void memberInsight.refresh({quiet:true})});
function renderInsight(){const restoreInsightFocus=captureMemberUnderstandingFocus($('benefit-detail'));const target=$('benefit-detail'),active=target.contains(document.activeElement),action=document.activeElement?.dataset.insightAction,app=document.activeElement?.dataset.insightTarget;target.innerHTML=renderMemberInsight(memberInsight.read(),{native:true,poster:benefitPoster('insight')});if(active)(action?[...target.querySelectorAll('[data-insight-action]')].find(node=>node.dataset.insightAction===action&&node.dataset.insightTarget===app):target.querySelector('#benefit-title'))?.focus({preventScroll:true});restoreInsightFocus();}
const memberHome=mountMemberHome($('view-home'),{storage:localStore,getSnapshot:()=>({library,personal:personalState,prefs:effectivePrefs(),clients:clients.map(row=>client(row.id))}),getAppAction,onLaunch:launchFromHome,onRetry:()=>refreshAuth({reload:true}),onApp:selectApp,onPurpose:choosePurpose,onAccount:()=>openAccount(),onBenefits:()=>showView('benefits'),onToast:toast});
const pulseClient=mountPulseClient($('pulse-client'),{storage:localStore,getContext:()=>({owner:library.owner,status:library.status}),getFavorite:()=>effectivePrefs().favorites.includes('pulse'),onFavorite:()=>$('favorite').click(),onToast:toast,onOpenApp:()=>command('pulse-app','pulse')});
// 「내 계정」: signed-in entry points open it; signed out they keep the sign-in dialog.
const accountPage=mountAccountPage($('view-account'),{bridge,getIdentity:()=>auth,getAppIds:()=>library.appIds,onBack:()=>showView('settings'),onSignIn:()=>$('account-dialog').showModal(),onSignOut:()=>$('sign-out').click(),onWorkspace:()=>{if(allowed('messenger'))launchFromHome('messenger');else toast('이 계정에서는 작업실을 열 수 없어요.');},onAccountChanged:()=>void refreshAuth({reload:true}),toast:message=>toast(message)});
function openAccount(){if(bridge&&auth.signedIn)showView('account');else $('account-dialog').showModal();}
const continuityRoot=document.createElement('aside');continuityRoot.setAttribute('aria-label','계정 라이브러리');$('view-home').before(continuityRoot);
const continuityStyle=document.createElement('link');continuityStyle.rel='stylesheet';continuityStyle.href='./platform-continuity.css';document.head.append(continuityStyle);
continuity=mountPlatformLibrary(continuityRoot,{native:true,getHost:()=>bridge,getAppIds:()=>library.appIds,getDevice:()=>({favorites:prefs.favorites,recent:Object.entries(prefs.lastLaunch).filter(([,at])=>at).map(([id,at])=>({id,at,mode:'client'}))}),onChange:()=>{renderLibrary();renderSelected();memberHome.render();convenience?.refresh();},onFavoritesChanged:()=>memberActivity.syncFavorites(),onOpen:id=>{if(allowed(id))launchFromHome(id);else toast('아직 설치하지 않았거나 이 계정에서 쓸 수 없는 앱이에요. 「설치·업데이트」에서 설치 상태를 봐 주세요.');},storage:localStorage});
function effectivePrefs(){const cloud=continuity?.projection();return projectLibraryPreferences(cloud?{...prefs,accountLibrary:true,favorites:cloud.favorites,lastLaunch:Object.fromEntries(cloud.recent.map(row=>[row.entryId||row.id,row.at]))}:prefs,library);}
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
const benefitWords={insight:'성향',subscriptions:'구독',care:'플레저',fortune:'운세'};
const benefitWord=item=>benefitWords[item.id]||item.name,benefitWordLength=item=>benefitWord(item).replace(/\s/g,'').length,benefitNumber=index=>String(index+1).padStart(2,'0')+' / '+String(MEMBER_BENEFITS.length).padStart(2,'0');
const benefitPoster=id=>{const index=MEMBER_BENEFITS.findIndex(item=>item.id===id),item=MEMBER_BENEFITS[index];return item?{art:asset+item.asset,label:'SYNK FOR YOU · '+benefitNumber(index),badge:item.statusLabel,status:item.status}:null;};
const subscriptionsBoard=createSubscriptionsBoard({bridge,toast:message=>toast(message),poster:benefitPoster('subscriptions')});
function statusTone(row){if(!row)return 'wait';const stage=apps[row.id]?.stage;if(stage==='planned'||row.status==='planned')return 'planned';if(row.publicWebAvailable)return 'ok';if(stage==='preview'||row.status==='preview')return 'preview';if(row.reason==='CHECKING')return 'wait';if(row.canLaunch)return row.updateAvailable?'wait':'ok';if(row.installer?.status==='preparing')return 'wait';if(row.reason==='INVALID_INSTALLATION')return 'alert';return 'off';}
function readTheme(){try{const value=localStorage.getItem(THEME_KEY);return THEMES.includes(value)?value:'night';}catch{return 'night';}}
function applyTheme(value){document.documentElement.dataset.theme=value;document.querySelectorAll('[data-theme-choice]').forEach(el=>el.setAttribute('aria-checked',String(el.dataset.themeChoice===value)));}
function setTheme(value){if(!THEMES.includes(value))return;try{localStorage.setItem(THEME_KEY,value);}catch{/* The theme still applies for this window. */}applyTheme(value);}
function heroTitle(app){const lines=String(app.word||app.short).split('\n'),len=Math.max(...lines.map(line=>line.replace(/\s/g,'').length),1);return '<span class="hero-name">'+escape(app.name)+'</span><span class="hero-word'+(lines.length>1?' two-line':'')+'" style="--len:'+len+'">'+lines.map(escape).join('<br>')+'</span>';}
applyTheme(readTheme());
function createPersonal(){return createPlatformPersonalization(globalThis.SynkAtlasPersonalization,localStore,{key:accountStorageKey(PERSONAL_KEY,library.owner),scope:{...PLATFORM_SCOPE,personId:library.owner||'pending-account'}});}
function readPrefs(){try{return library.owner?localStorage.getItem(accountStorageKey('synk-launcher-view-v1',library.owner)):null;}catch{return null;}}
function savePrefs(){if(!library.owner)return;try{localStorage.setItem(accountStorageKey('synk-launcher-view-v1',library.owner),JSON.stringify(prefs));}catch{/* In-memory view state still works. */}convenience?.refresh();}
function allowed(id){return library.appIds.includes(id);}
function reconcileSelection(){if(['ready','guest'].includes(library.status))prefs.selected=visibleSelection(displayLibraryAppId(prefs.selected,library),personalState.order);}
function setAuth(snapshot,{environmentOnly=false}={}){
  if(!environmentOnly)authRevision++;
  const next=resolveLibrary(snapshot,environment),changed=JSON.stringify([library.owner,library.status,library.appIds,auth.sessionGeneration])!==JSON.stringify([next.owner,next.status,next.appIds,snapshot?.sessionGeneration]);
  const ownerChanged=library.owner!==next.owner;
  if(ownerChanged)convenience?.capture();
  auth=snapshot||{status:'error',signedIn:false};library=next;
  memberActivity.read();
  if(sessionPurpose&&((next.owner&&next.owner!==sessionPurposeOwner)||['signed-out','signing-out','unconfigured'].includes(auth.status))){sessionPurpose=null;sessionPurposeOwner=null;}
  if(changed){
    ownerEpoch++;busy=new Set();
    if(ownerChanged){detail='overview';filter='all';search='';$('search').value='';pulseLegacyView=false;}
    if($('leave-dialog').open)$('leave-dialog').close('keep');
    for(const id of ['content-dialog','personal-dialog'])if($(id).open)$(id).close();
    $('content-title').textContent='';$('content-description').textContent='';$('content-image').removeAttribute('src');$('personal-message').textContent='';
    clearTimeout(toastTimer);$('toast').hidden=true;$('toast').textContent='';
    if(ownerChanged){prefs=parsePreferences(readPrefs());personal=createPersonal();}
  }
  applyPersonalization();reconcileSelection();continuity?.render();renderLibrary();renderSelected();renderDownloads();renderAuth();renderBenefits();convenience?.refresh();
  if(bridge&&auth.signedIn&&library.owner)void continuity?.connect();
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
function setMobileSearch(open,{focus=true}={}){document.documentElement.classList.toggle('library-search-open',open);$('library-search-toggle').setAttribute('aria-expanded',String(open));if(focus){const target=open?$('search'):$('library-search-toggle');target.focus();if(open)target.select();}}
function openLibrarySearch(){if(matchMedia('(max-width:760px)').matches)setMobileSearch(true);else{$('search').focus();$('search').select();}}
function hasUnsavedDrafts(){return pulseClient.hasUnsavedChanges()||memberHome.hasUnsavedChanges()||!!continuity?.hasUnsavedDraft();}
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
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5500);}
function errorText(result){const code=result?.code||result?.error?.code;return ({
  RELEASE_UNAVAILABLE:'이 기기에 맞는 설치 파일이 아직 없어요.',INVALID_INSTALLATION:'설치된 앱을 열 수 없는 상태예요. 설치 파일을 다시 준비해 주세요.',NOT_INSTALLED:'앱을 설치한 뒤 열어 주세요.',LAUNCH_FAILED:'앱을 열지 못했어요. 다시 눌러 보고, 계속 안 되면 다시 설치해 주세요.',AUTH_NOT_CONFIGURED:'로그인 설정을 찾지 못해 로그인할 수 없어요. synk.im에서 PC 앱을 다시 받아 설치해 주세요.',AUTH_CANCELLED:'로그인을 취소했어요.',PACKAGE_HASH_MISMATCH:'설치 파일이 온전하지 않아요. 다시 준비해 주세요.',PACKAGE_SIZE_MISMATCH:'설치 파일 크기가 맞지 않아요. 다시 준비해 주세요.',PACKAGE_NOT_FOUND:'플랫폼 안에서 설치 파일을 찾지 못했어요. 플랫폼을 업데이트해 주세요.',INSTALLER_OPEN_FAILED:'설치 파일을 열지 못했어요. 다시 준비해 주세요.',PREPARATION_CANCELLED:'설치 파일 준비를 취소했어요.',PACKAGE_NOT_READY:'먼저 설치 파일을 준비해 주세요.',PREVIEW_DEVELOPMENT_ONLY:'이 판에서는 열 수 없어요. 웹에서 열어 주세요.',PREVIEW_LAUNCH_FAILED:'앱을 열지 못했어요. 잠시 뒤 다시 눌러 주세요.',PREVIEW_NOT_IN_LIBRARY:'이 계정에는 이 앱이 열려 있지 않아요. 학교나 회사 담당자에게 물어봐 주세요.',UNKNOWN_CLIENT:'알 수 없는 앱이에요. 플랫폼을 다시 열어 주세요.'})[code]||'처리하지 못했어요. 잠시 뒤 다시 눌러 주세요.';}
function preserveFocus(render){const el=document.activeElement,key=el?.dataset?.focusKey;render();if(key){const found=[...document.querySelectorAll('[data-focus-key]')].find(node=>node.dataset.focusKey===key);found?.focus({preventScroll:true});}}
function renderLibrary(){
  const prefs=effectivePrefs();
  memberHome.render();
  renderBenefitSearch();
  const sidebarIds=displayLibraryAppIds(library).filter(id=>!memberBenefit(id));
  const copy=libraryCopy({...library,appIds:sidebarIds});
  $('library-count').textContent=String(sidebarIds.length).padStart(2,'0');$('library-caption').textContent=copy.caption;$('library-access-note').textContent=copy.note;
  $('library-empty').hidden=library.appIds.length>0;$('library-empty-title').textContent=copy.title;$('library-empty-description').textContent=copy.description;
  $('library-account').textContent=auth.signedIn?'내 계정':'로그인 안내';$('library-retry').hidden=library.status!=='unavailable';
  $('personal-entry').hidden=!library.appIds.length;
  preserveFocus(()=>{let count=0;const order=filter==='favorites'?[...new Set([...prefs.favorites,...personalState.order])].filter(allowed):personalState.order;$('app-list').innerHTML=order.filter(id=>sidebarIds.includes(id)).map(id=>{const app=apps[id],row=client(id),favorite=prefs.favorites.includes(id);if(!matchesLibrary(id,{search,filter,favorites:prefs.favorites,client:row,teacherAvailable:allowed('teacher')}))return '';count++;return `<button class="app-item brand-${id} ${prefs.selected===id?'selected':''}" data-app="${id}" data-focus-key="app-${id}" aria-label="${app.name}, ${escape(statusLabel(row))}" aria-pressed="${prefs.selected===id}"><span class="tile" aria-hidden="true">${escape(app.mark)}</span><span class="app-item-copy"><strong>${app.name}</strong><small data-tone="${statusTone(row)}"><span class="led" aria-hidden="true"></span>${escape(statusLabel(row))}</small></span><span class="app-icon-label" aria-hidden="true">${({world:'월드',messenger:'메신저',teacher:'교사',path:'진로',pulse:'PULSE',care:'플레저',fortune:'운세'})[id]}</span>${favorite?'<span class="favorite-mark" aria-hidden="true">'+icon('star')+'</span>':''}</button>`;}).join('');$('empty-search').hidden=count>0||!sidebarIds.length;});document.querySelectorAll('[data-filter]').forEach(el=>{el.setAttribute('aria-pressed',String(el.dataset.filter===filter));el.hidden=!sidebarIds.length||(el.dataset.filter==='planned'&&!sidebarIds.some(id=>apps[id].stage==='planned'))||(el.dataset.filter==='development'&&(!sidebarIds.some(id=>apps[id].stage!=='planned')||!sidebarIds.some(id=>apps[id].stage==='planned')));});}
function renderSelected(){
  reconcileSelection();pulseClient.syncContext();const app=allowed(prefs.selected)?apps[prefs.selected]:null,isPulse=!!app&&prefs.selected==='pulse'&&pulseLegacyView;$('pulse-client').hidden=!isPulse;$('app-detail').hidden=!app||isPulse;if(isPulse){document.documentElement.dataset.product='pulse';$('brand-scope').textContent=app.brand;$('breadcrumb-app').textContent=app.name;renderActions();pulseClient.render();return;}
  if(!app){document.documentElement.dataset.product='platform';for(const id of ['brand-scope','breadcrumb-app','hero-category','hero-title','hero-description','hero-caption','product-stage','detail-content','action-notice','install-status','install-version','last-launch'])$(id).textContent='';$('hero-art').removeAttribute('src');$('teacher-web-link').hidden=true;$('primary-action').disabled=true;$('primary-action').dataset.action='none';$('teaching-action').hidden=true;renderPersonalization();return;}
document.documentElement.dataset.product=prefs.selected;$('brand-scope').textContent=app.brand;$('breadcrumb-app').textContent=app.name;$('hero').className='hero brand-'+prefs.selected+(app.stage==='planned'||app.stage==='preview'?' expansion':'');$('hero-art').src=asset+app.cover;$('hero-art').alt=app.alt;$('hero-category').textContent=app.category;$('hero-title').innerHTML=heroTitle(app);$('hero-description').textContent=app.description;$('hero-caption').textContent=app.caption;$('product-stage').textContent=app.stage==='planned'?'준비 중':app.stage==='preview'?statusLabel(client()):'따로 설치하는 PC 앱';const contentTab=document.querySelector('[data-detail="content"]');if(contentTab){contentTab.textContent=app.stage==='planned'?'준비 중인 기능':prefs.selected==='teacher'?'하는 일':app.stage==='preview'?'할 수 있는 것':'들어 있는 것';
  // 둘째 탭은 WORLD의 「들어 있는 것」(게임·연습 목록)에만 개요와 다른 내용이 있다. 다른 앱은 개요를 되풀이해서 숨긴다.
  contentTab.hidden=prefs.selected!=='world';if(contentTab.hidden&&detail==='content')detail='overview';}renderActions();renderDetails();renderPersonalization();}
function renderActions(){const prefs=effectivePrefs();if(!allowed(prefs.selected))return;const row=client(),action=getAppAction(prefs.selected),favorite=prefs.favorites.includes(prefs.selected);$('primary-action').textContent=action.label;$('primary-action').disabled=action.disabled;$('primary-action').dataset.action=action.action;$('favorite').setAttribute('aria-pressed',String(favorite));$('favorite').setAttribute('aria-label',favorite?'즐겨찾기에서 제거':'즐겨찾기에 추가');$('install-status').textContent=statusLabel(row);$('install-version').textContent=row?.version||'—';const time=prefs.lastLaunch[prefs.selected];$('last-launch').textContent=time?new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(time)):'기록 없음';
  $('teaching-action').hidden=prefs.selected!=='messenger'||!allowed('teacher');$('teaching-action').disabled=getAppAction('teacher').disabled;
  $('teacher-web-link').hidden=!!bridge||prefs.selected!=='teacher';let notice='';if(action.action==='pulse-app')notice='PULSE 창이 따로 열려요. 웹브라우저와 로그인은 따로예요.';else if(action.action==='public-web')notice=prefs.selected==='path'?'기본 브라우저에서 면접 연습이 열려요. Quest 브라우저에서도 같은 주소로 열 수 있어요. 답은 계정에 저장하지 않아요.':'기본 브라우저에서 열려요. 기록을 계정에 남기려면 열린 화면에서 SYNK ID로 로그인해 주세요.';else if(apps[prefs.selected].stage==='planned')notice=apps[prefs.selected].boundary;else if(prefs.selected==='teacher')notice=apps.teacher.boundary+' '+(!bridge?'아래 링크로 이 컴퓨터의 워크스페이스에서 「내 수업」을 열 수 있어요.':action.action==='teacher-preview'?'누르면 워크스페이스 창의 「내 수업」 탭이 열려요.':'PC 앱에서 여는 기능은 아직 준비 중이에요.');else if(apps[prefs.selected].stage==='preview')notice=apps[prefs.selected].boundary+' '+(bridge?'창이 따로 열려요.':'SYNK Platform PC 앱에서 열려요.');else if(!bridge)notice='브라우저에서는 화면만 볼 수 있어요. 설치와 실행은 SYNK Platform PC 앱에서 해요.';else if(row?.canLaunch)notice=row.updateAvailable?`새 버전(${row.latestVersion})이 있어요. 「설치·업데이트」에서 받을 수 있어요.`:'따로 설치한 PC 앱으로 열려요.';else if(row?.installer?.status==='preparing')notice=`설치 파일을 준비하고 있어요. ${bytes(row.installer.transferredBytes)} / ${bytes(row.installer.totalBytes)}`;else if(row?.installer?.status==='installer-opened')notice=environment?.platform==='darwin'?'열린 창에서 앱을 Applications 폴더로 옮긴 뒤 「설치 상태 확인」을 눌러 주세요.':'설치 창에서 설치를 마친 뒤 「설치 상태 확인」을 눌러 주세요.';else if(row?.installer?.canOpen)notice=environment?.platform==='darwin'?'「설치 시작」을 누르면 설치 파일이 열려요. 앱을 Applications 폴더로 옮겨 주세요.':'설치 파일이 준비됐어요. 「설치 시작」을 누르면 설치 창이 열려요.';else if(row?.installer?.canPrepare)notice=`${row.latestVersion?'v'+row.latestVersion+' · ':''}${Number(row.installer.totalBytes)>0?'설치 파일 '+bytes(row.installer.totalBytes)+' · ':''}이 PC에 따로 설치해요.`;else notice='이 기기에 맞는 설치 파일이 아직 없어요.';if(prefs.selected==='messenger'&&allowed('teacher')&&bridge&&row?.canLaunch&&getAppAction('teacher').disabled)notice+=' 「내 수업」은 워크스페이스를 실행한 뒤 그 안의 「내 수업」 탭에서 열 수 있어요.';$('action-notice').textContent=notice;
}
function renderDetails(){if(!allowed(prefs.selected)){$('detail-content').innerHTML='';return;}document.querySelectorAll('[data-detail]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.detail===detail)));if(['planned','preview'].includes(apps[prefs.selected].stage)){renderExpansion();return;}const world=prefs.selected==='world';if(detail==='info'){const row=client();$('detail-content').innerHTML=`<dl class="info-grid"><dt>앱</dt><dd>${escape(apps[prefs.selected].name)}</dd><dt>여는 방식</dt><dd>이 PC에 따로 설치하는 앱</dd><dt>이 기기</dt><dd>${escape(systemName())}</dd><dt>설치 상태</dt><dd>${escape(statusLabel(row))}</dd><dt>최신 버전</dt><dd>${escape(row?.latestVersion||'확인 중')}</dd><dt>계정</dt><dd>${world?'SYNK ID로 로그인해요. 학습 기록은 WORLD에 저장돼요.':'SYNK ID로 로그인하고, 회사 구성원으로 등록돼 있어야 해요.'}</dd><dt>판</dt><dd>시험판(Preview)이에요. 아직 서명 전이라 설치할 때 Windows가 경고를 띄울 수 있어요.</dd></dl>`;return;}
  if(!world){$('detail-content').innerHTML=`<div class="overview-heading"><h2>Workspace에서 하는 일</h2><span>SYNK 팀 업무 앱</span></div><p class="product-summary">${escape(apps.messenger.summary)}</p><div class="feature-list">${apps.messenger.features.map((feature,index)=>`<article><span class="feature-number">0${index+1} / WORK</span><h3>${escape(feature[0])}</h3><p>${escape(feature[1])}</p></article>`).join('')}</div><div class="overview-foot"><p>회사 구성원으로 등록된 SYNK ID로 써요. 고객과 함께하는 광고 제작은 PULSE에서 해요.</p><button class="text-link" data-show-detail="info">앱 정보 ${icon('arrow-right')}</button></div>`;return;}
  if(detail==='content'){$('detail-content').innerHTML=`<div class="overview-heading"><h2>WORLD에 들어 있는 것</h2><span>WORLD 앱 안에서 해요</span></div><div class="content-list">${Object.entries(games).map(([id,game])=>`<div class="content-row"><h3>${game.name}</h3><p>${game.tag}</p><button class="ghost-button" data-game="${id}">화면 보기 ${icon('arrow-up-right')}</button></div>`).join('')}${worldExtras.map(([name,tag])=>`<div class="content-row"><h3>${escape(name)}</h3><p>${escape(tag)}</p></div>`).join('')}</div>`;return;}
  $('detail-content').innerHTML=`<div class="overview-heading"><h2>WORLD에서 하는 일</h2><span>한국어 학습 앱</span></div><p class="product-summary">${escape(apps.world.summary)}</p><div class="feature-list">${apps.world.features.map((feature,index)=>`<article><span class="feature-number">0${index+1} / WORLD</span><h3>${escape(feature[0])}</h3><p>${escape(feature[1])}</p>${index===1?Object.entries(games).map(([id,game])=>`<button class="text-link" data-game="${id}" aria-label="${game.name} 화면 보기">${escape(game.name)} ${icon('arrow-up-right')}</button>`).join(''):''}</article>`).join('')}</div><div class="overview-foot"><p>WORLD에 들어 있는 연습과 게임을 하나씩 볼 수 있어요.</p><button class="text-link" data-show-detail="content">전부 보기 ${icon('arrow-right')}</button></div>`;
}
function renderExpansion(){const app=apps[prefs.selected],preview=app.stage==='preview',teacher=prefs.selected==='teacher',stage=preview?statusLabel(client()):'준비 중';
  if(prefs.selected==='pulse'){$('detail-content').innerHTML='<div class="overview-heading"><h2>PULSE에서 하는 일</h2><span>전용 창에서 열려요</span></div><p class="product-summary">'+escape(app.summary)+'</p><div class="feature-list">'+app.features.map((feature,index)=>'<article><span class="feature-number">0'+(index+1)+' / PULSE</span><h3>'+escape(feature[0])+'</h3><p>'+escape(feature[1])+'</p></article>').join('')+'</div><div class="overview-foot"><p>PULSE 창은 이 PC에 로그인이 남아 있어요. 웹브라우저에서 열 때는 따로 로그인해요. 제작자 화면은 웹브라우저에서 열려요.</p><button class="text-link" data-pulse-legacy="open">이 PC에 저장한 이전 요청 초안 '+icon('arrow-right')+'</button></div>';return;}
  const opens={path:'기본 브라우저에서 열려요(synk.im).',care:'기본 브라우저에서 열려요(synk.im).',fortune:'기본 브라우저에서 열려요(synk.im).'}[prefs.selected],access={path:'로그인 없이 써요. 답은 저장하지 않아요.',care:'로그인 없이 시작하고, 로그인하면 사람·일정·장부를 계정에 보관해요.',fortune:'로그인 없이 보고, 로그인하면 담아 둔 운세와 메모를 계정에 보관해요.'}[prefs.selected];
  if(detail==='info'){$('detail-content').innerHTML='<dl class="info-grid"><dt>앱</dt><dd>'+escape(app.name)+'</dd><dt>쓰는 사람</dt><dd>'+escape(app.audience)+'</dd><dt>상태</dt><dd>'+stage+'</dd><dt>여는 방식</dt><dd>'+(teacher?'워크스페이스 창의 「내 수업」 탭':opens||(preview?'창이 따로 열려요':'준비 중'))+'</dd><dt>계정</dt><dd>'+(teacher?'「내 수업」에 SYNK ID로 로그인하면 담당 반이 열려요.':access||(preview?'이 계정에서 쓸 수 있는 앱이에요.':'아직 계정으로 쓸 수 없어요.'))+'</dd><dt>알아 둘 것</dt><dd>'+escape(memberBenefit(prefs.selected)?.availability||app.boundary)+'</dd></dl>';return;}
  const heading=detail==='content'?(teacher?'내 수업에서 하는 일':preview?'할 수 있는 것':'준비 중인 기능'):(teacher?'담당 반을 한눈에':preview?app.short+'에서 하는 일':'준비 중인 일');
  $('detail-content').innerHTML='<div class="overview-heading"><h2>'+heading+'</h2><span>'+stage+'</span></div><p class="product-summary">'+escape(app.summary)+'</p><div class="audience-line"><span>쓰는 사람</span><strong>'+escape(app.audience)+'</strong></div><div class="feature-list">'+app.features.map((feature,index)=>'<article><span class="feature-number">0'+(index+1)+' / '+(teacher?'TEACH':preview?prefs.selected.toUpperCase():'PLAN')+'</span><h3>'+escape(feature[0])+'</h3><p>'+escape(feature[1])+'</p></article>').join('')+'</div><div class="overview-foot"><p>'+escape(app.boundary)+'</p><button class="text-link" data-show-detail="info">앱 정보 '+icon('arrow-right')+'</button></div>';
}
function downloadButtons(row){const id=row.id,i=row.installer||{},disabled=busy.has(id)?'disabled':'';if(i.status==='preparing')return `<button class="ghost-button" data-command="cancel" data-client="${id}" data-focus-key="cancel-${id}" ${disabled}>취소</button>`;if(i.canOpen)return `<button class="solid-button" data-command="open" data-client="${id}" data-focus-key="open-${id}" ${disabled}>${i.status==='installer-opened'?'설치 다시 열기':'설치 시작'}</button>`;if(i.canPrepare)return `<button class="solid-button" data-command="prepare" data-client="${id}" data-focus-key="prepare-${id}" ${disabled}>${icon('download')}${row.updateAvailable?'업데이트 준비':i.status==='error'?'다시 준비':'설치 파일 준비'}</button>`;return '<span class="field-label">아직 설치 파일 없음</span>';}
function renderDownloads(){preserveFocus(()=>{$('download-list').innerHTML=INSTALLABLE_IDS.filter(allowed).map(id=>{const row=client(id)||{id},i=row.installer||{},progress=progressValue(i);return `<article class="download-row brand-${id}"><span class="tile" aria-hidden="true">${escape(apps[id].mark)}</span><div><h2>${apps[id].name}</h2><p>${bridge?escape(!i.status||i.status==='idle'?(row.updateAvailable?'업데이트 가능':row.canLaunch?'설치됨':'설치 가능'):installerLabel(i)):'PC 앱에서 설치할 수 있어요'}${row.latestVersion?' · v'+escape(row.latestVersion):''}</p>${i.status==='preparing'?`<progress value="${progress}" max="100" aria-label="${apps[id].name} 설치 파일 준비"></progress><span class="download-bytes">${bytes(i.transferredBytes)} / ${bytes(i.totalBytes)} · ${Math.floor(progress)}%</span>`:i.totalBytes?`<span class="download-bytes">${bytes(i.totalBytes)}</span>`:''}${i.error?`<p>${escape(errorText({code:i.error.code||i.error}))}</p>`:''}</div><div class="download-actions">${bridge?downloadButtons(row):''}</div></article>`;}).join('')||'<p class="download-empty">이 계정으로 설치할 앱이 없어요.</p>';});
  const preparing=clients.filter(row=>allowed(row.id)&&row.installer?.status==='preparing'),ready=clients.filter(row=>allowed(row.id)&&row.installer?.status==='ready');$('queue-count').hidden=!preparing.length&&!ready.length;$('queue-count').textContent=preparing.length+ready.length;$('download-status').textContent=preparing.length?`설치 파일 준비 중 · ${preparing.length}개`:ready.length?`설치 준비됨 · ${ready.length}개`:'설치 중인 앱 없음';document.querySelector('.footer-progress').hidden=!preparing.length;$('footer-progress-fill').style.width=(preparing.length?progressValue(preparing[0].installer):0)+'%';
}
function systemName(){return environment?`${({win32:'Windows',darwin:'macOS',linux:'Linux'})[environment.platform]||environment.platform} · ${environment.arch}`:'브라우저 미리보기';}
function renderSettings(){renderPersonalization();$('density').value=prefs.density;document.documentElement.classList.toggle('compact',prefs.density==='compact');$('platform-version').textContent=environment?`v${environment.version} · ${systemName()}`:'화면 미리보기';$('diagnostics').innerHTML=`<dt>화면</dt><dd>${bridge?'PC 앱에 들어 있음':'브라우저 미리보기'}</dd><dt>SYNK ID</dt><dd>${auth.signedIn?'로그인됨':auth.configured?'로그인 안 함':'로그인 설정 없음'}</dd><dt>판</dt><dd>${environment?.mode==='release'?'정식판':'시험판(Preview)'}</dd><dt>앱 실행</dt><dd>${bridge?'앱마다 따로 열림':'PC 앱에서'}</dd>${allowed('pulse')?'<dt>PULSE 이전 초안</dt><dd><button class="text-link" data-pulse-legacy="open">이 PC에 저장한 요청 초안 보기</button></dd>':''}`;}
function renderAuth(){
  const signedIn=auth.signedIn,signing=['signing-in','restoring','signing-out'].includes(auth.status),retryable=!!bridge&&auth.configured&&!signedIn&&!signing&&auth.status==='error'&&auth.error?.retryable===true&&typeof bridge.accountRequest==='function',name=auth.account?.display_name||'SYNK 회원';
  $('account-button').dataset.signedIn=String(!!signedIn);$('account-button').setAttribute('aria-label',signedIn?'내 계정':'SYNK ID 로그인');$('settings-login').textContent=signedIn?'내 계정':'로그인';
  $('account-label').textContent=signedIn?name:signing?'로그인 중':'로그인';
  $('account-title').textContent=signedIn?`${name} 님`:signing?'로그인 중':'SYNK 시작하기';
  $('account-description').textContent=signedIn?'앱마다 쓸 수 있는 범위는 따로 정해져 있어요.':retryable?'저장된 로그인을 다시 불러오거나 새로 로그인해 주세요.':'처음이라면 회원가입, 계정이 있다면 로그인해 주세요.';
  let message=signedIn?'로그인돼 있어요.':!bridge?'회원가입과 로그인은 SYNK Platform PC 앱에서 해요.':!auth.configured?'로그인 설정을 찾지 못해 로그인할 수 없어요. synk.im에서 PC 앱을 다시 받아 설치해 주세요.':signing?'기본 브라우저에서 로그인을 마쳐 주세요.':signUpOpened?'회원가입 페이지를 열었어요. 가입을 마쳤다면 아래 로그인 버튼을 눌러 주세요.':'아직 로그인하지 않았어요.';
  if(auth.error)message+='\n'+(auth.error.message||'로그인을 완료하지 못했어요. 다시 시도해 주세요.');
  // A password changed in the browser's SYNK ID ends this app's session too.
  if(!signedIn&&auth.error?.code==='AUTH_REQUIRED'&&accountPage.securityVisitedRecently())message+='\n비밀번호를 바꿨다면 새 비밀번호로 다시 로그인해 주세요.';$('account-state').textContent=message;
  for(const id of ['signup-button','sign-up']){$(id).hidden=!!signedIn;$(id).disabled=typeof bridge?.authSignUp!=='function'||signing||signUpPending||accountRetryPending;$(id).textContent=signUpPending?'여는 중…':'회원가입';}
  $('signup-help').hidden=!!signedIn||signing;
  $('account-retry').hidden=!retryable;$('account-retry').disabled=accountRetryPending||signUpPending;
  $('sign-in').textContent=retryable?'새로 로그인':'로그인';$('sign-in').hidden=signedIn||signing;$('sign-in').disabled=!bridge||!auth.configured||accountRetryPending||signUpPending;
  $('sign-out').hidden=!signedIn;$('cancel-sign-in').hidden=auth.status!=='signing-in';$('settings-account').textContent=signedIn?`${name} 님으로 로그인됨`:auth.configured?'로그인하지 않음':'로그인 설정 없음';renderSettings();accountPage.authChanged();
}
function readRoute(){return {view,appId:prefs.selected,detail,benefitId:selectedBenefit,scroll:$('main').scrollTop,pageScroll:globalThis.scrollY||0};}
function showView(next,{restore=false,...route}={}){if(!['home','library','benefits','downloads','settings','account'].includes(next))return;if(convenience&&!restore){convenience.navigate({view:next,appId:prefs.selected,...route});return;}view=next;if(view!=='benefits'){memberInsight.setVisible(false);subscriptionsBoard.setVisible(false);$('benefit-detail').innerHTML='';}if(allowed(route.appId))prefs.selected=route.appId;detail=route.detail||'overview';selectedBenefit=view==='benefits'?route.benefitId||null:null;for(const name of ['home','library','benefits','downloads','settings','account'])$('view-'+name).hidden=name!==view;
  // 「내 계정」 sits under 설정, so that tab stays lit.
  const tab=view==='account'?'settings':view;if(view!=='account')accountPage.hide();document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===tab);if(el.dataset.view===tab)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});if(view==='home'){memberHome.render();$('member-home-title').focus({preventScroll:true});}if(view==='library'){renderLibrary();renderSelected();$('main').focus({preventScroll:true});}if(view==='downloads')renderDownloads();if(view==='settings')renderSettings();if(view==='account')accountPage.show();if(view==='benefits'){renderBenefits();$(selectedBenefit?'benefit-title':'benefits-title').focus({preventScroll:true});}document.documentElement.dataset.view=view;$('main').scrollTop=route.scroll||0;globalThis.scrollTo?.(0,route.pageScroll||0);}
function canPreviewBenefit(id){return typeof bridge?.openProductPreview==='function'&&benefitPreviewAvailable(id,{native:!!bridge,appIds:library.appIds,productPreviewsAvailable:environment?.productPreviewsAvailable});}
function renderBenefitSearch(){const results=search?MEMBER_BENEFITS.filter(item=>[item.name,item.kicker,item.description,...item.steps.map(step=>step.body)].join(' ').toLowerCase().includes(search)):[];$('benefits-search').hidden=!results.length;$('benefits-search').innerHTML=results.length?'<span class="field-label">회원 혜택 소개</span>'+results.map(item=>'<button data-benefit="'+item.id+'"><strong>'+escape(item.name)+'</strong><small>'+item.statusLabel+' · 소개 보기</small></button>').join(''):'';}
function renderBenefits(){
  memberInsight.setVisible(view==='benefits'&&selectedBenefit==='insight'&&!document.hidden);
  if(!(view==='benefits'&&selectedBenefit==='subscriptions'))subscriptionsBoard.setVisible(false);
  $('benefits-grid').innerHTML=MEMBER_BENEFITS.map((item,index)=>'<article class="benefit-card benefit-'+item.id+' brand-'+item.id+'"><button class="benefit-card-link" data-benefit="'+item.id+'" aria-label="'+escape(item.name)+' 소개 보기"><div class="benefit-card-art" style="--len:'+benefitWordLength(item)+'"><span class="benefit-number">'+benefitNumber(index)+'</span><span class="benefit-state is-'+item.status+'"><span class="led" aria-hidden="true"></span>'+escape(item.statusLabel)+'</span><img class="benefit-object" src="'+asset+item.asset+'" alt="'+escape(item.alt)+'"><span class="poster-word" aria-hidden="true">'+escape(benefitWord(item))+'</span></div><div class="benefit-card-copy"><span class="benefit-kicker">'+escape(item.kicker)+'</span><h3>'+escape(item.name)+'</h3><p>'+escape(item.description)+'</p><span class="benefit-card-cta">소개 보기 '+icon('arrow-right')+'</span></div></button></article>').join('');
  const item=memberBenefit(selectedBenefit);$('benefits-overview').hidden=!!item;$('benefit-detail').hidden=!item;
  if(!item){$('benefit-detail').innerHTML='';return;}
  if(item.id==='insight'){renderInsight();return;}
  if(item.id==='subscriptions'){subscriptionsBoard.render($('benefit-detail'),{signedIn:!!auth.signedIn,native:!!bridge});return;}
  const canPreview=canPreviewBenefit(item.id),launchBusy=busy.has(item.id);
  const canOpenPublic=allowed(item.id)&&typeof bridge?.openPublicApp==='function'&&Array.isArray(environment?.publicAppsAvailable)&&environment.publicAppsAvailable.includes(item.id);
  const publicAction=!item.publicUrl?'':bridge?'<button class="primary" data-benefit-public="'+item.id+'" '+(launchBusy||!canOpenPublic?'disabled':'')+'>'+(launchBusy?'여는 중…':'웹에서 열기')+' '+icon('arrow-up-right')+'</button>':'<a class="primary" href="'+escape(item.publicUrl)+'" target="_blank" rel="noopener noreferrer">웹에서 열기 '+icon('arrow-up-right')+'</a>';
  $('benefit-detail').innerHTML='<button class="text-link benefit-back" data-view="benefits">'+icon('arrow-left')+'회원 혜택 모두 보기</button><header class="benefit-detail-hero benefit-'+item.id+' brand-'+item.id+'" style="--len:'+benefitWordLength(item)+'"><img class="benefit-object" src="'+asset+item.asset+'" alt="'+escape(item.alt)+'"><div class="benefit-detail-top"><span class="eyebrow">SYNK FOR YOU · '+benefitNumber(MEMBER_BENEFITS.indexOf(item))+'</span><span class="benefit-state is-'+item.status+'"><span class="led" aria-hidden="true"></span>'+escape(item.statusLabel)+'</span></div><div class="benefit-detail-title"><span class="poster-word" aria-hidden="true">'+escape(benefitWord(item))+'</span><h1 id="benefit-title" tabindex="-1">'+escape(item.headline)+'</h1></div><p class="benefit-detail-note">'+escape(item.description)+'</p></header><div class="benefit-story"><span class="eyebrow">'+(item.status==='preview'?'할 수 있는 것':'준비 중인 것')+'</span><h2>'+escape(item.kicker)+'</h2><ol class="benefit-steps">'+item.steps.map((step,index)=>'<li><span class="benefit-step-number">0'+(index+1)+'</span><div><h3>'+escape(step.title)+'</h3><p>'+escape(step.body)+'</p></div></li>').join('')+'</ol><div class="benefit-availability"><strong>'+item.statusLabel+'</strong><p>'+escape(item.availability)+'</p>'+publicAction+(canPreview?'<button class="primary" data-benefit-preview="'+item.id+'" '+(launchBusy?'disabled':'')+'>'+(launchBusy?'여는 중…':escape(item.name)+' PC 앱에서 열기')+'</button>':'')+'</div></div><div class="benefit-next"><span class="eyebrow">다른 회원 혜택</span>'+MEMBER_BENEFITS.filter(other=>other.id!==item.id).map(other=>'<button class="ghost-button" data-benefit="'+other.id+'">'+escape(other.name)+' '+icon('arrow-right')+'</button>').join('')+'</div>';
}
function openBenefit(id){if(!memberBenefit(id))return;showView('benefits',{benefitId:id});}
function selectApp(id,{legacy=false}={}){if(!allowed(id))return;if(id==='pulse'&&!legacy)return command('pulse-app',id);pulseLegacyView=id==='pulse'&&legacy;showView('library',{appId:displayLibraryAppId(id,library),detail:'overview'});savePrefs();}
function setClients(snapshot){if(!Array.isArray(snapshot))return;const previous=clients;clients=clientRows(snapshot,{native:!!bridge});convenience?.clientsChanged(previous,clients);renderLibrary();renderActions();renderDownloads();if(detail==='info')renderDetails();convenience?.refresh();}
async function loadEnvironment(){
  const revision=++environmentRevision,snapshot=await bridge.getEnvironment();
  if(revision===environmentRevision){environment=snapshot;setAuth(auth,{environmentOnly:true});platformUpdates?.refresh();$('runtime-label').textContent=`${systemName()} · ${environment?.mode==='release'?'SYNK Platform':'시험판'}`;}
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
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(['enable-activity','disable-activity'].includes(button.dataset.insightAction)){void memberActivity.setConsent(button.dataset.insightAction==='enable-activity');return;}if(button.dataset.insightAction==='activity'){const id=button.dataset.insightTarget;if(['world','messenger','path','pulse'].includes(id)){if(allowed(id))void launchFromHome(id);else toast('아직 설치하지 않았거나 이 계정에서 쓸 수 없는 앱이에요. 「설치·업데이트」에서 설치 상태를 봐 주세요.');}return;}if(button.dataset.insightAction==='refresh'){void refreshAuth({reload:true}).then(()=>memberInsight.refresh());return;}else if(button.dataset.insightAction==='account'){openAccount();return;}else if(button.dataset.themeChoice)setTheme(button.dataset.themeChoice);else if(button.dataset.benefit)openBenefit(button.dataset.benefit);else if(button.dataset.benefitPublic)return command('public-web',button.dataset.benefitPublic);else if(button.dataset.benefitPreview){if(canPreviewBenefit(button.dataset.benefitPreview))return command('product-preview',button.dataset.benefitPreview);}else if(button.dataset.pulseLegacy)selectApp('pulse',{legacy:true});else if(button.dataset.app)selectApp(button.dataset.app);else if(button.dataset.personalApp)selectApp(button.dataset.personalApp);else if(button.dataset.view)showView(button.dataset.view);else if(button.dataset.filter){filter=button.dataset.filter;renderLibrary();}else if(button.dataset.detail||button.dataset.showDetail){showView('library',{appId:prefs.selected,detail:button.dataset.detail||button.dataset.showDetail});}else if(button.dataset.command)command(button.dataset.command,button.dataset.client);else if(button.dataset.window)void windowAction(button.dataset.window);else if(button.dataset.game){if(!allowed('world')||prefs.selected!=='world')return;const game=games[button.dataset.game];if(!game)return;$('content-image').src=asset+game.image;$('content-image').alt=game.name+' 게임 화면';$('content-title').textContent=game.name;$('content-description').textContent=game.description;$('content-dialog').showModal();}});
$('brand-home').addEventListener('click',()=>showView('home'));
$('library-search-toggle').addEventListener('click',()=>setMobileSearch(!document.documentElement.classList.contains('library-search-open')));
$('leave-dialog').addEventListener('close',async()=>{const done=leaveDecision;leaveDecision=null;if(!done)return;const discard=$('leave-dialog').returnValue==='discard';if(discard){const clearing=await Promise.allSettled([memberHome.discardDraft(),continuity?.discardDraft(),pulseClient.discard()]);if(clearing.some(result=>result.status==='rejected'||result.value===false)){toast('임시 저장한 메모를 지우지 못했어요. 설정에서 「쓰던 메모 되살리기」를 꺼 주세요.');done(false);return;}}else{if($('account-dialog').open)$('account-dialog').close();if(pulseClient.hasUnsavedChanges()){selectApp('pulse',{legacy:true});pulseClient.openBrief();}else showView('home');if(continuity?.hasUnsavedDraft())continuity.focusDraft();else memberHome.focusDraft();}done(discard);});
$('leave-dialog').addEventListener('cancel',()=>{$('leave-dialog').returnValue='keep';});
window.addEventListener('beforeunload',event=>{if(pendingLibraryActions||hasUnsavedDrafts()){event.preventDefault();event.returnValue='';if(pendingLibraryActions)toast('즐겨찾기와 실행 기록을 저장하는 중이에요. 끝난 뒤 다시 해 주세요.');}});
$('search').addEventListener('input',event=>{search=event.target.value.trim().toLowerCase();renderLibrary();});
$('primary-action').addEventListener('click',()=>command($('primary-action').dataset.action));
$('refresh').addEventListener('click',refresh);$('refresh-downloads').addEventListener('click',refresh);
function toggleFavorite(id){if(!allowed(id))return;return enqueueLibraryAction(id,async()=>{if(continuity?.connected())await continuity.dispatch({type:'favorite',id});else{prefs.favorites=effectivePrefs().favorites.includes(id)?prefs.favorites.filter(entry=>displayLibraryAppId(entry,library)!==id):[...prefs.favorites,id];savePrefs();renderLibrary();renderActions();void memberActivity.syncFavorites();}});}
function moveFavorite(id,direction){if(!allowed(id)||![-1,1].includes(direction))return;return enqueueLibraryAction(id,async()=>{if(continuity?.connected())return continuity.dispatch({type:'move-favorite',id,direction});const rows=effectivePrefs().favorites.filter(allowed),index=rows.indexOf(id),next=index+direction;if(index<0||next<0||next>=rows.length)return;[rows[index],rows[next]]=[rows[next],rows[index]];prefs.favorites=rows;savePrefs();renderLibrary();renderActions();toast('즐겨찾기 순서를 바꿨어요.');});}
$('favorite').addEventListener('click',()=>toggleFavorite(prefs.selected));
$('download-shortcut').addEventListener('click',()=>showView('downloads'));$('footer-settings').addEventListener('click',()=>showView('settings'));
for(const id of ['account-button','settings-login','library-account'])$(id).addEventListener('click',openAccount);
async function openSignUp(){
  if(typeof bridge?.authSignUp!=='function'||auth.signedIn||['restoring','signing-in','signing-out'].includes(auth.status)||signUpPending||accountRetryPending)return;
  if(!$('account-dialog').open)$('account-dialog').showModal();
  signUpPending=true;renderAuth();const revision=authRevision;
  try{const result=await bridge.authSignUp();if(revision!==authRevision)return;if(result?.ok===true)signUpOpened=true;else toast('회원가입 페이지를 열지 못했어요. 잠시 뒤 다시 눌러 주세요.');}
  catch{if(revision===authRevision)toast('회원가입 페이지를 열지 못했어요. 잠시 뒤 다시 눌러 주세요.');}
  finally{signUpPending=false;renderAuth();}
}
for(const id of ['signup-button','sign-up'])$(id).addEventListener('click',openSignUp);
$('density').addEventListener('change',event=>{prefs.density=event.target.value;savePrefs();renderSettings();});
$('reset-preferences').addEventListener('click',()=>{prefs=parsePreferences(null);reconcileSelection();filter='all';search='';$('search').value='';savePrefs();renderLibrary();renderSelected();renderSettings();toast('보기 설정을 처음 상태로 되돌렸어요.');});
$('content-go-world').addEventListener('click',()=>{if(!allowed('world'))return;$('content-dialog').close();selectApp('world');$('primary-action').focus();});
$('sign-in').addEventListener('click',async()=>{
  if(!bridge||!auth.configured||auth.signedIn||['restoring','signing-in','signing-out'].includes(auth.status)||accountRetryPending||signUpPending)return;
  setAuth({...auth,status:'signing-in',signedIn:false,account:null,library:{status:'unavailable',appIds:[]}});const revision=authRevision;
  try{const result=await bridge.authSignIn();if(revision!==authRevision)return;await refreshAuth();if(result?.ok===false&&!auth.signedIn)toast(errorText(result));}
  catch{if(revision===authRevision)setAuth({status:'error',configured:true,signedIn:false,error:{message:'로그인 창을 열지 못했어요. 다시 눌러 주세요.'}});}
});
$('sign-out').addEventListener('click',async()=>{
  if(!bridge||!auth.signedIn)return;const leaveEpoch=ownerEpoch;
  if(!await confirmDraftExit('저장하지 않은 내용은 로그아웃하면 사라져요. 돌아가서 저장하거나, 저장 없이 로그아웃할 수 있어요.')||leaveEpoch!==ownerEpoch||!auth.signedIn)return;
  $('sign-out').disabled=true;
  const signedOutGeneration=Number.isSafeInteger(auth.sessionGeneration)?auth.sessionGeneration+1:null;
  setAuth({status:'signing-out',configured:auth.configured,signedIn:false});const revision=authRevision;
  const sameLogout=()=>revision===authRevision||signedOutGeneration!==null&&auth.sessionGeneration===signedOutGeneration&&auth.status==='signed-out'&&!auth.signedIn;
  try{
    const result=await bridge.authSignOut();if(!sameLogout())return;
    const refreshedRevision=await refreshAuth();
    if((authRevision!==refreshedRevision&&!sameLogout())||auth.status==='signing-in')return;
    if(!auth.signedIn){
      const notice=result?.ok===false?'로그아웃하지 못했어요. 잠시 뒤 다시 눌러 주세요.':result?.serverSessionRevoked===false||result?.serverRevoked===false?'이 PC에서는 로그아웃했어요. 서버 쪽 로그인은 인터넷이 연결된 뒤 다시 로그인했다 로그아웃하면 정리돼요.':'로그아웃했어요.';
      const cleanupNotice=result?.draftRecoveryCleanup?.ok===false?' 이 PC에 임시 저장한 메모를 지우지 못했어요. 같은 SYNK ID로 다시 로그인해 설정에서 「쓰던 메모 되살리기」를 꺼 주세요.':'';
      if($('account-dialog').open)$('account-dialog').close();
      toast(notice+cleanupNotice);
    }
  }catch{if(sameLogout())setAuth({status:'error',configured:auth.configured,signedIn:false,error:{message:'로그아웃됐는지 확인하지 못했어요. 창을 닫았다 다시 열어 주세요.'}});}
  finally{$('sign-out').disabled=false;}
});
$('account-retry').addEventListener('click',async()=>{
  if(accountRetryPending||!bridge||typeof bridge.accountRequest!=='function'||!auth.configured||auth.signedIn||auth.status!=='error'||auth.error?.retryable!==true)return;
  accountRetryPending=true;renderAuth();
  let refreshedRevision;
  try{refreshedRevision=await refreshAuth({reload:true});}
  finally{accountRetryPending=false;renderAuth();if(refreshedRevision===authRevision&&auth.status==='error'&&auth.error?.code==='SUITE_UNAVAILABLE')$('account-state').textContent+='\n다시 로그인하라는 안내가 보이면 「새로 로그인」을 눌러 주세요. PC 저장 공간이 부족하면 공간을 비운 뒤 「저장된 로그인 다시 확인」을 눌러 주세요.';}
});
$('cancel-sign-in').addEventListener('click',async()=>{const revision=authRevision;try{await bridge.authCancelSignIn();if(revision===authRevision)await refreshAuth();}catch{if(revision===authRevision)toast('로그인을 취소하지 못했어요. 창을 닫았다 다시 열어 주세요.');}});
$('library-retry').addEventListener('click',()=>refreshAuth({reload:true}));
document.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]'))return;if(event.key==='Escape'&&document.documentElement.classList.contains('library-search-open')){event.preventDefault();setMobileSearch(false);}});
window.addEventListener('focus',()=>{refresh();refreshAuth({reload:true});});
function renderPersonalization(){
  const state=personalState;
  $('personal-heading').textContent=state.active?'내가 고른 순서':'앱 순서 정하기';
  $('personal-summary').textContent=state.error||(state.active?'고른 일에 맞춰 앱 순서와 보기를 바꿨어요.':'하려는 일을 고르면 그 일에 맞는 앱이 먼저 나와요.');
  $('personal-open').textContent=state.active?'바꾸기':'고르기';
  $('personal-settings-summary').textContent=state.sessionOnly?CONTEXTS[state.context].label+' · 이 창에서만':state.active?CONTEXTS[state.context].label+' · 이 PC에 저장됨':'아직 고르지 않음';
  $('personal-settings-open').textContent=state.active?'바꾸기':'고르기';$('personal-settings-open').disabled=!library.owner;$('personal-open').disabled=!library.owner;
  $('recommendation').hidden=!state.active||!allowed(state.selected);$('recommendation').innerHTML='';
  if(state.active&&allowed(state.selected)){const app=apps[state.selected];$('recommendation').innerHTML='<span class="atlas-dot" aria-hidden="true"></span><div><span class="eyebrow">먼저 볼 앱</span><strong>'+escape(app.name)+'</strong><p>'+escape(state.reason)+'</p><p class="recommendation-extra">고른 일에 맞춘 순서일 뿐, 실력이나 권한과는 상관없어요.</p><span class="recommendation-stage">'+escape(statusLabel(client(state.selected)))+'</span></div><button class="ghost-button" data-personal-app="'+state.selected+'">'+(app.stage==='planned'?'준비 중인 것 보기':'앱 보기')+' '+icon('arrow-right')+'</button>';}
}
function applyPersonalization(){const saved=personal.current({appIds:displayLibraryAppIds(library)});personalState=sessionPurpose&&library.owner===sessionPurposeOwner?previewPurpose(saved,sessionPurpose,displayLibraryAppIds(library)):saved;document.documentElement.dataset.textSize=personalState.presentation.textSize;document.documentElement.dataset.explanation=personalState.presentation.explanation;document.documentElement.dataset.motion=personalState.presentation.motion;renderPersonalization();}
function openPersonalization(){if(!library.owner)return;const state=personalState;const values=state.values||{};$('personal-context').value=state.context||'everyday';$('personal-goal').value=values.goal||'explore';$('personal-text').value=values.textSize||'standard';$('personal-explanation').value=values.explanation||'standard';$('personal-motion').value=values.motion||'full';$('personal-consent').checked=state.active&&!state.sessionOnly;$('personal-message').textContent=state.error||'';$('personal-dialog').showModal();}
for(const id of ['personal-open','personal-settings-open'])$(id).addEventListener('click',openPersonalization);
$('personal-context').addEventListener('change',()=>{$('personal-goal').value=CONTEXTS[$('personal-context').value]?.goal||'explore';});
$('personal-form').addEventListener('submit',event=>{event.preventDefault();if(!library.owner)return;try{personal.save({context:$('personal-context').value,goal:$('personal-goal').value,textSize:$('personal-text').value,explanation:$('personal-explanation').value,motion:$('personal-motion').value,consent:$('personal-consent').checked===true});sessionPurpose=null;applyPersonalization();renderLibrary();$('personal-dialog').close();toast('앱 순서와 보기 설정을 저장했어요.');}catch(error){$('personal-message').textContent=error.message;}});
$('personal-skip').addEventListener('click',()=>{$('personal-dialog').close();});
$('personal-clear').addEventListener('click',()=>{if(!library.owner)return;try{personal.clear();sessionPurpose=null;applyPersonalization();renderLibrary();$('personal-dialog').close();toast('저장한 설정을 지웠어요. 기본 순서로 돌아왔어요.');}catch(error){$('personal-message').textContent=error.message;}});
function windowState(state){$('maximize').setAttribute('aria-label',state?.maximized?'창 크기 복원':'최대화');$('maximize').dataset.maximized=String(!!state?.maximized);}
convenience=mountConvenience({bridge,storage:localStore,apps,getSnapshot:()=>({owner:library.owner,appIds:library.appIds,prefs:effectivePrefs(),environment,auth,clients}),readRoute,applyRoute:route=>showView(route.view,{...route,restore:true}),launchApp:launchFromHome,onToast:toast,onFavorite:toggleFavorite,onMoveFavorite:moveFavorite,onLibrarySearch:()=>{showView('library');openLibrarySearch();},getNotes:query=>[...(memberHome.searchRecords?.(query)||[]).map(row=>({...row,source:'device'})),...(continuity?.searchNotes?.(query)||[]).map(row=>({...row,source:'account'}))],openNote:note=>note.source==='account'?continuity?.openNote?.(note.id):memberHome.focusRecord?.(note.id),onDesktopPreferences:snapshot=>{if(environment)environment.closeToTray=snapshot.preferences?.closeToTray===true&&snapshot.capabilities?.tray===true;}});
platformUpdates=mountPlatformUpdates({bridge,document,getEnvironment:()=>environment,confirmInstall:confirmUpdateInstall});
document.addEventListener('visibilitychange',()=>{if(document.hidden){void memberHome.flushDraft?.();void continuity?.flushDraft?.();}});
async function init(){
  applyPersonalization();reconcileSelection();continuity?.render();renderLibrary();renderSelected();renderDownloads();renderAuth();renderBenefits();showView('home',{restore:true});convenience.refresh();
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
  $('edition').textContent=bridge?'PLATFORM':'PLATFORM / PREVIEW';$('runtime-label').textContent=bridge?`${systemName()} · ${environment?.mode==='release'?'SYNK Platform':'시험판'}`:'브라우저 미리보기';renderAuth();renderActions();renderBenefits();document.documentElement.dataset.ready='true';
}
init().catch(()=>{toast('플랫폼을 준비하지 못했어요. 앱을 다시 열어 주세요.');document.documentElement.dataset.ready='error';});

// Do not retain personal report text while the native window is in the background.
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){memberInsight.setVisible(false);if(selectedBenefit==='insight')renderInsight();}
 else if(view==='benefits'&&selectedBenefit==='insight'){memberInsight.invalidate();void refreshAuth({reload:true}).then(()=>renderBenefits());}
});
window.addEventListener('pagehide',()=>{memberInsight.setVisible(false);if(selectedBenefit==='insight')renderInsight();});
