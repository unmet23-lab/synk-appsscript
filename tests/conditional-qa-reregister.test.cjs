'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const { reregisterInputs, parse } = require('../tools/conditional-qa/reregister.cjs');
const { write, read, materialize } = require('../tools/conditional-qa/inputs.cjs');
const { acquire } = require('../tools/conditional-qa/worker.cjs');
const { REPO } = require('../tools/conditional-qa/github.cjs');
const { sha256 } = require('../tools/conditional-qa/contract.cjs');

// 11-06 6051236295 repackaged four git-ignored PATH films and the tracked manifest followed; the worker kept the 11-01 bytes and every later commit failed S063-S067.
const FILM = 'experiences/path-vr/assets/interview/film/strict-question-720p.mp4';
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-qa-reregister-'));
  t.after(() => { const real = fs.realpathSync(dir); assert.ok(real.startsWith(fs.realpathSync(os.tmpdir()) + path.sep) && path.basename(real).startsWith('synk-qa-reregister-')); fs.rmSync(real, { recursive: true, force: true }); });
  const source = path.join(dir, 'source'), state = path.join(dir, 'state');
  const put = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
  put(path.join(source, '.gitignore'), '*.mp4\n'); put(path.join(source, 'tracked.json'), '{}\n');
  const old = Buffer.from('film packed on 11-01'), current = Buffer.from('film repacked on 11-06');
  put(path.join(source, FILM), current);
  const run = args => cp.execFileSync('git', args, { cwd: source, windowsHide: true, stdio: 'ignore' });
  run(['init', '-q']); run(['add', '.gitignore', 'tracked.json']);
  write(path.join(state, 'owner.json'), { version: 1, purpose: 'synk-conditional-qa', state });
  write(path.join(state, 'config.json'), { version: 1, repo: REPO, state, sourceRepo: source, root: path.join(state, 'workspace/SYNK-appsscript') });
  put(path.join(state, 'blobs', sha256(old)), old);
  const rows = [{ area: 'app', file: FILM, sha256: sha256(old), bytes: old.length, source: path.join(source, FILM) },
    { area: 'app', file: 'tracked.json', sha256: sha256('{}\n'), bytes: 3, source: path.join(source, 'tracked.json') }];
  put(path.join(state, 'blobs', rows[1].sha256), '{}\n');
  write(path.join(state, 'inputs.json'), { version: 1, frozenCommit: 'f'.repeat(40), files: rows });
  return { dir, source, state, old, current, inputs: path.join(state, 'inputs.json'), options: { state, files: [FILM], reason: 'shared copy repackaged the film and the tracked manifest followed', now: 1000 } };
}
test('a preview changes nothing; applying pins the shared copy bytes and keeps the old version', t => {
  const f = fixture(t), before = fs.readFileSync(f.inputs);
  const preview = reregisterInputs(f.options);
  assert.equal(preview.applied, false);
  assert.deepEqual(preview.files, [{ file: FILM, from: sha256(f.old), to: sha256(f.current), bytes: f.current.length, unchanged: false }]);
  assert.deepEqual(fs.readFileSync(f.inputs), before);
  assert.equal(fs.existsSync(path.join(f.state, 'blobs', sha256(f.current))), false);
  assert.equal(fs.existsSync(path.join(f.state, 'input-history')), false);
  const result = reregisterInputs({ ...f.options, apply: true }), row = read(f.inputs).files[0];
  assert.equal(row.sha256, sha256(f.current)); assert.equal(row.bytes, f.current.length);
  assert.deepEqual(row.replaced.map(old => [old.sha256, old.bytes, old.request]), [[sha256(f.old), f.old.length, result.id]]);
  assert.deepEqual(fs.readFileSync(path.join(f.state, 'blobs', sha256(f.current))), f.current);
  assert.deepEqual(fs.readFileSync(path.join(f.state, 'blobs', sha256(f.old))), f.old);
  const ledger = read(path.join(f.state, 'input-history', `${result.id}.json`));
  assert.equal(ledger.state, 'applied'); assert.equal(ledger.inputsAfterSha256, sha256(fs.readFileSync(f.inputs)));
  assert.equal(fs.existsSync(path.join(f.state, 'worker.lock')), false);
  // Running it again finds nothing to move.
  assert.equal(reregisterInputs({ ...f.options, apply: true }).files[0].unchanged, true);
  assert.equal(read(f.inputs).files[0].replaced.length, 1);
});
test('a checkout holding a replaced version gets the new bytes; unknown bytes are still refused', t => {
  const f = fixture(t); reregisterInputs({ ...f.options, apply: true });
  const rows = read(f.inputs).files.filter(row => row.file === FILM), target = path.join(f.dir, 'checkout'), film = path.join(target, FILM);
  fs.mkdirSync(path.dirname(film), { recursive: true }); fs.writeFileSync(film, f.old);
  assert.deepEqual(materialize(f.state, rows, target), [{ file: film, sha256: sha256(f.current) }]);
  assert.deepEqual(fs.readFileSync(film), f.current);
  assert.equal(fs.existsSync(film + '.cqa-new'), false);
  fs.writeFileSync(film, 'edited by a test');
  assert.throws(() => materialize(f.state, rows, target), /Existing fixture changed/);
  assert.deepEqual(fs.readFileSync(film), Buffer.from('edited by a test'));
});
test('a live worker, tracked source, an unregistered file or a bad request leaves the list alone', t => {
  const f = fixture(t), before = fs.readFileSync(f.inputs), unlock = acquire(f.state);
  try { assert.throws(() => reregisterInputs({ ...f.options, apply: true }), /already running/); } finally { unlock(); }
  assert.throws(() => reregisterInputs({ ...f.options, files: ['tracked.json'], apply: true }), /Tracked source is never pinned/);
  assert.throws(() => reregisterInputs({ ...f.options, files: ['experiences/path-vr/assets/new.mp4'], apply: true }), /Not a single registered app input/);
  assert.throws(() => reregisterInputs({ ...f.options, files: ['../escape.mp4'], apply: true }), /Invalid/);
  assert.throws(() => reregisterInputs({ ...f.options, files: [FILM, FILM] }), /distinct/);
  assert.throws(() => reregisterInputs({ ...f.options, reason: ' ' }), /reason is required/);
  assert.deepEqual(fs.readFileSync(f.inputs), before);
  assert.equal(fs.existsSync(path.join(f.state, 'blobs', sha256(f.current))), false);
  assert.equal(fs.existsSync(path.join(f.state, 'worker.lock')), false);
});
test('the command line names files, the state and the reason; an unknown flag is refused', () => {
  assert.deepEqual(parse(['--state', 'S', '--reason', 'why', 'a\\b.mp4', '--apply']), { files: ['a/b.mp4'], state: 'S', reason: 'why', apply: true });
  assert.throws(() => parse(['--reason']), /Missing value/);
  assert.throws(() => parse(['--force', 'a.mp4']), /Unknown option/);
});
