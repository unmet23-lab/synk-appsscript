#!/usr/bin/env node
'use strict';

// This independent renderer owns only the 2026-09-09 account collection.
// It does not call the broad existing asset collector or alter Root.tsx / other video jobs.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {spawnSync} = require('child_process');

const videoRoot = __dirname;
const repo = path.dirname(videoRoot);
const collection = path.join(repo, 'docs', '홍보물', '계정별콘텐츠_20260909');
const review = path.join(collection, '_검토');
const publicDir = path.join(videoRoot, 'public', '계정별20260909');
const sourceDir = path.join(videoRoot, 'src', '계정별20260909');
const scriptPath = path.join(collection, '콘텐츠원고.json');
const intro = path.join(repo, 'docs', '홍보물', '브랜드소개_20260909');
const improved = path.join(collection, '_개선');
const cli = path.join(videoRoot, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const bin = path.join(videoRoot, 'node_modules', '@remotion', 'compositor-win32-x64-msvc');
const ffmpeg = path.join(bin, 'ffmpeg.exe');
const ffprobe = path.join(bin, 'ffprobe.exe');
const ids = ['01-lab-youtube', '03-lab-tiktok', '04-yuhobuilds-youtube', '05-yuhobuilds-instagram', '06-yuhobuilds-tiktok', '07-synkbrief-youtube', '09-synkbrief-tiktok'];
const args = process.argv.slice(2);
const idArg = args.indexOf('--id');
const selected = idArg === -1 ? ids : [args[idArg + 1]];
if (selected.some(id => !ids.includes(id))) throw new Error('Unknown scoped video id');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
function renderFingerprint(item) {
  const files = fs.readdirSync(sourceDir).filter(file => /\.tsx?$/.test(file)).sort();
  const used = new Set(item.scenes.map(scene => scene.asset).filter(Boolean));
  if (item.id !== '01-lab-youtube') {
    used.add('brand-synk');
    if (['LAB', 'SHIFT', 'PULSE'].includes(item.brand)) used.add(`brand-${item.brand.toLowerCase()}`);
  }
  const assets = [...used].sort().map(key => {
    const asset = assetSources[key];
    const source = sha(fs.readFileSync(asset.source));
    const prepared = sha(fs.readFileSync(path.join(publicDir, asset.file)));
    if (source !== prepared) throw new Error(`Prepared asset is stale: ${key}. Run --prepare before rendering.`);
    return {key, source, prepared};
  });
  const audioFile = item.id === '01-lab-youtube' ? 'BGM_산뜻.wav' : 'BGM_60초.wav';
  return sha(JSON.stringify({scenes: item.scenes, code: files.map(file => [file, sha(fs.readFileSync(path.join(sourceDir, file)))]),
    brand: item.brand, assets, audio: sha(fs.readFileSync(path.join(publicDir, audioFile))), renderer: sha(fs.readFileSync(__filename)),
    kit: ['색.ts', '폰트.ts', '폰트벌.json'].map(file => [file, sha(fs.readFileSync(path.join(videoRoot, 'src', '킷', file)))]),
    tokens: sha(fs.readFileSync(path.join(repo, 'docs', '디자인_토큰.json')))}));
}
const assetSources = Object.fromEntries(['night','notebook','letter','book','scissors','classroom','cafe','mong','smile','curious','korean','headphones','stitch','woolLogo'].map(key => [key, {source: path.join(intro, 'assets', `${key}.webp`), file: `${key}.webp`}]));
assetSources.letter = {source: path.join(improved, '봉투-2.5.png'), file: 'letter.png'};
assetSources.book = {source: path.join(improved, '책-2.5.png'), file: 'book.png'};
assetSources.scissors = {source: path.join(improved, '가위-2.5.png'), file: 'scissors.png'};
for (const brand of ['synk', 'lab', 'shift', 'pulse']) assetSources[`brand-${brand}`] = {source: path.join(improved, '배치용', `brand-${brand}.webp`), file: `brand-${brand}.webp`};
// Current standalone SYNK texture comes from the no-stitch approved master.
assetSources['brand-synk'] = {source: path.join(repo, 'docs/홍보물/마케팅실행_20260909/assets/brand-synk.webp'), file: 'brand-synk.webp'};
assetSources.compass = {source: path.join(videoRoot, 'public', '공방', '공방_나침반.avif'), file: 'compass.avif'};
for (const brand of ['lab', 'shift', 'pulse']) assetSources[`${brand}page`] = {source: path.join(improved, '지면스냅샷', `${brand}-1.png`), file: `${brand}page.png`};

function run(exe, argv, name) {
  const result = spawnSync(exe, argv, {cwd: videoRoot, encoding: 'utf8', shell: false, maxBuffer: 64 * 1024 * 1024, windowsHide: true});
  const log = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status !== 0) throw new Error(`${name} failed (${result.status}):\n${log.slice(-12000)}`);
  return log;
}

