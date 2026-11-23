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
const { setupLocal, setAutomatic, runExe: run } = require('../test-support/run-setup.cjs');

const exe = process.env.SWB_RUN_EXE, restic = process.env.SOLO_BACKUP_RESTIC;

// The first run's resource check alone took 144 s on a PC at 100% CPU (11-13); SOLO_BACKUP_SLOW_TEST=1 waits longer, as the engine test does.
const slow = process.env.SOLO_BACKUP_SLOW_TEST === '1';
const runExe = (args, env) => run(exe, args, env, slow ? 900000 : 240000);
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

test('WorkBackupRun.exe: off → skipped, manual → complete, held lock → busy, records carry no paths', { skip: !exe || !restic, timeout: slow ? 3600000 : 600000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-runexe-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const data = path.join(root, 'data'), repo = path.join(root, 'repo'), keys = path.join(root, 'keys'), state = path.join(root, 'state'), inventory = path.join(root, 'inventory');
  // An empty second folder, taken away at the end (4.2 「사라진 원본 폴더」).
  const spare = path.join(root, 'spare');
  for (const d of [data, spare, repo, keys, state, inventory]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(data, '보고서.txt'), 'stage 1 run executable');
  // The run executable does not start the inventory tools; stand-ins keep the manifest whole.
  for (const name of ['WorkBackupInventory.exe', 'WorkBackupPlanner.exe']) fs.writeFileSync(path.join(inventory, name), 'stand-in');
  const resources = path.join(root, 'resources');
  await stage({ node: process.execPath, restic, output: resources, client: '--none', inventoryBin: inventory });

  await setupLocal({ state, restic, data: [data, spare], repoParent: repo, keyFile: path.join(keys, 'recovery.json') });

  const env = { ...process.env, SOLO_BACKUP_TEST_STATE: state, SWB_RESOURCES: resources };
  // Scheduler run with automatic off: recorded as skipped, no backup.
  assert.equal(await runExe(['--run', 'hourly', '--test-mode'], env), 0);
  let [off] = lines(state);
  assert.equal(off.trigger, 'hourly');
  assert.equal(off.outcome, 'skipped');
  assert.deepEqual(off.profiles.local, { outcome: 'skipped', reason: 'off' });
  assert.equal(typeof off.verifyMs, 'number');
  assert.equal(typeof off.power.saver, 'boolean');
  assert.equal(off.notify, undefined, 'a profile switched off is the person\'s choice: nothing judged, nothing shown');

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
  // A backup made by hand with automatic off is not 「이제 매시간 저절로 지킵니다」 (STAGE1_DESIGN.md 2.2).
  assert.equal(typeof done.profiles.local.lastBackupMs, 'number');
  assert.ok(Math.abs(done.profiles.local.lastBackupMs - Date.now()) < 600000, 'the time of the backup just made');
  assert.equal(done.profiles.local.automatic, undefined);
  assert.equal(done.notify, undefined);

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
  // The MCP server of the installed copy ends within seconds once an install marker appears (it looks every 2 seconds).
  // The installer closes a server in its own user session itself; for one in another user's session it cannot close,
  // it keeps the marker 3 seconds and tries once more, so the server has to end within that.
  const mcpCopy = spawn(copy, ['--mcp', '--test-mode'], { env, stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
  const stop = setTimeout(() => mcpCopy.kill(), 60000);
  await new Promise(ok => setTimeout(ok, 3000));
  const marked = Date.now(); fs.utimesSync(marker, new Date(), new Date());
  assert.equal(await new Promise(ok => mcpCopy.once('exit', ok)), 0);
  clearTimeout(stop);
  assert.ok(Date.now() - marked < 10000, `ended ${Date.now() - marked} ms after the marker`);

  // With automatic on, the next run finds the first backup from the state — no new snapshot needed — and tells
  // it once (a test run keeps the ledger without showing anything); the run after that tells nothing.
  await setAutomatic({ state, restic, enabled: true });
  assert.equal(await runExe(['--run', 'hourly', '--test-mode'], env), 0);
  const first = lines(state)[6];
  assert.equal(first.profiles.local.automatic, true, JSON.stringify(first));
  assert.deepEqual(first.notify, [{ problem: 'first-backup', shown: true }]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(state, 'notify.json'), 'utf8')), { v: 1, days: {}, once: ['first-backup'] });
  assert.equal(await runExe(['--run', 'hourly', '--test-mode'], env), 0);
  assert.equal(lines(state)[7].notify, undefined, 'told once, and a fresh backup is not stale');
  // A chosen folder taken away: the run backs up the one that is there, counts the other and tells it.
  fs.rmSync(spare, { recursive: true });
  assert.equal(await runExe(['--run', 'manual', '--test-mode'], env), 0);
  const gone = lines(state)[8];
  assert.equal(gone.profiles.local.outcome, 'complete', JSON.stringify(gone));
  assert.equal(gone.profiles.local.missing, 1);
  assert.deepEqual(gone.notify, [{ problem: 'missing', shown: true }]);

  // A file another program holds: the run keeps a partial snapshot and asks for a fill of that drive (4.2 step 9).
  // A test run never wakes the helper, so the fill counts as tried without links; the record keeps drive letters and
  // reasons only. The next run within 4 hours does not ask again.
  const held = path.join(data, '열린 장부.xlsx'), volume = held.slice(0, 2).toUpperCase();
  fs.writeFileSync(held, 'held while the run reads');
  const holder = spawn('powershell.exe', ['-NoProfile', '-Command', `$f=[IO.File]::Open('${held.replaceAll("'", "''")}','Open','ReadWrite','None'); 'held'; [Console]::In.ReadLine() | Out-Null; $f.Close()`], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  await new Promise(ok => holder.stdout.once('data', ok));
  try {
    assert.equal(await runExe(['--run', 'manual', '--test-mode'], env), 0);
    const part = lines(state)[9];
    assert.equal(part.outcome, 'partial', JSON.stringify(part));
    assert.equal(part.profiles.local.unreadable, 1);
    assert.equal(typeof part.helper.waitMs, 'number');
    assert.deepEqual({ ...part.helper, waitMs: 0 }, { asked: [volume], linked: [], error: 'test', waitMs: 0 });
    assert.deepEqual(part.profiles.local.fill, { outcome: 'skipped', reason: 'no-link' });
    assert.ok(part.notify?.some(n => n.problem === 'partial'), 'still told: nothing was filled');
    assert.ok(!fs.existsSync(path.join(state, 'vss-request.json')), 'a test run writes no request');
    assert.equal(await runExe(['--run', 'manual', '--test-mode'], env), 0);
    const again = lines(state)[10];
    assert.equal(again.profiles.local.outcome, 'partial');
    assert.equal(again.helper, undefined, 'no fill asked within the 4 hours');
    assert.equal(again.profiles.local.fill, undefined);
  } finally {
    holder.stdin.end('\n'); await new Promise(ok => holder.once('exit', ok));
  }

  // 솔리오의 요청 작업 (4.13): `--run request`는 백업 뒤에 요청을 처리하고, 기록에는 종류 · 결과 · 까닭 낱말만 남긴다. 이 시험의
  // 프로필은 외장 드라이브 것이라, 솔리오의 「지금 백업」(클라우드 백업)은 「보호를 시작하지 않음」으로 거절된다.
  const requests = path.join(state, 'solio', 'requests');
  fs.mkdirSync(requests, { recursive: true });
  fs.writeFileSync(path.join(requests, `${Date.now()}-runnow001.json`), JSON.stringify({ v: 1, kind: 'run-now' }));
  assert.equal(await runExe(['--run', 'request', '--test-mode'], env), 0);
  const asked = lines(state)[11];
  assert.equal(asked.trigger, 'request');
  assert.deepEqual(asked.requests, [{ kind: 'run-now', result: 'rejected', reason: 'not-set-up' }]);
  assert.equal(asked.space, undefined, 'a test run scans nothing unless it is given folders');
  const status = JSON.parse(fs.readFileSync(path.join(state, 'solio', 'status.json'), 'utf8'));
  assert.deepEqual([status.v, status.state], [1, 'not-set-up']);

  // 공간 비우기 1판 (4.15): 그날 처음 도는 회차 끝에 한 번, 엔진 잠금을 놓은 뒤 읽기만 한다. 시험 판은 준 폴더만 훑는다.
  const scanned = path.join(root, 'scan');
  fs.mkdirSync(path.join(scanned, 'proj', 'node_modules', 'pkg'), { recursive: true });
  fs.writeFileSync(path.join(scanned, 'proj', 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(scanned, 'proj', 'node_modules', 'pkg', 'index.js'), 'module.exports = 1;');
  const spaceEnv = { ...env, SWB_SPACE_ROOTS: scanned, SWB_SPACE_BUDGET_MS: '60000' };
  assert.equal(await runExe(['--run', 'hourly', '--test-mode'], spaceEnv), 0);
  const day = lines(state)[12];
  assert.deepEqual([day.space?.finished, day.space?.report, day.space?.lapDays], [true, true, 1], JSON.stringify(day.space));
  assert.ok(Number.isSafeInteger(day.space.ms) && day.space.dirs >= 3 && day.space.files >= 2);
  assert.equal(day.outcome !== 'failed', true, 'the scan does not change the run');
  const report = JSON.parse(fs.readFileSync(path.join(state, 'solio', 'space.json'), 'utf8'));
  assert.ok(/^space-[0-9]+-[0-9a-f]{8}$/.test(report.report) && report.lap.days === 1 && Array.isArray(report.candidates));
  assert.equal(await runExe(['--run', 'hourly', '--test-mode'], spaceEnv), 0);
  assert.equal(lines(state)[13].space, undefined, 'once a day');

  // 공간 비우기 2판 (SPACE_DESIGN.md 12장): 시험 표식이 있으면 상태 파일이 `off`를 말하고, 쓰는 기기가 아닌 PC의 `pick free`는 거절한다.
  fs.writeFileSync(path.join(state, 'space', '2판-시험'), '');
  fs.writeFileSync(path.join(requests, `${Date.now()}-pickfree1.json`), JSON.stringify({ v: 1, kind: 'pick', action: 'free', report: report.report, items: [1] }));
  assert.equal(await runExe(['--run', 'request', '--test-mode'], env), 0);
  assert.deepEqual(lines(state)[14].requests, [{ kind: 'pick', result: 'rejected', reason: 'not-set-up' }]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(state, 'solio', 'status.json'), 'utf8')).spaceFree, 'off');

  // AI 도구의 MCP 보기 도구 (4.16): 표준 입출력으로 한 줄씩 답하고, 입력이 닫히면 끝난다. 상태는 동의 없이, 찾기는 동의 뒤에만.
  const mcp = async calls => {
    const child = spawn(exe, ['--mcp', '--test-mode'], { env, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    const replies = []; let buf = '';
    child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { replies.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
    for (const m of calls) child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');
    child.stdin.end();
    assert.equal(await new Promise(ok => child.once('exit', ok)), 0);
    return replies;
  };
  const tool = (id, name, args = {}) => ({ id, method: 'tools/call', params: { name, arguments: args } });
  const session = await mcp([{ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
    { method: 'notifications/initialized' }, { id: 2, method: 'tools/list' }, tool(3, 'protection_status'), tool(4, 'find_restorable', { query: '보고서' })]);
  assert.deepEqual(session.map(r => r.id), [1, 2, 3, 4]);
  assert.equal(session[0].result.protocolVersion, '2025-06-18');
  assert.deepEqual(session[1].result.tools.map(t => t.name), ['protection_status', 'space_report', 'find_restorable']);
  assert.equal(session[2].result.structuredContent.state, 'not-set-up');
  assert.ok(session[3].result.isError && session[3].result.content[0].text.includes('AI 도구'), 'no consent: told where to turn it on');
  fs.mkdirSync(path.join(state, 'mcp'), { recursive: true });
  fs.writeFileSync(path.join(state, 'mcp', 'consent.json'), JSON.stringify({ v: 1, tools: { find_restorable: true }, masks: [] }));
  const found = (await mcp([{ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, tool(2, 'find_restorable', { query: '보고서' })]))[1].result;
  // On a metered connection or a Wi-Fi chosen to rest on, nothing is searched; otherwise the newest backup's file is found.
  if (!found.isError) assert.ok(found.structuredContent.results.some(r => r.path.endsWith('보고서.txt')), JSON.stringify(found));
  else assert.ok(found.content[0].text.includes('쉬는 회선'), JSON.stringify(found));
  const used = fs.readFileSync(path.join(state, 'mcp.jsonl'), 'utf8');
  assert.ok(!used.includes('보고서') && !used.includes(data), 'the tool log keeps names and counts only');

  const text = fs.readFileSync(path.join(state, 'runs.jsonl'), 'utf8');
  for (const p of [root, data, repo, keys, os.homedir()]) {
    for (const form of [p, p.replaceAll(path.sep, '/')]) assert.ok(!text.includes(JSON.stringify(form).slice(1, -1)) && !text.includes(form), 'no path in runs.jsonl');
  }
  for (const name of ['보고서.txt', '열린 장부.xlsx', 'recovery.json', 'spare', path.basename(root)]) assert.ok(!text.includes(name), 'no file or folder name in runs.jsonl');
});
