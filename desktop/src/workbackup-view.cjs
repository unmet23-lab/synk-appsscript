'use strict';
// 솔리오 백업 방 안의 엔진 화면 자리(experiences/solo-backup-rust/SOLIO_ONE_CLIENT.md 2.2 · 2.4, 2026-11-26).
// 깔린 엔진의 화면 파일(workbackup-ui.cjs)을 WebContentsView 하나(space-view.cjs 짜임)에 띄우고, 그 화면의 부름만 호스트(solio-backup-host.cjs)에 넘긴다.
// - 세션은 따로(persist:workbackup-ui), 샌드박스 · 문맥 격리 · Node 없음, 새 창 거절, 쪽 옮기기 막기, workbackup-ui://app/ 밖 요청 모두 막기.
// - workbackup-ui 처리기는 이 세션에만 단다. 스킴 등록(standard · secure)은 main.cjs가 앱 준비 전에 한다.
// - 이 자리의 preload(workbackup-view-preload.cjs)는 synkBackupHost 하나(call · onState · onOpen · close)만 내놓는다. 메서드 목록은 들고 있지 않다.
// - 본체는 이 자리의 webContents · 주 프레임 · workbackup-ui://app/ 주소에서 온 부름만 받는다(fromView).
// - 방이 열리는 계정에만 자리를 만든다. 로그아웃하거나 다른 계정으로 바뀌면 자리를 닫고 bye를 보낸다.
// 시험: desktop/tests/workbackup-view.test.cjs.
const path = require('node:path');
const { createBackupHost, windowHandleText } = require('./solio-backup-host.cjs');
const { createWorkbackupUi, ORIGIN } = require('./workbackup-ui.cjs');

const PARTITION = 'persist:workbackup-ui';
const ENTRY = `${ORIGIN}/index.html`;
const TOP_MAX = 160;
/* 엔진 화면에 넘기는 낱말: 엔진의 아홉 낱말(notify.rs TOPICS)과 방이 여는 화면 둘(설정 · 보호 시작) */
const VIEW_TOPICS = Object.freeze(['status', 'folders', 'changes', 'devices', 'restore', 'space', 'signin', 'update', 'move', 'settings', 'start']);

/* 화면의 자리 알림: 꼭 {shown, top}. shown은 백업 방이 화면에 있는지, top은 방의 길(← 원클릭 › …) 아래 높이(CSS px).
   엔진 화면은 방이 보이고, 화면을 열었고, 호스트와 화면 파일이 준비됐을 때만 보인다 */
function doorPlacement(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) return null;
  const keys = Reflect.ownKeys(input);
  if (keys.length !== 2 || !keys.includes('shown') || !keys.includes('top')) return null;
  const shown = Object.getOwnPropertyDescriptor(input, 'shown'), top = Object.getOwnPropertyDescriptor(input, 'top');
  if (!('value' in shown) || !('value' in top) || typeof shown.value !== 'boolean' || typeof top.value !== 'number' || !Number.isFinite(top.value) || top.value < 0 || top.value > TOP_MAX) return null;
  return { shown: shown.value, top: top.value };
}

/* 이 자리의 화면이 보낸 부름인가: 그 webContents의 주 프레임이고, 그 프레임이 workbackup-ui://app/에 있다 */
function fromView(event, contents) {
  try {
    if (!event || !contents || contents.isDestroyed?.()) return false;
    if (event.sender !== contents) return false;
    const frame = event.senderFrame;
    if (!frame || frame !== contents.mainFrame || frame.detached === true) return false;
    return typeof frame.url === 'string' && frame.url.startsWith(`${ORIGIN}/`);
  } catch { return false; }
}

/* 이 세션이 내보내도 되는 요청: workbackup-ui://app/ 아래뿐이다 */
const requestAllowed = url => typeof url === 'string' && url.startsWith(`${ORIGIN}/`);

