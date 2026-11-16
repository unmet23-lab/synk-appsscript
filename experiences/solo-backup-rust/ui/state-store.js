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
  let subscribed = false;
  const accept = (value) => {
    if (!isState(value)) return;
    state = value; failure = null;
    if (subscribed && poll) { clearTimer(poll); poll = null; } // 첫 상태가 왔으니 알림만 받는다
    emit();
  };

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
      subscribed = true;
      if (stopped && typeof cleanup === 'function') cleanup();
      else if (!state) startPoll();
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
      // 코드 없이 오는 거절 둘(전체 되살리기의 놓을 자리 · 마지막 폴더 빼기)도 갈래만 가린다. 엔진 담당에 코드를 붙여 달라고 넘겼다
      if (r && !r.code && typeof r.error === 'string' && /분리된 위치를 선택/.test(r.error)) return { ok: false, code: 'OUTPUT_UNSAFE' };
      if (r && !r.code && typeof r.error === 'string' && /하나 이상 남겨/.test(r.error)) return { ok: false, code: 'LAST_FOLDER' };
      if (r && !r.code && typeof r.error === 'string' && /진행 중인 작업이 끝난 뒤/.test(r.error)) return { ok: false, code: 'JOB_BUSY' };
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

/** 오류 code → 손님 말(엔진 글을 옮기지 않는다). 기다려도 풀리지 않는 일에는 「잠시 뒤」라 하지 않고 할 일을 쓴다 */
export function failureText(code) {
  return ({
    BUSY: '하던 일이 끝난 뒤 다시 눌러 주세요.',
    JOB_BUSY: '하던 일이 끝난 뒤 다시 눌러 주세요.',
    RUN_ACTIVE: '예약 백업이 도는 중입니다. 끝나면 다시 눌러 주세요.',
    OUTPUT_UNSAFE: '지키는 폴더 밖의 자리를 골라 주세요. 바탕화면이나 문서처럼 지키는 폴더 안에는 되살릴 수 없습니다.',
    NO_SPACE: '놓을 드라이브에 빈 공간이 모자랍니다. 다른 드라이브를 골라 주세요.',
    CATALOG_TOO_LARGE: '파일이 너무 많아 목록을 열 수 없습니다. 「전체 되살리기」를 써 주세요.',
    UNSAFE_MANIFEST: '안전하게 되살릴 수 없는 이름이 섞여 있어 목록을 열지 못했습니다. 「전체 되살리기」를 써 주세요.',
    SELECTION_LIMIT: '한 번에 1,000개까지 고를 수 있습니다. 찾기로 범위를 줄여 주세요.',
    SELECTION_EMPTY: '되살릴 파일을 먼저 골라 주세요.',
    CREDENTIAL_REQUIRED: '이 PC의 백업 연결이 끊겨 지금은 열 수 없습니다.',
    NOT_CONFIGURED: '아직 백업을 시작하지 않았습니다.',
    NO_SNAPSHOT: '아직 되살릴 판이 없습니다. 첫 백업이 끝난 뒤 열어 주세요.',
    SNAPSHOT_GONE: '고른 판이 더는 남아 있지 않습니다. 목록을 새로 열어 주세요.',
    REPOSITORY_CHANGED: '백업 연결이 바뀌었습니다. 목록을 새로 열어 주세요.',
    REMOTE_MAINTENANCE: '다른 PC에서 지난 판을 정리하는 중입니다. 끝난 뒤 다시 눌러 주세요.',
    INTEGRITY_FAILED: '되살린 내용이 백업과 맞지 않아 마치지 않았습니다. 원래 파일은 그대로입니다.',
    RESTORE_INCOMPLETE: '되살리기를 끝내지 못했습니다. 놓던 폴더는 그대로 두었으니 다시 해 보세요.',
    QUERY_INVALID: '찾는 말은 200자 안으로 써 주세요.',
    OPERATION_FAILED: '목록을 읽지 못했습니다. 인터넷 연결을 확인한 뒤 다시 열어 주세요.',
    LAST_FOLDER: '지키는 폴더는 적어도 하나 남겨 두어야 합니다. 다른 폴더를 먼저 더한 뒤 빼 주세요.',
    REAUTH: 'Google에 다시 로그인해야 합니다.',
    READ_ONLY: '이 PC는 파일을 되살리기만 하는 연결이라 이 일은 할 수 없습니다.',
    INVALID_REQUEST: '이 화면에서는 할 수 없는 일입니다.',
    NO_BRIDGE: '앱 안쪽과 연결하지 못했습니다. 앱을 다시 열어 주세요.',
    READ_FAILED: '지금 상태를 읽지 못했습니다. 잠시 뒤 다시 읽습니다.',
    CATALOG_EXPIRED: '목록을 연 지 오래되어 새로 열었습니다. 되살릴 파일을 다시 골라 주세요.',
    SELECTION_STALE: '그사이 새 백업이 들어와 목록을 새로 열었습니다. 되살릴 파일을 다시 골라 주세요.',
  })[code] || '마치지 못했습니다. 잠시 뒤 다시 눌러 주세요.';
}
