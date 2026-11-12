// 계정 기록부의 올리기 · 받기(단계 4 계획 §18-5-2 · §18-5-1 · 설계 §5-3) — 호스트가 저장소마다 하나 둔다. 손님은 쓰지 않는다.
//   나르개(transport)는 제품이 준다 — { post(events, since) → 답, get(since) → 답 }. 배열 하나 받는 함수꼴(옛 시험)은 post로만 받는다.
//   나르개(계정 클라이언트)는 { status, code, ids?, revision? }를 실은 오류를 던진다 — 갈래는 failureOf(계획 §18-5-2 표).
//   묶음은 건수(256)와 바이트(약 200KB) 둘로 자른다. 413은 반으로, 번호 없는 400류는 반씩 나눠 걸리는 사건을 가려 이 세션 동안
//   건너뛴다 — 버리지 않고(talk가 따라오면 저절로 간다) 그것에 기댄 사건도 함께(기록부 unsent의 skip — R12 · R13). 버리는 것은 서버가
//   번호를 짚었을 때뿐이다(409 EVENT_REVISION · EVENT_CONFLICT + ids). 사건 하나가 뒤 대기열을 막지 않는다.
//   GET과 POST는 한 줄(lane)로 선다 — 머리가 바뀌는 사이 늦은 답이 앞 답을 덮지 않게(B5). 둘 다 호스트의 차례(turn) 안에서 돈다.

export const UPLOAD_LIMIT = 256;
export const BATCH_BYTES = 200_000; // 서버 본문 상한 262,144의 약 4분의 3(봉투 · since 몫을 남긴다)
export const SIFT_CAP = 8; // 한 세션에 가려낸 사건이 이것을 넘으면 그 세션은 올리기를 쉰다(R13)
export const UPLOAD_DELAY_MS = 1500;
export const PULL_GAP_MS = 5 * 60_000; // 화면이 다시 보일 때의 GET은 5분에 한 번까지(B5)
export const PULL_RETRY_MS = 3_000; // 첫 받기가 차례에 밀렸을 때(다른 탭이 쥠) 다시 받기까지
const BACKOFF_MS = [UPLOAD_DELAY_MS, 5_000, 15_000, 60_000, 300_000]; // 같은 실패는 물러서기
const AUTH_CODES = new Set(['AUTH_REQUIRED', 'AUTH_SESSION_MISSING', 'SESSION_REVOKED']);
const CODE = /^[A-Z][A-Z0-9_]{1,39}$/;

const codeOf = error =>
  typeof error?.code === 'string' && CODE.test(error.code) ? error.code : 'UPLOAD_FAILED';

// 상태 번호가 없는 실패 — 네트워크 · 시간 초과(계정 클라이언트의 NETWORK), 토큰 없음(AUTH_REQUIRED), 설정 없음(CONFIG).
function noStatus(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (AUTH_CODES.has(code)) return 'auth';
  return error?.retryable === false && code && code !== 'NETWORK' ? 'other' : 'offline';
}

// 서버 답의 갈래(계획 §18-5-2 표). method는 'post' · 'get'.
//   offline   네트워크 · 408 · 429 · 5xx — 물러서며 다시
//   too-large 413 — 묶음을 반으로
//   ids       409 EVENT_REVISION · EVENT_CONFLICT + ids — 그 번호만 버린다
//   sift      번호 없는 400류 · ids 없는 409 EVENT_CONFLICT(옛 talk) — 반씩 나눠 가려낸다
//   account   409 REVISION_CONFLICT · 403 LEARNING_DISABLED — 올리기 · 받기를 멈추고 셸이 계정을 다시 읽는다
//   writes    POST의 403 WRITES_DISABLED(옛 talk는 POST의 FEATURE_DISABLED) — 올리기만 멈춘다(스위치 꺼짐이 아니다)
//   switch    GET의 403 FEATURE_DISABLED — 그 계정의 서버 스위치 꺼짐
//   bad-since GET의 400류 — since 없이 한 번 다시(통째)
//   auth      401(토큰을 다시 받고도) — 셸의 인증 처리에 맡긴다
//   other     그 밖의 4xx — 올리기 · 받기를 멈추고 셸이 계정을 다시 읽는다
// 상태 번호 · 코드로 정해지는 갈래 — [POST의 갈래, GET의 갈래].
const BY_CODE = new Map([
  ['409 REVISION_CONFLICT', ['account', 'account']],
  ['403 LEARNING_DISABLED', ['account', 'account']],
  ['403 WRITES_DISABLED', ['writes', 'other']],
  ['403 FEATURE_DISABLED', ['writes', 'switch']],
]);

