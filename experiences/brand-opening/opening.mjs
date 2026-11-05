import {motionOn,spring,ink} from './world-motion.mjs';
// 화면 언어(10-19 1판): 고른 언어가 있으면 부제·시작 단추·소리 단추를 그 언어로. 고르기 전에는 한국어 원문이다.
import {t,setLang,currentLang,onLang,LANG_NAMES} from './world-lang.mjs';
const SEEN='synk.brand-opening.v1.seen';
const asset=name=>new URL(`./assets/${name}`,import.meta.url).href;
// 11-02 펠트 안녕 콘서트(유호님 「B 펠트 콘서트」, 결정 11-02): 한강 둔치 무대의 크림 펠트 「안녕」을 구운 사진 한 장.
// 사진 안 비율로 적은 값 — lx 글자 가로 범위 · ly 글자 가운데 높이 · crowd 관객 시작 줄 · lights 빔이 나오는 자리 · sky 사진 맨 위 색.
// 빔은 글자 바깥(양옆)과 글자 윗선에서만 나와 펠트 위를 긋지 않는다.
const SCENES={
 port:{src:'world-title-concert-port-v1.webp',w:941,h:1672,lx:[.14,.86],ly:.64,crowd:.78,lights:[[.05,.62],[.95,.62],[.3,.52],[.7,.52]],sky:'#040b1a'},
 land:{src:'world-title-concert-land-v1.webp',w:1916,h:821,lx:[.53,.92],ly:.46,crowd:.76,lights:[[.5,.5],[.97,.5],[.62,.2],[.82,.2]],sky:'#0f1324'}
};
const LANG_ORDER=['ko','en','mn'];
const BEAT=.5,DROP=.5;
const BEAM_COLORS=['255,79,168','160,110,255','200,230,255'];
const CARET='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let v=Math.imul(seed^seed>>>15,1|seed);v=v+Math.imul(v^v>>>7,61|v)^v;return((v^v>>>14)>>>0)/4294967296;};
function glowSprite(rgb){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const context=canvas.getContext('2d');
  const gradient=context.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.22,`rgba(${rgb},.9)`);gradient.addColorStop(.55,`rgba(${rgb},.2)`);gradient.addColorStop(1,`rgba(${rgb},0)`);
  context.fillStyle=gradient;context.fillRect(0,0,64,64);return canvas;
}

