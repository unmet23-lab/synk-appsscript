'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createWorldLearningHost } = require('../account/world-learning-host');
const { createGame, createLearningSync } = require('../atlas/game-browser');
test('WORLD games share verified account scope and cannot overwrite host storage with guest options', async () => {
  const saved = new Map(); let ended = false, posted = [];
  const host = createWorldLearningHost({ accountKey: 'synthetic-world', revision: 1, guard() { if (ended) throw new Error('ended'); },
    storage: { getItem: k => saved.get(k) || null, setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) },
    transport: { get: async () => ({ ok: true, revision: 1, cursor: 0, hasMore: false, events: [] }), post: async ({ events }) => { posted.push(...events); return { ok: true, revision: 1, accepted: events.map(e => e.id) }; } } });
  const one = host.createGame({ gameId: 'racing', storage: { getItem() { throw new Error('guest must never be opened'); } } }, createGame, createLearningSync);
  const two = host.createGame({ gameId: 'rhythm' }, createGame, createLearningSync);
  await host.retry();
  one.present({ id: 'sample', itemKey: 'sample', familyKey: 'sample', skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice', audioRequired: false, confounded: false });
  await host.retry();
  assert.ok(two.events().some(e => e.type === 'practice.presented'));
  assert.ok(posted.some(e => e.type === 'practice.presented'));
  assert.equal('syncPort' in one, false);
  ended = true;
  assert.throws(() => one.events(), /ended/);
  host.stop();
});
test('a signed-in WORLD with sharing off keeps its own local scope and never initializes transport', () => {
  const saved = new Map();
  const host = createWorldLearningHost({ accountKey: 'local:synthetic', revision: 1, connected: false, guard() {},
    storage: { getItem: k => saved.get(k) || null, setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) },
    transport: { get() { throw new Error('must not upload or pull'); }, post() { throw new Error('must not upload or pull'); } } });
  const game = host.createGame({ gameId: 'racing' }, createGame, () => { throw new Error('must not initialize sync'); });
  game.present({ id: 'local', itemKey: 'local', familyKey: 'local', skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice', audioRequired: false, confounded: false });
  assert.ok(game.events().length); assert.equal(host.status().phase, 'local'); assert.equal(host.retry(), undefined);
  host.stop(); assert.throws(() => game.events(), /ended/);
});