function postFailure(status, code, error) {
  if (status === 413) return 'too-large';
  const conflict = status === 409 && (code === 'EVENT_REVISION' || code === 'EVENT_CONFLICT');
  if (conflict && Array.isArray(error.ids) && error.ids.length) return 'ids';
  return status === 400 || conflict ? 'sift' : 'other';
}

export function failureOf(error, method) {
  const status = Number.isInteger(error?.status) ? error.status : 0;
  if (status === 0) return noStatus(error);
  if (status === 408 || status === 429 || status >= 500) return 'offline';
  if (status === 401) return 'auth';
  const code = typeof error?.code === 'string' ? error.code : '';
  const post = method === 'post';
  const known = BY_CODE.get(`${status} ${code}`);
  if (known) return known[post ? 0 : 1];
  if (post) return postFailure(status, code, error);
  return status === 400 ? 'bad-since' : 'other';
}

export function carrierOf(transport) {
  if (!transport) return { post: null, get: null };
  if (typeof transport === 'function') return { post: transport, get: null };
  return {
    post:
      typeof transport.post === 'function'
        ? (events, since) => transport.post(events, since)
        : null,
    get: typeof transport.get === 'function' ? since => transport.get(since) : null,
  };
}

const encoder = new TextEncoder();
export const eventBytes = event => encoder.encode(JSON.stringify(event)).length;

// 묶음 자르기 — 앞에서부터 건수와 바이트 둘 다 안에 드는 데까지(첫 사건은 늘 넣는다 — 너무 크면 413이 가려낸다).
export function cutBatch(events, { limit = UPLOAD_LIMIT, bytes = BATCH_BYTES } = {}) {
  const out = [];
  let total = 0;
  for (const event of events) {
    const size = eventBytes(event);
    if (out.length >= limit || (out.length && total + size > bytes)) break;
    out.push(event);
    total += size;
  }
  return out;
}

// 가려낸 사건의 계기 코드 — 서버 코드를 붙인다(예: REJECTED_INVALID_EVENTS).
const rejectedCode = error => {
  const code = `REJECTED_${codeOf(error)}`;
  return CODE.test(code) ? code : 'UPLOAD_REJECTED';
};

