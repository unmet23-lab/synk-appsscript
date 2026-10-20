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

test('a source changing during its copy is copied again in the same run; only one that keeps changing fails safely (10-20)', t => {
  const f = fixture(t), source = f.put(f.root, 'source.js', 'module.exports = 1;');
  const target = path.join(f.destination, 'SYNK/source.js');
  const options = { ...f, getRows: () => [{ brand: 'SYNK', source: 'source.js', target: 'source.js', kind: 'system' }],
    collectWorktrees: () => ({}), checkProvider: healthy, driftWaitMs: 0 };
  const first = backup.run(options);
  assert.equal(first.status, 'healthy');
  const originalManifest = fs.readFileSync(path.join(f.stateDir, 'copy-manifest.json'));
  // 사본을 다시 읽는 순간(복사 확인) 다른 세션이 원본을 고친 것처럼 만든다. limit번까지만 고친다.
  const originalRead = fs.readFileSync;
  let edits = 0, limit = 1;
  const mocked = t.mock.method(fs, 'readFileSync', function (file, ...args) {
    const data = originalRead.call(this, file, ...args);
    if (edits < limit && typeof file === 'string' && path.resolve(file) === path.resolve(target))
      fs.writeFileSync(source, 'module.exports = ' + 10 ** (2 + ++edits) + ';'); // 길이가 늘어 시각 해상도와 무관하게 바뀜이 보인다
    return data;
  });
  // 한 번 바뀐 원본은 그 파일만 다시 복사해 같은 실행이 성공한다(10-20 13:30 실행은 이것 하나로 실패했다).
  f.put(f.root, 'source.js', 'module.exports = 2;');
  const healed = backup.run(options);
  assert.equal(edits, 1);
  assert.equal(healed.status, 'healthy'); assert.equal(healed.sourceDrift, undefined); assert.equal(healed.copy.driftRetried, 1);
  assert.equal(fs.readFileSync(target, 'utf8'), 'module.exports = 1000;');
  assert.deepEqual(backup.readJson(path.join(f.stateDir, 'copy-manifest.json')).files.map(file => file.sha256), [require('node:crypto').createHash('sha256').update('module.exports = 1000;').digest('hex')]);
  const healedManifest = fs.readFileSync(path.join(f.stateDir, 'copy-manifest.json'));
  // 다시 복사할 때마다 또 바뀌는 원본은 예전처럼 실패로 남고, 사본 목록·마지막 성공은 그대로다.
  edits = 0; limit = Infinity;
  f.put(f.root, 'source.js', 'module.exports = 2;');
  const failed = backup.run({ ...options, checkProvider: () => { throw new Error('unverified-copy-reached-provider'); } });
  mocked.mock.restore();
  assert.equal(edits, 3, 'the first copy and two more tries');
  assert.equal(failed.status, 'failed');
  assert.equal(failed.error, 'source-changed-during-copy');
  assert.deepEqual(failed.sourceDrift, [{ source, reason: 'source-changed-during-copy' }]);
  assert.deepEqual(backup.readJson(path.join(f.stateDir, 'latest.json')).sourceDrift, failed.sourceDrift);
  assert.equal(failed.lastSuccessAt, healed.lastSuccessAt);
  assert.ok(healedManifest.equals(fs.readFileSync(path.join(f.stateDir, 'copy-manifest.json'))));
  assert.ok(!originalManifest.equals(healedManifest));
  const retried = backup.run(options);
  assert.equal(retried.status, 'healthy');
  assert.equal(fs.readFileSync(target, 'utf8'), 'module.exports = 100000;');
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

test('worktree collection reports progress per tree and per file so a long scan can refresh the heartbeat (10-19)', t => {
  const f = fixture(t), tree = path.join(f.temp, 'worktree'), vault = path.join(f.temp, 'vault');
  f.put(tree, 'one.md', '# One'); f.put(tree, 'two.md', '# Two');
  let calls = 0;
  backup.preserveWorktreeDocuments(f.root, vault, { trees: [{ repository: 'SYNK-appsscript', primary: f.root, root: tree, changedSources: [] }],
    onProgress: () => calls++ });
  assert.equal(calls, 4, 'one call once the tree list is built (10-20), one after listing the tree and one per candidate file');
});

test('long phases keep the running receipt heartbeat fresh so the monitor does not call the run interrupted (10-19)', t => {
  const f = fixture(t); f.put(f.root, 'a.js', 'module.exports = 1;'); f.put(f.root, 'b.js', 'module.exports = 2;');
  // 통합 감시는 실행 중 heartbeat가 15분 넘게 멈추면 실행 중단으로 본다. 시계를 박동 간격보다 크게 넘겨 매 진행마다 기록되는지 본다.
  let step = 61 * 1000, now = Date.now(), last;
  const clock = () => (last = now += step);
  const latestFile = path.join(f.stateDir, 'latest.json'), latest = () => backup.readJson(latestFile);
  const writes = [], originalRename = fs.renameSync;
  t.mock.method(fs, 'renameSync', function (from, to, ...rest) {
    writes.push(path.resolve(to) === path.resolve(latestFile) ? backup.readJson(from) : path.basename(to));
    return originalRename.call(this, from, to, ...rest);
  });
  const result = backup.run({ ...f, clock, heartbeatEveryMs: 60 * 1000, checkProvider: healthy,
    getRows: () => ['a.js', 'b.js'].map(source => ({ brand: 'SYNK', source, target: source, kind: 'system' })),
    collectWorktrees: (root, vault, { onProgress }) => {
      onProgress();
      assert.equal(latest().status, 'running');
      assert.equal(latest().heartbeatAt, new Date(last).toISOString());
      const held = latest().heartbeatAt;
      step = 1000; onProgress(); step = 61 * 1000;
      assert.equal(latest().heartbeatAt, held, 'progress inside one interval does not rewrite the receipt');
      return {};
    } });
  assert.equal(result.status, 'healthy');
  const copyStart = writes.indexOf('protected-sources.json'), copyEnd = writes.indexOf('copy-manifest.json');
  assert.ok(copyStart >= 0 && copyEnd > copyStart);
  const copyBeats = writes.slice(copyStart + 1, copyEnd).filter(row => typeof row === 'object');
  assert.equal(copyBeats.length, 3, 'one beat before copying and one per copied file');
  assert.ok(copyBeats.every(row => row.status === 'running' && row.pid === process.pid));
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

test('a main document changing after worktree deduplication keeps the worktree version in the same run, never a false restore proof (10-20)', t => {
  const f = fixture(t), tree = path.join(f.temp, 'worktree'), vault = path.join(f.temp, 'SYNK_원본창고');
  const preserved = path.join(vault, '작업문서_미통합_자동'), copied = path.join(f.destination, 'SYNK/시스템/SYNK_원본창고/작업문서_미통합_자동');
  f.put(f.root, 'same.md', '# Old'); f.put(tree, 'same.md', '# Old');
  let afterCollection = false, worktreeEdit = null;
  const options = { ...f, checkProvider: healthy, driftWaitMs: 0,
    collectWorktrees: (root, vaultDir) => backup.preserveWorktreeDocuments(root, vaultDir, { trees: [
      { repository: 'SYNK-appsscript', primary: root, root: tree, changedSources: [] } ] }),
    // 수집과 복사 사이에 다른 세션이 본진 문서를 고친다(10-20 14:30·15:00 실행이 이것으로 실패했다).
    getRows: () => { afterCollection = true; f.put(f.root, 'same.md', '# New'); if (worktreeEdit) f.put(tree, 'same.md', worktreeEdit);
      return [ { brand: 'SYNK', source: 'same.md', target: 'same.md', kind: 'system' } ]; } };
  const first = backup.run(options);
  assert.equal(first.status, 'healthy'); assert.deepEqual(first.worktreePrimaryDrift, []); assert.equal(first.worktrees.driftRepaired, 1);
  // 작업트리의 옛 판은 창고에 따로 보존되고, 그 파일과 다시 쓴 색인이 같은 실행에서 OneDrive에도 복사된다.
  const old = fs.readdirSync(path.join(preserved, 'files')).find(file => fs.readFileSync(path.join(preserved, 'files', file), 'utf8') === '# Old');
  assert.ok(old);
  assert.equal(fs.readFileSync(path.join(copied, 'files', old), 'utf8'), '# Old');
  const index = backup.readJson(path.join(preserved, 'index.json'));
  assert.equal(index.sameAsPrimary, 0); assert.equal(index.uniquePreserved, 1);
  assert.equal(fs.readFileSync(path.join(copied, 'index.json'), 'utf8'), fs.readFileSync(path.join(preserved, 'index.json'), 'utf8'));
  const shard = backup.readJson(path.join(preserved, index.manifests[0].file));
  assert.deepEqual(shard.entries.map(entry => [entry.relativePath, entry.sameAsPrimary, entry.preservedFile]), [['same.md', false, 'files/' + old]]);
  assert.ok(backup.readJson(path.join(f.stateDir, 'copy-manifest.json')).files.some(file => file.target === path.join(copied, 'files', old)));
  // 확인 전용 실행도 OneDrive 사본 목록과 창고 색인을 대조해 같은 결론이다.
  const checkOnly = backup.run({ ...options, checkOnly: true });
  assert.equal(checkOnly.status, 'healthy'); assert.deepEqual(checkOnly.worktreePrimaryDrift, []);
  // 작업트리 판도 본진과 똑같이 바뀌었으면 따로 보존하지 않고 SHA만 고친다.
  f.put(f.root, 'same.md', '# Old 2'); f.put(tree, 'same.md', '# Old 2'); worktreeEdit = '# New';
  const both = backup.run(options);
  assert.equal(both.status, 'healthy'); assert.equal(both.worktrees.driftRepaired, 1);
  assert.equal(backup.readJson(path.join(preserved, 'index.json')).sameAsPrimary, 1);
  assert.equal(fs.readdirSync(path.join(preserved, 'files')).length, 1, 'nothing new preserved');
  // 다시 읽는 사이에도 작업트리 판이 바뀌면 예전처럼 실패로 남는다.
  worktreeEdit = null; f.put(f.root, 'same.md', '# Old 3'); f.put(tree, 'same.md', '# Old 3');
  const originalRead = fs.readFileSync;
  const mocked = t.mock.method(fs, 'readFileSync', function (file, ...args) {
    const data = originalRead.call(this, file, ...args);
    if (afterCollection && typeof file === 'string' && path.resolve(file) === path.resolve(tree, 'same.md')) fs.writeFileSync(file, '# Still changing ' + 'x'.repeat(++grow));
    return data;
  });
  let grow = 0; afterCollection = false;
  const moving = backup.run(options);
  mocked.mock.restore();
  assert.equal(moving.status, 'failed'); assert.equal(moving.error, 'worktree-primary-source-changed-during-copy');
  assert.equal(moving.worktreePrimaryDrift.length, 1); assert.equal(moving.lastSuccessAt, both.lastSuccessAt);
});

// --- 10-19 실행 비용 줄이기: 읽기 기록, 폴더 단위 링크 확인, 공급자 상태 초점 ---
const readCache = require('../tools/onedrive-read-cache.cjs');
const sha = text => require('node:crypto').createHash('sha256').update(text).digest('hex');
const filesUnder = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
// 매 실행 1/48은 일부러 다시 읽는다. 시험은 이번에 다루는 파일이 하나도 그 몫에 들지 않는 시각을 고른다.
function clockOutsideRecheck(files, slots = readCache.SLOTS) {
  for (let k = 0; k < slots; k++) {
    const now = Date.now() + k * readCache.SLOT_MS, slot = readCache.currentSlot(now, slots);
    if (files.every(file => readCache.slotOf(file, slots) !== slot)) return () => now;
  }
  throw new Error('no-free-recheck-slot');
}
function countReads(t, roots) {
  const original = fs.readFileSync, seen = [];
  const prefixes = roots.map(root => path.resolve(root).toLowerCase() + path.sep);
  const mocked = t.mock.method(fs, 'readFileSync', function (file, ...args) {
    if (typeof file === 'string' && prefixes.some(prefix => path.resolve(file).toLowerCase().startsWith(prefix))) seen.push(path.resolve(file));
    return original.call(this, file, ...args);
  });
  return { seen, restore: () => mocked.mock.restore() };
}
function cachedRunFixture(t) {
  const f = fixture(t), tree = path.join(f.temp, 'worktree'), vault = path.join(f.temp, 'SYNK_원본창고');
  f.put(f.root, 'a.js', 'module.exports = 1;'); f.put(f.root, 'doc.md', '# Main'); f.put(f.root, 'same.md', '# Same');
  f.put(tree, 'doc.md', '# Worktree version'); f.put(tree, 'same.md', '# Same');
  const options = { ...f, checkProvider: healthy,
    getRows: () => ['a.js', 'doc.md', 'same.md'].map(source => ({ brand: 'SYNK', source, target: source, kind: 'system' })),
    collectWorktrees: (root, vaultDir, extra) => backup.preserveWorktreeDocuments(root, vaultDir, { ...extra,
      trees: [{ repository: 'SYNK-appsscript', primary: root, root: tree, changedSources: [] }] }) };
  // 원본·작업트리 문서·사본·보존 사본과 색인. 작업트리 제외 목록(excluded-protected-manifest.json)은 다른 단계가 매번 읽는 작은 기록이라 뺀다.
  const preserved = path.join(vault, '작업문서_미통합_자동');
  const watched = [f.root, tree, f.destination, ...['files', 'sources', 'manifests'].map(name => path.join(preserved, name))];
  const summary = () => backup.readJson(path.join(f.stateDir, 'copy-manifest.json')).files.map(({ source, sha256, expectedBytes }) => ({ source, sha256, expectedBytes }));
  return { f, tree, vault, options, watched, summary };
}

test('an intact read cache lets the next run skip rereading unchanged sources, worktree documents and copies (10-19)', t => {
  const { f, options, watched, summary } = cachedRunFixture(t);
  const first = backup.run(options);
  assert.equal(first.status, 'healthy'); assert.equal(first.readCache.saved, true); assert.equal(first.readCache.status, 'missing');
  assert.ok(first.worktrees.readFiles >= 2);
  const before = summary(), clock = clockOutsideRecheck(watched.flatMap(filesUnder));
  const reads = countReads(t, watched);
  const second = backup.run({ ...options, clock });
  reads.restore();
  assert.equal(second.status, 'healthy'); assert.equal(second.readCache.status, 'loaded');
  assert.deepEqual(reads.seen, [], 'unchanged files must not be opened again');
  assert.equal(second.worktrees.readFiles, 0); assert.deepEqual(summary(), before);
  assert.equal(second.copy.written, 0); assert.equal(second.copy.unchanged, 3);
  // 사본이 손상되면(수정 시각이 바뀐다) 다시 읽어 대조하고 원래 내용으로 고친다.
  const target = path.join(f.destination, 'SYNK/doc.md');
  fs.writeFileSync(target, '# Broken copy');
  const repaired = backup.run({ ...options, clock });
  assert.equal(repaired.status, 'healthy'); assert.equal(repaired.copy.written, 1);
  assert.equal(fs.readFileSync(target, 'utf8'), '# Main');
  // 원본이 바뀌면 그 파일만 다시 읽고 다시 분류한다. 비밀값이 들어가면 예전처럼 막는다.
  f.put(f.root, 'a.js', 'const pass' + 'word = "unreviewed-private-value";');
  const changedReads = countReads(t, [f.root]);
  const changed = backup.run({ ...options, clock });
  changedReads.restore();
  assert.ok(changedReads.seen.includes(path.join(f.root, 'a.js')));
  assert.ok(!changedReads.seen.includes(path.join(f.root, 'same.md')));
  assert.equal(changed.status, 'failed'); assert.equal(changed.error, 'previously-backed-source-now-protected');
  assert.equal(fs.readFileSync(path.join(f.destination, 'SYNK/a.js'), 'utf8'), 'module.exports = 1;');
});

test('a damaged, foreign or outdated read cache falls back to reading everything (10-19)', t => {
  const { f, options, watched, summary } = cachedRunFixture(t);
  assert.equal(backup.run(options).status, 'healthy');
  const before = summary(), cacheFile = path.join(f.stateDir, 'read-cache.json'), good = fs.readFileSync(cacheFile, 'utf8');
  const clock = clockOutsideRecheck(watched.flatMap(filesUnder));
  const damaged = [
    ['unreadable', '{"schemaVersion":1,"entr'],
    ['schema-mismatch', JSON.stringify({ ...JSON.parse(good), schemaVersion: 99 })],
    ['policy-changed', JSON.stringify({ ...JSON.parse(good), policyFingerprint: 'f'.repeat(64) })],
    ['invalid', JSON.stringify({ ...JSON.parse(good), entries: [] })],
  ];
  for (const [status, content] of damaged) {
    fs.writeFileSync(cacheFile, content);
    const reads = countReads(t, [f.root]);
    const result = backup.run({ ...options, clock });
    reads.restore();
    assert.equal(result.readCache.status, status, status);
    assert.equal(result.status, 'healthy', status); assert.deepEqual(summary(), before, status);
    for (const name of ['a.js', 'doc.md', 'same.md']) assert.ok(reads.seen.includes(path.join(f.root, name)), status + ' ' + name);
    assert.ok(result.worktrees.readFiles >= 2, status);
  }
  // 항목 하나의 모양이 틀리면 그 항목만 버리고 그 파일만 다시 읽는다.
  const parsed = JSON.parse(good), key = Object.keys(parsed.entries).find(file => file.endsWith(path.sep + 'a.js') && file.startsWith(f.root));
  parsed.entries[key] = ['not', 'an', 'entry'];
  fs.writeFileSync(cacheFile, JSON.stringify(parsed));
  const reads = countReads(t, [f.root]);
  const result = backup.run({ ...options, clock });
  reads.restore();
  assert.equal(result.readCache.status, 'loaded'); assert.equal(result.readCache.dropped, 1);
  assert.deepEqual(reads.seen, [path.join(f.root, 'a.js')]);
  assert.equal(result.status, 'healthy');
});

test('the daily recheck share rereads a file even when its stat matches and counts a hidden content change (10-19)', t => {
  const f = fixture(t), file = f.put(f.root, 'note.md', '# One'), cacheFile = path.join(f.stateDir, 'read-cache.json');
  const fingerprint = 'c'.repeat(64), stat = fs.statSync(file, { bigint: true }), mine = readCache.slotOf(file);
  const at = wantSlot => { for (let k = 0; k < readCache.SLOTS; k++) { const now = Date.now() + k * readCache.SLOT_MS; if ((readCache.currentSlot(now) === mine) === wantSlot) return now; } };
  const outside = at(false), inside = at(true);
  let cache = readCache.open(cacheFile, { fingerprint, now: outside });
  assert.equal(cache.status, 'missing');
  assert.equal(cache.remember(file, stat, stat, sha('# One'), 5, 'note.md', null), true);
  cache.save();
  // stat는 같은데 기록과 내용이 다른 경우(시각을 되돌린 변경 등)를 기록 쪽 SHA를 바꿔 만든다.
  const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); raw.entries[path.resolve(file)][1] = sha('# Two');
  fs.writeFileSync(cacheFile, JSON.stringify(raw));
  cache = readCache.open(cacheFile, { fingerprint, now: outside });
  assert.equal(cache.lookup(file, stat, 'note.md').sha256, sha('# Two'), 'outside its share the record is trusted');
  assert.equal(cache.lookup(file, stat, 'other/name.md'), null, 'a classification is reused only for the same path name');
  cache = readCache.open(cacheFile, { fingerprint, now: inside });
  assert.equal(cache.lookup(file, stat, 'note.md'), null, 'inside its share the file is read again');
  cache.remember(file, stat, stat, sha('# One'), 5, 'note.md', null);
  assert.equal(cache.summary().statInvisibleChanges, 1);
  assert.equal(cache.lookup(file, stat, 'note.md').sha256, sha('# One'), 'what this run read is trusted for the rest of the run');
  // 읽는 사이 stat가 바뀌면 기록하지 않는다. 분류 규칙이 실행 중 바뀌면 저장하지 않는다.
  const changed = { ...stat, mtimeNs: stat.mtimeNs + 1n };
  assert.equal(cache.remember(file, stat, changed, sha('# One'), 5, 'note.md', null), false);
  assert.deepEqual(cache.save('d'.repeat(64)), { saved: false, reason: 'policy-changed-during-run' });
  assert.throws(() => cache.lookup(file, fs.statSync(file), 'note.md'), /bigint/);
});

test('classifications that depend on the preserved-copy index are not remembered (10-19)', t => {
  const f = fixture(t), cacheFile = path.join(f.stateDir, 'read-cache.json');
  const file = f.put(f.root, '작업문서_미통합_자동/files/' + 'b'.repeat(64) + '.js', 'x'), stat = fs.statSync(file, { bigint: true });
  const cache = readCache.open(cacheFile, { fingerprint: 'e'.repeat(64) });
  const info = {};
  assert.equal(policy.textPolicy('작업문서_미통합_자동/files/' + 'b'.repeat(64) + '.js', Buffer.from('const api_' + 'key = "unreviewed-value";'), info), 'secret-literal');
  assert.equal(info.dependsOnIndex, true);
  cache.remember(file, stat, stat, sha('x'), 1, 'dependent', 'secret-literal', info);
  assert.equal(cache.lookup(file, stat, 'dependent'), null);
  assert.equal(cache.lookup(file, stat).sha256, sha('x'), 'the content hash itself is still remembered');
});

test('provider status rereads changed, pending, old and rotating copies and carries the rest with their observation time (10-19)', t => {
  const f = fixture(t), manifestFile = path.join(f.stateDir, 'copy-manifest.json'), output = path.join(f.stateDir, 'provider-run.json');
  const files = ['a', 'b', 'c', 'd', 'e'].map((name, i) => ({ source: path.join(f.root, name + '.md'), target: path.join(f.destination, 'SYNK', name + '.md'),
    expectedBytes: 10 + i, sha256: 'a'.repeat(64), targetModifiedMs: 1792395753196.5 + i, verifiedAt: '2026-10-19T00:00:00.000Z' }));
  backup.writeJson(manifestFile, { oneDriveRoot: f.destination, files });
  const slotOf = file => readCache.slotOf(file.target, 12);
  const pick = wanted => { for (let k = 0; k < 12; k++) { const now = Date.parse('2026-10-19T09:00:00Z') + k * readCache.SLOT_MS; if (wanted(Math.floor(now / readCache.SLOT_MS) % 12)) return now; } };
  const now = pick(slot => files.every(file => slot !== slotOf(file)));
  const observedAt = new Date(now - 3600000).toISOString();
  const row = (file, extra = {}) => ({ target: file.target, expectedBytes: file.expectedBytes, exists: true, bytes: file.expectedBytes, sizeMatches: true,
    attributes: 32, modifiedAt: new Date(file.targetModifiedMs).toISOString(), modifiedMs: file.targetModifiedMs, storageProviderState: 2,
    stateName: 'IN_SYNC', syncTransferStatus: null, error: null, observedAt, ...extra });
  const previous = { startedAt: observedAt, files: [row(files[0]), row(files[1], { modifiedMs: 1 }), row(files[2], { stateName: 'PENDING_UPLOAD' }),
    row(files[3], { observedAt: new Date(now - 7 * 3600000).toISOString() })] };
  const script = state => (input, out) => {
    const asked = backup.readJson(input).files;
    script.asked = asked.map(file => file.target);
    return { startedAt: new Date(now).toISOString(), oneDriveRoot: f.destination, files: asked.map(file => ({ target: file.target, expectedBytes: file.expectedBytes,
      exists: true, bytes: file.expectedBytes, sizeMatches: true, attributes: 32, modifiedAt: new Date(files.find(x => x.target === file.target).targetModifiedMs).toISOString(),
      stateName: state, error: null })) };
  };
  let runner = script('IN_SYNC');
  const report = backup.providerStatus(manifestFile, output, { previous, now, runScript: runner });
  assert.deepEqual(script.asked.sort(), files.slice(1).map(file => file.target).sort());
  assert.equal(report.inspected, 5); assert.equal(report.freshlyInspected, 4); assert.equal(report.carriedOver, 1);
  assert.equal(report.files.find(r => r.target === files[0].target).observedAt, observedAt);
  assert.equal(report.oldestObservedAt, observedAt);
  assert.equal(backup.classifyProvider(report), 'healthy');
  assert.deepEqual(backup.readJson(output).stateCounts, { IN_SYNC: 5 });
  assert.deepEqual(fs.readdirSync(f.stateDir).sort(), ['copy-manifest.json', 'provider-run.json'], 'the subset input and raw output are not left behind');
  // 새로 본 사본이 대기 중이면 합친 결과도 대기다. 옮긴 관찰이 성공을 대신하지 않는다.
  assert.equal(backup.classifyProvider(backup.providerStatus(manifestFile, output, { previous, now, runScript: script('PENDING_UPLOAD') })), 'pending');
  assert.equal(backup.classifyProvider(backup.providerStatus(manifestFile, output, { previous, now, runScript: script('ERROR') })), 'failed');
  // 다음 실행: 방금 본 것은 그대로면 옮기고, 볼 것이 없으면 PowerShell을 부르지 않는다. 돌아가는 몫에 들면 다시 본다.
  const fresh = backup.providerStatus(manifestFile, output, { previous, now, runScript: script('IN_SYNC') });
  const calm = backup.providerStatus(manifestFile, output, { previous: fresh, now: now + 60000, runScript: () => { throw new Error('nothing-should-be-inspected'); } });
  assert.equal(calm.freshlyInspected, 0); assert.equal(calm.carriedOver, 5); assert.equal(backup.classifyProvider(calm), 'healthy');
  const rotating = pick(slot => slot === slotOf(files[0]));
  runner = script('IN_SYNC');
  const turn = backup.providerStatus(manifestFile, output, { previous: fresh, now: rotating, runScript: runner });
  assert.ok(script.asked.includes(files[0].target)); assert.ok(turn.freshlyInspected >= 1);
  // 6.5시간이 지나면 모두 다시 본다.
  runner = script('IN_SYNC');
  backup.providerStatus(manifestFile, output, { previous: fresh, now: now + 7 * 3600000, runScript: runner });
  assert.equal(script.asked.length, 5);
});

test('the folder-listing link check over many paths still blocks a junction like the per-path check (10-19)', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(t), outside = path.join(f.temp, 'outside');
  f.put(outside, 'docs/plan.md', '# outside');
  const files = [];
  for (let i = 0; i < 1100; i++) files.push(f.put(f.root, `docs/d${i % 40}/f${i}.md`, '# ' + i));
  fs.symlinkSync(outside, path.join(f.root, 'linked'), 'junction');
  const through = path.join(f.root, 'linked', 'docs', 'plan.md');
  const many = policy.linkPaths([...files, through]), few = policy.linkPaths([files[0], through]);
  assert.equal(many(through), true); assert.equal(few(through), true);
  assert.equal(files.filter(file => many(file)).length, 0);
  assert.equal(policy.linkPaths([through], { cloudDestinationRoot: f.root })(through), true, 'destination mode blocks a junction too');
  assert.deepEqual(fs.readdirSync(path.join(outside, 'docs')), ['plan.md']);
});

test('a planned file that turns unsafe or disappears before copying is skipped and counted, never copied (10-19)', t => {
  const f = fixture(t), names = ['safe.js', 'turns-secret.js', 'gone.md'];
  for (const name of names) f.put(f.root, name, 'module.exports = 1;');
  const plan = policy.oneDrivePlan(f.root, names.map(source => ({ brand: 'SYNK', source, target: source, kind: 'system' })));
  assert.equal(plan.selected.length, 3);
  f.put(f.root, 'turns-secret.js', 'const pass' + 'word = "unreviewed-private-value";');
  fs.unlinkSync(path.join(f.root, 'gone.md'));
  const result = policy.copy(f.root, f.destination, plan.selected, { recordFiles: true, prePlanned: true });
  assert.equal(result.written, 1); assert.equal(result.skipped, 1); assert.equal(result.disappeared, 1);
  assert.deepEqual(result.rejected.map(row => [row.source, row.reason]), [['turns-secret.js', 'secret-literal']]);
  assert.equal(fs.existsSync(path.join(f.destination, 'SYNK/turns-secret.js')), false);
  // prePlanned 없이 부르면 예전처럼 복사 안에서 목록을 다시 만들어 같은 파일을 건너뛴다.
  const legacy = policy.copy(f.root, f.destination, plan.selected.filter(row => row.source !== 'gone.md'), { recordFiles: true });
  assert.equal(legacy.skipped, 1); assert.equal(legacy.written, 0); assert.equal(legacy.unchanged, 1);
});

test('copies still uploading are looked at again for a bounded time, and only they are (10-19)', t => {
  const f = fixture(t), manifestFile = path.join(f.stateDir, 'copy-manifest.json'), output = path.join(f.stateDir, 'provider-settle.json');
  const files = ['a', 'b', 'c'].map((name, i) => ({ source: path.join(f.root, name + '.md'), target: path.join(f.destination, 'SYNK', name + '.md'),
    expectedBytes: 5 + i, sha256: 'a'.repeat(64), targetModifiedMs: 1792395753196 + i, verifiedAt: '2026-10-19T00:00:00.000Z' }));
  backup.writeJson(manifestFile, { oneDriveRoot: f.destination, files });
  // 매번 모든 사본을 새로 보도록 직전 관찰 없이 시작한다. 첫 확인에서 b는 올리는 중, c는 오류다.
  const states = [{ b: 'PENDING_UPLOAD', c: 'ERROR' }, { b: 'IN_SYNC' }], asked = [];
  let round = 0, now = Date.parse('2026-10-19T10:00:00Z');
  const runScript = input => {
    const wanted = backup.readJson(input).files, state = states[Math.min(round++, states.length - 1)];
    asked.push(wanted.map(file => path.basename(file.target)).sort());
    return { startedAt: new Date(now).toISOString(), oneDriveRoot: f.destination, files: wanted.map(file => ({ target: file.target, expectedBytes: file.expectedBytes,
      exists: true, bytes: file.expectedBytes, sizeMatches: true, modifiedAt: new Date(files.find(x => x.target === file.target).targetModifiedMs).toISOString(),
      stateName: state[path.basename(file.target, '.md')] || 'IN_SYNC', error: null })) };
  };
  const sleeps = [], clock = () => now, sleep = ms => { sleeps.push(ms); now += ms; };
  const settled = backup.providerStatus(manifestFile, output, { now, runScript, clock, sleep, settleUntil: now + 5 * 60 * 1000 });
  assert.deepEqual(asked, [['a.md', 'b.md', 'c.md'], ['b.md']], 'only the copy still uploading is asked again; an error is not waited on');
  assert.deepEqual(sleeps, [20000]); assert.equal(settled.settleRounds, 1);
  assert.equal(settled.files.find(row => row.target === files[1].target).stateName, 'IN_SYNC');
  assert.equal(settled.files.find(row => row.target === files[1].target).observedAt, new Date(now).toISOString(), 'the later observation time is kept');
  assert.equal(backup.classifyProvider(settled), 'failed', 'the error copy still fails the run');
  // 기한 안에 끝나지 않으면 그대로 대기로 남긴다. 기한이 지났으면 기다리지 않는다.
  states.splice(0, states.length, { a: 'PENDING_UPLOAD' }); round = 0; asked.length = 0; sleeps.length = 0;
  const pending = backup.providerStatus(manifestFile, output, { now, runScript, clock, sleep, settleUntil: now + 45 * 1000 });
  assert.equal(pending.settleRounds, 2); assert.deepEqual(sleeps, [20000, 20000]);
  assert.equal(backup.classifyProvider(pending), 'pending');
  round = 0; sleeps.length = 0;
  const late = backup.providerStatus(manifestFile, output, { now, runScript, clock, sleep, settleUntil: now - 1 });
  assert.equal(late.settleRounds, 0); assert.deepEqual(sleeps, []); assert.equal(backup.classifyProvider(late), 'pending');
});

test('provider status is read in batches with progress after each, growing while fast and shrinking while slow (10-20)', t => {
  const f = fixture(t), manifestFile = path.join(f.stateDir, 'copy-manifest.json'), output = path.join(f.stateDir, 'provider-batches.json');
  const files = Array.from({ length: 1200 }, (_, i) => ({ source: path.join(f.root, 'f' + i + '.md'), target: path.join(f.destination, 'SYNK', 'f' + i + '.md'),
    expectedBytes: 3, sha256: 'a'.repeat(64), targetModifiedMs: 1792395753196 + i, verifiedAt: '2026-10-20T00:00:00.000Z' }));
  backup.writeJson(manifestFile, { oneDriveRoot: f.destination, files });
  const modified = new Map(files.map(file => [file.target, file.targetModifiedMs]));
  let now = Date.parse('2026-10-20T06:00:00Z');
  const sizes = [], beats = [];
  // 두 번째 묶음만 5분이 걸린다(부하). 나머지는 10초.
  const runScript = input => {
    const wanted = backup.readJson(input).files;
    sizes.push(wanted.length);
    now += sizes.length === 2 ? 5 * 60 * 1000 : 10 * 1000;
    return { startedAt: new Date(now).toISOString(), oneDriveRoot: f.destination, files: wanted.map(file => ({ target: file.target, expectedBytes: file.expectedBytes,
      exists: true, bytes: file.expectedBytes, sizeMatches: true, modifiedAt: new Date(modified.get(file.target)).toISOString(), stateName: 'IN_SYNC', error: null })) };
  };
  const report = backup.providerStatus(manifestFile, output, { now, runScript, clock: () => now, onProgress: () => beats.push(sizes.length) });
  assert.deepEqual(sizes, [250, 500, 250, 200], 'doubles after a fast batch, halves after a slow one');
  assert.deepEqual(beats, [1, 2, 3, 4], 'progress after every batch');
  assert.equal(report.inspected, 1200); assert.equal(report.freshlyInspected, 1200);
  assert.equal(new Set(report.files.map(row => row.target)).size, 1200);
  assert.equal(backup.classifyProvider(report), 'healthy');
  assert.deepEqual(fs.readdirSync(f.stateDir).sort(), ['copy-manifest.json', 'provider-batches.json'], 'no batch input or raw output is left behind');
});

test('listing and classification report progress so a slow walk still refreshes the run heartbeat (10-20)', t => {
  const f = fixture(t);
  for (let i = 0; i < 5; i++) f.put(f.root, 'docs/d' + i + '/a.md', '# a');
  let walked = 0, planned = 0;
  const found = policy.workTextFiles(f.root, undefined, () => walked++);
  assert.equal(found.length, 5); assert.equal(walked, 7, 'root, docs and each of the five folders');
  policy.oneDrivePlan(f.root, found.map(source => ({ brand: 'SYNK', source, target: source, kind: 'system' })), { onProgress: () => planned++ });
  assert.equal(planned, 5);
  // 실행은 목록·분류에 heartbeat를 넘긴다. 목록 안의 진행만으로도 영수증이 다시 쓰인다.
  let now = Date.now(), seen = null;
  const latest = () => backup.readJson(path.join(f.stateDir, 'latest.json'));
  const result = backup.run({ ...f, clock: () => (now += 61 * 1000), heartbeatEveryMs: 60 * 1000, checkProvider: healthy, collectWorktrees: () => ({}),
    getRows: (root, options) => {
      const before = latest().heartbeatAt;
      options.onProgress();
      seen = [before, latest().heartbeatAt];
      return found.map(source => ({ brand: 'SYNK', source, target: source, kind: 'system' }));
    } });
  assert.equal(result.status, 'healthy');
  assert.ok(seen && seen[1] > seen[0], 'a progress call inside the listing refreshed the receipt');
});

test('the read-cache fingerprint follows the classification code, not unrelated edits in the same file (10-19)', t => {
  const f = fixture(t), tools = path.join(__dirname, '../tools');
  const load = (name, edit) => {
    const dir = path.join(f.temp, name), original = fs.readFileSync(path.join(tools, '이어하기꾸러미.js'), 'utf8'), changed = edit(original);
    if (edit !== same) assert.notEqual(changed, original, name + ' edit must apply');
    fs.mkdirSync(dir);
    for (const file of ['github-backup-reviewed-literals.json', 'onedrive-reviewed-literals.json']) fs.copyFileSync(path.join(tools, file), path.join(dir, file));
    fs.writeFileSync(path.join(dir, 'policy.js'), changed);
    return require(path.join(dir, 'policy.js')).POLICY_FINGERPRINT;
  };
  const same = text => text;
  const base = load('base', same);
  assert.equal(base, policy.POLICY_FINGERPRINT);
  assert.equal(load('scope', text => text.replace("names = new Set(['SYNK-appsscript',", "names = new Set(['SYNK-appsscript', 'added-scope',")), base,
    'a scope rule edit keeps the cache');
  assert.notEqual(load('classify', text => text.replace("if (금지인가(source)) return 'credential-path';", "if (금지인가(source)) return 'credential-path'; // changed")), base,
    'a classification edit drops the cache');
  assert.notEqual(load('literals', text => text.replace("require('./onedrive-reviewed-literals.json').entries", "require('./onedrive-reviewed-literals.json').entries.slice(1)")), base,
    'a reviewed-list change drops the cache');
});

test('a worktree-level memo is reused only for the same input key and survives a save (10-19)', t => {
  const f = fixture(t), cacheFile = path.join(f.stateDir, 'read-cache.json'), fingerprint = '7'.repeat(64);
  let cache = readCache.open(cacheFile, { fingerprint });
  assert.equal(cache.memo('worktree-sources:x', 'k1'), null);
  assert.equal(cache.setMemo('worktree-sources:x', 'k1', ['a.js', 'b/c.js']), true);
  cache.save();
  cache = readCache.open(cacheFile, { fingerprint });
  assert.deepEqual(cache.memo('worktree-sources:x', 'k1'), ['a.js', 'b/c.js']);
  assert.equal(cache.memo('worktree-sources:x', 'k2'), null, 'a different input key is a miss');
  const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); raw.memos['worktree-sources:x'] = ['k1', 'not-a-list', 1];
  fs.writeFileSync(cacheFile, JSON.stringify(raw));
  cache = readCache.open(cacheFile, { fingerprint });
  assert.equal(cache.memo('worktree-sources:x', 'k1'), null); assert.equal(cache.dropped, 1);
  assert.equal(readCache.open(cacheFile, { fingerprint: '8'.repeat(64) }).memo('worktree-sources:x', 'k1'), null, 'another policy drops memos too');
});

test('an unchanged worktree reuses its last git result and any file, index or head change runs git again (10-19)', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(t), tree = path.join(f.temp, 'git-worktree'), vault = path.join(f.temp, 'vault'), cacheFile = path.join(f.stateDir, 'read-cache.json');
  const { execFileSync } = require('node:child_process');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, windowsHide: true, stdio: 'pipe', encoding: 'utf8' });
  git(f.root, 'init', '-q');
  f.put(f.root, 'app.js', 'const version = 1;'); f.put(f.root, 'docs/plan.md', '# Plan');
  git(f.root, 'add', '.'); git(f.root, '-c', 'user.name=Backup Test', '-c', 'user.email=backup@example.invalid', 'commit', '-qm', 'fixture');
  git(f.root, 'worktree', 'add', '-q', '--detach', tree);
  f.put(tree, 'app.js', 'const version = 2;');
  const trees = [{ repository: 'SYNK-appsscript', primary: f.root, root: tree }];
  // 하루 한 바퀴 git을 다시 돌리는 몫에 이 작업트리가 들지 않는 시각을 고른다.
  const now = (() => { for (let k = 0; k < readCache.SLOTS; k++) { const at = Date.now() + k * readCache.SLOT_MS; if (readCache.slotOf(tree) !== readCache.currentSlot(at)) return at; } })();
  const collect = () => {
    const cache = readCache.open(cacheFile, { fingerprint: policy.POLICY_FINGERPRINT, now });
    const report = backup.preserveWorktreeDocuments(f.root, vault, { trees, cache, dryRun: true });
    cache.save();
    return report;
  };
  const first = collect();
  assert.equal(first.gitTrees, 1); assert.equal(first.reusedTrees, 0); assert.equal(first.sourceFiles, 1); assert.equal(first.documents, 1);
  const second = collect();
  assert.equal(second.gitTrees, 0); assert.equal(second.reusedTrees, 1); assert.equal(second.sourceFiles, 1);
  f.put(tree, 'new tool.js', 'const added = true;');
  const added = collect();
  assert.equal(added.gitTrees, 1, 'a new untracked file is seen'); assert.equal(added.sourceFiles, 2);
  assert.equal(collect().reusedTrees, 1);
  fs.writeFileSync(path.join(tree, 'app.js'), 'const version = 3;  ');
  assert.equal(collect().gitTrees, 1, 'an edited file is seen');
  assert.equal(collect().reusedTrees, 1);
  git(tree, 'add', 'app.js');
  assert.equal(collect().gitTrees, 1, 'an index change runs git again');
  git(tree, '-c', 'user.name=Backup Test', '-c', 'user.email=backup@example.invalid', 'commit', '-qm', 'worktree commit');
  const committed = collect();
  assert.equal(committed.gitTrees, 1, 'a new worktree head runs git again');
  f.put(f.root, 'app.js', 'const version = 2;  '); f.put(f.root, 'main only.js', 'const main = true;'); git(f.root, 'add', '.');
  git(f.root, '-c', 'user.name=Backup Test', '-c', 'user.email=backup@example.invalid', 'commit', '-qm', 'main moves');
  // 본진 HEAD만 움직이면 작업트리를 걷는 status는 다시 쓰고, 커밋 트리끼리 비교만 다시 한다.
  const moved = collect();
  assert.equal(moved.gitTrees, 1, 'a new main head runs the tree diff again');
  assert.equal(moved.statusRuns, 0); assert.equal(moved.diffRuns, 1);
  assert.equal(collect().reusedTrees, 1);
  assert.deepEqual(backup.changedWorktreeSources(trees[0]).sort(), ['app.js', 'new tool.js'], 'the memo path keeps the same sources as git');
});

