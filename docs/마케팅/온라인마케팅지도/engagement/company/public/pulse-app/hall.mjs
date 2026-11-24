// 복도(2026-11-24, 시안 A 「캐스팅 복도」): 모델이 세로 띠로 늘어서고 가운데 한 명만 넓어져 걷는다.
// 입장 1쪽과 들어가는 순간이 쓴다. 설계: docs/디자인/PULSE고객앱_다시짓기_20261124/옮기기_설계.md 「복도」.
// 그림 · 영상은 캐스팅북 빌드가 정본이라 그 주소에서 받는다 — 의뢰서의 「모델이 움직이는 4초」와 같은 규칙(request-flow MODEL_FILM_BASE · MOVING_MODELS).
// 큰 움직임은 멀미가 나서 손을 올려도 띠를 옮기지 않는다. 4초마다 한 칸, 가운데 한 명만 걷는다.
// style 속성 글자 없이 CSSOM만 쓴다(CSP style-src 'self').
import {esc} from './api.mjs';
import {t} from './i18n.mjs';
import {FINISHED_FILMS,filmTitle} from './films-view.mjs';
import {modelCard} from './room-view.mjs';
import {MODEL_FILM_BASE,MOVING_MODELS} from './request-flow.mjs';
import {reduced} from './motion.mjs';

