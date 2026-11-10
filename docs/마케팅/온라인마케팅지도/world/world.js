// SYNK 마케팅 지도 — 세계 지도 첫 화면. 자료 모양은 model.mjs, 원천은 data.json · pulse-targets.json · geo.json.
import { buildWorld, headline, formatKst, regionOf } from './model.mjs';

const SVG = 'http://www.w3.org/2000/svg';
const $ = sel => document.querySelector(sel);
const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const ARROW_LEFT = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';

const state = { view: 'lab', code: null, world: null, geo: null, paths: new Map() };

function remembered() {
  try { return localStorage.getItem('synk.map.view'); } catch { return null; }
}
function remember(view) {
  try { localStorage.setItem('synk.map.view', view); } catch { /* 저장이 막혀도 화면은 돈다 */ }
}

function readHash() {
  const [view, code] = location.hash.replace(/^#/, '').split('/');
  return { view: view === 'pulse' || view === 'lab' ? view : null, code: code ? code.toUpperCase() : null };
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

function current() {
  return state.view === 'pulse' ? state.world.pulse : state.world.lab;
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
      p.setAttribute('aria-label', `${c.name} · ${c.status === 'active' ? '운영 중' : '준비 중'}`);
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
  if (view.countries.length > 10) return;
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
    if (view.brand === 'PULSE' && c.status === 'active') {
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
  const head = headline(view);
  document.body.classList.toggle('v-pulse', state.view === 'pulse');
  document.body.classList.toggle('v-lab', state.view === 'lab');
  $('[data-slot="eyebrow"]').textContent = `${view.name} · ${view.what}`;
  $('[data-slot="h1a"]').textContent = head.first;
  $('[data-slot="h1b"]').textContent = head.second;
  const s = view.summary;
  $('[data-slot="stats"]').innerHTML =
    stat('운영 중', s.active, '개국') +
    stat('준비 중', s.target, '개국') +
    stat(view.brand === 'PULSE' ? '확보 / 계획한 계정' : '확보 / 계획한 계정', s.secured, ` / ${s.planned}`);
  for (const tab of document.querySelectorAll('.seg-item')) {
    const on = tab.dataset.view === state.view;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
  }
  $('#stage').setAttribute('aria-labelledby', 'tab-' + state.view);
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
    const sub = c.accounts.map(a => a.platform).join(' · ');
    return head + `<button class="row" type="button" data-code="${esc(c.code)}">
      <span><span class="row-name">${esc(c.name)}</span><span class="row-sub">${esc(c.role ? c.role + ' · ' + sub : sub)}</span></span>
      <span class="row-num${full ? ' full' : ''}">${c.secured}/${c.planned}</span>
    </button>`;
  }).join('');
}

function accRows(accounts) {
  if (!accounts.length) return '<p class="empty">아직 계정이 없어요.</p>';
  return accounts.map(a => {
    const sub = a.secured
      ? (a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.handle || a.url)}</a>` : esc(a.handle || '확보'))
      : esc([a.state, a.note].filter(Boolean).join(' · '));
    return `<div class="acc"><span class="led${a.secured ? '' : ' off'}" aria-hidden="true"></span><span class="acc-name">${esc(a.platform)}</span><span class="acc-sub">${sub}</span></div>`;
  }).join('');
}

function renderList() {
  const view = current();
  const active = view.countries.filter(c => c.status === 'active');
  const target = view.countries.filter(c => c.status === 'target');
  let html = '';
  html += `<section class="pane-sec"><h2 class="sec-title"><span class="sw sw-active" aria-hidden="true"></span>운영 중 <span class="num">${active.length}</span></h2>`;
  html += active.length ? `<div class="rows">${countRows(active, view.countries.length > 10)}</div>` : '<p class="sec-note">아직 운영하는 나라가 없어요.</p>';
  html += '</section>';
  if (view.brand === 'PULSE' && view.shared.length) {
    html += `<section class="pane-sec"><h2 class="sec-title">나라를 나누지 않은 계정 <span class="num">${view.shared.length}</span></h2>`;
    html += `<div class="rows">${accRows(view.shared)}</div>`;
    if (view.sharedNote) html += `<p class="sec-note">${esc(view.sharedNote)}</p>`;
    html += '</section>';
  }
  html += `<section class="pane-sec"><h2 class="sec-title"><span class="sw sw-target" aria-hidden="true"></span>준비 중 <span class="num">${target.length}</span></h2>`;
  html += target.length ? `<div class="rows">${countRows(target, view.countries.length > 10)}</div>` : '<p class="sec-note">준비 중인 나라는 없어요. 모든 타깃 나라에 계정이 하나 이상 있어요.</p>';
  html += '</section>';
  return html;
}

function renderDetail(c) {
  const view = current();
  const pills = [
    `<span class="pill"><span class="led${c.status === 'active' ? '' : ' off'}"></span>${c.status === 'active' ? '운영 중' : '준비 중'}</span>`,
    `<span class="pill num">계정 ${c.secured}/${c.planned}</span>`,
    c.role ? `<span class="pill">${esc(c.role)}</span>` : '',
    c.language ? `<span class="pill">${esc(c.language)} 자막 · 목소리</span>` : ''
  ].join('');
  let html = `<section class="pane-sec">
    <button class="back" type="button" data-back>${ARROW_LEFT}전체 나라</button>
    <h2 class="d-name">${esc(c.name)}</h2>
    <div class="pills">${pills}</div>
    ${c.why ? `<p class="why">${esc(c.why)}</p>` : ''}
  </section>`;
  html += `<section class="pane-sec"><h3 class="sec-title">${view.brand === 'PULSE' && c.status !== 'active' ? '만들 계정(제안)' : '계정'}</h3><div class="rows">${accRows(c.accounts)}</div></section>`;
  if (c.sharedHere && view.shared.length) {
    html += `<section class="pane-sec"><h3 class="sec-title">여기서 운영하는 공통 계정</h3><div class="rows">${accRows(view.shared)}</div></section>`;
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
  pane.innerHTML = c ? renderDetail(c) : renderList();
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
  if (view === state.view) return;
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
  el.innerHTML = `<b>${esc(c.name)}</b>${c.status === 'active' ? '운영 중' : '준비 중'} · 계정 ${c.secured}/${c.planned}`;
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
    if (event.target.closest('[data-back]')) select(null);
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
      setView(state.view === 'lab' ? 'pulse' : 'lab');
      seg.querySelector(`[data-view="${state.view}"]`)?.focus();
    });
  }
  document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); select(null); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  window.addEventListener('hashchange', () => {
    const { view, code } = readHash();
    if (view) state.view = view;
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
  const { lab, pulse } = state.world;
  document.querySelector('.top [data-count="lab"]').textContent = lab.summary.active;
  document.querySelector('.top [data-count="pulse"]').textContent = pulse.summary.active + ' · ' + pulse.summary.target;
  for (const el of document.querySelectorAll('.seg.inline [data-count="lab"]')) el.textContent = lab.summary.active;
  for (const el of document.querySelectorAll('.seg.inline [data-count="pulse"]')) el.textContent = pulse.summary.active + ' · ' + pulse.summary.target;
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
  state.view = hash.view || (remembered() === 'pulse' ? 'pulse' : 'lab');
  state.code = hash.code;
  drawLand();
  mobileTabs();
  counts();
  bind();
  render();
  centerMobileMap();
}

start();
