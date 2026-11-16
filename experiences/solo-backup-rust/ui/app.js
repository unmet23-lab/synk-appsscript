// 업무 백업 0.7.0 화면 입구 — 상태를 받아(state-store.js) 모델로 바꾸고(screen-model.js) 그린다(screen-view.js). 구(orb.js)는 켜짐 · 도는 중만 맡는다.
// 화면 이름은 이 파일 안에만 있다(주소를 바꾸지 않는다 — 네이티브는 index.html 한 주소만 허락한다, protocol.rs local_url).
// 엔진에 아직 없는 기능의 단추는 「아직 준비 중」 한 줄만 띄우고 아무것도 보내지 않는다(QA 「가짜 상태로 그린 화면」).

import { createStore, failureText } from './state-store.js';
import { homeModel, createRestoreWatch } from './screen-model.js';
import { renderScreen, drawer, SCREENS, FAKE } from './screen-view.js';
import { createOrb } from './orb.js';
import { visibleText } from './banned-words.js';
import { josa } from './ko-format.js';

// 쪽 오류를 모아 둔다(tauri-driver 시험이 읽는다)
const errs = [];
addEventListener('error', (e) => errs.push(String(e.message || e).slice(0, 200)));
addEventListener('unhandledrejection', (e) => errs.push(String(e.reason?.message || e.reason).slice(0, 200)));

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const stage = $('#stage'), room = $('#room'), topR = $('#top-r'), hereS = $('#here-s'), seg = $('#seg'), segSr = $('#seg-sr'), noteBar = $('#note');
const drawerWrap = $('#drawer'), drawerPanel = $('#drawer-panel');

let lastHtml = '', screen = 'home', shownId = null, out = null, fixture = null, catalog = null, ui = { pick: 'same' }, noteTimer = 0, findTimer = 0, lit = false;
let failure = null, queued = null, closing = null, opener = null, lastDrawer = '', lastLive = '', retryTimer = 0, shownQuery = null;
// 이 창이 지켜본 전체 되살리기가 실패했는지 — 엔진은 그 실패를 백업 실패와 같은 칸(lastError)에 적는다(Fable F2)
const restoreWatch = createRestoreWatch();
let prevJob = null, restoreFail = null;
function watchJobs(s) {
  if (!s) return;
  restoreFail = restoreWatch.see(s);
  // 예약 백업 때문에 못 연 되살리기 목록은 그 일이 끝나면 저절로 연다(Fable F5)
  if (prevJob && !s.job && screen === 'restore' && catalog?.waiting) void openCatalog();
  prevJob = s.job?.kind || null;
}
// 상태 읽기가 실패하면 그 까닭을 첫 화면에 쓴다. 호출이 끝나면 밀려 있던 찾기를 잇는다(늦게 친 글이 버려지지 않게)
const store = createStore(window.backup, { onChange: (x) => { failure = x.failure; if (!fixture) watchJobs(x.state); paint(); if (!x.busy && queued) setTimeout(flushQuery, 0); } });
const orb = createOrb($('#orb'), $('#orb-btn'));

const state = () => (fixture ? fixture.state : store.state);
const now = () => (fixture ? fixture.now : Date.now());

/** 엔진에 아직 없는 기능의 화면 — 실제 상태에서는 열지 않고 「준비 중」 한 줄만 띄운다 */
const SOON = { 'start-2': '보호 범위 고르기', 'move-1': '이 PC로 옮겨 오기', 'move-2': '이 PC로 옮겨 오기', 'move-3': '이 PC로 옮겨 오기', 'move-4': '이 PC로 옮겨 오기',
  'undo-1': '사고 되돌리기', 'undo-2': '사고 되돌리기', 'undo-3': '사고 되돌리기', lost: '분실 신고', 'lost-2': '분실 신고', code: '복구 코드 만들기', 'mass-list': '지워진 파일 목록' };
