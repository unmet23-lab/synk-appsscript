// items(문항 난도 단계)의 새 뜻(단계 4 계획 §23-4 · 설계 주인 승인): 새 엔진에서는 두뇌가 문항 난도를 고르므로 items는 손잡이가 아니다.
//   · Flow는 items 단계를 바꾸지 않는다 — 그 단계의 올림 · 내림과 안내 줄(「조금 더 까다로운 주문도 들어와요」)이 없다.
//   · observe({ level })로 받은 낸 문항의 난도는 관찰 칸이다 — 기대 성공률의 내용 몫에 items.weight로 들고, 관찰 전에는 items.start다.
//   · 손잡이가 items뿐인 내용은 순간 맞춤이 없다(adaptive 거짓 · start.none · 줄 없음).
//   · 옛 내용 기억에 문항 난도 칸(ITEM)이 있어도 그 칸만 빼고 씨앗으로 읽는다.
// 옛 판과 맞대는 곳은 「옛 판은 그렇게 했다」를 함께 단언해 차이가 의도한 것임을 보인다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Flow, later, legacy, NOW, seeded } from './legacy.mjs';

const Old = legacy('flow.js');
// 주문 폭주(experiences/order-rush/learning.mjs)의 내용 정의와 줄을 그대로 옮겨 적었다.
const FLOW_RUSH = {
  id: 'order-rush.rush',
  version: 1,
  target: 0.75,
  items: { levels: [1, 2, 3], weight: 2 },
  knobs: [
    {
      id: 'patience',
      kind: 'pace',
      label: '손님이 기다리는 시간',
      values: [60, 54, 48, 42, 36, 30],
      start: 3,
    },
    {
      id: 'spawnEvery',
      kind: 'pace',
      label: '손님이 오는 간격',
      values: [15, 13, 11, 10, 8, 7],
      start: 3,
    },
    {
      id: 'queueMax',
      kind: 'pace',
      label: '한 번에 기다리는 손님',
      values: [2, 3, 4],
      start: 1,
      weight: 1.5,
    },
  ],
};
const FLOW_PRACTICE = {
  id: 'order-rush.practice',
  version: 1,
  target: 0.8,
  items: { levels: [1, 2, 3], weight: 2 },
};
const FLOW_WORDS = {
  'raise.pace': '손님이 조금 더 바빠져요.',
  'ease.pace': '손님이 조금 더 여유 있게 기다려요.',
  'raise.content': '조금 더 까다로운 주문도 들어와요.',
  'ease.content': '간단한 주문부터 다시 받아요.',
  'start.memory': '지난번 영업에 맞춰 문을 열어요.',
  'start.prior': '다른 게임 기록에 맞춰 문을 열어요.',
  'start.returning': '오늘은 가볍게 문을 열어요.',
  'start.tired': '오늘은 더 바빠지지 않게 영업해요.',
  'start.fixed': '정해진 속도로 영업해요.',
  'start.baseline': '이번 영업은 기본 속도로 해요.',
};
// 같은 응답 열(성공 · 놓침 · 시간 초과를 섞고, 낸 단계를 붙인다).
function answers(seed, count) {
  const random = seeded(seed);
  return Array.from({ length: count }, () => {
    const u = random();
    const level = 1 + Math.floor(random() * 3);
    if (u < 0.7) return { outcome: 'success', pressure: 0.3, level };
    return u < 0.85 ? { outcome: 'fail', pressure: 0.4, level } : { outcome: 'timeout', level };
  });
}

