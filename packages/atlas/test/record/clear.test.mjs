// 연습 기록 비우기의 기록부 몫(단계 4 계획 §22-4). 포트의 막이(지우기 세대 — 늦게 쓰는 탭), 다른 탭의 은퇴 알림, 손님 비우기, 계정 비우기의
// 넷째 걸음(그 계정으로 옮긴 사건 지우기)과 옛 로그의 바닥 · 옮긴 장부 칸을 본다. 규칙마다 tools/mutants/me.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { memory, PARAMS } from '../support/trail-sync.mjs';
import { bank, indexOf, rng, T0 } from '../support/trail-world.mjs';

const { openRecord } = await subject('record/log.mjs');
const { memoryPort, GEN_KEY } = await subject('record/port.mjs');
const { EVENT_TYPES } = await subject('record/events.mjs');
const { cellsGrew, cellsOf } = await subject('record/carry.mjs');

const items = bank(rng(11));
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
const guestOn = (port, more = {}) =>
  openRecord({ port, guest: true, memory, params: PARAMS, index, now: () => clockMs, ...more });
// 차례를 못 얻는 탭 — 손님 요약 저장을 늘 건너뛴다(§18-5-1 R1 · R2). 비운 탭의 요약 사본이 저장소에 없어도 다른 탭이 다시 읽은 뒤
// 스스로 접어 보기의 바탕을 세우는지 본다(비운 탭의 사본을 읽어 가면 그 접기가 빠져도 가려진다).
const busy = async () => {
  throw Object.assign(new Error('차례를 못 얻음'), { code: 'TURN_BUSY' });
};
// 제시 하나와 그 답 하나 — 두 사건 번호를 돌려준다.
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
  return [shown.event.id, made.event.id];
}
const kinds = async port => (await port.read()).map(row => row.value.kind);
const eventIds = async port =>
  (await port.read()).filter(row => row.value.kind === 'event').map(row => row.value.event.id);

test('포트의 막이 — 지우기 세대가 기대와 다르면 아무것도 바꾸지 않고 CLEARED, 같으면 지우기 · 세대 · 덧붙이기를 한 번에 한다', async () => {
  const port = memoryPort();
  const [a, b] = await port.append([{ kind: 'x' }, { kind: 'y' }]);
  await assert.rejects(
    port.swap({ expect: 1, append: [{ kind: 'z' }] }),
    error => error.code === 'CLEARED' && error.gen === 0,
  );
  assert.equal(port.size(), 2, '거절된 쓰기는 아무것도 남기지 않는다');
  const [c] = await port.swap({ expect: 0, gen: 1, remove: [a], append: [{ kind: 'z' }] });
  assert.deepEqual(
    (await port.read()).map(row => row.key),
    [GEN_KEY, b, c],
    '세대가 오르면 읽기의 맨 앞에 머리 기록이 선다',
  );
  assert.deepEqual(
    (await port.range(0)).map(row => row.key),
    [b, c],
    '꼬리 읽기는 머리 기록을 내지 않는다(다른 탭은 비움 표지로 안다)',
  );
  const [d] = await port.swap({ expect: 1, gen: 2, removeAll: true, append: [{ kind: 'w' }] });
  assert.deepEqual(
    (await port.read()).map(row => [row.key, row.value]),
    [
      [GEN_KEY, { kind: 'gen', gen: 2 }],
      [d, { kind: 'w' }],
    ],
  );
  assert.ok(d > c, '비워도 열쇠 번호는 이어진다');
});

test('포트의 막이 — 덧붙이기에 세대(expect)를 주면 그 세대일 때만 쓰고, 주지 않으면 막이 없이 쓴다', async () => {
  const port = memoryPort();
  await port.swap({ expect: 0, gen: 3, append: [] });
  await assert.rejects(
    port.append([{ kind: 'v' }], { expect: 2 }),
    error => error.code === 'CLEARED' && error.gen === 3,
  );
  assert.equal(port.size(), 0, '거절된 덧붙이기는 아무것도 남기지 않는다');
  assert.equal((await port.append([{ kind: 'v' }], { expect: 3 })).length, 1);
  assert.equal((await port.append([{ kind: 'w' }])).length, 1, '세대를 모르는 쓰기(옛 꼴 호출)');
});

