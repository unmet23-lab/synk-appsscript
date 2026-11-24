'use strict';
// SNS·마케팅 간편판 — 오늘 · 성과 · 계정 세 장(2026-10-24 유호님 승인 시안을 옮김). 자료는 GET /api/social/simple 하나다:
// 서버가 작업실 예약·수집 게시물·게시 성과와 저장소 편 요약(30분마다 올라옴)을 합쳐 준다. 게시·예약은 화면 밖(제작 세션 → 작업실 예약·
// Meta 예약 → 검토 링크 승인)에서 돌아서 이 화면은 읽기만 한다. 위 절반은 그리기 도우미(순수 함수)이고, 시험은 아래 「상태와 불러오기」
// 표시줄 앞까지만 잘라 읽는다. 글은 ssEsc로 넣는다(「·」 앞 줄바꿈을 막으려고 앞 칸을 NBSP로 바꾼다).
const SNS_SIMPLE_VIEWS=[['map','지도'],['today','오늘'],['results','성과'],['accounts','계정']];
const ssEsc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replace(/ · /g,'\u00a0· ');
const ssN=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('ko-KR');
const SS_WD=['일','월','화','수','목','금','토'];
// 'YYYY-MM-DD' → '10.26 (월)'
function ssMd(date){const [y,m,d]=String(date||'').split('-').map(Number);if(!y||!m||!d)return '';return `${m}.${d} (${SS_WD[new Date(Date.UTC(y,m-1,d)).getUTCDay()]})`;}
const ssMdShort=date=>ssMd(date).replace(/ .*/,'');
// 서버는 한국 시각을 'YYYY-MM-DD HH:MM'으로 준다.
function ssRel(at,today){if(!at)return '';const [d,t]=String(at).split(' ');return d===today?`오늘 ${t||''}`.trim():`${ssMd(d)} ${t||''}`.trim();}
function ssWhen(at){const h=Number(String(at).slice(11,13)),m=Number(String(at).slice(14,16));if(!Number.isFinite(h))return ssMd(String(at).slice(0,10));const hh=h>=18?`밤 ${h-12}시`:h>=12?`오후 ${h===12?12:h-12}시`:`오전 ${h}시`;return `${ssMd(String(at).slice(0,10))} ${hh}${m?` ${m}분`:''}`;}
const SS_PF={youtube:['YT','유튜브'],instagram:['IG','인스타'],facebook:['FB','페북'],tiktok:['TT','틱톡'],threads:['TH','스레드'],x:['X','X'],linkedin:['IN','링크드인']};
const ssPfName=platform=>(SS_PF[platform]||[platform,platform])[1]||'';
function ssPf(platform){const row=SS_PF[platform]||[String(platform||'').slice(0,2).toUpperCase(),platform];return `<span class="ss-pf" title="${ssEsc(row[1])}">${ssEsc(row[0])}</span>`;}
const ssPlate=p=>`<span class="ss-plate">${ssPf(p.platform)}<span class="ss-handle">${ssEsc(p.handle)}</span></span>`;
const ssDot=tone=>`<i class="ss-dot${tone?' '+tone:''}"></i>`;
// 썸네일은 서버가 준 주소만(원고 첫 미디어 · 수집 게시물 그림). 영상은 첫 장면을 늦게 읽는다(SNS 작업실 공통 도우미).
function ssThumb(thumb){
  if(!thumb?.src)return '<span class="ss-thumb" aria-hidden="true"></span>';
  if(thumb.kind==='video'&&typeof snswLazyThumb==='function')return `<video class="ss-thumb" ${snswLazyThumb(thumb.src+'#t=0.5')} playsinline tabindex="-1" aria-hidden="true"></video>`;
  return `<img class="ss-thumb" src="${ssEsc(thumb.src)}" alt="" loading="lazy" decoding="async">`;
}
const SS_ICON={
  today:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  results:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 19h16M7 16V11M12 16V7M17 16v-4"/></svg>',
  accounts:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><path d="M15 6.2a3 3 0 0 1 0 5.6M17.5 14.6c1.7.6 2.7 2.1 3 4.4"/></svg>',
};
function ssStateChip(state){
  if(state==='검토 대기')return `<span class="ss-st butter">${ssDot()}검토 대기</span>`;
  if(state==='예약됨')return `<span class="ss-st green">${ssDot()}예약됨</span>`;
  if(['실패','작업실에 없음'].includes(state))return `<span class="ss-st coral">${ssDot()}${ssEsc(state)}</span>`;
  return state?`<span class="ss-st">${ssEsc(state)}</span>`:'';
}
const ssMethod=method=>method==='작업실'?'작업실':method||'';

// 머리 한 벌 — 눈썹 · 제목 · 한 줄 · 요약 카드
function ssHead({title,lede,poster}){return `<header class="ss-head"><div class="ss-head-copy"><div class="ss-eyebrow">SNS · 마케팅</div><h1>${ssEsc(title)}</h1><p class="ss-lede">${lede}</p></div>${poster}</header>`;}
function ssPoster({label,stats,word}){return `<figure class="ss-poster"><span class="ss-poster-label">${ssEsc(label)}</span><div class="ss-poster-stats">${stats.map(([b,s])=>`<div><b>${b}</b><span>${s}</span></div>`).join('')}</div><span class="ss-poster-word" aria-hidden="true">${ssEsc(word)}</span></figure>`;}
// 칸마다 [라벨, 값 HTML, 점 색, 폰에서 쓸 짧은 라벨]
function ssMeter(cells){return `<div class="ss-meter">${cells.map(([label,value,dot,short])=>`<div><span>${dot!==undefined?ssDot(dot):''}${short?`<em class="ss-l-long">${ssEsc(label)}</em><em class="ss-l-short">${ssEsc(short)}</em>`:ssEsc(label)}</span><strong>${value}</strong></div>`).join('')}</div>`;}
const ssUnit=(n,unit)=>`${ssN(n)}<small>${unit}</small>`;
const ssBlockHead=(title,{count,hint,tools}={})=>`<div class="ss-block-head"><h2>${ssEsc(title)}</h2>${count!==undefined?`<span class="ss-count">${ssN(count)}</span>`:''}${hint?`<span class="ss-hint">${hint}</span>`:''}${tools?`<div class="ss-block-tools">${tools}</div>`:''}</div>`;
const ssRow=({time,small,thumb,title,meta,chip})=>`<div class="ss-row"><div class="ss-time">${ssEsc(time)}<small>${ssEsc(small||'')}</small></div>${ssThumb(thumb)}<div class="ss-row-body"><div class="ss-row-title">${ssEsc(title)}</div><div class="ss-row-meta">${meta}</div></div>${chip||'<span class="ss-st"></span>'}</div>`;
const ssEpisodeMeta=g=>`${g.brand?`<span class="ss-brand">${ssEsc(g.brand)}</span>`:''}<span class="ss-plates">${(g.plates||[]).map(ssPlate).join('')}</span>`;

// ── 오늘 ──
// 검토 대기 가운데 예약 시각이 이미 지난 것(서버 시각 generatedAt 기준)은 「예약 문제」로 센다. 게시 서버는 검토를 기다리느라
// 늦은 예약을 「시각 지남」으로 바꾸지 않고, 승인되면 다음 점검(15초)에서 그때 바로 올린다(social-publishing.mjs tick의 waitingSeen).
// 한 원고의 판이 다른 시각에 잡힐 수 있어 판 단위로 가른다(판 시각이 없는 옛 응답은 원고 시각).
function ssReviewSplit(D){
  const ms=Date.parse(D.generatedAt||''),now=Number.isFinite(ms)?new Date(ms+9*3600e3).toISOString().slice(0,16).replace('T',' '):'';
  const passed=at=>!!now&&!!at&&at<now,waiting=[],late=[];
  for(const r of D.review||[]){
    const plates=r.plates||[];
    if(!plates.length){(passed(r.at)?late:waiting).push(r);continue;}
    const part=list=>({...r,at:list.map(p=>p.at||r.at).sort()[0],plates:list});
    const gone=plates.filter(p=>passed(p.at||r.at)),left=plates.filter(p=>!passed(p.at||r.at));
    if(gone.length)late.push(part(gone));if(left.length)waiting.push(part(left));
  }
  // 나눈 조각은 원고의 가장 이른 판 시각과 달라질 수 있어 조각 시각 순으로 다시 세운다(카드 문장의 시각 순과 목록 순을 맞춤).
  const byAt=(a,b)=>String(a.at||'').localeCompare(String(b.at||''));
  return {waiting:waiting.sort(byAt),late:late.sort(byAt)};
}
const ssPlateCount=list=>list.reduce((n,r)=>n+(r.plates||[]).length,0);
// 「내 차례」 수 = 할 일 종류 수(검토 · 예약 문제) — 계기판 두 칸과 같은 가름이고, 예약 문제 카드는 둘(손이 필요한 예약 · 검토 없이 지난 예약)일 수 있다.
function ssMyTurn(D){const {waiting,late}=ssReviewSplit(D);return (waiting.length?1:0)+((D.problems||[]).length||late.length?1:0);}
function ssToday(D){
  const today=D.today,{waiting:review,late}=ssReviewSplit(D),problems=D.problems||[],H=D.health||{},C=D.comments||{};
  const tonight=D.tonight||[],held=D.held||[],upcoming=D.upcoming||[],yesterday=D.yesterday||[],myTurn=ssMyTurn(D);
  const reviewPlates=ssPlateCount(review),slots=[...new Set(review.map(r=>r.at))].sort();
  const platesAt=at=>review.filter(r=>r.at===at).reduce((n,r)=>n+(r.plates||[]).length,0);
  const p0=problems[0];
  const problemCard=p0?`<div class="ss-task is-problem"><div><div class="ss-task-label">${ssDot('coral')}손이 필요한 예약 ${ssN(problems.length)}판</div><b>${ssEsc(p0.state)} · ${ssEsc(ssPfName(p0.platform))} ${ssEsc(p0.handle)} · ${ssEsc(ssRel(p0.at,today))}</b>${p0.title?`<p>${ssEsc(p0.title)}</p>`:''}<p>${ssEsc(p0.message||'')}${problems.length>1?ssEsc(` · 그 밖에 ${problems.length-1}판`):''}</p></div><button class="ss-btn" type="button" data-sw-action="view" data-value="fix">처리하기</button></div>`:'';
  const latePlates=ssPlateCount(late),lateSlots=[...new Set(late.map(r=>r.at))].sort();
  const lateCard=late.length?`<div class="ss-task is-problem"><div><div class="ss-task-label">${ssDot('coral')}검토 없이 시각이 지난 예약 ${ssN(latePlates)}판</div><b>${ssEsc(lateSlots.length===1?`${ssWhen(lateSlots[0])} 예약이 검토 없이 지나 아직 안 나갔어요`:`검토 없이 예약 시각이 지나 아직 안 나간 판이 ${latePlates}판이에요`)}</b><p>${ssEsc('텔레그램 검토 링크에서 지금 승인하면 그때 바로 올라가요(예약 시각이 아니라 승인한 때). 안 누르면 계속 안 나가요.')}</p><div class="ss-late">${late.map(r=>`<div><span class="ss-late-title">${ssEsc(r.title||'제목 없는 원고')}</span><span class="ss-plates">${lateSlots.length>1?`<span class="ss-plate is-when">${ssEsc(ssWhen(r.at))}</span>`:''}${(r.plates||[]).map(ssPlate).join('')}</span></div>`).join('')}</div></div></div>`:'';
  const nowCard=review.length?`<div class="ss-now"><div class="ss-now-label">${ssDot('butter')}<span class="ss-mono-tag">지금 확인</span>내 차례 · 검토</div><h3>${ssEsc(slots.length===1?`${ssWhen(slots[0])}에 나갈 ${reviewPlates}판, 유호님 검토가 있어야 나가요`:`${reviewPlates}판이 유호님 검토를 기다려요`)}</h3><p>${ssEsc(`${slots.length>1?slots.map(at=>`${ssWhen(at)} ${platesAt(at)}판`).join(' · ')+'. ':''}텔레그램으로 받은 검토 링크에서 승인하면 그 시각에 바로 올라가요. 안 누르면 나가지 않아요.`)}</p><div class="ss-now-items">${review.map(r=>`<div class="ss-now-item">${ssThumb(r.thumb)}<div><b>${ssEsc(r.title||'제목 없는 원고')}</b><div class="ss-plates">${slots.length>1?`<span class="ss-plate is-when">${ssEsc(ssWhen(r.at))}</span>`:''}${(r.plates||[]).map(ssPlate).join('')}</div></div></div>`).join('')}</div></div>`:'';
  const channels=C.channels||[],top=C.top;
  const commentCard=C.total?`<div class="ss-task is-quiet"><div><div class="ss-task-label">${ssDot()}답 안 한 댓글</div><b>${ssEsc(`${channels.map(c=>`${ssPfName(c.platform)} ${c.handle}`).join(' · ')} 댓글 ${ssN(C.total)}개에 아직 답이 없어요`)}</b><p>${ssEsc(`최근 7일에 달린 것 ${ssN(C.recent7d)}개${top?` · 많은 글 「${String(top.title).length>24?String(top.title).slice(0,24)+'…':top.title}」 ${ssN(top.n)}개`:''}. 이름 답글·자료 DM은 Claude가 정해 둔 문구로 달고 주 1회 묶어 보고해요.`)}</p></div><div class="ss-task-actions"><button class="ss-btn" type="button" data-sw-action="view" data-value="inbox">댓글 화면</button>${top?.url?`<a class="ss-btn" href="${ssEsc(top.url)}" target="_blank" rel="noopener noreferrer">많은 글 열기</a>`:''}</div></div>`:'';
  const episodeRow=(g,small)=>ssRow({time:g.time||'—',small,thumb:g.thumb,title:g.title,meta:ssEpisodeMeta(g),chip:ssStateChip(g.state)});
  const tonightRows=tonight.map(g=>episodeRow(g,g.time?ssMethod(g.method)||'예약':'시각 미정')).join('');
  const heldRows=held.map(g=>episodeRow({...g,time:g.date===today?g.time:ssMdShort(g.date),state:'멈춤'},g.date===today?'오늘':ssMd(g.date).replace(/^[^ ]+ /,''))).join('');
  const days=[1,2,3].map(k=>new Date(Date.parse(today+'T00:00:00Z')+k*86400e3).toISOString().slice(0,10));
  const upcomingHtml=days.map(d=>{
    const list=upcoming.filter(g=>g.date===d),heldThatDay=held.filter(g=>g.date===d).length;
    const body=list.length?list.map(g=>episodeRow(g,g.time?ssMethod(g.method):'시각 미정')).join(''):`<div class="ss-empty-day">${ssEsc(`나갈 편이 없어요${heldThatDay?` · 멈춘 편만 ${heldThatDay}편 있어요`:''}`)}</div>`;
    return `<div class="ss-day">${ssEsc(ssMd(d))}</div><div class="ss-rows">${body}</div>`;
  }).join('');
  const yRows=yesterday.map(g=>{
    const due=(g.plates||[]).map(p=>p.due24).filter(Boolean).sort()[0];
    return ssRow({time:g.time||'—',small:'어제',thumb:g.thumb,title:g.title,meta:`${g.brand?`<span class="ss-brand">${ssEsc(g.brand)}</span>`:''}${(g.plates||[]).map(p=>`<span class="ss-plate">${ssPf(p.platform)}<span class="ss-num">${ssN(p.views)}</span><span class="ss-handle">회</span></span>`).join('')}`,chip:`<span class="ss-st">${due?ssEsc(`24시간 숫자 ${ssRel(due,today)}에 와요`):''}</span>`});
  }).join('');
  const bad=(H.failed||0)+(H.needsReconnect||0)+(H.overdue||0);
  const off=[...new Set((H.offPlatforms||[]).map(ssPfName))].join('·');
  // 하루 수집은 정해 둔 시각에 한 번이라, 그 전(자정 뒤)에는 오늘 모은 수가 0이다 — 그때는 마지막 수집 시각과 다음 수집 시각을 쓴다.
  const collectedToday=!!H.collectedAt&&H.collectedAt.slice(0,10)===today&&(H.collectOk||0)>0;
  const collected=!H.collectTotal?'':collectedToday?`계정 ${H.collectTotal}개 중 ${H.collectOk}개를 오늘 ${H.collectedAt.slice(11)}에 모음`:H.collectedAt?`계정 ${H.collectTotal}개 · 마지막 수집 ${ssRel(H.collectedAt,today)}`:`계정 ${H.collectTotal}개 · 아직 모은 기록이 없어요`;
  const health=`<div class="ss-health">${ssDot(bad?'coral':'green')}${ssEsc([bad?`수집에 문제가 있어요 · 실패 ${H.failed||0} · 다시 연결 ${H.needsReconnect||0} · 밀림 ${H.overdue||0}`:'연결·수집 이상 없음',collected,H.nextAt?`다음 수집 ${ssRel(H.nextAt,today)}`:'',off?`자동 수집이 안 되는 곳: ${off}`:'',H.numbersAt?`숫자는 ${ssRel(H.numbersAt,today)} 기준`:''].filter(Boolean).join(' · '))}</div>`;
  return ssHead({title:'오늘',lede:ssEsc(`${ssMd(today)} · 내가 할 일과 나갈 게시물만 모았어요.`),poster:ssPoster({label:'SNS · 오늘',stats:[[ssN(myTurn),'내 차례'],[`${ssN(tonight.length)}편`,'오늘 나감']],word:'오늘',art:'overview'})})
    +ssMeter([['검토 대기',ssUnit(reviewPlates,'판'),'butter','검토'],['오늘 나감',ssUnit(tonight.length,'편'),'green','오늘'],['예약 문제',ssUnit(problems.length+latePlates,'판'),problems.length+latePlates?'coral':'','문제'],['멈춘 편',ssUnit(held.length,'편'),'','멈춤']])
    +`<section class="ss-block">${ssBlockHead('내 차례',{count:myTurn,hint:'유호님이 해야 나가는 일만'})}${problemCard}${lateCard}${nowCard}${myTurn?'':'<div class="ss-calm">오늘은 손댈 일이 없어요.</div>'}</section>`
    +`<section class="ss-block">${ssBlockHead('오늘 나가는 것',{count:tonight.length})}<div class="ss-rows">${tonightRows||'<div class="ss-empty-day">오늘 나갈 편이 없어요</div>'}</div>${held.length?`<details class="ss-fold"><summary><span class="ss-what">멈춘 편 ${ssN(held.length)}</span><span class="ss-hint">${ssEsc('보류한 편이에요 · 다시 판단하기 전엔 안 나가요')}</span></summary><div class="ss-rows">${heldRows}</div></details>`:''}</section>`
    +`<section class="ss-block">${ssBlockHead('다음 사흘',{hint:ssEsc('검토 대기는 위 「내 차례」에서 승인해요')})}${upcomingHtml}</section>`
    +(yesterday.length?`<section class="ss-block">${ssBlockHead('어제 올린 편',{count:yesterday.length,hint:ssEsc('지금까지 조회 · 자세한 건 성과에서'),tools:'<button class="ss-link" type="button" data-sw-action="view" data-value="results">성과 보기</button>'})}<div class="ss-rows">${yRows}</div></section>`:'')
    +(commentCard?`<section class="ss-block">${ssBlockHead('알아 둘 것')}${commentCard}</section>`:'')
    +health;
}

