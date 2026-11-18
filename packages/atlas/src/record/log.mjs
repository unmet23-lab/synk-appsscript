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
//                    · { kind: 'mark', mark, account?, revision?, until?, ids?, at }(손님 저장소의 경계 표지 — 단계 4 §18-5-3: 옮김 ·
//                      두기 · 로그아웃 · 있었음. 옮김 표지의 ids는 그때 실제로 옮긴 2판 번호(함께 간 2판 제외 포함) + 옛 POST로 실제로 보낸
//                      옛 꼴 번호 — move.mjs)
//                    · { kind: 'cleared', gen, at, legacy, carried }(비움 표지 — 단계 4 계획 §22-4. 손님 비우기와 계정 비우기의 넷째 걸음이
//                      저장소 안을 지울 때 같은 트랜잭션으로 쓴다. gen은 지우기 세대, legacy는 옛 로그의 바닥 { epoch, at }, carried는 옮긴 장부
//                      칸 { families, items, last }) · { kind: 'gen', gen }(열쇠 0의 머리 기록 — 포트가 막이에 읽는다, port.mjs)
//   치우기의 합친 표지는 swept: { at }를 싣는다 — 다른 탭은 꼬리에서 그것을 만나면 포트를 통째로 다시 읽는다(단계 4 §18-5-5 A6).
//   쓰기는 모두 포트의 막이 트랜잭션(swap)으로 한다 — 이 기록부가 읽은 지우기 세대가 저장소의 지금 세대가 아니면(다른 탭이 비웠으면) 쓰지 않고
//   통째로 다시 읽은 뒤 onCleared로 한 번 알린다(단계 4 계획 §22-4 「늦게 쓰는 탭의 막이」 · 「다른 탭의 은퇴 알림」). 꼬리에서 새 세대의
//   비움 표지를 만나도 같다.
//   파생 기록(손님 요약 · 치우기 · 옮기기)을 쓰는 일은 호스트의 차례(src/coach/turn.mjs) 안에서 한다 — 기록부가 스스로 차례를
//   청하는 곳은 차례 밖에서 시작된 손님 요약 저장 하나뿐이고(exclusive), 호스트가 「차례 안」으로 둔 동안에는 다시 청하지 않는다
//   (Web Locks는 다시 들어갈 수 없다 — 단계 4 §18-5-1 R1 · s8).
import { overlay } from '../fold/device.mjs';
import { deviceKey, EMPTY_INDEX, groupsOf } from './adapt.mjs';
import { carriedList } from './carry.mjs';
import { createClock } from './clock.mjs';
import { createEvent, EVENT_FORM, EVENT_TYPES, eventId, isId, parentOf } from './events.mjs';
import { familySkillsOf, ownFoldEvents, touchesOf, WAIT } from './own.mjs';
import { genOf } from './port.mjs';
import { linesOfGroups, rowsOfGroup } from './rows.mjs';
import { foldEdition, ISSUED_KEEP_MS } from './server.mjs';
import {
  applyDelta,
  emptySummary,
  headOrder,
  packSummary,
  unpackSummary,
  viewOf,
} from './summary.mjs';

export const KEEP_MS = 2 * 86_400_000;
// 치우기는 하루 한 번(어느 탭이든 — 합친 표지의 swept.at으로 잰다, 단계 4 §18-3 · A6).
export const SWEEP_EVERY_MS = 86_400_000;
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

// 머리가 다르면(gen) 새 머리의 요약 — 차례를 견주지 않는다(단계 4 §18-5-4 D1 · D2, summary.mjs headOrder). 같은 머리 · 같은 판 묶음이면
// 갱신 차례가 큰 요약, 차례가 같으면 접은 자리가 같거나 앞선 요약만 — 늦게 붙은 옛 요약(같은 차례 · 덜 접힘)이 새 요약을 덮어
// 접은 자리 · 「낸 것」이 뒤로 가지 않게(GPT 끝 판 GC2). 판 묶음이 바뀌면 새 요약.
function newer(current, next) {
  if (!next) return false;
  if (!current) return true;
  const order = headOrder(next, current);
  if (order !== 0) return order > 0;
  return (
    current.edition !== next.edition ||
    next.lineSeq > current.lineSeq ||
    (next.lineSeq === current.lineSeq && next.foldedUntil >= current.foldedUntil)
  );
}

function createState(guest, now) {
  return {
    guest,
    held: new Map(), // id → { event, touches, key(포트 열쇠), position }
    acks: new Map(), // id → 서버 차례
    clamped: new Set(),
    dropped: new Set(),
    failed: new Map(), // 저장 실패한 답의 계열 → 시각(이 판의 메모리에만)
    families: new Map(), // 이 기록부가 만든 제시 번호 → 계열(제시 저장이 실패 · 진행 중이어도 계열을 안다)
    summary: null,
    summaryKey: 0, // 지금 요약을 담은 기록의 열쇠
    summaryRows: new Set(), // 요약만 담은 기록(kind 'summary') — 새 요약이 서면 앞 것은 지운다(Fable 끝 판 P1)
    local: null,
    localRows: new Set(), // 손님의 로컬 요약 기록 — 새 것이 서면 앞 것은 지운다
    lastKey: 0,
    readKey: 0, // 포트에서 읽은 데까지(내 덧붙이기로는 오르지 않는다 — 다른 탭이 먼저 쓴 기록을 건너뛰지 않게, Fable 끝 판 P2)
    unsaved: new Set(), // 이 기록부에서 저장에 실패한(또는 부모가 없어 쓰지 않은) 사건 번호
    inflight: new Map(), // 저장 중인 사건 번호 → 그 저장 약속(자식은 부모의 저장이 끝난 뒤 결과를 보고 쓴다)
    lastAttempt: new Map(), // 제시 번호 → 이 기록부가 만든 그 제시의 마지막 답 번호(뒤 답은 앞 답에 기대어 쓴다 — §18-4)
    turnDepth: 0, // 호스트가 쥔 차례 안(§18-5-1 R1) — 0보다 크면 기록부가 차례를 다시 청하지 않는다
    saving: null, // 손님 요약 저장(하나씩 — 저장하는 사이 새로 접힌 요약은 dirty로 한 번 더)
    dirty: false,
    resync: false, // 꼬리에서 다른 탭의 치운 표시를 만났다 — 포트를 통째로 다시 읽는다(A6)
    ownSweeps: new Set(), // 이 기록부가 쓴 치운 표시 기록의 열쇠
    sweptAt: 0, // 가장 늦은 치우기의 시각(서버 시각을 고친 기기 시각 — 포트에서 읽은 값)
    serverTimed: false, // 이 세션에 서버의 답에서 서버 시각을 받았다 — 치우기는 그 뒤에만(A6)
    marks: [], // 손님 저장소의 경계 표지(포트 열쇠 자리 — §18-5-3)
    // 지우기 세대(단계 4 계획 §22-4) — 이 기록부가 읽은 저장소의 세대(머리 기록 · 비움 표지에서). 쓰기는 이 세대를 막이로 건다. 줄지 않는다.
    gen: 0,
    noticed: 0, // 셸에 알린(onCleared) 가장 큰 세대 — 처음 읽은 세대와 이 기록부가 스스로 비운 세대는 알리지 않는다
    cleared: null, // 가장 늦은 비움 표지 { gen, at, legacy, carried }
    clearedKey: 0,
    positions: 0,
    seqInMs: 0,
    lastMs: -1,
    clock: createClock({ now }),
  };
}

// 포트에서 읽어 세운 값만 비운다(치운 뒤 다시 읽기 — A6). 이 기록부가 만든 쓰기의 상태(저장 실패 · 저장 중 · 앞 답 · 계열 · 번호)와
// 시계 · 차례 · 서버 시각을 받았는지는 그대로 둔다.
function resetRead(state) {
  state.held = new Map();
  state.acks = new Map();
  state.clamped = new Set();
  state.dropped = new Set();
  state.summary = null;
  state.summaryKey = 0;
  state.summaryRows = new Set();
  state.local = null;
  state.localRows = new Set();
  state.lastKey = 0;
  state.readKey = 0;
  state.positions = 0;
  state.sweptAt = 0;
  state.marks = [];
  state.cleared = null; // 세대(gen)는 줄지 않아 그대로 둔다
  state.clearedKey = 0;
}

function takeEvent(state, value, key) {
  const held = state.held.get(value.event.id);
  if (held) {
    // 같은 번호가 두 열쇠에 섰다(차례 없이 겹쳐 옮긴 옛 기록 — R10에서 받아들인 것). 더 작은 열쇠(포트 차례)로 맞춰 어느 탭 · 새로 연
    // 기록부가 읽어도 같은 열쇠로 든다 — 표지가 두 열쇠 사이에 서면 탭마다 옮길 옛 꼴이 갈렸다(Fable 5.2 끝 판 넘친 #11). 자리는 그대로.
    if (key < held.key) held.key = key;
    return;
  }
  state.positions += 1;
  state.held.set(value.event.id, {
    event: value.event,
    touches: value.touches ?? null,
    key,
    position: state.positions,
  });
  state.clock.know(Date.parse(value.event.at));
}

