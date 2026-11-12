'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const tar = require('tar-stream');
const { extractVerified, readManifest } = require('../src/restore-tar.cjs');
const fixture = () => fs.mkdtemp(path.join(os.tmpdir(), 'solo-backup-tar-'));
async function archive(entries) {
  const pack = tar.pack(), chunks = [];
  const collect = (async () => { for await (const part of pack) chunks.push(part); })();
  for (const e of entries) pack.entry({ name: e.name, type: e.type || 'file', linkname: e.linkname }, e.data || '');
  pack.finalize(); await collect; return Buffer.concat(chunks);
}
function manifest(entries) {
  return { nodes: new Map(entries.map(e => [e.name.toLowerCase(), { name: e.name, type: e.type || 'file', size: e.type === 'dir' ? 0 : Buffer.byteLength(e.data || '') }])), bytes: entries.reduce((n, e) => n + Buffer.byteLength(e.data || ''), 0) };
}
test('stream extraction verifies every manifest entry, empty directories and Korean content', async () => {
  const root = await fixture(), entries = [{ name: '한글', type: 'dir' }, { name: '한글/파일.txt', data: '원래 자료' }, { name: '빈 폴더', type: 'dir' }];
  const data = await archive(entries.map(e => ({ ...e, type: e.type === 'dir' ? 'directory' : 'file' })));
  async function* chunks() { for (let i = 0; i < data.length; i += 73) yield data.subarray(i, i + 73); }
  const result = await extractVerified(Readable.from(chunks()), root, manifest(entries));
  assert.equal(result.files, 1); assert.equal(await fs.readFile(path.join(root, '한글', '파일.txt'), 'utf8'), '원래 자료');
  assert.deepEqual(await fs.readdir(path.join(root, '빈 폴더')), []);
  assert.deepEqual((await fs.readdir(root)).sort(), ['빈 폴더', '한글'].sort());
});
test('truncated and silently missing whole entries are never marked complete', async () => {
  const entries = [{ name: 'first.txt', data: 'first' }, { name: 'second.txt', data: 'second' }];
  const data = await archive(entries);
  for (const broken of [data.subarray(0, 514), data.subarray(0, -1024), await archive(entries.slice(0, 1))]) {
    await assert.rejects(extractVerified(Readable.from([broken]), await fixture(), manifest(entries)));
  }
});
test('unexpected paths, symlinks, duplicates and sizes fail without escaping destination', async () => {
  const good = [{ name: 'file.txt', data: 'good' }];
  const scenarios = [
    [{ name: '../escape.txt', data: 'bad' }],
    [{ name: 'file.txt', type: 'symlink', linkname: '../../outside' }],
    [good[0], { name: 'FILE.txt', data: 'good' }],
    [{ name: 'file.txt', data: 'too much data' }]
  ];
  for (const entries of scenarios) await assert.rejects(extractVerified(Readable.from([await archive(entries)]), await fixture(), manifest(good)));
});
test('preflight counts each hardlink filename and rejects unsupported nodes before writes', async () => {
  const root = await fixture();
  const encode = rows => Readable.from([Buffer.from(rows.map(r => JSON.stringify(r)).join('\n'))]);
  const rows = [{ message_type: 'snapshot' }, ...['one', 'two'].map(name => ({ message_type: 'node', path: '/' + name, type: 'file', size: 1024, inode: 42 }))];
  const result = await readManifest(encode(rows), root); assert.equal(result.bytes, 2048); assert.equal(result.nodes.size, 2);
  await assert.rejects(readManifest(encode([...rows, { message_type: 'node', path: '/link', type: 'symlink' }]), root), /연결·특수/);
  assert.deepEqual(await fs.readdir(root), []);
});
test('existing files are never overwritten', async () => {
  const root = await fixture(); await fs.writeFile(path.join(root, 'file.txt'), 'original');
  const entries = [{ name: 'file.txt', data: 'replacement' }];
  await assert.rejects(extractVerified(Readable.from([await archive(entries)]), root, manifest(entries)), /비어 있는/);
  assert.equal(await fs.readFile(path.join(root, 'file.txt'), 'utf8'), 'original');
});
