#!/usr/bin/env node
// Local, deterministic preflight. Never transcribes, generates, edits or publishes the original.
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const execute = promisify(execFile);
const decoder = new TextDecoder('utf-8', { fatal: true });
const SUBTITLE_SOURCE = new URL('../docs/마케팅/온라인마케팅지도/engagement/company/public/subtitle-lab.js', import.meta.url);
const finite = value => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const fraction = value => { const [a, b = 1] = String(value || '').split('/').map(Number); return b && a > 0 ? a / b : null; };
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export async function fingerprint(file, limit = 2 * 1024 ** 3) {
  const absolute = path.resolve(file), before = await lstat(absolute);
  if (!before.isFile() || before.isSymbolicLink() || before.size <= 0 || before.size > limit) throw new Error('검사 입력은 비어 있지 않은 일반 파일이어야 합니다: ' + absolute);
  const sha = createHash('sha256');
  for await (const chunk of createReadStream(absolute)) sha.update(chunk);
  const after = await lstat(absolute);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || before.ino !== after.ino) throw new Error('검사 중 원본이 변경되었습니다. 렌더가 끝난 뒤 다시 검사하세요.');
  return { path: absolute, byteSize: before.size, sha256: sha.digest('hex') };
}

export function inspectFrameTimes(values, rate) {
  const times = values.map(finite).filter(value => value !== null);
  const diffs = times.slice(1).map((time, i) => time - times[i]);
  const positive = diffs.filter(value => value > 0).sort((a, b) => a - b);
  const step = positive.length ? positive[Math.floor(positive.length / 2)] : rate ? 1 / rate : null;
  const issues = [];
  for (let i = 0; i < diffs.length; i++) {
    if (diffs[i] <= 0) issues.push({ code: 'frame-order', severity: 'error', at: times[i + 1], message: '화면 프레임의 표시 시각이 반복되거나 역행합니다.' });
    else if (step && diffs[i] > step * 1.6 + 0.002) issues.push({ code: 'frame-gap', severity: 'warning', at: times[i], message: `프레임 간격 ${diffs[i].toFixed(3)}초가 평소 ${step.toFixed(3)}초보다 깁니다. 가변 프레임률·의도한 멈춤인지 확인하세요.` });
  }
  return { count: times.length, missingTimestamps: values.length - times.length, first: times[0] ?? null, last: times.at(-1) ?? null, medianStep: step, issues };
}

// Ordered edit distance on bounded text. This is a literal comparison, never a claim about spoken meaning.
// 올림 화질(제작 방식 v2 §2-4, 유튜브 권장 업로드 인코딩): 짧은 변이 1080 이상인 마감본만 본다.
export function uploadQualityIssues(video, audio = [], format = {}) {
  const issues = [], add = (code, message) => issues.push({ code, severity: 'warning', at: null, message });
  if (Math.min(Number(video?.width) || 0, Number(video?.height) || 0) < 1080) return issues;
  const rate = fraction(video.avg_frame_rate) || fraction(video.r_frame_rate) || 30, need = rate > 30.5 ? 12 : 8;
  let bitrate = finite(video.bit_rate);
  if (bitrate === null && finite(format.bit_rate) !== null) bitrate = finite(format.bit_rate) - audio.reduce((sum, stream) => sum + (finite(stream.bit_rate) || 0), 0);
  if (bitrate !== null && bitrate < need * 1e6 * .95) add('upload-video-bitrate', `영상 비트레이트 ${(bitrate / 1e6).toFixed(1)}Mbps입니다. 올림 기준(${rate > 30.5 ? '48~60fps' : '30fps 이하'} ${need}Mbps 이상)보다 낮아 플랫폼이 다시 압축하면 질감과 글자 가장자리가 뭉개질 수 있습니다.`);
  if (video.codec_name && video.codec_name !== 'h264') add('upload-video-codec', `영상 코덱이 ${video.codec_name}입니다. 올림 기준은 H.264(High)입니다.`);
  if (video.pix_fmt && video.pix_fmt !== 'yuv420p') add('upload-pixel-format', `픽셀 형식이 ${video.pix_fmt}입니다. 올림 기준은 yuv420p입니다${/^yuvj/.test(video.pix_fmt) ? '(풀 레인지라 플랫폼에서 색이 달라 보일 수 있습니다)' : ''}.`);
  const tags = [video.color_space, video.color_primaries, video.color_transfer];
  if (tags.some(tag => tag && tag !== 'unknown' && tag !== 'bt709') || tags.every(tag => !tag || tag === 'unknown')) add('upload-color', `색 공간 표시가 ${tags.map(tag => tag || '없음').join('/')}입니다. 올림 기준은 BT.709입니다.`);
  const sound = audio[0];
  if (sound) {
    const sampleRate = finite(sound.sample_rate), channels = Number(sound.channels) || 2, soundRate = finite(sound.bit_rate), needSound = channels >= 2 ? 320000 : 128000;
    if (sampleRate !== null && sampleRate !== 48000) add('upload-audio-rate', `소리 샘플레이트가 ${sampleRate}Hz입니다. 올림 기준은 48kHz입니다.`);
    if (soundRate !== null && soundRate < needSound) add('upload-audio-bitrate', `소리 비트레이트가 ${Math.round(soundRate / 1000)}kbps입니다. 올림 기준은 ${channels >= 2 ? '스테레오 384kbps' : '모노 128kbps'}입니다.`);
  }
  return issues;
}

