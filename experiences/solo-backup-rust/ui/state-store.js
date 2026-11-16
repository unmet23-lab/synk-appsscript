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
      // 상태를 품은 답(takeWriteSeat · restoreRun의 { …, state })도 화면 상태로 받아 들인다
      if (r && r.ok === true) { const next = isState(r.value) ? r.value : isState(r.value?.state) ? r.value.state : null; if (next) { seq++; state = next; } return { ok: true, value: r.value }; }
      // 폴더 고르기 · 확인 창을 사람이 닫은 것은 실패가 아니다. 엔진 글은 갈래를 가리는 데만 읽고 화면에 옮기지 않는다
      if (r && !r.code && typeof r.error === 'string' && /취소했습니다/.test(r.error)) return { ok: false, code: 'CANCELED' };
      if (r && !r.code && typeof r.error === 'string' && /진행 중인 작업이 끝난 뒤/.test(r.error)) return { ok: false, code: 'JOB_BUSY' };
      // LIMIT_DEVICES는 끊을 기기 목록을 details로 함께 준다(엔진 account.cjs signIn)
      return { ok: false, code: (r && typeof r.code === 'string' && r.code) || 'FAILED', ...(r?.details && typeof r.details === 'object' ? { details: r.details } : {}) };
    } catch { return { ok: false, code: 'FAILED' }; }
    finally { busy = null; emit(); }
  }

  /** 창의 호출 줄(busy)을 잡지 않는 읽기 호출 — 기다리는 Google 로그인을 끊는 cancelGoogle 같은 것만 쓴다(조율 세션 c725f319c 부탁 13) */
  async function aside(method, ...args) {
    if (!api || typeof api[method] !== 'function') return { ok: false, code: 'NO_METHOD' };
    try {
      const r = await api[method](...args);
      return r && r.ok === true ? { ok: true, value: r.value } : { ok: false, code: (r && typeof r.code === 'string' && r.code) || 'FAILED' };
    } catch { return { ok: false, code: 'FAILED' }; }
  }

  function stop() {
    stopped = true;
    if (poll) { clearTimer(poll); poll = null; }
    if (typeof cleanup === 'function') { try { cleanup(); } catch { /* 이미 끊김 */ } }
  }

  return { start, refresh, call, aside, stop, get state() { return state; }, get busy() { return busy; } };
}

