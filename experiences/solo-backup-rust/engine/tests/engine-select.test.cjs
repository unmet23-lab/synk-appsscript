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
  const fake = { nodes: [{ message_type: 'node', path: '/한글 [1].txt', type: 'file', size: 3 }], content: Buffer.from('abc'), snapshots: [{ id: snapshotId, time: new Date(now).toISOString(), paths: ['C:\\original-work'], tags: [APP, 'vault:' + vaultId, VERIFIED] }], locks: [], lockExclusive: true, afterDump: null, fail: null };
  const runner = async (args, opts) => {
    events.push({ args, readOnly: opts.providerArgs.includes('--no-lock') });
    if (fake.fail === args[0]) throw new Error('PRIVATE_PATH private-query remote-stderr');
    if (args[0] === 'cat' && args[1] === 'config') return JSON.stringify({ id: repositoryId });
    if (args[0] === 'cat' && args[1] === 'lock') return JSON.stringify({ exclusive: fake.lockExclusive });
    if (args[0] === 'list') return fake.locks.join('\n');
    if (args[0] === 'snapshots') return JSON.stringify(fake.snapshots);
    if (args[0] === 'ls') {
      await opts.consumeStdout(Readable.from([Buffer.from([{ message_type: 'snapshot', id: snapshotId }, ...fake.nodes].map(x => JSON.stringify(x)).join('\n'))])); return '';
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
