'use strict';
// Scheduled-run mode of the worker (STAGE1_DESIGN.md 4.2) over the same stdio frames
// the Rust host uses: set up a local profile in app mode, then `$run` in run mode.
// Needs the pinned restic in SOLO_BACKUP_RESTIC; test state in a temp folder only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const restic = process.env.SOLO_BACKUP_RESTIC;
const pkg = path.resolve(__dirname, '..');

function worker(stateDir, { mode = null, dialogs = [] } = {}) {
  const env = { SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR, USERPROFILE: process.env.USERPROFILE, APPDATA: process.env.APPDATA,
    LOCALAPPDATA: process.env.LOCALAPPDATA, TEMP: process.env.TEMP, TMP: process.env.TMP, SWB_ROOT: stateDir, SWB_RESTIC: restic,
    SWB_ENGINE_ROOT: path.join(pkg, 'engine'), SWB_TEST: '1', ...(mode ? { SWB_MODE: mode } : {}) };
  const child = spawn(process.execPath, [path.join(pkg, 'worker', 'dispatcher.cjs')], { env, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  let buf = '', next = 0; const waiting = new Map(); const script = [...dialogs]; const frames = [];
  const send = o => child.stdin.write(JSON.stringify({ v: 1, ...o }) + '\n');
  child.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); frames.push(m);
      if (m.call) {
        const a = m.args || []; let value, ok = true;
        if (m.method === 'secret.encrypt') value = Buffer.from(String(a[0])).toString('base64');
        else if (m.method === 'secret.decrypt') value = Buffer.from(String(a[0]), 'base64').toString();
        else if (m.method === 'startup.read') value = false;
        else if (m.method.startsWith('dialog.')) { const d = script.shift(); ok = !!d && d.method === m.method; value = d?.value; }
        else ok = false;
        send(ok ? { callResult: m.call, ok: true, value } : { callResult: m.call, ok: false, code: 'TEST_HOST' });
      } else if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    }
  });
  // 'close' comes after every stdout chunk has been read, unlike 'exit' (review E2).
  const exited = new Promise(ok => child.once('close', code => ok(code)));
  const call = (method, args = []) => new Promise(ok => { const id = ++next; waiting.set(id, ok); send({ id, method, args }); });
  return { call, exited, frames, child };
}

test('run mode: one $run per boot, person-started run is forced, app methods are refused', { skip: !restic, timeout: 300000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-runner-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const data = path.join(root, 'data'), repo = path.join(root, 'repo'), keys = path.join(root, 'keys'), state = path.join(root, 'state');
  for (const d of [data, repo, keys, state]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(data, '보고서.txt'), 'stage 1 run mode');

  // App mode: set up a local profile and save the recovery key (automatic stays off).
  const app = worker(state, { dialogs: [
    { method: 'dialog.open', value: { canceled: false, filePaths: [data] } },
    { method: 'dialog.open', value: { canceled: false, filePaths: [repo] } },
    { method: 'dialog.save', value: { canceled: false, filePath: path.join(keys, 'recovery.json') } }] });
  assert.equal((await app.call('$boot')).ok, true);
  for (const m of ['chooseSources', 'chooseTarget', 'setup', 'saveRecoveryKit']) assert.equal((await app.call(m)).value.ok, true, m);
  await app.call('$shutdown'); assert.equal(await app.exited, 0);

  // Scheduler-started run: automatic is off, so nothing runs.
  const r1 = worker(state, { mode: 'run' });
  assert.deepEqual((await r1.call('$boot')).value, { mode: 'run' });
  const off = (await r1.call('$run', [{ trigger: 'hourly' }])).value;
  assert.deepEqual(off.profiles.local, { outcome: 'skipped', reason: 'off' });
  assert.deepEqual(off.profiles.b2, { outcome: 'skipped', reason: 'not-configured' });
  await r1.call('$shutdown'); assert.equal(await r1.exited, 0);

  // Person-started run ("지금 백업") is forced and completes a backup.
  const r2 = worker(state, { mode: 'run' });
  await r2.call('$boot');
  const done = (await r2.call('$run', [{ trigger: 'manual' }])).value;
  assert.equal(done.profiles.local.outcome, 'complete');
  assert.equal(done.profiles.local.newSnapshot, true);
  assert.deepEqual(done.profiles.local.unlock, { ran: true, ok: true });
  assert.equal(done.profiles.local.filesNew, 1, 'restic snapshot summary reaches the run record');
  assert.equal(typeof done.profiles.local.resticStartedAt, 'number');
  assert.ok(done.worker.maxRssKb > 0);
  // Progress events carry kind · stage · percent only — never a path.
  const progress = r2.frames.filter(f => f.event === 'state');
  assert.ok(progress.some(f => typeof f.value.profiles.local?.stage === 'string'));
  for (const f of progress) {
    assert.deepEqual(Object.keys(f.value), ['profiles']);
    for (const job of Object.values(f.value.profiles)) if (job) assert.deepEqual(Object.keys(job).sort(), ['kind', 'percent', 'stage']);
    assert.ok(!JSON.stringify(f.value).includes(path.basename(root)), 'no state path in progress');
  }
  // A second $run in the same boot fails closed (the worker exits).
  r2.call('$run', [{ trigger: 'manual' }]);
  assert.equal(await r2.exited, 1);
  assert.ok(r2.frames.some(f => f.fatal === 'WORKER_FAILED'));

  // $shutdown sent while $run is still working (twice): the run answers first, then the worker saves and exits 0 (review E1).
  const r5 = worker(state, { mode: 'run' });
  await r5.call('$boot');
  const running = r5.call('$run', [{ trigger: 'manual' }]);
  const stops = [r5.call('$shutdown'), r5.call('$shutdown')];
  const answer = await running;
  assert.equal(answer.ok, true);
  assert.equal(answer.value.profiles.local.outcome, 'complete');
  for (const stop of stops) assert.equal((await stop).ok, true);
  assert.equal(await r5.exited, 0);
  const ids = r5.frames.filter(f => f.id).map(f => f.id);
  assert.ok(ids.indexOf(2) < ids.indexOf(3), 'the run answers before the shutdown');

  // App methods do not exist in run mode.
  const r3 = worker(state, { mode: 'run' });
  await r3.call('$boot');
  r3.call('getState');
  assert.equal(await r3.exited, 1);

  // Unknown trigger, unknown skip value and a malformed input are each refused (review E3).
  for (const input of [{ trigger: 'hourly', skipCloud: 'anything' }, { trigger: 'daily' }, ['hourly'], null]) {
    const r4 = worker(state, { mode: 'run' });
    await r4.call('$boot');
    r4.call('$run', [input]);
    assert.equal(await r4.exited, 1, JSON.stringify(input));
    assert.ok(r4.frames.some(f => f.fatal === 'WORKER_FAILED'), JSON.stringify(input));
  }
});
