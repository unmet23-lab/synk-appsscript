'use strict';
// Build the browser-compatible preview from the rendered master without new TTS calls.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const dir = __dirname;
const master = path.join(dir, 'SHIFT_과정1편_내레이션.mp4');
const preview = path.join(dir, 'preview.webm');
const run = (exe, args) => {
  const result = spawnSync(exe, args, {encoding: 'utf8', windowsHide: true});
  if (result.status !== 0) throw new Error(result.stderr || result.error || exe);
  return result.stdout;
};
if (!fs.existsSync(preview) || fs.statSync(preview).mtimeMs < fs.statSync(master).mtimeMs) {
  run('ffmpeg', ['-y', '-v', 'error', '-i', master,
    '-vf', 'scale=720:1280', '-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0',
    '-row-mt', '1', '-c:a', 'libopus', '-b:a', '96k', preview]);
}
const {심기} = require(path.resolve(dir, '../../../tools/lib/브랜드폰트.js'));
fs.writeFileSync(path.join(dir, 'preview.html'), 심기(fs.readFileSync(path.join(dir, '_src_preview.html'), 'utf8')).html);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', preview]));
fs.writeFileSync(path.join(dir, '검수/미리보기규격.json'), JSON.stringify({
  createdAt: new Date().toISOString(), masterSha256: sha(master), previewSha256: sha(preview),
  purpose: 'Browser preview; use the 1080x1920 MP4 for platform uploads.', probe
}, null, 2));
console.log('Browser preview and embedded-font HTML ready.');
