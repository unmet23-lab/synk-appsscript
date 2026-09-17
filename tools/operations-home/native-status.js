'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile, execFileSync } = require('node:child_process');
const { promisify } = require('node:util');

const runFile = promisify(execFile);
const SOURCE = 'Claude Code';
const CACHE_MS = 30_000;
const cache = new Map();
const ROOTS_CACHE_MS = 60_000;
const rootsCache = new Map();

function existingDirectory(directory) {
  if (typeof directory !== 'string' || !directory.trim()) return null;
  try {
    const absolute = fs.realpathSync.native(path.resolve(directory));
    if (!fs.statSync(absolute).isDirectory()) return null;
    return absolute;
  } catch {
    return null;
  }
}

function directoryKey(directory) {
  const absolute = existingDirectory(directory);
  return absolute && (process.platform === 'win32' ? absolute.toLowerCase() : absolute);
}

function companyRoots(root) {
  const primary = existingDirectory(root);
  if (!primary) return [];
  const key = directoryKey(primary);
  const cached = rootsCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.roots.filter(directory => directoryKey(directory));
  }

  const roots = new Map();
  const seeds = [primary, ...['SYNK-talk', 'SYNK-website'].map(name => path.join(path.dirname(primary), name))];
  for (const seed of seeds) {
    const directory = existingDirectory(seed);
    if (directory) roots.set(directoryKey(directory), directory);
  }
  // Only Git's registered worktrees extend the allowlist; matching names do not.
  for (const seed of [...roots.values()]) {
    try {
      const listing = execFileSync('git', ['-C', seed, 'worktree', 'list', '--porcelain', '-z'], {
        windowsHide: true,
        timeout: 2_000,
        maxBuffer: 256 * 1024,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      for (const record of listing.split('\0\0')) {
        const fields = record.split('\0');
        if (fields.some(field => field === 'prunable' || field.startsWith('prunable '))) continue;
        const field = fields.find(value => value.startsWith('worktree '));
        if (!field) continue;
        const listed = field.slice('worktree '.length);
        if (!path.isAbsolute(listed)) continue;
        const directory = existingDirectory(listed);
        if (directory) roots.set(directoryKey(directory), directory);
      }
    } catch {
      // An unavailable Git command cannot remove the existing company roots.
    }
  }
  const result = [...roots.values()];
  rootsCache.set(key, { roots: result, expiresAt: Date.now() + ROOTS_CACHE_MS });
  return [...result];
}

function statusOf(session) {
  if (session.state === 'failed') return 'error';
  if (session.state === 'stopped') return 'unknown';
  if (session.state === 'blocked' || session.status === 'waiting') return 'needs_attention';
  if (session.status === 'busy' || session.state === 'working') return 'running';
  if (session.state === 'done' || session.status === 'idle') return 'idle';
  return 'unknown';
}

function tasksFrom(sessions, allowedRoots) {
  if (!Array.isArray(sessions) || sessions.some(session => !session || typeof session !== 'object' || typeof session.cwd !== 'string')) {
    throw Object.assign(new Error(), { code: 'INVALID_RESPONSE' });
  }
  const tasks = [];
  const seen = new Set();
  for (const session of sessions) {
    if (!session || typeof session !== 'object' || !allowedRoots.has(directoryKey(session.cwd))) continue;
    const id = session.sessionId || session.id;
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    seen.add(id);
    const sourceStatus = {};
    for (const field of ['state', 'status', 'waitingFor']) {
      if (typeof session[field] === 'string') sourceStatus[field] = session[field];
    }
    tasks.push({
      id,
      title: typeof session.name === 'string' && session.name.trim() ? session.name : '제목 없는 작업',
      cwd: session.cwd,
      status: statusOf(session),
      source: SOURCE,
      sourceStatus,
    });
  }
  return tasks;
}

function copySnapshot(snapshot) {
  return { ...snapshot, tasks: snapshot.tasks.map(task => ({ ...task, sourceStatus: { ...task.sourceStatus } })) };
}

function failureCode(error) {
  if (error.code === 'ENOENT') return 'NOT_INSTALLED';
  if (error.killed || error.code === 'ETIMEDOUT') return 'TIMEOUT';
  if (error instanceof SyntaxError || error.code === 'INVALID_RESPONSE') return 'INVALID_RESPONSE';
  return 'UNAVAILABLE';
}

// Read metadata through the official CLI only. Importing this module starts nothing.
async function readClaude(root) {
  const rootKey = directoryKey(root);
  if (!rootKey) {
    return { connected: false, stale: true, checkedAt: null, lastAttemptAt: new Date().toISOString(), source: SOURCE, tasks: [], error: 'Claude 작업 상태 연결 실패', errorCode: 'INVALID_ROOT' };
  }
  let entry = cache.get(rootKey);
  if (!entry) {
    entry = { expiresAt: 0, snapshot: null, lastSuccess: null, pending: null };
    cache.set(rootKey, entry);
  }
  if (entry.pending) return copySnapshot(await entry.pending);
  if (entry.snapshot && Date.now() < entry.expiresAt) return copySnapshot(entry.snapshot);

  const lastAttemptAt = new Date().toISOString();
  const allowedRoots = new Set(companyRoots(root).map(directoryKey).filter(Boolean));
  entry.pending = (async () => {
    try {
      const { stdout } = await runFile(path.join(os.homedir(), '.local', 'bin', 'claude.exe'), ['agents', '--json'], {
        cwd: root,
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 1024 * 1024,
        encoding: 'utf8',
      });
      const tasks = tasksFrom(JSON.parse(stdout), allowedRoots);
      const snapshot = { connected: true, stale: false, checkedAt: new Date().toISOString(), lastAttemptAt, source: SOURCE, tasks };
      entry.lastSuccess = snapshot;
      entry.snapshot = snapshot;
    } catch (error) {
      entry.snapshot = {
        connected: false,
        stale: true,
        checkedAt: entry.lastSuccess ? entry.lastSuccess.checkedAt : null,
        lastAttemptAt,
        source: SOURCE,
        tasks: entry.lastSuccess ? entry.lastSuccess.tasks : [],
        error: 'Claude 작업 상태 연결 실패',
        errorCode: failureCode(error),
      };
    }
    entry.expiresAt = Date.now() + CACHE_MS;
    return entry.snapshot;
  })();
  try {
    return copySnapshot(await entry.pending);
  } finally {
    entry.pending = null;
  }
}

module.exports = { readClaude, companyRoots };
