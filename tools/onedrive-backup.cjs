#!/usr/bin/env node
'use strict';
// 문서·소스만 갱신하며 기존 사본/원본을 삭제하지 않는다. 네트워크 인증을 직접 다루지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const policy = require('./이어하기꾸러미.js');
const { preserveSafeMarkdown } = require('./onedrive-safe-markdown.cjs');
const ROOT = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = (file, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
};
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value));
  fs.renameSync(temp, file);
}
function writeChangedIndex(file, content) {
  const existing = readJson(file);
  const { changedAt: ignored, ...oldContent } = existing || {};
  if (JSON.stringify(oldContent) === JSON.stringify(content)) return false;
  writeJson(file, { ...content, changedAt: new Date().toISOString() });
  return true;
}
function worktrees(root) {
  const found = [];
  for (const scope of policy.systemScopes(root).filter(scope => scope.mode === 'repository')) {
    if (!fs.existsSync(scope.root)) continue;
    const data = execFileSync('git', ['--no-optional-locks', 'worktree', 'list', '--porcelain', '-z'],
      { cwd: scope.root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 << 20 });
    for (const field of data.split('\0').filter(value => value.startsWith('worktree '))) {
      const directory = path.resolve(field.slice(9));
      if (directory.toLowerCase() !== path.resolve(scope.root).toLowerCase() && fs.existsSync(directory))
        found.push({ repository: scope.name, primary: scope.root, root: directory });
    }
  }
  return found;
}
function changedWorktreeSources(tree) {
  const args = { cwd: tree.root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 << 20 };
  const mainHead = execFileSync('git', ['--no-optional-locks', 'rev-parse', 'HEAD'], { ...args, cwd: tree.primary }).trim();
  const changed = execFileSync('git', ['--no-optional-locks', 'diff', '--name-only', '-z', mainHead, '--'], args);
  const untracked = execFileSync('git', ['--no-optional-locks', 'ls-files', '--others', '--exclude-standard', '-z'], args);
  return [...new Set((changed + untracked).split('\0'))].filter(relative => relative && !/\.md$/i.test(relative) &&
    policy.문서인가(relative) && !policy.금지인가(relative) && !policy.excludedPath(relative) &&
    fs.existsSync(path.join(tree.root, relative)));
}
function preserveWorktreeDocuments(root, vault, { dryRun = false, trees = worktrees(root) } = {}) {
  const destination = path.join(vault, '작업문서_미통합_자동');
  const candidates = trees.flatMap(tree => [...new Set([...policy.workTextFiles(tree.root),
    ...(tree.changedSources || changedWorktreeSources(tree))])].map(relativePath =>
    ({ ...tree, relativePath, source: path.join(tree.root, relativePath), primaryPath: path.join(tree.primary, relativePath) })));
  const linked = policy.linkPaths(candidates.flatMap(row => [row.source, row.primaryPath]));
  const filesDirectory = path.join(destination, 'files');
  if (policy.linkPaths([filesDirectory])(filesDirectory)) throw new Error('worktree preservation destination is linked');
  const entries = [], rejected = [], primaryHashes = new Map(), unique = new Set();
  let written = 0, sameAsPrimary = 0, preservedBytes = 0, sourceFiles = 0;
  for (const row of candidates) {
    let reason = linked(row.source) ? 'link-or-reparse-point' : null;
    try {
      const stat = fs.statSync(row.source);
      if (!stat.isFile()) reason = 'not-regular-file';
      else if (stat.size > policy.MAX_TEXT_BYTES) reason = 'over-10MiB';
      if (reason) { rejected.push({ repository: row.repository, worktree: row.root, relativePath: row.relativePath, reason }); continue; }
      const data = fs.readFileSync(row.source);
      reason = policy.textPolicy(row.relativePath, data);
      if (reason) { rejected.push({ repository: row.repository, worktree: row.root, relativePath: row.relativePath, reason }); continue; }
      const after = fs.statSync(row.source);
      if (stat.size !== after.size || stat.mtimeMs !== after.mtimeMs) throw new Error('worktree-source-changed-during-read');
      const sha256 = hash(data);
      if (!primaryHashes.has(row.primaryPath)) {
        let primaryHash = null;
        if (!linked(row.primaryPath) && fs.existsSync(row.primaryPath) && fs.statSync(row.primaryPath).isFile() && fs.statSync(row.primaryPath).size <= policy.MAX_TEXT_BYTES) {
          const primaryData = fs.readFileSync(row.primaryPath);
          if (!policy.textPolicy(row.relativePath, primaryData)) primaryHash = hash(primaryData);
        }
        primaryHashes.set(row.primaryPath, primaryHash);
      }
      const matchesPrimary = primaryHashes.get(row.primaryPath) === sha256;
      const extension = path.extname(row.relativePath).toLowerCase() || '.txt';
      const preservedFile = matchesPrimary ? null : 'files/' + sha256 + extension;
      if (!/\.md$/i.test(row.relativePath)) sourceFiles++;
      if (matchesPrimary) sameAsPrimary++;
      else {
        if (!unique.has(preservedFile)) preservedBytes += data.length;
        unique.add(preservedFile);
        if (!dryRun) {
          const target = path.join(destination, preservedFile);
          if (fs.existsSync(target)) {
            if (fs.lstatSync(target).isSymbolicLink()) throw new Error('preserved-worktree-is-link');
            if (hash(fs.readFileSync(target)) !== sha256) throw new Error('preserved-worktree-hash-mismatch');
          } else {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, data, { flag: 'wx' });
            if (hash(fs.readFileSync(target)) !== sha256) throw new Error('preserved-worktree-write-mismatch');
            written++;
          }
        }
      }
      entries.push({ repository: row.repository, worktree: row.root, relativePath: row.relativePath,
        sha256, bytes: data.length, sameAsPrimary: matchesPrimary, preservedFile });
    } catch (error) {
      if (error.code === 'ENOENT') rejected.push({ repository: row.repository, worktree: row.root, relativePath: row.relativePath, reason: 'source-disappeared' });
      else throw error;
    }
  }
  const report = { schemaVersion: 1, checkedAt: new Date().toISOString(), worktrees: trees.length,
    documents: entries.filter(row => /\.md$/i.test(row.relativePath)).length, sourceFiles,
    sameAsPrimary, uniquePreserved: unique.size, preservedBytes, written, rejected: rejected.length };
  if (!dryRun) {
    // 현재 index가 다른 버전으로 바뀌어도 이미 보존한 SHA의 원래 경로를 잃지 않는다.
    // 작은 SHA 접두사별 파일로 나눠 전체 목록의 매회 재쓰기와 10MiB 초과를 피한다.
    const identityGroups = new Map();
    for (const entry of entries.filter(row => row.preservedFile)) {
      const prefix = entry.sha256.slice(0, 2);
      if (!identityGroups.has(prefix)) identityGroups.set(prefix, []);
      identityGroups.get(prefix).push(entry);
    }
    for (const [prefix, group] of identityGroups) {
      const file = path.join(destination, 'sources', prefix + '.json');
      const identities = readJson(file, { files: {} }).files;
      for (const entry of group) {
        const paths = identities[entry.preservedFile] || (identities[entry.preservedFile] = []);
        if (!paths.some(row => row.repository === entry.repository && row.relativePath === entry.relativePath))
          paths.push({ repository: entry.repository, relativePath: entry.relativePath });
      }
      writeChangedIndex(file, { files: identities });
    }
    // 전체 작업트리 목록이 10MiB를 넘어서도 복원 경로가 필터에서 빠지지 않게 나눈다.
    const manifests = [];
    for (const tree of trees) {
      const treeEntries = entries.filter(entry => entry.worktree === tree.root);
      for (let offset = 0; offset < treeEntries.length; offset += 500) {
        const file = 'manifests/' + hash(tree.root).slice(0, 20) + '-' + (offset / 500) + '.json';
        writeChangedIndex(path.join(destination, file), { repository: tree.repository, worktree: tree.root, entries: treeEntries.slice(offset, offset + 500) });
        manifests.push({ file, repository: tree.repository, worktree: tree.root, documents: Math.min(500, treeEntries.length - offset) });
      }
    }
    writeChangedIndex(path.join(destination, 'index.json'), { schemaVersion: 1, worktrees: trees.length,
      documents: report.documents, sourceFiles, sameAsPrimary, uniquePreserved: unique.size, manifests,
      restore: 'sameAsPrimary이면 OneDrive 시스템/저장소/relativePath의 SHA를 확인한다. 아니면 preservedFile을 새 작업트리의 relativePath로 복사한다. 기존 원문은 덮지 않는다.' });
    writeChangedIndex(path.join(destination, 'excluded-protected-manifest.json'), { rejected });
  }
  return report;
}
function providerStatus(manifest, output) {
  execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'onedrive-provider-status.ps1'),
    '-ManifestPath', manifest, '-OutputPath', output], { encoding: 'utf8', windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 1 << 20 });
  return readJson(output);
}
function classifyProvider(report) {
  if (!report || !report.inspected || report.missingFiles || report.sizeMismatches || report.readErrors) return 'failed';
  if (report.allTargetsStateInSync) return 'healthy';
  const hard = ['ERROR', 'WARNING', 'EXCLUDED', 'MISSING', 'UNAVAILABLE', 'UNKNOWN', 'NONE'];
  return Object.keys(report.stateCounts || {}).some(state => hard.includes(state) || state.startsWith('UNKNOWN_')) ? 'failed' : 'pending';
}
function protectedPriorSources(root, scopes, rejected, previousFiles) {
  const contentReasons = new Set(['secret-literal', 'secret-signature', 'embedded-media-or-base64', 'over-10MiB', 'not-utf8-text', 'binary-control-bytes']);
  const roots = new Map(scopes.map(scope => [scope.name, scope.root]));
  roots.set('SYNK-appsscript', root);
  const protectedByPath = new Map(rejected.filter(row => contentReasons.has(row.reason) && roots.has(row.sourceScope))
    .map(row => [path.resolve(roots.get(row.sourceScope), row.source).toLowerCase(), row.reason]));
  return previousFiles.filter(row => row.source && fs.existsSync(row.source) && protectedByPath.has(path.resolve(row.source).toLowerCase()))
    .map(row => ({ ...row, protectedSource: protectedByPath.get(path.resolve(row.source).toLowerCase()) }));
}
function protectedSourceInventory(root, vault, scopes, rejected, protectedPrior = []) {
  const roots = new Map(scopes.map(scope => [scope.name, scope.root])); roots.set('SYNK-appsscript', root);
  const secretReason = reason => ['secret-literal', 'secret-signature'].includes(reason);
  const priorMedia = new Map(protectedPrior.filter(row => row.protectedSource === 'embedded-media-or-base64' && row.source && row.target && /^[a-f0-9]{64}$/.test(row.sha256) && Number.isSafeInteger(row.expectedBytes))
    .map(row => [path.resolve(row.source).toLowerCase(), { target: row.target, bytes: row.expectedBytes, sha256: row.sha256 }]));
  const accepted = (reason, file) => secretReason(reason) || (reason === 'embedded-media-or-base64' && priorMedia.has(path.resolve(file).toLowerCase()));
  const candidates = rejected.filter(row => roots.has(row.sourceScope) && policy.문서인가(row.source))
    .map(row => ({ ...row, sourceRoot: roots.get(row.sourceScope), sourcePath: path.resolve(roots.get(row.sourceScope), row.source) }))
    .filter(row => accepted(row.reason, row.sourcePath));
  const worktreeExcluded = readJson(path.join(vault, '작업문서_미통합_자동/excluded-protected-manifest.json'), { rejected: [] });
  for (const row of worktreeExcluded.rejected.filter(row => secretReason(row.reason)))
    candidates.push({ sourceScope: row.repository, source: row.relativePath, sourceRoot: row.worktree,
      sourcePath: path.resolve(row.worktree, row.relativePath), reason: row.reason, worktree: true });
  const safeCopies = [...readJson(path.join(vault, '문서_안전사본_자동/index.json'), { files: [] }).files,
    ...readJson(path.join(vault, '문서_안전사본_20261018/변환manifest.json'), { files: [] }).files];
  const linked = policy.linkPaths(candidates.map(row => row.sourcePath));
  const files = [];
  for (const row of [...new Map(candidates.map(row => [row.sourcePath.toLowerCase(), row])).values()]) {
    const rel = path.relative(row.sourceRoot, row.sourcePath);
    if (path.isAbsolute(rel) || rel === '..' || rel.startsWith('..' + path.sep) || linked(row.sourcePath)) throw new Error('protected-source-path-changed');
    let before, content, after;
    try {
      before = fs.statSync(row.sourcePath);
      if (!before.isFile() || before.size > policy.MAX_TEXT_BYTES) throw new Error('protected-source-type-changed');
      content = fs.readFileSync(row.sourcePath); after = fs.statSync(row.sourcePath);
    } catch (error) {
      if (error.code === 'ENOENT') continue; // 목록 뒤에 지워진 원본은 보관할 현재 판이 없다(10-19).
      throw error;
    }
    const reason = policy.textPolicy(row.source, content);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('protected-source-changed-during-read');
    if (!accepted(reason, row.sourcePath)) continue;
    const digest = hash(content);
    const safe = safeCopies.find(item => path.resolve(item.sourcePath || item.source).toLowerCase() === row.sourcePath.toLowerCase() &&
      item.originalSha256 === digest && fs.existsSync(item.safeCopyPath || item.safeCopy) && hash(fs.readFileSync(item.safeCopyPath || item.safeCopy)) === item.safeCopySha256);
    files.push({ sourceScope: row.sourceScope, sourceRoot: path.resolve(row.sourceRoot), sourcePath: row.sourcePath,
      source: row.source, bytes: content.length, sha256: digest, reason, ...(row.worktree ? { worktree: true } : {}),
      ...(reason === 'embedded-media-or-base64' ? { priorOneDriveCopy: priorMedia.get(row.sourcePath.toLowerCase()) } : {}),
      ...(safe ? { safeCopyPath: safe.safeCopyPath || safe.safeCopy, safeCopySha256: safe.safeCopySha256 } : {}) });
  }
  return { schemaVersion: 1, checkedAt: new Date().toISOString(), status: 'success', files };
}
function encryptedProtectionCoverage(vault, files) {
  const protectedFiles = [...new Map(files.filter(row => row.protectedSource && row.source && fs.existsSync(row.source))
    .map(row => [path.resolve(row.source).toLowerCase(), row])).values()];
  if (!protectedFiles.length) return [];
  const proof = readJson(path.join(vault, 'protected-source-backup-status.json'), { files: [] });
  const linked = policy.linkPaths(protectedFiles.map(row => row.source));
  return protectedFiles.map(row => {
    const result = { source: row.source, reason: row.protectedSource, preservedBy: 'unconfirmed' };
    if (linked(row.source)) return { ...result, error: 'source-link' };
    const before = fs.statSync(row.source);
    if (!before.isFile() || before.size > policy.MAX_TEXT_BYTES) return { ...result, error: 'source-type-changed' };
    const current = fs.readFileSync(row.source), after = fs.statSync(row.source);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) return { ...result, error: 'source-changed-during-read' };
    result.sha256 = hash(current); result.bytes = current.length;
    const matching = (proof.files || []).find(file => file.sourcePath && path.resolve(file.sourcePath).toLowerCase() === path.resolve(row.source).toLowerCase() &&
      file.sha256 === result.sha256 && file.bytes === result.bytes && file.status === 'encrypted-drive-verified' &&
      file.coverage?.ok === true && file.coverage.account === '77yuhbs@gmail.com' &&
      Date.now() - Date.parse(file.coverage.checkedAt) >= -5 * 60 * 1000 && Date.now() - Date.parse(file.coverage.checkedAt) < 36 * 60 * 60 * 1000 &&
      file.coverage.files?.length && file.coverage.files.every(remote => typeof remote.id === 'string' && remote.id.length && remote.bytes > 0 && /^[a-f0-9]{64}$/i.test(remote.sha256)));
    if (matching) { result.preservedBy = 'encrypted-drive'; result.coverageCheckedAt = matching.coverage.checkedAt; }
    return result;
  });
}
function worktreePrimaryDrift(root, vault, files) {
  const directory = path.join(vault, '작업문서_미통합_자동');
  const index = readJson(path.join(directory, 'index.json'), { manifests: [] });
  const roots = new Map(policy.systemScopes(root).map(scope => [scope.name, scope.root]));
  const copied = new Map();
  for (const row of files) if (row.source) {
    const key = path.resolve(row.source).toLowerCase();
    if (!copied.has(key)) copied.set(key, new Set());
    copied.get(key).add(row.sha256);
  }
  const mismatches = [];
  for (const shard of index.manifests) {
    if (!/^manifests\/[a-f0-9]+-\d+\.json$/.test(shard.file)) throw new Error('invalid-worktree-manifest-path');
    const content = readJson(path.join(directory, shard.file));
    for (const entry of content.entries.filter(row => row.sameAsPrimary)) {
      const source = roots.has(entry.repository) ? path.resolve(roots.get(entry.repository), entry.relativePath).toLowerCase() : '';
      if (!copied.get(source)?.has(entry.sha256)) mismatches.push({ repository: entry.repository,
        worktree: entry.worktree, relativePath: entry.relativePath, expectedSha256: entry.sha256 });
    }
  }
  return mismatches;
}
function run({ root = ROOT, destination = process.env.OneDrive, stateDir, dryRun = false,
  checkOnly = false, collectWorktrees = preserveWorktreeDocuments, getRows = policy.목록, checkProvider = providerStatus } = {}) {
  const vault = path.resolve(root, '../SYNK_원본창고');
  stateDir ||= path.join(vault, '상태/OneDrive');
  const latestFile = path.join(stateDir, 'latest.json'), manifestFile = path.join(stateDir, 'copy-manifest.json');
  const previous = readJson(latestFile, {}), previousManifest = readJson(manifestFile, { files: [] });
  const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid;
  const state = { schemaVersion: 1, runId, pid: process.pid, startedAt: new Date().toISOString(), checkedAt: null,
    heartbeatAt: new Date().toISOString(), status: 'running',
    lastSuccessAt: previous.lastSuccessAt || null, copySucceededAt: previous.copySucceededAt || null,
    providerVerifiedAt: previous.providerVerifiedAt || null, destination, deletes: 0, directCloudCalls: 0,
    remoteChecksumVerified: false, note: 'Local SHA checks and Windows provider metadata; no independent remote checksum claim.' };
  let lock;
  try {
    if (dryRun && checkOnly) throw new Error('dry-run-and-check-only-are-mutually-exclusive');
    if (!destination || !fs.existsSync(destination)) throw new Error('configured-onedrive-root-missing');
    if (!dryRun) {
      fs.mkdirSync(stateDir, { recursive: true });
      const lockFile = path.join(stateDir, 'run.lock');
      try { lock = fs.openSync(lockFile, 'wx'); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const owner = readJson(lockFile, {});
        try { process.kill(owner.pid, 0); return { ...state, status: 'already-running', exitCode: 0 }; }
        catch (e) { if (e.code !== 'ESRCH') throw new Error('backup-lock-owner-unconfirmed'); }
        fs.unlinkSync(lockFile); lock = fs.openSync(lockFile, 'wx');
      }
      fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, runId }));
      writeJson(latestFile, state);
    }
    let manifest;
    if (checkOnly) {
      manifest = previousManifest;
      if (!manifest.files.length) throw new Error('copy-manifest-missing');
      state.protectedSources = [...new Map(manifest.files.filter(row => row.protectedSource).map(row =>
        [row.source, { source: row.source, reason: row.protectedSource }])).values()];
      state.worktreePrimaryDrift = worktreePrimaryDrift(root, vault, manifest.files);
    } else {
      state.worktrees = collectWorktrees(root, vault, { dryRun });
      if (!dryRun) state.safeMarkdown = preserveSafeMarkdown(root, vault);
      if (!dryRun) state.recoveryIndex = policy.writeSafeRecoveryIndex(vault);
      if (!dryRun) { state.heartbeatAt = new Date().toISOString(); writeJson(latestFile, state); }
      const rows = getRows(root), plan = policy.oneDrivePlan(root, rows);
      state.scopes = rows.scopes || [];
      if (state.scopes.some(scope => scope.status !== 'available')) throw new Error('required-source-scope-missing');
      const protectedFiles = protectedPriorSources(root, state.scopes, plan.rejected, previousManifest.files);
      state.protectedSources = [...new Map(protectedFiles.map(row => [row.source, { source: row.source, reason: row.protectedSource }])).values()];
      if (!plan.selected.length && !protectedFiles.length) throw new Error('empty-copy-plan');
      state.excluded = Object.fromEntries([...new Set(plan.rejected.map(row => row.reason))].map(reason => [reason, plan.rejected.filter(row => row.reason === reason).length]));
      if (dryRun) return { ...state, status: 'planned', files: plan.selected.length, bytes: plan.selected.reduce((n, row) => n + row.bytes, 0), exitCode: 0 };
      const protectedInventory = protectedSourceInventory(root, vault, state.scopes, plan.rejected, protectedFiles);
      writeJson(path.join(stateDir, 'protected-sources.json'), protectedInventory);
      state.protectedInventory = { checkedAt: protectedInventory.checkedAt, files: protectedInventory.files.length };
      const result = policy.copy(root, destination, plan.selected, { recordFiles: true, previousFiles: previousManifest.files });
      if (result.sourceDrift.length) {
        state.sourceDrift = result.sourceDrift.map(({ source, reason }) => ({ source, reason }));
        throw new Error('source-changed-during-copy');
      }
      const { files, rejected, sourceDrift, ...summary } = result;
      // 이미 별도로 검증한 잠긴 복구열쇠·안전 HTML은 바꾸지 않고 존재/동기화만 감시한다.
      const extras = readJson(path.join(stateDir, 'monitored-extra-targets.json'), { files: [] });
      const selectedTargets = new Set(files.map(file => path.resolve(file.target).toLowerCase()));
      // 새 내용이 민감해져 제외된 기존 파일은 옛 안전 사본을 유지하되 최신 백업 성공으로 세지 않는다.
      for (const file of protectedFiles) if (!selectedTargets.has(path.resolve(file.target).toLowerCase())) files.push(file);
      for (const extra of extras.files) {
        if (!selectedTargets.has(path.resolve(extra.target).toLowerCase())) files.push({ ...extra, monitorOnly: true });
      }
      state.monitorOnlyFiles = extras.files.length;
      manifest = { schemaVersion: 1, copiedAt: new Date().toISOString(), oneDriveRoot: destination, files };
      writeJson(manifestFile, manifest);
      state.copy = summary; state.copySucceededAt = manifest.copiedAt;
      state.worktreePrimaryDrift = worktreePrimaryDrift(root, vault, files);
      state.heartbeatAt = manifest.copiedAt;
      writeJson(path.join(stateDir, 'excluded-latest.json'), { checkedAt: manifest.copiedAt, rejected: plan.rejected });
      writeJson(latestFile, state);
      if (result.skipped) throw new Error('source-classification-changed-during-copy');
    }
    const providerFile = path.join(stateDir, 'provider-' + runId + '.json');
    const provider = checkProvider(manifestFile, providerFile);
    const providerLatest = path.join(stateDir, 'provider-latest.json');
    if (fs.existsSync(providerFile)) fs.renameSync(providerFile, providerLatest);
    state.status = classifyProvider(provider);
    state.provider = { path: providerLatest, inspected: provider.inspected, missingFiles: provider.missingFiles,
      sizeMismatches: provider.sizeMismatches, readErrors: provider.readErrors, stateCounts: provider.stateCounts };
    state.checkedAt = new Date().toISOString();
    state.heartbeatAt = state.checkedAt;
    state.protectedSources = encryptedProtectionCoverage(vault, manifest.files);
    if (state.protectedSources.some(row => row.preservedBy !== 'encrypted-drive')) throw new Error('previously-backed-source-now-protected');
    if (state.worktreePrimaryDrift?.length) throw new Error('worktree-primary-source-changed-during-copy');
    if (state.status === 'healthy') { state.lastSuccessAt = state.checkedAt; state.providerVerifiedAt = state.checkedAt; }
    state.exitCode = state.status === 'healthy' ? 0 : state.status === 'pending' ? 2 : 1;
    writeJson(latestFile, state);
    return state;
  } catch (error) {
    state.status = 'failed'; state.checkedAt = new Date().toISOString(); state.heartbeatAt = state.checkedAt; state.error = error.code || error.message;
    state.exitCode = 1;
    if (!dryRun) writeJson(latestFile, state);
    return state;
  } finally {
    if (lock !== undefined) { fs.closeSync(lock); fs.unlinkSync(path.join(stateDir, 'run.lock')); }
  }
}
if (require.main === module) {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') options.dryRun = true;
    else if (args[i] === '--check-only') options.checkOnly = true;
    else if (['--state-dir', '--destination'].includes(args[i]) && args[i + 1]) options[args[i] === '--state-dir' ? 'stateDir' : 'destination'] = path.resolve(args[++i]);
    else if (['--help', '-h'].includes(args[i])) {
      console.log('node tools/onedrive-backup.cjs [--dry-run|--check-only] [--state-dir PATH] [--destination ONEDRIVE]\nExit: 0 provider IN_SYNC, 2 pending, 1 failed. No deletions.'); process.exit(0);
    } else { console.error('Unknown argument'); process.exit(1); }
  }
  const result = run(options); console.log(JSON.stringify(result)); process.exitCode = result.exitCode;
}
module.exports = { worktrees, changedWorktreeSources, preserveWorktreeDocuments, classifyProvider, protectedPriorSources, protectedSourceInventory, encryptedProtectionCoverage, worktreePrimaryDrift, run, readJson, writeJson };
