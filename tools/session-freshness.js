#!/usr/bin/env node
'use strict';

// Read-only observations, not a synchronizer or a permission/decision hook.
// Hook: node <canonical checkout>/tools/session-freshness.js --hook --repo <canonical checkout>
// Antigravity PreInvocation: replace --hook with --antigravity-hook (invocationNum 0 only).
// Repeat --repo for separately authorized repositories. Manual --files <relative file> is repeatable.
// Manual checks may opt into --timeout-ms 1..30000; automatic hooks always retain the 1700ms cap.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const POLICY = 'docs/AI_운영원칙.md';
const EVENTS = new Set(['SessionStart', 'UserPromptSubmit']);
const BUDGET_MS = 1700;
const MAX_MANUAL_BUDGET_MS = 30000;
const MAX_STATUS_BYTES = 16 * 1024 * 1024;
const MAX_INPUT = 256 * 1024;
const MAX_REPOS = 8;
const MAX_FILES = 16;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const HASH_CHUNK_BYTES = 64 * 1024;
const MAX_CHANGED_FILES = 2048;
const OID = /^[0-9a-f]{40,64}$/;
// Only these fixed, public operating paths may appear in automatic context.
const DISPLAY_ROOTS = ['C:/Users/q1212/Documents/SYNK-appsscript', 'C:/Users/q1212/Documents/SYNK-talk'];

function localPath(value) {
  return typeof value === 'string' && value.length > 0 && value.length < 32768
    && !value.includes('\0') && path.isAbsolute(value) && !/^(?:\\\\|\/\/)/.test(value);
}

function samePath(a, b) {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function repositories(repo) {
  const roots = repo === undefined ? [] : Array.isArray(repo) ? repo : [repo];
  if (roots.length > MAX_REPOS || !roots.every(localPath)) throw new Error('invalid-repositories');
  return [...new Set(roots.map(root => path.resolve(root)))];
}

function reference(root, slot) {
  return DISPLAY_ROOTS.find(known => samePath(path.resolve(known), root)) || 'configured-repo-' + slot;
}

function relativeFile(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 1024
    && !/[\x00-\x1f\x7f:*?"<>|]/.test(value) && !path.isAbsolute(value)
    && !value.split(/[\\/]/).some(part => !part || part === '.' || part === '..');
}

function publicFile(value) {
  if (!relativeFile(value)) return false;
  const parts = value.toLowerCase().split(/[\\/]/);
  return !parts.some(part => part.startsWith('.') ||
    /(?:secret|credential|password|token|private[-_]?key|service[-_]?account|auth[-_.]|자격증명|비밀번호|개인정보|학생데이터)/.test(part))
    && /\.(?:md|txt|json|js|cjs|mjs|ts|tsx|jsx|html?|css|ya?ml|csv|tsv|svg|png|jpe?g|avif|webp|gif|pdf|docx|pptx|xlsx|mp3|wav|m4a|aac|ogg|opus|flac|mp4|m4v|mov|webm|mkv|avi)$/.test(parts.at(-1));
}

async function safeStat(root, relative) {
  if (!relativeFile(relative)) throw new Error('unsafe-path');
  let filename = root;
  const parts = relative.split(/[\\/]/);
  for (let i = 0; i < parts.length; i++) {
    filename = path.join(filename, parts[i]);
    const stat = await fs.lstat(filename, { bigint: true });
    if (stat.isSymbolicLink() || (i < parts.length - 1 && !stat.isDirectory())) throw new Error('unsafe-path');
    if (i === parts.length - 1) {
      if (!within(root, await fs.realpath(filename))) throw new Error('unsafe-path');
      return { filename, stat };
    }
  }
}

function gitEnvironment() {
  // Inherited GIT_DIR / GIT_WORK_TREE / GIT_CONFIG_* must not redirect the query.
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
    GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' };
  // Preserve only safe.directory entries already supplied by the host sandbox.
  // Do not invent a trusted path, broaden its value, or write any Git configuration.
  const count = Number(process.env.GIT_CONFIG_COUNT);
  let kept = 0;
  if (Number.isInteger(count) && count >= 0 && count <= 64) {
    for (let i = 0; i < count; i++) {
      const key = process.env['GIT_CONFIG_KEY_' + i];
      const value = process.env['GIT_CONFIG_VALUE_' + i];
      if (key && key.toLowerCase() === 'safe.directory' && value !== undefined) {
        env['GIT_CONFIG_KEY_' + kept] = 'safe.directory';
        env['GIT_CONFIG_VALUE_' + kept++] = value;
      }
    }
  }
  if (kept) env.GIT_CONFIG_COUNT = String(kept);
  return env;
}

function reader(deadline, run = execFile) {
  const env = gitEnvironment();
  return (cwd, args, { emptyExitOne = false, maxBuffer = 512 * 1024 } = {}) => new Promise((resolve, reject) => {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining < 1) return reject(new Error('deadline'));
    run('git', ['--no-pager', '--no-optional-locks', '-c', 'core.fsmonitor=false',
      '-c', 'core.untrackedCache=false', ...args], {
      cwd, env, encoding: 'utf8', windowsHide: true, shell: false,
      timeout: remaining, maxBuffer,
    }, (error, stdout, stderr) => {
      // Never propagate stderr, paths, config values, or command text.
      if (error && !(emptyExitOne && error.code === 1 && !stdout)) {
        // Classify a definite non-repository separately from timeout, trust, or I/O failure.
        const failure = new Error('git-unavailable');
        failure.notRepository = error.code === 128 && /^fatal: not a git repository(?:[ (:]|$)/i.test(stderr || '');
        reject(failure);
      }
      else resolve(stdout);
    });
  });
}

async function location(git, cwd) {
  const rows = (await git(cwd, ['rev-parse', '--path-format=absolute',
    '--show-toplevel', '--git-common-dir'])).trim().split(/\r?\n/);
  if (rows.length !== 2 || !rows.every(localPath)) throw new Error('location-unavailable');
  return { root: await fs.realpath(rows[0]), common: await fs.realpath(rows[1]) };
}

async function fingerprint(root) {
  const filename = path.join(root, POLICY);
  try {
    const stat = await fs.lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_INPUT) return { state: 'unavailable' };
    const resolved = await fs.realpath(filename);
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
      return { state: 'unavailable' };
    }
    const bytes = await fs.readFile(filename);
    if (bytes.length > MAX_INPUT) return { state: 'unavailable' };
    return { state: 'present', sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  } catch (error) {
    return { state: error.code === 'ENOENT' ? 'missing' : 'unavailable' };
  }
}

function trackedCount(raw) {
  return statusRecords(raw).filter(record => record.code !== '??').length;
}

function statusRecords(raw) {
  const records = raw.split('\0');
  const parsed = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    if (record.length < 4 || record[2] !== ' ') throw new Error('status-unavailable');
    const entry = { code: record.slice(0, 2), name: record.slice(3) };
    if (/[RC]/.test(entry.code)) entry.from = records[++i];
    if (!relativeFile(entry.name) || (entry.from !== undefined && !relativeFile(entry.from))) throw new Error('status-unavailable');
    parsed.push(entry);
  }
  return parsed;
}

