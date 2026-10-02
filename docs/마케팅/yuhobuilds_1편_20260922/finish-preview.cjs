'use strict';

// Run after rendering: node docs/마케팅/yuhobuilds_1편_20260922/finish-preview.cjs
// --force rebuilds the WebM. --html-only refreshes the page without transcoding.
// This script uses local files only; it never requests new narration or changes the master.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');

const dir = __dirname;
const args = new Set(process.argv.slice(2));
const master = path.join(dir, 'yuhobuilds_EP01.mp4');
const preview = path.join(dir, 'preview-720.webm');
const temporary = path.join(dir, 'preview-720.partial.webm');
const captions = path.join(dir, 'captions.srt');
const {심기} = require(path.resolve(dir, '../../../tools/lib/브랜드폰트.js'));

function run(exe, argv) {
  const result = spawnSync(exe, argv, {
    encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${exe} failed`);
  return result.stdout;
}

function probe(file) {
  return JSON.parse(run('ffprobe', [
    '-v', 'error', '-show_streams', '-show_format', '-of', 'json', file,
  ]));
}

async function sha(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function captionHtml() {
  if (!fs.existsSync(captions)) {
    return '<p class="caption-empty">자막을 준비하고 있습니다.</p>';
  }
  const blocks = fs.readFileSync(captions, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n\s*\r?\n/);
  const rows = blocks.map(block => {
    const lines = block.split(/\r?\n/);
    if (/^\d+$/.test(lines[0])) lines.shift();
    const timing = lines.shift();
    const match = /^(\d{2}):(\d{2}):(\d{2})[,.]\d{3}\s+-->/.exec(timing || '');
    if (!match || !lines.length) throw new Error('Invalid SRT caption block: ' + block.slice(0, 100));
    const time = match[1] === '00' ? `${match[2]}:${match[3]}` : `${match[1]}:${match[2]}:${match[3]}`;
    return `<p class="caption"><span class="caption-time">${time}</span><span>${escapeHtml(lines.join('\n'))}</span></p>`;
  });
  return rows.join('\n');
}

function writeHtml() {
  const source = fs.readFileSync(path.join(dir, '_src_preview.html'), 'utf8');
  const marker = '<!-- CAPTIONS_CONTENT -->';
  if (!source.includes(marker)) throw new Error('Caption placeholder is missing from the preview source.');
  const result = 심기(source.replace(marker, captionHtml()));
  fs.writeFileSync(path.join(dir, 'preview.html'), result.html, 'utf8');
  console.log('Embedded-font preview.html ready.');
}

async function main() {
  for (const argument of args) {
    if (!['--force', '--html-only'].includes(argument)) throw new Error('Unknown argument: ' + argument);
  }
  if (args.has('--html-only')) return writeHtml();
  if (!fs.existsSync(master)) throw new Error('Render the master first: ' + master);
  const sourceProbe = probe(master);
  const sourceVideo = sourceProbe.streams.find(stream => stream.codec_type === 'video');
  const sourceAudio = sourceProbe.streams.find(stream => stream.codec_type === 'audio');
  if (!sourceVideo || !sourceAudio) throw new Error('The master must contain video and narration audio.');
  if (Math.abs(sourceVideo.width / sourceVideo.height - 9 / 16) > 0.002) {
    throw new Error('The master must be a 9:16 vertical video.');
  }

  const rebuild = args.has('--force') || !fs.existsSync(preview)
    || fs.statSync(preview).mtimeMs < fs.statSync(master).mtimeMs;
  if (rebuild) {
    console.log('Encoding browser preview: VP9 / Opus, 720 × 1280…');
    run('ffmpeg', [
      '-y', '-hide_banner', '-v', 'error', '-i', master,
      '-map', '0:v:0', '-map', '0:a:0', '-map_metadata', '-1',
      '-vf', 'scale=720:1280:flags=lanczos,setsar=1',
      '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-crf', '31', '-b:v', '0',
      '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-threads', '4',
      '-c:a', 'libopus', '-b:a', '96k', '-ar', '48000', temporary,
    ]);
  }

  const checkedFile = rebuild ? temporary : preview;
  const checked = probe(checkedFile);
  const video = checked.streams.find(stream => stream.codec_type === 'video');
  const audio = checked.streams.find(stream => stream.codec_type === 'audio');
  if (video?.codec_name !== 'vp9' || video.width !== 720 || video.height !== 1280
    || audio?.codec_name !== 'opus'
    || Math.abs(Number(checked.format.duration) - Number(sourceProbe.format.duration)) > 0.2) {
    throw new Error('Preview codec, dimensions, or duration mismatch. Run again with --force.');
  }
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-i', checkedFile, '-f', 'null', '-']);
  if (rebuild) fs.renameSync(temporary, preview);
  checked.format.filename = preview;
  writeHtml();

  const auditDir = path.join(dir, '검수');
  fs.mkdirSync(auditDir, {recursive: true});
  fs.writeFileSync(path.join(auditDir, '미리보기규격.json'), JSON.stringify({
    createdAt: new Date().toISOString(),
    master: path.basename(master), masterSha256: await sha(master),
    preview: path.basename(preview), previewSha256: await sha(preview),
    fullDecode: 'passed',
    purpose: 'Browser preview. The original MP4 is the delivery file.',
    probe: checked,
  }, null, 2));
  console.log('WebM preview validated. Original MP4 preserved.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
