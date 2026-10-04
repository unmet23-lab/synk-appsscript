// 공이 오는 시간만 사람에 맞춰 움직이고, 피곤한 날은 빨라지지 않는지 실제 엔진으로 본다(빈칸 베기 flow.test.mjs와 같은 방식).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { flightTime } from './core.mjs';
import { FLOW_RALLY, FLOW_WORDS, rallyObservation } from './learning.mjs';

const require = createRequire(import.meta.url);
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/topik-i.js').topikMap());
const setup = () => {
  let t = Date.parse('2026-10-03T09:00:00Z');
  const store = new Map();
  return createGame({ gameId: 'talk-rally', map, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    clock: () => new Date(t += 8000).toISOString() });
};
const rally = (live, choice, used, assisted = false) => live.observe(rallyObservation({ choice, answer: '고마워요.', used, assisted }));

test('처음은 원래 속도(1배), 받아치기 결과는 듣기 기록이 아니라 속도 신호', () => {
  const coach = setup(), live = coach.live(FLOW_RALLY, { words: FLOW_WORDS });
  assert.equal(live.settings().values.flight, 1);
  assert.deepEqual(rallyObservation({ choice: null, answer: '고마워요.' }), { outcome: 'timeout' });
  assert.deepEqual(rallyObservation({ choice: '고마워요.', answer: '고마워요.', used: 0.4 }), { outcome: 'success', pressure: 0.4, assisted: false });
  assert.deepEqual(rallyObservation({ choice: '미안해요.', answer: '고마워요.', used: 0.4 }), { outcome: 'fail', pressure: 0.4, assisted: false });
  assert.deepEqual(rallyObservation({ choice: '고마워요.', answer: '고마워요.', used: 9, assisted: true }), { outcome: 'success', pressure: 1.5, assisted: true }, '기다린 뒤 고른 답은 압박 1.5');
  rally(live, '고마워요.', 0.3);
  assert.equal(coach.summary().independent, 0, '받아치기는 공통 학습 기록을 만들지 않는다');
});

test('공이 기다린 뒤에야 고르면 공이 천천히 오고, 일찍 바르게 받아치면 조금씩 빨라진다(한 번에 한 칸, 가장 빨라도 0.9배)', () => {
  const waiting = setup().live(FLOW_RALLY, { words: FLOW_WORDS });
  const eased = Array(8).fill('고마워요.').map((c) => rally(waiting, c, 1.5)).filter((o) => o.change);
  assert.ok(eased.length >= 1 && eased.every((o) => o.change.direction < 0));
  assert.ok(waiting.settings().values.flight > 1);
  assert.ok(eased.some((o) => o.line?.text === FLOW_WORDS['ease.pace']));
  const quick = setup().live(FLOW_RALLY, { words: FLOW_WORDS });
  const raised = Array(14).fill('고마워요.').map((c) => rally(quick, c, 0.2)).filter((o) => o.change);
  assert.ok(raised.length >= 1 && raised.every((o) => o.change.direction > 0 && o.change.to - o.change.from === 1));
  assert.ok(quick.settings().values.flight < 1);
  assert.ok(quick.settings().values.flight >= 0.9, '가장 빨라도 원래의 0.9배');
  const helped = setup().live(FLOW_RALLY, { words: FLOW_WORDS });
  for (let i = 0; i < 14; i += 1) { const out = rally(helped, '고마워요.', 0.2, true); assert.ok(!out.change || out.change.direction < 0, '다시 듣기·글로 보기를 쓴 답으로는 빨라지지 않는다'); }
});

test('피곤한 날은 빨라지지 않는다(순간 맞춤도, 랠리 가속도)', () => {
  const coach = setup();
  coach.setToday('tired');
  const live = coach.live(FLOW_RALLY, { words: FLOW_WORDS });
  assert.equal(live.intro().line.text, FLOW_WORDS['start.tired']);
  for (let i = 0; i < 14; i += 1) { const out = rally(live, '고마워요.', 0.2); assert.ok(!out.change || out.change.direction < 0); }
  assert.ok(live.settings().values.flight >= 1);
  // 랠리 가속은 게임 쪽에서 끈다: 피곤한 날 랠리 0으로 계산한 공 시간은 랠리가 이어져도 같다.
  assert.equal(flightTime({ rally: 0 }), 2.8);
  assert.ok(flightTime({ rally: 6 }) < 2.8, '보통 날은 랠리가 이어지면 빨라진다');
});
