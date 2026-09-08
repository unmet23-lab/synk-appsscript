'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { collect, collectAntigravity, output, trackedCount, parseArgs } = require('../tools/session-freshness.js');

const SCRIPT = path.resolve(__dirname, '../tools/session-freshness.js');
const SECRET = 'DO_NOT_OUTPUT_fixture_secret_7f24';
const POLICY = 'docs/AI_운영원칙.md';
let temporary, repo, old, ahead, diverged, foreign, blank, baseHead;

function git(cwd, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  return execFileSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], {
    cwd, env, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000,
  });
}

function file(root, name, contents) {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function commit(root) {
  git(root, ['add', '--all']);
  git(root, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-m', SECRET]);
}

function init(root, branch = 'master') {
  fs.mkdirSync(root, { recursive: true });
  git(root, ['init', '--initial-branch=' + branch]);
  file(root, 'fixture.txt', 'initial\n');
  commit(root);
}

function cli(args = [], input, cwd = repo) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd, input, encoding: 'utf8', windowsHide: true, timeout: 5000,
    env: { ...process.env, SYNK_TEST_SECRET: SECRET },
  });
}

before(() => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-session-freshness-'));
  repo = path.join(temporary, 'canonical & $(never-run) ' + SECRET);
  old = path.join(temporary, 'old-worktree');
  ahead = path.join(temporary, 'ahead-worktree');
  diverged = path.join(temporary, 'diverged-worktree');
  foreign = path.join(temporary, 'foreign');
  blank = path.join(temporary, 'not-a-repository');
  fs.mkdirSync(blank);
  init(repo);
  git(repo, ['worktree', 'add', '--detach', old, 'HEAD']);
  file(repo, POLICY, 'fixture policy ' + SECRET + '\n');
  file(repo, 'fixture.txt', 'second\n');
  commit(repo);
  baseHead = git(repo, ['rev-parse', 'HEAD']).trim();
  git(repo, ['worktree', 'add', '-b', 'ahead-' + SECRET, ahead, 'HEAD']);
  file(ahead, 'fixture.txt', 'ahead\n');
  commit(ahead);
  git(repo, ['worktree', 'add', '-b', 'diverged-' + SECRET, diverged, 'HEAD~1']);
  file(diverged, 'fixture.txt', 'different change\n');
  commit(diverged);
  init(foreign);
});

after(() => {
  // Only the exact mkdtemp fixture is removed; never a repository/workspace root.
  const resolved = fs.realpathSync(temporary);
  const temporaryParent = fs.realpathSync(os.tmpdir());
  assert.equal(path.dirname(resolved).toLowerCase(), temporaryParent.toLowerCase());
  assert.match(path.basename(resolved), /^synk-session-freshness-/);
  fs.rmSync(resolved, { recursive: true, force: true });
});

test('current checkout: local master snapshot, policy fingerprint, no write', async () => {
  const index = path.join(repo, '.git/index');
  const beforeIndex = crypto.createHash('sha256').update(fs.readFileSync(index)).digest('hex');
  const beforeStatus = git(repo, ['status', '--porcelain=v1', '-z']);
  const report = await collect({ cwd: repo, repo });
  assert.equal(report.status, 'observed');
  assert.equal(report.head, baseHead);
  assert.equal(report.baseline.source, 'master');
  assert.equal(report.ahead, 0);
  assert.equal(report.behind, 0);
  assert.equal(report.trackedDirty, 0);
  assert.equal(report.policy.current.state, 'present');
  assert.equal(report.policy.current.sha256, report.policy.canonical.sha256);
  assert.equal(git(repo, ['status', '--porcelain=v1', '-z']), beforeStatus);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(index)).digest('hex'), beforeIndex);
});

test('old detached worktree sees canonical commits and missing current instructions', async () => {
  const report = await collect({ cwd: old, repo });
  assert.equal(report.status, 'observed');
  assert.equal(report.behind, 1);
  assert.equal(report.ahead, 0);
  assert.equal(report.policy.current.state, 'missing');
  assert.equal(report.policy.canonical.state, 'present');
});

