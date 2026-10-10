'use strict';
// What a folding store does when other tabs and devices get in the way: an exclusion of a
// folded helped answer, an outbox that keeps ids only, an acknowledged entry lost under an
// older write (fetched back from the server), a closing tab that writes its entries back,
// an unanswered item that never folds, and folds that come in batches.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, createLearningSync, KEY } = require('../atlas/game-learning');
const { SYNC_KEY, sameEvent } = require('../atlas/learning-sync');
const Atlas = require('../atlas/engine');
const Trail = require('../atlas/trail');
const { createMap } = require('../strata');
const { topikMap } = require('../strata/topik-i');
const map = createMap(topikMap());
const copy = value => JSON.parse(JSON.stringify(value));
const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };
const ACCOUNT = 'account.recovery';
const FOLD = { remote: true, max: 90, keep: 60, ageMs: 0 };
const T0 = Date.parse('2026-08-01T00:00:00Z');
const memory = () => { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) }; };
const stored = storage => JSON.parse(storage.getItem(`${KEY}.device`));
const outbox = storage => JSON.parse(storage.getItem(`${SYNC_KEY}.${ACCOUNT}`));
const timeline = () => { let now = T0; return { clock: () => new Date(now).toISOString(), set: t => { now = t; }, get now() { return now; } }; };
function server() {
  const s = { log: [] };
  s.transport = net => ({
    async get({ after }) {
      if (net.offline) throw new Error('offline');
      (net.gets ||= []).push(after);
      const events = copy(s.log.slice(after, after + 40));
      return { events, cursor: after + events.length, hasMore: after + events.length < s.log.length, revision: 1 };
    },
    async post({ events }) {
      if (net.offline) throw new Error('offline');
      const known = new Map(s.log.map(e => [e.id, e])), added = [];
      for (const e of events) {
        if (!known.has(e.id)) { known.set(e.id, e); added.push(copy(e)); }
        else if (!sameEvent(known.get(e.id), e)) throw Object.assign(new Error('conflict'), { code: 'EVENT_CONFLICT' });
      }
      Atlas.createSession({ scope, events: [...s.log, ...added] });
      s.log.push(...added);
      return { accepted: events.map(e => e.id), revision: 1 };
    },
  });
  return s;
}
function device(s, clock, { fold = FOLD, storage = memory(), gameId = 'recovery' } = {}) {
  const net = { offline: false };
  const game = createGame({ gameId, map, storage, storageScope: 'account', accountKey: ACCOUNT, historyComplete: false, clock, fold });
  const sync = createLearningSync({ adapter: game, accountKey: ACCOUNT, revision: 1, storage, transport: s.transport(net), auto: false,
    maxAttempts: 1, backoffMs: [0], sleep: async () => {} });
  return { game, sync, storage, net };
}
const synced = async sync => assert.equal((await sync.flush()).phase, 'synced');
const item = (i, extra = {}) => ({ id: `q${i}`, itemKey: `item.${i}`, skillId: 'ko.reading.grammar', modality: 'reading', difficulty: 1, responseFormat: 'action', ...extra });
function play(game, time, from, count, gap = 3000) {
  for (let i = from; i < from + count; i += 1) {
    time.set(time.now + gap);
    game.answer(game.present(item(i)), { correct: i % 3 !== 0, assessable: true });
  }
}

