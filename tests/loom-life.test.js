'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const L = require('../tools/lib/loom-life.js');
const M = require('../tools/lib/loom-motion.js');

const source = () => ({ id: 'seat-use', revision: 4, steps: [
  { id: 'guest-walk', actor: 'guest', from: { x: 0, y: 0 }, to: { x: 4, y: 2 }, durationMs: 1000, pose: 'walking', endPose: 'standing' },
  { id: 'guest-sit', actor: 'guest', from: { x: 4, y: 2 }, to: { x: 4, y: 2 }, durationMs: 300, pose: 'sitting', endPose: 'seated' },
  { id: 'host-serve', actor: 'host', from: { x: 8, y: 0 }, to: { x: 4, y: 1 }, durationMs: 700, pose: 'carrying', endPose: 'serving' },
] });
const context = (extra = {}) => ({ currentRevision: 4, ...extra });
const allSteps = source().steps.map(step => step.id);

test('CommonJS and standalone browser share a scheduler-free view API', () => {
  const browser = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../tools/lib/loom-life.js'), 'utf8'), browser);
  assert.deepEqual(Object.keys(browser.LoomLife), Object.keys(L));
  const plan = browser.LoomLife.createPlan(source());
  assert.equal(browser.LoomLife.sample(plan, 2000, context()).visualComplete, true);
  assert.equal(typeof browser.setTimeout, 'undefined');
  assert.equal(typeof browser.localStorage, 'undefined');
});

test('sequential multi-actor pose preserves a seated guest during later serving', () => {
  const plan = L.createPlan(source());
  const midway = L.sample(plan, 500, context());
  assert.deepEqual({ ...midway.actors.guest }, { x: 2, y: 1, pose: 'walking' });
  assert.deepEqual({ ...midway.actors.host }, { x: 8, y: 0, pose: 'idle' });
  assert.deepEqual(midway.visualStepIds, []);
  const serving = L.sample(plan, 1650, context());
  assert.deepEqual({ ...serving.actors.guest }, { x: 4, y: 2, pose: 'seated' });
  assert.deepEqual({ ...serving.actors.host }, { x: 6, y: 0.5, pose: 'carrying' });
  assert.deepEqual(serving.visualStepIds, ['guest-walk', 'guest-sit']);
  assert.equal(serving.visualComplete, false);
});

test('revision changes, explicit cancellation and replaced plans cannot show stale actors', () => {
  const plan = L.createPlan(source());
  for (const current of [context({ currentRevision: 5 }), context({ cancelled: true }), context({ currentPlanId: 'new-seat-use' }), {}]) {
    const view = L.sample(plan, 2000, current);
    assert.equal(view.status, 'cancelled');
    assert.deepEqual(view.actors, {});
    assert.equal(view.visualComplete, false);
    assert.equal(L.canAcknowledge(plan, { ...current, visible: true, assetsReady: true,
      committedStepIds: allSteps, appliedStepIds: allSteps }), false);
  }
});

test('time ending alone cannot acknowledge game facts, assets or visible presentation', () => {
  const plan = L.createPlan(source());
  assert.equal(L.sample(plan, 2000, context()).visualComplete, true);
  const ready = context({ visible: true, assetsReady: true, committedStepIds: allSteps, appliedStepIds: allSteps });
  assert.equal(L.canAcknowledge(plan, ready), true);
  for (const change of [{ visible: false }, { paused: true }, { hidden: true },
    { assetsReady: false }, { committedStepIds: [] },
    { appliedStepIds: [] }, { committedStepIds: allSteps.slice(0, 2) }, { appliedStepIds: allSteps.slice(1) }]) {
    assert.equal(L.canAcknowledge(plan, { ...ready, ...change }), false);
  }
});

test('reduced motion shows only the contiguous confirmed prefix, then the same final poses', () => {
  const plan = L.createPlan(source());
  const none = L.sample(plan, 9999, context({ reducedMotion: true, committedStepIds: [] }));
  assert.deepEqual({ ...none.actors.guest }, { x: 0, y: 0, pose: 'idle' });
  assert.equal(none.visualComplete, false);
  const prefix = L.sample(plan, 0, context({ reducedMotion: true, committedStepIds: ['guest-walk', 'host-serve'] }));
  assert.deepEqual(prefix.visualStepIds, ['guest-walk']);
  assert.deepEqual({ ...prefix.actors.guest }, { x: 4, y: 2, pose: 'standing' });
  assert.equal(prefix.actors.host.pose, 'idle');
  const final = L.sample(plan, 0, context({ reducedMotion: true, committedStepIds: allSteps }));
  assert.deepEqual(final.actors, L.sample(plan, 2000, context()).actors);
  assert.deepEqual(final.actors, plan.finalPose);
  assert.equal(final.presentation, 'static');
  assert.equal(final.visualComplete, true);
});

