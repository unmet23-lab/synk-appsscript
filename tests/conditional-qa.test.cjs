'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..'), c = require('../tools/conditional-qa/contract.cjs');
const { check } = require('../tools/conditional-qa/guard.cjs');
const { childRun, temporaryEnvironment, profileBudget, fileConcurrency } = require('../tools/conditional-qa/run.cjs');
const { materialize, write, release, prepare, slotConfigs, slotState, repairCheckout, git: runGit } = require('../tools/conditional-qa/inputs.cjs');
const { extendQueue, nextItem, advanceTurn, acquire, sleptDuring, failureDisposition, due, resumeFinished, markCancelledRuns, republishFailures, diskWaitFor, browserProfileDiskFull, runPool, cpuMeter, roomForFirst, roomForAnother, calmGate, trimPassedRun, tick } = require('../tools/conditional-qa/worker.cjs');
const { plan } = require('../tools/conditional-qa/install.cjs');
const github = require('../tools/conditional-qa/github.cjs');
const { wait } = require('../tools/conditional-qa/wait-local.cjs');
const manifest = c.readManifest(root), selected = manifest.cases.filter(row => row.route === 'local');
const commit = 'a'.repeat(40);
const good = () => ({ version: 1, commit, manifestDigest: manifest.digest, expected: selected.length, passed: selected.length,
  ok: true, sourceUnchanged: true, rows: selected.map(row => ({ ...row, status: 'pass' })) });
