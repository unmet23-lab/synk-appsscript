'use strict';
// Stage 1 scheduled run (STAGE1_DESIGN.md 4.2): runOnce decides and reports one
// run; exit 11 is "busy" (no error, no health change); stale locks are unlocked first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { BackupEngine, VERIFIED, DAY, errorItems, walkOdd, stillThere, oddReads, topMost } = require('../src/engine.cjs');
const secretStore = { encrypt: text => Buffer.from('fixture-only:' + text), decrypt: bytes => bytes.toString().slice(13) };

async function fixture({ provider = 'local', folders = 1 } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-runonce-'));
  const source = path.join(root, 'source'), target = path.join(root, 'target'), keys = path.join(root, 'keys');
  const more = Array.from({ length: folders - 1 }, (_, i) => path.join(root, `source${i + 2}`));
  await Promise.all([source, target, keys, ...more].map(p => fs.mkdir(p)));
  await fs.writeFile(path.join(source, 'work.txt'), 'hello');
  let now = Date.now(); const calls = [], snapshots = [], seen = {}, stdin = []; const fail = { backup: null, check: null, readData: null, items: [], list: null, scan: [] };
  const repositoryId = 'd'.repeat(64);
  const engine = new BackupEngine({ stateDir: path.join(root, 'state'), resticPath: 'fixture', secretStore, now: () => now, intervalMs: 3600000, runner: async (args, opts = {}) => {
    calls.push(args.includes('--stdin') ? 'backup-list' : args[0]); seen[args[0]] = args;
    // 대량 삭제 · 변경 멈춤 (4.4): the comparison before clean-up finds nothing changed.
    if (args[0] === 'diff') { await opts.consumeStdout(require('node:stream').Readable.from([Buffer.from(JSON.stringify({ message_type: 'statistics', changed_files: 0, added: { files: 0, bytes: 0 }, removed: { files: 0, dirs: 0, others: 0, bytes: 0 } }))])); return ''; }
    // Which of its folders a backup holds, as restic answers a listing without recursion: each folder it was given.
    if (args[0] === 'ls' && !args.includes('--recursive')) {
      const s = snapshots.find(x => x.id === args[2]), trees = (s?.paths || []).map(p => '/' + p.replace(/^([A-Za-z]):/, '$1').replaceAll('\\', '/'));
      const nodes = args.slice(3).filter(t => trees.includes(t)).map(t => JSON.stringify({ message_type: 'node', type: 'dir', path: t }));
      await opts.consumeStdout(require('node:stream').Readable.from([Buffer.from(nodes.join('\n'))])); return '';
    }
    const tagged = () => snapshots.push({ id: crypto.randomBytes(32).toString('hex'), time: new Date(now).toISOString(), hostname: engine.config.vaultId, paths: ['/workbackup-unreadable.json'], stdinText: opts.stdinText, tags: args[args.indexOf('--tag') + 1].split(','), summary: { total_files_processed: 1, total_bytes_processed: 5 } });
    // A list snapshot read back (cachedList, when the state folder has no copy).
    if (args[0] === 'dump') { const s = snapshots.find(x => x.id === args[1]); if (s?.stdinText !== undefined) await opts.consumeStdout(require('node:stream').Readable.from([Buffer.from(s.stdinText)])); return ''; }
    // The list of a partial snapshot: its own stdin snapshot (4.2 「완료본 · 부분 판 · 채움 판」).
    if (args[0] === 'backup' && args.includes('--stdin')) { if (fail.list) throw Object.assign(new Error('fixture list'), { exitCode: fail.list }); stdin.push(opts.stdinText); if (!fail.listGhost) tagged(); return ''; }
    if (args[0] === 'cat') return JSON.stringify({ id: repositoryId });
    if (args[0] === 'backup') {
      // A real exit 3 (some files unreadable) still writes a pending snapshot (review B5).
      if (fail.backup && fail.backup !== 3) throw Object.assign(new Error('fixture backup'), { exitCode: fail.backup });
      snapshots.push({ id: crypto.randomBytes(32).toString('hex'), time: new Date(now).toISOString(), hostname: engine.config.vaultId, paths: args.slice(args.indexOf('--') + 1), tags: args[args.indexOf('--tag') + 1].split(','), summary: { total_files_processed: 1, total_bytes_processed: 5 } });
      // What restic told only while counting (4.2 「이 백업에 담지 못하는 이름」), with exit 0 or 3 alike.
      for (const item of fail.scan) opts.onErrorItem?.(item, 'scan');
      if (fail.backup === 3) { for (const item of fail.items) opts.onErrorItem?.(item); throw Object.assign(new Error('fixture partial'), { exitCode: 3 }); }
      return '';
    }
    if (args[0] === 'check' && args.includes('--read-data') && fail.readData) throw Object.assign(new Error('fixture lock'), { exitCode: fail.readData });
    if (args[0] === 'check' && fail.check) throw Object.assign(new Error('fixture lock'), { exitCode: fail.check });
    if (args[0] === 'snapshots') { const tags = args[args.indexOf('--tag') + 1].split(','); return JSON.stringify(snapshots.filter(s => tags.every(t => s.tags.includes(t))).sort((a, b) => Date.parse(b.time) - Date.parse(a.time))); }
    if (args[0] === 'tag') {
      const s = snapshots.find(s => s.id === args.at(-1)), add = [], remove = [];
      for (let i = 1; i < args.length - 1; i++) { if (args[i] === '--add') add.push(args[++i]); else if (args[i] === '--remove') remove.push(args[++i]); }
      s.tags = s.tags.filter(t => !remove.includes(t)).concat(add);
    }
    if (args[0] === 'forget') for (const id of args.slice(1)) snapshots.splice(snapshots.findIndex(s => s.id === id), 1);
    return '';
  } });
  await engine.open();
  if (provider === 'local') {
    await engine.setup({ sources: [source, ...more], parent: target });
    await engine.saveRecoveryKit(path.join(keys, 'kit.json'));
  }
  return { engine, calls, fail, seen, snapshots, stdin, more, advance: ms => { now += ms; }, root };
}

test('not configured, off and read-only are skipped without running restic', async () => {
  const empty = await fixture({ provider: 'none' });
  assert.deepEqual(await empty.engine.runOnce({}), { outcome: 'skipped', reason: 'not-configured' });
  const { engine, calls } = await fixture();
  calls.length = 0;
  assert.deepEqual(await engine.runOnce({}), { outcome: 'skipped', reason: 'off' });
  engine.config.readOnly = true;
  assert.deepEqual(await engine.runOnce({ force: true }), { outcome: 'skipped', reason: 'read-only' }, 'even a person-started run (review B4)');
  engine.config.readOnly = false; engine.config.mode = 'restore';
  assert.deepEqual(await engine.runOnce({ force: true }), { outcome: 'skipped', reason: 'read-only' });
  assert.equal(calls.length, 0);
});

test('first due run unlocks stale locks, then backs up; the next one is not due until 55 minutes', async () => {
  const { engine, calls, advance } = await fixture();
  await engine.setAutomatic(true);
  calls.length = 0;
  const first = await engine.runOnce({});
  assert.equal(first.outcome, 'complete');
  assert.equal(first.newSnapshot, true);
  assert.deepEqual(first.unlock, { ran: true, ok: true });
  assert.equal(calls.indexOf('unlock') < calls.indexOf('backup'), true);
  // Run record fields (4.2 「회차 기록」): restic start time and the snapshot summary.
  assert.equal(typeof first.resticStartedAt, 'number');
  assert.equal(first.files, 1);
  assert.equal(first.filesNew, null, 'the fixture summary has no files_new');
  advance(50 * 60000);
  assert.equal((await engine.runOnce({})).outcome, 'not-due');
  advance(6 * 60000);
  assert.equal((await engine.runOnce({})).outcome, 'complete');
});

test('a forced (person-started) run ignores the due time and the off switch', async () => {
  const { engine } = await fixture();
  assert.equal((await engine.runOnce({ force: true })).outcome, 'complete');
});

test('skipCloud only skips cloud profiles', async () => {
  const { engine } = await fixture();
  await engine.setAutomatic(true);
  assert.equal((await engine.runOnce({ skipCloud: 'battery' })).outcome, 'complete', 'local backup still runs on battery');
  engine.providerType = 'b2';
  const r = await engine.runOnce({ skipCloud: 'metered' });
  engine.providerType = 'local';
  assert.deepEqual(r, { outcome: 'skipped', reason: 'metered' });
});

test('exit 11 is busy: no lastError, no health change', async () => {
  const { engine, fail, advance } = await fixture();
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const health = engine.config.health;
  advance(61 * 60000); fail.check = 11;
  const r = await engine.runOnce({});
  assert.equal(r.outcome, 'busy');
  assert.equal(r.exitCode, 11);
  assert.equal(engine.config.lastError, null);
  assert.deepEqual(engine.config.health, health);
});

test('backups leave online-only cloud files to the cloud on Windows (review GA1)', async () => {
  const { engine, seen } = await fixture();
  await engine.runOnce({ force: true });
  assert.equal(seen.backup.includes('--exclude-cloud-files'), process.platform === 'win32');
});

test('a person-started backup that meets a busy repository leaves a notice, not an error (review GA2)', async () => {
  const { engine, fail } = await fixture();
  const health = engine.config.health;
  fail.check = 11;
  await assert.rejects(engine.backupNow(), e => e.exitCode === 11);
  assert.equal(engine.config.lastError, null);
  assert.match(engine.config.warning, /다른 작업이 백업 저장소를 쓰는 중/);
  assert.deepEqual(engine.config.health, health);
  fail.check = null;
  await engine.backupNow();
  assert.equal(engine.config.warning, null, 'the next successful backup clears the notice');
});

test('a busy full data check keeps the health and the backup still completes (review GA3)', async () => {
  const { engine, fail } = await fixture();
  await engine.setAutomatic(true);
  const health = engine.config.health;
  fail.readData = 11;
  const r = await engine.runOnce({});
  assert.equal(r.outcome, 'complete');
  assert.deepEqual(engine.config.health, health, 'not marked attention');
  assert.match(engine.config.warning, /전체 데이터 점검은 다음 회차로/);
  assert.equal(engine.config.lastError, null);
});

test('exit 3 is partial and is not promoted to a completed backup', async () => {
  const { engine, fail, advance, snapshots } = await fixture();
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const before = engine.config.lastBackup.id;
  advance(61 * 60000); fail.backup = 3;
  const r = await engine.runOnce({});
  assert.equal(r.outcome, 'partial');
  assert.equal(engine.config.lastBackup.id, before);
  const partial = snapshots.at(-1);
  assert.ok(partial.tags.includes('pending') && !partial.tags.includes(VERIFIED), 'the partial snapshot stays pending');
});

test('exit 3 with its list keeps a partial snapshot — the list first — and the complete backup stays the one restored', async () => {
  const { engine, fail, advance, snapshots, calls, stdin } = await fixture();
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const before = engine.config.lastBackup.id;
  advance(61 * 60000); fail.backup = 3; fail.items = ['C:\\work\\mail.pst', 'C:\\work\\open.xlsx']; calls.length = 0;
  const r = await engine.runOnce({});
  assert.deepEqual([r.outcome, r.unreadable, r.newSnapshot], ['partial', 2, true]);
  assert.equal(engine.config.lastBackup.id, before, 'never replaces the complete backup');
  assert.deepEqual(JSON.parse(stdin.at(-1)), { v: 1, unreadable: fail.items, cut: false });
  assert.ok(calls.indexOf('backup-list') < calls.indexOf('tag'), 'the list is saved before the snapshot is marked partial');
  const run = snapshots.at(-2).tags.find(t => t.startsWith('run:'));
  assert.ok(snapshots.at(-2).tags.includes('partial') && !snapshots.at(-2).tags.includes('pending') && !snapshots.at(-2).tags.includes(VERIFIED));
  assert.ok(snapshots.at(-1).tags.includes('meta') && snapshots.at(-1).tags.includes(run), 'the list carries the same run tag');
  assert.deepEqual([engine.config.lastPartial.id, engine.config.lastPartial.unreadable], [snapshots.at(-2).id, 2]);
  assert.match(engine.config.warning, /쓰는 중인 파일 2개를 이번 백업에 담지 못했습니다/);
  assert.doesNotMatch(engine.config.warning, /지킵니다/, 'no promise that an earlier backup holds them (GPT GA2)');
  assert.deepEqual(engine.getState().lastPartial, engine.config.lastPartial);
  // The next complete run clears it.
  advance(61 * 60000); fail.backup = null;
  assert.equal((await engine.runOnce({})).outcome, 'complete');
  assert.equal(engine.config.lastPartial, null);
});

test('a list that cannot be saved — or that leaves no list snapshot — leaves the snapshot pending, never partial', async () => {
  for (const way of ['list', 'listGhost']) {
    const { engine, fail, advance, snapshots } = await fixture();
    await engine.setAutomatic(true);
    await engine.runOnce({});
    advance(61 * 60000); fail.backup = 3; fail.items = ['C:\\work\\mail.pst']; fail[way] = 1;
    const r = await engine.runOnce({});
    assert.equal(r.outcome, 'failed', way);
    assert.ok(snapshots.at(-1).tags.includes('pending') && !snapshots.some(s => s.tags.includes('partial')), way);
    assert.equal(engine.config.lastPartial ?? null, null, way);
  }
});

test('retention keeps the complete backup and the newest newer partial one with its list; the rest go after 24 hours', async () => {
  const { engine, fail, advance, snapshots } = await fixture();
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const complete = engine.config.lastBackup.id;
  fail.backup = 3; fail.items = ['C:\\work\\mail.pst'];
  advance(61 * 60000); await engine.runOnce({});
  advance(61 * 60000); await engine.runOnce({});
  // A third partial run a day later: the complete backup, the newest partial one and its list stay; the two older
  // partial ones and their lists go.
  advance(25 * 3600000); await engine.runOnce({});
  const left = () => snapshots.map(s => s.tags.includes(VERIFIED) ? 'complete' : s.tags.includes('partial') ? 'partial' : s.tags.includes('meta') ? 'meta' : 'pending');
  assert.deepEqual(left(), ['complete', 'partial', 'meta'], left().join());
  assert.equal(snapshots[0].id, complete);
  assert.equal(snapshots[1].id, engine.config.lastPartial.id);
  assert.equal(snapshots[2].tags.find(t => t.startsWith('run:')), snapshots[1].tags.find(t => t.startsWith('run:')), 'its own list');
  // A complete run makes the partial one older than the complete backup: it and its list go after 24 hours.
  fail.backup = null; advance(61 * 60000); await engine.runOnce({});
  advance(25 * 3600000); await engine.runOnce({});
  assert.deepEqual(left(), ['complete'], left().join());
});

