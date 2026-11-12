'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { Readable } = require('node:stream');
const { LIMITS, parseCatalog, budget, FileCatalog, sourcePlans, writeFileStream, spaceRequired } = require('../src/restore-select.cjs');
const id = 'a'.repeat(64), root = path.resolve(os.tmpdir(), 'selective-placeholder');
const snapshot = { id, time: '2026-11-08T00:00:00.000Z', paths: ['C:\\Z work', 'D:\\A work'] };
const row = (name, size = 3, type = 'file') => ({ message_type: 'node', path: '/' + name, type, size });
function input(rows) { return Readable.from([Buffer.from([{ message_type: 'snapshot', id }, ...rows].map(x => JSON.stringify(x)).join('\n'))]); }
const parse = (rows, meter) => parseCatalog(input(rows), { root, snapshotId: id, budget: meter });
const code = expected => e => e.code === expected;
async function catalog(count = 3) { const manifest = await parse(Array.from({ length: count }, (_, i) => row('파일[' + i + '].txt', i))); return new FileCatalog({ snapshot, plans: sourcePlans(snapshot).slice(0, 1), manifests: [manifest], repositoryId: 'repo', vaultId: 'vault', profile: 'local', now: 1000 }); }

test('catalog rejects unsafe/colliding/invalid-parent paths but counts safe unsupported entries', async () => {
  const m = await parse([row('폴더', 0, 'dir'), row('폴더/한글.txt'), row('link', 0, 'symlink')]);
  assert.equal(m.unavailableCount, 1); assert.equal(m.nodes.size, 3);
  for (const rows of [[row('../escape')], [row('CON.txt')], [row('file'), row('FILE')], [row('link', 0, 'symlink'), row('link/file')], [row('missing/file')], [row('file'), row('file/child')]]) await assert.rejects(parse(rows), code('UNSAFE_MANIFEST'));
  await assert.rejects(parseCatalog(Readable.from([Buffer.from('{"message_type":"snapshot","id":"bad"}\n')]), { root, snapshotId: id }), code('UNSAFE_MANIFEST'));
});
test('raw bytes, nodes, oversized lines and malformed UTF8 fail closed across sources/chunks', async () => {
  await assert.rejects(parse([row('file')], budget({ bytes: 20 })), code('CATALOG_TOO_LARGE'));
  const meter = budget({ nodes: 1 }); await parse([row('first')], meter); await assert.rejects(parse([row('second')], meter), code('CATALOG_TOO_LARGE'));
  await assert.rejects(parse([row('long-name')], budget({ line: 10 })), code('CATALOG_TOO_LARGE'));
  await assert.rejects(parseCatalog(Readable.from([Buffer.from([0xc0, 0xaf])]), { root, snapshotId: id }), code('UNSAFE_MANIFEST'));
  const encoded = Buffer.from([{ message_type: 'snapshot', id }, row('한글.txt')].map(x => JSON.stringify(x)).join('\n'));
  async function* bytes() { for (const byte of encoded) yield Buffer.from([byte]); }
  assert.equal((await parseCatalog(Readable.from(bytes()), { root, snapshotId: id })).nodes.size, 1);
});
test('literal normalized search and atomic full-result selection span pages with stale/invalid guards', async () => {
  const c = await catalog(1001), first = c.query('[', 0); assert.equal(first.rows.length, 100); assert.equal(first.total, 1001);
  assert.throws(() => c.select({ revision: 0, action: 'all', query: '[' }), code('SELECTION_LIMIT')); assert.deepEqual(c.meta().selection, { revision: 0, count: 0, bytes: 0 });
  c.select({ revision: 0, action: 'all', query: '파일[1' }); assert.equal(c.selected.size, 112);
  assert.equal(c.query('[', 100).selection.count, 112);
  assert.throws(() => c.select({ revision: 0, action: 'clear' }), code('SELECTION_STALE'));
  assert.throws(() => c.select({ revision: 1, action: 'add', ids: ['0', '0'] }), code('INVALID_REQUEST'));
  assert.throws(() => c.select({ revision: 1, action: 'add', ids: ['999999'] }), code('INVALID_REQUEST'));
  assert.throws(() => c.query('x'.repeat(201), 0), code('QUERY_INVALID')); assert.throws(() => c.query('\n', 0), code('QUERY_INVALID')); assert.throws(() => c.query('', 1002), code('INVALID_REQUEST'));
  c.select({ revision: 1, action: 'clear' }); assert.equal(c.selected.size, 0);
  const raw = '한글'.normalize('NFD') + '.txt', manifest = await parse([row(raw)]), n = new FileCatalog({ snapshot, plans: sourcePlans(snapshot).slice(0, 1), manifests: [manifest], repositoryId: 'repo', vaultId: 'vault', profile: 'local', now: 1000 });
  assert.equal(n.query('한글', 0).rows[0].path, raw);
});
test('catalog expiration/binding and confirmed-copy independence, source order and overlap guards', async () => {
  const c = await catalog(); c.assert(c.token, { repositoryId: 'repo', vaultId: 'vault' }, 1000);
  for (const [token, config, now] of [['wrong', { repositoryId: 'repo', vaultId: 'vault' }, 1000], [c.token, { repositoryId: 'changed', vaultId: 'vault' }, 1000], [c.token, { repositoryId: 'repo', vaultId: 'vault' }, 1000 + LIMITS.ttl], [c.token, { repositoryId: 'repo', vaultId: 'vault' }, 999]]) assert.throws(() => c.assert(token, config, now), code('CATALOG_EXPIRED'));
  assert.throws(() => c.capture(0), code('SELECTION_EMPTY')); c.select({ revision: 0, action: 'add', ids: ['1'] }); const copy = c.capture(1); c.select({ revision: 1, action: 'clear' }); assert.equal(copy.files.length, 1);
  assert.equal(sourcePlans(snapshot)[0].label, '01-Z work'); assert.equal(sourcePlans(snapshot)[1].label, '02-A work');
  const long = sourcePlans({ ...snapshot, paths: ['C:\\' + 'a'.repeat(253), 'D:\\' + 'b'.repeat(249) + '😀'] });
  for (const plan of long) {
    assert.ok(plan.label.length <= 255); assert.ok(!/[\uD800-\uDBFF]$/u.test(plan.label));
    const probe = await fs.mkdtemp(path.join(os.tmpdir(), 'selective-long-label-'));
    await fs.mkdir(path.join(probe, plan.label));
  }
  assert.throws(() => sourcePlans({ ...snapshot, paths: ['C:\\work', 'c:\\WORK\\nested'] }), code('UNSAFE_MANIFEST'));
});
test('file stream uses exclusive creation, size bound, preserved partial writes and allocation space check', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'selective-writer-')); const file = path.join(dir, '한글.txt');
  const done = await writeFileStream(Readable.from([Buffer.from('abc')]), file, 3, dir); assert.equal(done.bytes, 3); assert.equal(await fs.readFile(file, 'utf8'), 'abc');
  await assert.rejects(writeFileStream(Readable.from([Buffer.from('bad')]), file, 3, dir)); assert.equal(await fs.readFile(file, 'utf8'), 'abc');
  const short = await writeFileStream(Readable.from([Buffer.from('ab')]), path.join(dir, 'short'), 3, dir); assert.equal(short.bytes, 2);
  await assert.rejects(writeFileStream(Readable.from([Buffer.from('abcd')]), path.join(dir, 'long'), 3, dir), code('INTEGRITY_FAILED'));
  await assert.rejects(spaceRequired(dir, [{ sourceIndex: 0, path: 'a/b', size: 1 }], [{ label: '01-work' }], async () => ({ bsize: 4096n, bavail: 1n })), code('NO_SPACE'));
});
