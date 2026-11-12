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
//                      두기 · 로그아웃 · 있었음. 옮김 표지의 ids는 그때 실제로 옮긴 2판 사건 번호)
//   치우기의 합친 표지는 swept: { at }를 싣는다 — 다른 탭은 꼬리에서 그것을 만나면 포트를 통째로 다시 읽는다(단계 4 §18-5-5 A6).
//   파생 기록(손님 요약 · 치우기 · 옮기기)을 쓰는 일은 호스트의 차례(src/coach/turn.mjs) 안에서 한다 — 기록부가 스스로 차례를
//   청하는 곳은 차례 밖에서 시작된 손님 요약 저장 하나뿐이고(exclusive), 호스트가 「차례 안」으로 둔 동안에는 다시 청하지 않는다
//   (Web Locks는 다시 들어갈 수 없다 — 단계 4 §18-5-1 R1 · s8).
import { overlay } from '../fold/device.mjs';
import { deviceKey, EMPTY_INDEX, groupsOf } from './adapt.mjs';
import { createClock } from './clock.mjs';
import { createEvent, EVENT_FORM, EVENT_TYPES, eventId, isId, parentOf } from './events.mjs';
import { familySkillsOf, ownFoldEvents, touchesOf, WAIT } from './own.mjs';
import { linesOfGroups } from './rows.mjs';
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

function take(state, { key, value }, now, edition) {
  state.lastKey = Math.max(state.lastKey, key);
  if (value.kind === 'event') takeEvent(state, value, key);
  else if (value.kind === 'ack') takeAck(state, value, key, now);
  else if (value.kind === 'summary') takeSummary(state, value, key);
  else if (value.kind === 'local') takeLocal(state, value, key, edition);
  // 표지는 열쇠로 한 번만 — 내가 쓴 표지는 꼬리를 읽을 때 다시 온다(내 덧붙이기는 읽은 자리를 올리지 않는다).
  else if (value.kind === 'mark' && !state.marks.some(mark => mark.key === key))
    state.marks.push({ ...value, key });
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
    const open =
      group.source.event.type === EVENT_TYPES.presented &&
      !group.children.some(child => child.event.type === EVENT_TYPES.attempted);
    if (open || members.some(id => pending.has(id))) for (const id of members) keep.add(id);
  }
  for (const id of pending) {
    const event = state.held.get(id).event;
    keep.add(event.presentationId ?? event.targetId);
  }
  return keep;
}

