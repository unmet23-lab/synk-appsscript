'use strict';
// WorkBackupRun.exe end to end (STAGE1_DESIGN.md 4.2): the Rust run executable
// starts the worker in run mode, records one line per run in runs.jsonl and never
// writes a path there. Needs a debug build in SWB_RUN_EXE (it reads resources
// from SWB_RESOURCES) and the pinned restic in SOLO_BACKUP_RESTIC. The profile is
// set up in app mode with the real DPAPI secret format (test-support/run-setup.cjs)
// so the executable can read it. Test state lives in a temp folder only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { stage } = require('../scripts/stage-resources.cjs');
const { setupLocal, runExe: run } = require('../test-support/run-setup.cjs');

const exe = process.env.SWB_RUN_EXE, restic = process.env.SOLO_BACKUP_RESTIC;

const runExe = (args, env) => run(exe, args, env, 240000);
const lines = state => fs.readFileSync(path.join(state, 'runs.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));

// Holds the state lock the way another process would (LockFileEx over the file).
function holdLock(file) {
  const child = spawn('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$f=[IO.File]::Open('${file.replaceAll("'", "''")}','OpenOrCreate','ReadWrite','ReadWrite');$f.Lock(0,[long]::MaxValue);[Console]::Out.WriteLine('locked');[Console]::In.ReadToEnd()|Out-Null;$f.Close()`],
    { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  return new Promise((resolve, reject) => {
    child.stdout.once('data', () => resolve({ release: () => new Promise(ok => { child.once('exit', ok); child.stdin.end(); }) }));
    child.once('exit', () => reject(Error('lock holder exited')));
  });
}

test('WorkBackupRun.exe: off → skipped, manual → complete, held lock → busy, records carry no paths', { skip: !exe || !restic, timeout: 600000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-runexe-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const data = path.join(root, 'data'), repo = path.join(root, 'repo'), keys = path.join(root, 'keys'), state = path.join(root, 'state'), inventory = path.join(root, 'inventory');
  for (const d of [data, repo, keys, state, inventory]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(data, '보고서.txt'), 'stage 1 run executable');
  // The run executable does not start the inventory tools; stand-ins keep the manifest whole.
  for (const name of ['WorkBackupInventory.exe', 'WorkBackupPlanner.exe']) fs.writeFileSync(path.join(inventory, name), 'stand-in');
  const resources = path.join(root, 'resources');
  await stage({ node: process.execPath, restic, output: resources, client: '--none', inventoryBin: inventory });

  await setupLocal({ state, restic, data, repoParent: repo, keyFile: path.join(keys, 'recovery.json') });

  const env = { ...process.env, SOLO_BACKUP_TEST_STATE: state, SWB_RESOURCES: resources };
  // Scheduler run with automatic off: recorded as skipped, no backup.
  assert.equal(await runExe(['--run', 'hourly', '--test-mode'], env), 0);
  let [off] = lines(state);
  assert.equal(off.trigger, 'hourly');
  assert.equal(off.outcome, 'skipped');
  assert.deepEqual(off.profiles.local, { outcome: 'skipped', reason: 'off' });
  assert.equal(typeof off.verifyMs, 'number');
  assert.equal(typeof off.power.saver, 'boolean');

  // 「지금 백업」: forced, completes a backup and reports the run measures.
  assert.equal(await runExe(['--run', 'manual', '--test-mode'], env), 0);
  const done = lines(state)[1];
  assert.equal(done.outcome, 'complete', JSON.stringify(done));
  assert.equal(done.skipCloud, null);
  assert.equal(done.profiles.local.newSnapshot, true);
  assert.equal(done.profiles.local.filesNew, 1);
  assert.deepEqual(done.profiles.local.unlock, { ran: true, ok: true, exitCode: null });
  for (const k of ['workerReadyMs', 'resticStartMs', 'workerPeakWorkingSetBytes', 'ms']) assert.equal(typeof done[k], 'number', k);
  assert.ok(done.job.peakJobBytes > 0 && done.job.processes >= 2, JSON.stringify(done.job));
  assert.ok(!fs.existsSync(path.join(state, 'progress.json')), 'progress file removed at the end');

  // Another process holds the engine lock (the window's own job or another run): busy, nothing else.
  const lock = await holdLock(path.join(state, 'engine.lock'));
  try { assert.equal(await runExe(['--run', 'unlock', '--test-mode'], env), 0); } finally { await lock.release(); }
  const busy = lines(state)[2];
  assert.deepEqual([busy.outcome, busy.reason, busy.profiles], ['busy', 'ui', undefined]);
  // An open window alone (ui.lock) does not stop a run (STAGE1_DESIGN.md 4.1).
  const window = await holdLock(path.join(state, 'ui.lock'));
  try { assert.equal(await runExe(['--run', 'manual', '--test-mode'], env), 0); } finally { await window.release(); }
  assert.equal(lines(state)[3].outcome, 'complete');

  // An interrupted move of the state folder stops the run.
  fs.writeFileSync(path.join(state, 'migration-incomplete'), '');
  assert.equal(await runExe(['--run', 'hourly', '--test-mode'], env), 1);
  fs.rmSync(path.join(state, 'migration-incomplete'));
  assert.equal(lines(state)[4].error, 'MIGRATION_INCOMPLETE');

  // Bad arguments and test mode without a test state folder record nothing.
  assert.equal(await runExe(['--run', 'daily', '--test-mode'], env), 64);
  const { SOLO_BACKUP_TEST_STATE, ...noState } = env;
  assert.equal(await runExe(['--run', 'hourly', '--test-mode'], noState), 70);
  assert.equal(lines(state).length, 5);
  // While the installer's marker is beside the executable a run ends at once and records nothing; one older than
  // 30 minutes (an interrupted install) no longer stops it (review GA3 — src-tauri/nsis/hooks.nsh).
  const installed = path.join(root, 'installed'), copy = path.join(installed, 'WorkBackupRun.exe'), marker = path.join(installed, '.installing');
  fs.mkdirSync(installed); fs.copyFileSync(exe, copy); fs.writeFileSync(marker, '');
  const started = Date.now();
  assert.equal(await run(copy, ['--run', 'manual', '--test-mode'], env, 60000), 0);
  assert.ok(Date.now() - started < 30000, 'ends at once');
  assert.equal(lines(state).length, 5, 'nothing recorded while installing');
  const stale = new Date(Date.now() - 31 * 60000); fs.utimesSync(marker, stale, stale);
  assert.equal(await run(copy, ['--run', 'manual', '--test-mode'], env, 240000), 0);
  assert.equal(lines(state)[5].outcome, 'complete', 'a stale marker does not stop a run');

  const text = fs.readFileSync(path.join(state, 'runs.jsonl'), 'utf8');
  for (const p of [root, data, repo, keys, os.homedir()]) {
    for (const form of [p, p.replaceAll(path.sep, '/')]) assert.ok(!text.includes(JSON.stringify(form).slice(1, -1)) && !text.includes(form), 'no path in runs.jsonl');
  }
  for (const name of ['보고서.txt', 'recovery.json', path.basename(root)]) assert.ok(!text.includes(name), 'no file or folder name in runs.jsonl');
});
