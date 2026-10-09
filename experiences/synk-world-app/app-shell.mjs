import {WorldClient} from './world-client.mjs';
import {mountEnrollment} from './enrollment.mjs';
import {createWorldAccount,loadWorldConfig} from './world-account.bundle.mjs';
import {createTownWorldHost} from './world-town-client.mjs';
import {createWardrobeStudio} from '../synk-world-home/wardrobe-studio.mjs';
import {WARDROBE_ITEMS} from '../synk-world-home/wardrobe-catalog.mjs';
import {createWorkbenchStorage,thumbnailKey,wardrobeThumbnailCache} from '../synk-world-home/wardrobe-workbench.mjs';
const $=s=>document.querySelector(s);
const home=window.__synkHome;
const connection=await loadWorldConfig();
const operating=connection.mode==='account';
const worldUrl=path=>new URL(connection.basePath+path,location.origin).href;
let client,townSession,enrollmentView;
// Loading and session restoration run behind the company splash. A failed
// optional opening must never disable the existing account or guest entrance.
const openingReady=import(worldUrl('brand-opening/opening.mjs')).then(({mountBrandOpening})=>{
 home.setSceneActive?.(false);
 const opening=mountBrandOpening({reducedMotion:home.state.reduced,onEnter:()=>home.setSceneActive?.(true)});window.__synkOpening=opening;
 return opening.done.finally(()=>home.setSceneActive?.(true));
}).catch(()=>{document.querySelector('.synk-opening')?.remove();document.querySelector('#synk-opening-cover')?.remove();clearTimeout(window.__synkOpeningSafetyTimer);home.setSceneActive?.(true);});
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let screen='',draftRun=null,answers=[],questionIndex=0,lastCompletion=null,wardrobeStudio=null;
const wardrobeRequested=new URLSearchParams(location.search).get('wardrobe')==='1';
const account=operating?createWorldAccount({config:connection.account,onInvalidate:()=>client?.invalidate()}):null;
client=new WorldClient({onChange:renderStatus,account});
const stateLine=document.createElement('div');stateLine.className='world-state';stateLine.setAttribute('role','status');$('.page-heading').after(stateLine);
$('.preview-label').textContent=operating?'MY SYNK WORLD':'연결 개발판';$('.local-note').innerHTML=`<span class="status-dot"></span>${operating?'SYNK ID · 내 세계 연결':'로컬 서버 연결'}`;
$('.hero-footnote').textContent='첫 문장 놀이 · 3개의 짧은 문장';
$('.hero-copy .felt-button').innerHTML='첫 놀이 시작 <span aria-hidden="true">→</span>';
function show(title,html,type='world'){enrollmentView?.dispose();enrollmentView=null;if(screen==='game'&&type!=='game'){townSession?.dispose();townSession=null;delete window.SYNKWorldTownHost;}screen=type;home.showPanel(title,html,{type,eyebrow:'MY SYNK WORLD'});}
function close(){enrollmentView?.dispose();enrollmentView=null;townSession?.dispose();townSession=null;delete window.SYNKWorldTownHost;screen='';home.closePanel();}
function errorText(error){return {NETWORK_UNAVAILABLE:'연결이 잠시 끊겼어요. 선택한 내용은 그대로 두었어요.',REVISION_CONFLICT:'다른 화면에서 차림이 바뀌었어요. 최신 차림을 확인한 뒤 다시 골라주세요.',STALE_RESPONSE:'',AUTH_REQUIRED:'계정 연결이 끝났어요. 다시 연결해 주세요.',RUN_EXPIRED:'놀이 시간이 지나 새로 시작해야 해요.',BUSY:'앞선 요청을 확인하고 있어요.'}[error.code]||'아직 완료하지 못했어요. 잠시 뒤 다시 시도해 주세요.';}