export function compareText(expected, observed) {
  const a = [...normalize(expected)], b = [...normalize(observed)];
  if (a.length > 12000 || b.length > 12000) throw new Error('대본 대조는 문장부호·공백을 뺀 12,000자까지 지원합니다. 편을 나눠 주세요.');
  let previous = Uint16Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = new Uint16Array(b.length + 1); current[0] = i;
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return { expectedCharacters: a.length, observedCharacters: b.length, editDistance: previous[b.length], similarity: Math.max(a.length, b.length) ? 1 - previous[b.length] / Math.max(a.length, b.length) : 1, method: 'normalized-character-edit-distance' };
}

async function inputText(file) {
  const item = await fingerprint(file, 2 * 1024 ** 2);
  const bytes = await readFile(item.path);
  if (createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw new Error('텍스트 입력이 읽는 동안 바뀌었습니다.');
  return { item, text: decoder.decode(bytes) };
}

async function run(program, args, timeout = 180000) {
  const result = await execute(program, args, { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 64 * 1024 ** 2 });
  return result;
}

export async function inspectMedia(options = {}) {
  if (!options.video || !options.out) throw new Error('--video와 --out을 지정해 주세요.');
  const source = await fingerprint(options.video);
  if (!['.mp4', '.webm'].includes(path.extname(source.path).toLowerCase())) throw new Error('MP4·WebM 파일만 검사합니다.');
  const inputs = { video: source }, ffprobe = options.ffprobe || process.env.SYNK_FFPROBE_EXE || 'ffprobe', ffmpeg = options.ffmpeg || process.env.SYNK_FFMPEG_EXE || 'ffmpeg';
  const [metadata, frameResult] = await Promise.all([
    run(ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format', '-of', 'json', source.path]),
    run(ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-select_streams', 'v:0', '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'csv=p=0', source.path]),
  ]);
  const raw = JSON.parse(metadata.stdout), video = raw.streams?.find(row => row.codec_type === 'video'), audio = raw.streams?.filter(row => row.codec_type === 'audio') || [];
  if (!video) throw new Error('영상 스트림이 없습니다.');
  const duration = finite(video.duration) ?? finite(raw.format?.duration);
  if (!duration || duration > 1800) throw new Error('30분 이내의 길이를 확인할 수 있는 영상을 지정해 주세요.');
  const rate = fraction(video.avg_frame_rate) || fraction(video.r_frame_rate);
  const frameValues = frameResult.stdout.split(/\r?\n/).filter(line => line.trim()).map(line => line.split(',')[0]);
  const frames = inspectFrameTimes(frameValues, rate), issues = [...frames.issues];
  const add = (code, severity, at, message) => issues.push({ code, severity, at: at === null ? null : Math.max(0, at ?? 0), message });
  if (frameResult.stderr.trim() || metadata.stderr.trim()) add('decode-error', 'error', null, 'FFprobe가 영상 읽기·디코드 오류를 보고했습니다: ' + (frameResult.stderr || metadata.stderr).trim().slice(0, 500));
  if (!frames.count) add('no-frames', 'error', 0, '실제 디코드한 영상 프레임이 없습니다.');
  if (frames.missingTimestamps) add('missing-frame-time', 'warning', 0, `프레임 ${frames.missingTimestamps}개의 표시 시각을 확인하지 못했습니다.`);
  const decodedEnd = frames.last === null ? null : frames.last + (frames.medianStep || 0);
  const streamStart = finite(video.start_time) ?? 0;
  if (decodedEnd !== null && Math.abs(decodedEnd - streamStart - duration) > Math.max(.15, (frames.medianStep || .04) * 3)) add('decoded-duration', 'warning', Math.min(decodedEnd, duration), `프레임으로 읽은 끝 ${decodedEnd.toFixed(3)}초와 영상 스트림 길이 ${duration.toFixed(3)}초가 다릅니다.`);
  issues.push(...uploadQualityIssues(video, audio, raw.format));
  let loudness = null;
  if (!audio.length) add('no-audio', 'warning', null, '음성 스트림이 없습니다. 무음 영상으로 만든 것인지 확인하세요.');
  for (const stream of audio) {
    const audioDuration = finite(stream.duration);
    if (audioDuration !== null && Math.abs((finite(stream.start_time) ?? 0) + audioDuration - streamStart - duration) > .25) add('av-duration', 'warning', Math.min(audioDuration, duration), `음성 ${stream.index}의 끝과 영상 끝이 ${Math.abs((finite(stream.start_time) ?? 0) + audioDuration - streamStart - duration).toFixed(3)}초 다릅니다.`);
  }
  if (audio.length) {
    const measured = await run(ffmpeg, ['-hide_banner', '-nostdin', '-protocol_whitelist', 'file,pipe', '-i', source.path, '-map', '0:a:0', '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
    const summary = measured.stderr.slice(measured.stderr.lastIndexOf('Summary:'));
    const integrated = /I:\s*(-?[\d.]+)\s*LUFS/.exec(summary), peak = /Peak:\s*(-?[\d.]+)\s*dBFS/.exec(summary);
    loudness = { stream: audio[0].index, integratedLufs: integrated ? Number(integrated[1]) : null, truePeakDbfs: peak ? Number(peak[1]) : null };
    if (loudness.integratedLufs === null || loudness.truePeakDbfs === null) add('loudness-unknown', 'warning', null, '음량 측정값을 확인하지 못했습니다. 무음이거나 측정 지원 범위 밖일 수 있습니다.');
    if (loudness.truePeakDbfs !== null && loudness.truePeakDbfs > -.1) add('audio-peak', 'warning', null, `최대 피크 ${loudness.truePeakDbfs} dBFS입니다. 찌그러짐·클리핑을 직접 들어 확인하세요. 피크의 정확한 시각은 이 검사에서 특정하지 않습니다.`);
    if (loudness.integratedLufs !== null && (loudness.integratedLufs < -25 || loudness.integratedLufs > -9)) add('audio-level', 'warning', null, `통합 음량 ${loudness.integratedLufs} LUFS입니다. 작업용 넓은 확인 범위(-25~-9) 밖이며 플랫폼 합격 기준은 아닙니다.`);
    if (audio.length > 1) add('multiple-audio', 'warning', null, '음량은 첫 음성 스트림만 측정했습니다. 다른 음성 트랙도 직접 확인하세요.');
  }
  let subtitles = null, script = null, transcript = null, comparisons = [];
  if (options.subtitle) {
    const data = await inputText(options.subtitle); inputs.subtitle = data.item;
    const context = vm.createContext({ Intl, TextEncoder });
    vm.runInContext(await readFile(SUBTITLE_SOURCE, 'utf8'), context);
    const parsed = vm.runInContext('subtitleInspect', context)(data.text, { fileName: data.item.path });
    const plain = vm.runInContext('subtitleTranscript', context)(parsed);
    subtitles = { cueCount: parsed.cues.length, text: plain, duration: parsed.durationMs === null ? null : parsed.durationMs / 1000 };
    for (const issue of parsed.issues) add('subtitle-' + issue.code, issue.severity, (parsed.cues.find(cue => cue.index === issue.cue)?.startMs || 0) / 1000, issue.message);
    for (const cue of parsed.cues) if (cue.endMs !== null && cue.endMs / 1000 > duration + .25) add('subtitle-after-video', 'error', cue.startMs / 1000, `${cue.index}번 자막이 영상 끝을 넘습니다.`);
  }
  if (options.script) { const data = await inputText(options.script); inputs.script = data.item; script = data.text; }
  if (options.transcript) {
    const data = await inputText(options.transcript); inputs.transcript = data.item;
    if (path.extname(data.item.path).toLowerCase() === '.json') {
      const saved = JSON.parse(data.text);
      transcript = typeof saved.text === 'string' ? saved.text : Array.isArray(saved.segments) ? saved.segments.map(segment => segment.text || '').join(' ') : null;
      if (transcript === null) throw new Error('받아쓰기 JSON에는 text 또는 segments[].text가 필요합니다.');
    } else transcript = data.text;
  }
  if (script !== null && !normalize(script)) add('script-empty', 'error', null, '제공된 대본에 대조할 글자가 없습니다. 실제 대본을 넣고 다시 검사하세요.');
  if (transcript !== null && !normalize(transcript)) add('transcript-empty', 'error', null, '제공된 받아쓰기에 대조할 글자가 없습니다. 실제 받아쓰기를 넣고 다시 검사하세요.');
  if (script !== null && subtitles === null && transcript === null) add('script-comparison-missing', 'warning', null, '대본은 제공됐지만 자막·받아쓰기가 없어 문자 대조를 하지 못했습니다. 대조하려면 해당 파일을 함께 넣고 다시 검사하세요.');
  if (transcript !== null && script === null) add('transcript-script-missing', 'warning', null, '받아쓰기는 제공됐지만 대본이 없어 문자 대조를 하지 못했습니다. 대조하려면 대본을 함께 넣고 다시 검사하세요.');
  if (script !== null) for (const [kind, observed] of [['subtitles', subtitles?.text], ['provided-transcript', transcript]]) {
    if (observed === null || observed === undefined || !normalize(script) || !normalize(observed)) continue;
    const comparison = { kind, ...compareText(script, observed) }; comparisons.push(comparison);
    if (comparison.similarity < .95) add('script-' + kind, 'warning', null, `대본과 ${kind === 'subtitles' ? '자막' : '제공된 받아쓰기'}의 문자 일치 ${(comparison.similarity * 100).toFixed(1)}%입니다. 전체 원문 대조이며 특정 발음 시각은 판정하지 않습니다. 번역·축약·발음 오류 여부를 사람이 확인하세요.`);
  }
  const outputRoot = path.resolve(options.out);
  await mkdir(outputRoot, { recursive: true });
  if ((await lstat(outputRoot)).isSymbolicLink()) throw new Error('검사 출력 폴더에 링크를 사용할 수 없습니다.');
  const output = path.join(await realpath(outputRoot), 'inspection-' + randomUUID()); await mkdir(output);
  const artifacts = [];
  for (const issue of issues) {
    if (artifacts.length >= 8) break;
    if (issue.at === null) continue;
    const at = Math.max(0, Math.min(issue.at, Math.max(0, duration - .05))), start = Math.max(0, at - 1), end = Math.min(duration, at + 1);
    if (artifacts.some(item => Math.abs(item.at - at) < .25)) continue;
    const name = String(artifacts.length + 1).padStart(2, '0'), clip = name + '-review.mp4', still = name + '-frame.jpg';
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-protocol_whitelist', 'file,pipe', '-i', source.path, '-ss', String(start), '-t', String(Math.max(.1, end - start)), '-map', '0:v:0', '-map', '0:a:0?', '-vf', 'scale=640:-2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', path.join(output, clip)]);
    // Decode by frame number, avoiding -ss rounding at cut boundaries.
    const nearest = frameValues.map(finite).reduce((best, time, i) => time !== null && Math.abs(time - at) < best.distance ? { index: i, distance: Math.abs(time - at) } : best, { index: 0, distance: Infinity }).index;
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-protocol_whitelist', 'file,pipe', '-i', source.path, '-vf', `select=eq(n\\,${nearest}),scale=640:-2`, '-fps_mode', 'passthrough', '-frames:v', '1', path.join(output, still)]);
    artifacts.push({ at, start, end, frame: nearest, clip, still });
  }
  for (const original of Object.values(inputs)) {
    const after = await fingerprint(original.path);
    if (original.sha256 !== after.sha256 || original.byteSize !== after.byteSize) throw new Error('검사 중 입력이 바뀌었습니다. 생성된 검토 파일은 미완료이며 다시 검사해야 합니다.');
  }
  const report = { schema: 'synk-media-preflight/v1', complete: true, inspectedAt: new Date().toISOString(), inputs, media: { duration, start: streamStart, width: video.width, height: video.height, rate, audioStreams: audio.length, audio: audio.map(stream => ({ index: stream.index, duration: finite(stream.duration), start: finite(stream.start_time) })), loudness }, frames: { ...frames, issues: undefined }, subtitles: subtitles ? { cueCount: subtitles.cueCount, duration: subtitles.duration } : null, comparisons, issues, artifacts, status: issues.some(issue => issue.severity === 'error') ? 'blocked' : issues.length ? 'needs-review' : 'ready', limits: ['기술 검사이며 시청·청취·재미·발음 정확성·게시 승인 판정이 아닙니다.', '받아쓰기는 새로 생성하지 않습니다. 제공된 받아쓰기만 대본과 문자 단위로 비교합니다.', '검토 클립은 최대 8개 시간 위치입니다. 전체 영상과 자막은 직접 확인해야 합니다.'] };
  const reportPath = path.join(output, '검사.json');
  await writeFile(path.join(output, '검토.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>영상 사전검사</title><style>body{max-width:920px;margin:40px auto;padding:0 20px;font:17px/1.65 system-ui;background:#f6f3ee;color:#182331}video,img{max-width:100%;max-height:600px}article{padding:20px;margin:20px 0;background:white;border-radius:16px}small{color:#586574}</style><h1>영상 사전검사 · ${escape(report.status)}</h1><p>${escape(path.basename(source.path))} · ${duration.toFixed(2)}초 · 확인할 항목 ${issues.length}개</p><p>${report.limits.map(escape).join('<br>')}</p><ol>${issues.map(issue => `<li><b>${issue.at === null ? '전체 파일' : issue.at.toFixed(3) + '초'} · ${escape(issue.code)}</b> ${escape(issue.message)}</li>`).join('')}</ol>${artifacts.map(item => `<article><h2>${item.at.toFixed(3)}초 주변</h2><video controls preload="metadata" src="${item.clip}"></video><br><img src="${item.still}" alt="${item.frame}번 프레임"><p><small>검토 클립 ${item.start.toFixed(3)}~${item.end.toFixed(3)}초 · 원본 ${item.frame}번 프레임</small></p></article>`).join('')}</html>`, { flag: 'wx' });
  // Publish the completed report only after every review artifact is available.
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return { ...report, reportPath, reviewPath: path.join(output, '검토.html') };
}

export function parseInspectionArgs(argv) {
  const names = { '--video': 'video', '--영상': 'video', '--out': 'out', '--출력': 'out', '--subtitle': 'subtitle', '--자막': 'subtitle', '--script': 'script', '--대본': 'script', '--transcript': 'transcript', '--받아쓰기': 'transcript' }, result = {};
  for (let i = 0; i < argv.length; i++) { const key = names[argv[i]]; if (!key || result[key] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('옵션과 값을 확인해 주세요: ' + argv[i]); result[key] = argv[++i]; }
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 2 || process.argv.includes('--help')) console.log('node tools/영상사전검사.mjs --video "완성본.mp4" --out ".tmp/영상검사" [--subtitle "자막.srt"] [--script "대본.txt"] [--transcript "받아쓰기.json"]\n유료 호출·수정·게시 없이 검사.json과 검토.html을 만듭니다. 오류 2 / 검토 사항 0 / 실행 실패 1로 종료합니다.');
  else try { const result = await inspectMedia(parseInspectionArgs(process.argv.slice(2))); console.log(JSON.stringify({ status: result.status, issueCount: result.issues.length, reportPath: result.reportPath, reviewPath: result.reviewPath }, null, 2)); if (result.status === 'blocked') process.exitCode = 2; } catch (error) { console.error(error.message); process.exitCode = 1; }
}
