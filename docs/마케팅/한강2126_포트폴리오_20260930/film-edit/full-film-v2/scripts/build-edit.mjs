import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plan = JSON.parse(await readFile(resolve(project, 'edit-plan.json'), 'utf8'));
const preview = process.argv.includes('--preview');
const assetsOnly = process.argv.includes('--assets-only');
const cuts = preview ? plan.pipelinePreview : plan.cuts;
if (!assetsOnly && !cuts?.length) throw new Error('Final clip ranges have not been supplied. Use --preview only for the labelled pipeline preview.');
const { width, height, fps } = plan.canvas;
const html = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const secs = frames => Number((frames / fps).toFixed(12));
await mkdir(resolve(project, 'assets/media'), { recursive: true });
await mkdir(resolve(project, 'compositions'), { recursive: true });
await mkdir(resolve(project, 'qa'), { recursive: true });
let cache = {};
try { cache = JSON.parse(await readFile(resolve(project, 'assets/media-cache.json'), 'utf8')); } catch {}
const assetRecords = [];
async function stage(source, kind) {
  const input = resolve(project, source);
  const buffer = await readFile(input);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const cacheKey = `${sha256}:${kind}:${fps}`;
  let cached = cache[cacheKey];
  if (cached) { try { await stat(resolve(project, cached.asset)); } catch { cached = null; } }
  if (!cached) {
    const stem = basename(source, extname(source)).replace(/[^a-zA-Z0-9_-]/g, '-');
    const probe = kind === 'video' || kind === 'audio' ? JSON.parse(execFileSync('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',input], { encoding:'utf8', windowsHide:true })) : null;
    const video = probe?.streams.find(stream => stream.codec_type === 'video');
    const normalized = kind === 'video' && (video?.codec_name !== 'h264' || video?.pix_fmt !== 'yuv420p' || video?.r_frame_rate !== `${fps}/1`);
    const asset = `assets/media/${stem}-${sha256.slice(0,10)}${normalized ? '-h264.mp4' : extname(source)}`;
    const output = resolve(project, asset);
    if (normalized) {
      execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y','-i',input,'-map','0:v:0','-map','0:a:0?','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p','-r',String(fps),'-fps_mode','cfr','-c:a','copy','-movflags','+faststart',output], { windowsHide:true, stdio:'inherit' });
    } else { await copyFile(input, output); }
    cached = { source, asset, sha256, kind, normalizedForBrowser: normalized, sourceProbe: probe, provenance: 'existing local project asset; no generation or external download' };
    cache[cacheKey] = cached;
  }
  assetRecords.push(cached);
  return cached;
}

if (assetsOnly) {
  for (const candidate of plan.reuseCandidates || []) await stage(candidate.source, candidate.kind);
  await writeFile(resolve(project, 'assets/media-cache.json'), JSON.stringify(cache, null, 2));
  await writeFile(resolve(project, 'qa/prepared-assets.json'), JSON.stringify(assetRecords, null, 2));
  console.log(JSON.stringify({ prepared: assetRecords.map(({ source, asset, normalizedForBrowser }) => ({ source, asset, normalizedForBrowser })) }, null, 2));
  process.exit(0);
}

