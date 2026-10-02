'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../tools/lib/loom-motion.js');

const near = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
};

test('standalone browser and CommonJS expose the same scheduler-free API', () => {
  const browser = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../tools/lib/loom-motion.js'), 'utf8'), browser);
  assert.deepEqual(Object.keys(browser.LoomMotion), Object.keys(M));
  near(browser.LoomMotion.damp(0, 1, 0.25, 1), M.damp(0, 1, 0.25, 1));
  assert.equal(typeof browser.requestAnimationFrame, 'undefined');
});

test('60, 120 and 144 Hz trajectories agree with exact one-second endpoints', () => {
  const target = 0.85;
  // Nonzero initial spring speed catches integration schemes that merely ease position.
  const expectedSpring = { value: -0.3, velocity: 0.7 };
  M.advanceSpring(expectedSpring, target, 0.35, 1);
  for (const hz of [60, 120, 144]) {
    let value = -0.3;
    const spring = { value: -0.3, velocity: 0.7 };
    const coast = { value: -0.3, velocity: 0.7 };
    for (let i = 0; i < hz; i++) {
      value = M.damp(value, target, 0.35, 1 / hz);
      M.advanceSpring(spring, target, 0.35, 1 / hz);
      M.coast(coast, 2.4, 1 / hz);
    }
    near(value, target + (-0.3 - target) * Math.exp(-1 / 0.35));
    near(spring.value, expectedSpring.value);
    near(spring.velocity, expectedSpring.velocity);
    near(coast.value, -0.3 + 0.7 * (1 - Math.exp(-2.4)) / 2.4);
    near(coast.velocity, 0.7 * Math.exp(-2.4));
  }
});

test('spring settles at rest without overshoot and preserves velocity across target changes', () => {
  const spring = { value: 0, velocity: 0 };
  let previous = 0;
  for (let i = 0; i < 600; i++) {
    assert.equal(M.advanceSpring(spring, 1, 0.3, 1 / 60), spring);
    assert.ok(spring.value >= previous && spring.value <= 1);
    previous = spring.value;
  }
  near(spring.value, 1);
  near(spring.velocity, 0);
  M.advanceSpring(spring, -1, 0.3, 1 / 60);
  assert.ok(spring.value < 1 && spring.value > -1 && spring.velocity < 0);
  const before = { ...spring };
  M.advanceSpring(spring, 1, 0.3, 0);
  assert.deepEqual(spring, before);
});

test('damping and spring zero response snap only when time advances', () => {
  assert.equal(M.damp(2, 8, 0, 0), 2);
  assert.equal(M.damp(2, 8, 0, 0.01), 8);
  const state = { value: 2, velocity: 3 };
  M.advanceSpring(state, 8, 0, 0.01);
  assert.deepEqual(state, { value: 8, velocity: 0 });
  M.advanceSpring(state, -4, Number.MIN_VALUE, 0.01);
  assert.deepEqual(state, { value: -4, velocity: 0 });
});

test('coasting clamps both bounds, cancels outward velocity and permits returning inward', () => {
  for (const direction of [-1, 1]) {
    const state = { value: direction * 0.9, velocity: direction * 5 };
    assert.equal(M.coast(state, 2, 0.1, -1, 1), state);
    assert.deepEqual(state, { value: direction, velocity: 0 });
    state.velocity = -direction;
    M.coast(state, 2, 0.1, -1, 1);
    assert.ok(Math.abs(state.value) < 1);
    assert.equal(Math.sign(state.velocity), -direction);
  }
  const linear = { value: 2, velocity: -3 };
  M.coast(linear, 0, 0.5);
  assert.deepEqual(linear, { value: 0.5, velocity: -3 });
});

test('invalid or negative time never moves a motion state', () => {
  for (const dt of [0, -1, NaN, Infinity, undefined]) {
    assert.equal(M.damp(2, 8, 0.2, dt), 2);
    const spring = { value: 2, velocity: 3 };
    const coast = { ...spring };
    M.advanceSpring(spring, 8, 0.2, dt);
    M.coast(coast, 2, dt, 0, 1);
    assert.deepEqual(spring, { value: 2, velocity: 3 });
    assert.deepEqual(coast, { value: 2, velocity: 3 });
  }
});

test('clock integrates equal visual time at 60, 120 and 144 Hz', () => {
  for (const hz of [60, 120, 144]) {
    const clock = M.createClock();
    assert.deepEqual(M.stepClock(clock, 4000), { rawDt: 0, dt: 0, time: 0, firstFrame: true });
    for (let i = 1; i <= hz; i++) {
      const frame = M.stepClock(clock, 4000 + i * 1000 / hz);
      near(frame.dt, 1 / hz);
      assert.equal(frame.firstFrame, false);
    }
    near(clock.time, 1);
  }
});

test('pause and background freeze time and discard the resume interval', () => {
  for (const flag of ['paused', 'hidden']) {
    const clock = M.createClock();
    M.stepClock(clock, 1000);
    M.stepClock(clock, 1020);
    let frame = M.stepClock(clock, 1030, { [flag]: true });
    assert.equal(frame.dt, 0);
    near(frame.time, 0.02);
    frame = M.stepClock(clock, 90000, { [flag]: true });
    near(frame.rawDt, 88.97);
    assert.equal(frame.dt, 0);
    frame = M.stepClock(clock, 120000);
    assert.equal(frame.firstFrame, true);
    assert.equal(frame.rawDt, 30);
    assert.equal(frame.dt, 0);
    near(frame.time, 0.02);
    frame = M.stepClock(clock, 120020);
    near(frame.time, 0.04);
    assert.equal(frame.firstFrame, false);
  }
});

test('a long active frame retains raw time while bounding its visual step', () => {
  const clock = M.createClock();
  M.stepClock(clock, 0);
  const frame = M.stepClock(clock, 5000);
  assert.deepEqual(frame, { rawDt: 5, dt: 0.1, time: 0.1, firstFrame: false });
});

test('reset retains visual time and skips the first returning frame', () => {
  const clock = M.createClock();
  M.stepClock(clock, 0);
  M.stepClock(clock, 20);
  assert.equal(M.resetClock(clock), clock);
  near(clock.time, 0.02);
  assert.deepEqual(M.stepClock(clock, 90000), { rawDt: 0, dt: 0, time: 0.02, firstFrame: true });
  near(M.stepClock(clock, 90020).time, 0.04);
});

test('invalid and backwards timestamps rebase without negative time or catch-up', () => {
  for (const invalid of [NaN, Infinity, -1, undefined]) {
    const clock = M.createClock();
    M.stepClock(clock, 1000);
    M.stepClock(clock, 1020);
    assert.deepEqual(M.stepClock(clock, invalid), { rawDt: 0, dt: 0, time: 0.02, firstFrame: true });
    assert.deepEqual(M.stepClock(clock, 8000), { rawDt: 0, dt: 0, time: 0.02, firstFrame: true });
    near(M.stepClock(clock, 8020).time, 0.04);
  }
  const clock = M.createClock();
  M.stepClock(clock, 1000);
  M.stepClock(clock, 1020);
  assert.deepEqual(M.stepClock(clock, 500), { rawDt: 0, dt: 0, time: 0.02, firstFrame: true });
  near(M.stepClock(clock, 520).time, 0.04);
});
