'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Flow = require('../atlas/flow');

// A knob held by hand is today's alone: it is never made up for in memory by another knob that today did not move.
// The run's own declaration (바람길): speed and ramp are both pace; a tired day holds the ramp at 0.
const runner = () => import(pathToFileURL(path.join(__dirname, '..', 'experiences', 'korean-runner', 'learning.mjs')).href);
const NOW = '2026-10-03T09:00:00.000Z';
const later = days => new Date(Date.parse(NOW) + days * 86400000).toISOString();
const reasons = run => run.intro().opening.map(change => change.because);
const steps = run => run.intro().opening.map(c => [c.because, c.knob, c.from, c.to]);

test('a tired run that holds the ramp keeps no speed step it never took, with no answers or after ten successes', async () => {
  const { FLOW_RUN, TIRED_RUN } = await runner();
  const spec = Flow.defineContent(FLOW_RUN), fresh = Flow.start({ spec, now: NOW });
  const usual = fresh.settings().indices;
  assert.deepEqual(fresh.settings().values, { speed: 13, ramp: 0.055 });
  for (const successes of [0, 10]) {
    const tired = Flow.start({ spec, now: NOW, condition: 'tired', declared: TIRED_RUN });
    assert.equal(tired.intro().code, 'start.tired');
    assert.deepEqual(tired.intro().opening, [], 'the held ramp is not made up for by a faster start');
    assert.deepEqual(tired.settings().values, { speed: 13, ramp: 0 });
    for (let i = 0; i < successes; i += 1) assert.equal(tired.observe({ outcome: 'success' }).change, null, 'nothing gets faster in a tired run');
    assert.deepEqual(tired.settings().values, { speed: 13, ramp: 0 }, 'speed stays at 13 to the end');
    const saved = tired.memory(later(0));
    assert.deepEqual(saved.indices, usual, `${successes} successes: speed is kept at 13 and the ramp where it was`);
    if (successes) assert.ok(saved.estimates.pace.theta > fresh.memory(NOW).estimates.pace.theta, 'what was learnt about time is still kept');
    const next = Flow.start({ spec, now: later(1), memory: saved });
    assert.equal(next.intro().code, 'start.memory');
    assert.deepEqual(next.intro().opening, []);
    assert.deepEqual(next.settings().values, { speed: 13, ramp: 0.055 }, 'the next ordinary run starts at 13, not 14');
  }
});

test('what ordinary play reached is kept through a tired run that holds the ramp', async () => {
  const { FLOW_RUN, TIRED_RUN } = await runner();
  const spec = Flow.defineContent(FLOW_RUN), usual = Flow.start({ spec, now: NOW });
  for (let i = 0; i < 10; i += 1) usual.observe({ outcome: 'success' });
  const reached = usual.settings().indices, memory = usual.memory(NOW);
  assert.ok(Flow.challenge(spec, reached) > Flow.challenge(spec, Flow.start({ spec, now: NOW }).settings().indices), 'ordinary play went faster');
  const tired = Flow.start({ spec, now: later(1), memory, condition: 'tired', declared: TIRED_RUN });
  assert.equal(tired.settings().values.ramp, 0);
  for (let i = 0; i < 10; i += 1) { const change = tired.observe({ outcome: 'success' }).change; assert.ok(!change || change.direction < 0); }
  const saved = tired.memory(later(1));
  assert.deepEqual(saved.indices, reached, 'the held ramp returns to where play had reached, and speed is not moved');
  assert.deepEqual(Flow.start({ spec, now: later(2), memory: saved }).settings().indices, reached);
});

test('memory’s own easing keeps its name and its place under a held knob, and a held knob leaves no easing of its own', async () => {
  const { FLOW_RUN, TIRED_RUN } = await runner();
  const spec = Flow.defineContent(FLOW_RUN), at = Flow.start({ spec, now: NOW }).memory(NOW);
  // Kept faster than what was learnt there: memory alone eases speed back two steps.
  const ahead = { ...at, indices: { speed: 4, ramp: 3 } };
  const usual = Flow.start({ spec, now: later(1), memory: ahead });
  assert.deepEqual(steps(usual), [['memory', 'speed', 4, 3], ['memory', 'speed', 3, 2]]);
  const tired = Flow.start({ spec, now: later(1), memory: ahead, condition: 'tired', declared: TIRED_RUN });
  assert.deepEqual(steps(tired), [['memory', 'speed', 4, 3]], 'the step memory itself asks for is named so');
  assert.deepEqual(tired.settings().values, { speed: 14, ramp: 0 });
  assert.deepEqual(tired.memory(later(1)).indices, usual.memory(later(1)).indices, 'the next day starts where memory alone placed the person');
  // Speed held fast on a tired day: the ramp eases today only, and memory keeps it where it was.
  const fast = Flow.start({ spec, now: later(1), memory: at, condition: 'tired', declared: { knobs: { speed: 4 } } });
  assert.deepEqual(steps(fast), [['tired', 'ramp', 3, 2], ['tired', 'ramp', 2, 1]]);
  assert.deepEqual(fast.memory(later(1)).indices, at.indices);
});

