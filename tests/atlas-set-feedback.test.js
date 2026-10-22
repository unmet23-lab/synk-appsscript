'use strict';
// A learner's response to a finished practice set (docs/디자인/WORLD_학습자응답과_내기록_설계_20261022.md §2·§4·§7).
// finishSet leaves one set-level decision and completion; feedback answers that completion and names its decision,
// so a store folding with the rule from before this change (no completionId in reference()) keeps the set with it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const Atlas = require('../atlas/engine');
const Ledger = require('../atlas/learning-ledger');
const { createGame } = require('../atlas/game-learning');
const { createMap } = require('../strata');
const { topikMap } = require('../strata/topik-i');
const map = createMap(topikMap());
const DAY = 86400000;
const memory = () => { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };
const START = Date.parse('2026-10-01T00:00:00Z');
function player({ storage = memory(), gameId = 'world-practice', fold, factory = createGame, ...rest } = {}) {
  let now = START;
  const game = factory({ gameId, map, storage, clock: () => new Date(now).toISOString(), ...(fold === undefined ? {} : { fold }), ...rest });
  return { game, storage, at: t => { now = t; }, get now() { return now; }, tick: ms => { now += ms; } };
}
let n = 0;
const item = () => { n += 1; return { id: `q${n}`, itemKey: `item.${n}`, skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice' }; };
// One practice item: presented and answered right away.
function practise(p) { const pid = p.game.present(item()); p.tick(500); p.game.answer(pid, { correct: true, assessable: true }); p.tick(500); return pid; }
const kinds = events => events.reduce((count, e) => ({ ...count, [e.type]: (count[e.type] || 0) + 1 }), {});

test('finishSet leaves one set decision and completion of at most five minutes, even under a short-time setting', () => {
  const p = player();
  practise(p);
  const before = p.game.events().length;
  const set = p.game.finishSet({ kind: 'short' });
  const added = p.game.events().slice(before);
  assert.deepEqual(added.map(e => e.type), ['decision.made', 'experience.completed']);
  const [decision, completion] = added;
  assert.equal(decision.experienceId, 'world-practice.set');
  assert.equal(decision.variant, 'short');
  assert.deepEqual(decision.candidateSnapshot, [{ id: 'short', minutes: 5, pace: 'standard' }]);
  assert.deepEqual(set, { decisionId: decision.id, completionId: completion.id });
  assert.equal(completion.decisionId, decision.id);
  assert.throws(() => p.game.finishSet({ kind: 'lesson' }), /invalid practice set/);
  // Another app left "short time" in the shared log: the set is still recorded.
  const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };
  const session = Atlas.createSession({ scope, events: p.game.events(), clock: () => new Date(p.now).toISOString() });
  session.set('time', 'short');
  const storage = memory();
  storage.setItem('synk.atlas.learning.v1.device', JSON.stringify({ version: 1, epoch: 'e1', events: session.events() }));
  const q = player({ storage, gameId: 'world-mock' }); q.at(p.now + 1000);
  const mock = q.game.finishSet({ kind: 'mock' });
  assert.ok(q.game.events().some(e => e.id === mock.decisionId && e.experienceId === 'world-mock.set' && e.variant === 'mock'));
});

test('feedback answers a set completion only, with its decision, one of four values; the same value adds nothing', () => {
  const p = player();
  const pid = practise(p);
  const set = p.game.finishSet({ kind: 'short' });
  p.tick(1000);
  const first = p.game.feedback(set, 'too_much');
  assert.equal(first.type, 'feedback.given');
  assert.equal(first.completionId, set.completionId);
  assert.equal(first.decisionId, set.decisionId);
  assert.equal(first.value, 'too_much');
  const count = p.game.events().length;
  assert.equal(p.game.feedback(set, 'too_much'), null, 'the same value again is no new event');
  assert.equal(p.game.events().length, count);
  p.tick(1000);
  p.game.feedback(set, 'want_more');
  assert.deepEqual(p.game.setFeedback().map(f => [f.completionId, f.value, f.kind]), [[set.completionId, 'want_more', 'short']]);
  assert.throws(() => p.game.feedback(set, 'great'), /invalid set response/);
  assert.throws(() => p.game.feedback({ ...set, decisionId: 'a-wrong-decision' }, 'helpful'), e => e.code === 'SET_UNAVAILABLE');
  // An item's own completion is not a set: no response to it here.
  const itemDecision = p.game.events().find(e => e.type === 'practice.presented' && e.id === pid).decisionId;
  const itemCompletion = p.game.events().find(e => e.type === 'experience.completed' && e.decisionId === itemDecision);
  assert.throws(() => p.game.feedback({ decisionId: itemDecision, completionId: itemCompletion.id }, 'helpful'), e => e.code === 'SET_UNAVAILABLE');
  // Another game's set is not this game's either.
  const other = player({ storage: p.storage, gameId: 'world-mock' }); other.at(p.now + 1000);
  assert.throws(() => other.game.feedback(set, 'helpful'), e => e.code === 'SET_UNAVAILABLE');
  assert.deepEqual(other.game.setFeedback(), []);
});

test('the engine checks a response decision: a valid id that is the completion decision', () => {
  const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };
  let t = START;
  const session = Atlas.createSession({ scope, clock: () => new Date(t += 1000).toISOString() });
  const decision = session.plan('world-practice.set', [{ id: 'short', minutes: 5, pace: 'standard' }]);
  const completion = session.complete(decision);
  const other = session.plan('world-practice.set', [{ id: 'short', minutes: 5, pace: 'standard' }]);
  assert.throws(() => session.feedback(completion.id, 'helpful', 'not an id!'), /invalid feedback/);
  assert.throws(() => session.feedback(completion.id, 'helpful', other.id), /another decision/);
  const named = session.feedback(completion.id, 'helpful', decision.id);
  assert.equal(named.decisionId, decision.id);
  // A response without the field stays valid (other apps, earlier entries).
  assert.equal(session.feedback(completion.id, 'not_fit').decisionId, undefined);
  // The server's increment check reads the completion only and takes both.
  const log = session.events();
  const fresh = Atlas.validateIncrement({ events: log.slice(-2), scope, references: [log.find(e => e.id === completion.id)] });
  assert.equal(fresh.length, 2);
  const forged = { ...log.at(-2), id: 'forged-response', decisionId: other.id };
  assert.throws(() => Atlas.validateIncrement({ events: [forged], scope, references: [log.find(e => e.id === completion.id)] }), /another decision/);
});

