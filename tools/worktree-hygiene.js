#!/usr/bin/env node
'use strict';

/**
 * 작업본 위생 관찰기.
 *
 * 읽기 전용 `git status --porcelain=v1 -z --untracked-files=all` 결과만 집계한다.
 * 파일 내용은 읽지 않고, 파일 이동·삭제·승인·상주 동작은 하지 않는다.
 */
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 30_000;
const STATUS_MAX_BUFFER = 16 * 1024 * 1024;
const CONFIG_MAX_BUFFER = 256 * 1024;
const MAX_RECORDS = 200_000;
const MAX_FILTER_DRIVERS = 128;
const MAX_FILTER_OVERRIDE_CHARS = 16_000;
const MAX_DIRECTORY_ROWS = 12;
const MAX_PRIVATE_ROWS = 8;
const MAX_PATH_CHARS = 32_767;

function gitEnvironment(source = process.env) {
  // Inherited Git redirection must not make --repo observe a different worktree.
  const env = {
    ...Object.fromEntries(Object.entries(source).filter(([key]) => !/^GIT_/i.test(key))),
    GIT_ATTR_NOSYSTEM: '1',
    GIT_EXTERNAL_DIFF: '',
    GIT_NO_LAZY_FETCH: '1',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_TERMINAL_PROMPT: '0',
  };

  // Preserve only host-provided safe.directory entries. Do not broaden trust or
  // write configuration merely to make a repository readable.
  const count = Number(source.GIT_CONFIG_COUNT);
  let kept = 0;
  if (Number.isInteger(count) && count >= 0 && count <= 64) {
    for (let i = 0; i < count; i++) {
      const key = source['GIT_CONFIG_KEY_' + i];
      const value = source['GIT_CONFIG_VALUE_' + i];
      if (key && key.toLowerCase() === 'safe.directory' && value !== undefined) {
        env['GIT_CONFIG_KEY_' + kept] = 'safe.directory';
        env['GIT_CONFIG_VALUE_' + kept++] = value;
      }
    }
  }
  if (kept) env.GIT_CONFIG_COUNT = String(kept);
  return env;
}

function localRepository(value) {
  if (typeof value !== 'string' || !value || value.length >= MAX_PATH_CHARS || value.includes('\0')) {
    throw new Error('invalid-repository');
  }
  const resolved = path.resolve(value);
  if (/^(?:\\\\|\/\/)/.test(resolved)) throw new Error('invalid-repository');
  return resolved;
}

function makeGitReader({ repo, deadline, run = spawnSync }) {
  const env = gitEnvironment();
  return (args, { maxBuffer = STATUS_MAX_BUFFER, emptyExitOne = false } = {}) => {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining < 1) throw new Error('timeout');
    const result = run('git', [
      '--no-pager', '--no-optional-locks',
      '-c', 'core.fsmonitor=false',
      '-c', 'core.untrackedCache=false',
      '-c', 'diff.external=',
      '-c', 'status.submoduleSummary=false',
      ...args,
    ], {
      cwd: repo,
      env,
      encoding: 'buffer',
      maxBuffer,
      shell: false,
      timeout: remaining,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.error) {
      if (result.error.code === 'ETIMEDOUT') throw new Error('timeout');
      if (result.error.code === 'ENOBUFS') throw new Error('capacity');
      throw new Error('read-error');
    }
    if (result.status !== 0) {
      if (emptyExitOne && result.status === 1 && (!result.stdout || result.stdout.length === 0)) {
        return Buffer.alloc(0);
      }
      const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : String(result.stderr || '');
      if (result.status === 128 && /^fatal: not a git repository(?:[ (:]|$)/i.test(stderr)) {
        throw new Error('not-repository');
      }
      throw new Error('read-error');
    }
    return Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout || '');
  };
}

function decodeUtf8(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error('invalid-output');
  }
}

function validGitPath(name) {
  if (typeof name !== 'string' || !name || name.length >= MAX_PATH_CHARS || name.includes('\0')) return false;
  if (name.startsWith('/') || /^[A-Za-z]:[\\/]/.test(name)) return false;
  return !name.split('/').some(part => !part || part === '..');
}

