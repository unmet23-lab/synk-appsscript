// 업무 백업 0.7.0 화면 입구 — 상태를 받아(state-store.js) 모델로 바꾸고(screen-model.js) 그린다(screen-view.js). 구(orb.js)는 켜짐 · 도는 중만 맡는다.
// 화면 이름은 이 파일 안에만 있다(주소를 바꾸지 않는다 — 네이티브는 index.html 한 주소만 허락한다, protocol.rs local_url).
// 엔진에 아직 없는 기능의 단추는 「아직 준비 중」 한 줄만 띄우고 아무것도 보내지 않는다(QA 「가짜 상태로 그린 화면」).

import { createStore, failureText } from './state-store.js';
import { homeModel, startStep, restorePlace } from './screen-model.js';
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
let prevJob = null;
// 창이 기억하는 개통 걸음(엔진 상태에 없는 것) — 로그인 기다림 · 기기가 다 참(LIMIT_DEVICES의 기기 목록) · 저장소가 이미 있음(REPO_EXISTS) ·
// Google 걸음 확인 · 계정의 기기 목록(devicesList). 되돌리기 미리 보기(restorePlan)는 undo에 둔다
let acct = { signing: false, limit: null, repoExists: false, googleAck: false, devices: null, devicesError: null, devicesBusy: false };
let undo = null;
// 단추가 보낸 호출 — 기다리는 동안과 보내는 동안 내내 둔다. 같은 호출이 또 오면 버린다(Fable FA1 · -c FA2)
const runningCalls = new Set();
function watchJobs(s) {
  if (!s) return;
  // 예약 백업 때문에 못 연 되살리기 목록은 그 일이 끝나면 저절로 연다(Fable F5)
  if (prevJob && !s.job && screen === 'restore' && catalog?.waiting) void openCatalog();
  // 하던 일 때문에 못 읽은 기기 목록은 그 일이 끝나면 다시 읽는다(Fable F2)
  if (prevJob && !s.job && acct.devicesError) { acct = { ...acct, devicesError: null }; if (!drawerWrap.hidden || screen === 'home') void loadDevices(); }
  prevJob = s.job?.kind || null;
  const rs = s.account?.restore || null;
  if (rs) acct = { ...acct, lastRestore: rs, restoreEnded: null };
  else if (acct.lastRestore) acct = { ...acct, restoreEnded: acct.lastRestore, lastRestore: null };
}
// 상태 읽기가 실패하면 그 까닭을 첫 화면에 쓴다. 호출이 끝나면 밀려 있던 찾기를 잇는다(늦게 친 글이 버려지지 않게)
const store = createStore(window.backup, { onChange: (x) => { failure = x.failure; if (!fixture) watchJobs(x.state); paint(); if (!x.busy && queued) setTimeout(flushQuery, 0); } });
const orb = createOrb($('#orb'), $('#orb-btn'));

const state = () => (fixture ? fixture.state : store.state);
const now = () => (fixture ? fixture.now : Date.now());

/** 엔진에 아직 없는 기능의 화면 — 실제 상태에서는 열지 않고 「준비 중」 한 줄만 띄운다 */
const SOON = { 'move-1': '이 PC로 옮겨 오기', 'move-2': '이 PC로 옮겨 오기', 'move-3': '이 PC로 옮겨 오기', 'move-4': '이 PC로 옮겨 오기',
  code: '복구 코드 만들기', 'mass-list': '지워진 파일 목록' };
const soon = (what) => note(`${josa(what, '은/는')} 아직 준비 중입니다. 다음 업데이트에서 열립니다.`);

/** 실제 상태에서 아직 열 수 없는 화면이면 그 이름, 열 수 있으면 null — 되돌리기 미리 보기는 계정에 이은 PC에서만 연다 */
function notYet(to) {
  if (fixture || !to) return null;
  if (SOON[to]) return SOON[to];
  const s = state();
  // 복구 전용 연결에서는 엔진이 되돌리기 실행을 받지 않는다(OTHER_BACKUP — Fable 둘째 F1, 조율 세션에 부탁)
  if ((to === 'undo-1' || to === 'undo-2') && !(s?.account?.connected && s?.configured && s?.mode !== 'restore')) return '사고 되돌리기';
  if (to === 'undo-3' && !s?.account?.restore) return '사고 되돌리기';
  if (to === 'lost' && !(s?.account?.connected && acct.lostTarget)) return '분실 신고';
  if (to === 'lost-2' && !s?.account?.connected) return '분실 신고';
  return null;
}

