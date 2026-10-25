import {WorldClient} from './world-client.mjs';
import {mountEnrollment} from './enrollment.mjs';
import {mountClassroomLessons} from './classroom-lessons.mjs';
import {mountClassroomHomework,homeworkWeek} from './classroom-homework.mjs';
import {createWorldAccount,loadWorldConfig,createLifeProgressPort,createLocalWorldLearningHost,worldLearning,createWorldLearningPlan,GUEST_TRIAL_GAMES,createGuestTrials,createGuestTrialPlayHost,createDeviceRecordsOffer,noteDeviceSignOut,noteDeviceAccount,worldPosition,worldTownCheck,mountCourseWritingEntry} from './world-account.bundle.mjs';
import {createWorldEducation} from './world-learning-ui.mjs';
import {PACKS,LESSONS} from './life-content.mjs';
import {createLifeProgress} from './life-progress.mjs';
import {restoreTutorSelection,commitTutorSelection,tutorSelectionStatus,createWorldEntryGate} from './tutor-selection-sync.mjs';
import {createLifeExperience} from './life-ui.mjs';
import {createWritingPractice,writingRow,loadWritingBank,writingReady,WRITING_CANDIDATES,readWritingSummary} from './world-writing-practice.mjs';
import {createWorldReminders,createTrailTimes} from './world-reminder-device.mjs';
import {createWorldPush} from './world-push.mjs';
import {createTownWorldHost} from './world-town-client.mjs';
import {createLifeSession,sheetResource} from './world-session.mjs';
import {WARDROBE_ITEMS} from '../synk-world-home/wardrobe-catalog.mjs';
import {createWorkbenchStorage,thumbnailKey,wardrobeThumbnailCache} from '../synk-world-home/wardrobe-workbench.mjs';
// 효과음·연출 스위치(리드 모듈). 앱의 첫 놀이 함수 이름 play와 겹치지 않게 playSound로 받는다.
import {play as playSound,getPref} from '../brand-opening/world-sound.mjs'
import {profilePhoto,welcomePhoto} from '../brand-opening/tutor-photos.mjs';
// 화면 언어(10-19 1판): 계정 연결·로그인 안내·저장 확인·오류는 고른 언어로. 첫 문장 놀이·타운·노래 화면은 2판까지 한국어다.
import {t,tMessage} from '../brand-opening/world-lang.mjs';
import {restoreDisplayLanguage,commitDisplayLanguage} from './display-language-sync.mjs';
const $=s=>document.querySelector(s);
// pagehide closes this capability object; a restored document must reverify it.
// 첫 await보다 먼저 듣는다: 입장(세션 복원·학습 준비·오프닝)이 끝나기 전에 떠났다가 돌아온 문서도 다시 불러야 한다(10-19).
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
const connection=await loadWorldConfig();
const operating=connection.mode==='account';
// 학습자 응답(WORLD 학습자 응답 설계 §6): 설정값 worldFeedback이 켜졌을 때만 연습 끝 화면의 「이번 연습 어땠어요?」와 「내 계정」의 응답 목록이 있다(기본 꺼짐).
const responsesOn=connection.features?.worldFeedback===true;
// 10-19 결정 「WORLD 손님」(공개판 설계 §2): 손님(로그인 전)에게 한글 만나기를 연다 — 진도는 그 기기에 남는다.
// 바람길·말의 리듬은 한 판씩 체험으로 연다(guest-trial.mjs, 기록·코인은 로그인 뒤). 체험을 마친 게임은 로그인부터 열고, 추천도 같은 목록을 쓴다.
const GUEST_GAMES=new Set(['hangul']);
const guestTrials=createGuestTrials({storage:(()=>{try{return localStorage;}catch{return null;}})()});
const guestGames=()=>[...GUEST_GAMES,...guestTrials.open()];
const worldUrl=path=>new URL(connection.basePath+path,location.origin).href;
const {firstSupport}=await import(worldUrl('brand-opening/game-tutor-support.mjs'));
const home=window.__synkHome||(await import(worldUrl('brand-opening/home.mjs'))).home;
// 자원 수명은 두 갈래다(world-session.mjs). 계정 수명 — life: 지금 주인·세대의 생활 진도 통로·진도·학습 호스트·「내 성향」 답·배우기 화면(생활·학습·알림).
// 시트 수명 — sheet: 지금 시트 하나에 딸린 자원(내 계정의 우리 반 수업·과제·반 연결, 싱크타운 호스트). 시트를 바꾸거나 닫으면 버린다(attachSheet·releaseSheet).
let client,sheet=null,writing=null,writingOwner=null;
let entryGate=null,worldRequested=false,sessionTask=null,sessionConfirmed=false,accountActionPending=false,entryIdentity='',entryDestinationHandled=false;
let finishInitialRestore;const initialRestoreReady=new Promise(resolve=>{finishInitialRestore=resolve;});
// Loading and session restoration run behind the company splash. A failed
// optional opening must never disable the existing account or guest entrance.
function startOpening(replay=false){
 worldRequested=false;entryGate?.invalidate();home.setSceneActive?.(false);home.setEntryState?.({phase:'restoring'});
 return import(worldUrl('brand-opening/opening.mjs')).then(async({mountBrandOpening})=>{
  const opening=mountBrandOpening({replay,reducedMotion:home.state.reduced});window.__synkOpening=opening;
  const reason=await opening.done;
  if(['pagehide','destroy'].includes(reason))return;
  worldRequested=true;await initialRestoreReady;return entryGate?.start();
 }).catch(()=>{document.querySelector('.synk-opening')?.remove();document.querySelector('#synk-opening-cover')?.remove();clearTimeout(window.__synkOpeningSafetyTimer);worldRequested=true;return initialRestoreReady.then(()=>entryGate?.start());});
}
const openingReady=startOpening();
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let screen='',draftRun=null,answers=[],questionIndex=0,lastCompletion=null,wardrobeStudio=null,gameLaunch=0,activeGameSession=null,gameRecovery=null;
const wardrobeRequested=new URLSearchParams(location.search).get('wardrobe')==='1';
// 주소의 ?exam=topik1|topik2(10-22, 메일·신청 페이지의 무료 연습 링크): 첫 실행을 마치고 들어온 뒤 그 시험을 채운 학습 목표 창(이미 그 목표면 이번 주 계획)을 연다 — openExamLink.
const examRequested=(value=>['topik1','topik2'].includes(value)?value:null)(new URLSearchParams(location.search).get('exam'));
async function restoreConnectedHome(){
 try{
  const restored=await restoreSession();
  if(restored&&client.snapshot&&screen==='world-signin'&&home.openPanel?.()==='world-signin'){
   close();home.toast(t('account.connected'));
  }
  if(worldRequested)await entryGate?.start();
 }catch(error){if(!['ACCOUNT_CHANGED','STALE_RESPONSE'].includes(error.code))showEntryRecovery();}
}
async function restoreSession(){
 if(sessionTask)return sessionTask;
 sessionConfirmed=false;
 const task=client.restore();sessionTask=task;
 try{const restored=await task;sessionConfirmed=true;return restored;}finally{if(sessionTask===task)sessionTask=null;}
}
const account=operating?createWorldAccount({config:connection.account,onInvalidate:()=>{sessionConfirmed=false;client?.invalidate();},onConnect:restoreConnectedHome}):null;
// 계정 수명(E01): 지금 주인(계정 id·손님)·세대의 생활 자원은 이 세션이 세우고 버린다. 앱 셸은 무엇을 만들지만 넘기고,
// WorldClient가 바뀔 때마다 onClientChange가 맞춘다(life.sync). 그리기(renderStatus)는 자원을 만들거나 버리지 않는다.
const life=createLifeSession({
 identity:()=>({owner:client.snapshot?.accountId||'guest',generation:client.generation}),
 openPort:({owner,guard,onStatus})=>operating?account.prepareLifeProgress({storage:localStorage,onStatus})
  :createLifeProgressPort({accountId:owner,guard,storage:localStorage,onStatus,client:{load:()=>client.request('life-progress'),mutate:body=>client.request('life-progress',{method:'POST',body})}}),
 createProgress:lifeProgressFor,
 // 학습 호스트: 로컬 확인 계정은 이 기기 호스트를 세우고(세션이 버린다), 운영 계정은 계정(account)이 갖고 버리는 게임 호스트를 기다리기만 한다(실패해도 생활 진도는 연다).
 prepareHost:({owner,guard})=>owner==='guest'?null:operating?account.prepareGame({target:window}).then(()=>null,()=>null):createLocalWorldLearningHost({owner,guard,target:window,storage:localStorage}),
 readAnswers:({owner})=>operating&&owner!=='guest'?account.topicAnswers?.():null,
 mountView:mountLifeLearning,
 // 새 기록마다 2단(world-push)에 지금 주인을 알린다(같은 주인이면 아무것도 하지 않는다).
 onLoading:({owner})=>{worldPush?.setAccount(owner==='guest'?null:owner);home.updateLearning?.({owner,completed:0,total:LESSONS.length,packs:PACKS,nextLesson:null,resume:false,dueCount:0,status:{phase:'loading'}});},
 onStatus:status=>{refreshLife();if(status.phase==='conflict'&&!life.recoveryShown&&home.openPanel().startsWith('life-'))showLifeRecovery();},
 onReady:()=>{restoreTutor();refreshLife();openReminderLink();},
 onAnswers:()=>life.education?.refresh(),
 onError:error=>home.toast(error.message||'생활 진도를 확인하지 못했어요.'),
});
client=new WorldClient({onChange:onClientChange,account});
// 학습 알림 2단 · 앱을 닫아도 받기(world-push.mjs, 설계 qa/push-reminders-20261022): 설정값 worldPush가 켜졌을 때(기본 꺼짐), 계정 모드의 웹에서만
// (PC 앱 창은 푸시 서비스가 없다). 꺼져 있으면 2단의 줄·안내·상태 읽기가 모두 없다. 서비스 워커는 WORLD 뿌리(/world/world-push-sw.js, 범위 /world/)다.
// 계정 주인이 바뀌면 생활 세션이 새 기록을 세울 때(life의 onLoading) setAccount로 알린다.
const pushOn=connection.features?.worldPush===true;
const worldPush=operating&&pushOn&&account?.supportsPush?createWorldPush({request:(action,body,options)=>account.pushRequest(action,body,options),
 anonymous:(action,body,options)=>account.pushAnonymous(action,body,options),env:window,storage:(()=>{try{return localStorage;}catch{return null;}})(),
 workerUrl:worldUrl('world-push-sw.js'),scopeUrl:worldUrl('')}):null;
// 2단 상태가 바뀌면(다른 기기에서 켬·끔 등) 1단을 다시 잡는다 — 2단이 켜진 계정이면 1단은 쉰다(설계 §6).
worldPush?.subscribe(()=>life.reminders?.schedule());
// 2단 알림을 눌러 들어온 주소(world-push-sw.js): ?reminder=<종류>&ack=<토큰>. 주소에서 지우고 누름을 한 번 더 알린 뒤(워커가 못 알렸을 때 —
// 서버는 토큰을 한 번만 쓴다), 그 자리는 이 탭에 30분 두었다가 입구가 끝나고 계정 학습이 준비되면 연다(openReminderLink). 로그인이 풀린 새 창이면
// 로그인한 뒤에 연다(OAuth는 같은 탭으로 돌아온다).
const REMINDER_LINK='synk.world.reminder.link';
function storeReminderLink(kind){if(['review','plan','exam'].includes(kind))try{sessionStorage.setItem(REMINDER_LINK,JSON.stringify({kind,at:Date.now()}));}catch{}}
{const url=new URL(location.href),kind=url.searchParams.get('reminder'),ack=url.searchParams.get('ack');
 if(kind!==null||ack!==null){url.searchParams.delete('reminder');url.searchParams.delete('ack');history.replaceState(history.state,'',url.href);storeReminderLink(kind);if(ack)worldPush?.ack(ack);}}