test('an excluded response leaves the state; another response of the same game then leads', () => {
  const p = player();
  practise(p); const a = p.game.finishSet({ kind: 'short' }); p.tick(1000); p.game.feedback(a, 'too_much');
  p.tick(60000);
  practise(p); const b = p.game.finishSet({ kind: 'short' }); p.tick(1000); const last = p.game.feedback(b, 'want_more');
  assert.deepEqual(p.game.setFeedback().map(f => f.value), ['too_much', 'want_more']);
  p.tick(1000); p.game.exclude(last.id);
  assert.deepEqual(p.game.setFeedback().map(f => f.value), ['too_much']);
  // Pressing the excluded value again records it anew.
  p.tick(1000); assert.ok(p.game.feedback(b, 'want_more'));
  assert.deepEqual(p.game.setFeedback().map(f => f.value), ['too_much', 'want_more']);
  // After 30 days Core no longer reads them.
  p.tick(31 * DAY);
  assert.deepEqual(p.game.setFeedback(), []);
});

// A long device history: many items, a set with a response, then many more items so the log folds past 600.
function longHistory(p, { respondAt = null, exclude = false } = {}) {
  for (let i = 0; i < 40; i += 1) practise(p);
  const set = p.game.finishSet({ kind: 'short' });
  p.tick(1000);
  const response = p.game.feedback(set, 'too_much');
  if (exclude) { p.tick(1000); p.game.exclude(response.id); }
  if (respondAt) p.at(respondAt);
  for (let i = 0; i < 230; i += 1) { practise(p); if (i % 50 === 0) p.tick(DAY); }
  return { set, response };
}

test('a live response keeps its set past 600 entries; a fresh store reads the folded log without a refusal', () => {
  const p = player();
  const { set, response } = longHistory(p);
  const summary = p.game.summary();
  assert.ok(summary.storage.folded > 0, 'the log folded');
  assert.equal(summary.storage.available, true);
  const ids = new Set(p.game.events().map(e => e.id));
  for (const id of [set.decisionId, set.completionId, response.id]) assert.ok(ids.has(id), `${id} stays while its response is read`);
  // Another tab (a new game on the same storage) opens the folded log.
  const again = player({ storage: p.storage }); again.at(p.now + 1000);
  assert.equal(again.game.summary().storage.available, true);
  assert.deepEqual(again.game.setFeedback().map(f => f.value), ['too_much']);
});