function note(text, holdMs = 4200) {
  noteBar.textContent = text; noteBar.classList.add('on');
  clearTimeout(noteTimer); noteTimer = setTimeout(() => noteBar.classList.remove('on'), holdMs);
}

/** 기본 화면이 첫 시작 · 첫 백업일 때는 그 화면으로 */
function resolve(id, s, model) {
  if (id !== 'home') return id;
  if (s?.job?.kind === 'protect') return 'start-3';
  if (model.id === 'start') return startStep(s) === 'signin' ? 'start-1' : 'start-2';
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
  if (screen === 'undo-3' && s?.account?.restore?.state === 'failed' && s.account.restore.jobId) acct.undoSeen = s.account.restore.jobId;
  const model = homeModel(s, { now: now(), undoSeen: acct.undoSeen || null });
  const id = resolve(screen, s, model);
  if (!fixture) prepare(id, s);
  out = renderScreen(id, { state: s, model, now: now(), catalog, ui, acct, undo, fake: !!fixture });
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
  if (!drawerWrap.hidden) {
    const d = drawer(s, { devices: acct.devices, devicesError: acct.devicesError, now: now() });
    if (d !== lastDrawer) {
      // 기기 목록이 늦게 와 서랍을 다시 그려도 키보드 포커스를 그 단추에 둔다(카본 A7)
      const a = document.activeElement, k = a && drawerPanel.contains(a) && a !== drawerPanel ? focusKey(a) : null;
      lastDrawer = d; drawerPanel.innerHTML = d;
      if (k) drawerPanel.querySelector(k)?.focus({ preventScroll: true });
    }
  }
}

/** 다시 그린 뒤 같은 요소를 찾을 열쇠(id · 고른 줄 · 단추 · 고르는 칸) */
function focusKey(el) {
  const q = (k, v) => `[${k}="${CSS.escape(v)}"]`;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.dataset?.file) return q('data-file', el.dataset.file);
  if (el.dataset?.pick) return q('data-pick', el.dataset.pick);
  if (el.dataset?.path) return q('data-path', el.dataset.path); // 서랍의 폴더 「빼기」는 같은 data-act가 여럿이다
  if (el.dataset?.act) return q('data-act', el.dataset.act);
  return null;
}

function go(id) {
  if (id !== 'restore' && screen === 'restore') { closeCatalog(); ui = { ...ui, confirmAll: false }; }
  screen = SCREENS.includes(id) ? id : 'home';
  if (screen === 'restore') openCatalog();
  // 되돌리기 화면을 떠나면 찾은 시각을 버린다 — 다시 들어오면 새로 찾는다(서버가 5분 동안 같은 답을 준다)
  if (!screen.startsWith('undo-')) undo = null;
  if (screen === 'undo-1' && !fixture && !undo?.value && !undo?.loading) void loadPlan();
  paint();
  room.focus({ preventScroll: true });
}