test('a newest partial snapshot without exactly one list does not push out a good one (GPT GA1)', async () => {
  const { engine, fail, advance, snapshots } = await fixture();
  await engine.setAutomatic(true);
  await engine.runOnce({});
  fail.backup = 3; fail.items = ['C:\\work\\mail.pst'];
  const runOf = s => s.tags.find(t => t.startsWith('run:'));
  const listOf = s => snapshots.findIndex(x => x.tags.includes('meta') && x.tags.includes(runOf(s)));
  for (const broken of ['none', 'two']) {
    advance(61 * 60000); await engine.runOnce({});
    const good = snapshots.find(s => s.id === engine.config.lastPartial.id), goodList = snapshots[listOf(good)].id;
    advance(61 * 60000); await engine.runOnce({});
    const newest = snapshots.find(s => s.id === engine.config.lastPartial.id), list = listOf(newest);
    if (broken === 'none') snapshots.splice(list, 1); else snapshots.push({ ...snapshots[list], id: crypto.randomBytes(32).toString('hex') });
    advance(25 * 3600000); await engine.retain();
    assert.ok(snapshots.some(s => s.id === good.id) && snapshots.some(s => s.id === goodList), `${broken}: the good partial snapshot and its list stay`);
    assert.ok(!snapshots.some(s => s.id === newest.id), `${broken}: the one without exactly one list goes after 24 hours`);
  }
});

/** A path as written, ends and all: Windows needs the long form for a name ending in a dot or a space. */
const exact = p => process.platform === 'win32' ? '\\\\?\\' + p : p;
// A test that walks many cases, each with its own fixture, takes a minute or more on a busy PC: past the two or three
// minutes a test is given by default (tools/관련시험.js, tools/conditional-qa), it is given ten.
const LONG = 10 * 60 * 1000;

test('a name ending in a dot or a space is told as one the backup cannot hold; the backup stays complete (4.2 「이 백업에 담지 못하는 이름」)', async () => {
  const { engine, fail, advance, calls, snapshots, root } = await fixture();
  const [src] = engine.config.sources, at = (...p) => path.join(src, ...p);
  // Left out (nothing under the name without its end), saved with another's content (beside that name), and one inside
  // a folder: each told once, what is inside such a folder going with it. A link is not followed, as restic does not.
  await fs.writeFile(exact(at('메모.')), 'a');
  await fs.mkdir(exact(at('쌍 폴더.'))); await fs.writeFile(exact(at('쌍 폴더.', '끝 .')), 'b');
  await fs.mkdir(at('쌍 폴더')); await fs.writeFile(exact(at('쌍 폴더', '안쪽 칸 ')), 'c');
  const away = path.join(root, '밖'); await fs.mkdir(away); await fs.writeFile(exact(path.join(away, '밖의 메모.')), 'd');
  await fs.symlink(away, at('연결'), 'junction');
  await engine.setAutomatic(true);
  // restic told one while counting — it may not tell every one (GPT GA2), the walk finds the rest.
  fail.scan = [at('메모.')];
  calls.length = 0;
  const r = await engine.runOnce({});
  const names = [at('메모.'), at('쌍 폴더.'), at('쌍 폴더', '안쪽 칸 ')].sort();
  assert.deepEqual([r.outcome, r.odd, r.unreadable], ['complete', 3, undefined]);
  assert.ok(!calls.includes('backup-list') && engine.config.lastPartial === null, 'no list of files another program holds');
  assert.ok(!calls.includes('find'), 'the folders are read, not the backup');
  assert.equal(engine.config.lastBackup.id, snapshots.find(x => x.tags.includes(VERIFIED)).id);
  assert.deepEqual(engine.getState().leftOutNames, { at: engine.config.lastBackup.at, count: 3, names, cut: false });
  assert.match(engine.config.warning, /이름 끝에 점이나 칸이 있는 파일이나 폴더 3개를 이번 백업에 담지 못했습니다/);
  // An hour on, the walk again: a name renamed goes, and one made since is found though restic tells none (설계 검토 F1).
  fail.scan = [];
  await fs.rename(exact(at('메모.')), at('메모.txt'));
  await fs.writeFile(exact(at('새 메모.')), 'e'); await fs.writeFile(at('새 메모'), 'f');
  advance(61 * 60000);
  const next = await engine.runOnce({});
  assert.deepEqual([next.odd, engine.config.leftOutNames.names], [3, [at('새 메모.'), at('쌍 폴더.'), at('쌍 폴더', '안쪽 칸 ')].sort()]);
  // Renamed, they go; a folder renamed shows what it held of such names.
  await fs.rename(exact(at('새 메모.')), at('새 메모.txt')); await fs.rename(exact(at('쌍 폴더.')), at('쌍 폴더 2'));
  await fs.rename(exact(at('쌍 폴더', '안쪽 칸 ')), at('쌍 폴더', '안쪽 칸.txt'));
  advance(61 * 60000);
  assert.deepEqual([(await engine.runOnce({})).odd, engine.config.leftOutNames.names], [1, [at('쌍 폴더 2', '끝 .')]]);
  // All renamed, the notice goes.
  await fs.rename(exact(at('쌍 폴더 2', '끝 .')), at('쌍 폴더 2', '끝.txt'));
  advance(61 * 60000);
  const last = await engine.runOnce({});
  assert.deepEqual([last.outcome, last.odd, engine.config.leftOutNames, engine.config.warning], ['complete', undefined, null, null]);
});

test('every backup walks the folders it backs up; a folder taken out takes its names with it (4.2, 설계 검토 F1)', async () => {
  const { engine, advance } = await fixture({ folders: 2 });
  const [first, second] = engine.config.sources;
  await engine.setAutomatic(true);
  await engine.runOnce({});
  await fs.writeFile(exact(path.join(second, '나중.')), 'a');
  advance(61 * 60000);
  assert.equal((await engine.runOnce({})).odd, 1, 'an hour on, found');
  await fs.writeFile(exact(path.join(first, '처음.')), 'b');
  await engine.changeSources([first]);
  advance(61 * 60000);
  const r = await engine.runOnce({});
  assert.deepEqual([r.odd, engine.config.leftOutNames.names], [1, [path.join(first, '처음.')]]);
});

test('beside files another program holds, a name told only while counting is told apart; one told while reading stays unreadable (4.2)', async () => {
  const { engine, fail, advance, stdin } = await fixture();
  await engine.setAutomatic(true);
  await engine.runOnce({});
  advance(61 * 60000);
  fail.backup = 3; fail.items = ['C:\\work\\mail.pst', 'C:\\work\\거부.']; fail.scan = ['C:\\work\\메모.', 'C:\\work\\거부.'];
  const r = await engine.runOnce({});
  assert.deepEqual([r.outcome, r.unreadable, r.odd], ['partial', 2, 1]);
  assert.deepEqual(JSON.parse(stdin.at(-1)).unreadable, ['C:\\work\\mail.pst', 'C:\\work\\거부.'], 'the list a fill reads');
  assert.deepEqual(engine.config.leftOutNames.names, ['C:\\work\\메모.']);
  assert.match(engine.config.warning, /쓰는 중인 파일 2개를 이번 백업에 담지 못했습니다/);
  assert.match(engine.config.warning, /파일이나 폴더 1개를 이번 백업에 담지 못했습니다/);
});

test('a walk that runs out of time says so, with no name found too, until one finishes (4.2, GPT GA3)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources;
  await engine.setAutomatic(true);
  engine.oddWalkBudgetMs = 0;
  const r = await engine.runOnce({});
  assert.deepEqual([r.outcome, r.odd, engine.getState().leftOutNames], ['complete', undefined, { at: engine.config.lastBackup.at, count: 0, names: [], cut: false, checked: false }]);
  advance(61 * 60000);
  await engine.runOnce({});
  assert.equal(engine.config.leftOutNames?.checked, false, 'still not looked through');
  // The next backup's walk begins anew, at once (설계 검토 F4).
  delete engine.oddWalkBudgetMs;
  await fs.writeFile(exact(path.join(src, '메모 ')), 'a');
  advance(61 * 60000);
  assert.equal((await engine.runOnce({})).odd, 1);
  assert.deepEqual(engine.config.leftOutNames, { at: engine.config.lastBackup.at, count: 1, names: [path.join(src, '메모 ')], cut: false });
});

test('past 1,000 names the state lists 1,000 and counts all (4.2)', async () => {
  const { engine, fail } = await fixture();
  await engine.setAutomatic(true);
  fail.scan = Array.from({ length: 1500 }, (_, i) => `C:\\a\\메모 ${String(i).padStart(4, '0')}.`);
  const r = await engine.runOnce({});
  const o = engine.config.leftOutNames;
  assert.deepEqual([r.odd, o.count, o.names.length, o.names[0], o.cut], [1500, 1500, 1000, 'C:\\a\\메모 0000.', false]);
});

test('long names: the state lists 32,768 characters of them and counts all (4.2, GPT GA1)', async () => {
  const { engine, fail } = await fixture();
  await engine.setAutomatic(true);
  fail.scan = Array.from({ length: 100 }, (_, i) => 'C:\\' + 'ㄱ'.repeat(990) + '\\' + String(i).padStart(3, '0') + '.');
  const r = await engine.runOnce({});
  const o = engine.getState().leftOutNames;
  assert.deepEqual([r.odd, o.count, o.names.length, o.cut], [100, 100, 32, false]);
  assert.ok(o.names.join('').length <= 32768);
});

test('past what is held, a walk that does not see every folder keeps those not known by name counted, and does not grow (4.2, GPT GA2 · 설계 검토 기록 6 F1)', async () => {
  const { engine, fail, advance } = await fixture();
  await engine.setAutomatic(true);
  engine.oddHoldMax = 5000; // as 200,000 (UNREADABLE_MAX) for real
  fail.scan = Array.from({ length: 5001 }, (_, i) => `C:\\a\\메모 ${String(i).padStart(5, '0')}.`);
  await engine.runOnce({});
  // The hold stands for all 5,001, the one past it not by name.
  assert.deepEqual([engine.config.leftOutNames.count, engine.config.leftOutHeld.count, engine.config.leftOutHeld.cut], [5001, 5001, true]);
  assert.equal(engine.getState().leftOutHeld, undefined, 'not in the window state');
  // The walk runs out of time: the one past what was held may still be there, wherever it is; those held are looked at
  // again (here outside the folders backed up, so not there).
  engine.oddWalkBudgetMs = 0; fail.scan = [];
  advance(61 * 60000);
  const r = await engine.runOnce({});
  const o = engine.config.leftOutNames;
  assert.deepEqual([r.odd, o.count, o.names, o.cut, o.checked], [1, 1, [], true, false]);
  advance(61 * 60000);
  assert.equal((await engine.runOnce({})).odd, 1, 'nor does it grow');
  // A walk in time that cannot read one folder (one never readable): the one not known by name stays counted — only a
  // walk of every folder lets it go (r6 GA4 · GA5 · GA6 · GA8; more past 200,000 only, or after a failed file).
  const [src] = engine.config.sources;
  await fs.mkdir(path.join(src, '잠긴'));
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '잠긴') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EPERM' })) : readdir(p, ...rest);
  delete engine.oddWalkBudgetMs;
  for (let i = 0; i < 2; i++) {
    advance(61 * 60000);
    try { assert.equal((await engine.runOnce({})).odd, 1); } finally { fsp.readdir = readdir; }
    fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '잠긴') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EPERM' })) : readdir(p, ...rest);
    const left = engine.config.leftOutNames;
    assert.deepEqual([left.count, left.names, left.cut, left.checked], [1, [], true, false]);
  }
  fsp.readdir = readdir;
  // A walk that goes through says it all.
  advance(61 * 60000);
  assert.equal((await engine.runOnce({})).odd, undefined);
  assert.deepEqual([engine.config.leftOutNames, engine.config.leftOutHeld.count, engine.config.leftOutHeld.cut], [null, 0, false]);
});

test('every name found is held in a file of its own, written when they change (4.2, 설계 검토 기록 3)', async () => {
  const { engine, fail, advance } = await fixture();
  const file = path.join(engine.stateDir, 'left-out-names.json');
  await engine.setAutomatic(true);
  fail.scan = Array.from({ length: 5001 }, (_, i) => `C:\\a\\메모 ${String(i).padStart(5, '0')}.`);
  await engine.runOnce({});
  const held = engine.config.leftOutHeld;
  assert.deepEqual([held.count, held.cut, JSON.parse(await fs.readFile(file, 'utf8')).names.length], [5001, false, 5001]);
  assert.ok(!JSON.stringify(engine.config).includes('메모 05000.'), 'not in the settings');
  // The same names: the file is not written again.
  advance(61 * 60000);
  await engine.runOnce({});
  assert.equal(engine.config.leftOutHeld.id, held.id);
  // The file gone (the engine removes it only when none is left): those shown are looked at, and no more is assumed.
  await fs.rm(file);
  engine.oddWalkBudgetMs = 0;
  advance(61 * 60000);
  await engine.runOnce({});
  assert.deepEqual([engine.config.leftOutNames.count, engine.config.leftOutNames.cut, engine.config.leftOutNames.checked], [5001, false, false]);
  delete engine.oddWalkBudgetMs;
  advance(61 * 60000);
  await engine.runOnce({});
  assert.deepEqual([engine.config.leftOutNames.cut, engine.config.leftOutHeld.count, engine.config.leftOutHeld.cut], [false, 5001, false]);
  // None left: nothing held, and the file says none — written, not removed, so a run that stops before the settings
  // leaves it read as the newer (r5 GA7). Once so, it is not written again.
  fail.scan = [];
  advance(61 * 60000);
  await engine.runOnce({});
  // The settings point at it all the same, so the turns go on from it (설계 검토 기록 6 F2).
  assert.deepEqual([engine.config.leftOutNames, engine.config.leftOutHeld.count, JSON.parse(await fs.readFile(file, 'utf8')).names], [null, 0, []]);
  const empty = (await fs.stat(file)).mtimeMs;
  advance(61 * 60000);
  await engine.runOnce({});
  assert.equal((await fs.stat(file)).mtimeMs, empty);
});

