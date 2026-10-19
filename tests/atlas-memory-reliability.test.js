'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMap } = require('../strata');
const { createGame } = require('../atlas/game-learning');
const { createMemorySync } = require('../atlas/memory-sync');
const map = createMap(require('../strata/maps/topik-i.json'));
const NOW = '2026-10-18T09:00:00.000Z';
const disk = () => {
  const values = new Map();
  return { values, fail: false, getItem(k) { return values.get(k) ?? null; },
    setItem(k, v) { if (this.fail) throw new Error('quota'); values.set(k, String(v)); }, removeItem(k) { values.delete(k); } };
};
const key = e => `${e.kind}|${e.key}`;
function server({ legacy = false } = {}) {
  const rows = new Map(), posts = [];
  const response = entries => ({ revision: 1, entries: structuredClone(entries), ...(!legacy && { serverTime: NOW }) });
  return { rows, posts,
    async get() { return response([...rows.values()]); },
    async post({ entries }) {
      posts.push(structuredClone(entries));
      for (const e of entries) if (!rows.has(key(e)) || Date.parse(e.at) > Date.parse(rows.get(key(e)).at)) rows.set(key(e), structuredClone(e));
      return response(entries.map(e => rows.get(key(e))));
    },
  };
}
function client(transport, { storage = disk(), at = NOW } = {}) {
  let time = at;
  const game = createGame({ gameId: 'reliability', map, storage, storageScope: 'account', accountKey: 'acct', clock: () => time });
  const sync = createMemorySync({ adapter: game, accountKey: 'acct', revision: 1, transport, setTimer: () => 1, clearTimer() {} });
  return { game, sync, storage, time(value) { time = value; } };
}
const chosen = cloud => cloud.rows.get('presentation|chosen');
async function waitFor(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.fail('expected pending request did not arrive');
}

test('a choice made after reading another device survives skew, equal time and a backwards clock', async () => {
  for (const at of ['2026-10-18T08:55:00.000Z', NOW]) {
    const cloud = server(), a = client(cloud), b = client(cloud, { at });
    a.game.setPresentation({ motion: 'full' }); await a.sync.start(); await b.sync.start();
    b.game.setPresentation({ motion: 'reduced' }); await b.sync.flush();
    assert.deepEqual(chosen(cloud).value, { motion: 'reduced' });
    b.time('2026-10-18T07:00:00.000Z'); b.game.setPresentation({ motion: 'full' }); await b.sync.flush();
    assert.deepEqual(chosen(cloud).value, { motion: 'full' });
    a.sync.stop(); b.sync.stop();
  }
});

test('pending offline intent survives restart and a newer server value in the initial GET', async () => {
  const cloud = server(), c = client(cloud, { at: '2026-10-18T07:00:00.000Z' });
  c.game.setPresentation({ motion: 'reduced' }); c.sync.stop();
  cloud.rows.set('presentation|chosen', { kind: 'presentation', key: 'chosen', value: { motion: 'full' }, at: NOW });
  const next = client(cloud, { storage: c.storage, at: '2026-10-18T07:00:00.000Z' });
  await next.sync.start();
  assert.deepEqual(chosen(cloud).value, { motion: 'reduced' }); next.sync.stop();
});

test('a failed local merge is never reported as synced and can recover after quota is available', async () => {
  const cloud = server(), c = client(cloud);
  cloud.rows.set('presentation|chosen', { kind: 'presentation', key: 'chosen', value: { motion: 'reduced' }, at: NOW });
  c.storage.fail = true;
  assert.equal((await c.sync.start()).code, 'STORAGE_ERROR');
  assert.notEqual(c.sync.status().phase, 'synced');
  c.storage.fail = false; await c.sync.retry();
  assert.deepEqual(c.game.presentation(), { motion: 'reduced' }); c.sync.stop();
});

