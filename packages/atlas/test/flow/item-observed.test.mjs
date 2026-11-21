// 관찰 칸(낸 문항의 난도)의 뜻(4-6 끝 판 검수 · 카본 E1 · E2). 문항 난도를 실은 내용은 시간 손잡이와 선언된 손잡이만 둔다(막기 — 단계 4
// 계획 §25-12의 15). 그래서 관찰 칸은 내용 추정과, 그 추정이 막거나 풀어 주는 시간 손잡이의 걸음으로 보인다. 난도를 실은 놓침은 내용
// 추정을 내리고 시간 손잡이만 움직인다. 혼자 해낸 어려운 문항은 내림 근거가 아니라 시간 압박의 올림을 늦추지 않는다. 내용 기억은 마지막으로
// 관찰한 난도 자리를 남겨, 오래 쉬고 돌아온 판의 추정 상한이 그 자리에서 선다. 난도 관찰이 없으면 옛 판과 같다(items.test.mjs의 300열 대조).
// 내용 손잡이가 난도 관찰에 따라 오르내리는 장면은 막기로 제품에서 닿지 않는 길이 되어 지웠다(같은 뜻은 아래 시간 손잡이 장면이 지킨다).
import assert from 'node:assert/strict';
import test from 'node:test';
import { Flow, later, NOW } from './legacy.mjs';

// 레이싱(experiences/korean-racing FLOW_RACE)과 같은 꼴 — 문항 난도와 시간 손잡이 하나.
const RACE = {
  id: 'test.race',
  items: { levels: [1, 2, 3], weight: 2 },
  knobs: [{ id: 'cruise', kind: 'pace', values: [20, 23, 26, 29, 32], start: 2 }],
};
const answer = (outcome, level, extra = {}) => ({ outcome, pressure: 0.3, level, ...extra });
const times = (count, value) => Array.from({ length: count }, () => value);
const contentOf = run => run.memory(NOW).estimates.content.theta;
// 응답 열에서 처음 손잡이가 바뀐 응답의 차례와 그 방향(1 올림 · −1 내림). 바뀌지 않았으면 차례 −1.
const firstChange = answers => {
  const run = Flow.start({ spec: RACE, now: NOW });
  for (const [index, a] of answers.entries()) {
    const { change } = run.observe(a);
    if (change !== null) return { index, direction: change.direction };
  }
  return { index: -1, direction: 0 };
};
// 시간 압박을 올린 첫 변화가 쉬운 열보다 늦지 않다 — 차례만 견주면 첫 변화가 내림이어도 지나간다(r2 GPT GA4).
const raisedNoLater = (run, easy) => run.index >= 0 && run.direction > 0 && run.index <= easy.index;

test('난도를 실은 놓침은 내용 추정을 내리고 시간 손잡이만 움직인다 — 혼자 해낸 어려운 문항은 내용 추정을 올리고, 도움을 본 성공은 올리지 않는다', () => {
  const at = contentOf(Flow.start({ spec: RACE, now: NOW }));
  const after = a => {
    const run = Flow.start({ spec: RACE, now: NOW });
    run.observe(a);
    return contentOf(run);
  };
  assert.ok(
    after(answer('success', 3)) > at,
    '어려운 문항을 혼자 해냈는데 내용 추정이 오르지 않았다',
  );
  assert.ok(
    after(answer('success', 3, { assisted: true })) <= at,
    '도움을 본 성공이 내용 추정을 올렸다',
  );
  assert.ok(after(answer('fail', 3)) < at, '어려운 문항을 놓쳤는데 내용 추정이 내려가지 않았다');
  // 같은 놓침도 더 어려운 문항이면 덜 내린다 — 낸 난도가 기대 성공률에 든다.
  assert.ok(after(answer('fail', 3)) > after(answer('fail', 1)));
  // 어려운 문항을 놓치고 시간을 넘긴 판: 내용 추정은 내려가고, 바뀜은 시간을 늦추는 것뿐이다.
  const run = Flow.start({ spec: RACE, now: NOW });
  for (let i = 0; i < 3; i += 1)
    for (const outcome of ['fail', 'timeout']) run.observe(answer(outcome, 3));
  assert.ok(contentOf(run) < at);
  assert.ok(run.changes().length > 0, '시간 초과가 시간을 늦추지 않았다');
  assert.ok(run.changes().every(c => c.kind === 'pace' && c.direction < 0));
});

