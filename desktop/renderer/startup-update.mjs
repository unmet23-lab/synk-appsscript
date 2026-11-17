// 시작 창의 얼굴. 켜면 검정 구 하나가 드러나고, 새 판이 있으면 구가 창보다 크게 다가와 새로 깎인다(웅장한 판, 유호님 11-17).
// 모습과 시간값은 시안 docs/디자인/플랫폼_클라이언트_검정구_20261116/검정구.html의 boot · forge · forgeText를 따른다.
// 흐름은 본체의 시작 관문(src/platform-startup-update.cjs)이 정하고, 이 화면은 받은 상태를 그린다. 동작은 모두 인자가 없다.
// 1-가 구현 설계 2절(창과 넘기기), 3절(깎인 만큼), 5절(실패 장면)을 옮겼다.
import { createOrbStage, easeIO, easeIOQ, easeOut, lerp, smooth } from './orb-stage.mjs';

const STATES = new Set(['checking', 'downloading', 'installing', 'error', 'ready']);
const METHODS = { retry: 'retry', current: 'openCurrent', install: 'install' };
const cleanVersion = value => (typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value) ? value : null);
const setText = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };

/* 구가 드러나는 길. 본체가 정한 시각(startedAt)부터 잰다. back은 날마다 켤 때, first는 이 PC에서 처음 켤 때다(시안 boot) */
export const ORB_BOOT = Object.freeze({
  back: Object.freeze({ delay: 300, ms: 1150, asleepAt: 900, wakeAt: 1200 }),
  first: Object.freeze({ delay: 520, ms: 2400, asleepAt: 2220, wakeAt: 3300 }),
});
/* 업데이트 뒤 새 앱의 첫 장면(1-가 구현 설계 6절, 시안 forgeDone의 웅장한 판). 설치기 창의 마지막 장(다 깎인 구)에서 이어, 글 없이 빛이 오르며 한 바퀴 돌고
   0.9초에 눈을 뜨고 2.15초에 잠깐 웃는다. 한 바퀴가 끝나면 쉬는 자리로 간다. 본체는 이 시간이 지난 뒤 앱 창으로 넘긴다(main.cjs ARRIVE_SCENE_MS) */
export const ARRIVE = Object.freeze({ turn: 2800, eyesWakeAt: 900, smileAt: 2150, hold: 280, settle: 1050 });
export const ARRIVE_SCENE_MS = ARRIVE.turn + ARRIVE.hold + ARRIVE.settle;
/* 실패했을 때 저절로 지금 판을 여는 시간. 사람이 단추에 손을 올리거나 초점을 옮기면 멈춘다. 남은 시간은 글로 세지 않는다(5절) */
export const AUTO_OPEN_MS = 8000;
/* 깎인 만큼이 받은 값을 따라가는 가장 빠른 빠르기(초당). 뒤로는 가지 않는다(3절) */
export const FORGE_FOLLOW_PER_SECOND = 0.16;

