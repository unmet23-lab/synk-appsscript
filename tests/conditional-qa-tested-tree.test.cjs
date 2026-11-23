'use strict';
// docs left out of the verification checkouts (README #tested-tree), and the run criterion since 11-24: only commits that touched the tested paths run, and the newest master runs in full each slot (README #run-criterion).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..'), c = require('../tools/conditional-qa/contract.cjs');
const { KEPT_DOCS, SPARSE_PATTERNS, outsideTestedTree, onTheWay, testedChanges, traceEnvironment, touchedOutside } = require('../tools/conditional-qa/tested-tree.cjs');
const { write, git, ensureTestedTree } = require('../tools/conditional-qa/inputs.cjs');
const { markUntouched, supersede, scheduleFullRun, notRunText, FULL_RUN_EVERY_MS, nextItem, tick, failureText, republishFailures } = require('../tools/conditional-qa/worker.cjs');
const localStatus = require('../tools/conditional-qa/local-status.cjs');
const { accountLedger, s122TraceOnly } = require('../tools/conditional-qa/trace-diagnosis.cjs');
const github = require('../tools/conditional-qa/github.cjs');
const manifest = c.readManifest(root), local = manifest.cases.filter(row => row.route === 'local');
function scratch(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqa-tested-tree-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 })); return dir; }
const turn = () => new Promise(resolve => setTimeout(resolve, 1));

