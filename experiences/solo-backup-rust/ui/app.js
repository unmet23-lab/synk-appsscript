// 업무 백업 0.7.0 화면 입구 — 상태를 받아(state-store.js) 모델로 바꾸고(screen-model.js) 그린다(screen-view.js). 구(orb.js)는 켜짐 · 도는 중만 맡는다.
// 화면 이름은 이 파일 안에만 있다(주소를 바꾸지 않는다 — 네이티브는 index.html 한 주소만 허락한다, protocol.rs local_url).
// 엔진에 아직 없는 기능의 단추는 「아직 준비 중」 한 줄만 띄우고 아무것도 보내지 않는다(QA 「가짜 상태로 그린 화면」).

import { createStore, failureText } from './state-store.js';
import { homeModel, startStep, restorePlace, afterUndo, moveJob, moveOpen, moveFrom, moveTakeList, moveVolumes, pickedSources, pathKey, moveLeft, moveRows,
  appsRows, appsOutcome, APPS_MAX, movedHere, movedApps, moveBigFolders, oldFolders, oldUp, scopeFailText, restNameProblem, maskProblem, AI_TOOL_ROWS } from './screen-model.js';
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
// 쉬는 Wi-Fi · 가리는 낱말 칸에서 한글을 조합하는 중인지, 그동안 미룬 그리기가 있는지
let composing = false, composeWait = false;
// 창이 기억하는 개통 걸음(엔진 상태에 없는 것) — 로그인 기다림 · 기기가 다 참(LIMIT_DEVICES의 기기 목록) · 저장소가 이미 있음(REPO_EXISTS) ·
// Google 걸음 확인 · 계정의 기기 목록(devicesList). 되돌리기 미리 보기(restorePlan)는 undo에 둔다
let acct = { signing: false, limit: null, repoExists: false, googleAck: false, devices: null, devicesError: null, devicesBusy: false };
let undo = null;
// 창이 기억하는 옮겨 오기(엔진 moveState · moveDevices · movePreview · moveResult와 손님의 고름). 엔진 값을 아직 안 읽은 칸은 undefined다
let mv = null;
// 한 번만 읽는 것 — 그리기마다 부르면 실패나 BUSY가 그리기를 다시 부르며 돈다. 다시 읽을 때 그 열쇠를 지운다
const mvTried = new Set();
let mvRunning = false;
// 옛 PC 백업에서 꺼내기(조율 세션 793e0d6dc) — 고르는 중인 옛 PC 판의 자리 { from, folder, label, sub, level, error, code }와,
// 목록을 그 범위로 열 때의 요청(catalogScope { from, fromName, folder, label, sub }). 늦게 온 층 읽기는 oldSeq로 버린다
let old = null, catalogScope = null, oldSeq = 0;
// 프로그램 깔기(창 상태 move.reinstall)가 돌고 있었는지 — 끝나면 설정 되돌리기를 저절로 부른다(appsEnded)
let prevReinstall = false;
// 단추가 보낸 호출 — 기다리는 동안과 보내는 동안 내내 둔다. 같은 호출이 또 오면 버린다(Fable FA1 · -c FA2)
const runningCalls = new Set();
function watchJobs(s) {
  if (!s) return;
  solioSetup(s);
  // 예약 백업 때문에 못 연 되살리기 목록은 그 일이 끝나면 저절로 연다(Fable F5)
  if (prevJob && !s.job && screen === 'restore' && catalog?.waiting) void openCatalog();
  // 하던 일 때문에 못 읽은 기기 목록은 그 일이 끝나면 다시 읽는다(Fable F2)
  if (prevJob && !s.job && acct.devicesError) { acct = { ...acct, devicesError: null }; if (!drawerWrap.hidden || screen === 'home') void loadDevices(); }
  // 넘긴 뒤 첫 백업 때문에 못 읽은 「프로그램과 설정」은 그 일이 끝나면 다시 읽는다 — 이 PC에 둔 꾸러미가 없으면 엔진이 저장소를 읽는다(E19)
  if (prevJob && !s.job && screen === 'move-apps' && ['JOB_BUSY', 'RUN_ACTIVE'].includes(mv?.apps?.listError)) void openApps();
  else if (prevJob && !s.job && (screen === 'move-apps' || screen === 'move-4') && mv?.apps?.checks === null) void loadChecks();
  prevJob = s.job?.kind || null;
  const moving = !!moveJob(s);
  if (mvRunning && !moving) { mv = { ...(mv || {}), state: undefined, result: undefined }; void moveEnded(); }
  else if (!mvRunning && moving && screen === 'home' && shownId === null) screen = 'move-2';
  mvRunning = moving;
  const ri = s.move?.reinstall || null, riRun = !!ri?.running;
  if (prevReinstall && !riRun && ri) void appsEnded(ri);
  prevReinstall = riRun;
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
const SOON = { code: '복구 코드 만들기', 'mass-list': '지워진 파일 목록' };
const soon = (what) => note(what.startsWith('!') ? what.slice(1) : `${josa(what, '은/는')} 아직 준비 중입니다. 다음 업데이트에서 열립니다.`);

/** 실제 상태에서 아직 열 수 없는 화면이면 그 이름, 열 수 있으면 null — 되돌리기 미리 보기는 계정에 이은 PC에서만 연다 */
function notYet(to) {
  if (fixture || !to) return null;
  if (SOON[to]) return SOON[to];
  const s = state();
  // 복구 전용 연결도 되돌리기를 부른다(조율 세션 57c3d17e6) — 계정에 이어 백업을 연 PC면 연다
  if ((to === 'undo-1' || to === 'undo-2') && !(s?.account?.connected && s?.configured)) return '!사고 되돌리기는 Google 계정으로 시작한 PC에서 엽니다.';
  if (to === 'undo-3' && !s?.account?.restore) return '사고 되돌리기';
  if (to === 'lost' && !(s?.account?.connected && acct.lostTarget)) return '분실 신고';
  if (to === 'lost-2' && !s?.account?.connected) return '분실 신고';
  // 옮겨 오기는 계정의 백업을 되살리기 전용으로 연 새 PC에서 연다. 쓰는 PC의 「옛 PC 백업에서 꺼내기」는 다음 증분이다
  if (to === 'move-apps' && movedHere(s, mv?.state)) return null;
  if (/^move-([1-4]|apps)$/.test(to) && !moveOpen(s)) return s?.configured && s.mode !== 'restore' ? '옛 PC 백업에서 꺼내기' : '!이 PC로 옮겨 오기는 Google로 시작해 이 계정의 백업을 연 뒤에 엽니다.';
  return null;
}

function note(text, holdMs = 4200) {
  // Google 거절 글은 어느 단추에서 나든 다 읽을 만큼 둔다(Opus 대체 검수 F2)
  if (text === failureText('DENIED')) holdMs = Math.max(holdMs, 12000);
  noteBar.textContent = text; noteBar.classList.add('on');
  clearTimeout(noteTimer); noteTimer = setTimeout(() => noteBar.classList.remove('on'), holdMs);
}

/** 기본 화면이 첫 시작 · 첫 백업일 때는 그 화면으로 */
function resolve(id, s, model) {
  // 옮겨 오기가 도는 동안의 「어디에 놓을까요」는 진행 화면이다 — 도는 동안에는 미리 보기를 읽지 않는다
  if (id === 'move-1' && !fixture && moveJob(s)) return 'move-2';
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
  const model = homeModel(s, { now: now(), undoSeen: acct.undoSeen || null, move: mv?.state || null, result: mv?.result || null, checks: mv?.apps?.checks });
  const id = resolve(screen, s, model);
  if (!fixture) prepare(id, s);
  out = renderScreen(id, { state: s, model, now: now(), catalog, ui, acct, undo, mv, old, fake: !!fixture });
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
  const caret = active?.tagName === 'INPUT' && active.type !== 'checkbox' ? [active.selectionStart, active.selectionEnd] : null;
  // 한글을 조합하는 칸이 있으면 갈아 끼우지 않는다 — 조합이 끝나면(compositionend) 다시 그린다(Opus 대체 검수 F3)
  const hold = composing && inRoom && active?.tagName === 'INPUT';
  const typed = active?.id === 'find' ? active.value : null;
  const sameList = id === 'restore' ? (catalog?.query ?? null) === shownQuery : !fresh;
  const filesTop = sameList ? [...room.querySelectorAll('.files')].map((e) => e.scrollTop) : [], roomTop = room.scrollTop;
  shownQuery = id === 'restore' ? (catalog?.query ?? null) : null;
  if (fresh) { stage.classList.remove('shown'); room.scrollTop = 0; }
  if (lastHtml !== out.html && hold) composeWait = true;
  else if (lastHtml !== out.html) {
    room.innerHTML = out.html; lastHtml = out.html; fillBars(room, fresh);
    for (const [id, k] of [['rest-in', 'restDraft'], ['mask-in', 'maskDraft']]) { const el = room.querySelector(`#${id}`); if (el && ui[k]) el.value = ui[k]; }
    if (!fresh) { room.querySelectorAll('.files').forEach((e, i) => { e.scrollTop = filesTop[i] || 0; }); room.scrollTop = roomTop; }
  }
  if (key && !hold) { const el = room.querySelector(key); if (el) { if (typed !== null) el.value = typed; el.focus({ preventScroll: true }); if (caret) el.setSelectionRange(...caret); } }
  const live = out.kind === 'home' ? `${model.kick}. ${model.title}` : out.here || '';
  if (live !== lastLive) { lastLive = live; $('#live').textContent = live; }
  if (fresh) {
    shownId = id;
    void room.offsetWidth; stage.classList.add('shown');
    if (!lit) { lit = true; orb.lightUp(); }
  }
  if (!drawerWrap.hidden) {
    const d = drawer(s, { devices: acct.devices, devicesError: acct.devicesError, now: now(), moved: movedApps(s, mv?.state, mv?.apps?.checks) });
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
  // 옮겨 오기의 자리 고르기 · 옛 PC · 지킬 폴더도 같은 data-act가 여럿이다
  if (el.dataset?.mode) return `${q('data-folder', el.dataset.folder || '')}${q('data-mode', el.dataset.mode)}`;
  if (el.dataset?.from) return q('data-from', el.dataset.from);
  if (el.dataset?.name) return q('data-name', el.dataset.name);
  if (el.dataset?.folder) return `${q('data-act', el.dataset.act || '')}${q('data-folder', el.dataset.folder)}`;
  if (el.dataset?.root) return q('data-root', el.dataset.root);
  // 같은 줄의 고르는 단추와 페이지 단추는 data-app이 같다 — 페이지 단추는 종류까지, 고르는 단추는 data-act까지 본다(Fable F2)
  if (el.dataset?.app && el.dataset.kind) return `${q('data-app', el.dataset.app)}${q('data-kind', el.dataset.kind)}`;
  if (el.dataset?.app) return `${q('data-act', el.dataset.act || '')}${q('data-app', el.dataset.app)}`;
  if (el.dataset?.check) return q('data-check', el.dataset.check);
  if (el.dataset?.device) return q('data-device', el.dataset.device);
  if (el.dataset?.tool) return q('data-tool', el.dataset.tool);
  if (el.dataset?.act) return q('data-act', el.dataset.act);
  return null;
}

function go(id, scope = null) {
  if (id !== 'restore' && screen === 'restore') { closeCatalog(); ui = { ...ui, confirmAll: false }; }
  // 목록을 옛 PC 판의 범위로 여는 것은 「이 폴더 열기」로 들어올 때뿐이다 — 다른 길로 「파일 되살리기」에 오면 이 PC의 판을 연다
  if (id !== 'restore' || screen !== 'restore') catalogScope = id === 'restore' ? scope : null;
  // 옛 PC 판의 고름은 그 두 화면 사이에서만 지킨다
  if (id !== 'restore' && id !== 'restore-old') { old = null; oldSeq++; }
  // 옛 기기 이름을 못 읽었으면 이 두 화면에 올 때 한 번 더 읽는다(Opus 대체 검수 F5)
  if ((id === 'restore' || id === 'restore-old') && acct.devicesError && !acct.devicesBusy) { acct = { ...acct, devicesError: null, devices: null }; mvTried.delete('names'); }
  screen = SCREENS.includes(id) ? id : 'home';
  // 쉬는 Wi-Fi는 들어올 때마다 지금 Wi-Fi 이름을, AI 도구는 이어 온 도구 목록을 다시 읽는다(창 상태에는 창을 연 때 읽은 것만 있다)
  if (!fixture && screen === 'rest-net') void loadWifi();
  if (!fixture && screen === 'ai-tools') void loadAiTools();
  if (screen !== 'home') acct = { ...acct, solioNoMove: false, solioBox: null };
  if (screen === 'restore') openCatalog();
  // 되돌리기 화면을 떠나면 찾은 시각을 버린다 — 다시 들어오면 새로 찾는다(서버가 5분 동안 같은 답을 준다)
  if (!screen.startsWith('undo-')) undo = null;
  // 결과 없이 넘기기(옮겨 오기를 그만둠)는 그 화면에서만 — 넘기기를 떠나면 옮겨 온 결과로 돌아간다
  if (mv?.quit && screen !== 'move-4') mv = { ...mv, quit: false };
  if ((screen === 'move-apps' || screen === 'move-4') && mv?.apps?.checks === null) mvTried.delete('apps-checks');
  // 하던 일 때문에 못 읽은 목록은 그 일이 끝난 뒤 들어오면 다시 읽는다(Fable F3 — 일이 끝나는 순간 다른 화면에 있었으면 다시 읽지 않았다)
  if (screen === 'move-apps' && ['JOB_BUSY', 'RUN_ACTIVE'].includes(mv?.apps?.listError) && !state()?.job) mvTried.delete('apps');
  // 넘긴 PC에서 옮겨 오기 상태를 못 읽었으면 기본 화면에 올 때 한 번 더 읽는다(Fable FA3)
  if (screen === 'home' && mv?.stateFailed && !fixture && backingPC(state())) { mv = { ...mv, state: undefined, stateFailed: false }; mvTried.delete('state'); }
  if (screen === 'undo-1' && !fixture && !undo?.value && !undo?.loading) void loadPlan();
  paint();
  room.focus({ preventScroll: true });
}

/* ── 개통(engine/src/account.cjs) ── */
/** 이 PC가 계정의 백업을 하는 연결인지 — 넘긴 PC가 그렇다 */
const backingPC = (s) => !!(s?.configured && s.mode !== 'restore' && s.account?.connected);
/** 그 화면이 엔진에서 먼저 읽을 것 — 보호 범위는 b2 프로필의 고른 폴더를, 다른 PC가 쓰는 계정은 기기 목록을 */
function prepare(id, s) {
  // 한 번만 시도한다 — 그리기마다 부르면 실패나 BUSY가 그리기를 다시 부르며 돈다
  if (id === 'start-2' && startStep(s) === 'scope' && s.profile !== 'b2' && !acct.switchTried) {
    acct.switchTried = true; setTimeout(() => void store.call('selectProfile', 'b2'), 0);
  }
  if (id === 'start-2' && startStep(s) === 'read' && acct.devices === null && !acct.devicesError && !acct.devicesBusy) setTimeout(() => void loadDevices(), 0);
  // 넘긴 PC(이 PC가 계정의 백업을 하는 연결) — 옮겨 온 결과가 있으면 「프로그램과 설정」을 연다(E19). 기본 화면 줄과 서랍 줄을 그리려고
  // moveState를 한 번 읽고, 그 화면에서는 목록과 체크 목록을 읽는다(Fable F1 — 앞서는 복구 전용 PC가 아니면 여기서 돌아가 읽지 않았다)
  if (id === 'restore-old' && !old?.folder && mv?.result === undefined) mvOnce('result', loadMoveResult);
  // 옛 기기 이름(「작업 노트북」)은 계정의 기기 목록에서 온다 — 기본 화면이나 「파일 되살리기」로 들어오면 아직 안 읽었을 수 있다(카본 A1)
  if ((id === 'restore-old' || (id === 'restore' && mv?.state?.from)) && acct.devices === null && !acct.devicesError && !acct.devicesBusy) mvOnce('names', loadDevices);
  if (backingPC(s)) {
    if ((id === 'home' || id === 'move-apps') && mv?.state === undefined) mvOnce('state', loadMoveState);
    if (id === 'move-apps' && movedHere(s, mv?.state)) {
      mvOnce('apps', openApps);
      if (mv?.apps?.checks === null && !store.busy) mvOnce('apps-checks', loadChecks);
    }
    return;
  }
  if (!moveOpen(s)) return;
  if ((id === 'home' || /^move-([1-4]|apps)$/.test(id)) && mv?.state === undefined) mvOnce('state', loadMoveState);
  // 프로그램과 설정(4b) — 목록 뒤에 체크 목록. 넘기기 화면은 「다시 로그인할 곳 N곳 남음」에 체크 목록만 읽는다
  if (id === 'move-apps') mvOnce('apps', openApps);
  // 앞서 읽지 못한 체크 목록은 화면에 들어올 때 한 번 더 읽는다(Fable F2) — 열쇠는 go()가 지운다
  if ((id === 'move-apps' || id === 'move-4') && mv?.apps?.checks === null && !store.busy) mvOnce('apps-checks', loadChecks);
  if (id === 'move-4' && mv?.apps?.checks === undefined) mvOnce('apps-checks', loadChecks);
  if (id === 'move-1' && !moveJob(s)) mvOnce('plan', () => loadMovePlan());
  if ((id === 'move-3' || id === 'move-4') && mv?.result === undefined) mvOnce('result', loadMoveResult);
  if (id === 'move-4' && mv?.devices === undefined && !moveJob(s)) mvOnce('devices', loadMoveDevices);
  if (/^move-[1-4]$/.test(id) && acct.devices === null && !acct.devicesError && !acct.devicesBusy) mvOnce('names', loadDevices);
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
/**
 * 기기가 다 찼을 때 되살리기만 하는 기기를 끊는다(revokeDevice — 이 PC에 기기가 없어도 Google 확인만으로 된다, 화면 요청 9).
 * 끊은 줄은 목록에서 빼고(revoked) 「다시 시작」을 누르게 한다(기기가 다 찬 동안 주 단추의 이름)
 */
async function limitRevoke(deviceId) {
  const d = (acct.limit || []).find((x) => x && x.id === deviceId && x.role === 'read' && (!x.state || x.state === 'active'));
  if (!d || acct.freed) return;
  if (fixture) return note('예시 화면이라 실제로 보내지 않았습니다.');
  if (runningCalls.has('revokeDevice') || acct.signing) return;
  runningCalls.add('revokeDevice');
  acct = { ...acct, running: 'limit-revoke', revoking: d.id, googleWait: true, limitWhy: null }; paint();
  try {
    if (store.busy && !(await untilFree(15000))) return note(failureText('BUSY'));
    note('브라우저에서 Google 로그인을 마쳐 주세요. Google Drive가 적힌 칸이 나오면 켜고 「계속」을 눌러 주세요. 5분 안에 마치지 않으면 다시 눌러야 합니다.', 300000);
    const r = await store.call('revokeDevice', d.id);
    const name = String(d.name || '').trim() || '이름 없는 기기';
    if (r.ok) { acct = { ...acct, limit: (acct.limit || []).map((x) => (x && x.id === d.id ? { ...x, state: 'revoked' } : x)), freed: name }; note(`「${name}」 연결을 끊었습니다. 「다시 시작」을 눌러 주세요.`, 9000); }
    else if (r.code === 'DENIED') note('Google에서 허락을 받지 못해 끊지 않았습니다. 다시 눌러 Google 화면에서 「계속」까지 눌러 주세요. Google Drive가 적힌 칸이 나오면 켜 주세요.', 12000);
    else if (['REAUTH', 'CANCELED'].includes(r.code)) note('Google 로그인을 마치지 않아 끊지 않았습니다. 다시 눌러 주세요.');
    // 서버는 그때 백업하는 기기를 끊지 않는다 — 목록이 낡았다(그 사이 자리가 옮겨졌다)
    // 다른 Google 계정을 골랐거나(그 계정에 이 기기가 없다) 그 사이 다른 곳에서 끊겼다 — 공용 글 「그 요청을 찾지 못했습니다」로는 알 수 없다(Fable F1)
    else if (r.code === 'NOT_FOUND' || r.code === 'DEVICE_STATE') {
      const text = r.code === 'NOT_FOUND'
        ? `이 Google 계정에서 「${name}」${josa(name, '을/를').slice(name.length)} 찾지 못했습니다. 기기 목록을 받을 때 고른 Google 계정으로 다시 눌러 주세요. 같은 계정이었다면 「다시 시작」을 눌러 목록을 새로 받아 주세요.`
        : `「${name}」${josa(name, '은/는').slice(name.length)} 지금 백업하는 기기라 끊을 수 없습니다. 「다시 시작」을 눌러 목록을 새로 받아 주세요.`;
      acct = { ...acct, limitWhy: { name, text } }; note(text, 9000);
    }
    else note(failureText(r.code));
  } finally {
    runningCalls.delete('revokeDevice');
    acct = { ...acct, running: null, revoking: null, googleWait: false };
    if (/^브라우저에서 Google/.test(noteBar.textContent)) noteBar.classList.remove('on');
    paint();
    // 끊은 뒤에는 「끊기」가 모두 사라진다 — 포커스가 그 단추와 함께 떨어졌을 때만 다음에 누를 「다시 시작」에 둔다(Fable -b 1).
    // 기다리는 동안 손님이 다른 곳(위쪽 단추 등)으로 옮겨 둔 포커스는 끌어오지 않는다(Fable -c 1)
    const fell = !document.activeElement || document.activeElement === document.body;
    if (acct.freed && fell) room.querySelector('[data-act="google"]')?.focus({ preventScroll: true });
  }
}
/** Google로 시작 — 브라우저 로그인을 기다린다(5분이면 엔진이 REAUTH로 끝낸다). solio는 솔리오가 넘긴 처음 시작({ mode, hint }, 설계 4.13) */
async function signIn(solio = null) {
  const s = state();
  if (s?.account && s.account.available === false) return note(failureText('NO_GOOGLE'));
  // 기기를 끊는 중이면 버린다 — 목록을 먼저 지우고 BUSY로 끝나지 않게(단추도 그동안 막힌다)
  if (acct.signing || runningCalls.has('revokeDevice')) return;
  acct = { ...acct, signing: true, limit: null, freed: null, limitWhy: null, denied: false, solio: solio?.mode || null, solioNoMove: false };
  if (/^Google(에서 허락을 받지 못| 로그인을 마치지 않)/.test(noteBar.textContent)) noteBar.classList.remove('on');
  paint();
  const r = await store.call('signInGoogle', solio?.hint ? { hint: solio.hint } : {});
  acct = { ...acct, signing: false, devices: null, solio: null };
  if (!r.ok) {
    if (r.code === 'LIMIT_DEVICES') acct = { ...acct, limit: Array.isArray(r.details?.devices) ? r.details.devices : [] };
    // Drive 칸을 켜지 않았거나 Google 화면에서 그만둠(DENIED) — 다시 누르기 전에 그 칸을 상자로도 보인다
    else if (r.code === 'DENIED') { acct = { ...acct, denied: true }; note(failureText('DENIED'), 12000); }
    else if (['REAUTH', 'CANCELED'].includes(r.code)) note('Google 로그인을 마치지 않았습니다. 다시 눌러 주세요.');
    else note(failureText(r.code));
  } else if (solio?.mode === 'move') solioMove();
  paint();
}
/**
 * 솔리오가 넘긴 처음 시작(state.solio.setup — 엔진 창이 떠 있는 동안 요청 파일에서 받아 30분 둔다, 설계 4.13). 손님은 솔리오에서 이미
 * 눌렀으므로 「Google로 시작」을 건너뛰고 Google 로그인을 바로 연다. 같은 요청(at)은 한 번만 — 로그인을 마치지 않아도 되풀이하지 않고
 * 「Google로 시작」 화면으로 남긴다(signInGoogle을 부르면 엔진이 setup을 지운다)
 */
function solioSetup(s) {
  const st = s?.solio?.setup;
  if (!st || typeof st.at !== 'string' || acct.setupAt === st.at || s.job) return;
  acct = { ...acct, setupAt: st.at };
  const mode = st.mode === 'move' ? 'move' : 'protect';
  // 이미 설정한 PC(옮겨 온 백업을 되살리기만 하는 PC, 외장 드라이브만 쓰는 PC)는 엔진이 요청을 받지만 이 창이 바로 이을 길이 없다 —
  // 말없이 버리지 않고 기본 화면에 그 까닭과 이 PC에서 할 수 있는 다음 걸음을 쓴다(Opus 대체 검수 F2)
  if (s.configured) { acct = { ...acct, solioBox: { mode, restore: s.mode === 'restore' } }; closeDrawer(); if (screen !== 'home') go('home'); else paint(); return; }
  if (startStep(s) === 'signin') { closeDrawer(); if (screen !== 'home') go('home'); setTimeout(() => void signIn({ mode, hint: typeof st.hint === 'string' ? st.hint : null }), 0); }
  else if (mode === 'move') setTimeout(solioMove, 0);
}
/** 솔리오의 「이 PC로 옮겨 오기」 — 다른 PC가 이 계정을 백업하고 있으면 옮겨 오기를 바로 연다(Google 걸음 · 실패는 openAccount가 알린다). 아니면 그 까닭을 보인다 */
function solioMove() {
  const step = startStep(state());
  if (step === 'read') void openMove();
  else if (step === 'scope') { acct = { ...acct, solioNoMove: true }; paint(); }
}
/* ── 솔리오 잇기 — 쉬는 Wi-Fi(설계 4.14) · AI 도구(4.16) ── */
let wifiSeq = 0;
/** 지금 이어진 Wi-Fi 이름 — 그 메서드가 없는 엔진 판이거나 실패하면 false(화면은 직접 적는 칸만 둔다), 못 읽으면 null */
async function loadWifi() {
  const seq = ++wifiSeq;
  ui = { ...ui, wifi: undefined };
  const r = await store.aside('wifiName');
  if (seq !== wifiSeq || screen !== 'rest-net') return;
  ui = { ...ui, wifi: r.ok ? (typeof r.value === 'string' && r.value ? r.value : null) : false }; paint();
}
/** MCP로 이어 온 도구 목록 — 창 상태의 것은 창을 연 때 읽은 것이다 */
async function loadAiTools() {
  const r = await store.aside('aiToolsState');
  if (screen !== 'ai-tools' || !r.ok || !Array.isArray(r.value?.clients)) return;
  ui = { ...ui, aiClients: r.value.clients }; paint();
}
/** 지운 줄 다음 줄의 「빼기」(없으면 앞 줄, 그것도 없으면 이름 칸) — 지운 단추와 함께 포커스가 떨어지지 않게(Opus 대체 검수 F5) */
function nextDrop(act, list, gone, input) {
  const i = list.indexOf(gone), next = list[i + 1] ?? list[i - 1];
  return next === undefined ? input : `[data-act="${act}"][data-name="${CSS.escape(next)}"]`;
}
/** 더한 뒤 칸을 비운다 — 칸의 글은 그림에 넣지 않으므로 지금 칸도 직접 비운다 */
function draftOut(id) { const el = room.querySelector(`#${id}`); if (el) el.value = ''; }
/** 쉬는 Wi-Fi · AI 도구 설정을 엔진에 쓴다(답은 새 창 상태). 고르는 동안 두 화면의 단추를 막는다. focus는 끝난 뒤 옮길 곳(F5) */
async function solioSave(method, arg, done, onOk = null, focus = null) {
  if (acct.running) return false;
  acct = { ...acct, running: method }; paint();
  const r = await store.call(method, arg);
  acct = { ...acct, running: null };
  if (r.ok) { if (method === 'setAiTools') ui = { ...ui, aiClients: undefined }; onOk?.(); note(done, 5000); }
  else note(r.code === 'BAD_INPUT' ? (method === 'setRestNetworks' ? 'Wi-Fi 이름을 받지 못했습니다. 이름을 고쳐 다시 더해 주세요.' : 'AI 도구 설정을 받지 못했습니다. 다시 눌러 주세요.') : failureText(r.code));
  paint();
  // 키보드로 누른 단추가 그림과 함께 사라졌으면 정한 곳으로(그 사이 손님이 옮겨 둔 포커스는 두고)
  const fell = !document.activeElement || document.activeElement === document.body;
  if (r.ok && focus && fell) room.querySelector(focus)?.focus({ preventScroll: true });
  return r.ok;
}
const restNames = () => (Array.isArray(state()?.solio?.restNetworks) ? state().solio.restNetworks : []);
const aiState = () => state()?.solio?.aiTools || {};
/** typed는 칸에 적은 이름(앞뒤 빈칸을 뗀다), 아니면 지금 Wi-Fi 이름 그대로 */
function restAdd(raw, typed) {
  let name = typed ? String(raw ?? '').trim() : raw, fixed = false;
  if (typed && typeof ui.wifi === 'string' && name !== ui.wifi && name.toLowerCase() === ui.wifi.toLowerCase()) { name = ui.wifi; fixed = true; }
  const names = restNames(), why = restNameProblem(name, names);
  if (why) return note(why, 6000);
  return solioSave('setRestNetworks', [...names, name], fixed ? `대소문자를 지금 이어진 Wi-Fi 이름에 맞춰 「${name}」 그대로 더했습니다. 이 Wi-Fi에 이어져 있는 동안 매시간 백업을 쉽니다.` : `「${name}」에 이어져 있는 동안 매시간 백업을 쉽니다.`,
    typed ? () => { ui = { ...ui, restDraft: '' }; draftOut('rest-in'); } : null, '#rest-in');
}
function restDrop(name) {
  const names = restNames();
  if (!names.includes(name)) return;
  return solioSave('setRestNetworks', names.filter((n) => n !== name), `이제 「${name}」에서도 매시간 백업합니다.`, null, nextDrop('rest-drop', names, name, '#rest-in'));
}
function aiToggle(id) {
  const t = AI_TOOL_ROWS.find((x) => x.id === id);
  if (!t) return;
  const on = aiState().tools?.[id] === true;
  return solioSave('setAiTools', { tools: { [id]: !on } }, on ? `${t.obj} 껐습니다. AI 도구가 물어도 답하지 않습니다.` : `${t.obj} 켰습니다. AI 도구가 물으면 답합니다.`);
}
function maskAdd(raw) {
  const w = String(raw ?? '').trim(), masks = Array.isArray(aiState().masks) ? aiState().masks : [], why = maskProblem(w, masks);
  if (why) return note(why, 6000);
  return solioSave('setAiTools', { tools: {}, masks: [...masks, w] }, `「${w}」 낱말이 든 경로는 이제 AI 도구에 보이지 않습니다.`, () => { ui = { ...ui, maskDraft: '' }; draftOut('mask-in'); }, '#mask-in');
}
function maskDrop(w) {
  const masks = Array.isArray(aiState().masks) ? aiState().masks : [];
  if (!masks.includes(w)) return;
  return solioSave('setAiTools', { tools: {}, masks: masks.filter((m) => m !== w) }, `「${w}」 낱말을 더는 가리지 않습니다.`, null, nextDrop('mask-drop', masks, w, '#mask-in'));
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
/** 다른 PC가 쓰는 계정을 이 PC에서 되살리기만 하는 연결로 연다. 분실 신고 뒤(Google 걸음)에는 확인한 뒤 새 읽기 출입증부터 받는다(Fable 둘째 F2).
 *  이미 열었으면 그대로 둔다. 연 뒤 참 */
async function openAccount() {
  const s = state(), step = !!s?.account?.googleStepRequired;
  if (s?.configured) return true;
  if (step && !acct.googleAck) { note(failureText('GOOGLE_STEP')); return false; }
  if (step) { const k = await store.call('rotateReadKey', { googleStepDone: true }); if (!k.ok) { if (k.code !== 'CANCELED') note(failureText(k.code)); return false; } }
  const r = await store.call('openAccountBackup');
  if (!r.ok) { if (r.code === 'READ_KEY') void store.refresh(); if (r.code !== 'CANCELED') note(failureText(r.code)); return false; }
  acct = { ...acct, googleAck: false };
  return true;
}
async function openRead() { if (await openAccount()) go('home'); }
/** 첫 시작의 「이 PC로 옮겨 오기」 — 옮겨 오기 메서드는 계정의 백업을 연 뒤에만 돈다(Fable 옮겨 오기 검토 F1) */
async function openMove() { if (!(await openAccount())) return; mvForget(); go('move-1'); }
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

/* ── 새 PC로 옮겨 오기(조율 세션 d32d25233 · moveState · folders[].roots) ── */
function mvOnce(key, fn) { if (mvTried.has(key)) return; mvTried.add(key); setTimeout(() => void fn(), 0); }
/** 읽은 옮겨 오기를 버린다 — 다시 들어오면 새로 읽는다. 엔진의 옮겨 오기 상태(state)는 남긴다 */
function mvForget() { mv = { state: mv?.state }; for (const k of ['plan', 'result', 'devices', 'apps', 'apps-checks']) mvTried.delete(k); }
const mvError = (code) => (code === 'BAD_INPUT' ? '옮겨 올 PC의 백업을 다시 찾지 못했습니다. 다시 읽어 주세요.' : failureText(code));
// 미리 보기의 실패 — 글과 함께 부호를 남긴다(목록 초과는 다시 읽어도 같아 다른 단추를 둔다, Fable F1)
const mvFail = (code) => ({ error: mvError(code), errorCode: code || 'FAILED' });
/** 옮겨 오기의 지금(moveState — 읽기 호출이라 창의 호출 줄을 잡지 않는다). 못 읽으면 기본 화면에 줄을 두지 않는다 */
// 옮겨 오기 상태 읽기의 순번 — 겹친 읽기에서 늦게 온 앞선 답(특히 실패)이 나중 답을 덮지 않게 마지막 읽기의 답만 받는다(Fable -d FA1)
let moveStateSeq = 0;
async function loadMoveState() {
  const my = ++moveStateSeq;
  const r = await store.aside('moveState');
  if (my !== moveStateSeq) return;
  // 못 읽었으면 stateFailed — 넘긴 PC는 서랍을 열 때와 기본 화면에 올 때 한 번 더 읽는다(Fable FA3)
  mv = { ...(mv || {}), state: r.ok && r.value && typeof r.value === 'object' ? r.value : null, stateFailed: !r.ok };
  paint();
}
async function loadMoveResult() {
  mv = { ...(mv || {}), loading: true }; paint();
  const r = await store.aside('moveResult');
  mv = { ...mv, loading: false, result: r.ok && r.value && typeof r.value === 'object' ? r.value : null };
  paint();
}
/** 넘기기 직전에 옛 PC의 새 판을 본다(Fable F15) — 못 읽으면 권하지 않을 뿐이다 */
async function loadMoveDevices() {
  const d = (await untilFree()) ? await store.call('moveDevices') : { ok: false, code: 'BUSY' };
  mv = { ...(mv || {}), devices: d.ok && Array.isArray(d.value) ? d.value : mv?.devices ?? null };
  paint();
}
/**
 * 「어디에 놓을까요」 — 옛 기기를 고르고(moveDevices · 기기 이름은 devicesList) 그 기기의 미리 보기(movePreview)를 읽는다.
 * 멈춘 옮겨 오기를 이으면 저장된 기기와 고름을 그대로 쓴다(Fable F6). 미리 보기는 폴더마다 목록을 읽어 몇 분 걸릴 수 있다
 */
async function loadMovePlan(from) {
  mv = { ...(mv || {}), error: null, errorCode: null, preview: null, first: null, dirty: false, counting: false };
  paint();
  if (mv.state === undefined) { const st = await store.aside('moveState'); mv = { ...mv, state: st.ok && st.value && typeof st.value === 'object' ? st.value : null }; }
  if (!Array.isArray(mv.devices)) {
    const d = (await untilFree()) ? await store.call('moveDevices') : { ok: false, code: 'BUSY' };
    if (!d.ok) { mv = { ...mv, ...mvFail(d.code) }; return paint(); }
    mv = { ...mv, devices: Array.isArray(d.value) ? d.value.filter((x) => x && typeof x.from === 'string') : [] };
  }
  if (!mv.devices.length) return paint();
  // 기기 이름(devicesList)을 읽는 중이면 끝을 기다린다 — 지금 백업하는 기기를 먼저 고르기 때문이다(Fable F18)
  for (let i = 0; acct.devicesBusy && i < 240; i++) await new Promise((r) => setTimeout(r, 250));
  if (acct.devices === null) await loadDevices();
  const pick = from && mv.devices.some((d) => d.from === from) ? from : moveFrom(mv.devices, mv.state, acct.devices);
  // 멈췄거나 끝난 같은 옛 기기의 옮겨 오기가 있으면 그때 고른 자리로 센다 — 다시 돌릴 때 넘겨받기는 놓인 자리가 같아야 한다(E11, Fable F3)
  const st = mv.state, same = st?.from === pick && (st.unfinished || st.resultAt) && !st.released;
  const choices = same && st.choices && typeof st.choices === 'object' && !Array.isArray(st.choices) ? { ...st.choices } : {};
  mv = { ...mv, from: pick, choices, open: false };
  paint();
  const p = (await untilFree()) ? await store.call('movePreview', { from: pick, choices }) : { ok: false, code: 'BUSY' };
  if (mv.from !== pick) return; // 그사이 다른 기기를 골랐다
  if (!p.ok || !p.value || typeof p.value !== 'object') { mv = { ...mv, ...mvFail(p.ok ? 'FAILED' : p.code) }; return paint(); }
  const first = Object.fromEntries((Array.isArray(p.value.folders) ? p.value.folders : []).map((x) => [x.original, { files: x.files, bytes: x.bytes }]));
  mv = { ...mv, preview: p.value, first };
  paint();
}
/** 바꾼 고름으로 공간을 다시 센다 — 처음 본 폴더별 수는 그대로 두고, 그때 0이던 폴더만 채운다 */
async function moveCount() {
  if (!mv?.preview || !mv.from) return false;
  const from = mv.from, choices = mv.choices || {}, asked = JSON.stringify(choices);
  mv = { ...mv, counting: true }; paint();
  const p = (await untilFree()) ? await store.call('movePreview', { from, choices }) : { ok: false, code: 'BUSY' };
  mv = { ...mv, counting: false };
  // 세는 동안 기기나 고름이 바뀌었으면 그 답은 지금 고름의 공간이 아니다 — 바꾼 것으로 남겨 다시 세게 한다(카본 A1)
  if (mv.from !== from || JSON.stringify(mv.choices || {}) !== asked) { paint(); return false; }
  if (!p.ok || !p.value) { note(mvError(p.ok ? 'FAILED' : p.code)); paint(); return false; }
  // 미리 보기는 이번에 받을 것만 센다(E8 · E11) — 옮기는 폴더는 새로 센 수로 갈아 넣고, 「옮기지 않음」인 폴더만 처음 본 수를 둔다(Fable F3)
  const first = { ...(mv.first || {}) };
  for (const x of Array.isArray(p.value.folders) ? p.value.folders : []) if ((choices[x.original]?.mode || x.mode) !== 'skip' || !first[x.original]) first[x.original] = { files: x.files, bytes: x.bytes };
  mv = { ...mv, preview: p.value, first, dirty: false };
  paint();
  return true;
}
/** 시작 — 같은 옛 기기의 끝나지 않은 옮겨 오기는 엔진이 멈춘 곳부터 잇는다 */
async function moveStartWith(from, choices, preview = null, freshPlan = false) {
  if (!from) { mvForget(); return go('move-1'); }
  const r = await store.call('moveStart', { from, choices: choices || {} });
  if (!r.ok) {
    if (r.code === 'BAD_INPUT') { mvForget(); note('옮겨 올 PC를 다시 골라 주세요.'); return go('move-1'); }
    return r.code === 'CANCELED' ? undefined : note(failureText(r.code));
  }
  // 옛 기기 목록도 버린다 — 넘기기 화면이 옮겨 오는 동안 옛 PC가 다시 백업했는지 새로 읽어야 한다(Fable F15)
  // 미리 본 계획은 같은 기기면 남겨 진행 화면의 「옮겨 올 것」에 쓴다(Fable 화면 검수 F5)
  const plan = preview || (mv?.from === from ? mv?.preview : null) || null;
  const counted = plan ? Object.fromEntries((plan.folders || []).map((x) => [x.original, { files: x.files, bytes: x.bytes }])) : null;
  // 같은 옛 기기면 앞선 결과는 새 결과가 적힐 때까지 남는다(E13). 다른 옛 기기면 엔진이 비운다
  const same = mv?.state?.from === from;
  mv = { ...(mv || {}), from, preview: plan, first: plan ? (!freshPlan && mv?.first) || counted : null,
    result: undefined, devices: undefined, added: [], off: [], gone: [], quit: false, apps: undefined,
    state: { ...(mv?.state || {}), from, choices: choices || {}, startedAt: new Date().toISOString(), unfinished: true, resultAt: same ? mv?.state?.resultAt ?? null : null, released: null, complete: same ? mv?.state?.complete ?? null : null } };
  // 새 옮겨 오기의 프로그램 목록 · 체크 목록은 새로 읽는다(카본 A4)
  for (const k of ['result', 'plan', 'devices', 'apps', 'apps-checks']) mvTried.delete(k);
  return go('move-2');
}
async function moveGo() {
  if (!mv?.preview || !mv.from) return;
  if (mv.dirty && !(await moveCount())) return;
  if (moveVolumes(mv.preview).short.length) return note('빈 공간이 모자란 드라이브가 있습니다. 공간을 비우거나 다른 자리를 고른 뒤 다시 눌러 주세요.');
  // 받을 것이 없으면 시작하지 않는다(Fable FA4) — 멈춘 옮겨 오기를 잇는 것은 남은 것이 0이어도 확인서를 마저 쓴다
  const resuming = mv.state?.unfinished && mv.state.from === mv.from;
  // 뒷문장은 같은 옛 PC의 끝난 옮겨 오기가 있을 때만 — 화면의 hadResult와 같은 조건이다(Fable -c FA2)
  const hadResult = !!(mv.state?.resultAt && mv.state.from === mv.from);
  if (!resuming && Number(mv.preview.files) === 0 && moveRows(mv.preview, mv.choices, mv.first).places) return note(`받을 파일이 없어 시작하지 않았습니다.${hadResult ? ' 앞서 옮겨 온 파일은 고른 자리에 그대로 있습니다.' : ''}`, 9000);
  return moveStartWith(mv.from, mv.choices, mv.preview);
}
/**
 * 끝난 옮겨 오기를 다시 돌린다(「다시 옮겨 오기」 · 「한 번 더 옮겨 오기」). 엔진은 새 번호로 시작하되 앞서 놓고 그대로인 파일은 넘겨받고(E11),
 * 미리 보기는 이번에 받을 것만 센다(E8 · E11). 먼저 그 양으로 공간을 세고, 모자라면 시작하지 않는다(Fable 화면 검수 F1). 받을 것이 없으면 시작하지 않는다
 */
async function moveAgain() {
  const from = mv?.state?.from || mv?.from, choices = mv?.state?.choices || mv?.choices || {};
  if (!from) { mvForget(); return go('move-1'); }
  // 세는 동안(몇 분일 수 있다) 확인서 · 넘기기 화면이 그 사실을 말한다(Fable 화면 검수 FA2)
  mv = { ...(mv || {}), counting: true }; paint();
  let p;
  try { p = (await untilFree()) ? await store.call('movePreview', { from, choices }) : { ok: false, code: 'BUSY' }; } finally { mv = { ...(mv || {}), counting: false }; }
  if (!p.ok || !p.value) return note(mvError(p.ok ? 'FAILED' : p.code));
  const short = moveVolumes(p.value).short;
  if (short.length) return note(`${short.map((v) => `${v.drive} 드라이브`).join(', ')}의 빈 공간이 모자라 다시 옮겨 오지 않았습니다. 다시 받을 양만큼 빈 공간이 있어야 합니다. 공간을 비운 뒤 다시 눌러 주세요.`, 12000);
  if (Number(p.value.files) === 0) return note(moveLeft(mv?.result).failed ? '다시 받을 수 있는 파일이 없습니다. 옮기지 못한 파일은 까닭이 그대로라 다시 옮겨 와도 놓이지 않습니다. 확인서의 까닭을 보고 고친 뒤 다시 눌러 주세요.' : moveLeft(mv?.result).big ? '다시 받을 파일이 없습니다. 옮겨 온 파일은 고른 자리에 그대로 있고, 너무 커서 옮기지 않은 폴더는 다시 해도 옮기지 않습니다.' : '다시 받을 파일이 없습니다. 고른 자리에 모두 놓여 있습니다.', 12000);
  return moveStartWith(from, choices, p.value, true);
}
/** 끝난 옮겨 오기 — 상태와 결과를 다시 읽고, 진행 화면에 있었으면 확인서로 넘어간다 */
async function moveEnded() {
  const st = await store.aside('moveState'), res = await store.aside('moveResult');
  mv = { ...(mv || {}), state: st.ok && st.value && typeof st.value === 'object' ? st.value : null, result: res.ok && res.value && typeof res.value === 'object' ? res.value : null };
  if (screen === 'move-2' && mv.state?.resultAt && !mv.state.unfinished) return go('move-3');
  paint();
}
/** 넘기기 — 쓰는 자리를 이 PC로(takeWriteSeat — 폴더를 먼저 검사한다) → 예약과 첫 백업(continueBackup). 고른 폴더를 둘 다에 준다(설계 검토 권고 1) */
async function moveTake() {
  const s = state();
  if (s?.account?.googleStepRequired && !acct.googleAck) return note(failureText('GOOGLE_STEP'));
  const sources = moveTakeList(s, mv).checked;
  if (!sources.length || sources.length > 30) return;
  const stop = (r) => (r.code === 'CANCELED' ? undefined : note(failureText(r.code)));
  const t = await store.call('takeWriteSeat', { sources });
  // 없거나 열 수 없는 폴더는 엔진이 한꺼번에 모아 준다(E15 SOURCES_MISSING · details.paths) — 목록에서 빼고 다시 누르게 한다
  if (!t.ok && t.code === 'SOURCES_MISSING' && Array.isArray(t.details?.paths) && t.details.paths.length) {
    const gone = t.details.paths.filter((p) => typeof p === 'string');
    mv = { ...(mv || {}), gone: [...new Set([...(mv?.gone || []), ...gone])] }; paint();
    return note(`이 PC에 없거나 열 수 없는 폴더 ${gone.length}곳을 목록에서 뺐습니다. 남은 폴더를 확인한 뒤 다시 눌러 주세요.`, 9000);
  }
  if (!t.ok) return stop(t);
  const c = await store.call('continueBackup', { sources, googleStepDone: acct.googleAck === true });
  if (!c.ok) return stop(c);
  const keep = mv?.apps || null;
  // 옮겨 오기 상태는 넘긴 뒤 다시 읽는다(state: undefined) — 기본 화면 줄과 서랍 줄이 그것으로 그려진다(Fable F1)
  acct = { ...acct, googleAck: false }; mv = keep ? { apps: keep, state: undefined } : { state: undefined }; mvTried.clear();
  if (keep?.list) mvTried.add('apps');
  if (Array.isArray(keep?.checks)) mvTried.add('apps-checks');
  note('이 PC가 이어서 매시간 백업합니다.');
  return go('home');
}
/** 「끊지 않고 이 PC는 백업하지 않기」 — 실패하면 그 자리에 남는다(Fable F17) */
async function moveRelease() {
  const r = await store.call('moveRelease');
  if (!r.ok) return r.code === 'CANCELED' ? undefined : note(`${failureText(r.code)} 다시 눌러 주세요.`);
  mv = { state: { ...(mv?.state || {}), released: new Date().toISOString() } };
  for (const k of ['plan', 'result', 'devices']) mvTried.delete(k);
  note('옛 PC가 계속 백업합니다. 이 PC는 파일을 되살리기만 합니다.');
  return go('home');
}
/** 지킬 폴더 더하기 — 폴더 고르는 창(chooseSources)은 고른 것을 설정(nextSources)에 갈아 넣으므로, 화면 목록은 창이 따로 합쳐 둔다 */
async function moveAdd() {
  const before = state();
  if (before?.profile !== 'b2') { const sw = await store.call('selectProfile', 'b2'); if (!sw.ok) return note(failureText(sw.code)); }
  // 고르기 전의 목록(창 기억 off · added가 바탕이다)
  const base = moveTakeList(before, mv);
  const r = await store.call('chooseSources');
  // 창을 닫으면 CANCELED가 온다(E14) — 답이 왔으면 손님이 고른 것이다
  if (!r.ok) return r.code === 'CANCELED' ? undefined : note(failureText(r.code));
  const got = (Array.isArray(r.value) ? r.value : []).filter((p) => typeof p === 'string' && p);
  if (!got.length) return;
  // 결과 없이 넘길 때는 앞서 고른 폴더도 목록에 남긴다 — 고르는 창이 설정의 고른 폴더를 새것으로 갈아 넣기 때문이다
  const keep = mv?.result && !mv?.quit ? [] : pickedSources(before);
  // 이번에 고른 폴더는 체크를 켠다(카본 A2). 없다고 뺐던 자리도 다시 고르면 넣는다
  const gotKeys = new Set(got.map(pathKey));
  mv = { ...(mv || {}), added: [...new Set([...(mv?.added || base.added), ...keep, ...got])], off: (mv?.off || base.off).filter((k) => !gotKeys.has(k)),
    gone: (mv?.gone || []).filter((p) => !gotKeys.has(pathKey(p))) };
  paint();
}
/* ── 옮겨 오기 4b · 프로그램과 설정(엔진 moveReinstallList · moveReinstall · moveRestoreSettings · moveChecklist · moveCheck) ── */
// 창 기억은 mv.apps에 둔다. 깔기의 진행과 결과는 창 상태(move.reinstall — 작업자 기억이라 앱을 다시 켜면 사라진다)에서 읽는다
const appsOf = () => mv?.apps || {};
function setApps(patch) { mv = { ...(mv || {}), apps: { ...appsOf(), ...patch } }; }
/** 옛 PC의 프로그램 목록 — winget을 부르고 꾸러미를 읽어 몇 분 걸릴 수 있다. 깔고 있으면 다시 읽지 않는다(Fable D12) */
async function loadApps() {
  if (state()?.move?.reinstall?.running) return;
  setApps({ list: undefined, listError: null }); paint();
  const r = (await untilFree(120000)) ? await store.call('moveReinstallList') : { ok: false, code: 'BUSY' };
  setApps(r.ok && r.value && typeof r.value === 'object' ? { list: r.value, listError: null } : { list: null, listError: r.code });
  paint();
}
/** 다시 로그인할 곳 — 꾸러미만으로 나오므로 깔기와 상관없이 읽는다(Fable D10) */
async function loadChecks() {
  const r = (await untilFree(120000)) ? await store.call('moveChecklist') : { ok: false, code: 'BUSY' };
  setApps({ checks: r.ok && Array.isArray(r.value) ? r.value.filter((x) => x && typeof x.id === 'string') : appsOf().checks ?? null });
  paint();
}
/** 「프로그램과 설정」에 들어올 때 — 목록 뒤에 체크 목록(한 번에 하나씩: 둘 다 창의 호출 줄을 잡는다) */
async function openApps() { await loadApps(); if (appsOf().checks === undefined || appsOf().checks === null) await loadChecks(); }
/**
 * 고른 것 깔기(moveReinstall — 곧바로 돌아오고 뒤에서 돈다). 고른 것이 없으면 설정만 되돌린다. 깔기가 끝나면 watchJobs가
 * 설정 되돌리기를 저절로 부른다(appsEnded — 하나라도 깔렸을 때만, Fable D9)
 */
async function appsGo() {
  const a = appsOf(), view = appsRows(a.list, a.picks);
  if (a.list && a.list.wingetStatus?.ready !== true) return;
  if (!view.ids.length) return appsRestore();
  if (view.ids.length > APPS_MAX) return;
  const r = await store.call('moveReinstall', { ids: view.ids });
  if (!r.ok) return r.code === 'CANCELED' ? undefined : note(r.code === 'JOB_BUSY' ? '옮겨 오는 중이거나 프로그램을 까는 중입니다. 끝난 뒤 다시 눌러 주세요.' : failureText(r.code));
  setApps({ ran: view.ids, names: { ...(a.names || {}), ...view.names }, settings: undefined, settingsError: null });
  paint();
}
/** 깔기가 끝남 — 하나라도 깔렸으면 설정을 저절로 되돌린다. 모두 깔지 못했으면 고르는 화면에 남아 까닭을 보인다(Fable D9) */
async function appsEnded(job) {
  const out = appsOutcome(job, { ...appsRows(appsOf().list).names, ...(appsOf().names || {}) });
  // 목록은 여기서 다시 읽지 않는다 — 몇 분 동안 창의 호출 줄을 잡아 설정 되돌리기가 기다린다. 「다시 깔기」가 새로 읽는다
  // 옛 PC의 앱이 다른 판이면 엔진이 앱 설정을 쓰지 않으므로 부르지 않고 결과로 간다(카본 A1 · E21 rules-old)
  if (out?.restore && (appsOf().list?.kitProblems || []).includes('rules-old')) { setApps({ settings: [], settingsError: null }); return paint(); }
  if (out?.restore) await appsRestore();
  else paint();
}
/** 설정 되돌리기(moveRestoreSettings — 덮지 않고, 다시 불러도 같은 내용은 되돌림으로 센다). 거절되면 단추로 물러선다(D9) */
async function appsRestore() {
  setApps({ restoring: true, settingsError: null }); paint();
  let r;
  try { r = (await untilFree(120000)) ? await store.call('moveRestoreSettings') : { ok: false, code: 'BUSY' }; } finally { setApps({ restoring: false }); }
  setApps(r.ok && Array.isArray(r.value) ? { settings: r.value, settingsError: null } : { settings: undefined, settingsError: r.code || 'FAILED' });
  paint();
}
/** 「다시 깔기」 · 「목록 다시 읽기」 — 결과를 접고 목록을 새로 읽는다 */
async function appsReload() { setApps({ settings: undefined, settingsError: null, fresh: true }); mvTried.add('apps'); await openApps(); }
/** 다시 로그인할 곳 체크 — 먼저 그려 두고, 엔진에 적지 못하면 되돌리고 알린다 */
async function appsCheck(id) {
  const list = appsOf().checks; if (!Array.isArray(list)) return;
  const item = list.find((x) => x.id === id); if (!item) return;
  const done = !item.done, flip = (v) => setApps({ checks: (appsOf().checks || []).map((x) => (x.id === id ? { ...x, done: v } : x)) });
  flip(done); paint();
  if (fixture) return;
  const r = (await untilFree(120000)) ? await store.call('moveCheck', { id, done }) : { ok: false, code: 'BUSY' };
  if (!r.ok) { flip(!done); paint(); note(`체크를 적지 못했습니다. ${failureText(r.code)}`); }
}
const MOVE_FLOWS = {
  moveOpen: openMove, moveGo, moveCount, moveTake, moveRelease, moveAdd, appsGo, appsReload, appsRestore,
  moveResume: () => moveStartWith(mv?.state?.from, mv?.state?.choices),
  moveAgain,
};

/* ── 파일 되살리기 목록(엔진 openFileCatalog · queryFileCatalog · setFileSelection) ── */
async function openCatalog() {
  const s = state(); if (fixture || !s) return;
  const req = catalogScope;
  catalog = { loading: true, query: '', rows: [], req }; queued = null; paint();
  if (closing) await closing;
  if (screen !== 'restore' || catalogScope !== req) return;
  const opened = await store.call('openFileCatalog', { profile: s.profile, ...(req ? { from: req.from, folder: req.folder, ...(req.sub ? { sub: req.sub } : {}) } : {}) });
  if (screen !== 'restore' || catalogScope !== req) {
    if (opened.ok && opened.value?.token) void store.call('closeFileCatalog', { profile: opened.value.profile ?? s.profile, token: opened.value.token });
    return;
  }
  if (!opened.ok) {
    const waiting = ['RUN_ACTIVE', 'JOB_BUSY', 'BUSY'].includes(opened.code);
    // 옛 PC 판의 거절 글은 그릴 때 옛 기기 이름으로 만든다(카본 A1) — 여기는 공통 글
    catalog = { loading: false, waiting, req, errorCode: opened.code, error: waiting ? '예약 백업이나 하던 일이 끝나면 저절로 엽니다.' : failureText(opened.code), rows: [] };
    clearTimeout(retryTimer);
    if (waiting) retryTimer = setTimeout(() => { if (screen === 'restore' && catalog?.waiting) void openCatalog(); }, 15000);
    paint(); return;
  }
  catalog = { ...opened.value, req, query: '', rows: [], offset: 0, loading: false };
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
  const r = await store.call('setFileSelection', { profile: catalog.profile, token: catalog.token, revision: catalog.selection.revision, action, ...(ids ? { ids } : {}), ...(action === 'all' ? { query: catalog.query || '' } : {}) });
  if (!r.ok) {
    if (r.code === 'SELECTION_STALE' || r.code === 'CATALOG_EXPIRED') return openCatalog();
    // 모두 고르기는 이미 고른 것에 더한다 — 합이 1,000개를 넘은 까닭을 그대로 쓴다(Opus -b FA4)
    if (action === 'all' && r.code === 'SELECTION_LIMIT') return note('이미 고른 파일과 합치면 1,000개를 넘습니다. 「고른 것 비우기」 뒤 다시 눌러 주세요.', 7000);
    return note(failureText(r.code));
  }
  if (action === 'all') { catalog = { ...catalog, ...r.value }; return void query(catalog.query || '', 0, false); }
  const picked = new Set(ids || []);
  catalog = { ...catalog, ...r.value, rows: catalog.rows.map((f) => (action === 'clear' ? { ...f, selected: false } : picked.has(f.id) ? { ...f, selected: action === 'add' } : f)) };
  paint();
}
/* ── 옛 PC 백업에서 꺼내기(조율 세션 793e0d6dc — browseBackupFolder · openFileCatalog의 from · folder · sub) ── */
/** 들어오기 — 옮겨 온 PC의 옛 기기(moveState.from). 너무 커서 옮기지 않은 폴더가 하나뿐이면 그 폴더부터 연다 */
function oldStart(folder) {
  const from = mv?.state?.from;
  if (!from) return note('옮겨 온 옛 PC를 아직 읽지 못했습니다. 잠시 뒤 다시 눌러 주세요.');
  const big = moveBigFolders(mv?.result), list = oldFolders(mv?.result);
  const f = folder ? list.find((x) => x.original === folder) : big.length === 1 ? list.find((x) => x.original === big[0].original) : null;
  old = { from, folder: f?.original || null, label: f?.label || null, sub: '' };
  go('restore-old');
  if (old.folder) void oldLoad();
}
/** 한 층 읽기 — 늦게 온 답(다른 폴더로 옮긴 뒤)은 버린다 */
async function oldLoad() {
  if (!state() || !old?.folder) return;
  const my = ++oldSeq; old = { ...old, level: undefined, error: null, code: null }; paint();
  if (fixture) return;
  // 「파일 되살리기」에서 들어오면 그 화면이 연 이 PC의 목록 열기가 호출 줄을 쥐고 있다 — 2분까지 기다린다(Opus 대체 검수 F6)
  if (store.busy && !(await untilFree(120000))) { if (my === oldSeq && old) { old = { ...old, level: null, error: '앞서 열던 목록을 정리하느라 아직 읽지 못했습니다. 「다시 읽기」를 눌러 주세요.', code: 'BUSY' }; paint(); } return; }
  // 기다리는 사이 다른 층이나 화면으로 갔으면 부르지 않는다(카본 A4)
  if (my !== oldSeq || !old?.folder) return;
  const s = state(), ask = { from: old.from, folder: old.folder, sub: old.sub };
  const r = await store.call('browseBackupFolder', { profile: s.profile, from: ask.from, folder: ask.folder, ...(ask.sub ? { sub: ask.sub } : {}) });
  if (my !== oldSeq || !old) return;
  // 옛 PC 판의 거절 글은 그릴 때 옛 기기 이름으로 만든다(oldFailText) — 여기는 그 밖의 부호의 공통 글만 둔다(카본 A1)
  old = r.ok && r.value && typeof r.value === 'object' ? { ...old, level: r.value } : { ...old, level: null, code: r.code, error: failureText(r.code) };
  paint();
}
/** 고른 범위로 목록을 연다 — 「파일 되살리기」 화면이 그 범위로 그린다 */
function oldOpen() {
  if (!old?.folder || !old.level) return;
  go('restore', { from: old.from, folder: old.folder, label: old.label, sub: old.sub || '' });
}
/** 첫 목록(폴더 고르기)으로 — 판이 바뀌어 고른 자리를 못 찾았을 때도(카본 A5) */
function oldTop() {
  if (!old && !catalog?.req) return;
  oldSeq++; old = { from: old?.from || catalog.req.from, folder: null, label: null, sub: '' };
  if (screen === 'restore-old') return paint();
  go('restore-old');
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
    // 넘기기처럼 몇 분짜리 목록 읽기 뒤에 이어서 해도 되는 단추는 더 기다린다(a.wait, Fable 4b D12)
    if (store.busy && a.wait) note('앞서 읽던 목록을 다 읽은 뒤 이어서 합니다.', a.wait);
    if (store.busy && !(await untilFree(a.wait || 15000))) return note(failureText('BUSY'));
    if (a.google) note(a.google === 'maybe' ? '브라우저가 열리면 Google 로그인을 마쳐 주세요. Google Drive가 적힌 칸이 나오면 켜고 「계속」을 눌러 주세요. 5분 안에 마치지 않으면 다시 눌러야 합니다.' : '브라우저에서 Google 로그인을 마쳐 주세요. Google Drive가 적힌 칸이 나오면 켜고 「계속」을 눌러 주세요. 5분 안에 마치지 않으면 다시 눌러야 합니다.', 300000);
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
  if (a.flow && MOVE_FLOWS[a.flow]) return MOVE_FLOWS[a.flow]();
  if (a.call === 'closeWindow') { const w = window.__TAURI__?.window?.getCurrentWindow?.(); return w ? w.close() : window.close(); }
  let r;
  const where = a.call === 'restoreSelected' || a.call === 'restoreLatest' || a.call === 'restoreScope' ? restorePlace(state(), ui.place, now(), ui.sentDefaultAt) : null;
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
  // 옛 PC 판의 고른 층을 통째로 새 폴더에 받는다(restoreScope, E27) — 뒤에서 도는 되살리기라 기본 화면에서 진행과 「그만두기」를 본다
  else if (a.call === 'restoreScope') {
    if (!old?.folder) return;
    r = await store.call('restoreScope', { profile: state()?.profile, folder: old.folder, ...(old.from ? { from: old.from } : {}), ...(old.sub ? { sub: old.sub } : {}), place });
    if (r.ok) { catalog = null; return go('home'); }
    if (!(r.code === 'OUTPUT_UNSAFE' && place === 'default') && scopeFailText(r.code)) return note(scopeFailText(r.code), 9000);
  }
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
  else if (a.withProfile) r = await store.call(a.call, { profile: state()?.profile, ...(a.extra || {}) });
  else if (a.args) r = await store.call(a.call, ...a.args);
  else if (a.arg !== undefined) r = await store.call(a.call, a.arg);
  else r = await store.call(a.call);
  // 다른 일이 도는 중이라 거절된 것은 폴더가 없다는 뜻이 아니다(FA3)
  // 만들다 만 폴더(E29 — unfinished)는 지우러 여는 것이라, 없으면 이미 지운 것이다
  const unfinished = a.arg?.unfinished === true || a.extra?.unfinished === true;
  if (!r.ok && (a.call === 'openSelectedRestoreFolder' || a.call === 'openRestoreFolder') && !['BUSY', 'JOB_BUSY', 'CANCELED'].includes(r.code)) return note(unfinished ? '만들다 만 폴더를 찾을 수 없습니다. 이미 지웠다면 더 할 일은 없습니다.' : '되살린 폴더를 찾을 수 없습니다. 옮기거나 지웠다면 「파일 되살리기」로 다시 꺼내 주세요.');
  if (!r.ok && r.code === 'OUTPUT_UNSAFE' && place === 'default') { ui = { ...ui, place: 'pick' }; note('다운로드가 지키는 폴더와 겹쳐 그 안에는 되살릴 수 없습니다. 놓을 자리를 고르도록 바꿨으니 다시 눌러 주세요.'); return paint(); }
  if (!r.ok && r.code === 'REPO_EXISTS') { acct = { ...acct, repoExists: true }; return paint(); }
  if (!r.ok && r.code === 'GOOGLE_STEP') acct = { ...acct, googleAck: false };
  if (!r.ok) return r.code === 'CANCELED' ? undefined : note(failureText(r.code));
  if (a.call === 'startProtection' || a.call === 'continueBackup') { acct = { ...acct, repoExists: false, googleAck: false }; return go('home'); }
  // 분실 신고 → 남은 걸음 화면 · 새 복구 정보를 맡긴 뒤 → 기본 화면
  if (a.after === 'lost') { acct = { ...acct, lost: { name: acct.lostTarget?.name || '', at: Date.now(), url: r.value?.googleRemovalUrl || null, next: r.value?.next || null }, lostTarget: null, devices: null }; return go('lost-2'); }
  if (a.after === 'lost-done') { acct = { ...acct, lost: null, googleAck: false }; note('새 복구 정보를 맡겼습니다.'); return go('home'); }
  if (a.call === 'restoreChoose' && a.args?.[1] === 'continue') {
    const after = afterUndo(state());
    note(`되돌린 판에서 이어 갑니다.${after.text ? ` ${after.text}` : ''}`, 9000);
    // 이 PC가 다시 백업하면 알렸으니 기본 화면에 같은 줄을 또 띄우지 않는다(엔진 restoreEnded → restoreSeen).
    // 백업이 저절로 돌지 않는 끝(되살리기만 하는 PC 등)은 기본 화면 줄로 「확인」까지 남긴다(Fable F3)
    if (after.backing && typeof a.args[0] === 'string') void store.call('restoreSeen', a.args[0]);
    return go('home');
  }
  if (a.call === 'restoreLatest' && store.state?.job) { catalog = null; screen = 'home'; return go('home'); }
  // 도는 되살리기 그만두기(요청 16) — false는 그만둘 것이 없다는 뜻이다. 그 사이 끝났는지, 마무리나 실패를 적는 중인지는
  // 상태를 다시 읽어 가린다(카본 A1 — 끝난 되살리기에 「곧 끝납니다」라 하지 않게)
  if (a.call === 'cancelRestore') {
    if (r.value?.stopping) { note('되살리기를 그만두는 중입니다. 곧 멈춥니다.', 6000); return void store.refresh(); }
    await store.refresh();
    const j = store.state?.job, still = !!j && (j.kind === 'restore' || j.kind === 'restore-selected');
    return note(still ? '되살리기가 끝나 가는 중이라 그만둘 수 없습니다. 곧 결과를 이 화면에 적습니다.' : '되살리기가 이미 끝났습니다. 결과는 이 화면에 적었습니다.', 6000);
  }
  if (a.then) go(a.then);
}

const GLOBAL = {
  home: { to: 'home' }, drawer: { drawer: true }, 'drawer-close': {}, restore: { to: 'restore' },
  add: { call: 'addSources' }, drop: { call: 'removeSource' }, 'auto-on': { call: 'setAutomatic', arg: true }, 'auto-off': { call: 'setAutomatic', arg: false },
  code: { to: 'code' }, lost: { to: 'lost' }, 'undo-1': { to: 'undo-1' }, 'move-apps': { to: 'move-apps' }, partial: { to: 'partial' }, 'partial-std': { to: 'partial-std' }, 'move-0': { to: 'move-0' }, 'mass-list': { to: 'mass-list' },
  'move-count': { flow: 'moveCount' }, 'move-add': { flow: 'moveAdd' },
  'rest-net': { to: 'rest-net' }, 'ai-tools': { to: 'ai-tools' },
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
  // 옛 PC 백업에서 꺼내기의 안쪽 층은 「뒤로」가 한 칸 위다(화면의 back 값과 맞춘다, 카본 A2)
  if (id === 'back' && screen === 'restore-old' && old?.folder) { if (old.sub) { old = { ...old, sub: oldUp(old.sub) }; return void oldLoad(); } return oldTop(); }
  if (id === 'back') return go(out?.back || 'home');
  if (id === 'more' && catalog) return void query(catalog.query, (catalog.offset || 0) + catalog.rows.length, true);
  if (id === 'clear') return void select('clear');
  if (id === 'reopen') return void openCatalog();
  if (id === 'limit-revoke') return void limitRevoke(el.dataset.device);
  // 솔리오 잇기 — 설정 서랍에서 여는 쉬는 Wi-Fi · AI 도구
  if (id === 'rest-add') return void restAdd(room.querySelector('#rest-in')?.value, true);
  if (id === 'rest-here') return void restAdd(ui.wifi, false);
  if (id === 'rest-drop') return void restDrop(el.dataset.name);
  if (id === 'ai-tool') return void aiToggle(el.dataset.tool);
  if (id === 'mask-add') return void maskAdd(room.querySelector('#mask-in')?.value);
  if (id === 'mask-drop') return void maskDrop(el.dataset.name);
  // 옛 PC 백업에서 꺼내기 — 고르기는 창 안에서, 한 층 읽기와 목록 열기는 엔진에
  if (id === 'old-start') return oldStart(el.dataset.folder);
  if (id === 'old-folder') { const f = oldFolders(mv?.result).find((x) => x.original === el.dataset.folder); if (!f || !old) return; old = { ...old, folder: f.original, label: f.label, sub: '' }; return void oldLoad(); }
  if (id === 'old-in') { const n = el.dataset.name; if (!n || !old?.folder) return; old = { ...old, sub: old.sub ? `${old.sub}/${n}` : n }; return void oldLoad(); }
  if (id === 'old-up') { if (!old) return; if (old.sub) { old = { ...old, sub: oldUp(old.sub) }; return void oldLoad(); } oldSeq++; old = { from: old.from, folder: null, label: null, sub: '' }; return paint(); }
  if (id === 'old-top') return oldTop();
  if (id === 'old-reload') { if (old?.folder) return void oldLoad(); if (fixture) return; mvTried.delete('result'); mv = { ...(mv || {}), result: undefined }; return paint(); }
  if (id === 'old-open') return oldOpen();
  if (id === 'old-all') { if (fixture) return note('예시 화면이라 실제로 보내지 않았습니다.'); return void select('all'); }
  if (id === 'old-back') {
    // 판이 바뀌어 목록을 못 열었으면 고르던 층도 낡았다 — 처음부터(카본 A5)
    if (catalog?.errorCode === 'INVALID_REQUEST') return oldTop();
    if (!old && catalog?.req) old = { from: catalog.req.from, folder: catalog.req.folder, label: catalog.req.label, sub: catalog.req.sub };
    go('restore-old'); if (old?.folder && old.level === undefined) void oldLoad(); return;
  }
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
  // 옮겨 오기 — 창 안에서만 바뀌는 고름(엔진에 보내지 않는다). 공간은 「공간 다시 세기」나 시작할 때 다시 센다(Fable F12)
  if (id === 'move-open') { mv = { ...(mv || {}), open: !mv?.open }; return paint(); }
  if (id === 'move-mode') {
    const folder = el.dataset.folder, m = el.dataset.mode; if (!folder || !m) return;
    mv = { ...(mv || {}), choices: { ...(mv?.choices || {}), [folder]: m === 'sameDrive' ? { mode: 'original', sameDrive: true } : { mode: m } }, dirty: true }; return paint();
  }
  if (id === 'move-from') { const from = el.dataset.from; if (!from || from === mv?.from) return; if (fixture) { mv = { ...mv, from }; return paint(); } return void loadMovePlan(from); }
  if (id === 'move-root') {
    // 넘기기 고름은 창 기억에만 둔다(카본 A3)
    const base = moveTakeList(state(), mv), k = pathKey(el.dataset.root), off = new Set(mv?.off || base.off);
    if (off.has(k)) off.delete(k); else off.add(k);
    mv = { ...(mv || {}), off: [...off], added: mv?.added || base.added }; return paint();
  }
  // 옮겨 온 자리 열기(E6 moveOpen — 결과가 적은 자리만 연다. 창의 호출 줄을 잡지 않는 읽기다)
  if (id === 'move-folder') {
    const path = el.dataset.path; if (!path || fixture) return;
    return void store.aside('moveOpen', { path }).then((r) => { if (!r.ok) note(r.code === 'BAD_INPUT' ? '옮겨 온 결과에 없는 자리라 열지 않았습니다.' : failureText(r.code)); });
  }
  if (id === 'move-reload') { if (fixture) return; mvForget(); return void loadMovePlan(); }
  if (id === 'move-quit') { mv = { ...(mv || {}), quit: true }; return go('move-4'); }
  // 프로그램과 설정(4b) — 고르기와 펼치기는 창 안에서만 바뀐다. 체크는 엔진에 적는다
  if (id === 'app-pick') {
    const app = el.dataset.app, row = [...appsRows(appsOf().list, appsOf().picks).table, ...appsRows(appsOf().list, appsOf().picks).others].find((p) => p.id === app);
    if (!row) return;
    setApps({ picks: { ...(appsOf().picks || {}), [app]: !row.on } }); return paint();
  }
  if (id === 'app-check') return void appsCheck(el.dataset.check);
  if (id === 'app-page') {
    const app = el.dataset.app, kind = el.dataset.kind; if (!app || !['site', 'license'].includes(kind) || fixture) return;
    return void store.aside('moveOpenProgramPage', { id: app, kind }).then((r) => { if (!r.ok) note('브라우저를 열지 못했습니다. 위에 적힌 주소를 골라 복사해 주세요.', 7000); });
  }
  if (id === 'app-checks-reload') { if (fixture) return; setApps({ checks: undefined }); paint(); return void loadChecks(); }
  if (id === 'app-others' || id === 'app-manual' || id === 'app-cmds') { const k = id.slice(4); setApps({ open: { ...(appsOf().open || {}), [k]: !appsOf().open?.[k] } }); return paint(); }
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
room.addEventListener('compositionstart', () => { composing = true; });
room.addEventListener('compositionend', () => { composing = false; if (composeWait) { composeWait = false; paint(); } });
room.addEventListener('input', (e) => {
  // 쉬는 Wi-Fi · 가리는 낱말 칸 — 다시 그려도 적던 글이 남게 초안으로 둔다
  if (e.target.id === 'rest-in') { ui = { ...ui, restDraft: e.target.value }; return; }
  if (e.target.id === 'mask-in') { ui = { ...ui, maskDraft: e.target.value }; return; }
  if (e.target.id !== 'find') return;
  const q = e.target.value.trim().slice(0, 200);
  clearTimeout(findTimer); findTimer = setTimeout(() => void query(q, 0, false), 250);
});

const behind = () => [$('header.top'), room];
function openDrawer(from) {
  opener = from || (document.activeElement !== document.body ? document.activeElement : null);
  // 못 읽었으면 「읽는 중」(undefined)으로 되돌리고 다시 읽는다. 읽는 중이면 앞의 읽기를 기다린다 — 다시 읽는 사이에 서랍을 닫았다 열어도
  // 읽기가 겹치지 않는다(Fable -c FA2 · -d FA1)
  if (!fixture && backingPC(state()) && mv?.stateFailed) { mv = { ...mv, state: undefined, stateFailed: false }; mvTried.delete('state'); }
  if (!fixture && backingPC(state()) && mv?.state === undefined) mvOnce('state', loadMoveState);
  lastDrawer = drawer(state(), { devices: acct.devices, devicesError: acct.devicesError, now: now(), moved: movedApps(state(), mv?.state, mv?.apps?.checks) });
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
  // 두 칸에서 Enter는 「더하기」 — 한글을 조합하는 동안의 Enter는 버린다
  if (e.key === 'Enter' && !e.isComposing && (e.target.id === 'rest-in' || e.target.id === 'mask-in') && !e.target.readOnly) {
    e.preventDefault(); return void (e.target.id === 'rest-in' ? restAdd(e.target.value, true) : maskAdd(e.target.value));
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
  if (to === 'move') { const s = state(); if (moveOpen(s)) go(moveJob(s) ? 'move-2' : 'move-1'); else if (s?.configured) go('move-0'); else if (fixture) go('move-1'); else go('home'); return true; }
  if (to === 'restore' && screen === 'restore' && catalogScope) go('home');
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
    mv = opt.mv ?? null; mvTried.clear(); old = opt.old ?? null; catalogScope = null;
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