const wallOf=id=>`${MODEL_FILM_BASE}img/${id}/wall.webp`,walkOf=id=>`${MODEL_FILM_BASE}video/${id}-loop.mp4`;
const COPIES=3,STEP_MS=4000,HOLD_MS=7000;
// 터치 화면은 누른 뒤에도 :hover가 남는다 — 손을 올린 멈춤은 마우스가 있는 화면에서만.
const canHover=()=>typeof matchMedia==='function'&&matchMedia('(hover:hover)').matches;
// 들어가는 순간에 멈출 수 있는 모델인지(복도에 선 모델만).
export const inHall=id=>MOVING_MODELS.includes(id)&&!!modelCard(id);
// 처음 가운데에 설 사람: 하린(시안 A와 같음). 띠는 하린부터 캐스팅북 차례로 선다.
const FIRST='F02';
// 모델 셋마다 세로 완성 광고 하나. 광고는 포스터만 걸고, 누르면 소리와 함께 상영한다(앱의 상영 창).
export function hallItems(){
  const films=FINISHED_FILMS.filter(film=>film.orientation==='portrait'&&film.poster&&film.full?.src);
  const out=[];
  [FIRST,...MOVING_MODELS.filter(id=>id!==FIRST)].map(modelCard).filter(Boolean).forEach((m,i)=>{
    out.push({kind:'model',id:m.id,name:t(m.name,null,'model'),line:t(m.line),still:wallOf(m.id),walk:walkOf(m.id)});
    if(i%3===2&&films.length){const film=films.shift();out.push({kind:'film',id:film.id,name:filmTitle(film),still:film.poster});}
  });
  return out;
}
// 방 무대(2판 ①, 11-24 — 설계 docs/디자인/PULSE고객앱_다시짓기_20261124/방_설계.md 「무대」): 모델만 선 띠. 1판 복도에 없는 모델(M03 — 캐스팅북 세로 그림이 없다)은
// 앱에 있는 그 모델의 사진으로 서고 걷는 영상이 없다.
const modelItem=id=>{const m=modelCard(id);if(!m)return null;const hall=inHall(id);return {kind:'model',id,name:t(m.name,null,'model'),line:t(m.line),still:hall?wallOf(id):m.image,walk:hall?walkOf(id):''};};
export const hallModels=ids=>ids.map(modelItem).filter(Boolean);
const label=item=>item.kind==='model'?t('{name}, {line}',{name:item.name,line:item.line}):t('완성 광고 {title} 보기',{title:item.name});
const tag=item=>item.kind==='model'?`<span class="sx-hall-tag"><span class="sx-hall-name sx-serif">${esc(item.name)}</span><span class="sx-small">${esc(item.line)}</span></span>`:`<span class="sx-hall-tag"><span class="sx-small">${esc(t('완성 광고'))}</span><span class="sx-hall-name sx-serif">${esc(item.name)}</span></span>`;
// start: 처음 가운데에 설 사람(없으면 하린). key: 다시 그려도 같은 띠면 옛 노드를 옮겨 끼우는 열쇠(app.mjs render). hold: 자동 넘김 멈춤 단추(저절로 넘기지 않는 무대 복도는 없다).
// label: 띠 묶음의 이름(무대의 모델 고르기는 「모델 고르기」).
export function hallView(items=hallItems(),{start=FIRST,key='',hold=true,label:name=''}={}){
  const n=items.length,first=Math.max(0,items.findIndex(item=>item.id===start));
  // 세 벌을 잇대어 두고 가운데 벌에서 시작한다 — 끝에 닿으면 같은 사람의 가운데 벌 자리로 조용히 옮긴다. 화면 읽기 · Tab은 가운데 벌 한 칸만 본다.
  const strips=Array.from({length:n*COPIES},(_,k)=>{const item=items[k%n],copy=Math.floor(k/n),near=copy===1&&Math.abs(k%n-first)<=8;return `<button type="button" class="sx-hall-strip is-${item.kind}" data-hall-i="${k}" data-hall-id="${esc(item.id)}" tabindex="-1"${copy===1?'':' aria-hidden="true"'} aria-label="${esc(label(item))}"><img src="${esc(item.still)}" alt="" decoding="async"${near?'':' loading="lazy"'}>${tag(item)}</button>`;}).join('');
  return `<div class="sx-hall" data-hall data-first="${n+first}"${key?` data-hall-key="${esc(key)}"`:''} role="group" aria-label="${esc(name||t('AI 모델과 완성 광고'))}"><div class="sx-hall-track" data-hall-track>${strips}</div><p class="sx-hall-note sx-small">${esc(t('AI로 만든 가상 인물이에요'))}</p>${hold?`<button type="button" class="sx-hall-hold sx-small" data-hall-hold>${esc(t('자동 넘김 멈추기'))}</button>`:''}</div>`;
}
// 한 명 띠(방 무대 — 저희 차례 · 결제 · 글 콘티 도착): 고른 모델 한 명이 무대 가운데에서 걷는다. 띠 하나라 넘기지 않고 누를 것도 없다.
export function hallOne(id){
  const item=modelItem(id);if(!item)return '';
  return `<div class="sx-hall is-one" data-hall-one data-hall-key="one:${esc(id)}" role="img" aria-label="${esc(label(item))}"><div class="sx-hall-track"><div class="sx-hall-strip is-model is-on" data-hall-id="${esc(id)}"${item.walk?` data-walk="${esc(item.walk)}"`:''}><img src="${esc(item.still)}" alt="" decoding="async">${tag(item)}</div></div><p class="sx-hall-note sx-small">${esc(t('AI로 만든 가상 인물이에요'))}</p></div>`;
}
// 붙인 복도 · 띠(노드 → 다룸). 다시 그려도 옮겨 낀 옛 노드는 다시 붙이지 않고, 문서에서 떨어진 것은 sweepHalls가 멈춘다(app.mjs 그리기마다).
const mounted=new WeakMap(),alive=new Set();
const keep=(box,api)=>{mounted.set(box,api);alive.add(api);return api;};
export function sweepHalls(){for(const api of [...alive])if(!api.box.isConnected){api.stop();alive.delete(api);}}
// still(): 영상 없이 그림만 둘 때. 한 명 띠는 숨은 탭 · 움직임 줄이기 · 데이터 절약 · load 전이면 그림만 두고, 그 조건이 풀리면 다시 걷는다(refresh).
export function mountOne(host,{still=()=>false}={}){
  const box=host?.matches?.('[data-hall-one]')?host:host?.querySelector('[data-hall-one]');if(!box)return null;
  if(mounted.has(box))return mounted.get(box);
  const strip=box.querySelector('.sx-hall-strip'),src=strip?.dataset.walk||'';let video=null,gone=false;
  const drop=()=>{if(!video)return;video.pause();video.removeAttribute('src');video.load?.();strip.classList.remove('is-live');video.remove();video=null;};
  function walk(){
    if(gone||!src||still()||document.hidden){drop();return;}
    if(video){const go=video.play?.();if(go?.catch)go.catch(()=>{});return;}
    const v=document.createElement('video');v.muted=true;v.defaultMuted=true;v.loop=true;v.playsInline=true;v.setAttribute('playsinline','');v.setAttribute('aria-hidden','true');v.preload='auto';
    v.addEventListener('playing',()=>{if(video===v)strip.classList.add('is-live');},{once:true});
    v.addEventListener('error',()=>{if(video===v)drop();},{once:true});
    v.src=src;strip.insertBefore(v,strip.querySelector('.sx-hall-tag'));video=v;
    const go=v.play?.();if(go?.catch)go.catch(()=>{});
  }
  const onVisible=()=>{if(document.hidden)video?.pause();else walk();};document.addEventListener('visibilitychange',onVisible);
  const onLoad=()=>walk();if(document.readyState!=='complete')addEventListener('load',onLoad,{once:true});
  walk();
  return keep(box,{box,refresh:walk,stop(){gone=true;drop();document.removeEventListener('visibilitychange',onVisible);removeEventListener('load',onLoad);}});
}

