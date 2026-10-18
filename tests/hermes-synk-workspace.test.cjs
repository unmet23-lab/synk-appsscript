'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { prepareWorkspace, inspectSource, safeSource } = require('../tools/hermes-synk/workspace.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-workspace-test-'));
  const repo = path.join(root, 'source'), tasks = path.join(root, 'tasks');
  fs.mkdirSync(repo); fs.mkdirSync(tasks);
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 }).trim();
  const write = (name, content) => { const target = path.join(repo, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); };
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Workspace fixture'); git('config', 'user.email', 'fixture@localhost');
  git('config', 'core.autocrlf', 'false');
  git('config', 'extensions.worktreeConfig', 'true');
  write('AGENTS.md', 'Read current source. Do not merge automatically.\n');
  write('CLAUDE.md', '@AGENTS.md\n');
  write('package.json', JSON.stringify({ scripts: { 'check:storage': 'node tools/git-storage-check.cjs --cached' } }));
  write('.gitignore', '.env\nnode_modules/\n');
  write('.gitattributes', '*.js text eol=lf\n');
  write('src/current.js', 'const value = "head";\n');
  write('src/deleted.js', 'const removed = true;\n');
  write('other/untouched.js', 'const untouched = true;\n');
  write('photo.png', Buffer.from([1, 2, 0, 3]));
  for (const name of ['git-storage-check.cjs', 'git-storage-policy.json']) {
    write('tools/' + name, fs.readFileSync(path.join(__dirname, '../tools', name)));
  }
  git('add', '.'); git('commit', '-qm', 'fixture baseline');
  const taskId = 'synk-' + crypto.randomBytes(6).toString('hex');
  const taskDir = path.join(tasks, taskId);
  const options = { repo, taskDir, taskId, scope: ['src'], allowedRoots: [repo] };
  t.after(() => {
    const absolute = fs.realpathSync(root), temporary = fs.realpathSync(os.tmpdir());
    assert.ok(absolute.startsWith(temporary + path.sep));
    assert.ok(path.basename(absolute).startsWith('synk-workspace-test-'));
    fs.rmSync(absolute, { recursive: true, force: true });
  });
  return { root, repo, tasks, taskDir, taskId, options, git, write };
}
function indexHash(repo) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, '.git/index'))).digest('hex'); }

test('isolates dirty tracked content, deletion and safe untracked without source/index/branch mutation', async t => {
  const f = fixture(t);
  f.write('src/current.js', 'const value = "current uncommitted";\n');
  fs.unlinkSync(path.join(f.repo, 'src/deleted.js'));
  f.write('src/new.ts', 'export const added = true;\n');
  f.write('.env', 'PRIVATE_NOT_TO_COPY=fixture-only\n');
  f.write('node_modules/huge/index.js', 'do not copy dependencies');
  const head = f.git('rev-parse', 'HEAD'), index = indexHash(f.repo), status = f.git('status', '--porcelain');
  const config = fs.readFileSync(path.join(f.repo, '.git/config'));
  const result = await prepareWorkspace(f.options);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.integration, 'not_merged');
  assert.equal(result.storageChecked, true);
  assert.equal(result.sparse, true);
  assert.equal(result.baseCommit, head);
  assert.ok(fs.statSync(path.join(result.path, '.git')).isFile());
  assert.equal(fs.readFileSync(path.join(result.path, 'src/current.js'), 'utf8'), 'const value = "current uncommitted";\n');
  assert.equal(fs.readFileSync(path.join(result.path, 'src/new.ts'), 'utf8'), 'export const added = true;\n');
  assert.equal(fs.existsSync(path.join(result.path, 'src/deleted.js')), false);
  for (const omitted of ['photo.png', '.env', 'node_modules', 'other/untouched.js']) assert.equal(fs.existsSync(path.join(result.path, omitted)), false);
  assert.equal(f.git('rev-parse', 'HEAD'), head);
  assert.equal(indexHash(f.repo), index);
  assert.deepEqual(fs.readFileSync(path.join(f.repo, '.git/config')), config);
  assert.equal(f.git('status', '--porcelain'), status);
  assert.equal(f.git('-C', result.path, 'status', '--porcelain'), '');
  assert.equal(f.git('-C', result.path, 'config', '--worktree', '--get', 'core.sparseCheckout'), 'true');
  assert.equal(f.git('rev-parse', result.snapshotCommit + '^'), head);
  assert.equal(fs.readFileSync(path.join(f.taskDir, 'workspace.json'), 'utf8').includes('current uncommitted'), false);
});

