// AI 구독 계정판(회원 혜택) 화면. 읽기·로그인·저장은 데스크톱 본체(src/ai-subscriptions.cjs)가 하고,
// 이 파일은 받은 숫자를 세 층(지금 볼 것 → 서비스 표·구독료 → 7일 일정)과 연결 가이드로 보여 준다.
const DAY = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_MS = 864e5;
const KINDS = [['weekly', '주간 한도', '주간 %와 초기화 시각'], ['credit', '크레딧', '잔액과 충전·결제일'], ['plan', '월 구독만', '결제일과 요금']];
const AUTO = {
  claude: { label: 'Claude', tool: 'Claude Code', plan: 'Claude Pro·Max 이상 요금제가 필요해요. 무료 요금제는 Claude Code를 쓸 수 없어요.', planLink: 'claude-plans', install: 'irm https://claude.ai/install.ps1 | iex', installLink: 'claude-install', email: true },
  gpt: { label: 'ChatGPT · Codex', tool: 'Codex', plan: 'ChatGPT 계정으로 로그인해요. 요금제마다 Codex 한도가 달라요.', planLink: 'chatgpt-plans', install: 'powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"', installLink: 'codex-install', email: false },
  higgsfield: { label: 'Higgsfield', tool: 'Higgsfield CLI', plan: 'Higgsfield 계정의 남은 크레딧을 읽어요. 계정 여러 개를 하나씩 연결할 수 있어요.', planLink: null, install: 'npm install -g @higgsfield/cli', installLink: 'higgsfield-install', email: false, node: true },
  gemini: { label: 'Gemini', tool: 'Antigravity CLI', plan: 'Antigravity CLI에 로그인한 Google 계정의 한도를 읽어요. Gemini 모델 한도와 Claude·GPT 모델 한도가 따로 보여요. 이 PC에는 Google 계정 하나만 연결돼요.', planLink: 'gemini-plans', install: 'irm https://antigravity.google/cli/install.ps1 | iex', installLink: 'antigravity-install', email: false, single: true },
  // 설치할 프로그램 없이 회원이 붙여 넣은 API 키로 읽는다(키는 본체가 이 PC에 암호화해 둔다).
  typecast: { label: 'Typecast', tool: 'Typecast API 키', plan: 'Typecast API 요금제(API Lite 등)의 이번 달 남은 크레딧을 읽어요. 설치할 프로그램은 없고, 키는 이 PC에만 암호화해 보관해요.', planLink: 'typecast-api', key: true },
};
const MANUAL_NAMES = ['Suno', 'Hugging Face', 'ElevenLabs', 'Kling', 'Midjourney', 'Cursor', 'Perplexity', 'Google AI Pro', 'Typecast'];
const MANUAL_KIND = { suno: 'credit', typecast: 'credit', elevenlabs: 'credit', kling: 'credit', higgsfield: 'credit', claude: 'weekly', gpt: 'weekly', chatgpt: 'weekly' };
const CODE_TEXT = {
  TOOL_MISSING: '먼저 공식 프로그램을 설치해 주세요. 설치 후 「다시 확인」을 눌러요.',
  NOT_LOGGED_IN: '이 PC의 기본 로그인이 없어요. 「새 계정 연결」로 로그인해 주세요.',
  LOGIN_BUSY: '다른 로그인이 진행 중이에요. 끝내거나 취소한 뒤 다시 시도해 주세요.',
  INVALID_EMAIL: '이메일 형식을 확인해 주세요.',
  INVALID_CODE: '코드에 띄어쓰기나 줄바꿈 없이 그대로 붙여 넣어 주세요.',
  NODE_REQUIRED: 'Higgsfield CLI는 Node.js가 있어야 설치돼요. 먼저 「Node.js 받기」로 설치해 주세요.',
  SIGN_IN_REQUIRED: 'SYNK ID로 로그인한 뒤 쓸 수 있어요.',
  LAUNCHER_ONLY: 'SYNK Platform PC 앱에서 쓸 수 있어요.',
  LABEL_REQUIRED: '서비스 이름을 넣어 주세요.',
  TOO_MANY_ROWS: '구독은 200개까지 넣을 수 있어요.',
  INSTALLER_FAILED: '설치 창을 열지 못했어요. 명령을 복사해 PowerShell에 붙여 넣어 주세요.',
  INVALID_KEY_FORMAT: 'API 키를 띄어쓰기 없이 그대로 붙여 넣어 주세요.',
  INVALID_KEY: 'Typecast가 이 키를 받지 않았어요. 키 페이지에서 다시 복사해 붙여 넣어 주세요.',
  KEY_CHECK_FAILED: 'Typecast 크레딧을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  NETWORK: 'Typecast에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',
  SECURE_STORAGE_UNAVAILABLE: '이 PC에서는 키를 안전하게 저장할 수 없어 연결하지 않았어요.',
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const num = v => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/* ---------- 계산(시험 대상) ---------- */
export function hasReset(row) { return row && row.resetDay !== null && row.resetDay !== undefined; }
export function nextReset(row, from) {
  const live = row?.live?.weekly?.resetsAt;
  if (live && live > from) return live;
  if (!hasReset(row)) return null;
  const d = new Date(from); d.setHours(row.resetHour || 0, row.resetMinute || 0, 0, 0);
  d.setDate(d.getDate() + ((Number(row.resetDay) - d.getDay() + 7) % 7));
  if (d.getTime() <= from) d.setDate(d.getDate() + 7);
  return d.getTime();
}
export function isUsedUp(row, now) {
  if (!row?.usedUpAt) return false;
  const r = nextReset({ ...row, live: null }, row.usedUpAt);
  return r === null ? true : now < r;
}
export function nextBill(day, now) {
  if (!day) return null;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 2; i++) {
    const y = today.getFullYear(), m = today.getMonth() + i, last = new Date(y, m + 1, 0).getDate();
    const d = new Date(y, m, Math.min(day, last));
    if (d >= today) return Math.round((d - today) / DAY_MS);
  }
  return null;
}
export function balance(row) {
  const live = row?.live?.credits;
  if (live !== null && live !== undefined && (!row.creditsAt || (row.live.readAt || 0) >= row.creditsAt)) return { value: Number(live), at: row.live.readAt || null, source: 'live' };
  return num(row?.credits) === null ? null : { value: Number(row.credits), at: row.creditsAt || null, source: row.source === 'auto' ? 'live' : 'manual' };
}
export function isLow(row) {
  if (row?.kind !== 'credit') return false;
  const b = balance(row); if (!b) return false;
  return num(row.lowAt) !== null ? b.value <= Number(row.lowAt) : b.value <= 1;
}
const liveWeekly = (row, now) => { const w = row?.live?.weekly; return w && Number.isFinite(w.usedPercent) && !(w.resetsAt && now >= w.resetsAt) ? w.usedPercent : null; };
const liveSession = (row, now) => { const w = row?.live?.session; return w && Number.isFinite(w.usedPercent) && !(w.resetsAt && now >= w.resetsAt) ? w : null; };
// 남은 %는 내림한다(99.6% 썼으면 0%). 남은 양을 부풀려 보이지 않게.
export const leftPercent = used => Math.max(0, Math.floor(100 - Number(used) + 1e-6));

