import {APP_IDS,INSTALLABLE_IDS,APPS,clientRows,matchesLibrary,bytes,statusLabel,primaryAction,installerLabel,progressValue,parsePreferences} from './state.mjs';
import {createPlatformPersonalization,previewPurpose,CONTEXTS,PERSONAL_KEY,PLATFORM_SCOPE} from './personalization.mjs';
import {resolveLibrary,accountStorageKey,visibleSelection,libraryCopy,displayLibraryAppId,displayLibraryAppIds,projectLibraryPreferences} from './library.mjs';
import {MEMBER_BENEFITS,memberBenefit,benefitPreviewAvailable} from './benefits.mjs';
import {createMemberInsight} from './member-insight.mjs';
import {renderMemberInsight} from './member-insight-view.mjs';
import {mountPulseClient} from './pulse-client.mjs';
import {mountMemberHome} from './member-home.mjs';
import {mountPlatformLibrary} from './platform-continuity.mjs';
import {mountConvenience} from './convenience.mjs';
import {mountPlatformUpdates} from './update-view.mjs';
const $=id=>document.getElementById(id),bridge=globalThis.synkDesktop,asset='/assets/launcher/';
const apps=APPS;
const localStore={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)};
let auth={status:bridge?'restoring':'unconfigured',configured:false,signedIn:false},library=resolveLibrary(auth),authRevision=0,ownerEpoch=0;
let personal=createPersonal(),personalState=personal.current({appIds:displayLibraryAppIds(library)});
const games={racing:{name:'한국어 레이싱',image:'racing.jpg',tag:'듣고 이해하며 달리는 레이스',description:'한국어를 듣고 뜻을 이해하며 달리는 레이싱 게임입니다. 질문과 선택지를 듣는 연습을 게임 안에서 진행합니다.'},runner:{name:'바람길',image:'runner.jpg',tag:'짧은 지시를 듣고 움직이기',description:'짧은 한국어 지시를 듣고 길을 선택하는 게임입니다. TOPIK I의 짧은 지시 듣기를 보조하는 연습이며, 게임 기록 자체가 시험 점수나 학습 효과를 입증하지는 않습니다.'},rhythm:{name:'시그널 리듬',image:'rhythm.jpg',tag:'리듬과 함께 한국어에 귀 기울이기',description:'음악과 리듬, 한국어 듣기 활동을 함께 경험하는 게임입니다. 리듬 조작 성적과 한국어 이해도는 서로 다른 기록으로 다룹니다.'}};
let prefs=parsePreferences(readPrefs()),clients=clientRows([],{native:!!bridge}),environment=null,view='home',detail='overview',filter='all',search='',busy=new Set(),toastTimer;
let selectedBenefit=null,environmentRevision=0,sessionPurpose=null,sessionPurposeOwner=null,leaveDecision=null;
let continuity=null,convenience=null,platformUpdates=null;
let accountRetryPending=false,signUpPending=false,signUpOpened=false,pulseLegacyView=false;
const memberInsight=createMemberInsight({getIdentity:()=>auth,request:(operation,params)=>bridge.accountRequest(operation,params),onChange:()=>{if(view==='benefits'&&selectedBenefit==='insight')renderInsight();}});
function renderInsight(){const target=$('benefit-detail'),active=target.contains(document.activeElement),action=document.activeElement?.dataset.insightAction;target.innerHTML=renderMemberInsight(memberInsight.read(),{native:true});if(active)(action?target.querySelector(`[data-insight-action="${action}"]`):target.querySelector('#benefit-title'))?.focus({preventScroll:true});}
const memberHome=mountMemberHome($('view-home'),{storage:localStore,getSnapshot:()=>({library,personal:personalState,prefs:effectivePrefs(),clients:clients.map(row=>client(row.id))}),getAppAction,onLaunch:launchFromHome,onRetry:()=>refreshAuth({reload:true}),onApp:selectApp,onPurpose:choosePurpose,onAccount:()=>$('account-dialog').showModal(),onBenefits:()=>showView('benefits'),onToast:toast});
const pulseClient=mountPulseClient($('pulse-client'),{storage:localStore,getContext:()=>({owner:library.owner,status:library.status}),getFavorite:()=>effectivePrefs().favorites.includes('pulse'),onFavorite:()=>$('favorite').click(),onToast:toast,request:typeof bridge?.pulseRequest==='function'?(operation,params)=>bridge.pulseRequest(operation,params):undefined});
const continuityRoot=document.createElement('aside');continuityRoot.setAttribute('aria-label','계정 라이브러리');$('view-home').before(continuityRoot);
const continuityStyle=document.createElement('link');continuityStyle.rel='stylesheet';continuityStyle.href='./platform-continuity.css';document.head.append(continuityStyle);
continuity=mountPlatformLibrary(continuityRoot,{native:true,getHost:()=>bridge,getAppIds:()=>library.appIds,getDevice:()=>({favorites:prefs.favorites,recent:Object.entries(prefs.lastLaunch).filter(([,at])=>at).map(([id,at])=>({id,at,mode:'client'}))}),onChange:()=>{renderLibrary();renderSelected();memberHome.render();convenience?.refresh();},onOpen:id=>{if(allowed(id))launchFromHome(id);else toast('이 계정의 앱 이용 권한과 설치 상태를 확인해 주세요.');},storage:localStorage});
function effectivePrefs(){const cloud=continuity?.projection();return projectLibraryPreferences(cloud?{...prefs,accountLibrary:true,favorites:cloud.favorites,lastLaunch:Object.fromEntries(cloud.recent.map(row=>[row.entryId||row.id,row.at]))}:prefs,library);}
function recordLaunch(id,mode='client'){if(continuity?.connected()){void continuity.dispatch({type:'launch',id,mode}).catch(error=>toast(error.message));}else{prefs.lastLaunch[id]=Date.now();savePrefs();}}
// Presentation helpers: sprite icons, status LEDs and the device-level night/day theme.
const icon=name=>'<svg class="i" aria-hidden="true"><use href="#i-'+name+'"/></svg>';
const THEME_KEY='synk-platform-theme',THEMES=['night','day','system'];
const benefitWords={insight:'나의 성향',care:'플레저',fortune:'운세',rehearsal:'리허설','family-album':'앨범'};
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
}
async function refreshAuth({reload=false}={}){
  if(!bridge)return;const revision=authRevision;
  try{
    if(reload&&(auth.signedIn||auth.status==='error'&&auth.error?.retryable===true)&&typeof bridge.accountRequest==='function')await bridge.accountRequest('load');
    if(revision!==authRevision)return;
    const snapshot=await bridge.authStatus();if(revision===authRevision){setAuth(snapshot);return authRevision;}
  }catch{if(revision===authRevision){setAuth({...auth,library:{status:'unavailable',appIds:[]},error:{...auth.error,message:'앱 목록을 다시 확인해 주세요.'}});return authRevision;}}
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
  if(!hasUnsavedDrafts())return Promise.resolve(true);
  if(leaveDecision)return Promise.resolve(false);
  $('leave-description').textContent=message;
  $('leave-dialog').returnValue='keep';
  return new Promise(resolve=>{leaveDecision=resolve;$('leave-dialog').showModal();});
}
async function confirmUpdateInstall(){const epoch=ownerEpoch;return await confirmDraftExit('업데이트 설치 전 작성 중인 메모를 저장해 주세요. 돌아가서 저장하거나, 저장하지 않은 메모를 버리고 설치를 진행할 수 있어요.')&&epoch===ownerEpoch&&!hasUnsavedDrafts();}
async function windowAction(action){if(!bridge?.windowAction)return;const epoch=ownerEpoch;if(action==='close'&&environment?.closeToTray!==true&&(!await confirmDraftExit('아직 저장하지 않은 메모가 있어요. 돌아가서 저장하거나, 메모를 버리고 창을 닫을 수 있어요.')||epoch!==ownerEpoch))return;try{await bridge.windowAction(action);}catch{toast('창 상태를 변경하지 못했어요.');}}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5500);}
function errorText(result){const code=result?.code||result?.error?.code;return ({
  RELEASE_UNAVAILABLE:'이 기기에 맞는 배포 파일을 아직 준비하고 있어요.',INVALID_INSTALLATION:'설치된 앱을 확인할 수 없어요. 설치 파일을 다시 준비해 주세요.',NOT_INSTALLED:'앱 설치를 마친 뒤 다시 확인해 주세요.',LAUNCH_FAILED:'앱을 열지 못했어요. 설치 상태를 다시 확인해 주세요.',AUTH_NOT_CONFIGURED:'SYNK ID 연결 설정을 준비하고 있어요.',AUTH_CANCELLED:'로그인을 취소했어요.',PACKAGE_HASH_MISMATCH:'설치 파일 확인에 실패했어요. 다시 준비해 주세요.',PACKAGE_SIZE_MISMATCH:'설치 파일 크기를 확인하지 못했어요. 다시 준비해 주세요.',PACKAGE_NOT_FOUND:'설치 파일을 찾지 못했어요. 플랫폼을 다시 확인해 주세요.',INSTALLER_OPEN_FAILED:'설치 파일을 열지 못했어요. 다시 준비해 주세요.',PREPARATION_CANCELLED:'설치 파일 준비를 취소했어요.',PACKAGE_NOT_READY:'먼저 설치 파일을 준비해 주세요.',PREVIEW_DEVELOPMENT_ONLY:'현재 소스 개발판에서만 미리 볼 수 있어요.',PREVIEW_LAUNCH_FAILED:'앱을 열지 못했어요. 로컬 서비스를 확인해 주세요.',PREVIEW_NOT_IN_LIBRARY:'이 앱의 이용 권한을 다시 확인해 주세요.',UNKNOWN_CLIENT:'앱을 확인할 수 없어요.'})[code]||'요청을 완료하지 못했어요. 잠시 뒤 다시 시도해 주세요.';}