test('names past the list are each looked at again when a walk does not read every folder (4.2, GPT r2 GA2 · GA6)', { timeout: LONG }, async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, many = path.join(src, '가득'), tail = path.join(src, '하나');
  await fs.mkdir(many); await fs.mkdir(tail);
  const n = i => path.join(many, `n${String(i).padStart(4, '0')}.`);
  for (let i = 0; i < 1000; i++) await fs.writeFile(exact(n(i)), '');
  await fs.writeFile(exact(path.join(tail, 'tail.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const first = engine.config.leftOutNames;
  assert.ok(first.count === 1001 && first.names.length < 1001 && !first.names.includes(path.join(tail, 'tail.')));
  assert.equal(engine.config.leftOutHeld.count, 1001);
  // Those listed renamed, and the folder of one past the list cannot be read: it is still told (r2 GA6).
  for (let i = 0; i < 1000; i++) await fs.rename(exact(n(i)), path.join(many, `n${i}.txt`));
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '하나') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 1); } finally { fsp.readdir = readdir; }
  assert.deepEqual([engine.config.leftOutNames.names, engine.config.leftOutNames.checked, engine.config.leftOutNames.cut], [[path.join(tail, 'tail.')], false, false]);
  // Moved out of the folders backed up while a walk runs out of time: not told as still left out (r2 GA2).
  await fs.rename(tail, path.join(path.dirname(src), '밖으로 옮긴 하나'));
  engine.oddWalkBudgetMs = 0;
  advance(61 * 60000);
  const r = await engine.runOnce({});
  delete engine.oddWalkBudgetMs;
  assert.deepEqual([r.odd, engine.config.leftOutNames.count, engine.config.leftOutNames.checked], [undefined, 0, false]);
});

test('a run that stopped between writing the names and the settings loses none of them (4.2, GPT r4 GA1 · GA6 · GA5)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, tail = path.join(src, '하나');
  await fs.mkdir(tail); await fs.writeFile(exact(path.join(tail, 'tail.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const file = path.join(engine.stateDir, 'left-out-names.json');
  // The file written (only `tail.` left), the settings not: they point at the file before, and list 1,000 others.
  const others = Array.from({ length: 1000 }, (_, i) => path.join(src, '가득', `n${i}.`));
  await fs.writeFile(file, JSON.stringify({ v: 1, id: 'new', seq: 2, names: [path.join(tail, 'tail.')], cut: false }));
  engine.config.leftOutHeld = { id: 'old', seq: 1, count: 1001, cut: false };
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 1001, names: others, cut: false };
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '하나') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 1); } finally { fsp.readdir = readdir; }
  assert.deepEqual(engine.config.leftOutNames.names, [path.join(tail, 'tail.')]);
  // Stopped just after the file went (none left): those still shown are looked at, not counted as at least the 1,001 counted (r4 GA5, 설계 검토 기록 4 F1).
  await fs.rm(file);
  const gone = [path.join(src, '없는 a.'), path.join(src, '없는 b.')];
  engine.config.leftOutHeld = { id: 'old', seq: 1, count: 1001, cut: false };
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 1001, names: gone, cut: false };
  await fs.rm(tail, { recursive: true });
  engine.oddWalkBudgetMs = 0;
  advance(61 * 60000);
  const r = await engine.runOnce({});
  delete engine.oddWalkBudgetMs;
  assert.deepEqual([r.odd, engine.config.leftOutNames.count, engine.config.leftOutNames.checked], [undefined, 0, false]);
});

test('what restic told is held before the walk (4.2, GPT r4 GA2)', async () => {
  const { engine } = await fixture();
  const [src] = engine.config.sources;
  await fs.writeFile(exact(path.join(src, 'old.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  await engine.oddPending({ time: engine.config.lastBackup.at }, engine.config.sources, [path.join(src, 'new.')], false);
  const file = JSON.parse(await fs.readFile(path.join(engine.stateDir, 'left-out-names.json'), 'utf8'));
  assert.deepEqual([file.names, file.id], [[path.join(src, 'new.'), path.join(src, 'old.')], engine.config.leftOutHeld.id]);
  // And a file that could not be written then, holding fewer than shown: those shown are not lost either.
  await fs.mkdir(path.join(src, '새')); await fs.writeFile(exact(path.join(src, '새', 'new.')), '');
  await fs.writeFile(path.join(engine.stateDir, 'left-out-names.json'), JSON.stringify({ v: 1, id: 'stale', names: [path.join(src, 'old.')], cut: false }));
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 2, names: [path.join(src, '새', 'new.'), path.join(src, 'old.')], cut: false, checked: false };
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '새') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  try { await engine.runOnce({ force: true }); } finally { fsp.readdir = readdir; }
  assert.deepEqual(engine.config.leftOutNames.names, [path.join(src, 'old.'), path.join(src, '새', 'new.')].sort());
});

test('a name found before is matched against every name found now under its spelling (4.2, GPT r4 GA3)', async () => {
  const { engine, fail, advance } = await fixture();
  const [src] = engine.config.sources, old = path.join(src, 'Docs', 'NOTE.'), a = path.join(src, 'Docs', 'Note.'), b = path.join(src, 'docs', 'Note.');
  await fs.mkdir(path.join(src, '잠긴'));
  await engine.setAutomatic(true);
  await engine.runOnce({});
  await fs.writeFile(path.join(engine.stateDir, 'left-out-names.json'), JSON.stringify({ v: 1, id: 'held', names: [old], cut: false }));
  engine.config.leftOutHeld = { id: 'held', count: 1, cut: false };
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 1, names: [old], cut: false };
  // `Docs\NOTE.` renamed `Docs\Note.`, beside another `docs\Note.`: one file for the first two, another for the last.
  fail.scan = [a, b];
  const fsp = require('node:fs/promises'), readdir = fsp.readdir, lstat = fsp.lstat;
  const ids = new Map([[exact(old), 5n], [exact(a), 5n], [exact(b), 6n]]);
  fsp.readdir = (p, ...rest) => p === exact(src) ? readdir(p, ...rest).then(list => [...list, { name: 'Docs', isDirectory: () => true, isSymbolicLink: () => false }]) : p === exact(path.join(src, 'Docs')) ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  fsp.lstat = (p, ...rest) => ids.has(p) ? Promise.resolve({ ino: ids.get(p), dev: 1n, isDirectory: () => false }) : lstat(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 2); } finally { fsp.readdir = readdir; fsp.lstat = lstat; }
  assert.deepEqual(engine.config.leftOutNames.names, [a, b].sort());
});

test('names past what one file may hold are told as more (4.2, GPT r4 GA4)', async () => {
  const { engine, fail } = await fixture();
  await engine.setAutomatic(true);
  engine.oddHoldChars = 20; // as 50,000,000 for real
  fail.scan = ['C:\\a\\ㄱ.', 'C:\\a\\ㄴ.', 'C:\\a\\하하하하하하하하.'];
  await engine.runOnce({});
  delete engine.oddHoldChars;
  const file = JSON.parse(await fs.readFile(path.join(engine.stateDir, 'left-out-names.json'), 'utf8'));
  assert.deepEqual([engine.config.leftOutNames.count, engine.config.leftOutHeld.count, engine.config.leftOutHeld.cut, file.names.length], [3, 3, true, 2]);
});

test('names in a chosen folder that is not there now are held until it comes back (4.2, GPT r5 GA1 · GA5)', async () => {
  const { engine, advance } = await fixture({ folders: 2 });
  const [, second] = engine.config.sources, usb = path.join(second, '깊은', 'usb.');
  await fs.mkdir(path.join(second, '깊은')); await fs.writeFile(exact(usb), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  assert.deepEqual(engine.config.leftOutNames.names, [usb]);
  // Unplugged: out of this backup and of what is shown, but still held.
  const away = second + '-뽑음';
  await fs.rename(second, away);
  advance(61 * 60000);
  await engine.runOnce({});
  assert.equal(engine.config.leftOutNames, null);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(engine.stateDir, 'left-out-names.json'), 'utf8')).names, [usb]);
  // Still away, and a walk that does not read every folder: held all the same.
  const [first] = engine.config.sources, fsp = require('node:fs/promises'), readdir = fsp.readdir;
  await fs.mkdir(path.join(first, '잠긴'));
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '잠긴') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  advance(61 * 60000);
  try { await engine.runOnce({}); } finally { fsp.readdir = readdir; }
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(engine.stateDir, 'left-out-names.json'), 'utf8')).names, [usb]);
  await fs.rm(path.join(first, '잠긴'), { recursive: true });
  // Back, with the folder that holds it unread: still told.
  await fs.rename(away, second);
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '깊은') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 1); } finally { fsp.readdir = readdir; }
  assert.deepEqual(engine.config.leftOutNames.names, [usb]);
});

test('a names file that could not be read is not written over until a walk reads every folder (4.2, GPT r5 GA2 · GA8)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, tail = path.join(src, '하나');
  await fs.mkdir(tail); await fs.writeFile(exact(path.join(tail, 'tail.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const file = path.join(engine.stateDir, 'left-out-names.json'), was = await fs.readFile(file, 'utf8');
  // Listed nowhere else (as past the list), the file unreadable once, and the folder that holds it unread.
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 1, names: [], cut: false };
  const fsp = require('node:fs/promises'), readFile = fsp.readFile, readdir = fsp.readdir;
  let once = true;
  fsp.readFile = (p, ...rest) => { if (p === file && once) { once = false; return Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })); } return readFile(p, ...rest); };
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '하나') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  advance(61 * 60000);
  let r;
  try {
    await engine.runOnce({});
    assert.equal(await readFile(file, 'utf8'), was, 'not written over');
    // Read again, the folder still unread: told.
    advance(61 * 60000);
    r = await engine.runOnce({});
  } finally { fsp.readFile = readFile; fsp.readdir = readdir; }
  assert.deepEqual([r.odd, engine.config.leftOutNames.names], [1, [path.join(tail, 'tail.')]]);
});

test('one held and one listed under another spelling are told once when they are one file (4.2, GPT r5 GA3)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, listed = path.join(src, 'Docs', 'NOTE.'), held = path.join(src, 'Docs', 'Note.');
  await fs.mkdir(path.join(src, '잠긴'));
  await engine.setAutomatic(true);
  await engine.runOnce({});
  // Renamed `NOTE.` to `Note.`; the file written, the settings not.
  await fs.writeFile(path.join(engine.stateDir, 'left-out-names.json'), JSON.stringify({ v: 1, id: 'new', seq: 2, names: [held], cut: false }));
  engine.config.leftOutHeld = { id: 'old', seq: 1, count: 1, cut: false };
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 1, names: [listed], cut: false };
  const fsp = require('node:fs/promises'), readdir = fsp.readdir, lstat = fsp.lstat;
  fsp.readdir = (p, ...rest) => p === exact(src) ? readdir(p, ...rest).then(list => [...list, { name: 'Docs', isDirectory: () => true, isSymbolicLink: () => false }]) : p === exact(path.join(src, 'Docs')) ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  fsp.lstat = (p, ...rest) => p === exact(listed) || p === exact(held) ? Promise.resolve({ ino: 9n, dev: 1n, isDirectory: () => false }) : lstat(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 1); } finally { fsp.readdir = readdir; fsp.lstat = lstat; }
});

test('a file newer than the settings says itself whether more were found (4.2, GPT r5 GA7)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources;
  await engine.setAutomatic(true);
  await engine.runOnce({});
  // None left and the file written so; the settings, from a backup whose file could not be written, say there were more.
  await fs.writeFile(path.join(engine.stateDir, 'left-out-names.json'), JSON.stringify({ v: 1, id: 'new', seq: 2, names: [], cut: false }));
  engine.config.leftOutHeld = { id: 'old', seq: 1, count: 2, cut: true };
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 2, names: [path.join(src, '없는 a.'), path.join(src, '없는 b.')], cut: true, checked: false };
  engine.oddWalkBudgetMs = 0;
  advance(61 * 60000);
  const r = await engine.runOnce({});
  delete engine.oddWalkBudgetMs;
  assert.deepEqual([r.odd, engine.config.leftOutNames.count, engine.config.leftOutNames.cut], [undefined, 0, false]);
});

test('a walk in time that cannot read some folders lets go of the names found before in those it read (4.2, 설계 검토 기록 5 F2)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, file = path.join(engine.stateDir, 'left-out-names.json');
  await fs.mkdir(path.join(src, '잠긴')); await fs.mkdir(path.join(src, '열린'));
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '잠긴') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  await engine.setAutomatic(true);
  try {
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 5; i++) await fs.writeFile(exact(path.join(src, '열린', `r${round}-${i}.`)), '');
      advance(61 * 60000); await engine.runOnce({});
      for (let i = 0; i < 5; i++) await fs.rename(exact(path.join(src, '열린', `r${round}-${i}.`)), path.join(src, '열린', `r${round}-${i}.txt`));
    }
    advance(61 * 60000); await engine.runOnce({});
  } finally { fsp.readdir = readdir; }
  assert.deepEqual([engine.config.leftOutNames.count, engine.config.leftOutNames.checked, JSON.parse(await fs.readFile(file, 'utf8')).names], [0, false, []]);
});

test('a names file that could not be written, with none pointed at before, leaves the settings the newer (4.2, 설계 검토 기록 5 F3)', async () => {
  const { engine, fail } = await fixture();
  const [src] = engine.config.sources, file = path.join(engine.stateDir, 'left-out-names.json');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  await fs.writeFile(file, JSON.stringify({ v: 1, id: 'stale', names: [], cut: false }));
  fail.scan = [path.join(src, '알린.')];
  const fsp = require('node:fs/promises'), open = fsp.open;
  fsp.open = (p, ...rest) => String(p).startsWith(file + '.') ? Promise.reject(Object.assign(new Error('full'), { code: 'ENOSPC' })) : open(p, ...rest);
  try { await engine.runOnce({ force: true }); } finally { fsp.open = open; }
  const held = engine.config.leftOutHeld;
  assert.ok(held.seq > 0 && held.count === 1 && held.cut === true, JSON.stringify(held));
  assert.equal((await engine.oddBefore()).cut, true);
});