async function safeStatus(git, cwd) {
  // status can invoke arbitrary clean/process filters while refreshing tracked files.
  // Query effective filter keys first, then override every driver for this command only.
  const raw = await git(cwd, ['config', '--null', '--name-only', '--get-regexp',
    String.raw`^filter\..*\.(clean|process|required)$`], { emptyExitOne: true });
  const drivers = new Set();
  for (const key of raw.split('\0').filter(Boolean)) {
    if (!/^filter\.[^\0\r\n=]+\.(?:clean|process|required)$/.test(key)) throw new Error('filters-unavailable');
    drivers.add(key.replace(/\.(?:clean|process|required)$/, ''));
  }
  const overrides = [];
  for (const driver of drivers) {
    overrides.push('-c', driver + '.clean=', '-c', driver + '.process=', '-c', driver + '.required=false');
  }
  if (overrides.join('').length > 16000) throw new Error('filters-unavailable');
  // Bound status bytes separately from the much smaller configuration/ref responses.
  // Thousands of entries can still be counted without attempting metadata for all of them.
  return git(cwd, [...overrides, 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=all'],
    { maxBuffer: MAX_STATUS_BYTES });
}

async function workingSnapshot(git, root, deadline) {
  const basis = 'path-size-mtimeNs-ctimeNs-mode;metadata-only;git-ignored-excluded';
  const incomplete = (trackedDirty = null, untracked = null) => ({
    state: 'incomplete', trackedDirty, untracked, fingerprint: { state: 'incomplete', basis },
  });
  try {
    const entries = statusRecords(await safeStatus(git, root));
    const trackedDirty = entries.filter(entry => entry.code !== '??').length;
    const untracked = entries.length - trackedDirty;
    if (entries.length > MAX_CHANGED_FILES) return incomplete(trackedDirty, untracked);
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const hash = crypto.createHash('sha256');
    for (let offset = 0; offset < entries.length; offset += 32) {
      if (performance.now() >= deadline) return incomplete(trackedDirty, untracked);
      const rows = await Promise.all(entries.slice(offset, offset + 32).map(async entry => {
        let metadata;
        try {
          const { stat } = await safeStat(root, entry.name);
          metadata = [String(stat.size), String(stat.mtimeNs), String(stat.ctimeNs), String(stat.mode)];
        } catch (error) {
          if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
          metadata = ['missing'];
        }
        return JSON.stringify([entry.code, entry.name, entry.from || null, metadata]);
      }));
      for (const row of rows) hash.update(row + '\n');
    }
    return { state: 'observed', trackedDirty, untracked,
      fingerprint: { state: 'present', sha256: hash.digest('hex'), basis } };
  } catch { return incomplete(); }
}

async function fileFingerprint(git, root, relative, deadline) {
  if (!publicFile(relative)) return { state: 'refused' };
  if (performance.now() >= deadline) return { state: 'incomplete' };
  let handle;
  try {
    // Git-ignored credentials/private artifacts are excluded even when explicitly requested.
    const ignored = await git(root, ['check-ignore', '--no-index', '--', relative], { emptyExitOne: true });
    if (ignored) return { state: 'refused' };
    if (performance.now() >= deadline) return { state: 'incomplete' };
    const { filename, stat } = await safeStat(root, relative);
    if (!stat.isFile()) return { state: 'refused' };
    if (stat.size > BigInt(MAX_FILE_BYTES)) return { state: 'incomplete' };
    handle = await fs.open(filename, 'r');
    const opened = await handle.stat({ bigint: true });
    if (opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size || opened.mtimeNs !== stat.mtimeNs) {
      return { state: 'unavailable' };
    }
    const buffer = Buffer.alloc(HASH_CHUNK_BYTES);
    const hash = crypto.createHash('sha256');
    let length = 0;
    while (true) {
      if (performance.now() >= deadline) return { state: 'incomplete' };
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, length);
      if (!bytesRead) break;
      length += bytesRead;
      if (length > MAX_FILE_BYTES) return { state: 'incomplete' };
      hash.update(buffer.subarray(0, bytesRead));
    }
    const after = await handle.stat({ bigint: true });
    if (after.size !== opened.size || after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs) return { state: 'unavailable' };
    if (performance.now() >= deadline) return { state: 'incomplete' };
    await safeStat(root, relative); // Recheck path components after reading; never output contents.
    return { state: 'present', sha256: hash.digest('hex') };
  } catch (error) {
    return { state: error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'missing' :
      error.message === 'unsafe-path' ? 'refused' : 'unavailable' };
  } finally { if (handle) await handle.close().catch(() => {}); }
}

