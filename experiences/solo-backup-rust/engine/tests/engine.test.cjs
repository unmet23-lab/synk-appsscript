'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { BackupEngine, VERIFIED, DAY } = require('../src/engine.cjs');
const { overlap, directory } = require('../src/paths.cjs');
const resticPath = process.env.SOLO_BACKUP_RESTIC;
const key = crypto.randomBytes(32);
// Test-only secret store: production uses Windows DPAPI through Electron safeStorage.
const secretStore = {
  encrypt(value) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key, iv); return Buffer.concat([iv, c.update(value), c.final(), c.getAuthTag()]); },
  decrypt(value) { const d = crypto.createDecipheriv('aes-256-gcm', key, value.subarray(0, 12)); d.setAuthTag(value.subarray(-16)); return Buffer.concat([d.update(value.subarray(12, -16)), d.final()]).toString(); }
};
async function files(root) { const result = []; for (const entry of await fs.readdir(root, { withFileTypes: true })) { const p = path.join(root, entry.name); if (entry.isDirectory()) result.push(...await files(p)); else result.push(p); } return result; }
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

test('real Windows restic: backup, changed files, new-PC recovery, failure preservation and exact retention', { skip: !resticPath, timeout: process.env.SOLO_BACKUP_SLOW_TEST === '1' ? 900000 : 300000 }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-backup-functional-'));
  const source = path.join(root, '작업 자료'); const target = path.join(root, '백업'); const keys = path.join(root, '별도 복구키'); const restore = path.join(root, '복구 결과');
  await Promise.all([source, target, keys, restore].map(p => fs.mkdir(p)));
  const content = { '한글 문서.txt': Buffer.from('업무 자료 첫 번째 판'), 'empty.txt': Buffer.alloc(0), 'binary.dat': crypto.randomBytes(12345) };
  for (const [name, data] of Object.entries(content)) await fs.writeFile(path.join(source, name), data);
  let clock = Date.now();
  const engine = new BackupEngine({ stateDir: path.join(root, 'state'), resticPath, secretStore, now: () => clock });
  await engine.open();
  await t.test('source/repository overlaps are rejected before repository creation', async () => {
    await assert.rejects(engine.setup({ sources: [source], parent: source }), /겹칩니다/);
    assert.equal(engine.config, null);
  });
  await engine.setup({ sources: [source], parent: target });
  await t.test('recovery key is mandatory and never in settings', async () => {
    await assert.rejects(engine.backupNow(), /복구 키/);
    await assert.rejects(engine.setAutomatic(true), /복구 키/);
    await assert.rejects(engine.saveRecoveryKit(path.join(source, 'bad.json')), /분리/);
    await engine.saveRecoveryKit(path.join(keys, 'kit.json'));
    const settings = await fs.readFile(path.join(root, 'state', 'settings.json'), 'utf8');
    assert.ok(!settings.includes(engine.secret));
    const credential = await fs.readFile(path.join(root, 'state', 'credential.bin'));
    assert.ok(!credential.includes(Buffer.from(engine.secret)));
    await assert.rejects(engine.saveRecoveryKit(path.join(keys, 'kit.json')), /다른 이름/);
  });
  await engine.backupNow();
  await t.test('lost local credential can be reconnected using the matching recovery kit', async () => {
    const connected = new BackupEngine({ stateDir: path.join(root, 'state'), resticPath, secretStore: { ...secretStore, decrypt() { throw new Error('DPAPI failed'); } } });
    await assert.rejects(connected.open(), e => e.code === 'RECOVERY_REQUIRED');
    const kitText = await fs.readFile(path.join(keys, 'kit.json'), 'utf8');
    await connected.recoverCredential(kitText); await connected.identity();
    assert.equal(connected.secret, engine.secret);
  });
  const initial = engine.config.lastBackup.id;
  assert.equal(engine.config.health.status, 'ok');
  assert.equal(engine.config.lastBackup.files, 3);
  await t.test('sample check decrypts a real saved file with no plaintext temporary file or persisted content hash', async () => {
    const { selectSample, consumeSample } = require('../src/probe.cjs');
    assert.equal(engine.config.lastProbe.result, 'passed');
    assert.equal(engine.config.lastProbe.snapshotId, initial);
    const before = await fs.readdir(path.join(engine.stateDir, 'temp'));
    await engine.probeRestore();
    assert.equal(engine.config.lastProbe.files, 1);
    assert.deepEqual(await fs.readdir(path.join(engine.stateDir, 'temp')), before);
    assert.ok(!JSON.stringify(engine.config.lastProbe).includes('sha256'));
    let sample, observed;
    await engine.run(['ls', '--json', '--recursive', initial], { consumeStdout: async input => { sample = await selectSample(input, initial); } });
    await engine.run(['dump', initial, sample.path], { consumeStdout: async input => { observed = await consumeSample(input, sample.size); } });
    assert.equal(observed.sha256, digest(content[path.posix.basename(sample.path)]));
    assert.equal(observed.bytes, sample.size);
  });
  await t.test('restore never overwrites originals and exact byte hashes match', async () => {
    await assert.rejects(engine.restoreLatest({ parent: source }), /분리/);
    await engine.restoreLatest({ parent: restore });
    const restored = await files(engine.config.lastRestore.path);
    for (const [name, data] of Object.entries(content)) {
      const p = restored.find(f => path.basename(f) === name); assert.ok(p, name);
      assert.equal(digest(await fs.readFile(p)), digest(data));
      assert.equal(digest(await fs.readFile(path.join(source, name))), digest(data));
    }
  });
  const pinnedCatalog = await engine.openFileCatalog();
  const pinnedFile = engine.queryFileCatalog({ token: pinnedCatalog.token, query: '한글 문서', offset: 0 }).rows[0];
  engine.setFileSelection({ token: pinnedCatalog.token, revision: 0, action: 'add', ids: [pinnedFile.id] });
  const pinnedContents = Buffer.from(content['한글 문서.txt']);
  await t.test('changed and deleted source files produce a new latest backup; grace copy remains', async () => {
    content['한글 문서.txt'] = Buffer.from('수정한 두 번째 판 · 더욱 긴 내용');
    await fs.writeFile(path.join(source, '한글 문서.txt'), content['한글 문서.txt']);
    await fs.unlink(path.join(source, 'empty.txt'));
    await engine.backupNow();
    assert.notEqual(engine.config.lastBackup.id, initial);
    assert.equal((await engine.snapshots([VERIFIED])).length, 2);
    await engine.restoreSelected({ token: pinnedCatalog.token, revision: 1, parent: restore });
    const picked = await files(engine.config.lastSelectedRestore.path);
    assert.equal(engine.config.lastSelectedRestore.files, 1);
    assert.equal(digest(await fs.readFile(picked.find(f => path.basename(f) === '한글 문서.txt'))), digest(pinnedContents));
    assert.ok(!picked.some(f => path.basename(f) === 'binary.dat'));
    assert.equal(digest(await fs.readFile(path.join(source, '한글 문서.txt'))), digest(content['한글 문서.txt']));
    // Exercise the real spawned restic exit/consumer ordering, not only a
    // runner stub: a missing literal path exits nonzero; a truncated consumer
    // still lets restic exit zero and must fail the post-exit size check.
    const run = engine.run, priorSelected = { ...engine.config.lastSelectedRestore };
    engine.run = function(args, options) { return run.call(this, args[0] === 'dump' ? [args[0], args[1], '/__not_in_snapshot__'] : args, options); };
    try { await assert.rejects(engine.restoreSelected({ token: pinnedCatalog.token, revision: 1, parent: restore }), e => e.code === 'RESTORE_INCOMPLETE'); }
    finally { engine.run = run; }
    assert.equal(engine.config.health.status, 'ok'); assert.deepEqual(engine.config.lastSelectedRestore, priorSelected);
    engine.run = function(args, options) {
      if (args[0] !== 'dump') return run.call(this, args, options);
      const { Transform } = require('node:stream'), { pipeline } = require('node:stream/promises');
      let tail = Buffer.alloc(0);
      const truncate = new Transform({ transform(chunk, _encoding, done) { const data = Buffer.concat([tail, chunk]); tail = data.subarray(-1); done(null, data.subarray(0, -1)); }, flush(done) { done(); } });
      return run.call(this, args, { ...options, consumeStdout: input => pipeline(input, truncate, async stream => options.consumeStdout(stream)) });
    };
    try { await assert.rejects(engine.restoreSelected({ token: pinnedCatalog.token, revision: 1, parent: restore }), e => e.code === 'INTEGRITY_FAILED'); }
    finally { engine.run = run; }
    assert.equal(engine.config.health.status, 'attention'); assert.deepEqual(engine.config.lastSelectedRestore, priorSelected);
    await engine.checkRepository();
    await engine.probeRestore(); assert.equal(engine.config.lastProbe.snapshotId, engine.config.lastBackup.id);
    await engine.restoreLatest({ parent: restore });
    const restored = await files(engine.config.lastRestore.path);
    assert.ok(!restored.some(f => path.basename(f) === 'empty.txt'));
    assert.equal(digest(await fs.readFile(restored.find(f => path.basename(f) === '한글 문서.txt'))), digest(content['한글 문서.txt']));
  });
  const lastGood = engine.config.lastBackup.id;
  await t.test('missing source, partial exit and check failure never replace last complete backup', async () => {
    const run = engine.run;
    engine.config.sources = [path.join(root, 'missing')];
    await assert.rejects(engine.backupNow(), /ENOENT/); assert.equal(engine.config.lastBackup.id, lastGood);
    engine.config.sources = [source];
    engine.run = async function (args, options) { const output = await run.call(this, args, options); if (args[0] === 'backup') { const e = new Error('일부 파일을 읽지 못했습니다.'); e.exitCode = 3; throw e; } return output; };
    await assert.rejects(engine.backupNow(), /일부 파일/); assert.equal(engine.config.lastBackup.id, lastGood);
    engine.run = async function (args, options) { if (args[0] === 'check') throw new Error('simulated failed structural check'); return run.call(this, args, options); };
    await assert.rejects(engine.backupNow(), /failed structural/); assert.equal(engine.config.lastBackup.id, lastGood);
    assert.equal(engine.config.health.status, 'attention');
    await assert.rejects(engine.retain(), /정리할 수 없습니다/);
    engine.run = run;
  });
  await t.test('repository substitution and wrong recovery key are rejected without changing state', async () => {
    const id = engine.config.repositoryId; engine.config.repositoryId = '0'.repeat(64);
    await assert.rejects(engine.restoreLatest({ parent: restore }), /다른 저장소/); engine.config.repositoryId = id;
    const other = new BackupEngine({ stateDir: path.join(root, 'new-pc-wrong'), resticPath, secretStore }); await other.open();
    const kit = JSON.parse(await fs.readFile(path.join(keys, 'kit.json'), 'utf8')); kit.password = crypto.randomBytes(32).toString('base64url');
    await assert.rejects(other.importRecoveryKit({ text: JSON.stringify(kit), repository: engine.config.repository }), /복구 키|password/i);
    assert.equal(other.config, null);
  });
  await t.test('new-PC import restores without local settings and cannot prune or auto-backup', async () => {
    const other = new BackupEngine({ stateDir: path.join(root, 'new-pc'), resticPath, secretStore }); await other.open();
    await other.importRecoveryKit({ text: await fs.readFile(path.join(keys, 'kit.json'), 'utf8'), repository: engine.config.repository });
    assert.equal(other.config.mode, 'restore');
    await assert.rejects(other.setAutomatic(true), /설정할 수 없습니다/);
    await assert.rejects(other.retain(), /정리할 수 없습니다/);
    await other.restoreLatest({ parent: path.join(root, '복구 결과') });
    assert.ok((await files(other.config.lastRestore.path)).some(f => path.basename(f) === 'binary.dat'));
    const catalog = await other.openFileCatalog();
    other.setFileSelection({ token: catalog.token, revision: 0, action: 'all', query: 'binary.dat' });
    await other.restoreSelected({ token: catalog.token, revision: 1, parent: restore });
    assert.equal(other.config.lastSelectedRestore.files, 1);
    assert.equal(digest(await fs.readFile((await files(other.config.lastSelectedRestore.path)).find(f => path.basename(f) === 'binary.dat'))), digest(content['binary.dat']));
  });
  await t.test('failed restore immediately revokes health and prevents retention', async () => {
    const run = engine.run;
    for (const failed of ['ls', 'dump']) {
      await engine.checkRepository();
      engine.run = async function(args, options) { if (args[0] === failed) throw new Error('simulated corrupted repository data'); return run.call(this,args,options); };
      await assert.rejects(engine.restoreLatest({ parent: restore }), /corrupted repository/);
      assert.equal(engine.config.health.status, 'attention'); await assert.rejects(engine.retain(), /정리할 수 없습니다/);
      engine.run = run;
    }
    await engine.checkRepository();
    const before = await fs.readdir(restore);
    engine.run = async function(args, options) {
      if (args[0] === 'ls') return options.consumeStdout(require('node:stream').Readable.from([
        Buffer.from(JSON.stringify({ message_type: 'snapshot' }) + '\n' + JSON.stringify({ message_type: 'node', path: '/unsupported-link', type: 'symlink' }) + '\n')
      ]));
      return run.call(this, args, options);
    };
    await assert.rejects(engine.restoreLatest({ parent: restore }), /연결·특수 파일/);
    assert.equal(engine.config.health.status, 'attention'); await assert.rejects(engine.retain(), /정리할 수 없습니다/);
    assert.deepEqual(await fs.readdir(restore), before);
    engine.run = run;
  });
  await t.test('multiple source folders and hardlinks recover as independent readable files without an archive', async () => {
    const second = path.join(root, '두 번째 작업'); await fs.mkdir(second);
    await fs.writeFile(path.join(second, 'original.dat'), crypto.randomBytes(65536));
    await fs.link(path.join(second, 'original.dat'), path.join(second, 'hardlink.dat'));
    const sources = engine.config.sources;
    engine.config.sources = [...sources, second];
    await engine.backupNow(); await engine.restoreLatest({ parent: restore });
    const mapping = JSON.parse(await fs.readFile(path.join(engine.config.lastRestore.path, '복구경로.json'), 'utf8'));
    const folder = path.join(engine.config.lastRestore.path, mapping.find(m => m.original === second).restoredFolder);
    assert.equal(digest(await fs.readFile(path.join(folder, 'original.dat'))), digest(await fs.readFile(path.join(folder, 'hardlink.dat'))));
    assert.notEqual((await fs.stat(path.join(folder, 'original.dat'))).ino, (await fs.stat(path.join(folder, 'hardlink.dat'))).ino);
    assert.ok(!(await files(engine.config.lastRestore.path)).some(p => /\.(zip|tar)$/.test(p)));
    engine.config.sources = sources;
  });
  await t.test('a failing streaming consumer settles the child and allows a subsequent repository check', async () => {
    const latest = (await engine.snapshots([VERIFIED]))[0];
    const subtree = '/' + latest.paths[0].replace(/^([A-Za-z]):/, '$1').replaceAll('\\', '/');
    for (const code of ['PROBE_LIMIT', 'PROBE_SIZE']) {
      await assert.rejects(engine.run(['dump', `${latest.id}:${subtree}`, '/', '--archive', 'tar'], { timeoutMs: 15000, consumeStdout: async stream => {
        for await (const _ of stream) throw Object.assign(new Error('simulated destination write failure'), { code });
      } }), e => e.code === code && /destination write failure/.test(e.message));
      assert.equal(engine.child, null); await engine.checkRepository();
    }
  });
  await t.test('protected source ACL and foreign SID are not imposed on recovered files', { skip: process.platform !== 'win32' }, async () => {
    const { execFileSync } = require('node:child_process');
    const protectedFile = path.join(source,'권한 문서.txt'); await fs.writeFile(protectedFile,'현재 사용자가 열 수 있는 복구 자료');
    const script = "$ErrorActionPreference='Stop'; $p=$env:SOLO_ACL_FIXTURE; if(-not $p.StartsWith($env:TEMP,[System.StringComparison]::OrdinalIgnoreCase)){throw 'outside fixture'}; $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $old=[System.Security.Principal.SecurityIdentifier]::new('S-1-5-21-111111111-222222222-333333333-9999'); $acl=[System.Security.AccessControl.FileSecurity]::new(); $acl.SetAccessRuleProtection($true,$false); $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','Allow')); $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($old,'Read','Allow')); [System.IO.File]::SetAccessControl($p,$acl)";
    execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,env:{...process.env,SOLO_ACL_FIXTURE:protectedFile}});
    await engine.backupNow(); await engine.restoreLatest({parent:restore});
    const result=(await files(engine.config.lastRestore.path)).find(p=>path.basename(p)==='권한 문서.txt'); assert.ok(result);
    assert.equal(await fs.readFile(result,'utf8'),'현재 사용자가 열 수 있는 복구 자료');
    const check="$a=[System.IO.File]::GetAccessControl($env:SOLO_ACL_FIXTURE); @{protected=$a.AreAccessRulesProtected; foreign=($a.Sddl -match '111111111-222222222-333333333-9999')} | ConvertTo-Json -Compress";
    const observed=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',check],{windowsHide:true,encoding:'utf8',env:{...process.env,SOLO_ACL_FIXTURE:result}}));
    assert.equal(observed.protected,false); assert.equal(observed.foreign,false);
  });
  await t.test('unfinished setup can be replaced without deleting repository or recovery material', async () => {
    const draft = new BackupEngine({ stateDir: path.join(root, 'draft'), resticPath, secretStore }); await draft.open();
    const run = draft.run; draft.run = async function(args, options) { if(args[0] === 'init') throw new Error('simulated init failure'); return run.call(this,args,options); };
    await assert.rejects(draft.setup({ sources: [source], parent: target }), /init failure/);
    const repository = draft.config.repository;
    await draft.resetUnfinishedSetup(); assert.equal(draft.config, null); await fs.access(repository);
    const archived = await fs.readdir(draft.stateDir); assert.ok(archived.some(n=>n.startsWith('unfinished-')&&n.endsWith('.bin')));
  });
  await t.test('retention keeps the newest complete snapshot and never forgets it', async () => {
    clock += 3 * DAY; await engine.backupNow();
    const remaining = await engine.snapshots();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, engine.config.lastBackup.id);
    await engine.restoreLatest({ parent: restore });
  });
  await t.test('scheduler waits for interval and does not overlap an active job', async () => {
    await engine.setAutomatic(true); let calls = 0; const backup = engine.backupNow;
    engine.backupNow = async () => { calls++; engine.lastAttempt = clock; };
    await engine.tick(); assert.equal(calls, 0);
    clock += engine.intervalMs + 1; engine.job = { kind: 'restore' }; await engine.tick(); assert.equal(calls, 0);
    engine.job = null; await engine.tick(); assert.equal(calls, 1); await engine.tick(); assert.equal(calls, 1);
    engine.backupNow = backup; await engine.setAutomatic(false);
  });
  await t.test('normal shutdown waits for the active operation and leaves no stale repository lock', async () => {
    const closing = new BackupEngine({ stateDir: path.join(root, 'closing-state'), resticPath, secretStore }); await closing.open();
    await closing.importRecoveryKit({ text: await fs.readFile(path.join(keys, 'kit.json'), 'utf8'), repository: engine.config.repository });
    const running = closing.checkRepository(); const stopped = closing.stop();
    await assert.rejects(closing.checkRepository(), /진행 중인 작업/);
    await Promise.all([running, stopped]); assert.equal(closing.job, null); assert.equal(closing.child, null);
    await engine.checkRepository();
  });
  await t.test('a file another program holds without sharing makes a partial snapshot with its list; the complete backup stays (4.2)', async () => {
    // restic 0.19.1, measured 11-14: exit 3, a JSON error line on stderr with the file as `item`, and a snapshot of the rest.
    const held = path.join(source, 'held-by-another-program.pst');
    await fs.writeFile(held, 'opened without sharing');
    const holder = spawn('powershell.exe', ['-NoProfile', '-Command', `$f=[IO.File]::Open('${held}','Open','ReadWrite','None'); 'held'; [Console]::In.ReadLine() | Out-Null; $f.Close()`], { stdio: ['pipe', 'pipe', 'inherit'] });
    await new Promise((resolve) => holder.stdout.once('data', resolve));
    const before = engine.config.lastBackup.id;
    try { await engine.backupNow(); } finally { holder.stdin.end('\n'); await new Promise((resolve) => holder.once('exit', resolve)); }
    assert.equal(engine.config.lastBackup.id, before, 'the complete backup stays the one restored');
    assert.equal(engine.config.lastPartial.unreadable, 1);
    assert.match(engine.config.warning, /파일 1개를 이번 백업에 담지 못했습니다/);
    const [partial] = await engine.snapshots(['partial']);
    assert.equal(partial.id, engine.config.lastPartial.id);
    const run = partial.tags.find((tag) => tag.startsWith('run:'));
    const lists = await engine.snapshots([run, 'meta']);
    assert.equal(lists.length, 1, 'its list, saved before it was marked partial');
    const list = JSON.parse(await engine.run(['dump', lists[0].id, '/workbackup-unreadable.json']));
    assert.deepEqual(list.unreadable.map((p) => path.basename(p)), ['held-by-another-program.pst']);
    const names = (await engine.run(['ls', '--json', partial.id])).split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)).filter((n) => n.type === 'file').map((n) => path.basename(n.path));
    assert.ok(!names.includes('held-by-another-program.pst') && names.length > 0, 'the rest of the files are in it');
    await fs.rm(held);
    await engine.backupNow();
    assert.equal(engine.config.lastPartial, null, 'a complete backup clears it');
  });
  await t.test('real pack corruption fails a full data check and disables pruning', async () => {
    const packs = (await files(path.join(engine.config.repository, 'data'))).filter(p => /^[a-f0-9]{64}$/.test(path.basename(p)));
    assert.ok(packs.length); const handle = await fs.open(packs[0], 'r+'); await handle.write(Buffer.from('CORRUPTED-FIXTURE'), 0, 17, 0); await handle.close();
    await assert.rejects(engine.checkRepository()); assert.equal(engine.config.health.status, 'attention');
    await assert.rejects(engine.retain(), /정리할 수 없습니다/);
  });
  engine.stop();
  console.log(`Fixture evidence retained at ${root}`);
});

