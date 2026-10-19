'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Readable } = require('node:stream');
const { createBundle, preserveRecord, BundleInspector, fileDigest, verifyDriveCoverage, selection, isolatedBundleRepository, archiveRefs } = require('../tools/Git보관묶음.cjs');
const { reconcileEncryptedArchives, onlyArchiveTransferPending, deferNewSinceApply } = require('../tools/GitHub백업.cjs');
const cryptoPath = path.join(os.homedir(), 'Documents/SYNK_원본창고/암호.js');
const crypt = fs.existsSync(cryptoPath) ? require(cryptoPath) : null;
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-bundle-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), restore = path.join(root, 'restore');
  function git(args, cwd = source, input) { return execFileSync('git', args, { cwd, input, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); }
  git(['init', '-b', 'main', source], root);
  git(['config', 'user.name', 'Synthetic restore']); git(['config', 'user.email', 'test@example.invalid']);
  fs.writeFileSync(path.join(source, 'README.md'), '# remote base\n');
  git(['add', '.']); git(['commit', '-m', 'base']);
  const base = git(['rev-parse', 'HEAD']).toString().trim();
  git(['clone', source, restore], root);
  git(['switch', '-c', 'archive-source']);
  fs.writeFileSync(path.join(source, 'history.bin'), crypto.randomBytes(200000));
  git(['add', '.']); git(['commit', '-m', 'history']);
  const head = git(['rev-parse', 'HEAD']).toString().trim();
  return { root, source, restore, git, base, head };
}
test('stdout bundle is encrypted, header and pack validated, and fixture history restores exactly', { skip: !crypt && 'local archive encryption module unavailable' }, async t => {
  const f = fixture(t), keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pubPem = keys.publicKey.export({ type: 'spki', format: 'pem' });
  const encrypted = path.join(f.root, 'only-encrypted.enc');
  const heads = [{ ref: 'refs/heads/archive-source', sha: f.head }];
  let headerCalled = false;
  const receipt = await createBundle({ repo: f.source, heads, exclusions: [f.base], pubPem,
    encryptStream: crypt.encryptStream, staging: encrypted, onHeader(inspector) {
      assert.deepEqual(inspector.prerequisites, [f.base]); headerCalled = true;
    } });
  assert.equal(headerCalled, true); assert.equal(receipt.headerVerified, true);
  assert.deepEqual(receipt.heads, heads); assert.ok(receipt.pack.objects > 0);
  assert.equal(fs.existsSync(path.join(f.root, 'history.bundle')), false);
  // Only synthetic test data is decrypted. Production never requests or unlocks the private key.
  const bundle = path.join(f.root, 'synthetic-restored.bundle');
  const decrypted = await crypt.decryptFile(keys.privateKey, encrypted, bundle);
  assert.equal(decrypted.sha256, receipt.plaintext.sha256);
  assert.equal((await fileDigest(bundle)).bytes, receipt.plaintext.bytes);
  f.git(['bundle', 'verify', bundle], f.restore);
  f.git(['fetch', bundle, 'refs/heads/archive-source:refs/heads/recovered'], f.restore);
  assert.equal(f.git(['rev-parse', 'recovered'], f.restore).toString().trim(), f.head);
  assert.deepEqual(f.git(['show', 'recovered:history.bin'], f.restore), fs.readFileSync(path.join(f.source, 'history.bin')));
  assert.equal(f.git(['rev-parse', 'main'], f.restore).toString().trim(), f.base);
});
test('bundle inspection rejects a changed head and a damaged pack checksum', async t => {
  const f = fixture(t), heads = [{ ref: 'refs/heads/archive-source', sha: f.head }];
  const body = f.git(['bundle', 'create', '--version=2', '-', 'refs/heads/archive-source', '^' + f.base]);
  async function inspect(data, expected) {
    const inspector = new BundleInspector(expected); Readable.from([data]).pipe(inspector);
    for await (const chunk of inspector) void chunk;
  }
  await assert.rejects(inspect(body, [{ ...heads[0], sha: f.base }]), /BUNDLE_SOURCE_REF_MOVED/);
  const damaged = Buffer.from(body); damaged[damaged.length - 1] ^= 1;
  await assert.rejects(inspect(damaged, heads), /BUNDLE_PACK_CHECKSUM_FAILED/);
});
test('fallback requires recent remote evidence for both exact archive and manifest bytes', async t => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'git-archive-coverage-'));
  t.after(() => fs.rmSync(vault, { recursive: true, force: true }));
  const now = Date.now(), paths = ['fixture/history.bundle.enc', 'fixture/history.manifest.json'];
  const receipt = { relativePath: paths[0], manifestRelativePath: paths[1], finishedAt: new Date(now - 10000).toISOString() };
  const rows = [];
  for (const relative of paths) {
    const file = path.join(vault, 'Git-보관', relative); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'synthetic content ' + relative);
    const digest = await fileDigest(file);
    rows.push({ path: relative, id: 'synthetic-' + rows.length, ...digest, ownedByMe: true,
      trashed: false, remoteMd5: digest.md5, remoteSha256: digest.sha256 });
  }
  const evidence = { group: 'Git-보관', status: 'success', account: '77yuhbs@gmail.com', checkedAt: new Date(now).toISOString(),
    missing_or_bad: 0, historicalBad: 0, verifiedFiles: rows };
  assert.equal((await verifyDriveCoverage(receipt, vault, { now, verification: evidence })).ok, true);
  assert.equal((await verifyDriveCoverage(receipt, vault, { now, verification: {} })).code, 'GIT_ARCHIVE_AWAITING_DRIVE');
  assert.equal((await verifyDriveCoverage(receipt, vault, { now, verification: { ...evidence,
    account: 'other@example.invalid' } })).code, 'GIT_ARCHIVE_DRIVE_EVIDENCE_INVALID');
  assert.equal((await verifyDriveCoverage(receipt, vault, { now, verification: { ...evidence,
    status: 'failed' } })).code, 'GIT_ARCHIVE_DRIVE_VERIFICATION_FAILED');
  assert.equal((await verifyDriveCoverage(receipt, vault, { now, verification: { ...evidence,
    missing_or_bad: 1 } })).code, 'GIT_ARCHIVE_DRIVE_FILE_MISMATCH');
  for (const change of [{ checkedAt: new Date(now - 37 * 3600000).toISOString() }, { account: 'other@example.invalid' },
    { verifiedFiles: [rows[0]] }, { verifiedFiles: [{ ...rows[0], trashed: true }, rows[1]] },
    { verifiedFiles: [{ ...rows[0], remoteMd5: '0'.repeat(32) }, rows[1]] }, { status: 'failed' }])
    assert.equal((await verifyDriveCoverage(receipt, vault, { now, verification: { ...evidence, ...change } })).ok, false);
  fs.appendFileSync(path.join(vault, 'Git-보관', paths[1]), 'changed after verification');
  assert.equal((await verifyDriveCoverage(receipt, vault, { now, verification: evidence })).ok, false);
});
test('detached commits bundle from isolated refs without changing any original ref, HEAD, index, or files', { skip: !crypt && 'local archive encryption module unavailable' }, async t => {
  const f = fixture(t), keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  f.git(['switch', '--detach', f.head]); f.git(['branch', '-D', 'archive-source']);
  const beforeRefs = f.git(['show-ref']).toString(), beforeHead = f.git(['rev-parse', 'HEAD']).toString();
  const beforeIndex = fs.readFileSync(path.join(f.source, '.git', 'index'));
  const beforeFile = fs.readFileSync(path.join(f.source, 'history.bin'));
  const record = { name: 'fixture', repository: 'unmet23-lab/fixture', refs: [{ sha: f.head,
    status: 'blocked-by-content-policy', sourceRefs: ['refs/detached-current-head', 'refs/detached-worktree/' + f.head] }] };
  const selected = selection(record, f.root);
  assert.equal(selected.heads.length, 1); assert.equal(selected.sourceMappings.length, 2);
  const isolated = isolatedBundleRepository(f.source, selected.heads, path.join(f.root, 'staging'));
  const enc = path.join(f.root, 'detached.enc'), restored = path.join(f.root, 'detached.bundle');
  try {
    const receipt = await createBundle({ repo: isolated.path, heads: selected.heads, exclusions: [f.base],
      pubPem: keys.publicKey.export({ type: 'spki', format: 'pem' }), encryptStream: crypt.encryptStream, staging: enc });
    await crypt.decryptFile(keys.privateKey, enc, restored);
    f.git(['bundle', 'verify', restored], f.restore);
    f.git(['fetch', restored, selected.heads[0].ref + ':refs/heads/recovered-detached'], f.restore);
    assert.equal(f.git(['rev-parse', 'recovered-detached'], f.restore).toString().trim(), f.head);
    assert.equal(receipt.heads[0].sha, f.head);
  } finally { isolated.cleanup(); }
  assert.equal(fs.existsSync(isolated.path), false);
  assert.equal(f.git(['show-ref']).toString(), beforeRefs);
  assert.equal(f.git(['rev-parse', 'HEAD']).toString(), beforeHead);
  assert.deepEqual(fs.readFileSync(path.join(f.source, '.git', 'index')), beforeIndex);
  assert.deepEqual(fs.readFileSync(path.join(f.source, 'history.bin')), beforeFile);
});
test('public unpublished heads, stash, and detached history archive without a remote write and restore into an empty repository',
  { skip: !crypt && 'local archive encryption module unavailable' }, async t => {
  const f = fixture(t), remote = path.join(f.root, 'public.git'), empty = path.join(f.root, 'empty.git');
  f.git(['init', '--bare', remote], f.root); f.git(['remote', 'add', 'origin', remote]);
  f.git(['push', 'origin', 'main']); // Synthetic setup represents already-public history.
  f.git(['update-ref', 'refs/stash', f.head]); f.git(['switch', '--detach', f.head]);
  const beforeRemote = f.git(['show-ref'], remote).toString(), beforeLocal = f.git(['show-ref']).toString();
  const beforeIndex = fs.readFileSync(path.join(f.source, '.git', 'index'));
  const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), pub = path.join(f.root, 'public.pem');
  fs.writeFileSync(pub, keys.publicKey.export({ type: 'spki', format: 'pem' }));
  const calls = [], record = { name: 'public-fixture', path: f.source, repository: 'unmet23-lab/public-fixture', private: false,
    refs: [{ sha: f.head, status: 'public-origin-unpublished', sourceRefs: ['refs/heads/archive-source', 'refs/stash', 'refs/detached-current-head'] }] };
  const dependencies = { github: { private: false, full_name: record.repository }, git(args, input) {
    calls.push(args);
    if (args[0] === 'remote' && args[1] === 'get-url') return Buffer.from('git@github.com:unmet23-lab/public-fixture.git\n');
    return f.git(args, f.source, input);
  } };
  const cryptoTool = { PUB: () => pub, encryptStream: crypt.encryptStream };
  const receipt = await preserveRecord(record, f.root, cryptoTool, () => {}, dependencies);
  assert.equal(receipt.selfContained, true); assert.equal(receipt.remoteWrites, false);
  assert.deepEqual(receipt.requiredCommits, []); assert.deepEqual(receipt.prerequisites, []);
  assert.equal(receipt.heads.length, 3); assert.equal(calls.some(args => args[0] === 'push'), false);
  assert.equal((await verifyDriveCoverage(receipt, f.root)).code, 'GIT_ARCHIVE_AWAITING_DRIVE');
  const again = await preserveRecord(record, f.root, cryptoTool, () => {}, dependencies);
  assert.equal(again.reused, true); assert.equal(again.encrypted.sha256, receipt.encrypted.sha256);
  const report = { repositories: [record] }, state = path.join(f.root, 'github-backup-status.json');
  await reconcileEncryptedArchives(report, state, false);
  assert.equal(record.status, 'attention'); assert.equal(record.refs[0].fallback.code, 'GIT_ARCHIVE_AWAITING_DRIVE');
  assert.equal(onlyArchiveTransferPending({ ...report, archiveTransfer: { status: 'running', active: true, enabled: true },
    issues: [{ code: record.refs[0].fallback.code }] }), true);
  const verification = path.join(f.root, '상태', 'Git-보관', 'verify-status.json'), verifiedFiles = [];
  for (const relative of [receipt.relativePath, receipt.manifestRelativePath]) {
    const digest = await fileDigest(path.join(f.root, 'Git-보관', relative));
    verifiedFiles.push({ path: relative, id: 'synthetic-' + verifiedFiles.length, ...digest,
      ownedByMe: true, trashed: false, remoteMd5: digest.md5, remoteSha256: digest.sha256 });
  }
  fs.mkdirSync(path.dirname(verification), { recursive: true });
  fs.writeFileSync(verification, JSON.stringify({ status: 'success', group: 'Git-보관', account: '77yuhbs@gmail.com',
    checkedAt: new Date().toISOString(), missing_or_bad: 0, historicalBad: 0, verifiedFiles }));
  await reconcileEncryptedArchives(report, state, false);
  assert.equal(record.status, 'success'); assert.equal(record.refs[0].status, 'encrypted-drive-verified');
  const restored = path.join(f.root, 'public-restored.bundle');
  await crypt.decryptFile(keys.privateKey, receipt.filePath, restored);
  f.git(['init', '--bare', empty], f.root); f.git(['bundle', 'verify', restored], empty);
  for (let i = 0; i < receipt.heads.length; i++) {
    const head = receipt.heads[i], target = 'refs/heads/recovered-' + i;
    f.git(['fetch', restored, head.ref + ':' + target], empty);
    assert.equal(f.git(['rev-parse', target], empty).toString().trim(), f.head);
    assert.deepEqual(f.git(['show', target + ':history.bin'], empty), fs.readFileSync(path.join(f.source, 'history.bin')));
  }
  assert.equal(f.git(['show-ref'], remote).toString(), beforeRemote);
  assert.equal(f.git(['show-ref']).toString(), beforeLocal);
  assert.deepEqual(fs.readFileSync(path.join(f.source, '.git', 'index')), beforeIndex);
  assert.equal(archiveRefs({ private: false, refs: [] }).length, 0);
});

