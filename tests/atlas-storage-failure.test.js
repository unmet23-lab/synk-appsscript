'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, createLearningSync, KEY } = require('../atlas/game-learning');
const { SYNC_KEY } = require('../atlas/learning-sync');
const { createWorldLearningHost } = require('../account/world-learning-host');
const Atlas = require('../atlas/engine');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const accountKey = 'synthetic-storage-account';
const eventKey = `${KEY}.device`;
function disk() {
  const values = new Map(); let failEvents = false;
  return { values, fail() { failEvents = true; },
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { if (failEvents && key === eventKey) throw new Error('Synthetic event file quota exceeded'); values.set(key, value); },
    removeItem: key => values.delete(key) };
}
function transport() {
  return { calls: 0, posts: 0,
    async get() { this.calls++; return { ok: true, revision: 1, events: [], cursor: 0, hasMore: false }; },
    async post({ events }) { this.posts++; return { ok: true, revision: 1, accepted: events.map(event => event.id) }; } };
}
function client(storage = disk(), remote = transport()) {
  const adapter = createGame({ gameId: 'synthetic-reading', map, storage, storageScope: 'account', accountKey, historyComplete: false });
  const sync = createLearningSync({ adapter, storage, transport: remote, accountKey, revision: 1, auto: false, maxAttempts: 1 });
  return { adapter, sync, storage, remote };
}
function present(game) {
  return game.present({ id: 'synthetic-item', itemKey: 'synthetic-item', familyKey: 'synthetic-family', skillId: 'ko.reading.detail',
    difficulty: 1, modality: 'reading', responseFormat: 'single-choice', audioRequired: false, confounded: false });
}
function blocked(sync, expectedCode = 'STORAGE_ERROR') {
  assert.equal(sync.status().phase, 'blocked');
  assert.equal(sync.status().code, expectedCode);
  assert.equal(sync.status().durable, false);
  assert.equal(sync.status().complete, false);
}

test('a failed original-event save invalidates an already synced account even when outbox metadata remains writable', async t => {
  const c = client(); t.after(() => c.sync.stop());
  await c.sync.start(); assert.equal(c.sync.status().phase, 'synced');
  const original = c.storage.getItem(eventKey);
  c.storage.fail(); const presentation = present(c.adapter);
  blocked(c.sync); assert.equal(c.adapter.summary().storage.available, false);
  assert.equal(c.storage.getItem(eventKey), original, 'The previous durable event log is preserved');
  const answer = c.adapter.answer(presentation, { correct: true, assessable: true });
  assert.equal(answer.independent, false);
  const calls = c.remote.calls; await c.sync.retry(); blocked(c.sync); assert.equal(c.remote.calls, calls);
});

test('late successful GET cannot restore synced status after an event save fails during that GET', async t => {
  let resolveGet, requestSignal, entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const remote = transport();
  remote.get = ({ signal }) => { requestSignal = signal; entered(); return new Promise(resolve => { resolveGet = resolve; }); };
  const c = client(disk(), remote); t.after(() => c.sync.stop());
  const pending = c.sync.start(); await ready;
  c.storage.fail(); present(c.adapter); blocked(c.sync);
  assert.equal(requestSignal.aborted, true);
  // A transport may ignore AbortSignal. Its late valid response is still stale.
  resolveGet({ ok: true, revision: 1, events: [], cursor: 0, hasMore: false });
  await pending; await new Promise(resolve => setImmediate(resolve));
  blocked(c.sync); assert.equal(remote.posts, 0);
});

test('a WORLD child game original-event failure blocks its primary account synchronizer and all siblings lose completeness', async t => {
  const storage = disk(), remote = transport();
  const host = createWorldLearningHost({ accountKey, revision: 1, storage, transport: remote, guard() {} });
  t.after(() => host.stop());
  const factory = options => createGame({ ...options, map });
  const one = host.createGame({ gameId: 'synthetic-racing' }, factory, createLearningSync);
  const two = host.createGame({ gameId: 'synthetic-rhythm' }, factory, createLearningSync);
  await host.retry(); assert.equal(host.status().phase, 'synced');
  storage.fail(); present(one); blocked(host);
  assert.equal(one.summary().storage.available, false);
  const second = present(two), answer = two.answer(second, { correct: true, assessable: true });
  assert.equal(answer.independent, false);
  const posts = remote.posts; await host.retry(); blocked(host); assert.equal(remote.posts, posts);
});

