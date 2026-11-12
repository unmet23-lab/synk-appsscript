// 손님 → 계정 옮기기의 경계(단계 4 계획 §18-5-3 — C1 · R5 · R6 · R11): 손님 저장소의 경계 표지(옮김 · 두기 · 로그아웃 · 있었음)와 기준
// 시각을 다 지난 것만 계정 Z로 고른다 — 로그아웃 뒤 다른 계정 · 「이 기기에만 두기」 뒤에 앞 사람의 손님 기록이 섞이지 않게.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { memory, PARAMS } from '../support/trail-sync.mjs';
import { bank, indexOf, rng, T0 } from '../support/trail-world.mjs';

const { openRecord, keyEdge } = await subject('record/log.mjs');
const { memoryPort } = await subject('record/port.mjs');
const { EVENT_TYPES } = await subject('record/events.mjs');
const { carriedFields } = await subject('record/carry.mjs');

const items = bank(rng(7));
const index = indexOf(items, 'index-a');
const presented = item => ({
  setId: 'set1',
  itemKey: item.itemKey,
  familyKey: item.familyKey,
  skillId: item.skillId,
  difficulty: 1,
  responseFormat: 'single-choice',
  modality: 'listening',
  audioRequired: false,
  confounded: false,
  units: item.units?.length ? item.units : ['u0'],
  firstExposure: true,
  editions: {
    params: 'params-1',
    memory: 'memory-1',
    ability: 'ability-1',
    select: 'select-1',
    index: 'index-a',
  },
  expected: { floor: 0.25, memory: 0.5, skill: 0.6 },
  arm: 'adaptive',
  reason: { code: 'unit.new', slots: {}, evidence: {}, target: 'u0', tier: 2, introduced: [] },
});
let clockMs = T0;
const guestOn = port =>
  openRecord({ port, guest: true, memory, params: PARAMS, index, now: () => clockMs });
async function practise(record, item) {
  clockMs += 60_000;
  const shown = record.add(EVENT_TYPES.presented, presented(item));
  await shown.stored;
  const made = record.add(EVENT_TYPES.attempted, {
    presentationId: shown.event.id,
    attemptNo: 1,
    verdict: 'correct',
    errorTags: [],
  });
  await made.stored;
  return made.event.id;
}
// 실제 흐름(move.mjs)처럼 꼬리부터 읽고 고른다 — 고르기는 읽은 자리까지만이다.
const planOf = async (record, revision, how) => {
  await record.refresh();
  return record.guestUpload(revision, how);
};
const answers = plan =>
  plan.current.filter(event => event.type === EVENT_TYPES.attempted).map(event => event.id);
// 옮김 표지 — move.mjs처럼 그때 실제로 옮긴 2판 사건 번호(ids)를 싣는다.
const moved = (record, account, plan, revision = 1) =>
  record.mark({
    mark: 'moved',
    account,
    revision,
    until: plan.until,
    ids: plan.current.map(event => event.id),
  });
const attempt = (record, presentationId, attemptNo, verdict) =>
  record.add(EVENT_TYPES.attempted, { presentationId, attemptNo, verdict, errorTags: [] });

test('열쇠 경계 — 자기 옮김 · 두기는 until, 남의 표지 · 로그아웃은 표지 열쇠, 자기 「있었음」은 뺀다(R6)', () => {
  const marks = [
    { key: 10, mark: 'moved', account: 'A', until: 7 },
    { key: 20, mark: 'visited', account: 'A' },
    { key: 30, mark: 'logout' },
    { key: 40, mark: 'kept', account: 'B', until: 35 },
  ];
  assert.equal(keyEdge(marks.slice(0, 2), 'A'), 7, '자기 옮김은 until · 자기 있었음은 뺀다');
  assert.equal(keyEdge(marks.slice(0, 2), 'B'), 20, '남의 표지는 표지 열쇠');
  assert.equal(keyEdge(marks.slice(0, 3), 'A'), 30, '로그아웃은 누구에게나 표지 열쇠');
  assert.equal(keyEdge(marks, 'B'), 35, '자기 두기의 until이 더 크다');
  assert.equal(keyEdge([], 'A'), 0);
});