async function compareFiles(git, current, canonical, files, deadline) {
  const comparisons = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const [left, right] = await Promise.all([
      fileFingerprint(git, current, file, deadline), fileFingerprint(git, canonical, file, deadline),
    ]);
    const readable = value => value.state === 'present' || value.state === 'missing';
    const comparison = !readable(left) || !readable(right) ? 'unavailable' :
      left.state === 'missing' && right.state === 'missing' ? 'both-missing' :
      left.state === right.state && left.sha256 === right.sha256 ? 'same' : 'different';
    comparisons.push({ request: index + 1, current: left, canonical: right, comparison });
  }
  return comparisons;
}

async function baseline(git, cwd) {
  // All refs are local snapshots. No remote update or network request is made.
  const candidates = [['master', 'refs/heads/master'],
    ['origin/HEAD', 'refs/remotes/origin/HEAD'], ['main', 'refs/heads/main']];
  // One process for all candidates, including missing refs; the second snapshot uses one too.
  const raw = await git(cwd, ['for-each-ref', '--format=%(refname) %(objectname) %(objecttype)',
    ...candidates.map(([, ref]) => ref)]);
  const commits = new Map();
  for (const line of raw.trim().split(/\r?\n/)) {
    const [ref, head, type, extra] = line.split(' ');
    if (type === 'commit' && !extra && OID.test(head)) commits.set(ref, head);
  }
  for (const [source, ref] of candidates) {
    // for-each-ref also accepts path prefixes; a branch such as master/experiment is not master.
    if (commits.has(ref)) return { source, head: commits.get(ref) };
  }
  throw new Error('baseline-unavailable');
}

