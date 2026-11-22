'use strict';
// BLAKE2b-512 직접 셈(src/blake2b.cjs)의 시험. RFC 7693의 시험 값과 Node(OpenSSL)의 blake2b512를 기준으로 삼는다.
// Electron 안에서 같은 셈이 도는지는 solio-backup-electron.test.cjs가 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createBlake2b512 } = require('../src/blake2b.cjs');

const openssl = data => crypto.createHash('blake2b512').update(data).digest('hex');
const mine = data => createBlake2b512().update(data).digest('hex');

test('RFC 7693 Appendix A: BLAKE2b-512("abc")', () => {
  assert.equal(mine(Buffer.from('abc')),
    'ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d1' +
    '7d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923');
  assert.equal(createBlake2b512().update('abc').digest().length, 64, 'a Buffer of 64 bytes without an encoding');
});

test('the same digest as OpenSSL at the empty input and around the 128-byte block edge', () => {
  for (const size of [0, 1, 64, 127, 128, 129, 255, 256, 257, 383, 384, 385]) {
    const data = crypto.randomBytes(size);
    assert.equal(mine(data), openssl(data), `${size} bytes`);
  }
});

test('the same digest as OpenSSL for several megabytes fed in uneven pieces, as a file stream does', () => {
  const data = crypto.randomBytes(5 * 1024 * 1024 + 77);
  const hash = createBlake2b512();
  // 블록 경계에 맞지 않는 조각과 빈 조각, 64KiB 조각을 섞는다
  const sizes = [0, 1, 127, 128, 129, 65536, 3, 0, 1000003];
  for (let at = 0, i = 0; at < data.length; i++) {
    const size = Math.min(sizes[i % sizes.length], data.length - at);
    hash.update(data.subarray(at, at + size));
    at += size;
  }
  assert.equal(hash.digest('hex'), openssl(data));
});

test('a view into a larger buffer is read from its own offset', () => {
  const backing = crypto.randomBytes(1000);
  const view = backing.subarray(333, 333 + 500);
  assert.equal(mine(view), openssl(Buffer.from(view)));
  assert.equal(mine(new Uint8Array(backing.buffer, backing.byteOffset + 7, 300)), openssl(backing.subarray(7, 307)));
});

test('digest once; non-byte input is refused', () => {
  const hash = createBlake2b512().update(Buffer.from('x'));
  hash.digest();
  assert.throws(() => hash.digest(), /already/);
  assert.throws(() => hash.update(Buffer.from('y')), /already/);
  assert.throws(() => createBlake2b512().update(12), /bytes/);
});
