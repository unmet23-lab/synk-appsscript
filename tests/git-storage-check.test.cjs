'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { checkRepository, validatePolicy } = require('../tools/git-storage-check.cjs');

const SCRIPT = path.resolve(__dirname, '../tools/git-storage-check.cjs');
const POLICY = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../tools/git-storage-policy.json'), 'utf8'));
const POLICY_PATH = 'tools/git-storage-policy.json';
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name)));

function fixture(t, policyChanges = {}, initial = {}, unborn = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-git-storage-test-'));
  const env = { ...cleanEnv, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(root, 'no-global-config'),
    GIT_AUTHOR_NAME: 'Storage Test', GIT_AUTHOR_EMAIL: 'storage-test@example.invalid',
    GIT_COMMITTER_NAME: 'Storage Test', GIT_COMMITTER_EMAIL: 'storage-test@example.invalid',
    GIT_TERMINAL_PROMPT: '0' };
  function git(args, overrides = {}) {
    return execFileSync('git', ['-c', 'core.hooksPath=' + path.join(root, 'no-hooks'), '-c', 'core.autocrlf=false', ...args], {
      cwd: root, env: { ...env, ...overrides }, maxBuffer: 16 * 1024 * 1024,
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    }).toString('utf8').trim();
  }
  function write(name, value) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
  }
  const policy = { ...structuredClone(POLICY), ...policyChanges };
  git(['init', '-q', '-b', 'main']);
  write(POLICY_PATH, JSON.stringify(policy, null, 2) + '\n');
  for (const [name, value] of Object.entries(initial)) write(name, value);
  git(['add', '--all']);
  if (!unborn) git(['commit', '-q', '-m', 'fixture baseline']);
  const check = (options = { cached: true }, overrides = {}) => checkRepository(options, root, { ...env, ...overrides });
  t.after(() => {
    const resolved = fs.realpathSync(root), temp = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(resolved), temp);
    assert.match(path.basename(resolved), /^synk-git-storage-test-/);
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return { root, env, policy, git, write, check };
}

test('reads a staged large blob even when the worktree has a smaller replacement', async t => {
  const f = fixture(t, { maxBlobBytes: 64, maxTotalBytes: 10000 });
  f.write('assets/큰 그림.bin', Buffer.alloc(65, 1));
  f.git(['add', '--', 'assets/큰 그림.bin']);
  f.write('assets/큰 그림.bin', 'small unstaged version');
  const result = await f.check();
  assert.equal(result.ok, false);
  assert.equal(result.violations.find(row => row.code === 'blob-bytes').bytes, 65);
  assert.equal(result.violations[0].path, 'assets/큰 그림.bin');
});

test('internal sources are rejected using staged bytes, including renamed copies', async t => {
  const f = fixture(t);
  f.write('docs/public-copy.md', '<!-- synk:private -->\nInternal draft.\n');
  f.write('docs/_ops/NEXT/example.bin', 'internal');
  f.git(['add', '--', 'docs/public-copy.md', 'docs/_ops/NEXT/example.bin']);
  f.write('docs/public-copy.md', 'A sanitized unstaged replacement.\n');
  const result = await f.check();
  assert.equal(result.ok, false);
  assert.deepEqual(result.violations.map(x => x.code).sort(), ['internal-source-declaration', 'internal-source-path']);
});

test('a private document added then removed still blocks publication of its history', async t => {
  const f = fixture(t);
  const base = f.git(['rev-parse', 'HEAD']);
  f.write('notes.md', '<!-- synk:private -->\nPrivate fixture.\n');
  f.git(['add', '--', 'notes.md']);
  f.git(['commit', '-q', '-m', 'private fixture']);
  f.git(['rm', '-q', '--', 'notes.md']);
  f.git(['commit', '-q', '-m', 'remove fixture']);
  const result = await f.check({ base, head: 'HEAD' });
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].code, 'internal-source-declaration');
});

test('existing exposure does not block unrelated fixes or deleting its current copy', async t => {
  const f = fixture(t, {}, { 'docs/_ops/NEXT/old.md': 'Old fixture.\n' });
  f.write('source.js', 'module.exports = true;\n');
  f.git(['add', '--', 'source.js']);
  assert.equal((await f.check()).ok, true);
  f.git(['rm', '-q', '--', 'docs/_ops/NEXT/old.md']);
  assert.equal((await f.check()).ok, true);
});

