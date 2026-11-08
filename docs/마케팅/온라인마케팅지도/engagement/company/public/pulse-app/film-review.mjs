import {reduced} from './motion.mjs';

// 영상 확인의 움직임(2026-11-05 시사실 판): 어두운 방에 영상 한 편, 아래 프레임 띠와 의견 표시, 손을 놓으면 영상만 남는다. 그리기는 views.mjs, 여기는 듣개만.
// render()가 칸을 다시 쓸 때 같은 영상 노드를 다시 끼우므로(app.mjs), 듣개는 AbortController로 묶어 unmount에서 뗀다.
const pad=value=>String(value).padStart(2,'0');
const fmt=value=>`${pad(Math.floor(value/60))}:${pad(Math.floor(value%60))}.${pad(Math.floor(value%1*100))}`;
const short=value=>`${Math.floor(value/60)}:${pad(Math.floor(value%60))}`;
const typingNow=()=>{const el=document.activeElement;return !!el&&(/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)||el.isContentEditable);};
// 대화상자 · 의뢰서가 열렸거나 단추에 초점이 있으면 스페이스 · 화살표는 그쪽 몫이다.
// 일지 서랍 · 시트(판 3b)를 연 채면 스페이스 · 화살표가 뒤 영상을 움직이지 않는다.
const keysAreBusy=()=>typingNow()||!!document.querySelector('dialog[open],.sx-round-sheet[open],[data-journal].is-open')||!!document.querySelector('.sx-q')||/^(BUTTON|A|SUMMARY)$/.test(document.activeElement?.tagName||'');
const withModifier=event=>event.altKey||event.ctrlKey||event.metaKey;

// 멈춰 있을 때 보일 한 장: 영상 첫 프레임은 대개 아직 아무 일도 일어나지 않은 그림이다. 끝 컷 쪽(길이의 84%)을 보여 주고, 재생은 처음부터 한다.
// 상태를 영상 노드에 두어(data-holding = 서 있는 초) 화면을 다시 그려 같은 노드를 끼워도 이어진다. 수정본은 달라진 곳을 찾으면 moveTo로 그 자리에 선다.
// 다른 데서 영상을 옮기면(의견의 시간 누르기 같은) 그 순간 기다림을 푼다. 그 뒤로는 아무것도 영상을 옮기지 않고, 재생도 거기서 잇는다.
// 그 자리가 거의 검정이면 깨진 영상처럼 보인다(맹검 7차). 더 밝은 자리를 몇 군데 더 찾아가 가장 밝은 곳에 선다. 어느 때든 손님이 영상을 잡으면 찾기를 멈춘다.
export const POSTER_AT=.84;
const POSTER_MORE=[.5,.32,.66],POSTER_DARK=46;
const lumaOf=video=>{try{const canvas=document.createElement('canvas');canvas.width=canvas.height=16;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,16,16);const data=ctx.getImageData(0,0,16,16).data;let sum=0;for(let i=0;i<data.length;i+=4)sum+=data[i]*.3+data[i+1]*.59+data[i+2]*.11;return sum/(data.length/4);}catch{return 255;}};
const seekedOnce=video=>new Promise(resolve=>{const done=()=>{clearTimeout(timer);video.removeEventListener?.('seeked',done);resolve();};const timer=setTimeout(done,4000);video.addEventListener('seeked',done,{once:true});});
const standAt=(video,seconds)=>{video.dataset.holding=String(seconds);video.currentTime=seconds;};
// 한 번 놓으면 다시 서지 않는다. 손님이 0초에 세워 두었는데 화면을 다시 그린다고 끝 컷으로 옮겨서는 안 된다.
const letGo=video=>{delete video.dataset.holding;video.dataset.held='1';};
async function findBright(video,total,first){
  if(navigator.connection?.saveData)return;
  await seekedOnce(video);
  let best={at:first,luma:video.dataset.holding?lumaOf(video):255};
  for(const at of POSTER_MORE){
    if(!video.dataset.holding||best.luma>=POSTER_DARK)break;
    standAt(video,total*at);await seekedOnce(video);
    if(!video.dataset.holding)return;
    const luma=lumaOf(video);if(luma>best.luma)best={at,luma};
  }
  if(video.dataset.holding&&Math.abs(video.currentTime-total*best.at)>.01)standAt(video,total*best.at);
}
export function holdPoster(video,{signal,at=POSTER_AT}={}){
  const place=()=>{const total=video.duration;if(video.dataset.holding||video.dataset.held||!Number.isFinite(total)||total<=0||video.currentTime>0||!video.paused)return;standAt(video,total*at);if(typeof document!=='undefined')void findBright(video,total,at);};
  if(video.readyState>=1)place();else video.addEventListener('loadedmetadata',place,{once:true,signal});
  video.addEventListener('play',()=>{const wasHolding=!!video.dataset.holding;letGo(video);if(wasHolding)video.currentTime=0;},{signal});
  video.addEventListener('seeking',()=>{if(video.dataset.holding&&Math.abs(video.currentTime-Number(video.dataset.holding))>.05)letGo(video);},{signal});
  return {moveTo(seconds){if(!video.dataset.holding)return;letGo(video);video.currentTime=seconds;},release(){letGo(video);}};
}

