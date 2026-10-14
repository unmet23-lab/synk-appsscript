import {createTutorOnboarding} from './tutor-onboarding.mjs';
import {createGameTutor} from './game-tutor.mjs';
import {createLifeTutor} from './life-tutor.mjs';
import {createHomeTutor} from './home-tutor.mjs';
import {createHomeScene} from './home-scene.mjs';
import {createHomeMemory} from './home-memory.mjs';
import {createWardrobeAlbum} from '../synk-world-home/wardrobe-album.mjs';
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const asset=path=>new URL(path,import.meta.url).href;
for(const [key,file] of Object.entries({'paper-button':'button-white-ui.webp','coral-button':'button-coral-ui.webp','cream':'quality-cream-ui.webp','blush':'quality-blush-ui.webp'}))document.documentElement.style.setProperty('--life-'+key,`url("${asset('assets/home/'+file)}")`);
for(const [key,file] of Object.entries({'drinks':'cafe-drinks-v2.png','room':'cafe-room-v1.webp'}))document.documentElement.style.setProperty('--cafe-'+key,`url("${asset('assets/home/'+file)}")`);
const panel=$('#world-panel'),content=$('#panel-content'),scene=$('.maru-scene');
const landscape=matchMedia('(orientation:landscape)'),spacious=matchMedia('(min-width:600px) and (min-height:600px) and (pointer:fine)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
const games={
 runner:{title:'바람길',detail:'들은 대로 몸이 먼저 움직이는 90초',label:'LISTEN & RUN',path:'../korean-runner/',image:'world-felt/runner.webp',area:'짧은 지시의 방향·동작·부정·순서 듣기 연습'},
 hangul:{title:'한글 만나기',detail:'소리를 듣고 글자를 골라요',label:'HANGUL',path:'../hangul-stage/',image:'world-felt/hangul.webp',area:'한글 자모와 음절의 소리·글자 연결 연습'},
 rhythm:{title:'말의 리듬',detail:'노래를 타며 듣고 O·X로 답해요',label:'RHYTHM',path:'../korean-rhythm/',image:'world-felt/rhythm.webp',area:'짧은 발화를 듣고 내용 일치 판단 연습'}
};
let lastFocus=null,panelKind='',inView=true,manualReduced=false,frameTimer,displayPreference='auto',layout='portrait';
let learningUI=null,learningLoader=null,education=null;
let host=null,panelResource=null,sceneActive=false,entryPhase='restoring',toastTimer,equipment={slots:{},dyes:{}},accountOwner='guest',learningData={},photoBusy=false,panelEpoch=0;
let orientationTask=Promise.resolve();
let tutorUI,homeTutor;
const living=createHomeScene({container:scene,onAction:sceneAction,onStatus:status=>{scene.dataset.status=status;}});
const memory=createHomeMemory({onChange:data=>living.setMemory(data)});
try{manualReduced=localStorage.getItem('synk.world.maru.reduced')==='true';}catch{}
try{const saved=localStorage.getItem('synk.world.maru.orientation');if(['auto','portrait','landscape'].includes(saved))displayPreference=saved;}catch{}
function syncLayout(){
 const actual=landscape.matches?'landscape':'portrait';
 const next=spacious.matches&&displayPreference!=='auto'?displayPreference:actual;
 layout=next;document.documentElement.dataset.layout=layout;
 document.documentElement.dataset.orientationPreference=displayPreference;
 const mismatch=!spacious.matches&&displayPreference!=='auto'&&displayPreference!==actual;
 $('.orientation-notice').hidden=!mismatch;
 $('#orientation-message').textContent=displayPreference==='landscape'?'휴대폰을 가로로 돌려주세요':'휴대폰을 세로로 돌려주세요';
 const status=$('#orientation-status');if(status)status.textContent=mismatch?`${displayPreference==='landscape'?'가로':'세로'}로 선택했어요. 휴대폰을 돌리면 그 방향으로 이어집니다.`:spacious.matches?'선택한 화면 비율로 볼 수 있어요.':'자동은 기기를 따라가요. 세로·가로는 원하는 방향으로 돌려 이용해 주세요.';
 syncScene();
}
function chooseOrientation(value){
 if(!['auto','portrait','landscape'].includes(value))return;
 displayPreference=value;try{localStorage.setItem('synk.world.maru.orientation',value);}catch{}
 content.querySelectorAll('[name="orientation"]').forEach(input=>{input.checked=input.value===value;});
 syncLayout();
 // A saved preference is not proof of an OS lock. Unsupported browsers keep
 // their current usable layout and show the rotation hint instead.
 orientationTask=orientationTask.catch(()=>{}).then(async()=>{
  try{if(displayPreference==='auto'||spacious.matches)screen.orientation?.unlock?.();else if(screen.orientation?.lock)await screen.orientation.lock(displayPreference);}catch{}
  syncLayout();
 });
}
function syncScene(){
 const active=entryPhase==='ready'&&sceneActive&&!document.hidden&&!panel.open&&inView;
 homeTutor?.setActive(active);living.setReducedMotion(reduced.matches||manualReduced);living.setActive(active);
}
// Kept for the opening host contract; the 3D room does not inherit a movie time.
function setSceneTime(){}
function setEntryState({phase='restoring',message=''}={}){
 entryPhase=phase;$('.world-shell').dataset.entry=phase;
 const ready=phase==='ready';$('.home-entry-status').hidden=ready;
 $('.home-entry-status p').textContent=message||(phase==='choosing'?'함께할 친구를 골라 주세요.':phase==='error'?'연결을 다시 확인해 주세요.':'나의 세계를 연결하고 있어요.');
 $('.world-topbar').inert=!ready;$('.world-nav').inert=!ready;$('.lobby-action').inert=!ready;
 living.setTutor(tutorUI?.choice()?.id||null);syncScene();
}
new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;syncScene();},{threshold:.05}).observe(scene);
landscape.addEventListener('change',syncLayout);spacious.addEventListener('change',syncLayout);reduced.addEventListener('change',syncScene);document.addEventListener('visibilitychange',syncLayout);document.addEventListener('fullscreenchange',syncLayout);
function setNav(name){$$('.world-nav button').forEach(button=>{if(button.dataset.view===name)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});}
function disposePanelContent(){
 clearTimeout(frameTimer);
 const resource=panelResource;panelResource=null;
 try{resource?.dispose?.();}catch(error){console.warn('Panel cleanup failed',error);}
 content.querySelectorAll('video,audio').forEach(media=>media.pause());
 content.querySelectorAll('iframe').forEach(frame=>{frame.src='about:blank';frame.remove();});
 content.replaceChildren();
}
function closePanel(){
 panelEpoch++;
 const focus=lastFocus;lastFocus=null;
 disposePanelContent();if(panel.open)panel.close();panel.className='world-panel';panelKind='';setNav('home');syncScene();
 void memory.refresh();
 queueMicrotask(()=>education?.refresh());
 if(focus?.isConnected&&focus!==document.body&&!focus.closest('#world-panel'))focus.focus({preventScroll:true});
 else $('#life-next-button').focus({preventScroll:true});
}
function openPanel(title,html,{type='',eyebrow='SYNK WORLD',nav='home'}={}){
 panelEpoch++;
 if(!panel.open)lastFocus=document.activeElement;disposePanelContent();
 panelKind=type;panel.className='world-panel panel-dialog';
 if(type==='game')panel.classList.add('game-panel');
 else if(type==='wardrobe'||type==='world-wardrobe')panel.classList.add('wardrobe-dialog');
 else if(/^[a-z][a-z0-9-]*$/i.test(type))panel.classList.add(`${type}-panel`);
 const activeNav=/^life-/.test(type)?'packs':nav!=='home'?nav:/wardrobe/.test(type)?'wardrobe':/profile/.test(type)?'me':'home';
 $('#panel-title').textContent=title;$('#panel-eyebrow').textContent=eyebrow;content.innerHTML=html;setNav(activeNav);if(!panel.open)panel.showModal();panel.scrollTop=0;syncScene();$('#panel-close').focus({preventScroll:true});
}
function callHost(command,...args){
 if(!host)return false;
 const callback=host[command];
 if(typeof callback!=='function'){toast('아직 연결을 준비하고 있어요. 잠시 뒤 다시 열어 주세요.');return true;}
 Promise.resolve().then(()=>callback(...args)).catch(()=>toast('화면을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.'));
 return true;
}
function openGame(id){
 if(games[id])void openTutor({then:()=>launchGame(id)});
}
async function openTutor({then=null,force=false}={}){
 try{if(host?.prepareTutor&&await host.prepareTutor()===false)return;tutorUI.open({then,force});}
 catch(error){toast(error.message||'튜터 연결을 다시 확인해 주세요.');}
}
function launchGame(id){
 const game=games[id];if(!game)return;
 if(callHost('launchGame',id))return;
 const path=asset(game.path);
 openPanel(game.title,`<div class="frame-loader" role="status"><p>놀이를 준비하고 있어요.</p><a href="${path}">새 화면으로 열기</a></div><iframe class="game-frame" title="${game.title}" src="${path}" allow="autoplay; fullscreen" allowfullscreen></iframe>`,{type:'game',nav:'play'});
 const frame=content.querySelector('iframe');frame.addEventListener('load',()=>{if(!frame.isConnected)return;clearTimeout(frameTimer);content.querySelector('.frame-loader')?.remove();},{once:true});
 const companion=home.mountGameTutor(id,{frame});if(companion)home.attachPanelResource(companion);
 frameTimer=setTimeout(()=>{const label=content.querySelector('.frame-loader p');if(label)label.textContent='연결이 조금 늦어지고 있어요. 새 화면으로도 열 수 있어요.';},8000);
}
async function callLearning(command){
 if(command==='initialize')return callLearningReady(command);
 return openTutor({then:()=>callLearningReady(command)});
}
async function callLearningReady(command){
 if(command==='learn'&&education)return education.next();
 if(command==='study'&&education)return education.open();
 if(host){callHost(command==='learn'?'learn':command);return;}
 if(!learningLoader)learningLoader=import('./content/life-standalone.mjs').then(({setupLife})=>{learningUI=setupLife(home,path=>asset('assets/'+path));return learningUI;}).catch(error=>{learningLoader=null;toast('생활 콘텐츠를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.');throw error;});
 try{const ui=await learningLoader;ui[command==='learn'?'next':command]?.();}catch{}
}
function updateLearning(summary,details){
 homeTutor?.update(summary,details);
 learningData={summary,snapshot:details?.snapshot,lessons:details?.lessons,details};
 void memory.update({owner:accountOwner,...learningData});
 const next=summary.nextLesson,button=$('#life-next-button'),label=$('#life-next-title'),kicker=$('#life-next-kicker'),caption=$('#life-progress-caption'),review=$('#life-review-count');
 if(!button)return;
 button.disabled=summary.status?.phase==='loading';
 label.textContent=summary.status?.phase==='loading'?'내 진도를 연결하고 있어요':next?next.title:summary.dueCount?'오늘 돌아온 표현':'생활 팩 다시 만나기';
 kicker.textContent=summary.resume?'하던 자리에서 이어서':summary.cafe?.nextNumber?`${summary.cafe.nextNumber}번째 카페 방문 · 다음 이야기`:next?`${summary.packs?.length||6}개 생활 팩 · 다음 한 걸음`:'오늘도 친구들과 함께';
 caption.textContent=`${summary.completed||0} / ${summary.total||22} 학습 완료 · ${summary.status?.scoped?'계정별 진도':'이 기기의 진도'}`;
 review.textContent=summary.dueCount?`${summary.dueCount}개`:'일정';
 button.setAttribute('aria-label',`${summary.resume?'이어서 하기':'다음 학습'} · ${label.textContent}`);
}
function updateStudy(plan){
 const next=plan?.selected,reason=$('#study-reason');
 $('#life-next-button').dataset.view=plan&&!next?'study':'learn';
 if(reason)reason.textContent=plan?.reason||'';
 if(learningData.summary)homeTutor?.update({...learningData.summary,education:plan},learningData.details);
 if(!next){
  if(plan){$('#life-next-title').textContent='지금 가능한 연습 찾기';$('#life-next-kicker').textContent='학습 시간과 소리를 확인해요';$('#life-next-button').setAttribute('aria-label','학습 조건 확인');}
  return;
 }
 $('#life-next-title').textContent=next.label||next.title||'나의 다음 연습';
 $('#life-next-kicker').textContent=plan.resume?'하던 자리에서 이어서':next.route==='review'?'돌아온 표현 · 나의 복습':'지금 나에게 맞는 한 걸음';
 $('#life-next-button').setAttribute('aria-label',`맞춤 학습 · ${next.label||next.title}`);
}
function showPlay(){
 const more=host?`<section class="play-more" aria-label="더 둘러보기"><p class="eyebrow">MORE</p><button data-world="play"><img src="${asset('assets/world-felt/sentence.webp')}" alt=""><span><strong>첫 문장 놀이</strong><small>세 문장으로 시작하는 첫 선물</small></span></button><button data-world="town"><img src="${asset('assets/world-felt/town.webp')}" alt=""><span><strong>우리 동네</strong><small>친구들이 사는 마을 걷기</small></span></button><button data-world="songs"><img src="${asset('assets/world-felt/songs.webp')}" alt=""><span><strong>노래 듣기</strong><small>한글 노래와 뮤직비디오</small></span></button></section>`:'';
 openPanel('어떤 놀이가 좋을까?',`<div class="play-list">${Object.entries(games).map(([id,g],i)=>`<button data-game="${id}"><span class="play-art w-print"><img src="${asset(`assets/${g.image}`)}" alt=""></span><span class="play-copy"><small class="play-label">${String(i+1).padStart(2,'0')} · ${g.label}</small><strong>${g.title}</strong><small>${g.detail}</small></span><span class="arrow" aria-hidden="true">↗</span></button>`).join('')}</div><p class="panel-note">한글이 처음이라면 ‘한글 만나기’부터 천천히 시작해요.</p>${more}`,{eyebrow:'PLAY',nav:'play'});
}
function showWardrobe(){if(callHost('wardrobe'))return;openPanel('오늘의 몽글은 어떤 모습?',`<img class="panel-art" src="${asset('assets/home/scarf.webp')}" alt="음표 장식이 달린 포근한 펠트 목도리"><p class="panel-description">작은 목도리 하나로 달라지는 기분.<br>입혀 보고, 나만의 차림을 찾아보세요.</p><div class="panel-actions"><a class="felt-button" href="${asset('../mobile.html?wardrobe=1&opening=off')}">나의 옷장 열기 <span aria-hidden="true">↗</span></a></div><p class="panel-note">옷장에서는 기존 계정 연결과 보유품 확인을 이어갑니다. 사진은 차림 예시예요.</p>`,{eyebrow:'MY WARDROBE',nav:'wardrobe'});}
function showMe(){if(callHost('profile'))return;openPanel('나만의 속도로, 차근차근.',`<img class="panel-art" src="${asset('assets/home/mongle-smile.webp')}" alt="눈웃음 짓는 펠트 몽글"><p class="panel-description">지금은 자유롭게 둘러보고 있어요.<br>나의 차림과 놀이 기록은 계정을 연결한 공간에서 확인할 수 있어요.</p><div class="panel-actions"><a class="felt-button" href="${asset('../mobile.html?opening=off')}">나의 공간 연결하기 <span aria-hidden="true">↗</span></a><button class="quiet-button" data-close>지금은 조금 더 둘러볼게요</button></div>`,{eyebrow:'YOUR LITTLE WORLD',nav:'me'});}
function showSettings(){openPanel('편안하게 머물러요.',`<fieldset class="orientation-settings"><legend>화면 방향</legend><div class="orientation-options">${[['auto','자동'],['portrait','세로'],['landscape','가로']].map(([value,label])=>`<label><input type="radio" name="orientation" value="${value}" ${displayPreference===value?'checked':''}><span>${label}</span></label>`).join('')}</div><p id="orientation-status" class="orientation-help" role="status"></p></fieldset><label class="settings-row"><span><strong>친구들의 움직임 줄이기</strong><small>친구들의 숨쉬기와 인사 동작을 줄여요.</small></span><input id="reduce-motion" type="checkbox" ${manualReduced||reduced.matches?'checked':''} ${reduced.matches?'disabled':''}></label>${reduced.matches?'<p class="panel-note">기기의 움직임 감소 설정을 따르고 있어요.</p>':''}<div class="panel-actions">${host?'<button class="felt-button" data-replay-opening>오프닝 다시 보기 <span aria-hidden="true">↗</span></button>':`<a class="felt-button" href="${asset('index.html')}">오프닝 다시 보기 <span aria-hidden="true">↗</span></a>`}${host?'<button class="quiet-button" data-home-host="about">SYNK WORLD 소개</button>':''}</div>`,{eyebrow:'SETTINGS',type:'settings'});syncLayout();}
function showTutorSettings(){
 showSettings();
 const button=document.createElement('button');button.className='felt-button';
 button.textContent=tutorUI.choice()?`나의 AI 튜터 · ${tutorUI.choice().name}`:'함께할 AI 튜터 고르기';
 button.dataset.tutorOpen='';button.addEventListener('click',()=>home.chooseTutor());
 content.querySelector('.panel-actions').prepend(button);
 if(education){const study=document.createElement('button');study.className='plain-button';study.textContent='학습 목표와 도움 방식';study.addEventListener('click',()=>education.open());content.querySelector('.panel-actions').prepend(study);}
}
document.addEventListener('click',event=>{
 if(event.defaultPrevented)return;
 const button=event.target.closest('[data-view],[data-game],[data-close],[data-world],[data-replay-opening],[data-home-host]');if(!button)return;
 if(button.dataset.game){event.preventDefault();openGame(button.dataset.game);return;}
 if(button.hasAttribute('data-replay-opening')){closePanel();callHost('replayOpening');return;}
 if(button.dataset.homeHost){callHost(button.dataset.homeHost);return;}
 if(button.dataset.world){if(['play','town','songs'].includes(button.dataset.world))callHost(button.dataset.world,button);return;}
 if(button.hasAttribute('data-close')){closePanel();return;}
 const view=button.dataset.view;if(['learn','packs','review','stories','cafe','study'].includes(view)){void callLearning(view);return;}if(view==='play')showPlay();else if(view==='wardrobe')showWardrobe();else if(view==='me')showMe();else{if(panel.open)closePanel();window.scrollTo({top:0,behavior:manualReduced||reduced.matches?'instant':'smooth'});}
});
content.addEventListener('change',event=>{if(event.target.name==='orientation')chooseOrientation(event.target.value);if(event.target.id==='reduce-motion'){manualReduced=event.target.checked;try{localStorage.setItem('synk.world.maru.reduced',String(manualReduced));}catch{}syncScene();}});
document.querySelector('[data-orientation-auto]').addEventListener('click',()=>chooseOrientation('auto'));
$('#panel-close').addEventListener('click',closePanel);panel.addEventListener('cancel',event=>{event.preventDefault();closePanel();});panel.addEventListener('click',event=>{if(event.target===panel){const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closePanel();}});
panel.addEventListener('close',()=>{if(!panel.open&&(content.childElementCount||panelResource))closePanel();});
panel.addEventListener('close',()=>queueMicrotask(()=>{
 if(window.__SYNK_WORLD_CONNECTED__||panel.open||entryPhase!=='choosing'||tutorUI?.metrics().active)return;
 if(tutorUI?.choice()){sceneActive=true;setEntryState({phase:'ready'});}else location.assign(asset('index.html'));
}));
$('#settings-open').addEventListener('click',showTutorSettings);window.addEventListener('pagehide',event=>{living.setActive(false);if(!event.persisted){disposePanelContent();living.dispose();memory.dispose();homeTutor?.dispose();}});
window.addEventListener('pageshow',syncLayout);
function toast(message){
 const notice=$('#home-toast');clearTimeout(toastTimer);
 // A dialog's top layer covers ordinary fixed elements, so keep its status
 // message inside the open dialog without replacing any panel content.
 (panel.open?panel:document.body).append(notice);
 notice.textContent=String(message||'');notice.hidden=false;
 toastTimer=setTimeout(()=>{notice.hidden=true;},3800);
}
function updateAccount({snapshot=null,status='welcome',pending=false,busy=false,operating=false}={}){
 const nextOwner=snapshot?.accountId||'guest';
 if(accountOwner!==nextOwner){accountOwner=nextOwner;if(learningData.summary?.owner!==nextOwner)learningData={};if(panelKind==='memory')closePanel();void memory.update({owner:accountOwner,...learningData});}
 tutorUI.setOwner(snapshot?.accountId||'guest');
 homeTutor?.refresh();
 const label=busy?(snapshot?'저장 중':'계정 확인 중'):status==='loading'?'계정 확인 중':status==='offline'?'연결 대기 중':status==='conflict'?'저장 확인 필요':pending?'저장 대기 중':snapshot?(operating?'계정 연결됨':'시험 계정 연결됨'):'계정 연결하기';
 $('#home-account-status').textContent=label;
 $('.profile-control').dataset.state=status;
 $('.profile-control').setAttribute('aria-label',`나의 공간 열기 · ${label}`);
}
export const home={
 isMaru:true,
 state:{get reduced(){return manualReduced||reduced.matches;},get slots(){return {...equipment.slots};},get dyes(){return {...equipment.dyes};}},
 showPanel:openPanel,closePanel,openPanel:()=>panelKind,toast,
 attachPanelResource(resource){if(resource===panelResource)return;const previous=panelResource;panelResource=resource;try{previous?.dispose?.();}catch(error){console.warn('Panel cleanup failed',error);}},
 setSceneActive(active){sceneActive=Boolean(active);syncScene();},setSceneTime,setEntryState,
 setEquipment(slots={},dyes={}){equipment={slots:{...slots},dyes:{...dyes}};living.setEquipment(equipment.slots,equipment.dyes);},
 connectHost(callbacks){host=callbacks||null;document.documentElement.dataset.connected=String(Boolean(host));},
 updateAccount,updateLearning,updateStudy,photo,
 connectEducation(value){education=value;},openLearningGame:launchGame,
 scene:()=>living.metrics(),memory:()=>memory.snapshot(),
 startTutorial:()=>openTutor(),chooseTutor:()=>openTutor({force:true}),ensureTutor:then=>openTutor({then}),tutor:()=>tutorUI.metrics(),homeTutor:()=>homeTutor?.metrics(),
 applyTutorChoice:(id,owner)=>tutorUI.applyChoice(id,owner),refreshTutorStatus:()=>tutorUI.refreshStatus()
};
home.mountGameTutor=(game,{frame=null,practiceEnabled=true,presentation=education?.presentation?.()||null}={})=>{
 const companion=createGameTutor({tutorId:tutorUI.choice()?.id,game,container:content,frame,reduced:()=>home.state.reduced,owner:tutorUI.metrics().owner,onExit:closePanel,practiceEnabled,presentation});
 if(!companion)return null;
 window.__synkGameTutor=companion;
 return {...companion,dispose(){companion.dispose();if(window.__synkGameTutor===companion)delete window.__synkGameTutor;}};
};
home.mountLifeTutor=options=>createLifeTutor({...options,tutorId:tutorUI.choice()?.id,container:content,reduced:()=>home.state.reduced});
tutorUI=createTutorOnboarding({home,asset,commitChoice:(id,owner)=>host?.selectTutor?host.selectTutor(id,owner):null,getChoiceStatus:owner=>host?.tutorStatus?.(owner),onChoice:tutor=>{
 const profile=$('.profile-portrait img'),caption=$('.place-heading>p:last-child');
 profile.src=asset(tutor?`assets/tutors/${tutor.images.기본}`:'assets/home/mongle-smile.webp');
 caption.textContent=tutor?`${tutor.name}과 오늘의 한국어`:'세 친구와 오늘의 한국어';
 living.setTutor(tutor?.id||null);
 homeTutor?.refresh();
}});
homeTutor=createHomeTutor({container:$('#home-tutor'),getTutor:()=>tutorUI.metrics(),learn:command=>void callLearning(command),choose:()=>home.chooseTutor(),profile:showMe,reduced:()=>home.state.reduced});
homeTutor.refresh();
const initialTutor=tutorUI.choice();
if(initialTutor){$('.profile-portrait img').src=asset(`assets/tutors/${initialTutor.images.기본}`);$('.place-heading>p:last-child').textContent=`${initialTutor.name}과 오늘의 한국어`;living.setTutor(initialTutor.id);}
window.__synkHome=home;
export default home;
syncLayout();
setEntryState({phase:'restoring'});
if(!window.__SYNK_WORLD_CONNECTED__)void callLearning('initialize').then(()=>{
 const ready=()=>{sceneActive=true;setEntryState({phase:'ready'});if(new URLSearchParams(location.search).get('cafe')==='1')learningUI?.cafe();};
 if(initialTutor&&new URLSearchParams(location.search).get('tutor')!=='choose')ready();
 else{setEntryState({phase:'choosing'});void openTutor({force:!!initialTutor,then:ready});}
});

