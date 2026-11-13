// SYNK 마케팅 지도 — 세계 지도 첫 화면. 자료 모양은 model.mjs, 원천은 data.json · pulse-targets.json · geo.json.
import { buildWorld, headline, formatKst, regionOf } from './model.mjs';

const SVG = 'http://www.w3.org/2000/svg';
const $ = sel => document.querySelector(sel);
const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const ARROW_LEFT = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';

// 11-13: 사업 넷(LAB · SHIFT · PULSE · PATH)과 「전체」. 모델(model.mjs)이 내지 않은 보기는 단추를 숨긴다.
const VIEWS = ['lab', 'shift', 'pulse', 'path', 'all'];
const BUSINESS = ['LAB', 'SHIFT', 'PULSE', 'PATH', 'SYNK'];
const state = { view: 'lab', code: null, world: null, geo: null, paths: new Map(), business: '', allView: null };
const hasView = id => id === 'all' ? Array.isArray(state.world?.all?.accounts) : Array.isArray(state.world?.[id]?.countries);

function remembered() {
  try { return localStorage.getItem('synk.map.view'); } catch { return null; }
}
function remember(view) {
  try { localStorage.setItem('synk.map.view', view); } catch { /* 저장이 막혀도 화면은 돈다 */ }
}

function readHash() {
  const [view, code] = location.hash.replace(/^#/, '').split('/');
  return { view: VIEWS.includes(view) ? view : null, code: code ? code.toUpperCase() : null };
}
function writeHash() {
  const next = '#' + state.view + (state.code ? '/' + state.code : '');
  if (location.hash !== next) history.replaceState(null, '', next);
}

async function load() {
  const get = async name => {
    const response = await fetch(name, { cache: 'no-store' });
    if (!response.ok) throw new Error(name + ' ' + response.status);
    return response.json();
  };
  const [data, targets, geo] = await Promise.all([get('data.json'), get('pulse-targets.json'), get('geo.json')]);
  state.geo = geo;
  state.world = buildWorld({ data, targets, geo });
}

function drawLand() {
  const svg = $('#map');
  const { w, h, countries } = state.geo;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const land = $('#land');
  const frag = document.createDocumentFragment();
  for (const c of countries) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', c.d);
    p.setAttribute('class', 'c');
    if (c.a2) {
      p.dataset.code = c.a2;
      if (!state.paths.has(c.a2)) state.paths.set(c.a2, p);
    }
    frag.appendChild(p);
  }
  land.appendChild(frag);
}

// 전체 보기의 지도: 사업별 보기의 나라를 코드로 합친다(나라가 있는 계정만 칠하고, 같은 계정은 id로 한 번만).
function allView() {
  if (state.allView) return state.allView;
  const by = new Map();
  for (const id of ['lab', 'shift', 'pulse', 'path'].filter(hasView)) {
    const view = state.world[id];
    for (const c of view.countries) {
      const row = by.get(c.code) || { code: c.code, name: c.name, center: c.center, small: c.small, area: c.area, status: 'target', accounts: [], businesses: [], lines: [] };
      if (c.status === 'active') row.status = 'active';
      if (!row.businesses.includes(view.brand)) row.businesses.push(view.brand);
      for (const a of c.accounts) if (!row.accounts.some(x => x.id && x.id === a.id)) row.accounts.push(a);
      by.set(c.code, row);
    }
  }
  const countries = [...by.values()].map(c => ({ ...c, role: c.businesses.join(' · '), secured: c.accounts.filter(a => a.secured).length, planned: c.accounts.length }));
  const s = state.world.all.summary || {};
  state.allView = { brand: 'ALL', name: '전체 계정', what: '네 사업 · 회사 공통', countries, shared: [], all: state.world.all,
    summary: { active: countries.filter(c => c.status === 'active').length, target: countries.filter(c => c.status === 'target').length, secured: s.managed ?? 0, planned: (s.managed ?? 0) + (s.planned ?? 0) } };
  return state.allView;
}
// 색 active = 그 나라에 계정을 확보함(게시 중이라는 뜻 아님). PULSE의 target은 「타깃 시장」.
const statusLabel = (c, brand) => c.status === 'active' ? '계정 있음' : brand === 'PULSE' ? '타깃 시장' : '준비 중';
function current() {
  if (state.view === 'all' && hasView('all')) return allView();
  return hasView(state.view) ? state.world[state.view] : state.world.lab;
}
function countryOf(code) {
  return current().countries.find(c => c.code === code) || null;
}

