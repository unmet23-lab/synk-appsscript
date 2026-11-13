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

// 머리 한 벌 — 13판 문법(눈썹 · 제목 · 한 줄 · 검은 포스터)
function ssHead({title,lede,poster}){return `<header class="ss-head"><div class="ss-head-copy"><div class="ss-eyebrow">SYNK WORKSPACE / SOCIAL</div><h1>${ssEsc(title)}</h1><p class="ss-lede">${lede}</p></div>${poster}</header>`;}
function ssPoster({label,stats,word,art}){return `<figure class="ss-poster"><span class="ss-poster-label">${ssEsc(label)}</span><div class="ss-poster-stats">${stats.map(([b,s])=>`<div><b>${b}</b><span>${s}</span></div>`).join('')}</div><span class="ss-poster-word" aria-hidden="true">${ssEsc(word)}</span><img class="ss-poster-art" src="/messenger/assets/sns-felt-${art}.webp" alt="" width="220" height="200" decoding="async"></figure>`;}
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
  const nowCard=review.length?`<div class="ss-now"><div class="ss-now-label">${ssDot('butter')}<span class="ss-mono-tag">NOW</span>내 차례 · 검토</div><h3>${ssEsc(slots.length===1?`${ssWhen(slots[0])}에 나갈 ${reviewPlates}판, 유호님 검토가 있어야 나가요`:`${reviewPlates}판이 유호님 검토를 기다려요`)}</h3><p>${ssEsc(`${slots.length>1?slots.map(at=>`${ssWhen(at)} ${platesAt(at)}판`).join(' · ')+'. ':''}텔레그램으로 받은 검토 링크에서 승인하면 그 시각에 바로 올라가요. 안 누르면 나가지 않아요.`)}</p><div class="ss-now-items">${review.map(r=>`<div class="ss-now-item">${ssThumb(r.thumb)}<div><b>${ssEsc(r.title||'제목 없는 원고')}</b><div class="ss-plates">${slots.length>1?`<span class="ss-plate is-when">${ssEsc(ssWhen(r.at))}</span>`:''}${(r.plates||[]).map(ssPlate).join('')}</div></div></div>`).join('')}</div></div>`:'';
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
  return ssHead({title:'오늘',lede:ssEsc(`${ssMd(today)} · 내가 할 일과 나갈 게시물만 모았어요.`),poster:ssPoster({label:'SYNK SOCIAL · TODAY',stats:[[ssN(myTurn),'내 차례'],[`${ssN(tonight.length)}편`,'오늘 나감']],word:'오늘',art:'overview'})})
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
  return ssHead({title:'성과',lede:'기간 동안 늘어난 숫자를 바로 앞 같은 길이 기간과 견주고, 올린 편마다 같은 계정의 평소 조회와 견줘요.',poster:ssPoster({label:S.best?'BEST · THIS WEEK':'SYNK SOCIAL · RESULTS',stats:posterStats,word:'성과',art:'results'})})
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
function ssPerfChart(cur,prev,{w=720,h=220,label='조회'}={}){
  const n=Math.max(cur.length,prev.length,1),padL=48,padR=12,padT=14,padB=28;
  const vals=[...cur,...prev].map(p=>p.value).filter(v=>v!==null);
  if(!vals.length)return `<div class="ss-perf-empty">${ssEsc('이 기간에는 날마다 견줄 기록이 아직 없어요. 수집이 두 번 이상 쌓이면 선이 생겨요.')}</div>`;
  let lo=Math.min(0,...vals),hi=Math.max(0,...vals);if(hi===lo)hi=lo+1;
  const x=i=>padL+(n===1?0:(w-padL-padR)*i/(n-1)),y=v=>padT+(h-padT-padB)*(1-(v-lo)/(hi-lo));
  const line=list=>{let d='',open=false;list.forEach((p,i)=>{if(p.value===null){open=false;return;}d+=`${open?'L':'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`;open=true;});return d;};
  // 앞뒤가 비어 혼자 있는 날은 선이 안 그려지므로 점으로 보인다. 일부 대상만 비교된 날은 속이 빈 점.
  const dots=(list,cls)=>list.map((p,i)=>{if(p.value===null)return '';const alone=(i===0||list[i-1].value===null)&&(i===list.length-1||list[i+1]?.value===null);return alone||!p.complete?`<circle class="${cls}${p.complete?'':' is-part'}" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.5"/>`:'';}).join('');
  const grid=[hi,(hi+lo)/2,lo].map(v=>`<line class="ss-perf-grid" x1="${padL}" x2="${w-padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="ss-perf-axis" x="${padL-8}" y="${(y(v)+4).toFixed(1)}" text-anchor="end">${ssEsc(ssCompact(Math.round(v)))}</text>`).join('')+(lo<0?`<line class="ss-perf-zero" x1="${padL}" x2="${w-padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>`:'');
  const ticks=[0,Math.floor((n-1)/2),n-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=>`<text class="ss-perf-axis" x="${x(i).toFixed(1)}" y="${h-8}" text-anchor="${i===0?'start':i===n-1?'end':'middle'}">${ssEsc(cur[i]?.date?ssMdShort(cur[i].date):`${i+1}일째`)}</text>`).join('');
  const band=n===1?(w-padL-padR):(w-padL-padR)/(n-1);
  const hits=Array.from({length:n},(_,i)=>{const c=cur[i]||{},p=prev[i]||{};const tip=`${c.date?ssMd(c.date):`${i+1}일째`} · ${label} ${c.value===null||c.value===undefined?'기록 없음':ssSigned(c.value)}${c.value!==null&&c.value!==undefined&&!c.complete?` (대상 ${c.count}/${c.eligible})`:''}|이전 기간${p.date?` ${ssMdShort(p.date)}`:''} ${p.value===null||p.value===undefined?'기록 없음':ssSigned(p.value)}`;return `<rect class="ss-perf-hit" x="${Math.max(padL,x(i)-band/2).toFixed(1)}" y="${padT}" width="${Math.min(band,w-padR-Math.max(padL,x(i)-band/2)).toFixed(1)}" height="${h-padT-padB}" data-i="${i}" data-x="${x(i).toFixed(1)}" data-tip="${ssEsc(tip)}"/>`;}).join('');
  return `<svg class="ss-perf-svg" viewBox="0 0 ${w} ${h}" role="img" tabindex="0" aria-label="${ssEsc(`날마다 늘어난 ${label} · 실선 이번 기간 · 점선 이전 기간 · 좌우 화살표로 날마다 읽기`)}">${grid}${ticks}<path class="ss-perf-prev" d="${line(prev)}"/>${dots(prev,'ss-perf-pdot')}<path class="ss-perf-cur" d="${line(cur)}"/>${dots(cur,'ss-perf-cdot')}<line class="ss-perf-cross" x1="0" x2="0" y1="${padT}" y2="${h-padB}" hidden/>${hits}</svg>`;
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
  }
  return `<section class="ss-block ss-perf">${ssBlockHead('기간 성과',{hint:ssEsc(rangeText),tools})}<div class="ss-perf-bar">${metrics}${targetSelect}</div>${body}${ssCollectLine(D)}</section>`;
}

