'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, KEY } = require('../atlas/game-learning');
const { createMemorySync } = require('../atlas/memory-sync');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const copy = value => JSON.parse(JSON.stringify(value));
const memory = () => { const values = new Map(); return { values, getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)) }; };
const at = '2026-08-01T00:00:00.000Z';

function foldedFixture() {
  let now = Date.parse(at);
  const storage = memory();
  const game = createGame({ gameId: 'input-boundary', map, storage, storageScope: 'account', accountKey: 'account.boundary',
    historyComplete: true, clock: () => new Date(now += 1000).toISOString(), fold: { remote: true, max: 30, keep: 12, ageMs: 0 } });
  for (let i = 0; i < 20; i++) game.answer(game.present({ id: `item${i}`, itemKey: `item${i}`, skillId: 'ko.reading.detail',
    modality: 'reading', difficulty: 1, responseFormat: 'single-choice' }), { correct: true, assessable: true });
  const complete = game.events();
  assert.equal(game.syncPort.settle(complete.map(event => event.id)), true);
  const kept = new Set(game.events().map(event => event.id));
  const ledger = JSON.parse(storage.getItem(`${KEY}.device`)).ledger;
  const retained = new Set(Object.values(ledger?.cells || {}).flatMap(cell => cell.ind.map(row => row[0])));
  const attempt = complete.find(event => event.type === 'practice.attempted' && !kept.has(event.id) && retained.has(event.id));
  assert.ok(attempt, 'the real account log folded a settled answer');
  assert.ok(JSON.parse(storage.getItem(`${KEY}.device`)).ledger?.folded > 0);
  return { game, storage, attempt };
}

test('malformed or foreign-scope folded-parent imports reject the batch without changing the log or ledger', () => {
  const original = foldedFixture();
  const snapshot = [...original.storage.values];
  const mutations = [
    ['schema', event => ({ ...event, schema: 2 })],
    ['time', event => ({ ...event, at: 'invalid' })],
    ['attempt', event => ({ ...event, attemptNo: 0 })],
    ['scope', event => ({ ...event, scope: { ...event.scope, subject: 'other' } })],
    ['exclusion-schema', event => ({ ...event, type: 'record.excluded', targetId: original.attempt.id, schema: 2 })],
    ['exclusion-scope', event => ({ ...event, type: 'record.excluded', targetId: original.attempt.id, scope: { ...event.scope, workspace: 'other' } })],
  ];
  for (const [name, mutate] of mutations) {
    const storage = memory(); for (const [key, value] of snapshot) storage.setItem(key, value);
    const game = createGame({ gameId: 'input-boundary', map, storage, storageScope: 'account', accountKey: 'account.boundary',
      clock: () => '2026-08-01T01:00:00.000Z', fold: { remote: true, max: 30, keep: 12, ageMs: 0 } });
    const before = [...storage.values], events = game.events();
    const valid = { ...copy(original.attempt), id: `valid.${name}` };
    assert.throws(() => game.syncPort.importEvents([valid, mutate({ ...copy(original.attempt), id: `invalid.${name}` })]), undefined, name);
    assert.deepEqual(game.events(), events, `${name}: no partial import`);
    assert.deepEqual([...storage.values], before, `${name}: ledger and persisted bytes preserved`);
  }
});

test('valid entries for folded parents still skip and valid exclusions still remove folded evidence', () => {
  const { game, storage, attempt } = foldedFixture();
  const valid = { ...copy(attempt), id: 'valid.stray' };
  assert.deepEqual(game.syncPort.importEvents([valid]), { added: 0, skipped: ['valid.stray'] });
  const contains = () => Object.values(JSON.parse(storage.getItem(`${KEY}.device`)).ledger.cells).some(cell => cell.ind.some(row => row[0] === attempt.id));
  assert.equal(contains(), true);
  const excluded = { schema: 1, type: 'record.excluded', id: 'valid.exclude', targetId: attempt.id,
    scope: copy(attempt.scope), at: attempt.at, recordedAt: attempt.recordedAt };
  assert.deepEqual(game.syncPort.importEvents([excluded]), { added: 0, skipped: ['valid.exclude'] });
  assert.equal(contains(), false);
});

test('a same-time changed transport value remains an explicit conflict instead of a false synced state', async () => {
  const storage = memory(), game = createGame({ gameId: 'memory-boundary', map, storage, storageScope: 'account', accountKey: 'account.boundary',
    clock: () => at });
  let row = { kind: 'presentation', key: 'chosen', value: { support: 'step' }, at };
  const transport = { get: async () => ({ revision: 1, entries: [copy(row)] }), post: async () => ({ revision: 1, entries: [copy(row)] }) };
  const sync = createMemorySync({ adapter: game, accountKey: 'account.boundary', revision: 1, transport });
  assert.equal((await sync.start()).phase, 'synced');
  // A direct transport can return a different value at the same timestamp. The supported server's
  // strict-newer write API does not produce this replacement; this exercises the response boundary.
  row = { ...row, value: { support: 'compact' } };
  const result = await sync.retry();
  assert.deepEqual([result.phase, result.code, result.queued], ['conflict', 'MEMORY_CONFLICT', 1]);
  assert.deepEqual(game.presentation(), { support: 'step' }, 'the local choice is preserved');
  assert.deepEqual([sync.status().phase, sync.status().queued], ['conflict', 1]);
  sync.stop();
});