test('an original-event store already unwritable at construction never starts network synchronization', async t => {
  const storage = disk(); storage.fail(); const c = client(storage); t.after(() => c.sync.stop());
  assert.throws(() => c.adapter.syncPort.events(), { code: 'STORAGE_ERROR' });
  assert.throws(() => c.adapter.syncPort.ids(), { code: 'STORAGE_ERROR' });
  await c.sync.start(); blocked(c.sync); assert.equal(c.remote.calls, 0); assert.equal(c.remote.posts, 0);
});

test('a conflicting event written by another instance invalidates the sync status before the next network retry', async t => {
  const storage = disk();
  const seed = Atlas.createSession({ scope: { domain: 'LAB', workspace: 'learning', subject: 'device' } });
  seed.set('goal', 'study');
  storage.setItem(eventKey, JSON.stringify({ version: 1, epoch: 'synthetic-conflict', owner: accountKey, events: seed.events() }));
  const c = client(storage); t.after(() => c.sync.stop()); await c.sync.start();
  assert.equal(c.sync.status().phase, 'synced');
  const changed = JSON.parse(storage.getItem(eventKey)); changed.events[0].value = 'work';
  const tampered = JSON.stringify(changed); storage.setItem(eventKey, tampered);
  assert.throws(() => c.adapter.summary(), /conflicting stored event/);
  blocked(c.sync); assert.equal(storage.getItem(eventKey), tampered, 'Do not silently overwrite a conflicting record');
});

function capacityEvents() {
  const session = Atlas.createSession({ scope: { domain: 'LAB', workspace: 'learning', subject: 'device' }, clock: () => '2026-10-02T00:00:00.000Z' });
  session.set('goal', 'study'); const prototype = session.events()[0];
  return Array.from({ length: 20000 }, (_, i) => ({ ...prototype, id: `synthetic-capacity-${i}` }));
}

// An account log past the former 20,000-event limit moves to durable pages (learning-pages.js).
test('an account history past 20,000 events stays durable in pages, and a failed page publication cannot leave synced status', async t => {
  const storage = disk(), events = capacityEvents();
  storage.setItem(eventKey, JSON.stringify({ version: 1, epoch: 'synthetic-capacity', owner: accountKey, events }));
  storage.setItem(`${SYNC_KEY}.${accountKey}`, JSON.stringify({ version: 1, accountKey, revision: 1, cursor: 0, complete: true,
    acknowledged: events.map(event => event.id), pending: [] }));
  const c = client(storage); t.after(() => c.sync.stop());
  await c.sync.start(); assert.equal(c.sync.status().phase, 'synced');
  present(c.adapter);
  assert.equal(c.sync.status().phase, 'synced'); assert.equal(c.sync.status().durable, true);
  const published = storage.getItem(eventKey);
  assert.equal(JSON.parse(published).paged, 1);
  const durable = createGame({ gameId: 'synthetic-reading', map, storage, storageScope: 'account', accountKey, historyComplete: false }).syncPort.events();
  assert.deepEqual(durable.slice(0, events.length), events, 'Every earlier record is durable');
  assert.ok(durable.slice(events.length).some(event => event.type === 'practice.presented'), 'The new observation is durable too');
  assert.equal(storage.getItem(eventKey), published, 'Reading the pages writes nothing');
  const pageKeys = () => [...storage.values.keys()].filter(key => key.startsWith(`${eventKey}.page.`)).sort(), pagesBefore = pageKeys();
  storage.fail(); present(c.adapter); blocked(c.sync);
  assert.equal(c.adapter.summary().storage.available, false);
  assert.equal(storage.getItem(eventKey), published, 'A failed publication preserves the previous durable root');
  assert.deepEqual(pageKeys(), pagesBefore, 'Pages written for the failed publication are reclaimed');
  assert.equal(c.remote.posts, 0);
});

test('a guest device history still stops at 20,000 events without overwriting earlier records', () => {
  const storage = disk(), original = JSON.stringify({ version: 1, epoch: 'synthetic-capacity', events: capacityEvents() });
  storage.setItem(eventKey, original);
  const game = createGame({ gameId: 'synthetic-reading', map, storage });
  present(game);
  assert.equal(game.summary().storage.available, false);
  assert.equal(storage.getItem(eventKey), original, 'Reaching capacity preserves all previous durable records');
});
