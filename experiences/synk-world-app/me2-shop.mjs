// 「제2의 나」 캠퍼스 옷 가게(2026-11-05 · 유호님 A판 — 흰 회백 바탕 · 곧은 금속 봉). 팁 장부 44 · 45행, 설계 docs/디자인/끌어넘기기_구현준비_20261104.md 「앱에 넣기 설계」.
// · 시안 experiences/drama/shop/shop.mjs를 옮겼다: 봉 처짐 · 옷걸이 흔들림 · 마우스 올림 · 끌어 넘기기(공용 부품 DragRail) · 자세히 · 앞뒤 돌림 · 포장 · 배송 조회 · 입은 나.
// · 제2의 나 시트가 <dialog>.showModal()이라 가게는 body에 붙이는 두 번째 <dialog>로 연다 — 뒤 inert · Tab 가둠 · Esc는 겹 모달이 해 준다(Fable 설계 검토 P1).
// · 상태는 제2의 나가 넘긴다(update). 동작(주문 · 입기 · 벗기 · 다시 · 본 표시)은 제2의 나가 준 함수로 서버에 가고, 그 뒤 제2의 나가 상태를 다시 넘긴다.
// · 값은 화면에 없다(재화 보류). 움직임 줄이기 · 효과음은 앱 설정을 따른다. 마스코트는 쓰지 않는다.
import '../play-common/drag-rail.js';
import {ITEM_TEXT,SHOP_TEXT,PACK_STEPS,printNote,shopItemsFor,shopEntry} from './me2-shop-items.mjs';
import {getPref} from '../brand-opening/world-sound.mjs';
import {createShopSound} from './me2-shop-sound.mjs';

const STYLE_URL=new URL('./me2-shop.css',import.meta.url).href;
const asset=name=>new URL(`./me2-assets/${name}`,import.meta.url).href;
const art=(item,side)=>asset(`shop-${item.art}-${side}.webp`);
const PACKED_KEY='synk.world.me2.shop.packed';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),lerp=(a,b,k)=>a+(b-a)*k,pad2=n=>String(n).padStart(2,'0');
const LOCALE={ko:'ko-KR',en:'en-US',mn:'mn-MN'};
const HANGER_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.2a1.9 1.9 0 1 1 1.9 1.9c-.9 0-1.9.7-1.9 1.6v.6m0 0L3.6 15.6a1 1 0 0 0 .6 1.9h15.6a1 1 0 0 0 .6-1.9Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SEAL='<svg viewBox="0 0 44 44"><defs><path id="m2s-seal-ring" d="M22 22m-15.2 0a15.2 15.2 0 1 1 30.4 0a15.2 15.2 0 1 1-30.4 0"/></defs><circle cx="22" cy="22" r="21.4" fill="#EFE6D6"/><circle cx="22" cy="22" r="20.4" fill="none" stroke="rgba(110,85,50,.3)" stroke-width=".6"/><text font-size="4.4" letter-spacing=".9" fill="#6E5A3E" font-family="ui-monospace, monospace"><textPath href="#m2s-seal-ring">SYNK WORLD · CAMPUS · SYNK WORLD · CAMPUS ·</textPath></text><g transform="translate(15.5 15) scale(.55)"><path d="M12 6.2a1.9 1.9 0 1 1 1.9 1.9c-.9 0-1.9.7-1.9 1.6v.6m0 0L3.6 15.6a1 1 0 0 0 .6 1.9h15.6a1 1 0 0 0 .6-1.9Z" fill="none" stroke="#3A3833" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';

export {shopItemsFor,shopEntry};