// ── 성과 ──
// 배수 = 그 판 조회 ÷ 같은 계정·형식에서 앞서 올린 최근 12편이 같은 시점에 낸 조회의 중앙값(장부 값, 게시성과판정.js multipleOf). 견줄 편 4개부터 보이고, 72시간 ∧ 2배 이상만 초록(게시성과시험.js 배수 2). 「낮음」은 없다.
function ssLatestPoint(p){const pts=p.points||{};return pts['72h']&&pts['72h'].views!==null&&pts['72h'].views!==undefined?['72시간',pts['72h']]:pts['24h']&&pts['24h'].views!==null&&pts['24h'].views!==undefined?['24시간',pts['24h']]:null;}
const ssPassed=lp=>!!(lp&&lp[0]==='72시간'&&lp[1].multiple&&lp[1].multiple.value>=2);
const ssTimes=v=>v>=10?v.toFixed(0):v.toFixed(1);
function ssResultsSummary(R){
  const all=R.flatMap(g=>(g.plates||[]).map(p=>({g,p,lp:ssLatestPoint(p)})));
  const withX=all.filter(x=>x.lp&&x.lp[1].multiple);
  const best=withX.slice().sort((a,b)=>b.lp[1].multiple.value-a.lp[1].multiple.value)[0]||null;
  const points=x=>Object.values(x.p.points||{});
  return {all,best,passN:all.filter(x=>ssPassed(x.lp)).length,lackN:all.filter(x=>points(x).some(pt=>pt.verdict==='자료 부족')).length,judgedN:all.filter(x=>points(x).some(pt=>pt.verdict&&pt.verdict!=='자료 부족')).length,waitingN:all.filter(x=>!x.lp&&(x.p.pending||[]).length).length};
}
function ssXPill(lp){
  if(!lp)return '';
  const m=lp[1].multiple;if(!m)return `<span class="ss-x none">${ssEsc(`견줄 편 ${lp[1].sampleN||0}개`)}</span>`;
  const median=ssN(Math.round(m.median));
  return ssPassed(lp)?`<span class="ss-x up" title="${ssEsc(`72시간 조회가 평소(${median}회)의 2배 이상이에요`)}">▲ ${ssTimes(m.value)}배</span>`:`<span class="ss-x mid" title="${ssEsc(`평소 ${median}회`)}">${ssTimes(m.value)}배</span>`;
}
function ssPlRow(p,today){
  const lp=ssLatestPoint(p),pending=(p.pending||[])[0];
  const v=lp?`<span class="ss-v">${ssN(lp[1].views)}<small>${lp[0]}</small></span>`:`<span class="ss-v">${ssN(p.now?.views)}<small>지금까지</small></span>`;
  const right=lp?ssXPill(lp):`<span class="ss-x none">${ssEsc(pending?`${pending.hours}시간 숫자 ${ssRel(pending.dueAt,today)}에 와요`:'숫자 없음')}</span>`;
  return `<div class="ss-pl">${ssPf(p.platform)}<span class="ss-handle">${ssEsc(p.handle)}</span>${v}${right}</div>`;
}
const SS_METRICS=[['조회','views'],['3초 유지율','retention3s','%'],['평균 시청','avgWatch','초'],['저장','saves'],['공유','shares'],['좋아요','likes'],['댓글','comments']];
function ssDetailTable(g,today){
  const body=(g.plates||[]).map(p=>{
    const pts=p.points||{},due72=(p.pending||[]).find(x=>x.hours===72);
    return SS_METRICS.filter(([,k])=>[pts['24h']?.[k],pts['72h']?.[k],p.now?.[k]].some(v=>v!==null&&v!==undefined)).map(([label,k,unit],i)=>{
      const fmt=v=>unit==='초'?Number(v).toFixed(1)+unit:unit?ssN(v)+unit:ssN(v);
      const cell=(v,h)=>v===null||v===undefined?(h===72&&due72&&k==='views'?`<td class="is-dash">${ssEsc(ssRel(due72.dueAt,today))}에 와요</td>`:'<td class="is-dash">—</td>'):`<td>${ssEsc(fmt(v))}</td>`;
      const ref=k==='views'?(pts['72h']?.multiple?['72시간',pts['72h'].multiple]:pts['24h']?.multiple?['24시간',pts['24h'].multiple]:null):null;
      const name=i===0?`${ssEsc(ssPfName(p.platform))} ${ssEsc(p.handle)}${p.url?` <a href="${ssEsc(p.url)}" target="_blank" rel="noopener noreferrer" aria-label="원래 게시물 열기">↗</a>`:''}`:'';
      return `<tr><td>${name}</td><td class="is-metric">${ssEsc(label)}</td>${cell(pts['24h']?.[k],24)}${cell(pts['72h']?.[k],72)}${cell(p.now?.[k])}${ref?`<td>${ssN(Math.round(ref[1].median))}<small class="ss-pt">${ref[0]}</small></td>`:'<td class="is-dash">—</td>'}</tr>`;
    }).join('');
  }).join('');
  return `<div class="ss-detail"><p class="ss-scroll-hint">옆으로 밀면 72시간·지금까지·평소 숫자가 보여요</p><table><thead><tr><th>판</th><th>지표</th><th>24시간</th><th>72시간</th><th>지금까지</th><th>평소</th></tr></thead><tbody>${body}</tbody></table></div>`;
}
function ssResults(D,{brand='전체',sort='recent',open=new Set(),perf=null}={}){
  const today=D.today,res=D.results||{},R=res.list||[],S=ssResultsSummary(R),excluded=res.excluded||{};
  const brands=['전체',...['유호','브리핑','LAB','회사'].filter(b=>R.some(g=>g.brand===b))];
  const list=R.filter(g=>brand==='전체'||g.brand===brand).slice();
  const score=g=>Math.max(-1,...(g.plates||[]).map(p=>ssLatestPoint(p)?.[1].multiple?.value??-1));
  if(sort==='best')list.sort((a,b)=>score(b)-score(a));
  const bestKey=S.best?.g.key;
  const rows=list.map(g=>{
    const isOpen=open.has(g.key),hasPoints=(g.plates||[]).some(p=>Object.keys(p.points||{}).length);
    return `<div class="ss-res${g.key===bestKey&&sort==='recent'&&brand==='전체'?' is-best':''}">${ssThumb(g.thumb)}<div><div class="ss-res-title">${ssEsc(g.title)}</div><div class="ss-res-meta">${g.brand?`<span class="ss-brand">${ssEsc(g.brand)}</span>`:''}<span>${ssEsc(ssRel(g.firstAt,'').replace(/^오늘 /,''))}</span></div></div><div class="ss-pl-list">${(g.plates||[]).map(p=>ssPlRow(p,today)).join('')}</div>${hasPoints?`<button class="ss-link ss-more" type="button" data-ss-action="detail" data-value="${ssEsc(g.key)}" aria-expanded="${isOpen}">${isOpen?'숫자 접기':'숫자 모두 보기'}</button>${isOpen?ssDetailTable(g,today):''}`:''}</div>`;
  }).join('');
  const bl=S.best?.lp[1];
  // 계정과 「72시간 N회」를 두 줄로 나눠, 핸들 길이에 따라 숫자가 중간에서 끊기지 않게 한다. 긴 핸들은 점·밑줄 뒤에서 끊는다.
  const posterStats=S.best?[[`${ssTimes(bl.multiple.value)}배`,`${ssEsc(ssPfName(S.best.p.platform))} ${ssEsc(S.best.p.handle).replace(/([._])/g,'$1<wbr>')}<br>${ssEsc(`${S.best.lp[0]} ${ssN(bl.views)}회`)}`]]:[[`${ssN(R.length)}편`,'올린 편'],[`${ssN(S.passN)}판`,'2배 이상']];
  return ssHead({title:'성과',lede:'기간 동안 늘어난 숫자를 바로 앞 같은 길이 기간과 견주고, 올린 편마다 같은 계정의 평소 조회와 견줘요.',poster:ssPoster({label:S.best?'이번 주 최고 반응':'SNS · 성과',stats:posterStats,word:'성과',art:'results'})})
    +ssMeter([['올린 편',ssUnit(R.length,'편'),undefined,'올린 편'],['평소 2배 이상',ssUnit(S.passN,'판'),'green','2배 이상'],['숫자 기다림',ssUnit(S.waitingN,'판'),'butter','기다림'],['판정 자료 부족',ssUnit(S.lackN,'판'),'','자료 부족']])
    +(perf?ssPerfBlock(perf,D):'')
    +(S.judgedN||!S.all.length?'':`<p class="ss-note">판정(3초 유지율·평균 시청·저장·도구 유입 네 숫자)은 아직 모두 「자료 부족」이에요. 같은 계정에서 견줄 편이 4편은 쌓여야 나와요.</p>`)
    +`<section class="ss-block">${ssBlockHead('편별',{hint:res.since?ssEsc(`${ssMd(res.since)} 뒤 올린 편`):'',tools:`${brands.length>2?`<div class="ss-seg" role="group" aria-label="브랜드">${brands.map(b=>`<button type="button" data-ss-action="brand" data-value="${ssEsc(b)}" aria-pressed="${brand===b}">${ssEsc(b)}</button>`).join('')}</div>`:''}<div class="ss-seg" role="group" aria-label="순서"><button type="button" data-ss-action="sort" data-value="recent" aria-pressed="${sort==='recent'}">최근 순</button><button type="button" data-ss-action="sort" data-value="best" aria-pressed="${sort==='best'}">잘된 순</button></div>`})}<div class="ss-rows">${rows||'<div class="ss-empty-day">이 기간에 올린 편이 아직 없어요</div>'}</div>`
    +`<p class="ss-foot">${ssEsc(`배수 = 이 판 조회 ÷ 같은 계정·형식에서 앞서 올린 최근 12편이 같은 시점(24·72시간)에 낸 조회의 가운데 값이에요. 견줄 편이 4개는 돼야 보이고, 72시간 조회가 2배 이상이면 초록이에요.${excluded.운영시험||excluded.작품?` 시험 게시 ${excluded.운영시험||0}편과 공모전 출품작 ${excluded.작품||0}편은 뺐어요.`:''}`)}</p></section>`;
}

