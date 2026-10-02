'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Flow = require('../atlas/flow');
const Temper = require('../atlas/temper-flow');

const spec = Flow.defineContent({ id: 'test.cafe', target: 0.75,
  items: { levels: [1, 2, 3], weight: 2 },
  knobs: [
    { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32, 27], start: 2 },
    { id: 'spawn', kind: 'pace', values: [14, 12, 10, 8, 7], start: 2 },
    { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 },
    { id: 'size', kind: 'content', follows: 'declared', values: ['large', 'standard'], start: 1 },
  ] });

test('the guard allows one knob, one step, inside bounds, never a declared-only knob, and stops on hold', () => {
  const ok = input => Temper.check({ spec, step: 1, history: [], ...input });
  assert.equal(ok({ knob: 'patience', from: 2, to: 3 }).ok, true);
  assert.equal(ok({ knob: 'patience', from: 2, to: 4 }).rail, 'one-step');
  assert.equal(ok({ knob: 'patience', from: 5, to: 6 }).rail, 'bounds');
  assert.equal(ok({ knob: 'size', from: 1, to: 0 }).rail, 'declared-only');
  assert.equal(ok({ knob: 'nope', from: 0, to: 1 }).rail, 'unknown-knob');
  assert.equal(ok({ knob: 'patience', from: 2, to: 3, frozen: true }).rail, 'hold');
});

test('the guard keeps responses calm: one change each, no bounce back up, a pause after a raise', () => {
  const raised = [{ step: 3, phase: 'response', knob: 'spawn', from: 2, to: 3, direction: 1 }];
  const eased = [{ step: 3, phase: 'response', knob: 'patience', from: 3, to: 2, direction: -1 }];
  assert.equal(Temper.check({ spec, knob: 'patience', from: 2, to: 1, step: 3, history: raised }).rail, 'one-change-per-response');
  assert.equal(Temper.check({ spec, knob: 'patience', from: 2, to: 3, step: 4, history: eased }).rail, 'no-bounce');
  assert.equal(Temper.check({ spec, knob: 'patience', from: 2, to: 1, step: 4, history: eased }).ok, true, 'easing is never held back');
  assert.equal(Temper.check({ spec, knob: 'patience', from: 2, to: 3, step: 4, history: raised }).rail, 'cool-down');
  assert.equal(Temper.check({ spec, knob: 'spawn', from: 3, to: 2, step: 4, history: raised }).ok, true, 'easing right after a raise is allowed');
  assert.equal(Temper.check({ spec, knob: 'patience', from: 2, to: 3, step: 3 + Temper.COOL_DOWN + 1, history: raised }).ok, true);
  const opening = [{ step: 0, phase: 'opening', knob: 'patience', from: 2, to: 1, direction: -1 }];
  assert.equal(Temper.check({ spec, knob: 'patience', from: 1, to: 0, step: 0, phase: 'opening', history: opening }).ok, true, 'opening placement may take several steps');
});

test('virtual people are described by behaviour only', () => {
  for (const person of Temper.PERSONAS) {
    assert.deepEqual(Object.keys(person).filter(key => !['id', 'label', 'content', 'speed', 'slip', 'growth', 'assist', 'pause', 'accepts'].includes(key)), []);
    assert.doesNotMatch(person.label, /\d+\s*대|남성|여성|남자|여자|노인|청년|국적/);
  }
});

test('simulation: invariants hold, results repeat, and people far from the default are served better than fixed settings', () => {
  const a = Temper.simulate({ spec, steps: 60, seed: 'check' }), b = Temper.simulate({ spec, steps: 60, seed: 'check' });
  assert.deepEqual(a, b, 'same seed, same report');
  assert.equal(a.invariants.maxJump, 1);
  assert.equal(a.invariants.helpRaises, 0);
  assert.equal(a.learningEffectClaim, false);
  assert.match(a.note, /증거가 아니다/);
  const by = Object.fromEntries(a.personas.map(p => [p.id, p]));
  for (const id of ['new-careful', 'experienced', 'knows-but-rushed']) {
    assert.ok(by[id].adapted.meanError < by[id].fixed.meanError, `${id}: closer to the target than the fixed default`);
  }
  assert.ok(by['knows-but-rushed'].adapted.timeouts < by['knows-but-rushed'].fixed.timeouts / 2, 'time pressure follows the person');
  assert.equal(by['knows-but-rushed'].final.patience >= 45, true, 'more time is given to a careful person');
  assert.ok(by.experienced.final['item.difficulty'] >= 2, 'an experienced person meets harder items');
  for (const p of a.personas) assert.equal(p.final.size, 'standard', 'a declared-only knob never moves');
  assert.ok(by.struggling.adapted.floorTooHard >= 10, 'when even the easiest content stays too hard, the report says so');
  assert.equal(by.experienced.adapted.floorTooHard, 0);
});

test('the simulation catches a broken rule: a guard that lets help raise the challenge is visible', () => {
  // A deliberately broken Flow that raises after every success, assisted or not.
  const broken = { ...Flow, start: options => {
    const run = Flow.start(options);
    return { ...run, observe: input => { const result = run.observe(input); return input.assisted && input.outcome === 'success' ? { ...result, change: { knob: 'patience', from: 2, to: 3, direction: 1 } } : result; } };
  } };
  const report = Temper.simulate({ spec, steps: 60, seed: 'broken', flow: broken });
  assert.ok(report.invariants.helpRaises > 0);
});