// ── 프레임 띠 ──
// 실제 프로젝트에는 초별 그림이 없다. 넓은 화면에서만 숨은 영상을 차례로 찾아가 캔버스에 그린다. 판마다 한 번만 하고 메모리에 둔다.
// 못 그리면 조용히 선 하나로 남는다. 받는 양 때문에 휴대폰과 데이터 절약 모드에서는 하지 않는다.
const STRIP=new Map();
const CELL_W=96,CELL_H=170;
export const stripCount=duration=>Math.max(6,Math.min(30,Math.ceil(duration)));
export const canDrawStrip=()=>typeof matchMedia==='function'&&matchMedia('(hover:hover) and (min-width:821px)').matches&&!navigator.connection?.saveData;
function ensureStrip(version,src,count,onCell){
  let job=STRIP.get(version);
  if(job){job.listeners.add(onCell);job.frames.forEach((frame,i)=>{if(frame)onCell(i,frame);});return job;}
  job={version,count,frames:Array(count).fill(null),done:false,failed:false,listeners:new Set([onCell])};
  STRIP.set(version,job);
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';video.src=src;
  const once=(type,ms)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{video.removeEventListener(type,ok);reject(new Error('timeout'));},ms);const ok=()=>{clearTimeout(timer);resolve();};video.addEventListener(type,ok,{once:true});video.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('error'));},{once:true});});
  (async()=>{
    try{
      if(video.readyState<1)await once('loadedmetadata',12000);
      const duration=video.duration;if(!Number.isFinite(duration)||duration<=0)throw new Error('duration');
      for(let i=0;i<count;i++){
        // 이 판의 띠를 보는 화면이 사라지면 멈춘다. 다시 오면 처음부터 받지 않고 이어서 그릴 수 있게 그린 칸은 둔다.
        if(!job.listeners.size){job.paused=true;break;}
        video.currentTime=Math.min(duration-.05,(i+.5)*duration/count);
        await once('seeked',8000);
        const canvas=document.createElement('canvas');canvas.width=CELL_W;canvas.height=Math.round(CELL_W*(video.videoHeight/video.videoWidth||CELL_H/CELL_W));
        canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
        job.frames[i]=canvas;job.listeners.forEach(fn=>fn(i,canvas));
      }
      job.done=!job.paused;
    }catch{job.failed=true;}
    video.removeAttribute('src');video.load();
    if(job.paused)STRIP.delete(job.version);
    job.listeners.forEach(fn=>fn(-1,null));
  })();
  return job;
}
// 두 판의 띠로 달라진 곳을 잰다. AI로 다시 만든 컷은 안 바뀐 곳도 픽셀이 조금씩 다르므로, 칸마다 평균 차를 전체 중앙값으로 나눠 튀는 곳만 고른다.
// 절반이 넘게 걸리거나 못 재면 표시하지 않는다(말로 단정하지 않는다).
export function changedRange(a,b){
  if(!a?.length||a.length!==b?.length)return null;
  const gray=canvas=>{const small=document.createElement('canvas');small.width=24;small.height=24;const ctx=small.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,24,24);const data=ctx.getImageData(0,0,24,24).data,out=[];for(let i=0;i<data.length;i+=4)out.push(data[i]*.3+data[i+1]*.59+data[i+2]*.11);return out;};
  let diffs;
  try{diffs=a.map((frame,i)=>{const x=gray(frame),y=gray(b[i]);return x.reduce((sum,value,k)=>sum+Math.abs(value-y[k]),0)/x.length;});}catch{return null;}
  return rangeFromDiffs(diffs);
}
export function rangeFromDiffs(diffs){
  if(!diffs?.length)return null;
  const median=[...diffs].sort((x,y)=>x-y)[Math.floor(diffs.length/2)];
  const floor=Math.max(10,median*1.6),hits=diffs.map(value=>value>floor);
  const count=hits.filter(Boolean).length;
  if(!count||count>diffs.length*.6)return null;
  return {from:hits.indexOf(true),to:hits.lastIndexOf(true)+1,hits};
}

