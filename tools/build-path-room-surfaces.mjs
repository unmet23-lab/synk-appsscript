/** Bake existing PATH room photographs into 3840-pixel-long-edge JPEGs.
 * No model call, new scene, sharpening, denoising or detail reconstruction.
 * Run: node tools/build-path-room-surfaces.mjs [--verify]
 * Existing source files are never overwritten. FFmpeg/ffprobe must be on PATH.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat, mkdir, rename } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(ROOT, 'experiences/path-vr');
const RECORD = path.join(BASE, 'interview/production/room-surfaces-4k.json');
const LONG_EDGE = 3840;
const items = [
  { id: 'room-reference', source: 'assets/interview/film/room-reference.png', output: 'assets/interview/film/room-reference-4k.jpg', aspect: 16 / 9, usage: 'Registration reference for room architecture; not the pre-start poster.' },
  { id: 'front-room-extension', source: 'assets/interview/room/front-room-extension.png', output: 'assets/interview/room/front-room-extension-4k.jpg', aspect: 16 / 9 },
  { id: 'front-room-wide', source: 'assets/interview/room/front-room-wide.png', output: 'assets/interview/room/front-room-wide-4k.jpg', aspect: 16 / 9 },
  { id: 'left-wall', source: 'assets/interview/room/left-wall-photo.png', output: 'assets/interview/room/left-wall-photo-4k.jpg' },
  { id: 'right-wall', source: 'assets/interview/room/right-wall-photo.png', output: 'assets/interview/room/right-wall-photo-4k.jpg' },
  { id: 'back-wall', source: 'assets/interview/room/back-wall-elevation.png', output: 'assets/interview/room/back-wall-elevation-4k.jpg' },
  { id: 'room-poster', source: 'assets/interview/film/strict-question-4k.mp4', output: 'assets/interview/film/room-poster-4k.jpg', aspect: 16 / 9, frameSeconds: 0, usage: 'First decoded frame of the actual default question video; do not substitute the generation reference.' },
  { id: 'carpet', source: 'assets/interview/room/back-wall-photo.png', output: 'assets/interview/room/carpet-4k.jpg', cropUv: { u: .07, v: .006, width: .49, height: .10 }, aspect: 9.8, usage: 'Existing carpet strip only. Texture UV=(planeUv.x,carpetV); repeat/mirror at the recorded physical aspect.' },
  { id: 'desk', source: 'assets/interview/film/room-reference.png', output: 'assets/interview/room/desk-4k.jpg', cropUv: { u: .45, v: .16, width: .19, height: .05 }, usage: 'Existing empty wood strip only. Texture UV=(planeUv.x,1-planeUv.y) matches the original room shader.' },
];

function run(program, args) {
  const result = spawnSync(program, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} failed (${result.status}): ${result.stderr.trim()}`);
  return result.stdout.trim();
}
function probe(file) {
  const json = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,pix_fmt,sample_aspect_ratio,color_range', '-of', 'json', file]));
  if (!json.streams?.length) throw new Error(`No decoded image/video stream: ${file}`);
  return json.streams[0];
}
async function metadata(relative) {
  const absolute = path.join(BASE, relative);
  const [data, info] = await Promise.all([readFile(absolute), stat(absolute)]);
  return { path: relative, bytes: info.size, sha256: createHash('sha256').update(data).digest('hex'), ...probe(absolute) };
}
const even = (number) => Math.max(2, Math.round(number / 2) * 2);

async function verify(record) {
  let bytes = 0;
  for (const asset of record.assets) {
    const source = await metadata(asset.source.path), output = await metadata(asset.output.path);
    for (const key of ['bytes', 'sha256', 'width', 'height']) {
      if (source[key] !== asset.source[key]) throw new Error(`${asset.id}: source ${key} changed`);
      if (output[key] !== asset.output[key]) throw new Error(`${asset.id}: output ${key} mismatch`);
    }
    if (output.codec_name !== 'mjpeg' || Math.max(output.width, output.height) !== LONG_EDGE || output.width % 2 || output.height % 2) throw new Error(`${asset.id}: invalid JPEG dimensions/codec`);
    run('ffmpeg', ['-v', 'error', '-i', path.join(BASE, output.path), '-frames:v', '1', '-f', 'null', '-']);
    bytes += output.bytes;
  }
  return { verifiedAt: new Date().toISOString(), sourceFilesUnchanged: true, freshMetadataAndHashesMatched: true, allJpegsDecoded: true, assets: record.assets.length, totalOutputBytes: bytes, browserRendered: false, headsetVerified: false, newImageGeneration: false, paidCalls: 0 };
}

if (process.argv.includes('--verify')) {
  const result = await verify(JSON.parse(await readFile(RECORD, 'utf8')));
  console.log(JSON.stringify(result, null, 2));
} else {
  const record = {
    createdAt: new Date().toISOString(), generator: 'tools/build-path-room-surfaces.mjs',
    method: 'Existing pixels only: optional UV crop or video first-frame extraction, FFmpeg Lanczos resizing, JPEG q=2 / yuvj444p. No generative reconstruction.',
    ffmpegVersion: run('ffmpeg', ['-version']).split(/\r?\n/)[0],
    longEdgePixels: LONG_EDGE, paidCalls: 0, aiSuperResolution: false, native4kPhotography: false,
    coordinateConvention: 'UV rectangles use lower-left origin. Pixel crops use upper-left origin with nearest integer source pixels. Output heights are rounded to the nearest even pixel; near-16:9 1672x941 sources are normalized to3840x2160.',
    assets: [],
  };
  for (const item of items) {
    const source = await metadata(item.source);
    const crop = item.cropUv ? {
      x: Math.round(source.width * item.cropUv.u),
      y: Math.round(source.height * (1 - item.cropUv.v - item.cropUv.height)),
      width: Math.round(source.width * item.cropUv.width),
      height: Math.round(source.height * item.cropUv.height),
    } : null;
    const aspect = item.aspect ?? (crop ? crop.width / crop.height : source.width / source.height);
    const width = aspect >= 1 ? LONG_EDGE : even(LONG_EDGE * aspect);
    const height = aspect >= 1 ? even(LONG_EDGE / aspect) : LONG_EDGE;
    const filters = ['format=rgb24'];
    if (crop) filters.push(`crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}:exact=1`);
    filters.push(`scale=${width}:${height}:flags=lanczos`, 'setsar=1', 'format=yuvj444p');
    const outputPath = path.join(BASE, item.output), temporary = outputPath.replace(/\.jpg$/, '.building.jpg');
    await mkdir(path.dirname(outputPath), { recursive: true });
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(BASE, item.source), '-map', '0:v:0', '-frames:v', '1', '-vf', filters.join(','), '-c:v', 'mjpeg', '-q:v', '2', '-threads', '1', '-update', '1', temporary];
    run('ffmpeg', args);
    const actual = probe(temporary);
    if (actual.width !== width || actual.height !== height) throw new Error(`${item.id}: unexpected output size`);
    await rename(temporary, outputPath);
    const after = await metadata(item.source);
    if (after.sha256 !== source.sha256 || after.bytes !== source.bytes) throw new Error(`${item.id}: source changed during build`);
    record.assets.push({ id: item.id, usage: item.usage || 'Existing room photograph resized without scene changes.', source, cropUv: item.cropUv ?? null, cropPixelsUpperLeft: crop, frameSeconds: item.frameSeconds ?? null, targetAspectRatio: aspect, filter: filters.join(','), output: await metadata(item.output) });
    console.log(`${item.id}: ${source.width}x${source.height} -> ${width}x${height}`);
  }
  record.verification = await verify(record);
  await writeFile(RECORD, JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ record: path.relative(ROOT, RECORD), ...record.verification }, null, 2));
}
