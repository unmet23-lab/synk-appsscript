'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..'), c = require('../tools/conditional-qa/contract.cjs');
const { check } = require('../tools/conditional-qa/guard.cjs');
const { childRun } = require('../tools/conditional-qa/run.cjs');
const { materialize } = require('../tools/conditional-qa/inputs.cjs');
const { extendQueue, acquire } = require('../tools/conditional-qa/worker.cjs');
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
