'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { BackupEngine, APP, VERIFIED } = require('../src/engine.cjs');
const { LIMITS } = require('../src/restore-select.cjs');
const code = expected => e => e.code === expected;
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'selective-engine-'));
  for (const dir of ['repo', 'source', 'output']) await fs.mkdir(path.join(root, dir));
  const snapshotId = 'a'.repeat(64), repositoryId = 'b'.repeat(64), vaultId = crypto.randomUUID(), events = [];
  let now = Date.now();
  const fake = { nodes: [{ message_type: 'node', path: '/한글 [1].txt', type: 'file', size: 3 }], content: Buffer.from('abc'), snapshots: [{ id: snapshotId, time: new Date(now).toISOString(), hostname: vaultId, paths: ['C:\\original-work'], tags: [APP, 'vault:' + vaultId, VERIFIED] }], locks: [], lockExclusive: true, afterDump: null, fail: null };
  const runner = async (args, opts) => {
    events.push({ args, readOnly: opts.providerArgs.includes('--no-lock') });
    if (fake.fail === args[0]) throw new Error('PRIVATE_PATH private-query remote-stderr');
    if (args[0] === 'cat' && args[1] === 'config') return JSON.stringify({ id: repositoryId });
    if (args[0] === 'cat' && args[1] === 'lock') return JSON.stringify({ exclusive: fake.lockExclusive });
    if (args[0] === 'list') return fake.locks.join('\n');
    if (args[0] === 'snapshots') return JSON.stringify(fake.snapshots);
    if (args[0] === 'ls') {
      const listed = fake.ls?.(args) || { id: snapshotId, nodes: fake.nodes };
      await opts.consumeStdout(Readable.from([Buffer.from([{ message_type: 'snapshot', id: listed.id }, ...listed.nodes].map(x => JSON.stringify(x)).join('\n'))])); return '';
    }
    if (args[0] === 'dump') { await opts.consumeStdout(Readable.from([fake.content])); if (fake.afterDump) await fake.afterDump(); return ''; }
    throw new Error('Unexpected command');
  };
  const engine = new BackupEngine({ stateDir: path.join(root, 'state'), resticPath: 'unused', runner, now: () => now, secretStore: { encrypt: x => Buffer.from(x), decrypt: x => x.toString() } });
  await engine.open(); engine.config = { schema: 1, mode: 'backup', vaultId, repositoryId, repository: path.join(root, 'repo'), sources: [path.join(root, 'source')], automatic: true, lastError: 'prior backup error', protectRun: { phase: 'backup', interrupted: true }, health: { status: 'ok' }, lastRestore: { path: 'old-full' }, lastSelectedRestore: { path: 'old-selected' } }; engine.secret = 'a'.repeat(43);
  async function selected() { const meta = await engine.openFileCatalog(); engine.setFileSelection({ token: meta.token, revision: 0, action: 'all', query: '' }); return { token: meta.token, revision: 1, parent: path.join(root, 'output') }; }
  return { root, engine, fake, events, selected, advance: amount => { now += amount; } };
}
test('browse preserves backup failures/journal and rejects unavailable, concurrent, expired or cross-repository catalogs', async () => {
  const f = await fixture(), { engine, fake } = f, before = structuredClone(engine.config);
  const catalog = await engine.openFileCatalog(); assert.deepEqual(engine.config, before); assert.equal(engine.job, null);
  const q = engine.queryFileCatalog({ token: catalog.token, query: '[1]', offset: 0 }); assert.equal(q.total, 1);
  fake.fail = 'ls'; await assert.rejects(engine.openFileCatalog(), code('OPERATION_FAILED')); assert.deepEqual(engine.config, before); assert.equal(engine.fileCatalog, null);
  fake.fail = null; const again = await engine.openFileCatalog(); f.advance(LIMITS.ttl); assert.throws(() => engine.queryFileCatalog({ token: again.token, query: '', offset: 0 }), code('CATALOG_EXPIRED'));
  engine.job = { kind: 'backup' }; await assert.rejects(engine.openFileCatalog(), code('JOB_BUSY')); engine.job = null;
  const other = await engine.openFileCatalog(); engine.config.repositoryId = 'c'.repeat(64); assert.throws(() => engine.queryFileCatalog({ token: other.token, query: '', offset: 0 }), code('CATALOG_EXPIRED'));
});
test('selected restore writes only selected file, preserves original/results/errors, and uses immutable capture past TTL', async () => {
  const f = await fixture(), { engine, fake, root } = f;
  fake.nodes.push({ message_type: 'node', path: '/unselected.txt', type: 'file', size: 8 });
  const catalog = await engine.openFileCatalog(), selectedRow = engine.queryFileCatalog({ token: catalog.token, query: '[1]', offset: 0 }).rows[0];
  engine.setFileSelection({ token: catalog.token, revision: 0, action: 'add', ids: [selectedRow.id] });
  fake.afterDump = async () => { f.advance(LIMITS.ttl + 1); engine.discardCatalog(); assert.throws(() => engine.setFileSelection({ token: catalog.token, revision: 1, action: 'clear' }), code('JOB_BUSY')); };
  await engine.restoreSelected({ token: catalog.token, revision: 1, parent: path.join(root, 'output') });
  const result = engine.config.lastSelectedRestore; assert.equal(result.files, 1); assert.equal(result.bytes, 3);
  assert.equal(await fs.readFile(path.join(result.path, '01-original-work', '한글 [1].txt'), 'utf8'), 'abc');
  assert.deepEqual(await fs.readdir(path.join(result.path, '01-original-work')), ['한글 [1].txt']);
  assert.ok(!(await fs.readdir(result.path)).includes('_복구중_미완료.txt'));
  assert.equal(engine.config.lastError, 'prior backup error'); assert.equal(engine.config.protectRun.interrupted, true); assert.equal(engine.config.lastRestore.path, 'old-full'); assert.deepEqual(await fs.readdir(path.join(root, 'source')), []);
  assert.ok(!(await fs.readFile(path.join(engine.stateDir, 'settings.json'), 'utf8')).includes('한글 [1].txt'));
});
test('pinned snapshot disappearance, source overlap and manifest mismatch fail before making a folder', async () => {
  for (const kind of ['gone', 'overlap', 'manifest']) {
    const f = await fixture(), args = await f.selected();
    if (kind === 'gone') f.fake.snapshots = [{ ...f.fake.snapshots[0], id: 'd'.repeat(64) }];
    if (kind === 'overlap') args.parent = path.join(f.root, 'source');
    if (kind === 'manifest') f.fake.nodes[0].size++;
    await assert.rejects(f.engine.restoreSelected(args), code({ gone: 'SNAPSHOT_GONE', overlap: 'OUTPUT_UNSAFE', manifest: 'INTEGRITY_FAILED' }[kind]));
    assert.deepEqual(await fs.readdir(path.join(f.root, 'output')), []); assert.equal(f.engine.config.lastSelectedRestore.path, 'old-selected');
    assert.equal(f.engine.config.health.status, kind === 'manifest' ? 'attention' : 'ok'); assert.equal(f.engine.config.lastError, 'prior backup error');
  }
});
test('short-success/oversize is integrity failure while failed process after EOF is only incomplete; private stderr is hidden', async () => {
  for (const kind of ['short', 'oversize', 'process', 'stderr']) {
    const f = await fixture(), args = await f.selected();
    f.fake.content = Buffer.from(kind === 'oversize' ? 'abcd' : 'ab');
    if (kind === 'process') f.fake.afterDump = async () => { throw new Error('PRIVATE_PATH remote-stderr'); };
    if (kind === 'stderr') f.fake.fail = 'dump';
    const integrity = kind === 'short' || kind === 'oversize';
    await assert.rejects(f.engine.restoreSelected(args), code(integrity ? 'INTEGRITY_FAILED' : 'RESTORE_INCOMPLETE'));
    assert.equal(f.engine.config.health.status, integrity ? 'attention' : 'ok'); assert.equal(f.engine.config.lastSelectedRestore.path, 'old-selected');
    const partial = f.engine.config.lastSelectedRestoreError.path; assert.ok(partial); assert.ok((await fs.readdir(partial)).includes('_복구중_미완료.txt'));
    assert.ok(!JSON.stringify(f.engine.getState()).includes('PRIVATE_PATH')); assert.ok(!JSON.stringify(f.engine.getState()).includes('remote-stderr')); assert.equal(f.engine.config.lastError, 'prior backup error'); assert.equal(f.engine.job, null);
  }
});
test('read-only catalogs and selected restore use no-lock reads and reject active remote maintenance', async () => {
  const f = await fixture(); f.engine.config.readOnly = true; f.engine.config.mode = 'restore';
  f.fake.locks = ['e'.repeat(64)]; await assert.rejects(f.engine.openFileCatalog(), code('REMOTE_MAINTENANCE'));
  f.fake.lockExclusive = false; const args = await f.selected(); await f.engine.restoreSelected(args);
  assert.ok(f.events.every(x => x.readOnly)); assert.ok(f.events.every(x => ['cat', 'list', 'snapshots', 'ls', 'dump'].includes(x.args[0])));
  assert.equal(f.engine.config.lastSelectedRestore.files, 1);
});
test('completion persistence failure restores previous result and recreates incomplete marker', async () => {
  const f = await fixture(), args = await f.selected(), originalRename = fs.rename;
  let fail = false;
  f.fake.afterDump = async () => { fail = true; };
  fs.rename = async (from, to) => { if (fail && to === path.join(f.engine.stateDir, 'settings.json')) { fail = false; throw new Error('disk state failure'); } return originalRename(from, to); };
  try { await assert.rejects(f.engine.restoreSelected(args), code('RESTORE_INCOMPLETE')); }
  finally { fs.rename = originalRename; }
  assert.equal(f.engine.config.lastSelectedRestore.path, 'old-selected');
  assert.ok((await fs.readdir(f.engine.config.lastSelectedRestoreError.path)).includes('_복구중_미완료.txt'));
  assert.equal(JSON.parse(await fs.readFile(path.join(f.engine.stateDir, 'settings.json'), 'utf8')).lastSelectedRestore.path, 'old-selected');
});
test('browse and selected restore read this device\'s backups only (STAGE1_DESIGN.md 4.6 「호스트 = 이 기기」)', async () => {
  const f = await fixture(), { engine, fake } = f;
  // A newer complete backup of another device in the same repository is not this one's.
  fake.snapshots = [{ ...fake.snapshots[0], id: 'e'.repeat(64), time: new Date(Date.now() + 60000).toISOString(), hostname: 'otherdevice01' }, ...fake.snapshots];
  const catalog = await engine.openFileCatalog();
  assert.equal(engine.fileCatalog.snapshotId, 'a'.repeat(64));
  assert.ok(catalog.token);
  // With only the other device's backup there is nothing of this one to browse.
  fake.snapshots = fake.snapshots.slice(0, 1);
  await assert.rejects(engine.openFileCatalog(), code('NO_SNAPSHOT'));
});
test('another device\'s backup, a folder or a folder inside it, and one level of names (4.6 「옛 PC 백업에서 꺼내기」 · 화면 세션 E26)', async () => {
  const f = await fixture(), { engine, fake, events, root } = f, oldId = 'c'.repeat(64), oldAt = new Date(Date.now() - 60000).toISOString();
  fake.snapshots.push({ id: oldId, time: oldAt, hostname: 'old-pc', paths: ['C:\\old work', 'D:\\big'], tags: [APP, 'vault:' + engine.config.vaultId, VERIFIED] });
  const node = (p, type = 'file') => ({ message_type: 'node', path: p, type, size: type === 'file' ? 3 : 0 });
  const tree = { '/C/old work': [node('/메모.txt')], '/D/big': [node('/2024', 'dir'), node('/2023', 'dir'), node('/2024/사진', 'dir'), node('/2024/사진/a.jpg'), node('/top.txt')], '/D/big/2024': [node('/사진', 'dir'), node('/사진/a.jpg')] };
  // restic lists one level without --recursive; the selector names the backup's folder, and the folder inside it after a slash.
  fake.ls = args => { const at = args.find(a => /^[0-9a-f]{64}:/.test(a)); if (!at || at.startsWith('a'.repeat(64))) return null; const rows = tree[at.slice(65)]; if (!rows) throw new Error('no such path in the backup'); return { id: at.slice(0, 64), nodes: args.includes('--recursive') ? rows : rows.filter(n => /^\/[^/]+$/.test(n.path)) }; };
  const lists = () => events.filter(e => e.args[0] === 'ls').map(e => e.args.slice(1));
  // This device's own catalog is as before: its own backup, the whole of it.
  const own = await engine.openFileCatalog(); assert.equal(own.from, null); assert.equal(own.scope, null); assert.equal(own.fileCount, 1);
  events.length = 0;
  const top = await engine.browseBackupFolder({ from: 'old-pc', folder: 'd:\\BIG\\' });
  assert.deepEqual({ ...top, profile: undefined }, { profile: undefined, from: 'old-pc', folder: 'D:\\big', sub: '', snapshotAt: oldAt, folders: ['2023', '2024'], files: 1 });
  assert.deepEqual(lists(), [['--json', oldId + ':/D/big', '/']]);
  const inner = await engine.browseBackupFolder({ from: 'old-pc', folder: 'D:\\big', sub: '2024' });
  assert.deepEqual([inner.sub, inner.folders, inner.files], ['2024', ['사진'], 0]);
  events.length = 0;
  const meta = await engine.openFileCatalog({ from: 'old-pc', folder: 'D:\\big', sub: '2024' });
  assert.deepEqual([meta.from, meta.fileCount, meta.snapshotAt], ['old-pc', 1, oldAt]);
  assert.deepEqual(meta.scope, [{ source: '02-big', folder: 'D:\\big', sub: '2024' }]);
  assert.deepEqual(lists(), [['--json', '--recursive', oldId + ':/D/big/2024']], 'only that part is read');
  assert.equal(engine.queryFileCatalog({ token: meta.token, query: '', offset: 0 }).rows[0].path, '2024/사진/a.jpg');
  engine.setFileSelection({ token: meta.token, revision: 0, action: 'all', query: '' });
  events.length = 0;
  await engine.restoreSelected({ token: meta.token, revision: 1, parent: path.join(root, 'output') });
  const result = engine.config.lastSelectedRestore; assert.equal(result.files, 1);
  assert.equal(await fs.readFile(path.join(result.path, '02-big', '2024', '사진', 'a.jpg'), 'utf8'), 'abc');
  assert.equal(JSON.parse(await fs.readFile(path.join(result.path, '복구경로.json'), 'utf8')).from, 'old-pc');
  assert.deepEqual(events.filter(e => e.args[0] === 'ls' || e.args[0] === 'dump').map(e => e.args), [['ls', '--json', '--recursive', oldId + ':/D/big/2024'], ['dump', oldId + ':/D/big', '/2024/사진/a.jpg']]);
  // One whole folder of it, and the whole of it.
  const folder = await engine.openFileCatalog({ from: 'old-pc', folder: 'C:\\old work' });
  assert.deepEqual([folder.fileCount, folder.scope], [1, [{ source: '01-old work', folder: 'C:\\old work', sub: '' }]]);
  const whole = await engine.openFileCatalog({ from: 'old-pc' }); assert.deepEqual([whole.fileCount, whole.scope], [3, null]);
  // A device that backed up one folder: that folder chosen is still a scope (카본 끝판 A1), the whole of it is not.
  fake.snapshots.push({ id: 'f'.repeat(64), time: oldAt, hostname: 'one-pc', paths: ['C:\\old work'], tags: [APP, 'vault:' + engine.config.vaultId, VERIFIED] });
  assert.deepEqual((await engine.openFileCatalog({ from: 'one-pc', folder: 'C:\\old work' })).scope, [{ source: '01-old work', folder: 'C:\\old work', sub: '' }]);
  assert.equal((await engine.openFileCatalog({ from: 'one-pc' })).scope, null);
  // What is refused: a device name restic could not have written, a device with no backup, a folder the backup does not
  // have, a part that climbs out or is not a Windows name, and a browse without a folder.
  for (const [input, expected] of [[{ from: 'old pc' }, 'INVALID_REQUEST'], [{ from: 'x'.repeat(129) }, 'INVALID_REQUEST'], [{ from: 'gone-pc' }, 'NO_SNAPSHOT'], [{ from: 'old-pc', folder: 'E:\\none' }, 'INVALID_REQUEST'],
    [{ from: 'old-pc', folder: 'D:\\big', sub: '../x' }, 'INVALID_REQUEST'], [{ from: 'old-pc', folder: 'D:\\big', sub: 'a\\b' }, 'INVALID_REQUEST'], [{ from: 'old-pc', folder: 'D:\\big', sub: 'CON' }, 'INVALID_REQUEST'], [{ from: 'old-pc', sub: '2024' }, 'INVALID_REQUEST']]) {
    await assert.rejects(engine.openFileCatalog(input), code(expected), JSON.stringify(input));
    if (input.folder !== undefined || input.sub === undefined) await assert.rejects(engine.browseBackupFolder({ folder: 'D:\\big', ...input }), code(expected), JSON.stringify(input));
  }
  await assert.rejects(engine.browseBackupFolder({ from: 'old-pc' }), code('INVALID_REQUEST'));
  // A part the backup does not have (the screen's list was older), or a file named as a folder, is told apart from a read
  // that failed for another reason.
  await assert.rejects(engine.browseBackupFolder({ from: 'old-pc', folder: 'D:\\big', sub: '2024/없음' }), code('INVALID_REQUEST'));
  await assert.rejects(engine.openFileCatalog({ from: 'old-pc', folder: 'D:\\big', sub: '없음' }), code('INVALID_REQUEST'));
  await assert.rejects(engine.openFileCatalog({ from: 'old-pc', folder: 'D:\\big', sub: 'top.txt' }), code('INVALID_REQUEST'));
  fake.fail = 'ls'; await assert.rejects(engine.browseBackupFolder({ from: 'old-pc', folder: 'D:\\big', sub: '2024' }), code('OPERATION_FAILED'));
  await assert.rejects(engine.openFileCatalog({ from: 'old-pc', folder: 'D:\\big', sub: '2024' }), code('OPERATION_FAILED')); fake.fail = null;
  // A name a catalog could not hold is left out and counted; past 2,000 folders the list is cut; a deeper path or another
  // backup's listing is refused.
  tree['/D/big'] = [node('/2024', 'dir'), node('/CON', 'dir'), node('/끝.', 'dir')];
  assert.deepEqual(await engine.browseBackupFolder({ from: 'old-pc', folder: 'D:\\big' }).then(v => [v.folders, v.leftOut]), [['2024'], 2]);
  tree['/D/big'] = Array.from({ length: 2001 }, (_, i) => node('/d' + i, 'dir'));
  assert.deepEqual(await engine.browseBackupFolder({ from: 'old-pc', folder: 'D:\\big' }).then(v => [v.folders.length, v.cut]), [2000, true]);
  fake.ls = () => ({ id: oldId, nodes: [node('/a/b')] }); await assert.rejects(engine.browseBackupFolder({ from: 'old-pc', folder: 'D:\\big' }), code('UNSAFE_MANIFEST'));
  fake.ls = () => ({ id: 'e'.repeat(64), nodes: [] }); await assert.rejects(engine.browseBackupFolder({ from: 'old-pc', folder: 'D:\\big' }), code('UNSAFE_MANIFEST'));
});