test('손님 비우기 — 사건 · 요약 사본 · 옮기기 표지를 한 트랜잭션으로 지우고 비움 표지(세대 · 바닥)를 남긴다. 다시 연 기록부도 빈 기록이다', async () => {
  const port = memoryPort();
  const selfTold = [];
  const record = await guestOn(port, { onCleared: gen => selfTold.push(gen) });
  await practise(record, items[0]);
  await record.mark({ mark: 'visited', account: 'Z' });
  await record.refold();
  await record.localSaved();
  assert.ok((await kinds(port)).includes('local'), '요약 사본이 있다');
  const done = await record.clear({ legacy: { epoch: 'e1' } });
  assert.equal(done.gen, 1);
  await record.localSaved();
  const left = await kinds(port);
  assert.deepEqual(left.slice(0, 2), ['gen', 'cleared'], '머리 기록과 비움 표지');
  // 빈 배열의 every는 늘 참이다 — 빈 요약 사본이 실제로 섰는지 길이도 본다(4-5 끝 판 카본 F1).
  assert.ok(
    left.length > 2 && left.slice(2).every(kind => kind === 'local'),
    '사건 · 표지는 모두 지워지고, 빈 요약 사본만 새로 선다',
  );
  const cleared = record.cleared();
  assert.deepEqual(
    cleared,
    { gen: 1, at: cleared.at, legacy: { epoch: 'e1', at: cleared.at }, carried: null },
    '바닥 시각은 비운 시각',
  );
  assert.equal(record.heldEvents().length, 0);
  assert.equal(record.marks().length, 0);
  assert.notEqual(record.view().waitAll, true, '비운 뒤 보기의 바탕(빈 요약)이 바로 선다');
  await record.refresh();
  assert.deepEqual(
    selfTold,
    [],
    '스스로 비운 세대는 셸에 알리지 않는다(같은 문서는 입구가 은퇴시킨다)',
  );
  const again = await guestOn(port);
  assert.equal(again.heldEvents().length, 0, '다시 연 기록부도 빈 기록이다');
  assert.equal(again.cleared().gen, 1);
  // 비운 뒤 쓰기는 새 세대로 된다.
  await practise(again, items[1]);
  assert.equal((await eventIds(port)).length, 2);
});

test('늦게 쓰는 탭 — 다른 탭이 비운 뒤 앞 세대로 쓰는 답은 저장되지 않고, 기록부는 통째로 다시 읽고 셸에 한 번 알린다', async () => {
  const port = memoryPort();
  const told = [];
  const late = await guestOn(port, { onCleared: gen => told.push(gen) });
  const [shown] = await practise(late, items[0]);
  const other = await guestOn(port, { exclusive: busy });
  await other.clear();
  // 비운 탭은 새 세대로 바로 이어 푼다(items[2]는 items[0] · items[1]과 다른 계열이다).
  const after = await practise(other, items[2]);
  // 늦은 탭은 아직 비움을 모른다 — 그 제시에 이어 쓰는 답은 막이에 걸린다.
  const made = late.add(EVENT_TYPES.attempted, {
    presentationId: shown,
    attemptNo: 2,
    verdict: 'correct',
    errorTags: [],
  });
  assert.equal(await made.stored, false, '지워진 제시에 답을 이어 쓰지 않는다');
  assert.deepEqual(await eventIds(port), after, '저장소에는 비운 뒤 다른 탭이 쓴 기록만 있다');
  assert.deepEqual(told, [1], '셸에 한 번 알린다');
  assert.deepEqual(
    late.heldEvents().map(event => event.id),
    after,
    '메모리 사본을 버리고 다시 읽었다',
  );
  const seen = late.view();
  assert.notEqual(seen.waitAll, true, '다시 읽은 뒤 손님 요약을 그 자리에서 접었다');
  assert.ok(late.summary, '보기의 바탕(손님 요약)이 비지 않는다');
  assert.ok(seen.met.has(items[2].familyKey), '비운 뒤 다른 탭이 쓴 기록이 보기에 선다');
  // 다시 읽은 뒤의 쓰기는 새 세대로 된다.
  await practise(late, items[1]);
  assert.equal((await eventIds(port)).length, 4);
  assert.deepEqual(told, [1], '같은 세대로 또 알리지 않는다');
});