/* ── 개통(engine/src/account.cjs) ── */
/** 그 화면이 엔진에서 먼저 읽을 것 — 보호 범위는 b2 프로필의 고른 폴더를, 다른 PC가 쓰는 계정은 기기 목록을 */
function prepare(id, s) {
  // 한 번만 시도한다 — 그리기마다 부르면 실패나 BUSY가 그리기를 다시 부르며 돈다
  if (id === 'start-2' && startStep(s) === 'scope' && s.profile !== 'b2' && !acct.switchTried) {
    acct.switchTried = true; setTimeout(() => void store.call('selectProfile', 'b2'), 0);
  }
  if (id === 'start-2' && startStep(s) === 'read' && acct.devices === null && !acct.devicesError && !acct.devicesBusy) setTimeout(() => void loadDevices(), 0);
}
/** 다른 호출(단추 · 목록 읽기)이 끝날 때까지 기다린다 — 창의 호출은 한 번에 하나라 겹치면 BUSY로 튕긴다(카본 A1) */
async function untilFree(limitMs = 60000) {
  for (let waited = 0; store.busy && waited < limitMs; waited += 250) await new Promise((r) => setTimeout(r, 250));
  return !store.busy;
}
async function loadDevices() {
  if (fixture || !state()?.account?.connected || acct.devicesBusy) return;
  acct.devicesBusy = true;
  let r;
  try { r = (await untilFree()) ? await store.call('devicesList') : { ok: false, code: 'BUSY' }; } finally { acct.devicesBusy = false; }
  // 읽지 못하면 빈 목록이 아니라 「읽지 못함」이다 — 다른 기기가 없다고 말하지 않는다(카본 A2). 서랍을 다시 열면 다시 읽는다
  acct = r.ok && Array.isArray(r.value) ? { ...acct, devices: r.value, devicesError: null } : { ...acct, devices: null, devicesError: failureText(r.code) };
  paint();
}
/** Google로 시작 — 브라우저 로그인을 기다린다(5분이면 엔진이 REAUTH로 끝낸다) */
async function signIn() {
  const s = state();
  if (s?.account && s.account.available === false) return note(failureText('NO_GOOGLE'));
  acct = { ...acct, signing: true, limit: null }; paint();
  const r = await store.call('signInGoogle', {});
  acct = { ...acct, signing: false, devices: null };
  if (!r.ok) {
    if (r.code === 'LIMIT_DEVICES') acct = { ...acct, limit: Array.isArray(r.details?.devices) ? r.details.devices : [] };
    else if (['REAUTH', 'DENIED', 'CANCELED'].includes(r.code)) note('Google 로그인을 마치지 않았습니다. 다시 눌러 주세요.');
    else note(failureText(r.code));
  }
  paint();
}
/** 사고 되돌리기 — 서버가 찾은 시각과 그 시각의 계획(restorePlan). 계획은 시각마다 한 번만 묻는다(서버 하루 20번) */
async function loadPlan(at) {
  if (fixture) return;
  if (at === undefined) undo = { loading: true, plans: {} };
  else undo = { ...undo, pickAt: at, planError: null };
  paint();
  const r = (await untilFree()) ? await store.call('restorePlan', ...(at === undefined ? [] : [at])) : { ok: false, code: 'BUSY' };
  if (!screen.startsWith('undo-')) return; // 그사이 화면을 떠났다 — 다시 들어오면 새로 찾는다(카본 A8)
  if (!r.ok) {
    if (at === undefined) undo = { error: r.code === 'BUSY' ? failureText('BUSY') : failureText(r.code), plans: {} };
    else undo = { ...undo, planError: failureText(r.code) };
    return paint();
  }
  const v = r.value || {};
  const plans = { ...(undo?.plans || {}) };
  if (v.plan && Number.isFinite(Number(v.plan.at))) plans[Number(v.plan.at)] = v.plan;
  undo = at === undefined ? { value: v, plans, pickAt: Number(v.plan?.at ?? v.suggestions?.[0]?.at) } : { ...undo, value: { ...undo.value, plan: v.plan ?? undo.value?.plan }, plans };
  paint();
}

/**
 * 다른 PC가 쓰는 계정을 이 PC에서 이어서 백업한다(조율 세션 c725f319c 부탁 12): 계정의 백업을 열고(openAccountBackup —
 * 열기 전에 고른 폴더를 설정에 옮겨 적는다) → 쓰는 자리를 이 PC로(takeWriteSeat — 폴더를 먼저 검사한다) → 예약과 첫 백업(continueBackup).
 * 분실 신고 뒤 받은 출입증이 없으면(READ_KEY) Google 걸음을 확인한 경우에만 rotateReadKey로 먼저 받는다.
 * 중간에 멈추면 기본 화면(복구 전용 · 읽기 역할)의 같은 단추로 잇는다.
 */
