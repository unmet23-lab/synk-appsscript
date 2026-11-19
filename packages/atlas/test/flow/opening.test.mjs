// 여는 자리의 옛 시험 셋을 새 순간 맞춤(src/flow)에 다시 건다: tests/atlas-flow-opening-direction.test.js ·
// atlas-flow-opening-fallback.test.js · atlas-flow-tired-lock-regression.test.js. 셋 다 items가 없어 장면을 그대로 옮겼다.
// 바람길(korean-runner)의 내용 정의 FLOW_RUN · TIRED_RUN은 experiences/korean-runner/learning.mjs의 값을 그대로 옮겨 적었다 —
// 패키지 시험이 제품 파일을 부르지 않게.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Flow, later, NOW, reasons, steps } from './legacy.mjs';

const logit = p => Math.log(p / (1 - p));

// ── 앞선 근거의 큰 걸음은 목표를 건너도 되튀지 않는다(opening-direction) ──
const direction = () =>
  Flow.defineContent({
    id: 'probe.opening-direction',
    scale: 1,
    knobs: [
      { id: 'level', values: [0, 1, 2], weight: 2, start: 0 },
      { id: 'pace', kind: 'pace', values: [0, 1, 2, 3, 4, 5], start: 0 },
    ],
  });
const AT = '2026-10-26T00:00:00.000Z';

test('a weight-two prior opening stops after crossing its aim instead of bouncing to the step limit', () => {
  const run = Flow.start({
    spec: direction(),
    now: AT,
    prior: { content: logit(0.75 / 0.9) + 1.1 },
  });
  assert.deepEqual(
    run.intro().opening.map(c => [c.knob, c.direction]),
    [['level', 1]],
  );
  assert.equal(run.settings().indices.level, 1);
  // 여는 자리의 레일이 다음 답을 쉽게 하는 증거를 막지 않는다.
  assert.equal(run.observe({ outcome: 'fail', pressure: 0.1 }).change?.direction, -1);
});

test('a prior needing three large steps keeps its odd opening instead of returning on the twelfth move', () => {
  const content = Flow.defineContent({
    id: 'probe.opening-odd',
    scale: 1,
    knobs: [{ id: 'level', values: [0, 1, 2, 3, 4, 5], weight: 2, start: 0 }],
  });
  const run = Flow.start({ spec: content, now: AT, prior: { content: logit(0.75) + 5.1 } });
  const opening = run.intro().opening;
  assert.equal(opening.length, 3);
  assert.deepEqual(
    opening.map(c => c.direction),
    [1, 1, 1],
  );
  assert.deepEqual(run.settings().indices, { level: 3 });
});

test('explicit locks and memory opening limits still hold', () => {
  const content = direction();
  const run = Flow.start({
    spec: content,
    now: AT,
    prior: { content: logit(0.75 / 0.9) + 1.1 },
    declared: { knobs: { level: 0 } },
  });
  assert.equal(run.settings().indices.level, 0);
  assert.ok(run.intro().opening.every(c => c.knob === 'pace'));
  const remembered = Flow.start({ spec: content, now: AT, memory: run.memory(AT) });
  assert.ok(remembered.intro().opening.length <= 2);
  assert.ok(remembered.intro().opening.every(c => c.direction < 0));
});

// ── 한 차원에 걸음이 없으면 다른 차원이 제 걸음을 간다(opening-fallback) ──
const DAY1 = '2026-10-03T09:00:00.000Z';
const DAY2 = '2026-10-04T09:00:00.000Z';
const two = (content, pace) =>
  Flow.defineContent({
    id: 'probe.opening-floor',
    knobs: [
      { id: 'content', kind: 'content', values: [0, 1, 2, 3], start: content },
      { id: 'pace', kind: 'pace', values: [0, 1, 2, 3], start: pace },
    ],
  });
