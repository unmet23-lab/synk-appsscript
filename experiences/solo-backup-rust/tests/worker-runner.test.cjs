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

function worker(stateDir, { mode = null, dialogs = [], answers = {} } = {}) {
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
        else if (m.method === 'engine.lock' || m.method === 'engine.unlock') value = true;
        else if (m.method === 'run.progress') value = null;
        else if (m.method.startsWith('dialog.')) { const d = script.shift(); ok = !!d && d.method === m.method; value = d?.value; }
        else if (m.method in answers) value = answers[m.method](a);
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

test('run mode: one $run per boot, person-started run is forced, app methods are refused', { skip: !restic, timeout: 1200000 }, async t => {
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

  // Registered with this test (S132) — a top-level test that skips off Windows must be in the conditional QA list (11-15 precedent).
  await t.test('$fill comes after the run, once; a partial run with no links is an attempt and the next waits (4.2 채움 판)', { skip: process.platform !== 'win32' }, async t => {
    // Four worker boots and three backups: 259 s on a busy PC (11-16), so the limit has room.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-fill-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const data = path.join(root, 'data'), repo = path.join(root, 'repo'), keys = path.join(root, 'keys'), state = path.join(root, 'state');
    for (const d of [data, repo, keys, state]) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(data, '보고서.txt'), 'stage 1 fill');
    const held = path.join(data, '열린 장부.xlsx');
    fs.writeFileSync(held, 'held while the run reads');
    const app = worker(state, { dialogs: [
      { method: 'dialog.open', value: { canceled: false, filePaths: [data] } },
      { method: 'dialog.open', value: { canceled: false, filePaths: [repo] } },
      { method: 'dialog.save', value: { canceled: false, filePath: path.join(keys, 'recovery.json') } }] });
    await app.call('$boot');
    for (const m of ['chooseSources', 'chooseTarget', 'setup', 'saveRecoveryKit']) assert.equal((await app.call(m)).value.ok, true, m);
    await app.call('$shutdown'); assert.equal(await app.exited, 0);

    // $fill before $run closes the worker.
    const early = worker(state, { mode: 'run' });
    await early.call('$boot');
    early.call('$fill', [{ links: [] }]);
    assert.equal(await early.exited, 1);
    assert.ok(early.frames.some(fr => fr.fatal === 'WORKER_FAILED'));

    // Another program holds a file open, so the run makes a partial snapshot and asks for a fill of that drive.
    const volume = held.slice(0, 2).toUpperCase();
    const holder = spawn('powershell.exe', ['-NoProfile', '-Command', `$f=[IO.File]::Open('${held}','Open','ReadWrite','None'); 'held'; [Console]::In.ReadLine() | Out-Null; $f.Close()`], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    await new Promise(ok => holder.stdout.once('data', ok));
    try {
      const r1 = worker(state, { mode: 'run' });
      await r1.call('$boot');
      const run = (await r1.call('$run', [{ trigger: 'manual' }])).value;
      assert.equal(run.profiles.local.outcome, 'partial');
      assert.deepEqual(run.profiles.local.fill, [volume], 'the drive the run executable asks the helper for');
      // The helper made no link: still an attempt, said without a path.
      const none = (await r1.call('$fill', [{ links: [] }])).value;
      assert.deepEqual(none, { profiles: { local: { outcome: 'skipped', reason: 'no-link' } } });
      assert.ok(!JSON.stringify(none).includes(path.basename(root)), 'no path in the fill result');
      // A second $fill in the same boot closes the worker.
      r1.call('$fill', [{ links: [] }]);
      assert.equal(await r1.exited, 1);

      // The next run is partial again, but its fill waits the 4 hours: nothing is due, and no profile is listed.
      const r2 = worker(state, { mode: 'run' });
      await r2.call('$boot');
      const again = (await r2.call('$run', [{ trigger: 'manual' }])).value.profiles.local;
      assert.equal(again.outcome, 'partial');
      assert.equal(again.fill, undefined, 'no fill is asked within the 4 hours, so the run executable does not wake the helper');
      assert.deepEqual((await r2.call('$fill', [{ links: [{ volume, root: path.join(root, 'snap') }] }])).value, { profiles: {} });
      await r2.call('$shutdown'); assert.equal(await r2.exited, 0);

      // A malformed fill input (links not a list) closes the worker, like a malformed run input.
      const r3 = worker(state, { mode: 'run' });
      await r3.call('$boot');
      await r3.call('$run', [{ trigger: 'manual' }]);
      r3.call('$fill', [{ links: 'C:\\snap' }]);
      assert.equal(await r3.exited, 1);
      assert.ok(r3.frames.some(fr => fr.fatal === 'WORKER_FAILED'));
    } finally {
      holder.stdin.end('\n'); await new Promise(ok => holder.once('exit', ok));
    }
  });

  // 화면 세션 E19: 「프로그램과 설정」 works beside an engine job (the first backup after the handover is one). With the kit
  // kept on this PC it reads no repository; without one it says to wait (JOB_BUSY) instead of reading beside the job.
  await t.test('「프로그램과 설정」 beside a running backup: the kept kit answers, none kept says to wait (화면 세션 E19)', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-e19-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const data = path.join(root, 'data'), repo = path.join(root, 'repo'), keys = path.join(root, 'keys'), state = path.join(root, 'state');
    for (const d of [data, repo, keys, state]) fs.mkdirSync(d, { recursive: true });
    // Enough to keep restic busy while the next request comes.
    fs.writeFileSync(path.join(data, 'big.bin'), require('node:crypto').randomBytes(48 * 1024 * 1024));
    fs.writeFileSync(path.join(state, 'move.json'), JSON.stringify({ from: 'old-pc', checked: [] }));
    // The kit kept on this PC as a move leaves it: that device had none; the checklist ids in their own file.
    fs.writeFileSync(path.join(state, 'move-kit.json'), JSON.stringify({ from: 'old-pc', none: true }));
    fs.writeFileSync(path.join(state, 'move-kit-checklist.json'), JSON.stringify({ from: 'old-pc', checklist: require('../engine/src/move-apps.cjs').checklist(null).map(i => i.id) }));
    const profile = { known: { profile: { path: root } }, oneDrive: [], syncRoots: [], drives: [] };
    const app = worker(state, { answers: { 'folders.snapshot': () => profile }, dialogs: [
      { method: 'dialog.open', value: { canceled: false, filePaths: [data] } },
      { method: 'dialog.open', value: { canceled: false, filePaths: [repo] } },
      { method: 'dialog.save', value: { canceled: false, filePath: path.join(keys, 'recovery.json') } }] });
    await app.call('$boot');
    for (const m of ['chooseSources', 'chooseTarget', 'setup', 'saveRecoveryKit']) assert.equal((await app.call(m)).value.ok, true, m);
    const idle = async () => { for (let i = 0; i < 600; i++) { if (!(await app.call('getState')).value.value.profiles.local.job) return; await new Promise(r => setTimeout(r, 100)); } throw new Error('the backup did not end'); };
    const running = (await app.call('backupNow')).value;
    assert.equal(running.ok, true, JSON.stringify(running));
    const list = (await app.call('moveChecklist')).value;
    const state1 = (await app.call('getState')).value.value;
    assert.ok(state1.profiles.local.job, 'the backup still ran when the list was asked');
    assert.equal(list.ok, true, JSON.stringify(list));
    assert.ok(list.value.length >= 1 && list.value.every(i => i.done === false), JSON.stringify(list.value));
    const moveState = (await app.call('moveState')).value;
    assert.equal(moveState.value.checklistLeft, list.value.length);
    // Another kind of request still waits for the job.
    assert.equal((await app.call('moveRelease')).value.ok, false);
    await idle();
    // No kit kept: the list would read the repository, which waits for the job.
    fs.rmSync(path.join(state, 'move-kit.json'));
    fs.appendFileSync(path.join(data, 'big.bin'), require('node:crypto').randomBytes(16 * 1024 * 1024));
    assert.equal((await app.call('backupNow')).value.ok, true);
    const waiting = (await app.call('moveChecklist')).value;
    assert.deepEqual([waiting.ok, waiting.code], [false, 'JOB_BUSY'], JSON.stringify(waiting));
    await idle();
    await app.call('$shutdown'); assert.equal(await app.exited, 0);
  });
});
