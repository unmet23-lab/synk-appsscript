// 서버 접기의 순서(설계 §5-3 · 단계 3 계획 §4-3 · §4-5). 어느 근거 줄 · 단위 · 계열 · 능력을 다시 접나를 여기서 정하고,
// 계산 자체는 단계 2의 src/fold(foldUnit · skillRowsOf · foldSkill · firstMeeting)를 부른다. 서버에는 이어 붙이는 길이 없다 —
// 닿은 묶음의 근거 줄을 통째로 다시 짓고, 닿은 단위 · 계열 · 능력을 그 근거 줄에서 처음부터 다시 접는다.
//
// 저장소(store)는 한 계정 · 한 판 묶음의 작은 비동기 포트다 — 패키지 시험은 메모리로, SYNK-talk은 SQL로 꽂는다.
//   head()                         { foldedUntil, floorSeq, lineSeq, issued } (없으면 null)
//   writeHead(patch)
//   entriesAfter(seq, limit)       [{ seq, receivedMs, event }] — server_seq 순, seq보다 뒤
//   maxSeq()
//   eventById(id, until)           { seq, receivedMs, event } | null
//   presentationsOf(decisionId, until)  [{ seq, receivedMs, event }] — 옛 꼴 결정의 제시들
//   group(sourceId, until)         { source, children, exclusions } — 기록(위 꼴)의 묶음. 머리가 없으면 null
//                                  until = 이번 접기의 끝 차례 — 그보다 뒤의 사건은 묶음에 넣지 않는다(표지가 정확하게)
//   linesSince(seq)                [{ kind, key, value, seq }] — 줄 갱신 차례 순
//   rowsOf(sourceId)  replaceRows(sourceId, rows)
//   unitRows(unit)  familyRows(family)  familiesOfSkill(skill)
//   lines(kind, keys)              Map<key, value>
//   writeLines(changes)            [{ kind, key, value }] — 저장소가 줄 갱신 차례를 하나씩 올려 붙인다
// floorSeq(비운 차례) 이하의 사건은 저장소가 어디서도 돌려주지 않는다(비우기 — 계획 §4-6).
import { EVENT_FORM, EVENT_TYPES } from './events.mjs';
import { EMPTY_INDEX, serverKey, sourcesOf } from './adapt.mjs';
import {
  cellLines,
  familyLine,
  groupBy,
  itemLine,
  rowsOfGroup,
  skillLine,
  skillRowsFor,
  unitLine,
} from './rows.mjs';

export const FOLD_CAP = 2000;
export const ISSUED_KEEP_MS = 2 * 86_400_000;

// 기록 · 어댑터 · 근거 줄 규칙의 판 — 이 폴더의 접기 규칙을 고치면 올린다(옛 줄이 새 규칙으로 다시 접히게).
export const RECORD_EDITION = 'record-1';

// 판 묶음 — 접기에 드는 판(매개변수 · 기억 · 난도 · 문항 색인의 태그 판 · 기록 규칙). 이것이 바뀌면 그 계정을 옆에 다시 접는다(§4-5).
export const foldEdition = (params, index = EMPTY_INDEX) =>
  [
    params.editions.params,
    params.editions.memory,
    params.editions.ability,
    index.edition,
    RECORD_EDITION,
  ].join('+');

// 서버가 받은 기록 → 어댑터의 기록. 접는 시각 = min(사건 at, 받은 시각) — 저장된 값만 읽어 몇 번을 다시 접어도 같다.
export function entryOf({ seq, receivedMs, event }) {
  const at = Date.parse(event.at);
  return {
    event,
    key: event.schema === EVENT_FORM.current ? event.id : serverKey(seq, event),
    atMs: Math.min(at, receivedMs),
    clamped: at > receivedMs,
    seq,
  };
}

const groupEntries = group =>
  group && {
    source: entryOf(group.source),
    children: group.children.map(entryOf),
    exclusions: group.exclusions.map(entryOf),
  };