// 고정 판: 그 답은 추정만 가르치고 자리는 그대로다.
const taught = (spec, answers) => {
  const fixed = Flow.start({ spec, now: DAY1, declared: { mode: 'fixed' } });
  for (const answer of answers) assert.equal(fixed.observe(answer).change, null);
  return fixed.memory(DAY1);
};
const missThenLate = [{ outcome: 'fail' }, { outcome: 'timeout' }];

test('content already at its easiest does not keep time from easing: the next round opens with more time', () => {
  const spec = two(0, 1);
  const fresh = Flow.start({ spec, now: DAY1 }).memory(DAY1);
  const memory = taught(spec, missThenLate);
  assert.deepEqual(memory.indices, { content: 0, pace: 1 });
  assert.ok(memory.estimates.content.theta < fresh.estimates.content.theta, 'the miss was learnt');
  assert.ok(
    memory.estimates.pace.theta < fresh.estimates.pace.theta,
    'and so was the time that ran out',
  );
  assert.equal(
    Flow.check({
      spec,
      knob: 'pace',
      from: 1,
      to: 0,
      step: 0,
      phase: 'opening',
      history: [],
      frozen: false,
    }).ok,
    true,
    'the guard allows the step',
  );
  const next = Flow.start({ spec, now: DAY2, memory });
  assert.equal(next.intro().code, 'start.memory');
  assert.deepEqual(
    steps(next),
    [['memory', 'pace', 1, 0]],
    'content has no easier step, so time takes its own',
  );
  assert.deepEqual(next.settings().indices, { content: 0, pace: 0 });
  assert.deepEqual(
    next.memory(DAY2).indices,
    { content: 0, pace: 0 },
    'an ordinary round keeps the step it played',
  );
});

test('the same holds the other way round: time already at its easiest does not keep content from easing', () => {
  const spec = two(1, 0);
  const fresh = Flow.start({ spec, now: DAY1 }).memory(DAY1);
  const memory = taught(spec, [{ outcome: 'success', assisted: true }, { outcome: 'timeout' }]);
  assert.ok(
    memory.estimates.content.theta < fresh.estimates.content.theta &&
      memory.estimates.pace.theta < fresh.estimates.pace.theta,
  );
  const next = Flow.start({ spec, now: DAY2, memory });
  assert.deepEqual(steps(next), [['memory', 'content', 1, 0]]);
  assert.deepEqual(next.settings().indices, { content: 0, pace: 0 });
});

test('a knob held by hand is passed over the same way; with every step held, the opening stops', () => {
  const spec = two(1, 1);
  const memory = taught(spec, missThenLate);
  assert.deepEqual(steps(Flow.start({ spec, now: DAY2, memory })), [
    ['memory', 'content', 1, 0],
    ['memory', 'pace', 1, 0],
  ]);
  const held = Flow.start({ spec, now: DAY2, memory, declared: { knobs: { content: 1 } } });
  assert.deepEqual(steps(held), [['memory', 'pace', 1, 0]]);
  assert.deepEqual(held.settings().indices, { content: 1, pace: 0 });
  assert.deepEqual(held.memory(DAY2).indices, { content: 1, pace: 0 });
  const both = Flow.start({
    spec,
    now: DAY2,
    memory,
    declared: { knobs: { content: 1, pace: 1 } },
  });
  assert.deepEqual(both.intro().opening, []);
  assert.deepEqual(both.changes(), []);
  assert.deepEqual(both.settings().indices, { content: 1, pace: 1 });
});

test('a tired day only eases, and the ordinary round set aside takes the same step, so it is memory’s own and kept', () => {
  const spec = two(0, 1);
  const memory = taught(spec, missThenLate);
  const plain = Flow.start({ spec, now: DAY2, memory });
  const tired = Flow.start({ spec, now: DAY2, memory, condition: 'tired' });
  assert.deepEqual(steps(tired), [['memory', 'pace', 1, 0]]);
  assert.ok(
    tired.intro().opening.every(change => change.direction < 0),
    'nothing goes up on a tired day',
  );
  assert.deepEqual(tired.memory(DAY2).indices, plain.memory(DAY2).indices);
});