test('a response older than 30 days folds with its set and its exclusion', () => {
  const p = player();
  const { set, response } = longHistory(p, { exclude: true });
  p.tick(31 * DAY);
  for (let i = 0; i < 230; i += 1) practise(p);
  const ids = new Set(p.game.events().map(e => e.id));
  for (const id of [set.decisionId, set.completionId, response.id]) assert.ok(!ids.has(id), `${id} folded`);
  assert.ok(!p.game.events().some(e => e.type === 'record.excluded' && e.targetId === response.id), 'its exclusion folded too');
  assert.equal(p.game.summary().storage.available, true);
});

test('Ledger.plan keeps a responded set until its response is older than respondedBefore', () => {
  const p = player({ fold: false });
  practise(p);
  const set = p.game.finishSet({ kind: 'short' }); p.tick(1000); p.game.feedback(set, 'helpful');
  for (let i = 0; i < 5; i += 1) practise(p);
  const events = p.game.events(), now = p.now;
  const kept = Ledger.plan(events, { keep: 0, olderThan: now + 1, respondedBefore: now - 30 * DAY });
  assert.ok(kept.kept.some(e => e.id === set.completionId));
  assert.ok(!kept.folded.some(e => e.type === 'feedback.given'));
  const folded = Ledger.plan(events, { keep: 0, olderThan: now + 1, respondedBefore: now + 1 });
  assert.ok(folded.folded.some(e => e.id === set.completionId) && folded.folded.some(e => e.type === 'feedback.given'));
  // Without the window a caller from before responses never folds a responded set.
  assert.ok(Ledger.plan(events, { keep: 0, olderThan: now + 1 }).kept.some(e => e.type === 'feedback.given'));
});

// The ledger as it was before this change: no feedback.given among foldable entries and no completionId in
// reference(). Built from today's source by undoing exactly those two lines, so it tracks every other rule.
function ledgerBefore() {
  const file = require.resolve('../atlas/learning-ledger');
  let source = fs.readFileSync(file, 'utf8');
  const swap = (from, to) => { assert.equal(source.split(from).length, 2, `one ${from}`); source = source.replace(from, to); };
  swap("'record.excluded', 'feedback.given',", "'record.excluded',");
  swap('e?.targetId ?? e?.completionId', 'e?.targetId');
  const old = new Module(file, module); old.filename = file; old.paths = Module._nodeModulePaths(path.dirname(file));
  old._compile(source, file);
  return old.exports;
}
function gameWithLedger(ledger) {
  const ledgerPath = require.resolve('../atlas/learning-ledger'), gamePath = require.resolve('../atlas/game-learning');
  const saved = { ledger: require.cache[ledgerPath], game: require.cache[gamePath] };
  try {
    delete require.cache[gamePath];
    require.cache[ledgerPath] = { id: ledgerPath, filename: ledgerPath, loaded: true, exports: ledger };
    return require('../atlas/game-learning').createGame;
  } finally {
    require.cache[ledgerPath] = saved.ledger; require.cache[gamePath] = saved.game;
  }
}

test('the folding rule from before (talk app, cached WORLD) keeps a responded set and never refuses the log', () => {
  const before = ledgerBefore();
  assert.ok(!before.FOLDABLE.includes('feedback.given'));
  const oldGame = gameWithLedger(before);
  // The same history arrives at an old client (here: built by the new code, then opened and folded by the old rule).
  const p = player();
  const { set, response } = longHistory(p, { exclude: true });
  const storage = memory();
  storage.setItem('synk.atlas.learning.v1.device', JSON.stringify({ version: 1, epoch: 'old-client', events: p.game.events() }));
  const old = player({ storage, factory: oldGame }); old.at(p.now + 1000);
  const errors = [];
  old.game.syncPort.subscribe(change => { if (change.kind === 'storage-error') errors.push(change.code); });
  for (let i = 0; i < 300; i += 1) practise(old);
  old.tick(40 * DAY);
  for (let i = 0; i < 300; i += 1) practise(old);
  assert.deepEqual(errors, []);
  assert.equal(old.game.summary().storage.available, true);
  const ids = new Set(old.game.events().map(e => e.id));
  for (const id of [set.decisionId, set.completionId, response.id]) assert.ok(ids.has(id), `${id} is kept by the old rule`);
  // Without the decision on the response the old rule would have folded the set away and refused the log.
  const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };
  const bare = p.game.events().map(e => (e.id === response.id ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'decisionId')) : e));
  const planned = before.plan(bare, { keep: 0, olderThan: p.now + DAY });
  assert.ok(planned.folded.some(e => e.id === set.completionId) && planned.kept.some(e => e.id === response.id));
  assert.throws(() => Atlas.createSession({ scope, events: planned.kept }), /prior completion/);
});

