'use strict';
// SNS·마케팅 간편판 — 오늘 · 성과 · 계정 세 장(2026-10-24 유호님 승인 시안을 옮김). 자료는 GET /api/social/simple 하나다:
// 서버가 작업실 예약·수집 게시물·게시 성과와 저장소 편 요약(30분마다 올라옴)을 합쳐 준다. 게시·예약은 화면 밖(제작 세션 → 작업실 예약·
// Meta 예약 → 검토 링크 승인)에서 돌아서 이 화면은 읽기만 한다. 위 절반은 그리기 도우미(순수 함수)이고, 시험은 아래 「상태와 불러오기」
// 표시줄 앞까지만 잘라 읽는다. 글은 ssEsc로 넣는다(「·」 앞 줄바꿈을 막으려고 앞 칸을 NBSP로 바꾼다).
const SNS_SIMPLE_VIEWS=[['today','오늘'],['results','성과'],['accounts','계정']];
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
function ssResults(D,{brand='전체',sort='recent',open=new Set()}={}){
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
  return ssHead({title:'성과',lede:'올린 편마다 같은 계정의 평소 조회와 견줘요.',poster:ssPoster({label:S.best?'BEST · THIS WEEK':'SYNK SOCIAL · RESULTS',stats:posterStats,word:'성과',art:'results'})})
    +ssMeter([['올린 편',ssUnit(R.length,'편'),undefined,'올린 편'],['평소 2배 이상',ssUnit(S.passN,'판'),'green','2배 이상'],['숫자 기다림',ssUnit(S.waitingN,'판'),'butter','기다림'],['판정 자료 부족',ssUnit(S.lackN,'판'),'','자료 부족']])
    +(S.judgedN||!S.all.length?'':`<p class="ss-note">판정(3초 유지율·평균 시청·저장·도구 유입 네 숫자)은 아직 모두 「자료 부족」이에요. 같은 계정에서 견줄 편이 4편은 쌓여야 나와요.</p>`)
    +`<section class="ss-block">${ssBlockHead('편별',{hint:res.since?ssEsc(`${ssMd(res.since)} 뒤 올린 편`):'',tools:`${brands.length>2?`<div class="ss-seg" role="group" aria-label="브랜드">${brands.map(b=>`<button type="button" data-ss-action="brand" data-value="${ssEsc(b)}" aria-pressed="${brand===b}">${ssEsc(b)}</button>`).join('')}</div>`:''}<div class="ss-seg" role="group" aria-label="순서"><button type="button" data-ss-action="sort" data-value="recent" aria-pressed="${sort==='recent'}">최근 순</button><button type="button" data-ss-action="sort" data-value="best" aria-pressed="${sort==='best'}">잘된 순</button></div>`})}<div class="ss-rows">${rows||'<div class="ss-empty-day">이 기간에 올린 편이 아직 없어요</div>'}</div>`
    +`<p class="ss-foot">${ssEsc(`배수 = 이 판 조회 ÷ 같은 계정·형식에서 앞서 올린 최근 12편이 같은 시점(24·72시간)에 낸 조회의 가운데 값이에요. 견줄 편이 4개는 돼야 보이고, 72시간 조회가 2배 이상이면 초록이에요.${excluded.운영시험||excluded.작품?` 시험 게시 ${excluded.운영시험||0}편과 공모전 출품작 ${excluded.작품||0}편은 뺐어요.`:''}`)}</p></section>`;
}

