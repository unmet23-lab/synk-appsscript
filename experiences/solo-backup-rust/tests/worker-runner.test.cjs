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
// Workers still open when the tests end: a check that failed before $shutdown left its worker running, and the open pipe kept
// this file from ever finishing. Close them so a failure is reported instead.
const live = new Set();
test.after(() => { for (const child of live) child.kill(); });

function worker(stateDir, { mode = null, dialogs = [], answers = {} } = {}) {
  const env = { SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR, USERPROFILE: process.env.USERPROFILE, APPDATA: process.env.APPDATA,
    LOCALAPPDATA: process.env.LOCALAPPDATA, TEMP: process.env.TEMP, TMP: process.env.TMP, SWB_ROOT: stateDir, SWB_RESTIC: restic,
    SWB_ENGINE_ROOT: path.join(pkg, 'engine'), SWB_TEST: '1', ...(mode ? { SWB_MODE: mode } : {}) };
  const child = spawn(process.execPath, [path.join(pkg, 'worker', 'dispatcher.cjs')], { env, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  live.add(child); child.once('close', () => live.delete(child));
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

  // Registered with this test (S132): SYNK 솔리오의 요청 · 상태 파일(4.13)과 MCP 보기 도구의 찾기(4.16), 실제 restic으로.
  await t.test('솔리오: 창은 setup을 받고, 회차는 끝에 요청을 처리해 상태 파일을 남기고, MCP 찾기는 읽기만 한다 (4.13 · 4.16)', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-solio-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const data = path.join(root, 'data'), repo = path.join(root, 'repo'), keys = path.join(root, 'keys'), state = path.join(root, 'state');
    for (const d of [data, repo, keys, state]) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(data, '분기 보고서.txt'), 'stage 1 solio');
    fs.writeFileSync(path.join(data, '건강검진 결과.txt'), 'kept out of the AI by a mask');
    const requests = path.join(state, 'solio', 'requests'), results = path.join(state, 'solio', 'results');
    fs.mkdirSync(requests, { recursive: true });
    const now = Date.now();
    const put = (tail, value) => fs.writeFileSync(path.join(requests, `${now}-${tail}.json`), JSON.stringify(value));
    const answer = tail => JSON.parse(fs.readFileSync(path.join(results, `${now}-${tail}.json`), 'utf8'));
    // The window (app mode) takes a setup left by 솔리오 and tells the screen to go straight to the Google sign-in.
    put('setup0001', { v: 1, kind: 'setup', mode: 'protect', hint: 'customer@example.com' });
    // What the window's host answers for the Wi-Fi this PC is on (화면 세션 E30).
    let wifiNow = '사무실 Wi-Fi 5G'; const answers = { 'wifi.name': () => wifiNow };
    const app = worker(state, { answers, dialogs: [
      { method: 'dialog.open', value: { canceled: false, filePaths: [data] } },
      { method: 'dialog.open', value: { canceled: false, filePaths: [repo] } },
      { method: 'dialog.save', value: { canceled: false, filePath: path.join(keys, 'recovery.json') } }] });
    await app.call('$boot');
    let setup = null;
    for (let i = 0; i < 50 && !setup; i++) { setup = (await app.call('getState')).value.value.solio.setup; if (!setup) await new Promise(ok => setTimeout(ok, 200)); }
    assert.deepEqual([setup?.mode, setup?.hint], ['protect', 'customer@example.com']);
    assert.equal(answer('setup0001').result, 'done');
    for (const m of ['chooseSources', 'chooseTarget', 'setup', 'saveRecoveryKit']) assert.equal((await app.call(m)).value.ok, true, m);
    // 「AI 도구」: only the search is turned on, with a mask word.
    assert.equal((await app.call('setAiTools', [{ tools: { find_restorable: true }, masks: ['건강'] }])).value.ok, true);
    // 「쉬는 Wi-Fi」 reads the Wi-Fi this PC is on (화면 세션 E30): a name it could be, else null — a name past 32 bytes or with a
    // control character, none, or a host that cannot read it. Reading it changes nothing the window shows.
    const wifi = async () => { const r = (await app.call('wifiName')).value; assert.equal(r.ok, true, JSON.stringify(r)); return r.value; };
    const solioBefore = (await app.call('getState')).value.value.solio;
    assert.equal(await wifi(), '사무실 Wi-Fi 5G');
    for (const odd of ['가'.repeat(11), 'a\u0007b', '', null, 7]) { wifiNow = odd; assert.equal(await wifi(), null, JSON.stringify(odd)); }
    delete answers['wifi.name']; assert.equal(await wifi(), null, 'the host could not read it');
    assert.deepEqual((await app.call('getState')).value.value.solio, solioBefore);
    await app.call('$shutdown'); assert.equal(await app.exited, 0);
    const status = () => JSON.parse(fs.readFileSync(path.join(state, 'solio', 'status.json'), 'utf8'));
    assert.equal(status().v, 1, 'the window wrote the status file');

    // The request task's run: requests are handled after the backup; a setup is the window's and stays.
    put('runnow001', { v: 1, kind: 'run-now' });
    put('space0001', { v: 1, kind: 'space-setting', name: 'auto-free', value: true });
    put('space0002', { v: 1, kind: 'space-setting', name: 'start-line', drive: 'C', gb: 1 });
    put('badfield1', { v: 1, kind: 'run-now', path: 'C:\\' });
    put('setup0002', { v: 1, kind: 'setup', mode: 'move' });
    const r = worker(state, { mode: 'run' });
    await r.call('$boot');
    const run = (await r.call('$run', [{ trigger: 'request', rest: null }])).value;
    await r.call('$shutdown'); assert.equal(await r.exited, 0);
    // This test's profile is the drive one; 「지금 백업」 from 솔리오 is the cloud backup's, which is not set up here.
    assert.deepEqual(run.requests.map(x => [x.kind, x.result, x.reason ?? null]).sort(), [['invalid', 'rejected', 'invalid'], ['run-now', 'rejected', 'not-set-up'],
      ['space-setting', 'confirm-in-engine', null], ['space-setting', 'done', null]]);
    assert.deepEqual([answer('runnow001').result, answer('space0001').result, answer('space0002').result, answer('badfield1').reason], ['rejected', 'confirm-in-engine', 'done', 'invalid']);
    assert.ok(fs.existsSync(path.join(requests, `${now}-setup0002.json`)), 'the setup is left for the window');
    assert.deepEqual(fs.readdirSync(path.join(requests, 'claimed')), []);
    assert.equal(status().state, 'not-set-up', 'the status file speaks of the cloud backup');
    assert.ok(!JSON.stringify(status()).includes(path.basename(root)) && !fs.readFileSync(path.join(state, 'solio', 'status.json'), 'utf8').includes('보고서'));

    // A backup to search, then the MCP worker: the newest backup only, read only — no settings written, no repository lock.
    // An MCP worker that was already up sees the backup made meanwhile (it opens again when the settings change).
    const early = worker(state, { mode: 'mcp' }); await early.call('$boot');
    const seenBefore = (await early.call('getState')).value.value.lastBackupAt;
    const b = worker(state, { mode: 'run' }); await b.call('$boot');
    assert.equal((await b.call('$run', [{ trigger: 'manual' }])).value.profiles.local.outcome, 'complete');
    await b.call('$shutdown'); assert.equal(await b.exited, 0);
    const seenAfter = (await early.call('getState')).value.value.lastBackupAt;
    assert.ok(seenAfter && seenAfter !== seenBefore, `${seenBefore} → ${seenAfter}`);
    await early.call('$shutdown'); assert.equal(await early.exited, 0);
    const settings = path.join(state, 'vault', 'settings.json'), before = fs.statSync(settings).mtimeMs;
    const m = worker(state, { mode: 'mcp' });
    assert.deepEqual((await m.call('$boot')).value, { mode: 'mcp' });
    const found = (await m.call('findFiles', [{ query: '보고서' }])).value;
    assert.equal(found.ok, true);
    assert.equal(found.value.results.length, 1);
    assert.ok(found.value.results[0].path.endsWith('분기 보고서.txt') && found.value.results[0].path.startsWith(data), found.value.results[0].path);
    assert.ok(found.value.snapshotAt && found.value.total === 1);
    // 가리는 낱말: 그 낱말이 든 경로는 결과에도 수에도 없고, 그 낱말로 찾은 답은 찾은 것이 없는 답과 꼴이 같다.
    const quiet = { configured: true, snapshotAt: found.value.snapshotAt, results: [], total: 0, cut: false };
    assert.deepEqual((await m.call('findFiles', [{ query: '보고서', masks: ['분기'] }])).value.value, quiet);
    assert.deepEqual((await m.call('findFiles', [{ query: '분기', masks: ['분기'] }])).value.value, quiet);
    assert.deepEqual((await m.call('findFiles', [{ query: '없는이름' }])).value.value, quiet);
    assert.equal((await m.call('findFiles', [{ query: '보고서', masks: 'x' }])).value.code, 'INVALID_REQUEST');
    assert.equal((await m.call('findFiles', [{ query: '' }])).value.code, 'QUERY_INVALID');
    assert.deepEqual(Object.keys((await m.call('getState')).value.value).sort(), ['configured', 'credential', 'lastBackupAt', 'mode']);
    // Every app method is refused in this mode: the worker closes.
    m.call('restoreLatest');
    assert.equal(await m.exited, 1);
    assert.equal(fs.statSync(settings).mtimeMs, before, 'the settings were not written');
    const locks = [];
    (function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) { if (e.name === 'locks') locks.push(...fs.readdirSync(path.join(dir, e.name))); else walk(path.join(dir, e.name)); } })(repo);
    assert.deepEqual(locks, [], 'no repository lock was left');
  });

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

  await t.test('「이 폴더 통째로 꺼내기」 through the window, and the folder a restore left opens only when the engine wrote it down (화면 세션 E27 · E29)', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-e27-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const data = path.join(root, 'data'), repo = path.join(root, 'repo'), keys = path.join(root, 'keys'), state = path.join(root, 'state'), out = path.join(root, 'out');
    for (const d of [data, repo, keys, state, out, path.join(data, '안쪽')]) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(data, '안쪽', '보고서.txt'), 'E27 part');
    fs.writeFileSync(path.join(data, '밖.txt'), 'not in the part');
    const opened = [];
    const app = worker(state, { answers: { openPath: a => { opened.push(a[0]); return null; } }, dialogs: [
      { method: 'dialog.open', value: { canceled: false, filePaths: [data] } },
      { method: 'dialog.open', value: { canceled: false, filePaths: [repo] } },
      { method: 'dialog.save', value: { canceled: false, filePath: path.join(keys, 'recovery.json') } },
      { method: 'dialog.open', value: { canceled: false, filePaths: [out] } }] });
    await app.call('$boot');
    for (const m of ['chooseSources', 'chooseTarget', 'setup', 'saveRecoveryKit']) assert.equal((await app.call(m)).value.ok, true, m);
    const local = async () => (await app.call('getState')).value.value.profiles.local;
    const idle = async () => { for (let i = 0; i < 600; i++) { if (!(await local()).job) return; await new Promise(r => setTimeout(r, 100)); } throw new Error('the job did not end'); };
    assert.equal((await app.call('backupNow')).value.ok, true); await idle();
    // No folder of a restore that failed yet: nothing to open; a word that is not the method's is refused.
    assert.deepEqual(['NOT_FOUND'], [(await app.call('openRestoreFolder', [{ unfinished: true }])).value.code]);
    assert.equal((await app.call('openRestoreFolder', [{ folder: data }])).value.code, 'BAD_INPUT');
    // The part 안쪽 of this PC's own backup, whole, into the folder picked.
    const started = (await app.call('restoreScope', [{ profile: 'local', folder: data, sub: '안쪽', place: 'pick' }])).value;
    assert.equal(started.ok, true, JSON.stringify(started)); await idle();
    // The finished restore is on the window's state for the profile on screen (the per-profile summary does not carry it).
    const s = (await app.call('getState')).value.value;
    assert.equal(s.profile, 'local');
    assert.equal(s.lastRestoreError, null, JSON.stringify(s.lastRestoreError));
    assert.deepEqual([s.lastRestore.scope.from, s.lastRestore.scope.sub], [null, '안쪽']);
    const label = fs.readdirSync(s.lastRestore.path).find(n => n !== '복구경로.json');
    assert.equal(fs.readFileSync(path.join(s.lastRestore.path, label, '안쪽', '보고서.txt'), 'utf8'), 'E27 part');
    assert.ok(!fs.existsSync(path.join(s.lastRestore.path, label, '밖.txt')), 'only the part');
    assert.equal((await app.call('openRestoreFolder')).value.ok, true);
    assert.deepEqual(opened, [s.lastRestore.path]);
    // A request the window cannot check is refused before any folder is asked: a device name restic could not write.
    assert.equal((await app.call('restoreScope', [{ profile: 'local', folder: data, from: 'old pc', place: 'pick' }])).value.code, 'INVALID_REQUEST');
    await app.call('$shutdown'); assert.equal(await app.exited, 0);
    // The folders a stopped or failed restore left, as the engine writes them down (화면 세션 E29 · 카본 끝판 A2): the window opens
    // each kind's own for the person to remove, past the worker's guard on the path; a folder that is gone is said so.
    const leftWhole = path.join(out, '복구-만들다만'), leftPicked = path.join(out, '선택복구-만들다만');
    for (const d of [leftWhole, leftPicked]) fs.mkdirSync(d);
    const settings = path.join(state, 'vault', 'settings.json'), config = JSON.parse(fs.readFileSync(settings, 'utf8')), at = new Date().toISOString();
    config.lastRestoreError = { code: 'CANCELED', message: '되살리기를 그만두었습니다.', at, path: leftWhole };
    config.lastSelectedRestoreError = { code: 'CANCELED', message: '되살리기를 그만두었습니다.', at, path: leftPicked };
    fs.writeFileSync(settings, JSON.stringify(config, null, 2));
    const reopened = [];
    const again = worker(state, { answers: { openPath: a => { reopened.push(a[0]); return null; } } });
    await again.call('$boot');
    assert.equal((await again.call('openRestoreFolder', [{ unfinished: true }])).value.ok, true);
    const picked = (await again.call('openSelectedRestoreFolder', [{ profile: 'local', unfinished: true }])).value;
    assert.equal(picked.ok, true, JSON.stringify(picked));
    assert.equal((await again.call('openRestoreFolder', [{ unfinished: false }])).value.ok, true);
    assert.deepEqual(reopened, [leftWhole, leftPicked, s.lastRestore.path]);
    fs.rmSync(leftWhole, { recursive: true });
    assert.equal((await again.call('openRestoreFolder', [{ unfinished: true }])).value.code, 'NOT_FOUND');
    assert.equal(reopened.length, 3);
    await again.call('$shutdown'); assert.equal(await again.exited, 0);
  });
});