// ── 계정 ──
function ssAccRow(a){
  const pub=a.publish==='자동 게시'?`<span class="ss-st green ss-acc-pub">${ssDot()}자동 게시</span>`:a.publish==='앱에서 직접'?`<span class="ss-st butter ss-acc-pub">${ssDot()}앱에서 직접</span>`:'<span class="ss-st ss-acc-pub">안 켬</span>';
  const col=a.collect==='수집 중'?`<span class="ss-st ss-acc-col">${ssDot('green')}수집 중</span>`:a.collect==='수집 멈춤'?`<span class="ss-st coral ss-acc-col">${ssDot()}수집 멈춤</span>`:'<span class="ss-st ss-acc-col">수집 안 함</span>';
  const fix=a.fix?`<div class="ss-acc-fix">${ssDot('coral')}<span>${ssEsc(a.fix.message||'연결을 다시 확인해야 해요')}</span>${a.fix.kind==='publish'&&a.fix.connectUrl?`<a class="ss-link" href="${ssEsc(a.fix.connectUrl)}">게시 권한 다시 연결</a>`:`<button class="ss-link" type="button" data-ss-action="reconnect" data-value="${ssEsc(a.channelId)}">다시 연결</button>`}</div>`:'';
  return `<div class="ss-acc"><div class="ss-acc-name">${ssPf(a.platform)}<b>${ssEsc(a.handle||'이름 없음')}</b><span>${ssEsc(a.name||'')}</span></div>${pub}${col}<span class="ss-acc-n${a.posts30?'':' is-zero'}">${ssEsc(`${ssN(a.posts30)}편 · ${typeof a.views30==='number'?`${ssN(a.views30)}회`:'조회 미측정'}`)}</span><span class="ss-acc-last">${a.lastPost?ssEsc(ssMdShort(a.lastPost)):'—'}</span>${fix}</div>`;
}
function ssAccounts(D){
  // views30은 「최근 30일 게시물의 지금까지 누적 조회」다. 서버가 숫자를 못 받은 계정은 null — 0으로 더하지 않고 몇 곳이 빠졌는지 밝힌다.
  const A=D.accounts||[],country=A.filter(a=>a.country),known=v=>typeof v==='number'&&Number.isFinite(v),order=(a,b)=>(known(b.views30)?b.views30:-1)-(known(a.views30)?a.views30:-1);
  const measured=country.filter(a=>known(a.views30)),missing=country.length-measured.length;
  const countryViews=measured.length?measured.reduce((s,a)=>s+a.views30,0):null;
  const viewsText=countryViews===null?'— (조회 수를 아직 못 받았어요)':`${ssN(countryViews)}회${missing?`(${missing}곳은 조회 수 미측정이라 뺌)`:''}`;
  const head='<div class="ss-acc-head"><span>계정</span><span>게시</span><span>수집</span><span title="최근 30일에 올린 게시물 수 · 그 게시물들의 지금까지 누적 조회(기간 동안 늘어난 조회가 아님)">30일 게시 · 누적 조회</span><span class="is-r">마지막</span></div>';
  const brandOrder=[...new Set(['유호','브리핑','LAB','SHIFT','PULSE','PATH','SYNK','회사',...A.filter(a=>!a.country).map(a=>a.brand||'회사')])];
  const blocks=brandOrder.map(b=>{
    const list=A.filter(a=>(a.brand||'회사')===b&&!a.country).sort(order),extra=b==='LAB'?country:[];
    if(!list.length&&!extra.length)return '';
    const fold=extra.length?`<details class="ss-fold" id="ss-country"><summary><span class="ss-what">나라별 계정 ${ssN(extra.length)}개</span><span class="ss-hint">${ssEsc(`최근 30일 게시물 누적 조회 ${viewsText}`)}</span></summary><div class="ss-country-list">${extra.slice().sort(order).map(ssAccRow).join('')}</div></details>`:'';
    return `<section class="ss-block">${ssBlockHead(b,{count:list.length+extra.length})}${list.length?head+list.map(ssAccRow).join(''):''}${fold}</section>`;
  }).join('');
  const auto=A.filter(a=>a.publish==='자동 게시').length,app=A.filter(a=>a.publish==='앱에서 직접').length,off=A.filter(a=>a.collect==='수집 안 함').length,stopped=A.filter(a=>a.collect==='수집 멈춤').length;
  const cPosts=country.reduce((s,a)=>s+(a.posts30||0),0),cLast=country.map(a=>a.lastPost).filter(Boolean).sort();
  const cRange=cLast.length?(cLast[0]===cLast.at(-1)?ssMdShort(cLast[0]):`${ssMdShort(cLast[0])}~${ssMdShort(cLast.at(-1))}`):'';
  const decide=country.length?`<div class="ss-task is-first"><div><div class="ss-task-label">${ssDot()}정할 것</div><b>${ssEsc(`나라별 LAB 계정 ${country.length}개 · 최근 30일 게시물의 누적 조회 ${viewsText}`)}</b><p>${ssEsc(`${cPosts?`30일 동안 ${cPosts}편 올렸어요${cRange?`(마지막 게시 ${cRange})`:''}`:'30일 동안 올린 게시가 없어요'}. 이 숫자는 나라별 계정만이에요 — 본 LAB 계정은 아래 LAB 목록에 따로 있고, 기간 동안 늘어난 조회는 성과 장의 「기간 성과」에서 봐요. 계속 둘지 정해 주세요.`)}</p></div><button class="ss-btn" type="button" data-ss-action="country">계정 보기</button></div>`:'';
  return ssHead({title:'계정',lede:'계정마다 자동 게시·수집 상태와 최근 30일 게시물의 누적 조회를 보여 줘요.',poster:ssPoster({label:'SYNK SOCIAL · ACCOUNTS',stats:[[ssN(A.length),'계정'],[ssN(auto),'자동 게시']],word:'계정',art:'accounts'})})
    +ssMeter([['자동 게시',ssUnit(auto,'개'),'green','자동'],['앱에서 직접',ssUnit(app,'개'),'butter','앱 직접'],['나라별',ssUnit(country.length,'개'),undefined,'나라별'],stopped?['수집 멈춤',ssUnit(stopped,'개'),'coral','멈춤']:['수집 안 함',ssUnit(off,'개'),undefined,'수집 안 함']])
    +decide+blocks;
}

