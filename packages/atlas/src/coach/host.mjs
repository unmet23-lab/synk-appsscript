// 호스트 — 저장소 하나(계정 · 동의 판마다, storeName)에 기록부 하나(단계 4 계획 §3-2, 설계 §5-4 「쓰는 것은 호스트다」).
//   호스트는 늘 같은 출처의 가장 위 창의 엔진이 만든다 — 등록부 · 호스트 객체 · IndexedDB 연결 · 올리기 타이머 · 알림 통로가 모두
//   위 창의 것이라, 틀(게임)이 먼저 열어도 · 틀이 닫혀도 저장 · 올리기는 위 창에서 끝난다(Fable 설계 P1-3, 아르곤 A6). 엔진 묶음은
//   불러올 때 자기 창에 「호스트를 만드는 길」(MAKER)을 걸고, 틀의 코치는 위 창의 그 길로 호스트를 받는다. 위 창에 엔진이 없는(혼자 뜬)
//   페이지만 자기 창에 등록부를 둔다. 틀의 코치는 저장소 열쇠를 스스로 짓지 않고 셸이 연 문서 호스트를 받는다(host.document).
//   다른 탭은 같은 IndexedDB 저장소에 덧붙이고 BroadcastChannel로 알린다 — 받은 탭은 꼬리만 다시 읽는다(record.refresh()).
//   올리기는 계정만: 대기열(unsent) → 제품이 준 transport → 서버의 답(receive). 같은 사건을 두 탭이 올려도 서버가 번호로 거른다.
// 코치가 쓰는 보기 = 기록부 보기(record.view() — 저장이 끝난 사건) + 아직 저장이 안 끝난 내 답 · 본인 말(pending).
import { EDITION } from '../edition.mjs';
import { createMemory } from '../memory/index.mjs';
import { applyOwn } from '../fold/device.mjs';
import { byTime } from '../fold/order.mjs';
import { carriedFields, carriedSoFar, legacyToImport } from '../record/carry.mjs';
import { EVENT_TYPES } from '../record/events.mjs';
import { idbPort } from '../record/idb.mjs';
import { openTrail } from './record.mjs';

const REGISTRY = '__synkAtlasHosts';
const MAKER = '__synkAtlasHostMaker';
const UPLOAD_DELAY_MS = 1500;
const UPLOAD_LIMIT = 256;
// 옛 기록 읽개의 시간 한도(아래 carryLegacy). 시험만 host.legacyWait로 바꾼다.
export const LEGACY_WAIT_MS = 4000;
const DONE = Promise.resolve();

// 같은 출처의 가장 위 창(지금 판의 쓰기 임대 주인 __synkAtlasHistoryLease와 같은 자리).
export function hostScope(scope = globalThis) {
  let top = scope;
  try {
    for (let frame = scope; frame.parent && frame.parent !== frame; frame = frame.parent) {
      if (frame.parent.location?.origin !== scope.location?.origin) break;
      top = frame.parent;
    }
  } catch {
    // 다른 출처의 위 창에서 멈춘다.
  }
  return top;
}

const hostError = (code, message, cause) =>
  Object.assign(new Error(`Atlas host: ${message} (${EDITION})`), { code, cause });

// 이 창의 등록부(저장소 이름 → 호스트). document = 이 창의 셸이 처음 연 저장소 이름(틀이 받는 문서 호스트).
function registryOf(scope) {
  if (!scope[REGISTRY])
    Object.defineProperty(scope, REGISTRY, { value: new Map(), configurable: true });
  return scope[REGISTRY];
}

function makerOf(scope) {
  try {
    return typeof scope[MAKER] === 'function' ? scope[MAKER] : null;
  } catch {
    return null;
  }
}

