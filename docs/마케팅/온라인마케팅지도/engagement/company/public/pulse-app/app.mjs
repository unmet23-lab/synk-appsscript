import {request as networkRequest,parseInvite,PulseError,clock,esc} from './api.mjs';
import {refreshCasting,takeCastingValues,syncCastingChoices,readCastingCode,applyCastingItem,castingCodeResult} from './casting-view.mjs';
import {snapshotDeliverableRows,restoreDeliverableRows} from './deliverables-view.mjs';
import {productionUI,feedbackDraftChanged,addProductionDraftReset} from './production-ui.mjs';
import {kickoffSubmission} from './kickoff-view.mjs';
import {previewApprovalState} from './production-context.mjs';
import {strategySaveMessage,strategyUnsavedReviewMessage,strategyReviewState,castingCodeSaveMessage} from './strategy-view.mjs';
import {sceneConfirmation} from './scene-requests-view.mjs';
import {header,headerCrumb,welcome,login,picker,projectView,dialogContent,liveView,headJournal} from './views.mjs';
import {createLiveConnection,projectRevision} from './live.mjs';
import {publicBackend,projectBackend,resumableDraft} from './request-backend.mjs';
import {mountRequestFlow} from './request-flow.mjs';
import {mountEntry,mountRoom,mountDraft,mountDirection,JOURNAL_SHOWN,JOURNAL_SHEET,journalOverlay,journalSetOpen,journalFocus} from './film-views.mjs';
import {mountFilmList,leanData} from './film-home.mjs';
import {mountReview,mountFinal} from './film-review.mjs';
import {draftModel,deskModel,roomState,directionModel,usesRoom,roomTab,roomRoute,journalModel} from './room-view.mjs';
import {PACKAGES,MODEL_LINES} from './request-data.mjs';
import {MODEL_OPTIONAL_CHOICES,personaRefOf} from './casting-choice.mjs';
import {PERSONA_DONE} from './persona-view.mjs';
import {CASTING_MODELS} from './casting-catalog.mjs';
import {withDeviceDeadline,deviceAvailability,deviceConnectionNote,deviceKey,canMigrateDevice,foregroundProjectOptions,rejectedDeviceRegistration,deviceFailureText} from './push.mjs';
import {installationEnvironment,installationGuide,devicePermissionTimeout} from './install.mjs';
import {setLocale,locale,htmlLang,pickLocale,intlLocale,DICTIONARY_LOCALES,t,k} from './i18n.mjs';
import {LOCALE_EVENT,chooseLocale,storedLocale,setOfferedLocales} from './locale-menu.mjs';