function parseStatus(buffer) {
  const raw = decodeUtf8(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  if (raw && !raw.endsWith('\0')) throw new Error('invalid-output');
  const fields = raw.split('\0');
  const records = [];
  for (let i = 0; i < fields.length - 1; i++) {
    const field = fields[i];
    if (!field || field.length < 4 || field[2] !== ' ') throw new Error('invalid-output');
    const code = field.slice(0, 2);
    const name = field.slice(3);
    if (!validGitPath(name)) throw new Error('invalid-output');
    const record = { code, name };
    // In porcelain v1 -z, rename/copy is: "XY destination\0source\0".
    if (/[RC]/.test(code)) {
      const from = fields[++i];
      if (!validGitPath(from)) throw new Error('invalid-output');
      record.from = from;
    }
    records.push(record);
    if (records.length > MAX_RECORDS) throw new Error('record-limit');
  }
  return records;
}

function configuredFilterOverrides(git) {
  // A status refresh can invoke clean/process filters. Discover effective driver
  // names, then neutralize every one for the status process only.
  const output = git([
    'config', '--null', '--name-only', '--get-regexp',
    String.raw`^filter\..*\.(clean|process|required)$`,
  ], { maxBuffer: CONFIG_MAX_BUFFER, emptyExitOne: true });
  const keys = decodeUtf8(output).split('\0').filter(Boolean);
  const drivers = new Set();
  for (const key of keys) {
    if (!/^filter\.[^\0\r\n=]+\.(?:clean|process|required)$/.test(key)) throw new Error('filters-limit');
    drivers.add(key.replace(/\.(?:clean|process|required)$/, ''));
  }
  if (drivers.size > MAX_FILTER_DRIVERS) throw new Error('filters-limit');
  const overrides = [];
  for (const driver of drivers) {
    overrides.push('-c', driver + '.clean=', '-c', driver + '.process=', '-c', driver + '.required=false');
  }
  if (overrides.join('').length > MAX_FILTER_OVERRIDE_CHARS) throw new Error('filters-limit');
  return overrides;
}

function statusRecords(git) {
  const filters = configuredFilterOverrides(git);
  return parseStatus(git([
    ...filters,
    'status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=dirty',
  ]));
}

function fileKind(name) {
  const lower = name.toLowerCase();
  if (/\.(?:js|cjs|mjs|jsx|ts|tsx|py|rb|go|rs|java|kt|swift|sh|ps1|html?|css|scss|sql)$/.test(lower)) return 'source';
  if (/\.(?:md|mdx|txt|pdf|docx|pptx|xlsx|odt|rtf)$/.test(lower)) return 'document';
  if (/\.(?:json|jsonl|ya?ml|toml|xml|csv|tsv)$/.test(lower)) return 'data';
  if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?)$/.test(lower)) return 'image';
  if (/\.(?:mp4|m4v|mov|webm|mkv|avi)$/.test(lower)) return 'video';
  if (/\.(?:mp3|wav|m4a|aac|ogg|opus|flac)$/.test(lower)) return 'audio';
  if (/\.(?:zip|7z|rar|tar|tgz|tar\.gz|gz|bz2|xz)$/.test(lower)) return 'archive';
  if (/\.(?:woff2?|ttf|otf|eot)$/.test(lower)) return 'font';
  if (/\.(?:exe|dll|so|dylib|bin|wasm|class)$/.test(lower)) return 'binary';
  return 'other';
}

function privateRuntimeFolder(name) {
  const directories = name.split('/').slice(0, -1);
  if (!directories.length) return null;
  const lowered = directories.map(part => part.toLowerCase());
  const browser = part => /(?:chrome|chromium|edge|firefox|playwright|puppeteer|browser)/.test(part);
  const runtime = part => /(?:^|[._ -])(?:tmp|temp|cache|caches|profile|profiles|user[._ -]?data)(?:$|[._ -])/.test(part);
  const strong = part => browser(part) && runtime(part);
  let end = lowered.findIndex(strong);
  if (end < 0) {
    const browserAt = lowered.findIndex(browser);
    const runtimeAt = lowered.findIndex(runtime);
    if (browserAt < 0 || runtimeAt < 0) return null;
    end = Math.max(browserAt, runtimeAt);
  }
  return directories.slice(0, end + 1).join('/');
}

