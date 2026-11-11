'use strict';
// SNS · 나라 지도 (2026-11-11 유호님 「작업실에 넣어」) — 로컬 마케팅 지도(docs/마케팅/온라인마케팅지도/world/)의 작업실 판.
// 자료는 정적 파일 /marketing-map.json 하나다: world/workspace-data.mjs가 계정 원장 + PULSE 타깃 + 나라 경계로 만든다(로그인 정보 없음).
// 그리기는 SNS 간편판(social-simple.js)의 머리 · 계기판 도우미를 그대로 쓰고, 상태는 이 파일의 marketingMap 하나다.
// 마크업에 style 속성을 쓰지 않는다(CSP style-src 'self') — 칸 높이 · 말풍선 자리 · 이름표 크기는 그린 뒤 CSSOM · SVG 속성으로 맞춘다.
// 시험(marketing-map.test.mjs)은 「상태와 불러오기」 표시줄 앞까지만 잘라 읽는다.
const MM_SCHEMA='synk-marketing-map/v1';
const mmEsc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MM_BRANDS=[['lab','LAB'],['pulse','PULSE']];
// 나라가 열 곳 이하인 보기(PULSE)는 이름을 지도에 적는다. 이름표를 점 옆으로 비키는 나라만 적는다.
const MM_NUDGE={KR:[-1,0,'end'],JP:[1,0,'start'],PH:[1,0,'start'],MY:[0,1,'middle'],TW:[1,0,'start'],SG:[0,1,'middle']};
const MM_LABEL_LIMIT=10;
const MM_ARROW='<svg class="mm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
const mmStatusLabel=c=>c.status==='active'?'운영 중':'준비 중';
const mmCount=c=>c.planned?`${c.secured}/${c.planned}`:'—';

// 'YYYY-MM-DDTHH:MM…Z' → '11월 11일 00:01'(한국 시각)
function mmKst(iso){
  const date=new Date(iso||'');if(Number.isNaN(date.getTime()))return '';
  const k=new Date(date.getTime()+9*3600000),p=n=>String(n).padStart(2,'0');
  return `${k.getUTCMonth()+1}월 ${k.getUTCDate()}일 ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}

function mmSvg(D,v,code){
  const by=new Map(v.countries.map(c=>[c.code,c])),picked=code&&by.has(code)?code:null;
  let land='',top='';
  for(const g of D.geo.countries){
    const c=g.a2?by.get(g.a2):null;
    if(!c){land+=`<path class="mm-c" d="${g.d}"/>`;continue;}
    const cls=`mm-c hot ${c.status==='active'?'is-active':'is-target'}${g.a2===picked?' is-selected':''}`;
    const path=`<path class="${cls}" d="${g.d}" data-code="${mmEsc(g.a2)}" tabindex="0" role="button" aria-label="${mmEsc(c.name)} · ${mmStatusLabel(c)}"/>`;
    if(g.a2===picked)top=path;else land+=path;
  }
  let marks='',labels='';
  for(const c of v.countries){
    if(!c.center)continue;
    const [x,y]=c.center;
    if(c.code===picked&&(c.area??0)<120)marks+=`<circle class="mm-locator" cx="${x}" cy="${y}" r="13" aria-hidden="true"/>`;
    if(c.small)marks+=`<circle class="mm-mark${c.status==='target'?' is-target':''}" cx="${x}" cy="${y}" r="3.2" data-code="${mmEsc(c.code)}"/>`;
    if(v.brand==='PULSE'&&c.status==='active')marks+=`<circle class="mm-ring" cx="${x}" cy="${y}" r="22" aria-hidden="true"/><circle class="mm-ring mm-ring-2" cx="${x}" cy="${y}" r="22" aria-hidden="true"/>`;
    if(v.countries.length<=MM_LABEL_LIMIT){
      const [dx,dy,anchor]=MM_NUDGE[c.code]||[0,0,'middle'];
      labels+=`<text class="mm-lbl${c.status==='target'?' is-target':''}" x="${x}" y="${y}" text-anchor="${anchor}" font-size="20" data-x="${x}" data-y="${y}" data-dx="${dx}" data-dy="${dy}" aria-hidden="true">${mmEsc(c.name)}</text>`;
    }
  }
  const dim=picked&&v.countries.length>MM_LABEL_LIMIT;
  return `<svg class="mm-map${dim?' has-sel':''}" viewBox="0 0 ${D.geo.w} ${D.geo.h}" data-w="${D.geo.w}" role="group" aria-label="세계 지도 · ${mmEsc(v.name)}">`
    +`<defs><pattern id="mm-hatch" width="4.2" height="4.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="mm-hatch-bg" width="4.2" height="4.2"/><line class="mm-hatch-line" x1="0" y1="0" x2="0" y2="4.2"/></pattern></defs>`
    +`<g>${land}${top}</g><g>${marks}</g><g>${labels}</g></svg>`;
}

