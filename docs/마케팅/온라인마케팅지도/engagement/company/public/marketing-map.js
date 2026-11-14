'use strict';
// SNS · 나라 지도 (2026-11-11 유호님 「작업실에 넣어」, 11-13 네 사업 · 전체 보기 · 운영 상태) — 로컬 마케팅 지도(docs/마케팅/온라인마케팅지도/world/)의 작업실 판.
// 자료는 둘이다. ① 공개 정적 파일 /marketing-map.json: world/workspace-data.mjs가 계정 원장 + PULSE 타깃 + 나라 경계로 만든다(로그인 경로 · 이메일 · 관리 주소 · 운영 상태 없음).
// ② 관리자에게만 오는 /api/social/simple의 accountMap(로그인 · 게시 · 수집 상태): 지도 계정 id가 정확히 같을 때만 붙인다(플랫폼 · 핸들로 짐작해 붙이지 않음). ②가 없으면 공개 계정만 그린다.
// 사업(LAB · SHIFT · PULSE · PATH)과 콘텐츠 트랙(YUHO · yuhokorean · 몽글몽글)은 다른 축이다 — 사업 고르기는 자료의 views 키, 계정의 사업 칸은 business만 쓴다.
// 그리기는 SNS 간편판(social-simple.js)의 머리 · 계기판 도우미를 그대로 쓰고, 상태는 이 파일의 marketingMap 하나다.
// 마크업에 style 속성을 쓰지 않는다(CSP style-src 'self') — 칸 높이 · 말풍선 자리 · 이름표 크기는 그린 뒤 CSSOM · SVG 속성으로 맞춘다.
// 시험(marketing-map.test.mjs)은 「상태와 불러오기」 표시줄 앞까지만 잘라 읽는다.
const MM_SCHEMA='synk-marketing-map/v1';
const mmEsc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 사업 고르기 순서. 자료에 그 보기가 없으면(생성기가 아직 SHIFT · PATH를 안 낸 옛 자료) 단추를 빼고, 「전체」는 계정 목록이 있을 때만 둔다.
const MM_BRANDS=[['lab','LAB'],['shift','SHIFT'],['pulse','PULSE'],['path','PATH']];
const MM_BUSINESS=['LAB','SHIFT','PULSE','PATH','SYNK'];
// 나라가 열 곳 이하인 보기(PULSE 등)는 이름을 지도에 적는다. 이름표를 점 옆으로 비키는 나라만 적는다.
const MM_NUDGE={KR:[-1,0,'end'],JP:[1,0,'start'],PH:[1,0,'start'],MY:[0,1,'middle'],TW:[1,0,'start'],SG:[0,1,'middle']};
const MM_LABEL_LIMIT=10;
const MM_ARROW='<svg class="mm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
// 색 active = 그 나라에 계정을 확보함(게시 중이라는 뜻 아님). target = 아직 계정 준비 중 — PULSE는 「타깃 시장」.
const mmStatusLabel=(c,brand)=>c.status==='active'?'계정 있음':brand==='PULSE'?'타깃 시장':'준비 중';
const mmCount=c=>c.planned?`${c.secured}/${c.planned}`:'—';
const mmArr=value=>Array.isArray(value)?value:[];

