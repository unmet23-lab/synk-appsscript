'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { preserveSource, sourceLocation, receiptPaths, reconcile } = require('../tools/보호소스보관.cjs');
const { fileDigest } = require('../tools/Git보관묶음.cjs');
const cryptPath = path.join(os.homedir(), 'Documents/SYNK_원본창고/암호.js');
const crypt = fs.existsSync(cryptPath) ? require(cryptPath) : null;
async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'protected-source-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceRoot = path.join(root, 'source'), vault = path.join(root, 'vault'); fs.mkdirSync(sourceRoot);
  const sourcePath = path.join(sourceRoot, 'configuration.js'); fs.writeFileSync(sourcePath, 'const password = "synthetic-value";\n');
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), pub = path.join(root, 'public.pem');
  fs.writeFileSync(pub, pair.publicKey.export({ type: 'spki', format: 'pem' }));
  const row = { sourceScope: 'fixture', sourceRoot, sourcePath, source: 'configuration.js', reason: 'secret-literal', ...await fileDigest(sourcePath) };
  const options = { vault, roots: [{ scope: 'fixture', root: sourceRoot }], linked: () => false,
    cryptoTool: crypt && { ...crypt, PUB: () => pub }, apply: true };
  return { root, sourceRoot, sourcePath, vault, pair, row, options };
}
test('protected source encrypts and restores exact bytes; same content reuses and changed content appends', { skip: !crypt }, async t => {
  const f = await fixture(t), original = fs.readFileSync(f.sourcePath);
  const receipt = await preserveSource(f.row, f.options), firstDigest = await fileDigest(receipt.filePath);
  const output = path.join(f.root, 'fixture-restored.js');
  await crypt.decryptFile(f.pair.privateKey, receipt.filePath, output);
  assert.deepEqual(fs.readFileSync(output), original); assert.deepEqual(fs.readFileSync(f.sourcePath), original);
  assert.equal((await preserveSource(f.row, f.options)).reused, true);
  fs.appendFileSync(f.sourcePath, '// next version\n');
  const next = { ...f.row, ...await fileDigest(f.sourcePath) }, second = await preserveSource(next, f.options);
  assert.notEqual(receipt.filePath, second.filePath);
  assert.deepEqual(await fileDigest(receipt.filePath), firstDigest);
  const manifest = JSON.parse(fs.readFileSync(receipt.manifestPath));
  assert.equal(JSON.stringify(manifest).includes('synthetic-value'), false);
});
test('protected-source inventory cannot expand a scope or pass a stale fingerprint/reparse flag', { skip: !crypt }, async t => {
  const f = await fixture(t);
  assert.throws(() => sourceLocation({ ...f.row, sourceRoot: f.root }, f.options.roots), /SCOPE_MISMATCH/);
  assert.throws(() => sourceLocation({ ...f.row, source: '../outside.js' }, f.options.roots), /INVENTORY_INVALID/);
  await assert.rejects(preserveSource(f.row, { ...f.options, linked: () => true }), /REPARSE/);
  fs.appendFileSync(f.sourcePath, '// drift\n');
  await assert.rejects(preserveSource(f.row, f.options), /INVENTORY_STALE/);
  assert.equal(fs.existsSync(receiptPaths(f.row, f.vault).file), false);
});
test('a source changing during encryption never becomes an accepted destination', { skip: !crypt }, async t => {
  const f = await fixture(t);
  const cryptoTool = { ...f.options.cryptoTool, async encryptStream(...args) {
    const result = await crypt.encryptStream(...args); fs.appendFileSync(f.sourcePath, '// concurrent change\n'); return result;
  } };
  await assert.rejects(preserveSource(f.row, { ...f.options, cryptoTool }), /CHANGED_DURING_ENCRYPTION/);
  assert.equal(fs.existsSync(receiptPaths(f.row, f.vault).file), false);
  assert.equal(fs.existsSync(receiptPaths(f.row, f.vault).manifest), false);
});

