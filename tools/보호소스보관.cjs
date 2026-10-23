#!/usr/bin/env node
'use strict';
// Current source omitted from plaintext OneDrive copies -> existing-key encrypted Drive archive.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const policy = require('./이어하기꾸러미.js');
const { worktrees } = require('./onedrive-backup.cjs');
const { acquireLock, replaceFile } = require('./lib/backup-primitives.cjs');
const { fileDigest, verifyDriveCoverage } = require('./Git보관묶음.cjs');
const SHA = /^[0-9a-f]{64}$/;
const folded = file => path.resolve(file).toLowerCase();
function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n'); replaceFile(temporary, file);
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
// 한 번 맞추는 동안 미디어 줄마다 아래 확인을 세 번(처음 훑기·보관 앞·보관 뒤) 한다. 복사 목록(20MB)은 stat이 같으면 다시 읽지 않고,
// OneDrive 사본의 reparse 확인은 맞추기 앞뒤에 미디어 줄 전부를 PowerShell 한 번씩으로 본다(prior). 예약 우선순위 7에서 CPU가 꽉 차면
// PowerShell 한 번 띄우는 데 수십 초라, 부를 때마다 띄우면 미디어 줄 수만큼 단계가 길어졌다(10-21). prior 없이 부르면 예전처럼 매번 읽고 본다.
function priorCopies(vault) {
  const file = path.join(vault, '상태/OneDrive/copy-manifest.json');
  let kept = null;
  return () => {
    const stat = fs.statSync(file), key = [stat.size, stat.mtimeMs, stat.ctimeMs, stat.ino].join(':');
    if (!kept || kept.key !== key) kept = { key, manifest: JSON.parse(fs.readFileSync(file, 'utf8')) };
    return kept.manifest;
  };
}
function priorLinks(rows, manifest) {
  const targets = rows.filter(row => row.reason === 'embedded-media-or-base64' && typeof row.priorOneDriveCopy?.target === 'string')
    .map(row => row.priorOneDriveCopy.target);
  if (!targets.length || typeof manifest.oneDriveRoot !== 'string' || !path.isAbsolute(manifest.oneDriveRoot)) return null;
  return { root: manifest.oneDriveRoot, targets: new Set(targets.map(folded)),
    linked: policy.linkPaths(targets, { cloudDestinationRoot: manifest.oneDriveRoot }) };
}
function verifyPriorMedia(row, vault, prior = null) {
  if (row.reason !== 'embedded-media-or-base64') return;
  const manifest = prior ? prior.copies() : JSON.parse(fs.readFileSync(path.join(vault, '상태/OneDrive/copy-manifest.json'), 'utf8'));
  const previous = manifest.files;
  const proof = row.priorOneDriveCopy;
  if (!proof || !previous.some(file => file.source && folded(file.source) === folded(row.sourcePath) &&
    file.protectedSource === 'embedded-media-or-base64' && folded(file.target) === folded(proof.target) &&
    file.expectedBytes === proof.bytes && file.sha256 === proof.sha256)) throw new Error('PROTECTED_SOURCE_PRIOR_COPY_UNCONFIRMED');
  if (typeof manifest.oneDriveRoot !== 'string' || !path.isAbsolute(manifest.oneDriveRoot)) throw new Error('PROTECTED_SOURCE_PRIOR_ROOT_INVALID');
  const relative = path.relative(path.resolve(manifest.oneDriveRoot), path.resolve(proof.target));
  const batched = prior?.links && prior.links.root === manifest.oneDriveRoot && prior.links.targets.has(folded(proof.target));
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) ||
    (batched ? prior.links.linked : policy.linkPaths([proof.target], { cloudDestinationRoot: manifest.oneDriveRoot }))(proof.target))
    throw new Error('PROTECTED_SOURCE_PRIOR_COPY_ESCAPE');
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
async function preserveSource(row, { vault, roots, linked, cryptoTool, apply = false, prior = null }) {
  verifyPriorMedia(row, vault, prior);
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
  verifyPriorMedia(row, vault, prior);
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
// 절전이나 핫스팟 멈춤(10-21 10:12~)으로 OneDrive 실행이 3시간 넘게 없다가 두 예약이 같이 시작하면, 이 단계가 OneDrive의 새 목록보다
// 먼저 닿아 NOT_CURRENT로 멈춘다. OneDrive 실행이 돌고 있으면(run.lock의 PID가 살아 있음) 새 목록을 쓸 때까지 최대 8분 기다린다(10-21).
// 돌고 있지 않거나 기다려도 안 바뀌면 예전처럼 멈춘다. 목록을 못 읽은 오류도 기다릴 수 없으면 예전 그대로 올라간다.
function oneDriveRunning(vault) {
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(vault, '상태', 'OneDrive', 'run.lock'), 'utf8'));
    if (!Number.isSafeInteger(lock.pid) || lock.pid < 1) return false;
    process.kill(lock.pid, 0); return true;
  } catch (error) { return error.code === 'EPERM'; }
}
function inventoryCurrent(inventory, now = Date.now()) {
  const at = Date.parse(inventory.checkedAt);
  return inventory.status === 'success' && Array.isArray(inventory.files) && Number.isFinite(at) && now - at <= 3 * 3600000 && at <= now + 60000;
}
async function currentInventory(file, vault, { waitMs = 8 * 60000, pollMs = 5000, running = () => oneDriveRunning(vault),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    let inventory = null;
    try { inventory = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { if (Date.now() >= deadline || !running()) throw error; }
    if (inventory && inventoryCurrent(inventory)) return inventory;
    if (inventory && (Date.now() >= deadline || !running())) throw new Error('PROTECTED_SOURCE_INVENTORY_NOT_CURRENT');
    await sleep(pollMs);
  }
}
// appliedVersions: 마지막 적용 실행이 본 「경로\nSHA」 목록. 확인 실행은 새 암호문을 만들 수 없으므로, 그 목록에 없는(그 뒤에 처음 보인)
// 판은 실패로 세지 않고 awaiting-next-apply로 남긴다(10-19). 목록이 없으면 예전처럼 엄격하다.
async function reconcile({ vault, root, apply, onProgress = () => {}, roots: suppliedRoots, cryptoTool: suppliedCrypto, appliedVersions = null, inventoryWait = {} }) {
  const state = path.join(vault, 'protected-source-backup-status.json'), inventoryFile = path.join(vault, '상태', 'OneDrive', 'protected-sources.json');
  const unlock = acquireLock(state + '.lock');
  if (!unlock) return { status: 'attention', issues: [{ code: 'PROTECTED_SOURCE_ALREADY_RUNNING' }], files: [] };
  const report = { schemaVersion: 1, component: 'protected-sources', pid: process.pid, startedAt: new Date().toISOString(),
    checkedAt: new Date().toISOString(), status: 'running', files: [], issues: [] };
  // OneDrive 실행(30분마다)은 이 파일의 files로 보호 소스의 암호화 보관을 확인한다. 줄을 다 돌기 전에는 이번에 처리한 줄과, 아직 안 본
  // 원본의 지난 줄을 함께 쓴다. 시작하자마자 빈 목록을 쓰던 때는 겹쳐 끝난 OneDrive 실행이 남은 줄을 모두 보관 미확인으로 봤다
  // (10-21 09:49에 끝난 OneDrive 실행 때 이 단계는 404줄 중 100줄 남짓이라, 217번째 synk-tips style.css의 증거도 없었다).
  let carried = [], complete = false, written = 0;
  try { const last = JSON.parse(fs.readFileSync(state, 'utf8')); if (Array.isArray(last.files)) carried = last.files; } catch (_) { /* 처음 실행·깨진 파일 */ }
  const evidence = () => {
    if (complete) return report;
    const seen = new Set(report.files.map(row => folded(row.sourcePath)));
    return { ...report, files: report.files.concat(carried.filter(row => typeof row.sourcePath === 'string' && !seen.has(folded(row.sourcePath)))) };
  };
  const progress = () => { report.checkedAt = report.heartbeatAt = new Date().toISOString(); atomicJson(state, evidence()); written = Date.now(); onProgress(); };
  // 줄마다 이 파일(1MB 남짓)과 GitHub 영수증을 다시 쓰지 않는다. heartbeat는 5초 간격이면 된다(감시는 15분 멈춤을 본다, 10-21).
  const tick = () => { if (Date.now() - written >= 5000) progress(); };
  const timer = setInterval(progress, 15000);
  try {
    progress();
    const inventory = await currentInventory(inventoryFile, vault, inventoryWait);
    const roots = suppliedRoots || authorizedRoots(root);
    const prior = { copies: priorCopies(vault) };
    if (inventory.files.some(row => row.reason === 'embedded-media-or-base64')) prior.links = priorLinks(inventory.files, prior.copies());
    for (const row of inventory.files) verifyPriorMedia(row, vault, prior);
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
        try { receipt = await preserveSource(row, { vault, roots, linked, cryptoTool, apply, prior }); }
        catch (error) {
          if (error.message !== 'PROTECTED_SOURCE_INVENTORY_STALE') throw error;
          current = refreshedRow(row);
          if (!current) { report.files.push({ ...identity, bytes: row.bytes, sha256: row.sha256, status: 'no-longer-protected' }); tick(); continue; }
          const selected = receiptPaths(current, vault), paths = [current.sourcePath, selected.file, selected.manifest];
          refreshed.push({ row: current, paths });
          // 새 판의 영수증 자리는 옛 판 영수증과 같은 폴더라, 조상은 앞에서 묶어 본 경로에 다 들어 있다. 두 자리가 비었으면(보통) 그 결과를
          // 쓰고 PowerShell을 다시 띄우지 않는다(10-21 09:32 실행은 바뀐 줄마다 약 30초). 무엇이 있으면 예전처럼 따로 본다. 끝의 afterLinks가 다시 본다.
          const occupied = [selected.file, selected.manifest].some(file => {
            try { fs.lstatSync(file); return true; } catch (statError) { return statError.code !== 'ENOENT'; }
          });
          receipt = await preserveSource(current, { vault, roots, linked: occupied ? policy.linkPaths(paths) : linked, cryptoTool, apply, prior });
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
      tick();
    }
    complete = true;
    // Reparse or content changes during the batch keep the entire coverage incomplete.
    const afterLinks = policy.linkPaths(checkedPaths.concat(refreshed.flatMap(item => item.paths)));
    for (const row of inventory.files) {
      const selected = receiptPaths(row, vault);
      if ([row.sourcePath, selected.file, selected.manifest].some(file => afterLinks(file)))
        report.issues.push({ code: 'PROTECTED_SOURCE_REPARSE_AFTER_CHECK', source: row.source });
    }
    for (const item of refreshed) if (item.paths.some(file => afterLinks(file)))
      report.issues.push({ code: 'PROTECTED_SOURCE_REPARSE_AFTER_CHECK', source: item.row.source });
    // 미디어 줄의 이전 OneDrive 사본도 줄마다가 아니라 끝에서 한 번 더 묶어 본다(위 prior).
    if (prior.links) {
      const after = priorLinks(inventory.files, prior.copies());
      for (const row of inventory.files) if (row.reason === 'embedded-media-or-base64' && (!after || after.linked(row.priorOneDriveCopy.target)))
        report.issues.push({ code: 'PROTECTED_SOURCE_PRIOR_COPY_ESCAPE', source: row.source });
    }
    report.status = report.issues.length ? 'attention' : 'success';
  } catch (error) {
    // 코드 꼴이 아닌 오류도 시스템 오류 코드(EPERM 등)는 남긴다. 메시지 원문은 남기지 않는다(10-19).
    report.status = 'attention'; report.issues.push({ code: /^[A-Z][A-Z0-9_]{2,80}$/.test(error.message) ? error.message
      : /^E[A-Z]{2,20}$/.test(String(error.code)) ? 'PROTECTED_SOURCE_SYSTEM_' + error.code : 'PROTECTED_SOURCE_INVENTORY_UNAVAILABLE', ...(error.row || {}) });
  } finally {
    clearInterval(timer); report.finishedAt = report.checkedAt = new Date().toISOString();
    if (report.status === 'success') report.lastSuccessAt = report.finishedAt;
    atomicJson(state, evidence()); unlock();
  }
  return report;
}
module.exports = { authorizedRoots, sourceLocation, receiptPaths, preserveSource, reconcile };