// 납품의 완성본: 멈춰 있을 때는 끝 컷, 재생은 처음부터. 브라우저 기본 막대 대신 같은 문법의 얇은 막대를 쓴다.
export function mountFinal(root){
  const box=root.querySelector('[data-final]'),video=box?.querySelector('video');if(!video)return {unmount(){}};
  const controller=new AbortController(),signal=controller.signal,$=selector=>box.querySelector(selector);
  const time=$('[data-final-time]'),fill=$('[data-final-fill]'),line=$('[data-final-line]'),playButton=$('[data-film-toggle]'),sound=$('[data-final-sound]'),full=$('[data-final-full]');
  holdPoster(video,{signal});
  const total=()=>Number.isFinite(video.duration)&&video.duration>0?video.duration:0;
  const paint=()=>{const t=video.dataset.holding?0:video.currentTime||0,all=total();time.textContent=`${short(t)} / ${short(all)}`;fill.style.setProperty('--p',String(all?t/all:0));line.setAttribute('aria-valuemax',String(Math.round(all)));line.setAttribute('aria-valuenow',String(Math.round(t)));line.setAttribute('aria-valuetext',short(t));};
  let raf=0;
  const tick=()=>{paint();if(!video.paused)raf=requestAnimationFrame(tick);};
  const sync=()=>{const on=!video.paused;box.classList.toggle('is-playing',on);playButton.classList.toggle('is-playing',on);playButton.querySelector('span').textContent=on?'멈춤':'재생';};
  const syncSound=()=>{sound.textContent=video.muted?'소리 켜기':'소리 끄기';};
  const shownAt=()=>video.dataset.holding?0:video.currentTime;
  const toggle=()=>{if(video.paused){if(video.ended)video.currentTime=0;video.play().catch(()=>{});}else video.pause();};
  const seek=value=>{letGo(video);video.currentTime=Math.max(0,Math.min(value,total()?total()-.03:value));paint();};
  for(const [type,fn] of Object.entries({play(){cancelAnimationFrame(raf);raf=requestAnimationFrame(tick);sync();},pause(){cancelAnimationFrame(raf);paint();sync();},seeked:paint,loadedmetadata:paint,volumechange:syncSound}))video.addEventListener(type,fn,{signal});
  // 전체 화면에서는 브라우저 조작 막대가 재생을 맡는다. 같이 뒤집지 않는다.
  video.addEventListener('click',()=>{if(document.fullscreenElement!==video)toggle();},{signal});playButton.addEventListener('click',toggle,{signal});
  let down=false;
  const at=event=>{const rect=line.getBoundingClientRect();return Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width))*total();};
  line.addEventListener('pointerdown',event=>{down=true;line.setPointerCapture?.(event.pointerId);seek(at(event));},{signal});
  line.addEventListener('pointermove',event=>{if(down)seek(at(event));},{signal});
  line.addEventListener('pointerup',()=>{down=false;},{signal});line.addEventListener('pointercancel',()=>{down=false;},{signal});
  line.addEventListener('keydown',event=>{if(withModifier(event))return;if(event.key==='ArrowLeft'){event.preventDefault();seek(shownAt()-1);}if(event.key==='ArrowRight'){event.preventDefault();seek(shownAt()+1);}},{signal});
  sound.addEventListener('click',()=>{video.muted=!video.muted;},{signal});
  full.addEventListener('click',()=>{(video.requestFullscreen||video.webkitEnterFullscreen)?.call(video);},{signal});
  addEventListener('fullscreenchange',()=>{video.controls=document.fullscreenElement===video;},{signal});
  paint();sync();syncSound();if(!video.paused)raf=requestAnimationFrame(tick);
  return {unmount(){cancelAnimationFrame(raf);controller.abort();}};
}