function preserveFocus(render){const el=document.activeElement,key=el?.dataset?.focusKey;render();if(key){const found=[...document.querySelectorAll('[data-focus-key]')].find(node=>node.dataset.focusKey===key);found?.focus({preventScroll:true});}}
function renderLibrary(){
  const prefs=effectivePrefs();
  memberHome.render();
  renderBenefitSearch();
  const sidebarIds=displayLibraryAppIds(library).filter(id=>!memberBenefit(id));
  const copy=libraryCopy({...library,appIds:sidebarIds});
  $('library-count').textContent=String(sidebarIds.length).padStart(2,'0');$('library-caption').textContent=copy.caption;$('library-access-note').textContent=copy.note;
  $('library-empty').hidden=library.appIds.length>0;$('library-empty-title').textContent=copy.title;$('library-empty-description').textContent=copy.description;
  $('library-account').textContent=auth.signedIn?'계정 관리':'로그인 안내';$('library-retry').hidden=library.status!=='unavailable';
  $('personal-entry').hidden=!library.appIds.length;
  preserveFocus(()=>{let count=0;const order=filter==='favorites'?[...new Set([...prefs.favorites,...personalState.order])].filter(allowed):personalState.order;$('app-list').innerHTML=order.filter(id=>sidebarIds.includes(id)).map(id=>{const app=apps[id],row=client(id),favorite=prefs.favorites.includes(id);if(!matchesLibrary(id,{search,filter,favorites:prefs.favorites,client:row,teacherAvailable:allowed('teacher')}))return '';count++;return `<button class="app-item brand-${id} ${prefs.selected===id?'selected':''}" data-app="${id}" data-focus-key="app-${id}" aria-label="${app.name}, ${escape(statusLabel(row))}" aria-pressed="${prefs.selected===id}"><span class="tile" aria-hidden="true">${escape(app.mark)}</span><span class="app-item-copy"><strong>${app.name}</strong><small data-tone="${statusTone(row)}"><span class="led" aria-hidden="true"></span>${escape(statusLabel(row))}</small></span><span class="app-icon-label" aria-hidden="true">${({world:'월드',messenger:'메신저',teacher:'교사',path:'진로',pulse:'PULSE',care:'플레저',fortune:'운세',rehearsal:'리허설','family-album':'가족앨범'})[id]}</span>${favorite?'<span class="favorite-mark" aria-hidden="true">'+icon('star')+'</span>':''}</button>`;}).join('');$('empty-search').hidden=count>0||!sidebarIds.length;});document.querySelectorAll('[data-filter]').forEach(el=>{el.setAttribute('aria-pressed',String(el.dataset.filter===filter));el.hidden=!sidebarIds.length||(el.dataset.filter==='planned'&&!sidebarIds.some(id=>apps[id].stage==='planned'))||(el.dataset.filter==='development'&&!sidebarIds.some(id=>apps[id].stage!=='planned'));});}
