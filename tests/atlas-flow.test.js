'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Flow = require('../atlas/flow');
const Temper = require('../atlas/temper-flow');

const NOW = '2026-10-02T09:00:00.000Z';
const later = days => new Date(Date.parse(NOW) + days * 86400000).toISOString();
const rush = () => Flow.defineContent({ id: 'test.rush', target: 0.75,
  items: { levels: [1, 2, 3], weight: 2, start: 0 },
  knobs: [
    { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 },
    { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 },
    { id: 'text', kind: 'content', follows: 'declared', values: ['large', 'standard'], start: 1 },
  ] });
const play = (run, outcomes) => outcomes.map(o => run.observe(typeof o === 'string' ? { outcome: o } : o));

test('a new person starts exactly at the content defaults, with no demographic input accepted', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  assert.deepEqual(run.settings().values, { 'item.difficulty': 1, patience: 45, hint: 'normal', text: 'standard' });
  assert.equal(run.intro().code, 'start.default');
  assert.deepEqual(run.intro().opening, []);
  for (const field of ['age', 'gender', 'nationality', 'profile']) {
    assert.throws(() => Flow.start({ spec: rush(), now: NOW, [field]: 'x' }), /start accepts only/);
  }
  assert.throws(() => Flow.defineContent({ id: 'x', knobs: [{ id: 'a', values: [1, 2] }], audience: 'over-60' }), /unknown spec field/);
});

test('item difficulty is the first content knob and the spec is validated', () => {
  const spec = rush();
  assert.equal(spec.knobs[0].id, Flow.ITEM);
  assert.throws(() => Flow.defineContent({ id: 'bad', knobs: [{ id: 'a', values: [1] }] }), /invalid knob/);
  assert.throws(() => Flow.defineContent({ id: 'bad', target: 0.99, knobs: [{ id: 'a', values: [1, 2] }] }), /target/);
  assert.throws(() => Flow.defineContent({ id: 'bad', knobs: [{ id: 'a', values: [1, 2], kind: 'mood' }] }), /invalid knob/);
  assert.equal(Flow.defineContent(spec), spec, 'a defined spec is reused as is');
});

test('quiet successes raise one knob by one step at a time; a miss eases', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  const results = play(run, Array(12).fill({ outcome: 'success', pressure: 0.3 }));
  const changes = results.map(r => r.change).filter(Boolean);
  assert.ok(changes.length >= 2, 'a person who keeps succeeding gets more challenge');
  assert.ok(changes.every(c => c.direction === 1 && Math.abs(c.to - c.from) === 1));
  const steps = changes.map(c => c.step);
  assert.equal(new Set(steps).size, steps.length, 'never two changes in one response');
  for (let i = 1; i < steps.length; i += 1) assert.ok(steps[i] - steps[i - 1] > Temper.COOL_DOWN, 'raises are spaced out');
  const eased = run.observe({ outcome: 'fail', pressure: 0.3 });
  assert.equal(eased.change?.direction, -1, 'one miss after raises eases right away');
  assert.equal(eased.change.kind, 'content');
});

test('help never raises the challenge, however many assisted successes there are', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  const results = play(run, Array(20).fill({ outcome: 'success', assisted: true, pressure: 0.2 }));
  assert.ok(results.every(r => !r.change || r.change.direction < 0));
  assert.equal(run.quietStreak(), 0);
});

test('help on a hard item never lifts the estimate, and an assisted success never triggers a raise that was due', () => {
  const spec = rush();
  // Far below the current challenge: an assisted success there would look like a surprise win.
  const low = Flow.start({ spec, now: NOW, memory: { v: 2, content: spec.id, specVersion: spec.version, at: NOW,
    estimates: { content: { theta: -1, n: 10, reversals: 0 }, pace: { theta: 3, n: 10, reversals: 0 } },
    indices: { 'item.difficulty': 2, patience: 4, hint: 2, text: 1 }, latencies: [] } });
  const before = low.memory(NOW).estimates.content.theta;
  low.observe({ outcome: 'success', assisted: true, pressure: 0.3 });
  assert.ok(low.memory(NOW).estimates.content.theta <= before, 'the estimate does not rise on help');
  // Well above the current challenge: a raise is due, yet help on this answer holds it back.
  const high = Flow.start({ spec, now: NOW, memory: { v: 2, content: spec.id, specVersion: spec.version, at: NOW,
    estimates: { content: { theta: 6, n: 10, reversals: 0 }, pace: { theta: 6, n: 10, reversals: 0 } },
    indices: { 'item.difficulty': 0, patience: 2, hint: 1, text: 1 }, latencies: [] } });
  const assisted = high.observe({ outcome: 'success', assisted: true, pressure: 0.3 });
  assert.ok(!assisted.change || assisted.change.direction < 0, 'no raise right after an assisted success');
  const quiet = high.observe({ outcome: 'success', pressure: 0.3 });
  assert.equal(quiet.change?.direction, 1, 'the next quiet success may raise');
});

