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

function appWorker(stateDir, { restic, dialogs = [] }) {
  const env = { SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR, USERPROFILE: process.env.USERPROFILE, APPDATA: process.env.APPDATA,
    LOCALAPPDATA: process.env.LOCALAPPDATA, TEMP: process.env.TEMP, TMP: process.env.TMP, SWB_ROOT: stateDir, SWB_RESTIC: restic,
    SWB_ENGINE_ROOT: path.join(pkg, 'engine'), SWB_TEST: '1' };
  const child = spawn(process.execPath, [path.join(pkg, 'worker', 'dispatcher.cjs')], { env, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
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
          else if (m.method.startsWith('dialog.')) { const d = script.shift(); ok = !!d && d.method === m.method; value = d?.value; }
          else ok = false;
        } catch { ok = false; }
        send(ok ? { callResult: m.call, ok: true, value } : { callResult: m.call, ok: false, code: 'TEST_HOST' });
      } else if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    }
  });
  const exited = new Promise(ok => child.once('close', code => ok(code)));
  const call = (method, args = []) => new Promise(ok => { const id = ++next; waiting.set(id, ok); send({ id, method, args }); });
  return { call, exited };
}

/** Local profile: sources → data, repository under repoParent, recovery kit in keyFile. */
async function setupLocal({ state, restic, data, repoParent, keyFile }) {
  const app = appWorker(state, { restic, dialogs: [
    { method: 'dialog.open', value: { canceled: false, filePaths: [data] } },
    { method: 'dialog.open', value: { canceled: false, filePaths: [repoParent] } },
    { method: 'dialog.save', value: { canceled: false, filePath: keyFile } }] });
  if ((await app.call('$boot')).ok !== true) throw Error('BOOT');
  for (const m of ['chooseSources', 'chooseTarget', 'setup', 'saveRecoveryKit']) if ((await app.call(m)).value?.ok !== true) throw Error(m);
  await app.call('$shutdown');
  if (await app.exited !== 0) throw Error('APP_EXIT');
}

/** Turns automatic backup on or off. The app worker backs up at once when a run is due. */
async function setAutomatic({ state, restic, enabled }) {
  const app = appWorker(state, { restic });
  if ((await app.call('$boot')).ok !== true) throw Error('BOOT');
  if ((await app.call('setAutomatic', [enabled])).value?.ok !== true) throw Error('setAutomatic');
  await app.call('$shutdown');
  if (await app.exited !== 0) throw Error('APP_EXIT');
}

function runExe(exe, args, env, timeoutMs = 3600000) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { env, windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(Error('run timeout')); }, timeoutMs);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('exit', code => { clearTimeout(timer); resolve(code); });
  });
}

module.exports = { dpapi, appWorker, setupLocal, setAutomatic, runExe };