test('손님 → A(옮김) → 로그아웃 → 손님 답 둘 → B에는 그 둘만(C1)', async () => {
  const port = memoryPort();
  const guest = await guestOn(port);
  await practise(guest, items[0]);
  await practise(guest, items[1]);
  const toA = await planOf(guest, 1, { account: 'A' });
  assert.equal(answers(toA).length, 2);
  assert.ok(
    toA.current.every(event => event.revision === 1),
    'A의 판으로 도장',
  );
  await guest.mark({ mark: 'moved', account: 'A', revision: 1, until: toA.until });
  await guest.mark({ mark: 'logout' });
  const later = [await practise(guest, items[2]), await practise(guest, items[3])];
  assert.deepEqual(answers(await planOf(guest, 1, { account: 'B' })), later);
  assert.deepEqual(
    answers(await planOf(guest, 1, { account: 'A' })),
    later,
    'A에게도 로그아웃 뒤의 것만 묻는다 — 이미 옮긴 것은 다시 묻지 않는다(로그아웃 뒤는 누구 것인지 몰라 물음으로)',
  );
});

test('A가 「이 기기에만 두기」를 고르면 B는 0건 · 비운 뒤 다시 로그인한 A에게도 옮긴 기록이 되살아나지 않는다(C1)', async () => {
  const kept = await guestOn(memoryPort());
  await practise(kept, items[0]);
  await kept.mark({
    mark: 'kept',
    account: 'A',
    until: (await planOf(kept, 0, { account: 'A' })).until,
  });
  assert.deepEqual(answers(await planOf(kept, 1, { account: 'B' })), []);
  const moved = await guestOn(memoryPort());
  await practise(moved, items[1]);
  const plan = await planOf(moved, 1, { account: 'A' });
  await moved.mark({ mark: 'moved', account: 'A', revision: 1, until: plan.until });
  assert.deepEqual(
    answers(await planOf(moved, 2, { account: 'A' })),
    [],
    '판이 올라도(비움) 다시 고르지 않는다',
  );
});

test('기준 시각 — 남이 다녀간 때보다 앞선 2판 묶음은 고르지 않고, 장부는 이 기기에 어떤 결정도 없을 때만 옮긴다(R5 · 결정 2)', async () => {
  const guest = await guestOn(memoryPort());
  await practise(guest, items[0]);
  const visitedAt = clockMs + 1;
  clockMs = visitedAt + 60_000;
  const after = await practise(guest, items[1]);
  assert.deepEqual(
    answers(await planOf(guest, 1, { account: 'B', watermarks: { others: visitedAt } })),
    [after],
  );
  const ledger = guest.add(
    EVENT_TYPES.carried,
    carriedFields({ keys: { [`family:${items[2].familyKey}`]: 1 }, cells: {} }),
  );
  assert.equal(await ledger.stored, true, '옮겨 온 장부');
  const carried = plan => plan.current.filter(event => event.type === EVENT_TYPES.carried).length;
  assert.equal(carried(await planOf(guest, 1, { account: 'B', watermarks: { all: 0 } })), 1);
  assert.equal(
    carried(await planOf(guest, 1, { account: 'B', watermarks: { all: visitedAt } })),
    0,
    '어느 계정의 결정 · 다녀감이라도 있으면 장부는 두고 간다',
  );
});

test('경계 뒤의 제외는 대상을 Z가 이미 옮겨 갔으면(옮김 표지의 ids) 함께 옮긴다 — 남에게는 가지 않는다(R11)', async () => {
  const guest = await guestOn(memoryPort());
  const target = await practise(guest, items[0]);
  const plan = await planOf(guest, 1, { account: 'A' });
  await moved(guest, 'A', plan);
  const excluded = guest.add(EVENT_TYPES.excluded, { targetId: target });
  await excluded.stored;
  const again = await planOf(guest, 1, { account: 'A' });
  assert.deepEqual(
    again.current.map(event => event.id),
    [excluded.event.id],
    'A에게는 제외만 다시 간다',
  );
  assert.deepEqual((await planOf(guest, 1, { account: 'B' })).current, [], 'B에게는 가지 않는다');
});

test('옮긴 제시에 뒤에 저장된 답(다른 탭 · 고른 뒤 저장)은 다음 옮기기에 Z로 간다 — 남에게도, 판이 오른(비운) Z에게도 가지 않는다(GPT 끝 판 GE1 · 카본 E1)', async () => {
  const guest = await guestOn(memoryPort());
  clockMs += 60_000;
  const shown = guest.add(EVENT_TYPES.presented, presented(items[0]));
  await shown.stored;
  await attempt(guest, shown.event.id, 1, 'incorrect').stored;
  const plan = await planOf(guest, 1, { account: 'A' });
  assert.equal(answers(plan).length, 1);
  await moved(guest, 'A', plan);
  const second = attempt(guest, shown.event.id, 2, 'correct');
  await second.stored;
  assert.deepEqual(
    answers(await planOf(guest, 1, { account: 'A' })),
    [second.event.id],
    '옮긴 제시의 뒤 답은 A에게 간다(제시는 다시 가지 않는다)',
  );
  assert.deepEqual(
    (await planOf(guest, 1, { account: 'A' })).current.map(event => event.id),
    [second.event.id],
  );
  assert.deepEqual(answers(await planOf(guest, 1, { account: 'B' })), [], 'B에게는 가지 않는다');
  assert.deepEqual(
    answers(await planOf(guest, 2, { account: 'A' })),
    [],
    '판이 오르면(비움) 앞 판에 옮긴 제시는 서버에 없다 — 뒤 답도 가지 않는다',
  );
});

