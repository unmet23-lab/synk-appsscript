import {createTutorOnboarding} from './tutor-onboarding.mjs';
import {createGameTutor} from './game-tutor.mjs';
import {createLifeTutor} from './life-tutor.mjs';
import {createHomeTutor} from './home-tutor.mjs';
import {createHomeScene} from './home-scene.mjs';
import {createHomeTown} from './home-town.mjs';
import {createHomeMemory} from './home-memory.mjs';
import {profilePhoto} from './tutor-photos.mjs';
import {createWardrobeAlbum} from '../synk-world-home/wardrobe-album.mjs';
import {play,bindTaps,getPref,setPref,hapticAvailable,PREF_LABELS} from './world-sound.mjs';
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const asset=path=>new URL(path,import.meta.url).href;
for(const [key,file] of Object.entries({'paper-button':'button-white-ui.webp','coral-button':'button-coral-ui.webp','cream':'quality-cream-ui.webp','blush':'quality-blush-ui.webp'}))document.documentElement.style.setProperty('--life-'+key,`url("${asset('assets/home/'+file)}")`);
for(const [key,file] of Object.entries({'drinks':'cafe-drinks-v2.png','room':'cafe-room-v1.webp'}))document.documentElement.style.setProperty('--cafe-'+key,`url("${asset('assets/home/'+file)}")`);
const panel=$('#world-panel'),content=$('#panel-content'),scene=$('.maru-scene');
const landscape=matchMedia('(orientation:landscape)'),spacious=matchMedia('(min-width:600px) and (min-height:600px) and (pointer:fine)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
const games={
 runner:{title:'바람길',detail:'들은 말대로 90초 동안 달려요',label:'LISTEN & RUN',path:'../korean-runner/',image:'world-felt/runner.webp',area:'짧은 지시의 방향·동작·부정·순서 듣기 연습'},
 hangul:{title:'한글 만나기',detail:'소리를 듣고 글자를 골라요',label:'HANGUL',path:'../hangul-stage/',image:'world-felt/hangul.webp',area:'한글 자모와 음절의 소리·글자 연결 연습'},
 rhythm:{title:'말의 리듬',detail:'노래를 듣다가 O·X로 답해요',label:'RHYTHM',path:'../korean-rhythm/',image:'world-felt/rhythm.webp',area:'짧은 발화를 듣고 내용 일치 판단 연습'}
};
let lastFocus=null,panelKind='',inView=true,manualReduced=false,frameTimer,displayPreference='auto',layout='portrait';
let learningUI=null,learningLoader=null,education=null;
let host=null,panelResource=null,sceneActive=false,entryPhase='restoring',toastTimer,equipment={slots:{},dyes:{}},accountOwner='guest',learningData={},photoBusy=false,panelEpoch=0;
let orientationTask=Promise.resolve();
let tutorUI,homeTutor;
// 홈의 자리: 'town'(우리 동네, 첫 장면) 또는 'room'(우리 집 안 3D 방). 3D 방은 들어갔을 때만 그린다.
let place='town';
const living=createHomeScene({container:scene,onAction:sceneAction,onStatus:status=>{scene.dataset.status=status;}});
const town=createHomeTown({container:$('.town-scene'),asset,onPlace:openPlace,obstacle:$('.lobby-action')});
const memory=createHomeMemory({onChange:data=>living.setMemory(data)});
try{manualReduced=localStorage.getItem('synk.world.maru.reduced')==='true';}catch{}
try{const saved=localStorage.getItem('synk.world.maru.orientation');if(['auto','portrait','landscape'].includes(saved))displayPreference=saved;}catch{}
function syncLayout(){
 const actual=landscape.matches?'landscape':'portrait';
 const next=spacious.matches&&displayPreference!=='auto'?displayPreference:actual;
 layout=next;document.documentElement.dataset.layout=layout;town.setLayout(layout);
 document.documentElement.dataset.orientationPreference=displayPreference;
 const mismatch=!spacious.matches&&displayPreference!=='auto'&&displayPreference!==actual;
 $('.orientation-notice').hidden=!mismatch;
 $('#orientation-message').textContent=displayPreference==='landscape'?'휴대폰을 가로로 돌려 주세요':'휴대폰을 세로로 돌려 주세요';
 const status=$('#orientation-status');if(status)status.textContent=mismatch?`${displayPreference==='landscape'?'가로':'세로'}로 골랐어요. 휴대폰을 돌리면 그 방향으로 보여요.`:spacious.matches?'고른 화면 비율로 보여요.':'자동은 기기 방향을 따라요. 세로·가로를 고르면 휴대폰을 그 방향으로 돌려 주세요.';
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
 homeTutor?.setActive(active);living.setReducedMotion(reduced.matches||manualReduced);living.setActive(active&&place==='room');
 town.setActive(entryPhase==='ready'&&!panel.open&&place==='town');
 // 시트 전환(home.css)도 앱의 「움직임 줄이기」를 따른다.
 document.documentElement.dataset.motion=reduced.matches||manualReduced?'reduced':'full';
}
// 동네 ↔ 우리 집(3D 방). 방에 들어갈 때만 3D를 불러 그리고, 나오면 멈춘다.
function setPlace(next,{focus=false}={}){
 place=next==='room'?'room':'town';
 const shell=$('.world-shell');shell.dataset.place=place;
 $('.place-kicker').textContent=place==='room'?'OUR ROOM':'OUR TOWN';$('.place-heading h1').textContent=place==='room'?'우리 방':'우리 동네';
 document.title=`${place==='room'?'우리 방':'우리 동네'} · SYNK WORLD`;
 scene.inert=place!=='room';
 syncScene();
 if(focus)(place==='room'?$('.room-back'):null)?.focus({preventScroll:true});
}
function openPlace(spot){
 if(spot.id==='home'){play('open');setPlace('room',{focus:true});return;}
 void openPack(spot.pack);
}
// 장소 하나 = 생활 팩 하나. 튜터를 고른 뒤에 그 팩의 레슨 목록을 연다.
function openPack(id){
 return openTutor({then:async()=>{
  if(host){callHost('pack',id);return;}
  try{(await loadLearning())?.pack?.(id);}catch{}
 }});
}
// Kept for the opening host contract; the 3D room does not inherit a movie time.
function setSceneTime(){}
function setEntryState({phase='restoring',message=''}={}){
 entryPhase=phase;$('.world-shell').dataset.entry=phase;
 const ready=phase==='ready';$('.home-entry-status').hidden=ready;
 $('.home-entry-status p').textContent=message||(phase==='choosing'?'함께할 친구를 골라 주세요.':phase==='error'?'연결을 다시 확인해 주세요.':'불러오고 있어요.');
 $('.world-topbar').inert=!ready;$('.world-nav').inert=!ready;$('.lobby-action').inert=!ready;
 if(ready&&!panel.open&&(!document.activeElement||document.activeElement===document.body))focusHomeAction();
 living.setTutor(tutorUI?.choice()?.id||null);syncScene();
}
new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;syncScene();},{threshold:.05}).observe(scene);
landscape.addEventListener('change',syncLayout);spacious.addEventListener('change',syncLayout);reduced.addEventListener('change',syncScene);document.addEventListener('visibilitychange',syncLayout);document.addEventListener('fullscreenchange',syncLayout);
function setNav(name){$$('.world-nav button').forEach(button=>{if(button.dataset.view===name)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});}
function disposePanelContent({keepView=false}={}){
 clearTimeout(frameTimer);
 const resource=panelResource;panelResource=null;
 try{resource?.dispose?.();}catch(error){console.warn('Panel cleanup failed',error);}
 content.querySelectorAll('video,audio').forEach(media=>media.pause());
 content.querySelectorAll('iframe').forEach(frame=>{frame.src='about:blank';frame.remove();});
 if(!keepView)content.replaceChildren();
}
// 3D 방에서는 다음 학습 알약이 숨어 있다. 오늘 카드에서 보이는 첫 주 행동으로 초점을 돌린다(홈이 준비되기 전에는 inert라 받지 못한다).
function focusHomeAction(){[...document.querySelectorAll('#home-tutor .home-tutor-action,#home-tutor .home-tutor-choose,#home-tutor .game-tutor-help,#life-next-button')].find(el=>el.getClientRects().length&&!el.disabled&&!el.closest('[inert]'))?.focus({preventScroll:true});}
// 닫기 전환(유호님 10-14 B안): 정리·상태는 바로 하고, 판 모습만 160ms 동안 흐려지며 작아진 뒤 닫는다(home.css .is-closing).
// 게임·튜터 고르기(틀 전체)와 움직임 줄이기에서는 바로 닫는다. 그 사이 다른 시트가 열리면 닫기를 취소한다(openPanel).
function closePanel(){
 if(panel.__closeTimer){clearTimeout(panel.__closeTimer);panel.__closeTimer=0;}
 panelEpoch++;
 const focus=lastFocus,epoch=panelEpoch;lastFocus=null;
 const fade=panel.open&&typeof panel.animate==='function'&&!home.state.reduced&&!['game-panel','tutor-panel','is-closing'].some(name=>panel.classList.contains(name));
 const restore=()=>{if(focus?.isConnected&&focus!==document.body&&!focus.closest('#world-panel'))focus.focus({preventScroll:true});else focusHomeAction();};
 disposePanelContent({keepView:fade});
 if(fade){
  play('close');panel.classList.add('is-closing');
  panel.__closeTimer=setTimeout(()=>{panel.__closeTimer=0;if(epoch!==panelEpoch)return;content.replaceChildren();if(panel.open)panel.close();panel.className='world-panel';syncScene();restore();},160);
 }else{if(panel.open){play('close');panel.close();}panel.className='world-panel';}
 panelKind='';setNav('home');syncScene();
 void memory.refresh();
 queueMicrotask(()=>education?.refresh());
 if(!fade)restore();
}
function openPanel(title,html,{type='',eyebrow='SYNK WORLD',nav='home'}={}){
 if(panel.__closeTimer){clearTimeout(panel.__closeTimer);panel.__closeTimer=0;}
 panelEpoch++;
 if(!panel.open)lastFocus=document.activeElement;disposePanelContent();
 panelKind=type;panel.className='world-panel panel-dialog';
 // 집중 화면(레슨·문제·카페·결과·이야기·게임·옷장·마을·보상)은 PC 가로 틀에서 가운데 최대 1120px(home.css .is-wide), 나머지 시트는 오른쪽 680px 패널.
 panel.classList.toggle('is-wide',/^(?:game|life-(?:lesson|question|cafe|cafe-complete|complete|review|review-complete|story)|wardrobe|world-(?:wardrobe|town|reward|hanger|hanger-list|game-[a-z-]+))$/.test(type));
 if(type==='game')panel.classList.add('game-panel');
 else if(type==='wardrobe'||type==='world-wardrobe')panel.classList.add('wardrobe-dialog');
 else if(/^[a-z][a-z0-9-]*$/i.test(type))panel.classList.add(`${type}-panel`);
 const activeNav=/^life-/.test(type)?'packs':nav!=='home'?nav:/wardrobe/.test(type)?'wardrobe':/profile/.test(type)?'me':'home';
 $('#panel-title').textContent=title;$('#panel-eyebrow').textContent=eyebrow;content.innerHTML=html;setNav(activeNav);if(!panel.open){panel.showModal();play('open');}panel.scrollTop=0;syncScene();$('#panel-close').focus({preventScroll:true});
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
 try{const ui=await loadLearning();ui[command==='learn'?'next':command]?.();}catch{}
}
function loadLearning(){
 if(!learningLoader)learningLoader=import('./content/life-standalone.mjs').then(({setupLife})=>{learningUI=setupLife(home,path=>asset('assets/'+path));return learningUI;}).catch(error=>{learningLoader=null;toast('생활 콘텐츠를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.');throw error;});
 return learningLoader;
}
function updateLearning(summary,details){
 homeTutor?.update(summary,details);town.setProgress(summary);
 learningData={summary,snapshot:details?.snapshot,lessons:details?.lessons,details};
 void memory.update({owner:accountOwner,...learningData});
 const next=summary.nextLesson,button=$('#life-next-button'),label=$('#life-next-title'),kicker=$('#life-next-kicker'),caption=$('#life-progress-caption'),review=$('#life-review-count');
 if(!button)return;
 button.disabled=summary.status?.phase==='loading';
 label.textContent=summary.status?.phase==='loading'?'내 진도를 연결하고 있어요':next?next.title:summary.dueCount?'오늘 돌아온 표현':'생활 팩 다시 보기';
 kicker.textContent=summary.resume?'하던 자리에서 이어서':summary.cafe?.nextNumber?`${summary.cafe.nextNumber}번째 카페 방문 · 다음 이야기`:next?`생활 팩 ${summary.packs?.length||6}개 · 다음 레슨`:'생활 한국어';
 caption.textContent=`${summary.completed||0} / ${summary.total||22} 학습 완료 · ${summary.status?.scoped?'계정별 진도':'이 기기의 진도'}`;
 renderHeading();
 review.textContent=summary.dueCount?`${summary.dueCount}개`:'일정';
 button.setAttribute('aria-label',`${summary.resume?'이어서 하기':'다음 학습'} · ${label.textContent}`);
}
// PC 가로 틀의 방 제목 아래 한 줄: 누구와 · 어디까지.
function renderHeading(tutor=tutorUI?.choice()){
 const line=$('.place-heading>p:last-child'),summary=learningData.summary;if(!line)return;
 line.textContent=[tutor?`${tutor.name}과 함께`:'세 친구와 함께',summary?`생활 한국어 ${summary.completed||0} / ${summary.total||22}`:''].filter(Boolean).join(' · ');
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
 $('#life-next-kicker').textContent=plan.resume?'하던 자리에서 이어서':next.route==='review'?'돌아온 표현 · 나의 복습':'추천 연습';
 $('#life-next-button').setAttribute('aria-label',`맞춤 학습 · ${next.label||next.title}`);
}
function showPlay(){
 const more=host?`<section class="play-more" aria-label="더 둘러보기"><p class="eyebrow">MORE</p><button data-world="play"><img src="${asset('assets/world-felt/sentence.webp')}" alt=""><span><strong>첫 문장 놀이</strong><small>문장 세 개를 맞히면 선물을 받아요</small></span></button><button data-world="town"><img src="${asset('assets/world-felt/town.webp')}" alt=""><span><strong>싱크타운</strong><small>내 차림 그대로 광장을 걸어요</small></span></button><button data-world="songs"><img src="${asset('assets/world-felt/songs.webp')}" alt=""><span><strong>노래 듣기</strong><small>한글 노래와 뮤직비디오</small></span></button></section>`:'';
 openPanel('놀이',`<div class="play-list">${Object.entries(games).map(([id,g],i)=>`<button data-game="${id}"><span class="play-art w-print"><img src="${asset(`assets/${g.image}`)}" alt=""></span><span class="play-copy"><small class="play-label">${String(i+1).padStart(2,'0')} · ${g.label}</small><strong>${g.title}</strong><small>${g.detail}</small></span><span class="arrow" aria-hidden="true">↗</span></button>`).join('')}</div><p class="panel-note">한글이 처음이면 ‘한글 만나기’부터 시작해요.</p>${more}`,{eyebrow:'PLAY',nav:'play'});
}
function showWardrobe(){if(callHost('wardrobe'))return;openPanel('옷장',`<span class="panel-print w-print"><img src="${asset('assets/world-felt/wardrobe.webp')}" alt="옷걸이에 걸린 펠트 목도리"></span><p class="panel-description">세 친구에게 옷을 입혀 보고 사진으로 남길 수 있어요.</p><div class="panel-actions"><a class="felt-button" href="${asset('../mobile.html?wardrobe=1&opening=off')}">옷장 열기 <span aria-hidden="true">↗</span></a></div><p class="panel-note">계정을 연결하면 가진 옷과 차림이 저장돼요.</p>`,{eyebrow:'MY WARDROBE',nav:'wardrobe'});}
function showMe(){if(callHost('profile'))return;openPanel('내 계정',`<span class="panel-print w-print"><img src="${asset('assets/world-felt/account.webp')}" alt="열쇠와 꼬리표"></span><p class="panel-description">지금은 계정 없이 둘러보는 중이에요. 계정을 연결하면 진도·차림·놀이 기록이 저장돼요.</p><div class="panel-actions"><a class="felt-button" href="${asset('../mobile.html?opening=off')}">계정 연결하기 <span aria-hidden="true">↗</span></a><button class="quiet-button" data-close>나중에 하기</button></div>`,{eyebrow:'ACCOUNT',nav:'me'});}
function prefRows(){
 // 진동은 지원하는 기기에서만 보인다(PC 브라우저에는 없다). 아이폰은 vibrate가 없어도 스위치 진동(iOS 18)으로 울린다.
 return Object.entries(PREF_LABELS).filter(([name])=>name!=='haptic'||hapticAvailable()).map(([name,{title,note}])=>`<label class="settings-row"><span><strong>${title}</strong><small>${note}</small></span><input type="checkbox" data-pref="${name}" ${getPref(name)?'checked':''}></label>`).join('');
}
function showSettings(){openPanel('설정',`<fieldset class="orientation-settings"><legend>화면 방향</legend><div class="orientation-options">${[['auto','자동'],['portrait','세로'],['landscape','가로']].map(([value,label])=>`<label><input type="radio" name="orientation" value="${value}" ${displayPreference===value?'checked':''}><span>${label}</span></label>`).join('')}</div><p id="orientation-status" class="orientation-help" role="status"></p></fieldset><section class="settings-group" aria-label="소리와 연출"><p class="eyebrow">SOUND · MOTION</p>${prefRows()}<label class="settings-row"><span><strong>움직임 줄이기</strong><small>친구들의 숨쉬기와 인사 동작을 멈추고, 이야기 글을 한 번에 보여 줘요.</small></span><input id="reduce-motion" type="checkbox" ${manualReduced||reduced.matches?'checked':''} ${reduced.matches?'disabled':''}></label></section>${reduced.matches?'<p class="panel-note">기기의 움직임 줄이기 설정을 따르고 있어요.</p>':''}<div class="panel-actions">${host?'<button class="felt-button" data-replay-opening>오프닝 다시 보기 <span aria-hidden="true">↗</span></button>':`<a class="felt-button" href="${asset('index.html')}">오프닝 다시 보기 <span aria-hidden="true">↗</span></a>`}${host?'<button class="quiet-button" data-home-host="about">SYNK WORLD 소개</button>':''}</div>`,{eyebrow:'SETTINGS',type:'settings'});syncLayout();}
function showTutorSettings(){
 showSettings();
 const button=document.createElement('button');button.className='felt-button';
 button.textContent=tutorUI.choice()?`AI 튜터 바꾸기 · 지금 ${tutorUI.choice().name}`:'AI 튜터 고르기';
 button.dataset.tutorOpen='';button.addEventListener('click',()=>home.chooseTutor());
 content.querySelector('.panel-actions').prepend(button);
 if(education){const study=document.createElement('button');study.className='plain-button';study.textContent='학습 목표·도움 방식';study.addEventListener('click',()=>education.open());content.querySelector('.panel-actions').prepend(study);}
}
document.addEventListener('click',event=>{
 if(event.defaultPrevented)return;
 const button=event.target.closest('[data-view],[data-game],[data-close],[data-world],[data-replay-opening],[data-home-host]');if(!button)return;
 if(button.dataset.game){event.preventDefault();openGame(button.dataset.game);return;}
 if(button.hasAttribute('data-replay-opening')){closePanel();callHost('replayOpening');return;}
 if(button.dataset.homeHost){callHost(button.dataset.homeHost);return;}
 if(button.dataset.world){if(['play','town','songs'].includes(button.dataset.world))callHost(button.dataset.world,button);return;}
 if(button.hasAttribute('data-close')){closePanel();return;}
 const view=button.dataset.view;if(['learn','packs','review','stories','cafe','study'].includes(view)){void callLearning(view);return;}if(view==='play')showPlay();else if(view==='wardrobe')showWardrobe();else if(view==='me')showMe();else{if(panel.open)closePanel();if(place==='room')setPlace('town');window.scrollTo({top:0,behavior:manualReduced||reduced.matches?'instant':'smooth'});}
});
content.addEventListener('change',event=>{const pref=event.target.dataset?.pref;if(pref){setPref(pref,event.target.checked);if(pref==='sound'&&event.target.checked)play('select');return;}if(event.target.name==='orientation')chooseOrientation(event.target.value);if(event.target.id==='reduce-motion'){manualReduced=event.target.checked;try{localStorage.setItem('synk.world.maru.reduced',String(manualReduced));}catch{}syncScene();}});
document.querySelector('[data-orientation-auto]').addEventListener('click',()=>chooseOrientation('auto'));
$('.room-back').addEventListener('click',()=>{play('close');setPlace('town');town.focus();});
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
 (panel.open&&!panel.classList.contains('is-closing')?panel:document.body).append(notice);
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
 $('.profile-control').setAttribute('aria-label',`내 계정 열기 · ${label}`);
}
export const home={
 isMaru:true,
 state:{get reduced(){return manualReduced||reduced.matches;},get slots(){return {...equipment.slots};},get dyes(){return {...equipment.dyes};}},
 showPanel:openPanel,closePanel,openPanel:()=>panelKind,toast,
 attachPanelResource(resource){if(resource===panelResource)return;const previous=panelResource;panelResource=resource;try{previous?.dispose?.();}catch(error){console.warn('Panel cleanup failed',error);}},
 setSceneActive(active){sceneActive=Boolean(active);syncScene();},setSceneTime,setEntryState,
 setEquipment(slots={},dyes={}){equipment={slots:{...slots},dyes:{...dyes}};living.setEquipment(equipment.slots,equipment.dyes);},
 connectHost(callbacks){host=callbacks||null;document.documentElement.dataset.connected=String(Boolean(host));},
 place:()=>place,goTown:()=>{if(panel.open)closePanel();setPlace('town');},
 updateAccount,updateLearning,updateStudy,
 // 사진은 3D 방에서 찍는다. 동네에서 부르면 먼저 방으로 들어간다(capture는 방이 다 불러질 때까지 기다린다).
 photo:()=>{if(place!=='room')setPlace('room');return photo();},
 connectEducation(value){education=value;},openLearningGame:launchGame,
 scene:()=>living.metrics(),memory:()=>memory.snapshot(),town:()=>({place,...town.metrics()}),enterRoom:()=>setPlace('room'),leaveRoom:()=>setPlace('town'),
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
 const profile=$('.profile-portrait img');
 profile.src=profilePhoto(tutor?.id);
 renderHeading(tutor);
 living.setTutor(tutor?.id||null);
 homeTutor?.refresh();
}});
homeTutor=createHomeTutor({container:$('#home-tutor'),getTutor:()=>tutorUI.metrics(),learn:command=>void callLearning(command),choose:()=>home.chooseTutor(),profile:showMe,reduced:()=>home.state.reduced});
homeTutor.refresh();
const initialTutor=tutorUI.choice();
if(initialTutor){$('.profile-portrait img').src=profilePhoto(initialTutor.id);renderHeading(initialTutor);living.setTutor(initialTutor.id);}
window.__synkHome=home;
// 단추를 누를 때의 짧은 소리(효과음 스위치를 따른다). 시트 안 단추도 문서 하나로 묶인다.
bindTaps(document);
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
 openPanel('기억 액자','<section class="memory-detail"><small class="memory-date"></small><h3 class="memory-expression"></h3><p class="memory-note"></p><img class="memory-photo" alt="내 앨범에 저장한 사진" hidden><p class="memory-photo-label"></p><div class="panel-actions"><button class="felt-button" data-memory-review>오늘 배운 표현 보기</button><button class="quiet-button" data-memory-photo>방 사진 찍기</button><button class="quiet-button" data-view="wardrobe">앨범 열기</button></div></section>',{type:'memory',eyebrow:'MEMORY'});
 content.querySelector('.memory-date').textContent=data.date||'아직 기록이 없어요';
 content.querySelector('.memory-expression').textContent=data.text||'아직 배운 표현이 없어요';
 content.querySelector('.memory-note').textContent=data.text?data.label:'레슨을 하나 끝내면 배운 표현이 여기에 걸려요.';
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