// 한도 고리(10-17, Bklit 여러 겹 게이지): 안 고리 5시간 · 바깥 고리 주간. 초기화 시각이 지난 기간은 다시 가득 찬 것으로 본다.
// 가운데 숫자와 「초기화까지」는 두 고리 중 덜 남은 쪽(지금 쓸 수 있는 만큼)을 따른다.
export function limitGauge(row, now) {
  if (row?.kind !== 'weekly') return null;
  const shape = w => {
    if (!w || !Number.isFinite(Number(w.usedPercent))) return null;
    if (w.resetsAt && now >= w.resetsAt) return { used: 0, left: 100, resetsAt: null };
    const used = Math.min(100, Math.max(0, Number(w.usedPercent)));
    return { used, left: leftPercent(used), resetsAt: w.resetsAt || null };
  };
  const session = shape(row.live?.session);
  let weekly = shape(row.live?.weekly);
  if (isUsedUp(row, now)) weekly = { used: 100, left: 0, resetsAt: nextReset(row, now) };
  else if (weekly && !weekly.resetsAt && weekly.used > 0) weekly.resetsAt = nextReset(row, now);
  if (!session && !weekly) return null;
  const focus = session && (!weekly || session.left < weekly.left) ? 'session' : 'weekly';
  return { session, weekly, focus, left: (focus === 'session' ? session : weekly).left, resetsAt: (focus === 'session' ? session : weekly).resetsAt };
}
// 주의는 「10% 이하 남음」 하나로 숫자·색·알림 칩이 같은 기준을 쓴다.
export const gaugeLevel = w => (!w ? null : w.left <= 0 ? 'out' : w.left <= 10 ? 'low' : 'ok');
// 서비스마다 지금 가장 여유 있는 계정: 고리가 있고, 다시 로그인이 필요 없고, 덜 남은 쪽이 가장 많이 남은 계정.
export function roomiest(list, now) {
  const score = row => { const g = limitGauge(row, now); return g ? (row.source === 'auto' && row.state === 'needs-login' ? 0 : 1000) + g.left : -1; };
  return [...list].sort((a, b) => score(b) - score(a))[0] || null;
}
const who = row => (row.email ? `${row.email.split('@')[0]} ${row.label}` : row.label).trim();
// 메일이 없는 API 키 줄은 키 끝 네 글자로 구분한다.
const accountName = row => row.email || (row.keyHint ? `${row.label} · 키 ${row.keyHint}` : row.label);

export function attention(rows, now) {
  const items = [];
  for (const row of rows) {
    if (row.source === 'auto' && row.state === 'needs-login') items.push({ level: 0, order: 0, id: row.id, text: `다시 로그인 필요 · ${who(row)}` });
    if (row.kind === 'weekly') {
      const wp = liveWeekly(row, now), session = liveSession(row, now);
      if (isUsedUp(row, now)) { const r = nextReset(row, now); items.push({ level: 0, order: r || Infinity, id: row.id, text: `소진 · ${who(row)}${r ? ` · ${when(r)} 풀림` : ''}` }); }
      // 5시간을 다 쓴 계정은 주간이 남아 있어도 지금은 못 쓰니 주간 주의보다 먼저 올린다.
      else if (session && session.usedPercent >= 100) items.push({ level: 0, order: session.resetsAt || Infinity, id: row.id, text: `5시간 소진 · ${who(row)} · ${rel(session.resetsAt - now)} 뒤 풀림` });
      else if (wp !== null && leftPercent(wp) <= 10) items.push({ level: 1, order: 0, id: row.id, text: `거의 소진 · 주간 ${leftPercent(wp)}% 남음 · ${who(row)}` });
      else if (session && leftPercent(session.usedPercent) <= 10) items.push({ level: 1, order: 0, id: row.id, text: `거의 소진 · 5시간 ${leftPercent(session.usedPercent)}% 남음 · ${who(row)} · ${rel(session.resetsAt - now)} 뒤 풀림` });
    }
    if (isLow(row)) items.push({ level: 1, order: 0, id: row.id, text: `크레딧 부족 · ${who(row)} · ${credits(balance(row).value)}` });
    const dd = nextBill(row.billDay, now);
    if (dd !== null && dd <= 3) items.push({ level: dd <= 1 ? 1 : 2, order: now + dd * DAY_MS, id: row.id, text: `결제 ${dd === 0 ? '오늘' : 'D-' + dd} · ${who(row)}${num(row.price) !== null ? ' · ' + money(row.price, row.currency) : ''}` });
    if (row.source === 'auto' && row.live?.readAt && now - row.live.readAt > 3 * DAY_MS) items.push({ level: 2, order: row.live.readAt, id: row.id, text: `3일 넘게 못 읽음 · ${who(row)}` });
  }
  return items.sort((a, b) => a.level - b.level || a.order - b.order);
}
export function costSummary(rows, now, rate = 1400) {
  let krw = 0, usd = 0, count = 0, soon = 0, soonKrw = 0, soonUsd = 0;
  for (const row of rows) {
    if (num(row.price) === null) continue;
    count++; const usdRow = row.currency === 'USD';
    if (usdRow) usd += Number(row.price); else krw += Number(row.price);
    const dd = nextBill(row.billDay, now);
    if (dd !== null && dd <= 6) { soon++; if (usdRow) soonUsd += Number(row.price); else soonKrw += Number(row.price); }
  }
  return { krw, usd, count, soon, soonKrw, soonUsd, approx: krw + usd * (Number(rate) || 1400) };
}
export function agenda(rows, now) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const days = new Map(), add = (index, item) => { if (!days.has(index)) days.set(index, []); days.get(index).push(item); };
  for (const row of rows) {
    if (row.kind === 'weekly') {
      const r = nextReset(row, now);
      if (r && r - now <= 7 * DAY_MS) add(Math.round((new Date(r).setHours(0, 0, 0, 0) - today) / DAY_MS), { t: r, time: `${pad(new Date(r).getHours())}:${pad(new Date(r).getMinutes())}`, row, what: isUsedUp(row, now) ? '소진 풀림' : '주간 초기화' });
    }
    const dd = nextBill(row.billDay, now);
    if (dd !== null && dd <= 6) add(dd, { t: today.getTime() + dd * DAY_MS, time: '결제', row, what: num(row.price) !== null ? money(row.price, row.currency) : '결제일' });
  }
  return [...days.entries()].sort((a, b) => a[0] - b[0]).map(([index, items]) => ({ index, items: items.sort((a, b) => a.t - b.t) }));
}

