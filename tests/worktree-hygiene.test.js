'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const {
  collect,
  parseArgs,
  parseStatus,
  privateRuntimeFolder,
} = require('../tools/worktree-hygiene.js');

const SCRIPT = path.resolve(__dirname, '../tools/worktree-hygiene.js');
const SECRET = 'DO_NOT_OUTPUT_worktree_fixture_91c7';
let temporary;

function git(cwd, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  return execFileSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function file(root, name, contents = '') {
  const target = path.join(root, ...name.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function init(root) {
  fs.mkdirSync(root, { recursive: true });
  git(root, ['init', '--initial-branch=master']);
  file(root, '수정 대상.txt', 'before\n');
  file(root, '옛 이름.txt', 'rename me\n');
  git(root, ['add', '--all']);
  git(root, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture']);
}

function cli(args, cwd) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
  });
}

beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-worktree-hygiene-'));
});

afterEach(() => {
  const resolved = fs.realpathSync(temporary);
  const parent = fs.realpathSync(os.tmpdir());
  assert.equal(path.dirname(resolved).toLowerCase(), parent.toLowerCase());
  assert.match(path.basename(resolved), /^synk-worktree-hygiene-/);
  fs.rmSync(resolved, { recursive: true, force: true });
});

test('porcelain v1 -z preserves Korean, spaces, and rename source/destination boundaries', () => {
  const records = parseStatus(Buffer.from(
    ' M 한글 파일.js\0R  새 이름.txt\0옛 이름.txt\0?? 공백 그림.png\0',
    'utf8',
  ));
  assert.deepEqual(records, [
    { code: ' M', name: '한글 파일.js' },
    { code: 'R ', name: '새 이름.txt', from: '옛 이름.txt' },
    { code: '??', name: '공백 그림.png' },
  ]);
  assert.throws(() => parseStatus(Buffer.from('R  destination\0')));
  assert.throws(() => parseStatus(Buffer.from('?? unterminated')));
});