test('old server and unmarked local storage keep the old LWW contract', async () => {
  const cloud = server({ legacy: true }), c = client(cloud);
  c.storage.setItem('synk.atlas.learning.v1.device.presentation', JSON.stringify({ v: 1, presentation: { motion: 'reduced' }, at: NOW }));
  await c.sync.start(); assert.deepEqual(chosen(cloud).value, { motion: 'reduced' });
  c.time('2026-10-18T07:00:00.000Z'); c.game.setPresentation({ motion: 'full' }); await c.sync.flush();
  assert.deepEqual(chosen(cloud).value, { motion: 'full' }); c.sync.stop();
});

test('a delayed acknowledgement cannot erase a newer local intent', async () => {
  const cloud = server(); let finish;
  const transport = { get: () => cloud.get(), post: args => new Promise(resolve => { finish = async () => resolve(await cloud.post(args)); }) };
  const c = client(transport); await c.sync.start(); c.game.setPresentation({ motion: 'full' });
  const first = c.sync.flush(); await waitFor(() => finish);
  c.game.setPresentation({ motion: 'reduced' }); const old = finish; finish = null; await old();
  await waitFor(() => finish); await finish(); await first;
  assert.deepEqual(chosen(cloud).value, { motion: 'reduced' }); assert.equal(c.sync.status().queued, 0); c.sync.stop();
});

test('a lost ACK keeps its assigned timestamp across restart and yields to a later remote write', async () => {
  const cloud = server(); let lose = true;
  const transport = { get: () => cloud.get(), post: async args => { const result = await cloud.post(args); if (lose) { lose = false; throw new Error('lost ACK'); } return result; } };
  const c = client(transport); c.game.setPresentation({ motion: 'reduced' }); await c.sync.start();
  const sentAt = cloud.posts[0][0].at; c.sync.stop();
  cloud.rows.set('presentation|chosen', { ...chosen(cloud), value: { motion: 'full' }, at: new Date(Date.parse(sentAt) + 100).toISOString() });
  const next = client(transport, { storage: c.storage }); await next.sync.start();
  assert.equal(cloud.posts.at(-1)[0].at, sentAt);
  assert.deepEqual(chosen(cloud).value, { motion: 'full' }); assert.deepEqual(next.game.presentation(), { motion: 'full' });
  assert.equal(next.sync.status().queued, 0); next.sync.stop();
});

test('an equal timestamp with different server content preserves intent and exposes a conflict', async () => {
  const cloud = server(), transport = { get: () => cloud.get(), post: async ({ entries }) => ({ revision: 1, entries: entries.map(e => ({ ...e, value: { motion: 'full' } })) }) };
  const c = client(transport); c.game.setPresentation({ motion: 'reduced' });
  const state = await c.sync.start();
  assert.equal(state.code, 'MEMORY_CONFLICT'); assert.notEqual(state.phase, 'synced'); assert.equal(state.queued, 1);
  assert.deepEqual(c.game.presentation(), { motion: 'reduced' }); c.sync.stop();
});

test('an omitted server acknowledgement preserves the pending choice', async () => {
  const cloud = server(), c = client({ get: () => cloud.get(), post: async () => ({ revision: 1, entries: [] }) });
  c.game.setPresentation({ motion: 'reduced' }); const state = await c.sync.start();
  assert.equal(state.code, 'INVALID_RESPONSE'); assert.equal(state.queued, 1); c.sync.stop();
});

test('the server clock assigns first-write order even when the device is years ahead', async () => {
  const cloud = server(), c = client(cloud, { at: '2030-01-01T00:00:00.000Z' });
  c.game.setPresentation({ motion: 'reduced' }); await c.sync.start();
  assert.equal(chosen(cloud).at, NOW); assert.deepEqual(c.game.presentation(), { motion: 'reduced' }); c.sync.stop();
});

test('an existing server timestamp beyond the permitted next-write window preserves an unassigned intent', async () => {
  const cloud = server(), c = client(cloud);
  cloud.rows.set('presentation|chosen', { kind: 'presentation', key: 'chosen', value: null, at: new Date(Date.parse(NOW) + 86400000).toISOString() });
  c.game.setPresentation({ motion: 'reduced' }); const state = await c.sync.start();
  assert.equal(state.code, 'MEMORY_CLOCK_AHEAD'); assert.equal(state.queued, 1); assert.equal(cloud.posts.length, 0);
  assert.equal(c.game.memoryPort.pending()[0].assignedAt, null); c.sync.stop();
});