/** Shared company splash. Product hosts own loading, sign-in, and launch. */
export function mountBrandOpening({product='SYNK WORLD',replay=false,companyOnly=false,reducedMotion=false,onEnter=()=>{},onLanguage=null,onTap=null}={}){
  const cover=document.querySelector('#synk-opening-cover');
  const removeCover=()=>{cover?.remove();clearTimeout(window.__synkOpeningSafetyTimer);};
  let previouslySeen=false;try{previouslySeen=sessionStorage.getItem(SEEN)==='1';}catch{}
  const query=new URLSearchParams(location.search);
  if(!replay&&(query.get('opening')==='off'||(previouslySeen&&query.get('opening')!=='replay'))){removeCover();return {done:Promise.resolve('return'),destroy:()=>{},stage:()=> 'closed'};}
  const reduced=reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dialog=document.createElement('dialog');dialog.className='synk-opening';dialog.dataset.stage='company';dialog.dataset.reduced=String(reduced);dialog.dataset.concert='';dialog.setAttribute('aria-label',t('opening.dialog',{product}));dialog.tabIndex=-1;
  dialog.innerHTML=`<section class="opening-company" aria-label="${t('opening.company')}"><div class="opening-light" aria-hidden="true"></div><div class="opening-company-lockup"><img class="opening-wordmark" src="${asset('synk-paper.webp')}" alt="synk" width="1100" height="541"><p class="opening-credit">CREATED BY SYNK</p></div></section><section class="opening-concert" aria-labelledby="opening-world-title" hidden><div class="concert-cam"><img class="concert-scene" alt="${t('opening.concert.alt')}" decoding="async"><img class="concert-glow" alt="" aria-hidden="true" decoding="async"><canvas class="concert-fx" aria-hidden="true"></canvas></div><div class="concert-shade" aria-hidden="true"></div><div class="concert-copy"><img class="concert-logo" src="${asset('synk-paper.webp')}" alt="synk" width="1100" height="541"><h1 class="concert-world" id="opening-world-title">WORLD</h1></div><p class="concert-line">${t('opening.concert.line')}</p><canvas class="concert-top" aria-hidden="true"></canvas></section><button class="opening-enter" type="button" aria-label="${t('opening.skip')}"><span class="concert-start" hidden></span></button><div class="concert-lang-wrap"><button class="concert-lang" type="button"><span class="concert-lang-name"></span>${CARET}</button></div><div class="opening-controls"><button class="opening-sound" type="button" aria-pressed="false"><span class="concert-sound-label"></span></button></div><p class="opening-copyright">© 2026 SYNK</p>`;
  // Product names are text, never interpolated markup or a false engine badge.
  if(product!=='SYNK WORLD')dialog.querySelector('.concert-world').textContent=product;
  const audio=new Audio(asset('opening-candidate.wav'));audio.preload='none';
  let stage='company',settled=false,leaving=false,timer,hideTimer,leaveTimer,soundOn=false;
  let resolveDone;const done=new Promise(resolve=>{resolveDone=resolve;});
  const previousFocus=document.activeElement;
  const previousBodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const concert=dialog.querySelector('.opening-concert'),cam=concert.querySelector('.concert-cam'),scene=concert.querySelector('.concert-scene'),glow=concert.querySelector('.concert-glow');
  const fx=concert.querySelector('.concert-fx'),top=concert.querySelector('.concert-top'),fxContext=fx.getContext('2d'),topContext=top.getContext('2d');
  const soundButton=dialog.querySelector('.opening-sound'),enter=dialog.querySelector('.opening-enter'),hint=dialog.querySelector('.concert-start'),langButton=dialog.querySelector('.concert-lang');
  const startLabel=()=>matchMedia('(pointer:coarse)').matches?'TOUCH TO START':'CLICK TO START';
  hint.textContent=startLabel();
  const stopAudio=()=>{audio.pause();try{audio.currentTime=0;}catch{}};
  const updateSound=()=>{const label=t(soundOn?'opening.soundOff':'opening.soundOn');soundButton.querySelector('.concert-sound-label').textContent=label;soundButton.setAttribute('aria-pressed',String(soundOn));soundButton.setAttribute('aria-label',label);soundButton.title=label;};
  const playSound=()=>{if(!soundOn||document.hidden||settled)return;stopAudio();audio.play().catch(()=>{soundOn=false;updateSound();});};
  // 왼쪽 위 언어: 누를 때마다 한국어 → English → Монгол. 이 기기에 저장하고(setLang) 앱에 알려(onLanguage) 첫 실행 · 설정과 같은 길로 계정에도 쓴다.
  // 계정 복원이 회사 화면 뒤에서 언어를 바꾸면 onLang으로 단추 · 글을 따라 바꾼다.
  function applyLang(){
    const code=currentLang();dialog.lang=code;
    langButton.querySelector('.concert-lang-name').textContent=LANG_NAMES[code];
    langButton.setAttribute('aria-label',t('opening.concert.lang',{lang:LANG_NAMES[code]}));
    dialog.setAttribute('aria-label',t('opening.dialog',{product}));
    concert.querySelector('.concert-line').textContent=t('opening.concert.line');scene.alt=t('opening.concert.alt');
    enter.setAttribute('aria-label',stage==='company'?t('opening.skip'):`${startLabel()} · ${t('opening.startProduct',{product})}`);
    updateSound();
  }
  // 무대: 휴대폰은 사진으로 화면을 꽉 채우고, 가로 화면은 글자가 오른쪽 60%에 다 들어오게 줄여 아래에 붙인 뒤 위를 사진 맨 위 색으로 메운다.
  let view=null,width=0,height=0,ratio=1,map=(u,v)=>[u,v],lights=[],sparks=[],sprites=null,beamCanvas=null,beamContext=null,logoBox=null,crowdY=0,raf=0,startedAt=0,tapAt=-99;
  const confetti=[];
  function layout(){
    width=innerWidth;height=innerHeight;ratio=1;const fine=Math.min(devicePixelRatio||1,2);
    const land=width>height;view=SCENES[land?'land':'port'];
    const source=asset(view.src);if(scene.dataset.source!==source){scene.dataset.source=source;scene.src=source;glow.src=source;}
    concert.style.setProperty('--concert-sky',view.sky);
    let scale,dx,dy;
    if(!land){scale=Math.max(width/view.w,height/view.h);dx=(width-view.w*scale)/2;dy=(height-view.h*scale)/2;}
    else{const coverScale=Math.max(width/view.w,height/view.h),fitScale=(width*.6)/((view.lx[1]-view.lx[0])*view.w);scale=Math.max(height*.84/view.h,Math.min(coverScale,fitScale));dx=width*.66-((view.lx[0]+view.lx[1])/2)*view.w*scale;dx=Math.min(0,Math.max(width-view.w*scale,dx));dy=height-view.h*scale;}
    for(const image of [scene,glow])Object.assign(image.style,{width:`${view.w*scale}px`,height:`${view.h*scale}px`,left:`${dx}px`,top:`${dy}px`});
    map=(u,v)=>[dx+u*view.w*scale,dy+v*view.h*scale];
    const [ox,oy]=map((view.lx[0]+view.lx[1])/2,view.ly);cam.style.transformOrigin=`${ox}px ${oy}px`;
    // 응원봉 밝히기 마스크는 사진 상자 기준 비율이다(사진은 화면보다 크거나 작게 놓인다).
    crowdY=map(0,view.crowd)[1];concert.style.setProperty('--concert-crowd',`${(view.crowd*100).toFixed(1)}%`);
    // 빛 · 빔은 부드러운 그라디언트라 1배로 충분하다(휴대폰 부하). 꽃가루 조각만 기기 배율(2배까지)로 또렷하게.
    fx.width=Math.round(width*ratio);fx.height=Math.round(height*ratio);top.width=Math.round(width*fine);top.height=Math.round(height*fine);
    fxContext.setTransform(ratio,0,0,ratio,0,0);topContext.setTransform(fine,0,0,fine,0,0);
    beamCanvas=document.createElement('canvas');beamCanvas.width=fx.width;beamCanvas.height=fx.height;beamContext=beamCanvas.getContext('2d');beamContext.setTransform(ratio,0,0,ratio,0,0);
    lights=view.lights.map(([u,v],i)=>{const [x,y]=map(u,v);return {x,y,i,color:BEAM_COLORS[i%3]};});
    const random=rng(11);sparks=[];const count=land?100:70;
    for(let i=0;i<count;i++){const y=crowdY+(height-crowdY)*Math.pow(random(),.9);sparks.push({x:random()*width,y,r:.8+((y-crowdY)/Math.max(1,height-crowdY))*2.6*random(),phase:random()*6.28,speed:3+random()*4,pink:random()<.25});}
    if(!sprites)sprites={white:glowSprite('255,250,244'),pink:glowSprite('255,95,180')};
    logoBox=null;
  }
  // 빔: 넓은 안개 · 가운데 · 흰 심 세 겹. 로고 둘레는 부드럽게 지워 로고 위를 지나지 않는다.
  function beam(origin,angle,length,alpha,color){
    const dx=Math.sin(angle),dy=-Math.cos(angle),ex=origin.x+dx*length,ey=origin.y+dy*length,nx=-dy,ny=dx;
    for(const [spread,strength,tone] of [[.05,.045,color],[.018,.11,color],[.004,.34,'255,255,255']]){
      const half=Math.tan(spread)*length,gradient=beamContext.createLinearGradient(origin.x,origin.y,ex,ey);
      gradient.addColorStop(0,`rgba(${tone},${strength*alpha})`);gradient.addColorStop(.5,`rgba(${tone},${strength*alpha*.35})`);gradient.addColorStop(1,`rgba(${tone},0)`);
      beamContext.fillStyle=gradient;beamContext.beginPath();beamContext.moveTo(origin.x-nx*1.5,origin.y-ny*1.5);beamContext.lineTo(origin.x+nx*1.5,origin.y+ny*1.5);beamContext.lineTo(ex+nx*half,ey+ny*half);beamContext.lineTo(ex-nx*half,ey-ny*half);beamContext.closePath();beamContext.fill();
    }
  }
  function frame(now){
    const time=(now-startedAt)/1000,beatTime=(time-DROP)/BEAT,beat=Math.floor(beatTime),phase=beatTime-beat,bar=Math.floor(beat/4),live=time>=DROP,pulse=live?Math.exp(-phase*4.2):0;
    fxContext.clearRect(0,0,width,height);topContext.clearRect(0,0,width,height);
    const tap=Math.exp(-Math.max(0,time-tapAt)*3);
    glow.style.opacity=Math.max(live?.08+.36*pulse:0,tap>.03?tap*.9:0).toFixed(3);
    if(live){
      fxContext.globalCompositeOperation='lighter';
      // 무대 색 빛: 사진 속 빛과 같은 분홍 · 보라를 마디마다 번갈아
      const color=bar%2?'160,110,255':'255,79,168',[wx,wy]=map((view.lx[0]+view.lx[1])/2,view.ly),radius=Math.max(width,height)*(width>height?.32:.42);
      const wash=fxContext.createRadialGradient(wx,wy,0,wx,wy,radius);wash.addColorStop(0,`rgba(${color},${.05+.12*pulse})`);wash.addColorStop(1,`rgba(${color},0)`);fxContext.fillStyle=wash;fxContext.fillRect(0,0,width,height);
      // 빔: 첫 두 마디, 그 뒤로는 8마디마다 두 마디만
      if(bar<2||bar%8<2){
        const progress=bar<2?beatTime/8:((bar%8)*4+phase+(beat%4))/8,alpha=Math.min(1,progress*6,(1-progress)*6),length=Math.max(width,height)*1.4;
        beamContext.setTransform(1,0,0,1,0,0);beamContext.clearRect(0,0,beamCanvas.width,beamCanvas.height);beamContext.setTransform(ratio,0,0,ratio,0,0);beamContext.globalCompositeOperation='lighter';
        for(const light of lights){const side=light.x<wx?-1:1,edge=light.i<2;const angle=edge?side*(.35+.4*Math.abs(Math.sin(time*.8+light.i*1.3))):side*(.05+.3*Math.abs(Math.sin(time*.9+light.i)));beam(light,angle,length,alpha*(.7+.3*pulse),light.color);}
        if(!logoBox){const logo=concert.querySelector('.concert-logo').getBoundingClientRect(),world=concert.querySelector('.concert-world').getBoundingClientRect();if(logo.width){const top=logo.top,bottom=Math.max(logo.bottom,world.bottom),left=Math.min(logo.left,world.left),right=Math.max(logo.right,world.right);logoBox={x:(left+right)/2,y:(top+bottom)/2,rx:Math.max(80,(right-left)*.62),ry:Math.max(60,(bottom-top)*.75)};}}
        if(logoBox){beamContext.globalCompositeOperation='destination-out';beamContext.save();beamContext.translate(logoBox.x,logoBox.y);beamContext.scale(logoBox.rx,logoBox.ry);const hole=beamContext.createRadialGradient(0,0,0,0,0,1);hole.addColorStop(0,'rgba(0,0,0,1)');hole.addColorStop(.6,'rgba(0,0,0,.9)');hole.addColorStop(1,'rgba(0,0,0,0)');beamContext.fillStyle=hole;beamContext.beginPath();beamContext.arc(0,0,1,0,7);beamContext.fill();beamContext.restore();}
        beamContext.globalCompositeOperation='source-over';fxContext.drawImage(beamCanvas,0,0,width,height);
      }
      // 응원봉 파도가 지나가고, 사진 속 응원봉 사이로 반짝임이 박자에 맞춰 돋는다
      const wave=((time-DROP)*.45%2.4-.7)*width,band=fxContext.createLinearGradient(wave-width*.18,0,wave+width*.18,0);band.addColorStop(0,'rgba(255,240,250,0)');band.addColorStop(.5,'rgba(255,240,250,.1)');band.addColorStop(1,'rgba(255,240,250,0)');fxContext.fillStyle=band;fxContext.fillRect(0,crowdY,width,height-crowdY);
      for(const spark of sparks){const brightness=Math.pow(Math.max(0,Math.sin(time*spark.speed+spark.phase)),10)*(.5+.5*pulse);if(brightness<.04)continue;const r=spark.r*3;fxContext.globalAlpha=brightness;fxContext.drawImage(spark.pink?sprites.pink:sprites.white,spark.x-r,spark.y-r,r*2,r*2);}
      fxContext.globalAlpha=1;fxContext.globalCompositeOperation='source-over';
    }
    // 누른 순간의 꽃가루(흰 · 분홍): 떨어지는 쪽 꼬리, 뒤집히는 두께, 작은 조각은 옅게
    for(const piece of confetti){
      const dt=time-piece.at;if(dt<=0||dt>1.6)continue;
      const y=piece.y+piece.vy*dt+260*dt*dt,x=piece.x+piece.vx*dt+Math.sin(dt*piece.wobble+piece.spin0)*10;if(y>height+20)continue;
      const w=piece.w*(.25+.75*Math.abs(Math.cos(dt*piece.flip))),vy=piece.vy+520*dt,alpha=Math.min(1,dt*6)*Math.min(1,(1.6-dt)*2.5)*(piece.w<3.5?.6:1);
      topContext.save();topContext.translate(x,y);topContext.globalAlpha=alpha*.28;topContext.strokeStyle=piece.color;topContext.lineWidth=Math.max(1,w*.6);topContext.beginPath();topContext.moveTo(0,0);topContext.lineTo(-piece.vx*.018,-vy*.018);topContext.stroke();
      topContext.rotate(piece.spin0+dt*piece.spin);topContext.fillStyle=piece.color;topContext.globalAlpha=alpha;topContext.fillRect(-w/2,-piece.h/2,w,piece.h);topContext.restore();
    }
    topContext.globalAlpha=1;
  }
  function burst(at){
    const random=rng(Math.floor(at*1000)+7),cx=width/2,cy=height*.84;
    for(let i=0;i<70;i++){const angle=-Math.PI/2+(random()-.5)*1.9,speed=380+random()*520,size=random();confetti.push({at,x:cx+(random()-.5)*width*.2,y:cy,vx:Math.cos(angle)*speed*.55,vy:Math.sin(angle)*speed,w:size<.33?3:size<.66?4.5:6,h:size<.33?5:size<.66?7:9,wobble:3+random()*3,flip:5+random()*7,spin0:random()*6.28,spin:(random()-.5)*9,color:random()<.5?'#ffffff':'#ff5fb4'});}
  }
  const moving=()=>!reduced&&motionOn();
  function loop(now){if(settled||stage!=='title'||document.hidden){raf=0;return;}frame(now);raf=requestAnimationFrame(loop);}
  function startLoop(){if(raf||settled||!moving())return;raf=requestAnimationFrame(loop);}
  function finish(reason='start'){
    if(settled)return;settled=true;stage='closed';offLang();clearTimeout(timer);clearTimeout(hideTimer);clearTimeout(leaveTimer);cancelAnimationFrame(raf);raf=0;stopAudio();document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',onPageHide);window.removeEventListener('resize',onResize);dialog.removeEventListener('cancel',onCancel);
    if(!replay&&!companyOnly&&!['pagehide','destroy','unavailable'].includes(reason)){try{sessionStorage.setItem(SEEN,'1');}catch{}}
    if(dialog.open)dialog.close();dialog.remove();removeCover();document.body.style.overflow=previousBodyOverflow;
    if(previousFocus?.isConnected&&previousFocus!==document.body)previousFocus.focus({preventScroll:true});
    resolveDone(reason);try{onEnter(reason,{});}catch(error){console.error('Opening handoff:',error);}
  }
  function title(){
    if(settled||stage!=='company')return;
    if(companyOnly){finish('company-end');return;}
    stage='title';dialog.dataset.stage='title';concert.hidden=false;dialog.querySelector('.opening-company').setAttribute('aria-hidden','true');enter.setAttribute('aria-label',`${startLabel()} · ${t('opening.startProduct',{product})}`);hint.hidden=false;
    hideTimer=setTimeout(()=>{if(!settled)dialog.querySelector('.opening-company').hidden=true;},470);
    startedAt=performance.now();titleMotion();startLoop();playSound();
  }
  // 등장: 로고는 꾹, WORLD는 한 자씩, 한 줄은 잉크처럼 차오른다. 무대 빛 · 빔 · 반짝임은 캔버스가 박자 120으로 돌린다.
  function titleMotion(){
    if(!moving())return;
    spring(concert.querySelector('.concert-logo'),[{opacity:0,transform:'scale(1.4)',filter:'blur(10px)'},{opacity:1,transform:'scale(.965)',filter:'blur(0px)',offset:.62},{transform:'scale(1.01)',offset:.82},{transform:'scale(1)'}],{duration:1000,delay:120});
    const world=concert.querySelector('.concert-world');
    if(product==='SYNK WORLD'&&world){world.textContent='';for(const ch of 'WORLD'){const span=document.createElement('span');span.className='concert-world-letter';span.textContent=ch;world.append(span);}
     world.querySelectorAll('span').forEach((span,i)=>spring(span,[{opacity:0,transform:'translateY(9px)',filter:'blur(4px)'},{opacity:1,transform:'none',filter:'blur(0px)'}],{duration:620,delay:620+i*95}));}
    ink(concert.querySelector('.concert-line'),{delay:1000,from:150});
  }
  const onVisibility=()=>{if(document.hidden){stopAudio();cancelAnimationFrame(raf);raf=0;}else startLoop();};
  const onPageHide=()=>finish('pagehide');
  const onCancel=event=>{event.preventDefault();finish('skip');};
  let resizeTimer;const onResize=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!settled)layout();},120);};
  soundButton.addEventListener('click',()=>{soundOn=!soundOn;updateSound();if(soundOn)playSound();else stopAudio();});
  langButton.addEventListener('click',()=>{const next=LANG_ORDER[(LANG_ORDER.indexOf(currentLang())+1)%LANG_ORDER.length];setLang(next);applyLang();try{onLanguage?.(next);}catch(error){console.warn('Opening language save failed',error);}});
  const offLang=onLang(()=>{if(!settled)applyLang();});
  // 누르면 응원봉이 한꺼번에 밝아지고 꽃가루가 오른 뒤(0.65초) 들어간다. 움직임 줄이기면 바로 들어간다.
  // onTap(선택): 누른 바로 그 순간 동기로 부른다(뒤에 깔린 화면이 이 누름으로 소리를 깨운다). 참을 돌려주면 꽃가루 없이 바로 닫는다.
  const enterWorld=()=>{
    let instant=false;if(!leaving&&!settled)try{instant=onTap?.()===true;}catch{}
    if(stage==='company'){finish('skip');return;}
    if(leaving||settled)return;
    if(instant||!moving()){finish('start');return;}
    leaving=true;dialog.dataset.leaving='';tapAt=(performance.now()-startedAt)/1000;burst(tapAt);hint.textContent='LET’S GO';
    leaveTimer=setTimeout(()=>finish('start'),650);
  };
  enter.addEventListener('click',enterWorld);
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Tab')dialog.dataset.keyboard='true';
    if(event.target===dialog&&['Enter',' '].includes(event.key)){event.preventDefault();enterWorld();}
  });
  dialog.addEventListener('pointerdown',()=>{delete dialog.dataset.keyboard;});
  dialog.addEventListener('cancel',onCancel);document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pagehide',onPageHide);window.addEventListener('resize',onResize);
  dialog.querySelector('.opening-wordmark').addEventListener('error',()=>title(),{once:true});
  // 사진을 못 받으면 사진 맨 위와 같은 밤하늘 색만 남긴다(정본 마스코트 그림을 대신 얹지 않는다).
  scene.addEventListener('error',()=>{scene.hidden=true;glow.hidden=true;},{once:true});
  applyLang();
  document.body.append(dialog);layout();
  try{dialog.showModal();}catch{finish('unavailable');return {done,destroy:finish,stage:()=>stage};}
  removeCover();dialog.focus({preventScroll:true});timer=setTimeout(title,reduced?240:2600);
  return {done,destroy:()=>finish('destroy'),stage:()=>stage,audioStatus:()=>({enabled:soundOn,paused:audio.paused,currentTime:audio.currentTime,duration:Number.isFinite(audio.duration)?audio.duration:null}),sceneStatus:()=>({source:scene.currentSrc,loaded:scene.complete&&scene.naturalWidth>0,moving:Boolean(raf),reduced,layout:view?.src||null,letters:view?{left:map(view.lx[0],view.ly)[0],right:map(view.lx[1],view.ly)[0],middle:map(0,view.ly)[1]}:null,crowd:crowdY})};
}