test('a large historical document copied to a new name is still inspected', async t => {
  const marked = '<!-- synk:private -->\n' + 'internal fixture\n'.repeat(20);
  const f = fixture(t, { maxBlobBytes: 64, maxTotalBytes: 10000 }, { 'old.md': marked });
  f.write('new.md', marked);
  f.git(['add', '--', 'new.md']);
  const result = await f.check();
  assert.equal(result.newBlobs, 0, 'the copy is an already-known blob');
  assert.deepEqual(result.violations.map(x => x.code), ['internal-source-declaration']);
});

test('UTF-16 private markers and edits to an exposed document cannot republish it', async t => {
  const marked = '<!-- synk:private -->\nPrivate fixture.\n';
  const f = fixture(t, {}, { 'old.md': marked });
  f.write('old.md', marked + 'An edit.\n');
  f.write('le.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(marked, 'utf16le')]));
  f.write('be.html', Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(marked, 'utf16le').swap16()]));
  f.git(['add', '--', 'old.md', 'le.txt', 'be.html']);
  const result = await f.check();
  assert.deepEqual(result.violations.map(x => x.path).sort(), ['be.html', 'le.txt', 'old.md']);
  assert.ok(result.violations.every(x => x.code === 'internal-source-declaration'));
});

test('grandfathers unchanged large originals and permits ordinary runtime images', async t => {
  const f = fixture(t, { maxBlobBytes: 64, maxTotalBytes: 10000 }, { 'assets/original.png': Buffer.alloc(256, 3) });
  f.write('source.js', 'module.exports = true;\n');
  f.write('assets/runtime.png', Buffer.from([137, 80, 78, 71]));
  f.git(['add', '--', 'source.js', 'assets/runtime.png']);
  const result = await f.check();
  assert.equal(result.ok, true);
  assert.equal(result.newBlobs, 2);
});

test('finds a large blob added and removed in intermediate commits', async t => {
  const f = fixture(t, { maxBlobBytes: 64, maxTotalBytes: 10000 });
  const base = f.git(['rev-parse', 'HEAD']);
  f.write('one-time.bin', Buffer.alloc(65, 8));
  f.git(['add', '--', 'one-time.bin']);
  f.git(['commit', '-q', '-m', 'temporary large input']);
  f.git(['rm', '-q', '--', 'one-time.bin']);
  f.git(['commit', '-q', '-m', 'remove temporary input']);
  assert.equal(f.git(['diff', '--name-only', base, 'HEAD']), '');
  const result = await f.check({ base, head: 'HEAD' });
  assert.equal(result.ok, false);
  assert.equal(result.violations.find(row => row.code === 'blob-bytes').path, 'one-time.bin');
});

test('divergent range excludes a blob already reachable from the base', async t => {
  const f = fixture(t, { maxBlobBytes: 64, maxTotalBytes: 10000 });
  const common = f.git(['rev-parse', 'HEAD']);
  const original = Buffer.alloc(128, 3);
  f.write('assets/original.bin', original);
  f.write('base-only.txt', 'base only\n');
  f.git(['add', '--', 'assets/original.bin', 'base-only.txt']);
  f.git(['commit', '-q', '-m', 'base already contains original']);
  const base = f.git(['rev-parse', 'HEAD']);
  const knownBlob = f.git(['rev-parse', 'HEAD:assets/original.bin']);
  f.git(['checkout', '-q', '-b', 'independent-history', common]);
  f.write('assets/original.bin', original);
  const added = 'new source\n';
  f.write('head-only.txt', added);
  f.git(['add', '--', 'assets/original.bin', 'head-only.txt']);
  f.git(['commit', '-q', '-m', 'independent original and new source']);
  // A range walk can list this object even though it is reachable from base.
  assert.ok(f.git(['rev-list', '--objects', '--no-object-names', base + '..HEAD']).split('\n').includes(knownBlob));
  const result = await f.check({ base, head: 'HEAD' });
  assert.equal(result.ok, true);
  assert.equal(result.newBlobs, 1);
  assert.equal(result.countedBytes, Buffer.byteLength(added));
});