async function collect({ cwd = process.cwd(), repo, files = [], timeoutMs = BUDGET_MS, manual = false, run } = {}) {
  const started = performance.now();
  // A larger timeout alone cannot extend an automatic/library invocation.
  const cap = manual === true ? MAX_MANUAL_BUDGET_MS : BUDGET_MS;
  const budget = Math.min(cap, Math.max(1, Number(timeoutMs) || BUDGET_MS));
  const git = reader(started + budget, run);
  const observedAt = new Date().toISOString();
  let scopeVerified = repo === undefined;
  const unavailable = () => ({ status: 'unavailable', observedAt, scopeVerified });
  let roots;
  try { roots = repositories(repo); } catch { return unavailable(); }
  if (!localPath(cwd) || !Array.isArray(files) || files.length > MAX_FILES) return unavailable();
  let timer;
  const work = async () => {
    let current;
    try { current = await location(git, cwd); } catch (error) {
      if (roots.length && error.notRepository && !roots.some(root => within(root, cwd))) return { status: 'out-of-scope' };
      throw error;
    }
    const locations = await Promise.allSettled(roots.map(root =>
      samePath(root, current.root) ? Promise.resolve(current) : location(git, root)));
    const match = locations.findIndex(result => result.status === 'fulfilled' && samePath(result.value.common, current.common));
    if (roots.length && match < 0) {
      return locations.some(result => result.status === 'rejected') ? unavailable() : { status: 'out-of-scope' };
    }
    const canonical = roots.length ? locations[match].value : current;
    scopeVerified = true;
    const sameRoot = samePath(current.root, canonical.root);
    const deadline = started + budget;
    const currentSnapshotPromise = workingSnapshot(git, current.root, deadline);
    const [headRaw, base, currentSnapshot, canonicalSnapshot, currentPolicy, canonicalPolicy, comparedFiles, canonicalHeadRaw] = await Promise.all([
      git(current.root, ['rev-parse', '--verify', 'HEAD^{commit}']),
      baseline(git, canonical.root),
      currentSnapshotPromise,
      sameRoot ? currentSnapshotPromise : workingSnapshot(git, canonical.root, deadline),
      fingerprint(current.root),
      sameRoot ? Promise.resolve(null) : fingerprint(canonical.root),
      // Leave time for the final commit-consistency checks after a bounded manual comparison.
      compareFiles(git, current.root, canonical.root, files, Math.max(started, deadline - 350)),
      sameRoot ? Promise.resolve(null) : git(canonical.root, ['rev-parse', '--verify', 'HEAD^{commit}']),
    ]);
    const head = headRaw.trim();
    if (!OID.test(head)) throw new Error('head-unavailable');
    const counts = (await git(current.root, ['rev-list', '--left-right', '--count', base.head + '...' + head])).trim();
    if (!/^\d+\s+\d+$/.test(counts)) throw new Error('counts-unavailable');
    const [behind, ahead] = counts.split(/\s+/).map(Number);
    // A concurrent commit invalidates this sample; do not present a mixed snapshot as current.
    const [headAgain, baseAgain, canonicalAgain] = await Promise.all([
      git(current.root, ['rev-parse', '--verify', 'HEAD^{commit}']), baseline(git, canonical.root),
      sameRoot ? Promise.resolve(null) : git(canonical.root, ['rev-parse', '--verify', 'HEAD^{commit}']),
    ]);
    if (headAgain.trim() !== head || baseAgain.head !== base.head || canonicalHeadRaw !== canonicalAgain) throw new Error('changed-during-read');
    return {
      status: 'observed', observedAt, head, baseline: base, ahead, behind,
      canonicalReference: reference(canonical.root, match + 1 || 1),
      canonicalHead: canonicalHeadRaw ? canonicalHeadRaw.trim() : head,
      trackedDirty: currentSnapshot.trackedDirty,
      trackedDirtyBasis: 'external-filters-disabled;untracked-counted-separately',
      working: { current: currentSnapshot, canonical: canonicalSnapshot },
      policy: { current: currentPolicy, canonical: canonicalPolicy || currentPolicy },
      ...(files.length ? { files: comparedFiles } : {}),
    };
  };
  try {
    return await Promise.race([
      work(), new Promise(resolve => { timer = setTimeout(() => resolve(unavailable()), budget); }),
    ]);
  } catch { return unavailable(); }
  finally { clearTimeout(timer); }
}

