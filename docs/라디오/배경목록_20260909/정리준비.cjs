'use strict';
// Read-only asset scan; produces an exact deletion manifest for manual review.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, '원본대조.json'), 'utf8'));
const keepNumbers = [1, 2, 11, 13, 17, 29, 28, 27, 21, 16];
const original = inventory.entries;
if (original.length !== 30) throw new Error('Use the original 30-entry inventory before cleanup.');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const protectedFiles = new Map();
function protect(rel, reason) {
  const abs = path.resolve(root, rel);
  if (fs.existsSync(abs)) protectedFiles.set(rel, { path: rel, sha256: sha(abs), reason });
}
for (const row of original.filter(x => keepNumbers.includes(x.number))) {
  if (sha(path.join(root, row.source)) !== row.sha256) throw new Error(`Selected source changed: ${row.source}`);
  protect(row.source, `保留 ${row.number} ${row.name}`);
  if (row.number >= 16) protect(row.source.replace(/\.png$/, '.avif'), `Selected ${row.number} derivative`);
}
for (const name of ['추석보름달마당', '전자네온물가']) protect(`docs/Loom_자산/무대/${name}.webp`, 'Selected shared stage');
for (const name of ['층_chuseok.mp4', '층_house.mp4', '추석_자연생동_20260909.mp4', '추석_자연생동_20260909_v2.mp4', '추석_영상생성_20260909.mp4', '추석_나무고정_조명_20260909.mp4']) protect(`docs/라디오/무대영상/${name}`, 'Selected scene video');
protect('docs/라디오/무대영상/덮개붙임/덮개붙임_층_house.mp4', 'Selected neon water video');
protect('docs/라디오/무대영상/덮개붙임/덮개붙임_층_chuseok.mp4', 'Selected Chuseok video');
for (const file of ['bots/오버레이/방송층.html', 'bots/오버레이/라디오표정리듬.js', 'bots/오버레이/라디오가장자리.js']) protect(file, 'Current mascot expression/edge runtime');
const candidates = new Map();
function add(rel, reason) {
  const normalized = rel.split(path.sep).join('/');
  const abs = path.resolve(root, normalized);
  if (!abs.startsWith(root + path.sep)) throw new Error(`Out of workspace: ${rel}`);
  if (protectedFiles.has(normalized)) throw new Error(`Protected collision: ${rel}`);
  if (!fs.existsSync(abs)) return;
  const stat = fs.lstatSync(abs);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Not a regular file: ${rel}`);
  candidates.set(normalized, { path: normalized, reason, bytes: stat.size, sha256: sha(abs) });
}
for (const row of original.filter(x => !keepNumbers.includes(x.number))) add(row.source, `Removed scene ${row.number}: ${row.name}`);
const places = ['옷가게안', '교실', '복도', '우편함앞', '창가책상', '눈오는창', '봄들판', '여름바다', '카페안'];
for (const key of places) {
  for (const suffix of ['.png', '.avif', '_누끼.png']) add(`docs/Loom_자산/구움/공방_${key}${suffix}`, 'Deleted shared place and direct derivative');
  add(`영상/public/공방/공방_${key}.avif`, 'Public asset copy of deleted place');
}
const stages = ['시티팝노을휴양지', '전자밤도시', '차분달빛호수', '드림하늘', '드림물결', '드림들판', '집안밤공부'];
for (const key of stages) {
  add(`docs/Loom_자산/무대/${key}.webp`, 'Deleted shared indoor stage');
  add(`docs/Loom_자산/구움/라디오무대_${key}.avif`, 'Deleted stage AVIF');
  add(`영상/public/공방/라디오무대_${key}.avif`, 'Public copy of deleted stage');
}
// house.png is the removed felt night city (#6); layer_house is neon water (#2).
for (const key of ['citypop', 'city', 'calm', 'dream_sky', 'house']) {
  add(`docs/라디오/무대/${key}.png`, 'Removed radio still');
  add(`docs/라디오/배경/${key}.png`, 'Removed radio background composition');
}
// Videos are added only after a separate actual-frame audit, not by stem matching.
for (const file of ['01-15_라디오배경.png', '16-30_공간배경.png']) add(`docs/라디오/배경목록_20260909/${file}`, 'Superseded 30-scene contact sheet');
const result = {
  userApprovedSharedSourceDeletion: true,
  keepNumbers,
  removedNumbers: original.filter(x => !keepNumbers.includes(x.number)).map(x => x.number),
  method: 'Windows Recycle Bin; exact validated file paths only',
  exclusions: ['Completed marketing artwork and embedded document assets', 'Music and current live server data', 'Standalone transparent mascot/booth overlay assets'],
  protected: [...protectedFiles.values()],
  files: [...candidates.values()],
};
fs.writeFileSync(path.join(__dirname, '삭제계획.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ files: result.files.length, bytes: result.files.reduce((s, x) => s + x.bytes, 0), keepNumbers, removedNumbers: result.removedNumbers, protected: result.protected.length }));