test('ahead and diverged worktrees retain their independent commits', async () => {
  const forward = await collect({ cwd: ahead, repo });
  const split = await collect({ cwd: diverged, repo });
  assert.equal(forward.status, 'observed');
  assert.deepEqual([forward.ahead, forward.behind], [1, 0]);
  assert.equal(split.status, 'observed');
  assert.deepEqual([split.ahead, split.behind], [1, 1]);
});

test('tracked dirty count excludes untracked names and preserves all changes', async () => {
  file(ahead, 'fixture.txt', 'dirty ' + SECRET);
  file(ahead, SECRET + '.untracked', SECRET);
  const beforeStatus = git(ahead, ['status', '--porcelain=v1', '-z']);
  const report = await collect({ cwd: ahead, repo });
  assert.equal(report.status, 'observed');
  assert.equal(report.trackedDirty, 1);
  assert.equal(git(ahead, ['status', '--porcelain=v1', '-z']), beforeStatus);
  assert.equal(fs.readFileSync(path.join(ahead, 'fixture.txt'), 'utf8'), 'dirty ' + SECRET);
});

test('foreign Git common dir emits nothing in manual and hook modes', async () => {
  const report = await collect({ cwd: foreign, repo });
  assert.equal(report.status, 'out-of-scope');
  assert.equal(output(report, { json: true }), '');
  const result = cli(['--hook', '--repo', repo], JSON.stringify({ cwd: foreign, hook_event_name: 'SessionStart' }));
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('global scoped hooks stay silent in unrelated non-Git directories', async () => {
  assert.equal((await collect({ cwd: blank, repo })).status, 'out-of-scope');
  for (const [flag, input] of [
    ['--hook', { cwd: blank, hook_event_name: 'SessionStart' }],
    ['--antigravity-hook', { workspacePaths: [blank], invocationNum: 0 }],
  ]) {
    const result = cli([flag, '--repo', repo], JSON.stringify(input));
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  }
});

for (const hookEvent of ['SessionStart', 'UserPromptSubmit']) {
  test(hookEvent + ': additionalContext only; no prompt, path, contents, branch or subject leaks', () => {
    const result = cli(['--hook', '--repo', repo], JSON.stringify({
      cwd: ahead, hook_event_name: hookEvent, prompt: SECRET,
      transcript_path: path.join(temporary, SECRET), session_id: SECRET,
      environment: { SECRET },
    }));
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    const payload = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(payload), ['hookSpecificOutput']);
    assert.deepEqual(Object.keys(payload.hookSpecificOutput), ['hookEventName', 'additionalContext']);
    assert.equal(payload.hookSpecificOutput.hookEventName, hookEvent);
    assert.match(payload.hookSpecificOutput.additionalContext, /최신 상태 관찰/);
    assert.ok(!result.stdout.includes(SECRET));
    assert.ok(!result.stdout.includes(temporary));
    assert.ok(!result.stdout.includes('continue'));
    assert.ok(!result.stdout.includes('permissionDecision'));
  });
}

test('manual JSON is safe metadata only and manual text is short', () => {
  const json = cli(['--repo', repo, '--json']);
  const plain = cli(['--repo', repo]);
  assert.equal(json.status, 0);
  assert.equal(JSON.parse(json.stdout).status, 'observed');
  assert.equal(plain.status, 0);
  assert.ok(plain.stdout.length < 1000);
  assert.ok(!json.stdout.includes(SECRET));
  assert.ok(!plain.stdout.includes(SECRET));
});

test('invalid stdin, unavailable cwd and invalid options do not block or disclose errors', () => {
  for (const [args, input] of [
    [['--hook', '--repo', repo], '{' + SECRET],
    [['--hook', '--repo', repo], JSON.stringify({ hook_event_name: 'SessionStart', cwd: SECRET })],
    [['--hook', '--repo', repo], 'x'.repeat(300000)],
    [['--invalid-' + SECRET], undefined],
  ]) {
    const result = cli(args, input);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /최신 확인 불가/);
    assert.equal(result.stderr, '');
    assert.ok(!result.stdout.includes(SECRET));
  }
});