function render(report) {
  if (report.status === 'out-of-scope') return '';
  if (report.status !== 'observed') {
    if (report.scopeVerified === false) return '[최신 상태 관찰] 최신 확인 불가: 작업 범위를 확인하지 못했습니다. 파일·명령은 변경하거나 차단하지 않았습니다.';
    return '[최신 상태 관찰] 최신 확인 불가. 변경·차단하지 않았습니다. 기준 지침과 관련 파일의 현재 상태를 직접 확인하세요.';
  }
  const short = value => value.slice(0, 12);
  const policy = value => value.state === 'present' ? short(value.sha256) : value.state === 'missing' ? '해당 사본에 없음' : '확인 불가';
  const snapshot = value => `추적 변경 ${value.trackedDirty ?? '확인 불가'} / 미추적 ${value.untracked ?? '확인 불가'} / 지문 ${policy(value.fingerprint)}${value.state === 'incomplete' ? ' (incomplete: 일부 확인 불가)' : ''}`;
  const guidance = report.canonicalReference === DISPLAY_ROOTS[1]
    ? `회사 공통 정본 ${DISPLAY_ROOTS[0]}/docs/AI_운영원칙.md와 이 저장소의 현재 AGENTS.md·docs/공용지침.md를 읽고 관련 원본을 다시 확인하세요.`
    : '이 경로의 현재 운영 지침·관련 원본·트랙 해당 줄을 다시 읽으세요.';
  return [
    `[최신 상태 관찰 · ${report.observedAt}] 로컬 스냅샷이며 지시·자동 동기화·원격 최신성 보장이 아닙니다.`,
    `HEAD ${short(report.head)} | 기준 ${report.baseline.source} ${short(report.baseline.head)} | 앞섬 ${report.ahead} / 뒤처짐 ${report.behind}`,
    `정본 작업본 HEAD ${short(report.canonicalHead)}${report.canonicalHead !== report.head ? ' | 정본 작업본과 커밋 다름: 기준 가지와 별도 근거입니다. 관련 원본을 대조하세요.' : ' | 현재 사본과 같은 커밋'}`,
    `현재 작업본: ${snapshot(report.working.current)}. 정본 작업본: ${snapshot(report.working.canonical)}.`,
    `작업본 지문은 경로·크기·수정시각 관찰이며 내용 동일성 증명이 아닙니다. Git 무시 파일은 제외합니다. 뒤처짐 0이어도 작업물은 다를 수 있습니다.`,
    `공통 운영 지침 작업파일 SHA256(미커밋 포함): 현재 ${policy(report.policy.current)} / 기준 작업본 ${policy(report.policy.canonical)}`,
    `정본 작업본: ${report.canonicalReference}. ${guidance} 필요하면 수동 --files <상대경로> --json으로 내용 지문을 대조하고 다른 작업 사본과 미커밋은 보존하세요.`,
  ].join('\n');
}

function output(report, { hookEvent, antigravityHook = false, json = false } = {}) {
  if (report.status === 'out-of-scope') return '';
  if (antigravityHook) return JSON.stringify({ injectSteps: [{ ephemeralMessage: render(report) }] });
  if (EVENTS.has(hookEvent)) {
    return JSON.stringify({ hookSpecificOutput: { hookEventName: hookEvent, additionalContext: render(report) } });
  }
  if (json) return JSON.stringify(report);
  const detail = (report.files || []).map(file =>
    `요청 ${file.request}: ${file.comparison} | 현재 ${file.current.state} ${file.current.sha256 || ''} | 정본 ${file.canonical.state} ${file.canonical.sha256 || ''}`);
  return [render(report), ...detail].join('\n');
}

