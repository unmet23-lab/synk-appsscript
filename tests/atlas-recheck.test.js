'use strict';
// Synthetic in-memory histories only. No API, account, browser or student data.
const test = require('node:test'), assert = require('node:assert/strict');
const Game = require('../atlas/game-learning');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const disk = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
const item = (id, extra = {}) => ({ id, itemKey: id, familyKey: id, skillId: 'ko.reading.detail', difficulty: 1,
  responseFormat: 'single-choice', modality: 'reading', audioRequired: false, ...extra });
function fixture(extra = {}) {
  const storage = extra.storage || disk(); let now = Date.parse('2026-10-07T01:00:00Z');
  const options = { gameId: 'recheck-audit', map, storage, fold: false, clock: () => new Date(now += 1000).toISOString(), ...extra };
  const game = Game.createGame(options);
  const play = (id, { help = false, correct = false, metadata = {}, assessable = true, audio = null } = {}) => {
    const pid = game.present(item(id, metadata));
    if (help) game.help(pid, 'hint');
    if (audio) game.delivery(pid, { audio });
    const answer = game.answer(pid, { correct, assessable });
    return { pid, answer };
  };
  return { game, play, storage, options, reopen: () => Game.createGame(options) };
}
const pair = (f, a, b) => f.game.recheck(a.answer.eventId, b.answer.eventId);
const stored = f => JSON.parse(f.storage.getItem(`${Game.KEY}.device`));
const replace = (f, value) => { f.storage.setItem(`${Game.KEY}.device`, JSON.stringify(value)); return f.reopen(); };

test('four observable first-response outcomes stay separate and do not update the profile or log', () => {
  for (const help of [false, true]) for (const correct of [false, true]) {
    const f = fixture(), a = f.play('source'), b = f.play('target', { help, correct });
    const before = f.game.summary(), events = f.game.events(), raw = f.storage.getItem(`${Game.KEY}.device`);
    const result = pair(f, a, b);
    assert.equal(result.status, `${help ? 'assisted' : 'independent'}-${correct ? 'correct' : 'incorrect'}`);
    assert.deepEqual(result.source, { verdict: 'incorrect', assisted: false, independent: true });
    assert.deepEqual(result.target, { verdict: correct ? 'correct' : 'incorrect', assisted: help, independent: !help });
    assert.equal(result.correctionObserved, false); assert.deepEqual(result.correctionEventIds, []);
    assert.equal(result.learningEffectClaim, false); assert.ok(!/교정 효과|숙련|실력/.test(result.line));
    result.source.verdict = 'changed'; result.correctionEventIds.push('changed');
    assert.deepEqual(f.game.events(), events); assert.equal(f.storage.getItem(`${Game.KEY}.device`), raw);
    assert.deepEqual(f.game.summary().skills, before.skills);
    assert.deepEqual(f.game.summary().counts, before.counts);
    assert.equal(pair(f, a, b).source.verdict, 'incorrect');
  }
});

test('an assisted first answer can be a source, while a pure independent correct answer cannot', () => {
  for (const correct of [false, true]) {
    const f = fixture(), a = f.play('supported-source', { help: true, correct }), b = f.play('target', { correct: true });
    assert.equal(pair(f, a, b).status, 'independent-correct'); assert.equal(pair(f, a, b).source.assisted, true);
  }
  const f = fixture(), a = f.play('independent-source', { correct: true }), b = f.play('target', { correct: true });
  assert.equal(pair(f, a, b).reason, 'source-not-recheck');
});

test('a previously seen source error is allowed without labelling its response independent', () => {
  const f = fixture(); f.play('old-source');
  const a = f.play('old-source'), b = f.play('target', { correct: true }), result = pair(f, a, b);
  assert.equal(result.status, 'independent-correct'); assert.equal(result.source.independent, false);
  assert.equal(result.source.assisted, null);
});

test('an actual answer reveal between the named attempts is an observation, never a causal claim', () => {
  const f = fixture(), a = f.play('source');
  const correction = f.game.help(a.pid, 'answer'), b = f.play('target', { correct: true }), result = pair(f, a, b);
  assert.equal(result.status, 'independent-correct'); assert.equal(result.correctionObserved, true);
  assert.deepEqual(result.correctionEventIds, [correction.id]); assert.equal(result.learningEffectClaim, false);
  f.game.exclude(correction.id); assert.equal(pair(f, a, b).correctionObserved, false);
  f.game.help(b.pid, 'answer'); assert.equal(pair(f, a, b).correctionObserved, false, 'a reveal after the target response is not source correction');
});

