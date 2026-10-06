'use strict';
// Synthetic machine IDs and in-memory stores/transports only; no provider or account calls.
const test = require('node:test'), assert = require('node:assert/strict');
const Game = require('../atlas/game-learning'), Atlas = require('../atlas/engine');
const Core = require('../atlas/education'), Trail = require('../atlas/trail');
const { createWorldLearningHost } = require('../account/world-learning-host');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const copy = value => JSON.parse(JSON.stringify(value));
const disk = () => { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }; };
const item = id => ({ id, itemKey: id, familyKey: id, skillId: 'ko.reading.detail', difficulty: 1,
  responseFormat: 'single-choice', modality: 'reading', audioRequired: false, confounded: false });
const choice = { selectedId: 'option-2', correctId: 'option-1' };
function game(extra = {}) {
  let now = Date.parse('2026-10-07T01:00:00Z');
  return Game.createGame({ gameId: 'choice-audit', map, storage: disk(), fold: false,
    clock: () => new Date(now += 1000).toISOString(), ...extra });
}
const attempts = g => g.events().filter(e => e.type === 'practice.attempted');
const cell = g => g.summary().skills.find(s => s.id === 'ko.reading.detail').levels[1].formats['single-choice'];

test('Core choice metadata reaches the event and Trail without changing the authored assessment', () => {
  let sequence = 0, time = Date.parse('2026-10-07T01:00:00Z');
  const scope = { domain: 'LAB', workspace: 'choice', subject: 'synthetic' };
  const session = Atlas.createSession({ scope, clock: () => new Date(time += 1000).toISOString(), id: () => `choice-${++sequence}` });
  const decision = session.plan('choice-audit', [{ id: 'one', minutes: 1, pace: 'standard' }]);
  const practice = Core.createPractice({ session, decision, map, firstExposure: true,
    task: { id: 'question-one', version: 'authored-v1', itemKey: 'question-one', tags: [], concepts: ['ko.reading.detail'] },
    assess: () => ({ verdict: 'incorrect', errorTags: [] }) });
  const supplied = { selectedId: 'same-id', correctId: 'same-id' };
  const result = practice.submit('ignored-by-host-grader', { choice: supplied });
  supplied.selectedId = 'mutated'; result.choice.correctId = 'mutated';
  const event = session.events().find(e => e.type === 'practice.attempted');
  assert.deepEqual(event.choice, { selectedId: 'same-id', correctId: 'same-id' });
  assert.equal(event.verdict, 'incorrect'); assert.equal(result.diagnosis, 'not-diagnosed');
  const summary = Trail.summarize(session.events(), { scope, asOf: new Date(time + 1000).toISOString() });
  const index = Trail.createIndex({ scope }); session.events().forEach(e => index.add(e));
  assert.deepEqual(summary.attempts[0].choice, event.choice);
  assert.deepEqual(index.attempt(event.id).choice, event.choice);
  assert.equal(summary.attempts[0].taskVersion, 'authored-v1');
  assert.equal(summary.attempts[0].independent, true);
  summary.attempts[0].choice.selectedId = 'outside-copy';
  assert.equal(index.attempt(event.id).choice.selectedId, 'same-id');
});

test('choice is optional and rejects text, identifiers outside bounds and extra metadata atomically', () => {
  const g = game(), pid = g.present(item('bounded'));
  const invalid = [null, undefined, [], {}, { selectedId: 'x' }, { ...choice, text: 'answer text' },
    { selectedId: '답', correctId: 'x' }, { selectedId: 'a b', correctId: 'x' },
    { selectedId: 'person@example.com', correctId: 'x' }, { selectedId: 'x'.repeat(81), correctId: 'x' },
    { selectedId: 'constructor', correctId: 'x' }, { selectedId: 1, correctId: 'x' }];
  for (const value of invalid) assert.throws(() => g.answer(pid, { correct: false, assessable: true, choice: value }), /choice IDs/);
  assert.equal(attempts(g).length, 0);
  const result = g.answer(pid, { correct: false, assessable: true });
  assert.ok(!Object.hasOwn(result, 'choice')); assert.ok(!Object.hasOwn(attempts(g)[0], 'choice'));
  const event = attempts(g)[0];
  for (const value of invalid) assert.throws(() => Trail.validate({ ...event, choice: value }), /choice IDs/);
});

test('wrong, hint and retry keep distinct choices without rehabilitating the first independent error', () => {
  const g = game(), pid = g.present(item('retry'));
  const first = g.answer(pid, { correct: false, assessable: true, choice });
  g.help(pid, 'hint');
  const second = g.answer(pid, { correct: true, assessable: true, attemptNo: 2, choice: { selectedId: 'option-1', correctId: 'option-1' } });
  assert.equal(first.independent, true); assert.equal(second.independent, false); assert.equal(second.assisted, true);
  assert.equal(second.exposure, 'repeat'); assert.equal(cell(g).incorrect, 1); assert.equal(cell(g).correct, 0);
  assert.deepEqual(attempts(g).map(e => e.choice.selectedId), ['option-2', 'option-1']);
  first.choice.selectedId = 'mutated'; second.choice.selectedId = 'mutated';
  const duplicate = g.answer(pid, { correct: false, assessable: true, attemptNo: 2, choice });
  assert.equal(duplicate.verdict, 'correct'); assert.equal(duplicate.choice.selectedId, 'option-1');
  duplicate.choice.selectedId = 'mutated-again';
  assert.equal(g.answer(pid, { correct: true, assessable: true, attemptNo: 2 }).choice.selectedId, 'option-1');
  assert.equal(attempts(g).length, 2);
});