/** 다른 PC가 쓰는 계정을 이 PC에서 되살리기만 하는 연결로 연다. 분실 신고 뒤(Google 걸음)에는 확인한 뒤 새 읽기 출입증부터 받는다(Fable 둘째 F2) */
async function openRead() {
  const s = state(), step = !!s?.account?.googleStepRequired;
  if (step && !acct.googleAck) return note(failureText('GOOGLE_STEP'));
  if (step) { const k = await store.call('rotateReadKey', { googleStepDone: true }); if (!k.ok) return k.code === 'CANCELED' ? undefined : note(failureText(k.code)); }
  const r = await store.call('openAccountBackup');
  if (!r.ok) { if (r.code === 'READ_KEY') void store.refresh(); return r.code === 'CANCELED' ? undefined : note(failureText(r.code)); }
  acct = { ...acct, googleAck: false };
  return go('home');
}
async function takeOver() {
  const s = state();
  if (s?.account?.googleStepRequired && !acct.googleAck) return note(failureText('GOOGLE_STEP'));
  const stop = (r) => (r.code === 'CANCELED' ? undefined : note(failureText(r.code)));
  if (!s?.configured) {
    let r = await store.call('openAccountBackup');
    if (!r.ok && r.code === 'READ_KEY' && acct.googleAck) {
      const k = await store.call('rotateReadKey', { googleStepDone: true });
      if (!k.ok) return stop(k);
      r = await store.call('openAccountBackup');
    }
    if (!r.ok) { if (r.code === 'READ_KEY') void store.refresh(); return stop(r); }
  }
  const t = await store.call('takeWriteSeat', {});
  if (!t.ok) return stop(t);
  const c = await store.call('continueBackup', { googleStepDone: acct.googleAck === true });
  if (!c.ok) return stop(c);
  acct = { ...acct, take: false, googleAck: false };
  return go('home');
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
  if (a.confirmAll) {
    ui = { ...ui, confirmAll: true }; paint();
    $('#live').textContent = [...(room.querySelector('#confirm-all')?.childNodes || [])].map((n) => n.textContent.trim()).filter(Boolean).join(' ');
    room.querySelector('[data-act="restore-all-go"]')?.focus({ preventScroll: true }); return;
  }
  if (a.call === 'restoreLatest' && ui.confirmAll) ui = { ...ui, confirmAll: false };
  if (a.pending) return soon(a.pending);
  if (a.drawer) return openDrawer(el);
  if (a.to && notYet(a.to)) return soon(notYet(a.to));
  if (a.to) return go(a.to);
  if (!a.call && !a.flow) return;
  if (fixture) return note('예시 화면이라 실제로 보내지 않았습니다.');
  if (a.signin) return signIn();
  // 같은 호출이 이미 기다리거나 도는 중이면 버린다 — 두 번 눌러 폴더 고르기 창이 다시 뜨지 않게(프로필 바꾸기를 먼저 보내는 단추도 같다).
  // 다른 호출(기기 목록 읽기 · 시각 찾기)이 잡고 있을 때만 잠깐 기다렸다 보낸다
  const key = a.call || a.flow;
  if (runningCalls.has(key)) return;
  runningCalls.add(key);
  // 도는 동안 그 단추를 막는다 — 창 상태(acct.running)에 두어 화면을 다시 그려도 막힌 채 나온다(Fable FA2).
  // Google 안내: takeWriteSeat는 늘 브라우저를 연다. rotateReadKey는 받아 둔 열쇠가 없을 때만 열어 두 경우에 다 맞는 글을 쓴다(Fable -c FA1)
  acct = { ...acct, running: a.id, googleWait: !!a.google }; paint();
  try {
    if (store.busy && !(await untilFree(15000))) return note(failureText('BUSY'));
    if (a.google) note(a.google === 'maybe' ? '브라우저가 열리면 Google 로그인을 마쳐 주세요. 5분 안에 마치지 않으면 다시 눌러야 합니다.' : '브라우저에서 Google 로그인을 마쳐 주세요. 5분 안에 마치지 않으면 다시 눌러야 합니다.', 300000);
    return await send(a, el);
  } finally {
    runningCalls.delete(key);
    acct = { ...acct, running: null, googleWait: false };
    if (a.google && /^브라우저(에서|가 열리면) Google/.test(noteBar.textContent)) noteBar.classList.remove('on');
    paint();
  }
}
/** 분실 신고 뒤 Google 계정 페이지 — 주소는 엔진이 정한다(openGoogleAccount, 조율 세션 616e9dce5). 읽기 호출이라 창의 호출 줄을 잡지 않는다.
 *  브라우저를 못 열면 넣을 주소를 한 줄로 알린다 */