test('a timeout eases time first; a content miss eases content first', () => {
  const timed = Flow.start({ spec: rush(), now: NOW });
  const t = timed.observe({ outcome: 'timeout' });
  assert.equal(t.change.kind, 'pace');
  assert.equal(t.change.because, 'time-ran-out');
  assert.equal(t.settings.values.patience, 52);
  const missed = Flow.start({ spec: rush(), now: NOW });
  missed.observe({ outcome: 'success', pressure: 0.3 }); missed.observe({ outcome: 'success', pressure: 0.3 });
  missed.observe({ outcome: 'success', pressure: 0.3 });
  const m = play(missed, ['fail', 'fail']).map(r => r.change).filter(Boolean);
  assert.ok(m.length && m.every(c => c.kind !== 'pace'), 'content misses never loosen the clock first');
});

test('successes that used most of the time never speed things up', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  const results = play(run, Array(16).fill({ outcome: 'success', pressure: 0.95 }));
  assert.ok(results.every(r => !r.change || r.change.kind !== 'pace' || r.change.direction < 0));
});

test('declared choices hold: locks, declared-only knobs, fixed mode and the comparison arm', () => {
  const locked = Flow.start({ spec: rush(), now: NOW, declared: { knobs: { patience: 0, text: 0 } } });
  play(locked, Array(10).fill('timeout').concat(Array(10).fill({ outcome: 'success', pressure: 0.1 })));
  assert.equal(locked.settings().values.patience, 60);
  assert.equal(locked.settings().values.text, 'large');
  const fixed = Flow.start({ spec: rush(), now: NOW, declared: { mode: 'fixed' } });
  assert.ok(play(fixed, Array(10).fill('fail')).every(r => r.change === null));
  assert.equal(fixed.intro().code, 'start.fixed');
  const baseline = Flow.start({ spec: rush(), now: NOW, arm: 'baseline' });
  assert.ok(play(baseline, Array(10).fill({ outcome: 'success', pressure: 0.1 })).every(r => r.change === null));
  assert.equal(baseline.intro().code, 'start.baseline');
  // Even an adapted run never moves a declared-only knob.
  const run = Flow.start({ spec: rush(), now: NOW });
  play(run, Array(30).fill('fail'));
  assert.equal(run.settings().values.text, 'standard');
});

test('skipped or void responses are not evidence and move nothing', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  const results = play(run, ['skip', 'void', 'skip', 'void']);
  assert.ok(results.every(r => r.change === null && r.evidence === false));
  assert.deepEqual(run.settings().indices, Flow.start({ spec: rush(), now: NOW }).settings().indices);
});

test('memory resumes where the person left off; a long gap starts lighter without counting days', () => {
  const spec = rush(), run = Flow.start({ spec, now: NOW });
  play(run, Array(14).fill({ outcome: 'success', pressure: 0.3 }));
  const memory = run.memory(NOW), before = run.settings().indices;
  assert.deepEqual(Object.keys(memory).sort(), ['at', 'content', 'estimates', 'indices', 'latencies', 'policy', 'specVersion', 'v']);
  const resumed = Flow.start({ spec, memory, now: later(1) });
  assert.equal(resumed.intro().code, 'start.memory');
  assert.deepEqual(resumed.settings().indices, before);
  const back = Flow.start({ spec, memory, now: later(30) });
  assert.equal(back.intro().code, 'start.returning');
  assert.ok(Flow.challenge(spec, back.settings().indices) < Flow.challenge(spec, before), 'starts a step lighter');
  const other = Flow.defineContent({ ...JSON.parse(JSON.stringify({ id: 'test.rush', version: 2, items: { levels: [1, 2, 3] }, knobs: [{ id: 'patience', kind: 'pace', values: [60, 52, 45], start: 1 }] })) });
  assert.equal(Flow.start({ spec: other, memory, now: later(1) }).intro().code, 'start.default', 'another version of the content starts fresh');
});