// 폰(맥락 메뉴가 서랍이 되는 700px 이하)에서만 보이는 세 장 탭
function ssTabs(view,D){return `<nav class="ss-tabs" aria-label="SNS·마케팅 메뉴">${SNS_SIMPLE_VIEWS.map(([id,label])=>{const badge=id==='today'&&D?ssMyTurn(D):0;return `<button type="button" data-sw-action="view" data-value="${id}"${view===id?' aria-current="page"':''}>${ssEsc(label)}${badge?`<span class="ss-badge">${badge}</span>`:''}</button>`;}).join('')}</nav>`;}
// 편 요약(저장소 → 서버)이 늦거나 없으면 숨기지 않고 한 줄로 알린다.
function ssDigestNote(D){const d=D.digest;if(!d)return '<p class="ss-stale">저장소 편 기록이 아직 오지 않았어요. 작업실 예약만 보여요(Meta·직접 예약과 멈춘 편은 빠져요).</p>';return d.ageMinutes>120?`<p class="ss-stale">${ssEsc(`저장소 편 기록이 ${Math.floor(d.ageMinutes/60)}시간 전 것이에요. Meta·직접 예약은 그 뒤 바뀐 것이 빠졌을 수 있어요.`)}</p>`:'';}
function ssPage(view,D,options={}){
  const body=view==='results'?ssResults(D,options):view==='accounts'?ssAccounts(D):ssToday(D);
  return `${view==='accounts'?'':ssDigestNote(D)}${body}`;
}

