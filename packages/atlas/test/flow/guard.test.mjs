// 옛 시험 tests/atlas-temper-flow.test.js 가운데 가드(check)의 장면을 새 가드(src/flow/guard.mjs)에 다시 건다.
// 뺀 것: 가상 사람(PERSONAS)과 모의 실험(simulate) 장면 · 그 위의 도움 줄이기 제안 장면(옛 temper-flow.js의 모의 실험은 옮기지 않았다 —
// 옮긴 것은 temper.js의 check와 그 상수뿐이다), 브라우저 전역 · require 순서 장면(새 모듈은 ES 모듈이라 해당이 없다 — 대신 아래에서
// 가드가 아무것도 부르지 않는 잎인지 본다). 옛 장면의 내용 정의에 있던 items는 가드가 보지 않으므로 그대로 두었다.
// 더한 것: 임의 입력 3,000개에서 새 check가 옛 temper.check와 같은 답을 내는지 맞댄다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { subjectPath } from '../support/subject.mjs';
import { Flow, legacy, seeded } from './legacy.mjs';

const Temper = legacy('temper.js');
const spec = Flow.defineContent({
  id: 'test.cafe',
  target: 0.75,
  items: { levels: [1, 2, 3], weight: 2 },
  knobs: [
    { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32, 27], start: 2 },
    { id: 'spawn', kind: 'pace', values: [14, 12, 10, 8, 7], start: 2 },
    { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 },
    { id: 'size', kind: 'content', follows: 'declared', values: ['large', 'standard'], start: 1 },
  ],
});

test('the guard allows one knob, one step, inside bounds, never a declared-only knob, and stops on hold', () => {
  const ok = input => Flow.check({ spec, step: 1, history: [], ...input });
  assert.equal(ok({ knob: 'patience', from: 2, to: 3 }).ok, true);
  assert.equal(ok({ knob: 'patience', from: 2, to: 4 }).rail, 'one-step');
  assert.equal(ok({ knob: 'patience', from: 5, to: 6 }).rail, 'bounds');
  assert.equal(ok({ knob: 'size', from: 1, to: 0 }).rail, 'declared-only');
  assert.equal(ok({ knob: 'nope', from: 0, to: 1 }).rail, 'unknown-knob');
  assert.equal(ok({ knob: Flow.ITEM, from: 0, to: 1 }).rail, 'unknown-knob', 'items is not a knob');
  assert.equal(ok({ knob: 'patience', from: 2, to: 3, frozen: true }).rail, 'hold');
});

test('the guard keeps responses calm: one change each, no bounce back up, a pause after a raise', () => {
  const raised = [{ step: 3, phase: 'response', knob: 'spawn', from: 2, to: 3, direction: 1 }];
  const eased = [{ step: 3, phase: 'response', knob: 'patience', from: 3, to: 2, direction: -1 }];
  const at = input => Flow.check({ spec, ...input });
  assert.equal(
    at({ knob: 'patience', from: 2, to: 1, step: 3, history: raised }).rail,
    'one-change-per-response',
  );
  assert.equal(at({ knob: 'patience', from: 2, to: 3, step: 4, history: eased }).rail, 'no-bounce');
  assert.equal(
    at({ knob: 'patience', from: 2, to: 1, step: 4, history: eased }).ok,
    true,
    'easing is never held back',
  );
  assert.equal(
    at({ knob: 'patience', from: 2, to: 3, step: 4, history: raised }).rail,
    'cool-down',
  );
  assert.equal(
    at({ knob: 'spawn', from: 3, to: 2, step: 4, history: raised }).ok,
    true,
    'easing right after a raise is allowed',
  );
  assert.equal(
    at({ knob: 'patience', from: 2, to: 3, step: 3 + Flow.COOL_DOWN + 1, history: raised }).ok,
    true,
  );
  const opening = [{ step: 0, phase: 'opening', knob: 'patience', from: 2, to: 1, direction: -1 }];
  assert.equal(
    at({ knob: 'patience', from: 1, to: 0, step: 0, phase: 'opening', history: opening }).ok,
    true,
    'opening placement may take several steps',
  );
  assert.deepEqual([Flow.FLIP_WINDOW, Flow.COOL_DOWN], [Temper.FLIP_WINDOW, Temper.COOL_DOWN]);
});

test('the guard is a leaf: it imports nothing, the algorithm imports only it, and the lines import nothing', () => {
  const imports = name =>
    [
      ...fs
        .readFileSync(subjectPath('src', 'flow', name), 'utf8')
        .matchAll(/^import .* from '([^']+)';$/gm),
    ]
      .map(m => m[1])
      .sort();
  assert.deepEqual(imports('guard.mjs'), []);
  assert.deepEqual(imports('flow.mjs'), ['./guard.mjs']);
  assert.deepEqual(imports('lines.mjs'), []);
});

// 임의 입력: 손잡이(있는 것 · 없는 것 · items · 본인 선택만 따르는 것) · 자리 · 단계 · 기록(여는 자리 · 응답 · 받아들임) · 멈춤.
const PHASES = ['opening', 'response', 'accepted', 'bogus', undefined];
const KNOBS = ['patience', 'spawn', 'hint', 'size', 'nope', Flow.ITEM];
function randomInput(random) {
  const pick = list => list[Math.floor(random() * list.length)];
  const int = (low, high) => low + Math.floor(random() * (high - low + 1));
  const history = Array.from({ length: int(0, 5) }, () => {
    const from = int(0, 5);
    const direction = random() < 0.5 ? -1 : 1;
    return {
      step: int(0, 8),
      phase: pick(['opening', 'response', 'accepted']),
      knob: pick(KNOBS.slice(0, 4)),
      from,
      to: from + direction,
      direction,
    };
  });
  const from = random() < 0.05 ? 1.5 : int(-1, 6);
  return {
    spec,
    knob: pick(KNOBS),
    from,
    to: random() < 0.1 ? from + int(-2, 2) : from + (random() < 0.5 ? -1 : 1),
    step: random() < 0.03 ? 'x' : int(0, 9),
    ...(random() < 0.9 ? { phase: pick(PHASES) } : {}),
    ...(random() < 0.95 ? { history } : {}),
    ...(random() < 0.1 ? { frozen: true } : {}),
  };
}

test('3,000 random inputs: the new guard answers as the old temper.check does', () => {
  const random = seeded(20261119);
  const rails = new Set();
  for (let n = 0; n < 3000; n += 1) {
    const input = randomInput(random);
    const expected = Temper.check(input);
    assert.deepEqual(Flow.check(input), expected, `input ${n}: ${JSON.stringify(input)}`);
    rails.add(expected.rail);
  }
  // 모든 레일이 한 번 이상 나와야 맞댐이 무디지 않다.
  assert.deepEqual(
    rails,
    new Set([
      'bounds',
      'cool-down',
      'declared-only',
      'hold',
      'invalid',
      'no-bounce',
      'one-change-per-response',
      'one-step',
      'unknown-knob',
      null,
    ]),
  );
});