test('a prior from other practice starts higher only when that practice was independent', () => {
  const spec = rush();
  const summary = status => ({ skills: [{ id: 'ko.reading.detail', levels: { 1: { formats: { 'single-choice': { status } } }, 2: { formats: { 'single-choice': { status: 'checking' } } } } }] });
  const prior = Flow.priorFromSummary(spec, summary('recent-independent'), ['ko.reading.detail']);
  assert.equal(prior.level, 2);
  const run = Flow.start({ spec, prior, now: NOW });
  assert.equal(run.intro().code, 'start.prior');
  assert.equal(run.settings().level, 2);
  assert.equal(Flow.priorFromSummary(spec, summary('supported'), ['ko.reading.detail']), null);
  assert.equal(Flow.priorFromSummary(spec, summary('recent-independent'), ['ko.reading.unknown']), null);
});

test('a tired day never makes anything harder, offers no less help, and its start line says only that', () => {
  const quick = Array(20).fill({ outcome: 'success', pressure: 0.1 });
  const normal = Flow.start({ spec: rush(), now: NOW });
  assert.ok(play(normal, quick).some(r => r.change?.direction > 0), 'the same answers raise on a normal day');
  const run = Flow.start({ spec: rush(), now: NOW, condition: 'tired' });
  assert.equal(run.intro().code, 'start.tired');
  assert.ok(run.intro().opening.every(c => c.direction < 0), 'the opening only eases');
  assert.ok(play(run, quick).every(r => !r.change || r.change.direction < 0));
  assert.equal(run.lessHelpAllowed(), false);
  assert.equal(run.acceptLessHelp(), null);
  // Time is not the part that gets harder sooner: the clock never tightens past where the day began.
  const spec = rush(), pace = r => Flow.challenge(spec, r.settings().indices) - Flow.challenge(spec, { ...r.settings().indices, patience: 0 });
  const tired = Flow.start({ spec, now: NOW, condition: 'tired' }), began = pace(tired);
  for (const o of [...quick, 'fail', ...quick]) { tired.observe(typeof o === 'string' ? { outcome: o } : o); assert.ok(pace(tired) <= began); }
  // Other practice may start a normal day higher, never a tired one.
  const prior = { content: 6, level: 3, basis: 'practice-summary' };
  assert.ok(Flow.start({ spec: rush(), now: NOW, prior }).intro().opening.some(c => c.direction > 0));
  const tiredPrior = Flow.start({ spec: rush(), now: NOW, prior, condition: 'tired' });
  assert.ok(tiredPrior.intro().opening.every(c => c.direction < 0));
  assert.equal(tiredPrior.settings().level, 1);
});

test('an opening taken for today alone is not kept: the next day starts where adapted play reached', () => {
  const spec = rush(), defaults = Flow.start({ spec, now: NOW }).settings().indices;
  // A tired day opens a step lighter (its aims are higher) ...
  const tired = Flow.start({ spec, now: NOW, condition: 'tired' });
  assert.ok(tired.intro().opening.some(c => c.because === 'tired'), 'the tired day eased its opening');
  assert.notDeepEqual(tired.settings().indices, defaults);
  // ... and with nothing else happening, what is kept is where the person was, not today's lighter start.
  assert.deepEqual(tired.memory(NOW).indices, defaults);
  const next = Flow.start({ spec, now: later(1), memory: tired.memory(NOW) });
  assert.equal(next.intro().code, 'start.memory');
  assert.deepEqual(next.settings().indices, defaults, 'the next day does not start lighter because of yesterday');
  // A miss in the round is still learnt: one step eased in play stays eased.
  const missed = Flow.start({ spec, now: NOW, condition: 'tired' });
  const eased = play(missed, [{ outcome: 'fail', pressure: 0.2 }, { outcome: 'fail', pressure: 0.2 }]).filter(r => r.change).length;
  assert.ok(eased >= 1);
  const kept = missed.memory(NOW).indices;
  assert.ok(Flow.challenge(spec, kept) < Flow.challenge(spec, defaults), 'what play eased stays eased');
  assert.ok(Flow.challenge(spec, kept) > Flow.challenge(spec, missed.settings().indices), 'only the tired opening is undone');
  // A round chosen easier is today's choice too.
  const easier = Flow.start({ spec, now: NOW, declared: { mode: 'easier' } });
  if (easier.intro().opening.length) assert.deepEqual(easier.memory(NOW).indices, defaults);
});