test('a knob held by hand on a tired, easier or harder day leaves the other knobs where the prior alone places them', () => {
  const spec = Flow.defineContent({ id: 'test.tired-lock.prior', knobs: [{ id: 'a', values: [0, 1, 2, 3, 4, 5], start: 2 }, { id: 'b', values: [0, 1, 2, 3], start: 1 }] });
  const prior = { content: 3.35 }, usual = Flow.start({ spec, now: NOW, prior });
  assert.deepEqual(usual.settings().indices, { a: 3, b: 1 });
  assert.deepEqual(reasons(usual), ['prior']);
  const kept = usual.memory(NOW), resumed = Flow.start({ spec, now: later(1), memory: kept }).settings().indices;
  for (const [options, why] of [
    [{ condition: 'tired', declared: { knobs: { b: 0 } } }, []],
    [{ declared: { mode: 'easier', knobs: { b: 0 } } }, ['prior']],
    [{ declared: { mode: 'harder', knobs: { b: 0 } } }, ['prior', 'declared-harder', 'declared-harder']],
  ]) {
    const run = Flow.start({ spec, now: NOW, prior, ...options }), label = JSON.stringify(options);
    assert.equal(run.settings().indices.b, 0, `${label}: the held knob plays where it was set`);
    assert.deepEqual(reasons(run), why, `${label}: only the prior's own step is named the prior's`);
    assert.deepEqual(run.memory(NOW).indices, kept.indices, `${label}: memory keeps the prior's place`);
    assert.deepEqual(Flow.start({ spec, now: later(1), memory: run.memory(NOW) }).settings().indices, resumed, `${label}: the next ordinary day resumes there`);
  }
});

// Declared-only knobs (text size, motion...): the value holds for its own round; memory keeps the content's
// own value, and the next round has the choice only when it is declared again (game-flow applies the stored
// presentation each round, or none once it is cleared).
// Not a product declaration: any content may declare such a knob, and Flow accepts it as it is.
const display = () => Flow.defineContent({ id: 'probe.display-lock', target: 0.8, knobs: [
  { id: 'difficulty', kind: 'content', values: [0, 1, 2, 3, 4], start: 2 },
  { id: 'textSize', kind: 'content', follows: 'declared', values: ['large', 'standard'], start: 1, weight: 1.5 }] });
// The declaration atlas-flow.test.js uses for chosen settings.
const chosen = () => Flow.defineContent({ id: 'test.chosen', target: 0.75, knobs: [
  { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 },
  { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 },
  { id: 'textSize', kind: 'content', follows: 'declared', values: ['standard', 'large'], start: 0 },
  { id: 'motion', kind: 'content', follows: 'declared', values: ['full', 'reduced'], start: 0 },
  { id: 'text', kind: 'content', follows: 'declared', values: ['large', 'standard'], start: 1 }] });

test('a text size chosen for a tired run holds there, and no step up for it is kept, whether it is chosen again or cleared', () => {
  const spec = display(), large = { knobs: { textSize: 0 } }, fresh = Flow.start({ spec, now: NOW });
  // On an ordinary day the step the larger text allows is played, so it is where play reached.
  const played = Flow.start({ spec, now: NOW, declared: large });
  assert.deepEqual(steps(played), [['prior', 'difficulty', 2, 3]]);
  assert.deepEqual(played.memory(NOW).indices, { difficulty: 3, textSize: 1 });
  for (const successes of [0, 10]) {
    const tired = Flow.start({ spec, now: NOW, condition: 'tired', declared: large });
    assert.equal(tired.intro().code, 'start.tired');
    assert.deepEqual(tired.intro().opening, [], 'today nothing goes up');
    for (let i = 0; i < successes; i += 1) assert.equal(tired.observe({ outcome: 'success' }).change, null, 'nothing gets harder in a tired run');
    assert.deepEqual(tired.settings().values, { difficulty: 2, textSize: 'large' }, 'the chosen size holds for the whole run');
    const saved = tired.memory(NOW);
    assert.deepEqual(saved.indices, { difficulty: 2, textSize: 1 }, `${successes} successes: no step that was never played, and no declared value kept`);
    if (successes) assert.ok(saved.estimates.content.theta > fresh.memory(NOW).estimates.content.theta, 'what was learnt is still kept');
    const again = Flow.start({ spec, now: later(1), memory: saved, declared: large });
    assert.deepEqual(again.intro().opening, []);
    assert.deepEqual(again.settings().values, { difficulty: 2, textSize: 'large' }, `${successes} successes: chosen again, it resumes at 2`);
    const cleared = Flow.start({ spec, now: later(1), memory: saved });
    assert.deepEqual(cleared.intro().opening, []);
    assert.deepEqual(cleared.settings().values, { difficulty: 2, textSize: 'standard' }, `${successes} successes: cleared, it resumes at 2`);
  }
});

