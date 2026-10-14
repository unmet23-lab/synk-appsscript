import {WorldClient} from './world-client.mjs';
import {mountEnrollment} from './enrollment.mjs';
import {createWorldAccount,loadWorldConfig,createLifeProgressPort,createLocalWorldLearningHost,worldLearning,createWorldLearningPlan} from './world-account.bundle.mjs';
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
const $=s=>document.querySelector(s);
const connection=await loadWorldConfig();
const operating=connection.mode==='account';
const worldUrl=path=>new URL(connection.basePath+path,location.origin).href;
const {firstSupport}=await import(worldUrl('brand-opening/game-tutor-support.mjs'));
const home=window.__synkHome||(await import(worldUrl('brand-opening/home.mjs'))).home;
let client,townSession,enrollmentView,lifeUI=null,lifeProgress=null,lifePort=null,lifeOwner=null,lifeGeneration=-1,lifeEpoch=0,lifeReady=null,lifeRecoveryShown=false;
let tutorReady=false,tutorRefresh=null,education=null,localLearning=null;
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
   close();home.toast('SYNK 계정으로 연결했어요.');
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
const EYEBROWS={'world-profile':'ACCOUNT','world-signin':'ACCOUNT','world-entry-recovery':'ACCOUNT','world-welcome':'SYNK WORLD','world-about':'ABOUT','world-wardrobe':'WARDROBE','world-pending':'SAVE','life-recovery':'SAVE','world-game-conflict':'SAVE','world-play':'FIRST SENTENCE','world-retry':'FIRST SENTENCE','world-reward':'RESULT · FIRST SENTENCE','world-town':'TOWN','game':'PLAY','world-game-loading':'PLAY','world-game-error':'PLAY','world-songs':'SONGS','world-song':'SONGS'};
function show(title,html,type='world',extra={}){gameLaunch++;if(type!=='world-game-conflict')gameRecovery=null;enrollmentView?.dispose();enrollmentView=null;if(screen==='game'&&type!=='game'){townSession?.dispose();townSession=null;delete window.SYNKWorldTownHost;}screen=type;home.showPanel(title,html,{type,eyebrow:EYEBROWS[type]||'SYNK WORLD',...extra});}
// 안내 블록(LED 점 + 모노 라벨 + 제목 + 글). tone: ok·info·check·alert
const notice=(label,tone,title,body)=>`<div class="world-notice" data-tone="${tone}" data-label="${label}"><strong>${title}</strong><span>${body}</span></div>`;
function close(){gameLaunch++;enrollmentView?.dispose();enrollmentView=null;townSession?.dispose();townSession=null;delete window.SYNKWorldTownHost;screen='';home.closePanel();}
function errorText(error){return {NETWORK_UNAVAILABLE:'연결이 잠시 끊겼어요. 선택한 내용은 그대로 두었어요.',REVISION_CONFLICT:'다른 화면에서 차림이 바뀌었어요. 최신 차림을 확인한 뒤 다시 골라주세요.',STALE_RESPONSE:'',AUTH_REQUIRED:'계정 연결이 끝났어요. 다시 연결해 주세요.',RUN_EXPIRED:'놀이 시간이 지나 새로 시작해야 해요.',BUSY:'앞선 요청을 확인하고 있어요.'}[error.code]||'아직 완료하지 못했어요. 잠시 뒤 다시 시도해 주세요.';}

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
 if(!snap&&['world-play','world-retry','world-reward','world-profile','game','world-game-loading','world-game-error','world-game-conflict'].includes(screen)){draftRun=null;answers=[];lastCompletion=null;close();}
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
 show(rejected?'기록 저장을 확인해 주세요':'이어 갈 기록을 골라 주세요',`${notice('SAVE','check',rejected?'계정에 저장하지 못했어요':'기록이 두 곳에서 달라요',escape(status.message))}<p class="dialog-note">튜터 선택과 학습 진도는 함께 저장돼요. 보내지 못한 놀이 기록도 고른 쪽으로 이어져요. 바꾸기 전 원본은 이 기기에 남겨 둬요.</p><div class="world-actions"><button class="felt-button" data-world="life-resolve" data-choice="local">이 기기의 기록으로 ${rejected?'다시 저장하기':'이어 가기'}</button><button class="plain-button" data-world="life-resolve" data-choice="remote">계정에 저장된 기록 쓰기</button><button class="quiet-button" data-world="home">나중에 확인하기</button></div>`,'life-recovery');
}
function tutorStatus(owner=client.snapshot?.accountId||'guest'){
 return tutorSelectionStatus({owner,progress:owner===lifeOwner?lifeProgress:null,ready:tutorReady&&owner===lifeOwner});
}
function restoreTutor(){
 try{restoreTutorSelection({progress:lifeProgress,owner:lifeOwner,storage:localStorage,apply:(id,owner)=>home.applyTutorChoice?.(id,owner)});}catch{/* Preserve unreadable/conflicting records and expose recovery. */}
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
 show('연결을 다시 확인해 주세요',`${notice('ACCOUNT','check','튜터 정보를 불러오지 못했어요','계정과 함께할 튜터를 확인하지 못했어요. 연결을 확인한 뒤 다시 시작해 주세요.')}<div class="world-actions"><button class="felt-button" data-world="entry-retry">다시 연결하기</button><button class="plain-button" data-world="entry-title">처음 화면으로 가기</button></div>`,'world-entry-recovery');
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
async function selectTutor(tutor,owner){
 const generation=client.generation;
 const guard=()=>{if(owner!==(client.snapshot?.accountId||'guest')||generation!==client.generation)throw Object.assign(Error('계정 연결이 바뀌었어요. 다시 골라 주세요.'),{code:'ACCOUNT_CHANGED'});};
 guard();await lifeReady;guard();
 if(owner!=='guest'&&!lifePort){await initializeLife();guard();}
 try{return await commitTutorSelection({progress:lifeProgress,owner,tutor,storage:localStorage,guard});}
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
  mountLifeLearning();
  window.__synkLife=lifeUI;
  tutorReady=true;restoreTutor();
  refreshLife();
 })().catch(error=>{if(epoch===lifeEpoch)home.toast(error.message||'생활 진도를 확인하지 못했어요.');});
 return lifeReady;
}
function mountLifeLearning(){
 education?.dispose();education=null;
 lifeUI=createLifeExperience({home,getProgress:()=>lifeProgress,asset:path=>worldUrl('brand-opening/assets/'+path),show:(title,html,options)=>show(title,html,options.type,{eyebrow:options.eyebrow,nav:options.nav}),onSummary:()=>education?.refresh(),onNext:()=>education?.next()});
 education=createWorldEducation({home,getProgress:()=>lifeProgress,engine:worldLearning,createPlan:createWorldLearningPlan,target:window,
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
function signIn(){if(operating){show('계정 연결',`<div class="ws-signin">${signInHead('SYNK ID로 들어오면 차림과 놀이 기록이 어느 화면에서나 이어져요')}${notice('ACCOUNT','info','SYNK ID 하나로 저장돼요','학원에 공유하는 기록은 내 계정의 동의 설정을 따라요. 타운 활동 공유는 따로 고를 수 있어요.')}<div class="world-actions"><button class="felt-button" data-world="account-login" data-world-submit>SYNK ID로 로그인하기</button><button class="plain-button" data-world="guest">먼저 둘러보기</button></div></div>`,'world-signin');return;}show('계정 연결',`<div class="ws-signin">${signInHead('테스트 계정으로 들어오면 차림과 옷이 다른 화면에서도 이어져요')}${notice('REHEARSAL','info','로컬 테스트 계정이에요','실제 Google·Apple 로그인과 따로 움직여요. 아래 두 계정에는 시험 기록만 저장돼요.')}<div class="world-actions"><button class="felt-button" data-world="login-a" data-world-submit>테스트 계정으로 시작하기</button><button class="plain-button" data-world="login-b" data-world-submit>다른 테스트 계정으로 시작하기</button></div><p class="dialog-note">웹과 Unity 앱은 같은 로컬 서버 계약을 써요. 실제 계정 연결은 네이티브 인증을 설정한 뒤 확인해요.</p></div>`,'world-signin');}
async function login(account){accountActionPending=true;entryGate?.invalidate();try{await client.signIn(account);sessionConfirmed=true;try{localStorage.setItem('synk-world-v1-welcomed','1');}catch{}close();home.toast('내 홈과 차림을 불러왔어요.');if(worldRequested)await entryGate?.start();if(wardrobeRequested&&entryGate?.state().phase==='ready')wardrobe();}catch(e){home.toast(errorText(e));}finally{accountActionPending=false;}}
function about(){if(operating){show('SYNK WORLD 소개','<div class="review-note"><p>첫 문장 놀이를 마치면 목도리를 받아요. 받은 옷으로 차림을 꾸미고, 차림·놀이·타운 기록은 같은 SYNK ID로 이어져요.</p><p>학습 기록과 학원에 보여 줄 타운 활동은 각각 따로 동의해요. 응답 기록은 연습 근거일 뿐, TOPIK 급수나 학습 효과를 판정한 점수가 아니에요.</p></div>','world-about');return;}show('SYNK WORLD 소개','<div class="review-note"><p><strong>지금 되는 것</strong><br>테스트 계정으로 첫 문장 놀이를 마치고, 받은 목도리와 앞치마를 함께 입어요. 같은 계정의 다른 화면에서도 차림을 불러오고, 지금 차림을 3D 사진으로 남겨요.</p><p><strong>아직 확인할 것</strong><br>실제 SYNK 로그인, 설치형 앱 실행, 휴대폰 성능은 따로 확인해야 해요. 미니게임과 노래는 지금도 열 수 있어요.</p><p>이 개발판은 이 PC의 로컬 서버와 합성 계정만 써요. 운영 계정과 공개 앱은 바뀌지 않아요.</p></div>','world-about');}
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
// 계정 머리의 초상은 내가 고른 튜터의 계정 사진(왼쪽 위 캡슐과 같은 사진). 고른 튜터가 없으면 기본 몽글 사진.
const TUTOR_NAMES={mongle:'몽글',kkamong:'까몽',marin:'마린'};
function profilePortrait(){const id=home.tutor?.()?.tutor;return profilePhoto(['mongle','kkamong','marin'].includes(id)?id:'default');}
function profile(){if(!client.snapshot)return signIn();const tutorName=TUTOR_NAMES[home.tutor?.()?.tutor];show('내 계정',`<div class="ws-me"><div class="ws-me-id"><span class="ws-me-portrait"><img src="${profilePortrait()}" alt=""></span><div><p class="ws-me-name">${tutorName?`${tutorName}과 함께 배우고 있어요`:'함께 배우고 있어요'}</p><p class="ws-me-sub">차림·옷·첫 놀이 선물을 ${operating?'내 SYNK ID':'이 테스트 계정'}에 저장해요</p></div></div>${notice('SAVE',client.pending?'check':'ok',client.pending?'저장 대기 중이에요':'저장 연결됨',`차림 판본 ${escape(client.snapshot.revision)} · ${operating?'SYNK 계정':'로컬 테스트 계정'}`)}${operating?`<section class="world-notice" data-tone="info" data-label="LEARNING"><strong>학습 기록 연결</strong>${account.preferences()?`<label><input type="checkbox" data-world-learning data-revision="${account.preferences().revision}" ${account.preferences().enabled?'checked':''}> 학습 기록을 SYNK 계정에 저장하기</label><span>켠 뒤에 한 첫 문장 놀이 답만 저장해요. 학원 공유와 타운 활동 공유는 내 수업에서 따로 정해요.</span>`:'<span>학습 연결 설정은 내 수업의 계정 화면에서 볼 수 있어요.</span>'}<a class="felt-button" href="https://synk.im/account/client.html?product=world">수업·공유 설정 열기 <span aria-hidden="true">→</span></a></section>`:''}<div id="world-classroom-entry"></div><div class="world-actions"><button class="felt-button" data-world="wardrobe">옷장 열기</button><button class="quiet-button" data-world="logout">로그아웃하기</button></div></div>`,'world-profile');if(home.isMaru){const actions=$('#panel-content .ws-me>.world-actions');if(actions)actions.before(hanger);else $('#panel-content').append(hanger);renderHomeHanger(client.snapshot);}if(operating){const generation=client.generation,owner=client.snapshot.accountId;enrollmentView=mountEnrollment({container:$('#world-classroom-entry'),request:account.enrollmentRequest,guard:()=>{account.assertActive();if(generation!==client.generation||client.snapshot?.accountId!==owner)throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});},onLinked:async()=>{townSession?.dispose();townSession=null;delete window.SYNKWorldTownHost;await account.restore();profile();}});}}
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
function pending(){show('아직 저장하지 못했어요',`${notice('SAVE','check','고른 차림이 저장되지 않았어요','보내는 중에 연결이 끊겼거나 다른 화면에서 차림이 바뀌었어요. 홈에는 마지막으로 확인된 차림이 보여요.')}<div class="world-actions"><button class="felt-button" data-world="retry-pending" data-world-submit>같은 요청 다시 보내기</button><button class="plain-button" data-world="discard-pending">최신 차림 불러오기</button></div>`,'world-pending');}
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
const games={runner:{title:'바람길',path:'korean-runner/'},rhythm:{title:'말의 리듬',path:'korean-rhythm/'},hangul:{title:'한글 만나기',path:'hangul-stage/'}};
function showGameConflict(id,session){
 const status=session.status().play;
 gameRecovery={id,session,busy:false};
 show('이어 갈 진도를 골라 주세요',`${notice('SAVE','check','다른 기기에서 놀이 기록이 바뀌었어요','고른 진도로 이어 가요. 바꾸기 전 원본은 이 기기에 남겨 둬요.')}<div class="world-actions"><button class="felt-button" data-world="resolve-play" data-choice="remote">계정에 저장된 진도 쓰기</button>${status.code==='IMPORT_CONFLICT'?'':'<button class="plain-button" data-world="resolve-play" data-choice="local">이 기기의 진도 쓰기</button>'}<button class="quiet-button" data-world="home">나중에 고르기</button></div><p class="dialog-note">코인과 구매품은 계정에서 확인한 결과를 따라요.</p>`,'world-game-conflict');
}
async function launchGame(id){
 const game=games[id];if(!game)return;
 if(home.ensureTutor&&!home.tutor()?.tutor)return home.ensureTutor(()=>launchGame(id));
 let session;
 if(operating){
  if(!client.snapshot)return signIn();
  const accountId=client.snapshot.accountId;
  show(game.title,'<p class="panel-description" role="status">내 놀이 기록을 불러오는 중이에요.</p>','world-game-loading');
  const ticket=gameLaunch;
  try{session=await account.prepareGame({target:window,onStatus:state=>{if(!session||activeGameSession!==session||screen!=='game')return;if(state.play.phase==='conflict')showGameConflict(id,session);else if(state.play.phase==='stopped')show('놀이 연결이 끊겼어요',`${notice('PLAY','check','놀이 기록 연결이 멈췄어요','내 계정의 연결 상태를 확인한 뒤 다시 들어와 주세요.')}<div class="world-actions"><button class="felt-button" data-world="profile">내 계정 확인하기</button><button class="quiet-button" data-world="home">우리 동네로</button></div>`,'world-game-error');}});}
  catch(error){if(ticket!==gameLaunch||!worldPanel.open||home.isMaru&&home.openPanel()!=='world-game-loading')return;show('놀이 연결을 확인해 주세요',`${notice('PLAY','check','놀이 기록에 연결하지 못했어요',escape(errorText(error)))}<div class="world-actions"><button class="felt-button" data-world-game="${id}">다시 연결하기</button><button class="plain-button" data-world="profile">내 계정 확인하기</button></div>`,'world-game-error');return;}
  if(ticket!==gameLaunch||!worldPanel.open||home.isMaru&&home.openPanel()!=='world-game-loading'||client.snapshot?.accountId!==accountId){session.dispose();return;}
  if(session.status().play.phase==='conflict'){showGameConflict(id,session);return;}
 }
 if(education?.applyPreferences()===false)throw Error('도움 방식 저장을 다시 확인해 주세요.');
 show(game.title,`<iframe class="game-frame" title="${game.title}" src="${worldUrl(game.path)}" allow="autoplay; fullscreen" allowfullscreen></iframe>`,'game');
 const companion=home.mountGameTutor?.(id,{frame:document.querySelector('.game-frame')});
 if(session)activeGameSession=session;
 home.attachPanelResource({dispose:()=>{companion?.dispose();if(session){if(activeGameSession===session)activeGameSession=null;session.closeGame();}queueMicrotask(()=>refreshLife());}});
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
 refresh:async()=>{try{await client.refresh();home.toast('다시 연결됐어요.');}catch(e){home.toast(errorText(e));}},
 logout:async()=>{accountActionPending=true;entryGate?.invalidate();try{await client.logout();sessionConfirmed=false;close();if(home.isMaru)await entryGate.start();else welcome();}catch(e){if(e.code==='STALE_RESPONSE')return;home.toast('이 화면은 로그아웃했어요. 서버 연결을 다시 확인해 주세요.');if(home.isMaru)showEntryRecovery();else welcome();}finally{accountActionPending=false;}},
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
worldPanel.addEventListener('close',()=>{if(!worldPanel.open){gameLaunch++;gameRecovery=null;screen='';hangerSignature='';renderHomeHanger(client.snapshot);enrollmentView?.dispose();enrollmentView=null;townSession?.dispose();townSession=null;delete window.SYNKWorldTownHost;}});
window.__synkWorld={client,screen:()=>screen,wardrobe:()=>wardrobeStudio?.metrics(),life:()=>lifeUI?.metrics()};
home.connectHost?.({profile,wardrobe,play,town,about,photo,songs,launchGame,prepareTutor,selectTutor,tutorStatus,learn:()=>openLife('next'),packs:()=>openLife('packs'),stories:()=>openLife('stories'),review:()=>openLife('review'),cafe:()=>openLife('cafe'),pack:id=>openLife('pack',id),replayOpening:()=>{close();return startOpening(true);}});
entryGate=createWorldEntryGate({
 restore:async()=>{await initialRestoreReady;if(sessionTask)await sessionTask;else if(!sessionConfirmed)await restoreSession();},
 prepare:prepareWorldTutor,
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
if(home.isMaru){const recovery=document.createElement('button');recovery.id='tutor-save-recovery';recovery.className='quiet-button';recovery.dataset.world='life-recovery';recovery.textContent='학습 기록 저장 확인하기';recovery.hidden=true;document.querySelector('#life-progress-caption')?.after(recovery);}
let restored=false;
try{restored=await restoreSession();}catch{if(!home.isMaru)welcome();}finally{finishInitialRestore();}
await openingReady;
if(!home.isMaru&&!restored&&!localStorage.getItem('synk-world-v1-welcomed'))welcome();
renderStatus();
if(new URLSearchParams(location.search).get('tutor')==='choose')home.chooseTutor?.();

// pagehide closes this capability object; a restored document must reverify it.
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
