#!/usr/bin/env node
'use strict';

// Read-only observations, not a synchronizer or a permission/decision hook.
// Hook: node <canonical checkout>/tools/session-freshness.js --hook --repo <canonical checkout>
// Antigravity PreInvocation: replace --hook with --antigravity-hook (invocationNum 0 only).
// Manual: node tools/session-freshness.js [--repo <canonical checkout>] [--json]
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const POLICY = 'docs/AI_운영원칙.md';
const EVENTS = new Set(['SessionStart', 'UserPromptSubmit']);
const BUDGET_MS = 1700;
const MAX_INPUT = 256 * 1024;
const OID = /^[0-9a-f]{40,64}$/;

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
  return (cwd, args, { emptyExitOne = false } = {}) => new Promise((resolve, reject) => {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining < 1) return reject(new Error('deadline'));
    run('git', ['--no-pager', '--no-optional-locks', '-c', 'core.fsmonitor=false',
      '-c', 'core.untrackedCache=false', ...args], {
      cwd, env, encoding: 'utf8', windowsHide: true, shell: false,
      timeout: remaining, maxBuffer: 512 * 1024,
    }, (error, stdout) => {
      // Never propagate stderr, paths, config values, or command text.
      if (error && !(emptyExitOne && error.code === 1 && !stdout)) reject(new Error('git-unavailable'));
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
  const records = raw.split('\0');
  let count = 0;
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    if (record.length < 4 || record[2] !== ' ') throw new Error('status-unavailable');
    count++;
    if (/[RC]/.test(record.slice(0, 2))) i++; // -z rename/copy has a second pathname.
  }
  return count;
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
  return git(cwd, [...overrides, 'status', '--porcelain=v1', '-z', '--untracked-files=no', '--ignore-submodules=all']);
}

async function baseline(git, cwd) {
  // All refs are local snapshots. No remote update or network request is made.
  for (const [source, ref] of [['master', 'refs/heads/master'],
    ['origin/HEAD', 'refs/remotes/origin/HEAD'], ['main', 'refs/heads/main']]) {
    try {
      const head = (await git(cwd, ['rev-parse', '--verify', ref + '^{commit}'])).trim();
      if (OID.test(head)) return { source, head };
    } catch { /* Try the next existing local default ref within the same deadline. */ }
  }
  throw new Error('baseline-unavailable');
}

async function collect({ cwd = process.cwd(), repo, timeoutMs = BUDGET_MS, run } = {}) {
  const started = performance.now();
  const budget = Math.min(BUDGET_MS, Math.max(1, Number(timeoutMs) || BUDGET_MS));
  const git = reader(started + budget, run);
  const observedAt = new Date().toISOString();
  let inScope = !repo || (localPath(repo) && localPath(cwd) && within(repo, cwd));
  const unavailable = () => inScope ? { status: 'unavailable', observedAt } : { status: 'out-of-scope' };
  if (!localPath(cwd) || (repo !== undefined && !localPath(repo))) return unavailable();
  let timer;
  const work = async () => {
    const current = await location(git, cwd);
    const canonical = repo ? await location(git, repo) : current;
    if (!samePath(current.common, canonical.common)) return { status: 'out-of-scope' };
    inScope = true;
    const [headRaw, base, dirtyRaw, currentPolicy, canonicalPolicy] = await Promise.all([
      git(current.root, ['rev-parse', '--verify', 'HEAD^{commit}']),
      baseline(git, canonical.root),
      safeStatus(git, current.root),
      fingerprint(current.root),
      samePath(current.root, canonical.root) ? Promise.resolve(null) : fingerprint(canonical.root),
    ]);
    const head = headRaw.trim();
    if (!OID.test(head)) throw new Error('head-unavailable');
    const counts = (await git(current.root, ['rev-list', '--left-right', '--count', base.head + '...' + head])).trim();
    if (!/^\d+\s+\d+$/.test(counts)) throw new Error('counts-unavailable');
    const [behind, ahead] = counts.split(/\s+/).map(Number);
    // A concurrent commit invalidates this sample; do not present a mixed snapshot as current.
    const [headAgain, baseAgain] = await Promise.all([
      git(current.root, ['rev-parse', '--verify', 'HEAD^{commit}']), baseline(git, canonical.root),
    ]);
    if (headAgain.trim() !== head || baseAgain.head !== base.head) throw new Error('changed-during-read');
    return {
      status: 'observed', observedAt, head, baseline: base, ahead, behind,
      trackedDirty: trackedCount(dirtyRaw),
      trackedDirtyBasis: 'external-filters-disabled;untracked-excluded',
      policy: { current: currentPolicy, canonical: canonicalPolicy || currentPolicy },
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
    return '[최신 상태 관찰] 최신 확인 불가. 변경·차단하지 않았습니다. 기준 지침과 관련 파일의 현재 상태를 직접 확인하세요.';
  }
  const short = value => value.slice(0, 12);
  const policy = value => value.state === 'present' ? short(value.sha256) : value.state === 'missing' ? '없음' : '확인 불가';
  return [
    `[최신 상태 관찰 · ${report.observedAt}] 로컬 스냅샷이며 지시·자동 동기화·원격 최신성 보장이 아닙니다.`,
    `HEAD ${short(report.head)} | 기준 ${report.baseline.source} ${short(report.baseline.head)} | 앞섬 ${report.ahead} / 뒤처짐 ${report.behind} | 추적 파일 차이 ${report.trackedDirty} (외부 필터·미추적 제외)`,
    `공통 운영 지침 작업파일 SHA256(미커밋 포함): 현재 ${policy(report.policy.current)} / 기준 작업본 ${policy(report.policy.canonical)}`,
    `기준 커밋 지침: git show ${report.baseline.source}:docs/AI_운영원칙.md. 관련 파일·트랙 해당 줄·최근 변경을 새로 확인하고 다른 작업 사본과 미커밋은 보존하세요.`,
  ].join('\n');
}

function output(report, { hookEvent, antigravityHook = false, json = false } = {}) {
  if (report.status === 'out-of-scope') return '';
  if (antigravityHook) return JSON.stringify({ injectSteps: [{ ephemeralMessage: render(report) }] });
  if (EVENTS.has(hookEvent)) {
    return JSON.stringify({ hookSpecificOutput: { hookEventName: hookEvent, additionalContext: render(report) } });
  }
  return json ? JSON.stringify(report) : render(report);
}

function parseArgs(argv) {
  const options = { hook: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--hook') options.hook = true;
    else if (argv[i] === '--antigravity-hook') options.antigravityHook = true;
    else if (argv[i] === '--json') options.json = true;
    else if (argv[i] === '--repo' && argv[i + 1] && !argv[i + 1].startsWith('--')) options.repo = argv[++i];
    else throw new Error('invalid-arguments');
  }
  if (options.hook && options.antigravityHook) throw new Error('invalid-arguments');
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
    return { status: 'unavailable', observedAt: new Date().toISOString() };
  }
  if (input.invocationNum !== 0) return { status: 'out-of-scope' };
  if (!localPath(repo) || !Array.isArray(input.workspacePaths)) {
    return { status: 'unavailable', observedAt: new Date().toISOString() };
  }
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
  return failed ? { status: 'unavailable', observedAt: new Date().toISOString() } : { status: 'out-of-scope' };
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
    if (!report) report = await collect({ cwd, repo: options.repo });
  } catch { report = { status: 'unavailable', observedAt: new Date().toISOString() }; }
  const text = output(report, { hookEvent, antigravityHook: options.antigravityHook, json: options.json });
  if (text) process.stdout.write(text + '\n');
}

module.exports = { collect, collectAntigravity, render, output, trackedCount, parseArgs, readHookInput };
if (require.main === module) main().catch(() => {
  process.stdout.write('[최신 상태 관찰] 최신 확인 불가. 변경·차단하지 않았습니다.\n');
});