// 여러 지도(은행 조각)를 한 색인으로 — 기록부의 어댑터 · 얹기가 읽는다. 판 폴더 하나에서 온 조각이라 색인 판이 같다.
function compositeIndex() {
  const maps = [];
  const familySkills = new Map();
  return {
    get edition() {
      return maps[0]?.editions.index ?? 'index-0';
    },
    lookup: itemKey => {
      for (const map of maps) {
        const item = map.item(itemKey);
        if (item) return item;
      }
      return null;
    },
    familySkills,
    add(map) {
      if (maps.includes(map)) return;
      if (maps.length && maps[0].editions.index !== map.editions.index)
        throw Object.assign(
          new Error('Atlas host: 색인 판이 다른 지도를 한 기록부에 섞을 수 없다'),
          {
            code: 'MAP_EDITION_MISMATCH',
          },
        );
      maps.push(map);
      for (const [family, skills] of map.familySkills)
        familySkills.set(family, [...new Set([...(familySkills.get(family) ?? []), ...skills])]);
    },
  };
}

function channelOf(key, onMessage) {
  if (typeof globalThis.BroadcastChannel !== 'function') return null;
  const channel = new globalThis.BroadcastChannel(`synk-atlas:${key}`);
  channel.onmessage = onMessage;
  channel.unref?.(); // Node(시험)에서 열린 알림 통로가 프로세스를 붙잡지 않게 — 브라우저에는 없다
  return channel;
}