export function createMe2Shop({doc=globalThis.document,win=globalThis,lang=()=> 'ko',actions,soundOn=()=>getPref('sound'),onClosed=()=>{}}){
 const R=win.DragRail;
 let view=null,fresh=new Set(),items=[],dialog=null,$=null,builtKey='',disposed=false,opening=null;
 let dr=null,sound=null,raf=0,turnRaf=0,lastT=0,quietSince=0,lastCenter=-1;
 const timers=new Set();
 const L=()=>SHOP_TEXT[lang()]?lang():'ko';
 const t=(key,vars)=>{let out=SHOP_TEXT[L()][key]??SHOP_TEXT.ko[key]??key;for(const [k,v] of Object.entries(vars||{}))out=out.replaceAll(`{${k}}`,v);return out;};
 const tx=id=>ITEM_TEXT[L()]?.[id]||ITEM_TEXT.ko[id];
 const kx=id=>ITEM_TEXT.ko[id];
 const reduce=()=>{const r=doc.documentElement;return r.dataset.reduced==='true'||r.dataset.motion==='reduced'||Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches);};
 const later=(fn,ms)=>{const id=win.setTimeout(()=>{timers.delete(id);if(!disposed)fn();},ms);timers.add(id);return id;};
 const closed=()=>view?.status==='off';
 const entry=id=>shopEntry(view?.looks,id);
 const wearing=card=>Boolean(card&&view?.me?.equipped_look===card.job_id);
 const isOpen=()=>Boolean(dialog?.open);

 // ── 때 · 날짜 — 기기 시간대로(몽골 학생에게 한국 시각을 보이지 않는다) ──
 const fmt=(value,opts)=>{try{return new Intl.DateTimeFormat(LOCALE[L()],opts).format(new Date(value));}catch{return '';}};
 const day0=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
 function stamp(value){const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';const time=fmt(d,{hour:'numeric',minute:'2-digit'});return day0(d)===day0(new Date())?time:`${fmt(d,{month:'long',day:'numeric'})} ${time}`;}
 function byWhen(value){
  const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';
  const up=new Date(d);up.setMinutes(0,0,0);if(up<d)up.setHours(up.getHours()+1); // 분 단위 마감은 계산기 값으로 읽힌다 — 다음 정시로
  const hour=fmt(up,{hour:'numeric'}),diff=Math.round((day0(up)-day0(new Date()))/864e5);
  return diff===0?t('today',{time:hour}):diff===1?t('tomorrow',{time:hour}):`${fmt(up,{month:'long',day:'numeric'})} ${hour}`;
 }
 const dayText=value=>fmt(value,{month:'long',day:'numeric'});

 // ── 그리기 ──
 function tagHtml(item,i){
  const e=entry(item.id);
  if(e.state==='arrived'&&e.arrived.url){const isNew=fresh.has(e.arrived.job_id)||e.arrived.new;return `<span class="m2s-print-tag" aria-hidden="true"><img src="${esc(e.arrived.url)}" alt="" draggable="false">${isNew?`<b class="m2s-new">${esc(t('newMark'))}</b>`:''}</span>`;}
  if(e.state==='open'||(e.state==='arrived'&&!e.arrived.url))return '';
  const word=e.state==='failed'?t('failedTag'):t('shipping');
  return `<span class="m2s-tag" data-state="${e.state}" aria-hidden="true"><b>No.${pad2(i+1)}</b><span><i></i>${esc(word)}</span></span>`;
 }
 const stateWord=item=>{const e=entry(item.id);return e.state==='open'?'':e.state==='arrived'?(wearing(e.arrived)?t('wearing'):t('mine')):e.state==='failed'?t('failed'):t('shipping');};
 const hangerLabel=item=>{const w=stateWord(item);return `${kx(item.id).name}${L()==='ko'?'':` · ${tx(item.id).name}`}${w?` — ${w}`:''}`;};
 function shellHtml(){
  const n=items.length;
  return `<div class="m2s" data-ready="no" data-mode="" lang="${L()}">
 <header class="m2s-top"><p class="m2s-mark"><span>SYNK WORLD</span><span>${esc(t('shop'))}</span></p>
  <button type="button" class="m2s-box" data-act="closet">${HANGER_ICON}<span class="m2s-box-text">${esc(t('closet'))}</span><span class="m2s-box-count" data-count="0"></span></button></header>
 <section class="m2s-floor" aria-label="${esc(t('shop'))}">
  <svg class="m2s-rod" aria-hidden="true" preserveAspectRatio="none"><path class="m2s-rod-shadow" d=""/><path class="m2s-rod-bar" d=""/><path class="m2s-rod-body" d=""/><path class="m2s-rod-shine" d=""/><rect class="m2s-rod-plate" width="10" height="26" rx="2"/><rect class="m2s-rod-plate" width="10" height="26" rx="2"/><circle class="m2s-rod-cap" r="5.5"/><circle class="m2s-rod-cap" r="5.5"/></svg>
  <ol class="m2s-rail" tabindex="0" aria-label="${esc(t('rail',{n}))}">${items.map((item,i)=>`<li class="m2s-slot" data-i="${i}"><button type="button" class="m2s-hanger" data-i="${i}" aria-label="${esc(hangerLabel(item))}"><span class="m2s-swing"><img src="${esc(art(item,'front'))}" alt="" draggable="false" decoding="async">${tagHtml(item,i)}</span></button></li>`).join('')}</ol>
  <div class="m2s-caption" aria-live="polite"><p class="m2s-caption-n"></p><p class="m2s-caption-name" lang="ko"></p><p class="m2s-caption-sub"></p><p class="m2s-caption-note"></p></div>
  <button type="button" class="m2s-more" data-act="more">${esc(t('more'))}</button>
  <p class="m2s-hint">${esc(t('hint'))}</p>
  <div class="m2s-title"><p class="m2s-kicker">${esc(t('kicker',{n}))}</p><h2>${esc(t('title'))}</h2></div>
  <div class="m2s-dots" aria-hidden="true">${items.map(()=>'<i></i>').join('')}</div>
 </section>
 <div class="m2s-veil" aria-hidden="true"></div>
 <section class="m2s-stage" hidden tabindex="-1" aria-label="${esc(t('detail'))}">
  <button type="button" class="m2s-step" data-act="prev" aria-label="${esc(t('prev'))}"></button><button type="button" class="m2s-step" data-act="next" aria-label="${esc(t('next'))}"></button>
  <div class="m2s-turn-wrap" data-view="garment">
   <div class="m2s-turn" aria-hidden="true"><img class="m2s-face is-front" alt="" draggable="false"><img class="m2s-face is-back" alt="" draggable="false"></div>
   <div class="m2s-tissue" aria-hidden="true"><i></i><i></i><b>${SEAL}</b></div>
   <figure class="m2s-print"><img alt="" draggable="false"><figcaption lang="ko"></figcaption></figure>
  </div>
  <div class="m2s-info">
   <p class="m2s-num"></p><h3 class="m2s-name" lang="ko"></h3><p class="m2s-name-tr"></p>
   <p class="m2s-story"></p><button type="button" class="m2s-readko" data-act="readko" aria-expanded="false" hidden></button><p class="m2s-story-ko" lang="ko" hidden></p>
   <dl class="m2s-spec"></dl><section class="m2s-tip" aria-label="${esc(t('tipHead'))}"></section>
   <div class="m2s-side" role="radiogroup" aria-label="${esc(t('view'))}"></div>
   <ol class="m2s-track" hidden aria-label="${esc(t('track'))}"></ol>
   <div class="m2s-actions"></div><p class="m2s-help"></p>
  </div>
 </section>
 <button type="button" class="m2s-close" data-act="close">${esc(t('close'))}</button>
 <div class="m2s-parcel" hidden aria-hidden="true"><img class="m2s-parcel-open" alt="" src="${esc(asset('shop-box-open.webp'))}"><img class="m2s-parcel-closed" alt="" src="${esc(asset('shop-box-closed.webp'))}">
  <div class="m2s-label"><p class="m2s-label-head">${esc(t('labelHead'))}</p><p><span>${esc(t('labelTo'))}</span><b>${esc(t('labelToValue'))}</b></p><p><span>${esc(t('labelItem'))}</span><b class="m2s-label-item"></b></p><p class="m2s-label-from"><span>${esc(t('labelFrom'))}</span><b>${esc(t('labelFromValue'))} · <em class="m2s-label-date"></em></b></p><i class="m2s-label-code"></i><p class="m2s-label-no"></p></div><i class="m2s-parcel-tape" aria-hidden="true"></i></div>
 <p class="m2s-pack" role="status" hidden><span class="m2s-pack-text" lang="ko"></span><span class="m2s-pack-tr"></span><span class="m2s-pack-skip">${esc(t('skip'))}</span></p>
 <p class="m2s-toast" role="status" hidden></p>
</div>`;
 }

 // ── 봉 · 흔들림(시안 그대로) ──
 let shop,floor,rail,rod,stage,turnWrap,turn,faceF,faceB,slots,hangers,swings,dots,P=[];
 let fit=false,slotW=0,artH=0,railW=0,rodY=0,S=0,Sv=0,Starget=0,active=0,hover=-1,pos=0,lastPos=0;
 function grab(){
  const q=s=>dialog.querySelector(s);
  shop=q('.m2s');floor=q('.m2s-floor');rail=q('.m2s-rail');rod=q('.m2s-rod');stage=q('.m2s-stage');turnWrap=q('.m2s-turn-wrap');turn=q('.m2s-turn');faceF=q('.m2s-face.is-front');faceB=q('.m2s-face.is-back');
  slots=[...rail.querySelectorAll('.m2s-slot')];hangers=slots.map(li=>li.querySelector('.m2s-hanger'));swings=slots.map(li=>li.querySelector('.m2s-swing'));dots=[...dialog.querySelectorAll('.m2s-dots i')];
  P=items.map((_,i)=>({th:0,om:0,k:44+((i*37)%11),x:null,vx:0,ax:0,s:1,push:0,drop:0,dropV:0,far:null}));
  $=q;
 }
 function measure(){
  if(!slots.length)return;
  const cs=win.getComputedStyle(slots[0]);
  slotW=parseFloat(cs.width);artH=parseFloat(cs.height);railW=rail.clientWidth;
  const canFit=Boolean(win.matchMedia?.('(hover: hover) and (pointer: fine)').matches)&&slotW*items.length+slotW*1.4<=railW;
  if(canFit!==fit){fit=canFit;rail.classList.toggle('is-fit',fit);if(fit)rail.scrollLeft=0;else{rail.scrollLeft=active*slotW;pos=active;lastPos=pos;lastCenter=active;}}
  rodY=rail.offsetTop+22+artH*.025+Math.max(2,artH*.006);
  Starget=0; // 봉은 멈추면 곧다 — 처짐은 옷이 떨어져 걸릴 때만(Fable 11-05)
  rod.setAttribute('viewBox',`0 0 ${floor.clientWidth} ${floor.clientHeight}`);
 }
 const centerX=i=>fit?(railW-slotW*items.length)/2+slotW*(i+.5):railW/2+(i-pos)*slotW;
 function span(){if(!fit)return [0,railW];return [Math.max(20,centerX(0)-slotW*2.3),Math.min(railW-20,centerX(items.length-1)+slotW*2.3)];}
 const sagAt=x=>{const [a,b]=span();return R.sagAt(x,a,b,S);};
 function drawRod(){
  const [a,b]=span();let d='';
  for(let x=a;x<=b+.5;x+=16)d+=(d?'L':'M')+x.toFixed(1)+' '+(rodY+sagAt(x)).toFixed(2);
  d+=`L${b.toFixed(1)} ${(rodY+sagAt(b)).toFixed(2)}`;
  for(const cls of ['bar','shadow','shine','body'])rod.querySelector(`.m2s-rod-${cls}`).setAttribute('d',d);
  rod.querySelectorAll('.m2s-rod-plate').forEach((r,j)=>{r.style.display=fit?'':'none';r.setAttribute('x',(j?b:a)-5);r.setAttribute('y',rodY+sagAt(j?b:a)-13);});
  rod.querySelectorAll('.m2s-rod-cap').forEach((c,j)=>{c.style.display=fit?'':'none';c.setAttribute('cx',j?b:a);c.setAttribute('cy',rodY+sagAt(j?b:a));});
 }
 function wake(){quietSince=win.performance.now();if(!raf&&isOpen()){lastT=win.performance.now();raf=win.requestAnimationFrame(frame);}}
 function frame(now){
  raf=0;if(!isOpen()||!slots.length)return;
  const dt=clamp((now-lastT)/1000,.001,.05);lastT=now;
  pos=fit?0:R.positionOf(rail.scrollLeft,slotW);
  const posV=(pos-lastPos)/dt;lastPos=pos;
  const Sa=-140*(S-Starget)-9*Sv;Sv+=Sa*dt;S+=Sv*dt;
  const center=fit?(hover>=0?hover:-1):R.nearestIndex(pos,items.length);
  if(!fit&&center!==lastCenter&&lastCenter!==-1)sound?.tick(Math.min(1,Math.abs(posV)/6));
  if(center!==lastCenter){lastCenter=center;if(center>=0)setActive(center);}
  if(!fit)sound?.slide(Math.min(1,Math.abs(posV)/9));
  let moving=Math.abs(Sv)>.3||Math.abs(S-Starget)>.3||Math.abs(posV)>.02;
  const ease=1-Math.exp(-dt*13),still=reduce();
  for(let i=0;i<items.length;i++){
   const p=P[i];let sT=1,pushT=0;
   if(fit){if(hover>=0){const d=i-hover;sT=d===0?1.17:1;pushT=d===0?0:Math.sign(d)*slotW*[0,.24,.1,.04][Math.min(3,Math.abs(d))];}}
   else sT=1-.08*Math.min(Math.abs(i-pos),1);
   p.s=still?sT:lerp(p.s,sT,ease);p.push=still?pushT:lerp(p.push,pushT,ease);
   const x=centerX(i)+p.push;if(p.x===null)p.x=x;
   const vx=(x-p.x)/dt;p.ax=lerp(p.ax,(vx-p.vx)/dt,.35);p.vx=vx;p.x=x;
   if(!still){const n=R.swingStep(p,p.ax,dt,{k:p.k,len:artH*.42});p.th=n.th;p.om=n.om;}else{p.th=0;p.om=0;}
   if(p.drop!==0||p.dropV!==0){p.dropV+=(-260*p.drop-20*p.dropV)*dt;p.drop+=p.dropV*dt;if(Math.abs(p.drop)<.2&&Math.abs(p.dropV)<2){p.drop=0;p.dropV=0;}}
   const y=sagAt(x)+p.drop;
   hangers[i].style.transform=`translate3d(${(x-centerX(i)).toFixed(2)}px,${y.toFixed(2)}px,0) scale(${p.s.toFixed(4)})`;
   hangers[i].style.zIndex=fit?(i===hover?20:10-Math.abs(i-(hover>=0?hover:(items.length-1)/2))|0):20-Math.round(Math.abs(i-pos)*2);
   swings[i].style.transform=`rotate(${(p.th*57.2958).toFixed(3)}deg)`;
   const far=!fit&&Math.abs(i-pos)>1.15; // 휴대폰에서 화면 끝에 잘리는 꼬리표는 숨긴다
   if(far!==p.far){p.far=far;hangers[i].classList.toggle('is-far',far);}
   if(Math.abs(p.om)>.004||Math.abs(p.th)>.002||Math.abs(p.s-sT)>.001||Math.abs(p.push-pushT)>.3||p.drop)moving=true;
  }
  drawRod();
  if(moving||now-quietSince<300)raf=win.requestAnimationFrame(frame);else sound?.slide(0);
 }
 function setActive(i){
  active=i;const item=items[i];if(!item)return;const w=stateWord(item);
  $('.m2s-caption-n').textContent=`${pad2(i+1)} / ${pad2(items.length)}${w?` · ${w}`:''}`;
  $('.m2s-caption-name').textContent=kx(item.id).name;
  $('.m2s-caption-sub').textContent=L()==='ko'?'':tx(item.id).name;
  $('.m2s-caption-note').textContent=tx(item.id).note;
  dots.forEach((d,j)=>d.classList.toggle('on',j===i));
 }

 // ── 자세히 ──
 let openI=-1,side='front',th=0,thV=0,thTarget=0,sw=0,swV=0,turning=null,busy=false,pack=null;
 function wearHtml(item){
  const w=tx(item.id).wear,other=item.pair&&items.findIndex(x=>x.id===item.pair);
  return esc(w).replace(/\[\[(.+?)\]\]/g,(_,label)=>other>=0?`<button type="button" class="m2s-pair" data-act="pair" data-to="${other}">${label}</button>`:label);
 }
 function tipHtml(item){
  const words=item.words||[];
  const sentence=esc(item.tip).replace(/\{(.+?)\}/g,(_,w)=>{const n=words.findIndex(([f])=>f===w);return n<0?w:`<button type="button" class="m2s-word" data-act="word" data-w="${n}" aria-expanded="false" aria-controls="m2s-word-gloss" aria-label="${esc(w)} — ${esc(t('wordOpen'))}">${w}</button>`;});
  const tr=L()==='ko'?'':tx(item.id).tip;
  return `<p class="m2s-tip-head"><span>${esc(t('tipHead'))}</span><span class="m2s-tip-chips" aria-hidden="true">${item.colors.map(([,c])=>`<i style="--c:${c}"></i>`).join('')}</span><span class="m2s-tip-names" lang="ko">${item.colors.map(([n])=>esc(n)).join(' · ')}</span></p>
   <p class="m2s-tip-text" lang="ko">${sentence}</p><div class="m2s-word-gloss" id="m2s-word-gloss" role="region" aria-live="polite"><p><b lang="ko"></b><span></span></p></div>${tr?`<p class="m2s-tip-tr">${esc(tr)}</p>`:''}`;
 }
 function toggleWord(b){
  const item=items[openI],w=item?.words?.[Number(b.dataset.w)],g=$('.m2s-word-gloss');if(!w||!g)return;
  const same=b.getAttribute('aria-expanded')==='true';
  for(const x of dialog.querySelectorAll('.m2s-word'))x.setAttribute('aria-expanded','false');
  if(same){g.classList.remove('is-open');return;}
  g.querySelector('b').textContent=w[1];g.querySelector('span').textContent=tx(item.id).words?.[w[0]]||kx(item.id).words[w[0]]||'';
  b.setAttribute('aria-expanded','true');g.classList.add('is-open');
 }
 function trackHtml(card){
  if(card.state==='delayed')return [[t('tOrdered'),stamp(card.ordered_at),'done'],[t('tDelayed',{date:dayText(card.arrives_after)}),'','now']].map(row).join('');
  const sent=Boolean(card.sent_at),late=card.arrives_by&&Date.parse(card.arrives_by)<Date.now();
  return [[t('tOrdered'),stamp(card.ordered_at),'done'],sent?[t('tSent'),stamp(card.sent_at),'done']:[t('tSoon'),'','now'],[t('tMaking'),'',sent?'now':''],
   [t('tEta'),late?t('etaLate'):card.arrives_by?t('etaBy',{when:byWhen(card.arrives_by)}):'','']].map(row).join('');
  function row([label,time,k]){return `<li ${k==='done'?'data-done':k==='now'?'data-now':''}><span>${esc(label)}</span><time>${esc(time)}</time></li>`;}
 }
 function actionsHtml(item){
  const e=entry(item.id),out=[];let help='';
  // 받은 옷은 다시 입혀 보는 중에도 입고 벗을 수 있다(쉬는 동안에도 된다 — 11-05 결정).
  if(e.arrived){const on=wearing(e.arrived);out.push(`<button type="button" class="m2s-go" data-act="${on?'unwear':'wear'}">${esc(t(on?'takeOff':'wear'))}</button>`);help=e.arrived.arrived_at?t('arrivedOn',{date:dayText(e.arrived.arrived_at)}):'';}
  if(e.flight)out.push(`<p class="m2s-wait">${esc(t('waitNote'))}</p>`);
  else if(e.arrived){if(!closed())out.push(`<button type="button" class="m2s-quiet" data-act="redo">${esc(t('redoLook'))}</button>`);}
  else if(closed())out.push(`<p class="m2s-wait">${esc(t('off'))}</p>`);
  else{out.push(`<button type="button" class="m2s-go" data-act="order">${esc(t(e.state==='failed'?'again':'order'))}</button>`);help=e.state==='failed'?t('failed'):t('orderHelp');}
  return {html:out.join(''),help};
 }
 /** 글을 다시 쓰면 초점이 있던 단추가 사라져 초점이 가게 밖(inert인 뒤 앱)으로 빠진다 — 같은 단추나 자세히 판으로 되돌린다. */
 function holdFocus(fn){
  const was=doc.activeElement,inInfo=was&&dialog?.contains(was)&&was.closest?.('.m2s-info'),act=was?.dataset?.act,side=was?.dataset?.side;
  fn();
  if(!inInfo||dialog.contains(doc.activeElement)&&doc.activeElement!==doc.body)return;
  const again=(act&&dialog.querySelector(`.m2s-info [data-act="${act}"]`))||(side&&dialog.querySelector(`.m2s-side [data-side="${side}"]`));
  (again||stage).focus({preventScroll:true});
 }
 function fillInfo(i,opts){holdFocus(()=>fillInfoNow(i,opts));}
 function fillInfoNow(i,{keepSide=false}={}){
  const item=items[i],x=tx(item.id),k=kx(item.id),e=entry(item.id),ko=L()==='ko';
  $('.m2s-num').textContent=`${pad2(i+1)} / ${pad2(items.length)}`;
  $('.m2s-name').textContent=k.name;
  const sub=$('.m2s-name-tr');sub.textContent=ko?'':x.name;sub.hidden=ko;
  $('.m2s-story').textContent=x.story;
  const readKo=$('.m2s-readko'),storyKo=$('.m2s-story-ko');
  readKo.hidden=ko;storyKo.textContent=k.story;
  if(!keepSide){readKo.setAttribute('aria-expanded','false');storyKo.hidden=true;}
  readKo.textContent=t(readKo.getAttribute('aria-expanded')==='true'?'readKoOff':'readKo');
  $('.m2s-spec').innerHTML=[[t('material'),esc(x.spec[0])],[t('fit'),esc(x.spec[1])],[t('length'),esc(x.spec[2])],[t('pair'),wearHtml(item)]].map(([dt,dd])=>`<dt>${esc(dt)}</dt><dd>${dd}</dd>`).join('');
  $('.m2s-tip').innerHTML=tipHtml(item);
  const worn=e.arrived?.url||null,sides=worn?['front','back','worn']:['front','back'];
  if(!sides.includes(side))side='front';
  $('.m2s-side').innerHTML=sides.map(s=>`<button type="button" role="radio" data-side="${s}" aria-checked="${s===side}">${esc(t(s))}</button>`).join('');
  $('.m2s-side').dataset.on=side;
  const print=$('.m2s-print img');
  if(worn){if(print.getAttribute('src')!==worn)print.src=worn;print.alt=`${t('wornAlt')}${e.arrived.arrived_at?` · ${dayText(e.arrived.arrived_at)}`:''}`;$('.m2s-print figcaption').textContent=printNote(e.arrived.arrived_at);}
  else{print.removeAttribute('src');print.alt='';$('.m2s-print figcaption').textContent='';}
  const track=$('.m2s-track');track.hidden=!e.flight;track.innerHTML=e.flight?trackHtml(e.flight):'';
  const act=actionsHtml(item);$('.m2s-actions').innerHTML=act.html;$('.m2s-help').textContent=act.help;
  if(!keepSide){for(const el of $('.m2s-info').children){el.style.animation='none';void el.offsetWidth;el.style.animation='';}if(stage.scrollTop)stage.scrollTop=0;}
  if(e.arrived?.new)seen(e.arrived);
 }
 function markSide(s){for(const b of dialog.querySelectorAll('.m2s-side button'))b.setAttribute('aria-checked',String(b.dataset.side===s));$('.m2s-side').dataset.on=s;}
 function setFaces(i){faceF.src=art(items[i],'front');faceB.src=art(items[i],'back');}
 function ghost(i){slots.forEach((li,j)=>li.classList.toggle('is-ghost',Math.abs(j-i)>1));}
 function openDetail(i){
  if(busy||!items[i])return;
  openI=i;side='front';th=0;thTarget=0;thV=0;
  setFaces(i);fillInfo(i);setSide('front',true);
  stage.hidden=false;shop.dataset.mode='detail';ghost(i);sound?.pick();
  const from=swings[i].querySelector('img').getBoundingClientRect(),to=turnWrap.getBoundingClientRect();
  hangers[i].style.visibility='hidden';
  sw=P[i].th;swV=P[i].om+(Math.random()<.5?-.5:.5);
  if(!reduce()){
   const dx=from.left+from.width/2-(to.left+to.width/2),dy=from.top-to.top,sc=from.width/Math.max(1,to.width);
   // 큰 판을 먼저 풀어 둔 뒤 움직인다 — 풀기 전에 움직이면 첫 몇 장을 GPU가 그리느라 버린다(11-05 추적)
   const fly=turnWrap.animate([{transform:`translate(${dx}px,${dy}px) scale(${sc})`},{transform:'none'}],{duration:640,easing:'cubic-bezier(.2,.75,.2,1)'});
   fly.pause();Promise.race([faceF.decode().catch(()=>{}),new Promise(r=>later(r,90))]).then(()=>fly.play());
  }
  runTurn();
  $('.m2s-close').focus({preventScroll:true});
 }
 function closeDetail({quick=false}={}){
  if(openI<0)return;
  const i=openI;
  const back=()=>{stage.hidden=true;hangers[i].style.visibility='';openI=-1;P[i].om+=.35;wake();if(isOpen())hangers[i].focus({preventScroll:true});};
  shop.dataset.mode='';turnWrap.dataset.view='garment';sound?.drop();
  if(quick||reduce())return back();
  const from=turnWrap.getBoundingClientRect(),to=swings[i].querySelector('img').getBoundingClientRect();
  const dx=to.left+to.width/2-(from.left+from.width/2),dy=to.top-from.top,sc=to.width/Math.max(1,from.width);
  thTarget=Math.round(th/360)*360;
  turnWrap.animate([{transform:'none'},{transform:`translate(${dx}px,${dy}px) scale(${sc})`}],{duration:480,easing:'cubic-bezier(.4,0,.2,1)'}).finished.then(back,back);
 }
 function step(d,to){
  if(openI<0||busy)return;
  const n=to??clamp(openI+d,0,items.length-1);
  if(to!==undefined)d=Math.sign(to-openI)||1;
  if(n===openI){swV+=d*.9;sound?.bump();runTurn();return;}
  const old=openI;hangers[old].style.visibility='';openI=n;hangers[n].style.visibility='hidden';
  if(!fit)dr?.go(n,false);else hover=n;
  setActive(n);wake();ghost(n);sound?.tick(.6);
  const still=reduce();
  const out=turnWrap.animate([{transform:'none',opacity:1},{transform:`translateX(${-d*36}%)`,opacity:0}],{duration:still?1:200,easing:'cubic-bezier(.55,0,.75,.2)'});
  out.finished.then(()=>{
   if(openI!==n)return;
   th=0;thTarget=0;thV=0;side='front';setFaces(n);fillInfo(n);setSide('front',true);sw=0;swV=-d*.8;
   turnWrap.animate([{transform:`translateX(${d*36}%)`,opacity:0},{transform:'none',opacity:1}],{duration:still?1:420,easing:'cubic-bezier(.2,.75,.2,1)'});
   runTurn();
  },()=>{});
 }
 function setSide(s,quiet){
  const wasWorn=turnWrap.dataset.view==='worn';
  side=s;markSide(s);turnWrap.dataset.view=s==='worn'?'worn':'garment';
  if(s==='worn'){if(!quiet)sound?.print();return;}
  if(!quiet){thTarget=(s==='back'?180:0)+Math.round((th-(s==='back'?180:0))/360)*360;if(!wasWorn||s==='back')sound?.turn();runTurn();}
 }
 function runTurn(){
  if(turnRaf)return;let t0=win.performance.now();
  const go=now=>{turnRaf=0;if(!isOpen())return;const dt=clamp((now-t0)/1000,.001,.05);t0=now;if(turnStep(dt))turnRaf=win.requestAnimationFrame(go);};
  turnRaf=win.requestAnimationFrame(go);
 }
 function turnStep(dt){
  const still=reduce();
  if(!turning){if(still){th=thTarget;thV=0;}else{const a=-95*(th-thTarget)-15*thV;thV+=a*dt;th+=thV*dt;}}
  if(!still){const a=-40*Math.sin(sw)-2.6*swV;swV+=a*dt;sw=clamp(sw+swV*dt,-.2,.2);}else{sw=0;swV=0;}
  const r=((th%360)+360)%360,edge=Math.abs(Math.sin(r*Math.PI/180));
  turn.style.transform=`rotateZ(${(sw*57.3).toFixed(3)}deg) rotateY(${th.toFixed(2)}deg)`;
  const shade=`brightness(${(1-.24*edge).toFixed(3)})`;
  faceF.style.filter=faceB.style.filter=edge>.01?`${shade} drop-shadow(0 22px 26px rgba(40,32,22,.18))`:'';
  const nowSide=r>90&&r<270?'back':'front';
  if(turning&&nowSide!==side){side=nowSide;markSide(side);}
  return Boolean(turning)||Math.abs(th-thTarget)>.05||Math.abs(thV)>.05||Math.abs(sw)>.001||Math.abs(swV)>.003;
 }

 // ── 알림 ──
 let toastTimer=0;
 function say(text){const el=$('.m2s-toast');if(!el)return;el.textContent=text;el.hidden=false;win.clearTimeout(toastTimer);timers.delete(toastTimer);toastTimer=later(()=>{el.hidden=true;},3600);}
 function countMine(){const n=items.filter(item=>{const e=entry(item.id);return e.arrived||e.flight;}).length;const c=$('.m2s-box-count');c.dataset.count=n;c.textContent=n;$('.m2s-box').setAttribute('aria-label',`${t('closetCount',{n})} — ${t('close')}`);}
 function seen(card){if(!card?.new||fresh.has(`sent:${card.job_id}`))return;fresh.add(`sent:${card.job_id}`);fresh.add(card.job_id);Promise.resolve().then(()=>actions.seen?.(card.job_id)).catch(()=>fresh.delete(`sent:${card.job_id}`));}

 // ── 입어 보기 → 포장 → 출발 ──
 function firstPacked(){try{return win.localStorage.getItem(PACKED_KEY)==='1';}catch{return false;}}
 function rememberPacked(){try{win.localStorage.setItem(PACKED_KEY,'1');}catch{/* 막힌 기기는 늘 처음 판 */}}
 function packSay(id){
  const a=$('.m2s-pack-text'),b=$('.m2s-pack-tr');
  a.textContent=SHOP_TEXT.ko[id]??id;b.textContent=L()==='ko'?'':t(id);b.hidden=L()==='ko';
  a.style.animation='none';void a.offsetWidth;a.style.animation='';
 }
 function holdSay(){const a=$('.m2s-pack-text'),b=$('.m2s-pack-tr');a.textContent=SHOP_TEXT.ko.hold;b.textContent=L()==='ko'?'':t('hold');b.hidden=L()==='ko';}
 function clearPack(){
  const parcel=$('.m2s-parcel');
  for(const el of [parcel,$('.m2s-parcel-open'),$('.m2s-parcel-closed'),turnWrap])el.getAnimations().forEach(a=>a.cancel());
  parcel.hidden=true;$('.m2s-pack').hidden=true;$('.m2s-tissue').classList.remove('is-on','is-wrapped');$('.m2s-label').classList.remove('is-on');parcel.classList.remove('is-closed');
  turnWrap.style.removeProperty('--line-to');turnWrap.classList.remove('is-off');delete shop.dataset.packing;delete shop.dataset.flying;
 }
 /** 주문 답 — 끊기거나 늦어도 거짓말하지 않는다: 오류면 상태를 다시 받아 그 옷이 오는 중이면 출발로 친다(Fable 설계 검토). */
 async function outcomeOf(id,result){
  if(result.out){const s=result.out.status;if(s==='ordered'||s==='already')return {kind:'sent'};if(s==='delayed')return {kind:'late',date:result.out.arrives_after};if(s==='off')return {kind:'off'};if(s==='full_album')return {kind:'full'};}
  let next=null;try{next=await actions.status?.();}catch{next=null;}
  const card=shopEntry(next?.looks||view?.looks,id).flight;
  return card?(card.state==='delayed'?{kind:'late',date:card.arrives_after}:{kind:'sent'}):{kind:'fail'};
 }
 async function order(){
  if(busy||openI<0||closed())return;
  busy=true;
  const i=openI,item=items[i],id=item.id;
  const result=Promise.resolve().then(()=>actions.order(id)).then(out=>({out}),error=>({error}));
  let answered=null;result.then(r=>{answered=r;});
  const run=pack={aborted:false,skip:null};
  const wait=ms=>new Promise(r=>{const tid=later(r,ms);run.skip=()=>{win.clearTimeout(tid);timers.delete(tid);r();};});
  sound?.pick();
  const parcel=$('.m2s-parcel'),pOpen=$('.m2s-parcel-open'),pClosed=$('.m2s-parcel-closed'),tissue=$('.m2s-tissue'),label=$('.m2s-label');
  let skipped=false;
  if(!reduce()){
   const steps=PACK_STEPS.filter(x=>x.id!=='go'&&(!firstPacked()||!x.first));
   rememberPacked();
   shop.dataset.packing='yes';$('.m2s-pack').hidden=false;
   $('.m2s-label-item').textContent=t('labelItemValue',{name:tx(id).name});
   const d=new Date();$('.m2s-label-date').textContent=dayText(d);$('.m2s-label-no').textContent=`No. ${pad2(d.getMonth()+1)}${pad2(d.getDate())}-${String(i+1).padStart(3,'0')}`;
   thTarget=Math.round(th/360)*360;runTurn();
   const onSkip=()=>{skipped=true;run.skip?.();};
   stage.addEventListener('pointerdown',onSkip);
   for(const st of steps){
    if(skipped||run.aborted)break;
    packSay(st.id);
    if(st.id==='lift'){turnWrap.style.setProperty('--line-to','-40%');later(()=>turnWrap.classList.add('is-off'),220);sound?.pick();}
    else if(st.id==='wrap'){tissue.classList.add('is-on');sound?.tissue();later(()=>sound?.tissue(),380);later(()=>tissue.classList.add('is-wrapped'),520);}
    else if(st.id==='box'){
     parcel.hidden=false;pOpen.style.opacity=1;pClosed.style.opacity=0;
     const tw=turnWrap.getBoundingClientRect(),pr=parcel.getBoundingClientRect();
     parcel.animate([{transform:'translateY(40%) scale(.9)',opacity:0},{transform:'none',opacity:1}],{duration:380,easing:'cubic-bezier(.2,.75,.2,1)',fill:'both'});
     const k=Math.min(1,(pr.width*.5)/Math.max(1,tw.width)),dy=pr.top+pr.height*.42-(tw.top+tw.height*.5*k+tw.height*.1);
     turnWrap.animate([{transform:'none',opacity:1},{transform:`translateY(${dy*.5-pr.height*.12}px) scale(${(1+k)/2})`,opacity:1,offset:.55},{transform:`translateY(${dy}px) scale(${k})`,opacity:1,offset:.92},{transform:`translateY(${dy+pr.height*.04}px) scale(${k})`,opacity:0}],{duration:700,delay:160,easing:'cubic-bezier(.45,0,.4,1)',fill:'both'});
    }else if(st.id==='tape'){
     sound?.thump();parcel.classList.add('is-closed');
     pClosed.animate([{opacity:0},{opacity:1}],{duration:160,fill:'forwards'});pOpen.animate([{opacity:1},{opacity:0}],{duration:160,delay:60,fill:'forwards'});
     parcel.animate([{transform:'none'},{transform:'scale(1.04,.96)'},{transform:'none'}],{duration:260});later(()=>sound?.tape(),260);
    }else if(st.id==='label'){label.classList.add('is-on');sound?.label();}
    await wait(st.ms);
   }
   stage.removeEventListener('pointerdown',onSkip);
  }
  // 「출발」 앞 — 답이 아직이면 기다린다(닫기 · Esc는 된다). 3초 넘으면 「조금만 기다려 주세요」.
  if(!answered&&!run.aborted&&!reduce()){const tid=later(()=>{if(!answered&&!run.aborted)holdSay();},reduce()?0:400);void tid;}
  const r=await Promise.race([result,new Promise(res=>{run.skip=()=>res(null);})]);
  if(run.aborted||!r){if(pack===run){busy=false;pack=null;}return;} // 멈춘 주문의 늦은 정리가 그 뒤 새 주문의 상태를 지우지 않게
  const outcome=await outcomeOf(id,r);
  if(run.aborted||!isOpen()){if(pack===run){busy=false;pack=null;}return;}
  if(outcome.kind==='sent'&&!reduce()){
   packSay('go');shop.dataset.flying='yes';
   const bb=$('.m2s-box').getBoundingClientRect(),now=parcel.getBoundingClientRect();
   const fx=bb.left+bb.width*.2-(now.left+now.width/2),fy=bb.top+bb.height/2-(now.top+now.height/2);
   parcel.hidden=false;
   await parcel.animate([{transform:'none',opacity:1},{transform:`translate(${fx}px,${fy}px) scale(.08)`,opacity:.9}],{duration:560,delay:120,easing:'cubic-bezier(.5,0,.3,1)',fill:'both'}).finished.catch(()=>{});
  }else if(outcome.kind==='late'&&!reduce()){
   // 지연이면 상자를 날려 보내지 않는다 — 카운터에 둔 채 「사진관이 붐벼서 ○일에 보내요」(P3)
   $('.m2s-pack-text').textContent=SHOP_TEXT.ko.lateBox.replace('{date}',dayText(outcome.date));$('.m2s-pack-tr').textContent=L()==='ko'?'':t('lateBox',{date:dayText(outcome.date)});
   await new Promise(res=>{const tid=later(res,1400);run.skip=()=>{win.clearTimeout(tid);timers.delete(tid);res();};});
  }
  clearPack();
  busy=false;pack=null;
  if(outcome.kind==='sent'||outcome.kind==='late'){
   const box=$('.m2s-box');box.classList.remove('is-bump');void box.offsetWidth;box.classList.add('is-bump');sound?.drop();
   stage.hidden=true;shop.dataset.mode='';hangers[i].style.visibility='';openI=-1;
   P[i].drop=-artH*.12;P[i].dropV=0;P[i].om+=.5;setActive(i);wake();refreshRail();
   hangers[i].focus({preventScroll:true});
   say(outcome.kind==='late'?t('lateBox',{date:dayText(outcome.date)}):t('sent'));
  }else{
   // 못 보냈다 — 상자를 열어 옷을 다시 건다(자세히 그대로)
   fillInfo(i,{keepSide:true});setSide('front',true);thTarget=0;runTurn();
   say(outcome.kind==='off'?t('off'):outcome.kind==='full'?t('full'):t('packFail'));
   $('.m2s-close').focus({preventScroll:true});
  }
 }
 function abortPack(){if(!pack)return;pack.aborted=true;pack.skip?.();clearPack();busy=false;pack=null;}
 async function simple(kind){
  if(busy||openI<0)return;
  const item=items[openI],e=entry(item.id);if(!e.arrived)return;
  busy=true;for(const b of dialog.querySelectorAll('.m2s-actions button'))b.disabled=true;
  try{
   if(kind==='wear'){await actions.wear(e.arrived.job_id);sound?.pick();say(t('wore'));}
   else if(kind==='unwear'){await actions.unwear();sound?.drop();say(t('tookOff'));}
   else{const out=await actions.redo(e.arrived.job_id);say(out?.status==='limit'?t('limit'):out?.status==='off'?t('off'):t('again2'));}
  }catch{say(t('error'));}
  busy=false;
  if(openI>=0&&isOpen()){fillInfo(openI,{keepSide:true});const go=dialog.querySelector('.m2s-actions .m2s-go');go?.focus({preventScroll:true});}
 }

 // ── 손 ──
 function onClick(e){
  const b=e.target.closest?.('[data-act],[data-side],.m2s-hanger');if(!b||b.disabled)return;
  if(b.classList.contains('m2s-hanger')){firstTouch();openDetail(Number(b.dataset.i));return;}
  if(b.dataset.side){if(!busy&&b.dataset.side!==side)setSide(b.dataset.side);return;}
  const act=b.dataset.act;
  if(act==='close'){if(busy)abortPack();closeDetail();}
  else if(act==='closet'){sound?.brush();api.close();}
  else if(act==='more'){firstTouch();openDetail(active);}
  else if(act==='prev')step(-1);
  else if(act==='next')step(1);
  else if(act==='order')void order();
  else if(act==='wear'||act==='unwear'||act==='redo')void simple(act);
  else if(act==='pair')step(0,Number(b.dataset.to));
  else if(act==='word'){toggleWord(b);sound?.brush();}
  else if(act==='readko'){const open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));$('.m2s-story-ko').hidden=!open;b.textContent=t(open?'readKoOff':'readKo');}
 }
 function onKey(e){
  // Esc는 여기서 받는다 — 크롬은 연달아 막은 cancel을 두 번째에 안 보낼 때가 있다(자세히 닫기 → 가게 닫기가 끊겼다). cancel은 다른 닫기 요청(뒤로 가기)만 맡는다.
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeRequest();return;}
  if(openI<0)return;
  if(e.target.closest?.('.m2s-side,.m2s-rail'))return;
  if(e.key==='ArrowRight'){e.preventDefault();step(1);}
  else if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}
 }
 /** 닫기 요청 — 포장 중이면 포장을 멈추고(주문은 계속 돈다), 자세히면 봉으로, 봉이면 가게를 닫는다. */
 function closeRequest(){
  if(busy){abortPack();closeDetail({quick:true});return;}
  if(openI>=0){closeDetail();return;}
  api.close();
 }
 function onCancel(e){e.preventDefault();closeRequest();}
 function firstTouch(){const h=$('.m2s-hint');if(h&&!h.classList.contains('is-gone'))later(()=>h.classList.add('is-gone'),900);sound?.unlock();}
 /** 대화 상자 자체의 듣기 — 열 때 한 번(다시 지을 때 겹으로 붙지 않게). */
 function wireDialog(){
  dialog.addEventListener('click',onClick);
  dialog.addEventListener('keydown',onKey);
  dialog.addEventListener('cancel',onCancel);
  dialog.addEventListener('close',()=>teardown());
  dialog.addEventListener('pointerdown',()=>sound?.unlock());
  win.addEventListener('resize',relayout);
 }
 /** 봉 · 자세히 판의 듣기 — 지을 때마다(요소가 새로 생긴다). */
 function wire(){
  rail.addEventListener('scroll',()=>{wake();firstTouch();},{passive:true});
  rail.addEventListener('pointerover',e=>{const h=e.target.closest('.m2s-hanger');if(!h||!fit||e.pointerType!=='mouse')return;const i=Number(h.dataset.i);if(i===hover)return;hover=i;sound?.brush();wake();});
  rail.addEventListener('pointerleave',()=>{if(hover>=0){hover=-1;wake();}});
  rail.addEventListener('focusin',e=>{const h=e.target.closest('.m2s-hanger');if(h&&fit){hover=Number(h.dataset.i);wake();}});
  rail.addEventListener('keydown',e=>{if(!fit)return;const to=e.key==='ArrowRight'?active+1:e.key==='ArrowLeft'?active-1:null;if(to===null)return;e.preventDefault();hangers[clamp(to,0,items.length-1)]?.focus();});
  // 옷을 끌어 돌리기 — 놓으면 가까운 쪽(앞 · 뒤)으로
  turnWrap.addEventListener('pointerdown',e=>{if(busy||turnWrap.dataset.view==='worn'||(e.pointerType==='mouse'&&e.button!==0))return;turning={x:e.clientX,y:e.clientY,th,lastX:e.clientX,lastT:win.performance.now(),v:0,on:false,id:e.pointerId};});
  turnWrap.addEventListener('pointermove',e=>{
   if(!turning||e.pointerId!==turning.id)return;const dx=e.clientX-turning.x;
   if(!turning.on){const way=R.dragIntent(dx,e.clientY-turning.y,6);if(way==='y'){turning=null;return;}if(way!=='x')return;turning.on=true;turnWrap.classList.add('is-turning');try{turnWrap.setPointerCapture(e.pointerId);}catch{}sound?.turn();}
   th=turning.th+dx*.55;const now=win.performance.now(),dtt=now-turning.lastT;
   if(dtt>0){turning.v=lerp(turning.v,(e.clientX-turning.lastX)*.55/(dtt/1000),.4);turning.lastX=e.clientX;turning.lastT=now;}
   runTurn();
  });
  const endTurn=e=>{if(!turning||e.pointerId!==turning.id)return;const was=turning;turning=null;turnWrap.classList.remove('is-turning');if(!was.on)return;thV=was.v*.6;thTarget=Math.round((th+clamp(was.v*.12,-150,150))/180)*180;const r=((thTarget%360)+360)%360;setSide(r===180?'back':'front',true);runTurn();};
  turnWrap.addEventListener('pointerup',endTurn);turnWrap.addEventListener('pointercancel',endTurn);
  dr=R.attach(rail,{item:'.m2s-slot',onFrame:wake,onSettle:()=>wake()});
 }
 function relayout(){if(!isOpen())return;measure();for(const p of P)p.x=null;wake();}

 // ── 짓기 · 고치기 ──
 const itemsKey=list=>`${L()}|${list.map(x=>x.id).join(',')}`;
 function build(){
  teardownRail();
  dialog.innerHTML=shellHtml();
  grab();wire();
  builtKey=itemsKey(items);
  countMine();
  measure();
  const start=Math.min(3,items.length-1);
  if(!fit){rail.scrollLeft=start*slotW;pos=start;lastPos=pos;}
  setActive(fit?0:start);lastCenter=fit?-1:start;
 }
 /** 상태만 바뀌었을 때 — 봉은 그대로 두고 꼬리표 · 이름 · 자세히만 간다(끌던 손 · 흔들림이 안 끊긴다). */
 function refreshRail(){
  items.forEach((item,i)=>{
   const sw=swings[i];if(!sw)return;
   const before=sw.querySelector('.m2s-print-tag,.m2s-tag')?.outerHTML||'',next=tagHtml(item,i);
   if(before!==next){sw.querySelector('.m2s-print-tag,.m2s-tag')?.remove();if(next)sw.insertAdjacentHTML('beforeend',next);if(next.includes('m2s-print-tag')&&!before.includes('m2s-print-tag'))P[i].om+=.45;}
   hangers[i].setAttribute('aria-label',hangerLabel(item));
  });
  countMine();setActive(active);wake();
  for(const item of items){const e=entry(item.id);if(e.arrived?.new&&e.arrived.url)later(()=>seen(e.arrived),1600);}
 }
 function enter(){
  shop.dataset.ready='yes';
  if(reduce()){S=Starget;drawRod();wake();return;}
  // 옷이 하나씩 떨어져 걸리고, 걸릴 때마다 봉이 처졌다 펴진다
  P.forEach((p,i)=>{p.drop=-artH*.18;p.dropV=0;slots[i].animate([{opacity:0},{opacity:1}],{duration:260,delay:80+i*70,fill:'backwards'});later(()=>{p.dropV=60;Sv+=70;p.om+=i%2?.55:-.55;if(i%2===0)sound?.tick(.35);wake();},80+i*70);});
  wake();
 }
 async function ensureStyle(){
  if(doc.querySelector('[data-me2-shop-style]'))return;
  const link=doc.createElement('link');link.rel='stylesheet';link.href=STYLE_URL;link.dataset.me2ShopStyle='';
  const loaded=new Promise(r=>{link.onload=r;link.onerror=r;later(r,4000);});
  doc.head.append(link);await loaded;
 }
 function teardownRail(){
  if(raf)win.cancelAnimationFrame(raf);if(turnRaf)win.cancelAnimationFrame(turnRaf);raf=0;turnRaf=0;
  dr?.destroy();dr=null;
  openI=-1;busy=false;pack=null;turning=null;hover=-1;fit=false;
 }
 function teardown(){
  if(pack){pack.aborted=true;pack.skip?.();}
  teardownRail();
  for(const id of timers)win.clearTimeout(id);timers.clear();
  win.removeEventListener('resize',relayout);
  sound?.close();sound=null;
  if(dialog){dialog.remove();dialog=null;}
  slots=[];hangers=[];swings=[];P=[];
  onClosed();
 }

 const api={
  isOpen,
  /** 가게 열기 — view: 제2의 나 상태, fresh: 이번 세션에 도착을 본 일감(시트가 먼저 seen을 보내도 가게에서 「도착」으로 보인다). */
  async open(next,{fresh:seenNow}={}){
   if(disposed)return;
   view=next;fresh=new Set(seenNow||[]);items=shopItemsFor(view?.menu);
   if(isOpen()){api.update(next,{fresh:seenNow});return;}
   if(opening)return opening;
   opening=(async()=>{
    await ensureStyle();
    if(disposed)return;
    dialog=doc.createElement('dialog');dialog.className='m2s-dialog';dialog.setAttribute('aria-label',t('shop'));
    doc.body.append(dialog);
    sound=createShopSound({enabled:soundOn,win});
    build();wireDialog();
    dialog.showModal();
    measure();for(const p of P)p.x=null;
    // 휴대폰 봉은 넷째 옷에서 시작한다(양옆이 보이게) — 대화 상자를 띄운 뒤에야 칸 너비를 잴 수 있다.
    const start=Math.min(3,items.length-1);if(!fit){rail.scrollLeft=start*slotW;pos=start;lastPos=pos;setActive(start);lastCenter=start;}else{setActive(0);lastCenter=-1;}
    drawRod();
    const imgs=hangers.map(h=>h.querySelector('img'));
    await Promise.race([Promise.all(imgs.map(img=>img.decode?img.decode().catch(()=>{}):null)),new Promise(r=>later(r,1500))]);
    if(!isOpen())return;
    win.requestAnimationFrame(()=>{if(isOpen())enter();});
    later(()=>{for(const item of items){const im=new win.Image();im.src=art(item,'back');}for(const im of dialog?.querySelectorAll('.m2s-parcel img')||[])im.decode?.().catch(()=>{});},1200);
    rail.focus({preventScroll:true});
    for(const item of items){const e=entry(item.id);if(e.arrived?.new&&e.arrived.url)later(()=>seen(e.arrived),1600);}
   })().finally(()=>{opening=null;});
   return opening;
  },
  /** 제2의 나가 상태를 새로 받을 때마다 — 열려 있지 않으면 기억만 한다. */
  update(next,{fresh:seenNow}={}){
   view=next;if(seenNow)for(const id of seenNow)fresh.add(id);
   if(!isOpen())return;
   // 다른 기기에서 지움 · 기준을 바꿈 · 오류 — 가게를 닫고 시트로
   if(!next||!['ok','off'].includes(next.status??'ok')||!next.consent?.given||next.me?.state!=='ready'){api.close();return;}
   const list=shopItemsFor(view.menu);
   if(itemsKey(list)!==builtKey){
    if(busy)return; // 포장 중에는 다시 짓지 않는다 — 끝난 뒤 다음 update가 짓는다
    const keep=openI>=0?items[openI]?.id:null;items=list;build();for(const p of P)p.x=null;shop.dataset.ready='yes';wake();
    const again=keep?items.findIndex(x=>x.id===keep):-1;if(again>=0)openDetail(again);
    return;
   }
   items=list;refreshRail();
   if(openI>=0&&!busy)fillInfo(openI,{keepSide:true});
  },
  /** 닫기 — 닫은 뒤 초점은 onClosed가 그때의 입구 단추로 돌린다. */
  close(){
   if(!isOpen())return;
   if(pack)abortPack();
   const d=dialog;
   if(reduce()){d.close();return;}
   d.classList.add('is-leaving');
   later(()=>{if(d.open)d.close();},220);
  },
  dispose(){disposed=true;if(dialog?.open)dialog.close();else if(dialog)teardown();},
 };
 return api;
}