// ── 손으로 잡은 손잡이는 오늘만의 것이다(tired-lock regression) ──
const FLOW_RUN = {
  id: 'korean-runner.run',
  version: 1,
  target: 0.8,
  knobs: [
    {
      id: 'speed',
      kind: 'pace',
      label: '처음 달리는 속도',
      values: [11, 12, 13, 14, 15],
      start: 2,
    },
    {
      id: 'ramp',
      kind: 'pace',
      label: '갈수록 빨라지는 정도',
      values: [0, 0.025, 0.04, 0.055, 0.07],
      start: 3,
      weight: 0.5,
    },
  ],
};
const TIRED_RUN = { knobs: { ramp: 0 } };

test('a tired run that holds the ramp keeps no speed step it never took, with no answers or after ten successes', () => {
  const spec = Flow.defineContent(FLOW_RUN);
  const fresh = Flow.start({ spec, now: DAY1 });
  const usual = fresh.settings().indices;
  assert.deepEqual(fresh.settings().values, { speed: 13, ramp: 0.055 });
  for (const successes of [0, 10]) {
    const tired = Flow.start({ spec, now: DAY1, condition: 'tired', declared: TIRED_RUN });
    assert.equal(tired.intro().code, 'start.tired');
    assert.deepEqual(
      tired.intro().opening,
      [],
      'the held ramp is not made up for by a faster start',
    );
    assert.deepEqual(tired.settings().values, { speed: 13, ramp: 0 });
    for (let i = 0; i < successes; i += 1)
      assert.equal(
        tired.observe({ outcome: 'success' }).change,
        null,
        'nothing gets faster in a tired run',
      );
    assert.deepEqual(
      tired.settings().values,
      { speed: 13, ramp: 0 },
      'speed stays at 13 to the end',
    );
    const saved = tired.memory(DAY1);
    assert.deepEqual(
      saved.indices,
      usual,
      `${successes} successes: speed is kept at 13 and the ramp where it was`,
    );
    if (successes)
      assert.ok(
        saved.estimates.pace.theta > fresh.memory(DAY1).estimates.pace.theta,
        'what was learnt about time is still kept',
      );
    const next = Flow.start({ spec, now: later(1, DAY1), memory: saved });
    assert.equal(next.intro().code, 'start.memory');
    assert.deepEqual(next.intro().opening, []);
    assert.deepEqual(
      next.settings().values,
      { speed: 13, ramp: 0.055 },
      'the next ordinary run starts at 13, not 14',
    );
  }
});

test('what ordinary play reached is kept through a tired run that holds the ramp', () => {
  const spec = Flow.defineContent(FLOW_RUN);
  const usual = Flow.start({ spec, now: DAY1 });
  for (let i = 0; i < 10; i += 1) usual.observe({ outcome: 'success' });
  const reached = usual.settings().indices;
  const memory = usual.memory(DAY1);
  assert.ok(
    Flow.challenge(spec, reached) >
      Flow.challenge(spec, Flow.start({ spec, now: DAY1 }).settings().indices),
    'ordinary play went faster',
  );
  const tired = Flow.start({
    spec,
    now: later(1, DAY1),
    memory,
    condition: 'tired',
    declared: TIRED_RUN,
  });
  assert.equal(tired.settings().values.ramp, 0);
  for (let i = 0; i < 10; i += 1) {
    const change = tired.observe({ outcome: 'success' }).change;
    assert.ok(!change || change.direction < 0);
  }
  const saved = tired.memory(later(1, DAY1));
  assert.deepEqual(
    saved.indices,
    reached,
    'the held ramp returns to where play had reached, and speed is not moved',
  );
  assert.deepEqual(
    Flow.start({ spec, now: later(2, DAY1), memory: saved }).settings().indices,
    reached,
  );
});

