'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..'), c = require('../tools/conditional-qa/contract.cjs');
const { check } = require('../tools/conditional-qa/guard.cjs');
const { childRun, temporaryEnvironment } = require('../tools/conditional-qa/run.cjs');
const { materialize, write } = require('../tools/conditional-qa/inputs.cjs');
const { extendQueue, nextItem, acquire, sleptDuring, due } = require('../tools/conditional-qa/worker.cjs');
const { plan } = require('../tools/conditional-qa/install.cjs');
const github = require('../tools/conditional-qa/github.cjs');
const { wait } = require('../tools/conditional-qa/wait-local.cjs');
const manifest = c.readManifest(root), selected = manifest.cases.filter(row => row.route === 'local');
const commit = 'a'.repeat(40);
const good = () => ({ version: 1, commit, manifestDigest: manifest.digest, expected: selected.length, passed: selected.length,
  ok: true, sourceUnchanged: true, rows: selected.map(row => ({ ...row, status: 'pass' })) });
function scratch(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conditional-qa-test-')); t.after(() => { if (!c.within(os.tmpdir(), dir) || fs.lstatSync(dir).isSymbolicLink()) throw Error('Unsafe test cleanup'); fs.rmSync(dir, { recursive: true, force: true }); }); return dir; }

test('all 113 original cases have one concrete route and a live source file', () => {
  assert.equal(check(root), 113);
  assert.deepEqual(Object.fromEntries(['windows', 'linux', 'local'].map(route => [route, manifest.cases.filter(row => row.route === route).length])), { windows: 28, linux: 7, local: 78 });
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
  const changed = JSON.parse(fs.readFileSync(file)); changed.cases.pop(); changed.expectedCount--;
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
  extendQueue(queue, commits[3], [commits[3]]);
  assert.equal(nextItem(queue, commits[3], attempted).commit, commits[3], 'a push during verification gets priority next');
  queue.items.push({ commit: commits[4], status: 'publish-pending' });
  assert.equal(nextItem(queue, commits[3], attempted).commit, commits[4]);
  queue.items[4].status = 'retry'; queue.items[4].retryAt = 200;
  assert.equal(nextItem(queue, commits[4], attempted, 100).commit, commits[3], 'future retry does not spin or bury another recent commit');
  assert.equal(nextItem(queue, commits[4], attempted, 200).commit, commits[4]);
  assert.equal(queue.items[1].status, 'failed');
});

test('after the newest commit passes, recent commits drain before the historical backlog without dropping any item', () => {
  const items = ['a', 'b', 'c', 'd'].map(x => ({ commit: x.repeat(40), status: 'queued' }));
  items[3].status = 'passed';
  const queue = { items }, attempted = new Set(), order = [];
  for (let item; (item = nextItem(queue, items[3].commit, attempted));) { order.push(item.commit); attempted.add(item.commit); }
  assert.deepEqual(order, [items[2].commit, items[1].commit, items[0].commit]);
  assert.deepEqual(items.map(item => item.status), ['queued', 'queued', 'queued', 'passed']);
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
