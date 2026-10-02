'use strict';
// Account-path fixes from the 2026-10-02 engine review. Each case failed before its fix.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldLearningHost } = require('../account/world-learning-host');
const Browser = require('../atlas/game-browser');
const { createGame } = require('../atlas/game-learning');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };
const reading = i => ({ id: `q${i}`, itemKey: `item.${i}`, skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice' });

test('the account-wide adapter is built by the host page\'s own engine, not by the first game frame', () => {
  const made = [];
  const engine = { createGame: config => { made.push(['page', config.gameId]); return Browser.engine.createGame(config); },
    createLearningSync: options => { made.push(['page', 'sync']); return Browser.engine.createLearningSync({ ...options, auto: false }); } };
  const frame = config => { made.push(['frame', config.gameId]); return Browser.engine.createGame(config); };
  const frameSync = () => { throw new Error('a game frame must not own the account synchroniser'); };
  const host = createWorldLearningHost({ accountKey: 'synthetic-world', revision: 1, guard() {}, storage: memory(), engine,
    transport: { get: async () => ({ ok: true, revision: 1, cursor: 0, hasMore: false, events: [] }), post: async ({ events }) => ({ ok: true, revision: 1, accepted: events.map(e => e.id) }) } });
  host.createGame({ gameId: 'racing' }, frame, frameSync);
  host.createGame({ gameId: 'rhythm' }, frame, frameSync);
  assert.deepEqual(made, [['page', 'world-account'], ['page', 'sync'], ['frame', 'racing'], ['frame', 'rhythm']]);
  host.stop();
});

test('with sharing off, a signed-in device keeps usable evidence like a guest device', () => {
  const host = createWorldLearningHost({ accountKey: 'local:synthetic', revision: 1, connected: false, guard() {}, storage: memory(),
    transport: { get() { throw new Error('no transport'); }, post() { throw new Error('no transport'); } } });
  const game = host.createGame({ gameId: 'racing' }, Browser.engine.createGame, Browser.engine.createLearningSync);
  const results = [1, 2, 3, 4].map(i => game.answer(game.present(reading(i)), { correct: true, assessable: true }));
  assert.deepEqual(results.map(r => r.independent), [true, true, true, true]);
  assert.equal(game.summary().skills.find(s => s.id === 'ko.reading.detail').levels[1].formats['single-choice'].status, 'recent-independent');
  host.stop();
});

test('another device\'s clock running a year ahead does not pin this device\'s time', () => {
  const storage = memory();
  let mine = Date.parse('2026-10-02T00:00:00Z');
  const here = createGame({ gameId: 'here', map, storage, clock: () => new Date(mine += 1000).toISOString() });
  let ahead = Date.parse('2027-10-02T00:00:00Z');
  const there = createGame({ gameId: 'there', map, storage, clock: () => new Date(ahead += 1000).toISOString() });
  there.answer(there.present(reading(1)), { correct: true, assessable: true });
  const pid = here.present(reading(2));
  here.answer(pid, { correct: true, assessable: true });
  const own = here.events().filter(e => e.type === 'practice.attempted').find(e => e.presentationId === pid);
  assert.ok(own.at.startsWith('2026-10-02'), `this device keeps its own clock: ${own.at}`);
  assert.ok(Date.parse(here.summary().asOf) < Date.parse('2026-10-03T00:00:00Z'), 'policy windows run on this device\'s time');
});
