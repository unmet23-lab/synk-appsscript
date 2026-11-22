'use strict';
// BLAKE2b-512(RFC 7693)를 OpenSSL 없이 셈한다(2026-11-23).
// Electron은 BoringSSL을 써서 crypto.createHash('blake2b512')가 「Digest method not supported」를 던진다.
// minisign(Tauri 업데이터 서명)은 파일의 BLAKE2b-512에 서명하므로, 솔리오 백업 방(solio-backup.cjs)이 받은 엔진 설치 파일을
// 확인하려면 이 셈이 본체 프로세스 안에서 돌아야 한다. 열쇠 없이 64바이트 결과만 낸다.
// 64비트 낱말 하나를 Uint32Array의 두 칸(낮은 쪽, 높은 쪽)에 둔다. 시험: desktop/tests/blake2b.test.cjs(Node의 OpenSSL 값과 견줌),
// desktop/tests/solio-backup-electron.test.cjs(Electron 안에서).

const BLOCK = 128;
const OUT = 64;

// SHA-512의 처음 값과 같은 IV 여덟 낱말(RFC 7693 2.6). 각 낱말은 [낮은 32비트, 높은 32비트]
const IV = new Uint32Array([
  0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85, 0xfe94f82b, 0x3c6ef372, 0x5f1d36f1, 0xa54ff53a,
  0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c, 0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19,
]);

// 낱말 차례표(RFC 7693 2.7). 열두 번 돌며 10번째와 11번째는 0번째와 1번째를 다시 쓴다.
// Uint32Array 칸 번호로 바로 쓰게 2를 곱해 둔다
const SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
].map(row => Uint8Array.from(row, i => i * 2));

/* 섞기 G(RFC 7693 3.1). a · b · c · d는 v의 칸 번호(낱말 번호 × 2), x · y는 m의 칸 번호.
   더하기는 낮은 쪽이 넘치면(결과가 더한 값보다 작아지면) 높은 쪽에 1을 올린다. 돌리기는 32 · 24 · 16 · 63비트 */
function mix(v, m, a, b, c, d, x, y) {
  let a0 = v[a], a1 = v[a + 1], b0 = v[b], b1 = v[b + 1], c0 = v[c], c1 = v[c + 1], d0 = v[d], d1 = v[d + 1], lo, t0, t1;
  // a = a + b + x
  lo = (a0 + b0) >>> 0; a1 = (a1 + b1 + (lo < a0 ? 1 : 0)) >>> 0; a0 = lo;
  lo = (a0 + m[x]) >>> 0; a1 = (a1 + m[x + 1] + (lo < a0 ? 1 : 0)) >>> 0; a0 = lo;
  // d = (d ^ a) >>> 32
  t0 = (d0 ^ a0) >>> 0; t1 = (d1 ^ a1) >>> 0; d0 = t1; d1 = t0;
  // c = c + d
  lo = (c0 + d0) >>> 0; c1 = (c1 + d1 + (lo < c0 ? 1 : 0)) >>> 0; c0 = lo;
  // b = (b ^ c) >>> 24
  t0 = b0 ^ c0; t1 = b1 ^ c1; b0 = ((t0 >>> 24) | (t1 << 8)) >>> 0; b1 = ((t1 >>> 24) | (t0 << 8)) >>> 0;
  // a = a + b + y
  lo = (a0 + b0) >>> 0; a1 = (a1 + b1 + (lo < a0 ? 1 : 0)) >>> 0; a0 = lo;
  lo = (a0 + m[y]) >>> 0; a1 = (a1 + m[y + 1] + (lo < a0 ? 1 : 0)) >>> 0; a0 = lo;
  // d = (d ^ a) >>> 16
  t0 = d0 ^ a0; t1 = d1 ^ a1; d0 = ((t0 >>> 16) | (t1 << 16)) >>> 0; d1 = ((t1 >>> 16) | (t0 << 16)) >>> 0;
  // c = c + d
  lo = (c0 + d0) >>> 0; c1 = (c1 + d1 + (lo < c0 ? 1 : 0)) >>> 0; c0 = lo;
  // b = (b ^ c) >>> 63, 곧 왼쪽으로 1비트
  t0 = b0 ^ c0; t1 = b1 ^ c1; b0 = ((t0 << 1) | (t1 >>> 31)) >>> 0; b1 = ((t1 << 1) | (t0 >>> 31)) >>> 0;
  v[a] = a0; v[a + 1] = a1; v[b] = b0; v[b + 1] = b1; v[c] = c0; v[c + 1] = c1; v[d] = d0; v[d + 1] = d1;
}

