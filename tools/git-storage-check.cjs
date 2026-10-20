#!/usr/bin/env node
'use strict';

// Read-only check of the index or every new object in a commit range.
// No hook, Git configuration, deletion, or upload. Optional lazy fetch writes
// only Git's object cache, using the repository's already configured remotes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');

const POLICY_PATH = 'tools/git-storage-policy.json';
const MAX_OUTPUT = 128 * 1024 * 1024;
const OID = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const ZERO_OID = /^0+$/;
// Internal-only sources cannot be republished, even under a new filename.
// This prevents new exposure; historical copies require separate remediation.
const INTERNAL_PREFIXES = ['docs/_ops/NEXT/'];
function privateSourceReason(file, bytes) {
  if (INTERNAL_PREFIXES.some(prefix => file.toLowerCase().startsWith(prefix.toLowerCase()))) return 'internal-source-path';
  if (!/\.(?:md|txt|html?)$/i.test(file) || !bytes) return null;
  // Windows editors may save a marked document as UTF-16. Keep the marker
  // effective after that encoding-only change as well.
  const text = bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.subarray(2).toString('utf16le')
    : bytes[0] === 0xfe && bytes[1] === 0xff ? Buffer.from(bytes.subarray(2)).swap16().toString('utf16le')
    : bytes.toString('utf8');
  if (/^\s*<!--\s*synk:private\s*-->\s*$/m.test(text)
      || /이 문서나 연결한 내부 기록을 공개 저장소·외부 공유 링크에 게시하지 않는다\./.test(text)) return 'internal-source-declaration';
  return null;
}
const USAGE = `Git storage check (read only)
  node tools/git-storage-check.cjs --cached [--base <commit>] [--json]
  node tools/git-storage-check.cjs --base <commit> --head <commit> [--json]

The index mode honors GIT_INDEX_FILE. The range mode includes blobs added
and later deleted within the range. Existing unchanged blobs are grandfathered.
The policy comes from the checked index/head, never an unstaged working copy.
Only for initial preparation before the policy is staged:
  node tools/git-storage-check.cjs --cached --bootstrap-policy
For a partial clone only, explicitly allow missing objects to be downloaded
from configured Git remotes into Git's object cache with --allow-lazy-fetch.
Without this option an incomplete object inspection fails.
Exit: 0 passed, 1 policy violation, 2 invalid arguments or incomplete inspection.
`;

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--cached') options.cached = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--bootstrap-policy') options.bootstrapPolicy = true;
    else if (arg === '--allow-lazy-fetch') options.allowLazyFetch = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--base' || arg === '--head') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${arg} needs a commit ref`);
      const key = arg.slice(2);
      if (options[key]) throw new Error(`${arg} was supplied twice`);
      options[key] = argv[++i];
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.help) return options;
  if (options.cached && options.head) throw new Error('--cached and --head cannot be combined');
  if (!options.cached && (!options.base || !options.head)) throw new Error('Use --cached or both --base and --head');
  if (options.bootstrapPolicy && !options.cached) throw new Error('--bootstrap-policy is only available in index mode');
  return options;
}

function gitReader(repo, env = process.env, allowLazyFetch = false) {
  // Preserve GIT_INDEX_FILE: this repository uses alternate indexes for scoped commits.
  const gitEnv = { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: allowLazyFetch ? '0' : '1' };
  const prefix = ['--no-pager', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'diff.autoRefreshIndex=false', '-c', 'diff.external='];
  function git(args, input) {
    try {
      return execFileSync('git', [...prefix, ...args], {
        cwd: repo, env: gitEnv, input, maxBuffer: MAX_OUTPUT, timeout: 120000,
        windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      const detail = error.stderr ? error.stderr.toString('utf8').trim() : error.message;
      throw new Error(`Git inspection failed (${args[0]}): ${detail}`);
    }
  }
  git.sha256 = oid => new Promise((resolve, reject) => {
    if (!OID.test(oid)) return reject(new Error('Invalid blob object ID'));
    const hash = crypto.createHash('sha256');
    const child = spawn('git', [...prefix, 'cat-file', 'blob', oid], {
      cwd: repo, env: gitEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Blob hashing timed out')); }, 120000);
    let stderr = '';
    child.stdout.on('data', chunk => hash.update(chunk));
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString('utf8')).slice(-4096); });
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', code => {
      clearTimeout(timeout);
      if (code !== 0) reject(new Error(`Cannot hash Git blob ${oid}: ${stderr.trim()}`));
      else resolve(hash.digest('hex'));
    });
  });
  return git;
}