// 'YYYY-MM-DDTHH:MM…Z' → '11월 11일 00:01'(한국 시각)
function mmKst(iso){
  const date=new Date(iso||'');if(Number.isNaN(date.getTime()))return '';
  const k=new Date(date.getTime()+9*3600000),p=n=>String(n).padStart(2,'0');
  return `${k.getUTCMonth()+1}월 ${k.getUTCDate()}일 ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}
// 관측 시각은 ISO(Z · +09:00) 또는 서버의 한국 시각 'YYYY-MM-DD HH:MM' · 날짜만 'YYYY-MM-DD'로 온다.
function mmWhen(value){
  const s=String(value||'');
  if(/T/.test(s))return mmKst(s);
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/);
  return m?`${Number(m[2])}월 ${Number(m[3])}일${m[4]?` ${m[4]}`:''}`:'';
}

// 보기 목록 — 자료에 실제로 있는 사업만. 옛 자료(lab · pulse만)도 그대로 열린다.
function mmBrands(D){return MM_BRANDS.filter(([id])=>Array.isArray(D?.views?.[id]?.countries));}
// 전체 보기 자료: 새 자료는 views.all(또는 맨 위 all) = {accounts,plans,summary}. 없으면 null — 지어내지 않는다.
function mmAllOf(D){const all=D?.views?.all||D?.all;return all&&Array.isArray(all.accounts)?all:null;}
function mmViewIds(D){return [...mmBrands(D).map(([id])=>id),...(mmAllOf(D)?['all']:[])];}
function mmPickView(D,view){const ids=mmViewIds(D);return ids.includes(view)?view:ids[0]||'lab';}

// 운영 상태(관리자 accountMap)를 계정 id로 찾는다. 자료 안 계정에 operations가 이미 있으면 그것이 먼저다.
function mmOpsIndex(accountMap){
  const index=new Map();
  for(const a of mmArr(accountMap?.accounts))if(a&&typeof a.id==='string'&&a.id)index.set(a.id,a);
  return index;
}
function mmOps(a,ops){
  if(a?.operations)return a.operations;
  const row=a?.id&&ops?ops.get(a.id):null;
  return row?(row.operations||{login:row.login,publication:row.publication,collection:row.collection}):null;
}
// 로그인(브라우저로 직접 확인한 것)과 수집 API 연결은 다른 일이라 따로 쓴다. 칸이 없으면 「기록 미확인」 — 실패로 단정하지 않는다.
function mmLoginText(login){
  if(!login||!login.state)return '기록 미확인';
  // 날짜만 확인한 기록(observedDateOnly)은 시각을 지어내지 않고 날짜만 — observedAt ISO 앞 10자.
  const at=login.observedDateOnly===true?mmWhen(String(login.observedAt||'').slice(0,10)):mmWhen(login.observedAt),scope=login.scope?` · ${login.scope}`:'';
  if(login.state==='verified')return `확인됨${at?` · ${at}`:''}${scope}`;
  if(login.state==='login-required')return `로그인 필요${scope}${at?` · ${at} 확인`:''}`;
  if(login.state==='historical')return `예전 기록만 있음${at?` · ${at}`:''} · 다시 확인 전`;
  return `기록 미확인${at?` · ${at}`:''}`;
}
// 자료는 만든 때(checkedAt) 기준이다 — 볼 때 다음 예약 시각이 이미 지났으면 예약으로 남기지 않고 「게시 확인 필요」를 붙인다(게시됐다고 추정하지 않음).
function mmPublicationText(pub,now=Date.now()){
  if(!pub||typeof pub!=='object')return '기록 미확인';
  const n=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
  const done=n(pub.publishedCount),soon=n(pub.scheduledCount),wait=n(pub.pendingConfirmationCount);
  const parts=[];
  const older=n(pub.omittedPublishedCount)||0;
  if(done)parts.push(`${older?'최근 근거 게시':'게시'} ${done.toLocaleString('ko-KR')}건${pub.lastPublishedAt?`(마지막 ${mmWhen(pub.lastPublishedAt)})`:''}${older?` · 그 전 게시 ${older.toLocaleString('ko-KR')}건은 따로(이 수에 안 넣음)`:''}`);
  if(soon)parts.push(`예약 ${soon}건${pub.nextScheduledAt?`(다음 ${mmWhen(pub.nextScheduledAt)})`:''}`);
  if(wait)parts.push(`게시 확인 대기 ${wait}건`);
  if(!parts.length)return pub.checkedAt&&done===0&&soon===0?`작업실 게시 · 예약 없음 · ${mmWhen(pub.checkedAt)} 확인`:'기록 미확인';
  const next=Date.parse(pub.nextScheduledAt||''),lapsed=Number.isFinite(next)&&next<=now;
  return parts.join(' · ')+(lapsed?' · 그 예약 시각이 지나 게시 확인 필요':'')+(pub.checkedAt?` · ${mmWhen(pub.checkedAt)} 기준`:'')+(pub.basis?` — ${pub.basis}`:'');
}
// 수집 상태 · 방법 토큰은 서버 이름(collection-policy.mjs · account-catalog.mjs) 그대로 받아 한국어로만 보인다. 모르는 토큰은 영어를 내보이지 않고 「수집 상태 미확인」.
const MM_COLLECT={success:'오늘 수집 완료',partial:'오늘 일부만 수집',collecting:'수집 중',scheduled:'수집 시각 전',overdue:'이번 수집 전','retry-scheduled':'다시 시도 예정',paused:'자동 수집 꺼짐',failed:'수집 실패','needs-reconnect':'다시 연결해야 함','needs-connection':'연결해야 함',unsupported:'자동 수집 안 됨',archived:'보관됨','not-managed':'운영 대상 아님','not-registered':'수집 채널 미등록',unknown:'수집 상태 미확인',historical:'예전 기록만 있음'};
const MM_COLLECT_METHOD={'official-api':'공식 API','creator-export-or-manual':'관리자 통계 · 직접 기록',server:'작업실 서버 수집','public-api':'공개 API','vk-api':'VK API','public-page':'공개 화면 읽기','screen-only':'화면으로만 확인'};
function mmCollectionText(col){
  if(!col||!col.state)return '기록 미확인';
  const at=mmWhen(col.checkedAt),method=MM_COLLECT_METHOD[col.method]||'';
  return `${MM_COLLECT[col.state]||'수집 상태 미확인'}${method?` · ${method}`:''}${at?` · 마지막 수집 ${at}`:''}`;
}
function mmOpsHtml(op){
  if(!op)return '<dl class="mm-ops"><div><dt>운영 상태</dt><dd>기록 미확인</dd></div></dl>';
  const rows=[['브라우저 로그인',mmLoginText(op?.login),op?.login?.state],['게시',mmPublicationText(op?.publication),''],['수집',mmCollectionText(op?.collection),op?.collection?.state]];
  return `<dl class="mm-ops">${rows.map(([k,v,s])=>`<div${s?` data-state="${mmEsc(s)}"`:''}><dt>${mmEsc(k)}</dt><dd>${mmEsc(v)}</dd></div>`).join('')}</dl>`;
}

function mmSvg(D,v,code){
  const by=new Map(v.countries.map(c=>[c.code,c])),picked=code&&by.has(code)?code:null;
  let land='',top='';
  for(const g of D.geo.countries){
    const c=g.a2?by.get(g.a2):null;
    if(!c){land+=`<path class="mm-c" d="${g.d}"/>`;continue;}
    const cls=`mm-c hot ${c.status==='active'?'is-active':'is-target'}${g.a2===picked?' is-selected':''}`;
    const path=`<path class="${cls}" d="${g.d}" data-code="${mmEsc(g.a2)}" tabindex="0" role="button" aria-label="${mmEsc(c.name)} · ${mmStatusLabel(c,v.brand)}"/>`;
    if(g.a2===picked)top=path;else land+=path;
  }
  let marks='',labels='';
  const few=v.countries.length<=MM_LABEL_LIMIT;
  for(const c of v.countries){
    if(!c.center)continue;
    const [x,y]=c.center;
    if(c.code===picked&&(c.area??0)<120)marks+=`<circle class="mm-locator" cx="${x}" cy="${y}" r="13" aria-hidden="true"/>`;
    if(c.small)marks+=`<circle class="mm-mark${c.status==='target'?' is-target':''}" cx="${x}" cy="${y}" r="3.2" data-code="${mmEsc(c.code)}"/>`;
    if(few&&c.status==='active')marks+=`<circle class="mm-ring" cx="${x}" cy="${y}" r="22" aria-hidden="true"/><circle class="mm-ring mm-ring-2" cx="${x}" cy="${y}" r="22" aria-hidden="true"/>`;
    if(few){
      const [dx,dy,anchor]=MM_NUDGE[c.code]||[0,0,'middle'];
      labels+=`<text class="mm-lbl${c.status==='target'?' is-target':''}" x="${x}" y="${y}" text-anchor="${anchor}" font-size="20" data-x="${x}" data-y="${y}" data-dx="${dx}" data-dy="${dy}" aria-hidden="true">${mmEsc(c.name)}</text>`;
    }
  }
  const dim=picked&&!few;
  return `<svg class="mm-map${dim?' has-sel':''}" viewBox="0 0 ${D.geo.w} ${D.geo.h}" data-w="${D.geo.w}" role="group" aria-label="세계 지도 · ${mmEsc(v.name)}">`
    +`<defs><pattern id="mm-hatch" width="4.2" height="4.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="mm-hatch-bg" width="4.2" height="4.2"/><line class="mm-hatch-line" x1="0" y1="0" x2="0" y2="4.2"/></pattern></defs>`
    +`<g>${land}${top}</g><g>${marks}</g><g>${labels}</g></svg>`;
}