test('divergent range still checks new deleted blobs and aliases of existing bytes', async t => {
  const f = fixture(t, { maxBlobBytes: 64, maxTotalBytes: 10000 });
  const common = f.git(['rev-parse', 'HEAD']);
  f.write('assets/original.png', 'existing image');
  f.git(['add', '--', 'assets/original.png']);
  f.git(['commit', '-q', '-m', 'base image']);
  const base = f.git(['rev-parse', 'HEAD']);
  f.git(['checkout', '-q', '-b', 'independent-history', common]);
  f.write('assets/original.png', 'existing image');
  f.write('qa/copied.png', 'existing image');
  f.write('temporary.bin', Buffer.alloc(65, 8));
  f.git(['add', '--', 'assets/original.png', 'qa/copied.png', 'temporary.bin']);
  f.git(['commit', '-q', '-m', 'new oversized object and existing image alias']);
  f.git(['rm', '-q', '--', 'temporary.bin']);
  f.git(['commit', '-q', '-m', 'delete temporary object']);
  const result = await f.check({ base, head: 'HEAD' });
  assert.equal(result.ok, false);
  assert.equal(result.newBlobs, 1);
  assert.equal(result.countedBytes, 65);
  assert.ok(result.violations.some(row => row.code === 'blob-bytes' && row.path === 'temporary.bin'));
  assert.ok(result.violations.some(row => row.code === 'qa-image' && row.path === 'qa/copied.png'));
});

test('blocks forced-added QA captures and excluded binary outputs irrespective of size', async t => {
  const f = fixture(t, {}, { '.gitignore': '**/qa/*.png\n*.zip\n' });
  f.write('experiences/new/qa/한글 캡처.png', 'tiny capture');
  f.write('recovery.zip', 'tiny archive');
  f.git(['add', '-f', '--', 'experiences/new/qa/한글 캡처.png', 'recovery.zip']);
  const result = await f.check();
  assert.deepEqual(new Set(result.violations.map(row => row.code)), new Set(['qa-image', 'excluded-binary']));
});

test('honors alternate GIT_INDEX_FILE rather than the shared index', async t => {
  const f = fixture(t);
  const alternate = { GIT_INDEX_FILE: path.join(f.root, 'alternate.index') };
  f.git(['read-tree', 'HEAD'], alternate);
  f.write('qa/image.png', 'capture');
  f.git(['add', '--', 'qa/image.png'], alternate);
  assert.equal((await f.check()).ok, true);
  const result = await f.check({ cached: true }, alternate);
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].code, 'qa-image');
});

test('reads the staged policy and ignores unstaged relaxed rules', async t => {
  const f = fixture(t);
  f.write('qa/capture.png', 'capture');
  f.git(['add', '--', 'qa/capture.png']);
  f.write(POLICY_PATH, JSON.stringify({ ...f.policy, generatedImageDirectories: [] }));
  const result = await f.check();
  assert.equal(result.ok, false);
  assert.equal(result.policySource, 'index:' + POLICY_PATH);
});

test('invalid checked policy JSON fails closed even with bootstrap enabled', async t => {
  const f = fixture(t);
  f.write(POLICY_PATH, '{ invalid');
  f.git(['add', '--', POLICY_PATH]);
  await assert.rejects(f.check({ cached: true, bootstrapPolicy: true }), /Invalid policy JSON/);
});

test('missing policy needs explicit bootstrap, and range mode never bootstraps', async t => {
  const f = fixture(t);
  f.git(['rm', '-q', '--cached', POLICY_PATH]);
  await assert.rejects(f.check(), /has no tools\/git-storage-policy.json/);
  const result = await f.check({ cached: true, bootstrapPolicy: true });
  assert.equal(result.ok, true);
  assert.equal(result.policySource, 'bootstrap:tool-local-policy');
  assert.equal(result.warnings.length, 1);
  f.git(['commit', '-q', '-m', 'policy removed']);
  await assert.rejects(f.check({ base: 'HEAD~1', head: 'HEAD', bootstrapPolicy: true }), /has no tools\/git-storage-policy.json/);
});

test('accepts exact content-hash original exceptions and rejects changed bytes', async t => {
  const bytes = Buffer.alloc(65, 5), assetPath = 'approved/original.zip';
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const f = fixture(t, { maxBlobBytes: 64, maxTotalBytes: 64,
    exceptions: [{ path: assetPath, sha256, reason: 'Approved irreplaceable original' }] });
  f.write(assetPath, bytes);
  f.git(['add', '--', assetPath]);
  const accepted = await f.check();
  assert.equal(accepted.ok, true);
  assert.equal(accepted.exemptBlobs, 1);
  assert.equal(accepted.countedBytes, 0);
  f.write(assetPath, Buffer.alloc(65, 6));
  f.git(['add', '--', assetPath]);
  const rejected = await f.check();
  assert.equal(rejected.ok, false);
  assert.ok(rejected.violations.some(row => row.code === 'excluded-binary'));
  assert.ok(rejected.violations.some(row => row.code === 'blob-bytes'));
});