test('a names file that could not be read is written only by a walk of every chosen folder (4.2, 설계 검토 기록 5 F4)', async () => {
  const { engine, advance } = await fixture({ folders: 2 });
  const [, second] = engine.config.sources, usb = path.join(second, 'usb.');
  await fs.writeFile(exact(usb), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const file = path.join(engine.stateDir, 'left-out-names.json'), was = await fs.readFile(file, 'utf8');
  await fs.rename(second, second + '-뽑음');
  const fsp = require('node:fs/promises'), readFile = fsp.readFile;
  let once = true;
  fsp.readFile = (p, ...rest) => { if (p === file && once) { once = false; return Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })); } return readFile(p, ...rest); };
  advance(61 * 60000);
  try { await engine.runOnce({}); } finally { fsp.readFile = readFile; }
  assert.equal(await fs.readFile(file, 'utf8'), was);
});

test('which of the names file and the settings is newer is told by the turn each was written at (4.2, GPT r6 GA7)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, file = path.join(engine.stateDir, 'left-out-names.json');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const gone = [path.join(src, '없는 a.'), path.join(src, '없는 b.')];
  // A write before the walk failed (the settings a turn past the file, `unwritten`), then the walk wrote none left and stopped before the settings.
  await fs.writeFile(file, JSON.stringify({ v: 1, id: 'later', seq: 3, names: [], cut: false }));
  engine.config.leftOutHeld = { id: 'unwritten', seq: 2, count: 2, cut: true };
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 2, names: gone, cut: true, checked: false };
  engine.oddWalkBudgetMs = 0;
  advance(61 * 60000);
  assert.equal((await engine.runOnce({})).odd, undefined, 'the newer file says none were past it');
  assert.equal(engine.config.leftOutNames.cut, false, 'nor that there may be more');
  // The file behind the settings (its write failed since): there may be more, and the count stays — told by the turn
  // alone, whatever else the settings say.
  await fs.writeFile(file, JSON.stringify({ v: 1, id: 'older', seq: 1, names: [], cut: false }));
  engine.config.leftOutHeld = { id: 'older', seq: 2, count: 2, cut: false };
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 2, names: gone, cut: false };
  advance(61 * 60000);
  await engine.runOnce({});
  delete engine.oddWalkBudgetMs;
  // Those shown are known by name and looked at (gone); there may be more all the same.
  assert.deepEqual([engine.config.leftOutNames.count, engine.config.leftOutNames.cut], [0, true]);
});

test('a run that could not read the names file and so did not write it leaves the settings saying it holds fewer (4.2, GPT r6 GA1)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources;
  await fs.writeFile(exact(path.join(src, 'a.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const file = path.join(engine.stateDir, 'left-out-names.json'), fsp = require('node:fs/promises'), readFile = fsp.readFile;
  await fs.mkdir(path.join(src, '잠긴'));
  const readdir = fsp.readdir;
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '잠긴') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  fsp.readFile = (p, ...rest) => p === file ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readFile(p, ...rest);
  const seq = engine.config.leftOutHeld.seq;
  advance(61 * 60000);
  try { await engine.runOnce({}); } finally { fsp.readFile = readFile; fsp.readdir = readdir; }
  assert.equal(engine.config.leftOutHeld.cut, true);
  // And a turn past the file, so one written since and not pointed at reads as no newer (GPT r8 GA3).
  assert.ok(engine.config.leftOutHeld.seq > seq);
});

test('a count kept once, the names it was for gone, does not keep itself (4.2, 설계 검토 기록 6 F1)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, file = path.join(engine.stateDir, 'left-out-names.json');
  await fs.writeFile(exact(path.join(src, 'a.')), ''); await fs.writeFile(exact(path.join(src, 'b.')), '');
  await fs.mkdir(path.join(src, '잠긴'));
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const fsp = require('node:fs/promises'), readdir = fsp.readdir, readFile = fsp.readFile;
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '잠긴') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  try {
    // The names file unreadable once: there may be more.
    fsp.readFile = (p, ...rest) => p === file ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readFile(p, ...rest);
    advance(61 * 60000);
    try { assert.equal((await engine.runOnce({})).odd, 2); } finally { fsp.readFile = readFile; }
    // Both renamed: looked at, gone — the count comes down though one folder is never read.
    await fs.rename(exact(path.join(src, 'a.')), path.join(src, 'a.txt')); await fs.rename(exact(path.join(src, 'b.')), path.join(src, 'b.txt'));
    for (let i = 0; i < 2; i++) { advance(61 * 60000); assert.equal((await engine.runOnce({})).odd, undefined); }
  } finally { fsp.readdir = readdir; }
});

test('a names file the settings do not point at is read, and the turns go on from it (4.2, 설계 검토 기록 6 F2)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, tail = path.join(src, '하나'), file = path.join(engine.stateDir, 'left-out-names.json');
  await fs.mkdir(tail); await fs.writeFile(exact(path.join(tail, 'tail.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  // Written, and the backup stopped before the settings ever pointed at it.
  engine.config.leftOutHeld = null; engine.config.leftOutNames = null;
  await fs.writeFile(file, JSON.stringify({ v: 1, id: 'written', seq: 4, names: [path.join(tail, 'tail.')], cut: false }));
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '하나') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 1); } finally { fsp.readdir = readdir; }
  assert.ok(engine.config.leftOutHeld.seq >= 4, 'on from the file');
  // None left: still pointed at, the turn kept.
  await engine.oddHold([], false, { present: engine.config.sources, complete: true });
  assert.equal(engine.config.leftOutHeld?.count, 0);
});

test('a chosen folder gone while it is walked is one not read (4.2, 설계 검토 기록 6 F4)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, file = path.join(engine.stateDir, 'left-out-names.json');
  await fs.writeFile(exact(path.join(src, 'a.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  // The walk's read of it: the check of the chosen folders before the backup reads it too, by the same path off Windows.
  fsp.readdir = (p, ...rest) => p === exact(src) && rest[0]?.withFileTypes ? Promise.reject(Object.assign(new Error('gone'), { code: 'ENOENT' })) : readdir(p, ...rest);
  advance(61 * 60000);
  try { await engine.runOnce({}); } finally { fsp.readdir = readdir; }
  assert.deepEqual([JSON.parse(await fs.readFile(file, 'utf8')).names, engine.config.leftOutNames.checked], [[path.join(src, 'a.')], false]);
});

test('with no such name ever, no names file is written (4.2)', async () => {
  const { engine, advance } = await fixture();
  await engine.setAutomatic(true);
  await engine.runOnce({}); advance(61 * 60000); await engine.runOnce({});
  await assert.rejects(fs.stat(path.join(engine.stateDir, 'left-out-names.json')), { code: 'ENOENT' });
});

for (const past of [1, 2]) test(`names found again past what is held are not told twice, ${past} past it (4.2, GPT r7 GA1)`, async () => {
  const { engine, fail, advance } = await fixture();
  const [src] = engine.config.sources;
  engine.oddHoldMax = 1000; // as 200,000 (UNREADABLE_MAX) for real
  fail.scan = Array.from({ length: 1000 + past }, (_, i) => path.join(src, `n${String(i).padStart(4, '0')}.`));
  await engine.setAutomatic(true);
  await engine.runOnce({});
  assert.deepEqual([engine.config.leftOutHeld.count, engine.config.leftOutHeld.cut], [1000 + past, true]);
  // One folder never read: the one past what is held, found again, may be the one left out past the limit — and may
  // not, so one stays counted: one past them at most, and the count does not grow (설계 검토 기록 8 F1).
  await fs.mkdir(path.join(src, '잠긴'));
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '잠긴') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  try { for (let i = 0; i < 3; i++) { advance(61 * 60000); assert.equal((await engine.runOnce({})).odd, 1001 + past); } }
  finally { fsp.readdir = readdir; delete engine.oddHoldMax; }
});

test('within one spelling, names that differ past case stay two, one file under both or not (4.2, GPT r7 GA2)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, docs = path.join(src, 'Docs'), names = ['A.', 'B.', 'a.', 'b.'].map(n => path.join(docs, n));
  await engine.setAutomatic(true);
  await engine.runOnce({});
  await fs.writeFile(path.join(engine.stateDir, 'left-out-names.json'), JSON.stringify({ v: 1, id: 'held', seq: 2, names, count: 4, cut: false }));
  engine.config.leftOutHeld = { id: 'held', seq: 2, count: 4, cut: false };
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 4, names, cut: false };
  // A folder that tells case apart, not read; `A.` and `B.` one file under two names (a hard link).
  const ids = { 'A.': 1n, 'B.': 1n, 'a.': 2n, 'b.': 3n };
  const fsp = require('node:fs/promises'), readdir = fsp.readdir, lstat = fsp.lstat;
  fsp.readdir = (p, ...rest) => p === exact(src) ? readdir(p, ...rest).then(list => [...list, { name: 'Docs', isDirectory: () => true, isSymbolicLink: () => false }]) : p === exact(docs) ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  fsp.lstat = (p, ...rest) => { const n = names.find(q => exact(q) === p); return n ? Promise.resolve({ ino: ids[path.basename(n)], dev: 1n, isDirectory: () => false }) : lstat(p, ...rest); };
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 4); } finally { fsp.readdir = readdir; fsp.lstat = lstat; }
});

for (const stopped of [false, true]) test(`those a chosen folder away holds past what is held stay counted until a walk of every chosen folder${stopped ? ', each run stopped before the settings' : ''} (4.2, GPT r7 GA3${stopped ? ' · GA4' : ''})`, async () => {
  const { engine, advance } = await fixture({ folders: 2 });
  const [usb, second] = engine.config.sources, deep = path.join(usb, '깊은');
  await fs.mkdir(deep);
  for (const p of [path.join(usb, 'a.'), path.join(usb, 'b.'), path.join(deep, 'tail.')]) await fs.writeFile(exact(p), '');
  engine.oddHoldMax = 3; // as 200,000 (UNREADABLE_MAX) for real
  await engine.setAutomatic(true);
  await engine.runOnce({});
  assert.equal(engine.config.leftOutHeld.count, 3);
  // Unplugged, and a new name in the other folder, which sorts first: the hold is full, and `tail.` falls out of it.
  const away = usb + '-뽑음';
  await fs.rename(usb, away);
  await fs.mkdir(path.join(second, '새')); await fs.writeFile(exact(path.join(second, '새', 'new.')), '');
  let pending = null;
  engine.oddPending = async (...a) => { const r = await Object.getPrototypeOf(engine).oddPending.apply(engine, a); pending = structuredClone({ held: engine.config.leftOutHeld, names: engine.config.leftOutNames }); return r; };
  for (let i = 0; i < 2; i++) {
    advance(61 * 60000); await engine.runOnce({});
    if (stopped) { engine.config.leftOutHeld = pending.held; engine.config.leftOutNames = pending.names; }
  }
  delete engine.oddPending;
  // Back, with the folders that hold `tail.` and the new one unread: both still counted, the new one by number.
  await fs.rename(away, usb);
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '깊은') || p.endsWith(path.sep + '새') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 4); } finally { fsp.readdir = readdir; delete engine.oddHoldMax; }
});

test('a names file past the settings says itself how many it could not name, those shown aside (4.2, GPT r7 GA4)', async () => {
  const { engine } = await fixture();
  const [src] = engine.config.sources;
  await fs.writeFile(path.join(engine.stateDir, 'left-out-names.json'), JSON.stringify({ v: 1, id: 'new', seq: 3, names: [path.join(src, 'x.')], count: 2, cut: true }));
  engine.config.leftOutHeld = { id: 'old', seq: 2, count: 5, cut: true };
  engine.config.leftOutNames = { at: new Date().toISOString(), count: 5, names: ['u.', 'v.', 'w.', 'y.', 'z.'].map(n => path.join(src, n)), cut: true };
  assert.equal((await engine.oddBefore()).unknown, 1);
});

test('a hold that could not be written stays counted for those it could not name, a chosen folder away (4.2, GPT r7 GA5)', async () => {
  const { engine, fail, advance } = await fixture({ folders: 2 });
  const [usb, second] = engine.config.sources, deep = path.join(second, '깊은'), tail = path.join(deep, 'tail.'), file = path.join(engine.stateDir, 'left-out-names.json');
  await fs.writeFile(exact(path.join(usb, 'usb.')), ''); await fs.mkdir(deep);
  await engine.setAutomatic(true);
  await engine.runOnce({});
  await fs.rename(usb, usb + '-뽑음');
  // restic tells 1,001 new names, `tail.` past the list; the names file cannot be written, and the run stops in the walk.
  await fs.writeFile(exact(tail), '');
  fail.scan = [...Array.from({ length: 1000 }, (_, i) => path.join(second, `가 ${String(i).padStart(4, '0')}.`)), tail];
  const fsp = require('node:fs/promises'), open = fsp.open, readdir = fsp.readdir;
  let pending = null;
  engine.oddPending = async (...a) => { const r = await Object.getPrototypeOf(engine).oddPending.apply(engine, a); pending = structuredClone({ held: engine.config.leftOutHeld, names: engine.config.leftOutNames }); return r; };
  fsp.open = (p, ...rest) => String(p).startsWith(file + '.') ? Promise.reject(Object.assign(new Error('full'), { code: 'ENOSPC' })) : open(p, ...rest);
  advance(61 * 60000);
  try { await engine.runOnce({}); } finally { fsp.open = open; delete engine.oddPending; }
  engine.config.leftOutHeld = pending.held; engine.config.leftOutNames = pending.names;
  // Those shown renamed, and the folder that holds `tail.` unread: all but those shown stay counted, `tail.` among them —
  // the one held for the folder away too, the file behind the settings knowing none by name (GPT r9 GA6).
  fail.scan = [];
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '깊은') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 1002 - pending.names.names.length); } finally { fsp.readdir = readdir; }
});

