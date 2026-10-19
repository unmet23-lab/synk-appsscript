'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const backup = require('../tools/onedrive-backup.cjs');
const policy = require('../tools/이어하기꾸러미.js');
function fixture(t) {
  const base = fs.realpathSync(os.tmpdir()), temp = fs.mkdtempSync(path.join(base, 'synk-onedrive-run-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(temp)), base);
    assert.ok(path.basename(temp).startsWith('synk-onedrive-run-'));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const root = path.join(temp, 'source'), destination = path.join(temp, 'destination');
  fs.mkdirSync(root); fs.mkdirSync(destination);
  const put = (base, file, content) => { const out = path.join(base, file); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, content); return out; };
  return { temp, root, destination, put, stateDir: path.join(temp, 'state') };
}
const healthy = () => ({ inspected: 1, missingFiles: 0, sizeMismatches: 0, readErrors: 0, stateCounts: { IN_SYNC: 1 }, allTargetsStateInSync: true });
test('new direct sibling repositories join source scope while cache and links stay excluded', t => {
  const f = fixture(t);
  const repo = path.join(f.temp, 'new-repository'); fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  const archived = path.join(f.temp, 'archive-old-repository'); fs.mkdirSync(path.join(archived, '.git'), { recursive: true });
  const scopes = policy.systemScopes(f.root);
  assert.ok(scopes.some(scope => scope.name === 'new-repository' && scope.mode === 'repository'));
  assert.ok(!scopes.some(scope => scope.name === 'archive-old-repository'));
});
test('worktree source discovery includes changed and untracked safe text without media or deleted files', t => {
  const f = fixture(t), tree = path.join(f.temp, 'git-worktree');
  const { execFileSync } = require('node:child_process');
  const git = (...args) => execFileSync('git', args, { cwd: f.root, windowsHide: true, stdio: 'pipe' });
  git('init', '-q');
  f.put(f.root, 'app.js', 'const version = 1;'); f.put(f.root, 'unchanged.js', 'const same = true;');
  f.put(f.root, 'removed.js', 'const removed = true;');
  git('add', '.'); git('-c', 'user.name=Backup Test', '-c', 'user.email=backup@example.invalid', 'commit', '-qm', 'fixture');
  git('worktree', 'add', '-q', '--detach', tree);
  f.put(tree, 'app.js', 'const version = 2;'); f.put(tree, 'new source.js', 'const added = true;');
  f.put(tree, 'movie.mp4', 'media'); f.put(tree, 'docs/plan.md', '# Collected separately');
  f.put(tree, '.env', 'not backed up'); fs.unlinkSync(path.join(tree, 'removed.js'));
  const found = backup.changedWorktreeSources({ primary: f.root, root: tree });
  assert.deepEqual(found.sort(), ['app.js', 'new source.js']);
});
test('provider errors and absent proof do not count as successful cloud sync', () => {
  assert.equal(backup.classifyProvider(null), 'failed');
  assert.equal(backup.classifyProvider(healthy()), 'healthy');
  assert.equal(backup.classifyProvider({ ...healthy(), missingFiles: 1 }), 'failed');
  assert.equal(backup.classifyProvider({ ...healthy(), allTargetsStateInSync: false, stateCounts: { ERROR: 1 } }), 'failed');
  assert.equal(backup.classifyProvider({ ...healthy(), allTargetsStateInSync: false, stateCounts: { PENDING_UPLOAD: 1 } }), 'pending');
});
test('non-Git creation tools discover new source and config while excluding models, dependencies and runtime state', t => {
  const f = fixture(t);
  for (const name of ['tools/render.py', 'train/config.yaml', 'datasets/captions/01.txt', 'outputs/run/config.yaml', 'README.md',
    'models/vendor/README.md', 'hf-cache/config.json', 'tools/ai-toolkit/train.py', 'tools/ComfyUI/app.py',
    'tools/seedvr2-extra/package.py', 'tools/__pycache__/cache.py', 'outputs/run/log.txt', 'outputs/run/logs/0_log.txt',
    'outputs/run/pid.txt', 'validation/job_id_v2.txt', 'datasets/.aitk_size.json', 'datasets/photo.png']) f.put(f.root, name, 'safe text');
  assert.deepEqual(policy.creationSources(f.root).sort(), ['README.md', 'datasets/captions/01.txt', 'outputs/run/config.yaml', 'tools/render.py', 'train/config.yaml']);
  f.put(f.root, 'tools/new-tool.ps1', 'Write-Output 1');
  assert.ok(policy.creationSources(f.root).includes('tools/new-tool.ps1'));
});
test('current worktree documents deduplicate by content and changed versions remain preserved', t => {
  const f = fixture(t), tree = path.join(f.temp, 'worktree'), vault = path.join(f.temp, 'vault');
  f.put(f.root, 'same.md', '# Same'); f.put(tree, 'same.md', '# Same');
  f.put(tree, 'new.md', '# Version one'); f.put(tree, 'alias.md', '# Version one');
  f.put(tree, 'movie.md', 'bad' + String.fromCharCode(0));
  f.put(tree, 'key.md', 'pass' + 'word: "not-a-public-example"');
  f.put(tree, 'node_modules/pkg/README.md', '# Skip');
  f.put(tree, 'changed.js', 'module.exports = "changed source";');
  const trees = [{ repository: 'SYNK-appsscript', primary: f.root, root: tree, changedSources: ['changed.js'] }];
  const first = backup.preserveWorktreeDocuments(f.root, vault, { trees });
  assert.equal(first.uniquePreserved, 2); assert.equal(first.sameAsPrimary, 1); assert.equal(first.rejected, 2); assert.equal(first.sourceFiles, 1);
  const folder = path.join(vault, '작업문서_미통합_자동');
  assert.equal(fs.readdirSync(path.join(folder, 'files')).length, 2);
  const indexBefore = fs.readFileSync(path.join(folder, 'index.json'));
  backup.preserveWorktreeDocuments(f.root, vault, { trees });
  assert.ok(indexBefore.equals(fs.readFileSync(path.join(folder, 'index.json'))), 'unchanged scans must not create cloud index versions');
  f.put(tree, 'new.md', '# Version two');
  const next = backup.preserveWorktreeDocuments(f.root, vault, { trees });
  assert.equal(next.uniquePreserved, 3); assert.equal(next.written, 1);
  const index = backup.readJson(path.join(folder, 'index.json'));
  const entries = index.manifests.flatMap(item => backup.readJson(path.join(folder, item.file)).entries);
  assert.equal(entries.find(x => x.relativePath === 'new.md').sameAsPrimary, false);
  assert.equal(fs.readdirSync(path.join(folder, 'files')).length, 3);
});
test('receipt avoids rewrites, but changed sources and damaged destinations are repaired', t => {
  const f = fixture(t); f.put(f.root, 'document.md', '# Version one');
  const rows = [{ brand: 'SYNK', source: 'document.md', target: 'document.md', kind: 'system' }];
  const first = policy.copy(f.root, f.destination, rows, { recordFiles: true });
  const second = policy.copy(f.root, f.destination, rows, { recordFiles: true, previousFiles: first.files });
  assert.equal(second.written, 0); assert.equal(second.files[0].verification, 'sha256-readback');
  f.put(f.root, 'document.md', '# Version two');
  const third = policy.copy(f.root, f.destination, rows, { recordFiles: true, previousFiles: second.files });
  assert.equal(third.written, 1);
  fs.utimesSync(third.files[0].target, new Date(0), new Date(0));
  fs.writeFileSync(third.files[0].target, '# Broken copy');
  const fourth = policy.copy(f.root, f.destination, rows, { recordFiles: true, previousFiles: third.files });
  assert.equal(fourth.written, 1);
  assert.equal(fs.readFileSync(fourth.files[0].target, 'utf8'), '# Version two');
});
test('runner persists success, pending and failure separately and never deletes extra files', t => {
  const f = fixture(t); f.put(f.root, 'source.js', 'module.exports = 1;'); f.put(f.destination, 'keep.txt', 'keep');
  const options = { ...f, getRows: () => [{ brand: 'SYNK', source: 'source.js', target: 'source.js', kind: 'system' }], collectWorktrees: () => ({ documents: 0 }), checkProvider: healthy };
  const first = backup.run(options);
  assert.equal(first.status, 'healthy'); assert.equal(first.exitCode, 0);
  assert.equal(backup.readJson(path.join(f.stateDir, 'copy-manifest.json')).files.length, 1);
  const pending = backup.run({ ...options, checkProvider: () => ({ ...healthy(), allTargetsStateInSync: false, stateCounts: { PENDING_UPLOAD: 1 } }) });
  assert.equal(pending.exitCode, 2); assert.equal(pending.lastSuccessAt, first.lastSuccessAt);
  const failure = backup.run({ ...options, checkProvider: () => { throw new Error('provider-unavailable'); } });
  assert.equal(failure.exitCode, 1); assert.equal(failure.status, 'failed');
  assert.equal(backup.readJson(path.join(f.stateDir, 'latest.json')).error, 'provider-unavailable');
  assert.equal(fs.readFileSync(path.join(f.destination, 'keep.txt'), 'utf8'), 'keep');
});
test('dry run writes no backups or receipt and invalid root fails explicitly', t => {
  const f = fixture(t); f.put(f.root, 'source.js', 'module.exports = 1;');
  const planned = backup.run({ ...f, dryRun: true, collectWorktrees: () => ({}), getRows: () => [{ brand: 'SYNK', source: 'source.js', target: 'source.js' }] });
  assert.equal(planned.status, 'planned'); assert.equal(fs.existsSync(f.stateDir), false);
  const failed = backup.run({ ...f, destination: path.join(f.temp, 'absent') });
  assert.equal(failed.status, 'failed'); assert.equal(failed.error, 'configured-onedrive-root-missing');
});

test('source changes during a copy retain safe failure paths and require a fresh verified retry', t => {
  const f = fixture(t), source = f.put(f.root, 'source.js', 'module.exports = 1;');
  const target = path.join(f.destination, 'SYNK/source.js');
  const options = { ...f, getRows: () => [{ brand: 'SYNK', source: 'source.js', target: 'source.js', kind: 'system' }],
    collectWorktrees: () => ({}), checkProvider: healthy };
  const first = backup.run(options);
  assert.equal(first.status, 'healthy');
  const originalManifest = fs.readFileSync(path.join(f.stateDir, 'copy-manifest.json'));
  f.put(f.root, 'source.js', 'module.exports = 2;');
  const originalRead = fs.readFileSync;
  let changed = false;
  const mocked = t.mock.method(fs, 'readFileSync', function (file, ...args) {
    const data = originalRead.call(this, file, ...args);
    if (!changed && typeof file === 'string' && path.resolve(file) === path.resolve(target)) {
      changed = true;
      fs.writeFileSync(source, 'module.exports = 333;');
    }
    return data;
  });
  const failed = backup.run({ ...options, checkProvider: () => { throw new Error('unverified-copy-reached-provider'); } });
  mocked.mock.restore();
  assert.equal(changed, true);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.error, 'source-changed-during-copy');
  assert.deepEqual(failed.sourceDrift, [{ source, reason: 'source-changed-during-copy' }]);
  assert.deepEqual(backup.readJson(path.join(f.stateDir, 'latest.json')).sourceDrift, failed.sourceDrift);
  assert.equal(failed.lastSuccessAt, first.lastSuccessAt);
  assert.ok(originalManifest.equals(fs.readFileSync(path.join(f.stateDir, 'copy-manifest.json'))));
  const retried = backup.run(options);
  assert.equal(retried.status, 'healthy');
  assert.equal(fs.readFileSync(target, 'utf8'), 'module.exports = 333;');
  assert.equal(retried.sourceDrift, undefined);
});