test('choice records survive local reopen and never alter unassessed delivery qualification', () => {
  const storage = disk(), g = game({ storage }), pid = g.present({ ...item('not-heard'), skillId: 'ko.listening.detail', modality: 'listening', audioRequired: true });
  const result = g.answer(pid, { correct: true, assessable: true, choice });
  assert.equal(result.verdict, 'unassessed'); assert.equal(result.reason, 'audio'); assert.equal(result.independent, false);
  const reopened = game({ storage }); assert.deepEqual(attempts(reopened)[0].choice, choice);
  assert.equal(reopened.summary().independent, 0);
});

test('display exposure includes unanswered presentations while preserving partial-history uncertainty', () => {
  const g = game(), a = item('known'); const before = g.events().length;
  assert.deepEqual(g.exposure(a), { seen: false }); assert.equal(g.events().length, before);
  const pid = g.present(a); assert.deepEqual(g.exposure(a), { seen: true });
  g.help(pid, 'answer'); assert.deepEqual(g.exposure(a), { seen: true });
  assert.deepEqual(g.exposure({ itemKey: 'different', familyKey: 'known' }), { seen: true });
  assert.throws(() => g.exposure({ itemKey: 'bad text' }), /exposure item/);
  const partial = game({ historyComplete: false }); assert.deepEqual(partial.exposure(item('unknown')), { seen: null });
  partial.answer(partial.present(item('unknown')), { correct: false, assessable: true, choice });
  assert.deepEqual(partial.exposure(item('unknown')), { seen: true });
  assert.deepEqual(partial.exposure(item('still-unknown')), { seen: null });
  const failed = game({ storage: { getItem: () => null, setItem() { throw Error('quota'); } } });
  assert.deepEqual(failed.exposure(item('not-known')), { seen: null });
});

test('folding preserves exposure and learning counts while recent choice events remain available', () => {
  const storage = disk(), g = game({ storage, fold: { max: 90, keep: 60, ageMs: 0 } });
  let first;
  for (let i = 0; i < 60; i++) {
    const r = g.answer(g.present(item(`fold-${i}`)), { correct: i % 2 === 0, assessable: true, choice });
    if (!i) first = r.eventId;
  }
  const stored = JSON.parse(storage.getItem(`${Game.KEY}.device`));
  assert.ok(stored.ledger.folded > 0); assert.ok(!attempts(g).some(e => e.id === first));
  assert.deepEqual(g.exposure(item('fold-0')), { seen: true });
  assert.deepEqual(attempts(g).at(-1).choice, choice); assert.equal(cell(g).n, 12);
  assert.ok(!JSON.stringify(stored.ledger).includes('selectedId'), 'folded aggregates intentionally have no choice details');
  const reopened = game({ storage, fold: { max: 90, keep: 60, ageMs: 0 } });
  assert.deepEqual(reopened.exposure(item('fold-0')), { seen: true });
  assert.deepEqual(attempts(reopened).at(-1).choice, choice);
});

function remote() {
  const events = [];
  return { events, get: async ({ after = 0 }) => ({ ok: true, revision: 1, cursor: events.length, hasMore: false, events: copy(events.slice(after)) }),
    post: async ({ events: batch }) => {
      const next = copy(events);
      for (const e of batch) { const prior = next.find(p => p.id === e.id); if (prior) assert.deepEqual(prior, e); else next.push(copy(e)); }
      if (next.length) Atlas.createSession({ scope: next[0].scope, events: next });
      events.splice(0, events.length, ...next); return { ok: true, revision: 1, accepted: batch.map(e => e.id) };
    } };
}
test('account sync transports exact choice IDs and a second device preserves evidence and exposure', async () => {
  const server = remote();
  const client = () => { const storage = disk(), adapter = game({ storage, storageScope: 'account', accountKey: 'choice-account', historyComplete: false });
    const sync = Game.createLearningSync({ adapter, storage, accountKey: 'choice-account', revision: 1, transport: server, auto: false }); return { adapter, sync }; };
  const a = client(); await a.sync.start();
  a.adapter.answer(a.adapter.present(item('synced')), { correct: false, assessable: true, choice });
  await a.sync.flush(); const b = client(); await b.sync.start();
  assert.deepEqual(attempts(b.adapter), attempts(a.adapter)); assert.deepEqual(attempts(b.adapter)[0].choice, choice);
  assert.deepEqual(b.adapter.exposure(item('synced')), { seen: true }); assert.equal(cell(b.adapter).incorrect, 1);
  a.sync.stop(); b.sync.stop();
});

test('WORLD guards the new read method, transports choice metadata and closes access with its run', async () => {
  const server = remote(), storage = disk();
  const host = createWorldLearningHost({ accountKey: 'world-choice', revision: 1, guard() {}, storage, transport: server });
  host.beginRun({ id: 'run-choice', gameId: 'entry-check' });
  const coach = host.createGame({ gameId: 'entry-check' }, config => Game.createGame({ ...config, map }), Game.createLearningSync);
  await host.retry(); const before = coach.events().length;
  assert.deepEqual(coach.exposure(item('world-choice')), { seen: false }); assert.equal(coach.events().length, before);
  coach.answer(coach.present(item('world-choice')), { correct: false, assessable: true, choice });
  await host.retry(); assert.deepEqual(server.events.find(e => e.type === 'practice.attempted').choice, choice);
  assert.equal('syncPort' in coach, false); assert.equal('memoryPort' in coach, false);
  host.closeRun(); assert.throws(() => coach.exposure(item('world-choice')), /run ended/); host.stop();
});