function createHost({
  key,
  port,
  revision,
  guest,
  memory,
  params,
  health,
  transport,
  legacyWait = LEGACY_WAIT_MS,
  now,
  map,
  onClose,
  claims = { users: 0 },
}) {
  const index = compositeIndex();
  // 지도를 기록부를 열기 전에 넣는다 — 기록부가 처음 접는 요약의 판 묶음(색인 판)이 그 뒤의 보기와 같아야 한다.
  if (map) index.add(map);
  const pending = new Map(); // 사건 번호 → 접기 사건(아직 저장이 안 끝난 내 답 · 본인 말)
  const issuing = new Map(); // 사건 번호 → 「낸 것」 줄(아직 저장이 안 끝난 내 제시)
  const inflight = new Set(); // 아직 저장이 안 끝난 쓰기(stored 약속)
  const listeners = new Set();
  const state = {
    trail: null,
    channel: null,
    users: 0,
    timer: null,
    uploading: null,
    closed: false,
    carry: null, // 옛 기록 옮기기의 약속 — 호스트당 하나(계획 §16 ③)
  };
  // 듣는 함수마다 감싼다 — 하나(사라진 틀의 판 등)가 던져도 쓰기의 stored가 거절로 바뀌거나 뒤 판들이 소식을 놓치지 않는다.
  // 던진 듣는 함수를 지우지 않는다 — 일시적인 오류 하나가 그 판을 영영 귀먹게 하지 않게(N2). 듣는 함수는 그 판이 닫힐 때 빠진다.
  const tell = (kind, detail = {}) => {
    for (const listener of [...listeners]) {
      try {
        listener({ kind, ...detail });
      } catch {
        // 판 쪽이 스스로 계기에 남긴다(session.mjs).
      }
    }
  };
  // 지금 호스트의 계기에 — 셸이 받으면 계기가 셸의 것으로 바뀐다(take).
  const note = (kind, outcome) => health?.note(kind, outcome);

  // 다른 탭에 덧붙였다고 알린다. 닫은 뒤 늦게 끝난 쓰기는 알리지 않는다.
  function announce() {
    if (state.closed) return;
    try {
      state.channel?.postMessage({ key });
    } catch {
      // 알림이 안 가도 다른 탭은 다음에 열 때 읽는다.
    }
  }

  async function refresh() {
    await state.trail.refresh();
    tell('refresh');
  }

  async function upload() {
    if (guest || !transport || state.uploading || state.closed) return state.uploading;
    if (!state.trail.unsent(1).length) return null;
    state.uploading = (async () => {
      let events = [];
      try {
        // 저장 중인 사건(부모를 기다리는 자식까지)이 다 끝난 뒤에 보낸다 — 자식만 먼저 가서 서버가 부모 · 차례가 안 맞는다고 빼지 않게
        // (단계 3 bed650c2f record.saved()).
        await state.trail.saved();
        events = state.trail.unsent(UPLOAD_LIMIT);
        if (!events.length) return;
        const answer = await transport(events);
        await state.trail.receive(answer);
        tell('receive');
      } catch {
        tell('offline');
        return;
      } finally {
        state.uploading = null;
      }
      // 한 묶음(256) 넘게 남았거나 올리는 사이에 쓴 것이 있으면 이어서 올린다 — 새 쓰기 · online · 다시 열기를 기다리지 않게(GPT GC3).
      // 이번에 보낸 것만 남았으면(서버가 받았다고 안 한 것) 곧바로 다시 보내지 않는다 — 다음 쓰기 · online에(헛돌지 않게).
      const sent = new Set(events.map(event => event.id));
      if (!state.closed && state.trail.unsent(UPLOAD_LIMIT).some(event => !sent.has(event.id)))
        schedule();
    })();
    return state.uploading;
  }

  function schedule() {
    if (guest || !transport || state.closed) return;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => void upload(), UPLOAD_DELAY_MS);
    state.timer?.unref?.();
  }

  // 사건 하나를 쓴다. fold(event → 답 · 본인 말 · 도움의 접기 사건)와 issued(event → 제시의 「낸 것」 줄)는 저장이 끝날 때까지
  // 보기에 얹어 둔다. 둘 다 만든 사건(번호 · 시각)을 받아 짓는다.
  function write(type, fields, { fold = null, issued = null } = {}) {
    const made = state.trail.add(type, fields);
    const id = made.event.id;
    const folded = fold ? fold(made.event) : null;
    const row = issued ? issued(made.event) : null;
    if (folded) pending.set(id, folded);
    if (row) issuing.set(id, row);
    const stored = made.stored.then(ok => {
      pending.delete(id);
      issuing.delete(id);
      if (ok) {
        announce();
        schedule();
        tell('written', { id }); // 같은 문서의 다른 코치(판)가 이 쓰기를 본다
      } else tell('failed', { id });
      return ok;
    });
    inflight.add(stored);
    const drop = () => inflight.delete(stored);
    stored.then(drop, drop);
    return { event: made.event, stored };
  }

  return {
    key,
    guest,
    index,
    memory,
    params,
    get health() {
      return health;
    },
    // 셸이 받을 때마다(여는 셸 · 틀이 연 것을 받는 셸 · 이미 셸 호스트인 것을 또 받는 셸) — 올리기 고리와 계기를 그 셸의 것으로 걸고
    // (같은 값이면 그대로), 호스트가 아직 옛 기록 읽개를 받은 적이 없으면 그 읽개로 옮기기 약속을 건다(계획 §16 ③, Fable 5.2 D3 —
    // 읽개 없는 셸 코치가 먼저 받았어도 뒤 셸 코치의 읽개가 걸린다). 틀이 넘긴 올리기 · 읽개는 들지 않는다(acquireHere가 셸만 부른다).
    take({
      transport: nextTransport = null,
      health: nextHealth = null,
      legacy: reader = null,
    } = {}) {
      if (nextTransport) transport = nextTransport;
      if (nextHealth) health = nextHealth;
      if (guest && reader && !state.carry)
        state.carry = carryLegacy(state.trail.record, reader, note, legacyWait).then(() =>
          // 옮기기가 끝나면 듣는 판 모두에 알린다 — 약속보다 먼저 준비를 끝낸 코치의 판도 옮겨 온 만남 · 기억으로 다시 선다(D4 ㉠).
          tell('refresh'),
        );
      schedule();
    },
    // 옛 기록 옮기기의 약속 — 받는 모든 코치(셸 · 틀)가 이것을 기다린 뒤 준비를 끝낸다(D4 ㉡). 읽개를 받은 적이 없으면 곧 풀린다.
    carried: () => state.carry ?? DONE,
    async open() {
      // 기록부의 계기는 지금 호스트의 계기로 넘겨 준다 — 셸이 틀이 연 호스트를 받으면(take) 그 뒤 저장 계기도 셸의 것으로(아르곤 다시 A2).
      const healthNow = { note: (kind, outcome) => health?.note(kind, outcome) };
      state.trail = await openTrail({
        port,
        revision,
        guest,
        memory,
        params,
        index,
        health: healthNow,
        now,
      });
      state.channel = channelOf(key, () => void refresh());
      if (globalThis.addEventListener) globalThis.addEventListener('online', schedule);
      schedule();
      return this;
    },
    get trail() {
      return state.trail;
    },
    now: () => state.trail.now(),
    write,
    upload,
    refresh,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // 코치가 쓰는 보기 — 기록부 보기 위에 아직 저장이 안 끝난 내 답 · 본인 말을 시각 순으로 얹는다.
    view() {
      const view = state.trail.view();
      for (const event of [...pending.values()].sort(byTime))
        applyOwn(view, event, memory, params, index);
      return view;
    },
    // 「낸 것」 — 기록부의 줄(서버 요약의 다른 기기 줄 · 다른 탭 · 다른 코치 · 내 줄) 위에 저장 중인 내 제시를 같은 번호로 덮는다.
    // 제시가 기록부에 든 뒤 저장 끝을 듣기 전에도 한 줄이다(Fable 5.2 D8 — 이어 붙이면 돌아온 것을 하나 더 센다). 번호 없는 서버 요약 줄은
    // 겹치지 않게 따로 두고 그대로 센다(기록부와 같은 규칙).
    issued() {
      const rows = new Map(state.trail.issued().map((row, i) => [row.id ?? `#${i}`, row]));
      for (const [id, row] of issuing) rows.set(id, row);
      return [...rows.values()];
    },
    pendingCount: () => pending.size + issuing.size,
    // 지금까지의 쓰기가 다 끝나면 풀린다(성공 · 실패와 상관없이 — 기록부가 부모를 기다리는 자식까지).
    settled: () => Promise.allSettled([...inflight]).then(() => state.trail.saved()),
    retain() {
      claims.users += 1;
    },
    // 동기로 닫는다 — 사라지는 틀의 pagehide에서 불려도 등록부에서 바로 빠진다.
    release() {
      claims.users -= 1;
      if (claims.users > 0) return false;
      state.closed = true;
      clearTimeout(state.timer);
      if (globalThis.removeEventListener) globalThis.removeEventListener('online', schedule);
      state.channel?.close();
      onClose?.();
      return true;
    },
  };
}

