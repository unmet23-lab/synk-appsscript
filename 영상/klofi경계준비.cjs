#!/usr/bin/env node
'use strict';

// 승인된 까몽 8컷의 표시 전용 경계만 PNG로 굽는다. 원본/모듈/장면은 수정하지 않는다.
// 정본: docs/캐릭터/캐릭터_생명감_설계.md §1-a.
// 실행: NODE_PATH=<bundled node_modules> node 영상/klofi경계준비.cjs --out <absolute public/klofi20260909>
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'public', 'klofi20260909');
const SOURCE = 'docs/Loom_자산/라디오차림/까몽/_후보/여름델+전설의팻말/65f92a753bb5416b';
const RECORD = 'docs/_ops/라디오생동_20260909/털고정/라이브반영.json';
const MODULE = 'bots/오버레이/라디오가장자리.js';
const MODULE_SHA = 'b76f448ab55af135a5e2dc652683fc721edfc35ceaad7ae1af4bcac138a25a58';
const EXPRESSIONS = ['본체', '눈감음', '눈웃음', '궁금함', '집중', '안도', '응원', '놀람'];
const OPTIONS = {opaqueRim: true, softAlpha: true, protect: [[180,430,280,665], [620,445,716,577], [281,431,620,750]]};
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const relative = file => path.relative(ROOT, file).split(path.sep).join('/');
const insist = (test, message) => { if (!test) throw new Error(message); };
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

function outputPath(argv) {
  insist(argv.length === 2 && argv[0] === '--out', '사용법: node 영상/klofi경계준비.cjs --out <절대 public/klofi20260909 경로>');
  insist(path.isAbsolute(argv[1]), '--out은 절대 경로만 허용합니다.');
  const destination = path.resolve(argv[1]);
  insist(samePath(destination, OUT), '출력은 이 작업본의 영상/public/klofi20260909로 한정합니다.');
  // 기존 폴더가 다른 위치를 가리키는 링크면 쓰지 않는다.
  if (fs.existsSync(destination)) insist(samePath(fs.realpathSync(destination), destination), '출력 폴더의 실제 경로가 다릅니다.');
  else insist(samePath(fs.realpathSync(path.dirname(destination)), path.dirname(destination)), '출력 상위 폴더의 실제 경로가 다릅니다.');
  return destination;
}

function alphaDifference(a, b) {
  insist(a.length === b.length, '알파 대조 크기가 다릅니다.');
  let count = 0;
  for (let i = 3; i < a.length; i += 4) if (a[i] !== b[i]) count++;
  return count;
}

function pixelDiff(a, b, i) {
  return a[i] !== b[i] || a[i+1] !== b[i+1] || a[i+2] !== b[i+2] || a[i+3] !== b[i+3];
}

function changes(input, derived, inputBase, derivedBase, width, recipeMask) {
  let changed = 0, outsideRecipe = 0, protectedChanged = 0, outsideOriginalExpressionDelta = 0;
  for (let p = 0; p < input.length / 4; p++) {
    const i = p * 4;
    if (pixelDiff(input, derived, i)) {
      changed++;
      if (!recipeMask[p]) outsideRecipe++;
      const x = p % width, y = Math.floor(p / width);
      if (OPTIONS.protect.some(([x0,y0,x1,y1]) => x >= x0 && x < x1 && y >= y0 && y < y1)) protectedChanged++;
    }
    if (pixelDiff(derivedBase, derived, i) && !pixelDiff(inputBase, input, i)) outsideOriginalExpressionDelta++;
  }
  return {changedPixels: changed, changedOutsideRecipe: outsideRecipe, protectedChangedPixels: protectedChanged,
    changedFromBaseOutsideOriginalExpressionDelta: outsideOriginalExpressionDelta};
}

