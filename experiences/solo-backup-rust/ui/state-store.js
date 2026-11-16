// 브리지(window.backup)로 엔진 상태를 받아 두는 층. 화면은 여기서 받은 상태만 그린다.
// - 처음에 getState 한 번, 그 뒤로는 onState 알림을 받는다. 구독이 안 되면 2초마다 다시 읽는다(옛 화면과 같은 길).
// - 단추는 call(메서드, …인자)로만 엔진에 간다. 메서드 이름은 bridge.js · contract/methods.json의 허용 목록 안이어야 한다.
// - 같은 단추를 두 번 눌러 같은 일이 두 번 가지 않게, 도는 호출이 있는 동안에는 새 호출을 받지 않는다.
// 엔진이 돌려준 오류 글은 화면에 그대로 옮기지 않는다(「저장소」 같은 말이 섞여 있다) — 화면은 code만 보고 제 말로 쓴다.

const POLL_MS = 2000;

export function isState(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.version === 'string';
}

export function createStore(api, { onChange = () => {}, setTimer = setInterval, clearTimer = clearInterval } = {}) {
  let state = null, busy = null, failure = null, poll = null, stopped = false, cleanup = null, seq = 0;
  const emit = () => { if (!stopped) onChange({ state, busy, failure }); };
  const accept = (value) => { if (isState(value)) { state = value; failure = null; emit(); } };

  async function refresh() {
    if (!api || typeof api.getState !== 'function') { failure = 'NO_BRIDGE'; emit(); return; }
    const my = ++seq;
    try {
      const r = await api.getState();
      if (my !== seq) return; // 늦게 온 옛 답은 버린다
      if (r && r.ok === true) accept(r.value); else { failure = 'READ_FAILED'; emit(); }
    } catch { failure = 'READ_FAILED'; emit(); }
  }

  function startPoll() { if (!poll && !stopped) poll = setTimer(refresh, POLL_MS); }

  async function start() {
    await refresh();
    if (!api || typeof api.onState !== 'function') { startPoll(); return; }
    try {
      cleanup = await api.onState((value) => { seq++; accept(value); });
      if (stopped && typeof cleanup === 'function') cleanup();
    } catch { startPoll(); }
  }

  /** 엔진에 일을 보낸다. 끝나면 { ok, code }를 돌려준다. 도는 호출이 있으면 BUSY. */
  async function call(method, ...args) {
    if (busy) return { ok: false, code: 'BUSY' };
    if (!api || typeof api[method] !== 'function') return { ok: false, code: 'NO_METHOD' };
    busy = method; emit();
    try {
      const r = await api[method](...args);
      if (r && r.ok === true) { if (isState(r.value)) { seq++; state = r.value; } return { ok: true, value: r.value }; }
      // 폴더 고르기 · 확인 창을 사람이 닫은 것은 실패가 아니다. 엔진 글은 갈래를 가리는 데만 읽고 화면에 옮기지 않는다
      if (r && !r.code && typeof r.error === 'string' && /취소했습니다/.test(r.error)) return { ok: false, code: 'CANCELED' };
      return { ok: false, code: (r && typeof r.code === 'string' && r.code) || 'FAILED' };
    } catch { return { ok: false, code: 'FAILED' }; }
    finally { busy = null; emit(); }
  }

  function stop() {
    stopped = true;
    if (poll) { clearTimer(poll); poll = null; }
    if (typeof cleanup === 'function') { try { cleanup(); } catch { /* 이미 끊김 */ } }
  }

  return { start, refresh, call, stop, get state() { return state; }, get busy() { return busy; } };
}

/** 오류 code → 손님 말(엔진 글을 옮기지 않는다) */
export function failureText(code) {
  return ({
    BUSY: '하던 일이 끝난 뒤 다시 눌러 주세요.',
    JOB_BUSY: '하던 일이 끝난 뒤 다시 눌러 주세요.',
    READ_ONLY: '이 PC는 파일을 되살리기만 하는 연결이라 이 일은 할 수 없습니다.',
    INVALID_REQUEST: '이 화면에서는 할 수 없는 일입니다.',
    NO_BRIDGE: '앱 안쪽과 연결하지 못했습니다. 앱을 다시 열어 주세요.',
    READ_FAILED: '지금 상태를 읽지 못했습니다. 잠시 뒤 다시 읽습니다.',
  })[code] || '마치지 못했습니다. 잠시 뒤 다시 눌러 주세요.';
}
