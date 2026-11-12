'use strict';
// T7 preliminary (STAGE1_DESIGN.md 4.3): drive the real worker (dispatcher.cjs + forked engine) over the
// same stdio frames the Rust host uses, run one local backup of synthetic data, and measure
//   - worker ready time (spawn -> $boot answered), median of N fresh boots
//   - the Node worker's peak working set during the backup
//   - restic alone on the same data (the part a Rust-only run would also have)
// Usage: node t7-measure.cjs <restic.exe> <work-root on a roomy drive> [dataMB=300] [boots=5]
// Writes <work-root>/t7-<stamp>/result.json. No network, no secrets, test state only.
const fs = require('node:fs'), fsp = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const { spawn, spawnSync, execFileSync } = require('node:child_process');

const [restic, workRoot, dataMBArg, bootsArg] = process.argv.slice(2);
if (!restic || !workRoot) throw Error('usage: t7-measure.cjs <restic.exe> <work-root> [dataMB] [boots]');
const dataMB = Number(dataMBArg || 300), boots = Number(bootsArg || 5);
const pkg = path.resolve(__dirname, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(path.resolve(workRoot), `t7-${stamp}`);
fs.mkdirSync(out, { recursive: true });

const { makeData: makeDataAt, peakWorkingSet, memory } = require('./t7-data.cjs');
const makeData = (dir) => makeDataAt(dir, dataMB);

// A tiny stand-in for the Rust host: same frames, test-only answers for host calls.
function startWorker(stateDir, script) {
  const env = { SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR, USERPROFILE: process.env.USERPROFILE, APPDATA: process.env.APPDATA,
    LOCALAPPDATA: process.env.LOCALAPPDATA, TEMP: process.env.TEMP, TMP: process.env.TMP, SWB_ROOT: stateDir, SWB_RESTIC: restic,
    SWB_ENGINE_ROOT: path.join(pkg, 'engine'), SWB_TEST: '1' };
  const t0 = process.hrtime.bigint();
  const child = spawn(process.execPath, [path.join(pkg, 'worker', 'dispatcher.cjs')], { env, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  let buf = '', next = 0; const waiting = new Map(); const dialogs = [...script];
  const send = (o) => child.stdin.write(JSON.stringify({ v: 1, ...o }) + '\n');
  child.stdout.on('data', (d) => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1); const m = JSON.parse(line);
      if (m.call) {
        const a = m.args || []; let value, ok = true;
        if (m.method === 'secret.encrypt') value = Buffer.from(String(a[0])).toString('base64');
        else if (m.method === 'secret.decrypt') value = Buffer.from(String(a[0]), 'base64').toString();
        else if (m.method === 'startup.read') value = false;
        else if (m.method === 'engine.lock' || m.method === 'engine.unlock') value = true;
        else if (m.method === 'run.progress') value = null;
        else if (m.method.startsWith('dialog.')) { const d = dialogs.shift(); if (!d || d.method !== m.method) ok = false; else value = d.value; }
        else ok = false;
        send(ok ? { callResult: m.call, ok: true, value } : { callResult: m.call, ok: false, code: 'TEST_HOST' });
      } else if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    }
  });
  const call = (method, args = []) => new Promise((ok) => { const id = ++next; waiting.set(id, ok); send({ id, method, args }); });
  // Registered at spawn: an exit that comes before $shutdown resolves is not missed (review D3).
  const exited = new Promise((ok) => child.once('exit', ok));
  return { child, call, t0, exited };
}
// Worker frames: {ok, value: {ok, value: <state>}} for app methods.
async function idle(call) { for (let i = 0; i < 36000; i++) { const s = await call('getState'); const st = s.value?.value; if (s.ok && st && !st.job) return st; await new Promise((r) => setTimeout(r, 100)); } throw Error('TIMEOUT'); }