function paint() {
  const view = current();
  const byCode = new Map(view.countries.map(c => [c.code, c]));
  for (const [code, p] of state.paths) {
    const c = byCode.get(code);
    p.classList.toggle('is-active', c?.status === 'active');
    p.classList.toggle('is-target', c?.status === 'target');
    p.classList.toggle('hot', Boolean(c));
    p.classList.toggle('is-selected', Boolean(c) && code === state.code);
    if (c) {
      p.setAttribute('tabindex', '0');
      p.setAttribute('role', 'button');
      p.setAttribute('aria-label', `${c.name} · ${statusLabel(c, view.brand)}`);
    } else {
      p.removeAttribute('tabindex');
      p.removeAttribute('role');
      p.removeAttribute('aria-label');
    }
  }
  // 나머지를 옅게 하는 것은 칠한 나라가 많은 보기(LAB)에서만 — PULSE처럼 몇 곳뿐이면 다른 나라도 그대로 보여야 한다.
  $('#map').classList.toggle('has-sel', Boolean(state.code && byCode.has(state.code)) && view.countries.length > 10);
  // 고른 나라는 맨 위로 올려 테두리가 이웃에 가리지 않게
  const selected = state.code && state.paths.get(state.code);
  if (selected && selected.classList.contains('hot')) selected.parentNode.appendChild(selected);
  drawMarks(view);
  drawLabels(view);
}

// 나라가 열 곳 이하인 보기(지금은 PULSE)는 이름을 지도 위에 적는다 — 작은 나라도 어디인지 바로 읽히게.
const LABEL_NUDGE = { KR: [-1, 0, 'end'], JP: [1, 0, 'start'], PH: [1, 0, 'start'], MY: [0, 1, 'middle'], TW: [1, 0, 'start'], SG: [0, 1, 'middle'] };
function drawLabels(view) {
  const layer = $('#labels');
  layer.textContent = '';
  if (view.countries.length > 10 || !view.countries.length) return;
  const scale = ($('#map').getBoundingClientRect().width || state.geo.w) / state.geo.w;
  const size = 13 / scale;
  for (const c of view.countries) {
    if (!c.center) continue;
    const [dx, dy, anchor] = LABEL_NUDGE[c.code] || [0, 0, 'middle'];
    const t = document.createElementNS(SVG, 'text');
    t.setAttribute('x', c.center[0] + dx * size * 1.1);
    t.setAttribute('y', c.center[1] + dy * size * 1.5 + size * 0.35);
    t.setAttribute('text-anchor', anchor);
    t.setAttribute('font-size', size.toFixed(2));
    t.setAttribute('class', 'lbl' + (c.status === 'target' ? ' is-target' : ''));
    t.setAttribute('aria-hidden', 'true');
    t.textContent = c.name;
    layer.appendChild(t);
  }
}