function takeAck(state, value, key, now) {
  for (const [id, seq] of value.acks ?? []) state.acks.set(id, seq);
  for (const id of value.clamped ?? []) state.clamped.add(id);
  for (const id of value.dropped ?? []) state.dropped.add(id);
  if (Number.isFinite(value.offsetMs)) state.clock.sync(now() + value.offsetMs);
  const next = unpackSummary(value.summary);
  // 옛 꼴(11-11 앞 — 요약을 받은 표지에 함께 실었다)의 요약도 받는다. 그 기록 열쇠를 적어 두어 치우기가 그 ack를 지우기 전에
  // 요약을 따로 한 기록으로 옮겨 적는다(GPT 끝 판 GE3).
  if (newer(state.summary, next)) {
    state.summary = next;
    state.summaryKey = key;
  }
  if (state.summary) state.clock.know(state.summary.latestAt);
  if (value.swept) {
    state.sweptAt = Math.max(state.sweptAt, value.swept.at ?? 0);
    if (!state.ownSweeps.has(key)) state.resync = true;
  }
}

function takeSummary(state, value, key) {
  state.summaryRows.add(key);
  const next = unpackSummary(value.summary);
  if (newer(state.summary, next)) {
    state.summary = next;
    state.summaryKey = key;
  }
  if (state.summary) state.clock.know(state.summary.latestAt);
}

// 손님 요약 기록 — 판 묶음이 다른 것(다른 판 엔진의 탭이 쓴 것)은 받지도 지우지도 않는다. 보기의 바탕은 늘 내 판 묶음으로 접은
// 요약이다(§18-5-1 R3 — 없으면 refoldGuest가 그 자리에서 메모리로 접는다).
function takeLocal(state, value, key, edition) {
  const summary = unpackSummary(value.summary);
  if (summary?.edition !== edition) return;
  state.localRows.add(key);
  if (!state.local || value.until >= state.local.until)
    state.local = { summary, until: value.until, key };
}

// 옛 로그의 바닥 { epoch, at }(단계 4 계획 §22-4) — epoch을 모르면 null로 둔다. 꼴이 틀리면 바닥이 없는 것이다.
const floorOf = value =>
  value && typeof value === 'object' && Number.isFinite(value.at)
    ? { epoch: value.epoch ?? null, at: value.at }
    : null;
const carriedOfValue = value =>
  value && typeof value === 'object' && Array.isArray(value.families) && Array.isArray(value.items)
    ? { families: [...value.families], items: [...value.items], last: value.last ?? null }
    : null;

// 비움 표지(단계 4 계획 §22-4). 세대가 지금 읽은 세대보다 크면 다른 탭이 비운 것이다 — 메모리 사본을 버리고 포트를 통째로 다시 읽는다(치운
// 표시와 같은 resync — 처음부터 통째로 읽는 load · reload는 읽은 뒤 이 표시를 내린다). 같은 세대의 뒤 표지는 바닥 · 옮긴 장부 칸을 고친
// 것이다(liftFloor) — 은퇴시키지 않고 표지만 새로 든다.
function takeCleared(state, value, key) {
  const gen = genOf(value);
  if (gen > state.gen) state.resync = true;
  state.gen = Math.max(state.gen, gen);
  if (
    state.cleared &&
    (gen < state.cleared.gen || (gen === state.cleared.gen && key < state.clearedKey))
  )
    return;
  state.cleared = {
    gen,
    at: Number.isFinite(value.at) ? value.at : null,
    legacy: floorOf(value.legacy),
    carried: carriedOfValue(value.carried),
  };
  state.clearedKey = key;
}

function take(state, { key, value }, now, edition) {
  state.lastKey = Math.max(state.lastKey, key);
  if (value.kind === 'event') takeEvent(state, value, key);
  else if (value.kind === 'ack') takeAck(state, value, key, now);
  else if (value.kind === 'summary') takeSummary(state, value, key);
  else if (value.kind === 'local') takeLocal(state, value, key, edition);
  else if (value.kind === 'gen') state.gen = Math.max(state.gen, genOf(value));
  else if (value.kind === 'cleared') takeCleared(state, value, key);
  // 표지는 열쇠로 한 번만 — 내가 쓴 표지는 꼬리를 읽을 때 다시 온다(내 덧붙이기는 읽은 자리를 올리지 않는다).
  else if (value.kind === 'mark' && !state.marks.some(mark => mark.key === key))
    state.marks.push({ ...value, key });
}

const entryOf = item => ({
  event: item.event,
  key: isCurrent(item.event) ? item.event.id : deviceKey(item.position, item.event),
  atMs: Date.parse(item.event.at),
});

// 묶음 하나의 만남 · 장부 줄을 계열마다 모으고, 그 묶음의 머리가 2판 제시이면 만남(답)마다 그 판 번호를 적는다(기록부 meetRows — 예상 급수의
// 근거, 단계 4 계획 §21-23의 2). 옛 꼴 제시 · 장부 · 본인 말 묶음에는 판 번호가 없다. 그래서 제시 종류와 2판 여부(isCurrent) 검사는 지금 길에서
// 닿지 않는 막이다 — 옛 꼴 제시는 판 번호 칸을 싣지 않는다. 시험이 없으니, 옛 꼴 제시가 판 번호를 싣게 되면 시험과 변형을 함께 더한다(Fable 끝 판 F3).
const setOfSource = event =>
  event.type === EVENT_TYPES.presented && isCurrent(event) && typeof event.setId === 'string'
    ? event.setId
    : null;
function addMeetRows(group, index, families, sets) {
  const setId = setOfSource(group.source.event);
  for (const row of rowsOfGroup(group, index)) {
    if (row.kind !== 'meet' && row.kind !== 'carry') continue;
    if (!families.has(row.family)) families.set(row.family, []);
    families.get(row.family).push(row);
    if (row.kind === 'meet' && setId) sets.set(row.key, setId);
  }
}

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
  const family =
    state.held.get(event.presentationId)?.event.familyKey ??
    state.families.get(event.presentationId);
  if (family && !state.failed.has(family)) state.failed.set(family, Date.parse(event.at));
}

// 아직 요약에 안 든 내 사건 → overlay의 입력. 누른 사건이 아직 요약에 안 들었으면 요약 값만.
function ownOf(state, index) {
  const pending = pendingIds(state);
  if ([...pending].some(id => state.clamped.has(id))) return [WAIT];
  const entries = [...state.held.values()].map(entryOf);
  const keys = new Set(entries.filter(entry => pending.has(entry.event.id)).map(e => e.key));
  return ownFoldEvents(entries, keys, { index, memo: id => state.held.get(id)?.touches ?? null });
}

// 서버의 답에 실린 요약 — 얹을 수 없는 부분 답(null) · 늦은 옛 답 · 옛 머리의 답(지금 요약 그대로)이면 null(요약 기록을 새로 쓰지
// 않는다 — GPT 끝 판 GD1 · GD2, 단계 4 §18-5-4).
function nextSummary(state, summary) {
  const delta = summary ? applyDelta(state.summary, summary) : null;
  return delta && delta !== state.summary ? delta : null;
}

// 서버의 답 하나를 기록 꼴로 — 받은 표지와 요약은 한 번의 덧붙이기로(설계 §5-4). 요약은 따로 한 기록이라 다음 요약이 서면 지운다.
function answerValues({ accepted, clamped, rejected, serverTime, next }, now) {
  return [
    {
      kind: 'ack',
      acks: accepted.map(row => [row.id, row.seq]),
      clamped: [...clamped],
      dropped: [...rejected],
      ...(Number.isFinite(serverTime) ? { offsetMs: serverTime - now() } : {}),
    },
    ...(next ? [{ kind: 'summary', summary: packSummary(next) }] : []),
  ];
}

// 치울 사건 — 이틀 지났고 서버가 접었고, 남길 묶음에 들지 않은 것. 기기는 묶음 통째로 다시 지어 얹으므로(어댑터) 남길 것은 묶음
// 단위다: 답이 안 달린 제시의 묶음, 아직 안 접힌 사건이 하나라도 든 묶음은 전부 남긴다(아르곤 끝 판 D1). 묶음 밖 사건(머리가
// 기기에 없는 자식 · 제외)은 얹을 사건의 부모만 남긴다.
function keptIds(state, pending) {
  const keep = new Set();
  for (const group of groupsOf([...state.held.values()].map(entryOf)).values()) {
    const members = [group.source, ...group.children, ...group.exclusions].map(e => e.event.id);
    // 서버가 버린 제시에는 답이 달려도 서버가 받지 않는다 — 답을 기다리며 남기지 않는다(Fable 5.2 끝 판 넘친 #12).
    const open =
      group.source.event.type === EVENT_TYPES.presented &&
      !state.dropped.has(group.source.event.id) &&
      !group.children.some(child => child.event.type === EVENT_TYPES.attempted);
    if (open || members.some(id => pending.has(id))) for (const id of members) keep.add(id);
  }
  for (const id of pending) {
    const event = state.held.get(id).event;
    keep.add(event.presentationId ?? event.targetId);
  }
  return keep;
}