test('non-Git directories and tiny deadlines return unavailable without throwing', async () => {
  assert.equal((await collect({ cwd: blank })).status, 'unavailable');
  const started = performance.now();
  const result = await collect({ cwd: repo, repo, timeoutMs: 1 });
  assert.equal(result.status, 'unavailable');
  assert.ok(performance.now() - started < 500);
});

test('inherited Git redirection is removed; commands use arrays and optional locks are off', async () => {
  const saved = process.env.GIT_DIR;
  process.env.GIT_DIR = path.join(foreign, '.git');
  const calls = [];
  try {
    const report = await collect({ cwd: repo, repo, run(command, args, options, callback) {
      calls.push({ command, args, options });
      require('node:child_process').execFile(command, args, options, callback);
    } });
    assert.equal(report.status, 'observed');
    assert.equal(report.head, baseHead);
    assert.ok(calls.length > 0);
    for (const call of calls) {
      assert.equal(call.command, 'git');
      assert.ok(Array.isArray(call.args));
      assert.ok(call.args.includes('--no-optional-locks'));
      assert.ok(call.args.includes('core.fsmonitor=false'));
      assert.equal(call.options.shell, false);
      const configCount = Number(call.options.env.GIT_CONFIG_COUNT || 0);
      for (let i = 0; i < configCount; i++) {
        assert.equal(call.options.env['GIT_CONFIG_KEY_' + i], 'safe.directory');
      }
      assert.ok(!('GIT_DIR' in call.options.env));
      assert.equal(call.options.env.GIT_NO_LAZY_FETCH, '1');
      assert.equal(call.options.env.GIT_TERMINAL_PROMPT, '0');
      assert.ok(!call.args.some(arg => /^(fetch|pull|merge|reset|checkout|add|commit|push)$/.test(arg)));
    }
  } finally {
    if (saved === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = saved;
  }
});

test('rename counting and CLI argument parsing are bounded and exact', () => {
  assert.equal(trackedCount('R  new\0old\0 M other\0'), 2);
  assert.deepEqual(parseArgs(['--repo', repo, '--json']), { hook: false, json: true, repo });
  assert.throws(() => parseArgs(['--repo']));
});

test('origin/HEAD fallback uses only local refs; main fallback works without remote refs', async () => {
  const fallback = path.join(temporary, 'fallback');
  init(fallback, 'main');
  const calls = [];
  const run = (command, args, options, callback) => {
    calls.push(args);
    require('node:child_process').execFile(command, args, options, callback);
  };
  const main = await collect({ cwd: fallback, run });
  assert.equal(main.status, 'observed');
  assert.equal(main.baseline.source, 'main');
  assert.equal(calls.filter(args => args.includes('for-each-ref')).length, 2);
  assert.ok(!calls.some(args => args.includes('rev-parse') && args.some(arg => arg.startsWith('refs/'))));
  calls.length = 0;
  git(fallback, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  git(fallback, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
  const remote = await collect({ cwd: fallback, run });
  assert.equal(remote.status, 'observed');
  assert.equal(remote.baseline.source, 'origin/HEAD');
  assert.equal(calls.filter(args => args.includes('for-each-ref')).length, 2);
  assert.ok(!calls.some(args => args.includes('rev-parse') && args.some(arg => arg.startsWith('refs/'))));
});

test('default-ref batching does not treat similarly prefixed branches as a baseline', async () => {
  const prefixed = path.join(temporary, 'prefixed-default');
  init(prefixed, 'development');
  git(prefixed, ['branch', 'master/not-default']);
  git(prefixed, ['branch', 'main/not-default']);
  assert.equal((await collect({ cwd: prefixed })).status, 'unavailable');
});

test('default-ref batching does not accept a non-commit object as the baseline', async () => {
  const report = await collect({ cwd: repo, run(command, args, options, callback) {
    if (args.includes('for-each-ref')) {
      callback(null, 'refs/heads/master ' + baseHead + ' tree\n');
    } else {
      require('node:child_process').execFile(command, args, options, callback);
    }
  } });
  assert.equal(report.status, 'unavailable');
});

test('Antigravity first invocation finds the first matching workspace and injects ephemeral metadata only', () => {
  const result = cli(['--antigravity-hook', '--repo', repo], JSON.stringify({
    workspacePaths: [foreign, old], invocationNum: 0, transcriptPath: SECRET,
    conversationId: SECRET, artifactDirectoryPath: SECRET, modelName: SECRET,
  }));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(payload), ['injectSteps']);
  assert.equal(payload.injectSteps.length, 1);
  assert.deepEqual(Object.keys(payload.injectSteps[0]), ['ephemeralMessage']);
  assert.match(payload.injectSteps[0].ephemeralMessage, /뒤처짐 1/);
  assert.ok(!result.stdout.includes(SECRET));
  assert.ok(!result.stdout.includes('userMessage'));
});

test('Antigravity later invocations, empty workspaces and unrelated repositories are silent', async () => {
  let calls = 0;
  const later = await collectAntigravity({ invocationNum: 1, workspacePaths: [repo] }, {
    repo, run() { calls++; throw new Error('must not run'); },
  });
  assert.equal(later.status, 'out-of-scope');
  assert.equal(calls, 0);
  for (const input of [
    { invocationNum: 1, workspacePaths: [repo] },
    { invocationNum: 0, workspacePaths: [] },
    { invocationNum: 0, workspacePaths: [foreign] },
  ]) {
    const result = cli(['--antigravity-hook', '--repo', repo], JSON.stringify(input));
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  }
});

test('Antigravity malformed input is non-blocking JSON and ignores secret fields', () => {
  const result = cli(['--antigravity-hook', '--repo', repo], '{' + SECRET);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  const payload = JSON.parse(result.stdout);
  assert.match(payload.injectSteps[0].ephemeralMessage, /최신 확인 불가/);
  assert.ok(!result.stdout.includes(SECRET));
});

for (const filterType of ['clean', 'process']) {
  test('git status does not execute configured ' + filterType + ' filters', async () => {
    const filtered = path.join(temporary, 'filter-' + filterType);
    init(filtered);
    file(filtered, '.gitattributes', 'fixture.txt filter=sideeffect\n');
    commit(filtered);
    const script = path.join(filtered, 'sideeffect.js');
    const marker = path.join(filtered, 'FILTER_RAN');
    file(filtered, 'sideeffect.js', "require('node:fs').appendFileSync(require('node:path').join(__dirname,'FILTER_RAN'),'x'); process.stdin.pipe(process.stdout);\n");
    const command = '"' + process.execPath.replace(/\\/g, '/') + '" "' + script.replace(/\\/g, '/') + '"';
    git(filtered, ['config', 'filter.sideeffect.' + filterType, command]);
    git(filtered, ['config', 'filter.sideeffect.required', 'true']);
    // Same byte length forces status to hash instead of short-circuiting on file size.
    file(filtered, 'fixture.txt', 'changed\n');
    fs.utimesSync(path.join(filtered, 'fixture.txt'), new Date(), new Date(Date.now() + 2000));
    const report = await collect({ cwd: filtered });
    assert.equal(report.status, 'observed');
    assert.equal(report.trackedDirty, 1);
    assert.equal(fs.existsSync(marker), false, 'read-only observer invoked an external filter');
    // Control: the fixture really is armed; ordinary status invokes this temporary marker script.
    try { git(filtered, ['status', '--porcelain=v1', '-z', '--untracked-files=no']); } catch { /* invalid process handshake is expected */ }
    assert.equal(fs.existsSync(marker), true, 'fixture did not exercise Git filter behavior');
  });
}