let frame = 0;
const compiled = [];
const audioElements = [];
for (const cut of cuts) {
  if (!/^[a-z][a-z0-9-]*$/.test(cut.id)) throw new Error(`Invalid cut id: ${cut.id}`);
  if (!Number.isInteger(cut.inFrame) || !Number.isInteger(cut.outFrame) || cut.inFrame < 0 || cut.outFrame <= cut.inFrame) throw new Error(`Invalid source-frame range: ${cut.id}`);
  const asset = await stage(cut.source, cut.kind);
  const playbackRate = cut.playbackRate || 1;
  const durationFrames = (cut.outFrame - cut.inFrame) / playbackRate;
  if (!Number.isFinite(playbackRate) || playbackRate <= 0 || !Number.isInteger(durationFrames)) throw new Error(`Cut ${cut.id} must resolve to an integer number of output frames.`);
  const duration = secs(durationFrames);
  const start = secs(frame);
  const mediaStart = secs(cut.inFrame);
  if (cut.kind === 'video') {
    const v = asset.sourceProbe.streams.find(stream => stream.codec_type === 'video');
    if (v.width !== width || v.height !== height) throw new Error(`${cut.id}: unexpected dimensions ${v.width}x${v.height}; an explicit crop decision is needed.`);
    const sourceDuration = Number(v.duration || asset.sourceProbe.format.duration);
    if (secs(cut.outFrame) > sourceDuration + 0.001) throw new Error(`${cut.id}: source range exceeds ${sourceDuration}s`);
  }
  const isVideo = cut.kind === 'video';
  const visual = isVideo
    ? `<video id="${cut.id}-video" class="clip" src="${html(asset.asset)}" data-start="0" data-duration="${duration}" data-media-start="${mediaStart}" data-playback-rate="${playbackRate}" data-track-index="1" muted playsinline preload="metadata"></video>`
    : `<img id="${cut.id}-image" class="clip" src="${html(asset.asset)}" alt="SYNK" data-start="0" data-duration="${duration}" data-track-index="1">`;
  const imageStyle = isVideo ? '' : `#${cut.id}-image { padding: ${Number(cut.padding || 180)}px; }`;
  await writeFile(resolve(project, `compositions/${cut.id}.html`), `<!doctype html><html lang="ko"><head><meta charset="UTF-8"></head><body><template>
<style>#root { position:absolute; inset:0; width:100%; height:100%; overflow:hidden; background:${html(cut.background || (isVideo ? '#000' : '#fff'))}; } .clip { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; } ${imageStyle}</style>
<div id="root" data-composition-id="${cut.id}" data-width="${width}" data-height="${height}" data-duration="${duration}">${visual}</div>
<script>window.__timelines["${cut.id}"] = gsap.timeline({ paused:true });</script>
</template></body></html>\n`);
  if (isVideo && cut.sourceAudio !== false && asset.sourceProbe.streams.some(stream => stream.codec_type === 'audio')) {
    const automation = cut.audioAutomation ? ` data-automation="${html(JSON.stringify(cut.audioAutomation))}"` : '';
    audioElements.push(`<audio id="${cut.id}-audio" src="${html(asset.asset)}" data-start="${start}" data-duration="${duration}" data-media-start="${mediaStart}" data-playback-rate="${playbackRate}" data-track-index="10" data-volume="${cut.volume ?? 1}"${automation}></audio>`);
  }
  compiled.push({ ...cut, asset: asset.asset, playbackRate, timelineStartFrame: frame, durationFrames, timelineEndFrame: frame + durationFrames, start, duration, mediaStart });
  frame += durationFrames;
}
if (!preview) {
  for (const track of plan.audioTracks || []) {
    const asset = await stage(track.source, 'audio');
    const automation = track.automation ? ` data-automation="${html(JSON.stringify(track.automation))}"` : '';
    const fx = track.fxChain ? ` data-fx-chain="${html(JSON.stringify(track.fxChain))}"` : '';
    audioElements.push(`<audio id="${html(track.id)}" src="${html(asset.asset)}" data-start="${secs(track.startFrame)}" data-duration="${secs(track.durationFrames)}" data-media-start="${secs(track.inFrame || 0)}" data-track-index="${track.trackIndex || 20}" data-volume="${track.volume ?? 1}"${automation}${fx}></audio>`);
  }
}
const slots = compiled.map(cut => `<div id="slot-${cut.id}" class="clip" data-composition-id="${cut.id}" data-composition-src="compositions/${cut.id}.html" data-start="${cut.start}" data-duration="${cut.duration}" data-track-index="1"></div>`).join('\n');
await writeFile(resolve(project, 'index.html'), `<!doctype html><html lang="ko" data-resolution="portrait"><head><meta charset="UTF-8"><meta name="viewport" content="width=${width}, height=${height}"><title>SYNK 2126 ${preview ? 'pipeline preview' : 'full film v2'}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}#root{position:relative;width:100%;height:100%;overflow:hidden}#root>.clip{position:absolute;inset:0;width:100%;height:100%}</style></head><body>
<div id="root" data-composition-id="synk-full-v2" data-width="${width}" data-height="${height}" data-fps="${fps}" data-duration="${secs(frame)}">
${slots}\n${audioElements.join('\n')}
</div><script>window.__timelines["synk-full-v2"] = gsap.timeline({paused:true});</script></body></html>\n`);
const status = { mode: preview ? 'pipeline-preview-not-full-film' : 'full-film-assembled', canvas: plan.canvas, totalFrames: frame, duration: secs(frame), cuts: compiled, audioTracks: preview ? [] : plan.audioTracks, sourceFiles: assetRecords };
await writeFile(resolve(project, 'assets/media-cache.json'), JSON.stringify(cache, null, 2));
await writeFile(resolve(project, 'edit-status.json'), JSON.stringify(status, null, 2));
console.log(JSON.stringify({ mode: status.mode, totalFrames: frame, duration: status.duration, cuts: compiled.map(c => ({ id:c.id, startFrame:c.timelineStartFrame, endFrame:c.timelineEndFrame, sourceIn:c.inFrame, sourceOut:c.outFrame })) }, null, 2));
