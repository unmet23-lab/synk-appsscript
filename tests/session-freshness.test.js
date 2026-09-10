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
  assert.throws(() => parseArgs(['--files', 'a.md', 'b.md', 'c.md']));
});

test('manual timeout CLI accepts only one bounded integer and preserves repeated file arguments', () => {
  for (const timeoutMs of [1, 1700, 5000, 30000]) {
    const args = ['--repo', repo, '--files', 'fixture.txt', '--files', POLICY,
      '--timeout-ms', String(timeoutMs), '--json'];
    const options = parseArgs(args);
    assert.equal(options.timeoutMs, timeoutMs);
    assert.deepEqual(options.files, ['fixture.txt', POLICY]);
    const result = cli(args);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, timeoutMs === 1 ? 'unavailable' : 'observed');
    if (timeoutMs !== 1) assert.deepEqual(report.files.map(file => file.comparison), ['same', 'same']);
    assert.ok(!result.stdout.includes(SECRET));
  }
  for (const value of ['', '0', '-1', '1.5', 'NaN', 'Infinity', '1e3', '30001', '99999999999999999999']) {
    assert.throws(() => parseArgs(['--timeout-ms', value]));
  }
  assert.throws(() => parseArgs(['--timeout-ms']));
  assert.throws(() => parseArgs(['--timeout-ms', '100', '--timeout-ms', '200']));
  assert.equal(parseArgs([]).timeoutMs, undefined);
});

test('both automatic CLI modes reject timeout overrides in either argument order without disclosing input', () => {
  for (const hook of ['--hook', '--antigravity-hook']) {
    for (const timeout of ['1', '30000']) {
      for (const args of [[hook, '--timeout-ms', timeout], ['--timeout-ms', timeout, hook]]) {
        assert.throws(() => parseArgs(args));
        const result = cli([...args, '--repo', repo], JSON.stringify({
          cwd: repo, hook_event_name: 'SessionStart', workspacePaths: [repo], invocationNum: 0, prompt: SECRET,
        }));
        assert.equal(result.status, 0);
        assert.equal(result.stderr, '');
        assert.match(result.stdout, /최신 확인 불가/);
        assert.ok(!result.stdout.includes(SECRET));
        assert.ok(!result.stdout.includes('HEAD'));
      }
    }
  }
});