test('embedded media source can be encrypted only with a matching prior OneDrive copy receipt', { skip: !crypt }, async t => {
  const f = await fixture(t), safe = Buffer.from('body{color:black}');
  const media = Buffer.from(['body{background:url("da','ta:im','age/png;base','64,AAAA")}'].join(''));
  fs.writeFileSync(f.sourcePath, media);
  const row = { ...f.row, reason: 'embedded-media-or-base64', ...await fileDigest(f.sourcePath) };
  assert.throws(() => sourceLocation(row, f.options.roots), /INVENTORY_INVALID/);
  const target = path.join(f.root, 'onedrive/style.css'); fs.mkdirSync(path.dirname(target)); fs.writeFileSync(target, safe);
  row.priorOneDriveCopy = { target, bytes: safe.length, sha256: crypto.createHash('sha256').update(safe).digest('hex') };
  const mf = path.join(f.vault, '상태/OneDrive/copy-manifest.json'); fs.mkdirSync(path.dirname(mf), { recursive: true });
  fs.writeFileSync(mf, JSON.stringify({ oneDriveRoot: path.dirname(target), files: [] }));
  await assert.rejects(preserveSource(row, f.options), /PRIOR_COPY_UNCONFIRMED/);
  fs.writeFileSync(mf, JSON.stringify({ oneDriveRoot: path.dirname(target), files: [{ source: row.sourcePath, target, expectedBytes: row.priorOneDriveCopy.bytes, sha256: row.priorOneDriveCopy.sha256, protectedSource: row.reason }] }));
  const receipt = await preserveSource(row, f.options), output = path.join(f.root, 'media-restored.css');
  await crypt.decryptFile(f.pair.privateKey, receipt.filePath, output);
  assert.deepEqual(fs.readFileSync(output), media); assert.deepEqual(fs.readFileSync(target), safe);
});

test('a check run counts a protected version first seen after the last apply as waiting, never an apply run or a seen version', { skip: !crypt }, async t => {
  const f = await fixture(t);
  const inventory = path.join(f.vault, '상태/OneDrive/protected-sources.json'); fs.mkdirSync(path.dirname(inventory), { recursive: true });
  fs.writeFileSync(inventory, JSON.stringify({ status: 'success', checkedAt: new Date().toISOString(), files: [f.row] }));
  const options = { vault: f.vault, root: f.root, apply: false, roots: f.options.roots, cryptoTool: f.options.cryptoTool };
  const strict = await reconcile(options);
  assert.equal(strict.status, 'attention'); assert.equal(strict.issues[0].code, 'PROTECTED_SOURCE_NOT_CREATED');
  assert.equal((await reconcile({ ...options, appliedVersions: new Set([f.row.sourcePath + '\n' + f.row.sha256]) })).status, 'attention');
  const later = await reconcile({ ...options, appliedVersions: new Set(['elsewhere.js\n' + 'a'.repeat(64)]) });
  assert.equal(later.status, 'success'); assert.equal(later.files[0].status, 'awaiting-next-apply'); assert.deepEqual(later.issues, []);
  const applied = await reconcile({ ...options, apply: true, appliedVersions: new Set() });
  assert.equal(applied.files[0].status, 'awaiting-drive-verification'); assert.equal(applied.status, 'attention');
});