test('a hold the settings are past is written again though it reads the same (4.2, GPT r7 GA6)', async () => {
  const { engine, fail, advance } = await fixture();
  const [src] = engine.config.sources, file = path.join(engine.stateDir, 'left-out-names.json');
  await engine.setAutomatic(true);
  fail.scan = [path.join(src, 'x.')]; await engine.runOnce({});
  fail.scan = []; advance(61 * 60000); await engine.runOnce({});
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')).names, []);
  // 1,001 told, and the names file cannot be written.
  const fsp = require('node:fs/promises'), open = fsp.open;
  let failing = Infinity, pending = null;
  fsp.open = (p, ...rest) => String(p).startsWith(file + '.') && failing-- > 0 ? Promise.reject(Object.assign(new Error('full'), { code: 'ENOSPC' })) : open(p, ...rest);
  engine.oddPending = async (...a) => { const r = await Object.getPrototypeOf(engine).oddPending.apply(engine, a); pending = structuredClone({ held: engine.config.leftOutHeld, names: engine.config.leftOutNames }); return r; };
  try {
    fail.scan = Array.from({ length: 1001 }, (_, i) => path.join(src, `n${String(i).padStart(4, '0')}.`));
    advance(61 * 60000); await engine.runOnce({});
    // All renamed: the write before the walk fails again, the walk writes none left, and the run stops before the settings.
    fail.scan = []; failing = 1;
    advance(61 * 60000); await engine.runOnce({});
    engine.config.leftOutHeld = pending.held; engine.config.leftOutNames = pending.names;
  } finally { fsp.open = open; delete engine.oddPending; }
  engine.oddWalkBudgetMs = 0;
  advance(61 * 60000);
  const r = await engine.runOnce({});
  delete engine.oddWalkBudgetMs;
  assert.deepEqual([r.odd, engine.config.leftOutNames.count], [undefined, 0]);
});

test('a name found now does not take the place of every one not known by name (4.2, 설계 검토 기록 7 F1)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, file = path.join(engine.stateDir, 'left-out-names.json');
  const many = path.join(src, 'many'), z = path.join(src, 'z'), names = Array.from({ length: 3 }, (_, i) => path.join(many, `m${i}.`));
  await fs.mkdir(many); await fs.mkdir(z);
  for (const p of [...names, path.join(z, 'tail.')]) await fs.writeFile(exact(p), '');
  await engine.setAutomatic(true);
  // The names file cannot be written once: the settings hold the count, those shown the names but `tail.`.
  const fsp = require('node:fs/promises'), open = fsp.open, readdir = fsp.readdir;
  fsp.open = (p, ...rest) => String(p).startsWith(file + '.') ? Promise.reject(Object.assign(new Error('full'), { code: 'ENOSPC' })) : open(p, ...rest);
  try { await engine.runOnce({}); } finally { fsp.open = open; }
  engine.config.leftOutNames = { ...engine.config.leftOutNames, names };
  // `z` never read from now on, and a new name.
  fsp.readdir = (p, ...rest) => p === exact(z) ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  try {
    await fs.writeFile(exact(path.join(many, 'new.')), '');
    advance(61 * 60000); await engine.runOnce({});
    // All but `tail.` renamed: it stays counted.
    for (const p of [...names, path.join(many, 'new.')]) await fs.rename(exact(p), p + 'txt');
    advance(61 * 60000);
    assert.equal((await engine.runOnce({})).odd, 1);
  } finally { fsp.readdir = readdir; }
});

test('a chosen folder gone by the end of the walk is one not read, whatever was read below it (4.2, 설계 검토 기록 7 F2)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, sub = path.join(src, 'sub'), away = src + '-뽑음', file = path.join(engine.stateDir, 'left-out-names.json');
  await fs.mkdir(sub); await fs.writeFile(exact(path.join(sub, 'tail.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  // Pulled out once its first folder is read.
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (p, ...rest) => p === exact(sub) ? fs.rename(src, away).then(() => Promise.reject(Object.assign(new Error('gone'), { code: 'ENOENT' }))) : readdir(p, ...rest);
  advance(61 * 60000);
  try { await engine.runOnce({}); } finally { fsp.readdir = readdir; }
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')).names, [path.join(sub, 'tail.')]);
  // Back, with that folder unread: told.
  await fs.rename(away, src);
  fsp.readdir = (p, ...rest) => p === exact(sub) ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 1); } finally { fsp.readdir = readdir; }
});

for (const stopped of [false, true]) test(`past what is held, those held already are not pushed out by new ones that sort first${stopped ? ', each run stopped before the settings' : ''} (4.2, GPT r8 GA4${stopped ? ' · GA5' : ''})`, async () => {
  const { engine, fail, advance } = await fixture({ folders: 2 });
  const [usb, second] = engine.config.sources, deep = path.join(usb, '깊은');
  await fs.mkdir(deep);
  for (const p of [path.join(usb, 'a.'), path.join(usb, 'b.'), path.join(deep, 'tail.')]) await fs.writeFile(exact(p), '');
  engine.oddHoldMax = 3; // as 200,000 (UNREADABLE_MAX) for real
  await engine.setAutomatic(true);
  await engine.runOnce({});
  // Unplugged, and restic tells two new names in the other folder, which sort first.
  const away = usb + '-뽑음';
  await fs.rename(usb, away);
  fail.scan = [path.join(second, 'n1.'), path.join(second, 'n2.')];
  let pending = null;
  engine.oddPending = async (...a) => { const r = await Object.getPrototypeOf(engine).oddPending.apply(engine, a); pending = structuredClone({ held: engine.config.leftOutHeld, names: engine.config.leftOutNames }); return r; };
  advance(61 * 60000); await engine.runOnce({});
  delete engine.oddPending;
  if (stopped) { engine.config.leftOutHeld = pending.held; engine.config.leftOutNames = pending.names; }
  assert.ok(JSON.parse(await fs.readFile(path.join(engine.stateDir, 'left-out-names.json'), 'utf8')).names.includes(path.join(deep, 'tail.')));
  // Back, with the folder that holds `tail.` unread: all five told.
  await fs.rename(away, usb);
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '깊은') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 5); } finally { fsp.readdir = readdir; delete engine.oddHoldMax; }
});

test('a names file behind the settings is not taken to know the names the count is for (4.2, GPT r8 GA6 · r9 GA6)', async () => {
  const { engine, advance } = await fixture({ folders: 2 });
  const [usb, second] = engine.config.sources, deep = path.join(second, '깊은'), file = path.join(engine.stateDir, 'left-out-names.json');
  await fs.mkdir(deep); await fs.writeFile(exact(path.join(deep, 'tail.')), ''); await fs.writeFile(exact(path.join(usb, 'usb.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  // The file holds the name of a folder away and one renamed since; the settings, a turn past it (its write failed),
  // count that one away and `tail.`.
  await fs.writeFile(file, JSON.stringify({ v: 1, id: 'old', seq: 1, names: [path.join(usb, 'usb.'), path.join(second, '고친.')], count: 2, cut: false }));
  engine.config.leftOutHeld = { id: 'old', seq: 2, count: 2, dropped: 0, cut: true };
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 1, names: [], cut: true, checked: false };
  await fs.rename(usb, usb + '-뽑음');
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '깊은') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  advance(61 * 60000);
  // `tail.`, and the one held for the folder away as well (counted twice rather than none).
  try { assert.equal((await engine.runOnce({})).odd, 2); } finally { fsp.readdir = readdir; }
});

test('a name renamed before its chosen folder went away does not take the place of one not known by name (4.2, GPT r9 GA6)', async () => {
  const { engine, fail, advance } = await fixture({ folders: 2 });
  const [usb, other] = engine.config.sources, deep = path.join(other, '깊은'), tail = path.join(deep, 'tail.'), file = path.join(engine.stateDir, 'left-out-names.json');
  await fs.writeFile(exact(path.join(usb, 'old.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  // `old.` renamed, and 1,000 new names told with a new `tail.`, in a run whose names file cannot be written.
  await fs.rename(exact(path.join(usb, 'old.')), path.join(usb, 'old.txt'));
  await fs.mkdir(deep); await fs.writeFile(exact(tail), '');
  const told = Array.from({ length: 1000 }, (_, i) => path.join(other, `가 ${String(i).padStart(4, '0')}.`));
  fail.scan = [...told, tail];
  const fsp = require('node:fs/promises'), open = fsp.open, readdir = fsp.readdir;
  fsp.open = (x, ...rest) => String(x).startsWith(file + '.') ? Promise.reject(Object.assign(new Error('full'), { code: 'ENOSPC' })) : open(x, ...rest);
  advance(61 * 60000);
  try { await engine.runOnce({}); } finally { fsp.open = open; }
  engine.config.leftOutNames = { ...engine.config.leftOutNames, names: told }; // all 1,000 shown, as with short names
  // Unplugged; those shown renamed, and `tail.`'s folder unread: it is still told.
  await fs.rename(usb, usb + '-뽑음');
  fail.scan = [];
  fsp.readdir = (x, ...rest) => x.endsWith(path.sep + '깊은') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(x, ...rest);
  advance(61 * 60000);
  try { assert.ok((await engine.runOnce({})).odd >= 1); } finally { fsp.readdir = readdir; }
});

test('those looked at and not there are let go from the hold, a walk out of time (4.2, GPT r8 GA2)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, file = path.join(engine.stateDir, 'left-out-names.json'), gone = [path.join(src, 'g1.'), path.join(src, 'g2.')];
  await engine.setAutomatic(true);
  await engine.runOnce({});
  await fs.writeFile(file, JSON.stringify({ v: 1, id: 'held', seq: 2, names: gone, count: 2, cut: false }));
  engine.config.leftOutHeld = { id: 'held', seq: 2, count: 2, dropped: 0, cut: false };
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 2, names: gone, cut: false };
  engine.oddWalkBudgetMs = 0;
  advance(61 * 60000);
  try { await engine.runOnce({}); } finally { delete engine.oddWalkBudgetMs; }
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')).names, []);
});

test('those not known by name stay counted through a walk of every folder while a chosen folder is away (4.2, GPT r7 GA3)', async () => {
  const { engine, advance } = await fixture({ folders: 2 });
  const [usb] = engine.config.sources, deep = path.join(usb, '깊은'), file = path.join(engine.stateDir, 'left-out-names.json');
  await fs.mkdir(deep);
  for (const n of ['u1.', 'u2.']) await fs.writeFile(exact(path.join(deep, n)), '');
  await engine.setAutomatic(true);
  // The names file cannot be written, and those shown do not name them (as past the list).
  const fsp = require('node:fs/promises'), open = fsp.open, readdir = fsp.readdir;
  fsp.open = (p, ...rest) => String(p).startsWith(file + '.') ? Promise.reject(Object.assign(new Error('full'), { code: 'ENOSPC' })) : open(p, ...rest);
  try { await engine.runOnce({}); } finally { fsp.open = open; }
  engine.config.leftOutNames = { ...engine.config.leftOutNames, names: [] };
  // Unplugged: a walk of every folder there is.
  const away = usb + '-뽑음';
  await fs.rename(usb, away);
  advance(61 * 60000); await engine.runOnce({});
  // Back, with the folder that holds them unread: still counted.
  await fs.rename(away, usb);
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '깊은') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 2); } finally { fsp.readdir = readdir; }
});

test('one left out past the limit stays counted when a new name is found and the rest renamed (4.2, 설계 검토 기록 8 F1)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, p = path.join(src, 'p'), q = path.join(src, 'q'), ps = ['p1.', 'p2.', 'p3.'].map(n => path.join(p, n));
  await fs.mkdir(p); await fs.mkdir(q);
  for (const x of [...ps, path.join(q, 'q1.')]) await fs.writeFile(exact(x), '');
  engine.oddHoldMax = 3; // as 200,000 (UNREADABLE_MAX) for real
  await engine.setAutomatic(true);
  await engine.runOnce({});
  engine.config.leftOutNames = { ...engine.config.leftOutNames, names: ps }; // `q1.` past the list, as past 1,000
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (x, ...rest) => x.endsWith(path.sep + 'q') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(x, ...rest);
  try {
    await fs.rename(exact(ps[0]), ps[0] + 'txt'); await fs.writeFile(exact(path.join(p, 'n1.')), '');
    advance(61 * 60000); await engine.runOnce({});
    for (const x of [ps[1], ps[2], path.join(p, 'n1.')]) await fs.rename(exact(x), x + 'txt');
    advance(61 * 60000);
    assert.equal((await engine.runOnce({})).odd, 1);
  } finally { fsp.readdir = readdir; delete engine.oddHoldMax; }
});