test('another item in the same family and an item shown before without any answer are not fresh', () => {
  const same = fixture(), a = same.play('source'), b = same.play('variant', { metadata: { familyKey: 'source' }, correct: true });
  assert.equal(pair(same, a, b).reason, 'same-family');
  const shown = fixture(); shown.game.present(item('target'));
  const c = shown.play('source'), d = shown.play('target', { correct: true });
  assert.equal(d.answer.independent, true, 'existing attempt policy is deliberately unchanged');
  assert.equal(pair(shown, c, d).reason, 'previously-presented');
});

test('all measurement axes and the authored version must agree', () => {
  const variants = [{ skillId: 'ko.reading.negation' }, { difficulty: 2 }, { responseFormat: 'binary-choice' },
    { skillId: 'ko.listening.detail', modality: 'listening', audioRequired: false }, { audioRequired: true }, { responseFormat: 'unknown' }];
  for (const metadata of variants) {
    const f = fixture(), a = f.play('source'), b = f.play('target', { metadata, correct: true, audio: metadata.audioRequired ? 'completed' : null });
    assert.equal(pair(f, a, b).reason, 'different-measurement', JSON.stringify(metadata));
  }
  const f = fixture(), a = f.play('source'), b = f.play('target', { correct: true }), value = stored(f);
  value.events.find(event => event.id === b.pid).taskVersion = 'other-version';
  assert.equal(replace(f, value).recheck(a.answer.eventId, b.answer.eventId).reason, 'different-measurement');
  const legacy = fixture(), c = legacy.play('source'), d = legacy.play('target', { correct: true }), old = stored(legacy);
  for (const event of old.events) if (event.type === 'practice.presented') delete event.measure.responseFormat;
  assert.equal(replace(legacy, old).recheck(c.answer.eventId, d.answer.eventId).reason, 'different-measurement');
});

test('neither source nor target can point to a retry rather than its first response', () => {
  const f = fixture(), a = f.play('source'), b = f.play('target');
  f.game.help(a.pid, 'hint'); const aRetry = f.game.answer(a.pid, { correct: true, assessable: true, attemptNo: 2 });
  f.game.help(b.pid, 'hint'); const bRetry = f.game.answer(b.pid, { correct: true, assessable: true, attemptNo: 2 });
  assert.equal(f.game.recheck(aRetry.eventId, b.answer.eventId).reason, 'not-first-attempt');
  assert.equal(f.game.recheck(a.answer.eventId, bRetry.eventId).reason, 'not-first-attempt');
});

test('excluded attempts, parents, completion and delivery fail closed while records stay intact', () => {
  for (const which of ['sourceAttempt', 'targetAttempt', 'sourcePresentation', 'targetPresentation', 'sourceDecision', 'targetDecision', 'sourceCompletion', 'targetCompletion', 'delivery', 'help']) {
    const f = fixture(), a = f.play('source'), b = f.play('target', { correct: true, help: which === 'help', audio: which === 'delivery' ? 'completed' : null });
    const events = f.game.events(), ap = events.find(e => e.id === a.pid), bp = events.find(e => e.id === b.pid);
    const ids = { sourceAttempt: a.answer.eventId, targetAttempt: b.answer.eventId, sourcePresentation: a.pid, targetPresentation: b.pid,
      sourceDecision: ap.decisionId, targetDecision: bp.decisionId,
      sourceCompletion: events.find(e => e.type === 'experience.completed' && e.decisionId === ap.decisionId).id,
      targetCompletion: events.find(e => e.type === 'experience.completed' && e.decisionId === bp.decisionId).id,
      delivery: events.find(e => e.type === 'practice.delivery')?.id, help: events.find(e => e.type === 'practice.helped')?.id };
    f.game.exclude(ids[which]); assert.equal(pair(f, a, b).reason, 'excluded-evidence', which);
    assert.ok(f.game.events().some(e => e.id === ids[which]), 'exclusion does not delete the original');
  }
});

test('unassessed, skipped, confounded and incomplete audio responses are unavailable', () => {
  for (const options of [{ assessable: false }, { correct: null }, { metadata: { confounded: true } },
    { metadata: { audioRequired: true }, audio: 'failed' }]) {
    for (const side of ['source', 'target']) {
      const f = fixture(), a = f.play('source', side === 'source' ? options : {}), b = f.play('target', side === 'target' ? options : { correct: true });
      assert.equal(pair(f, a, b).status, 'unavailable', `${side} ${JSON.stringify(options)}`);
    }
  }
  const f = fixture(), metadata = { skillId: 'ko.listening.detail', modality: 'listening', audioRequired: true };
  const a = f.play('source', { metadata, audio: 'completed' }), b = f.play('target', { metadata, audio: 'completed', correct: true });
  assert.equal(pair(f, a, b).status, 'independent-correct');
});