test('memory’s own easing keeps its name and its place under a held knob, and a held knob leaves no easing of its own', () => {
  const spec = Flow.defineContent(FLOW_RUN);
  const at = Flow.start({ spec, now: DAY1 }).memory(DAY1);
  const ahead = { ...at, indices: { speed: 4, ramp: 3 } };
  const usual = Flow.start({ spec, now: later(1, DAY1), memory: ahead });
  assert.deepEqual(steps(usual), [
    ['memory', 'speed', 4, 3],
    ['memory', 'speed', 3, 2],
  ]);
  const tired = Flow.start({
    spec,
    now: later(1, DAY1),
    memory: ahead,
    condition: 'tired',
    declared: TIRED_RUN,
  });
  assert.deepEqual(
    steps(tired),
    [['memory', 'speed', 4, 3]],
    'the step memory itself asks for is named so',
  );
  assert.deepEqual(tired.settings().values, { speed: 14, ramp: 0 });
  assert.deepEqual(tired.memory(later(1, DAY1)).indices, usual.memory(later(1, DAY1)).indices);
  const fast = Flow.start({
    spec,
    now: later(1, DAY1),
    memory: at,
    condition: 'tired',
    declared: { knobs: { speed: 4 } },
  });
  assert.deepEqual(steps(fast), [
    ['tired', 'ramp', 3, 2],
    ['tired', 'ramp', 2, 1],
  ]);
  assert.deepEqual(fast.memory(later(1, DAY1)).indices, at.indices);
});

test('a knob held by hand on a tired, easier or harder day leaves the other knobs where the prior alone places them', () => {
  const spec = Flow.defineContent({
    id: 'test.tired-lock.prior',
    knobs: [
      { id: 'a', values: [0, 1, 2, 3, 4, 5], start: 2 },
      { id: 'b', values: [0, 1, 2, 3], start: 1 },
    ],
  });
  const prior = { content: 3.35 };
  const usual = Flow.start({ spec, now: DAY1, prior });
  assert.deepEqual(usual.settings().indices, { a: 3, b: 1 });
  assert.deepEqual(reasons(usual), ['prior']);
  const kept = usual.memory(DAY1);
  const resumed = Flow.start({ spec, now: later(1, DAY1), memory: kept }).settings().indices;
  for (const [options, why] of [
    [{ condition: 'tired', declared: { knobs: { b: 0 } } }, []],
    [{ declared: { mode: 'easier', knobs: { b: 0 } } }, ['prior']],
    [
      { declared: { mode: 'harder', knobs: { b: 0 } } },
      ['prior', 'declared-harder', 'declared-harder'],
    ],
  ]) {
    const run = Flow.start({ spec, now: DAY1, prior, ...options });
    const label = JSON.stringify(options);
    assert.equal(run.settings().indices.b, 0, `${label}: the held knob plays where it was set`);
    assert.deepEqual(reasons(run), why, `${label}: only the prior's own step is named the prior's`);
    assert.deepEqual(
      run.memory(DAY1).indices,
      kept.indices,
      `${label}: memory keeps the prior's place`,
    );
    assert.deepEqual(
      Flow.start({ spec, now: later(1, DAY1), memory: run.memory(DAY1) }).settings().indices,
      resumed,
      `${label}: the next ordinary day resumes there`,
    );
  }
});

// 본인 선택만 따르는 손잡이(글자 크기 · 움직임 …): 그 판에서는 값을 지키고, 기억은 내용의 값을 둔다.
const display = () =>
  Flow.defineContent({
    id: 'probe.display-lock',
    target: 0.8,
    knobs: [
      { id: 'difficulty', kind: 'content', values: [0, 1, 2, 3, 4], start: 2 },
      {
        id: 'textSize',
        kind: 'content',
        follows: 'declared',
        values: ['large', 'standard'],
        start: 1,
        weight: 1.5,
      },
    ],
  });