test('다른 탭의 은퇴 알림 — 꼬리에서 새 세대의 비움 표지를 만나면 다시 읽고 알린다. 같은 세대의 바닥 고침은 알리지 않는다', async () => {
  const port = memoryPort();
  const told = [];
  const watcher = await guestOn(port, { onCleared: gen => told.push(gen) });
  await practise(watcher, items[0]);
  const other = await guestOn(port, { exclusive: busy });
  await other.clear({ legacy: { epoch: 'e1' } });
  const after = await practise(other, items[2]);
  await watcher.refresh();
  assert.deepEqual(told, [1]);
  assert.deepEqual(
    watcher.heldEvents().map(event => event.id),
    after,
    '지워진 사건을 들고 있지 않다',
  );
  const seen = watcher.view();
  assert.notEqual(seen.waitAll, true, '다시 읽은 뒤 손님 요약을 그 자리에서 접었다');
  assert.ok(watcher.summary, '보기의 바탕(손님 요약)이 비지 않는다');
  assert.ok(seen.met.has(items[2].familyKey), '비운 뒤 다른 탭이 쓴 기록이 보기에 선다');
  assert.equal(watcher.cleared().legacy.epoch, 'e1');
  assert.equal(
    await other.liftFloor(other.generation() - 1),
    false,
    '앞 세대의 비우기는 지금 세대의 바닥을 걷지 않는다(4-5 코드 검수 GPT)',
  );
  assert.equal(other.cleared().legacy.epoch, 'e1', '바닥이 그대로다');
  assert.equal(await other.liftFloor(other.generation()), true);
  await watcher.refresh();
  assert.deepEqual(told, [1], '바닥을 거둔 표지는 같은 세대다 — 은퇴시키지 않는다');
  assert.equal(watcher.cleared().legacy, null);
});

test('계정 비우기의 넷째 걸음 — 그 계정의 옮김 표지 모두(판과 상관없이)의 사건과 그것에 기댄 사건, 요약 사본을 지운다. 표지와 남의 사건은 둔다', async () => {
  const port = memoryPort();
  const record = await guestOn(port);
  const [p1, a1] = await practise(record, items[0]);
  await record.mark({ mark: 'moved', account: 'Z', revision: 1, until: 99, ids: [p1, a1] });
  const [p2, a2] = await practise(record, items[1]);
  // a2를 겨눈 제외 — 옮긴 제시 p2 → 답 a2 → 그 답을 뺀 제외로 두 단계 이어진 사건이다(4-5 코드 검수 GPT GC2 — 지운 자식의 번호를 다음 부모
  // 검사에 넘기지 않으면 남는다).
  await record.add('record.excluded', { targetId: a2 }).stored;
  await record.mark({ mark: 'moved', account: 'Z', revision: 2, until: 99, ids: [p2] });
  // a2는 옮김 표지에 없지만 옮긴 제시 p2에 기댄 답이다 — 남기면 부모 없는 답이 된다.
  await record.mark({ mark: 'logout' });
  const [p3, a3] = await practise(record, items[2]); // 로그아웃 뒤 손님의 사건
  const [p4, a4] = await practise(record, items[3]);
  await record.mark({ mark: 'moved', account: 'Y', revision: 1, until: 99, ids: [p4, a4] }); // 남의 계정
  await record.refold();
  await record.localSaved();
  const localBefore = (await port.read())
    .filter(row => row.value.kind === 'local')
    .map(row => row.key);
  const told = [];
  const watcher = await guestOn(port, { onCleared: gen => told.push(gen) });
  const done = await record.dropMoved({ account: 'Z' });
  assert.deepEqual(done, { gen: 1, dropped: 5 });
  const keysAfter = new Set((await port.read()).map(row => row.key));
  assert.ok(
    localBefore.length > 0 && localBefore.every(key => !keysAfter.has(key)),
    '앞 요약 사본을 같은 트랜잭션에서 지웠다',
  );
  assert.deepEqual(
    await eventIds(port),
    [p3, a3, p4, a4],
    '로그아웃 뒤 사건과 남의 계정으로 옮긴 사건은 둔다',
  );
  assert.equal(
    record.marks().filter(mark => mark.mark === 'moved').length,
    3,
    '옮김 표지는 둔다(옛 기록 옮기기가 그 번호를 「이미 있음」으로 본다)',
  );
  await watcher.refresh();
  assert.deepEqual(told, [1], '다른 탭도 은퇴한다');
  assert.deepEqual(
    await record.dropMoved({ account: 'Z' }),
    { gen: 1, dropped: 0 },
    '지울 것이 없으면 쓰지 않는다',
  );
  for (const id of [a2]) assert.equal(record.has(id), false);
});