async function sourcesOfBatch(store, records, until) {
  const out = new Set();
  const byId = new Map(records.map(record => [record.event.id, record.event]));
  const missing = records
    .filter(r => r.event.type === EVENT_TYPES.excluded && !byId.has(r.event.targetId))
    .map(r => r.event.targetId);
  for (const id of missing) {
    const found = await store.eventById(id, until);
    if (found) byId.set(id, found.event);
  }
  const decisions = new Map();
  for (const record of records) {
    const target = byId.get(record.event.targetId);
    if (target?.type === EVENT_TYPES.setDecided && target.schema !== EVENT_FORM.current)
      decisions.set(
        target.id,
        (await store.presentationsOf(target.id, until)).map(r => r.event),
      );
  }
  const context = { byId: id => byId.get(id), presentationsOf: id => decisions.get(id) ?? [] };
  for (const record of records) for (const id of sourcesOf(record.event, context)) out.add(id);
  return out;
}

function collect(rows, touched) {
  for (const row of rows) {
    if (row.kind === 'unit' || row.kind === 'say') touched.units.add(row.unit);
    else touched.families.add(row.family);
    if (row.item) touched.items.add(row.item);
    if (row.skill) touched.skills.add(row.skill);
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function rebuildGroups(store, sources, { index, until }, touched) {
  for (const sourceId of sources) {
    const before = await store.rowsOf(sourceId);
    const group = groupEntries(await store.group(sourceId, until));
    const after = group ? rowsOfGroup(group, index) : [];
    collect(before, touched);
    collect(after, touched);
    if (!same(before, after)) await store.replaceRows(sourceId, after);
  }
}

async function changedLines(store, kind, values) {
  const current = await store.lines(kind, [...values.keys()]);
  const out = [];
  for (const [key, value] of values)
    if (!same(current.get(key) ?? null, value ?? null)) out.push({ kind, key, value });
  return out;
}

async function familyRowsMap(store, families) {
  const out = new Map();
  for (const family of families) out.set(family, await store.familyRows(family));
  return out;
}

// 능력이 닿으면 그 능력에 만남이 있는 계열 전부를 읽는다(첫 만남 lead는 계열마다, 능력 줄은 그 계열들의 답 줄에서).
async function skillValues(store, skills, params) {
  const skillOut = new Map();
  const cellOut = new Map();
  for (const skill of skills) {
    const families = await familyRowsMap(store, await store.familiesOfSkill(skill));
    const rows = skillRowsFor(skill, families.values());
    skillOut.set(skill, skillLine(rows, params));
    for (const [key, cell] of cellLines(skill, rows)) cellOut.set(key, cell);
  }
  // 그 능력의 칸 가운데 더는 없는 칸은 없어진 줄로 — 칸 열쇠는 「능력|난도」.
  for (const skill of skills)
    for (const difficulty of [1, 2, 3]) {
      const key = `${skill}|${difficulty}`;
      if (!cellOut.has(key)) cellOut.set(key, null);
    }
  return { skillOut, cellOut };
}

async function refold(store, touched, { memory, params }) {
  const units = new Map();
  for (const unit of touched.units) units.set(unit, unitLine(await store.unitRows(unit), memory));
  const familyRows = await familyRowsMap(store, touched.families);
  const families = new Map();
  for (const [family, rows] of familyRows) {
    families.set(family, familyLine(rows));
    for (const row of rows) if (row.skill) touched.skills.add(row.skill);
  }
  const itemRows = groupBy(
    [...familyRows.values()]
      .flat()
      .filter(row => row.kind === 'meet' && touched.items.has(row.item)),
    row => row.item,
  );
  const items = new Map([...touched.items].map(item => [item, itemLine(itemRows.get(item) ?? [])]));
  const { skillOut, cellOut } = await skillValues(store, touched.skills, params);
  return [
    ...(await changedLines(store, 'unit', units)),
    ...(await changedLines(store, 'family', families)),
    ...(await changedLines(store, 'item', items)),
    ...(await changedLines(store, 'skill', skillOut)),
    ...(await changedLines(store, 'cell', cellOut)),
  ];
}

// 「낸 것」 — 최근 이틀의 2판 제시(설계 §5-4 한도 세기). 접기 재료가 아니다.
function issuedAfter(issued, records, nowMs) {
  const byId = new Map(issued.map(row => [row.id, row]));
  for (const record of records) {
    const event = record.event;
    if (event.type !== EVENT_TYPES.presented || event.schema !== EVENT_FORM.current) continue;
    byId.set(event.id, {
      id: event.id,
      at: Date.parse(event.at),
      review: event.reason.tier === 1,
      units: [...event.reason.introduced],
    });
  }
  return [...byId.values()]
    .filter(row => row.at >= nowMs - ISSUED_KEEP_MS)
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

// 「어디까지 접었나」 뒤의 사건 전부에서(이번 요청이 가져온 것만이 아니다) 상한만큼 접는다.
// 표지는 접은 데까지만 올린다 — 던지면 아무것도 올리지 않는다(부르는 쪽이 세이브포인트로 되돌린다).
export async function foldPending(
  store,
  { memory, params, index = EMPTY_INDEX, nowMs, cap = FOLD_CAP },
) {
  const head = await store.head();
  const start = Math.max(head.foldedUntil, head.floorSeq);
  const records = await store.entriesAfter(start, cap);
  if (!records.length) return { folded: 0, until: start, changed: 0, done: true };
  const touched = { units: new Set(), families: new Set(), items: new Set(), skills: new Set() };
  const until = records.at(-1).seq;
  const sources = await sourcesOfBatch(store, records, until);
  await rebuildGroups(store, sources, { index, until }, touched);
  const changes = await refold(store, touched, { memory, params });
  if (changes.length) await store.writeLines(changes);
  await store.writeHead({ foldedUntil: until, issued: issuedAfter(head.issued, records, nowMs) });
  return {
    folded: records.length,
    until,
    changed: changes.length,
    done: until >= (await store.maxSeq()),
  };
}

// 한 계정의 접기 — 판 묶음이 바뀌었으면 옆에 짓고 따라잡으면 바꿔 끼운다(설계 §5-3 「전부 다시 접기는 옆에 짓는다」).
//   account.active()                       { edition, floorSeq } | null — 활성 머리
//   account.head(edition)                  그 판 묶음의 머리 | null
//   account.create(edition, state, floor)  머리를 만든다(state: 'active' | 'building')
//   account.store(edition)                 위 store 포트
//   account.activate(edition)              그 판 묶음을 활성으로, 나머지 판 묶음의 머리 · 근거 줄 · 줄을 지운다(파생 값)
// 돌려주는 served = 지금 내려 줄 요약의 판 묶음(짓는 동안은 앞 판 — 판이 섞인 요약은 내려가지 않는다).
export async function foldAccount(account, context) {
  const edition = foldEdition(context.params, context.index);
  const active = await account.active();
  if (!active) {
    await account.create(edition, 'active', 0);
    return { served: edition, ...(await foldPending(account.store(edition), context)) };
  }
  if (active.edition === edition)
    return { served: edition, ...(await foldPending(account.store(edition), context)) };
  if (!(await account.head(edition))) await account.create(edition, 'building', active.floorSeq);
  const result = await foldPending(account.store(edition), context);
  if (!result.done) return { served: active.edition, building: edition, ...result };
  await account.activate(edition);
  return { served: edition, swapped: true, ...result };
}

// 요약에서 달라진 줄(설계 §5-3 「요약」). since = { edition, seq } — 같은 판 묶음이고 seq가 지금 차례 이하면 그 뒤 줄만,
// 아니면 통째로(없어진 줄 표지 없이). 판 묶음이 바뀐 뒤에는 기기가 요약을 통째로 다시 받는다.
export async function summaryOf(store, { edition, since = null }) {
  const head = await store.head();
  const partial =
    since?.edition === edition && Number.isSafeInteger(since.seq) && since.seq <= head.lineSeq;
  const lines = await store.linesSince(partial ? since.seq : 0);
  return {
    edition,
    full: !partial,
    foldedUntil: head.foldedUntil,
    lineSeq: head.lineSeq,
    issued: head.issued,
    lines: partial ? lines : lines.filter(line => line.value != null),
  };
}

// 눌린 시각 — 이 기록들 가운데 서버가 받은 시각으로 누른 사건 id(답에 싣는다).
export const clampedOf = records =>
  records
    .map(entryOf)
    .filter(entry => entry.clamped)
    .map(entry => entry.event.id);