// 작은 나라는 점으로, PULSE 운영 나라는 고동치는 고리로 보인다.
function drawMarks(view) {
  const marks = $('#marks');
  marks.textContent = '';
  for (const c of view.countries) {
    if (!c.center) continue;
    const [x, y] = c.center;
    if (c.code === state.code && (c.area ?? 0) < 120) {
      // 고른 나라가 작으면(대만 · 스리랑카 · 한국) 둘레에 고리를 하나 둘러 어디인지 바로 보이게
      const loc = document.createElementNS(SVG, 'circle');
      loc.setAttribute('cx', x); loc.setAttribute('cy', y); loc.setAttribute('r', 13);
      loc.setAttribute('class', 'locator');
      loc.setAttribute('aria-hidden', 'true');
      marks.appendChild(loc);
    }
    if (c.small) {
      const dot = document.createElementNS(SVG, 'circle');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', 3.2);
      dot.setAttribute('class', 'mark' + (c.status === 'target' ? ' is-target' : ''));
      dot.dataset.code = c.code;
      marks.appendChild(dot);
    }
    if (view.brand !== 'LAB' && view.brand !== 'ALL' && view.countries.length <= 10 && c.status === 'active') {
      for (const cls of ['ring', 'ring r2']) {
        const ring = document.createElementNS(SVG, 'circle');
        ring.setAttribute('cx', x); ring.setAttribute('cy', y); ring.setAttribute('r', 22);
        ring.setAttribute('class', cls);
        ring.setAttribute('aria-hidden', 'true');
        marks.appendChild(ring);
      }
    }
  }
}

function stat(label, value, small = '') {
  return `<div class="stat"><dt>${esc(label)}</dt><dd>${esc(value)}${small ? `<small>${esc(small)}</small>` : ''}</dd></div>`;
}

function renderHead() {
  const view = current();
  const head = view.brand === 'ALL' ? { first: '네 사업과 회사 공통 계정을', second: '한 번에 봐요. 장기 계획은 따로 세요.' } : headline(view);
  for (const id of VIEWS) document.body.classList.toggle('v-' + id, state.view === id);
  $('[data-slot="eyebrow"]').textContent = `${view.name} · ${view.what}`;
  $('[data-slot="h1a"]').textContent = head.first;
  $('[data-slot="h1b"]').textContent = head.second;
  const s = view.summary;
  const all = view.all?.summary;
  $('[data-slot="stats"]').innerHTML = all
    ? stat('관리 중', all.managed ?? '—', '개') + stat('확장 계획', all.planned ?? '—', '개') + stat('제외 · 보류', all.excluded ?? '—', '개') + stat('장기 계획', all.longTermPlans ?? '—', '개')
    : stat('계정 있는 나라', s.active, '개국') + stat(view.brand === 'PULSE' ? '타깃 시장' : '준비 중', s.target, '개국') + stat(s.shared ? `확보 / 계획(연계 ${s.shared})` : '확보 / 계획한 계정', s.secured, ` / ${s.planned}`)
      + (s.primary === 0 && s.shared ? stat('이 사업 계정', 0, '개') : '');
  for (const tab of document.querySelectorAll('.seg-item')) {
    tab.hidden = !hasView(tab.dataset.view);
    const on = tab.dataset.view === state.view;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
  }
  $('#stage').setAttribute('aria-labelledby', 'tab-' + state.view);
  const legendTarget = $('[data-slot="legend-target"]');
  if (legendTarget) legendTarget.textContent = view.brand === 'PULSE' ? '타깃 시장' : '준비 중';
  const when = formatKst(state.world.generatedAt);
  $('[data-slot="foot"]').textContent = (when ? `계정 원장 ${when} 기준` : '계정 원장 기준') +
    (state.world.targetsUpdatedAt ? ` · PULSE 타깃 ${state.world.targetsUpdatedAt.slice(5).replace('-', '월 ')}일 정리` : '');
  document.title = `${view.name} 지도 · SYNK 온라인 마케팅 지도`;
}

function countRows(list, grouped = false) {
  let last = null;
  return list.map(c => {
    const region = grouped ? regionOf(c.code).name : null;
    const head = grouped && region !== last ? `<p class="region">${esc(region)}</p>` : '';
    last = region;
    const full = c.planned > 0 && c.secured === c.planned;
    const sub = c.verdict && c.status !== 'active' ? `검토 · ${c.verdict}` : c.accounts.map(a => a.platform).join(' · ');
    return head + `<button class="row" type="button" data-code="${esc(c.code)}">
      <span><span class="row-name">${esc(c.name)}</span><span class="row-sub">${esc(c.role ? c.role + ' · ' + sub : sub)}</span></span>
      <span class="row-num${full ? ' full' : ''}">${c.planned ? `${c.secured}/${c.planned}` : '—'}</span>
    </button>`;
  }).join('');
}