test('a source deleted between planning and copying is skipped and counted, not a failed run (10-19)', t => {
  const f = fixture(t), gone = f.put(f.root, 'gone.md', '# Temporary'); f.put(f.root, 'kept.md', '# Kept');
  const rows = ['gone.md', 'kept.md'].map(source => ({ brand: 'SYNK', source, target: source, kind: 'system' }));
  const originalRead = fs.readFileSync;
  let reads = 0;
  // copy()가 목록 단계에서 한 번, 복사 단계에서 한 번 읽는다. 두 번째 읽기 직전에 다른 세션이 지운 것처럼 만든다.
  const mocked = t.mock.method(fs, 'readFileSync', function (file, ...args) {
    if (typeof file === 'string' && path.resolve(file) === path.resolve(gone) && ++reads === 2) fs.unlinkSync(gone);
    return originalRead.call(this, file, ...args);
  });
  const result = policy.copy(f.root, f.destination, rows, { recordFiles: true });
  mocked.mock.restore();
  assert.equal(result.disappeared, 1);
  assert.deepEqual(result.files.map(file => path.basename(file.source)), ['kept.md']);
  assert.deepEqual(result.sourceDrift, []);
  assert.equal(fs.readFileSync(path.join(f.destination, 'SYNK/kept.md'), 'utf8'), '# Kept');
  assert.equal(fs.existsSync(path.join(f.destination, 'SYNK/gone.md')), false);
});