// 옛 기기 기록 옮기기(설계 §5-6 · 단계 3 carry.mjs, Fable 설계 P1-5 ①) — 손님 호스트가 열 때마다 옛 저장소(지금 판 코치의 로그 ·
// 접힌 장부)에서 아직 옮기지 않은 사건 · 새로 든 장부만 옮긴다. 옛 판에 다녀온 기록(되돌리기 2주)도 다음에 열 때 들어온다.
// legacy()는 제품이 준다 → { log: 옛 꼴 사건들, ledger: 접힌 장부 } | null. 못 읽어도 새 길은 연다(계기에만 남긴다).
// 그 저장소의 코치가 모두 이 옮기기를 기다리므로 읽개에 시간 한도(LEGACY_WAIT_MS)를 둔다 — 넘으면 계기(LEGACY_CARRY)에 남기고 연다
// (Fable 5.2 D4, 늦게 온 값은 버린다 — 다음에 열 때 다시 옮긴다). WORLD 읽개는 localStorage라 바로 끝난다.
function withinTime(promise, wait) {
  let timer = null;
  const late = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('legacy reader timed out')), wait);
    timer.unref?.();
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

async function carryLegacy(record, legacy, note, wait) {
  try {
    const old = await withinTime(Promise.resolve().then(legacy), wait);
    if (!old) return;
    await record.importLegacy(legacyToImport(old.log, id => record.has(id)));
    const fields = carriedFields(old.ledger, carriedSoFar(record.heldEvents()));
    if (fields && !(await record.add(EVENT_TYPES.carried, fields).stored))
      throw new Error('carried');
  } catch {
    note('save', { ok: false, code: 'LEGACY_CARRY' });
  }
}