const chosen = () =>
  Flow.defineContent({
    id: 'test.chosen',
    target: 0.75,
    knobs: [
      { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 },
      { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 },
      {
        id: 'textSize',
        kind: 'content',
        follows: 'declared',
        values: ['standard', 'large'],
        start: 0,
      },
      { id: 'motion', kind: 'content', follows: 'declared', values: ['full', 'reduced'], start: 0 },
      { id: 'text', kind: 'content', follows: 'declared', values: ['large', 'standard'], start: 1 },
    ],
  });

test('a text size chosen for a tired run holds there, and no step up for it is kept, whether it is chosen again or cleared', () => {
  const spec = display();
  const large = { knobs: { textSize: 0 } };
  const fresh = Flow.start({ spec, now: DAY1 });
  const played = Flow.start({ spec, now: DAY1, declared: large });
  assert.deepEqual(steps(played), [['prior', 'difficulty', 2, 3]]);
  assert.deepEqual(played.memory(DAY1).indices, { difficulty: 3, textSize: 1 });
  for (const successes of [0, 10]) {
    const tired = Flow.start({ spec, now: DAY1, condition: 'tired', declared: large });
    assert.equal(tired.intro().code, 'start.tired');
    assert.deepEqual(tired.intro().opening, [], 'today nothing goes up');
    for (let i = 0; i < successes; i += 1)
      assert.equal(
        tired.observe({ outcome: 'success' }).change,
        null,
        'nothing gets harder in a tired run',
      );
    assert.deepEqual(tired.settings().values, { difficulty: 2, textSize: 'large' });
    const saved = tired.memory(DAY1);
    assert.deepEqual(
      saved.indices,
      { difficulty: 2, textSize: 1 },
      `${successes} successes: nothing never played is kept`,
    );
    if (successes)
      assert.ok(
        saved.estimates.content.theta > fresh.memory(DAY1).estimates.content.theta,
        'what was learnt is still kept',
      );
    const again = Flow.start({ spec, now: later(1, DAY1), memory: saved, declared: large });
    assert.deepEqual(again.intro().opening, []);
    assert.deepEqual(again.settings().values, { difficulty: 2, textSize: 'large' });
    const cleared = Flow.start({ spec, now: later(1, DAY1), memory: saved });
    assert.deepEqual(cleared.intro().opening, []);
    assert.deepEqual(cleared.settings().values, { difficulty: 2, textSize: 'standard' });
  }
});

test('chosen settings that make a tired run harder leave no extra help in memory, whether they are chosen again or cleared', () => {
  const spec = chosen();
  const usual = Flow.start({ spec, now: DAY1 }).settings().indices;
  const declared = {
    knobs: { ...Flow.declaredFrom(spec, { textSize: 'large', motion: 'reduced' }).knobs, text: 0 },
  };
  for (const [successes, again] of [
    [0, [['memory', 'hint', 1, 0]]],
    [10, []],
  ]) {
    const tired = Flow.start({ spec, now: DAY1, condition: 'tired', declared });
    assert.deepEqual(
      steps(tired),
      [
        ['tired', 'hint', 1, 0],
        ['tired', 'patience', 2, 1],
      ],
      'more help and more time for today alone',
    );
    for (let i = 0; i < successes; i += 1)
      assert.equal(tired.observe({ outcome: 'success' }).change, null);
    assert.deepEqual(tired.settings().values, {
      patience: 52,
      hint: 'early',
      textSize: 'large',
      motion: 'reduced',
      text: 'large',
    });
    const saved = tired.memory(DAY1);
    assert.deepEqual(
      saved.indices,
      usual,
      `${successes} successes: help and time return to where they were`,
    );
    const chosenAgain = Flow.start({ spec, now: later(1, DAY1), memory: saved, declared });
    assert.deepEqual(
      steps(chosenAgain),
      again,
      `${successes} successes: chosen again, only memory itself eases`,
    );
    const cleared = Flow.start({ spec, now: later(1, DAY1), memory: saved });
    assert.deepEqual(cleared.intro().opening, []);
    assert.deepEqual(cleared.settings().values, {
      patience: 45,
      hint: 'normal',
      textSize: 'standard',
      motion: 'full',
      text: 'standard',
    });
  }
});

