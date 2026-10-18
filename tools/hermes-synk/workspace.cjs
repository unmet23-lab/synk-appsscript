#!/usr/bin/env node
'use strict';

// Prepare one bounded, detached Git worktree. Never merge, clean, reset or alter
// the source worktree/index/branch. All native agent execution happens elsewhere.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const LIMITS = Object.freeze({ files: 20000, bytes: 128 * 1024 * 1024,
  singleFile: 4 * 1024 * 1024, untracked: 2000, entries: 200000,
  metadata: 64 * 1024 * 1024, retained: 8, retainedBytes: 512 * 1024 * 1024, prepareMs: 150000 });
const SOURCE_EXTENSIONS = new Set(('.js .cjs .mjs .jsx .ts .tsx .mts .cts .css .scss .sass .less .html .htm .md .mdx .txt .json .jsonc .yaml .yml .toml .xml .sh .bash .ps1 .cmd .bat .py .sql .prisma .graphql .gql .ini .cfg .conf').split(' '));
const SOURCE_NAMES = new Set(['AGENTS.md', 'CLAUDE.md', 'Dockerfile', 'Makefile', 'Procfile', 'CMakeLists.txt', '.gitignore', '.gitattributes', '.editorconfig', '.dockerignore', 'yarn.lock', 'bun.lock']);
const DEFAULT_SCOPE = Object.freeze(['AGENTS.md', 'CLAUDE.md', 'docs/AI_운영원칙.md', 'docs/문서_지도.md', 'docs/_ops/트랙.md', 'docs/_ops/결정.md', 'docs/참고카드', 'docs/현장노트',
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', '.gitignore', '.gitattributes',
  'tools/git-storage-check.cjs', 'tools/git-storage-policy.json', 'tools/git잠금.js']);
const EXCLUDED_DIR = /^(?:\.git|\.tmp|\.cache|\.next|\.nuxt|\.venv|venv|node_modules|dist|build|out|coverage|vendor|target|cache|__pycache__|artifacts|qa-output|playwright-report|test-results|\.codex|\.claude|backups)$/i;
const SECRET_NAME = /^(?:\.env(?:\..*)?|\.auth(?:[._-].*)?|\.npmrc|\.pypirc|\.netrc|auth(?:[._-].*)?\.json|credentials?(?:[._-].*)?|secrets?(?:[._-].*)?|tokens?(?:[._-].*)?|id_(?:rsa|ed25519)(?:\.pub)?|.*\.(?:pem|key|p12|pfx|keystore))$/i;
const OID = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const TASK_ID = /^synk-[0-9a-f]{12}$/;