test('exception paths cannot use directory or filename wildcards', () => {
  assert.throws(() => validatePolicy({ ...structuredClone(POLICY), exceptions: [
    { path: 'assets/**', sha256: 'a'.repeat(64), reason: 'Approved original files' },
  ] }), /exact path/);
});

test('applies total budget to distinct new blobs, not duplicated content paths', async t => {
  const f = fixture(t, { maxBlobBytes: 64, maxTotalBytes: 100 });
  f.write('a.bin', Buffer.alloc(60, 1));
  f.write('copy-of-a.bin', Buffer.alloc(60, 1));
  f.git(['add', '--', 'a.bin', 'copy-of-a.bin']);
  const duplicate = await f.check();
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.newBlobs, 1);
  assert.equal(duplicate.countedBytes, 60);
  f.write('b.bin', Buffer.alloc(60, 2));
  f.git(['add', '--', 'b.bin']);
  const result = await f.check();
  assert.equal(result.ok, false);
  assert.equal(result.violations.find(row => row.code === 'total-bytes').bytes, 120);
});

test('runtime QA inputs bypass only generated-path policy, retaining size limits', async t => {
  const f = fixture(t, { maxBlobBytes: 64, maxTotalBytes: 10000 });
  const name = POLICY.generatedImageExceptions[0];
  f.write(name, Buffer.alloc(20, 7));
  f.git(['add', '--', name]);
  assert.equal((await f.check()).ok, true);
  f.write(name, Buffer.alloc(65, 7));
  f.git(['add', '--', name]);
  const result = await f.check();
  assert.deepEqual(result.violations.map(row => row.code), ['blob-bytes']);
});

test('range inspection detects a QA alias even if content already exists in base', async t => {
  const f = fixture(t, {}, { 'assets/runtime.png': 'same existing bytes' });
  const base = f.git(['rev-parse', 'HEAD']);
  f.write('qa/same.png', 'same existing bytes');
  f.git(['add', '--', 'qa/same.png']);
  f.git(['commit', '-q', '-m', 'copy existing bytes into QA']);
  const result = await f.check({ base, head: 'HEAD' });
  assert.equal(result.newBlobs, 0);
  assert.equal(result.violations[0].code, 'qa-image');
});

test('index mode works on detached HEAD and an unborn repository', async t => {
  const f = fixture(t);
  f.git(['checkout', '-q', '--detach', 'HEAD']);
  f.write('detached.txt', 'ok');
  f.git(['add', '--', 'detached.txt']);
  assert.equal((await f.check()).ok, true);
  const initial = fixture(t, {}, {}, true);
  const result = await initial.check();
  assert.equal(result.ok, true);
  assert.equal(result.base, null);
  assert.equal(result.newBlobs, 1);
});

test('a missing staged Git blob is an inspection failure, never a pass', async t => {
  const f = fixture(t);
  f.git(['update-index', '--add', '--cacheinfo', '100644,' + '1'.repeat(40) + ',missing.bin']);
  await assert.rejects(f.check(), /Missing or invalid Git object/);
});

test('CLI exits distinctly for violations and invalid requests', t => {
  const f = fixture(t);
  f.write('qa/image.png', 'capture');
  f.git(['add', '--', 'qa/image.png']);
  const failed = spawnSync(process.execPath, [SCRIPT, '--cached', '--json'], {
    cwd: f.root, env: f.env, encoding: 'utf8', windowsHide: true,
  });
  assert.equal(failed.status, 1);
  assert.equal(JSON.parse(failed.stdout).ok, false);
  const invalid = spawnSync(process.execPath, [SCRIPT, '--base', 'HEAD', '--head', 'missing-ref', '--json'], {
    cwd: f.root, env: f.env, encoding: 'utf8', windowsHide: true,
  });
  assert.equal(invalid.status, 2);
  assert.ok(JSON.parse(invalid.stdout).error);
});

test('blocks only correction outputs, preserving originals, masks and the canonical 4K directory', async t => {
  const f = fixture(t);
  const blocked = [];
  for (const { directory } of POLICY.derivedImageRules) {
    for (const filename of ['까몽_4K.png', '마린_480.png']) {
      const name = `${directory}/${filename}`;
      f.write(name, 'derived output');
      blocked.push(name);
    }
    for (const filename of ['원본_까몽_4K.png', '이전_마린_480.png', '몽글_생성원본_4K.png', '표정_마스크_480.png']) {
      f.write(`${directory}/${filename}`, 'preserved input');
    }
  }
  f.write('docs/캐릭터/정본_4K/까몽_4K.png', 'approved canonical input');
  f.git(['add', '--all']);
  const result = await f.check();
  assert.equal(result.ok, false);
  assert.deepEqual(result.violations.map(row => row.path).sort(), blocked.sort());
  assert.ok(result.violations.every(row => row.code === 'derived-image'));
});

