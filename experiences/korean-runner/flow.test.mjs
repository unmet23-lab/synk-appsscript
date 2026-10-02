import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { RunnerModel, DEFAULT_PACE, MAX_SPEED } from './core.mjs';
import { FLOW_RUN, TIRED_RUN, FLOW_WORDS, paceOf, runObservation } from './learning.mjs';

// 바람길의 속도만 사람에 맞춰 움직이고, 피곤한 날은 판 안에서 빨라지지 않는지 실제 엔진으로 본다.
const require = createRequire(import.meta.url);
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
const setup = () => {
  let t = Date.parse('2026-10-03T09:00:00Z');
  const store = new Map();
  return createGame({ gameId: 'korean-runner', map, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    clock: () => new Date(t += 20000).toISOString() });
};
const done = { type: 'correct' }, missed = { type: 'wrong', record: { steps: [{ status: 'missed' }] } }, late = { type: 'wrong', record: { steps: [{ status: 'timing' }] } };

test('처음 달리는 사람은 원래 바람길 그대로 시작한다', () => {
  const live = setup().live(FLOW_RUN, { words: FLOW_WORDS });
  assert.deepEqual(paceOf(live.settings().values), { ...DEFAULT_PACE });
  assert.equal(live.intro().line, null);
});

test('지시를 놓치면 느긋해지고, 연달아 해내면 조금씩 빨라진다(한 번에 한 칸, 최고 속도는 그대로)', () => {
  const struggling = setup().live(FLOW_RUN, { words: FLOW_WORDS });
  const eased = [missed, missed, missed, missed].map((n) => struggling.observe(runObservation(n))).filter((o) => o.change);
  assert.ok(eased.length >= 1 && eased.every((o) => o.change.direction < 0), '놓치면 느긋해진다');
  assert.ok(eased.some((o) => o.line?.text === FLOW_WORDS['ease.pace']));
  const fluent = setup().live(FLOW_RUN, { words: FLOW_WORDS });
  const raised = Array(14).fill(done).map((n) => fluent.observe(runObservation(n))).filter((o) => o.change);
  assert.ok(raised.length >= 1 && raised.every((o) => o.change.direction > 0 && Math.abs(o.change.to - o.change.from) === 1));
  // 가장 빠른 설정에서도 지시 음성이 끝나기 전에 동작이 오지 않도록 속도는 MAX_SPEED를 넘지 않는다.
  const fastest = new RunnerModel({ seed: 3, pace: { speed: FLOW_RUN.knobs[0].values.at(-1), ramp: FLOW_RUN.knobs[1].values.at(-1) } });
  fastest.events = []; fastest.missions = []; fastest.generated = 1e9; fastest.nextMission = fastest.nextWave = fastest.nextCoin = 1e9;
  for (let i = 0; i < 12000; i += 1) fastest.step(0.05);
  assert.equal(fastest.speed, MAX_SPEED);
});

test('타이밍이 늦은 동작은 시간 안의 실수, 지시 중이 아닌 장애물 충돌만 시간 부족이다', () => {
  assert.deepEqual(runObservation(late), { outcome: 'fail' });
  assert.deepEqual(runObservation(missed), { outcome: 'timeout' });
  assert.deepEqual(runObservation({ type: 'hit', mission: null }), { outcome: 'timeout' });
  assert.equal(runObservation({ type: 'hit', mission: { id: 'left' } }), null, '지시 중 충돌은 그 지시의 결과에 이미 들어 있다');
  assert.equal(runObservation({ type: 'near' }), null);
});

test('피곤한 날은 판 안에서 빨라지지 않고, 그날의 가벼운 시작은 다음 날로 남지 않는다', () => {
  const coach = setup();
  coach.setToday('tired');
  const tired = coach.live(FLOW_RUN, { words: FLOW_WORDS, declared: TIRED_RUN });
  assert.equal(tired.intro().line.text, FLOW_WORDS['start.tired']);
  assert.equal(tired.settings().values.ramp, 0, '판 안 가속 없음');
  const model = new RunnerModel({ seed: 5, pace: paceOf(tired.settings().values) });
  model.events = []; model.missions = []; model.generated = 1e9; model.nextMission = model.nextWave = model.nextCoin = 1e9;
  const first = model.speed;
  for (const n of Array(10).fill(done)) { const out = tired.observe(runObservation(n)); assert.ok(!out.change || out.change.direction < 0); }
  for (let i = 0; i < 1800; i += 1) model.step(0.05);
  assert.ok(model.speed <= first, '90초를 달려도 처음보다 빨라지지 않는다');
  tired.end();
  coach.setToday(null);
  assert.deepEqual(paceOf(coach.live(FLOW_RUN, { words: FLOW_WORDS }).settings().values), { ...DEFAULT_PACE });
});

test('새 속도로 바꿀 때 처음 속도는 한 번에 뛰지 않고 미끄러지듯 따라간다', () => {
  const model = new RunnerModel({ seed: 7 });
  model.events = []; model.missions = []; model.generated = 1e9; model.nextMission = model.nextWave = model.nextCoin = 1e9;
  model.tune({ speed: 11, ramp: 0 });
  model.step(0.05);
  assert.ok(model.speed > 12.9 && model.speed < 13, '한 프레임에는 조금만');
  for (let i = 0; i < 60; i += 1) model.step(0.05);
  assert.equal(model.speed, 11);
});
