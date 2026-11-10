'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { createGame, createLearningSync, KEY } = require('../atlas/game-learning');
const { createPages, encodePage, decodePage, PAGE_ITEMS } = require('../atlas/learning-pages');
const { SYNC_KEY } = require('../atlas/learning-sync');
const Atlas = require('../atlas/engine');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' }, at = '2026-08-01T00:00:00.000Z';
const row = (id, type, fields = {}) => ({ schema: 1, id, type, scope, at, recordedAt: at, ...fields });
const disk = (limit = Infinity) => { const data = new Map(), writes = []; let chars = 0; return { data, writes, get length(){return data.size;}, key:index=>[...data.keys()][index]??null, getItem: k => data.get(k) ?? null, setItem(k, v) {
  const next = chars - (data.has(k) ? k.length + data.get(k).length : 0) + k.length + v.length;
  if (next > limit) throw Object.assign(Error('synthetic browser quota'), { name: 'QuotaExceededError' });
  writes.push({ key: k, bytes: v.length }); data.set(k, v); chars = next;
}, removeItem(k) { if (data.has(k)) chars -= k.length + data.get(k).length; return data.delete(k); } }; };
const game = (storage, accountKey = 'synthetic', clock = () => '2026-10-18T00:00:00.000Z', fold = { remote: true }) => createGame({ gameId: 'pages', map, storage, storageScope: 'account', accountKey, historyComplete: false, clock, fold });
// The reading a whole, never-folded log gives (Core skills · concepts): a folded store must read the same (learning-ledger.js).
const reading = coach => { const { skills, concepts, independent } = coach.summary(); return { skills, concepts, independent }; };
// A complete history (as a synchronised store is once the server has sent everything), never folded.
const wholeReading = (events, clock) => { const whole = createGame({ gameId: 'pages', map, storage: disk(), storageScope: 'account', accountKey: 'synthetic', historyComplete: true, clock, fold: false });
  whole.syncPort.importEvents(events); return reading(whole); };
const foldedCount = storage => JSON.parse(storage.getItem(KEY + '.device')).data.ledger?.folded || 0;
test('a valid older paged root cannot make an unchanged local log skip restoring its newer practice',()=>{
 const storage=disk(),current=game(storage);current.syncPort.importEvents(Array.from({length:240},(_,i)=>graph(i)).flat());const older=[...storage.data];
 current.syncPort.importEvents(graph(10000));const wanted=current.events().map(e=>e.id);for(const [key,value]of older)storage.setItem(key,value);
 assert.equal(current.flush(),true);const restored=game(storage),ids=new Set(restored.events().map(e=>e.id));for(const id of wanted)assert.ok(ids.has(id),'A valid older root lost '+id);assert.equal(ids.size,wanted.length);restored.dispose();current.dispose();
});
function graph(n) {
  const d = row('d' + n, 'decision.made', { experienceId: 'practice', variant: 'standard', policy: Atlas.VERSION, evidence: [] });
  const p = row('p' + n, 'practice.presented', { decisionId: d.id, taskId: 'task', taskVersion: '1', itemKey: 'i' + n, conceptIds: ['ko.reading.detail'], firstExposure: true,
    measure: { skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, familyKey: 'f' + n, audioRequired: false, confounded: false, responseFormat: 'single-choice' } });
  const a = row('a' + n, 'practice.attempted', { presentationId: p.id, attemptNo: 1, verdict: 'correct', errorTags: [] });
  const c = row('c' + n, 'experience.completed', { decisionId: d.id, experienceId: 'practice', variant: 'standard' }); return [d, p, a, c];
}
function network(events) {
  const calls = { get: [], post: 0 };
  return { calls, get: async ({ after }) => { calls.get.push(after); return { revision: 1, events: events.slice(after, after + 200), cursor: Math.min(events.length, after + 200), hasMore: after + 200 < events.length }; },
    post: async ({ events }) => { calls.post++; return { revision: 1, accepted: events.map(e => e.id) }; } };
}
const syncFor = (adapter, storage, transport, extra = {}) => createLearningSync({ adapter, storage, transport, accountKey: 'synthetic', revision: 1, auto: false, maxAttempts: 1, ...extra });

