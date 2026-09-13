import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, stepScene, getScenePose, sampleWind, LIMITS, CONFIG } from '../tools/lib/loom-scene.mjs';

function run(hz, duration, input = {}) {
  const s = createScene({ seed: 41 });
  for (let i = 0; i < duration * hz; i++) stepScene(s, 1 / hz, input);
  return s;
}
function poseWithoutMode(s) {
  const { mode, ...pose } = getScenePose(s);
  return pose;
}
test('same input and seed produce the same motion at 30, 60 and 120 Hz', () => {
  const input = { pointer: { x: 0.7, y: -0.3, active: true, pressed: true } };
  const baseline = getScenePose(run(120, 16, input));
  for (const hz of [30, 60]) assert.deepEqual(getScenePose(run(hz, 16, input)), baseline);
});
test('frame spikes and invalid dt cannot produce a jump or non-finite pose', () => {
  const s = createScene();
  stepScene(s, 500, { pointer: { x: Infinity, y: -100, active: true, pressed: true } });
  assert.ok(s.time <= LIMITS.maxDt + 1e-10);
  for (const dt of [NaN, Infinity, -1, 1e9]) stepScene(s, dt);
  for (const [key, value] of Object.entries(getScenePose(s))) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value), key);
  }
  assert.ok(Math.abs(s.body.turn) <= LIMITS.turn);
  assert.ok(s.body.compression <= LIMITS.compression);
});
test('hidden, pause and reduced motion freeze all animation and discard resume gap', () => {
  for (const flag of ['hidden', 'paused', 'reducedMotion']) {
    const s = run(60, 2, { pointer: { x: 0.5, active: true, pressed: true } });
    const before = poseWithoutMode(s);
    for (let i = 0; i < 10; i++) stepScene(s, 10, { [flag]: true });
    assert.deepEqual(poseWithoutMode(s), before);
    stepScene(s, 200);
    assert.deepEqual(poseWithoutMode(s), before);
    stepScene(s, 1 / 60);
    assert.ok(s.time > before.time && s.time < before.time + 0.02);
  }
});
test('one shared gust reaches spatially separated props; holding does not restart it', () => {
  const still = createScene({ seed: 7, windStrength: 0 });
  const gust = createScene({ seed: 7, windStrength: 0 });
  for (let i = 0; i < 120; i++) {
    stepScene(still, 1 / 60);
    stepScene(gust, 1 / 60, { gust: true });
  }
  assert.equal(still.wind, 0);
  assert.ok(Math.abs(gust.wind - gust.config.gustStrength) < 1e-8);
  const left = sampleWind(gust, -1, -1), right = sampleWind(gust, 1, 1);
  assert.ok(left > 0 && right > 0 && Math.abs(left - right) < 0.06);
  assert.equal(gust.gustStart, 0);
});
test('eyes lead the body; releasing touch settles compression without exceeding 4%', () => {
  const s = run(120, 0.1, { pointer: { x: 1, active: true, pressed: true } });
  assert.ok(s.attention.x > s.body.turn / LIMITS.turn);
  for (let i = 0; i < 120; i++) {
    stepScene(s, 1 / 120, { pointer: { x: 1, active: true, pressed: true } });
    assert.ok(s.body.compression >= 0 && s.body.compression <= 0.04);
  }
  assert.ok(s.body.compression > 0.039);
  for (let i = 0; i < 360; i++) stepScene(s, 1 / 120);
  assert.ok(s.body.compression < 0.00001);
  assert.ok(Math.abs(s.body.turn) < 0.001);
});
test('seeded attention has rest periods, blinks remain 5–10 seconds apart', () => {
  const s = createScene({ seed: 11 });
  let lastBlink = 0, count = 0, visible = 0, rest = 0;
  for (let i = 0; i < 60 * 60; i++) {
    const previousStart = s.blinkStart;
    const p = stepScene(s, 1 / 60);
    if (s.blinkStart !== previousStart) {
      const interval = s.blinkStart - lastBlink;
      assert.ok(interval >= 5 && interval <= 10 + LIMITS.step);
      lastBlink = s.blinkStart; count++;
    }
    if (p.leaf.visible) visible++;
    if (p.mode === 'rest') rest++;
    assert.ok(p.blink >= 0 && p.blink <= 1);
  }
  assert.ok(count >= 5 && visible > 0 && rest > visible);
});

const GUST_EPSILON = 1e-8;
function advanceFor(state, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds * 120); i++) stepScene(state, 1 / 120, input);
  return getScenePose(state);
}
function near(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) <= GUST_EPSILON, `${label}: ${actual} != ${expected}`);
}

