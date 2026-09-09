'use strict';
// Frame audit: house is retained neon water; dream_water/field videos are retired indoor scenes.
// Original outdoor dream_water.png/dream_field.png are explicitly protected in the first manifest.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, '삭제계획.json'), 'utf8'));
plan.files = [];
for (const key of ['citypop', 'city', 'calm', 'dream_sky', 'study', 'dream_water', 'dream_field']) {
  for (const rel of [`docs/라디오/무대영상/층_${key}.mp4`, `docs/라디오/무대영상/덮개붙임/덮개붙임_층_${key}.mp4`]) {
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep) || plan.protected.some(x => x.path === rel)) throw new Error('Unsafe video target');
    if (!fs.existsSync(abs)) continue;
    const item = fs.lstatSync(abs);
    if (!item.isFile() || item.isSymbolicLink()) throw new Error('Video is not a regular file');
    plan.files.push({ path: rel, reason: 'Video of removed background; indoor dream_water/field distinct from retained outdoor PNGs', bytes: item.size, sha256: crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex') });
  }
}
fs.writeFileSync(path.join(__dirname, '영상삭제계획.json'), JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify({ files: plan.files.length, bytes: plan.files.reduce((a, b) => a + b.bytes, 0), paths: plan.files.map(x => x.path) }));
