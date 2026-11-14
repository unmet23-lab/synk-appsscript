import {esc} from './api.mjs';

// 직원 「운영판」(운영 조각 8-A, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S4) — 매출과 일정을 한 화면에.
// 직원 화면에서만 불러온다(손님 묶음 · 오프라인 목록에 넣지 않는다). 내부 도구라 한국어다. 숫자는 서버 장부(GET /api/pulse/ledger) 그대로 — 화면이 다시 세지 않는다.
// 위 한 줄(고른 달 매출 · 받을 돈 · 제작 자리 · 가장 가까운 받으실 날) → 여섯 달 매출(빗금 막대 — docs/디자인/그래프_문법.md: 0부터 세는 금액, 고른 달만 베리)
// → 4주 일정 띠(결제 확인 ~ 받으실 날, 저희 차례는 베리 · 손님 차례는 회색, 오늘 선) → 건별 표(좁은 화면은 두 줄 카드). 달은 앞뒤로 고르고, 월 CSV는 같은 달.
const DAY=86400000;
const WEEKDAY=['일','월','화','수','목','금','토'];
const won=n=>Number.isSafeInteger(n)?`${n.toLocaleString('ko-KR')}원`:'';
// 막대 눈금 글: 만 원 단위(0이면 0).
const short=n=>!n?'0':n>=100000000?`${Math.round(n/10000000)/10}억`:n>=10000?`${Math.round(n/10000).toLocaleString('ko-KR')}만`:n.toLocaleString('ko-KR');
const monthName=m=>`${Number(m.slice(5,7))}월`;
const monthTitle=m=>`${m.slice(0,4)}년 ${Number(m.slice(5,7))}월`;
const shiftMonth=(m,n)=>{const [y,mm]=m.split('-').map(Number),d=new Date(0);d.setUTCFullYear(y,mm-1+n,1);return d.toISOString().slice(0,7);};
const dayName=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return '';const t=new Date(d+'T00:00:00Z');return `${t.getUTCMonth()+1}월 ${t.getUTCDate()}일 (${WEEKDAY[t.getUTCDay()]})`;};
const shortDay=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')?`${Number(d.slice(5,7))}.${Number(d.slice(8,10))}`:'';
const span=(from,to)=>Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/DAY);
const PAY_TONE={requested:'is-wait',confirmed:'is-paid',refunded:'is-refund',cancelled:'',none:''};
const TURN_TONE={us:'is-us',you:'is-you',done:'is-done'};
const TURN_SAY={us:'저희 차례',you:'손님 차례',done:'끝'};
const waited=days=>days?`${days}일 지남`:'오늘 요청';