function createWorkbackupDoor({
  WebContentsView, session, ipcMain, getWindow, createSpaceViewHost, preload,
  openExternal, openPath, stateRoot = null, spawn, env = process.env, timers = globalThis,
  jobRunning = () => false, onChange = () => {}, packaged = false,
  createHost = createBackupHost, ui: givenUi = null, viewHost: givenViewHost = null,
} = {}) {
  // topic은 아직 화면에 넘기지 않은 낱말, current는 지금 연 화면의 낱말(방의 길 이름)이다
  let account = null, location = null, open = false, topic = null, current = null, shown = false, top = 0;
  let uiState = 'none', loaded = false, surface = null, readySeq = 0, focusNext = false, sessionReady = false;
  const ui = givenUi || createWorkbackupUi();
  const notify = () => { try { onChange(state()); } catch { /* 화면 알림은 본체의 일이다 */ } };
  const host = createHost({
    spawn, env, timers, openExternal, openPath, stateRoot,
    shown: () => shown && open,
    idle: () => { try { return jobRunning() !== true; } catch { return false; } },
    onState: value => send('workbackup:state', value),
    onChange: hostChanged,
  });
  const viewHost = givenViewHost || createSpaceViewHost({ WebContentsView, getWindow, onChange: value => { if (!value?.open) { surface = null; loaded = false; } }, onFocusBand: () => { try { onChange({ ...state(), event: 'focus-band' }); } catch {} } });

  function state() {
    const h = host.state();
    return { open, topic: open ? current : null, host: h.phase, code: h.code, ui: uiState, ready: viewReady() };
  }
  const viewReady = () => open && host.state().phase === 'ready' && uiState === 'ok' && loaded && !!surface && !surface.isDestroyed();

  function send(channel, value) {
    try { if (surface && !surface.isDestroyed() && loaded) surface.webContents.send(channel, value); } catch { /* 화면이 닫히는 중 */ }
  }

  function ensureSession() {
    if (sessionReady) return;
    const ses = session.fromPartition(PARTITION);
    ses.protocol.handle('workbackup-ui', request => ui.handle(request));
    // 이 세션은 엔진 화면 파일 말고는 아무 데도 가지 않는다
    ses.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !requestAllowed(details?.url) }));
    ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    ses.setPermissionCheckHandler(() => false);
    ses.on('will-download', event => event.preventDefault());
    sessionReady = true;
  }

  function ensureSurface() {
    if (surface && !surface.isDestroyed()) return surface;
    ensureSession();
    const created = viewHost.createSurface({
      backgroundColor: '#000000',
      webPreferences: { partition: PARTITION, preload, sandbox: true, contextIsolation: true, nodeIntegration: false, nodeIntegrationInSubFrames: false, nodeIntegrationInWorker: false, webviewTag: false, spellcheck: false, navigateOnDragDrop: false, safeDialogs: true, devTools: !packaged },
    });
    const contents = created.webContents;
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', event => event.preventDefault());
    contents.on('will-redirect', event => event.preventDefault());
    contents.on('will-frame-navigate', event => { if (!event.isMainFrame) event.preventDefault(); });
    contents.on('will-attach-webview', event => event.preventDefault());
    contents.on('did-start-loading', () => { if (surface === created) loaded = false; });
    contents.on('did-finish-load', () => {
      if (surface !== created) return;
      loaded = String(contents.getURL?.() || '').startsWith(`${ORIGIN}/`);
      deliverTopic(); layout(); notify();
    });
    contents.on('did-fail-load', (_event, _code, _text, _url, isMainFrame) => { if (surface === created && isMainFrame !== false) { loaded = false; layout(); notify(); } });
    created.once('closed', () => { if (surface === created) { surface = null; loaded = false; notify(); } });
    surface = created;
    return created;
  }

  function loadView() {
    if (!open || uiState !== 'ok') return;
    let s;
    try { s = ensureSurface(); } catch { return; }
    loaded = false;
    Promise.resolve(s.loadURL(ENTRY)).catch(() => {});
  }

  function deliverTopic() {
    if (!topic || !loaded) return;
    send('workbackup:open', topic);
    topic = null;
  }

  function layout() {
    // 길 높이(top)를 받기 전에는 띄우지 않는다. 원클릭 판이 보내는 {shown:true, top:0} 그대로 다시 열면 화면이 솔리오 띠와 길을 덮는다(Fable workbackup-solio-one-ui-20261127 F2)
    const visible = viewReady() && shown && top > 0;
    try { viewHost.place({ visible, top }); } catch { /* 창이 없다 */ }
    if (visible && focusNext) { focusNext = false; try { viewHost.focusView(); } catch {} }
  }

  function sendWindow() {
    let win = null;
    try { win = getWindow(); } catch { win = null; }
    if (!win || win.isDestroyed?.()) return;
    let text = null;
    try { text = windowHandleText(win.getNativeWindowHandle()); } catch { text = null; }
    host.setWindow(text);
  }

  /* 화면 파일 목록을 다시 읽고(F12), 맞으면 화면을 새로 싣는다 */
  function loadUi(version) {
    const seq = ++readySeq;
    uiState = 'loading';
    void Promise.resolve().then(() => ui.load(location, version)).then(result => {
      if (seq !== readySeq || host.state().phase !== 'ready') return;
      uiState = result;
      if (result === 'ok') loadView();
      layout(); notify();
    }, () => { if (seq === readySeq) { uiState = 'invalid'; layout(); notify(); } });
  }

  /* 호스트의 상태가 바뀜. 새 hello마다 화면 파일 목록을 다시 읽는다. 호스트가 끝나면(bye · 5분) 자리도 닫는다 */
  function hostChanged(h) {
    if (h.phase === 'ready') { sendWindow(); loadUi(h.version); }
    else {
      readySeq++;
      if (uiState === 'loading') uiState = 'none';
      if (h.phase === 'idle') closeDoor();
    }
    layout();
    notify();
  }

  function closeDoor() {
    open = false; topic = null; current = null; focusNext = false;
    try { surface?.destroy(); } catch {}
    surface = null; loaded = false; uiState = 'none';
    ui.unload();
    layout();
  }

  /* 방에서 화면을 연다. 호스트가 없거나 멈췄으면 띄운다. 이미 열려 있으면 낱말만 넘긴다 */
  function openDoor({ account: who, location: where, topic: word } = {}) {
    if (typeof who !== 'string' || !who || typeof where !== 'string' || !path.win32.isAbsolute(where) || !VIEW_TOPICS.includes(word)) return { ok: false, code: 'INVALID' };
    if (account !== null && account !== who) reset();
    if (location !== null && location.toLowerCase() !== where.toLowerCase()) { host.bye(); closeDoor(); }
    account = who; location = where; open = true; topic = word; current = word; focusNext = true;
    const h = host.state();
    if (!['starting', 'ready'].includes(h.phase)) host.start(path.win32.join(where, 'WorkBackup.exe'));
    else if (h.phase === 'ready' && uiState === 'ok') { if (!surface || surface.isDestroyed()) loadView(); else deliverTopic(); }
    // 화면 파일을 싣지 못했던 호스트(설치 중 표식 · 판 다름 따위)는 「다시 열기」에서 목록을 한 번 더 읽는다
    else if (h.phase === 'ready' && uiState !== 'loading') loadUi(h.version);
    host.visible(shown && open);
    layout(); notify();
    return { ok: true, view: true };
  }

  /* 화면이 close를 불렀거나 사람이 「← 원클릭」을 눌렀다. 자리를 숨기고 원클릭 판으로 돌아간다. 호스트는 5분 시계에 맡긴다 */
  function closeByPerson() {
    if (!open) return { ok: true };
    open = false; topic = null; current = null; focusNext = false;
    layout();
    // 원클릭 판에 머물러도(shown) 화면을 닫았으면 호스트에는 보이지 않는다고 알린다. 그래야 5분 시계가 돈다(카본 workbackup-solio-one-ui-20261127 A4)
    host.visible(shown && open);
    notify();
    return { ok: true };
  }

  function place(input) {
    const value = doorPlacement(input);
    if (!value) return { ok: false, code: 'INVALID_INPUT' };
    shown = value.shown; top = value.top;
    host.visible(shown && open);
    layout();
    return { ok: true, ...state() };
  }

  /* 로그아웃 · 계정 바뀜 · 앱 끝 · 업데이트 직전: 자리를 닫고 bye. 호스트는 죽이지 않는다 */
  function reset() {
    host.bye();
    closeDoor();
    account = null; location = null;
    notify();
  }
  function accountChanged(who) { if (account !== null && who !== account) reset(); }

  /* 엔진 화면의 부름. 보낸 쪽을 먼저 본다 */
  function bind() {
    for (const channel of ['workbackup:call', 'workbackup:close']) ipcMain.removeHandler(channel);
    ipcMain.handle('workbackup:call', (event, method, args) => (fromView(event, surface?.webContents) ? host.call(method, args) : { ok: false, error: '이 화면에서는 실행할 수 없습니다.', code: 'INVALID_SENDER' }));
    ipcMain.handle('workbackup:close', event => (fromView(event, surface?.webContents) ? closeByPerson() : { ok: false, code: 'INVALID_SENDER' }));
  }
  if (ipcMain) bind();

  return { open: openDoor, close: closeByPerson, place, state, reset, accountChanged, windowChanged: sendWindow, dispose: reset, fromView: event => fromView(event, surface?.webContents) };
}

module.exports = { createWorkbackupDoor, doorPlacement, fromView, requestAllowed, PARTITION, ENTRY, VIEW_TOPICS };