function prepare() {
  fs.mkdirSync(publicDir, {recursive: true});
  fs.mkdirSync(review, {recursive: true});
  const manifest = [];
  for (const [key, asset] of Object.entries(assetSources)) {
    if (!fs.existsSync(asset.source)) throw new Error(`Missing approved asset: ${key} — ${asset.source}`);
    const data = fs.readFileSync(asset.source);
    fs.copyFileSync(asset.source, path.join(publicDir, asset.file));
    manifest.push({key, source: path.relative(repo, asset.source).replace(/\\/g, '/'), file: asset.file, sha256: sha(data)});
  }
  const fonts = readJson(path.join(videoRoot, 'src', '킷', '폰트벌.json'));
  for (const font of fonts.벌) {
    const original = path.join(repo, 'docs', '브랜드_폰트', font.정본);
    const existing = path.join(videoRoot, 'public', '폰트', path.basename(font.정본));
    if (!fs.existsSync(existing) || sha(fs.readFileSync(original)) !== sha(fs.readFileSync(existing))) {
      throw new Error(`Shared font copy is absent or stale: ${font.정본}. Do not overwrite shared assets in this scoped task.`);
    }
  }
  run(process.execPath, [path.join(videoRoot, 'BGM만들기.js'), '--out', publicDir, '--결', '산뜻', '--초', '30'], '30-second original music');
  const audio60 = path.join(publicDir, 'audio60');
  run(process.execPath, [path.join(videoRoot, 'BGM만들기.js'), '--out', audio60, '--결', '산뜻', '--초', '60'], '60-second original music');
  fs.copyFileSync(path.join(audio60, 'BGM_산뜻.wav'), path.join(publicDir, 'BGM_60초.wav'));
  fs.writeFileSync(path.join(review, '영상_원천명세.json'), JSON.stringify({createdAt: new Date().toISOString(), assets: manifest, fontsVerified: fonts.벌.length,
    audio: {source: '영상/BGM만들기.js', generatorSha256: sha(fs.readFileSync(path.join(videoRoot, 'BGM만들기.js'))), waveform: 'sine / triangle', originalComposition: true, externallyLicensedSong: false, listenedByHuman: false}}, null, 2) + '\n');
  console.log(`Prepared ${manifest.length} approved assets; ${fonts.벌.length} font originals matched. Independent original music: 30s + 60s.`);
}

function scripts() {
  if (!fs.existsSync(scriptPath)) throw new Error('The approved 콘텐츠원고.json is not yet available. Preparation is complete; rendering has not started.');
  const data = readJson(scriptPath);
  return selected.map(id => {
    const item = data.items.find(entry => entry.id === id);
    if (!item || !Array.isArray(item.scenes) || item.scenes.length === 0) throw new Error(`Missing video scenes: ${id}`);
    for (const [index, scene] of item.scenes.entries()) {
      if (!(scene.duration >= 2 && scene.duration <= 60) || (typeof scene.title !== 'string')) throw new Error(`Bad scene: ${id} ${index + 1}`);
      if (scene.asset && !assetSources[scene.asset]) throw new Error(`Unknown scene asset: ${id} / ${scene.asset}`);
    }
    return item;
  });
}

