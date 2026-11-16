'use strict';
// Shared by tests/run-exe.test.cjs and test-support/t7-runner.cjs: set up a local
// profile through the worker in app mode, answering host calls the way the Rust
// host does — secrets in the real DPAPI format ('SWBR1' + CurrentUser blob,
// base64; src-tauri/src/secret.rs) so WorkBackupRun.exe can read them, dialogs
// from a script. Values reach pwsh through stdin only. Test state only.
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const pkg = path.resolve(__dirname, '..');

function dpapi(op, input) {
  const script = op === 'encrypt'
    ? "$t=[Console]::In.ReadToEnd();$b=[Text.Encoding]::UTF8.GetBytes($t);$p=[Security.Cryptography.ProtectedData]::Protect($b,$null,'CurrentUser');[Convert]::ToBase64String([byte[]](@(83,87,66,82,49)+$p))"
    : "$t=[Console]::In.ReadToEnd().Trim();$b=[Convert]::FromBase64String($t);$p=[Security.Cryptography.ProtectedData]::Unprotect([byte[]]$b[5..($b.Length-1)],$null,'CurrentUser');[Console]::Out.Write([Text.Encoding]::UTF8.GetString($p))";
  const r = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { input, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw Error('DPAPI ' + op);
  return op === 'encrypt' ? r.stdout.trim() : r.stdout;
}

/** `installed` (an install folder) runs that installation's own worker the way its window app does — its node.exe,
 *  worker, engine and restic, not in test mode, with `cacheDir` as restic's cache (the clean-Windows exercise stands
 *  in for the window this way). Without it: this source tree's worker in test mode. */
function appWorker(stateDir, { restic, dialogs = [], installed = null, cacheDir = null }) {
  const resources = installed && path.join(installed, 'resources');
  const env = { SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR, USERPROFILE: process.env.USERPROFILE, APPDATA: process.env.APPDATA,
    LOCALAPPDATA: process.env.LOCALAPPDATA, TEMP: process.env.TEMP, TMP: process.env.TMP, SWB_ROOT: stateDir,
    SWB_RESTIC: resources ? path.join(resources, 'restic.exe') : restic,
    SWB_ENGINE_ROOT: resources ? path.join(resources, 'engine') : path.join(pkg, 'engine'), SWB_TEST: resources ? '0' : '1' };
  if (resources) Object.assign(env, { USERDOMAIN: process.env.USERDOMAIN, USERNAME: process.env.USERNAME, SWB_CACHE_ROOT: cacheDir });
  const [node, dispatcher] = resources ? [path.join(resources, 'node.exe'), path.join(resources, 'worker', 'dispatcher.cjs')] : [process.execPath, path.join(pkg, 'worker', 'dispatcher.cjs')];
  const child = spawn(node, [dispatcher], { env, cwd: resources || undefined, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  let buf = '', next = 0; const waiting = new Map(); const script = [...dialogs];
  const send = o => child.stdin.write(JSON.stringify({ v: 1, ...o }) + '\n');
  child.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      if (m.call) {
        const a = m.args || []; let value, ok = true;
        try {
          if (m.method === 'secret.encrypt') value = dpapi('encrypt', String(a[0]));
          else if (m.method === 'secret.decrypt') value = dpapi('decrypt', String(a[0]));
          else if (m.method === 'startup.read') value = false;
          else if (m.method === 'engine.lock' || m.method === 'engine.unlock') value = true;
          else if (m.method === 'run.progress') value = null;
          else if (m.method.startsWith('dialog.')) { const d = script.shift(); ok = !!d && d.method === m.method; value = d?.value; }
          else ok = false;
        } catch { ok = false; }
        send(ok ? { callResult: m.call, ok: true, value } : { callResult: m.call, ok: false, code: 'TEST_HOST' });
      } else if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    }
  });
  let code = null;
  const exited = new Promise(ok => child.once('close', c => { code = c; for (const w of waiting.values()) w({ ok: false, value: { ok: false, code: 'WORKER_EXIT' } }); waiting.clear(); ok(c); }));
  const call = (method, args = []) => code !== null ? Promise.resolve({ ok: false, value: { ok: false, code: 'WORKER_EXIT' } })
    : new Promise(ok => { const id = ++next; waiting.set(id, ok); send({ id, method, args }); });
  // Always ends the worker, also after a failed step: it is asked to shut down, and ended if it has not in 30 s —
  // a worker left running keeps its parent (and a CI step) waiting for ever.
  async function close() {
    if (code === null) { const timer = setTimeout(() => child.kill(), 30000); await Promise.race([call('$shutdown'), exited]); await exited; clearTimeout(timer); }
    return code;
  }
  return { call, exited, close };
}
/** A step's failure, with the worker's own words (synthetic paths only in these tests), short. */
function failed(step, r) { return Error(`${step}: ${r?.value?.code || ''} ${String(r?.value?.error || '').slice(0, 160)}`.trim()); }

