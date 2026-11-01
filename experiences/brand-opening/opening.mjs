import {motionOn,spring,ink,bindPress} from './world-motion.mjs';
// 화면 언어(10-19 1판): 고른 언어가 있으면 부제·단추·소리 단추를 그 언어로. 고르기 전에는 한국어 원문이다.
import {t} from './world-lang.mjs';
const SEEN='synk.brand-opening.v1.seen';
const asset=name=>new URL(`./assets/${name}`,import.meta.url).href;
// 11-01 실사 입구 임시 판(docs/WORLD_게임방향_재설계_20261031.md 9절 1단계 ② · 4-10 · 14절 ④ ⑤): 10-14 펠트 한글 놀이터 타이틀 대신
// 1화 장면 2의 공개 실사 그림(synk.im 홈·LAB과 같은 바이트) 위에 두 길 — 드라마 말하기 시범판, 로그인 뒤 펠트 동네(4단계 전까지 이전 판).
// 마스코트를 얹지 않고, 로고는 중립색 민판, 오프닝은 펠트 결 없는 글자 오프닝이다.
// 드라마 길: WORLD 안 시범판 화면(9절 1단계 ①)이 공개 주소를 얻기 전까지는 학생이 지금 열 수 있는 synk.im LAB의 1화 장면 2로 간다.
const DRAMA_URL='https://synk.im/lab/#drama';
const SCENE=['drama-s1e01-p11-hello-w800.webp','drama-s1e01-p11-hello.webp'];
// tools/lib/로고정본.js 워드마크({판:'다크',표현:'민'}) 그대로 — 단색, 실땀·펠트 결 없음.
const WORDMARK='<svg viewBox="-8 -2 169 116" role="img" aria-label="SYNK"><path d="M35.8 57.9 25.9 58.5Q25.5 56.6 23.8 55.3Q22.1 53.9 19.3 53.9Q16.7 53.9 15.0 55.0Q13.3 56.0 13.3 57.8Q13.3 59.2 14.4 60.2Q15.5 61.2 18.2 61.8L25.4 63.2Q31.1 64.3 33.9 66.9Q36.7 69.5 36.7 73.8Q36.7 77.7 34.5 80.6Q32.2 83.5 28.3 85.1Q24.4 86.8 19.3 86.8Q11.5 86.8 6.8 83.5Q2.2 80.2 1.4 74.6L12.1 74.1Q12.6 76.5 14.5 77.7Q16.3 78.9 19.3 78.9Q22.1 78.9 23.9 77.8Q25.7 76.7 25.7 75.0Q25.7 72.0 20.6 71.0L13.8 69.6Q8.1 68.5 5.3 65.6Q2.5 62.8 2.5 58.4Q2.5 54.6 4.5 51.9Q6.6 49.2 10.4 47.7Q14.1 46.2 19.1 46.2Q26.6 46.2 30.8 49.3Q35.1 52.5 35.8 57.9Z M44.0 100.7Q41.9 100.7 40.1 100.4Q38.3 100.1 37.1 99.6L39.6 91.5L39.9 91.6Q42.7 92.4 44.6 91.9Q46.6 91.5 47.6 88.8L48.2 87.1L34.1 46.7H45.6L53.7 75.6H54.1L62.3 46.7H73.8L58.6 90.3Q57.5 93.4 55.6 95.8Q53.7 98.1 50.9 99.4Q48.0 100.7 44.0 100.7Z M84.0 63.3V86.0H73.1V46.7H83.8V53.7H84.2Q85.5 50.2 88.4 48.2Q91.4 46.2 95.7 46.2Q99.8 46.2 102.9 48.0Q105.9 49.8 107.6 53.1Q109.3 56.4 109.3 61.0V86.0H98.4V62.9Q98.4 59.4 96.6 57.3Q94.7 55.2 91.4 55.2Q89.2 55.2 87.6 56.2Q85.9 57.2 84.9 59.0Q84.0 60.8 84.0 63.3Z" fill="#FFFFFF"/><path d="M117.3046875 86.0V33.6171875H126.55078125V62.48046875H127.21875L141.31640625 46.6953125H152.14453125L136.91339111328125 63.68389129638672L153.0234375 86.0H141.94921875L129.9180908203125 69.20931243896484L126.55078125 72.82667541503906V86.0Z" fill="#FFFFFF"/></svg>';
// 공개 직후 캐시에 옛 글 표(world-strings.mjs)가 남아 새 키가 없으면 키 이름 대신 한국어 원문을 보인다.
const say=(key,ko)=>{const text=t(key);return text===key?ko:text;};

