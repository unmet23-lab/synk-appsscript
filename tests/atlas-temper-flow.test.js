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

// The guard is Temper's own leaf (temper.js): Flow reads it, the simulation reads Flow and it, and
// nothing reads back. Checked in the sources and in fresh processes loaded in each order.
test('module graph: Flow -> guard, simulation -> Flow and guard, and no require cycle', () => {
  const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
  const dir = path.join(__dirname, '../atlas');
  const requires = name => [...fs.readFileSync(path.join(dir, name), 'utf8').matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)].map(m => m[1]).sort();
  assert.deepEqual(requires('temper.js'), []);
  assert.deepEqual(requires('flow.js'), ['./temper']);
  assert.deepEqual(requires('temper-flow.js'), ['./flow', './temper']);
  for (const first of ['flow', 'temper-flow', 'temper']) {
    const script = `const path=require('path');require('./atlas/${first}');
      const F=require('./atlas/flow'),T=require('./atlas/temper-flow'),G=require('./atlas/temper');
      const kids=n=>require.cache[require.resolve('./atlas/'+n)].children.map(c=>path.basename(c.filename)).sort();
      console.log(JSON.stringify({flow:kids('flow'),guard:kids('temper'),sim:kids('temper-flow'),start:typeof F.start,same:T.check===G.check}));`;
    const seen = JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: path.join(__dirname, '..'), encoding: 'utf8' }));
    assert.deepEqual(seen, { flow: ['temper.js'], guard: [], sim: ['flow.js', 'temper.js'], start: 'function', same: true }, `loaded ${first} first`);
  }
});

test('SynkTemperFlow keeps its public surface; its check and constants are the guard itself', () => {
  const Guard = require('../atlas/temper');
  assert.deepEqual(Object.keys(Temper), ['VERSION', 'FLIP_WINDOW', 'COOL_DOWN', 'PERSONAS', 'check', 'truth', 'simulate']);
  assert.equal(Temper.check, Guard.check);
  assert.deepEqual([Temper.FLIP_WINDOW, Temper.COOL_DOWN, Temper.VERSION], [Guard.FLIP_WINDOW, Guard.COOL_DOWN, 'temper-flow-1']);
  assert.ok(Object.isFrozen(Temper) && Object.isFrozen(Guard));
});

// Plain scripts (no module): every page that loads temper.js, flow.js and temper-flow.js before using
// them works in each of the six orders. Checked after every script: what works and what names the
// missing file. The old two-script set (flow.js + temper-flow.js) is the state before temper.js here.
test('browser globals: temper.js, flow.js and temper-flow.js work in all six load orders; an early use names what is missing', () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const source = name => fs.readFileSync(path.join(__dirname, '../atlas', name), 'utf8');
  const input = { id: 'test.cafe', target: 0.75, items: { levels: [1, 2, 3], weight: 2 }, knobs: [{ id: 'patience', kind: 'pace', values: [60, 52, 45, 38], start: 1 }] };
  const quiet = { outcome: 'success', assisted: false, pressure: 0.2, latencyMs: 2000 }, now = '2026-10-02T00:00:00.000Z';
  const expected = JSON.stringify(Temper.simulate({ spec: input, steps: 12, seed: 'browser' }));
  const files = ['temper.js', 'flow.js', 'temper-flow.js'];
  const orders = files.flatMap(a => files.filter(b => b !== a).map(b => [a, b, files.find(c => c !== a && c !== b)]));
  assert.equal(new Set(orders.map(order => order.join())).size, 6);
  for (const order of orders) {
    const context = vm.createContext({}), loaded = new Set(), label = order.join(' ');
    for (const name of order) {
      vm.runInContext(source(name), context, { filename: name }); loaded.add(name);
      const at = `${label} (after ${name})`, has = file => loaded.has(file);
      if (has('temper-flow.js')) assert.ok('SynkTemperFlow' in context, at);
      if (has('temper-flow.js') && !has('temper.js')) assert.throws(() => context.SynkTemperFlow.VERSION, /load temper\.js/, at);
      if (has('flow.js') && !has('temper.js')) assert.throws(() => context.SynkFlow.start({ spec: input, now }), /Temper guard unavailable/, at);
      if (has('flow.js') && has('temper.js')) assert.equal(typeof context.SynkFlow.start({ spec: input, now }).observe, 'function', at);
      if (has('temper-flow.js') && has('temper.js') && !has('flow.js')) assert.throws(() => context.SynkTemperFlow.simulate({ spec: input, steps: 12 }), /Flow unavailable/, at);
    }
    // All three are there: the same surface, guard and report as CommonJS, held as a plain global.
    assert.deepEqual([...Object.keys(context.SynkTemperFlow)], Object.keys(Temper), label);
    assert.equal(context.SynkTemperFlow.check, context.SynkTemper.check, label);
    assert.equal(JSON.stringify(context.SynkTemperFlow.simulate({ spec: input, steps: 12, seed: 'browser' })), expected, label);
    assert.equal(vm.runInContext("(d => 'value' in d && d.writable && d.enumerable && d.configurable)(Object.getOwnPropertyDescriptor(globalThis, 'SynkTemperFlow'))", context), true, label);
    const free = context.SynkFlow.start({ spec: input, now });
    for (let i = 0; i < 8; i += 1) free.observe(quiet);
    assert.ok(free.changes().length > 0, `${label}: quiet successes raise under the real guard`);
    // A guard on hold, put in its place, stops every change: Flow asks SynkTemper, not a copy.
    context.SynkTemper = { check: () => ({ ok: false, rail: 'hold' }) };
    const held = context.SynkFlow.start({ spec: input, now });
    for (let i = 0; i < 8; i += 1) held.observe(quiet);
    assert.equal(held.changes().length, 0, label);
  }
  // A host may still set the global itself before the first use.
  const host = vm.createContext({});
  vm.runInContext(source('temper-flow.js'), host);
  vm.runInContext("SynkTemperFlow = 'host'", host);
  assert.equal(host.SynkTemperFlow, 'host');
});