/** 오류 code → 손님 말(엔진 글을 옮기지 않는다). 기다려도 풀리지 않는 일에는 「잠시 뒤」라 하지 않고 할 일을 쓴다 */
export function failureText(code) {
  return ({
    BUSY: '하던 일이 끝난 뒤 다시 눌러 주세요.',
    JOB_BUSY: '하던 일이 끝난 뒤 다시 눌러 주세요.',
    RUN_ACTIVE: '예약 백업이 도는 중입니다. 끝나면 다시 눌러 주세요.',
    OUTPUT_UNSAFE: '지키는 폴더 밖의 자리를 골라 주세요. 바탕화면이나 문서처럼 지키는 폴더 안에는 되살릴 수 없습니다.',
    NO_SPACE: '놓을 드라이브에 빈 공간이 모자랍니다. 다른 드라이브를 골라 주세요.',
    // 전체 되살리기의 실패 칸(lastRestoreError.code — 엔진은 영문 대문자 부호면 그대로, 아니면 RESTORE_FAILED를 적는다)
    RESTORE_FAILED: '놓을 드라이브의 빈 공간과 인터넷 연결을 확인한 뒤 다시 해 보세요.',
    ENOSPC: '놓을 드라이브에 빈 공간이 모자랍니다. 다른 드라이브를 골라 주세요.',
    EACCES: '놓을 자리에 파일을 쓸 수 없습니다. 다른 폴더를 골라 주세요.',
    EPERM: '놓을 자리에 파일을 쓸 수 없습니다. 다른 폴더를 골라 주세요.',
    ENOENT: '놓을 폴더를 찾지 못했습니다. 다른 폴더를 골라 주세요.',
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
    // 개통(Google로 시작 · 보호 시작 · 기기 · 되돌리기, engine/src/account.cjs · 개통 서버의 부호)
    NO_GOOGLE: '이 판에서는 Google로 시작할 수 없습니다. 새 판으로 업데이트한 뒤 다시 열어 주세요.',
    NOT_SIGNED_IN: '먼저 「Google로 시작」을 눌러 주세요.',
    NOT_WRITER: '이 계정의 백업은 다른 PC가 하고 있습니다.',
    OTHER_BACKUP: '이 PC에는 다른 백업이 이어져 있어 이 계정의 백업을 열 수 없습니다. SYNK에 연락해 주세요.',
    WRITE_KEY: '백업할 준비를 마치지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.',
    GOOGLE_STEP: 'Google 계정에서 잃어버린 기기의 접근을 먼저 지워 주세요.',
    ENVELOPE: '복구 정보를 Google 계정에 맡기지 못했습니다. 다시 눌러 주세요.',
    NO_ENVELOPE: '이 계정의 복구 정보를 Google 계정에서 찾지 못했습니다. SYNK에 연락해 주세요.',
    BAD_INPUT: '요청을 확인하지 못했습니다. 다시 눌러 주세요.',
    REPO_EXISTS: '이 계정에는 이미 백업이 있습니다.',
    LIMIT_DEVICES: '이 계정에 이을 수 있는 기기가 다 찼습니다.',
    LIMIT_KEYS_DAY: '오늘 연결을 새로 받을 수 있는 횟수를 다 썼습니다. 내일 다시 눌러 주세요.',
    READ_KEY: '이 계정의 백업을 읽을 권한을 새로 받아야 합니다. 분실 신고 뒤라면 Google 계정을 정리했다고 확인한 뒤 다시 눌러 주세요.',
    MOVED: '백업하는 자리가 다른 PC로 옮겨져 이 PC는 백업을 쉽니다. 「이 PC로 다시 백업」을 누르면 이어서 합니다.',
    OVER_QUOTA: '백업 용량을 넘어 새 백업을 쉽니다. 지키는 폴더를 줄여 주세요.',
    RESTORE_PENDING: '되돌리기를 마칠 때까지 백업을 쉽니다. 기본 화면의 「확인하러 가기」에서 이어서 고르세요.',
    NOT_INVITED: '이 Google 계정은 아직 시범 손님으로 등록되지 않았습니다. SYNK에 연락해 주세요.',
    SUB_MISMATCH: '이 백업을 시작한 Google 계정으로 로그인해 주세요.',
    ACCOUNT: '이 백업을 시작한 Google 계정으로 로그인해 주세요.',
    NONCE: 'Google 로그인을 확인하지 못했습니다. 다시 눌러 주세요.',
    TOKEN: 'Google 로그인을 확인하지 못했습니다. 다시 눌러 주세요.',
    INVALID: 'Google 로그인을 확인하지 못했습니다. 다시 눌러 주세요.',
    DENIED: 'Google 계정에서 허락을 받지 못했습니다. 다시 눌러 「계속」까지 눌러 주세요.',
    DEVICE: '이 PC의 연결이 끊겼습니다. 「Google로 시작」을 다시 눌러 주세요.',
    DEVICE_GONE: '이 PC의 연결이 끊겼습니다. 「Google로 시작」을 다시 눌러 주세요.',
    DEVICE_STATE: '이 PC는 끊겼거나 다른 PC로 옮겨진 기기라 이 일을 할 수 없습니다.',
    RATE: '요청이 너무 잦아 잠시 막혔습니다. 한참 뒤 다시 눌러 주세요.',
    TOO_OLD: '되돌릴 수 있는 기간(29일)이 지난 시각입니다.',
    NOT_FOUND: '그 요청을 찾지 못했습니다. 창을 닫았다가 다시 열어 주세요.',
    SERVER: 'SYNK 서버에 닿지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.',
    NETWORK: 'SYNK 서버에 닿지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.',
    // 옮겨 오기(lastMoveError.code · moveOpen · takeWriteSeat, 조율 세션 c6ae51da6 E4 · E6 · E13 · E15)
    MOVE_NO_SPACE: '놓을 드라이브의 빈 공간이 모자라 멈췄습니다. 공간을 비운 뒤 다시 눌러 주세요.',
    // 앞선 판이 남긴 실패만 이 부호다 — 지금 판은 그 폴더만 「옮기지 않음」으로 두고 나머지를 옮겨 온다(E25). 그 폴더는 「파일 되살리기」로
    // 꺼낼 수 없으므로 권하지 않는다 — 이 PC 자신의 최신 판만 열고 20만 개까지다(조율 세션 E26 답)
    MOVE_LIST_TOO_BIG: '파일과 폴더가 100만 개를 넘는 폴더가 있어 목록을 다 읽지 못했습니다. 지금은 그 폴더만 빼고 옮겨 옵니다.',
    // 설정 되돌리기가 이 PC에 깔린 목록을 못 읽음(E22) — 모두 「앱이 없음」으로 따로 두지 않으려고 엔진이 거절한다
    REINSTALL_LIST_FAILED: '이 PC에 깔린 프로그램 목록을 읽지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
    MOVE_PROFILE: '이 PC의 사용자 폴더 자리를 확인하지 못해 멈췄습니다. PC를 다시 시작한 뒤 다시 눌러 주세요.',
    MOVE_SNAPSHOT_GONE: '옛 PC 백업의 그 판을 찾지 못해 멈췄습니다. 옛 PC가 그사이 지난 판을 정리했을 수 있습니다.',
    MOVE_NETWORK: '인터넷 연결이 끊겨 멈췄습니다. 연결을 확인한 뒤 다시 눌러 주세요.',
    MOVE_GONE: '그 폴더가 지금 이 PC에 없습니다. 옮기거나 지웠을 수 있습니다.',
    SOURCES_MISSING: '지킬 폴더 가운데 이 PC에 없는 폴더가 있습니다. 그 폴더를 빼고 다시 눌러 주세요.',
  })[code] || '마치지 못했습니다. 잠시 뒤 다시 눌러 주세요.';
}
