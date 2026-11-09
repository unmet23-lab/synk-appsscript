// tests/atlas-learning-pages.test.js의 두 시험을 결함 2 고침(이력이 다 모인 페이지 꼴도 접는다)에 맞춘다. 첫 인자 = 저장소 뿌리.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'tests/atlas-learning-pages.test.js');
let text = fs.readFileSync(file, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const swap = (from, to) => { from = from.replace(/\n/g, eol); to = to.replace(/\n/g, eol); const at = text.indexOf(from); if (at < 0 || text.indexOf(from, at + 1) >= 0) throw Error(`조각: ${from.slice(0, 90)}`); text = text.slice(0, at) + to + text.slice(at + from.length); };
swap("const game = (storage, accountKey = 'synthetic') => createGame({ gameId: 'pages', map, storage, storageScope: 'account', accountKey, historyComplete: false, clock: () => '2026-10-18T00:00:00.000Z', fold: { remote: true } });",
  "const game = (storage, accountKey = 'synthetic', clock = () => '2026-10-18T00:00:00.000Z', fold = { remote: true }) => createGame({ gameId: 'pages', map, storage, storageScope: 'account', accountKey, historyComplete: false, clock, fold });\n" +
  "// The reading a whole, never-folded log gives (Core skills · concepts): a folded store must read the same (learning-ledger.js).\n" +
  "const reading = coach => { const { skills, concepts, independent } = coach.summary(); return { skills, concepts, independent }; };\n" +
  "// A complete history (as a synchronised store is once the server has sent everything), never folded.\n" +
  "const wholeReading = (events, clock) => { const whole = createGame({ gameId: 'pages', map, storage: disk(), storageScope: 'account', accountKey: 'synthetic', historyComplete: true, clock, fold: false });\n" +
  "  whole.syncPort.importEvents(events); return reading(whole); };\n" +
  "const foldedCount = storage => JSON.parse(storage.getItem(KEY + '.device')).data.ledger?.folded || 0;");
swap(`test('more than 20000 events restore within a 5 MiB character quota with late parent links preserved', async () => {
  const events = Array.from({ length: 5001 }, (_, n) => graph(n)).flat();
  events.push(row('late-a', 'practice.attempted', { presentationId: 'p0', attemptNo: 2, verdict: 'incorrect', errorTags: [] }),
    row('late-f', 'feedback.given', { completionId: 'c0', value: 'helpful' }), row('late-x', 'record.excluded', { targetId: 'a0' }));
  const storage = disk(5 * 1024 ** 2), adapter = game(storage), transport = network(events), sync = syncFor(adapter, storage, transport);
  const status = await sync.start(); assert.equal(status.phase, 'synced'); assert.equal(status.complete, true); assert.equal(status.cursor, events.length); assert.equal(transport.calls.post, 0);
  assert.deepEqual(adapter.syncPort.events(), events);
  const root = JSON.parse(storage.getItem(KEY + '.device')); assert.equal(root.paged, 1); assert.ok(root.arrays.events.every(p => p.count <= PAGE_ITEMS)); assert.equal(root.data.ledger, undefined);
  sync.stop(); const restored = game(storage), resumed = syncFor(restored, storage, transport); await resumed.start();
  assert.deepEqual(restored.syncPort.events(), events); assert.equal(resumed.status().complete, true);
  assert.deepEqual(Atlas.createSession({ scope, events: restored.syncPort.events(), clock: () => at }).state(), Atlas.createSession({ scope, events, clock: () => at }).state());
  const before = storage.writes.length; restored.syncPort.importEvents(events.slice(-3)); assert.equal(storage.writes.length, before, 'exact durable retry performs no writes'); resumed.stop();
});`,
`// 11-10(Atlas 검수 결함 2): 복원이 끝나기 전에는 완전한 인과 로그를 페이지에 두고, 서버가 다 보낸 뒤에는 다른 저장소처럼 접는다 —
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
  assert.ok(root.data.ledger.folded > 0); assert.ok(kept.length <= 600, \`kept \${kept.length}\`); assert.equal(kept.length + root.data.ledger.folded, events.length, 'every entry once, kept or folded');
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
});`);
swap(`  const restored = game(storage); sync = syncFor(restored, storage, transport); assert.equal((await sync.start()).complete, true); assert.deepEqual(restored.syncPort.events(), events); assert.equal(transport.calls.post, 0); sync.stop();`,
`  const restored = game(storage); sync = syncFor(restored, storage, transport); assert.equal((await sync.start()).complete, true); assert.equal(transport.calls.post, 0);
  // Complete now, the store folds (11-10): exactly once means no entry twice and none lost — kept or folded.
  const kept = restored.syncPort.events(); assert.equal(new Set(kept.map(e => e.id)).size, kept.length); assert.equal(kept.length + foldedCount(storage), events.length); sync.stop();`);
fs.writeFileSync(file, text);
console.log('고침 tests/atlas-learning-pages.test.js');
