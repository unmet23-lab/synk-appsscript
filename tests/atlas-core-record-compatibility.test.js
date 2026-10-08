'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../atlas/engine');
const Trail = require('../atlas/trail');
const Game = require('../atlas/game-learning');
const Strata = require('../strata');

const scope = { domain: 'LAB', workspace: 'record-review', subject: 'synthetic' };
const candidates = [{ id: 'standard', minutes: 3, pace: 'standard' }];
const levers = [{ id: 'focus', class: 'content', options: [
  { id: 'tone', targets: ['need:honorific'] },
  { id: 'clarity', targets: ['need:deadline'] },
  { id: 'purpose', targets: ['need:purpose'] },
] }];
function fixture() {
  let serial = 0, time = Date.parse('2026-10-08T00:00:00.000Z');
  const clock = () => new Date(time += 1000).toISOString();
  const session = Core.createSession({ scope, clock, id: () => `record.${++serial}` });
  const plan = () => session.plan('reading', candidates, { levers });
  for (const [key, strength] of [['honorific', 0.9], ['deadline', 0.8], ['purpose', 0.5]]) session.observe({ kind: 'need', key, strength, n: 8 });
  const decision = plan(); session.complete(decision);
  const presentation = session.practice('presented', { decisionId: decision.id, taskId: 'read', taskVersion: 'v1',
    itemKey: 'read.new', conceptIds: ['honorific', 'deadline'], firstExposure: true });
  const attempt = session.practice('attempted', { presentationId: presentation.id, attemptNo: 1, verdict: 'correct', errorTags: [] });
  const definition = { measure: 'independent', window: 'immediate', assisted: false, attemptId: attempt.id, targetLine: 'need:honorific' };
  const original = session.outcome(decision.id, { ...definition, value: 1 });
  session.complete(plan()); // The next decision can revisit tone, without consecutive-content suppression.
  return { session, decision, presentation, original, clock, plan,
    outcome: extra => session.outcome(decision.id, { ...definition, value: 1, ...extra }) };
}
const focus = plan => plan.bundle.focus.option;
const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reorder(entry)])) : value;

test('excluding the latest outcome keeps the corrected learning need instead of reviving an older success', () => {
  const f = fixture();
  assert.equal(focus(f.plan()), 'purpose', 'qualified success initially lowers the tone need');
  const correction = f.outcome({ value: 0.2 });
  assert.equal(focus(f.plan()), 'tone');
  f.session.exclude(correction.id);
  const next = f.plan();
  assert.equal(focus(next), 'tone', 'excluding the correction is not permission to restore the previous success');
  assert.equal(next.outcomeBasis, 'unobserved');
  assert.ok(!next.evidence.includes(f.original.id));
  assert.deepEqual(f.session.state().outcomes, []);
  assert.ok(f.session.events().some(row => row.id === f.original.id), 'original reports remain in the log');
  const restored = Core.createSession({ scope, clock: f.clock, events: JSON.parse(JSON.stringify(f.session.events())) });
  assert.equal(focus(restored.plan('reading', candidates, { levers })), 'tone', 'durable replay preserves the exclusion');
  assert.deepEqual(restored.state().outcomes, []);
  const fresh = f.outcome({ value: 0.9 });
  assert.equal(f.session.state().outcomes[0].id, fresh.id, 'a genuinely newer report can become current');
});

test('outcome exclusion applies at both cutoffs and stays inside its report group', () => {
  const f = fixture(), correction = f.outcome({ value: null, reason: 'unmeasurable' });
  const otherWindow = f.outcome({ window: 'd1' });
  const otherTarget = f.outcome({ targetLine: 'need:deadline' });
  const excluded = f.session.exclude(correction.id);
  const events = f.session.events();
  assert.equal(Core.understand(events, scope, f.original.at).outcomes[0].id, f.original.id);
  assert.ok(Core.understand(events, scope, correction.at).outcomes.some(row => row.id === correction.id));
  const expectedIds = [otherWindow.id, otherTarget.id].sort();
  assert.deepEqual(Core.understand(events, scope, excluded.at).outcomes.map(row => row.id).sort(), expectedIds);
  const laterReceipt = f.clock();
  const delayed = events.map(row => row.id === excluded.id ? { ...row, recordedAt: laterReceipt } : row);
  assert.ok(Core.understand(delayed, scope, excluded.at).outcomes.some(row => row.id === correction.id), 'a not-yet-received exclusion does not rewrite the past');
  assert.deepEqual(Core.understand(delayed, scope, excluded.at, laterReceipt).outcomes.map(row => row.id).sort(), expectedIds);
});

test('excluding an older report does not remove the newer report or undo decision exclusion', () => {
  const f = fixture(), latest = f.outcome({ value: 0.9 });
  f.session.exclude(f.original.id);
  assert.equal(f.session.state().outcomes[0].id, latest.id);
  assert.equal(f.plan().outcomeBasis, 'performance');
  f.session.exclude(f.decision.id);
  assert.deepEqual(f.session.state().outcomes, []);
  assert.equal(f.plan().outcomeBasis, 'unobserved');
});

test('Core replay and append accept reordered object keys while preserving the original event and array order', () => {
  const f = fixture(), events = f.session.events();
  const retry = reorder(f.presentation);
  const restored = Core.createSession({ scope, clock: f.clock, events: [...events, retry] });
  assert.deepEqual(restored.events(), events);
  assert.deepEqual(Core.append(events, retry), events);
  const summary = Trail.summarize(restored.events(), { scope, asOf: f.clock() });
  assert.equal(summary.presentations.length, 1);
  assert.equal(summary.attempts.length, 1);
  for (const changed of [{ ...retry, firstExposure: false }, { ...retry, conceptIds: [...retry.conceptIds].reverse() }]) {
    assert.throws(() => Core.createSession({ scope, events: [...events, changed] }), /conflicting event id/);
    assert.throws(() => Core.append(events, changed), /conflicting event id/);
  }
  const legacy = events.map(row => row.type === 'decision.made' ? { ...row, policy: 'atlas-2.3.0' } : row);
  assert.deepEqual(Core.createSession({ scope, events: [...legacy, reorder(legacy[0])] }).events(), legacy);
});

test('learning storage restores reordered duplicate records without losing evidence or masking a genuine conflict', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const map = Strata.createMap(require('../strata/maps/topik-i.json'));
  const options = { gameId: 'record-review', map, storage, clock: () => '2026-10-08T01:00:00.000Z' };
  const game = Game.createGame(options);
  const pid = game.present({ id: 'read', itemKey: 'read', skillId: 'ko.reading.detail', difficulty: 1,
    modality: 'reading', responseFormat: 'single-choice' });
  game.answer(pid, { correct: true, assessable: true });
  const key = `${Game.KEY}.device`, original = JSON.parse(values.get(key));
  const presentation = original.events.find(row => row.type === 'practice.presented');
  values.set(key, JSON.stringify({ ...original, events: [...original.events, reorder(presentation)] }));
  const restored = Game.createGame(options);
  assert.equal(restored.summary().storage.available, true);
  assert.equal(restored.summary().counts.independent.correct, 1);
  assert.equal(restored.events().filter(row => row.id === presentation.id).length, 1);
  const conflicting = JSON.stringify({ ...original, events: [...original.events, { ...reorder(presentation), firstExposure: false }] });
  values.set(key, conflicting);
  assert.equal(Game.createGame(options).summary().storage.available, false);
  assert.equal(values.get(key), conflicting, 'a truly conflicting record is preserved for recovery');
});