test('a source edited after the inventory is re-classified once and kept under its current fingerprint only', { skip: !crypt }, async t => {
  const inventoryOf = (f, rows) => {
    const file = path.join(f.vault, '상태/OneDrive/protected-sources.json'); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ status: 'success', checkedAt: new Date().toISOString(), files: rows }));
  };
  const options = f => ({ vault: f.vault, root: f.root, roots: f.options.roots, cryptoTool: f.options.cryptoTool });
  const edited = await fixture(t); inventoryOf(edited, [edited.row]);
  fs.appendFileSync(edited.sourcePath, '// edited after the inventory\n');
  const current = await fileDigest(edited.sourcePath);
  const waiting = await reconcile({ ...options(edited), apply: false, appliedVersions: new Set([edited.row.sourcePath + '\n' + edited.row.sha256]) });
  assert.equal(waiting.status, 'success'); assert.equal(waiting.files[0].status, 'awaiting-next-apply');
  assert.equal(waiting.files[0].sha256, current.sha256); assert.equal(waiting.files[0].inventorySha256, edited.row.sha256);
  const applied = await reconcile({ ...options(edited), apply: true });
  assert.equal(applied.files[0].sha256, current.sha256); assert.equal(applied.files[0].status, 'awaiting-drive-verification');
  assert.equal(applied.issues.some(issue => issue.code === 'PROTECTED_SOURCE_INVENTORY_STALE'), false);
  assert.equal(fs.existsSync(receiptPaths(edited.row, edited.vault).file), false);
  assert.equal(fs.existsSync(receiptPaths({ ...edited.row, sha256: current.sha256 }, edited.vault).file), true);
  const cleaned = await fixture(t); inventoryOf(cleaned, [cleaned.row]);
  fs.writeFileSync(cleaned.sourcePath, 'const value = 1;\n');
  const safe = await reconcile({ ...options(cleaned), apply: true });
  assert.equal(safe.status, 'success'); assert.equal(safe.files[0].status, 'no-longer-protected');
  const removed = await fixture(t); inventoryOf(removed, [removed.row]);
  fs.unlinkSync(removed.sourcePath);
  const gone = await reconcile({ ...options(removed), apply: true });
  assert.equal(gone.status, 'success'); assert.equal(gone.files[0].status, 'source-disappeared');
});

test('a removed worktree skips only its rows while an existing unauthorized root still stops the batch', { skip: !crypt }, async t => {
  const f = await fixture(t), gone = path.join(f.root, 'removed-worktree');
  const row = { ...f.row, sourceRoot: gone, sourcePath: path.join(gone, 'configuration.js'), worktree: true };
  const file = path.join(f.vault, '상태/OneDrive/protected-sources.json'); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ status: 'success', checkedAt: new Date().toISOString(), files: [f.row, row] }));
  const options = { vault: f.vault, root: f.root, apply: true, roots: f.options.roots, cryptoTool: f.options.cryptoTool };
  const skipped = await reconcile(options);
  assert.deepEqual(skipped.files.map(item => item.status), ['awaiting-drive-verification', 'source-disappeared']);
  assert.equal(skipped.issues.some(issue => issue.code === 'PROTECTED_SOURCE_SCOPE_MISMATCH'), false);
  fs.mkdirSync(gone); fs.copyFileSync(f.sourcePath, row.sourcePath);
  const strict = await reconcile(options);
  assert.equal(strict.status, 'attention'); assert.deepEqual(strict.issues.map(issue => issue.code), ['PROTECTED_SOURCE_SCOPE_MISMATCH']);
});

test('a temporary repository folder removed after the inventory skips only its rows; a remaining one stops and names the row (10-19)', { skip: !crypt }, async t => {
  // Documents 바로 아래 임시 작업트리(talk-wt-path-20261019)는 작업트리 표시 없이 자기 이름의 저장소 범위로 목록에 올랐다.
  const f = await fixture(t), gone = path.join(f.root, 'talk-wt-path');
  const row = { ...f.row, sourceScope: 'talk-wt-path', sourceRoot: gone, sourcePath: path.join(gone, 'configuration.js') };
  const file = path.join(f.vault, '상태/OneDrive/protected-sources.json'); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ status: 'success', checkedAt: new Date().toISOString(), files: [f.row, row] }));
  const options = { vault: f.vault, root: f.root, apply: true, roots: f.options.roots, cryptoTool: f.options.cryptoTool };
  const skipped = await reconcile(options);
  assert.deepEqual(skipped.files.map(item => item.status), ['awaiting-drive-verification', 'source-disappeared']);
  assert.equal(skipped.issues.some(issue => issue.code === 'PROTECTED_SOURCE_SCOPE_MISMATCH'), false);
  fs.mkdirSync(gone); fs.copyFileSync(f.sourcePath, row.sourcePath);
  const strict = await reconcile(options);
  assert.equal(strict.status, 'attention');
  assert.deepEqual(strict.issues, [{ code: 'PROTECTED_SOURCE_SCOPE_MISMATCH', sourceScope: 'talk-wt-path', source: 'configuration.js' }]);
  assert.deepEqual(strict.files, [], 'an unauthorized remaining folder stops the batch before any row is read');
});