test('a new branch name on a bundled commit stays covered by the last verified bundle; a newer commit waits for the next apply',
  { skip: !crypt && 'local archive encryption module unavailable' }, async t => {
  const f = fixture(t), keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), pub = path.join(f.root, 'public.pem');
  fs.writeFileSync(pub, keys.publicKey.export({ type: 'spki', format: 'pem' }));
  const remote = path.join(f.root, 'public.git');
  f.git(['init', '--bare', remote], f.root); f.git(['remote', 'add', 'origin', remote]); f.git(['push', 'origin', 'main']);
  const record = { name: 'public-fixture', path: f.source, repository: 'unmet23-lab/public-fixture', private: false,
    refs: [{ sha: f.head, status: 'public-origin-unpublished', sourceRefs: ['refs/heads/archive-source'] }] };
  const dependencies = { github: { private: false, full_name: record.repository }, git(args, input) {
    if (args[0] === 'remote' && args[1] === 'get-url') return Buffer.from('git@github.com:unmet23-lab/public-fixture.git\n');
    return f.git(args, f.source, input);
  } };
  const receipt = await preserveRecord(record, f.root, { PUB: () => pub, encryptStream: crypt.encryptStream }, () => {}, dependencies);
  fs.writeFileSync(path.join(f.root, 'git-bundle-status.json'), JSON.stringify({ status: 'awaiting-drive-verification', bundles: [receipt] }));
  const verifiedFiles = [];
  for (const relative of [receipt.relativePath, receipt.manifestRelativePath]) {
    const digest = await fileDigest(path.join(f.root, 'Git-보관', relative));
    verifiedFiles.push({ path: relative, id: 'synthetic-' + verifiedFiles.length, ...digest, ownedByMe: true, trashed: false,
      remoteMd5: digest.md5, remoteSha256: digest.sha256 });
  }
  const verification = path.join(f.root, '상태', 'Git-보관', 'verify-status.json');
  fs.mkdirSync(path.dirname(verification), { recursive: true });
  fs.writeFileSync(verification, JSON.stringify({ status: 'success', group: 'Git-보관', account: '77yuhbs@gmail.com',
    checkedAt: new Date().toISOString(), missing_or_bad: 0, historicalBad: 0, verifiedFiles }));
  f.git(['branch', 'renamed-copy', f.head]); f.git(['switch', '-c', 'later-work']);
  fs.writeFileSync(path.join(f.source, 'later.md'), '# later\n'); f.git(['add', 'later.md']); f.git(['commit', '-m', 'later']);
  const later = f.git(['rev-parse', 'HEAD']).toString().trim();
  const current = { ...record, refs: [
    { sha: f.head, status: 'public-origin-unpublished', sourceRefs: ['refs/heads/archive-source', 'refs/heads/renamed-copy'] },
    { sha: later, status: 'public-origin-unpublished', sourceRefs: ['refs/heads/later-work'] }] };
  const report = { repositories: [current] }, state = path.join(f.root, 'github-backup-status.json');
  await reconcileEncryptedArchives(report, state, false);
  assert.equal(current.refs[0].status, 'encrypted-drive-verified'); assert.equal(current.refs[0].fallback.earlierSelection, true);
  assert.equal(current.refs[1].fallback.code, 'GIT_ARCHIVE_NOT_CREATED'); assert.equal(current.status, 'attention');
  const strict = JSON.parse(JSON.stringify(report));
  deferNewSinceApply(strict, { heads: { 'public-fixture': [f.head, later] } });
  assert.equal(strict.repositories[0].status, 'attention');
  assert.equal(deferNewSinceApply(report, { heads: { 'public-fixture': [f.head] } }), 1);
  assert.equal(current.refs[1].status, 'awaiting-next-apply'); assert.equal(current.status, 'success');
  fs.appendFileSync(receipt.filePath, Buffer.from([0]));
  const damaged = { repositories: [{ ...current, refs: [{ sha: f.head, status: 'public-origin-unpublished', sourceRefs: ['refs/heads/renamed-copy'] }] }] };
  await reconcileEncryptedArchives(damaged, state, false);
  assert.equal(damaged.repositories[0].refs[0].status, 'public-origin-unpublished');
});