// trail(): 기록부 겉(coach/record.mjs) · carrier(): 지금 나르개(carrierOf — 셸이 바꿀 수 있다) · note: 계기 · tell: 같은 문서의 판들에 알림 ·
// announce: 다른 탭에 알림 · onAccount: 셸에 알림(판 · 동의 · 스위치 · 인증) · turn: 호스트의 차례(파생 기록을 쓰는 일 하나 동안).
export function createSync({
  trail,
  carrier,
  note,
  tell,
  announce,
  onAccount,
  turn = (_job, work) => work(),
  now = () => Date.now(),
}) {
  const state = {
    closed: false,
    timer: null,
    lane: Promise.resolve(),
    uploading: null,
    pulling: null,
    sweeping: null, // 하루 한 번 치우기(A6)
    stopped: null, // 'account' · 'auth' · 'other' — 올리기 · 받기를 멈춘 까닭(사건 덧붙이기는 계속)
    writesOff: false, // 올리기만 멈춤(WRITES_DISABLED)
    switchOff: false, // 그 계정의 서버 스위치 꺼짐(GET 403 FEATURE_DISABLED)
    paused: false, // 이 세션에 가려낸 사건이 SIFT_CAP을 넘었다
    skipped: new Set(), // 이 세션에 건너뛸 번호(가려낸 사건)
    failures: 0, // 이어진 offline 실패(물러서기)
    received: false, // 이번 바퀴에 서버의 답을 기록부에 받았다
    lastError: null, // 이번 바퀴를 멈춘 오류
    lastPull: Number.NEGATIVE_INFINITY,
    first: null, // 첫 받기의 결과 { ok, code? }
    firstWaiters: new Set(),
  };

  // GET · POST 한 줄 — 앞 일이 끝난 뒤에 다음 일을 시작한다(실패해도 줄은 이어진다).
  function inLane(work) {
    const run = state.lane.then(work, work);
    state.lane = run.catch(() => {});
    return run;
  }

  // 스위치가 꺼지면(GET 403 FEATURE_DISABLED) 올리기도 멈춘다 — 같은 403을 POST로 다시 받아 쓰기 문 닫힘으로 잘못 알리지 않게(카본 끝 판 D).
  const canPost = () =>
    !state.closed && !state.stopped && !state.writesOff && !state.switchOff && !state.paused;
  const canGet = () => !state.closed && !state.stopped && !state.switchOff;

  function stop(kind, error) {
    if (state.closed) return; // 닫힌 뒤 돌아온 실패는 셸에 알리지 않는다(카본 · GPT 끝 판 D)
    const code = codeOf(error);
    if (kind === 'writes') state.writesOff = true;
    else if (kind === 'switch') state.switchOff = true;
    else state.stopped = kind;
    if (kind !== 'auth' && kind !== 'switch') note('save', { ok: false, code });
    clearTimeout(state.timer);
    const revision = Number.isSafeInteger(error?.revision) ? error.revision : null;
    try {
      onAccount?.({ kind, code, status: error?.status ?? null, revision });
    } catch {
      // 셸의 알림이 던져도 기록부는 그대로다.
    }
    tell('account', { kind, code });
  }

  // 가려낸 사건 하나 — 이 세션 동안 건너뛴다(버리지 않음). 가려낸 것이 SIFT_CAP을 넘으면 이 세션은 쉰다.
  function isolate(event, error) {
    state.skipped.add(event.id);
    note('save', { ok: false, code: rejectedCode(error) });
    return state.skipped.size > SIFT_CAP ? 'paused' : 'ok';
  }

  async function receive(answer) {
    if (state.closed) return; // 닫힌 뒤 돌아온 답은 받지 않는다 — 서버는 받았으니 다음에 같은 번호가 「받음」으로 돌아온다
    await trail().receive(answer);
    state.received = true;
  }

  async function split(events) {
    const half = Math.ceil(events.length / 2);
    const first = await send(events.slice(0, half));
    return first === 'ok' ? send(events.slice(half)) : first;
  }

  // 한 묶음을 보낸다 — 보낼 때마다 지금 대기열(건너뛸 것 · 기댄 것 뺌)과 맞춰 거른다(앞 조각에서 가려낸 사건의 자식이 뒤 조각에 있다).
  async function send(batch) {
    if (state.closed) return 'closed'; // 닫힌 뒤에는 가려내기 · 나머지 보내기를 잇지 않는다(카본 · GPT 끝 판 D)
    const allowed = new Set(
      trail()
        .unsent(Number.POSITIVE_INFINITY, state.skipped)
        .map(e => e.id),
    );
    const events = batch.filter(event => allowed.has(event.id));
    if (!events.length) return 'ok';
    let answer;
    try {
      answer = await carrier().post(events, trail().since());
    } catch (error) {
      if (state.closed) return 'closed';
      return refused(events, error);
    }
    await receive(answer);
    return 'ok';
  }

  // 반씩 나눠 가려낸다 — 하나만 남으면 그 사건을 이 세션 동안 건너뛴다.
  const sift = (events, error) => (events.length === 1 ? isolate(events[0], error) : split(events));

  // 서버가 번호를 짚은 사건만 버리고(받은 표지 기록의 dropped) 나머지를 다시 보낸다. 짚은 번호가 이 묶음에 없으면 가려내기로
  // (같은 묶음을 되풀이하지 않게).
  async function dropNamed(events, error) {
    const ids = new Set(error.ids);
    const gone = events.filter(event => ids.has(event.id)).map(event => event.id);
    if (!gone.length) return sift(events, error);
    await receive({ rejected: gone, rejectedCode: codeOf(error) });
    const rest = events.filter(event => !ids.has(event.id));
    return rest.length ? send(rest) : 'ok';
  }

  function refused(events, error) {
    const kind = failureOf(error, 'post');
    if (kind === 'too-large' || kind === 'sift') return sift(events, error);
    if (kind === 'ids') return dropNamed(events, error);
    state.lastError = error; // 멈춤 갈래(offline · account · writes · auth · other)는 settle이 이 오류로 셸에 알린다
    return kind;
  }

  function settle(outcome, sent) {
    if (state.closed || outcome === 'closed') return;
    if (state.received) {
      announce();
      tell('receive');
    }
    if (outcome === 'ok') {
      state.failures = 0;
      // 한 묶음 넘게 남았거나 올리는 사이에 쓴 것이 있으면 이어서 — 이번에 보낸 것만 남았으면 곧바로 다시 보내지 않는다(헛돌지 않게).
      if (
        trail()
          .unsent(UPLOAD_LIMIT, state.skipped)
          .some(event => !sent.has(event.id))
      )
        schedule();
      return;
    }
    if (outcome === 'offline') {
      state.failures += 1;
      tell('offline');
      schedule();
      return;
    }
    if (outcome === 'paused') {
      state.paused = true;
      note('save', { ok: false, code: 'UPLOAD_PAUSED' });
      tell('offline');
      return;
    }
    stop(outcome, state.lastError);
  }

  async function round() {
    state.received = false;
    state.lastError = null;
    try {
      await trail().refresh(); // 차례에 들자마자 꼬리부터 — 다른 탭이 방금 받은 표지를 보고 같은 사건을 또 보내지 않게
    } catch {
      note('save', { ok: false, code: 'REFRESH_FAILED' });
    }
    await trail().saved();
    const events = canPost() ? cutBatch(trail().unsent(UPLOAD_LIMIT, state.skipped)) : [];
    if (!events.length) return;
    const outcome = await send(events);
    settle(outcome, new Set(events.map(event => event.id)));
  }

  // 차례를 못 얻었다(TURN_BUSY) — 이번 바퀴를 쉬고 다음 바퀴에(실패로 세지 않는다, §18-5-1 R2). 못 얻는 일이 이어지면 차례가 스스로
  // 기다리지 않고 차례 없이 한다(turn.mjs).
  function busy(error, then = null) {
    if (error?.code !== 'TURN_BUSY') throw error;
    then?.();
    return null;
  }
  // 차례 밖의 오류(저장소 예외 — 다른 탭의 판 올림으로 연결이 닫힘 · 용량 등)는 계기에 남기고 거절을 새지 않게 한다(카본 끝 판 D).
  function broke(error, first = false) {
    if (state.closed) return null;
    const code =
      typeof error?.code === 'string' && CODE.test(error.code) ? error.code : 'SYNC_FAILED';
    note('save', { ok: false, code });
    if (first) settleFirst({ ok: false, kind: 'other', code });
    return null;
  }

  function upload() {
    if (!canPost() || !carrier().post) return state.uploading;
    if (state.uploading) return state.uploading;
    if (!trail().unsent(1, state.skipped).length) return null;
    state.uploading = inLane(() =>
      turn('upload', round).catch(error =>
        error?.code === 'TURN_BUSY' ? busy(error, schedule) : broke(error),
      ),
    ).finally(() => {
      state.uploading = null;
      sweep();
    });
    return state.uploading;
  }

  // 하루 한 번 치운다 — 서버 시각을 받은 뒤, 같은 줄에서 차례 안에(못 얻으면 다음에 — 차례 없이 하지 않는다, §18-5-5 A6).
  function sweep() {
    if (state.closed || state.sweeping || !trail()?.compactDue?.()) return;
    state.sweeping = inLane(() => turn('compact', () => trail().compact()))
      .catch(error =>
        error?.code === 'TURN_BUSY' ? null : note('save', { ok: false, code: 'COMPACT_FAILED' }),
      )
      .finally(() => {
        state.sweeping = null;
      });
  }

  function schedule() {
    if (!canPost() || !carrier().post) return;
    clearTimeout(state.timer);
    const delay = BACKOFF_MS[Math.min(state.failures, BACKOFF_MS.length - 1)];
    state.timer = setTimeout(() => void upload(), delay);
    state.timer?.unref?.();
  }

  function settleFirst(result) {
    if (state.first) return;
    state.first = result;
    for (const done of [...state.firstWaiters]) done(result);
    state.firstWaiters.clear();
  }

  // 받기 실패 — 닫힌 뒤 돌아온 실패는 getRound가 여기 오기 전에 거른다(닫을 때 첫 받기는 이미 CLOSED로 풀렸다).
  async function getFailed(kind, error) {
    if (kind === 'offline') state.failures += 1;
    else if (kind === 'bad-since') note('save', { ok: false, code: codeOf(error) });
    else stop(kind, error);
    settleFirst({ ok: false, kind, code: codeOf(error) });
    return null;
  }

  // 받기 한 번 — 기준(since)이 맞지 않으면 since 없이 한 번 다시(통째). 실패는 { error }로 돌려준다(닫힌 뒤면 다시 하지 않는다).
  async function fetchSummary(get) {
    try {
      return { answer: await get(trail().since()) };
    } catch (error) {
      if (state.closed || failureOf(error, 'get') !== 'bad-since') return { error };
    }
    try {
      return { answer: await get(null) };
    } catch (again) {
      return { error: again };
    }
  }

  async function getRound() {
    const { answer, error } = await fetchSummary(carrier().get);
    if (state.closed) return null;
    if (error) return getFailed(failureOf(error, 'get'), error);
    const before = trail().summary();
    await trail().receive({
      summary: answer?.summary ?? null,
      serverTime: answer?.serverTime ?? null,
    });
    state.failures = 0;
    if (trail().summary() !== before) {
      announce();
      tell('receive');
    }
    settleFirst({ ok: true });
    return answer;
  }

  // 요약 받기. force가 아니면 5분에 한 번까지(화면이 다시 보일 때). 받는 길(get)이 없는 나르개면 하지 않는다 — 셸이 나르개를 늦게
  // 걸면(틀이 연 호스트를 셸이 받을 때) first()가 그때 받는다.
  function pull({ force = false } = {}) {
    if (!canGet() || !carrier().get) return Promise.resolve(null);
    if (state.pulling) return state.pulling;
    if (!force && now() - state.lastPull < PULL_GAP_MS) return Promise.resolve(null);
    const before = state.lastPull;
    state.lastPull = now();
    // 차례를 못 얻어(다른 탭이 쥠) 받지 못했으면 받은 것으로 치지 않는다 — 첫 받기는 잠시 뒤 다시(카본 끝 판 D).
    const missedTurn = () => {
      state.lastPull = before;
      if (!state.first && !state.closed) {
        clearTimeout(state.pullTimer);
        state.pullTimer = setTimeout(() => void pull({ force: true }), PULL_RETRY_MS);
        state.pullTimer?.unref?.();
      }
    };
    state.pulling = inLane(() =>
      turn('get', getRound).catch(error =>
        error?.code === 'TURN_BUSY' ? busy(error, missedTurn) : broke(error, true),
      ),
    ).finally(() => {
      state.pulling = null;
      sweep();
    });
    return state.pulling;
  }

  // 처음인 기기의 판 정하기가 기다리는 첫 받기의 결과 — 한도 안에서(계획 §18-5-5 G4). coach.ready는 이것을 기다리지 않는다.
  function firstPull(wait) {
    if (state.first) return Promise.resolve(state.first);
    return new Promise(resolve => {
      const done = result => {
        clearTimeout(timer);
        state.firstWaiters.delete(done);
        resolve(result);
      };
      const timer = setTimeout(
        () => done({ ok: false, kind: 'timeout', code: 'PULL_TIMEOUT' }),
        wait,
      );
      timer.unref?.();
      state.firstWaiters.add(done);
    });
  }

  return {
    upload,
    schedule,
    pull,
    firstPull,
    // 아직 한 번도 받으려 하지 않았으면 받는다(열 때 · 셸이 나르개를 건 때 — 셸의 코치가 여럿이어도 한 번).
    first: () =>
      state.lastPull === Number.NEGATIVE_INFINITY
        ? pull({ force: true })
        : (state.pulling ?? Promise.resolve(null)),
    // 다시 온라인 — 물러서기를 풀고 곧 올리고 받는다.
    online() {
      state.failures = 0;
      schedule();
      void pull({ force: true });
    },
    // 화면이 다시 보일 때 — 받기는 5분에 한 번까지.
    visible() {
      void pull();
    },
    status: () => ({
      stopped: state.stopped,
      writesOff: state.writesOff,
      switchOff: state.switchOff,
      paused: state.paused,
      skipped: state.skipped.size,
      failures: state.failures,
    }),
    close() {
      state.closed = true;
      clearTimeout(state.timer);
      clearTimeout(state.pullTimer);
      settleFirst({ ok: false, kind: 'closed', code: 'CLOSED' });
    },
  };
}