test('items is not a knob: Flow never moves the item level, and no line speaks of it', () => {
  const spec = Flow.defineContent(FLOW_RUSH);
  assert.equal(
    spec.knobs.some(k => k.id === Flow.ITEM),
    false,
  );
  assert.deepEqual(spec.items, { levels: [1, 2, 3], weight: 2, start: 0 });
  for (const seed of [1, 2, 3, 4, 5]) {
    const run = Flow.start({ spec, now: NOW });
    const said = [Flow.line(run.intro(), { words: FLOW_WORDS })];
    for (const answer of answers(seed, 60)) {
      const { change, settings } = run.observe(answer);
      assert.equal(Object.hasOwn(settings.values, Flow.ITEM), false);
      assert.equal(Object.hasOwn(settings.indices, Flow.ITEM), false);
      if (change) said.push(Flow.line(change, { words: FLOW_WORDS }));
    }
    assert.ok(run.changes().length > 0, `seed ${seed}: time pressure still follows the person`);
    assert.ok(
      run.changes().every(c => c.kind === 'pace'),
      `seed ${seed}: only time knobs move`,
    );
    for (const line of said.filter(Boolean)) {
      assert.ok(
        !['raise.content', 'ease.content'].includes(line.key),
        `seed ${seed}: ${line.text}`,
      );
      assert.notEqual(line.text, '조금 더 까다로운 주문도 들어와요.');
    }
    assert.equal(Object.hasOwn(run.memory(NOW).indices, Flow.ITEM), false);
  }
  // 옛 판은 같은 응답에 문항 단계를 올렸고 그 줄을 말했다 — 위의 차이는 의도한 것이다.
  const old = Old.start({ spec: Old.defineContent(FLOW_RUSH), now: NOW });
  const moved = answers(1, 60)
    .map(answer => old.observe(answer).change)
    .filter(change => change?.knob === Old.ITEM);
  assert.ok(moved.length > 0, 'the old Flow moved the item level');
  // items 옆에 둘 수 있는 손잡이는 시간 손잡이와 선언된 손잡이뿐이다(막기 — content-block.test.mjs). 그 시간 손잡이는 위에서 움직였다.
});

test('the observed item level enters the expected success rate; before any, the start level does', () => {
  const spec = Flow.defineContent({
    id: 'test.observed',
    items: { levels: [1, 2, 3], weight: 2 },
    knobs: [{ id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 }],
  });
  const at = { patience: 2 };
  assert.equal(
    Flow.challenge(spec, at, 'content', 2) - Flow.challenge(spec, at, 'content', 0),
    spec.scale * 2 * 2,
  );
  assert.equal(
    Flow.challenge(spec, at, 'pace', 2),
    Flow.challenge(spec, at, 'pace', 0),
    'time does not see the item',
  );
  assert.equal(
    Flow.challenge(spec, at),
    Flow.challenge(spec, at, null, 0),
    'without an item, the start level',
  );
  const runOf = levels => {
    const run = Flow.start({ spec, now: NOW });
    for (const level of levels)
      run.observe({ outcome: 'success', pressure: 0.3, ...(level ? { level } : {}) });
    return run;
  };
  const easy = runOf([1]);
  const hard = runOf([3]);
  const none = runOf([null]);
  assert.ok(
    hard.trace()[0].expected < easy.trace()[0].expected,
    'a harder item is expected to be met less often',
  );
  assert.ok(hard.trace()[0].content > easy.trace()[0].content, 'and meeting it says more');
  assert.deepEqual(
    none.trace(),
    easy.trace(),
    'before any level is observed, the start level counts',
  );
  // 관찰 칸은 다음 관찰까지 남는다: 낸 단계를 말하지 않은 응답도 마지막으로 낸 단계로 센다.
  assert.deepEqual(runOf([3, null, null]).trace(), runOf([3, 3, 3]).trace());
  assert.notDeepEqual(runOf([3, null]).trace(), runOf([3, 1]).trace());
  // 시작 단계가 첫 단계가 아니면, 관찰 전에는 그 단계로 센다.
  const mid = Flow.defineContent({
    ...spec,
    id: 'test.observed.mid',
    items: { ...spec.items, start: 1 },
  });
  const first = levels => {
    const run = Flow.start({ spec: mid, now: NOW });
    run.observe({ outcome: 'success', ...(levels ? { level: levels } : {}) });
    return run.trace();
  };
  assert.deepEqual(first(null), first(2));
  assert.notDeepEqual(first(null), first(1));
  // 낸 단계는 내용의 단계여야 하고, items 없는 내용은 단계를 받지 않는다.
  assert.throws(
    () => Flow.start({ spec, now: NOW }).observe({ outcome: 'success', level: 4 }),
    /invalid item level/,
  );
  const plain = Flow.start({
    spec: { id: 'test.plain', knobs: [{ id: 'a', values: [0, 1] }] },
    now: NOW,
  });
  assert.throws(() => plain.observe({ outcome: 'success', level: 1 }), /invalid item level/);
});

