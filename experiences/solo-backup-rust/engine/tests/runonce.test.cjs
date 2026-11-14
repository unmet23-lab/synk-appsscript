'use strict';
// Stage 1 scheduled run (STAGE1_DESIGN.md 4.2): runOnce decides and reports one
// run; exit 11 is "busy" (no error, no health change); stale locks are unlocked first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { BackupEngine, VERIFIED, DAY, errorItems } = require('../src/engine.cjs');
const secretStore = { encrypt: text => Buffer.from('fixture-only:' + text), decrypt: bytes => bytes.toString().slice(13) };

async function fixture({ provider = 'local', folders = 1 } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-runonce-'));
  const source = path.join(root, 'source'), target = path.join(root, 'target'), keys = path.join(root, 'keys');
  const more = Array.from({ length: folders - 1 }, (_, i) => path.join(root, `source${i + 2}`));
  await Promise.all([source, target, keys, ...more].map(p => fs.mkdir(p)));
  await fs.writeFile(path.join(source, 'work.txt'), 'hello');
  let now = Date.now(); const calls = [], snapshots = [], seen = {}, stdin = []; const fail = { backup: null, check: null, readData: null, items: [], list: null };
  const repositoryId = 'd'.repeat(64);
  const engine = new BackupEngine({ stateDir: path.join(root, 'state'), resticPath: 'fixture', secretStore, now: () => now, intervalMs: 3600000, runner: async (args, opts = {}) => {
    calls.push(args.includes('--stdin') ? 'backup-list' : args[0]); seen[args[0]] = args;
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