test('fixture aggregation is read-only, bounded, and does not output filenames or private paths', () => {
  const repo = path.join(temporary, 'repo');
  init(repo);
  file(repo, '수정 대상.txt', 'after\n');
  git(repo, ['mv', '옛 이름.txt', '한글 새 이름.txt']);
  file(repo, 'docs/자료/하나.json', '{}');
  file(repo, 'docs/자료/둘.webp', 'image');
  file(repo, 'src/space name.js', 'source');
  file(repo, `tmp/${SECRET}-browser-profile/Cache/private-name.txt`, SECRET);

  const before = git(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const report = collect({ repo });
  const after = git(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const serialized = JSON.stringify(report);

  assert.equal(report.status, 'observed');
  assert.equal(report.readOnly, true);
  assert.equal(report.tracked.entries, 2);
  assert.equal(report.tracked.renamedOrCopied, 1);
  assert.equal(report.untracked.entries, 4);
  assert.equal(report.untracked.byKind.data, 1);
  assert.equal(report.untracked.byKind.image, 1);
  assert.equal(report.untracked.byKind.source, 1);
  assert.equal(report.untracked.privateRuntimeCandidates.folders, 1);
  assert.equal(report.untracked.privateRuntimeCandidates.files, 1);
  assert.equal(report.untracked.privateRuntimeCandidates.pathsRedacted, true);
  assert.equal(before, after);
  assert.ok(!serialized.includes(SECRET));
  assert.ok(!serialized.includes('private-name'));
  assert.ok(!serialized.includes('한글 새 이름'));
  assert.ok(!serialized.includes('수정 대상'));
});

test('private runtime detection requires a folder context and remains only a candidate', () => {
  assert.equal(privateRuntimeFolder('tmp/browser-profile/Cache/file.bin'), 'tmp/browser-profile');
  assert.equal(privateRuntimeFolder('assets/browser-icon.png'), null);
  assert.equal(privateRuntimeFolder('browser-profile.json'), null);
});

test('configured clean and process filters are neutralized while status detects tracked changes', () => {
  for (const filterType of ['clean', 'process']) {
    const repo = path.join(temporary, 'filter-' + filterType);
    init(repo);
    file(repo, 'fixture.txt', 'initial\n');
    file(repo, '.gitattributes', 'fixture.txt filter=sideeffect\n');
    git(repo, ['add', '.gitattributes', 'fixture.txt']);
    git(repo, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid',
      '-c', 'commit.gpgsign=false', 'commit', '-m', 'attributes']);

    const script = path.join(repo, 'sideeffect.js');
    const marker = path.join(repo, 'FILTER_RAN');
    file(repo, 'sideeffect.js',
      "require('node:fs').appendFileSync(require('node:path').join(__dirname,'FILTER_RAN'),'x'); process.stdin.pipe(process.stdout);\n");
    const command = '"' + process.execPath.replace(/\\/g, '/') + '" "' + script.replace(/\\/g, '/') + '"';
    git(repo, ['config', 'filter.sideeffect.' + filterType, command]);
    git(repo, ['config', 'filter.sideeffect.required', 'true']);
    file(repo, 'fixture.txt', 'changed\n');
    fs.utimesSync(path.join(repo, 'fixture.txt'), new Date(), new Date(Date.now() + 2000));

    const report = collect({ repo });
    assert.equal(report.status, 'observed');
    assert.equal(report.tracked.entries, 1);
    assert.equal(fs.existsSync(marker), false, 'observer invoked an external ' + filterType + ' filter');

    // hash-object --path is a read-only control that must apply this path's filter.
    try { git(repo, ['hash-object', '--path', 'fixture.txt', 'fixture.txt']); } catch { /* malformed process handshake is expected */ }
    assert.equal(fs.existsSync(marker), true, 'fixture did not arm the external ' + filterType + ' filter');
  }
});

test('read, timeout, capacity, and malformed output failures are incomplete without partial counts', () => {
  const failures = [
    { error: Object.assign(new Error('secret ' + SECRET), { code: 'ETIMEDOUT' }), status: null },
    { error: Object.assign(new Error('secret ' + SECRET), { code: 'ENOBUFS' }), status: null },
    { error: Object.assign(new Error('secret ' + SECRET), { code: 'EACCES' }), status: null },
  ];
  for (const result of failures) {
    const report = collect({ repo: temporary, run: () => ({ ...result, stdout: Buffer.alloc(0), stderr: Buffer.from(SECRET) }) });
    assert.equal(report.status, 'incomplete');
    assert.equal(report.tracked, null);
    assert.equal(report.untracked, null);
    assert.ok(!JSON.stringify(report).includes(SECRET));
  }

  let calls = 0;
  const malformed = collect({ repo: temporary, run: () => {
    calls++;
    return calls === 1
      ? { status: 1, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }
      : { status: 0, stdout: Buffer.from('?? missing-nul'), stderr: Buffer.alloc(0) };
  } });
  assert.equal(malformed.status, 'incomplete');
  assert.equal(malformed.reason, 'invalid-output');
});

test('--repo JSON and --help work in an independent fixture', () => {
  const repo = path.join(temporary, 'CLI fixture with spaces');
  init(repo);
  file(repo, 'docs/new file.md', SECRET);

  const json = cli(['--repo', repo, '--json'], temporary);
  assert.equal(json.status, 0);
  const report = JSON.parse(json.stdout);
  assert.equal(report.status, 'observed');
  assert.equal(report.untracked.entries, 1);
  assert.ok(!json.stdout.includes(SECRET));
  assert.ok(!json.stdout.includes(repo));
  assert.ok(!json.stdout.includes('new file.md'));

  const help = cli(['--help'], temporary);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--repo/);
  assert.match(help.stdout, /--json/);
  assert.deepEqual(parseArgs(['--repo', repo, '--json']), { json: true, help: false, repo: path.resolve(repo) });

  const invalid = cli(['--unknown-' + SECRET], temporary);
  assert.equal(invalid.status, 2);
  assert.ok(!invalid.stderr.includes(SECRET));
});