test('successes in a row, with help or without, are counted for the offer of less help; a miss ends the run', () => {
  const spec = Flow.defineContent({ id: 'test.auto-help', knobs: [{ id: 'clue', kind: 'support', values: ['at-once', 'on-pause', 'on-press'], start: 0 }] });
  const run = Flow.start({ spec, now: NOW });
  play(run, Array(3).fill({ outcome: 'success', assisted: true }));
  assert.equal(run.quietStreak(), 0, 'a helped success is never quiet');
  assert.equal(run.steadyStreak(), 3);
  play(run, ['fail']);
  assert.equal(run.steadyStreak(), 0);
  play(run, ['skip', 'void']);
  assert.equal(run.steadyStreak(), 0, 'a skipped response is not a success');
  play(run, Array(4).fill({ outcome: 'success', assisted: true }));
  assert.equal(run.steadyStreak(), 4);
  assert.equal(run.lessHelpAllowed(), true);
  assert.equal(run.acceptLessHelp().to, 1);
  assert.equal(run.steadyStreak(), 0, 'the new help level earns its own run');
  // More help after a struggle starts the run again too: the successes counted are at this level.
  const eased = Flow.start({ spec: Flow.defineContent({ id: 'test.auto-help.mid', knobs: [{ id: 'clue', kind: 'support', values: ['at-once', 'on-pause', 'on-press'], start: 2 }] }), now: NOW });
  const turns = play(eased, [{ outcome: 'success', assisted: true }, 'fail', { outcome: 'success', assisted: true }, { outcome: 'success', assisted: true }]);
  const lastEase = turns.map((r, i) => r.change?.kind === 'support' ? i : -1).filter(i => i >= 0).at(-1);
  assert.ok(lastEase >= 0, 'help came earlier');
  assert.equal(eased.steadyStreak(), turns.length - 1 - lastEase, 'only successes after the last change of help count');
});

test('less help the person accepted is kept: the next round does not quietly take it back', () => {
  const spec = Flow.defineContent({ id: 'test.auto-help.kept', knobs: [{ id: 'clue', kind: 'support', values: ['at-once', 'on-pause', 'on-press'], start: 2 }] });
  const run = Flow.start({ spec, now: NOW });
  play(run, ['fail', { outcome: 'success', assisted: true }, 'fail']);
  assert.equal(run.settings().values.clue, 'at-once', 'misses brought the help to its earliest');
  play(run, Array(4).fill({ outcome: 'success', assisted: true }));
  assert.equal(run.acceptLessHelp().value, 'on-pause');
  const next = Flow.start({ spec, now: later(1), memory: run.memory(NOW) });
  assert.equal(next.settings().values.clue, 'on-pause', 'the next round opens where the person chose');
  play(next, ['fail']);
  assert.equal(next.settings().values.clue, 'at-once', 'a miss still brings the help back');
});

test('a day chosen to be easier lifts both aims: for the same answers, time pressure is never higher than on a normal day', () => {
  let seed = 20261002;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const cafe = Flow.defineContent({ id: 'test.cafe', items: { levels: [1, 2, 3], weight: 2 }, knobs: [
    { id: 'patience', kind: 'pace', values: [60, 54, 48, 42, 36, 30], start: 3 }, { id: 'spawn', kind: 'pace', values: [15, 13, 11, 10, 8, 7], start: 3 },
    { id: 'queue', kind: 'pace', values: [2, 3, 4], start: 1, weight: 1.5 }] });
  for (const spec of [rush(), cafe]) {
    const pace = run => { const at = run.settings().indices; return spec.knobs.reduce((sum, k) => sum + (k.kind === 'pace' ? k.weight * at[k.id] : 0), 0); };
    for (let s = 0; s < 120; s += 1) {
      const success = 0.5 + 0.5 * random(), timeout = 0.15 * random(), speed = random();
      const normal = Flow.start({ spec, now: NOW }), easier = Flow.start({ spec, now: NOW, declared: { mode: 'easier' } });
      for (let i = 0; i < 30; i += 1) {
        const u = random(), o = u < timeout ? { outcome: 'timeout' } : u < timeout + (1 - timeout) * success
          ? { outcome: 'success', pressure: Math.min(1, speed * 0.9 + 0.1 * random()) } : { outcome: 'fail', pressure: Math.min(1, speed) };
        normal.observe(o); easier.observe(o);
        assert.ok(pace(easier) <= pace(normal), `sequence ${s}, answer ${i + 1}`);
      }
    }
  }
});

