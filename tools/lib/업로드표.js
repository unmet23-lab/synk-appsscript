'use strict';
/* 업로드표 (2026-10-30) — 앞뒤 1주, 매일 판 계정마다 하루하루가 올라갔는지 · 걸려 있는지를 O · △ · X로 한 장에 보인다.
 * 유호님 10-30 「1주일 앞뒤로 지금 올려야하는 모든플렘폼스케줄 확인할수있게 올리고 못올린거 체크할수있게 o x 표시로 가시성 좋게
 * 업로드 스케줄표를 하나 만들어줬으면 좋겠어」.
 * 셈은 tools/예약큐.js build()의 계정별 줄(report.accounts)을 그대로 쓰고, 여기서는 칸 하나의 판정과 그림만 한다.
 *   O 올라감(게시됨) · O 예약(걸어 둠 — 시각이 지났는데 공개를 아직 못 본 것은 「확인 전」) · △ 만들어 둠(승인 · 예약 전, 영상 뒤에 걸 글)
 *   △ 고칠 것(올리기 전 검사) · ! 예약했는데 안 보임 · 서버에 없음 · X 없음(지난날은 못 올림) · – 쉬는 요일
 * 쓰는 곳: 공용 작업본 .tmp/업로드표.html — 30분 정기 작업(예약큐.js --서버읽기)이 새로 쓰고, 열어 둔 화면은 10분마다 다시 읽는다.
 *   손으로: node tools/업로드표.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { 공용작업본 } = require('./공용작업본.js');

const GRACE_MS = 2 * 3600000; // 예약큐와 같다 — 슬롯 2시간 뒤까지는 「예약」으로 둔다
const LINE_ORDER = ['LAB 영어', 'LAB 몽골', 'LAB 두 채널', 'synkbrief', 'yuhobuilds'];
const PLATFORM = {
  youtube: '유튜브', instagram: '인스타', tiktok: '틱톡', facebook: '페이스북', telegram: '텔레그램', threads: '스레드',
  linkedin: '링크드인', x: 'X', twitter: 'X', xiaohongshu: '샤오훙수', 'naver-blog': '네이버 블로그', tistory: '티스토리',
};
const 요일 = '일월화수목금토';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hhmm = (t) => (Number.isFinite(Date.parse(t || '')) ? new Date(Date.parse(t) + 9 * 3600000).toISOString().slice(11, 16) : '');
const dayName = (d) => 요일[new Date(d + 'T00:00:00Z').getUTCDay()];
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

function 이름(key, accounts) {
  const a = accounts[key] || {};
  const handle = String(a.handle || a.expectedHandle || '').replace(/^https?:\/\//, '').replace(/^(www\.)?facebook\.com\//, '');
  return { 플랫폼: PLATFORM[a.platform] || a.platform || key, 핸들: handle };
}

/** 한 계정 · 한 날 칸 — {표, 결, 말, 풀이, 주소, 편수} */
function 칸(list, day, today, now, off) {
  const live = list.filter((p) => p.state !== '보류');
  const 풀이 = list.map((p) => [p.title, p.state || '만듦', hhmm(p.time)].filter(Boolean).join(' · ')).join('\n');
  const base = { 풀이, 주소: null, 편수: live.length };
  if (!live.length) {
    if (off) return { ...base, 표: '–', 결: 'rest', 말: '쉬는 날' };
    const 보류 = list.length > 0; // 보류 판(버린 편)뿐 — 나가지 않으니 빈 칸과 같다
    if (day < today) return { ...base, 표: 'X', 결: 'miss', 말: 보류 ? '보류' : '안 올라감' };
    if (day === today) return { ...base, 표: 'X', 결: 'miss', 말: 보류 ? '보류' : '아직 없음' };
    return { ...base, 표: 'X', 결: 'gap', 말: 보류 ? '보류 · 새 편 칸' : '만들 차례' };
  }
  const posted = live.find((p) => p.state === '게시됨');
  if (posted) return { ...base, 표: 'O', 결: 'done', 말: '올라감', 주소: posted.url || null };
  const bad = live.find((p) => p.unseen || ['서버에 없음', '확인 필요', '실패'].includes(p.state));
  if (bad) return { ...base, 표: bad.state === '실패' ? 'X' : '!', 결: 'miss', 말: bad.unseen ? '예약했는데 안 보임' : bad.state };
  const set = live.find((p) => p.state === '예약됨');
  if (set) {
    const at = Date.parse(set.time || '');
    const 지남 = Number.isFinite(at) && at + GRACE_MS < now;
    return { ...base, 표: 'O', 결: 지남 ? 'done' : 'set', 말: 지남 ? '예약 · 확인 전' : `예약 ${hhmm(set.time)}`.trim(), 주소: set.url || null };
  }
  if (live.some((p) => p.done)) return { ...base, 표: '△', 결: 'wait', 말: '영상 뒤에 걸 글' };
  if (live.some((p) => p.fix)) return { ...base, 표: '△', 결: 'fix', 말: '고칠 것' };
  return { ...base, 표: '△', 결: 'wait', 말: live[0].state || '승인 대기' };
}