test('a formerly safe source becoming protected keeps old bytes and fails until resolved', t => {
  const f = fixture(t); f.put(f.root, 'source.js', 'module.exports = 1;'); f.put(f.root, 'keep.md', '# Keep');
  const rows = () => ['source.js', 'keep.md'].filter(name => fs.existsSync(path.join(f.root, name)))
    .map(source => ({ brand: 'SYNK', source, target: source, kind: 'system' }));
  const options = { ...f, getRows: rows, collectWorktrees: () => ({}), checkProvider: healthy };
  const first = backup.run(options); assert.equal(first.status, 'healthy');
  f.put(f.root, 'source.js', 'const pass' + 'word = "unreviewed-private-value";');
  const second = backup.run(options);
  assert.equal(second.status, 'failed'); assert.equal(second.error, 'previously-backed-source-now-protected');
  assert.equal(second.protectedSources.length, 1); assert.equal(second.lastSuccessAt, first.lastSuccessAt);
  const inventory = backup.readJson(path.join(f.stateDir, 'protected-sources.json'));
  assert.equal(inventory.status, 'success'); assert.equal(inventory.files.length, 1);
  assert.equal(inventory.files[0].sourcePath, path.join(f.root, 'source.js'));
  assert.equal(inventory.files[0].reason, 'secret-literal'); assert.match(inventory.files[0].sha256, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(inventory).includes('unreviewed-private-value'));
  assert.equal(fs.readFileSync(path.join(f.destination, 'SYNK/source.js'), 'utf8'), 'module.exports = 1;');
  assert.equal(backup.run(options).status, 'failed', 'the next run must not forget excluded current content');
  assert.equal(backup.run({ ...options, checkOnly: true }).status, 'failed');
  const proofFile = path.join(f.temp, 'SYNK_원본창고/protected-source-backup-status.json');
  const proof = { files: [{ ...inventory.files[0], status: 'encrypted-drive-verified', coverage: {
    ok: true, account: '77yuhbs@gmail.com', checkedAt: new Date().toISOString(), files: [{ id: 'fixture-remote-id', bytes: 100, sha256: 'a'.repeat(64) }] } }] };
  backup.writeJson(proofFile, proof);
  const covered = backup.run({ ...options, checkOnly: true });
  assert.equal(covered.status, 'healthy'); assert.equal(covered.protectedSources[0].preservedBy, 'encrypted-drive');
  proof.files[0].sha256 = 'b'.repeat(64); backup.writeJson(proofFile, proof);
  assert.equal(backup.run({ ...options, checkOnly: true }).status, 'failed', 'different source bytes cannot reuse old remote proof');
  proof.files[0].sha256 = inventory.files[0].sha256;
  proof.files[0].coverage.checkedAt = new Date(Date.now() - 37 * 3600000).toISOString(); backup.writeJson(proofFile, proof);
  assert.equal(backup.run({ ...options, checkOnly: true }).status, 'failed', 'stale coverage is not current remote proof');
  f.put(f.root, 'source.js', 'module.exports = 2;'); assert.equal(backup.run(options).status, 'healthy');
  fs.unlinkSync(path.join(f.root, 'source.js'));
  assert.equal(backup.run(options).status, 'healthy');
  assert.equal(fs.readFileSync(path.join(f.destination, 'SYNK/source.js'), 'utf8'), 'module.exports = 2;');
});