test('a text size chosen for today leaves other knobs where the prior or memory alone places them', () => {
  const spec = Flow.defineContent({
    id: 'test.display.ladder',
    knobs: [
      { id: 'a', values: [0, 1, 2, 3, 4, 5], start: 2 },
      { id: 'text', kind: 'content', follows: 'declared', values: ['large', 'standard'], start: 1 },
    ],
  });
  const large = { text: 0 };
  const prior = { content: 3.35 };
  const usual = Flow.start({ spec, now: DAY1, prior });
  assert.deepEqual(usual.settings().indices, { a: 3, text: 1 });
  for (const [options, why] of [
    [{ condition: 'tired', declared: { knobs: large } }, []],
    [{ declared: { mode: 'easier', knobs: large } }, ['prior']],
    [
      { declared: { mode: 'harder', knobs: large } },
      ['prior', 'declared-harder', 'declared-harder'],
    ],
  ]) {
    const run = Flow.start({ spec, now: DAY1, prior, ...options });
    const label = JSON.stringify(options);
    assert.equal(run.settings().values.text, 'large', `${label}: the chosen size plays today`);
    assert.deepEqual(reasons(run), why, `${label}: only the prior's own step is named the prior's`);
    assert.deepEqual(
      run.memory(DAY1).indices,
      usual.memory(DAY1).indices,
      `${label}: memory keeps the prior's place`,
    );
  }
  const at = Flow.start({ spec, now: DAY1 }).memory(DAY1);
  const memory = { ...at, indices: { a: 4, text: 1 } };
  const plain = Flow.start({ spec, now: later(1, DAY1), memory });
  assert.deepEqual(steps(plain), [
    ['memory', 'a', 4, 3],
    ['memory', 'a', 3, 2],
  ]);
  const tired = Flow.start({
    spec,
    now: later(1, DAY1),
    memory,
    condition: 'tired',
    declared: { knobs: large },
  });
  assert.deepEqual(
    steps(tired),
    [
      ['memory', 'a', 4, 3],
      ['memory', 'a', 3, 2],
    ],
    'both steps are memory’s own',
  );
  assert.deepEqual(tired.memory(later(1, DAY1)).indices, plain.memory(later(1, DAY1)).indices);
});

// 같은 작은 걸음의 두 손잡이: 앞선 근거가 a를 한 번 올린다.
const n2 = () =>
  Flow.defineContent({
    id: 'probe.n2',
    knobs: [
      { id: 'a', values: [0, 1, 2, 3, 4], start: 2, weight: 0.25 },
      { id: 'b', values: [0, 1, 2, 3, 4], start: 2, weight: 0.25 },
    ],
  });

