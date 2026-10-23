'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const policy = require('../tools/이어하기꾸러미.js');
const backup = require('../tools/onedrive-backup.cjs');
const { sourceLocation, preserveSource, receiptPaths, reconcile } = require('../tools/보호소스보관.cjs');
const { fileDigest, verifyDriveCoverage } = require('../tools/Git보관묶음.cjs');
const cryptFile = path.join(os.homedir(), 'Documents/SYNK_원본창고/암호.js');
const crypt = fs.existsSync(cryptFile) ? require(cryptFile) : null;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'large-receipt-test-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('large-receipt-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const vault = path.join(root, 'SYNK_원본창고'), source = '상태/Documents/upload-done.jsonl';
  const sourcePath = path.join(vault, source), target = path.join(root, 'onedrive', source);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true }); fs.mkdirSync(path.dirname(target), { recursive: true });
  const original = Buffer.from('{"ok":true}\n'.repeat(Math.ceil((policy.MAX_TEXT_BYTES + 1) / 12)));
  const safe = Buffer.from('{"ok":true}\n'); fs.writeFileSync(sourcePath, original); fs.writeFileSync(target, safe);
  const prior = { source: sourcePath, target, expectedBytes: safe.length, sha256: sha(safe), protectedSource: 'over-10MiB' };
  const row = { sourceScope: 'SYNK_원본창고', sourceRoot: vault, sourcePath, source, reason: 'over-10MiB',
    ...await fileDigest(sourcePath), priorOneDriveCopy: { target, bytes: safe.length, sha256: sha(safe) } };
  const put = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };
  put(path.join(vault, '상태/OneDrive/copy-manifest.json'), { oneDriveRoot: path.join(root, 'onedrive'), files: [prior] });
  put(path.join(vault, '상태/OneDrive/protected-sources.json'), { status: 'success', checkedAt: new Date().toISOString(), files: [row] });
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), pub = path.join(root, 'public.pem');
  fs.writeFileSync(pub, pair.publicKey.export({ type: 'spki', format: 'pem' }));
  const options = { vault, roots: [{ scope: 'SYNK_원본창고', root: vault }], linked: () => false,
    cryptoTool: crypt && { ...crypt, PUB: () => pub }, apply: true };
  return { root, vault, row, prior, target, original, safe, put, pair, options };
}

test('large upload receipt stays outside plaintext and enters inventory only with exact vault path and prior copy', async t => {
  const f = await fixture(t), scopes = [{ name: 'SYNK_원본창고', root: f.vault }];
  assert.equal(policy.textPolicy(f.row.source, f.original), 'over-10MiB');
  const inventory = backup.protectedSourceInventory(f.root, f.vault, scopes, [f.row], [f.prior]);
  assert.equal(inventory.files.length, 1); assert.equal(inventory.files[0].sha256, sha(f.original));
  assert.deepEqual(inventory.files[0].priorOneDriveCopy, f.row.priorOneDriveCopy);
  assert.equal(backup.protectedSourceInventory(f.root, f.vault, scopes, [f.row], []).files.length, 0);
  assert.equal(backup.protectedSourceInventory(f.root, path.join(f.root, 'other'), scopes, [f.row], [f.prior]).files.length, 0);
  for (const source of ['상태/Other/upload-done.jsonl', '상태/Documents/other.jsonl', '상태/Documents/../Documents/upload-done.jsonl'])
    assert.equal(policy.largeBackupReceipt('SYNK_원본창고', source, f.original.length), false);
  assert.equal(policy.largeBackupReceipt('SYNK-appsscript', f.row.source, f.original.length), false);
  assert.equal(policy.largeBackupReceipt(f.row.sourceScope, f.row.source, policy.MAX_ENCRYPTED_RECEIPT_BYTES + 1), false);
  fs.truncateSync(f.row.sourcePath, policy.MAX_ENCRYPTED_RECEIPT_BYTES + 1);
  assert.throws(() => backup.protectedSourceInventory(f.root, f.vault, scopes, [f.row], [f.prior]), /size-limit/);
  assert.deepEqual(fs.readFileSync(f.target), f.safe);
});

test('large upload receipt requires current exact remote source proof for OneDrive coverage', async t => {
  const f = await fixture(t), file = path.join(f.vault, 'protected-source-backup-status.json');
  const proof = { files: [{ ...f.row, status: 'encrypted-drive-verified', coverage: { ok: true,
    account: '77yuhbs@gmail.com', checkedAt: new Date().toISOString(), files: [{ id: 'fixture-id', bytes: 100, sha256: 'a'.repeat(64) }] } }] };
  assert.equal(backup.encryptedProtectionCoverage(f.vault, [f.prior])[0].preservedBy, 'unconfirmed');
  f.put(file, proof); assert.equal(backup.encryptedProtectionCoverage(f.vault, [f.prior])[0].preservedBy, 'encrypted-drive');
  proof.files[0].sha256 = 'b'.repeat(64); f.put(file, proof);
  assert.equal(backup.encryptedProtectionCoverage(f.vault, [f.prior])[0].preservedBy, 'unconfirmed');
  proof.files[0].sha256 = f.row.sha256; proof.files[0].coverage.checkedAt = new Date(Date.now() - 37 * 3600000).toISOString(); f.put(file, proof);
  assert.equal(backup.encryptedProtectionCoverage(f.vault, [f.prior])[0].preservedBy, 'unconfirmed');
  proof.files[0].coverage.checkedAt = new Date().toISOString(); proof.files[0].coverage.ok = false; f.put(file, proof);
  assert.equal(backup.encryptedProtectionCoverage(f.vault, [f.prior])[0].preservedBy, 'unconfirmed');
  assert.deepEqual(fs.readFileSync(f.target), f.safe);
});

