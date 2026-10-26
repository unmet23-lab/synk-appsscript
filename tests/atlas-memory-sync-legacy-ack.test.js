'use strict';
// Unmarked Core memory (stored before durable intents) counts as held on the account only when the
// server acknowledges it. The server (Talk lib/atlas-memory-rules.js with synk-server.js) keeps the
// newer time per entry, returns each kept entry as stored, and leaves out, in a successful reply,
// entries dated over a day past its own clock.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMap } = require('../strata');
const { createGame } = require('../atlas/game-learning');
const { createMemorySync } = require('../atlas/memory-sync');
const map = createMap(require('../strata/maps/topik-i.json'));
const NOW = '2026-10-18T09:00:00.000Z', HOUR = 3600000, DAY = 24 * HOUR;
const after = ms => new Date(Date.parse(NOW) + ms).toISOString();
const KEY = 'synk.atlas.learning.v1.device';
const disk = () => { const values = new Map(); return { values, getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) }; };
const id = e => `${e.kind}|${e.key}`;
const outcome = state => [state.phase, state.code, state.queued];

function server() {
  const rows = new Map(), posts = [];
  const cloud = { rows, posts, now: NOW,
    reply: entries => ({ ok: true, revision: 1, entries: structuredClone(entries), serverTime: cloud.now }),
    async get() { return cloud.reply([...rows.values()]); },
    async post({ entries }) {
      posts.push(structuredClone(entries));
      const kept = entries.filter(e => Date.parse(e.at) <= Date.parse(cloud.now) + DAY);
      for (const e of kept) {
        const at = new Date(Date.parse(e.at)).toISOString();
        if (!rows.has(id(e)) || Date.parse(at) > Date.parse(rows.get(id(e)).at)) rows.set(id(e), { kind: e.kind, key: e.key, value: structuredClone(e.value), at });
      }
      return cloud.reply(kept.map(e => rows.get(id(e))));
    } };
  return cloud;
}
function client(transport, { at = NOW } = {}) {
  const storage = disk();
  const game = createGame({ gameId: 'legacy-ack', map, storage, storageScope: 'account', accountKey: 'acct', clock: () => at });
  const sync = createMemorySync({ adapter: game, accountKey: 'acct', revision: 1, transport, setTimer: () => 1, clearTimer() {} });
  return { game, sync, storage };
}
// What Atlas stored before durable intents: a value with its own time and no pending record.
const unmarked = (c, presentation, at) => c.storage.setItem(`${KEY}.presentation`, JSON.stringify({ v: 1, presentation, at }));
const unmarkedDecline = (c, content, at) => c.storage.setItem(`${KEY}.flow`, JSON.stringify({ v: 1, epoch: c.game.memoryPort.epoch(), contents: {}, declined: { [content]: at } }));
// A POST that is answered only when the test lets the server reply.
function paused(cloud) {
  const gate = { finish: null };
  gate.transport = { get: args => cloud.get(args), post: args => new Promise(resolve => { gate.finish = async () => resolve(await cloud.post(args)); }) };
  return gate;
}
async function waitFor(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.fail('expected pending request did not arrive');
}

test('an unmarked choice dated past the server clock stays queued, is offered once per run, and lands unchanged when that clock reaches it', async () => {
  const cloud = server(), c = client(cloud), future = after(3 * DAY);
  unmarked(c, { motion: 'reduced' }, future);
  assert.deepEqual(outcome(await c.sync.start()), ['offline', 'MEMORY_CLOCK_AHEAD', 1]);
  assert.equal(cloud.posts.length, 1, 'one offer per run, not one per round');
  assert.equal(cloud.rows.size, 0);
  assert.deepEqual(outcome(await c.sync.retry()), ['offline', 'MEMORY_CLOCK_AHEAD', 1], 'the same synchroniser does not forget it');
  assert.deepEqual(cloud.posts, [cloud.posts[0], cloud.posts[0]], 'offered again without a new time');
  assert.deepEqual(c.game.memoryPort.state().presentation, { value: { motion: 'reduced' }, at: future });
  cloud.now = after(2 * DAY + 1);
  assert.deepEqual(outcome(await c.sync.retry()), ['synced', null, 0]);
  assert.deepEqual(cloud.rows.get('presentation|chosen'), { kind: 'presentation', key: 'chosen', value: { motion: 'reduced' }, at: future });
  const other = client(cloud, { at: cloud.now }); await other.sync.start();
  assert.deepEqual(other.game.presentation(), { motion: 'reduced' });
  c.sync.stop(); other.sync.stop();
});

test('a lawful omission holds back neither the rest of the batch nor a new choice timed by the server clock', async () => {
  const cloud = server(), future = after(3 * DAY), c = client(cloud, { at: future });
  unmarkedDecline(c, 'cafe', future);
  c.game.setPresentation({ motion: 'reduced' });
  assert.deepEqual(outcome(await c.sync.start()), ['offline', 'MEMORY_CLOCK_AHEAD', 1]);
  assert.deepEqual(cloud.posts.map(batch => batch.map(e => [id(e), e.at])), [[['presentation|chosen', NOW], ['declined|cafe', future]]]);
  assert.deepEqual(cloud.rows.get('presentation|chosen'), { kind: 'presentation', key: 'chosen', value: { motion: 'reduced' }, at: NOW });
  assert.deepEqual(c.game.memoryPort.pending(), []);
  assert.equal(c.game.memoryPort.state().declined.cafe, future);
  assert.equal(cloud.rows.has('declined|cafe'), false); c.sync.stop();
});