class Hold extends Error {
  constructor(code) { super(code); this.code = code; }
}
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = value => fs.realpathSync(path.resolve(value));
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const contained = (root, value) => { const rel = path.relative(root, value); return rel && !rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel); };
function remainingTime(limits, maximum = 120000) {
  const remaining = limits.deadline === undefined ? maximum : limits.deadline - Date.now();
  if (remaining <= 0) throw new Hold('PREPARATION_TIME_LIMIT');
  return Math.max(1, Math.min(maximum, remaining));
}
function identity(stat) { return [stat.dev, stat.ino].map(String).join(':'); }
function existsEntry(file) { try { fs.lstatSync(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
function safeRelative(value) {
  return typeof value === 'string' && value && value.length <= 1024 && !/[\x00-\x1f\x7f\\:"*?<>|]/.test(value)
    && !value.startsWith('/') && value.split('/').every(p => p && p !== '.' && p !== '..');
}
function safeSource(value) {
  if (!safeRelative(value)) return false;
  const parts = value.split('/');
  return !parts.some(p => EXCLUDED_DIR.test(p) || SECRET_NAME.test(p))
    && (SOURCE_NAMES.has(parts.at(-1)) || SOURCE_EXTENSIONS.has(path.posix.extname(value).toLowerCase()));
}
function normalizeScope(values = []) {
  if (!Array.isArray(values) || values.length > 40 || values.some(v => !safeRelative(v))) throw new Hold('INVALID_SCOPE');
  if (values.some(value => value.split('/').some(p => EXCLUDED_DIR.test(p) || SECRET_NAME.test(p)))) throw new Hold('UNSAFE_SCOPE');
  const scope = new Set([...DEFAULT_SCOPE, ...values]);
  for (const value of values) {
    let dir = path.posix.dirname(value);
    while (dir !== '.') {
      for (const name of ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'tsconfig.json', 'jsconfig.json', '.gitignore', '.gitattributes']) scope.add(dir + '/' + name);
      dir = path.posix.dirname(dir);
    }
  }
  return [...scope].sort();
}
const inScope = (name, scope) => scope.some(root => name === root || name.startsWith(root + '/'));
function rejectIgnoredScope(repo, scope, limits, filterArgs) {
  // ls-files --exclude-standard otherwise omits real ignored HTML/code silently.
  // Walk only actual selected paths. Git's recursive --ignored listing can scan
  // a huge repository even with pathspec exclusions; check-ignore takes this
  // bounded explicit input and never explores dependency/cache trees itself.
  const visited = new Set(), names = [];
  const walk = rel => {
    remainingTime(limits);
    if (visited.has(rel)) return;
    visited.add(rel);
    if (visited.size > limits.entries) throw new Hold('GIT_ENTRY_LIMIT');
    if (rel.split('/').some(p => EXCLUDED_DIR.test(p) || SECRET_NAME.test(p))) return;
    const full = path.join(repo, rel);
    let stat;
    try { stat = fs.lstatSync(full); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    if (stat.isSymbolicLink()) throw new Hold('SYMLINK_SOURCE');
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(full, { withFileTypes: true })) walk(rel + '/' + entry.name);
    } else if (stat.isFile() && safeSource(rel)) {
      names.push(rel);
      if (names.length > limits.files) throw new Hold('SOURCE_TOTAL_LIMIT');
    }
  };
  for (const rel of scope) {
    let current = repo;
    for (const part of rel.split('/')) {
      current = path.join(current, part);
      try { if (fs.lstatSync(current).isSymbolicLink()) throw new Hold('SYMLINK_SOURCE'); }
      catch (error) { if (error.code === 'ENOENT') break; throw error; }
    }
    walk(rel);
  }
  if (!names.length) return;
  const ignored = git(repo, ['check-ignore', '--stdin', '-z'], { limits, filterArgs, input: Buffer.from(names.join('\0') + '\0'), allowExitOne: true });
  if (ignored.length) throw new Hold('IGNORED_SCOPE_SOURCE');
}
function rejectSecrets(bytes) {
  if (bytes.includes(0)) throw new Hold('BINARY_SOURCE');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Hold('NON_UTF8_SOURCE'); }
  if (/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AIza[A-Za-z0-9_-]{30,})\b/.test(text)
      || /\beyJ[A-Za-z0-9_-]{18,}\.[A-Za-z0-9_-]{18,}\.[A-Za-z0-9_-]{18,}\b/.test(text)
      || /data:(?:image|audio|video|application\/(?:pdf|octet-stream))[^,]*;base64,/i.test(text)
      || /["'](?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)["']\s*:\s*["'][A-Za-z0-9_+/=.-]{16,}["']/i.test(text)) {
    throw new Hold('SECRET_OR_EMBEDDED_MEDIA');
  }
}
function trustedFile(root, rel) {
  if (!safeRelative(rel)) throw new Hold('UNSAFE_PATH');
  let current = root;
  for (const part of rel.split('/')) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (stat.isSymbolicLink()) throw new Hold('SYMLINK_SOURCE');
  }
  if (!contained(root, canonical(current))) throw new Hold('SOURCE_ESCAPES_ROOT');
  const stat = fs.statSync(current, { bigint: true });
  if (!stat.isFile()) throw new Hold('NON_REGULAR_SOURCE');
  return { full: current, stat };
}
function statKey(s) { return [s.dev, s.ino, s.mode, s.size, s.mtimeNs, s.ctimeNs].map(String).join(':'); }
function environment(index) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1', GIT_LFS_SKIP_SMUDGE: '1' };
  for (const key of ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT']) delete env[key];
  if (index) env.GIT_INDEX_FILE = index;
  return env;
}
function git(repo, args, { input, index, workTree, filterArgs = [], limits = LIMITS, allowExitOne = false } = {}) {
  const argv = ['--no-pager', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'diff.autoRefreshIndex=false',
    '-c', 'diff.external=', '-c', 'core.hooksPath=' + path.join(os.tmpdir(), 'synk-disabled-hooks'), ...filterArgs];
  if (workTree) argv.push('--work-tree=' + workTree);
  try {
    return execFileSync('git', [...argv, ...args], { cwd: repo, env: environment(index), input,
      maxBuffer: limits.metadata, timeout: remainingTime(limits), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    if (error instanceof Hold) throw error;
    if (allowExitOne && error.status === 1) return Buffer.from(error.stdout || '');
    const detail = String(error.stderr || '');
    if (/\.lock|another git process|Unable to create.*lock/i.test(detail)) throw new Hold('GIT_LOCKED');
    throw new Hold(error.code === 'ENOBUFS' ? 'GIT_METADATA_LIMIT' : 'GIT_FAILED');
  }
}
function gitText(repo, args, options) { return git(repo, args, options).toString('utf8').trim(); }
function parseTree(bytes, limits) {
  const result = new Map();
  for (const row of bytes.toString('utf8').split('\0').filter(Boolean)) {
    const split = row.indexOf('\t');
    const [mode, type, oid] = row.slice(0, split).split(' ');
    const name = row.slice(split + 1);
    if (split < 0 || !safeRelative(name) || !OID.test(oid)) throw new Hold('UNSAFE_GIT_TREE');
    result.set(name, { mode, type, oid });
    if (result.size > limits.entries) throw new Hold('GIT_ENTRY_LIMIT');
  }
  return result;
}
function readState(repo, limits, filterArgs) {
  const options = { limits, filterArgs };
  const head = gitText(repo, ['rev-parse', '--verify', 'HEAD^{commit}'], options);
  if (!OID.test(head)) throw new Hold('INVALID_HEAD');
  const index = git(repo, ['ls-files', '--stage', '-z'], options);
  const tracked = new Set(), indexRows = index.toString('utf8').split('\0').filter(Boolean);
  for (const row of indexRows) {
    const split = row.indexOf('\t');
    if (split < 0 || !/^[0-7]{6} [0-9a-f]+ 0$/.test(row.slice(0, split))) throw new Hold('UNMERGED_INDEX');
    const rel = row.slice(split + 1);
    if (!safeRelative(rel)) throw new Hold('UNSAFE_PATH');
    tracked.add(rel);
    if (tracked.size > limits.entries) throw new Hold('GIT_ENTRY_LIMIT');
  }
  const status = git(repo, ['-c', 'status.renames=false', 'status', '--porcelain=v1', '-z', '--untracked-files=no', '--ignore-submodules=all'], options);
  const statusRows = status.toString('utf8').split('\0').filter(Boolean);
  const dirty = new Set(statusRows.map(row => row.slice(3)));
  const untracked = git(repo, ['ls-files', '--others', '--exclude-standard', '-z'], options).toString('utf8').split('\0').filter(Boolean).sort();
  if (untracked.length > limits.entries) throw new Hold('GIT_ENTRY_LIMIT');
  return { head, index: digest(index), status: digest(status), indexRows, statusRows, tracked, dirty, untracked };
}
function scopedState(state, scope) {
  return { head: state.head, index: digest(state.indexRows.filter(row => inScope(row.slice(row.indexOf('\t') + 1), scope)).join('\0')),
    status: digest(state.statusRows.filter(row => inScope(row.slice(3), scope)).join('\0')),
    untracked: state.untracked.filter(name => inScope(name, scope)) };
}
function capture(repo, limits, filterArgs, keepBytes, scope) {
  rejectIgnoredScope(repo, scope, limits, filterArgs);
  const before = readState(repo, limits, filterArgs);
  const beforeView = scopedState(before, scope);
  const headTree = parseTree(git(repo, ['ls-tree', '-r', '-z', before.head], { limits, filterArgs }), limits);
  const candidates = new Set([...headTree.keys(), ...before.tracked]);
  const sourceUntracked = before.untracked.filter(name => inScope(name, scope) && safeSource(name));
  if (sourceUntracked.length > limits.untracked) throw new Hold('UNTRACKED_LIMIT');
  sourceUntracked.forEach(name => candidates.add(name));
  const files = [], deletions = [];
  let total = 0;
  for (const rel of [...candidates].sort()) {
    remainingTime(limits);
    if (!inScope(rel, scope)) continue;
    if (!safeRelative(rel)) throw new Hold('UNSAFE_PATH');
    if (!safeSource(rel)) {
      if (before.dirty.has(rel)) {
        if (fs.existsSync(path.join(repo, rel))) throw new Hold('UNSAFE_DIRTY_TRACKED');
        deletions.push(rel);
      }
      continue;
    }
    const file = trustedFile(repo, rel);
    if (!file) { if (headTree.has(rel)) deletions.push(rel); continue; }
    const size = Number(file.stat.size);
    if (size > limits.singleFile) throw new Hold('SOURCE_FILE_LIMIT');
    total += size;
    if (total > limits.bytes || files.length >= limits.files) throw new Hold('SOURCE_TOTAL_LIMIT');
    const bytes = fs.readFileSync(file.full);
    rejectSecrets(bytes);
    const after = fs.statSync(file.full, { bigint: true });
    if (statKey(file.stat) !== statKey(after) || bytes.length !== size) throw new Hold('SOURCE_CHANGED');
    files.push({ path: rel, sha256: digest(bytes), mode: Number(file.stat.mode) & 0o111 ? '100755' : '100644',
      stat: statKey(after), bytes: keepBytes ? bytes : undefined });
  }
  const after = readState(repo, limits, filterArgs);
  rejectIgnoredScope(repo, scope, limits, filterArgs);
  if (JSON.stringify(beforeView) !== JSON.stringify(scopedState(after, scope))) throw new Hold('SOURCE_CHANGED');
  const identity = { ...beforeView, scope,
    files: files.map(({ path, sha256, mode, stat }) => ({ path, sha256, mode, stat })), deletions };
  return { head: before.head, fingerprint: digest(JSON.stringify(identity)), files, deletions, total };
}
function disabledFilters(repo, limits) {
  let output;
  try { output = gitText(repo, ['config', '--name-only', '--get-regexp', '^filter\\..*\\.(clean|smudge|process|required)$'], { limits }); }
  catch (error) { if (error.code === 'GIT_FAILED') return []; throw error; }
  const names = new Set(output.split('\n').map(v => v.trim()).filter(Boolean).map(v => v.replace(/\.(clean|smudge|process|required)$/, '')));
  return [...names].flatMap(n => ['-c', n + '.clean=', '-c', n + '.smudge=', '-c', n + '.process=', '-c', n + '.required=false']);
}
function writeReceipt(file, value) {
  const temporary = file + '.new';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, file);
}
async function waitForGitLock(repo, limits, waitMs = 10000) {
  const lock = gitText(repo, ['rev-parse', '--path-format=absolute', '--git-path', 'index.lock'], { limits });
  const end = Math.min(Date.now() + waitMs, limits.deadline ?? Infinity);
  while (fs.existsSync(lock)) {
    remainingTime(limits);
    if (Date.now() >= end) {
      const inspector = path.join(repo, 'tools', 'git잠금.js');
      if (fs.existsSync(inspector)) {
        try { execFileSync(process.execPath, [inspector, '--json'], { cwd: repo, timeout: remainingTime(limits, 25000), windowsHide: true, stdio: 'pipe' }); } catch { /* no cleanup; remain closed */ }
      }
      throw new Hold('GIT_LOCKED');
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(200, Math.max(1, end - Date.now()))));
  }
}
function storageCheck(repo, index, baseCommit, limits) {
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')); } catch { throw new Hold('STORAGE_GUARD_REQUIRED'); }
  if (pkg.scripts?.['check:storage'] !== 'node tools/git-storage-check.cjs --cached') throw new Hold('STORAGE_GUARD_REQUIRED');
  const helper = path.join(repo, 'tools/git-storage-check.cjs');
  if (!fs.statSync(helper).isFile()) throw new Hold('STORAGE_GUARD_REQUIRED');
  const candidates = [path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.join(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
  const npm = candidates.find(f => fs.existsSync(f));
  if (!npm) throw new Hold('NPM_CLI_REQUIRED');
  const timeout = remainingTime(limits);
  try {
    execFileSync(process.execPath, [npm, '--ignore-scripts', 'run', 'check:storage', '--', '--base', baseCommit, '--json'],
      { cwd: repo, env: environment(index), maxBuffer: limits.metadata, timeout, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch { throw new Hold('STORAGE_GUARD_FAILED'); }
}
function retainedBudget(parent, limits) {
  let count = 0, bytes = 0, entries = 0;
  function size(file) {
    remainingTime(limits);
    const stat = fs.lstatSync(file);
    if (++entries > limits.entries) throw new Hold('WORKSPACE_CAPACITY_REVIEW');
    // Never traverse a link into another worktree/dependency tree. A link only
    // consumes its own directory entry; its target is not another stored copy.
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      let total = 0;
      for (const child of fs.readdirSync(file)) { total += size(path.join(file, child)); if (total > limits.retainedBytes) throw new Hold('WORKSPACE_CAPACITY_REVIEW'); }
      return total;
    }
    if (!Number.isSafeInteger(stat.size) || stat.size < 0) throw new Hold('WORKSPACE_CAPACITY_REVIEW');
    return stat.size;
  }
  function declared(folder) {
    remainingTime(limits);
    const file = path.join(folder, 'workspace.json');
    if (!existsEntry(file)) return 0;
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limits.metadata) throw new Error();
      const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Number.isSafeInteger(receipt.sourceBytes) || receipt.sourceBytes < 0) throw new Error();
      return receipt.sourceBytes * (Number(existsEntry(path.join(folder, 'workspace'))) + Number(existsEntry(path.join(folder, 'snapshot-files'))));
    } catch { throw new Hold('WORKSPACE_CAPACITY_REVIEW'); }
  }
  for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
    remainingTime(limits);
    if (!TASK_ID.test(entry.name)) continue;
    if (entry.isSymbolicLink() || !entry.isDirectory()) throw new Hold('WORKSPACE_CAPACITY_REVIEW');
    const folder = path.join(parent, entry.name);
    const workspace = path.join(folder, 'workspace');
    if (existsEntry(workspace)) {
      const stat = fs.lstatSync(workspace);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Hold('WORKSPACE_CAPACITY_REVIEW');
      count++;
    }
    let actual = 0, estimate = declared(folder);
    for (const name of ['workspace', 'snapshot-files', 'snapshot.index', 'workspace.json', 'preparation-attempts']) {
      const file = path.join(folder, name);
      if (existsEntry(file)) actual += size(file);
    }
    const attempts = path.join(folder, 'preparation-attempts');
    if (existsEntry(attempts)) {
      if (fs.lstatSync(attempts).isSymbolicLink() || !fs.statSync(attempts).isDirectory()) throw new Hold('WORKSPACE_CAPACITY_REVIEW');
      for (const child of fs.readdirSync(attempts, { withFileTypes: true })) {
        remainingTime(limits);
        if (!child.isDirectory() || child.isSymbolicLink()) throw new Hold('WORKSPACE_CAPACITY_REVIEW');
        estimate += declared(path.join(attempts, child.name));
      }
    }
    bytes += Math.max(actual, estimate);
    if (!Number.isSafeInteger(bytes) || bytes > limits.retainedBytes) throw new Hold('WORKSPACE_CAPACITY_REVIEW');
  }
  if (count >= limits.retained || bytes >= limits.retainedBytes) throw new Hold('WORKSPACE_CAPACITY_REVIEW');
  return bytes;
}
function archivePreparation({ repo, taskDir, taskId, attempt, receipt, captured, owned, limits, rootIdentity }) {
  const rootStat = fs.lstatSync(taskDir, { bigint: true });
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory() || identity(rootStat) !== rootIdentity || !samePath(canonical(taskDir), taskDir)) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
  const workspace = path.join(taskDir, 'workspace');
  if (existsEntry(workspace)) return false;
  const registered = git(repo, ['worktree', 'list', '--porcelain', '-z'], { limits }).toString('utf8').split('\0')
    .some(row => row.startsWith('worktree ') && samePath(path.resolve(row.slice(9)), workspace));
  if (registered) return false;
  if (existsEntry(path.join(taskDir, 'snapshot.index.lock')) || existsEntry(path.join(taskDir, 'workspace.json.new'))) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
  const artifacts = ['snapshot-files', 'snapshot.index', 'workspace.json'].filter(name => existsEntry(path.join(taskDir, name)));
  for (const name of artifacts) {
    const file = path.join(taskDir, name), stat = fs.lstatSync(file, { bigint: true });
    if (!owned.has(name) || stat.isSymbolicLink() || identity(stat) !== owned.get(name) || !contained(taskDir, canonical(file))) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
  }
  if (receipt) {
    const saved = JSON.parse(fs.readFileSync(path.join(taskDir, 'workspace.json'), 'utf8'));
    if (saved.taskId !== taskId || saved.state !== 'preparing' || saved.sourceFingerprint !== receipt.sourceFingerprint || saved.sourceRoot !== repo || saved.path !== workspace) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
    const expected = new Map(captured.files.map(file => [file.path, file.sha256]));
    let visited = 0;
    function verify(dir, prefix) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        remainingTime(limits);
        if (++visited > limits.entries) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
        const rel = prefix ? prefix + '/' + entry.name : entry.name, file = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
        if (entry.isDirectory()) verify(file, rel);
        else {
          const item = trustedFile(path.join(taskDir, 'snapshot-files'), rel);
          if (!item || Number(item.stat.size) > limits.singleFile || item.stat.nlink > 1n || !expected.has(rel) || digest(fs.readFileSync(file)) !== expected.get(rel)) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
          expected.delete(rel);
        }
      }
    }
    verify(path.join(taskDir, 'snapshot-files'), '');
    if (expected.size) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
  }
  const parent = path.join(taskDir, 'preparation-attempts');
  if (existsEntry(parent) && (fs.lstatSync(parent).isSymbolicLink() || !fs.statSync(parent).isDirectory())) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  if (!contained(taskDir, canonical(parent))) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
  const destination = fs.mkdtempSync(path.join(parent, 'attempt-' + attempt + '-'));
  if (!contained(taskDir, canonical(destination))) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
  if (receipt) {
    writeReceipt(path.join(taskDir, 'workspace.json'), { ...receipt, state: 'held', failureCode: 'SOURCE_CHANGED', heldAt: new Date().toISOString() });
    owned.set('workspace.json', identity(fs.lstatSync(path.join(taskDir, 'workspace.json'), { bigint: true })));
  }
  for (const name of artifacts) {
    remainingTime(limits);
    const currentRoot = fs.lstatSync(taskDir, { bigint: true });
    if (currentRoot.isSymbolicLink() || identity(currentRoot) !== rootIdentity || !samePath(canonical(taskDir), taskDir) || !contained(taskDir, canonical(destination))) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
    if (existsEntry(workspace)) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
    const source = path.join(taskDir, name), target = path.join(destination, name), stat = fs.lstatSync(source, { bigint: true });
    if (stat.isSymbolicLink() || identity(stat) !== owned.get(name) || !contained(taskDir, path.resolve(source)) || !contained(taskDir, path.resolve(target))) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
    fs.renameSync(source, target);
    if (identity(fs.lstatSync(target, { bigint: true })) !== owned.get(name)) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
  }
  fs.writeFileSync(path.join(destination, 'attempt.json'), JSON.stringify({ version: 1, taskId, attempt, failureCode: 'SOURCE_CHANGED', archivedAt: new Date().toISOString(), artifacts }) + '\n', { flag: 'wx', mode: 0o600 });
  return true;
}
function reusable(repo, taskDir, taskId, receipt, limits, scope) {
  if (receipt.version !== 1 || receipt.state !== 'ready' || receipt.taskId !== taskId || !samePath(receipt.sourceRoot, repo)
      || receipt.ignoredScopeChecked !== true
      || receipt.integration !== 'not_merged' || !OID.test(receipt.snapshotCommit || '')
      || !samePath(receipt.path, path.join(taskDir, 'workspace'))) throw new Hold('WORKSPACE_RECEIPT_INVALID');
  if (JSON.stringify(receipt.scope) !== JSON.stringify(scope)) throw new Hold('WORKSPACE_SCOPE_MISMATCH');
  const workspace = canonical(receipt.path);
  if (!contained(taskDir, workspace) || fs.lstatSync(receipt.path).isSymbolicLink()
      || !fs.lstatSync(path.join(workspace, '.git')).isFile()) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
  const top = canonical(gitText(workspace, ['rev-parse', '--show-toplevel'], { limits }));
  const sourceCommon = canonical(gitText(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir'], { limits }));
  const workspaceCommon = canonical(gitText(workspace, ['rev-parse', '--path-format=absolute', '--git-common-dir'], { limits }));
  if (!samePath(top, workspace) || !samePath(sourceCommon, workspaceCommon)) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
  git(workspace, ['merge-base', '--is-ancestor', receipt.snapshotCommit, 'HEAD'], { limits });
  return { ...receipt, ok: true, reused: true, workspace_root: workspace, source_root: repo, baseline_ref: receipt.snapshotCommit, snapshot_id: receipt.snapshotCommit };
}
function enableSparseWorkspace(workspace, files, limits, filterArgs) {
  git(workspace, ['config', '--worktree', 'core.sparseCheckout', 'true'], { limits, filterArgs });
  git(workspace, ['config', '--worktree', 'core.sparseCheckoutCone', 'false'], { limits, filterArgs });
  git(workspace, ['config', '--worktree', 'index.sparse', 'false'], { limits, filterArgs });
  const info = gitText(workspace, ['rev-parse', '--path-format=absolute', '--git-path', 'info/sparse-checkout'], { limits, filterArgs });
  const gitDir = canonical(gitText(workspace, ['rev-parse', '--absolute-git-dir'], { limits, filterArgs }));
  if (!contained(gitDir, path.resolve(info))) throw new Hold('WORKSPACE_OWNERSHIP_INVALID');
  fs.mkdirSync(path.dirname(info), { recursive: true });
  const escape = name => [...name].map(c => '\\*?[]!# '.includes(c) ? '\\' + c : c).join('');
  fs.writeFileSync(info, files.map(f => '/' + escape(f.path)).join('\n') + '\n', { mode: 0o600 });
}
async function prepareWorkspace({ repo, taskDir, taskId, scope: requestedScope, allowedRoots, limits: overrides, afterCapture, lockWaitMs }) {
  const limits = { ...LIMITS, ...overrides };
  let receiptFile, ownedLock, lockAcquired = false, createdReceipt = false;
  try {
    if (!Number.isSafeInteger(limits.prepareMs) || limits.prepareMs < 1) throw new Hold('PREPARATION_TIME_LIMIT');
    limits.deadline = Date.now() + Math.min(LIMITS.prepareMs, limits.prepareMs);
    if (fs.lstatSync(path.resolve(repo)).isSymbolicLink()) throw new Hold('REPO_SYMLINK');
    repo = canonical(repo); taskDir = path.resolve(taskDir);
    const scope = normalizeScope(requestedScope);
    taskId ||= path.basename(taskDir);
    if (!TASK_ID.test(taskId) || path.basename(taskDir) !== taskId) throw new Hold('INVALID_TASK_ID');
    const roots = (allowedRoots || ['SYNK-appsscript', 'SYNK-talk', 'SYNK-website'].map(n => path.join(os.homedir(), 'Documents', n)))
      .filter(f => fs.existsSync(f)).map(canonical);
    if (!roots.some(root => samePath(root, repo))) throw new Hold('REPO_NOT_ALLOWED');
    const top = canonical(gitText(repo, ['rev-parse', '--show-toplevel'], { limits }));
    if (!samePath(repo, top)) throw new Hold('REPO_NOT_ROOT');
    let worktreeConfig = '';
    try { worktreeConfig = gitText(repo, ['config', '--get', 'extensions.worktreeConfig'], { limits }); } catch { /* absent is not consent to alter common config */ }
    if (worktreeConfig.toLowerCase() !== 'true') throw new Hold('WORKTREE_CONFIG_REQUIRED');
    if (contained(repo, taskDir) || samePath(repo, taskDir)) throw new Hold('TASK_DIR_INSIDE_SOURCE');
    fs.mkdirSync(taskDir, { recursive: true, mode: 0o700 });
    if (!samePath(canonical(taskDir), taskDir)) throw new Hold('TASK_DIR_SYMLINK');
    receiptFile = path.join(taskDir, 'workspace.json');
    if (fs.existsSync(receiptFile)) return reusable(repo, taskDir, taskId, JSON.parse(fs.readFileSync(receiptFile, 'utf8')), limits, scope);
    ownedLock = path.join(taskDir, 'workspace.prepare.lock');
    fs.closeSync(fs.openSync(ownedLock, 'wx', 0o600));
    lockAcquired = true;
    const rootIdentity = identity(fs.lstatSync(taskDir, { bigint: true }));
    // One owned lock covers admission, preservation and every bounded retry.
    // A source race never launches an agent or retries a created worktree.
    for (let attempt = 1; attempt <= 3; attempt++) {
    const owned = new Map();
    let receipt, captured, workspaceCreated = false;
    try {
    remainingTime(limits);
    await waitForGitLock(repo, limits, lockWaitMs);
    const filterArgs = disabledFilters(repo, limits);
    captured = capture(repo, limits, filterArgs, true, scope);
    if (!captured.files.some(f => f.path === 'AGENTS.md')) throw new Hold('AGENTS_REQUIRED');
    const retained = retainedBudget(path.dirname(taskDir), limits);
    if (retained + captured.total * 2 > limits.retainedBytes) throw new Hold('WORKSPACE_CAPACITY_REVIEW');
    const workspace = path.join(taskDir, 'workspace'), stage = path.join(taskDir, 'snapshot-files');
    if (fs.existsSync(workspace) || fs.existsSync(stage)) throw new Hold('WORKSPACE_PATH_EXISTS');
    receipt = { version: 1, state: 'preparing', taskId, path: workspace, workspace_root: workspace,
      sourceRoot: repo, source_root: repo, baseCommit: captured.head, sourceFingerprint: captured.fingerprint,
      scope, scopeExplicit: Array.isArray(requestedScope) && requestedScope.length > 0,
      sourceFiles: captured.files.length, sourceBytes: captured.total, integration: 'not_merged', preparationAttempts: attempt, createdAt: new Date().toISOString() };
    writeReceipt(receiptFile, receipt);
    owned.set('workspace.json', identity(fs.lstatSync(receiptFile, { bigint: true })));
    createdReceipt = true;
    fs.mkdirSync(stage, { mode: 0o700 });
    owned.set('snapshot-files', identity(fs.lstatSync(stage, { bigint: true })));
    for (const file of captured.files) {
      remainingTime(limits);
      const target = path.join(stage, file.path);
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      fs.writeFileSync(target, file.bytes, { flag: 'wx', mode: file.mode === '100755' ? 0o700 : 0o600 });
    }
    const index = path.join(taskDir, 'snapshot.index');
    const options = { index, workTree: stage, limits, filterArgs };
    git(repo, ['read-tree', captured.head], options);
    if (captured.deletions.length) git(repo, ['update-index', '--force-remove', '-z', '--stdin'], { ...options, input: Buffer.from(captured.deletions.join('\0') + '\0') });
    git(repo, ['--literal-pathspecs', 'add', '--pathspec-from-file=-', '--pathspec-file-nul'],
      { ...options, input: Buffer.from(captured.files.map(f => f.path).join('\0') + '\0') });
    storageCheck(repo, index, captured.head, limits);
    owned.set('snapshot.index', identity(fs.lstatSync(index, { bigint: true })));
    if (afterCapture) await afterCapture();
    const verified = capture(repo, limits, filterArgs, false, scope);
    if (verified.fingerprint !== captured.fingerprint) throw new Hold('SOURCE_CHANGED');
    const tree = gitText(repo, ['write-tree'], options);
    const commitEnv = { ...environment(index), GIT_AUTHOR_NAME: 'SYNK workspace snapshot', GIT_AUTHOR_EMAIL: 'snapshot@localhost',
      GIT_COMMITTER_NAME: 'SYNK workspace snapshot', GIT_COMMITTER_EMAIL: 'snapshot@localhost' };
    let snapshot;
    const commitTimeout = remainingTime(limits, 30000);
    try {
      snapshot = execFileSync('git', ['-c', 'core.hooksPath=' + path.join(os.tmpdir(), 'synk-disabled-hooks'), 'commit-tree', tree, '-p', captured.head],
        { cwd: repo, env: commitEnv, input: Buffer.from('SYNK isolated workspace snapshot\n'), encoding: 'utf8', timeout: commitTimeout, maxBuffer: 4096, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch { throw new Hold('SNAPSHOT_COMMIT_FAILED'); }
    if (!OID.test(snapshot)) throw new Hold('SNAPSHOT_COMMIT_FAILED');
    await waitForGitLock(repo, limits, lockWaitMs);
    git(repo, ['worktree', 'add', '--detach', '--no-checkout', workspace, snapshot], { limits, filterArgs });
    workspaceCreated = true;
    git(workspace, ['read-tree', snapshot], { limits, filterArgs });
    enableSparseWorkspace(workspace, captured.files, limits, filterArgs);
    const snapshotPaths = parseTree(git(workspace, ['ls-tree', '-r', '-z', snapshot], { limits, filterArgs }), limits);
    const materialized = new Set(captured.files.map(f => f.path));
    const excluded = [...snapshotPaths.keys()].filter(name => !materialized.has(name));
    if (excluded.length) git(workspace, ['update-index', '--skip-worktree', '-z', '--stdin'], { limits, filterArgs, input: Buffer.from(excluded.join('\0') + '\0') });
    // Git applies the repository's line-ending attributes, with executable filters disabled.
    git(workspace, ['checkout-index', '--stdin', '-z'], { limits, filterArgs, input: Buffer.from(captured.files.map(f => f.path).join('\0') + '\0') });
    const finalSource = capture(repo, limits, filterArgs, false, scope);
    if (finalSource.fingerprint !== captured.fingerprint) throw new Hold('SOURCE_CHANGED');
    Object.assign(receipt, { state: 'ready', snapshotCommit: snapshot, baseline_ref: snapshot, snapshot_id: snapshot,
      storageChecked: true, ignoredScopeChecked: true, sparse: true, readyAt: new Date().toISOString(), excludedFiles: excluded.length });
    writeReceipt(receiptFile, receipt);
    return { ...receipt, ok: true, reused: false };
    } catch (error) {
      if (error instanceof Hold && error.code === 'SOURCE_CHANGED' && attempt < 3 && !workspaceCreated
          && Date.now() < limits.deadline
          && archivePreparation({ repo, taskDir, taskId, attempt, receipt, captured, owned, limits, rootIdentity })) {
        createdReceipt = false;
        continue;
      }
      throw error;
    }
    }
  } catch (error) {
    const code = error instanceof Hold ? error.code : error.code === 'EEXIST' ? 'PREPARE_ALREADY_EXISTS' : 'WORKSPACE_PREPARE_FAILED';
    if (createdReceipt) {
      try {
        const saved = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
        writeReceipt(receiptFile, { ...saved, state: 'held', failureCode: code, heldAt: new Date().toISOString() });
      } catch { /* leave the original receipt, never overwrite a different task */ }
    }
    return { ok: false, code,
      integration: 'not_merged', sourceRoot: repo, source_root: repo };
  } finally {
    if (lockAcquired) { try { fs.unlinkSync(ownedLock); } catch { /* no recursive cleanup */ } }
  }
}
function inspectSource({ repo, scope: requestedScope, limits: overrides }) {
  const limits = { ...LIMITS, ...overrides };
  repo = canonical(repo);
  const scope = normalizeScope(requestedScope);
  const filters = disabledFilters(repo, limits);
  const state = readState(repo, limits, filters);
  const head = parseTree(git(repo, ['ls-tree', '-r', '-z', state.head], { limits, filterArgs: filters }), limits);
  const names = new Set([...head.keys(), ...state.tracked, ...state.untracked.filter(safeSource)]);
  let files = 0, bytes = 0, oversized = 0;
  const unsafeDirty = [], holds = new Set();
  try { rejectIgnoredScope(repo, scope, limits, filters); }
  catch (error) { holds.add(error.code || 'SOURCE_INSPECTION_FAILED'); }
  for (const rel of names) {
    if (!inScope(rel, scope)) continue;
    if (!safeSource(rel)) {
      if (state.dirty.has(rel) && fs.existsSync(path.join(repo, rel))) unsafeDirty.push(rel);
      continue;
    }
    try {
      const file = trustedFile(repo, rel);
      if (!file) continue;
      files++; bytes += Number(file.stat.size);
      if (Number(file.stat.size) > limits.singleFile) oversized++;
    } catch (error) { holds.add(error.code || 'SOURCE_INSPECTION_FAILED'); }
  }
  if (files > limits.files || bytes > limits.bytes) holds.add('SOURCE_TOTAL_LIMIT');
  if (oversized) holds.add('SOURCE_FILE_LIMIT');
  if (unsafeDirty.length) holds.add('UNSAFE_DIRTY_TRACKED');
  return { ok: true, readOnly: true, sourceRoot: repo, baseCommit: state.head, scope, sourceFiles: files, sourceBytes: bytes,
    unsafeDirtyCount: unsafeDirty.length, unsafeDirtySample: unsafeDirty.slice(0, 8), oversizedFiles: oversized,
    preparableByMetadata: holds.size === 0, holds: [...holds], contentSecretScan: 'not_run', limits };
}
async function main(argv) {
  const options = {};
  if (argv.shift() !== 'prepare') throw new Hold('INVALID_COMMAND');
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--repo', '--task-dir', '--task-id', '--scope-json'].includes(argv[i]) || !argv[i + 1] || options[argv[i]]) throw new Hold('INVALID_ARGUMENT');
    options[argv[i]] = argv[i + 1];
  }
  if (!options['--repo'] || !options['--task-dir']) throw new Hold('INVALID_ARGUMENT');
  let scope;
  try { scope = options['--scope-json'] === undefined ? [] : JSON.parse(options['--scope-json']); } catch { throw new Hold('INVALID_SCOPE'); }
  return prepareWorkspace({ repo: options['--repo'], taskDir: options['--task-dir'], taskId: options['--task-id'], scope });
}
// Integration reads the same bounded source view; it never prepares or changes
// a worktree. The effective scope comes from the already verified receipt.
function captureScopedSource({ repo, scope, keepBytes = true, limits = LIMITS }) {
  if (!Array.isArray(scope) || scope.length > 500 || scope.some(v => !safeRelative(v))) throw new Hold('INVALID_SCOPE');
  repo = canonical(repo);
  return capture(repo, { ...LIMITS, ...limits }, disabledFilters(repo, limits), keepBytes, scope);
}
module.exports = { prepareWorkspace, inspectSource, captureScopedSource, safeSource, rejectSecrets, normalizeScope, DEFAULT_SCOPE, LIMITS, main };
if (require.main === module) main(process.argv.slice(2)).catch(e => ({ ok: false, code: e.code || 'WORKSPACE_PREPARE_FAILED' }))
  .then(result => { process.stdout.write(JSON.stringify(result) + '\n'); process.exitCode = result.ok ? 0 : 2; });