test('partial clones fail closed by default and can explicitly fetch missing intermediate blobs', async t => {
  const f = fixture(t, { maxBlobBytes: 64, maxTotalBytes: 10000 });
  const base = f.git(['rev-parse', 'HEAD']);
  f.write('temporary.bin', Buffer.alloc(65, 9));
  f.git(['add', '--', 'temporary.bin']);
  f.git(['commit', '-q', '-m', 'large intermediate object']);
  const blob = f.git(['rev-parse', 'HEAD:temporary.bin']);
  f.git(['rm', '-q', '--', 'temporary.bin']);
  f.git(['commit', '-q', '-m', 'delete intermediate object']);
  f.git(['config', 'uploadpack.allowFilter', 'true']);
  f.git(['config', 'uploadpack.allowAnySHA1InWant', 'true']);
  const clone = path.join(f.root, 'partial-consumer');
  execFileSync('git', ['-c', 'protocol.file.allow=always', 'clone', '-q', '--no-local', '--no-checkout', '--filter=blob:none',
    pathToFileURL(f.root).href, clone], { env: f.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  // Prepare the current policy only, leaving the deleted intermediate blob absent.
  execFileSync('git', ['-C', clone, 'cat-file', 'blob', 'HEAD:' + POLICY_PATH], {
    env: { ...f.env, GIT_NO_LAZY_FETCH: '0' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const before = spawnSync('git', ['-C', clone, 'cat-file', '-e', blob], {
    env: { ...f.env, GIT_NO_LAZY_FETCH: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.notEqual(before.status, 0);
  await assert.rejects(checkRepository({ base, head: 'HEAD' }, clone, f.env), /Missing or invalid Git object|Git inspection failed/);
  const result = spawnSync(process.execPath, [SCRIPT, '--base', base, '--head', 'HEAD', '--allow-lazy-fetch', '--json'], {
    cwd: clone, env: f.env, encoding: 'utf8', windowsHide: true,
  });
  assert.equal(result.status, 1, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.allowLazyFetch, true);
  assert.ok(report.violations.some(row => row.code === 'blob-bytes' && row.path === 'temporary.bin'));
  assert.equal(spawnSync('git', ['-C', clone, 'cat-file', '-e', blob], {
    env: { ...f.env, GIT_NO_LAZY_FETCH: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  }).status, 0);
});

test('partial clone range check does not download blobs that only the base history has', async t => {
  const f = fixture(t, { maxBlobBytes: 4096, maxTotalBytes: 100000 });
  const history = [];
  for (let i = 0; i < 3; i++) {
    f.write('notes/history.txt', `base history ${i}\n`);
    f.git(['add', '--', 'notes/history.txt']);
    f.git(['commit', '-q', '-m', `base history ${i}`]);
    history.push(f.git(['rev-parse', 'HEAD:notes/history.txt']));
  }
  const base = f.git(['rev-parse', 'HEAD']);
  f.write('new.txt', 'new source\n');
  f.git(['add', '--', 'new.txt']);
  f.git(['commit', '-q', '-m', 'new source']);
  f.git(['config', 'uploadpack.allowFilter', 'true']);
  f.git(['config', 'uploadpack.allowAnySHA1InWant', 'true']);
  const clone = path.join(f.root, 'partial-consumer');
  execFileSync('git', ['-c', 'protocol.file.allow=always', 'clone', '-q', '--no-local', '--no-checkout', '--filter=blob:none',
    pathToFileURL(f.root).href, clone], { env: f.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const present = oid => spawnSync('git', ['-C', clone, 'cat-file', '-e', oid], {
    env: { ...f.env, GIT_NO_LAZY_FETCH: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  }).status === 0;
  // CI checks out blob:none. Listing base-history blobs there downloaded them one by one until the Git timeout (10-19).
  const older = history.slice(0, -1);
  assert.ok(older.every(oid => !present(oid)));
  const result = await checkRepository({ base, head: 'HEAD', allowLazyFetch: true }, clone, f.env);
  assert.equal(result.ok, true);
  assert.equal(result.newBlobs, 1);
  assert.ok(older.every(oid => !present(oid)), 'blobs only in the base history must stay missing');
});