test('혼자 해낸 어려운 문항은 내림 근거가 아니다 — 두뇌가 더 어려운 문항을 냈다는 것만으로 시간 압박의 올림이 늦어지지 않는다(끝 판 E1 · 둘째 다시 보기 A1)', () => {
  const easy = firstChange(times(10, answer('success', 1)));
  assert.ok(
    easy.index >= 0 && easy.direction > 0,
    '쉬운 문항을 혼자 해낸 판에서 시간 압박이 오르지 않았다',
  );
  const hard = firstChange([...times(2, answer('success', 1)), ...times(8, answer('success', 3))]);
  assert.ok(
    raisedNoLater(hard, easy),
    `어려운 문항을 혼자 해냈는데 올림이 늦거나 내렸다(${JSON.stringify(hard)} · 쉬운 열 ${easy.index})`,
  );
  // 난도를 관찰한 뒤 난도를 싣지 않은 혼자 성공은 지금 난도 자리의 응답이다 — 역시 늦추지 않는다.
  const unsaid = firstChange([
    ...times(2, answer('success', 1)),
    answer('success', 3),
    ...times(7, answer('success', null)),
  ]);
  assert.ok(
    raisedNoLater(unsaid, easy),
    `난도 없는 혼자 성공 뒤에 올림이 늦거나 내렸다(${JSON.stringify(unsaid)} · 쉬운 열 ${easy.index})`,
  );
});

test('내용 기억은 마지막으로 관찰한 난도 자리를 남기고, 오래 쉬고 돌아온 판의 추정 상한은 그 자리에서 선다', () => {
  const run = Flow.start({ spec: RACE, now: NOW });
  for (let i = 0; i < 8; i += 1) run.observe(answer('success', 3));
  const memory = run.memory(NOW);
  assert.equal(memory.item, 2);
  const back = Flow.start({ spec: RACE, memory, now: later(30) });
  assert.equal(back.intro().code, 'start.returning');
  // 답을 받기 전에 견준다 — 여는 자리의 추정 상한이 기억의 난도 자리에서 선다.
  const { item, ...without } = memory;
  const capped = Flow.start({ spec: RACE, memory: without, now: later(30) }).memory(later(30));
  assert.ok(
    back.memory(later(30)).estimates.content.theta > capped.estimates.content.theta,
    '난도 자리가 없는 기억은 시작 단계에서 상한이 선다',
  );
  assert.equal(
    back.observe(answer('success', 3)).change,
    null,
    '돌아와 어려운 문항을 혼자 맞혔는데 손잡이가 바뀌었다',
  );
  assert.equal(
    Flow.start({ spec: RACE, memory: { ...memory, item: 7 }, now: later(1) }).memory(later(1)).item,
    0,
    '틀린 자리는 시작 단계',
  );
});

test('증거가 아닌 응답(건너뜀 · 무효)의 문항 난도는 판의 기준으로 두지 않는다(GPT 끝 판 E2)', () => {
  const run = Flow.start({ spec: RACE, now: NOW });
  const before = run.settings().expected;
  for (const outcome of ['void', 'skip']) {
    const out = run.observe({ outcome, level: 3 });
    assert.equal(out.evidence, false);
    assert.equal(run.settings().expected, before, `${outcome} 답의 난도가 기대 성공률을 바꿨다`);
  }
  run.observe(answer('success', 1));
  assert.equal(run.memory(NOW).item, 0, '증거였던 답의 난도만 남는다');
});

test('같은 날 다시 연 판은 기억한 어려운 난도로 여는 자리를 셈하지 않는다 — 난도 자리가 없는 기억과 같은 판으로 연다(GPT 다시 보기 GC4)', () => {
  const run = Flow.start({ spec: RACE, now: NOW });
  for (const level of [1, 1, 3]) run.observe(answer('success', level));
  const at = run.settings().indices;
  const memory = run.memory(NOW);
  assert.equal(memory.item, 2, '마지막으로 관찰한 난도 자리를 남긴다');
  const again = Flow.start({ spec: RACE, memory, now: later(0.1) });
  assert.equal(again.intro().code === 'start.returning', false);
  assert.deepEqual(again.settings().indices, at, '같은 날 다시 열자마자 손잡이가 바뀌었다');
  const { item, ...without } = memory;
  const plain = Flow.start({ spec: RACE, memory: without, now: later(0.1) });
  assert.deepEqual(again.intro(), plain.intro());
  assert.deepEqual(
    again.settings(),
    plain.settings(),
    '기억한 난도가 여는 판의 기대 성공률에 들었다',
  );
});