// 이미 열린 WORLD 창에서 알림을 누르면 워커가 그 창에 알린다.
navigator.serviceWorker?.addEventListener?.('message',event=>{const data=event.data;if(data?.type!=='synk-world-reminder-open')return;storeReminderLink(data.kind);if(data.token)worldPush?.ack(data.token);openReminderLink();});
const stateLine=document.createElement('div');stateLine.className='world-state';stateLine.setAttribute('role','status');
if(!home.isMaru){
 $('.page-heading').after(stateLine);
 $('.preview-label').textContent=operating?'MY SYNK WORLD':'연결 개발판';$('.local-note').innerHTML=`<span class="status-dot"></span>${operating?'SYNK ID · 내 세계 연결':'로컬 서버 연결'}`;
 $('.hero-footnote').textContent='첫 문장 놀이 · 짧은 문장 3개';
 $('.hero-copy .felt-button').innerHTML='첫 놀이 시작하기 <span aria-hidden="true">→</span>';
}
// 시트 머리의 영문 모노 라벨: 그 시트가 무엇인지 짧게(한글은 모노로 쓰지 않는다).
const EYEBROWS={'world-reminder':'REMINDER','world-writing':'WRITING','world-profile':'ACCOUNT','world-signin':'ACCOUNT','world-entry-recovery':'ACCOUNT','world-device-records':'ACCOUNT','world-welcome':'SYNK WORLD','world-about':'ABOUT','world-wardrobe':'WARDROBE','world-pending':'SAVE','life-recovery':'SAVE','world-game-conflict':'SAVE','world-play':'FIRST SENTENCE','world-retry':'FIRST SENTENCE','world-reward':'RESULT · FIRST SENTENCE','world-town':'TOWN','game':'PLAY','world-game-loading':'PLAY','world-game-error':'PLAY','world-songs':'SONGS','world-song':'SONGS'};
function show(title,html,type='world',extra={}){gameLaunch++;if(type!=='world-game-conflict')gameRecovery=null;releaseSheet();screen=type;home.showPanel(title,html,{type,eyebrow:EYEBROWS[type]||'SYNK WORLD',...extra});}
// 시트 수명(E01): 지금 시트에 딸린 자원은 한 칸(sheet)이 갖고, 버리는 때는 네 곳뿐이다 — 다른 시트를 열 때(show)·닫을 때(close)·
// 패널이 다 닫힌 뒤(close 이벤트, 닫기 효과가 끝난 뒤라 그 사이 칸이 먼저 빠지지 않는다)·pagehide. 몇 번 불러도 한 번만 버린다.
// 계정 수명(life)과 따로 간다 — 계정이 바뀌면 그 시트를 닫아 같은 길로 버린다. hasDraft는 지금 시트의 내지 않은 원고(원고 닫기 확인)다.
function attachSheet(dispose,extra){releaseSheet();sheet=sheetResource(dispose,extra);return sheet;}
function releaseSheet(){const current=sheet;sheet=null;current?.dispose();}
// 안내 블록(LED 점 + 모노 라벨 + 제목 + 글). tone: ok·info·check·alert
const notice=(label,tone,title,body)=>`<div class="world-notice" data-tone="${tone}" data-label="${label}"><strong>${title}</strong><span>${body}</span></div>`;
// Ordinary navigation may discard an unsent manuscript only after the learner sees the consequence.
// Identity/permission invalidation still disposes directly and never retains account-owned text.
const confirmCourseExit=()=>!sheet?.hasDraft?.()||window.confirm('아직 내지 않은 글이 있어요. 닫으면 쓰던 글이 사라져요. 닫을까요?');
document.addEventListener('click',event=>{if(!sheet?.hasDraft?.())return;const target=event.target.closest?.('#panel-close,[data-view],[data-world],[data-action],[data-world-learning],.ws-me a');if((!target&&event.target.id!=='world-panel')||target?.dataset.world==='logout')return;if(!confirmCourseExit()){event.preventDefault();event.stopImmediatePropagation();}},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sheet?.hasDraft?.()){event.preventDefault();event.stopImmediatePropagation();if(confirmCourseExit())close();}},true);
document.addEventListener('cancel',event=>{if(event.target.id==='world-panel'&&!confirmCourseExit()){event.preventDefault();event.stopImmediatePropagation();}},true);
function close(){gameLaunch++;releaseSheet();screen='';home.closePanel();}
function errorText(error){return {NETWORK_UNAVAILABLE:t('msg.network'),REVISION_CONFLICT:t('msg.outfitConflict'),STALE_RESPONSE:'',AUTH_REQUIRED:t('msg.authEnded'),RUN_EXPIRED:t('msg.runExpired'),BUSY:t('msg.busy')}[error.code]||t('msg.notYet');}

const hanger=document.createElement('section');hanger.className='world-hanger';hanger.setAttribute('aria-label','저장한 차림');hanger.hidden=true;
if(!home.isMaru)document.querySelector('.hero').after(hanger);let hangerGeneration=0,hangerSignature='';
function renderHomeHanger(snap){
 const signature=JSON.stringify([snap?.accountId,snap?.looks,client.busy,!!client.pending]);
 if(signature===hangerSignature)return;hangerSignature=signature;const token=++hangerGeneration;
 hanger.replaceChildren();hanger.hidden=!snap?.looks?.length;if(hanger.hidden)return;
 const heading=document.createElement('h2');heading.textContent='저장한 차림';hanger.append(heading);
 const hint=document.createElement('p');hint.textContent='누르면 바로 갈아입어요. 동네에도 같은 차림으로 가요.';hanger.append(hint);
 const list=document.createElement('div');list.className='world-hanger-list';hanger.append(list);
 const prefs=createWorkbenchStorage({accountId:snap.accountId}).load(),looks=[...snap.looks.filter(l=>prefs.lookFavorites.includes(l.id)),...snap.looks.filter(l=>!prefs.lookFavorites.includes(l.id))].slice(0,3);
 for(const look of looks){
  const card=document.createElement('article'),image=document.createElement('img'),name=document.createElement('strong'),wear=document.createElement('button');
  image.width=320;image.height=180;image.alt=look.name+' 차림';name.textContent=look.name;wear.textContent='입기';wear.className='plain-button';wear.dataset.hangerLook=look.id;wear.disabled=client.busy||!!client.pending;
  const key=thumbnailKey({accountId:snap.accountId,revision:'costume-workbench-v7',slots:look.slots,dyes:look.dyes,view:{}}),cached=wardrobeThumbnailCache.get(key);
  if(cached)image.src=cached;else image.hidden=true;
  card.append(image,name,wear);list.append(card);
  wear.addEventListener('click',async()=>{if(client.busy||client.pending||client.snapshot?.accountId!==snap.accountId)return;try{await client.equip(look.slots,look.dyes||{});home.toast(look.name+' 차림을 입었어요.');}catch(error){home.toast(errorText(error));}});
  if(!cached)queueMicrotask(()=>{if(token!==hangerGeneration||client.snapshot?.accountId!==snap.accountId)return;try{const frame=home.captureLook?.(look.slots,look.dyes||{});if(frame){image.src=frame;image.hidden=false;}}catch{image.alt=look.name+' · 옷장에서 볼 수 있어요.';}});
 }
}