test('a chosen folder gone while those names are looked at again lets none of them go (4.2, 설계 검토 기록 8 F2)', async () => {
  const { engine, advance } = await fixture({ folders: 2 });
  const [usb] = engine.config.sources, sub = path.join(usb, 'sub'), file = path.join(engine.stateDir, 'left-out-names.json');
  await fs.mkdir(sub); await fs.writeFile(exact(path.join(sub, 'tail.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  // A walk out of time, and the drive pulled once the backup is written down.
  const fsp = require('node:fs/promises'), lstat = fsp.lstat;
  let pulled = false;
  engine.oddPending = async (...a) => { const r = await Object.getPrototypeOf(engine).oddPending.apply(engine, a); pulled = true; return r; };
  fsp.lstat = (x, ...rest) => pulled && String(x).startsWith(exact(usb)) ? Promise.reject(Object.assign(new Error('gone'), { code: 'ENOENT' })) : lstat(x, ...rest);
  engine.oddWalkBudgetMs = 0;
  advance(61 * 60000);
  try { await engine.runOnce({}); } finally { fsp.lstat = lstat; delete engine.oddPending; delete engine.oddWalkBudgetMs; }
  assert.ok(JSON.parse(await fs.readFile(file, 'utf8')).names.includes(path.join(sub, 'tail.')));
});

test('a name shown only, its write failed, is held when its chosen folder is away (4.2, 설계 검토 기록 8 F3)', async () => {
  const { engine, advance } = await fixture({ folders: 2 });
  const [usb, other] = engine.config.sources, sub = path.join(usb, 'sub'), file = path.join(engine.stateDir, 'left-out-names.json');
  await fs.writeFile(exact(path.join(other, 'a.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  await fs.mkdir(sub); await fs.writeFile(exact(path.join(sub, 'new.')), '');
  const fsp = require('node:fs/promises'), open = fsp.open, readdir = fsp.readdir;
  fsp.open = (x, ...rest) => String(x).startsWith(file + '.') ? Promise.reject(Object.assign(new Error('full'), { code: 'ENOSPC' })) : open(x, ...rest);
  advance(61 * 60000);
  try { await engine.runOnce({}); } finally { fsp.open = open; }
  // Unplugged, then back with `sub` unread: `new.` is still told.
  const away = usb + '-뽑음';
  await fs.rename(usb, away);
  advance(61 * 60000); await engine.runOnce({});
  await fs.rename(away, usb);
  fsp.readdir = (x, ...rest) => x.endsWith(path.sep + 'sub') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(x, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 2); } finally { fsp.readdir = readdir; }
});

test('a names file that cannot be read keeps counted those shown for a chosen folder away (4.2, 설계 검토 기록 8 F4)', async () => {
  const { engine, advance } = await fixture({ folders: 2 });
  const [usb, other] = engine.config.sources, sub = path.join(usb, 'sub'), file = path.join(engine.stateDir, 'left-out-names.json');
  await fs.mkdir(sub); await fs.writeFile(exact(path.join(sub, 'u.')), ''); await fs.writeFile(exact(path.join(other, 'a.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  await fs.writeFile(file, '{ not json');
  const away = usb + '-뽑음';
  await fs.rename(usb, away);
  advance(61 * 60000); await engine.runOnce({});
  // Back with `sub` unread, and `a.` renamed: `u.` is still counted.
  await fs.rename(away, usb);
  await fs.rename(exact(path.join(other, 'a.')), path.join(other, 'a.txt'));
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (x, ...rest) => x.endsWith(path.sep + 'sub') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(x, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 1); } finally { fsp.readdir = readdir; }
});

test('a names file behind the settings does not count again a name let go since (4.2, 설계 검토 기록 8 F5)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, file = path.join(engine.stateDir, 'left-out-names.json'), a = path.join(src, 'a.'), b = path.join(src, 'b.');
  await fs.writeFile(exact(a), ''); await fs.writeFile(exact(b), ''); await fs.mkdir(path.join(src, '잠긴'));
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const fsp = require('node:fs/promises'), open = fsp.open, readdir = fsp.readdir;
  fsp.readdir = (x, ...rest) => x.endsWith(path.sep + '잠긴') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(x, ...rest);
  try {
    // `a.` renamed in a run whose names file cannot be written.
    await fs.rename(exact(a), a + 'txt');
    fsp.open = (x, ...rest) => String(x).startsWith(file + '.') ? Promise.reject(Object.assign(new Error('full'), { code: 'ENOSPC' })) : open(x, ...rest);
    advance(61 * 60000);
    try { await engine.runOnce({}); } finally { fsp.open = open; }
    advance(61 * 60000);
    assert.equal((await engine.runOnce({})).odd, 1);
    await fs.rename(exact(b), b + 'txt');
    advance(61 * 60000);
    assert.equal((await engine.runOnce({})).odd, undefined);
  } finally { fsp.readdir = readdir; }
});

test('when the chosen folders cannot all be looked at again in time, no name is let go (4.2, GPT r9 GA5)', async () => {
  const { engine, advance } = await fixture({ folders: 2 });
  const [usb] = engine.config.sources, sub = path.join(usb, 'sub'), file = path.join(engine.stateDir, 'left-out-names.json');
  await fs.mkdir(sub); await fs.writeFile(exact(path.join(sub, 'tail.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  // A walk out of time; the drive pulled once the backup is written down, and the folders looked at again out of time too.
  const fsp = require('node:fs/promises'), lstat = fsp.lstat;
  let pulled = false;
  engine.oddPending = async (...a) => { const r = await Object.getPrototypeOf(engine).oddPending.apply(engine, a); pulled = true; return r; };
  fsp.lstat = (x, ...rest) => pulled && String(x).startsWith(exact(usb)) ? Promise.reject(Object.assign(new Error('gone'), { code: 'ENOENT' })) : lstat(x, ...rest);
  const realStill = engine.oddLookBudgetMs;
  engine.oddWalkBudgetMs = 0;
  const looks = [];
  advance(61 * 60000);
  try {
    // The second look (the folders) finds its time gone: give the first all of it.
    engine.oddLookBudgetMs = 50;
    const orig = fsp.lstat;
    fsp.lstat = async (x, ...rest) => { looks.push(String(x)); if (String(x) === exact(usb) || String(x) === exact(engine.config.sources[1])) await new Promise(r => setTimeout(r, 120)); return orig(x, ...rest); };
    await engine.runOnce({});
  } finally { fsp.lstat = lstat; delete engine.oddPending; delete engine.oddWalkBudgetMs; if (realStill === undefined) delete engine.oddLookBudgetMs; else engine.oddLookBudgetMs = realStill; }
  assert.ok(JSON.parse(await fs.readFile(file, 'utf8')).names.includes(path.join(sub, 'tail.')), JSON.stringify(looks.slice(-4)));
});

test('1,001 names of 300 characters are all held (4.2, GPT r3 GA4)', async () => {
  const { engine, fail } = await fixture();
  await engine.setAutomatic(true);
  fail.scan = Array.from({ length: 1001 }, (_, i) => 'C:\\' + 'ㄱ'.repeat(310) + '\\' + String(i).padStart(4, '0') + '.');
  await engine.runOnce({});
  assert.deepEqual([engine.config.leftOutNames.count, engine.config.leftOutHeld.count, engine.config.leftOutHeld.cut], [1001, 1001, false]);
});

test('settings from before the names were held keep no count past the list (4.2, GPT r3 GA3)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources;
  await engine.setAutomatic(true);
  await engine.runOnce({});
  // As written before the names were held: 1,001 counted, 1,000 listed, all since moved out of the folders backed up.
  const names = Array.from({ length: 1000 }, (_, i) => path.join(src, '옮긴', `n${i}.`));
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 1001, names, cut: false };
  engine.config.leftOutHeld = null;
  engine.oddWalkBudgetMs = 0;
  advance(61 * 60000);
  const r = await engine.runOnce({});
  delete engine.oddWalkBudgetMs;
  assert.deepEqual([r.odd, engine.config.leftOutNames.count, engine.config.leftOutNames.checked], [undefined, 0, false]);
  assert.equal(engine.config.leftOutHeld?.cut || false, false, 'nor is it held that there may be more');
});

test('two files a folder that tells case apart holds stay two when one of them cannot be read (4.2, GPT r3 GA1)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, lower = path.join(src, 'docs', 'note.'), upper = path.join(src, 'Docs', 'note.');
  await fs.mkdir(path.join(src, 'docs')); await fs.writeFile(exact(lower), '');
  await fs.mkdir(path.join(src, '잠긴'));
  await engine.setAutomatic(true);
  await engine.runOnce({});
  // As in a folder that tells case apart: `Docs\note.` another file beside `docs\note.`, found before.
  await fs.writeFile(path.join(engine.stateDir, 'left-out-names.json'), JSON.stringify({ v: 1, id: 'held', names: [upper, lower], cut: false }));
  engine.config.leftOutHeld = { id: 'held', count: 2, cut: false };
  engine.config.leftOutNames = { at: engine.config.lastBackup.at, count: 2, names: [upper, lower], cut: false };
  const fsp = require('node:fs/promises'), readdir = fsp.readdir, lstat = fsp.lstat;
  fsp.readdir = (p, ...rest) => p === exact(src) ? readdir(p, ...rest).then(list => [...list, { name: 'Docs', isDirectory: () => true, isSymbolicLink: () => false }]) : p === exact(path.join(src, 'Docs')) ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  fsp.lstat = (p, ...rest) => p === exact(upper) ? Promise.resolve({ ino: 7n, dev: 7n, isDirectory: () => false }) : lstat(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 2); } finally { fsp.readdir = readdir; fsp.lstat = lstat; }
  assert.deepEqual(engine.config.leftOutNames.names, [upper, lower].sort());
});

test('a name found before is not told again under the spelling Windows finds now (4.2, GPT r2 GA3)', async () => {
  const { engine, fail, advance } = await fixture();
  const [src] = engine.config.sources;
  await fs.mkdir(path.join(src, 'Docs')); await fs.writeFile(exact(path.join(src, 'Docs', 'note.')), '');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  // Renamed `docs`, which cannot be read now; restic tells the name under the new spelling.
  await fs.rename(path.join(src, 'Docs'), path.join(src, 'docs'));
  fail.scan = [path.join(src, 'docs', 'note.')];
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  fsp.readdir = (p, ...rest) => p === exact(path.join(src, 'docs')) ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 1); } finally { fsp.readdir = readdir; }
  assert.deepEqual(engine.config.leftOutNames.names, [path.join(src, 'docs', 'note.')]);
});

test('a walk that could not read a folder keeps the names found in it before (4.2, GPT GA5)', async () => {
  const { engine, advance } = await fixture();
  const [src] = engine.config.sources, sub = path.join(src, '안쪽');
  await fs.mkdir(sub); await fs.writeFile(exact(path.join(sub, '메모 ')), 'a');
  await engine.setAutomatic(true);
  assert.equal((await engine.runOnce({})).odd, 1);
  const fsp = require('node:fs/promises'), readdir = fsp.readdir;
  const denied = () => Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' }));
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '안쪽') ? denied() : readdir(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 1); } finally { fsp.readdir = readdir; }
  assert.deepEqual(engine.config.leftOutNames.names, [path.join(sub, '메모 ')]);
  // Nor when the name itself cannot be looked at: only "not there" lets it go (설계 검토 F5).
  const lstat = fsp.lstat;
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + '안쪽') ? denied() : readdir(p, ...rest);
  fsp.lstat = (p, ...rest) => p.endsWith('메모 ') ? denied() : lstat(p, ...rest);
  advance(61 * 60000);
  try { assert.equal((await engine.runOnce({})).odd, 1); } finally { fsp.readdir = readdir; fsp.lstat = lstat; }
  // Read again, it is looked at again.
  await fs.rename(exact(path.join(sub, '메모 ')), path.join(sub, '메모.txt'));
  advance(61 * 60000);
  assert.equal((await engine.runOnce({})).odd, undefined);
});

test('the backup is written down before the walk of the folders (4.2, 설계 검토 F7)', async () => {
  const { engine, snapshots, advance, fail } = await fixture();
  const [src] = engine.config.sources;
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const fsp = require('node:fs/promises'), readdir = fsp.readdir, save = engine.save;
  let saved = null, atWalk;
  engine.save = async function (...a) { saved = JSON.parse(JSON.stringify({ id: this.config.lastBackup?.id, left: this.config.leftOutNames, warning: this.config.warning })); return save.apply(this, a); };
  // The walk's first read of the folder (not the check of the chosen folders before the backup — the same path off Windows).
  fsp.readdir = (p, ...rest) => { if (p === exact(src) && rest[0]?.withFileTypes && atWalk === undefined) atWalk = saved; return readdir(p, ...rest); };
  fail.scan = [path.join(src, '알린 메모.')];
  advance(61 * 60000);
  try { await engine.runOnce({}); } finally { fsp.readdir = readdir; engine.save = save; }
  assert.equal(atWalk?.id, snapshots.find(x => x.tags.includes(VERIFIED) && x.id === engine.config.lastBackup.id)?.id);
  assert.notEqual(atWalk?.id, undefined);
  // With the names as known so far, not yet looked through (r2 GA1).
  assert.deepEqual([atWalk.left?.names, atWalk.left?.checked], [[path.join(src, '알린 메모.')], false]);
  assert.match(atWalk.warning, /파일이나 폴더 1개를 이번 백업에 담지 못했습니다\. 이번에는 폴더를 다 보지 못해 더 있을 수 있습니다/);
  assert.deepEqual([engine.config.leftOutNames.checked, engine.config.leftOutNames.count], [undefined, 1]);
});

test('names are told apart by case: a folder may hold both `A.` and `a.` (4.2, GPT GA3)', () => {
  assert.deepEqual(topMost(['C:\\x\\a.', 'C:\\x\\A.', 'C:\\x\\A.\\b ', 'C:/x/a.']), ['C:\\x\\A.', 'C:\\x\\a.']);
});

test('the walk reads folders only, keeps the topmost of such names and stops on time (4.2)', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-walk-'));
  await fs.mkdir(exact(path.join(root, 'a.'))); await fs.writeFile(exact(path.join(root, 'a.', 'b.')), 'x');
  await fs.mkdir(path.join(root, 'c')); await fs.writeFile(exact(path.join(root, 'c', 'd ')), 'y'); await fs.writeFile(path.join(root, 'c', 'e.txt'), 'z');
  const all = await walkOdd([root], { budgetMs: 60000, max: 10 });
  assert.deepEqual([all.names.sort(), all.more, all.done], [[path.join(root, 'a.'), path.join(root, 'c', 'd ')].sort(), false, true]);
  const one = await walkOdd([root], { budgetMs: 60000, max: 1 });
  assert.deepEqual([one.names.length, one.more, one.done], [1, true, true]);
  assert.deepEqual(await walkOdd([root], { budgetMs: 0, max: 10 }), { names: [], more: false, done: false, failed: 0, unread: [], unreadCut: false });
  // A folder still being read when the time is up is not waited for (GPT GA4); one that cannot be read is counted (GA5).
  const fsp = require('node:fs/promises'), readdir = fsp.readdir, t0 = Date.now();
  const hung = [];
  fsp.readdir = () => new Promise(r => hung.push(r));
  try {
    for (let i = 0; i < 3; i++) assert.deepEqual(await walkOdd([root], { budgetMs: 50, max: 10 }), { names: [], more: false, done: false, failed: 0, unread: [], unreadCut: false });
    // A read left behind holds its place until it answers, for the next walk too (r2 GA5): two in all.
    assert.equal(hung.length, 2);
  } finally { fsp.readdir = readdir; }
  assert.ok(Date.now() - t0 < 5000);
  // With both places held so, a walk that gets none ends at the wait for one, not at its deadline (설계 검토 기록 2 F2).
  const t1 = Date.now();
  assert.deepEqual(await walkOdd([root], { budgetMs: 60000, max: 10, slotWaitMs: 50 }), { names: [], more: false, done: false, failed: 0, unread: [], unreadCut: false });
  assert.ok(Date.now() - t1 < 5000);
  // One read left behind: a walk through many folders hangs nothing on it, folder by folder (r3 GA2).
  hung[0]([]);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(oddReads.size, 1);
  const stale = [...oddReads][0], many = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-many-'));
  for (let i = 0; i < 30; i++) await fs.mkdir(path.join(many, 'f' + i));
  const then = Promise.prototype.then; let hits = 0;
  Promise.prototype.then = function (...a) { if (this === stale) hits++; return then.apply(this, a); };
  let through;
  try { through = await walkOdd([many], { budgetMs: 60000, max: 10 }); } finally { Promise.prototype.then = then; }
  assert.deepEqual([through.done, hits], [true, 0]);
  hung[1]([]);
  await new Promise(r => setTimeout(r, 20));
  await new Promise(r => setTimeout(r, 20));
  // Looking again stops at its deadline: what it did not get to stays (r2 GA4).
  const lstat = fsp.lstat, looks = [];
  fsp.lstat = () => new Promise(r => looks.push(r));
  try { assert.deepEqual(await stillThere(['C:\\x\\a.', 'C:\\x\\b.'], Date.now() + 50), { names: ['C:\\x\\a.', 'C:\\x\\b.'], done: false }); } finally { fsp.lstat = lstat; }
  for (const r of looks) r({});
  await new Promise(r => setTimeout(r, 20));
  // Nor does it begin one past its deadline, however fast they answer (설계 검토 기록 3 F3).
  fsp.lstat = () => Promise.resolve({});
  try { assert.deepEqual(await stillThere(['C:\\x\\a.', 'C:\\x\\b.'], Date.now() - 1), { names: ['C:\\x\\a.', 'C:\\x\\b.'], done: false }); } finally { fsp.lstat = lstat; }
  // A link it cannot look at is a folder not read (설계 검토 기록 2 F7).
  await fs.symlink(path.join(root, 'c'), path.join(root, 'j'), 'junction');
  fsp.lstat = (p, ...rest) => p.endsWith(path.sep + 'j') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : lstat(p, ...rest);
  try { assert.equal((await walkOdd([root], { budgetMs: 60000, max: 10 })).failed, 1); } finally { fsp.lstat = lstat; }
  fsp.readdir = (p, ...rest) => p.endsWith(path.sep + 'c') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(p, ...rest);
  try { assert.deepEqual(await walkOdd([root], { budgetMs: 60000, max: 10 }), { names: [path.join(root, 'a.')], more: false, done: true, failed: 1, unread: [path.join(root, 'c')], unreadCut: false }); } finally { fsp.readdir = readdir; }
  // Two folders at a time, so one that never answers leaves the other file work threads (설계 검토 F6).
  const wide = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-wide-'));
  for (let i = 0; i < 6; i++) await fs.mkdir(path.join(wide, 'f' + i));
  let reading = 0, most = 0;
  fsp.readdir = async (...a) => { reading++; most = Math.max(most, reading); try { await new Promise(r => setTimeout(r, 5)); return await readdir(...a); } finally { reading--; } };
  try { assert.equal((await walkOdd([wide], { budgetMs: 60000, max: 10 })).done, true); } finally { fsp.readdir = readdir; }
  assert.equal(most, 2);
  // Past 260 characters, as restic reads it.
  let deep = root; while (deep.length < 300) deep = path.join(deep, '긴 폴더 이름 ' + deep.length);
  await fs.mkdir(exact(deep), { recursive: true }); await fs.writeFile(exact(path.join(deep, '깊은 메모.')), 'w');
  assert.ok((await walkOdd([root], { budgetMs: 60000, max: 10 })).names.includes(path.join(deep, '깊은 메모.')));
});

