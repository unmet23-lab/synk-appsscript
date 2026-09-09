// Existing assets only: deterministic canvas contact sheets, no AI redraw/cropping.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const root = path.resolve(__dirname, '../../..');
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'docs/디자인_토큰.json'), 'utf8'));
const colors = Object.fromEntries(tokens.색.킷.map(x => [x.이름, x.hex]));
const rhythm = Object.fromEntries(Object.entries(tokens.율.단계).map(([k, v]) => [k, v.px]));
const fonts = 'docs/브랜드_폰트';
for (const [file, name] of [
  ['SUIT/SUIT-Medium.otf', 'Gallery KR'],
  ['SUIT/SUIT-ExtraBold.otf', 'Gallery Head'],
  ['InterTight/InterTight-Medium.ttf', 'Gallery Latin'],
  ['DM_Mono/DMMono-Medium.ttf', 'Gallery Number'],
]) {
  if (!GlobalFonts.registerFromPath(path.join(root, fonts, file), name)) throw new Error(`Font missing: ${file}`);
}
const entries = [
  [1, '보름달 한옥 마당', 'docs/라디오/무대/chuseok.png'],
  [2, '네온 물가', 'docs/라디오/무대/보관/전자_네온물가.png'],
  [11, '거울 수면과 문', 'docs/라디오/무대/dream_water.png'],
  [13, '반딧불 노을 들판', 'docs/라디오/무대/dream_field.png'],
  [17, '내 방 밤', 'docs/Loom_자산/구움/공방_내방밤.png'],
  [29, '별 보는 지붕', 'docs/Loom_자산/구움/공방_별보는지붕.png'],
  [28, '차강사르 게르', 'docs/Loom_자산/구움/공방_차강사르게르.png'],
  [27, '가을 언덕', 'docs/Loom_자산/구움/공방_가을언덕.png'],
  [21, '운동장', 'docs/Loom_자산/구움/공방_운동장.png'],
  [16, '내 방 낮', 'docs/Loom_자산/구움/공방_내방낮.png'],
].map(([number, name, source]) => ({ number, name, source }));

const P = rhythm.켜, GAP = rhythm.단, CW = rhythm.장 * 8;
const IH = rhythm.장 * 5, LABEL = rhythm.장, TOP = rhythm.막 + rhythm.장;
const COLS = 2;
const W = P * 2 + CW * COLS + GAP * (COLS - 1);
const H = TOP + (IH + LABEL) * 5 + GAP * 4 + rhythm.막;
const audit = [];
function text(ctx, str, x, y, size, face, color) {
  ctx.font = `${size}px ${face === 'Gallery KR' ? '"Gallery Latin", ' : ''}"${face}"`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.fillText(str, x, y);
}
async function sheet(items, title, subtitle, footer, output) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colors.Paper;
  ctx.fillRect(0, 0, W, H);
  text(ctx, title, P, P, 48, 'Gallery Head', colors.Ink);
  text(ctx, subtitle, P, P + rhythm.장, 28, 'Gallery KR', colors['Deep Wool']);
  for (let i = 0; i < items.length; i++) {
    const item = items[i], src = path.join(root, item.source);
    const bytes = fs.readFileSync(src);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const meta = await sharp(bytes).metadata();
    const thumb = await sharp(bytes).resize(CW, IH, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    const img = await loadImage(thumb);
    const x = P + (i % COLS) * (CW + GAP), y = TOP + Math.floor(i / COLS) * (IH + LABEL + GAP);
    ctx.fillStyle = colors.Oat;
    ctx.fillRect(x, y, CW, IH);
    const ix = x + (CW - img.width) / 2, iy = y + (IH - img.height) / 2;
    ctx.drawImage(img, ix, iy);
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ix + 0.5, iy + 0.5, img.width - 1, img.height - 1);
    const labelY = y + IH + rhythm.칸;
    text(ctx, String(item.number).padStart(2, '0'), x, labelY, 32, 'Gallery Number', colors.Ink);
    ctx.font = '32px "Gallery KR"';
    if (ctx.measureText(item.name).width > CW - rhythm.장) throw new Error(`Label overflow: ${item.name}`);
    text(ctx, item.name, x + rhythm.장, labelY, 32, 'Gallery KR', colors.Ink);
    audit.push({ ...item, sha256: hash, width: meta.width, height: meta.height, imageBox: { x: ix, y: iy, width: img.width, height: img.height }, sheet: output });
    if (crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex') !== hash) throw new Error(`Source changed: ${src}`);
  }
  text(ctx, footer, P, H - rhythm.장, 26, 'Gallery KR', colors['Deep Wool']);
  const dest = path.join(__dirname, output);
  fs.writeFileSync(dest, canvas.toBuffer('image/png'));
  const result = await sharp(dest).metadata();
  if (result.width !== W || result.height !== H) throw new Error('Output dimension mismatch');
  console.log(JSON.stringify({ file: dest, width: W, height: H, count: items.length, bytes: fs.statSync(dest).size }));
}
(async () => {
  if (entries.length !== 10 || new Set(entries.map(x => x.number)).size !== 10) throw new Error('Inventory mismatch');
  await sheet(entries, '남겨 둔 배경 10개', '2026.09.09 선택 · 기존 번호와 원본 유지', '선택한 순서대로 정리했습니다. 21번은 사용 전 기존 검수 사항 재확인.', '선택한_배경10개.png');
  fs.writeFileSync(path.join(__dirname, '원본대조.json'), JSON.stringify({ sourceUnchanged: true, fit: 'inside-no-crop', count: audit.length, entries: audit }, null, 2) + '\n');
})().catch(err => { console.error(err); process.exitCode = 1; });
