'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { BackupEngine, VERIFIED, DAY } = require('../src/engine.cjs');
const { protection, schedule } = require('../src/protection.cjs');
const { Profiles } = require('../src/profiles.cjs');
// Deliberately synthetic secret store, only in throwaway test directories.
const secretStore = { encrypt: text => Buffer.from('fixture-only:' + text), decrypt: bytes => bytes.toString().slice(13) };
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-protection-'));
  const source = path.join(root, 'source'), target = path.join(root, 'target'), keys = path.join(root, 'keys');
  await Promise.all([source, target, keys].map(p => fs.mkdir(p)));
  await fs.writeFile(path.join(source, 'work.txt'), '0123456789');
  let now = Date.now(), mode = 'normal', failBackup = false;
  const calls = [], snapshots = [], repositoryId = 'c'.repeat(64);
  const engine = new BackupEngine({ stateDir: path.join(root, 'state'), resticPath: 'fixture', secretStore, now: () => now, intervalMs: 3600000, runner: async (args, options) => {
    calls.push([...args]);
    if (args[0] === 'cat') return JSON.stringify({ id: repositoryId });
    if (args[0] === 'backup') {
      if (failBackup) throw new Error('fixture backup offline');
      snapshots.push({ id: crypto.randomBytes(32).toString('hex'), time: new Date(now).toISOString(), hostname: engine.config.vaultId, tags: args[args.indexOf('--tag') + 1].split(','), summary: { total_files_processed: 1, total_bytes_processed: 10 } });
    }
    if (args[0] === 'snapshots') { const tags = args[args.indexOf('--tag') + 1].split(','); return JSON.stringify(snapshots.filter(s => tags.every(t => s.tags.includes(t)))); }
    if (args[0] === 'tag') { const s = snapshots.find(s => s.id === args.at(-1)); s.tags = s.tags.filter(t => t !== 'pending').concat(VERIFIED); }
    if (args[0] === 'ls') {
      if (mode === 'limit') throw Object.assign(new Error('metadata limit'), { code: 'PROBE_LIMIT' });
      const nodes = [{ message_type: 'snapshot' }, { message_type: 'node', type: 'file', path: '/C/fixture/work.txt', size: mode === 'large' ? 9 * 1024 * 1024 : 10 }];
      await options.consumeStdout(Readable.from([Buffer.from(nodes.map(JSON.stringify).join('\n'))]));
    }
    if (args[0] === 'dump') {
      await options.consumeStdout(Readable.from([Buffer.from(mode === 'overrun' ? '01234567890' : mode === 'short' || mode === 'offline' ? '012' : '0123456789')]));
      if (mode === 'offline') throw new Error('fixture transport failure after short stream');
    }
    return '';
  } });
  await engine.open(); await engine.setup({ sources: [source], parent: target }); await engine.saveRecoveryKit(path.join(keys, 'key.json'));
  return { root, source, engine, calls, snapshots, now: () => now, advance: n => { now += n; }, mode: m => { mode = m; }, fail: value => { failBackup = value; } };
}