test('a knob held on a tired day is not stood in for: the step the prior asks of it never lands on the other knob in memory', () => {
  const spec = n2();
  const prior = { content: 2 };
  const plain = Flow.start({ spec, now: DAY1, prior });
  assert.deepEqual(plain.settings().indices, { a: 3, b: 2 });
  assert.deepEqual(plain.memory(DAY1).indices, { a: 3, b: 2 });
  for (const [held, other, kept] of [
    ['a', 'b', { a: 2, b: 2 }],
    ['b', 'a', { a: 3, b: 2 }],
  ]) {
    for (const successes of [0, 10]) {
      const tired = Flow.start({
        spec,
        now: DAY1,
        prior,
        condition: 'tired',
        declared: { knobs: { [held]: 0 } },
      });
      const label = `${held} held, ${successes} successes`;
      assert.deepEqual(tired.intro().opening, [], `${label}: nothing moves today`);
      for (let i = 0; i < successes; i += 1)
        assert.equal(
          tired.observe({ outcome: 'success' }).change,
          null,
          `${label}: nothing gets harder`,
        );
      assert.equal(tired.settings().indices[held], 0, `${label}: the held knob plays as set`);
      assert.equal(
        tired.settings().indices[other],
        2,
        `${label}: the other knob never moved today`,
      );
      const saved = tired.memory(DAY1);
      assert.equal(saved.indices[other], plain.memory(DAY1).indices[other], label);
      assert.equal(saved.indices[held], 2, `${label}: the held knob is kept where it was`);
      assert.deepEqual(saved.indices, kept);
      const next = Flow.start({ spec, now: later(1, DAY1), memory: saved });
      assert.deepEqual(
        next.intro().opening,
        [],
        `${label}: the next ordinary day takes no step memory did not ask for`,
      );
      assert.deepEqual(
        next.settings().indices,
        kept,
        `${label}: the next ordinary day resumes there`,
      );
    }
  }
});

test('on a day chosen easier or harder too, a held knob’s share stays its own, and the ordinary round leaves nothing in today’s', () => {
  const spec = n2();
  const prior = { content: 2 };
  const plain = Flow.start({ spec, now: DAY1, prior }).memory(DAY1).indices;
  for (const [day, held, why] of [
    ['tired', 'a', []],
    ['easier', 'a', []],
    ['harder', 'a', ['declared-harder', 'declared-harder']],
    ['tired', 'b', []],
    ['easier', 'b', []],
    ['harder', 'b', ['prior', 'declared-harder']],
  ]) {
    const other = held === 'a' ? 'b' : 'a';
    const label = `${day}, ${held} held`;
    const run = Flow.start({
      spec,
      now: DAY1,
      prior,
      ...(day === 'tired' ? { condition: 'tired' } : {}),
      declared: { mode: day === 'tired' ? 'auto' : day, knobs: { [held]: 0 } },
    });
    assert.equal(run.settings().indices[held], 0, `${label}: the held knob plays as set`);
    assert.deepEqual(
      reasons(run),
      why,
      `${label}: a step is the prior's only where the ordinary round takes it too`,
    );
    assert.deepEqual(run.memory(DAY1).indices, { [held]: 2, [other]: plain[other] }, label);
    assert.deepEqual(run.changes(), run.intro().opening, label);
    assert.deepEqual(run.trace(), [], label);
  }
});

test('when memory itself would ease a held knob, the other knob does not ease in its place in memory', () => {
  const spec = Flow.defineContent(FLOW_RUN);
  const at = Flow.start({ spec, now: DAY1 }).memory(DAY1);
  const ahead = { ...at, indices: { speed: 4, ramp: 3 } };
  assert.deepEqual(steps(Flow.start({ spec, now: later(1, DAY1), memory: ahead })), [
    ['memory', 'speed', 4, 3],
    ['memory', 'speed', 3, 2],
  ]);
  const held = Flow.start({
    spec,
    now: later(1, DAY1),
    memory: ahead,
    condition: 'tired',
    declared: { knobs: { speed: 4 } },
  });
  assert.deepEqual(steps(held), [
    ['tired', 'ramp', 3, 2],
    ['tired', 'ramp', 2, 1],
  ]);
  assert.deepEqual(held.settings().values, { speed: 15, ramp: 0.025 });
  const saved = held.memory(later(1, DAY1));
  assert.deepEqual(
    saved.indices,
    ahead.indices,
    'the ramp is kept where it was, and the held speed where it was',
  );
  const next = Flow.start({ spec, now: later(2, DAY1), memory: saved });
  assert.deepEqual(steps(next), [
    ['memory', 'speed', 4, 3],
    ['memory', 'speed', 3, 2],
  ]);
  assert.deepEqual(next.settings().values, { speed: 13, ramp: 0.055 });
});