(async () => {
  const result = { node: process.version, restic: '0.19.1', dataMB, boots: [] };
  // 1) Boot time: fresh state dirs, $boot only, then $shutdown.
  for (let i = 0; i < boots; i++) {
    const w = startWorker(path.join(out, `boot-${i}`), []);
    fs.mkdirSync(path.join(out, `boot-${i}`), { recursive: true });
    const r = await w.call('$boot'); const ms = Number(process.hrtime.bigint() - w.t0) / 1e6;
    result.boots.push({ ok: r.ok === true, ms: +ms.toFixed(1) });
    await w.call('$shutdown'); await w.exited;
  }
  const sorted = result.boots.map((b) => b.ms).sort((a, b) => a - b); result.bootMedianMs = sorted[Math.floor(sorted.length / 2)];

  // 2) One local backup through the worker.
  const data = path.join(out, 'data'), repoParent = path.join(out, 'repo'), kit = path.join(out, 'kit', 'recovery.json');
  fs.mkdirSync(repoParent, { recursive: true }); fs.mkdirSync(path.dirname(kit), { recursive: true });
  result.data = makeData(data);
  const state = path.join(out, 'state'); fs.mkdirSync(state, { recursive: true });
  const w = startWorker(state, [
    { method: 'dialog.open', value: { canceled: false, filePaths: [data] } },
    { method: 'dialog.open', value: { canceled: false, filePaths: [repoParent] } },
    { method: 'dialog.save', value: { canceled: false, filePath: kit } },
  ]);
  const boot = await w.call('$boot'); result.backupBootOk = boot.ok === true;
  result.workerAfterBoot = memory(w.child.pid);
  for (const [m, a] of [['chooseSources', []], ['chooseTarget', []], ['setup', []], ['saveRecoveryKit', []]]) {
    const r = await w.call(m, a); if (!r.ok || r.value?.ok === false) { result.failedAt = m; result.error = r.value?.error || r.error; break; }
  }
  if (!result.failedAt) {
    const t1 = Date.now(); const r = await w.call('backupNow'); result.backupCall = r.ok && r.value?.ok !== false;
    const s = await idle(w.call); result.backupMs = Date.now() - t1; result.lastBackup = s.lastBackup ? { files: s.lastBackup.files, bytes: s.lastBackup.bytes } : null; result.lastError = s.lastError || null;
  }
  result.workerAfterBackup = memory(w.child.pid);
  result.workerPeakWorkingSetMB = result.workerAfterBackup.peakWorkingSetMB;
  await w.call('$shutdown'); await w.exited;

  // 3) restic alone on the same data (a Rust-only run would still have this process).
  const repo2 = path.join(out, 'repo-direct');
  const env = { SystemRoot: process.env.SystemRoot, RESTIC_PASSWORD: 'measure-only-' + crypto.randomBytes(8).toString('hex'), RESTIC_CACHE_DIR: path.join(out, 'cache-direct'), TEMP: process.env.TEMP, TMP: process.env.TMP };
  spawnSync(restic, ['-r', repo2, 'init'], { env, windowsHide: true });
  const t2 = Date.now();
  const rc = spawn(restic, ['-r', repo2, 'backup', '--json', data], { env, windowsHide: true, stdio: 'ignore' });
  let resticPeak = 0; const poll = setInterval(() => { const v = peakWorkingSet(rc.pid); if (v) resticPeak = Math.max(resticPeak, v); }, 1000);
  const code = await new Promise((ok) => rc.once('exit', ok)); clearInterval(poll);
  result.resticDirect = { code, ms: Date.now() - t2, peakWorkingSetMB: +(resticPeak / 1048576).toFixed(1) };

  // 4) What a scheduled run would hash at start if it verified the whole bundle (F30).
  // SWB_BUNDLE_RESOURCES: an installed test build's resources folder (optional).
  const installed = process.env.SWB_BUNDLE_RESOURCES;
  if (installed && fs.existsSync(installed)) {
    const t3 = Date.now(); let bytes = 0;
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { const b = fs.readFileSync(p); bytes += b.length; crypto.createHash('sha256').update(b).digest(); } } };
    walk(installed); result.fullBundleHash = { MB: +(bytes / 1048576).toFixed(1), ms: Date.now() - t3 };
  }
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 1));
  console.log(JSON.stringify({ out, ...result }, null, 1));
})().catch((e) => { console.error(e); process.exitCode = 1; });