test('a skipped or void response is not a pause: the rails count answers only', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  let raised = null;
  while (!raised) raised = run.observe({ outcome: 'success', pressure: 0.2 }).change;
  play(run, ['skip', 'void', 'skip', 'void', 'skip']);
  assert.equal(run.lessHelpAllowed(), false, 'still right after the raise');
  const next = run.observe({ outcome: 'success', pressure: 0.2 });
  assert.ok(!next.change || next.change.direction < 0, 'the pause after a raise is measured in answers');
  assert.equal(run.trace().at(-1).response, run.trace().length);
});

test('a fixed round or a knob set by hand never overwrites where adapted play had reached', () => {
  const spec = rush(), run = Flow.start({ spec, now: NOW });
  play(run, Array(14).fill({ outcome: 'success', pressure: 0.3 }));
  const reached = run.settings().indices, memory = run.memory(NOW);
  assert.notDeepEqual(reached, Flow.start({ spec, now: NOW }).settings().indices);
  for (const declared of [{ mode: 'fixed' }, { knobs: { patience: 0 } }]) {
    const today = Flow.start({ spec, memory, now: later(1), declared });
    play(today, Array(6).fill({ outcome: 'success', pressure: 0.3 }));
    const saved = today.memory(later(1)), next = Flow.start({ spec, memory: saved, now: later(2) });
    assert.equal(next.intro().code, 'start.memory');
    if (declared.mode) assert.deepEqual(next.settings().indices, reached);
    else {
      assert.equal(saved.indices.patience, reached.patience, 'the hand-set knob returns to where it was');
      assert.ok(saved.estimates.pace.theta >= memory.estimates.pace.theta, 'and what was learned about time is kept');
    }
  }
  // Answers in a fixed round are still evidence: struggling there eases the next adapted start.
  const hard = Flow.start({ spec, memory, now: later(1), declared: { mode: 'fixed' } });
  play(hard, Array(6).fill('fail'));
  assert.deepEqual(hard.memory(later(1)).indices, reached);
  assert.ok(Flow.challenge(spec, Flow.start({ spec, memory: hard.memory(later(1)), now: later(2) }).settings().indices) < Flow.challenge(spec, reached));
  const baseline = Flow.start({ spec, memory, now: later(1), arm: 'baseline' });
  play(baseline, Array(6).fill({ outcome: 'success', pressure: 0.2 }));
  assert.deepEqual(baseline.memory(later(1)).indices, reached);
});

test('a missed answer never raises anything, even when the other part looks ready', () => {
  const spec = rush(), at = Flow.start({ spec, now: NOW }).memory(NOW);
  // Well ahead on both: one miss does not bring content into easing, and time looks ready to tighten.
  const ahead = { theta: 0, n: 40, reversals: 0 };
  const fast = () => Flow.start({ spec, now: later(1), memory: { ...at, estimates: {
    content: { ...ahead, theta: at.estimates.content.theta + 3 }, pace: { ...ahead, theta: at.estimates.pace.theta + 3 } } } });
  const missed = fast().observe({ outcome: 'fail', pressure: 0.2 });
  assert.equal(missed.change, null, 'quick, but wrong: nothing gets harder');
  assert.equal(fast().observe({ outcome: 'success', pressure: 0.2 }).change?.direction, 1, 'quick and right: one step up');
});