test('a receipt or read-cache rename that Windows briefly refuses is retried, other errors still stop (10-19)', t => {
  const f = fixture(t), file = path.join(f.stateDir, 'latest.json'), original = fs.renameSync;
  let refusals = 2;
  const mocked = t.mock.method(fs, 'renameSync', function (from, to, ...rest) {
    if (refusals > 0 && path.resolve(to).startsWith(path.resolve(f.stateDir))) { refusals--; throw Object.assign(new Error('busy'), { code: 'EPERM' }); }
    return original.call(this, from, to, ...rest);
  });
  backup.writeJson(file, { status: 'healthy' });
  assert.equal(refusals, 0); assert.equal(backup.readJson(file).status, 'healthy');
  refusals = 1;
  const cache = readCache.open(path.join(f.stateDir, 'read-cache.json'), { fingerprint: '9'.repeat(64) });
  assert.equal(cache.save().saved, true); assert.equal(refusals, 0);
  mocked.mock.restore();
  const failing = t.mock.method(fs, 'renameSync', () => { throw Object.assign(new Error('gone'), { code: 'ENOENT' }); });
  assert.throws(() => backup.writeJson(file, { status: 'x' }), /gone/);
  failing.mock.restore();
});

test('a whole run still records its result when every receipt and provider rename is briefly refused (10-19)', t => {
  const { f, options } = cachedRunFixture(t);
  const latest = path.resolve(f.stateDir, 'latest.json'), providerLatest = path.resolve(f.stateDir, 'provider-latest.json'), original = fs.renameSync;
  // 통합 감시가 영수증을 읽는 순간처럼 latest.json·provider-latest.json으로 바꿀 때마다 두 번씩 거절한다.
  // 다시 하지 않으면 시작 영수증에서 실행이 멈추고, 실패 영수증도 못 써 예외가 밖으로 나간다.
  let attempts = 0;
  t.mock.method(fs, 'renameSync', function (from, to, ...rest) {
    if ([latest, providerLatest].includes(path.resolve(to)) && attempts++ % 3 < 2) throw Object.assign(new Error('busy'), { code: 'EPERM' });
    return original.call(this, from, to, ...rest);
  });
  const checkProvider = (manifestFile, output) => { backup.writeJson(output, healthy()); return healthy(); };
  const result = backup.run({ ...options, checkProvider });
  assert.equal(result.status, 'healthy', result.error);
  const receipt = backup.readJson(latest);
  assert.equal(receipt.status, 'healthy'); assert.equal(receipt.runId, result.runId);
  assert.deepEqual(backup.readJson(providerLatest), healthy());
  assert.ok(attempts >= 9 && attempts % 3 === 0, 'the start receipt, provider report and final receipt each landed on the third try');
  assert.deepEqual(fs.readdirSync(f.stateDir).filter(name => name.endsWith('.tmp')), [], 'no temporary file is left behind');
});