test('reuses the same owned worktree and preserves its agent edits after source moves on', async t => {
  const f = fixture(t);
  const first = await prepareWorkspace(f.options);
  assert.equal(first.ok, true, JSON.stringify(first));
  fs.writeFileSync(path.join(first.path, 'src/current.js'), 'agent progress\n');
  f.write('src/current.js', 'later source change\n');
  const second = await prepareWorkspace(f.options);
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.equal(second.reused, true);
  assert.equal(second.path, first.path);
  assert.equal(fs.readFileSync(path.join(second.path, 'src/current.js'), 'utf8'), 'agent progress\n');
  const changedScope = await prepareWorkspace({ ...f.options, scope: ['other'] });
  assert.equal(changedScope.ok, false);
  assert.equal(changedScope.code, 'WORKSPACE_SCOPE_MISMATCH');
});

test('source edits during snapshot hold admission and never restore source files', async t => {
  const f = fixture(t);
  const head = f.git('rev-parse', 'HEAD'), index = indexHash(f.repo);
  const result = await prepareWorkspace({ ...f.options, afterCapture: () => f.write('src/current.js', 'new concurrent work\n') });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SOURCE_CHANGED');
  assert.equal(fs.existsSync(path.join(f.taskDir, 'workspace')), false);
  assert.equal(fs.readFileSync(path.join(f.repo, 'src/current.js'), 'utf8'), 'new concurrent work\n');
  assert.equal(f.git('rev-parse', 'HEAD'), head);
  assert.equal(indexHash(f.repo), index);
});

test('changes outside the explicit scope do not expand the snapshot or block unrelated work', async t => {
  const f = fixture(t);
  const result = await prepareWorkspace({ ...f.options, afterCapture: () => f.write('other/untouched.js', 'concurrent outside scope\n') });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(fs.existsSync(path.join(result.path, 'other/untouched.js')), false);
});

test('modified tracked media inside scope holds instead of silently losing current changes', async t => {
  const f = fixture(t);
  f.write('src/image.png', Buffer.from([0, 1, 2])); f.git('add', 'src/image.png'); f.git('commit', '-qm', 'tracked media');
  f.write('src/image.png', Buffer.from([0, 9, 2]));
  const result = await prepareWorkspace(f.options);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UNSAFE_DIRTY_TRACKED');
  assert.equal(fs.existsSync(path.join(f.taskDir, 'workspace')), false);
});

test('dirty media outside scope is not copied and does not block source preparation', async t => {
  const f = fixture(t);
  f.write('photo.png', Buffer.from([0, 9, 9]));
  const result = await prepareWorkspace(f.options);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(fs.existsSync(path.join(result.path, 'photo.png')), false);
});

test('secret-like text and embedded media are held before any worktree is registered', async t => {
  const f = fixture(t);
  f.write('src/new.js', 'const credential = "' + ['sk', 'a'.repeat(40)].join('-') + '";\n');
  const result = await prepareWorkspace(f.options);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SECRET_OR_EMBEDDED_MEDIA');
  assert.equal(fs.existsSync(path.join(f.taskDir, 'workspace')), false);
  assert.equal(fs.existsSync(path.join(f.taskDir, 'snapshot-files')), false);
});

test('file and total volume limits hold before snapshot files are written', async t => {
  const f = fixture(t);
  const result = await prepareWorkspace({ ...f.options, limits: { singleFile: 10 } });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SOURCE_FILE_LIMIT');
  assert.equal(fs.existsSync(path.join(f.taskDir, 'snapshot-files')), false);
});

test('storage guard failure prevents snapshot commit and native worktree creation', async t => {
  const f = fixture(t);
  f.write('tools/git-storage-check.cjs', 'process.exit(1);\n');
  const result = await prepareWorkspace(f.options);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'STORAGE_GUARD_FAILED');
  assert.equal(fs.existsSync(path.join(f.taskDir, 'workspace')), false);
  assert.equal(f.git('worktree', 'list', '--porcelain').split('worktree ').length - 1, 1);
});