test('unchanged paged history flushes without a quota write, including after reopening',()=>{
  const storage=disk(),adapter=game(storage),events=Array.from({length:300},(_,n)=>graph(n)).flat();adapter.syncPort.importEvents(events);
  assert.equal(JSON.parse(storage.getItem(KEY+'.device')).paged,1);const before=storage.writes.length,write=storage.setItem;let attempts=0;
  storage.setItem=()=>{attempts++;throw Object.assign(Error('synthetic full origin'),{name:'QuotaExceededError'});};
  assert.equal(adapter.flush(),true);const restored=game(storage);assert.equal(restored.flush(),true);assert.equal(attempts,0);assert.equal(storage.writes.length,before);assert.deepEqual(restored.syncPort.events(),events);
  storage.setItem=write;restored.syncPort.importEvents(graph(300));assert.ok(storage.writes.length>before,'a changed log still persists');const after=storage.writes.length;assert.equal(restored.flush(),true);assert.equal(storage.writes.length,after);
});

test('withdrawn history with no measured independent response stays no_sample',()=>{
  const storage=disk(),ledger={...require('../atlas/learning-ledger').empty(),adjusted:1};
  storage.setItem(KEY+'.device',JSON.stringify({version:1,epoch:'synthetic.empty',events:[],owner:'synthetic',ledger}));
  const result=game(storage).summary();assert.equal(result.counts.status,'no_sample');assert.equal(result.counts.approximate,true);assert.equal(result.counts.independent.evaluated,0);
});

// 11-10(Atlas 검수 결함 2): 복원이 끝나기 전에는 완전한 인과 로그를 페이지에 두고, 서버가 다 보낸 뒤에는 다른 저장소처럼 접는다 —
// 둘째 기기가 이력 전체를 영영 들고 다니지 않게. 읽기는 접지 않은 전체 로그와 같아야 한다(늦은 부모 연결 셋 포함).
test('more than 20000 events restore within a 5 MiB character quota with late parent links preserved, then fold once complete', async () => {
  const events = Array.from({ length: 5001 }, (_, n) => graph(n)).flat();
  events.push(row('late-a', 'practice.attempted', { presentationId: 'p0', attemptNo: 2, verdict: 'incorrect', errorTags: [] }),
    row('late-f', 'feedback.given', { completionId: 'c0', value: 'helpful' }), row('late-x', 'record.excluded', { targetId: 'a0' }));
  // 기록 아흐레 뒤: Core가 읽는 30일 안이고, 동기화 저장소가 접는 하루는 지났다.
  const clock = () => '2026-08-10T00:00:00.000Z';
  const storage = disk(5 * 1024 ** 2), adapter = game(storage, 'synthetic', clock), transport = network(events), sync = syncFor(adapter, storage, transport);
  const status = await sync.start(); assert.equal(status.phase, 'synced'); assert.equal(status.complete, true); assert.equal(status.cursor, events.length); assert.equal(transport.calls.post, 0);
  const root = JSON.parse(storage.getItem(KEY + '.device')); assert.equal(root.paged, 1); assert.ok(root.arrays.events.every(p => p.count <= PAGE_ITEMS));
  const kept = adapter.syncPort.events(), whole = wholeReading(events, clock);
  assert.ok(root.data.ledger.folded > 0); assert.ok(kept.length <= 600, `kept ${kept.length}`); assert.equal(kept.length + root.data.ledger.folded, events.length, 'every entry once, kept or folded');
  assert.deepEqual(reading(adapter), whole); assert.ok(!JSON.stringify(whole).includes('"a0"'), 'the late exclusion removes a0 from the evidence');
  sync.stop(); const restored = game(storage, 'synthetic', clock), resumed = syncFor(restored, storage, transport); await resumed.start();
  assert.equal(resumed.status().complete, true); assert.deepEqual(reading(restored), whole);
  const before = storage.writes.length; restored.syncPort.importEvents(restored.syncPort.events().slice(-3)); assert.equal(storage.writes.length, before, 'exact durable retry of kept entries performs no writes'); resumed.stop();
});