test('explicit pairs reject reverse order, another game and future completion evidence', () => {
  const f = fixture(), a = f.play('source'), b = f.play('target', { correct: true });
  assert.equal(f.game.recheck(b.answer.eventId, a.answer.eventId).reason, 'invalid-order');
  let value = stored(f), targetDecision = value.events.find(event => event.id === b.pid).decisionId;
  const otherDecision = value.events.find(event => event.id === targetDecision), done = value.events.find(event => event.type === 'experience.completed' && event.decisionId === targetDecision);
  otherDecision.experienceId = 'another-game'; done.experienceId = 'another-game';
  assert.equal(replace(f, value).recheck(a.answer.eventId, b.answer.eventId).reason, 'different-game');
  const future = fixture(), c = future.play('source'), d = future.play('target', { correct: true });
  value = stored(future); targetDecision = value.events.find(event => event.id === d.pid).decisionId;
  const futureDone = value.events.find(event => event.type === 'experience.completed' && event.decisionId === targetDecision);
  futureDone.at = futureDone.recordedAt = '2026-10-07T02:00:00.000Z';
  assert.equal(replace(future, value).recheck(c.answer.eventId, d.answer.eventId).reason, 'invalid-order');
  const backdated = fixture(), e = backdated.play('source'), h = backdated.play('target', { correct: true });
  value = stored(backdated); targetDecision = value.events.find(event => event.id === h.pid).decisionId;
  for (const event of value.events) if ([targetDecision, h.pid, h.answer.eventId].includes(event.id) || event.decisionId === targetDecision) {
    event.at = event.recordedAt = '2026-10-07T01:00:03.000Z';
  }
  assert.equal(replace(backdated, value).recheck(e.answer.eventId, h.answer.eventId).reason, 'invalid-order');
});

test('reopening reads the same pair but missing, folded and partial histories cannot manufacture a result', () => {
  const f = fixture(), a = f.play('source'), b = f.play('target', { correct: true });
  assert.deepEqual(f.reopen().recheck(a.answer.eventId, b.answer.eventId), pair(f, a, b));
  assert.equal(f.game.recheck('missing', b.answer.eventId).reason, 'missing-attempt');
  assert.throws(() => f.game.recheck('answer text', b.answer.eventId), /attempt IDs/);
  const partial = fixture({ historyComplete: false }), c = partial.play('source'), d = partial.play('target', { correct: true });
  assert.equal(pair(partial, c, d).reason, 'incomplete-history');
  const quota = fixture({ storage: { getItem: () => null, setItem() { throw Error('quota'); } } });
  const e = quota.play('source'), h = quota.play('target', { correct: true });
  assert.equal(pair(quota, e, h).reason, 'incomplete-history');
  const folded = fixture({ fold: { max: 90, keep: 60, ageMs: 0 } }), oldSource = folded.play('source'), oldTarget = folded.play('target', { correct: true });
  for (let i = 0; i < 60; i++) folded.play(`extra-${i}`, { correct: true });
  assert.ok(stored(folded).ledger.folded > 0); assert.equal(pair(folded, oldSource, oldTarget).reason, 'missing-attempt');
});

test('folded presentation-only history still blocks a later target and adjusted ledgers fail closed', () => {
  const storage = disk(), fold = { max: 90, keep: 60, ageMs: 0 }, first = fixture({ storage, fold });
  first.game.present(item('previously-shown'));
  const f = fixture({ storage, fold });
  for (let i = 0; i < 60; i++) f.play(`history-${i}`, { correct: true });
  assert.ok(stored(f).ledger.presented.some(row => row[1] === 'previously-shown'));
  const a = f.play('source'), b = f.play('previously-shown', { correct: true });
  assert.equal(pair(f, a, b).reason, 'previously-presented');
  const c = f.play('second-source'), d = f.play('new-target', { correct: true });
  assert.equal(pair(f, c, d).status, 'independent-correct', 'unrelated folding does not block recent complete pairs');
  const value = stored(f); value.ledger.adjusted = 1;
  assert.equal(replace(f, value).recheck(c.answer.eventId, d.answer.eventId).reason, 'incomplete-history');
});

test('missing completion and an exclusion recorded beyond the current clock never become usable proof', () => {
  const f = fixture(), a = f.play('source'), b = f.play('target', { correct: true }), value = stored(f);
  const targetDecision = value.events.find(event => event.id === b.pid).decisionId;
  value.events = value.events.filter(event => !(event.type === 'experience.completed' && event.decisionId === targetDecision));
  assert.equal(replace(f, value).recheck(a.answer.eventId, b.answer.eventId).reason, 'missing-completion');
  const future = fixture(), c = future.play('source'), d = future.play('target', { correct: true });
  future.game.exclude(d.answer.eventId); const excluded = stored(future);
  const event = excluded.events.find(entry => entry.type === 'record.excluded');
  event.at = event.recordedAt = '2026-10-07T02:00:00.000Z';
  assert.equal(replace(future, excluded).recheck(c.answer.eventId, d.answer.eventId).reason, 'excluded-evidence');
});