const soon = (what) => note(`${josa(what, '은/는')} 아직 준비 중입니다. 다음 업데이트에서 열립니다.`);

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
    const say = failure ? failureText(failure) : '상태를 읽는 중입니다';
    const html = `<div class="in"><p class="kick"><i class="dot" aria-hidden="true"></i>${say}</p></div>`;
    if (lastHtml !== html) { room.innerHTML = html; lastHtml = html; }
    return;
  }
  const model = homeModel(s, { now: now(), restoreFail: fixture ? null : restoreFail });
  const id = resolve(screen, s, model);
  out = renderScreen(id, { state: s, model, now: now(), catalog, ui, fake: !!fixture });
  stage.dataset.tone = out.tone; stage.dataset.kind = out.kind; stage.dataset.screen = id;
  orb.setBusy(!!s.job);
  hereS.textContent = out.here || '';
  seg.innerHTML = out.seg ? Array.from({ length: out.seg[1] }, (_, i) => `<i class="${i < out.seg[0] ? 'on' : ''}"></i>`).join('') : '';
  segSr.textContent = out.seg ? `${out.seg[1]}걸음 가운데 ${out.seg[0]}` : '';
  topR.innerHTML = out.top.map((t) => `<button class="tbtn" type="button" data-act="${t.id}">${t.label}</button>`).join('');
  const fresh = id !== shownId;
  // 같은 화면을 다시 그릴 때는 찾기 칸의 글과 커서, 목록의 스크롤, 포커스가 있던 단추나 줄을 지킨다(Fable F4 · F7)
  const active = document.activeElement, inRoom = active && room.contains(active);
  const key = inRoom ? focusKey(active) : null;
  const caret = active?.id === 'find' ? [active.selectionStart, active.selectionEnd] : null;
  const typed = active?.id === 'find' ? active.value : null;
  const sameList = id === 'restore' && (catalog?.query ?? null) === shownQuery;
  const filesTop = sameList ? room.querySelector('.files')?.scrollTop ?? 0 : 0, roomTop = room.scrollTop;
  shownQuery = id === 'restore' ? (catalog?.query ?? null) : null;
  if (fresh) { stage.classList.remove('shown'); room.scrollTop = 0; }
  if (lastHtml !== out.html) {
    room.innerHTML = out.html; lastHtml = out.html; fillBars(room, fresh);
    if (!fresh) { const files = room.querySelector('.files'); if (files) files.scrollTop = filesTop; room.scrollTop = roomTop; }
  }
  if (key) { const el = room.querySelector(key); if (el) { if (typed !== null) el.value = typed; el.focus({ preventScroll: true }); if (caret) el.setSelectionRange(...caret); } }
  const live = out.kind === 'home' ? `${model.kick}. ${model.title}` : out.here || '';
  if (live !== lastLive) { lastLive = live; $('#live').textContent = live; }
  if (fresh) {
    shownId = id;
    void room.offsetWidth; stage.classList.add('shown');
    if (!lit) { lit = true; orb.lightUp(); }
  }
  if (!drawerWrap.hidden) { const d = drawer(s); if (d !== lastDrawer) { lastDrawer = d; drawerPanel.innerHTML = d; } }
}

/** 다시 그린 뒤 같은 요소를 찾을 열쇠(id · 고른 줄 · 단추 · 고르는 칸) */
function focusKey(el) {
  const q = (k, v) => `[${k}="${CSS.escape(v)}"]`;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.dataset?.file) return q('data-file', el.dataset.file);
  if (el.dataset?.pick) return q('data-pick', el.dataset.pick);
  if (el.dataset?.act) return q('data-act', el.dataset.act);
  return null;
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
  catalog = { loading: true, query: '', rows: [] }; queued = null; paint();
  if (closing) await closing;
  if (screen !== 'restore') return;
  const opened = await store.call('openFileCatalog', { profile: s.profile });
  if (screen !== 'restore') {
    if (opened.ok && opened.value?.token) void store.call('closeFileCatalog', { profile: opened.value.profile ?? s.profile, token: opened.value.token });
    return;
  }
  if (!opened.ok) {
    const waiting = ['RUN_ACTIVE', 'JOB_BUSY', 'BUSY'].includes(opened.code);
    catalog = { loading: false, waiting, error: waiting ? '예약 백업이나 하던 일이 끝나면 저절로 엽니다.' : failureText(opened.code), rows: [] };
    clearTimeout(retryTimer);
    if (waiting) retryTimer = setTimeout(() => { if (screen === 'restore' && catalog?.waiting) void openCatalog(); }, 15000);
    paint(); return;
  }
  catalog = { ...opened.value, query: '', rows: [], offset: 0, loading: false };
  await query('', 0, false);
}
async function query(q, offset, append) {
  if (!catalog?.token) { if (catalog?.loading) queued = { q, offset, append }; return; }
  const r = await store.call('queryFileCatalog', { profile: catalog.profile, token: catalog.token, query: q, offset });
  if (!r.ok) {
    if (r.code === 'BUSY') { queued = { q, offset, append }; return; } // 앞선 호출이 끝나면 이어서 찾는다
    if (r.code === 'CATALOG_EXPIRED') return openCatalog();
    return note(failureText(r.code));
  }
  if (!catalog?.token) return;
  catalog = { ...catalog, ...r.value, rows: append ? [...catalog.rows, ...r.value.rows] : r.value.rows, offset: append ? catalog.offset : r.value.offset, query: q };
  paint();
}
function flushQuery() {
  if (!queued || store.busy || !catalog?.token) return;
  const x = queued; queued = null;
  void query(x.q, x.offset, x.append);
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
  const c = catalog; catalog = null; queued = null; clearTimeout(retryTimer);
  if (c?.token && !fixture) closing = store.call('closeFileCatalog', { profile: c.profile, token: c.token }).finally(() => { closing = null; });
}