function mmAccounts(list,empty){
  if(!list.length)return `<p class="mm-empty">${mmEsc(empty)}</p>`;
  return list.map(a=>{
    const sub=a.secured?(a.url?`<a href="${mmEsc(a.url)}" target="_blank" rel="noopener noreferrer">${mmEsc(a.handle||a.url)}</a>`:mmEsc(a.handle||'확보')):mmEsc([a.state,a.note].filter(Boolean).join(' · '));
    return `<div class="mm-acc"><span class="mm-led${a.secured?'':' off'}" aria-hidden="true"></span><span class="mm-acc-name">${mmEsc(a.platform)}</span><span class="mm-acc-sub">${sub}</span></div>`;
  }).join('');
}

function mmRows(list,grouped){
  let last=null;
  return list.map(c=>{
    const head=grouped&&c.region!==last?`<p class="mm-region">${mmEsc(c.region)}</p>`:'';last=c.region;
    const sub=c.verdict&&c.status!=='active'?`검토 · ${c.verdict}`:c.accounts.map(a=>a.platform).join(' · ');
    const full=c.planned>0&&c.secured===c.planned;
    return `${head}<button class="mm-row" type="button" data-mm-action="select" data-code="${mmEsc(c.code)}"><span><span class="mm-row-name">${mmEsc(c.name)}</span><span class="mm-row-sub">${mmEsc(c.role?`${c.role} · ${sub}`:sub)}</span></span><span class="mm-row-num${full?' full':''}">${mmCount(c)}</span></button>`;
  }).join('');
}

function mmList(v){
  const active=v.countries.filter(c=>c.status==='active'),target=v.countries.filter(c=>c.status==='target'),grouped=v.countries.length>MM_LABEL_LIMIT;
  let html=`<section class="mm-sec"><h2 class="mm-sec-title"><span class="mm-sw mm-sw-active" aria-hidden="true"></span>운영 중 <span class="mm-num">${active.length}</span></h2>${active.length?`<div class="mm-rows">${mmRows(active,grouped)}</div>`:'<p class="mm-note">아직 운영하는 나라가 없어요.</p>'}</section>`;
  if(v.brand==='PULSE'&&v.shared.length)html+=`<section class="mm-sec"><h2 class="mm-sec-title">나라를 나누지 않은 계정 <span class="mm-num">${v.shared.length}</span></h2><div class="mm-rows">${mmAccounts(v.shared,'')}</div>${v.sharedNote?`<p class="mm-note">${mmEsc(v.sharedNote)}</p>`:''}</section>`;
  html+=`<section class="mm-sec"><h2 class="mm-sec-title"><span class="mm-sw mm-sw-target" aria-hidden="true"></span>준비 중 <span class="mm-num">${target.length}</span></h2>${target.length?`<div class="mm-rows">${mmRows(target,grouped)}</div>`:'<p class="mm-note">준비 중인 나라는 없어요. 모든 타깃 나라에 계정이 하나 이상 있어요.</p>'}</section>`;
  return html;
}