// 계정 한 줄. withOps면(관리자 화면에서 운영 자료가 왔을 때) 확보한 계정마다 로그인 · 게시 · 수집을 따로 적는다.
// 다른 사업의 계정이 이 보기에 연계로 들어오면(PATH 보기의 LAB 계정 등) 사업 표지를 단다 — 이 사업의 실적으로 읽히지 않게.
function mmAccount(a,{ops=null,withOps=false,showBusiness=false,brand='',showCountry=false}={}){
  const baseSub=a.secured?(a.url?`<a href="${mmEsc(a.url)}" target="_blank" rel="noopener noreferrer">${mmEsc(a.handle||a.url)}</a>`:mmEsc(a.handle||'확보')):mmEsc([a.state,a.note].filter(Boolean).join(' · '));
  const purpose=a.purpose&&a.purpose!==a.note?mmEsc(a.purpose):'';
  const sub=purpose?(baseSub?`${baseSub} · ${purpose}`:purpose):baseSub;
  const linked=mmArr(a.secondaryBusinesses).filter(b=>b&&b!==a.business);
  const bizLabel=brand&&a.business!==brand?`${a.business} 계정`:a.business==='SYNK'?'SYNK 공통':a.business;
  const tags=[
    a.business&&(showBusiness||a.business==='SYNK'||brand&&a.business!==brand)?`<span class="mm-tag" data-business="${mmEsc(a.business)}">${mmEsc(bizLabel)}</span>`:'',
    linked.length?`<span class="mm-tag is-track">연계 ${mmEsc(linked.join('·'))}</span>`:'',
    showCountry?`<span class="mm-tag is-track">${mmEsc(a.country||'나라 미정')}</span>`:'',
    a.contentTrack&&a.contentTrack!==a.business?`<span class="mm-tag is-track">${mmEsc(a.contentTrack)}</span>`:'',
    a.shared?'<span class="mm-tag is-track">공통</span>':''
  ].join('');
  return `<div class="mm-acc"><span class="mm-led${a.secured?'':' off'}" aria-hidden="true"></span><span class="mm-acc-name">${mmEsc(a.platform)}${tags}</span><span class="mm-acc-sub">${sub}</span>${withOps&&a.secured?mmOpsHtml(mmOps(a,ops)):''}</div>`;
}
function mmAccounts(list,empty,opts){
  if(!list.length)return empty?`<p class="mm-empty">${mmEsc(empty)}</p>`:'';
  return list.map(a=>mmAccount(a,opts)).join('');
}