test('active index lock is never removed and admission stops at the bounded wait', async t => {
  const f = fixture(t), lock = path.join(f.repo, '.git/index.lock');
  fs.writeFileSync(lock, 'owned lock');
  const result = await prepareWorkspace({ ...f.options, lockWaitMs: 20 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'GIT_LOCKED');
  assert.equal(fs.readFileSync(lock, 'utf8'), 'owned lock');
});

test('another preparation lock is not deleted on failed acquisition', async t => {
  const f = fixture(t);
  fs.mkdirSync(f.taskDir);
  const lock = path.join(f.taskDir, 'workspace.prepare.lock'); fs.writeFileSync(lock, 'another process');
  const result = await prepareWorkspace(f.options);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PREPARE_ALREADY_EXISTS');
  assert.equal(fs.readFileSync(lock, 'utf8'), 'another process');
});

test('capacity review is explicit and never prunes prior workspaces', async t => {
  const f = fixture(t), existing = [];
  for (let i = 0; i < 8; i++) {
    const folder = path.join(f.tasks, 'synk-' + i.toString(16).padStart(12, '0')); existing.push(folder);
    fs.mkdirSync(folder); fs.mkdirSync(path.join(folder, 'workspace')); fs.writeFileSync(path.join(folder, 'workspace.json'), JSON.stringify({ sourceBytes: 10 }));
  }
  const result = await prepareWorkspace(f.options);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'WORKSPACE_CAPACITY_REVIEW');
  for (const folder of existing) assert.equal(fs.existsSync(path.join(folder, 'workspace.json')), true);
});

test('one pre-worktree source race retries the same task and preserves failed snapshot/index/receipt', async t => {
  const f = fixture(t), head = f.git('rev-parse', 'HEAD'), index = indexHash(f.repo); let captures = 0;
  const result = await prepareWorkspace({ ...f.options, afterCapture: () => { if (++captures === 1) f.write('src/current.js', 'const current = "new concurrent source";\n'); } });
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.preparationAttempts, 2); assert.equal(captures, 2); assert.equal(result.taskId, f.taskId);
  const parent = path.join(f.taskDir, 'preparation-attempts'), attempts = fs.readdirSync(parent); assert.equal(attempts.length, 1);
  const archived = path.join(parent, attempts[0]);
  assert.equal(fs.readFileSync(path.join(archived, 'snapshot-files/src/current.js'), 'utf8'), 'const value = "head";\n');
  assert.equal(fs.existsSync(path.join(archived, 'snapshot.index')), true);
  const receipt = JSON.parse(fs.readFileSync(path.join(archived, 'workspace.json'))); assert.equal(receipt.state, 'held'); assert.equal(receipt.failureCode, 'SOURCE_CHANGED');
  assert.equal(fs.readFileSync(path.join(result.path, 'src/current.js'), 'utf8'), 'const current = "new concurrent source";\n');
  assert.equal(f.git('rev-parse', 'HEAD'), head); assert.equal(indexHash(f.repo), index); assert.equal(fs.existsSync(path.join(f.taskDir, 'workspace.prepare.lock')), false);
});

test('continuous pre-worktree changes stop after three attempts without deleting preserved inputs', async t => {
  const f = fixture(t), head = f.git('rev-parse', 'HEAD'), index = indexHash(f.repo); let captures = 0;
  const result = await prepareWorkspace({ ...f.options, afterCapture: () => f.write('src/current.js', 'const race = ' + (++captures) + ';\n') });
  assert.equal(result.ok, false); assert.equal(result.code, 'SOURCE_CHANGED'); assert.equal(captures, 3);
  const parent = path.join(f.taskDir, 'preparation-attempts'); assert.equal(fs.readdirSync(parent).length, 2);
  for (const attempt of fs.readdirSync(parent)) for (const name of ['snapshot-files', 'snapshot.index', 'workspace.json', 'attempt.json']) assert.equal(fs.existsSync(path.join(parent, attempt, name)), true);
  const receipt = JSON.parse(fs.readFileSync(path.join(f.taskDir, 'workspace.json'))); assert.equal(receipt.preparationAttempts, 3); assert.equal(receipt.state, 'held');
  assert.equal(fs.existsSync(path.join(f.taskDir, 'workspace')), false); assert.equal(fs.readFileSync(path.join(f.repo, 'src/current.js'), 'utf8'), 'const race = 3;\n');
  assert.equal(f.git('rev-parse', 'HEAD'), head); assert.equal(indexHash(f.repo), index);
});

test('a different error after a preserved source race never triggers a third attempt', async t => {
  const f = fixture(t); let captures = 0;
  const result = await prepareWorkspace({ ...f.options, afterCapture: () => { captures++; if (captures === 1) f.write('src/current.js', 'concurrent first change\n'); else throw new Error('different fixture failure'); } });
  assert.equal(result.ok, false); assert.equal(result.code, 'WORKSPACE_PREPARE_FAILED'); assert.equal(captures, 2);
  assert.equal(fs.readdirSync(path.join(f.taskDir, 'preparation-attempts')).length, 1); assert.equal(fs.existsSync(path.join(f.taskDir, 'workspace')), false);
});