function time(ms) {
  const n = Math.round(ms);
  return `${String(Math.floor(n / 3600000)).padStart(2, '0')}:${String(Math.floor(n / 60000) % 60).padStart(2, '0')}:${String(Math.floor(n / 1000) % 60).padStart(2, '0')},${String(n % 1000).padStart(3, '0')}`;
}

function captions(item) {
  let startMs = 0;
  const result = item.scenes.map(scene => {
    const caption = {text: [scene.title, scene.kr, scene.mn, scene.body, ...(scene.lines || [])].filter(Boolean).join('\n') || '[Instrumental music]', startMs, endMs: startMs + Math.round(scene.duration * 1000), timestampMs: null, confidence: null};
    startMs = caption.endMs;
    return caption;
  });
  const target = path.join(collection, item.id);
  fs.mkdirSync(target, {recursive: true});
  fs.writeFileSync(path.join(target, '자막.srt'), result.map((caption, index) => `${index + 1}\n${time(caption.startMs)} --> ${time(caption.endMs)}\n${caption.text}\n`).join('\n'), 'utf8');
  fs.writeFileSync(path.join(review, `영상_${item.id}_captions.json`), JSON.stringify(result, null, 2) + '\n');
  return result;
}

function checkRenderLog(log) {
  for (const phrase of ['Failed to load resource', 'Browser failed to load', 'Failed to fetch', 'net::ERR_', 'Could not load font', 'Font failed', 'Critical text overflow']) {
    if (log.includes(phrase)) throw new Error(`Render resource failure: ${phrase}`);
  }
}

async function captureFinished(item, target) {
  const output = path.join(review, `영상프레임-${item.id}`);
  fs.mkdirSync(output, {recursive: true});
  let offset = 0;
  const seconds = [];
  for (const scene of item.scenes) {
    seconds.push(offset + Math.min(1, scene.duration / 3));
    seconds.push(offset + scene.duration * 0.65);
    offset += scene.duration;
  }
  if (item.id === '01-lab-youtube') seconds.push(offset - 1);
  for (const [i, second] of seconds.entries()) {
    run(ffmpeg, ['-y', '-v', 'error', '-ss', second.toFixed(3), '-i', target, '-frames:v', '1', path.join(output, `frame-${String(i).padStart(2, '0')}.png`)], 'extract encoded frame');
  }
  // The Remotion FFmpeg build intentionally omits tile. Use the bundled image runtime instead.
  const sharp = require('sharp');
  const thumbs = await Promise.all(seconds.map((_, i) => sharp(path.join(output, `frame-${String(i).padStart(2, '0')}.png`)).resize(270, 480).png().toBuffer()));
  await sharp({create: {width: 1080, height: 480 * Math.ceil(seconds.length / 4), channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}})
    .composite(thumbs.map((input, i) => ({input, left: (i % 4) * 270, top: Math.floor(i / 4) * 480})))
    .png().toFile(path.join(review, `영상_${item.id}_contact.png`));
  return seconds;
}

