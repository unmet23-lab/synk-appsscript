'use strict';
// Two boundaries of one memory sync run (memory-sync.js). The round budget counts uploads: a queue the
// last allowed upload empties is synced, and only what is still left waits for the next sync. Another
// value the server holds at the same time does not hold the local value there: it stays a conflict.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMap } = require('../strata');
const { createGame } = require('../atlas/game-learning');
const { createMemorySync } = require('../atlas/memory-sync');
const map = createMap(require('../strata/maps/topik-i.json'));
const NOW = '2026-10-18T09:00:00.000Z', HOUR = 3600000, DAY = 24 * HOUR;
const after = ms => new Date(Date.parse(NOW) + ms).toISOString();
const KEY = 'synk.atlas.learning.v1.device';
const disk = (watch = {}) => { const values = new Map(); return { values, getItem: k => values.get(k) ?? null,
  setItem: (k, v) => { if (watch.ended) (watch.late ||= []).push(k); values.set(k, String(v)); }, removeItem: k => values.delete(k) }; };
const id = e => `${e.kind}|${e.key}`;
const outcome = state => [state.phase, state.code, state.queued];

// The server contract (Talk lib/atlas-memory-rules.js, synk-store.js writeMemory): entries dated over a
// day past its clock are left out, a stored row changes only for a strictly newer time, and every kept
// entry comes back as the row now stored. `before` is another device writing just before a POST is
// handled; `answered(n)` runs once the n-th reply exists, while this device still awaits it.
function server() {
  const rows = new Map(), posts = [];
  const cloud = { rows, posts, before: null, answered: null,
    reply: entries => ({ ok: true, revision: 1, entries: structuredClone(entries), serverTime: NOW }),
    async get() { return cloud.reply([...rows.values()]); },
    async post({ entries }) {
      posts.push(structuredClone(entries)); cloud.before?.();
      const kept = entries.filter(e => Date.parse(e.at) <= Date.parse(NOW) + DAY);
      for (const e of kept) {
        const at = new Date(Date.parse(e.at)).toISOString();
        if (!rows.has(id(e)) || Date.parse(at) > Date.parse(rows.get(id(e)).at)) rows.set(id(e), { kind: e.kind, key: e.key, value: structuredClone(e.value), at });
      }
      const reply = cloud.reply(kept.map(e => rows.get(id(e))));
      cloud.answered?.(posts.length);
      return reply;
    } };
  return cloud;
}
function client(transport, { storage = disk() } = {}) {
  const game = createGame({ gameId: 'cycle-boundaries', map, storage, storageScope: 'account', accountKey: 'acct', clock: () => NOW });
  const sync = createMemorySync({ adapter: game, accountKey: 'acct', revision: 1, transport, setTimer: () => 1, clearTimer() {} });
  return { game, sync, storage };
}
// What Atlas stored before durable intents: values with their own time and no pending record.
const unmarked = (c, presentation, at) => c.storage.setItem(`${KEY}.presentation`, JSON.stringify({ v: 1, presentation, at }));
const unmarkedFlow = (c, contents, declined = {}) => c.storage.setItem(`${KEY}.flow`, JSON.stringify({ v: 1, epoch: c.game.memoryPort.epoch(), contents, declined }));
const memory = (content, at, marker) => ({ v: 2, content, at, marker });
// The person changes the presentation once, then again while each upload still awaits its reply.
function editing(c, cloud, edits) {
  let made = 0;
  const edit = () => { made++; c.game.setPresentation({ motion: made % 2 ? 'reduced' : 'full' }); };
  edit(); cloud.answered = () => { if (made < edits) edit(); };
}