test('one-click preflight changes no startup/automatic settings on failure, owns one lock, and reports startup failure separately', async () => {
  const f = await fixture(); let registrations = 0;
  const original = f.engine.config.sources; f.engine.config.sources = [path.join(f.root, 'missing')];
  await assert.rejects(f.engine.protectNow({ registerStartup: async () => { registrations++; return true; } }), /ENOENT/);
  assert.equal(registrations, 0); assert.equal(f.engine.config.automatic, false);
  f.engine.config.sources = original;
  let release; const gate = new Promise(r => { release = r; });
  const run = f.engine.protectNow({ registerStartup: async () => { registrations++; await gate; return true; } });
  await assert.rejects(f.engine.protectNow({ registerStartup: async () => true }), /진행 중/);
  assert.equal(protection(f.engine.getState(), { now: f.now(), startupRegistered: true }).level, 'running');
  release(); await run;
  assert.equal(f.calls.filter(a => a[0] === 'backup').length, 1); assert.equal(f.engine.config.automatic, true);
  assert.equal(f.engine.config.protectRun.phase, 'done'); assert.equal(f.engine.config.lastProbe.result, 'passed');
  assert.equal(protection(f.engine.getState(), { now: f.now(), startupRegistered: true }).level, 'active');
  await f.engine.protectNow({ registerStartup: async () => { throw new Error('fixture Windows policy'); } });
  assert.match(f.engine.config.startupWarning, /Windows policy/); assert.equal(f.engine.config.protectRun.phase, 'done');
  assert.equal(protection(f.engine.getState(), { now: f.now(), startupRegistered: false }).level, 'partial');
  f.fail(true); await assert.rejects(f.engine.protectNow({ registerStartup: async () => true }), /offline/);
  assert.equal(f.engine.config.automatic, true); assert.equal(f.engine.config.protectRun.phase, 'failed');
  assert.equal(protection(f.engine.getState(), { now: f.now(), startupRegistered: true }).level, 'attention');
});

test('timed pause survives restart, manual backup preserves it, due wake catches up once, off stays off', async () => {
  const f = await fixture(); await f.engine.backupNow(); await f.engine.setAutomatic(true);
  for (const minutes of [0, '60', 15, 1440, Infinity]) await assert.rejects(f.engine.pauseAutomatic(minutes));
  await f.engine.pauseAutomatic(720); const until = f.engine.config.pausedUntil;
  const restart = new BackupEngine({ stateDir: f.engine.stateDir, resticPath: 'fixture', secretStore, runner: f.engine.runner, now: f.now, intervalMs: f.engine.intervalMs });
  await restart.open(); assert.equal(restart.config.pausedUntil, until);
  let count = f.calls.filter(a => a[0] === 'backup').length;
  await restart.tick(); assert.equal(f.calls.filter(a => a[0] === 'backup').length, count);
  await f.engine.backupNow(); assert.equal(f.engine.config.pausedUntil, until); count++;
  f.advance(720 * 60000 + 1);
  await Promise.all([f.engine.tick(), f.engine.tick()]);
  assert.equal(f.calls.filter(a => a[0] === 'backup').length, count + 1); assert.equal(f.engine.config.pausedUntil, null);
  assert.ok(!f.calls.some(a => a[0] === 'forget')); // earlier copies still within 24h
  await f.engine.setAutomatic(false); f.advance(2 * DAY); await f.engine.tick();
  assert.equal(f.calls.filter(a => a[0] === 'backup').length, count + 1);
  await assert.rejects(f.engine.resumeAutomatic());
});

test('sample size failures hold retention without changing full-check health or causing full downloads; skips never clear the hold', async () => {
  const f = await fixture(); await f.engine.backupNow(); const health = structuredClone(f.engine.config.health);
  assert.equal(f.engine.config.lastProbe.result, 'passed'); assert.equal(f.engine.config.lastProbe.files, 1);
  assert.ok(!JSON.stringify(f.engine.config.lastProbe).includes('sha256'));
  assert.deepEqual(await fs.readdir(path.join(f.engine.stateDir, 'temp')), []);
  for (const mode of ['short', 'overrun']) { f.mode(mode); await f.engine.probeRestore(); assert.equal(f.engine.config.lastProbe.result, 'failed'); assert.ok(f.engine.config.probeHold); }
  assert.deepEqual(f.engine.config.health, health); await assert.rejects(f.engine.retain(), /정리할 수 없습니다/);
  const checks = f.calls.filter(a => a.includes('--read-data')).length;
  f.advance(2 * 3600000); await f.engine.backupNow();
  assert.equal(f.calls.filter(a => a.includes('--read-data')).length, checks);
  assert.ok(!f.calls.some(a => a[0] === 'forget' || a[0] === 'prune'));
  f.mode('large'); await f.engine.probeRestore(); assert.equal(f.engine.config.lastProbe.result, 'skipped'); assert.ok(f.engine.config.probeHold);
  f.mode('offline'); await f.engine.probeRestore(); assert.equal(f.engine.config.lastProbe.result, 'incomplete'); assert.ok(f.engine.config.probeHold);
  await f.engine.checkRepository(); assert.equal(f.engine.config.probeHold, null);
  f.mode('offline'); await f.engine.probeRestore(); assert.equal(f.engine.config.probeHold, null);
  f.mode('short'); await f.engine.probeRestore(); assert.ok(f.engine.config.probeHold);
  f.mode('normal'); await f.engine.probeRestore(); assert.equal(f.engine.config.lastProbe.result, 'passed'); assert.equal(f.engine.config.probeHold, null);
});