/** Local profile: sources → data, repository under repoParent, recovery kit in keyFile. keyFile's folder must not
 *  hold the data or the repository (the worker refuses it there, as the window's 「복구 키 저장」 does). */
async function setupLocal({ state, restic, data, repoParent, keyFile, installed, cacheDir }) {
  const app = appWorker(state, { restic, installed, cacheDir, dialogs: [
    { method: 'dialog.open', value: { canceled: false, filePaths: [].concat(data) } },
    { method: 'dialog.open', value: { canceled: false, filePaths: [repoParent] } },
    { method: 'dialog.save', value: { canceled: false, filePath: keyFile } }] });
  let error;
  try {
    if ((await app.call('$boot')).ok !== true) throw Error('BOOT');
    for (const m of ['chooseSources', 'chooseTarget', 'setup', 'saveRecoveryKit']) { const r = await app.call(m); if (r.value?.ok !== true) throw failed(m, r); }
  } catch (e) { error = e; }
  const code = await app.close();
  if (error) throw error;
  if (code !== 0) throw Error('APP_EXIT');
}

/** Turns automatic backup on or off. The app worker backs up at once when a run is due. */
async function setAutomatic({ state, restic, enabled, installed, cacheDir }) {
  const app = appWorker(state, { restic, installed, cacheDir });
  let error;
  try {
    if ((await app.call('$boot')).ok !== true) throw Error('BOOT');
    const r = await app.call('setAutomatic', [enabled]); if (r.value?.ok !== true) throw failed('setAutomatic', r);
  } catch (e) { error = e; }
  const code = await app.close();
  if (error) throw error;
  if (code !== 0) throw Error('APP_EXIT');
}

/** A new PC's state: connects the recovery kit of a local repository read-only and restores its newest backup into a
 *  new folder under `output`, as 「복구 키로 연결」 · 「최신 백업 복구」 do. Returns the restored folder. */
async function restoreFromKit({ state, restic, keyFile, repository, output, installed, cacheDir, timeoutMs = 1800000 }) {
  const app = appWorker(state, { restic, installed, cacheDir, dialogs: [
    { method: 'dialog.open', value: { canceled: false, filePaths: [keyFile] } },
    { method: 'dialog.open', value: { canceled: false, filePaths: [repository] } },
    { method: 'dialog.open', value: { canceled: false, filePaths: [output] } }] });
  try {
    if ((await app.call('$boot')).ok !== true) throw Error('BOOT');
    for (const m of ['importRecoveryKit', 'restoreLatest']) { const r = await app.call(m); if (r.value?.ok !== true) throw failed(m, r); }
    for (const until = Date.now() + timeoutMs; Date.now() < until;) {
      const r = await app.call('getState'), s = r.value?.value;
      if (r.value?.ok !== true) throw failed('getState', r);
      if (s && s.job == null) {
        if (!s.lastRestore?.path) throw Error(`RESTORE_NOT_DONE ${String(s.warning || s.error || '').slice(0, 160)}`.trim());
        return s.lastRestore.path;
      }
      await new Promise(ok => setTimeout(ok, 1000));
    }
    throw Error('RESTORE_TIMEOUT');
  } finally { await app.close(); }
}

function runExe(exe, args, env, timeoutMs = 3600000) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { env, windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(Error('run timeout')); }, timeoutMs);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('exit', code => { clearTimeout(timer); resolve(code); });
  });
}

module.exports = { dpapi, appWorker, setupLocal, setAutomatic, restoreFromKit, runExe };
