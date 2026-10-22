import {createWardrobeStudio} from './wardrobe-studio.mjs';
import {WARDROBE_ITEMS,WARDROBE_OUTFITS,slotsForOutfit,outfitForSlots,outfitLabel} from './wardrobe-catalog.mjs';
import {normalizeEditState} from './wardrobe-workbench.mjs';
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const paths={home:'M3 10.5 12 3l9 7.5M5.5 9v11h5v-6h3v6h5V9',game:'M7 7h10c2 0 3 2 3.5 4l1 6c.4 3-2 4-4 2l-2-2h-7l-2 2c-2 2-4.4 1-4-2l1-6C4 9 5 7 7 7ZM6 11v5m-2.5-2.5h5m7-2h.1m2 3h.1',hanger:'M10 6a2 2 0 1 1 4 0c0 2-2 2-2 4l9 6v3H3v-3l9-6',town:'M3 21V9l6-4 6 4v12M6 11h1m4 0h1m-6 4h1m4 0h1m4-8 6 3v11H3m6-3v3m9-8h1m-1 4h1',music:'M9 18V5l11-2v13M9 8l11-2M9 18c0 2-2 3-4 3s-3-1-3-2 2-3 4-3 3 1 3 2Zm11-2c0 2-2 3-4 3s-3-1-3-2 2-3 4-3 3 1 3 2Z',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z',bell:'M18 8a6 6 0 0 0-12 0v5l-2 4h16l-2-4V8Zm-8 12h4',sun:'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',sunset:'M4 16a8 8 0 0 1 16 0M2 17h20M5 21h14M12 2v3M3 8l2 2m16-2-2 2',play:'m9 5 11 7-11 7V5Z',arrow:'M4 12h15m-6-6 6 6-6 6',sparkle:'m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z',lock:'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 5v2',close:'m6 6 12 12M6 18 18 6',info:'M12 10v7m0-10h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z',check:'m5 12 4 4L19 6',camera:'M8 5h8l2 3h4v13H2V8h4l2-3Zm4 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'};
paths.search='M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm5.5 13 5 5';
function icon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.sparkle}"/></svg>`;}
function icons(root=document){$$('[data-icon]',root).forEach(e=>e.innerHTML=icon(e.dataset.icon));}
icons();
const storageKey='synk-world-home-preview-v1';
const connectedWorld=window.__SYNK_WORLD_CONNECTED__===true;
const requestedGraphics=new URLSearchParams(location.search).get('graphics');
const graphicsVersion=['1','2'].includes(requestedGraphics)?requestedGraphics:'3';
document.documentElement.dataset.graphics=graphicsVersion;
let storageAvailable=true;
let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch{storageAvailable=false;}
const state={outfit:!connectedWorld&&WARDROBE_OUTFITS.includes(saved.outfit)?saved.outfit:'none',time:saved.time==='sunset'?'sunset':'day',reduced:typeof saved.reduced==='boolean'?saved.reduced:matchMedia('(prefers-reduced-motion:reduce)').matches,quality:['balanced','detail','light'].includes(saved.quality)?saved.quality:'balanced'};
state.dyes=connectedWorld?{}:normalizeEditState({slots:slotsForOutfit(state.outfit),dyes:saved.dyes}).dyes;
state.wardrobeLooks=Array.isArray(saved.wardrobeLooks)?saved.wardrobeLooks.filter(l=>typeof l?.id==='string'&&typeof l.name==='string'&&l.name.length<=40&&l.slots).slice(0,12).map(l=>({...l,...normalizeEditState(l)})):[];
state.view = 'home'; // A new visit opens the composed home, never a saved crop.
function save(){try{localStorage.setItem(storageKey,JSON.stringify(connectedWorld?{time:state.time,reduced:state.reduced,quality:state.quality}:state));}catch{storageAvailable=false;}}
let scene=null,sceneToken=0,sceneStatus='loading',toastTimer,activePanel='',lastFocus=null,externalScenePaused=false,panelResource=null;
const panel=$('#panel'),content=$('#panel-content');
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('is-visible'),3000);}
function applyLayout(){document.documentElement.dataset.layout=location.pathname.includes('mobile')||innerWidth<800?'mobile':'desktop';}
window.addEventListener('resize',applyLayout,{passive:true});
$('#today-label').textContent=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
function applyState(){
  document.documentElement.dataset.reduced=String(state.reduced);
  $('.hero').dataset.time=state.time;
  $('.hero').dataset.view=state.view;
  const viewButton=$('[data-action="view"]');
  viewButton.hidden=graphicsVersion!=='3';
  viewButton.setAttribute('aria-pressed',String(state.view==='detail'));
  viewButton.setAttribute('aria-label',state.view==='detail'?'테라스 기본 시점으로 돌아가기':'몽글과 옷감을 가까이 보기');
  $('span:last-child',viewButton).textContent=state.view==='detail'?'기본 시점':'가까이';
  $('#place-label').textContent=state.time==='day'?'낮 테라스':'노을 테라스';
  $('#outfit-caption').textContent=`지금 차림 · ${outfitLabel(slotsForOutfit(state.outfit))}`;
  $$('.time-control button').forEach(b=>{b.classList.toggle('is-active',b.dataset.time===state.time);b.setAttribute('aria-pressed',String(b.dataset.time===state.time));});
  scene?.setTime(state.time);scene?.setOutfit(state.outfit);scene?.setDyes?.(state.dyes);scene?.setQuality?.(state.quality);scene?.setReducedMotion?.(state.reduced);scene?.setView?.(state.view);
}
function sceneAvailable(){return sceneStatus==='ready'&&!!scene&&!scene.metrics?.().contextLost;}
function setSceneStatus(value){
  sceneStatus=value;$('#home-scene').classList.toggle('scene-ready',value==='ready');
  $('#scene-loading').hidden=value!=='loading';$('#scene-recovery').hidden=value!=='unavailable';
  $$('[data-action="photo"],[data-action="greet"],[data-action="view"]').forEach(button=>{button.disabled=value!=='ready';});
}
async function initScene(){
  const token=++sceneToken;scene?.dispose();scene=null;
  setSceneStatus('loading');
  try{
    const {mountHomeScene}=await import(graphicsVersion==='3'?'./scene-v3.mjs':graphicsVersion==='2'?'./scene-v2.mjs':'./scene.mjs');
    if(token!==sceneToken)return;
    let failed=false;
    const next=await mountHomeScene($('#home-scene'),{reducedMotion:state.reduced,quality:state.quality,onError:()=>{failed=true;if(token===sceneToken)setSceneStatus('unavailable');}});
    if(token!==sceneToken){next?.dispose();return;}
    scene=next;applyState();scene.setActive?.(!panel.open&&!externalScenePaused);setSceneStatus(failed?'unavailable':'ready');
  }catch(e){if(token!==sceneToken)return;setSceneStatus('unavailable');console.warn('3D preview unavailable',e.message);}
}
applyState();initScene();
function setNav(name){$$('[data-nav]').forEach(b=>{b.classList.toggle('is-active',b.dataset.nav===name);if(b.dataset.nav===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});}
function stopMedia(){panelResource?.dispose();panelResource=null;$$('video,audio',content).forEach(m=>{m.pause();m.removeAttribute('src');m.load();});const frame=$('iframe',content);if(frame)frame.src='about:blank';}
function openPanel(title,html,{type='',eyebrow='SYNK WORLD'}={}){stopMedia();lastFocus=panel.open?lastFocus:document.activeElement;panel.classList.toggle('game-dialog',type==='game');panel.classList.toggle('wardrobe-dialog',['wardrobe','world-wardrobe'].includes(type));$('#panel-title').textContent=title;$('#panel-eyebrow').textContent=eyebrow;content.innerHTML=html;icons(content);activePanel=type;panel.scrollTop=0;if(!panel.open)panel.showModal();scene?.setActive?.(false);$('.dialog-close').focus({preventScroll:true});}
function closePanel(){stopMedia();panel.close();activePanel='';content.innerHTML='';setNav('home');scene?.setActive?.(!externalScenePaused);lastFocus?.focus({preventScroll:true});}
function photo({verified=false,items=[]}={}){
  if(!sceneAvailable()){toast('3D 화면이 뜬 뒤에 사진을 찍을 수 있어요.');return;}
  try{
    const data=scene.capture({highResolution:true}),timeLabel=state.time==='sunset'?'해 질 무렵':'맑은 오후';
    if(!data.startsWith('data:image/png;base64,'))throw Error('CAPTURE_UNAVAILABLE');
    const names=items.filter(name=>typeof name==='string').map(name=>name.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
    openPanel('테라스 사진',`<figure class="home-photo"><img src="${data}" alt="${timeLabel}, 지금 차림의 몽글과 테라스"><figcaption>${timeLabel} · ${verified?'저장된 내 차림':'둘러보기 차림'}</figcaption></figure><p class="photo-outfit">${names.length?names.join(' · '):$('#outfit-caption').textContent}</p><p class="dialog-note">지금 보고 있던 3D 풍경을 사진으로 담았어요. 사진에는 계정 정보가 들어가지 않아요.</p><div class="dialog-actions"><button class="plain-button" data-action="close">홈으로 돌아가기</button><a class="felt-button photo-download" href="${data}" download="SYNK-WORLD-${state.time}-${new Date().toISOString().slice(0,10)}.png">사진 저장하기 <span data-icon="camera"></span></a></div>`,{type:'photo',eyebrow:'PHOTO'});
  }catch{toast('사진을 만들지 못했어요. 화면을 다시 연 뒤 시도해 주세요.');}
}
$('.dialog-close').addEventListener('click',closePanel);
panel.addEventListener('cancel',e=>{e.preventDefault();closePanel();});
panel.addEventListener('click',e=>{if(e.target===panel){const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel();}});
const games={runner:{title:'바람길',description:'짧은 한국어 부탁을 듣고 그대로 움직여요. 방향·동작·순서를 잘 들어요.',area:'TOPIK I 듣기 연습',time:'한 판 90초',image:'assets/runner.jpg',url:'/korean-runner/'},rhythm:{title:'말의 리듬',description:'노래에 맞춰 단추를 누르고, 들은 문장이 맞으면 O, 아니면 X를 골라요. 박자 점수와 답은 따로 나와요.',area:'짧은 문장 듣기',time:'곡 선택',image:'assets/rhythm.webp',url:'/korean-rhythm/'}};
function gameDetail(id){const g=games[id];if(!g)return;setNav('games');openPanel(g.title,`<img class="game-detail-image" src="${g.image}" alt="${g.title} 화면"><div class="detail-meta"><span>${g.time}</span><span>${g.area}</span></div><p class="panel-description">${g.description}</p><div class="dialog-actions"><button class="plain-button" data-action="close">나중에 할게요</button><button class="felt-button" data-launch="${id}"><span data-icon="play"></span>게임 시작하기</button></div>`,{type:'detail',eyebrow:'PLAY & LEARN'});}
function gameList(){setNav('games');openPanel('미니게임',`<p class="panel-description">들은 대로 움직이는 바람길, 박자에 맞춰 답하는 말의 리듬이 있어요.</p>${Object.entries(games).map(([id,g])=>`<button class="game-list-item" data-game="${id}"><img src="${g.image}" alt=""><div><h3>${g.title}</h3><p>${g.time} · ${g.area}</p></div><span data-icon="arrow"></span></button>`).join('')}`,{type:'games',eyebrow:'PLAY & LEARN'});}
function wardrobe(){
  setNav('wardrobe');openPanel('옷장','',{type:'wardrobe',eyebrow:'MY WARDROBE'});
  const previewSnapshot=()=>({accountId:'home-preview',revision:0,temporary:!storageAvailable,avatar:normalizeEditState({slots:slotsForOutfit(state.outfit),dyes:state.dyes}),inventory:WARDROBE_ITEMS.map(i=>({itemId:i.id})),looks:state.wardrobeLooks});
  const studio=createWardrobeStudio({snapshot:previewSnapshot(),preview:true,reducedMotion:state.reduced,
    onEquip:async(slots,dyes={})=>{const edit=normalizeEditState({slots,dyes});state.outfit=outfitForSlots(edit.slots);state.dyes=edit.dyes;save();applyState();return previewSnapshot();},
    onSaveLooks:async records=>{state.wardrobeLooks=records.map(record=>({...record,...normalizeEditState(record),createdAt:state.wardrobeLooks.find(l=>l.id===record.id)?.createdAt||new Date().toISOString()}));save();return previewSnapshot();},
  });
  content.append(studio.element);panelResource=studio;
}
function town(){setNav('town');openPanel('싱크타운',`<img class="town-preview" src="assets/town.webp" alt="도서관이 있는 마을 광장 그림"><p class="panel-description">내 차림 그대로 동네를 걷고 이웃과 이야기하는 곳이에요.</p><ol class="steps"><li>쉬운 한국어부터 배워요.</li><li>TOPIK 1급 이상을 확인받아요.</li><li>이용권이 있으면 타운에 들어가요.</li></ol><p class="dialog-note">지금은 타운 입구의 미리보기예요. 실제 학습 기록이나 이용권을 확인한 상태는 아니에요.</p><div class="dialog-actions"><button class="felt-button" data-action="hangul">한글부터 시작하기<span data-icon="arrow"></span></button></div>`,{type:'town',eyebrow:'SYNK TOWN'});}
const songs={ 'vowel-dance':{name:'모음 댄스',text:'노래를 따라 부르며 모음 글자와 소리를 익혀요.',file:'vowel-dance'},'geu-a-ga':{name:'그 아 가',text:'자음과 모음이 만나 한 글자가 되는 걸 노래로 배워요.',file:'geu-a-ga'},batchim:{name:'받침 노래',text:'글자 아래 받침이 붙으면 소리가 어떻게 바뀌는지 들어요.',file:'batchim'}};
function playSong(id){const s=songs[id];if(!s)return;setNav('songs');openPanel(s.name,`<video class="song-video" controls playsinline preload="metadata" aria-label="${s.name} 한국어 학습 영상" src="assets/videos/${s.file}.mp4"></video><p class="video-description">${s.text}</p><p class="dialog-note">영상 속 글자를 보면서 따라 불러요. 여기서 본 영상은 학습 기록에 남지 않아요.</p><div class="video-error" role="status" hidden><p class="panel-description">영상을 불러오지 못했어요. 잠시 후 다시 열어주세요.</p></div>`,{type:'song',eyebrow:'SING ALONG'});const v=$('video',content);v.addEventListener('error',()=>{$('.video-error',content).hidden=false;});v.play().catch(()=>{});}
function settings(){openPanel('화면 설정',`<p class="panel-description">홈 화면의 선명도와 움직임을 바꿔요.</p>${graphicsVersion==='3'?`<fieldset class="quality-setting"><legend>홈 화면 선명도</legend><div class="quality-options">${[{id:'light',name:'가볍게',hint:'휴대폰이나 오래 쓸 때'},{id:'balanced',name:'균형',hint:'기본 설정'},{id:'detail',name:'선명하게',hint:'질감과 그림자를 또렷하게'}].map(option=>`<button data-quality="${option.id}" aria-pressed="${state.quality===option.id}"><strong>${option.name}</strong><small>${option.hint}</small></button>`).join('')}</div><p class="quality-note">홈의 선명도만 조절해요. 선명하게 볼수록 기기 부하가 커질 수 있어요.</p></fieldset>`:''}<label class="settings-row"><span><strong>움직임 줄이기</strong><small>몽글과 소품의 반복 움직임을 줄여요.</small></span><input id="motion-setting" type="checkbox" ${state.reduced?'checked':''}></label><div class="settings-row"><span><strong>테라스 시간</strong><small>낮과 노을 중에 골라요.</small></span><button class="plain-button" data-action="toggle-time">${state.time==='day'?'노을로 보기':'낮으로 보기'}</button></div><div class="setting-links"><a class="plain-button" href="mobile.html">휴대폰 화면</a><a class="plain-button" href="desktop.html">PC 화면</a></div>`,{type:'settings',eyebrow:'SETTINGS'});}
function about(){openPanel('홈 시안 안내',`<div class="review-note"><p><strong>해 볼 수 있는 것</strong><br>테라스의 낮과 노을, 몽글 인사, 시연용 차림, 미니게임 두 개, 한글 노래 영상.</p><p><strong>아직 없는 것</strong><br>3D 몽글과 옷은 시안이에요. 계정 보상과 타운 입장은 이 화면에서 되지 않아요.</p><p>휴대폰 화면과 PC 화면은 같은 차림 설정을 써요. 설정은 이 기기에만 저장하고 계정 정보는 받지 않아요.</p></div>`,{type:'about'});}
function nav(name){if(name==='home'){if(panel.open)closePanel();window.scrollTo({top:0,behavior:state.reduced?'instant':'smooth'});setNav('home');}else if(name==='wardrobe')wardrobe();else if(name==='town')town();else if(name==='games'){if(panel.open)closePanel();$('#games-section').scrollIntoView({behavior:state.reduced?'instant':'smooth',block:'start'});setNav('games');}else if(name==='songs'){if(panel.open)closePanel();$('#songs-section').scrollIntoView({behavior:state.reduced?'instant':'smooth',block:'start'});setNav('songs');}}
const actions={wardrobe,settings,town,photo:()=>photo(),games:gameList,about,close:closePanel,quickplay:()=>gameDetail('runner'),greet:()=>{scene?.greet();toast('몽글이 반갑게 인사해요.');},'toggle-time':()=>{state.time=state.time==='day'?'sunset':'day';save();applyState();settings();},hangul:()=>{openPanel('한글부터 시작하기','<iframe class="game-frame" title="한글 만나기" src="/hangul-stage/" allow="autoplay; fullscreen" allowfullscreen></iframe>',{type:'game'});},notifications:()=>{openPanel('새 소식',`<div class="game-list-item"><span class="song-letter coral">옷</span><div><h3>옷장이 열렸어요</h3><p>목도리와 앞치마를 입혀 보세요.</p></div></div><div class="game-list-item"><span class="song-letter blue">노</span><div><h3>노래로 배우는 한글</h3><p>노래 영상 세 개를 볼 수 있어요.</p></div></div><p class="dialog-note">홈 시안에서 볼 수 있는 것들이에요.</p>`,{type:'news'});$('.notification-dot').hidden=true;},profile:()=>{openPanel('내 프로필',`<div class="profile-view"><img src="assets/mongle-smile.webp" alt="눈웃음 짓는 몽글"><h3>반가워요!</h3><p>로그인 없이 둘러보는 홈 시안이에요.</p></div><div class="dialog-actions"><button class="felt-button" data-action="wardrobe">옷장 열기</button></div>`,{type:'profile'});}};
actions.view=()=>{if(!sceneAvailable()||!scene?.setView)return;state.view=state.view==='home'?'detail':'home';applyState();};
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.action){actions[b.dataset.action]?.();return;}
  if(b.dataset.nav){nav(b.dataset.nav);return;}
  if(b.dataset.quality){if(!['balanced','detail','light'].includes(b.dataset.quality))return;state.quality=b.dataset.quality;save();scene?.setQuality?.(state.quality);$$('[data-quality]',content).forEach(option=>option.setAttribute('aria-pressed',String(option.dataset.quality===state.quality)));return;}
  if(b.dataset.time){state.time=b.dataset.time;save();applyState();return;}
  if(b.dataset.game){gameDetail(b.dataset.game);return;}
  if(b.dataset.launch){const g=games[b.dataset.launch];if(g)openPanel(g.title,`<iframe class="game-frame" title="${g.title} 게임" src="${g.url}" allow="autoplay; fullscreen" allowfullscreen></iframe>`,{type:'game'});return;}
  if(b.dataset.song){playSong(b.dataset.song);return;}
  if(b.dataset.outfit){state.outfit=b.dataset.outfit;state.dyes={};save();applyState();$$('[data-outfit]',content).forEach(x=>{x.setAttribute('aria-pressed',String(x.dataset.outfit===state.outfit));$('small',x).textContent=x.dataset.outfit===state.outfit?'지금 입은 차림':'입어보기';});toast('차림을 바꿨어요. 테라스의 몽글도 같은 옷을 입어요.');}
});
document.addEventListener('change',e=>{if(e.target.id==='motion-setting'){state.reduced=e.target.checked;save();applyState();if(scene?.setReducedMotion)scene.setReducedMotion(state.reduced);else if(sceneStatus!=='loading')initScene();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)$$('video,audio',content).forEach(m=>m.pause());});
$('#scene-retry').addEventListener('click',()=>initScene());
window.addEventListener('pagehide',()=>{++sceneToken;stopMedia();scene?.dispose();scene=null;sceneStatus='loading';});
window.addEventListener('pageshow',e=>{if(e.persisted)initScene();});
window.addEventListener('storage',e=>{if(e.key!==storageKey)return;try{const other=JSON.parse(e.newValue||'{}');if(!connectedWorld&&WARDROBE_OUTFITS.includes(other.outfit)){state.outfit=other.outfit;state.dyes=normalizeEditState({slots:slotsForOutfit(state.outfit),dyes:other.dyes}).dyes;}if(['day','sunset'].includes(other.time))state.time=other.time;if(['balanced','detail','light'].includes(other.quality))state.quality=other.quality;applyState();}catch{}});
window.__synkHome={state,sceneMetrics:()=>scene?.metrics(),sceneAvailable,openPanel:()=>activePanel,
  showPanel:openPanel,closePanel,toast,showPhoto:photo,captureFrame:()=>sceneAvailable()?scene.capture():null,
  captureLook(slots,dyes={}){if(!sceneAvailable())return null;const before={outfit:scene.metrics().outfit,dyes:scene.getDyes?.()||{}};try{const edit=normalizeEditState({slots,dyes});scene.setOutfit(outfitForSlots(edit.slots));scene.setDyes?.(edit.dyes);return scene.capture();}finally{scene.setOutfit(before.outfit);scene.setDyes?.(before.dyes);}},
  attachPanelResource(resource){panelResource?.dispose();panelResource=resource;},
  wardrobeMetrics:()=>panelResource?.metrics?.(),
  setSceneActive(active){externalScenePaused=!active;scene?.setActive?.(active&&!panel.open);},
  setEquipment(slots,dyes={}){const edit=normalizeEditState({slots,dyes});state.outfit=outfitForSlots(edit.slots);state.dyes=edit.dyes;applyState();},
};
if(!connectedWorld&&new URLSearchParams(location.search).get('wardrobe')==='1')wardrobe();