test('prior OneDrive copy re-reads a ctime-only change once but never accepts persistent or content drift', { skip: !crypt }, async t => {
  const f = await fixture(t), safe = Buffer.from('body{color:black}');
  fs.writeFileSync(f.sourcePath, Buffer.from(['body{background:url("da', 'ta:im', 'age/png;base', '64,AAAA")}'].join('')));
  const target = path.join(f.root, 'onedrive/style.css'); fs.mkdirSync(path.dirname(target)); fs.writeFileSync(target, safe);
  const row = { ...f.row, reason: 'embedded-media-or-base64', ...await fileDigest(f.sourcePath),
    priorOneDriveCopy: { target, bytes: safe.length, sha256: crypto.createHash('sha256').update(safe).digest('hex') } };
  const mf = path.join(f.vault, '상태/OneDrive/copy-manifest.json'); fs.mkdirSync(path.dirname(mf), { recursive: true });
  fs.writeFileSync(mf, JSON.stringify({ oneDriveRoot: path.dirname(target), files: [{ source: row.sourcePath, target,
    expectedBytes: safe.length, sha256: row.priorOneDriveCopy.sha256, protectedSource: row.reason }] }));
  // 대상 사본의 n번째 stat에만 OneDrive가 바꾼 것처럼 ctime(또는 mtime)을 더한다.
  const original = fs.statSync;
  const drift = (calls, field) => { let n = 0; t.mock.restoreAll(); t.mock.method(fs, 'statSync', (...args) => {
    const value = original(...args);
    if (path.resolve(String(args[0])) !== path.resolve(target) || !calls(++n)) return value;
    return Object.assign(Object.create(Object.getPrototypeOf(value)), value, { [field]: value[field] + 1000 });
  }); };
  drift(n => n === 2, 'ctimeMs');
  assert.ok((await preserveSource(row, f.options)).filePath);
  drift(n => n % 2 === 0, 'ctimeMs');
  await assert.rejects(preserveSource(row, f.options), /PRIOR_COPY_CHANGED/);
  drift(n => n === 2, 'mtimeMs');
  await assert.rejects(preserveSource(row, f.options), /PRIOR_COPY_CHANGED/);
  t.mock.restoreAll();
  fs.writeFileSync(target, Buffer.from('body{color:white}'));
  await assert.rejects(preserveSource(row, f.options), /PRIOR_COPY_CHANGED/);
});

