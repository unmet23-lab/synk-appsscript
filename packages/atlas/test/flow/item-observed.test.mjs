// 관찰 칸(낸 문항의 난도)의 두 자리(4-6 끝 판 검수 · 카본 E1 · E2): 혼자 해낸 성공 뒤에는 두뇌가 더 어려운 문항을 냈다는 것만으로 내리지
// 않고, 내용 기억은 마지막으로 관찰한 난도 자리를 남겨 오래 쉬고 돌아온 판의 추정 상한이 그 자리에서 선다. 난도 관찰이 없으면 옛 판과
// 같다(items.test.mjs의 300열 대조).
import assert from 'node:assert/strict';
import test from 'node:test';
import { Flow, later, NOW } from './legacy.mjs';

const GATE = {
  id: 'test.reading.gate',
  items: { levels: [1, 2, 3] },
  knobs: [{ id: 'choices', values: [2, 3, 4], start: 1 }],
};
const answer = (outcome, level, extra = {}) => ({ outcome, pressure: 0.3, level, ...extra });

// 쉬운 문항을 맞혀 손잡이가 한 칸 오른 판.
function raised() {
  const run = Flow.start({ spec: GATE, now: NOW });
  const changes = [answer('success', 1), answer('success', 1)].map(a => run.observe(a).change);
  assert.equal(changes[1]?.to, 2, '쉬운 문항 둘을 맞혀 한 칸 오른다');
  return run;
}

test('혼자 해낸 성공 뒤에는 더 어려운 문항을 냈다는 것만으로 내리지 않는다 — 놓치거나 도움을 본 답은 그 난도로 내린다', () => {
  const won = raised();
  assert.equal(
    won.observe(answer('success', 3)).change,
    null,
    '어려운 문항을 혼자 맞혔는데 내렸다',
  );
  assert.equal(won.settings().indices.choices, 2);
  // 같은 어려운 난도를 이어 혼자 맞혀도 내리지 않는다(다시 보기 C1 — 앞 관찰의 난도가 이미 높아진 뒤).
  for (let i = 0; i < 4; i += 1) {
    const at = won.settings().indices.choices;
    won.observe(answer('success', 3));
    assert.ok(
      won.settings().indices.choices >= at,
      `${i + 2}번째 어려운 문항을 혼자 맞혔는데 내렸다`,
    );
  }
  const helped = raised();
  assert.equal(helped.observe(answer('success', 3, { assisted: true })).change?.to, 1);
  const missed = raised();
  assert.equal(missed.observe(answer('fail', 3)).change?.to, 1);
});

test('내용 기억은 마지막으로 관찰한 난도 자리를 남기고, 오래 쉬고 돌아온 판의 추정 상한은 그 자리에서 선다', () => {
  const run = Flow.start({ spec: GATE, now: NOW });
  for (let i = 0; i < 8; i += 1) run.observe(answer('success', 3));
  const memory = run.memory(NOW);
  assert.equal(memory.item, 2);
  const back = Flow.start({ spec: GATE, memory, now: later(30) });
  assert.equal(back.intro().code, 'start.returning');
  // 답을 받기 전에 견준다 — 여는 자리의 추정 상한이 기억의 난도 자리에서 선다.
  const { item, ...without } = memory;
  const capped = Flow.start({ spec: GATE, memory: without, now: later(30) }).memory(later(30));
  assert.ok(
    back.memory(later(30)).estimates.content.theta > capped.estimates.content.theta,
    '난도 자리가 없는 기억은 시작 단계에서 상한이 선다',
  );
  assert.equal(
    back.observe(answer('success', 3)).change,
    null,
    '돌아와 어려운 문항을 혼자 맞혔는데 내렸다',
  );
  assert.equal(
    Flow.start({ spec: GATE, memory: { ...memory, item: 7 }, now: later(1) }).memory(later(1)).item,
    0,
    '틀린 자리는 시작 단계',
  );
});

test('증거가 아닌 응답(건너뜀 · 무효)의 문항 난도는 판의 기준으로 두지 않는다(GPT 끝 판 E2)', () => {
  const run = Flow.start({ spec: GATE, now: NOW });
  const before = run.settings().expected;
  for (const outcome of ['void', 'skip']) {
    const out = run.observe({ outcome, level: 3 });
    assert.equal(out.evidence, false);
    assert.equal(run.settings().expected, before, `${outcome} 답의 난도가 기대 성공률을 바꿨다`);
  }
  run.observe(answer('success', 1));
  assert.equal(run.memory(NOW).item, 0, '증거였던 답의 난도만 남는다');
});

test('같은 날 다시 연 판은 기억한 어려운 난도로 여는 자리를 셈하지 않는다 — 혼자 해낸 판을 다시 열자마자 내리지 않는다(GPT 다시 보기 GC4)', () => {
  const run = Flow.start({ spec: GATE, now: NOW });
  for (const level of [1, 1, 3]) run.observe(answer('success', level));
  const at = run.settings().indices.choices;
  const memory = run.memory(NOW);
  assert.equal(memory.item, 2, '마지막으로 관찰한 난도 자리를 남긴다');
  const again = Flow.start({ spec: GATE, memory, now: later(0.1) });
  assert.equal(again.intro().code === 'start.returning', false);
  assert.equal(again.settings().indices.choices, at, '같은 날 다시 열자마자 내렸다');
  const { item, ...without } = memory;
  assert.equal(
    Flow.start({ spec: GATE, memory: without, now: later(0.1) }).settings().indices.choices,
    at,
  );
});

test('난도를 관찰한 뒤 난도를 싣지 않은 혼자 성공도 내용 차원을 내리지 않는다 — 지금 난도 자리의 응답이다(카본 둘째 다시 보기 A1)', () => {
  const won = raised();
  assert.equal(won.observe(answer('success', 3)).change, null);
  const at = won.settings().indices.choices;
  for (let i = 0; i < 3; i += 1) {
    won.observe(answer('success', null));
    assert.ok(won.settings().indices.choices >= at, `${i + 1}번째 난도 없는 혼자 성공 뒤에 내렸다`);
  }
  const missed = raised();
  missed.observe(answer('success', 3));
  assert.equal(missed.observe(answer('fail', null)).change?.to, 1, '놓친 답은 그 난도로 내린다');
});