test('a branch that moves after the scan still bundles the scanned commit without touching the original refs (10-19)',
  { skip: !crypt && 'local archive encryption module unavailable' }, async t => {
  const f = fixture(t), keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), pub = path.join(f.root, 'public.pem');
  fs.writeFileSync(pub, keys.publicKey.export({ type: 'spki', format: 'pem' }));
  const remote = path.join(f.root, 'public.git');
  f.git(['init', '--bare', remote], f.root); f.git(['remote', 'add', 'origin', remote]); f.git(['push', 'origin', 'main']);
  const record = { name: 'public-fixture', path: f.source, repository: 'unmet23-lab/public-fixture', private: false,
    refs: [{ sha: f.head, status: 'public-origin-unpublished', sourceRefs: ['refs/heads/archive-source'] }] };
  // 훑은 뒤 묶기 전에 다른 세션이 같은 가지에 커밋한 경우(10-19 18:10·18:20 적용 실행이 이 경쟁으로 묶음을 못 만들었다).
  fs.writeFileSync(path.join(f.source, 'moved.md'), '# moved after the scan\n'); f.git(['add', 'moved.md']); f.git(['commit', '-m', 'moved']);
  const moved = f.git(['rev-parse', 'HEAD']).toString().trim(), beforeRefs = f.git(['show-ref']).toString();
  const dependencies = { github: { private: false, full_name: record.repository }, git(args, input) {
    if (args[0] === 'remote' && args[1] === 'get-url') return Buffer.from('git@github.com:unmet23-lab/public-fixture.git\n');
    return f.git(args, f.source, input);
  } };
  const receipt = await preserveRecord(record, f.root, { PUB: () => pub, encryptStream: crypt.encryptStream }, () => {}, dependencies);
  assert.deepEqual(receipt.heads, [{ ref: 'refs/heads/archive-source', sha: f.head }]);
  assert.equal(f.git(['rev-parse', 'archive-source']).toString().trim(), moved, 'the live branch keeps its newer commit');
  assert.equal(f.git(['show-ref']).toString(), beforeRefs);
  assert.deepEqual(fs.readdirSync(path.join(f.root, '.git-bundle-staging')), [], 'the pinned temporary repository is removed');
  const restored = path.join(f.root, 'moved-restored.bundle'), empty = path.join(f.root, 'empty.git');
  await crypt.decryptFile(keys.privateKey, receipt.filePath, restored);
  f.git(['init', '--bare', empty], f.root); f.git(['bundle', 'verify', restored], empty);
  f.git(['fetch', restored, 'refs/heads/archive-source:refs/heads/recovered'], empty);
  assert.equal(f.git(['rev-parse', 'recovered'], empty).toString().trim(), f.head);
});