// ── 성과 · 기간 ── (11-13 유호님: 7/30/60/90일, 지표 고르기, 바로 앞 같은 길이 기간과 같은 대상끼리)
// 자료는 기존 GET /api/analytics?start&end(&business|platform|channel) 두 번(이번 기간 · 이전 기간)이다. 끝은 끝난 어제(한국 날짜).
// 숫자 규칙(서버 analytics.mjs와 같음): 비어 있는 날은 0이 아니라 「기록 없음」 — 선을 끊고 메우지 않는다.
// 비교 %는 서버 periodComparison(두 기간 모두 같은 대상 · 세 경계일 기록이 다 있을 때만 rate)만 쓴다. period.rate는 누적 대비 증가율이라 쓰지 않는다.
// 「기간 동안 늘어난 수」(period.delta)와 「게시물 누적」(latest — 지금까지 쌓인 값의 합)은 다른 숫자라 칸을 나눈다.
// 그림 문법 근거(.tmp/account-map-current/ui-result.md): 같은 길이 이전 기간(Metricool 도움말) · 이번 값 · 비교 · 이전 값을 한 칸에(Buffer 주간 요약) ·
// 이전 기간은 회색 점선 한 줄, 이번 기간은 2px 실선 한 줄, 축 하나, 옅은 격자 셋, 머리 위 마우스 말풍선 + 표 보기.
const SS_PERF_DAYS=[7,30,60,90];
const SS_PERF_METRICS=[['views','조회'],['likes','좋아요'],['shares','공유'],['comments','댓글'],['saves','저장'],['reach','도달'],['followers','팔로워']];
const SS_PERF_BUSINESS=['LAB','SHIFT','PULSE','PATH'];
const ssPerfLabel=key=>(SS_PERF_METRICS.find(([k])=>k===key)||[key,key])[1];
const ssNum=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const ssAddDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400e3).toISOString().slice(0,10);
// today = 한국 날짜 'YYYY-MM-DD'. 이번 기간은 어제까지 N일, 이전 기간은 그 바로 앞 N일.
function ssPerfRange(today,days){
  const end=ssAddDays(today,-1),start=ssAddDays(end,-(days-1)),prevEnd=ssAddDays(start,-1),prevStart=ssAddDays(prevEnd,-(days-1));
  return {start,end,prevStart,prevEnd,days};
}
// 고른 대상: '' 전체 · 'business:LAB' · 'platform:youtube' · 'channel:<id>' → 서버 query 조각
function ssPerfQuery(range,target,which='current'){
  const q=new URLSearchParams(which==='previous'?{start:range.prevStart,end:range.prevEnd}:{start:range.start,end:range.end});
  const [kind,value]=String(target||'').split(/:(.*)/s);
  if(value&&['business','platform','channel'].includes(kind))q.set(kind,value);
  return '/api/analytics?'+q.toString();
}
// 날마다 하루 증가(change.delta). 그날 비교할 대상이 하나도 없으면 null(0으로 메우지 않음). complete는 그날 모든 대상이 비교됐는지.
function ssPerfSeries(report,key){
  return (Array.isArray(report?.daily)?report.daily:[]).map(day=>{
    const ch=day?.metrics?.[key]?.change||{};
    const value=ch.count>0?ssNum(ch.delta):null;
    return {date:day.date,value,count:ch.count||0,eligible:ch.eligible||0,complete:!!ch.complete};
  });
}
// 이유 문구 — periodComparison.reason(서버) 그대로 옮긴다.
const SS_PERF_REASON={'missing-baseline':'두 기간 모두 기록이 있는 대상이 아직 없어요','partial-coverage':'일부 대상만 두 기간 기록이 있어 %는 내지 않아요','counter-correction':'플랫폼이 숫자를 고친 대상이 있어 %는 내지 않아요(줄어든 값 포함)','zero-previous':'이전 기간 증가가 0이라 %를 낼 수 없어요'};
function ssPerfSummary(report,key){
  const m=report?.metrics?.[key];
  if(!m)return null;
  const period=m.period||{},pc=m.periodComparison||null;
  const prevZero=pc&&(pc.previous===0||ssNum(pc.previous)===0);
  const rate=pc&&!prevZero&&pc.complete&&pc.reason==null?ssNum(pc.rate):null;
  // matchedRate(11-13): 세 경계일 기록이 다 있는 일부 대상만의 실제 증감률. 전체 비교(rate)가 없고 이유가 「일부 대상」이며 이전 기간이 0이 아닐 때만 쓰고, 일부라는 것을 크게 밝힌다.
  const matchedRate=pc&&!prevZero&&rate===null&&pc.reason==='partial-coverage'?ssNum(pc.matchedRate):null;
  return {
    delta:ssNum(period.delta),count:period.count||0,eligible:period.eligible||0,complete:!!period.complete,
    cumulative:ssNum(m.latest),cumulativeCount:m.latestCount??m.count??0,stale:m.stale||0,
    comparison:pc?{current:ssNum(pc.current),previous:ssNum(pc.previous),delta:ssNum(pc.delta),rate,matchedRate,count:pc.count||0,eligible:pc.eligible||0,complete:!!pc.complete,reason:pc.reason||null}:null
  };
}
// 큰 수는 축 · 말풍선에서 줄여 쓴다(1.2만). 표와 요약 칸은 다 쓴다.
function ssCompact(v){const n=Number(v),a=Math.abs(n);if(!Number.isFinite(n))return '—';if(a>=1e8)return (n/1e8).toFixed(a>=1e9?0:1).replace(/\.0$/,'')+'억';if(a>=1e4)return (n/1e4).toFixed(a>=1e5?0:1).replace(/\.0$/,'')+'만';return n.toLocaleString('ko-KR');}
const ssSigned=v=>v===null?'—':(v>0?'+':v<0?'−':'')+Math.abs(v).toLocaleString('ko-KR');
// 선 그림(SVG 문자열). 이번 기간과 이전 기간을 「며칠째」로 맞춰 같은 가로축에 둔다. 값이 없는 날에서 선을 끊는다.
function ssPerfChart(cur,prev,{w=720,h=220,label='조회',signed=true,ariaLabel=''}={}){
  const n=Math.max(cur.length,prev.length,1),padL=48,padR=12,padT=14,padB=28,fmt=signed?ssSigned:ssN,tipLabel=signed?label:`하루 ${label}`;
  const vals=[...cur,...prev].map(p=>p.value).filter(v=>v!==null);
  if(!vals.length)return `<div class="ss-perf-empty">${ssEsc('이 기간에는 날마다 견줄 기록이 아직 없어요. 수집이 두 번 이상 쌓이면 선이 생겨요.')}</div>`;
  let lo=Math.min(0,...vals),hi=Math.max(0,...vals);if(hi===lo)hi=lo+1;
  const x=i=>padL+(n===1?0:(w-padL-padR)*i/(n-1)),y=v=>padT+(h-padT-padB)*(1-(v-lo)/(hi-lo));
  const line=list=>{let d='',open=false;list.forEach((p,i)=>{if(p.value===null){open=false;return;}d+=`${open?'L':'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`;open=true;});return d;};
  // 앞뒤가 비어 혼자 있는 날은 선이 안 그려지므로 점으로 보인다. 일부 대상만 비교된 날은 속이 빈 점.
  const dots=(list,cls)=>list.map((p,i)=>{if(p.value===null)return '';const alone=(i===0||list[i-1].value===null)&&(i===list.length-1||list[i+1]?.value===null);return alone||!p.complete?`<circle class="${cls}${p.complete?'':' is-part'}" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.5"/>`:'';}).join('');
  const grid=[hi,(hi+lo)/2,lo].map(v=>`<line class="ss-perf-grid" x1="${padL}" x2="${w-padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="ss-perf-axis" x="${padL-8}" y="${(y(v)+4).toFixed(1)}" text-anchor="end">${ssEsc(ssCompact(Math.round(v)))}</text>`).join('')+(lo<0?`<line class="ss-perf-zero" x1="${padL}" x2="${w-padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>`:'');
  const ticks=[0,Math.floor((n-1)/2),n-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=>`<text class="ss-perf-axis" x="${x(i).toFixed(1)}" y="${h-8}" text-anchor="${i===0?'start':i===n-1?'end':'middle'}">${ssEsc((cur[i]?.date||prev[i]?.date)?ssMdShort(cur[i]?.date||prev[i]?.date):`${i+1}일째`)}</text>`).join('');
  const band=n===1?(w-padL-padR):(w-padL-padR)/(n-1);
  const hits=Array.from({length:n},(_,i)=>{const c=cur[i]||{},p=prev[i]||{};const tip=`${c.date?ssMd(c.date):`${i+1}일째`} · ${tipLabel} ${c.value===null||c.value===undefined?'기록 없음':fmt(c.value)}${c.value!==null&&c.value!==undefined&&!c.complete?` (대상 ${c.count}/${c.eligible})`:''}|이전 기간${p.date?` ${ssMdShort(p.date)}`:''} ${p.value===null||p.value===undefined?'기록 없음':fmt(p.value)}`;return `<rect class="ss-perf-hit" x="${Math.max(padL,x(i)-band/2).toFixed(1)}" y="${padT}" width="${Math.min(band,w-padR-Math.max(padL,x(i)-band/2)).toFixed(1)}" height="${h-padT-padB}" data-i="${i}" data-x="${x(i).toFixed(1)}" data-tip="${ssEsc(tip)}"/>`;}).join('');
  return `<svg class="ss-perf-svg" viewBox="0 0 ${w} ${h}" role="img" tabindex="0" aria-label="${ssEsc(ariaLabel||`${signed?'날마다 늘어난':'하루'} ${label} · 실선 이번 기간 · 점선 이전 기간 · 좌우 화살표로 날마다 읽기`)}">${grid}${ticks}<path class="ss-perf-prev" d="${line(prev)}"/>${dots(prev,'ss-perf-pdot')}<path class="ss-perf-cur" d="${line(cur)}"/>${dots(cur,'ss-perf-cdot')}<line class="ss-perf-cross" x1="0" x2="0" y1="${padT}" y2="${h-padB}" hidden/>${hits}</svg>`;
}
// 수집 상태 한 줄: 마지막 성공 · 이번 수집 범위(계정 n/m) · 실패 · 다음 수집 · 하루 수집 시각(서버가 알려 줄 때만).
function ssCollectTimes(D){
  // 서버 계약(11-13): D.collectionSchedule={enabled,hoursKst:[9,21.5],timeZone,nextAt}. 옛 · 다른 이름도 읽되, 꺼져 있거나 없으면 시각을 지어내지 않는다.
  const H=D.health||{},S=D.collectionSchedule||D.schedule||{};
  if(S.enabled===false)return '';
  const raw=[S.hoursKst,S.collectionTimes,H.collectionTimes,H.hoursKst].find(v=>Array.isArray(v)&&v.length)||null;
  if(!raw)return '';
  const hm=n=>{const h=Math.floor(n),m=Math.round((n-h)*60);return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;};
  return raw.map(t=>typeof t==='number'&&Number.isFinite(t)&&t>=0&&t<24?hm(t):typeof t==='string'?t:t&&typeof t==='object'?String(t.time||t.at||''):'').filter(t=>/^\d{1,2}:\d{2}$/.test(t)).join(' · ');
}
// ISO('…Z') → 서버 한국 시각 꼴 'YYYY-MM-DD HH:MM'. 이미 그 꼴이면 그대로.
function ssKstAt(value){const s=String(value||'');if(!/T/.test(s))return s;const ms=Date.parse(s);return Number.isFinite(ms)?new Date(ms+9*3600e3).toISOString().slice(0,16).replace('T',' '):'';}
function ssCollectLine(D){
  const H=D.health||{},today=D.today,times=ssCollectTimes(D),bad=(H.failed||0)+(H.needsReconnect||0)+(H.overdue||0);
  const nextAt=ssKstAt(D.collectionSchedule?.enabled===false?'':D.collectionSchedule?.nextAt||H.nextAt);
  const parts=[
    H.collectedAt?`마지막 수집 ${ssRel(H.collectedAt,today)}`:'아직 수집한 기록이 없어요',
    H.collectTotal?`계정 ${ssN(H.collectOk)}/${ssN(H.collectTotal)}개 오늘 모음`:'',
    bad?`일부 실패 · 실패 ${H.failed||0} · 다시 연결 ${H.needsReconnect||0} · 밀림 ${H.overdue||0}`:'',
    times?`하루 ${times.split(' · ').length}번(${times}) 모아요`:'',
    nextAt?`다음 ${ssRel(nextAt,today)}`:D.collectionSchedule?.enabled===false?'자동 수집 꺼짐':''
  ].filter(Boolean);
  return `<p class="ss-perf-collect">${ssDot(bad?'coral':H.collectedAt?'green':'')}${ssEsc(parts.join(' · '))}<span class="ss-perf-sep">${ssEsc('브라우저 로그인과 수집 API 연결은 따로 봐요 — 로그인 상태는 나라 지도의 계정에서 확인해요.')}</span></p>`;
}
// perf = {days,metric,target,status:'idle'|'loading'|'ready'|'error',error,current,previous,range}
function ssPerfBlock(perf,D){
  const days=SS_PERF_DAYS.includes(perf.days)?perf.days:30,metric=SS_PERF_METRICS.some(([k])=>k===perf.metric)?perf.metric:'views',label=ssPerfLabel(metric);
  const accounts=(D.accounts||[]).filter(a=>a.channelId),platforms=[...new Set(accounts.map(a=>a.platform).filter(Boolean))];
  const opt=(value,text)=>`<option value="${ssEsc(value)}"${perf.target===value?' selected':''}>${ssEsc(text)}</option>`;
  const targetSelect=`<label class="ss-perf-target"><span>대상</span><select data-ss-perf="target">${opt('','모든 계정')}<optgroup label="사업">${SS_PERF_BUSINESS.map(b=>opt('business:'+b,b)).join('')}</optgroup>${platforms.length?`<optgroup label="플랫폼">${platforms.map(p=>opt('platform:'+p,ssPfName(p)||p)).join('')}</optgroup>`:''}${accounts.length?`<optgroup label="계정">${accounts.map(a=>opt('channel:'+a.channelId,`${ssPfName(a.platform)} ${a.handle||a.name||''}`.trim())).join('')}</optgroup>`:''}</select></label>`;
  const tools=`<div class="ss-seg" role="group" aria-label="기간">${SS_PERF_DAYS.map(d=>`<button type="button" data-ss-action="perf-days" data-value="${d}" aria-pressed="${d===days}">${d}일</button>`).join('')}</div>`;
  const metrics=`<div class="ss-perf-metrics" role="group" aria-label="지표">${SS_PERF_METRICS.map(([k,l])=>`<button type="button" data-ss-action="perf-metric" data-value="${k}" aria-pressed="${k===metric}">${ssEsc(l)}</button>`).join('')}</div>`;
  const range=perf.range||(D.today?ssPerfRange(D.today,days):null);
  const rangeText=range?`${ssMdShort(range.start)}~${ssMdShort(range.end)} · 이전 ${ssMdShort(range.prevStart)}~${ssMdShort(range.prevEnd)}`:'';
  let body;
  if(perf.status==='error')body=`<div class="ss-perf-empty" role="alert">${ssEsc(perf.error||'성과 숫자를 불러오지 못했어요.')} <button class="ss-link" type="button" data-ss-action="perf-reload">다시 불러오기</button></div>`;
  else if(perf.status!=='ready'||!perf.current)body=`<div class="ss-perf-empty" role="status">${ssEsc(`${days}일 숫자를 불러오고 있어요`)}</div>`;
  else{
    const S=ssPerfSummary(perf.current,metric);
    // 사업 거르기를 서버가 아직 모르면(scope.business가 안 돌아오면) 전체 숫자이므로 그 사업 숫자라고 쓰지 않는다.
    const [kind,value]=String(perf.target||'').split(/:(.*)/s),unscoped=kind==='business'&&perf.current?.scope?.business!==value;
    if(!S||unscoped)body=`<div class="ss-perf-empty" role="status">${ssEsc(unscoped?`${value} 사업으로 거르는 기능이 서버에 아직 없어 이 숫자는 보이지 않아요. 「모든 계정」이나 계정을 골라 주세요.`:'이 지표는 아직 받은 기록이 없어요.')}</div>`;
    else{
      const C=S.comparison,cur=ssPerfSeries(perf.current,metric),prev=ssPerfSeries(perf.previous,metric);
      // 사업 분류가 안 된 서버 채널(unassignedChannelCount): 사업으로 거르면 그만큼 빠졌다고, 모든 계정이면 분류가 필요하다고 알린다.
      const unassigned=ssNum(perf.current?.unassignedChannelCount)||0;
      const unassignedNote=!unassigned||kind&&kind!=='business'?'':`<p class="ss-perf-warn" role="note">${ssDot('butter')}${ssEsc(kind==='business'?`사업 분류가 안 된 채널 ${unassigned}개는 ${value} 숫자에서 빠졌어요.`:`사업 분류가 필요한 채널이 ${unassigned}개 있어요. 모든 계정 숫자에는 들어 있어요.`)}</p>`;
      const pct=r=>`${r>0?'▲':r<0?'▼':''} ${Math.abs(r).toFixed(Math.abs(r)>=10?0:1)}%`;
      const full=C&&C.rate!==null&&C.rate!==undefined,part=!full&&C&&C.matchedRate!==null&&C.matchedRate!==undefined;
      const rateText=full?pct(C.rate):part?pct(C.matchedRate):'—';
      const cover=(c,e)=>e?`대상 ${ssN(c)}/${ssN(e)}`:'대상 없음';
      const partialTag=C?.reason==='partial-coverage'?(C.eligible?`일부 대상만 ${ssN(C.count)}/${ssN(C.eligible)}`:'일부 대상만'):'';
      const hasPair=C&&C.current!==null&&C.previous!==null;
      const compSub=part?`비교 가능한 ${ssN(C.count)}/${ssN(C.eligible)}개 기준 · 이번 ${ssSigned(C.current)} · 이전 ${ssSigned(C.previous)} · 전체 계정 성장이 아니에요`:C?C.reason?`${SS_PERF_REASON[C.reason]||C.reason}${hasPair?`${C.eligible?` · 비교 가능한 ${ssN(C.count)}/${ssN(C.eligible)}개 기준`:''} · 이번 ${ssSigned(C.current)} · 이전 ${ssSigned(C.previous)}`:''}`:`같은 대상 ${ssN(C.count)}개 · 이번 ${ssSigned(C.current)} · 이전 ${ssSigned(C.previous)}`:'비교 자료가 아직 없어요';
      const cumSub=metric==='followers'?'기간 증가가 아니라 지금 값이에요':S.cumulative===null?'수집된 게시물 누적 기록이 아직 없어요':`기간 증가가 아니라 ${ssMdShort(range?.end)}까지 쌓인 합(${metric==='views'?'플랫폼 전체 총조회 아님':'플랫폼 전체 총합 아님'}) · 게시물 ${ssN(S.cumulativeCount)}개${S.stale?` · 그중 ${ssN(S.stale)}개는 그 전 기록`:''}`;
      const cells=[
        [`${days}일 동안 늘어난 ${label}`,S.delta===null?'—':ssSigned(S.delta),S.delta===null?'두 끝날 모두 기록이 있는 대상이 없어요':`${cover(S.count,S.eligible)}${S.complete?'':' · 일부만'}`],
        [`이전 ${days}일과 비교`,rateText,compSub,partialTag],
        [metric==='followers'?'지금 팔로워(계정 합)':`게시물 누적 ${label}(지금까지)`,S.cumulative===null?'—':ssN(S.cumulative),cumSub]
      ];
      const table=`<details class="ss-perf-table"><summary>날짜별 숫자 표로 보기</summary><div class="ss-detail"><table><thead><tr><th>날짜</th><th>이번 기간 하루 증가</th><th>비교 대상</th><th>이전 기간 날짜</th><th>이전 하루 증가</th></tr></thead><tbody>${cur.map((c,i)=>{const p=prev[i]||{};return `<tr><td>${ssEsc(ssMd(c.date))}</td><td${c.value===null?' class="is-dash"':''}>${c.value===null?'기록 없음':ssEsc(ssSigned(c.value))}</td><td>${ssEsc(cover(c.count,c.eligible))}</td><td>${ssEsc(p.date?ssMd(p.date):'')}</td><td${p.value===null||p.value===undefined?' class="is-dash"':''}>${p.value===null||p.value===undefined?'기록 없음':ssEsc(ssSigned(p.value))}</td></tr>`;}).join('')}</tbody></table></div></details>`;
      // 공개 통계만 연결한 YouTube는 수집 기록을 30일만 보관해(기존 보존 정책) 60·90일 비교가 쌓이지 않는다 — YouTube가 대상에 들 때만 한 번 알린다(전체 계정 제한이 아님).
      const ytInScope=kind==='platform'?value==='youtube':kind==='channel'?accounts.some(a=>a.channelId===value&&a.platform==='youtube'):kind==='business'||!kind?accounts.some(a=>a.platform==='youtube'):false;
      const ytNote=days>=60&&ytInScope?'공개 통계만 연결한 YouTube는 기록을 30일만 보관해서, 그보다 오래된 비교에는 채널 소유자 인증이 필요해요(기록이 없는 날은 비워 둬요).':'';
      const notes=[metric==='views'?'기간 동안 늘어난 조회, 수집한 최근 게시물의 누적 조회, 플랫폼 채널 전체 총조회는 서로 다른 숫자예요.':'',metric==='reach'?'도달은 게시물마다 받은 도달을 더한 것이라 서로 다른 사람 수가 아니에요.':'',metric==='followers'?'팔로워는 계정 숫자예요. 게시물 숫자와 더하지 않아요.':'',ytNote,'하루 증가는 그날과 전날 모두 기록이 있는 대상만 더해요. 기록이 없는 날은 선을 끊고 0으로 메우지 않아요. 플랫폼이 숫자를 고치면 줄어들 수도 있어요.'].filter(Boolean);
      body=unassignedNote+`<div class="ss-perf-cells">${cells.map(([k,v,s,tag],i)=>`<div class="ss-perf-cell${i===0?' is-main':''}${tag?' is-partial':''}"><span>${ssEsc(k)}${tag?`<em class="ss-perf-tag">${ssEsc(tag)}</em>`:''}</span><strong class="ss-perf-num">${ssEsc(v)}</strong><small>${ssEsc(s)}</small></div>`).join('')}</div>`
        +`<div class="ss-perf-plot"><ul class="ss-perf-legend" aria-label="선 안내"><li><i class="ss-perf-key is-cur" aria-hidden="true"></i>이번 ${days}일 · 하루 증가</li><li><i class="ss-perf-key is-prev" aria-hidden="true"></i>이전 ${days}일</li></ul>${ssPerfChart(cur,prev,{label})}<div class="ss-perf-tip" role="status" hidden></div></div>`
        +table+`<p class="ss-foot">${ssEsc(notes.join(' '))}</p>`;
    }
    if(!unscoped)body+=ssPerfExternal(perf.current,{previous:perf.previous,metric,days,range,target:perf.target,today:D.today,accounts:D.accounts});
  }
  return `<section class="ss-block ss-perf">${ssBlockHead('기간 성과',{hint:ssEsc(rangeText),tools})}<div class="ss-perf-bar">${metrics}${targetSelect}</div>${body}${ssCollectLine(D)}</section>`;
}