function mmDetail(v,c){
  const pills=[
    `<span class="mm-pill"><span class="mm-led${c.status==='active'?'':' off'}"></span>${mmStatusLabel(c)}</span>`,
    c.planned?`<span class="mm-pill mm-tnum">계정 ${c.secured}/${c.planned}</span>`:'',
    c.role?`<span class="mm-pill">${mmEsc(c.role)}</span>`:'',
    c.verdict?`<span class="mm-pill mm-pill-verdict${/빼기/.test(c.verdict)?' is-quiet':''}">검토 · ${mmEsc(c.verdict)}</span>`:'',
    c.language?`<span class="mm-pill">${mmEsc(c.language)}</span>`:''
  ].join('');
  let html=`<section class="mm-sec"><button class="mm-back" type="button" data-mm-action="back">${MM_ARROW}전체 나라</button><h2 class="mm-name">${mmEsc(c.name)}</h2><div class="mm-pills">${pills}</div>${c.why?`<p class="mm-why">${mmEsc(c.why)}</p>`:''}</section>`;
  const plan=v.brand==='PULSE'&&c.status!=='active';
  html+=`<section class="mm-sec"><h3 class="mm-sec-title">${plan?'만들 계정(제안)':'계정'}</h3><div class="mm-rows">${mmAccounts(c.accounts,v.brand==='PULSE'?'이 나라용 계정은 새로 만들지 않아요 — 공통 계정이 닿아요.':'아직 계정이 없어요.')}</div></section>`;
  if(v.brand==='PULSE'&&c.status==='active'&&v.shared.length)html+=`<section class="mm-sec"><h3 class="mm-sec-title">여기서 운영하는 공통 계정</h3><div class="mm-rows">${mmAccounts(v.shared,'')}</div></section>`;
  if(c.lines.length)html+=`<section class="mm-sec"><h3 class="mm-sec-title">게시</h3><dl class="mm-facts">${c.lines.map(l=>`<div><dt>${mmEsc(l.label)}</dt><dd>${mmEsc(l.text)}</dd></div>`).join('')}</dl></section>`;
  if(v.brand==='PULSE'&&c.labHere)html+=`<section class="mm-sec"><p class="mm-note">이 나라에는 LAB 계정 ${c.labHere}곳이 이미 있어요. 보는 사람이 달라(한국어 학습) 계정을 함께 쓰지는 않아요.</p></section>`;
  return html;
}

// 지도 장 한 벌 — D는 marketing-map.json, view는 'lab' | 'pulse', code는 고른 나라(없으면 null).
function mmPage(D,view,code){
  const v=D.views[view]||D.views.lab,c=code?v.countries.find(x=>x.code===code)||null:null,s=v.summary,h=v.headline;
  const unit=(n,u)=>typeof ssUnit==='function'?ssUnit(n,u):`${n}<small>${u}</small>`;
  const meter=[['운영 중',unit(s.active,'개국'),view==='pulse'?'berry':'coral'],['준비 중',unit(s.target,'개국')],['확보한 계정',`${s.secured}<small>/ ${s.planned}</small>`],['남은 자리',unit(Math.max(s.planned-s.secured,0),'개'),s.planned>s.secured?'butter':undefined]];
  const meterHtml=typeof ssMeter==='function'?ssMeter(meter.map(([label,value,dot])=>[label,value,dot===undefined?undefined:dot])):`<div class="ss-meter">${meter.map(([l,val])=>`<div><span>${mmEsc(l)}</span><strong>${val}</strong></div>`).join('')}</div>`;
  const switcher=`<div class="mm-switch" role="group" aria-label="사업 고르기">${MM_BRANDS.map(([id,label])=>{const n=D.views[id].summary;return `<button type="button" data-mm-action="view" data-value="${id}" aria-pressed="${id===view}"><i class="mm-dot mm-dot-${id}" aria-hidden="true"></i>${label}<span class="mm-tnum">${id==='pulse'?`${n.active} · ${n.target}`:n.active}</span></button>`;}).join('')}</div>`;
  return `<div class="mm-page" data-mm-view="${mmEsc(view)}">`
    +`<header class="ss-head mm-head"><div class="ss-head-copy"><div class="ss-eyebrow">SYNK WORKSPACE / SOCIAL</div><h1>나라 지도</h1><p class="ss-lede">${mmEsc(h.first)} ${mmEsc(h.second)}</p></div>${switcher}</header>`
    +meterHtml
    +`<div class="mm-stage"><div class="mm-box"><div class="mm-scroll">${mmSvg(D,v,c?.code)}</div>`
    +`<ul class="mm-legend" aria-label="색 안내"><li><span class="mm-sw mm-sw-active"></span>운영 중</li><li><span class="mm-sw mm-sw-target"></span>준비 중</li><li><span class="mm-sw"></span>그 밖</li></ul>`
    +`<div class="mm-tip" role="status" hidden></div></div>`
    +`<aside class="mm-pane" aria-live="polite">${c?mmDetail(v,c):mmList(v)}</aside></div>`
    +`<p class="mm-foot">계정 원장 ${mmEsc(mmKst(D.generatedAt))} 기준${D.targetsUpdatedAt?` · PULSE 타깃 ${mmEsc(D.targetsUpdatedAt.slice(5).replace('-','월 '))}일 정리`:''} · 나라 경계 Natural Earth</p>`
    +`</div>`;
}

