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
  const live = one.live({ id: 'world.sample', items: { levels: [1, 2, 3] }, knobs: [{ id: 'patience', kind: 'pace', values: [60, 45, 30], start: 1 }] });
  live.observe({ outcome: 'success', pressure: 0.3 });
  ended = true;
  assert.throws(() => one.events(), /ended/);
  // An open round is guarded on every call too, not only when it began.
  for (const call of [() => live.observe({ outcome: 'success' }), () => live.settings(), () => live.end()]) assert.throws(call, /ended/);
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
// A run owns what its game creates (account/world-learning-host.js beginRun).
const memory = () => { const saved = new Map(); return { saved, storage: { getItem: k => saved.has(k) ? saved.get(k) : null, setItem: (k, v) => saved.set(k, String(v)), removeItem: k => saved.delete(k) } }; };
const item = id => ({ id, itemKey: id, familyKey: id, skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice', audioRequired: false });
const OWNER = 'synk.world.run-owner.v1.', OWNERS = 'synk.world.run-owners.v1';
const owned = saved => [...saved.keys()].filter(k => k.startsWith(OWNER)).map(k => k.slice(OWNER.length)).sort();
// A server that keeps each entry once, with the run it first came with.
const server = revision => {
  const rows = [], requests = []; let offline = false;
  return { rows, requests, set offline(value) { offline = value; },
    transport: { get: async ({ after = 0 }) => ({ ok: true, revision, cursor: rows.length, hasMore: false, events: rows.slice(after).map(row => row.event) }),
      post: async ({ events, runId }) => {
        requests.push({ runId, ids: events.map(e => e.id) });
        if (offline) throw new Error('offline');
        for (const event of events) if (!rows.some(row => row.event.id === event.id)) rows.push({ event, runId: runId ?? null });
        return { ok: true, revision, accepted: events.map(e => e.id) };
      } } };
};
const manual = options => createLearningSync({ ...options, auto: false, maxAttempts: 1 });
test('an entry keeps the run it was made in: an old backlog goes up with its own run after new games and a restart', async () => {
  const { storage } = memory(), remote = server(2);
  const open = () => createWorldLearningHost({ accountKey: 'run-owner-test', revision: 2, guard() {}, storage, transport: remote.transport });
  let host = open();
  const guest = host.createGame({ gameId: 'racing' }, createGame, manual);
  await host.retry(); guest.present(item('before-run')); await host.retry();
  const earlier = guest.events().map(e => e.id);
  remote.offline = true; host.beginRun({ id: 'run-A', gameId: 'racing' });
  const one = host.createGame({ gameId: 'racing' }, createGame, manual);
  one.answer(one.present(item('run-a-item')), { correct: true, assessable: true });
  const aIds = one.events().map(e => e.id).filter(id => !earlier.includes(id));
  await host.retry(); host.stop();
  host = open(); host.beginRun({ id: 'run-B', gameId: 'rhythm' });
  const two = host.createGame({ gameId: 'rhythm' }, createGame, manual);
  await host.retry();
  const before = new Set(two.events().map(e => e.id)); two.present(item('run-b-item'));
  const bIds = two.events().map(e => e.id).filter(id => !before.has(id));
  remote.offline = false; await host.retry();
  assert.ok(aIds.length && bIds.length);
  for (const request of remote.requests) for (const id of request.ids) {
    if (aIds.includes(id)) assert.equal(request.runId, 'run-A');
    if (bIds.includes(id)) assert.equal(request.runId, 'run-B');
    if (earlier.includes(id)) assert.equal(request.runId, undefined);
  }
  assert.ok([...aIds, ...bIds].every(id => remote.rows.some(row => row.event.id === id)));
  host.closeRun(); assert.throws(() => two.answer('anything', { correct: true, assessable: true }), /run ended/); host.stop();
});
test('a run refuses another game, and an owner that cannot be written stops the upload', async () => {
  const values = new Map(); let failOwnership = false, posted = 0;
  const host = createWorldLearningHost({ accountKey: 'ownership-failure', revision: 1, guard() {},
    storage: { getItem: k => values.get(k) || null, setItem(k, v) { if (failOwnership && k.startsWith(OWNER)) throw new Error('disk denied'); values.set(k, v); }, removeItem: k => values.delete(k) },
    transport: { get: async () => ({ ok: true, revision: 1, cursor: 0, hasMore: false, events: [] }), post: async ({ events }) => { posted += events.length; return { ok: true, revision: 1, accepted: events.map(e => e.id) }; } } });
  host.beginRun({ id: 'run-good', gameId: 'right-game' });
  assert.throws(() => host.createGame({ gameId: 'wrong-game' }, createGame, createLearningSync), /does not match/);
  const game = host.createGame({ gameId: 'right-game' }, createGame, createLearningSync);
  await host.retry(); failOwnership = true;
  assert.throws(() => game.present(item('failure')), /disk denied/);
  await host.retry();
  assert.equal(host.status().phase, 'blocked'); assert.equal(posted, 0); host.stop();
});
test('even a flush that posts at once cannot send an entry before its run is recorded', async () => {
  const values = new Map(), events = [], sent = []; let listener;
  const factory = () => ({ syncPort: { events: () => events, markComplete() {}, subscribe(fn) { listener = fn; return () => {}; } },
    present() { events.push({ id: 'new-event' }); listener({ kind: 'append' }); return 'new-event'; } });
  const createSync = options => ({ start() {}, status: () => ({ complete: true }), flush: () => options.transport.post({ revision: 1, events: [...events] }), stop() {} });
  const host = createWorldLearningHost({ accountKey: 'synchronous-run', revision: 1, guard() {},
    storage: { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    transport: { get() {}, post(args) { sent.push(args); return { ok: true, revision: 1, accepted: args.events.map(e => e.id) }; } } });
  host.beginRun({ id: 'run-synchronous', gameId: 'game' });
  const game = host.createGame({ gameId: 'game' }, factory, createSync);
  game.present(); assert.equal(sent.length, 0);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent[0].runId, 'run-synchronous'); assert.equal(values.get(`${OWNER}new-event`), 'run-synchronous'); host.stop();
});
test('an owner record lasts while its entry is in the log, and goes a day after the entry left', () => {
  const { saved, storage } = memory(); let log = [], listener, at = Date.parse('2026-10-01T00:00:00Z');
  const factory = () => ({ syncPort: { events: () => log.slice(), markComplete() {}, subscribe(fn) { listener = fn; return () => {}; } },
    present(id) { log = [...log, { id }]; listener({ kind: 'append' }); return id; } });
  const createSync = () => ({ start() {}, status: () => ({ complete: true }), flush: async () => {}, invalidate() {}, stop() {} });
  const host = createWorldLearningHost({ accountKey: 'owner-records', revision: 1, guard() {}, storage, transport: { get() {}, post() {} }, clock: () => at });
  host.beginRun({ id: 'run-records', gameId: 'game' });
  const game = host.createGame({ gameId: 'game' }, factory, createSync);
  for (const id of ['e1', 'e2', 'e3']) game.present(id);
  assert.deepEqual(owned(saved), ['e1', 'e2', 'e3']);
  // e1 and e2 fold away. Within a day their records stay: a missing entry may come back.
  log = log.filter(e => e.id === 'e3'); at += 3600000; game.present('e4');
  assert.deepEqual(owned(saved), ['e1', 'e2', 'e3', 'e4']);
  at += 86400000; game.present('e5');
  assert.deepEqual(owned(saved), ['e3', 'e4', 'e5']);
  assert.deepEqual(JSON.parse(saved.get(OWNERS)).map(([id]) => id).sort(), ['e3', 'e4', 'e5']);
  // A damaged list is found again from the log; no record is lost.
  saved.set(OWNERS, '{broken'); game.present('e6');
  assert.deepEqual(JSON.parse(saved.get(OWNERS)).map(([id]) => id).sort(), ['e3', 'e4', 'e5', 'e6']);
  assert.ok(owned(saved).every(id => saved.get(OWNER + id) === 'run-records'));
  host.stop();
});
test('a long run keeps few owner records while the synchronised log folds', async () => {
  const { saved, storage } = memory(), remote = server(1);
  let t = Date.parse('2026-09-01T00:00:00Z');
  const host = createWorldLearningHost({ accountKey: 'long-run', revision: 1, guard() {}, storage, transport: remote.transport, clock: () => t });
  host.beginRun({ id: 'run-long', gameId: 'racing' });
  const game = host.createGame({ gameId: 'racing', clock: () => new Date(t).toISOString() }, createGame, manual);
  for (let i = 0; i < 300; i++) {
    t += 30 * 60000;
    game.answer(game.present(item(`long-${i}`)), { correct: i % 4 > 0, assessable: true });
    if (i % 25 === 24) await host.retry();
  }
  await host.retry();
  const made = new Map(remote.rows.map(row => [row.event.id, Date.parse(row.event.at)])), kept = new Set(game.events().map(e => e.id));
  assert.ok(game.summary().storage.folded > 0, 'the log folded');
  assert.ok(remote.rows.length > 1000 && remote.rows.every(row => row.runId === 'run-long'));
  // A record stays only for an entry still in the log, or one that left it within the last day.
  const records = owned(saved);
  assert.ok(records.every(id => kept.has(id) || t - made.get(id) < 86400000 + 30 * 60000), 'stale owner records remain');
  assert.ok(records.length <= kept.size + 200 && records.length < remote.rows.length / 2, `${records.length} records for ${remote.rows.length} entries`);
  host.stop();
});
test('a refusal or a new revision reaches learning-sync as the server sent it', async () => {
  for (const [reply, code, phase] of [[{ ok: true, revision: 2, accepted: [] }, 'REVISION_CONFLICT', 'blocked'],
    [{ ok: false, revision: 1, error: { code: 'EVENT_RUN_CONFLICT', message: 'run changed' } }, 'EVENT_RUN_CONFLICT', 'offline']]) {
    const { storage } = memory();
    const host = createWorldLearningHost({ accountKey: `reply-${code}`, revision: 1, guard() {}, storage,
      transport: { get: async () => ({ ok: true, revision: 1, cursor: 0, hasMore: false, events: [] }), post: async () => reply } });
    host.beginRun({ id: 'run-reply', gameId: 'racing' });
    const game = host.createGame({ gameId: 'racing' }, createGame, manual);
    await host.retry(); game.present(item('reply')); await host.retry();
    assert.equal(host.status().code, code); assert.equal(host.status().phase, phase);
    host.stop();
  }
});
test('a game whose run closed still writes its entries once more as its page closes', async () => {
  const { storage } = memory(), remote = server(1);
  const host = createWorldLearningHost({ accountKey: 'closing-run', revision: 1, guard() {}, storage, transport: remote.transport });
  host.beginRun({ id: 'run-closing', gameId: 'racing' });
  const game = host.createGame({ gameId: 'racing' }, createGame, manual);
  game.present(item('closing')); host.closeRun();
  assert.throws(() => game.present(item('after')), error => error.code === 'RUN_ENDED');
  assert.doesNotThrow(() => game.flush());
  host.stop(); assert.throws(() => game.flush(), /ended/);
});
test('a run follows the log by its ids without copying entries; an older engine is followed through copies', async () => {
  let copies = 0;
  const counted = ({ ids = true } = {}) => options => {
    const coach = createGame(options), port = coach.syncPort;
    return { ...coach, syncPort: { ...port, ids: ids ? port.ids : undefined, events: () => { copies += 1; return port.events(); } } };
  };
  const flow = { id: 'rhythm.timing', version: 1, target: 0.8, knobs: [{ id: 'window', kind: 'pace', values: [1.35, 1.22, 1.1, 1, 0.92, 0.85], start: 3 }] };
  for (const current of [true, false]) {
    const { saved, storage } = memory(), remote = server(1);
    const host = createWorldLearningHost({ accountKey: `ids-${current}`, revision: 1, guard() {}, storage, transport: remote.transport });
    host.beginRun({ id: 'run-ids', gameId: 'rhythm' });
    const game = host.createGame({ gameId: 'rhythm' }, counted({ ids: current }), manual);
    const live = game.live(flow);
    copies = 0;
    for (let beat = 0; beat < 20; beat++) live.observe({ outcome: beat % 3 ? 'success' : 'fail', pressure: 0.4 });
    live.answer(live.present(item(`beat-${current}`)), { correct: true, assessable: true });
    if (current) assert.equal(copies, 0, 'a beat or an answer copies no entry');
    else assert.ok(copies >= 44, 'an older engine is compared through copies');
    await host.retry();
    assert.ok(remote.rows.length >= 3 && remote.rows.every(row => row.runId === 'run-ids'));
    assert.deepEqual(owned(saved), remote.rows.map(row => row.event.id).sort());
    host.stop();
  }
});
test('the status names the account partition and the open run; a device-only account opens no run', () => {
  const host = createWorldLearningHost({ accountKey: 'status-run', revision: 3, guard() {}, storage: memory().storage, transport: server(3).transport });
  assert.deepEqual([host.status().accountKey, host.status().revision, host.status().runId], ['status-run', 3, null]);
  assert.deepEqual(host.beginRun({ id: 'run-status', gameId: 'racing' }), { id: 'run-status', gameId: 'racing' });
  assert.equal(host.status().runId, 'run-status');
  host.closeRun(); assert.equal(host.status().runId, null);
  assert.throws(() => host.beginRun({ id: 'bad id!', gameId: 'racing' }), /run is required/);
  host.stop();
  const local = createWorldLearningHost({ accountKey: 'local:status-run', revision: 1, connected: false, guard() {}, storage: memory().storage });
  assert.deepEqual([local.status().accountKey, local.status().revision, local.status().phase], ['local:status-run', 1, 'local']);
  assert.throws(() => local.beginRun({ id: 'run-local', gameId: 'racing' }), /run is required/);
  local.stop();
});
test('an acknowledgement naming an entry of another run is refused', async () => {
  const { storage } = memory(); let owned = [];
  const host = createWorldLearningHost({ accountKey: 'cross-ack', revision: 1, guard() {}, storage,
    transport: { get: async () => ({ ok: true, revision: 1, cursor: 0, hasMore: false, events: [] }),
      // A faulty server acknowledges the run's entries in reply to the request without a run.
      post: async ({ events, runId }) => ({ ok: true, revision: 1, accepted: runId ? [] : [...events.map(e => e.id), ...owned] }) } });
  const guest = host.createGame({ gameId: 'racing' }, createGame, manual);
  await host.retry(); guest.present(item('free'));
  host.beginRun({ id: 'run-ack', gameId: 'racing' });
  const game = host.createGame({ gameId: 'racing' }, createGame, manual), before = new Set(game.events().map(e => e.id));
  game.present(item('owned')); owned = game.events().map(e => e.id).filter(id => !before.has(id));
  await host.retry();
  assert.ok(owned.length); assert.equal(host.status().phase, 'blocked'); assert.equal(host.status().code, 'INVALID_RESPONSE');
  host.stop();
});
test("entries another tab made never join this tab's run", async () => {
  const { saved, storage } = memory(), remote = server(1);
  const open = () => createWorldLearningHost({ accountKey: 'two-tabs', revision: 1, guard() {}, storage, transport: remote.transport });
  const tab1 = open(), tab2 = open();
  tab1.beginRun({ id: 'run-tab1', gameId: 'racing' });
  const mine = tab1.createGame({ gameId: 'racing' }, createGame, manual), theirs = tab2.createGame({ gameId: 'rhythm' }, createGame, manual);
  mine.present(item('mine-1'));
  const before = new Set(theirs.events().map(e => e.id)); theirs.present(item('theirs'));
  const theirIds = theirs.events().map(e => e.id).filter(id => !before.has(id));
  mine.present(item('mine-2'));
  assert.ok(theirIds.length); assert.ok(theirIds.every(id => !saved.has(OWNER + id)), 'no owner for the other tab');
  await tab1.retry(); await tab2.retry();
  assert.ok(remote.rows.some(row => row.runId === 'run-tab1'));
  for (const row of remote.rows) assert.equal(row.runId, theirIds.includes(row.event.id) ? null : row.runId);
  tab1.stop(); tab2.stop();
});
// The account's Core memory (atlas/memory-sync.js) through the WORLD host.
const { engine } = require('../atlas/game-browser');
// synk-learning ?view=memory: per entry, the newer time wins.
const memoryServer = (respond = null) => {
  const rows = new Map(), calls = [], key = e => `${e.kind}|${e.key}`, copy = value => JSON.parse(JSON.stringify(value));
  return { rows, calls, transport: {
    get: async ({ revision }) => { calls.push('get'); return respond || { ok: true, revision, entries: [...rows.values()].map(copy) }; },
    post: async ({ revision, entries }) => {
      calls.push(`post:${entries.length}`);
      if (respond) return respond;
      for (const e of entries) { const old = rows.get(key(e)); if (!old || Date.parse(e.at) > Date.parse(old.at)) rows.set(key(e), copy(e)); }
      return { ok: true, revision, entries: entries.map(e => copy(rows.get(key(e)))) };
    } } };
};
const FLOW = { id: 'world.memory', items: { levels: [1, 2, 3] }, knobs: [{ id: 'patience', kind: 'pace', values: [60, 45, 30], start: 1 }, { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 }] };
test('the help style and a content’s moment memory chosen in a WORLD game follow the account to another device', async () => {
  const cloud = memoryServer(), records = server(1);
  const open = () => createWorldLearningHost({ accountKey: 'memory-account', revision: 1, guard() {}, storage: memory().storage, transport: records.transport,
    memoryTransport: cloud.transport, engine: { ...engine, createLearningSync: manual } });
  const laptop = open(), game = laptop.createGame({ gameId: 'order-rush' }, createGame, manual);
  assert.equal('memoryPort' in game, false); assert.equal('syncPort' in game, false);
  game.setPresentation({ support: 'step', textSize: 'large' });
  const live = game.live(FLOW);
  for (let i = 0; i < 6; i++) live.answer(live.present({ ...item(`memory-${i}`), difficulty: live.settings().level }), { correct: true, assessable: true }, { pressure: 0.3 });
  const reached = live.end().settings.values;
  assert.equal((await laptop.flush()).phase, 'synced');
  assert.deepEqual([...cloud.rows.keys()].sort(), ['flow|world.memory', 'presentation|chosen']);
  laptop.stop();
  const phone = open(), other = phone.createGame({ gameId: 'korean-rhythm' }, createGame, manual);
  assert.equal((await phone.flush()).phase, 'synced');
  assert.deepEqual(other.presentation(), { support: 'step', textSize: 'large' });
  const there = other.live(FLOW);
  assert.equal(there.settings().values.hint, 'early', 'the help style chosen on the laptop holds in another game on the phone');
  assert.equal(there.settings().values.patience, reached.patience, 'the content starts where the laptop left it');
  assert.equal(phone.status().memory.queued, 0, 'what came from the server is not sent back');
  phone.stop();
});
test('a game’s change goes up by itself, and coming back to the page reads what another device chose', async () => {
  const cloud = memoryServer(), records = server(1), settle = () => new Promise(resolve => setTimeout(resolve, 30));
  // The memory sync waits a moment before sending (3 s in the page); here it does not wait.
  const quick = { ...engine, createLearningSync: manual, createMemorySync: options => engine.createMemorySync({ ...options, delayMs: 0 }) };
  const open = () => createWorldLearningHost({ accountKey: 'memory-auto', revision: 1, guard() {}, storage: memory().storage, transport: records.transport, memoryTransport: cloud.transport, engine: quick });
  const phone = open(), there = phone.createGame({ gameId: 'racing' }, createGame, manual);
  await settle();
  const laptop = open(), here = laptop.createGame({ gameId: 'entry-check' }, createGame, manual);
  await settle(); here.setPresentation({ explanation: 'detailed' }); await settle();
  assert.deepEqual(cloud.rows.get('presentation|chosen')?.value, { explanation: 'detailed' }, 'sent without a flush');
  assert.equal(there.presentation(), null, 'the phone has not looked again yet');
  phone.retry(); await settle();
  assert.deepEqual(there.presentation(), { explanation: 'detailed' });
  laptop.stop(); phone.stop();
});
test('memory stays on the device without a memory transport, the page engine or sharing', () => {
  const cloud = memoryServer();
  const cases = [{ engine }, { memoryTransport: cloud.transport }, { engine, memoryTransport: cloud.transport, connected: false }];
  for (const options of cases) {
    const host = createWorldLearningHost({ accountKey: 'memory-off', revision: 1, guard() {}, storage: memory().storage, transport: server(1).transport, ...options });
    const game = host.createGame({ gameId: 'racing' }, createGame, manual);
    game.setPresentation({ motion: 'reduced' });
    assert.equal(host.status().memory, null); assert.equal(host.flush(), undefined);
    host.stop();
  }
  assert.deepEqual(cloud.calls, []);
});
test('a memory view the server does not offer yet holds up neither the game nor its learning records', async () => {
  const cloud = memoryServer({ ok: false, error: { code: 'MEMORY_UNAVAILABLE', message: 'not here yet' } }), records = server(1);
  const host = createWorldLearningHost({ accountKey: 'memory-refused', revision: 1, guard() {}, storage: memory().storage, transport: records.transport,
    memoryTransport: cloud.transport, engine: { ...engine, createLearningSync: manual } });
  const game = host.createGame({ gameId: 'racing' }, createGame, manual);
  game.setPresentation({ textSize: 'large' });
  game.answer(game.present(item('memory-refused')), { correct: true, assessable: true });
  assert.equal((await host.flush()).phase, 'blocked');
  await host.retry();
  assert.equal(host.status().phase, 'synced'); assert.ok(records.rows.length > 0, 'learning records still go up');
  assert.equal(host.status().memory.code, 'MEMORY_UNAVAILABLE'); assert.deepEqual(game.presentation(), { textSize: 'large' });
  host.stop();
});