// WorldClient가 바뀔 때마다(로그인·로그아웃·세대·저장 상태): 먼저 계정 경계를 맞추고, 그다음 상태를 그린다.
function onClientChange(){reconcileAccount();renderStatus();}
// 계정 경계: 주인·세대가 바뀌면 입장 관문을 새 주인으로 다시 세우고 생활 세션을 맞춘다(life.sync — 옛 자원은 세션이 버린다).
// 로그아웃이면 계정 화면을 닫는다(close가 그 시트의 자원도 함께 버린다).
function reconcileAccount(){
 const snap=client.snapshot;
 const nextIdentity=`${snap?.accountId||'guest'}:${client.generation}`;
 if(nextIdentity!==entryIdentity){
  entryIdentity=nextIdentity;
  if(worldRequested&&entryGate){
   entryGate.invalidate();
   // setOwner normally reopens an active chooser. Close it before switching
   // owners so restoration cannot briefly expose a guest choice screen.
   if(home.openPanel?.()==='tutor')home.closePanel();
   if(!accountActionPending&&client.status!=='loading')queueMicrotask(()=>{if(worldRequested&&!accountActionPending)void entryGate.start();});
  }
 }
 life.sync();
 if(!snap&&['world-play','world-retry','world-reward','world-profile','world-device-records','game','world-game-loading','world-game-error','world-game-conflict','world-speaking'].includes(screen)){draftRun=null;answers=[];lastCompletion=null;close();}
}
function renderStatus(){
 const snap=client.snapshot;
 renderHomeHanger(snap);
 if(!home.isMaru){if(snap){home.setEquipment(snap.avatar?.slots,snap.avatar?.dyes);$('.page-heading h1').textContent=snap.activeRun?'하던 놀이가 있어요':'첫 문장 놀이부터 시작해요';$('.hero-copy .felt-button').innerHTML=`${snap.activeRun?'이어서 하기':'첫 문장 놀이 시작하기'} <span aria-hidden="true">→</span>`;}
 else {home.setEquipment({});$('.page-heading h1').textContent='첫 문장 놀이부터 시작해요';$('.hero-copy .felt-button').innerHTML='첫 놀이 시작하기 <span aria-hidden="true">→</span>';}
 }
 if(home.isMaru){home.setEquipment(snap?.avatar?.slots||{},snap?.avatar?.dyes||{});home.updateAccount({snapshot:snap,status:client.status,pending:!!client.pending,busy:client.busy,operating});}
 const status=client.status==='offline'?'연결을 기다리고 있어요. 저장 전 내용은 아직 확정되지 않았어요.':client.status==='conflict'?'다른 화면에서 차림이 바뀌었어요. 「저장 확인」을 눌러 이어 갈 차림을 골라 주세요.':client.pending?'아직 저장하지 못한 차림이 있어요.':snap?`내 차림과 옷을 ${operating?'SYNK 계정':'로컬 서버'}에서 불러왔어요.`:'로그인하지 않아도 홈을 둘러볼 수 있어요.';
 stateLine.innerHTML=`<span class="status-dot"></span><span>${status}</span>${client.pending?'<button data-world="pending">저장 확인</button>':client.status==='offline'?'<button data-world="refresh">다시 연결</button>':''}`;
 stateLine.dataset.state=client.status;
 document.querySelectorAll('[data-world-submit]').forEach(el=>{el.disabled=client.busy||client.status==='loading';});
 if(snap&&screen==='world-wardrobe')wardrobeStudio?.update(snap,{busy:client.busy,pending:client.pending,status:client.status});
 if(!snap&&screen==='world-wardrobe'){wardrobeStudio?.dispose();wardrobeStudio=null;signIn();}
}
function lifeSaveStatus(port){
 const status=port?.status();if(!status||operating)return status;
 return {...status,message:status.phase==='synced'?'생활 진도가 이 로컬 확인 계정에 저장됐어요.':status.phase==='saving'?'생활 진도를 로컬 확인 계정에 저장하고 있어요.':status.message};
}
function refreshLife(){
 home.refreshTutorStatus?.();
 const recovery=document.querySelector('#tutor-save-recovery');
 if(recovery){const status=tutorStatus();recovery.hidden=!status.blocked;}
 const progress=life.progress,ui=life.ui;
 if(!progress||!ui)return;
 try{ui.refresh();const node=document.querySelector('.life-save-status');if(node){const status=progress.status();node.textContent=status.message;node.dataset.savePhase=status.phase;}}catch{}
 life.reminders?.schedule();
}
function showLifeRecovery(){
 const port=life.port;if(!port)return;
 life.recoveryShown=true;
 const status=port.status(),rejected=!!status.rejected;
 show(t(rejected?'account.recoveryRejected':'account.recoveryChoose'),`${notice('SAVE','check',t(rejected?'account.recoveryRejectedNotice':'account.recoveryConflictNotice'),escape(tMessage(status.message)))}<p class="dialog-note">${t('account.recoveryNote')}</p><div class="world-actions"><button class="felt-button" data-world="life-resolve" data-choice="local">${t(rejected?'account.useDeviceAgain':'account.useDevice')}</button><button class="plain-button" data-world="life-resolve" data-choice="remote">${t('account.useRemote')}</button><button class="quiet-button" data-world="home">${t('account.checkLater')}</button></div>`,'life-recovery');
}
function tutorStatus(owner=client.snapshot?.accountId||'guest'){
 return tutorSelectionStatus({owner,progress:owner===life.owner?life.progress:null,ready:life.mounted&&owner===life.owner});
}
function restoreTutor(){
 try{restoreTutorSelection({progress:life.progress,owner:life.owner,storage:localStorage,apply:(id,owner)=>home.applyTutorChoice?.(id,owner)});}catch{/* Preserve unreadable/conflicting records and expose recovery. */}
 // 계정에 고른 화면 언어가 있으면 그 언어로, 없으면 이 기기에서 고른 언어를 계정에 채운다(튜터 선택과 같은 기록).
 try{restoreDisplayLanguage({progress:life.progress});}catch{/* 저장 확인 화면이 따로 알린다. */}
 home.refreshTutorStatus?.();
}
async function prepareTutor(){
 const owner=client.snapshot?.accountId||'guest',generation=client.generation;
 await life.ensure();
 if(owner!==(client.snapshot?.accountId||'guest')||generation!==client.generation)return false;
 if(tutorStatus(owner).blocked){showLifeRecovery();return false;}
 return true;
}
function showEntryRecovery(){
 show(t('account.entryTitle'),`${notice('ACCOUNT','check',t('account.entryNotice'),t('account.entryBody'))}<div class="world-actions"><button class="felt-button" data-world="entry-retry">${t('account.reconnect')}</button><button class="plain-button" data-world="entry-title">${t('account.toTitle')}</button></div>`,'world-entry-recovery');
}
async function prepareWorldTutor(){
 if(client.snapshot&&life.mounted&&!life.port)await life.reload();
 if(!await prepareTutor())return false;
 // 계정 진도를 못 읽었거나 튜터 화면이 준비되지 않았으면 들어가지 않는다 — 오류로 던져 관문이 상태 줄에 「다시 불러오기」를 적고
 // onError(showEntryRecovery)로 그 창을 띄운다. false는 이어 갈 기록을 고르는 창을 띄운 갈래(prepareTutor)에만 쓴다.
 if(!life.mounted||client.snapshot&&!life.progress?.status().scoped)throw Object.assign(Error('WORLD를 열지 못했어요. 「다시 불러오기」를 눌러 주세요.'),{code:'ENTRY_NOT_READY'});
 return true;
}
async function beginAccountLogin(){
 accountActionPending=true;entryGate?.invalidate();
 try{await client.signIn();}catch(error){showEntryRecovery();throw error;}finally{accountActionPending=false;resumeEntryAfterClosedLogin();}
}
function resumeEntryAfterClosedLogin(){
 // Native sign-in opens a separate window. Closing its WORLD panel is still a
 // valid cancellation: confirm the session again, then restore the guest tutor.
 if(!worldRequested||worldPanel.open||accountActionPending||sessionTask||entryGate.state().phase!=='restoring')return false;
 void entryGate.start();return true;
}
// 화면 언어를 고르면(첫 실행·설정) 계정이면 생활 기록에도 둔다. 손님은 이 기기에만 둔다.
async function selectLanguage(language){
 const owner=client.snapshot?.accountId||'guest',generation=client.generation;
 if(owner==='guest')return {saved:true,mode:'device'};
 const guard=()=>{if(owner!==(client.snapshot?.accountId||'guest')||generation!==client.generation)throw Object.assign(Error('로그인한 계정이 바뀌었어요. 다시 골라 주세요.'),{code:'ACCOUNT_CHANGED'});};
 await life.ensure();guard();
 const progress=life.progress;
 if(!progress?.status().scoped)return {saved:true,mode:'device'};
 try{return await commitDisplayLanguage({progress,language,guard});}finally{refreshLife();}
}
async function selectTutor(tutor,owner){
 const generation=client.generation;
 const guard=()=>{if(owner!==(client.snapshot?.accountId||'guest')||generation!==client.generation)throw Object.assign(Error('로그인한 계정이 바뀌었어요. 다시 골라 주세요.'),{code:'ACCOUNT_CHANGED'});};
 guard();await life.ready;guard();
 if(owner!=='guest'&&!life.port){await life.reload();guard();}
 try{return await commitTutorSelection({progress:life.progress,owner,tutor,storage:localStorage,guard});}
 catch(error){if(error.code==='REVISION_CONFLICT')showLifeRecovery();throw error;}
 finally{refreshLife();}
}
// 첫 실행 「한글을 읽을 수 있어요?」의 답: 튜터 선택처럼 생활 진도 기록(계정이면 계정, 손님이면 이 기기)에 둔다.
async function hangulReading(owner){
 await life.ensure();
 const ui=life.ui;
 if(owner!==(client.snapshot?.accountId||'guest')||owner!==life.owner||!ui)return null;
 return ui.hangulReading();
}
async function setHangulReading(answer,owner,{via='question'}={}){
 const generation=client.generation;
 const guard=()=>{if(owner!==(client.snapshot?.accountId||'guest')||generation!==client.generation)throw Object.assign(Error('로그인한 계정이 바뀌었어요. 다시 골라 주세요.'),{code:'ACCOUNT_CHANGED'});};
 guard();await life.ready;guard();
 if(owner!=='guest'&&!life.port){await life.reload();guard();}
 const ui=life.ui;
 if(!ui)throw Error('학습 기록을 아직 준비하고 있어요. 잠시 뒤 다시 골라 주세요.');
 try{return await ui.setHangulReading(answer,{via});}
 catch(error){if(error.code==='REVISION_CONFLICT')showLifeRecovery();throw error;}
 finally{refreshLife();}
}
// 다시 연결·창으로 돌아옴: 계정 진도의 보낼 줄을 보내고, 시트가 열려 있지 않을 때만 계정 진도를 다시 읽는다(life.refresh —
// 한 번에 하나, 보내는 사이 계정이 바뀌면 옛 진도를 다시 세우지 않는다). 손님·저장 충돌로 막힌 기록은 건드리지 않는다.
function refreshTutorAccount(){
 if(!client.snapshot||tutorStatus().blocked)return;
 return life.refresh({rebuild:()=>!home.openPanel()});
}
// 생활 진도: 계정 통로가 있으면 그 저장소·저장으로, 없으면 이 기기 저장소로. 계정 진도를 못 읽어 기기 기록으로 이어 갈 때(fallback)는 저장 줄이 그렇게 알린다.
function lifeProgressFor({owner,port,guard,fallback}){
 const progress=createLifeProgress({owner,mode:port?'account':'local',storage:port?.storage||localStorage,now:()=>Date.now(),guard,save:port?.flush,getSaveStatus:()=>lifeSaveStatus(port),onChange:refreshLife});
 if(!fallback)return progress;
 const status=progress.status;return Object.freeze({...progress,status:()=>({...status(),message:'계정 진도를 불러오지 못해 이 기기의 기록으로 이어 가요.'})});
}
// 배우기 화면(생활 화면 → 학습 화면 → 알림)을 세운다. keep으로 붙인 조각은 생활 세션이 그 기록과 함께 만든 반대 순서로 버린다(home 연결도 그때 끊는다).
function mountLifeLearning({owner,keep}){
 let education=null,reminders=null;
 // 입장 때 준비한 한글 옮기기 통로도 이 생활 기록에 딸린다. 계정 변경·다시 세우기·pagehide에서 함께 버린다.
 keep('hangulMigration',null,()=>{const port=hangulMigrationPort;hangulMigrationPort=null;port?.dispose();});
 const ui=keep('ui',createLifeExperience({home,getProgress:()=>life.progress,asset:path=>worldUrl('brand-opening/assets/'+path),show:(title,html,options)=>show(title,html,options.type,{eyebrow:options.eyebrow,nav:options.nav}),onSummary:()=>{education?.refresh();queueMicrotask(repaintWritingRow);},onNext:()=>education?.next(),presentation:()=>education?.presentation(),
  // TOPIK II를 목표로 저장한 학생(이번 주 계획이 TOPIK II)은 쓰기 연습 줄이 생활 팩 위에 온다(10-22 — 첫 연락 메일·신청 페이지가 약속하는 무료 연습). 그 밖에는 아래 줄 그대로.
  leadRows:print=>education?.examType?.()==='topik2'?writingRow(print):'',
  moreRows:print=>[education?.planRow?.(print),education?.examType?.()==='topik2'?'':writingRow(print),speakingModule?.speakingRow?.(print),reminders?.askMarkup()].filter(Boolean).join(''),positionTotal:()=>education?.positionTotal?.()}));
 // 공개판(계정 모드)의 손님은 GUEST_GAMES와 체험이 남은 게임만 바로 열고 나머지는 로그인부터 연다(launchGame). 추천도 같은 목록을 써야 로그인 창을 맴돌지 않는다.
 // 「내 성향」 답(life.answers)은 이 주인의 것이 늦게 와도 그때부터 쓴다.
 const createPlan=options=>createWorldLearningPlan({...options,answers:life.answers,openGames:operating&&!client.snapshot?guestGames():null});
 // 내 위치(10-19 결정): 짧은 진단 듣기 문항의 녹음은 게임 폴더(korean-runner·korean-rhythm)에서 부른다.
 education=keep('education',createWorldEducation({home,getProgress:()=>life.progress,engine:worldLearning,createPlan,target:window,position:worldPosition,audioUrl:worldUrl,responses:responsesOn,
  readHangulProgress:operating&&owner!=='guest'?async()=>{
   const port=await account.prepareHangulProgress({storage:localStorage,target:window});
   try{return port.read();}finally{port.dispose();}
  }:null,
  launchGame,startLesson:id=>ui.start(id),startReview:(id,ids)=>ui.reviewStart(id,ids),
  // 시험 계획(10-20): 온라인 반 「이번 주 과제」를 그 주의 연습으로 먼저 세고, TOPIK II 쓰기 연습은 문항이 열렸을 때만 계획에 넣는다.
  readClasswork:classworkThisWeek,writingPractice:{candidates:()=>writingReady()?WRITING_CANDIDATES:[],open:route=>openWriting({dataset:{writingRoute:route}}),attempts:()=>readWritingSummary({storage:localStorage,owner:writingOwnerId()}).times},
  // 말하기 연습(10-21 공개 판 · 기본 켜짐): 모듈이 문항을 읽은 뒤에만 시험 정보의 「말하기 평가도 준비해요」(이 기기 기록)와 이번 주 계획의 말하기 칸이 생긴다
  // (이 기기에서 끄는 스위치를 켰으면 모듈을 부르지 않아 지금과 같다 — 아래 speakingOn).
  // 이 파일은 모듈을 정적으로 부르지 않으므로 그 모듈의 읽기·쓰기 함수를 감싸 넘긴다. owner는 학습 화면의 주인(계정·손님)이다.
  speakingPractice:{available:()=>!!speakingModule?.speakingReady(),candidates:()=>speakingModule?.speakingReady()?speakingModule.SPEAKING_CANDIDATES.filter(row=>row.exam==='speaking'):[],
   chosen:owner=>!!speakingModule&&speakingModule.readSpeakingExam({storage:localStorage,owner}),choose:(owner,on)=>!!speakingModule&&speakingModule.writeSpeakingExam({storage:localStorage,owner,on}),
   week:(owner,week)=>speakingModule?speakingModule.speakingWeek({storage:localStorage,owner,week}):null,open:route=>openSpeaking({dataset:{speakingRoute:route}})},
  prepare:async()=>{if(operating&&client.snapshot&&!window.SYNKLearningHost)await account.prepareGame({target:window});},
  // 싱크타운 「마을 준비 확인」(학습·개인화 다리 §4-2): 판정은 서버(town/check), 판은 진단과 같다. 계정 모드에서만.
  town:operating&&owner!=='guest'?{kit:worldTownCheck,check:body=>client.request('town/check',{method:'POST',body}),open:()=>town(),
   passed:result=>{townEntry=result;},evidence:()=>quietTownCheck()}:null}),value=>{value.dispose();home.connectEducation?.(null);});
 home.connectEducation?.(education);window.__synkEducation=education;
 // 학습 알림(10-19 결정 · 1단 기기 예약, world-reminder-device.mjs): 주인마다 이 기기에 따로 두고, 무엇을 알릴지는 복습 일정·이번 주 시험 계획·Core 추천에서 읽는다.
 // 「공부한 시각」은 읽기 전용 학습 기록(trail)에서 읽는다. 주인이 바뀔 때 보내지 않은 예약을 지우는 일(forgetPending)은 생활 세션이 한다.
 keep('trail',createTrailTimes({host:()=>window.SYNKLearningHost||null,
  make:source=>source?source.createGame({gameId:'world-reminders'},worldLearning.engine.createGame,worldLearning.createLearningSync)
   :owner==='guest'?worldLearning.engine.createGame({gameId:'world-reminders',storage:localStorage}):null}));
 reminders=keep('reminders',createWorldReminders({owner,storage:localStorage,target:window,read:reminderInputs,open:openReminder,canMock:()=>typeof education?.mock==='function',
  show:(title,html)=>show(title,html,'world-reminder'),toast:message=>home.toast(message),repaint:repaintReminderCard,push:owner==='guest'?null:worldPush,pushFeature:pushOn,close}),value=>{value.dispose();home.connectReminders?.(null);});
 home.connectReminders?.(reminders);window.__synkReminders=reminders;reminders.schedule();
 window.__synkLife=ui;
}
// 알림 계획의 입력: 생활 복습이 돌아오는 때 · ①의 이번 주 시험 계획과 시험 정보(추천과 같이 세운 examPlan) · 공부한 시각 · 한글 단계인지.
function reminderInputs(){
 const progress=life.progress;if(!progress)return null;
 const snapshot=progress.exportSnapshot(),examPlan=life.education?.metrics?.().plan?.examPlan||null,exam=examPlan?.exam||null;
 const reviews=Object.values(snapshot.reviews||{}).map(review=>review?.dueAt).filter(Number.isFinite);
 return {reviews,exam,examPlan,studyTimes:studyTimes(snapshot),hangulStage:snapshot.hangul?.answer==='new',hasReturn:reviews.length>0||typeof exam?.date==='string'&&exam.date.length===10};
}
// 공부한 시각(「그날 이미 공부했는지」와 공부하던 시간대): 학습 기록(Trail)의 답 · 생활 레슨·복습의 답 · 쓰기 점검.
// 학습 기록은 읽기 전용 코치로 읽는다(쓰지 않는다 — world-reminder-device.mjs createTrailTimes, 게임 판이 닫혀 코치가 끊기면 다시 만든다).
// 게임 판 도중처럼 못 읽는 때는 생활·쓰기 시각만 쓴다.
function studyTimes(snapshot){
 const times=[],add=value=>{const at=typeof value==='string'?Date.parse(value):value;if(Number.isFinite(at))times.push(at);};
 for(const lesson of Object.values(snapshot?.lessons||{}))for(const answer of Object.values(lesson?.answers||{}))add(answer?.at);
 for(const answer of Object.values(snapshot?.activeReview?.answers||{}))add(answer?.at);
 for(const day of Object.values(snapshot?.daily?.days||{}))for(const item of Object.values(day?.items||{}))add(item?.observedAt);
 for(const at of life.trail?.read()||[])add(at);
 try{for(const at of readWritingSummary({storage:localStorage,owner:writingOwnerId()}).times)add(at);}catch{}
 // 말하기 연습(모듈을 불렀을 때만): 이번 주 계획의 말하기 칸도 남은 연습으로 세므로, 말한 날은 그날 이미 공부한 날이다.
 try{if(speakingModule)for(const at of speakingModule.readSpeakingSummary({storage:localStorage,owner:writingOwnerId()}).times)add(at);}catch{}
 return times;
}
// 알림을 누르면 그 알림이 가리키는 자리로: 돌아온 복습은 나의 복습 화면, 이번 주 연습은 이번 주 계획, 시험 점검 카드의 주 단추는
// 시험 형식 연습(미니 모의, ④ education.mock — 열 수 없으면 그쪽이 알리고 내 위치로 간다), 그 입구가 없는 화면이면 짧은 진단.
// (추천 「다음 연습」으로 바로 보내면 목표를 아직 정하지 않은 학생에게 목표 창이 먼저 떠서, 알림이 말한 자리와 달라진다.)
function openReminder(kind){
 const run=task=>void Promise.resolve().then(task).catch(e=>home.toast(errorText(e)));
 if(kind==='plan')return run(()=>life.education?.plan?.());
 if(kind==='exam-start')return run(()=>{const education=life.education;return typeof education?.mock==='function'?education.mock():education?.position?.({start:true});});
 return run(()=>openLife('review'));
}
// 2단 알림으로 들어온 자리를 연다: 입구가 끝나고(튜터 고르기 등) 그 주인의 학습이 준비된 뒤에만. 손님이면 한 번 로그인 안내만 하고 기다린다.
function openReminderLink(){
 let link=null;try{link=JSON.parse(sessionStorage.getItem(REMINDER_LINK)||'null');}catch{link=null;}
 if(!link||!['review','plan','exam'].includes(link.kind))return;
 if(!(Date.now()-Number(link.at)<=30*60000)){try{sessionStorage.removeItem(REMINDER_LINK);}catch{}return;}
 if(!worldRequested||entryGate?.state().phase!=='ready'||!life.reminders||!life.mounted)return;
 if(life.owner==='guest'){if(!link.told){home.toast(t('reminder.push.signin'));try{sessionStorage.setItem(REMINDER_LINK,JSON.stringify({...link,told:true}));}catch{}}return;}
 try{sessionStorage.removeItem(REMINDER_LINK);}catch{}
 life.reminders.openKind(link.kind);
}
// 묻는 카드에 답하면 배우기 판을 다시 그려 카드를 거둔다.
function repaintReminderCard(){if(life.ui&&document.querySelector('#world-panel[open] #panel-content .life-hub'))life.ui.packs();}
// 시험 계획이 먼저 세는 온라인 반 「이번 주 과제」(교사 배정, classroom-homework.mjs와 같은 주차·제출 기준): 이번 주 읽기·쓰기 갈래와 낸 것.
// 반이 없거나 과제를 읽지 못하면 빈 목록이다(계획은 반 과제 없이 짠다). 시각은 서버 시계를 쓴다(기기 시계가 틀린 폰).
async function classworkThisWeek(){
 if(!operating||!client.snapshot||!account?.supportsHomework)return [];
 try{
  const reply=await account.readHomework(),at=Date.parse(reply?.serverTime),now=Number.isFinite(at)?at:Date.now();
  return (Array.isArray(reply?.classes)?reply.classes:[]).filter(c=>c&&!c.readOnly&&c.startsOn).flatMap(c=>{const week=homeworkWeek({startsOn:c.startsOn,weeks:c.weeks,now}),sent=Array.isArray(c.submissions)?c.submissions:[];
   return week.phase==='active'?['reading','writing'].map(kind=>({kind,done:sent.some(row=>row?.week===week.week&&row?.kind===kind)})):[];});
 }catch{return [];}
}
// 쓰기 연습(TOPIK II 51~54, world-writing-practice.mjs): 손님도 쓰고 규칙 점검·예시답을 본다(이 기기 기록).
// 자동 피드백은 계정 모드에서 로그인했고 그 통로가 있을 때만 붙이고, 서버 플래그가 꺼져 있으면 단추가 나오지 않는다.
// 계정이 바뀌면 새로 만든다(쓰던 글·코치는 계정별). 계획 카드는 data-writing-route(예: writing:54)로 그 과제를 연다.
const writingOwnerId=()=>client?.snapshot?.accountId||'guest';
// 배우기 판의 쓰기 줄은 열린 문항이 있을 때만 보이므로 문항 은행을 미리 읽어 둔다(작은 JSON 하나).
// 줄의 자리(생활 팩 위 EXAM · 아래 MORE)는 그리는 순간의 이번 주 계획으로 정하므로, 학습 기록을 읽는 사이(계획 없음)에 연 판은
// 계획이 선 뒤(생활 진도가 바뀔 때마다 onSummary) 자리가 다르면 다시 그린다(10-22 검수 P3). 앞에서 부르므로 함수 선언으로 둔다.
function repaintWritingRow(){
 const ui=life.ui;
 if(!writingReady()||!ui||!document.querySelector('#world-panel[open] #panel-content .life-hub'))return;
 const row=document.querySelector('#panel-content [data-world="writing"]');
 if(!row||!!row.closest('.life-lead-rows')!==(life.education?.examType?.()==='topik2'))ui.packs();
}
void loadWritingBank().then(repaintWritingRow).catch(()=>{});
window.addEventListener('synk-writing-ready',repaintWritingRow);
// 시험 계획(TOPIK II)의 쓰기 칸은 열린 문항이 있을 때만 생기므로, 은행이 늦게 열리면 추천·계획을 다시 세운다(10-21 검수).
// 열려 있는 이번 주 계획·내 위치 판도 다시 그린다(10-22 — 바로가기로 계획이 문항보다 먼저 열리면 쓰기 칸이 빠진 채 남았다).
const writingBankReady=()=>{life.education?.refresh();life.education?.repaint?.();};
void loadWritingBank().then(()=>{if(writingReady())writingBankReady();}).catch(()=>{});
window.addEventListener('synk-writing-ready',writingBankReady);
function openWriting(button){
 const owner=writingOwnerId();
 if(!writing||writingOwner!==owner){
  writing?.dispose();writingOwner=owner;let coach=null;
  const feedback=operating&&client.snapshot&&account?.supportsWriting?{status:()=>account.writingRequest({action:'status'}),request:payload=>account.writingRequest(payload)}:null;
  writing=createWritingPractice({show:(title,html)=>show(title,html,'world-writing'),home,getOwner:writingOwnerId,feedback,
   coach:()=>{if(coach)return coach;if(writingOwnerId()!==owner)return null;const source=window.SYNKLearningHost||null;if(!source&&owner!=='guest')return null;
    coach=source?source.createGame({gameId:'world-writing'},worldLearning.engine.createGame,worldLearning.createLearningSync):worldLearning.engine.createGame({gameId:'world-writing',storage:localStorage});return coach;}});
 }
 return writing.open(button?.dataset?.writingRoute||'writing');
}
// 말하기 연습(10-21 공개 판, world-speaking-practice.mjs · 설계 qa/speaking-pilot-20261021/설계.md): 플래그 없이 모듈을 동적으로 불러 문항을 읽으면
// 배우기 판에 줄을 더한다. 끄는 비상 스위치는 이 기기 설정 synk.world.speaking.preview=0 하나다(화면 글 없음) — 그 기기에서는 모듈을 부르지 않는다.
// 자동 피드백 통로: 계정 모드는 SYNK-talk world-speaking 함수(account.speakingRequest, 웹만 — 쓰기 연습과 같은 규칙), 리허설은 로컬 개발 서버의
// /api/world/speaking. 로그인해야 붙고, 서버 플래그가 꺼져 있거나 문항 판이 다르면 단추 없이 스스로 확인만 보인다.
let speakingModule=null,speaking=null,speakingOwner=null;
const speakingOn=(()=>{try{return localStorage.getItem('synk.world.speaking.preview')!=='0';}catch{return true;}})();
const repaintSpeakingRow=()=>{if(life.ui&&document.querySelector('#world-panel[open] #panel-content .life-hub')&&!document.querySelector('#panel-content [data-world="speaking"]'))life.ui.packs();};
// 은행을 다 읽으면 배우기 줄을 그리고, 추천·이번 주 계획을 다시 세운다 — 시험 정보에서 말하기를 고른 학생의 말하기 칸은 문항이 열려야 생긴다(쓰기와 같다).
if(speakingOn)void import('./world-speaking-practice.mjs').then(module=>{speakingModule=module;return module.loadSpeakingBank();}).then(()=>{repaintSpeakingRow();life.education?.refresh();}).catch(()=>{});
function openSpeaking(button){
 if(!speakingModule)return;
 const owner=writingOwnerId();
 if(!speaking||speakingOwner!==owner){
  speaking?.dispose();speakingOwner=owner;let coach=null;
  const feedback=operating?(client.snapshot&&account?.supportsSpeaking?{status:()=>account.speakingRequest({action:'status'}),request:payload=>account.speakingRequest(payload)}:null)
   :client?.snapshot?{status:()=>client.request('speaking',{method:'POST',body:{action:'status'}}),request:payload=>client.request('speaking',{method:'POST',body:payload})}:null;
  speaking=speakingModule.createSpeakingPractice({show:(title,html)=>show(title,html,'world-speaking',{eyebrow:'SPEAKING'}),home,getOwner:writingOwnerId,tutor:()=>home.tutor?.()?.tutor||null,feedback,
   coach:()=>{if(writingOwnerId()!==owner)return null;if(coach)return coach;const source=window.SYNKLearningHost||null;if(!source&&owner!=='guest')return null;
    coach=source?source.createGame({gameId:'world-speaking'},worldLearning.engine.createGame,worldLearning.createLearningSync):worldLearning.engine.createGame({gameId:'world-speaking',storage:localStorage});return coach;}});
 }
 return speaking.open(button?.dataset?.speakingRoute||'speaking');
}
// 생활 진도 통로가 저장 충돌·거절 상태면 그 확인 창부터(openLife·openExamLink).
const lifeBlocked=()=>{const status=life.port?.status();return !!status&&(status.phase==='conflict'||!!status.rejected);};
async function openLife(method,...args){
 const ready=life.ensure(),epoch=life.epoch;await ready;
 const ui=life.ui;
 if(epoch!==life.epoch||!ui)return;
 if(lifeBlocked()){showLifeRecovery();return;}
 ui[method]?.(...args);
}
// ?exam= 바로가기: 학습 목표가 사는 생활 진도가 준비된 뒤 연다(저장이 엇갈렸으면 그 확인부터 — openLife와 같다). 저장은 학생이 목표 창에서 할 때만이다.
async function openExamLink(){
 const ready=life.ensure(),epoch=life.epoch;await ready;
 const education=life.education;
 if(epoch!==life.epoch||!education)return;
 if(lifeBlocked()){showLifeRecovery();return;}
 // 공개 직후 10분 캐시로 옛 목표 창 모듈이 붙어 있으면 examLink가 없다 — 그때는 지금처럼 홈.
 return education.examLink?.(examRequested);
}
// 저장 충돌 확인 창의 선택: 같은 통로로 고른 쪽을 정한 뒤, 생활 세션이 그 통로로 진도와 배우기 화면만 다시 세운다(life.remount).
async function resolveLife(button){
 const port=life.port,epoch=life.epoch;if(!port)return;
 document.querySelectorAll('[data-world="life-resolve"]').forEach(node=>node.disabled=true);
 try{
  await port.resolve(button.dataset.choice);
  if(epoch!==life.epoch||life.port!==port||home.openPanel()!=='life-recovery')return;
  if(port.status().rejected||port.status().phase==='conflict'){life.recoveryShown=false;showLifeRecovery();return;}
  if(!life.remount(epoch))return;
  restoreTutor();close();refreshLife();if(worldRequested&&entryGate?.state().phase==='error')void entryGate.start();
 }catch(error){if(epoch===life.epoch&&home.openPanel()==='life-recovery'){home.toast(error.message||'아직 진도를 저장하지 못했어요.');document.querySelectorAll('[data-world="life-resolve"]').forEach(node=>node.disabled=false);}}
}
function welcome(){show('SYNK WORLD 시작하기',`<div class="welcome-art"><img src="${welcomePhoto()}" alt="집 문 앞에서 손을 흔드는 세 친구" width="512" height="512"><span>HELLO</span></div><p class="welcome-lead">놀이로 한국어를 배우고, 차림을 꾸며요.</p><p class="panel-description">계정으로 시작하면 차림과 놀이 기록이 이어져요.</p><div class="world-actions"><button class="felt-button" data-world="sign-in">내 계정으로 시작하기 <span aria-hidden="true">→</span></button><button class="plain-button" data-world="guest">먼저 둘러보기</button></div><p class="dialog-note">${operating?'SYNK ID로 로그인하면 첫 놀이, 차림, 동네 기록이 한 계정에 이어져요.':'이 개발판은 테스트 계정으로 저장과 이어 하기를 확인해요. 실제 SYNK 계정은 바뀌지 않아요.'}</p>`,'world-welcome');}
// 계정 연결은 열쇠와 꼬리표 펠트 사진(흰 인화지) 한 장으로 보인다. 캐릭터는 튜터가 말하는 자리에만 쓴다.
const accountPrint=()=>`<span class="world-account-mascot w-print"><img src="${worldUrl('brand-opening/assets/world-felt/account.webp')}" alt="" width="640" height="640"></span>`;
// 계정 연결 머리: 왼쪽 큰 글 한 줄 + 오른쪽 인화지(가운데 정렬 대신 한쪽으로 기울인 배치)
const signInHead=line=>`<div class="ws-signin-head"><p class="ws-lead">${line}</p>${accountPrint()}</div>`;
// trial: 체험 판을 마친 게임(launchGame·체험 결과의 로그인 단추가 넘긴다). 단추가 바로 부를 때는 단추 요소가 온다.
function signIn(trial){if(operating){const game=typeof trial==='string'&&GUEST_TRIAL_GAMES.includes(trial)?games[trial]:null;show(t('account.title'),`<div class="ws-signin">${signInHead(game?t('account.trialLead',{title:game.title}):t('account.lead'))}${game?notice('TRIAL','info',t('account.trialTitle'),t('account.trialBody')):notice('ACCOUNT','info',t('account.oneId'),t('account.oneIdBody'))}<div class="world-actions"><button class="felt-button" data-world="account-login" data-world-submit>${t('account.login')}</button><button class="plain-button" data-world="guest">${t('account.guest')}</button></div></div>`,'world-signin');return;}show(t('account.title'),`<div class="ws-signin">${signInHead(t('account.testLead'))}${notice('REHEARSAL','info',t('account.testTitle'),t('account.testBody'))}<div class="world-actions"><button class="felt-button" data-world="login-a" data-world-submit>${t('account.testA')}</button><button class="plain-button" data-world="login-b" data-world-submit>${t('account.testB')}</button></div><p class="dialog-note">${t('account.testNote')}</p></div>`,'world-signin');}
async function login(account){accountActionPending=true;entryGate?.invalidate();try{await client.signIn(account);sessionConfirmed=true;try{localStorage.setItem('synk-world-v1-welcomed','1');}catch{}close();home.toast(t('account.loaded'));if(worldRequested)await entryGate?.start();if(wardrobeRequested&&entryGate?.state().phase==='ready')wardrobe();}catch(e){home.toast(errorText(e));}finally{accountActionPending=false;}}
function about(){if(operating){show(t('account.aboutTitle'),`<div class="review-note"><p>${t('account.about1')}</p><p>${t('account.about2')}</p></div>`,'world-about');return;}show('SYNK WORLD 소개','<div class="review-note"><p><strong>지금 되는 것</strong><br>테스트 계정으로 첫 문장 놀이를 마치고, 받은 목도리와 앞치마를 함께 입어요. 같은 계정의 다른 화면에서도 차림을 불러오고, 지금 차림을 3D 사진으로 남겨요.</p><p><strong>아직 확인할 것</strong><br>실제 SYNK 로그인, 설치형 앱 실행, 휴대폰 성능은 따로 확인해야 해요. 미니게임과 노래는 지금도 열 수 있어요.</p><p>이 개발판은 이 PC의 로컬 서버와 합성 계정만 써요. 운영 계정과 공개 앱은 바뀌지 않아요.</p></div>','world-about');}
async function photo(){
 if(home.isMaru){if(home.photo)await home.photo();else wardrobe();return;}
 if(!client.snapshot)return home.showPhoto();
 if(client.busy){home.toast('차림을 저장한 뒤 사진을 찍을 수 있어요.');return;}
 try{
  await client.refresh();const snap=client.snapshot;
  const names=Object.fromEntries(WARDROBE_ITEMS.map(i=>[i.id,i.name]));
  const items=Object.values(snap.avatar.slots).filter(id=>snap.inventory.some(item=>item.itemId===id)).map(id=>names[id]).filter(Boolean);
  home.showPhoto({verified:true,items:items.length?items:['몽글 기본 차림']});
  if(client.pending)home.toast('아직 저장하지 못한 변경은 빼고, 서버에 저장된 차림으로 찍었어요.');
 }catch(e){home.toast(errorText(e));}
}
// 동네 입구: 미리보기 그림(위 모노 라벨·LED 칩) + 한 줄 + LED 블록 + 흰 알약 하나. PC 가운데 넓은 판에서는 그림 왼쪽·글 오른쪽.
function townSheet({chip,lead,blocks,actions}){return `<div class="ws-wrap"><div class="ws-town"><figure class="ws-town-art"><img class="town-preview" src="assets/town.webp" alt="싱크타운 광장 그림"><figcaption><span class="ws-town-label">SYNK TOWN</span><span class="ws-chip"><i class="ws-led" data-tone="${chip.tone}"></i>${chip.text}</span></figcaption></figure><div class="ws-town-side"><p class="ws-lead">${lead}</p>${blocks}<div class="world-actions">${actions}</div></div></div></div>`;}
const TOWN_LEAD='내 차림 그대로 동네를 걸어요. 찻집·공방·온실에 들러 이웃과 이야기해요.';
// 입장 조회(town/entry)의 이유: learning-check(마을 준비 확인이 아직) · access(확인은 마쳤는데 체험·이용권이 없음).
// 이용권이 없다는 것을 한국어 미통과로 보이지 않는다(학습·개인화 다리 §4-2 · 마을 설계 §1-2). 급수·점수를 보이지 않는다.
let townEntry=null,quietTown=null;
const townSound=()=>{try{return life.progress?.learningProfileValues?.().audio!=='off';}catch{return true;}};
function townLocked(entry){
 if(entry.reason==='access'){show('싱크타운',townSheet({chip:{tone:'info',text:'이용권 확인'},lead:'마을 준비 확인은 마쳤어요.',blocks:notice('ACCESS','info','체험이나 이용권으로 열리는 곳이에요','이용권 안내는 준비하고 있어요. 열리면 여기에서 알려 드릴게요.'),actions:'<button class="plain-button" data-world="profile">내 계정 열기</button>'}),'world-town');return;}
 // 동기화를 끈 계정은 판정 창의 답을 그때 한 번 보낸다 — 시작 단추 옆에 그렇게 알린다(다리 §5-2). PC 앱은 본체가 그 경로를 알릴 때만 연다.
 const ready=account.supportsTownCheck&&typeof life.education?.townCheck==='function',synced=account.preferences()?.enabled===true;
 const blocks=notice('READY','check','마을 준비 확인','지금까지 푼 TOPIK 연습 답과 짧은 확인 문제로 마을을 즐길 준비가 됐는지 봐요. 점수나 급수는 보이지 않고, 몇 번이든 다시 할 수 있어요.')
  +(!account.supportsTownCheck?notice('PC','info','PC 앱에서는 아직 마을 준비 확인을 열 수 없어요','synk.im/world에서 확인을 마치면 여기서도 열려요.')
   :synced?'':notice('ANSWERS','info','확인에 쓰는 연습 답만 보내요','이 기기에서 푼 TOPIK 연습 답 가운데 확인에 쓰는 것만 이번에 한 번 보내요. 학습 기록 동기화는 지금처럼 꺼져 있고, 보낸 답은 확인에만 쓰고 저장하지 않아요.'));
 show('싱크타운',townSheet({chip:{tone:'check',text:'준비 확인'},lead:'짧은 확인으로 열 수 있어요.',blocks,actions:ready?'<button class="felt-button" data-world="town-check">마을 준비 확인 시작 <span aria-hidden="true">→</span></button>':'<button class="plain-button" data-world="profile">내 계정 열기</button>'}),'world-town');
}
// 진단·짧은 연습·시험 형식 연습이 끝났을 때(다리 §5-2 (나)): 이번에 본 입장 이유가 학습 확인이고 학습 동기화를 켠 계정만, 답을 싣지 않고
// 서버에 모인 사건으로 확인한다. 방금 낸 답이 서버에 닿도록 동기화를 잠깐 기다린다. 열리면 한 줄로 알린다.
function quietTownCheck(){
 if(!operating||townEntry?.reason!=='learning-check'||!account.supportsTownCheck||account.preferences()?.enabled!==true||quietTown)return;
 quietTown=(async()=>{
  for(const until=Date.now()+15000;Date.now()<until;){const state=window.SYNKLearningHost?.status?.();if(!state||!state.queued&&['synced','idle'].includes(state.phase))break;await new Promise(resolve=>setTimeout(resolve,500));}
  const body={bankHash:worldPosition?.topik?.hash||null,sound:townSound()};let result=await client.request('town/check',{method:'POST',body});
  // 30초 안이라 서버가 지난 결과와 retryAfterMs를 주면 그만큼 기다려 한 번 더 묻는다 — 낡은 결과로 「열렸어요」를 놓치지 않게(검수 F5).
  if(Number.isFinite(result?.retryAfterMs)&&result.retryAfterMs>0&&result.retryAfterMs<=30000){await new Promise(resolve=>setTimeout(resolve,result.retryAfterMs+300));result=await client.request('town/check',{method:'POST',body});}
  townEntry=result;if(result.allowed)home.toast('마을이 열렸어요. 싱크타운에서 들어갈 수 있어요.');
 })().catch(()=>{}).finally(()=>{quietTown=null;});
}
// 첫 장면 배치의 재료(다리 §4-3) — 타운이 첫 대화 전에 묻는다. 제안은 이 계정 학습 기록(내 기기)에서 한 번 셈하고, 고른 값은 입장 조회가 돌려준 것.
function townPlacement(){
 if(!townEntry?.allowed)return null;let suggestion=null;
 const suggest=()=>suggestion||=(()=>{let evidence=null;try{evidence=life.education?.townEvidence?.()||null;}catch{evidence=null;}
  return worldTownCheck.placeTownLevels({events:evidence?.events||[],evidenceComplete:evidence?.evidenceComplete===true});})();
 return {chosen:townEntry.placement||null,suggest,ask:worldTownCheck.placementAsk,choose:worldTownCheck.placementChoice};
}
async function town(){if(operating){if(!client.snapshot)return signIn();try{let entry=await client.request('town/entry'),opened=false;townEntry=entry;
 // 학습 동기화를 켠 계정은 서버에 모인 첫 답으로 먼저 확인한다(답을 싣지 않는다). 동기화를 끈 계정은 시트에서 알린 뒤 시작 단추로 보낸다.
 if(!entry.allowed&&entry.reason==='learning-check'&&account.supportsTownCheck&&account.preferences()?.enabled===true){try{const checked=await client.request('town/check',{method:'POST',body:{bankHash:worldPosition?.topik?.hash||null,sound:townSound()}});townEntry=checked;opened=checked.allowed===true;if(opened)entry=checked;}catch{/* the sheet still offers the ready check */}}
 if(!entry.allowed){townLocked(townEntry);return;}const state=await client.request('town/state'),binding=state.binding,sharing=binding?.sharing;show('싱크타운',townSheet({chip:{tone:'ok',text:'내 차림 그대로'},lead:TOWN_LEAD,blocks:`${opened?notice('READY','ok','마을이 열렸어요','싱크타운에서 첫 이야기가 기다려요.'):''}${notice('MY TOWN','ok','타운 기록은 SYNK ID에 저장돼요',`다른 기기에서 로그인해도 이어져요.${binding?.kind==='academy'?' 반에 보여 줄 활동은 아래에서 따로 골라요.':' 반에 들어가면 반에 공유할지 고를 수 있어요.'}`)}${binding?.classId?`<label class="world-notice" data-label="SHARING"><span><input type="checkbox" data-town-sharing data-revision="${Number(sharing?.revision)||0}" ${sharing?.enabled?'checked':''} ${sharing?.blockedByLearningSharing?'disabled':''}> 타운 활동을 반에 공유하기</span><span>${sharing?.blockedByLearningSharing?'학습 공유를 켠 뒤에 타운 공유를 고를 수 있어요.':'켠 뒤에 새로 한 타운 활동만 공유해요. 꺼도 내 기록은 남아요.'}</span></label>`:''}`,actions:'<button class="felt-button" data-world="town-preview">내 차림으로 동네 열기 <span aria-hidden="true">→</span></button>'}),'world-town');}catch(error){home.toast(errorText(error));}return;}show('싱크타운',townSheet({chip:{tone:'info',text:'테스트 계정 미리보기'},lead:TOWN_LEAD,blocks:notice('PREVIEW','info','차림 연결만 확인하는 미리보기예요','실제 타운의 TOPIK 1급+ 조건·이용권·입장 권한은 주지 않아요.'),actions:`<button class="felt-button" data-world="town-preview">${client.snapshot?'내 차림으로 동네 열기':'테스트 계정 연결하기'} <span aria-hidden="true">→</span></button><button class="quiet-button" data-action="hangul">한글부터 배우기</button>`}),'world-town');}
