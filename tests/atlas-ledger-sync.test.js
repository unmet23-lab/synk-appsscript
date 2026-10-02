'use strict';
// A synchronised store folds only entries the server already holds and has sent back. These
// plays sync and fold often and compare what a game reads with a copy that keeps everything.
// With late entries from another device the folding store may claim less than the whole log
// read at once, never more.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, createLearningSync, KEY } = require('../atlas/game-learning');
const { SYNC_KEY, sameEvent } = require('../atlas/learning-sync');
const Atlas = require('../atlas/engine');
const Trail = require('../atlas/trail');
const Ledger = require('../atlas/learning-ledger');
const { createMap } = require('../strata');
const { topikMap } = require('../strata/topik-i');
const map = createMap(topikMap());
const copy = value => JSON.parse(JSON.stringify(value));
const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };
const ACCOUNT = 'account.ledger';
const FOLD = { remote: true, max: 90, keep: 60, ageMs: 0 };
const T0 = Date.parse('2026-08-01T00:00:00Z');
const memory = () => { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) }; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, list) => list[Math.floor(r() * list.length)];
const SKILLS = [['ko.listening.word', 'listening'], ['ko.listening.detail', 'listening'], ['ko.reading.detail', 'reading'], ['ko.reading.grammar', 'reading']];
const FORMATS = ['binary-choice', 'single-choice', 'action'];