// 문서 호스트를 기다린다 — 셸의 첫 코치는 지도 조각을 받은 뒤에 호스트를 여므로, 그 사이에 연 틀이 곧바로 HOST_MISSING이 되지
// 않게 잠깐 기다린다(N5). 열리면 바로 풀린다.
export const DOCUMENT_WAIT_MS = 8000;
// 기다리던 틀은 문서 호스트가 서는 그 순간(동기) 쓰는 사람으로 센다 — 깨어나기 전에 셸이 닫아도 호스트가 남게(GPT 다시 GA4).
function documentOf(registry, wait) {
  if (!(wait > 0)) return Promise.resolve(null);
  registry.waiters ??= new Set();
  return new Promise(resolve => {
    const done = key => {
      clearTimeout(timer);
      registry.waiters.delete(done);
      const entry = key == null ? null : registry.get(key);
      if (entry) entry.claims.users += 1;
      resolve(entry ? key : null);
    };
    const timer = setTimeout(() => done(null), wait);
    timer.unref?.();
    registry.waiters.add(done);
  });
}
// 문서 호스트를 정한다 — 셸(위 창 자기 코치)이 연 호스트만 될 수 있고, 닫히면 남은 셸 호스트로 넘긴다(N3).
function setDocument(registry, key) {
  registry.document = key;
  if (key != null) for (const done of [...(registry.waiters ?? [])]) done(key);
}
function nextDocument(registry) {
  for (const [key, entry] of registry) if (entry.shell) return key;
  return null;
}

// 새 등록부 자리 — 등록부에 먼저 넣고 연다(같은 저장소를 동시에 여는 코치들이 연결을 둘 만들지 않게). shell은 셸이 받은 뒤에 선다(shellTakes).
function newEntry(registry, key, options, openPort) {
  const claims = { users: 0 };
  const entry = { key, shell: false, claims };
  const onClose = () => {
    if (registry.get(key) === entry) registry.delete(key);
    if (registry.document === key) setDocument(registry, nextDocument(registry));
  };
  entry.opening = (async () => {
    let port = options.port;
    try {
      port ??= await openPort(key);
    } catch (error) {
      throw hostError('STORAGE_FAILED', '저장소를 열지 못했다', error);
    }
    // 기억(memory)은 호스트를 만드는 창이 스스로 만든다 — 사라질 수 있는 틀의 객체를 위 창의 호스트가 들지 않게(N3).
    const memory = createMemory(options.params);
    return createHost({
      ...options,
      key,
      port,
      memory,
      onClose,
      claims,
      // 틀이 넘긴 올리기는 들지 않는다 — 셸이 같은 저장소를 받을 때 제 것을 건다(take). 옛 기록 읽개도 셸의 것만(take).
      ...(options.fromFrame === true ? { transport: null } : {}),
    }).open();
  })();
  registry.set(key, entry);
  entry.opening.catch(onClose);
  return entry;
}

// 셸이 같은 저장소를 받으면 그 호스트는 셸의 것이다 — 받을 때마다 올리기 · 계기 · 옛 기록 읽개를 그 셸의 것으로 걸고(D3) 문서 호스트로 세운다.
function shellTakes(registry, entry, host, options) {
  host.take({
    transport: options.transport,
    health: options.health,
    legacy: options.legacy,
  });
  entry.shell = true;
  if (registry.document == null) setDocument(registry, entry.key);
}

