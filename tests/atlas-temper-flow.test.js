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

// The simulated host offers less help only when Flow would take it, as game-flow's offerLessHelp does.
// A person who always accepts and a Flow whose answers follow a script show when each offer comes.
const steady = Object.freeze({ id: 'steady', label: '늘 혼자 해내는', content: 4, speed: 0, slip: 0, growth: 0, assist: 0, accepts: 1 });
const scripted = (misses, offers, condition = null) => ({ ...Flow, start: options => {
  const run = Flow.start(condition ? { ...options, condition } : options), arm = options.declared?.mode === 'fixed' ? 'fixed' : 'adapted';
  let answered = 0;
  return { ...run,
    observe: input => { answered += 1; return run.observe({ ...input, outcome: misses.includes(answered) ? 'fail' : 'success' }); },
    acceptLessHelp: () => { const change = run.acceptLessHelp(); offers.push({ arm, at: answered, change }); return change; } };
} });
const helpAt = start => Flow.defineContent({ id: 'test.help', knobs: [{ id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start }] });

test('less help is offered only when Flow can take it: not without a help knob, not at the least help, not on a tired day', () => {
  const cases = [
    ['no help knob', Flow.defineContent({ id: 'test.no-help', knobs: [{ id: 'level', values: [0, 1, 2, 3, 4], start: 1 }] }), null],
    ['help already least', helpAt(2), null],
    ['a tired day', helpAt(1), 'tired'],
  ];
  for (const [name, content, condition] of cases) {
    const offers = [];
    Temper.simulate({ spec: content, personas: [steady], steps: 40, seed: 'offers', flow: scripted([], offers, condition) });
    assert.deepEqual(offers, [], name);
  }
});

test('an offer that could not be made neither delays the first real one nor sets when the next comes', () => {
  // Help starts at its least, so nothing can be offered. Two misses bring help (answer 8); three quiet
  // successes later it can be offered (answer 11). A miss brings help again (answer 12), and the next offer
  // comes ten answers after the last one made (answer 21). The fixed round never offers.
  const offers = [];
  const report = Temper.simulate({ spec: helpAt(2), personas: [steady], steps: 30, seed: 'offers', flow: scripted([7, 8, 12], offers) });
  assert.deepEqual(offers.map(o => [o.arm, o.at, o.change?.because, o.change?.from, o.change?.to]),
    [['adapted', 11, 'accepted-less-help', 1, 2], ['adapted', 21, 'accepted-less-help', 1, 2]]);
  assert.equal(report.personas[0].final.hint, 'late');
  assert.equal(report.invariants.maxJump, 1);
  assert.deepEqual(Temper.simulate({ spec: helpAt(2), personas: [steady], steps: 30, seed: 'offers', flow: scripted([7, 8, 12], []) }), report, 'same seed, same report');
});