test('a restore that is not complete yet keeps its whole causal log in pages', async () => {
  const events = Array.from({ length: 350 }, (_, n) => graph(n)).flat(), storage = disk(), transport = network(events);
  const sync = syncFor(game(storage, 'synthetic', () => '2026-08-10T00:00:00.000Z'), storage, transport, { maxPages: 6 });
  const status = await sync.start(); assert.equal(status.complete, false); assert.equal(status.cursor, 1200); assert.equal(foldedCount(storage), 0);
  assert.equal(JSON.parse(storage.getItem(KEY + '.device')).arrays.events.reduce((n, p) => n + p.count, 0), 1200); sync.stop();
});

test('page budget yields at its committed cursor and a fresh instance resumes before uploading', async () => {
  const events = Array.from({ length: 310 }, (_, n) => graph(n)).flat(), storage = disk(), transport = network(events);
  let sync = syncFor(game(storage), storage, transport, { maxPages: 2 });
  assert.equal((await sync.start()).cursor, 400); assert.equal(sync.status().phase, 'offline'); assert.equal(sync.status().code, 'INCOMPLETE_HISTORY'); assert.equal(sync.status().complete, false); sync.stop();
  sync = syncFor(game(storage), storage, transport, { maxPages: 2 });
  assert.equal((await sync.start()).cursor, 800); assert.equal(sync.status().phase, 'offline'); assert.equal(sync.status().code, 'INCOMPLETE_HISTORY'); assert.equal(sync.status().complete, false); assert.equal(transport.calls.post, 0);
  await sync.retry(); const complete = await sync.retry(); assert.equal(complete.cursor, 1240); assert.equal(complete.complete, true); assert.equal(complete.phase, 'synced'); sync.stop();
});

test('automatic continuation completes beyond maxPages without an extra click or premature completion', async () => {
  const events = Array.from({ length: 125 }, (_, n) => graph(n)).flat(), storage = disk(), transport = network(events);
  let finish; const done = new Promise(resolve => { finish = resolve; });
  const sync = syncFor(game(storage), storage, transport, { auto: true, maxPages: 1, onStatus: value => { if (value.phase === 'synced') finish(value); } });
  await sync.start(); const result = await Promise.race([done, new Promise((_, reject) => { const t = setTimeout(() => reject(Error('continuation did not run')), 3000); t.unref(); })]);
  assert.equal(result.complete, true); assert.equal(result.cursor, 500); sync.stop();
});

test('legacy history migrates without changing its epoch, account owner or events', () => {
  const storage = disk(), adapter = game(storage), first = graph(0); adapter.syncPort.importEvents(first);
  const before = JSON.parse(storage.getItem(KEY + '.device')); assert.equal(before.version, 1); assert.equal(before.paged, undefined);
  const more = Array.from({ length: 260 }, (_, n) => graph(n + 1)).flat(); adapter.syncPort.importEvents(more);
  const root = JSON.parse(storage.getItem(KEY + '.device')); assert.equal(root.data.epoch, before.epoch); assert.equal(root.data.owner, before.owner);
  assert.deepEqual(game(storage).syncPort.events(), [...first, ...more]);
  assert.throws(() => game(storage, 'different').syncPort.events(), /durable/);
});

test('quota interruption before root publication keeps the old cursor and pages recoverable', async () => {
  const events = Array.from({ length: 350 }, (_, n) => graph(n)).flat(), storage = disk(), transport = network(events);
  let sync = syncFor(game(storage), storage, transport, { maxPages: 6 }); await sync.start(); assert.equal(sync.status().cursor, 1200);
  const oldRoot = storage.getItem(KEY + '.device'), oldSync = storage.getItem(SYNC_KEY + '.synthetic'), original = storage.setItem;
  storage.setItem = function (key, value) { if (key === KEY + '.device') throw Error('synthetic quota'); original.call(this, key, value); };
  const result = await sync.retry(); assert.equal(result.phase, 'blocked'); assert.equal(result.complete, false); assert.equal(storage.getItem(KEY + '.device'), oldRoot); assert.equal(storage.getItem(SYNC_KEY + '.synthetic'), oldSync);
  storage.setItem = original; sync.stop(); sync = syncFor(game(storage), storage, transport); const resumed = await sync.start(); assert.equal(resumed.complete, true); assert.equal(resumed.cursor, 1400); sync.stop();
});

