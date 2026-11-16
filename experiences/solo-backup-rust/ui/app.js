// 업무 백업 0.7.0 화면 입구 — 상태를 받아(state-store.js) 모델로 바꾸고(screen-model.js) 그린다(screen-view.js). 구(orb.js)는 켜짐 · 도는 중만 맡는다.
// 화면 이름은 이 파일 안에만 있다(주소를 바꾸지 않는다 — 네이티브는 index.html 한 주소만 허락한다, protocol.rs local_url).
// 엔진에 아직 없는 기능의 단추는 「아직 준비 중」 한 줄만 띄우고 아무것도 보내지 않는다(QA 「가짜 상태로 그린 화면」).

import { createStore, failureText } from './state-store.js';
import { homeModel } from './screen-model.js';
import { renderScreen, drawer, SCREENS, FAKE } from './screen-view.js';
import { createOrb } from './orb.js';
import { visibleText } from './banned-words.js';

// 쪽 오류를 모아 둔다(tauri-driver 시험이 읽는다)
const errs = [];
addEventListener('error', (e) => errs.push(String(e.message || e).slice(0, 200)));
addEventListener('unhandledrejection', (e) => errs.push(String(e.reason?.message || e.reason).slice(0, 200)));

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const stage = $('#stage'), room = $('#room'), topR = $('#top-r'), hereS = $('#here-s'), seg = $('#seg'), segSr = $('#seg-sr'), noteBar = $('#note');
const drawerWrap = $('#drawer'), drawerPanel = $('#drawer-panel');

let lastHtml = '', screen = 'home', shownId = null, out = null, fixture = null, catalog = null, ui = { pick: 'same' }, noteTimer = 0, findTimer = 0, lit = false;
const store = createStore(window.backup, { onChange: () => paint() });
const orb = createOrb($('#orb'), $('#orb-btn'));

const state = () => (fixture ? fixture.state : store.state);
const now = () => (fixture ? fixture.now : Date.now());

function note(text) {
  noteBar.textContent = text; noteBar.classList.add('on');
  clearTimeout(noteTimer); noteTimer = setTimeout(() => noteBar.classList.remove('on'), 4200);
}

/** 기본 화면이 첫 시작 · 첫 백업일 때는 그 화면으로 */
function resolve(id, s, model) {
  if (id !== 'home') return id;
  if (s?.job?.kind === 'protect') return 'start-3';
  if (model.id === 'start') return 'start-1';
  return 'home';
}

function fillBars(root, animate) {
  for (const el of $$('[data-pct]', root)) {
    const v = `${Math.max(0, Math.min(100, Number(el.dataset.pct) || 0))}%`;
    const prop = el.classList.contains('b') ? 'height' : 'width';
    if (animate) { el.style[prop] = '0'; requestAnimationFrame(() => requestAnimationFrame(() => { el.style[prop] = v; })); } else el.style[prop] = v;
  }
}

function paint() {
  const s = state();
  if (!s) {
    if (!room.firstChild) room.innerHTML = '<div class="in"><p class="kick"><i class="dot" aria-hidden="true"></i>상태를 읽는 중입니다</p></div>';
    return;
  }
  const model = homeModel(s, { now: now() });
  const id = resolve(screen, s, model);
  out = renderScreen(id, { state: s, model, now: now(), catalog, ui });
  stage.dataset.tone = out.tone; stage.dataset.kind = out.kind; stage.dataset.screen = id;
  orb.setBusy(!!s.job);
  hereS.textContent = out.here || '';
  seg.innerHTML = out.seg ? Array.from({ length: out.seg[1] }, (_, i) => `<i class="${i < out.seg[0] ? 'on' : ''}"></i>`).join('') : '';
  segSr.textContent = out.seg ? `${out.seg[1]}걸음 가운데 ${out.seg[0]}` : '';
  topR.innerHTML = out.top.map((t) => `<button class="tbtn" type="button" data-act="${t.id}">${t.label}</button>`).join('');
  const fresh = id !== shownId;
  // 같은 화면을 다시 그릴 때는 찾기 칸의 글과 커서를 지킨다
  const active = document.activeElement, focusId = active && room.contains(active) ? active.id : null;
  const caret = focusId === 'find' ? [active.selectionStart, active.selectionEnd] : null;
  const typed = focusId === 'find' ? active.value : null;
  if (fresh) { stage.classList.remove('shown'); room.scrollTop = 0; }
  if (lastHtml !== out.html) { room.innerHTML = out.html; lastHtml = out.html; fillBars(room, fresh); }
  if (focusId) { const el = document.getElementById(focusId); if (el) { if (typed !== null) el.value = typed; el.focus(); if (caret) el.setSelectionRange(...caret); } }
  if (fresh) {
    shownId = id;
    void room.offsetWidth; stage.classList.add('shown');
    if (!lit) { lit = true; orb.lightUp(); }
  }
  if (!drawerWrap.hidden) drawerPanel.innerHTML = drawer(s);
}