test('an omission or older reply the server clock cannot explain is invalid and keeps the local entries queued', async () => {
  const old = after(-HOUR);
  const cases = [
    ['partial', r => ({ ...r, entries: r.entries.filter(e => e.kind !== 'declined') }), 1],
    ['empty', r => ({ ...r, entries: [] }), 2],
    ['older', r => ({ ...r, entries: r.entries.map(e => (e.kind === 'declined' ? { ...e, at: after(-2 * HOUR) } : e)) }), 1],
  ];
  for (const [name, change, queued] of cases) {
    const cloud = server(), c = client({ get: args => cloud.get(args), post: async args => change(await cloud.post(args)) });
    unmarked(c, { motion: 'full' }, old); unmarkedDecline(c, 'cafe', old);
    assert.deepEqual(outcome(await c.sync.start()), ['blocked', 'INVALID_RESPONSE', queued], name);
    assert.equal(cloud.posts.length, 1, name);
    assert.deepEqual(c.game.memoryPort.state(), { presentation: { value: { motion: 'full' }, at: old }, flow: {}, declined: { cafe: old } }, name);
    c.sync.stop();
  }
  // Without a server clock even a far-future entry cannot be told apart from a lost acknowledgement.
  const cloud = server(), strip = ({ serverTime, ...rest }) => rest;
  const c = client({ get: async args => strip(await cloud.get(args)), post: async args => strip(await cloud.post(args)) });
  unmarked(c, { motion: 'reduced' }, after(3 * DAY));
  assert.deepEqual(outcome(await c.sync.start()), ['blocked', 'INVALID_RESPONSE', 1]); c.sync.stop();
});

test('the acknowledgement or a newer server value confirms an unmarked entry, which keeps its old time', async () => {
  const cloud = server(), old = after(-HOUR);
  // Another device declines the same offer between this device's read and its upload.
  const c = client({ get: args => cloud.get(args), post: args => { cloud.rows.set('declined|cafe', { kind: 'declined', key: 'cafe', value: null, at: NOW }); return cloud.post(args); } });
  unmarked(c, { motion: 'full' }, old); unmarkedDecline(c, 'cafe', old);
  assert.deepEqual(outcome(await c.sync.start()), ['synced', null, 0]);
  assert.deepEqual(cloud.posts[0].map(e => e.at), [old, old]);
  assert.equal(cloud.rows.get('presentation|chosen').at, old, 'an old record is not given a new time');
  assert.equal(c.game.memoryPort.state().declined.cafe, NOW, 'the newer server value replaces the local one');
  assert.equal((await c.sync.flush()).queued, 0); assert.equal(cloud.posts.length, 1); c.sync.stop();
});

test('a recoverable failure on an unmarked entry is retried by the same synchroniser', async () => {
  const cloud = server(), old = after(-HOUR); let down = true;
  const c = client({ get: args => cloud.get(args), post: args => (down ? Promise.reject(Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' })) : cloud.post(args)) });
  unmarked(c, { motion: 'reduced' }, old);
  assert.deepEqual(outcome(await c.sync.start()), ['offline', 'NETWORK_ERROR', 1]);
  down = false;
  assert.deepEqual(outcome(await c.sync.retry()), ['synced', null, 0]);
  assert.equal(cloud.rows.get('presentation|chosen').at, old); c.sync.stop();
});

test('a run joined while the server answers offers a left-out entry only once', async () => {
  const cloud = server(), gate = paused(cloud), c = client(gate.transport);
  unmarked(c, { motion: 'reduced' }, after(3 * DAY));
  const running = c.sync.start(); await waitFor(() => gate.finish);
  const joined = c.sync.retry(); await gate.finish();
  assert.equal(joined, running);
  assert.deepEqual(outcome(await running), ['offline', 'MEMORY_CLOCK_AHEAD', 1]);
  assert.equal(cloud.posts.length, 1); c.sync.stop();
});

test('a new choice made while the server leaves the old unmarked one out replaces it, and the run ends synced', async () => {
  const cloud = server(), gate = paused(cloud), c = client(gate.transport);
  unmarked(c, { motion: 'reduced' }, after(3 * DAY));
  const running = c.sync.start(); await waitFor(() => gate.finish);
  c.game.setPresentation({ motion: 'full' });
  const first = gate.finish; gate.finish = null; await first();
  await waitFor(() => gate.finish); await gate.finish();
  assert.deepEqual(outcome(await running), ['synced', null, 0]);
  assert.deepEqual(cloud.rows.get('presentation|chosen'), { kind: 'presentation', key: 'chosen', value: { motion: 'full' }, at: NOW });
  assert.equal(cloud.posts.length, 2); c.sync.stop();
});

test('stopping or a new local epoch during that reply reports no outcome and sends nothing more', async () => {
  for (const end of ['stop', 'epoch']) {
    const cloud = server(), gate = paused(cloud), c = client(gate.transport);
    unmarked(c, { motion: 'reduced' }, after(3 * DAY));
    const running = c.sync.start(); await waitFor(() => gate.finish);
    if (end === 'stop') c.sync.stop();
    else { const record = JSON.parse(c.storage.getItem(KEY)); record.epoch = 'new-epoch'; c.storage.setItem(KEY, JSON.stringify(record)); }
    await gate.finish(); const state = await running;
    assert.deepEqual([state.phase, state.code], end === 'stop' ? ['stopped', null] : ['blocked', 'MEMORY_SESSION_ENDED'], end);
    await c.sync.retry(); await c.sync.flush();
    assert.equal(cloud.posts.length, 1, end); c.sync.stop();
  }
});