test('previously copied CSS with new embedded media keeps safe bytes and needs exact encrypted coverage', t => {
  const f = fixture(t), safe = 'body{color:black}', embedded = ['body{background:url("da', 'ta:im', 'age/png;base', '64,AAAA")}'].join('');
  f.put(f.root, 'style.css', safe); f.put(f.root, 'keep.md', '# Keep');
  const rows = () => ['style.css', 'keep.md', 'never-copied.css'].filter(name => fs.existsSync(path.join(f.root, name)))
    .map(source => ({ brand: 'SYNK', source, target: source, kind: 'system' }));
  const options = { ...f, getRows: rows, collectWorktrees: () => ({}), checkProvider: healthy };
  assert.equal(backup.run(options).status, 'healthy');
  f.put(f.root, 'style.css', embedded); f.put(f.root, 'never-copied.css', embedded);
  const failed = backup.run(options); assert.equal(failed.error, 'previously-backed-source-now-protected');
  const inventory = backup.readJson(path.join(f.stateDir, 'protected-sources.json'));
  assert.equal(inventory.files.length, 1); const row = inventory.files[0];
  assert.equal(row.sourcePath, path.join(f.root, 'style.css')); assert.equal(row.reason, 'embedded-media-or-base64');
  assert.equal(row.priorOneDriveCopy.sha256, require('node:crypto').createHash('sha256').update(safe).digest('hex'));
  assert.equal(fs.readFileSync(path.join(f.destination, 'SYNK/style.css'), 'utf8'), safe);
  assert.equal(fs.readFileSync(path.join(f.root, 'style.css'), 'utf8'), embedded);
  assert.equal(backup.run({ ...options, checkOnly: true }).status, 'failed');
  backup.writeJson(path.join(f.temp, 'SYNK_원본창고/protected-source-backup-status.json'), { files: [{ ...row, status: 'encrypted-drive-verified', coverage: {
    ok: true, account: '77yuhbs@gmail.com', checkedAt: new Date().toISOString(), files: [{ id: 'fixture-remote-id', bytes: 100, sha256: 'a'.repeat(64) }] } }] });
  assert.equal(backup.run({ ...options, checkOnly: true }).status, 'healthy');
  assert.equal(fs.readFileSync(path.join(f.destination, 'SYNK/style.css'), 'utf8'), safe);
});