function seatsLine(seatsNow){
  if(!seatsNow?.video||!seatsNow?.photo||!seatsNow?.queue)return null;
  return [`영상 ${seatsNow.video.used}/${seatsNow.video.total}`,`사진 ${seatsNow.photo.used}/${seatsNow.photo.total}`,`대기 ${seatsNow.queue.used}/${seatsNow.queue.total}`];
}
function figures(data,seatsNow){
  const s=data.summary,r=s.receivable,next=s.nextDue,seats=seatsLine(seatsNow),now=data.month===data.current?'':' · 지금';
  const items=[
    [`${monthName(data.month)} 매출`,won(s.revenue)||'0원',[`확인 ${s.confirmed}건`,s.noAmount?`금액 없음 ${s.noAmount}건`:'',s.refunds?`환불 ${won(s.refunds)}`:'',s.netCount?`실수령 ${won(s.net)}(적은 ${s.netCount}건)`:''].filter(Boolean).join(' · '),''],
    [`받을 돈${now}`,won(r.amount)||'0원',r.count?[`요청 ${r.count}건`,r.noAmount?`금액 없음 ${r.noAmount}건`:'',r.oldestDays!==null?`가장 오래된 것 ${waited(r.oldestDays)}`:''].filter(Boolean).join(' · '):'결제 요청한 건이 없어요',r.oldestDays>=7?' is-hot':''],
    ['제작 자리',seats||'—',seats?'지금 기준':'자리 수를 읽지 못했어요',' is-seats'],
    [`가장 가까운 받으실 날${now}`,next?dayName(next.date):'—',next?`${next.late?'지났어요 · ':''}${next.title}`:'납품 전 건이 없어요',next?.late?' is-hot':''],
  ];
  // 값이 덩이 여럿(제작 자리)이면 넓은 화면은 한 줄, 좁은 화면은 덩이마다 한 줄(가운뎃점은 숨김).
  const show=value=>Array.isArray(value)?value.map(part=>`<span class="ledger-nowrap">${esc(part)}</span>`).join('<span class="ledger-sep" aria-hidden="true"> · </span>'):esc(value);
  return `<div class="ledger-figures">${items.map(([label,value,sub,cls])=>`<p class="ledger-figure${cls}"><span class="ledger-figure-label">${esc(label)}</span><b>${show(value)}</b><small>${esc(sub)}</small></p>`).join('')}</div>`;
}
// 여섯 달 매출: 0부터 세는 금액이라 빗금 막대(그래프 문법), 고른 달만 베리 빗금 · 나머지는 회색. 막대를 누르면 그 달로.
function bars(data){
  const max=Math.max(...data.months.map(m=>m.revenue),1);
  const cols=data.months.map(m=>{const pct=m.revenue?Math.max(2,Math.round(m.revenue/max*100)):0,pick=m.month===data.month;
    return `<li class="ledger-bar${pick?' is-pick':''}"><button type="button" data-action="ledger-month" data-month="${esc(m.month)}" aria-pressed="${String(pick)}" aria-label="${esc(monthTitle(m.month))} 매출 ${esc(won(m.revenue)||'0원')}"><span class="ledger-bar-v">${esc(short(m.revenue))}</span><span class="ledger-bar-track"><span class="ledger-bar-fill" data-h="${pct}"></span></span><span class="ledger-bar-m">${esc(monthName(m.month))}</span></button></li>`;}).join('');
  return `<figure class="ledger-chart"><figcaption><h2>여섯 달 매출</h2><p>결제를 확인한 금액(환불 전) · 단위 원 · 막대를 누르면 그 달</p></figcaption><ol class="ledger-bars">${cols}</ol></figure>`;
}
// 4주 띠: 오늘 7일 전부터 4주. 건마다 결제 확인 ~ 받으실 날, 칸 밖은 끝에서 자른다. 지난 건은 「늦음」.
function band(data){
  const {from,to,items}=data.band,total=span(from,to)+1,pos=d=>Math.min(100,Math.max(0,span(from,d)/total*100));
  const today=data.today,todayAt=pos(today)+50/total;
  const ticks=[0,7,14,21].map(n=>{const d=new Date(Date.parse(from+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);return `<span data-x="${(n/total*100).toFixed(2)}">${esc(shortDay(d))}</span>`;}).join('');
  const rows=items.length?items.map(item=>{const start=pos(item.start),end=Math.min(100,pos(item.end)+100/total),width=Math.max(1.5,end-start); // pos가 칸 밖을 0 · 100에 붙인다
    return `<li class="ledger-row ${TURN_TONE[item.turn]||''}${item.late?' is-late':''}"><button type="button" class="ledger-row-t" data-action="open-project" data-id="${esc(item.id)}">${esc(item.title||'이름 없음')}<small>${esc(shortDay(item.start))} → ${esc(shortDay(item.end))}${item.late?' · 늦음':''}</small>${TURN_SAY[item.turn]?`<span class="sr"> · ${TURN_SAY[item.turn]}</span>`:''}</button><span class="ledger-track"><span class="ledger-span" data-left="${start.toFixed(2)}" data-width="${width.toFixed(2)}"></span></span></li>`;}).join(''):'<li class="ledger-empty">결제를 확인하고 납품 전인 건이 없어요.</li>';
  return `<section class="ledger-band" aria-labelledby="ledger-band-h"><header><h2 id="ledger-band-h">4주 일정${data.month===data.current?'':' · 지금 기준'}</h2><p class="ledger-key" aria-hidden="true"><span class="is-us">저희 차례</span><span class="is-you">손님 차례</span><span class="is-today">오늘</span></p></header><div class="ledger-band-body" data-today="${todayAt.toFixed(2)}"><div class="ledger-ticks" aria-hidden="true"><span></span><span class="ledger-ticks-in">${ticks}</span></div><ol class="ledger-rows">${rows}</ol></div></section>`;
}
function table(data){
  const head=['이름','상품','금액','결제','단계','받으실 날','다음 행동'];
  const rows=data.rows.map(row=>`<tr class="${row.closed?'is-closed':''}"><td data-label="이름"><button type="button" class="ledger-open" data-action="open-project" data-id="${esc(row.id)}"><b>${esc(row.title||'이름 없음')}</b><small>${esc([row.number,row.customer].filter(Boolean).join(' · '))}</small></button></td><td data-label="상품">${esc(row.package||'—')}</td><td data-label="금액" class="ledger-num">${esc(won(row.amount)||'금액 없음')}${row.net!==null?`<small>실수령 ${esc(won(row.net))}</small>`:''}</td><td data-label="결제"><span class="ledger-pay ${PAY_TONE[row.status]||''}">${esc(row.statusLabel)}</span>${row.requestedDays!==null?`<small>${waited(row.requestedDays)}</small>`:''}${row.channel?`<small>${row.channel==='direct'?'직접':'크몽'}</small>`:''}</td><td data-label="단계">${esc(row.stage||'—')}</td><td data-label="받으실 날">${esc(row.dueDate?shortDay(row.dueDate):'—')}</td><td data-label="다음 행동"><span class="ledger-turn ${TURN_TONE[row.turn]||''}">${esc(row.turnLabel||'—')}</span>${row.next?`<small>${esc(row.next)}</small>`:''}</td></tr>`).join('');
  return `<section class="ledger-list" aria-labelledby="ledger-list-h"><header><h2 id="ledger-list-h">${esc(monthTitle(data.month))} 건별</h2><p>이 달에 결제 이력이 있는 건${data.month===data.current?'과 지금 결제를 기다리는 건':''} · ${data.rows.length}건</p></header>${data.rows.length?`<table class="ledger-table"><thead><tr>${head.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`:'<p class="ledger-empty">이 달에는 결제 이력이 있는 건이 없어요.</p>'}</section>`;
}

// 작업실 CSP(style-src 'self')는 꼬리표의 style 속성을 막는다 — 막대 높이 · 띠 자리 · 눈금 · 오늘 선은 data-* 숫자로 그리고,
// 그린 뒤 여기서 CSS 변수로 옮긴다(CSSOM은 CSP에 막히지 않는다, 다른 화면의 --p · --x와 같은 길). 0~100 밖 · 숫자 아닌 값은 버린다.
const pct=value=>{const n=Number(value);return Number.isFinite(n)?Math.min(100,Math.max(0,n)):null;};
export function placeLedger(root){
  const desk=root?.querySelector?.('.staff-ledger');if(!desk)return;
  const put=(node,name,value,unit='')=>{const n=pct(value);if(n!==null)node.style.setProperty(name,`${n}${unit}`);};
  for(const node of desk.querySelectorAll('[data-h]'))put(node,'--h',node.dataset.h);
  for(const node of desk.querySelectorAll('[data-x]'))put(node,'--x',node.dataset.x);
  for(const node of desk.querySelectorAll('.ledger-span'))(put(node,'--l',node.dataset.left),put(node,'--w',node.dataset.width));
  for(const node of desk.querySelectorAll('[data-today]'))put(node,'--today',node.dataset.today,'%');
}

export function ledgerDesk(state,{seatsNow=null,top='',failed=false}={}){
  const data=state?.data;
  if(!data)return `<section class="staff-home staff-ledger" aria-label="운영판">${top}${failed?'<div class="ledger-retry"><button type="button" class="button" data-action="ledger">운영판 다시 불러오기</button></div>':'<div class="loading" role="status"><span class="loading-mark"></span>운영판을 불러오는 중이에요.</div>'}</section>`;
  const prev=shiftMonth(data.month,-1),next=shiftMonth(data.month,1),canNext=data.month<data.current;
  const head=`<header class="ledger-head"><div class="ledger-month" role="group" aria-label="달 고르기"><button type="button" class="ledger-step" data-action="ledger-month" data-month="${esc(prev)}" aria-label="${esc(monthTitle(prev))}로">‹ ${esc(monthName(prev))}</button><h1 tabindex="-1">${esc(monthTitle(data.month))}</h1>${canNext?`<button type="button" class="ledger-step" data-action="ledger-month" data-month="${esc(next)}" aria-label="${esc(monthTitle(next))}로">${esc(monthName(next))} ›</button>`:'<span class="ledger-step is-off" aria-hidden="true"></span>'}</div><p class="ledger-note">볼 수 있는 프로젝트만 세어요 · 오늘 ${esc(dayName(data.today))}</p><a class="ledger-csv" href="/api/pulse/ledger.csv?month=${esc(data.month)}" download="pulse-ledger-${esc(data.month)}.csv">월 CSV 내려받기</a></header>`;
  const busy=!!state.month&&state.month!==data.month; // 다른 달을 읽는 중 — 앞 달을 그대로 두고 알림만
  return `<section class="staff-home staff-ledger${busy?' is-busy':''}" aria-label="운영판"${busy?' aria-busy="true"':''}>${top}${busy?`<p class="sr" role="status">${esc(monthTitle(state.month))}을 불러오는 중이에요.</p>`:''}${head}${figures(data,seatsNow)}<div class="ledger-grid">${bars(data)}${band(data)}</div>${table(data)}</section>`;
}