// The server keeps every entry in arrival order and pages them by cursor, like synk-learning.
function server({ pageSize = 40 } = {}) {
  const s = { log: [] };
  s.transport = net => ({
    async get({ after }) {
      // `pages`: how many more pages this device receives before the connection drops.
      if (net.offline || net.pages === 0) throw new Error('offline');
      if (net.pages) net.pages -= 1;
      const events = copy(s.log.slice(after, after + pageSize));
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
function device(s, clock, { fold = FOLD, storage = memory(), gameId = 'ledger-sync' } = {}) {
  const net = { offline: false };
  const game = createGame({ gameId, map, storage, storageScope: 'account', accountKey: ACCOUNT, historyComplete: false, clock, fold });
  const sync = createLearningSync({ adapter: game, accountKey: ACCOUNT, revision: 1, storage, transport: s.transport(net), auto: false,
    maxAttempts: 1, backoffMs: [0], sleep: async () => {} });
  return { game, sync, storage, net };
}
function script(seed, items, start, prefix = 'q') {
  const r = rng(seed), steps = [];
  let t = start;
  for (let i = 0; i < items; i += 1) {
    t += 1000 + Math.floor(r() * 3000);
    const [skillId, modality] = pick(r, SKILLS), n = Math.floor(r() * 30);
    const item = { id: `${prefix}${i}`, itemKey: `item.${n}`, familyKey: r() < 0.6 ? `family.${n % 11}` : undefined, skillId, modality,
      difficulty: 1 + Math.floor(r() * 2), responseFormat: pick(r, FORMATS), confounded: r() < 0.05,
      conceptIds: skillId === 'ko.listening.word' ? [`ko.word.w${String(1 + (n % 9)).padStart(4, '0')}`] : r() < 0.3 ? ['G209'] : [] };
    steps.push({ t, item, audio: modality === 'listening' ? (r() < 0.9 ? 'completed' : 'failed') : null,
      help: r() < 0.25 ? pick(r, ['text', 'hint', 'replay', 'answer']) : null,
      answers: Array.from({ length: r() < 0.2 ? 2 : 1 }, () => ({ correct: r() < 0.1 ? null : r() < 0.7, assessable: r() < 0.92, reason: r() < 0.04 ? 'motor' : undefined })),
      exclude: r() < 0.02 });
  }
  return steps;
}
function play(game, step, set) {
  set(step.t);
  const pid = game.present(step.item);
  if (step.audio) { set(step.t + 300); game.delivery(pid, { audio: step.audio }); }
  if (step.help) { set(step.t + 400); game.help(pid, step.help); }
  const results = step.answers.map((a, k) => { set(step.t + 500 + k * 200); return game.answer(pid, { ...a, attemptNo: k + 1 }); });
  if (step.exclude) { set(step.t + 900); game.exclude(results.at(-1).eventId); }
  return results;
}
const provenance = results => results.map(r => [r.independent, r.assisted, r.exposure]);
const cells = s => s.skills.flatMap(skill => [1, 2, 3].flatMap(level => Object.values(skill.levels[level].formats).map(f =>
  [skill.id, level, f.responseFormat, f.status, f.n, f.correct, f.lastAt, f.assisted, f.unassessed, f.evidence.length])));
const content = s => s.concepts.map(c => [c.id, c.status, ...Object.values(c.formats).map(f => [f.responseFormat, f.status, f.n, f.correct, f.lastAt, f.assisted, f.unassessed])]);
const counts = c => [c.presented, c.attempts, c.independent.evaluated, c.independent.correct, c.assisted, c.unknownAssistance, c.repeat,
  c.unknownExposure, c.unassessed, c.skipped, c.excludedAttempts, JSON.stringify(Object.entries(c.byConcept).sort())];
const CANDIDATES = [
  { id: 'c-word', itemKey: 'item.3', skillIds: ['ko.listening.word'], modality: 'listening', difficulty: 1, responseFormat: 'single-choice', conceptIds: ['ko.word.w0004'] },
  { id: 'c-detail', itemKey: 'item.4', familyKey: 'family.4', skillIds: ['ko.listening.detail'], modality: 'listening', difficulty: 1, responseFormat: 'binary-choice' },
  { id: 'c-read', itemKey: 'item.5', skillIds: ['ko.reading.detail'], modality: 'reading', difficulty: 2, responseFormat: 'action' },
  { id: 'c-pack', skillIds: ['ko.reading.detail'], modality: 'reading', difficulty: 1, responseFormat: 'single-choice', familyKeys: ['family.1', 'family.2'] },
];
const reading = g => { const s = g.summary(); return { cells: cells(s), content: content(s), counts: counts(s.counts),
  pick: g.recommend(CANDIDATES).selected?.id, picks: g.recommend(CANDIDATES.slice(1)).alternatives.map(c => c.id) }; };
// Every answer a summary uses as independent evidence.
const claimed = s => [...s.skills.flatMap(skill => [1, 2, 3].flatMap(level => Object.values(skill.levels[level].formats).flatMap(f => f.evidence))),
  ...s.concepts.flatMap(c => Object.values(c.formats).flatMap(f => f.evidence))];
const stored = storage => JSON.parse(storage.getItem(`${KEY}.device`));
const folded = ledger => Object.values(ledger.cells).reduce((n, cell) => n + cell.ind.length, 0);

const timeline = () => {
  let now = T0;
  return { clock: () => new Date(now).toISOString(), set: t => { now = t; }, get now() { return now; } };
};
const synced = async sync => assert.equal((await sync.flush()).phase, 'synced');

test('a synchronised store folds only what the server sent back and reads like a full copy', async () => {
  for (const seed of [8, 19]) {
    const s = server(), time = timeline();
    const a = device(s, time.clock), full = createGame({ gameId: 'ledger-sync', map, storage: memory(), clock: time.clock, fold: false });
    assert.equal((await a.sync.start()).phase, 'synced');
    let sawFold = false;
    for (const [i, step] of script(seed, 240, T0).entries()) {
      assert.deepEqual(provenance(play(a.game, step, time.set)), provenance(play(full, step, time.set)), `seed ${seed} item ${i}: answer provenance`);
      if (i % 3 === 2) await synced(a.sync);
      if (i % 20 === 19) assert.deepEqual(reading(a.game), reading(full), `seed ${seed} after ${i + 1} items`);
      sawFold ||= !!stored(a.storage).ledger;
    }
    await synced(a.sync); await synced(a.sync);
    const local = stored(a.storage), outbox = JSON.parse(a.storage.getItem(`${SYNC_KEY}.${ACCOUNT}`));
    assert.ok(sawFold && local.ledger.folded > 0, 'the synchronised store folded');
    assert.ok(local.events.length <= FOLD.max + 20, `kept entries ${local.events.length}`);
    assert.equal(s.log.length, full.events().length, 'the server holds every entry');
    assert.equal(outbox.pending.length, 0);
    assert.ok(outbox.acknowledged.length <= local.events.length, `the outbox forgets folded ids: ${outbox.acknowledged.length}`);
    assert.ok(local.settled.every(id => local.events.some(e => e.id === id)), 'settled marks name kept entries only');
    assert.ok(!local.dropped || local.dropped.length <= FOLD.max, `the synchroniser has taken what was folded: ${local.dropped?.length}`);
    assert.deepEqual(reading(a.game), reading(full));
  }
});

test('nothing folds before the server has sent an entry back', async () => {
  const s = server(), time = timeline(), a = device(s, time.clock);
  assert.equal((await a.sync.start()).phase, 'synced');
  a.net.offline = true;
  for (const step of script(3, 60, T0)) play(a.game, step, time.set);
  assert.equal((await a.sync.flush()).phase, 'offline');
  assert.equal(stored(a.storage).ledger, undefined, 'unsent entries never fold');
  a.net.offline = false;
  await synced(a.sync);
  assert.equal(stored(a.storage).ledger, undefined, 'sent but not yet sent back: still kept');
  await synced(a.sync);
  const local = stored(a.storage);
  assert.ok(local.ledger?.folded > 0, 'folded once the server sent the entries back');
  assert.equal(s.log.length, local.ledger.folded + local.events.length, 'every entry is on the server; the device keeps the rest');
});

test('late entries from another device never make a folding store claim more than the whole log', async () => {
  const s = server(), time = timeline();
  const a = device(s, time.clock), b = device(s, time.clock, { fold: false, gameId: 'other-game' });
  // A second game on A's store reads what A's synchroniser brings in.
  const beside = createGame({ gameId: 'beside', map, storage: a.storage, storageScope: 'account', accountKey: ACCOUNT, historyComplete: false, clock: time.clock, fold: FOLD });
  assert.equal((await a.sync.start()).phase, 'synced');
  assert.equal((await b.sync.start()).phase, 'synced');
  beside.syncPort.markComplete(true);
  const first = script(41, 120, T0, 'a');
  for (const [i, step] of first.entries()) { play(a.game, step, time.set); if (i % 3 === 2) await synced(a.sync); }
  await synced(a.sync); await synced(b.sync);
  // B answers one item online, then practises offline: those entries reach A late.
  let t = first.at(-1).t + 5000;
  time.set(t);
  const sharedPid = b.game.present({ id: 'shared', itemKey: 'item.shared', familyKey: 'family.shared', skillId: 'ko.reading.detail', modality: 'reading',
    difficulty: 1, responseFormat: 'single-choice' });
  time.set(t + 500);
  const shared = b.game.answer(sharedPid, { correct: true, assessable: true });
  assert.equal(shared.independent, true);
  await synced(b.sync);
  b.net.offline = true;
  const offline = script(42, 60, t + 2000, 'b');
  for (const step of offline) play(b.game, step, time.set);
  t = offline.at(-1).t + 2000; time.set(t);
  b.game.exclude(shared.eventId);
  // A keeps playing, folding past everything B did offline (and B's shared item).
  const later = script(43, 120, t + 5000, 'c');
  for (const [i, step] of later.entries()) { play(a.game, step, time.set); if (i % 3 === 2) await synced(a.sync); }
  await synced(a.sync); await synced(a.sync);
  const before = stored(a.storage).ledger;
  assert.ok(before.cutoff > t, 'A folded past B\'s offline entries');
  assert.ok(!a.game.events().some(e => e.id === shared.eventId), 'A folded B\'s shared answer');
  // B comes back; A receives entries older than its cutoff, and an exclusion of a folded answer.
  b.net.offline = false;
  await synced(b.sync);
  beside.summary();
  // The first page arrives and the connection drops: those late entries stay unfolded for now,
  // in A's log and in the log of the game beside it.
  a.net.pages = 1;
  assert.equal((await a.sync.flush()).phase, 'offline');
  const partial = a.game.events(), cutoff = stored(a.storage).ledger;
  assert.ok(partial.some(e => Ledger.folded(cutoff, e)), 'late entries before the cutoff are kept until they settle');
  assert.deepEqual(beside.events().map(e => e.id).sort(), partial.map(e => e.id).sort(), 'the game beside keeps them too');
  a.net.pages = undefined;
  await synced(a.sync);
  const after = stored(a.storage).ledger;
  assert.ok(folded(after) < folded(before), 'folded first answers after B\'s late entries stop counting');
  assert.ok(s.log.some(e => e.type === 'record.excluded' && e.targetId === shared.eventId), 'the server holds B\'s exclusion');
  assert.ok(!a.game.events().some(e => e.type === 'record.excluded'), 'an exclusion of a folded answer stays on the server');
  // A plays on with B's entries in its log.
  const answers = [];
  for (const [i, step] of script(44, 60, Date.parse(time.clock()) + 5000, 'd').entries()) {
    answers.push(...play(a.game, step, time.set)); if (i % 3 === 2) await synced(a.sync);
  }
  await synced(a.sync); await synced(b.sync);
  const truth = Trail.summarize(s.log, { scope, asOf: new Date(Date.parse(time.clock()) + 1000).toISOString() });
  const independent = new Set(truth.attempts.filter(x => x.independent).map(x => x.eventId));
  const summary = a.game.summary(), ids = claimed(summary);
  assert.ok(ids.length > 10, `A still has evidence: ${ids.length}`);
  for (const id of ids) assert.ok(independent.has(id), `A uses ${id} as a first answer; the whole log does not`);
  for (const r of answers) if (r.independent) assert.ok(independent.has(r.eventId), `A called ${r.eventId} a first answer; the whole log does not`);
  const ledger = stored(a.storage).ledger;
  for (const table of [ledger.cells, ledger.content]) for (const cell of Object.values(table)) for (const [id] of cell.ind) {
    assert.ok(independent.has(id), `A's ledger keeps ${id} as a first answer; the whole log does not`);
  }
  assert.ok(!ids.includes(shared.eventId), 'the excluded answer is no longer evidence');
  assert.equal(a.sync.status().phase, 'synced');
  assert.ok(stored(a.storage).events.length <= FOLD.max + 20, 'A stays small');
  // The game beside the synchroniser holds the same log and claims no more.
  assert.deepEqual(beside.events().map(e => e.id).sort(), a.game.events().map(e => e.id).sort());
  for (const id of claimed(beside.summary())) assert.ok(independent.has(id), `beside uses ${id} as a first answer; the whole log does not`);
});

test('an unanswered item stays until another device answers it', async () => {
  const s = server(), time = timeline();
  const a = device(s, time.clock), b = device(s, time.clock, { fold: false, gameId: 'other-game' });
  assert.equal((await a.sync.start()).phase, 'synced');
  assert.equal((await b.sync.start()).phase, 'synced');
  time.set(T0 + 1000);
  const pid = b.game.present({ id: 'open', itemKey: 'item.open', familyKey: 'family.open', skillId: 'ko.reading.detail', modality: 'reading',
    difficulty: 1, responseFormat: 'single-choice' });
  await synced(b.sync); await synced(a.sync); await synced(a.sync);
  b.net.offline = true;
  time.set(T0 + 2000);
  const late = b.game.answer(pid, { correct: true, assessable: true });
  for (const [i, step] of script(12, 120, T0 + 5000, 'a').entries()) { play(a.game, step, time.set); if (i % 3 === 2) await synced(a.sync); }
  await synced(a.sync); await synced(a.sync);
  assert.ok(stored(a.storage).ledger?.folded > 0, 'A folded newer items');
  assert.ok(a.game.events().some(e => e.id === pid), 'the unanswered presentation is kept');
  b.net.offline = false;
  await synced(b.sync); await synced(a.sync);
  assert.ok(a.game.events().some(e => e.id === late.eventId), 'the late answer joins its presentation');
});

test('a late answer on the same item, filed under another family, still stops a folded first answer', async () => {
  const s = server(), time = timeline();
  const a = device(s, time.clock), b = device(s, time.clock, { fold: false, gameId: 'other-game' });
  assert.equal((await a.sync.start()).phase, 'synced');
  assert.equal((await b.sync.start()).phase, 'synced');
  const item = { itemKey: 'item.k1', skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice' };
  b.net.offline = true;
  time.set(T0 + 1000);
  const late = b.game.answer(b.game.present({ id: 'b-k1', ...item }), { correct: true, assessable: true });
  time.set(T0 + 5000);
  const first = a.game.answer(a.game.present({ id: 'a-k1', ...item, familyKey: 'family.k1' }), { correct: true, assessable: true });
  assert.equal(first.independent, true, 'A has not met item.k1 yet');
  // Fresh items in another cell push A's answer into the ledger without crowding it out.
  for (let i = 0; i < 40; i += 1) {
    time.set(T0 + 10000 + i * 3000);
    a.game.answer(a.game.present({ id: `f${i}`, itemKey: `item.f${i}`, skillId: 'ko.reading.grammar', modality: 'reading', difficulty: 1, responseFormat: 'action' }),
      { correct: true, assessable: true });
    if (i % 3 === 2) await synced(a.sync);
  }
  await synced(a.sync); await synced(a.sync);
  const cell = () => stored(a.storage).ledger.cells['ko.reading.detail|1|single-choice'];
  assert.ok(cell()?.ind.some(([id]) => id === first.eventId), 'A folded its first answer on item.k1');
  b.net.offline = false;
  await synced(b.sync); await synced(a.sync);
  const truth = Trail.summarize(s.log, { scope, asOf: new Date(Date.parse(time.clock()) + 1000).toISOString() });
  assert.equal(truth.attempts.find(x => x.eventId === first.eventId).independent, false, 'B met item.k1 first');
  assert.ok(!cell().ind.some(([id]) => id === first.eventId), 'A no longer counts it as a first answer');
  // B's answer came earlier in time but later in the log: the whole log counts neither.
  assert.equal(truth.attempts.find(x => x.eventId === late.eventId).independent, false);
  assert.ok(!claimed(a.game.summary()).includes(late.eventId));
});

test('an open item read before newer folded items still counts for them', async () => {
  const s = server(), time = timeline();
  const a = device(s, time.clock), full = createGame({ gameId: 'ledger-sync', map, storage: memory(), clock: time.clock, fold: false });
  assert.equal((await a.sync.start()).phase, 'synced');
  // The answer to family.3 is shown and the item left open; newer family.3 answers are not first answers.
  const open = { id: 'open', itemKey: 'item.open', familyKey: 'family.3', skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice' };
  for (const game of [a.game, full]) { time.set(T0 + 1000); const pid = game.present(open); time.set(T0 + 1200); game.help(pid, 'answer'); }
  for (const [i, step] of script(21, 200, T0 + 5000).entries()) {
    assert.deepEqual(provenance(play(a.game, step, time.set)), provenance(play(full, step, time.set)), `item ${i}: answer provenance`);
    if (i % 3 === 2) await synced(a.sync);
  }
  await synced(a.sync); await synced(a.sync);
  assert.ok(stored(a.storage).ledger?.folded > 0);
  assert.deepEqual(reading(a.game), reading(full));
});

test('an item folded in another tab ends there too', () => {
  const time = timeline(), storage = memory(), fold = { max: 30, keep: 20, ageMs: 0 };
  const one = createGame({ gameId: 'tab-one', map, storage, clock: time.clock, fold }), two = createGame({ gameId: 'tab-two', map, storage, clock: time.clock, fold });
  time.set(T0 + 1000);
  const pid = one.present({ id: 'left', itemKey: 'item.left', skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice' });
  for (const step of script(6, 40, T0 + 5000)) play(two, step, time.set);
  assert.ok(stored(storage).ledger?.folded > 0 && !two.events().some(e => e.id === pid), 'the other tab folded the open item');
  assert.throws(() => one.answer(pid, { correct: true, assessable: true }), /presentation ended or local record reset/);
});

test('a store synchronised before folding settles at its first complete pull, then folds', async () => {
  const s = server(), time = timeline(), storage = memory();
  const old = device(s, time.clock, { fold: false, storage });
  assert.equal((await old.sync.start()).phase, 'synced');
  for (const [i, step] of script(9, 150, T0).entries()) { play(old.game, step, time.set); if (i % 5 === 4) await synced(old.sync); }
  await synced(old.sync);
  old.sync.stop();
  const before = reading(old.game);
  assert.equal(stored(storage).ledger, undefined);
  const upgraded = device(s, time.clock, { storage });
  assert.equal((await upgraded.sync.start()).phase, 'synced');
  const local = stored(storage);
  assert.ok(local.ledger?.folded > 0, 'the first complete pull settles and folds the old history');
  assert.ok(local.events.length <= FOLD.max);
  assert.deepEqual(reading(upgraded.game), before);
});

test('a game beside the account synchroniser folds with it and reads like a full copy', async () => {
  const s = server(), time = timeline(), storage = memory();
  const primary = device(s, time.clock, { storage, gameId: 'world-account' });
  const coach = createGame({ gameId: 'coach', map, storage, storageScope: 'account', accountKey: ACCOUNT, historyComplete: false, clock: time.clock, fold: FOLD });
  const full = createGame({ gameId: 'coach', map, storage: memory(), clock: time.clock, fold: false });
  assert.equal((await primary.sync.start()).phase, 'synced');
  coach.syncPort.markComplete(true);
  for (const [i, step] of script(77, 200, T0).entries()) {
    assert.deepEqual(provenance(play(coach, step, time.set)), provenance(play(full, step, time.set)), `item ${i}: answer provenance`);
    if (i % 4 === 3) await synced(primary.sync);
    if (i % 25 === 24) assert.deepEqual(reading(coach), reading(full), `after ${i + 1} items`);
  }
  await synced(primary.sync); await synced(primary.sync);
  assert.ok(stored(storage).ledger?.folded > 0);
  assert.deepEqual(reading(coach), reading(full));
  assert.equal(s.log.length, full.events().length);
});

test('syncPort.ids() names the kept entries, in log order, without copying them', () => {
  const time = timeline(), game = createGame({ gameId: 'ids', map, storage: memory(), clock: time.clock, fold: { max: 30, keep: 20, ageMs: 0 } });
  for (const step of script(6, 40, T0)) play(game, step, time.set);
  const ids = game.syncPort.ids();
  assert.deepEqual(ids, game.syncPort.events().map(e => e.id));
  assert.ok(ids.length > 0 && ids.length <= 30, 'folded entries are gone');
  ids.push('changed'); assert.ok(!game.syncPort.ids().includes('changed'), 'each call gives its own list');
});

test('a history folded without a server is never sent, even once sharing is turned on', async () => {
  // A guest device: the kept entries can still be read; the folded history cannot be sent.
  const time = timeline(), game = createGame({ gameId: 'guest', map, storage: memory(), clock: time.clock, fold: { max: 30, keep: 20, ageMs: 0 } });
  for (const step of script(4, 40, T0)) play(game, step, time.set);
  assert.ok(game.syncPort.events().length > 0 && game.syncPort.events().length <= 30, 'kept entries are readable');
  assert.equal(game.syncPort.partial(), true);
  assert.throws(() => game.syncPort.importEvents([]), error => error.code === 'HISTORY_FOLDED');
  assert.equal(game.syncPort.settle(['x']), false, 'only a synchronised store settles');
  // An account played with sharing off folds the same way; when sharing is turned on later the
  // host opens that store as a synchronised one, and the synchroniser refuses to send it.
  const s = server(), storage = memory(), later = timeline();
  const off = createGame({ gameId: 'sharing-off', map, storage, storageScope: 'account', accountKey: ACCOUNT, historyComplete: true, clock: later.clock, fold: { max: 30, keep: 20, ageMs: 0 } });
  for (const step of script(5, 40, T0)) play(off, step, later.set);
  assert.ok(stored(storage).ledger?.local, 'the summary says no server received these entries');
  const on = device(s, later.clock, { storage });
  assert.equal(on.game.syncPort.partial(), true);
  assert.equal(storage.getItem(`${SYNC_KEY}.${ACCOUNT}`), null, 'none of it is even queued for sending');
  const status = await on.sync.start();
  assert.equal(status.phase, 'blocked');
  assert.equal(status.code, 'HISTORY_FOLDED');
  assert.equal(s.log.length, 0, 'nothing reached the server');
  assert.equal(on.game.summary().counts.attempts, off.summary().counts.attempts, 'the device still reads its whole history');
  // Folding more entries on top of such a summary keeps the mark.
  const kept = off.events();
  assert.equal(Ledger.fold(stored(storage).ledger, kept, { scope, log: kept }).local, true);
});
