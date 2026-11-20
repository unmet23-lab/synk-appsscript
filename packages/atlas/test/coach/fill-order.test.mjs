// 채우기 차례(단계 4 계획 §23-14 · 설계 주인 11-20): 같은 날 이어 한 판이 앞 판과 같은 문장 · 같은 차례가 되지 않게, 채우기 줄(층 3 · 4)은
// 흐려진 정도(0.02 단위) → 가장 오래전에 만난 것(touched) → 진도 순 → 문항 열쇠다. 만난 때는 문항 단위들의 마지막 사건 시각(latestAt)과
// 이번 판에서 그 계열을 낸 시각 가운데 늦은 것이다. 씨앗을 쓰지 않는다. 규칙마다 tools/mutants/brain.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  choose,
  createLearner,
  createMemory,
  PARAMS,
  record,
  startSession,
  T0,
} from './support.mjs';

const MIN = 60_000;
const itemOf = (name, unit, order, family = `t.f.${name}`) =>
  Object.freeze({
    itemKey: `t.${name}`,
    familyKey: family,
    skillId: 'ko.reading.s0',
    difficulty: 1,
    responseFormat: 'single-choice',
    units: Object.freeze([`ko.word.${unit}`]),
    order,
    modality: 'reading',
  });
// 문항마다 제 단위 — 진도 순은 거꾸로 둔다(차례가 진도 순이 아니라 만난 때로 서는지 보려고).
const ITEMS = ['a', 'b', 'c', 'd'].map((name, i) => itemOf(name, `u${i}`, 10 - i));
const RIGHT = { correct: true, assessable: true };
const SKIP = { correct: null, assessable: false };

// 한 판에서 네 문항을 차례로 맞힌다(같은 날 · 1분 간격) — 네 단위가 모두 아는 것이 된다.
function learned() {
  const memory = createMemory(PARAMS);
  const learner = createLearner();
  startSession(learner, T0, PARAMS, { length: 12 });
  ITEMS.forEach((item, i) =>
    record(learner, memory, item, { ...RIGHT, presentationId: `p${i}` }, T0 + i * MIN, PARAMS),
  );
  return { memory, learner };
}
const fillOrder = rows =>
  rows.filter(row => row.tier === 3 || row.tier === 4).map(row => row.item.itemKey);

test('채우기 — 가장 오래전에 만난 문항부터(진도 순이 아니다), 씨앗을 바꿔도 같은 차례', () => {
  const { memory, learner } = learned();
  const at = T0 + 10 * MIN;
  startSession(learner, at, PARAMS, { length: 12 });
  const one = fillOrder(choose(ITEMS, learner, memory, at, { params: PARAMS, seed: 'one' }));
  const two = fillOrder(choose(ITEMS, learner, memory, at, { params: PARAMS, seed: 'two' }));
  assert.deepEqual(one, ['t.a', 't.b', 't.c', 't.d']);
  assert.deepEqual(two, one, '채우기는 씨앗을 쓰지 않는다');
});

test('채우기 — 같은 자리(6시간) 안의 뒤 답도 만난 때를 옮긴다(lastAt이 아니라 latestAt) — 이어 한 판의 차례가 돈다', () => {
  const { memory, learner } = learned();
  const unit = ITEMS[0].units[0];
  const first = learner.memory.get(unit);
  const at = T0 + 20 * MIN;
  startSession(learner, at, PARAMS, { length: 12 });
  record(learner, memory, ITEMS[0], { ...RIGHT, presentationId: 'again-a' }, at, PARAMS);
  const after = learner.memory.get(unit);
  assert.equal(after.lastAt, first.lastAt, '같은 자리의 뒤 답 — 자리의 첫 답 시각은 그대로');
  assert.ok(after.latestAt > first.latestAt, '마지막 사건 시각은 옮겨 간다');
  const next = at + 10 * MIN;
  startSession(learner, next, PARAMS, { length: 12 });
  assert.deepEqual(fillOrder(choose(ITEMS, learner, memory, next, { params: PARAMS })), [
    't.b',
    't.c',
    't.d',
    't.a',
  ]);
});

test('채우기 — 이번 판에서 낸 계열은 뒤로 가고, 앞 판에서 낸 자리는 보지 않는다(코치는 판마다 shown을 비운다 — 흉내도 같은 차례)', () => {
  const { memory, learner } = learned();
  const at = T0 + 30 * MIN;
  // 앞 판: 가장 오래된 a를 판정 못 한 답으로만 낸다 — 기억은 그대로이고 shown에만 남는다.
  startSession(learner, at, PARAMS, { length: 12 });
  record(learner, memory, ITEMS[0], { ...SKIP, presentationId: 'skip-a' }, at, PARAMS);
  const next = at + 10 * MIN;
  startSession(learner, next, PARAMS, { length: 12 });
  assert.equal(
    fillOrder(choose(ITEMS, learner, memory, next, { params: PARAMS }))[0],
    't.a',
    '앞 판의 자리는 보지 않는다',
  );
  // 이번 판: 같은 계열의 다른 문항(a2 — 단위가 같다)을 판정 못 한 답으로 낸 뒤, 다른 계열 둘을 지나 「방금 본 것」 창을 벗어나도 a는 뒤다.
  const sibling = itemOf('a2', 'u0', 11, ITEMS[0].familyKey);
  record(learner, memory, sibling, { ...SKIP, presentationId: 'skip-a2' }, next, PARAMS);
  const extra = [itemOf('x', 'u8', 20), itemOf('y', 'u9', 21)];
  extra.forEach((item, i) =>
    record(
      learner,
      memory,
      item,
      { ...RIGHT, presentationId: `x${i}` },
      next + (i + 1) * MIN,
      PARAMS,
    ),
  );
  const order = fillOrder(choose(ITEMS, learner, memory, next + 5 * MIN, { params: PARAMS }));
  assert.equal(order.at(-1), 't.a', `이번 판에 낸 계열은 맨 뒤 — ${order.join(' ')}`);
});

test('채우기 — 만난 때가 같으면 진도 순 → 문항 열쇠다(씨앗 여덟 모두 같은 차례)', () => {
  const memory = createMemory(PARAMS);
  const learner = createLearner();
  // 단위 하나를 나눠 가진 문항 셋 — 만난 때(그 단위의 마지막 사건 시각)가 같다.
  const shared = [itemOf('p', 'u5', 3), itemOf('q', 'u5', 1), itemOf('r', 'u5', 1)];
  startSession(learner, T0, PARAMS, { length: 12 });
  record(learner, memory, itemOf('seed', 'u5', 0), { ...RIGHT, presentationId: 's' }, T0, PARAMS);
  const at = T0 + 10 * MIN;
  startSession(learner, at, PARAMS, { length: 12 });
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    assert.deepEqual(
      fillOrder(choose(shared, learner, memory, at, { params: PARAMS, seed })),
      ['t.q', 't.r', 't.p'],
      seed,
    );
});