test('history durable but outbox publication interrupted: retry reimports exactly once after restart', async () => {
  const events = Array.from({ length: 350 }, (_, n) => graph(n)).flat(), storage = disk(), transport = network(events);
  let sync = syncFor(game(storage), storage, transport, { maxPages: 6 }); await sync.start(); const original = storage.setItem, old = storage.getItem(SYNC_KEY + '.synthetic');
  storage.setItem = function (key, value) { if (key === SYNC_KEY + '.synthetic') throw Error('synthetic cursor failure'); original.call(this, key, value); };
  assert.equal((await sync.retry()).phase, 'blocked'); assert.equal(storage.getItem(SYNC_KEY + '.synthetic'), old); storage.setItem = original; sync.stop();
  const restored = game(storage); sync = syncFor(restored, storage, transport); assert.equal((await sync.start()).complete, true); assert.equal(transport.calls.post, 0);
  // Complete now, the store folds (11-10): exactly once means no entry twice and none lost — kept or folded.
  const kept = restored.syncPort.events(); assert.equal(new Set(kept.map(e => e.id)).size, kept.length); assert.equal(kept.length + foldedCount(storage), events.length); sync.stop();
});

test('page corruption is visible, and stale root writers preserve the newer durable root', () => {
  const storage = disk(), first = createPages(storage, 'owned', ['events']), data = { events: Array.from({ length: 260 }, (_, i) => ({ id: i })) };
  const initial = first.write(data, null), stale = createPages(storage, 'owned', ['events']); stale.decode(initial);
  const newer = first.write({ events: [...data.events, { id: 261 }] }, initial);
  assert.throws(() => stale.write({ events: [...data.events, { id: 999 }] }, initial), /changed/); assert.equal(storage.getItem('owned'), newer);
  const root = JSON.parse(newer); storage.data.delete(root.arrays.events[0].key);
  assert.throws(() => createPages(storage, 'owned', ['events']).decode(newer), /unreadable/);
});

test('a tab created before another tab advances its outbox merges the durable cursor without blocking', async () => {
  const events = Array.from({ length: 300 }, (_, n) => graph(n)).flat(), storage = disk(), transport = network(events);
  const initial = syncFor(game(storage), storage, transport); await initial.start(); initial.stop();
  const first = syncFor(game(storage), storage, transport), second = syncFor(game(storage), storage, transport);
  events.push(...graph(300));
  assert.equal((await first.start()).cursor, 1204);
  const restored = await second.start(); assert.equal(restored.phase, 'synced'); assert.equal(restored.complete, true); assert.equal(restored.cursor, 1204);
  assert.equal((await second.retry()).phase, 'synced'); assert.equal(transport.calls.post, 0); first.stop(); second.stop();
});

test('a reader whose old root tail was retired retries the newly published root without reviving old pages', () => {
  const storage = disk(), writer = createPages(storage, 'race', ['events']), old = { events: Array.from({ length: 130 }, (_, id) => ({ id })) };
  const oldRaw = writer.write(old, null), oldPage = JSON.parse(oldRaw).arrays.events[0].key;
  const changed = { events: [{ id: 'new' }, ...old.events.slice(1)] }, nextRaw = writer.write(changed, oldRaw);
  assert.equal(storage.getItem(oldPage), null);
  const reader = createPages(storage, 'race', ['events']); assert.deepEqual(reader.decode(oldRaw), changed); assert.equal(reader.decodedRaw(), nextRaw);
  assert.equal(storage.getItem(oldPage), null);
});

test('page codec preserves nested JSON values and legacy pages, and rejects broken references', () => {
  const rows = Array.from({ length: 32 }, (_, n) => ({ repeated: '반복 문자열', nested: { a: null, b: true, c: false, n, empty: '', array: [1, '반복 문자열', ['x']] } }));
  rows.push(JSON.parse('{"__proto__":{"safe":true},"constructor":"literal"}'));
  const encoded = encodePage(rows); assert.ok(encoded.length < JSON.stringify(rows).length); assert.deepEqual(decodePage(encoded), rows);
  assert.deepEqual(decodePage(JSON.stringify(rows)), rows); assert.equal(Object.prototype.safe, undefined);
  const packed = JSON.parse(encoded); packed.entries[0] = [2, packed.strings.length]; assert.throws(() => decodePage(JSON.stringify(packed)), /unreadable/);
  packed.entries[0] = [1, 0, null, 0, true]; assert.throws(() => decodePage(JSON.stringify(packed)), /unreadable/);
});
