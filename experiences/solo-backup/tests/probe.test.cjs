'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { selectSample, consumeSample, SAMPLE_BYTES } = require('../src/probe.cjs');
const id = 'a'.repeat(64);
const stream = values => Readable.from(values.map(x => Buffer.from(JSON.stringify(x) + '\n')));
const header = { message_type: 'snapshot', id };
const node = (path, size, type = 'file') => ({ message_type: 'node', type, path, size });

test('sample selection handles split Korean UTF-8, skips empty/large/link entries, and is deterministic', async () => {
  const lines = [header, node('/D/원본', 0, 'dir'), node('/D/원본/한글.txt', 13), node('/D/원본/empty', 0), node('/D/원본/model', SAMPLE_BYTES + 1), node('/D/원본/link', 1, 'symlink')];
  const bytes = Buffer.from(lines.map(JSON.stringify).join('\n'));
  const selected = await selectSample(Readable.from([...bytes].map(b => Buffer.from([b]))), id);
  assert.deepEqual(selected, { path: '/D/원본/한글.txt', size: 13 });
  const candidates = [node('/D/a', 5), node('/D/b', 8)];
  assert.deepEqual(await selectSample(stream([header, ...candidates]), id), await selectSample(stream([header, ...candidates.reverse()]), id));
  assert.equal(await selectSample(stream([header, node('/large', SAMPLE_BYTES + 1)]), id), null);
});
test('metadata limits stop unbounded work and malformed/traversal paths never reach dump', async () => {
  await assert.rejects(selectSample(stream([header, node('/a', 1), node('/b', 1)]), id, { maxNodes: 1 }), e => e.code === 'PROBE_LIMIT');
  await assert.rejects(selectSample(stream([header]), id, { maxBytes: 1 }), e => e.code === 'PROBE_LIMIT');
  for (const p of ['relative', '/D/../bad', '/D//bad', '/D/./bad', '/D/a\0b', '/D/a\\b']) await assert.rejects(selectSample(stream([header, node(p, 1)]), id));
  await assert.rejects(selectSample(stream([node('/a', 1)]), id));
  await assert.rejects(selectSample(stream([header, header]), id));
  await assert.rejects(selectSample(stream([header, node('/a', -1)]), id));
});
test('plaintext is consumed in memory, bounded, and short output waits for the process result', async () => {
  const bytes = Buffer.from('small authenticated file');
  const result = await consumeSample(Readable.from([bytes.subarray(0, 3), bytes.subarray(3)]), bytes.length);
  assert.equal(result.bytes, bytes.length); assert.equal(result.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.equal((await consumeSample(Readable.from([bytes]), bytes.length + 1)).bytes, bytes.length);
  await assert.rejects(consumeSample(Readable.from([bytes]), bytes.length - 1), e => e.code === 'PROBE_SIZE');
  await assert.rejects(consumeSample(Readable.from([]), SAMPLE_BYTES + 1), e => e.code === 'PROBE_SIZE');
  const broken = Readable.from((async function* () { yield bytes.subarray(0, 3); throw new Error('transport interrupted'); })());
  await assert.rejects(consumeSample(broken, bytes.length), /transport interrupted/);
});