function 줄들(report, accounts) {
  const rows = report.accounts.filter((r) => r.line || Object.values(r.byDay).some((l) => l.length));
  const have = new Set(rows.map((r) => r.account));
  // 막힌 계정(dailyBlocked)은 셈에서 빠지지만 표에는 까닭과 함께 회색 줄로 남긴다.
  for (const b of report.blocked || []) {
    if (have.has(b.account)) continue;
    rows.push({ account: b.account, line: b.line, brand: b.line, byDay: Object.fromEntries(report.range.map((d) => [d, []])), off: [], blocked: b.reason });
  }
  for (const r of rows) if (!r.blocked && accounts[r.account]?.dailyBlocked) r.blocked = accounts[r.account].dailyBlocked;
  const group = (r) => r.line || r.brand || '그 밖';
  const rank = (g) => (LINE_ORDER.includes(g) ? LINE_ORDER.indexOf(g) : LINE_ORDER.length);
  rows.sort((a, b) => rank(group(a)) - rank(group(b)) || group(a).localeCompare(group(b)) || a.account.localeCompare(b.account));
  return rows.map((r) => ({ ...r, group: group(r) }));
}

function html(report, { accounts = {}, now = Date.now(), today } = {}) {
  const range = report.range;
  today = today || range[Math.floor(range.length / 2)];
  const rows = 줄들(report, accounts);
  const cells = rows.map((r) => range.map((d) => (r.blocked ? { 표: '', 결: 'blocked', 말: '', 풀이: '', 편수: 0 } : 칸(r.byDay[d] || [], d, today, now, (r.off || []).includes(d)))));
  const live = rows.map((r, i) => !r.blocked);
  const sum = (pick) => {
    let o = 0, n = 0;
    rows.forEach((r, i) => range.forEach((d, j) => { if (!live[i] || !pick(d) || cells[i][j].결 === 'rest') return; n += 1; if (cells[i][j].표 === 'O') o += 1; }));
    return { o, n };
  };
  const 오늘 = sum((d) => d === today);
  const 지난 = sum((d) => d < today);
  const 앞 = sum((d) => d > today);
  const 오늘빈 = rows.flatMap((r, i) => (live[i] && cells[i][range.indexOf(today)]?.표 !== 'O' && cells[i][range.indexOf(today)]?.결 !== 'rest' ? [r] : []));
  const 놓침 = rows.reduce((k, r, i) => k + range.filter((d, j) => live[i] && d < today && ['X', '!'].includes(cells[i][j].표)).length, 0);
  const 갱신 = new Date(now + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
  const 서버 = report.server?.checkedAt ? `서버 대조 ${new Date(Date.parse(report.server.checkedAt) + 9 * 3600000).toISOString().slice(5, 16).replace('T', ' ')}` : '서버 대조 없음';

  const head = range.map((d) => `<th class="d${d === today ? ' today' : d < today ? ' past' : ''}"><span class="md">${md(d)}</span><span class="wd">${dayName(d)}</span>${d === today ? '<span class="now">오늘</span>' : ''}</th>`).join('');
  const daySum = range.map((d, j) => {
    let o = 0, n = 0;
    rows.forEach((r, i) => { if (!live[i] || cells[i][j].결 === 'rest') return; n += 1; if (cells[i][j].표 === 'O') o += 1; });
    const full = n && o === n;
    return `<td class="sum${d === today ? ' today' : ''}${full ? ' full' : ''}">${o}<small>/${n}</small></td>`;
  }).join('');
  let body = '';
  let last = null;
  rows.forEach((r, i) => {
    if (r.group !== last) { body += `<tr class="grp"><th colspan="${range.length + 1}"><span>${esc(r.group)}</span></th></tr>`; last = r.group; }
    const n = 이름(r.account, accounts);
    const tds = range.map((d, j) => {
      const c = cells[i][j];
      if (r.blocked) return `<td class="c blocked${d === today ? ' today' : ''}"></td>`;
      const inner = `<b>${esc(c.표)}</b><i>${esc(c.말)}</i>${c.편수 > 1 ? `<em>${c.편수}편</em>` : ''}`;
      const tip = esc([`${md(d)}(${dayName(d)}) ${n.플랫폼} ${n.핸들}`, c.풀이 || c.말].join('\n'));
      const tag = c.주소 ? `<a href="${esc(c.주소)}" target="_blank" rel="noopener">${inner}</a>` : `<span>${inner}</span>`;
      return `<td class="c ${c.결}${d === today ? ' today' : ''}${d < today ? ' past' : ''}" title="${tip}">${tag}</td>`;
    }).join('');
    body += `<tr${r.blocked ? ' class="blockedrow"' : ''}><th class="acc"><span class="pf">${esc(n.플랫폼)}</span><span class="hd">${esc(n.핸들)}</span>${r.blocked ? `<span class="why">막힘 — ${esc(String(r.blocked).slice(0, 40))}</span>` : ''}</th>${tds}</tr>`;
  });

  let 폰트 = '';
  try { 폰트 = require('./브랜드폰트.js').블록(); } catch { /* 글꼴 파일이 없으면 시스템 글꼴로 — 표는 그대로 */ }
  const 빈글 = 오늘빈.length ? 오늘빈.map((r) => { const n = 이름(r.account, accounts); return `${n.플랫폼} ${n.핸들}`.trim(); }).join(' · ') : '없음 — 오늘 칸이 다 찼어요';
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="600">
<title>업로드 일정표</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
${폰트}
<style>
:root{--frame:#060709;--paper:#fff;--paper2:#F7F7F6;--s1:#F5F5F4;--s2:#EDEDEB;--ink:#08090C;--ink70:rgba(8,9,12,.7);--ink56:rgba(8,9,12,.56);--ink20:rgba(8,9,12,.2);
--line:rgba(8,9,12,.08);--line2:rgba(8,9,12,.15);--lapis:#3D6BC9;--lapis-soft:#C5D6F5;--face:#17181C;--coral:#F96859;--green:#14905A;--green-soft:#E3F4EA;--butter:#F2C14E;--butter-soft:#FDF3DA;
--mono:'DM Mono',ui-monospace,Menlo,Consolas,monospace;--sans:'SUIT Variable','SUIT','Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif}
*{box-sizing:border-box}html{background:var(--frame)}body{margin:0;background:var(--frame);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased}
.paper{background:var(--paper);border-radius:22px;margin:16px;padding:28px 28px 22px;min-height:calc(100vh - 32px)}
.eyebrow{font:500 11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink56);display:flex;align-items:center;gap:8px}
.eyebrow::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--lapis)}
h1{font-size:44px;font-weight:850;letter-spacing:-.05em;margin:12px 0 6px;line-height:1.05}
.desc{font-size:15px;color:var(--ink70);margin:0 0 20px}
.gauge{display:flex;border:1px solid var(--line2);border-radius:16px;overflow:hidden;margin-bottom:14px;flex-wrap:wrap}
.gauge>div{flex:1 1 150px;padding:14px 18px;border-left:1px solid var(--line2)}.gauge>div:first-child{border-left:0}
.gauge .k{font-size:13px;color:var(--ink56);font-weight:600}.gauge .v{font-size:30px;font-weight:850;letter-spacing:-.04em;margin-top:4px}.gauge .v small{font-size:16px;color:var(--ink56);font-weight:700}
.gauge .hot{background:var(--face);color:#fff}.gauge .hot .k{color:var(--lapis-soft)}.gauge .hot .v{color:var(--lapis-soft)}.gauge .hot small{color:rgba(197,214,245,.6)}
.todaygap{font-size:14px;color:var(--ink70);margin:0 0 14px;line-height:1.55}.todaygap strong{color:var(--ink)}
.legend{display:flex;flex-wrap:wrap;gap:8px 14px;font-size:13px;color:var(--ink70);margin-bottom:14px}
.legend span{display:inline-flex;align-items:center;gap:6px}.legend b{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:7px;font-size:14px}
.wrap{overflow-x:auto;border:1px solid var(--line2);border-radius:16px}
table{border-collapse:separate;border-spacing:0;min-width:100%;font-size:13px}
th,td{border-bottom:1px solid var(--line);text-align:center;padding:0}
thead th{position:sticky;top:0;background:var(--paper2);z-index:2;height:52px;font-weight:700}
th.d{min-width:66px;border-left:1px solid var(--line)}th.d .md{display:block;font-size:14px;font-weight:800}th.d .wd{display:block;font-size:11px;color:var(--ink56);font-weight:600}
th.d.past .md{color:var(--ink56)}th.d.today{background:var(--lapis);color:#fff}th.d.today .wd{color:var(--lapis-soft)}th.d .now{display:block;font-size:10px;font-weight:700;color:#fff}
th.corner,th.acc{position:sticky;left:0;z-index:3;background:var(--paper);text-align:left;padding:8px 14px;min-width:170px;border-right:1px solid var(--line2)}
thead th.corner{background:var(--paper2);z-index:4;font-size:12px;color:var(--ink56);font-weight:600}
th.acc .pf{display:block;font-size:14px;font-weight:800;letter-spacing:-.02em}th.acc .hd{display:block;font-size:12px;color:var(--ink56);font-weight:500}
th.acc .why{display:block;font-size:11px;color:var(--coral);font-weight:600;margin-top:2px}
tr.grp th{background:var(--s1);text-align:left;padding:7px 0;font-size:12px;font-weight:800;color:var(--ink70)}tr.grp th span{position:sticky;left:14px;padding:0 14px}
td.c{border-left:1px solid var(--line);height:58px}td.c>a,td.c>span{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:inherit;text-decoration:none;gap:2px;position:relative}
td.c b{font-size:22px;font-weight:900;line-height:1}td.c i{font-style:normal;font-size:10.5px;font-weight:600;line-height:1.15;padding:0 3px}
td.c em{position:absolute;top:3px;right:4px;font-style:normal;font-size:9.5px;font-weight:800;background:var(--ink);color:#fff;border-radius:6px;padding:1px 4px}
td.done{background:var(--green-soft)}td.done b{color:var(--green)}td.done i{color:var(--green)}
td.set b{color:var(--green);-webkit-text-stroke:0}td.set{background:#fff}td.set i{color:var(--green)}td.set b{opacity:.75}
td.wait{background:var(--butter-soft)}td.wait b,td.wait i{color:#9A6B00}
td.fix{background:var(--butter-soft)}td.fix b,td.fix i{color:#B4471F}
td.miss{background:#FDE7E4}td.miss b,td.miss i{color:#C8321F}
td.gap b{color:var(--coral);opacity:.55}td.gap i{color:var(--ink56)}
td.rest b{color:var(--ink20)}td.rest i{color:var(--ink20)}
td.blocked{background:repeating-linear-gradient(135deg,var(--s1) 0 6px,#fff 6px 12px)}tr.blockedrow th.acc .pf{color:var(--ink56)}
td.today{box-shadow:inset 2px 0 0 var(--lapis),inset -2px 0 0 var(--lapis)}
td.c a:hover{outline:2px solid var(--lapis);outline-offset:-2px;border-radius:4px}
tfoot td,tfoot th{background:var(--paper2);height:40px;font-weight:800;font-size:14px;border-bottom:0}tfoot td small{font-size:11px;color:var(--ink56);font-weight:700}
tfoot td.full{color:var(--green)}tfoot td.today{background:var(--lapis);color:#fff}tfoot td.today small{color:var(--lapis-soft)}
.foot{font-size:12px;color:var(--ink56);margin-top:12px;line-height:1.6}
@media (max-width:640px){.paper{margin:0;border-radius:0;padding:20px 16px}h1{font-size:34px}th.corner,th.acc{min-width:128px;padding:6px 10px}th.d{min-width:58px}}
</style></head>
<body><main class="paper">
<div class="eyebrow">Upload schedule</div>
<h1>업로드 일정표</h1>
<p class="desc">${md(range[0])}(${dayName(range[0])}) ~ ${md(range[range.length - 1])}(${dayName(range[range.length - 1])}) · 계정마다 하루 한 편 · 칸을 누르면 올라간 글이 열려요</p>
<div class="gauge">
<div class="hot"><div class="k">오늘 ${md(today)} 올라감·예약</div><div class="v">${오늘.o}<small> / ${오늘.n}</small></div></div>
<div><div class="k">지난 7일 올라감</div><div class="v">${지난.o}<small> / ${지난.n}</small></div></div>
<div><div class="k">지난 7일 빈 칸</div><div class="v" style="color:${놓침 ? '#C8321F' : 'var(--green)'}">${놓침}</div></div>
<div><div class="k">앞 7일 예약 걸림</div><div class="v">${앞.o}<small> / ${앞.n}</small></div></div>
</div>
<p class="todaygap"><strong>오늘 아직 안 걸린 계정</strong> · ${esc(빈글)}</p>
<div class="legend">
<span><b style="background:var(--green-soft);color:var(--green)">O</b>올라감</span>
<span><b style="background:#fff;color:var(--green);border:1px solid var(--line2)">O</b>예약 걸림</span>
<span><b style="background:var(--butter-soft);color:#9A6B00">△</b>만들어 둠 · 승인 대기</span>
<span><b style="background:var(--butter-soft);color:#B4471F">△</b>고칠 것</span>
<span><b style="background:#FDE7E4;color:#C8321F">X</b>안 올라감 · 오늘 아직</span>
<span><b style="background:#FDE7E4;color:#C8321F">!</b>예약했는데 안 보임</span>
<span><b style="background:#fff;color:var(--coral);opacity:.6;border:1px solid var(--line2)">X</b>앞날 — 만들 차례</span>
<span><b style="background:#fff;color:var(--ink20);border:1px solid var(--line2)">–</b>쉬는 날</span>
</div>
<div class="wrap"><table>
<thead><tr><th class="corner">계정</th>${head}</tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><th class="acc">O 합계</th>${daySum}</tr></tfoot>
</table></div>
<script>(function(){var w=document.querySelector('.wrap'),t=document.querySelector('th.d.today'),c=document.querySelector('th.corner');if(w&&t&&c)w.scrollLeft=Math.max(0,t.offsetLeft-c.offsetWidth-2*t.offsetWidth);})();</script>
<p class="foot">갱신 ${esc(갱신)} · ${esc(서버)} · 30분마다 새로 쓰고, 열어 둔 화면은 10분마다 다시 읽어요. 편 폴더의 게시/준비.json · 게시결과.json과 작업실 서버를 예약큐와 같은 셈으로 읽어요. 칸에 마우스를 올리면 편 이름 · 상태 · 시각이 보여요.</p>
</main></body></html>
`;
}

/** 표를 파일로 쓴다 — 기본은 공용 작업본 .tmp/업로드표.html. 쓴 경로를 돌려준다. */
function 쓰기(report, opts = {}) {
  const out = opts.출력 || path.join(공용작업본(path.resolve(__dirname, '..', '..')), '.tmp', '업로드표.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = out + '.쓰는중';
  fs.writeFileSync(tmp, html(report, opts));
  fs.renameSync(tmp, out);
  return out;
}

module.exports = { 칸, html, 쓰기 };