function commit(git, ref) {
  const value = git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).toString('utf8').trim();
  if (!OID.test(value)) throw new Error(`Invalid commit: ${ref}`);
  return value;
}

function exactPath(value) {
  return typeof value === 'string' && value.length > 0 && !/[\\\0*?\[\]{}]/.test(value)
    && !value.startsWith('/') && !/^[A-Za-z]:/.test(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..');
}

function validatePolicy(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Policy must be an object');
  const keys = ['version', 'maxBlobBytes', 'maxTotalBytes', 'generatedImageDirectories', 'generatedImageExtensions',
    'excludedBinaryExtensions', 'derivedImageRules', 'generatedImageExceptions', 'exceptions'];
  if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !(key in value))) {
    throw new Error('Policy fields are missing or unrecognized');
  }
  if (value.version !== 1) throw new Error('Unsupported storage policy version');
  for (const key of ['maxBlobBytes', 'maxTotalBytes']) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 1) throw new Error(`${key} must be a positive integer`);
  }
  const strings = (key, predicate) => {
    const list = value[key];
    if (!Array.isArray(list) || list.some(item => typeof item !== 'string' || !predicate(item))
      || new Set(list).size !== list.length) throw new Error(`Invalid ${key}`);
  };
  strings('generatedImageDirectories', item => /^[a-z][a-z0-9-]*$/.test(item));
  const extension = item => /^\.[a-z0-9]+(?:\.[a-z0-9]+)*$/.test(item);
  strings('generatedImageExtensions', extension);
  strings('excludedBinaryExtensions', extension);
  strings('generatedImageExceptions', exactPath);
  if (!Array.isArray(value.derivedImageRules)) throw new Error('Invalid derivedImageRules');
  const ruleDirectories = new Set();
  for (const rule of value.derivedImageRules) {
    if (!rule || Array.isArray(rule) || typeof rule !== 'object'
      || Object.keys(rule).sort().join(',') !== 'directory,preservedPrefixes,preservedTerms,suffixes'
      || !exactPath(rule.directory) || ruleDirectories.has(rule.directory)) throw new Error('Invalid derived image directory rule');
    ruleDirectories.add(rule.directory);
    for (const key of ['suffixes', 'preservedPrefixes', 'preservedTerms']) {
      if (!Array.isArray(rule[key]) || rule[key].some(item => !exactPath(item) || item.includes('/'))
        || new Set(rule[key]).size !== rule[key].length) throw new Error(`Invalid derived image ${key}`);
    }
    if (!rule.suffixes.length || rule.suffixes.some(suffix => !/^_[A-Za-z0-9]+\.png$/.test(suffix))) {
      throw new Error('Derived image suffixes must name exact PNG output suffixes');
    }
  }
  if (!Array.isArray(value.exceptions)) throw new Error('Invalid exceptions list');
  const seen = new Set();
  for (const entry of value.exceptions) {
    if (!entry || Array.isArray(entry) || typeof entry !== 'object'
      || Object.keys(entry).sort().join(',') !== 'path,reason,sha256'
      || !exactPath(entry.path) || !/^[0-9a-f]{64}$/.test(entry.sha256)
      || typeof entry.reason !== 'string' || entry.reason.trim().length < 5) {
      throw new Error('Each exception needs an exact path, lowercase SHA-256, and a preservation reason');
    }
    const key = `${entry.path}\0${entry.sha256}`;
    if (seen.has(key)) throw new Error('Duplicate exact asset exception');
    seen.add(key);
  }
  return value;
}

