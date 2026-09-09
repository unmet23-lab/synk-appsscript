'use strict';

// Optional encoded-pixel proof. This never edits the content source or video.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {spawnSync} = require('child_process');
const sharp = require('sharp');
const review = __dirname;
const collection = path.dirname(review);
const repo = path.resolve(collection, '../../..');
const ffmpeg = path.join(repo, '영상/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
const targets = [
  {id: '03-lab-tiktok', second: 8, detail: 'book', crop: {left: 120, top: 910, width: 790, height: 520}},
  {id: '04-yuhobuilds-youtube', second: 13, detail: 'title', crop: {left: 90, top: 720, width: 840, height: 530}},
  {id: '04-yuhobuilds-youtube', second: 23, detail: 'body', crop: {left: 90, top: 720, width: 840, height: 530}},
  {id: '04-yuhobuilds-youtube', second: 33, detail: 'object', crop: {left: 90, top: 720, width: 840, height: 530}},
  {id: '05-yuhobuilds-instagram', second: 24, detail: 'notebook', crop: {left: 90, top: 720, width: 840, height: 530}},
  {id: '06-yuhobuilds-tiktok', second: 9.5, detail: 'title', crop: {left: 90, top: 720, width: 840, height: 530}},
  {id: '06-yuhobuilds-tiktok', second: 12, detail: 'body', crop: {left: 90, top: 720, width: 840, height: 530}},
  {id: '06-yuhobuilds-tiktok', second: 14.5, detail: 'object', crop: {left: 90, top: 720, width: 840, height: 530}},
  {id: '07-synkbrief-youtube', second: 3, detail: 'letter', crop: {left: 170, top: 900, width: 700, height: 530}},
  {id: '07-synkbrief-youtube', second: 20, detail: 'scissors', crop: {left: 120, top: 910, width: 790, height: 520}},
];
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async () => {
  const evidence = [];
  for (const target of targets) {
    const video = path.join(collection, target.id, 'video.mp4');
    const report = JSON.parse(fs.readFileSync(path.join(review, `영상_${target.id}_검증.json`), 'utf8'));
    if (sha(video) !== report.videoSha256) throw new Error(`Stale report for ${target.id}`);
    const name = `영상_상세_${target.id}_${target.second}s_${target.detail}`;
    const full = path.join(review, `${name}.png`);
    const result = spawnSync(ffmpeg, ['-y', '-v', 'error', '-ss', String(target.second), '-i', video, '-frames:v', '1', full], {windowsHide: true, encoding: 'utf8'});
    if (result.status !== 0) throw new Error(result.stderr || 'Frame extraction failed');
    await sharp(full).extract(target.crop).png().toFile(path.join(review, `${name}_100pct.png`));
    await sharp(full).extract({left: 80, top: 245, width: 560, height: 160}).png().toFile(path.join(review, `${name}_logo100pct.png`));
    await sharp(full).resize(360, 640).png().toFile(path.join(review, `${name}_phone.png`));
    evidence.push({...target, videoSha256: report.videoSha256, fullFrame: path.basename(full), cropResize: false, phoneSize: [360, 640], visualInspection: 'pending direct inspection'});
  }
  fs.writeFileSync(path.join(review, '영상_상세검증.json'), JSON.stringify({createdAt: new Date().toISOString(), evidence}, null, 2) + '\n');
  console.log(`Extracted ${evidence.length} encoded detail proofs at native pixel size, plus logo and phone views.`);
})().catch(error => {console.error(error.stack); process.exit(1);});
