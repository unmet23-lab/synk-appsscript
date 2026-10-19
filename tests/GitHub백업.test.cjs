'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { inspectRepository, remoteIdentity, codeContentReason, acquireLock, requestArchiveTransfer, onlyArchiveTransferPending, deferNewSinceApply,
  scanAndArchive, bundleRefMoved, PREFIX } = require('../tools/GitHub백업.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'github-backup-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, 'source'), remote = path.join(root, 'remote.git');
  const raw = (args, cwd, input) => execFileSync('git', args, { cwd, input, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  raw(['init', '--bare', remote]); raw(['init', '-b', 'special-default', repo]);
  const g = (args, input) => raw(['-c', 'core.quotepath=false', ...args], repo, input);
  g(['config', 'user.name', 'Synthetic backup test']); g(['config', 'user.email', 'test@example.invalid']);
  g(['remote', 'add', 'origin', remote]);
  function commit(file, content) {
    fs.writeFileSync(path.join(repo, file), content); g(['add', '--', file]); g(['commit', '-m', 'synthetic fixture']);
    return g(['rev-parse', 'HEAD']).toString().trim();
  }
  const base = commit('README.md', '# base\n'); g(['push', 'origin', 'special-default']);
  const calls = [];
  const git = (args, input) => {
    calls.push(args);
    if (args[0] === 'remote' && args[1] === 'get-url') return Buffer.from('https://github.com/unmet23-lab/fixture.git\n');
    return g(args, input);
  };
  const info = { private: true, default_branch: 'special-default', full_name: 'unmet23-lab/fixture' };
  return { repo, remote, g, git, calls, base, commit, info };
}
test('private history is pinned and remotely verified without altering HEAD, index, or the default branch', t => {
  const f = fixture(t), sha = f.commit('source.js', 'module.exports = 7;\n');
  fs.writeFileSync(path.join(f.repo, 'README.md'), '# concurrent unsaved working state\n');
  const index = fs.readFileSync(path.join(f.repo, '.git', 'index'));
  const result = inspectRepository(f.repo, { apply: true, git: f.git, github: f.info });
  assert.equal(result.status, 'success');
  assert.equal(result.refs[0].status, 'remote-verified');
  assert.match(f.g(['ls-remote', '--refs', 'origin', PREFIX + sha]).toString(), new RegExp('^' + sha));
  assert.match(f.g(['ls-remote', '--refs', 'origin', 'refs/heads/special-default']).toString(), new RegExp('^' + f.base));
  assert.equal(f.g(['rev-parse', 'HEAD']).toString().trim(), sha);
  assert.deepEqual(fs.readFileSync(path.join(f.repo, '.git', 'index')), index);
  assert.equal(fs.readFileSync(path.join(f.repo, 'README.md'), 'utf8'), '# concurrent unsaved working state\n');
  assert.equal(f.calls.some(args => args.includes('--force') || args[0] === 'commit' || args[0] === 'checkout'), false);
  const again = inspectRepository(f.repo, { apply: true, git: f.git, github: f.info });
  assert.equal(again.refs.length, 0);
});
test('a media blob added and removed in unpublished history still blocks the entire immutable ref', t => {
  const f = fixture(t); f.commit('movie.mp4', 'synthetic video fixture');
  f.g(['rm', 'movie.mp4']); f.g(['commit', '-m', 'remove synthetic media']);
  const result = inspectRepository(f.repo, { apply: true, git: f.git, github: f.info });
  assert.equal(result.status, 'attention');
  assert.equal(result.refs[0].check.violations[0].code, 'excluded-binary');
  assert.equal(f.calls.some(args => args[0] === 'push'), false);
});
test('secret-bearing text fails closed and never copies its bytes into diagnostic output', t => {
  const f = fixture(t), secret = 'synthetic-private-value';
  f.commit('config.json', JSON.stringify({ password: secret }));
  const result = inspectRepository(f.repo, { apply: true, git: f.git, github: f.info });
  assert.equal(result.refs[0].check.violations[0].code, 'secret-literal');
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(f.calls.some(args => args[0] === 'push'), false);
});
test('public origins report unpublished history and remain read-only', t => {
  const f = fixture(t); f.commit('private-draft.md', '# not published\n');
  const result = inspectRepository(f.repo, { apply: true, git: f.git, github: { ...f.info, private: false } });
  assert.equal(result.refs[0].status, 'public-origin-unpublished');
  assert.equal(f.calls.some(args => args[0] === 'push'), false);
});
test('origin allowlist rejects credential URLs, another owner, and ambiguous hostnames', () => {
  assert.equal(remoteIdentity('git@github.com:unmet23-lab/source.git'), 'unmet23-lab/source');
  for (const value of ['https://user:secret@github.com/unmet23-lab/source.git', 'https://github.com.evil/unmet23-lab/source',
    'https://github.com/another/source.git']) assert.equal(remoteIdentity(value), null);
});
test('blank env templates and source maps are allowed but a later real value is blocked', () => {
  assert.equal(codeContentReason('.env.example', Buffer.from('# template\nAPI_KEY=\nENABLED=false\n')), null);
  assert.equal(codeContentReason('.env.example', Buffer.from('API_KEY=synthetic-private-value\n')), 'credential-path');
  assert.equal(codeContentReason('.env.example', Buffer.from('# ' + 'ghp_' + 'X'.repeat(30) + '\nAPI_KEY=\n')), 'secret-signature');
  assert.equal(codeContentReason('supabase/functions/auth/동봉.json', Buffer.from('{"auth.mjs":"lib/auth.js"}')), null);
  assert.equal(codeContentReason('supabase/functions/auth/동봉.json', Buffer.from('{"password":"synthetic-private-value"}')), 'credential-path');
});
test('source images require their actual binary signature and do not bypass the secret file guard', () => {
  assert.equal(codeContentReason('assets/logo.png', Buffer.from('89504e470d0a1a0a00000000', 'hex')), null);
  assert.equal(codeContentReason('assets/logo.png', Buffer.from([255, 0, 1])), 'unrecognized-binary');
  assert.equal(codeContentReason('assets/logo.png', Buffer.from('synthetic private text')), 'unrecognized-binary');
  assert.equal(codeContentReason('secrets/logo.png', Buffer.from('89504e470d0a1a0a', 'hex')), 'credential-path');
  assert.equal(codeContentReason('assets/logo.png', Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'),
    Buffer.from('ghp_' + 'X'.repeat(30))])), 'secret-signature');
});
test('a live owner lock prevents a concurrent backup and release removes only its own lock', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-backup-lock-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'run.lock'), release = acquireLock(file);
  assert.equal(typeof release, 'function');
  assert.equal(acquireLock(file), null);
  release();
  assert.equal(fs.existsSync(file), false);
});
test('only apply with existing unverified ciphertext requests the durable transfer task', () => {
  const calls = [];
  const invoke = mode => { calls.push(mode); return { status: 'running', active: true, enabled: true }; };
  const report = { repositories: [], protectedSources: { files: [{ relativePath: 'protected/file.source.enc', status: 'awaiting-drive-verification' }] } };
  assert.equal(requestArchiveTransfer(report, { apply: false, invoke }).status, 'running');
  assert.deepEqual(calls, [{ apply: false }]);
  assert.equal(requestArchiveTransfer(report, { apply: true, invoke }).status, 'running');
  assert.deepEqual(calls, [{ apply: false }, { apply: true }]);
  assert.equal(requestArchiveTransfer({ repositories: [] }, { apply: true, invoke }).status, 'not-needed');
  assert.equal(calls.length, 2);
  assert.equal(requestArchiveTransfer(report, { apply: true, invoke: () => ({ status: 'failed', code: 'GIT_ARCHIVE_TRANSFER_TASK_MISSING' }) }).code,
    'GIT_ARCHIVE_TRANSFER_TASK_MISSING');
});
test('a check run defers only commits first seen after the last apply and keeps earlier gaps strict', () => {
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(x => x.repeat(40));
  const report = () => ({ repositories: [
    { name: 'source', status: 'attention', refs: [{ sha: a, status: 'blocked-by-content-policy' }, { sha: b, status: 'ready' },
      { sha: c, status: 'encrypted-drive-verified' }] },
    { name: 'other', status: 'failed', code: 'GIT_COMMAND_FAILED' }] });
  const strict = report();
  assert.equal(deferNewSinceApply(strict, { heads: { source: [a] } }), 1);
  assert.deepEqual(strict.repositories[0].refs.map(row => row.status), ['blocked-by-content-policy', 'awaiting-next-apply', 'encrypted-drive-verified']);
  assert.equal(strict.repositories[0].status, 'attention');
  assert.equal(strict.repositories[1].status, 'failed');
  const fresh = report();
  assert.equal(deferNewSinceApply(fresh, { heads: { source: [c, d] } }), 2);
  assert.equal(fresh.repositories[0].status, 'success');
  const untouched = report();
  assert.equal(deferNewSinceApply(untouched, null), 0);
  assert.equal(untouched.repositories[0].refs[1].status, 'ready');
});
test('only a confirmed active transfer turns pure verification waiting into pending', () => {
  const report = { repositories: [{ status: 'attention' }], archiveTransfer: { status: 'running', active: true, enabled: true },
    issues: [{ code: 'GIT_ARCHIVE_AWAITING_DRIVE' }, { code: 'GIT_ARCHIVE_DRIVE_VERIFICATION_NOT_CURRENT' }] };
  assert.equal(onlyArchiveTransferPending(report), true);
  for (const code of ['GIT_ARCHIVE_DRIVE_FILE_MISMATCH', 'GIT_ARCHIVE_DRIVE_EVIDENCE_INVALID', 'PROTECTED_SOURCE_CHANGED_DURING_CHECK',
    'GIT_ARCHIVE_NOT_CREATED', 'GIT_ARCHIVE_TRANSFER_OVERDUE', 'GIT_ARCHIVE_TRANSFER_TASK_DISABLED'])
    assert.equal(onlyArchiveTransferPending({ ...report, issues: [...report.issues, { code }] }), false);
  assert.equal(onlyArchiveTransferPending({ ...report, archiveTransfer: { status: 'running' } }), false);
  assert.equal(onlyArchiveTransferPending({ ...report, archiveTransfer: { status: 'failed', active: true, enabled: true } }), false);
  assert.equal(onlyArchiveTransferPending({ ...report, issues: [] }), false);
  assert.equal(onlyArchiveTransferPending({ ...report, repositories: [] }), false);
  assert.equal(onlyArchiveTransferPending({ ...report, repositories: [{ status: 'failed' }] }), false);
});
test('an apply run rescans and bundles again when a branch moves between scanning and bundling, at most three times (10-19)', async () => {
  const run = async moved => {
    const calls = [];
    const attempts = await scanAndArchive({ scan: () => calls.push('scan'), archive: async () => calls.push('archive'), refMoved: () => moved.shift() });
    return { attempts, calls };
  };
  assert.deepEqual(await run([false]), { attempts: 1, calls: ['scan', 'archive'] });
  assert.deepEqual(await run([true, false]), { attempts: 2, calls: ['scan', 'archive', 'scan', 'archive'] });
  assert.equal((await run([true, true, true, true])).attempts, 3, 'a branch that keeps moving stops after three tries');
});
test('only this process\'s own failed bundle with a moved source ref asks for a rescan (10-19)', t => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-moved-'));
  t.after(() => fs.rmSync(vault, { recursive: true, force: true }));
  const write = status => fs.writeFileSync(path.join(vault, 'git-bundle-status.json'), JSON.stringify(status));
  assert.equal(bundleRefMoved(vault), false, 'no bundle receipt');
  write({ pid: process.pid, status: 'failed', detailCode: 'BUNDLE_SOURCE_REF_MOVED' });
  assert.equal(bundleRefMoved(vault), true);
  assert.equal(bundleRefMoved(vault, process.pid + 1), false, 'another process wrote the receipt');
  write({ pid: process.pid, status: 'failed', detailCode: 'BUNDLE_ORIGIN_MISMATCH' });
  assert.equal(bundleRefMoved(vault), false, 'other bundle failures stay failures');
  write({ pid: process.pid, status: 'success', bundles: [] });
  assert.equal(bundleRefMoved(vault), false);
});