test('sample rechecks the held snapshot and cannot clear unrelated backup errors or interrupted protection', async () => {
  const f = await fixture(); await f.engine.backupNow(); const first = f.engine.config.lastBackup.id;
  f.mode('short'); await f.engine.probeRestore(); assert.equal(f.engine.config.probeHold.snapshotId, first);
  f.advance(2 * 3600000); f.mode('normal'); await f.engine.backupNow(); const second = f.engine.config.lastBackup.id; assert.notEqual(first, second);
  await f.engine.probeRestore(); assert.equal(f.engine.config.lastProbe.snapshotId, first); assert.equal(f.engine.config.probeHold, null);
  await f.engine.probeRestore(); assert.equal(f.engine.config.lastProbe.snapshotId, second);
  await f.engine.setAutomatic(true); f.fail(true); await assert.rejects(f.engine.backupNow()); const error = f.engine.config.lastError;
  const journal = { phase: 'backup', startedAt: new Date(f.now()).toISOString() }; f.engine.config.protectRun = journal;
  for (const mode of ['normal', 'large', 'offline']) { f.mode(mode); await f.engine.probeRestore(); assert.equal(f.engine.config.lastError, error); assert.deepEqual(f.engine.config.protectRun, journal); assert.equal(protection(f.engine.getState(), { now: f.now(), startupRegistered: true }).level, 'attention'); }
  f.mode('short'); await f.engine.probeRestore(); f.snapshots.splice(f.snapshots.findIndex(s => s.id === second), 1); f.mode('normal'); await f.engine.probeRestore(); assert.equal(f.engine.config.lastProbe.result, 'skipped'); assert.ok(f.engine.config.probeHold);
});

test('large metadata skip waits 30 days, normal samples wait seven days, and read-only profiles cannot start new write workflows', async () => {
  const f = await fixture(); f.mode('limit'); await f.engine.backupNow(); assert.equal(f.engine.config.lastProbe.reason, 'limit');
  const listings = f.calls.filter(a => a[0] === 'ls').length;
  f.advance(8 * DAY); await f.engine.backupNow(); assert.equal(f.calls.filter(a => a[0] === 'ls').length, listings);
  f.advance(23 * DAY); f.mode('normal'); await f.engine.backupNow(); assert.equal(f.calls.filter(a => a[0] === 'ls').length, listings + 1);
  f.advance(6 * DAY); await f.engine.backupNow(); assert.equal(f.calls.filter(a => a[0] === 'ls').length, listings + 1);
  f.advance(2 * DAY); await f.engine.backupNow(); assert.equal(f.calls.filter(a => a[0] === 'ls').length, listings + 2);
  const before = f.calls.length;
  for (const patch of [{ mode: 'restore', readOnly: false }, { mode: 'backup', readOnly: true }]) {
    Object.assign(f.engine.config, patch);
    for (const action of [() => f.engine.protectNow(), () => f.engine.pauseAutomatic(60), () => f.engine.resumeAutomatic(), () => f.engine.probeRestore()]) await assert.rejects(action(), /복구 전용/);
  }
  assert.equal(f.calls.length, before);
});