test('the round budget counts uploads: a queue the 49th or 50th emptied is synced, a choice left after the 50th waits', async () => {
  for (const edits of [49, 50, 51]) {
    const cloud = server(), c = client(cloud), label = `${edits} edits`;
    editing(c, cloud, edits);
    const state = await c.sync.start();
    assert.equal(cloud.posts.length, Math.min(edits, 50), label);
    assert.ok(cloud.posts.every(batch => batch.length === 1), label);
    if (edits <= 50) {
      assert.deepEqual(outcome(state), ['synced', null, 0], label);
      assert.deepEqual(cloud.rows.get('presentation|chosen').value, { motion: edits % 2 ? 'reduced' : 'full' }, label);
    } else {
      assert.deepEqual(outcome(state), ['offline', 'NETWORK_ERROR', 1], label);
      assert.equal(c.game.memoryPort.pending()[0].assignedAt, null, `${label}: the check after the budget prepares nothing`);
      assert.deepEqual(outcome(await c.sync.retry()), ['synced', null, 0], label);
      assert.equal(cloud.posts.length, 51, label); assert.deepEqual(cloud.rows.get('presentation|chosen').value, { motion: 'reduced' }, label);
    }
    assert.equal(cloud.rows.size, 1, label); c.sync.stop();
  }
});

test('at the last round an entry offered once keeps its own state instead of a round-limit error', async () => {
  for (const kind of ['ahead', 'conflict']) {
    const cloud = server(), c = client(cloud), at = after(-HOUR);
    if (kind === 'ahead') unmarkedFlow(c, {}, { cafe: after(3 * DAY) });
    else { unmarkedFlow(c, { cafe: memory('cafe', at, 1) }); cloud.rows.set('flow|cafe', { kind: 'flow', key: 'cafe', value: memory('cafe', at, 2), at }); }
    editing(c, cloud, 50);
    const state = await c.sync.start();
    assert.equal(cloud.posts.length, 50, kind);
    assert.deepEqual(outcome(state), kind === 'ahead' ? ['offline', 'MEMORY_CLOCK_AHEAD', 1] : ['conflict', 'MEMORY_CONFLICT', 1], kind);
    assert.equal(cloud.posts.filter(batch => batch.some(e => e.kind !== 'presentation')).length, 1, `${kind}: offered once this run`);
    c.sync.stop();
  }
});

test('stopping or a new local epoch while the 50th reply is awaited ends the run without another write', async () => {
  for (const end of ['stop', 'epoch']) {
    const watch = {}, cloud = server(), c = client(cloud, { storage: disk(watch) });
    editing(c, cloud, 50);
    const edit = cloud.answered;
    cloud.answered = n => {
      edit(n); if (n !== 50) return;
      if (end === 'stop') { watch.ended = true; c.sync.stop(); return; }
      const record = JSON.parse(c.storage.getItem(KEY)); record.epoch = 'new-epoch'; c.storage.setItem(KEY, JSON.stringify(record)); watch.ended = true;
    };
    const state = await c.sync.start();
    assert.deepEqual([state.phase, state.code], end === 'stop' ? ['stopped', null] : ['blocked', 'MEMORY_SESSION_ENDED'], end);
    assert.deepEqual(watch.late || [], [], `${end}: nothing prepared, merged or saved after the run ended`);
    assert.equal(cloud.posts.length, 50, end);
    await c.sync.retry(); await c.sync.flush(); assert.equal(cloud.posts.length, 50, end); c.sync.stop();
  }
});