// ── 상태와 불러오기 ── (시험은 이 줄 앞까지만 잘라 읽는다)
const marketingMap={data:null,loading:false,attempted:false,error:'',view:mmStoredView(),code:null,request:0};
function mmStoredView(){try{return globalThis.localStorage?.getItem('synk.workspace.map.view')==='pulse'?'pulse':'lab';}catch{return 'lab';}}
function mmRemember(view){try{globalThis.localStorage?.setItem('synk.workspace.map.view',view);}catch{/* 저장이 막혀도 화면은 돈다 */}}
function mmRerender(){if(typeof snswRender==='function')snswRender();else if(typeof render==='function')render();}
async function marketingMapLoad(){
  const request=++marketingMap.request;Object.assign(marketingMap,{loading:true,attempted:true,error:''});
  try{
    const response=await fetch('/marketing-map.json',{credentials:'same-origin',cache:'no-cache'});
    if(!response.ok)throw new Error('지도 자료를 불러오지 못했어요.');
    const data=await response.json();
    if(data?.schema!==MM_SCHEMA||!data.views?.lab||!data.views?.pulse||!data.geo?.countries)throw new Error('지도 자료의 모양이 달라요. 새로고침해 주세요.');
    if(request===marketingMap.request)marketingMap.data=data;
  }catch(error){if(request===marketingMap.request)marketingMap.error=error.message||'지도 자료를 불러오지 못했어요.';}
  finally{if(request===marketingMap.request){marketingMap.loading=false;mmRerender();}}
}
function marketingMapEnsure(){if(!marketingMap.attempted&&!marketingMap.loading)void marketingMapLoad();}
function marketingMapRender(){
  marketingMapEnsure();
  const D=marketingMap.data;
  if(!D)return `<div class="ss-empty" role="status"><h2>${marketingMap.error?'지도를 불러오지 못했어요':'지도를 불러오고 있어요'}</h2><p>${mmEsc(marketingMap.error||'나라 경계와 계정 원장을 읽는 중이에요.')}</p>${marketingMap.error?'<button class="ss-link" type="button" data-mm-action="reload">다시 불러오기</button>':''}</div>`;
  if(marketingMap.code&&!D.views[marketingMap.view]?.countries.some(c=>c.code===marketingMap.code))marketingMap.code=null;
  mmFitSoon();
  return mmPage(D,marketingMap.view,marketingMap.code);
}
// 그린 뒤 맞추기: 이름표는 화면에서 13px이 되게, 오른쪽 칸은 지도 높이만큼(좁은 창은 풀어 둔다), 좁은 창은 한국 둘레를 가운데로.
function mmFit(){
  const svg=document.querySelector('.sw-simple .mm-map');if(!svg)return;
  const width=svg.getBoundingClientRect().width,base=Number(svg.dataset.w)||1000,size=13/((width||base)/base);
  for(const t of svg.querySelectorAll('.mm-lbl')){
    const x=Number(t.dataset.x),y=Number(t.dataset.y),dx=Number(t.dataset.dx),dy=Number(t.dataset.dy);
    t.setAttribute('font-size',size.toFixed(2));t.setAttribute('x',String(x+dx*size*1.1));t.setAttribute('y',String(y+dy*size*1.5+size*0.35));
  }
  const pane=document.querySelector('.sw-simple .mm-pane'),box=document.querySelector('.sw-simple .mm-box');
  if(pane&&box)pane.style.maxHeight=globalThis.matchMedia?.('(max-width:1100px)').matches?'':Math.max(box.getBoundingClientRect().height,420)+'px';
  const scroller=document.querySelector('.sw-simple .mm-scroll');
  if(scroller&&scroller.scrollWidth>scroller.clientWidth&&!scroller.dataset.centered){
    const kr=marketingMap.data?.views.pulse.countries.find(c=>c.code==='KR');
    scroller.scrollLeft=scroller.scrollWidth*((kr?.center?.[0]||base/2)/base)-scroller.clientWidth/2;scroller.dataset.centered='1';
  }
}
function mmFitSoon(){if(typeof requestAnimationFrame==='function')requestAnimationFrame(mmFit);}
globalThis.addEventListener?.('resize',mmFitSoon);

