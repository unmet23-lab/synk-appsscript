'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../atlas/engine');
const Trail = require('../atlas/trail');
const Temper = require('../atlas/temper');
const { createGame, KEY } = require('../atlas/game-learning');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const scope = { domain: 'LAB', workspace: 'delivery-review', subject: 'synthetic' };
const measure = { skillId: 'ko.listening.detail', modality: 'listening', difficulty: 1,
  familyKey: 'family-one', audioRequired: true, confounded: false, responseFormat: 'single-choice' };
function fixture(measurement = measure) {
  let tick = Date.parse('2026-10-05T00:00:00Z'), serial = 0;
  const clock = () => new Date(tick += 1000).toISOString();
  const session = Core.createSession({ scope, clock, id: () => `e${++serial}` });
  const decision = session.plan('listen', [{ id: 'standard', minutes: 1, pace: 'standard' }]);
  const presentation = session.practice('presented', { decisionId: decision.id, taskId: 'task', taskVersion: '1',
    itemKey: 'new-item', conceptIds: [measurement.skillId], firstExposure: true, measure: measurement });
  const delivery = audio => session.practice('delivery', { presentationId: presentation.id, audio });
  const answer = (attemptNo = 1, reason) => session.practice('attempted', { presentationId: presentation.id, attemptNo,
    verdict: 'correct', errorTags: [], ...(reason ? { reason } : {}) });
  const batch = () => Trail.summarize(session.events(), { scope, asOf: clock() });
  return { session, presentation, delivery, answer, batch };
}
function indexed(f) {
  const index = Trail.createIndex({ scope });
  let count = 0;
  return { index, update() { const events = f.session.events(); while (count < events.length) index.add(events[count++]); } };
}
function equivalent(index, summary) {
  for (const attempt of summary.attempts) {
    const { omitted, ...incremental } = index.attempt(attempt.eventId);
    assert.equal(omitted, false);
    assert.deepEqual(incremental, attempt);
  }
}

test('withdrawing audio completion removes its analytical proof in batch, incremental and restored histories', () => {
  const f = fixture(), fast = indexed(f), delivered = f.delivery('completed'), answer = f.answer();
  fast.update(); assert.equal(fast.index.attempt(answer.id).independent, true);
  f.session.exclude(delivered.id); fast.update();
  const batch = f.batch(); equivalent(fast.index, batch);
  assert.equal(fast.index.exact, true);
  assert.equal(batch.attempts[0].audio, 'pending');
  assert.equal(batch.attempts[0].independent, false);
  assert.equal(batch.attempts[0].exclusionReason, 'audio');
  assert.equal(Temper.measure(batch).independent.evaluated, 0);
  assert.equal(batch.met[0].itemKey, 'new-item'); assert.equal(batch.met[0].verdict, null);
  assert.equal(fast.index.met('new-item', 'family-one'), true, 'withdrawing proof does not erase the encounter');
  const restored = Core.createSession({ scope, events: JSON.parse(JSON.stringify(f.session.events())), clock: () => '2026-10-06T00:00:00Z' });
  const loaded = Trail.summarize(restored.events(), { scope, asOf: '2026-10-06T00:00:00Z' });
  assert.equal(Temper.measure(loaded).independent.evaluated, 0);
});

test('withdrawal before an answer stays unknown and does not revive an older completion', () => {
  const f = fixture(), fast = indexed(f);
  f.delivery('completed'); const latest = f.delivery('failed');
  fast.update(); f.session.exclude(latest.id); fast.update();
  const answer = f.answer(); fast.update();
  const batch = f.batch(); equivalent(fast.index, batch);
  assert.equal(fast.index.attempt(answer.id).audio, 'pending');
  assert.equal(batch.attempts[0].independent, false);
});

test('delivery withdrawal changes only answers that used it; later playback cannot repair an earlier answer', () => {
  const f = fixture(), fast = indexed(f), firstDelivery = f.delivery('completed');
  const first = f.answer(); fast.update();
  f.delivery('completed'); const second = f.answer(2); fast.update();
  f.session.exclude(firstDelivery.id); fast.update();
  const batch = f.batch(); equivalent(fast.index, batch);
  assert.equal(fast.index.attempt(first.id).audio, 'pending');
  assert.equal(fast.index.attempt(first.id).independent, false);
  assert.equal(fast.index.attempt(second.id).audio, 'completed');
  assert.equal(fast.index.attempt(second.id).exposure, 'repeat');
  assert.equal(Temper.measure(batch).independent.evaluated, 0);
});

test('excluding optional audio never invents a reading failure or erases help and explicit exclusions', () => {
  for (const options of [{ reading: true }, { reason: 'motor' }, { help: true }]) {
    const f = fixture(options.reading ? { ...measure, modality: 'reading', audioRequired: false } : measure), fast = indexed(f);
    const delivered = f.delivery('completed');
    if (options.help) {
      const help = f.session.practice('helped', { presentationId: f.presentation.id, helpId: 'hint', level: 'cue', contentRef: 'hint-one' });
      f.session.exclude(help.id);
    }
    const answer = f.answer(1, options.reason); fast.update();
    f.session.exclude(delivered.id); fast.update();
    const batch = f.batch(); equivalent(fast.index, batch);
    const row = fast.index.attempt(answer.id);
    if (options.reading) { assert.equal(row.independent, true); assert.equal(row.exclusionReason, null); }
    if (options.reason) assert.equal(row.exclusionReason, 'motor');
    if (options.help) { assert.equal(row.assisted, true); assert.equal(row.independent, false); }
  }
});

test('game state, restored storage and folded ledger retain the lost delivery proof without losing exposure history', () => {
  let tick = Date.parse('2026-10-05T00:00:00Z');
  const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
  const options = { gameId: 'delivery-review', map, storage, clock: () => new Date(tick += 1000).toISOString(), fold: { max: 90, keep: 60, ageMs: 0 } };
  const game = createGame(options);
  const item = i => ({ id: `item-${i}`, itemKey: `item-${i}`, skillId: 'ko.listening.detail', modality: 'listening',
    difficulty: 1, responseFormat: 'single-choice' });
  const pid = game.present(item(0)), delivered = game.delivery(pid, { audio: 'completed' });
  assert.equal(game.answer(pid, { correct: true, assessable: true }).independent, true);
  game.exclude(delivered.id);
  assert.equal(game.summary().counts.independent.evaluated, 0);
  const following = game.present(item(1));
  const decision = game.events().findLast(event => event.type === 'decision.made');
  assert.equal(decision.candidateSnapshot[0].learning.state, 'unseen', 'the fast recommendation basis loses withdrawn proof too');
  game.delivery(following, { audio: 'completed' }); game.answer(following, { correct: true, assessable: true });
  for (let i = 2; i < 45; i += 1) {
    const p = game.present(item(i)); game.delivery(p, { audio: 'completed' }); game.answer(p, { correct: true, assessable: true });
  }
  assert.ok(JSON.parse(storage.getItem(`${KEY}.device`)).ledger.folded > 0);
  for (const current of [game, createGame(options)]) {
    assert.equal(current.summary().counts.independent.evaluated, 44);
    const repeated = current.present(item(0)); current.delivery(repeated, { audio: 'completed' });
    const result = current.answer(repeated, { correct: true, assessable: true });
    assert.equal(result.exposure, 'repeat'); assert.equal(result.independent, false);
  }
});