function staleIds(state, floor) {
  const keep = keptIds(state, pendingIds(state));
  return [...state.held.keys()].filter(
    id => folded(state, id) && Date.parse(state.held.get(id).event.at) < floor && !keep.has(id),
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

// Z가 이 판(revision)으로 실제로 옮겨 간 2판 사건 번호 — 옮김 표지의 ids. 경계 뒤에 덧붙은 자식 · 제외가 그 안의 사건을 겨누면 함께
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

// 2판 사건 고르기 — 머리가 열쇠 경계 뒤이고 그 시각이 남이 다녀간 기준 시각(others) 뒤인 묶음. 장부는 기준 시각(all — 자기 결정 포함)이
// 0일 때만(장부에는 든 일이 언제 것인지 가릴 재료가 없다 — 결정 2의 보수 쪽). 자식 · 제외는 이번에 고른 부모를 따라가고, 열쇠 경계
// 뒤에 덧붙은 것은 부모를 Z가 이 판으로 이미 옮겨 갔으면 따라간다(moved — 옮김 표지의 ids).
function takes(item, picked, { edge, moved, others, all }) {
  const { event } = item;
  if (isHead(event))
    return (
      item.key > edge &&
      Date.parse(event.at) > others &&
      (event.type !== EVENT_TYPES.carried || all === 0)
    );
  const parent = parentOf(event);
  return picked.has(parent) || (item.key > edge && moved.has(parent));
}
// 대기열에서 건너뛸 사건인가(unsent) — 건너뛸 번호 자신 · 그것에 기댄 자식(부모 사슬), 답 하나가 건너뛰어진 제시의 뒤 답(같은 제시의
// 답은 앞 답에 기댄다 — §18-4). 건너뛰면 그 번호를 막힌 것에 더한다(자손이 따라 걸린다).
function skipped(event, blocked, stalled) {
  const attempt = event.type === EVENT_TYPES.attempted;
  const leans =
    blocked.has(event.id) ||
    blocked.has(parentOf(event)) ||
    (attempt && stalled.has(event.presentationId));
  if (!leans) return false;
  blocked.add(event.id);
  if (attempt) stalled.add(event.presentationId);
  return true;
}

function pickCurrent(items, rule) {
  const picked = new Set();
  return items.filter(item => {
    if (!takes(item, picked, rule)) return false;
    picked.add(item.event.id);
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
}) {
  const state = createState(guest, now);
  const edition = () => foldEdition(params, index);
  const accept = row => take(state, row, now, edition());

  // 손님: 든 사건으로 요약을 스스로 접는다(서버와 같은 어댑터 · 근거 줄 · 접기).
  async function refoldGuest() {
    // 다른 탭이 먼저 쓴 기록까지 읽고, 포트에서 차례대로 읽은 데(readKey)까지만 접는다 — 든 사건 열쇠의 최댓값으로 잡으면 읽는 사이에
    // 끝난 내 덧붙이기가 아직 안 읽은 다른 탭 사건(더 앞 열쇠)까지 접었다고 적어, 그 사건이 요약에도 얹기에도 빠졌다(GPT 끝 판 GC1 ·
    // 단계 4 §18-5-1 A4 — s6). 내 덧붙이기로는 readKey가 오르지 않으니(take) 포트가 어떤 차례로 돌든 맞고, 그 뒤 열쇠의 내 사건은 밀린 것으로 얹힌다.
    await refresh();
    const until = state.readKey;
    const items = [...state.held.values()].filter(item => item.key <= until);
    // 판 묶음(두뇌 · 색인 · 기록 규칙)이 바뀌었으면 든 사건으로 다시 접는다(아르곤 끝 판 D2).
    if (state.local && state.local.until >= until && state.local.summary?.edition === edition())
      return;
    const lines = linesOfGroups(groupsOf(items.map(entryOf)), { memory, params, index });
    const floor = now() - ISSUED_KEEP_MS;
    const issued = items
      .map(item => item.event)
      .filter(event => isIssued(event) && Date.parse(event.at) >= floor)
      .map(issuedRow);
    const next = { ...emptySummary(edition()), lines, issued, lineSeq: until, foldedUntil: until };
    // 보기의 바탕은 이 메모리 요약이다 — 탭 하나여도 차례 없이 선다(s2). 저장은 뒤에서, 아무도 기다리지 않는다(§18-5-1 R2 —
    // coach.ready · 사건의 stored · 판 끝의 folded는 이 계산까지만 기다린다).
    state.local = { summary: next, until, key: null };
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
      do {
        state.dirty = false;
        if (!(await saveOnce())) break;
      } while (state.dirty);
    })().finally(() => {
      state.saving = null;
    });
    return state.saving;
  }

  async function saveOnce() {
    const local = state.local;
    if (!local || local.key != null) return false;
    const value = { kind: 'local', summary: packSummary(local.summary), until: local.until };
    const write = async () => {
      const [key] = await port.append([value]);
      accept({ key, value });
      await dropRows(state.localRows, state.local?.key ?? key);
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
  async function append(type, event, value, before = null) {
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
      const [key] = await port.append([value]);
      accept({ key, value });
    } catch {
      state.unsaved.add(event.id);
      remember(state, event);
      noteSave(health, false, 'STORAGE_ERROR');
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
  // 비었다(카본 끝 판 E3). 그래서 제외는 저장 중인 사건을 다 기다린 뒤에 잰다(store).
  function valueOf(type, event) {
    const touches =
      type === EVENT_TYPES.excluded
        ? touchesOf([...state.held.values()].map(entryOf), event.targetId, index)
        : null;
    return { kind: 'event', event, ...(touches ? { touches } : {}) };
  }

  function store(type, event, valueFor) {
    // 같은 제시의 바로 앞 답(이 기록부가 만든 것) — 저장 중이면 기다리고, 이미 실패했으면 append가 거절한다(§18-4 H1: 둘 다).
    const attempt = type === EVENT_TYPES.attempted;
    const before = attempt ? (state.lastAttempt.get(event.presentationId) ?? null) : null;
    if (attempt) state.lastAttempt.set(event.presentationId, event.id);
    const run = () => append(type, event, valueFor(), before);
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

  // 꼬리를 읽는다 — 다른 탭의 치운 표시를 만났으면 포트를 통째로 다시 읽는다(A6).
  async function refresh() {
    await readTail();
    for (let guard = 0; state.resync && guard < 3; guard += 1) await reload();
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
    add(type, fields) {
      const atMs = state.clock.next();
      const id = nextId(state, atMs, tag);
      const event = createEvent(type, fields, { id, atMs, revision: guest ? 0 : revision });
      if (type === EVENT_TYPES.presented) state.families.set(id, event.familyKey);
      return { event, stored: store(type, event, () => valueOf(type, event)) };
    },

    // 보낼 대기열 — 받은 표지가 없고 버리지 않은 내 2판 사건(만든 차례). skip은 이 세션에 건너뛸 번호들(서버가 번호 없이 묶음째
    // 돌려보낸 사건을 가려낸 것 — 버리지 않는다)이고, 그것에 기댄 사건(부모 사슬 — 그 제시의 전달 · 도움 · 답, 그것들을 겨눈 제외,
    // 그 결정의 마침 · 응답)도 함께 건너뛰고 그 너머를 읽는다(단계 4 §18-5-2 R12 · R13). 부모 없이 보내면 서버가 EVENT_LINK로 빼고
    // 기기가 그것을 버려, 부모가 올라간 뒤에도 다시 가지 않았다(s9). 부모는 늘 앞 열쇠라 한 번 훑기로 사슬이 다 걸린다.
    // 같은 제시의 답은 앞 답에도 기댄다(§18-4) — 답 하나를 건너뛰면 그 제시의 뒤 답도 건너뛴다. 1번 없이 2번을 보내면 서버가
    // EVENT_LINK로 짚어 기기가 멀쩡한 2번을 영구히 버렸다(GPT 끝 판 GE2 · 카본 E2).
    unsent(limit = 256, skip = null) {
      const blocked = new Set(skip ?? []);
      const stalled = new Set(); // 답 하나가 건너뛰어진 제시
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

    // 서버의 답 하나 — 받은 표지 · 누른 것 · 버린 것 · 요약을 한 기록으로 덧붙인다.
    async receive({
      accepted = [],
      clamped = [],
      rejected = [],
      rejectedCode = 'EVENT_REVISION', // 서버가 뺀 까닭 — 옛 동의 판(409) 또는 부모 · 차례가 맞지 않음(EVENT_LINK)
      summary = null,
      serverTime = null,
    }) {
      if (Number.isFinite(serverTime)) state.serverTimed = true;
      const next = nextSummary(state, summary);
      // 달라진 것이 없는 답(받은 표지 · 누른 것 · 버린 것 · 새 요약이 없는 GET)은 기록을 쓰지 않는다 — 빈 표지가 쌓이고 다른 탭을
      // 깨웠다(단계 4 §18-5-5 B5). 서버 시각과의 차이만 이 기록부의 시계에 맞춘다.
      if (!accepted.length && !clamped.length && !rejected.length && !next) {
        if (Number.isFinite(serverTime)) state.clock.sync(serverTime);
        return baseOf(state);
      }
      const values = answerValues({ accepted, clamped, rejected, serverTime, next }, now);
      const keys = await port.append(values);
      values.forEach((value, i) => accept({ key: keys[i], value }));
      if (next) await dropRows(state.summaryRows, state.summaryKey);
      if (rejected.length) noteSave(health, false, rejectedCode);
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
      const [keepKey, ...carried] = await port.append([value, ...carry]);
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
    // 옮긴 뒤에는 move.mjs가 current의 번호를 옮김 표지(ids)에 적는다 — 다음 고르기에서 경계 뒤 자식 · 제외가 그 부모를 따라간다.
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
      return {
        until,
        legacy: items.filter(item => !isCurrent(item.event) && item.key > edge).map(i => i.event),
        current: current.map(item => ({ ...item.event, revision: accountRevision })),
        touches: new Map(current.filter(i => i.touches).map(i => [i.event.id, i.touches])),
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
      const [key] = await port.append([value]);
      accept({ key, value });
      return key;
    },
    marks: () => state.marks.map(mark => ({ ...mark })),

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
      const keys = await port.append(values);
      keys.forEach((key, i) => accept({ key, value: values[i] }));
      return keys;
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