// ── 계정 ──
function ssAccRow(a){
  const pub=a.publish==='자동 게시'?`<span class="ss-st green ss-acc-pub">${ssDot()}자동 게시</span>`:a.publish==='앱에서 직접'?`<span class="ss-st butter ss-acc-pub">${ssDot()}앱에서 직접</span>`:'<span class="ss-st ss-acc-pub">안 켬</span>';
  const col=a.collect==='수집 중'?`<span class="ss-st ss-acc-col">${ssDot('green')}수집 중</span>`:a.collect==='수집 멈춤'?`<span class="ss-st coral ss-acc-col">${ssDot()}수집 멈춤</span>`:'<span class="ss-st ss-acc-col">수집 안 함</span>';
  const fix=a.fix?`<div class="ss-acc-fix">${ssDot('coral')}<span>${ssEsc(a.fix.message||'연결을 다시 확인해야 해요')}</span>${a.fix.kind==='publish'&&a.fix.connectUrl?`<a class="ss-link" href="${ssEsc(a.fix.connectUrl)}">게시 권한 다시 연결</a>`:`<button class="ss-link" type="button" data-ss-action="reconnect" data-value="${ssEsc(a.channelId)}">다시 연결</button>`}</div>`:'';
  return `<div class="ss-acc"><div class="ss-acc-name">${ssPf(a.platform)}<b>${ssEsc(a.handle||'이름 없음')}</b><span>${ssEsc(a.name||'')}</span></div>${pub}${col}<span class="ss-acc-n${a.posts30?'':' is-zero'}">${ssEsc(`${ssN(a.posts30)}편 · ${ssN(a.views30)}회`)}</span><span class="ss-acc-last">${a.lastPost?ssEsc(ssMdShort(a.lastPost)):'—'}</span>${fix}</div>`;
}
function ssAccounts(D){
  const A=D.accounts||[],country=A.filter(a=>a.country),countryViews=country.reduce((s,a)=>s+(a.views30||0),0),order=(a,b)=>(b.views30||0)-(a.views30||0);
  const head='<div class="ss-acc-head"><span>계정</span><span>게시</span><span>수집</span><span>최근 30일</span><span class="is-r">마지막</span></div>';
  const blocks=['유호','브리핑','LAB','회사'].map(b=>{
    const list=A.filter(a=>(a.brand||'회사')===b&&!a.country).sort(order),extra=b==='LAB'?country:[];
    if(!list.length&&!extra.length)return '';
    const fold=extra.length?`<details class="ss-fold" id="ss-country"><summary><span class="ss-what">나라별 계정 ${ssN(extra.length)}개</span><span class="ss-hint">30일 조회 합 ${ssN(countryViews)}회</span></summary><div class="ss-country-list">${extra.slice().sort(order).map(ssAccRow).join('')}</div></details>`:'';
    return `<section class="ss-block">${ssBlockHead(b,{count:list.length+extra.length})}${list.length?head+list.map(ssAccRow).join(''):''}${fold}</section>`;
  }).join('');
  const auto=A.filter(a=>a.publish==='자동 게시').length,app=A.filter(a=>a.publish==='앱에서 직접').length,off=A.filter(a=>a.collect==='수집 안 함').length,stopped=A.filter(a=>a.collect==='수집 멈춤').length;
  const cPosts=country.reduce((s,a)=>s+(a.posts30||0),0),cLast=country.map(a=>a.lastPost).filter(Boolean).sort();
  const cRange=cLast.length?(cLast[0]===cLast.at(-1)?ssMdShort(cLast[0]):`${ssMdShort(cLast[0])}~${ssMdShort(cLast.at(-1))}`):'';
  const decide=country.length?`<div class="ss-task is-first"><div><div class="ss-task-label">${ssDot()}정할 것</div><b>${ssEsc(`나라별 LAB 계정 ${country.length}개, 30일 조회가 다 합쳐 ${ssN(countryViews)}회예요`)}</b><p>${ssEsc(`${cPosts?`30일 동안 ${cPosts}편 올렸어요${cRange?`(마지막 게시 ${cRange})`:''}`:'30일 동안 올린 게시가 없어요'}. 계속 둘지 정해 주세요.`)}</p></div><button class="ss-btn" type="button" data-ss-action="country">계정 보기</button></div>`:'';
  return ssHead({title:'계정',lede:'계정마다 자동으로 올라가는지, 30일 동안 얼마나 봤는지 보여 줘요.',poster:ssPoster({label:'SYNK SOCIAL · ACCOUNTS',stats:[[ssN(A.length),'계정'],[ssN(auto),'자동 게시']],word:'계정',art:'accounts'})})
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
const snsSimple={identity:'',request:0,loading:false,attempted:false,attemptedAt:0,data:null,error:'',brand:'전체',sort:'recent',open:new Set()};
const SS_STALE_MS=5*60000;
function snsSimpleIdentity(){const key=typeof snswIdentityKey==='function'?snswIdentityKey():'';if(snsSimple.identity!==key){Object.assign(snsSimple,{identity:key,request:snsSimple.request+1,loading:false,attempted:false,attemptedAt:0,data:null,error:'',brand:'전체',sort:'recent',open:new Set()});}}
async function snsSimpleLoad(){
  snsSimpleIdentity();const identity=snsSimple.identity,request=++snsSimple.request;
  Object.assign(snsSimple,{loading:true,attempted:true,attemptedAt:Date.now(),error:''});
  try{const data=await api('/api/social/simple');if(request!==snsSimple.request||identity!==snsSimple.identity)return;snsSimple.data=data;}
  catch(error){if(request!==snsSimple.request||identity!==snsSimple.identity)return;snsSimple.error=error.message||'SNS 화면을 불러오지 못했어요.';if([401,403].includes(error.status))snsSimple.data=null;}
  finally{if(request===snsSimple.request&&identity===snsSimple.identity){snsSimple.loading=false;if(typeof snswRender==='function')snswRender();}}
}
// 처음 열 때, 그리고 5분 넘게 지난 뒤 다시 그릴 때만 서버에 묻는다(그리기마다 부르므로 반복 요청을 만들지 않는다).
function snsSimpleEnsure(){if(!state.user)return;snsSimpleIdentity();if(snsSimple.loading)return;if(!snsSimple.attempted||Date.now()-snsSimple.attemptedAt>SS_STALE_MS)void snsSimpleLoad();}
function snsSimpleRender(view){
  snsSimpleIdentity();const D=snsSimple.data;
  const error=snsSimple.error?`<div class="ss-alert" role="alert">${ssEsc(snsSimple.error)}<button class="ss-link" type="button" data-ss-action="reload"${snsSimple.loading?' disabled':''}>다시 불러오기</button></div>`:'';
  const body=D?ssPage(view,D,{brand:snsSimple.brand,sort:snsSimple.sort,open:snsSimple.open}):`<div class="ss-empty" role="status"><h2>${snsSimple.error?'불러오지 못했어요':'불러오고 있어요'}</h2><p>${snsSimple.error?'잠시 뒤 다시 불러와 주세요.':'예약·수집·성과를 모으고 있어요.'}</p></div>`;
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
  if(action==='reconnect'&&typeof connectModal==='function')connectModal(value);
});
// 플랫폼 그림 주소는 시간이 지나면 막힐 수 있다 — 깨진 그림 대신 빈 칸을 둔다.
document.addEventListener('error',event=>{const img=event.target;if(img?.matches?.('.sw-simple img.ss-thumb')){const blank=document.createElement('span');blank.className='ss-thumb';blank.setAttribute('aria-hidden','true');img.replaceWith(blank);}},true);
