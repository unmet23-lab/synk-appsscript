// 호스트 — 저장소 하나(계정 · 동의 판마다, storeName)에 기록부 하나(단계 4 계획 §3-2, 설계 §5-4 「쓰는 것은 호스트다」).
//   호스트는 늘 같은 출처의 가장 위 창의 엔진이 만든다 — 등록부 · 호스트 객체 · IndexedDB 연결 · 올리기 타이머 · 알림 통로가 모두
//   위 창의 것이라, 틀(게임)이 먼저 열어도 · 틀이 닫혀도 저장 · 올리기는 위 창에서 끝난다(Fable 설계 P1-3, 아르곤 A6). 엔진 묶음은
//   불러올 때 자기 창에 「호스트를 만드는 길」(MAKER)을 걸고, 틀의 코치는 위 창의 그 길로 호스트를 받는다. 위 창에 엔진이 없는(혼자 뜬)
//   페이지만 자기 창에 등록부를 둔다. 틀의 코치는 저장소 열쇠를 스스로 짓지 않고 셸이 연 문서 호스트를 받는다(host.document).
//   다른 탭은 같은 IndexedDB 저장소에 덧붙이고 BroadcastChannel로 알린다(쓰기 · 서버의 답을 받았을 때) — 받은 탭은 꼬리만 다시 읽는다(record.refresh()).
//   올리기 · 받기는 계정만(sync.mjs): 대기열(unsent) → 제품이 준 나르개(post · get) → 서버의 답(receive). 같은 사건을 두 탭이 올려도
//   서버가 번호로 거른다. 판 · 동의 · 스위치 · 인증 오류는 셸에 알린다(take의 onAccount — 셸이 계정을 다시 읽고 판을 다시 정한다).
// 코치가 쓰는 보기 = 기록부 보기(record.view() — 저장이 끝난 사건) + 아직 저장이 안 끝난 내 답 · 본인 말(pending).
import { EDITION } from '../edition.mjs';
import { createMemory } from '../memory/index.mjs';
import { applyOwn } from '../fold/device.mjs';
import { byTime } from '../fold/order.mjs';
import { carriedFields, carriedSoFar, carriedWith, legacyToImport } from '../record/carry.mjs';
import { EVENT_TYPES } from '../record/events.mjs';
import { idbPort } from '../record/idb.mjs';
import { openTrail } from './record.mjs';
import { dropEarlier } from './stores.mjs';
import { carrierOf, createSync } from './sync.mjs';
import { createTurn } from './turn.mjs';

const REGISTRY = '__synkAtlasHosts';
const MAKER = '__synkAtlasHostMaker';
// 옛 기록 읽개의 시간 한도(아래 carryLegacy). 시험만 host.legacyWait로 바꾼다.
export const LEGACY_WAIT_MS = 4000;
const DONE = Promise.resolve();
// 칸(측정 요약)을 바꾸는 내 사건 — 답과 도움(아래 unfolded).
const UNFOLDED_TYPES = new Set([EVENT_TYPES.attempted, EVENT_TYPES.helped]);
// 서버 접기가 단위 줄을 바꾸는 내 사건 — 답 · 도움 · 본인 말 · 제외(아래 unfoldedRows — 설계 주인 11-17, 단계 4 계획 §6 「켜기 전」 F4).
// 옮김(record.carried)은 기기에서 계열의 만남만 남기고 단위 줄 · 본인 말 줄을 바꾸지 않아 세지 않는다. 제시 · 전달 · 판 기록 · 피드백도 세지 않는다.
const ROW_TYPES = new Set([
  EVENT_TYPES.attempted,
  EVENT_TYPES.helped,
  EVENT_TYPES.stated,
  EVENT_TYPES.excluded,
]);

// 창의 출처 — 문서의 출처(window.origin)를 먼저 읽는다. srcdoc · about:blank 틀은 주소의 출처(location.origin)가 "null"이어도 위 창의
// 출처를 물려받는다(loader의 srcdoc 판 주소 M2와 같은 자리 — 5-3 ① 엔진 d 카본 C). origin이 없는 창(시험의 가짜 창)은 location.origin이다.
const originOf = scope =>
  typeof scope.origin === 'string' ? scope.origin : scope.location?.origin;
// 불투명 출처(샌드박스 틀) — 어느 창과도 같은 출처가 아니다(글로 「null」끼리 같아 보여도 오르지 않는다).
const OPAQUE = 'null';