function mmRows(list,grouped){
  let last=null;
  return list.map(c=>{
    const head=grouped&&c.region!==last?`<p class="mm-region">${mmEsc(c.region)}</p>`:'';last=c.region;
    const sub=c.verdict&&c.status!=='active'?`검토 · ${c.verdict}`:mmArr(c.accounts).map(a=>a.platform).join(' · ');
    const full=c.planned>0&&c.secured===c.planned;
    return `${head}<button class="mm-row" type="button" data-mm-action="select" data-code="${mmEsc(c.code)}"><span><span class="mm-row-name">${mmEsc(c.name)}</span><span class="mm-row-sub">${mmEsc(c.role?`${c.role} · ${sub}`:sub)}</span></span><span class="mm-row-num${full?' full':''}">${mmCount(c)}</span></button>`;
  }).join('');
}

function mmList(v,opts){
  const active=v.countries.filter(c=>c.status==='active'),target=v.countries.filter(c=>c.status==='target'),grouped=v.countries.length>MM_LABEL_LIMIT,shared=mmArr(v.shared);
  let html=`<section class="mm-sec"><h2 class="mm-sec-title"><span class="mm-sw mm-sw-active" aria-hidden="true"></span>계정이 있는 나라 <span class="mm-num">${active.length}</span></h2>${active.length?`<div class="mm-rows">${mmRows(active,grouped)}</div>`:'<p class="mm-note">아직 계정이 있는 나라가 없어요.</p>'}<p class="mm-note">계정을 확보한 나라예요. 실제로 게시하는지는 계정마다 게시 기록에서 봐요.</p></section>`;
  // 나라를 나누지 않은 계정(공통 · 나라 불명)은 지도에 나라를 지어 붙이지 않고 여기 한 목록으로 둔다.
  if(shared.length)html+=`<section class="mm-sec"><h2 class="mm-sec-title">나라를 나누지 않은 계정 <span class="mm-num">${shared.length}</span></h2><div class="mm-rows">${mmAccounts(shared,'',opts)}</div>${v.sharedNote?`<p class="mm-note">${mmEsc(v.sharedNote)}</p>`:''}</section>`;
  html+=`<section class="mm-sec"><h2 class="mm-sec-title"><span class="mm-sw mm-sw-target" aria-hidden="true"></span>${v.brand==='PULSE'?'타깃 시장(준비)':'준비 중'} <span class="mm-num">${target.length}</span></h2>${target.length?`<div class="mm-rows">${mmRows(target,grouped)}</div>`:'<p class="mm-note">준비 중인 나라는 없어요.</p>'}</section>`;
  return html;
}