test('넷째 걸음의 판 경계 — 그 비우기가 올린 새 판(before)보다 앞선 판의 옮김 표지와 판 없는 옛 표지만 센다. 비운 뒤 그 계정으로 새로 옮긴 사건과 그 자식은 둔다(4-5 Opus 대체 설계 검토 F5)', async () => {
  const port = memoryPort();
  const record = await guestOn(port);
  const [p1, a1] = await practise(record, items[0]);
  await record.mark({ mark: 'moved', account: 'Z', revision: 1, until: 99, ids: [p1, a1] }); // 비우기 전 판으로 옮긴 것
  const [p0, a0] = await practise(record, items[3]);
  await record.mark({ mark: 'moved', account: 'Z', until: 99, ids: [p0] }); // 판이 없는 옛 표지 — 센다(답 a0은 그 제시에 기대어 함께 간다)
  const [p2, a2] = await practise(record, items[1]);
  await record.mark({ mark: 'moved', account: 'Z', revision: 2, until: 99, ids: [p2, a2] }); // 비운 뒤 새 판으로 옮긴 것
  const [p3, a3] = await practise(record, items[2]);
  await record.mark({ mark: 'moved', account: 'Z', revision: 3, until: 99, ids: [p3, a3] }); // 경계보다 큰 판(4-5 끝 판 GPT GF3)
  // 비운 뒤 옮긴 제시에 손님이 뒤에 단 답(옮기지 않은 자식)
  const late = record.add(EVENT_TYPES.attempted, {
    presentationId: p2,
    attemptNo: 2,
    verdict: 'correct',
    errorTags: [],
  });
  await late.stored;
  const done = await record.dropMoved({ account: 'Z', before: 2 });
  assert.equal(done.dropped, 4, '판 1과 판 없는 표지의 사건(과 그 자식)만 지운다');
  const left = await eventIds(port);
  for (const id of [p2, a2, late.event.id, p3, a3])
    assert.ok(left.includes(id), `비운 뒤 옮긴 사건과 그 자식은 둔다 — ${id}`);
  for (const id of [p1, a1, p0, a0])
    assert.equal(left.includes(id), false, `앞 판으로 옮긴 사건은 지운다 — ${id}`);
});

test('넷째 걸음은 지울 사건을 비우는 트랜잭션 안에서 고른다 — 고른 뒤 다른 탭이 옮긴 제시에 이어 단 답도 함께 지워 부모 없는 답이 남지 않는다(4-5 코드 검수 GPT GB1)', async () => {
  const port = memoryPort();
  const other = await guestOn(port, { exclusive: busy });
  const [p1, a1] = await practise(other, items[0]);
  // 비우는 탭 — 비우기 트랜잭션에 들어가기 바로 앞에서 다른 탭이 같은 제시에 둘째 답을 단다(앞 판은 읽기와 지우기 사이에 이 답이 끼었다).
  let before = null;
  const gated = {
    ...port,
    async swap(options) {
      const hook = before;
      before = null;
      await hook?.();
      return port.swap(options);
    },
  };
  const record = await guestOn(gated, { exclusive: busy });
  await record.mark({ mark: 'moved', account: 'Z', revision: 1, until: 99, ids: [p1, a1] });
  let late = null;
  before = async () => {
    const made = other.add(EVENT_TYPES.attempted, {
      presentationId: p1,
      attemptNo: 2,
      verdict: 'correct',
      errorTags: [],
    });
    assert.equal(await made.stored, true, '다른 탭의 답은 비우기 전 세대로 저장된다');
    late = made.event.id;
  };
  const done = await record.dropMoved({ account: 'Z' });
  assert.ok(late, '비우기 트랜잭션 앞에서 다른 탭이 답을 달았다');
  assert.deepEqual(done, { gen: 1, dropped: 3 }, '옮긴 제시와 그 답 둘을 지운다');
  assert.deepEqual(await eventIds(port), [], '부모 없는 답이 남지 않는다');
});

