import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, stepScene, getScenePose, sampleWind, LIMITS } from '../tools/lib/loom-scene.mjs';

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