const hanger=document.createElement('section');hanger.className='world-hanger';hanger.setAttribute('aria-label','나의 코디 행거');hanger.hidden=true;
document.querySelector('.hero').after(hanger);let hangerGeneration=0,hangerSignature='';
function renderHomeHanger(snap){
 const signature=JSON.stringify([snap?.accountId,snap?.looks,client.busy,!!client.pending]);
 if(signature===hangerSignature)return;hangerSignature=signature;const token=++hangerGeneration;
 hanger.replaceChildren();hanger.hidden=!snap?.looks?.length;if(hanger.hidden)return;
 const heading=document.createElement('h2');heading.textContent='나의 코디 행거';hanger.append(heading);
 const hint=document.createElement('p');hint.textContent='보관한 차림을 바로 입고, 그대로 놀러 가요.';hanger.append(hint);
 const list=document.createElement('div');list.className='world-hanger-list';hanger.append(list);
 const prefs=createWorkbenchStorage({accountId:snap.accountId}).load(),looks=[...snap.looks.filter(l=>prefs.lookFavorites.includes(l.id)),...snap.looks.filter(l=>!prefs.lookFavorites.includes(l.id))].slice(0,3);
 for(const look of looks){
  const card=document.createElement('article'),image=document.createElement('img'),name=document.createElement('strong'),wear=document.createElement('button');
  image.width=320;image.height=180;image.alt=look.name+' 실제 코디';name.textContent=look.name;wear.textContent='이 코디 입기';wear.className='felt-button';wear.dataset.hangerLook=look.id;wear.disabled=client.busy||!!client.pending;
  const key=thumbnailKey({accountId:snap.accountId,revision:'costume-workbench-v7',slots:look.slots,dyes:look.dyes,view:{}}),cached=wardrobeThumbnailCache.get(key);
  if(cached)image.src=cached;else image.hidden=true;
  card.append(image,name,wear);list.append(card);
  wear.addEventListener('click',async()=>{if(client.busy||client.pending||client.snapshot?.accountId!==snap.accountId)return;try{await client.equip(look.slots,look.dyes||{});home.toast(look.name+' 차림을 입었어요.');}catch(error){home.toast(errorText(error));}});
  if(!cached)queueMicrotask(()=>{if(token!==hangerGeneration||client.snapshot?.accountId!==snap.accountId)return;try{const frame=home.captureLook?.(look.slots,look.dyes||{});if(frame){image.src=frame;image.hidden=false;}}catch{image.alt=look.name+' · 옷장에서 실제 모습을 볼 수 있어요.';}});
 }
}