function renderSelected(){
  reconcileSelection();pulseClient.syncContext();const app=allowed(prefs.selected)?apps[prefs.selected]:null,isPulse=!!app&&prefs.selected==='pulse'&&pulseLegacyView;$('pulse-client').hidden=!isPulse;$('app-detail').hidden=!app||isPulse;if(isPulse){document.documentElement.dataset.product='pulse';$('brand-scope').textContent=app.brand;$('breadcrumb-app').textContent=app.name;renderActions();pulseClient.render();return;}
  if(!app){document.documentElement.dataset.product='platform';for(const id of ['brand-scope','breadcrumb-app','hero-category','hero-title','hero-description','hero-caption','product-stage','detail-content','action-notice','install-status','install-version','last-launch'])$(id).textContent='';$('hero-art').removeAttribute('src');$('teacher-web-link').hidden=true;$('primary-action').disabled=true;$('primary-action').dataset.action='none';$('teaching-action').hidden=true;renderPersonalization();return;}
document.documentElement.dataset.product=prefs.selected;$('brand-scope').textContent=app.brand;$('breadcrumb-app').textContent=app.name;$('hero').className='hero brand-'+prefs.selected+(app.stage==='planned'||app.stage==='preview'?' expansion':'');$('hero-art').src=asset+app.cover;$('hero-art').alt=app.alt;$('hero-category').textContent=app.category;$('hero-title').innerHTML=heroTitle(app);$('hero-description').textContent=app.description;$('hero-caption').textContent=app.caption;$('product-stage').textContent=app.stage==='planned'?'확장 후보 · 준비 중':app.stage==='preview'?statusLabel(client()):'독립 클라이언트 · 개발판';const contentTab=document.querySelector('[data-detail="content"]');if(contentTab)contentTab.textContent=app.stage==='planned'?'계획 기능':app.stage==='preview'?'MVP 범위':'포함된 콘텐츠';renderActions();renderDetails();renderPersonalization();}
function renderActions(){const prefs=effectivePrefs();if(!allowed(prefs.selected))return;const row=client(),action=getAppAction(prefs.selected),favorite=prefs.favorites.includes(prefs.selected);$('primary-action').textContent=action.label;$('primary-action').disabled=action.disabled;$('primary-action').dataset.action=action.action;$('favorite').setAttribute('aria-pressed',String(favorite));$('favorite').setAttribute('aria-label',favorite?'즐겨찾기에서 제거':'즐겨찾기에 추가');$('install-status').textContent=statusLabel(row);$('install-version').textContent=row?.version||'—';const time=prefs.lastLaunch[prefs.selected];$('last-launch').textContent=time?new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(time)):'기록 없음';
  $('teaching-action').hidden=prefs.selected!=='messenger'||!allowed('teacher');$('teaching-action').disabled=getAppAction('teacher').disabled;
  $('teacher-web-link').hidden=!!bridge||prefs.selected!=='teacher';let notice='';if(action.action==='pulse-app')notice='PULSE 전용 창에서 모델·제작 요청·검토를 이어갑니다. 웹브라우저와는 로그인이 별도입니다.';else if(action.action==='public-web')notice=prefs.selected==='path'?'기본 브라우저에서 실사 면접실을 엽니다. Quest에서는 같은 HTTPS 주소를 열어 한국어 음성과 마이크를 준비해 주세요. 답변은 계정에 저장하지 않습니다.':'기본 브라우저에서 공개 앱을 엽니다. 계정에 보관하려면 열린 앱에서 SYNK ID로 로그인해 주세요.';else if(apps[prefs.selected].stage==='planned')notice=apps[prefs.selected].boundary;else if(prefs.selected==='teacher')notice=apps.teacher.boundary+' '+(bridge?'메신저의 내 수업에서 이어집니다.':'이 컴퓨터의 워크스페이스에서 내 수업을 아래 링크로 열 수 있어요.');else if(apps[prefs.selected].stage==='preview')notice=apps[prefs.selected].boundary+' '+(bridge?'별도 클라이언트 창으로 열립니다.':'소스 개발판의 별도 클라이언트로 미리 볼 수 있어요.');else if(!bridge)notice='브라우저에서는 화면만 미리 볼 수 있어요. 설치와 실행은 SYNK Platform PC 앱에서 진행됩니다.';else if(row?.canLaunch)notice=row.updateAvailable?`새 버전 ${row.latestVersion}을 준비할 수 있어요. 설치·업데이트에서 확인하세요.`:'별도 클라이언트로 실행됩니다.';else if(row?.installer?.status==='preparing')notice=`설치 파일을 준비하고 있어요. ${bytes(row.installer.transferredBytes)} / ${bytes(row.installer.totalBytes)}`;else if(row?.installer?.status==='installer-opened')notice=environment?.platform==='darwin'?'열린 창에서 앱을 Applications 폴더로 옮긴 뒤 “설치 상태 확인”을 눌러 주세요.':'설치 마법사에서 설치를 마친 뒤 “설치 상태 확인”을 눌러 주세요.';else if(row?.installer?.canOpen)notice=environment?.platform==='darwin'?'“설치 시작”을 누르면 DMG가 열립니다. 앱을 Applications 폴더로 옮겨 주세요.':'파일 확인이 끝났어요. “설치 시작”을 누르면 설치 마법사가 열립니다.';else if(row?.installer?.canPrepare)notice=`개발 버전 ${row.latestVersion||''} · 설치 파일 ${bytes(row.installer.totalBytes)} · 이 기기에 별도로 설치합니다.`;else notice='이 기기에 맞는 배포 파일을 준비하고 있어요.';$('action-notice').textContent=notice;
}
function renderDetails(){if(!allowed(prefs.selected)){$('detail-content').innerHTML='';return;}document.querySelectorAll('[data-detail]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.detail===detail)));if(['planned','preview'].includes(apps[prefs.selected].stage)){renderExpansion();return;}const world=prefs.selected==='world';if(detail==='info'){const row=client();$('detail-content').innerHTML=`<dl class="info-grid"><dt>앱</dt><dd>${escape(apps[prefs.selected].name)}</dd><dt>실행 방식</dt><dd>플랫폼과 별도로 설치되는 클라이언트</dd><dt>이 기기</dt><dd>${escape(systemName())}</dd><dt>설치 상태</dt><dd>${escape(statusLabel(row))}</dd><dt>최신 개발 버전</dt><dd>${escape(row?.latestVersion||'배포 준비 중')}</dd><dt>계정</dt><dd>SYNK ID · ${world?'학습 기록은 WORLD 권한으로 연결합니다.':'회사 구성원 연결과 회사 권한이 별도로 필요합니다.'}</dd><dt>현재 배포</dt><dd>개발 미리보기. 정식 서비스 연결과 서명된 배포는 준비 중입니다.</dd></dl>`;return;}
  if(!world){$('detail-content').innerHTML=`<div class="overview-heading"><h2>대화와 작업이 이어지는 곳</h2><span>별도 업무 클라이언트</span></div><p class="product-summary">${escape(apps.messenger.summary)}</p><div class="feature-list">${apps.messenger.features.map((feature,index)=>`<article><span class="feature-number">0${index+1} / WORK</span><h3>${escape(feature[0])}</h3><p>${escape(feature[1])}</p></article>`).join('')}</div><div class="overview-foot"><p>회사 구성원 권한으로 이용합니다. 사내 제작·AI 실습은 이곳에서, 외부 의뢰·창작자 협업은 PULSE에서 이어갑니다.</p><button class="text-link" data-show-detail="info">앱 정보 ${icon('arrow-right')}</button></div>`;return;}
  if(detail==='content'){$('detail-content').innerHTML=`<div class="overview-heading"><h2>WORLD 안의 콘텐츠</h2><span>개발 중인 콘텐츠</span></div><div class="content-list">${Object.entries(games).map(([id,game])=>`<div class="content-row"><h3>${game.name}</h3><p>${game.tag}</p><button class="ghost-button" data-game="${id}">화면 보기 ${icon('arrow-up-right')}</button></div>`).join('')}<div class="content-row"><h3>Town · 숙제 · AI 코칭</h3><p>WORLD의 학습 공간과 계정 흐름에 연결하는 기능입니다. 제공 범위는 WORLD 안에서 확인하세요.</p></div></div>`;return;}
  $('detail-content').innerHTML=`<div class="overview-heading"><h2>게임부터 다음 학습까지</h2><span>WORLD의 핵심 기능</span></div><p class="product-summary">${escape(apps.world.summary)}</p><div class="feature-list">${apps.world.features.map((feature,index)=>`<article><span class="feature-number">0${index+1} / WORLD</span><h3>${escape(feature[0])}</h3><p>${escape(feature[1])}</p>${index===0?Object.entries(games).map(([id,game])=>`<button class="text-link" data-game="${id}" aria-label="${game.name} 개발 화면 보기">${escape(game.name)} ${icon('arrow-up-right')}</button>`).join(''):''}</article>`).join('')}</div><div class="overview-foot"><p>게임별 연습 내용과 현재 제공 범위는 콘텐츠에서 확인하세요.</p><button class="text-link" data-show-detail="content">콘텐츠 모두 보기 ${icon('arrow-right')}</button></div>`;
}
function renderExpansion(){const app=apps[prefs.selected],preview=app.stage==='preview',teacher=prefs.selected==='teacher',stage=preview?statusLabel(client()):'확장 후보 · 준비 중';
  if(prefs.selected==='pulse'){$('detail-content').innerHTML='<div class="overview-heading"><h2>제작을 함께 진행하는 PULSE</h2><span>독립 클라이언트 앱</span></div><p class="product-summary">모델과 포트폴리오를 보고, 제작 요청부터 시안 검토와 승인까지 PULSE 전용 창에서 이어갑니다.</p><div class="feature-list">'+app.features.map((feature,index)=>'<article><span class="feature-number">0'+(index+1)+' / PULSE</span><h3>'+escape(feature[0])+'</h3><p>'+escape(feature[1])+'</p></article>').join('')+'</div><div class="overview-foot"><p>이 PC의 PULSE 창은 고객 연결을 유지합니다. 웹브라우저·설치형 웹앱의 로그인은 별도이며, 제작자 모드는 브라우저에서 열립니다.</p><button class="text-link" data-pulse-legacy="open">이 PC에 저장한 이전 요청 초안 '+icon('arrow-right')+'</button></div>';return;}
  if(detail==='info'){$('detail-content').innerHTML='<dl class="info-grid"><dt>앱</dt><dd>'+escape(app.name)+(teacher?' (가칭)':'')+'</dd><dt>이용 대상</dt><dd>'+escape(app.audience)+'</dd><dt>준비 상태</dt><dd>'+stage+'</dd><dt>실행 방식</dt><dd>'+(teacher?'워크스페이스의 같은 창에서 여는 내 수업':preview?'플랫폼과 분리된 로컬 MVP 클라이언트':'실제 서비스·배포 방식 준비 중')+'</dd><dt>계정과 권한</dt><dd>'+(teacher?'내 수업의 교사 연결에서 SYNK ID와 담당 반을 확인합니다. 회사 자료 권한은 따로 확인합니다.':preview?'플랫폼의 앱 목록은 계정 권한을 따릅니다. 계정 저장과 기기 보관의 현재 범위는 아래 서비스 안내를 확인해 주세요.':'공통 SYNK ID와 제품별 권한을 사용할 계획입니다. 현재 계정·자료 연결은 제공하지 않습니다.')+'</dd><dt>제공 범위</dt><dd>'+escape(memberBenefit(prefs.selected)?.availability||app.boundary)+'</dd></dl>';return;}
  const heading=detail==='content'?(teacher?'내 수업에서 준비하는 흐름':preview?'지금 해볼 수 있는 경험':'계획 중인 기능'):(teacher?'학생의 학습 근거가 수업으로 이어지도록':preview?app.description:'이 공간에서 준비하는 일');
  $('detail-content').innerHTML='<div class="overview-heading"><h2>'+heading+'</h2><span>'+stage+'</span></div><p class="product-summary">'+escape(app.summary)+'</p><div class="audience-line"><span>이용 대상</span><strong>'+escape(app.audience)+'</strong></div><div class="feature-list">'+app.features.map((feature,index)=>'<article><span class="feature-number">0'+(index+1)+' / '+(preview?'MVP':'PLAN')+'</span><h3>'+escape(feature[0])+'</h3><p>'+escape(feature[1])+'</p></article>').join('')+'</div><div class="overview-foot"><p>'+escape(app.boundary)+'</p><button class="text-link" data-show-detail="info">앱 정보 '+icon('arrow-right')+'</button></div>';
}
function downloadButtons(row){const id=row.id,i=row.installer||{},disabled=busy.has(id)?'disabled':'';if(i.status==='preparing')return `<button class="ghost-button" data-command="cancel" data-client="${id}" data-focus-key="cancel-${id}" ${disabled}>취소</button>`;if(i.canOpen)return `<button class="solid-button" data-command="open" data-client="${id}" data-focus-key="open-${id}" ${disabled}>${i.status==='installer-opened'?'설치 다시 열기':'설치 시작'}</button>`;if(i.canPrepare)return `<button class="solid-button" data-command="prepare" data-client="${id}" data-focus-key="prepare-${id}" ${disabled}>${icon('download')}${row.updateAvailable?'업데이트 준비':i.status==='error'?'다시 준비':'설치 파일 준비'}</button>`;return '<span class="field-label">배포 준비 중</span>';}
function renderDownloads(){preserveFocus(()=>{$('download-list').innerHTML=INSTALLABLE_IDS.filter(allowed).map(id=>{const row=client(id)||{id},i=row.installer||{},progress=progressValue(i);return `<article class="download-row brand-${id}"><span class="tile" aria-hidden="true">${escape(apps[id].mark)}</span><div><h2>${apps[id].name}</h2><p>${bridge?escape(installerLabel(i)):'PC 앱에서 설치할 수 있어요'}${row.latestVersion?' · v'+escape(row.latestVersion):''}</p>${i.status==='preparing'?`<progress value="${progress}" max="100" aria-label="${apps[id].name} 설치 파일 준비"></progress><span class="download-bytes">${bytes(i.transferredBytes)} / ${bytes(i.totalBytes)} · ${Math.floor(progress)}%</span>`:i.totalBytes?`<span class="download-bytes">${bytes(i.totalBytes)}</span>`:''}${i.error?`<p>${escape(errorText({code:i.error.code||i.error}))}</p>`:''}</div><div class="download-actions">${bridge?downloadButtons(row):''}</div></article>`;}).join('')||'<p class="download-empty">현재 라이브러리에 설치할 앱이 없어요.</p>';});
  const preparing=clients.filter(row=>allowed(row.id)&&row.installer?.status==='preparing'),ready=clients.filter(row=>allowed(row.id)&&row.installer?.status==='ready');$('queue-count').hidden=!preparing.length&&!ready.length;$('queue-count').textContent=preparing.length+ready.length;$('download-status').textContent=preparing.length?`설치 파일 준비 중 · ${preparing.length}개`:ready.length?`설치 준비 완료 · ${ready.length}개`:'설치 대기 없음';document.querySelector('.footer-progress').hidden=!preparing.length;$('footer-progress-fill').style.width=(preparing.length?progressValue(preparing[0].installer):0)+'%';
}
function systemName(){return environment?`${({win32:'Windows',darwin:'macOS',linux:'Linux'})[environment.platform]||environment.platform} · ${environment.arch}`:'브라우저 미리보기';}
function renderSettings(){renderPersonalization();$('density').value=prefs.density;document.documentElement.classList.toggle('compact',prefs.density==='compact');$('platform-version').textContent=environment?`v${environment.version} · ${systemName()}`:'화면 미리보기';$('diagnostics').innerHTML=`<dt>플랫폼 화면</dt><dd>${bridge?'앱에 포함된 로컬 화면':'브라우저 미리보기'}</dd><dt>SYNK ID</dt><dd>${auth.signedIn?'로그인됨':auth.configured?'로그인 가능':'연결 준비 중'}</dd><dt>배포</dt><dd>${environment?.mode==='release'?'정식 배포':'개발 미리보기'}</dd><dt>설치·실행</dt><dd>${bridge?'독립 클라이언트':'PC 앱에서 이용'}</dd>${allowed('pulse')?'<dt>PULSE 이전 초안</dt><dd><button class="text-link" data-pulse-legacy="open">이 PC에 저장한 요청 초안 보기</button></dd>':''}`;}
function renderAuth(){
  const signedIn=auth.signedIn,signing=['signing-in','restoring','signing-out'].includes(auth.status),retryable=!!bridge&&auth.configured&&!signedIn&&!signing&&auth.status==='error'&&auth.error?.retryable===true&&typeof bridge.accountRequest==='function',name=auth.account?.display_name||'SYNK 회원';
  $('account-button').dataset.signedIn=String(!!signedIn);$('account-button').setAttribute('aria-label',signedIn?'SYNK ID 계정 관리':'SYNK ID 로그인');
  $('account-label').textContent=signedIn?name:signing?'로그인 연결 중':'로그인';
  $('account-title').textContent=signedIn?`${name} 님`:signing?'SYNK ID 연결 중':'SYNK 시작하기';
  $('account-description').textContent=signedIn?'같은 SYNK ID를 사용하며 앱별 권한은 따로 적용됩니다.':retryable?'저장된 연결을 다시 확인하거나, 새로 로그인할 수 있어요.':'처음이라면 회원가입, 계정이 있다면 로그인해 주세요.';
  let message=signedIn?'로그인되어 있어요. 각 앱의 접근 권한은 따로 적용됩니다.':!bridge?'회원가입과 로그인은 SYNK Platform PC 앱에서 시작하세요.':!auth.configured?'SYNK ID 서비스 연결을 준비 중입니다. 연결 설정이 완료되면 여기서 로그인할 수 있어요.':signing?'기본 브라우저에서 로그인을 마쳐 주세요.':signUpOpened?'회원가입 페이지를 열었어요. 가입을 마쳤다면 아래 로그인 버튼을 눌러 주세요.':'기본 브라우저에서 회원가입하거나 로그인할 수 있어요.';
  if(auth.error)message+='\n'+(auth.error.message||'로그인을 완료하지 못했어요. 다시 시도해 주세요.');$('account-state').textContent=message;
  for(const id of ['signup-button','sign-up']){$(id).hidden=!!signedIn;$(id).disabled=typeof bridge?.authSignUp!=='function'||signing||signUpPending||accountRetryPending;$(id).textContent=signUpPending?'여는 중…':'회원가입';}
  $('signup-help').hidden=!!signedIn||signing;
  $('account-retry').hidden=!retryable;$('account-retry').disabled=accountRetryPending||signUpPending;
  $('sign-in').textContent=retryable?'새로 로그인':'로그인';$('sign-in').hidden=signedIn||signing;$('sign-in').disabled=!bridge||!auth.configured||accountRetryPending||signUpPending;
  $('sign-out').hidden=!signedIn;$('cancel-sign-in').hidden=auth.status!=='signing-in';$('settings-account').textContent=signedIn?`${name} 님으로 로그인됨`:auth.configured?'로그인하고 앱을 연결하세요.':'SYNK ID 서비스 연결 준비 중';renderSettings();
}
function readRoute(){return {view,appId:prefs.selected,detail,benefitId:selectedBenefit,scroll:$('main').scrollTop,pageScroll:globalThis.scrollY||0};}
function showView(next,{restore=false,...route}={}){if(!['home','library','benefits','downloads','settings'].includes(next))return;if(convenience&&!restore){convenience.navigate({view:next,appId:prefs.selected,...route});return;}view=next;if(view!=='benefits'){memberInsight.setVisible(false);$('benefit-detail').innerHTML='';}if(allowed(route.appId))prefs.selected=route.appId;detail=route.detail||'overview';selectedBenefit=view==='benefits'?route.benefitId||null:null;for(const name of ['home','library','benefits','downloads','settings'])$('view-'+name).hidden=name!==view;document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});if(view==='home'){memberHome.render();$('member-home-title').focus({preventScroll:true});}if(view==='library'){renderLibrary();renderSelected();$('main').focus({preventScroll:true});}if(view==='downloads')renderDownloads();if(view==='settings')renderSettings();if(view==='benefits'){renderBenefits();$(selectedBenefit?'benefit-title':'benefits-title').focus({preventScroll:true});}document.documentElement.dataset.view=view;$('main').scrollTop=route.scroll||0;globalThis.scrollTo?.(0,route.pageScroll||0);}
function canPreviewBenefit(id){return typeof bridge?.openProductPreview==='function'&&benefitPreviewAvailable(id,{native:!!bridge,appIds:library.appIds,productPreviewsAvailable:environment?.productPreviewsAvailable});}
function renderBenefitSearch(){const results=search?MEMBER_BENEFITS.filter(item=>[item.name,item.kicker,item.description,...item.steps.map(step=>step.body)].join(' ').toLowerCase().includes(search)):[];$('benefits-search').hidden=!results.length;$('benefits-search').innerHTML=results.length?'<span class="field-label">회원 혜택 소개</span>'+results.map(item=>'<button data-benefit="'+item.id+'"><strong>'+escape(item.name)+'</strong><small>'+item.statusLabel+' · 소개 보기</small></button>').join(''):'';}
function renderBenefits(){
  memberInsight.setVisible(view==='benefits'&&selectedBenefit==='insight'&&!document.hidden);
  $('benefits-grid').innerHTML=MEMBER_BENEFITS.map((item,index)=>'<article class="benefit-card benefit-'+item.id+' brand-'+item.id+'"><button class="benefit-card-link" data-benefit="'+item.id+'" aria-label="'+escape(item.name)+' 소개 보기"><div class="benefit-card-art"><span class="benefit-number">'+String(index+1).padStart(2,'0')+' / '+String(MEMBER_BENEFITS.length).padStart(2,'0')+'</span><img src="'+asset+item.asset+'" alt="'+escape(item.alt)+'"><span class="benefit-state">'+item.statusLabel+'</span><span class="poster-word" aria-hidden="true" style="--len:'+String(benefitWords[item.id]||item.name).replace(/\s/g,'').length+'">'+escape(benefitWords[item.id]||item.name)+'</span></div><div class="benefit-card-copy"><span class="benefit-kicker">'+escape(item.kicker)+'</span><h3>'+escape(item.name)+'</h3><p>'+escape(item.description)+'</p><span class="benefit-card-cta">소개 보기 '+icon('arrow-right')+'</span></div></button></article>').join('');
  const item=memberBenefit(selectedBenefit);$('benefits-overview').hidden=!!item;$('benefit-detail').hidden=!item;
  if(!item){$('benefit-detail').innerHTML='';return;}
  if(item.id==='insight'){renderInsight();return;}
  const canPreview=canPreviewBenefit(item.id),launchBusy=busy.has(item.id);
  const canOpenPublic=allowed(item.id)&&typeof bridge?.openPublicApp==='function'&&Array.isArray(environment?.publicAppsAvailable)&&environment.publicAppsAvailable.includes(item.id);
  const publicAction=!item.publicUrl?'':bridge?'<button class="primary" data-benefit-public="'+item.id+'" '+(launchBusy||!canOpenPublic?'disabled':'')+'>'+(launchBusy?'여는 중…':'공개 웹에서 시작하기')+' '+icon('arrow-up-right')+'</button>':'<a class="primary" href="'+escape(item.publicUrl)+'" target="_blank" rel="noopener noreferrer">공개 웹에서 시작하기 '+icon('arrow-up-right')+'</a>';
  $('benefit-detail').innerHTML='<button class="text-link benefit-back" data-view="benefits">'+icon('arrow-left')+'회원 혜택 모두 보기</button><header class="benefit-detail-hero benefit-'+item.id+' brand-'+item.id+'"><img src="'+asset+item.asset+'" alt="'+escape(item.alt)+'"><div><span class="eyebrow">SYNK FOR YOU / '+escape(item.name)+'</span><span class="benefit-state">'+item.statusLabel+'</span><h1 id="benefit-title" tabindex="-1">'+escape(item.headline)+'</h1><p>'+escape(item.description)+'</p></div></header><div class="benefit-story"><span class="eyebrow">'+(item.status==='preview'?'지금 준비해 볼 수 있는 경험':'이런 경험을 준비하고 있어요')+'</span><h2>'+escape(item.kicker)+'</h2><ol class="benefit-steps">'+item.steps.map((step,index)=>'<li><span class="benefit-step-number">0'+(index+1)+'</span><div><h3>'+escape(step.title)+'</h3><p>'+escape(step.body)+'</p></div></li>').join('')+'</ol><div class="benefit-availability"><strong>'+item.statusLabel+'</strong><p>'+escape(item.availability)+'</p>'+publicAction+(canPreview?'<button class="primary" data-benefit-preview="'+item.id+'" '+(launchBusy?'disabled':'')+'>'+(launchBusy?'여는 중…':escape(item.name)+' 개발 미리보기 열기')+'</button>':item.status==='preview'?'<p class="benefit-preview-note">개발 미리보기는 이용 권한이 연결된 PC 개발판에서 열 수 있어요.</p>':'')+'</div></div><div class="benefit-next"><span class="eyebrow">함께 살펴보세요</span>'+MEMBER_BENEFITS.filter(other=>other.id!==item.id).map(other=>'<button class="ghost-button" data-benefit="'+other.id+'">'+escape(other.name)+' '+icon('arrow-right')+'</button>').join('')+'</div>';
}
function openBenefit(id){if(!memberBenefit(id))return;showView('benefits',{benefitId:id});}
function selectApp(id,{legacy=false}={}){if(!allowed(id))return;if(id==='pulse'&&!legacy)return command('pulse-app',id);pulseLegacyView=id==='pulse'&&legacy;showView('library',{appId:displayLibraryAppId(id,library),detail:'overview'});savePrefs();}
function setClients(snapshot){if(!Array.isArray(snapshot))return;const previous=clients;clients=clientRows(snapshot,{native:!!bridge});convenience?.clientsChanged(previous,clients);renderLibrary();renderActions();renderDownloads();if(detail==='info')renderDetails();convenience?.refresh();}
async function loadEnvironment(){
  const revision=++environmentRevision,snapshot=await bridge.getEnvironment();
  if(revision===environmentRevision){environment=snapshot;setAuth(auth,{environmentOnly:true});platformUpdates?.refresh();$('runtime-label').textContent=`${systemName()} · ${environment?.mode==='release'?'SYNK Platform':'개발 미리보기'}`;}
  return snapshot;
}
async function refresh(){
  if(!bridge)return;
  const results=await Promise.allSettled([loadEnvironment(),bridge.getClients()]);
  if(results[1].status==='fulfilled')setClients(results[1].value);
  if(results.some(result=>result.status==='rejected'))toast('플랫폼 또는 설치 상태를 확인하지 못했어요. 다시 시도해 주세요.');
}
async function command(action,id=prefs.selected){
  if(action==='pulse-app'){
    if(id!=='pulse'||!allowed(id)||busy.has(id))return;
    if(!bridge){globalThis.location.assign('https://workspace.synk.im/pulse-app/');return;}
    const epoch=ownerEpoch,active=()=>epoch===ownerEpoch&&allowed(id),commandBusy=busy;commandBusy.add(id);memberHome.render();renderActions();
    try{const result=typeof bridge.openPulseApp==='function'?await bridge.openPulseApp():{ok:false,code:'PULSE_APP_UNAVAILABLE'};if(!active())return;if(result?.ok){recordLaunch(id);toast('PULSE를 별도 창으로 열었어요.');}else toast(({PULSE_APP_ACCOUNT_PENDING:'계정 연결을 확인한 뒤 PULSE를 다시 열어 주세요.',PULSE_APP_ACCOUNT_CHANGED:'계정이 바뀌었어요. PULSE를 다시 열어 주세요.',PULSE_APP_STORAGE_UNAVAILABLE:'이전 프로젝트 접근을 정리하지 못했어요. 플랫폼을 다시 시작한 뒤 열어 주세요.',PULSE_APP_UNAVAILABLE:'PULSE 실행 기능을 준비하지 못했어요. 플랫폼을 업데이트한 뒤 다시 열어 주세요.'})[result?.code]||'PULSE를 열지 못했어요. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.');}
    catch{if(active())toast('PULSE를 열지 못했어요. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.');}
    finally{commandBusy.delete(id);if(active()){memberHome.render();renderActions();}}return;
  }
  if(!bridge||!allowed(id)||busy.has(id)||action==='none')return;
  const epoch=ownerEpoch,active=()=>epoch===ownerEpoch&&allowed(id),commandBusy=busy;
  commandBusy.add(id);memberHome.render();renderActions();renderDownloads();renderBenefits();
  try{
    let result;
    if(action==='teacher-preview'){if(id!=='teacher'||typeof bridge.openTeacherPreview!=='function'||environment?.teacherPreviewAvailable!==true)return;result=await bridge.openTeacherPreview();if(active()&&result?.ok){recordLaunch(id);toast('워크스페이스에서 내 수업을 열었어요.');}}
    else if(action==='product-preview'){if(!['path','care','fortune','rehearsal','family-album'].includes(id)||typeof bridge.openProductPreview!=='function'||!Array.isArray(environment?.productPreviewsAvailable)||!environment.productPreviewsAvailable.includes(id))return;result=await bridge.openProductPreview(id);if(active()&&result?.ok){recordLaunch(id);toast(`${apps[id].name} 로컬 MVP를 별도 창으로 열었어요.`);}}
    else if(action==='public-web'){if(!['care','fortune','rehearsal','path'].includes(id)||typeof bridge.openPublicApp!=='function'||!Array.isArray(environment?.publicAppsAvailable)||!environment.publicAppsAvailable.includes(id))return;result=await bridge.openPublicApp(id);if(active()&&result?.ok){recordLaunch(id,'web');toast(`${apps[id].name}을 브라우저에서 열었어요.`);}}
    else if(!INSTALLABLE_IDS.includes(id))return;
    else if(action==='launch'){result=await bridge.launch(id);if(active()&&result.ok){recordLaunch(id);toast(`${apps[id].name} 클라이언트를 열었어요.`);}}
    else if(action==='prepare'){showView('downloads');result=await bridge.prepareClient(id);}
    else if(action==='open'){result=await bridge.openInstaller(id);if(active()&&result.ok)toast(environment?.platform==='darwin'?'앱을 Applications 폴더로 옮긴 뒤 설치 상태를 새로고침해 주세요.':'설치 마법사에서 설치를 마친 뒤 상태를 새로고침해 주세요.');}
    else if(action==='cancel'){result=await bridge.cancelPreparation(id);}
    else if(action==='refresh'){await refresh();return;}
    if(active()&&result?.ok===false)toast(errorText(result));
  }catch{if(active())toast('요청을 완료하지 못했어요. 다시 시도해 주세요.');}
  finally{commandBusy.delete(id);if(active()){await refresh();memberHome.render();renderActions();renderDownloads();renderBenefits();}}
}
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.insightAction==='refresh'){void refreshAuth({reload:true}).then(()=>memberInsight.refresh());return;}else if(button.dataset.insightAction==='account'){if(auth.signedIn)window.open('https://synk.im/account/client.html?product=platform','_blank','noopener,noreferrer');else $('account-dialog').showModal();return;}else if(button.dataset.themeChoice)setTheme(button.dataset.themeChoice);else if(button.dataset.benefit)openBenefit(button.dataset.benefit);else if(button.dataset.benefitPublic)return command('public-web',button.dataset.benefitPublic);else if(button.dataset.benefitPreview){if(canPreviewBenefit(button.dataset.benefitPreview))return command('product-preview',button.dataset.benefitPreview);}else if(button.dataset.pulseLegacy)selectApp('pulse',{legacy:true});else if(button.dataset.app)selectApp(button.dataset.app);else if(button.dataset.personalApp)selectApp(button.dataset.personalApp);else if(button.dataset.view)showView(button.dataset.view);else if(button.dataset.filter){filter=button.dataset.filter;renderLibrary();}else if(button.dataset.detail||button.dataset.showDetail){showView('library',{appId:prefs.selected,detail:button.dataset.detail||button.dataset.showDetail});}else if(button.dataset.command)command(button.dataset.command,button.dataset.client);else if(button.dataset.window)void windowAction(button.dataset.window);else if(button.dataset.game){if(!allowed('world')||prefs.selected!=='world')return;const game=games[button.dataset.game];if(!game)return;$('content-image').src=asset+game.image;$('content-image').alt=game.name+' 개발 화면';$('content-title').textContent=game.name;$('content-description').textContent=game.description;$('content-dialog').showModal();}});
$('brand-home').addEventListener('click',()=>showView('home'));
$('library-search-toggle').addEventListener('click',()=>setMobileSearch(!document.documentElement.classList.contains('library-search-open')));
$('leave-dialog').addEventListener('close',async()=>{const done=leaveDecision;leaveDecision=null;if(!done)return;const discard=$('leave-dialog').returnValue==='discard';if(discard){const clearing=await Promise.allSettled([memberHome.discardDraft(),continuity?.discardDraft(),pulseClient.discard()]);if(clearing.some(result=>result.status==='rejected'||result.value===false)){toast('초안 복구본을 지우지 못했어요. 설정에서 메모 복구를 꺼 주세요.');done(false);return;}}else{if($('account-dialog').open)$('account-dialog').close();if(pulseClient.hasUnsavedChanges()){selectApp('pulse',{legacy:true});pulseClient.openBrief();}else showView('home');if(continuity?.hasUnsavedDraft())continuity.focusDraft();else memberHome.focusDraft();}done(discard);});
$('leave-dialog').addEventListener('cancel',()=>{$('leave-dialog').returnValue='keep';});
window.addEventListener('beforeunload',event=>{if(hasUnsavedDrafts()){event.preventDefault();event.returnValue='';}});
$('search').addEventListener('input',event=>{search=event.target.value.trim().toLowerCase();renderLibrary();});
$('primary-action').addEventListener('click',()=>command($('primary-action').dataset.action));
$('refresh').addEventListener('click',refresh);$('refresh-downloads').addEventListener('click',refresh);
function toggleFavorite(id){if(!allowed(id))return;if(continuity?.connected()){void continuity.dispatch({type:'favorite',id}).catch(error=>toast(error.message));return;}prefs.favorites=effectivePrefs().favorites.includes(id)?prefs.favorites.filter(entry=>displayLibraryAppId(entry,library)!==id):[...prefs.favorites,id];savePrefs();renderLibrary();renderActions();}
function moveFavorite(id,direction){if(!allowed(id)||![-1,1].includes(direction))return;if(continuity?.connected()){void continuity.dispatch({type:'move-favorite',id,direction}).catch(error=>toast(error.message));return;}const rows=effectivePrefs().favorites.filter(allowed),index=rows.indexOf(id),next=index+direction;if(index<0||next<0||next>=rows.length)return;[rows[index],rows[next]]=[rows[next],rows[index]];prefs.favorites=rows;savePrefs();renderLibrary();renderActions();toast('즐겨찾기 순서를 바꿨어요.');}
$('favorite').addEventListener('click',()=>toggleFavorite(prefs.selected));
$('download-shortcut').addEventListener('click',()=>showView('downloads'));$('footer-settings').addEventListener('click',()=>showView('settings'));
for(const id of ['account-button','settings-login','library-account'])$(id).addEventListener('click',()=>$('account-dialog').showModal());
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
$('reset-preferences').addEventListener('click',()=>{prefs=parsePreferences(null);reconcileSelection();filter='all';search='';$('search').value='';savePrefs();renderLibrary();renderSelected();renderSettings();toast('이 기기의 보기 설정을 초기화했어요.');});
$('content-go-world').addEventListener('click',()=>{if(!allowed('world'))return;$('content-dialog').close();selectApp('world');$('primary-action').focus();});
$('sign-in').addEventListener('click',async()=>{
  if(!bridge||!auth.configured||auth.signedIn||['restoring','signing-in','signing-out'].includes(auth.status)||accountRetryPending||signUpPending)return;
  setAuth({...auth,status:'signing-in',signedIn:false,account:null,library:{status:'unavailable',appIds:[]}});const revision=authRevision;
  try{const result=await bridge.authSignIn();if(revision!==authRevision)return;await refreshAuth();if(result?.ok===false&&!auth.signedIn)toast(errorText(result));}
  catch{if(revision===authRevision)setAuth({status:'error',configured:true,signedIn:false,error:{message:'로그인을 시작하지 못했어요. 다시 시도해 주세요.'}});}
});
$('sign-out').addEventListener('click',async()=>{
  if(!bridge||!auth.signedIn)return;const leaveEpoch=ownerEpoch;
  if(!await confirmDraftExit('로그아웃하기 전에 작성 중인 메모를 저장해 주세요. 저장하지 않은 내용은 로그아웃하면 사라져요.')||leaveEpoch!==ownerEpoch||!auth.signedIn)return;
  $('sign-out').disabled=true;
  const signedOutGeneration=Number.isSafeInteger(auth.sessionGeneration)?auth.sessionGeneration+1:null;
  setAuth({status:'signing-out',configured:auth.configured,signedIn:false});const revision=authRevision;
  const sameLogout=()=>revision===authRevision||signedOutGeneration!==null&&auth.sessionGeneration===signedOutGeneration&&auth.status==='signed-out'&&!auth.signedIn;
  try{
    const result=await bridge.authSignOut();if(!sameLogout())return;
    const refreshedRevision=await refreshAuth();
    if((authRevision!==refreshedRevision&&!sameLogout())||auth.status==='signing-in')return;
    if(!auth.signedIn){
      const notice=result?.ok===false?'로그아웃을 완료하지 못했어요. 이 기기의 저장된 로그인 상태를 다시 확인해 주세요.':result?.serverSessionRevoked===false||result?.serverRevoked===false?'이 기기에서 로그아웃했어요. 서버 세션 종료는 연결 후 다시 확인해 주세요.':'로그아웃했어요.';
      const cleanupNotice=result?.draftRecoveryCleanup?.ok===false?' 암호화된 초안 복구본 정리를 확인하지 못했어요. 같은 SYNK ID로 다시 로그인한 뒤 설정에서 초안 복구를 꺼 주세요.':'';
      if($('account-dialog').open)$('account-dialog').close();
      toast(notice+cleanupNotice);
    }
  }catch{if(sameLogout())setAuth({status:'error',configured:auth.configured,signedIn:false,error:{message:'로그아웃 상태를 확인하지 못했어요.'}});}
  finally{$('sign-out').disabled=false;}
});
$('account-retry').addEventListener('click',async()=>{
  if(accountRetryPending||!bridge||typeof bridge.accountRequest!=='function'||!auth.configured||auth.signedIn||auth.status!=='error'||auth.error?.retryable!==true)return;
  accountRetryPending=true;renderAuth();
  let refreshedRevision;
  try{refreshedRevision=await refreshAuth({reload:true});}
  finally{accountRetryPending=false;renderAuth();if(refreshedRevision===authRevision&&auth.status==='error'&&auth.error?.code==='SUITE_UNAVAILABLE')$('account-state').textContent+='\n연결 복구로 재로그인이 필요하다는 안내라면 “새로 로그인”을 선택하세요. 기기 저장 문제라면 저장된 로그인을 유지하고 PC 저장공간·접근 권한을 확인한 뒤 재확인해 주세요.';}
});
$('cancel-sign-in').addEventListener('click',async()=>{const revision=authRevision;try{await bridge.authCancelSignIn();if(revision===authRevision)await refreshAuth();}catch{if(revision===authRevision)toast('로그인 상태를 다시 확인해 주세요.');}});
$('library-retry').addEventListener('click',()=>refreshAuth({reload:true}));
document.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]'))return;if(event.key==='Escape'&&document.documentElement.classList.contains('library-search-open')){event.preventDefault();setMobileSearch(false);}});
window.addEventListener('focus',()=>{refresh();refreshAuth({reload:true});});
function renderPersonalization(){
  const state=personalState;
  $('personal-heading').textContent=state.active?'나에게 맞춘 라이브러리':'무엇부터 시작할까요?';
  $('personal-summary').textContent=state.error||(state.active?'계정에 연결된 앱 안에서 순서와 보기 방식을 맞췄어요.':'지금 필요한 앱만 담았어요. 목적과 보기 방식도 맞출 수 있어요.');
  $('personal-open').textContent=state.active?'맞춤 변경':'맞춤 시작';
  $('personal-settings-summary').textContent=state.sessionOnly?CONTEXTS[state.context].label+' · 이 창에서만 적용 중':state.active?CONTEXTS[state.context].label+' · 이 기기의 '+(auth.signedIn?'내 계정':'로그인 전 보기')+'에 저장됨':'앱 순서와 보기 방식 · 아직 저장하지 않았어요.';
  $('personal-settings-open').disabled=!library.owner;$('personal-open').disabled=!library.owner;
  $('recommendation').hidden=!state.active||!allowed(state.selected);$('recommendation').innerHTML='';
  if(state.active&&allowed(state.selected)){const app=apps[state.selected];$('recommendation').innerHTML='<span class="atlas-dot" aria-hidden="true"></span><div><span class="eyebrow">먼저 살펴볼 공간</span><strong>'+escape(app.name)+'</strong><p>'+escape(state.reason)+'</p><p class="recommendation-extra">이 추천은 스스로 고른 목적에 따른 안내입니다. 실력 평가나 실제 이용 권한을 뜻하지 않아요.</p><span class="recommendation-stage">'+escape(statusLabel(client(state.selected)))+'</span></div><button class="ghost-button" data-personal-app="'+state.selected+'">'+(app.stage==='planned'?'준비 내용 보기':'앱 살펴보기')+' '+icon('arrow-right')+'</button>';}
}
function applyPersonalization(){const saved=personal.current({appIds:displayLibraryAppIds(library)});personalState=sessionPurpose&&library.owner===sessionPurposeOwner?previewPurpose(saved,sessionPurpose,displayLibraryAppIds(library)):saved;document.documentElement.dataset.textSize=personalState.presentation.textSize;document.documentElement.dataset.explanation=personalState.presentation.explanation;document.documentElement.dataset.motion=personalState.presentation.motion;renderPersonalization();}
function openPersonalization(){if(!library.owner)return;const state=personalState;const values=state.values||{};$('personal-context').value=state.context||'everyday';$('personal-goal').value=values.goal||'explore';$('personal-text').value=values.textSize||'standard';$('personal-explanation').value=values.explanation||'standard';$('personal-motion').value=values.motion||'full';$('personal-consent').checked=state.active&&!state.sessionOnly;$('personal-message').textContent=state.error||'';$('personal-dialog').showModal();}
for(const id of ['personal-open','personal-settings-open'])$(id).addEventListener('click',openPersonalization);
$('personal-context').addEventListener('change',()=>{$('personal-goal').value=CONTEXTS[$('personal-context').value]?.goal||'explore';});
$('personal-form').addEventListener('submit',event=>{event.preventDefault();if(!library.owner)return;try{personal.save({context:$('personal-context').value,goal:$('personal-goal').value,textSize:$('personal-text').value,explanation:$('personal-explanation').value,motion:$('personal-motion').value,consent:$('personal-consent').checked===true});sessionPurpose=null;applyPersonalization();renderLibrary();$('personal-dialog').close();toast('이 기기의 맞춤 순서와 보기 설정을 적용했어요.');}catch(error){$('personal-message').textContent=error.message;}});
$('personal-skip').addEventListener('click',()=>{$('personal-dialog').close();});
$('personal-clear').addEventListener('click',()=>{if(!library.owner)return;try{personal.clear();sessionPurpose=null;applyPersonalization();renderLibrary();$('personal-dialog').close();toast('이 기기의 맞춤 설정을 삭제했어요. 기본 순서로 돌아왔습니다.');}catch(error){$('personal-message').textContent=error.message;}});
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
    if(results.some(result=>result.status==='rejected'))toast('일부 상태를 불러오지 못했어요. 새로고침해 주세요.');
    $('window-actions').hidden=!bridge.windowAction;
    if(bridge.getWindowState)bridge.getWindowState().then(windowState).catch(()=>{});bridge.onWindowStateChanged?.(windowState);
  }
  $('edition').textContent=bridge?'PLATFORM':'PLATFORM / PREVIEW';$('runtime-label').textContent=bridge?`${systemName()} · ${environment?.mode==='release'?'SYNK Platform':'개발 미리보기'}`:'브라우저 미리보기';renderAuth();renderActions();renderBenefits();document.documentElement.dataset.ready='true';
}
init().catch(()=>{toast('플랫폼을 준비하지 못했어요. 앱을 다시 열어 주세요.');document.documentElement.dataset.ready='error';});

// Do not retain personal report text while the native window is in the background.
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){memberInsight.setVisible(false);if(selectedBenefit==='insight')renderInsight();}
 else if(view==='benefits'&&selectedBenefit==='insight'){memberInsight.invalidate();void refreshAuth({reload:true}).then(()=>renderBenefits());}
});
window.addEventListener('pagehide',()=>{memberInsight.setVisible(false);if(selectedBenefit==='insight')renderInsight();});
