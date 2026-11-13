'use strict';
// Stage 1 scheduled run (STAGE1_DESIGN.md 4.2): runOnce decides and reports one
// run; exit 11 is "busy" (no error, no health change); stale locks are unlocked first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { BackupEngine, VERIFIED, errorItems } = require('../src/engine.cjs');
const secretStore = { encrypt: text => Buffer.from('fixture-only:' + text), decrypt: bytes => bytes.toString().slice(13) };

async function fixture({ provider = 'local' } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-runonce-'));
  const source = path.join(root, 'source'), target = path.join(root, 'target'), keys = path.join(root, 'keys');
  await Promise.all([source, target, keys].map(p => fs.mkdir(p)));
  await fs.writeFile(path.join(source, 'work.txt'), 'hello');
  let now = Date.now(); const calls = [], snapshots = [], seen = {}, stdin = []; const fail = { backup: null, check: null, readData: null, items: [], list: null };
  const repositoryId = 'd'.repeat(64);
  const engine = new BackupEngine({ stateDir: path.join(root, 'state'), resticPath: 'fixture', secretStore, now: () => now, intervalMs: 3600000, runner: async (args, opts = {}) => {
    calls.push(args.includes('--stdin') ? 'backup-list' : args[0]); seen[args[0]] = args;
    const tagged = () => snapshots.push({ id: crypto.randomBytes(32).toString('hex'), time: new Date(now).toISOString(), hostname: engine.config.vaultId, tags: args[args.indexOf('--tag') + 1].split(','), summary: { total_files_processed: 1, total_bytes_processed: 5 } });
    // The list of a partial snapshot: its own stdin snapshot (4.2 「완료본 · 부분 판 · 채움 판」).
    if (args[0] === 'backup' && args.includes('--stdin')) { if (fail.list) throw Object.assign(new Error('fixture list'), { exitCode: fail.list }); stdin.push(opts.stdinText); if (!fail.listGhost) tagged(); return ''; }
    if (args[0] === 'cat') return JSON.stringify({ id: repositoryId });
    if (args[0] === 'backup') {
      // A real exit 3 (some files unreadable) still writes a pending snapshot (review B5).
      if (fail.backup && fail.backup !== 3) throw Object.assign(new Error('fixture backup'), { exitCode: fail.backup });
      snapshots.push({ id: crypto.randomBytes(32).toString('hex'), time: new Date(now).toISOString(), hostname: engine.config.vaultId, tags: args[args.indexOf('--tag') + 1].split(','), summary: { total_files_processed: 1, total_bytes_processed: 5 } });
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
    await engine.setup({ sources: [source], parent: target });
    await engine.saveRecoveryKit(path.join(keys, 'kit.json'));
  }
  return { engine, calls, fail, seen, snapshots, stdin, advance: ms => { now += ms; }, root };
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

test('every unreadable item is read from restic error lines, however the chunks fall (GPT GA4)', () => {
  const got = [];
  const reader = errorItems(item => got.push(item));
  const long = JSON.stringify({ message_type: 'error', during: 'archival', item: 'C:\\work\\long.pst', error: { message: 'x'.repeat(70000) } });
  const short = JSON.stringify({ message_type: 'error', during: 'archival', item: 'C:\\work\\short.xlsx', error: { message: 'locked' } });
  const text = `${long}\n{not json}\n${JSON.stringify({ message_type: 'exit_error', code: 3 })}\n${JSON.stringify({ message_type: 'error', error: { message: 'no item' } })}\n${short}`;
  for (let i = 0; i < text.length; i += 65537) reader.push(text.slice(i, i + 65537));
  reader.end();
  assert.deepEqual(got, ['C:\\work\\long.pst', 'C:\\work\\short.xlsx'], 'a line split across chunks and the last one without a newline');
  const lost = [];
  const big = errorItems(item => lost.push(item));
  big.push('x'.repeat(4194305)); big.push(`\n${short}\n`); big.end();
  assert.deepEqual(lost, [null, 'C:\\work\\short.xlsx'], 'a line too long to hold is reported as possibly lost, never dropped silently');
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