function mmDetail(v,c,opts){
  const shared=mmArr(v.shared),pulse=v.brand==='PULSE',accounts=mmArr(c.accounts);
  const pills=[
    `<span class="mm-pill"><span class="mm-led${c.status==='active'?'':' off'}"></span>${mmStatusLabel(c,v.brand)}</span>`,
    c.planned?`<span class="mm-pill mm-tnum">계정 ${c.secured}/${c.planned}</span>`:'',
    c.role?`<span class="mm-pill">${mmEsc(c.role)}</span>`:'',
    c.verdict?`<span class="mm-pill mm-pill-verdict${/빼기/.test(c.verdict)?' is-quiet':''}">검토 · ${mmEsc(c.verdict)}</span>`:'',
    c.language?`<span class="mm-pill">${mmEsc(c.language)}</span>`:''
  ].join('');
  let html=`<section class="mm-sec"><button class="mm-back" type="button" data-mm-action="back">${MM_ARROW}전체 나라</button><h2 class="mm-name">${mmEsc(c.name)}</h2><div class="mm-pills">${pills}</div>${c.why?`<p class="mm-why">${mmEsc(c.why)}</p>`:''}</section>`;
  // 공통 계정이 이 나라에 닿는 것(accountRefs → shared: true)은 계정 목록에 들어 있다. 아직 없는 자리는 「만들 계정(계획)」으로 나눠 적는다.
  const held=accounts.filter(a=>a.secured),todo=accounts.filter(a=>!a.secured);
  const emptyText=pulse&&!todo.length?'이 나라용 계정은 새로 만들지 않아요 — 공통 계정이 닿아요.':'아직 확보한 계정이 없어요.';
  html+=`<section class="mm-sec"><h3 class="mm-sec-title">계정 <span class="mm-num">${held.length}</span></h3><div class="mm-rows">${mmAccounts(held,emptyText,opts)}</div></section>`;
  if(todo.length)html+=`<section class="mm-sec"><h3 class="mm-sec-title">만들 계정(계획) <span class="mm-num">${todo.length}</span></h3><div class="mm-rows">${mmAccounts(todo,'',opts)}</div></section>`;
  // 옛 자료(공통 계정이 나라 계정 목록에 안 들어 있음)는 계정이 있는 나라에 공통 계정을 따로 보여 준다.
  if(c.status==='active'&&shared.length&&!accounts.some(a=>a.shared)&&(pulse||c.sharedHere))html+=`<section class="mm-sec"><h3 class="mm-sec-title">이 나라에 닿는 공통 계정</h3><div class="mm-rows">${mmAccounts(shared,'',opts)}</div></section>`;
  if(mmArr(c.lines).length)html+=`<section class="mm-sec"><h3 class="mm-sec-title">게시</h3><dl class="mm-facts">${c.lines.map(l=>`<div><dt>${mmEsc(l.label)}</dt><dd>${mmEsc(l.text)}</dd></div>`).join('')}</dl></section>`;
  if(pulse&&c.labHere)html+=`<section class="mm-sec"><p class="mm-note">이 나라에는 LAB 계정 ${c.labHere}곳이 이미 있어요. 보는 사람이 달라(한국어 학습) 계정을 함께 쓰지는 않아요.</p></section>`;
  return html;
}

