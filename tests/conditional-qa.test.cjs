'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..'), c = require('../tools/conditional-qa/contract.cjs');
const { check } = require('../tools/conditional-qa/guard.cjs');
const { childRun, temporaryEnvironment } = require('../tools/conditional-qa/run.cjs');
const { materialize, write, release, prepare } = require('../tools/conditional-qa/inputs.cjs');
const { extendQueue, nextItem, advanceTurn, acquire, sleptDuring, failureDisposition, due } = require('../tools/conditional-qa/worker.cjs');
const { plan } = require('../tools/conditional-qa/install.cjs');
const github = require('../tools/conditional-qa/github.cjs');
const { wait } = require('../tools/conditional-qa/wait-local.cjs');
const manifest = c.readManifest(root), selected = manifest.cases.filter(row => row.route === 'local');
const commit = 'a'.repeat(40);
const good = () => ({ version: 1, commit, manifestDigest: manifest.digest, expected: selected.length, passed: selected.length,
  ok: true, sourceUnchanged: true, rows: selected.map(row => ({ ...row, status: 'pass' })) });
function scratch(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conditional-qa-test-')); t.after(() => { if (!c.within(os.tmpdir(), dir) || fs.lstatSync(dir).isSymbolicLink()) throw Error('Unsafe test cleanup'); fs.rmSync(dir, { recursive: true, force: true }); }); return dir; }

test('all 113 original cases have one concrete route and a live source file', () => {
  assert.equal(check(root), 114);
  assert.deepEqual(Object.fromEntries(['windows', 'linux', 'local'].map(route => [route, manifest.cases.filter(row => row.route === route).length])), { windows: 28, linux: 7, local: 79 });
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
test('only an event-backed sleep interruption is pending; real failures are still red and neither can pass', () => {
  const from = '2026-11-02T13:01:39.573Z', now = new Date('2026-11-02T13:13:35.839Z');
  for (const [code, loggedSleep, expectedStatus, expectedPublication] of [
    ['TEST_FAILURE', true, 'retry', 'pending'], ['TEST_FAILURE', false, 'failed', 'failure'],
    ['EIO', true, 'retry', 'failure'], [undefined, false, 'retry', 'failure'],
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
test('offline local verification times out and never manufactures a green status', async () => {
  const writes = [];
  await assert.rejects(wait({ root, commit, timeoutMs: 15, intervalMs: 2, read: () => null, write: (...args) => writes.push(args) }), /did not finish/);
  assert.equal(writes.length, 1); assert.equal(writes[0][1], 'pending');
  await assert.rejects(wait({ root, commit, read: () => ({ state: 'failure', description: 'incomplete' }) }), /not passed/);
});
