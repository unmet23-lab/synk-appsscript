// 기기의 기록부(설계 §5-4). 저장 포트에서 한 번 읽어 메모리에 올리고(load), 그 뒤 사건은 메모리에서 바로 쓰고 저장은 뒤에서 한다.
//   ① 저장이 끝난 사건만 근거다 — add()의 stored가 true가 된 뒤에야 보기에 얹힌다(§5-2 「저장된 답만 근거다」).
//      저장이 실패하면 계기(health)에 알리고, 그 계열은 이 판의 메모리 만남 표에만 남긴다(같은 판에서 다시 재지 않게 — 근거는 아님).
//   ② 받은 표지(ack)와 요약을 한 기록으로 덧붙인다 — 요약에 든 사건(받은 차례 ≤ 요약의 「어디까지 접었나」)만 얹을 목록에서 빠지므로
//      빠지는 답도 두 번 얹히는 답도 없다. 같은 판 묶음이면 줄 갱신 차례가 크거나 같은 요약만 쓴다(두 탭이 각자 덧붙여도).
//   ③ 얹기는 단계 2의 overlay(own.mjs가 입력을 만든다). 그 밖에 요약 값만 쓰는 때 — 서버가 시각을 누른 사건이 아직 요약에 안 들었을 때,
//      판 묶음(두뇌 · 색인)이 다른 요약, 요약을 아직 한 번도 못 받았을 때.
//   ④ 손님(동의 꺼진 계정 포함)은 기기가 원천이다 — 사건을 다 들고 같은 어댑터 · 근거 줄로 요약을 스스로 접는다.
// 기록 꼴(포트의 값): { kind: 'event', event, touches? } · { kind: 'ack', acks: [[id, seq]], clamped, dropped, summary?, offsetMs? }
//                    · { kind: 'local', summary, until }(손님이 스스로 접은 요약 — until = 그 요약에 든 마지막 포트 열쇠)
import { overlay } from '../fold/device.mjs';
import { deviceKey, EMPTY_INDEX, groupsOf } from './adapt.mjs';
import { createClock } from './clock.mjs';
import { createEvent, EVENT_FORM, EVENT_TYPES, eventId } from './events.mjs';
import { familySkillsOf, ownFoldEvents, touchesOf, WAIT } from './own.mjs';
import { linesOfGroups } from './rows.mjs';
import { foldEdition, ISSUED_KEEP_MS } from './server.mjs';
import { applyDelta, emptySummary, packSummary, unpackSummary, viewOf } from './summary.mjs';

export const KEEP_MS = 2 * 86_400_000;
const GUEST_REFOLD = 64;

const randomTag = () =>
  Array.from(
    { length: 8 },
    () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)],
  ).join('');

const isCurrent = event => event.schema === EVENT_FORM.current;
const issuedRow = event => ({
  id: event.id,
  at: Date.parse(event.at),
  review: event.reason.tier === 1,
  units: [...event.reason.introduced],
});
const isIssued = event => event.type === EVENT_TYPES.presented && isCurrent(event);

function noteSave(health, ok, code) {
  if (health) health.note('save', ok ? { ok: true } : { ok: false, code });
}

// 같은 판 묶음이면 갱신 차례가 크거나 같은 요약만, 판 묶음이 바뀌면 새 요약.
const newer = (current, next) =>
  next && (!current || current.edition !== next.edition || next.lineSeq >= current.lineSeq);

function createState(guest, now) {
  return {
    guest,
    held: new Map(), // id → { event, touches, key(포트 열쇠), position }
    acks: new Map(), // id → 서버 차례
    clamped: new Set(),
    dropped: new Set(),
    failed: new Map(), // 저장 실패한 답의 계열 → 시각(이 판의 메모리에만)
    summary: null,
    local: null,
    lastKey: 0,
    positions: 0,
    seqInMs: 0,
    lastMs: -1,
    clock: createClock({ now }),
  };
}