// 운영 상태(로컬 원장 조합값): 브라우저 로그인 · 게시 · 수집 API를 따로. 칸이 없으면 「기록 미확인」 — 실패로 단정하지 않는다.
function when(value) {
  const s = String(value || '');
  if (/T/.test(s)) return formatKst(s) || '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/);
  return m ? `${Number(m[2])}월 ${Number(m[3])}일${m[4] ? ' ' + m[4] : ''}` : '';
}
function opsRows(op) {
  if (!op) return '<dl class="ops"><div><dt>운영 상태</dt><dd>기록 미확인</dd></div></dl>';
  const L = op.login, P = op.publication, C = op.collection;
  // 날짜만 확인한 로그인 기록은 시각 없이 날짜만(observedAt ISO 앞 10자).
  const loginAt = L?.observedAt ? when(L.observedDateOnly === true ? String(L.observedAt).slice(0, 10) : L.observedAt) : '';
  const login = !L?.state ? '기록 미확인' : L.state === 'verified' ? `확인됨${L.observedAt ? ' · ' + loginAt : ''}${L.scope ? ' · ' + L.scope : ''}`
    : L.state === 'login-required' ? `로그인 필요${L.scope ? ' · ' + L.scope : ''}${L.observedAt ? ' · ' + loginAt + ' 확인' : ''}`
    : L.state === 'historical' ? `예전 기록만 있음${L.observedAt ? ' · ' + loginAt : ''} · 다시 확인 전` : '기록 미확인';
  const pubParts = !P ? [] : [
    P.publishedCount ? `${P.omittedPublishedCount ? '최근 근거 게시' : '게시'} ${P.publishedCount.toLocaleString('ko-KR')}건${P.lastPublishedAt ? `(마지막 ${when(P.lastPublishedAt)})` : ''}${P.omittedPublishedCount ? ` · 그 전 게시 ${P.omittedPublishedCount.toLocaleString('ko-KR')}건은 따로(이 수에 안 넣음)` : ''}` : '',
    P.scheduledCount ? `예약 ${P.scheduledCount}건${P.nextScheduledAt ? `(다음 ${when(P.nextScheduledAt)})` : ''}` : '',
    P.pendingConfirmationCount ? `게시 확인 대기 ${P.pendingConfirmationCount}건` : ''
  ].filter(Boolean);
  const nextMs = Date.parse(P?.nextScheduledAt || '');
  const pub = !P ? '기록 미확인' : pubParts.length
    ? pubParts.join(' · ') + (Number.isFinite(nextMs) && nextMs <= Date.now() ? ' · 그 예약 시각이 지나 게시 확인 필요' : '') + (P.checkedAt ? ` · ${when(P.checkedAt)} 기준` : '') + (P.basis && (P.publishedCount || P.scheduledCount) ? ` — ${P.basis}` : '')
    : (P.checkedAt && P.publishedCount === 0 && P.scheduledCount === 0 ? `작업실 게시 · 예약 없음 · ${when(P.checkedAt)} 확인` : '기록 미확인');
  // 수집 토큰은 서버 이름(collection-policy.mjs · account-catalog.mjs) → 한국어. 모르는 토큰은 영어 대신 「수집 상태 미확인」.
  const method = ({'official-api':'공식 API','creator-export-or-manual':'관리자 통계 · 직접 기록',server:'작업실 서버 수집','public-api':'공개 API','vk-api':'VK API','public-page':'공개 화면 읽기','screen-only':'화면으로만 확인'})[C?.method] || '';
  const col = !C?.state ? '기록 미확인' : `${({success:'오늘 수집 완료',partial:'오늘 일부만 수집',collecting:'수집 중',scheduled:'수집 시각 전',overdue:'이번 수집 전','retry-scheduled':'다시 시도 예정',paused:'자동 수집 꺼짐',failed:'수집 실패','needs-reconnect':'다시 연결해야 함','needs-connection':'연결해야 함',unsupported:'자동 수집 안 됨',archived:'보관됨','not-managed':'운영 대상 아님','not-registered':'수집 채널 미등록',unknown:'수집 상태 미확인',historical:'예전 기록만 있음'})[C.state] || '수집 상태 미확인'}${method ? ' · ' + method : ''}${C.checkedAt ? ' · 마지막 수집 ' + when(C.checkedAt) : ''}`;
  return `<dl class="ops">${[['브라우저 로그인', login, L?.state], ['게시', pub, ''], ['수집', col, C?.state]].map(([k, v, s]) => `<div${s ? ` data-state="${esc(s)}"` : ''}><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}
