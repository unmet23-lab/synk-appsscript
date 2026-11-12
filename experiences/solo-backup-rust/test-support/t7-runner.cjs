'use strict';
// T7 final (STAGE1_DESIGN.md 4.3): the release run executable on synthetic data D1.
//   node t7-runner.cjs <WorkBackupRun.exe> <work-root> [dataMB=300] [incrementals=5]
// The executable must sit beside its sealed resources folder (scripts/build.ps1
// output). From runs.jsonl: run start → restic start, worker ready, bundle check,
// the Node worker's own peak working set, the job's peak commit and CPU time — for
// the first backup, unchanged-data runs and not-due runs. Then restic alone on the
// same data: the process a Rust-only run would still start (the comparison base).
// Rules: run start ≤ 3 s, and a Node run may use at most 100 MB more than Rust only.
// Test state only (SOLO_BACKUP_TEST_STATE); no network; no secret or path in result.json.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { setupLocal, setAutomatic, runExe } = require('./run-setup.cjs');
const { makeData, peakWorkingSet } = require('./t7-data.cjs');

const [exeArg, workRoot, dataMBArg, nArg] = process.argv.slice(2);
if (!exeArg || !workRoot) throw Error('usage: t7-runner.cjs <WorkBackupRun.exe> <work-root> [dataMB] [incrementals]');
const exe = path.resolve(exeArg), dataMB = Number(dataMBArg || 300), n = Number(nArg || 5);
// At least one unchanged run is needed to judge the start rule (review D1).
if (!(dataMB > 0) || !Number.isInteger(n) || n < 1) throw Error('dataMB > 0 and incrementals >= 1 required');
const restic = path.join(path.dirname(exe), 'resources', 'restic.exe');
const out = path.join(path.resolve(workRoot), `t7r-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const MB = v => v == null ? null : +(v / 1048576).toFixed(1);
const median = list => { const s = list.filter(v => v != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

function pick(line) {
  return { outcome: line.outcome, ms: line.ms, verifyMs: line.verifyMs ?? null, workerReadyMs: line.workerReadyMs ?? null, resticStartMs: line.resticStartMs ?? null,
    workerPeakMB: MB(line.workerPeakWorkingSetBytes), jobPeakCommitMB: MB(line.job?.peakJobBytes), jobPeakProcessMB: MB(line.job?.peakProcessBytes),
    jobCpuMs: line.job?.cpuMs ?? null, processes: line.job?.processes ?? null, filesNew: line.profiles?.local?.filesNew ?? null, dataAddedMB: MB(line.profiles?.local?.dataAdded) };
}
function summary(rows) {
  const keys = ['ms', 'verifyMs', 'workerReadyMs', 'resticStartMs', 'workerPeakMB', 'jobPeakCommitMB', 'jobPeakProcessMB', 'jobCpuMs'];
  return Object.fromEntries([['runs', rows.length], ['outcomes', [...new Set(rows.map(r => r.outcome))]], ...keys.map(k => [k, { median: median(rows.map(r => r[k])), max: Math.max(...rows.map(r => r[k] ?? -Infinity)) }])]);
}
async function resticAlone(env, repo, data) {
  const t = Date.now();
  const child = spawn(restic, ['-r', repo, 'backup', '--json', data], { env, windowsHide: true, stdio: 'ignore' });
  // Sample at once and every 250 ms; a run that ends before any sample reports null, not 0 (review D2).
  const exited = new Promise(ok => child.once('exit', ok));
  let peak = null; const sample = () => { const v = peakWorkingSet(child.pid); if (v) peak = Math.max(peak ?? 0, v); };
  sample(); const poll = setInterval(sample, 250);
  const code = await exited; clearInterval(poll);
  return { code, ms: Date.now() - t, peakWorkingSetMB: MB(peak) };
}

(async () => {
  if (!fs.existsSync(restic)) throw Error('resources/restic.exe missing beside the executable');
  const dirs = Object.fromEntries(['data', 'repo', 'keys', 'state', 'direct'].map(k => [k, path.join(out, k)]));
  for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true });
  const result = { node: process.version, restic: '0.19.1', dataMB, incrementals: n, data: makeData(dirs.data, dataMB) };
  await setupLocal({ state: dirs.state, restic, data: dirs.data, repoParent: dirs.repo, keyFile: path.join(dirs.keys, 'recovery.json') });
  const env = { ...process.env, SOLO_BACKUP_TEST_STATE: dirs.state };
  const codes = [];
  codes.push(await runExe(exe, ['--run', 'manual', '--test-mode'], env));               // first backup
  for (let i = 0; i < n; i++) codes.push(await runExe(exe, ['--run', 'manual', '--test-mode'], env)); // unchanged data
  await setAutomatic({ state: dirs.state, restic, enabled: true });                     // last attempt is recent: not due
  for (let i = 0; i < 3; i++) codes.push(await runExe(exe, ['--run', 'hourly', '--test-mode'], env));
  result.exitCodes = codes;
  const lines = fs.readFileSync(path.join(dirs.state, 'runs.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).map(pick);
  result.first = lines[0];
  result.unchanged = summary(lines.slice(1, 1 + n));
  result.notDue = summary(lines.slice(1 + n));

  // restic alone: same data, its own repository and cache, measure-only password.
  const renv = { SystemRoot: process.env.SystemRoot, RESTIC_PASSWORD: 'measure-only-' + crypto.randomBytes(8).toString('hex'), RESTIC_CACHE_DIR: path.join(out, 'cache-direct'), TEMP: process.env.TEMP, TMP: process.env.TMP };
  if (spawnSync(restic, ['-r', dirs.direct, 'init'], { env: renv, windowsHide: true }).status !== 0) throw Error('restic init failed');
  result.resticAlone = { first: await resticAlone(renv, dirs.direct, dirs.data), unchanged: [] };
  for (let i = 0; i < Math.min(n, 3); i++) result.resticAlone.unchanged.push(await resticAlone(renv, dirs.direct, dirs.data));

  // Judge only a complete measurement: every run exited 0, the backup runs completed with a
  // restic start and a worker peak, the hourly runs were not due (review GA4).
  const backups = lines.slice(0, 1 + n), waits = lines.slice(1 + n);
  const valid = codes.length === 4 + n && codes.every(c => c === 0) && backups.length === 1 + n && waits.length === 3
    && backups.every(l => l.outcome === 'complete' && l.resticStartMs != null && l.workerPeakMB != null)
    && waits.every(l => l.outcome === 'not-due' && l.workerPeakMB != null);
  // The start rule counts from the second run of the same build: the first run after an install
  // or update pays a one-time cost of opening new files (QA 11-12, STAGE1_DESIGN.md 4.3).
  const warm = backups.slice(1).map(l => l.resticStartMs), nodePeak = valid ? Math.max(...lines.map(l => l.workerPeakMB)) : null;
  result.rules = valid ? {
    firstRunStartMs: backups[0].resticStartMs, warmRunStartMaxMs: Math.max(...warm), runStartWithin3s: Math.max(...warm) <= 3000,
    // A Rust-only run has the same executable and restic; the Node worker is the difference.
    nodeWorkerPeakMB: nodePeak, nodeExtraWithin100MB: nodePeak <= 100,
  } : null;
  result.verdict = !valid ? 'invalid' : result.rules.runStartWithin3s && result.rules.nodeExtraWithin100MB ? 'stay-node' : 'port-to-rust';
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 1));
  console.log(JSON.stringify({ out, ...result }, null, 1));
})().catch(e => { console.error(e); process.exitCode = 1; });