// 미디어 줄 m개와 목록 뒤에 바뀐 줄 s개로 목록을 만든다. 미디어 줄마다 이전 OneDrive 사본과 복사 목록 줄이 있다.
async function batchFixture(t, mediaCount, editedCount) {
  const f = await fixture(t), onedrive = path.join(f.root, 'onedrive'), rows = [], copies = [];
  fs.mkdirSync(onedrive);
  const safe = Buffer.from('body{color:black}'), media = Buffer.from(['body{background:url("da', 'ta:im', 'age/png;base', '64,AAAA")}'].join(''));
  for (let i = 0; i < mediaCount; i++) {
    const sourcePath = path.join(f.sourceRoot, `style-${i}.css`), target = path.join(onedrive, `style-${i}.css`);
    fs.writeFileSync(sourcePath, media); fs.writeFileSync(target, safe);
    const priorOneDriveCopy = { target, bytes: safe.length, sha256: crypto.createHash('sha256').update(safe).digest('hex') };
    rows.push({ ...f.row, sourcePath, source: `style-${i}.css`, reason: 'embedded-media-or-base64', ...await fileDigest(sourcePath), priorOneDriveCopy });
    copies.push({ source: sourcePath, target, expectedBytes: safe.length, sha256: priorOneDriveCopy.sha256, protectedSource: 'embedded-media-or-base64' });
  }
  for (let i = 0; i < editedCount; i++) {
    const sourcePath = path.join(f.sourceRoot, `edited-${i}.js`); fs.copyFileSync(f.sourcePath, sourcePath);
    rows.push({ ...f.row, sourcePath, source: `edited-${i}.js`, ...await fileDigest(sourcePath) });
    fs.appendFileSync(sourcePath, `// edited ${i} after the inventory\n`);
  }
  const states = path.join(f.vault, '상태/OneDrive'); fs.mkdirSync(states, { recursive: true });
  fs.writeFileSync(path.join(states, 'copy-manifest.json'), JSON.stringify({ oneDriveRoot: onedrive, files: copies }));
  fs.writeFileSync(path.join(states, 'protected-sources.json'), JSON.stringify({ status: 'success', checkedAt: new Date().toISOString(), files: rows }));
  return { ...f, rows, options: { vault: f.vault, root: f.root, apply: true, roots: f.options.roots, cryptoTool: f.options.cryptoTool } };
}
test('a reconcile checks reparse points in four batches and reads the copy manifest once, however many media and edited rows it has (10-21)', { skip: !crypt }, async t => {
  // 10-21 09:32 GitHub 실행은 예약 우선순위 7에서 PowerShell을 미디어 줄마다 세 번, 바뀐 줄마다 한 번 띄우다 24분 제한에 걸렸다.
  const policy = require('../tools/이어하기꾸러미.js');
  const counted = async (mediaCount, editedCount, linkedAt = () => false) => {
    const f = await batchFixture(t, mediaCount, editedCount), calls = [];
    let manifestReads = 0, stateWrites = 0;
    const read = fs.readFileSync, write = fs.writeFileSync, state = path.join(f.vault, 'protected-source-backup-status.json');
    t.mock.method(policy, 'linkPaths', files => {
      const call = calls.push(files.length);
      return Object.assign(file => linkedAt(call, file), { cloudPaths: new Set(), cloudOnlineOnly: new Set() });
    });
    t.mock.method(fs, 'readFileSync', (file, ...rest) => { if (String(file).endsWith('copy-manifest.json')) manifestReads++; return read(file, ...rest); });
    t.mock.method(fs, 'writeFileSync', (file, ...rest) => { if (String(file).startsWith(state + '.')) stateWrites++; return write(file, ...rest); });
    try { return { f, calls, report: await reconcile(f.options), manifestReads, stateWrites }; } finally { t.mock.restoreAll(); }
  };
  const one = await counted(1, 0), many = await counted(3, 2), none = await counted(0, 2);
  assert.equal(one.calls.length, 4); assert.equal(many.calls.length, 4); assert.equal(none.calls.length, 2);
  assert.equal(one.manifestReads, 1); assert.equal(many.manifestReads, 1); assert.equal(none.manifestReads, 0);
  assert.ok(many.stateWrites < many.f.rows.length + 2, `state written ${many.stateWrites} times for ${many.f.rows.length} rows`);
  for (const run of [one, many, none]) {
    assert.deepEqual(run.report.files.map(row => row.status), run.f.rows.map(() => 'awaiting-drive-verification'));
    assert.ok(run.report.issues.every(issue => issue.code === 'GIT_ARCHIVE_AWAITING_DRIVE'), JSON.stringify(run.report.issues));
  }
  assert.deepEqual(many.report.files.filter(row => row.inventorySha256).map(row => row.source), ['edited-0.js', 'edited-1.js']);
  // 끝의 묶음(네 번째)에서 OneDrive 사본이 링크로 바뀌었으면 그 줄을 짚는다.
  const target = path.join('onedrive', 'style-1.css');
  const late = await counted(3, 0, (call, file) => call === 4 && file.endsWith(target));
  assert.deepEqual(late.report.issues.filter(issue => issue.code === 'PROTECTED_SOURCE_PRIOR_COPY_ESCAPE').map(issue => issue.source), ['style-1.css']);
});
test('the status file keeps the previous evidence until every row is done, also when a run stops early (10-21)', { skip: !crypt }, async t => {
  // OneDrive 실행은 이 파일의 files로 보관을 확인한다. 예전에는 시작하자마자 빈 목록을 써서, 겹쳐 끝난 OneDrive 실행이 남은 줄을 미확인으로 봤다.
  const f = await fixture(t), state = path.join(f.vault, 'protected-source-backup-status.json');
  const inventory = path.join(f.vault, '상태/OneDrive/protected-sources.json'); fs.mkdirSync(path.dirname(inventory), { recursive: true });
  const previous = [{ sourcePath: f.row.sourcePath, sha256: f.row.sha256, bytes: f.row.bytes, status: 'encrypted-drive-verified' },
    { sourcePath: path.join(f.sourceRoot, 'no-longer-listed.js'), sha256: 'b'.repeat(64), bytes: 1, status: 'encrypted-drive-verified' }];
  fs.writeFileSync(state, JSON.stringify({ status: 'success', finishedAt: new Date().toISOString(), files: previous }));
  const options = { vault: f.vault, root: f.root, apply: true, roots: f.options.roots, cryptoTool: f.options.cryptoTool };
  fs.writeFileSync(inventory, JSON.stringify({ status: 'success', checkedAt: new Date(Date.now() - 4 * 3600000).toISOString(), files: [f.row] }));
  const stopped = await reconcile(options);
  assert.deepEqual(stopped.issues.map(issue => issue.code), ['PROTECTED_SOURCE_INVENTORY_NOT_CURRENT']);
  assert.deepEqual(JSON.parse(fs.readFileSync(state, 'utf8')).files, previous);
  fs.writeFileSync(inventory, JSON.stringify({ status: 'success', checkedAt: new Date().toISOString(), files: [f.row] }));
  const seen = [];
  const done = await reconcile({ ...options, onProgress() { seen.push(JSON.parse(fs.readFileSync(state, 'utf8'))); } });
  assert.equal(seen[0].status, 'running'); assert.deepEqual(seen[0].files, previous);
  const final = JSON.parse(fs.readFileSync(state, 'utf8'));
  assert.deepEqual(final.files.map(row => [row.sourcePath, row.status]), done.files.map(row => [row.sourcePath, row.status]));
  assert.deepEqual(done.files.map(row => row.sourcePath), [f.row.sourcePath]);
});
test('a stale inventory waits for a running OneDrive run to write the new one, and stops at once when none is running (10-21)', { skip: !crypt }, async t => {
  // 절전·핫스팟으로 3시간 넘게 멈췄다가 두 예약이 같이 시작하면, 이 단계가 OneDrive의 새 목록보다 먼저 닿는다.
  const f = await fixture(t), inventory = path.join(f.vault, '상태/OneDrive/protected-sources.json'); fs.mkdirSync(path.dirname(inventory), { recursive: true });
  const write = checkedAt => fs.writeFileSync(inventory, JSON.stringify({ status: 'success', checkedAt, files: [f.row] }));
  const stale = () => write(new Date(Date.now() - 4 * 3600000).toISOString());
  const options = { vault: f.vault, root: f.root, apply: true, roots: f.options.roots, cryptoTool: f.options.cryptoTool };
  stale();
  let sleeps = 0;
  const waited = await reconcile({ ...options, inventoryWait: { running: () => true, pollMs: 1,
    sleep: async () => { if (++sleeps === 2) write(new Date().toISOString()); } } });
  assert.equal(sleeps, 2);
  assert.deepEqual(waited.files.map(row => row.status), ['awaiting-drive-verification']);
  assert.ok(waited.issues.every(issue => issue.code === 'GIT_ARCHIVE_AWAITING_DRIVE'), JSON.stringify(waited.issues));
  const never = async () => { throw new Error('should not wait'); };
  stale();
  const idle = await reconcile({ ...options, inventoryWait: { running: () => false, sleep: never } });
  assert.deepEqual(idle.issues.map(issue => issue.code), ['PROTECTED_SOURCE_INVENTORY_NOT_CURRENT']);
  const late = await reconcile({ ...options, inventoryWait: { running: () => true, waitMs: 0, sleep: never } });
  assert.deepEqual(late.issues.map(issue => issue.code), ['PROTECTED_SOURCE_INVENTORY_NOT_CURRENT']);
  fs.rmSync(inventory);
  const missing = await reconcile({ ...options, inventoryWait: { running: () => false, sleep: never } });
  assert.deepEqual(missing.issues.map(issue => issue.code), ['PROTECTED_SOURCE_SYSTEM_ENOENT'], 'an unreadable inventory keeps its old code');
});