test('late source race preserves the already-created official worktree without retry or reset', async t => {
  const f = fixture(t), head = f.git('rev-parse', 'HEAD'), index = indexHash(f.repo); const originalWrite = fs.writeFileSync.bind(fs); let changed = 0, captures = 0;
  t.mock.method(fs, 'writeFileSync', (file, ...args) => { const value = originalWrite(file, ...args); if (String(file).replace(/\\/g, '/').endsWith('/info/sparse-checkout')) { changed++; originalWrite(path.join(f.repo, 'src/current.js'), 'late concurrent source\n'); } return value; });
  const result = await prepareWorkspace({ ...f.options, afterCapture: () => { captures++; } });
  assert.equal(result.ok, false); assert.equal(result.code, 'SOURCE_CHANGED'); assert.equal(changed, 1); assert.equal(captures, 1);
  const workspace = path.join(f.taskDir, 'workspace'); assert.equal(fs.statSync(path.join(workspace, '.git')).isFile(), true);
  assert.equal(fs.readFileSync(path.join(workspace, 'src/current.js'), 'utf8'), 'const value = "head";\n');
  assert.equal(fs.readFileSync(path.join(f.repo, 'src/current.js'), 'utf8'), 'late concurrent source\n'); assert.equal(fs.existsSync(path.join(f.taskDir, 'preparation-attempts')), false);
  assert.equal(f.git('rev-parse', 'HEAD'), head); assert.equal(indexHash(f.repo), index);
});

test('a symlink archive parent is refused without moving snapshot inputs outside the task root', async t => {
  const f = fixture(t), outside = path.join(f.root, 'outside-archive'); fs.mkdirSync(outside); const link = path.join(f.taskDir, 'preparation-attempts');
  try {
    const result = await prepareWorkspace({ ...f.options, afterCapture: () => { fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir'); f.write('src/current.js', 'source race\n'); } });
    assert.equal(result.ok, false); assert.equal(result.code, 'WORKSPACE_OWNERSHIP_INVALID'); assert.deepEqual(fs.readdirSync(outside), []);
    assert.equal(fs.existsSync(path.join(f.taskDir, 'snapshot-files/src/current.js')), true); assert.equal(fs.existsSync(path.join(f.taskDir, 'snapshot.index')), true);
  } finally { if (fs.existsSync(link)) fs.unlinkSync(link); }
});

test('snapshot-only held tasks consume bytes without consuming a worktree slot', async t => {
  const f = fixture(t), existing = path.join(f.tasks, 'synk-000000000000'); fs.mkdirSync(path.join(existing, 'snapshot-files'), { recursive: true });
  fs.writeFileSync(path.join(existing, 'snapshot-files/old.md'), 'Preserved failed preparation.\n'); fs.writeFileSync(path.join(existing, 'workspace.json'), JSON.stringify({ state: 'held', sourceBytes: 29 }));
  const result = await prepareWorkspace({ ...f.options, limits: { retained: 1 } }); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(fs.readFileSync(path.join(existing, 'snapshot-files/old.md'), 'utf8'), 'Preserved failed preparation.\n');
});

test('archived preparation bytes and invalid declared sizes remain conservatively bounded', async t => {
  for (const badMetadata of [false, true]) {
    const f = fixture(t), existing = path.join(f.tasks, 'synk-000000000000'), attempt = path.join(existing, 'preparation-attempts/attempt-1-kept'); fs.mkdirSync(path.join(attempt, 'snapshot-files'), { recursive: true });
    const size = badMetadata ? 20 : 300000;
    fs.writeFileSync(path.join(attempt, 'snapshot-files/old.md'), Buffer.alloc(size, 65)); fs.writeFileSync(path.join(attempt, 'workspace.json'), JSON.stringify({ sourceBytes: badMetadata ? -1 : size }));
    const result = await prepareWorkspace({ ...f.options, limits: { retainedBytes: 256000 } }); assert.equal(result.ok, false); assert.equal(result.code, 'WORKSPACE_CAPACITY_REVIEW'); assert.equal(fs.statSync(path.join(attempt, 'snapshot-files/old.md')).size, size);
  }
});

test('metadata inspection and scope defaults are read-only and never imply all source is deployed', t => {
  const f = fixture(t), before = f.git('worktree', 'list', '--porcelain');
  const result = inspectSource({ repo: f.repo });
  assert.equal(result.readOnly, true);
  assert.equal(result.preparableByMetadata, true);
  assert.equal(result.scope.includes('docs/AI_운영원칙.md'), true);
  assert.equal(result.scope.includes('src'), false);
  assert.equal(f.git('worktree', 'list', '--porcelain'), before);
  assert.equal(safeSource('.env'), false);
  assert.equal(safeSource('node_modules/module/index.js'), false);
  assert.equal(safeSource('photo.png'), false);
});

test('unsafe scope and source-inside task directory are refused', async t => {
  const f = fixture(t);
  assert.equal((await prepareWorkspace({ ...f.options, scope: ['../outside'] })).code, 'INVALID_SCOPE');
  assert.equal((await prepareWorkspace({ ...f.options, scope: ['.env'] })).code, 'UNSAFE_SCOPE');
  assert.equal((await prepareWorkspace({ ...f.options, scope: ['src/.auth.json'] })).code, 'UNSAFE_SCOPE');
  assert.equal((await prepareWorkspace({ ...f.options, taskDir: path.join(f.repo, f.taskId) })).code, 'TASK_DIR_INSIDE_SOURCE');
});

test('worktree config support is not silently enabled in the source repository', async t => {
  const f = fixture(t);
  f.git('config', '--unset', 'extensions.worktreeConfig');
  const before = fs.readFileSync(path.join(f.repo, '.git/config'));
  const result = await prepareWorkspace(f.options);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'WORKTREE_CONFIG_REQUIRED');
  assert.deepEqual(fs.readFileSync(path.join(f.repo, '.git/config')), before);
  assert.equal(fs.existsSync(path.join(f.taskDir, 'workspace')), false);
});

test('a forged receipt cannot redirect preparation to another directory', async t => {
  const f = fixture(t);
  fs.mkdirSync(f.taskDir);
  fs.writeFileSync(path.join(f.taskDir, 'workspace.json'), JSON.stringify({ version: 1, state: 'ready',
    taskId: f.taskId, sourceRoot: f.repo, integration: 'not_merged', snapshotCommit: f.git('rev-parse', 'HEAD'), path: f.repo }));
  const result = await prepareWorkspace(f.options);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'WORKSPACE_RECEIPT_INVALID');
});

test('an explicitly requested ignored source file is held instead of ready with missing content', async t => {
  const f = fixture(t);
  f.write('.gitignore', '.env\nnode_modules/\nsrc/ignored.html\n');
  f.write('src/ignored.html', '<p>Current real ignored draft</p>\n');
  const result = await prepareWorkspace({ ...f.options, scope: ['src/ignored.html'] });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'IGNORED_SCOPE_SOURCE');
  assert.equal(fs.existsSync(path.join(f.taskDir, 'workspace')), false);
  assert.equal(fs.readFileSync(path.join(f.repo, 'src/ignored.html'), 'utf8'), '<p>Current real ignored draft</p>\n');
});

