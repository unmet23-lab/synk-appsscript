// 픽셀아트 → PNG 인코더 (의존성 0 — Node 내장 zlib만)
// 사용: node pixelpng.js sprites.js outdir [scale]
// sprites.js는 module.exports = [{ name, palette: {문자: '#RRGGBB'|'#RRGGBBAA'|null}, grid: ['...','...'] }]
'use strict';
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function hexToRgba(hex) {
  if (!hex) return [0, 0, 0, 0]; // 투명
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return [r, g, b, a];
}

function encodePng(grid, palette, scale) {
  const h = grid.length, w = grid[0].length;
  const W = w * scale, H = h * scale;
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    const rowStart = y * (1 + W * 4);
    raw[rowStart] = 0; // 필터 없음
    const gy = Math.floor(y / scale);
    for (let x = 0; x < W; x++) {
      const gx = Math.floor(x / scale);
      const ch = grid[gy][gx];
      const rgba = palette['_' + ch] || hexToRgba(palette[ch]);
      palette['_' + ch] = rgba; // 캐시
      const o = rowStart + 1 + x * 4;
      raw[o] = rgba[0]; raw[o + 1] = rgba[1]; raw[o + 2] = rgba[2]; raw[o + 3] = rgba[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function main() {
  const [spriteFile, outdir, scaleArg] = process.argv.slice(2);
  const scale = Number(scaleArg) || 20;
  const sprites = require(path.resolve(spriteFile));
  fs.mkdirSync(outdir, { recursive: true });
  const b64 = {};
  for (const s of sprites) {
    const widths = new Set(s.grid.map(r => r.length));
    if (widths.size !== 1) throw new Error(s.name + ': 행 길이 불일치 ' + [...widths]);
    for (const row of s.grid) for (const ch of row) {
      if (!(ch in s.palette)) throw new Error(s.name + ": 팔레트에 없는 문자 '" + ch + "'");
    }
    const png = encodePng(s.grid, { ...s.palette }, scale);
    fs.writeFileSync(path.join(outdir, s.name + '.png'), png);
    b64[s.name] = png.toString('base64');
    console.log(s.name + '.png  ' + s.grid[0].length + 'x' + s.grid.length + ' @' + scale + 'x  ' + png.length + ' bytes');
  }
  fs.writeFileSync(path.join(outdir, 'base64.json'), JSON.stringify(b64, null, 1));
  console.log('base64.json 저장 — 총 ' + Object.values(b64).reduce((a, v) => a + v.length, 0) + ' chars');
}
main();