test('long progress output stays bounded and split UTF-8 survives', () => {
  const { ProcessOutput } = require('../src/process-output.cjs');
  let overflows = 0, progress = 0;
  const output = new ProcessOutput({ structured: false, overflow: () => overflows++, progress: () => progress++ });
  const line = Buffer.from(JSON.stringify({ message_type: 'status', percent_done: .5, current_files: ['한글'.repeat(100)] }) + '\n');
  for (let i = 0; i < 40000; i++) output.accept(line);
  assert.equal(overflows, 0); assert.ok(output.end().length <= 65536); assert.equal(progress, 40000);
  const data = new ProcessOutput({ structured: true }); const bytes = Buffer.from('{"파일":"한글"}');
  for (const b of bytes) data.accept(Buffer.from([b]));
  assert.deepEqual(JSON.parse(data.end()), { 파일: '한글' });
});

test('path boundary is component-aware and rejects Windows junctions', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-backup-paths-'));
  assert.equal(overlap(path.join(root, 'work'), path.join(root, 'work-2')), false);
  assert.equal(overlap(path.join(root, 'work'), path.join(root, 'work', 'child')), true);
  const target = path.join(root, 'target'); const link = path.join(root, 'link'); await fs.mkdir(target);
  await fs.symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(directory(link), /정션/);
});

test('restore paths reject traversal, ADS and Windows device names', () => {
  const { entryPath } = require('../src/restore-tar.cjs'); const root=path.resolve(os.tmpdir(),'solo-backup-tar-boundary');
  for (const name of ['../escape','/absolute','C:/evil','a:stream','a/../evil','a\\evil','CON.txt','a/NUL','x.','x ']) assert.throws(()=>entryPath(root,name));
  assert.equal(entryPath(root,'한글/문서.txt'),path.join(root,'한글','문서.txt'));
});