test('only explicit manual collection can finish past 1700ms; all budgets remain capped', async () => {
  // Simulate slow status with real Git for scope, refs and commit consistency.
  function slowRun(budgets) {
    return (command, args, options, callback) => {
      budgets.push(options.timeout);
      if (args.includes('status')) {
        const duration = 1800;
        setTimeout(() => callback(options.timeout < duration ? { killed: true } : null, ''),
          Math.min(duration, options.timeout));
      } else require('node:child_process').execFile(command, args, options, callback);
    };
  }
  const manualBudgets = [];
  const extended = await collect({ cwd: repo, repo, timeoutMs: 5000, manual: true, run: slowRun(manualBudgets) });
  assert.equal(extended.status, 'observed');
  assert.equal(extended.working.current.state, 'observed');
  assert.ok(manualBudgets.some(budget => budget > 1700));
  assert.ok(manualBudgets.every(budget => budget <= 5000));
  const automaticBudgets = [];
  const automatic = await collect({ cwd: repo, repo, timeoutMs: 30000, run: slowRun(automaticBudgets) });
  assert.equal(automatic.status, 'unavailable');
  assert.ok(automaticBudgets.every(budget => budget <= 1700));
  for (const [options, cap] of [[{ manual: true, timeoutMs: 100000 }, 30000],
    [{ manual: true }, 1700], [{ manual: 'true', timeoutMs: 30000 }, 1700]]) {
    const budgets = [];
    await collect({ cwd: repo, repo, ...options, run(command, args, settings, callback) {
      budgets.push(settings.timeout);
      callback(new Error(SECRET), '', SECRET);
    } });
    assert.ok(budgets.length > 0);
    assert.ok(budgets.every(budget => budget > 0 && budget <= cap));
    if (cap === 30000) assert.ok(budgets[0] > 1700);
  }
  const budgets = [];
  await collectAntigravity({ invocationNum: 0, workspacePaths: [repo] }, {
    repo, timeoutMs: 30000, manual: true, run(command, args, options, callback) {
      budgets.push(options.timeout);
      callback(new Error(SECRET), '', SECRET);
    },
  });
  assert.ok(budgets.length > 0);
  assert.ok(budgets.every(budget => budget <= 1700));
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

test('repeated --repo preserves one-repository compatibility and selects only matching repositories', async () => {
  const second = path.join(temporary, 'second-canonical');
  const linked = path.join(temporary, 'second-linked');
  init(second);
  git(second, ['worktree', 'add', '--detach', linked, 'HEAD']);
  assert.deepEqual(parseArgs(['--repo', repo, '--repo', second]).repo, [repo, second]);
  for (const cwd of [repo, second, linked]) {
    const report = await collect({ cwd, repo: [repo, second] });
    assert.equal(report.status, 'observed');
    assert.equal(report.canonicalReference, cwd === repo ? 'configured-repo-1' : 'configured-repo-2');
  }
  assert.equal((await collect({ cwd: foreign, repo: [repo, second] })).status, 'out-of-scope');
  for (const [flag, input] of [
    ['--hook', { cwd: linked, hook_event_name: 'UserPromptSubmit' }],
    ['--antigravity-hook', { workspacePaths: [foreign, linked], invocationNum: 0 }],
  ]) {
    const result = cli([flag, '--repo', repo, '--repo', second], JSON.stringify(input));
    assert.equal(result.status, 0);
    assert.match(result.stdout, /configured-repo-2/);
    assert.ok(!result.stdout.includes(second));
  }
});

test('canonical uncommitted artifacts, equal-count rewrites, new files and deletions change the signal', async () => {
  const canonical = path.join(temporary, 'artifact-canonical');
  const downstream = path.join(temporary, 'artifact-downstream');
  init(canonical);
  file(canonical, POLICY, 'same policy');
  file(canonical, 'docs/product.md', 'version one');
  commit(canonical);
  git(canonical, ['worktree', 'add', '--detach', downstream, 'HEAD']);
  file(canonical, 'docs/product.md', 'version two');
  const first = await collect({ cwd: downstream, repo: canonical });
  assert.equal(first.status, 'observed');
  assert.equal(first.behind, 0);
  assert.equal(first.working.current.trackedDirty, 0);
  assert.equal(first.working.canonical.trackedDirty, 1);
  assert.equal(first.policy.current.sha256, first.policy.canonical.sha256);
  file(canonical, 'docs/product.md', 'version six'); // Same file count and same byte length.
  fs.utimesSync(path.join(canonical, 'docs/product.md'), new Date(), new Date(Date.now() + 2000));
  const second = await collect({ cwd: downstream, repo: canonical });
  assert.equal(second.working.canonical.trackedDirty, 1);
  assert.notEqual(first.working.canonical.fingerprint.sha256, second.working.canonical.fingerprint.sha256);
  file(canonical, 'docs/new-material.md', SECRET);
  const third = await collect({ cwd: downstream, repo: canonical });
  assert.equal(third.working.canonical.untracked, 1);
  assert.notEqual(second.working.canonical.fingerprint.sha256, third.working.canonical.fingerprint.sha256);
  file(canonical, 'docs/new-material.md', 'replacement');
  const rewritten = await collect({ cwd: downstream, repo: canonical });
  assert.equal(rewritten.working.canonical.untracked, 1);
  assert.notEqual(third.working.canonical.fingerprint.sha256, rewritten.working.canonical.fingerprint.sha256);
  fs.unlinkSync(path.join(canonical, 'docs/product.md'));
  const beforeStatus = git(canonical, ['status', '--porcelain=v1', '-z']);
  const deleted = await collect({ cwd: downstream, repo: canonical });
  assert.equal(deleted.working.canonical.trackedDirty, 1);
  assert.notEqual(rewritten.working.canonical.fingerprint.sha256, deleted.working.canonical.fingerprint.sha256);
  assert.equal(git(canonical, ['status', '--porcelain=v1', '-z']), beforeStatus);
  const context = output(deleted, { hookEvent: 'UserPromptSubmit' });
  assert.match(context, /뒤처짐 0이어도 작업물은 다를 수/);
  assert.ok(!context.includes('new-material'));
  assert.ok(!context.includes(SECRET));
  assert.ok(!context.includes('git show'));
});

test('manual explicit files compare current bytes with canonical bytes without outputting paths or contents', async () => {
  const canonical = path.join(temporary, 'compare-canonical');
  const downstream = path.join(temporary, 'compare-downstream');
  init(canonical);
  file(canonical, 'docs/product.md', 'old content');
  commit(canonical);
  git(canonical, ['worktree', 'add', '--detach', downstream, 'HEAD']);
  file(canonical, 'docs/product.md', SECRET);
  file(canonical, 'docs/new.md', 'new content');
  fs.unlinkSync(path.join(canonical, 'fixture.txt'));
  const result = cli(['--repo', canonical, '--files', 'docs/product.md', '--files', 'docs/new.md',
    '--files', 'fixture.txt', '--files', 'docs/absent.md', '--json'], undefined, downstream);
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'observed');
  assert.deepEqual(report.files.map(file => file.comparison), ['different', 'different', 'different', 'both-missing']);
  assert.equal(report.files[0].canonical.sha256, crypto.createHash('sha256').update(SECRET).digest('hex'));
  assert.equal(report.files[1].current.state, 'missing');
  assert.equal(report.files[2].canonical.state, 'missing');
  assert.ok(!result.stdout.includes(SECRET));
  assert.ok(!result.stdout.includes('docs/product.md'));
  const same = await collect({ cwd: canonical, repo: canonical, files: ['docs/product.md'] });
  assert.equal(same.files[0].comparison, 'same');
  const automatic = output(report, { hookEvent: 'UserPromptSubmit' });
  assert.ok(!automatic.includes(report.files[0].canonical.sha256));
  assert.throws(() => parseArgs(['--hook', '--files', 'docs/product.md']));
  assert.throws(() => parseArgs(['--antigravity-hook', '--files', 'docs/product.md']));
});

test('explicit file comparison rejects traversal, secrets, ignored files, directory links and oversized files', async () => {
  const secured = path.join(temporary, 'explicit-files');
  const outside = path.join(temporary, 'outside-files');
  init(secured);
  fs.mkdirSync(outside);
  file(outside, 'external.md', SECRET);
  file(secured, '.env', SECRET);
  file(secured, 'credentials.json', SECRET);
  file(secured, 'docs/ignored.md', SECRET);
  file(secured, '.gitignore', 'docs/ignored.md\n');
  fs.symlinkSync(outside, path.join(secured, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  file(secured, 'docs/large.md', '');
  fs.truncateSync(path.join(secured, 'docs/large.md'), 64 * 1024 * 1024 + 1);
  const files = ['../outside-files/external.md', '.env', 'credentials.json', 'docs/ignored.md',
    'linked/external.md', path.join(outside, 'external.md'), 'fixture.txt:stream', '.git/index', 'docs/large.md'];
  const calls = [];
  const report = await collect({ cwd: secured, repo: secured, files, run(command, args, options, callback) {
    calls.push(args);
    require('node:child_process').execFile(command, args, options, callback);
  } });
  assert.equal(report.status, 'observed');
  assert.deepEqual(report.files.slice(0, -1).map(file => file.current.state), files.slice(0, -1).map(() => 'refused'));
  assert.equal(report.files.at(-1).current.state, 'incomplete');
  assert.equal(calls.some(args => args.includes('check-ignore') && args.at(-1) === 'linked/external.md'), false,
    'unsafe linked paths must be refused before Git is allowed to traverse them');
  assert.equal(calls.some(args => args.includes('check-ignore') && args.at(-1) === 'docs/ignored.md'), true,
    'safe regular paths still need the Git ignore check after the symlink preflight');
  assert.ok(!JSON.stringify(report).includes(SECRET));
  assert.ok(!JSON.stringify(report).includes('external.md'));
  assert.ok(report.files.every(file => !file.current.sha256));
});

test('metadata file-count limit reports incomplete instead of a misleading complete fingerprint', async () => {
  const report = await collect({ cwd: repo, repo, run(command, args, options, callback) {
    if (args.includes('status')) {
      callback(null, Array.from({ length: 2049 }, (_, i) => '?? many/file-' + i + '.md\0').join(''));
    } else require('node:child_process').execFile(command, args, options, callback);
  } });
  assert.equal(report.status, 'observed');
  assert.equal(report.working.current.state, 'incomplete');
  assert.equal(report.working.current.untracked, 2049);
  assert.equal(report.working.current.fingerprint.state, 'incomplete');
  assert.ok(!report.working.current.fingerprint.sha256);
  assert.match(output(report), /incomplete/);
});

test('status above 512 KiB counts thousands of multibyte entries without publishing names or a partial fingerprint', async () => {
  let statusBytes = 0;
  const report = await collect({ cwd: repo, repo, manual: true, timeoutMs: 5000,
    run(command, args, options, callback) {
      if (!args.includes('status')) {
        assert.equal(options.maxBuffer, 512 * 1024, 'only status needs the larger buffer');
        return require('node:child_process').execFile(command, args, options, callback);
      }
      const raw = 'R  moved.md\0before.md\0 M changed.md\0 D deleted.md\0' +
        Array.from({ length: 7000 }, (_, i) => '?? 자료/' + '가'.repeat(32) + '-' + i + '.md\0').join('');
      statusBytes = Buffer.byteLength(raw);
      assert.ok(statusBytes > 512 * 1024);
      assert.ok(options.maxBuffer >= statusBytes && options.maxBuffer <= 16 * 1024 * 1024);
      // Use the actual child-process buffer limit, not a callback returning an unbounded string.
      require('node:child_process').execFile(process.execPath, ['-e',
        "process.stdout.write('R  moved.md\\0before.md\\0 M changed.md\\0 D deleted.md\\0' + " +
        "Array.from({length:7000},(_,i)=>'?? 자료/'+'가'.repeat(32)+'-'+i+'.md\\0').join(''))"], options, callback);
    },
  });
  assert.ok(statusBytes > 0);
  assert.equal(report.status, 'observed');
  for (const snapshot of [report.working.current, report.working.canonical]) {
    assert.equal(snapshot.trackedDirty, 3);
    assert.equal(snapshot.untracked, 7000);
    assert.equal(snapshot.state, 'incomplete');
    assert.equal(snapshot.fingerprint.state, 'incomplete');
    assert.ok(!('sha256' in snapshot.fingerprint));
  }
  for (const formatted of [output(report, { json: true }), output(report, { hookEvent: 'SessionStart' })]) {
    assert.ok(!formatted.includes('moved.md'));
    assert.ok(!formatted.includes('자료/'));
    assert.ok(!formatted.includes(SECRET));
  }
});

test('status exceeding its bounded buffer discards partial counts and fingerprints', async () => {
  let overflow = false;
  const report = await collect({ cwd: repo, repo, manual: true, timeoutMs: 5000,
    run(command, args, options, callback) {
      if (!args.includes('status')) return require('node:child_process').execFile(command, args, options, callback);
      assert.ok(options.maxBuffer <= 16 * 1024 * 1024);
      require('node:child_process').execFile(process.execPath, ['-e',
        "process.stdout.write('?? hidden.md\\0'.repeat(" + (Math.ceil(options.maxBuffer / 13) + 1) + '))'],
      options, (error, stdout, stderr) => {
        overflow = error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
        callback(error, stdout, stderr);
      });
    },
  });
  assert.equal(overflow, true);
  assert.equal(report.status, 'observed');
  assert.equal(report.working.current.trackedDirty, null);
  assert.equal(report.working.current.untracked, null);
  assert.equal(report.working.current.fingerprint.state, 'incomplete');
  assert.ok(!report.working.current.fingerprint.sha256);
  assert.ok(!JSON.stringify(report).includes('hidden.md'));
});

test('external linked-worktree timeout emits only neutral unavailable context and remains bounded', async () => {
  const started = performance.now();
  const report = await collect({ cwd: old, repo, timeoutMs: 1 });
  assert.equal(report.status, 'unavailable');
  assert.equal(report.scopeVerified, false);
  assert.ok(performance.now() - started < 500);
  const context = output(report, { hookEvent: 'SessionStart' });
  assert.match(context, /작업 범위를 확인하지 못했습니다/);
  assert.ok(!context.includes('AI_운영원칙'));
  assert.ok(!context.includes('SYNK'));
  assert.ok(!context.includes(SECRET));
  assert.ok(!context.includes('HEAD'));
});

test('canonical commits on a separate branch are visible even when both worktrees match the master baseline', async () => {
  const canonical = path.join(temporary, 'committed-canonical');
  const downstream = path.join(temporary, 'committed-downstream');
  init(canonical);
  file(canonical, POLICY, 'unchanged policy');
  file(canonical, 'docs/product.md', 'v1');
  commit(canonical);
  git(canonical, ['worktree', 'add', '--detach', downstream, 'HEAD']);
  git(canonical, ['checkout', '-b', 'ongoing-work']);
  file(canonical, 'docs/product.md', 'v2');
  commit(canonical);
  const report = await collect({ cwd: downstream, repo: canonical });
  assert.equal(report.status, 'observed');
  assert.deepEqual([report.ahead, report.behind], [0, 0]);
  assert.equal(report.baseline.source, 'master');
  assert.equal(report.working.current.trackedDirty, 0);
  assert.equal(report.working.canonical.trackedDirty, 0);
  assert.equal(report.policy.current.sha256, report.policy.canonical.sha256);
  assert.notEqual(report.head, report.canonicalHead);
  const context = output(report, { hookEvent: 'UserPromptSubmit' });
  assert.match(context, /정본 작업본과 커밋 다름/);
  assert.match(context, /기준 가지와 별도 근거/);
  assert.ok(context.includes(report.canonicalHead.slice(0, 12)));
});

test('explicit binary deliverables including PNG and PDF above 2 MiB compare by bounded content hashes', async () => {
  const canonical = path.join(temporary, 'media-canonical');
  const downstream = path.join(temporary, 'media-downstream');
  init(canonical);
  const bytes = Buffer.alloc(2 * 1024 * 1024 + 31, 0xa5);
  for (const name of ['asset.png', 'asset.pdf']) file(canonical, name, bytes);
  for (const name of ['asset.docx', 'asset.pptx', 'asset.xlsx', 'asset.wav', 'asset.mp4']) file(canonical, name, Buffer.from([0, 1, 2, 255]));
  commit(canonical);
  git(canonical, ['worktree', 'add', '--detach', downstream, 'HEAD']);
  const names = ['asset.png', 'asset.pdf', 'asset.docx', 'asset.pptx', 'asset.xlsx', 'asset.wav', 'asset.mp4'];
  // This checks seven explicit manual deliverables, not the automatic hook's 1700ms deadline.
  // Parallel CI load may legitimately exhaust that shorter budget partway through the files.
  const same = await collect({ cwd: downstream, repo: canonical, files: names, manual: true, timeoutMs: 10000 });
  assert.equal(same.status, 'observed');
  assert.deepEqual(same.files.map(file => file.comparison), names.map(() => 'same'));
  assert.equal(same.files[0].canonical.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  bytes[100] = 0x5a;
  for (const name of ['asset.png', 'asset.pdf']) file(canonical, name, bytes);
  const changed = await collect({ cwd: downstream, repo: canonical, files: names.slice(0, 2), manual: true, timeoutMs: 10000 });
  assert.deepEqual(changed.files.map(file => file.comparison), ['different', 'different']);
  assert.equal(changed.files[1].canonical.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.ok(!JSON.stringify(changed).includes('asset.png'));
});

test('manual file-comparison deadline returns incomplete without publishing a partial hash', async () => {
  const report = await collect({ cwd: repo, repo, files: ['fixture.txt'], run(command, args, options, callback) {
    if (args.includes('check-ignore')) {
      // Consume the detail budget but leave the final consistency-check reserve available.
      setTimeout(() => callback(null, ''), Math.max(1, options.timeout - 300));
    } else if (args.includes('HEAD^{commit}')) {
      callback(null, baseHead + '\n');
    } else if (args.includes('for-each-ref')) {
      callback(null, 'refs/heads/master ' + baseHead + ' commit\n');
    } else if (args.includes('rev-list')) {
      callback(null, '0\t0\n');
    } else require('node:child_process').execFile(command, args, options, callback);
  } });
  assert.equal(report.status, 'observed');
  assert.equal(report.files[0].comparison, 'unavailable');
  assert.equal(report.files[0].current.state, 'incomplete');
  assert.ok(!report.files[0].current.sha256);
});
