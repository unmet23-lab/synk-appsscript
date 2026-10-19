#!/usr/bin/env node
'use strict';
// Git-rejected history -> git bundle stdout -> existing public-key encryption.
// No plaintext bundle, checkout, commit, force push, or branch move is written.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { Transform } = require('node:stream');
const { acquireLock, parseRefs, remoteIdentity, PREFIX } = require('./GitHub백업.cjs');
const OID = /^[0-9a-f]{40}$/;
function gitReader(repo) {
  return (args, input) => execFileSync('git', ['--no-optional-locks', '-C', repo, ...args], { input,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1' },
    windowsHide: true, timeout: 120000, maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
}
function atomicJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n'); fs.renameSync(temp, file);
}
async function fileDigest(file) {
  let bytes = 0; const sha = crypto.createHash('sha256'), md5 = crypto.createHash('md5');
  for await (const chunk of fs.createReadStream(file)) { bytes += chunk.length; sha.update(chunk); md5.update(chunk); }
  return { bytes, sha256: sha.digest('hex'), md5: md5.digest('hex') };
}
function archiveRefs(record) {
  return (record.refs || []).filter(row => ['blocked-by-content-policy', 'public-origin-unpublished'].includes(row.status));
}
function selection(record, vault) {
  const identity = record.repository;
  const sourceMappings = [], names = new Map();
  for (const row of archiveRefs(record)) {
    for (const sourceRef of row.sourceRefs) {
      let ref = sourceRef;
      if (/^refs\/detached-(?:current-head|worktree\/[0-9a-f]{40})$/.test(sourceRef)) {
        ref = 'refs/synk-detached/' + row.sha;
        sourceMappings.push({ sourceRef, sha: row.sha, bundleRef: ref });
      } else if (!/^(?:refs\/heads\/|refs\/stash$)/.test(sourceRef)) continue;
      names.set(ref, row.sha);
    }
  }
  const heads = [...names].map(([ref, sha]) => ({ ref, sha })).sort((a, b) => a.ref.localeCompare(b.ref));
  const selectionHash = crypto.createHash('sha256').update(JSON.stringify({ identity, heads })).digest('hex');
  const relative = record.name + '/' + selectionHash + '.bundle.enc';
  const file = path.join(vault, 'Git-보관', relative), manifestFile = file.replace(/\.bundle\.enc$/, '.manifest.json');
  return { identity, heads, sourceMappings, selectionHash, relative, file, manifestFile };
}
function isolatedBundleRepository(repo, heads, stageDir) {
  fs.mkdirSync(stageDir, { recursive: true });
  const isolated = fs.mkdtempSync(path.join(stageDir, 'refs-'));
  const cleanup = () => {
    if (fs.existsSync(isolated) && path.dirname(fs.realpathSync(isolated)) === fs.realpathSync(stageDir) &&
        path.basename(isolated).startsWith('refs-')) fs.rmSync(isolated, { recursive: true, force: true });
  };
  try {
    const original = gitReader(repo), common = original(['rev-parse', '--path-format=absolute', '--git-common-dir']).toString().trim();
    execFileSync('git', ['init', '--bare', '--template=', isolated], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const own = gitReader(isolated);
    own(['config', 'core.hooksPath', path.join(isolated, 'no-hooks')]);
    fs.writeFileSync(path.join(isolated, 'objects', 'info', 'alternates'), path.join(common, 'objects').replaceAll('\\', '/') + '\n');
    for (const head of heads) {
      if (!OID.test(head.sha) || !head.ref.startsWith('refs/')) throw new Error('BUNDLE_REF_INVALID');
      own(['check-ref-format', head.ref]); own(['update-ref', head.ref, head.sha]);
    }
    return { path: isolated, cleanup };
  } catch (error) { cleanup(); throw error; }
}
async function existingReceipt(record, vault) {
  const selected = selection(record, vault);
  if (!selected.heads.length || !fs.existsSync(selected.manifestFile)) return null;
  const prior = JSON.parse(fs.readFileSync(selected.manifestFile, 'utf8'));
  const digest = await fileDigest(selected.file);
  if (prior.repository !== selected.identity || prior.selectionHash !== selected.selectionHash ||
      !Array.isArray(prior.heads) || prior.heads.length !== selected.heads.length ||
      selected.heads.some(head => !prior.heads.some(row => row.sha === head.sha && row.ref === head.ref)) ||
      prior.encrypted.sha256 !== digest.sha256 || prior.encrypted.md5 !== digest.md5 || prior.encrypted.bytes !== digest.bytes ||
      prior.relativePath !== selected.relative || prior.manifestRelativePath !== selected.relative.replace(/\.bundle\.enc$/, '.manifest.json'))
    throw new Error('BUNDLE_EXISTING_RECEIPT_MISMATCH');
  return { ...prior, reused: true, manifestPath: selected.manifestFile, filePath: selected.file };
}
// 지금 ref 조합과 다른, 앞선 적용 실행의 묶음 영수증(git-bundle-status.json에 적힌 것)을 같은 검사로 읽는다.
// 조합 해시는 보지 않고 저장소·경로·암호문 바이트만 맞춘다. 머리(head)별 보존 확인에만 쓴다(10-19).
async function receiptFromManifest(record, vault, manifestRelative) {
  if (typeof manifestRelative !== 'string' || manifestRelative.includes('..') || path.isAbsolute(manifestRelative) ||
      manifestRelative.includes('\\') || !manifestRelative.startsWith(record.name + '/') || !manifestRelative.endsWith('.manifest.json')) return null;
  const manifestFile = path.join(vault, 'Git-보관', manifestRelative);
  if (!fs.existsSync(manifestFile)) return null;
  const prior = JSON.parse(fs.readFileSync(manifestFile, 'utf8')), relative = manifestRelative.replace(/\.manifest\.json$/, '.bundle.enc');
  const file = path.join(vault, 'Git-보관', relative), digest = await fileDigest(file);
  if (prior.repository !== record.repository || prior.relativePath !== relative || prior.manifestRelativePath !== manifestRelative ||
      !Array.isArray(prior.heads) || prior.encrypted.sha256 !== digest.sha256 || prior.encrypted.md5 !== digest.md5 || prior.encrypted.bytes !== digest.bytes)
    throw new Error('BUNDLE_EXISTING_RECEIPT_MISMATCH');
  return { ...prior, reused: true, manifestPath: manifestFile, filePath: file };
}
function verifyPrerequisites(record, receipt) {
  if (!Array.isArray(receipt.requiredCommits) || !Array.isArray(receipt.prerequisites) ||
      receipt.requiredCommits.length !== receipt.prerequisites.length ||
      receipt.requiredCommits.some(sha => !OID.test(sha) || !receipt.prerequisites.some(row => row.sha === sha && row.ref === PREFIX + sha)))
    throw new Error('BUNDLE_PREREQUISITE_RECEIPT_INVALID');
  if (!record.private && (receipt.prerequisites.length || receipt.requiredCommits.length))
    throw new Error('PUBLIC_BUNDLE_MUST_BE_SELF_CONTAINED');
  if (!receipt.prerequisites.length) return;
  const remote = parseRefs(gitReader(record.path)(['ls-remote', '--refs', 'origin', PREFIX + '*']));
  if (receipt.prerequisites.some(required => !remote.some(row => row.sha === required.sha && row.ref === required.ref)))
    throw new Error('BUNDLE_PREREQUISITE_REMOTE_MISSING');
}
async function verifyDriveCoverage(receipt, vault, { now = Date.now(), verification = null } = {}) {
  const verificationPath = path.join(vault, '상태', 'Git-보관', 'verify-status.json');
  if (!verification && !fs.existsSync(verificationPath)) return { ok: false, code: 'GIT_ARCHIVE_AWAITING_DRIVE' };
  const evidence = verification || JSON.parse(fs.readFileSync(verificationPath, 'utf8'));
  if (!Object.keys(evidence).length) return { ok: false, code: 'GIT_ARCHIVE_AWAITING_DRIVE' };
  const at = Date.parse(evidence.checkedAt), finished = Date.parse(receipt.finishedAt);
  if (evidence.group !== 'Git-보관' || evidence.account !== '77yuhbs@gmail.com' ||
      !Number.isFinite(at) || !Number.isFinite(finished) || at > now + 60000 || !Array.isArray(evidence.verifiedFiles))
    return { ok: false, code: 'GIT_ARCHIVE_DRIVE_EVIDENCE_INVALID' };
  if (evidence.status !== 'success') return { ok: false, code: 'GIT_ARCHIVE_DRIVE_VERIFICATION_FAILED' };
  if (evidence.missing_or_bad !== 0 || evidence.historicalBad !== 0)
    return { ok: false, code: 'GIT_ARCHIVE_DRIVE_FILE_MISMATCH' };
  if (at < finished || now - at > 36 * 3600000)
    return { ok: false, code: 'GIT_ARCHIVE_DRIVE_VERIFICATION_NOT_CURRENT' };
  const paths = [receipt.relativePath, receipt.manifestRelativePath], confirmed = [];
  for (const relative of paths) {
    if (typeof relative !== 'string' || relative.includes('..') || path.isAbsolute(relative) || relative.includes('\\'))
      return { ok: false, code: 'GIT_ARCHIVE_PATH_INVALID' };
    const digest = await fileDigest(path.join(vault, 'Git-보관', relative));
    const row = evidence.verifiedFiles.find(value => value.path === relative);
    if (!row || typeof row.id !== 'string' || !row.id || row.ownedByMe !== true || row.trashed !== false ||
        row.bytes !== digest.bytes || row.sha256 !== digest.sha256 || row.md5 !== digest.md5 ||
        row.remoteMd5 !== digest.md5 || (row.remoteSha256 && row.remoteSha256 !== digest.sha256))
      return { ok: false, code: 'GIT_ARCHIVE_DRIVE_FILE_MISMATCH' };
    confirmed.push({ path: relative, id: row.id, ...digest });
  }
  return { ok: true, code: 'GIT_ARCHIVE_DRIVE_VERIFIED', account: evidence.account,
    checkedAt: evidence.checkedAt, verificationPath, files: confirmed, manifestPath: receipt.manifestPath };
}
function recordDriveCoverage(vault, receipts) {
  const file = path.join(vault, 'git-bundle-status.json');
  if (!fs.existsSync(file) || !receipts.length) return;
  const unlock = acquireLock(file + '.lock'); if (!unlock) return;
  try {
    const report = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const bundle of report.bundles || []) {
      const current = receipts.find(row => row.selectionHash === bundle.selectionHash && row.repository === bundle.repository);
      if (current) bundle.driveCoverage = current.driveCoverage;
    }
    report.status = report.bundles?.length && report.bundles.every(row => row.driveCoverage?.ok) ? 'success' : 'awaiting-drive-verification';
    report.pid = process.pid; report.checkedAt = report.finishedAt = new Date().toISOString();
    if (report.status === 'success') report.lastSuccessAt = report.finishedAt;
    atomicJson(file, report);
  } finally { unlock(); }
}
class BundleInspector extends Transform {
  constructor(heads) { super(); this.expected = heads; this.header = null; this.prefix = Buffer.alloc(0);
    this.packPrefix = Buffer.alloc(0); this.tail = Buffer.alloc(0); this.sha = crypto.createHash('sha1'); this.packBytes = 0; }
  pack(data) {
    if (this.packPrefix.length < 12) this.packPrefix = Buffer.concat([this.packPrefix, data]).subarray(0, 12);
    this.packBytes += data.length;
    const joined = Buffer.concat([this.tail, data]);
    if (joined.length > 20) { this.sha.update(joined.subarray(0, joined.length - 20)); this.tail = joined.subarray(joined.length - 20); }
    else this.tail = joined;
  }
  _transform(chunk, _encoding, done) {
    try {
      if (this.header === null) {
        this.prefix = Buffer.concat([this.prefix, chunk]);
        const end = this.prefix.indexOf('\n\n');
        if (end < 0) { if (this.prefix.length > 1024 * 1024) throw new Error('BUNDLE_HEADER_TOO_LARGE'); }
        else {
          this.header = this.prefix.subarray(0, end + 2);
          const lines = this.header.toString('utf8').split('\n').filter(Boolean);
          if (lines.shift() !== '# v2 git bundle') throw new Error('BUNDLE_FORMAT_MISMATCH');
          this.prerequisites = lines.filter(line => line.startsWith('-')).map(line => line.slice(1, 41));
          this.heads = lines.filter(line => !line.startsWith('-')).map(line => ({ sha: line.slice(0, 40), ref: line.slice(41) }));
          if (this.prerequisites.some(sha => !OID.test(sha)) || this.heads.length !== this.expected.length ||
              this.expected.some(expected => !this.heads.some(head => head.sha === expected.sha && head.ref === expected.ref)))
            throw new Error('BUNDLE_SOURCE_REF_MOVED');
          this.pack(this.prefix.subarray(end + 2)); this.prefix = Buffer.alloc(0);
        }
      } else this.pack(chunk);
      this.push(chunk); done();
    } catch (error) { done(error); }
  }
  _flush(done) {
    try {
      if (!this.header || this.packPrefix.length !== 12 || this.packPrefix.subarray(0, 4).toString() !== 'PACK' || this.tail.length !== 20)
        throw new Error('BUNDLE_PACK_MISSING');
      this.packVersion = this.packPrefix.readUInt32BE(4); this.objectCount = this.packPrefix.readUInt32BE(8);
      this.packSha1 = this.sha.digest('hex');
      if (![2, 3].includes(this.packVersion) || this.packSha1 !== this.tail.toString('hex')) throw new Error('BUNDLE_PACK_CHECKSUM_FAILED');
      done();
    } catch (error) { done(error); }
  }
}
async function createBundle({ repo, heads, exclusions, pubPem, encryptStream, staging, onHeader, timeoutMs = 15 * 60 * 1000 }) {
  const inspector = new BundleInspector(heads);
  const args = ['--no-optional-locks', '-C', repo, '-c', 'gc.auto=0', '-c', 'pack.threads=2',
    '-c', 'pack.windowMemory=32m', 'bundle', 'create', '--version=2', '-', '--stdin'];
  const child = spawn('git', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1' } });
  const completion = new Promise((resolve, reject) => { child.on('error', () => reject(new Error('GIT_BUNDLE_START_FAILED'))); child.on('close', resolve); });
  child.stdin.on('error', () => { inspector.destroy(new Error('GIT_BUNDLE_INPUT_FAILED')); });
  child.stdout.on('error', () => { inspector.destroy(new Error('GIT_BUNDLE_OUTPUT_FAILED')); });
  const timeout = setTimeout(() => child.kill(), timeoutMs);
  child.stdin.end(Buffer.from([...heads.map(row => row.ref), ...exclusions.map(sha => '^' + sha)].join('\n') + '\n'));
  child.stdout.pipe(inspector);
  try {
    const [plain, code] = await Promise.all([encryptStream(pubPem, inspector, staging, 'history.bundle'), completion]);
    if (code !== 0 || plain.bytes === 0) throw new Error('GIT_BUNDLE_CREATE_FAILED');
    // git bundle verify accepts stdin and checks this exact header's prerequisites.
    gitReader(repo)(['bundle', 'verify', '-'], inspector.header);
    if (onHeader) await onHeader(inspector);
    return { plaintext: plain, pack: { bytes: inspector.packBytes, version: inspector.packVersion,
      objects: inspector.objectCount, sha1: inspector.packSha1 }, heads: inspector.heads,
      requiredCommits: inspector.prerequisites, headerVerified: true, decryptionVerified: false };
  } finally { clearTimeout(timeout); if (child.exitCode === null) child.kill(); }
}
async function preserveRecord(record, vault, cryptoTool, onProgress = () => {}, { git: suppliedGit, github } = {}) {
  const git = suppliedGit || gitReader(record.path);
  const identity = remoteIdentity(git(['remote', 'get-url', 'origin']).toString().trim());
  if (!identity || identity !== record.repository || remoteIdentity(git(['remote', 'get-url', '--push', 'origin']).toString().trim()) !== identity)
    throw new Error('BUNDLE_ORIGIN_MISMATCH');
  const info = github || JSON.parse(execFileSync('gh', ['api', `repos/${identity}`, '--jq', '{private: .private, full_name: .full_name}'],
    { windowsHide: true, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] }));
  if (typeof info.private !== 'boolean' || info.full_name.toLowerCase() !== identity.toLowerCase()) throw new Error('BUNDLE_ORIGIN_IDENTITY_INVALID');
  if (info.private !== record.private) throw new Error('BUNDLE_ORIGIN_VISIBILITY_CHANGED');
  const { heads, sourceMappings, selectionHash, relative, file, manifestFile } = selection(record, vault);
  if (!heads.length) return null;
  // 훑은 뒤 묶기 전에 다른 세션이 가지를 옮겨도(공용 master에는 1~2분마다 커밋이 쌓인다) 훑은 그 커밋을 묶는다.
  // 커밋이 원 저장소에 있는지만 보고, 아래에서 늘 그 커밋에 고정한 임시 bare 저장소로 묶는다. 옮겨 간 새 커밋은 다음 적용 실행이 묶는다(10-19).
  for (const row of heads) git(['cat-file', '-e', row.sha + '^{commit}']);
  const prior = await existingReceipt(record, vault);
  if (prior) { verifyPrerequisites(record, prior); return prior; }
  if (fs.existsSync(file)) throw new Error('BUNDLE_UNRECEIPTED_DESTINATION');
  const remoteRefs = parseRefs(git(['ls-remote', '--refs', 'origin']));
  const ids = [...new Set(remoteRefs.map(row => row.sha))];
  // Public origins never receive backup refs. Include complete ancestry so a
  // future rewrite/deletion of a public branch cannot invalidate this archive.
  const exclusions = info.private ? git(['cat-file', '--batch-check=%(objectname) %(objecttype)'], Buffer.from(ids.join('\n') + '\n'))
    .toString().trim().split('\n').filter(line => line.endsWith(' commit')).map(line => line.split(' ')[0]) : [];
  if (info.private && !exclusions.length && remoteRefs.length) throw new Error('BUNDLE_REMOTE_PREREQUISITES_MISSING');
  const stageDir = path.join(vault, '.git-bundle-staging'); fs.mkdirSync(stageDir, { recursive: true });
  const staging = path.join(stageDir, crypto.randomUUID() + '.enc');
  const pinned = [];
  const createdAt = new Date().toISOString();
  const isolated = isolatedBundleRepository(record.path, heads, stageDir);
  let detail;
  try { detail = await createBundle({ repo: isolated.path, heads, exclusions, staging,
    pubPem: fs.readFileSync(cryptoTool.PUB(), 'utf8'), encryptStream: cryptoTool.encryptStream,
    onHeader(inspector) {
      if (!info.private && inspector.prerequisites.length) throw new Error('PUBLIC_BUNDLE_MUST_BE_SELF_CONTAINED');
      for (const sha of inspector.prerequisites) {
        const ref = PREFIX + sha;
        const present = remoteRefs.find(row => row.ref === ref);
        if (present && present.sha !== sha) throw new Error('BUNDLE_PREREQUISITE_COLLISION');
        // A bundle prerequisite is already reachable from the verified remote set.
        if (!present) git(['push', '--porcelain', 'origin', `${sha}:${ref}`]);
        const verified = parseRefs(git(['ls-remote', '--refs', 'origin', ref]));
        if (verified.length !== 1 || verified[0].ref !== ref || verified[0].sha !== sha) throw new Error('BUNDLE_PREREQUISITE_VERIFY_FAILED');
        pinned.push({ sha, ref, verifiedAt: new Date().toISOString() });
        onProgress();
      }
    } }); } finally { isolated.cleanup(); }
  const encrypted = await fileDigest(staging);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.copyFileSync(staging, file, fs.constants.COPYFILE_EXCL);
  const copied = await fileDigest(file);
  if (copied.sha256 !== encrypted.sha256 || copied.bytes !== encrypted.bytes) throw new Error('BUNDLE_ENCRYPTED_COPY_MISMATCH');
  const receipt = { schemaVersion: 1, repository: identity, selectionHash, createdAt,
    finishedAt: new Date().toISOString(), status: 'awaiting-drive-verification', group: 'Git-보관',
    relativePath: relative, manifestRelativePath: path.relative(path.join(vault, 'Git-보관'), manifestFile).replaceAll('\\', '/'),
    encrypted, ...detail, ...(sourceMappings.length ? { sourceMappings } : {}), prerequisites: pinned,
    ...(info.private ? {} : { originVisibility: 'public', selfContained: true, remoteWrites: false }),
    restore: { encryptedWithExistingUserKey: true, noPlaintextFileWritten: true,
      instruction: info.private
        ? 'Decrypt with the existing locked key and password. Fetch each prerequisite ref from the original private GitHub repository, then run git bundle verify and fetch this bundle in a separate clone.'
        : 'Decrypt with the existing locked key and password. This public-origin archive has no prerequisites; verify and fetch it into a separate empty repository.' } };
  atomicJson(manifestFile, receipt);
  // Only this invocation's encrypted staging file is removed after two byte checks.
  if (path.dirname(staging) === stageDir && fs.existsSync(staging)) fs.unlinkSync(staging);
  return { ...receipt, manifestPath: manifestFile, filePath: file };
}
async function main(argv = process.argv.slice(2)) {
  let vault = path.join(os.homedir(), 'Documents', 'SYNK_원본창고'), state;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--vault') vault = path.resolve(argv[++i]);
    else if (argv[i] === '--state') state = path.resolve(argv[++i]);
    else throw new Error('BUNDLE_ARGUMENT_INVALID');
  }
  state ||= path.join(vault, 'github-backup-status.json');
  const unlock = acquireLock(path.join(vault, 'git-bundle-status.json.lock'));
  if (!unlock) return 0;
  try {
    const report = JSON.parse(fs.readFileSync(state, 'utf8')), cryptoTool = require(path.join(vault, '암호.js'));
    const status = { schemaVersion: 1, component: 'git-encrypted-archive', pid: process.pid,
      startedAt: new Date().toISOString(), checkedAt: new Date().toISOString(), heartbeatAt: new Date().toISOString(), status: 'running', bundles: [] };
    const destination = path.join(vault, 'git-bundle-status.json'); atomicJson(destination, status);
    const heartbeat = setInterval(() => { status.checkedAt = status.heartbeatAt = new Date().toISOString(); atomicJson(destination, status); }, 15000);
    try {
      for (const record of report.repositories.filter(repo => archiveRefs(repo).length)) {
        const receipt = await preserveRecord(record, vault, cryptoTool, () => {
          status.checkedAt = status.heartbeatAt = new Date().toISOString(); atomicJson(destination, status);
        });
        if (receipt) {
          receipt.driveCoverage = await verifyDriveCoverage(receipt, vault);
          status.bundles.push(receipt);
        }
      }
      status.status = status.bundles.every(row => row.driveCoverage.ok) ? 'success' : 'awaiting-drive-verification';
      status.checkedAt = status.finishedAt = new Date().toISOString();
      if (status.status === 'success') status.lastSuccessAt = status.finishedAt;
      atomicJson(destination, status);
      console.log(JSON.stringify({ status: status.status, bundles: status.bundles.map(row => ({ repository: row.repository,
        filePath: row.filePath, manifestPath: row.manifestPath, bytes: row.encrypted.bytes, sha256: row.encrypted.sha256, reused: row.reused || false })) }));
      return 0;
    } catch (error) {
      status.status = 'failed'; status.code = 'GIT_ENCRYPTED_BUNDLE_FAILED'; status.finishedAt = new Date().toISOString();
      if (/^[A-Z][A-Z0-9_]{2,80}$/.test(error.message)) status.detailCode = error.message;
      atomicJson(destination, status); return 1;
    } finally { clearInterval(heartbeat); }
  } finally { unlock(); }
}
if (require.main === module) main().then(code => { process.exitCode = code; }, () => { console.error('GIT_ENCRYPTED_BUNDLE_FAILED'); process.exitCode = 1; });
module.exports = { BundleInspector, createBundle, preserveRecord, existingReceipt, receiptFromManifest, verifyPrerequisites, verifyDriveCoverage,
  recordDriveCoverage, archiveRefs, fileDigest, selection, isolatedBundleRepository, main };