function publicDirectory(name) {
  const directory = path.posix.dirname(name);
  if (directory === '.') return '[repo-root]';
  const parts = directory.split('/');
  const sensitive = /(?:secret|credential|password|token|private[-_ ]?key|service[-_ ]?account|auth(?:[-_. ]|$)|자격증명|비밀번호|개인정보|학생데이터)/i;
  if (parts.some(part => part.startsWith('.') || sensitive.test(part))) return '[private-or-hidden]';
  const visible = parts.slice(0, 4).join('/');
  return visible + (parts.length > 4 ? '/…' : '');
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function sortedRows(map, keyName) {
  return [...map].map(([key, files]) => ({ [keyName]: key, files }))
    .sort((a, b) => b.files - a.files || String(a[keyName]).localeCompare(String(b[keyName]), 'ko'));
}

function trackedSummary(records) {
  const tracked = records.filter(record => record.code !== '??');
  const byCode = new Map();
  let staged = 0;
  let worktree = 0;
  let conflicts = 0;
  let renamedOrCopied = 0;
  let deleted = 0;
  for (const record of tracked) {
    increment(byCode, record.code);
    const [index, tree] = record.code;
    if (index !== ' ' && index !== '?') staged++;
    if (tree !== ' ' && tree !== '?') worktree++;
    if (/^(?:DD|AU|UD|UA|DU|AA|UU)$/.test(record.code)) conflicts++;
    if (/[RC]/.test(record.code)) renamedOrCopied++;
    if (/D/.test(record.code)) deleted++;
  }
  return {
    entries: tracked.length,
    staged,
    worktree,
    conflicts,
    renamedOrCopied,
    deleted,
    byCode: Object.fromEntries([...byCode].sort(([a], [b]) => a.localeCompare(b))),
  };
}

function untrackedSummary(records) {
  const untracked = records.filter(record => record.code === '??');
  const directories = new Map();
  const kinds = new Map();
  const privateFolders = new Map();
  let privateFiles = 0;
  for (const record of untracked) {
    increment(kinds, fileKind(record.name));
    const privateFolder = privateRuntimeFolder(record.name);
    if (privateFolder) {
      privateFiles++;
      increment(privateFolders, privateFolder);
      increment(directories, '[private-runtime]');
    } else {
      increment(directories, publicDirectory(record.name));
    }
  }

  const allDirectories = sortedRows(directories, 'directory');
  const visibleDirectories = allDirectories.slice(0, MAX_DIRECTORY_ROWS);
  const hiddenDirectories = allDirectories.slice(MAX_DIRECTORY_ROWS);
  const privateRows = sortedRows(privateFolders, 'folder').slice(0, MAX_PRIVATE_ROWS)
    .map((row, index) => ({ folder: 'private-runtime-' + (index + 1), files: row.files,
      category: 'browser-profile-or-cache' }));
  return {
    entries: untracked.length,
    byDirectory: visibleDirectories,
    omittedDirectories: {
      directories: hiddenDirectories.length,
      files: hiddenDirectories.reduce((sum, row) => sum + row.files, 0),
    },
    byKind: Object.fromEntries([...kinds].sort(([a], [b]) => a.localeCompare(b))),
    privateRuntimeCandidates: {
      classification: 'candidate-only; no deletion or regeneration decision',
      folders: privateFolders.size,
      files: privateFiles,
      largestFolders: privateRows,
      omittedFolders: Math.max(0, privateFolders.size - privateRows.length),
      pathsRedacted: true,
    },
  };
}

function incomplete(observedAt, reason) {
  const allowed = new Set(['timeout', 'capacity', 'record-limit', 'filters-limit', 'invalid-output',
    'not-repository', 'invalid-repository', 'read-error']);
  return {
    status: 'incomplete',
    observedAt,
    readOnly: true,
    reason: allowed.has(reason) ? reason : 'read-error',
    tracked: null,
    untracked: null,
  };
}

function collect({ repo = process.cwd(), timeoutMs = DEFAULT_TIMEOUT_MS, run = spawnSync } = {}) {
  const observedAt = new Date().toISOString();
  let root;
  try {
    root = localRepository(repo);
    const budget = Math.min(MAX_TIMEOUT_MS, Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
    const git = makeGitReader({ repo: root, deadline: performance.now() + budget, run });
    const records = statusRecords(git);
    return {
      status: 'observed',
      observedAt,
      readOnly: true,
      basis: 'git-status-porcelain-v1-z; untracked-all; external-filters-disabled; submodule-dirty-unexpanded',
      limits: {
        timeoutMs: budget,
        statusBytes: STATUS_MAX_BUFFER,
        records: MAX_RECORDS,
        directoryRows: MAX_DIRECTORY_ROWS,
      },
      tracked: trackedSummary(records),
      untracked: untrackedSummary(records),
      interpretation: 'Names and extensions are inventory hints only; origin, disposability, and reproducibility are unverified.',
    };
  } catch (error) {
    return incomplete(observedAt, error && error.message);
  }
}

function render(report) {
  if (report.status !== 'observed') {
    return `[작업본 위생] incomplete (${report.reason}): 읽기 범위를 완전히 집계하지 못했습니다. 변경·삭제는 하지 않았습니다.`;
  }
  const directories = report.untracked.byDirectory.map(row => `${row.directory} ${row.files}`).join(', ') || '없음';
  const kinds = Object.entries(report.untracked.byKind).map(([kind, count]) => `${kind} ${count}`).join(', ') || '없음';
  const privateRuntime = report.untracked.privateRuntimeCandidates;
  return [
    `[작업본 위생 · ${report.observedAt}] 읽기 전용 집계`,
    `추적 변경 ${report.tracked.entries} (스테이징 ${report.tracked.staged}, 작업 폴더 ${report.tracked.worktree}, rename/copy ${report.tracked.renamedOrCopied}, 충돌 ${report.tracked.conflicts})`,
    `미추적 ${report.untracked.entries} | 종류: ${kinds}`,
    `큰 폴더(파일 수, 최대 ${MAX_DIRECTORY_ROWS}개): ${directories}`,
    `private runtime 후보: 폴더 ${privateRuntime.folders}, 파일 ${privateRuntime.files} (경로 비공개; 삭제·재생성 판정 아님)`,
    '이름·확장자는 목록화 단서일 뿐이며 원본/산출물, 폐기 가능성, 재생성 가능성을 확인하지 않습니다.',
  ].join('\n');
}

function help() {
  return [
    '사용: node tools/worktree-hygiene.js [--repo <경로>] [--json] [--help]',
    '',
    'Git 작업본의 추적 변경과 미추적 파일을 읽기 전용으로 집계합니다.',
    '파일명과 private runtime 후보 경로는 출력하지 않으며 파일 내용도 읽지 않습니다.',
    '파일 이동·삭제·자동승인·상주 큐 동작은 없습니다.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = { json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--repo' && argv[i + 1] && !argv[i + 1].startsWith('--') && options.repo === undefined) {
      options.repo = argv[++i];
    } else throw new Error('invalid-arguments');
  }
  if (options.repo !== undefined) options.repo = localRepository(options.repo);
  return options;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch {
    process.stderr.write('사용법 오류. --help로 사용법을 확인하세요.\n');
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    process.stdout.write(help() + '\n');
    return;
  }
  const report = collect({ repo: options.repo || process.cwd() });
  process.stdout.write((options.json ? JSON.stringify(report, null, 2) : render(report)) + '\n');
  if (report.status !== 'observed') process.exitCode = 1;
}

module.exports = { collect, fileKind, parseArgs, parseStatus, privateRuntimeFolder, render };
if (require.main === module) main();
