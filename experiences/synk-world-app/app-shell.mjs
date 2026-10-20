import {WorldClient} from './world-client.mjs';
import {mountEnrollment} from './enrollment.mjs';
import {mountClassroomLessons} from './classroom-lessons.mjs';
import {mountClassroomHomework} from './classroom-homework.mjs';
import {createWorldAccount,loadWorldConfig,createLifeProgressPort,createLocalWorldLearningHost,worldLearning,createWorldLearningPlan,GUEST_TRIAL_GAMES,createGuestTrials,createGuestTrialPlayHost,createDeviceRecordsOffer,worldPosition,mountCourseWritingEntry} from './world-account.bundle.mjs';
import {createWorldEducation} from './world-learning-ui.mjs';
import {PACKS,LESSONS} from './life-content.mjs';
import {createLifeProgress} from './life-progress.mjs';
import {restoreTutorSelection,commitTutorSelection,tutorSelectionStatus,createWorldEntryGate} from './tutor-selection-sync.mjs';
import {createLifeExperience} from './life-ui.mjs';
import {createTownWorldHost} from './world-town-client.mjs';
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
// 10-19 결정 「WORLD 손님」(공개판 설계 §2): 손님(로그인 전)에게 한글 만나기를 연다 — 진도는 그 기기에 남는다.
// 바람길·말의 리듬은 한 판씩 체험으로 연다(guest-trial.mjs, 기록·코인은 로그인 뒤). 체험을 마친 게임은 로그인부터 열고, 추천도 같은 목록을 쓴다.
const GUEST_GAMES=new Set(['hangul']);
const guestTrials=createGuestTrials({storage:(()=>{try{return localStorage;}catch{return null;}})()});
const guestGames=()=>[...GUEST_GAMES,...guestTrials.open()];
const worldUrl=path=>new URL(connection.basePath+path,location.origin).href;
const {firstSupport}=await import(worldUrl('brand-opening/game-tutor-support.mjs'));
const home=window.__synkHome||(await import(worldUrl('brand-opening/home.mjs'))).home;
let client,townSession,enrollmentView,classroomView,homeworkView,lifeUI=null,lifeProgress=null,lifePort=null,lifeOwner=null,lifeGeneration=-1,lifeEpoch=0,lifeReady=null,lifeRecoveryShown=false;
// topicAnswers: 「내 성향」 answers about practised topics for the signed-in owner, read when life starts.
let tutorReady=false,tutorRefresh=null,education=null,localLearning=null,topicAnswers=null;
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
client=new WorldClient({onChange:renderStatus,account});
const stateLine=document.createElement('div');stateLine.className='world-state';stateLine.setAttribute('role','status');
if(!home.isMaru){
 $('.page-heading').after(stateLine);
 $('.preview-label').textContent=operating?'MY SYNK WORLD':'연결 개발판';$('.local-note').innerHTML=`<span class="status-dot"></span>${operating?'SYNK ID · 내 세계 연결':'로컬 서버 연결'}`;
 $('.hero-footnote').textContent='첫 문장 놀이 · 짧은 문장 3개';
 $('.hero-copy .felt-button').innerHTML='첫 놀이 시작하기 <span aria-hidden="true">→</span>';
}
// 시트 머리의 영문 모노 라벨: 그 시트가 무엇인지 짧게(한글은 모노로 쓰지 않는다).
const EYEBROWS={'world-profile':'ACCOUNT','world-signin':'ACCOUNT','world-entry-recovery':'ACCOUNT','world-device-records':'ACCOUNT','world-welcome':'SYNK WORLD','world-about':'ABOUT','world-wardrobe':'WARDROBE','world-pending':'SAVE','life-recovery':'SAVE','world-game-conflict':'SAVE','world-play':'FIRST SENTENCE','world-retry':'FIRST SENTENCE','world-reward':'RESULT · FIRST SENTENCE','world-town':'TOWN','game':'PLAY','world-game-loading':'PLAY','world-game-error':'PLAY','world-songs':'SONGS','world-song':'SONGS'};
function show(title,html,type='world',extra={}){gameLaunch++;if(type!=='world-game-conflict')gameRecovery=null;enrollmentView?.dispose();enrollmentView=null;classroomView?.dispose();classroomView=null;homeworkView?.dispose();homeworkView=null;if(screen==='game'&&type!=='game'){townSession?.dispose();townSession=null;delete window.SYNKWorldTownHost;}screen=type;home.showPanel(title,html,{type,eyebrow:EYEBROWS[type]||'SYNK WORLD',...extra});}
// 안내 블록(LED 점 + 모노 라벨 + 제목 + 글). tone: ok·info·check·alert
const notice=(label,tone,title,body)=>`<div class="world-notice" data-tone="${tone}" data-label="${label}"><strong>${title}</strong><span>${body}</span></div>`;
// Ordinary navigation may discard an unsent manuscript only after the learner sees the consequence.
// Identity/permission invalidation still disposes directly and never retains account-owned text.
const confirmCourseExit=()=>!classroomView?.hasDraft?.()||window.confirm('아직 제출하지 않은 글이 있어요. 이 화면을 닫으면 작성 중인 글이 사라져요. 닫을까요?');
document.addEventListener('click',event=>{if(!classroomView?.hasDraft?.())return;const target=event.target.closest?.('#panel-close,[data-view],[data-world],[data-action],[data-world-learning],.ws-me a');if((!target&&event.target.id!=='world-panel')||target?.dataset.world==='logout')return;if(!confirmCourseExit()){event.preventDefault();event.stopImmediatePropagation();}},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&classroomView?.hasDraft?.()){event.preventDefault();event.stopImmediatePropagation();if(confirmCourseExit())close();}},true);
document.addEventListener('cancel',event=>{if(event.target.id==='world-panel'&&!confirmCourseExit()){event.preventDefault();event.stopImmediatePropagation();}},true);
function close(){gameLaunch++;enrollmentView?.dispose();enrollmentView=null;classroomView?.dispose();classroomView=null;homeworkView?.dispose();homeworkView=null;townSession?.dispose();townSession=null;delete window.SYNKWorldTownHost;screen='';home.closePanel();}
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

