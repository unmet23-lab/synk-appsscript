'use strict';
// docs left out of the verification checkouts, and the pass a commit carries from its parent when nothing under test changed (README #tested-tree).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..'), c = require('../tools/conditional-qa/contract.cjs');
const { KEPT_DOCS, SPARSE_PATTERNS, outsideTestedTree, onTheWay, testedChanges, traceEnvironment, touchedOutside } = require('../tools/conditional-qa/tested-tree.cjs');
const { write, git, ensureTestedTree } = require('../tools/conditional-qa/inputs.cjs');
const { carryUnchanged, nextItem, tick } = require('../tools/conditional-qa/worker.cjs');
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

function repository(t) {
  const dir = scratch(t), run = (...args) => cp.execFileSync('git', ['-c', 'core.quotepath=false', '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'core.autocrlf=false', ...args], { cwd: dir, encoding: 'utf8', windowsHide: true });
  run('init', '-q', '-b', 'master');
  const put = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
  const commit = message => { run('add', '-A'); run('commit', '-q', '--allow-empty', '-m', message); return run('rev-parse', 'HEAD').trim(); };
  return { dir, run, put, commit };
}
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
test('a name holding the log separator stops the whole range from carrying, whatever follows it', () => {
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
if (process.platform !== 'win32') test('a real name holding the log separator stops carrying', t => {
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
test('what a stopped tick left to publish counts against the next tick\'s share', async t => {
  const f = carryFixture(t, [CODE, ...Array(70).fill(DOC)], { statuses: { [hex(1)]: 'passed' } }), queue = JSON.parse(fs.readFileSync(path.join(f.state, 'queue.json')));
  assert.equal(carryUnchanged(queue, 'root', hex(71), f.state, { runGit: f.deps.runGit, limit: 60 }), 60);
  write(path.join(f.state, 'queue.json'), queue);
  const summary = await tick(f.state, { ...f.deps, first: () => false, room: () => false, verifyCommit: () => assert.fail('no run') });
  assert.equal(f.published.filter(row => row.state === 'success').length, 60);
  assert.equal(f.queue().filter(row => row.status === 'passed').length, 61); assert.equal(summary.carried, 60);
});
test('without the two variables the tracer stays out of the way', () => {
  const env = { ...process.env, NODE_OPTIONS: `--require "${path.join(root, 'tools/conditional-qa/read-trace.cjs').split(path.sep).join('/')}"` };
  delete env.CQA_TRACE_DIR; delete env.CQA_TRACE_ROOT;
  assert.equal(cp.execFileSync(process.execPath, ['-p', `require('node:fs').existsSync.name`], { env, encoding: 'utf8', windowsHide: true }).trim(), 'existsSync');
});

// The tick fixture of conditional-qa.test.cjs, with a first-parent log: each commit lists what it changed.
const hex = n => n.toString(16).padStart(40, '0');
function carryFixture(t, plan, { statuses = {} } = {}) {
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
test('only the code commits run: docs commits carry the pass of the run that proved them, oldest first, whatever the turn', async t => {
  const f = carryFixture(t, [CODE, DOC, DOC, CODE, DOC]), [a, b, c2, d, e] = f.commits, verified = [];
  const summary = await tick(f.state, { ...f.deps, verifyCommit: async (config, commit, output) => { verified.push(commit); await turn(); write(path.join(output, 'result.json'), f.receiptFor(commit)); return { count: local.length, digest: manifest.digest }; } });
  assert.deepEqual([...verified].sort(), [a, d].sort(), 'no docs commit ran');
  assert.equal(verified[0], d, 'the newest turn lands on the newest commit that needs a run, not on a commit waiting for it');
  const items = Object.fromEntries(f.queue().map(row => [row.commit, row]));
  assert.ok(Object.values(items).every(row => row.status === 'passed'));
  assert.deepEqual([b, c2].map(commit => items[commit].carriedFrom), [a, a], 'a chain names the run at its start');
  assert.equal(items[e].carriedFrom, d);
  assert.deepEqual([a, d].map(commit => items[commit].carriedFrom), [undefined, undefined]);
  for (const row of f.published.filter(row => row.state === 'success')) assert.equal(row.text, github.description(local.length, manifest.digest), 'the exact line an older commit\'s wait-local.cjs compares');
  assert.deepEqual(f.published.filter(row => row.state === 'success' && row.commit === c2).map(row => row.proof), [a], 'the public link goes to the proving commit');
  assert.deepEqual(f.published.filter(row => row.commit === b).map(row => row.state), ['success'], 'a carried commit never reads as running');
  const receipt = JSON.parse(fs.readFileSync(path.join(items[c2].output, 'result.json')));
  assert.equal(receipt.commit, c2); assert.equal(receipt.carriedFrom.origin, a); assert.equal(receipt.carriedFrom.parent, b);
  assert.equal(receipt.phases, undefined, 'no run happened here'); assert.equal(summary.carried, 3); assert.equal(summary.awaitingParent, 0);
  assert.deepEqual([...f.woken].sort(), [...f.commits].sort(), 'each commit\'s waiting run is woken, as after a real result');
});
test('a commit whose parent already passed carries at once, holding no checkout and needing no quiet PC', async t => {
  const f = carryFixture(t, [CODE, DOC, DOC], { statuses: { [hex(1)]: 'passed' } }), verifyCommit = t.mock.fn();
  await tick(f.state, { ...f.deps, first: () => false, room: () => false, meter: () => 100, verifyCommit });
  assert.equal(verifyCommit.mock.callCount(), 0);
  assert.ok(f.queue().every(row => row.status === 'passed'));
});
test('a failure never carries: the next commit measures itself, and so does a deliberate retry', async t => {
  const f = carryFixture(t, [CODE, DOC, DOC, DOC]), [red, child, grandchild, retried] = f.commits, verified = [];
  const queue = JSON.parse(fs.readFileSync(path.join(f.state, 'queue.json')));
  Object.assign(queue.items[3], { status: 'retry', retryAt: 0, retryRequest: 'asked' });
  write(path.join(f.state, 'queue.json'), queue);
  await tick(f.state, { ...f.deps, verifyCommit: async (config, commit, output) => {
    verified.push(commit); await turn();
    if (commit === red) { write(path.join(output, 'result.json'), { ...f.receiptFor(commit), ok: false, passed: local.length - 1, rows: local.map((row, n) => ({ ...row, status: n ? 'pass' : 'fail' })) }); throw Object.assign(Error('Local tests incomplete'), { code: 'TEST_FAILURE' }); }
    write(path.join(output, 'result.json'), f.receiptFor(commit)); return { count: local.length, digest: manifest.digest };
  } });
  const items = Object.fromEntries(f.queue().map(row => [row.commit, row]));
  assert.equal(items[red].status, 'failed');
  assert.ok(verified.includes(child), 'the child of a failure runs'); assert.equal(items[child].carriedFrom, undefined);
  assert.ok(verified.includes(retried), 'a retry that was asked for runs'); assert.equal(items[retried].carriedFrom, undefined);
  assert.equal(items[grandchild].status, 'passed'); assert.equal(items[grandchild].carriedFrom, child, 'a real pass carries again');
});
test('a commit waits for its parent, and takes no turn meanwhile', t => {
  const f = carryFixture(t, [CODE, CODE, DOC, DOC]), queue = JSON.parse(fs.readFileSync(path.join(f.state, 'queue.json'))), [, b, c2, d] = f.commits;
  queue.items[0].status = 'passed'; queue.items[1].status = 'running';
  assert.equal(carryUnchanged(queue, 'root', d, f.state, { runGit: f.deps.runGit }), 0);
  assert.deepEqual(queue.items.map(row => Boolean(row.awaitsParent)), [false, false, true, true]);
  assert.equal(nextItem(queue, d, new Set([b])), undefined, 'the newest two wait for the run in progress: nothing else needs a turn');
  queue.items[1].status = 'queued';
  assert.equal(carryUnchanged(queue, 'root', d, f.state, { runGit: f.deps.runGit }), 0);
  assert.equal(nextItem(queue, d).commit, b, 'head is waiting, so the turn takes the newest commit that is not');
  assert.equal(nextItem(queue, d, new Set(), Date.now(), c2).commit, c2, 'a requested commit is measured itself');
});
test('a list that changes reaches an existing checkout before its next commit is checked out', () => {
  const source = fs.readFileSync(path.join(root, 'tools/conditional-qa/inputs.cjs'), 'utf8');
  assert.ok(source.indexOf('ensureTestedTree(root);') < source.indexOf("git(root, ['checkout', '--detach', commit]"), 'the tree is narrowed first, so a checkout never writes docs it would then delete');
  assert.ok(source.indexOf('repairCheckout(root, state);') < source.indexOf('ensureTestedTree(root);'), 'on a clean tree');
});
test('a long backlog carries a tick\'s worth at a time, and the rest waits instead of running', t => {
  const f = carryFixture(t, [CODE, DOC, DOC, DOC, DOC], { statuses: { [hex(1)]: 'passed' } }), queue = JSON.parse(fs.readFileSync(path.join(f.state, 'queue.json')));
  assert.equal(carryUnchanged(queue, 'root', hex(5), f.state, { runGit: f.deps.runGit, limit: 2 }), 2);
  assert.deepEqual(queue.items.map(row => row.status), ['passed', 'publish-pending', 'publish-pending', 'queued', 'queued']);
  assert.deepEqual(queue.items.map(row => Boolean(row.awaitsParent)), [false, false, false, true, true]);
  assert.equal(carryUnchanged(queue, 'root', hex(5), f.state, { runGit: f.deps.runGit, limit: 0 }), 0, 'used up for this tick');
  assert.deepEqual(queue.items.map(row => Boolean(row.awaitsParent)), [false, false, false, true, true]);
});
test('a parent receipt that cannot be read costs a real run, never a pass', async t => {
  const f = carryFixture(t, [CODE, DOC], { statuses: { [hex(1)]: 'passed' } }), [a, b] = f.commits, verified = [];
  const output = f.queue()[0].output; write(path.join(output, 'result.json'), { ...f.receiptFor(a), ok: false });
  await tick(f.state, { ...f.deps, verifyCommit: async (config, commit, out) => { verified.push(commit); write(path.join(out, 'result.json'), f.receiptFor(commit)); return { count: local.length, digest: manifest.digest }; } });
  assert.deepEqual(verified, [b]);
  const item = f.queue()[1]; assert.equal(item.status, 'passed'); assert.equal(item.carriedFrom, undefined);
  assert.equal(f.published.find(row => row.commit === b && row.state === 'success').proof, b);
});
test('a history that cannot be read carries nothing, and the commits are simply verified', t => {
  const f = carryFixture(t, [CODE, DOC], { statuses: { [hex(1)]: 'passed' } }), queue = JSON.parse(fs.readFileSync(path.join(f.state, 'queue.json')));
  const logged = t.mock.method(console, 'error', () => {});
  assert.equal(carryUnchanged(queue, 'root', hex(2), f.state, { runGit: () => { throw Error('git log failed'); } }), 0);
  assert.equal(logged.mock.callCount(), 1);
  assert.equal(queue.items[1].status, 'queued'); assert.equal(queue.items[1].awaitsParent, undefined);
});
test('a requested verification leaves carrying alone', async t => {
  const f = carryFixture(t, [CODE, DOC], { statuses: { [hex(1)]: 'passed' } }), [, b] = f.commits, verified = [];
  await tick(f.state, { ...f.deps, requestedCommit: b, verifyCommit: async (config, commit, out) => { verified.push(commit); write(path.join(out, 'result.json'), f.receiptFor(commit)); return { count: local.length, digest: manifest.digest }; } });
  assert.deepEqual(verified, [b]); assert.equal(f.queue()[1].carriedFrom, undefined);
});
test('publish links the proving commit only when one is given', () => {
  const calls = [], api = (endpoint, body) => { calls.push([endpoint, body]); };
  github.publish(hex(1), 'success', 'PASS', api); github.publish(hex(2), 'success', 'PASS', api, hex(1));
  assert.match(calls[0][1].target_url, new RegExp(`/commit/${hex(1)}/checks$`));
  assert.match(calls[1][0], new RegExp(`/statuses/${hex(2)}$`)); assert.match(calls[1][1].target_url, new RegExp(`/commit/${hex(1)}/checks$`));
  assert.throws(() => github.publish(hex(2), 'success', 'PASS', api, 'not-a-commit'), /full commit/);
});
