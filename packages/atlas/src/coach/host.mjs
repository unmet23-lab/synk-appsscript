// 호스트 — 저장소 하나(계정 · 동의 판마다, storeName)에 기록부 하나(단계 4 계획 §3-2, 설계 §5-4 「쓰는 것은 호스트다」).
//   등록부는 같은 출처의 가장 위 창에 둔다. 같은 문서의 코치들과 그 문서가 연 같은 출처 틀(게임)의 코치들이 이 기록부를 나눠 쓴다 —
//   틀이 닫혀도 마지막 쓰기가 위 창에서 끝난다. 위 창에 등록부가 없는(혼자 뜬) 페이지는 자기 창에 둔다.
//   다른 탭은 같은 IndexedDB 저장소에 덧붙이고 BroadcastChannel로 알린다 — 받은 탭은 꼬리만 다시 읽는다(record.refresh()).
//   올리기는 계정만: 대기열(unsent) → 제품이 준 transport → 서버의 답(receive). 같은 사건을 두 탭이 올려도 서버가 번호로 거른다.
// 코치가 쓰는 보기 = 기록부 보기(record.view() — 저장이 끝난 사건) + 아직 저장이 안 끝난 내 답 · 본인 말(pending).
import { applyOwn } from '../fold/device.mjs';
import { byTime } from '../fold/order.mjs';
import { openTrail } from './record.mjs';

const REGISTRY = '__synkAtlasHosts';
const UPLOAD_DELAY_MS = 1500;
const UPLOAD_LIMIT = 256;

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

function registryOf(scope) {
  const top = hostScope(scope);
  try {
    if (!top[REGISTRY]) top[REGISTRY] = new Map();
    return top[REGISTRY];
  } catch {
    if (!scope[REGISTRY]) scope[REGISTRY] = new Map();
    return scope[REGISTRY];
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

function createHost({ key, port, revision, guest, memory, params, health, transport, now, map }) {
  const index = compositeIndex();
  // 지도를 기록부를 열기 전에 넣는다 — 기록부가 처음 접는 요약의 판 묶음(색인 판)이 그 뒤의 보기와 같아야 한다.
  if (map) index.add(map);
  const pending = new Map(); // 사건 번호 → 접기 사건(아직 저장이 안 끝난 내 답 · 본인 말)
  const issuing = new Map(); // 사건 번호 → 「낸 것」 줄(아직 저장이 안 끝난 내 제시)
  const listeners = new Set();
  const state = {
    trail: null,
    channel: null,
    users: 0,
    timer: null,
    uploading: null,
    closed: false,
  };
  const tell = (kind, detail = {}) => {
    for (const listener of listeners) listener({ kind, ...detail });
  };

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
    const events = state.trail.unsent(UPLOAD_LIMIT);
    if (!events.length) return null;
    state.uploading = (async () => {
      try {
        const answer = await transport(events);
        await state.trail.receive(answer);
        tell('receive');
      } catch {
        tell('offline');
      } finally {
        state.uploading = null;
      }
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
      } else tell('failed', { id });
      return ok;
    });
    return { event: made.event, stored };
  }

  return {
    key,
    guest,
    index,
    memory,
    params,
    health,
    async open() {
      state.trail = await openTrail({ port, revision, guest, memory, params, index, health, now });
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
    issued() {
      return [...state.trail.issued(), ...issuing.values()];
    },
    pendingCount: () => pending.size + issuing.size,
    retain() {
      state.users += 1;
    },
    async release() {
      state.users -= 1;
      if (state.users > 0) return false;
      state.closed = true;
      clearTimeout(state.timer);
      if (globalThis.removeEventListener) globalThis.removeEventListener('online', schedule);
      state.channel?.close();
      return true;
    },
  };
}

// 저장소 이름마다 호스트 하나. 처음 부른 코치가 열고, 뒤의 코치는 같은 것을 받는다.
export async function acquireHost(options, scope = globalThis) {
  const registry = registryOf(scope);
  let entry = registry.get(options.key);
  if (!entry) {
    const host = createHost(options);
    entry = { host, opening: host.open() };
    registry.set(options.key, entry);
    entry.opening.catch(() => registry.delete(options.key));
  }
  await entry.opening;
  if (options.map) entry.host.index.add(options.map);
  entry.host.retain();
  return entry.host;
}

export async function releaseHost(host, scope = globalThis) {
  if (await host.release()) registryOf(scope).delete(host.key);
}
