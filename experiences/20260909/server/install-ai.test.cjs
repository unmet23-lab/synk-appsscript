'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

test('a failed final SHA clears completed ranges and the same command downloads verified bytes on retry', async () => {
  // All files and HTTP responses below live in memory. No installer is run.
  const files = new Map(), descriptors = new Map(); let nextFd = 1, requests = 0;
  const good = Buffer.alloc(1024 * 1024, 23), bad = Buffer.alloc(good.length, 42);
  const asset = { name: 'fixture.gguf', size: good.length, sha: crypto.createHash('sha256').update(good).digest('hex'), url: 'https://fixture.invalid/model' };
  const fakeFs = {
    existsSync: file => files.has(file), statSync: file => ({ size: files.get(file).length }),
    readFileSync: (file, encoding) => encoding ? files.get(file).toString(encoding) : files.get(file),
    writeFileSync: (file, content) => files.set(file, Buffer.from(content)),
    renameSync(from, to) { assert.ok(files.has(from)); files.set(to, files.get(from)); files.delete(from); },
    unlinkSync: file => files.delete(file),
    openSync(file) { if (!files.has(file)) files.set(file, Buffer.alloc(0)); const fd = nextFd++; descriptors.set(fd, file); return fd; },
    closeSync: fd => descriptors.delete(fd), fstatSync: fd => ({ size: files.get(descriptors.get(fd)).length }),
    statfsSync: () => ({ bavail: 1000000, bsize: 4096 }),
    ftruncateSync(fd, size) { const old = files.get(descriptors.get(fd)), next = Buffer.alloc(size); old.copy(next, 0, 0, Math.min(old.length, size)); files.set(descriptors.get(fd), next); },
    writeSync(fd, bytes, offset, length, position) { bytes.copy(files.get(descriptors.get(fd)), position, offset, offset + length); return length; },
    createReadStream: file => Readable.from([files.get(file)]),
  };
  const module = { exports: {} };
  const mockRequire = name => name === 'node:fs' ? fakeFs : require(name); mockRequire.main = null;
  const source = fs.readFileSync(path.join(__dirname, '..', 'install-ai.cjs'), 'utf8');
  vm.runInNewContext(source + '\nmodule.exports.testDownload = download;', {
    module, exports: module.exports, require: mockRequire, Buffer, AbortController, setTimeout, clearTimeout,
    process: { env: { LOCALAPPDATA: 'C:/synk-in-memory-fixture' }, platform: 'win32', stdout: { write() {} } },
    async fetch(_url, options) {
      requests++; assert.equal(options.headers.Range, `bytes=0-${asset.size - 1}`);
      return { status: 206, headers: { get: () => `bytes 0-${asset.size - 1}/${asset.size}` }, body: Readable.from([good]) };
    },
  });
  const final = path.join(module.exports.destination, asset.name), part = final + '.part', journal = part + '.ranges.json';
  files.set(part, bad); files.set(journal, Buffer.from(JSON.stringify({ sha: asset.sha, chunkSize: good.length, completed: [0] })));
  await assert.rejects(module.exports.testDownload(asset), error => /SHA256/.test(error.message) && /같은 명령/.test(error.message));
  assert.equal(requests, 0); assert.equal(files.has(final), false, 'unverified bytes must never be promoted');
  assert.deepEqual(JSON.parse(files.get(journal).toString()).completed, []);
  assert.equal(await module.exports.testDownload(asset), final); assert.equal(requests, 1);
  assert.equal(crypto.createHash('sha256').update(files.get(final)).digest('hex'), asset.sha);
  assert.equal(files.has(part), false); assert.equal(files.has(journal), false); assert.equal(descriptors.size, 0);
});