test('persisted attempt throttles restart retries and clock correction can be followed by an explicit new backup', async () => {
  const f = await fixture(); await f.engine.setAutomatic(true); f.fail(true); await f.engine.tick();
  const count = f.calls.filter(a => a[0] === 'backup').length;
  const restart = new BackupEngine({ stateDir: f.engine.stateDir, resticPath: 'fixture', secretStore, runner: f.engine.runner, now: f.now, intervalMs: f.engine.intervalMs });
  await restart.open(); await restart.tick(); assert.equal(f.calls.filter(a => a[0] === 'backup').length, count);
  f.advance(-3600000); await f.engine.tick(); assert.equal(f.engine.getState().clockHold, true);
  f.fail(false); await f.engine.protectNow({ registerStartup: async () => true }); assert.equal(f.engine.getState().clockHold, false);
  assert.equal(f.engine.config.lastAttemptAt, new Date(f.now()).toISOString());
});

test('status keeps stale proof scoped and preferences unchanged; opening old/corrupt optional fields never writes settings', async () => {
  const f = await fixture(); await f.engine.backupNow(); await f.engine.setAutomatic(true); const now = f.now();
  const base = f.engine.getState(), view = patch => protection({ ...base, ...patch }, { now, startupRegistered: true });
  assert.equal(view({}).level, 'active');
  assert.equal(view({ lastProbe: { ...base.lastProbe, snapshotId: 'f'.repeat(64) } }).probeCurrent, false);
  assert.equal(view({ job: { kind: 'restore' }, lastError: 'failure' }).level, 'running');
  assert.equal(view({ mode: 'restore' }).level, 'restoreOnly');
  assert.equal(view({ automatic: false }).level, 'off');
  assert.equal(view({ clockHold: true, lastBackup: null }).nextAction, 'backup');
  assert.equal(view({ pausedUntil: new Date(now + 60000).toISOString() }).level, 'paused');
  assert.equal(view({ lastBackup: { ...base.lastBackup, at: new Date(now - 4 * 3600000).toISOString() } }).reason, 'overdue');
  assert.equal(view({ health: { status: 'ok', checkedAt: new Date(now - 35 * DAY).toISOString() } }).level, 'active');
  assert.equal(view({ health: { status: 'attention' }, pausedUntil: new Date(now + 60000).toISOString() }).reason, 'health');
  const conf = { ...f.engine.config, pausedUntil: 'bad', lastAttemptAt: {}, lastProbe: {}, protectRun: { phase: 'startup', startedAt: new Date(now).toISOString() }, automatic: false };
  const file = path.join(f.engine.stateDir, 'settings.json'); await fs.writeFile(file, JSON.stringify(conf)); const bytes = await fs.readFile(file);
  const reopened = new BackupEngine({ stateDir: f.engine.stateDir, resticPath: 'fixture', secretStore, runner: f.engine.runner, now: f.now }); await reopened.open();
  assert.equal(reopened.config.pausedUntil, null); assert.equal(reopened.config.lastProbe, null); assert.equal(reopened.config.automatic, false);
  assert.deepEqual(await fs.readFile(file), bytes); assert.equal(protection(reopened.getState(), { now }).interrupted, true);
  assert.equal(schedule({ ...conf, lastAttemptAt: new Date(now).toISOString(), pausedUntil: null, retryAfter: new Date(now + DAY).toISOString(), automatic: true }, 3600000, now).dueAt, now + DAY);
});

test('only configured cloud profile opens first; polling publishes changing time without enabling either profile', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-profile-default-'));
  const profiles = new Profiles({ root, resticPath: 'fixture', secretStore, runner: async () => '' });
  profiles.engines.local.open = async () => {};
  profiles.engines.b2.open = async () => { profiles.engines.b2.config = { repositoryId: 'a'.repeat(64), sources: [], automatic: false, mode: 'backup' }; };
  await profiles.open(); assert.equal(profiles.profile, 'b2');
  let events = 0; profiles.on('state', () => events++); profiles.tick();
  assert.equal(events, 1); assert.equal(profiles.engines.b2.config.automatic, false);
});