function takeEvent(state, value, key) {
  if (state.held.has(value.event.id)) return;
  state.positions += 1;
  state.held.set(value.event.id, {
    event: value.event,
    touches: value.touches ?? null,
    key,
    position: state.positions,
  });
  state.clock.know(Date.parse(value.event.at));
}

function takeAck(state, value, now) {
  for (const [id, seq] of value.acks ?? []) state.acks.set(id, seq);
  for (const id of value.clamped ?? []) state.clamped.add(id);
  for (const id of value.dropped ?? []) state.dropped.add(id);
  if (Number.isFinite(value.offsetMs)) state.clock.sync(now() + value.offsetMs);
  const next = unpackSummary(value.summary);
  if (newer(state.summary, next)) state.summary = next;
  if (state.summary) state.clock.know(state.summary.latestAt);
}

function take(state, { key, value }, now) {
  state.lastKey = Math.max(state.lastKey, key);
  if (value.kind === 'event') takeEvent(state, value, key);
  else if (value.kind === 'ack') takeAck(state, value, now);
  else if (value.kind === 'local' && (!state.local || value.until >= state.local.until))
    state.local = { summary: unpackSummary(value.summary), until: value.until };
}

const entryOf = item => ({
  event: item.event,
  key: isCurrent(item.event) ? item.event.id : deviceKey(item.position, item.event),
  atMs: Date.parse(item.event.at),
});

function folded(state, id) {
  if (state.guest) return Boolean(state.local) && state.held.get(id)?.key <= state.local.until;
  const seq = state.acks.get(id);
  return seq !== undefined && state.summary != null && seq <= state.summary.foldedUntil;
}

const pendingIds = state =>
  new Set([...state.held.keys()].filter(id => !folded(state, id) && !state.dropped.has(id)));
const baseOf = state => (state.guest ? (state.local?.summary ?? null) : state.summary);

// 사건 번호의 순번 — 같은 밀리초 안에서 센다(번호는 만든 차례대로 커진다).
function nextId(state, atMs, tag) {
  state.seqInMs = atMs === state.lastMs ? state.seqInMs + 1 : 0;
  state.lastMs = atMs;
  return eventId(atMs, state.seqInMs, tag);
}

function remember(state, event) {
  if (event.type !== EVENT_TYPES.attempted && event.type !== EVENT_TYPES.helped) return;
  const presented = state.held.get(event.presentationId)?.event;
  if (presented && !state.failed.has(presented.familyKey))
    state.failed.set(presented.familyKey, Date.parse(event.at));
}

// 아직 요약에 안 든 내 사건 → overlay의 입력. 누른 사건이 아직 요약에 안 들었으면 요약 값만.
function ownOf(state, index) {
  const pending = pendingIds(state);
  if ([...pending].some(id => state.clamped.has(id))) return [WAIT];
  const entries = [...state.held.values()].map(entryOf);
  const keys = new Set(entries.filter(entry => pending.has(entry.event.id)).map(e => e.key));
  return ownFoldEvents(entries, keys, { index, memo: id => state.held.get(id)?.touches ?? null });
}

// 치울 사건 — 이틀 지났고 서버가 접었고, 얹을 사건의 부모도 답이 안 달린 제시도 아닌 것.
function staleIds(state, floor) {
  const pending = pendingIds(state);
  const parents = new Set();
  for (const id of pending) {
    const event = state.held.get(id).event;
    parents.add(event.presentationId ?? event.targetId);
  }
  const answered = new Set(
    [...state.held.values()]
      .filter(item => item.event.type === EVENT_TYPES.attempted)
      .map(item => item.event.presentationId),
  );
  const open = id => state.held.get(id).event.type === EVENT_TYPES.presented && !answered.has(id);
  return [...state.held.keys()].filter(
    id =>
      folded(state, id) &&
      Date.parse(state.held.get(id).event.at) < floor &&
      !parents.has(id) &&
      !open(id),
  );
}

export async function openRecord(options) {
  const record = createRecord(options);
  await record.load();
  return record;
}