function mmSelect(code){
  const v=marketingMap.data?.views[marketingMap.view];
  marketingMap.code=code&&v?.countries.some(c=>c.code===code)&&code!==marketingMap.code?code:null;
  mmHideTip();mmRerender();
  if(marketingMap.code&&globalThis.matchMedia?.('(max-width:1100px)').matches)document.querySelector('.sw-simple .mm-pane')?.scrollIntoView?.({behavior:'smooth',block:'start'});
}
function mmTip(code,event){
  const v=marketingMap.data?.views[marketingMap.view],c=v?.countries.find(x=>x.code===code),tip=document.querySelector('.sw-simple .mm-tip'),box=document.querySelector('.sw-simple .mm-box');
  if(!c||!tip||!box)return mmHideTip();
  tip.innerHTML=`<b>${mmEsc(c.name)}</b>${mmStatusLabel(c)} · ${c.planned?`계정 ${c.secured}/${c.planned}`:mmEsc(c.verdict?`검토 · ${c.verdict}`:'새 계정 없음')}`;
  tip.hidden=false;
  const r=box.getBoundingClientRect(),half=tip.offsetWidth/2+8;
  let x,y;
  if(event&&'clientX' in event&&event.clientX){x=event.clientX-r.left;y=event.clientY-r.top;}
  else{const t=event.target.getBoundingClientRect();x=t.left+t.width/2-r.left;y=t.top-r.top;}
  tip.style.left=Math.min(Math.max(x,half),r.width-half)+'px';tip.style.top=Math.max(y,tip.offsetHeight+20)+'px';
}
function mmHideTip(){const tip=document.querySelector('.sw-simple .mm-tip');if(tip)tip.hidden=true;}
const mmCodeAt=target=>target?.closest?.('.sw-simple .mm-map [data-code]')?.dataset.code||'';

document.addEventListener('click',event=>{
  const action=event.target.closest?.('.sw-simple [data-mm-action]');
  if(action&&!action.disabled){
    const kind=action.dataset.mmAction;
    if(kind==='view'){const value=action.dataset.value==='pulse'?'pulse':'lab';if(value!==marketingMap.view){marketingMap.view=value;marketingMap.code=null;mmRemember(value);mmRerender();}return;}
    if(kind==='select')return mmSelect(action.dataset.code);
    if(kind==='back')return mmSelect(null);
    if(kind==='reload'){marketingMap.attempted=false;void marketingMapLoad();return;}
  }
  const code=mmCodeAt(event.target);if(code)mmSelect(code);
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&marketingMap.code&&document.querySelector('.sw-simple .mm-page')){mmSelect(null);return;}
  if(event.key!=='Enter'&&event.key!==' ')return;
  const code=mmCodeAt(event.target);if(code){event.preventDefault();mmSelect(code);}
});
document.addEventListener('pointermove',event=>{
  if(!event.target.closest?.('.sw-simple .mm-map'))return;
  const code=mmCodeAt(event.target);if(code&&event.pointerType!=='touch')mmTip(code,event);else mmHideTip();
});
document.addEventListener('pointerout',event=>{if(event.target.closest?.('.sw-simple .mm-map')&&!event.relatedTarget?.closest?.('.sw-simple .mm-map'))mmHideTip();});
document.addEventListener('focusin',event=>{const code=mmCodeAt(event.target);if(code)mmTip(code,event);});
document.addEventListener('focusout',event=>{if(mmCodeAt(event.target))mmHideTip();});