function scratch(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conditional-qa-test-')); t.after(() => { if (!c.within(os.tmpdir(), dir) || fs.lstatSync(dir).isSymbolicLink()) throw Error('Unsafe test cleanup'); fs.rmSync(dir, { recursive: true, force: true }); }); return dir; }

test('all 113 original cases have one concrete route and a live source file', () => {
  assert.equal(check(root), 137);
  assert.deepEqual(Object.fromEntries(['windows', 'linux', 'local'].map(route => [route, manifest.cases.filter(row => row.route === route).length])), { windows: 43, linux: 12, local: 82 });
});
test('the temp-folder cleanup Windows cases (robocopy, junctions) are exactly the skip-marked tests in their source', () => {
  // 11-10 `171259080` added five Windows-only tests without registering them; Linux skipped them and syntax-check stayed red for 31 runs.
  const rows = ['S123', 'S124', 'S125', 'S126', 'S127'].map(id => manifest.cases.find(row => row.id === id));
  const source = fs.readFileSync(path.join(root, 'tests/tmp자동정리.test.js'), 'utf8');
  const skipping = [...source.matchAll(/^test\('([^']+)', \{ skip:/gm)].map(match => match[1]);
  assert.deepEqual(rows.map(row => row.name).sort(), skipping.sort());
  for (const row of rows) assert.deepEqual([row.route, row.profile, row.file], ['windows', 'default', 'tests/tmp자동정리.test.js']);
});
test('every root test that skips off Windows is registered — on the Windows PC nothing skips, so only this static scan sees it before the push', () => {
  // The Linux guard (`guard.cjs --skips`) reports the skip only after the push, outside TAP (`# fail 0` and a red step). Trodden 11-09 (twice) and 11-10.
  const registered = new Set(manifest.cases.map(row => `${row.file}\n${row.name}`));
  const declaration = /^\s*(?:test|it)\((['"`])((?:\\.|(?!\1).)*)\1\s*,\s*\{\s*skip\s*:\s*([^}]*)\}/;
  const offWindows = /!==?\s*['"]win32['"]|!\s*윈도우|!\s*(?:isWindows|onWindows|WINDOWS|windows)\b/;
  const missing = [], unreadable = [];
  let seen = 0;
  for (const file of fs.readdirSync(path.join(root, 'tests')).filter(name => /\.test\.(?:js|cjs|mjs)$/.test(name))) {
    fs.readFileSync(path.join(root, 'tests', file), 'utf8').split(/\r?\n/).forEach((line, index) => {
      if (!/skip\s*:/.test(line) || !/^\s*(?:test|it)\(/.test(line) || !offWindows.test(line)) return;
      const match = declaration.exec(line);
      if (!match) { unreadable.push(`tests/${file}:${index + 1}`); return; }
      if (!offWindows.test(match[3])) return;
      seen += 1;
      const name = match[2].replace(/\\(.)/g, '$1');
      if (!registered.has(`tests/${file}\n${name}`)) missing.push(`tests/${file}:${index + 1} ${name}`);
    });
  }
  assert.ok(seen >= 21, `the scan found only ${seen} Windows-only tests — the pattern no longer matches how they are written`);
  assert.deepEqual(unreadable, [], 'write the test name as one plain string literal on the test( line so it can be matched against cases.json');
  assert.deepEqual(missing, [], 'register these in tools/conditional-qa/cases.json with a route that really runs them (README table), or make them run on Linux too');
});
test('the text checker conditional cases keep their localization inputs and have real local routes', () => {
  const rows = ['S120', 'S121', 'S122'].map(id => manifest.cases.find(row => row.id === id));
  const source = fs.readFileSync(path.join(root, 'tests/글자검사.test.js'), 'utf8');
  const skipping = [...source.matchAll(/^test\('([^']+)', \{ skip:/gm)].map(match => match[1]);
  assert.deepEqual(rows.map(row => row.name).sort(), skipping.sort());
  for (const row of rows) assert.deepEqual([row.route, row.profile, row.file], ['local', 'default', 'tests/글자검사.test.js']);
  const { outsideTestedTree } = require('../tools/conditional-qa/tested-tree.cjs');
  assert.equal(outsideTestedTree('docs/마케팅/현지화/언어프로필.json'), false);
  assert.equal(outsideTestedTree('docs/브랜드_폰트/InterTight/InterTight-Bold.ttf'), false);
});
test('S117–S119 and S128 run on the Linux host with the hash-pinned image libraries, never by skipping', () => {
  // 11-11 `ce56e974c` added the face-light test (S128) without registering it; syntax-check skipped it and stayed red for 33 runs.
  const rows = ['S117', 'S118', 'S119', 'S128'].map(id => manifest.cases.find(item => item.id === id));
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/conditional-qa.yml'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(workflow, /uses: actions\/setup-python@v\d+\n\s+with:\n\s+python-version: '3\.\d+'/);
  for (const library of ['numpy', 'pillow', 'opencv-python-headless', 'scipy']) assert.match(workflow, new RegExp(`\\n\\s+${library}==[\\d.]+ --hash=sha256:[0-9a-f]{64}`));
  assert.match(workflow, /pip install [^\n]*--only-binary=:all: --require-hashes -r /);
  assert.match(workflow, /sudo apt-get install -y ffmpeg/);
  const source = fs.readFileSync(path.join(root, 'tests/컷연속성검사.test.js'), 'utf8');
  for (const row of rows) {
    assert.deepEqual([row.route, row.file], ['linux', 'tests/컷연속성검사.test.js']);
    assert.ok(source.includes(`test('${row.name}'`), 'the registered name must stay the test name');
  }
  // The PC has the libraries, so a new image test passes before push and only skips in syntax-check — register it here first.
  const skipping = [...source.matchAll(/^test\('([^']+)', \{ skip: ![^\n]*그림라이브러리/gm)].map(match => match[1]);
  assert.deepEqual(skipping.sort(), rows.map(row => row.name).sort(), 'every image or video test of the cut continuity checker is registered');
});
test('S116 runs on the Windows host with the pinned restic release, never by skipping', () => {
  const row = manifest.cases.find(item => item.id === 'S116');
  assert.equal(row.route, 'windows');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/conditional-qa.yml'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(workflow, /Get-FileHash -Algorithm SHA256 -Path \$zip\)\.Hash -ne '[0-9a-f]{64}'\) \{ throw/);
  assert.match(workflow, /npm ci --prefix experiences\/solo-backup /);
  assert.match(workflow, /SOLO_BACKUP_RESTIC: \$\{\{ runner\.os == 'Windows' && format\('\{0\}\\solo-backup-restic\\restic_0\.19\.1_windows_amd64\.exe', runner\.temp\)/);
  assert.ok(fs.readFileSync(path.join(root, row.file), 'utf8').includes(`test('${row.name}'`), 'the registered name must stay the test name');
});
test('S129–S137 run on the Windows host with the forked engine, the run executable and the planner built from these sources, never by skipping', () => {
  // 11-10 `26d6e9e72` (S135) and the 11-12–13 work backup Stage 1 fork (S129–S134) added these without registering them;
  // wide-tests skipped them on Linux and its experiences bundle stayed red. S136 is 0.5.0's Windows path-rule test, which
  // failed on Linux there (11-13) — skipped off Windows like the fork's copy (S130), and run here. S137 (11-13 `52d029ece`)
  // put `skip:` on the next line, which the one-line scan did not see.
  const rows = ['S129', 'S130', 'S131', 'S132', 'S133', 'S134', 'S137', 'S135', 'S136'].map(id => manifest.cases.find(item => item.id === id));
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/conditional-qa.yml'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(workflow, /npm ci --prefix experiences\/solo-backup-rust\/engine /);
  // The executables are cached only under a key of every tracked file they are built from; a miss builds them here.
  assert.match(workflow, /path: \$\{\{ runner\.temp \}\}\\work-backup-exes\n\s+key: work-backup-exes-v\d+-\$\{\{ hashFiles\('experiences\/solo-backup-rust\/src-tauri\/\*\*', 'experiences\/solo-backup-rust\/contract\/\*\*', 'experiences\/solo-backup-rust\/inventory\/\*\*'\) \}\}\n/);
  assert.match(workflow, /if: runner\.os == 'Windows' && steps\.work-backup-exes\.outputs\.cache-hit != 'true'\n/);
  assert.match(workflow, /cargo build --locked --bin WorkBackupRun /);
  assert.match(workflow, /cargo build --locked --release --bin WorkBackupPlanner /);
  for (const [name, file] of [['SWB_RUN_EXE', 'WorkBackupRun.exe'], ['SWB_RECOMMENDED_PLANNER', 'WorkBackupPlanner.exe']]) {
    assert.ok(workflow.includes(`${name}: \${{ runner.os == 'Windows' && format('{0}\\work-backup-exes\\${file}', runner.temp) || '' }}`), name);
  }
  assert.ok(workflow.includes(`SWB_RECOMMENDED_RESTIC: \${{ runner.os == 'Windows' && format('{0}\\solo-backup-restic\\restic_0.19.1_windows_amd64.exe', runner.temp) || '' }}`));
  // Every top-level test in the fork that can skip is one of these — on the PC nothing skips, so only this scan sees it before the push.
  // The options object may span lines (`{` here, `skip:` on the next).
  const declaration = /^test\((['"])((?:\\.|(?!\1).)*)\1\s*,\s*\{[^}]*?\bskip\s*:/gm;
  const skipping = [];
  for (const folder of ['experiences/solo-backup-rust/tests', 'experiences/solo-backup-rust/engine/tests']) {
    for (const file of fs.readdirSync(path.join(root, folder)).filter(name => /\.test\.(?:js|cjs|mjs)$/.test(name))) {
      for (const match of fs.readFileSync(path.join(root, folder, file), 'utf8').matchAll(declaration)) {
        skipping.push(`${folder}/${file}\n${match[2].replace(/\\(.)/g, '$1')}`);
      }
    }
  }
  assert.deepEqual(skipping.sort(), rows.slice(0, 7).map(row => `${row.file}\n${row.name}`).sort(), 'register every fork test that skips off the Windows host');
  for (const row of rows) {
    assert.deepEqual([row.route, row.profile], ['windows', 'default'], row.id);
    const source = fs.readFileSync(path.join(root, row.file), 'utf8');
    assert.ok(source.includes(`test('${row.name.replaceAll("'", "\\'")}'`), `${row.id}: the registered name must stay the test name`);
  }
});
test('the local default profile reserves time for homework, client and the final receipt', () => {
  const minute = 60_000;
  assert.equal(profileBudget('local', 'default', 48 * minute), 36 * minute);
  assert.equal(profileBudget('local', 'homework', 12 * minute), 9 * minute);
  assert.equal(profileBudget('local', 'client', 3 * minute), 3 * minute);
  assert.equal(profileBudget('local', 'default', 12 * minute), 0);
  for (const route of ['windows', 'linux', 'all']) assert.equal(profileBudget(route, 'default', 48 * minute), 20 * minute);
});
test('completed test events can extend a progressing child, but silence and the absolute deadline stop it', async t => {
  const dir = scratch(t), events = path.join(dir, 'events.jsonl'), release = path.join(dir, 'finished');
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  const launch = () => childRun(['-e', `const fs = require('node:fs'); const stop = Date.now() + 15000;
    setInterval(() => { if (fs.existsSync(process.argv[1])) process.exit(0); if (Date.now() > stop) process.exit(2); }, 25)`, release],
    { cwd: dir, env: process.env, log: path.join(dir, 'process.log'), progressFile: events, idleTimeoutMs: 4000, timeoutMs: 7000 });
  const event = () => {
    fs.appendFileSync(events, '{"event":"test:pass"}\n');
    const now = new Date();
    fs.utimesSync(events, now, now);
  };
  const makingProgress = launch();
  t.mock.timers.tick(3000); event(); t.mock.timers.tick(1500);
  fs.writeFileSync(release, 'done');
  const good = await makingProgress;
  assert.equal(good.exitCode, 0); assert.equal(good.timedOut, false);

  fs.unlinkSync(release); fs.unlinkSync(events);
  const stalled = launch();
  fs.appendFileSync(path.join(dir, 'process.log'), 'still printing\n');
  t.mock.timers.tick(4000);
  assert.equal((await stalled).timeoutReason, 'no-test-events');

  const expired = launch();
  t.mock.timers.tick(3000); event(); t.mock.timers.tick(1500);
  t.mock.timers.tick(1500); event(); t.mock.timers.tick(1000);
  assert.equal((await expired).timeoutReason, 'deadline');
});
test('every route owns a real temporary path instead of an inherited 8.3 or virtual alias', t => {
  const dir = scratch(t), env = temporaryEnvironment(dir);
  assert.equal(env.TEMP, fs.realpathSync.native(path.join(dir, 'temp')));
  assert.equal(env.TMP, env.TEMP);
  assert.ok(fs.statSync(env.TEMP).isDirectory());
});
test('manifest binding is stable across checkout line endings, but not across dropped cases', t => {
  const dir = scratch(t), file = path.join(dir, 'tools/conditional-qa/cases.json'); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, fs.readFileSync(path.join(root, 'tools/conditional-qa/cases.json'), 'utf8').replace(/\r?\n/g, '\r\n'));
  assert.equal(c.readManifest(dir).digest, manifest.digest);
  const changed = JSON.parse(fs.readFileSync(file)); changed.cases = changed.cases.filter(row => row.id !== 'S113'); changed.expectedCount--;
  fs.writeFileSync(file, JSON.stringify(changed)); assert.throws(() => c.readManifest(dir), /incomplete|missing/);
});
test('a saved receipt cannot cover another commit, manifest, a missing case or duplicate', () => {
  const options = { commit, digest: manifest.digest, cases: selected };
  assert.ok(c.coverage(good(), options));
  for (const patch of [{ commit: 'b'.repeat(40) }, { manifestDigest: 'wrong' }, { candidate: true }, { sourceUnchanged: false }, { passed: 77 }]) assert.equal(c.coverage({ ...good(), ...patch }, options), false);
  const missing = good(); missing.rows.pop(); assert.equal(c.coverage(missing, options), false);
  const duplicate = good(); duplicate.rows[1] = duplicate.rows[0]; assert.equal(c.coverage(duplicate, options), false);
  const skipped = good(); skipped.rows[0].status = 'skipped'; assert.equal(c.coverage(skipped, options), false);
});
test('real node:test events reject skips, todo, duplicate names and file-level failures', async t => {
  const dir = scratch(t), file = path.join(dir, 'cases.test.cjs'), log = path.join(dir, 'events.jsonl');
  fs.writeFileSync(file, `const t=require('node:test');t('pass',()=>{});t('skip',{skip:'missing prerequisite'},()=>{});t('todo',{todo:true},()=>{});t('twice',()=>{});t('twice',()=>{});`);
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = await childRun(['--test', `--test-reporter=${pathToFileURL(path.join(root, 'tools/conditional-qa/reporter.cjs')).href}`, `--test-reporter-destination=${log}`, file], { cwd: dir, env, log: path.join(dir, 'process.log') });
  const events = fs.readFileSync(log, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  const rows = ['pass', 'skip', 'todo', 'twice', 'missing'].map(name => ({ id: name, name, file: 'cases.test.cjs' }));
  assert.deepEqual(c.judge(rows, events, { root: dir, ...result }).rows.map(row => row.status), ['pass', 'skipped', 'skipped', 'duplicate', 'missing']);
  assert.equal(c.judge(rows.slice(0, 1), events, { root: dir, ...result, timedOut: true }).ok, false);
  assert.equal(c.judge(rows.slice(0, 1), [...events, { event: 'test:fail', file, name: 'file died' }], { root: dir, ...result }).ok, false);
});
test('an unregistered future skip fails even if an older failure baseline allows the file', () => {
  const row = manifest.cases[0];
  assert.equal(c.unknownSkips(manifest, [{ 파일: row.file, 시험: row.name, 종류: 'test' }], root).length, 0);
  assert.equal(c.unknownSkips(manifest, [{ 파일: row.file, 시험: 'new conditional test', 종류: 'test' }], root).length, 1);
  assert.equal(c.unknownSkips(manifest, [{ 파일: row.file, 시험: row.name + ' renamed', 종류: 'test' }], root).length, 1);
});
test('private inputs are hash-checked, cannot escape, and cannot replace tracked source', t => {
  const dir = scratch(t), state = path.join(dir, 'private'), target = path.join(dir, 'checkout');
  fs.mkdirSync(path.join(state, 'blobs'), { recursive: true }); fs.mkdirSync(target);
  const bytes = Buffer.from('audited fixture'), sha256 = c.sha256(bytes), row = { area: 'app', file: 'fixture.js', sha256 };
  fs.writeFileSync(path.join(state, 'blobs', sha256), bytes);
  assert.equal(materialize(state, [row], target).length, 1);
  fs.writeFileSync(path.join(target, row.file), 'current source');
  assert.equal(materialize(state, [row], target, { tracked: new Set([row.file]) }).length, 0);
  assert.throws(() => materialize(state, [row], target), /changed/);
  assert.throws(() => materialize(state, [{ ...row, file: '../escape' }], target), /Invalid/);
  fs.writeFileSync(path.join(state, 'blobs', sha256), 'changed'); assert.throws(() => materialize(state, [row], target), /mismatch/);
});
function candidateState(dir) {
  const state = path.join(dir, 'candidate'), app = path.join(state, 'workspace/SYNK-appsscript'), talk = path.join(state, 'workspace/SYNK-talk');
  const homework = path.join(state, 'homework/SYNK-talk'), shared = path.join(dir, 'worker-blobs');
  const put = (file, text = 'x') => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return file; };
  const git = args => require('node:child_process').execFileSync('git', args, { cwd: app, windowsHide: true, stdio: 'ignore' });
  write(path.join(state, 'owner.json'), { version: 1, purpose: 'synk-conditional-qa', state });
  put(path.join(app, 'tracked.js')); put(path.join(app, '.gitignore'), 'node_modules/\nrender/\n');
  git(['init', '-q']); git(['add', '.']); git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base']);
  put(path.join(app, 'tracked.js'), 'overlay'); put(path.join(app, 'node_modules/dep/index.js'));
  const pinned = [put(path.join(app, 'pinned.bin')), put(path.join(app, 'render/full.mp4')), put(path.join(talk, 'lib/town-scope.js')),
    put(path.join(homework, 'lib/a.js')), put(path.join(state, 'tools/caddy.exe'))].map(file => ({ file, sha256: c.sha256('x') }));
  put(path.join(app, 'out/result.txt')); put(path.join(app, 'render/note.txt')); put(path.join(talk, 'data/log.txt')); put(path.join(talk, 'node_modules/y.js'));
  fs.mkdirSync(path.join(state, 'empty-hooks')); put(path.join(shared, 'blob'));
  fs.symlinkSync(shared, path.join(state, 'blobs'), 'junction'); fs.symlinkSync(app, path.join(state, 'homework/SYNK-appsscript'), 'junction');
  write(path.join(state, 'context.json'), { version: 1, root: app, candidate: true, pinned });
  return { state, app, shared };
}
test('a finished candidate releases its rebuildable checkout, keeps unexplained files and never enters shared links', t => {
  const { state, shared } = candidateState(scratch(t));
  const receipt = release(state);
  for (const name of ['workspace', 'homework', 'tools', 'empty-hooks', 'blobs', 'workspace.releasing']) assert.equal(fs.existsSync(path.join(state, name)), false, name);
  assert.equal(fs.readFileSync(path.join(shared, 'blob'), 'utf8'), 'x');
  assert.deepEqual([...receipt.kept].sort(), ['workspace/SYNK-appsscript/out/result.txt', 'workspace/SYNK-appsscript/render/note.txt',
    'workspace/SYNK-appsscript/tracked.js', 'workspace/SYNK-talk/data/log.txt']);
  assert.equal(fs.readFileSync(path.join(state, 'kept/workspace/SYNK-appsscript/tracked.js'), 'utf8'), 'overlay');
  assert.deepEqual(receipt.left, []); assert.ok(receipt.bytes > 0);
  assert.deepEqual(release(state), receipt);
  const config = { state, root: path.join(state, 'workspace/SYNK-appsscript') };
  assert.throws(() => prepare(config, 'a'.repeat(40)), /released/);
});
test('a changed pinned file is kept, a linked top folder is never walked, and an interrupted deletion finishes without git', t => {
  const dir = scratch(t);
  { // GPT GA1 — a pinned path whose bytes changed cannot be rebuilt from its blob
    const { state, app } = candidateState(path.join(dir, 'a'));
    fs.writeFileSync(path.join(app, 'render/full.mp4'), 'new take');
    assert.ok(release(state).kept.includes('workspace/SYNK-appsscript/render/full.mp4'));
    assert.equal(fs.readFileSync(path.join(state, 'kept/workspace/SYNK-appsscript/render/full.mp4'), 'utf8'), 'new take');
  }
  { // GPT GA2 — tools as a junction to someone else's folder: left alone, its files stay where they are
    const { state } = candidateState(path.join(dir, 'b')), shared = path.join(dir, 'shared-tools');
    fs.rmSync(path.join(state, 'tools'), { recursive: true }); fs.mkdirSync(shared); fs.writeFileSync(path.join(shared, 'memo.txt'), 'theirs');
    fs.symlinkSync(shared, path.join(state, 'tools'), 'junction');
    assert.ok(!release(state).kept.some(rel => rel.startsWith('tools/')));
    assert.equal(fs.readFileSync(path.join(shared, 'memo.txt'), 'utf8'), 'theirs');
  }
  { // GPT r2 GA2 — the checkout slot is a junction to another repository: nothing of it is scanned or moved
    const { state, app } = candidateState(path.join(dir, 'd')), other = path.join(dir, 'other-repo');
    fs.renameSync(app, other); fs.writeFileSync(path.join(other, 'memo.txt'), 'theirs');
    fs.symlinkSync(other, app, 'junction');
    assert.ok(!release(state).kept.some(rel => rel.startsWith('workspace/SYNK-appsscript/')));
    assert.equal(fs.readFileSync(path.join(other, 'memo.txt'), 'utf8'), 'theirs'); assert.ok(fs.existsSync(path.join(other, '.git')));
  }
  { // GPT GA3 · r2 GA1 — stopped after kept/ was written and .git was already deleted; tools was not renamed yet and gained a file
    const { state } = candidateState(path.join(dir, 'c'));
    for (const name of ['workspace', 'homework', 'empty-hooks']) {
      fs.renameSync(path.join(state, name), path.join(state, `${name}.releasing`)); fs.writeFileSync(path.join(state, `${name}.releasing`, '.cqa-scanned'), 'x');
    }
    fs.mkdirSync(path.join(state, 'kept')); fs.writeFileSync(path.join(state, 'kept/earlier'), 'kept before the stop');
    fs.writeFileSync(path.join(state, 'tools/memo.txt'), 'after the stop');
    fs.rmSync(path.join(state, 'workspace.releasing/SYNK-appsscript/.git'), { recursive: true, force: true });
    const receipt = release(state);
    assert.deepEqual(receipt.kept, ['earlier', 'tools/memo.txt']); assert.deepEqual(receipt.left, []);
    assert.equal(fs.readFileSync(path.join(state, 'kept/tools/memo.txt'), 'utf8'), 'after the stop');
    for (const name of ['workspace.releasing', 'homework.releasing', 'tools.releasing', 'releasing.lock']) assert.equal(fs.existsSync(path.join(state, name)), false, name);
  }
  { // GPT r3 GA1 — tools was scanned and deleted before the stop; a new tools/ made afterwards is still scanned
    const { state } = candidateState(path.join(dir, 'e'));
    fs.rmSync(path.join(state, 'tools'), { recursive: true });
    for (const name of ['workspace', 'homework', 'empty-hooks']) {
      fs.renameSync(path.join(state, name), path.join(state, `${name}.releasing`)); fs.writeFileSync(path.join(state, `${name}.releasing`, '.cqa-scanned'), 'x');
    }
    fs.mkdirSync(path.join(state, 'kept/tools'), { recursive: true }); fs.writeFileSync(path.join(state, 'kept/tools/memo.txt'), 'kept before the stop');
    fs.mkdirSync(path.join(state, 'tools')); fs.writeFileSync(path.join(state, 'tools/memo.txt'), 'new');
    assert.deepEqual(release(state).kept, ['tools/memo.txt', 'tools/memo.txt.2']); // GPT r4 GA1 — the earlier kept file is not overwritten
    assert.equal(fs.readFileSync(path.join(state, 'kept/tools/memo.txt'), 'utf8'), 'kept before the stop');
    assert.equal(fs.readFileSync(path.join(state, 'kept/tools/memo.txt.2'), 'utf8'), 'new');
  }
  { // Fable F2 · F3 — a refused retry puts back only what it renamed itself; a live lock refuses, a dead one is taken over
    const { state } = candidateState(path.join(dir, 'f'));
    fs.renameSync(path.join(state, 'homework'), path.join(state, 'homework.releasing')); fs.writeFileSync(path.join(state, 'homework.releasing/.cqa-scanned'), 'x');
    fs.writeFileSync(path.join(state, 'releasing.lock'), String(process.pid));
    assert.throws(() => release(state), /Another release/);
    fs.writeFileSync(path.join(state, 'releasing.lock'), '999999');
    if (process.platform === 'win32') {
      const held = fs.openSync(path.join(state, 'tools/caddy.exe'), 'r');
      try { assert.throws(() => release(state), /still in use/); } finally { fs.closeSync(held); }
      assert.ok(fs.existsSync(path.join(state, 'homework.releasing')) && !fs.existsSync(path.join(state, 'homework')), 'resumed folder stays resumed');
      assert.ok(fs.existsSync(path.join(state, 'workspace')) && !fs.existsSync(path.join(state, 'workspace.releasing')), 'own rename is put back');
    }
    assert.deepEqual(release(state).left, []); assert.equal(fs.existsSync(path.join(state, 'releasing.lock')), false);
  }
  { // Fable F1 — prepare() stopped before its context: the provisional context and inputs.json still free it
    const { state, app } = candidateState(path.join(dir, 'g'));
    const pinned = JSON.parse(fs.readFileSync(path.join(state, 'context.json'))).pinned;
    write(path.join(state, 'inputs.json'), { version: 1, files: [{ area: 'app', file: 'pinned.bin', sha256: c.sha256('x') }, { area: 'app', file: 'render/full.mp4', sha256: c.sha256('x') },
      { area: 'talk', file: 'lib/town-scope.js', sha256: c.sha256('x') }, { area: 'homework', file: 'lib/a.js', sha256: c.sha256('x') }, { area: 'tools', file: 'caddy.exe', sha256: c.sha256('x') }] });
    write(path.join(state, 'context.json'), { version: 1, root: app, candidate: true, incomplete: true, pinned: [] });
    assert.equal(pinned.length, 5);
    assert.deepEqual(release(state).kept, ['workspace/SYNK-appsscript/out/result.txt', 'workspace/SYNK-appsscript/render/note.txt',
      'workspace/SYNK-appsscript/tracked.js', 'workspace/SYNK-talk/data/log.txt']);
    assert.throws(() => prepare({ state, root: app }, 'a'.repeat(40)), /released/);
  }
  { // Fable F5 — prepare() refuses a state whose release was interrupted, and the next release finishes it
    const { state, app } = candidateState(path.join(dir, 'h'));
    fs.renameSync(path.join(state, 'tools'), path.join(state, 'tools.releasing')); fs.writeFileSync(path.join(state, 'tools.releasing', '.cqa-scanned'), 'x');
    assert.throws(() => prepare({ state, root: app }, 'a'.repeat(40)), /being released/); // Fable F5
    assert.deepEqual(release(state).left, []); assert.ok(fs.existsSync(path.join(state, 'released.json')));
  }
});
test('the scheduled worker state, a non-candidate and a candidate still in use are never released', async t => {
  const dir = scratch(t), { state, app } = candidateState(dir);
  const busy = require('node:child_process').spawn(process.execPath, ['-e', 'setTimeout(()=>{},30000)'], { cwd: app, windowsHide: true, stdio: 'ignore' });
  const exited = new Promise(resolve => busy.once('exit', resolve));
  try {
    await new Promise(resolve => setTimeout(resolve, 300));
    if (process.platform === 'win32') {
      assert.throws(() => release(state), /still in use/);
      assert.ok(fs.existsSync(path.join(app, 'tracked.js'))); assert.equal(fs.existsSync(path.join(state, 'workspace.releasing')), false);
    }
  } finally { busy.kill(); await exited; }
  fs.writeFileSync(path.join(state, 'queue.json'), '{}'); assert.throws(() => release(state), /never the scheduled worker/);
  fs.rmSync(path.join(state, 'queue.json'));
  write(path.join(state, 'context.json'), { ...JSON.parse(fs.readFileSync(path.join(state, 'context.json'))), candidate: false });
  assert.throws(() => release(state), /Only a candidate/);
  assert.ok(fs.existsSync(path.join(app, 'tracked.js')));
});
test('queue preserves every discovered commit and a live worker cannot be replaced', t => {
  const a = 'a'.repeat(40), b = 'b'.repeat(40), state = { seen: a, items: [{ commit: a, status: 'passed' }] };
  extendQueue(state, b, [a, b]); assert.deepEqual(state.items.map(row => row.commit), [a, b]);
  assert.throws(() => extendQueue(state, 'master', []), /SHA/);
  const release = acquire(scratch(t));
  // Same directory is intentionally reused; the owner is this still-live process.
  const lockDir = scratch(t), unlock = acquire(lockDir); assert.throws(() => acquire(lockDir), /already running/); unlock(); release();
});
test('the scheduled worker runs at normal priority, and only a logged sleep turns a failed run into a retry', t => {
  const dir = scratch(t), state = path.join(dir, 'state'), ops = path.join(dir, 'ops'), pythonw = path.join(dir, 'pythonw.exe');
  for (const file of [pythonw, path.join(ops, 'tools/숨김실행.py'), path.join(ops, 'tools/conditional-qa/worker.cjs')]) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, ''); }
  write(path.join(state, 'owner.json'), { version: 1, purpose: 'synk-conditional-qa', state });
  write(path.join(state, 'config.json'), { version: 1, repo: github.REPO, state, root: path.join(state, 'workspace/SYNK-appsscript') });
  assert.match(plan({ state, ops, pythonw }).script, /New-ScheduledTaskSettingsSet [^\n]* -Priority 4\n/);
  const asked = [], run = (command, args) => { asked.push(args.join(' ')); return asked.length === 1 ? "<Event xmlns='http://schemas.microsoft.com/win/2004/08/events/event'><System/></Event>" : ''; };
  assert.equal(sleptDuring('2026-11-01T12:55:27.726Z', '2026-11-01T13:12:00.909Z', { platform: 'win32', run }), true);
  assert.match(asked[0], /Microsoft-Windows-Kernel-Power'\] and \(EventID=42 or EventID=107\) and TimeCreated\[@SystemTime>='2026-11-01T12:55:27\.726Z' and @SystemTime<='2026-11-01T13:12:00\.909Z'\]/);
  assert.equal(sleptDuring(0, 1, { platform: 'win32', run }), false);
  assert.equal(sleptDuring(0, 1, { platform: 'win32', run: () => { throw Error('event log unavailable'); } }), false);
  assert.equal(sleptDuring(0, 1, { platform: 'linux', run: () => assert.fail('no event log off Windows') }), false);
  assert.deepEqual(['queued', 'running', 'publish-pending', 'passed', 'failed'].map(status => due({ status })), [true, true, true, false, false]);
  assert.equal(due({ status: 'retry', retryAt: Date.now() + 60_000 }), false); assert.equal(due({ status: 'retry', retryAt: Date.now() - 1 }), true);
});
test('observed sleep or OS disk exhaustion is pending; a test failure remains red', () => {
  const from = '2026-11-02T13:01:39.573Z', now = new Date('2026-11-02T13:13:35.839Z');
  for (const [code, loggedSleep, expectedStatus, expectedPublication] of [
    ['TEST_FAILURE', true, 'retry', 'pending'], ['TEST_FAILURE', false, 'failed', 'failure'],
    ['EIO', true, 'retry', 'failure'], ['ENOSPC', false, 'retry', 'pending'], [undefined, false, 'retry', 'failure'],
  ]) {
    let asked = 0;
    const error = Object.freeze({ code, message: 'original failure' });
    const result = failureDisposition(error, from, { now, slept: (start, end) => {
      asked++; assert.equal(start, from); assert.equal(end, now); return loggedSleep;
    } });
    assert.equal(asked, code === 'TEST_FAILURE' ? 1 : 0);
    assert.equal(result.status, expectedStatus); assert.equal(result.publicationState, expectedPublication);
    assert.notEqual(result.status, 'passed'); assert.notEqual(result.publicationState, 'success');
    assert.equal(error.message, 'original failure');
  }
});

test('local homework and registered retries run one file at a time while other work keeps two slots', () => {
  assert.equal(fileConcurrency('local', 'homework', false), 1);
  assert.equal(fileConcurrency('local', 'default', true), 1);
  assert.equal(fileConcurrency('local', 'client', true), 1);
  assert.equal(fileConcurrency('local', 'default', false), 2);
  for (const route of ['windows', 'linux', 'all']) assert.equal(fileConcurrency(route, 'homework', true), 2);
});

test('a requested registered commit gets one local verification and keeps the scheduled turn', () => {
  const oldest = 'b'.repeat(40), target = 'c'.repeat(40), recent = 'd'.repeat(40);
  const queue = { nextTurn: 'recent', items: [
    { commit: oldest, status: 'queued' },
    { commit: target, status: 'retry', retryRequest: 'receipt', retryAt: 30 },
    { commit: recent, status: 'queued' },
  ] };
  const unchanged = structuredClone(queue);
  assert.equal(nextItem(queue, recent, new Set(), 31, target), queue.items[1]);
  assert.equal(nextItem(queue, recent, new Set(), 29, target), undefined);
  assert.equal(nextItem(queue, recent, new Set([target]), 31, target), undefined);
  assert.deepEqual(queue, unchanged);
  assert.equal(nextItem(queue, recent, new Set(), 31), queue.items[2]);
  queue.nextTurn = 'oldest';
  assert.equal(nextItem(queue, recent, new Set(), 31), queue.items[0]);
  for (const status of ['queued', 'running', 'publish-pending']) {
    queue.items[1].status = status;
    assert.equal(nextItem(queue, recent, new Set(), 31, target), queue.items[1]);
  }
  queue.items[1].status = 'failed';
  assert.throws(() => nextItem(queue, recent, new Set(), 31, target), /retry\.cjs/);
  assert.equal(nextItem(queue, recent, new Set([target]), 31, target), undefined);
  queue.items[1].status = 'passed';
  assert.equal(nextItem(queue, recent, new Set(), 31, target), undefined);
  assert.throws(() => nextItem(queue, recent, new Set(), 31, 'e'.repeat(40)), /registered/);
  queue.items.push({ ...queue.items[1] });
  assert.throws(() => nextItem(queue, recent, new Set(), 31, target), /registered/);
});

test('a requested verification leaves an existing lock for the scheduled worker', t => {
  const dir = scratch(t), file = path.join(dir, 'worker.lock');
  const lock = JSON.stringify({ pid: 2147483646, createdAt: '2026-01-01T00:00:00Z' });
  fs.writeFileSync(file, lock);
  assert.throws(() => acquire(dir, { reclaimDead: false }), /already running/);
  assert.equal(fs.readFileSync(file, 'utf8'), lock);
});

test('storage pressure preserves the selected verification and lets an already verified receipt publish', () => {
  const stateDir = '/registered/qa', need = 15 * 1024 ** 3;
  const capacity = available => (target, options) => {
    assert.equal(target, stateDir); assert.deepEqual(options, { bigint: true });
    return { bsize: 4096n, bavail: BigInt(available / 4096) };
  };
  const queue = { nextTurn: 'oldest', items: [{ commit: 'b'.repeat(40), status: 'queued' }, { commit, status: 'retry', retryAt: 0 }] };
  const before = structuredClone(queue), oldest = nextItem(queue, commit);
  assert.deepEqual(diskWaitFor(oldest, stateDir, capacity(need - 4096)), { availableBytes: need - 4096, requiredBytes: need });
  assert.equal(diskWaitFor(oldest, stateDir, capacity(need)), null);
  assert.deepEqual(queue, before); assert.equal(nextItem(queue, commit), oldest);
  assert.equal(diskWaitFor({ status: 'publish-pending' }, stateDir, () => assert.fail('a sealed result can publish')), null);
  assert.throws(() => diskWaitFor(oldest, stateDir, () => { throw Error('unreadable volume'); }), /unreadable volume/);
});

test('only the current Edge profile exhausting storage can interrupt an otherwise intact browser verification', () => {
  const output = 'C:\\qa\\runs\\original-123', row = { file: 'qa/browser.test.mjs', name: 'subscribe', status: 'fail' };
  const message = ['browserType.launch: Target closed', 'Failed to create cache directory: ' + output + '\\default\\temp\\playwright_chromiumdev_profile-abc\\GPUPersistentCache: (0x70)', 'Failed to create initial profile'].join('\n');
  const failure = { file: row.file, name: row.name, error: { message } };
  const phase = { profile: 'default', ok: false, rows: [row, { status: 'missing' }], unexpectedFailures: [failure] };
  const receipt = { platform: 'win32', candidate: false, sourceUnchanged: true, inputsUnchanged: true, phases: [phase, { ok: true }] };
  assert.ok(browserProfileDiskFull(receipt, output));
  assert.equal(browserProfileDiskFull(receipt, output + '-other'), false);
  for (const altered of [message.replace('0x70', '0x05'), message.replace('Failed to create initial profile', 'Cache disabled'), 'actual assertion failed']) {
    assert.equal(browserProfileDiskFull({ ...receipt, phases: [{ ...phase, unexpectedFailures: [{ ...failure, error: { message: altered } }] }] }, output), false);
  }
  assert.equal(browserProfileDiskFull({ ...receipt, phases: [...receipt.phases, { ok: false, unexpectedFailures: [] }] }, output), false);
  assert.equal(browserProfileDiskFull({ ...receipt, phases: [{ ...phase, rows: [row, { ...row, name: 'other' }], unexpectedFailures: [failure, { ...failure, name: 'other', error: { message: 'assertion failed' } }] }] }, output), false);
  assert.equal(browserProfileDiskFull({ ...receipt, inputsUnchanged: false }, output), false);
  assert.equal(browserProfileDiskFull({ ...receipt, phases: [] }, output), false);
});

test('the newest commit runs before the backlog; historical entries and failed proof are preserved', () => {
  const commits = ['a', 'b', 'c', 'd', 'e'].map(x => x.repeat(40));
  const queue = { seen: commits[2], items: [
    { commit: commits[0], status: 'queued' }, { commit: commits[1], status: 'failed' },
    { commit: commits[2], status: 'queued' },
  ] };
  const attempted = new Set(), before = JSON.stringify(queue);
  assert.equal(nextItem(queue, commits[2], attempted).commit, commits[2]);
  assert.equal(JSON.stringify(queue), before, 'selection does not change old results');
  attempted.add(commits[2]);
  assert.equal(nextItem(queue, commits[2], attempted).commit, commits[0]);
  attempted.add(commits[0]);
  extendQueue(queue, commits[3], [commits[3]]);
  assert.equal(nextItem(queue, commits[3], attempted).commit, commits[3], 'a push during verification gets priority next');
  queue.items.push({ commit: commits[4], status: 'publish-pending' });
  assert.equal(nextItem(queue, commits[3], attempted).commit, commits[4]);
  queue.items[4].status = 'retry'; queue.items[4].retryAt = 200;
  assert.equal(nextItem(queue, commits[4], attempted, 100).commit, commits[3], 'future retry does not spin or bury another recent commit');
  assert.equal(nextItem(queue, commits[4], attempted, 200).commit, commits[4]);
  assert.equal(queue.items[1].status, 'failed');
});

test('after the newest commit passes, recent and historical commits alternate without dropping any item', () => {
  const items = ['a', 'b', 'c', 'd'].map(x => ({ commit: x.repeat(40), status: 'queued' }));
  items[3].status = 'passed';
  const queue = { items }, attempted = new Set(), order = [];
  for (let item; (item = nextItem(queue, items[3].commit, attempted));) { order.push(item.commit); attempted.add(item.commit); }
  assert.deepEqual(order, [items[2].commit, items[0].commit, items[1].commit]);
  assert.deepEqual(items.map(item => item.status), ['queued', 'queued', 'queued', 'passed']);
});

test('continuous new pushes cannot starve older pending commits or automatically retry failed proof', () => {
  const old = ['a', 'b'].map(x => x.repeat(40)), failed = 'f'.repeat(40);
  const queue = { items: [...old.map(commit => ({ commit, status: 'queued' })), { commit: failed, status: 'failed', output: 'original-proof' }] };
  const attempted = new Set(), order = [];
  for (let n = 1; n <= 6; n++) {
    const head = String(n).repeat(40);
    extendQueue(queue, head, [head]);
    const item = nextItem(queue, head, attempted);
    order.push(item.commit); attempted.add(item.commit);
  }
  assert.deepEqual(order.slice(0, 4), ['1'.repeat(40), old[0], '3'.repeat(40), old[1]]);
  assert.equal(order.includes(failed), false);
  assert.deepEqual(queue.items[2], { commit: failed, status: 'failed', output: 'original-proof' });
});

test('the oldest turn survives a restart even when only one verification fits in each tick', () => {
  const old = 'a'.repeat(40), first = 'b'.repeat(40), next = 'c'.repeat(40);
  let queue = { items: [{ commit: old, status: 'queued' }, { commit: first, status: 'queued' }], nextTurn: 'recent' };
  assert.equal(nextItem(queue, first).commit, first);
  advanceTurn(queue); queue.items[1].status = 'passed';
  queue = JSON.parse(JSON.stringify(queue));
  extendQueue(queue, next, [next]);
  assert.equal(nextItem(queue, next, new Set()).commit, old, 'a new tick cannot reset the pending historical turn');
  const original = JSON.stringify(queue.items);
  advanceTurn(queue); assert.equal(JSON.stringify(queue.items), original, 'only the scheduling turn changes');
  assert.equal(nextItem(JSON.parse(JSON.stringify(queue)), next).commit, next);
  assert.throws(() => advanceTurn({ nextTurn: 'invalid' }), /Invalid queue turn/);
});

test('remote local-status evidence is exact and malformed requests never reach the API', () => {
  const value = { state: 'success', description: github.description(78, manifest.digest) };
  assert.ok(github.accepted(value, 78, manifest.digest)); assert.equal(github.accepted(value, 78, 'b'.repeat(64)), false);
  assert.equal(github.accepted({ state: 'success', description: 'passed' }, 78, manifest.digest), false);
  assert.throws(() => github.status('master', () => assert.fail('no network request allowed')), /SHA/);
  assert.throws(() => github.status(commit, () => ({ sha: 'b'.repeat(40), statuses: [] })), /bound/);
});
test('offline local verification releases its runner and never manufactures a green status', async () => {
  const writes = [];
  // Pending never passes and never holds the runner: the job cancels its own run once and gives up if that does not take effect.
  const cancels = [];
  await assert.rejects(wait({ root, commit, runId: '123', cancelGraceMs: 1, read: () => null, write: (...args) => writes.push(args), cancel: id => cancels.push(id) }), /did not take effect/);
  assert.equal(writes.length, 1); assert.equal(writes[0][1], 'pending');
  assert.deepEqual(cancels, ['123']);
  const pendingWrites = [];
  await assert.rejects(wait({ root, commit, runId: '124', cancelGraceMs: 1, read: () => ({ state: 'pending', description: 'Running' }), write: (...args) => pendingWrites.push(args), cancel: () => {} }), /did not take effect/);
  assert.equal(pendingWrites.length, 0, 'the worker already owns the pending status');
  await assert.rejects(wait({ root, commit, read: () => ({ state: 'pending' }), cancel: () => assert.fail('no run id, no cancel') }), /without a run id/);
  await assert.rejects(wait({ root, commit, runId: '125', retryPauseMs: 1, read: () => ({ state: 'pending' }), cancel: () => { throw Error('403'); } }), /403/);
  // One transient GitHub error does not turn a waiting run red; a lasting one fails the job, and that is still no pass.
  let reads = 0; const flaky = [];
  await assert.rejects(wait({ root, commit, runId: '127', retryPauseMs: 1, cancelGraceMs: 1, read: () => { if (++reads === 1) throw Error('HTTP 500'); return { state: 'pending' }; }, cancel: id => flaky.push(id) }), /did not take effect/);
  assert.equal(reads, 2); assert.deepEqual(flaky, ['127']);
  let tries = 0;
  await assert.rejects(wait({ root, commit, runId: '128', retryPauseMs: 1, read: () => { tries++; throw Error('HTTP 500'); }, cancel: () => assert.fail('no status, no cancel') }), /HTTP 500/);
  assert.equal(tries, 3);
  await assert.rejects(wait({ root, commit, read: () => ({ state: 'failure', description: 'incomplete' }) }), /not passed/);
  await assert.rejects(wait({ root, commit, runId: '126', read: () => ({ state: 'success', description: 'PASS 1/1 manifest=another' }), cancel: () => assert.fail('a success for another manifest is not pending') }), /does not match/);
});

// A waiting run ends as cancelled since local-coverage releases its runner (2026-11-04).
test('resumeWaitingWorkflow wakes a waiting or cancelled run and leaves a real failure red', () => {
  const { resumeWaitingWorkflow, cancelRun } = require('../tools/conditional-qa/github.cjs');
  const commit = 'a'.repeat(40), hosted = conclusion => ({ name: 'hosted (ubuntu-24.04, linux)', conclusion }), local = conclusion => ({ name: 'local-coverage', conclusion });
  const rerun = ['repos/unmet23-lab/synk-appsscript/actions/runs/7/rerun-failed-jobs'];
  const resume = (conclusion, jobs, { status = 'completed', localPassed, attempt, createdAt, now } = {}) => {
    const posts = [];
    const settled = resumeWaitingWorkflow(commit, { localPassed, now, api: (endpoint, body) => { if (body) { posts.push(endpoint); return null; } return { jobs }; }, list: () => [{ databaseId: 7, status, conclusion, attempt, createdAt }] });
    return { settled, posts };
  };
  for (const conclusion of ['cancelled', 'failure', 'timed_out']) {
    const { settled, posts } = resume(conclusion === 'timed_out' ? 'failure' : conclusion, [hosted('success'), local(conclusion)]);
    assert.deepEqual(posts, rerun, conclusion);
    assert.equal(settled, false, conclusion);
  }
  // Hosted jobs cancelled by hand never verified this commit, so they run again with it.
  assert.deepEqual(resume('cancelled', [hosted('cancelled'), local('cancelled')]).posts, rerun);
  assert.deepEqual(resume('failure', [hosted('cancelled'), local('failure')]).posts, rerun);
  // A real hosted failure stays red, whatever the run's conclusion says.
  assert.deepEqual(resume('failure', [hosted('failure'), local('skipped')]).posts, []);
  assert.deepEqual(resume('failure', [hosted('timed_out'), local('failure')]).posts, []);
  assert.deepEqual(resume('cancelled', [hosted('failure'), local('cancelled')]).posts, []);
  // A failed local result wakes a run that still waits, and the red run it leaves is settled instead of being woken every tick.
  assert.deepEqual(resume('cancelled', [hosted('success'), local('cancelled')], { localPassed: false }).posts, rerun);
  const red = resume('failure', [hosted('success'), local('failure')], { localPassed: false });
  assert.deepEqual(red.posts, []); assert.equal(red.settled, true);
  // A re-run that keeps ending the same way stops.
  assert.deepEqual(resume('cancelled', [hosted('success'), local('cancelled')], { attempt: 5 }).posts, rerun);
  const spent = resume('cancelled', [hosted('success'), local('cancelled')], { attempt: 6 });
  assert.deepEqual(spent.posts, []); assert.equal(spent.settled, true);
  // GitHub refuses a re-run a month after the run started, so that run settles instead of being tried forever.
  const now = Date.parse('2026-12-31T00:00:00Z'), day = 24 * 60 * 60_000;
  assert.deepEqual(resume('cancelled', [hosted('success'), local('cancelled')], { now, createdAt: new Date(now - 29 * day).toISOString() }).posts, rerun);
  const expired = resume('cancelled', [hosted('success'), local('cancelled')], { now, createdAt: new Date(now - 31 * day).toISOString() });
  assert.deepEqual(expired.posts, []); assert.equal(expired.settled, true);
  assert.deepEqual(resume('success', [hosted('success'), local('success')]).posts, []);
  assert.equal(resume('success', [hosted('success'), local('success')]).settled, true);
  assert.equal(resume(null, [hosted('success'), local(null)], { status: 'in_progress' }).settled, false);
  assert.equal(resumeWaitingWorkflow(commit, { list: () => [], api: () => assert.fail('no runs, no request') }), true, 'a commit without a run has nothing to wake');
  const cancelled = [];
  cancelRun('99', (endpoint, body) => { cancelled.push([endpoint, body]); return null; });
  assert.deepEqual(cancelled, [['repos/unmet23-lab/synk-appsscript/actions/runs/99/cancel', {}]]);
});
const localStatus = require('../tools/conditional-qa/local-status.cjs');
const statusRow = (id, state, description, createdAt = '2026-11-04T00:00:00Z', committedAt = '2026-11-03T23:00:00Z') => ({ commit: id.repeat(40), committedAt, manifest: { count: 79, digest: manifest.digest }, status: state ? { state, description, createdAt } : null });
const statusPass = github.description(79, manifest.digest), statusNow = Date.parse('2026-11-04T00:30:00Z');
test('a commit passes only with the exact PASS of its own manifest; pending, absent and offline never pass', () => {
  const result = localStatus.judge([statusRow('a', 'success', statusPass), statusRow('b', 'pending', 'Running the registered local conditional tests'), statusRow('c', 'pending', 'WAIT 79 local tests manifest=x'), statusRow('d', null)], { now: statusNow });
  assert.deepEqual([result.ok, result.passed, result.waiting, result.oldest], [true, 1, 3, 'd'.repeat(40)]);
  const wrong = localStatus.judge([statusRow('a', 'success', github.description(78, manifest.digest))], { now: statusNow });
  assert.equal(wrong.ok, false); assert.equal(wrong.passed, 0); assert.equal(wrong.invalid, 1);
  assert.match(localStatus.report(result), /stay pending/); assert.doesNotMatch(localStatus.report(result), /not ok/);
});
test('a stopped worker and an overdue backlog turn red; a queue that is still moving does not', () => {
  const waiting = statusRow('b', null), last = statusRow('a', 'success', statusPass);
  const after = ms => Date.parse(last.status.createdAt) + ms;
  assert.equal(localStatus.judge([waiting, last], { now: after(localStatus.STALL_MS - 1) }).ok, true);
  assert.match(localStatus.judge([waiting, last], { now: after(localStatus.STALL_MS + 1) }).problems.join(), /no new result/);
  // local-coverage's own WAIT mark is not worker activity: a PC that never answered cannot look alive.
  assert.match(localStatus.judge([statusRow('b', 'pending', 'WAIT 79 local tests manifest=x', '2026-11-04T00:29:00Z')], { now: statusNow }).problems.join(), /no new result/);
  assert.equal(localStatus.judge([last], { now: after(localStatus.STALL_MS * 10) }).ok, true, 'nothing waiting is not a stall');
  const old = statusRow('b', null, undefined, undefined, new Date(statusNow - localStatus.OVERDUE_MS - 1).toISOString());
  assert.match(localStatus.judge([statusRow('a', 'success', statusPass, '2026-11-04T00:29:00Z'), old], { now: statusNow }).problems.join(), /older than the limit/);
  assert.match(localStatus.judge([last], { now: statusNow, reachedFirst: false }).problems.join(), /window ended/);
});
test('each new failure is named for the alert, and an old one stays listed without burying the next', () => {
  const failed = statusRow('a', 'failure', 'Local verification incomplete');
  const fresh = localStatus.judge([failed], { now: statusNow });
  assert.equal(fresh.ok, false);
  const { 실패읽기 } = require('../tools/ci빨간불.js');
  const log = localStatus.report(fresh).split('\n').map(line => `status\tread\t2026-11-04T00:00:00.0000000Z ${line}`).join('\n');
  assert.deepEqual(실패읽기(log).시험.map(row => row.이름), [`local verification failed at ${failed.commit}`]);
  const older = localStatus.judge([failed], { now: Date.parse(failed.status.createdAt) + localStatus.FAILURE_RED_MS + 1 });
  assert.equal(older.ok, true); assert.deepEqual(older.failed, [failed.commit]); assert.match(localStatus.report(older), /kept until a retry passes/);
});
test('the status read walks first parents down to the activation commit and binds each manifest', () => {
  const [head, side, parent, first, below] = ['1', '2', '3', '4', '5'].map(x => x.repeat(40));
  const node = (oid, parents) => ({ oid, committedDate: '2026-11-04T00:00:00Z', parents: { nodes: parents.map(row => ({ oid: row })) }, file: { oid: 'blob' }, status: null });
  const pages = [{ pageInfo: { hasNextPage: true, endCursor: 'next' }, nodes: [node(head, [parent, side]), node(side, [first])] }, { pageInfo: { hasNextPage: true, endCursor: 'more' }, nodes: [node(parent, [first]), node(first, [below]), node(below, [])] }];
  const asked = [], query = (text, variables) => { asked.push(variables.after); return { data: { repository: { object: { history: pages.shift() } } } }; };
  const { line, reachedFirst } = localStatus.fetchHistory({ query, first });
  assert.deepEqual(line.map(row => row.oid), [head, parent, first]); assert.equal(reachedFirst, true); assert.deepEqual(asked, [undefined, 'next'], 'stops at the activation commit');
  const bytes = fs.readFileSync(path.join(root, 'tools/conditional-qa/cases.json')), cache = new Map(); let reads = 0;
  const api = () => { reads++; return { content: bytes.toString('base64') }; };
  for (let n = 0; n < 2; n++) assert.deepEqual(localStatus.manifestAt('blob', { api, cache }), { count: selected.length, digest: manifest.digest });
  assert.equal(reads, 1);
});
// 11-06 00:28 the line since activation passed the old 1000-commit window and every run turned red with nothing broken.
test('the status read ends at a settled run past the alert horizon, and an old commit that still waits or failed afresh keeps it going', () => {
  const now = Date.parse('2026-11-08T00:00:00Z'), hour = 3600_000, ok = (at) => ({ contexts: [{ context: 'conditional-qa/local', state: 'SUCCESS', description: 'PASS', createdAt: at }] });
  // 300 commits an hour apart, newest first; each page holds 50. The activation commit is never reached.
  const build = (status) => Array.from({ length: 300 }, (_, n) => ({ oid: String(n).padStart(40, 'a'), committedDate: new Date(now - n * hour).toISOString(),
    parents: { nodes: [{ oid: String(n + 1).padStart(40, 'a') }] }, file: { oid: 'blob' }, status: status(n) }));
  const reader = nodes => { let pages = 0; return { query: (text, { after }) => { const from = after ? Number(after) : 0; pages++;
    return { data: { repository: { object: { history: { pageInfo: { hasNextPage: from + 50 < nodes.length, endCursor: String(from + 50) }, nodes: nodes.slice(from, from + 50) } } } } }; }, pages: () => pages }; };
  const settled = reader(build(n => ok(new Date(now - n * hour).toISOString())));
  const read = localStatus.fetchHistory({ query: settled.query, first: 'f'.repeat(40), now });
  // 96 h horizon: after the third page the oldest 50 read (100..149 h old) are all past it and settled.
  assert.deepEqual([read.complete, read.reachedFirst, read.line.length, settled.pages()], [true, false, 150, 3]);
  const waiting = reader(build(n => (n === 120 ? null : ok(new Date(now - n * hour).toISOString()))));
  const kept = localStatus.fetchHistory({ query: waiting.query, first: 'f'.repeat(40), now });
  assert.deepEqual([kept.complete, kept.line.length], [true, 200], 'the waiting commit 120 stays in the rows and the run starts after it');
  assert.match(localStatus.judge(kept.line.map(node => localStatus.toRow(node, { count: 79, digest: 'x' })), { now, reachedFirst: kept.complete }).problems.join(), /older than the limit/);
  const fresh = reader(build(n => ok(new Date(now - n * hour).toISOString())).map((node, n) => n === 130 ? { ...node, status: { contexts: [{ context: 'conditional-qa/local', state: 'FAILURE', description: 'FAIL 78/79: S070', createdAt: new Date(now - hour).toISOString() }] } } : node));
  assert.equal(localStatus.fetchHistory({ query: fresh.query, first: 'f'.repeat(40), now }).line.length, 200, 'a retry that failed an hour ago is read and alerts');
  const capped = localStatus.fetchHistory({ query: reader(build(() => null)).query, first: 'f'.repeat(40), now, limit: 1000 });
  assert.deepEqual([capped.complete, capped.line.length], [false, 300], 'nothing settled: the read runs out without completing');
});
test('a passing GitHub read error is retried, and a lasting one is an error rather than a green check', () => {
  const node = { oid: localStatus.FIRST_COMMIT, committedDate: '2026-11-04T00:00:00Z', parents: { nodes: [] }, file: null, status: null };
  const page = { data: { repository: { object: { history: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [node] } } } } };
  let calls = 0; const waits = [];
  const once = () => { if (++calls === 1) throw Error('HTTP 502'); return page; };
  assert.equal(localStatus.fetchHistory({ query: once, pause: ms => waits.push(ms) }).reachedFirst, true); assert.equal(waits.length, 1);
  assert.throws(() => localStatus.fetchHistory({ query: () => { throw Error('HTTP 502'); }, pause: () => {} }), /502/);
});
test('no conditional job polls the PC; the status check is read-only', () => {
  const yml = name => fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8').replace(/\r\n/g, '\n');
  const push = yml('conditional-qa.yml'), status = yml('conditional-qa-local.yml');
  assert.match(push, /local-coverage:\n\s+needs: hosted/); assert.doesNotMatch(push, /timeout-minutes: 160/);
  assert.doesNotMatch(push, /cancel-in-progress: true|paths(-ignore)?:/, 'no commit is cancelled or filtered out of hosted verification');
  assert.match(status, /workflow_run:\n\s+workflows: \[conditional-qa\]\n\s+types: \[completed\]\n\s+branches: \[master\]/, 'a delayed schedule cannot be the only trigger');
  assert.match(status, /schedule:/); assert.doesNotMatch(status, /^on:\n\s+push:/m, 'a push trigger would make 원격ci wait on it'); assert.match(status, /timeout-minutes: 10/); assert.doesNotMatch(status, /: write/);
  const { 판정하기 } = require('../tools/ci빨간불.js');
  const seen = 판정하기([{ workflowName: 'conditional-qa-local', event: 'workflow_run', status: 'completed', conclusion: 'failure', createdAt: '2026-11-04T00:00:00Z', headSha: 'a', databaseId: 1 }]);
  assert.equal(seen[0].상태, '빨강', 'the alert reads this trigger');
});

test('a finished commit stays flagged until its runs settle, and one cancelled after that is found again', () => {
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(letter => letter.repeat(40));
  const queue = { items: [{ commit: a, status: 'passed', resumePending: true, resumeError: 'old' }, { commit: b, status: 'failed', resumePending: true }, { commit: c, status: 'passed', resumePending: true }, { commit: d, status: 'passed' }] };
  const asked = [];
  resumeFinished(queue, (commit, { localPassed }) => { asked.push([commit, localPassed]); if (commit === c) throw Error('network'); return commit === a; });
  assert.deepEqual(asked, [[a, true], [b, false], [c, true]]);
  assert.equal(queue.items[0].resumePending, false); assert.equal(queue.items[0].resumeError, undefined);
  assert.equal(queue.items[1].resumePending, true, 'a run still in progress is looked at again');
  assert.equal(queue.items[2].resumePending, true); assert.equal(queue.items[2].resumeError, 'network');
  const many = { items: Array.from({ length: 12 }, () => ({ commit: a, status: 'passed', resumePending: true })) };
  let calls = 0; resumeFinished(many, () => { calls++; return true; }); assert.equal(calls, 10);
  // Ten commits that cannot settle never keep the next one from being looked at.
  const stuck = { items: Array.from({ length: 12 }, (_, i) => ({ commit: String(i), status: 'passed', resumePending: true })) };
  const tried = []; resumeFinished(stuck, commit => { tried.push(commit); throw Error('refused'); }, 1);
  assert.deepEqual(tried, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  tried.length = 0; resumeFinished(stuck, commit => { tried.push(commit); return commit === '11'; }, 2);
  assert.deepEqual(tried.slice(0, 2), ['10', '11']); assert.equal(stuck.items[11].resumePending, false);

  const sweep = { items: [{ commit: a, status: 'passed' }, { commit: b, status: 'failed' }, { commit: c, status: 'queued' }, { commit: d, status: 'passed' }] };
  markCancelledRuns(sweep, new Map([[a, '1:1'], [b, '2:1'], [c, '3:1']]));
  assert.deepEqual(sweep.items.map(row => row.resumePending), [true, true, undefined, undefined], 'no local result yet means the run keeps waiting');
  sweep.items[0].resumePending = false;
  markCancelledRuns(sweep, new Map([[a, '1:1']])); assert.equal(sweep.items[0].resumePending, false, 'a run that was left alone is not looked at every tick');
  markCancelledRuns(sweep, new Map([[a, '1:2']])); assert.equal(sweep.items[0].resumePending, true, 'a new attempt cancelled again is');
  const unpublished = { items: [{ commit: a, status: 'failed', publicationError: true }, { commit: b, status: 'passed', publicationError: true }] };
  markCancelledRuns(unpublished, new Map([[a, '1:1'], [b, '2:1']]));
  assert.equal(unpublished.items[0].resumePending, undefined, 'an unpublished failure still reads as running'); assert.equal(unpublished.items[1].resumePending, true);
  // It is published again, then woken; one that still cannot be published stays flagged, and nothing else is written.
  const owed = { items: [{ commit: a, status: 'failed', publicationError: true }, { commit: b, status: 'failed', publicationError: true }, { commit: c, status: 'retry', publicationError: true }, { commit: d, status: 'failed' }] };
  const sent = []; republishFailures(owed, (commit, state, text) => { if (commit === b) throw Error('HTTP 500'); sent.push([commit, state, text]); });
  assert.equal(sent.length, 1); assert.equal(sent[0][0], a); assert.equal(sent[0][1], 'failure'); assert.match(sent[0][2], /incomplete/);
  assert.equal(owed.items[0].publicationError, undefined); assert.equal(owed.items[0].resumePending, true);
  assert.equal(owed.items[1].publicationError, true); assert.equal(owed.items[1].resumePending, undefined);
  markCancelledRuns(owed, new Map([[a, '1:1'], [b, '2:1']]));
  assert.equal(owed.items[0].resumePending, true); assert.equal(owed.items[1].resumePending, undefined);

  const pages = [Array.from({ length: 100 }, (_, i) => ({ id: i, run_attempt: 1, head_sha: i ? `sha${i}` : a })), [{ id: 500, run_attempt: 3, head_sha: a }, { id: 501, run_attempt: 1, head_sha: b }]], asks = [];
  const found = github.cancelledRuns(endpoint => { asks.push(endpoint); return { workflow_runs: pages[asks.length - 1] }; });
  assert.equal(found.get(a), '0:1', 'the newest run of a commit counts'); assert.equal(found.get(b), '501:1'); assert.equal(asks.length, 2);
  assert.match(asks[0], /conditional-qa\.yml\/runs\?branch=master&status=cancelled&per_page=100&page=1$/);
  assert.equal(github.cancelledRuns(() => ({ workflow_runs: pages[0] }), 1).size, 100);
});

const turn = () => new Promise(resolve => setImmediate(resolve));
async function until(check) { for (let n = 0; n < 2000; n++) { if (check()) return; await turn(); } assert.fail('never happened'); }
test('every checkout verifies a different commit at once, and no checkout or commit is used twice at a time', async () => {
  const queue = ['a', 'b', 'c', 'd', 'e'], busy = new Set(), seen = []; let widest = 0, finished = 0;
  await runPool({ slots: ['main', 'two'], pick: () => queue.shift(), finished: () => finished++, run: async (item, slot) => {
    assert.equal(busy.has(slot), false, 'one verification per checkout'); busy.add(slot); widest = Math.max(widest, busy.size); seen.push(item);
    await turn(); busy.delete(slot);
  } });
  assert.equal(widest, 2); assert.deepEqual([...seen].sort(), ['a', 'b', 'c', 'd', 'e']); assert.ok(finished >= 1);
  let alone = 0; const single = ['a', 'b', 'c'];
  await runPool({ slots: ['main'], pick: () => single.shift(), run: async () => { alone++; assert.equal(alone, 1); await turn(); alone--; } });
  assert.equal(single.length, 0);
});
test('a busy PC holds the first verification until it has stayed calm', async () => {
  const queue = ['a'], started = []; let open = false, asked = 0;
  const pool = runPool({ slots: ['main'], pick: () => queue.shift(), recheckMs: 1, mayOpenFirst: () => { asked++; return open; }, run: async item => { started.push(item); } });
  await until(() => asked >= 3);
  assert.deepEqual(started, [], 'waiting is not the end of the tick'); assert.deepEqual(queue, ['a']);
  open = true; await pool; assert.deepEqual(started, ['a']);
  let at = 0;
  const gate = calmGate(reading => reading !== null && reading < 85, { now: () => at, calmMs: 100 });
  const read = reading => { gate.observe(reading); return gate.calm(); };
  assert.equal(read(null), false, 'no reading yet is no room');
  assert.equal(read(80), false, 'one reading under the limit is not calm'); at = 99; assert.equal(read(80), false);
  at = 100; assert.equal(read(80), true, 'calm for the whole stretch');
  at = 101; assert.equal(read(85), false, 'a reading at the limit starts it over');
  at = 110; assert.equal(read(10), false); at = 209; assert.equal(read(10), false); at = 210; assert.equal(read(10), true);
  at = 10_000; assert.equal(read(100), false, 'no matter how long it has been waiting, a saturated PC stays held');
  at = 10_100; assert.equal(read(10), false); at = 10_200; assert.equal(read(10), true);
  gate.reset(); assert.equal(gate.calm(), false, 'a verification just opened: the stretch starts over');
  at = 10_250; assert.equal(read(10), false); at = 10_350; assert.equal(read(10), true);
});
test('a held pool with a failure ends, and an error while choosing never leaves a running verification behind', async () => {
  const none = []; await assert.rejects(runPool({ slots: ['main'], pick: () => assert.fail('held'), run: async () => {}, recheckMs: 1, mayOpenFirst: () => { throw Error('load unreadable'); } }), /load unreadable/); assert.deepEqual(none, []);
  let finishSlow, ended = false, settled = false, picks = 0;
  const slow = new Promise(resolve => { finishSlow = resolve; });
  const pool = runPool({ slots: ['main', 'two'], recheckMs: 1, pick: () => { if (++picks === 2) throw Error('disk unreadable'); return 'slow'; }, run: async () => { await slow; ended = true; } }).catch(error => { settled = error.message; });
  for (let n = 0; n < 50; n++) await turn();
  assert.equal(settled, false); finishSlow(); await pool;
  assert.equal(settled, 'disk unreadable'); assert.equal(ended, true);
});
test('another verification waits until the PC has room', async () => {
  const queue = ['a', 'b'], started = []; let room = false, asked = 0, finishFirst;
  const first = new Promise(resolve => { finishFirst = resolve; });
  const pool = runPool({ slots: ['main', 'two'], pick: () => queue.shift(), recheckMs: 1, mayOpenAnother: () => { asked++; return room; },
    run: async (item, slot) => { started.push([item, slot]); if (item === 'a') await first; } });
  await until(() => asked >= 3);
  assert.deepEqual(started, [['a', 'main']], 'held, and the commit stays in the queue');
  assert.deepEqual(queue, ['b']);
  room = true; await until(() => started.length === 2);
  assert.deepEqual(started[1], ['b', 'two']);
  finishFirst(); await pool;
});
test('a failure opens nothing new, and the pool outlives the verification still running', async () => {
  const queue = ['bad', 'slow', 'never'], started = []; let finishSlow, slowEnded = false, settled = false;
  const slow = new Promise(resolve => { finishSlow = resolve; });
  const pool = runPool({ slots: ['main', 'two'], pick: () => queue.shift(), recheckMs: 1, run: async item => {
    started.push(item);
    if (item === 'bad') { await turn(); throw Error('worker failure'); }
    await slow; slowEnded = true;
  } }).catch(error => { settled = error.message; });
  for (let n = 0; n < 50; n++) await turn();
  assert.equal(settled, false, 'the lock must outlive the running verification');
  finishSlow(); await pool;
  assert.equal(settled, 'worker failure'); assert.equal(slowEnded, true); assert.deepEqual(started, ['bad', 'slow']); assert.deepEqual(queue, ['never']);
  const late = ['a', 'b'], ran = [];
  await assert.rejects(runPool({ slots: ['main'], pick: () => late.shift(), recheckMs: 1, finished: () => { throw Error('fetch failed'); }, run: async item => { ran.push(item); await turn(); } }), /fetch failed/);
  assert.deepEqual(ran, ['a'], 'a failed refresh opens nothing on a stale queue');
});
test('a checkout that fails outside the tests stops for this tick and the others carry on', async () => {
  const queue = ['a', 'b', 'c'], used = [];
  await runPool({ slots: ['main', 'two'], pick: () => queue.shift(), recheckMs: 1, run: async (item, slot) => { used.push([item, slot]); await turn(); return { retireSlot: slot === 'main' }; } });
  assert.equal(used.filter(row => row[1] === 'main').length, 1); assert.equal(queue.length, 0);
  const left = ['a', 'b', 'c'], tried = [];
  await runPool({ slots: ['main', 'two'], pick: () => left.shift(), recheckMs: 1, run: async item => { tried.push(item); await turn(); return { retireSlot: true }; } });
  assert.deepEqual(tried, ['a', 'b']); assert.deepEqual(left, ['c'], 'the rest stay queued instead of failing one after another');
});
test('the load reading covers a real window and stays unknown until then', () => {
  let at = 0, idle = 1000, busy = 0;
  const meter = cpuMeter({ now: () => at, windowMs: 20, cpus: () => [{ times: { user: busy, nice: 0, sys: 0, irq: 0, idle } }] });
  assert.equal(meter(), null);
  at = 10; busy = 500; assert.equal(meter(), null, 'too short a window is no reading');
  at = 20; idle = 1100; busy = 400; assert.equal(meter(), 80);
  at = 25; idle = 2000; assert.equal(meter(), 80, 'the last reading stands until the next window ends');
  at = 40; assert.equal(meter(), 0);
  const plenty = 32 * 1024 ** 3;
  for (const room of [roomForFirst, roomForAnother]) assert.equal(room(null, plenty), false, 'no reading is no room');
  assert.equal(roomForFirst(84, plenty), true); assert.equal(roomForFirst(85, plenty), false);
  assert.equal(roomForFirst(10, 3 * 1024 ** 3), true); assert.equal(roomForFirst(10, 3 * 1024 ** 3 - 1), false);
  assert.equal(roomForAnother(69, plenty), true); assert.equal(roomForAnother(70, plenty), false);
  assert.equal(roomForAnother(10, 6 * 1024 ** 3), true); assert.equal(roomForAnother(10, 6 * 1024 ** 3 - 1), false);
});
test('a passed run keeps its receipt, TAP and events and drops the rest without following links', t => {
  const dir = scratch(t), output = path.join(dir, 'run'), outside = path.join(dir, 'outside');
  const put = (file, text = 'x') => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  for (const file of ['result.json', 'started.json', 'runner.log', 'profile-watchdog.json']) put(path.join(output, file));
  for (const profile of ['default', 'client']) for (const file of ['tests.tap', 'events.jsonl', 'process.log']) put(path.join(output, profile, file));
  put(path.join(output, 'client/database/base/1'), 'row'); put(path.join(output, 'client/server.log')); put(path.join(output, 'default/synk_speaking_qa_out/result.json')); put(path.join(output, 'default/temp/cv_debug.log'));
  put(path.join(outside, 'theirs.txt'), 'theirs');
  fs.symlinkSync(outside, path.join(output, 'default/linked'), 'junction');
  trimPassedRun(output);
  for (const file of ['result.json', 'started.json', 'runner.log', 'profile-watchdog.json', 'default/tests.tap', 'default/events.jsonl', 'default/process.log', 'client/tests.tap', 'client/events.jsonl', 'client/process.log']) assert.ok(fs.existsSync(path.join(output, file)), file);
  for (const file of ['client/database', 'client/server.log', 'default/synk_speaking_qa_out', 'default/temp', 'default/linked']) assert.equal(fs.existsSync(path.join(output, file)), false, file);
  assert.equal(fs.readFileSync(path.join(outside, 'theirs.txt'), 'utf8'), 'theirs');
});
test('only a provisioned slot is used, it follows the registered inputs, and it is never released as a candidate', t => {
  const dir = scratch(t), state = path.join(dir, 'state'), repo = github.REPO;
  const owned = at => { write(path.join(at, 'owner.json'), { version: 1, purpose: 'synk-conditional-qa', state: at }); write(path.join(at, 'config.json'), { version: 1, repo, state: at, root: path.join(at, 'workspace/SYNK-appsscript') }); };
  owned(state); write(path.join(state, 'inputs.json'), { version: 1, files: ['current'] });
  assert.deepEqual(slotConfigs(state), [], 'no slots folder is the single checkout');
  const [two, three, four] = [2, 3, 4].map(n => slotState(state, n));
  owned(two); write(path.join(two, 'slot.json'), { version: 1, number: 2 }); write(path.join(two, 'inputs.json'), { version: 1, files: ['stale'] });
  owned(three);
  write(path.join(four, 'slot.json'), { version: 1, number: 4 }); write(path.join(four, 'owner.json'), { version: 1, purpose: 'synk-conditional-qa', state });
  const logged = t.mock.method(console, 'error', () => {});
  assert.deepEqual(slotConfigs(state).map(row => row.state), [two], 'unfinished and foreign slots stay out');
  assert.equal(logged.mock.callCount(), 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(two, 'inputs.json'))).files, ['current']);
  write(path.join(two, 'context.json'), { version: 1, root: path.join(two, 'workspace/SYNK-appsscript'), candidate: false, pinned: [] });
  assert.throws(() => release(two), /Only a candidate/);
  assert.ok(fs.existsSync(path.join(two, 'slot.json')));
});

// The whole tick on two checkouts, with git, GitHub and the test run replaced and the receipts, queue file and lock real.
// A tick's disk room is injected: GitHub runners sit near the 15 GiB limit, so reading the real disk failed nine tests whenever one dipped below it (2026-11-05).
const roomyDisk = () => ({ bsize: 4096n, bavail: 1n << 30n });
function tickFixture(t, commits, { slot = true } = {}) {
  const dir = scratch(t), state = path.join(dir, 'state'), repo = github.REPO, head = commits.at(-1);
  const owned = at => { write(path.join(at, 'owner.json'), { version: 1, purpose: 'synk-conditional-qa', state: at }); write(path.join(at, 'config.json'), { version: 1, repo, state: at, root: path.join(at, 'workspace/SYNK-appsscript') }); };
  owned(state); write(path.join(state, 'inputs.json'), { version: 1, files: [] });
  if (slot) { const two = slotState(state, 2); owned(two); write(path.join(two, 'slot.json'), { version: 1, number: 2 }); }
  write(path.join(state, 'queue.json'), { version: 1, seen: head, nextTurn: 'recent', items: commits.map(commit => ({ commit, status: 'queued' })) });
  const published = [], bytes = fs.readFileSync(path.join(root, 'tools/conditional-qa/cases.json'), 'utf8');
  const hub = { ...github, publish: (commit, stateName, text) => { published.push([commit, stateName, text]); }, resumeWaitingWorkflow: () => true, cancelledRuns: () => new Map() };
  const runGit = (cwd, args) => { if (args[0] === 'rev-parse') return head; if (args[0] === 'rev-list') return ''; if (args[0] === 'show') return bytes; return ''; };
  const receiptFor = commit => ({ version: 1, commit, manifestDigest: manifest.digest, expected: selected.length, passed: selected.length, ok: true, candidate: false, sourceUnchanged: true, inputsUnchanged: true, rows: selected.map(row => ({ ...row, status: 'pass' })) });
  const queue = () => JSON.parse(fs.readFileSync(path.join(state, 'queue.json'))).items;
  return { state, published, queue, receiptFor, deps: { hub, runGit, cloneRoot: config => config.root, first: reading => reading !== null && reading < 85, room: () => true, meter: () => 10, recheckMs: 1, warmUpMs: 0, calmMs: 0, slept: () => false, statfs: roomyDisk } };
}
const tickCommits = n => Array.from({ length: n }, (_, i) => String(i + 1).repeat(40).slice(0, 40));
test('a tick below the disk limit keeps its place and opens nothing', async t => {
  const commits = tickCommits(2), f = tickFixture(t, commits);
  const summary = await tick(f.state, { ...f.deps, statfs: () => ({ bsize: 4096n, bavail: 1024n }), verifyCommit: () => assert.fail('no room on the disk') });
  assert.equal(summary.diskWait.requiredBytes, 15 * 1024 ** 3);
  assert.deepEqual(f.queue().map(row => row.status), ['queued', 'queued']);
});
test('a tick verifies on both checkouts at once, keeps each receipt to its commit and trims only what passed', async t => {
  const commits = tickCommits(5), f = tickFixture(t, commits), busy = new Set(), seen = []; let widest = 0, bothOpened;
  const both = new Promise(resolve => { bothOpened = resolve; });
  const summary = await tick(f.state, { ...f.deps, verifyCommit: async (config, commit, output) => {
    assert.equal(busy.has(config.state), false, 'one verification per checkout'); busy.add(config.state); widest = Math.max(widest, busy.size); seen.push(commit);
    if (busy.size === 2) bothOpened();
    write(path.join(output, 'result.json'), f.receiptFor(commit)); write(path.join(output, 'default/tests.tap'), {}); write(path.join(output, 'default/temp/scratch.json'), {});
    await both; await turn(); busy.delete(config.state);
    return { count: selected.length, digest: manifest.digest };
  } });
  assert.equal(widest, 2); assert.equal(summary.slots, 2);
  assert.deepEqual([...seen].sort(), [...commits].sort(), 'every commit once');
  assert.equal(seen[0], commits[4], 'the newest turn first'); assert.equal(seen[1], commits[0], 'then the oldest');
  const items = f.queue();
  assert.ok(items.every(row => row.status === 'passed' && row.count === selected.length && row.digest === manifest.digest));
  assert.deepEqual([...new Set(items.map(row => row.slot))].sort(), [1, 2]);
  for (const commit of commits) {
    assert.deepEqual(f.published.filter(row => row[0] === commit).map(row => row[1]), ['pending', 'success']);
    const output = items.find(row => row.commit === commit).output;
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'result.json'))).commit, commit);
    assert.ok(fs.existsSync(path.join(output, 'default/tests.tap'))); assert.equal(fs.existsSync(path.join(output, 'default/temp')), false);
  }
  assert.equal(fs.existsSync(path.join(f.state, 'worker.lock')), false);
});
test('a failed test stays failed with its evidence, an incomplete receipt never publishes success, and the other commits still run', async t => {
  const commits = tickCommits(4), [red, wrong] = commits, f = tickFixture(t, commits), woken = [];
  await tick(f.state, { ...f.deps, hub: { ...f.deps.hub, resumeWaitingWorkflow: (commit, { localPassed }) => { woken.push([commit, localPassed]); return true; } }, verifyCommit: async (config, commit, output) => {
    await turn();
    write(path.join(output, 'default/temp/evidence.json'), {});
    if (commit === red) { write(path.join(output, 'result.json'), { ...f.receiptFor(commit), ok: false, passed: selected.length - 1 }); throw Object.assign(Error('Local tests incomplete'), { code: 'TEST_FAILURE' }); }
    write(path.join(output, 'result.json'), commit === wrong ? f.receiptFor(commits[3]) : f.receiptFor(commit));
    return { count: selected.length, digest: manifest.digest };
  } });
  const items = f.queue(), byCommit = commit => items.find(row => row.commit === commit);
  assert.equal(byCommit(red).status, 'failed'); assert.deepEqual(woken.filter(row => row[0] === red), [[red, false]], 'its waiting run is woken to turn red');
  assert.ok(fs.existsSync(path.join(byCommit(red).output, 'default/temp/evidence.json')), 'failure evidence stays');
  assert.deepEqual(f.published.filter(row => row[0] === red).map(row => row[1]), ['pending', 'failure']);
  assert.equal(byCommit(wrong).status, 'publish-pending', 'a receipt of another commit is no proof');
  assert.equal(f.published.some(row => row[0] === wrong && row[1] === 'success'), false);
  assert.ok(fs.existsSync(path.join(byCommit(wrong).output, 'default/temp/evidence.json')));
  assert.equal(byCommit(commits[2]).status, 'passed'); assert.equal(byCommit(commits[3]).status, 'passed');
});
test('a file held for a moment is written after a short wait, and any other error is not waited for', t => {
  const dir = scratch(t), file = path.join(dir, 'state.json'), rename = fs.renameSync; let tries = 0, code = 'EPERM', blocked = 2;
  const mocked = t.mock.method(fs, 'renameSync', (from, to) => {
    if (String(to) === file && (tries++, blocked-- > 0)) throw Object.assign(Error(`${code}: rename`), { code });
    return rename(from, to);
  });
  write(file, { saved: 1 });
  assert.equal(tries, 3); assert.equal(JSON.parse(fs.readFileSync(file)).saved, 1, 'the third try went through');
  tries = 0; blocked = 99;
  assert.throws(() => write(file, { saved: 2 }), /EPERM/, 'a file that stays held still fails');
  assert.equal(tries, 6); assert.equal(JSON.parse(fs.readFileSync(file)).saved, 1, 'the old contents stay whole');
  tries = 0; blocked = 1; code = 'EIO';
  assert.throws(() => write(file, { saved: 3 }), /EIO/); assert.equal(tries, 1, 'only a held file is waited for');
  mocked.mock.restore();
});
test('a queue that cannot be saved never turns a passing commit into a failure', async t => {
  // A tick saves queue.json at 1 refresh and 2 settle, then for this commit at 3 running, 4 publish-pending and 5 passed.
  const rename = fs.renameSync; t.mock.method(console, 'error', () => {});
  for (const held of [1, 2, 3, 4, 5]) {
    const commits = tickCommits(1), f = tickFixture(t, commits, { slot: false }); let saves = 0;
    const mocked = t.mock.method(fs, 'renameSync', (from, to) => {
      if (String(to).endsWith('queue.json') && ++saves === held) throw Object.assign(Error('EIO: i/o error, rename'), { code: 'EIO' });
      return rename(from, to);
    });
    const summary = await tick(f.state, { ...f.deps, verifyCommit: async (config, commit, output) => {
      write(path.join(output, 'result.json'), f.receiptFor(commit));
      return { count: selected.length, digest: manifest.digest };
    } });
    mocked.mock.restore();
    assert.deepEqual(f.published.map(row => row[1]), ['pending', 'success'], `save ${held}: the pass stays a pass`);
    assert.equal(f.queue()[0].status, 'passed', `save ${held}: a later save catches up`);
    assert.match(summary.queueNotSaved, /EIO/, `save ${held}: the summary says why`);
  }
});
test('a checkout that breaks outside the tests hands back its commit for a retry and leaves the rest to the other', async t => {
  const commits = tickCommits(4), f = tickFixture(t, commits), byCheckout = {}; let bothOpened;
  const both = new Promise(resolve => { bothOpened = resolve; });
  await tick(f.state, { ...f.deps, verifyCommit: async (config, commit, output) => {
    (byCheckout[path.basename(config.state)] ||= []).push(commit);
    if (Object.keys(byCheckout).length === 2) bothOpened();
    await both;
    if (config.state !== f.state) throw Error('Validation checkout has modified tracked files');
    write(path.join(output, 'result.json'), f.receiptFor(commit));
    return { count: selected.length, digest: manifest.digest };
  } });
  assert.equal(byCheckout['2'].length, 1, 'the broken checkout stops after one commit');
  const items = f.queue(), broken = items.find(row => row.commit === byCheckout['2'][0]);
  assert.equal(broken.status, 'retry'); assert.ok(broken.retryAt > Date.now());
  assert.equal(items.filter(row => row.status === 'passed').length, 3);
  assert.equal(fs.existsSync(path.join(f.state, 'worker.lock')), false);
});
test('no room means one verification at a time, and a requested commit stays on the scheduled checkout', async t => {
  const commits = tickCommits(3), f = tickFixture(t, commits); let busy = 0, widest = 0;
  const verifyCommit = async (config, commit, output) => {
    busy++; widest = Math.max(widest, busy); await turn(); await turn(); busy--;
    assert.equal(config.state, f.state);
    write(path.join(output, 'result.json'), f.receiptFor(commit));
    return { count: selected.length, digest: manifest.digest };
  };
  const summary = await tick(f.state, { ...f.deps, room: () => false, verifyCommit });
  assert.equal(widest, 1); assert.ok(f.queue().every(row => row.status === 'passed')); assert.ok(summary.roomHeld > 0);
  const g = tickFixture(t, commits), before = JSON.parse(fs.readFileSync(path.join(g.state, 'queue.json'))).nextTurn; const asked = [];
  const result = await tick(g.state, { ...g.deps, meter: () => 100, requestedCommit: commits[1], verifyCommit: async (config, commit, output) => {
    asked.push([path.basename(config.state), commit]); write(path.join(output, 'result.json'), g.receiptFor(commit));
    return { count: selected.length, digest: manifest.digest };
  } });
  assert.deepEqual(asked, [[path.basename(g.state), commits[1]]]); assert.equal(result.slots, 1); assert.equal(result.requested.status, 'passed');
  assert.equal(JSON.parse(fs.readFileSync(path.join(g.state, 'queue.json'))).nextTurn, before);
});
test('another verification waits until the reading can cover the one just opened', async t => {
  const commits = tickCommits(2), f = tickFixture(t, commits), asked = []; let busy = 0, widest = 0, finishFirst;
  const warmUpMs = 40, opened = [];
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const meter = () => { if (busy) now += 10; return 10; };
  const first = new Promise(resolve => { finishFirst = resolve; });
  const summary = await tick(f.state, { ...f.deps, warmUpMs, meter, room: reading => { asked.push(reading); return true; }, verifyCommit: async (config, commit, output) => {
    busy++; widest = Math.max(widest, busy);
    opened.push(Date.now());
    if (busy === 1) await first; else finishFirst();
    busy--;
    write(path.join(output, 'result.json'), f.receiptFor(commit));
    return { count: selected.length, digest: manifest.digest };
  } });
  assert.equal(opened.length, 2);
  assert.ok(opened[1] - opened[0] >= warmUpMs, 'second checkout must wait for a full warm-up');
  assert.equal(widest, 2, 'it does open once the reading covers the running one'); assert.ok(summary.roomHeld > 0); assert.equal(asked.length >= 1, true);
  assert.ok(f.queue().every(row => row.status === 'passed'));
});
test('a held tick opens nothing, ends so the next one can look again, and says once an hour that it is waiting', async t => {
  const commits = tickCommits(3), [oldest, middle, newest] = commits, f = tickFixture(t, commits);
  const queueFile = path.join(f.state, 'queue.json'), saved = JSON.parse(fs.readFileSync(queueFile));
  saved.items[2].status = 'passed'; write(queueFile, saved);
  const held = { ...f.deps, meter: () => 100, holdTickMs: 5, verifyCommit: () => assert.fail('nothing opens on a saturated PC') };
  const summary = await tick(f.state, held);
  assert.ok(summary.roomHeld > 0); assert.equal(summary.holdingAtCpu, 100);
  assert.deepEqual(f.queue().map(row => row.status), ['queued', 'queued', 'passed'], 'every commit keeps its place');
  assert.deepEqual(f.published, [[middle, 'pending', 'Waiting for room on the local PC; not verified yet']], 'the newest unverified commit, never one with a result');
  assert.equal(f.published.some(row => row[0] === newest || row[1] === 'success'), false);
  const noticedAt = JSON.parse(fs.readFileSync(queueFile)).heldNoticeAt;
  assert.ok(noticedAt > 0);
  await tick(f.state, held);
  assert.equal(f.published.length, 1, 'not again within the hour');
  const later = JSON.parse(fs.readFileSync(queueFile)); later.heldNoticeAt = Date.now() - 61 * 60_000; write(queueFile, later);
  await tick(f.state, held);
  assert.equal(f.published.length, 2, 'again after an hour, well before the 155 minute stall alarm');
  // An unavailable API does not end anything worse than a held tick, and the next one tries again.
  const later2 = JSON.parse(fs.readFileSync(queueFile)); later2.heldNoticeAt = 0; write(queueFile, later2);
  const logged = t.mock.method(console, 'error', () => {});
  await tick(f.state, { ...held, hub: { ...f.deps.hub, publish: () => { throw Error('HTTP 502'); } } });
  assert.equal(logged.mock.callCount(), 1); assert.equal(JSON.parse(fs.readFileSync(queueFile)).heldNoticeAt, 0);
  // The stopped-PC alarm reads this notice as the worker being alive.
  const activity = '2026-11-04T00:29:00Z', notice = statusRow('b', 'pending', 'Waiting for room on the local PC; not verified yet', activity);
  assert.equal(localStatus.judge([notice], { now: statusNow }).ok, true);
  assert.equal(localStatus.judge([notice], { now: Date.parse(activity) + localStatus.STALL_MS + 1 }).ok, false, 'a notice that stops coming still turns red');
});
test('an unattended registered verification waits for sustained room and keeps its place while held', async t => {
  const commits = tickCommits(3), target = commits[1], f = tickFixture(t, commits), attempts = [];
  const queueFile = path.join(f.state, 'queue.json');
  const original = JSON.parse(fs.readFileSync(queueFile)), step = 30_000;
  let now = Date.now(), cpu = 100, readings = [], samples = 0;
  t.mock.method(Date, 'now', () => now);
  const options = {
    ...f.deps, requestedCommit: target, waitForRoom: true, calmMs: 120_000, holdTickMs: 900_000,
    meter: () => { now += step; samples++; return readings.shift() ?? cpu; },
    verifyCommit: async (checkout, commit, output) => {
      attempts.push({ commit, atSample: samples });
      write(path.join(output, 'result.json'), f.receiptFor(commit));
      return { count: selected.length, digest: manifest.digest };
    },
  };
  const held = await tick(f.state, options);
  assert.deepEqual(held.requested, { commit: target, status: 'queued', attempted: false });
  assert.equal(held.holdingAtCpu, 100);
  assert.ok(held.roomHeld > 0);
  assert.deepEqual(attempts, []);
  assert.deepEqual(f.published, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(queueFile)), original);

  samples = 0; readings = [80, 80, 100]; cpu = 80;
  const done = await tick(f.state, options);
  assert.deepEqual(done.requested, { commit: target, status: 'passed', attempted: true });
  assert.equal(done.slots, 1);
  assert.deepEqual(attempts, [{ commit: target, atSample: 8 }], 'the hot sample restarted the two-minute wait');
  assert.equal(JSON.parse(fs.readFileSync(queueFile)).nextTurn, original.nextTurn);

  cpu = 100;
  const saved = await tick(f.state, options);
  assert.deepEqual(saved.requested, { commit: target, status: 'passed', attempted: false });
  assert.equal(saved.roomHeld, 0);
  assert.equal(attempts.length, 1);
});
test('the first verification needs a calm stretch, and another needs its own after it', async t => {
  const commits = tickCommits(2), f = tickFixture(t, commits), opened = [], readings = [90, 80, 80, 80, 80]; let now = Date.now(), finishFirst;
  t.mock.method(Date, 'now', () => now);
  const first = new Promise(resolve => { finishFirst = resolve; });
  await tick(f.state, { ...f.deps, calmMs: 30, room: reading => reading < 70, meter: () => { now += 10; return readings.shift() ?? 10; }, verifyCommit: async (config, commit, output) => {
    opened.push({ at: now, left: readings.length });
    if (opened.length === 1) await first; else finishFirst();
    write(path.join(output, 'result.json'), f.receiptFor(commit));
    return { count: selected.length, digest: manifest.digest };
  } });
  assert.equal(opened.length, 2);
  assert.equal(opened[0].left, 0, 'the 90 started the stretch over, and 80 had to last the whole of it');
  assert.ok(opened[1].at - opened[0].at >= 30, 'another does not borrow the calm measured before the first opened');
});
test('a PC that stayed calm through a verification opens the next at once, and one that filled up during it waits', async t => {
  const commits = tickCommits(3), f = tickFixture(t, commits, { slot: false }), opened = [];
  let now = Date.now(), reading = 10, looks = 0, finish = () => {}, calmEnd, fullEnd;
  t.mock.method(Date, 'now', () => now);
  // The pool looks at the meter on every turn, so this script runs the three verifications without any real waiting.
  const meter = () => {
    now += 10; looks++;
    const during = looks - (opened.at(-1)?.look ?? looks);
    if (opened.length === 1 && during === 6) { calmEnd = now; finish(); }
    if (opened.length === 2 && during === 6) reading = 100;
    if (opened.length === 2 && during === 8) { reading = 10; fullEnd = now; finish(); }
    if (opened.length === 3 && during === 1) finish();
    return reading;
  };
  await tick(f.state, { ...f.deps, calmMs: 30, meter, verifyCommit: async (config, commit, output) => {
    opened.push({ at: now, look: looks });
    await new Promise(resolve => { finish = resolve; });
    write(path.join(output, 'result.json'), f.receiptFor(commit));
    return { count: selected.length, digest: manifest.digest };
  } });
  assert.equal(opened.length, 3);
  assert.ok(opened[1].at - calmEnd <= 20, 'no second calm stretch after one that lasted through the run');
  assert.ok(opened[2].at - fullEnd >= 30, 'readings during the run count: it waits for a new stretch');
});
test('a saturated PC waits before the first verification but not before publishing a saved result', async t => {
  const commits = tickCommits(1), f = tickFixture(t, commits); let opened = 0;
  const readings = [100, 100, 40]; const meter = () => readings.shift() ?? 40;
  await tick(f.state, { ...f.deps, meter, verifyCommit: async (config, commit, output) => {
    opened++; assert.equal(readings.length, 0, 'opens only after the reading comes down');
    write(path.join(output, 'result.json'), f.receiptFor(commit));
    return { count: selected.length, digest: manifest.digest };
  } });
  assert.equal(opened, 1);
  const g = tickFixture(t, commits);
  const queueFile = path.join(g.state, 'queue.json'), saved = JSON.parse(fs.readFileSync(queueFile)), output = path.join(g.state, 'runs/saved');
  write(path.join(output, 'result.json'), g.receiptFor(commits[0]));
  Object.assign(saved.items[0], { status: 'publish-pending', output, count: selected.length, digest: manifest.digest }); write(queueFile, saved);
  await tick(g.state, { ...g.deps, meter: () => 100, verifyCommit: () => assert.fail('nothing to verify') });
  assert.equal(g.queue()[0].status, 'passed');
});
test('a checkout left half-written is repaired and recorded, and a clean one is left alone', t => {
  const dir = scratch(t), repo = path.join(dir, 'repo'), state = path.join(dir, 'state'), file = path.join(repo, 'tracked.txt');
  fs.mkdirSync(repo); fs.mkdirSync(state);
  runGit(repo, ['init', '-q']); fs.writeFileSync(file, 'committed\n'); fs.writeFileSync(path.join(repo, 'fixture.bin'), 'pinned');
  fs.writeFileSync(path.join(repo, '.gitignore'), 'fixture.bin\n');
  runGit(repo, ['add', 'tracked.txt', '.gitignore']); runGit(repo, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base']);
  const log = path.join(state, 'checkout-repairs.jsonl');
  assert.equal(repairCheckout(repo, state), false); assert.equal(fs.existsSync(log), false, 'nothing to record');
  fs.writeFileSync(file, 'half written\n'); fs.writeFileSync(path.join(repo, '.git/index.lock'), '');
  assert.equal(repairCheckout(repo, state), true);
  assert.equal(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), 'committed\n'); assert.equal(fs.existsSync(path.join(repo, '.git/index.lock')), false);
  assert.equal(runGit(repo, ['status', '--porcelain', '--untracked-files=no']), '');
  assert.equal(fs.readFileSync(path.join(repo, 'fixture.bin'), 'utf8'), 'pinned', 'a pinned input outside git stays');
  assert.match(JSON.parse(fs.readFileSync(log, 'utf8')).files[0], /tracked\.txt/);
});