test('current native app, game project and subtitle text survives while compiled or embedded media stays blocked', t => {
  const f = fixture(t);
  const names = ['desktop/installer/app.cs', 'desktop/installer/app.csproj', 'desktop/installer/app.manifest', 'desktop/installer/custom.nsh',
    'unity/SynkWorld/Assets/SynkWorld/Core/Game.cs', 'unity/SynkWorld/Assets/SynkWorld/Core/game.asmdef', 'unity/SynkWorld/ProjectSettings/ProjectSettings.asset',
    'unity/SynkWorld/Assets/scene.unity', 'unity/SynkWorld/Assets/ui.uss', 'unity/SynkWorld/Assets/item.prefab', 'unity/SynkWorld/Assets/item.meta',
    'receiver/Code.gs', 'tools/obs.lua', 'app.webmanifest', 'app.uproject', '.prettierrc', '.dockerignore', '.claspignore', 'Caddyfile', 'CNAME', 'change.patch',
    'script.srt', 'script.vtt', 'script.ass', 'edit.ffconcat', 'analysis.ipynb'];
  for (const name of names) { f.put(f.root, name, 'safe text'); assert.equal(policy.textPolicy(name, Buffer.from('safe text')), null, name); }
  const rows = names.map(source => ({ brand: 'SYNK', source, target: source, kind: 'system' }));
  assert.equal(policy.oneDrivePlan(f.root, rows).selected.length, names.length);
  assert.equal(policy.copy(f.root, f.destination, rows).written, names.length);
  assert.equal(policy.textPolicy('unity/SynkWorld/Library/obj.cs', Buffer.from('generated')), 'generated-or-excluded-path');
  assert.equal(policy.textPolicy('compiled.dll', Buffer.from('binary')), 'non-text-extension');
  assert.equal(policy.textPolicy('analysis.ipynb', Buffer.from('data:' + 'image/png;base' + '64,' + 'a'.repeat(300))), 'embedded-media-or-base64');
  assert.equal(policy.textPolicy('app.cs', Buffer.from('const string pass' + 'word = "unreviewed-live-value";')), 'secret-literal');
  assert.equal(policy.textPolicy('.githooks/pre-commit', Buffer.from('#!/bin/sh\nnode check.js\n')), null);
  assert.equal(policy.textPolicy('.githooks/pre-commit', Buffer.from('unidentified bytes')), 'not-managed-source-hook');
});