// Live project contents, credentials and drafts stay in memory. Only the
// explicitly selected demo persists its own fictional project in localStorage.
// The service worker stores the public shell, never project/API responses.
let initialInvite=new URLSearchParams(location.hash.slice(1)).get('invite')||'';
// 옛 체험의 주소는 ?demo=gift다. 옛 링크와 설치된 PC 앱(허용 목록이 ?demo=coffee만 받는다)을 위해 옛 주소도 같은 체험으로 잇는다.
const demoMode=!initialInvite&&['gift','coffee'].includes(new URLSearchParams(location.search).get('demo'));
const demo=demoMode?(await import('./demo.mjs')).createDemoSession():null;
const request=(path,settings={})=>demo?demo.request(path,settings):networkRequest(path,foregroundProjectOptions(path,settings,document.visibilityState==='visible'));
const openNotificationsOnStart=new URLSearchParams(location.search).get('notifications')==='1';
const staffMode=!demoMode&&new URLSearchParams(location.search).get('mode')==='staff';
// 새 예시(?demo=film)와 바로 의뢰(?start=request · synk.im에서 넘어오는 길). 둘 다 render() 밖 전용 칸에서 돈다.
// 둘 다 처음 한 번만 뜻이 있다 — 예시는 화면 언어가 한국어가 아니면 열지 않고(openFilmDemo), 바로 의뢰는 의뢰서를 닫으면 끝난다(closeFlow). 그 뒤에 다시 붙이는 첫 화면은 쇼릴을 기다리지 않는다.
let filmDemo=!initialInvite&&!demoMode&&!staffMode&&new URLSearchParams(location.search).get('demo')==='film';
let startRequest=!initialInvite&&!demoMode&&!staffMode&&new URLSearchParams(location.search).get('start')==='request';
let initialStaffProject=staffMode?new URLSearchParams(location.search).get('project')||'':'';
const initialStaffTab=staffMode?new URLSearchParams(location.search).get('tab')||'strategy':'strategy';
let initialStaffScene=staffMode?new URLSearchParams(location.search).get('scene')||'':'';
let initialStaffHistory=staffMode?readStaffHistoryTarget(location.search):null;
let pendingInitialScene='';
// 예시는 장면 꼬리(#room 같은 영문 낱말 하나)만 남긴다 — 장면 주소로 바로 열리게(demo-film.mjs가 시작할 때 읽는다).
// 링크의 언어(?lang=)는 주소를 지우기 전에 읽어 둔다. 고르는 것은 시작 흐름이 서버가 허락한 목록 안에서 한다(applyLocale).
const linkLang=String(new URLSearchParams(location.search).get('lang')||'').toLowerCase().slice(0,8);
// 메일의 「?open=mail」(판 4)도 지우기 전에 읽는다 — 첫 화면에서 다시 열기 판을 열어 둔다(applyMailOpen).
const OPEN_MAIL=typeof location!=='undefined'&&new URLSearchParams(location.search).get('open')==='mail';
// 「내 모델」(PULSE 인물 판 4)의 SYNK ID 로그인에서 돌아온 길: 실패면 서버가 /pulse-app/?login=failed로 보낸다 — 주소를 지우기 전에 읽는다(설계 4-2 · 5판 D1).
// 어디로 돌아갈지(내 모델 · 그 고객 방의 모아 두기)는 떠나기 전에 이 창의 sessionStorage에 적어 두고 여기서 한 번 읽고 지운다(30분 안 · 저장소를 못 쓰면 없음).
const LOGIN_FAILED=typeof location!=='undefined'&&new URLSearchParams(location.search).get('login')==='failed';
const MEMBER_RETURN_KEY='synk-pulse-member-return';
let memberReturn=(()=>{try{const raw=sessionStorage.getItem(MEMBER_RETURN_KEY);sessionStorage.removeItem(MEMBER_RETURN_KEY);const value=raw?JSON.parse(raw):null;return value&&['models','keep'].includes(value.to)&&Date.now()-Number(value.at)<1800000?value:null;}catch{return null;}})();
history.replaceState({},'',location.pathname+(demoMode?(/\bElectron\//.test(navigator.userAgent||'')?'?demo=coffee':'?demo=gift'):staffMode?'?mode=staff':filmDemo?'?demo=film'+(/^#[a-z]{2,12}$/.test(location.hash)?location.hash:''):''));
const s={demo:demoMode,demoGuide:null,demoPersistent:true,mode:staffMode?'staff':'customer',user:null,workspace:null,project:null,canEdit:false,csrf:'',tab:'strategy',editor:null,versionId:'',compare:false,showVersion:false,inviteUrl:'',newProject:false,installPrompt:null,error:'',conflict:false,workflow:[],castingCode:null,castingCodeOpen:null};
// PC 앱은 PULSE를 자기 창(Electron)으로 연다. 그 창에서는 설치 안내 단추와 기기 알림 켜기를 두지 않고(views.mjs header·liveView), 기억하기·체험 글은 「이 브라우저」 대신 「이 PC 앱」이라 쓴다.
// 표시는 install.mjs installationEnvironment와 같다. 맨 위에서는 가져온 함수를 부르지 않는다 — 운영 후보의 vm 시험(git 밖 파일 포함)이 import 없이 이 줄까지 돌린다.
s.desktopApp=/\bElectron\//.test(navigator.userAgent||'');
const main=document.querySelector('#main'),dialog=document.querySelector('#app-dialog');
// 첫 화면 · 의뢰서는 film.css 하나로 그린다. 옛 CSS는 직원 화면과 프로젝트를 열 때만 film.css 앞에 꽂고(옛 탭의 폼 · 규격표가 쓴다), 다 읽은 뒤 그린다. 못 읽어도 film.css만으로 그린다.
const LEGACY_CSS=['app.css','casting.css','production.css','preview.css','slate.css','slate-screens.css','slate-legacy.css'];
let legacyCss=null,legacyCssReady=typeof document.createElement!=='function';
function ensureLegacyCss(){
  if(legacyCss)return legacyCss;
  if(legacyCssReady)return legacyCss=Promise.resolve();
  const anchor=document.querySelector('#film-css'),add=(file,after)=>new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href='./'+file;link.onload=link.onerror=()=>resolve();if(anchor){if(after)anchor.after(link);else anchor.before(link);}else document.head.append(link);});
  legacyCss=Promise.all([...LEGACY_CSS.map(file=>add(file,false)),add('film-legacy.css',true)]).then(()=>{legacyCssReady=true;});
  return legacyCss;
}
const wiredMedia=new WeakSet();
const drafts=new Map();let epoch=0,busy=false,loading=false,noticeTimer,leaveAction,confirmAction;
let pendingInvite='',inviteNavigationPrompt=false,inviteNavigationScheduled=false;
// 고객 화면은 프로젝트를 확인하는 동안 「초대 링크 붙여 넣기」 첫 화면 대신 확인 중 표시를 둔다(10-19 검수: 링크를 눌렀는데 붙여 넣기 화면이 먼저 보였다).
let booting=!demo&&!filmDemo;
if(staffMode){document.documentElement?.classList?.remove?.('sx');document.documentElement?.classList?.add?.('is-staff');}
if(staffMode||demoMode||initialInvite)void ensureLegacyCss();
// 연결이 끝나 프로젝트를 닫을 때 쓰던 글을 이 창의 메모리에만 잠시 보관했다가, 같은 프로젝트로 다시 연결되면 되살린다(저장소에는 쓰지 않는다).
let keptDrafts=null;
// 담당자가 「캐스팅북 코드로 채우기」에서 저장을 누른 조합. 저장 알림을 그 조합으로 말하고, 저장 뒤에도 그 글을 칸에 남겨 「지금 저장된 조합」을 그 자리에서 보인다.
let castingCodeSave=null;
// 확인 중 표시는 그릴 때마다 지금 언어로 만든다(언어는 서버 답을 받은 뒤에 정해진다 — 그 전에는 한국어).
// 화면 언어를 정하기 전(서버 답 · 사전을 받기 전)의 첫 그리기는 boot-locale.js가 이 기기의 언어로 바꿔 둔 글을 그대로 쓴다 — 느린 연결의 영어 손님에게 영어 → 한국어 → 영어로 바뀌지 않게(최종 검수 F2).
// 바꾸지 않았으면(한국어) 빈 글자라 지금처럼 t()다. 맨 위에서 가져온 함수를 부르지 않는다(vm 시험).
const bootLoading=(()=>{try{const node=document.querySelector('#main .loading');return document.documentElement?.lang&&document.documentElement.lang!=='ko'&&node?String(node.textContent||'').trim():'';}catch{return '';}})();
let localeChosen=false;
const loadingView=()=>'<div class="loading" role="status"><span class="loading-mark"></span>'+esc(!localeChosen&&bootLoading&&locale()==='ko'?bootLoading:t('프로젝트를 확인하고 있어요.'))+'</div>';
let deviceState=null,deviceBusy=false,deviceOperation=0,deviceRefresh=0;
const deviceMigrations=new Set();
let live=null,liveIdentity='',liveSnapshot=null,pendingRemote=null,autoFetching=false,autoAgain=false,composing=false,applyTimer;
s.live={status:'connecting',notifications:[],unreadCount:0,open:false,pending:false,deviceEnabled:false};
const identity=()=>`${s.mode}:${s.user?.id||'customer'}:${s.project?.id||'new'}`;
const draftKey=form=>[identity(),form.dataset.form,form.dataset.id||form.dataset.messageId||''].join(':');
const latestPreview=()=>s.project?.versions?.filter(v=>v.kind==='preview').at(-1);
const staffPath=(suffix='')=>`/api/client-projects/${encodeURIComponent(s.project.id)}${suffix}`;
const options=()=>({csrf:s.csrf,staff:s.mode==='staff'});
const projectStamp=()=>({epoch,id:s.project?.id,user:s.user?.id});
const current=stamp=>stamp.epoch===epoch&&(!stamp.id||stamp.id===s.project?.id)&&stamp.user===s.user?.id;
const editable=()=>s.project&&(s.mode!=='staff'||s.canEdit);
const hasDraft=type=>Array.from(drafts.entries()).some(([key,entry])=>key.startsWith(identity()+':'+type+':')&&(type!=='round-draft'||feedbackDraftChanged(s.project,entry)));
const production=productionUI({s,mutate,studioAction,notice,remember,request,options,staffPath,accept,current,projectStamp,hasDraft});

// 알림 글은 부르는 자리에서 번역해 넘긴다. 옛 체험(?demo=gift · coffee)은 한국어로만 돌아 그 바꿈 글은 번역하지 않는다.
function notice(message){if(demo&&/의견을 보냈|고객에게|시안을 승인했/.test(message))message='체험 기록에 남겼어요.';const box=document.querySelector('#notice');box.textContent=message;box.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>box.hidden=true,6500);} // i18n-skip
function remember(event){const field=event.target,form=field.closest?.('form[data-form]');if(!form||!field.name||['invite','login'].includes(form.dataset.form))return;const key=draftKey(form),entry=drafts.get(key)||{values:{},revision:0};if(form.dataset.form==='feedback'&&!entry.versionId){entry.versionId=s.versionId||latestPreview()?.id||'';if(entry.versionId)s.versionId=entry.versionId;if(form.elements.action)entry.values.action=form.elements.action.value;}entry.values[field.name]=field.type==='file'?Array.from(field.files||[]):field.type==='checkbox'?Array.from(form.elements).filter(el=>el.name===field.name&&el.checked).map(el=>el.value):field.value;if(form.dataset.form==='deliverables'){entry.deliverableRows=snapshotDeliverableRows(form);entry.values.deliverableRevision??=form.elements.deliverableRevision.value;}if(/^(round-|preview-)/.test(form.dataset.form))entry.boundData??={...form.dataset};entry.revision++;drafts.set(key,entry);if(form.dataset.form==='feedback'&&s.mode!=='staff'){const submit=form.querySelector('button[type=submit]');if(submit&&!busy)submit.disabled=!!(entry.versionId&&entry.versionId!==latestPreview()?.id&&entry.values.action!=='support');}}
function restore(scope=document){for(const form of scope.querySelectorAll('form[data-form]')){const entry=drafts.get(draftKey(form));if(!entry)continue;if(entry.boundData){Object.assign(form.dataset,entry.boundData);addProductionDraftReset(form);}if(form.dataset.form==='deliverables'&&entry.deliverableRows){restoreDeliverableRows(form,entry.deliverableRows);addProductionDraftReset(form);}for(const [name,value] of Object.entries(entry.values)){const fields=Array.from(form.elements).filter(el=>el.name===name);for(const field of fields){if(field.type==='file'){try{const transfer=new DataTransfer();for(const file of value)transfer.items.add(file);field.files=transfer.files;}catch{}}else if(field.type==='checkbox')field.checked=Array.isArray(value)&&value.includes(field.value);else if(field.type==='radio')field.checked=field.value===value;else field.value=value;const details=field.closest('details');if(details)details.open=true;}}const details=form.closest('details');if(details)details.open=true;}}
function clearDraft(key,revision){if(drafts.get(key)?.revision===revision)drafts.delete(key);}
function setBusy(value){busy=value;document.documentElement.classList.toggle('is-busy',value);for(const button of document.querySelectorAll('button[type=submit],[data-mutate]')){if(value){if(button.dataset.wasDisabled===undefined)button.dataset.wasDisabled=String(button.disabled);button.disabled=true;}else if(button.dataset.wasDisabled!==undefined){button.disabled=button.dataset.wasDisabled==='true';delete button.dataset.wasDisabled;}}main.setAttribute('aria-busy',String(value));if(!value){scheduleApply();scheduleInviteNavigation();}}
// 첫 화면이 길어 입장 칸이 화면 밖일 수 있다 — 어느 길로 왔든 새 알림이 나면 그 자리를 보인다. 같은 알림으로 다시 그릴 때는 읽던 자리를 두고 움직이지 않는다.
let shownEntryError=null;
function render({remote=false}={}){if((s.mode==='staff'||s.project)&&!legacyCssReady){void ensureLegacyCss().then(()=>render({remote}));return;}followLocale();loadDesk();syncJournalSeen();s.feedbackDraftVersion=drafts.get([identity(),'feedback',''].join(':'))?.versionId||'';s.feedbackDraftAction=drafts.get([identity(),'feedback',''].join(':'))?.values.action||'';if(demo){s.demoGuide=demo.guide();s.demoPersistent=demo.snapshot().demo.persistent;}const files=remote?Array.from(main.querySelectorAll('input[type=file]')).filter(node=>node.files?.length).map(node=>({node,key:draftKey(node.form),name:node.name})):[];const headBox=document.querySelector('.app-header'),previousFocus=remote&&(main.contains(document.activeElement)||headBox?.contains(document.activeElement))?document.activeElement:null,focusKey=previousFocus?{action:previousFocus.dataset.action,id:previousFocus.dataset.id,tab:previousFocus.dataset.tab,href:previousFocus.getAttribute('href'),room:previousFocus.dataset.roomGo||previousFocus.dataset.roomDo||previousFocus.dataset.draftDo||previousFocus.dataset.journalDo||previousFocus.dataset.journalGo||''}:null;const media=remote||main.querySelector('#review-video')?Array.from(main.querySelectorAll('video,audio')).map(node=>({node,playing:!node.paused,time:node.currentTime})):[],pillarTop=main.querySelector('.sx-dr-right')?.scrollTop||0,journalTop=main.querySelector('[data-journal]')?.scrollTop||0,details=remote?Array.from(main.querySelectorAll('details')).map((node,index)=>node.open?index:-1):[],scroll=remote?{x:scrollX,y:scrollY}:null;document.querySelector('#header-actions').innerHTML=header(s);document.documentElement.classList.toggle('has-room-head',roomCustomer());const crumb=document.querySelector('#header-crumb');if(crumb)crumb.innerHTML=headerCrumb(s);const keepEntry=!!entryHandle&&!s.project&&s.mode!=='staff';if(keepEntry)entryHandle.update({resume:!!s.requestResume,paused:s.intake?.state==='paused'?s.intake:null,entryError:s.entryError||null,busy:booting});else{entryHandle?.unmount();entryHandle=null;main.innerHTML=s.project?projectView(s):booting?loadingView():s.mode==='staff'?(s.user?(s.brands?brandsView():picker(s)):login()):welcome(s);}if(s.project||!s.entryError)shownEntryError=null;else if(s.entryError!==shownEntryError){shownEntryError=s.entryError;main.querySelector('.sx-invite-alert')?.scrollIntoView?.({block:'nearest'});}for(const fresh of media.length?main.querySelectorAll('video,audio'):[]){const index=media.findIndex(old=>old.node.dataset.version===fresh.dataset.version&&old.node.getAttribute('src')===fresh.getAttribute('src')&&old.node.id===fresh.id);if(index!==-1){const old=media.splice(index,1)[0];fresh.replaceWith(old.node);if(old.playing&&old.node.paused)old.node.play().catch(()=>{});}}const pillar=main.querySelector('.sx-dr-right');if(pillar&&pillarTop)pillar.scrollTop=pillarTop;const journalNode=main.querySelector('[data-journal]');if(journalNode&&journalTop)journalNode.scrollTop=journalTop;restore(main);mountScreens();placeTimeline();wireCompare();const strategyForm=main.querySelector('[data-form=strategy]');if(strategyForm)syncCastingChoices(strategyForm,drafts.get(draftKey(strategyForm))?.values);refreshCasting(strategyForm);if(remote){for(const old of files){const form=Array.from(main.querySelectorAll('form[data-form]')).find(node=>draftKey(node)===old.key);const input=form&&Array.from(form.elements).find(node=>node.type==='file'&&node.name===old.name);if(input)input.replaceWith(old.node);}for(const [index,node] of Array.from(main.querySelectorAll('details')).entries())if(details.includes(index))node.open=true;if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});else if(focusKey){const replacement=[...main.querySelectorAll('button,a'),...(headBox?.querySelectorAll('button,a')||[])].find(node=>node.offsetParent!==null&&(focusKey.room?[node.dataset.roomGo,node.dataset.roomDo,node.dataset.draftDo,node.dataset.journalDo,node.dataset.journalGo].includes(focusKey.room):focusKey.action?node.dataset.action===focusKey.action&&node.dataset.id===focusKey.id&&node.dataset.tab===focusKey.tab:focusKey.href&&node.getAttribute('href')===focusKey.href));replacement?.focus({preventScroll:true});}if(scroll)window.scrollTo(scroll.x,scroll.y);}const inviteField=document.querySelector('[name="invite-url"]');if(inviteField)inviteField.readOnly=true;wireMedia();production.render();if(busy)setBusy(true);syncLive();renderLive();focusInitialStaffScene();focusInitialStaffHistory();}
// 슬레이트 판 화면(첫 화면 · 고객 방 · 1차안): 움직임과 듣개는 새로 그린 칸에 붙인다. 같은 화면을 다시 그릴 때는 다시 움직이지 않는다.
let screenKey='',draftHandle=null,entryHandle=null,reviewHandle=null,finalHandle=null,directionHandle=null,resumeChecked=false,entryLocale='';
function mountScreens(){
  draftHandle?.unmount();draftHandle=null;reviewHandle?.unmount();reviewHandle=null;finalHandle?.unmount();finalHandle=null;directionHandle?.unmount();directionHandle=null;
  const entry=main.querySelector('.sx-home'),draft=main.querySelector('.sx-draft'),review=main.querySelector('.sx-review'),room=main.querySelector('.sx-room,.sx-shell');
  const classes=document.documentElement.classList;classes.toggle('view-dr',!!(draft||review));
  const model=draft?draftModel(s.project):null,key=entry?'entry':model?`draft:${model.round}`:room?`room:${s.tab}:${roomState(s.project)}`:'',animate=key!==screenKey;screenKey=key;
  if(animate&&s.journalOpen){s.journalOpen=false;journalOpener=null;}
  // PC 앱 창은 예시 주소로 옮겨 가지 못한다(desktop/src/pulse-app.cjs 허용 목록) — 그 창에서는 제자리에서 연다.
  // 예시 · 의뢰서가 곧바로 위에 열리는 주소(?demo=film · ?start=request)에서는 쇼릴을 받지 않고 기다린다(덮개를 닫으면 그때 붙는다).
  if(entry){if(!entryHandle){entryHandle=mountEntry(main,{animate,onStart:openPublicRequest,onDemo:s.desktopApp?openFilmDemo:null,onModels:()=>openMyModels(),held:!!(filmDemo||startRequest)});entryLocale=locale();mailOpenCheck();modelsEntry();void recheckIntake();}checkResume();watchIntake();}
  if(model)mountDraftScreen(model,animate);
  if(review){const previews=(s.project.versions||[]).filter(v=>v.kind==='preview'),at=previews.findIndex(v=>v.id===(s.versionId||previews.at(-1)?.id)),prior=at>0?previews[at-1]:null;reviewHandle=mountReview(main,{previous:prior?.media?.url?{id:prior.id,src:prior.media.url}:null,onError:()=>{const box=document.querySelector('#video-error');if(box)box.hidden=false;}});}
  if(main.querySelector('[data-final]'))finalHandle=mountFinal(main);
  mountFilmList(main);
  // 방향 제안: 비교 중인 안 · 모델 · 펼친 칸은 s.directionUi에 두어 실시간 다시 그리기에도 남긴다(제안이 바뀌면 새로).
  if(main.querySelector('[data-dp]')){const info=directionModel(s.project);if(info){const key=info.options.map(o=>o.id).join(',');if(s.directionUi?.key!==key)s.directionUi={key};directionHandle=mountDirection(main,info,{ui:s.directionUi,animate});}}
  const headRun=document.querySelector('.app-header .sx-steps-run'),headNow=headRun?.querySelector('.is-now');if(headNow&&headRun.scrollWidth>headRun.clientWidth)headRun.scrollLeft=headNow.offsetLeft-headRun.offsetLeft-(headRun.clientWidth-headNow.offsetWidth)/2;
  if(room)mountRoom(main,{animate,onGo:goRoom,onEdit:()=>openProjectRequest('review'),onContact:()=>openJournal(),onModel:answerModel,onFiles:sendMoreFiles,onPaper:showRoomPaper,onPersona:({decision})=>personaDecide({decision}),onPersonaFiles:sendPersonaFiles,onKeep:()=>keepProject(),onMyModels:()=>openMyModels()});
  // 판 4: 이 방의 「내 모델로 모아 두기」 회원 상태는 프로젝트마다 한 번 읽는다(스위치 · 인물이 없으면 읽지 않는다).
  if(room&&s.keep?.projectId!==s.project?.id&&keepWanted())void loadKeep();
  watchJournal();setJournalOpen(!!s.journalOpen);
}
// 첫 화면의 「내 모델」 입구(판 4): 공개 스위치(myModels)가 켜져 있을 때만 붙인다. 못 읽으면 붙이지 않는다.
function modelsEntry(){if(s.mode!=='customer'||demo||filmDemo)return;const handle=entryHandle;void publicFeatures().then(features=>{if(features?.myModels===true&&handle===entryHandle)handle?.showModels?.();});}
// 쓰던 의뢰서가 있으면 첫 화면 단추가 「이어 쓰기」로 바뀐다. 한 번만 물어본다.
// 접수 상태(운영 조각 3)도 같이 읽는다 — 쉬는 중이고 쓰던 의뢰서가 없으면 단추 자리에 안내가 선다. 둘을 함께 받아 한 번에 그린다(안내가 떴다가 이어 쓰기로 바뀌지 않게).
async function checkResume(){if(resumeChecked||s.mode!=='customer'||demo||filmDemo)return;resumeChecked=true;try{const [{draft},intake]=await Promise.all([networkRequest('/pulse/api/request'),readIntake()]),resume=resumableDraft(draft);if(resume!==!!s.requestResume||intakeKey(intake)!==intakeKey(s.intake)){s.requestResume=resume;s.intake=intake;if(!s.project&&canApplyRemote())render();}}catch{}}
// 공개 접수 상태 {state:'open'} | {state:'paused',until,note,noteEn}. 30초 안에는 다시 묻지 않고, 못 읽으면 열린 것으로 둔다 — 막는 것은 서버다(새 초안 시작 409).
let intakeRead=null,intakeReadAt=0;
function readIntake({fresh=false}={}){if(!intakeRead||fresh||Date.now()-intakeReadAt>30000){intakeReadAt=Date.now();const read=networkRequest('/pulse/api/availability').then(result=>result?.state==='paused'?{state:'paused',until:typeof result.until==='string'?result.until:'',note:typeof result.note==='string'?result.note:'',noteEn:typeof result.noteEn==='string'?result.noteEn:''}:{state:'open'},()=>{if(intakeRead===read)intakeRead=null;return null;});intakeRead=read;}return intakeRead;}
const intakeKey=intake=>intake?.state==='paused'?JSON.stringify([intake.until,intake.note,intake.noteEn]):'';
// 쉬는 안내가 선 첫 화면은 다시 열렸는지 스스로 다시 묻는다 — 안내가 선 화면에는 시작 단추가 없어 새로 물을 계기가 없다(열어 둔 탭 · 다시 띄운 설치 앱이
// 담당자가 다시 받거나 다시 여는 날이 지나도 「쉬어요」에 머물지 않게). 화면으로 돌아올 때 · 첫 화면을 다시 붙일 때 · 보이는 동안 1분마다 묻고, readIntake가 30초 안에는 다시 묻지 않는다.
// 타이머는 안내가 서 있는 동안에만 돈다(열려 있는 화면은 아무것도 묻지 않는다).
let intakeTimer=0;
function watchIntake(){clearTimeout(intakeTimer);intakeTimer=0;if(s.mode==='customer'&&!demo&&!filmDemo&&!s.project&&s.intake?.state==='paused')intakeTimer=setTimeout(()=>{intakeTimer=0;void recheckIntake();},60000);}
async function recheckIntake(){
  if(s.mode!=='customer'||demo||filmDemo||s.project||!entryHandle||s.intake?.state!=='paused')return;
  if(document.hidden||flow||flowOpening){watchIntake();return;}
  const intake=await readIntake();
  // 그릴 수 있을 때만 상태를 바꾼다 — 못 그리는 순간(글 칸에 초점 · 탭 숨김 · 대화상자)에 바꾸면 안내는 남은 채 다시 묻기(쉬는 상태일 때만 돈다)가 멈춘다. 그때는 다음 물음(1분 뒤 · 화면 복귀)에 맡긴다.
  if(intake&&intakeKey(intake)!==intakeKey(s.intake)&&!s.project&&canApplyRemote()){s.intake=intake;render();}
  watchIntake();
}
// 의뢰 흐름 손님(고객 방). 머리 하나 · 묻기 하나 · 영상과 납품 한 화면은 이 손님에게만 — 옛 프로젝트 · 체험 · 직원은 옛 길 그대로.
const roomCustomer=()=>s.mode==='customer'&&!demo&&!!s.project&&usesRoom(s.project);
function goRoom(stage,{versionId=''}={}){
  if(stage==='write'){openProjectRequest();return;}
  if(stage==='journal'||stage==='contact'){openJournal();return;}
  // 단계 id · 옛 탭 이름은 roomTab이 방 화면 하나로 옮긴다. 다른 화면에서 「영상 · 납품」으로 오면 최종본이 있을 때 최종본부터 보인다.
  const view=roomTab(stage);
  if(view==='review'&&!['review','history'].includes(s.tab)&&s.project?.versions?.some(v=>v.kind==='final'))s.versionId='';
  if(versionId)s.versionId=versionId;
  s.tab=view;s.error='';s.journalOpen=false;journalOpener=null;render();
  if(stage==='request')main.querySelector('[data-room-brief]')?.scrollIntoView({block:'start',behavior:'auto'});else if(typeof window.scrollTo==='function')window.scrollTo(0,0);
}
// 방 아래 준비 칸(바뀐 내용 · 준비 자료 · 납품 규격)으로. 영상 화면의 「납품 규격 보기」도 여기로 온다.
// ── 일지(판 3b) ── 한 화면에 하나. 자리(data-place)는 CSS가 정하고, 여기서는 열고 닫기 · 「봤다」 · 알림 이동만 한다.
// 방향 · 완성 광고는 늘 서랍(휴대폰은 시트), 1차안 · 영상은 휴대폰에서만 시트, 방은 늘 흐름 안.
let journalObserver=null,journalOpener=null,journalSeenLater=false;
const journalBox=()=>main.querySelector('[data-journal]');
const seenKey=()=>'pulse-journal-seen:'+identity();
// 본 시각(이 기기): 처음 여는 프로젝트는 지금 일지의 가장 최근 시각에서 시작해 0으로 보인다. 저장이 막히면 늘 0.
function syncJournalSeen(){
  if(!roomCustomer()){s.journalSeenFor='';s.journalSeen=NaN;return;}
  if(s.journalSeenFor===identity())return;
  s.journalSeenFor=identity();let seen=NaN;
  try{const raw=localStorage.getItem(seenKey());if(raw!==null)seen=Number(raw);}catch{}
  if(!Number.isFinite(seen)){seen=journalModel(s.project).latestAt;try{localStorage.setItem(seenKey(),String(seen));}catch{}}
  s.journalSeen=seen;
}
// 일지 줄기가 화면에 들어왔거나 서랍 · 시트를 열면 「봤다」. 머리 숫자는 다시 그리지 않고 그 단추 안만 고친다.
function markJournalSeen({opened=false}={}){
  if(!roomCustomer())return;
  if(!opened&&(document.hidden||document.hasFocus?.()===false)){journalSeenLater=true;return;}
  journalSeenLater=false;const latest=journalModel(s.project).latestAt;
  if(Number.isFinite(s.journalSeen)&&s.journalSeen>=latest)return;
  s.journalSeen=latest;try{localStorage.setItem(seenKey(),String(latest));}catch{}
  const lines=new Set(journalModel(s.project).items.map(item=>item.id)),pair=(s.live.notifications||[]).filter(row=>row.unread&&row.projectId===s.project.id&&(row.messageId&&lines.has('m:'+row.messageId)||row.commentId&&lines.has('c:'+row.commentId))).flatMap(row=>Array.isArray(row.ids)&&row.ids.length?row.ids:[row.id]);
  if(pair.length)Promise.resolve(live?.read(pair)).catch(()=>{});
  const button=document.querySelector('.app-header [data-journal-count]'),box=document.createElement('div');box.innerHTML=headJournal(s);if(button&&box.firstElementChild)button.innerHTML=box.firstElementChild.innerHTML;
}
function watchJournal(){
  journalObserver?.disconnect();journalObserver=null;journalSeenLater=false;
  const box=journalBox();if(!box)return;
  if(journalOverlay(box)){if(s.journalOpen)markJournalSeen();return;}
  if(typeof IntersectionObserver!=='function'){markJournalSeen();return;}
  const list=box.querySelector('.sx-j-pin,.sx-j-list')||box;
  journalObserver=new IntersectionObserver(entries=>{if(!entries.some(entry=>entry.isIntersecting))return;markJournalSeen();journalObserver?.disconnect();journalObserver=null;});
  journalObserver.observe(list);
}
const setJournalOpen=on=>journalSetOpen(main,on);
// 열기: 단이면 일지로 옮겨 묻기 칸에, 서랍 · 시트면 연다. target이 있으면(알림) 그 줄로.
function openJournal({target='',opener=null}={}){
  let box=journalBox();if(!box)return;
  if(target&&!box.querySelector(`[data-journal-id="${CSS.escape(target)}"]`)&&!s.journalAll){s.journalAll=true;render();box=journalBox();if(!box)return;}
  if(journalOverlay(box)){if(!s.journalOpen){journalOpener=opener||document.activeElement;s.journalOpen=true;}setJournalOpen(true);}
  markJournalSeen({opened:true});
  const row=target&&box.querySelector(`[data-journal-id="${CSS.escape(target)}"]`);
  if(row){row.classList.add('notification-target');row.focus({preventScroll:true});row.scrollIntoView?.({block:'center'});setTimeout(()=>row.classList.remove('notification-target'),5000);return;}
  if(!journalOverlay(box))box.scrollIntoView?.({block:'start'});
  journalFocus(box);
}
function closeJournal(){
  if(!s.journalOpen)return;s.journalOpen=false;setJournalOpen(false);
  const back=journalOpener;journalOpener=null;(back?.isConnected?back:document.querySelector('.app-header [data-room-do="journal"]'))?.focus({preventScroll:true});
}
function showRoomPaper(name){s.tab='overview';s.error='';render();const box=main.querySelector(`[data-paper-for="${CSS.escape(name)}"]`);if(box)box.scrollIntoView({block:'start',behavior:'auto'});else if(typeof window.scrollTo==='function')window.scrollTo(0,0);}
function mountDraftScreen(model,animate){
  const key=[identity(),'draft-review',model.round].join(':'),kept=drafts.get(key);
  draftHandle=mountDraft(main,model,{animate,state:kept?.state,at:kept?.at||0,
    onChange:(state,at)=>{if(state.some(item=>item.react||item.note.trim()))drafts.set(key,{values:{},revision:(drafts.get(key)?.revision||0)+1,state,at});else drafts.delete(key);},
    onBack:()=>goRoom('overview'),
    onRecast:()=>openDialog('recast'),
    onSend:state=>{const items=model.cuts.map((cut,i)=>({cut,item:state[i]})).filter(({item})=>item.react).map(({cut,item})=>({sceneId:cut.id,status:item.react==='fix'?'changes':'confirmed',text:item.react==='fix'?item.note.trim():''}));return mutate(()=>studioAction('submit_draft_review',{round:model.round,items}),{message:t('의견을 보냈어요. 반영한 판을 다시 보내 드릴게요.'),after:()=>{drafts.delete(key);s.tab='overview';}});},
    onApprove:state=>{
      // 판 4: 제작이 시작되는 승인에는 취소 · 환불 안내 동의를 함께 보낸다 — 서버가 결제 상태를 아는 판(paymentFlow)일 때만(앞 판 서버는 모르는 칸을 거절한다).
      const terms=model.kind!=='script'&&s.project?.studio?.request?.paymentFlow?{terms:true}:{};
      const send=()=>mutate(()=>studioAction('approve_draft',{round:model.round,...terms}),{message:model.kind==='script'?t('글 콘티를 확인했어요. 장면 이미지를 만들어 보내 드릴게요.'):t('장면 이미지를 확인했어요. 이 컷으로 제작을 시작해요.'),after:()=>{drafts.delete(key);closeDialog();s.tab='overview';}});
      if(model.kind==='script')return send();
      const rest=(state||[]).filter(item=>!item.react).length;
      const photo=s.project?.studio?.request?.answers?.package==='photo';
      confirmAction=send;openDialog('confirm',{title:photo?t('이 첫 장대로 진행할까요?'):t('이대로 제작을 시작할까요?'),text:(rest?t('아직 확인하지 않은 컷 {count}개도 이대로 만들어요.',{count:rest})+' ':'')+(photo?t('이 첫 장과 같은 결로 나머지 장을 만들어요. 결제가 확인되면 시작해요.'):t('이 장면 이미지로 소리와 영상을 만들어요. 장면 이미지는 그 컷의 첫 화면이라, 움직이는 동안 작은 부분은 달라질 수 있어요.')),...(terms.terms?{note:t('제작을 시작한 뒤에는 맞춤 제작이라 환불 대신 패키지 수정 횟수 안에서 고쳐 드리고, 합의와 다르게 만든 부분은 횟수와 상관없이 바로잡아요.'),check:t('이 안내를 확인했어요')}:{}),button:photo?t('이대로 진행'):t('제작 시작')});
    }});
}
// 방향 제안 대화상자의 값을 서버 꼴로. 새 파일은 프로젝트 자료로 먼저 올리고 그 id를 쓴다. 담당자 화면(늘 한국어)이라 번역하지 않는다.
async function uploadStaffMedia(file){const stamp=projectStamp(),result=await request(staffPath('/studio/media'),{...options(),file,headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),'X-Project-Revision':String(s.project.revision)}});if(!current(stamp))throw new PulseError('프로젝트가 바뀌었어요.');accept(result);return result.asset.id;} // i18n-skip
// i18n-skip-start
// 영어 프로젝트의 직원 영어 칸(다국어 판 2): 직원 상태 project.translation이 있을 때만 대화상자에 「…Tr」 칸이 생기고, 보낼 때 서버의 translation 꼴로 묶는다.
// 한국어가 있는 칸에 영어가 비면 보내기 전에 알린다(서버도 409로 막는다). 한국어 프로젝트에는 칸도 묶음도 없다.
const staffLocale=()=>s.mode==='staff'?s.project?.translation||null:null;
const trOf=()=>{const tr=staffLocale();return tr?{tr}:{};};
const trText=value=>String(value??'').trim();
function needEnglish(pairs){const gap=pairs.find(([korean,english])=>trText(korean)&&!trText(english));if(gap)throw new PulseError(`영어 프로젝트예요. 「${gap[2]}」의 영어도 함께 적어 주세요.`);}
const trLines=value=>String(value||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
const trFlowText=line=>{const m=line.match(/^(\d+[:.]\d+)(?:\s+(.*))?$/);return m?trText(m[2]):line;};
// 되묻기: 영어 줄을 한국어 줄과 같은 순서로 맞춘다(「 — 」 뒤는 이유).
function askTranslations(items,english){
  const lines=trLines(english).map(line=>{const [label,...why]=line.split(' — ');return {label:trText(label).slice(0,240),why:trText(why.join(' — ')).slice(0,600)};});
  if(lines.length!==items.length)return {error:'영어도 한국어와 같은 순서로, 같은 줄 수(한 줄에 하나)로 적어 주세요.'};
  const gap=items.findIndex((item,index)=>item.why&&!lines[index].why);
  if(gap>=0)return {error:`${gap+1}번째 줄은 이유가 있어요. 영어 줄에도 「 — 」 뒤에 이유를 적어 주세요.`};
  return {items:items.map((item,index)=>({...item,translation:{label:lines[index].label,...(item.why?{why:lines[index].why}:{})}}))};
}
// 방향 제안: 안마다 이름 · 한 문장 · 흐름(같은 줄 수) · 이유 · 견본 설명의 영어. 파일을 올리기 전에 먼저 다 본다.
function directionTrCheck(values,data){
  needEnglish([[values.lead,values.leadTr,'한 줄 안내']]);
  for(const i of [0,1,2]){
    if(!trText(values['name'+i]))continue;
    const film=!!(values['filmAsset'+i]||data.get('film'+i)?.size),no=`${i+1}안`;
    needEnglish([[values['name'+i],values['nameTr'+i],no+' 이름'],[values['sentence'+i],values['sentenceTr'+i],no+' 한 문장'],[values['why'+i],values['whyTr'+i],no+' 이유'],...(film?[[values['filmNote'+i],values['filmNoteTr'+i],no+' 견본 설명']]:[])]);
    const korean=trLines(values['flow'+i]),english=trLines(values['flowTr'+i]);
    if(english.length!==korean.length)throw new PulseError(`${no} 흐름의 영어를 한국어와 같은 줄 수(${korean.length}줄)로 적어 주세요.`);
    const empty=english.findIndex((line,index)=>trText(korean[index].split(/\s+/).slice(1).join(' '))&&!trFlowText(line));
    if(empty>=0)throw new PulseError(`${no} 흐름 ${empty+1}번째 줄의 영어가 비었어요.`);
  }
}
const directionTrOption=(values,i,flow,film)=>({name:trText(values['nameTr'+i]),sentence:trText(values['sentenceTr'+i]),why:trText(values['whyTr'+i]),...(film?{filmNote:trText(values['filmNoteTr'+i])}:{}),flow:trLines(values['flowTr'+i]).map(trFlowText).slice(0,flow.length)});
// 1차안 보내기 전에 저장할 장면 번역: 손님에게 보일 장면의 제목 · 설명 중 확인한 번역이 없거나 원문이 바뀐 칸(직원 상태의 entries는 원문이 있는 칸만 싣는다).
function sceneTrMissing(scenes){
  const tr=staffLocale();if(!tr)return [];
  const out=[];
  scenes.forEach((scene,index)=>{for(const [part,label]of [['title','이름'],['description','설명']]){const key=`scene:${scene.id}:${part}`,entry=tr.entries?.[key];if(entry&&!(entry.fresh&&entry.status==='reviewed'&&entry.text))out.push({key,label:`장면 ${index+1} ${label}`,source:entry.source,text:entry.text||'',max:entry.max});}});
  return out;
}
// 장면 고치기: 영어 칸을 건드린 것만 보낸다. 한국어만 고치면 옛 영어는 서버에 그대로 남아 「원문이 바뀜」으로 보인다.
function sceneTranslation(form,values){
  const tr=staffLocale(),said={};
  for(const part of ['title','description']){const name=part+'Tr',field=form.elements[name];if(tr&&field&&trText(field.value)!==trText(field.dataset.trOrig))said[part]=trText(values[name]);delete values[name];}
  if(Object.keys(said).length)values.translation=said;
}
// 시안 · 최종본 올리기: 이름 · 사용 안내의 영어(최종본은 사용 안내 영어가 꼭). values의 Tr 칸은 지운다.
function versionTranslation(values){
  const tr=staffLocale(),label=trText(values.labelTr),guide=trText(values.guideTr);delete values.labelTr;delete values.guideTr;
  if(!tr)return null;
  if(values.kind==='final'&&!guide)throw new PulseError('영어 프로젝트예요. 최종본의 사용 안내 영어도 함께 적어 주세요.');
  needEnglish([[values.guide,guide,'메모·사용 안내']]);
  return {label,guide};
}
// i18n-skip-end
async function directionBody(form,values){
  const data=new FormData(form),options=[],tr=staffLocale(),said=[];
  if(tr)directionTrCheck(values,data);
  for(const i of [0,1,2]){
    const name=String(values['name'+i]||'').trim();if(!name)continue;
    const flow=String(values['flow'+i]||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{const [at,...rest]=line.split(/\s+/);return {at,text:rest.join(' ')};});
    const image=data.get('image'+i),film=data.get('film'+i);
    let assetId=values['asset'+i]||'',filmAssetId=values['filmAsset'+i]||'';
    if(image?.size){validateFile(image,{imageOnly:true});assetId=await uploadStaffMedia(image);}
    if(film?.size){validateFile(film);if(!film.type.startsWith('video/'))throw new PulseError('움직임 견본은 MP4 · WebM 영상으로 골라 주세요.');filmAssetId=await uploadStaffMedia(film);} // i18n-skip
    options.push({name,sentence:String(values['sentence'+i]||'').trim(),flow,why:String(values['why'+i]||'').trim(),assetId,...(filmAssetId?{filmAssetId,filmNote:String(values['filmNote'+i]||'').trim()}:{}),...(values['workId'+i]?{workId:String(values['workId'+i]).trim()}:{}),recommended:values.recommended===String(i)});
    if(tr)said.push(directionTrOption(values,i,flow,filmAssetId));
  }
  return {lead:String(values.lead||'').trim(),options,...(values.modelId?{modelId:values.modelId}:{}),price:Number(values.price),dueDate:values.dueDate,revisions:Number(values.revisions),...(tr?{translation:{lead:trText(values.leadTr),options:said}}:{})};
}
const requestFileUpload=(file,slot)=>request('/pulse/api/studio/request-file',{...options(),file,headers:{'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name),'X-Request-Slot':slot}});
function answerModel(values){return mutate(()=>studioAction('answer_model',values),{message:values.accept||values.modelId?t('모델을 정했어요. 글 콘티를 준비해 보내 드릴게요.'):t('담당자에게 전했어요. 다시 제안해 드릴게요.')});}
function sendMoreFiles(list){return mutate(async()=>{let last=null;for(const file of list){last=await requestFileUpload(file,'etc');accept(last);}return last||{};},{message:list.length>1?t('자료 {count}개를 보냈어요.',{count:list.length}):t('자료를 보냈어요.')});}
// 고객 전용 인물(판 3) — 승인 · 고칠 점: 서버가 계산한 지금 차례(awaiting의 종류 · 판 · viewedHash)와 화면이 만든 요청 키를 보낸다.
// 같은 차례 · 같은 결정은 같은 키(두 번 눌러도 한 번 남는다). 그사이 새 판이 왔으면 서버가 409 SYNK_PULSE_PERSONA_STALE — 최신을 다시 읽어 그리고 알린다(쓰던 고칠 점은 남는다).
// 고칠 점 칸에 글이 있으면 승인을 보내지 않는다(그 글을 먼저 보내거나 지우게) — 승인마다 무엇을 확인하는지는 카드의 한 문장이 말한다.
const personaKeys=new Map();
const freshKey=()=>globalThis.crypto?.randomUUID?.()||Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');
const personaKey=(hash,decision)=>{const key=hash+':'+decision;if(!personaKeys.has(key))personaKeys.set(key,freshKey());return personaKeys.get(key);};
async function personaDecide({decision,note='',form=null}){
  if(busy||loading)return false;
  const view=s.project?.persona,want=view?.awaiting;
  // 화면이 아직 옛 차례를 그리고 있으면(입력 중에는 실시간 갱신을 미룬다) 먼저 새로 읽는다.
  if(!want||form&&form.dataset.id!==want.kind){await refresh();return false;}
  if(decision==='approve'){const area=main.querySelector('form[data-form="persona-changes"] textarea');if(area?.value.trim()){notice(t('적으신 고칠 점을 먼저 보내 주세요. 보내지 않으려면 글을 지워 주세요.'));const details=area.closest('details');if(details)details.open=true;area.focus();return false;}}
  const key=form?draftKey(form):'',revision=key?drafts.get(key)?.revision:undefined;let stale=false;
  return mutate(async()=>{
    try{return await request('/pulse/api/persona/approve',{...options(),body:{personaId:view.id,kind:want.kind,revisionId:want.revisionId,viewedHash:want.viewedHash,idempotencyKey:personaKey(want.viewedHash,decision),decision,...(note?{note}:{})}});}
    catch(error){if(error.code!=='SYNK_PULSE_PERSONA_STALE')throw error;stale=true;return request('/pulse/api/project');}
  },{message:()=>stale?t('새 판이 도착했어요. 새 판을 보고 다시 확인해 주세요.'):decision==='changes'?t('고칠 점을 보냈어요. 반영해서 다시 보내 드릴게요.'):t(PERSONA_DONE[want.kind]||PERSONA_DONE.scope),after:()=>{if(!stale&&key)clearDraft(key,revision);}});
}
// 인물 사진 더 보내기(판 3): 프로젝트 자료가 아니라 인물 출처로 간다(초대 링크로 원본이 열리지 않는다). 한 장씩 보내고 응답(손님 보기)을 받는다.
function sendPersonaFiles(purpose,list){return mutate(async()=>{let last=null;for(const file of list){last=await request('/pulse/api/persona/source',{...options(),file,headers:{'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name),'X-Persona-Purpose':purpose}});accept(last);}return last||{};},{message:list.length>1?t('사진 {count}장을 보냈어요.',{count:list.length}):t('사진을 보냈어요.')});}
// 직원 데스크의 맞춤 인물 칸(판 3) — 보낼 칸을 작업마다 고른다. 손님에게 보이는 글은 영어 프로젝트면 같은 이름 + Tr 칸(번역)을 함께 보낸다(빈 영어는 서버가 409로 막는다). 직원 화면이라 한국어다.
const PERSONA_STAFF_TEXT={request_materials:['why'],ask_rights:['why'],withdraw:['why'],send_quote:['scope'],publish_reference:['note'],publish_motion:['note'],set_name:['displayName'],set_usage:['brand','product','purpose','media','regions','period','fee','schedule','note']};
const PERSONA_STAFF_DONE={request_materials:'손님에게 자료를 더 요청했어요.',ask_rights:'동의 확인으로 옮겼어요.',start_review:'검토를 시작했어요.',send_quote:'손님에게 견적을 보냈어요.',publish_reference:'손님에게 기준 얼굴을 보냈어요.',publish_motion:'손님에게 동작 시안을 보냈어요.',withdraw:'요청을 거뒀어요.',retire:'사용을 마쳤어요.',open_revision:'새 판을 열었어요.',remove_asset:'판 파일을 지웠어요.',set_method:'만드는 방식을 적었어요.',set_name:'이름을 적었어요.',note:'내부 메모를 남겼어요.',set_usage:'손님에게 이번 광고 사용 범위를 보냈어요.'}; // i18n-skip
// 직원 방향 대화상자(판 1 후속): 사람 없이 · 맞춤 인물 · 전용 인물이 붙은 의뢰는 카탈로그 모델 없이 보낸다(서버 propose_direction과 같은 판단). 안내 글은 종류마다 다르다.
const deskNoModel=(a,selection)=>personaRefOf(selection?.personaRef)?{noModel:true,noModelKind:'persona'}:MODEL_OPTIONAL_CHOICES.includes(a.modelChoice)?{noModel:true,noModelKind:a.modelChoice}:{noModel:false};
function personaStaffBody(action,values){
  const pick=keys=>Object.fromEntries(keys.map(key=>[key,String(values[key]??'').trim()]));
  const body=action==='send_quote'?{price:Number(String(values.price||'').replace(/[^0-9]/g,'')),days:Number(values.days),revisions:Number(values.revisions),...pick(['scope'])}:action==='publish_reference'||action==='publish_motion'?{revisionId:values.revisionId,...pick(['note'])}:action==='remove_asset'?{revisionId:values.revisionId,assetId:values.assetId}:action==='set_method'?{revisionId:values.revisionId,kind:values.kind,...pick(['base','note'])}:action==='note'?pick(['text']):PERSONA_STAFF_TEXT[action]?pick(PERSONA_STAFF_TEXT[action]):{};
  const said=(PERSONA_STAFF_TEXT[action]||[]).filter(key=>values[key+'Tr']!==undefined);
  if(said.length)body.translation=Object.fromEntries(said.map(key=>[key,String(values[key+'Tr']).trim()]));
  return body;
}
// 의뢰서는 render()가 건드리지 않는 전용 칸에서 돈다. 쓰는 동안 실시간 갱신이 화면을 다시 그리지 않게 하고, 뒤의 화면은 잠근다.
let flow=null,flowOpening=false;
function overlayState(open){if(open)entryHandle?.pause();else entryHandle?.resume();const overlay=document.querySelector('#request-root');overlay.hidden=!open;if(!open)overlay.innerHTML='';for(const node of document.querySelectorAll('.app-header,#main,.skip-link'))node.inert=open;return overlay;}
function closeFlow(){if(!flow)return;flow.unmount();flow=null;startRequest=false;overlayState(false);resumeChecked=false;main.focus?.({preventScroll:true});}
async function openFlow(load,after){
  if(flow||flowOpening)return;flowOpening=true;if(s.journalOpen){s.journalOpen=false;setJournalOpen(false);}
  try{
    const backend=await load();
    // 의뢰서는 그 응답의 허락 언어로 연다. 닫은 뒤의 화면은 그 화면의 허락 언어로 다시 고른다(판 1 검수 F4 — followLocale이 다음 그리기에서).
    if(backend.features)await applyLocale(backend.features);
    localeScreen=null;
    // 보내고 응답을 받지 못한 채 다시 왔을 때: 같은 의뢰로 바로 잇는다.
    if(backend.alreadySent){await backend.submit({});await after();return;}
    flow=mountRequestFlow(overlayState(true),{backend,onRoom:()=>{closeFlow();after();},onExit:()=>{closeFlow();render();}});
  }catch(error){notice(error.message);}finally{flowOpening=false;if(!flow&&startRequest){startRequest=false;entryHandle?.resume();}}
}
// 화면 언어(다국어 판 1 · 2, 기획 12-2 「언어 결정」): 손님 화면만, 서버 응답의 features.locales 안에서 고른다. 직원 화면은 늘 한국어다.
// 맨 위에서 await하지 않는다(app.mjs를 vm으로 읽는 시험) — 시작 흐름이 응답을 받은 뒤 첫 그리기 전에 부른다. 사전을 못 읽으면 한국어로 둔다.
// 허락 언어는 받을 때마다 언어 메뉴에도 넣는다. 허락 밖이면 한국어 · html lang · 메뉴(한국어 하나라 숨김)까지 되돌린다.
// 서버 답을 받지 못했으면(끊긴 채 다시 연 앱 · 프로젝트와 스위치를 못 읽음) 이 기기가 마지막으로 정한 언어와 그때의 허락 목록으로 고른다(켜기 전 후속 · 판 6 F).
// 고른 것 → 마지막으로 정한 언어(그때의 프로젝트 · 링크 · 브라우저 판단) → 링크 → 브라우저 차례이고, 적어 둔 것이 없으면 지금처럼 한국어다. 서버 답으로 정한 언어만 적어 둔다.
// 마지막으로 정한 언어는 이 기기에(localStorage 'pulse-locale-last' — 언어와 허락 목록만, 못 쓰면 없음). 첫 기다림 글(boot-locale.js)도 같은 칸을 읽는다.
// 이 두 함수는 import하지 않고 여기에 둔다 — app.mjs를 import 없이 읽어 돌리는 vm 시험(git 밖 운영 후보 포함)이 맥락에 없는 이름으로 멈추지 않게.
const LAST_LOCALE='pulse-locale-last';
function lastDecision(){try{const value=JSON.parse(localStorage.getItem(LAST_LOCALE)||'null'),allowed=Array.isArray(value?.allowed)?value.allowed.filter(item=>DICTIONARY_LOCALES.includes(item)):[];return DICTIONARY_LOCALES.includes(value?.locale)&&allowed.includes(value.locale)?{locale:value.locale,allowed}:null;}catch{return null;}}
function rememberDecision(loc,allowed){try{const list=(Array.isArray(allowed)?allowed:[]).filter(item=>DICTIONARY_LOCALES.includes(item));if(!list.includes(loc))return;const value=JSON.stringify({locale:loc,allowed:list});if(localStorage.getItem(LAST_LOCALE)!==value)localStorage.setItem(LAST_LOCALE,value);}catch{}}
async function applyLocale(features){
  if(s.mode!=='customer')return;
  const known=!!features&&typeof features==='object',last=known?null:lastDecision();
  const allowed=setOfferedLocales(known?features.locales:last?.allowed);
  const next=pickLocale({chosen:storedLocale(),project:known?features.locale||'':last?.locale||'',link:linkLang,browser:navigator.languages||[],allowed});
  if(next!==locale())await setLocale(next);
  localeChosen=true;
  if(known&&locale()===next)rememberDecision(next,allowed);
  document.documentElement.lang=htmlLang(locale());
  paintShell();
}
// 처음 그리기 전부터 있는 글(index.html의 건너뛰기 · 끊김 알림 · 머리 이름표 · 창 제목)을 지금 언어로. 한국어는 index.html 글 그대로다.
function paintShell(){
  const skip=document.querySelector('.skip-link'),banner=document.querySelector('#connection-banner');
  if(skip)skip.textContent=t('본문으로 건너뛰기');
  if(banner)banner.textContent=t('인터넷 연결이 끊겼어요. 쓰던 내용은 이 화면에 그대로 있어요.');
  document.querySelector('.app-header .brand')?.setAttribute('aria-label',t('PULSE 처음으로'));
  document.title=t('SYNK PULSE — 카메라 앞에서 10년, 배우가 AI 모델을 연출합니다');
}
// 공개 첫 화면(초대 · 프로젝트 없음)의 허락 언어: GET /pulse/api/features를 한 번 읽어 둔다. 못 읽으면 한국어로 두고 다음에 다시 읽는다.
let publicFeaturesRead=null,projectFeatures=null,localeScreen=null;
function publicFeatures(){return publicFeaturesRead||=networkRequest('/pulse/api/features').then(result=>result?.features||null,()=>{publicFeaturesRead=null;return null;});}
// 지금 화면의 허락 언어로 다시 고른다: 프로젝트가 열려 있으면 그 프로젝트 응답의 언어, 아니면 공개 언어. 언어가 바뀌었으면 true.
async function screenLocale(){
  if(s.mode!=='customer'||demo)return false;
  const screen=s.project?.id||'',before=locale();localeScreen=screen;
  const features=s.project?projectFeatures:await publicFeatures();
  if((s.project?.id||'')!==screen)return false;
  await applyLocale(features);
  return locale()!==before;
}
// 프로젝트 응답(accept)에 실린 허락 언어는 받을 때마다 언어 메뉴에 넣는다. 지금 언어가 허락 밖이 되면 다음 그리기에서 다시 고른다(한국어로).
function noteFeatures(features){if(s.mode!=='customer'||!features)return;projectFeatures=features;s.myModelsOn=features.myModels===true;if(!setOfferedLocales(features.locales).includes(locale()))localeScreen=null;}
// 그릴 때마다(render 맨 앞): 화면이 프로젝트 ↔ 첫 화면으로 바뀌었으면 그 화면의 허락 언어로 다시 고르고(판 1 검수 F4 — 연결이 끝나거나 의뢰서를 닫고 돌아온 첫 화면에
// 앞 화면의 영어가 남지 않게), 언어가 바뀐 뒤의 첫 화면은 붙인 칸을 떼어 새 언어로 다시 붙인다(update는 글을 다시 그리지 않는다). 의뢰서 · 예시 덮개가 열린 동안은 그대로 둔다.
function followLocale(){
  localizeEntryError();
  if(flow||flowOpening||filmDemo||models)return;
  if(entryHandle&&entryLocale!==locale()){entryHandle.unmount();entryHandle=null;}
  if(s.mode==='customer'&&!demo&&!booting&&(s.project?.id||'')!==localeScreen)void screenLocale().then(changed=>{if(changed)render();},()=>{});
}
// 입장 알림(s.entryError)은 담는 자리에서 한국어 문장 · 서버 글 그대로 두고, 그릴 때 지금 언어로 옮겨 담는다(언어가 바뀌면 원문에서 다시).
// 담는 자리 하나(connectionExpired)는 번역 틀 없이 그 줄만 도는 시험(pulse-client-care)이 있어 거기서는 틀을 부르지 않는다 — 옮기는 일은 여기 한 곳이다.
function localizeEntryError(){
  const error=s.entryError;if(!error||error.locale===locale())return;
  const source=error.source||{title:error.title,text:error.text};
  s.entryError={title:t(source.title),text:t(source.text),source,locale:locale()};
}
// 접수를 쉬는 동안(운영 조각 3): 쓰던 초안이 없으면 의뢰서를 열지 않고 첫 화면의 안내로 보낸다(바로 의뢰 주소 ?start=request · 오래 열어 둔 화면). 쓰던 초안은 그대로 연다.
async function openBackend(settings){
  const [backend,intake]=await Promise.all([publicBackend(settings),readIntake({fresh:true})]);
  if(intake?.state==='paused'&&!backend.hasDraft){if(backend.features)await applyLocale(backend.features);s.intake=intake;s.requestResume=false;if(!s.project&&canApplyRemote())render();throw new PulseError(t('지금은 잠시 접수를 쉬어요. 다시 열리면 이 화면에서 바로 시작하실 수 있어요.'),409,'SYNK_PULSE_INTAKE_PAUSED');}
  if(intake&&intakeKey(intake)!==intakeKey(s.intake))s.intake=intake;
  return backend;
}
function openPublicRequest(settings){return openFlow(()=>openBackend(settings),async()=>{resetContext();s.user=null;s.workspace=null;s.csrf='';booting=true;render();await start('');});}
// ── 「내 모델」(PULSE 인물 판 4, 설계 판4_설계_20261110.md 5-1 ~ 5-4) ──
// 회원 경로(/api/customer/pulse/*)는 초대 세션과 따로 돈다: 여기의 401은 「SYNK ID로 로그인」이라 mutate(401 → 프로젝트 닫기)를 거치지 않고, 데모 · 직원 화면에서는 부르지 않는다.
// 화면 모듈(my-models.mjs)은 스위치 myModels가 켜진 뒤 처음 열 때 읽는다 — 꺼져 있으면 손님 앱이 판 4 전과 같은 파일만 받는다.
let models=null,modelsOpening=false;
const memberApi=()=>import('./my-models.mjs');
function rememberMemberReturn(value){try{sessionStorage.setItem(MEMBER_RETURN_KEY,JSON.stringify({...value,at:Date.now()}));}catch{}}
function closeMyModels(){if(!models)return;models.unmount();models=null;overlayState(false);main.focus?.({preventScroll:true});}
async function openMyModels({loginFailed=false}={}){
  if(s.mode!=='customer'||demo||models||modelsOpening||flow||flowOpening)return;modelsOpening=true;if(s.journalOpen){s.journalOpen=false;setJournalOpen(false);}
  try{
    const {mountMyModels}=await memberApi();
    models=mountMyModels(overlayState(true),{loginFailed,onExit:()=>{closeMyModels();render();},onNotice:notice,onLogin:()=>rememberMemberReturn({to:'models'}),onRequest:requestWithModel});
  }catch(error){notice(error.message);}finally{modelsOpening=false;}
}
// 「이 모델로 의뢰」: 공개 의뢰서 초안(없으면 만든다)에 그 인물을 붙인 뒤 의뢰서를 그 초안으로 연다. 붙이지 못하면 내 모델 화면에 까닭을 보인다.
async function requestWithModel({workspace,card,csrf,fail}){
  try{
    const {attachToDraft}=await memberApi();
    await attachToDraft({workspaceId:workspace.id,personaId:card.id,revisionId:card.revisionId,csrf});
    closeMyModels();await openPublicRequest({personaPick:{name:card.name||'',image:card.image||''}});
  }catch(error){fail?.(error.message||t('지금은 이 모델로 의뢰할 수 없어요. 잠시 뒤 다시 시도해 주세요.'));}
}
// 고객 방의 「내 모델로 모아 두기」(설계 5-1): 이 방에서 만드는 인물이 있고 스위치가 켜져 있을 때만. 증표(workspace-state)로 이 프로젝트의 브랜드 · 내 회원 여부 · 기다리는 요청을 읽는다.
// 다시 쓰기 방(persona.mode 'reuse')은 서버에 묻지 않고 「내 모델 열기」 한 줄만 둔다(기억한 기기는 첫 화면 대신 방이 열려 입구가 없다).
// 내 모델로 맡긴 의뢰(answers.modelChoice 'persona')인데 서버가 인물을 싣지 않은 방 — 연결 확인 전이거나, 사용 중지 · 기한이 지나 그 모델을 지금 쓸 수 없을 때 —
// 도 그 한 줄을 둔다. 인물 그림 · 확인은 서버 판단대로 보이지 않고(초대 링크는 브랜드 회원 확인이 아니다), 까닭은 내 모델의 회색 카드가 말한다(켜기 전 후속 11-11).
const reuseAsked=()=>s.project?.studio?.request?.answers?.modelChoice==='persona';
const keepWanted=()=>s.mode==='customer'&&!demo&&!!s.project&&projectFeatures?.myModels===true&&usesRoom(s.project)&&(!!s.project.persona||reuseAsked());
const reuseRoom=()=>s.project?.persona?.mode==='reuse'||!s.project?.persona&&reuseAsked();
const keepOf=state=>state.member?{state:'member',name:state.workspace?.name||''}:state.pending?{state:'pending'}:{state:'ask'};
function setKeep(projectId,next){if(s.project?.id!==projectId)return;s.keep={projectId,...next};if(canApplyRemote())render({remote:true});}
async function memberSession(){return networkRequest('/api/customer/pulse/session');}
async function projectKeepState(session){
  const {proof}=await request('/pulse/api/project/workspace-proof',{...options(),body:{purpose:'workspace-state'}});
  return networkRequest('/api/customer/pulse/project-state',{member:true,csrf:session.csrfToken,body:{proof}});
}
// 읽기 차례표: 나중에 시작한 일(다시 읽기 · 모아 두기 요청)이 있으면 앞서 읽던 결과는 버린다 — 로그인에서 돌아온 직후 방이 여는 읽기가 요청 중(busy) 상태를 덮지 않게(판 4 화면 검수 A2).
let keepTicket=0;
async function loadKeep(){
  if(!keepWanted())return;const projectId=s.project.id,ticket=++keepTicket;s.keep={projectId,state:null};
  const put=next=>{if(ticket===keepTicket)setKeep(projectId,next);};
  if(reuseRoom()){await null;put({state:'reuse'});return;}
  try{
    const session=await memberSession();
    if(s.project?.id!==projectId)return;
    if(!session.authenticated){put(session.loginAvailable===false?{state:null}:{state:'login'});return;}
    put(keepOf(await projectKeepState(session)));
  }catch{put({state:null});/* 회원 상태를 못 읽으면 단추를 두지 않는다(다음에 방을 열 때 다시 읽는다) */}
}
// 누르면: 로그인 전이면 돌아올 곳을 적고 SYNK ID 로그인으로, 로그인했으면 증표(workspace-claim)로 연결 · 합류 요청. 로그인에서 돌아오면(auto) 같은 일을 이어 한다.
async function keepProject({auto=false}={}){
  if(!keepWanted()||reuseRoom()||s.keep?.state==='busy')return;
  const projectId=s.project.id;keepTicket++;
  setKeep(projectId,{state:'busy'});
  try{
    const session=await memberSession();
    if(!session.authenticated){
      if(auto||session.loginAvailable===false){setKeep(projectId,{state:'login'});if(session.loginAvailable===false)notice(t('지금은 SYNK ID 로그인을 쓸 수 없어요. 잠시 뒤 다시 열어 주세요.'));return;}
      rememberMemberReturn({to:'keep',projectId});
      const {authorizationUrl}=await networkRequest('/api/customer/pulse/login',{body:{}}),url=new URL(authorizationUrl);
      if(url.protocol!=='https:'||url.username||url.password)throw new PulseError(t('로그인을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.'));
      location.assign(url.href);return;
    }
    const state=await projectKeepState(session);
    if(state.member||state.pending){setKeep(projectId,keepOf(state));return;}
    const {proof}=await request('/pulse/api/project/workspace-proof',{...options(),body:{purpose:'workspace-claim'}});
    await networkRequest('/api/customer/pulse/claim',{member:true,csrf:session.csrfToken,body:{proof}});
    setKeep(projectId,{state:'pending'});notice(t('모아 두기를 요청했어요. 담당자가 확인하면 내 모델에서 브랜드를 보실 수 있어요.'));
  }catch(error){notice(error.message||t('지금은 요청하지 못했어요. 잠시 뒤 다시 시도해 주세요.'));void loadKeep();/* 앞 상태로 되돌리지 않고 지금 상태를 다시 읽는다 */}
}
// 로그인에서 돌아온 뒤(첫 연결이 끝난 다음 한 번): 내 모델이면 그 화면을, 모아 두기면 같은 고객 방에서 요청을 이어 한다. 실패로 돌아왔으면 그 자리에서 알린다.
async function resumeMemberReturn(){
  const back=memberReturn;memberReturn=null;
  if(!back&&!LOGIN_FAILED||s.mode!=='customer'||demo)return;
  if(back?.to==='keep'&&s.project?.id===back.projectId){if(LOGIN_FAILED){notice(t('SYNK ID 로그인을 마치지 못했어요. 다시 시도해 주세요.'));void loadKeep();return;}await keepProject({auto:true});return;}
  const features=s.project?projectFeatures:await publicFeatures();
  if(features?.myModels===true)await openMyModels({loginFailed:LOGIN_FAILED});
}
function openProjectRequest(step=''){return openFlow(async()=>projectBackend({project:()=>s.project,csrf:()=>s.csrf,accept,step,features:()=>projectFeatures}),async()=>{s.tab='overview';s.error='';render();if(typeof window.scrollTo==='function')window.scrollTo(0,0);});}
// 예시(?demo=film)는 한국어로만 연다(다국어 판 2 — 예시는 번역하지 않는다). 화면 언어가 한국어가 아니면 주소로 와도 첫 화면으로 간다.
// 한국어 말고는 고를 수 없는 손님(고른 것 · 링크 · 브라우저가 모두 한국어)은 서버 답을 기다리지 않고 바로 연다.
async function openFilmDemo(){
  if(filmDemo&&pickLocale({chosen:storedLocale(),link:linkLang,browser:navigator.languages||[],allowed:DICTIONARY_LOCALES})!=='ko')await screenLocale();
  if(locale()!=='ko'){if(filmDemo)leaveFilmDemo();return;}
  try{await ensureLegacyCss();const {mountFilmDemo}=await import('./demo-film.mjs');document.documentElement.classList.add('has-demo-nav');const overlay=overlayState(true);overlay.innerHTML='<div></div>';mountFilmDemo(overlay.firstElementChild,{onLeave:()=>location.assign('./')});}catch(error){notice(error.message);}}
// 예시를 열지 않을 때: 주소에서 예시를 지우고 처음 온 손님처럼 연다(기억한 기기면 그 프로젝트, 아니면 첫 화면).
function leaveFilmDemo(){filmDemo=false;history.replaceState({},'',location.pathname);entryHandle?.unmount();entryHandle=null;booting=true;render();void start('');}
// 내부 확인 화면은 직원이 그 탭을 열 때만 불러온다(손님 묶음에 넣지 않는다). 직원 화면이라 번역하지 않는다.
let deskLoading=null;
function loadDesk(){if(s.mode!=='staff'||s.tab!=='desk'||s.deskView||deskLoading)return;deskLoading=import('./desk-view.mjs').then(module=>{s.deskView=module.deskView;deskLoading=null;render();}).catch(()=>{deskLoading=null;notice('내부 확인 화면을 불러오지 못했어요. 새로 고쳐 주세요.');});} // i18n-skip
// i18n-skip-start
// 직원 「고객 브랜드」 데스크(PULSE 인물 판 4, brand-desk-view.mjs): 머리의 「고객 브랜드」에서 연다. 화면 모듈은 처음 열 때 읽는다(직원 화면이라 한국어).
// 직원 경로(/api/customer-workspaces/*)는 스위치와 상관없이 열린다(끈 동안에도 중지 · 삭제 · 정리 — 설계 5판 D15). 쓰기는 근거 한 줄을 꼭 받는다.
let brandViewLoading=null;
const brandsView=()=>s.brandView?s.brandView(s.brands,{top:s.error?`<div class="sx-alert" role="alert"><strong>처리하지 못했어요.</strong><div>${esc(s.error)}</div></div>`:'',projects:s.workspace?.projects||[]}):'<div class="loading" role="status"><span class="loading-mark"></span>고객 브랜드를 불러오고 있어요.</div>';
async function loadBrands(){
  if(!s.brands)return;
  brandViewLoading||=import('./brand-desk-view.mjs').then(module=>{s.brandView=module.brandDesk;});
  await brandViewLoading;
  const list=await request('/api/customer-workspaces',options());if(!s.brands)return;s.brands.list=list;
  const pick=s.brands.pick;
  if(pick?.kind==='workspace'){const detail=await request(`/api/customer-workspaces/${encodeURIComponent(pick.id)}`,options());if(s.brands?.pick===pick)s.brands.detail=detail;}
}
async function openBrands(pick=null){
  s.brands={list:s.brands?.list||null,pick,detail:null};s.error='';render();
  try{await loadBrands();}catch(error){if(error.status===401){connectionExpired();return;}notice(error.message);}
  if(s.brands)render();
}
// 보내고 나면 목록(과 고른 브랜드)을 다시 읽는다. 실패해도 다시 읽어 지금 상태를 보인다(쓰던 근거는 남는다).
// failed는 실패 때 더 읽을 것 — 프로젝트 잇기는 직원 프로젝트 목록의 판을 쓰므로 그 목록도 다시 읽는다(판 4 화면 최종 검수 F2: 낡은 판으로 409가 되풀이되지 않게).
async function brandAct(path,body,{form,message,after,failed}={}){
  if(busy||loading||!s.brands)return;
  const key=form?draftKey(form):'',revision=drafts.get(key)?.revision;setBusy(true);
  try{const result=await request(path,{...options(),body});if(key)clearDraft(key,revision);after?.(result);s.error='';try{await loadBrands();}catch{}render();notice(typeof message==='function'?message(result):message);}
  catch(error){if(error.status===401){connectionExpired();return;}s.error=error.message;try{await loadBrands();}catch{}try{await failed?.();}catch{}render();notice(error.message);}
  finally{setBusy(false);}
}
// 이번 광고 사용 범위 칸과 그 영어 칸(영어 프로젝트만 — 빈 영어 칸은 보내지 않는다).
const BRAND_USAGE=['brand','product','purpose','media','regions','period','fee','schedule','note'];
// 사용 범위 「메모」의 폼 칸 이름은 usageNote다(근거 한 줄 note와 겹치지 않게 — brand-desk-view.mjs usageField).
const usageFieldOf=key=>key==='note'?'usageNote':key;
function brandUsage(values){
  const usage=Object.fromEntries(BRAND_USAGE.map(key=>[key,String(values[usageFieldOf(key)]??'').trim()]));
  const said=BRAND_USAGE.filter(key=>String(values[usageFieldOf(key)+'Tr']??'').trim());
  return {usage,...(said.length?{translation:Object.fromEntries(said.map(key=>[key,String(values[usageFieldOf(key)+'Tr']).trim()]))}:{})};
}
const BRAND_DONE={approve:'연결 요청을 승인했어요.',reject:'연결 요청을 거절했어요.',set_role:'회원 역할을 바꿨어요.',remove_member:'회원에서 뺐어요.',close:'브랜드를 닫았어요.',reopen:'브랜드를 다시 열었어요.',link:'프로젝트를 이 브랜드에 이었어요.',unlink:'프로젝트 연결을 끊었어요.',confirm_request:'연결을 확인하고 이번 광고 사용 범위를 손님에게 보냈어요.',set_usage:'사용 범위를 고쳐 손님에게 다시 보냈어요.',pause:'사용을 멈췄어요.',unpause:'사용 중지를 풀었어요. 다시 쓰려면 브랜드 관리자가 보관 동의를 새로 해야 해요.',unassign:'인물 귀속을 취소했어요.',delete:'인물을 지웠어요.',delete_continue:'삭제를 마쳤어요.'};
function brandSubmit(type,form,values){
  const note=String(values.note||'').trim();
  if(type==='brand-claim'){const decision=form.dataset.decision,body={action:decision,note};if(decision==='approve'){if(values.mode)body.mode=values.mode;if(values.mode==='new')body.name=String(values.name||'').trim();if(values.mode==='existing'&&values.workspaceId)body.workspaceId=values.workspaceId;if(values.role)body.role=values.role;}
    return brandAct(`/api/customer-workspaces/claims/${encodeURIComponent(form.dataset.claim)}`,body,{form,message:BRAND_DONE[decision],after:result=>{if(decision==='approve'&&result.workspace?.id){s.brands.pick={kind:'workspace',id:result.workspace.id};s.brands.detail=null;}}});}
  if(type==='brand-workspace'){const action=form.dataset.actionName;return brandAct(`/api/customer-workspaces/${encodeURIComponent(form.dataset.workspace)}`,{action,revision:Number(form.dataset.revision),...(form.dataset.member?{memberId:form.dataset.member}:{}),...(action==='set_role'?{role:values.role}:{}),note},{form,message:BRAND_DONE[action]});}
  if(type==='brand-project'){
    const action=form.dataset.actionName,projectId=action==='link'?values.projectId:form.dataset.project;
    const revision=action==='link'?(s.workspace?.projects||[]).find(row=>row.id===projectId)?.revision:Number(form.dataset.revision);
    const body={action,revision,note,...(action==='link'?{workspaceId:s.brands.pick?.id}:{}),...(['confirm_request','set_usage'].includes(action)?brandUsage(values):{})};
    return brandAct(`/api/customer-workspaces/projects/${encodeURIComponent(projectId||'')}`,body,{form,message:BRAND_DONE[action],after:()=>{if(action==='link'||action==='unlink')void loadWorkspace().catch(()=>{});},failed:action==='link'?loadWorkspace:null});
  }
  if(type==='brand-persona'){const action=form.dataset.actionName;return brandAct(`/api/customer-workspaces/personas/${encodeURIComponent(form.dataset.persona)}`,{action,revision:Number(form.dataset.revision),note},{form,message:result=>result.retry?`기록은 지웠고 파일 ${result.pendingUnlink||0}개가 남았어요. 잠시 뒤 「삭제 이어 하기」를 눌러 주세요.`:BRAND_DONE[action]});}
}
// i18n-skip-end
// 05 영상 확인: 의견 점을 영상 길이에 맞춰 타임라인에 놓고, 재생 위치 선이 따라간다(위치는 CSSOM으로만 — 페이지 CSP가 style 속성을 막는다).
function placeTimeline(){const video=main.querySelector('#review-video'),track=main.querySelector('[data-timeline] .timeline-track');if(!video||!track)return;const head=track.querySelector('.timeline-head'),pct=t=>Math.min(100,Math.max(0,t/video.duration*100))+'%';
  // 시간 글자가 40px 안으로 붙으면 앞 점의 글자만 보인다(10-19 검수: 「0:020:03」).
  const declutter=()=>{const width=track.getBoundingClientRect().width;if(!width||!Number.isFinite(video.duration)||video.duration<=0)return;let last=-Infinity;for(const mark of Array.from(track.querySelectorAll('.timeline-mark')).sort((a,b)=>Number(a.dataset.seconds)-Number(b.dataset.seconds))){const x=(Number(mark.dataset.seconds)||0)/video.duration*width;const crowded=x-last<40;mark.classList.toggle('is-crowded',crowded);if(!crowded)last=x;}};
  const place=()=>{if(!Number.isFinite(video.duration)||video.duration<=0)return;for(const mark of track.querySelectorAll('.timeline-mark'))mark.style.left=pct(Number(mark.dataset.seconds)||0);if(head)head.style.left=pct(video.currentTime);track.classList.add('is-ready');declutter();};
  if(video.readyState>=1)place();else video.addEventListener('loadedmetadata',place,{once:true});video.addEventListener('timeupdate',()=>{if(head&&track.classList.contains('is-ready'))head.style.left=pct(video.currentTime);});
  if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(declutter);observer.observe(track);}}
// 이전 시안과 비교: 두 영상을 함께 재생·멈춤·이동한다(소리는 왼쪽 영상만).
const compareWiring=new WeakMap();
function wireCompare(){const videos=Array.from(main.querySelectorAll('.compare-grid video'));if(videos.length!==2)return;const [a,b]=videos;if(compareWiring.get(a)?.partner===b)return;for(const node of [a,b])compareWiring.get(node)?.controller.abort();const controller=new AbortController();compareWiring.set(a,{partner:b,controller});compareWiring.set(b,{partner:a,controller});b.muted=true;let lock=false;const follow=(source,target)=>{for(const type of ['play','pause','seeked'])source.addEventListener(type,()=>{if(lock)return;lock=true;try{if(type==='play'){if(Math.abs(target.currentTime-source.currentTime)>0.2)target.currentTime=source.currentTime;target.play().catch(()=>{});}else if(type==='pause')target.pause();else if(Math.abs(target.currentTime-source.currentTime)>0.2)target.currentTime=source.currentTime;}finally{setTimeout(()=>{lock=false;},0);}},{signal:controller.signal});};follow(a,b);follow(b,a);}
// 의견 초안을 쓰기 시작하면 보던 장면에서 멈추고 그 시간을 넣는다(Frame.io 방식). 이미 적힌 시간은 건드리지 않는다.
document.addEventListener('focusin',event=>{const area=event.target;if(!area?.matches?.('form[data-form="round-draft"] textarea[name="text"]'))return;const field=area.form?.elements?.seconds,video=document.querySelector('#review-video');if(!field||!video||field.value!==''||!(video.currentTime>0))return;video.pause();field.value=String(Math.round(video.currentTime*10)/10);field.dispatchEvent(new Event('input',{bubbles:true}));},true);
// 장면·콘셉트·참고 그림과 현황판의 지금 할 일 그림·시안은 자르지 않고 다 보인다(11-02) — 세로면 칸에 .is-portrait를 단다.
// 실시간 갱신은 옛 영상 노드를 새로 그린 칸에 다시 끼우므로, 잴 때마다 지금 칸을 찾고 이미 단 노드도 다시 잰다.
const FIT_BOXES='.scene-image,.concept-image,.reference-media,.focus-media',measuring=new WeakSet();
function fitBox(media){if(!media.closest(FIT_BOXES))return;const video=media.tagName==='VIDEO',fit=()=>media.closest(FIT_BOXES)?.classList.toggle('is-portrait',video?media.videoHeight>media.videoWidth*1.05:media.naturalHeight>media.naturalWidth*1.05);if(video?media.readyState>=1:media.complete&&media.naturalWidth)fit();else if(!measuring.has(media)){measuring.add(media);media.addEventListener(video?'loadedmetadata':'load',()=>{measuring.delete(media);fit();},{once:true});}}
function wireMedia(){for(const media of main.querySelectorAll('video,img')){fitBox(media);if(wiredMedia.has(media))continue;wiredMedia.add(media);media.addEventListener('error',()=>{if(media.id==='review-video'){const error=document.querySelector('#video-error');if(error)error.hidden=false;}else if(media.tagName==='IMG'&&!media.closest('.welcome-art')){media.hidden=true;const parent=media.closest('[data-action=image]');if(parent){parent.disabled=true;parent.textContent=t('이미지를 불러오지 못했어요');parent.classList.add('empty-visual');}}},{once:true});}}
function openDialog(type,item={}){if(dialog.open)dialog.close();dialog.dataset.installGuide=String(type==='install');dialog.className=type==='image'?'app-dialog image-dialog':'app-dialog';dialog.innerHTML=(demo?'<p class="demo-dialog-note">체험이라 실제 의뢰나 승인으로 이어지지 않아요.</p>':'')+dialogContent(type,item);restore(dialog);dialog.showModal();} // i18n-skip
function closeDialog(){if(dialog.open)dialog.close();scheduleApply();}
function showMutationError(message){
  if(!dialog.open)return;
  let alert=dialog.querySelector('[data-mutation-error]');
  if(!alert){alert=document.createElement('p');alert.className='inline-alert';alert.dataset.mutationError='true';alert.setAttribute('role','alert');alert.tabIndex=-1;dialog.prepend(alert);}
  alert.textContent=message;alert.focus({preventScroll:true});alert.scrollIntoView({block:'nearest'});
}
function installEnvironment(){return installationEnvironment({userAgent:navigator.userAgent,platform:navigator.platform,maxTouchPoints:navigator.maxTouchPoints,standalone:matchMedia('(display-mode: standalone)').matches||navigator.standalone,secure:window.isSecureContext});}
function showInstallGuide(){openDialog('install',{guide:installationGuide(installEnvironment(),{connected:!demo&&!!(s.project||s.user),enabled:s.live.deviceEnabled,canPrompt:!!s.installPrompt}),installed:!!s.installed});dialog.dataset.installGuide='true';}
function updateInstallGuide(){document.querySelector('#header-actions').innerHTML=header(s);if(dialog.open&&dialog.dataset.installGuide==='true')showInstallGuide();}
// Reused PWA windows can receive a new invitation without a page reload.
// Keep the capability only in memory while an edit or request finishes.
function cancelInviteNavigation(){pendingInvite='';if(inviteNavigationPrompt)leaveAction=null;inviteNavigationPrompt=false;}
function queueInviteNavigation(){
  const params=new URLSearchParams(location.hash.slice(1));if(!params.has('invite'))return;
  const invite=parseInvite(params.get('invite'));history.replaceState({},'',location.pathname+location.search);
  if(!invite){notice(t('받은 초대 링크를 다시 확인해 주세요.'));return;}
  pendingInvite=invite;
  if(busy||loading||dialog.open||composing)notice(t('새 초대 링크를 받았어요. 하던 일을 마치면 연결할게요.'));
  scheduleInviteNavigation();
}
function scheduleInviteNavigation(){
  if(!pendingInvite||inviteNavigationScheduled)return;inviteNavigationScheduled=true;
  queueMicrotask(()=>{inviteNavigationScheduled=false;if(!pendingInvite||inviteNavigationPrompt||busy||loading||dialog.open||composing)return;
    inviteNavigationPrompt=!!drafts.size;
    withLeave(()=>{inviteNavigationPrompt=false;const invite=pendingInvite;pendingInvite='';if(!invite)return;
      if(demo||s.mode!=='customer'){location.assign(location.pathname+'#invite='+encodeURIComponent(invite));return;}
      resetContext();s.user=null;s.workspace=null;s.csrf='';booting=true;render();void start(invite);
    });
  });
}
function withLeave(action){if(busy||loading){notice(t('처리 중이에요. 끝난 뒤 이동해 주세요.'));return;}if(drafts.size){leaveAction=action;openDialog('leave');}else action();}
function resetContext({preserveInvite=false}={}){loading=false;s.journalOpen=false;s.journalAll=false;s.journalSeenFor='';journalOpener=null;production.reset();pendingInitialScene='';if(!preserveInvite)cancelInviteNavigation();live?.stop();live=null;liveIdentity='';liveSnapshot=null;deviceState=null;deviceOperation++;deviceRefresh++;deviceBusy=false;s.live.deviceBusy=false;setBusy(false);epoch++;drafts.clear();pendingRemote=null;closeDialog();Object.assign(s,{project:null,canEdit:false,editor:null,versionId:'',compare:false,showVersion:false,inviteUrl:'',error:'',conflict:false,workflow:[],historyTarget:null,notificationCommentId:null,tab:'strategy',castingCode:null,castingCodeOpen:null});castingCodeSave=null;s.brands=null;}
function accept(result){noteFeatures(result.features);if(!result.project&&result.id&&Number.isFinite(result.revision))result={...result,project:result};if(result.project&&!result.project.studio&&result.project.id===s.project?.id)result.project.studio=s.project.studio;if(result.csrf)s.csrf=result.csrf;if(result.csrfToken)s.csrf=result.csrfToken;if(result.project){if(!s.project&&s.mode==='customer'&&!demo)s.tab='overview';else if(!s.project&&s.mode==='staff'&&result.project.studio?.request&&['received','planning'].includes(result.project.stage))s.tab='desk';else if(!s.project&&!result.project.studio?.strategy?.revision){const versions=result.project.versions||[];if(versions.some(v=>v.kind==='final')&&result.project.stage==='delivered')s.tab='history';else if(versions.some(v=>v.kind==='preview'))s.tab='review';}s.project=result.project;if(!s.project.studio)s.project.studio={preferences:{},assets:[],references:[],concepts:[],scenes:[],sceneReviews:[],comments:[]};if(result.canEdit!==undefined)s.canEdit=!!result.canEdit;}}
function renderLive(){const box=document.querySelector('#pulse-live');if(!box)return;box.hidden=!!demo||!(s.project||s.user);if(box.hidden)return;const active=box.contains(document.activeElement)?document.activeElement.dataset?.id:null;box.innerHTML=liveView(s);if(active)Array.from(box.querySelectorAll('[data-action=open-notification]')).find(node=>node.dataset.id===active)?.focus({preventScroll:true});const badge=document.querySelector('[data-action=notifications]');if(badge){badge.textContent=s.live.unreadCount?t('알림 {count}',{count:s.live.unreadCount}):t('알림');badge.setAttribute('aria-expanded',String(s.live.open));}}
function syncLive(){if(demo)return;const key=s.mode==='staff'?(s.user?`staff:${s.user.id}`:''):(s.project?`customer:${s.project.id}`:'');if(key===liveIdentity)return;live?.stop();live=null;liveIdentity=key;liveSnapshot=null;pendingRemote=null;deviceState=null;s.live={...s.live,deviceEnabled:false,deviceReady:false,deviceNote:t('기기 알림 상태를 확인하고 있어요.'),deviceIssue:'',deviceProgress:'',deviceUncertain:false,notifications:[],unreadCount:0,open:openNotificationsOnStart,pending:false,status:'connecting'};if(!key)return;refreshDevice();live=createLiveConnection({mode:s.mode,request,options,onSnapshot:snapshot=>{if(key!==liveIdentity)return;if((s.mode==='staff'&&snapshot.userId&&snapshot.userId!==s.user?.id)||(s.mode==='customer'&&snapshot.projectId&&snapshot.projectId!==s.project?.id)){connectionExpired();return;}liveSnapshot=snapshot;s.live.notifications=snapshot.notifications||[];s.live.unreadCount=snapshot.unreadCount||0;renderLive();fetchRemote();},onFresh:items=>{if(key!==liveIdentity)return;notice(items.length===1?items[0].title:t('새 알림 {count}개가 도착했어요.',{count:items.length}));},onStatus:status=>{s.live.status=status;renderLive();},onExpired:connectionExpired});}
const devicePath=()=>s.mode==='staff'?'/api/pulse-device-notifications':'/pulse/api/device-notifications';
const deviceScope=()=>'/pulse-app/push-'+s.mode+'/';
function pushSupport(){return deviceAvailability({...installEnvironment(),serviceWorker:'serviceWorker' in navigator,pushManager:'PushManager' in window,notification:'Notification' in window,permission:globalThis.Notification?.permission});}
async function deviceRequest(path,settings={}){const controller=new AbortController();return withDeviceDeadline(request(path,{...settings,signal:controller.signal}),{onTimeout:()=>controller.abort()});}
async function localPush(){return withDeviceDeadline((async()=>{const registration=await navigator.serviceWorker.getRegistration(deviceScope());if(!registration||new URL(registration.scope).pathname!==deviceScope())return {registration:null,subscription:null,hash:''};const subscription=await registration.pushManager.getSubscription();const digest=subscription?await crypto.subtle.digest('SHA-256',new TextEncoder().encode(subscription.endpoint)):null;return {registration,subscription,hash:digest?Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join(''):''};})());}
// 「이 기기 기억하기」: 서버가 알려 준 기억 상태를 보이고, 아직 아니면 현황판에 한 번 제안한다(닫으면 이 프로젝트에서는 다시 안 묻는다).
const rememberDismissKey=()=>'synk-pulse-remember-dismissed:'+(s.project?.id||'');
function rememberDismissed(){try{return localStorage.getItem(rememberDismissKey())==='1';}catch{return false;}}
function applyRemember(server){if(s.mode!=='customer'||demo)return;const before=s.rememberOffer;s.live.rememberKnown=true;s.live.remembered=!!server?.deviceConnection?.remembered;s.rememberOffer=!s.live.remembered&&!rememberDismissed();if(before!==s.rememberOffer&&s.tab==='overview'&&canApplyRemote())render({remote:true});}
async function refreshDevice(){
  const key=liveIdentity,requestEpoch=epoch,refreshId=++deviceRefresh,csrf=s.csrf,mode=s.mode,path=devicePath();
  if(!key||demo||deviceBusy)return;
  const valid=()=>key===liveIdentity&&requestEpoch===epoch&&refreshId===deviceRefresh&&csrf===s.csrf;
  const unsupported=pushSupport();
  if(unsupported){s.live.deviceEnabled=false;s.live.deviceNote=unsupported;s.live.deviceReady=false;if(mode==='customer'){try{const server=await deviceRequest(path);if(valid())applyRemember(server);}catch{}}renderLive();return;}
  try{
    let [server,local]=await Promise.all([deviceRequest(path),localPush()]);if(!valid())return;
    const existing=server.subscriptions?.find(item=>item.endpointHash===local.hash),migrationKey=key+':'+local.hash;
    // Carry forward only this recipient's previously explicit device opt-in.
    // Browser permission or a subscription belonging to someone else is not consent.
    if(canMigrateDevice({mode,server,local,permission:Notification.permission})&&!deviceMigrations.has(migrationKey)){
      deviceMigrations.add(migrationKey);
      // 기기 이름표(label)는 서버에 저장하는 값이라 번역하지 않는다.
      try{await deviceRequest(path,{csrf,body:{subscription:local.subscription.toJSON(),label:existing.label||'PULSE · 고객 · 내 브라우저'}});if(!valid())return;server=await deviceRequest(path);if(!valid())return;} // i18n-skip
      catch(error){deviceMigrations.delete(migrationKey);if(!valid())return;s.live.deviceIssue=t('기억한 기기 연결을 새로 하지 못했어요. 알림함을 다시 열면 다시 해 볼게요.');}
    }
    deviceState={server,local};applyRemember(server);
    const row=server.subscriptions?.find(item=>item.endpointHash===local.hash);
    s.live.deviceEnabled=!!(server.configured&&row?.enabled&&row.currentSession&&Notification.permission==='granted');
    if(s.live.deviceUncertain&&s.live.deviceEnabled&&(mode==='staff'||server.deviceConnection?.remembered)){s.live.deviceUncertain=false;s.live.deviceIssue='';notice(t('이 기기의 PULSE 알림 연결을 확인했어요.'));}
    s.live.deviceReady=!!server.configured;
    s.live.deviceNote=deviceConnectionNote({mode:s.mode,enabled:s.live.deviceEnabled,configured:server.configured,connection:server.deviceConnection});
    if(s.mode==='customer'&&s.live.deviceEnabled&&server.deviceConnection?.remembered&&server.deviceConnection.expiresAt)s.live.deviceNote+=' '+t('지금 연결은 {date}까지예요.',{date:new Date(server.deviceConnection.expiresAt).toLocaleString(intlLocale(locale()))});
    renderLive();
  }catch(error){if(valid()){s.live.deviceReady=false;s.live.deviceNote=error.message;renderLive();}}
}
async function activePushRegistration(registration){if(registration.active)return registration;const worker=registration.installing||registration.waiting;if(!worker)throw new PulseError(t('기기 알림을 준비하지 못했어요. 다시 시도해 주세요.'));await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker.removeEventListener('statechange',check);reject(new PulseError(t('기기 알림 준비가 늦어지고 있어요. 다시 시도해 주세요.')));},12000);function check(){if(worker.state==='activated'||worker.state==='redundant'){clearTimeout(timer);worker.removeEventListener('statechange',check);worker.state==='activated'?resolve():reject(new PulseError(t('기기 알림을 준비하지 못했어요.')));}}worker.addEventListener('statechange',check);check();});return registration;}
async function enableDeviceNotices(){
  if(deviceBusy||!deviceState||!s.live.deviceReady)return;
  const key=liveIdentity,csrf=s.csrf,requestEpoch=epoch,operation=++deviceOperation,state=deviceState,mode=s.mode,path=devicePath(),scope=deviceScope(),disabling=s.live.deviceEnabled;
  const valid=()=>operation===deviceOperation&&key===liveIdentity&&csrf===s.csrf&&requestEpoch===epoch;
  const settings={csrf,staff:mode==='staff'};
  let created=null;
  // Invoke permission synchronously within the user's click, before any await.
  let permission;
  try{permission=disabling?null:Notification.permission==='granted'?Promise.resolve('granted'):Notification.requestPermission();}catch(error){s.live.deviceIssue=deviceFailureText(error,installEnvironment());renderLive();return;}
  deviceBusy=true;s.live.deviceBusy=true;s.live.deviceIssue='';s.live.deviceUncertain=false;s.live.deviceProgress=disabling?t('이 기기의 알림을 끄고 있어요.'):t('브라우저의 알림 허용 창을 확인해 주세요.');renderLive();
  try{
    if(disabling){
      const row=state.server.subscriptions?.find(item=>item.endpointHash===state.local.hash);
      if(row)await deviceRequest(path+'/'+encodeURIComponent(row.id),{...settings,method:'DELETE'});
      if(!valid())return;
      await withDeviceDeadline(state.local.subscription?.unsubscribe());
      notice(t('이 기기의 PULSE 알림을 껐어요. 앱 안 알림함은 그대로 쓸 수 있어요.'));
    }else{
      const granted=await withDeviceDeadline(permission,{message:devicePermissionTimeout(installEnvironment())});
      if(!valid())return;
      if(granted!=='granted'){s.live.deviceIssue=t('알림이 허용되지 않았어요. 브라우저 알림 설정에서 허용한 뒤 다시 켜 주세요.');notice(s.live.deviceIssue);return;}
      s.live.deviceProgress=t('이 기기의 알림을 연결하고 있어요.');renderLive();
      const applicationServerKey=deviceKey(state.server.publicKey);
      const registration=await activePushRegistration(state.local.registration||await withDeviceDeadline(navigator.serviceWorker.register('./push-sw.js?mode='+mode+(mode==='customer'&&locale()==='en'?'&lang=en':''),{scope,updateViaCache:'none'})));
      if(!valid())return;
      let subscription=await withDeviceDeadline(registration.pushManager.getSubscription());
      if(!valid())return;
      if(!subscription){subscription=await withDeviceDeadline(registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey}));created=subscription;}
      if(!valid())return;
      await deviceRequest(path,{...settings,body:{subscription:subscription.toJSON(),label:'PULSE · '+(mode==='staff'?'제작자':'고객')+' · '+(/Windows/.test(navigator.userAgent)?'Windows PC':'내 브라우저')}}); // i18n-skip
      created=null;
      if(valid())notice(t('이 기기에서 PULSE 알림을 켰어요.'));
    }
  }catch(error){
    if(created&&valid()&&rejectedDeviceRegistration(error))try{await withDeviceDeadline(created.unsubscribe());}catch{}
    if(valid()){s.live.deviceUncertain=!!created&&!rejectedDeviceRegistration(error);s.live.deviceIssue=deviceFailureText(error,installEnvironment());notice(s.live.deviceIssue);}
  }finally{
    if(operation===deviceOperation){deviceBusy=false;s.live.deviceBusy=false;s.live.deviceProgress='';renderLive();if(liveIdentity)await refreshDevice();}
  }
}
navigator.serviceWorker?.addEventListener('message',async event=>{if(event.origin!==location.origin||event.data?.type!=='pulse:open-notifications'||event.data.mode!==s.mode||demo)return;const registration=await navigator.serviceWorker.getRegistration(deviceScope());if(event.source!==registration?.active)return;s.live.open=true;renderLive();live?.pull();refreshDevice();});
function canApplyRemote(){const active=document.activeElement;return !busy&&!loading&&!composing&&!dialog.open&&!document.hidden&&!active?.matches('input,textarea,select,[contenteditable=true]')&&!document.fullscreenElement&&!document.pictureInPictureElement&&!document.querySelector('[data-animatic-player][data-preview-playing="true"]')&&!document.querySelector('.sx-draft[data-playing="true"]')&&!Array.from(document.querySelectorAll('[data-preview-test],[data-film-player]')).some(video=>!video.paused&&!video.ended);}
function scheduleApply(){clearTimeout(applyTimer);applyTimer=setTimeout(()=>{if(canApplyRemote()){if(pendingRemote)applyRemote();else fetchRemote();}},180);}
function applyRemote(){if(!pendingRemote||!canApplyRemote())return;const pending=pendingRemote;pendingRemote=null;s.live.pending=false;if(!current(pending.stamp))return;if(pending.result?.project){if(Number(pending.result.project.revision)<Number(s.project?.revision)){renderLive();return;}const showing=main.querySelector('#review-video')?.dataset.version||s.versionId;if(showing)s.versionId=showing;accept(pending.result);if(pending.workflow)s.workflow=pending.workflow;}if(pending.workspace)s.workspace=pending.workspace;s.live.pending=false;s.error='';s.conflict=false;s.reloadFailed=false;render({remote:true});}
async function fetchRemote(){if(!liveSnapshot||demo)return;if(busy||loading||autoFetching){autoAgain=true;return;}const stamp=projectStamp(),target=s.project?projectRevision(liveSnapshot,s.project.id,s.mode):null;if(s.project&&(target===undefined||Number(target)<=Number(s.project.revision))){if(target===undefined&&s.mode==='staff')connectionExpired();return;}const workspaceSignature=s.mode==='staff'&&!s.project?JSON.stringify(liveSnapshot.projects||[]):null;if(workspaceSignature!==null&&s.live.workspaceSignature===workspaceSignature)return;autoFetching=true;autoAgain=false;try{if(s.project){const result=await request(s.mode==='staff'?staffPath('/studio'):'/pulse/api/project');if(!current(stamp))return;if(result.project?.id!==s.project.id){connectionExpired();return;}if(Number(result.project?.revision)<Number(s.project.revision))return;let workflow=null;if(s.mode==='staff'){const response=await request('/api/client-workflow');if(!current(stamp))return;workflow=response.items||[];}pendingRemote={stamp,result,workflow};}else if(s.mode==='staff'&&s.user){const workspace=await request('/api/client-projects');if(!current(stamp))return;pendingRemote={stamp,workspace};s.live.workspaceSignature=workspaceSignature;}s.live.pending=!!pendingRemote;renderLive();applyRemote();}catch(error){if(current(stamp)){if(error.status===401||error.status===403||error.status===404)connectionExpired();else{s.live.status='reconnecting';renderLive();}}}finally{autoFetching=false;if(autoAgain){autoAgain=false;scheduleApply();}}}
document.addEventListener('compositionstart',()=>{composing=true;});document.addEventListener('compositionend',()=>{composing=false;scheduleApply();});document.addEventListener('focusout',scheduleApply);dialog.addEventListener('close',scheduleApply);document.addEventListener('visibilitychange',scheduleApply);window.addEventListener('focus',scheduleApply);document.addEventListener('fullscreenchange',scheduleApply);document.addEventListener('leavepictureinpicture',scheduleApply,true);
async function fetchWorkflow(){if(s.mode!=='staff')return;try{const stamp=projectStamp(),result=await request('/api/client-workflow');if(current(stamp))s.workflow=result.items||[];}catch{if(s.project)notice('내부 검토 상태를 불러오지 못했어요. 「최신 내용 불러오기」를 눌러 주세요.');}} // i18n-skip
async function loadProject(id){const requestEpoch=epoch;const result=await request(s.mode==='staff'?`/api/client-projects/${encodeURIComponent(id)}/studio`:'/pulse/api/project');if(requestEpoch!==epoch)return;if(s.mode==='customer'&&s.project&&result.project?.id!==s.project.id){resetContext({preserveInvite:true});accept(result);render();notice(t('다른 프로젝트로 연결돼서 이전 프로젝트와 쓰던 글을 닫았어요.'));return;}accept(result);if(s.mode==='staff')await fetchWorkflow();}
// 새 의뢰 접수 스위치(운영 조각 3): 직원 첫 화면에 상태를 함께 읽는다. 옛 서버(404) · 못 읽음이면 스위치를 그리지 않는다.
let staffIntakeAt=0;
async function loadWorkspace(){const requestEpoch=epoch,[result,intake]=await Promise.all([request('/api/client-projects'),request('/api/settings/pulse-capacity').catch(()=>null)]);if(requestEpoch!==epoch)return;s.workspace=result;s.staffIntake=['open','paused'].includes(intake?.state)?intake:null;staffIntakeAt=Date.now();}
// 다른 기기에서 쉬었거나 다시 여는 날에 저절로 열린 것이 열려 있던 직원 화면에도 보이게, 화면으로 돌아올 때 다시 읽는다(30초 안에는 다시 묻지 않는다). 쓰는 중이면 다음 기회에 그린다.
const staffIntakeKey=intake=>JSON.stringify([intake?.state,intake?.pausedUntil,intake?.pauseNote,intake?.pauseNoteEn,intake?.reopened,intake?.canEdit]);
async function recheckStaffIntake({force=false}={}){
  if(s.mode!=='staff'||!s.user||demo||!s.staffIntake||!force&&(busy||loading||Date.now()-staffIntakeAt<30000))return;
  staffIntakeAt=Date.now();const who=s.user.id,intake=await request('/api/settings/pulse-capacity').catch(()=>null);
  if(s.user?.id!==who||!['open','paused'].includes(intake?.state)||staffIntakeKey(intake)===staffIntakeKey(s.staffIntake))return;
  if(force){s.staffIntake=intake;return;}
  // 그릴 수 있을 때만 바꾼다 — 못 그리면 다음 화면 복귀 때 다시 읽게 묶음 시각을 푼다.
  if(canApplyRemote()){s.staffIntake=intake;render({remote:true});}else staffIntakeAt=0;
}
// form: 「접수 쉬기」 폼 — 성공하면 적어 둔 안내 · 날짜를 쓰던 글에서 지운다(다른 직원 폼과 같다 — 남기면 나갈 때 「보내지 않은 글」 확인이 뜨고 다시 받은 뒤 폼이 지난 글로 펼쳐진다).
async function intakeSave(body,message,form=null){if(busy||loading||s.mode!=='staff')return;const key=form?draftKey(form):'',revision=drafts.get(key)?.revision;setBusy(true);try{const result=await request('/api/settings/pulse-capacity',{...options(),body});s.staffIntake=['open','paused'].includes(result?.state)?result:null;staffIntakeAt=Date.now();if(key)clearDraft(key,revision);render();notice(message);}catch(error){notice(error.message);}finally{setBusy(false);}}
// 직원 기록 · 프로젝트 바로 열기(아래 넷)는 직원 화면(늘 한국어)이라 번역하지 않는다.
function readStaffHistoryTarget(search){
  const params=new URLSearchParams(search),keys=[...params.keys()],uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const kind=params.has('comment')?'comment':params.has('review')?'review':'';
  if(!kind||params.get('mode')!=='staff'||params.get('tab')!=='history'||keys.length!==4||new Set(keys).size!==keys.length||keys.some(key=>!['mode','project','tab',kind].includes(key))||!uuid.test(params.get('project')||'')||!uuid.test(params.get(kind)||''))return null;
  return {projectId:params.get('project'),kind,id:params.get(kind)};
}
function staffHistoryRecordId(project,target){
  if(!target||project?.id!==target.projectId||!['comment','review'].includes(target.kind))return '';
  const records=target.kind==='comment'?project.studio?.comments:project.studio?.sceneReviews;
  return Array.isArray(records)&&records.some(record=>record.id===target.id)?'pulse-history-'+target.kind+'-'+target.id:'';
}
function focusInitialStaffHistory(){
  const target=s.historyTarget;s.historyTarget=null;
  if(s.mode!=='staff'||s.tab!=='history'||!target)return;
  const id=staffHistoryRecordId(s.project,target),record=id&&main.querySelector('#'+id);
  if(!record){notice('연결한 의견을 찾지 못했어요. 이 프로젝트의 기록에서 찾아봐 주세요.');return;} // i18n-skip
  record.classList.add('notification-target');record.focus({preventScroll:true});record.scrollIntoView({block:'center',behavior:'auto'});
}
async function openInitialStaffProject(){const id=initialStaffProject;if(!id||s.mode!=='staff'||!s.user)return;initialStaffProject='';const requestEpoch=epoch,userId=s.user.id,sceneId=initialStaffScene,historyTarget=initialStaffHistory;initialStaffScene='';initialStaffHistory=null;if(!s.workspace?.projects?.some(project=>project.id===id)){notice('이 프로젝트를 찾을 수 없거나 볼 권한이 없어요. 목록에서 골라 주세요.');return;}await loadProject(id);if(requestEpoch!==epoch||s.user?.id!==userId)return;s.tab=initialStaffTab==='scenes'?'storyboard':['desk','strategy','direction','concepts','storyboard','review','history'].includes(initialStaffTab)?initialStaffTab:'strategy';if(historyTarget&&s.tab==='history'){if(staffHistoryRecordId(s.project,historyTarget))s.historyTarget=historyTarget;else notice('연결한 의견을 찾지 못했어요. 이 프로젝트의 기록에서 찾아봐 주세요.');}if(sceneId&&s.tab==='storyboard'){if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sceneId)&&s.project?.id===id&&s.project.studio?.scenes?.some(scene=>scene.id===sceneId))pendingInitialScene=sceneId;else notice('연결한 장면을 찾지 못했어요. 장면 목록에서 찾아봐 주세요.');}} // i18n-skip
function focusInitialStaffScene(){if(!pendingInitialScene)return;const id=pendingInitialScene;pendingInitialScene='';if(s.mode!=='staff'||s.tab!=='storyboard'||!s.project?.studio?.scenes?.some(scene=>scene.id===id))return;const card=main.querySelector('#scene-'+id);if(card){card.setAttribute('tabindex','-1');card.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:'auto'});}}
// 메일 코드로 다시 열기(판 4): 서버가 켜졌다고 알릴 때만 다시 열기 판에 메일 칸을 보인다. 메일의 「?open=mail」로 왔으면 판을 열어 둔다(주소창에서는 지운다).
let mailOpenAvailable=null,mailOpenChecking=false,mailOpenAsked=false,mailEmail='',mailChoices=null;
// 메일의 「?open=mail」은 확인이 끝난 뒤 지금 붙어 있는 첫 화면에서 한 번만 판을 연다. 첫 화면이 다시 붙는 사이에 확인이 끝나면 다음에 붙을 때 연다.
// 메일 코드가 꺼져 있거나 확인이 실패해도 판은 연다(링크 칸만 보인다).
function applyMailOpen(){const box=document.querySelector('[data-entry-mail]');if(!box||!entryHandle||mailOpenChecking)return;if(mailOpenAvailable)box.hidden=false;if(OPEN_MAIL&&!mailOpenAsked){mailOpenAsked=true;entryHandle.openInvite?.();}}
function mailOpenCheck(){if(demo||filmDemo||s.mode!=='customer')return;if(mailOpenAvailable!==null){applyMailOpen();return;}if(mailOpenChecking)return;mailOpenChecking=true;request('/pulse/api/mail-open').then(result=>{mailOpenChecking=false;mailOpenAvailable=!!result?.available;applyMailOpen();},()=>{mailOpenChecking=false;applyMailOpen();});}
// 같은 폼이 주소 → 여섯 자리 → (둘 이상이면) 고르기로 넘어간다. 답 · 실패는 판 안 알림으로.
function mailStep(form,name){form.dataset.step=name;form.querySelectorAll('[data-mail-step]').forEach(el=>{el.hidden=el.dataset.mailStep!==name;});const help=form.querySelector('[data-mail-help]');if(help)help.hidden=name!=='code';const go=form.querySelector('[data-mail-go]');if(go){go.textContent=name==='email'?t('코드 받기'):t('열기',null,'open');go.closest('button').hidden=name==='pick';}}
async function mailOpenStep(form,values){
  const step=form.dataset.step||'email';setBusy(true);
  try{
    if(step==='email'){const email=String(values.email||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){notice(t('이메일 주소를 확인해 주세요.'));form.querySelector('[name=email]')?.focus();return;}await request('/pulse/api/mail-open',{body:{email,website:values.website||''}});mailEmail=email;mailStep(form,'code');form.querySelector('[name=code]')?.focus();return;}
    if(step==='code'){const code=String(values.code||'').replace(/\s+/g,'');if(!/^\d{6}$/.test(code)){notice(t('메일 주소와 여섯 자리 코드를 확인해 주세요.'));form.querySelector('[name=code]')?.focus();return;}const result=await request('/pulse/api/mail-open/verify',{body:{email:mailEmail,code}});if(result?.choices){mailChoices=result.choices;const box=form.querySelector('[data-mail-step=pick]');box.innerHTML=`<p class="sx-small">${esc(t('어느 의뢰를 열까요?'))}</p>${result.choices.projects.map(item=>`<button type="button" class="sx-quiet" data-action="mail-pick" data-id="${esc(item.id)}">${esc(item.title)}${item.number?` <span class="sx-no">${esc(item.number)}</span>`:''}</button>`).join('')}`;mailStep(form,'pick');box.querySelector('button')?.focus();return;}await openedByMail();}
  }catch(error){notice(error.message);}finally{setBusy(false);}
}
async function openedByMail(){mailEmail='';mailChoices=null;const kept=keptDrafts;resetContext();keptDrafts=kept;booting=true;render();await start();}
async function start(invite='',{manual=false}={}){if(filmDemo)return;if(busy||loading)return;if(invite)closeFlow();loading=true;const requestEpoch=epoch;try{if(s.mode==='staff'){const result=await request('/api/me');if(requestEpoch!==epoch)return;booting=false;if(!result.user){s.user=null;s.csrf='';render();return;}if(s.user&&s.user.id!==result.user.id)resetContext();s.user=result.user;s.csrf=result.csrfToken||'';await loadWorkspace();if(requestEpoch!==epoch)return;await openInitialStaffProject();}else{const result=invite?await request('/pulse/api/open',{body:{invite}}):await request('/pulse/api/project');if(requestEpoch!==epoch)return;await applyLocale(result.features);if(requestEpoch!==epoch)return;localeScreen=result.project?.id||'';accept(result);s.entryError=null;}booting=false;s.error='';s.conflict=false;s.reloadFailed=false;const restored=restoreKeptDrafts();render();if(restored)notice(t('다시 연결했어요. 쓰던 글이 그대로 남아 있어요.'));}catch(error){if(requestEpoch!==epoch)return;booting=false;if(error.status===401||error.status===403){s.user=null;s.project=null;s.csrf='';}if(s.mode==='customer'){if(invite)s.entryError=error.status===401||error.status===403?{title:k('이 초대 링크로는 열 수 없어요'),text:k('링크가 끝났거나 새 링크로 바뀌었을 수 있어요. 담당자에게 새 링크를 요청해 주세요.')}:{title:k('프로젝트를 열지 못했어요'),text:error.message};else if(manual)s.entryError=error.status===401?{title:k('이 기기에 연결된 프로젝트가 없어요'),text:k('담당자에게 받은 초대 링크를 누르거나 아래 칸에 붙여 넣어 주세요. 「이 기기 기억하기」를 켜 둔 기기라면 30일 동안 링크 없이 열려요.')}:{title:k('연결을 확인하지 못했어요'),text:error.message};await screenLocale();if(requestEpoch!==epoch)return;}render();if((invite||error.status!==401)&&!s.entryError)notice(t(error.message));}finally{loading=false;scheduleInviteNavigation();if(booting){booting=false;render();}}}
// 같은 프로젝트로 다시 연결되면 보관해 둔 쓰던 글을 되살린다. 다른 프로젝트면 버린다.
// 연결이 끝날 때(connectionExpired)의 입장 알림 두 줄은 한국어 원문 그대로 담고 그릴 때 옮긴다(localizeEntryError — 이 줄은 번역 틀 없이 도는 시험이 있다). 직원 알림은 한국어다.
function restoreKeptDrafts(){const kept=keptDrafts;keptDrafts=null;if(!kept||s.mode!=='customer'||kept.projectId!==s.project?.id||!kept.entries.size)return false;for(const [key,entry] of kept.entries)if(!drafts.has(key))drafts.set(key,entry);return true;}
function connectionExpired(){closeFlow();const keep=s.mode==='customer'&&!demo&&s.project&&drafts.size?{projectId:s.project.id,entries:new Map(drafts)}:null;resetContext();s.user=null;s.workspace=null;s.csrf='';if(s.mode==='customer'){keptDrafts=keep;s.entryError={title:'연결이 끝나 프로젝트를 닫았어요',text:keep?'받은 초대 링크를 아래 칸에 붙여 넣어 다시 열면, 쓰던 글이 그대로 남아 있어요. 이 창을 닫으면 쓰던 글은 사라져요.':'받은 초대 링크를 다시 누르거나 아래 칸에 붙여 넣어 주세요.'};}render();if(s.mode!=='customer')notice('연결이 끝났거나 권한이 바뀌어 프로젝트를 닫았어요. 다시 로그인해 주세요.');} // i18n-skip
async function refresh(){if(busy||loading)return;loading=true;const stamp=projectStamp();try{if(s.mode==='staff'){const me=await request('/api/me');if(!current(stamp))return;if(!me.user||me.user.id!==s.user?.id){resetContext();s.user=me.user||null;s.csrf=me.csrfToken||'';if(s.user)await loadWorkspace();render();notice('로그인 계정이 바뀌어 이전 프로젝트를 닫았어요.');return;}s.csrf=me.csrfToken||s.csrf;}if(s.project){await loadProject(s.project.id);await recheckStaffIntake({force:true});}else if(s.user)await loadWorkspace();if(!current(stamp))return;s.error='';s.conflict=false;s.reloadFailed=false;render();notice(t('최신 내용을 불러왔어요. 쓰던 글은 그대로 있어요.'));}catch(error){if(current(stamp)){if(error.status===401||error.status===403)connectionExpired();else{s.error=error.message;s.reloadFailed=true;render();notice(error.message);}}}finally{loading=false;scheduleInviteNavigation();}} // i18n-skip
async function mutate(operation,{form=null,message=t('저장했어요.'),after,workflowAction=null}={}){if(busy||loading)return false;if(!editable()&&s.project&&!(s.mode==='staff'&&workflowAction&&s.workflow.some(row=>row.projectId===s.project.id&&row.messageId===workflowAction.messageId&&row.actions?.some(action=>action.action===workflowAction.action)))){notice(t('이 프로젝트는 보기만 할 수 있어요.'));return false;}const stamp=projectStamp(),key=form?draftKey(form):'',revision=drafts.get(key)?.revision;setBusy(true);dialog.querySelector('[data-mutation-error]')?.remove();let committed=false;try{const result=await operation();if(!current(stamp))return false;committed=true;accept(result||{});if(key)clearDraft(key,revision);s.error='';s.conflict=false;s.reloadFailed=false;if(after)await after(result||{});if(!current(stamp))return true;if(s.mode==='staff'&&s.project)await loadProject(s.project.id);render();notice(typeof message==='function'?message(result||{}):message);return true;}catch(error){if(current(stamp)){if(error.status===401||error.status===403)connectionExpired();else{s.error=committed?t('저장은 됐지만 최신 화면을 불러오지 못했어요. 「최신 내용 불러오기」를 눌러 주세요.'):s.mode==='customer'&&(/그사이 다른 창이나 고객이 내용을 바꿨어요/.test(error.message)||error.message===t('그사이 다른 창이나 고객이 내용을 바꿨어요. 새로 불러온 뒤 다시 저장해 주세요.'))?t('그사이 새 소식이 생겼어요(답이 도착했거나 담당자가 내용을 바꿨어요). 「최신 내용 불러오기」를 누른 뒤 다시 보내 주세요. 쓰던 글은 그대로 있어요.'):error.message;s.conflict=error.status===409;s.reloadFailed=!!committed;render();notice(s.error);showMutationError(s.error);}}return false;}finally{if(stamp.epoch===epoch)setBusy(false);}}
function studioAction(action,values={}){return request(s.mode==='staff'?staffPath('/studio'):'/pulse/api/studio',{...options(),body:{...values,action,revision:s.project.revision}});}
function projectAction(action,values={}){return request('/pulse/api/action',{...options(),body:{...values,action,revision:s.project.revision}});}
// 아래 둘은 직원 화면과 옛 탭(참고자료 · 콘셉트 · 장면 · 시안 올리기)만 쓴다 — 한국어 그대로 둔다.
function validateFile(file,{imageOnly=false}={}){if(!file?.size)return;if(file.size>100*1024*1024)throw new PulseError('파일은 100MB까지 올릴 수 있어요.');const types=imageOnly?['image/png','image/jpeg']:['image/png','image/jpeg','video/mp4','video/webm'];if(!types.includes(file.type))throw new PulseError(imageOnly?'PNG나 JPEG 이미지를 골라 주세요.':'MP4·WebM 영상이나 PNG·JPEG 이미지를 골라 주세요.');} // i18n-skip
async function attachImage(values){const file=values.file;delete values.file;if(file?.size){validateFile(file,{imageOnly:true});const stamp=projectStamp(),result=await request(s.mode==='staff'?staffPath('/studio/media'):'/pulse/api/studio/media',{...options(),file,headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),'X-Project-Revision':String(s.project.revision)}});if(!current(stamp))throw new PulseError('프로젝트가 바뀌었어요.');accept(result);values.assetId=result.asset.id;values.imageUrl='';}return values;} // i18n-skip

