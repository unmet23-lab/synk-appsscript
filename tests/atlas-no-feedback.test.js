'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../atlas/engine');
const { modesFor } = require('../atlas/experiences');
const scope = { domain: 'LAB', workspace: 'missing-feedback', subject: 'synthetic-person' };
const levers = [{ id: 'vellum.help', class: 'shape', default: 'choose', learn: true,
  options: [{ id: 'choose' }, { id: 'step' }] }];
function fixture(events = []) {
  let tick = Date.parse('2026-10-05T00:00:00Z'), serial = 0;
  const session = Core.createSession({ scope, events, clock: () => new Date(tick += 1000).toISOString(), id: () => `current-${++serial}` });
  const plan = () => session.plan('letter', modesFor('LAB'), { levers });
  const round = answer => {
    const decision = plan(), completion = session.complete(decision);
    const feedback = answer ? session.feedback(completion.id, answer) : null;
    return { decision, completion, feedback };
  };
  return { session, plan, round };
}
const help = decision => decision.bundle['vellum.help'];

test('many unreported completions cannot invent favorable evidence or delay a change requested by actual feedback', () => {
  const quiet = fixture(), fresh = fixture();
  for (let n = 0; n < 40; n += 1) quiet.round();
  const before = quiet.plan();
  assert.equal(before.outcomeBasis, 'unobserved');
  assert.equal(help(before).basis, 'default');
  assert.deepEqual(help(before).evidence, []);
  assert.equal(quiet.session.state().feedback.length, 0);
  for (const f of [quiet, fresh]) { f.round('not_fit'); f.round('not_fit'); }
  assert.equal(help(quiet.plan()).option, 'step');
  assert.equal(help(quiet.plan()).option, help(fresh.plan()).option,
    'unobserved preference outcomes must have exactly zero weight');
});

test('requests about amount do not silently endorse a help style', () => {
  for (const answer of ['too_much', 'want_more']) {
    const f = fixture();
    for (let n = 0; n < 20; n += 1) f.round(answer);
    assert.equal(help(f.plan()).basis, 'default', answer);
    f.round('not_fit'); f.round('not_fit');
    assert.equal(help(f.plan()).option, 'step', `${answer} adjusts amount, not style preference`);
  }
});

test('explicit helpful feedback retains its positive meaning while withdrawing it removes that weight', () => {
  const f = fixture(), positive = f.round('helpful');
  f.round('not_fit'); f.round('not_fit');
  assert.equal(help(f.plan()).option, 'choose', 'a genuine helpful answer is distinct from silence');
  f.session.exclude(positive.feedback.id);
  const next = f.plan();
  assert.equal(help(next).option, 'step');
  assert.equal(next.evidence.includes(positive.feedback.id), false);
});

test('excluding a decision removes its derived preference from mode selection while preserving round history', () => {
  const f = fixture(), first = f.round('not_fit');
  assert.equal(first.decision.selected.id, 'balanced');
  assert.notEqual(f.plan().selected.id, 'balanced');
  f.session.exclude(first.decision.id);
  const next = f.plan();
  assert.equal(next.selected.id, 'balanced');
  assert.equal(next.outcomeBasis, 'unobserved');
  assert.equal(next.round, 1, 'the experience happened even though its evidence was withdrawn');
  assert.deepEqual(f.session.state().feedback, []);
  assert.equal(next.evidence.includes(first.feedback.id), false);
  assert.equal(next.evidence.includes(first.completion.id), false);
});

test('atlas-2.3 histories remain readable and new decisions receive the current policy version', () => {
  const old = fixture(); old.round();
  const events = old.session.events().map(event => event.type === 'decision.made'
    ? { ...event, policy: 'atlas-2.3.0' } : event);
  let serial = 0;
  const resumed = Core.createSession({ scope, events, clock: () => '2026-10-06T00:00:00Z', id: () => `resumed-${++serial}` });
  const decision = resumed.plan('letter', modesFor('LAB'), { levers });
  assert.equal(decision.version, Core.VERSION);
  assert.equal(resumed.events().findLast(event => event.type === 'decision.made').policy, Core.VERSION);
  assert.equal(resumed.events().find(event => event.type === 'decision.made').policy, 'atlas-2.3.0');
  assert.equal(help(decision).basis, 'default');
  assert.equal(decision.round, 1);
});