test('two automatic cycles keep wind exactly zero outside seconds 12–15 and 27–30', () => {
  assert.equal(CONFIG.gustInterval, 15);
  assert.equal(CONFIG.gustDuration, 3);
  assert.equal(CONFIG.gustPeak, 2);
  const s = createScene({ seed: 41 });
  near(s.nextGust, 12, 'first automatic start');
  assert.equal(getScenePose(s).gustEnvelope, 0);
  assert.equal(s.wind, 0);
  for (let tick = 1; tick <= 30 * 120; tick++) {
    const p = stepScene(s, 1 / 120);
    const t = tick / 120;
    const active = (t > 12 && t < 15) || (t > 27 && t < 30);
    near(p.time, t, 'scene clock');
    assert.ok(p.gustEnvelope >= 0 && p.gustEnvelope <= 1, `envelope at ${t}`);
    if (active) {
      assert.ok(p.gustEnvelope > 0, `missing burst at ${t}`);
      assert.ok(p.wind > 0, `missing shared wind at ${t}`);
    } else {
      near(p.gustEnvelope, 0, `quiet envelope at ${t}`);
      // The resting grass must receive an exact zero, not residual ambient wind.
      if ([12, 15, 27, 30].includes(t)) {
        near(p.wind, 0, `wind at floating-point boundary ${t}`);
      } else {
        assert.equal(p.wind, 0, `quiet wind at ${t}`);
        assert.equal(sampleWind(s, -1, -1), 0);
        assert.equal(sampleWind(s, 1, 1), 0);
      }
    }
  }
  near(s.nextGust, 42, 'third automatic start');
});

test('a burst rises for two seconds, peaks once, then fades to zero at three seconds', () => {
  const s = createScene();
  stepScene(s, 0, { gust: true });
  near(getScenePose(s).gustAge, 0, 'initial age');
  near(getScenePose(s).gustEnvelope, 0, 'initial envelope');
  let previous = 0;
  for (let tick = 1; tick <= 3 * 120; tick++) {
    const p = stepScene(s, 1 / 120);
    near(p.gustAge, tick / 120, 'burst age');
    if (tick <= 2 * 120) assert.ok(p.gustEnvelope + GUST_EPSILON >= previous, 'fade-in must not reverse');
    else assert.ok(p.gustEnvelope <= previous + GUST_EPSILON, 'fade-out must not reverse');
    if (tick === 120) assert.ok(p.gustEnvelope > 0 && p.gustEnvelope < 1);
    if (tick === 240) near(p.gustEnvelope, 1, 'peak at two seconds');
    if (tick === 300) assert.ok(p.gustEnvelope > 0 && p.gustEnvelope < 1);
    previous = p.gustEnvelope;
  }
  near(getScenePose(s).gustEnvelope, 0, 'end at three seconds');
  near(s.wind, 0, 'wind at three-second boundary');
  assert.equal(stepScene(s, 1 / 120).wind, 0);
});

test('clicks during an active burst cannot restart or extend it or postpone the next burst', () => {
  const s = createScene();
  advanceFor(s, 5);
  stepScene(s, 0, { gust: true });
  near(s.gustStart, 5, 'manual start during stillness');
  near(s.nextGust, 20, 'manual click schedules next start fifteen seconds later');
  for (let tick = 1; tick <= 3 * 120; tick++) {
    // Separate rising edges, including another click while fading out.
    stepScene(s, 1 / 120, { gust: [60, 120, 300].includes(tick) });
    near(s.gustStart, 5, 'repeated click keeps original start');
    near(s.nextGust, 20, 'repeated click keeps original schedule');
  }
  near(s.wind, 0, 'manual burst end');
  for (let tick = 1; tick < 12 * 120; tick++) {
    const p = stepScene(s, 1 / 120);
    assert.equal(p.wind, 0, `twelve-second rest at ${p.time}`);
    assert.equal(p.gustEnvelope, 0);
  }
  stepScene(s, 1 / 120);
  near(s.gustStart, 20, 'next scheduled start');
  assert.ok(stepScene(s, 1 / 120).gustEnvelope > 0);
});

test('pause, hidden and reduced motion freeze a burst and its schedule without a resume jump', () => {
  for (const flag of ['paused', 'hidden', 'reducedMotion']) {
    const s = createScene();
    advanceFor(s, 13);
    const before = poseWithoutMode(s);
    assert.ok(before.gustEnvelope > 0 && before.gustEnvelope < 1);
    const start = s.gustStart, next = s.nextGust;
    for (let i = 0; i < 8; i++) stepScene(s, 60, { [flag]: true });
    assert.deepEqual(poseWithoutMode(s), before, flag);
    assert.equal(s.gustStart, start);
    assert.equal(s.nextGust, next);
    stepScene(s, 500);
    assert.deepEqual(poseWithoutMode(s), before, `${flag} resume gap`);
    const resumed = stepScene(s, 1 / 120);
    near(resumed.time, before.time + 1 / 120, 'first advancing frame');
    near(resumed.gustAge, before.gustAge + 1 / 120, 'burst age resumes locally');
    assert.equal(s.nextGust, next);
  }
});

test('seeded leaf events cannot create independent wind during scheduled resting periods', () => {
  for (const seed of [7, 11, 41]) {
    const s = createScene({ seed });
    for (let tick = 1; tick <= 75 * 120; tick++) {
      const p = stepScene(s, 1 / 120);
      const cycleTime = (tick / 120) % 15;
      if (cycleTime <= 12) {
        if (cycleTime === 0 || cycleTime === 12) near(p.wind, 0, 'scheduled boundary');
        else assert.equal(p.wind, 0, `leaf cannot start wind: seed ${seed}, time ${p.time}`);
        near(p.gustEnvelope, 0, 'resting envelope');
      }
    }
  }
});