function go(id) {
  if (id !== 'restore' && screen === 'restore') closeCatalog();
  screen = SCREENS.includes(id) ? id : 'home';
  if (screen === 'restore') openCatalog();
  paint();
  room.focus({ preventScroll: true });
}

/* ── 파일 되살리기 목록(엔진 openFileCatalog · queryFileCatalog · setFileSelection) ── */
async function openCatalog() {
  const s = state(); if (fixture || !s) return;
  catalog = { loading: true, query: '', rows: [] }; paint();
  const opened = await store.call('openFileCatalog', { profile: s.profile });
  if (!opened.ok) { catalog = { loading: true, error: failureText(opened.code), rows: [] }; paint(); return; }
  catalog = { ...opened.value, query: '', rows: [], offset: 0, loading: false };
  await query('', 0, false);
}
async function query(q, offset, append) {
  if (!catalog?.token) return;
  const r = await store.call('queryFileCatalog', { profile: catalog.profile, token: catalog.token, query: q, offset });
  if (!r.ok) { if (r.code === 'CATALOG_EXPIRED') return openCatalog(); if (r.code !== 'BUSY') note(failureText(r.code)); return; }
  catalog = { ...catalog, ...r.value, rows: append ? [...catalog.rows, ...r.value.rows] : r.value.rows, offset: append ? catalog.offset : r.value.offset, query: q };
  paint();
}
async function select(action, ids) {
  if (!catalog?.token) return;
  const r = await store.call('setFileSelection', { profile: catalog.profile, token: catalog.token, revision: catalog.selection.revision, action, ...(ids ? { ids } : {}) });
  if (!r.ok) { if (r.code === 'SELECTION_STALE' || r.code === 'CATALOG_EXPIRED') return openCatalog(); return note(failureText(r.code)); }
  const picked = new Set(ids || []);
  catalog = { ...catalog, ...r.value, rows: catalog.rows.map((f) => (action === 'clear' ? { ...f, selected: false } : picked.has(f.id) ? { ...f, selected: action === 'add' } : f)) };
  paint();
}
function closeCatalog() {
  if (catalog?.token && !fixture) void store.call('closeFileCatalog', { profile: catalog.profile, token: catalog.token });
  catalog = null;
}

/* ── 단추 ── */
async function run(a, el) {
  if (!a) return;
  if (a.pending) return note(`${a.pending}은 아직 준비 중입니다. 다음 판에서 이어집니다.`);
  if (a.drawer) return openDrawer();
  if (a.to) return go(a.to);
  if (!a.call) return;
  if (fixture) return note('예시 화면이라 실제로 보내지 않았습니다.');
  if (a.call === 'closeWindow') { const w = window.__TAURI__?.window?.getCurrentWindow?.(); return w ? w.close() : window.close(); }
  let r;
  if (a.call === 'restoreSelected') {
    if (!catalog?.token || !catalog.selection?.count) return;
    r = await store.call('restoreSelected', { profile: catalog.profile, token: catalog.token, revision: catalog.selection.revision });
    if (r.ok && r.value?.started) { catalog = null; screen = 'home'; return go('home'); }
  } else if (a.call === 'removeSource') r = await store.call('removeSource', el?.dataset.path ?? a.arg);
  else if (a.arg !== undefined) r = await store.call(a.call, a.arg);
  else r = await store.call(a.call);
  if (!r.ok) return r.code === 'CANCELED' ? undefined : note(failureText(r.code));
  if (a.call === 'restoreLatest' && store.state?.job) { catalog = null; screen = 'home'; return go('home'); }
  if (a.then) go(a.then);
}

const GLOBAL = {
  home: { to: 'home' }, drawer: { drawer: true }, 'drawer-close': {}, restore: { to: 'restore' },
  add: { call: 'addSources' }, drop: { call: 'removeSource' }, 'auto-on': { call: 'setAutomatic', arg: true }, 'auto-off': { call: 'setAutomatic', arg: false },
  code: { to: 'code' }, lost: { to: 'lost' }, 'undo-1': { to: 'undo-1' }, partial: { to: 'partial' }, 'partial-std': { to: 'partial-std' }, 'move-0': { to: 'move-0' }, 'mass-list': { to: 'mass-list' },
  external: { pending: '외장 드라이브 사본' }, tray: { pending: '트레이 아이콘' }, telemetry: { pending: '시범 측정 내용 보기' }, help: { pending: '도움 요청' },
};