test('the worktree listing runs in batches with a heartbeat after each, small while slow and growing while fast (10-20)', () => {
  const trees = Array.from({ length: 30 }, (_, i) => ({ root: 'C:\\wt\\' + i }));
  let now = 0;
  const asked = [], beats = [];
  // 처음 두 묶음은 작업트리 하나에 30초(부하 속), 그 뒤는 1초가 걸린다고 친다.
  const runScan = roots => {
    asked.push(roots.length);
    now += roots.length * (asked.length <= 2 ? 30000 : 1000);
    return roots.map(root => ({ root, fingerprint: 'a'.repeat(64), files: 1, md: [] }));
  };
  const scans = backup.scanWorktrees(trees, { runScan, clock: () => now, onProgress: () => beats.push(now) });
  assert.deepEqual(asked, [4, 4, 4, 8, 10], 'slow batches stay at four trees, fast ones double');
  assert.deepEqual(beats, [120000, 240000, 244000, 252000, 262000], 'a heartbeat chance after every batch');
  assert.equal(scans.size, 30);
  // 실패한 묶음과 오류 줄은 그 작업트리만 빠진다(빠진 작업트리는 예전처럼 걷고 git을 돌린다).
  let call = 0;
  const flaky = roots => {
    call++;
    if (call === 2) throw new Error('pwsh failed');
    return roots.map(root => root === 'C:\\wt\\0' ? { root, error: 'UnauthorizedAccessException' } : { root, fingerprint: 'b'.repeat(64), files: 1, md: [] });
  };
  const partial = backup.scanWorktrees(trees.slice(0, 12), { runScan: flaky, clock: () => 0 });
  assert.deepEqual([...partial.keys()], ['C:\\wt\\1', 'C:\\wt\\2', 'C:\\wt\\3']);
  assert.equal(backup.scanWorktrees([], { runScan: () => { throw new Error('not called'); } }), null);
});