test('every local test file stays in the checkout, and the list is plain paths git cannot misread', () => {
  for (const row of local) assert.equal(outsideTestedTree(row.file), false, `${row.id} ${row.file}`);
  for (const entry of KEPT_DOCS) {
    assert.ok(entry.startsWith('docs/'), entry);
    assert.doesNotMatch(entry, /[*?[\]\\!#]|^\s|\s$/, entry);
    if (!entry.endsWith('/')) assert.ok(fs.existsSync(path.join(root, entry)) || entry.includes('/remotion/out/'), `kept file is gone: ${entry}`);
  }
  assert.deepEqual(SPARSE_PATTERNS.slice(0, 2), ['/*', '!/docs/']);
  assert.equal(new Set(KEPT_DOCS).size, KEPT_DOCS.length);
});
test('only docs off the list count as outside; everything else in the repository is under test', () => {
  assert.equal(outsideTestedTree('tools/conditional-qa/worker.cjs'), false);
  assert.equal(outsideTestedTree('docs.md'), false);
  assert.equal(outsideTestedTree('.github/workflows/conditional-qa.yml'), false);
  assert.equal(outsideTestedTree('docs/_ops/트랙.md'), true);
  assert.equal(outsideTestedTree('docs/현장노트/git_줄끝_잠금.md'), true);
  for (const entry of KEPT_DOCS) {
    assert.equal(outsideTestedTree(entry.endsWith('/') ? `${entry}a.js` : entry), false, entry);
    assert.equal(onTheWay(entry.replace(/\/[^/]*\/?$/, '')), true, entry);
  }
});

test('only the frozen S122 call sites identify a ledger read, even with multiple readers in one process', t => {
  const dir = scratch(t), checkout = path.join(dir, 'checkout'), file = path.join(checkout, 'tests/글자검사.test.js');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const call = "require('node:fs').existsSync(require('node:path').join(process.cwd(), 'docs/마케팅/sns-계정.json'));";
  const lines = Array(632).fill('');
  lines[605] = call; lines[625] = call; lines[630] = call;
  lines[631] = 'if (process.env.EXTRA_READER) ' + call;
  fs.writeFileSync(file, lines.join('\n'));
  function observe(label, extra, entry = file) {
    const folder = path.join(dir, label);
    const result = cp.spawnSync(process.execPath, [entry], { cwd: checkout, windowsHide: true,
      env: { ...process.env, ...traceEnvironment(checkout, folder), EXTRA_READER: extra }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(touchedOutside(folder), [accountLedger]);
    return fs.readdirSync(folder).map(name => name.replace(/^\d+/, '')).sort();
  }
  assert.deepEqual(observe('known', ''), ['.s122.txt']);
  assert.deepEqual(observe('mixed', '1'), ['.s122.txt', '.txt']);
  lines[0] = "Error.prepareStackTrace = () => { throw Error('unavailable'); };";
  fs.writeFileSync(file, lines.join('\n'));
  assert.deepEqual(observe('no-stack', ''), ['.txt']);
  const other = path.join(path.dirname(file), 'other.test.js');
  fs.writeFileSync(other, lines.slice(1).join('\n'));
  assert.deepEqual(observe('other-file', '', other), ['.txt']);
});

test('a single S122 trace qualifies only after every unchanged case and execution phase passed', t => {
  const folder = scratch(t), file = 'tests/글자검사.test.js', commit = 'a'.repeat(40);
  const cases = [{ id: 'S122', file, name: 'sample', profile: 'default' }, { id: 'S120', file, name: 'other', profile: 'default' }];
  const rows = cases.map(row => ({ ...row, status: 'pass' }));
  const expected = { commit, digest: manifest.digest, cases };
  const receipt = { version: 1, route: 'local', candidate: false, commit, manifestDigest: manifest.digest, expected: 2, passed: 2, ok: true,
    sourceBefore: { commit, trackedDiff: c.sha256(''), files: { [file]: '36d662883aaa0297937db099110ac2835a551f7e1f486ec133ae217e90329aad' } },
    sourceUnchanged: true, inputsUnchanged: true, rows, touchedOutside: [accountLedger],
    phases: [{ profile: 'default', expected: 2, passed: 2, ok: true, exitCode: 0, timedOut: false, unexpectedFailures: [], rows }] };
  assert.equal(s122TraceOnly(receipt, expected, path.join(folder, 'missing')), false);
  fs.writeFileSync(path.join(folder, '123.s122.txt'), accountLedger + '\n');
  assert.equal(s122TraceOnly(receipt, expected, folder), true);
  for (const change of [{ ok: false }, { sourceUnchanged: false }, { inputsUnchanged: false }, { candidate: true }, { route: 'all' },
    { commit: 'b'.repeat(40) }, { manifestDigest: 'x' }, { passed: 1 }, { rows: [rows[0], rows[0]] }, { rows: [rows[0], { ...rows[1], id: 'S999' }] },
    { sourceBefore: { ...receipt.sourceBefore, files: {} } }, { touchedOutside: [accountLedger, 'docs/other'] }, { phases: [] },
    ...[{ ok: false }, { exitCode: 1 }, { timedOut: true }, { unexpectedFailures: [{}] }, { profile: 'other' }, { rows: [] }]
      .map(phase => ({ phases: [{ ...receipt.phases[0], ...phase }] }))]) {
    assert.equal(s122TraceOnly({ ...receipt, ...change }, expected, folder), false, JSON.stringify(change));
  }
  fs.writeFileSync(path.join(folder, '456.txt'), accountLedger + '\n');
  assert.equal(s122TraceOnly(receipt, expected, folder), false);
});

test('a trace publication stays failed and is bound to the exact saved bytes and commit on retry', t => {
  const output = scratch(t), file = path.join(output, 'result.json'), commit = 'a'.repeat(40), label = github.traceDescription(85, manifest.digest, 'S122');
  const incomplete = 'Local verification incomplete; inspect the private worker receipt';
  const receipt = { commit, ok: false, expected: 85, manifestDigest: manifest.digest, touchedOutside: [accountLedger] };
  write(file, receipt);
  const item = { commit, status: 'failed', publicationError: true, output, traceReceiptSha256: c.sha256(fs.readFileSync(file)) };
  const calls = [];
  republishFailures({ items: [item] }, (...args) => calls.push(args));
  assert.deepEqual(calls, [[commit, 'failure', label]]);
  assert.equal(failureText(output), incomplete);
  assert.equal(failureText(output, { ...item, commit: 'b'.repeat(40) }), incomplete);
  fs.appendFileSync(file, '\n');
  assert.equal(failureText(output, item), incomplete);
});

function repository(t) {
  const dir = scratch(t), run = (...args) => cp.execFileSync('git', ['-c', 'core.quotepath=false', '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'core.autocrlf=false', ...args], { cwd: dir, encoding: 'utf8', windowsHide: true });
  run('init', '-q', '-b', 'master');
  const put = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
  const commit = message => { run('add', '-A'); run('commit', '-q', '--allow-empty', '-m', message); return run('rev-parse', 'HEAD').trim(); };
  return { dir, run, put, commit };
}
test('casting photo inputs stay readable and any photo change requires a fresh verification', t => {
  const g = repository(t), folder = 'docs/마케팅/PULSE_AI모델_캐스팅_20260930/site/';
  const photos = ['img/F04/hero-s.webp', 'img/M01/hair-2-s.webp', 'img/M21/look-2-s.webp'].map(file => folder + file);
  const unrelated = folder + 'notes.md';
  for (const file of photos) g.put(file, 'original photo');
  g.put(unrelated, 'not a test input'); const base = g.commit('casting inputs');
  const commits = photos.map(file => { g.put(file, 'changed photo'); return g.commit('photo changed'); });
  g.put(unrelated, 'notes changed'); const notes = g.commit('notes changed');
  const changes = testedChanges(g.dir, base, notes, git);
  for (const commit of commits) assert.equal(changes.get(commit).unchanged, false, 'a photo change must not carry an earlier pass');
  assert.equal(changes.get(notes).unchanged, true, 'nearby documents remain outside the tested tree');
  ensureTestedTree(g.dir);
  const trace = path.join(scratch(t), 'trace');
  const code = `const fs=require('node:fs'); for (const file of ${JSON.stringify(photos.map(file => path.join(g.dir, file)))}) fs.readFileSync(file); fs.existsSync(${JSON.stringify(path.join(g.dir, unrelated))});`;
  cp.execFileSync(process.execPath, ['-e', code], { env: { ...process.env, ...traceEnvironment(g.dir, trace) }, windowsHide: true });
  assert.deepEqual(touchedOutside(trace), [unrelated], 'photo reads are tracked inputs; unrelated probes still fail the run');
});
test('a real history: docs off the list leave the tested tree alone, a kept doc or a merged code change does not', t => {
  const g = repository(t), kept = KEPT_DOCS.find(entry => !entry.endsWith('/')) || `${KEPT_DOCS[0]}a.js`;
  g.put('tools/a.js', '1'); g.put('docs/_ops/트랙.md', '1'); g.put(kept, '1'); const base = g.commit('base');
  g.put('docs/_ops/트랙.md', '2'); g.put('docs/새 폴더/한글 이름.md', '1'); const onlyDocs = g.commit('docs');
  g.put(kept, '2'); const keptDoc = g.commit('kept');
  g.put('tools/a.js', '2'); g.put('docs/_ops/트랙.md', '3'); const mixed = g.commit('mixed');
  g.put(' docs/앞에 칸.md', '1'); const lookalike = g.commit('a folder that only looks like docs');
  g.put('docs/_ops/트랙.md', '4'); const moved = g.commit('docs again');
  fs.renameSync(path.join(g.dir, 'tools/a.js'), path.join(g.dir, 'docs/a.js')); const movedOut = g.commit('code moved into docs');
  const empty = g.commit('empty');
  g.run('checkout', '-q', '-b', 'side'); g.put('docs/_ops/곁.md', '1'); g.commit('side docs');
  g.run('checkout', '-q', 'master'); g.run('merge', '-q', '--no-ff', '-m', 'merge docs', 'side'); const mergeDocs = g.run('rev-parse', 'HEAD').trim();
  g.run('checkout', '-q', '-b', 'side2', mergeDocs); g.put('tools/b.js', '1'); g.commit('side code');
  g.run('checkout', '-q', 'master'); g.run('merge', '-q', '--no-ff', '-m', 'merge code', 'side2'); const mergeCode = g.run('rev-parse', 'HEAD').trim();
  const found = testedChanges(g.dir, base, mergeCode, git);
  const line = [onlyDocs, keptDoc, mixed, lookalike, moved, movedOut, empty, mergeDocs, mergeCode];
  assert.deepEqual([...found.keys()].sort(), [...line].sort(), 'the first-parent line only');
  assert.deepEqual(line.map(commit => found.get(commit).unchanged), [true, false, false, false, true, false, true, true, false]);
  assert.equal(found.get(onlyDocs).parent, base); assert.equal(found.get(mergeCode).parent, mergeDocs);
});
test('a checkout made earlier takes the list once and drops the left-out docs, keeping the kept ones and a pinned untracked input', t => {
  const g = repository(t), kept = KEPT_DOCS.find(entry => !entry.endsWith('/')) || `${KEPT_DOCS[0]}a.js`;
  g.put('tools/a.js', '1'); g.put('docs/_ops/트랙.md', '1'); g.put(kept, '1'); g.put('.gitignore', 'out\n'); g.commit('base');
  g.put('docs/left/out/pinned.mp4', 'pinned');
  assert.equal(ensureTestedTree(g.dir), true);
  assert.equal(fs.existsSync(path.join(g.dir, 'docs/_ops/트랙.md')), false);
  assert.equal(fs.existsSync(path.join(g.dir, kept)), true);
  assert.equal(fs.existsSync(path.join(g.dir, 'tools/a.js')), true);
  assert.equal(fs.readFileSync(path.join(g.dir, 'docs/left/out/pinned.mp4'), 'utf8'), 'pinned');
  assert.equal(ensureTestedTree(g.dir), false, 'nothing to do the second time');
  assert.equal(git(g.dir, ['status', '--porcelain', '--untracked-files=no']), '', 'a left-out file is not a change: run.cjs would refuse a tree that differs');
  assert.equal(git(g.dir, ['diff', '--binary', 'HEAD']), '');
});
test('the tracer writes down a probe of left-out docs at once, in a process that dies later too, and nothing else', t => {
  const dir = scratch(t), checkout = path.join(dir, 'checkout'), trace = path.join(dir, 'trace'), kept = KEPT_DOCS.find(entry => !entry.endsWith('/')) || `${KEPT_DOCS[0]}a.js`;
  fs.mkdirSync(path.join(checkout, 'docs/_ops'), { recursive: true }); fs.mkdirSync(path.join(checkout, 'tools'));
  fs.writeFileSync(path.join(checkout, 'tools/a.js'), '1'); fs.writeFileSync(path.join(checkout, 'docs/_ops/읽힌것.md'), '1');
  const code = `const fs=require('node:fs'),path=require('node:path'),at=f=>path.join(${JSON.stringify(checkout)},f);
    fs.existsSync(at('docs/_ops/없는것.md')); fs.readFileSync(at('docs/_ops/읽힌것.md')); fs.statSync(at('docs/_ops'));
    fs.existsSync(at(${JSON.stringify(kept)})); fs.existsSync(at('docs')); fs.readFileSync(at('tools/a.js')); fs.existsSync(at('docs/../tools/a.js'));
    fs.readdirSync(at('docs'));
    fs.promises.access(at('docs/_ops/약속.md')).catch(()=>{}).finally(()=>process.kill(process.pid,'SIGKILL'));`;
  const env = { ...process.env, ...traceEnvironment(checkout, trace) };
  assert.match(env.NODE_OPTIONS, /--require ".*read-trace\.cjs"/);
  cp.spawnSync(process.execPath, ['-e', code], { env, windowsHide: true, stdio: 'ignore' });
  assert.deepEqual(touchedOutside(trace), ['docs', 'docs/_ops', 'docs/_ops/약속.md', 'docs/_ops/없는것.md', 'docs/_ops/읽힌것.md'].sort(), 'a listing of docs itself counts; asking whether it exists does not');
  assert.deepEqual(touchedOutside(path.join(dir, 'no-such-folder')), [], 'a clean run has no folder');
});
test('a name holding the log separator stops the whole range from counting as unchanged, whatever follows it', () => {
  const a = hex(1), b = hex(2), c3 = hex(3), reading = (log, commits) => (cwd, args) => (args[0] === 'rev-list' ? String(commits) : log);
  const plain = `\u0001${a} ${b}\0\ndocs/x.md\0\u0001${b} ${c3}\0\ndocs/y.md\0`;
  assert.equal(testedChanges('root', c3, a, reading(plain, 2)).get(a).unchanged, true);
  for (const log of [
    `\u0001${a} ${b}\0\ndocs/x.md\0docs/\u0001tools/a.js\0tools/b.js\0\u0001${b} ${c3}\0\ndocs/y.md\0`,
    `\u0001${a} ${b}\0\n\u0001${'f'.repeat(40)}\0\u0001${b} ${c3}\0\ndocs/y.md\0`,
    `\u0001${a} ${b}\0\ndocs/x.md\0\u0001${c3} ${b}\0tools/b.js\0\u0001${b} ${c3}\0\ndocs/y.md\0`,
  ]) assert.throws(() => testedChanges('root', c3, a, reading(log, 2)), /separator/);
});
// A Windows file name cannot hold a control character.
if (process.platform !== 'win32') test('a real name holding the log separator counts nothing as unchanged', t => {
  const g = repository(t);
  g.put('tools/a.js', '1'); const base = g.commit('base');
  g.put('\u0001' + 'f'.repeat(40), 'code'); const head = g.commit('named');
  assert.throws(() => testedChanges(g.dir, base, head, git), /separator/);
});
test('capitals, a failed require and a failed import of left-out docs are written down too', t => {
  const dir = scratch(t), checkout = path.join(dir, 'checkout'), trace = path.join(dir, 'trace');
  fs.mkdirSync(path.join(checkout, 'docs/_ops'), { recursive: true });
  const at = file => path.join(checkout, file), code = `const fs=require('node:fs');
    fs.existsSync(${JSON.stringify(at('DOCS/_ops/대문자.md'))});
    try { require(${JSON.stringify(at('docs/_ops/없는모듈.js'))}); } catch {}
    import(${JSON.stringify(`file:///${at('docs/_ops/없는이엠.mjs').split(path.sep).join('/').replace(/^\//, '')}`)}).catch(()=>{}).finally(()=>process.exit(0));`;
  cp.spawnSync(process.execPath, ['-e', code], { env: { ...process.env, ...traceEnvironment(checkout, trace) }, windowsHide: true, stdio: 'ignore' });
  const seen = touchedOutside(trace).filter(file => !file.includes('.js') || file.includes('없는'));
  for (const name of ['docs/_ops/없는모듈.js', 'docs/_ops/없는이엠.mjs']) assert.ok(seen.includes(name), name);
  if (process.platform === 'win32') assert.ok(seen.includes('docs/_ops/대문자.md'));
});
test('without the two variables the tracer stays out of the way', () => {
  const env = { ...process.env, NODE_OPTIONS: `--require "${path.join(root, 'tools/conditional-qa/read-trace.cjs').split(path.sep).join('/')}"` };
  delete env.CQA_TRACE_DIR; delete env.CQA_TRACE_ROOT;
  assert.equal(cp.execFileSync(process.execPath, ['-p', `require('node:fs').existsSync.name`], { env, encoding: 'utf8', windowsHide: true }).trim(), 'existsSync');
});

// The tick fixture of conditional-qa.test.cjs, with a first-parent log: each commit lists what it changed.
const hex = n => n.toString(16).padStart(40, '0');
function queueFixture(t, plan, { statuses = {} } = {}) {
  const dir = scratch(t), state = path.join(dir, 'state'), commits = plan.map((_, n) => hex(n + 1)), parentOf = n => (n ? commits[n - 1] : hex(999)), head = commits.at(-1);
  write(path.join(state, 'owner.json'), { version: 1, purpose: 'synk-conditional-qa', state });
  write(path.join(state, 'config.json'), { version: 1, repo: github.REPO, state, root: path.join(state, 'workspace/SYNK-appsscript') });
  write(path.join(state, 'inputs.json'), { version: 1, files: [] });
  const receiptFor = commit => ({ version: 1, commit, manifestDigest: manifest.digest, expected: local.length, passed: local.length, ok: true, candidate: false, sourceUnchanged: true, inputsUnchanged: true, phases: [{ profile: 'default' }], sourceBefore: { commit }, rows: local.map(row => ({ ...row, status: 'pass' })) });
  const saved = commit => { const output = path.join(state, 'runs', `${commit}-1`); write(path.join(output, 'result.json'), receiptFor(commit)); return { output, count: local.length, digest: manifest.digest }; };
  const items = commits.map(commit => ({ commit, status: statuses[commit] || 'queued', ...(statuses[commit] === 'passed' && saved(commit)) }));
  write(path.join(state, 'queue.json'), { version: 1, seen: head, nextTurn: 'recent', items });
  const bytes = fs.readFileSync(path.join(root, 'tools/conditional-qa/cases.json'), 'utf8'), log = () => plan.map((files, n) => `\u0001${commits[n]} ${parentOf(n)}\0\n${files.join('\0')}\0`).reverse().join('');
  const runGit = (cwd, args) => { if (args[0] === 'rev-parse') return head; if (args[0] === 'rev-list') return args.includes('--count') ? String(plan.length) : ''; if (args[0] === 'show') return bytes; if (args[0] === 'log') return log(); return ''; };
  const published = [], woken = new Set(), hub = { ...github, publish: (commit, stateName, text, api, proof) => { published.push({ commit, state: stateName, text, proof }); }, resumeWaitingWorkflow: commit => { woken.add(commit); return true; }, cancelledRuns: () => new Map() };
  const queue = () => JSON.parse(fs.readFileSync(path.join(state, 'queue.json'))).items;
  return { state, commits, published, woken, queue, receiptFor, deps: { hub, runGit, cloneRoot: config => config.root, first: () => true, room: () => true, meter: () => 10, recheckMs: 1, warmUpMs: 0, calmMs: 0, slept: () => false, statfs: () => ({ bavail: 200n * 1024n ** 3n, bsize: 1n }) } };
}
const DOC = ['docs/_ops/트랙.md'], CODE = ['tools/a.js', 'docs/_ops/트랙.md'];
const UNTOUCHED = notRunText({ reason: 'untouched' }), pass = async (f, verified, commit, output) => { verified.push(commit); await turn(); write(path.join(output, 'result.json'), f.receiptFor(commit)); return { count: local.length, digest: manifest.digest }; };
const failing = (f, verified, red) => async (config, commit, output) => {
  if (commit !== red) return pass(f, verified, commit, output);
  verified.push(commit); await turn();
  write(path.join(output, 'result.json'), { ...f.receiptFor(commit), ok: false, passed: local.length - 1, rows: local.map((row, n) => ({ ...row, status: n ? 'pass' : 'fail' })) });
  throw Object.assign(Error('Local tests incomplete'), { code: 'TEST_FAILURE' });
};
test('only the commits that touched the tested paths run; a docs commit is marked not run, never passed', async t => {
  const f = queueFixture(t, [CODE, DOC, DOC, CODE, DOC]), [a, b, c2, d, e] = f.commits, verified = [];
  const summary = await tick(f.state, { ...f.deps, verifyCommit: (config, commit, output) => pass(f, verified, commit, output) });
  assert.deepEqual([...verified].sort(), [a, d].sort(), 'no docs commit ran');
  const items = Object.fromEntries(f.queue().map(row => [row.commit, row]));
  assert.deepEqual([a, b, c2, d, e].map(commit => items[commit].status), ['passed', 'not-run', 'not-run', 'passed', 'not-run']);
  for (const commit of [b, c2, e]) {
    assert.deepEqual(f.published.filter(row => row.commit === commit).map(row => [row.state, row.text, row.proof]), [['pending', UNTOUCHED, commit]], 'one pending line that names itself, and no pass');
    assert.equal(items[commit].output, undefined, 'no receipt is written for a commit that did not run');
  }
  assert.ok(UNTOUCHED.startsWith(localStatus.NOT_RUN_PREFIX));
  assert.deepEqual([...f.woken].sort(), [a, d].sort(), 'a hosted run is woken only for a real result');
  assert.deepEqual([summary.notRun, summary.notRunPublished, summary.fullRun], [3, 3, undefined]);
});
test('a failed parent no longer makes its docs children run, and a deliberate retry still runs', async t => {
  const f = queueFixture(t, [CODE, DOC, DOC, DOC]), [red, child, grandchild, retried] = f.commits, verified = [];
  const queue = JSON.parse(fs.readFileSync(path.join(f.state, 'queue.json')));
  Object.assign(queue.items[3], { status: 'retry', retryAt: 0, retryRequest: 'asked' });
  write(path.join(f.state, 'queue.json'), queue);
  await tick(f.state, { ...f.deps, verifyCommit: failing(f, verified, red) });
  const items = Object.fromEntries(f.queue().map(row => [row.commit, row]));
  assert.deepEqual([...verified].sort(), [red, retried].sort());
  assert.deepEqual([red, child, grandchild, retried].map(commit => items[commit].status), ['failed', 'not-run', 'not-run', 'passed']);
});
test('marking commits not run holds no checkout and needs no quiet PC', async t => {
  const f = queueFixture(t, [CODE, DOC, DOC], { statuses: { [hex(1)]: 'passed' } }), verifyCommit = t.mock.fn();
  await tick(f.state, { ...f.deps, first: () => false, room: () => false, meter: () => 100, verifyCommit });
  assert.equal(verifyCommit.mock.callCount(), 0);
  assert.deepEqual(f.queue().map(row => row.status), ['passed', 'not-run', 'not-run']);
});
test('a carried pass the old criterion left unpublished goes out as not run, not as a pass', async t => {
  const f = queueFixture(t, [CODE, DOC], { statuses: { [hex(1)]: 'passed' } }), queue = JSON.parse(fs.readFileSync(path.join(f.state, 'queue.json')));
  Object.assign(queue.items[1], { status: 'publish-pending', carriedFrom: hex(1), count: local.length, digest: manifest.digest, output: queue.items[0].output });
  write(path.join(f.state, 'queue.json'), queue);
  await tick(f.state, { ...f.deps, verifyCommit: () => assert.fail('nothing to run') });
  assert.deepEqual(f.published.map(row => [row.commit, row.state, row.text]), [[hex(2), 'pending', UNTOUCHED]]);
  assert.equal(f.queue()[1].status, 'not-run'); assert.equal(f.queue()[1].carriedFrom, undefined);
});
test('a not-run line that could not be published is tried again, and the commit still never runs', async t => {
  const f = queueFixture(t, [CODE, DOC, DOC], { statuses: { [hex(1)]: 'passed' } }), calls = [];
  const down = { ...f.deps.hub, publish: commit => { calls.push(commit); throw Error('spawnSync gh ETIMEDOUT'); } };
  await tick(f.state, { ...f.deps, hub: down, verifyCommit: () => assert.fail('a not-run commit never runs') });
  assert.deepEqual(calls, [hex(2)], 'a failed call ends the round');
  assert.deepEqual(f.queue().map(row => row.status), ['passed', 'not-run-pending', 'not-run-pending']); assert.match(f.queue()[1].notRunError, /ETIMEDOUT/);
  await tick(f.state, { ...f.deps, verifyCommit: () => assert.fail('a not-run commit never runs') });
  assert.deepEqual(f.published.map(row => row.commit), [hex(2), hex(3)]);
  assert.deepEqual(f.queue().map(row => row.status), ['passed', 'not-run', 'not-run']); assert.equal(f.queue()[1].notRunError, undefined);
});
test('not-run lines go out a round of them at a time, oldest first', async t => {
  const f = queueFixture(t, [CODE, DOC, DOC, DOC, DOC], { statuses: { [hex(1)]: 'passed' } });
  await tick(f.state, { ...f.deps, notRunPerRound: 2, verifyCommit: () => assert.fail('nothing to run') });
  assert.deepEqual(f.queue().map(row => row.status), ['passed', 'not-run', 'not-run', 'not-run-pending', 'not-run-pending']);
});
test('a history that cannot be read marks nothing, and the commits are simply measured', t => {
  const f = queueFixture(t, [CODE, DOC], { statuses: { [hex(1)]: 'passed' } }), queue = JSON.parse(fs.readFileSync(path.join(f.state, 'queue.json')));
  const logged = t.mock.method(console, 'error', () => {});
  assert.equal(markUntouched(queue, 'root', hex(2), { runGit: () => { throw Error('git log failed'); } }), 0);
  assert.equal(logged.mock.callCount(), 1);
  assert.equal(queue.items[1].status, 'queued');
  assert.equal(nextItem(queue, hex(2)).commit, hex(2));
});
test('the newest master runs in full ahead of both turns, even a docs commit, and its pass leaves the unreached code commits not run', async t => {
  const f = queueFixture(t, [CODE, CODE, DOC]), [a, b, head] = f.commits, verified = [];
  const queue = JSON.parse(fs.readFileSync(path.join(f.state, 'queue.json'))); queue.nextTurn = 'oldest'; write(path.join(f.state, 'queue.json'), queue);
  const summary = await tick(f.state, { ...f.deps, fullRunEveryMs: FULL_RUN_EVERY_MS, verifyCommit: (config, commit, output) => pass(f, verified, commit, output) });
  assert.deepEqual(verified, [head], 'the full run went first, and its pass settled the rest');
  const items = Object.fromEntries(f.queue().map(row => [row.commit, row]));
  assert.deepEqual([a, b, head].map(commit => items[commit].status), ['not-run', 'not-run', 'passed']);
  const later = notRunText({ reason: 'superseded', by: head });
  assert.equal(later, `${localStatus.NOT_RUN_PREFIX} later master ${head.slice(0, 12)} passed in full; not a pass`); assert.ok(later.length <= 140);
  for (const commit of [a, b]) assert.deepEqual(f.published.filter(row => row.commit === commit).map(row => [row.state, row.text, row.proof]), [['pending', later, head]], 'the link goes to the run that passed');
  assert.deepEqual(f.published.filter(row => row.commit === head).map(row => row.state), ['pending', 'success']);
  assert.equal(summary.fullRun.commit, head); assert.equal(summary.fullRun.status, 'passed');
  assert.equal(Date.parse(summary.fullRun.slot) % FULL_RUN_EVERY_MS, 0);
});
test('a failed full run settles nothing: the code commits before it still run', async t => {
  const f = queueFixture(t, [CODE, CODE, DOC]), [a, b, head] = f.commits, verified = [];
  await tick(f.state, { ...f.deps, fullRunEveryMs: FULL_RUN_EVERY_MS, verifyCommit: failing(f, verified, head) });
  assert.equal(verified[0], head); assert.deepEqual([...verified].sort(), [a, b, head].sort());
  assert.deepEqual(f.queue().map(row => row.status), ['passed', 'passed', 'failed']);
  assert.ok(!f.published.some(row => row.text.startsWith(localStatus.NOT_RUN_PREFIX)));
});
test('a passed full run leaves alone every commit that ran, failed, waits for a retry or runs now', () => {
  const rows = ['passed', 'failed', 'retry', 'running', 'publish-pending', 'queued', 'queued'].map((status, n) => ({ commit: hex(n + 1), status }));
  const queue = { items: rows }; rows[6].status = 'passed';
  assert.equal(supersede(queue, rows[6], 0), 1);
  assert.deepEqual(rows.map(row => row.status), ['passed', 'failed', 'retry', 'running', 'publish-pending', 'not-run-pending', 'passed']);
  assert.deepEqual(rows[5].notRun, { reason: 'superseded', by: hex(7), at: new Date(0).toISOString() });
});
test('each slot takes the newest master once; a stale target goes back to the ordinary rules', () => {
  const every = FULL_RUN_EVERY_MS, slot = 10 * every, rows = [{ commit: hex(1), status: 'queued', fullRun: 'old' }, { commit: hex(2), status: 'not-run', notRun: { reason: 'untouched' } }], queue = { items: rows };
  assert.equal(scheduleFullRun(queue, hex(2), slot + 5, every), rows[1]);
  assert.deepEqual([rows[1].status, rows[1].notRun, rows[1].fullRun, queue.fullRunSlot], ['queued', undefined, new Date(slot).toISOString(), new Date(slot).toISOString()], 'a docs head is measured after all');
  assert.equal(rows[0].fullRun, undefined, 'the stale target keeps no priority');
  assert.equal(scheduleFullRun(queue, hex(2), slot + every - 1, every), null, 'once a slot');
  assert.equal(nextItem({ ...queue, nextTurn: 'oldest' }, hex(2)), rows[1], 'ahead of the oldest turn');
  rows[1].status = 'passed'; rows.push({ commit: hex(3), status: 'queued' });
  assert.equal(scheduleFullRun(queue, hex(3), slot + every, every), rows[2]);
  assert.equal(scheduleFullRun({ items: rows }, hex(9), slot, every), null, 'a head outside the queue schedules nothing');
  const settled = { items: [{ commit: hex(5), status: 'queued' }, { commit: hex(6), status: 'passed' }] };
  scheduleFullRun(settled, hex(6), slot, every);
  assert.equal(settled.items[0].status, 'not-run-pending', 'a newest master that already passed settles the older code commits at once');
});
test('a requested verification moves neither the marks nor the schedule', async t => {
  const f = queueFixture(t, [CODE, DOC], { statuses: { [hex(1)]: 'passed' } }), [, b] = f.commits, verified = [];
  await tick(f.state, { ...f.deps, requestedCommit: b, fullRunEveryMs: FULL_RUN_EVERY_MS, verifyCommit: (config, commit, output) => pass(f, verified, commit, output) });
  assert.deepEqual(verified, [b]); assert.equal(f.queue()[1].status, 'passed');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.state, 'queue.json'))).fullRunSlot, undefined);
});
test('a list that changes reaches an existing checkout before its next commit is checked out', () => {
  const source = fs.readFileSync(path.join(root, 'tools/conditional-qa/inputs.cjs'), 'utf8');
  assert.ok(source.indexOf('ensureTestedTree(root);') < source.indexOf("git(root, ['checkout', '--detach', commit]"), 'the tree is narrowed first, so a checkout never writes docs it would then delete');
  assert.ok(source.indexOf('repairCheckout(root, state);') < source.indexOf('ensureTestedTree(root);'), 'on a clean tree');
});
test('publish links the proving commit only when one is given', () => {
  const calls = [], api = (endpoint, body) => { calls.push([endpoint, body]); };
  github.publish(hex(1), 'success', 'PASS', api); github.publish(hex(2), 'success', 'PASS', api, hex(1));
  assert.match(calls[0][1].target_url, new RegExp(`/commit/${hex(1)}/checks$`));
  assert.match(calls[1][0], new RegExp(`/statuses/${hex(2)}$`)); assert.match(calls[1][1].target_url, new RegExp(`/commit/${hex(1)}/checks$`));
  assert.throws(() => github.publish(hex(2), 'success', 'PASS', api, 'not-a-commit'), /full commit/);
});