// 서버가 번호를 짚어 버린 사건(dropped)은 받은 표지가 없어 접힌 적이 없다 — 접힌 것과 같이 친다. 아니면 영영 남아 보기 · 대기열 ·
// 묶음 짓기에 계속 실렸다(Fable 5.2 끝 판 넘친 #12).
function staleIds(state, floor) {
  const keep = keptIds(state, pendingIds(state));
  return [...state.held.keys()].filter(
    id =>
      (folded(state, id) || state.dropped.has(id)) &&
      Date.parse(state.held.get(id).event.at) < floor &&
      !keep.has(id),
  );
}

// ── 손님 → 계정 옮기기의 경계(단계 4 계획 §18-5-3 — R5 · R6 · R11) ──
// 표지 꼴: moved(account · revision · until) · kept(account · until) · logout · visited(account).
// 열쇠 경계(Z) — Z 자신의 옮김 · 두기 표지는 until(고른 스냅숏의 읽은 자리 — 고른 뒤 표지 사이에 낀 손님 사건이 다음에 Z에게 물리게),
// 남의 표지 · 로그아웃 표지는 표지 열쇠 그대로(그 틈의 사건이 누구 것인지 모른다). Z 자신의 「있었음」은 빼고 가장 큰 것.
const MARKS = new Set(['moved', 'kept', 'logout', 'visited']);
function edgeOf(mark, account) {
  if (mark.mark === 'logout' || mark.account !== account) return mark.key;
  if (mark.mark === 'visited') return 0;
  return Number.isFinite(mark.until) ? mark.until : mark.key;
}
export const keyEdge = (marks, account) =>
  marks.reduce((edge, mark) => Math.max(edge, edgeOf(mark, account)), 0);

// Z가 이 판(revision)으로 실제로 옮겨 간 번호 — 옮김 표지의 ids(실제로 옮긴 2판 번호(함께 간 2판 제외 포함) + 옛 POST로 실제로 보낸 옛 꼴
// 번호). 경계 뒤에 덧붙은 자식 · 제외가 그 안의 사건을 겨누면 함께
// 옮긴다(R11 — 옮긴 뒤 다른 탭이 이어 낸 답, 그 뒤의 제외). 숫자 상한(until)으로 재면 그 자리 안이지만 옮기지 않은 사건(로그아웃 ·
// 남의 표지 앞 · 두기 · 옛 판)을 겨눈 제외까지 Z에게 갔고, 옮긴 부모 뒤에 달린 답은 아예 가지 않았다(GPT 끝 판 GE1 · 카본 E1).
// 판이 오르면(비움) 앞 판에 옮긴 것은 서버에 없으니 세지 않는다. ids 없는 옛 표지(리허설 저장소)는 아무것도 따라가지 않는다.
const movedIds = (marks, account, revision) =>
  new Set(
    marks
      .filter(
        mark => mark.mark === 'moved' && mark.account === account && mark.revision === revision,
      )
      .flatMap(mark => (Array.isArray(mark.ids) ? mark.ids : [])),
  );

// 묶음의 머리 — 제시 · 본인 말 · 판 결정 · 장부. 자식(전달 · 도움 · 답 · 마침 · 응답 · 제외)은 부모를 따라간다.
const isHead = event => parentOf(event) == null;

// 그 계정의 옮김 표지 모두(판과 상관없이)의 번호 — 넷째 걸음이 비우는 트랜잭션에서 읽은 줄로 센다(4-5 코드 검수 GPT GB1).
const movedIn = (rows, account) =>
  new Set(
    rows.flatMap(({ value }) =>
      value.kind === 'mark' &&
      value.mark === 'moved' &&
      value.account === account &&
      Array.isArray(value.ids)
        ? value.ids
        : [],
    ),
  );

// 읽은 줄의 마지막 비움 표지(takeCleared와 같은 차례 — 세대가 크고, 같은 세대면 뒤 열쇠)의 바닥과 옮긴 장부 칸. 없으면 null.
function lastClearedIn(rows) {
  let last = null;
  for (const { key, value } of rows) {
    if (value.kind !== 'cleared') continue;
    const gen = genOf(value);
    if (last && (gen < last.gen || (gen === last.gen && key < last.key))) continue;
    last = { gen, key, legacy: floorOf(value.legacy), carried: carriedOfValue(value.carried) };
  }
  return last;
}

// 계정 비우기의 넷째 걸음이 지울 기록(단계 4 계획 §22-4) — 포트를 통째로 읽은 줄(rows)에서 옮김 표지의 번호(gone)와 그것에 기댄 사건(부모 사슬
// — 부모는 늘 앞 열쇠라 한 번 훑기로 다 걸린다), 손님 요약 사본. 같은 번호가 두 열쇠에 선 옛 기록(R10)도 빠짐없이 걸린다. { drop: 열쇠들,
// events: 지울 사건들 }.
function movedRows(rows, gone) {
  const drop = [];
  const events = [];
  for (const { key, value } of rows) {
    if (value.kind === 'local') drop.push(key);
    if (value.kind !== 'event') continue;
    if (!gone.has(value.event.id) && !gone.has(parentOf(value.event))) continue;
    gone.add(value.event.id);
    drop.push(key);
    events.push(value.event);
  }
  return { drop, events };
}

// 제시의 자식 — 전달 · 도움 · 답. 같은 제시의 자식은 차례가 뜻을 가진다: 뒤 답은 앞 답에 기대고(§18-4 시도 번호), 답의 판정은 그 앞의
// 도움 · 전달에 기댄다(adapt.mjs — 첫 답 앞의 도움이 있어야 도움 받은 답, 소리 상태는 전달에서). 그래서 열쇠 차례의 앞머리로만 옮기고
// 보낸다(설계 주인 11-13 — 카본 다시 A1 ② · GPT 다시 GA1 · GA3 · GA4).
const PRESENTATION_CHILDREN = new Set([
  EVENT_TYPES.delivery,
  EVENT_TYPES.helped,
  EVENT_TYPES.attempted,
]);
const ofPresentation = event => PRESENTATION_CHILDREN.has(event.type);

// 2판 사건 고르기 — 머리가 열쇠 경계 뒤이고 그 시각이 남이 다녀간 기준 시각(others) 뒤인 묶음. 장부는 기준 시각(all — 자기 결정 포함)이
// 0일 때만(장부에는 든 일이 언제 것인지 가릴 재료가 없다 — 결정 2의 보수 쪽). 자식 · 제외는 이번에 고른 부모를 따라가고, 열쇠 경계
// 뒤에 덧붙은 것은 부모를 Z가 이 판으로 이미 옮겨 갔으면(moved — 옮김 표지의 ids) 머리와 같이 남이 다녀간 기준 시각 뒤일 때만 따라간다
// (Z가 옮긴 뒤 남 · 기기 길 계정이 탭에 남은 제시에 낸 답이 Z로 가지 않게 — 카본 다시 A1 ①). 막힌 제시(stalled — 이번에 고르지 않았고
// 앞서 옮기지도 않은 전달 · 도움 · 답이 있는 제시)는 거기서 멈추고 그 뒤 전달 · 도움 · 답은 고르지 않는다 — 1번 답 없이 2번만 가면 서버가
// 차례(EVENT_LINK)로 영구히 버리고, 경계 앞에 남은 도움 없이 그 뒤 답만 가면 계정에서 답을 보고 낸 답이 혼자 맞힌 답이 된다(근거를
// 부풀린다 — GD1과 같은 까닭). 제외는 겨눈 것(이번에 고른 것 · ids에 든 것)만 따라가고 막힘을 걸지 않는다.
function takes(item, picked, { edge, moved, others, all }, stalled) {
  const { event } = item;
  if (isHead(event))
    return (
      item.key > edge &&
      Date.parse(event.at) > others &&
      (event.type !== EVENT_TYPES.carried || all === 0)
    );
  if (ofPresentation(event) && stalled.has(event.presentationId)) return false;
  const parent = parentOf(event);
  return (
    picked.has(parent) || (item.key > edge && Date.parse(event.at) > others && moved.has(parent))
  );
}
// 대기열에서 건너뛸 사건인가(unsent) — 건너뛸 번호 자신 · 그것에 기댄 자식(부모 사슬), 자식 하나가 건너뛰어진 제시의 뒤 전달 · 도움 ·
// 답(고르기와 같은 앞머리 규칙 — 건너뛴 도움이 못 올라가는 동안 답만 올라가면 서버 요약에 혼자 맞힌 답으로 굳는다). 건너뛰면 그 번호를
// 막힌 것에 더한다(자손이 따라 걸린다). 덜 보내는 쪽이고 버리지 않는다.
function skipped(event, blocked, stalled) {
  const child = ofPresentation(event);
  const leans =
    blocked.has(event.id) ||
    blocked.has(parentOf(event)) ||
    (child && stalled.has(event.presentationId));
  if (!leans) return false;
  blocked.add(event.id);
  if (child) stalled.add(event.presentationId);
  return true;
}

