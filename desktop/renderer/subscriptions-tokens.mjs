// AI 구독 관리 「모델별 토큰」 칸(2026-11-15 유호님 「각 llm 모델마다 토큰 출력량 확인할수있는 시스템 솔리오에 추가해줘」).
// 본체(src/ai-tokens.cjs)가 이 PC의 AI 도구 기록에서 센 「날짜 · 도구 · 모델 → 토큰」 칸을 받아,
// 고른 기간(오늘 · 7일 · 30일)으로 묶고 글과 HTML로 옮긴다. DOM을 만지지 않는다(시험이 바로 부른다).
// 행동(data-subs): tokens-on · tokens-off · tokens-off-cancel · tokens-scan · tokens-range · tokens-open · tokens-all — 처리는 subscriptions.mjs.

export const TOKEN_RANGES = Object.freeze([['today', '오늘', 1], ['week', '7일', 7], ['month', '30일', 30]]);
export const TOKEN_TOOLS = Object.freeze({ claude: 'Claude', gpt: 'GPT', grok: 'Grok', gemini: 'Gemini' });
const TOOL_NAMES = 'Claude Code · Codex · Grok CLI · Gemini CLI';
const SHOWN = 6; // 처음에 보이는 모델 줄 수. 나머지는 「모두 보기」.
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const pad = n => String(n).padStart(2, '0');
export const tokenDay = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// k일 앞의 날(이 PC 시각 기준 달력 날 — 하루가 23 · 25시간인 날에도 하루씩 간다).
const dayBefore = (now, k) => { const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - k); return tokenDay(d.getTime()); };
// 날(YYYY-MM-DD)을 「11/5」로. 올해가 아닌 날은 해를 앞에 붙인다(기록은 400일까지 남는다 — 검수 지적).
const md = (key, now = Date.now()) => `${Number(key.slice(0, 4)) !== new Date(now).getFullYear() ? `${Number(key.slice(0, 4))}/` : ''}${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
const hm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// 모델 이름: 기록에 적힌 값(claude-opus-5-5, gpt-6.1-sol, gemini-3.5-flash, grok-4.7-build)을 사람이 읽는 이름으로. 모르는 모양은 그대로 둔다.
export function modelLabel(id) {
  const raw = String(id || '').trim();
  if (!raw || raw === '?') return '모델 기록 없음';
  let m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?(?:-\d{8})?$/i.exec(raw);
  if (m && !/^\d/.test(m[1])) return `${cap(m[1].toLowerCase())} ${m[2]}${m[3] && m[3].length <= 2 ? `.${m[3]}` : ''}`;
  m = /^claude-(\d+)(?:-(\d+))?-([a-z]+)(?:-\d{8})?$/i.exec(raw);
  if (m) return `${cap(m[3].toLowerCase())} ${m[1]}${m[2] ? `.${m[2]}` : ''}`;
  if (/^gpt-/i.test(raw)) return `GPT-${raw.slice(4).split('-').map((p, i) => (i === 0 ? p : cap(p))).join(' ')}`;
  if (/^(gemini|grok)-/i.test(raw)) return raw.split('-').map(p => (/^\d/.test(p) ? p : cap(p.toLowerCase()))).join(' ');
  return raw;
}

// 토큰 수를 한국어 단위로: 9,876 · 1.2만 · 456만 · 1,235만 · 1.23억.
export function tokenText(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  if (v < 10000) return v.toLocaleString('ko-KR');
  // 반올림한 뒤에 단위를 고른다(99,996,000이 「10,000만」이 아니라 「1억」이 되게).
  if (v < 1e8) { const x = v / 1e4, r = x < 100 ? Math.round(x * 10) / 10 : Math.round(x); if (r < 10000) return `${r < 100 ? String(r) : r.toLocaleString('ko-KR')}만`; }
  const x = v / 1e8, r = x < 100 ? Math.round(x * 100) / 100 : Math.round(x);
  return `${r < 100 ? String(r) : r.toLocaleString('ko-KR')}억`;
}

// 고른 기간의 묶음. cells(계정판 스냅숏의 rows와 이름이 겹치지 않게): [날짜, 도구, 모델, in, out, cr, cw, rs, n] (본체 순서 그대로).
// 막대용 날: 오늘 · 7일은 지난 7일, 30일은 지난 30일(마지막이 오늘).
export function tokenSummary(state, rangeKey = 'week', now = Date.now()) {
  const range = TOKEN_RANGES.find(([k]) => k === rangeKey) || TOKEN_RANGES[1];
  const today = tokenDay(now), from = dayBefore(now, range[2] - 1);
  const chartDays = Array.from({ length: Math.max(7, range[2]) }, (_, i) => dayBefore(now, Math.max(7, range[2]) - 1 - i));
  const models = new Map(), total = { in: 0, out: 0, cr: 0, cw: 0, rs: 0, n: 0 };
  for (const r of Array.isArray(state?.cells) ? state.cells : []) {
    if (!Array.isArray(r) || r.length < 9) continue;
    const [day, service, model, inp, out, cr, cw, rs, n] = r;
    if (typeof day !== 'string' || day > today) continue;
    const key = `${service}|${model}`;
    let m = models.get(key);
    if (!m) { m = { key, service, model, label: modelLabel(model), tool: TOKEN_TOOLS[service] || service, in: 0, out: 0, cr: 0, cw: 0, rs: 0, n: 0, daily: Object.fromEntries(chartDays.map(d => [d, 0])) }; models.set(key, m); }
    if (Object.hasOwn(m.daily, day)) m.daily[day] += Number(out) || 0;
    if (day < from) continue;
    const add = { in: inp, out, cr, cw, rs, n };
    for (const k of Object.keys(add)) { m[k] += Number(add[k]) || 0; total[k] += Number(add[k]) || 0; }
  }
  const list = [...models.values()].filter(m => m.out > 0 || m.n > 0).sort((a, b) => b.out - a.out || b.n - a.n || a.label.localeCompare(b.label));
  for (const m of list) m.share = total.out > 0 ? m.out / total.out : 0;
  // 기간의 앞쪽이 비어 있는 도구: 그 도구의 가장 이른 기록이 기간 시작보다 늦을 때(그 전 기록은 도구가 이미 지웠을 수 있다).
  const by = state?.sinceBy && typeof state.sinceBy === 'object' ? state.sinceBy : {};
  const late = [...new Set(list.map(m => m.service))].filter(k => typeof by[k] === 'string' && by[k] > from).map(k => ({ service: k, tool: TOKEN_TOOLS[k] || k, since: by[k] }));
  return { range: range[0], label: range[1], days: range[2], from, today, chartDays, total, models: list, late, partial: late.length > 0, since: state?.since || null };
}

// 서비스 줄과 같은 꺾쇠(펼치면 90도 돈다).
const chevron = '<svg class="ms-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6"/></svg>';
const svc = service => `ms-s-${['claude', 'gpt', 'gemini', 'grok'].includes(service) ? service : 'other'}`;

function rangeButtons(current) {
  return `<div class="mt-range" role="group" aria-label="기간">${TOKEN_RANGES.map(([k, label]) => `<button type="button" class="mt-range-btn${k === current ? ' is-on' : ''}" data-subs="tokens-range" data-id="range-${k}" data-range="${k}" aria-pressed="${k === current}">${label}</button>`).join('')}</div>`;
}
function dayBars(m, s) {
  const max = Math.max(1, ...s.chartDays.map(d => m.daily[d] || 0)), long = s.chartDays.length > 7;
  const bars = s.chartDays.map((d, i) => {
    const v = m.daily[d] || 0, last = i === s.chartDays.length - 1, h = v > 0 ? Math.max(4, Math.round((v / max) * 100)) : 0;
    const label = last ? '오늘' : long ? '' : DAY_NAMES[new Date(`${d}T12:00:00`).getDay()];
    return `<span class="mt-day${last ? ' is-last' : ''}${d < s.from ? ' is-out' : ''}" title="${md(d)} 출력 ${esc(Number(v).toLocaleString('ko-KR'))}">${long ? '' : `<em>${v ? esc(tokenText(v)) : '&nbsp;'}</em>`}<span class="mt-day-bar"><i style="height:${h}%"></i></span>${long ? '' : `<small>${label}</small>`}</span>`;
  }).join('');
  const sr = `날마다 출력: ${s.chartDays.map(d => `${md(d)} ${tokenText(m.daily[d] || 0)}`).join(', ')} 토큰`;
  return `<span class="ms-sr">${esc(sr)}</span><div class="mt-days${long ? ' is-long' : ''}" aria-hidden="true">${bars}<span class="mt-axis"><span>${md(s.chartDays[0])}</span><span>오늘</span></span></div>`;
}
function modelRow(m, s, open) {
  // 몫이 0.5% 아래인 모델은 「0%」가 아니라 「1% 미만」(조금이라도 썼다).
  const pct = Math.round(m.share * 100), pctText = pct === 0 && m.out > 0 ? '<1%' : `${pct}%`;
  const sr = `${m.tool} ${m.label}, ${s.label} 출력 ${Number(m.out).toLocaleString('ko-KR')} 토큰, 응답 ${m.n.toLocaleString('ko-KR')}번`;
  const facts = [`출력 ${Number(m.out).toLocaleString('ko-KR')}`, m.rs ? `그중 생각 ${tokenText(m.rs)}` : '', `입력 ${tokenText(m.in)}`, m.cr ? `캐시 읽기 ${tokenText(m.cr)}` : '', m.cw ? `캐시 쓰기 ${tokenText(m.cw)}` : ''].filter(Boolean).join(' · ');
  const detail = open ? `<div class="mt-detail">${dayBars(m, s)}<p class="mt-facts">${esc(facts)}</p><p class="mt-raw">입력은 AI가 새로 읽은 글, 캐시 읽기는 앞에서 읽어 둔 글을 다시 쓴 양, 캐시 쓰기는 다음에 다시 쓰려고 담아 둔 양이에요.</p><p class="mt-raw">기록의 모델 이름 <code>${esc(m.model)}</code></p></div>` : '';
  return `<div class="mt-row ${svc(m.service)}${open ? ' open' : ''}"><button type="button" class="mt-row-btn" data-subs="tokens-open" data-id="${esc(m.key)}" aria-expanded="${open}"><span class="ms-sr">${esc(sr)}</span>`
    + `<span class="mt-who" aria-hidden="true"><span class="ms-tag">${esc(m.tool)}</span><span class="mt-model">${esc(m.label)}</span></span>`
    + `<span class="mt-share" aria-hidden="true"><span class="mt-bar"><i style="width:${Math.max(pct, m.out > 0 ? 1 : 0)}%"></i></span><small>${esc(pctText)}</small></span>`
    + `<span class="mt-val" aria-hidden="true"><b class="ms-num">${esc(tokenText(m.out))}</b><small>응답 ${esc(m.n.toLocaleString('ko-KR'))}번</small></span>${chevron}</button>${detail}</div>`;
}
function notes(state) {
  const tools = state?.tools || {}, found = ['claude', 'gpt', 'grok', 'gemini'].filter(k => tools[k] > 0);
  const lines = [];
  // 처음 세는 중에는 아직 모른다 — 「찾지 못했어요」는 다 센 뒤에만(검수 지적: 진행 표시와 함께 떴다).
  if (!found.length && state?.scannedAt) lines.push(`이 PC에서 ${TOOL_NAMES}의 기록을 아직 찾지 못했어요. 이 도구들을 쓰면 여기에 모여요.`);
  // 실시간(11-16)은 이 화면이 열려 있을 때만이라 그렇게 알린다.
  lines.push('이 화면을 열어 두면 AI가 답을 마칠 때마다 몇 초 안에 숫자를 더해요. 화면을 닫아 두면 3시간마다 다시 세어요.');
  if (tools.agy) lines.push('Antigravity CLI(Gemini)는 토큰 수를 읽을 수 있는 기록으로 남기지 않아 세지 못해요.');
  lines.push('claude.ai · ChatGPT 웹과 휴대폰 앱처럼 이 PC에 기록이 남지 않는 사용은 빠져요.');
  return `<ul class="mt-notes">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`;
}

// view: { range, open:Set, all, offArmed }, busy: 진행 중인 행동 이름.
export function tokensSection({ state, view = {}, now = Date.now(), number = '04', busy = '' }) {
  const head = (desc, body) => `<section class="ms-section mt-section" data-section="${number}" id="ms-tokens"><div class="ms-section-heading"><h2>모델별 토큰</h2><p>${desc}</p></div>${body}</section>`;
  if (!state?.ok) return '';
  if (!state.enabled) {
    // 안내는 사실대로(설계 검토 9): 기록 파일 전체를 훑고 그중 모델 이름과 토큰 수만 꺼낸다. 남기는 것에는 파일 위치와 읽은 자리도 있다.
    return head('모델마다 출력 토큰을 얼마나 썼는지 보여 줘요.', `<div class="mt-off"><p>토큰은 AI가 읽고 쓴 글의 양을 세는 단위예요. 출력 토큰은 AI가 답하며 쓴 양이에요.</p><p>켜면 이 PC의 AI 도구가 남긴 대화 기록 파일을 훑어, 응답마다 모델 이름과 토큰 수만 꺼내 더해요. 대화 내용은 꺼내 두지 않고 밖으로 보내지 않아요. 로그인 정보 파일은 열지 않아요.</p><p class="mt-soft">이 PC에 남기는 것은 날짜와 모델별 숫자, 어느 기록 파일을 어디까지 읽었는지예요. 끄면 모두 지워요.</p><p class="mt-soft">읽는 도구: ${TOOL_NAMES}</p><div class="ms-inline"><button type="button" class="ms-button ms-button-primary" data-subs="tokens-on" ${busy ? 'disabled' : ''}>모델별 토큰 켜기</button></div></div>`);
  }
  const p = state.progress, counting = p && p.total ? ` <b class="ms-num">${p.done.toLocaleString('ko-KR')}/${p.total.toLocaleString('ko-KR')}</b>` : '';
  if (!state.scannedAt) {
    const pct = p?.total ? Math.round((p.done / p.total) * 100) : 0;
    const body = state.scanning
      ? `<div class="mt-first"><p>처음이라 기록 파일을 모두 세고 있어요.${counting}</p><span class="mt-progress" role="progressbar" aria-label="기록 세기" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></span><p class="mt-soft">기록이 많으면 몇 분 걸려요. 다른 화면을 봐도 계속 세고 있어요.</p></div>`
      : `<div class="mt-first"><p>${state.error ? '세다가 멈췄어요. 다시 세어 주세요.' : '아직 세지 않았어요.'}</p><div class="ms-inline"><button type="button" class="ms-button" data-subs="tokens-scan" ${busy ? 'disabled' : ''}>다시 세기</button></div></div>`;
    return head('이 PC의 AI 도구 기록으로 센 출력 토큰이에요.', body + foot(state, view, now, busy));
  }
  const s = tokenSummary(state, view.range, now);
  const open = view.open instanceof Set ? view.open : new Set();
  const shown = view.all ? s.models : s.models.slice(0, SHOWN);
  const total = s.models.length
    ? `<p class="mt-total"><span>${esc(s.label)} 출력</span><b class="ms-num">${esc(tokenText(s.total.out))}</b><span>토큰 · 응답 ${s.total.n.toLocaleString('ko-KR')}번 · 모델 ${s.models.length}개</span></p>`
    : `<p class="mt-total is-empty">${esc(s.range === 'today' ? '오늘은' : `${s.label} 동안`)} 센 응답이 없어요.</p>`;
  const partial = s.late.length ? `<p class="mt-soft">${esc(s.late.map(l => `${l.tool} 기록은 ${md(l.since, now)}부터`).join(' · '))} 있어요. 그 전 날은 비어 있어요.</p>` : '';
  const more = s.models.length > SHOWN ? `<button type="button" class="ms-more" data-subs="tokens-all" aria-expanded="${!!view.all}">${view.all ? '접기' : `모델 ${s.models.length}개 모두 보기`}</button>` : '';
  const list = shown.length ? `<div class="mt-list">${shown.map(m => modelRow(m, s, open.has(m.key))).join('')}</div>${more}` : '';
  return head('이 PC의 AI 도구 기록으로 센 출력 토큰이에요. 줄을 누르면 날마다 보여요.', `${rangeButtons(s.range)}${total}${partial}${list}${foot(state, view, now, busy)}`);
}

function foot(state, view, now, busy) {
  const p = state.progress;
  // 처음 세는 중이면 진행 수는 위 칸에 있으니 아래 줄에서 되풀이하지 않는다.
  // 마지막으로 센 때: 다 훑은 때와 실시간으로 더한 때 중 늦은 것.
  const last = state.scannedAt ? Math.max(state.scannedAt, Number(state.liveAt) || 0) : 0;
  const status = state.scanning
    ? (state.scannedAt ? `세는 중${p?.total ? ` ${p.done.toLocaleString('ko-KR')}/${p.total.toLocaleString('ko-KR')}` : '…'}` : '')
    : last ? `마지막으로 센 때 ${new Date(last).toDateString() === new Date(now).toDateString() ? '' : `${md(tokenDay(last), now)} `}${hm(last)}` : '';
  // 실시간(11-16): 본체가 기록 폴더를 지켜보는 동안. 처음 세는 중에는 위 칸이 진행을 보이니 붙이지 않는다.
  const liveTag = state.live && state.scannedAt ? '<span class="mt-live"><i aria-hidden="true"></i>실시간</span>' : '';
  const since = state.since ? `기록 ${md(state.since, now)}부터` : '';
  const warn = state.error && state.scannedAt ? '<span class="ms-warn-text">지난번에 끝까지 세지 못했어요</span>' : '';
  const failed = state.failed > 0 && !state.scanning ? `읽지 못한 파일 ${Number(state.failed).toLocaleString('ko-KR')}개` : '';
  const off = view.offArmed
    ? `<div class="mt-off-confirm"><span>끄면 모은 숫자를 지워요. 다시 켜면 처음부터 다시 세어요.</span><button type="button" class="ms-button ms-button-small ms-button-danger" data-subs="tokens-off" data-id="off-confirm" ${busy ? 'disabled' : ''}>끄고 지우기</button><button type="button" class="ms-button ms-button-small" data-subs="tokens-off-cancel">그대로 두기</button></div>`
    : '';
  // 줄의 조각을 모아 가운뎃점으로 잇는다 — 앞 조각이 비어도 「· 끄기」처럼 점이 홀로 남지 않게(검수 지적).
  // 처음 세다 멈춘 판은 위 칸에 「다시 세기」가 있으니 여기서는 되풀이하지 않는다.
  const scanBtn = state.scanning || !state.scannedAt ? '' : `<button type="button" class="ms-link" data-subs="tokens-scan" ${busy ? 'disabled' : ''}>다시 세기</button>`;
  const offBtn = `<button type="button" class="ms-link" data-subs="tokens-off" data-id="off-link" ${busy || view.offArmed ? 'disabled' : ''}>끄기</button>`;
  const parts = [esc(since), liveTag, esc(status), warn, esc(failed), scanBtn, offBtn].filter(Boolean);
  return `<div class="mt-foot"><p class="mt-foot-line">${parts.join(' · ')}</p>${off}${notes(state)}</div>`;
}