// still(): 영상 없이 그림만 둘 때(움직임 줄이기 · 데이터 절약 · 문서 load 전). quiet(): 넘기지도 않을 때(1쪽 밖 · 상영 · 덮개 아래). onFilm(id): 광고 띠를 눌렀을 때.
// 방 무대(2판 ①): auto:false는 저절로 넘기지 않는다(고른 사람이 가운데에서 걷는다). center는 가운데 띠를 무대 한가운데에 세운다.
// 손님이 띠를 눌러 · 화살표로 가운데를 바꾸면 복도가 「sx-hall-pick」 소식(detail.id)을 보낸다 — 다시 그려 옮겨 낀 복도도 새 화면이 듣는다(방은 누른다고 정하지 않는다).
export function mountHall(host,{items=hallItems(),onFilm,still=()=>false,quiet=()=>false,auto=true,center=false}={}){
  const box=host?.matches?.('[data-hall]')?host:host?.querySelector('[data-hall]');if(!box)return null;
  if(mounted.has(box))return mounted.get(box);
  const track=box.querySelector('[data-hall-track]'),strips=[...box.querySelectorAll('.sx-hall-strip')],holdButton=box.querySelector('[data-hall-hold]');
  const n=items.length;
  let cur=Number(box.dataset.first)||n,timer=0,pause=0,held=false,alone=false,video=null,gone=false;
  const num=name=>parseFloat(getComputedStyle(box).getPropertyValue(name))||0;
  const wide=()=>{const w=box.clientWidth,h=box.clientHeight;if(alone)return Math.min(h*9/16,w);return Math.min(h*9/16,w*(w<520?.62:.46));};
  const anchor=()=>box.clientWidth<520?.2:.3;
  function place(animate=true){
    const w1=wide(),w0=num('--sx-w0'),gap=num('--sx-gap');
    box.style.setProperty('--sx-w1',`${w1}px`);
    const x=alone?(box.clientWidth-w1)/2:center?(box.clientWidth-w1)/2-cur*(w0+gap):box.clientWidth*anchor()-cur*(w0+gap);
    if(!animate)track.classList.add('is-still');
    track.style.transform=`translateX(${x}px)`;
    if(!animate){void track.offsetWidth;track.classList.remove('is-still');}
  }
  const dropVideo=()=>{if(!video)return;video.pause();video.removeAttribute('src');video.load?.();video.closest('.sx-hall-strip')?.classList.remove('is-live');video.remove();video=null;};
  function walk(strip){
    dropVideo();
    const item=items[Number(strip.dataset.hallI)%n];
    if(item.kind!=='model'||!item.walk||still()||gone)return;
    const v=document.createElement('video');v.muted=true;v.defaultMuted=true;v.loop=true;v.playsInline=true;v.setAttribute('playsinline','');v.setAttribute('aria-hidden','true');v.preload='auto';
    v.addEventListener('playing',()=>{if(video===v)strip.classList.add('is-live');},{once:true});
    v.addEventListener('error',()=>{if(video===v)dropVideo();},{once:true});
    v.src=item.walk;strip.insertBefore(v,strip.querySelector('.sx-hall-tag'));video=v;
    const go=v.play?.();if(go?.catch)go.catch(()=>{});
  }
  function set(i,animate=true){
    // 가운데 벌 밖으로 나가려 하면 지금 자리를 같은 사람의 한 벌 건너 자리로 움직임 없이 옮긴 뒤 이어 간다 — 가운데(화면 읽기 · Tab이 보는 칸)는 늘 가운데 벌이다.
    if(i<n||i>=n*2){const shift=i<n?n:-n,from=strips[cur];from?.classList.remove('is-on');from?.setAttribute('tabindex','-1');dropVideo();cur+=shift;strips[cur].classList.add('is-on');place(false);i+=shift;}
    const was=strips[cur];was?.classList.remove('is-on');was?.setAttribute('tabindex','-1');
    cur=i;const strip=strips[cur];strip.classList.add('is-on');strip.setAttribute('tabindex','0');
    if(box.querySelector(':focus-visible')&&document.activeElement!==holdButton)strip.focus({preventScroll:true});
    walk(strip);place(animate);
  }
  const busy=()=>held||alone||gone||quiet()||document.hidden||reduced()||Date.now()<pause||(canHover()&&box.matches(':hover'))||!!box.querySelector(':focus-visible');
  const tick=()=>{if(!busy())set(cur+1);};
  const start=()=>{clearInterval(timer);if(auto)timer=setInterval(tick,STEP_MS);};
  const hold=()=>{pause=Date.now()+HOLD_MS;};
  const picked=()=>box.dispatchEvent(new CustomEvent('sx-hall-pick',{bubbles:true,detail:{id:strips[cur]?.dataset.hallId||''}}));
  box.addEventListener('click',event=>{
    if(event.target.closest('[data-hall-hold]')){held=!held;holdButton.textContent=held?t('자동 넘김 다시 켜기'):t('자동 넘김 멈추기');return;}
    const strip=event.target.closest('.sx-hall-strip');if(!strip||alone)return;
    const i=Number(strip.dataset.hallI),item=items[i%n];hold();
    if(item.kind==='film'&&i===cur){onFilm?.(item.id);return;}
    if(i!==cur){set(i);picked();}
  });
  // 좌우 화살표는 초점이 복도 안에 있을 때만 받는다(쪽 넘김은 위아래 화살표라 겹치지 않는다).
  box.addEventListener('keydown',event=>{if(alone||!['ArrowLeft','ArrowRight'].includes(event.key)||event.target===holdButton)return;event.preventDefault();event.stopPropagation();hold();set(cur+(event.key==='ArrowRight'?1:-1));picked();});
  const onResize=()=>place(false);addEventListener('resize',onResize);
  const onVisible=()=>{if(document.hidden)video?.pause();else if(video&&!still()){const go=video.play?.();if(go?.catch)go.catch(()=>{});}else if(!video&&!still())walk(strips[cur]);};document.addEventListener('visibilitychange',onVisible);
  set(cur,false);start();
  return keep(box,{
    box,
    // 그 사람(가장 가까운 자리)을 가운데로 세운다. 없으면 false.
    to(id){const near=strips.map((s,i)=>s.dataset.hallId===id?i:-1).filter(i=>i>=0).sort((a,b)=>Math.abs(a-cur)-Math.abs(b-cur))[0];if(near===undefined)return false;set(near);return true;},
    // 그 사람만 남기고 나머지 띠를 접는다(들어가는 순간). 움직임이 끝나는 대로 다음 일을 하도록 띠를 돌려준다.
    focus(id){if(!this.to(id))return null;alone=true;box.classList.add('is-alone');strips.forEach((s,i)=>s.classList.toggle('is-gone',i!==cur));place(true);return strips[cur];},
    // 띠에 쓰는 영상을 이어 가거나 다시 그림으로(움직임 줄이기 · 데이터 절약이 바뀔 때).
    refresh(){if(still())dropVideo();else if(!video)walk(strips[cur]);place(false);},
    get current(){return items[cur%n];},
    stop(){gone=true;clearInterval(timer);dropVideo();removeEventListener('resize',onResize);document.removeEventListener('visibilitychange',onVisible);},
  });
}
