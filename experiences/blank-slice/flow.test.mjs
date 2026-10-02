import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { hangTime } from './core.mjs';
import { FLOW_SLICE, FLOW_WORDS, sliceObservation } from './learning.mjs';

// 조각이 떠 있는 시간만 사람에 맞춰 움직이고, 피곤한 날은 빨라지지 않는지 실제 엔진으로 본다.
const require = createRequire(import.meta.url);
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
const setup = () => {
  let t = Date.parse('2026-10-03T09:00:00Z');
  const store = new Map();
  return createGame({ gameId: 'blank-slice', map, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    clock: () => new Date(t += 8000).toISOString() });
};
const slice = (live, word, used) => live.observe(sliceObservation({ word, answer: '우산', used }));

test('처음은 원래 체공 시간 그대로, 베기 결과는 읽기 기록이 아니라 속도 신호', () => {
  const coach = setup(), live = coach.live(FLOW_SLICE, { words: FLOW_WORDS });
  assert.equal(live.settings().values.hang, 1);
  assert.deepEqual(sliceObservation({ word: null, answer: '우산' }), { outcome: 'timeout' });
  assert.deepEqual(sliceObservation({ word: '우산', answer: '우산', used: 0.4 }), { outcome: 'success', pressure: 0.4 });
  assert.deepEqual(sliceObservation({ word: '가방', answer: '우산', used: 0.4 }), { outcome: 'fail', pressure: 0.4 });
  slice(live, '우산', 0.3);
  assert.equal(coach.summary().independent, 0, '베기는 공통 학습 기록을 만들지 않는다');
});

test('놓치면 조각이 더 오래 떠 있고, 일찍 바르게 베면 조금씩 빨라진다(한 번에 한 칸)', () => {
  const missing = setup().live(FLOW_SLICE, { words: FLOW_WORDS });
  const eased = [null, null, null].map((w) => slice(missing, w)).filter((o) => o.change);
  assert.ok(eased.length >= 1 && eased.every((o) => o.change.direction < 0));
  assert.ok(missing.settings().values.hang > 1);
  assert.ok(eased.some((o) => o.line?.text === FLOW_WORDS['ease.pace']));
  const quick = setup().live(FLOW_SLICE, { words: FLOW_WORDS });
  const raised = Array(14).fill('우산').map((w) => slice(quick, w, 0.3)).filter((o) => o.change);
  assert.ok(raised.length >= 1 && raised.every((o) => o.change.direction > 0 && o.change.to - o.change.from === 1));
  assert.ok(quick.settings().values.hang < 1);
  assert.ok(quick.settings().values.hang >= 0.9, '가장 빨라도 원래의 0.9배');
});

test('피곤한 날은 빨라지지 않는다(순간 맞춤도, 연속 가속도)', () => {
  const coach = setup();
  coach.setToday('tired');
  const live = coach.live(FLOW_SLICE, { words: FLOW_WORDS });
  assert.equal(live.intro().line.text, FLOW_WORDS['start.tired']);
  for (let i = 0; i < 14; i += 1) { const out = slice(live, '우산', 0.3); assert.ok(!out.change || out.change.direction < 0); }
  assert.ok(live.settings().values.hang >= 1);
  // 연속 가속은 게임 쪽에서 끈다: 피곤한 날 콤보 0으로 계산한 체공 시간은 콤보가 쌓여도 같다.
  assert.equal(hangTime({ difficulty: 1, combo: 0 }), 3.6);
  assert.ok(hangTime({ difficulty: 1, combo: 6 }) < 3.6, '보통 날은 연속으로 맞히면 빨라진다');
});