test('every unreadable item is read from restic error lines, however the chunks fall (GPT GA4)', () => {
  const got = [];
  const reader = errorItems(item => got.push(item));
  const long = JSON.stringify({ message_type: 'error', during: 'archival', item: 'C:\\work\\long.pst', error: { message: 'x'.repeat(70000) } });
  const short = JSON.stringify({ message_type: 'error', during: 'archival', item: 'C:\\work\\short.xlsx', error: { message: 'locked' } });
  const text = `${long}\n{not json}\n${JSON.stringify({ message_type: 'exit_error', code: 3 })}\n${JSON.stringify({ message_type: 'error', error: { message: 'no item' } })}\n${short}`;
  for (let i = 0; i < text.length; i += 65537) reader.push(text.slice(i, i + 65537));
  reader.end();
  assert.deepEqual(got, ['C:\\work\\long.pst', 'C:\\work\\short.xlsx'], 'a line split across chunks and the last one without a newline');
  // An error that names no item is told apart from the items (4.17): the closing exit_error line is not one.
  const other = [], seen = []; const quiet = errorItems((item, during, message) => seen.push([item, message.slice(0, 6)]), (kind, line) => other.push([kind, line.slice(0, 8)]));
  quiet.push(text); quiet.push('\nD:\\gone does not exist, skipping\n'); quiet.end();
  assert.deepEqual([other, seen], [[['text', '{not jso'], ['error', '{"messag'], ['text', 'D:\\gone ']], [[got[0], 'xxxxxx'], [got[1], 'locked']]]);
  const lost = [];
  const big = errorItems(item => lost.push(item));
  big.push('x'.repeat(4194305)); big.push(`\n${short}\n`); big.end();
  assert.deepEqual(lost, [null, 'C:\\work\\short.xlsx'], 'a line too long to hold is reported as possibly lost, never dropped silently');
  // With the step it was met in (4.2 「이 백업에 담지 못하는 이름」): counting (scan), reading (archival), or none said.
  const steps = [];
  const told = errorItems((item, during) => steps.push([item, during]));
  told.push(`${JSON.stringify({ message_type: 'error', during: 'scan', item: 'C:\\work\\메모.' })}\n${short}\n${JSON.stringify({ message_type: 'error', item: 'C:\\x' })}\n`); told.end();
  assert.deepEqual(steps, [['C:\\work\\메모.', 'scan'], ['C:\\work\\short.xlsx', 'archival'], ['C:\\x', null]]);
});

test('a person-started run leaves a pause in place; a scheduled run respects it and clears it once expired (review B1)', async () => {
  const { engine, advance } = await fixture();
  await engine.setAutomatic(true);
  engine.config.pausedUntil = new Date(engine.now() + 3600000).toISOString();
  assert.deepEqual(await engine.runOnce({}), { outcome: 'skipped', reason: 'paused' });
  assert.equal((await engine.runOnce({ force: true })).outcome, 'complete');
  assert.ok(engine.config.pausedUntil, 'the pause is still set');
  advance(2 * 3600000);
  assert.equal((await engine.runOnce({})).outcome, 'complete');
  assert.equal(engine.config.pausedUntil, null);
});

test('when the full data check finds the repository busy, the sample restore and the cleanup wait (review B3)', async () => {
  const { engine, fail, calls, advance } = await fixture();
  await engine.setAutomatic(true);
  await engine.runOnce({});
  assert.equal(engine.config.health.status, 'ok');
  advance(25 * 3600000);
  calls.length = 0; fail.readData = 11;
  assert.equal((await engine.runOnce({})).outcome, 'complete');
  assert.deepEqual(calls.filter(c => ['forget', 'prune', 'dump'].includes(c)), []);
  assert.match(engine.config.warning, /전체 데이터 점검은 다음 회차로/);
});

// 4.2 「사라진 원본 폴더」: a chosen folder that is not there (an unplugged drive, a folder moved or deleted).
test('a folder that cannot be found is left out; the others are backed up and the backups that hold it are kept', async () => {
  const { engine, seen, advance, snapshots, more } = await fixture({ folders: 2 });
  const [first, second] = engine.config.sources;
  await engine.setAutomatic(true);
  assert.equal((await engine.runOnce({})).outcome, 'complete');
  const held = snapshots.at(-1).id;
  await fs.rm(more[0], { recursive: true });
  advance(61 * 60000);
  const r = await engine.runOnce({});
  assert.equal(r.outcome, 'complete');
  assert.equal(r.missing, 1);
  assert.deepEqual(seen.backup.slice(seen.backup.indexOf('--') + 1), [first], 'only the folder that is there');
  assert.equal(engine.config.lastBackup.id, snapshots.at(-1).id);
  assert.deepEqual(engine.getState().missingSources, [second]);
  assert.match(engine.config.warning, /폴더 1개를 찾을 수 없어 그 폴더를 빼고 백업했습니다/);
  advance(2 * DAY);
  assert.equal((await engine.runOnce({})).missing, 1);
  assert.deepEqual(snapshots.map(s => s.id).sort(), [held, engine.config.lastBackup.id].sort(), 'the newest backup and the last one that has the missing folder');
  await fs.mkdir(more[0]);
  advance(2 * DAY);
  const back = await engine.runOnce({});
  assert.equal(back.outcome, 'complete');
  assert.equal(back.missing, undefined);
  assert.equal(engine.config.warning, null);
  assert.deepEqual(engine.getState().missingSources, []);
  assert.deepEqual(snapshots.map(s => s.id), [engine.config.lastBackup.id], 'found again: the hold goes');
});

test('with no chosen folder there the run fails, deletes nothing and says how many are missing', async () => {
  const { engine, snapshots, advance } = await fixture();
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const before = snapshots.map(s => s.id);
  await fs.rm(engine.config.sources[0], { recursive: true });
  advance(2 * DAY);
  const r = await engine.runOnce({});
  assert.equal(r.outcome, 'failed');
  assert.equal(r.missing, 1);
  assert.deepEqual(snapshots.map(s => s.id), before);
  assert.match(engine.config.lastError, /백업할 폴더를 모두 찾을 수 없습니다/);
});

test('only "not there" leaves a folder out: one that cannot be looked at, or is now a file, still stops the run', async () => {
  const { engine, snapshots, advance, more } = await fixture({ folders: 2 });
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const before = snapshots.length;
  const fsp = require('node:fs/promises'), lstat = fsp.lstat, second = engine.config.sources[1];
  fsp.lstat = async (p, ...rest) => { if (p === second) throw Object.assign(new Error('fixture denied'), { code: 'EPERM' }); return lstat(p, ...rest); };
  advance(61 * 60000);
  let r;
  try { r = await engine.runOnce({}); } finally { fsp.lstat = lstat; }
  assert.equal(r.outcome, 'failed');
  assert.equal(r.missing, undefined);
  await fs.rm(more[0], { recursive: true });
  await fs.writeFile(more[0], 'now a file');
  advance(61 * 60000);
  r = await engine.runOnce({});
  assert.equal(r.outcome, 'failed');
  assert.equal(r.missing, undefined);
  assert.equal(snapshots.length, before);
});

test('a missing folder keeps the newest complete backup that has it and, when newer, the newest partial one with its list', async () => {
  const { engine, fail, advance, snapshots, more } = await fixture({ folders: 2 });
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const complete = snapshots.at(-1).id;
  advance(61 * 60000); fail.backup = 3; fail.items = ['C:\\work\\mail.pst'];
  assert.equal((await engine.runOnce({})).outcome, 'partial');
  const partial = engine.config.lastPartial.id, list = snapshots.find(s => s.tags.includes('meta')).id;
  fail.backup = null; fail.items = [];
  await fs.rm(more[0], { recursive: true });
  advance(61 * 60000);
  assert.equal((await engine.runOnce({})).missing, 1);
  advance(2 * DAY);
  assert.equal((await engine.runOnce({})).missing, 1);
  assert.deepEqual(snapshots.map(s => s.id).sort(), [engine.config.lastBackup.id, complete, partial, list].sort());
});

// 끝판 카본 A1 · A2: the first backup is partial (a program kept a file open) and there is no complete one yet.
test('with no complete backup yet, a partial one takes its place — restorable, kept with its list; a later one does not', async () => {
  const { engine, fail, advance, snapshots } = await fixture();
  await engine.setAutomatic(true);
  fail.backup = 3; fail.items = ['C:\\work\\mail.pst'];
  const r = await engine.runOnce({});
  assert.equal(r.outcome, 'partial');
  const first = snapshots.find(s => s.tags.includes('partial'));
  assert.ok(first.tags.includes(VERIFIED), 'what a restore uses');
  assert.equal(engine.config.lastBackup.id, first.id);
  assert.equal(engine.config.lastPartial.id, first.id);
  assert.match(engine.config.warning, /파일 1개를 이번 백업에 담지 못했습니다/, 'its own warning, not a held-back cleanup');
  const firstList = snapshots.find(s => s.tags.includes('meta')).id;
  advance(2 * DAY);
  assert.equal((await engine.runOnce({})).outcome, 'partial');
  const second = engine.config.lastPartial.id;
  assert.notEqual(second, first.id);
  assert.equal(engine.config.lastBackup.id, first.id, 'a later partial one does not take the place');
  assert.ok(!snapshots.find(s => s.id === second).tags.includes(VERIFIED));
  const secondList = snapshots.filter(s => s.tags.includes('meta')).map(s => s.id).find(id => id !== firstList);
  assert.deepEqual(snapshots.map(s => s.id).sort(), [first.id, firstList, second, secondList].sort(), 'both kept, each with its list');
  fail.backup = null; fail.items = [];
  advance(2 * DAY);
  assert.equal((await engine.runOnce({})).outcome, 'complete');
  assert.deepEqual(snapshots.map(s => s.id), [engine.config.lastBackup.id], 'a complete one takes over and the rest go');
});