test('로그아웃 앞 · 「이 기기에만 두기」로 둔 사건을 겨눈 제외는 Z가 그 뒤에 옮겼어도 Z에게 가지 않는다(카본 끝 판 E1)', async () => {
  const guest = await guestOn(memoryPort());
  const before = await practise(guest, items[0]);
  await guest.mark({ mark: 'logout' });
  await practise(guest, items[1]);
  const plan = await planOf(guest, 1, { account: 'Z' });
  assert.equal(answers(plan).length, 1, '로그아웃 뒤의 것만 옮긴다');
  await moved(guest, 'Z', plan);
  const excluded = guest.add(EVENT_TYPES.excluded, { targetId: before });
  await excluded.stored;
  assert.deepEqual(
    (await planOf(guest, 1, { account: 'Z' })).current,
    [],
    '누구 것인지 모르는 로그아웃 앞 사건의 제외는 Z에게 가지 않는다(Z의 until 안이어도)',
  );
  const kept = await guestOn(memoryPort());
  const keptAnswer = await practise(kept, items[2]);
  await kept.mark({
    mark: 'kept',
    account: 'Z',
    until: (await planOf(kept, 0, { account: 'Z' })).until,
  });
  await practise(kept, items[3]);
  const later = await planOf(kept, 1, { account: 'Z' });
  assert.equal(answers(later).length, 1, '두기 뒤의 것만 옮긴다');
  await moved(kept, 'Z', later);
  const drop = kept.add(EVENT_TYPES.excluded, { targetId: keptAnswer });
  await drop.stored;
  assert.deepEqual(
    (await planOf(kept, 1, { account: 'Z' })).current,
    [],
    '「이 기기에만 두기」로 둔 사건의 제외도 Z에게 가지 않는다',
  );
});

test('고르기는 읽은 자리까지만 — 꼬리를 읽기 전의 내 덧붙이기는 다음 계획 몫이고, 두 계획이 같은 사건을 두 번 고르지 않는다(until)', async () => {
  const guest = await guestOn(memoryPort());
  const mine = [await practise(guest, items[0]), await practise(guest, items[1])];
  // 꼬리를 읽지 않고 고른다 — 내 덧붙이기는 읽은 자리를 올리지 않으므로 이 계획의 until은 그 앞이다.
  const first = guest.guestUpload(1, { account: 'A' });
  await guest.mark({ mark: 'moved', account: 'A', revision: 1, until: first.until });
  const second = await planOf(guest, 1, { account: 'A' });
  assert.deepEqual(
    [...answers(first), ...answers(second)].sort(),
    [...mine].sort(),
    '두 계획을 합치면 꼭 한 번씩',
  );
  assert.equal(guest.marks().length, 1, '내 표지를 꼬리에서 다시 읽어도 한 번');
});

test('옛 꼴도 열쇠 경계 뒤의 것만 후보로 돌려준다 — Z에게 옮긴 뒤 · 로그아웃 뒤의 남에게는 다시 내지 않는다(C1)', async () => {
  const guest = await guestOn(memoryPort());
  const at = new Date(clockMs).toISOString();
  await guest.importLegacy([
    {
      schema: 1,
      id: 'legacy-p1',
      scope: { domain: 'LAB', workspace: 'learning', subject: 'device' },
      at,
      recordedAt: at,
      type: 'practice.presented',
    },
  ]);
  const plan = await planOf(guest, 1, { account: 'A' });
  assert.deepEqual(
    plan.legacy.map(event => event.id),
    ['legacy-p1'],
  );
  await guest.mark({ mark: 'moved', account: 'A', revision: 1, until: plan.until });
  assert.deepEqual((await planOf(guest, 1, { account: 'A' })).legacy, [], 'A에게 다시 내지 않는다');
  await guest.mark({ mark: 'logout' });
  assert.deepEqual((await planOf(guest, 1, { account: 'B' })).legacy, [], 'B에게도 가지 않는다');
});