function parseArgs(argv) {
  const options = { hook: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--hook') options.hook = true;
    else if (argv[i] === '--antigravity-hook') options.antigravityHook = true;
    else if (argv[i] === '--json') options.json = true;
    else if (argv[i] === '--repo' && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      const root = argv[++i];
      options.repo = options.repo === undefined ? root : [...(Array.isArray(options.repo) ? options.repo : [options.repo]), root];
    }
    else if (argv[i] === '--files' && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      (options.files ||= []).push(argv[++i]);
    }
    else if (argv[i] === '--timeout-ms' && options.timeoutMs === undefined) {
      const value = argv[++i];
      if (!/^[1-9]\d*$/.test(value || '') || Number(value) > MAX_MANUAL_BUDGET_MS) throw new Error('invalid-arguments');
      options.timeoutMs = Number(value);
    }
    else throw new Error('invalid-arguments');
  }
  if (options.hook && options.antigravityHook) throw new Error('invalid-arguments');
  if (options.timeoutMs !== undefined && (options.hook || options.antigravityHook)) throw new Error('invalid-arguments');
  repositories(options.repo);
  if (options.files && (options.hook || options.antigravityHook || options.files.length > MAX_FILES)) throw new Error('invalid-arguments');
  return options;
}

async function readHookInput(stream, antigravityHook = false) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks = [];
    const done = (error, value) => {
      clearTimeout(timer);
      stream.off('data', onData); stream.off('end', onEnd); stream.off('error', onError);
      stream.pause();
      if (error) reject(new Error('invalid-input')); else resolve(value);
    };
    const onData = chunk => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_INPUT) done(true); else chunks.push(Buffer.from(chunk));
    };
    const onEnd = () => {
      try {
        const raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!raw || Array.isArray(raw) || typeof raw !== 'object') return done(true);
        // Explicit allowlist: never retain prompts, transcripts, account/model/session metadata.
        done(false, antigravityHook
          ? { workspacePaths: raw.workspacePaths, invocationNum: raw.invocationNum }
          : { cwd: raw.cwd, hookEvent: raw.hook_event_name });
      } catch { done(true); }
    };
    const onError = () => done(true);
    const timer = setTimeout(() => done(true), 250);
    stream.on('data', onData); stream.once('end', onEnd); stream.once('error', onError);
    stream.resume();
  });
}

async function collectAntigravity(input, { repo, timeoutMs = BUDGET_MS, run } = {}) {
  if (!Number.isInteger(input.invocationNum) || input.invocationNum < 0) {
    return { status: 'unavailable', observedAt: new Date().toISOString(), scopeVerified: false };
  }
  if (input.invocationNum !== 0) return { status: 'out-of-scope' };
  try {
    if (!repositories(repo).length || !Array.isArray(input.workspacePaths)) throw new Error('invalid-input');
  } catch { return { status: 'unavailable', observedAt: new Date().toISOString(), scopeVerified: false }; }
  const deadline = performance.now() + Math.min(BUDGET_MS, Math.max(1, Number(timeoutMs) || BUDGET_MS));
  let failed = false;
  for (const cwd of input.workspacePaths) {
    if (!localPath(cwd)) { failed = true; continue; }
    const remaining = Math.floor(deadline - performance.now());
    if (remaining < 1) { failed = true; break; }
    const report = await collect({ cwd, repo, timeoutMs: remaining, run });
    if (report.status === 'observed') return report;
    if (report.status === 'unavailable') failed = true;
  }
  return failed ? { status: 'unavailable', observedAt: new Date().toISOString(), scopeVerified: false } : { status: 'out-of-scope' };
}

async function main() {
  let options = { antigravityHook: process.argv.includes('--antigravity-hook') };
  let hookEvent;
  let report;
  try {
    options = parseArgs(process.argv.slice(2));
    let cwd = process.cwd();
    if (options.antigravityHook) {
      const input = await readHookInput(process.stdin, true);
      report = await collectAntigravity(input, { repo: options.repo });
    } else if (options.hook) {
      const input = await readHookInput(process.stdin);
      hookEvent = input.hookEvent;
      if (typeof hookEvent !== 'string') throw new Error('invalid-event');
      if (!EVENTS.has(hookEvent)) return;
      if (!localPath(input.cwd)) throw new Error('invalid-cwd');
      cwd = input.cwd;
    }
    if (!report) report = await collect({ cwd, repo: options.repo, files: options.files,
      timeoutMs: options.timeoutMs, manual: !options.hook && !options.antigravityHook });
  } catch { report = { status: 'unavailable', observedAt: new Date().toISOString(), scopeVerified: false }; }
  const text = output(report, { hookEvent, antigravityHook: options.antigravityHook, json: options.json });
  if (text) process.stdout.write(text + '\n');
}

module.exports = { collect, collectAntigravity, render, output, trackedCount, parseArgs, readHookInput };
if (require.main === module) main().catch(() => {
  process.stdout.write('[최신 상태 관찰] 최신 확인 불가. 변경·차단하지 않았습니다.\n');
});