test('preparing an upload must be durable before POST and acknowledgement storage can retry without retiming', async () => {
  const cloud = server(), c = client(cloud);
  await c.sync.start(); c.game.setPresentation({ motion: 'reduced' }); c.storage.fail = true;
  assert.equal((await c.sync.flush()).code, 'STORAGE_ERROR'); assert.equal(cloud.posts.length, 0);
  c.storage.fail = false;
  const post = cloud.post; let failAck = true;
  cloud.post = async args => { const response = await post(args); if (failAck) { failAck = false; c.storage.fail = true; } return response; };
  assert.equal((await c.sync.retry()).code, 'STORAGE_ERROR');
  const sentAt = cloud.posts[0][0].at;
  c.storage.fail = false; assert.equal((await c.sync.retry()).phase, 'synced');
  assert.equal(cloud.posts[1][0].at, sentAt); assert.equal(c.game.memoryPort.pending().length, 0); c.sync.stop();
});

test('flow memory and declined offers use the same durable ordering while keeping flow inner time equal', async () => {
  const cloud = server(), c = client(cloud, { at: '2026-10-18T07:00:00.000Z' });
  const flow = c.game.memoryPort.flow;
  flow.save('cafe', { v: 2, content: 'cafe', at: '2026-10-18T07:00:00.000Z', marker: 1 });
  flow.decline('cafe', '2026-10-18T07:00:00.000Z'); await c.sync.start();
  flow.save('cafe', { v: 2, content: 'cafe', at: '2026-10-18T07:00:00.000Z', marker: 2 }); await c.sync.flush();
  const row = cloud.rows.get('flow|cafe'); assert.equal(row.value.marker, 2); assert.equal(row.value.at, row.at);
  assert.equal(cloud.rows.get('declined|cafe').at, NOW); assert.equal(c.game.memoryPort.pending().length, 0); c.sync.stop();
});

test('an adapter from before durable intents still uses the existing wire shape', async () => {
  const cloud = server(); let state = { presentation: { value: { motion: 'reduced' }, at: NOW }, flow: {}, declined: {} };
  const memoryPort = { scope: 'account', accountKey: 'acct', state: () => structuredClone(state),
    merge: value => { if (value.presentation) state = value; }, subscribe: () => () => {} };
  const sync = createMemorySync({ adapter: { memoryPort }, accountKey: 'acct', revision: 1, transport: cloud });
  assert.equal((await sync.start()).phase, 'synced'); assert.deepEqual(Object.keys(cloud.posts[0][0]).sort(), ['at', 'key', 'kind', 'value']); sync.stop();
});

test('changing the local epoch fences a delayed response before it can restore old memory', async () => {
  let finish;
  const c = client({ get: () => new Promise(resolve => { finish = resolve; }), post: async () => assert.fail('old epoch posted') });
  const running = c.sync.start(); await waitFor(() => finish);
  const key = 'synk.atlas.learning.v1.device', record = JSON.parse(c.storage.getItem(key));
  record.epoch = 'new-epoch'; c.storage.setItem(key, JSON.stringify(record));
  finish({ revision: 1, entries: [{ kind: 'presentation', key: 'chosen', at: NOW, value: { motion: 'reduced' } }] });
  assert.equal((await running).code, 'MEMORY_SESSION_ENDED'); assert.equal(c.game.presentation(), null); c.sync.stop();
});