test('an exclusion from another device also removes a folded helped answer', async () => {
  const s = server(), time = timeline();
  const a = device(s, time.clock), b = device(s, time.clock, { fold: false, gameId: 'other' });
  assert.equal((await a.sync.start()).phase, 'synced');
  assert.equal((await b.sync.start()).phase, 'synced');
  time.set(T0 + 1000);
  const pid = b.game.present({ id: 'helped', itemKey: 'item.helped', skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice' });
  b.game.help(pid, 'hint');
  const helped = b.game.answer(pid, { correct: true, assessable: true });
  assert.equal(helped.assisted, true);
  await synced(b.sync);
  b.net.offline = true;
  time.set(T0 + 2000);
  b.game.exclude(helped.eventId);
  play(a.game, time, 0, 30);
  for (let i = 0; i < 4; i += 1) await synced(a.sync);
  play(a.game, time, 30, 30);
  await synced(a.sync); await synced(a.sync);
  const cell = () => stored(a.storage).ledger.cells['ko.reading.detail|1|single-choice'];
  assert.ok(cell()?.helped.some(h => h[0] === helped.eventId), 'A folded the helped answer');
  b.net.offline = false;
  await synced(b.sync);
  a.net.gets = [];
  await synced(a.sync); await synced(a.sync);
  assert.ok(!a.net.gets.includes(0), `an entry kept on the server only is not fetched again as lost: ${a.net.gets}`);
  assert.deepEqual(outbox(a.storage).missing, []);
  assert.ok(!cell().helped.some(h => h[0] === helped.eventId), 'the excluded helped answer is gone from the summary');
  const summary = a.game.summary();
  assert.equal(summary.skills.find(x => x.id === 'ko.reading.detail').levels[1].formats['single-choice'].assisted, 0);
  assert.ok(summary.storage.folded > 0 && summary.storage.adjusted >= 1, `storage reports the approximation: ${JSON.stringify(summary.storage)}`);
});

test('the outbox keeps ids only, and an outbox written before is read and sent', async () => {
  const s = server(), time = timeline(), a = device(s, time.clock, { fold: false });
  assert.equal((await a.sync.start()).phase, 'synced');
  a.net.offline = true;
  play(a.game, time, 0, 12);
  assert.equal((await a.sync.flush()).phase, 'offline');
  const box = outbox(a.storage);
  assert.equal(box.version, 2);
  assert.ok(box.pending.length >= 12 && box.pending.every(id => typeof id === 'string'), 'queued entries are ids');
  assert.ok(JSON.stringify(box).length < 2000, `small outbox: ${JSON.stringify(box).length}`);
  // The same queue as an older version wrote it: whole entries.
  const log = new Map(a.game.events().map(e => [e.id, e]));
  a.storage.setItem(`${SYNC_KEY}.${ACCOUNT}`, JSON.stringify({ ...box, version: 1, pending: box.pending.map(id => log.get(id)), missing: undefined }));
  a.sync.stop();
  const again = createLearningSync({ adapter: a.game, accountKey: ACCOUNT, revision: 1, storage: a.storage, transport: s.transport({ offline: false }),
    auto: false, maxAttempts: 1, backoffMs: [0], sleep: async () => {} });
  assert.equal(again.status().queued, box.pending.length);
  assert.equal((await again.flush()).phase, 'synced');
  assert.equal(s.log.length, a.game.events().length, 'every queued entry reached the server');
  assert.equal(outbox(a.storage).version, 2);
});

test('an acknowledged entry lost under an older write comes back from the server', async () => {
  for (const fold of [false, FOLD]) {
    const s = server(), time = timeline(), storage = memory();
    const a = device(s, time.clock, { fold, storage });
    assert.equal((await a.sync.start()).phase, 'synced');
    play(a.game, time, 0, 40);
    await synced(a.sync); await synced(a.sync);
    const older = storage.getItem(`${KEY}.device`);
    play(a.game, time, 40, 6);
    await synced(a.sync); await synced(a.sync);
    const lostIds = a.game.events().filter(e => !JSON.parse(older).events.some(o => o.id === e.id)).map(e => e.id);
    assert.ok(lostIds.length > 10);
    // Another tab writes its older history over this one, and this tab closes without writing back.
    storage.setItem(`${KEY}.device`, older);
    a.sync.stop();
    const reopened = device(s, time.clock, { fold, storage });
    assert.ok(!reopened.game.events().some(e => lostIds.includes(e.id)), 'the entries are gone locally');
    assert.equal((await reopened.sync.start()).phase, 'synced');
    const back = new Set(reopened.game.events().map(e => e.id));
    assert.ok(lostIds.every(id => back.has(id)), `fold ${!!fold}: every lost entry came back`);
    assert.equal(reopened.sync.status().complete, true);
    assert.deepEqual(outbox(storage).missing, []);
    const truth = Trail.summarize(s.log, { scope, asOf: new Date(time.now + 1000).toISOString() });
    assert.equal(reopened.game.summary().counts.attempts, truth.attempts.length, 'the reading counts every answer again');
  }
});

test('a game whose newer fold was written over still hands its synchroniser what it folded', async () => {
  // A game beside the account synchroniser (no synchroniser of its own) folds; its folded ids
  // wait in the store until the synchroniser takes them.
  const s = server(), time = timeline(), storage = memory(), a = device(s, time.clock, { storage });
  const beside = createGame({ gameId: 'beside', map, storage, storageScope: 'account', accountKey: ACCOUNT, historyComplete: false, clock: time.clock, fold: FOLD });
  assert.equal((await a.sync.start()).phase, 'synced');
  beside.syncPort.markComplete(true);
  play(beside, time, 0, 30);
  await synced(a.sync); await synced(a.sync);
  const older = storage.getItem(`${KEY}.device`);
  play(beside, time, 30, 12);
  assert.ok(stored(storage).ledger.folded > JSON.parse(older).ledger.folded, 'a newer fold happened');
  assert.ok(stored(storage).dropped?.length > 0, 'its ids wait for the synchroniser');
  // Another tab writes the older history back; the game carries on and writes again.
  storage.setItem(`${KEY}.device`, older);
  play(beside, time, 42, 1);
  a.net.gets = [];
  await synced(a.sync); await synced(a.sync);
  assert.ok(!a.net.gets.includes(0), `nothing is fetched again: ${a.net.gets}`);
  assert.deepEqual(outbox(storage).missing, []);
  const truth = Trail.summarize(s.log, { scope, asOf: new Date(time.now + 1000).toISOString() });
  assert.equal(beside.summary().counts.attempts, truth.attempts.length, 'no folded answer is read twice');
  assert.equal(a.game.summary().counts.attempts, truth.attempts.length);
});

test('a closing tab writes back the entries another tab wrote over', () => {
  const time = timeline(), storage = memory();
  const a = createGame({ gameId: 'tab-a', map, storage, clock: time.clock });
  play(a, time, 0, 3);
  const older = storage.getItem(`${KEY}.device`);
  play(a, time, 3, 2);
  const mine = a.events().map(e => e.id);
  storage.setItem(`${KEY}.device`, older);
  assert.ok(a.flush());
  const now = stored(storage).events.map(e => e.id);
  assert.ok(mine.every(id => now.includes(id)), 'the overwritten entries are written again');
  assert.equal(a.flush(), true, 'nothing left to write');
});

test('an item still unanswered in this tab never folds', () => {
  const time = timeline(), storage = memory();
  const game = createGame({ gameId: 'open', map, storage, clock: time.clock, fold: { max: 60, keep: 40 } });
  time.set(T0 + 1000);
  const open = game.present(item(999));
  play(game, time, 0, 80, 60000);
  assert.ok(stored(storage).ledger?.folded > 0, 'older items folded');
  assert.ok(game.events().some(e => e.id === open), 'the open presentation is kept');
  const result = game.answer(open, { correct: true, assessable: true });
  assert.ok(game.events().some(e => e.id === result.eventId), 'its late answer is recorded');
});

test('folds come in batches, not one item at a time', () => {
  // Half an hour of items (about 800 entries at 10 s each) is more than the 600 kept, so
  // without batches nearly every write would fold the one item that just became old.
  const time = timeline(), storage = memory();
  const game = createGame({ gameId: 'batch', map, storage, clock: time.clock, fold: { ageMs: 30 * 60000 } });
  const sizes = [];
  let last = 0;
  for (let i = 0; i < 400; i += 1) {
    time.set(time.now + 10000);
    game.answer(game.present(item(i)), { correct: true, assessable: true });
    const folded = stored(storage).ledger?.folded || 0;
    if (folded !== last) { sizes.push(folded - last); last = folded; }
  }
  assert.ok(sizes.length >= 2, `folded ${sizes.length} times`);
  assert.ok(sizes.every(n => n >= 100), `every fold takes at least a batch: ${sizes.join(',')}`);
  assert.ok(stored(storage).events.length <= 1200);
  assert.equal(game.summary().counts.attempts, 400);
});