export function createRecord({
  port,
  revision,
  guest = false,
  memory,
  params,
  index = EMPTY_INDEX,
  health = null,
  now = () => Date.now(),
  tag = randomTag(),
}) {
  const state = createState(guest, now);
  const edition = () => foldEdition(params, index);
  const accept = row => take(state, row, now);

  // 손님: 든 사건 전부로 요약을 스스로 접는다(서버와 같은 어댑터 · 근거 줄 · 접기).
  async function refoldGuest() {
    const items = [...state.held.values()];
    const until = items.reduce((max, item) => Math.max(max, item.key), 0);
    if (state.local && state.local.until >= until) return;
    const lines = linesOfGroups(groupsOf(items.map(entryOf)), { memory, params, index });
    const floor = now() - ISSUED_KEEP_MS;
    const issued = items
      .map(item => item.event)
      .filter(event => isIssued(event) && Date.parse(event.at) >= floor)
      .map(issuedRow);
    const next = { ...emptySummary(edition()), lines, issued, lineSeq: until, foldedUntil: until };
    const value = { kind: 'local', summary: packSummary(next), until };
    const [key] = await port.append([value]);
    accept({ key, value });
  }

  // 손님은 스스로 접는다 — 첫 만남을 넓게 바꾸는 사건(옮겨 온 장부 · 제외)이나 쌓인 사건이 많으면 바로 다시 접는다.
  const broad = type => type === EVENT_TYPES.carried || type === EVENT_TYPES.excluded;
  const refoldAfter = type =>
    guest && (broad(type) || pendingIds(state).size >= GUEST_REFOLD) ? refoldGuest() : null;

  function store(type, event, value) {
    return port.append([value]).then(
      async ([key]) => {
        accept({ key, value });
        noteSave(health, true);
        await refoldAfter(type);
        return true;
      },
      () => {
        remember(state, event);
        noteSave(health, false, 'STORAGE_ERROR');
        return false;
      },
    );
  }

  return {
    async load() {
      for (const row of await port.read()) accept(row);
      if (guest) await refoldGuest();
      return this;
    },
    // 다른 탭 · 게임 틀이 덧붙인 꼬리만 읽는다.
    async refresh() {
      for (const row of await port.range(state.lastKey)) accept(row);
    },
    get revision() {
      return revision;
    },
    get summary() {
      return baseOf(state);
    },
    edition,
    clock: state.clock,

    // 사건 하나를 만들어 저장한다. 돌려주는 stored는 저장이 끝난 뒤의 값(true면 근거, false면 근거가 아니다).
    add(type, fields) {
      const atMs = state.clock.next();
      const id = nextId(state, atMs, tag);
      const event = createEvent(type, fields, { id, atMs, revision: guest ? 0 : revision });
      const entries = [...state.held.values()].map(entryOf);
      const touches =
        type === EVENT_TYPES.excluded ? touchesOf(entries, event.targetId, index) : null;
      const value = { kind: 'event', event, ...(touches ? { touches } : {}) };
      return { event, stored: store(type, event, value) };
    },

    // 보낼 대기열 — 받은 표지가 없고 버리지 않은 내 2판 사건(만든 차례).
    unsent(limit = 256) {
      return [...state.held.values()]
        .filter(item => isCurrent(item.event))
        .filter(item => !state.acks.has(item.event.id) && !state.dropped.has(item.event.id))
        .sort((a, b) => a.key - b.key)
        .slice(0, limit)
        .map(item => item.event);
    },

    // 서버의 답 하나 — 받은 표지 · 누른 것 · 버린 것 · 요약을 한 기록으로 덧붙인다.
    async receive({
      accepted = [],
      clamped = [],
      rejected = [],
      summary = null,
      serverTime = null,
    }) {
      const next = summary ? applyDelta(state.summary, summary) : null;
      const value = {
        kind: 'ack',
        acks: accepted.map(row => [row.id, row.seq]),
        clamped: [...clamped],
        dropped: [...rejected],
        ...(next ? { summary: packSummary(next) } : {}),
        ...(Number.isFinite(serverTime) ? { offsetMs: serverTime - now() } : {}),
      };
      const [key] = await port.append([value]);
      accept({ key, value });
      if (rejected.length) noteSave(health, false, 'EVENT_REVISION');
      return baseOf(state);
    },

    // 서버가 접은 요약 위에 아직 요약에 안 든 내 사건을 얹은 보기(단계 2의 보기 꼴).
    view() {
      const base = baseOf(state);
      const own = base && base.edition === edition() ? ownOf(state, index) : [WAIT];
      const events = [...state.held.values()].map(item => item.event);
      const result = overlay(viewOf(base), own, memory, params, {
        familySkills: familySkillsOf(base, index, events),
        lookup: () => null,
      });
      for (const [family, at] of state.failed)
        if (!result.met.has(family)) result.met.set(family, at);
      return result;
    },

    // 고르기가 세는 「낸 것」 기록(설계 §5-4 한도 세기) — 요약의 최근 이틀 표 + 아직 요약에 안 든 내 2판 제시.
    issued() {
      const rows = new Map((baseOf(state)?.issued ?? []).map(row => [row.id, row]));
      for (const id of pendingIds(state)) {
        const event = state.held.get(id).event;
        if (isIssued(event)) rows.set(id, issuedRow(event));
      }
      const floor = now() + state.clock.offsetMs - ISSUED_KEEP_MS;
      return [...rows.values()]
        .filter(row => row.at >= floor)
        .map(({ at, review, units }) => ({ at, review, units }));
    },

    pending: () => pendingIds(state),
    has: id => state.held.has(id),
    heldEvent: id => state.held.get(id)?.event ?? null,
    heldEvents: () =>
      [...state.held.values()].sort((a, b) => a.key - b.key).map(item => item.event),
    acked: id => state.acks.get(id),

    // 오래되고 서버가 접은 사건 · 지난 표지 기록을 치운다. 답이 아직 안 달린 제시와 얹을 사건의 부모는 둔다.
    // 먼저 남길 표지 · 요약을 한 기록으로 덧붙이고 나서 앞 기록을 지운다(그 사이 끊겨도 겹친 표지는 해가 없다).
    async compact() {
      if (guest) return 0;
      const gone = new Set(staleIds(state, now() + state.clock.offsetMs - KEEP_MS));
      const kept = id => state.held.has(id) && !gone.has(id);
      const value = {
        kind: 'ack',
        acks: [...state.acks].filter(([id]) => kept(id)),
        clamped: [...state.clamped].filter(kept),
        dropped: [...state.dropped].filter(kept),
        ...(state.summary ? { summary: packSummary(state.summary) } : {}),
        offsetMs: state.clock.offsetMs,
      };
      const [keepKey] = await port.append([value]);
      accept({ key: keepKey, value });
      const isStale = row =>
        row.key < keepKey &&
        (row.value.kind === 'ack' || (row.value.kind === 'event' && gone.has(row.value.event.id)));
      await port.remove((await port.read()).filter(isStale).map(row => row.key));
      for (const id of gone) state.held.delete(id);
      return gone.size;
    },

    // 손님 로그를 계정으로 옮길 계획 — 옛 꼴은 옛 POST로 먼저(부모 먼저), 2판은 그 계정의 지금 판으로 도장을 찍어 새 길로.
    guestUpload(accountRevision) {
      const events = [...state.held.values()].sort((a, b) => a.key - b.key).map(i => i.event);
      return {
        legacy: events.filter(event => !isCurrent(event)),
        current: events.filter(isCurrent).map(event => ({ ...event, revision: accountRevision })),
      };
    },

    // 옛 저장소에서 옮겨 온 옛 꼴 사건을 덧붙인다(손님 — carry.mjs의 legacyToImport가 아직 안 옮긴 것만 고른다).
    async importLegacy(events) {
      if (!events.length) return [];
      const values = events.map(event => ({ kind: 'event', event }));
      const keys = await port.append(values);
      keys.forEach((key, i) => accept({ key, value: values[i] }));
      if (guest) await refoldGuest();
      return keys;
    },
  };
}