/** Shared company splash. Product hosts own loading, sign-in, and launch. */
export function mountBrandOpening({product='SYNK WORLD',replay=false,companyOnly=false,reducedMotion=false,onEnter=()=>{}}={}){
  const cover=document.querySelector('#synk-opening-cover');
  const removeCover=()=>{cover?.remove();clearTimeout(window.__synkOpeningSafetyTimer);};
  let previouslySeen=false;try{previouslySeen=sessionStorage.getItem(SEEN)==='1';}catch{}
  const query=new URLSearchParams(location.search);
  if(!replay&&(query.get('opening')==='off'||(previouslySeen&&query.get('opening')!=='replay'))){removeCover();return {done:Promise.resolve('return'),destroy:()=>{},stage:()=> 'closed'};}
  const reduced=reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dialog=document.createElement('dialog');dialog.className='synk-opening';dialog.dataset.stage='company';dialog.dataset.entrance='drama';dialog.dataset.reduced=String(reduced);dialog.setAttribute('aria-label',t('opening.dialog',{product}));dialog.tabIndex=-1;
  // 장면 줄(선배 이름·대사)과 회차 이름은 이야기 내용이라 화면 언어와 상관없이 한국어다.
  dialog.innerHTML=`<section class="opening-company" aria-label="${t('opening.company')}"><div class="opening-light" aria-hidden="true"></div><div class="opening-company-lockup"><span class="opening-wordmark">${WORDMARK}</span><p class="opening-credit">CREATED BY SYNK</p></div></section><section class="opening-entrance" aria-labelledby="opening-world-title" hidden><figure class="entrance-scene"><img class="entrance-photo" src="${asset(SCENE[1])}" srcset="${asset(SCENE[0])} 800w, ${asset(SCENE[1])} 1200w" sizes="(orientation:landscape) 60vw, 100vw" width="1200" height="1500" decoding="async" alt="${say('opening.entrance.alt','학생 식당에서 식판을 내려놓으며 반갑게 손을 드는 권태오 선배')}"><p class="entrance-episode" lang="ko">1화 · 개강 첫날</p><figcaption class="entrance-line" lang="ko"><small>권태오 선배</small><span>저기, 혹시 신입생이에요?</span></figcaption></figure><div class="entrance-copy"><h1 class="entrance-title" id="opening-world-title"><span class="entrance-logo">${WORDMARK}</span><span class="opening-world">WORLD</span></h1><p class="entrance-subtitle">${say('opening.entrance.subtitle','드라마 속 유학생이 되어 한국어로 말해요')}</p><div class="entrance-actions"><a class="entrance-drama" href="${DRAMA_URL}"><strong>${say('opening.entrance.drama','드라마로 말해 보기')}</strong><small>${say('opening.entrance.dramaNote','시범판 · 1화를 바로 해 볼 수 있어요')}</small></a><button class="entrance-town opening-enter" type="button"><strong>${say('opening.entrance.town','우리 동네로 가기')}</strong><small>${say('opening.entrance.townNote','이전 판 · 로그인해서 이어 하기')}</small></button></div></div></section><button class="opening-skip" type="button" aria-label="${t('opening.skip')}"></button><div class="opening-controls"><button class="opening-sound" type="button" aria-pressed="false" aria-label="${t('opening.soundOn')}" title="${t('opening.soundOn')}"></button></div><p class="opening-copyright">© 2026 SYNK</p>`;
  // Product names are text, never interpolated markup or a false engine badge.
  if(product!=='SYNK WORLD')dialog.querySelector('.opening-world').textContent=product;
  const audio=new Audio(asset('opening-candidate.wav'));audio.preload='none';
  let stage='company',settled=false,timer,hideTimer,soundOn=false,leaving=false,titleBefore=null;
  let resolveDone;const done=new Promise(resolve=>{resolveDone=resolve;});
  const previousFocus=document.activeElement;
  const previousBodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const soundButton=dialog.querySelector('.opening-sound'),skip=dialog.querySelector('.opening-skip'),town=dialog.querySelector('.entrance-town'),drama=dialog.querySelector('.entrance-drama');
  const stopAudio=()=>{audio.pause();try{audio.currentTime=0;}catch{}};
  const updateSound=()=>{soundButton.setAttribute('aria-pressed',String(soundOn));soundButton.setAttribute('aria-label',t(soundOn?'opening.soundOff':'opening.soundOn'));soundButton.title=t(soundOn?'opening.soundOff':'opening.soundOn');};
  const playSound=()=>{if(!soundOn||document.hidden||settled)return;stopAudio();audio.play().catch(()=>{soundOn=false;updateSound();});};
  function finish(reason='start'){
    if(settled)return;settled=true;stage='closed';clearTimeout(timer);clearTimeout(hideTimer);stopAudio();document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',onPageHide);window.removeEventListener('pageshow',onPageShow);dialog.removeEventListener('cancel',onCancel);
    if(!replay&&!companyOnly&&!['pagehide','destroy','unavailable'].includes(reason)){try{sessionStorage.setItem(SEEN,'1');}catch{}}
    if(titleBefore!==null&&document.title===product)document.title=titleBefore;
    if(dialog.open)dialog.close();dialog.remove();removeCover();document.body.style.overflow=previousBodyOverflow;
    if(previousFocus?.isConnected&&previousFocus!==document.body)previousFocus.focus({preventScroll:true});
    resolveDone(reason);try{onEnter(reason,{sceneTime:0});}catch(error){console.error('Opening handoff:',error);}
  }
  function title(){
    if(settled||stage!=='company')return;
    if(companyOnly){finish('company-end');return;}
    // 건너뛰기 단추에 초점이 있던 채(키보드) 숨기면 초점이 대화 상자 밖으로 빠진다 — 입구의 첫 길로 옮긴다.
    const skipFocused=document.activeElement===skip;
    stage='title';dialog.dataset.stage='title';dialog.querySelector('.opening-entrance').hidden=false;dialog.querySelector('.opening-company').setAttribute('aria-hidden','true');skip.hidden=true;
    if(skipFocused)drama.focus({preventScroll:true});
    titleBefore=document.title;document.title=product;
    hideTimer=setTimeout(()=>{if(!settled)dialog.querySelector('.opening-company').hidden=true;},470);
    titleMotion();
  }
  // 움직임: 사진은 천천히 다가가고, 로고·WORLD·부제가 차례로 차오른 뒤 두 길이 올라온다. 펠트 판의 빛 알갱이는 실사에 쓰지 않는다.
  function titleMotion(){
    if(reduced||!motionOn())return;
    const section=dialog.querySelector('.opening-entrance');
    section.querySelector('.entrance-photo')?.classList.add('w-drift');
    spring(section.querySelector('.entrance-logo'),[{opacity:0,transform:'translateY(8px)',filter:'blur(6px)'},{opacity:1,transform:'none',filter:'blur(0px)'}],{duration:900,delay:160});
    const world=section.querySelector('.opening-world');
    if(product==='SYNK WORLD'&&world){world.textContent='';for(const ch of 'WORLD'){const span=document.createElement('span');span.className='opening-world-letter';span.textContent=ch;world.append(span);}
     world.querySelectorAll('span').forEach((span,i)=>spring(span,[{opacity:0,transform:'translateY(9px)',filter:'blur(4px)'},{opacity:1,transform:'none',filter:'blur(0px)'}],{duration:620,delay:520+i*95}));}
    ink(section.querySelector('.entrance-subtitle'),{delay:1000,from:150});
    section.querySelectorAll('.entrance-line,.entrance-actions>*').forEach((node,i)=>spring(node,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:700,delay:1250+i*140}));
    drama.classList.add('w-sheen');
  }
  const onVisibility=()=>{if(document.hidden)stopAudio();};
  // 드라마 길로 이 탭을 떠날 때는 닫지 않는다 — 뒤로 오면(bfcache) 입구가 그대로 있어야 한다. 그 밖의 떠남은 예전처럼 닫는다.
  const onPageHide=()=>{if(!leaving)finish('pagehide');};
  const onPageShow=event=>{if(event.persisted)leaving=false;};
  const onCancel=event=>{event.preventDefault();finish('skip');};
  soundButton.addEventListener('click',()=>{soundOn=!soundOn;updateSound();if(soundOn)playSound();else stopAudio();});
  skip.addEventListener('click',title);
  town.addEventListener('click',()=>finish('start'));
  drama.addEventListener('click',event=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){leaving=true;stopAudio();}});
  // 누르는 동안 두 길 단추가 쏙 들어갔다 통 튀어나온다.
  bindPress(dialog,'.entrance-drama,.entrance-town');
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Tab')dialog.dataset.keyboard='true';
    // 회사 구간에서만 Enter·Space로 건너뛴다. 입구에서는 고를 길이 둘이라 단추마다 스스로 받는다.
    if(event.target===dialog&&stage==='company'&&['Enter',' '].includes(event.key)){event.preventDefault();title();}
  });
  dialog.addEventListener('pointerdown',()=>{delete dialog.dataset.keyboard;});
  dialog.addEventListener('cancel',onCancel);document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pagehide',onPageHide);window.addEventListener('pageshow',onPageShow);
  // 사진을 못 받으면 검은 바탕과 글·두 길만 남긴다(다른 그림을 대신 얹지 않는다).
  dialog.querySelector('.entrance-photo').addEventListener('error',event=>{event.target.hidden=true;},{once:true});
  document.body.append(dialog);
  try{dialog.showModal();}catch{finish('unavailable');return {done,destroy:finish,stage:()=>stage};}
  removeCover();dialog.focus({preventScroll:true});timer=setTimeout(title,reduced?240:2600);
  return {done,destroy:()=>finish('destroy'),stage:()=>stage,audioStatus:()=>({enabled:soundOn,paused:audio.paused,currentTime:audio.currentTime,duration:Number.isFinite(audio.duration)?audio.duration:null})};
}
