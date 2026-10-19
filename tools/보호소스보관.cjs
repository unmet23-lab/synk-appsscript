#!/usr/bin/env node
'use strict';
// Current source omitted from plaintext OneDrive copies -> existing-key encrypted Drive archive.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const policy = require('./이어하기꾸러미.js');
const { worktrees } = require('./onedrive-backup.cjs');
const { acquireLock } = require('./GitHub백업.cjs');
const { fileDigest, verifyDriveCoverage } = require('./Git보관묶음.cjs');
const SHA = /^[0-9a-f]{64}$/;
const folded = file => path.resolve(file).toLowerCase();
function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n'); fs.renameSync(temporary, file);
}
function authorizedRoots(root) {
  const values = policy.systemScopes(root).map(row => ({ scope: row.name, root: row.root }));
  values.push(...worktrees(root).map(row => ({ scope: row.repository, root: row.root })));
  return values;
}
function sourceLocation(row, roots) {
  const previousMedia = row.reason === 'embedded-media-or-base64' && row.priorOneDriveCopy &&
    SHA.test(row.priorOneDriveCopy.sha256) && Number.isSafeInteger(row.priorOneDriveCopy.bytes) && row.priorOneDriveCopy.bytes >= 0 && row.priorOneDriveCopy.bytes <= policy.MAX_TEXT_BYTES &&
    typeof row.priorOneDriveCopy.target === 'string' && path.isAbsolute(row.priorOneDriveCopy.target);
  if ((!['secret-literal', 'secret-signature'].includes(row.reason) && !previousMedia) || !SHA.test(row.sha256) ||
      !Number.isSafeInteger(row.bytes) || row.bytes < 0 || row.bytes > policy.MAX_TEXT_BYTES ||
      typeof row.source !== 'string' || row.source.includes(':') || path.isAbsolute(row.source) || /(^|[\\/])\.\.([\\/]|$)/.test(row.source))
    throw new Error('PROTECTED_SOURCE_INVENTORY_INVALID');
  const root = roots.find(value => value.scope === row.sourceScope && folded(value.root) === folded(row.sourceRoot));
  if (!root || folded(path.join(root.root, row.source)) !== folded(row.sourcePath)) throw new Error('PROTECTED_SOURCE_SCOPE_MISMATCH');
  const realRoot = fs.realpathSync(root.root), realFile = fs.realpathSync(row.sourcePath);
  const relative = path.relative(realRoot, realFile);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative))
    throw new Error('PROTECTED_SOURCE_PATH_ESCAPE');
  return realFile;
}
function stable(before, after) {
  return before.dev === after.dev && before.ino === after.ino && before.size === after.size &&
    before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs;
}
// OneDrive Cloud 사본은 한동안 안 열다가 처음 열면 내용·크기·수정 시각은 그대로인 채 ctime만 바뀐다(10-19 실측).
const metadataOnlyChange = (before, after) => before.dev === after.dev && before.ino === after.ino &&
  before.size === after.size && before.mtimeMs === after.mtimeMs;
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function verifyPriorMedia(row, vault) {
  if (row.reason !== 'embedded-media-or-base64') return;
  const manifest = JSON.parse(fs.readFileSync(path.join(vault, '상태/OneDrive/copy-manifest.json'), 'utf8'));
  const previous = manifest.files;
  const proof = row.priorOneDriveCopy;
  if (!proof || !previous.some(file => file.source && folded(file.source) === folded(row.sourcePath) &&
    file.protectedSource === 'embedded-media-or-base64' && folded(file.target) === folded(proof.target) &&
    file.expectedBytes === proof.bytes && file.sha256 === proof.sha256)) throw new Error('PROTECTED_SOURCE_PRIOR_COPY_UNCONFIRMED');
  if (typeof manifest.oneDriveRoot !== 'string' || !path.isAbsolute(manifest.oneDriveRoot)) throw new Error('PROTECTED_SOURCE_PRIOR_ROOT_INVALID');
  const relative = path.relative(path.resolve(manifest.oneDriveRoot), path.resolve(proof.target));
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) ||
    policy.linkPaths([proof.target], { cloudDestinationRoot: manifest.oneDriveRoot })(proof.target)) throw new Error('PROTECTED_SOURCE_PRIOR_COPY_ESCAPE');
  // ctime만 바뀐 읽기는 다시 읽어, ctime까지 전후가 모두 같은 읽기만 받아들인다.
  for (let attempt = 1; ; attempt++) {
    const before = fs.statSync(proof.target);
    if (!before.isFile() || before.size !== proof.bytes || before.size > policy.MAX_TEXT_BYTES) throw new Error('PROTECTED_SOURCE_PRIOR_COPY_CHANGED');
    const bytes = fs.readFileSync(proof.target), after = fs.statSync(proof.target);
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== proof.sha256 || policy.textPolicy(row.source, bytes))
      throw new Error('PROTECTED_SOURCE_PRIOR_COPY_CHANGED');
    if (stable(before, after)) return;
    if (attempt >= 3 || !metadataOnlyChange(before, after)) throw new Error('PROTECTED_SOURCE_PRIOR_COPY_CHANGED');
    pause(250);
  }
}
function receiptPaths(row, vault) {
  const sourceId = crypto.createHash('sha256').update(JSON.stringify([row.sourceScope, folded(row.sourceRoot), row.source])).digest('hex');
  const relative = 'protected-sources/' + sourceId + '/' + row.sha256 + '.source.enc';
  return { sourceId, relative, file: path.join(vault, 'Git-보관', relative),
    manifestRelative: relative.replace(/\.source\.enc$/, '.manifest.json'),
    manifest: path.join(vault, 'Git-보관', relative.replace(/\.source\.enc$/, '.manifest.json')) };
}
async function preserveSource(row, { vault, roots, linked, cryptoTool, apply = false }) {
  verifyPriorMedia(row, vault);
  const file = sourceLocation(row, roots);
  if (linked(row.sourcePath)) throw new Error('PROTECTED_SOURCE_REPARSE');
  const before = fs.statSync(file);
  if (!before.isFile()) throw new Error('PROTECTED_SOURCE_NOT_FILE');
  const current = await fileDigest(file);
  if (current.sha256 !== row.sha256 || current.bytes !== row.bytes || !stable(before, fs.statSync(file)))
    throw new Error('PROTECTED_SOURCE_INVENTORY_STALE');
  const selected = receiptPaths(row, vault);
  let receipt;
  if (fs.existsSync(selected.manifest)) {
    receipt = JSON.parse(fs.readFileSync(selected.manifest, 'utf8'));
    const encrypted = await fileDigest(selected.file);
    if (receipt.sourceId !== selected.sourceId || receipt.source.sha256 !== row.sha256 || receipt.source.bytes !== row.bytes ||
        receipt.relativePath !== selected.relative || receipt.manifestRelativePath !== selected.manifestRelative ||
        encrypted.sha256 !== receipt.encrypted.sha256 || encrypted.md5 !== receipt.encrypted.md5 || encrypted.bytes !== receipt.encrypted.bytes)
      throw new Error('PROTECTED_SOURCE_RECEIPT_MISMATCH');
    receipt = { ...receipt, reused: true };
  } else {
    if (!apply) return null;
    if (fs.existsSync(selected.file)) throw new Error('PROTECTED_SOURCE_UNRECEIPTED_DESTINATION');
    const stageDir = path.join(vault, '.protected-source-staging'); fs.mkdirSync(stageDir, { recursive: true });
    if (linked(stageDir) || linked(selected.file) || linked(selected.manifest))
      throw new Error('PROTECTED_SOURCE_DESTINATION_REPARSE');
    const staging = path.join(stageDir, crypto.randomUUID() + '.enc'), createdAt = new Date().toISOString();
    const plaintext = await cryptoTool.encryptStream(fs.readFileSync(cryptoTool.PUB(), 'utf8'), fs.createReadStream(file), staging, 'protected-source');
    if (plaintext.sha256 !== row.sha256 || plaintext.bytes !== row.bytes || !stable(before, fs.statSync(file)) ||
        (await fileDigest(file)).sha256 !== row.sha256 || sourceLocation(row, roots) !== file)
      throw new Error('PROTECTED_SOURCE_CHANGED_DURING_ENCRYPTION');
    const encrypted = await fileDigest(staging);
    fs.mkdirSync(path.dirname(selected.file), { recursive: true });
    fs.copyFileSync(staging, selected.file, fs.constants.COPYFILE_EXCL);
    if ((await fileDigest(selected.file)).sha256 !== encrypted.sha256) throw new Error('PROTECTED_SOURCE_COPY_MISMATCH');
    receipt = { schemaVersion: 1, component: 'protected-source', group: 'Git-보관', sourceId: selected.sourceId,
      createdAt, finishedAt: new Date().toISOString(), relativePath: selected.relative, manifestRelativePath: selected.manifestRelative,
      source: { scope: row.sourceScope, root: row.sourceRoot, path: row.source, bytes: row.bytes, sha256: row.sha256 },
      encrypted, keyId: plaintext.keyId, noPlaintextFileWritten: true };
    atomicJson(selected.manifest, receipt);
    if (path.dirname(fs.realpathSync(staging)) === fs.realpathSync(stageDir)) fs.unlinkSync(staging);
  }
  if (!stable(before, fs.statSync(file)) || sourceLocation(row, roots) !== file || (await fileDigest(file)).sha256 !== row.sha256)
    throw new Error('PROTECTED_SOURCE_CHANGED_DURING_CHECK');
  verifyPriorMedia(row, vault);
  return { ...receipt, filePath: selected.file, manifestPath: selected.manifest };
}
// 목록(OneDrive 실행이 30분마다 만든다) 뒤에 원본이 바뀌었으면, 목록을 만들 때와 같은 분류로 그 한 줄만 새로 잡는다.
// 더는 보호 대상이 아니면(다음 OneDrive 실행이 평문 사본으로 넘긴다) null, 읽는 동안 바뀌면 그대로 실패한다(10-19).
function refreshedRow(row) {
  const before = fs.statSync(row.sourcePath);
  if (!before.isFile() || before.size > policy.MAX_TEXT_BYTES) return null;
  const data = fs.readFileSync(row.sourcePath);
  if (!stable(before, fs.statSync(row.sourcePath))) throw new Error('PROTECTED_SOURCE_INVENTORY_STALE');
  const reason = policy.textPolicy(row.source, data);
  if (!['secret-literal', 'secret-signature'].includes(reason) && !(reason === 'embedded-media-or-base64' && row.priorOneDriveCopy)) return null;
  return { ...row, reason, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex'), inventorySha256: row.sha256 };
}
// appliedVersions: 마지막 적용 실행이 본 「경로\nSHA」 목록. 확인 실행은 새 암호문을 만들 수 없으므로, 그 목록에 없는(그 뒤에 처음 보인)
// 판은 실패로 세지 않고 awaiting-next-apply로 남긴다(10-19). 목록이 없으면 예전처럼 엄격하다.
async function reconcile({ vault, root, apply, onProgress = () => {}, roots: suppliedRoots, cryptoTool: suppliedCrypto, appliedVersions = null }) {
  const state = path.join(vault, 'protected-source-backup-status.json'), inventoryFile = path.join(vault, '상태', 'OneDrive', 'protected-sources.json');
  const unlock = acquireLock(state + '.lock');
  if (!unlock) return { status: 'attention', issues: [{ code: 'PROTECTED_SOURCE_ALREADY_RUNNING' }], files: [] };
  const report = { schemaVersion: 1, component: 'protected-sources', pid: process.pid, startedAt: new Date().toISOString(),
    checkedAt: new Date().toISOString(), status: 'running', files: [], issues: [] };
  const progress = () => { report.checkedAt = report.heartbeatAt = new Date().toISOString(); atomicJson(state, report); onProgress(); };
  const timer = setInterval(progress, 15000);
  try {
    progress();
    const inventory = JSON.parse(fs.readFileSync(inventoryFile, 'utf8'));
    const at = Date.parse(inventory.checkedAt);
    if (inventory.status !== 'success' || !Array.isArray(inventory.files) || !Number.isFinite(at) ||
        Date.now() - at > 3 * 3600000 || at > Date.now() + 60000) throw new Error('PROTECTED_SOURCE_INVENTORY_NOT_CURRENT');
    const roots = suppliedRoots || authorizedRoots(root);
    for (const row of inventory.files) verifyPriorMedia(row, vault);
    // 목록 뒤에 원본이나 그 범위 폴더가 통째로 지워진 줄. 읽을 것이 없으므로 그 줄만 source-disappeared로 남긴다.
    // 범위 폴더는 작업트리이거나, Documents 바로 아래에 만든 임시 작업트리처럼 자기 이름의 저장소 범위로 잡힌 폴더다(10-19 talk-wt-path).
    // 범위 밖 경로·남아 있는 폴더의 범위 불일치는 그대로 전체를 멈추고, 어느 줄인지 남긴다(10-19).
    const vanished = (row, error) => error.code === 'ENOENT' ||
      (error.message === 'PROTECTED_SOURCE_SCOPE_MISMATCH' && typeof row.sourceRoot === 'string' &&
        path.isAbsolute(row.sourceRoot) && !fs.existsSync(row.sourceRoot));
    for (const row of inventory.files) {
      try { sourceLocation(row, roots); } catch (error) {
        if (vanished(row, error)) continue;
        error.row = { sourceScope: row.sourceScope, source: row.source }; throw error;
      }
    }
    const checkedPaths = inventory.files.flatMap(row => {
      const selected = receiptPaths(row, vault); return [row.sourcePath, selected.file, selected.manifest];
    }).concat(path.join(vault, '.protected-source-staging'));
    const linked = policy.linkPaths(checkedPaths);
    const cryptoTool = suppliedCrypto || (apply ? require(path.join(vault, '암호.js')) : null);
    const verificationFile = path.join(vault, '상태', 'Git-보관', 'verify-status.json');
    const verification = fs.existsSync(verificationFile) ? JSON.parse(fs.readFileSync(verificationFile, 'utf8')) : {};
    report.inventoryCheckedAt = inventory.checkedAt;
    const refreshed = [];
    for (const row of inventory.files) {
      const identity = { sourceScope: row.sourceScope, sourceRoot: row.sourceRoot, sourcePath: row.sourcePath, source: row.source };
      try {
        let current = row, receipt;
        try { receipt = await preserveSource(row, { vault, roots, linked, cryptoTool, apply }); }
        catch (error) {
          if (error.message !== 'PROTECTED_SOURCE_INVENTORY_STALE') throw error;
          current = refreshedRow(row);
          if (!current) { report.files.push({ ...identity, bytes: row.bytes, sha256: row.sha256, status: 'no-longer-protected' }); progress(); continue; }
          const selected = receiptPaths(current, vault), paths = [current.sourcePath, selected.file, selected.manifest];
          refreshed.push({ row: current, paths });
          receipt = await preserveSource(current, { vault, roots, linked: policy.linkPaths(paths), cryptoTool, apply });
        }
        const coverage = receipt ? await verifyDriveCoverage(receipt, vault, { verification }) : { ok: false, code: 'PROTECTED_SOURCE_NOT_CREATED' };
        const later = !receipt && !apply && appliedVersions instanceof Set && !appliedVersions.has(current.sourcePath + '\n' + current.sha256);
        report.files.push({ ...identity, bytes: current.bytes, sha256: current.sha256,
          ...(current !== row ? { inventorySha256: row.sha256 } : {}),
          status: coverage.ok ? 'encrypted-drive-verified' : later ? 'awaiting-next-apply' : 'awaiting-drive-verification', coverage,
          ...(receipt ? { relativePath: receipt.relativePath, manifestPath: receipt.manifestPath, reused: !!receipt.reused } : {}) });
        if (!coverage.ok && !later) report.issues.push({ code: coverage.code, sourceScope: row.sourceScope, source: row.source });
      } catch (error) {
        // 목록 뒤에 지워진 원본은 지금 보관할 판이 없다. 이전 판의 암호문은 그대로 남는다.
        if (vanished(row, error)) report.files.push({ ...identity, bytes: row.bytes, sha256: row.sha256, status: 'source-disappeared' });
        else report.issues.push({ code: /^[A-Z][A-Z0-9_]{2,80}$/.test(error.message) ? error.message : 'PROTECTED_SOURCE_ARCHIVE_FAILED',
          sourceScope: row.sourceScope, source: row.source });
      }
      progress();
    }
    // Reparse or content changes during the batch keep the entire coverage incomplete.
    const afterLinks = policy.linkPaths(checkedPaths.concat(refreshed.flatMap(item => item.paths)));
    for (const row of inventory.files) {
      const selected = receiptPaths(row, vault);
      if ([row.sourcePath, selected.file, selected.manifest].some(file => afterLinks(file)))
        report.issues.push({ code: 'PROTECTED_SOURCE_REPARSE_AFTER_CHECK', source: row.source });
    }
    for (const item of refreshed) if (item.paths.some(file => afterLinks(file)))
      report.issues.push({ code: 'PROTECTED_SOURCE_REPARSE_AFTER_CHECK', source: item.row.source });
    report.status = report.issues.length ? 'attention' : 'success';
  } catch (error) {
    report.status = 'attention'; report.issues.push({ code: /^[A-Z][A-Z0-9_]{2,80}$/.test(error.message) ? error.message : 'PROTECTED_SOURCE_INVENTORY_UNAVAILABLE', ...(error.row || {}) });
  } finally {
    clearInterval(timer); report.finishedAt = report.checkedAt = new Date().toISOString();
    if (report.status === 'success') report.lastSuccessAt = report.finishedAt;
    atomicJson(state, report); unlock();
  }
  return report;
}
module.exports = { authorizedRoots, sourceLocation, receiptPaths, preserveSource, reconcile };