test('another tab folded a responded set: the response and a late exclusion of it leave this tab without an error', () => {
  const shared = memory(), fold = { max: 60, keep: 30, ageMs: 0 };
  const a = player({ storage: shared, fold });
  for (let i = 0; i < 10; i += 1) practise(a);
  const set = a.game.finishSet({ kind: 'short' }); a.tick(1000);
  const response = a.game.feedback(set, 'helpful');
  // Tab B reads the log now and works on; its write lands later, over A's (tabs see each other's writes late).
  const late = memory(); for (const [k, v] of shared.data) late.setItem(k, v);
  const b = player({ storage: late, fold }); b.at(a.now + 32 * DAY);
  for (let i = 0; i < 80; i += 1) practise(b);
  assert.ok(!b.game.events().some(e => e.id === set.completionId), 'B folded the set past its response window');
  // A excludes the response after B folded but before B's write reached A.
  a.at(b.now + 3600000);
  const exclusion = a.game.exclude(response.id);
  for (const [k, v] of late.data) shared.setItem(k, v);
  // A refreshes: B folded more, so A takes B's log and drops its leftovers of that set, the exclusion included.
  assert.equal(a.game.summary().storage.available, true);
  assert.deepEqual(a.game.setFeedback(), []);
  assert.ok(!a.game.events().some(e => [exclusion.id, response.id, set.completionId].includes(e.id)));
});

test('importEvents skips a response whose set this store already folded, as another device entry', () => {
  const p = player({ storageScope: 'account', accountKey: 'account-1', fold: { remote: true, max: 60, keep: 30, ageMs: 0 } });
  const settleAll = () => p.game.syncPort.settle(p.game.syncPort.ids());
  for (let i = 0; i < 10; i += 1) practise(p);
  const set = p.game.finishSet({ kind: 'diagnostic' });
  settleAll(); p.tick(2 * DAY);
  for (let i = 0; i < 60; i += 1) { practise(p); settleAll(); }
  assert.ok(!p.game.events().some(e => e.id === set.completionId), 'the set without a response folded');
  const late = { schema: 1, scope: { domain: 'LAB', workspace: 'learning', subject: 'device' }, id: 'late-response', type: 'feedback.given',
    completionId: set.completionId, decisionId: set.decisionId, value: 'helpful', at: new Date(p.now).toISOString(), recordedAt: new Date(p.now).toISOString() };
  const result = p.game.syncPort.importEvents([late]);
  assert.deepEqual(result.skipped, ['late-response']);
  assert.equal(p.game.summary().storage.available, true);
});

test('a set this tab just finished waits for its response before it may fold here', () => {
  const p = player({ fold: { max: 40, keep: 20, ageMs: 0 } });
  for (let i = 0; i < 10; i += 1) practise(p);
  const set = p.game.finishSet({ kind: 'short' });
  for (let i = 0; i < 60; i += 1) practise(p);
  assert.ok(p.game.events().some(e => e.id === set.completionId), 'kept while its result screen may still answer');
  p.tick(1000); assert.ok(p.game.feedback(set, 'want_more'));
});

test('set entries leave item cells, exposure and recommendations as they were', () => {
  const plain = player({ fold: false }), withSets = player({ fold: false }), keys = [];
  for (let i = 0; i < 12; i += 1) {
    const it = item(); keys.push(it.itemKey);
    for (const p of [plain, withSets]) { p.at(START + i * 60000); const pid = p.game.present(it); p.tick(500); p.game.answer(pid, { correct: i % 3 !== 0, assessable: true }); }
    if (i % 4 === 3) { const set = withSets.game.finishSet({ kind: ['short', 'diagnostic', 'mock'][i % 3] }); withSets.tick(500); withSets.game.feedback(set, 'not_fit'); }
  }
  for (const p of [plain, withSets]) p.at(START + 13 * 60000);
  // Event ids are random per log, so they are compared as placeholders.
  const anon = value => JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'string' && /^a[0-9a-z]+-[0-9a-z]+-[0-9a-z]+$/.test(v) ? 'ID' : v)));
  const a = plain.game.summary(), b = withSets.game.summary();
  assert.ok(JSON.stringify(anon(b.skills)) === JSON.stringify(anon(a.skills)), 'item cells unchanged');
  assert.ok(JSON.stringify(anon(b.concepts)) === JSON.stringify(anon(a.concepts)), 'content cells unchanged');
  assert.ok(JSON.stringify(anon(b.counts)) === JSON.stringify(anon(a.counts)), 'counts unchanged');
  // Items this test presented (first and last) and one it never did.
  for (const itemKey of [keys[0], keys.at(-1), 'never.shown']) assert.deepEqual(withSets.game.exposure({ itemKey }), plain.game.exposure({ itemKey }));
  assert.deepEqual(plain.game.exposure({ itemKey: keys[0] }), { seen: true });
  const candidates = [{ id: 'c1', itemKey: 'new.1', skillIds: ['ko.reading.detail'], modality: 'reading', difficulty: 1, responseFormat: 'single-choice' }];
  const strip = ({ storage, ...rest }) => JSON.stringify(anon(rest));
  assert.ok(strip(withSets.game.recommend(candidates)) === strip(plain.game.recommend(candidates)), 'recommendation unchanged');
  assert.deepEqual(kinds(withSets.game.events())['practice.presented'], kinds(plain.game.events())['practice.presented']);
});