function pickCurrent(items, rule) {
  const picked = new Set();
  const stalled = new Set();
  return items.filter(item => {
    const { event } = item;
    if (!takes(item, picked, rule, stalled)) {
      // 고르지 않은 제시의 자식이 앞서 옮겨 간 것도 아니면 그 제시는 거기서 멈춘다 — 뒤 자식은 앞 자식에 기댄다.
      if (ofPresentation(event) && !rule.moved.has(event.id)) stalled.add(event.presentationId);
      return false;
    }
    picked.add(event.id);
    return true;
  });
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
  // 차례 밖에서 시작된 손님 요약 저장이 청하는 차례(호스트의 turn — (job, work) => 약속). 없으면 그대로 쓴다.
  exclusive = (_job, work) => work(),
  // 손님 요약 저장 묶음이 끝났다 — 호스트가 다른 탭에 알린다(받기 알림 설계 검토 D2 · 설계 주인 11-16 저녁). 호스트는 손님 · 동의를 끈 기록부에만 준다.
  onLocalSaved = null,
  // 다른 탭이 이 저장소를 비웠다(gen — 단계 4 계획 §22-4 다른 탭의 은퇴 알림). 세대마다 한 번 — 호스트가 셸에 알린다.
  onCleared = null,
}) {
  const state = createState(guest, now);
  const edition = () => foldEdition(params, index);
  const accept = row => take(state, row, now, edition());

  // 막이 쓰기(단계 4 계획 §22-4 「늦게 쓰는 탭의 막이」) — 이 기록부가 읽은 세대를 포트에 넘겨(append의 expect) 같은 트랜잭션에서 대조하며
  // 덧붙인다. 다른 탭이 비웠으면(CLEARED) 쓰지 않고 통째로 다시 읽어 셸에 알린 뒤 그 거절을 그대로 던진다 — 부르는 쪽은 저장 실패로 받는다.
  // 막이를 모르는 포트(제품이 준 옛 꼴)는 둘째 인자를 버리고 막이 없이 덧붙인다. gen은 그 기록을 지은 때의 세대다 — 사건과 손님 요약은 만든(접은)
  // 때의 세대를 넘긴다. 부모의 저장 · 차례를 기다리는 사이 이 탭이 새 세대를 읽었어도 지워진 세상의 기록을 새 세대에 쓰지 않게(4-5 코드 검수
  // GPT GB2).
  async function put(values, gen = state.gen) {
    try {
      return await port.append(values, { expect: gen });
    } catch (error) {
      if (error?.code === 'CLEARED') await caughtUp();
      throw error;
    }
  }
  const stamp = () => Math.round(now() + state.clock.offsetMs);
  // 비우기의 걸음(clear · dropMoved) — 꼬리부터 읽고 한다. 다른 탭이 먼저 비웠으면(막이) 다시 읽고 두 번까지 더 한다.
  async function fencedTurn(work) {
    for (let attempt = 0; ; attempt += 1) {
      await refresh();
      try {
        return await work();
      } catch (error) {
        if (error?.code !== 'CLEARED' || attempt >= 2) throw error;
        await caughtUp();
      }
    }
  }
  // 스스로 비운 뒤 — 그 세대는 알리지 않고, 다시 읽어 메모리 사본을 맞추고, 손님 요약을 그 자리에서 접는다. 비우기는 이미 커밋됐다 — 다시 읽기가
  // 실패해도 비우기를 실패로 돌리지 않고(그러면 옛 엔진 비우기를 건너뛰었다), 다음 꼬리 읽기가 통째로 다시 읽게 해 둔다(4-5 코드 검수 GPT GB5).
  async function settleCleared(gen) {
    state.noticed = Math.max(state.noticed, gen);
    try {
      await reload();
      foldLocal();
    } catch {
      state.resync = true;
      health?.note('save', { ok: false, code: 'CLEAR_RELOAD', dependent: true });
    }
  }
  async function caughtUp() {
    try {
      await reload();
      if (guest) foldLocal();
    } catch {
      // 다시 읽기는 다음 꼬리 읽기 · 다음 열기에.
    }
    noticeCleared();
  }
  // 이 기록부가 아직 알리지 않은 새 세대를 읽었으면 한 번 알린다.
  function noticeCleared() {
    if (state.gen <= state.noticed) return;
    state.noticed = state.gen;
    try {
      onCleared?.(state.gen);
    } catch {
      // 셸의 알림이 던져도 기록부는 그대로다.
    }
  }
  const movedIdsOf = account =>
    new Set(
      state.marks
        .filter(mark => mark.mark === 'moved' && (account == null || mark.account === account))
        .flatMap(mark => (Array.isArray(mark.ids) ? mark.ids : [])),
    );
  const requireSwap = () => {
    if (typeof port.swap !== 'function')
      throw Object.assign(new Error('Atlas record: 이 저장소는 안에서 비우지 못한다'), {
        code: 'STORAGE_UNSUPPORTED',
      });
  };

  // 손님: 든 사건으로 요약을 스스로 접는다(서버와 같은 어댑터 · 근거 줄 · 접기).
  async function refoldGuest() {
    // 다른 탭이 먼저 쓴 기록까지 읽고, 포트에서 차례대로 읽은 데(readKey)까지만 접는다 — 든 사건 열쇠의 최댓값으로 잡으면 읽는 사이에
    // 끝난 내 덧붙이기가 아직 안 읽은 다른 탭 사건(더 앞 열쇠)까지 접었다고 적어, 그 사건이 요약에도 얹기에도 빠졌다(GPT 끝 판 GC1 ·
    // 단계 4 §18-5-1 A4 — s6). 내 덧붙이기로는 readKey가 오르지 않으니(take) 포트가 어떤 차례로 돌든 맞고, 그 뒤 열쇠의 내 사건은 밀린 것으로 얹힌다.
    await refresh();
    foldLocal();
  }

  // 손님 요약을 읽은 데까지 그 자리에서 접는다(꼬리를 읽지 않는다 — refoldGuest와 다시 읽은 뒤의 refresh가 부른다).
  function foldLocal() {
    const until = state.readKey;
    const items = [...state.held.values()].filter(item => item.key <= until);
    // 접은 뒤에 든 사건이 없고 판 묶음(두뇌 · 색인 · 기록 규칙 — 아르곤 끝 판 D2)이 같으면 다시 접지 않는다. 「접은 자리가 읽은 자리 이상」으로
    // 견주면 저장된 요약 기록의 열쇠가 늘 그 요약의 until보다 커서(접은 뒤에 덧붙는다) 영영 거짓이라, 열 때마다 · refold마다 든 사건 전부를
    // 다시 접고 요약 기록을 새로 썼다(Fable 5.2 끝 판 둘째 F4 · 설계 주인 11-13). 앞 저장이 실패했거나 차례를 못 얻어 건너뛴 요약(key 없음)이면
    // 접지는 않고 저장만 한 번 더 건다 — refold가 그 다시 시도 자리다(설계 주인 조건).
    if (
      state.local &&
      state.local.summary?.edition === edition() &&
      !items.some(item => item.key > state.local.until)
    ) {
      if (state.local.key == null) void saveLocal();
      return;
    }
    const lines = linesOfGroups(groupsOf(items.map(entryOf)), { memory, params, index });
    const floor = now() - ISSUED_KEEP_MS;
    const issued = items
      .map(item => item.event)
      .filter(event => isIssued(event) && Date.parse(event.at) >= floor)
      .map(issuedRow);
    const next = { ...emptySummary(edition()), lines, issued, lineSeq: until, foldedUntil: until };
    // 보기의 바탕은 이 메모리 요약이다 — 탭 하나여도 차례 없이 선다(s2). 저장은 뒤에서, 아무도 기다리지 않는다(§18-5-1 R2 —
    // coach.ready · 사건의 stored · 판 끝의 folded는 이 계산까지만 기다린다). 접은 때의 세대를 함께 든다 — 저장은 이 세대로 막이를 건다(GB2 ·
    // 4-5 코드 다시 검수 GPT GA8: 앞 저장을 기다리는 사이 다른 탭이 비웠으면 비우기 전 요약을 새 세대에 쓰지 않는다).
    state.local = { summary: next, until, key: null, gen: state.gen };
    void saveLocal();
  }

  // 손님 요약 저장 — 하나씩, 저장하는 사이 새로 접힌 요약이 있으면 한 번 더. 호스트의 차례 안이면 그대로 쓰고, 밖이면 차례를 청한다
  // (exclusive — 못 얻으면 이번 저장만 건너뛴다, §18-5-1 R1 · R2). 저장 실패는 계기에만 — 사건 저장과 보기는 이미 섰다(아르곤 끝 판 D5).
  function saveLocal() {
    if (state.saving) {
      state.dirty = true;
      return state.saving;
    }
    state.saving = (async () => {
      // 이 묶음에서 쓴 요약 수 — 하나라도 쓰였으면 묶음이 끝난 뒤 한 번 알린다. 쓰기 · 받기 · 앞 요약 지우기가 다 끝난 뒤다. 건너뛴 저장(차례를
      // 못 얻음 · 실패 · 이미 쓴 요약)은 세지 않는다(설계 주인 11-16 저녁 조건 1). 받는 탭은 꼬리만 다시 읽고 다시 접지 않으므로 되알리지 않는다.
      let wrote = 0;
      do {
        state.dirty = false;
        if (!(await saveOnce())) break;
        wrote += 1;
      } while (state.dirty);
      if (wrote > 0) announceSaved();
    })().finally(() => {
      state.saving = null;
    });
    return state.saving;
  }

  function announceSaved() {
    try {
      onLocalSaved?.();
    } catch {
      // 알림이 던져도 저장은 그대로다 — 다른 탭은 다음 알림 · 다음 열기에 읽는다.
    }
  }

  async function saveOnce() {
    const local = state.local;
    if (!local || local.key != null) return false;
    // 그 요약을 접은 세대로 쓴다 — 차례를 기다리는 사이 다른 탭이 비웠으면 지워진 세상의 요약을 새 세대에 쓰지 않는다(GB2와 같은 꼴). 접은 때의
    // 세대는 요약과 함께 든다 — 저장을 시작할 때 읽으면 앞 저장을 기다리는 사이 새 세대를 읽은 탭이 비우기 전 요약을 새 세대에 썼다(GA8).
    const gen = local.gen ?? state.gen;
    const value = { kind: 'local', summary: packSummary(local.summary), until: local.until };
    const write = async () => {
      const [key] = await put([value], gen);
      accept({ key, value });
      // 덧붙이고 얹었으면 쓴 저장이다 — 앞 요약 지우기만 실패하면 계기에만 남기고 알린다. 남은 행은 다음 저장의 지우기가 함께 지운다
      // (지우기는 remove가 된 뒤에만 rows에서 뺀다 — 받기 알림 다시 검수 Fable F1 · 설계 주인 11-16 저녁).
      try {
        await dropRows(state.localRows, state.local?.key ?? key);
      } catch {
        noteSave(health, false, 'LOCAL_SUMMARY_DROP');
      }
    };
    try {
      await (state.turnDepth > 0 ? write() : exclusive('summary', () => within(write)));
      return true;
    } catch (error) {
      if (error?.code === 'TURN_BUSY')
        health?.note('save', { ok: false, code: 'TURN_BUSY', dependent: true });
      else noteSave(health, false, 'LOCAL_SUMMARY');
      return false;
    }
  }

  // 차례 안 — 기록부 스스로 청한 차례(손님 요약 저장)도 그 동안은 다시 청하지 않는다(호스트의 enterTurn과 같은 표시).
  async function within(work) {
    state.turnDepth += 1;
    try {
      return await work();
    } finally {
      state.turnDepth -= 1;
    }
  }

  // 새 요약이 선 뒤 앞 요약 기록을 지운다 — 요약을 기록마다 통째로 쌓으면 문항 수백 개 뒤 저장소가 수십 MB가 된다(Fable 끝 판 P1).
  // 지우는 것은 지금 쓰는 요약(keep)보다 앞이고 이 기록부가 읽은 데까지인 것만(다른 탭이 그 뒤에 쓴 것은 남긴다).
  async function dropRows(rows, keep) {
    const stale = [...rows].filter(key => key < keep && key <= Math.max(state.readKey, keep));
    if (!stale.length) return;
    await port.remove(stale);
    for (const key of stale) rows.delete(key);
  }

  // 손님은 스스로 접는다 — 첫 만남을 넓게 바꾸는 사건(옮겨 온 장부 · 제외)이나 쌓인 사건이 많으면 바로 다시 접는다.
  const broad = type => type === EVENT_TYPES.carried || type === EVENT_TYPES.excluded;
  const refoldAfter = type =>
    guest && (broad(type) || pendingIds(state).size >= GUEST_REFOLD) ? refoldGuest() : null;

  // 부모(제시 · 겨눈 사건 · 판)가 이 기록부에서 저장되지 못했으면 자식도 쓰지 않는다 — 부모가 아직 저장 중이면 그 뒤에. 부모 없는
  // 자식이 저장되면 서버가 그 사건을 받지 못해 올리기가 막혔다(Fable 끝 판 P1 — 이제 서버도 그런 사건만 빼고 받는다).
  // 같은 제시의 답은 바로 앞 답에도 기댄다(단계 4 §18-4) — 앞 답이 저장되지 못했으면 뒤 답도 쓰지 않는다. 쓰면 1번이 없는
  // attemptNo 2가 남아 서버가 EVENT_LINK로 빼고, 손님 기기에서는 틀린 뒤 다시 맞힌 답이 혼자 낸 첫 답으로 접혔다(s4).
  // 딸린 거절은 계기에 코드만 센다(이어진 실패 수에 넣지 않는다 — G5 · H2).
  async function append(type, event, value, before = null, gen = state.gen) {
    const parentLost = state.unsaved.has(parentOf(event));
    if (parentLost || (before != null && state.unsaved.has(before))) {
      state.unsaved.add(event.id);
      remember(state, event);
      health?.note('save', {
        ok: false,
        code: parentLost ? 'PARENT_UNSAVED' : 'ATTEMPT_UNSAVED',
        dependent: true,
      });
      return false;
    }
    try {
      const [key] = await put([value], gen);
      accept({ key, value });
    } catch (error) {
      state.unsaved.add(event.id);
      remember(state, event);
      // 다른 탭이 저장소를 비운 뒤의 늦은 쓰기(막이) — 저장 실패와 가른다. 셸은 onCleared로 이 탭의 코치를 은퇴시킨다.
      noteSave(health, false, error?.code === 'CLEARED' ? 'STORE_CLEARED' : 'STORAGE_ERROR');
      return false;
    }
    noteSave(health, true);
    // 손님의 로컬 요약 저장이 실패해도 사건은 이미 저장됐다 — 근거(stored true)를 뒤집지 않고 계기에만 남긴다(아르곤 끝 판 D5).
    try {
      await refoldAfter(type);
    } catch {
      noteSave(health, false, 'LOCAL_SUMMARY');
    }
    return true;
  }

  // 기록 값 — 제외의 닿는 줄 메모(touches)는 저장 직전에 잰다: 겨눈 사건 · 그 묶음의 답이 아직 저장 중이면 든 사건에 없어 메모가
  // 비었다(카본 끝 판 E3). 그래서 제외는 저장 중인 사건을 다 기다린 뒤에 잰다(store). nothingTouched는 판 응답을 빼는 문(코치
  // excludeResponse — 단계 4 계획 §22-5)만 준다: 판 응답은 접기 재료가 아니라 닿는 줄이 없다. 겨눈 응답이 기기에 없을 때(이틀 지나
  // 치웠거나 다른 기기의 응답)도 「닿는 줄 없음」을 빈 메모로 적어, 계정 보기가 그 제외를 서버가 접을 때까지 기다리지 않게 한다.
  function valueOf(type, event, nothingTouched = false) {
    const touches =
      type === EVENT_TYPES.excluded
        ? (touchesOf([...state.held.values()].map(entryOf), event.targetId, index) ??
          (nothingTouched ? { units: [], skills: [] } : null))
        : null;
    return { kind: 'event', event, ...(touches ? { touches } : {}) };
  }

  function store(type, event, valueFor) {
    // 같은 제시의 바로 앞 답(이 기록부가 만든 것) — 저장 중이면 기다리고, 이미 실패했으면 append가 거절한다(§18-4 H1: 둘 다).
    const attempt = type === EVENT_TYPES.attempted;
    const before = attempt ? (state.lastAttempt.get(event.presentationId) ?? null) : null;
    if (attempt) state.lastAttempt.set(event.presentationId, event.id);
    // 이 사건을 만든 때의 지우기 세대 — 부모의 저장을 기다리는 사이 다른 탭이 비우고 이 탭이 새 세대를 읽었어도, 그 세대로 막이를 건다(GB2).
    const gen = state.gen;
    const run = () => append(type, event, valueFor(), before, gen);
    const waits =
      type === EVENT_TYPES.excluded
        ? [...state.inflight.values()]
        : [state.inflight.get(parentOf(event)), before && state.inflight.get(before)].filter(
            Boolean,
          );
    const result = waits.length ? Promise.allSettled(waits).then(run) : run();
    state.inflight.set(event.id, result);
    result.finally(() => {
      if (state.inflight.get(event.id) === result) state.inflight.delete(event.id);
    });
    return result;
  }

  async function readTail() {
    for (const row of await port.range(state.readKey)) {
      accept(row);
      state.readKey = Math.max(state.readKey, row.key);
    }
  }

  // 꼬리를 읽는다 — 다른 탭의 치운 표시 · 새 세대의 비움 표지를 만났으면 포트를 통째로 다시 읽는다(A6 · 단계 4 계획 §22-4). 손님 기록부는
  // 다시 읽은 뒤 요약을 그 자리에서 다시 접는다(비운 저장소의 보기 바탕이 비지 않게). 새 세대를 읽었으면 셸에 한 번 알린다.
  async function refresh() {
    await readTail();
    let reloaded = false;
    for (let guard = 0; state.resync && guard < 3; guard += 1) {
      await reload();
      reloaded = true;
    }
    if (reloaded && guest) foldLocal();
    noticeCleared();
  }

  // 다른 탭이 치웠다 — 메모리 사본을 버리고 포트를 통째로 다시 읽는다. 표지를 읽기 전에 치워진 사건이 받은 표지 없이 남아 두 번
  // 얹히지 않게(§18-5-5 A6). 다시 읽은 스냅숏 뒤에 끝난 덧붙이기는 꼬리로 한 번 더 읽는다.
  async function reload() {
    const rows = await port.read();
    resetRead(state);
    for (const row of rows) {
      accept(row);
      state.readKey = Math.max(state.readKey, row.key);
    }
    state.resync = false;
    await readTail();
  }

  return {
    async load() {
      for (const row of await port.read()) {
        accept(row);
        state.readKey = Math.max(state.readKey, row.key);
      }
      state.resync = false; // 처음부터 통째로 읽었다 — 앞의 치운 표시는 다 반영됐다
      state.noticed = state.gen; // 처음 읽은 세대는 알리지 않는다
      if (guest) await refoldGuest();
      return this;
    },
    // 다른 탭 · 게임 틀이 덧붙인 꼬리만 읽는다.
    refresh,
    get revision() {
      return revision;
    },
    get summary() {
      return baseOf(state);
    },
    edition,
    clock: state.clock,

    // 사건 하나를 만들어 저장한다. 돌려주는 stored는 저장이 끝난 뒤의 값(true면 근거, false면 근거가 아니다).
    // nothingTouched: 판 응답을 빼는 제외만(위 valueOf).
    add(type, fields, { nothingTouched = false } = {}) {
      const atMs = state.clock.next();
      const id = nextId(state, atMs, tag);
      const event = createEvent(type, fields, { id, atMs, revision: guest ? 0 : revision });
      if (type === EVENT_TYPES.presented) state.families.set(id, event.familyKey);
      return { event, stored: store(type, event, () => valueOf(type, event, nothingTouched)) };
    },

    // 보낼 대기열 — 받은 표지가 없고 버리지 않은 내 2판 사건(만든 차례). skip은 이 세션에 건너뛸 번호들(서버가 번호 없이 묶음째
    // 돌려보낸 사건을 가려낸 것 — 버리지 않는다)이고, 그것에 기댄 사건(부모 사슬 — 그 제시의 전달 · 도움 · 답, 그것들을 겨눈 제외,
    // 그 결정의 마침 · 응답)도 함께 건너뛰고 그 너머를 읽는다(단계 4 §18-5-2 R12 · R13). 부모 없이 보내면 서버가 EVENT_LINK로 빼고
    // 기기가 그것을 버려, 부모가 올라간 뒤에도 다시 가지 않았다(s9). 부모는 늘 앞 열쇠라 한 번 훑기로 사슬이 다 걸린다.
    // 같은 제시의 자식(전달 · 도움 · 답)은 앞 자식에도 기댄다 — 하나를 건너뛰면 그 제시의 뒤 자식도 건너뛴다(고르기와 같은 앞머리 규칙).
    // 1번 없이 2번을 보내면 서버가 EVENT_LINK로 짚어 기기가 멀쩡한 2번을 영구히 버렸고(GPT 끝 판 GE2 · 카본 E2), 건너뛴 도움 없이 답만
    // 올라가면 서버 요약에 혼자 맞힌 답으로 굳는다(설계 주인 11-13).
    unsent(limit = 256, skip = null) {
      const blocked = new Set(skip ?? []);
      const stalled = new Set(); // 자식 하나가 건너뛰어진 제시
      const out = [];
      for (const item of [...state.held.values()].sort((a, b) => a.key - b.key)) {
        const event = item.event;
        if (!isCurrent(event) || state.acks.has(event.id) || state.dropped.has(event.id)) continue;
        if (skipped(event, blocked, stalled)) continue;
        out.push(event);
        if (out.length >= limit) break;
      }
      return out;
    },

    // 요약을 받을 기준(GET · POST의 since) — 지금 계정 요약의 판 묶음 · 줄 차례 · 세대 표지. gen이 없는 요약(gen 전에 받은 것)이면 gen을
    // 싣지 않는다 — 서버는 gen이 다르면 통째로 준다(§18-5-4 R17). 요약이 없으면 null(통째로).
    since() {
      const summary = state.summary;
      if (!summary) return null;
      return {
        edition: summary.edition,
        seq: summary.lineSeq,
        ...(summary.gen ? { gen: summary.gen } : {}),
      };
    },

    // 받은 요약의 자리(단계 4 계획 §21-22 — 학습일 답의 견주기) — 계정 기록부가 서버에서 받은 요약의 { edition, gen, foldedUntil }.
    // 손님 기록부(손님과 동의를 끈 계정)와 아직 받은 요약이 없는 계정은 null이다. 받은 요약이 바뀐 뒤에만 바뀐다.
    received() {
      const summary = state.summary;
      if (guest || !summary) return null;
      return {
        edition: summary.edition,
        gen: summary.gen ?? null,
        foldedUntil: summary.foldedUntil,
      };
    },
    // 받은 요약의 처음 장부 칸(단계 4 계획 §21-22) — 서버 길 계정의 summary().carried. 손님 기록부는 null(코치가 사건에서 짓는다).
    receivedCarried() {
      return guest ? null : (state.summary?.carried ?? null);
    },

    // 서버의 답 하나 — 받은 표지 · 누른 것 · 버린 것 · 요약을 한 기록으로 덧붙인다.
    async receive({
      accepted = [],
      clamped = [],
      rejected = [],
      rejectedCode = 'EVENT_REVISION', // 서버가 뺀 까닭 — 옛 동의 판(409) 또는 부모 · 차례가 맞지 않음(EVENT_LINK)
      summary = null,
      serverTime = null,
    }) {
      // 서버 시각을 받은 것(serverTimed — 치우기는 그 뒤에만, A6)은 시계를 실제로 맞춘 뒤에 켠다. 먼저 켜면 덧붙이기가 일시 실패했을 때
      // 시계는 안 맞췄는데 켜져, 앞선 기기 시계로 치우거나 미래의 치운 시각이 남았다(카본 끝 판 둘째 F1 · 설계 주인 11-13).
      const next = nextSummary(state, summary);
      // 달라진 것이 없는 답(받은 표지 · 누른 것 · 버린 것 · 새 요약이 없는 GET)은 기록을 쓰지 않는다 — 빈 표지가 쌓이고 다른 탭을
      // 깨웠다(단계 4 §18-5-5 B5). 서버 시각과의 차이만 이 기록부의 시계에 맞춘다.
      if (!accepted.length && !clamped.length && !rejected.length && !next) {
        if (Number.isFinite(serverTime)) {
          state.clock.sync(serverTime);
          state.serverTimed = true;
        }
        return baseOf(state);
      }
      const values = answerValues({ accepted, clamped, rejected, serverTime, next }, now);
      const keys = await put(values);
      values.forEach((value, i) => accept({ key: keys[i], value })); // 서버 시각을 실은 표지가 시계를 맞춘다(takeAck)
      if (Number.isFinite(serverTime)) state.serverTimed = true;
      if (rejected.length) noteSave(health, false, rejectedCode);
      // 앞 요약 행 지우기만 실패하면(정리 트랜잭션의 일시 오류 · 닫힘) 이미 덧붙이고 얹은 답을 실패로 올리지 않는다 — 계기에만 따로 남기고,
      // 남은 행은 다음 새 요약을 받을 때 지운다(지우기는 remove가 된 뒤에만 rows에서 뺀다 — 카본 끝 판 둘째 F2 · 설계 주인 11-13).
      if (next)
        try {
          await dropRows(state.summaryRows, state.summaryKey);
        } catch {
          noteSave(health, false, 'SUMMARY_DROP');
        }
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
    // 줄마다 사건 번호(id)를 남긴다 — 코치가 판을 다시 세울 때 「낸 것 전부 − 이 판 일지에서 다시 돌릴 내 제시 번호」로 센다
    // (시각으로 가르면 탭 · 기기 시계 차이와 같은 밀리초로 어긋났다, 단계 4 §16). 번호가 없는 요약 줄은 겹치지 않게 따로 두고 그대로 낸다.
    issued() {
      const rows = new Map((baseOf(state)?.issued ?? []).map((row, i) => [row.id ?? `#${i}`, row]));
      for (const id of pendingIds(state)) {
        const event = state.held.get(id).event;
        if (isIssued(event)) rows.set(id, issuedRow(event));
      }
      const floor = now() + state.clock.offsetMs - ISSUED_KEEP_MS;
      return [...rows.values()]
        .filter(row => row.at >= floor)
        .map(({ id, at, review, units }) =>
          id === undefined ? { at, review, units } : { id, at, review, units },
        );
    },

    // 손님: 판 끝처럼 지금 든 사건까지 요약을 바로 접어 둔다(새 사건이 없으면 그대로 — 단계 4 판 끝 칸 견주기, 11-11). 계정은 서버가 접는다.
    refold: () => (guest ? refoldGuest() : Promise.resolve()),
    // 지금 저장 중인 사건(부모를 기다리는 자식까지)이 다 끝날 때까지 — 올리기 · 다른 탭에 알리기 전에 부른다.
    async saved() {
      while (state.inflight.size) await Promise.allSettled([...state.inflight.values()]);
    },
    pending: () => pendingIds(state),
    // 호스트가 차례 안에서 일을 시작하고 끝낼 때(§18-5-1 R1) — 그 동안 기록부는 차례를 다시 청하지 않는다.
    enterTurn() {
      state.turnDepth += 1;
    },
    leaveTurn() {
      state.turnDepth = Math.max(0, state.turnDepth - 1);
    },
    // 뒤에서 도는 손님 요약 저장이 끝날 때까지(호스트가 포트를 닫기 전 · 시험).
    localSaved: () => state.saving ?? Promise.resolve(),
    // 치울 때가 됐나 — 이 세션에 서버 시각을 받았고, 마지막 치우기(어느 탭이든)에서 하루가 지났다(A6 · §18-3 「하루 한 번」).
    compactDue: () =>
      !guest && state.serverTimed && now() + state.clock.offsetMs - state.sweptAt >= SWEEP_EVERY_MS,
    has: id => state.held.has(id),
    heldEvent: id => state.held.get(id)?.event ?? null,
    heldEvents: () =>
      [...state.held.values()].sort((a, b) => a.key - b.key).map(item => item.event),
    // 단위마다의 근거 줄 전부(30일째 문장 — 단계 4 계획 §21-7). 든 사건 전부(저장이 끝난 사건 — 아직 요약에 접히지 않은 내 답 포함)를 요약
    // 접기와 같은 어댑터 · 근거 줄(rowsOfGroup)로 짓고, 단위 줄과 본인 말 줄만 서버 저장소와 같은 근거 줄 꼴로 단위마다 모은다(세기는
    // record/lookback.mjs의 unitLookback이 서버 읽기와 같이 한다 — §21-22). 저장 중인 사건은
    // 저장이 끝나면 든다(판 끝의 folded가 그 저장을 기다린다). 사건을 치우지 않는 기록부(손님과 동의를 끈 계정)만 처음부터 다 든다 — 계정
    // 기기는 이틀 치만 들어 코치가 부르지 않는다(서버 길은 서버의 돌아보기 읽기).
    unitRows() {
      const byUnit = new Map();
      for (const group of groupsOf([...state.held.values()].map(entryOf)).values())
        for (const row of rowsOfGroup(group, index)) {
          if (row.kind !== 'unit' && row.kind !== 'say') continue;
          if (!byUnit.has(row.unit)) byUnit.set(row.unit, []);
          byUnit.get(row.unit).push(row);
        }
      return byUnit;
    },
    // 계열마다의 만남 줄 전부와 그 만남이 든 제시의 판 번호(예상 급수의 근거 — 단계 4 계획 §21-23의 2). 든 사건 전부를 unitRows와 같은
    // 어댑터 · 근거 줄(rowsOfGroup)로 짓고, 만남 · 장부 줄만 서버 저장소와 같은 꼴로 계열마다 모은다(셈은 record/first.mjs가 서버 읽기와
    // 같이 한다). setOf(key) = 그 만남(답)이 든 묶음의 머리가 2판 제시이면 그 판 번호, 아니면 null(옛 꼴 제시 · 장부 · 본인 말).
    // 사건을 치우지 않는 기록부(손님과 동의를 끈 계정)만 처음부터 다 든다 — 계정 기기는 이틀 치만 들어 코치가 부르지 않는다.
    meetRows() {
      const families = new Map();
      const sets = new Map();
      for (const group of groupsOf([...state.held.values()].map(entryOf)).values())
        addMeetRows(group, index, families, sets);
      return { families, setOf: key => sets.get(key) ?? null };
    },
    acked: id => state.acks.get(id),

    // 오래되고 서버가 접은 사건 · 지난 표지 기록을 치운다. 답이 아직 안 달린 제시와 얹을 사건의 부모는 둔다.
    // 먼저 남길 표지 · 요약을 한 기록으로 덧붙이고 나서 앞 기록을 지운다(그 사이 끊겨도 겹친 표지는 해가 없다).
    // 지우는 것은 이 스냅숏에 담은 차례(seen)까지다 — 다른 탭이 그 뒤에 덧붙인 표지 · 사건은 남긴다(아르곤 끝 판 D3).
    // 치우기는 이 세션에 서버 시각을 한 번 받은 뒤에만 한다 — 틀린 기기 시계로 이틀을 재지 않게(§18-5-5 A6). 합친 표지에 치운 표시를
    // 싣는다 — 다른 탭은 그것을 만나면 포트를 통째로 다시 읽는다.
    async compact() {
      if (guest || !state.serverTimed) return 0;
      await refresh();
      const seen = state.readKey;
      const at = Math.round(now() + state.clock.offsetMs);
      const gone = new Set(staleIds(state, at - KEEP_MS));
      const kept = id => state.held.has(id) && !gone.has(id);
      const value = {
        kind: 'ack',
        acks: [...state.acks].filter(([id]) => kept(id)),
        clamped: [...state.clamped].filter(kept),
        dropped: [...state.dropped].filter(kept),
        offsetMs: state.clock.offsetMs,
        swept: { at },
      };
      // 지금 요약이 지울 ack(옛 꼴)에서 왔으면 요약 기록을 같은 덧붙이기에 함께 쓴다 — 하나뿐인 요약을 지우지 않게(GPT 끝 판 GE3).
      const carry =
        state.summary && !state.summaryRows.has(state.summaryKey)
          ? [{ kind: 'summary', summary: packSummary(state.summary) }]
          : [];
      const [keepKey, ...carried] = await put([value, ...carry]);
      state.ownSweeps.add(keepKey);
      accept({ key: keepKey, value });
      carried.forEach((key, i) => accept({ key, value: carry[i] }));
      const isStale = row =>
        row.key <= seen &&
        (row.value.kind === 'ack' || (row.value.kind === 'event' && gone.has(row.value.event.id)));
      await port.remove((await port.read()).filter(isStale).map(row => row.key));
      for (const id of gone) state.held.delete(id);
      return gone.size;
    },

    // 손님 로그를 계정 Z로 옮길 계획(§18-5-3 — 경계 둘을 다 지난 것만). 옛 꼴은 열쇠 경계 뒤의 것을 그대로 돌려준다 — 기준 시각으로
    // 고르는 지금 판의 규칙(guestLearningEvents)은 제품이 건다(옛 POST로 먼저 · 부모 먼저). 2판은 그 계정의 지금 판으로 도장을 찍고,
    // 제외의 닿는 줄 메모(touches)를 함께 낸다. until은 이 계획을 고른 읽은 자리(옮김 표지에 적는다) — 고르는 것도 읽은 자리까지만이다
    // (내 덧붙이기는 읽은 자리를 올리지 않는다 — 고른 것보다 작은 until이 적히면 다음에 같은 것을 또 고른다, A4와 같은 규칙). 부르는 쪽이
    // 꼬리부터 읽는다(move.mjs). watermarks: { others, all } — 남이 다녀간 기준 시각 · 자기 결정까지 든 기준 시각(제품의 deviceWatermark).
    // 옮긴 뒤에는 move.mjs가 실제로 옮긴 2판 번호(함께 간 2판 제외 포함)와 옛 POST로 실제로 보낸 옛 꼴 번호를 옮김 표지(ids)에 적는다 —
    // 다음 고르기에서 경계 뒤 자식 · 제외가 그 부모를 따라간다.
    guestUpload(accountRevision, { account = null, watermarks = {} } = {}) {
      const until = state.readKey;
      const items = [...state.held.values()]
        .filter(item => item.key <= until)
        .sort((a, b) => a.key - b.key);
      const edge = keyEdge(state.marks, account);
      const current = pickCurrent(
        items.filter(item => isCurrent(item.event)),
        {
          edge,
          moved: movedIds(state.marks, account, accountRevision),
          others: watermarks.others ?? 0,
          all: watermarks.all ?? 0,
        },
      );
      const legacy = items
        .filter(item => !isCurrent(item.event) && item.key > edge)
        .map(item => item.event);
      // 이번 옛 꼴 후보를 겨눈 2판 제외 — 옛 POST가 그 사건을 실제로 보냈을 때만 같은 회차에 함께 간다(move.mjs). 위 고르기에서는 겨눈
      // 옛 꼴이 picked에 없어 못 가고, 다음 회차에는 열쇠가 until 앞이라 못 가 기기에서 거둔 답이 계정에 남았다(설계 주인 11-13 — GPT
      // 다시 GA2 (b)). 앞서 보내 ids에 든 옛 꼴을 겨눈 것은 위 고르기의 지금 규칙(경계 뒤 · others 뒤)이다. 제외를 겨눈 제외는 없어(linkOk)
      // 사슬은 한 겹이다.
      const candidates = new Set(legacy.map(event => event.id));
      const chosen = new Set(current.map(item => item.event.id));
      const alongside = items.filter(
        item =>
          item.event.type === EVENT_TYPES.excluded &&
          isCurrent(item.event) &&
          candidates.has(item.event.targetId) &&
          !chosen.has(item.event.id),
      );
      const stamp = item => ({ ...item.event, revision: accountRevision });
      return {
        until,
        legacy,
        current: current.map(stamp),
        legacyExclusions: alongside.map(stamp),
        touches: new Map(
          [...current, ...alongside].filter(i => i.touches).map(i => [i.event.id, i.touches]),
        ),
      };
    },

    // 경계 표지를 쓴다(손님 저장소 — §18-5-3). 차례 안에서 부른다(호스트의 move 일).
    async mark({ mark, account = null, revision = null, until = null, ids = null }) {
      if (!MARKS.has(mark)) throw new TypeError(`Atlas record: 모르는 표지 ${mark}`);
      if (mark !== 'logout' && account == null) throw new TypeError('Atlas record: 계정 없는 표지');
      const value = {
        kind: 'mark',
        mark,
        ...(account != null ? { account } : {}),
        ...(Number.isSafeInteger(revision) ? { revision } : {}),
        ...(Number.isSafeInteger(until) ? { until } : {}),
        ...(mark === 'moved' && Array.isArray(ids) ? { ids: [...new Set(ids.filter(isId))] } : {}),
        at: Math.round(now() + state.clock.offsetMs),
      };
      const [key] = await put([value]);
      accept({ key, value });
      return key;
    },
    marks: () => state.marks.map(mark => ({ ...mark })),
    // 옮김 표지에 적힌 번호(판과 상관없이) — account를 주면 그 계정의 것만. 옛 기록 옮기기는 이 번호를 「이미 있음」으로 보고(단계 4 계획 §22-4 —
    // 카본새1 · Fable새1), 계정 비우기의 넷째 걸음은 그 계정의 것을 지운다.
    movedIds: (account = null) => movedIdsOf(account),
    // 가장 늦은 비움 표지 { gen, at, legacy, carried }의 사본(비운 적이 없으면 null)과 지금 읽은 지우기 세대.
    cleared: () =>
      state.cleared
        ? {
            ...state.cleared,
            legacy: state.cleared.legacy ? { ...state.cleared.legacy } : null,
            carried: state.cleared.carried
              ? {
                  ...state.cleared.carried,
                  families: [...state.cleared.carried.families],
                  items: [...state.cleared.carried.items],
                }
              : null,
          }
        : null,
    generation: () => state.gen,

    // 손님 저장소 비우기(단계 4 계획 §22-4 손님 1 — 설계 주인 답 2). 사건 · 요약 사본 · 옮기기 표지를 한 트랜잭션으로 지우고 비움 표지
    // { gen, at, legacy, carried: null }을 쓴다. 저장소를 다시 만들지 않고 안에서 비우므로 열쇠 번호는 이어지고 이름도 그대로다. legacy는 옛 로그의
    // 바닥의 epoch({ epoch } — 모르면 epoch null, 옛 로그가 없으면 legacy 자체가 null)이고 바닥 시각은 이 표지의 시각이다. 다른 탭이 먼저 비웠으면
    // (막이) 다시 읽고 두 번까지 더 한다. 이 기록부가 들던 쓰기 상태(저장 실패 · 앞 답 · 계열)도 비운다. 같은 문서의 코치 은퇴는 입구가 한다.
    async clear({ legacy = null } = {}) {
      if (!guest) throw new TypeError('Atlas record: 계정 저장소는 서버 비우기로 판을 올려 비운다');
      requireSwap();
      return fencedTurn(async () => {
        const gen = state.gen + 1;
        const at = stamp();
        const floor = legacy ? { epoch: legacy.epoch ?? null, at } : null;
        const value = { kind: 'cleared', gen, at, legacy: floor, carried: null };
        const [key] = await port.swap({ expect: state.gen, gen, removeAll: true, append: [value] });
        for (const table of [state.unsaved, state.failed, state.families, state.lastAttempt])
          table.clear();
        await settleCleared(gen);
        return { gen, key };
      });
    },

    // 계정 비우기의 넷째 걸음(단계 4 계획 §22-4 올리는 계정 4 — 설계 주인 답 3). 그 계정의 옮김 표지 모두(판과 상관없이)의 번호와 그것에 기댄
    // 사건(자식 · 제외 — 부모 사슬, 남기면 부모 없는 사건이 된다)을 지운다. 같은 트랜잭션에서 손님 요약 사본을 지우고, 세대를 올리고, 지운
    // 「옮겨 오기 전 기록」의 계열 · 문항과 마지막으로 옮긴 때를 비움 표지의 carried에 더한다(Fable -c FA1 — 옛 장부가 새 번호로 다시 들지
    // 않게). 옛 로그의 바닥(legacy)은 앞 표지의 것을 그대로 잇는다 — 이 걸음은 바닥을 새로 두지 않는다. 옮김 표지와 로그아웃 뒤의 손님 사건 ·
    // 남의 계정으로 옮긴 사건은 둔다. 지울 것이 없으면 쓰지 않는다. { gen, dropped } — dropped는 지운 사건 수.
    async dropMoved({ account }) {
      if (!guest) throw new TypeError('Atlas record: 옮긴 사건은 손님 저장소에서 지운다');
      if (account == null) throw new TypeError('Atlas record: 계정 없는 옮긴 사건 지우기');
      requireSwap();
      return fencedTurn(async () => {
        const gen = state.gen + 1;
        const at = stamp();
        let dropped = 0;
        // 지울 것은 비우는 트랜잭션 안에서 고른다 — 따로 읽고 고르면 그 사이 다른 탭이 옮긴 제시에 이어 단 답이 고르기에서 빠져 부모 없는 답으로
        // 남았다(4-5 코드 검수 GPT GB1). 옮김 표지와 앞 비움 표지(바닥 · 옮긴 장부 칸)도 그 트랜잭션이 읽은 줄에서 읽는다.
        const decide = rows => {
          const { drop, events } = movedRows(rows, movedIn(rows, account));
          if (!events.length) return null;
          dropped = new Set(events.map(event => event.id)).size;
          const last = lastClearedIn(rows);
          const value = {
            kind: 'cleared',
            gen,
            at,
            legacy: last?.legacy ?? null,
            carried: carriedList(events, last?.carried ?? null),
          };
          return { remove: drop, append: [value] };
        };
        await port.swap({ expect: state.gen, gen, plan: decide });
        if (!dropped) return { gen: state.gen, dropped: 0 };
        await settleCleared(gen);
        return { gen, dropped };
      });
    },

    // 옛 엔진 비우기가 됐다(손님 2 · 계정 4b) — 바닥과 옮긴 장부 칸을 거둔다(단계 4 계획 §22-4 옛 로그의 바닥 — Fable -c FA3). 옛 로그와 그
    // 장부가 비었으니 그 뒤의 옛 사건과 장부는 모두 새것이다. 같은 세대의 비움 표지를 하나 더 쓴다 — 다른 탭은 같은 세대라 은퇴하지 않고 표지만
    // 새로 든다. 거둘 것이 없으면 쓰지 않는다(false). gen은 그 비우기가 쓴(또는 읽은) 세대다 — 지금 비움 표지가 그 세대일 때만 거둔다. 먼저
    // 시작한 비우기의 옛 로그 확인이 늦게 끝나도 그사이 다음 비우기가 둔 바닥을 걷지 않게(4-5 코드 검수 GPT).
    async liftFloor(gen) {
      await refresh();
      const cleared = state.cleared;
      if (!cleared || cleared.gen !== gen || (cleared.legacy == null && cleared.carried == null))
        return false;
      const value = {
        kind: 'cleared',
        gen: cleared.gen,
        at: cleared.at,
        legacy: null,
        carried: null,
      };
      const [key] = await put([value]);
      accept({ key, value });
      return true;
    },

    // 손님 저장소에서 옮겨 오는 2판 사건(§18-5-3 ③ — 계정 기록부). 이미 든 번호는 건너뛰고(두 번 옮겨도 한 번), 제외의 닿는 줄 메모도
    // 함께 한 번에 덧붙인다. 도장(판 번호)은 guestUpload가 찍었다.
    async importMoved(events, touches = new Map()) {
      const fresh = events.filter(event => isCurrent(event) && !state.held.has(event.id));
      if (!fresh.length) return [];
      const values = fresh.map(event => ({
        kind: 'event',
        event,
        ...(touches.get(event.id) ? { touches: touches.get(event.id) } : {}),
      }));
      const keys = await put(values);
      keys.forEach((key, i) => accept({ key, value: values[i] }));
      return keys;
    },

    // 옛 저장소에서 옮겨 온 옛 꼴 사건을 덧붙인다(손님 — carry.mjs의 legacyToImport가 아직 안 옮긴 것만 고른다).
    async importLegacy(events) {
      if (!events.length) return [];
      const values = events.map(event => ({ kind: 'event', event }));
      const keys = await put(values);
      keys.forEach((key, i) => accept({ key, value: values[i] }));
      if (guest) await refoldGuest();
      return keys;
    },
  };
}