test('large upload receipt encrypts exact bytes and rejects remote checksum mismatch and unsafe prior copies', { skip: !crypt }, async t => {
  const f = await fixture(t);
  assert.throws(() => sourceLocation({ ...f.row, sourceScope: 'fixture' }, f.options.roots), /INVENTORY_INVALID/);
  assert.throws(() => sourceLocation({ ...f.row, sourceRoot: f.root }, f.options.roots), /SCOPE_MISMATCH/);
  assert.throws(() => sourceLocation({ ...f.row, bytes: policy.MAX_ENCRYPTED_RECEIPT_BYTES + 1 }, f.options.roots), /INVENTORY_INVALID/);
  assert.throws(() => sourceLocation({ ...f.row, priorOneDriveCopy: undefined }, f.options.roots), /INVENTORY_INVALID/);
  await assert.rejects(preserveSource({ ...f.row, priorOneDriveCopy: { ...f.row.priorOneDriveCopy,
    target: path.join(f.root, 'different-copy.jsonl') } }, f.options), /PRIOR_COPY_UNCONFIRMED/);
  const receipt = await preserveSource(f.row, f.options), restored = path.join(f.root, 'restored.jsonl');
  await crypt.decryptFile(f.pair.privateKey, receipt.filePath, restored);
  assert.deepEqual(await fileDigest(restored), await fileDigest(f.row.sourcePath));
  assert.equal(sha(fs.readFileSync(restored)), sha(f.original)); assert.deepEqual(fs.readFileSync(f.target), f.safe);
  const verifiedFiles = [];
  for (const relative of [receipt.relativePath, receipt.manifestRelativePath]) {
    const digest = await fileDigest(path.join(f.vault, 'Git-보관', relative));
    verifiedFiles.push({ path: relative, id: 'fixture-' + verifiedFiles.length, ...digest, ownedByMe: true,
      trashed: false, remoteMd5: digest.md5, remoteSha256: digest.sha256 });
  }
  const verification = { group: 'Git-보관', status: 'success', account: '77yuhbs@gmail.com', checkedAt: new Date().toISOString(),
    missing_or_bad: 0, historicalBad: 0, verifiedFiles };
  assert.equal((await verifyDriveCoverage(receipt, f.vault, { verification })).ok, true);
  verifiedFiles[0].remoteSha256 = 'b'.repeat(64);
  assert.equal((await verifyDriveCoverage(receipt, f.vault, { verification })).ok, false);
  fs.writeFileSync(f.target, '{"ok":false}\n');
  await assert.rejects(preserveSource(f.row, f.options), /PRIOR_COPY_CHANGED/);
  fs.writeFileSync(f.target, f.safe); fs.appendFileSync(f.row.sourcePath, '{"new":true}\n');
  await assert.rejects(preserveSource(f.row, f.options), /INVENTORY_STALE/);
  assert.deepEqual(fs.readFileSync(f.target), f.safe);
});

test('changed large receipt is reclassified and encrypted; concurrent edits and size overflow fail closed', { skip: !crypt }, async t => {
  const f = await fixture(t); fs.appendFileSync(f.row.sourcePath, '{"next":true}\n');
  const current = await fileDigest(f.row.sourcePath);
  const result = await reconcile({ ...f.options, root: f.root });
  assert.equal(result.files[0].sha256, current.sha256); assert.equal(result.files[0].status, 'awaiting-drive-verification');
  assert.equal(fs.existsSync(receiptPaths(f.row, f.vault).file), false);
  const next = { ...f.row, ...current }; fs.appendFileSync(f.row.sourcePath, '{"later":true}\n');
  const changing = { ...next, ...await fileDigest(f.row.sourcePath) };
  const cryptoTool = { ...f.options.cryptoTool, async encryptStream(...args) {
    const value = await crypt.encryptStream(...args); fs.appendFileSync(f.row.sourcePath, '{"concurrent":true}\n'); return value;
  } };
  await assert.rejects(preserveSource(changing, { ...f.options, cryptoTool }), /CHANGED_DURING_ENCRYPTION/);
  assert.equal(fs.existsSync(receiptPaths(changing, f.vault).file), false);
  fs.truncateSync(f.row.sourcePath, policy.MAX_ENCRYPTED_RECEIPT_BYTES + 1);
  const oversized = await reconcile({ ...f.options, root: f.root });
  assert.ok(oversized.issues.some(issue => issue.code === 'PROTECTED_SOURCE_SIZE_LIMIT'));
  assert.deepEqual(fs.readFileSync(f.target), f.safe);
});
