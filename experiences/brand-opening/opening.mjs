import {motionOn,spring,ink,dust,bindPress} from './world-motion.mjs';
// 화면 언어(10-19 1판): 고른 언어가 있으면 부제·시작 단추·소리 단추를 그 언어로. 고르기 전에는 한국어 원문이다.
import {t} from './world-lang.mjs';
const SEEN='synk.brand-opening.v1.seen';
const asset=name=>new URL(`./assets/${name}`,import.meta.url).href;

/** Shared company splash. Product hosts own loading, sign-in, and launch. */
export function mountBrandOpening({product='SYNK WORLD',replay=false,companyOnly=false,reducedMotion=false,onEnter=()=>{}}={}){
  const cover=document.querySelector('#synk-opening-cover');
  const removeCover=()=>{cover?.remove();clearTimeout(window.__synkOpeningSafetyTimer);};
  let previouslySeen=false;try{previouslySeen=sessionStorage.getItem(SEEN)==='1';}catch{}
  const query=new URLSearchParams(location.search);
  if(!replay&&(query.get('opening')==='off'||(previouslySeen&&query.get('opening')!=='replay'))){removeCover();return {done:Promise.resolve('return'),destroy:()=>{},stage:()=> 'closed'};}
  const reduced=reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dialog=document.createElement('dialog');dialog.className='synk-opening';dialog.dataset.stage='company';dialog.dataset.reduced=String(reduced);dialog.setAttribute('aria-label',t('opening.dialog',{product}));dialog.tabIndex=-1;
  dialog.innerHTML=`<section class="opening-company" aria-label="${t('opening.company')}"><div class="opening-light" aria-hidden="true"></div><div class="opening-company-lockup"><img class="opening-wordmark" src="${asset('synk-paper.webp')}" alt="synk" width="1100" height="541"><p class="opening-credit">CREATED BY SYNK</p></div></section><section class="opening-title" aria-labelledby="opening-world-title" hidden><picture><source media="(orientation:portrait)" srcset="${asset('world-title-letters-port-v1.webp')}"><img class="opening-title-scene" src="${asset('world-title-letters-land-v1.webp')}" alt="${t('opening.titleAlt')}"></picture><video class="opening-title-video" muted loop playsinline preload="none" aria-hidden="true"></video><div class="opening-title-shade" aria-hidden="true"></div><div class="opening-title-copy"><img class="opening-title-logo" src="${asset('home/logo.webp')}" alt="synk" width="744" height="360"><h1 class="opening-world" id="opening-world-title">WORLD</h1><p class="opening-title-subtitle">${t('opening.subtitle')}</p></div></section><button class="opening-enter" type="button" aria-label="${t('opening.skip')}"><span class="opening-hint" hidden>${t('opening.start')}</span></button><div class="opening-controls"><button class="opening-sound" type="button" aria-pressed="false" aria-label="${t('opening.soundOn')}" title="${t('opening.soundOn')}"><img class="opening-sound-icon" src="${asset('sound-off.webp')}" alt="" aria-hidden="true"></button></div><p class="opening-copyright">© 2026 SYNK</p>`;
  // Product names are text, never interpolated markup or a false engine badge.
  if(product!=='SYNK WORLD')dialog.querySelector('.opening-world').textContent=product;
  const audio=new Audio(asset('opening-candidate.wav'));audio.preload='none';
  dialog.querySelector('picture source').media='(orientation:portrait)';
  const video=dialog.querySelector('.opening-title-video'),viewport=matchMedia('(orientation:portrait)');video.muted=true;video.playsInline=true;
  let resumeTime=0;
  let stage='company',settled=false,timer,hideTimer,soundOn=false,playAttempt=0;
  // 10-14 펠트 한글 놀이터(유호님 「첫 화면 3번」): 정지 사진 한 장. 타이틀 위에서 도는 영상은 쓰지 않는다(멀미 기준).
  const motionRequested=false;
  let resolveDone;const done=new Promise(resolve=>{resolveDone=resolve;});
  const previousFocus=document.activeElement;
  const previousBodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const soundButton=dialog.querySelector('.opening-sound'),enter=dialog.querySelector('.opening-enter'),hint=dialog.querySelector('.opening-hint');
  hint.textContent=t('opening.start');
  const stopAudio=()=>{audio.pause();try{audio.currentTime=0;}catch{}};
  const updateSound=()=>{soundButton.querySelector('img').src=asset(soundOn?'sound-on.webp':'sound-off.webp');soundButton.setAttribute('aria-pressed',String(soundOn));soundButton.setAttribute('aria-label',t(soundOn?'opening.soundOff':'opening.soundOn'));soundButton.title=t(soundOn?'opening.soundOff':'opening.soundOn');};
  const playSound=()=>{if(!soundOn||document.hidden||settled)return;stopAudio();audio.play().catch(()=>{soundOn=false;updateSound();});};
  function finish(reason='start'){
    const sceneTime=Number.isFinite(video.currentTime)&&video.currentTime>0?video.currentTime:resumeTime;
    if(settled)return;settled=true;stage='closed';playAttempt++;clearTimeout(timer);clearTimeout(hideTimer);stopAudio();video.pause();video.removeAttribute('src');video.load();viewport.removeEventListener('change',onViewport);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',onPageHide);dialog.removeEventListener('cancel',onCancel);
    if(!replay&&!companyOnly&&!['pagehide','destroy','unavailable'].includes(reason)){try{sessionStorage.setItem(SEEN,'1');}catch{}}
    if(dialog.open)dialog.close();dialog.remove();removeCover();document.body.style.overflow=previousBodyOverflow;
    if(previousFocus?.isConnected&&previousFocus!==document.body)previousFocus.focus({preventScroll:true});
    resolveDone(reason);try{onEnter(reason,{sceneTime});}catch(error){console.error('Opening handoff:',error);}
  }
  function title(){
    if(settled||stage!=='company')return;
    if(companyOnly){finish('company-end');return;}
    stage='title';dialog.dataset.stage='title';dialog.querySelector('.opening-title').hidden=false;dialog.querySelector('.opening-company').setAttribute('aria-hidden','true');enter.setAttribute('aria-label',t('opening.startProduct',{product}));hint.hidden=false;
    hideTimer=setTimeout(()=>{if(!settled)dialog.querySelector('.opening-company').hidden=true;},470);
    playVideo();titleMotion();
  }
  // 10-17 움직임(유호님 「시안에 있는 움직임 전부」): 사진은 천천히 다가가고, 로고는 꾹, WORLD는 한 자씩, 부제는 잉크처럼 차오른다. 빛 알갱이가 떠오르고 시작 알약엔 빛이 스친다.
  function titleMotion(){
    if(reduced||!motionOn())return;
    const section=dialog.querySelector('.opening-title');
    section.querySelector('.opening-title-scene')?.classList.add('w-drift');
    spring(section.querySelector('.opening-title-logo'),[{opacity:0,transform:'scale(1.4)',filter:'blur(10px)'},{opacity:1,transform:'scale(.965)',filter:'blur(0px)',offset:.62},{transform:'scale(1.01)',offset:.82},{transform:'scale(1)'}],{duration:1000,delay:120});
    const world=section.querySelector('.opening-world');
    if(product==='SYNK WORLD'&&world){world.textContent='';for(const ch of 'WORLD'){const span=document.createElement('span');span.className='opening-world-letter';span.textContent=ch;world.append(span);}
     world.querySelectorAll('span').forEach((span,i)=>spring(span,[{opacity:0,transform:'translateY(9px)',filter:'blur(4px)'},{opacity:1,transform:'none',filter:'blur(0px)'}],{duration:620,delay:620+i*95}));}
    ink(section.querySelector('.opening-title-subtitle'),{delay:1150,from:150});
    dust(section,{after:section.querySelector('picture')});
    hint.classList.add('w-sheen');
  }
  function playVideo(){
    if(settled||!motionRequested||stage!=='title'||document.hidden)return;
    const source=asset(viewport.matches?'world-menu-mobile-stable-v10-web.mp4':'world-menu-desktop-stable-v10-web.mp4');
    if(video.src!==source||video.error){dialog.classList.remove('video-ready');video.src=source;video.load();}
    const attempt=++playAttempt;dialog.dataset.videoState='loading';
    video.play().catch(()=>{
      if(settled||attempt!==playAttempt||!motionRequested||document.hidden)return;
      dialog.dataset.videoState='blocked';
    });
  }
  const onViewport=()=>{resumeTime=video.currentTime||resumeTime;playAttempt++;video.pause();dialog.classList.remove('video-ready');dialog.dataset.videoState='poster';playVideo();};
  const onVisibility=()=>{
    if(document.hidden){playAttempt++;stopAudio();video.pause();if(motionRequested)dialog.dataset.videoState='suspended';}
    else playVideo();
  };
  const onPageHide=()=>finish('pagehide');
  const onCancel=event=>{event.preventDefault();finish('skip');};
  soundButton.addEventListener('click',()=>{soundOn=!soundOn;updateSound();if(soundOn)playSound();else stopAudio();if(video.paused)playVideo();});
  const enterWorld=()=>finish(stage==='company'?'skip':'start');
  enter.addEventListener('click',enterWorld);
  // 누르는 동안 시작 알약이 쏙 들어갔다 통 튀어나온다. 세로는 가운데 맞춤에 translateX(-50%)를, 가로는 transform 없이 놓이니 누르는 순간의 값을 기준으로 둔다.
  bindPress(dialog,'.opening-enter',{target:()=>hint.hidden?null:hint,base:b=>{const t=getComputedStyle(b).transform;return t&&t!=='none'?t:'';}});
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Tab')dialog.dataset.keyboard='true';
    if(event.target===dialog&&['Enter',' '].includes(event.key)){event.preventDefault();enterWorld();}
  });
  dialog.addEventListener('pointerdown',()=>{delete dialog.dataset.keyboard;});
  dialog.addEventListener('cancel',onCancel);document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pagehide',onPageHide);
  viewport.addEventListener('change',onViewport);
  video.addEventListener('loadedmetadata',()=>{if(resumeTime>0&&Number.isFinite(video.duration)&&video.duration>0){video.currentTime=resumeTime%video.duration;resumeTime=0;}});
  video.addEventListener('playing',()=>{
    if(settled||!motionRequested||stage!=='title'||document.hidden){video.pause();return;}
    dialog.classList.add('video-ready');dialog.dataset.videoState='playing';
  });
  video.addEventListener('error',()=>{if(settled)return;playAttempt++;dialog.classList.remove('video-ready');video.pause();dialog.dataset.videoState='error';});
  dialog.querySelector('.opening-wordmark').addEventListener('error',()=>title(),{once:true});
  // 사진을 못 받으면 같은 복숭아색 배경지만 남긴다(정본 마스코트 그림을 대신 얹지 않는다).
  dialog.querySelector('.opening-title-scene').addEventListener('error',event=>{event.target.hidden=true;},{once:true});
  document.body.append(dialog);
  try{dialog.showModal();}catch{finish('unavailable');return {done,destroy:finish,stage:()=>stage};}
  removeCover();dialog.focus({preventScroll:true});timer=setTimeout(title,reduced?240:2600);
  return {done,destroy:()=>finish('destroy'),stage:()=>stage,audioStatus:()=>({enabled:soundOn,paused:audio.paused,currentTime:audio.currentTime,duration:Number.isFinite(audio.duration)?audio.duration:null}),videoStatus:()=>({paused:video.paused,currentTime:video.currentTime,duration:Number.isFinite(video.duration)?video.duration:null,source:video.currentSrc,reduced,motionRequested,state:dialog.dataset.videoState||'poster'})};
}