/* 화면에 나올 글. 문장은 5절의 예시를 따르고, 쓰던 판을 여는 단추는 시안 그대로 「지금 판 열기」다 */
export function copy(s) {
  const code = typeof s.code === 'string' ? s.code : '';
  const later = '잠시 뒤 쓰던 판을 엽니다.';
  if (s.state === 'checking') return { say: '새 판을 확인하고 있습니다.', then: '' };
  if (s.state === 'downloading') return { say: '새 판을 받고 있습니다.', then: '' };
  if (s.state === 'installing') return s.platform === 'darwin' ? { say: '설치 파일을 열고 있습니다.', then: '' } : { say: '새 판으로 바꾸고 있습니다.', then: '끝나면 저절로 열립니다.' };
  if (s.state === 'ready') return code === 'UPDATE_MANUAL_INSTALL'
    ? { say: '설치 파일을 열었습니다.', then: 'SYNK를 끈 뒤 앱을 Applications 폴더로 옮겨 바꿔 주세요.' }
    : { say: '새 판을 받았습니다.', then: '설치 파일을 연 뒤 SYNK를 끄고, 앱을 Applications 폴더로 옮겨 바꿔 주세요.' };
  if (code === 'UPDATE_STORAGE_FAILED') return { say: 'PC 저장 공간이 모자라 새 판을 받지 못했습니다.', then: later };
  if (code === 'UPDATE_BUILD_MISMATCH' || code === 'UPDATE_DOWNGRADE_REJECTED') return { say: '이 앱은 저절로 새 판으로 바뀌지 않습니다.', then: 'synk.im에서 설치 파일을 새로 받아 주세요.', stay: true };
  if (/^UPDATE_(INTEGRITY_FAILED|INVALID_ARTIFACT|INVALID_CACHE)$/.test(code)) return { say: '받은 새 판이 온전하지 않아 쓰지 않았습니다.', then: later };
  if (/^UPDATE_(OPEN_FAILED|HANDOFF_FAILED|HANDOFF_TIMEOUT|HANDOFF_INVALID)$/.test(code)) return { say: '새 판으로 바꾸지 못했습니다.', then: '쓰던 판은 그대로입니다. 잠시 뒤 그대로 엽니다.' };
  if (code === 'UPDATE_RECOVERED' || code === 'UPDATE_RECOVERY_INVALID') return { say: '새 판으로 바꾸지 못했습니다.', then: later };
  if (s.stage === 'download' && (code === 'UPDATE_NETWORK_FAILED' || code === 'UPDATE_TIMEOUT')) return { say: '새 판을 받지 못했습니다.', then: '인터넷이 돌아오면 다시 받습니다. ' + later };
  if (code === 'UPDATE_BRIDGE_FAILED') return { say: '화면을 불러오지 못했습니다.', then: later };
  return { say: '새 판을 확인하지 못했습니다.', then: later };
}