// ── 외부 통계 관측(플랫폼 관리 화면 · 공식 내보내기 · 공개 화면) ──
// 수집 API 연결·자동 합계와는 별개 기록이다(countsAsApiCollection:false, includedInTotals:false).
const SS_EXT_SOURCE={'creator-screen':'관리 화면 확인','official-export':'공식 내보내기','public-page':'공개 화면 확인'};
const SS_EXT_METRICS=[['views','조회수'],['likes','좋아요'],['shares','공유'],['comments','댓글'],['reach','도달'],['saves','저장'],['impressions','노출'],['visitors','방문자'],['profileVisits','프로필 방문'],['linkClicks','링크 클릭'],['followersGained','팔로워 증가'],['followersLost','팔로워 감소'],['watchTimeMinutes','시청 시간(분)'],['postsPublished','발행 게시물'],['followers','팔로워'],['posts','게시물']];
function ssExtMetricLabel(k){
  const hit=SS_EXT_METRICS.find(([id])=>id===k);
  return hit?hit[1]:String(k??'');
}
function ssExtSource(sourceType,fallback='화면 확인'){
  const raw=String(sourceType??'').trim();
  return raw?(SS_EXT_SOURCE[raw]||raw):fallback;
}
const ssObsVal=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('ko-KR'):typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v).toLocaleString('ko-KR'):'—';
function ssSafeUrl(u){
  const s=typeof u==='string'?u.trim():'',lo=s.toLowerCase();
  return lo.startsWith('https://')||lo.startsWith('http://')?s:'';
}
function ssExtWhen(at,today='',dateOnly=false){
  const raw=String(at??'').trim();
  if(!raw)return '';
  const td=typeof today==='string'?today:'';
  if(dateOnly===true){const d=raw.slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)?ssRel(d,td):raw;}
  const kst=ssKstAt(raw);
  return kst?ssRel(kst,td):raw;
}
function ssExtPeriod(period,labels){
  const p=period&&typeof period==='object'?period:null,lbl=String(labels?.periodLabel??'').trim();
  const dVal=p?ssObsVal(p.days):'—',days=dVal!=='—'?`${dVal}일`:'';
  const span=p?.start&&p?.end?`${p.start}~${p.end}${days?` (${days})`:''}`:p?.start||p?.end||days||'';
  return [span,lbl&&lbl!==span?lbl:''].filter(Boolean).join(' · ');
}
function ssExtObsTable(items,metricCols,{range,days,today}={}){
  const head=`<thead><tr><th>계정</th><th>구분 · 실제 기간</th>${metricCols.map(k=>`<th class="is-num">${ssEsc(ssExtMetricLabel(k))}</th>`).join('')}<th>관측 시각</th><th>출처</th></tr></thead>`;
  const rows=items.map(({ch,acc,obs})=>{
    const pf=ch?.platform||acc?.platform||'';
    const name=ch?.displayName||acc?.handle||acc?.name||ch?.accountId||ch?.channelId||'계정';
    const kind=obs?.kind||'',pText=ssExtPeriod(obs?.period,obs?.labels);
    let kindLabel='외부 관측',periodHtml='';
    if(kind==='account-period'){
      kindLabel='계정 기간';
      const same=Boolean(obs?.period?.start&&obs?.period?.end&&range?.start&&range?.end&&obs.period.start===range.start&&obs.period.end===range.end);
      const selText=range?.start&&range?.end?`${range.start}~${range.end}`:`${days}일`;
      periodHtml=`<span>${ssEsc(pText||'기간 미기재')}</span>${same?'':`<small class="ss-ext-diff">${ssEsc(`선택한 ${selText} 기간과 다름`)}</small>`}`;
    }else if(kind==='account-lifetime'){
      kindLabel='계정 누적';
      periodHtml=`<span>${ssEsc(pText||'지금까지 누적')}</span><small class="ss-ext-diff">기간 증가 아님</small>`;
    }else if(kind==='post-lifetime'){
      kindLabel='게시물 누적';
      const pubDate=obs?.post?.publishedAt?(obs.post.publishedDateOnly===true?String(obs.post.publishedAt).slice(0,10):String(ssKstAt(obs.post.publishedAt)||obs.post.publishedAt).slice(0,10)):'';
      const url=ssSafeUrl(obs?.post?.url),extId=String(obs?.post?.externalId??'').trim();
      const postRef=url?`<a class="ss-link" href="${ssEsc(url)}" target="_blank" rel="noopener noreferrer">${ssEsc(extId?`게시물 ${extId}`:'게시물 보기')}</a>`:extId?`<span>${ssEsc(`게시물 ${extId}`)}</span>`:'';
      periodHtml=`<span>${ssEsc([pubDate?`게시 ${pubDate}`:'','게시 후 누적',pText].filter(Boolean).join(' · '))}</span>${postRef?`<small class="ss-ext-sub">${postRef}</small>`:''}`;
    }else{
      if(kind)kindLabel=kind;
      periodHtml=`<span>${ssEsc(pText||'—')}</span>`;
    }
    const cells=metricCols.map(k=>{const v=ssObsVal(obs?.metrics?.[k]);const rawLabel=String(obs?.labels?.metricLabels?.[k]??'').trim();const title=rawLabel?` title="${ssEsc(rawLabel)}"`:'';return `<td class="is-num${v==='—'?' is-dash':''}"${title}>${ssEsc(v)}</td>`;}).join('');
    const when=ssExtWhen(obs?.observedAt,today,obs?.observedDateOnly===true)||'—';
    const src=ssExtSource(obs?.sourceType??obs?.source),host=String(obs?.sourceHost??'').trim();
    return `<tr><td><div class="ss-ext-acc">${pf?ssPf(pf):''}<span>${ssEsc(name)}</span></div></td><td><div class="ss-ext-period"><b class="ss-ext-kind">${ssEsc(kindLabel)}</b>${periodHtml}</div></td>${cells}<td>${ssEsc(when)}</td><td><div class="ss-ext-src"><span>${ssEsc(src)}</span>${host?`<small class="ss-ext-sub">${ssEsc(host)}</small>`:''}</div></td></tr>`;
  }).join('');
  return `<div class="ss-detail ss-ext-table"><p class="ss-scroll-hint">옆으로 밀면 지표 숫자와 출처가 더 보여요</p><table>${head}<tbody>${rows}</tbody></table></div>`;
}
const SS_EXT_NON_ADDITIVE=new Set(['reach','visitors','followers','posts']);
const ssExtIsAdditive=k=>!SS_EXT_NON_ADDITIVE.has(k)&&!/unique/i.test(String(k||''));
function ssExtTimeMs(at){
  const s=String(at??'').trim();if(!s)return -Infinity;
  const iso=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)?`${s.replace(' ','T')}${s.length===16?':00':''}+09:00`:s;
  const ms=Date.parse(iso);return Number.isFinite(ms)?ms:-Infinity;
}
const ssExtCmpRec=(a,b)=>a.ms!==b.ms?(a.ms>b.ms?1:-1):a.at!==b.at?(a.at>b.at?1:-1):a.tie===b.tie?0:a.tie>b.tie?1:-1;
function ssExtLatest(list){let best=null;for(const x of list)if(!best||ssExtCmpRec(x,best)>0)best=x;return best;}
function ssExtDates(start,end){
  const s=String(start||'').slice(0,10),e=String(end||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!/^\d{4}-\d{2}-\d{2}$/.test(e)||s>e)return [];
  const n=Math.round((Date.parse(e+'T00:00:00Z')-Date.parse(s+'T00:00:00Z'))/86400e3)+1;
  return Number.isFinite(n)&&n>=1&&n<=400?Array.from({length:n},(_,i)=>ssAddDays(s,i)):[];
}
function ssExtDef(obs,metric){
  const base=ssExtMetricLabel(metric),rawLabel=String(obs?.labels?.metricLabels?.[metric]??obs?.metricLabels?.[metric]??obs?.labels?.metricLabel??'').trim();
  const label=rawLabel||base,srcType=String(obs?.sourceType??obs?.source??'').trim();
  const extraRaw=obs?.metricDefinitions?.[metric]??obs?.definitions?.[metric]??obs?.labels?.metricDefinitions?.[metric]??obs?.sourceDefinition??obs?.definition??obs?.unit??'';
  const extra=extraRaw&&typeof extraRaw==='object'?JSON.stringify(extraRaw):String(extraRaw??'').trim();
  return {key:JSON.stringify([label,srcType,extra]),label,rawLabel,sourceType:srcType,sourceLabel:srcType?ssExtSource(srcType,''):'',sourceHost:String(obs?.sourceHost??'').trim(),extra};
}
function ssExtCompare(cur,prev){
  if(cur?.truncated||prev?.truncated)return {comparable:false,delta:null,percent:null,rate:null,status:'unavailable',reason:'truncated'};
  if(!cur?.complete||cur.total===null)return {comparable:false,delta:null,percent:null,rate:null,status:'unavailable',reason:cur?.reason==='no-data'?'missing-current':(cur?.reason||'missing-current')};
  if(!prev?.complete||prev.total===null)return {comparable:false,delta:null,percent:null,rate:null,status:'unavailable',reason:prev?.reason==='no-data'?'missing-previous':(prev?.reason||'missing-previous')};
  if((cur.definition?.key||'')!==(prev.definition?.key||''))return {comparable:false,delta:null,percent:null,rate:null,status:'unavailable',reason:'different-definitions'};
  const delta=cur.total-prev.total;
  if(prev.total===0)return cur.total===0?{comparable:true,delta:0,percent:null,rate:null,status:'same-zero',reason:'both-zero'}:{comparable:true,delta,percent:null,rate:null,status:'new-activity',reason:'zero-previous',label:'새 활동'};
  const percent=(delta/prev.total)*100;
  return {comparable:true,delta,percent,rate:percent,status:'ok',reason:null};
}
function ssExtPeriodSummary(observations,metric,start,end,{truncated=false,previousObservations=null,prevStart='',prevEnd='',prevTruncated=false}={}){
  const mKey=String(metric||'views'),sStr=String(start||'').slice(0,10),eStr=String(end||'').slice(0,10),dates=ssExtDates(sStr,eStr),additive=ssExtIsAdditive(mKey),recs=[];
  (Array.isArray(observations)?observations:[]).forEach(obs=>{
    if(!obs||obs.kind!=='account-period')return;
    const ps=String(obs.period?.start??obs.period?.date??'').slice(0,10),pe=String(obs.period?.end??obs.period?.date??'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(ps)||!/^\d{4}-\d{2}-\d{2}$/.test(pe)||ps>pe)return;
    const isExact=Boolean(sStr&&eStr&&ps===sStr&&pe===eStr),isDaily=Boolean(sStr&&eStr&&ps===pe&&ps>=sStr&&ps<=eStr);
    if(!isExact&&!isDaily)return;
    const raw=obs.metrics?.[mKey];if(raw===null||raw===undefined||raw===''||typeof raw==='boolean')return;
    const num=typeof raw==='number'?raw:typeof raw==='string'&&raw.trim()!==''?Number(raw):NaN,at=String(obs.observedAt??'').trim(),def=ssExtDef(obs,mKey);
    recs.push({obs,ps,isExact,isDaily,num,at,dateOnly:obs.observedDateOnly===true,ms:ssExtTimeMs(at),def,tie:JSON.stringify([String(obs.id??obs.observationId??''),def.key,String(raw),def.sourceHost,String(obs.labels?.periodLabel??'')])});
  });
  const exactRaw=recs.filter(r=>r.isExact),dailyRaw=recs.filter(r=>r.isDaily),latestAll=ssExtLatest(recs);
  let total=null,complete=false,mode='none',reason=dates.length?'no-data':'invalid-range',definition=null,daily=dates.map(date=>({date,value:null,complete:true})),latestObservedAt=latestAll?.at||'',latestObservedDateOnly=Boolean(latestAll?.dateOnly);
  const fillDaily=list=>{const byDate=new Map();for(const r of list){const p=byDate.get(r.ps);if(!p||ssExtCmpRec(r,p)>0)byDate.set(r.ps,r);}return {byDate,rows:dates.map(date=>{const r=byDate.get(date);return {date,value:r&&Number.isInteger(r.num)&&r.num>=0?r.num:null,complete:true};})};};
  if(truncated){
    const defs=new Set(recs.map(r=>r.def.key));if(defs.size===1){definition=recs[0].def;if(dailyRaw.length&&sStr<eStr)daily=fillDaily(dailyRaw).rows;}
    reason='truncated';
  }else if(exactRaw.length){
    if(new Set(exactRaw.map(r=>r.def.key)).size>1)reason='heterogeneous-definition';
    else{
      const win=ssExtLatest(exactRaw),sameDaily=dailyRaw.filter(r=>r.def.key===win.def.key),latestWin=ssExtLatest([win,...sameDaily])||win;
      definition=win.def;latestObservedAt=latestWin.at;latestObservedDateOnly=Boolean(latestWin.dateOnly);
      if(Number.isFinite(win.num)&&win.num>=0){total=win.num;complete=true;mode='exact';reason=null;}else reason='invalid-value';
      if(sameDaily.length&&sStr<eStr)daily=fillDaily(sameDaily).rows;
    }
  }else if(dailyRaw.length){
    if(new Set(dailyRaw.map(r=>r.def.key)).size>1)reason='heterogeneous-definition';
    else{
      const {byDate,rows}=fillDaily(dailyRaw),latestDaily=ssExtLatest([...byDate.values()]);definition=dailyRaw[0].def;daily=rows;if(latestDaily){latestObservedAt=latestDaily.at;latestObservedDateOnly=Boolean(latestDaily.dateOnly);}
      if(!additive)reason='non-additive';
      else if(dates.length&&daily.every(d=>d.value!==null)){total=daily.reduce((s,d)=>s+d.value,0);complete=true;mode='daily-sum';reason=null;}
      else reason='incomplete-days';
    }
  }
  const coveredDays=daily.filter(d=>d.value!==null).length,missingDays=Math.max(0,dates.length-coveredDays),hasDaily=coveredDays>0;
  const out={metric:mKey,start:sStr,end:eStr,days:dates.length,total,value:total,complete,mode,additive,truncated:!!truncated,reason,coveredDays,missingDays,hasDaily,daily,definition,latestObservedAt,latestObservedDateOnly,summary:{total,complete,mode,reason,coveredDays,missingDays,latestObservedAt}};
  if(Array.isArray(previousObservations)&&prevStart&&prevEnd){out.previous=ssExtPeriodSummary(previousObservations,mKey,prevStart,prevEnd,{truncated:prevTruncated});out.comparison=ssExtCompare(out,out.previous);}
  return out;
}
function ssExtCard({ch,acc,cur,prev,comp,curObs,prevObs},{metric,days,rStart,rEnd,pStart,pEnd,today,isSingle}){
  const pf=ch?.platform||acc?.platform||'',name=ch?.displayName||acc?.handle||acc?.name||ch?.accountId||ch?.channelId||'계정';
  const sub=acc?.name&&acc.name!==name?acc.name:acc?.handle&&acc.handle!==name?acc.handle:'';
  const def=cur.definition||prev.definition,mLabel=def?.label||ssExtMetricLabel(metric),firstObs=curObs[0]||prevObs[0]||null;
  const src=def?.sourceLabel||(firstObs?ssExtSource(firstObs.sourceType??firstObs.source):''),host=def?.sourceHost||String(firstObs?.sourceHost??'').trim();
  const allCurRec=ssExtLatest(curObs.filter(o=>o?.observedAt).map(o=>({at:String(o.observedAt).trim(),dateOnly:o.observedDateOnly===true,ms:ssExtTimeMs(o.observedAt),tie:''})));
  const latestAt=cur.latestObservedAt||allCurRec?.at||'',latestDateOnly=cur.latestObservedAt?Boolean(cur.latestObservedDateOnly):Boolean(allCurRec?.dateOnly),whenText=latestAt?`최신 관측 ${ssExtWhen(latestAt,today,latestDateOnly)}`:'이번 기간 관측 없음';
  const curSpan=rStart&&rEnd?`${ssMdShort(rStart)}~${ssMdShort(rEnd)}`:`${days}일`,prevSpan=pStart&&pEnd?`${ssMdShort(pStart)}~${ssMdShort(pEnd)}`:`이전 ${days}일`;
  const curNote=cur.complete?(cur.mode==='exact'?'플랫폼에서 제공한 기간 합계예요.':`${ssN(cur.days||days)}일치 하루 기록을 모두 더해 계산했어요.`):cur.reason==='truncated'?'관측 목록이 일부만 표시되어 합계를 계산하지 않아요.':cur.reason==='heterogeneous-definition'?'서로 다른 지표 기준이나 출처가 섞여 있어 합산하지 않아요.':cur.reason==='non-additive'?(['reach','visitors'].includes(metric)?'고유 인원 지표라 하루 수치를 더하지 않아요.':'시점 누적 지표라 하루 수치를 더하지 않아요.'):cur.reason==='incomplete-days'?`${ssN(cur.days||days)}일 중 ${ssN(cur.coveredDays)}일만 기록이 있어 합산하지 않아요.`:curObs.length?'선택한 기간과 일치하는 합계나 일별 기록이 없어요.':'이번 기간에 확인된 계정 기간 기록이 없어요.';
  let compVal='비교 불가',compNote='이전 기간 기록이 없어 비교할 수 없어요.',compText=true;
  if(comp.status==='ok'){const pct=`${comp.percent>0?'▲ ':comp.percent<0?'▼ ':''}${Math.abs(comp.percent).toFixed(Math.abs(comp.percent)>=10?0:1)}%`;compVal=`${ssSigned(comp.delta)} (${pct})`;compText=false;compNote=comp.delta>0?`바로 앞 ${days}일(${prevSpan})보다 ${ssN(comp.delta)} 늘었어요.`:comp.delta<0?`바로 앞 ${days}일(${prevSpan})보다 ${ssN(Math.abs(comp.delta))} 줄었어요.`:`바로 앞 ${days}일(${prevSpan})과 같아 변동이 없어요.`;}
  else if(comp.status==='new-activity'){compVal='새 활동';compNote=`이번 기간 ${ssSigned(comp.delta)} · 이전 기간이 0이라 증가율(%)은 계산할 수 없어요.`;}
  else if(comp.status==='same-zero'){compVal='0';compText=false;compNote='이번 기간과 이전 기간 모두 0으로 변동이 없어요.';}
  else if(comp.reason==='truncated')compNote='관측 목록이 잘려 있어 기간 비교를 계산하지 않아요.';
  else if(comp.reason==='different-definitions')compNote='이번 기간과 이전 기간의 지표 기준이나 출처가 달라 비교하지 않아요.';
  else if(comp.reason==='heterogeneous-definition')compNote='기간 안에 서로 다른 지표 기준이나 출처가 섞여 있어 비교하지 않아요.';
  else if(comp.reason==='non-additive')compNote='플랫폼의 정확한 기간 합계가 없어(일별 수치는 합산 불가) 비교할 수 없어요.';
  else if(comp.reason==='incomplete-days')compNote=!cur.complete?'이번 기간에 빠진 날짜가 있어 비교할 수 없어요.':'이전 기간에 빠진 날짜가 있어 비교할 수 없어요.';
  else if(comp.reason==='missing-current')compNote='이번 기간 기록이 없어 비교할 수 없어요.';
  const prevDiff=prev.definition&&cur.definition&&prev.definition.key!==cur.definition.key?` · ${prev.definition.label}`:'';
  const prevNote=prev.complete?`${prev.mode==='exact'?'플랫폼 기간 합계':`일별 ${ssN(prev.coveredDays)}일 합산`}${prevDiff}예요.`:prev.reason==='truncated'?'관측 목록이 일부만 표시되어 합계를 계산하지 않아요.':prev.reason==='heterogeneous-definition'?'지표 기준이나 출처가 섞여 있어요.':prev.reason==='incomplete-days'?`${ssN(prev.days||days)}일 중 ${ssN(prev.coveredDays)}일만 기록이 있어요.`:prev.reason==='non-additive'&&prev.hasDaily?'일별 기록만 있어 기간 합계는 내지 않아요.':'이전 기간 합계 기록이 없어요.';
  let chartHtml='';
  if(cur.hasDaily||prev.hasDaily){
    const diffDaily=cur.hasDaily&&prev.hasDaily&&cur.definition?.key!==prev.definition?.key;
    const cSeries=cur.daily,pSeries=diffDaily?prev.daily.map(d=>({date:d.date,value:null,complete:true})):prev.daily;
    const cLabel=cur.hasDaily&&cur.definition?cur.definition.label:prev.definition?.label||mLabel;
    chartHtml=`<div class="ss-perf-plot ss-ext-plot"><ul class="ss-perf-legend" aria-label="선 안내"><li><i class="ss-perf-key is-cur" aria-hidden="true"></i>${ssEsc(`이번 ${days}일 · 하루 ${cLabel}`)}</li><li><i class="ss-perf-key is-prev" aria-hidden="true"></i>${ssEsc(`이전 ${days}일 · 하루 ${cLabel}`)}</li></ul>${ssPerfChart(cSeries,pSeries,{w:680,h:176,label:cLabel,signed:false,ariaLabel:`하루 ${cLabel} · 실선 이번 기간 · 점선 이전 기간 · 좌우 화살표로 날마다 읽기`})}<div class="ss-perf-tip" role="status" hidden></div>${diffDaily?`<p class="ss-ext-sub">${ssEsc(`이전 기간은 지표 기준(${prev.definition.label})이 달라 한 그래프에 겹쳐 그리지 않아요.`)}</p>`:''}</div>`;
  }else if(cur.mode==='exact'||prev.mode==='exact')chartHtml=`<p class="ss-ext-exact-note">${ssEsc('플랫폼에서 기간 합계만 제공해 날짜별 그래프는 표시하지 않아요.')}</p>`;
  const meta=[src,host,whenText].filter(Boolean).map(s=>`<span>${ssEsc(s)}</span>`).join('');
  return `<article class="ss-ext-card"><div class="ss-ext-card-head"><div class="ss-ext-card-title">${isSingle?'<span class="ss-ext-sel">선택한 계정</span>':''}${pf?ssPf(pf):''}<b>${ssEsc(name)}</b>${sub?`<span class="ss-handle">${ssEsc(sub)}</span>`:''}<span class="ss-ext-def-badge">${ssEsc(mLabel)}</span></div><div class="ss-ext-card-meta">${meta}</div></div><div class="ss-ext-stats"><div class="ss-ext-stat"><span>${ssEsc(`이번 ${days}일 ${mLabel} (${curSpan})`)}</span><strong>${ssEsc(cur.complete?ssN(cur.total):'—')}</strong><small>${ssEsc(curNote)}</small></div><div class="ss-ext-stat${compText?' is-text':''}"><span>${ssEsc(`이전 ${days}일과 비교`)}</span><strong>${ssEsc(compVal)}</strong><small>${ssEsc(compNote)}</small></div><div class="ss-ext-stat"><span>${ssEsc(`이전 ${days}일 (${prevSpan})`)}</span><strong>${ssEsc(prev.complete?ssN(prev.total):'—')}</strong><small>${ssEsc(prevNote)}</small></div></div>${chartHtml}</article>`;
}
function ssPerfExternal(report,{previous=null,metric='views',days=30,range=null,target='',today='',accounts=[]}={}){
  const extObs=report?.externalObservations,rawChannels=Array.isArray(extObs?.channels)?extObs.channels:[];
  const prevExt=previous?.externalObservations,prevRaw=Array.isArray(prevExt?.channels)?prevExt.channels:[];
  const curTrunc=Boolean(extObs?.truncated),prevTrunc=Boolean(prevExt?.truncated);
  const tStr=String(target||''),sep=tStr.indexOf(':'),tKind=sep>0?tStr.slice(0,sep):'',tVal=sep>0?tStr.slice(sep+1):'';
  const accList=Array.isArray(accounts)?accounts:[],accByCh=new Map(accList.filter(a=>a?.channelId).map(a=>[a.channelId,a]));
  const findAcc=ch=>accByCh.get(ch?.channelId)||accList.find(a=>a?.accountId&&a.accountId===ch?.accountId)||null;
  const inScope=(ch,rep)=>{
    if(!ch)return false;
    if(!tKind||!tVal)return true;
    const acc=findAcc(ch);
    if(tKind==='channel')return ch.channelId===tVal||ch.accountId===tVal;
    if(tKind==='platform')return (ch.platform||acc?.platform)===tVal;
    if(tKind==='business'){const biz=ch.business||acc?.business||acc?.brand;return biz?biz===tVal:rep?.scope?.business===tVal;}
    return true;
  };
  const channels=rawChannels.filter(ch=>inScope(ch,report)),prevChannels=prevRaw.filter(ch=>inScope(ch,previous)),all=[];
  channels.forEach(ch=>{const acc=findAcc(ch);(Array.isArray(ch.observations)?ch.observations:[]).forEach(obs=>{if(obs)all.push({ch,acc,obs});});});
  const effRange=range||(today?ssPerfRange(today,days):null),rStart=effRange?.start||'',rEnd=effRange?.end||'';
  const pStart=effRange?.prevStart||effRange?.previousStart||(rStart&&days>0?ssAddDays(rStart,-days):''),pEnd=effRange?.prevEnd||effRange?.previousEnd||(rStart?ssAddDays(rStart,-1):'');
  const chKey=ch=>ch?.channelId?`ch:${ch.channelId}`:ch?.accountId?`ac:${ch.accountId}`:`pf:${ch?.platform||''}:${ch?.displayName||''}`,merged=new Map();
  const touch=(ch,isPrev)=>{
    const k=chKey(ch);if(!merged.has(k))merged.set(k,{ch,acc:findAcc(ch),curObs:[],prevObs:[],idx:merged.size});
    const entry=merged.get(k);if(!isPrev)entry.ch=ch;
    (Array.isArray(ch.observations)?ch.observations:[]).forEach(o=>{if(o?.kind==='account-period')(isPrev?entry.prevObs:entry.curObs).push(o);});
  };
  channels.forEach(ch=>touch(ch,false));prevChannels.forEach(ch=>touch(ch,true));
  const cardEntries=[...merged.values()].filter(e=>e.curObs.length||e.prevObs.length).map(e=>{
    const cur=ssExtPeriodSummary(e.curObs,metric,rStart,rEnd,{truncated:curTrunc});
    const prev=pStart&&pEnd?ssExtPeriodSummary(e.prevObs,metric,pStart,pEnd,{truncated:prevTrunc}):ssExtPeriodSummary([],metric,'','',{truncated:prevTrunc});
    const rank=cur.complete?3:cur.hasDaily?2:(prev.complete||prev.hasDaily)?1:0;
    return {...e,cur,prev,comp:ssExtCompare(cur,prev),rank};
  }).sort((a,b)=>b.rank-a.rank||a.idx-b.idx);
  if(!all.length&&!cardEntries.length&&!curTrunc&&!prevTrunc)return `<div class="ss-ext"><div class="ss-ext-head"><h3>플랫폼에서 확인한 통계</h3><span class="ss-hint">계정 기간·누적 통계는 위 숫자에 더하지 않아요. 게시물별 누적은 다른 기록과 겹치지 않을 때만 게시물 기록에 들어가요.</span></div><p class="ss-ext-empty">이 기간과 대상에는 플랫폼 화면이나 내보내기로 따로 확인한 통계가 아직 없어요.</p></div>`;
  const isSingle=tKind==='channel',cardOpts={metric,days,rStart,rEnd,pStart,pEnd,today,isSingle};
  const truncBanner=curTrunc||prevTrunc?`<p class="ss-perf-warn ss-ext-trunc" role="note">${ssDot('butter')}<span>${ssEsc('관측 기록이 많아 일부만 불러왔어요. 잘린 자료로는 기간 합계와 이전 기간 비교를 계산하지 않으니, 위 대상에서 계정 하나를 골라 확인해 주세요.')}</span></p>`:'';
  const shownCards=isSingle?cardEntries:cardEntries.slice(0,6),restCards=isSingle?[]:cardEntries.slice(6);
  const cardsHead=cardEntries.length?`<div class="ss-ext-sec-head"><h4>${ssEsc(isSingle?'선택한 계정 기간 통계':'계정별 기간 통계')}</h4>${isSingle?'':`<span class="ss-count">${ssN(cardEntries.length)}개 계정</span>`}<span class="ss-hint">${ssEsc(isSingle?`${days}일 기준 바로 앞 같은 길이 기간과 비교해요`:'계정마다 따로 계산하며 서로 더하지 않아요')}</span></div>`:'';
  const cardsHtml=cardEntries.length?`${cardsHead}<div class="ss-ext-cards">${shownCards.map(e=>ssExtCard(e,cardOpts)).join('')}</div>${restCards.length?`<details class="ss-ext-fold ss-ext-cards-fold"><summary>${ssEsc(`계정별 기간 통계 ${ssN(restCards.length)}개 계정 더 보기`)}</summary><div class="ss-ext-cards">${restCards.map(e=>ssExtCard(e,cardOpts)).join('')}</div></details>`:''}`:(isSingle&&all.length?`<p class="ss-ext-exact-note">${ssEsc('선택한 계정에는 이 기간의 계정 단위 기간 통계가 없고 게시물·누적 확인 기록만 있어요.')}</p>`:'');
  const baseCols=['views','likes','shares','comments'];
  const extraCols=SS_EXT_METRICS.map(([k])=>k).filter(k=>!baseCols.includes(k)&&(k===metric||all.some(({obs})=>obs?.metrics&&Object.prototype.hasOwnProperty.call(obs.metrics,k))));
  const metricCols=[...(metric&&!baseCols.includes(metric)&&SS_EXT_METRICS.some(([k])=>k===metric)?[metric]:[]),...baseCols,...extraCols.filter(k=>k!==metric)];
  const postItems=all.filter(({obs})=>obs.kind==='post-lifetime'),accItems=all.filter(({obs})=>obs.kind!=='post-lifetime');
  const opts={range:effRange,days,today},accShown=accItems.slice(0,6),accRest=accItems.slice(6);
  const accHtml=(accShown.length?ssExtObsTable(accShown,metricCols,opts):'')+(accRest.length?`<details class="ss-ext-fold"><summary>${ssEsc(`계정 관측 ${ssN(accRest.length)}건 더 보기`)}</summary>${ssExtObsTable(accRest,metricCols,opts)}</details>`:'');
  const postOpen=accItems.length===0&&postItems.length<=5;
  const postHtml=postItems.length?`<details class="ss-ext-fold"${postOpen?' open':''}><summary>${ssEsc(`게시물별 누적 관측 ${ssN(postItems.length)}건 보기 · 게시물마다 쌓인 값(계정 기간 합계 아님)`)}</summary>${ssExtObsTable(postItems,metricCols,opts)}</details>`:'';
  const truncNote=curTrunc?' 관측 기록이 많아 최근 일부만 표시했어요.':'';
  return `<div class="ss-ext"><div class="ss-ext-head"><h3>플랫폼에서 확인한 통계</h3>${all.length?`<span class="ss-count">${ssN(all.length)}</span>`:''}<span class="ss-hint">계정 기간·누적 통계는 위 숫자에 더하지 않아요. 게시물별 누적은 다른 기록과 겹치지 않을 때만 게시물 기록에 들어가요.</span></div>${truncBanner}${cardsHtml}${accHtml}${postHtml}<p class="ss-foot ss-ext-foot">${ssEsc(`플랫폼 화면·공식 내보내기·공개 화면에서 확인한 기록이에요. 계정의 기간 합계와 누적값은 위 게시물 합계에 더하지 않고, 게시물별로 확인한 누적 수치는 중복 없이 기존 게시물 기록에 반영될 수 있어요. 제공되지 않은 지표는 —로 표시해요.${truncNote}`)}</p></div>`;
}

// ── 계정 ──
function ssAccExtMetricSummary(metrics){
  if(!metrics||typeof metrics!=='object')return '';
  return SS_EXT_METRICS.map(([k,label])=>{
    if(!Object.prototype.hasOwnProperty.call(metrics,k))return '';
    const v=ssObsVal(metrics[k]);
    return v==='—'?'':`${label} ${v}`;
  }).filter(Boolean).slice(0,3).join(' · ');
}
function ssAccExt(ext,apiCollect,today=''){
  if(!ext||typeof ext!=='object')return '';
  const src=ssExtSource(ext.sourceType??ext.source),kind=ext.kind||'';
  const kindItem=kind&&ext.byKind&&typeof ext.byKind==='object'?ext.byKind[kind]:null;
  const topAt=ext.lastObservedAt??ext.observedAt,hasTopAt=topAt!==undefined&&topAt!==null&&String(topAt).trim()!=='';
  const whenAt=hasTopAt?topAt:kindItem?.lastObservedAt??kindItem?.observedAt;
  const whenDateOnly=hasTopAt?(typeof ext.observedDateOnly==='boolean'?ext.observedDateOnly:kindItem?.observedDateOnly===true&&(kindItem?.lastObservedAt??kindItem?.observedAt)===topAt):(typeof kindItem?.observedDateOnly==='boolean'?kindItem.observedDateOnly:ext.observedDateOnly===true);
  const when=ssExtWhen(whenAt,today,whenDateOnly),scopeParts=[];
  if(kind==='post-lifetime'){
    const cnt=ssObsVal(ext.counts?.['post-lifetime']);
    scopeParts.push(cnt!=='—'?`게시물별 누적 관측 기록 ${cnt}건(계정 합계 아님)`:'게시물별 누적 관측 기록(계정 합계 아님)');
    const ap=ext.byKind?.['account-period'];
    if(ap){
      const apSpan=ssExtPeriod(ap.period,ap.labels),apMet=ssAccExtMetricSummary(ap.metrics);
      scopeParts.push(['계정 기간',apSpan,apMet].filter(Boolean).join(' '));
    }
  }else if(kind==='account-period'){
    const span=ssExtPeriod(ext.period,ext.labels)||'기간 미기재',met=ssAccExtMetricSummary(ext.metrics);
    scopeParts.push(`계정 기간(${span})${met?` ${met}`:''}`);
  }else if(kind==='account-lifetime'){
    const met=ssAccExtMetricSummary(ext.metrics);
    scopeParts.push(`계정 누적${met?` ${met}`:''}`);
  }else if(kind){
    scopeParts.push(kind);
  }
  const hasApi=apiCollect==='수집 중'||apiCollect==='수집 멈춤';
  const detail=[...(hasApi?['플랫폼에서 확인한 통계',src]:[src]),...scopeParts,when?`확인 ${when}`:''].filter(Boolean).join(' · ');
  return `<div class="ss-acc-ext">${ssDot('butter')}<span>${ssEsc(detail)}</span></div>`;
}
const SS_COLLECTION_METRICS = {views:'조회수',likes:'좋아요',shares:'공유',reach:'도달',impressions:'노출',visitors:'방문자',followers:'팔로워',posts:'게시물',comments:'댓글',saves:'저장',profileVisits:'프로필 방문'};
const SS_COLLECTION_ROUTES = {api:'공식 API',pc:'수집 PC','public-page':'공개 화면','creator-screen':'관리자 통계','official-export':'공식 내보내기'};
const SS_COLLECTION_STATUS = {queued:'대기',running:'수집 중',complete:'수집 완료',partial:'일부 확인',unavailable:'제공 지표 없음',failed:'수집 실패'};
const ssCollectionActive = row => row?.status==='queued'||row?.status==='running';
const ssCollectionDate = new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function ssCollectionProgress(row){
  if(!row)return '';
  const stage=SS_COLLECTION_ROUTES[row.stage],status=SS_COLLECTION_STATUS[row.status]||'상태 확인 중';
  const title=stage?`${stage} · ${status}`:status;
  const stamp=new Date(row.updatedAt||'');
  const when=Number.isFinite(stamp.getTime())?`<time datetime="${ssEsc(stamp.toISOString())}">${ssEsc(ssCollectionDate.format(stamp))} 확인</time>`:'';
  const sources={...row.otherSources,...row.sources};
  const fields=[...new Set(['views','likes','shares',...Object.keys(sources).filter(k=>Object.hasOwn(SS_COLLECTION_METRICS,k))])];
  const metrics=fields.map(k=>ssEsc(SS_COLLECTION_METRICS[k])+' '+ssEsc(SS_COLLECTION_ROUTES[sources[k]]||'미확인')).join(' / ');
  return `<div class="channel-collection-note ss-collection-progress"><strong>${ssEsc(title)}</strong><span>${ssEsc(row.message||'')}</span><small>${metrics}</small>${when}</div>`;
}
// 직접 자동 게시 켜기 · 끄기(11-16). 서버 a.direct는 직접 게시를 지원하는 계정에만 오는 provider.settings 값이다(옛 카드 snswDirectAccount와 같은 근거).
// 단추는 그 계정을 관리할 수 있는 사람(canConfigure)에게만 보이고, 누르면 옛 카드와 같은 POST /api/social/provider/connect · disconnect를 부른다.
// 켜기는 서버가 게시 권한을 다시 확인한 뒤에만 켜진다. 끄기는 예약 게시가 멈추는 일이라 줄 안에서 한 번 더 묻는다.
// 켜 둔 계정이 OAuth를 다시 마치면 연결 기록이 어긋나 게시가 멈춘다(enabled · !connected · ready) — 이때도 같은 켜기로 다시 묶는다(카본 끝 판 A1).
// ui = {can, busy:채널ID, confirm:채널ID, note:{channelId,tone,message}, highlight:채널ID}
// 서버(social-simple.mjs)가 이미 거른 주소지만 화면도 같은 꼴만 받는다: 같은 출처의 /api/oauth/<플랫폼>/start 이고 publishing 인자가 정확히 1(카본 끝 판 B2).
function ssDirectConnectUrl(url){try{const u=new URL(typeof url==='string'?url:'','https://workspace.invalid');return u.origin==='https://workspace.invalid'&&/^\/api\/oauth\/[a-z]+\/start$/.test(u.pathname)&&u.searchParams.get('publishing')==='1'?u.pathname+u.search:'';}catch{return '';}}
const ssDirectRebind=d=>d?.enabled===true&&d.connected!==true&&d.ready===true;
const ssDirectCanConnect=d=>d?.enabled!==true||ssDirectRebind(d);
function ssAccDirect(a,ui={}){
  const d=a?.direct;if(!ui.can||!d||d.canConfigure!==true||!a.channelId)return {off:'',line:''};
  const id=ssEsc(a.channelId),mine=ui.busy===a.channelId,dis=ui.busy?' disabled':'',note=ui.note?.channelId===a.channelId?ui.note:null;
  const noteHtml=note?`<span class="ss-acc-direct-note${note.tone==='error'?' is-error':''}" role="${note.tone==='error'?'alert':'status'}">${ssEsc(note.message||'')}</span>`:'';
  if(d.enabled!==true){
    // ready(서버): 게시 권한은 확인됐고 켜기만 남았다. 아니면 권한 연결 길(없으면 옛 카드처럼 채널 화면)을 함께 둔다. 켜기는 어느 쪽이든 서버가 권한을 다시 확인한다.
    const ready=d.ready===true||d.connected===true,connectUrl=ready?'':ssDirectConnectUrl(d.connectUrl);
    const text=ready?'게시 권한은 연결돼 있어요. 자동 게시를 켜야 승인된 예약이 이 계정에 자동으로 올라가요.':'자동 게시가 꺼져 있어요. 게시 권한을 연결한 뒤 자동 게시를 켜야 승인된 예약이 자동으로 올라가요.';
    const link=ready?'':connectUrl?`<a class="ss-link" href="${ssEsc(connectUrl)}">게시 권한 연결</a>`:'<a class="ss-link" href="/?tab=channels">플랫폼 앱 연결 준비 확인</a>';
    return {off:'',line:`<div class="ss-acc-direct"><span class="ss-acc-direct-text">${ssDot('butter')}<span>${ssEsc(text)}</span></span><span class="ss-acc-direct-actions">${link}<button class="ss-btn ss-btn-sm" type="button" data-ss-action="direct-connect" data-value="${id}"${dis}>${mine?'권한 확인하는 중…':'권한 확인 후 자동 게시 켜기'}</button></span>${noteHtml}</div>`};
  }
  const off=`<button class="ss-link ss-acc-off" type="button" data-ss-action="direct-off" data-value="${id}"${dis}>자동 게시 끄기</button>`;
  if(ssDirectRebind(d)&&ui.confirm!==a.channelId)return {off,line:`<div class="ss-acc-direct is-confirm"><span class="ss-acc-direct-text">${ssDot('coral')}<span>${ssEsc('자동 게시를 켜 두었지만 계정 연결이 바뀌어 지금은 예약이 올라가지 않아요. 권한을 다시 확인하면 다시 켜져요.')}</span></span><span class="ss-acc-direct-actions"><button class="ss-btn ss-btn-sm" type="button" data-ss-action="direct-connect" data-value="${id}"${dis}>${mine?'권한 확인하는 중…':'권한 확인 후 자동 게시 켜기'}</button></span>${noteHtml}</div>`};
  if(ui.confirm===a.channelId)return {off,line:`<div class="ss-acc-direct is-confirm"><span class="ss-acc-direct-text">${ssDot('coral')}<span>${ssEsc('자동 게시를 끄면 승인된 예약이 이 계정에 자동으로 올라가지 않아요. 댓글과 채널 조회 연결은 그대로예요.')}</span></span><span class="ss-acc-direct-actions"><button class="ss-btn ss-btn-sm" type="button" data-ss-action="direct-disconnect" data-value="${id}"${dis}>${mine?'끄는 중…':'자동 게시 끄기'}</button><button class="ss-link" type="button" data-ss-action="direct-keep" data-value="${id}"${dis}>그대로 두기</button></span>${noteHtml}</div>`};
  return {off,line:note?`<div class="ss-acc-direct">${noteHtml}</div>`:''};
}
function ssAccRow(a,today='',progress=a.collectionProgress,ui={}){
  const td=typeof today==='string'?today:'',ext=a?.externalCollection||null,direct=ssAccDirect(a,ui);
  // 자동 게시를 켜 두었는데 게시 권한이 끊기거나 연결 기록이 어긋난 계정은 「안 켬」이 아니라 「권한 확인 필요」로 보인다(아래 줄에 고칠 길이 뜬다).
  const [tone,label]=a.publish==='자동 게시'?['green','자동 게시']:a.direct?.enabled===true&&a.direct.connected!==true?['coral','권한 확인 필요']:a.publish==='앱에서 직접'?['butter','앱에서 직접']:['','안 켬'];
  const chip=cls=>`<span class="ss-st${tone?' '+tone:''}${cls}">${tone?ssDot():''}${ssEsc(label)}</span>`;
  const pub=direct.off?`<span class="ss-acc-pub ss-acc-pub-stack">${chip('')}${direct.off}</span>`:chip(' ss-acc-pub');
  const col=a.collect==='수집 중'?`<span class="ss-st ss-acc-col">${ssDot('green')}정기 API 수집 중</span>`:a.collect==='수집 멈춤'?`<span class="ss-st ss-acc-col">${ssDot()}정기 API 수집 멈춤</span>`:ext?`<span class="ss-acc-col ss-acc-col-stack"><span class="ss-st butter">${ssDot()}플랫폼에서 확인한 통계</span><small class="ss-acc-col-sub">정기 API 수집 안 함</small></span>`:'<span class="ss-st ss-acc-col">정기 API 수집 안 함</span>';
  const extLine=ssAccExt(ext,a.collect,td)+`<div class="ss-progress-slot" data-ss-progress="${ssEsc(a.channelId||'')}"${progress?'':' hidden'}>${ssCollectionProgress(progress)}</div>`;
  const fix=a.fix?`<div class="ss-acc-fix">${ssDot('coral')}<span>${ssEsc(a.fix.message||'연결을 다시 확인해야 해요')}</span>${a.fix.kind==='publish'&&a.fix.connectUrl?`<a class="ss-link" href="${ssEsc(a.fix.connectUrl)}">게시 권한 다시 연결</a>`:`<button class="ss-link" type="button" data-ss-action="reconnect" data-value="${ssEsc(a.channelId)}">다시 연결</button>`}</div>`:'';
  return `<div class="ss-acc${ui.highlight&&ui.highlight===a.channelId?' is-focus':''}" data-ss-channel="${ssEsc(a.channelId||'')}"><div class="ss-acc-name">${ssPf(a.platform)}<b>${ssEsc(a.handle||'이름 없음')}</b><span>${ssEsc(a.name||'')}</span></div>${pub}${col}<span class="ss-acc-n${a.posts30?'':' is-zero'}">${ssEsc(`${ssN(a.posts30)}편 · ${typeof a.views30==='number'?`${ssN(a.views30)}회`:'조회 미측정'}`)}</span><span class="ss-acc-last">${a.lastPost?ssEsc(ssMdShort(a.lastPost)):'—'}</span>${extLine}${fix}${direct.line}</div>`;
}
function ssAccounts(D,options={}){
  // views30은 「최근 30일 게시물의 지금까지 누적 조회」다. 서버가 숫자를 못 받은 계정은 null — 0으로 더하지 않고 몇 곳이 빠졌는지 밝힌다.
  const A=D.accounts||[],country=A.filter(a=>a.country),known=v=>typeof v==='number'&&Number.isFinite(v),order=(a,b)=>(known(b.views30)?b.views30:-1)-(known(a.views30)?a.views30:-1);
  const measured=country.filter(a=>known(a.views30)),missing=country.length-measured.length;
  const countryViews=measured.length?measured.reduce((s,a)=>s+a.views30,0):null;
  const viewsText=countryViews===null?'— (조회 수를 아직 못 받았어요)':`${ssN(countryViews)}회${missing?`(${missing}곳은 조회 수 미측정이라 뺌)`:''}`;
  const head='<div class="ss-acc-head"><span>계정</span><span>게시</span><span>수집</span><span title="최근 30일에 올린 게시물 수 · 그 게시물들의 지금까지 누적 조회(기간 동안 늘어난 조회가 아님)">30일 게시 · 누적 조회</span><span class="is-r">마지막</span></div>';
  const brandOrder=[...new Set(['유호','브리핑','LAB','SHIFT','PULSE','PATH','SYNK','회사',...A.filter(a=>!a.country).map(a=>a.brand||'회사')])];
  const renderRow=a=>ssAccRow(a,D.today,options.progress?.get(a.channelId)??(options.collectionSnapshot?null:a.collectionProgress),options.direct||{});
  const blocks=brandOrder.map(b=>{
    const list=A.filter(a=>(a.brand||'회사')===b&&!a.country).sort(order),extra=b==='LAB'?country:[];
    if(!list.length&&!extra.length)return '';
    const fold=extra.length?`<details class="ss-fold" id="ss-country"><summary><span class="ss-what">나라별 계정 ${ssN(extra.length)}개</span><span class="ss-hint">${ssEsc(`최근 30일 게시물 누적 조회 ${viewsText}`)}</span></summary><div class="ss-country-list">${extra.slice().sort(order).map(renderRow).join('')}</div></details>`:'';
    return `<section class="ss-block">${ssBlockHead(b,{count:list.length+extra.length})}${list.length?head+list.map(renderRow).join(''):''}${fold}</section>`;
  }).join('');
  const auto=A.filter(a=>a.publish==='자동 게시').length,app=A.filter(a=>a.publish==='앱에서 직접').length,off=A.filter(a=>a.collect==='수집 안 함').length,stopped=A.filter(a=>a.collect==='수집 멈춤').length;
  const cPosts=country.reduce((s,a)=>s+(a.posts30||0),0),cLast=country.map(a=>a.lastPost).filter(Boolean).sort();
  const cRange=cLast.length?(cLast[0]===cLast.at(-1)?ssMdShort(cLast[0]):`${ssMdShort(cLast[0])}~${ssMdShort(cLast.at(-1))}`):'';
  const decide=country.length?`<div class="ss-task is-first"><div><div class="ss-task-label">${ssDot()}정할 것</div><b>${ssEsc(`나라별 LAB 계정 ${country.length}개 · 최근 30일 게시물의 누적 조회 ${viewsText}`)}</b><p>${ssEsc(`${cPosts?`30일 동안 ${cPosts}편 올렸어요${cRange?`(마지막 게시 ${cRange})`:''}`:'30일 동안 올린 게시가 없어요'}. 이 숫자는 나라별 계정만이에요 — 본 LAB 계정은 아래 LAB 목록에 따로 있고, 기간 동안 늘어난 조회는 성과 장의 「기간 성과」에서 봐요. 계속 둘지 정해 주세요.`)}</p></div><button class="ss-btn" type="button" data-ss-action="country">계정 보기</button></div>`:'';
  return ssHead({title:'계정',lede:'계정마다 자동 게시·수집 상태와 최근 30일 게시물의 누적 조회를 보여 줘요.',poster:ssPoster({label:'SNS · 계정',stats:[[ssN(A.length),'계정'],[ssN(auto),'자동 게시']],word:'계정',art:'accounts'})})
    +ssMeter([['자동 게시',ssUnit(auto,'개'),'green','자동'],['앱에서 직접',ssUnit(app,'개'),'butter','앱 직접'],['나라별',ssUnit(country.length,'개'),undefined,'나라별'],stopped?['정기 API 수집 멈춤',ssUnit(stopped,'개'),undefined,'정기 API']:['정기 API 수집 안 함',ssUnit(off,'개'),undefined,'정기 API']])
    +`<div class="ss-collection-controls">${options.canCollect?`<button type="button" class="ss-btn" data-ss-action="collect-all"${options.posting?' disabled':''}>모두 수집</button>`:''}<span role="status" data-ss-progress-summary></span></div>`+decide+blocks;
}

// 폰(맥락 메뉴가 서랍이 되는 700px 이하)에서만 보이는 세 장 탭
function ssTabs(view,D){return `<nav class="ss-tabs" aria-label="SNS·마케팅 메뉴">${SNS_SIMPLE_VIEWS.map(([id,label])=>{const badge=id==='today'&&D?ssMyTurn(D):0;return `<button type="button" data-sw-action="view" data-value="${id}"${view===id?' aria-current="page"':''}>${ssEsc(label)}${badge?`<span class="ss-badge">${badge}</span>`:''}</button>`;}).join('')}</nav>`;}
// 편 요약(저장소 → 서버)이 늦거나 없으면 숨기지 않고 한 줄로 알린다.
function ssDigestNote(D){const d=D.digest;if(!d)return '<p class="ss-stale">저장소 편 기록이 아직 오지 않았어요. 작업실 예약만 보여요(Meta·직접 예약과 멈춘 편은 빠져요).</p>';return d.ageMinutes>120?`<p class="ss-stale">${ssEsc(`저장소 편 기록이 ${Math.floor(d.ageMinutes/60)}시간 전 것이에요. Meta·직접 예약은 그 뒤 바뀐 것이 빠졌을 수 있어요.`)}</p>`:'';}
function ssPage(view,D,options={}){
  const body=view==='results'?ssResults(D,options):view==='accounts'?ssAccounts(D,options):ssToday(D);
  return `${view==='accounts'?'':ssDigestNote(D)}${body}`;
}

// ── 상태와 불러오기 ── (시험은 이 줄 앞까지만 잘라 읽는다)
const ssPerfBlank=()=>({days:30,metric:'views',target:'',status:'idle',error:'',current:null,previous:null,range:null,key:'',request:0,loadedAt:0});
const ssDirectBlank=()=>({busy:'',confirm:'',note:null,highlight:'',focus:''});
const snsSimple={identity:'',request:0,loading:false,attempted:false,attemptedAt:0,data:null,error:'',brand:'전체',sort:'recent',open:new Set(),perf:ssPerfBlank(),direct:ssDirectBlank()};
const SS_STALE_MS=5*60000;
const ssProgressBlank = () => ({items:new Map(),worker:null,posting:false,reading:false,readAt:0,snapshot:false,seq:0,timer:0,notice:''});
let ssProgress = ssProgressBlank();
function ssCanCollect(){
  if(!state.user||state.user.role==='viewer'||(typeof isDemoMode==='function'&&isDemoMode()))return false;
  return (state.data?.channels||[]).some(c=>c.active!==false&&canEditChannel(c));
}
function ssProgressPanel(){return document.querySelector('.sw-simple[data-sw-view="accounts"]');}
function ssPaintProgress(){
  const panel=ssProgressPanel();if(!panel)return;
  for(const slot of panel.querySelectorAll('[data-ss-progress]')){
    const row=ssProgress.items.get(slot.dataset.ssProgress);
    if(!row){if(ssProgress.snapshot){slot.replaceChildren();slot.hidden=true;}continue;}
    const html=ssCollectionProgress(row);if(slot.innerHTML!==html)slot.innerHTML=html;
    slot.hidden=false;
  }
  const button=panel.querySelector('[data-ss-action="collect-all"]');
  const rows=[...ssProgress.items.values()],active=rows.filter(ssCollectionActive);
  if(button){
    button.disabled=ssProgress.posting||active.length>0;
    button.textContent=ssProgress.posting?'요청 중…':active.length?'수집 중…':'모두 수집';
  }
  const output=panel.querySelector('[data-ss-progress-summary]');if(!output)return;
  const counts=rows.length?`계정 ${rows.length}개 중 ${rows.length-active.length}개 확인 종료`:'';
  const offline=ssProgress.worker?.online===false&&active.some(row=>row.stage!=='api')?'수집 PC 연결 대기':'';
  const summary=[ssProgress.notice,counts,offline].filter(Boolean).join(' · ');
  if(output.textContent!==summary)output.textContent=summary;
}
function ssTakeProgress(st,response,full=false){
  if(full){st.items.clear();st.snapshot=true;}
  for(const row of response?.items||[])if(row?.channelId)st.items.set(row.channelId,row);
  st.worker=response?.worker||null;st.readAt=Date.now();
}
function ssLaterProgress(st,delay){
  if(st.timer)return;
  st.timer=setTimeout(()=>{st.timer=0;if(st===ssProgress)void ssRefreshProgress(st);},delay);
}
async function ssRefreshProgress(st){
  const identity=snsSimple.identity;
  if(st!==ssProgress||st.reading||st.posting||document.hidden||!ssProgressPanel()||!state.user||isDemoMode())return;
  const seq=++st.seq;st.reading=true;
  try{
    const result=await api('/api/collection-progress?scope=all');
    if(st!==ssProgress||seq!==st.seq||identity!==snswIdentityKey()||!ssProgressPanel())return;
    ssTakeProgress(st,result,true);ssPaintProgress();
  }catch{st.readAt=Date.now();}
  finally{
    st.reading=false;
    if(st===ssProgress&&ssProgressPanel()&&[...st.items.values()].some(ssCollectionActive))ssLaterProgress(st,7000);
  }
}
async function ssCollectAll(){
  const st=ssProgress,identity=snsSimple.identity;
  if(st.posting||[...st.items.values()].some(ssCollectionActive)||!ssCanCollect()||!ssProgressPanel())return;
  st.posting=true;st.seq++;st.notice='수집을 요청하고 있어요.';ssPaintProgress();
  try{
    const result=await api('/api/collect',{scope:'all',teamId:''});
    if(st!==ssProgress||identity!==snswIdentityKey())return;
    ssTakeProgress(st,result.progress);st.notice=(result.progress?.items||[]).length?'수집 요청을 접수했어요.':'수집할 수 있는 계정이 없어요.';
  }catch(error){if(st===ssProgress&&identity===snswIdentityKey())st.notice=error.message||'수집 요청을 보내지 못했어요.';}
  finally{st.posting=false;if(st===ssProgress){ssPaintProgress();ssLaterProgress(st,1500);}}
}
function ssShowProgress(D){
  const st=ssProgress;
  for(const a of st.snapshot?[]:(D.accounts||[])){
    const row=a.collectionProgress,old=st.items.get(a.channelId);
    if(row&&(!old||row.updatedAt>old.updatedAt))st.items.set(a.channelId,row);
  }
  if(typeof isDemoMode==='function'&&!isDemoMode()&&!st.reading&&!st.posting){
    if(!st.readAt||Date.now()-st.readAt>30000)ssLaterProgress(st,0);
    else if([...st.items.values()].some(ssCollectionActive))ssLaterProgress(st,7000);
  }
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(ssPaintProgress);
}
globalThis.document?.addEventListener?.('visibilitychange',()=>{
  if(!document.hidden&&ssProgressPanel())ssLaterProgress(ssProgress,0);
});
function snsSimpleIdentity(){const key=typeof snswIdentityKey==='function'?snswIdentityKey():'';if(snsSimple.identity!==key){if(ssProgress.timer)clearTimeout(ssProgress.timer);ssProgress=ssProgressBlank();Object.assign(snsSimple,{identity:key,request:snsSimple.request+1,loading:false,attempted:false,attemptedAt:0,data:null,error:'',brand:'전체',sort:'recent',open:new Set(),perf:{...ssPerfBlank(),request:snsSimple.perf.request+1},direct:ssDirectBlank()});}}
// 직접 자동 게시 켜기 · 끄기 — 옛 카드(snswAction 'direct-connect' · 'disconnect')와 같은 서버 호출이고 같은 조건에서만 부른다.
// 끝나면 간편판 자료를 다시 읽어 줄의 상태를 서버 값으로 바꾼다. 결과 글은 누른 계정 줄 안에 남긴다(접힌 나라별 계정에서도 보이게).
function ssCanDirect(){return !!state.user&&state.user.role!=='viewer'&&!(typeof isDemoMode==='function'&&isDemoMode());}
async function ssDirectSet(action,channelId){
  const S=snsSimple,on=action==='direct-connect',d=(S.data?.accounts||[]).find(a=>a.channelId===channelId)?.direct;
  if(S.direct.busy||!ssCanDirect()||!d||d.canConfigure!==true||(on?!ssDirectCanConnect(d):d.enabled!==true||S.direct.confirm!==channelId))return;
  const identity=S.identity;let note=null;
  S.direct={...S.direct,busy:channelId,note:null};snswRender();
  try{
    await api('/api/social/provider/'+(on?'connect':'disconnect'),{channelId});
    if(identity!==S.identity)return;
    note={channelId,tone:'ok',message:on?'게시 권한을 확인하고 이 계정의 자동 게시를 켰어요.':'이 계정의 자동 게시를 껐어요. 댓글과 채널 조회 연결은 그대로예요.'};
    S.direct={...S.direct,confirm:'',note,highlight:''};
    await snsSimpleLoad();
  }catch(error){if(identity===S.identity)note={channelId,tone:'error',message:error.message||(on?'자동 게시를 켜지 못했어요. 잠시 뒤 다시 눌러 주세요.':'자동 게시를 끄지 못했어요. 잠시 뒤 다시 눌러 주세요.')};}
  finally{if(identity===S.identity){S.direct={...S.direct,busy:'',confirm:note?.tone==='error'?S.direct.confirm:'',note};snswRender();}}
}
// 게시 권한 연결(OAuth)에서 돌아오면 app.js가 그 계정을 알려 준다. 계정 화면이 그려진 뒤 그 줄을 펼쳐 보이고 켜기 단추에 초점을 둔다.
function snsSimpleFocus(channelId){snsSimpleIdentity();const id=String(channelId||'');snsSimple.direct={...snsSimple.direct,focus:id,highlight:id};}
function ssFocusRow(){
  const id=snsSimple.direct.focus;if(!id||!snsSimple.data)return;
  const row=[...document.querySelectorAll('.sw-simple [data-ss-channel]')].find(el=>el.dataset.ssChannel===id);
  snsSimple.direct={...snsSimple.direct,focus:''};if(!row)return;
  const fold=row.closest('details');if(fold)fold.open=true;
  // 부드러운 스크롤은 첫 화면의 뒤이은 그리기에 끊겨(11-16 확인: 70px에서 멈춤) 바로 옮긴다.
  row.scrollIntoView?.({block:'center'});
  row.querySelector('[data-ss-action="direct-connect"]')?.focus?.({preventScroll:true});
}
async function snsSimpleLoad(){
  snsSimpleIdentity();const identity=snsSimple.identity,request=++snsSimple.request;
  Object.assign(snsSimple,{loading:true,attempted:true,attemptedAt:Date.now(),error:''});
  try{const data=await api('/api/social/simple');if(request!==snsSimple.request||identity!==snsSimple.identity)return;snsSimple.data=data;}
  catch(error){if(request!==snsSimple.request||identity!==snsSimple.identity)return;snsSimple.error=error.message||'SNS 화면을 불러오지 못했어요.';snsSimple.errorStatus=Number(error.status)||0;if([401,403].includes(error.status))snsSimple.data=null;}
  finally{if(request===snsSimple.request&&identity===snsSimple.identity){snsSimple.loading=false;if(!snsSimple.error)snsSimple.errorStatus=0;if(typeof snswRender==='function')snswRender();if(typeof workspaceTurnPaint==='function')workspaceTurnPaint();}}
}
// 처음 열 때, 그리고 5분 넘게 지난 뒤 다시 그릴 때만 서버에 묻는다(그리기마다 부르므로 반복 요청을 만들지 않는다).
// 기간 성과: 이번 · 이전 기간을 한 번에 읽는다. 지표만 바꾸면 다시 묻지 않고(같은 응답에 일곱 지표가 다 있다), 기간 · 대상이 바뀌거나 5분이 지나면 다시 묻는다.
function ssKstToday(){return new Date(Date.now()+9*3600e3).toISOString().slice(0,10);}
async function ssPerfLoad(){
  const P=snsSimple.perf,identity=snsSimple.identity,range=ssPerfRange(snsSimple.data?.today||ssKstToday(),P.days),key=JSON.stringify([range.start,range.end,P.target]),request=++P.request;
  Object.assign(P,{status:'loading',error:'',key,range,loadedAt:Date.now()});
  try{
    const [current,previous]=await Promise.all([api(ssPerfQuery(range,P.target,'current')),api(ssPerfQuery(range,P.target,'previous'))]);
    if(request!==snsSimple.perf.request||identity!==snsSimple.identity)return;
    Object.assign(snsSimple.perf,{status:'ready',current,previous});
  }catch(error){if(request!==snsSimple.perf.request||identity!==snsSimple.identity)return;Object.assign(snsSimple.perf,{status:'error',error:error.message||'성과 숫자를 불러오지 못했어요.',current:null,previous:null});}
  finally{if(request===snsSimple.perf.request&&identity===snsSimple.identity&&typeof snswRender==='function')snswRender();}
}
function ssPerfEnsure(){
  const P=snsSimple.perf;if(P.status==='loading')return;
  const range=ssPerfRange(snsSimple.data?.today||ssKstToday(),P.days),key=JSON.stringify([range.start,range.end,P.target]);
  if(P.key!==key||P.status==='idle'||Date.now()-P.loadedAt>SS_STALE_MS&&P.status==='ready')void ssPerfLoad();
}
function snsSimpleEnsure(){if(!state.user)return;snsSimpleIdentity();if(snsSimple.loading)return;if(!snsSimple.attempted||Date.now()-snsSimple.attemptedAt>SS_STALE_MS)void snsSimpleLoad();}
function snsSimpleRender(view){
  snsSimpleIdentity();const D=snsSimple.data;
  // 계정 화면을 떠나면 줄 안의 끄기 확인 · 결과 글 · 강조를 지운다(누르는 중인 요청은 그대로 둔다).
  // 돌아와 아직 그 줄로 옮기기 전(focus가 남음)에 다른 화면이 먼저 그려져도 강조는 남긴다(카본 끝 판 B1).
  if(view!=='accounts'&&(snsSimple.direct.highlight&&!snsSimple.direct.focus||snsSimple.direct.confirm||snsSimple.direct.note))snsSimple.direct={...snsSimple.direct,highlight:snsSimple.direct.focus?snsSimple.direct.highlight:'',confirm:'',note:null};
  // 나라 지도(11-11)는 자기 자료(/marketing-map.json)로 그린다 — 간편판 자료가 없거나 늦어도 지도는 그대로 연다.
  if(view==='map')return `<section class="sw-simple" data-sw-view="map" aria-label="SNS·마케팅 · 나라 지도">${ssTabs(view,D)}${typeof marketingMapRender==='function'?marketingMapRender():''}</section>`;
  const error=snsSimple.error?`<div class="ss-alert" role="alert">${ssEsc(snsSimple.error)}<button class="ss-link" type="button" data-ss-action="reload"${snsSimple.loading?' disabled':''}>다시 불러오기</button></div>`:'';
  if(view==='results'&&D&&state.user)ssPerfEnsure();
  if(view==='accounts'&&D&&state.user)ssShowProgress(D);
  if(view==='accounts'&&D&&snsSimple.direct.focus&&typeof requestAnimationFrame==='function')requestAnimationFrame(ssFocusRow);
  const body=D?ssPage(view,D,{canCollect:view==='accounts'&&ssCanCollect(),posting:ssProgress.posting,progress:ssProgress.items,collectionSnapshot:ssProgress.snapshot,direct:{...snsSimple.direct,can:view==='accounts'&&ssCanDirect()},brand:snsSimple.brand,sort:snsSimple.sort,open:snsSimple.open,perf:view==='results'?snsSimple.perf:null}):`<div class="ss-empty" role="status"><h2>${snsSimple.error?'불러오지 못했어요':'불러오고 있어요'}</h2><p>${snsSimple.error?'잠시 뒤 다시 불러와 주세요.':'예약·수집·성과를 모으고 있어요.'}</p></div>`;
  ssWideSoon();
  return `<section class="sw-simple" data-sw-view="${ssEsc(view)}" aria-label="SNS·마케팅" aria-busy="${snsSimple.loading}">${ssTabs(view,D)}${error}${body}</section>`;
}
// 「옆으로 밀면」 안내는 표가 그려진 폭에서 실제로 넘칠 때만 켠다(칸 글 길이에 따라 넘치는 폭이 달라 CSS 폭으로는 못 맞춘다).
// 그린 뒤 · 창 크기가 바뀐 뒤 · 숫자 글꼴이 늦게 와 표 폭이 바뀐 뒤 다시 잰다.
function ssMarkWide(){for(const d of document.querySelectorAll('.sw-simple .ss-detail'))d.classList.toggle('is-wide',d.scrollWidth>d.clientWidth+1);}
function ssWideSoon(){if(typeof requestAnimationFrame==='function')requestAnimationFrame(ssMarkWide);}
globalThis.addEventListener?.('resize',ssWideSoon);
globalThis.document?.fonts?.addEventListener?.('loadingdone',ssWideSoon);
globalThis.document?.addEventListener?.('toggle',event=>{if(event.target?.matches?.('.sw-simple details'))ssWideSoon();},true);
document.addEventListener('click',event=>{
  const target=event.target.closest?.('.sw-simple [data-ss-action]');if(!target||target.disabled)return;
  const action=target.dataset.ssAction,value=target.dataset.value||'';
  if(action==='collect-all'){void ssCollectAll();return;}
  if(action==='direct-connect'||action==='direct-disconnect'){void ssDirectSet(action,value);return;}
  if(action==='direct-off'||action==='direct-keep'){if(!snsSimple.direct.busy){snsSimple.direct={...snsSimple.direct,confirm:action==='direct-off'?value:'',note:null};snswRender();}return;}
  if(action==='brand'){snsSimple.brand=value;snswRender();return;}
  if(action==='sort'){snsSimple.sort=value==='best'?'best':'recent';snswRender();return;}
  if(action==='detail'){snsSimple.open.has(value)?snsSimple.open.delete(value):snsSimple.open.add(value);snswRender();document.querySelector(`.sw-simple [data-ss-action="detail"][data-value="${CSS.escape(value)}"]`)?.focus?.({preventScroll:true});return;}
  if(action==='country'){const fold=document.getElementById('ss-country');if(fold){fold.open=true;fold.scrollIntoView?.({behavior:'smooth',block:'start'});}return;}
  if(action==='reload'){void snsSimpleLoad();return;}
  if(action==='perf-days'){const days=Number(value);if(SS_PERF_DAYS.includes(days)&&days!==snsSimple.perf.days){snsSimple.perf.days=days;snswRender();}return;}
  if(action==='perf-metric'){if(SS_PERF_METRICS.some(([k])=>k===value)){snsSimple.perf.metric=value;snswRender();}return;}
  if(action==='perf-reload'){snsSimple.perf.key='';void ssPerfLoad();return;}
  if(action==='reconnect'&&typeof connectModal==='function')connectModal(value);
});
document.addEventListener('change',event=>{
  const select=event.target.closest?.('.sw-simple select[data-ss-perf="target"]');if(!select)return;
  snsSimple.perf.target=select.value||'';snswRender();
});
// 기간 성과 말풍선: 날짜 칸에 마우스(또는 터치)를 올리면 세로선과 그날 · 이전 기간 같은 날째 숫자를 보인다.
function ssPerfTip(hit){
  const plot=hit?.closest?.('.ss-perf-plot'),tip=plot?.querySelector('.ss-perf-tip'),cross=plot?.querySelector('.ss-perf-cross'),svg=plot?.querySelector('.ss-perf-svg');
  if(!tip||!svg)return;
  const [a,b]=String(hit.dataset.tip||'').split('|');tip.innerHTML=`<b><i class="ss-perf-tipkey is-cur" aria-hidden="true"></i>${ssEsc(a)}</b><span><i class="ss-perf-tipkey is-prev" aria-hidden="true"></i>${ssEsc(b||'')}</span>`;tip.hidden=false;svg.dataset.at=hit.dataset.i;
  const x=Number(hit.dataset.x);if(cross){cross.setAttribute('x1',x);cross.setAttribute('x2',x);cross.removeAttribute('hidden');}
  const box=svg.getBoundingClientRect(),pr=plot.getBoundingClientRect(),vb=svg.viewBox.baseVal,px=box.left-pr.left+x*(box.width/(vb?.width||box.width));
  const half=tip.offsetWidth/2+6;tip.style.left=Math.min(Math.max(px,half),pr.width-half)+'px';
}
function ssPerfTipHide(plot){const tip=plot?.querySelector('.ss-perf-tip'),cross=plot?.querySelector('.ss-perf-cross');if(tip)tip.hidden=true;cross?.setAttribute('hidden','');}
document.addEventListener('pointermove',event=>{const hit=event.target.closest?.('.sw-simple .ss-perf-hit');if(hit)ssPerfTip(hit);});
document.addEventListener('pointerout',event=>{const plot=event.target.closest?.('.sw-simple .ss-perf-plot');if(plot&&!event.relatedTarget?.closest?.('.ss-perf-plot'))ssPerfTipHide(plot);});
document.addEventListener('keydown',event=>{
  const svg=event.target.closest?.('.sw-simple .ss-perf-svg');if(!svg)return;
  const hits=[...svg.querySelectorAll('.ss-perf-hit')];if(!hits.length)return;
  if(event.key==='Escape'){ssPerfTipHide(svg.closest('.ss-perf-plot'));return;}
  const step={ArrowRight:1,ArrowLeft:-1,Home:-Infinity,End:Infinity}[event.key];if(step===undefined)return;
  event.preventDefault();
  const at=Number(svg.dataset.at??(step>0?-1:hits.length)),next=Math.min(hits.length-1,Math.max(0,Number.isFinite(step)?at+step:step>0?hits.length-1:0));
  ssPerfTip(hits[next]);
});
document.addEventListener('focusout',event=>{if(event.target.matches?.('.sw-simple .ss-perf-svg'))ssPerfTipHide(event.target.closest('.ss-perf-plot'));});
// 플랫폼 그림 주소는 시간이 지나면 막힐 수 있다 — 깨진 그림 대신 빈 칸을 둔다.
document.addEventListener('error',event=>{const img=event.target;if(img?.matches?.('.sw-simple img.ss-thumb')){const blank=document.createElement('span');blank.className='ss-thumb';blank.setAttribute('aria-hidden','true');img.replaceWith(blank);}},true);