/* ── 단추 ── */
async function run(a, el) {
  if (!a) return;
  if (a.pending) return soon(a.pending);
  if (a.drawer) return openDrawer(el);
  if (a.to && !fixture && SOON[a.to]) return soon(SOON[a.to]);
  if (a.to) return go(a.to);
  if (!a.call) return;
  if (fixture) return note('예시 화면이라 실제로 보내지 않았습니다.');
  if (a.call === 'closeWindow') { const w = window.__TAURI__?.window?.getCurrentWindow?.(); return w ? w.close() : window.close(); }
  let r;
  if (a.call === 'restoreSelected') {
    if (!catalog?.token || !catalog.selection?.count) return;
    r = await store.call('restoreSelected', { profile: catalog.profile, token: catalog.token, revision: catalog.selection.revision });
    if (r.ok && r.value?.started) { catalog = null; screen = 'home'; return go('home'); }
    if (!r.ok && (r.code === 'CATALOG_EXPIRED' || r.code === 'SELECTION_STALE')) { note(failureText(r.code)); return openCatalog(); }
  } else if (a.call === 'removeSource') r = await store.call('removeSource', el?.dataset.path ?? a.arg);
  else if (a.withProfile) r = await store.call(a.call, { profile: state()?.profile });
  else if (a.arg !== undefined) r = await store.call(a.call, a.arg);
  else r = await store.call(a.call);
  // 다른 일이 도는 중이라 거절된 것은 폴더가 없다는 뜻이 아니다(FA3)
  if (!r.ok && (a.call === 'openSelectedRestoreFolder' || a.call === 'openRestoreFolder') && !['BUSY', 'JOB_BUSY', 'CANCELED'].includes(r.code)) return note('되살린 폴더를 찾을 수 없습니다. 옮기거나 지웠다면 「파일 되살리기」로 다시 꺼내 주세요.');
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
  if (id === 'reopen') return void openCatalog();
  if (id === 'reveal') {
    const cg = $('#cg'); if (!cg) return;
    const hidden = cg.classList.toggle('hide');
    cg.setAttribute('aria-hidden', String(hidden)); el.setAttribute('aria-expanded', String(!hidden));
    el.textContent = hidden ? '글자 보기' : '글자 가리기'; return;
  }
  const inDrawer = drawerPanel.contains(el);
  const a = (!inDrawer && out?.acts?.[id]) || GLOBAL[id];
  if (inDrawer && a?.to && (fixture || !SOON[a.to])) closeDrawer();
  void run(a, el);
});
$('#orb-btn').addEventListener('click', () => { closeDrawer(); go('home'); });
room.addEventListener('input', (e) => {
  if (e.target.id !== 'find') return;
  const q = e.target.value.trim().slice(0, 200);
  clearTimeout(findTimer); findTimer = setTimeout(() => void query(q, 0, false), 250);
});

const behind = () => [$('header.top'), room];
function openDrawer(from) {
  opener = from || (document.activeElement !== document.body ? document.activeElement : null);
  drawerPanel.innerHTML = drawer(state()); drawerWrap.hidden = false;
  for (const el of behind()) if (el) el.inert = true;
  drawerPanel.focus();
}
function closeDrawer() {
  if (drawerWrap.hidden) return;
  drawerWrap.hidden = true;
  for (const el of behind()) if (el) el.inert = false;
  const back = opener && opener.isConnected ? opener : $('#orb-btn'); opener = null;
  back.focus();
}
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
  if (to === 'move') { if (state()?.configured) go('move-0'); else if (fixture) go('move-1'); else { go('home'); soon(SOON['move-1']); } return true; }
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