export function mountStartupUpdate({
  bridge = globalThis.synkStartupUpdate,
  document = globalThis.document,
  window: windowOverride,
  createOrb = (canvas, options) => createOrbStage(canvas, options),
  now = () => Date.now(),
  autoOpenMs = AUTO_OPEN_MS,
} = {}) {
  const win = windowOverride || document?.defaultView || globalThis.window || globalThis;
  const $ = id => document.getElementById(id);
  const nodes = {
    root: $('startup-update'), canvas: $('startup-orb'), stage: $('startup-orb-stage'),
    say: $('startup-say'), then: $('startup-then'), version: $('startup-version'), percent: $('startup-percent'),
    actions: $('startup-actions'), retry: $('startup-retry'), install: $('startup-install'), current: $('startup-open-current'),
    minimize: $('startup-minimize'), maximize: $('startup-maximize'), close: $('startup-close'),
  };
  let snapshot = { state: 'checking' }, revision = 0, pending = null, disposed = false, unsubscribe = null, unsubscribeWindow = null;
  let lastState = null, scene = 'boot', bootStarted = false, autoTimer = null, autoSpent = false, focusDue = false, held = false, shown = 0, target = 0, followId = null, followAt = 0;
  const timers = new Set();
  const later = (fn, ms) => { const id = win.setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, Math.max(0, ms)); timers.add(id); return id; };

  function reduced() {
    if (document?.documentElement?.dataset?.motion === 'reduced') return true;
    try { return win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true; } catch { return false; }
  }
  let orb = null;
  if (nodes.canvas) {
    try { orb = createOrb(nodes.canvas, { getReducedMotion: reduced, places: false, eyes: true }); }
    catch { orb = null; if (nodes.canvas.dataset) nodes.canvas.dataset.orbMode = 'static'; }
  }

  /* ── 구가 드러난다. 본체가 정한 시각부터 재므로, 창이 늦게 떠도 앱 창과 같은 길을 그린다 ── */
  function boot(info) {
    if (bootStarted || !orb) return;
    bootStarted = true;
    if (info?.kind === 'arrive') { arrive(info); return; }
    const kind = info?.kind === 'first' ? 'first' : 'back', b = ORB_BOOT[kind];
    const elapsed = Number.isFinite(info?.startedAt) ? Math.max(0, now() - info.startedAt) : 0;
    orb.snap('void');
    if (elapsed >= b.delay + b.ms) { orb.snap('rest'); orb.eyesAsleep?.(); if (scene === 'boot') void orb.eyesWake?.(); return; }
    const reveal = () => { if (scene === 'boot') void orb.tween('rest', b.ms, easeOut, (t, a, z) => lerp(a, z, smooth(0, 0.62, t)), { elapsed: Math.max(0, elapsed - b.delay) }); };
    if (elapsed >= b.delay) reveal(); else later(reveal, b.delay - elapsed);
    later(() => { if (scene === 'boot') orb.eyesAsleep?.(); }, b.asleepAt - elapsed);
    later(() => { if (scene === 'boot') void orb.eyesWake?.(); }, b.wakeAt - elapsed);
  }

  /* ── 업데이트 뒤의 첫 장면: 설치기 창의 마지막 장에서 이어 빛이 오르며 한 바퀴 돈다(시안 forgeDone) ── */
  function arrive(info) {
    const elapsed = Number.isFinite(info?.startedAt) ? Math.max(0, now() - info.startedAt) : 0;
    if (elapsed >= ARRIVE_SCENE_MS || reduced()) { orb.setCutOn?.(false, { instant: true }); orb.setLit?.(1); orb.snap('rest'); orb.eyesCalm?.(); return; }
    scene = 'arrive';
    const cut0 = Number.isFinite(info?.cut) ? Math.max(0, Math.min(1, info.cut)) : 1;
    const lit0 = Number.isFinite(info?.lit) ? Math.max(0, Math.min(1.1, info.lit)) : 0.58;
    orb.forgeAt?.(cut0); orb.setCutOn?.(true, { instant: true }); orb.snap('forge'); orb.setLit?.(lit0); orb.eyesAsleep?.();
    // 다 깎였다: 결을 거두고 빛줄기가 돈다
    orb.setCut?.(1); orb.setCutOn?.(false); orb.setGlint?.(true);
    later(() => { if (scene === 'arrive') void orb.eyesWake?.(); }, ARRIVE.eyesWakeAt - elapsed);
    later(() => { if (scene === 'arrive') void orb.setMood?.('smile', 1100); }, ARRIVE.smileAt - elapsed);
    const az0 = orb.state?.().az ?? 0, t0 = now() - elapsed;
    const step = () => {
      if (disposed || scene !== 'arrive' || !orb) return;
      const k = Math.min(1, (now() - t0) / ARRIVE.turn);
      orb.setAz?.(az0 + Math.PI * 2 * easeIO(k));
      orb.setLit?.(lerp(lit0, 1.1, smooth(0, 0.75, k)));
      if (k < 1) { later(step, 16); return; }
      orb.setAz?.(az0); orb.setGlint?.(false); orb.setLit?.(1);
      later(() => { if (scene === 'arrive') void orb.tween('rest', ARRIVE.settle, easeIO); }, ARRIVE.hold);
    };
    step();
  }
  /* ── 새 판을 받는 동안: 옛 결을 지우며 구가 다가오고, 받는 만큼(앞 절반)과 바꾸는 만큼(뒤 절반) 새 결이 깎인다 ── */
  function enterForge() {
    if (scene === 'forge') return;
    const handoff = snapshot.boot?.kind === 'handoff';
    // 그리기가 없는 판(정적 구)도 장면을 바꿔 글과 진행을 보인다(0.4.96 검수 C6)
    if (!orb) { scene = 'forge'; bootStarted = true; shown = target = handoff ? 0.5 : 0; setUi('forge'); return; }
    // 앱 창 위에 덮어 띄운 넘김 장면(본체 boot.kind 'handoff'): 받기가 끝난 절반 깎인 구가 이미 와 있고 글도 바로 놓인다. 가림막과 설치기가 같은 장에서 잇는다
    if (handoff) {
      scene = 'forge'; bootStarted = true; shown = target = 0.5;
      orb.forgeAt?.(0.5); orb.setCutOn?.(true, { instant: true }); orb.snap('forge'); orb.eyesAsleep?.();
      if (nodes.root.dataset) nodes.root.dataset.instant = 'true';
      setUi('forge');
      return;
    }
    takeOverBoot();
    // 다시 시도한 받기는 0에서 다시 깎는다. 앞 실패 때의 목표가 남으면 구와 숫자가 그 자리까지 먼저 오른다(0.4.96 검수 C7)
    scene = 'forge'; shown = 0; target = 0;
    void orb.setMood?.('sleep');
    orb.setCut?.(1); orb.setCutOn?.(true);
    const t0 = now(), erase = 1500;
    const step = () => { if (disposed || scene !== 'forge') return; const k = Math.min(1, (now() - t0) / erase); if (shown === 0) orb.setCut?.(1 - easeIO(k)); if (k < 1) later(step, 16); };
    step();
    void orb.tween('forge', 2300, easeIOQ).then(() => { if (disposed || scene !== 'forge') return; follow(); });
    setUi('forge');
  }
  /* 깎인 만큼은 받은 값을 따라가되, 정한 빠르기보다 빨리 가지 않고 뒤로 가지 않는다 */
  function follow() {
    if (followId !== null || disposed) return;
    followAt = now();
    const tick = () => {
      followId = null;
      if (disposed || scene !== 'forge') return;
      const t = now(), dt = Math.min(0.25, (t - followAt) / 1000); followAt = t;
      const next = Math.min(target, shown + dt * (reduced() ? 10 : FORGE_FOLLOW_PER_SECOND));
      if (next > shown) { shown = next; orb?.forgeAt?.(shown); setPercent(); }
      if (shown < target) followId = later(tick, 16);
    };
    tick();
  }
  function setTarget(p) { target = Math.max(target, Math.min(1, Math.max(0, p))); if (scene === 'forge' && !orb?.moving) follow(); }
  function setPercent() { setText(nodes.percent, scene === 'forge' && ['downloading', 'installing'].includes(snapshot.state) ? ' · ' + Math.round(shown * 100) + '%' : ''); }

  /* ── 실패: 온전한 구가 어두워진 채 다가와 있고, 글과 단추가 왼쪽 아래에 놓인다. 잠시 뒤 지금 판을 연다 ── */
  function enterFailed() {
    // 그리기가 없는 판(정적 구)도 장면 값을 실패로 바꾼다. 남은 'forge'가 다시 시도한 받기의 첫 단계를 막았다(0.4.96 검수 D4)
    if (!orb) { bootStarted = true; scene = 'failed'; setUi('forge'); return; }
    takeOverBoot();
    const from = scene;
    scene = 'failed';
    orb.setCutOn?.(false);
    void orb.eyesWake?.();
    if (from === 'forge' || orb.pose === 'forge') orb.setLit?.(0.5);
    else void orb.tween('forge', 1500, easeIO, (t, a) => lerp(a, 0.5, smooth(0, 0.8, t)));
    setUi('forge');
  }
  /* Mac에서 받은 판을 사람이 옮길 차례: 절반 깎인 구가 멈춰 있다 */
  function enterReady() {
    if (!orb) { bootStarted = true; scene = 'ready'; shown = target = 0.5; setUi('forge'); return; }
    if (scene !== 'forge') enterForge();
    scene = 'ready';
    setTarget(0.5); shown = 0.5; orb.forgeAt?.(0.5);
    setUi('forge');
  }
  function setUi(ui) { if (nodes.root.dataset.ui !== ui) nodes.root.dataset.ui = ui; }
  /* 첫 상태가 받는 중, 바꾸는 중, 실패이면(숨은 채 받다가 창을 연 때, 지난 실패를 보일 때) 드러남을 건너뛴다. 빈 자리에서 그 장면으로 다가오고,
   * 뒤늦은 드러남이 그 장면의 구를 빈 자리로 되돌리지 않게 한다(0.4.96 검수 C2) */
  function takeOverBoot() { if (bootStarted || !orb) return; bootStarted = true; orb.snap('void'); }

  /* ── 저절로 열기 ── */
  function armAutoOpen() {
    clearAuto();
    // 새 판을 받지 못해 직접 설치를 안내하는 글(stay)은 「잠시 뒤 쓰던 판을 엽니다」를 말하지 않으므로 저절로 닫지 않는다(0.4.96 검수 D3)
    if (held || snapshot.state !== 'error' || !allowed('current') || copy(snapshot).stay) return;
    autoTimer = later(() => { autoTimer = null; autoSpent = true; if (!held && allowed('current') && !copy(snapshot).stay) void run('current'); }, autoOpenMs);
  }
  function clearAuto() { if (autoTimer !== null) { win.clearTimeout(autoTimer); timers.delete(autoTimer); autoTimer = null; } }
  let focusing = false;
  function hold() { if (focusing) return; held = true; clearAuto(); }
  nodes.actions?.addEventListener?.('pointerenter', hold);
  nodes.actions?.addEventListener?.('focusin', hold);
  document?.addEventListener?.('keydown', hold);

  const capable = bridge && ['getStatus', 'retry', 'openCurrent', 'install', 'onChanged'].every(name => typeof bridge[name] === 'function');
  const allowed = action => capable && (action === 'retry' ? snapshot.state === 'error' && snapshot.canRetry === true : action === 'install' ? snapshot.state === 'ready' && snapshot.platform === 'darwin' && snapshot.canInstall === true : ['error', 'ready'].includes(snapshot.state) && snapshot.canOpenCurrent === true);

  function render() {
    const s = snapshot, text = copy(s), changed = lastState !== s.state;
    lastState = s.state;
    nodes.root.dataset.state = s.state;
    nodes.root.setAttribute('aria-busy', String(['checking', 'downloading', 'installing'].includes(s.state)));
    setText(nodes.say, text.say);
    setText(nodes.then, text.then);
    const latest = cleanVersion(s.latestVersion), current = cleanVersion(s.currentVersion);
    setText(nodes.version, s.state === 'downloading' || s.state === 'installing' || s.state === 'ready' ? (latest || '') : s.state === 'error' ? (current || '') : '');
    if (s.state === 'downloading') { enterForge(); setTarget(0.5 * (Number.isFinite(s.progress) ? Math.max(0, Math.min(100, s.progress)) : 0) / 100); }
    else if (s.state === 'installing') { enterForge(); setTarget(0.5); }
    else if (s.state === 'ready') enterReady();
    else if (s.state === 'error') { if (changed || scene !== 'failed') enterFailed(); }
    setPercent();
    for (const action of Object.keys(METHODS)) {
      const ok = allowed(action) && !(action === 'retry' && text.stay);
      nodes[action].hidden = !ok;
      nodes[action].disabled = !!pending || !ok;
    }
    setText(nodes.retry, pending === 'retry' ? '다시 확인하고 있습니다' : '다시 시도');
    setText(nodes.current, pending === 'current' ? '여는 중' : '지금 판 열기');
    setText(nodes.install, pending === 'install' ? '여는 중' : '설치 파일 열기');
    nodes.actions.hidden = Object.keys(METHODS).every(action => nodes[action].hidden);
    if (changed) {
      if (s.state === 'error') { held = false; autoSpent = false; armAutoOpen(); }
      else clearAuto();
      focusDue = !pending && ['error', 'ready'].includes(s.state);
    }
    // 첫 실패 상태는 관문이 일을 끝내기 전에 와서 「지금 판 열기」가 아직 막혀 있다. 같은 상태로 곧 이어 오는 판에서 열 수 있게 되면 그때 건다(0.4.96 검수 C1)
    else if (s.state === 'error' && autoTimer === null && !autoSpent) armAutoOpen();
    if (focusDue && !pending) {
      const first = ['retry', 'install', 'current'].map(key => nodes[key]).find(btn => btn && !btn.hidden && !btn.disabled);
      // 저절로 열기를 멈추지 않도록, 초점은 손으로 옮겼을 때만 멈춘다. 여기서 옮기는 초점은 화면 낭독기를 위한 것이다. 단추가 아직 없으면 생길 때 옮긴다
      if (first) { focusDue = false; focusing = true; try { first.focus?.({ preventScroll: true }); } finally { focusing = false; } }
    }
    if (s.window) setMaximized(s.window.maximized === true);
    if (!bootStarted && revision > 0) boot(s.boot);
    document.documentElement.dataset.startupReady = 'true';
  }
  function setMaximized(on) { if (!nodes.maximize) return; nodes.maximize.dataset.maximized = String(on); nodes.maximize.setAttribute('aria-label', on ? '이전 크기로' : '최대화'); }

  function receive(value) {
    if (disposed || !value || !STATES.has(value.state)) return false;
    snapshot = { ...value }; revision++; render(); return true;
  }
  async function run(action) {
    if (disposed || pending || !allowed(action)) return;
    clearAuto(); autoSpent = true;
    pending = action; const start = revision; render();
    try {
      const result = await bridge[METHODS[action]](); if (disposed || revision !== start) return;
      if (!receive(result)) { const status = await bridge.getStatus(); if (!disposed && revision === start && !receive(status)) throw Error('Invalid status'); }
    } catch { if (!disposed && revision === start) { snapshot = { ...snapshot, state: 'error', code: 'UPDATE_BRIDGE_FAILED' }; revision++; } }
    finally { pending = null; if (!disposed) render(); }
  }
  for (const action of Object.keys(METHODS)) nodes[action].addEventListener('click', () => { held = true; void run(action); });
  const windowAction = name => () => { if (typeof bridge?.[name] === 'function') void Promise.resolve(bridge[name]()).catch(() => {}); };
  nodes.minimize?.addEventListener('click', windowAction('minimize'));
  nodes.maximize?.addEventListener('click', windowAction('toggleMaximize'));
  nodes.close?.addEventListener('click', windowAction('close'));
  for (const name of ['minimize', 'maximize', 'close']) if (nodes[name] && typeof bridge?.[name === 'maximize' ? 'toggleMaximize' : name] !== 'function') nodes[name].disabled = true;
  // 손이 있는 쪽을 구가 본다(시안 그대로)
  const onPointer = event => { const w = win.innerWidth || 1, h = win.innerHeight || 1; orb?.setPointer?.(event.clientX / w, event.clientY / h); };
  win.addEventListener?.('pointermove', onPointer);
  render();

  const ready = (async () => {
    if (!capable) { snapshot = { state: 'error', code: 'UPDATE_BRIDGE_FAILED' }; revision++; render(); return; }
    try {
      unsubscribe = bridge.onChanged(receive);
      if (typeof bridge.onWindowState === 'function') unsubscribeWindow = bridge.onWindowState(value => setMaximized(value?.maximized === true));
      const start = revision, result = await bridge.getStatus();
      if (!disposed && revision === start && !receive(result)) throw Error('Invalid status');
    } catch { if (!disposed && revision === 0) { snapshot = { state: 'error', code: 'UPDATE_BRIDGE_FAILED' }; revision++; render(); } }
  })();

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const id of timers) win.clearTimeout(id);
    timers.clear();
    unsubscribe?.(); unsubscribe = null;
    unsubscribeWindow?.(); unsubscribeWindow = null;
    win.removeEventListener?.('pointermove', onPointer);
    document?.removeEventListener?.('keydown', hold);
    orb?.dispose?.(); orb = null;
  }
  return { ready, dispose, get orb() { return orb; }, get scene() { return scene; } };
}

if (globalThis.document?.getElementById('startup-update')) {
  const mounted = mountStartupUpdate();
  globalThis.window?.addEventListener?.('pagehide', () => mounted.dispose(), { once: true });
}
