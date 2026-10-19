'use strict';
// Core memory on the account (memory-sync.js): the chosen presentation, each content's moment
// memory and declined offers follow the person to another device; today's condition does not.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMap } = require('../strata');
const curriculum = require('../strata/maps/topik-i.json');
const learning = require('../atlas/game-learning');
const { createMemorySync, entriesOf } = require('../atlas/memory-sync');

const map = createMap(curriculum);
const memoryStorage = () => { const data = new Map(); return { data, getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };
const clockFrom = start => { let t = Date.parse(start); return () => new Date(t += 1000).toISOString(); };
const clone = value => JSON.parse(JSON.stringify(value));
const SPEC = { id: 'test.cafe.rush', items: { levels: [1, 2, 3], weight: 2 }, knobs: [
  { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 },
  { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 }] };
let serial = 0;
const item = (difficulty = 1) => { const id = `cafe-${++serial}`; return { id, itemKey: `${id}:v1`, skillId: 'ko.listening.detail', difficulty, modality: 'listening', responseFormat: 'cup-compose', audioRequired: false }; };
const account = (clock, storage = memoryStorage()) => learning.createGame({ gameId: 'world-account', map, storage, clock, storageScope: 'account', accountKey: 'acct-1', historyComplete: false, fold: { remote: true } });

// The server's rule (synk-learning ?view=memory): per entry, the newer time wins.
function server({ revision = 1 } = {}) {
  const rows = new Map(), calls = [];
  const key = e => `${e.kind}|${e.key}`;
  const transport = {
    async get({ revision: r }) { calls.push('get'); if (r !== revision) return { ok: false, error: { code: 'REVISION_CONFLICT' } }; return { ok: true, revision, entries: [...rows.values()].map(clone) }; },
    async post({ revision: r, entries }) {
      calls.push(`post:${entries.length}`);
      if (r !== revision) return { ok: false, error: { code: 'REVISION_CONFLICT' } };
      for (const e of entries) { const old = rows.get(key(e)); if (!old || Date.parse(e.at) > Date.parse(old.at)) rows.set(key(e), clone(e)); }
      return { ok: true, revision, entries: entries.map(e => clone(rows.get(key(e)))) };
    },
  };
  return { rows, calls, transport };
}
const sync = (coach, transport, options = {}) => createMemorySync({ adapter: coach, accountKey: 'acct-1', revision: 1, transport, delayMs: 0, ...options });
function play(coach, rounds = 8) {
  const live = coach.live(SPEC);
  for (let i = 0; i < rounds; i += 1) live.answer(live.present(item(live.settings().level)), { correct: true, assessable: true }, { pressure: 0.3 });
  return live.end();
}

test('the chosen help style and a content’s moment memory continue on another device', async () => {
  const cloud = server(), clockA = clockFrom('2026-10-02T09:00:00.000Z'), clockB = clockFrom('2026-10-02T10:00:00.000Z');
  const a = account(clockA), syncA = sync(a, cloud.transport);
  await syncA.start();
  a.setPresentation({ support: 'step', textSize: 'large' });
  const reached = play(a).settings.values;
  assert.equal((await syncA.flush()).phase, 'synced');
  assert.deepEqual([...cloud.rows.keys()].sort(), ['flow|test.cafe.rush', 'presentation|chosen']);

  const b = account(clockB), syncB = sync(b, cloud.transport);
  assert.equal(b.presentation(), null, 'a new device knows nothing before it reads the account');
  assert.equal((await syncB.start()).phase, 'synced');
  assert.deepEqual(b.presentation(), { support: 'step', textSize: 'large' });
  const live = b.live(SPEC);
  assert.equal(live.settings().values.hint, 'early', 'the help style chosen on the first device holds here too');
  assert.equal(live.settings().values.patience, reached.patience, 'the content starts where the other device left it');
  assert.deepEqual(syncB.status().queued, 0, 'what came from the server is not sent back');
});

test('the newer choice wins in both directions, and a forgotten choice does not come back', async () => {
  const cloud = server(), clockA = clockFrom('2026-10-02T09:00:00.000Z'), clockB = clockFrom('2026-10-02T09:30:00.000Z');
  const a = account(clockA), b = account(clockB), syncA = sync(a, cloud.transport), syncB = sync(b, cloud.transport);
  a.setPresentation({ support: 'independent' }); await syncA.start();
  await syncB.start();
  b.setPresentation(null); await syncB.flush();
  assert.equal(cloud.rows.get('presentation|chosen').value, null, 'forgetting is kept with its time');
  await syncA.retry();
  assert.equal(a.presentation(), null, 'the older choice on the first device gives way');
  // The first device's next choice is newer than the forgetting and wins again everywhere.
  clockA(); a.setPresentation({ explanation: 'brief' });
  for (let i = 0; i < 3600; i += 1) clockA();
  a.setPresentation({ explanation: 'detailed' }); await syncA.flush(); await syncB.retry();
  assert.deepEqual(b.presentation(), { explanation: 'detailed' });
});

test('a declined less-help offer travels; today’s condition stays on the device', async () => {
  const cloud = server(), clock = clockFrom('2026-10-02T09:00:00.000Z');
  const a = account(clock), syncA = sync(a, cloud.transport);
  await syncA.start();
  a.setToday('tired');
  a.live(SPEC).declineLessHelp();
  await syncA.flush();
  assert.deepEqual([...cloud.rows.keys()], ['declined|test.cafe.rush']);
  const b = account(clockFrom('2026-10-02T09:10:00.000Z')), syncB = sync(b, cloud.transport);
  await syncB.start();
  assert.equal(b.today(), null);
  assert.ok(b.memoryPort.state().declined['test.cafe.rush']);
});

test('changes are sent shortly after they happen; another device’s values are never echoed back', async () => {
  const cloud = server(), timers = [];
  const a = account(clockFrom('2026-10-02T09:00:00.000Z'));
  const s = sync(a, cloud.transport, { setTimer: fn => { timers.push(fn); return timers.length; }, clearTimer: () => {} });
  await s.start();
  assert.deepEqual(cloud.calls, ['get']);
  a.setPresentation({ motion: 'reduced' });
  assert.equal(timers.length, 1, 'one send is scheduled');
  a.setPresentation({ motion: 'full' });
  assert.equal(timers.length, 1, 'changes before it leave together');
  await timers.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(cloud.calls, ['get', 'get', 'post:1'], 'a new intent reads the server before receiving its upload time');
  a.memoryPort.merge({ presentation: { value: { motion: 'reduced' }, at: '2027-01-01T00:00:00.000Z' } });
  assert.equal(timers.length, 0, 'an imported value is not a change of this device');
});

test('offline keeps working on the device; the next start sends what is newer without an outbox', async () => {
  const cloud = server();
  let online = false;
  const flaky = { get: args => (online ? cloud.transport.get(args) : Promise.reject(Object.assign(new Error('offline'), { code: 'NETWORK' }))),
    post: args => (online ? cloud.transport.post(args) : Promise.reject(Object.assign(new Error('offline'), { code: 'NETWORK' }))) };
  const storage = memoryStorage(), clock = clockFrom('2026-10-02T09:00:00.000Z');
  const a = account(clock, storage), s = sync(a, flaky);
  assert.equal((await s.start()).phase, 'offline');
  a.setPresentation({ support: 'step' }); play(a, 3);
  assert.equal((await s.flush()).phase, 'offline');
  assert.ok(s.status().queued >= 2);
  s.stop();
  // The app starts again later, online: a fresh synchroniser compares times and sends both.
  online = true;
  const again = account(clock, storage), s2 = sync(again, flaky);
  assert.equal((await s2.start()).phase, 'synced');
  assert.deepEqual([...cloud.rows.keys()].sort(), ['flow|test.cafe.rush', 'presentation|chosen']);
  assert.equal(s2.status().queued, 0);
});

test('consent, revision and sign-in problems stop the synchroniser instead of retrying', async () => {
  for (const code of ['LEARNING_DISABLED', 'REVISION_CONFLICT', 'SESSION_REVOKED', 'FEATURE_DISABLED']) {
    const calls = [];
    const refuse = { get: async () => { calls.push('get'); return { ok: false, error: { code } }; }, post: async () => { calls.push('post'); return { ok: false, error: { code } }; } };
    const a = account(clockFrom('2026-10-02T09:00:00.000Z')), s = sync(a, refuse);
    const state = await s.start();
    assert.deepEqual([state.phase, state.code], ['blocked', code]);
    a.setPresentation({ support: 'step' });
    await s.flush(); await s.retry();
    assert.deepEqual(calls, ['get'], `${code}: no more requests`);
  }
  const wrong = { get: async () => ({ ok: true, revision: 2, entries: [] }), post: async () => ({ ok: true, revision: 2, entries: [] }) };
  assert.equal((await sync(account(clockFrom('2026-10-02T09:00:00.000Z')), wrong).start()).code, 'REVISION_CONFLICT');
});

test('only an account store with a transport can synchronise; a device store stays on the device', () => {
  const device = learning.createGame({ gameId: 'g', map, storage: memoryStorage(), clock: clockFrom('2026-10-02T09:00:00.000Z') });
  assert.equal(device.memoryPort.scope, 'device');
  assert.throws(() => createMemorySync({ adapter: device, accountKey: 'acct-1', revision: 1, transport: server().transport }), /authenticated account adapter/);
  const a = account(clockFrom('2026-10-02T09:00:00.000Z'));
  assert.throws(() => createMemorySync({ adapter: a, accountKey: 'acct-2', revision: 1, transport: server().transport }), /authenticated account adapter/);
  assert.throws(() => createMemorySync({ adapter: a, accountKey: 'acct-1', revision: 0, transport: server().transport }), /authenticated account adapter/);
  assert.throws(() => createMemorySync({ adapter: a, accountKey: 'acct-1', revision: 1, transport: {} }), /authenticated account adapter/);
});

test('an entry the server would refuse is not sent, and the rest still goes', async () => {
  const cloud = server(), a = account(clockFrom('2026-10-02T09:00:00.000Z')), s = sync(a, cloud.transport);
  await s.start();
  a.setPresentation({ support: 'step' });
  const big = { v: 2, content: 'huge.content', at: '2026-10-02T09:00:30.000Z', estimates: {}, indices: {}, latencies: [], pad: 'x'.repeat(5000) };
  a.memoryPort.merge({ flow: { 'huge.content': big } });
  assert.equal((await s.flush()).phase, 'synced');
  assert.deepEqual([...cloud.rows.keys()], ['presentation|chosen']);
  assert.equal(s.status().queued, 0, 'the refused entry waits until it changes');
});

test('merge takes only newer confirmed values, preserves pending intent, and ignores what is not a memory', async () => {
  const a = account(clockFrom('2026-10-02T09:00:00.000Z'));
  const cloud = server(), s = sync(a, cloud.transport);
  play(a, 4);
  const mine = a.memoryPort.state().flow['test.cafe.rush'];
  const older = { ...clone(mine), at: '2026-10-01T00:00:00.000Z', indices: { patience: 0 } };
  assert.equal(a.memoryPort.merge({ flow: { 'test.cafe.rush': older } }), false);
  assert.deepEqual(a.memoryPort.state().flow['test.cafe.rush'], mine);
  assert.equal(a.memoryPort.merge({ flow: { other: { ...older, content: 'not-other' } }, presentation: { value: { age: 40 }, at: '2027-01-01T00:00:00.000Z' } }), false);
  assert.equal(a.presentation(), null);
  const later = { ...clone(mine), at: '2027-01-01T00:00:00.000Z' };
  assert.equal(a.memoryPort.merge({ flow: { 'test.cafe.rush': later } }), false, 'a GET cannot replace an unsent local intent');
  await s.start();
  assert.equal(a.memoryPort.merge({ flow: { 'test.cafe.rush': later } }), true);
  assert.equal(a.memoryPort.state().flow['test.cafe.rush'].at, later.at);
  assert.deepEqual(entriesOf(a.memoryPort.state()).map(e => e.kind), ['flow']);
  s.stop();
});
