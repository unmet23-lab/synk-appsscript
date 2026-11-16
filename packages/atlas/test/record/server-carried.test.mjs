// 서버 요약의 처음 장부 칸(단계 4 계획 §21-22 — 설계 주인 답 1 · 설계 검토로 고친 것). 서버 접기가 머리에 적고(head().carried =
// { built, value, seq }), summaryOf가 통째 답에는 늘, 부분 답에는 칸의 차례가 since보다 클 때만 싣는다. 기기는 세 갈래로 합친다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { createMemoryAccount, T0 } from '../support/trail-world.mjs';

const { createEvent, eventId } = await subject('record/events.mjs');
const { foldAccount, summaryOf, foldEdition } = await subject('record/server.mjs');
const { firstLedgerCells } = await subject('record/carry.mjs');
const { applyDelta } = await subject('record/summary.mjs');
const { createMemory } = await subject('memory/index.mjs');
const { PARAMS } = await subject('params.mjs');

const memory = createMemory(PARAMS);
const edition = foldEdition(PARAMS, undefined);
const NOW = T0 + 1e9;
const context = (extra = {}) => ({ memory, params: PARAMS, nowMs: NOW, ...extra });

function maker(tag) {
  let n = 0;
  return (type, fields) => {
    n += 1;
    const atMs = T0 + n * 60_000;
    return createEvent(type, fields, { id: eventId(atMs, n, tag), atMs, revision: 1 });
  };
}
const cellOf = (skillId, difficulty = 1) => ({
  skillId,
  difficulty,
  independent: 2,
  correct: 2,
  helped: 0,
  lastAt: null,
});
// 처음 옮긴 장부(after null · 칸 있음)와 그 뒤 장부(after 있음 · 칸 없음).
const firstLedger = (make, skillId, family = 'fam0') =>
  make('record.carried', {
    families: { [family]: 1 },
    items: {},
    after: null,
    cells: [cellOf(skillId)],
  });
const laterLedger = (make, after, family = 'fam1') =>
  make('record.carried', { families: { [family]: 1 }, items: {}, after });
const item = {
  itemKey: 'it0',
  familyKey: 'fam0',
  skillId: 'ko.listening.detail',
  difficulty: 1,
  responseFormat: 'single-choice',
  units: ['u0'],
};
const presented = {
  setId: 'set1',
  ...item,
  modality: 'listening',
  audioRequired: false,
  confounded: false,
  firstExposure: true,
  editions: { ...PARAMS.editions, index: 'index-0' },
  expected: { floor: 0.25, memory: 1, skill: 0.6 },
  arm: 'adaptive',
  reason: { code: 'unit.new', slots: {}, evidence: {}, target: 'u0', tier: 2, introduced: ['u0'] },
};
function practice(make, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const shown = make('practice.presented', presented);
    out.push(
      shown,
      make('practice.attempted', {
        presentationId: shown.id,
        attemptNo: 1,
        verdict: 'correct',
        errorTags: [],
      }),
    );
  }
  return out;
}
async function foldAll(server, extra = {}) {
  for (let guard = 0; guard < 1000; guard += 1) {
    const result = await foldAccount(server.account, context(extra));
    if (result.done && !result.building) return result;
  }
  throw new Error('접기가 끝나지 않는다');
}
const summaryNow = (server, since = null) =>
  summaryOf(server.account.store(edition), { edition, since });

test('처음 장부 칸 — 접을 때 머리에 적고, 통째 답은 늘 싣는다(장부가 없으면 null) · 값은 손님과 같은 firstLedgerCells다', async () => {
  const make = maker('carry001');
  const server = createMemoryAccount();
  server.append(practice(make, 1), T0 + 1e6);
  await foldAll(server);
  const none = await summaryNow(server);
  assert.equal(Object.hasOwn(none, 'carried'), true, '통째 답은 칸 키를 늘 싣는다');
  assert.equal(none.carried, null, '장부가 없으면 지었는데 없음(null)');
  const ledger = firstLedger(make, 'ko.reading.detail');
  server.append([ledger], T0 + 2e6);
  await foldAll(server);
  const whole = await summaryNow(server);
  assert.deepEqual(
    whole.carried,
    firstLedgerCells([ledger]),
    '한 기기 장부 — 손님 접기와 깊은 같음',
  );
});

test('처음 장부 칸 — 이 칸 전에 접힌 머리(아직 안 지음)는 새 답 없이 읽어도 짓고, since가 최신인 기기도 그 칸을 받는다(설계 검토 카본 A1)', async () => {
  const make = maker('carry002');
  const server = createMemoryAccount();
  const ledger = firstLedger(make, 'ko.reading.detail');
  server.append([ledger, ...practice(make, 2)], T0 + 1e6);
  await foldAll(server);
  const head = server.heads.get(edition);
  head.carried = { built: false, value: null, seq: 0 }; // 마이그레이션 전에 접힌 머리
  const before = await summaryNow(server);
  assert.equal(Object.hasOwn(before, 'carried'), false, '아직 안 지은 머리는 칸을 싣지 않는다');
  const since = { edition, seq: before.lineSeq, ...(before.gen ? { gen: before.gen } : {}) };
  const result = await foldAccount(server.account, context()); // 접을 사건이 없는 읽기
  assert.equal(result.folded, 0);
  const after = await summaryNow(server, since);
  assert.equal(after.full, false, '부분 답');
  assert.equal(after.lineSeq, before.lineSeq + 1, '칸을 지으며 머리의 줄 차례를 하나 올렸다');
  assert.deepEqual(
    after.carried,
    firstLedgerCells([ledger]),
    'since가 최신이어도 지은 칸을 받는다',
  );
  const again = await summaryNow(server, { ...since, seq: after.lineSeq });
  assert.equal(Object.hasOwn(again, 'carried'), false, '받은 뒤의 부분 답은 칸을 다시 싣지 않는다');
});