/* ---------- 글자 ---------- */
export function rel(ms) {
  if (!Number.isFinite(ms) || ms < 60000) return '1분 안';
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d >= 1) return h % 24 ? `${d}일 ${h % 24}시간` : `${d}일`;
  if (h >= 1) return m % 60 ? `${h}시간 ${m % 60}분` : `${h}시간`;
  return `${m}분`;
}
const when = t => { const d = new Date(t); return `${DAY[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const full = t => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const stamp = (t, now) => { const d = new Date(t), n = new Date(now), hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`; return d.toDateString() === n.toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`; };
export function money(amount, currency) {
  if (amount === null || amount === undefined) return '';
  return currency === 'USD' ? `$${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `₩${Math.round(Number(amount)).toLocaleString('ko-KR')}`;
}
const pair = (krw, usd) => [krw ? money(krw, 'KRW') : '', usd ? money(usd, 'USD') : ''].filter(Boolean).join(' + ');
const credits = v => (Math.abs(v) < 10 ? Number(v).toFixed(2).replace(/\.?0+$/, '') : Math.round(v).toLocaleString('ko-KR'));
const WINDOW_NAME = { session: '5시간', weekly: '주간' };
// 「· 4일 19시간 뒤」가 좁은 칸에서 「뒤」나 「·」만 홀로 남지 않게 띄어쓰기를 붙인다.
const keep = text => text.replace(/ /g, '\u00a0');
const leftHtml = w => (w.left <= 0 ? '<b class="ms-alert-text">소진</b>' : `<b class="ms-num${w.left <= 10 ? ' ms-warn-text' : ''}">${w.left}%</b> 남음`);
// 고리 그림(viewBox 120): 바깥 주간 · 안 5시간. 남은 만큼 12시 방향에서 시계 방향으로 찬다. 서비스 줄의 작은 고리는 굵게.
// 97% 넘게 남으면 둥근 끝이 맞닿아 닫혀 보여 각진 끝으로, 100%는 이음매 없는 닫힌 원으로 그린다.
const RINGS = { full: { weekly: 54, session: 43, width: 8 }, mini: { weekly: 46, session: 46, width: 20 } };
function ringsSvg(g, size = 'full') {
  const spec = RINGS[size];
  const ring = key => {
    const w = g[key]; if (!w) return '';
    const level = gaugeLevel(w), attrs = `cx="60" cy="60" r="${spec[key]}" stroke-width="${spec.width}"`;
    return `<circle class="ms-track" data-level="${level}" ${attrs}/>${w.left > 0 ? `<circle class="ms-arc" data-ring="${key}" data-level="${level}" ${attrs}${w.left >= 100 ? ' data-full' : ` stroke-linecap="${w.left >= 97 ? 'butt' : 'round'}" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="${100 - w.left}" transform="rotate(-90 60 60)"`}/>` : ''}`;
  };
  return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">${ring('weekly')}${ring('session')}</svg>`;
}
const gauge = (g, key, label) => { const w = g[g.focus]; return `<span class="ms-gauge" data-level="${gaugeLevel(w)}">${ringsSvg(g)}<span class="ms-gauge-center"><b class="ms-gauge-num" data-roll="${esc(key)}">${w.left}<small>%</small></b><span>${WINDOW_NAME[g.focus]}${label ? (w.left <= 0 ? ' 소진' : ' 남음') : ''}</span></span></span>`; };
const miniGauge = (g, key) => `<span class="ms-gauge ms-gauge-mini" data-level="${gaugeLevel(g[key])}">${ringsSvg({ [key]: g[key] }, 'mini')}</span>`;
const untilReset = (g, now) => (g.resetsAt ? `${WINDOW_NAME[g.focus]} 초기화까지 <b>${rel(g.resetsAt - now)}</b>` : g[g.focus].used === 0 ? '아직 안 씀' : '초기화 시각 없음');

// 숫자 굴림(WORLD world-motion.mjs의 roll과 같은 문법): 숫자 글자는 그대로 두고(투명), 그 위에 0~9 띠를 굴린다.
const motionOn = () => typeof matchMedia === 'function' && document.documentElement?.dataset?.motion !== 'reduced' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
function roll(el, { delay = 0, duration = 1000 } = {}) {
  const nodes = [], walk = n => { for (const c of [...n.childNodes]) { if (c.nodeType === 3) nodes.push(c); else if (c.nodeType === 1) walk(c); } };
  walk(el);
  let k = 0;
  for (const node of nodes) {
    if (!/\d/.test(node.textContent)) continue;
    const frag = document.createDocumentFragment();
    for (const ch of node.textContent) {
      if (!/\d/.test(ch)) { frag.append(ch); continue; }
      const d = document.createElement('span'); d.className = 'ms-roll'; d.style.setProperty('--d', ch);
      const t = document.createElement('span'); t.className = 'ms-roll-t'; t.textContent = ch;
      const strip = document.createElement('i'); strip.setAttribute('aria-hidden', 'true'); strip.style.setProperty('--rd', `${delay + k * 120}ms`); strip.style.setProperty('--rt', `${duration + k * 160}ms`);
      d.append(t, strip); frag.append(d); k++;
    }
    node.replaceWith(frag);
  }
}
const svcClass = service => (Object.hasOwn(AUTO, service) ? 'ms-s-' + service : 'ms-s-other');
const stateChip = row => row.source !== 'auto' ? '<span class="ms-chip ms-chip-manual">직접 넣음</span>'
  : row.state === 'ok' ? '<span class="ms-chip ms-chip-ok">연결됨</span>'
    : row.state === 'needs-login' ? '<span class="ms-chip ms-chip-alert">다시 로그인</span>'
      : row.state === 'error' ? '<span class="ms-chip ms-chip-warn">읽기 실패</span>' : '<span class="ms-chip">확인 전</span>';
const arrowBack = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>';

/* ---------- 화면 ---------- */
export function createSubscriptionsBoard({ bridge, toast = () => {} } = {}) {
  const api = bridge?.subscriptions;
  let snapshot = null, container = null, visible = false, context = { signedIn: false, native: false }, loadError = null, timer = null, busy = '';
  const ui = { open: new Set(), guide: null, editing: null, removeArmed: null, manualOpen: false, email: '', code: '', key: '', help: false };
  const rolled = new Map();
  api?.onChanged?.(value => { if (value?.ok) { snapshot = value; if (visible) paint(); } });

  async function load(refreshTools = false) {
    if (!api) return;
    try { const value = await api.snapshot({ refreshTools }); if (value?.ok) { snapshot = value; loadError = null; } else loadError = CODE_TEXT[value?.code] || '계정판을 불러오지 못했어요.'; }
    catch { loadError = '계정판을 불러오지 못했어요. 다시 시도해 주세요.'; }
    if (visible) paint();
  }
  async function act(name, task) {
    if (busy) return; busy = name; paint();
    try { const result = await task(); if (result && result.ok === false) toast(CODE_TEXT[result.code] || result.error?.message || '요청을 마치지 못했어요. 다시 시도해 주세요.'); else if (result?.rows) snapshot = result; return result; }
    catch { toast('요청을 마치지 못했어요. 다시 시도해 주세요.'); }
    finally { busy = ''; paint(); }
  }

  function bind(el) {
    if (el.dataset.subsBound === 'true') return; el.dataset.subsBound = 'true';
    el.addEventListener('click', event => { if (!visible) return; const b = event.target.closest('[data-subs]'); if (b && !b.disabled) onAction(b.dataset.subs, b.dataset); });
    el.addEventListener('submit', event => { if (!visible) return; const form = event.target.closest('form[data-subs-form]'); if (!form) return; event.preventDefault(); onForm(form.dataset.subsForm, form); });
    el.addEventListener('input', event => { if (!visible) return; if (event.target.id === 'ms-email') ui.email = event.target.value; if (event.target.id === 'ms-code') ui.code = event.target.value; if (event.target.id === 'ms-key') ui.key = event.target.value; if (event.target.id === 'ms-manual-label') { const k = MANUAL_KIND[event.target.value.trim().toLowerCase().replace(/\s+/g, '')]; const kind = el.querySelector('#ms-manual-kind'); if (k && kind) { kind.value = k; el.querySelector('.ms-manual')?.setAttribute('data-kind', k); } } });
    el.addEventListener('change', event => { if (!visible) return; if (event.target.matches('[data-kind-select]')) event.target.closest('form')?.setAttribute('data-kind', event.target.value); if (event.target.id === 'ms-rate') void act('rate', () => api.save({ settings: { usdKrw: Number(event.target.value) } })); });
  }
  function onAction(name, data) {
    const id = data.id, service = data.service;
    if (name === 'check') return void act('check', () => api.check());
    if (name === 'recheck-tools') return void act('tools', async () => { await load(true); toast('설치 상태를 다시 확인했어요.'); });
    if (name === 'toggle') { ui.open.has(id) ? ui.open.delete(id) : ui.open.add(id); return paint(); }
    if (name === 'jump') { ui.open.add(id); paint(); container?.querySelector(`[data-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    if (name === 'guide') { ui.guide = service || 'claude'; ui.email = ''; ui.code = ''; paint(); container?.querySelector('#ms-guide')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (name === 'close-guide') { ui.guide = null; ui.guideClosed = true; return paint(); }
    if (name === 'install') return void act('install', async () => { const r = await api.install(service); if (r?.ok) toast(`${AUTO[service].tool} 설치 창을 열었어요. 끝나면 「다시 확인」을 눌러 주세요.`); return r; });
    if (name === 'copy') { const text = AUTO[service]?.install; if (text) navigator.clipboard?.writeText(text).then(() => toast('설치 명령을 복사했어요. PowerShell에 붙여 넣어 주세요.'), () => toast('복사하지 못했어요. 명령을 직접 선택해 복사해 주세요.')); return; }
    if (name === 'help') return void api.help(data.link);
    if (name === 'existing') return void act('existing', async () => { const r = await api.useExisting(service); if (r?.ok) { toast(`${AUTO[service].label} 계정을 연결했어요.`); ui.guide = null; } return r; });
    if (name === 'login') return void act('login', () => api.login(service, { email: service === 'claude' ? ui.email.trim() || undefined : undefined }));
    if (name === 'console-login') return void act('login', () => api.login(service, { email: service === 'claude' ? ui.email.trim() || undefined : undefined, console: true }));
    if (name === 'open-url') return void api.openLoginUrl(snapshot?.login?.id);
    // 브라우저에 남은 다른 계정으로 승인되지 않게, 로그인 주소를 시크릿 창에 붙여 넣을 수 있게 한다.
    if (name === 'copy-url') { const url = snapshot?.login?.url; if (url) navigator.clipboard?.writeText(url).then(() => toast('로그인 주소를 복사했어요. 시크릿 창(Ctrl+Shift+N) 주소창에 붙여 넣어 주세요.'), () => toast('복사하지 못했어요. 「로그인 페이지 다시 열기」를 써 주세요.')); return; }
    if (name === 'cancel-login') return void act('cancel', () => api.cancel(snapshot?.login?.id));
    if (name === 'relogin') { const row = rowById(id); if (row) { ui.guide = row.service; ui.email = row.email || ''; paint(); container?.querySelector('#ms-guide')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); } return; }
    if (name === 'edit') { ui.editing = ui.editing === id ? null : id; return paint(); }
    if (name === 'remove') { if (ui.removeArmed !== id) { ui.removeArmed = id; return paint(); } ui.removeArmed = null; return void act('remove', () => api.save({ remove: id })); }
    if (name === 'used') { const row = rowById(id); if (row) return void act('used', () => api.save({ row: { id, usedUpAt: isUsedUp(row, Date.now()) ? null : Date.now() } })); }
    if (name === 'manual') { ui.manualOpen = !ui.manualOpen; return paint(); }
    if (name === 'help-toggle') { ui.help = !ui.help; return paint(); }
  }
  function formValues(form) {
    const get = n => form.querySelector(`[name="${n}"]`)?.value ?? '';
    const kind = get('kind'), time = get('time') || '00:00', [h, m] = time.split(':').map(x => parseInt(x, 10) || 0), day = get('day');
    return { label: get('label').trim(), kind, price: num(get('price')), currency: get('currency') === 'USD' ? 'USD' : 'KRW', billDay: num(get('bill')), credits: kind === 'credit' ? num(get('credits')) : null, lowAt: kind === 'credit' ? num(get('low')) : null, note: get('note').trim(), resetDay: kind === 'weekly' && day !== '' ? Number(day) : null, resetHour: kind === 'weekly' && day !== '' ? h : null, resetMinute: kind === 'weekly' && day !== '' ? m : null };
  }
  function onForm(name, form) {
    if (name === 'code') { const code = ui.code.trim(); if (!code) return toast('브라우저에 보이는 코드를 붙여 넣어 주세요.'); return void act('code', async () => { const r = await api.submitCode(snapshot?.login?.id, code); if (r?.ok) ui.code = ''; return r; }); }
    if (name === 'key') { const key = ui.key.trim(), service = form.dataset.service; if (!key) return toast('복사한 API 키를 붙여 넣어 주세요.'); return void act('key', async () => { const r = await api.connectKey(service, key); if (!r?.ok) return r; ui.key = ''; ui.guide = null; toast(`${AUTO[service]?.label || ''} 키를 연결했어요. 남은 크레딧을 읽었어요.`); return r.snapshot || r; }); }
    if (name === 'manual') { const v = formValues(form); if (!v.label) return toast(CODE_TEXT.LABEL_REQUIRED); return void act('manual', async () => { const r = await api.save({ add: v }); if (r?.rows) { ui.manualOpen = false; toast(`${v.label}를 넣었어요.`); } return r; }); }
    if (name === 'edit') { const id = form.dataset.id, row = rowById(id); if (!row) return; const v = formValues(form); const patch = { id, price: v.price, currency: v.currency, billDay: v.billDay, note: v.note }; if (row.source === 'manual') Object.assign(patch, { label: v.label || row.label, kind: v.kind, resetDay: v.resetDay, resetHour: v.resetHour, resetMinute: v.resetMinute }); if ((row.kind === 'credit' || v.kind === 'credit') && row.source === 'manual') Object.assign(patch, { credits: v.credits, lowAt: v.lowAt }); else if (row.kind === 'credit') patch.lowAt = v.lowAt; return void act('edit', async () => { const r = await api.save({ row: patch }); if (r?.rows) { ui.editing = null; toast('저장했어요.'); } return r; }); }
  }
  const rowById = id => snapshot?.rows?.find(row => row.id === id) || null;

  /* 부분 화면 */
  function hero(now) {
    const check = snapshot?.check, rows = snapshot?.rows || [], auto = rows.filter(r => r.source === 'auto').length;
    const note = !context.native ? 'SYNK Platform PC 앱에서 쓸 수 있어요.' : !context.signedIn ? 'SYNK ID로 로그인하면 바로 시작할 수 있어요.' : snapshot?.checking ? '공식 프로그램으로 읽는 중이에요…' : check?.at ? `마지막 확인 ${stamp(check.at, now)} · ${check.ok}/${check.total}개 읽음` : auto ? '「지금 확인」을 누르면 연결한 계정을 한꺼번에 읽어요.' : '처음이라면 아래 가이드를 따라 첫 계정을 연결해 보세요.';
    const actions = context.native && context.signedIn && snapshot
      ? `<button type="button" class="ms-button ms-button-primary" data-subs="check" ${busy || snapshot.checking || !auto ? 'disabled' : ''}>${snapshot.checking || busy === 'check' ? '확인 중…' : '지금 확인'}</button><button type="button" class="ms-button" data-subs="guide" data-service="claude">계정 연결</button>`
      : context.native && !context.signedIn ? '<button type="button" class="ms-button ms-button-primary" data-insight-action="account">SYNK ID로 로그인</button>' : '';
    return `<button type="button" class="ms-back" data-view="benefits">${arrowBack}회원 혜택 모두 보기</button>
      <header class="ms-hero">
        <span class="ms-eyebrow">SYNK FOR YOU / AI 구독 계정판</span>
        <div class="ms-hero-title"><h1 id="benefit-title" tabindex="-1">구독</h1><p>흩어진 AI 구독,<br>이번 주 얼마 남았는지 한 번에.</p></div>
        <div class="ms-hero-note"><span>${esc(note)}</span><div class="ms-hero-actions">${actions}</div></div>
      </header>`;
  }
  // 서비스 하나에 고리 하나: 지금 가장 여유 있는 계정의 남은 한도. 누르면 그 계정을 펼친다.
  function meter(list, now) {
    const row = roomiest(list, now), g = row && limitGauge(row, now);
    if (!g) return '';
    const name = row.email ? row.email.split('@')[0] : '';
    const legend = ['weekly', 'session'].filter(k => g[k]).map(k => `<span class="ms-legend-row" data-ring="${k}" data-level="${gaugeLevel(g[k])}"><i aria-hidden="true"></i>${WINDOW_NAME[k]}<span>${leftHtml(g[k])}</span></span>`).join('');
    return `<button type="button" class="ms-meter ${svcClass(row.service)}" data-subs="jump" data-id="${esc(row.id)}">${gauge(g, 'm-' + (row.source === 'auto' ? row.service : row.label), true)}
      <span class="ms-meter-body"><span class="ms-meter-head"><span class="ms-tag">${esc(row.label)}</span>${name ? `<strong>${esc(name)}</strong>` : ''}</span>${list.length > 1 ? `<span class="ms-meter-note">계정 ${list.length}개 중 가장 여유</span>` : ''}<span class="ms-legend">${legend}</span><span class="ms-reset">${untilReset(g, now)}</span></span><span class="ms-chev" aria-hidden="true"></span></button>`;
  }
  function attentionSection(rows, now) {
    const items = attention(rows, now), groups = new Map();
    for (const row of rows) if (row.kind === 'weekly') { const key = row.source === 'auto' ? row.service : row.label; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); }
    const meters = [...groups.values()].map(list => meter(list, now)).filter(Boolean).join('');
    const chips = items.length ? `<div class="ms-attn">${items.map(item => `<button type="button" class="ms-attn-chip ms-l${item.level}" data-subs="jump" data-id="${esc(item.id)}"><span class="ms-dot" aria-hidden="true"></span>${esc(item.text)}</button>`).join('')}</div>`
      : '<p class="ms-clear">지금 챙길 건 없어요. 소진된 계정도, 3일 안 결제도 없어요.</p>';
    const description = meters ? '서비스마다 가장 여유 있는 계정의 남은 한도예요(안쪽 고리 5시간 · 바깥쪽 주간). 소진·10% 이하 남음·크레딧 부족·3일 안 결제는 따로 올라와요.' : '소진·10% 이하 남음·크레딧 부족·3일 안 결제만 올라와요.';
    return section('01', '지금 볼 것', description, (meters ? `<div class="ms-meters">${meters}</div>` : '') + chips);
  }
  function rowLine(row, now) {
    const lines = [];
    if (row.kind === 'weekly') {
      const wp = liveWeekly(row, now), g = limitGauge(row, now), r = nextReset(row, now);
      if (g?.weekly) { const started = wp !== null && row.live.weekly.resetsAt ? row.live.weekly.resetsAt - 7 * DAY_MS : null; lines.push(`주간 ${leftHtml(g.weekly)}${started && now - started < DAY_MS ? ` <span class="ms-soft">(${stamp(started, now)} 새 주 시작)</span>` : ''}`); }
      if (g?.session) lines.push(`5시간 ${leftHtml(g.session)}${g.session.resetsAt ? ` <span class="ms-soft">${keep('· ' + rel(g.session.resetsAt - now) + ' 뒤 풀림')}</span>` : ''}`);
      for (const model of row.live?.models || []) if (Number.isFinite(model.usedPercent)) { const used = Math.min(100, Math.max(0, model.usedPercent)); lines.push(`${esc(model.name)} 주간 ${leftHtml({ used, left: leftPercent(used) })}`); }
      lines.push(r ? `매주 ${when(r)} 초기화 <span class="ms-soft">${keep('· ' + rel(r - now) + ' 뒤')}</span>` : wp === 0 ? '<span class="ms-soft">아직 안 씀 · 쓰기 시작하면 주간 한도 기간이 시작돼요</span>' : '<span class="ms-soft">초기화 시각 없음</span>');
      if (isUsedUp(row, now)) lines.push(`<span class="ms-alert-text">${r ? full(r) + '에 풀림' : '소진 해제는 직접 눌러 주세요'}</span>`);
    }
    if (row.kind === 'credit') { const b = balance(row); lines.push(b ? `잔액 <b class="ms-num${isLow(row) ? ' ms-warn-text' : ''}">${credits(b.value)}</b> <span class="ms-soft">· ${b.source === 'live' ? '공식값' : '직접 넣음'}${b.at ? ' ' + stamp(b.at, now) : ''}</span>` : '<span class="ms-soft">잔액 미입력</span>'); }
    const pay = [num(row.price) !== null ? `월 ${money(row.price, row.currency)}` : '', row.billDay ? `결제 매월 ${row.billDay}일 (${nextBill(row.billDay, now) === 0 ? '오늘' : 'D-' + nextBill(row.billDay, now)})` : ''].filter(Boolean);
    if (pay.length) lines.push(pay.join(' · '));
    if (row.state && row.state !== 'ok' && row.stateMessage) lines.push(`<span class="ms-warn-text">${esc(row.stateMessage)}</span>`);
    if (row.live?.readAt) lines.push(`<span class="ms-soft${now - row.live.readAt > 12 * 3600e3 ? ' ms-alert-text' : ''}">${stamp(row.live.readAt, now)} 확인${row.plan ? ' · ' + esc(row.plan) : ''}</span>`);
    if (row.note) lines.push(`<span class="ms-soft">${esc(row.note)}</span>`);
    return lines.map(line => `<div>${line}</div>`).join('');
  }
  function editForm(row) {
    const v = x => (x === null || x === undefined ? '' : esc(x)), manual = row.source === 'manual';
    return `<form class="ms-form ms-edit" data-subs-form="edit" data-id="${esc(row.id)}" data-kind="${esc(row.kind)}">
      ${manual ? `<label>서비스 이름<input name="label" value="${v(row.label)}" maxlength="40"></label><label>한도 종류<select name="kind" data-kind-select>${KINDS.map(([k, t]) => `<option value="${k}"${k === row.kind ? ' selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
      ${manual ? `<label class="ms-only-weekly">초기화 요일<select name="day"><option value="">없음</option>${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}"${row.resetDay === d ? ' selected' : ''}>${DAY[d]}요일</option>`).join('')}</select></label><label class="ms-only-weekly">초기화 시각<input name="time" type="time" value="${hasReset(row) ? pad(row.resetHour || 0) + ':' + pad(row.resetMinute || 0) : ''}"></label><label class="ms-only-credit">지금 잔액<input name="credits" type="number" step="any" value="${v(row.credits)}"></label>` : ''}
      ${row.kind === 'credit' || manual ? `<label class="ms-only-credit">부족 기준(이하면 알림)<input name="low" type="number" step="any" value="${v(row.lowAt)}" placeholder="비우면 1 이하"></label>` : ''}
      <label>월 구독료<span class="ms-pair"><input name="price" type="number" min="0" step="any" value="${v(row.price)}" placeholder="29000"><select name="currency" aria-label="통화"><option value="KRW"${row.currency !== 'USD' ? ' selected' : ''}>원</option><option value="USD"${row.currency === 'USD' ? ' selected' : ''}>달러</option></select></span></label>
      <label>결제일(매월)<input name="bill" type="number" min="1" max="31" value="${v(row.billDay)}" placeholder="3"></label>
      <label class="ms-wide">메모<input name="note" value="${v(row.note)}" maxlength="120" placeholder="회사 카드로 결제"></label>
      <div class="ms-wide ms-form-actions"><button type="submit" class="ms-button ms-button-primary">저장</button><button type="button" class="ms-button" data-subs="edit" data-id="${esc(row.id)}">닫기</button></div>
    </form>`;
  }
  function serviceSection(rows, now) {
    const groups = new Map();
    for (const row of rows) { const key = row.kind || 'plan'; if (!groups.has(key)) groups.set(key, new Map()); const g = groups.get(key), name = row.source === 'auto' ? row.service : row.label; if (!g.has(name)) g.set(name, []); g.get(name).push(row); }
    const body = KINDS.filter(([k]) => groups.has(k)).map(([kind, title, sub]) => `<div class="ms-group"><h3>${title} <span>${sub}</span></h3><div class="ms-table">${[...groups.get(kind).values()].map(list => serviceBlock(list, now)).join('')}</div></div>`).join('');
    const cost = costSummary(rows, now, snapshot?.settings?.usdKrw);
    const costHtml = cost.count ? `<div class="ms-metrics">
        <div class="ms-metric"><span>한 달 구독료</span><strong class="ms-num">약 ${money(cost.approx, 'KRW')}</strong><small>${esc(pair(cost.krw, cost.usd) || '0')} · 구독 ${cost.count}개</small></div>
        <div class="ms-metric"><span>7일 안 결제</span><strong class="ms-num">${cost.soon}건</strong><small>${cost.soon ? esc(pair(cost.soonKrw, cost.soonUsd)) : '다음 7일은 결제가 없어요'}</small></div>
        <div class="ms-metric"><span>달러 환산 기준</span><label class="ms-rate">1달러 = <input id="ms-rate" type="number" min="1" step="1" value="${esc(snapshot?.settings?.usdKrw || 1400)}"> 원</label><small>합계의 '약' 금액에만 써요</small></div>
      </div>` : '<p class="ms-soft ms-cost-empty">구독마다 「요금·결제일」에 월 구독료를 넣으면 한 달 합계와 다가오는 결제가 여기 보여요.</p>';
    return section('02', '서비스', '줄을 누르면 계정별로 펼쳐져요.', (body || '<p class="ms-soft">아직 넣은 구독이 없어요.</p>') + costHtml + manualForm());
  }
  function serviceBlock(list, now) {
    const first = list[0], kind = first.kind;
    const usedN = list.filter(r => isUsedUp(r, now)).length, lowN = list.filter(isLow).length, alertN = list.filter(r => r.source === 'auto' && r.state !== 'ok' && r.state !== 'unknown').length;
    let status = '';
    if (kind === 'weekly') { const best = roomiest(list, now) || first, g = limitGauge(best, now); const key = g && (g.weekly ? 'weekly' : 'session'); status = `<b>${esc(best.email ? best.email.split('@')[0] : best.label)}</b>${g ? ` ${miniGauge(g, key)}${WINDOW_NAME[key]} ${leftHtml(g[key])}` : ''}${list.length > 1 ? ` <span class="ms-soft">가장 여유 있는 계정</span>` : ''}`; }
    else if (kind === 'credit') { const b = balance(first); status = `<b>${esc(first.email ? first.email.split('@')[0] : first.label)}</b> · ${b ? `<span class="${isLow(first) ? 'ms-warn-text' : ''}">${credits(b.value)}</span>` : '<span class="ms-soft">잔액 미입력</span>'}${list.length > 1 ? ` <span class="ms-soft">외 ${list.length - 1}</span>` : ''}`; }
    else status = list.slice(0, 2).map(r => `<b>${esc(r.email ? r.email.split('@')[0] : r.label)}</b>`).join(', ') + (list.length > 2 ? ` <span class="ms-soft">외 ${list.length - 2}</span>` : '');
    const flags = [usedN ? `<span class="ms-alert-text">소진 ${usedN}</span>` : '', lowN ? `<span class="ms-warn-text">부족 ${lowN}</span>` : '', alertN ? `<span class="ms-warn-text">확인 필요 ${alertN}</span>` : ''].filter(Boolean).join(' · ');
    const resets = kind === 'weekly' ? list.map(r => nextReset(r, now)).filter(Boolean).sort((a, b) => a - b) : [];
    const bills = list.map(r => nextBill(r.billDay, now)).filter(d => d !== null).sort((a, b) => a - b);
    const next = kind === 'weekly' ? (resets.length ? `${when(resets[0])} 초기화` : '초기화 시각 없음') : (bills.length ? `결제 ${bills[0] === 0 ? '오늘' : 'D-' + bills[0]}` : '결제일 없음');
    let krw = 0, usd = 0; for (const r of list) if (num(r.price) !== null) { if (r.currency === 'USD') usd += Number(r.price); else krw += Number(r.price); }
    const id = 'g-' + (first.source === 'auto' ? first.service : first.label), open = ui.open.has(id) || list.some(r => ui.open.has(r.id));
    return `<div class="ms-block${open ? ' open' : ''} ${svcClass(first.service)}">
      <button type="button" class="ms-row" data-subs="toggle" data-id="${esc(id)}" aria-expanded="${open}">
        <span class="ms-tag">${esc(first.source === 'auto' ? first.label : first.label)}</span>
        <span class="ms-count">계정 ${list.length}</span>
        <span class="ms-status">${status}${flags ? ' · ' + flags : ''}</span>
        <span class="ms-next">${next}</span>
        <span class="ms-price ms-num">${esc(pair(krw, usd)) || '<span class="ms-soft">요금 없음</span>'}</span>
        <span class="ms-chev" aria-hidden="true"></span>
      </button>
      ${open ? `<div class="ms-detail">${list.map(r => accountRow(r, now)).join('')}</div>` : ''}
    </div>`;
  }
  function accountRow(row, now) {
    const armed = ui.removeArmed === row.id, g = limitGauge(row, now);
    return `<div class="ms-account${g ? ' has-gauge' : ''}" data-row="${esc(row.id)}">${g ? gauge(g, 'a-' + row.id, false) : ''}
      <div class="ms-account-name"><strong>${esc(accountName(row))}</strong>${stateChip(row)}${isUsedUp(row, now) ? '<span class="ms-chip ms-chip-alert">소진</span>' : g && gaugeLevel(g[g.focus]) === 'low' ? '<span class="ms-chip ms-chip-warn">거의 소진</span>' : ''}${isLow(row) ? '<span class="ms-chip ms-chip-warn">부족</span>' : ''}</div>
      <div class="ms-account-info">${rowLine(row, now)}</div>
      <div class="ms-account-actions">
        ${row.source === 'auto' && row.state === 'needs-login' ? `<button type="button" class="ms-button ms-button-small ms-button-primary" data-subs="relogin" data-id="${esc(row.id)}">다시 연결</button>` : ''}
        ${row.kind === 'weekly' && row.source === 'manual' ? `<button type="button" class="ms-button ms-button-small" data-subs="used" data-id="${esc(row.id)}">${isUsedUp(row, now) ? '소진 풀기' : '소진 표시'}</button>` : ''}
        <button type="button" class="ms-button ms-button-small" data-subs="edit" data-id="${esc(row.id)}" aria-expanded="${ui.editing === row.id}">요금·결제일</button>
        <button type="button" class="ms-button ms-button-small${armed ? ' ms-button-danger' : ''}" data-subs="remove" data-id="${esc(row.id)}">${armed ? '한 번 더 누르면 지워요' : '지우기'}</button>
      </div>
      ${ui.editing === row.id ? editForm(row) : ''}
    </div>`;
  }
  function manualForm() {
    if (!ui.manualOpen) return '<div class="ms-manual-open"><button type="button" class="ms-button" data-subs="manual">Suno·Hugging Face처럼 자동으로 못 읽는 구독 직접 넣기</button></div>';
    return `<form class="ms-form ms-manual" data-subs-form="manual" data-kind="plan">
      <h3 class="ms-wide">직접 넣는 구독</h3>
      <label>서비스 이름<input id="ms-manual-label" name="label" list="ms-names" maxlength="40" placeholder="Suno" required></label>
      <datalist id="ms-names">${MANUAL_NAMES.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
      <label>한도 종류<select id="ms-manual-kind" name="kind" data-kind-select>${KINDS.map(([k, t]) => `<option value="${k}"${k === 'plan' ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="ms-only-weekly">초기화 요일<select name="day"><option value="">없음</option>${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}">${DAY[d]}요일</option>`).join('')}</select></label>
      <label class="ms-only-weekly">초기화 시각<input name="time" type="time"></label>
      <label class="ms-only-credit">지금 잔액<input name="credits" type="number" step="any" placeholder="2350"></label>
      <label class="ms-only-credit">부족 기준<input name="low" type="number" step="any" placeholder="비우면 1 이하"></label>
      <label>월 구독료<span class="ms-pair"><input name="price" type="number" min="0" step="any" placeholder="29000"><select name="currency" aria-label="통화"><option value="KRW">원</option><option value="USD">달러</option></select></span></label>
      <label>결제일(매월)<input name="bill" type="number" min="1" max="31" placeholder="3"></label>
      <label class="ms-wide">메모<input name="note" maxlength="120" placeholder="계정 이메일이나 결제 카드"></label>
      <div class="ms-wide ms-form-actions"><button type="submit" class="ms-button ms-button-primary">넣기</button><button type="button" class="ms-button" data-subs="manual">닫기</button></div>
    </form>`;
  }
  function agendaSection(rows, now) {
    const days = agenda(rows, now), today = new Date(now); today.setHours(0, 0, 0, 0);
    const label = i => i === 0 ? '오늘' : i === 1 ? '내일' : (d => `${DAY[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`)(new Date(today.getTime() + i * DAY_MS));
    const body = days.length ? `<div class="ms-agenda">${days.map(day => `<div class="ms-day"><strong>${label(day.index)}</strong><div>${day.items.map(item => `<div class="ms-day-item ${svcClass(item.row.service)}"><span class="ms-num">${esc(item.time)}</span><span class="ms-tag">${esc(item.row.label)}</span><span>${esc(item.row.email ? item.row.email.split('@')[0] : '')} ${esc(item.what)}</span></div>`).join('')}</div></div>`).join('')}</div>`
      : '<p class="ms-soft">앞으로 7일 동안 주간 초기화나 결제가 없어요.</p>';
    return section('03', '앞으로 7일', '주간 초기화와 결제일을 날짜별로 모았어요.', body);
  }
  function connectSection() {
    const tools = snapshot?.tools || {}, rows = snapshot?.rows || [];
    const cards = Object.entries(AUTO).map(([key, info]) => {
      const tool = tools[key], count = rows.filter(r => r.source === 'auto' && r.service === key).length;
      const chip = info.key ? '<span class="ms-chip ms-chip-ok">설치 필요 없음</span>' : !tool ? '<span class="ms-chip">확인 중</span>' : tool.installed ? `<span class="ms-chip ms-chip-ok">설치됨</span>` : '<span class="ms-chip ms-chip-warn">설치 필요</span>';
      return `<div class="ms-connect ${svcClass(key)}"><div><span class="ms-tag">${esc(info.label)}</span>${chip}</div><p>${esc(info.tool)} · 연결한 ${info.key ? '키' : '계정'} ${count}개${tool?.version ? `<br><span class="ms-soft ms-num">${esc(tool.version)}</span>` : ''}</p><button type="button" class="ms-button${ui.guide === key ? ' ms-button-primary' : ''}" data-subs="guide" data-service="${key}">${count ? (info.key ? '키 더 넣기' : '계정 더 연결') : '연결 시작'}</button></div>`;
    }).join('');
    return section('04', '연결과 가이드', '공식 프로그램이 이 PC에서 사용량을 읽어요. 로그인 정보는 이 PC 밖으로 나가지 않아요.', `<div class="ms-connects">${cards}</div>${ui.guide ? guide(ui.guide) : ''}${troubleshooting()}`);
  }
  const step = (n, title, state, body) => `<li class="ms-step ms-step-${state}"><span class="ms-step-mark ms-num" aria-hidden="true">${state === 'done' ? '✓' : n}</span><div><h4>${title}</h4>${body}</div></li>`;
  const guideFrame = (info, steps) => `<div class="ms-guide" id="ms-guide"><div class="ms-guide-head"><h3>${esc(info.label)} 연결 가이드</h3><button type="button" class="ms-link" data-subs="close-guide">닫기</button></div><ol>${steps}</ol></div>`;
  // API 키로 읽는 서비스: 설치·로그인 대신 키 페이지 열기 → 붙여 넣기.
  function keyGuide(key) {
    const info = AUTO[key];
    return guideFrame(info, step(1, '요금제 확인', 'done', `<p>${esc(info.plan)}</p>`)
      + step(2, 'API 키 복사', 'now', `<p>아래 단추로 Typecast API 키 페이지를 열고 로그인해요. 이미 있는 키를 복사해 와도 돼요. 키를 새로 만들면 예전 키는 더 이상 쓸 수 없어요.</p><div class="ms-inline"><button type="button" class="ms-button" data-subs="help" data-link="${esc(info.planLink)}">API 키 페이지 열기</button></div>`)
      + step(3, '키 붙여 넣기', 'now', `<form class="ms-code" data-subs-form="key" data-service="${esc(key)}"><label for="ms-key">${esc(info.label)} API 키</label><div class="ms-inline"><input id="ms-key" type="password" autocomplete="off" spellcheck="false" value="${esc(ui.key)}" placeholder="복사한 키를 붙여 넣기 (Ctrl+V)"><button type="submit" class="ms-button ms-button-primary" ${busy ? 'disabled' : ''}>연결</button></div><p class="ms-soft">키는 ${esc(info.label)}에 남은 크레딧을 물을 때만 쓰고 이 PC에 암호화해 둬요. 화면에는 끝 네 글자만 보여요.</p></form>`)
      + step(4, '첫 확인', 'wait', '<p>연결하면 바로 남은 크레딧을 읽어요. 다음부터는 맨 위 「지금 확인」 한 번이면 같이 다시 읽어요.</p>'));
  }
  function guide(key) {
    const info = AUTO[key];
    if (info.key) return keyGuide(key);
    const tool = snapshot?.tools?.[key], login = snapshot?.login && snapshot.login.service === key ? snapshot.login : null, otherLogin = snapshot?.login && snapshot.login.service !== key && !['done', 'error', 'cancelled'].includes(snapshot.login.stage);
    const installed = !!tool?.installed;
    const check = step(1, '요금제 확인', 'done', `<p>${esc(info.plan)}</p>${info.planLink ? `<button type="button" class="ms-link" data-subs="help" data-link="${info.planLink}">요금제 보기</button>` : ''}`);
    const install = step(2, `${info.tool} 설치`, installed ? 'done' : 'now', installed
      ? `<p>이 PC에 설치돼 있어요${tool.version ? ` (${esc(tool.version)})` : ''}.</p>`
      : `<p>아래 단추를 누르면 파란 PowerShell 창이 열리고 공식 설치 명령이 실행돼요. 관리자 권한은 필요 없어요. 1~2분 동안 아무 표시가 없을 수 있으니 창을 닫지 말고 기다려 주세요.</p>
        ${info.node && !tool?.npm ? `<p class="ms-warn-text">Higgsfield CLI는 Node.js가 먼저 있어야 해요. Node.js(LTS)를 설치한 뒤 이 단계로 돌아오세요.</p><div class="ms-inline"><button type="button" class="ms-button" data-subs="help" data-link="node">Node.js 받기</button></div>` : ''}
        <div class="ms-inline"><button type="button" class="ms-button ms-button-primary" data-subs="install" data-service="${key}" ${busy ? 'disabled' : ''}>설치 창 열기</button><button type="button" class="ms-button" data-subs="recheck-tools">설치 끝났어요 · 다시 확인</button></div>
        <details class="ms-cmd"><summary>직접 붙여 넣고 싶다면</summary><code>${esc(info.install)}</code><button type="button" class="ms-link" data-subs="copy" data-service="${key}">명령 복사</button> <button type="button" class="ms-link" data-subs="help" data-link="${info.installLink}">공식 설치 안내</button></details>`);
    let loginBody;
    if (!installed) loginBody = '<p class="ms-soft">설치가 끝나면 열려요.</p>';
    else if (login && !['done', 'error', 'cancelled'].includes(login.stage) && key === 'gemini') {
      loginBody = `<p>검은 창이 열렸어요. 아래 순서대로 하면 돼요. 창이 안 보이면 아래쪽 작업 표시줄에서 찾아 주세요.</p>
        <ol class="ms-mini-steps">
          <li>검은 창에서 <b>Enter</b>를 눌러 「1. Google OAuth」를 골라요.</li>
          <li>열린 브라우저에서 연결할 Google 계정을 고르고 「로그인」을 눌러요.</li>
          <li>브라우저에 나온 코드를 「클립보드에 복사」하고, 검은 창 안에서 <b>오른쪽 클릭</b>(붙여넣기) 뒤 <b>Enter</b>를 눌러요.</li>
          <li>폴더를 믿겠냐고 물으면 아무거나 골라도 돼요. 로그인은 이미 끝났어요.</li>
        </ol>
        <p class="ms-soft">연결되면 이 화면이 저절로 넘어가요. 그다음 검은 창은 닫아도 돼요.</p>
        <div class="ms-inline"><button type="button" class="ms-link" data-subs="cancel-login">로그인 취소</button></div>`;
    } else if (login && !['done', 'error', 'cancelled'].includes(login.stage)) {
      loginBody = `<p>${esc(login.message || '로그인을 준비하고 있어요.')}</p>
        ${login.url ? '<p class="ms-soft">브라우저가 열리지 않았다면 아래 단추로 다시 열어 주세요. 브라우저에 다른 계정이 이미 로그인돼 있으면 「주소 복사」를 눌러 시크릿 창(Ctrl+Shift+N) 주소창에 붙여 넣고, 연결할 계정으로 로그인해 주세요.</p><div class="ms-inline"><button type="button" class="ms-button" data-subs="open-url">로그인 페이지 다시 열기</button><button type="button" class="ms-button" data-subs="copy-url">주소 복사</button></div>' : ''}
        ${login.needsCode ? `<form class="ms-code" data-subs-form="code"><label for="ms-code">브라우저에 보이는 코드</label><div class="ms-inline"><input id="ms-code" autocomplete="off" spellcheck="false" value="${esc(ui.code)}" placeholder="코드를 붙여 넣기 (Ctrl+V)"><button type="submit" class="ms-button ms-button-primary">연결</button></div></form>` : ''}
        ${key === 'gpt' && login.url ? '<p class="ms-soft">ChatGPT가 휴대폰 인증을 요구하면 안내대로 마쳐 주세요. 끝나면 이 화면이 저절로 넘어가요.</p>' : ''}
        <div class="ms-inline"><button type="button" class="ms-link" data-subs="cancel-login">로그인 취소</button>${key === 'claude' && !login.console ? '<button type="button" class="ms-link" data-subs="console-login">코드가 안 들어가면 · 검은 창으로 로그인하기</button>' : ''}</div>`;
    } else {
      const last = login && ['done', 'error'].includes(login.stage) ? `<p class="${login.stage === 'done' ? 'ms-ok-text' : 'ms-warn-text'}">${esc(login.message)}</p>` : '';
      loginBody = `${last}<p>이미 이 PC에서 ${esc(info.tool)}에 로그인해 쓰고 있다면 그 계정을 바로 가져올 수 있어요. ${info.single ? `처음이라면 「${esc(info.label)} 로그인」을 눌러요.` : '다른 계정은 「새 계정 연결」로 하나씩 더해요.'}</p>
        ${info.email ? `<label class="ms-field" for="ms-email">연결할 이메일 (선택)<input id="ms-email" type="email" autocomplete="email" value="${esc(ui.email)}" placeholder="name@example.com"><small>로그인 화면에 미리 채워져요. 다만 브라우저에 다른 Claude 계정이 이미 로그인돼 있으면 그 계정으로 연결되니, 먼저 브라우저(claude.ai)에서 연결할 계정으로 바꿔 두세요.</small></label>` : ''}
        <div class="ms-inline"><button type="button" class="ms-button" data-subs="existing" data-service="${key}" ${busy || otherLogin ? 'disabled' : ''}>이 PC의 기존 로그인 쓰기</button><button type="button" class="ms-button ms-button-primary" data-subs="login" data-service="${key}" ${busy || otherLogin ? 'disabled' : ''}>${info.single ? `${esc(info.label)} 로그인` : '새 계정 연결'}</button></div>
        ${otherLogin ? '<p class="ms-soft">다른 서비스의 로그인이 진행 중이에요. 끝난 뒤 이어서 해 주세요.</p>' : ''}`;
    }
    const loginState = !installed ? 'wait' : login?.stage === 'done' ? 'done' : 'now';
    const first = step(4, '첫 확인', login?.stage === 'done' ? 'done' : 'wait', '<p>연결하면 바로 사용량을 한 번 읽어요. 다음부터는 맨 위 「지금 확인」 한 번이면 모든 계정을 다시 읽어요.</p>');
    return guideFrame(info, `${check}${install}${step(3, '로그인', loginState, loginBody)}${first}`);
  }
  function troubleshooting() {
    const items = [
      ['설치했는데 「설치 필요」로 나와요', '「설치 끝났어요 · 다시 확인」을 눌러 주세요. 그래도 같으면 SYNK 앱을 완전히 껐다 켜거나 PC를 다시 시작해 주세요. Windows가 새 프로그램 위치를 아직 모를 때 생겨요.'],
      ['로그인 페이지가 열리지 않아요', '가이드의 「로그인 페이지 다시 열기」를 눌러 주세요. 회사·학교 네트워크, VPN, 백신의 웹 보호가 막을 수 있으니 잠시 끄거나 휴대폰 핫스팟으로 다시 해 보세요.'],
      ['다른 계정으로 로그인돼요', '로그인은 브라우저에 지금 로그인된 계정으로 승인돼요. 가장 쉬운 방법은 로그인 단계의 「주소 복사」를 눌러 시크릿 창(Ctrl+Shift+N) 주소창에 붙여 넣고, 연결할 계정으로 로그인하는 거예요. 계정을 여러 개 연결할 때는 하나씩 「새 계정 연결」을 누르고, 시크릿 창은 계정마다 새로 열어 주세요.'],
      ['Typecast 키가 맞지 않대요', 'Typecast API 키 페이지에서 키를 다시 복사해 붙여 넣어 주세요. 키를 새로 만들면 예전 키는 더 이상 안 돼요. 그럴 땐 계정판의 Typecast 줄에서 「다시 연결」을 눌러 새 키를 넣어 주세요.'],
      ['코드를 붙여 넣어도 넘어가지 않아요', '코드 앞뒤 공백 없이 한 번에 붙여 넣어 주세요. 계속 안 되면 「검은 창으로 로그인하기」를 눌러 검은 창에 직접 붙여 넣어 주세요(오른쪽 클릭으로 붙여넣기).'],
      ['「구독 한도가 없어요」라고 나와요', 'Claude Code는 Pro·Max 이상 요금제에서만 쓸 수 있어요. 무료 요금제 계정은 자동으로 읽을 수 없으니 「직접 넣기」로 결제일만 챙겨 주세요.'],
      ['ChatGPT가 휴대폰 인증을 요구해요', 'OpenAI의 보안 절차예요. 브라우저 안내대로 휴대폰 인증을 마치면 Codex 로그인이 이어져요.'],
      ['Gemini 검은 창에서 막혔어요', '검은 창을 한 번 눌러 고른 뒤 Enter를 눌러요. 코드는 Ctrl+V 대신 검은 창 안에서 오른쪽 클릭으로 붙여 넣어요. 브라우저에서 계정을 고를 때 연결할 Google 계정을 눌러 주세요. 이 PC에는 Gemini 계정 하나만 연결돼요.'],
      ['연결을 끊고 싶어요', '서비스 줄을 펼쳐 계정의 「지우기」를 두 번 누르면 이 앱이 만든 로그인 폴더까지 지워요. 기존 로그인을 가져온 계정은 목록에서만 빠져요.'],
    ];
    return `<details class="ms-help" ${ui.help ? 'open' : ''}><summary data-subs="help-toggle">막혔을 때</summary><dl>${items.map(([q, a]) => `<div><dt>${esc(q)}</dt><dd>${esc(a)}</dd></div>`).join('')}</dl></details>`;
  }
  function section(number, title, description, body) {
    return `<section class="ms-section"><div class="ms-section-heading"><span class="ms-section-number">${number}</span><div><h2>${title}</h2><p>${description}</p></div></div>${body}</section>`;
  }

  // 고리 숫자는 처음 보일 때와 값이 바뀔 때만 한 번 굴리고 고리를 그린다(1분마다 다시 그려도 가만히 있다).
  function rollChanged() {
    const nodes = container?.querySelectorAll?.('[data-roll]'); if (!nodes) return;
    const motion = motionOn();
    for (const el of nodes) {
      const key = el.dataset.roll, value = el.textContent;
      if (motion && rolled.get(key) !== value) { roll(el); el.closest('.ms-gauge')?.classList.add('is-drawing'); }
      rolled.set(key, value);
    }
  }
  function paint() {
    if (!container || !visible) return;
    const now = Date.now(), rows = snapshot?.rows || [];
    let body = '';
    if (!context.native) body = section('01', 'PC 앱에서 쓰는 혜택이에요', '이 혜택은 회원 PC에 설치된 공식 프로그램으로 사용량을 읽기 때문에 SYNK Platform PC 앱에서만 열려요.', '<p class="ms-soft">PC 앱을 설치하고 SYNK ID로 로그인한 뒤 회원 혜택에서 열어 주세요.</p>');
    else if (!context.signedIn) body = section('01', '로그인하고 시작해요', '회원 무료 혜택이에요. 로그인 정보와 사용량 기록은 이 PC에만 저장돼요.', '<p class="ms-soft">위 초록 판의 「SYNK ID로 로그인」을 눌러 주세요. 처음이라면 창 오른쪽 위 「회원가입」부터 해요.</p>');
    else if (loadError) body = section('01', '불러오지 못했어요', esc(loadError), '<button type="button" class="ms-button" data-subs="recheck-tools">다시 시도</button>');
    else if (!snapshot) body = '<p class="ms-loading">계정판을 준비하고 있어요…</p>';
    else if (!rows.length) { if (!ui.guide && !ui.guideClosed) ui.guide = 'claude'; body = connectSection() + section('02', '직접 넣는 구독', 'Suno·Hugging Face처럼 공식 출력이 없는 서비스는 결제일과 요금만 넣어 둘 수 있어요.', manualForm()); }
    else body = attentionSection(rows, now) + serviceSection(rows, now) + agendaSection(rows, now) + connectSection();
    const focused = document.activeElement?.id;
    const selection = focused && container.querySelector('#' + CSS.escape(focused)) ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    container.innerHTML = `<div class="member-subs">${hero(now)}${body}</div>`;
    rollChanged();
    if (focused) { const el = container.querySelector('#' + CSS.escape(focused)); if (el) { el.focus({ preventScroll: true }); if (selection && typeof el.setSelectionRange === 'function') try { el.setSelectionRange(...selection); } catch {} } }
  }

  return {
    render(el, next = {}) {
      container = el; bind(el); context = { signedIn: next.signedIn === true, native: next.native === true && !!api };
      visible = true;
      if (context.native && context.signedIn && !snapshot && !loadError) void load(false);
      if (!timer) { timer = setInterval(() => { if (visible && !document.hidden && !(container?.contains(document.activeElement) && document.activeElement.matches('input,select,textarea'))) paint(); }, 60000); timer?.unref?.(); }
      paint();
    },
    setVisible(value) { visible = !!value; if (!visible) { ui.removeArmed = null; rolled.clear(); } },
    dispose() { clearInterval(timer); timer = null; visible = false; },
    refresh: () => load(true),
  };
}