test('another value acknowledged at the same time keeps the local choice queued as a conflict, also when a retry reads it', async () => {
  const at = after(-HOUR);
  for (const seen of ['post', 'get']) {
    const cloud = server(), c = client(cloud), theirs = { kind: 'presentation', key: 'chosen', value: { motion: 'full' }, at };
    unmarked(c, { motion: 'reduced' }, at);
    // Another device stored its choice with the same time before this device read, or before it uploaded.
    if (seen === 'get') cloud.rows.set('presentation|chosen', structuredClone(theirs));
    else cloud.before = () => { if (!cloud.rows.size) cloud.rows.set('presentation|chosen', structuredClone(theirs)); };
    assert.deepEqual(outcome(await c.sync.start()), ['conflict', 'MEMORY_CONFLICT', 1], seen);
    assert.deepEqual(outcome(await c.sync.retry()), ['conflict', 'MEMORY_CONFLICT', 1], `${seen}: the retry's read does not hide it`);
    assert.deepEqual(cloud.posts.map(batch => batch.map(e => e.at)), [[at], [at]], `${seen}: offered once a run, never with a new time`);
    assert.deepEqual(c.game.memoryPort.state().presentation, { value: { motion: 'reduced' }, at }, seen);
    assert.deepEqual(cloud.rows.get('presentation|chosen'), theirs, seen);
    // The person's next choice receives the server clock and settles it everywhere.
    c.game.setPresentation({ motion: 'reduced' });
    assert.deepEqual(outcome(await c.sync.flush()), ['synced', null, 0], seen);
    assert.deepEqual(cloud.rows.get('presentation|chosen'), { kind: 'presentation', key: 'chosen', value: { motion: 'reduced' }, at: NOW }, seen); c.sync.stop();
  }
});

test('the same value in another key order and a later value are acknowledgements; a conflict leaves the rest of its reply intact', async () => {
  const at = after(-HOUR), chosen = value => ({ kind: 'presentation', key: 'chosen', value, at });
  for (const seen of ['get', 'post']) {
    const cloud = server(), c = client(cloud), same = chosen({ textSize: 'large', motion: 'reduced' });
    unmarked(c, { motion: 'reduced', textSize: 'large' }, at);
    if (seen === 'get') cloud.rows.set('presentation|chosen', same); else cloud.before = () => { if (!cloud.rows.size) cloud.rows.set('presentation|chosen', same); };
    assert.deepEqual(outcome(await c.sync.start()), ['synced', null, 0], `same value seen at ${seen}`);
    assert.equal(cloud.posts.length, seen === 'get' ? 0 : 1, `same value seen at ${seen}`); c.sync.stop();
  }
  {
    const cloud = server(), c = client(cloud), later = { kind: 'presentation', key: 'chosen', value: { motion: 'full' }, at: after(-HOUR + 60000) };
    unmarked(c, { motion: 'reduced' }, at);
    cloud.before = () => { if (!cloud.rows.size) cloud.rows.set('presentation|chosen', structuredClone(later)); };
    assert.deepEqual(outcome(await c.sync.start()), ['synced', null, 0], 'later value');
    assert.deepEqual(c.game.memoryPort.state().presentation, { value: { motion: 'full' }, at: later.at }, 'later value'); c.sync.stop();
  }
  // One reply confirms a declined offer and meets the chosen presentation with another same-time value;
  // a choice the person makes while it is awaited still goes out with the server clock.
  for (const choose of [false, true]) {
    const cloud = server(), c = client(cloud), label = choose ? 'with a new choice' : 'conflict';
    unmarked(c, { motion: 'reduced' }, at); unmarkedFlow(c, {}, { cafe: at });
    cloud.before = () => { if (!cloud.rows.has('presentation|chosen')) cloud.rows.set('presentation|chosen', chosen({ motion: 'full' })); };
    if (choose) cloud.answered = n => { if (n === 1) c.game.setPresentation({ motion: 'reduced' }); };
    const state = await c.sync.start();
    assert.deepEqual(cloud.rows.get('declined|cafe'), { kind: 'declined', key: 'cafe', value: null, at }, label);
    if (!choose) assert.deepEqual(outcome(state), ['conflict', 'MEMORY_CONFLICT', 1], label);
    else {
      assert.deepEqual(outcome(state), ['synced', null, 0], label); assert.deepEqual(c.game.memoryPort.pending(), [], label);
      assert.deepEqual(cloud.rows.get('presentation|chosen'), { kind: 'presentation', key: 'chosen', value: { motion: 'reduced' }, at: NOW }, label);
    }
    c.sync.stop();
  }
});