function sceneAction(id){
 if(id==='book')void callLearning('learn');
 else if(id==='cafe')void callLearning('cafe');
 else if(id==='town'){if(!callHost('town'))showPlay();}
 else if(id==='wardrobe')showWardrobe();
 else if(id==='memory')showMemory();
 else if(id==='photo')void photo();
}
function showMemory(){
 const data=memory.snapshot();
 openPanel('오늘, 우리와 함께','<section class="memory-detail"><small class="memory-date"></small><h3 class="memory-expression"></h3><p class="memory-note"></p><img class="memory-photo" alt="내 앨범에 저장한 사진" hidden><p class="memory-photo-label"></p><div class="panel-actions"><button class="felt-button" data-memory-review>오늘의 표현 돌아보기</button><button class="quiet-button" data-memory-photo>사진 남기기</button><button class="quiet-button" data-view="wardrobe">옷장 앨범 열기</button></div></section>',{type:'memory'});
 content.querySelector('.memory-date').textContent=data.date||'나의 작은 기록';
 content.querySelector('.memory-expression').textContent=data.text||'오늘의 첫 표현을 기다리고 있어요.';
 content.querySelector('.memory-note').textContent=data.text?data.label:'책을 펼쳐 함께 배운 표현을 여기에 남겨요.';
 const img=content.querySelector('.memory-photo');if(data.photoUrl){img.src=data.photoUrl;img.hidden=false;}
 content.querySelector('.memory-photo-label').textContent=data.photoUrl?`${data.photoDate} · ${data.photoLabel} · ${data.photoMode==='session'?'이 창에 임시 보관':'이 기기에 보관'}`:'';
 content.querySelector('[data-memory-review]').addEventListener('click',()=>{closePanel();homeTutor.openRecap();});
 content.querySelector('[data-memory-photo]').addEventListener('click',()=>{closePanel();void photo();});
}
async function photo(){
 if(photoBusy)return;
 if(accountOwner==='guest'){showMe();return;}
 photoBusy=true;const owner=accountOwner,navigation=panelEpoch,look=structuredClone(equipment),album=createWardrobeAlbum({accountId:owner});
 try{
  const raw=await living.capture(),dimensions=living.metrics().scene?.drawingBuffer||{};if(owner!==accountOwner)return;
  const blob=await (await fetch(raw)).blob();if(owner!==accountOwner)return;
  const result=await album.add(blob,{slots:look.slots,dyes:look.dyes,caption:'친구들과 나의 방',preview:false,createdAt:Date.now(),filename:'SYNK-WORLD-room.png',width:dimensions.width,height:dimensions.height,format:dimensions.width===dimensions.height?'square':'portrait'});
  if(owner!==accountOwner)return;
  if(!result.ok)throw Error(result.message||'사진을 보관하지 못했어요.');
  await memory.refresh();if(owner!==accountOwner)return;if(navigation===panelEpoch)showMemory();toast(result.mode==='session'?'사진을 이 창에 잠시 보관했어요. 옷장 앨범에서 PNG로 저장해 주세요.':'사진을 앨범과 홈 액자에 남겼어요.');
 }catch(error){if(owner===accountOwner)toast(error.message||'사진을 찍지 못했어요. 잠시 뒤 다시 시도해 주세요.');}
 finally{album.close();photoBusy=false;}
}
