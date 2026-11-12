'use strict';
// The window app's side of the two locks (STAGE1_DESIGN.md 4.1): operations take the
// engine lock through the host, read the settings again first (a scheduled run may
// have written them), keep the lock until their job ends, and show a scheduled run's
// progress as 「예약 백업 · 단계」. The window schedules nothing itself any more.
// Needs the pinned restic in SOLO_BACKUP_RESTIC; test state in a temp folder only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const restic = process.env.SOLO_BACKUP_RESTIC;
const pkg = path.resolve(__dirname, '..');
const wait = ms => new Promise(ok => setTimeout(ok, ms));

function appWorker(stateDir, hostState) {
  const env = { SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR, USERPROFILE: process.env.USERPROFILE, APPDATA: process.env.APPDATA,
    LOCALAPPDATA: process.env.LOCALAPPDATA, TEMP: process.env.TEMP, TMP: process.env.TMP, SWB_ROOT: stateDir, SWB_RESTIC: restic,
    SWB_ENGINE_ROOT: path.join(pkg, 'engine'), SWB_TEST: '1' };
  const child = spawn(process.execPath, [path.join(pkg, 'worker', 'dispatcher.cjs')], { env, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  let buf = '', next = 0; const waiting = new Map(); const states = [];
  const send = o => child.stdin.write(JSON.stringify({ v: 1, ...o }) + '\n');
  child.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      if (m.event === 'state') states.push(m.value);
      if (m.call) {
        const a = m.args || []; let value, ok = true;
        hostState.calls.push(m.method);
        if (m.method === 'secret.encrypt') value = Buffer.from(String(a[0])).toString('base64');
        else if (m.method === 'secret.decrypt') value = Buffer.from(String(a[0]), 'base64').toString();
        else if (m.method === 'startup.read') value = false;
        else if (m.method === 'engine.lock') { value = hostState.lockFree; if (value) hostState.held = true; }
        else if (m.method === 'engine.unlock') { hostState.held = false; value = true; }
        else if (m.method === 'run.progress') value = hostState.progress;
        else if (m.method.startsWith('dialog.')) { const d = hostState.dialogs.shift(); ok = !!d && d.method === m.method; value = d?.value; }
        else ok = false;
        send(ok ? { callResult: m.call, ok: true, value } : { callResult: m.call, ok: false, code: 'TEST_HOST' });
      } else if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    }
  });
  const exited = new Promise(ok => child.once('close', code => ok(code)));
  const call = (method, args = []) => new Promise(ok => { const id = ++next; waiting.set(id, ok); send({ id, method, args }); });
  return { call, exited, states };
}
async function idle(app) {
  for (let i = 0; i < 600; i++) { const s = (await app.call('getState')).value?.value; if (s && !s.job) return s; await wait(100); }
  throw Error('job did not end');
}

test('window operations take the engine lock, read the run\'s settings first, keep it until the job ends, and show a run\'s progress', { skip: !restic, timeout: 300000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-applock-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const data = path.join(root, 'data'), repo = path.join(root, 'repo'), keys = path.join(root, 'keys'), state = path.join(root, 'state');
  for (const d of [data, repo, keys, state]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(data, '계약서.txt'), 'two locks');
  const host = { lockFree: true, held: false, progress: null, calls: [], dialogs: [
    { method: 'dialog.open', value: { canceled: false, filePaths: [data] } },
    { method: 'dialog.open', value: { canceled: false, filePaths: [repo] } },
    { method: 'dialog.save', value: { canceled: false, filePath: path.join(keys, 'recovery.json') } }] };
  const app = appWorker(state, host);
  assert.equal((await app.call('$boot')).ok, true);
  for (const m of ['chooseSources', 'chooseTarget', 'setup', 'saveRecoveryKit']) assert.equal((await app.call(m)).value.ok, true, m);
  assert.equal(host.held, false, 'the lock goes back after each operation');
  assert.ok(host.calls.indexOf('engine.lock') < host.calls.indexOf('dialog.save'), 'setup ran under the lock');

  // A scheduled run holds the engine: the window says so and does nothing.
  host.lockFree = false;
  const refused = (await app.call('backupNow')).value;
  assert.deepEqual([refused.ok, refused.code], [false, 'RUN_ACTIVE']);
  host.lockFree = true;

  // The run wrote settings meanwhile; the next window operation reads them before it writes.
  const settings = path.join(state, 'vault', 'settings.json');
  const onDisk = JSON.parse(fs.readFileSync(settings, 'utf8'));
  onDisk.warning = 'written by a scheduled run';
  fs.writeFileSync(settings + '.tmp', JSON.stringify(onDisk, null, 2)); fs.renameSync(settings + '.tmp', settings);
  assert.equal((await app.call('setAutomatic', [false])).value.ok, true);
  assert.equal(JSON.parse(fs.readFileSync(settings, 'utf8')).warning, 'written by a scheduled run', 'not overwritten with the window\'s old copy');

  // 「지금 백업」 answers at once; the lock stays until the job ends.
  assert.equal((await app.call('backupNow')).value.ok, true);
  assert.equal(host.held, true, 'held while the job runs');
  const done = await idle(app);
  assert.equal(done.lastBackup?.files, 1);
  for (let i = 0; i < 50 && host.held; i++) await wait(100);
  assert.equal(host.held, false, 'released when the job ended');

  // A scheduled run's progress (from the host) shows as the profile's job.
  host.progress = { profiles: { local: { kind: 'backup', stage: '작업 파일 백업 중', percent: 42 }, b2: null } };
  let shown = null;
  for (let i = 0; i < 80 && !shown; i++) { shown = app.states.map(s => s.job).find(j => j?.scheduled); if (!shown) await wait(100); }
  assert.deepEqual(shown, { kind: 'backup', stage: '예약 백업 · 작업 파일 백업 중', percent: 42, scheduled: true });
  host.progress = null;

  // Nothing in the window starts backups on a timer any more.
  const before = host.calls.filter(c => c === 'engine.lock').length;
  await wait(6000);
  assert.equal((await app.call('getState')).value.value.lastBackup.id, done.lastBackup.id, 'no backup on its own');
  assert.ok(host.calls.filter(c => c === 'engine.lock').length - before <= 1, 'at most the recovery check took the lock');
  await app.call('$shutdown');
  assert.equal(await app.exited, 0);
});