test('a transient FLOW read failure cannot replace other content or its pending intent', async () => {
  const cloud = server(), c = client(cloud), flow = c.game.memoryPort.flow;
  flow.save('first', { v: 2, content: 'first', at: NOW });
  const before = [...c.storage.values.entries()], get = c.storage.getItem; let failRead = true;
  c.storage.getItem = function (key) { if (failRead && key.endsWith('.flow')) { failRead = false; throw new Error('read unavailable'); } return get.call(this, key); };
  assert.equal(flow.save('second', { v: 2, content: 'second', at: NOW }), false);
  assert.deepEqual([...c.storage.values.entries()], before);
  assert.equal(c.sync.status().code, 'STORAGE_ERROR'); assert.equal(c.game.memoryPort.pending().length, 1); c.sync.stop();
});

test('failed flow writes report storage failure to their synchroniser', async () => {
  for (const kind of ['save', 'decline']) {
    const c = client(server()); await c.sync.start(); c.storage.fail = true;
    const flow = c.game.memoryPort.flow;
    const result = kind === 'save' ? flow.save('cafe', { v: 2, content: 'cafe', at: NOW }) : flow.decline('cafe', NOW);
    assert.equal(result, false); assert.equal(c.sync.status().code, 'STORAGE_ERROR'); assert.equal(c.sync.status().phase, 'offline'); c.sync.stop();
  }
});

test('an old successful request cannot conceal a failed newer user edit', async () => {
  const cloud = server(); let finish;
  const c = client({ get: () => cloud.get(), post: args => new Promise(resolve => { finish = async () => resolve(await cloud.post(args)); }) });
  c.game.setPresentation({ motion: 'full' }); const running = c.sync.start(); await waitFor(() => finish);
  c.storage.fail = true; assert.equal(c.game.setPresentation({ motion: 'reduced' }), false); c.storage.fail = false;
  await finish(); const state = await running;
  assert.equal(state.phase, 'offline'); assert.equal(state.code, 'STORAGE_ERROR'); assert.deepEqual(chosen(cloud).value, { motion: 'full' }); c.sync.stop();
});

test('another content autosave cannot clear a failed presentation edit', async () => {
  const c = client(server()); await c.sync.start();
  c.storage.fail = true; assert.equal(c.game.setPresentation({ motion: 'reduced' }), false); c.storage.fail = false;
  assert.equal(c.game.memoryPort.flow.save('cafe', { v: 2, content: 'cafe', at: NOW }), true);
  assert.equal((await c.sync.flush()).code, 'STORAGE_ERROR'); assert.equal(c.sync.status().phase, 'offline');
  assert.equal(c.game.setPresentation({ motion: 'reduced' }), true);
  assert.equal((await c.sync.flush()).phase, 'synced'); assert.equal(c.sync.status().code, null); c.sync.stop();
});

test('a second FLOW read failing during merge cannot erase a different pending content', () => {
  const c = client(server()), flow = c.game.memoryPort.flow;
  flow.save('first', { v: 2, content: 'first', at: NOW });
  const before = [...c.storage.values.entries()], get = c.storage.getItem; let reads = 0;
  c.storage.getItem = function (key) { if (key.endsWith('.flow') && ++reads === 2) throw new Error('second read unavailable'); return get.call(this, key); };
  assert.throws(() => c.game.memoryPort.merge({ flow: { second: { v: 2, content: 'second', at: NOW } } }), { code: 'STORAGE_ERROR' });
  assert.deepEqual([...c.storage.values.entries()], before); assert.equal(c.game.memoryPort.pending().length, 1); c.sync.stop();
});

test('a second PRESENT read failing during merge cannot replace a newer confirmed choice', () => {
  const c = client(server()), name = 'synk.atlas.learning.v1.device.presentation';
  c.storage.setItem(name, JSON.stringify({ v: 1, presentation: { motion: 'reduced' }, at: '2026-10-18T10:00:00.000Z' }));
  const before = c.storage.getItem(name), get = c.storage.getItem; let reads = 0;
  c.storage.getItem = function (key) { if (key === name && ++reads === 2) throw new Error('second read unavailable'); return get.call(this, key); };
  assert.throws(() => c.game.memoryPort.merge({ presentation: { value: { motion: 'full' }, at: NOW } }), { code: 'STORAGE_ERROR' });
  assert.equal(c.storage.getItem(name), before); c.sync.stop();
});
