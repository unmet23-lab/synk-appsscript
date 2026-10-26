'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Flow = require('../atlas/flow');
const Temper = require('../atlas/temper');

// An opening takes the dimension furthest from its aim first. When that one has no step to take (at its end,
// or held by hand), the other dimension still takes its own: content and time are two estimates, and what a
// fixed round taught about time is not lost because content is already at its easiest.
const NOW = '2026-10-03T09:00:00.000Z', NEXT = '2026-10-04T09:00:00.000Z';
const steps = run => run.intro().opening.map(c => [c.because, c.knob, c.from, c.to]);
const two = (content, pace) => Flow.defineContent({ id: 'probe.opening-floor', knobs: [
  { id: 'content', kind: 'content', values: [0, 1, 2, 3], start: content }, { id: 'pace', kind: 'pace', values: [0, 1, 2, 3], start: pace }] });
// A fixed round: its answers teach the estimates only, and the place stays where it was.
const taught = (spec, answers) => {
  const fixed = Flow.start({ spec, now: NOW, declared: { mode: 'fixed' } });
  for (const answer of answers) assert.equal(fixed.observe(answer).change, null);
  return fixed.memory(NOW);
};
const missThenLate = [{ outcome: 'fail' }, { outcome: 'timeout' }];

test('content already at its easiest does not keep time from easing: the next round opens with more time', () => {
  const spec = two(0, 1), fresh = Flow.start({ spec, now: NOW }).memory(NOW), memory = taught(spec, missThenLate);
  assert.deepEqual(memory.indices, { content: 0, pace: 1 });
  assert.ok(memory.estimates.content.theta < fresh.estimates.content.theta, 'the miss was learnt');
  assert.ok(memory.estimates.pace.theta < fresh.estimates.pace.theta, 'and so was the time that ran out');
  assert.equal(Temper.check({ spec, knob: 'pace', from: 1, to: 0, step: 0, phase: 'opening', history: [], frozen: false }).ok, true, 'Temper allows the step');
  const next = Flow.start({ spec, now: NEXT, memory });
  assert.equal(next.intro().code, 'start.memory');
  assert.deepEqual(steps(next), [['memory', 'pace', 1, 0]], 'content has no easier step, so time takes its own');
  assert.deepEqual(next.settings().indices, { content: 0, pace: 0 });
  assert.deepEqual(next.memory(NEXT).indices, { content: 0, pace: 0 }, 'an ordinary round keeps the step it played');
});

test('the same holds the other way round: time already at its easiest does not keep content from easing', () => {
  const spec = two(1, 0), fresh = Flow.start({ spec, now: NOW }).memory(NOW);
  // A helped success says content was a little hard; time ran out where time was already the most it can be.
  const memory = taught(spec, [{ outcome: 'success', assisted: true }, { outcome: 'timeout' }]);
  assert.ok(memory.estimates.content.theta < fresh.estimates.content.theta && memory.estimates.pace.theta < fresh.estimates.pace.theta);
  const next = Flow.start({ spec, now: NEXT, memory });
  assert.deepEqual(steps(next), [['memory', 'content', 1, 0]]);
  assert.deepEqual(next.settings().indices, { content: 0, pace: 0 });
});

test('a knob held by hand is passed over the same way; with every step held, the opening stops', () => {
  const spec = two(1, 1), memory = taught(spec, missThenLate);
  // Nothing held: content is furthest from its aim and eases first, then time (the order is unchanged).
  assert.deepEqual(steps(Flow.start({ spec, now: NEXT, memory })), [['memory', 'content', 1, 0], ['memory', 'pace', 1, 0]]);
  // Content held where it is: time still eases, and the held knob is kept where it was.
  const held = Flow.start({ spec, now: NEXT, memory, declared: { knobs: { content: 1 } } });
  assert.deepEqual(steps(held), [['memory', 'pace', 1, 0]]);
  assert.deepEqual(held.settings().indices, { content: 1, pace: 0 });
  assert.deepEqual(held.memory(NEXT).indices, { content: 1, pace: 0 });
  // Both held: nothing can move, so nothing does, and nothing is left in the round.
  const both = Flow.start({ spec, now: NEXT, memory, declared: { knobs: { content: 1, pace: 1 } } });
  assert.deepEqual(both.intro().opening, []);
  assert.deepEqual(both.changes(), []);
  assert.deepEqual(both.settings().indices, { content: 1, pace: 1 });
});

test('a tired day only eases, and the ordinary round set aside takes the same step, so it is memory’s own and kept', () => {
  const spec = two(0, 1), memory = taught(spec, missThenLate);
  const plain = Flow.start({ spec, now: NEXT, memory });
  const tired = Flow.start({ spec, now: NEXT, memory, condition: 'tired' });
  assert.deepEqual(steps(tired), [['memory', 'pace', 1, 0]]);
  assert.ok(tired.intro().opening.every(change => change.direction < 0), 'nothing goes up on a tired day');
  assert.deepEqual(tired.memory(NEXT).indices, plain.memory(NEXT).indices, 'the next day starts where memory alone placed the person');
});