const missing = () => hostError('HOST_MISSING', '위 창의 셸이 연 문서 호스트가 없다');

// 기다림 없이 받을 자리를 정하고 같은 틱에 쓰는 사람으로 센다(계획 §16 ④) — 이미 선 문서 호스트 · 열린 저장소 · 여는 중인 저장소.
// 아직 안 선 문서 호스트면 null — 서는 순간(동기) documentOf가 센다. 받기의 첫 기다림 전에 세므로, 받는 사이에 다른 코치가 놓아도
// (동기 release) 이 코치가 받을 호스트가 닫히지 않는다(아르곤 끝 판 C3 · GPT r3 GA8).
function takeNow(registry, options, openPort) {
  if (options.document) {
    if (registry.document == null) return null;
    const entry = registry.get(registry.document);
    if (!entry) throw missing();
    entry.claims.users += 1; // 이미 선 문서 호스트 — 같은 틱에 센다
    return entry;
  }
  const entry = registry.get(options.key) ?? newEntry(registry, options.key, options, openPort);
  entry.claims.users += 1; // 열린 · 여는 중인 저장소 — 같은 틱에 센다
  return entry;
}

async function takeLater(registry, options) {
  const key = await documentOf(registry, options.wait ?? DOCUMENT_WAIT_MS);
  if (key == null) throw missing();
  return registry.get(key);
}

// 이 창에서 호스트를 연다(저장소 이름마다 하나 — 처음 부른 코치가 열고, 뒤의 코치는 같은 것을 받는다).
// document: 셸이 연 문서 호스트를 받는다(틀의 코치) — 기다려도 열린 것이 없으면 HOST_MISSING.
// fromFrame: 아래 창(틀)이 이 창의 길로 부른 것 — 틀이 연 호스트는 문서 호스트가 되지 않는다.
// 센 뒤에는 어떤 실패에서도(저장소를 못 엶 · 색인 판이 다른 지도) 셈을 되돌린다 — 센 곳도 되돌리는 곳도 하나다(Fable 5.2 D5).
async function acquireHere(scope, options, openPort) {
  const registry = registryOf(scope);
  const entry = takeNow(registry, options, openPort) ?? (await takeLater(registry, options));
  let host = null;
  try {
    host = await entry.opening;
    if (options.map) host.index.add(options.map);
    if (options.fromFrame !== true) shellTakes(registry, entry, host, options);
    // 옛 기록 옮기기의 약속 — 셸이든 틀이든 받는 코치는 모두 그 끝을 기다린다(계획 §16 ③ · D4 ㉡).
    await host.carried();
    return host;
  } catch (error) {
    if (host) host.release();
    else entry.claims.users -= 1;
    throw error;
  }
}

// 이 창의 엔진이 호스트를 만드는 길을 건다(묶음을 불러올 때 한 번). openPort는 시험만 바꾼다.
export function installHostMaker(scope = globalThis, { openPort = idbPort } = {}) {
  if (makerOf(scope)) return makerOf(scope);
  const maker = options => acquireHere(scope, options, openPort);
  try {
    Object.defineProperty(scope, MAKER, { value: maker, configurable: true });
  } catch {
    // 창에 걸 수 없으면 이 창 안에서만 쓴다.
  }
  return maker;
}
installHostMaker(globalThis);

// 호스트를 받는다 — 같은 출처의 위 창에 엔진이 있으면 그 창이 만들고, 없으면 이 창에서.
export function acquireHost(options, scope = globalThis) {
  const top = hostScope(scope);
  const up = top !== scope && makerOf(top);
  const maker = up || makerOf(scope) || installHostMaker(scope);
  return maker(up ? { ...options, fromFrame: true } : options);
}

export function releaseHost(host) {
  return host.release();
}