test('a directory scope cannot silently omit its ignored source descendants', async t => {
  const f = fixture(t);
  f.write('.gitignore', '.env\nnode_modules/\nsrc/drafts/\n');
  f.write('src/drafts/current.html', '<p>Ignored inside requested directory</p>\n');
  const result = await prepareWorkspace(f.options);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'IGNORED_SCOPE_SOURCE');
  const inspected = inspectSource({ repo: f.repo, scope: ['src'] });
  assert.equal(inspected.preparableByMetadata, false);
  assert.ok(inspected.holds.includes('IGNORED_SCOPE_SOURCE'));
});

test('ignored dependencies and out-of-scope drafts are excluded without blocking the chosen source', async t => {
  const f = fixture(t);
  f.write('.gitignore', '.env\nnode_modules/\nother/drafts/\n');
  f.write('other/drafts/current.html', '<p>Not part of this task</p>\n');
  f.write('node_modules/module/index.js', 'dependency cache\n');
  const result = await prepareWorkspace(f.options);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.ignoredScopeChecked, true);
  assert.equal(fs.existsSync(path.join(result.path, 'other/drafts/current.html')), false);
});

test('default scope includes required field notes, decision record and Git lock inspector', async t => {
  const f = fixture(t);
  f.write('docs/현장노트/윈도우_셸.md', 'Read tool notes before using the shell.\n');
  f.write('docs/_ops/결정.md', 'Record confirmed decisions here.\n');
  f.write('tools/git잠금.js', 'console.log("Read-only fixture lock inspector");\n');
  const result = await prepareWorkspace({ ...f.options, scope: [] });
  assert.equal(result.ok, true, JSON.stringify(result));
  for (const included of ['docs/현장노트', 'docs/_ops/결정.md', 'tools/git잠금.js']) assert.ok(result.scope.includes(included));
  for (const materialized of ['docs/현장노트/윈도우_셸.md', 'docs/_ops/결정.md', 'tools/git잠금.js']) {
    assert.equal(fs.existsSync(path.join(result.path, materialized)), true);
  }
  assert.equal(fs.existsSync(path.join(result.path, 'src/current.js')), false);
});