test('a content whose only knob is items has no moment-level challenge: nothing changes and nothing is said', () => {
  const spec = Flow.defineContent(FLOW_PRACTICE);
  assert.deepEqual(spec.knobs, []);
  for (const options of [
    {},
    { condition: 'tired' },
    { declared: { mode: 'harder' } },
    { arm: 'baseline' },
  ]) {
    const run = Flow.start({ spec, now: NOW, ...options });
    const label = JSON.stringify(options);
    assert.equal(run.settings().adaptive, false, label);
    assert.deepEqual(run.settings().values, {}, label);
    assert.deepEqual(run.intro(), { code: 'start.none', opening: [] }, label);
    assert.equal(Flow.line(run.intro(), { words: FLOW_WORDS }), null, label);
    for (const answer of answers(7, 40)) {
      const result = run.observe(answer);
      assert.equal(result.change, null, label);
      assert.deepEqual(result.settings.values, {}, label);
    }
    assert.deepEqual(run.changes(), [], label);
    assert.equal(run.lessHelpAllowed(), false, label);
    assert.equal(run.acceptLessHelp(), null, label);
    assert.deepEqual(run.floor(), [], label);
    assert.deepEqual(run.memory(NOW).indices, {}, label);
  }
  // 옛 판은 같은 내용에서 문항 단계를 움직였다.
  const old = Old.start({ spec: Old.defineContent(FLOW_PRACTICE), now: NOW });
  assert.ok(answers(7, 40).some(answer => old.observe(answer).change !== null));
});

test('an old memory with an item level is read as a seed, only that slot is left out', () => {
  // 옛 판이 주문 폭주를 한 판 하고 남긴 기억 — 손잡이 칸에 문항 난도(ITEM)가 있다.
  // 옛 판은 Flow가 바란 단계를 내고, 시간을 넉넉히 써서 맞히다가 마지막에 시간을 넘겼다.
  const old = Old.start({ spec: Old.defineContent(FLOW_RUSH), now: NOW });
  for (let i = 0; i < 16; i += 1)
    old.observe({
      outcome: 'success',
      pressure: 0.6,
      latencyMs: 3000 + i * 100,
      level: old.settings().level,
    });
  old.observe({ outcome: 'timeout', level: old.settings().level });
  const memory = old.memory(NOW);
  assert.ok(Object.hasOwn(memory.indices, Flow.ITEM), 'the old memory holds an item level');
  assert.ok(memory.indices[Flow.ITEM] > 0, 'and the old round had raised it');
  const { [Flow.ITEM]: _item, ...knobs } = memory.indices;
  const run = Flow.start({ spec: FLOW_RUSH, memory, now: later(1) });
  assert.equal(run.intro().code, 'start.memory', 'the old memory is read');
  assert.deepEqual(run.intro().opening, []);
  assert.deepEqual(run.settings().indices, knobs, 'every knob resumes where the old round left it');
  const kept = run.memory(later(1));
  assert.deepEqual(kept.estimates, memory.estimates, 'the estimates are taken as they were');
  assert.deepEqual(kept.latencies, memory.latencies);
  assert.deepEqual(kept.indices, knobs, 'the item slot is not written back');
  // 그 칸이 무엇이든(범위 밖 · 정수 아님) 읽기를 막지 않는다.
  for (const value of [7, -1, 'x', null]) {
    const odd = { ...memory, indices: { ...memory.indices, [Flow.ITEM]: value } };
    assert.equal(
      Flow.start({ spec: FLOW_RUSH, memory: odd, now: later(1) }).intro().code,
      'start.memory',
    );
  }
  // 문항 난도는 손잡이가 아니라 잠글 수도, 손잡이 이름으로 쓸 수도 없다.
  assert.throws(
    () => Flow.start({ spec: FLOW_RUSH, now: NOW, declared: { knobs: { [Flow.ITEM]: 1 } } }),
    /invalid declared knob item\.difficulty/,
  );
  assert.throws(
    () => Flow.defineContent({ id: 'bad', knobs: [{ id: Flow.ITEM, values: [1, 2] }] }),
    /invalid knob item\.difficulty/,
  );
});