test('API contract safe Markdown preserves each worktree version and never changes the original', t => {
  const f = fixture(t), vault = path.join(f.temp, 'SYNK_원본창고'), talk = path.join(f.temp, 'SYNK-talk'), tree = path.join(f.temp, 'talk-worktree');
  const relative = 'docs/C0_API계약.md', source = '# Current contract\n{"pass' + 'word":"unreviewed-private-example"}\n';
  const older = '# Older contract\n{"pass' + 'word":"unreviewed-private-example"}\n';
  f.put(talk, relative, source); f.put(tree, relative, older);
  backup.writeJson(path.join(vault, '작업문서_미통합_자동/excluded-protected-manifest.json'), { rejected: [
    { repository: 'SYNK-talk', worktree: tree, relativePath: relative, reason: 'secret-literal' } ] });
  const { preserveSafeMarkdown } = require('../tools/onedrive-safe-markdown.cjs');
  const first = preserveSafeMarkdown(f.root, vault);
  assert.equal(first.documents, 2); assert.equal(first.uniqueCopies, 2); assert.equal(first.written, 2);
  const index = backup.readJson(path.join(vault, '문서_안전사본_자동/index.json'));
  for (const row of index.files) {
    const data = fs.readFileSync(row.safeCopyPath);
    assert.equal(policy.textPolicy('safe-contract.md', data), null);
    assert.match(data.toString(), /민감 예제 값을 대체한 안전 사본/);
    assert.ok(!data.toString().includes('unreviewed-private-example'));
    assert.ok(data.toString().includes(row.originalSha256)); assert.equal(row.replacementCount, 1);
  }
  assert.equal(fs.readFileSync(path.join(talk, relative), 'utf8'), source);
  assert.equal(fs.readFileSync(path.join(tree, relative), 'utf8'), older);
  assert.equal(preserveSafeMarkdown(f.root, vault).written, 0);
});

test('a main document changing after worktree deduplication cannot produce false restore proof', t => {
  const f = fixture(t), tree = path.join(f.temp, 'worktree');
  f.put(f.root, 'same.md', '# Old'); f.put(tree, 'same.md', '# Old');
  const options = { ...f, checkProvider: healthy,
    collectWorktrees: (root, vault) => backup.preserveWorktreeDocuments(root, vault, { trees: [
      { repository: 'SYNK-appsscript', primary: root, root: tree, changedSources: [] } ] }),
    getRows: () => { f.put(f.root, 'same.md', '# New'); return [ { brand: 'SYNK', source: 'same.md', target: 'same.md', kind: 'system' } ]; } };
  const first = backup.run(options);
  assert.equal(first.status, 'failed'); assert.equal(first.error, 'worktree-primary-source-changed-during-copy');
  assert.equal(first.worktreePrimaryDrift.length, 1); assert.equal(first.lastSuccessAt, null);
  const checkOnly = backup.run({ ...options, checkOnly: true });
  assert.equal(checkOnly.status, 'failed'); assert.equal(checkOnly.error, first.error);
  assert.equal(checkOnly.worktreePrimaryDrift.length, 1); assert.equal(checkOnly.lastSuccessAt, null);
  const second = backup.run(options);
  assert.equal(second.status, 'healthy'); assert.deepEqual(second.worktreePrimaryDrift, []);
  const preserved = path.join(f.temp, 'SYNK_원본창고/작업문서_미통합_자동/files');
  assert.ok(fs.readdirSync(preserved).some(file => fs.readFileSync(path.join(preserved, file), 'utf8') === '# Old'));
});