function readPolicy(git, options, head) {
  const rows = (options.cached
    ? git(['ls-files', '--stage', '-z', '--', POLICY_PATH])
    : git(['ls-tree', '-z', head, '--', POLICY_PATH])).toString('utf8').split('\0').filter(Boolean);
  if (rows.length > 1) throw new Error('Policy has an unresolved merge');
  let data, source;
  if (rows.length) {
    const meta = rows[0].split('\t')[0].split(' ');
    const mode = meta[0], oid = options.cached ? meta[1] : meta[2];
    if (!['100644', '100755'].includes(mode) || !OID.test(oid) || (options.cached && meta[2] !== '0')) {
      throw new Error('Policy must be a regular, resolved Git file');
    }
    const size = Number(git(['cat-file', '-s', oid]).toString('utf8').trim());
    if (!Number.isSafeInteger(size) || size > 1024 * 1024) throw new Error('Policy exceeds 1 MiB');
    data = git(['cat-file', 'blob', oid]).toString('utf8');
    source = options.cached ? `index:${POLICY_PATH}` : `${head}:${POLICY_PATH}`;
  } else if (options.cached && options.bootstrapPolicy) {
    data = fs.readFileSync(path.join(__dirname, 'git-storage-policy.json'), 'utf8');
    source = 'bootstrap:tool-local-policy';
  } else throw new Error(`Checked ${options.cached ? 'index' : 'head'} has no ${POLICY_PATH}; stage/commit it before checking`);
  let policy;
  try { policy = JSON.parse(data); } catch { throw new Error(`Invalid policy JSON in ${source}`); }
  return { policy: validatePolicy(policy), source };
}

function parseChanges(buffer) {
  const fields = buffer.toString('utf8').split('\0');
  const records = new Map();
  for (let i = 0; i < fields.length; i++) {
    const header = fields[i].trim();
    if (!header) continue;
    const match = /^:([0-7]{6}) ([0-7]{6}) ([0-9a-f]+) ([0-9a-f]+) ([ACDMRTUXB])\d*$/.exec(header);
    if (!match || i + 1 >= fields.length) throw new Error('Malformed raw Git diff');
    const name = fields[++i];
    if (!name || !OID.test(match[3]) || !OID.test(match[4])) throw new Error('Malformed Git path/object record');
    if (match[5] === 'U') throw new Error(`Unmerged index entry: ${name}`);
    if (match[5] === 'R' || match[5] === 'C') throw new Error('Unexpected rename detection in raw diff');
    if (ZERO_OID.test(match[4]) || match[2] === '160000') continue;
    const row = { path: name, oid: match[4], mode: match[2] };
    records.set(`${name}\0${row.oid}`, row);
  }
  return [...records.values()];
}

function baseBindings(git, base, wanted) {
  const result = new Map();
  if (!base || !wanted.size) return result;
  for (const row of git(['ls-tree', '-r', '-z', base]).toString('utf8').split('\0')) {
    if (!row) continue;
    const tab = row.indexOf('\t'), name = row.slice(tab + 1);
    if (!wanted.has(name)) continue;
    const meta = row.slice(0, tab).split(' ');
    if (meta[1] === 'blob') result.set(name, meta[2]);
  }
  return result;
}

function objectIds(git, revision) {
  const values = git(['rev-list', '--objects', '--no-object-names', revision]).toString('utf8').split('\n').filter(Boolean);
  if (values.some(oid => !OID.test(oid))) throw new Error('Invalid rev-list object output');
  return new Set(values);
}

// Objects already reachable from the base. A partial clone (CI checks out blob:none) would otherwise
// lazily download every historical blob and hit the Git timeout; --missing=print lists them as ?<oid>.
function knownIds(git, revision) {
  const values = git(['rev-list', '--objects', '--no-object-names', '--missing=print', revision]).toString('utf8')
    .split('\n').filter(Boolean).map(line => line.startsWith('?') ? line.slice(1) : line);
  if (values.some(oid => !OID.test(oid))) throw new Error('Invalid rev-list object output');
  return new Set(values);
}

function objectInfo(git, ids) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const output = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], Buffer.from(unique.join('\n') + '\n'));
  const rows = output.toString('utf8').trimEnd().split('\n');
  if (rows.length !== unique.length) throw new Error('Incomplete Git object inspection');
  const result = new Map();
  for (let i = 0; i < rows.length; i++) {
    const match = /^([0-9a-f]+) (blob|tree|commit|tag) (\d+)$/.exec(rows[i]);
    if (!match || match[1] !== unique[i]) throw new Error(`Missing or invalid Git object: ${unique[i]}`);
    const bytes = Number(match[3]);
    if (!Number.isSafeInteger(bytes)) throw new Error('Invalid Git object size');
    result.set(match[1], { type: match[2], bytes });
  }
  return result;
}