document.addEventListener('input',remember);document.addEventListener('change',remember);
document.addEventListener('input',event=>{const field=event.target;if(field?.name!=='seconds')return;const out=field.closest('form')?.querySelector('.round-clock');if(out)out.textContent=field.value===''?'':clock(Number(field.value));});
document.addEventListener('input',event=>{if(event.target.name==='cast_notes')refreshCasting(event.target.form);});
// 「캐스팅북 코드로 채우기」(담당자): 붙여 넣는 대로 읽은 조합을 보인다. 저장은 고른 조합의 단추로만 한다.
// 결과가 같으면 다시 쓰지 않는다(aria-live 칸이라 글자마다 같은 문장을 다시 읽지 않게), 담당자가 접은 칸은 다시 그려도 접힌 채로 둔다.
const castingCodeShown=new WeakMap();
document.addEventListener('input',event=>{const field=event.target;if(!field?.matches?.('[data-casting-code]'))return;s.castingCode=field.value;const result=field.closest('.casting-code')?.querySelector('[data-casting-code-result]'),strategy=s.project?.studio?.strategy;if(!result)return;const html=castingCodeResult({text:field.value,saved:strategy?.data?.castingSelection,review:strategyReviewState(strategy)});if(castingCodeShown.get(result)!==html){result.innerHTML=html;castingCodeShown.set(result,html);}});
document.addEventListener('toggle',event=>{if(event.target?.matches?.('details.casting-code'))s.castingCodeOpen=event.target.open;},true);
document.addEventListener('change',event=>{if(event.target.name?.startsWith('cast_'))refreshCasting(event.target.form,{modelChanged:event.target.name==='cast_modelId'});});
document.addEventListener('play',event=>{if(event.target.matches('audio,video'))for(const media of document.querySelectorAll('audio,video'))if(media!==event.target&&!(event.target.closest('.compare-grid')&&media.closest('.compare-grid')))media.pause();},true);
// 보내기 갈래 중 직원 전용(new-project · desk-* · version · workflow)과 옛 탭(reference · concept · scene · select-concept · review-scene · comment)은 한국어 그대로 둔다(줄 끝 i18n-skip).
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form]');if(!form)return;event.preventDefault();if(busy||loading)return;const type=form.dataset.form,values=Object.fromEntries(new FormData(form));
  if(type==='mail-open'){await mailOpenStep(form,values);return;}
  if(s.mode==='staff'&&type.startsWith('brand-')){await brandSubmit(type,form,values);return;}
  if(type==='invite'){const invite=parseInvite(values.invite);if(!invite){s.entryError={title:k('초대 링크를 읽지 못했어요'),text:k('담당자에게 받은 링크 전체(https://… #invite=…)를 붙여 넣어 주세요.')};render();return;}const kept=keptDrafts;resetContext();keptDrafts=kept;booting=true;render();await start(invite);return;}
  if(type==='intake-pause'){await intakeSave({open:false,pausedUntil:String(values.pausedUntil||''),pauseNote:String(values.pauseNote||''),pauseNoteEn:String(values.pauseNoteEn||'')},'새 의뢰 접수를 쉬어요. 손님 화면에는 1~2분 안에 보여요.',form);return;} // i18n-skip
  if(type==='login'){setBusy(true);try{const result=await request('/api/login',{body:values});resetContext();s.user=result.user;s.csrf=result.csrfToken||'';await loadWorkspace();await openInitialStaffProject();render();}catch(error){notice(error.message);}finally{setBusy(false);}return;}
  if(type==='new-project'){await mutate(()=>request('/api/client-projects',{...options(),body:{...values,ownerId:s.user.id}}),{form,message:'프로젝트를 만들었어요.',after:async result=>{s.newProject=false;accept(result);if(!s.project&&result.id)await loadProject(result.id);if(s.project)await loadProject(s.project.id);s.tab='strategy';}});return;} // i18n-skip
  if(!s.project)return;
  if(await production.submit(form))return;
  if(type==='kickoff-source'){await mutate(()=>request('/pulse/api/action',{...options(),body:kickoffSubmission(s,form.dataset,values.sourceKey)}),{form,message:t('자료를 보냈어요. 담당자가 제작에 쓸 수 있는지 확인해요.')});return;}
  if(type==='confirm-delivery'){if(s.mode!=='customer'||!s.project.closeout?.canConfirm||values.confirmed!=='yes')return;if(form.dataset.id!==s.project.closeout.deliveryKey||Number(form.dataset.revision)!==s.project.revision){drafts.delete(draftKey(form));closeDialog();notice(t('납품 내용이 바뀌었어요. 최신 파일과 안내를 다시 확인해 주세요.'));return;}await mutate(()=>request('/pulse/api/action',{...options(),body:{action:'confirm_delivery',confirmed:true,revision:Number(form.dataset.revision),deliveryKey:form.dataset.id}}),{form,message:t('수령 확인을 남겼어요.'),after:closeDialog});return;}
  if(type==='strategy'){const fromCode=castingCodeSave;castingCodeSave=null;values.castingSelection=takeCastingValues(values);values.channels=new FormData(form).getAll('channels');for(const key of ['durationSeconds','budgetProduction','budgetMedia'])values[key]=values[key]===''||values[key]===undefined?null:Number(values[key]);const before=s.project.studio?.strategy;await mutate(()=>studioAction('save_strategy',{strategy:values}),{form,message:()=>fromCode?castingCodeSaveMessage(fromCode.item,before,s.project?.studio?.strategy,{otherEdits:fromCode.otherEdits}):strategySaveMessage(before,s.mode,s.project?.studio?.strategy),after:()=>{if(fromCode)s.castingCode=fromCode.text;}});return;}
  if(type==='ask'){const text=String(values.text||'').trim(),file=values.file?.size?values.file:null;if(!text&&!file){notice(t('글을 적거나 파일을 골라 주세요.'));form.elements.text.focus();return;}await mutate(async()=>{let fileId='';if(file){const uploaded=await requestFileUpload(file,'etc');accept(uploaded);fileId=uploaded.file.id;}return studioAction('request_answer',{askId:form.dataset.id,text,fileId});},{form,message:t('답을 보냈어요. 확인해 볼게요.')});return;}
  if(type==='model-say'){const note=String(values.note||'').trim();if(!note){form.elements.note.focus();return;}await mutate(()=>studioAction('answer_model',{note}),{form,message:t('담당자에게 전했어요. 다시 제안해 드릴게요.')});return;}
  if(type==='persona-changes'){const note=String(values.note||'').trim();if(!note){form.elements.note.focus();return;}await personaDecide({decision:'changes',note,form});return;}
  if(type==='desk-persona'){await mutate(()=>request('/api/personas/'+encodeURIComponent(form.dataset.persona),{...options(),body:{action:form.dataset.personaAction,revision:Number(form.dataset.revision),...personaStaffBody(form.dataset.personaAction,values)}}),{form,message:PERSONA_STAFF_DONE[form.dataset.personaAction]||'저장했어요.'});return;} // i18n-skip
  if(type==='desk-persona-asset'){const file=values.file;if(!file?.size){notice('올릴 파일을 골라 주세요.');return;}await mutate(()=>request(`/api/personas/${encodeURIComponent(form.dataset.persona)}/revisions/${encodeURIComponent(form.dataset.revisionId)}/media`,{...options(),file,headers:{'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name),'X-Persona-Role':values.role,'X-Persona-Revision':String(form.dataset.revision)}}),{form,message:'판에 파일을 올렸어요. 다 올렸으면 손님에게 보내 주세요.'});return;} // i18n-skip
  if(type==='recast'){if(!values.modelId&&!values.note?.trim()){notice(t('모델을 고르거나 바라는 점을 적어 주세요.'));return;}await mutate(()=>studioAction('answer_model',values.modelId?{modelId:values.modelId,note:values.note||''}:{note:values.note}),{form,message:t('담당자에게 전했어요. 반영해서 다시 보내 드릴게요.'),after:closeDialog});return;}
  if(type==='desk-ask'){const items=String(values.items||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{const [label,...why]=line.split(' — ');return {label:label.trim().slice(0,120),why:why.join(' — ').trim().slice(0,300)};});if(!items.length||items.length>8){notice('물어볼 것을 한 줄에 하나씩, 8개까지 적어 주세요.');return;}const askTr=staffLocale()?askTranslations(items,values.itemsTr):null;if(askTr?.error){notice(askTr.error);return;}await mutate(()=>studioAction('request_ask',{items:askTr?askTr.items:items}),{form,message:'고객에게 물어봤어요.',after:closeDialog});return;} // i18n-skip
  if(type==='desk-pay-request'){const amount=Number(String(values.amount||'').replace(/[^0-9]/g,''));await mutate(()=>studioAction('payment_request',{amount}),{form,message:'결제 요청을 적었어요. 손님에게 크몽 결제 안내가 가요.',after:closeDialog});return;} // i18n-skip
  if(type==='desk-pay-confirm'){await mutate(()=>studioAction('payment_confirm',{ref:String(values.ref||'').trim(),...(values.dueDate?{dueDate:values.dueDate}:{})}),{form,message:'결제를 확인했어요. 장면 이미지 판을 보낼 수 있어요.',after:closeDialog});return;} // i18n-skip
  if(type==='desk-pay-cancel'){await mutate(()=>studioAction('payment_cancel',{note:String(values.note||'').trim()}),{form,message:'결제 취소를 적었어요.',after:closeDialog});return;} // i18n-skip
  if(type==='desk-contact'){await mutate(()=>studioAction('request_contact',{email:String(values.email||'').trim(),mailOff:values.mailOff==='on'}),{form,message:'알림 메일 설정을 바꿨어요.'});return;} // i18n-skip
  if(type==='desk-propose'){await mutate(()=>{const tr=staffLocale();if(tr)needEnglish([[values.note,values.noteTr,'왜 이 모델인지']]);return studioAction('propose_model',{modelId:values.modelId,note:values.note||'',...(tr?{translation:{note:trText(values.noteTr)}}:{})});},{form,message:'고객에게 모델을 제안했어요.',after:closeDialog});return;} // i18n-skip
  if(type==='desk-direction'){await mutate(async()=>{const body=await directionBody(form,values);return studioAction('propose_direction',body);},{form,message:'고객에게 방향을 보냈어요.',after:closeDialog});return;} // i18n-skip
  if(type==='desk-settle'){await mutate(()=>studioAction('settle_direction',{optionId:values.optionId,note:values.note||''}),{form,message:'정한 안으로 정리했어요. 글 콘티를 보낼 수 있어요.',after:closeDialog});return;} // i18n-skip
  // 옷 · 머리(11-10): 서버가 받는다고 알린 판(castingLooks)에서 그 줄을 그렸으면 두 칸을 늘(빈 값 = 맡김이라도) 보낸다 — 옛 서버는 모르는 칸을 거절한다.
  if(type==='direction-pick'){const d=s.project.studio?.request?.directionProposal,look=s.project.studio?.request?.castingLooks&&form.elements?.outfit&&form.elements?.hair?{outfit:String(values.outfit||''),hair:String(values.hair||'')}:{};await mutate(()=>studioAction('answer_direction',{optionId:values.optionId,...(values.modelId?{modelId:values.modelId}:{}),...look,note:String(values.note||'').trim()}),{form,message:t('방향을 정했어요. 글 콘티를 만들어 보내 드릴게요.'),after:()=>{s.directionUi={};s.tab='overview';if(typeof window.scrollTo==='function')window.scrollTo(0,0);}});void d;return;}
  if(type==='direction-neither'){const note=String(values.note||'').trim();if(!note){form.elements.note.focus();return;}const last=(s.project.studio?.request?.directionProposal?.round||1)>=2;await mutate(()=>studioAction('answer_direction',{neither:true,note}),{form,message:last?t('말씀 고맙습니다. 담당자가 직접 연락드릴게요.'):t('말씀 고맙습니다. 새 방향을 다시 보내 드릴게요.'),after:()=>{s.directionUi={};s.tab='overview';}});return;}
  if(type==='desk-send'){await mutate(async()=>{const tr=staffLocale();if(tr){needEnglish([[values.oneLine,values.oneLineTr,'광고가 남길 한 문장'],[values.note,values.noteTr,'함께 보낼 말']]);const scenes=[...form.querySelectorAll('[data-tr-key]')].map(field=>[field.dataset.trKey,trText(field.value),field.dataset.trLabel]),gap=scenes.find(([,text])=>!text);if(gap)throw new PulseError(`영어 프로젝트예요. 「${gap[2]}」의 영어를 적어 주세요.`);for(const [key,text]of scenes)accept(await studioAction('save_translation',{key,text}));}return studioAction('send_draft',{oneLine:values.oneLine,note:values.note||'',...(tr?{translation:{oneLine:trText(values.oneLineTr),note:trText(values.noteTr)}}:{}),...(values.asScript?{kind:'script'}:{})});},{form,message:'고객에게 보냈어요.',after:closeDialog});return;} // i18n-skip
  if(type==='desk-translation'){await mutate(()=>studioAction('save_translation',{key:form.dataset.id,text:trText(values.text)}),{form,message:'영어를 저장했어요.'});return;} // i18n-skip
  if(type==='preferences')await mutate(()=>studioAction('save_preferences',{preferences:values}),{form});
  if(type==='reference')await mutate(async()=>{await attachImage(values);delete values.imageUrl;return studioAction('save_reference',values);},{form,message:'참고자료를 올렸어요.'}); // i18n-skip
  if(type==='reference-opinion')await mutate(()=>{const ref=s.project.studio.references.find(r=>r.id===form.dataset.id);if(!ref)throw new PulseError('참고자료를 찾지 못했어요. 최신 내용을 불러와 주세요.');return studioAction('save_reference',{id:ref.id,label:ref.label,url:ref.url,assetId:ref.assetId,preference:values.preference,reason:values.reason});},{form,message:'생각을 저장했어요.',after:closeDialog}); // i18n-skip
  if(type==='concept'||type==='scene')await mutate(async()=>{await attachImage(values);if(form.dataset.id)values.id=form.dataset.id;if(type==='scene'){values.duration=values.duration===''?'':Number(values.duration);values.valueNumbers=new FormData(form).getAll('valueNumbers').map(Number);sceneTranslation(form,values);}return studioAction(type==='concept'?'save_concept':'save_scene',values);},{form,message:'자료를 저장했어요.',after:()=>{s.editor=null;}}); // i18n-skip
  if(type==='select-concept')await mutate(()=>studioAction('select_concept',{conceptId:form.dataset.id,conceptRevision:Number(form.dataset.revision),text:values.text}),{form,message:'콘셉트를 골랐어요.',after:closeDialog}); // i18n-skip
  if(type==='review-scene')await mutate(()=>studioAction('review_scene',{sceneId:form.dataset.id,sceneRevision:Number(form.dataset.revision),...values}),{form,message:'장면에 의견을 남겼어요.',after:closeDialog}); // i18n-skip
  if(type==='comment')await mutate(()=>studioAction('comment',{targetType:form.dataset.target,targetId:form.dataset.id,targetRevision:Number(form.dataset.revision),text:values.text}),{form,message:'의견을 보냈어요.',after:closeDialog}); // i18n-skip
  if(type==='support'){const text=String(values.text||'').trim();if(!text){form.elements.text.focus();return;}await mutate(()=>projectAction('support',{text}),{form,message:t('문의를 보냈어요. 답이 오면 알려 드려요.')});return;}
  if(type==='feedback')await mutate(()=>{if(s.mode==='staff')return request(staffPath('/messages'),{...options(),body:{revision:s.project.revision,text:values.text,visibility:'customer'}});const latest=latestPreview(),version=s.project.versions.find(v=>v.id===s.versionId)||s.project.versions.at(-1),bound=drafts.get(draftKey(form))?.versionId;if((bound&&bound!==latest?.id&&values.action!=='support')||(values.action==='feedback'&&(!latest||version?.id!==latest.id||latest.approvedAt||(bound&&bound!==latest.id))))throw new PulseError(t('쓰던 의견은 이전 시안에 붙어 있어요. 최신 시안을 먼저 열어 주세요. 글은 그대로 있어요.'));return projectAction(values.action,{text:values.text,...(values.action==='feedback'?{versionId:latest.id,seconds:values.seconds===''?(document.querySelector('#review-video')?Math.round(document.querySelector('#review-video').currentTime*10)/10:null):Number(values.seconds)}:{})});},{form,message:values.action==='support'?t('문의를 보냈어요. 답이 오면 알려 드려요.'):t('의견을 보냈어요.')});
  if(type==='project')await mutate(()=>request(staffPath(),{...options(),body:{contact:s.project.contact||'',internalNotes:s.project.internalNotes||'',nextContactDate:s.project.nextContactDate||'',...values,revision:s.project.revision}}),{form,after:async()=>loadProject(s.project.id)});
  // 판 4 B2: 체크를 푼 의견은 새 시안에 묶지 않는다(모두 체크면 서버 기본 — 모두 묶음).
  if(type==='version'){const boxes=[...form.querySelectorAll('input[name=relink]')],picked=boxes.filter(box=>box.checked).map(box=>box.value);delete values.relink;if(boxes.length&&picked.length<boxes.length)values.relinkFeedback=picked;} // i18n-skip
  if(type==='version')await mutate(async()=>{const file=values.file;delete values.file;const relink=values.relinkFeedback;delete values.relinkFeedback;const versionTr=versionTranslation(values);if(file?.size){validateFile(file);return request(staffPath('/media'),{...options(),file,headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),'X-Version-Label':encodeURIComponent(values.label),'X-Version-Kind':values.kind,'X-Version-Guide':encodeURIComponent(values.guide),'X-Project-Revision':String(s.project.revision),...(versionTr?{'X-Version-Translation':encodeURIComponent(JSON.stringify(versionTr))}:{}),...(relink?{'X-Version-Relink':encodeURIComponent(JSON.stringify(relink))}:{})}});}if(!values.url)throw new PulseError('파일이나 자료 링크를 넣어 주세요.');return request(staffPath('/versions'),{...options(),body:{...values,...(versionTr?{translation:versionTr}:{}),...(relink?{relinkFeedback:relink}:{}),revision:s.project.revision}});},{form,message:'고객에게 자료를 보냈어요.',after:async()=>{s.showVersion=false;s.versionId='';await loadProject(s.project.id);}}); // i18n-skip
  if(type==='workflow')await mutate(()=>request('/api/client-workflow',{...options(),body:{...values,projectId:s.project.id,messageId:form.dataset.messageId,revision:s.project.revision}}),{form,workflowAction:{messageId:form.dataset.messageId,action:values.action},message:'검토 요청을 저장했어요.',after:async()=>loadProject(s.project.id)}); // i18n-skip
});

document.addEventListener('change',event=>{const target=event.target;if(target.matches('[data-action=version]')){s.versionId=target.value;render();}if(target.matches('[data-form=review-scene] [name=status]')){const text=target.form.elements.text;text.required=target.value!=='confirmed';}});
// 누르기 갈래 중 직원 전용(desk-* · 제작 설계 확인 요청 · 캐스팅 코드 · 장면 순서 · 의견 처리 · 초대 · 접근 끊기)과 옛 탭(장면 확인 · 참고자료 · 제작 설계),
// 옛 체험(demo-*)은 한국어 그대로 둔다(줄 끝 i18n-skip).
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action,id=button.dataset.id;
  if(['close-dialog','leave-cancel'].includes(action)){closeDialog();return;}
  if(action==='leave-confirm'){drafts.clear();closeDialog();const next=leaveAction;leaveAction=null;next?.();return;}
  if(action==='mail-pick'){if(busy||!mailChoices)return;setBusy(true);try{await request('/pulse/api/mail-open/pick',{body:{ticket:mailChoices.ticket,projectId:id}});setBusy(false);await openedByMail();}catch(error){notice(error.message);setBusy(false);}return;}
  if(action==='mail-again'){const form=document.querySelector('[data-form=mail-open]');if(form){mailStep(form,'email');form.querySelector('[name=email]')?.focus();}return;}
  if(action==='confirm-action'){const check=dialog.querySelector('[data-confirm-check]');if(check&&!check.checked){check.focus();notice(t('안내를 확인했다고 체크해 주세요.'));return;}if(!busy)await confirmAction?.();return;}
  if(action==='install'){showInstallGuide();return;}
  if(action==='install-now'){const prompt=s.installPrompt;if(!prompt){showInstallGuide();return;}button.disabled=true;try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')notice(t('설치를 시작했어요. 끝나면 홈 화면의 PULSE를 열어 주세요.'));}catch{notice(t('브라우저 메뉴에서 ‘앱 설치’나 ‘홈 화면에 추가’를 골라 주세요.'));}finally{if(s.installPrompt===prompt)s.installPrompt=null;if(dialog.open&&dialog.dataset.installGuide==='true')showInstallGuide();}return;}
  if(action==='install-notifications'){closeDialog();s.live.open=true;renderLive();document.querySelector('#pulse-notifications h2')?.focus();refreshDevice();return;}
  if(action==='retry'||action==='check-login'){await start('',{manual:action==='retry'});return;}
  if(action==='refresh'){await refresh();return;}
  if(action==='reset-production-draft'){if(busy||loading)return;const form=button.closest('form');if(!form||!(/^(round-|preview-)/.test(form.dataset.form)||form.dataset.form==='deliverables'))return;const stamp=projectStamp();drafts.delete(draftKey(form));await refresh();if(current(stamp)&&!s.error)notice(t('쓰던 내용을 지우고 최신 내용을 불러왔어요. 새 내용에서 다시 골라 주세요.'));return;}
  if(action==='notifications'){s.live.open=!s.live.open;renderLive();if(s.live.open){document.querySelector('#pulse-notifications h2')?.focus();refreshDevice();}return;}
  if(action==='close-notifications'){s.live.open=false;renderLive();document.querySelector('[data-action=notifications]')?.focus();return;}
  if(action==='device-notifications'){await enableDeviceNotices();return;}
  if(action==='read-notifications'){try{await live?.read('all');}catch(error){notice(error.message);}return;}
  if(action==='open-notification'){
    if(busy||loading)return;
    const item=s.live.notifications.find(row=>row.id===id);if(!item)return;
    const sourceEpoch=epoch,sourceIdentity=identity(),valid=()=>sourceEpoch===epoch&&sourceIdentity===identity();
    try{await live?.read(Array.isArray(item.ids)&&item.ids.length?item.ids:[id]);}catch(error){if(valid()){notice(error.message);live?.pull();}return;}
    if(!valid())return;
    const move=async()=>{
      if(!valid()||busy||loading)return;
      if(item.projectId!==s.project?.id){if(s.mode!=='staff')return;resetContext();}
      const moveEpoch=epoch,moveIdentity=identity();loading=true;
      try{await loadProject(item.projectId);}catch(error){if(moveEpoch===epoch)notice(error.message);return;}
      finally{if(moveEpoch===epoch){loading=false;scheduleInviteNavigation();}}
      if(moveEpoch!==epoch||moveIdentity!==identity()&&s.project?.id!==item.projectId||s.project?.id!==item.projectId)return;
      s.live.open=false;s.notificationCommentId=item.commentId||null;
      // 의뢰 흐름 손님은 대응표 하나(roomRoute)로 간다 — 대화는 묻기 화면, 최종본은 영상 화면의 그 최종본, 옛 탭 소식은 고객 방.
      const routed=roomCustomer()?roomRoute(item,s.project):null;
      if(routed?.journal){const at=journalModel(s.project).items.findIndex(item=>item.id===routed.journal);if(at>=JOURNAL_SHOWN)s.journalAll=true;}
      s.tab=routed?(routed.tab||roomTab(s.tab)):['overview','draft','desk','strategy','direction','concepts','storyboard','review','history','manage'].includes(item.tab)?item.tab:'history';
      const versionId=routed?routed.versionId:item.versionId;if(versionId)s.versionId=versionId;
      render();
      if(routed?.journal){openJournal({target:routed.journal});return;}
      const pointer=item.messageId||item.commentId;
      const target=pointer&&Array.from(main.querySelectorAll('[data-message-id]')).find(node=>node.dataset.messageId===pointer&&node.matches('article'))
        ||item.requestId&&Array.from(main.querySelectorAll('[data-scene-request-id]')).find(node=>node.dataset.sceneRequestId===item.requestId)
        ||item.sceneId&&Array.from(main.querySelectorAll('.scene-card')).find(node=>node.id==='scene-'+item.sceneId)
        ||item.conceptId&&Array.from(main.querySelectorAll('.concept-card')).find(node=>node.id==='concept-'+item.conceptId)
        ||item.target==='deliverables'&&main.querySelector('.deliverables-panel')
        ||item.target==='kickoff'&&main.querySelector('.kickoff-card')
        ||item.target==='approval'&&main.querySelector('#review-approval')
        ||routed?.focus==='delivery'&&main.querySelector('#review-delivery');
      if(target){const hidden=target.closest('[data-panel][hidden]');if(hidden){s.reviewPanel=hidden.dataset.panel;main.querySelectorAll('[data-panel]').forEach(node=>{node.hidden=node!==hidden;});}for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;target.setAttribute('tabindex','-1');target.classList.add('notification-target');target.focus({preventScroll:true});target.scrollIntoView({block:'center'});setTimeout(()=>target.classList.remove('notification-target'),5000);}
      else if(routed)window.scrollTo?.(0,0);else main.querySelector('[data-stage-content]')?.scrollIntoView({block:'start'});
    };
    if(item.projectId!==s.project?.id)withLeave(move);else await move();return;
  }

  if(action==='latest-version'){s.versionId=latestPreview()?.id||'';render();return;}
  if(action==='move-feedback-draft'){const form=main.querySelector('[data-form=feedback]'),entry=form&&drafts.get(draftKey(form));if(entry){entry.versionId=latestPreview()?.id||'';entry.values.seconds='';entry.values.action='feedback';entry.revision++;s.versionId=entry.versionId;render();notice(t('쓴 글을 최신 시안으로 옮겼어요. 영상 시간은 다시 넣어 주세요.'));}return;}
  if(action==='demo-next'&&demo){if(busy||loading)return;if(drafts.size){notice('쓰던 내용을 먼저 저장한 뒤 다음 단계로 가 주세요.');return;}const guide=demo.guide();if(guide.canAdvance){await mutate(async()=>demo.advance(),{message:'다음 단계를 열었어요.',after:result=>{s.tab=result.tab||demo.guide().tab;s.versionId='';}});}else{s.tab=guide.tab;render();}main.querySelector('.sx-shell-head h1,.sx-room-hero,.sx-dr')?.scrollIntoView({block:'start'});return;} // i18n-skip
  if(action==='demo-reset'&&demo){withLeave(()=>{confirmAction=async()=>{const result=demo.reset();resetContext();accept(result);s.tab='direction';render();notice('체험을 처음으로 되돌렸어요.');};openDialog('confirm',{title:'이 체험을 처음부터 다시 할까요?',text:`${s.desktopApp?'이 PC 앱':'이 브라우저'}에 남은 체험 기록(고른 것·의견·승인)만 지워요. 실제 프로젝트에는 영향이 없어요.`,button:'다시 시작'});});return;} // i18n-skip
  // 로그아웃: 직원 알림(로그아웃했어요)은 한국어 그대로, 손님 글은 번역한다.
  if(action==='logout'){const runLogout=()=>withLeave(async()=>{setBusy(true);try{await request(s.mode==='staff'?'/api/logout':'/pulse/api/logout',{...options(),body:{}});resetContext();keptDrafts=null;s.user=null;s.workspace=null;s.csrf='';s.entryError=null;render();notice(s.mode==='staff'?'로그아웃했어요.':t('이 기기에서 프로젝트 연결을 닫았어요.'));}catch(error){notice(error.message);}finally{setBusy(false);}});if(s.mode==='customer'&&!demo){confirmAction=async()=>{closeDialog();runLogout();};openDialog('confirm',{title:t('이 기기에서 연결을 닫을까요?'),text:t('다시 열려면 담당자에게 받은 초대 링크가 필요해요. 이 기기에 켜 둔 알림과 「이 기기 기억하기」도 함께 꺼져요.'),button:t('연결 닫기')});return;}runLogout();return;} // i18n-skip
  // 기억했다는 알림: 한국어는 PC 앱 창 · 브라우저를 나눠 쓰는 원문 그대로(pulse-install-client 시험이 그 꼴을 본다), 다른 언어는 같은 문장을 자리표로 옮긴다.
  if(action==='remember-device'){if(busy||loading||s.mode!=='customer'||demo||!s.project)return;button.disabled=true;try{const result=await deviceRequest('/pulse/api/remember-device',{csrf:s.csrf,body:{}});s.live.rememberKnown=true;s.live.remembered=!!result?.deviceConnection?.remembered;s.rememberOffer=false;render();renderLive();notice(locale()==='ko'?`이 기기를 기억했어요. 30일 동안 초대 링크 없이 ${s.desktopApp?'이 PC 앱':'이 브라우저'}에서 열려요.`:t('이 기기를 기억했어요. 30일 동안 초대 링크 없이 {where}에서 열려요.',{where:s.desktopApp?t('이 PC 앱'):t('이 브라우저')}));}catch(error){notice(error.message);}finally{button.disabled=false;}return;} // i18n-skip
  if(action==='remember-dismiss'){s.rememberOffer=false;try{localStorage.setItem(rememberDismissKey(),'1');}catch{}render();return;}
  if(action==='brands'&&s.mode==='staff'){withLeave(async()=>{resetContext();await openBrands();});return;}
  if(action==='brand-pick'&&s.brands){const pick={kind:button.dataset.kind,id};withLeave(async()=>{drafts.clear();s.brands.detail=null;await openBrands(pick);});return;}
  if(action==='intake-open'){void intakeSave({open:true},'새 의뢰를 다시 받아요. 손님 화면에는 1~2분 안에 보여요.');return;} // i18n-skip
  if(action==='projects'){withLeave(async()=>{resetContext();try{await loadWorkspace();render();}catch(error){render();notice(error.message);}});return;}
  if(action==='open-project'){withLeave(async()=>{resetContext();loading=true;try{await loadProject(id);render();}catch(error){notice(error.message);}finally{loading=false;scheduleInviteNavigation();}});return;}
  if(action==='new-project'){s.newProject=true;render();main.querySelector('[data-form=new-project] input')?.focus();return;}
  if(action==='cancel-new'){withLeave(()=>{s.newProject=false;render();});return;}
  if(!s.project)return;
  if(action==='desk-confirm'){confirmAction=()=>mutate(()=>studioAction('request_confirm'),{message:'확인을 마쳤어요. 답을 제작 설계로 옮겼어요.',after:closeDialog});openDialog('confirm',{title:'의뢰서 확인을 끝낼까요?',text:'답을 제작 설계로 옮기고, 고객 화면은 「1차안을 만들고 있어요」로 바뀌어요.',button:'확인 끝'});return;} // i18n-skip
  if(action==='desk-pay-request'||action==='desk-pay-confirm'||action==='desk-pay-cancel'){const model=deskModel(s.project)||{},kst=new Date(Date.now()+9*3600000);if(model.payDays)kst.setUTCDate(kst.getUTCDate()+model.payDays);openDialog(action,{number:model.number,amount:model.payAmount,dueDate:model.payDays?kst.toISOString().slice(0,10):''});return;} // i18n-skip
  if(action==='desk-ask'){const model=deskModel(s.project);openDialog('desk-ask',{...trOf(),suggested:(model?.checks||[]).filter(item=>!item.ok&&/없어요$/.test(item.label)).map(item=>item.label.replace(/[이가]? ?없어요$/,'').trim()).join('\n')});return;}
  if(action==='desk-direction'){const r=s.project.studio?.request||{},d=r.directionProposal,a=r.answers||{},pkg=PACKAGES.find(item=>item.id===a.package),today=new Date(Date.now()+9*3600000);today.setUTCDate(today.getUTCDate()+(pkg?.days||14));const models=[...CASTING_MODELS].sort((x,y)=>Number(MODEL_LINES[y.id]?.fits?.includes(a.kind)||0)-Number(MODEL_LINES[x.id]?.fits?.includes(a.kind)||0));openDialog('desk-direction',{...trOf(),...(d?.status==='open'?{lead:d.lead,options:d.options,modelId:d.modelId,price:d.price,dueDate:d.dueDate,revisions:d.revisions,round:d.round}:{round:d?.status==='declined'?d.round+1:1,prior:d?.status==='declined'?{names:d.options.map(o=>o.name),answer:d.answer}:null,modelId:a.models?.[0]||r.modelProposal?.modelId||'',price:(pkg?.price||0)*10000||'',dueDate:today.toISOString().slice(0,10),revisions:pkg?.revisions??3}),...deskNoModel(a,s.project.studio?.strategy?.data?.castingSelection),models,assets:s.project.studio?.assets||[]});return;}
  if(action==='desk-settle'){const d=s.project.studio?.request?.directionProposal;openDialog('desk-settle',{options:d?.options||[]});return;}
  if(action==='desk-propose'){openDialog('desk-propose',{...trOf(),kind:s.project.studio?.request?.answers?.kind||'',modelId:s.project.studio?.request?.modelProposal?.modelId||''});return;}
  if(action==='desk-send'){const st=s.project.studio||{},scenes=(st.scenes||[]).filter(scene=>scene.visibility==='customer'),round=st.request?.rounds?.at(-1);openDialog('desk-send',{...trOf(),flow:!!st.request?.paymentFlow,paid:!st.request?.paymentFlow||st.request?.payment?.status==='confirmed'||st.request?.answers?.package==='photo'&&!(st.request?.rounds||[]).some(item=>item.kind==='images'&&item.approvedAt),trMissing:sceneTrMissing(scenes),count:scenes.length,kind:scenes.length&&scenes.every(scene=>scene.assetId||scene.imageUrl)?'images':'script',oneLine:round?.oneLine||st.strategy?.data?.primaryPromise||deskModel(s.project)?.note?.lines?.[0]||''});return;}
  if(action==='open-round-submit'){const box=main.querySelector('.round-submit');if(box){box.open=true;box.scrollIntoView({block:'center'});box.querySelector('[name=representativeName]')?.focus({preventScroll:true});}return;}
  if((action.startsWith('round-')||action.startsWith('deliverable-'))&&(busy||loading))return;
  if(await production.click(button))return;
  if(action==='strategy-discard'){if(busy||loading)return;drafts.delete([identity(),'strategy',''].join(':'));closeDialog();render();notice('쓰던 내용을 되돌렸어요. 저장된 제작 설계가 보여요.');return;} // i18n-skip
  if(['request-strategy-review','confirm-strategy','confirm-strategy-save'].includes(action)){
    if(drafts.has([identity(),'strategy',''].join(':'))){notice(strategyUnsavedReviewMessage(s.project.studio?.strategy));s.tab='strategy';closeDialog();render();return;}
    if(action==='request-strategy-review')await mutate(()=>studioAction('request_strategy_review'),{message:'고객에게 제작 설계 확인을 요청했어요.'}); // i18n-skip
    if(action==='confirm-strategy')openDialog('strategy-confirm',s.project.studio.strategy);
    if(action==='confirm-strategy-save')await mutate(()=>studioAction('confirm_strategy',{strategyRevision:Number(button.dataset.revision)}),{message:'제작 설계를 확인했어요.',after:closeDialog}); // i18n-skip
    return;
  }
  if(action==='kickoff-reference'||action==='kickoff-strategy'){if(busy||loading)return;if(roomCustomer()){showRoomPaper('kickoff');return;}s.tab=action==='kickoff-reference'?'direction':'strategy';render();const form=main.querySelector(action==='kickoff-reference'?'[data-form=reference]':'[data-form=strategy]');if(form){const details=form.closest('details');if(details)details.open=true;const input=form.querySelector('input:not([type=hidden]),textarea,select');const group=input?.closest('details');if(group)group.open=true;form.scrollIntoView({block:'start',behavior:'auto'});input?.focus({preventScroll:true});}return;}
  if(action==='changes-strategy'){if(busy||loading)return;if(roomCustomer()){showRoomPaper('changes');return;}s.tab='strategy';render();const agreement=main.querySelector('.strategy-agreement');if(agreement){agreement.setAttribute('tabindex','-1');agreement.focus({preventScroll:true});agreement.scrollIntoView({block:'center',behavior:'auto'});}return;}
  if(action==='changes-scene'){if(busy||loading||s.mode!=='staff')return;if(!s.project.studio?.scenes?.some(scene=>scene.id===id)){notice('이 장면이 바뀌었어요. 최신 내용을 불러와 주세요.');return;}s.tab='storyboard';render();const card=Array.from(main.querySelectorAll('.scene-card')).find(node=>node.id==='scene-'+id);if(card){card.setAttribute('tabindex','-1');card.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:'auto'});}return;} // i18n-skip
  if(action==='casting-code-save'){if(busy||loading)return;const form=main.querySelector('[data-form=strategy]'),item=readCastingCode(button.dataset.code).items[0],otherEdits=!!form&&Object.keys(drafts.get(draftKey(form))?.values||{}).some(name=>!name.startsWith('cast_'));if(!form||!applyCastingItem(form,item)){notice('모델·스타일 칸을 찾지 못했어요. 「최신 내용 불러오기」를 누른 뒤 다시 저장해 주세요.');return;}const invalid=form.querySelector('input:invalid,textarea:invalid,select:invalid');if(invalid){for(let group=invalid.closest('details');group;group=group.parentElement?.closest('details'))group.open=true;invalid.scrollIntoView({block:'center'});invalid.reportValidity();notice('조합은 채웠어요. 제작 설계에서 표시한 칸을 고친 뒤 저장해 주세요.');return;}castingCodeSave={item,otherEdits,text:button.closest('.casting-code')?.querySelector('[data-casting-code]')?.value??''};form.requestSubmit();return;} // i18n-skip
  if(action==='casting-open'){const section=main.querySelector('.casting-configurator');const group=section?.closest('details');if(group)group.open=true;if(section){section.scrollIntoView({block:'start',behavior:'auto'});section.querySelector('input')?.focus({preventScroll:true});}return;}
  if(action==='version-pick'){const video=main.querySelector('#review-video'),at=video?.dataset.holding?0:(video?.currentTime||0),playing=!!video&&!video.paused;s.versionId=id;s.compare=false;render();const next=main.querySelector('#review-video');if(next&&next.dataset.version===id&&at){const jump=()=>{next.currentTime=Math.min(at,next.duration||at);if(playing)next.play().catch(()=>{});};if(next.readyState>=1)jump();else next.addEventListener('loadedmetadata',jump,{once:true});}return;}
  if(action==='review-panel'){s.reviewPanel=button.dataset.panel;render();if(s.reviewPanel==='ask')main.querySelector('.review-form textarea')?.focus({preventScroll:true});return;}
  if(action==='tab'){const toContent=button.dataset.scroll==='content',toInquiry=button.dataset.scroll==='inquiry',toDeliverables=button.dataset.scroll==='deliverables';s.tab=button.dataset.tab;if(toInquiry)s.reviewPanel='ask';s.error='';render();const target=main.querySelector(toContent?'[data-stage-content]':toInquiry?'.review-form':toDeliverables?'.deliverables-panel':'.tab-panel');if(toContent||toInquiry||toDeliverables){target?.scrollIntoView({block:'start',behavior:'auto'});if(toInquiry)target?.querySelector('textarea')?.focus({preventScroll:true});}else if(typeof window.scrollTo==='function')window.scrollTo(0,0);return;}
  if(action==='mood'){const field=button.closest('form').elements.mood;const moods=field.value.split(',').map(v=>v.trim()).filter(Boolean),value=button.dataset.value;field.value=moods.includes(value)?moods.filter(v=>v!==value).join(', '):[...moods,value].join(', ');button.setAttribute('aria-pressed',String(!moods.includes(value)));field.dispatchEvent(new Event('input',{bubbles:true}));return;}
  if(action==='image'){openDialog('image',{src:button.dataset.src,label:button.dataset.label});return;}
  if(action==='choose-concept'){const item=s.project.studio.concepts.find(c=>c.id===id);if(item)openDialog('choose',item);return;}
  if(action==='edit-concept'||action==='edit-scene'){s.editor={type:action==='edit-concept'?'concept':'scene',id:id||''};render();document.querySelector(`[data-form=${s.editor.type}]`)?.scrollIntoView({block:'start'});return;}
  if(action==='cancel-editor'||action==='close-editor'){s.editor=null;render();return;}
  if(action==='review-scene'){const item=s.project.studio.scenes.find(c=>c.id===id);if(item)openDialog('scene',item);return;}
  if(action==='confirm-scene'||action==='confirm-scene-request'){if(await mutate(()=>studioAction('review_scene',sceneConfirmation(s,button.dataset)),{message:'장면 확인을 남겼어요.'}))Array.from(main.querySelectorAll('.scene-card')).find(node=>node.id==='scene-'+id)?.querySelector('[data-action=review-scene]')?.focus({preventScroll:true});return;} // i18n-skip
  if(action==='comment'){const type=button.dataset.target,item=s.project.studio[type==='concept'?'concepts':'scenes'].find(c=>c.id===id);if(item)openDialog('comment',{...item,type});return;}
  if(action==='move-scene'){const ids=s.project.studio.scenes.map(c=>c.id),from=ids.indexOf(id),to=from+Number(button.dataset.direction);if(from>=0&&to>=0&&to<ids.length){[ids[from],ids[to]]=[ids[to],ids[from]];await mutate(()=>studioAction('reorder_scenes',{ids}),{message:'장면 순서를 바꿨어요.'});}return;} // i18n-skip
  if(action==='reference-opinion'){const ref=s.project.studio.references.find(r=>r.id===id);if(ref)openDialog('reference',ref);return;}
  if(action==='remove-reference'){confirmAction=()=>mutate(()=>studioAction('remove_reference',{id}),{message:'참고자료를 지웠어요.',after:closeDialog});openDialog('confirm',{title:'이 참고자료를 지울까요?',text:'이 참고자료와 남긴 설명이 프로젝트에서 사라져요.',button:'지우기'});return;} // i18n-skip
  if(action==='show-version'||action==='hide-version'){s.showVersion=action==='show-version';render();if(s.showVersion)document.querySelector('#version-form')?.scrollIntoView({block:'start'});return;}
  if(action==='compare'){s.compare=!s.compare;render();return;}
  if(action==='use-time'){const video=document.querySelector('#review-video'),field=document.querySelector('[name=seconds]');if(video&&field){video.pause();field.value=String(Math.round(video.currentTime*10)/10);field.dispatchEvent(new Event('input',{bubbles:true}));notice(t('지금 장면의 시간을 의견에 넣었어요.'));if(button.dataset.focusComment==='true'){const text=document.querySelector('[data-form=feedback] [name=text]');text?.scrollIntoView({block:'center'});text?.focus({preventScroll:true});}}return;}
  if(action==='review-approval'){const card=document.querySelector('#review-approval');card?.scrollIntoView({block:'center'});card?.focus({preventScroll:true});return;}
  if(action==='seek'){if(s.tab==='contact')s.tab='review';s.versionId=button.dataset.version||s.versionId;render();const video=document.querySelector('#review-video');if(video){const seek=()=>{video.currentTime=Math.min(Number(button.dataset.seconds)||0,Number.isFinite(video.duration)?video.duration:86400);video.pause();};if(video.readyState>=1)seek();else video.addEventListener('loadedmetadata',seek,{once:true});video.scrollIntoView({block:'center'});}if(button.dataset.text)notice(clock(Number(button.dataset.seconds)||0)+' · '+button.dataset.text);return;}
  if(action==='confirm-delivery'){if(busy||loading||s.mode!=='customer'||!s.project.closeout?.canConfirm)return;const c=s.project.closeout;const files=c.files.map(file=>({...file,guide:s.project.versions.find(version=>version.id===file.id)?.guide||''}));drafts.delete([identity(),'confirm-delivery',c.deliveryKey].join(':'));openDialog('delivery-confirm',{deliveryKey:c.deliveryKey,revision:s.project.revision,files});return;}
  if(action==='approve'){const approval=previewApprovalState(s.project,{demo:!!demo});if(!approval.canApprove){notice(approval.reason);return;}const latest=latestPreview();if(s.versionId&&s.versionId!==latest?.id){notice(t('최신 시안을 먼저 열어 주세요.'));return;}const roundDrafts=s.project.studio?.feedbackRounds?.drafts||[];if(roundDrafts.some(d=>d.current&&d.items?.length)||hasDraft('round-draft')){notice(t('모은 수정 의견을 보내거나 초안을 비운 뒤 승인해 주세요.'));return;}const form=document.querySelector('[data-form=feedback]');if(form?.elements.text?.value.trim()){notice(t('쓰던 의견을 먼저 보내거나 지운 뒤 승인해 주세요.'));return;}if(latest&&latest.id===id)openDialog('approve',{...latest,revision:s.project.revision});return;}
  if(action==='approve-confirm'){if(busy)return;const approval=previewApprovalState(s.project,{demo:!!demo});if(!approval.canApprove){notice(approval.reason);closeDialog();return;}if(id!==latestPreview()?.id){notice(t('새 시안이 왔어요. 최신 시안을 보고 승인해 주세요.'));closeDialog();return;}await mutate(()=>request('/pulse/api/action',{...options(),body:{action:'approve',versionId:id,revision:Number(button.dataset.revision)}}),{message:t('시안을 승인했어요. 이 시안으로 최종본을 만들어요.'),after:closeDialog});return;}
  if(action==='resolve'){await mutate(()=>request(staffPath('/resolve'),{...options(),body:{revision:s.project.revision,messageId:id}}),{message:'의견을 처리했어요.',after:async()=>loadProject(s.project.id)});return;} // i18n-skip
  if(action==='workflow'){await mutate(()=>request('/api/client-workflow',{...options(),body:{projectId:s.project.id,messageId:id,revision:s.project.revision,action:button.dataset.workflow}}),{workflowAction:{messageId:id,action:button.dataset.workflow},message:'검토 상태를 바꿨어요.',after:async()=>loadProject(s.project.id)});return;} // i18n-skip
  if(action==='invite'){await mutate(()=>request(staffPath('/invite'),{...options(),body:{revision:s.project.revision}}),{message:'초대 링크를 만들었어요. 고객에게 보내 주세요.',after:async result=>{s.inviteUrl=location.origin+'/pulse-app/#invite='+encodeURIComponent(result.invite);await loadProject(s.project.id);}});return;} // i18n-skip
  if(action==='revoke'){confirmAction=()=>mutate(()=>request(staffPath('/revoke'),{...options(),body:{revision:s.project.revision}}),{message:'고객 접근을 끊었어요.',after:async()=>{s.inviteUrl='';closeDialog();await loadProject(s.project.id);}});openDialog('confirm',{title:'고객 접근을 끊을까요?',text:'보낸 초대 링크로는 더 이상 열리지 않아요. 다시 열어 주려면 새 초대 링크를 만들어 주세요.',button:'접근 끊기'});return;} // i18n-skip
  if(action==='copy-invite'){try{await navigator.clipboard.writeText(s.inviteUrl);notice('초대 링크를 복사했어요.');}catch{const field=document.querySelector('[name="invite-url"]');field?.focus();field?.select();notice('여기서는 자동 복사가 안 돼요. 선택된 링크를 직접 복사해 주세요.');}} // i18n-skip
});