// 싱크타운 호스트는 마을 시트의 자원이다 — 시트를 바꾸거나 닫으면(로그아웃으로 닫을 때도) 그 호스트와 창의 이름표를 함께 버린다.
// 앞 시트(앞 호스트)는 show가 먼저 버리고, 틀은 시트를 연 뒤에 문서를 읽기 시작하므로 이름표는 시트를 연 바로 다음에 달아도 틀보다 먼저다.
function townPreview(){if(!client.snapshot)return signIn();show(operating?'싱크타운':'싱크타운 · 미리보기',`<iframe class="game-frame" title="내 차림으로 걷는 싱크타운" src="${worldUrl('town/day.html')}?play=walk" allow="autoplay; fullscreen; screen-wake-lock" allowfullscreen></iframe>`,'game');
 if(operating){const host=createTownWorldHost(client,{placement:townPlacement()});window.SYNKWorldTownHost=host;attachSheet(()=>{host.dispose();if(window.SYNKWorldTownHost===host)delete window.SYNKWorldTownHost;});}}
// 「이번 주 과제」 자료(tools/build-topik4-homework.mjs가 만든 JSON). 공개본에서도 WORLD 경로 아래에 있다.
const homeworkJson=name=>fetch(worldUrl(name),{cache:'no-cache',credentials:'omit'}).then(response=>{if(!response.ok)throw Object.assign(Error('과제 자료를 읽지 못했어요.'),{code:'HOMEWORK_CONTENT',status:response.status});return response.json();});
// 계정 머리의 초상은 내가 고른 튜터의 계정 사진(왼쪽 위 캡슐과 같은 사진). 고른 튜터가 없으면 기본 몽글 사진.
const TUTOR_NAMES={mongle:'몽글',kkamong:'까몽',marin:'마린'};
function profilePortrait(){const id=home.tutor?.()?.tutor;return profilePhoto(['mongle','kkamong','marin'].includes(id)?id:'default');}
// 「내가 남긴 응답」(WORLD 학습자 응답 설계 §3): 연습을 마친 뒤 고른 응답(30일 안·뺀 것 제외)을 새것부터, 여섯 개 넘으면 「더 보기」. 시각은 보이지 않는다.
// [빼기]는 그 응답을 기록에서 빼(record.excluded) 목록과 쓰임에서 빠지게 한다. 학습 기록 연결이 꺼져 있으면 이 기기에만 있다고 덧붙인다.
// 설정값이 꺼졌거나, 학습 화면이 이 계정 것이 아니거나, 남긴 응답이 없으면 그리지 않는다.
const RESPONSE_PAGE=6;
function responsesSection(){
 const education=life.education;
 if(!responsesOn||typeof education?.responses!=='function'||education.metrics?.().owner!==client.snapshot?.accountId)return '';
 let rows=null;try{rows=education.responses();}catch{rows=null;}
 if(!Array.isArray(rows)||!rows.length)return '';
 // 기록이 이 기기에만 있는지: 학습 호스트가 기기 열쇠(local:)로 저장하면 참(저장 꺼짐이거나 계정이 학습 동기화를 못 함). 호스트가 아직 없으면 저장 설정으로.
 let local=false;try{const key=window.SYNKLearningHost?.status?.()?.accountKey;local=typeof key==='string'?key.startsWith('local:'):account?.preferences?.()?.enabled===false;}catch{local=false;}
 const name=row=>[t(`response.kind.${row.kind}`),t(`response.value.${row.value}`)];
 const item=(row,index)=>{const [kind,value]=name(row);return `<li${index>=RESPONSE_PAGE?' data-response-later hidden':''}><span>${escape(kind)} · ${escape(value)}</span><button class="quiet-button" type="button" data-response-remove="${escape(row.id)}" aria-label="${escape(t('response.removeLabel',{kind,value}))}">${escape(t('response.remove'))}</button></li>`;};
 return `<section class="ws-responses" data-world-responses data-label="RESPONSES" aria-labelledby="ws-responses-title"><h3 id="ws-responses-title" tabindex="-1">${escape(t('response.mine'))}</h3><p class="ws-responses-note">${escape(t('response.note30'))}</p><ul>${rows.map(item).join('')}</ul>${rows.length>RESPONSE_PAGE?`<button class="quiet-button ws-responses-more" type="button" data-responses-more>${escape(t('life.more'))}</button>`:''}<p class="ws-responses-note">${escape(t(local?'response.removeNoteDevice':'response.removeNote'))}</p></section>`;
}
function mountResponses(){
 const box=$('#panel-content [data-world-responses]');if(!box)return;
 box.addEventListener('click',event=>{
  const more=event.target.closest?.('[data-responses-more]');
  if(more){for(const row of box.querySelectorAll('[data-response-later]'))row.hidden=false;more.remove();box.querySelector('[data-response-later] button')?.focus?.();return;}
  const button=event.target.closest?.('[data-response-remove]');if(!button)return;
  const rows=[...box.querySelectorAll('[data-response-remove]')],index=rows.indexOf(button);
  let removed=false;try{removed=life.education?.removeResponse?.(button.dataset.responseRemove)===true;}catch{removed=false;}
  home.toast(t(removed?'response.removed':'response.removeFailed'));
  // 목록을 다시 그리고 초점을 같은 자리(없으면 제목)로 옮긴다. 펼친 「더 보기」는 펼친 채로 둔다.
  const open=!box.querySelector('[data-responses-more]'),html=responsesSection();
  // 마지막 응답을 뺐으면 카드가 사라지므로 초점을 바로 위 학습 기록 연결(없으면 시트의 첫 단추)로 옮긴다.
  if(!html){const near=$('#panel-content [data-world-learning]')||$('#panel-content .world-actions button');box.remove();near?.focus?.({preventScroll:true});return;}
  box.outerHTML=html;mountResponses();
  const next=$('#panel-content [data-world-responses]');if(!next)return;
  if(open){for(const row of next.querySelectorAll('[data-response-later]'))row.hidden=false;next.querySelector('[data-responses-more]')?.remove();}
  const buttons=next.querySelectorAll('[data-response-remove]');(buttons[Math.min(index,buttons.length-1)]||next.querySelector('h3'))?.focus?.();
 });
}
function profile(){if(!client.snapshot)return signIn();const tutorId=home.tutor?.()?.tutor,tutorName=TUTOR_NAMES[tutorId]?t(`tutor.name.${tutorId}`):null;show(t('account.meTitle'),`<div class="ws-me"><div class="ws-me-id"><span class="ws-me-portrait"><img src="${profilePortrait()}" alt=""></span><div><p class="ws-me-name">${tutorName?t('account.learningWith',{name:tutorName}):t('account.learningTogether')}</p><p class="ws-me-sub">${t('account.savedTo',{where:t(operating?'account.whereId':'account.whereTest')})}</p></div></div>${notice('SAVE',client.pending?'check':'ok',t(client.pending?'account.savePending':'account.saveOk'),t('account.revision',{revision:escape(client.snapshot.revision),kind:t(operating?'account.kindId':'account.kindTest')}))}${operating?`<section class="world-notice" data-tone="info" data-label="LEARNING"><strong>${t('account.learningRecords')}</strong>${account.preferences()?`<label><input type="checkbox" data-world-learning data-revision="${account.preferences().revision}" ${account.preferences().enabled?'checked':''}> ${t('account.learningSave')}</label><span>${t('account.learningNote')}</span>`:`<span>${t('account.learningElsewhere')}</span>`}<a class="felt-button" href="https://synk.im/account/client.html?product=world">${t('account.classSettings')} <span aria-hidden="true">→</span></a></section>`:''}${responsesSection()}<div id="world-classroom-lessons"></div><div id="world-classroom-homework"></div><div id="world-classroom-entry"></div><div class="world-actions"><button class="felt-button" data-world="wardrobe">${t('wardrobe.open')}</button><button class="quiet-button" data-world="logout">${t('account.logout')}</button></div></div>`,'world-profile');mountResponses();if(home.isMaru){const actions=$('#panel-content .ws-me>.world-actions');if(actions)actions.before(hanger);else $('#panel-content').append(hanger);renderHomeHanger(client.snapshot);}if(operating){const generation=client.generation,owner=client.snapshot.accountId,guard=()=>{account.assertActive();if(generation!==client.generation||client.snapshot?.accountId!==owner)throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});};
 // 「우리 반 수업」은 반 연결 바로 위: 연결하면 이 시트를 다시 그려 같은 자리에 수업이 이어진다. 시트가 열려 있는 동안만 30초마다 묻는다.
 // 우리 반 수업·과제·반 연결은 이 시트 하나의 자원이다(시트를 바꾸거나 닫으면 함께 버린다).
 let lessons=null,course=null,homework=null,enrollment=null;
 attachSheet(()=>{enrollment?.dispose();lessons?.dispose();course?.dispose();homework?.dispose();},{hasDraft:()=>!!course?.hasDraft()});
 if(account.supportsClassroom){lessons=mountClassroomLessons({container:$('#world-classroom-lessons'),load:()=>account.readClassrooms(),guard});course=mountCourseWritingEntry({container:$('#world-classroom-lessons'),transport:account.courseRequest,guard});}
 // 기존 주차 과제와 초안을 유지한다. 수정 과제를 시작한 반은 서버가 이전 이력 보기로 전환하고, 정답은 해당 제출 권한을 확인해 전달한다.
 if(account.supportsHomework)homework=mountClassroomHomework({container:$('#world-classroom-homework'),load:()=>account.readHomework(),submit:input=>account.submitHomework(input),
  loadContent:()=>homeworkJson('topik4-homework.json'),loadKey:input=>account.readHomeworkKey(input),owner,guard});
 enrollment=mountEnrollment({container:$('#world-classroom-entry'),request:account.enrollmentRequest,guard,beforeClaim:confirmCourseExit,onLinked:async()=>{await account.restore();profile();}});}}
