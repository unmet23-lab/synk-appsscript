'use strict';
/* PNG 쓰기 — RGBA 8bit 한 갈래만. 의존성 0.
 *
 * ■ 왜 있나: 이 저장소에는 PNG 를 «읽는» 것(`tools/lib/깊이격자.js` png읽기)은 있는데
 *   쓰는 것이 없었다. 2D 워프로 새 표정을 굽자면 픽셀을 다시 파일로 내야 한다(09-02).
 *   sharp·canvas 를 들이지 않는 까닭은 굽기 기계가 오프라인이고, 필요한 것이
 *   「RGBA 를 무손실로 한 장」뿐이라서다.
 *
 * ■ 필터는 0(없음)만 쓴다 — 파일이 조금 커지는 대신 코드가 단순하다.
 *   정본 자산이 아니라 «시안·중간 산출»을 내는 자리라 크기보다 단순함이 값이다.
 */
const zlib = require('zlib');

/** CRC32 — PNG 청크마다 필요하다(표는 한 번만 만든다). */
const crc표 = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crc표[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function 청크(형, 몸) {
  const 머리 = Buffer.alloc(8);
  머리.writeUInt32BE(몸.length, 0);
  머리.write(형, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(형, 'ascii'), 몸])), 0);
  return Buffer.concat([머리, 몸, crc]);
}

/**
 * RGBA 픽셀 버퍼 → PNG 버퍼.
 * @param {Buffer} rgba 길이 = 폭*높이*4
 * @param {number} 폭
 * @param {number} 높이
 * @param {number} [압축] zlib level (기본 9)
 */
function png쓰기(rgba, 폭, 높이, 압축 = 9) {
  if (rgba.length !== 폭 * 높이 * 4) {
    throw new Error(`픽셀 길이가 안 맞다: ${rgba.length} ≠ ${폭}×${높이}×4`);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(폭, 0);
  ihdr.writeUInt32BE(높이, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type 6 = RGBA
  const 줄들 = Buffer.alloc(높이 * (폭 * 4 + 1));
  for (let y = 0; y < 높이; y++) {
    줄들[y * (폭 * 4 + 1)] = 0;   // 필터 없음
    rgba.copy(줄들, y * (폭 * 4 + 1) + 1, y * 폭 * 4, (y + 1) * 폭 * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    청크('IHDR', ihdr),
    청크('IDAT', zlib.deflateSync(줄들, { level: 압축 })),
    청크('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { png쓰기, crc32 };