/* 압축 F(RFC 7693 3.2). 블록은 buf[off .. off+127]이고, count는 이 블록까지 넣은 바이트 수다 */
function compress(state, buf, off, count, last) {
  const { h, v, m } = state;
  for (let i = 0; i < 16; i++) { v[i] = h[i]; v[i + 16] = IV[i]; }
  // 바이트 수(128비트 셈의 아래 64비트. 2^53 바이트를 넘지 않는다)를 v[12]에 섞는다
  v[24] ^= count >>> 0;
  v[25] ^= Math.floor(count / 0x100000000) >>> 0;
  if (last) { v[28] = ~v[28]; v[29] = ~v[29]; }
  for (let i = 0; i < 32; i++) {
    const j = off + i * 4;
    m[i] = buf[j] | (buf[j + 1] << 8) | (buf[j + 2] << 16) | (buf[j + 3] << 24);
  }
  for (let round = 0; round < 12; round++) {
    const s = SIGMA[round % 10];
    mix(v, m, 0, 8, 16, 24, s[0], s[1]);
    mix(v, m, 2, 10, 18, 26, s[2], s[3]);
    mix(v, m, 4, 12, 20, 28, s[4], s[5]);
    mix(v, m, 6, 14, 22, 30, s[6], s[7]);
    mix(v, m, 0, 10, 20, 30, s[8], s[9]);
    mix(v, m, 2, 12, 22, 24, s[10], s[11]);
    mix(v, m, 4, 14, 16, 26, s[12], s[13]);
    mix(v, m, 6, 8, 18, 28, s[14], s[15]);
  }
  for (let i = 0; i < 16; i++) h[i] ^= v[i] ^ v[i + 16];
}

/* crypto.createHash와 같은 꼴로 쓴다: update(조각)를 몇 번이고 부르고 digest()를 한 번 부른다 */
function createBlake2b512() {
  const h = new Uint32Array(IV);
  // 매개변수 블록의 첫 낱말: 결과 길이 64, 열쇠 길이 0, fanout 1, depth 1
  h[0] ^= 0x01010000 ^ OUT;
  const state = { h, v: new Uint32Array(32), m: new Uint32Array(32) };
  const block = new Uint8Array(BLOCK);
  let filled = 0, count = 0, done = false;
  return {
    update(data) {
      if (done) throw Error('BLAKE2b digest already called');
      if (typeof data === 'string') data = Buffer.from(data, 'utf8');
      if (!(data instanceof Uint8Array)) throw TypeError('BLAKE2b update takes bytes');
      const n = data.length;
      let i = 0;
      while (i < n) {
        // 채운 블록은 뒤에 바이트가 더 올 때만 압축한다. 마지막 블록은 끝 표시와 함께 digest에서 압축한다
        if (filled === BLOCK) { count += BLOCK; compress(state, block, 0, count, false); filled = 0; }
        if (filled === 0 && n - i > BLOCK) { count += BLOCK; compress(state, data, i, count, false); i += BLOCK; continue; }
        const take = Math.min(BLOCK - filled, n - i);
        block.set(data.subarray(i, i + take), filled);
        filled += take; i += take;
      }
      return this;
    },
    digest(encoding) {
      if (done) throw Error('BLAKE2b digest already called');
      done = true;
      count += filled;
      block.fill(0, filled);
      compress(state, block, 0, count, true);
      const out = Buffer.alloc(OUT);
      for (let i = 0; i < 16; i++) out.writeUInt32LE(h[i], i * 4);
      return encoding ? out.toString(encoding) : out;
    },
  };
}

module.exports = { createBlake2b512 };