// GPT workbackup-missing GA1: a vault left by the previous version — partial snapshots with their lists, no complete one.
test('partial snapshots from before the complete place stay while that place is itself partial', async () => {
  const { engine, fail, advance, snapshots } = await fixture();
  await engine.setAutomatic(true);
  fail.backup = 3; fail.items = ['C:\\work\\a.pst'];
  await engine.runOnce({});
  // As the previous version left it: partial, its list, and no complete place.
  const old = snapshots.find(s => s.tags.includes('partial'));
  old.tags = old.tags.filter(t => t !== VERIFIED); engine.config.lastBackup = null;
  const oldList = snapshots.find(s => s.tags.includes('meta')).id;
  advance(2 * DAY); fail.items = ['C:\\work\\b.pst'];
  assert.equal((await engine.runOnce({})).outcome, 'partial');
  const place = engine.config.lastBackup.id;
  assert.notEqual(place, old.id);
  advance(2 * DAY);
  assert.equal((await engine.runOnce({})).outcome, 'partial');
  assert.ok(snapshots.some(s => s.id === old.id) && snapshots.some(s => s.id === oldList), 'b.pst is only in the old one: it stays with its list');
  assert.ok(snapshots.some(s => s.id === place));
  fail.backup = null; fail.items = [];
  advance(2 * DAY);
  assert.equal((await engine.runOnce({})).outcome, 'complete');
  assert.deepEqual(snapshots.map(s => s.id), [engine.config.lastBackup.id], 'a backup that reads everything ends it');
});

// 끝판 카본 workbackup-missing-20261114-b-끝판 A1: a folder no backup has read whole goes missing.
test('a missing folder whose complete place is a partial snapshot keeps the partial ones before it', async () => {
  const { engine, fail, advance, snapshots, more } = await fixture({ folders: 2 });
  await engine.setAutomatic(true);
  const second = engine.config.sources[1];
  fail.backup = 3; fail.items = [`${second}\\b1.pst`];
  await engine.runOnce({});
  // As the previous version left it: partial with its list, no complete place.
  const old = snapshots.find(s => s.tags.includes('partial'));
  old.tags = old.tags.filter(t => t !== VERIFIED); engine.config.lastBackup = null;
  const oldList = snapshots.find(s => s.tags.includes('meta')).id;
  advance(2 * DAY);
  await engine.runOnce({});
  const place = engine.config.lastBackup.id;
  fail.backup = null; fail.items = [];
  await fs.rm(more[0], { recursive: true });
  advance(61 * 60000);
  assert.equal((await engine.runOnce({})).missing, 1);
  advance(2 * DAY);
  assert.equal((await engine.runOnce({})).outcome, 'complete');
  const left = snapshots.map(s => s.id);
  assert.ok(left.includes(place) && left.includes(old.id) && left.includes(oldList), 'b1.pst is only in the old one');
});

// 끝판 카본 A2: a recommended-backup snapshot is neither the latest complete one here, nor kept, nor forgotten.
test('retain leaves recommended-backup snapshots alone and does not take one for the latest', async () => {
  const { engine, advance, snapshots } = await fixture();
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const foreign = { id: 'f'.repeat(64), time: new Date(Date.now() + 10 * DAY).toISOString(), hostname: engine.config.vaultId, paths: ['C:\\elsewhere'], tags: ['solo-work-backup-v1', `vault:${engine.config.vaultId}`, VERIFIED, 'recommended-verified-v1'] };
  const past = { ...foreign, id: 'e'.repeat(64), time: new Date(Date.now() - 10 * DAY).toISOString() };
  snapshots.push(foreign, past);
  advance(2 * DAY);
  assert.equal((await engine.runOnce({})).outcome, 'complete');
  assert.equal(engine.config.warning, null, 'cleaned up, not held back');
  assert.deepEqual(snapshots.map(s => s.id).sort(), [engine.config.lastBackup.id, foreign.id, past.id].sort());
});

// 끝판 카본 nowstate A1: a folder no complete backup holds, while every run is partial.
test('a folder no complete backup holds keeps its first and newest partial ones, not every one', async () => {
  const { engine, fail, advance, snapshots, more } = await fixture({ folders: 2 });
  await fs.rm(more[0], { recursive: true });
  await engine.setAutomatic(true);
  assert.equal((await engine.runOnce({})).missing, 1, 'the first complete backup lacks the second folder');
  await fs.mkdir(more[0]);
  fail.backup = 3; fail.items = ['C:\\work\\mail.pst'];
  const partials = [];
  for (let i = 0; i < 3; i++) { advance(2 * DAY); assert.equal((await engine.runOnce({})).outcome, 'partial'); partials.push(engine.config.lastPartial.id); }
  const left = snapshots.filter(s => !s.tags.includes('meta')).map(s => s.id);
  assert.deepEqual(left.sort(), [engine.config.lastBackup.id, partials[0], partials[2]].sort(), 'the middle one goes');
});

// 4.2 정리 규칙 「U 파일마다 그 파일이 든 가장 새 판」 (GPT nowstate-c GA1).
const metaIds = snapshots => snapshots.filter(s => s.tags.includes('meta')).map(s => s.id);
test('a path the newest partial backup could not read keeps the newest older backup that read it', async () => {
  const { engine, fail, advance, snapshots } = await fixture();
  const inFolder = name => path.join(engine.config.sources[0], name);
  await engine.setAutomatic(true);
  await engine.runOnce({});
  advance(61 * 60000); fail.backup = 3; fail.items = [inFolder('mail.pst')];
  await engine.runOnce({});
  const reader = engine.config.lastPartial.id;
  advance(2 * DAY); fail.items = [inFolder('report.txt')];
  await engine.runOnce({});
  const ids = snapshots.map(s => s.id);
  assert.ok(ids.includes(reader), 'report.txt is newest in the earlier partial backup: it stays');
  assert.equal(metaIds(snapshots).length, 2, 'with its list');
});

test('a file no backup could read keeps nothing more: one always locked does not keep every hour', async () => {
  const { engine, fail, advance, snapshots } = await fixture();
  const locked = path.join(engine.config.sources[0], 'mail.pst');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const complete = engine.config.lastBackup.id;
  fail.backup = 3; fail.items = [locked];
  for (let i = 0; i < 3; i++) { advance(2 * DAY); assert.equal((await engine.runOnce({})).outcome, 'partial'); }
  assert.deepEqual(snapshots.filter(s => !s.tags.includes('meta')).map(s => s.id).sort(), [complete, engine.config.lastPartial.id].sort());
});

// GPT nowstate-c GA1 as found: a folder no complete backup holds, a file only the middle partial one read.
test('in a folder no complete backup holds, the middle partial backup that alone read a file stays', async () => {
  const { engine, fail, advance, snapshots, more } = await fixture({ folders: 2 });
  await fs.rm(more[0], { recursive: true });
  await engine.setAutomatic(true);
  await engine.runOnce({});
  await fs.mkdir(more[0]);
  const report = path.join(engine.config.sources[1], 'report.txt'), mail = path.join(engine.config.sources[0], 'mail.pst');
  fail.backup = 3;
  const partials = [];
  for (const items of [[report], [mail], [report]]) { advance(2 * DAY); fail.items = items; await engine.runOnce({}); partials.push(engine.config.lastPartial.id); }
  const ids = snapshots.map(s => s.id);
  assert.ok(ids.includes(partials[1]), 'the only copy of report.txt');
  assert.ok(ids.includes(partials[0]) && ids.includes(partials[2]));
});

test('lists are kept in the state folder, read from the repository when missing, and dropped with their snapshots', async () => {
  const { engine, fail, advance, snapshots, calls } = await fixture();
  const inFolder = name => path.join(engine.config.sources[0], name);
  const listDir = path.join(engine.stateDir, 'lists');
  await engine.setAutomatic(true);
  await engine.runOnce({});
  fail.backup = 3; fail.items = [inFolder('a.pst')];
  advance(61 * 60000); await engine.runOnce({});
  assert.deepEqual(await fs.readdir(listDir), metaIds(snapshots).map(id => `${id}.json`), 'kept when saved');
  await fs.rm(listDir, { recursive: true }); engine.listCache = null; calls.length = 0;
  advance(61 * 60000); fail.items = [inFolder('b.pst')]; await engine.runOnce({});
  assert.ok(calls.includes('dump'), 'read back from the repository');
  advance(2 * DAY); fail.items = [inFolder('c.pst')]; calls.length = 0; await engine.runOnce({});
  assert.ok(!calls.includes('dump'), 'then from the state folder');
  assert.deepEqual((await fs.readdir(listDir)).sort(), metaIds(snapshots).map(id => `${id}.json`).sort(), 'forgotten lists dropped');
});

// 4.2 「폴더 더하기 · 빼기」: folders change after setup; one taken out keeps its backups 30 days.
test('folders are added and taken out after setup — checked as at setup, at least one stays, one taken out is listed till its backups go', async () => {
  const { engine, advance, root } = await fixture({ folders: 2 });
  const [first, second] = engine.config.sources;
  const third = path.join(root, 'source3'); await fs.mkdir(third);
  await engine.changeSources([first, second, third]);
  assert.deepEqual(engine.config.sources, [first, second, await fs.realpath(third)]);
  await assert.rejects(engine.changeSources([first, second, third, path.join(root, 'nowhere')]), /ENOENT/);
  await fs.mkdir(path.join(first, 'sub'));
  await assert.rejects(engine.changeSources([first, second, third, path.join(first, 'sub')]), /서로 포함되는 작업 폴더/);
  await assert.rejects(engine.changeSources([first, engine.stateDir]), /겹칩니다/);
  await assert.rejects(engine.changeSources([]), /하나 이상/);
  await engine.changeSources([first, second, third.toUpperCase()]);
  assert.equal(engine.config.sources.length, 3, 'the same folder in other letters is no change');
  const at = Date.now(); advance(0);
  await engine.changeSources([first, third]);
  assert.deepEqual(engine.config.sources, [first, await fs.realpath(third)]);
  const [out] = engine.getState().removedSources;
  assert.equal(out.path, second);
  assert.equal(Date.parse(out.until) - Date.parse(out.at), 30 * DAY);
  assert.ok(Math.abs(Date.parse(out.at) - at) < 60000);
  await engine.changeSources([first, third, second]);
  assert.deepEqual(engine.getState().removedSources, [], 'added again: chosen as before');
  assert.equal(engine.config.removedSources, null);
  // A list of taken-out folders that is not as written is refused like any other settings fault.
  const settings = path.join(engine.stateDir, 'settings.json');
  for (const bad of [[{ path: 1, at: new Date().toISOString() }], [{ path: second, at: 'later' }], [{ path: second, at: new Date().toISOString(), since: 'x' }], {}]) {
    await fs.writeFile(settings, JSON.stringify({ ...engine.config, removedSources: bad }));
    await assert.rejects(new BackupEngine({ stateDir: engine.stateDir, resticPath: 'fixture', secretStore, runner: async () => '' }).open(), /설정 형식/);
  }
});

test('a folder taken out keeps its last backup 30 days from the first cleanup that saw it out, then it goes', async () => {
  const { engine, advance, snapshots } = await fixture({ folders: 2 });
  const [first] = engine.config.sources;
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const held = snapshots.at(-1).id;
  await engine.changeSources([first]);
  advance(61 * 60000);
  assert.equal((await engine.runOnce({})).outcome, 'complete');
  assert.deepEqual(snapshots.at(-1).paths, [first], 'only the folders chosen now');
  const { since, at } = engine.config.removedSources[0];
  assert.equal(since, snapshots.at(-1).time, 'the first cleanup that saw it out');
  assert.notEqual(since, at);
  assert.equal(engine.getState().removedSources[0].until, new Date(Date.parse(since) + 30 * DAY).toISOString(), 'counted from that cleanup');
  advance(2 * DAY); await engine.runOnce({});
  assert.deepEqual(snapshots.map(s => s.id).sort(), [held, engine.config.lastBackup.id].sort(), 'the newest backup and the last one with the folder');
  advance(27 * DAY); await engine.runOnce({});
  assert.ok(snapshots.some(s => s.id === held), 'still kept on day 29');
  advance(2 * DAY); await engine.runOnce({});
  assert.deepEqual(snapshots.map(s => s.id), [engine.config.lastBackup.id], 'gone after 30 days');
  assert.equal(engine.config.removedSources, null);
  assert.deepEqual(engine.getState().removedSources, []);
});

test('a missing folder taken out is no longer missing, and its notice goes', async () => {
  const { engine, advance, more } = await fixture({ folders: 2 });
  const [first] = engine.config.sources;
  await engine.setAutomatic(true);
  await engine.runOnce({});
  await fs.rm(more[0], { recursive: true });
  advance(61 * 60000);
  assert.equal((await engine.runOnce({})).missing, 1);
  assert.match(engine.config.warning, /찾을 수 없어/);
  await engine.changeSources([first]);
  assert.deepEqual(engine.getState().missingSources, []);
  assert.equal(engine.config.warning, null);
  assert.equal(engine.getState().removedSources.length, 1);
});

test('a read-only or unfinished connection cannot change its folders', async () => {
  const { engine } = await fixture();
  engine.config.readOnly = true;
  await assert.rejects(engine.changeSources([engine.config.sources[0]]), /백업을 설정한 뒤/);
  engine.config.readOnly = false; engine.config.repositoryId = null;
  await assert.rejects(engine.changeSources([engine.config.sources[0]]), /백업을 설정한 뒤/);
});

// 끝판 카본 folders A1: every backup since the folder went is partial (a program keeps a file open in another folder);
// the newer partial backup with the folder in it is the one a restore takes it from, and it stays.
for (const how of ['taken out', 'not found']) {
  test(`a folder ${how} while every later backup is partial keeps the newer partial backup that has it`, async () => {
    const { engine, fail, advance, snapshots, more } = await fixture({ folders: 2 });
    const [first] = engine.config.sources;
    await engine.setAutomatic(true);
    await engine.runOnce({});
    const complete = snapshots.at(-1).id;
    advance(61 * 60000); fail.backup = 3; fail.items = [path.join(first, 'mail.pst')];
    assert.equal((await engine.runOnce({})).outcome, 'partial');
    const newer = engine.config.lastPartial.id;
    assert.equal(snapshots.find(s => s.id === newer).paths.length, 2, 'it has both folders');
    if (how === 'taken out') await engine.changeSources([first]); else await fs.rm(more[0], { recursive: true });
    advance(61 * 60000); assert.equal((await engine.runOnce({})).outcome, 'partial');
    advance(2 * DAY); assert.equal((await engine.runOnce({})).outcome, 'partial');
    const ids = snapshots.map(s => s.id);
    assert.ok(ids.includes(complete), 'the complete one');
    assert.ok(ids.includes(newer), 'the newer partial one with the folder');
  });
}