test('an offer that cannot be made leaves the random stream alone: the report equals one where no offer is ever due', () => {
  const noHelp = Flow.defineContent({ id: 'test.cafe.no-help', target: 0.75, items: { levels: [1, 2, 3], weight: 2 }, knobs: [
    { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32, 27], start: 2 }, { id: 'spawn', kind: 'pace', values: [14, 12, 10, 8, 7], start: 2 }] });
  const neverDue = { ...Flow, start: options => ({ ...Flow.start(options), quietStreak: () => 0 }) };
  for (const seed of ['quiet-a', 'quiet-b']) {
    assert.deepEqual(Temper.simulate({ spec: noHelp, steps: 60, seed }), Temper.simulate({ spec: noHelp, steps: 60, seed, flow: neverDue }), seed);
  }
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
// them works in each of the six orders. Checked after every script: listing, reading and typeof on the
// globals never throw, what can work works, and a call that cannot work yet names the missing file.
// The old two-script set (flow.js + temper-flow.js) is the state before temper.js here.
test('browser globals: temper.js, flow.js and temper-flow.js work in all six load orders; in between the globals are safe to list and read, and a call names what is missing', () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const source = name => fs.readFileSync(path.join(__dirname, '../atlas', name), 'utf8');
  const input = { id: 'test.cafe', target: 0.75, items: { levels: [1, 2, 3], weight: 2 }, knobs: [{ id: 'patience', kind: 'pace', values: [60, 52, 45, 38], start: 1 }] };
  const quiet = { outcome: 'success', assisted: false, pressure: 0.2, latencyMs: 2000 }, now = '2026-10-02T00:00:00.000Z';
  const expected = JSON.stringify(Temper.simulate({ spec: input, steps: 12, seed: 'browser' }));
  const files = ['temper.js', 'flow.js', 'temper-flow.js'], globals = ['SynkTemper', 'SynkFlow', 'SynkTemperFlow'];
  const orders = files.flatMap(a => files.filter(b => b !== a).map(b => [a, b, files.find(c => c !== a && c !== b)]));
  assert.equal(new Set(orders.map(order => order.join())).size, 6);
  for (const order of orders) {
    const context = vm.createContext({}), loaded = new Set(), label = order.join(' ');
    const run = code => vm.runInContext(code, context);
    let early = null;
    for (const name of order) {
      vm.runInContext(source(name), context, { filename: name }); loaded.add(name);
      const at = `${label} (after ${name})`, has = file => loaded.has(file);
      // Whatever is still missing, listing every global, reading each one and typeof never throw.
      assert.doesNotThrow(() => run('JSON.stringify(Object.entries(globalThis).map(([key, value]) => [key, typeof value, value && Object.entries(value).map(([k, v]) => [k, typeof v])]))'), at);
      assert.deepEqual(JSON.parse(run(`JSON.stringify([${globals.map(name => `typeof ${name}`)}])`)), files.map(file => has(file) ? 'object' : 'undefined'), at);
      if (has('temper-flow.js')) {
        assert.deepEqual(JSON.parse(run('JSON.stringify(Object.keys(SynkTemperFlow))')), Object.keys(Temper), at);
        assert.equal(run("Object.getOwnPropertyDescriptor(globalThis, 'SynkTemperFlow').enumerable"), true, at);
      }
      if (has('temper-flow.js') && !has('temper.js')) {
        // A stand-in until the guard comes: its values come with the guard, and each call names temper.js.
        early = context.SynkTemperFlow;
        assert.ok(Object.isFrozen(early), at);
        assert.equal(early.VERSION, undefined, at);
        for (const call of [() => early.simulate({ spec: input, steps: 12 }), () => early.truth(input, {}, Temper.PERSONAS[0]), () => early.check({})]) assert.throws(call, /load temper\.js/, at);
      }
      if (has('temper-flow.js') && has('temper.js')) assert.equal(context.SynkTemperFlow.VERSION, 'temper-flow-1', at);
      if (has('flow.js') && !has('temper.js')) assert.throws(() => context.SynkFlow.start({ spec: input, now }), /Temper guard unavailable/, at);
      if (has('flow.js') && has('temper.js')) assert.equal(typeof context.SynkFlow.start({ spec: input, now }).observe, 'function', at);
      if (has('temper-flow.js') && has('temper.js') && !has('flow.js')) assert.throws(() => context.SynkTemperFlow.simulate({ spec: input, steps: 12 }), /Flow unavailable/, at);
    }
    // All three are there: the same surface, guard and report as CommonJS, held as a plain frozen global.
    assert.deepEqual([...Object.keys(context.SynkTemperFlow)], Object.keys(Temper), label);
    assert.equal(context.SynkTemperFlow.check, context.SynkTemper.check, label);
    assert.equal(JSON.stringify(context.SynkTemperFlow.simulate({ spec: input, steps: 12, seed: 'browser' })), expected, label);
    assert.equal(vm.runInContext("(d => 'value' in d && d.writable && d.enumerable && d.configurable)(Object.getOwnPropertyDescriptor(globalThis, 'SynkTemperFlow'))", context), true, label);
    assert.ok(Object.isFrozen(context.SynkTemperFlow), label);
    // A stand-in taken before the guard came now hands over to the one module.
    if (early) {
      assert.notEqual(early, context.SynkTemperFlow, label);
      assert.equal(early.check, context.SynkTemper.check, label);
      assert.equal(early.VERSION, 'temper-flow-1', label);
      assert.equal(JSON.stringify(early.simulate({ spec: input, steps: 12, seed: 'browser' })), expected, label);
    }
    assert.equal(early === null, order.indexOf('temper.js') < order.indexOf('temper-flow.js'), label);
    const free = context.SynkFlow.start({ spec: input, now });
    for (let i = 0; i < 8; i += 1) free.observe(quiet);
    assert.ok(free.changes().length > 0, `${label}: quiet successes raise under the real guard`);
    // A guard on hold, put in its place, stops every change: Flow asks SynkTemper, not a copy.
    context.SynkTemper = { check: () => ({ ok: false, rail: 'hold' }) };
    const held = context.SynkFlow.start({ spec: input, now });
    for (let i = 0; i < 8; i += 1) held.observe(quiet);
    assert.equal(held.changes().length, 0, label);
  }
  // A host may still set the global itself before the first use, also after looking at it.
  const host = vm.createContext({});
  vm.runInContext(source('temper-flow.js'), host);
  vm.runInContext("SynkTemperFlow = 'host'", host);
  assert.equal(host.SynkTemperFlow, 'host');
  const looked = vm.createContext({});
  vm.runInContext(source('temper-flow.js'), looked);
  assert.equal(vm.runInContext("typeof SynkTemperFlow + Object.keys(globalThis).length; SynkTemperFlow = 'host'; SynkTemperFlow", looked), 'host');
  vm.runInContext(source('temper.js'), looked);
  assert.equal(looked.SynkTemperFlow, 'host', 'the guard arriving later does not replace what the host set');
});