test('chosen settings that make a tired run harder leave no extra help in memory, whether they are chosen again or cleared', () => {
  const spec = chosen(), usual = Flow.start({ spec, now: NOW }).settings().indices;
  // The person's text size and motion, and a text the content holds for itself (game-flow puts them together the same way).
  const declared = { knobs: { ...Flow.declaredFrom(spec, { textSize: 'large', motion: 'reduced' }).knobs, text: 0 } };
  for (const [successes, again] of [[0, [['memory', 'hint', 1, 0]]], [10, []]]) {
    const tired = Flow.start({ spec, now: NOW, condition: 'tired', declared });
    assert.deepEqual(steps(tired), [['tired', 'hint', 1, 0], ['tired', 'patience', 2, 1]], 'more help and more time for today alone');
    for (let i = 0; i < successes; i += 1) assert.equal(tired.observe({ outcome: 'success' }).change, null);
    assert.deepEqual(tired.settings().values, { patience: 52, hint: 'early', textSize: 'large', motion: 'reduced', text: 'large' });
    const saved = tired.memory(NOW);
    assert.deepEqual(saved.indices, usual, `${successes} successes: help and time return to where they were`);
    const chosenAgain = Flow.start({ spec, now: later(1), memory: saved, declared });
    assert.deepEqual(steps(chosenAgain), again, `${successes} successes: chosen again, only memory itself eases, where its estimate asks`);
    const cleared = Flow.start({ spec, now: later(1), memory: saved });
    assert.deepEqual(cleared.intro().opening, []);
    assert.deepEqual(cleared.settings().values, { patience: 45, hint: 'normal', textSize: 'standard', motion: 'full', text: 'standard' },
      `${successes} successes: cleared, no help is left that the round did not need`);
  }
});

test('a text size chosen for today leaves other knobs where the prior or memory alone places them', () => {
  const spec = Flow.defineContent({ id: 'test.display.ladder', knobs: [{ id: 'a', values: [0, 1, 2, 3, 4, 5], start: 2 },
    { id: 'text', kind: 'content', follows: 'declared', values: ['large', 'standard'], start: 1 }] });
  const large = { text: 0 }, prior = { content: 3.35 }, usual = Flow.start({ spec, now: NOW, prior });
  assert.deepEqual(usual.settings().indices, { a: 3, text: 1 });
  for (const [options, why] of [
    [{ condition: 'tired', declared: { knobs: large } }, []],
    [{ declared: { mode: 'easier', knobs: large } }, ['prior']],
    [{ declared: { mode: 'harder', knobs: large } }, ['prior', 'declared-harder', 'declared-harder']],
  ]) {
    const run = Flow.start({ spec, now: NOW, prior, ...options }), label = JSON.stringify(options);
    assert.equal(run.settings().values.text, 'large', `${label}: the chosen size plays today`);
    assert.deepEqual(reasons(run), why, `${label}: only the prior's own step is named the prior's`);
    assert.deepEqual(run.memory(NOW).indices, usual.memory(NOW).indices, `${label}: memory keeps the prior's place`);
  }
  // Kept at step 4, but what was learnt there says step 2: memory alone eases both steps, with larger text or without.
  const at = Flow.start({ spec, now: NOW }).memory(NOW), memory = { ...at, indices: { a: 4, text: 1 } };
  const plain = Flow.start({ spec, now: later(1), memory });
  assert.deepEqual(steps(plain), [['memory', 'a', 4, 3], ['memory', 'a', 3, 2]]);
  const tired = Flow.start({ spec, now: later(1), memory, condition: 'tired', declared: { knobs: large } });
  assert.deepEqual(steps(tired), [['memory', 'a', 4, 3], ['memory', 'a', 3, 2]], 'both steps are memory’s own');
  assert.deepEqual(tired.memory(later(1)).indices, plain.memory(later(1)).indices, 'the next day starts where memory alone placed the person');
});

// The ordinary round set aside on a chosen day lets a held knob move as it would with nothing held, so the
// step the prior or memory asks of it is never taken by another knob in memory. The held knob itself is kept
// where it was, not where the prior would put it.
// Two knobs of the same small step (an accepted declaration, not a product's): the prior raises `a` once.
const n2 = () => Flow.defineContent({ id: 'probe.n2', knobs: [
  { id: 'a', values: [0, 1, 2, 3, 4], start: 2, weight: 0.25 }, { id: 'b', values: [0, 1, 2, 3, 4], start: 2, weight: 0.25 }] });