// 전체 보기의 지도: 사업별 보기의 나라를 코드로 합친다(나라가 있는 계정만 칠한다). 계정은 id(없으면 사업 · 플랫폼 · 핸들)로 한 번만.
function mmAllView(D){
  const by=new Map();
  for(const [id,label] of mmBrands(D)){
    for(const c of D.views[id].countries){
      const row=by.get(c.code)||{code:c.code,name:c.name,region:c.region,center:c.center,small:c.small,area:c.area,status:'target',accounts:[],businesses:[],keys:new Set(),lines:[]};
      if(c.status==='active')row.status='active';
      if(!row.businesses.includes(label))row.businesses.push(label);
      for(const a of mmArr(c.accounts)){
        const key=a.id||`${label}|${a.platform}|${a.handle||a.state||''}`;
        if(row.keys.has(key))continue;row.keys.add(key);
        row.accounts.push({...a,business:a.business||label});
      }
      by.set(c.code,row);
    }
  }
  const countries=[...by.values()].map(({keys,...c})=>({...c,role:c.businesses.join(' · '),secured:c.accounts.filter(a=>a.secured).length,planned:c.accounts.length}));
  return {brand:'ALL',name:'전체 계정',countries,shared:[],sharedNote:null};
}
const mmBusinessOf=a=>MM_BUSINESS.includes(a?.business)?a.business:'미분류';
function mmPlanText(p){
  const name=p.title||p.name||p.label||p.handle||p.platform||'이름 없는 계획';
  return {name,sub:[p.business,p.contentTrack&&p.contentTrack!==p.business?p.contentTrack:'',p.platform&&p.platform!==name?p.platform:'',p.market||p.country||p.region,p.when||p.timing||p.phase,p.state||p.status,p.note].filter(Boolean).join(' · ')};
}
// 전체 보기 오른쪽 칸: 사업별 확보 계정 목록(나라 불명 포함) + 미확보 계획/보류(확보 수에서 제외) + 장기 계획.
function mmAllList(all,business,opts){
  const accounts=mmArr(all.accounts),securedAll=accounts.filter(a=>a.secured),unsecuredAll=accounts.filter(a=>!a.secured);
  const groups=[...MM_BUSINESS,'미분류'].filter(b=>accounts.some(a=>mmBusinessOf(a)===b));
  const picked=groups.includes(business)?business:'';
  const chip=(value,label,count)=>`<button type="button" data-mm-action="business" data-value="${mmEsc(value)}" aria-pressed="${picked===value}">${value?`<i class="mm-dot" data-business="${mmEsc(value)}" aria-hidden="true"></i>`:''}${mmEsc(label)} <span class="mm-tnum">${count}</span></button>`;
  let html=`<section class="mm-sec"><h2 class="mm-sec-title">확보한 계정 <span class="mm-num">${securedAll.length}</span></h2><p class="mm-note">주 사업으로 나누고 연계 사업 · 홍보 목적을 함께 적어요. 콘텐츠 트랙(YUHO · yuhokorean · 몽글몽글)은 이름 옆 표지예요.${unsecuredAll.length?` 미개설 계획 · 보류 ${unsecuredAll.length}개는 확보 계정 수에 넣지 않고 사업 아래에 따로 적어요.`:''}</p><div class="mm-chips" role="group" aria-label="사업으로 거르기">${chip('','전체',securedAll.length)}${groups.map(b=>chip(b,b,securedAll.filter(a=>mmBusinessOf(a)===b).length)).join('')}</div></section>`;
  for(const b of picked?[picked]:groups){
    const list=accounts.filter(a=>mmBusinessOf(a)===b),held=list.filter(a=>a.secured),todo=list.filter(a=>!a.secured);
    html+=`<section class="mm-sec"><h3 class="mm-sec-title"><i class="mm-dot" data-business="${mmEsc(b)}" aria-hidden="true"></i>${mmEsc(b)} <span class="mm-num">${held.length}</span></h3><div class="mm-rows">${mmAccounts(held,'확보한 계정이 없어요.',{...opts,showBusiness:false,showCountry:true})}</div>${todo.length?`<p class="mm-region">계획 · 보류(확보 수 제외) ${todo.length}</p><div class="mm-rows">${mmAccounts(todo,'',{...opts,showBusiness:false,showCountry:true})}</div>`:''}</section>`;
  }
  const plans=mmArr(all.plans);
  if(plans.length)html+=`<section class="mm-sec"><details class="mm-plans"><summary><span class="mm-sec-title">장기 계획 <span class="mm-num">${plans.length}</span></span><span class="mm-note">아직 만들지 않은 계정 계획이에요. 위 계정 수에 더하지 않아요.</span></summary><div class="mm-rows">${plans.map(p=>{const t=mmPlanText(p);return `<div class="mm-acc"><span class="mm-led off" aria-hidden="true"></span><span class="mm-acc-name">${mmEsc(t.name)}</span><span class="mm-acc-sub">${mmEsc(t.sub)}</span></div>`;}).join('')}</div></details></section>`;
  return html;
}

