#!/usr/bin/env node
'use strict';
// Existing commits only. Never commits working files, moves a branch, or uses force.
// Private origins receive immutable refs outside heads/tags; public origins are read-only.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { textPolicy, MAX_TEXT_BYTES } = require('./이어하기꾸러미.js');
const { generatedKind, validatePolicy } = require('./git-storage-check.cjs');
const OID = /^[0-9a-f]{40}$/;
const PREFIX = 'refs/synk-backup/';
const MAX_TOTAL = 50 * 1024 * 1024;
const reviewedLiterals = require('./github-backup-reviewed-literals.json').entries;
const SECRET_SIGNATURE = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bAIza[\w-]{30,}|\b(?:gh[pousr]_|github_pat_|xox[baprs]-|sk-(?:proj-)?)\w[\w-]{18,}|\beyJ[\w-]{12,}\.[\w-]{12,}\.[\w-]{12,}/;
let approvedPolicy;
function storagePolicy() {
  if (!approvedPolicy) approvedPolicy = validatePolicy(JSON.parse(reader(path.resolve(__dirname, '..'))(
    ['show', 'HEAD:tools/git-storage-policy.json']).toString('utf8')));
  return approvedPolicy;
}

function templateOnly(file, data) {
  if (/(?:^|\/)\.env\.(?:example|sample|template)$/i.test(file)) {
    const lines = data.toString('utf8').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    return lines.every(line => /^[A-Za-z_][A-Za-z0-9_]*=(?:|true|false|0|1|["']{2})$/.test(line));
  }
  if (/(?:^|\/)동봉\.json$/.test(file)) {
    try {
      const parsed = JSON.parse(data);
      return parsed && !Array.isArray(parsed) && Object.entries(parsed).every(([key, value]) =>
        /^[^\\\0:]+\.(?:m?js|cjs|ts)$/.test(key) && typeof value === 'string' &&
        !value.includes('..') && /^[^\\\0:@]+\.(?:m?js|cjs|ts)$/.test(value));
    } catch (_) { return false; }
  }
  return false;
}
function codeContentReason(file, data) {
  // Binary asset metadata can contain plaintext provider keys too.
  if (SECRET_SIGNATURE.test(data.toString('utf8'))) return 'secret-signature';
  const pathReason = textPolicy(file, Buffer.alloc(0));
  if (pathReason === 'credential-path') return SECRET_SIGNATURE.test(data.toString('utf8'))
    ? 'secret-signature' : templateOnly(file, data) ? null : pathReason;
  let normalized;
  try { normalized = new TextDecoder('utf-8', { fatal: true }).decode(data); } catch (_) {}
  if (/\.(?:png|jpe?g|webp|gif|ico|bmp|woff2?|ttf|otf|mp3|wav|ogg|wasm)$/i.test(file) ||
      normalized === undefined || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(normalized)) {
    const ext = path.posix.extname(file).toLowerCase();
    const starts = hex => data.subarray(0, hex.length / 2).equals(Buffer.from(hex, 'hex'));
    const valid = (ext === '.png' && starts('89504e470d0a1a0a')) ||
      (['.jpg', '.jpeg'].includes(ext) && starts('ffd8ff')) ||
      (ext === '.webp' && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') ||
      (ext === '.gif' && /^GIF8[79]a/.test(data.subarray(0, 6).toString())) ||
      (ext === '.ico' && starts('00000100')) || (ext === '.bmp' && starts('424d')) ||
      (ext === '.woff' && starts('774f4646')) || (ext === '.woff2' && starts('774f4632')) ||
      (ext === '.ttf' && starts('00010000')) || (ext === '.otf' && starts('4f54544f')) ||
      (ext === '.mp3' && (starts('494433') || (data[0] === 255 && (data[1] & 224) === 224))) ||
      (ext === '.wav' && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WAVE') ||
      (ext === '.ogg' && starts('4f676753')) || (ext === '.wasm' && starts('0061736d01000000'));
    if (valid) return null;
    return 'unrecognized-binary';
  }
  // Git allows source SVG/data URIs and runtime bundles. Inspect secrets before
  // applying any literal exceptions; OneDrive's embedded-media ban does not apply.
  normalized = normalized.replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\\//g, '/');
  if (SECRET_SIGNATURE.test(normalized)) return 'secret-signature';
  const literals = [...normalized.matchAll(/(?<![\w"'`])(["']?)(?:[A-Za-z_$][\w$-]*)?(?:password|passwd|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|private[_-]?key|authorization)\1\s*[:=]\s*(["'])((?:\\.|(?!\2)[^\r\n])+)\2/gi)]
    .map(m => ({ value: m[3], end: m.index + m[0].length }));
  if (/\.(?:ya?ml|ini|conf|cfg|service|timer)$/i.test(file)) literals.push(...[...normalized.matchAll(/^\s*(?:password|passwd|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token)\s*[:=]\s*([^\s#"'{}\[\],]+)/gmi)]
    .map(m => ({ value: m[1], end: m.index + m[0].length })));
  for (const { value, end } of literals) {
    if (/^(?:\$\{|<|process\.env\.|env\.|your[_ -]|example|placeholder|dummy|test[_-]|change[_-]?me|\*{3})/i.test(value)) continue;
    const tail = normalized.slice(end);
    if (/^Bearer\s*$/i.test(value) && /^(?:\s*\+\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*|\.concat\(\s*[A-Za-z_$][\w$]*\s*\))\s*(?:[,;}\]\r\n]|$)/.test(tail)) continue;
    const digest = crypto.createHash('sha256').update(value).digest('hex');
    if (reviewedLiterals.some(row => row.path === file && row.sha256 === digest)) continue;
    return 'secret-literal';
  }
  return null;
}

function run(file, args, options = {}) {
  try {
    return execFileSync(file, args, { windowsHide: true, timeout: 120000,
      maxBuffer: 128 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options });
  } catch (_) {
    // Provider stderr may include credentials/URLs. Keep a fixed diagnostic code.
    const error = new Error(file === 'git' ? 'GIT_COMMAND_FAILED' : 'GITHUB_API_FAILED');
    error.code = error.message;
    throw error;
  }
}
function reader(repo) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1' };
  return (args, input) => run('git', ['--no-pager', '--no-optional-locks', '-c', 'core.quotepath=false',
    '-c', 'diff.autoRefreshIndex=false', '-C', repo, ...args], { env, input });
}
function remoteIdentity(url) {
  const match = String(url).trim().match(/^(?:git@github\.com:|https:\/\/github\.com\/)(unmet23-lab\/[A-Za-z0-9_.-]+?)(?:\.git)?$/);
  return match ? match[1] : null;
}
function parseRefs(buffer) {
  return buffer.toString('utf8').split(/\r?\n/).filter(Boolean).map(line => {
    const split = line.search(/\s/), sha = line.slice(0, split), ref = line.slice(split + 1).trim();
    if (!OID.test(sha) || !ref.startsWith('refs/')) throw new Error('INVALID_GIT_REFERENCE');
    return { sha, ref };
  });
}
function revisionInput(heads, known) { return Buffer.from([...heads, ...known.map(sha => '^' + sha)].join('\n') + '\n'); }
function knownCommits(git, refs) {
  const ids = [...new Set(refs.map(row => row.sha))];
  if (!ids.length) return [];
  const results = git(['cat-file', '--batch-check=%(objectname) %(objecttype)'], Buffer.from(ids.join('\n') + '\n'))
    .toString('utf8').trim().split('\n');
  return results.filter(row => row.endsWith(' commit')).map(row => row.split(' ')[0]);
}
function inspectNewObjects(git, sha, known, policy = storagePolicy()) {
  if (!OID.test(sha)) throw new Error('INVALID_COMMIT');
  const listed = git(['rev-list', '--objects', '--stdin'], revisionInput([sha], known)).toString('utf8').split('\n').filter(Boolean);
  const rows = listed.map(line => { const split = line.indexOf(' '); return {
    oid: split < 0 ? line : line.slice(0, split), file: split < 0 ? null : line.slice(split + 1),
  }; });
  if (!rows.length) return { ok: true, newBlobs: 0, bytes: 0, violations: [] };
  const metadata = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
    Buffer.from(rows.map(row => row.oid).join('\n') + '\n')).toString('utf8').trim().split('\n');
  const violations = [], blobs = [], pending = [];
  const cache = git.backupInspectionCache || (git.backupInspectionCache = new Map());
  for (let i = 0; i < metadata.length; i++) {
    const [oid, type, size] = metadata[i].split(' '), bytes = Number(size), file = rows[i].file;
    if (type === 'missing' || !OID.test(oid)) throw new Error('GIT_OBJECT_MISSING');
    if (type !== 'blob') continue;
    if (!file) { violations.push({ code: 'unknown-blob-path', oid }); continue; }
    blobs.push({ oid, file, bytes });
    if (bytes > Math.min(policy.maxBlobBytes, MAX_TEXT_BYTES)) { violations.push({ code: 'over-10MiB', path: file, bytes }); continue; }
    const kind = generatedKind(file, policy);
    if (kind) { violations.push({ code: kind, path: file, bytes }); continue; }
    const cacheKey = oid + ':' + file;
    if (cache.has(cacheKey)) {
      const reason = cache.get(cacheKey);
      if (reason) violations.push({ code: reason, path: file, bytes });
    } else pending.push({ oid, file, bytes, cacheKey });
  }
  const bytes = blobs.reduce((n, row) => n + row.bytes, 0);
  if (bytes > Math.min(policy.maxTotalBytes, MAX_TOTAL)) violations.push({ code: 'over-50MiB', bytes });
  // Already rejected payloads are never uploaded. Avoid reading large media or
  // running one Git process for every small source file in an old local branch.
  if (!violations.length && pending.length) {
    const body = git(['cat-file', '--batch'], Buffer.from(pending.map(row => row.oid).join('\n') + '\n'));
    let offset = 0;
    for (const row of pending) {
      const end = body.indexOf(10, offset);
      const header = body.subarray(offset, end).toString('ascii');
      if (end < offset || header !== `${row.oid} blob ${row.bytes}`) throw new Error('GIT_BLOB_BATCH_INVALID');
      offset = end + 1;
      const data = body.subarray(offset, offset + row.bytes);
      if (data.length !== row.bytes || body[offset + row.bytes] !== 10) throw new Error('GIT_BLOB_BATCH_TRUNCATED');
      offset += row.bytes + 1;
      const reason = codeContentReason(row.file, data);
      cache.set(row.cacheKey, reason);
      if (reason) violations.push({ code: reason, path: row.file, bytes: row.bytes });
    }
    if (offset !== body.length) throw new Error('GIT_BLOB_BATCH_TRAILING');
  }
  return { ok: violations.length === 0, newBlobs: blobs.length, bytes, violations };
}
function inspectRepository(repo, { apply = false, github = null, git = reader(repo), onProgress = () => {} } = {}) {
  const result = { name: path.basename(repo), path: repo, status: 'checking', checkedAt: new Date().toISOString(), refs: [] };
  const fetchUrl = git(['remote', 'get-url', 'origin']).toString('utf8').trim();
  const pushUrl = git(['remote', 'get-url', '--push', 'origin']).toString('utf8').trim();
  const identity = remoteIdentity(fetchUrl);
  if (!identity || remoteIdentity(pushUrl)?.toLowerCase() !== identity.toLowerCase()) throw new Error('UNAPPROVED_GITHUB_ORIGIN');
  result.repository = identity;
  const info = github || JSON.parse(run('gh', ['api', `repos/${identity}`, '--jq',
    '{private: .private, default_branch: .default_branch, full_name: .full_name}']).toString('utf8'));
  if (info.full_name.toLowerCase() !== identity.toLowerCase() || typeof info.private !== 'boolean') throw new Error('GITHUB_IDENTITY_MISMATCH');
  result.private = info.private;
  result.defaultBranch = info.default_branch;
  const remoteRefs = parseRefs(git(['ls-remote', '--refs', 'origin']));
  const localRefs = parseRefs(git(['for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads', 'refs/stash']));
  const current = git(['rev-parse', 'HEAD']).toString('utf8').trim();
  if (!OID.test(current)) throw new Error('INVALID_HEAD');
  if (!localRefs.some(row => row.sha === current)) localRefs.push({ sha: current, ref: 'refs/detached-current-head' });
  for (const match of git(['worktree', 'list', '--porcelain']).toString('utf8').matchAll(/^HEAD ([0-9a-f]{40})$/gm))
    if (!localRefs.some(row => row.sha === match[1])) localRefs.push({ sha: match[1], ref: 'refs/detached-worktree/' + match[1] });
  const known = knownCommits(git, remoteRefs);
  if (!known.length && remoteRefs.length) throw new Error('REMOTE_HISTORY_NOT_AVAILABLE_LOCALLY');
  const missing = new Set(git(['rev-list', '--stdin'], revisionInput([...new Set(localRefs.map(row => row.sha))], known))
    .toString('utf8').split(/\s+/).filter(Boolean));
  result.localRefs = localRefs.length;
  result.remoteRefs = remoteRefs.length;
  result.unpublishedCommits = missing.size;
  const candidates = [...new Set(localRefs.filter(row => missing.has(row.sha)).map(row => row.sha))];
  for (const sha of candidates) {
    onProgress();
    const row = { sha, sourceRefs: localRefs.filter(value => value.sha === sha).map(value => value.ref), targetRef: PREFIX + sha };
    result.refs.push(row);
    if (!info.private) { row.status = 'public-origin-unpublished'; continue; }
    row.check = inspectNewObjects(git, sha, known);
    if (!row.check.ok) { row.status = 'blocked-by-content-policy'; continue; }
    if (!apply) { row.status = 'ready'; continue; }
    // Immutable, pinned object ID: concurrent commits cannot change this payload.
    const existing = remoteRefs.find(value => value.ref === row.targetRef);
    if (existing && existing.sha !== sha) throw new Error('IMMUTABLE_BACKUP_REF_COLLISION');
    try {
      if (!existing) git(['push', '--porcelain', 'origin', `${sha}:${row.targetRef}`]);
      const verified = parseRefs(git(['ls-remote', '--refs', 'origin', row.targetRef]));
      if (verified.length !== 1 || verified[0].ref !== row.targetRef || verified[0].sha !== sha) throw new Error('REMOTE_BACKUP_SHA_MISMATCH');
      row.status = 'remote-verified';
      row.verifiedAt = new Date().toISOString();
      known.push(sha);
    } catch (error) { row.status = 'failed'; row.code = error.message; }
    onProgress();
  }
  result.status = result.refs.some(row => ['blocked-by-content-policy', 'public-origin-unpublished', 'failed'].includes(row.status))
    ? 'attention' : result.refs.some(row => row.status === 'ready') ? 'pending' : 'success';
  result.finishedAt = new Date().toISOString();
  return result;
}
function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temp, file);
}
function acquireLock(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(file, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      fs.closeSync(fd);
      return () => { try {
        const owner = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (owner.pid === process.pid) fs.unlinkSync(file);
      } catch (_) {} };
    } catch (error) {
      if (error.code !== 'EEXIST') throw new Error('GITHUB_LOCK_FAILED');
      let owner;
      try { owner = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
      if (!Number.isSafeInteger(owner.pid) || owner.pid < 1) return null;
      try { process.kill(owner.pid, 0); return null; }
      catch (probe) { if (probe.code !== 'ESRCH') return null; }
      // Re-read before removing only this stale lock; never kill its process.
      const current = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (current.pid !== owner.pid || current.startedAt !== owner.startedAt) return null;
      fs.unlinkSync(file);
    }
  }
  return null;
}
// 지금 ref 조합의 묶음이 아직 없을 때(새 브랜치 이름이 이미 묶은 커밋을 가리키는 경우 등) 마지막 적용 실행이 만든 묶음이
// Drive 검증을 마쳤으면, 그 묶음의 머리와 같은 커밋은 보존된 것으로 본다(10-19).
async function lastBundleCoverage(archive, repo, vault) {
  let bundles = [];
  try { bundles = JSON.parse(fs.readFileSync(path.join(vault, 'git-bundle-status.json'), 'utf8')).bundles || []; } catch (_) { return null; }
  const entry = bundles.filter(row => row && row.repository === repo.repository && typeof row.manifestRelativePath === 'string')
    .sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)))[0];
  if (!entry) return null;
  try {
    const receipt = await archive.receiptFromManifest(repo, vault, entry.manifestRelativePath);
    if (!receipt) return null;
    archive.verifyPrerequisites(repo, receipt);
    const coverage = await archive.verifyDriveCoverage(receipt, vault);
    return coverage.ok ? { receipt, coverage: { ...coverage, earlierSelection: true } } : null;
  } catch (_) { return null; }
}
async function reconcileEncryptedArchives(report, state, apply) {
  const archive = require('./Git보관묶음.cjs'), vault = path.dirname(state);
  const candidates = report.repositories.filter(repo => archive.archiveRefs(repo).length);
  if (!candidates.length) return;
  const progress = () => { report.heartbeatAt = report.checkedAt = new Date().toISOString(); atomicJson(state, report); };
  const heartbeat = setInterval(progress, 15000);
  const checkedArchives = [];
  try {
    if (apply) { atomicJson(state, report); await archive.main(['--vault', vault, '--state', state]); }
    for (const repo of candidates) {
      let receipt, coverage;
      try {
        receipt = await archive.existingReceipt(repo, vault);
        if (receipt) { archive.verifyPrerequisites(repo, receipt); coverage = await archive.verifyDriveCoverage(receipt, vault); }
        else coverage = { ok: false, code: 'GIT_ARCHIVE_NOT_CREATED' };
      } catch (error) { coverage = { ok: false, code: /^[A-Z][A-Z0-9_]{2,80}$/.test(error.message) ? error.message : 'GIT_ARCHIVE_VERIFY_FAILED' }; }
      if (receipt) checkedArchives.push({ ...receipt, driveCoverage: coverage });
      const earlier = coverage.ok ? null : await lastBundleCoverage(archive, repo, vault);
      for (const row of archive.archiveRefs(repo)) {
        if (coverage.ok && receipt.heads.some(head => head.sha === row.sha)) {
          row.status = 'encrypted-drive-verified'; row.fallback = coverage;
        } else if (earlier && earlier.receipt.heads.some(head => head.sha === row.sha)) {
          row.status = 'encrypted-drive-verified'; row.fallback = earlier.coverage;
        } else row.fallback = { ...coverage, ok: false };
      }
      repo.status = repo.refs.some(row => ['blocked-by-content-policy', 'public-origin-unpublished', 'failed'].includes(row.status))
        ? 'attention' : repo.refs.some(row => row.status === 'ready') ? 'pending' : 'success';
      progress();
    }
    archive.recordDriveCoverage(vault, checkedArchives);
  } finally { clearInterval(heartbeat); }
}
function requestArchiveTransfer(report, { apply, invoke = null }) {
  const pendingCodes = new Set(['GIT_ARCHIVE_AWAITING_DRIVE', 'GIT_ARCHIVE_DRIVE_VERIFICATION_NOT_CURRENT', 'GIT_ARCHIVE_DRIVE_FILE_MISMATCH']);
  const pending = report.repositories.some(repo => (repo.refs || []).some(row => row.fallback && !row.fallback.ok && pendingCodes.has(row.fallback.code))) ||
    (report.protectedSources?.files || []).some(row => row.relativePath && row.status === 'awaiting-drive-verification');
  if (!pending) return { status: 'not-needed' };
  try {
    const query = invoke || (() => {
      const script = '$ErrorActionPreference="Stop"; [Console]::OutputEncoding=[Text.Encoding]::UTF8; $started=$false; ' +
        '$t=Get-ScheduledTask -TaskName "SYNK Git 암호문 백업" -ErrorAction SilentlyContinue; ' +
        'if(-not $t){@{status="failed";code="GIT_ARCHIVE_TRANSFER_TASK_MISSING"}|ConvertTo-Json -Compress;exit}; ' +
        'if(-not $t.Settings.Enabled){@{status="failed";code="GIT_ARCHIVE_TRANSFER_TASK_DISABLED"}|ConvertTo-Json -Compress;exit}; ' +
        (apply ? 'if($t.State.ToString() -ne "Running"){Start-ScheduledTask -TaskName $t.TaskName; $started=$true; ' +
          '$t=Get-ScheduledTask -TaskName $t.TaskName}; ' : '') +
        'if($t.State.ToString() -ne "Running"){@{status="failed";code="GIT_ARCHIVE_TRANSFER_NOT_RUNNING"}|ConvertTo-Json -Compress;exit}; ' +
        '$i=Get-ScheduledTaskInfo -TaskName $t.TaskName; $age=([DateTime]::Now-$i.LastRunTime).TotalHours; ' +
        'if($age -lt -0.02 -or $age -gt 6){@{status="failed";code="GIT_ARCHIVE_TRANSFER_OVERDUE"}|ConvertTo-Json -Compress;exit}; ' +
        '$s="running";if($started){$s="started"}; ' +
        '@{status=$s;active=$true;enabled=$true;startedAt=$i.LastRunTime.ToUniversalTime().ToString("o")}|ConvertTo-Json -Compress';
      return JSON.parse(run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { timeout: 20000 }).toString('utf8').replace(/^\uFEFF/, ''));
    });
    const result = query({ apply });
    if (!['started', 'running', 'failed'].includes(result.status) ||
        (result.status === 'failed' && !/^GIT_ARCHIVE_TRANSFER_[A-Z_]+$/.test(result.code))) throw new Error('INVALID_TASK_RESPONSE');
    return { ...result, checkedAt: new Date().toISOString(), task: 'SYNK Git 암호문 백업' };
  } catch (_) { return { status: 'failed', code: 'GIT_ARCHIVE_TRANSFER_START_FAILED', checkedAt: new Date().toISOString() }; }
}
// 확인 실행(--check)은 묶음을 만들거나 ref를 올리지 못한다. 마지막 적용 실행 뒤에 처음 보인 커밋은 다음 적용 실행
// (2시간마다)이 맡으므로 실패로 세지 않고 따로 센다. 적용 실행에서 본 커밋은 그대로 엄격하게 본다(10-19).
function deferNewSinceApply(report, lastApply) {
  if (!lastApply || !lastApply.heads || typeof lastApply.heads !== 'object') return 0;
  let deferred = 0;
  for (const repo of report.repositories) {
    if (!Array.isArray(repo.refs) || repo.status === 'failed') continue;
    const seen = new Set(Array.isArray(lastApply.heads[repo.name]) ? lastApply.heads[repo.name] : []);
    for (const row of repo.refs) {
      if (['blocked-by-content-policy', 'public-origin-unpublished', 'ready'].includes(row.status) && !seen.has(row.sha)) {
        row.status = 'awaiting-next-apply'; deferred++;
      }
    }
    repo.status = repo.refs.some(row => ['blocked-by-content-policy', 'public-origin-unpublished', 'failed'].includes(row.status))
      ? 'attention' : repo.refs.some(row => row.status === 'ready') ? 'pending' : 'success';
  }
  return deferred;
}
function onlyArchiveTransferPending(report) {
  const accepted = new Set(['GIT_ARCHIVE_AWAITING_DRIVE', 'GIT_ARCHIVE_DRIVE_VERIFICATION_NOT_CURRENT']);
  return report.repositories.length > 0 && !report.repositories.some(repo => repo.status === 'failed') &&
    ['started', 'running'].includes(report.archiveTransfer?.status) && report.archiveTransfer.active === true &&
    report.archiveTransfer.enabled === true && report.issues.length > 0 && report.issues.every(issue => accepted.has(issue.code));
}
async function main(argv = process.argv.slice(2)) {
  let parent = path.join(os.homedir(), 'Documents'), state = path.join(parent, 'SYNK_원본창고', 'github-backup-status.json');
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') apply = true;
    else if (argv[i] === '--check') apply = false;
    else if (argv[i] === '--parent') parent = path.resolve(argv[++i]);
    else if (argv[i] === '--state') state = path.resolve(argv[++i]);
    else throw new Error('INVALID_ARGUMENT');
  }
  const unlock = acquireLock(state + '.lock');
  if (!unlock) { console.log(JSON.stringify({ component: 'github', status: 'already-running', state })); return 0; }
  try {
  const previous = fs.existsSync(state) ? JSON.parse(fs.readFileSync(state, 'utf8')) : {};
  const report = { schemaVersion: 1, component: 'github', mode: apply ? 'apply' : 'check',
    pid: process.pid, startedAt: new Date().toISOString(), checkedAt: new Date().toISOString(), status: 'running',
    lastSuccessAt: previous.lastSuccessAt || null, lastApply: previous.lastApply || null, repositories: [], issues: [] };
  atomicJson(state, report);
  const repos = fs.readdirSync(parent, { withFileTypes: true }).filter(entry => entry.isDirectory() &&
    !entry.isSymbolicLink() && fs.existsSync(path.join(parent, entry.name, '.git'))).map(entry => path.join(parent, entry.name));
  for (const repo of repos) {
    try { report.repositories.push(inspectRepository(repo, { apply, onProgress() {
      report.heartbeatAt = report.checkedAt = new Date().toISOString(); atomicJson(state, report);
    } })); }
    catch (error) { report.repositories.push({ name: path.basename(repo), path: repo, status: 'failed', code: error.message }); }
    report.heartbeatAt = report.checkedAt = new Date().toISOString();
    atomicJson(state, report);
  }
  await reconcileEncryptedArchives(report, state, apply);
  if (apply) report.lastApply = { at: report.startedAt,
    heads: Object.fromEntries(report.repositories.map(repo => [repo.name, (repo.refs || []).map(row => row.sha)])) };
  else report.awaitingNextApply = deferNewSinceApply(report, report.lastApply);
  report.protectedSources = await require('./보호소스보관.cjs').reconcile({ vault: path.dirname(state), root: path.resolve(__dirname, '..'), apply,
    appliedVersions: !apply && Array.isArray(report.lastApply?.protectedSources) ? new Set(report.lastApply.protectedSources) : null,
    onProgress() { report.heartbeatAt = report.checkedAt = new Date().toISOString(); atomicJson(state, report); } });
  if (apply) report.lastApply.protectedSources = (report.protectedSources.files || []).map(row => row.sourcePath + '\n' + row.sha256);
  report.archiveTransfer = requestArchiveTransfer(report, { apply });
  report.status = report.repositories.some(row => row.status === 'failed' || row.status === 'attention') ? 'attention'
    : report.repositories.some(row => row.status === 'pending') ? 'pending' : repos.length ? 'success' : 'failed';
  if (report.protectedSources.status !== 'success') report.status = 'attention';
  report.issues = report.repositories.flatMap(repo => repo.status === 'failed'
    ? [{ repository: repo.name, code: repo.code }]
    : (repo.refs || []).filter(row => ['blocked-by-content-policy', 'public-origin-unpublished', 'ready', 'failed'].includes(row.status))
      .map(row => ({ repository: repo.name, code: row.code || row.fallback?.code || row.status.replaceAll('-', '_').toUpperCase(), sha: row.sha,
        paths: row.check?.violations || [] })));
  report.issues.push(...report.protectedSources.issues.map(row => ({ ...row, component: 'protected-sources' })));
  if (report.archiveTransfer.status === 'failed') { report.status = 'attention'; report.issues.push({ code: report.archiveTransfer.code }); }
  if (onlyArchiveTransferPending(report)) {
    report.status = 'pending';
    for (const repo of report.repositories) if (repo.status === 'attention') repo.status = 'pending';
  }
  report.finishedAt = new Date().toISOString();
  if (report.status === 'success') report.lastSuccessAt = report.finishedAt;
  atomicJson(state, report);
  console.log(JSON.stringify({ component: report.component, status: report.status, state,
    repositories: report.repositories.map(row => ({ name: row.name, status: row.status, unpublishedCommits: row.unpublishedCommits,
      verified: row.refs?.filter(ref => ref.status === 'remote-verified').length, code: row.code })) }));
  return report.status === 'success' || report.status === 'pending' ? 0 : 1;
  } finally { unlock(); }
}
module.exports = { inspectRepository, inspectNewObjects, remoteIdentity, parseRefs, codeContentReason, acquireLock,
  reconcileEncryptedArchives, deferNewSinceApply, requestArchiveTransfer, onlyArchiveTransferPending, main, PREFIX };
if (require.main === module) main().then(code => { process.exitCode = code; }, () => {
  console.error('GITHUB_BACKUP_RUNNER_FAILED'); process.exitCode = 2;
});