// 「캐스팅북 코드로 채우기」 접힘: toggle은 한 박자 뒤에 와서, 접자마자 탭을 옮기면 떨어져 나간 칸에서 울려 놓친다 — 누르는 순간에도 적어 둔다.
document.addEventListener('click',event=>{const details=event.target?.closest?.('details.casting-code>summary')?.parentElement;if(details?.matches?.('details.casting-code'))s.castingCodeOpen=!details.open;},true);
// 언어 메뉴(다국어 판 2): 고르는 단추(data-set-locale)는 첫 화면 · 머리 · 의뢰서 어디에 있든 여기 한 곳에서 받는다. locale-menu가 고른 언어를 기억하고 소식(LOCALE_EVENT)을 보낸다.
document.addEventListener('click',event=>{const choice=event.target?.closest?.('[data-set-locale]');if(!choice||choice.disabled)return;event.preventDefault();void chooseLocale(choice.dataset.setLocale);});
// 소식을 받으면 지금 화면을 새 언어로 다시 그린다(읽던 자리 · 쓰던 글은 그대로). 의뢰서는 스스로 다시 그리고 그 뒤 화면은 의뢰서를 닫을 때, 예시는 한국어로만 돈다. 직원 화면은 늘 한국어다.
window.addEventListener(LOCALE_EVENT,()=>{if(s.mode!=='customer'||demo)return;paintShell();if(flow||flowOpening||filmDemo||models)return;const pressed=!!document.activeElement?.closest?.('[data-set-locale]');render(s.project?{remote:true}:{});if(pressed)document.querySelector(`[data-set-locale="${locale()}"]`)?.focus({preventScroll:true});});
// 머리 하나(판 3): 앱 머리의 프로젝트 이름 · 단계 줄 · 「담당자에게 묻기」는 main 밖이라 여기서 받는다.
document.querySelector('.app-header')?.addEventListener('click',event=>{if(!roomCustomer())return;const go=event.target.closest('[data-room-go]');if(go){if(!go.disabled)goRoom(go.dataset.roomGo);return;}const ask=event.target.closest('[data-room-do="journal"]');if(ask){if(s.journalOpen&&journalOverlay(journalBox()))closeJournal();else openJournal({opener:ask});}});
// 일지(판 3b): 1차안 화면에는 mountRoom이 붙지 않으므로 일지 안 누르기 · 글 · 파일은 여기 한 곳에서 받는다.
main.addEventListener('click',event=>{
  if(!roomCustomer())return;
  const act=event.target.closest('[data-journal-do]')?.dataset.journalDo;
  if(act==='close'){closeJournal();return;}
  if(act==='more'){s.journalAll=!s.journalAll;render();journalBox()?.querySelector('[data-journal-do="more"]')?.focus({preventScroll:true});return;}
  const go=event.target.closest('[data-journal-go]');if(go){goRoom(go.dataset.journalGo,{versionId:go.dataset.version||''});return;}
  const ask=event.target.closest('[data-room-do="journal"]');if(ask)openJournal({opener:ask});
});
main.addEventListener('input',event=>{const area=event.target;if(area?.matches?.('[data-journal] textarea[data-grow]')){area.style.height='auto';area.style.height=`${area.scrollHeight+2}px`;}});
main.addEventListener('change',event=>{if(!event.target?.matches?.('[data-journal] [data-ask-file]'))return;const name=event.target.closest('label')?.querySelector('[data-ask-name]');if(name)name.textContent=event.target.files?.[0]?.name||t('파일 고르기');});
// 창으로 돌아오면 그사이 화면에 있던 일지를 「봤다」로. 창 폭 · 방향이 바뀌어 시트가 단이 되면 연 상태를 푼다.
window.addEventListener('focus',()=>{if(journalSeenLater)markJournalSeen();void recheckIntake();void recheckStaffIntake();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&journalSeenLater)markJournalSeen();if(!document.hidden){void recheckIntake();void recheckStaffIntake();}});
window.matchMedia?.(JOURNAL_SHEET)?.addEventListener?.('change',()=>{if(s.journalOpen&&!journalOverlay(journalBox())){s.journalOpen=false;journalOpener=null;setJournalOpen(false);}});
// Esc: 의견 묶음 시트 · 대화상자가 먼저, 그다음 일지 서랍 · 시트.
document.addEventListener('keydown',event=>{if(event.key!=='Escape'||!s.journalOpen||document.querySelector('.sx-round-sheet[open],dialog[open]'))return;closeJournal();});
window.addEventListener('hashchange',queueInviteNavigation);
dialog.addEventListener('close',()=>{if(inviteNavigationPrompt&&!dialog.open)cancelInviteNavigation();scheduleInviteNavigation();});
document.addEventListener('compositionend',scheduleInviteNavigation);
document.addEventListener('pulse-preview-playback',scheduleApply);
document.addEventListener('pause',scheduleApply,true);
document.addEventListener('ended',scheduleApply,true);
window.addEventListener('beforeunload',event=>{if(drafts.size||busy){event.preventDefault();event.returnValue='';}});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();s.installPrompt=event;updateInstallGuide();});
window.addEventListener('appinstalled',()=>{s.installPrompt=null;s.installed=true;notice(t('PULSE를 설치했어요. 홈 화면에서 열고 기기 알림을 켜 주세요.'));updateInstallGuide();});
const connectivity=()=>{document.querySelector('#connection-banner').hidden=navigator.onLine;};
window.addEventListener('online',connectivity);window.addEventListener('offline',connectivity);connectivity();
if(filmDemo)void openFilmDemo();if(startRequest)void openPublicRequest();
if(demo){accept(demo.snapshot());s.tab=demo.guide().tab;render();}else{render();await start(parseInvite(initialInvite));if(memberReturn||LOGIN_FAILED)void resumeMemberReturn();}initialInvite='';
// 첫 방문 무게(11-11): 서비스 워커(셸 미리 받기 — 화면 모듈 · 글꼴 · 모델 사진)는 문서가 다 불러진 뒤 쉴 때 등록한다.
// 첫 방문에 셸을 바로 받으면 느린 연결에서 의뢰서 · 첫 화면과 대역을 나눈다(판 6 점검 E). 다음 방문부터는 셸이 그대로 돈다.
const afterLoadIdle=fn=>{const go=()=>setTimeout(()=>typeof requestIdleCallback==='function'?requestIdleCallback(fn,{timeout:5000}):fn(),1500);if(document.readyState==='complete')go();else addEventListener('load',go,{once:true});};
afterLoadIdle(()=>{if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('./sw.js',{scope:'/pulse-app/'}).catch(()=>{});});
// 한국어 손님 화면에서 손님이 한글을 쓸 수 있는 글 칸에 들어오면 SYNK Sans의 남은 조각(화면 원문에 없는 음절 — 저장소의 글꼴 조각 도구가 나눈다)을
// 받아 둔다 — 손님이 쓰는 글자가 기기 글꼴로 잠깐 바뀌지 않게. 쓰지 않고 보기만 하는 손님은 받지 않는다. 데이터 절약 · 2G에서는 그 글자가 나올 때 받는다.
// 한글을 칠 일이 없는 칸(메일 · 여섯 자리 코드 · 링크 · 전화번호 — 「내 프로젝트 다시 열기」 판은 열릴 때 저절로 초점이 간다)과
// 직원 화면(이 글꼴을 쓰지 않는다)에서는 받지 않는다. 끊긴 동안에도 받지 않는다(받기가 실패하면 그 면이 오류로 굳어 다시 이어져도
// 새로고침 전까지 안 받는다). 명조 나머지는 손님 글이 제목에 나올 때만 받는다.
const HANGUL_FIELD='textarea,input:not([type]),input[type=text],input[type=search]';
const NOT_HANGUL_FIELD='[inputmode=numeric],[inputmode=decimal],[inputmode=url],[inputmode=email],[inputmode=tel],[autocomplete=one-time-code]';
let restFontAsked=false;
document.addEventListener('focusin',event=>{const field=event.target;if(restFontAsked||s.mode!=='customer'||locale()!=='ko'||leanData()||!navigator.onLine||!document.fonts||!field?.matches?.(HANGUL_FIELD)||field.matches(NOT_HANGUL_FIELD))return;restFontAsked=true;for(const face of document.fonts)if(face.family.replace(/["']/g,'')==='SYNK Sans'&&face.status==='unloaded')face.load().catch(()=>{});});