async function wardrobe(){
 if(!client.snapshot)return signIn();
 show('옷장','<p class="panel-description" role="status">옷장을 여는 중이에요.</p>','world-wardrobe');
 const ticket=gameLaunch,owner=client.snapshot.accountId,generation=client.generation;
 let createWardrobeStudio;
 try{({createWardrobeStudio}=await import('../synk-world-home/wardrobe-studio.mjs'));}
 catch{if(ticket===gameLaunch&&screen==='world-wardrobe')show('옷장을 열지 못했어요','<p class="panel-description">인터넷이 잠깐 끊겼을 수 있어요. 「다시 열기」를 눌러 주세요.</p><div class="world-actions"><button class="felt-button" data-world="wardrobe">다시 열기</button></div>','world-wardrobe');return;}
 if(ticket!==gameLaunch||screen!=='world-wardrobe'||!worldPanel.open||client.generation!==generation||client.snapshot?.accountId!==owner)return;
 wardrobeStudio=createWardrobeStudio({snapshot:client.snapshot,reducedMotion:home.state.reduced,
  onEquip:(slots,dyes)=>client.equip(slots,dyes),onSaveLooks:looks=>client.saveLooks(looks),
  onRefresh:()=>client.refresh(),onRetry:()=>client.sendPending(),onDiscard:()=>client.discardPending(),onPlay:play,
 });
 $('#panel-content').replaceChildren(wardrobeStudio.element);home.attachPanelResource(wardrobeStudio);
 const openedStudio=wardrobeStudio;
 openedStudio.update(client.snapshot,{busy:true,pending:client.pending,status:client.status});
 // Read the current account when opening, before a new selection is confirmed.
 // A later change while the fitting room is already open still uses revision checks.
 void client.refresh().catch(error=>home.toast(errorText(error))).finally(()=>{
  if(screen==='world-wardrobe'&&wardrobeStudio===openedStudio&&client.snapshot)openedStudio.update(client.snapshot,{busy:client.busy,pending:client.pending,status:client.status});
 });
}
function pending(){show(t('account.pendingTitle'),`${notice('SAVE','check',t('account.pendingNotice'),t('account.pendingBody'))}<div class="world-actions"><button class="felt-button" data-world="retry-pending" data-world-submit>${t('account.pendingRetry')}</button><button class="plain-button" data-world="discard-pending">${t('account.pendingDiscard')}</button></div>`,'world-pending');}
function readDraft(run){try{const draft=JSON.parse(localStorage.getItem(`synk-world-v1-run:${client.snapshot.accountId}`)||'null');return draft?.runId===run.runId?draft:null;}catch{return null;}}
function saveDraft(){if(!draftRun||!client.snapshot)return;try{localStorage.setItem(`synk-world-v1-run:${client.snapshot.accountId}`,JSON.stringify({runId:draftRun.runId,answers,requestId:draftRun.requestId}));}catch{}}
async function play(){
 if(home.ensureTutor)return home.ensureTutor(()=>startFirstPlay());
 return startFirstPlay();
}
async function startFirstPlay(){
 if(!client.snapshot)return signIn();
 try{let run=client.snapshot.activeRun;if(!run){const result=await client.start();run=result.run||result.activeRun;}if(!run)throw Error('NO_RUN');const previous=readDraft(run);draftRun={...run,requestId:previous?.requestId||crypto.randomUUID()};answers=previous?.answers||[];questionIndex=Math.min(answers.length,run.questions.length-1);showQuestion();}
 catch(e){home.toast(errorText(e));}
}
function showQuestion(){
 const q=draftRun.questions[questionIndex],choice=answers.find(a=>a.questionId===q.questionId)?.optionId,last=questionIndex===draftRun.questions.length-1;
 show('첫 문장 놀이',`<div class="world-game-top"><span>초급 읽기</span><span>${String(questionIndex+1).padStart(2,'0')} / ${String(draftRun.questions.length).padStart(2,'0')}</span></div><div class="world-progress" aria-hidden="true"><i style="width:${(questionIndex+1)/draftRun.questions.length*100}%"></i></div><p class="world-prompt">${escape(q.prompt)}</p><div class="world-answers" role="group" aria-label="답 고르기">${q.options.map((o,i)=>`<button class="world-answer ${choice===o.optionId?'selected':''}" data-world="answer" data-option="${escape(o.optionId)}" aria-pressed="${choice===o.optionId}"><span aria-hidden="true">${'ABCDEF'[i]||i+1}</span>${escape(o.text)}</button>`).join('')}</div><p class="dialog-note">${questionIndex===0?'문장을 읽고 어울리는 답을 골라요.':'답은 마지막에 한꺼번에 확인해요.'}</p><div class="world-actions"><button class="felt-button" data-world="next" ${choice?'data-world-submit':'disabled'}>${last?'놀이 마치기':'다음 문장 보기'} <span aria-hidden="true">→</span></button><button class="quiet-button" data-world="pause">나중에 이어서 하기</button></div>`,'world-play');
 const companion=home.mountGameTutor?.('first');if(companion){home.attachPanelResource(companion);if(choice)companion.react('picked');}
}
async function finish(){
 saveDraft();try{const result=await client.complete(draftRun.runId,answers,draftRun.requestId);lastCompletion=result.completion;try{localStorage.removeItem(`synk-world-v1-run:${client.snapshot.accountId}`);}catch{}showReward();}
 catch(e){if(e.code==='STALE_RESPONSE')return;show('결과를 다시 보내야 해요',`${notice('SAVE','check','결과를 아직 받지 못했어요',`${escape(errorText(e))} 같은 결과를 다시 보내도 선물은 한 번만 받아요.`)}<div class="world-actions"><button class="felt-button" data-world="finish" data-world-submit>결과 다시 보내기</button><button class="plain-button" data-world="pause">우리 동네로 가기</button></div>`,'world-retry');}
}
// 결과 한 장: 코랄 포스터(큰 한글 900 + 얻은 옷 인화지) → 얻은 것 한 줄 → 읽은 문장(다시 볼 것은 코랄 점) → 흰 알약 하나 + 조용한 줄.
// 연출은 200ms 페이드와 소리 한 번. 「보상 연출」을 끄면 페이드·소리 없이 결과만 보인다.
function showReward(){
 const done=lastCompletion,granted=!!done?.rewardGranted,celebrate=getPref('celebrate'),results=done?.answers||[];
 const firstMiss=results.findIndex(a=>a.correct!==true);
 const rows=results.map((a,i)=>`<p class="world-review-item" data-correct="${a.correct===true}"${i===firstMiss?' data-focus="true"':''}><strong>${i+1}. ${escape(draftRun.questions[i]?.prompt)}</strong><span>알맞은 답 · ${escape(draftRun.questions[i]?.options.find(o=>o.optionId===a.correctOptionId)?.text)}</span>${a.correct?'<em class="world-review-mark">맞았어요</em>':'<em class="world-review-mark" data-tone="again">다시 볼 문장</em>'}</p>`).join('');
 const art=granted?{file:'wardrobe',alt:'옷걸이에 걸린 목도리 펠트 사진'}:{file:'sentence',alt:'점 세 개 말풍선 펠트 사진'};
 show('결과',`<div class="ws-wrap"><div class="ws-result${celebrate?' is-celebrate':''}"><section class="world-reward-art" data-granted="${granted}"><span class="world-reward-label">${granted?'NEW · SCARF':`${String(results.length).padStart(2,'0')} SENTENCES · DONE`}</span><span class="w-print world-reward-print"><img src="${worldUrl(`brand-opening/assets/world-felt/${art.file}.webp`)}" alt="${art.alt}" width="640" height="640"></span><p class="welcome-lead">첫 문장 놀이, 끝!</p></section><div class="world-result-side"><div class="world-result-got" data-tone="${granted?'ok':'idle'}"><strong>${granted?'첫 산책 목도리를 받았어요':'첫 산책 목도리는 옷장에 있어요'}</strong><span>${granted?'옷장에 넣어 두었어요. 지금 바로 입을 수 있어요.':'다시 놀아도 선물은 한 번만 받아요. 옷장에서 언제든 입어요.'}</span></div><details class="world-review" open><summary>읽은 문장 다시 보기</summary>${rows}</details><div class="world-actions"><button class="felt-button" data-world="wear-reward" data-world-submit>지금 입기</button><button class="quiet-button" data-world="home">우리 동네로</button></div></div></div></div>`,'world-reward');
 mountRewardTutor();
 if(celebrate)playSound(granted?'reward':'done');
}
function mountRewardTutor(){
 const companion=home.mountGameTutor?.('first',{practiceEnabled:false});if(!companion)return;
 home.attachPanelResource(companion);companion.setPhase('results');companion.react('finish');
 // 튜터 한마디는 결과 오른쪽 열 맨 위로(포스터 위에 띠로 걸리지 않게).
 const aside=document.querySelector('#panel-content>.game-tutor'),side=document.querySelector('.world-result-side');if(aside&&side)side.prepend(aside);
 const review=document.querySelector('.world-review');if(!review)return;
 for(const [index,result] of (lastCompletion?.answers||[]).entries()){
  const button=document.createElement('button');button.type='button';button.className='quiet-button';button.dataset.tutorReview=result.questionId;
  button.textContent=result.correct?'튜터 한마디 듣기':'튜터와 다시 보기';
  button.addEventListener('click',()=>{const q=draftRun.questions.find(q=>q.questionId===result.questionId);companion.react(result.correct?'success':'retry',{answer:true,support:!result.correct&&q?firstSupport(q,result,answers.find(a=>a.questionId===q.questionId)?.optionId):[]});});
  review.querySelectorAll('p')[index]?.append(button);
 }
}
const games={runner:{get title(){return t('game.runner.title');},path:'korean-runner/'},rhythm:{get title(){return t('game.rhythm.title');},path:'korean-rhythm/'},hangul:{get title(){return t('game.hangul.title');},path:'hangul-stage/'}};
function showGameConflict(id,session){
 const status=session.status().play;
 gameRecovery={id,session,busy:false};
 show(t('account.conflictTitle'),`${notice('SAVE','check',t('account.conflictNotice'),t('account.conflictBody'))}<div class="world-actions"><button class="felt-button" data-world="resolve-play" data-choice="remote">${t('account.conflictRemote')}</button>${status.code==='IMPORT_CONFLICT'?'':`<button class="plain-button" data-world="resolve-play" data-choice="local">${t('account.conflictLocal')}</button>`}<button class="quiet-button" data-world="home">${t('account.conflictLater')}</button></div><p class="dialog-note">${t('account.conflictNote')}</p>`,'world-game-conflict');
}
async function launchGame(id){
 const game=games[id];if(!game)return;
 if(home.ensureTutor&&!home.tutor()?.tutor)return home.ensureTutor(()=>launchGame(id));
 let session,trialHost=null;
 // 손님의 한글 만나기는 계정 놀이 기록 없이 기기 진도로, 바람길·리듬은 체험이 남아 있으면 한 판 체험으로 연다(계정 호스트를 설치하지 않는다).
 const guest=operating&&!client.snapshot,trial=guest&&guestTrials.open().includes(id);
 if(operating&&!(guest&&(GUEST_GAMES.has(id)||trial))){
  if(!client.snapshot)return signIn(id);
  const accountId=client.snapshot.accountId;
  show(game.title,`<p class="panel-description" role="status">${t('account.gameLoading')}</p>`,'world-game-loading');
  const ticket=gameLaunch;
  try{session=await account.prepareGame({target:window,onStatus:state=>{if(!session||activeGameSession!==session||screen!=='game')return;if(state.play.phase==='conflict')showGameConflict(id,session);else if(state.play.phase==='stopped')show(t('account.gameStopped'),`${notice('PLAY','check',t('account.gameStoppedNotice'),t('account.gameStoppedBody'))}<div class="world-actions"><button class="felt-button" data-world="profile">${t('account.checkMine')}</button><button class="quiet-button" data-world="home">${t('account.toTown')}</button></div>`,'world-game-error');}});}
  catch(error){if(ticket!==gameLaunch||!worldPanel.open||home.isMaru&&home.openPanel()!=='world-game-loading')return;show(t('account.gameCheck'),`${notice('PLAY','check',t('account.gameCheckNotice'),escape(errorText(error)))}<div class="world-actions"><button class="felt-button" data-world-game="${id}">${t('account.reconnect')}</button><button class="plain-button" data-world="profile">${t('account.checkMine')}</button></div>`,'world-game-error');return;}
  if(ticket!==gameLaunch||!worldPanel.open||home.isMaru&&home.openPanel()!=='world-game-loading'||client.snapshot?.accountId!==accountId){session.dispose();return;}
  if(session.status().play.phase==='conflict'){showGameConflict(id,session);return;}
 }
 if(life.education?.applyPreferences()===false)throw Error('도움 방식을 저장하지 못했어요. 잠시 뒤 다시 저장해 주세요.');
 // 체험 판의 틀은 메모리 호스트를 받는다: 판이 끝나면 그 게임의 체험을 닫고 추천을 다시 고르며, 결과의 로그인 단추는 계정 연결을 연다.
 if(trial){trialHost=createGuestTrialPlayHost({game:id,onRound:()=>{guestTrials.finish(id);life.education?.refresh();},signIn:()=>setTimeout(()=>{if(client.snapshot)return;close();signIn(id);},0)});window.SYNKPlayHost=trialHost;}
 show(game.title,`<iframe class="game-frame" title="${game.title}" src="${worldUrl(game.path)}" allow="autoplay; fullscreen" allowfullscreen></iframe>`,'game');
 const companion=home.mountGameTutor?.(id,{frame:document.querySelector('.game-frame')});
 if(session)activeGameSession=session;
 home.attachPanelResource({dispose:()=>{companion?.dispose();if(session){if(activeGameSession===session)activeGameSession=null;session.closeGame();}if(trialHost){if(window.SYNKPlayHost===trialHost)delete window.SYNKPlayHost;trialHost.stop();}queueMicrotask(()=>refreshLife());}});
}
const learningSongs={'vowel-dance':{title:'모음 댄스',description:'모음 글자와 소리를 노래로 익혀요'},'geu-a-ga':{title:'그 아 가',description:'자음과 모음이 만나는 소리'},batchim:{title:'받침 노래',description:'글자 아래에 붙는 소리'}};
// 노래: 카세트 인화지 한 장 + 한 줄 설명 → 1px 선 목록 줄(재생 원 · 제목 · 번호)
function songs(){show('노래 듣기',`<div class="ws-songs-head"><span class="w-print ws-songs-print"><img src="${worldUrl('brand-opening/assets/world-felt/songs.webp')}" alt="" width="640" height="640"></span><p>한글 노래 ${Object.keys(learningSongs).length}곡이에요. 영상 속 글자를 보며 따라 불러요.</p></div><div class="play-list">${Object.entries(learningSongs).map(([id,s])=>`<button data-world-song="${id}"><img src="${worldUrl('brand-opening/assets/home/headphones.webp')}" alt=""><span><strong>${s.title}</strong><small>${s.description}</small></span></button>`).join('')}</div>`,'world-songs');}
function playSong(id){const song=learningSongs[id];if(!song)return;show(song.title,`<video class="song-video" controls playsinline preload="metadata" aria-label="${song.title}" src="${worldUrl('assets/videos/'+id+'.mp4')}"></video><p class="dialog-note">화면 속 글자를 보며 따라 불러요. 다른 노래는 놀이에서 다시 고를 수 있어요.</p>`,'world-song');$('#panel-content video').play().catch(()=>{});}
const commands={
 'life-resolve':resolveLife,'life-recovery':showLifeRecovery,
 'entry-retry':()=>{sessionConfirmed=false;close();return entryGate.start();},'entry-title':()=>{close();return startOpening(true);},
 'resolve-play':async button=>{const recovery=gameRecovery;if(!recovery||recovery.busy)return;recovery.busy=true;document.querySelectorAll('[data-world="resolve-play"]').forEach(b=>b.disabled=true);try{await recovery.session.resolve(button.dataset.choice);if(gameRecovery===recovery&&screen==='world-game-conflict'&&worldPanel.open&&(!home.isMaru||home.openPanel()==='world-game-conflict'))await launchGame(recovery.id);}catch(error){if(gameRecovery===recovery&&worldPanel.open&&(!home.isMaru||home.openPanel()==='world-game-conflict')){home.toast(error?.code==='REVISION_CONFLICT'?t('account.conflictNotice'):errorText(error));recovery.busy=false;document.querySelectorAll('[data-world="resolve-play"]').forEach(b=>b.disabled=false);}}},
 writing:openWriting,'sign-in':signIn,'account-login':beginAccountLogin,'guest':()=>{try{localStorage.setItem('synk-world-v1-welcomed','1');}catch{}close();if(worldRequested)return entryGate.start();},'login-a':()=>login('player-a'),'login-b':()=>login('player-b'),profile,wardrobe,pending,play,finish,home:()=>{close();home.goTown?.();},town,songs,'town-preview':townPreview,'town-check':()=>life.education?.townCheck?.(),
 pause:()=>{saveDraft();close();home.toast('고른 답은 그대로 두었어요. 나중에 이어서 해요.');},
 answer:button=>{const q=draftRun.questions[questionIndex];answers=answers.filter(a=>a.questionId!==q.questionId);answers.push({questionId:q.questionId,optionId:button.dataset.option});saveDraft();playSound('select');showQuestion();},
 next:()=>{if(questionIndex<draftRun.questions.length-1){questionIndex++;showQuestion();}else finish();},
 equip:async button=>{try{const slots={...client.snapshot.avatar.slots};slots[button.dataset.slot]=slots[button.dataset.slot]===button.dataset.item?'':button.dataset.item;await client.equip(slots);wardrobe();home.toast('차림을 저장했어요.');}catch(e){home.toast(errorText(e));if(client.pending)pending();}},
 'wear-reward':async()=>{try{await client.equip({...client.snapshot.avatar.slots,neck:'mongle-scarf-first-steps'});close();home.toast('첫 산책 목도리를 입었어요.');}catch(e){home.toast(errorText(e));if(client.pending)pending();}},
 'retry-pending':async()=>{try{await client.sendPending();wardrobe();}catch(e){home.toast(errorText(e));}},
 'discard-pending':async()=>{try{await client.discardPending();wardrobe();}catch(e){home.toast(errorText(e));}},
 refresh:async()=>{try{await client.refresh();home.toast(t('account.reconnected'));}catch(e){home.toast(errorText(e));}},
 // 학습 알림 단추(world-reminder-device.mjs): 앱 안 묻기·멈춤 뒤 묻기·시험 점검 카드. 「알려 주세요」는 누른 그 자리에서 OS 권한을 청한다.
 // 2단(앱을 닫아도 받기): 휴대폰 묻는 카드 · 동의 상자의 「동의하고 켜기」(누른 그 동작 안에서 world-push가 권한을 청한다) · 「괜찮아요」.
 ...Object.fromEntries(['reminder-yes','reminder-no','reminder-keep','reminder-stop','reminder-exam-start','reminder-exam-plan','reminder-push-ask','reminder-push-yes','reminder-push-no'].map(name=>[name,()=>life.reminders?.command(name)])),
 // 로그아웃: 이 뒤에 생긴 손님 기록만 다음 로그인에 옮길지 묻는다(device-records.mjs — 앞 사람의 손님 기록이 다음 사람에게 가지 않게).
 logout:async()=>{accountActionPending=true;entryGate?.invalidate();const leaving=client.snapshot?.accountId;try{try{await worldPush?.logout();}catch{/* 다음 열 때 상태가 다시 정리한다 */}await client.logout();const signedOutAt=Date.now();if(leaving)noteDeviceAccount(localStorage,leaving,signedOutAt);noteDeviceSignOut(localStorage,signedOutAt);sessionConfirmed=false;close();if(home.isMaru)await entryGate.start();else welcome();}catch(e){if(e.code==='STALE_RESPONSE')return;home.toast(t('account.logoutFailed'));if(home.isMaru)showEntryRecovery();else welcome();}finally{accountActionPending=false;}},
};
commands.speaking=openSpeaking;
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.worldGame){event.preventDefault();event.stopImmediatePropagation();void launchGame(button.dataset.worldGame);return;}
 if(button.dataset.worldSong){event.preventDefault();event.stopImmediatePropagation();playSong(button.dataset.worldSong);return;}
 if(['runner','rhythm'].includes(button.dataset.launch)&&(operating||home.isMaru)){
  event.preventDefault();event.stopImmediatePropagation();launchGame(button.dataset.launch);return;
 }
 if(button.dataset.action==='hangul'&&(operating||home.isMaru)){
  event.preventDefault();event.stopImmediatePropagation();launchGame('hangul');return;
 }
 if(button.dataset.world){event.preventDefault();event.stopImmediatePropagation();Promise.resolve(commands[button.dataset.world]?.(button)).catch(e=>home.toast(errorText(e)));return;}
 const action=button.dataset.action,nav=button.dataset.nav;
 if(['quickplay','profile','wardrobe','about','photo','town'].includes(action)||['wardrobe','town'].includes(nav)){
  event.preventDefault();event.stopImmediatePropagation();(action==='quickplay'?play:action==='profile'?profile:action==='about'?about:action==='photo'?photo:action==='town'||nav==='town'?town:wardrobe)();
 }
},true);
document.addEventListener('change',event=>{const control=event.target;if(control.matches?.('[data-world-learning]')){control.disabled=true;const enabled=control.checked;void account.setLearning(enabled,Number(control.dataset.revision)).then(()=>{if(screen==='world-profile')profile();}).catch(error=>{control.checked=!enabled;home.toast(errorText(error));}).finally(()=>{control.disabled=false;});return;}if(!control.matches?.('[data-town-sharing]'))return;control.disabled=true;const enabled=control.checked,revision=Number(control.dataset.revision);void client.request('town/sharing',{method:'POST',body:{enabled,revision}}).then(()=>town()).catch(error=>{control.checked=!enabled;home.toast(errorText(error));}).finally(()=>{control.disabled=false;});});
// pagehide: 생활 세션을 닫고(그 뒤 계정 정리·늦은 준비가 생활 화면을 다시 세우지 않는다) 지금 시트의 자원을 버린 다음 계정을 멈춘다.
window.addEventListener('pagehide',()=>{worldPush?.flush();writing?.dispose();speaking?.dispose();life.close();releaseSheet();account?.stop();});
window.addEventListener('online',()=>{if(client.snapshot)client.refresh().then(refreshTutorAccount).catch(()=>{});});
// Switching between side-by-side web and desktop windows need not hide either
// document. Refocus must also restore the latest selected companion.
window.addEventListener('focus',()=>{if(!document.hidden&&client.snapshot&&!client.busy)void refreshTutorAccount();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&client.snapshot&&!client.busy)client.refresh().then(refreshTutorAccount).catch(()=>{});});
// A queued close event from sign-in must not clear a newly opened fitting room.
const worldPanel=$('#world-panel')||$('#panel');
worldPanel.addEventListener('close',()=>{if(!worldPanel.open){gameLaunch++;gameRecovery=null;screen='';hangerSignature='';renderHomeHanger(client.snapshot);releaseSheet();}});
window.__synkWorld={client,screen:()=>screen,wardrobe:()=>wardrobeStudio?.metrics(),life:()=>life.ui?.metrics()};
home.connectHost?.({profile,wardrobe,play,town,about,photo,songs,launchGame,prepareTutor,selectTutor,selectLanguage,tutorStatus,hangulReading,setHangulReading,learn:()=>openLife('next'),packs:()=>openLife('packs'),stories:()=>openLife('stories'),review:()=>openLife('review'),cafe:()=>openLife('cafe'),pack:id=>openLife('pack',id),lesson:id=>openLife('start',id),replayOpening:()=>{close();return startOpening(true);}});
// 공개판 설계 §2: 로그인할 때 이 기기의 손님 한글 기록(한글 만나기 진도·첫 실행 답)을 계정으로 옮길지 한 번 묻는다(device-records.mjs).
// 계정 생활 진도와 학습 호스트가 준비된 뒤 입장 관문이 튜터 고르기 앞에서 연다. 다른 계정의 기록에는 쓰지 않는다.
const accountLife=()=>{const owner=client.snapshot?.accountId,ui=life.ui;if(!owner||owner!==life.owner||!ui)throw Object.assign(Error('로그인한 계정이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});return ui;};
// 화면 언어(10-19 1판): 「한글 기록 이어 가기」 판의 글은 열 때마다 고른 언어로 읽는다(device-records.mjs DEVICE_RECORDS_TEXT와 같은 키).
const deviceRecordsText=()=>({title:t('records.title'),lead:t('records.lead'),move:t('records.move'),keep:t('records.keep'),snapshot:t('records.snapshot'),snapshotBody:t('records.snapshotBody'),
 moving:t('records.moving'),failed:t('records.failed'),moved:t('records.moved'),partly:t('records.partly'),kept:t('records.kept'),pendingKept:t('records.pendingKept'),hangulRow:t('records.hangulRow'),answerRow:t('records.answerRow'),
 answerNew:t('records.answerNew'),answerReads:t('records.answerReads'),graduated:t('records.graduated'),met:n=>t('records.met',{n}),metMastered:(n,m)=>t('records.metMastered',{n,m}),
 skipped:t('records.skipped'),started:t('records.started'),keptHangul:t('records.keptHangul'),keptAnswer:t('records.keptAnswer'),
 lifeRow:t('records.lifeRow'),lessons:n=>t('records.lessons',{n}),reviews:n=>t('records.reviews',{n}),days:n=>t('records.days',{n}),learningRow:t('records.learningRow'),answers:n=>t('records.answers',{n}),profileRow:t('records.profileRow'),profileValue:t('records.profileValue')});
// 생활 진도 옮기기(10-20): 이 계정의 생활 진도에 없는 것만 더하고, 계정 저장(CAS·보낼 칸)이 서버에 닿았는지까지 본다.
async function importDeviceLife(records){
 const owner=client.snapshot?.accountId;
 const progress=life.progress;
 if(!owner||owner!==life.owner||!progress)throw Object.assign(Error('로그인한 계정이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});
 const added=progress.importRecords(records,{from:'guest-device'});
 // 더한 것이 없어도(앞 시도에서 이미 더했으면) 계정 저장이 서버에 닿았는지 본다 — 다시 고른 시도가 확인 없이 성공으로 끝나지 않게(10-21 검수).
 // 저장 자체가 실패해도 더한 수를 붙여 던진다 — 옮기기 판이 「계정에 더했지만 확인 못 함」으로 기억하게(10-21 백엔드 검수).
 try{await progress.flush();}catch(error){throw Object.assign(error instanceof Error?error:Error(String(error)),{code:error?.code||'LIFE_NOT_SAVED',added});}
 const status=progress.status();if(status.scoped&&status.phase!=='synced')throw Object.assign(Error('생활 진도가 아직 계정에 저장되지 않았어요.'),{code:'LIFE_NOT_SAVED',added});
 refreshLife();life.education?.refresh();return added;
}
let hangulMigrationPort=null;
const deviceRecords=createDeviceRecordsOffer({storage:localStorage,learningStatus:()=>window.SYNKLearningHost?.status?.()||null,hangulPort:()=>hangulMigrationPort,accountOwner:()=>client.snapshot?.accountId||'guest',
 importLife:importDeviceLife,importLearning:operating?events=>account.importDeviceLearning(events):null,
 accountAnswer:()=>accountLife().hangulReading(),setAccountAnswer:async(answer,options)=>{const ui=accountLife();try{return await ui.setHangulReading(answer,options);}finally{refreshLife();}},
 present:({title,html,onClose})=>{show(title,html,'world-device-records');home.attachPanelResource({dispose:onClose});},close,toast:message=>home.toast(message),head:accountPrint(),text:deviceRecordsText});
commands['device-records']=button=>{const line=document.querySelector('[data-device-records-status]');return deviceRecords.choose(button.dataset.choice,{owner:client.snapshot?.accountId||'guest',
 status:(text,busy)=>{if(line)line.textContent=text;document.querySelectorAll('[data-world="device-records"]').forEach(node=>{node.disabled=busy;});}});};
entryGate=createWorldEntryGate({
 restore:async()=>{await initialRestoreReady;if(sessionTask)await sessionTask;else if(!sessionConfirmed)await restoreSession();},
 prepare:prepareWorldTutor,
 offer:async identity=>{
  hangulMigrationPort?.dispose();hangulMigrationPort=null;
  if(operating&&identity.owner!=='guest'){
   const education=life.education;let port;
   try{port=await account.prepareHangulProgress({storage:localStorage,target:window});}
   catch{home.toast('한글 기록 옮기기는 계정 저장이 준비되면 다시 물어볼게요.');return null;}
   if(identity.owner!==(client.snapshot?.accountId||'guest')||identity.generation!==client.generation||life.closed||life.education!==education){port.dispose();return null;}
   hangulMigrationPort=port;
  }
  return deviceRecords.offer(identity);
 },
 read:()=>({owner:client.snapshot?.accountId||'guest',generation:client.generation,tutor:home.tutor?.().tutor||null}),
 choose:then=>home.ensureTutor?.(then),
 onState:state=>{home.setEntryState?.(state);home.setSceneActive?.(state.phase==='ready');},
 onEnter:identity=>{
  if(entryDestinationHandled)return;entryDestinationHandled=true;
  queueMicrotask(()=>{
   if(entryGate.state().phase!=='ready'||identity.owner!==(client.snapshot?.accountId||'guest')||identity.generation!==client.generation)return;
   if(wardrobeRequested){if(client.snapshot)void wardrobe();else signIn();}
   else if(new URLSearchParams(location.search).get('cafe')==='1')void openLife('cafe').catch(()=>home.toast('카페를 열지 못했어요. 우리 동네에서 카페를 다시 눌러 주세요.'));
   // 한 번만 도는 바로가기라 계정이 바뀌어 멈춘 것(코드 없는 오류)은 알리지 않는다 — 「다시 시도」할 일이 아니다.
   else if(examRequested)void openExamLink().catch(error=>{if(error?.code)home.toast(errorText(error));});
   else openReminderLink();
  });
 },
 onError:showEntryRecovery
});
window.__synkWorld.entry=()=>entryGate.state();
worldPanel.addEventListener('close',()=>queueMicrotask(()=>{
 if(!worldRequested||worldPanel.open)return;
 const phase=entryGate.state().phase;
 if(phase==='restoring'){resumeEntryAfterClosedLogin();return;}
 if(phase!=='error'&&(phase!=='choosing'||home.tutor?.().tutor||home.tutor?.().active))return;
 entryGate.cancel();void startOpening(true);
}));
if(home.isMaru){const recovery=document.createElement('button');recovery.id='tutor-save-recovery';recovery.className='quiet-button';recovery.dataset.world='life-recovery';recovery.dataset.i18n='home.memory.recovery';recovery.textContent=t('home.memory.recovery');recovery.hidden=true;document.querySelector('#life-progress-caption')?.after(recovery);}
let restored=false;
try{restored=await restoreSession();}catch{if(!home.isMaru)welcome();}finally{finishInitialRestore();}
await openingReady;
if(!home.isMaru&&!restored&&!localStorage.getItem('synk-world-v1-welcomed'))welcome();
onClientChange();
if(new URLSearchParams(location.search).get('tutor')==='choose')home.chooseTutor?.();