// ── 상태와 불러오기 ── (시험은 이 줄 앞까지만 잘라 읽는다)
const ssPerfBlank=()=>({days:30,metric:'views',target:'',status:'idle',error:'',current:null,previous:null,range:null,key:'',request:0,loadedAt:0});
const snsSimple={identity:'',request:0,loading:false,attempted:false,attemptedAt:0,data:null,error:'',brand:'전체',sort:'recent',open:new Set(),perf:ssPerfBlank()};
const SS_STALE_MS=5*60000;
function snsSimpleIdentity(){const key=typeof snswIdentityKey==='function'?snswIdentityKey():'';if(snsSimple.identity!==key){Object.assign(snsSimple,{identity:key,request:snsSimple.request+1,loading:false,attempted:false,attemptedAt:0,data:null,error:'',brand:'전체',sort:'recent',open:new Set(),perf:{...ssPerfBlank(),request:snsSimple.perf.request+1}});}}
async function snsSimpleLoad(){
  snsSimpleIdentity();const identity=snsSimple.identity,request=++snsSimple.request;
  Object.assign(snsSimple,{loading:true,attempted:true,attemptedAt:Date.now(),error:''});
  try{const data=await api('/api/social/simple');if(request!==snsSimple.request||identity!==snsSimple.identity)return;snsSimple.data=data;}
  catch(error){if(request!==snsSimple.request||identity!==snsSimple.identity)return;snsSimple.error=error.message||'SNS 화면을 불러오지 못했어요.';if([401,403].includes(error.status))snsSimple.data=null;}
  finally{if(request===snsSimple.request&&identity===snsSimple.identity){snsSimple.loading=false;if(typeof snswRender==='function')snswRender();}}
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
  // 나라 지도(11-11)는 자기 자료(/marketing-map.json)로 그린다 — 간편판 자료가 없거나 늦어도 지도는 그대로 연다.
  if(view==='map')return `<section class="sw-simple" data-sw-view="map" aria-label="SNS·마케팅 · 나라 지도">${ssTabs(view,D)}${typeof marketingMapRender==='function'?marketingMapRender():''}</section>`;
  const error=snsSimple.error?`<div class="ss-alert" role="alert">${ssEsc(snsSimple.error)}<button class="ss-link" type="button" data-ss-action="reload"${snsSimple.loading?' disabled':''}>다시 불러오기</button></div>`:'';
  if(view==='results'&&D&&state.user)ssPerfEnsure();
  const body=D?ssPage(view,D,{brand:snsSimple.brand,sort:snsSimple.sort,open:snsSimple.open,perf:view==='results'?snsSimple.perf:null}):`<div class="ss-empty" role="status"><h2>${snsSimple.error?'불러오지 못했어요':'불러오고 있어요'}</h2><p>${snsSimple.error?'잠시 뒤 다시 불러와 주세요.':'예약·수집·성과를 모으고 있어요.'}</p></div>`;
  ssWideSoon();
  return `<section class="sw-simple" data-sw-view="${ssEsc(view)}" aria-label="SNS·마케팅" aria-busy="${snsSimple.loading}">${ssTabs(view,D)}${error}${body}</section>`;
}
// 「옆으로 밀면」 안내는 표가 그려진 폭에서 실제로 넘칠 때만 켠다(칸 글 길이에 따라 넘치는 폭이 달라 CSS 폭으로는 못 맞춘다).
// 그린 뒤 · 창 크기가 바뀐 뒤 · 숫자 글꼴이 늦게 와 표 폭이 바뀐 뒤 다시 잰다.
function ssMarkWide(){for(const d of document.querySelectorAll('.sw-simple .ss-detail'))d.classList.toggle('is-wide',d.scrollWidth>d.clientWidth+1);}
function ssWideSoon(){if(snsSimple.open.size&&typeof requestAnimationFrame==='function')requestAnimationFrame(ssMarkWide);}
globalThis.addEventListener?.('resize',ssWideSoon);
globalThis.document?.fonts?.addEventListener?.('loadingdone',ssWideSoon);
document.addEventListener('click',event=>{
  const target=event.target.closest?.('.sw-simple [data-ss-action]');if(!target||target.disabled)return;
  const action=target.dataset.ssAction,value=target.dataset.value||'';
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