// 지도 장 한 벌 — D는 marketing-map.json, view는 'lab' | 'shift' | 'pulse' | 'path' | 'all', code는 고른 나라(없으면 null).
// options.accountMap은 관리자 운영 자료(없으면 공개 계정만), options.business는 전체 보기의 사업 거르기.
function mmPage(D,view,code,options={}){
  view=mmPickView(D,view);
  const all=view==='all'?mmAllOf(D):null,v=all?mmAllView(D):D.views[view];
  const c=code?v.countries.find(x=>x.code===code)||null:null;
  const ops=mmOpsIndex(options.accountMap),opts={ops,withOps:!!options.accountMap,showBusiness:view==='all',brand:view==='all'?'':v.brand};
  const unit=(n,u)=>typeof ssUnit==='function'?ssUnit(n,u):`${n}<small>${u}</small>`;
  const num=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
  let meter,lede;
  if(all){
    const s=all.summary||{},acc=mmArr(all.accounts);
    meter=[['관리 중',unit(num(s.managed)??acc.filter(a=>a.secured).length,'개'),'ink'],['확장 계획',unit(num(s.planned)??acc.filter(a=>!a.secured).length,'개')],['제외 · 보류',num(s.excluded)===null?'—':unit(num(s.excluded),'개')],['장기 계획',unit(num(s.longTermPlans)??mmArr(all.plans).length,'개')]];
    lede='네 사업과 회사 공통 계정을 한 번에 봐요. 장기 계획은 계정 수에 더하지 않아요.';
  }else{
    const s=v.summary,h=v.headline||{},dot={lab:'coral',pulse:'berry',shift:'lapis',path:'moss'}[view];
    // 다른 사업 계정을 연계로 보여 주는 보기(PATH · PULSE 공통 링크드인)는 그 수를 라벨에 밝히고, 이 사업 계정이 0이면 그 사실을 칸으로 둔다.
    const shared=num(s.shared)||0,primary=num(s.primary);
    meter=[['계정 있는 나라',unit(s.active,'개국'),dot],[v.brand==='PULSE'?'타깃 시장':'준비 중',unit(s.target,'개국')],[shared?`확보한 계정(연계 ${shared})`:'확보한 계정',`${s.secured}<small>/ ${s.planned}</small>`],
      primary===0&&shared?['이 사업 계정',unit(0,'개')]:['남은 자리',unit(Math.max(s.planned-s.secured,0),'개'),s.planned>s.secured?'butter':undefined]];
    lede=[h.first,h.second].filter(Boolean).join(' ')||[v.name,v.what].filter(Boolean).join(' · ');
  }
  const meterHtml=typeof ssMeter==='function'?ssMeter(meter):`<div class="ss-meter">${meter.map(([l,val])=>`<div><span>${mmEsc(l)}</span><strong>${val}</strong></div>`).join('')}</div>`;
  const brandBtn=([id,label])=>{const n=D.views[id].summary||{};return `<button type="button" data-mm-action="view" data-value="${id}" aria-pressed="${id===view}"><i class="mm-dot mm-dot-${id}" aria-hidden="true"></i>${label}<span class="mm-tnum">${n.target?`${n.active} · ${n.target}`:n.active??''}</span></button>`;};
  const switcher=`<div class="mm-switch" role="group" aria-label="사업 고르기">${mmBrands(D).map(brandBtn).join('')}${mmAllOf(D)?`<button type="button" data-mm-action="view" data-value="all" aria-pressed="${view==='all'}">전체</button>`:''}</div>`;
  const pane=c?mmDetail(v,c,opts):all?mmAllList(all,options.business||'',opts):mmList(v,opts);
  const am=options.accountMap,opsNote=am?`운영 상태 ${mmEsc(mmWhen(am.generatedAt)||mmWhen(am.sourceAt)||'시각 미상')} 기준`:'로그인 · 게시 · 수집 상태는 관리자 운영 자료가 오면 계정마다 보여요';
  return `<div class="mm-page" data-mm-view="${mmEsc(view)}">`
    +`<header class="ss-head mm-head"><div class="ss-head-copy"><div class="ss-eyebrow">SNS · 마케팅</div><h1>나라 지도</h1><p class="ss-lede">${mmEsc(lede)}</p></div>${switcher}</header>`
    +meterHtml
    +`<div class="mm-stage"><div class="mm-box"><div class="mm-scroll">${mmSvg(D,v,c?.code)}</div>`
    +`<ul class="mm-legend" aria-label="색 안내"><li><span class="mm-sw mm-sw-active"></span>계정 있음</li><li><span class="mm-sw mm-sw-target"></span>${v.brand==='PULSE'?'타깃 시장':'준비 중'}</li><li><span class="mm-sw"></span>그 밖</li></ul>`
    +`<div class="mm-tip" role="status" hidden></div></div>`
    +`<div class="mm-pane" aria-live="polite">${pane}</div></div>`
    +`<p class="mm-foot">계정 원장 ${mmEsc(mmKst(D.generatedAt))} 기준${D.targetsUpdatedAt?` · PULSE 타깃 ${mmEsc(String(D.targetsUpdatedAt).slice(5).replace('-','월 '))}일 정리`:''} · ${opsNote} · 나라 경계 Natural Earth <button class="ss-link mm-refresh" type="button" data-mm-action="reload">다시 불러오기</button></p>`
    +`</div>`;
}

