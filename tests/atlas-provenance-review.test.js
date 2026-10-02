'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Trail = require('../atlas/trail');
const Temper = require('../atlas/temper');
const { createGame } = require('../atlas/game-learning');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const scope = { domain: 'LAB', workspace: 'audit', subject: 'synthetic' };
const at = n => new Date(Date.parse('2026-10-02T01:00:00Z') + n * 1000).toISOString();
const measure = { skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, familyKey: 'family',
  audioRequired: false, confounded: false, responseFormat: 'single-choice' };
function summary({ reason, measurement = measure, firstExposure = true } = {}) {
  const base = (id, type, fields) => ({ schema: 1, id, type, scope, at: at(1), recordedAt: at(1), ...fields });
  const events = [base('d', 'decision.made', {}), base('p', 'practice.presented', {
    decisionId: 'd', taskId: 'item', taskVersion: 'v1', itemKey: 'item', conceptIds: ['ko.reading.detail'], firstExposure,
    ...(measurement ? { measure: measurement } : {}),
  }), base('a', 'practice.attempted', { presentationId: 'p', attemptNo: 1, verdict: 'correct', errorTags: [], ...(reason ? { reason } : {}) })];
  return Trail.summarize(events, { scope, asOf: at(10) });
}

test('explicit measurement exclusion survives Trail, Temper, game summary and a saved-log reload', () => {
  for (const reason of ['motor', 'audio', 'unanswered', 'demo', 'visual', 'storage']) {
    for (const measurement of [measure, null]) {
      const observed = summary({ reason, measurement });
      assert.equal(observed.attempts[0].independent, false, reason);
      assert.equal(observed.attempts[0].exclusionReason, reason);
      assert.equal(observed.met[0].verdict, null, 'the encounter remains, but its unusable verdict does not become growth history');
      assert.equal(Temper.measure(observed).independent.evaluated, 0);
    }
    const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
    const options = { gameId: 'audit', map, storage, clock: () => at(1) };
    const game = createGame(options), p = game.present({ id: 'item', itemKey: 'item', ...measure });
    assert.equal(game.answer(p, { correct: true, assessable: true, reason }).independent, false, reason);
    for (const current of [game, createGame(options)]) {
      assert.equal(current.summary().independent, 0);
      assert.equal(current.summary().counts.independent.evaluated, 0);
    }
  }
});

test('Temper rechecks measurement exclusion, audio delivery and visual confounds', () => {
  for (const fields of [{ exclusionReason: 'motor' }, { measure: { ...measure, confounded: true } },
    { measure: { ...measure, audioRequired: true }, audio: 'pending' }]) {
    const observed = summary();
    Object.assign(observed.attempts[0], fields, { independent: true });
    assert.equal(Temper.measure(observed).independent.evaluated, 0);
  }
});

test('same-input comparison keeps exposure and authored measurement conditions in its identity', () => {
  for (const change of [{ modality: 'listening' }, { difficulty: 2 }, { familyKey: 'other' },
    { responseFormat: 'binary-choice' }, { audioRequired: true }, { confounded: true }]) {
    const result = Temper.compare({ before: summary(), after: summary({ measurement: { ...measure, ...change } }) });
    assert.equal(result.status, 'not_comparable', JSON.stringify(change));
    assert.equal(result.independentAccuracyDifference, null);
  }
  assert.equal(Temper.compare({ before: summary(), after: summary({ firstExposure: false }) }).status, 'not_comparable');
  assert.equal(Temper.compare({ before: summary(), after: summary({ measurement: null }) }).status, 'not_comparable');
  const reordered = Object.fromEntries(Object.entries(measure).reverse());
  assert.equal(Temper.compare({ before: summary(), after: summary({ measurement: reordered }) }).status, 'measured');
});

test('Trail accepts identical serialized retries regardless of object key order', () => {
  const event = { schema: 1, id: 'p', type: 'practice.presented', scope, at: at(1), recordedAt: at(1),
    decisionId: 'd', taskId: 'item', taskVersion: 'v1', itemKey: 'item', conceptIds: ['ko.reading.detail'], firstExposure: true, measure };
  const decision = { schema: 1, id: 'd', type: 'decision.made', scope, at: at(0), recordedAt: at(0) };
  const reordered = Object.fromEntries(Object.entries(event).reverse());
  assert.equal(Trail.checkLink([decision, event], reordered), reordered);
  assert.equal(Trail.summarize([decision, event, reordered], { scope, asOf: at(10) }).presentations.length, 1);
});