test('늦게 쓰는 탭 — 부모 제시의 저장을 기다리던 답은 그 답을 만든 때의 세대로 쓴다. 기다리는 사이 다른 탭이 비우고 이 탭이 새 세대를 읽었어도 새 세대에 쓰지 않는다(4-5 코드 검수 GPT GB2)', async () => {
  const port = memoryPort();
  // 제시는 저장소에 쓰였지만 그 쓰기의 답이 이 탭에 늦게 닿는다.
  let hold = null;
  const gated = {
    ...port,
    async append(values, options) {
      const keys = await port.append(values, options);
      if (hold) await hold;
      return keys;
    },
  };
  const late = await guestOn(gated, { exclusive: busy });
  let release = null;
  hold = new Promise(resolve => {
    release = resolve;
  });
  clockMs += 60_000;
  const shown = late.add(EVENT_TYPES.presented, presented(items[0]));
  const made = late.add(EVENT_TYPES.attempted, {
    presentationId: shown.event.id,
    attemptNo: 1,
    verdict: 'correct',
    errorTags: [],
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  hold = null;
  assert.deepEqual(await eventIds(port), [shown.event.id], '제시는 비우기 전 세대로 쓰였다');
  const other = await guestOn(port, { exclusive: busy });
  await other.clear();
  await late.refresh(); // 이 탭이 새 세대를 읽었다 — 답은 아직 부모의 저장을 기다린다
  assert.equal(late.generation(), 1);
  release();
  assert.equal(await made.stored, false, '지워진 제시의 답을 새 세대에 쓰지 않는다');
  assert.deepEqual(await eventIds(port), [], '저장소에 부모 없는 답이 없다');
});

test('늦게 쓰는 탭 — 저장된 부모가 비우기로 지워진 뒤 이 탭이 새 세대를 읽고 만든 자식은 쓰지 않는다. 같은 탭이 스스로 비운 뒤에도 같다(4-5 끝 판 카본 D1)', async () => {
  // 다른 탭이 비웠다 — 제시는 앞 세대에 저장됐고, 이 탭은 꼬리를 읽어 새 세대를 안 뒤에 그 제시의 답을 만든다.
  const port = memoryPort();
  const late = await guestOn(port, { exclusive: busy });
  const [shown] = await practise(late, items[0]);
  const other = await guestOn(port, { exclusive: busy });
  await other.clear();
  await late.refresh();
  assert.equal(late.generation(), 1);
  const made = late.add(EVENT_TYPES.attempted, {
    presentationId: shown,
    attemptNo: 2,
    verdict: 'correct',
    errorTags: [],
  });
  assert.equal(await made.stored, false, '지워진 제시의 답을 새 세대에 쓰지 않는다');
  assert.deepEqual(await eventIds(port), [], '저장소에 부모 없는 답이 없다');
  // 같은 탭 — 스스로 비운 뒤(옛 엔진 비우기를 기다리는 사이) 열린 판이 앞 제시에 답한다.
  const own = memoryPort();
  const self = await guestOn(own, { exclusive: busy });
  const [before] = await practise(self, items[1]);
  await self.clear();
  const after = self.add(EVENT_TYPES.attempted, {
    presentationId: before,
    attemptNo: 2,
    verdict: 'correct',
    errorTags: [],
  });
  assert.equal(await after.stored, false, '스스로 비운 뒤에도 지운 제시에 답을 잇지 않는다');
  assert.deepEqual(await eventIds(own), []);
  // 새 세대에 만든 제시의 답은 그대로 쓴다.
  assert.equal((await practise(self, items[2])).length, 2);
  assert.equal((await eventIds(own)).length, 2);
});

test('늦게 쓰는 탭 — 다른 탭의 제시에 이 탭이 단 앞 답이 비우기로 지워졌으면 뒤 답도 새 세대에 쓰지 않는다(카본 D1의 앞 답 갈래)', async () => {
  const port = memoryPort();
  const owner = await guestOn(port, { exclusive: busy });
  clockMs += 60_000;
  const shown = owner.add(EVENT_TYPES.presented, presented(items[0]));
  await shown.stored;
  const late = await guestOn(port, { exclusive: busy });
  const first = late.add(EVENT_TYPES.attempted, {
    presentationId: shown.event.id,
    attemptNo: 1,
    verdict: 'incorrect',
    errorTags: [],
  });
  assert.equal(await first.stored, true, '다른 탭의 제시에 단 첫 답');
  await owner.clear();
  await late.refresh();
  assert.equal(late.generation(), 1);
  const second = late.add(EVENT_TYPES.attempted, {
    presentationId: shown.event.id,
    attemptNo: 2,
    verdict: 'correct',
    errorTags: [],
  });
  assert.equal(await second.stored, false, '앞 답이 지워진 뒤의 답은 쓰지 않는다');
  assert.deepEqual(await eventIds(port), []);
});

test('늦게 쓰는 탭 — 막이에 걸려 다시 읽다가 읽기가 실패해도 막이가 준 세대로 셸에 한 번 알리고, 다음 꼬리 읽기가 통째로 다시 읽는다(4-5 끝 판 카본 D4)', async () => {
  const port = memoryPort();
  let failRead = false;
  const flaky = {
    ...port,
    async read(...args) {
      if (failRead) {
        failRead = false;
        throw Object.assign(new Error('읽기 실패'), { code: 'READ_FAILED' });
      }
      return port.read(...args);
    },
  };
  const told = [];
  const late = await guestOn(flaky, { exclusive: busy, onCleared: gen => told.push(gen) });
  const [shown] = await practise(late, items[0]);
  const other = await guestOn(port, { exclusive: busy });
  await other.clear();
  const after = await practise(other, items[2]);
  failRead = true;
  const made = late.add(EVENT_TYPES.attempted, {
    presentationId: shown,
    attemptNo: 2,
    verdict: 'correct',
    errorTags: [],
  });
  assert.equal(await made.stored, false, '막이에 걸린 답');
  assert.deepEqual(told, [1], '다시 읽기가 실패해도 은퇴 알림은 간다');
  await late.refresh();
  assert.deepEqual(
    late.heldEvents().map(event => event.id),
    after,
    '다음 꼬리 읽기가 통째로 다시 읽어 지워진 사건을 들지 않는다',
  );
  assert.deepEqual(told, [1], '같은 세대로 또 알리지 않는다');
});

test('늦게 쓰는 탭 — 차례를 기다리던 손님 요약 저장은 그 요약을 접은 세대로 쓴다. 기다리는 사이 다른 탭이 비웠으면 지워진 기록의 요약을 새 세대에 쓰지 않는다(GB2와 같은 꼴)', async () => {
  const port = memoryPort();
  let open = null;
  const gate = new Promise(resolve => {
    open = resolve;
  });
  // 차례 — 처음에는 바로 준다. 막은 뒤에는 첫 청을 문이 열릴 때까지 세우고, 그 뒤 청은 못 얻는다(뒤 저장이 늦은 요약을 덮지 못하게).
  let gated = false;
  let asked = 0;
  const exclusive = (_job, work) => {
    if (!gated) return work();
    asked += 1;
    return asked === 1 ? gate.then(work) : busy();
  };
  const late = await guestOn(port, { exclusive });
  await practise(late, items[0]);
  await late.refold();
  await late.localSaved();
  gated = true;
  await practise(late, items[2]);
  const folding = late.refold(); // 두 계열을 접은 요약의 저장이 차례를 기다린다
  await new Promise(resolve => setTimeout(resolve, 0));
  const other = await guestOn(port, { exclusive: busy });
  await other.clear();
  await late.refresh();
  open();
  await folding.catch(() => {});
  await late.localSaved();
  assert.equal(asked >= 1, true, '요약 저장이 차례를 기다렸다');
  const fresh = await guestOn(port, { exclusive: busy });
  assert.equal(
    fresh.view().met.has(items[0].familyKey),
    false,
    '비우기 전 기록을 접은 요약이 새 세대에 들지 않았다',
  );
});

test('늦게 쓰는 탭 — 앞 요약을 저장하는 사이 새로 접은 요약은 접은 때의 세대로 쓴다. 그사이 다른 탭이 비우고 이 탭이 새 세대 표지만 읽었어도 비우기 전 요약을 새 세대에 쓰지 않는다(4-5 코드 다시 검수 GPT GA8)', async () => {
  const port = memoryPort();
  // 요약 쓰기를 저장소에 쓴 뒤 답만 붙잡는 문과, 통째로 다시 읽기(read)를 붙잡는 문.
  let holdLocal = null;
  let holdRead = null;
  const gated = {
    ...port,
    async append(values, options) {
      const keys = await port.append(values, options);
      if (holdLocal && values.some(value => value?.kind === 'local')) await holdLocal;
      return keys;
    },
    async read() {
      if (holdRead) await holdRead;
      return port.read();
    },
  };
  const late = await guestOn(gated, { exclusive: (_job, work) => work() });
  await practise(late, items[0]);
  await late.refold();
  await late.localSaved();
  let releaseLocal = null;
  holdLocal = new Promise(resolve => {
    releaseLocal = resolve;
  });
  await practise(late, items[2]);
  const first = late.refold(); // 앞 요약의 저장이 저장소에 쓴 뒤 답을 기다린다
  await new Promise(resolve => setTimeout(resolve, 0));
  await practise(late, items[3]);
  const second = late.refold(); // 앞 저장이 끝나기를 기다리는 새 요약(접은 세대 0)
  await new Promise(resolve => setTimeout(resolve, 0));
  const other = await guestOn(port, { exclusive: busy });
  await other.clear();
  let releaseRead = null;
  holdRead = new Promise(resolve => {
    releaseRead = resolve;
  });
  const refreshing = late.refresh(); // 꼬리에서 새 세대의 비움 표지를 읽고, 통째로 다시 읽기는 붙잡힌다
  for (let i = 0; i < 50 && late.generation() !== 1; i += 1)
    await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(late.generation(), 1, '이 탭이 새 세대 표지를 읽었다');
  holdLocal = null;
  releaseLocal(); // 앞 저장이 끝나고, 기다리던 새 요약의 저장이 이어진다(다시 읽기는 아직 붙잡혀 있다)
  for (let i = 0; i < 20; i += 1) await new Promise(resolve => setTimeout(resolve, 0));
  holdRead = null;
  releaseRead(); // 막이에 걸린 저장은 다시 읽은 뒤 거절로 끝난다
  await refreshing.catch(() => {});
  await late.localSaved();
  await Promise.allSettled([first, second]);
  const fresh = await guestOn(port, { exclusive: busy });
  assert.equal(
    fresh.view().met.has(items[0].familyKey) || fresh.view().met.has(items[3].familyKey),
    false,
    '비우기 전 기록을 접은 요약이 새 세대에 들지 않았다',
  );
});

test('옮긴 장부 칸 — 넷째 걸음이 지운 「옮겨 오기 전 기록」의 계열 · 문항과 옮긴 때를 비움 표지에 남기고, 앞 표지의 바닥은 잇는다', async () => {
  const port = memoryPort();
  const record = await guestOn(port);
  await record.clear({ legacy: { epoch: 'e1' } });
  const floor = record.cleared().legacy;
  clockMs += 60_000;
  const ledger = record.add(EVENT_TYPES.carried, {
    families: { 'f.a': 1, 'f.b': 1 },
    items: { 'i.a': 1 },
    after: null,
    cells: [],
  });
  await ledger.stored;
  await record.mark({
    mark: 'moved',
    account: 'Z',
    revision: 3,
    until: 99,
    ids: [ledger.event.id],
  });
  const done = await record.dropMoved({ account: 'Z' });
  assert.equal(done.dropped, 1);
  const cleared = record.cleared();
  assert.equal(cleared.gen, 2);
  assert.deepEqual(cleared.legacy, floor, '이 걸음은 바닥을 새로 두지 않고 앞 것을 잇는다');
  assert.deepEqual(
    cleared.carried,
    {
      families: ['f.a', 'f.b'],
      items: ['i.a'],
      last: ledger.event.at,
      cells: [],
    },
    '처음 옮긴 장부의 칸도 남긴다 — 넷째 걸음 뒤의 4b가 칸이 자랐는지 견준다(F6)',
  );
});

test('옛 장부의 칸이 처음 옮긴 때보다 자랐나(cellsGrew) — 접힌 답 수가 늘었거나, 수는 그대로여도(최근 12개) 가장 늦은 답의 때가 뒤로 갔으면 자란 것이다. 처음 칸을 모르는데 칸이 있으면 자란 것으로 본다(4-5 Opus 대체 설계 검토 F6)', () => {
  const cell = (answers, helped = []) => ({
    'ko.reading.s0|1|single-choice': { ind: answers, helped },
  });
  // 도움받은 답만 는 장부 — 가장 늦은 때(20)보다 이른 답(15)이라 수만 신호다(4-5 끝 판 GPT GF4).
  assert.equal(
    cellsGrew(
      cell(
        [
          ['x', 10, 'correct'],
          ['y', 20, 'correct'],
        ],
        [['h', 15]],
      ),
      cellsOf(
        cell([
          ['x', 10, 'correct'],
          ['y', 20, 'correct'],
        ]),
      ),
    ),
    true,
    '도움받은 답이 늘어도 자란 것이다',
  );
  const base = cellsOf(
    cell([
      ['x', 10, 'correct'],
      ['y', 20, 'correct'],
    ]),
  );
  assert.equal(
    cellsGrew(
      cell([
        ['x', 10, 'correct'],
        ['y', 20, 'correct'],
      ]),
      base,
    ),
    false,
    '그대로',
  );
  assert.equal(
    cellsGrew(
      cell([
        ['x', 10, 'correct'],
        ['y', 20, 'correct'],
        ['z', 30, 'correct'],
      ]),
      base,
    ),
    true,
    '수가 늘었다',
  );
  assert.equal(
    cellsGrew(
      cell([
        ['y', 20, 'correct'],
        ['z', 30, 'correct'],
      ]),
      base,
    ),
    true,
    '수는 그대로지만 새 답이 들었다(가장 늦은 때가 뒤로)',
  );
  assert.equal(
    cellsGrew(
      {
        ...cell([['x', 10, 'correct']]),
        'ko.reading.s1|2|single-choice': { ind: [['w', 5, 'correct']], helped: [] },
      },
      cellsOf(cell([['x', 10, 'correct']])),
    ),
    true,
    '새 칸',
  );
  assert.equal(cellsGrew(cell([['x', 10, 'correct']]), null), true, '처음 칸을 모른다');
  assert.equal(cellsGrew({}, null), false, '칸이 없다');
});

test('늦게 쓰는 탭 — 막이에 걸려 다시 읽는 사이 다른 탭이 또 비우면 그 세대를 다시 읽은 뒤에만 손님 요약을 접는다. 두 번째 비우기로 지운 기록이 요약 사본으로 되살아나지 않는다(4-5 끝 판 GPT GD2)', async () => {
  const port = memoryPort();
  let between = null;
  const racing = {
    ...port,
    async read(...args) {
      const rows = await port.read(...args);
      if (between) {
        const run = between;
        between = null;
        await run();
      }
      return rows;
    },
  };
  const told = [];
  const late = await guestOn(racing, { onCleared: gen => told.push(gen) });
  const [shown] = await practise(late, items[0]);
  await late.localSaved();
  const other = await guestOn(port, { exclusive: busy });
  await other.clear();
  await practise(other, items[2]); // 첫 비우기 뒤의 기록 — 두 번째 비우기가 지운다
  between = () => other.clear();
  const made = late.add(EVENT_TYPES.attempted, {
    presentationId: shown,
    attemptNo: 2,
    verdict: 'correct',
    errorTags: [],
  });
  assert.equal(await made.stored, false, '막이에 걸린 답');
  await late.localSaved();
  assert.equal(late.generation(), 2, '두 번째 비우기의 세대까지 읽었다');
  assert.deepEqual(late.heldEvents(), [], '지운 세대의 사건을 들지 않는다');
  assert.deepEqual(told, [2]);
  const fresh = await guestOn(port, { exclusive: busy });
  assert.equal(
    fresh.view().met.has(items[2].familyKey),
    false,
    '새로 연 기록부의 보기에 두 번째 비우기로 지운 기록이 없다(요약 사본으로 되살아나지 않는다)',
  );
});

test('늦게 쓰는 탭 — 비움 표지를 읽고 세대가 오른 뒤 열린 판이 앞 세대의 마침에 남기는 판 응답은 쓰지 않는다(4-5 끝 판 GPT GD3 — 카본 D1과 같은 막이)', async () => {
  const port = memoryPort();
  const late = await guestOn(port, { exclusive: busy });
  const decided = late.add(EVENT_TYPES.setDecided, {
    experienceId: 'world-practice',
    variant: 'short',
  });
  await decided.stored;
  const completed = late.add(EVENT_TYPES.setCompleted, {
    decisionId: decided.event.id,
    experienceId: 'world-practice',
    variant: 'short',
  });
  assert.equal(await completed.stored, true);
  const other = await guestOn(port, { exclusive: busy });
  await other.clear();
  await late.refresh();
  assert.equal(late.generation(), 1);
  const given = late.add(EVENT_TYPES.feedback, {
    completionId: completed.event.id,
    value: 'want_more',
  });
  assert.equal(await given.stored, false, '지워진 마침을 가리키는 판 응답을 새 세대에 쓰지 않는다');
  assert.equal((await eventIds(port)).length, 0, '저장소에 부모 없는 판 응답이 없다');
});