test('existing Loom clock freezes hidden time without completing an unseen visit', () => {
  const plan = L.createPlan(source()), clock = M.createClock();
  M.stepClock(clock, 0);
  for (let i = 1; i <= 5; i++) M.stepClock(clock, i * 100);
  const before = L.sample(plan, clock.time * 1000, context());
  M.stepClock(clock, 20000, { hidden: true });
  M.stepClock(clock, 30000);
  assert.deepEqual(L.sample(plan, clock.time * 1000, context()), before);
  M.stepClock(clock, 30100);
  assert.equal(L.sample(plan, clock.time * 1000, context()).visualComplete, false);
});

test('input and returned frames cannot mutate the prepared path or replay facts', () => {
  const input = source(), plan = L.createPlan(input);
  input.steps[0].to.x = 99;
  const frame = L.sample(plan, 2000, context());
  frame.actors.guest.x = 80;
  frame.visualStepIds.length = 0;
  assert.equal(L.sample(plan, 2000, context()).actors.guest.x, 4);
  assert.deepEqual(L.sample(plan, 2000, context()).visualStepIds, allSteps);
  assert.ok(Object.isFrozen(plan.steps[0].to));
  assert.throws(() => L.sample(JSON.parse(JSON.stringify(plan)), 0, context()), /createPlan/);
});

test('bad authored plans fail before animation: disconnected route, duplicate IDs and invalid durations', () => {
  for (const mutate of [
    value => { value.steps[1].from.x = 9; },
    value => { value.steps[1].id = value.steps[0].id; },
    value => { value.steps[0].durationMs = -1; },
    value => { value.steps[0].durationMs = Infinity; },
    value => { value.steps[0].from.x = NaN; },
    value => { value.revision = null; },
  ]) {
    const input = source(); mutate(input); assert.throws(() => L.createPlan(input), /LoomLife/);
  }
});

test('a second authored route changes the journey while zero-duration poses remain supported', () => {
  const input = source();
  input.id = 'sign-route';
  input.steps = [
    { id: 'sign', actor: 'guest', from: { x: 0, y: 0 }, to: { x: -2, y: 1 }, durationMs: 500, pose: 'walking', endPose: 'reading' },
    { id: 'seat', actor: 'guest', from: { x: -2, y: 1 }, to: { x: 4, y: 2 }, durationMs: 500, pose: 'walking', endPose: 'standing' },
    { id: 'sit', actor: 'guest', from: { x: 4, y: 2 }, to: { x: 4, y: 2 }, durationMs: 0, pose: 'seated' },
  ];
  const plan = L.createPlan(input);
  assert.equal(L.sample(plan, 500, context()).actors.guest.x, -2);
  assert.equal(L.sample(plan, 1000, context()).actors.guest.pose, 'seated');
  assert.equal(L.sample(plan, 1000, context()).visualComplete, true);
});

test('serialized plans preserve initial poses when the browser prepares them again', () => {
  const input = source();
  input.steps.push({ id: 'cup-place', actor: 'cup', from: { x: 4, y: 1 }, to: { x: 4, y: 2 },
    durationMs: 300, pose: 'carried', endPose: 'placed', initialPose: 'hidden' });
  input.steps[0].initialPose = 'waiting';
  const plan = L.createPlan(input);
  const browser = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../tools/lib/loom-life.js'), 'utf8'), browser);
  const restored = browser.LoomLife.createPlan(JSON.parse(JSON.stringify(plan)));
  const plain = value => JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(restored.initialActors), plain(plan.initialActors));
  for (const time of [0, 500, 1650, 2100, 2300]) {
    assert.deepEqual(plain(browser.LoomLife.sample(restored, time, context())), plain(L.sample(plan, time, context())));
  }
  assert.equal(browser.LoomLife.sample(restored, 0, context({ reducedMotion: true, committedStepIds: [] })).actors.cup.pose, 'hidden');
});