async function openGoogle(kind) {
  if (fixture) return note('예시 화면이라 실제로 열지 않았습니다.');
  const r = await store.aside('openGoogleAccount', kind);
  if (r.ok) return;
  const removal = String(state()?.account?.googleRemovalUrl || acct.lost?.url || 'myaccount.google.com/connections').replace(/^[a-z]+:\/\//i, '');
  note(`브라우저를 열지 못했습니다. ${kind === 'devices' ? 'myaccount.google.com/device-activity' : kind === 'apps' ? 'myaccount.google.com/connections' : removal} 주소를 브라우저에 직접 넣어 주세요.`, 12000);
}
/** 단추 하나의 호출과 그 답의 갈래 */
async function send(a, el) {
  if (a.flow === 'takeOver') return takeOver();
  if (a.flow === 'openRead') return openRead();
  if (a.call === 'closeWindow') { const w = window.__TAURI__?.window?.getCurrentWindow?.(); return w ? w.close() : window.close(); }
  let r;
  const where = a.call === 'restoreSelected' || a.call === 'restoreLatest' ? restorePlace(state(), ui.place, now(), ui.sentDefaultAt) : null;
  const place = where?.mode ?? null;
  // 기본 자리로 보낸 때를 적어 둔다 — 그 뒤의 겹침 거절만 「다운로드에는 놓을 수 없다」로 읽는다(Fable 셋째 -b FA1).
  // 그렇게 거절된 뒤 고른 자리로 보내면 이 창에서는 고르기를 굳힌다 — 다음에 다운로드로 돌아가 같은 실패를 되풀이하지 않게(-c FA1)
  if (where) ui = where.unsafe ? { ...ui, place: 'pick' } : { ...ui, sentDefaultAt: place === 'default' ? now() : null };
  if (a.call === 'restoreSelected') {
    if (!catalog?.token || !catalog.selection?.count) return;
    r = await store.call('restoreSelected', { profile: catalog.profile, token: catalog.token, revision: catalog.selection.revision, place });
    if (r.ok && r.value?.started) { catalog = null; screen = 'home'; return go('home'); }
    if (!r.ok && (r.code === 'CATALOG_EXPIRED' || r.code === 'SELECTION_STALE')) { note(failureText(r.code)); return openCatalog(); }
  } else if (a.call === 'restoreLatest') r = await store.call('restoreLatest', { place });
  else if (a.call === 'removeSource') r = await store.call('removeSource', el?.dataset.path ?? a.arg);
  // 분실 신고 뒤에는 Google 걸음을 확인받아야 봉투를 올린다(설계 2.4 (5)(나)) — 확인했을 때만 googleStepDone
  else if (a.account) {
    if (state()?.account?.googleStepRequired && !acct.googleAck) return note(failureText('GOOGLE_STEP'));
    r = await store.call(a.call, { googleStepDone: acct.googleAck === true });
    // Google 걸음 확인은 그 한 번의 호출에만 쓴다 — 성공하면 비워, 같은 창에서 다시 걸음이 생기면 다시 확인받는다(카본 A3)
    if (r.ok) acct = { ...acct, googleAck: false };
  } else if (a.onAccountProfile) {
    // 보호 범위의 폴더는 b2 프로필에 고른다 — 새로 깐 PC의 지금 프로필은 local이다(profiles.cjs)
    if (state()?.profile !== 'b2') { const sw = await store.call('selectProfile', 'b2'); if (!sw.ok) return note(failureText(sw.code)); }
    r = await store.call(a.call);
    if (r.ok) void store.refresh();
  }
  else if (a.withProfile) r = await store.call(a.call, { profile: state()?.profile });
  else if (a.args) r = await store.call(a.call, ...a.args);
  else if (a.arg !== undefined) r = await store.call(a.call, a.arg);
  else r = await store.call(a.call);
  // 다른 일이 도는 중이라 거절된 것은 폴더가 없다는 뜻이 아니다(FA3)
  if (!r.ok && (a.call === 'openSelectedRestoreFolder' || a.call === 'openRestoreFolder') && !['BUSY', 'JOB_BUSY', 'CANCELED'].includes(r.code)) return note('되살린 폴더를 찾을 수 없습니다. 옮기거나 지웠다면 「파일 되살리기」로 다시 꺼내 주세요.');
  if (!r.ok && r.code === 'OUTPUT_UNSAFE' && place === 'default') { ui = { ...ui, place: 'pick' }; note('다운로드가 지키는 폴더와 겹쳐 그 안에는 되살릴 수 없습니다. 놓을 자리를 고르도록 바꿨으니 다시 눌러 주세요.'); return paint(); }
  if (!r.ok && r.code === 'REPO_EXISTS') { acct = { ...acct, repoExists: true }; return paint(); }
  if (!r.ok && r.code === 'GOOGLE_STEP') acct = { ...acct, googleAck: false };
  if (!r.ok) return r.code === 'CANCELED' ? undefined : note(failureText(r.code));
  if (a.call === 'startProtection' || a.call === 'continueBackup') { acct = { ...acct, repoExists: false, googleAck: false }; return go('home'); }
  // 분실 신고 → 남은 걸음 화면 · 새 복구 정보를 맡긴 뒤 → 기본 화면
  if (a.after === 'lost') { acct = { ...acct, lost: { name: acct.lostTarget?.name || '', at: Date.now(), url: r.value?.googleRemovalUrl || null, next: r.value?.next || null }, lostTarget: null, devices: null }; return go('lost-2'); }
  if (a.after === 'lost-done') { acct = { ...acct, lost: null, googleAck: false }; note('새 복구 정보를 맡겼습니다.'); return go('home'); }
  if (a.call === 'restoreChoose' && a.args?.[1] === 'continue') { note('여기서부터 이어서 매시간 백업합니다.'); return go('home'); }
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
  if (id === 'google-ack') { acct = { ...acct, googleAck: !acct.googleAck }; return paint(); }
  if (id === 'place-pick' || id === 'place-default') { ui = { ...ui, place: id === 'place-pick' ? 'pick' : 'default', confirmAll: false }; return paint(); }
  // 분실 신고 뒤의 「연결된 앱」은 신고가 준 정리 페이지(removal), 되돌리기 화면의 「연결된 앱」은 연결된 앱 페이지(apps)다(Fable 셋째 F5)
  if (id === 'g-dev' || id === 'g-app' || id === 'g-apps') return void openGoogle(id === 'g-dev' ? 'devices' : id === 'g-app' ? 'removal' : 'apps');
  if (id === 'restore-all-no') { ui = { ...ui, confirmAll: false }; paint(); room.querySelector('[data-act="restore-all"]')?.focus({ preventScroll: true }); return; }
  if (id === 'devices-reload') { acct = { ...acct, devicesError: null }; paint(); return void loadDevices(); }
  // Google 로그인 기다림을 끊는다 — 창의 호출 줄을 잡지 않는 길이라 기다리는 호출과 겹쳐도 간다. 기다리던 호출은 CANCELED로 조용히 끝난다
  if (id === 'google-cancel') { if (!fixture) void store.aside('cancelGoogle'); return; }
  if (id === 'take') { acct = { ...acct, take: true }; return paint(); }
  if (id === 'take-back') { acct = { ...acct, take: false, googleAck: false }; return paint(); }
  if (id === 'lost-dev') {
    const d = (acct.devices || []).find((x) => x && x.id === el.dataset.device);
    if (!d) return;
    acct = { ...acct, lostTarget: { id: d.id, name: d.name || '' } };
    closeDrawer(); return go('lost');
  }
  if (id === 'replan') return void loadPlan();
  if (id === 'undo-pick') {
    const at = Number(el.dataset.at); if (!Number.isFinite(at)) return;
    if (fixture) { undo = { ...undo, pickAt: at }; return paint(); }
    if (undo?.plans?.[at]) { undo = { ...undo, pickAt: at }; return paint(); }
    return void loadPlan(at);
  }
  if (id === 'reveal') {
    const cg = $('#cg'); if (!cg) return;
    const hidden = cg.classList.toggle('hide');
    cg.setAttribute('aria-hidden', String(hidden)); el.setAttribute('aria-expanded', String(!hidden));
    el.textContent = hidden ? '글자 보기' : '글자 가리기'; return;
  }
  const inDrawer = drawerPanel.contains(el);
  const a = (!inDrawer && out?.acts?.[id]) || GLOBAL[id];
  if (inDrawer && a?.to && !notYet(a.to)) closeDrawer();
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
  lastDrawer = drawer(state(), { devices: acct.devices, devicesError: acct.devicesError, now: now() });
  drawerPanel.innerHTML = lastDrawer; drawerWrap.hidden = false;
  if (!fixture && state()?.account?.connected) { acct = { ...acct, devicesError: null }; void loadDevices(); }
  for (const el of behind()) if (el) el.inert = true;
  drawerPanel.focus();
}
function closeDrawer() {
  if (drawerWrap.hidden) return;
  drawerWrap.hidden = true; drawerPanel.innerHTML = ''; lastDrawer = '';
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
    acct = { signing: false, limit: null, repoExists: false, googleAck: false, devices: null, devicesError: null, devicesBusy: false, ...(opt.acct || {}) }; undo = opt.undo ?? null;
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