function renderStatus(){
 const snap=client.snapshot;
 renderHomeHanger(snap);
 if(!snap&&townSession){townSession.dispose();townSession=null;delete window.SYNKWorldTownHost;}
 if(!snap&&['world-play','world-retry','world-reward','world-profile','game'].includes(screen)){draftRun=null;answers=[];lastCompletion=null;close();}
 if(snap){home.setEquipment(snap.avatar?.slots,snap.avatar?.dyes);$('.page-heading h1').textContent=snap.activeRun?'하던 놀이를 이어갈까?':'오늘도, 나답게 놀아봐.';$('.hero-copy .felt-button').innerHTML=`${snap.activeRun?'하던 놀이 이어하기':'첫 문장 놀이'} <span aria-hidden="true">→</span>`;}
 else {home.setEquipment({});$('.page-heading h1').textContent='오늘도, 나답게 놀아봐.';$('.hero-copy .felt-button').innerHTML='첫 놀이 시작 <span aria-hidden="true">→</span>';}
 const status=client.status==='offline'?'연결을 기다리고 있어요. 저장 전 내용은 아직 확정되지 않았어요.':client.status==='conflict'?'다른 화면의 변경을 확인해 주세요.':client.pending?'아직 저장하지 못한 차림이 있어요.':snap?`내 차림과 보유품을 ${operating?'SYNK 계정':'로컬 서버'}에서 불러왔어요.`:'로그인 없이 홈을 둘러볼 수 있어요.';
 stateLine.innerHTML=`<span class="status-dot"></span><span>${status}</span>${client.pending?'<button data-world="pending">저장 확인</button>':client.status==='offline'?'<button data-world="refresh">다시 연결</button>':''}`;
 stateLine.dataset.state=client.status;
 document.querySelectorAll('[data-world-submit]').forEach(el=>{el.disabled=client.busy||client.status==='loading';});
 if(snap&&screen==='world-wardrobe')wardrobeStudio?.update(snap,{busy:client.busy,pending:client.pending,status:client.status});
 if(!snap&&screen==='world-wardrobe'){wardrobeStudio?.dispose();wardrobeStudio=null;signIn();}
}
function welcome(){show('몽글과, 나의 작은 세계',`<div class="welcome-art"><img src="assets/mongle-smile.webp" alt="반갑게 웃는 몽글"><span>HELLO, MY WORLD</span></div><p class="welcome-lead">놀고, 꾸미고, 조금씩 배워요.</p><p class="panel-description">마음에 드는 차림을 입고<br>나만의 속도로 시작해요.</p><div class="world-actions"><button class="felt-button" data-world="sign-in">내 계정으로 시작 <span aria-hidden="true">→</span></button><button class="plain-button" data-world="guest">먼저 둘러보기</button></div><p class="dialog-note">${operating?'SYNK ID로 로그인하면 첫 놀이와 차림, 동네의 내 기록을 같은 계정으로 이어가요.':'이번 개발판에서는 테스트 계정으로 저장과 이어하기를 확인할 수 있어요. 실제 SYNK 계정은 변경되지 않아요.'}</p>`,'world-welcome');}
function signIn(){if(operating){show('내 세계를 이어서','<img class="world-account-mascot" src="assets/mongle.webp" alt="몽글"><p class="panel-description">SYNK ID로 들어오면<br>다른 화면에서도 내 차림과 놀이가 이어져요.</p><div class="world-actions"><button class="felt-button" data-world="account-login" data-world-submit>SYNK ID로 로그인</button><button class="plain-button" data-world="guest">먼저 둘러보기</button></div><p class="dialog-note">학원에 공유하는 기록은 내 계정의 동의 설정을 따라요. 타운 활동 공유는 따로 선택할 수 있어요.</p>','world-signin');return;}show('내 세계를 이어서',`<img class="world-account-mascot" src="assets/mongle.webp" alt="몽글"><p class="panel-description">같은 테스트 계정으로 들어오면<br>다른 화면에서도 보유품과 차림이 이어져요.</p><div class="world-notice"><strong>로컬 연결 리허설</strong><span>실제 Google·Apple 로그인과 별개예요.<br>아래 두 계정에는 시험용 기록만 저장돼요.</span></div><div class="world-actions"><button class="felt-button" data-world="login-a" data-world-submit>나의 테스트 계정으로 시작</button><button class="plain-button" data-world="login-b" data-world-submit>다른 테스트 계정으로 확인</button></div><p class="dialog-note">웹과 Unity 앱은 같은 로컬 서버 계약을 사용해요. 실제 계정 연결은 네이티브 인증 설정 후 검증해요.</p>`,'world-signin');}
async function login(account){try{await client.signIn(account);try{localStorage.setItem('synk-world-v1-welcomed','1');}catch{}close();home.toast('내 홈과 차림을 불러왔어요.');if(wardrobeRequested)wardrobe();}catch(e){home.toast(errorText(e));}}
function about(){if(operating){show('함께 만들어 가는 SYNK WORLD','<div class="review-note"><p>첫 문장 놀이를 마치고, 받은 목도리와 앞치마로 내 차림을 꾸며요. 내 차림과 놀이, 타운의 개인 기록은 같은 SYNK ID로 이어가요.</p><p>학습 기록과 학원에 보여 줄 타운 활동은 각각의 공유 동의를 따라요. 실제 응답 기록은 연습 근거이며 TOPIK 급수나 학습 효과를 판정한 점수는 아니에요.</p></div>','world-about');return;}show('함께 만들어 가는 SYNK WORLD','<div class="review-note"><p><strong>지금 연결된 경험</strong><br>테스트 계정으로 첫 문장 놀이를 마치고, 받은 목도리와 앞치마를 함께 입을 수 있어요. 같은 계정의 다른 화면에서도 차림을 불러오고, 지금의 차림을 실제 3D 사진으로 저장해요.</p><p><strong>이어 만들고 있어요</strong><br>실제 SYNK 로그인, 설치형 앱 실행과 휴대폰 성능은 별도로 검증해야 해요. 기존 미니게임과 노래는 계속 둘러볼 수 있어요.</p><p>이 개발판은 이 PC의 로컬 서버와 합성 계정만 사용해요. 운영 계정이나 공개 앱은 변경하지 않아요.</p></div>','world-about');}
async function photo(){
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
async function town(){if(operating){if(!client.snapshot)return signIn();try{const entry=await client.request('town/entry');if(!entry.allowed){show('동네를 열 준비','<p class="panel-description">TOPIK 1급 이상 입장 확인과<br>타운 이용권이 필요해요.</p><p class="dialog-note">내 계정의 입장 권한을 확인한 뒤 다시 열어 주세요.</p><div class="world-actions"><button class="plain-button" data-world="profile">내 계정 확인</button></div>','world-town');return;}const state=await client.request('town/state'),binding=state.binding,sharing=binding?.sharing;show('우리 동네, 가까이 만나봐요',`<img class="town-preview" src="assets/town.webp" alt="싱크타운 광장"><p class="panel-description">내 차림 그대로 동네를 걸어보고,<br>몽글을 가까이서 만나봐요.</p><div class="world-notice"><strong>내 타운 기록 · SYNK ID에 보관</strong><span>개인 기록은 내 계정으로 이어져요.${binding?.kind==='academy'?' 학원에 보여 줄 활동은 아래에서 따로 골라요.':' 학원 활동 공유는 소속 반이 연결되면 선택할 수 있어요.'}</span></div>${binding?.classId?`<label class="world-notice"><span><input type="checkbox" data-town-sharing data-revision="${Number(sharing?.revision)||0}" ${sharing?.enabled?'checked':''} ${sharing?.blockedByLearningSharing?'disabled':''}> 타운 활동을 학원에 공유하기</span><span>${sharing?.blockedByLearningSharing?'학습 공유를 켠 뒤 타운 공유를 선택할 수 있어요.':'선택한 뒤 새로 한 타운 활동만 공유해요. 꺼도 내 개인 기록은 보관돼요.'}</span></label>`:''}<div class="world-actions"><button class="felt-button" data-world="town-preview">내 차림으로 동네 열기 <span aria-hidden="true">→</span></button></div>`,'world-town');}catch(error){home.toast(errorText(error));}return;}show('우리 동네, 가까이 만나봐요',`<img class="town-preview" src="assets/town.webp" alt="싱크타운 광장 콘셉트"><p class="panel-description">내 차림 그대로 동네를 걸어보고,<br>몽글을 가까이서 만나봐요.</p><div class="world-notice"><strong>타운 연결 미리보기</strong><span>시험 계정의 차림 연결을 확인하는 개발 체험이에요. 실제 타운의 TOPIK 1급+ 조건·이용권·입장 권한을 부여하지 않아요.</span></div><div class="world-actions"><button class="felt-button" data-world="town-preview">${client.snapshot?'내 차림으로 미리보기':'시험 계정으로 연결하기'} <span aria-hidden="true">→</span></button><button class="plain-button" data-action="hangul">한글부터 배우기</button></div>`,'world-town');}
function townPreview(){if(!client.snapshot)return signIn();townSession?.dispose();townSession=operating?createTownWorldHost(client):null;if(townSession)window.SYNKWorldTownHost=townSession;show(operating?'나의 싱크타운':'싱크타운 연결 미리보기',`<iframe class="game-frame" title="내 차림으로 걷는 싱크타운" src="${worldUrl('town/day.html')}?play=walk" allow="autoplay; fullscreen" allowfullscreen></iframe>`,'game');}
function profile(){if(!client.snapshot)return signIn();show('내 세계와 기록',`<div class="profile-view"><img src="assets/mongle-smile.webp" alt=""><h3>반가워요!</h3><p>차림과 첫 놀이의 선물이<br>${operating?'내 SYNK ID':'이 테스트 계정'}에 보관돼요.</p></div><div class="world-notice"><strong>서버 저장 ${client.pending?'대기 중':'연결됨'}</strong><span>현재 차림 판본 ${client.snapshot.revision} · ${operating?'SYNK 계정 연결':'로컬 테스트 계정'}</span></div>${operating?`<section class="world-notice"><strong>내 학습 기록 연결</strong>${account.preferences()?`<label><input type="checkbox" data-world-learning data-revision="${account.preferences().revision}" ${account.preferences().enabled?'checked':''}> 학습 기록을 내 SYNK 계정으로 이어가기</label><span>직접 켠 뒤 새로 한 첫 놀이의 언어 응답을 계정에 저장해요. 학원에 보여 줄 학습과 타운 활동은 내 수업에서 따로 선택해요.</span>`:'<span>학습 연결 설정은 내 수업의 계정 화면에서 확인할 수 있어요.</span>'}<a class="felt-button" href="https://synk.im/account/client.html?product=world">내 수업 · 과제와 공유 설정 <span aria-hidden="true">→</span></a></section>`:''}<div id="world-classroom-entry"></div><div class="world-actions"><button class="felt-button" data-world="wardrobe">내 옷장 열기</button><button class="plain-button" data-world="logout">이 화면에서 로그아웃</button></div>`,'world-profile');if(operating){const generation=client.generation,owner=client.snapshot.accountId;enrollmentView=mountEnrollment({container:$('#world-classroom-entry'),request:account.enrollmentRequest,guard:()=>{account.assertActive();if(generation!==client.generation||client.snapshot?.accountId!==owner)throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});},onLinked:async()=>{townSession?.dispose();townSession=null;delete window.SYNKWorldTownHost;await account.restore();profile();}});}}
function wardrobe(){
 if(!client.snapshot)return signIn();
 show('나를 닮은 차림.','','world-wardrobe');
 wardrobeStudio=createWardrobeStudio({snapshot:client.snapshot,reducedMotion:home.state.reduced,
  onEquip:(slots,dyes)=>client.equip(slots,dyes),onSaveLooks:looks=>client.saveLooks(looks),
  onRefresh:()=>client.refresh(),onRetry:()=>client.sendPending(),onDiscard:()=>client.discardPending(),onPlay:play,
 });
 $('#panel-content').append(wardrobeStudio.element);home.attachPanelResource(wardrobeStudio);
 const openedStudio=wardrobeStudio;
 openedStudio.update(client.snapshot,{busy:true,pending:client.pending,status:client.status});
 // Read the current account when opening, before a new selection is confirmed.
 // A later change while the fitting room is already open still uses revision checks.
 void client.refresh().catch(error=>home.toast(errorText(error))).finally(()=>{
  if(screen==='world-wardrobe'&&wardrobeStudio===openedStudio&&client.snapshot)openedStudio.update(client.snapshot,{busy:client.busy,pending:client.pending,status:client.status});
 });
}
function pending(){show('아직 저장 전이에요',`<p class="panel-description">선택한 차림을 보내는 중에 연결이 끊겼거나 다른 화면에서 차림이 바뀌었어요. 지금 홈에는 마지막으로 확인된 차림이 보여요.</p><div class="world-actions"><button class="felt-button" data-world="retry-pending" data-world-submit>같은 요청 다시 보내기</button><button class="plain-button" data-world="discard-pending">최신 차림을 불러와 다시 고르기</button></div>`,'world-pending');}
function readDraft(run){try{const draft=JSON.parse(localStorage.getItem(`synk-world-v1-run:${client.snapshot.accountId}`)||'null');return draft?.runId===run.runId?draft:null;}catch{return null;}}
function saveDraft(){if(!draftRun||!client.snapshot)return;try{localStorage.setItem(`synk-world-v1-run:${client.snapshot.accountId}`,JSON.stringify({runId:draftRun.runId,answers,requestId:draftRun.requestId}));}catch{}}
async function play(){
 if(!client.snapshot)return signIn();
 try{let run=client.snapshot.activeRun;if(!run){const result=await client.start();run=result.run||result.activeRun;}if(!run)throw Error('NO_RUN');const previous=readDraft(run);draftRun={...run,requestId:previous?.requestId||crypto.randomUUID()};answers=previous?.answers||[];questionIndex=Math.min(answers.length,run.questions.length-1);showQuestion();}
 catch(e){home.toast(errorText(e));}
}
function showQuestion(){
 const q=draftRun.questions[questionIndex],choice=answers.find(a=>a.questionId===q.questionId)?.optionId;
 show('작은 문장, 첫걸음',`<div class="world-game-top"><span>초급 읽기</span><span>${questionIndex+1} / ${draftRun.questions.length}</span></div><div class="world-progress" aria-hidden="true"><i style="width:${(questionIndex+1)/draftRun.questions.length*100}%"></i></div><p class="world-prompt">${escape(q.prompt)}</p><div class="world-answers" role="group" aria-label="답 고르기">${q.options.map((o,i)=>`<button class="world-answer ${choice===o.optionId?'selected':''}" data-world="answer" data-option="${escape(o.optionId)}" aria-pressed="${choice===o.optionId}"><span>${i+1}</span>${escape(o.text)}</button>`).join('')}</div><p class="dialog-note">${questionIndex===0?'짧은 문장을 읽고 어울리는 답을 골라요.':'틀려도 괜찮아요. 마지막에 함께 확인해요.'}</p><div class="world-actions"><button class="felt-button" data-world="next" ${choice?'data-world-submit':'disabled'}>${questionIndex===draftRun.questions.length-1?'놀이 마치기':'다음 문장'} <span aria-hidden="true">→</span></button><button class="plain-button" data-world="pause">홈에서 잠깐 쉬기</button></div>`,'world-play');
}
async function finish(){
 saveDraft();try{const result=await client.complete(draftRun.runId,answers,draftRun.requestId);lastCompletion=result.completion;try{localStorage.removeItem(`synk-world-v1-run:${client.snapshot.accountId}`);}catch{}showReward();}
 catch(e){if(e.code==='STALE_RESPONSE')return;show('결과를 확인하고 있어요',`<p class="panel-description">${escape(errorText(e))}<br>같은 결과로 다시 보내도 선물은 한 번만 지급돼요.</p><div class="world-actions"><button class="felt-button" data-world="finish" data-world-submit>결과 다시 보내기</button><button class="plain-button" data-world="pause">홈으로 돌아가기</button></div>`,'world-retry');}
}
function showReward(){const done=lastCompletion;show(done?.rewardGranted?'나의 첫 선물이 도착했어요':'오늘의 작은 놀이를 마쳤어요',`<div class="world-reward-art"><img src="assets/scarf.webp" alt="포근한 목도리"></div><p class="welcome-lead">${done?.rewardGranted?'첫 산책 목도리':'잘했어요, 한 걸음 더.'}</p><p class="panel-description">${done?.rewardGranted?'첫 놀이를 마친 선물을 옷장에 보관했어요.':'이미 받은 목도리는 옷장에서 다시 입을 수 있어요.'}<br>정답 수와 관계없이 참여한 첫걸음을 기억해요.</p><details class="world-review"><summary>함께 답 확인하기</summary>${(done?.answers||[]).map((a,i)=>`<p><strong>${i+1}. ${escape(draftRun.questions[i]?.prompt)}</strong><br>알맞은 답: ${escape(draftRun.questions[i]?.options.find(o=>o.optionId===a.correctOptionId)?.text)} ${a.correct?'✓':''}</p>`).join('')}</details><div class="world-actions"><button class="felt-button" data-world="wear-reward" data-world-submit>지금 목도리 입기</button><button class="plain-button" data-world="home">홈으로 돌아가기</button></div>`,'world-reward');}
const commands={
 'sign-in':signIn,'account-login':()=>client.signIn(),'guest':()=>{try{localStorage.setItem('synk-world-v1-welcomed','1');}catch{}close();},'login-a':()=>login('player-a'),'login-b':()=>login('player-b'),profile,wardrobe,pending,play,finish,home:close,'town-preview':townPreview,
 pause:()=>{saveDraft();close();home.toast('홈에서 쉬었다가 이어서 할 수 있어요.');},
 answer:button=>{const q=draftRun.questions[questionIndex];answers=answers.filter(a=>a.questionId!==q.questionId);answers.push({questionId:q.questionId,optionId:button.dataset.option});saveDraft();showQuestion();},
 next:()=>{if(questionIndex<draftRun.questions.length-1){questionIndex++;showQuestion();}else finish();},
 equip:async button=>{try{const slots={...client.snapshot.avatar.slots};slots[button.dataset.slot]=slots[button.dataset.slot]===button.dataset.item?'':button.dataset.item;await client.equip(slots);wardrobe();home.toast('차림을 서버에 저장했어요.');}catch(e){home.toast(errorText(e));if(client.pending)pending();}},
 'wear-reward':async()=>{try{await client.equip({...client.snapshot.avatar.slots,neck:'mongle-scarf-first-steps'});close();home.toast('포근한 첫 산책 목도리, 잘 어울려요.');}catch(e){home.toast(errorText(e));if(client.pending)pending();}},
 'retry-pending':async()=>{try{await client.sendPending();wardrobe();}catch(e){home.toast(errorText(e));}},
 'discard-pending':async()=>{try{await client.discardPending();wardrobe();}catch(e){home.toast(errorText(e));}},
 refresh:async()=>{try{await client.refresh();home.toast('다시 연결됐어요.');}catch(e){home.toast(errorText(e));}},
 logout:async()=>{try{await client.logout();welcome();}catch(e){if(e.code==='STALE_RESPONSE')return;home.toast('이 화면은 로그아웃됐어요. 서버 연결을 다시 확인해 주세요.');welcome();}},
};
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(operating&&['runner','rhythm'].includes(button.dataset.launch)){
  event.preventDefault();event.stopImmediatePropagation();
  const url=new URL('https://synk.im/account/client.html');url.search=new URLSearchParams({product:'world',play:button.dataset.launch==='runner'?'korean-runner':'korean-rhythm'});
  location.assign(url.href);return;
 }
 if(operating&&button.dataset.action==='hangul'){
  event.preventDefault();event.stopImmediatePropagation();
  show('한글 영상·기초 체험',`<p class="dialog-note">한글 영상과 기본 글자를 익히는 체험이에요. 수업 기록으로 이어가는 연습은 내 수업에서 선택해요.</p><a class="plain-button" href="https://synk.im/account/client.html?product=world">내 수업의 연습 열기</a><iframe class="game-frame" title="한글 영상·기초 체험" src="${worldUrl('hangul-stage/')}" allow="autoplay; fullscreen" allowfullscreen></iframe>`,'game');return;
 }
 if(button.dataset.world){event.preventDefault();event.stopImmediatePropagation();Promise.resolve(commands[button.dataset.world]?.(button)).catch(e=>home.toast(errorText(e)));return;}
 const action=button.dataset.action,nav=button.dataset.nav;
 if(['quickplay','profile','wardrobe','about','photo','town'].includes(action)||['wardrobe','town'].includes(nav)){
  event.preventDefault();event.stopImmediatePropagation();(action==='quickplay'?play:action==='profile'?profile:action==='about'?about:action==='photo'?photo:action==='town'||nav==='town'?town:wardrobe)();
 }
},true);
document.addEventListener('change',event=>{const control=event.target;if(control.matches?.('[data-world-learning]')){control.disabled=true;const enabled=control.checked;void account.setLearning(enabled,Number(control.dataset.revision)).then(()=>{if(screen==='world-profile')profile();}).catch(error=>{control.checked=!enabled;home.toast(errorText(error));}).finally(()=>{control.disabled=false;});return;}if(!control.matches?.('[data-town-sharing]'))return;control.disabled=true;const enabled=control.checked,revision=Number(control.dataset.revision);void client.request('town/sharing',{method:'POST',body:{enabled,revision}}).then(()=>town()).catch(error=>{control.checked=!enabled;home.toast(errorText(error));}).finally(()=>{control.disabled=false;});});
window.addEventListener('pagehide',()=>{townSession?.dispose();delete window.SYNKWorldTownHost;account?.stop();});
window.addEventListener('online',()=>{if(client.snapshot)client.refresh().catch(()=>{});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&client.snapshot&&!client.busy)client.refresh().catch(()=>{});});
// A queued close event from sign-in must not clear a newly opened fitting room.
$('#panel').addEventListener('close',()=>{if(!$('#panel').open){screen='';hangerSignature='';renderHomeHanger(client.snapshot);enrollmentView?.dispose();enrollmentView=null;townSession?.dispose();townSession=null;delete window.SYNKWorldTownHost;}});
window.__synkWorld={client,screen:()=>screen,wardrobe:()=>wardrobeStudio?.metrics()};
try{const restored=await client.restore();await openingReady;if(!restored&&!localStorage.getItem('synk-world-v1-welcomed'))welcome();}catch{await openingReady;welcome();}
renderStatus();
if(wardrobeRequested){if(client.snapshot)wardrobe();else signIn();}

// pagehide closes this capability object; a restored document must reverify it.
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
