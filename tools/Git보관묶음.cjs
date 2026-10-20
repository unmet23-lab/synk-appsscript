#!/usr/bin/env node
'use strict';
// Git-rejected history -> git bundle stdout -> existing public-key encryption.
// No plaintext bundle, checkout, commit, force push, or branch move is written.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { Transform } = require('node:stream');
const { acquireLock, parseRefs, remoteIdentity, replaceFile, PREFIX } = require('./GitHub백업.cjs');
const OID = /^[0-9a-f]{40}$/;
function gitReader(repo) {
  return (args, input) => {
    try {
      return execFileSync('git', ['--no-optional-locks', '-C', repo, ...args], { input,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1' },
        windowsHide: true, timeout: 120000, maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) {
      // git 출력에는 주소·자격 정보가 섞일 수 있다. GitHub백업.cjs처럼 고정 코드만 남기되, 어느 명령이 실패했는지와
      // 시간 초과인지는 남긴다. 예약 실행의 묶음 실패가 코드 없이 끝나 원인을 볼 수 없었다(10-19).
      throw new Error('GIT_' + String(args[0]).toUpperCase().replace(/[^A-Z]+/g, '_') + (error.code === 'ETIMEDOUT' ? '_TIMEOUT' : '_FAILED'));
    }
  };
}
function atomicJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n'); replaceFile(temp, file);
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
// 이 저장소의 앞선 묶음 영수증 전부(검증 여부와 상관없이, 형식이 맞는 것만). 영수증은 만든 뒤 바뀌지 않는다.
function bundleReceipts(record, vault) {
  const dir = path.join(vault, 'Git-보관', record.name);
  let names = [];
  try { names = fs.readdirSync(dir).filter(name => /^[0-9a-f]{64}\.manifest\.json$/.test(name)); } catch (_) { return []; }
  const receipts = [];
  for (const name of names) {
    try {
      const receipt = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      const relative = record.name + '/' + name.replace(/\.manifest\.json$/, '.bundle.enc');
      if (receipt.repository !== record.repository || receipt.relativePath !== relative ||
          receipt.manifestRelativePath !== record.name + '/' + name || !Array.isArray(receipt.heads) || !receipt.heads.length ||
          receipt.heads.some(head => !OID.test(String(head?.sha)) || typeof head.ref !== 'string') || !receipt.encrypted ||
          (receipt.chain !== undefined && !Array.isArray(receipt.chain))) continue;
      receipts.push({ ...receipt, manifestPath: path.join(dir, name), filePath: path.join(dir, relative.slice(record.name.length + 1)) });
    } catch (_) { /* 깨진 영수증은 바탕으로 쓰지 않는다 */ }
  }
  return receipts.sort((a, b) => String(a.finishedAt).localeCompare(String(b.finishedAt)));
}
// Drive 검증을 마친 앞선 묶음(증분 묶음의 바탕). 영수증의 암호문 지문이 Drive 검증 기록의 지문과 같고, 그 묶음이 기대는
// 앞 묶음(chain)도 모두 검증됐을 때만 바탕이 된다. 묶음 파일은 다시 읽지 않는다 — 복원에 쓰는 것은 Drive 사본이고 검증 기록이
// 그 바이트(크기·MD5·SHA-256)를 확인했다. 영수증 파일은 작으니 다시 해시해 검증 기록과 맞춘다(10-20).
// git·remoteRefs를 주면 그 묶음의 선행 커밋이 원격에 아직 있는지(공개 ref에서 닿는지, 고정 ref가 그대로인지)도 본다.
async function verifiedBundles(record, vault, { now = Date.now(), verification = null, git = null, remoteRefs = null, remoteTips = null } = {}) {
  const verificationPath = path.join(vault, '상태', 'Git-보관', 'verify-status.json');
  let evidence = verification;
  if (!evidence) { try { evidence = JSON.parse(fs.readFileSync(verificationPath, 'utf8')); } catch (_) { return []; } }
  const at = Date.parse(evidence.checkedAt);
  if (evidence.group !== 'Git-보관' || evidence.account !== '77yuhbs@gmail.com' || evidence.status !== 'success' ||
      evidence.missing_or_bad !== 0 || evidence.historicalBad !== 0 || !Array.isArray(evidence.verifiedFiles) ||
      !Number.isFinite(at) || at > now + 60000 || now - at > 36 * 3600000) return [];
  const rows = new Map(evidence.verifiedFiles.map(row => [row.path, row]));
  const remoteOk = (row, digest) => row && typeof row.id === 'string' && row.id && row.ownedByMe === true && row.trashed === false &&
    row.bytes === digest.bytes && row.sha256 === digest.sha256 && row.md5 === digest.md5 && row.remoteMd5 === digest.md5 &&
    (!row.remoteSha256 || row.remoteSha256 === digest.sha256);
  const all = bundleReceipts(record, vault), byManifest = new Map(all.map(r => [r.manifestRelativePath, r])), memo = new Map();
  let prerequisitesHold = () => true;
  if (git && remoteRefs) {
    const tips = remoteTips || presentCommits(git, remoteRefs), refs = new Map(remoteRefs.map(row => [row.ref, row.sha]));
    const wanted = [...new Set(all.flatMap(receipt => (receipt.prerequisites || []).filter(row => row.public === true).map(row => row.sha)))].filter(sha => OID.test(sha));
    const present = new Set(wanted.length ? git(['cat-file', '--batch-check=%(objectname) %(objecttype)'], Buffer.from(wanted.join('\n') + '\n'))
      .toString().trim().split('\n').filter(line => line.endsWith(' commit')).map(line => line.split(' ')[0]) : []);
    const unreachable = uncoveredShas(git, [...present], tips);
    prerequisitesHold = receipt => (receipt.prerequisites || []).every(row => row.bundle ? (receipt.chain || []).includes(row.bundle)
      : row.public === true ? present.has(row.sha) && !unreachable.has(row.sha) : refs.get(row.ref) === row.sha);
  }
  const localOk = receipt => { try { return fs.statSync(receipt.filePath).size === receipt.encrypted.bytes; } catch (_) { return false; } };
  const check = async (receipt, depth = 0) => {
    if (memo.has(receipt.manifestRelativePath)) return memo.get(receipt.manifestRelativePath);
    memo.set(receipt.manifestRelativePath, false); // 순환·깊은 사슬은 바탕이 못 된다
    let ok = depth < 4096 && Date.parse(receipt.finishedAt) <= at && remoteOk(rows.get(receipt.relativePath), receipt.encrypted) &&
      localOk(receipt) && prerequisitesHold(receipt);
    if (ok) ok = remoteOk(rows.get(receipt.manifestRelativePath), await fileDigest(receipt.manifestPath));
    for (const dependency of ok ? receipt.chain || [] : []) {
      const earlier = byManifest.get(dependency);
      if (!earlier || !(await check(earlier, depth + 1))) { ok = false; break; }
    }
    memo.set(receipt.manifestRelativePath, ok);
    return ok;
  };
  const verified = [];
  for (const receipt of all) if (await check(receipt)) verified.push(receipt);
  return verified;
}
// heads 가운데 tips에서 닿지 않는 커밋(= tips가 담지 않은 머리)을 한 번의 rev-list로 고른다.
function uncoveredShas(git, shas, tips) {
  const wanted = [...new Set(shas)];
  if (!wanted.length) return new Set();
  if (!tips.length) return new Set(wanted);
  const reachable = new Set(git(['rev-list', '--stdin'], Buffer.from([...wanted, ...[...new Set(tips)].map(sha => '^' + sha)].join('\n') + '\n'))
    .toString().split(/\s+/).filter(Boolean));
  return new Set(wanted.filter(sha => reachable.has(sha)));
}
// 검증된 앞 묶음들의 머리 가운데 이 저장소에 있는 커밋(rev-list의 ^에 쓸 수 있는 것).
function chainHeads(git, chain) {
  const ids = [...new Set(chain.flatMap(receipt => receipt.heads.map(head => head.sha)).filter(sha => OID.test(sha)))];
  if (!ids.length) return [];
  return git(['cat-file', '--batch-check=%(objectname) %(objecttype)'], Buffer.from(ids.join('\n') + '\n'))
    .toString().trim().split('\n').filter(line => line.endsWith(' commit')).map(line => line.split(' ')[0]);
}
// 원격 ref가 가리키는 커밋 가운데 이 저장소에 있는 것만 고른다(아직 받지 않은 끝은 뺀다).
function presentCommits(git, remoteRefs) {
  const ids = [...new Set(remoteRefs.map(row => row.sha))];
  if (!ids.length) return [];
  return git(['cat-file', '--batch-check=%(objectname) %(objecttype)'], Buffer.from(ids.join('\n') + '\n'))
    .toString().trim().split('\n').filter(line => line.endsWith(' commit')).map(line => line.split(' ')[0]);
}
// sha가 원격 끝(tips) 가운데 하나에서 닿는지 한 번에 본다: `rev-list <sha> ^<끝>…`이 비면 닿는다.
function reachedBy(git, tips, sha) {
  if (!tips.length) return false;
  if (tips.includes(sha)) return true;
  return !git(['rev-list', '--max-count=1', '--stdin'], Buffer.from([sha, ...tips.map(tip => '^' + tip)].join('\n') + '\n')).toString().trim();
}
// 공개 원격의 선행 커밋에 닿는 원격 ref 하나(가지 먼저). 복원할 때 그 공개 저장소를 받으면 선행 커밋이 따라온다.
function reachingRef(git, remoteRefs, tips, sha) {
  if (!reachedBy(git, tips, sha)) return null;
  const present = new Set(tips);
  return remoteRefs.filter(row => present.has(row.sha))
    .sort((a, b) => Number(b.ref.startsWith('refs/heads/')) - Number(a.ref.startsWith('refs/heads/')))
    .find(row => reachedBy(git, [row.sha], sha)) || null;
}
function verifyPrerequisites(record, receipt) {
  // 선행 커밋 행은 세 가지다. 비공개 원격에 refs/synk-backup/<sha>로 고정한 행, 공개 원격에는 쓰지 않으므로
  // 그 커밋에 닿는 공개 ref만 적은 행(public: true, 10-19), 앞선 묶음(chain)에 든 커밋을 적은 행(bundle, 10-20 증분).
  // 저장소 공개 여부가 나중에 바뀌어도 행 종류대로 확인한다.
  const pinnedRow = (row, sha) => row.sha === sha && row.ref === PREFIX + sha;
  const publicRow = (row, sha) => row.sha === sha && row.public === true && typeof row.ref === 'string' && row.ref.startsWith('refs/');
  const chain = Array.isArray(receipt.chain) ? receipt.chain : [];
  const bundleRow = (row, sha) => row.sha === sha && typeof row.bundle === 'string' && chain.includes(row.bundle);
  if (!Array.isArray(receipt.requiredCommits) || !Array.isArray(receipt.prerequisites) ||
      receipt.requiredCommits.length !== receipt.prerequisites.length ||
      receipt.requiredCommits.some(sha => !OID.test(sha) || !receipt.prerequisites.some(row => pinnedRow(row, sha) || publicRow(row, sha) || bundleRow(row, sha))))
    throw new Error('BUNDLE_PREREQUISITE_RECEIPT_INVALID');
  // 앞선 묶음의 영수증이 이 영수증 옆에 그대로 있어야 이어서 되살릴 수 있다.
  if (chain.length && receipt.manifestPath) {
    const vaultDir = path.dirname(path.dirname(receipt.manifestPath));
    for (const relative of chain) {
      if (typeof relative !== 'string' || relative.includes('..') || path.isAbsolute(relative) || relative.includes('\\') ||
          !fs.existsSync(path.join(vaultDir, relative))) throw new Error('BUNDLE_CHAIN_RECEIPT_MISSING');
    }
  }
  if (!receipt.prerequisites.some(row => !row.bundle)) return;
  const git = gitReader(record.path);
  const pinned = receipt.prerequisites.filter(row => pinnedRow(row, row.sha));
  if (pinned.length) {
    const remote = parseRefs(git(['ls-remote', '--refs', 'origin', PREFIX + '*']));
    if (pinned.some(required => !remote.some(row => row.sha === required.sha && row.ref === required.ref)))
      throw new Error('BUNDLE_PREREQUISITE_REMOTE_MISSING');
  }
  const published = receipt.prerequisites.filter(row => publicRow(row, row.sha));
  if (published.length) {
    const tips = presentCommits(git, parseRefs(git(['ls-remote', '--refs', 'origin'])));
    if (published.some(required => !reachedBy(git, tips, required.sha))) throw new Error('BUNDLE_PREREQUISITE_REMOTE_MISSING');
  }
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
// 미게시 머리(archiveRefs)마다 Drive에 보존됐는지(10-20). Drive 검증을 마친 묶음 사슬에서 닿으면 보존된 것이다 — 그 머리를
// 담은 묶음이든, 이름만 새로 붙은 가지가 가리키는 이미 묶은 커밋이든. 아니면 그 머리를 담은 가장 새 묶음의 Drive 상태를 낸다
// (막 만들어 아직 올리지 않은 묶음은 GIT_ARCHIVE_AWAITING_DRIVE). 어느 묶음에도 없으면 GIT_ARCHIVE_NOT_CREATED.
async function archiveCoverage(record, vault, { git = gitReader(record.path), now = Date.now(), verification = null } = {}) {
  const remoteRefs = parseRefs(git(['ls-remote', '--refs', 'origin'])), remoteTips = presentCommits(git, remoteRefs);
  const chain = await verifiedBundles(record, vault, { now, verification, git, remoteRefs, remoteTips });
  const rows = archiveRefs(record), result = new Map(), checked = [], cached = new Map();
  const notCovered = chain.length ? uncoveredShas(git, rows.map(row => row.sha), chainHeads(git, chain)) : new Set(rows.map(row => row.sha));
  const evidenceAt = chain.length ? (verification || JSON.parse(fs.readFileSync(path.join(vault, '상태', 'Git-보관', 'verify-status.json'), 'utf8'))).checkedAt : null;
  const holders = bundleReceipts(record, vault).reverse();
  for (const row of rows) {
    if (!notCovered.has(row.sha)) {
      result.set(row.sha, { ok: true, code: 'GIT_ARCHIVE_DRIVE_VERIFIED', account: '77yuhbs@gmail.com', checkedAt: evidenceAt, chainBundles: chain.length });
      continue;
    }
    const holder = holders.find(receipt => receipt.heads.some(head => head.sha === row.sha));
    if (!holder) { result.set(row.sha, { ok: false, code: 'GIT_ARCHIVE_NOT_CREATED' }); continue; }
    if (!cached.has(holder)) {
      let coverage;
      try {
        verifyPrerequisites(record, holder);
        coverage = await verifyDriveCoverage(holder, vault, { now, verification });
        // Drive에는 있는데 사슬에 못 든 묶음 — 기대는 앞 묶음이나 선행 커밋이 확인되지 않았다.
        if (coverage.ok) coverage = { ok: false, code: 'GIT_ARCHIVE_CHAIN_NOT_VERIFIED' };
      } catch (error) { coverage = { ok: false, code: /^[A-Z][A-Z0-9_]{2,80}$/.test(error.message) ? error.message : 'GIT_ARCHIVE_VERIFY_FAILED' }; }
      cached.set(holder, coverage);
      checked.push({ ...holder, driveCoverage: coverage });
    }
    result.set(row.sha, cached.get(holder));
  }
  return { rows: result, checked, chain };
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
  let info = github;
  if (!info) {
    try {
      info = JSON.parse(execFileSync('gh', ['api', `repos/${identity}`, '--jq', '{private: .private, full_name: .full_name}'],
        { windowsHide: true, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] }));
    } catch (error) { throw new Error(error.code === 'ETIMEDOUT' ? 'GITHUB_API_TIMEOUT' : 'GITHUB_API_FAILED'); }
  }
  if (typeof info.private !== 'boolean' || info.full_name.toLowerCase() !== identity.toLowerCase()) throw new Error('BUNDLE_ORIGIN_IDENTITY_INVALID');
  if (info.private !== record.private) throw new Error('BUNDLE_ORIGIN_VISIBILITY_CHANGED');
  const full = selection(record, vault);
  if (!full.heads.length) return null;
  // 훑은 뒤 묶기 전에 다른 세션이 가지를 옮겨도(공용 master에는 1~2분마다 커밋이 쌓인다) 훑은 그 커밋을 묶는다.
  // 커밋이 원 저장소에 있는지만 보고, 아래에서 늘 그 커밋에 고정한 임시 bare 저장소로 묶는다. 옮겨 간 새 커밋은 다음 적용 실행이 묶는다(10-19).
  for (const row of full.heads) git(['cat-file', '-e', row.sha + '^{commit}']);
  const prior = await existingReceipt(record, vault);
  if (prior) { verifyPrerequisites(record, prior); return prior; }
  const remoteRefs = parseRefs(git(['ls-remote', '--refs', 'origin']));
  // 원격에 이미 있는 커밋은 공개 여부와 상관없이 뺀다. 비공개 원격은 경계 커밋을 refs/synk-backup에 고정하고,
  // 공개 원격은 쓰지 않으므로 경계 커밋에 닿는 공개 ref만 적는다. 공개 원격도 전체 이력을 담으면 SYNK-appsscript는
  // 실행마다 6.9GB 묶음이 됐다(10-19). 공개 원격의 끝이 이 저장소에 하나도 없을 때만 예전처럼 전체 이력을 담는다.
  const remoteTips = presentCommits(git, remoteRefs);
  if (info.private && !remoteTips.length && remoteRefs.length) throw new Error('BUNDLE_REMOTE_PREREQUISITES_MISSING');
  // 증분(10-20): Drive 검증을 마친 앞 묶음들의 머리도 선행 조건으로 뺀다. 미게시 가지 약 100개(138MiB)가 2시간마다 새
  // 묶음에 통째로 다시 들어가 10-19 뒤 23개·3.9GB가 쌓였다. 이제는 그 뒤에 생긴 객체만 묶고, 모두 앞 묶음에 들었으면 묶지 않는다.
  const chain = await verifiedBundles(record, vault, { git, remoteRefs, remoteTips });
  const bases = chainHeads(git, chain);
  const uncovered = uncoveredShas(git, full.heads.map(head => head.sha), [...remoteTips, ...bases]);
  const heads = full.heads.filter(head => uncovered.has(head.sha));
  const coveredHeads = full.heads.filter(head => !uncovered.has(head.sha));
  if (!heads.length) return { schemaVersion: 1, repository: identity, coveredOnly: true, checkedAt: new Date().toISOString(),
    coveredHeads, chain: chain.map(receipt => receipt.manifestRelativePath) };
  // 앞 묶음에 기대는 증분 묶음은 그 바탕까지 이름(조합 해시)에 넣는다 — 같은 머리라도 바탕이 다르면 다른 묶음이다.
  const named = heads.length === full.heads.length && !bases.length ? full : (() => {
    const selectionHash = crypto.createHash('sha256').update(JSON.stringify({ identity: full.identity, heads,
      chain: chain.map(receipt => receipt.manifestRelativePath) })).digest('hex');
    const relative = record.name + '/' + selectionHash + '.bundle.enc', file = path.join(vault, 'Git-보관', relative);
    return { ...full, heads, selectionHash, relative, file, manifestFile: file.replace(/\.bundle\.enc$/, '.manifest.json') };
  })();
  const { sourceMappings, selectionHash, relative, file, manifestFile } = named;
  if (named !== full && fs.existsSync(manifestFile)) {
    const again = await receiptFromManifest(record, vault, relative.replace(/\.bundle\.enc$/, '.manifest.json'));
    if (again) { verifyPrerequisites(record, again); return again; }
  }
  if (fs.existsSync(file)) throw new Error('BUNDLE_UNRECEIPTED_DESTINATION');
  const exclusions = [...new Set([...remoteTips, ...bases])];
  const stageDir = path.join(vault, '.git-bundle-staging'); fs.mkdirSync(stageDir, { recursive: true });
  const staging = path.join(stageDir, crypto.randomUUID() + '.enc');
  const pinned = [];
  let baseHeads = null;
  const createdAt = new Date().toISOString();
  const isolated = isolatedBundleRepository(record.path, heads, stageDir);
  let detail;
  try { detail = await createBundle({ repo: isolated.path, heads, exclusions, staging,
    pubPem: fs.readFileSync(cryptoTool.PUB(), 'utf8'), encryptStream: cryptoTool.encryptStream,
    onHeader(inspector) {
      for (const sha of inspector.prerequisites) {
        // 원격에서 닿지 않는 선행 커밋은 앞 묶음에 든 것이다. 원격에 쓰지 않는다(비공개 원격이라도 — 그 커밋은 원격에 못 올린
        // 내용 때문에 묶음으로 보존한 것일 수 있다). 그 커밋에 닿는 가장 이른 앞 묶음을 적는다.
        if (bases.length && !reachedBy(git, remoteTips, sha)) {
          baseHeads ||= new Map(chain.map(receipt => [receipt, chainHeads(git, [receipt])]));
          const source = chain.find(receipt => reachedBy(git, baseHeads.get(receipt), sha));
          if (!source) throw new Error('BUNDLE_PREREQUISITE_CHAIN_MISSING');
          pinned.push({ sha, bundle: source.manifestRelativePath, verifiedAt: new Date().toISOString() });
          onProgress();
          continue;
        }
        if (!info.private) {
          const reaching = reachingRef(git, remoteRefs, remoteTips, sha);
          if (!reaching) throw new Error('BUNDLE_PREREQUISITE_REMOTE_MISSING');
          pinned.push({ sha, ref: reaching.ref, public: true, verifiedAt: new Date().toISOString() });
          onProgress();
          continue;
        }
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
  // 되살릴 때 먼저 받을 앞 묶음: 선행 커밋을 담은 묶음과, 그 묶음이 기대는 묶음 전부(만든 차례).
  const needed = new Set(pinned.filter(row => row.bundle).map(row => row.bundle));
  for (const receipt of [...chain].reverse()) if (needed.has(receipt.manifestRelativePath)) for (const earlier of receipt.chain || []) needed.add(earlier);
  const ordered = chain.map(receipt => receipt.manifestRelativePath).filter(relativePath => needed.has(relativePath));
  const sourceMappingsHere = (sourceMappings || []).filter(row => heads.some(head => head.ref === row.bundleRef));
  const receipt = { schemaVersion: 1, repository: identity, selectionHash, createdAt,
    finishedAt: new Date().toISOString(), status: 'awaiting-drive-verification', group: 'Git-보관',
    relativePath: relative, manifestRelativePath: path.relative(path.join(vault, 'Git-보관'), manifestFile).replaceAll('\\', '/'),
    encrypted, ...detail, ...(sourceMappingsHere.length ? { sourceMappings: sourceMappingsHere } : {}), prerequisites: pinned,
    ...(ordered.length ? { chain: ordered } : {}), ...(coveredHeads.length ? { coveredHeads } : {}),
    ...(info.private ? {} : { originVisibility: 'public', selfContained: !pinned.length, remoteWrites: false }),
    restore: { encryptedWithExistingUserKey: true, noPlaintextFileWritten: true,
      instruction: (ordered.length
        ? 'Restore the bundles listed in chain first, in that order, each the same way (their manifests sit in this folder and on Drive); coveredHeads name refs whose commits are already inside those bundles. Then: '
        : '') + (info.private
        ? 'Decrypt with the existing locked key and password. Fetch each prerequisite ref from the original private GitHub repository, then run git bundle verify and fetch this bundle in a separate clone.'
        : pinned.length
          ? 'Decrypt with the existing locked key and password. Clone the public GitHub repository, which holds every public prerequisite commit, then run git bundle verify and fetch this bundle in that clone.'
          : 'Decrypt with the existing locked key and password. This public-origin archive has no prerequisites; verify and fetch it into a separate empty repository.') } };
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
    let current = null;
    try {
      for (const record of report.repositories.filter(repo => archiveRefs(repo).length)) {
        current = record.name;
        const receipt = await preserveRecord(record, vault, cryptoTool, () => {
          status.checkedAt = status.heartbeatAt = new Date().toISOString(); atomicJson(destination, status);
        });
        if (receipt?.coveredOnly) {
          // 새 객체가 없다 — 모든 머리가 Drive 검증을 마친 앞 묶음에 들었다. 새 묶음을 만들지 않는다(10-20).
          (status.covered ||= []).push({ repository: receipt.repository, heads: receipt.coveredHeads.length, chainBundles: receipt.chain.length });
        } else if (receipt) {
          receipt.driveCoverage = await verifyDriveCoverage(receipt, vault);
          status.bundles.push(receipt);
        }
      }
      status.status = status.bundles.every(row => row.driveCoverage.ok) ? 'success' : 'awaiting-drive-verification';
      status.checkedAt = status.finishedAt = new Date().toISOString();
      if (status.status === 'success') status.lastSuccessAt = status.finishedAt;
      atomicJson(destination, status);
      console.log(JSON.stringify({ status: status.status, covered: status.covered || [], bundles: status.bundles.map(row => ({ repository: row.repository,
        filePath: row.filePath, manifestPath: row.manifestPath, bytes: row.encrypted.bytes, sha256: row.encrypted.sha256, reused: row.reused || false,
        chain: (row.chain || []).length })) }));
      return 0;
    } catch (error) {
      status.status = 'failed'; status.code = 'GIT_ENCRYPTED_BUNDLE_FAILED'; status.finishedAt = new Date().toISOString();
      // 코드 꼴이 아닌 오류(파일 잠금·디스크 등)도 시스템 오류 코드와 저장소 이름은 남긴다. 메시지 원문은 남기지 않는다(10-19).
      status.detailCode = /^[A-Z][A-Z0-9_]{2,80}$/.test(error.message) ? error.message
        : /^E[A-Z]{2,20}$/.test(String(error.code)) ? 'SYSTEM_' + error.code : 'UNCLASSIFIED_ERROR';
      if (current) status.failedRepository = current;
      atomicJson(destination, status); return 1;
    } finally { clearInterval(heartbeat); }
  } finally { unlock(); }
}
if (require.main === module) main().then(code => { process.exitCode = code; }, () => { console.error('GIT_ENCRYPTED_BUNDLE_FAILED'); process.exitCode = 1; });
module.exports = { BundleInspector, createBundle, preserveRecord, existingReceipt, receiptFromManifest, verifyPrerequisites, verifyDriveCoverage,
  recordDriveCoverage, archiveRefs, fileDigest, selection, isolatedBundleRepository, bundleReceipts, verifiedBundles, archiveCoverage, main };
