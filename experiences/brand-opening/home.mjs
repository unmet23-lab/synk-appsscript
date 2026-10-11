import {createTutorOnboarding} from './tutor-onboarding.mjs';
import {createGameTutor} from './game-tutor.mjs';
import {createLifeTutor} from './life-tutor.mjs';
import {createHomeTutor} from './home-tutor.mjs';
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const asset=path=>new URL(path,import.meta.url).href;
for(const [key,file] of Object.entries({'paper-button':'button-white.webp','coral-button':'button-coral.webp','cream':'quality-cream.webp','blush':'quality-blush.webp'}))document.documentElement.style.setProperty('--life-'+key,`url("${asset('assets/home/'+file)}")`);
for(const [key,file] of Object.entries({'drinks':'cafe-drinks-v2.png','room':'cafe-room-v1.webp'}))document.documentElement.style.setProperty('--cafe-'+key,`url("${asset('assets/home/'+file)}")`);
const panel=$('#world-panel'),content=$('#panel-content'),scene=$('.maru-scene'),video=$('.scene-video');
const landscape=matchMedia('(orientation:landscape)'),spacious=matchMedia('(min-width:600px) and (min-height:600px) and (pointer:fine)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
const games={
 runner:{title:'바람길',detail:'듣고 달리는 90초',path:'../korean-runner/',image:'mongle-smile.webp',area:'짧은 지시의 방향·동작·부정·순서 듣기 연습'},
 hangul:{title:'한글 만나기',detail:'글자와 소리를 만나요',path:'../hangul-stage/',image:'book.webp',area:'한글 자모와 음절의 소리·글자 연결 연습'},
 rhythm:{title:'말의 리듬',detail:'듣고 박자에 맞춰 O/X',path:'../korean-rhythm/',image:'headphones.webp',area:'짧은 발화를 듣고 내용 일치 판단 연습'}
};
let lastFocus=null,panelKind='',inView=true,manualReduced=false,playToken=0,frameTimer,displayPreference='auto',layout='portrait',sceneResumeTime=null;
let learningUI=null,learningLoader=null;
let host=null,panelResource=null,sceneActive=true,toastTimer,equipment={slots:{},dyes:{}};
let orientationTask=Promise.resolve();
let tutorUI,homeTutor;
try{manualReduced=localStorage.getItem('synk.world.maru.reduced')==='true';}catch{}
try{const saved=localStorage.getItem('synk.world.maru.orientation');if(['auto','portrait','landscape'].includes(saved))displayPreference=saved;}catch{}
const sceneSource=()=>asset(`assets/world-menu-${layout==='landscape'?'desktop':'mobile'}-omni11-v9-web.mp4`);
function syncLayout(){
 const actual=landscape.matches?'landscape':'portrait';
 const next=spacious.matches&&displayPreference!=='auto'?displayPreference:actual;
 if(layout!==next){if(sceneResumeTime===null)sceneResumeTime=video.currentTime;video.pause();scene.classList.remove('is-playing');}
 layout=next;document.documentElement.dataset.layout=layout;
 document.documentElement.dataset.orientationPreference=displayPreference;
 $('.scene-poster').src=asset(`assets/felt-world-scene-${layout==='landscape'?'desktop':'mobile'}-v9.webp`);
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
 homeTutor?.setActive(sceneActive&&!panel.open);
 const shouldPlay=sceneActive&&!document.hidden&&!panel.open&&inView&&!reduced.matches&&!manualReduced;
 const token=++playToken;
 if(!shouldPlay){video.pause();if(reduced.matches||manualReduced)scene.classList.remove('is-playing');return;}
 const source=sceneSource();if(video.getAttribute('src')!==source){scene.classList.remove('is-playing');video.src=source;video.load();}
 video.play().then(()=>{if(token!==playToken)return;if(!sceneActive||document.hidden||panel.open||!inView||manualReduced||reduced.matches)video.pause();}).catch(()=>{if(token===playToken)scene.classList.remove('is-playing');});
}
video.addEventListener('playing',()=>{if(sceneActive&&!document.hidden&&!panel.open&&inView&&!manualReduced&&!reduced.matches)scene.classList.add('is-playing');else video.pause();});
video.addEventListener('error',()=>scene.classList.remove('is-playing'));
function applySceneTime(){if(sceneResumeTime!==null&&video.readyState>=1&&Number.isFinite(video.duration)){video.currentTime=Math.min(sceneResumeTime,Math.max(0,video.duration-.05));sceneResumeTime=null;}}
function setSceneTime(seconds){if(!Number.isFinite(seconds)||seconds<0)return;sceneResumeTime=seconds;if(video.getAttribute('src')===sceneSource())applySceneTime();}
video.addEventListener('loadedmetadata',applySceneTime);
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
 const focus=lastFocus;lastFocus=null;
 disposePanelContent();if(panel.open)panel.close();panel.className='world-panel';panelKind='';setNav('home');syncScene();
 if(focus?.isConnected&&focus!==document.body&&!focus.closest('#world-panel'))focus.focus({preventScroll:true});
 else $('#life-next-button').focus({preventScroll:true});
}
function openPanel(title,html,{type='',eyebrow='SYNK WORLD',nav='home'}={}){
 if(!panel.open)lastFocus=document.activeElement;disposePanelContent();
 panelKind=type;panel.className='world-panel panel-dialog';
 if(type==='game')panel.classList.add('game-panel');
 else if(type==='wardrobe'||type==='world-wardrobe')panel.classList.add('wardrobe-dialog');
 else if(/^[a-z][a-z0-9-]*$/i.test(type))panel.classList.add(`${type}-panel`);
 const activeNav=nav!=='home'?nav:/wardrobe/.test(type)?'wardrobe':/profile/.test(type)?'me':'home';
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
 if(games[id])tutorUI.ensure(()=>launchGame(id));
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
 tutorUI.ensure(()=>callLearningReady(command));
}
async function callLearningReady(command){
 if(host){callHost(command==='learn'?'learn':command);return;}
 if(!learningLoader)learningLoader=import('./content/life-standalone.mjs').then(({setupLife})=>{learningUI=setupLife(home,path=>asset('assets/'+path));return learningUI;}).catch(error=>{learningLoader=null;toast('생활 콘텐츠를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.');throw error;});
 try{const ui=await learningLoader;ui[command==='learn'?'next':command]?.();}catch{}
}
function updateLearning(summary,details){
 homeTutor?.update(summary,details);
 const next=summary.nextLesson,button=$('#life-next-button'),label=$('#life-next-title'),kicker=$('#life-next-kicker'),caption=$('#life-progress-caption'),review=$('#life-review-count');
 if(!button)return;
 button.disabled=summary.status?.phase==='loading';
 label.textContent=summary.status?.phase==='loading'?'내 진도를 연결하고 있어요':next?next.title:summary.dueCount?'오늘 돌아온 표현':'생활 팩 다시 만나기';
 kicker.textContent=summary.resume?'하던 자리에서 이어서':summary.cafe?.nextNumber?`${summary.cafe.nextNumber}번째 카페 방문 · 다음 이야기`:next?`${summary.packs?.length||6}개 생활 팩 · 다음 한 걸음`:'오늘도 친구들과 함께';
 caption.textContent=`${summary.completed||0} / ${summary.total||22} 학습 완료 · ${summary.status?.scoped?'계정별 진도':'이 기기의 진도'}`;
 review.textContent=summary.dueCount?`${summary.dueCount}개`:'일정';
 button.setAttribute('aria-label',`${summary.resume?'이어서 하기':'다음 학습'} · ${label.textContent}`);
}
function showPlay(){openPanel('어떤 놀이가 좋을까?',`<div class="life-menu-entry"><button class="plain-button" data-view="packs">생활 한국어 6팩</button><button class="plain-button" data-view="stories">세 친구 이야기</button><button class="plain-button" data-view="review">나의 복습</button></div><div class="play-list">${Object.entries(games).map(([id,g])=>`<button data-game="${id}"><img src="${asset(`assets/home/${g.image}`)}" alt=""><span><strong>${g.title}</strong><small>${g.detail}</small></span><span class="arrow" aria-hidden="true">↗</span></button>`).join('')}</div><p class="panel-note">한글이 처음이라면 ‘한글 만나기’부터 천천히 시작해요.</p>${host?'<div class="connected-destinations" aria-label="더 둘러보기"><button class="plain-button" data-world="play">첫 문장 놀이</button><button class="plain-button" data-world="town">우리 동네</button><button class="plain-button" data-world="songs">노래 듣기</button></div>':''}`,{eyebrow:'PLAY TOGETHER',nav:'play'});}
function showWardrobe(){if(callHost('wardrobe'))return;openPanel('오늘의 몽글은 어떤 모습?',`<img class="panel-art" src="${asset('assets/home/scarf.webp')}" alt="음표 장식이 달린 포근한 펠트 목도리"><p class="panel-description">작은 목도리 하나로 달라지는 기분.<br>입혀 보고, 나만의 차림을 찾아보세요.</p><div class="panel-actions"><a class="felt-button" href="${asset('../mobile.html?wardrobe=1&opening=off')}">나의 옷장 열기 <span aria-hidden="true">↗</span></a></div><p class="panel-note">옷장에서는 기존 계정 연결과 보유품 확인을 이어갑니다. 사진은 차림 예시예요.</p>`,{eyebrow:'MY WARDROBE',nav:'wardrobe'});}
function showMe(){if(callHost('profile'))return;openPanel('나만의 속도로, 차근차근.',`<img class="panel-art" src="${asset('assets/home/mongle-smile.webp')}" alt="눈웃음 짓는 펠트 몽글"><p class="panel-description">지금은 자유롭게 둘러보고 있어요.<br>나의 차림과 놀이 기록은 계정을 연결한 공간에서 확인할 수 있어요.</p><div class="panel-actions"><a class="felt-button" href="${asset('../mobile.html?opening=off')}">나의 공간 연결하기 <span aria-hidden="true">↗</span></a><button class="quiet-button" data-close>지금은 조금 더 둘러볼게요</button></div>`,{eyebrow:'YOUR LITTLE WORLD',nav:'me'});}
function showSettings(){openPanel('편안하게 머물러요.',`<fieldset class="orientation-settings"><legend>화면 방향</legend><div class="orientation-options">${[['auto','자동'],['portrait','세로'],['landscape','가로']].map(([value,label])=>`<label><input type="radio" name="orientation" value="${value}" ${displayPreference===value?'checked':''}><span>${label}</span></label>`).join('')}</div><p id="orientation-status" class="orientation-help" role="status"></p></fieldset><label class="settings-row"><span><strong>풍경 움직임 줄이기</strong><small>한강 마루를 고요한 사진으로 보여줘요.</small></span><input id="reduce-motion" type="checkbox" ${manualReduced||reduced.matches?'checked':''} ${reduced.matches?'disabled':''}></label>${reduced.matches?'<p class="panel-note">기기의 움직임 감소 설정을 따르고 있어요.</p>':''}<div class="panel-actions">${host?'<button class="felt-button" data-replay-opening>오프닝 다시 보기 <span aria-hidden="true">↗</span></button>':`<a class="felt-button" href="${asset('index.html')}">오프닝 다시 보기 <span aria-hidden="true">↗</span></a>`}${host?'<button class="quiet-button" data-home-host="about">SYNK WORLD 소개</button>':''}</div>`,{eyebrow:'MAKE YOURSELF AT HOME'});syncLayout();}
function showTutorSettings(){
 showSettings();
 const button=document.createElement('button');button.className='felt-button';
 button.textContent=tutorUI.choice()?`나의 AI 튜터 · ${tutorUI.choice().name}`:'함께할 AI 튜터 고르기';
 button.dataset.tutorOpen='';button.addEventListener('click',()=>home.chooseTutor());
 content.querySelector('.panel-actions').prepend(button);
}
document.addEventListener('click',event=>{
 if(event.defaultPrevented)return;
 const button=event.target.closest('[data-view],[data-game],[data-close],[data-world],[data-replay-opening],[data-home-host]');if(!button)return;
 if(button.dataset.game){event.preventDefault();openGame(button.dataset.game);return;}
 if(button.hasAttribute('data-replay-opening')){closePanel();callHost('replayOpening');return;}
 if(button.dataset.homeHost){callHost(button.dataset.homeHost);return;}
 if(button.dataset.world){if(['play','town','songs'].includes(button.dataset.world))callHost(button.dataset.world,button);return;}
 if(button.hasAttribute('data-close')){closePanel();return;}
 const view=button.dataset.view;if(['learn','packs','review','stories','cafe'].includes(view)){void callLearning(view);return;}if(view==='play')showPlay();else if(view==='wardrobe')showWardrobe();else if(view==='me')showMe();else{if(panel.open)closePanel();window.scrollTo({top:0,behavior:manualReduced||reduced.matches?'instant':'smooth'});}
});
content.addEventListener('change',event=>{if(event.target.name==='orientation')chooseOrientation(event.target.value);if(event.target.id==='reduce-motion'){manualReduced=event.target.checked;try{localStorage.setItem('synk.world.maru.reduced',String(manualReduced));}catch{}syncScene();}});
document.querySelector('[data-orientation-auto]').addEventListener('click',()=>chooseOrientation('auto'));
$('#panel-close').addEventListener('click',closePanel);panel.addEventListener('cancel',event=>{event.preventDefault();closePanel();});panel.addEventListener('click',event=>{if(event.target===panel){const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closePanel();}});
panel.addEventListener('close',()=>{if(!panel.open&&(content.childElementCount||panelResource))closePanel();});
$('#settings-open').addEventListener('click',showTutorSettings);window.addEventListener('pagehide',event=>{video.pause();if(!event.persisted)disposePanelContent();});
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
 setSceneActive(active){sceneActive=Boolean(active);syncScene();},setSceneTime,
 setEquipment(slots={},dyes={}){equipment={slots:{...slots},dyes:{...dyes}};},
 connectHost(callbacks){host=callbacks||null;document.documentElement.dataset.connected=String(Boolean(host));},
 updateAccount,updateLearning,
 startTutorial:()=>tutorUI.open(),chooseTutor:()=>tutorUI.open({force:true}),ensureTutor:then=>tutorUI.ensure(then),tutor:()=>tutorUI.metrics(),homeTutor:()=>homeTutor?.metrics()
};
home.mountGameTutor=(game,{frame=null,practiceEnabled=true}={})=>{
 const companion=createGameTutor({tutorId:tutorUI.choice()?.id,game,container:content,frame,reduced:()=>home.state.reduced,owner:tutorUI.metrics().owner,onExit:closePanel,practiceEnabled});
 if(!companion)return null;
 window.__synkGameTutor=companion;
 return {...companion,dispose(){companion.dispose();if(window.__synkGameTutor===companion)delete window.__synkGameTutor;}};
};
home.mountLifeTutor=options=>createLifeTutor({...options,tutorId:tutorUI.choice()?.id,container:content,reduced:()=>home.state.reduced});
tutorUI=createTutorOnboarding({home,asset,onChoice:tutor=>{
 const profile=$('.profile-portrait img'),caption=$('.place-heading>p:last-child');
 profile.src=asset(tutor?`assets/tutors/${tutor.images.기본}`:'assets/home/mongle-smile.webp');
 caption.textContent=tutor?`${tutor.name}과 오늘의 한국어`:'세 친구와 오늘의 한국어';
 homeTutor?.refresh();
}});
homeTutor=createHomeTutor({container:$('#home-tutor'),getTutor:()=>tutorUI.metrics(),learn:command=>void callLearning(command),choose:()=>home.chooseTutor(),profile:showMe,reduced:()=>home.state.reduced});
homeTutor.refresh();
const initialTutor=tutorUI.choice();
if(initialTutor){$('.profile-portrait img').src=asset(`assets/tutors/${initialTutor.images.기본}`);$('.place-heading>p:last-child').textContent=`${initialTutor.name}과 오늘의 한국어`;}
window.__synkHome=home;
export default home;
syncLayout();

if(!window.__SYNK_WORLD_CONNECTED__)void callLearning('initialize').then(()=>{if(new URLSearchParams(location.search).get('cafe')==='1')learningUI?.cafe();});
if(!window.__SYNK_WORLD_CONNECTED__&&new URLSearchParams(location.search).get('welcome')==='1')home.startTutorial();
if(!window.__SYNK_WORLD_CONNECTED__&&new URLSearchParams(location.search).get('tutor')==='choose')home.chooseTutor();