// 같은 출처의 가장 위 창(지금 판의 쓰기 임대 주인 __synkAtlasHistoryLease와 같은 자리).
export function hostScope(scope = globalThis) {
  let top = scope;
  try {
    const mine = originOf(scope);
    for (let frame = scope; frame.parent && frame.parent !== frame; frame = frame.parent) {
      if (mine === OPAQUE || originOf(frame.parent) !== mine) break;
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
  let revision = 0; // 지도를 더할 때마다 오른다 — 기록부의 묶음 색인이 문항 찾기에 기댄 캐시를 버린다(record/groups.mjs)
  return {
    get edition() {
      return maps[0]?.editions.index ?? 'index-0';
    },
    get revision() {
      return revision;
    },
    lookup: itemKey => {
      for (const map of maps) {
        const item = map.item(itemKey);
        if (item) return item;
      }
      return null;
    },
    // 계열 → 계열 줄(판마다 열쇠가 생기는 은행)의 지금 이름과 단위 — 열쇠로 못 찾은 옛 꼴 제시를 접기 어댑터가 다시 찾는다(단계 4 계획 §26-6,
    // 서버 foldIndex.family와 같은 길). 계열 줄을 모르는 지도(시험의 가짜 지도)는 건너뛴다.
    family: familyKey => {
      for (const map of maps) {
        const row = map.familyRow?.(familyKey) ?? null;
        if (row) return row;
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
      revision += 1;
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
  shellGone = null, // 셸로 받은 코치가 놓을 때(문서 호스트 셈 — 등록부 자리가 준다)
  onAccount = null,
  claims = { users: 0 },
  // 차례의 자물쇠(Web Locks) — 시험만 바꾼다(가짜 자물쇠 · null). 없는 브라우저는 차례 규칙만으로 한다(§18-5-1 ⓓ).
  locks = globalThis.navigator?.locks ?? null,
  // 일마다 한도 표(turn.mjs TURN_JOBS) — 시험만 짧게 바꾼다.
  turnJobs = null,
  account = null, // 계정 저장소의 계정(손님 → 계정 옮기기의 받는 쪽 — §18-5-3)
  ownsPort = true, // 이 호스트가 연 포트인가 — 제품이 준 포트(host.port)는 제품이 닫는다(넘친 #14)
}) {
  const index = compositeIndex();
  // 지도를 기록부를 열기 전에 넣는다 — 기록부가 처음 접는 요약의 판 묶음(색인 판)이 그 뒤의 보기와 같아야 한다.
  if (map) index.add(map);
  const pending = new Map(); // 사건 번호 → 접기 사건(아직 저장이 안 끝난 내 답 · 본인 말)
  const issuing = new Map(); // 사건 번호 → 「낸 것」 줄(아직 저장이 안 끝난 내 제시)
  const saving = new Map(); // 사건 번호 → 사건(아직 저장이 안 끝난 내 쓰기 — 접기 사건을 다시 지을 때, refold)
  const inflight = new Set(); // 아직 저장이 안 끝난 쓰기(stored 약속)
  // 바탕 요약에 아직 접히지 않은 내 사건 가운데 그 종류의 수 — 저장 중인 쓰기와, 저장됐지만 요약이 아직 접지 않은 사건(손님은 다음 접기 전,
  // 계정은 서버가 받았어도 접은 요약이 오기 전 — 기록부의 미접힘 표)을 번호로 합쳐 센다(아래 unfolded · unfoldedRows).
  const unfoldedOf = types => {
    const ids = new Set();
    for (const [id, event] of saving) if (types.has(event.type)) ids.add(id);
    for (const id of state.trail.pending())
      if (types.has(state.trail.heldEvent(id)?.type)) ids.add(id);
    return ids.size;
  };
  // 저장소가 닫혔다는 알림은 알림 통로(셸의 onAccount 함수)마다 한 번이다. 틀이 먼저 연 호스트(통로 없음)가 닫힌 뒤 셸이 받으면 그 셸의
  // 통로에 한 번 알린다(Fable 5.2 끝 판 둘째 넘친 #6 · 설계 주인 조건 (a) 고쳐 읽기 — 단계 4 계획 §23-3). 닫은(닫는 중인) 호스트는 알리지 않는다.
  const toldGone = new WeakSet();
  const tellGone = () => {
    if (!onAccount || toldGone.has(onAccount)) return;
    toldGone.add(onAccount);
    try {
      onAccount({ kind: 'store', code: 'STORE_CLOSED', status: null, revision: null });
    } catch {
      // 셸의 알림이 던져도 호스트는 그대로다
    }
  };
  const listeners = new Set();
  const state = {
    trail: null,
    channel: null,
    users: 0,
    closed: false,
    storeGone: false, // 저장소 연결이 닫혔다(계기는 호스트마다 한 번 — F5, 셸 알림은 통로마다 한 번 — §23-3)
    carry: null, // 옛 기록 옮기기의 약속 — 호스트당 하나(계획 §16 ③)
    unsaved: false, // 저장 실패가 이어지는 중(받기를 한 번 강제했다 — F5)
    // 이 호스트(= 이 기록부)에서 저장 실패가 한 번이라도 났다 — 성공으로 끄지 않는다. 기록부는 실패한 답 · 도움의 계열을 메모리 만남 표에
    // 사는 동안 들고 있어(판을 새로 열어도), 그 뒤 같은 계열의 내 답은 판 안에서 첫 만남이 아닌 것으로 얹히고 저장된 뒤 보기에서는 첫 만남이
    // 된다 — 판(session)이 그 답 · 도움의 저장이 끝날 때 한 번 다시 세운다(설계 주인 결정 6 · Fable 5.2 합친 끝 판 넘친 #13의 남은 반쪽).
    failedOnce: false,
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

  // 차례 — 파생 기록을 쓰는 일 하나 동안만 쥐었다 놓는다(turn.mjs, §18-5-1). 쥐는 겹은 이 호스트 하나다(R1): 올리기 · 받기 · 치우기 ·
  // 옛 기록 옮기기를 이 안에서 하고, 같은 함수를 기록부에 exclusive로 준다. 일을 하는 동안 기록부는 「차례 안」이다.
  const turn = createTurn({
    name: `synk-atlas:${key}`,
    locks,
    enter: () => state.trail?.enterTurn(),
    leave: () => state.trail?.leaveTurn(),
    ...(turnJobs ? { jobs: turnJobs } : {}),
  });

  // 다른 탭에 덧붙였다고 알린다 — 채널이 열려 있는 동안만. 놓은 뒤에도 채널은 저장 사슬 끝까지 열려 있어 그 사이 끝난 쓰기(손님 요약
  // 저장 · 사건 쓰기)는 알리고, 채널이 닫힌 뒤 늦게 끝난 쓰기는 알리지 않는다(받기 알림 다시 검수 Fable F2 · 설계 주인 11-16 저녁).
  function announce() {
    const channel = state.channel;
    if (!channel) return;
    try {
      channel.postMessage({ key });
    } catch {
      // 알림이 안 가도 다른 탭은 다음에 열 때 읽는다.
    }
  }

  // 다른 탭이 이 저장소를 비웠다(단계 4 계획 §22-4 다른 탭의 은퇴 알림 — Fable새5). 기록부가 꼬리에서 새 세대의 비움 표지를 만났거나 막이에
  // 걸려 다시 읽은 뒤 세대마다 한 번 부른다. 저장소가 닫혔을 때(storeClosed)와 같은 길로 셸에 알린다 — 셸이 이 탭의 코치를 은퇴시키고 다시
  // 정한다(손님 호스트도 — 셸이 손님 코치에도 onAccount를 준다). 그래야 다른 탭에 열린 판이 지워진 제시에 답을 이어 쓰지 않는다. 같은 문서의
  // 판들에도 알린다(다시 세운다).
  function clearedElsewhere(gen) {
    if (state.closed) return;
    note('save', { ok: false, code: 'STORE_CLEARED', dependent: true });
    tell('cleared', { gen });
    try {
      onAccount?.({ kind: 'store', code: 'STORE_CLEARED', status: null, revision: null });
    } catch {
      // 셸의 알림이 던져도 호스트는 그대로다
    }
  }

  // 다른 탭의 알림으로 꼬리를 읽는다 — 닫힌 뒤에는 읽지 않고, 저장소 읽기가 실패해도 처리되지 않은 거절로 새지 않게 계기에만 남긴다
  // (다음 알림 · 다음 열기에 다시 읽는다, 카본 끝 판 B5).
  async function refresh() {
    if (state.closed) return;
    try {
      await state.trail.refresh();
    } catch {
      note('save', { ok: false, code: 'REFRESH_FAILED' });
      return;
    }
    tell('refresh');
  }

  // 올리기 · 받기(sync.mjs) — 계정만. 저장 중인 사건(부모를 기다리는 자식까지)이 다 끝난 뒤에 보내고(단계 3 bed650c2f record.saved()),
  // 서버의 답(받은 표지 · 누른 것 · 버린 것 · 요약)을 덧붙인 뒤 다른 탭에도 알린다(GPT 최종 GC1). 한 묶음 넘게 남았거나 올리는 사이에
  // 쓴 것이 있으면 이어서 올린다(GPT GC3).
  const sync = createSync({
    trail: () => state.trail,
    carrier: () => carrierOf(guest ? null : transport),
    note: (kind, outcome) => note(kind, outcome),
    tell,
    announce: () => announce(),
    onAccount: detail => onAccount?.(detail),
    turn,
    now: () => (state.trail ? state.trail.now() : Date.now()),
    clock: now ?? (() => Date.now()), // 받기 간격은 서버 시각으로 고치지 않은 시계로(넘친 #18)
  });
  const upload = () => (guest ? null : sync.upload());
  const schedule = () => {
    if (!guest && !state.closed) sync.schedule();
  };
  const online = () => {
    if (!guest && !state.closed) sync.online();
  };
  // 화면이 다시 보일 때 — 요약 받기는 5분에 한 번까지(B5).
  const visible = () => {
    if (!guest && !state.closed && globalThis.document?.visibilityState !== 'hidden')
      sync.visible();
  };

  // 사건 하나를 쓴다. fold(event → 답 · 본인 말 · 도움의 접기 사건)와 issued(event → 제시의 「낸 것」 줄)는 저장이 끝날 때까지
  // 보기에 얹어 둔다. 둘 다 만든 사건(번호 · 시각)을 받아 짓는다. nothingTouched는 판 응답을 빼는 제외만 준다(기록부 valueOf).
  function write(type, fields, { fold = null, issued = null, nothingTouched = false } = {}) {
    const made = state.trail.add(
      type,
      fields,
      nothingTouched ? { nothingTouched: true } : undefined,
    );
    const id = made.event.id;
    const folded = fold ? fold(made.event) : null;
    const row = issued ? issued(made.event) : null;
    if (folded) pending.set(id, folded);
    if (row) issuing.set(id, row);
    saving.set(id, made.event);
    const stored = made.stored.then(ok => {
      saving.delete(id);
      pending.delete(id);
      issuing.delete(id);
      if (ok) {
        state.unsaved = false;
        announce();
        schedule();
        tell('written', { id }); // 같은 문서의 다른 코치(판)가 이 쓰기를 본다
      } else {
        // 저장이 실패하기 시작하면 받기를 한 번 강제한다 — 다른 탭이 판을 올려 이 판 저장소가 닫힌 것이면 서버의 판 울타리 답(409)으로
        // 셸이 판을 다시 정한다(저장이 됐을 때만 올리기를 잡아, 그 답을 받을 일이 없었다 — Fable 5.2 끝 판 F5). 실패가 이어지는 동안은 한 번.
        if (!guest && !state.closed && !state.unsaved) void sync.pull({ force: true });
        state.unsaved = true;
        state.failedOnce = true;
        tell('failed', { id });
      }
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
    account,
    revision,
    index,
    memory,
    params,
    // 파생 기록을 쓰는 일 하나 동안의 차례(§18-5-1) — 손님 → 계정 옮기기(move.mjs)가 쓴다.
    turn: (job, work) => turn(job, work),
    note: (kind, outcome) => note(kind, outcome),
    // 다른 저장소에서 사건을 옮겨 왔다 — 다른 탭 · 같은 문서의 판들에 알리고 올린다(§18-5-3 ⑤).
    landed() {
      announce();
      tell('refresh');
      schedule();
    },
    // 이 저장소의 연결이 닫혔다(다른 탭이 판이 오른 저장소를 열어 이 판을 지움 — 포트의 onClosed). 뒤의 저장은 모두 실패하니 셸에 알려 판을
    // 다시 정하게 한다 — 받기의 판 울타리 답을 기다리지 않는다(오프라인이어도). 알림은 호스트마다 한 번이고, 이미 닫은(닫는 중인) 호스트는
    // 알리지 않는다 — 제 탭이 새 판 저장소를 열며 앞 판을 지울 때 닫는 중인 앞 판 호스트에도 versionchange가 온다. 올리는 길 · 기기 길
    // 저장소는 지워질 수 있어 셸(onAccount)에 알리고, 손님 저장소는 지우기 대상이 아니라 계기만 남긴다(셸이 손님 호스트에는 onAccount를
    // 주지 않는다 — Fable 5.2 끝 판 F5 · 설계 주인 11-13).
    storeClosed() {
      if (state.closed) return;
      if (!state.storeGone) note('save', { ok: false, code: 'STORE_CLOSED' });
      state.storeGone = true;
      tellGone();
    },
    get health() {
      return health;
    },
    // 셸이 받을 때마다(여는 셸 · 틀이 연 것을 받는 셸 · 이미 셸 호스트인 것을 또 받는 셸) 올리기 고리와 계기를 그 셸의 것으로 건다
    // (같은 값이면 그대로, Fable 5.2 D3). 옛 기록 읽개는 받는 코치가 누구든 저장소 자리에 적힌 셸의 읽개로 건다(acquireHere — 읽개를
    // 든 셸이 열기를 기다리기 전에 적는다, r4 아르곤 A1) — 호스트가 읽개를 받은 적이 없을 때 한 번만 옮기기 약속이 선다(계획 §16 ③).
    // 틀이 넘긴 올리기 · 읽개는 들지 않는다.
    take({
      transport: nextTransport = null,
      health: nextHealth = null,
      legacy: reader = null,
      onAccount: nextAccount = null,
    } = {}) {
      if (nextTransport) transport = nextTransport;
      if (nextHealth) health = nextHealth;
      if (nextAccount) onAccount = nextAccount;
      // 이미 닫힌 저장소를 새 통로로 받았다 — 그 통로에 한 번 알린다(틀이 먼저 연 뒤 닫힌 호스트를 셸이 받음 — 계획 §23-3).
      if (nextAccount && state.storeGone && !state.closed) tellGone();
      if (nextTransport && !guest && !state.closed) void sync.first();
      // 옛 기록 옮기기는 차례 안에서 — 못 얻으면 기다리지 않고 차례 없이 한다(coach.ready가 기다리는 일, §18-5-1 R2).
      if (guest && reader && !state.carry)
        state.carry = turn('legacy', () =>
          carryLegacy(state.trail.record, reader, note, legacyWait),
        )
          .catch(() => {}) // 닫힌 호스트 — 옮기기는 다음에 열 때
          .then(() => {
            // 옮기기가 끝나면 듣는 판 모두에 알린다 — 약속보다 먼저 준비를 끝낸 코치의 판도 옮겨 온 만남 · 기억으로 다시 선다(D4 ㉠).
            // 다른 탭에도 알린다 — 옮겨 쓴 사건 · 장부를 그 탭이 꼬리로 읽게(받은 서버 답과 같은 길, GPT 끝 판 GB1).
            announce();
            tell('refresh');
          });
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
        exclusive: turn,
        // 손님 · 동의를 끈 기록부의 요약 저장이 끝나면 다른 탭에 알린다 — 다른 탭은 꼬리를 다시 읽어 접힌 요약을 받는다(받기 알림 설계 검토 D2 ·
        // 설계 주인 11-16 저녁 조건 2). 계정 기록부의 길은 그대로다.
        ...(guest ? { onLocalSaved: () => announce() } : {}),
        onCleared: gen => clearedElsewhere(gen),
      });
      state.channel = channelOf(key, () => void refresh());
      if (globalThis.addEventListener) globalThis.addEventListener('online', online);
      globalThis.document?.addEventListener?.('visibilitychange', visible);
      schedule();
      // 열 때 요약을 받는다(B5) — coach.ready는 이것을 기다리지 않는다(요약이 있는 기기는 오프라인으로 바로 선다, G4).
      if (!guest) void sync.first();
      return this;
    },
    get trail() {
      return state.trail;
    },
    now: () => state.trail.now(),
    write,
    upload,
    // 요약 받기(GET) — force가 아니면 5분에 한 번까지. 첫 받기의 결과는 firstPull(한도)로 기다린다(G4).
    pull: options => (guest ? Promise.resolve(null) : sync.pull(options)),
    firstPull: wait => (guest ? Promise.resolve({ ok: true, guest: true }) : sync.firstPull(wait)),
    syncStatus: () => sync.status(),
    // 아직 못 올린 내 사건이 남았나(이 세션에 서버가 받지 않아 건너뛴 것은 빼고 — 계정 비우기의 0 걸음). 손님은 0.
    unsentLeft: () => (guest ? 0 : sync.left()),
    // 이 세션에 보낼 수 없는 내 사건 수(건너뛴 것과 그 자식 — 쉬는 세션이면 남은 것 모두). 계정 비우기의 0 걸음이 알린다(F4). 손님은 0.
    unsentHeld: () => (guest ? 0 : sync.held()),
    // 든 사건과 저장 중인 내 쓰기(판 응답 목록 — 단계 4 계획 §22-5). 고른 응답이 저장되기 전에도 목록 · 짧은 연습 길이에 바로 선다.
    ownEvents: () => [
      ...state.trail.heldEvents(),
      ...[...saving.values()].filter(event => !state.trail.heldEvent(event.id)),
    ],
    // 마지막으로 읽은 판 응답의 서버 값(단계 4 계획 §22-5 · Fable새6) — 코치 responses({ server })가 적는다. 이 호스트(같은 저장소의 코치들)가
    // 사는 동안만 들고 기기에 저장하지 않는다(은퇴 · 판 바뀜과 함께 버린다).
    responsesRead: null,
    // 기기에서 본 판 응답 빼기의 겨눈 번호(4-5 코드 검수 GPT GB4 — record/responses.mjs noteGone). 호스트가 사는 동안만 든다.
    responsesGone: new Set(),
    refresh,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // 아직 저장이 안 끝난 내 사건의 접기 사건을 다시 짓는다(fold: 사건 → 접기 사건 목록, 비면 얹지 않는다) — 저장하는 사이 같은 묶음의 앞
    // 형제가 실패하거나 제외가 오면 처음 접은 값이 낡는다(Fable 5.2 합친 끝 판 넘친 #13). 저장이 끝난 사건은 건너뛴다 — 기록부 보기가 접었다.
    // 돌려주는 값 = 아직 저장 중이라 다시 지었나.
    refold(id, fold) {
      const event = saving.get(id);
      if (!event) return false;
      const folded = fold(event);
      if (folded?.length) pending.set(id, folded);
      else pending.delete(id);
      return true;
    },
    // 코치가 쓰는 보기 — 기록부 보기 위에 아직 저장이 안 끝난 내 답 · 본인 말을 시각 순으로 얹는다.
    view() {
      const view = state.trail.view();
      // 한 사건이 접기 사건 여럿을 낼 수 있다(제품이 「처음이 아니다」라고 한 제시의 첫 만남 — 장부 만남과 그 답, coach/session.mjs foldsOf).
      for (const event of [...pending.values()].flat().sort(byTime))
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
    // 이 호스트에서 저장 실패가 한 번이라도 났나(state.failedOnce — 판이 그 뒤 내 답 · 도움을 저장 뒤 한 번 더 세운다).
    failedOnce: () => state.failedOnce,
    pendingCount: () => pending.size + issuing.size,
    // 바탕 요약에 아직 접히지 않은 내 답 · 도움(단계 4 계획 §21-3 M1). 제시 · 판 기록 · 본인 말은 세지 않는다.
    unfolded: () => unfoldedOf(UNFOLDED_TYPES),
    // 서버 접기가 단위 줄을 바꾸는 내 사건 가운데 아직 접혀 돌아오지 않은 수(설계 주인 11-17 — 4-4c 끝 판 Fable F4). 답 · 도움에 본인 말과
    // 제외를 더한다. 제외는 거두는 대상의 종류와 상관없이 센다. 세는 법이 unfolded와 같아 늘 unfolded 이상이다. 학습일 답만 쓴다.
    unfoldedRows: () => unfoldedOf(ROW_TYPES),
    // 지금까지의 쓰기가 다 끝나면 풀린다(성공 · 실패와 상관없이 — 기록부가 부모를 기다리는 자식까지).
    settled: () => Promise.allSettled([...inflight]).then(() => state.trail.saved()),
    retain() {
      claims.users += 1;
    },
    // 동기로 닫는다 — 사라지는 틀의 pagehide에서 불려도 등록부에서 바로 빠진다.
    // claim: 받을 때 넘긴 표(셸로 받았으면 shell) — 셸 코치가 다 놓으면 이 저장소는 문서 호스트에서 내려온다(카본 · GPT 끝 판 C).
    release(claim = null) {
      if (claim?.shell) {
        claim.shell = false;
        shellGone?.();
      }
      claims.users -= 1;
      if (claims.users > 0) return false;
      state.closed = true;
      sync.close();
      turn.close(); // 기다리던 청하기를 거둔다
      if (globalThis.removeEventListener) globalThis.removeEventListener('online', online);
      globalThis.document?.removeEventListener?.('visibilitychange', visible);
      onClose?.();
      // 저장 중인 것(부모를 기다리는 자식까지)이 끝난 뒤 저장소 연결을 닫는다 — 열린 채 남은 연결이 뒤 판의 저장소 꼴 올리기 ·
      // 앞 판 저장소 지우기 · 비우기를 막지 않게(단계 4 §18-5-5 G3). 닫히는 사이 같은 저장소를 다시 여는 코치는 새 연결을 받는다.
      // 다른 탭에 알리는 채널은 이 사슬 끝에 닫는다 — 손님 요약 저장이 놓은 뒤에 끝나도 알림이 간다. 사슬이 실패해도 닫는다(받기 알림
      // 다시 검수 Fable F2 · 설계 주인 11-16 저녁). 닫힌 호스트의 refresh()는 아무것도 하지 않으므로 늦은 알림이 이 호스트를 깨우지 않는다.
      const channel = state.channel;
      void Promise.allSettled([...inflight])
        .then(() => state.trail?.saved())
        .then(() => state.trail?.localSaved())
        .then(() => (ownsPort ? port.close?.() : null))
        .catch(() => {})
        .finally(() => {
          if (state.channel === channel) state.channel = null;
          try {
            channel?.close();
          } catch {
            // 이미 닫힌 채널
          }
        });
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

// 비운 뒤(단계 4 계획 §22-4)에는 셋을 더 본다. ① 옛 로그의 바닥(손님 비우기가 둔다) — 바닥과 같은 옛 로그(같은 epoch이거나 어느 쪽이든 epoch을
// 모름)면 바닥 시각 뒤의 사건만 옮기고 접힌 장부는 옮기지 않는다(비운 기록이 옛 로그에서 되살아나지 않게 — Fable새3). epoch이 다르면(옛 엔진이
// 비운 뒤) 모두 새것이다. ② 옮김 표지의 번호는 「이미 있음」이다 — 계정 비우기가 손님 저장소에서 지운 옮긴 사건을 옛 로그에서 다시 들이지
// 않는다(카본새1 · Fable새1). ③ 비움 표지의 옮긴 장부 칸도 이미 옮긴 것으로 센다 — 지운 장부가 새 번호로 다시 들지 않게(Fable -c FA1).
async function carryLegacy(record, legacy, note, wait) {
  try {
    await record.refresh(); // 차례에 들자마자 꼬리부터 — 다른 탭이 방금 옮긴 것을 또 옮기지 않게(§18-5-1)
    const old = await withinTime(Promise.resolve().then(legacy), wait);
    if (!old) return;
    const cleared = record.cleared?.() ?? null;
    const floor = cleared?.legacy ?? null;
    const epoch = old.epoch ?? null;
    const same = floor != null && (floor.epoch == null || epoch == null || floor.epoch === epoch);
    const moved = record.movedIds?.() ?? new Set();
    const fresh = legacyToImport(old.log, id => record.has(id) || moved.has(id)).filter(
      event => !same || Date.parse(event.at) > floor.at,
    );
    await record.importLegacy(fresh);
    if (same) return;
    const fields = carriedFields(
      old.ledger,
      carriedWith(carriedSoFar(record.heldEvents()), cleared?.carried ?? null),
    );
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
// 문서 호스트를 정한다 — 셸(위 창 자기 코치)이 받은 호스트만 될 수 있고, 가장 나중에 받은 셸의 것이다(로그인 · 동의 판으로 저장소를
// 갈아타면 따라간다). 셸 코치가 다 놓거나 닫히면 남은 셸 가운데 가장 나중의 것으로 넘긴다(N3 · 카본 · GPT 끝 판 C).
function setDocument(registry, key) {
  registry.document = key;
  if (key != null) for (const done of [...(registry.waiters ?? [])]) done(key);
}
// 이 저장소가 문서 호스트면 남은 셸 가운데 가장 늦게 연 것으로 내려온다(없으면 빈다) — 셸이 다 놓을 때(shellGone)와 자리가 닫힐 때
// (onClose) 같은 규칙이다(카본 · GPT 끝 판 C).
function leaveDocument(registry, key) {
  if (registry.document === key) setDocument(registry, nextDocument(registry));
}
function nextDocument(registry) {
  let next = null;
  for (const [key, entry] of registry)
    if (entry.shell && (!next || entry.shellAt > next.shellAt))
      next = { key, shellAt: entry.shellAt };
  return next?.key ?? null;
}

// 저장소 연결을 연다(제품이 준 포트면 그것). 연 연결이 닫히면(다른 탭이 판이 오른 저장소를 열어 이 판을 지움 — 포트의 onClosed) 호스트가
// 셸에 알린다 — 호스트가 서기 전에 닫혔으면 선 뒤에 알린다(watch.early, Fable 5.2 끝 판 F5).
async function openWatched(openPort, key, given, gone) {
  const watch = { host: null, early: false };
  const onClosed = () => {
    gone();
    if (watch.host) watch.host.storeClosed();
    else watch.early = true;
  };
  try {
    return { port: given ?? (await openPort(key, { onClosed })), watch };
  } catch (error) {
    throw hostError('STORAGE_FAILED', '저장소를 열지 못했다', error);
  }
}

// 새 등록부 자리 — 등록부에 먼저 넣고 연다(같은 저장소를 동시에 여는 코치들이 연결을 둘 만들지 않게). shell은 셸이 받은 뒤에 선다(shellTakes).
function newEntry(registry, key, options, openPort) {
  const claims = { users: 0 };
  // shellUsers: 셸로 받은 코치 수, shellAt: 셸이 마지막으로 받은 차례(문서 호스트는 가장 나중의 셸 것).
  const entry = { key, shell: false, shellUsers: 0, shellAt: 0, claims };
  // 등록부의 그 열쇠 자리가 이 자리일 때만 내린다 — 저장소가 닫혀 먼저 내려간 자리의 늦은 닫기 · 셸 놓기가 같은 열쇠로 새로 연 자리와
  // 문서 호스트를 건드리지 않게(계획 §23-3).
  const drop = () => {
    if (registry.get(key) !== entry) return;
    registry.delete(key);
    leaveDocument(registry, key);
  };
  const onClose = drop;
  // 저장소 연결이 닫혀 내려간 자리다 — 여는 중이면 기록부 준비가 실패해도 기다리던 셸의 통로에 알린다(acquireHere, GPT 다시 검토 GA1).
  const closed = () => {
    entry.storeClosed = true;
    drop();
  };
  const shellGone = () => {
    entry.shellUsers = Math.max(0, entry.shellUsers - 1);
    if (entry.shellUsers > 0) return;
    entry.shell = false;
    if (registry.get(key) === entry) leaveDocument(registry, key);
  };
  entry.opening = (async () => {
    // 저장소 연결이 닫히면(다른 탭이 판이 오른 저장소를 열어 이 판을 지움) 이 자리를 등록부에서 내린다 — 같은 열쇠로 새로 여는 코치는 새 자리 ·
    // 새 연결을 받고, 쥔 코치는 그대로 쥔다(저장이 실패해 판에서 빠진다). Fable 5.2 끝 판 둘째 넘친 #6 · 계획 §23-3.
    const { port, watch } = await openWatched(openPort, key, options.port, closed);
    // 판이 오른 계정 저장소를 열었으면 같은 계정의 앞 판 사본을 버린다(설계 §5-3 · 단계 4 §18-5-5 E3 — 기다리지 않는다).
    if (!options.port) void dropEarlier(key).catch(() => {});
    try {
      // 기억(memory)은 호스트를 만드는 창이 스스로 만든다 — 사라질 수 있는 틀의 객체를 위 창의 호스트가 들지 않게(N3).
      const memory = createMemory(options.params);
      const host = await createHost({
        ...options,
        key,
        port,
        memory,
        onClose,
        shellGone,
        claims,
        // 제품이 준 포트는 닫지 않는다 — 같은 포트를 다음 코치에 다시 주면 앞 호스트의 늦은 닫기가 새 호스트의 포트를 닫았다(넘친 #14,
        // 열기 실패 길과 같은 가름).
        ownsPort: !options.port,
        // 틀이 넘긴 올리기 · 셸 알림은 들지 않는다 — 셸이 같은 저장소를 받을 때 제 것을 건다(take). 옛 기록 읽개도 셸의 것만(take).
        ...(options.fromFrame === true ? { transport: null, onAccount: null } : {}),
      }).open();
      watch.host = host;
      if (watch.early) host.storeClosed();
      return host;
    } catch (error) {
      // 이 자리가 연 저장소 연결은 닫는다 — 열린 채 남으면 뒤의 앞 판 지우기 · 비우기 · 저장소 꼴 올리기를 막는다(카본 끝 판 C).
      if (!options.port)
        try {
          port?.close?.();
        } catch {
          // 닫기 실패는 열기 실패를 가리지 않는다
        }
      throw error;
    }
  })();
  registry.set(key, entry);
  entry.opening.catch(onClose);
  return entry;
}

// 셸이 같은 저장소를 받으면 그 호스트는 셸의 것이다 — 받을 때마다 올리기 · 계기를 그 셸의 것으로 걸고(D3) 문서 호스트로 세운다.
// 옛 기록 읽개는 여기서 걸지 않는다 — acquireHere가 저장소 자리에 적힌 읽개로 건다(한 길).
function shellTakes(registry, entry, host, options) {
  host.take({
    transport: options.transport,
    health: options.health,
    onAccount: options.onAccount,
  });
  entry.shell = true;
  entry.shellUsers += 1;
  registry.shellSeq = (registry.shellSeq ?? 0) + 1;
  entry.shellAt = registry.shellSeq;
  if (options.claim) options.claim.shell = true; // 놓을 때 이 표로 셸 수를 내린다(release)
  // 가장 나중에 받은 셸의 호스트가 문서 호스트다 — 옛 주인의 호스트를 틀이 아직 쥐고 있어도 새 틀은 새 주인의 것을 받는다(카본 · GPT 끝 판 C).
  // 저장소가 닫혀 등록부에서 내려간 자리는 문서 호스트가 되지 않는다 — 틀이 없는 열쇠를 받지 않게(계획 §23-3).
  if (registry.get(entry.key) === entry && registry.document !== entry.key)
    setDocument(registry, entry.key);
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
  // 읽개를 든 셸은 열기를 기다리기 전에(동기) 그 읽개를 저장소 자리에 적는다. 열기 대기는 등록 차례대로 풀려, 먼저 기다린 코치(읽개
  // 없는 셸 · 틀)가 뒤 셸의 take보다 먼저 깨어나 옮기기 약속이 서기 전에 준비를 끝냈다(r4 아르곤 A1) — 깨어난 코치가 누구든 적힌
  // 읽개로 약속을 먼저 건 뒤 기다린다. 틀이 넘긴 읽개는 적지 않는다(셸의 것만).
  if (options.fromFrame !== true && options.legacy && !entry.legacy) entry.legacy = options.legacy;
  let host = null;
  try {
    host = await entry.opening;
    if (options.map) host.index.add(options.map);
    if (entry.legacy) host.take({ legacy: entry.legacy });
    // 셸만 문서 호스트를 세운다 — 틀이 넘긴 것 · 옆으로 연 것 · 같은 창에서 문서 호스트를 받는 코치(document)는 셸이 아니다.
    if (options.fromFrame !== true && options.aside !== true && options.document !== true)
      shellTakes(registry, entry, host, options);
    // 옆으로 연 저장소가 이미 열려 있었는데 계기가 없으면 옆으로 연 코치의 계기를 건다 — 셸의 계기는 덮지 않는다(카본 끝 판 둘째 D).
    else if (options.fromFrame !== true && options.aside === true && options.health && !host.health)
      host.take({ health: options.health });
    // 옛 기록 옮기기의 약속 — 셸이든 틀이든 받는 코치는 모두 그 끝을 기다린다(계획 §16 ③ · D4 ㉡).
    await host.carried();
    return host;
  } catch (error) {
    if (host) host.release(options.claim);
    else openFailed(entry, options);
    throw error;
  }
}

// 받기 전에 열기가 실패했다 — 센 것을 되돌린다. 여는 중에 연결이 닫혀 기록부 준비가 실패했으면 셸이 판을 다시 정하도록 그 셸의 통로에 한 번
// 알린다(받은 호스트가 없어 storeClosed의 길을 타지 않는다, GPT 다시 검토 GA1). 틀 · 옆으로 연 코치 · 문서 호스트를 받는 코치는 셸이 아니다.
function openFailed(entry, options) {
  entry.claims.users -= 1;
  const shell = options.fromFrame !== true && options.aside !== true && options.document !== true;
  if (entry.storeClosed && shell) tellClosedOnce(entry, options.onAccount);
}

// 여는 중에 닫힌 자리의 알림 — 통로(onAccount 함수)마다 한 번.
function tellClosedOnce(entry, onAccount) {
  if (typeof onAccount !== 'function') return;
  entry.told ??= new WeakSet();
  if (entry.told.has(onAccount)) return;
  entry.told.add(onAccount);
  try {
    onAccount({ kind: 'store', code: 'STORE_CLOSED', status: null, revision: null });
  } catch {
    // 셸의 알림이 던져도 열기 실패는 그대로 알린다
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

export function releaseHost(host, claim = null) {
  return host.release(claim);
}