test('a knob held on a tired day is not stood in for: the step the prior asks of it never lands on the other knob in memory', () => {
  const spec = n2(), prior = { content: 2 }, plain = Flow.start({ spec, now: NOW, prior });
  assert.deepEqual(plain.settings().indices, { a: 3, b: 2 });
  assert.deepEqual(plain.memory(NOW).indices, { a: 3, b: 2 });
  for (const [held, other, kept] of [['a', 'b', { a: 2, b: 2 }], ['b', 'a', { a: 3, b: 2 }]]) {
    for (const successes of [0, 10]) {
      const tired = Flow.start({ spec, now: NOW, prior, condition: 'tired', declared: { knobs: { [held]: 0 } } }), label = `${held} held, ${successes} successes`;
      assert.deepEqual(tired.intro().opening, [], `${label}: nothing moves today`);
      for (let i = 0; i < successes; i += 1) assert.equal(tired.observe({ outcome: 'success' }).change, null, `${label}: nothing gets harder in a tired run`);
      assert.equal(tired.settings().indices[held], 0, `${label}: the held knob plays as set`);
      assert.equal(tired.settings().indices[other], 2, `${label}: the other knob never moved today`);
      const saved = tired.memory(NOW);
      assert.equal(saved.indices[other], plain.memory(NOW).indices[other], `${label}: the other knob is kept where the prior alone places it`);
      assert.equal(saved.indices[held], 2, `${label}: the held knob is kept where it was`);
      assert.deepEqual(saved.indices, kept);
      const next = Flow.start({ spec, now: later(1), memory: saved });
      assert.deepEqual(next.intro().opening, [], `${label}: the next ordinary day takes no step memory did not ask for`);
      assert.deepEqual(next.settings().indices, kept, `${label}: the next ordinary day resumes there`);
    }
  }
});

test('on a day chosen easier or harder too, a held knob’s share stays its own, and the ordinary round leaves nothing in today’s', () => {
  const spec = n2(), prior = { content: 2 }, plain = Flow.start({ spec, now: NOW, prior }).memory(NOW).indices;
  for (const [day, held, why] of [
    ['tired', 'a', []], ['easier', 'a', []], ['harder', 'a', ['declared-harder', 'declared-harder']],
    ['tired', 'b', []], ['easier', 'b', []], ['harder', 'b', ['prior', 'declared-harder']],
  ]) {
    const other = held === 'a' ? 'b' : 'a', label = `${day}, ${held} held`;
    const run = Flow.start({ spec, now: NOW, prior, ...(day === 'tired' ? { condition: 'tired' } : {}),
      declared: { mode: day === 'tired' ? 'auto' : day, knobs: { [held]: 0 } } });
    assert.equal(run.settings().indices[held], 0, `${label}: the held knob plays as set`);
    assert.deepEqual(reasons(run), why, `${label}: a step is the prior's only where the ordinary round takes it too`);
    assert.deepEqual(run.memory(NOW).indices, { [held]: 2, [other]: plain[other] }, `${label}: the other knob where the prior alone places it, the held one where it was`);
    // Today's round holds its own opening only: no step of the ordinary round, and no response.
    assert.deepEqual(run.changes(), run.intro().opening, label);
    assert.deepEqual(run.trace(), [], label);
  }
});

test('when memory itself would ease a held knob, the other knob does not ease in its place in memory', async () => {
  const { FLOW_RUN } = await runner();
  const spec = Flow.defineContent(FLOW_RUN), at = Flow.start({ spec, now: NOW }).memory(NOW);
  // Kept faster than what was learnt there: memory alone eases speed back two steps.
  const ahead = { ...at, indices: { speed: 4, ramp: 3 } };
  assert.deepEqual(steps(Flow.start({ spec, now: later(1), memory: ahead })), [['memory', 'speed', 4, 3], ['memory', 'speed', 3, 2]]);
  // Speed held at 15 on a tired day: the ramp eases for today alone, not as memory's step.
  const held = Flow.start({ spec, now: later(1), memory: ahead, condition: 'tired', declared: { knobs: { speed: 4 } } });
  assert.deepEqual(steps(held), [['tired', 'ramp', 3, 2], ['tired', 'ramp', 2, 1]]);
  assert.deepEqual(held.settings().values, { speed: 15, ramp: 0.025 });
  const saved = held.memory(later(1));
  assert.deepEqual(saved.indices, ahead.indices, 'the ramp is kept where it was, and the held speed where it was');
  const next = Flow.start({ spec, now: later(2), memory: saved });
  assert.deepEqual(steps(next), [['memory', 'speed', 4, 3], ['memory', 'speed', 3, 2]], 'the next ordinary day eases speed as memory asks');
  assert.deepEqual(next.settings().values, { speed: 13, ramp: 0.055 });
});