function accRows(accounts, empty = '아직 계정이 없어요.', { brand = '', showCountry = false } = {}) {
  if (!accounts.length) return empty ? `<p class="empty">${esc(empty)}</p>` : '';
  return accounts.map(a => {
    const baseSub = a.secured
      ? (a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.handle || a.url)}</a>` : esc(a.handle || '확보'))
      : esc([a.state, a.note].filter(Boolean).join(' · '));
    const purpose = a.purpose && a.purpose !== a.note ? esc(a.purpose) : '';
    const sub = purpose ? (baseSub ? `${baseSub} · ${purpose}` : purpose) : baseSub;
    const linked = Array.isArray(a.secondaryBusinesses) ? a.secondaryBusinesses.filter(b => b && b !== a.business) : [];
    const bizLabel = brand && a.business !== brand ? `${a.business} 계정` : a.business === 'SYNK' ? 'SYNK 공통' : a.business;
    const tags = (a.business && (a.business === 'SYNK' || (brand && a.business !== brand)) ? `<span class="tag">${esc(bizLabel)}</span>` : '')
      + (linked.length ? `<span class="tag track">연계 ${esc(linked.join('·'))}</span>` : '')
      + (a.contentTrack && a.contentTrack !== a.business ? `<span class="tag track">${esc(a.contentTrack)}</span>` : '')
      + (a.shared ? '<span class="tag track">공통</span>' : '')
      + (showCountry ? `<span class="tag track">${esc(a.country || '나라 미정')}</span>` : '');
    return `<div class="acc"><span class="led${a.secured ? '' : ' off'}" aria-hidden="true"></span><span class="acc-name">${esc(a.platform)}${tags}</span><span class="acc-sub">${sub}</span>${a.secured ? opsRows(a.operations) : ''}</div>`;
  }).join('');
}
// 전체 보기 오른쪽 칸: 사업별 확보 계정(나라 불명 포함) + 미확보 계획/보류(확보 수에서 제외) + 장기 계획
function renderAll(view) {
  const accounts = view.all.accounts || [], securedAll = accounts.filter(a => a.secured), unsecuredAll = accounts.filter(a => !a.secured);
  const biz = a => BUSINESS.includes(a.business) ? a.business : '미분류';
  const groups = [...BUSINESS, '미분류'].filter(b => accounts.some(a => biz(a) === b)), picked = groups.includes(state.business) ? state.business : '';
  const chip = (value, label, n) => `<button type="button" data-business="${esc(value)}" aria-pressed="${picked === value}">${value ? `<i class="biz-dot" data-business="${esc(value)}"></i>` : ''}${esc(label)} <span class="num">${n}</span></button>`;
  let html = `<section class="pane-sec"><h2 class="sec-title">확보한 계정 <span class="num">${securedAll.length}</span></h2><p class="sec-note">주 사업으로 나누고 연계 사업 · 홍보 목적을 함께 적어요.${unsecuredAll.length ? ` 미개설 계획 · 보류 ${unsecuredAll.length}개는 확보 계정 수에 넣지 않고 사업 아래에 따로 적어요.` : ''}</p><div class="chips">${chip('', '전체', securedAll.length)}${groups.map(b => chip(b, b, securedAll.filter(a => biz(a) === b).length)).join('')}</div></section>`;
  for (const b of picked ? [picked] : groups) {
    const list = accounts.filter(a => biz(a) === b), held = list.filter(a => a.secured), todo = list.filter(a => !a.secured);
    html += `<section class="pane-sec"><h3 class="sec-title"><i class="biz-dot" data-business="${esc(b)}"></i>${esc(b)} <span class="num">${held.length}</span></h3><div class="rows">${accRows(held, '확보한 계정이 없어요.', { showCountry: true })}</div>${todo.length ? `<p class="region">계획 · 보류(확보 수 제외) ${todo.length}</p><div class="rows">${accRows(todo, '', { showCountry: true })}</div>` : ''}</section>`;
  }
  const plans = view.all.plans || [];
  if (plans.length) html += `<section class="pane-sec"><details class="plans"><summary><span class="sec-title">장기 계획 <span class="num">${plans.length}</span></span><span class="sec-note">아직 만들지 않은 계정 계획이에요. 위 계정 수에 더하지 않아요.</span></summary><div class="rows">${plans.map(p => `<div class="acc"><span class="led off" aria-hidden="true"></span><span class="acc-name">${esc(p.title || p.name || p.platform || '계획')}</span><span class="acc-sub">${esc([p.business, p.contentTrack !== p.business ? p.contentTrack : '', p.market || p.country, p.state, p.note].filter(Boolean).join(' · '))}</span></div>`).join('')}</div></details></section>`;
  return html;
}

function renderList() {
  const view = current();
  const active = view.countries.filter(c => c.status === 'active');
  const target = view.countries.filter(c => c.status === 'target');
  let html = '';
  html += `<section class="pane-sec"><h2 class="sec-title"><span class="sw sw-active" aria-hidden="true"></span>계정이 있는 나라 <span class="num">${active.length}</span></h2>`;
  html += active.length ? `<div class="rows">${countRows(active, view.countries.length > 10)}</div>` : '<p class="sec-note">아직 계정이 있는 나라가 없어요.</p>';
  html += '<p class="sec-note">계정을 확보한 나라예요. 실제로 게시하는지는 계정마다 게시 기록에서 봐요.</p>';
  html += '</section>';
  if (view.shared?.length) {
    html += `<section class="pane-sec"><h2 class="sec-title">나라를 나누지 않은 계정 <span class="num">${view.shared.length}</span></h2>`;
    html += `<div class="rows">${accRows(view.shared, '', { brand: view.brand })}</div>`;
    if (view.sharedNote) html += `<p class="sec-note">${esc(view.sharedNote)}</p>`;
    html += '</section>';
  }
  html += `<section class="pane-sec"><h2 class="sec-title"><span class="sw sw-target" aria-hidden="true"></span>${view.brand === 'PULSE' ? '타깃 시장(준비)' : '준비 중'} <span class="num">${target.length}</span></h2>`;
  html += target.length ? `<div class="rows">${countRows(target, view.countries.length > 10)}</div>` : '<p class="sec-note">준비 중인 나라는 없어요.</p>';
  html += '</section>';
  return html;
}

function renderDetail(c) {
  const view = current();
  const pills = [
    `<span class="pill"><span class="led${c.status === 'active' ? '' : ' off'}"></span>${statusLabel(c, view.brand)}</span>`,
    c.planned ? `<span class="pill num">계정 ${c.secured}/${c.planned}</span>` : '',
    c.role ? `<span class="pill">${esc(c.role)}</span>` : '',
    c.verdict ? `<span class="pill pill-verdict" data-verdict="${esc(c.verdict)}">검토 · ${esc(c.verdict)}</span>` : '',
    c.language ? `<span class="pill">${esc(c.language)}</span>` : ''
  ].join('');
  let html = `<section class="pane-sec">
    <button class="back" type="button" data-back>${ARROW_LEFT}전체 나라</button>
    <h2 class="d-name">${esc(c.name)}</h2>
    <div class="pills">${pills}</div>
    ${c.why ? `<p class="why">${esc(c.why)}</p>` : ''}
  </section>`;
  // 공통 계정이 이 나라에 닿는 것(accountRefs → shared)은 계정으로, 아직 없는 자리는 「만들 계정(계획)」으로 나눈다.
  const held = c.accounts.filter(a => a.secured), todo = c.accounts.filter(a => !a.secured), brand = view.brand === 'ALL' ? '' : view.brand;
  html += `<section class="pane-sec"><h3 class="sec-title">계정 <span class="num">${held.length}</span></h3><div class="rows">${accRows(held, view.brand === 'PULSE' && !todo.length ? '이 나라용 계정은 새로 만들지 않아요 — 공통 계정이 닿아요.' : '아직 확보한 계정이 없어요.', { brand })}</div></section>`;
  if (todo.length) html += `<section class="pane-sec"><h3 class="sec-title">만들 계정(계획) <span class="num">${todo.length}</span></h3><div class="rows">${accRows(todo, '', { brand })}</div></section>`;
  if (c.sharedHere && view.shared?.length && !c.accounts.some(a => a.shared)) {
    html += `<section class="pane-sec"><h3 class="sec-title">이 나라에 닿는 공통 계정</h3><div class="rows">${accRows(view.shared)}</div></section>`;
  }
  if (c.lines?.length) {
    html += `<section class="pane-sec"><h3 class="sec-title">게시</h3><dl class="facts">${c.lines.map(l => `<div class="fact"><dt>${esc(l.label)}</dt><dd>${esc(l.text)}</dd></div>`).join('')}</dl></section>`;
  }
  if (view.brand === 'PULSE' && c.labHere) {
    html += `<section class="pane-sec"><p class="sec-note">이 나라에는 LAB 계정 ${c.labHere}곳이 이미 있어요. 보는 사람이 달라(한국어 학습) 계정을 함께 쓰지는 않아요.</p></section>`;
  }
  return html;
}

function renderPane() {
  const pane = $('#pane');
  const c = state.code ? countryOf(state.code) : null;
  const view = current();
  pane.innerHTML = c ? renderDetail(c) : view.brand === 'ALL' ? renderAll(view) : renderList();
  pane.scrollTop = 0;
}

function fitPane() {
  const pane = $('#pane');
  const box = $('.map-box');
  if (window.matchMedia('(max-width:1100px)').matches) { pane.style.maxHeight = ''; return; }
  pane.style.maxHeight = Math.max(box.getBoundingClientRect().height, 420) + 'px';
}

function render() {
  if (state.code && !countryOf(state.code)) state.code = null;
  renderHead();
  paint();
  renderPane();
  writeHash();
  fitPane();
}

function select(code) {
  state.code = code && countryOf(code) ? code : null;
  hideTip();
  render();
  if (state.code && window.matchMedia('(max-width:1100px)').matches) $('#pane').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setView(view) {
  if (view === state.view || !hasView(view)) return;
  state.view = view;
  remember(view);
  if (state.code && !countryOf(state.code)) state.code = null;
  render();
}

// 말풍선
const tip = () => $('#tip');
function showTip(code, event) {
  const c = countryOf(code);
  if (!c) return hideTip();
  const box = $('.map-box').getBoundingClientRect();
  const el = tip();
  el.innerHTML = `<b>${esc(c.name)}</b>${statusLabel(c, current().brand)} · ${c.planned ? `계정 ${c.secured}/${c.planned}` : esc(c.verdict ? '검토 · ' + c.verdict : '새 계정 없음')}`;
  el.hidden = false;
  let x, y;
  if (event && 'clientX' in event && event.clientX) { x = event.clientX - box.left; y = event.clientY - box.top; }
  else {
    const r = event.target.getBoundingClientRect();
    x = r.left + r.width / 2 - box.left; y = r.top - box.top;
  }
  const half = el.offsetWidth / 2 + 8;
  el.style.left = Math.min(Math.max(x, half), box.width - half) + 'px';
  el.style.top = Math.max(y, el.offsetHeight + 20) + 'px';
}
function hideTip() { const el = tip(); if (el) el.hidden = true; }

function bind() {
  const svg = $('#map');
  const codeAt = target => target?.closest?.('[data-code]')?.dataset.code || null;
  svg.addEventListener('pointermove', event => {
    const code = codeAt(event.target);
    if (code && countryOf(code) && event.pointerType !== 'touch') showTip(code, event); else hideTip();
  });
  svg.addEventListener('pointerleave', hideTip);
  svg.addEventListener('click', event => {
    const code = codeAt(event.target);
    if (code && countryOf(code)) select(code === state.code ? null : code);
  });
  svg.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const code = codeAt(event.target);
    if (code && countryOf(code)) { event.preventDefault(); select(code); }
  });
  svg.addEventListener('focusin', event => { const code = codeAt(event.target); if (code) showTip(code, event); });
  svg.addEventListener('focusout', hideTip);
  $('#pane').addEventListener('click', event => {
    const row = event.target.closest('.row[data-code]');
    if (row) return select(row.dataset.code);
    if (event.target.closest('[data-back]')) return select(null);
    const chip = event.target.closest('.chips [data-business]');
    if (chip) { state.business = chip.dataset.business || ''; renderPane(); }
  });
  const segs = document.querySelectorAll('.seg');
  for (const seg of segs) {
    seg.addEventListener('click', event => {
      const tab = event.target.closest('.seg-item');
      if (tab) setView(tab.dataset.view);
    });
    seg.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const ids = VIEWS.filter(hasView), at = ids.indexOf(state.view);
      setView(ids[(at + (event.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length]);
      seg.querySelector(`[data-view="${state.view}"]`)?.focus();
    });
  }
  document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); select(null); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  window.addEventListener('hashchange', () => {
    const { view, code } = readHash();
    if (view && hasView(view)) state.view = view;
    state.code = code;
    render();
  });
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && state.code) select(null); });
  window.addEventListener('resize', () => { fitPane(); drawLabels(current()); });
  const top = $('#top');
  const onScroll = () => top.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function mobileTabs() {
  // 좁은 창은 위 막대가 비좁아 사업 고르기를 머리 아래에 한 번 더 둔다(같은 단추, 같은 동작).
  const copy = document.querySelector('.top .seg').cloneNode(true);
  copy.classList.add('inline');
  copy.removeAttribute('role');
  for (const item of copy.querySelectorAll('.seg-item')) { item.removeAttribute('id'); item.setAttribute('role', 'button'); item.removeAttribute('aria-selected'); }
  document.querySelector('.head-text').appendChild(copy);
}

function counts() {
  for (const id of VIEWS) {
    if (!hasView(id)) continue;
    const s = id === 'all' ? null : state.world[id].summary;
    const text = id === 'all' ? String(state.world.all.summary?.managed ?? state.world.all.accounts.filter(a => a.secured).length) : s.target ? `${s.active} · ${s.target}` : String(s.active);
    for (const el of document.querySelectorAll(`.seg [data-count="${id}"]`)) el.textContent = text;
  }
}

function centerMobileMap() {
  // 좁은 창은 지도를 옆으로 밀어 보게 하고, 처음에는 한국 둘레를 가운데에 둔다.
  const scroller = $('#map-scroll');
  if (scroller.scrollWidth <= scroller.clientWidth) return;
  const korea = state.geo.countries.find(c => c.a2 === 'KR');
  const ratio = (korea ? korea.c[0] : state.geo.w / 2) / state.geo.w;
  scroller.scrollLeft = scroller.scrollWidth * ratio - scroller.clientWidth / 2;
}

async function start() {
  try {
    await load();
  } catch (error) {
    $('[data-slot="eyebrow"]').textContent = '불러오지 못했어요';
    $('[data-slot="h1a"]').textContent = '지도 자료를 읽지 못했어요.';
    $('[data-slot="h1b"]').textContent = '기록 서버가 켜져 있는지 확인해 주세요.';
    console.error(error);
    return;
  }
  const hash = readHash();
  const saved = remembered();
  state.view = [hash.view, saved, 'lab'].find(id => id && hasView(id)) || 'lab';
  state.code = hash.code;
  drawLand();
  mobileTabs();
  counts();
  bind();
  render();
  centerMobileMap();
}

start();