test('a raise is not taken where the next answer would ease it straight back', () => {
  const spec = rush(), at = Flow.start({ spec, now: NOW }).memory(NOW);
  const ahead = steps => Flow.start({ spec, now: later(1), memory: { ...at, estimates: {
    content: { theta: at.estimates.content.theta + steps * spec.scale, n: 40, reversals: 100 }, pace: { ...at.estimates.pace, n: 40, reversals: 100 } } } });
  // One item level is two steps. Just over one step ahead, it would land back in the easing zone.
  assert.equal(ahead(1).observe({ outcome: 'success', pressure: 0.6 }).change, null);
  const clear = ahead(1.4).observe({ outcome: 'success', pressure: 0.6 }).change;
  assert.equal(clear?.knob, Flow.ITEM);
  assert.equal(clear.because, 'steady-success');
});

test('a quiet streak only steps up to a level the person can still meet near the aim', () => {
  const spec = rush(), at = Flow.start({ spec, now: NOW }).memory(NOW);
  // A settled estimate (many reversals, small steps) just around the current level. One item step
  // (weight 2) is a big jump: taken only when the estimate already reaches near the aim there.
  const settled = shift => Flow.start({ spec, now: later(1), memory: { ...at, estimates: {
    content: { theta: at.estimates.content.theta + shift, n: 40, reversals: 100 }, pace: { ...at.estimates.pace, n: 40, reversals: 100 } } } });
  const streakOf = run => play(run, Array(4).fill({ outcome: 'success', pressure: 0.6 })).map(r => r.change).filter(Boolean);
  const below = settled(-0.15), changes = streakOf(below);
  assert.equal(below.quietStreak(), 4, 'four quiet successes in a row');
  assert.deepEqual(changes, [], 'the item step was beyond reach, so the level holds');
  const near = streakOf(settled(0.1));
  assert.equal(near.length, 1);
  assert.equal(near[0].knob, Flow.ITEM);
  assert.equal(near[0].because, 'quiet-streak', 'within reach, the streak steps up');
});

test('less help is only ever accepted, one step, and never in the same response as another change', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  const results = play(run, Array(15).fill({ outcome: 'success', pressure: 0.3 }));
  assert.ok(results.every(r => !r.change || r.change.kind !== 'support' || r.change.direction < 0), 'support never rises by itself');
  // Wait for a calm moment: not the response that changed something, nor the pause after a raise.
  for (let i = 0; i < 8 && !run.lessHelpAllowed(); i += 1) {
    if (run.observe({ outcome: 'success', pressure: 0.3 }).change) assert.equal(run.lessHelpAllowed(), false);
  }
  assert.equal(run.lessHelpAllowed(), true);
  const accepted = run.acceptLessHelp();
  assert.equal(accepted.because, 'accepted-less-help');
  assert.equal(accepted.to, accepted.from + 1);
  assert.equal(run.acceptLessHelp(), null, 'one step for one calm moment');
});

test('the floor names the dimension that has no easier step left', () => {
  const run = Flow.start({ spec: rush(), now: NOW });
  assert.deepEqual(run.floor(), []);
  play(run, Array(30).fill('timeout'));
  assert.ok(run.floor().includes('pace'), 'time pressure cannot ease further');
  const content = Flow.start({ spec: rush(), now: NOW });
  play(content, Array(30).fill({ outcome: 'fail', pressure: 0.2 }));
  assert.ok(content.floor().includes('content'));
});

test('the same inputs give the same decisions', () => {
  const sequence = ['success', 'success', 'fail', 'timeout', { outcome: 'success', pressure: 0.2 }, 'fail', 'success', 'success', 'success', 'success'];
  const a = Flow.start({ spec: rush(), now: NOW }), b = Flow.start({ spec: rush(), now: NOW });
  play(a, sequence); play(b, sequence);
  assert.deepEqual(a.trace(), b.trace());
});

// The settings a person chose (Core personalization) as this content's declared locks (§9).
const Personalization = require('../atlas/personalization');
const chosen = () => Flow.defineContent({ id: 'test.chosen', target: 0.75, knobs: [
  { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 },
  { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 },
  { id: 'textSize', kind: 'content', follows: 'declared', values: ['standard', 'large'], start: 0 },
  { id: 'motion', kind: 'content', follows: 'declared', values: ['full', 'reduced'], start: 0 },
  { id: 'text', kind: 'content', follows: 'declared', values: ['large', 'standard'], start: 1 },
] });