test('처음 장부 칸 — 상한으로 나뉜 다음 묶음의 거둠으로 칸이 null이 되고, 부분 답이 그 null을 싣는다', async () => {
  const make = maker('carry003');
  const server = createMemoryAccount();
  const ledger = firstLedger(make, 'ko.reading.detail');
  server.append([ledger, ...practice(make, 2)], T0 + 1e6);
  await foldAll(server, { cap: 2 });
  const built = await summaryNow(server);
  assert.ok(built.carried, '칸이 섰다');
  const since = { edition, seq: built.lineSeq, ...(built.gen ? { gen: built.gen } : {}) };
  server.append([...practice(make, 1), make('record.excluded', { targetId: ledger.id })], T0 + 2e6);
  const first = await foldAccount(server.account, context({ cap: 2 })); // 거둠은 다음 묶음에 온다
  assert.equal(first.done, false);
  assert.ok((await summaryNow(server)).carried, '거둠 전 묶음 — 칸은 그대로');
  await foldAll(server, { cap: 2 });
  const after = await summaryNow(server, since);
  assert.equal(Object.hasOwn(after, 'carried'), true);
  assert.equal(after.carried, null, '거둔 장부의 칸은 없어진다');
});

test('처음 장부 칸 — 뒤 장부(after 있음)가 와서 다시 지어도 값이 같으면 줄 차례를 올리지 않는다 · 장부가 둘이면 서버가 받은 차례로 맨 앞 하나', async () => {
  const make = maker('carry004');
  const server = createMemoryAccount();
  const one = firstLedger(make, 'ko.reading.one', 'famA');
  const two = firstLedger(make, 'ko.reading.two', 'famB'); // 다른 기기가 따로 옮긴 처음 장부
  server.append([one, two], T0 + 1e6);
  await foldAll(server);
  const built = await summaryNow(server);
  const seqBefore = server.heads.get(edition).carried.seq;
  assert.deepEqual(
    built.carried.skills.map(skill => skill.id),
    ['ko.reading.one'],
    '서버가 받은 차례로 맨 앞 하나',
  );
  server.append([laterLedger(make, one.at)], T0 + 2e6);
  await foldAll(server);
  const after = await summaryNow(server);
  assert.deepEqual(after.carried, built.carried, '뒤 장부는 칸을 바꾸지 않는다');
  assert.equal(
    server.heads.get(edition).carried.seq,
    seqBefore,
    '값이 같으면 칸의 차례를 올리지 않는다',
  );
  const partial = await summaryNow(server, {
    edition,
    seq: built.lineSeq,
    ...(built.gen ? { gen: built.gen } : {}),
  });
  assert.equal(Object.hasOwn(partial, 'carried'), false, '그 뒤 부분 답에 칸이 다시 실리지 않는다');
});

test('처음 장부 칸 — 머리를 다시 짓는 동안 내주는 옛 머리가 아직 안 지은 머리여도 읽기가 칸을 짓는다(설계 검토 Fable P2)', async () => {
  const make = maker('carry005');
  const server = createMemoryAccount();
  const ledger = firstLedger(make, 'ko.reading.detail');
  server.append([ledger, ...practice(make, 3)], T0 + 1e6);
  await foldAll(server);
  server.heads.get(edition).carried = { built: false, value: null, seq: 0 };
  const other = { ...PARAMS, editions: { ...PARAMS.editions, ability: 'ability-rebuild' } };
  const next = foldEdition(other, undefined);
  const result = await foldAccount(server.account, {
    memory: createMemory(other),
    params: other,
    nowMs: NOW,
    cap: 1,
  });
  assert.equal(result.building, next, '옆에 짓는 중');
  assert.equal(result.served, edition, '옛 머리를 내준다');
  const served = await summaryOf(server.account.store(edition), { edition });
  assert.deepEqual(served.carried, firstLedgerCells([ledger]), '내주는 옛 머리의 칸을 지었다');
});

test('기기의 요약 합치기 — 칸은 세 갈래(부분 답: 키 없음 그대로 · null 없앰 · 값 바꿈), 통째 답에 키가 없으면 칸이 없는 것으로 둔다', () => {
  const gen = '1794441600000.abcdefgh';
  const value = {
    at: '2026-11-01T00:00:00.000Z',
    skills: [{ id: 'ko.reading.detail', cells: [] }],
  };
  const other = { at: '2026-11-02T00:00:00.000Z', skills: [{ id: 'ko.reading.other', cells: [] }] };
  const delta = (seq, extra = {}) => ({
    edition,
    gen,
    full: false,
    foldedUntil: seq,
    lineSeq: seq,
    issued: [],
    lines: [],
    ...extra,
  });
  const base = applyDelta(null, delta(1, { full: true, carried: value }));
  assert.deepEqual(base.carried, value, '통째 답의 값');
  assert.deepEqual(applyDelta(base, delta(2)).carried, value, '부분 답에 키가 없으면 그대로');
  assert.equal(applyDelta(base, delta(2, { carried: null })).carried, null, 'null이면 없앤다');
  assert.deepEqual(applyDelta(base, delta(2, { carried: other })).carried, other, '값이면 바꾼다');
  assert.equal(
    applyDelta(base, delta(2, { full: true })).carried,
    null,
    '통째 답에 키가 없으면 칸이 없다',
  );
});