stage.addEventListener('click', (e) => {
  const fileBtn = e.target.closest('[data-file]');
  if (fileBtn && room.contains(fileBtn)) return void select(fileBtn.getAttribute('aria-checked') === 'true' ? 'remove' : 'add', [fileBtn.dataset.file]);
  const pick = e.target.closest('[data-pick]');
  if (pick) { ui = { ...ui, pick: pick.dataset.pick }; return paint(); }
  const el = e.target.closest('[data-act]'); if (!el || el.getAttribute('aria-disabled') === 'true') return;
  const id = el.dataset.act;
  if (id === 'drawer-close') return closeDrawer();
  if (id === 'back') return go(out?.back || 'home');
  if (id === 'more' && catalog) return void query(catalog.query, (catalog.offset || 0) + catalog.rows.length, true);
  if (id === 'clear') return void select('clear');
  if (id === 'reveal') { const cg = $('#cg'); if (cg) { cg.classList.toggle('hide'); el.textContent = cg.classList.contains('hide') ? '글자 보기' : '글자 가리기'; } return; }
  const inDrawer = drawerPanel.contains(el);
  const a = (!inDrawer && out?.acts?.[id]) || GLOBAL[id];
  if (inDrawer && a?.to) closeDrawer();
  void run(a, el);
});
$('#orb-btn').addEventListener('click', () => { closeDrawer(); go('home'); });
room.addEventListener('input', (e) => {
  if (e.target.id !== 'find') return;
  const q = e.target.value.trim().slice(0, 200);
  clearTimeout(findTimer); findTimer = setTimeout(() => void query(q, 0, false), 250);
});

function openDrawer() { drawerPanel.innerHTML = drawer(state()); drawerWrap.hidden = false; drawerPanel.focus(); }
function closeDrawer() { if (drawerWrap.hidden) return; drawerWrap.hidden = true; $('#orb-btn').focus(); }
$('#drawer-dim').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => {
  const pk = e.target.closest?.('[data-pick]');
  if (pk && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pk.click(); return; }
  if (pk && /^Arrow(Up|Down|Left|Right)$/.test(e.key)) {
    e.preventDefault();
    const all = $$('[data-pick]', room), i = all.indexOf(pk), next = all[(i + (/Up|Left/.test(e.key) ? all.length - 1 : 1)) % all.length];
    ui = { ...ui, pick: next.dataset.pick }; paint(); room.querySelector(`[data-pick="${next.dataset.pick}"]`)?.focus(); return;
  }
  if (e.key !== 'Escape') return;
  if (!drawerWrap.hidden) return closeDrawer();
  if (screen !== 'home' && out?.kind === 'flow' && out.top.some((t) => t.id === 'home')) go('home');
});

// 열기 주소의 낱말(설계 4.2 「알림」 여덟 + 11-16 `move`) → 화면. 네이티브가 'backup:open' 알림으로 낱말을 넘기면 그 화면으로 간다.
// 누르기만으로 실행되는 화면은 열지 않는다 — 모두 보기 · 고르기 화면이고, 실행은 그 화면의 단추를 손님이 눌러야 한다.
// 「바뀜」 · 「상태」는 기본 화면이 엔진 상태로 갈래를 고르므로(한꺼번에 지워짐 · 점검 실패 등) 기본 화면이다.
const TOPICS = { status: 'home', changes: 'home', restore: 'restore', signin: 'home', space: 'home', folders: 'drawer', devices: 'drawer', update: 'drawer', move: 'move' };
export function openTopic(topic) {
  const to = TOPICS[topic]; if (!to) return false;
  if (to === 'drawer') { go('home'); openDrawer(); return true; }
  if (to === 'move') { go(state()?.configured ? 'move-0' : 'move-1'); return true; }
  closeDrawer(); go(to); return true;
}
try { window.__TAURI__?.event?.listen?.('backup:open', (e) => { const t = e && typeof e.payload === 'object' ? e.payload?.topic : e?.payload; if (typeof t === 'string') openTopic(t); }); } catch { /* 알림이 없는 판 */ }

// 화면 확인용 손잡이 — 시험 · 캡처 · tauri-driver가 예시 상태로 한 화면에 바로 선다. 엔진에 아무것도 보내지 않는다.
window.__wb = Object.freeze({
  screens: SCREENS, fake: FAKE,
  show(id, opt = {}) {
    if (opt.state) fixture = { state: opt.state, now: opt.now ?? Date.now() }; else if (opt.live) fixture = null;
    catalog = opt.catalog ?? null; ui = { pick: 'same', ...(opt.ui || {}) };
    closeDrawer(); screen = SCREENS.includes(id) ? id : 'home'; shownId = null; paint();
    if (opt.drawer) openDrawer();
    stage.classList.toggle('still', !!opt.still);
    if (opt.still) { stage.classList.add('shown'); fillBars(room, false); }
    return { screen: stage.dataset.screen, tone: stage.dataset.tone };
  },
  text: () => visibleText(document.body.innerHTML),
  errors: () => errs.slice(0, 20),
  live() { fixture = null; shownId = null; paint(); },
  open: openTopic,
});

void store.start();
paint();