// Backend review 10-22 (Argon A1·A2): the folded-or-not reading and the synchroniser's view of what this log dropped.
const SCOPE = { domain: 'LAB', workspace: 'learning', subject: 'device' };
const copyOf = storage => { const copy = memory(); for (const [k, v] of storage.data) copy.setItem(k, v); return copy; };
test('a synchronised store lists the responses it drops as orphans among its dropped entries, so a sync never takes them for lost', () => {
  const shared = memory(), opts = { storageScope: 'account', accountKey: 'account-1', fold: { remote: true, max: 60, keep: 30, ageMs: 0 } };
  const a = player({ storage: shared, ...opts });
  for (let i = 0; i < 5; i += 1) practise(a);
  const set = a.game.finishSet({ kind: 'short' }); a.tick(1000);
  const response = a.game.feedback(set, 'helpful');
  a.game.syncPort.settle(a.game.syncPort.ids());
  const late = copyOf(shared), b = player({ storage: late, ...opts }); b.at(a.now + 32 * DAY);
  for (let i = 0; i < 80; i += 1) { practise(b); b.game.syncPort.settle(b.game.syncPort.ids()); }
  assert.ok(!b.game.events().some(e => e.id === set.completionId), 'B folded the set past its response window');
  a.at(b.now + 3600000);
  const exclusion = a.game.exclude(response.id);
  for (const [k, v] of late.data) shared.setItem(k, v);
  assert.equal(a.game.summary().storage.available, true);
  assert.ok(!a.game.events().some(e => e.id === exclusion.id));
  assert.ok(a.game.syncPort.dropped().includes(exclusion.id), 'the dropped orphan is not a lost entry');
});

test('an old entry of a set the other tab still keeps is not taken for folded there: items fold whole', () => {
  const shared = memory(), fold = { max: 60, keep: 30, ageMs: 0 };
  const a = player({ storage: shared, fold });
  for (let i = 0; i < 5; i += 1) practise(a);
  const set = a.game.finishSet({ kind: 'short' }); a.tick(1000);
  const first = a.game.feedback(set, 'helpful');
  // B works on and folds the later items; the responded set stays in its log, behind its cutoff.
  const late = copyOf(shared), b = player({ storage: late, fold }); b.at(a.now + 2 * DAY);
  for (let i = 0; i < 80; i += 1) practise(b);
  assert.ok(b.game.events().some(e => e.id === set.completionId), 'B keeps the responded set');
  // Meanwhile A takes another device's change of that answer from the server: an old entry, half a minute after the first.
  const at = new Date(Date.parse(first.at) + 30000).toISOString();
  a.game.syncPort.importEvents([{ schema: 1, scope: SCOPE, id: 'other-device-change', type: 'feedback.given', completionId: set.completionId, decisionId: set.decisionId, value: 'too_much', at, recordedAt: at }]);
  for (const [k, v] of late.data) shared.setItem(k, v);
  a.at(b.now + 1000);
  assert.deepEqual(a.game.setFeedback().map(f => [f.id, f.value]), [['other-device-change', 'too_much']]);
});

test('a set takes a response for a day after it ends', () => {
  const p = player();
  practise(p);
  const set = p.game.finishSet({ kind: 'mock' });
  p.tick(DAY - 1000); assert.ok(p.game.feedback(set, 'helpful'));
  p.tick(2000); assert.throws(() => p.game.feedback(set, 'not_fit'), e => e.code === 'SET_UNAVAILABLE');
});