// ── 상태와 불러오기 ── (시험은 이 줄 앞까지만 잘라 읽는다)
const MM_VIEW_KEY='synk.workspace.map.view';
const marketingMap={data:null,loading:false,attempted:false,error:'',view:mmStoredView(),code:null,business:'',request:0};
function mmStoredView(){try{const v=globalThis.localStorage?.getItem(MM_VIEW_KEY);return ['lab','shift','pulse','path','all'].includes(v)?v:'lab';}catch{return 'lab';}}
function mmRemember(view){try{globalThis.localStorage?.setItem(MM_VIEW_KEY,view);}catch{/* 저장이 막혀도 화면은 돈다 */}}
function mmRerender(){if(typeof snswRender==='function')snswRender();else if(typeof render==='function')render();}
// 관리자 운영 자료는 SNS 간편판 자료(/api/social/simple)에 함께 온다. 없거나 권한이 없으면 null.
function mmAccountMap(){const am=typeof snsSimple!=='undefined'?snsSimple.data?.accountMap:null;return am&&Array.isArray(am.accounts)?am:null;}
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
  marketingMap.view=mmPickView(D,marketingMap.view);
  const v=marketingMap.view==='all'?mmAllView(D):D.views[marketingMap.view];
  if(marketingMap.code&&!v.countries.some(c=>c.code===marketingMap.code))marketingMap.code=null;
  mmFitSoon();
  return mmPage(D,marketingMap.view,marketingMap.code,{accountMap:mmAccountMap(),business:marketingMap.business});
}
function mmCurrentView(){const D=marketingMap.data;if(!D)return null;return marketingMap.view==='all'?mmAllView(D):D.views[marketingMap.view]||null;}
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
  const v=mmCurrentView();
  marketingMap.code=code&&v?.countries.some(c=>c.code===code)&&code!==marketingMap.code?code:null;
  mmHideTip();mmRerender();
  if(marketingMap.code&&globalThis.matchMedia?.('(max-width:1100px)').matches)document.querySelector('.sw-simple .mm-pane')?.scrollIntoView?.({behavior:'smooth',block:'start'});
}
function mmTip(code,event){
  const v=mmCurrentView(),c=v?.countries.find(x=>x.code===code),tip=document.querySelector('.sw-simple .mm-tip'),box=document.querySelector('.sw-simple .mm-box');
  if(!c||!tip||!box)return mmHideTip();
  tip.innerHTML=`<b>${mmEsc(c.name)}</b>${mmStatusLabel(c,v.brand)} · ${c.planned?`계정 ${c.secured}/${c.planned}`:mmEsc(c.verdict?`검토 · ${c.verdict}`:'새 계정 없음')}${v.brand==='ALL'&&c.role?` · ${mmEsc(c.role)}`:''}`;
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
    if(kind==='view'){const value=mmPickView(marketingMap.data,action.dataset.value);if(value!==marketingMap.view){marketingMap.view=value;marketingMap.code=null;mmRemember(value);mmRerender();}return;}
    if(kind==='business'){marketingMap.business=action.dataset.value||'';mmRerender();return;}
    if(kind==='select')return mmSelect(action.dataset.code);
    if(kind==='back')return mmSelect(null);
    // 다시 불러오기: 공개 지도 자료와 관리자 운영 상태(간편판 자료)를 함께 새로 읽는다.
    if(kind==='reload'){marketingMap.attempted=false;void marketingMapLoad();if(typeof snsSimpleLoad==='function'&&typeof snsSimple!=='undefined'&&!snsSimple.loading)void snsSimpleLoad();return;}
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