function renderStatus(){
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
 if((snap?.accountId||'guest')!==lifeOwner||client.generation!==lifeGeneration)initializeLife();
 renderHomeHanger(snap);
 if(!snap&&townSession){townSession.dispose();townSession=null;delete window.SYNKWorldTownHost;}
 if(!snap&&['world-play','world-retry','world-reward','world-profile','world-device-records','game','world-game-loading','world-game-error','world-game-conflict'].includes(screen)){draftRun=null;answers=[];lastCompletion=null;close();}
 if(!home.isMaru){if(snap){home.setEquipment(snap.avatar?.slots,snap.avatar?.dyes);$('.page-heading h1').textContent=snap.activeRun?'하던 놀이가 있어요':'첫 문장 놀이부터 시작해요';$('.hero-copy .felt-button').innerHTML=`${snap.activeRun?'이어서 하기':'첫 문장 놀이 시작하기'} <span aria-hidden="true">→</span>`;}
 else {home.setEquipment({});$('.page-heading h1').textContent='첫 문장 놀이부터 시작해요';$('.hero-copy .felt-button').innerHTML='첫 놀이 시작하기 <span aria-hidden="true">→</span>';}
 }
 if(home.isMaru){home.setEquipment(snap?.avatar?.slots||{},snap?.avatar?.dyes||{});home.updateAccount({snapshot:snap,status:client.status,pending:!!client.pending,busy:client.busy,operating});}
 const status=client.status==='offline'?'연결을 기다리고 있어요. 저장 전 내용은 아직 확정되지 않았어요.':client.status==='conflict'?'다른 화면에서 바뀐 내용을 확인해 주세요.':client.pending?'아직 저장하지 못한 차림이 있어요.':snap?`내 차림과 옷을 ${operating?'SYNK 계정':'로컬 서버'}에서 불러왔어요.`:'로그인하지 않아도 홈을 둘러볼 수 있어요.';
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
 if(!lifeProgress||!lifeUI)return;
 try{lifeUI.refresh();const node=document.querySelector('.life-save-status');if(node){const status=lifeProgress.status();node.textContent=status.message;node.dataset.savePhase=status.phase;}}catch{}
}
function showLifeRecovery(){
 if(!lifePort)return;
 lifeRecoveryShown=true;
 const status=lifePort.status(),rejected=!!status.rejected;
 show(t(rejected?'account.recoveryRejected':'account.recoveryChoose'),`${notice('SAVE','check',t(rejected?'account.recoveryRejectedNotice':'account.recoveryConflictNotice'),escape(tMessage(status.message)))}<p class="dialog-note">${t('account.recoveryNote')}</p><div class="world-actions"><button class="felt-button" data-world="life-resolve" data-choice="local">${t(rejected?'account.useDeviceAgain':'account.useDevice')}</button><button class="plain-button" data-world="life-resolve" data-choice="remote">${t('account.useRemote')}</button><button class="quiet-button" data-world="home">${t('account.checkLater')}</button></div>`,'life-recovery');
}
function tutorStatus(owner=client.snapshot?.accountId||'guest'){
 return tutorSelectionStatus({owner,progress:owner===lifeOwner?lifeProgress:null,ready:tutorReady&&owner===lifeOwner});
}
function restoreTutor(){
 try{restoreTutorSelection({progress:lifeProgress,owner:lifeOwner,storage:localStorage,apply:(id,owner)=>home.applyTutorChoice?.(id,owner)});}catch{/* Preserve unreadable/conflicting records and expose recovery. */}
 // 계정에 고른 화면 언어가 있으면 그 언어로, 없으면 이 기기에서 고른 언어를 계정에 채운다(튜터 선택과 같은 기록).
 try{restoreDisplayLanguage({progress:lifeProgress});}catch{/* 저장 확인 화면이 따로 알린다. */}
 home.refreshTutorStatus?.();
}
async function prepareTutor(){
 const owner=client.snapshot?.accountId||'guest',generation=client.generation;
 if(!lifeReady)initializeLife();await lifeReady;
 if(owner!==(client.snapshot?.accountId||'guest')||generation!==client.generation)return false;
 if(tutorStatus(owner).blocked){showLifeRecovery();return false;}
 return true;
}
function showEntryRecovery(){
 show(t('account.entryTitle'),`${notice('ACCOUNT','check',t('account.entryNotice'),t('account.entryBody'))}<div class="world-actions"><button class="felt-button" data-world="entry-retry">${t('account.reconnect')}</button><button class="plain-button" data-world="entry-title">${t('account.toTitle')}</button></div>`,'world-entry-recovery');
}
async function prepareWorldTutor(){
 if(client.snapshot&&tutorReady&&!lifePort)await initializeLife();
 if(!await prepareTutor())return false;
 if(!tutorReady||client.snapshot&&!lifeProgress?.status().scoped){showEntryRecovery();return false;}
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
 const guard=()=>{if(owner!==(client.snapshot?.accountId||'guest')||generation!==client.generation)throw Object.assign(Error('계정 연결이 바뀌었어요. 다시 골라 주세요.'),{code:'ACCOUNT_CHANGED'});};
 if(!lifeReady)initializeLife();await lifeReady;guard();
 if(!lifeProgress?.status().scoped)return {saved:true,mode:'device'};
 try{return await commitDisplayLanguage({progress:lifeProgress,language,guard});}finally{refreshLife();}
}
async function selectTutor(tutor,owner){
 const generation=client.generation;
 const guard=()=>{if(owner!==(client.snapshot?.accountId||'guest')||generation!==client.generation)throw Object.assign(Error('계정 연결이 바뀌었어요. 다시 골라 주세요.'),{code:'ACCOUNT_CHANGED'});};
 guard();await lifeReady;guard();
 if(owner!=='guest'&&!lifePort){await initializeLife();guard();}
 try{return await commitTutorSelection({progress:lifeProgress,owner,tutor,storage:localStorage,guard});}
 catch(error){if(error.code==='REVISION_CONFLICT')showLifeRecovery();throw error;}
 finally{refreshLife();}
}
// 첫 실행 「한글을 읽을 수 있어요?」의 답: 튜터 선택처럼 생활 진도 기록(계정이면 계정, 손님이면 이 기기)에 둔다.
async function hangulReading(owner){
 if(!lifeReady)initializeLife();await lifeReady;
 if(owner!==(client.snapshot?.accountId||'guest')||owner!==lifeOwner||!lifeUI)return null;
 return lifeUI.hangulReading();
}
async function setHangulReading(answer,owner,{via='question'}={}){
 const generation=client.generation;
 const guard=()=>{if(owner!==(client.snapshot?.accountId||'guest')||generation!==client.generation)throw Object.assign(Error('계정 연결이 바뀌었어요. 다시 골라 주세요.'),{code:'ACCOUNT_CHANGED'});};
 guard();await lifeReady;guard();
 if(owner!=='guest'&&!lifePort){await initializeLife();guard();}
 if(!lifeUI)throw Error('학습 기록을 아직 준비하고 있어요. 잠시 뒤 다시 골라 주세요.');
 try{return await lifeUI.setHangulReading(answer,{via});}
 catch(error){if(error.code==='REVISION_CONFLICT')showLifeRecovery();throw error;}
 finally{refreshLife();}
}
async function refreshTutorAccount(){
 if(tutorRefresh||!client.snapshot||!tutorReady||tutorStatus().blocked)return;
 const epoch=lifeEpoch,port=lifePort;
 tutorRefresh=(async()=>{try{if(!port){if(!home.openPanel())await initializeLife();return;}await lifeProgress.flush();if(epoch===lifeEpoch&&lifePort===port&&!home.openPanel())await initializeLife();}catch{/* Keep the durable queue and current screen. */}})();
 try{await tutorRefresh;}finally{tutorRefresh=null;}
}
function initializeLife(){
 const owner=client.snapshot?.accountId||'guest',generation=client.generation,epoch=++lifeEpoch;
 lifeOwner=owner;lifeGeneration=generation;tutorReady=false;education?.dispose();education=null;home.connectEducation?.(null);localLearning?.dispose();localLearning=null;lifeUI?.dispose();lifeProgress?.stop();lifePort?.dispose();lifeUI=null;lifeProgress=null;lifePort=null;lifeRecoveryShown=false;
 const guard=()=>{if(epoch!==lifeEpoch||(client.snapshot?.accountId||'guest')!==owner||generation!==client.generation)throw Object.assign(Error('생활 한국어 계정 연결이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});};
 home.updateLearning?.({owner,completed:0,total:LESSONS.length,packs:PACKS,nextLesson:null,resume:false,dueCount:0,status:{phase:'loading'}});
 lifeReady=(async()=>{
  let port=null,mode='local',notice=null;
  if(owner!=='guest'){
   const onStatus=status=>{if(epoch!==lifeEpoch)return;refreshLife();if(['conflict'].includes(status.phase)&&!lifeRecoveryShown&&home.openPanel().startsWith('life-'))showLifeRecovery();};
   try{
    port=operating?await account.prepareLifeProgress({storage:localStorage,onStatus}):await createLifeProgressPort({accountId:owner,guard,storage:localStorage,onStatus,client:{load:()=>client.request('life-progress'),mutate:body=>client.request('life-progress',{method:'POST',body})}});
    guard();mode='account';lifePort=port;
   }catch(error){if(epoch!==lifeEpoch){port?.dispose();return;}notice='계정 진도에 연결하지 못해 이 기기의 기록으로 이어가요.';}
  }
  guard();
  const getSaveStatus=()=>lifeSaveStatus(port);
  lifeProgress=createLifeProgress({owner,mode,storage:port?.storage||localStorage,now:()=>Date.now(),guard,save:port?.flush,getSaveStatus,onChange:refreshLife});
  if(notice){const status=lifeProgress.status;lifeProgress=Object.freeze({...lifeProgress,status:()=>({...status(),message:notice})});}
  if(!operating&&owner!=='guest')localLearning=createLocalWorldLearningHost({owner,guard,target:window,storage:localStorage});
  if(operating&&owner!=='guest')try{await account.prepareGame({target:window});guard();}catch{guard();}
  topicAnswers=null;
  if(operating&&owner!=='guest')void account.topicAnswers?.().then(value=>{if(epoch===lifeEpoch&&value){topicAnswers={owner,...value};education?.refresh();}},()=>{});
  mountLifeLearning();
  window.__synkLife=lifeUI;
  tutorReady=true;restoreTutor();
  refreshLife();
 })().catch(error=>{if(epoch===lifeEpoch)home.toast(error.message||'생활 진도를 확인하지 못했어요.');});
 return lifeReady;
}
function mountLifeLearning(){
 education?.dispose();education=null;
 lifeUI=createLifeExperience({home,getProgress:()=>lifeProgress,asset:path=>worldUrl('brand-opening/assets/'+path),show:(title,html,options)=>show(title,html,options.type,{eyebrow:options.eyebrow,nav:options.nav}),onSummary:()=>education?.refresh(),onNext:()=>education?.next(),presentation:()=>education?.presentation()});
 // 공개판(계정 모드)의 손님은 GUEST_GAMES와 체험이 남은 게임만 바로 열고 나머지는 로그인부터 연다(launchGame). 추천도 같은 목록을 써야 로그인 창을 맴돌지 않는다.
 const createPlan=options=>createWorldLearningPlan({...options,answers:topicAnswers&&topicAnswers.owner===lifeOwner?topicAnswers:null,openGames:operating&&!client.snapshot?guestGames():null});
 // 내 위치(10-19 결정): 짧은 진단 듣기 문항의 녹음은 게임 폴더(korean-runner·korean-rhythm)에서 부른다.
 education=createWorldEducation({home,getProgress:()=>lifeProgress,engine:worldLearning,createPlan,target:window,position:worldPosition,audioUrl:worldUrl,
  readHangulProgress:operating&&lifeOwner!=='guest'?async()=>{
   const port=await account.prepareHangulProgress({storage:localStorage,target:window});
   try{return port.read();}finally{port.dispose();}
  }:null,
  launchGame,startLesson:id=>lifeUI.start(id),startReview:(id,ids)=>lifeUI.reviewStart(id,ids),
  prepare:async()=>{if(operating&&client.snapshot&&!window.SYNKLearningHost)await account.prepareGame({target:window});}});
 home.connectEducation?.(education);window.__synkEducation=education;
}
async function openLife(method,...args){
 if(!lifeReady)initializeLife();
 const epoch=lifeEpoch;await lifeReady;
 if(epoch!==lifeEpoch||!lifeUI)return;
 if(lifePort&&(lifePort.status().phase==='conflict'||lifePort.status().rejected)){showLifeRecovery();return;}
 lifeUI[method]?.(...args);
}
async function resolveLife(button){
 const port=lifePort,epoch=lifeEpoch;if(!port)return;
 document.querySelectorAll('[data-world="life-resolve"]').forEach(node=>node.disabled=true);
 try{
  await port.resolve(button.dataset.choice);
  if(epoch!==lifeEpoch||lifePort!==port||home.openPanel()!=='life-recovery')return;
  if(port.status().rejected||port.status().phase==='conflict'){lifeRecoveryShown=false;showLifeRecovery();return;}
  lifeRecoveryShown=false;lifeUI?.dispose();lifeProgress?.stop();
  const guard=port.guard;
  lifeProgress=createLifeProgress({owner:lifeOwner,mode:'account',storage:port.storage,now:()=>Date.now(),guard,save:port.flush,getSaveStatus:()=>lifeSaveStatus(port),onChange:refreshLife});
  mountLifeLearning();
   window.__synkLife=lifeUI;tutorReady=true;restoreTutor();close();refreshLife();if(worldRequested&&entryGate?.state().phase==='error')void entryGate.start();
 }catch(error){if(epoch===lifeEpoch&&home.openPanel()==='life-recovery'){home.toast(error.message||'아직 진도를 저장하지 못했어요.');document.querySelectorAll('[data-world="life-resolve"]').forEach(node=>node.disabled=false);}}
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
async function town(){if(operating){if(!client.snapshot)return signIn();try{const entry=await client.request('town/entry');if(!entry.allowed){show('싱크타운',townSheet({chip:{tone:'check',text:'입장 확인 필요'},lead:'동네는 입장 조건을 확인한 뒤에 열려요.',blocks:notice('ENTRY','check','TOPIK 1급 이상 확인과 타운 이용권이 필요해요','내 계정의 입장 권한을 확인한 뒤 다시 열어 주세요.'),actions:'<button class="plain-button" data-world="profile">내 계정 확인하기</button>'}),'world-town');return;}const state=await client.request('town/state'),binding=state.binding,sharing=binding?.sharing;show('싱크타운',townSheet({chip:{tone:'ok',text:'내 차림 그대로'},lead:TOWN_LEAD,blocks:`${notice('MY TOWN','ok','타운 기록은 SYNK ID에 저장돼요',`개인 기록은 내 계정으로 이어져요.${binding?.kind==='academy'?' 학원에 보여 줄 활동은 아래에서 따로 골라요.':' 학원 공유는 소속 반이 연결되면 고를 수 있어요.'}`)}${binding?.classId?`<label class="world-notice" data-label="SHARING"><span><input type="checkbox" data-town-sharing data-revision="${Number(sharing?.revision)||0}" ${sharing?.enabled?'checked':''} ${sharing?.blockedByLearningSharing?'disabled':''}> 타운 활동을 학원에 공유하기</span><span>${sharing?.blockedByLearningSharing?'학습 공유를 켠 뒤에 타운 공유를 고를 수 있어요.':'켠 뒤에 새로 한 타운 활동만 공유해요. 꺼도 내 기록은 남아요.'}</span></label>`:''}`,actions:'<button class="felt-button" data-world="town-preview">내 차림으로 동네 열기 <span aria-hidden="true">→</span></button>'}),'world-town');}catch(error){home.toast(errorText(error));}return;}show('싱크타운',townSheet({chip:{tone:'info',text:'테스트 계정 미리보기'},lead:TOWN_LEAD,blocks:notice('PREVIEW','info','차림 연결만 확인하는 미리보기예요','실제 타운의 TOPIK 1급+ 조건·이용권·입장 권한은 주지 않아요.'),actions:`<button class="felt-button" data-world="town-preview">${client.snapshot?'내 차림으로 동네 열기':'테스트 계정 연결하기'} <span aria-hidden="true">→</span></button><button class="quiet-button" data-action="hangul">한글부터 배우기</button>`}),'world-town');}
function townPreview(){if(!client.snapshot)return signIn();townSession?.dispose();townSession=operating?createTownWorldHost(client):null;if(townSession)window.SYNKWorldTownHost=townSession;show(operating?'싱크타운':'싱크타운 · 미리보기',`<iframe class="game-frame" title="내 차림으로 걷는 싱크타운" src="${worldUrl('town/day.html')}?play=walk" allow="autoplay; fullscreen" allowfullscreen></iframe>`,'game');}
// 「이번 주 과제」 자료(tools/build-topik4-homework.mjs가 만든 JSON). 공개본에서도 WORLD 경로 아래에 있다.
const homeworkJson=name=>fetch(worldUrl(name),{cache:'no-cache',credentials:'omit'}).then(response=>{if(!response.ok)throw Object.assign(Error('과제 자료를 읽지 못했어요.'),{code:'HOMEWORK_CONTENT',status:response.status});return response.json();});
// 계정 머리의 초상은 내가 고른 튜터의 계정 사진(왼쪽 위 캡슐과 같은 사진). 고른 튜터가 없으면 기본 몽글 사진.
const TUTOR_NAMES={mongle:'몽글',kkamong:'까몽',marin:'마린'};
function profilePortrait(){const id=home.tutor?.()?.tutor;return profilePhoto(['mongle','kkamong','marin'].includes(id)?id:'default');}
function profile(){if(!client.snapshot)return signIn();const tutorId=home.tutor?.()?.tutor,tutorName=TUTOR_NAMES[tutorId]?t(`tutor.name.${tutorId}`):null;show(t('account.meTitle'),`<div class="ws-me"><div class="ws-me-id"><span class="ws-me-portrait"><img src="${profilePortrait()}" alt=""></span><div><p class="ws-me-name">${tutorName?t('account.learningWith',{name:tutorName}):t('account.learningTogether')}</p><p class="ws-me-sub">${t('account.savedTo',{where:t(operating?'account.whereId':'account.whereTest')})}</p></div></div>${notice('SAVE',client.pending?'check':'ok',t(client.pending?'account.savePending':'account.saveOk'),t('account.revision',{revision:escape(client.snapshot.revision),kind:t(operating?'account.kindId':'account.kindTest')}))}${operating?`<section class="world-notice" data-tone="info" data-label="LEARNING"><strong>${t('account.learningRecords')}</strong>${account.preferences()?`<label><input type="checkbox" data-world-learning data-revision="${account.preferences().revision}" ${account.preferences().enabled?'checked':''}> ${t('account.learningSave')}</label><span>${t('account.learningNote')}</span>`:`<span>${t('account.learningElsewhere')}</span>`}<a class="felt-button" href="https://synk.im/account/client.html?product=world">${t('account.classSettings')} <span aria-hidden="true">→</span></a></section>`:''}<div id="world-classroom-lessons"></div><div id="world-classroom-homework"></div><div id="world-classroom-entry"></div><div class="world-actions"><button class="felt-button" data-world="wardrobe">${t('wardrobe.open')}</button><button class="quiet-button" data-world="logout">${t('account.logout')}</button></div></div>`,'world-profile');if(home.isMaru){const actions=$('#panel-content .ws-me>.world-actions');if(actions)actions.before(hanger);else $('#panel-content').append(hanger);renderHomeHanger(client.snapshot);}if(operating){const generation=client.generation,owner=client.snapshot.accountId,guard=()=>{account.assertActive();if(generation!==client.generation||client.snapshot?.accountId!==owner)throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});};
 // 「우리 반 수업」은 반 연결 바로 위: 연결하면 이 시트를 다시 그려 같은 자리에 수업이 이어진다. 시트가 열려 있는 동안만 30초마다 묻는다.
 if(account.supportsClassroom){const lessons=mountClassroomLessons({container:$('#world-classroom-lessons'),load:()=>account.readClassrooms(),guard}),course=mountCourseWritingEntry({container:$('#world-classroom-lessons'),transport:account.courseRequest,guard});classroomView={hasDraft:()=>course.hasDraft(),dispose(){lessons.dispose();course.dispose();}};}
 // 기존 주차 과제와 초안을 유지한다. 수정 과제를 시작한 반은 서버가 이전 이력 보기로 전환하고, 정답은 해당 제출 권한을 확인해 전달한다.
 if(account.supportsHomework)homeworkView=mountClassroomHomework({container:$('#world-classroom-homework'),load:()=>account.readHomework(),submit:input=>account.submitHomework(input),
  loadContent:()=>homeworkJson('topik4-homework.json'),loadKey:input=>account.readHomeworkKey(input),owner,guard});
 enrollmentView=mountEnrollment({container:$('#world-classroom-entry'),request:account.enrollmentRequest,guard,beforeClaim:confirmCourseExit,onLinked:async()=>{townSession?.dispose();townSession=null;delete window.SYNKWorldTownHost;await account.restore();profile();}});}}
async function wardrobe(){
 if(!client.snapshot)return signIn();
 show('옷장','<p class="panel-description" role="status">옷장을 여는 중이에요.</p>','world-wardrobe');
 const ticket=gameLaunch,owner=client.snapshot.accountId,generation=client.generation;
 let createWardrobeStudio;
 try{({createWardrobeStudio}=await import('../synk-world-home/wardrobe-studio.mjs'));}
 catch{if(ticket===gameLaunch&&screen==='world-wardrobe')show('옷장을 열지 못했어요','<p class="panel-description">연결을 확인한 뒤 다시 열어 주세요.</p><div class="world-actions"><button class="felt-button" data-world="wardrobe">다시 열기</button></div>','world-wardrobe');return;}
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
 if(education?.applyPreferences()===false)throw Error('도움 방식 저장을 다시 확인해 주세요.');
 // 체험 판의 틀은 메모리 호스트를 받는다: 판이 끝나면 그 게임의 체험을 닫고 추천을 다시 고르며, 결과의 로그인 단추는 계정 연결을 연다.
 if(trial){trialHost=createGuestTrialPlayHost({game:id,onRound:()=>{guestTrials.finish(id);education?.refresh();},signIn:()=>setTimeout(()=>{if(client.snapshot)return;close();signIn(id);},0)});window.SYNKPlayHost=trialHost;}
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
 'resolve-play':async button=>{const recovery=gameRecovery;if(!recovery||recovery.busy)return;recovery.busy=true;document.querySelectorAll('[data-world="resolve-play"]').forEach(b=>b.disabled=true);try{await recovery.session.resolve(button.dataset.choice);if(gameRecovery===recovery&&screen==='world-game-conflict'&&worldPanel.open&&(!home.isMaru||home.openPanel()==='world-game-conflict'))await launchGame(recovery.id);}catch(error){if(gameRecovery===recovery&&worldPanel.open&&(!home.isMaru||home.openPanel()==='world-game-conflict')){home.toast(errorText(error));recovery.busy=false;document.querySelectorAll('[data-world="resolve-play"]').forEach(b=>b.disabled=false);}}},
 'sign-in':signIn,'account-login':beginAccountLogin,'guest':()=>{try{localStorage.setItem('synk-world-v1-welcomed','1');}catch{}close();if(worldRequested)return entryGate.start();},'login-a':()=>login('player-a'),'login-b':()=>login('player-b'),profile,wardrobe,pending,play,finish,home:()=>{close();home.goTown?.();},town,songs,'town-preview':townPreview,
 pause:()=>{saveDraft();close();home.toast('고른 답은 그대로 두었어요. 나중에 이어서 해요.');},
 answer:button=>{const q=draftRun.questions[questionIndex];answers=answers.filter(a=>a.questionId!==q.questionId);answers.push({questionId:q.questionId,optionId:button.dataset.option});saveDraft();playSound('select');showQuestion();},
 next:()=>{if(questionIndex<draftRun.questions.length-1){questionIndex++;showQuestion();}else finish();},
 equip:async button=>{try{const slots={...client.snapshot.avatar.slots};slots[button.dataset.slot]=slots[button.dataset.slot]===button.dataset.item?'':button.dataset.item;await client.equip(slots);wardrobe();home.toast('차림을 서버에 저장했어요.');}catch(e){home.toast(errorText(e));if(client.pending)pending();}},
 'wear-reward':async()=>{try{await client.equip({...client.snapshot.avatar.slots,neck:'mongle-scarf-first-steps'});close();home.toast('첫 산책 목도리를 입었어요.');}catch(e){home.toast(errorText(e));if(client.pending)pending();}},
 'retry-pending':async()=>{try{await client.sendPending();wardrobe();}catch(e){home.toast(errorText(e));}},
 'discard-pending':async()=>{try{await client.discardPending();wardrobe();}catch(e){home.toast(errorText(e));}},
 refresh:async()=>{try{await client.refresh();home.toast(t('account.reconnected'));}catch(e){home.toast(errorText(e));}},
 logout:async()=>{accountActionPending=true;entryGate?.invalidate();try{await client.logout();sessionConfirmed=false;close();if(home.isMaru)await entryGate.start();else welcome();}catch(e){if(e.code==='STALE_RESPONSE')return;home.toast(t('account.logoutFailed'));if(home.isMaru)showEntryRecovery();else welcome();}finally{accountActionPending=false;}},
};
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
window.addEventListener('pagehide',()=>{education?.dispose();localLearning?.dispose();lifeEpoch++;lifeUI?.dispose();lifeProgress?.stop();lifePort?.dispose();townSession?.dispose();delete window.SYNKWorldTownHost;account?.stop();});
window.addEventListener('online',()=>{if(client.snapshot)client.refresh().then(refreshTutorAccount).catch(()=>{});});
// Switching between side-by-side web and desktop windows need not hide either
// document. Refocus must also restore the latest selected companion.
window.addEventListener('focus',()=>{if(!document.hidden&&client.snapshot&&!client.busy)void refreshTutorAccount();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&client.snapshot&&!client.busy)client.refresh().then(refreshTutorAccount).catch(()=>{});});
// A queued close event from sign-in must not clear a newly opened fitting room.
const worldPanel=$('#world-panel')||$('#panel');
worldPanel.addEventListener('close',()=>{if(!worldPanel.open){gameLaunch++;gameRecovery=null;screen='';hangerSignature='';renderHomeHanger(client.snapshot);enrollmentView?.dispose();enrollmentView=null;classroomView?.dispose();classroomView=null;homeworkView?.dispose();homeworkView=null;townSession?.dispose();townSession=null;delete window.SYNKWorldTownHost;}});
window.__synkWorld={client,screen:()=>screen,wardrobe:()=>wardrobeStudio?.metrics(),life:()=>lifeUI?.metrics()};
home.connectHost?.({profile,wardrobe,play,town,about,photo,songs,launchGame,prepareTutor,selectTutor,selectLanguage,tutorStatus,hangulReading,setHangulReading,learn:()=>openLife('next'),packs:()=>openLife('packs'),stories:()=>openLife('stories'),review:()=>openLife('review'),cafe:()=>openLife('cafe'),pack:id=>openLife('pack',id),lesson:id=>openLife('start',id),replayOpening:()=>{close();return startOpening(true);}});
// 공개판 설계 §2: 로그인할 때 이 기기의 손님 한글 기록(한글 만나기 진도·첫 실행 답)을 계정으로 옮길지 한 번 묻는다(device-records.mjs).
// 계정 생활 진도와 학습 호스트가 준비된 뒤 입장 관문이 튜터 고르기 앞에서 연다. 다른 계정의 기록에는 쓰지 않는다.
const accountLife=()=>{const owner=client.snapshot?.accountId;if(!owner||owner!==lifeOwner||!lifeUI)throw Object.assign(Error('계정 연결이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});return lifeUI;};
// 화면 언어(10-19 1판): 「한글 기록 이어 가기」 판의 글은 열 때마다 고른 언어로 읽는다(device-records.mjs DEVICE_RECORDS_TEXT와 같은 키).
const deviceRecordsText=()=>({title:t('records.title'),lead:t('records.lead'),move:t('records.move'),keep:t('records.keep'),snapshot:t('records.snapshot'),snapshotBody:t('records.snapshotBody'),
 moving:t('records.moving'),failed:t('records.failed'),moved:t('records.moved'),partly:t('records.partly'),kept:t('records.kept'),hangulRow:t('records.hangulRow'),answerRow:t('records.answerRow'),
 answerNew:t('records.answerNew'),answerReads:t('records.answerReads'),graduated:t('records.graduated'),met:n=>t('records.met',{n}),metMastered:(n,m)=>t('records.metMastered',{n,m}),
 skipped:t('records.skipped'),started:t('records.started'),keptHangul:t('records.keptHangul'),keptAnswer:t('records.keptAnswer')});
let hangulMigrationPort=null;
const deviceRecords=createDeviceRecordsOffer({storage:localStorage,learningStatus:()=>window.SYNKLearningHost?.status?.()||null,hangulPort:()=>hangulMigrationPort,accountOwner:()=>client.snapshot?.accountId||'guest',
 accountAnswer:()=>accountLife().hangulReading(),setAccountAnswer:async(answer,options)=>{const life=accountLife();try{return await life.setHangulReading(answer,options);}finally{refreshLife();}},
 present:({title,html,onClose})=>{show(title,html,'world-device-records');home.attachPanelResource({dispose:onClose});},close,toast:message=>home.toast(message),head:accountPrint(),text:deviceRecordsText});
commands['device-records']=button=>{const line=document.querySelector('[data-device-records-status]');return deviceRecords.choose(button.dataset.choice,{owner:client.snapshot?.accountId||'guest',
 status:(text,busy)=>{if(line)line.textContent=text;document.querySelectorAll('[data-world="device-records"]').forEach(node=>{node.disabled=busy;});}});};
entryGate=createWorldEntryGate({
 restore:async()=>{await initialRestoreReady;if(sessionTask)await sessionTask;else if(!sessionConfirmed)await restoreSession();},
 prepare:prepareWorldTutor,
 offer:async identity=>{
  hangulMigrationPort?.dispose();hangulMigrationPort=null;
  if(operating&&identity.owner!=='guest'){
   let port;
   try{port=await account.prepareHangulProgress({storage:localStorage,target:window});}
   catch{home.toast('한글 기록 옮기기는 계정 저장 연결을 확인한 뒤 다시 안내할게요.');return null;}
   if(identity.owner!==(client.snapshot?.accountId||'guest')||identity.generation!==client.generation){port.dispose();return null;}
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
   else if(new URLSearchParams(location.search).get('cafe')==='1')void openLife('cafe').catch(()=>home.toast('카페 연결을 확인한 뒤 다시 열어 주세요.'));
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
renderStatus();
if(new URLSearchParams(location.search).get('tutor')==='choose')home.chooseTutor?.();