export function mountReview(root,{previous=null,onError}={}){
  const host=root.querySelector('.sx-review');if(!host)return {unmount(){}};
  const controller=new AbortController(),signal=controller.signal,$=selector=>host.querySelector(selector);
  const video=$('#review-video'),line=$('[data-line]'),slider=$('[data-slider]'),cells=$('[data-cells]'),head=$('[data-head]'),tc=$('[data-tc]'),peek=$('[data-peek]');
  const clock=$('[data-live-clock]'),seconds=$('form[data-form="round-draft"][data-item-id=""] [name=seconds],form[data-form="feedback"] [name=seconds]');
  const box=$('[data-film-box]'),playButton=$('[data-film-toggle]');
  const poster=video?holdPoster(video,{signal}):null;
  // 나란히 보기: 옆 판은 지금 판과 같은 순간에 선다. 이후 동기화는 app.mjs wireCompare 몫이다.
  const other=$('.is-other video');
  if(video&&other){const sameMoment=()=>{if(video.readyState>=1&&Math.abs(other.currentTime-video.currentTime)>.2)other.currentTime=video.currentTime;};if(other.readyState>=1)sameMoment();else other.addEventListener('loadedmetadata',sameMoment,{once:true,signal});video.addEventListener('seeked',sameMoment,{signal});}
  const duration=()=>Number.isFinite(video?.duration)&&video.duration>0?video.duration:0;
  // 시간 글자 · 머리 · 이 순간 시계
  const paintTime=()=>{
    if(!video)return;const t=video.currentTime||0,total=duration();
    if(head)head.style.setProperty('--p',String(total?t/total:0));
    if(tc)tc.textContent=fmt(t);
    if(slider){slider.setAttribute('aria-valuemax',String(Math.round(total)));slider.setAttribute('aria-valuenow',String(Math.round(t)));slider.setAttribute('aria-valuetext',short(t));}
    if(clock&&seconds&&seconds.value==='')clock.textContent=short(t);
    host.querySelectorAll('[data-note-at]').forEach(node=>node.classList.toggle('is-near',Math.abs(Number(node.dataset.noteAt)-t)<.8));
    host.querySelectorAll('[data-scene-from]').forEach(node=>node.classList.toggle('is-now',t>=Number(node.dataset.sceneFrom)&&t<Number(node.dataset.sceneTo)));
  };
  let raf=0;
  const tick=()=>{paintTime();if(video&&!video.paused)raf=requestAnimationFrame(tick);};
  // 손을 놓으면 글자가 물러난다.
  let idle=0;
  const wake=()=>{document.documentElement.classList.remove('is-dr-idle');clearTimeout(idle);if(video&&!video.paused&&!reduced())idle=setTimeout(()=>{if(!typingNow()&&!document.querySelector('dialog[open],[data-journal].is-open')&&!document.activeElement?.closest?.('[data-journal]')&&!document.querySelector('[data-journal]:hover'))document.documentElement.classList.add('is-dr-idle');},2200);};
  addEventListener('pointermove',wake,{signal});addEventListener('pointerdown',wake,{signal});addEventListener('keydown',wake,{signal});
  const syncPlaying=()=>{const on=!!video&&!video.paused;host.classList.toggle('is-playing',on);playButton?.classList.toggle('is-playing',on);wake();};
  const toggle=()=>{if(!video)return;if(video.paused){if(video.ended)video.currentTime=0;video.play().catch(()=>{video.muted=true;video.play().catch(()=>{});});}else video.pause();};
  const seek=value=>{if(!video)return;poster?.release();const total=duration();video.currentTime=Math.max(0,Math.min(value,total?total-.03:value));paintTime();};
  const placeScenes=()=>{const row=$('[data-scenes]'),total=duration();if(!row||!total)return;const sum=Number(row.dataset.total)||0;row.hidden=Math.abs(sum-total)>1;row.style.setProperty('--cols',[...row.children].map(li=>`${li.dataset.w}fr`).join(' '));};
  const placeMarks=()=>{const total=duration();if(!total)return;host.querySelectorAll('[data-mark-at]').forEach(mark=>mark.style.setProperty('--x',String(Math.min(1,Number(mark.dataset.markAt)/total))));};
  const setShape=()=>{if(!video||!box||!video.videoWidth)return;const ratio=video.videoWidth/video.videoHeight;host.style.setProperty('--r',String(ratio));host.dataset.shape=ratio>1.1?'wide':ratio<.9?'tall':'square';};
  let stripDrawn=false;
  const drawStrip=()=>{
    if(stripDrawn||!cells||!video||!canDrawStrip())return;
    const total=duration();if(!total)return;stripDrawn=true;
    const count=stripCount(total),version=video.dataset.version;
    cells.style.setProperty('--n',String(count));
    cells.innerHTML=Array.from({length:count},()=>'<canvas class="sx-cell"></canvas>').join('');
    const list=[...cells.children];
    const onCell=(i,frame)=>{
      if(signal.aborted)return;
      if(i>=0&&list[i]){list[i].width=frame.width;list[i].height=frame.height;list[i].getContext('2d').drawImage(frame,0,0);list[i].classList.add('is-on');}
      if(i===-1||i===count-1)compareStrips(version);
    };
    const job=ensureStrip(version,video.currentSrc||video.src,count,onCell);
    signal.addEventListener('abort',()=>job.listeners.delete(onCell));
    if(previous?.src&&previous.id){
      const other=(i)=>{if(i===-1||i===count-1)compareStrips(version);};
      const prior=ensureStrip(previous.id,previous.src,count,other);
      signal.addEventListener('abort',()=>prior.listeners.delete(other));
    }
    compareStrips(version);
  };
  // 달라진 곳: 표시만 하고 말로 단정하지 않는다.
  const compareStrips=version=>{
    const label=$('[data-diff]');if(!label||!previous?.id)return;
    const a=STRIP.get(version),b=STRIP.get(previous.id);
    if(!a?.done||!b?.done||a.frames.length!==b.frames.length||(previous.duration&&Math.abs(previous.duration-duration())>.6))return;
    const range=changedRange(a.frames,b.frames);if(!range)return;
    const total=duration(),count=a.frames.length,from=range.from/count,to=range.to/count;
    label.hidden=false;label.style.setProperty('--from',String(from));label.style.setProperty('--to',String(to));
    label.querySelector('.sx-no').textContent=`${short(from*total)}~${short(to*total)}`;
    [...(cells?.children||[])].forEach((cell,i)=>cell.classList.toggle('is-diff',i>=range.from&&i<range.to));
    cells?.classList.add('has-diff');
    // 수정본은 달라진 곳에 서서 기다린다.
    poster?.moveTo(from*total);
  };
  if(video){
    for(const [type,fn] of Object.entries({play(){cancelAnimationFrame(raf);raf=requestAnimationFrame(tick);syncPlaying();},pause(){cancelAnimationFrame(raf);paintTime();syncPlaying();},seeked:paintTime,timeupdate(){if(video.paused)paintTime();},loadedmetadata(){setShape();placeMarks();placeScenes();paintTime();drawStrip();},canplay:drawStrip,error(){onError?.();}}))video.addEventListener(type,fn,{signal});
    // 전체 화면에서는 브라우저 조작 막대가 재생을 맡는다(크게 보기). 같이 뒤집지 않는다.
    video.addEventListener('click',()=>{if(document.fullscreenElement!==video)toggle();},{signal});
    if(video.readyState>=1){setShape();placeMarks();placeScenes();paintTime();}
    if(video.readyState>=2)drawStrip();
    syncPlaying();if(!video.paused){raf=requestAnimationFrame(tick);}
  }
  playButton?.addEventListener('click',toggle,{signal});
  // 크게 보기(의뢰 흐름의 영상 · 납품 화면): 납품 재생기와 같은 방식.
  const full=$('[data-review-full]');
  if(full&&video){full.addEventListener('click',()=>{(video.requestFullscreen||video.webkitEnterFullscreen)?.call(video);},{signal});addEventListener('fullscreenchange',()=>{video.controls=document.fullscreenElement===video;},{signal});}
  // 끌어서 시간 옮기기
  if(line&&video){
    let down=false;
    const at=event=>{const rect=line.getBoundingClientRect();return Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width))*duration();};
    line.addEventListener('pointerdown',event=>{if(event.target.closest('[data-action]'))return;down=true;line.setPointerCapture?.(event.pointerId);seek(at(event));},{signal});
    line.addEventListener('pointermove',event=>{
      if(down){if(peek)peek.hidden=true;seek(at(event));return;}
      if(!peek||!duration())return;
      const time=at(event),job=STRIP.get(video.dataset.version),frame=job?.frames[Math.min(job.frames.length-1,Math.floor(time/duration()*job.frames.length))];
      if(!frame){peek.hidden=true;return;}
      peek.hidden=false;const canvas=peek.querySelector('canvas');canvas.width=frame.width;canvas.height=frame.height;canvas.getContext('2d').drawImage(frame,0,0);peek.querySelector('figcaption').textContent=short(time);peek.style.setProperty('--x',String(time/duration()));
    },{signal});
    line.addEventListener('pointerup',()=>{down=false;},{signal});line.addEventListener('pointercancel',()=>{down=false;},{signal});
    line.addEventListener('pointerleave',()=>{if(!down&&peek)peek.hidden=true;},{signal});
    line.addEventListener('keydown',event=>{if(withModifier(event)||event.target!==slider)return;if(event.key==='ArrowLeft'){event.preventDefault();event.stopPropagation();seek(video.currentTime-1);}if(event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();seek(video.currentTime+1);}},{signal});
  }
  addEventListener('keydown',event=>{
    if(!video||keysAreBusy()||withModifier(event)||document.fullscreenElement===video)return;
    if(event.key===' '){event.preventDefault();toggle();}
    if(event.key==='ArrowLeft'){event.preventDefault();seek(video.currentTime-1);}
    if(event.key==='ArrowRight'){event.preventDefault();seek(video.currentTime+1);}
  },{signal});
  host.addEventListener('focusin',event=>{if(event.target.matches?.('textarea,input')&&!event.target.closest?.('[data-journal]'))poster?.release();},{signal});
  // 의견을 쓰기 시작하면 그 자리에서 멈춘다(체험의 의견 칸도 같다. 초안은 app.mjs가 시간을 넣는다).
  host.addEventListener('focusin',event=>{
    const area=event.target;if(!video||!area?.matches?.('form[data-form="feedback"] textarea[name="text"]'))return;
    const field=area.form?.elements?.seconds;if(!field||field.type!=='hidden'||field.value!==''||!(video.currentTime>0))return;
    video.pause();field.value=String(Math.round(video.currentTime*10)/10);field.dispatchEvent(new Event('input',{bubbles:true}));
  },{signal});
  host.addEventListener('input',event=>{if(event.target.matches?.('textarea[data-grow]')){event.target.style.height='auto';event.target.style.height=`${event.target.scrollHeight+2}px`;}},{signal});
  // 보내기 창 닫기
  host.addEventListener('click',event=>{
    if(event.target.closest('[data-sheet-close]')){event.target.closest('details').open=false;}
    const jump=event.target.closest('[data-seek]');if(jump){seek(Number(jump.dataset.seek));video?.pause();}
  },{signal});
  addEventListener('keydown',event=>{if(event.key==='Escape'){const sheet=$('.sx-round-sheet[open]');if(sheet){sheet.open=false;}}},{signal});
  paintTime();
  return {unmount(){cancelAnimationFrame(raf);clearTimeout(idle);controller.abort();document.documentElement.classList.remove('is-dr-idle');}};
}
