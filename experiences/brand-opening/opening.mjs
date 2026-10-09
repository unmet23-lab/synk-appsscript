const SEEN='synk.brand-opening.v1.seen';
const asset=name=>new URL(`./assets/${name}`,import.meta.url).href;

/** Shared company splash. Product hosts own loading, sign-in, and launch. */
export function mountBrandOpening({product='SYNK WORLD',replay=false,companyOnly=false,reducedMotion=false,onEnter=()=>{}}={}){
  const cover=document.querySelector('#synk-opening-cover');
  const removeCover=()=>{cover?.remove();clearTimeout(window.__synkOpeningSafetyTimer);};
  let previouslySeen=false;try{previouslySeen=sessionStorage.getItem(SEEN)==='1';}catch{}
  const query=new URLSearchParams(location.search);
  if(query.get('opening')==='off'||(!replay&&previouslySeen&&query.get('opening')!=='replay')){removeCover();return {done:Promise.resolve('return'),destroy:()=>{},stage:()=> 'closed'};}
  const reduced=reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dialog=document.createElement('dialog');dialog.className='synk-opening';dialog.dataset.stage='company';dialog.dataset.reduced=String(reduced);dialog.setAttribute('aria-label',`${product} 시작 화면`);dialog.tabIndex=-1;
  dialog.innerHTML=`<section class="opening-company" aria-label="제작사 SYNK"><div class="opening-light" aria-hidden="true"></div><div class="opening-company-lockup"><img class="opening-wordmark" src="${asset('synk-paper.webp')}" alt="synk" width="1100" height="541"><p class="opening-credit">CREATED BY SYNK</p></div></section><section class="opening-title" aria-labelledby="opening-world-title" hidden><picture><source media="(max-width:799px)" srcset="${asset('felt-world-scene-mobile-v6.webp')}"><img class="opening-title-scene" src="${asset('felt-world-scene-desktop-v6.webp')}" alt="한옥과 한강·남산을 배경으로 함께 모인 펠트 몽글·까몽·마린"></picture><video class="opening-title-video" muted loop playsinline preload="none" aria-hidden="true"></video><div class="opening-title-shade" aria-hidden="true"></div><div class="opening-title-copy"><img class="opening-title-logo" src="${asset('synk-paper.webp')}" alt="synk" width="1100" height="541"><h1 class="opening-world" id="opening-world-title">WORLD</h1><p class="opening-title-subtitle">몽글과, 나의 작은 세계.</p></div></section><button class="opening-enter" type="button" aria-label="오프닝 건너뛰기"><span class="opening-hint" hidden>화면을 터치해 주세요</span></button><div class="opening-controls"><button class="opening-sound" type="button" aria-pressed="false" aria-label="소리 켜기" title="소리 켜기"><img class="opening-sound-icon" src="${asset('sound-off.webp')}" alt="" aria-hidden="true"></button></div><p class="opening-copyright">© 2027 SYNK</p>`;
  // Product names are text, never interpolated markup or a false engine badge.
  if(product!=='SYNK WORLD')dialog.querySelector('.opening-world').textContent=product;
  const audio=new Audio(asset('opening-candidate.wav'));audio.preload='none';
  const video=dialog.querySelector('.opening-title-video'),viewport=matchMedia('(max-width:799px)');video.muted=true;video.playsInline=true;
  let stage='company',settled=false,timer,hideTimer,soundOn=false,playAttempt=0;
  const motionRequested=!reduced;
  let resolveDone;const done=new Promise(resolve=>{resolveDone=resolve;});
  const previousFocus=document.activeElement;
  const previousBodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const soundButton=dialog.querySelector('.opening-sound'),enter=dialog.querySelector('.opening-enter'),hint=dialog.querySelector('.opening-hint');
  hint.textContent=matchMedia('(pointer:coarse)').matches?'화면을 터치해 주세요':'화면을 클릭해 주세요';
  const stopAudio=()=>{audio.pause();try{audio.currentTime=0;}catch{}};
  const updateSound=()=>{soundButton.querySelector('img').src=asset(soundOn?'sound-on.webp':'sound-off.webp');soundButton.setAttribute('aria-pressed',String(soundOn));soundButton.setAttribute('aria-label',soundOn?'소리 끄기':'소리 켜기');soundButton.title=soundOn?'소리 끄기':'소리 켜기';};
  const playSound=()=>{if(!soundOn||document.hidden||settled)return;stopAudio();audio.play().catch(()=>{soundOn=false;updateSound();});};
  function finish(reason='start'){
    if(settled)return;settled=true;stage='closed';playAttempt++;clearTimeout(timer);clearTimeout(hideTimer);stopAudio();video.pause();video.removeAttribute('src');video.load();viewport.removeEventListener('change',onViewport);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',onPageHide);dialog.removeEventListener('cancel',onCancel);
    if(!replay&&!companyOnly&&!['pagehide','destroy','unavailable'].includes(reason)){try{sessionStorage.setItem(SEEN,'1');}catch{}}
    if(dialog.open)dialog.close();dialog.remove();removeCover();document.body.style.overflow=previousBodyOverflow;
    if(previousFocus?.isConnected&&previousFocus!==document.body)previousFocus.focus({preventScroll:true});
    resolveDone(reason);try{onEnter(reason);}catch(error){console.error('Opening handoff:',error);}
  }
  function title(){
    if(settled||stage!=='company')return;
    if(companyOnly){finish('company-end');return;}
    stage='title';dialog.dataset.stage='title';dialog.querySelector('.opening-title').hidden=false;dialog.querySelector('.opening-company').setAttribute('aria-hidden','true');enter.setAttribute('aria-label',`${product} 시작하기`);hint.hidden=false;
    hideTimer=setTimeout(()=>{if(!settled)dialog.querySelector('.opening-company').hidden=true;},470);
    playVideo();
  }
  function playVideo(){
    if(settled||!motionRequested||stage!=='title'||document.hidden)return;
    const source=asset(viewport.matches?'world-menu-mobile-omni11-v6-web.mp4':'world-menu-desktop-omni11-v6-web.mp4');
    if(video.src!==source||video.error){dialog.classList.remove('video-ready');video.src=source;video.load();}
    const attempt=++playAttempt;dialog.dataset.videoState='loading';
    video.play().catch(()=>{
      if(settled||attempt!==playAttempt||!motionRequested||document.hidden)return;
      dialog.dataset.videoState='blocked';
    });
  }
  const onViewport=()=>{playAttempt++;video.pause();dialog.classList.remove('video-ready');dialog.dataset.videoState='poster';playVideo();};
  const onVisibility=()=>{
    if(document.hidden){playAttempt++;stopAudio();video.pause();if(motionRequested)dialog.dataset.videoState='suspended';}
    else playVideo();
  };
  const onPageHide=()=>finish('pagehide');
  const onCancel=event=>{event.preventDefault();finish('skip');};
  soundButton.addEventListener('click',()=>{soundOn=!soundOn;updateSound();if(soundOn)playSound();else stopAudio();if(video.paused)playVideo();});
  const enterWorld=()=>finish(stage==='company'?'skip':'start');
  enter.addEventListener('click',enterWorld);
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Tab')dialog.dataset.keyboard='true';
    if(event.target===dialog&&['Enter',' '].includes(event.key)){event.preventDefault();enterWorld();}
  });
  dialog.addEventListener('pointerdown',()=>{delete dialog.dataset.keyboard;});
  dialog.addEventListener('cancel',onCancel);document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pagehide',onPageHide);
  viewport.addEventListener('change',onViewport);
  video.addEventListener('playing',()=>{
    if(settled||!motionRequested||stage!=='title'||document.hidden){video.pause();return;}
    dialog.classList.add('video-ready');dialog.dataset.videoState='playing';
  });
  video.addEventListener('error',()=>{if(settled)return;playAttempt++;dialog.classList.remove('video-ready');video.pause();dialog.dataset.videoState='error';});
  dialog.querySelector('.opening-wordmark').addEventListener('error',()=>title(),{once:true});
  dialog.querySelector('.opening-title-scene').addEventListener('error',event=>{event.target.src=asset('mongle.webp');event.target.style.objectFit='contain';event.target.style.padding='120px 32px';event.target.alt='반갑게 웃는 몽글';},{once:true});
  document.body.append(dialog);
  try{dialog.showModal();}catch{finish('unavailable');return {done,destroy:finish,stage:()=>stage};}
  removeCover();dialog.focus({preventScroll:true});timer=setTimeout(title,reduced?240:2600);
  return {done,destroy:()=>finish('destroy'),stage:()=>stage,audioStatus:()=>({enabled:soundOn,paused:audio.paused,currentTime:audio.currentTime,duration:Number.isFinite(audio.duration)?audio.duration:null}),videoStatus:()=>({paused:video.paused,currentTime:video.currentTime,duration:Number.isFinite(video.duration)?video.duration:null,source:video.currentSrc,reduced,motionRequested,state:dialog.dataset.videoState||'poster'})};
}