test('a chosen help style holds the help knob; "choose" leaves help to the round', () => {
  assert.deepEqual(Flow.declaredFrom(chosen(), { support: 'step' }).knobs, { hint: 0 });
  assert.deepEqual(Flow.declaredFrom(chosen(), { support: 'independent' }).knobs, { hint: 2 });
  assert.deepEqual(Flow.declaredFrom(chosen(), { support: 'choose' }).knobs, {});
  assert.deepEqual(Flow.declaredFrom(chosen(), {}).knobs, {});
  // Step-by-step help stays the most help even when every answer is right ...
  const step = Flow.start({ spec: chosen(), now: NOW, declared: Flow.declaredFrom(chosen(), { support: 'step' }) });
  play(step, Array(16).fill({ outcome: 'success', pressure: 0.2 }));
  assert.equal(step.settings().values.hint, 'early');
  assert.ok(step.changes().some(change => change.knob === 'patience'), 'the rest of the content still follows the person');
  assert.equal(step.lessHelpAllowed(), false, 'less help is not even offered against the chosen style');
  assert.equal(step.acceptLessHelp(), null);
  // ... and working alone is not overruled by more help when answers miss.
  const alone = Flow.start({ spec: chosen(), now: NOW, declared: Flow.declaredFrom(chosen(), { support: 'independent' }) });
  play(alone, Array(12).fill({ outcome: 'fail', pressure: 0.9 }));
  assert.equal(alone.settings().values.hint, 'late');
  assert.ok(alone.changes().length > 0, 'it eases elsewhere instead');
});

test('text size, motion and explanation set the declared knob of the same name, nothing else', () => {
  const declared = Flow.declaredFrom(chosen(), { textSize: 'large', motion: 'reduced', explanation: 'brief', audio: 'off' });
  assert.deepEqual(declared.knobs, { textSize: 1, motion: 1 });
  const run = Flow.start({ spec: chosen(), now: NOW, declared });
  assert.equal(run.settings().values.textSize, 'large');
  assert.equal(run.settings().values.motion, 'reduced');
  assert.equal(run.settings().values.text, 'standard', 'a declared knob with another name keeps the content default');
  // A content that has no such knob simply has nothing to hold.
  assert.deepEqual(Flow.declaredFrom(rush(), { textSize: 'large', support: 'choose' }).knobs, {});
});

test('only presentation settings are accepted, in the personalization adapter vocabulary', () => {
  for (const extra of [{ minutes: 10 }, { goal: 'study' }, { reasons: ['travel'] }, { age: 40 }, { gender: 'f' }]) {
    assert.throws(() => Flow.declaredFrom(chosen(), extra), /presentation accepts only/);
  }
  assert.throws(() => Flow.declaredFrom(chosen(), { support: 'maybe' }), /invalid presentation support/);
  assert.throws(() => Flow.declaredFrom(chosen(), { textSize: 'huge' }), /invalid presentation textSize/);
  for (const bad of [null, [], 'step']) assert.throws(() => Flow.declaredFrom(chosen(), bad), /presentation accepts only/);
  for (const key of Object.keys(Flow.PRESENTATION)) assert.deepEqual([...Flow.PRESENTATION[key]], [...Personalization.OPTIONS[key]], key);
});

test('from a remembered profile to the round: the person’s own choice, or a fitting default for a first time', () => {
  const scope = { personId: 'person-1', productId: 'atlas-lab', contextId: 'numbers', domain: 'LAB' };
  const at = '2026-10-02T09:00:00.000Z';
  const pick = values => {
    const profile = Personalization.updateProfile(Personalization.createProfile({ scope, at }), { values, consent: true }, at);
    return Personalization.selectPersonalization({ profile, scope, at, experienceId: 'atlas-lab.numbers',
      candidates: [{ id: 'atlas-lab.numbers', minutes: 3, pace: 'short' }] }).presentation;
  };
  const values = presentation => Flow.start({ spec: chosen(), now: NOW, declared: Flow.declaredFrom(chosen(), presentation) }).settings().values;
  assert.equal(values(pick({ support: 'independent', textSize: 'large' })).hint, 'late');
  assert.equal(values(pick({ support: 'independent', textSize: 'large' })).textSize, 'large');
  assert.equal(values(pick({ experience: 'new' })).hint, 'early', 'a first-timer who did not choose gets step-by-step help');
  assert.equal(values(pick({ experience: 'practiced' })).hint, 'normal', 'otherwise help is left to the round');
});
