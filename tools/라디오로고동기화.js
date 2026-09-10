#!/usr/bin/env node
'use strict';
/** 09-10 로고 반영: 기존 라디오 출력의 무대·마스코트 픽셀을 보존한다.
 * 전체 재생성은 현재 무대·표정까지 따라가므로, 검증된 로고 영역만 조립한다.
 * node tools/라디오로고동기화.js [--check]
 * Sharp는 설치된 번들 NODE_PATH에서 읽는다. 썸네일의 작은 로고는 현행 정밀 벡터다.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const sharp = require('sharp');
const ROOT = path.resolve(__dirname, '..');
const BASE = '51397715c5eb43c9abaa19f48978a7b853e7813d';
const THUMB_SOURCE = 'ccce39725d26f4e1186d51c65a30224cdfe4c432';
const targets = ['기본', 'dream_field', 'dream_water'].map(name => ({
  file: `docs/라디오/배경/${name}.png`, rect: { left: 30, top: 550, width: 180, height: 95 },
})).concat([{ file: 'docs/라디오/썸네일.png', rect: { left: 50, top: 550, width: 175, height: 135 } }]);
const blob = (rev, file) => execFileSync('git', ['show', `${rev}:${file}`], { cwd: ROOT, maxBuffer: 50e6 });
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const pixels = b => sharp(typeof b === 'string' ? fs.readFileSync(b) : b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

function thumbnail(temp) {
  // 기존 썸네일이 사용한 해변 무대는 당시 Git 원본으로 확인한다. 현행 무대 선택은 바꾸지 않는다.
  fs.writeFileSync(path.join(temp, 'citypop.png'), blob(THUMB_SOURCE, 'docs/라디오/무대/citypop.png'));
  let code = blob(THUMB_SOURCE, 'tools/라디오배경굽기.js').toString('utf8');
  const declaration = "const 무대방 = path.join(ROOT, 'docs/라디오/무대');";
  if (!code.includes(declaration)) throw new Error('기존 썸네일 무대 선언이 다르다');
  code = code.replace(declaration, `const 무대방 = ${JSON.stringify(temp)};`)
    .replaceAll("색갈래: '코랄'", "색갈래: '단색'")
    + '\nmodule.exports = { 썸네일지면, 굽기 };\n';
  const filename = path.join(__dirname, '라디오배경굽기.js');
  const sandbox = new Module(filename, module);
  sandbox.filename = filename;
  sandbox.paths = Module._nodeModulePaths(__dirname);
  sandbox._compile(code, filename);
  return sandbox.exports.굽기('thumbnail-logo-source', sandbox.exports.썸네일지면(), temp).png;
}

async function main() {
  const check = process.argv.includes('--check');
  const temp = check ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'synk-radio-logo-'));
  const thumb = check ? null : thumbnail(temp);
  const results = [];
  for (const { file, rect } of targets) {
    const original = blob(BASE, file);
    const before = await pixels(original);
    const current = await pixels(path.join(ROOT, file));
    const candidate = !check && file.endsWith('/썸네일.png') ? await pixels(thumb) : current;
    const w = before.info.width, h = before.info.height;
    if ([current, candidate].some(p => p.info.width !== w || p.info.height !== h)) throw new Error(`${file}: 캔버스 규격 변경`);
    let outside = 0, edge = 0;
    const next = Buffer.from(before.data);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const inside = x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height;
      const border = inside && (x === rect.left || x === rect.left + rect.width - 1 || y === rect.top || y === rect.top + rect.height - 1);
      const i = (y * w + x) * 4;
      if (!inside && !current.data.subarray(i, i + 4).equals(before.data.subarray(i, i + 4))) outside++;
      if (border && !candidate.data.subarray(i, i + 4).equals(before.data.subarray(i, i + 4))) edge++;
      if (inside) candidate.data.copy(next, i, i, i + 4);
    }
    if (edge) throw new Error(`${file}: 로고 영역 경계 ${edge}픽셀이 달라 기존 배경을 보존할 수 없다`);
    if (check && outside) throw new Error(`${file}: 로고 밖 ${outside}픽셀 변경`);
    if (!check) {
      const output = await sharp(next, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
      fs.writeFileSync(path.join(ROOT, file), output);
      const reread = await pixels(output);
      if (!reread.data.equals(next)) throw new Error(`${file}: 저장 왕복 픽셀 불일치`);
    }
    results.push({ file, baseline: BASE, originalSha256: hash(original), rect, repairedOutsidePixels: check ? 0 : outside, outsidePixels: 0, boundaryPixels: edge });
  }
  console.log(JSON.stringify({ check, results }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