// Backend review 10-22, second round (Argon A1·A2).
test('the synchroniser lets go of a queued entry the log dropped as an orphan instead of blocking', () => {
  const { createLearningSync } = require('../atlas/learning-sync');
  let events = [{ id: 'kept-entry' }, { id: 'orphan-response' }], dropped = [], listener = null, forgotten = [];
  const port = { scope: 'account', accountKey: 'account-1', events: () => events, ids: () => events.map(e => e.id), partial: () => false,
    dropped: () => dropped, forget: ids => { forgotten.push(...ids); dropped = dropped.filter(id => !ids.includes(id)); return true; },
    subscribe: fn => { listener = fn; return () => {}; }, markComplete() {}, importEvents: () => ({ added: 0, skipped: [] }), settle: () => true };
  const transport = { get: async () => assert.fail('no pull here'), post: async () => assert.fail('no upload here') };
  const sync = createLearningSync({ adapter: { syncPort: port }, accountKey: 'account-1', revision: 1, storage: memory(), transport, auto: false });
  assert.equal(sync.status().queued, 2);
  // Another tab folded the set: the log dropped the queued response as an orphan and says so.
  events = [{ id: 'kept-entry' }]; dropped = ['orphan-response'];
  listener({ kind: 'append' });
  assert.notEqual(sync.status().phase, 'blocked');
  assert.equal(sync.status().queued, 1);
  assert.deepEqual(forgotten, ['orphan-response']);
});

test('items fold whole down a chain: an older answer and its exclusion stay with a set the other tab keeps', () => {
  const shared = memory(), fold = { max: 60, keep: 30, ageMs: 0 };
  const a = player({ storage: shared, fold });
  for (let i = 0; i < 5; i += 1) practise(a);
  const set = a.game.finishSet({ kind: 'short' }); a.tick(1000);
  const first = a.game.feedback(set, 'helpful');
  const late = copyOf(shared), b = player({ storage: late, fold }); b.at(a.now + 2 * DAY);
  for (let i = 0; i < 80; i += 1) practise(b);
  // A takes from the server an older app's answer to that set (no decisionId — it belongs to the completion) and its exclusion.
  const at = s => new Date(Date.parse(first.at) + s * 1000).toISOString();
  a.game.syncPort.importEvents([
    { schema: 1, scope: SCOPE, id: 'older-app-answer', type: 'feedback.given', completionId: set.completionId, value: 'too_much', at: at(10), recordedAt: at(10) },
    { schema: 1, scope: SCOPE, id: 'older-app-exclusion', type: 'record.excluded', targetId: 'older-app-answer', at: at(20), recordedAt: at(20) }]);
  assert.deepEqual(a.game.setFeedback(), [], 'the latest answer is excluded');
  for (const [k, v] of late.data) shared.setItem(k, v);
  a.at(b.now + 1000);
  assert.deepEqual(a.game.setFeedback(), [], 'the exclusion stays with its answer after the merge');
  assert.ok(a.game.events().some(e => e.id === 'older-app-exclusion'));
});

// Backend review 10-22, third round (GPT GA1).
test('a queued response a merge removes with the set the other tab folded is accounted for among dropped entries', () => {
  const shared = memory(), opts = { storageScope: 'account', accountKey: 'account-1', fold: { remote: true, max: 60, keep: 30, ageMs: 0 } };
  const a = player({ storage: shared, ...opts });
  for (let i = 0; i < 5; i += 1) practise(a);
  const set = a.game.finishSet({ kind: 'short' });
  a.game.syncPort.settle(a.game.syncPort.ids());
  const late = copyOf(shared); // B's copy from before the response
  a.tick(1000);
  const response = a.game.feedback(set, 'helpful'); // still queued: not on the server
  const b = player({ storage: late, ...opts }); b.at(a.now + 2 * DAY);
  for (let i = 0; i < 80; i += 1) { practise(b); b.game.syncPort.settle(b.game.syncPort.ids()); }
  assert.ok(!b.game.events().some(e => e.id === set.completionId), 'B folded the set it saw without a response');
  for (const [k, v] of late.data) shared.setItem(k, v);
  a.at(b.now + 1000);
  assert.equal(a.game.summary().storage.available, true);
  assert.ok(!a.game.events().some(e => e.id === response.id));
  assert.ok(a.game.syncPort.dropped().includes(response.id), 'a sync lets it go instead of blocking on it');
});
