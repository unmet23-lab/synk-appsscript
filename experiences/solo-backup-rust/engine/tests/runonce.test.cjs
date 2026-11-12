'use strict';
// Stage 1 scheduled run (STAGE1_DESIGN.md 4.2): runOnce decides and reports one
// run; exit 11 is "busy" (no error, no health change); stale locks are unlocked first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { BackupEngine, VERIFIED } = require('../src/engine.cjs');
const secretStore = { encrypt: text => Buffer.from('fixture-only:' + text), decrypt: bytes => bytes.toString().slice(13) };

async function fixture({ provider = 'local' } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-runonce-'));
  const source = path.join(root, 'source'), target = path.join(root, 'target'), keys = path.join(root, 'keys');
  await Promise.all([source, target, keys].map(p => fs.mkdir(p)));
  await fs.writeFile(path.join(source, 'work.txt'), 'hello');
  let now = Date.now(); const calls = [], snapshots = [], seen = {}; const fail = { backup: null, check: null, readData: null };
  const repositoryId = 'd'.repeat(64);
  const engine = new BackupEngine({ stateDir: path.join(root, 'state'), resticPath: 'fixture', secretStore, now: () => now, intervalMs: 3600000, runner: async (args) => {
    calls.push(args[0]); seen[args[0]] = args;
    if (args[0] === 'cat') return JSON.stringify({ id: repositoryId });
    if (args[0] === 'backup') {
      if (fail.backup) throw Object.assign(new Error('fixture backup'), { exitCode: fail.backup });
      snapshots.push({ id: crypto.randomBytes(32).toString('hex'), time: new Date(now).toISOString(), hostname: engine.config.vaultId, tags: args[args.indexOf('--tag') + 1].split(','), summary: { total_files_processed: 1, total_bytes_processed: 5 } });
      return '';
    }
    if (args[0] === 'check' && args.includes('--read-data') && fail.readData) throw Object.assign(new Error('fixture lock'), { exitCode: fail.readData });
    if (args[0] === 'check' && fail.check) throw Object.assign(new Error('fixture lock'), { exitCode: fail.check });
    if (args[0] === 'snapshots') { const tags = args[args.indexOf('--tag') + 1].split(','); return JSON.stringify(snapshots.filter(s => tags.every(t => s.tags.includes(t))).sort((a, b) => Date.parse(b.time) - Date.parse(a.time))); }
    if (args[0] === 'tag') { const s = snapshots.find(s => s.id === args.at(-1)); s.tags = s.tags.filter(t => t !== 'pending').concat(VERIFIED); }
    return '';
  } });
  await engine.open();
  if (provider === 'local') {
    await engine.setup({ sources: [source], parent: target });
    await engine.saveRecoveryKit(path.join(keys, 'kit.json'));
  }
  return { engine, calls, fail, seen, advance: ms => { now += ms; }, root };
}

test('not configured, off and read-only are skipped without running restic', async () => {
  const empty = await fixture({ provider: 'none' });
  assert.deepEqual(await empty.engine.runOnce({}), { outcome: 'skipped', reason: 'not-configured' });
  const { engine, calls } = await fixture();
  calls.length = 0;
  assert.deepEqual(await engine.runOnce({}), { outcome: 'skipped', reason: 'off' });
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
  const { engine, fail, advance } = await fixture();
  await engine.setAutomatic(true);
  await engine.runOnce({});
  const before = engine.config.lastBackup.id;
  advance(61 * 60000); fail.backup = 3;
  const r = await engine.runOnce({});
  assert.equal(r.outcome, 'partial');
  assert.equal(engine.config.lastBackup.id, before);
});