function generatedKind(name, policy) {
  const lower = name.toLowerCase();
  const directories = lower.split('/').slice(0, -1);
  if (directories.some(part => policy.generatedImageDirectories.includes(part))
    && policy.generatedImageExtensions.some(ext => lower.endsWith(ext))
    && !policy.generatedImageExceptions.includes(name)) return 'qa-image';
  const directory = path.posix.dirname(lower), filename = path.posix.basename(lower);
  for (const rule of policy.derivedImageRules) {
    if (directory !== rule.directory.toLowerCase()) continue;
    const preserved = rule.preservedPrefixes.some(prefix => filename.startsWith(prefix.toLowerCase()))
      || rule.preservedTerms.some(term => filename.includes(term.toLowerCase()));
    if (!preserved && rule.suffixes.some(suffix => filename.endsWith(suffix.toLowerCase()))) return 'derived-image';
  }
  if (policy.excludedBinaryExtensions.some(ext => lower.endsWith(ext))) return 'excluded-binary';
  return null;
}

async function checkRepository(options, repo = process.cwd(), env = process.env) {
  const git = gitReader(repo, env, options.allowLazyFetch);
  git(['rev-parse', '--git-dir']);
  let base, head = null;
  if (options.cached && !options.base) {
    const resolved = git(['rev-parse', '--revs-only', 'HEAD']).toString('utf8').trim();
    if (resolved) base = commit(git, 'HEAD');
    else {
      const headRef = git(['symbolic-ref', '-q', 'HEAD']).toString('utf8').trim();
      const refs = git(['for-each-ref', '--format=%(refname)', headRef]).toString('utf8').trim();
      if (refs) throw new Error('HEAD refers to an unreadable commit');
      base = null;
    }
  } else base = commit(git, options.base);
  if (!options.cached) head = commit(git, options.head);
  const { policy, source } = readPolicy(git, options, head);
  const raw = options.cached
    ? git(['diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '--no-ext-diff', '-z', ...(base ? [base] : []), '--'])
    : git(['log', '--format=', '--raw', '--no-abbrev', '--no-renames', '--no-ext-diff', '-z', '-m', `${base}..${head}`, '--']);
  const allChanges = parseChanges(raw);
  const bindings = baseBindings(git, base, new Set(allChanges.map(row => row.path)));
  const changes = allChanges.filter(row => bindings.get(row.path) !== row.oid);
  let newIds;
  if (options.cached) {
    const known = base ? knownIds(git, base) : new Set();
    newIds = new Set(changes.map(row => row.oid).filter(oid => !known.has(oid)));
  } else {
    // Divergent histories can list the same blob in the range and the base.
    // Count only new objects; keep all changed paths for alias policy checks.
    const known = knownIds(git, base);
    newIds = new Set([...objectIds(git, `${base}..${head}`)].filter(oid => !known.has(oid)));
  }
  const info = objectInfo(git, [...newIds, ...changes.map(row => row.oid)]);
  const newBlobs = new Map([...newIds].filter(oid => info.get(oid).type === 'blob').map(oid => [oid, info.get(oid).bytes]));
  const exceptions = new Map();
  for (const entry of policy.exceptions) {
    if (!exceptions.has(entry.path)) exceptions.set(entry.path, new Set());
    exceptions.get(entry.path).add(entry.sha256);
  }
  const hashes = new Map(), pathsByOid = new Map(), exemptPaths = new Set(), violations = [];
  for (const row of changes) {
    const item = info.get(row.oid);
    if (!item || item.type !== 'blob') throw new Error(`Changed file has no readable blob: ${row.path}`);
    if (!pathsByOid.has(row.oid)) pathsByOid.set(row.oid, []);
    pathsByOid.get(row.oid).push(row);
    // A historical large blob copied to a new path is not a new storage blob,
    // but is a new publication. Do not skip its content on the storage limit.
    // cat-file fails closed if the inspection exceeds MAX_OUTPUT.
    const privateReason = privateSourceReason(row.path,
      /\.(?:md|txt|html?)$/i.test(row.path) ? git(['cat-file', 'blob', row.oid]) : null);
    if (privateReason) violations.push({ code: privateReason, path: row.path, oid: row.oid, bytes: item.bytes,
      message: 'Internal-only source must stay outside public Git history. Preserve it in private storage.' });
    if (exceptions.has(row.path)) {
      if (!hashes.has(row.oid)) hashes.set(row.oid, await git.sha256(row.oid));
      if (exceptions.get(row.path).has(hashes.get(row.oid))) {
        exemptPaths.add(`${row.path}\0${row.oid}`);
        continue;
      }
    }
    const kind = generatedKind(row.path, policy);
    if (kind) violations.push({ code: kind, path: row.path, oid: row.oid, bytes: item.bytes,
      message: 'Keep generated media in verified external storage; commit its source and recovery manifest, or a precise approved-original exception.' });
    if (newBlobs.has(row.oid) && item.bytes > policy.maxBlobBytes) {
      violations.push({ code: 'blob-bytes', path: row.path, oid: row.oid, bytes: item.bytes, limit: policy.maxBlobBytes,
        message: 'New Git blob exceeds the individual byte limit.' });
    }
  }
  const counted = new Map(), exemptOids = new Set();
  for (const [oid, bytes] of newBlobs) {
    const rows = pathsByOid.get(oid);
    if (!rows?.length) throw new Error(`New Git blob has no inspected path: ${oid}`);
    if (rows.every(row => exemptPaths.has(`${row.path}\0${oid}`))) exemptOids.add(oid);
    else counted.set(oid, bytes);
  }
  const newBytes = [...newBlobs.values()].reduce((sum, bytes) => sum + bytes, 0);
  const countedBytes = [...counted.values()].reduce((sum, bytes) => sum + bytes, 0);
  if (countedBytes > policy.maxTotalBytes) violations.push({ code: 'total-bytes', bytes: countedBytes, limit: policy.maxTotalBytes,
    message: 'Distinct new, non-exempt Git blobs exceed the total byte limit.' });
  return { ok: violations.length === 0, mode: options.cached ? 'index' : 'range', base, head,
    policySource: source, changesChecked: changes.length, newBlobs: newBlobs.size, newBytes,
    countedBytes, exemptBlobs: exemptOids.size, allowLazyFetch: Boolean(options.allowLazyFetch), violations,
    warnings: [
      ...(source.startsWith('bootstrap:') ? ['Bootstrap policy only: stage the policy and rerun without --bootstrap-policy before commit/push.'] : []),
      ...(options.allowLazyFetch ? ['Lazy fetch enabled explicitly: missing objects may be downloaded from configured Git remotes into Git object cache.'] : []),
    ] };
}

async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
    if (options.help) { process.stdout.write(USAGE); return 0; }
    const result = await checkRepository(options);
    if (options.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else {
      process.stdout.write(`[git-storage] ${result.ok ? 'PASS' : 'FAIL'}: ${result.changesChecked} changed path/blob pairs, ${result.newBlobs} new blobs, ${result.countedBytes} counted bytes\n`);
      process.stdout.write(`Policy: ${result.policySource}\n`);
      for (const warning of result.warnings) process.stdout.write(`Warning: ${warning}\n`);
      for (const row of result.violations) process.stdout.write(`  ${row.code}: ${row.path || '(all new blobs)'} (${row.bytes} bytes${row.limit ? `; limit ${row.limit}` : ''})\n`);
    }
    return result.ok ? 0 : 1;
  } catch (error) {
    if (options?.json) process.stdout.write(JSON.stringify({ ok: false, error: error.message }) + '\n');
    else process.stderr.write(`[git-storage] ERROR: ${error.message}\n`);
    return 2;
  }
}

if (require.main === module) main().then(code => { process.exitCode = code; }, error => { console.error(error.message); process.exitCode = 2; });
module.exports = { checkRepository, generatedKind, main, parseArgs, validatePolicy, privateSourceReason };