async function prepare(destination) {
  destination = outputPath(['--out', destination]);
  const modulePath = path.join(ROOT, MODULE), recordPath = path.join(ROOT, RECORD);
  const moduleBytes = fs.readFileSync(modulePath), recordBytes = fs.readFileSync(recordPath);
  insist(sha256(moduleBytes) === MODULE_SHA, '승인 경계 모듈 SHA가 다릅니다.');
  const record = JSON.parse(recordBytes.toString('utf8').replace(/^\uFEFF/, ''));
  insist(record.applied === true && Array.isArray(record.files), '채택 기록의 적용 상태/파일 목록을 확인할 수 없습니다.');
  const moduleEntry = record.files.filter(f => f.path.endsWith('/bots/오버레이/라디오가장자리-b76f448ab55a.js'));
  insist(moduleEntry.length === 1 && moduleEntry[0].sha256 === MODULE_SHA, '라이브 채택 기록의 모듈 지문이 다릅니다.');
  const approvedImages = record.files.filter(f => f.path.includes('/' + SOURCE + '/') && f.path.endsWith('.webp'));
  insist(approvedImages.length === EXPRESSIONS.length, '승인 WebP 분모가 8이 아닙니다.');
  const edge = require(modulePath);
  const frames = [];
  for (const expression of EXPRESSIONS) {
    const sourcePath = path.join(ROOT, SOURCE, `여름델+전설의팻말_${expression}.webp`);
    const approved = approvedImages.filter(f => f.path.endsWith('/' + relative(sourcePath)));
    const bytes = fs.readFileSync(sourcePath), inputSha = sha256(bytes);
    insist(approved.length === 1 && approved[0].sha256 === inputSha, `${expression}: 승인 원본 SHA 불일치`);
    const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    insist(decoded.info.width === 1024 && decoded.info.height === 1024 && decoded.info.channels === 4, `${expression}: 승인 RGBA 규격 불일치`);
    frames.push({expression, sourcePath, inputSha, sizeBytes: bytes.length, ...decoded});
  }
  const base = frames[0];
  // 한 본체에서 한 번 계산한다. 표정별 경계 재추정, 전체 blur/resize/색보정은 없다.
  const recipe = edge.만들기(base.data, base.info.width, base.info.height, 12, OPTIONS);
  insist(recipe.indices.length === 29213, '승인 경계2의 29,213픽셀과 다릅니다.');
  const recipeMask = new Uint8Array(base.info.width * base.info.height);
  for (const index of recipe.indices) recipeMask[index] = 1;
  let derivedBase;
  const outputs = [], files = [];
  for (const frame of frames) {
    const inputAlpha = alphaDifference(base.data, frame.data);
    insist(inputAlpha === 0, `${frame.expression}: 원본 공통 알파 불일치`);
    const derived = Buffer.from(edge.적용(frame.data, recipe));
    if (!derivedBase) derivedBase = derived;
    const derivedAlpha = alphaDifference(derivedBase, derived);
    const stats = changes(frame.data, derived, base.data, derivedBase, base.info.width, recipeMask);
    insist(derivedAlpha === 0 && stats.changedOutsideRecipe === 0 && stats.protectedChangedPixels === 0 && stats.changedFromBaseOutsideOriginalExpressionDelta === 0,
      `${frame.expression}: 공통 경계/재질 보존 검사 실패`);
    const png = await sharp(derived, {raw: {width: frame.info.width, height: frame.info.height, channels: 4}})
      .png({compressionLevel: 9, palette: false, adaptiveFiltering: false}).toBuffer();
    const decodedPng = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    insist(decodedPng.data.equals(derived) && decodedPng.info.width === 1024 && decodedPng.info.height === 1024, `${frame.expression}: PNG 무손실 재개봉 불일치`);
    const output = path.join(destination, `dj-${frame.expression}.png`);
    outputs.push({path: output, bytes: png, sha256: sha256(png)});
    files.push({expression: frame.expression,
      input: {path: relative(frame.sourcePath), sha256: frame.inputSha, sizeBytes: frame.sizeBytes, width: 1024, height: 1024},
      output: {path: relative(output), sha256: sha256(png), sizeBytes: png.length, width: 1024, height: 1024, channels: 4, format: 'PNG'},
      checks: {inputAlphaDifferenceFromBase: inputAlpha, derivedAlphaDifferenceFromBase: derivedAlpha, losslessPngRoundTrip: true, ...stats}});
  }
  function inputsUnchanged() {
    insist(sha256(fs.readFileSync(modulePath)) === MODULE_SHA, '처리 중 모듈 변경 감지');
    insist(sha256(fs.readFileSync(recordPath)) === sha256(recordBytes), '처리 중 채택 기록 변경 감지');
    for (const frame of frames) insist(sha256(fs.readFileSync(frame.sourcePath)) === frame.inputSha, `${frame.expression}: 처리 중 원본 변경 감지`);
  }
  inputsUnchanged();
  const manifest = {version: 1, createdAt: new Date().toISOString(), baselineHead: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8', windowsHide: true}).trim(),
    purpose: '승인 까몽 8표정의 표시 전용 경계2를 Remotion용 무손실 PNG로 변환. 원본과 모듈은 불변.',
    scope: '로컬 자산 제작. 합성 영상·실제 표시 크기 반복 재생·방송 반영의 검수는 포함하지 않음.',
    approval: {path: RECORD, sha256: sha256(recordBytes), at: record.at},
    module: {path: MODULE, sha256: MODULE_SHA},
    recipe: {computedFrom: '본체', computationCount: 1, width: 1024, height: 1024, radius: 12, ...OPTIONS, pixelCount: recipe.indices.length,
      indicesSha256: sha256(Buffer.from(recipe.indices.buffer, recipe.indices.byteOffset, recipe.indices.byteLength)),
      rgbaSha256: sha256(Buffer.from(recipe.colors.buffer, recipe.colors.byteOffset, recipe.colors.byteLength))},
    checks: {approvedInputCount: files.length, originalFilesUnchanged: true, moduleUnchanged: true, approvalRecordUnchanged: true,
      allAlphaDifferencesZero: true, protectedChangesZero: true, outsideRecipeChangesZero: true, allPngRoundTripsExact: true},
    files};
  fs.mkdirSync(destination, {recursive: true});
  const manifestPath = path.join(destination, '경계-source.json');
  // 출력 이름은 이 작업 소유의 8 PNG와 명세 하나뿐이다. 기존 WebP/다른 자산은 보존한다.
  for (const file of [...outputs.map(o => o.path), manifestPath])
    if (fs.existsSync(file)) insist(!fs.lstatSync(file).isSymbolicLink(), '출력 파일 링크를 덮어쓰지 않습니다: ' + file);
  for (const output of outputs) {
    fs.writeFileSync(output.path, output.bytes);
    insist(sha256(fs.readFileSync(output.path)) === output.sha256, '출력 재개봉 SHA 불일치: ' + output.path);
  }
  inputsUnchanged();
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(manifestPath, manifestBytes);
  insist(fs.readFileSync(manifestPath).equals(manifestBytes), '명세 재개봉 불일치');
  return {outputDirectory: destination, count: files.length, recipePixels: recipe.indices.length,
    allAlphaDifferencesZero: true, originalFilesUnchanged: true, manifest: manifestPath};
}

if (require.main === module) {
  Promise.resolve().then(() => prepare(outputPath(process.argv.slice(2))))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => {console.error(error.message); process.exitCode = 1;});
}
module.exports = {outputPath, alphaDifference, prepare};