// 낸 단계를 말하지 않는 판에서, 문항 단계와 시간 손잡이뿐인 내용(주문 폭주)의 새 판은 문항 단계를 시작 단계에 잠근 옛 판과 같다 — items가
// 「Flow가 돌리지 않는 칸」이라는 뜻을 그대로 맞댄다. 문항 단계는 내용 몫의 목표를 시간과 나누는 데도 든다(옛 판처럼).
const withoutItem = value => {
  const { [Flow.ITEM]: _item, ...rest } = value;
  return rest;
};
const settingsWithoutItem = ({ level: _level, values, indices, ...rest }) => ({
  ...rest,
  values: withoutItem(values),
  indices: withoutItem(indices),
});

test('without observed levels, the new Flow on items and time knobs is the old one with the item level held at its start', () => {
  const random = seeded(31337);
  const pick = list => list[Math.floor(random() * list.length)];
  for (let row = 0; row < 300; row += 1) {
    let memories = [null, null];
    let at = NOW;
    for (let session = 0; session < 2; session += 1) {
      const day = {
        condition: pick([null, 'tired', 'okay']),
        mode: pick(['auto', 'auto', 'fixed', 'easier', 'harder']),
      };
      const old = Old.start({
        spec: FLOW_RUSH,
        now: at,
        memory: memories[0],
        condition: day.condition,
        declared: { mode: day.mode, knobs: { [Old.ITEM]: 0 } },
      });
      const run = Flow.start({
        spec: FLOW_RUSH,
        now: at,
        memory: memories[1],
        condition: day.condition,
        declared: { mode: day.mode },
      });
      assert.deepEqual(run.intro(), old.intro(), `row ${row}`);
      for (let i = 0; i < 25; i += 1) {
        const answer = {
          outcome: pick(['success', 'success', 'success', 'fail', 'timeout', 'skip']),
          ...(random() < 0.2 ? { assisted: true } : {}),
          ...(random() < 0.6 ? { pressure: Math.round(random() * 110) / 100 } : {}),
        };
        const a = old.observe(answer);
        const b = run.observe(answer);
        assert.deepEqual(b.change, a.change, `row ${row} answer ${i}`);
        assert.deepEqual(b.settings, settingsWithoutItem(a.settings), `row ${row} answer ${i}`);
      }
      assert.deepEqual(run.trace(), old.trace(), `row ${row}`);
      const kept = [old.memory(at), run.memory(at)];
      assert.deepEqual(
        kept[1],
        // 새 기억은 관찰한 난도 자리(item)를 따로 남긴다 — 옛 판의 문항 난도 칸 값과 같다(카본 끝 판 E2).
        { ...kept[0], indices: withoutItem(kept[0].indices), item: kept[0].indices[Old.ITEM] },
        `row ${row}`,
      );
      memories = kept;
      at = later(pick([1, 3, 20]), at);
    }
  }
});