async function render(item) {
  const target = path.join(collection, item.id, 'video.mp4');
  captions(item);
  const started = Date.now();
  const renderSourceSha256 = renderFingerprint(item);
  if (args.includes('--verify')) {
    const prior = readJson(path.join(review, `영상_${item.id}_검증.json`));
    if (prior.renderSourceSha256 !== renderSourceSha256 || prior.videoSha256 !== sha(fs.readFileSync(target))) {
      throw new Error(`Verification cannot certify an old render against changed inputs: ${item.id}. Render first.`);
    }
  }
  if (!args.includes('--verify')) {
    console.log(`Rendering ${item.id}`);
    const log = run(process.execPath, [cli, 'render', 'src/계정별20260909/index.tsx', `account-${item.id}`, target,
      '--concurrency=2', '--codec=h264', '--video-bitrate=12M', '--audio-bitrate=256k', '--color-space=bt709', '--overwrite'], item.id);
    fs.writeFileSync(path.join(review, `영상_${item.id}_render.log`), log);
    checkRenderLog(log);
  } else {
    checkRenderLog(fs.readFileSync(path.join(review, `영상_${item.id}_render.log`), 'utf8'));
  }
  const stat = fs.statSync(target);
  if ((!args.includes('--verify') && stat.mtimeMs < started - 1000) || stat.size < 100000) throw new Error(`Stale or empty output: ${item.id}`);
  const media = JSON.parse(run(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', target], 'ffprobe'));
  const video = media.streams.find(stream => stream.codec_type === 'video');
  const audio = media.streams.find(stream => stream.codec_type === 'audio');
  const duration = item.scenes.reduce((sum, scene) => sum + scene.duration, 0);
  if (video?.width !== 1080 || video?.height !== 1920 || !audio || Math.abs(Number(media.format.duration) - duration) > 0.12) throw new Error(`Invalid media dimensions, audio, or duration: ${item.id}`);
  const capturedSeconds = await captureFinished(item, target);
  const loudness = run(ffmpeg, ['-hide_banner', '-i', target, '-vn', '-af', 'loudnorm=I=-16:TP=-1:LRA=11:print_format=json', '-c:a', 'pcm_s16le', '-f', 'null', '-'], 'audio measurement');
  fs.writeFileSync(path.join(review, `영상_${item.id}_audio.log`), loudness);
  const report = {id: item.id, renderedAt: new Date().toISOString(), durationSeconds: Number(media.format.duration), width: video.width, height: video.height,
    videoCodec: video.codec_name, audioCodec: audio.codec_name, bytes: stat.size, scriptSha256: sha(fs.readFileSync(scriptPath)), scenesSha256: sha(JSON.stringify(item.scenes)), renderSourceSha256, videoSha256: sha(fs.readFileSync(target)), capturedSeconds,
    visualInspection: 'pending separate inspection of the encoded frame contact sheet', audioMeasurement: 'measured; not a claim of human listening', externalPosting: false};
  fs.writeFileSync(path.join(review, `영상_${item.id}_검증.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(`Finished ${item.id}: ${duration}s; ${(stat.size / 1048576).toFixed(1)} MiB; ${capturedSeconds.length} encoded frames extracted.`);
}

module.exports = {captureFinished, renderFingerprint};
if (require.main === module) (async () => { try {
  if (args.includes('--prepare')) { prepare(); process.exit(0); }
  const items = scripts();
  if (args.includes('--check')) {
    for (const item of items) {
      const cues = captions(item);
      console.log(`${item.id}: ${item.scenes.length} scenes, ${cues.at(-1).endMs / 1000}s`);
    }
    process.exit(0);
  }
  if (args.includes('--still')) {
    const index = Number(args[args.indexOf('--scene') + 1]) || 0;
    const secondIndex = args.indexOf('--second');
    const second = secondIndex === -1 ? 1 : Number(args[secondIndex + 1]);
    for (const item of items) {
      if (!(second >= 0 && second < item.scenes[index].duration)) throw new Error('Preview second is outside selected scene');
      const frame = Math.round((item.scenes.slice(0, index).reduce((n, scene) => n + scene.duration, 0) + second) * 30);
      const target = path.join(review, `영상_${item.id}_scene${index + 1}_${second}s_preview.png`);
      const log = run(process.execPath, [cli, 'still', 'src/계정별20260909/index.tsx', `account-${item.id}`, target, `--frame=${frame}`, '--overwrite'], 'preview still');
      checkRenderLog(log);
      console.log(target);
    }
    process.exit(0);
  }
  if (!args.includes('--render') && !args.includes('--verify')) throw new Error('Use --prepare, --check, --still [--scene N], --render, or --verify; optionally --id <scoped id>.');
  for (const item of items) {
    const reportPath = path.join(review, `영상_${item.id}_검증.json`);
    if (args.includes('--resume') && fs.existsSync(reportPath)) {
      const report = readJson(reportPath);
      const existing = path.join(collection, item.id, 'video.mp4');
      if (report.renderSourceSha256 === renderFingerprint(item) && fs.existsSync(existing) && report.videoSha256 === sha(fs.readFileSync(existing))) {
        console.log(`Verified unchanged output retained: ${item.id}`);
        continue;
      }
    }
    await render(item);
  }
} catch (error) {
  console.error(error.stack || String(error));
  process.exit(1);
} })();
