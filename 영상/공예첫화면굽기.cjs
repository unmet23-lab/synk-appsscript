#!/usr/bin/env node
'use strict';

// 2026-09-09 후속 지시: 옛 체험 일정도 유지하여 원본 전체를 웹 전달판으로 내보낸다.
// 기존 0–499프레임 파생판과 그 검수 기록은 별도 보존한다. 원본·HTML·사이트는 수정하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const packageDir = path.join(root, 'docs/홍보물/마케팅실행_20260909');
const source = path.join(root, '영상/out/홍보_4K_v2/SYNK_홍보_4K.mp4');
const output = path.join(packageDir, 'assets/craft-film-4k.mp4');
const poster = path.join(packageDir, 'assets/craft-film-poster.jpg');
const qa = path.join(packageDir, '_검토/klofi-v5');
const expectedSourceSha = '4373848ad4451b05aef388486014dd9f5b71464f03bb6da4d2e92b2a4de525b7';
const fps = 24;
const maxBytes = 25 * 1024 * 1024;
const trimmedSha = 'e59bca1648febff20612541f5634aa70396952850a1979d06faf9a0bd0f2f475';
const posterSha = '590af5ba86b69ae14a33e25af6f7def880ac178643ff071c4784c50e7e0b1005';
const trimArchive = path.join(qa, 'craft-trim-0-499-before-full.mp4');
const trimReport = path.join(qa, 'craft-trim-0-499-before-full.json');
const currentReport = path.join(qa, 'craft.json');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(exe, args, acceptedStderr = false) {
  const result = spawnSync(exe, args, {encoding: 'utf8', windowsHide: true, maxBuffer: 20 * 1024 * 1024});
  if (result.error || result.status !== 0) throw new Error(`${exe}: ${result.error || result.stderr}`);
  if (!acceptedStderr && result.stderr.trim()) throw new Error(`${exe} warning: ${result.stderr}`);
  return result;
}
function probe(file) {
  return JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_entries',
    'format=duration,size:stream=index,codec_type,codec_name,width,height,avg_frame_rate,nb_read_frames,duration,sample_rate,channels',
    '-of', 'json', file]).stdout);
}
function frame(file, at, to) {
  run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', file, '-frames:v', '1', '-q:v', '2', to]);
  return {file: path.relative(root, to).replaceAll('\\', '/'), atSeconds: at, sha256: hash(to)};
}
function peak(file, start, seconds) {
  const result = run('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(start), '-t', String(seconds),
    '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], true);
  const mean = result.stderr.match(/mean_volume:\s*([-\d.]+) dB/);
  const max = result.stderr.match(/max_volume:\s*([-\d.]+) dB/);
  return {startSeconds: start, durationSeconds: seconds, meanDb: mean ? +mean[1] : null, maxDb: max ? +max[1] : null};
}
function audioHash(file) {
  return run('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a:0', '-c:a', 'copy',
    '-f', 'hash', '-hash', 'sha256', '-']).stdout.trim();
}
function preserveTrimmedVersion() {
  if (!fs.existsSync(trimArchive)) {
    if (!fs.existsSync(output) || hash(output) !== trimmedSha) throw new Error('보존할 이전 trim본 지문 불일치');
    fs.copyFileSync(output, trimArchive, fs.constants.COPYFILE_EXCL);
  }
  if (hash(trimArchive) !== trimmedSha) throw new Error('보존 trim본 지문 불일치');
  if (!fs.existsSync(trimReport)) {
    const old = JSON.parse(fs.readFileSync(currentReport, 'utf8'));
    if (old.output?.sha256 !== trimmedSha || old.selection?.frameCount !== 500) throw new Error('이전 trim 검수 기록 불일치');
    fs.copyFileSync(currentReport, trimReport, fs.constants.COPYFILE_EXCL);
  }
  if (JSON.parse(fs.readFileSync(trimReport, 'utf8')).output?.sha256 !== trimmedSha) throw new Error('보존 trim 검수 기록 불일치');
}

const args = process.argv.slice(2);
if (!args.includes('--render') && !args.includes('--verify')) {
  console.log('node 영상/공예첫화면굽기.cjs --render | --verify');
  process.exit(0);
}
const sourceShaBefore = hash(source);
if (sourceShaBefore !== expectedSourceSha) throw new Error('원본 SHA 불일치 — 렌더·검사 중단');
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.mkdirSync(qa, {recursive: true});
const sourceInfo = probe(source);
const sourceVideo = sourceInfo.streams.find(s => s.codec_type === 'video');
const frames = +sourceVideo.nb_read_frames;
const duration = frames / fps;
if (sourceVideo.width !== 3840 || sourceVideo.height !== 2160 || sourceVideo.avg_frame_rate !== '24/1' || frames !== 668) {
  throw new Error('원본 전체 4K·24fps·668프레임 규격 불일치');
}
if (!fs.existsSync(poster) || hash(poster) !== posterSha) throw new Error('유지할 포스터 지문 불일치');
const renderArgs = ['-v', 'error', '-y', '-i', source,
  '-map', '0:v:0', '-map', '0:a:0', '-map_metadata', '-1', '-map_chapters', '-1',
  '-r', String(fps), '-fps_mode', 'cfr',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-maxrate', '6M', '-bufsize', '12M', '-threads', '4',
  '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', output];
if (args.includes('--render')) {
  preserveTrimmedVersion();
  console.log('이전 trim본·검수 기록 보존 완료. 4K 원본 전체 668프레임 렌더 시작');
  run('ffmpeg', renderArgs);
}
if (!fs.existsSync(output) || !fs.existsSync(poster)) throw new Error('MP4 또는 포스터 누락');
const info = probe(output);
const video = info.streams.find(s => s.codec_type === 'video');
const audio = info.streams.find(s => s.codec_type === 'audio');
const bytes = fs.statSync(output).size;
if (video?.codec_name !== 'h264' || video.width !== 3840 || video.height !== 2160 ||
    video.avg_frame_rate !== '24/1' || +video.nb_read_frames !== frames) throw new Error('영상 규격 불일치');
if (audio?.codec_name !== 'aac' || audio.sample_rate !== '48000' || audio.channels !== 2) throw new Error('음성 규격 불일치');
if (Math.abs(+video.duration - duration) > 0.002) throw new Error('영상 재생 길이 불일치');
if (bytes >= maxBytes) throw new Error('25MiB 미만 조건 초과');
run('ffmpeg', ['-v', 'error', '-i', output, '-f', 'null', '-']);
const sourceShaAfter = hash(source);
if (sourceShaAfter !== sourceShaBefore) throw new Error('원본이 변경됨');
if (hash(poster) !== posterSha) throw new Error('포스터가 변경됨');
const sourceAudioHash = audioHash(source), outputAudioHash = audioHash(output);
if (sourceAudioHash !== outputAudioHash) throw new Error('원본 AAC 스트림 지문 불일치');
const evidence = [
  frame(source, 25, path.join(qa, 'fullcraft-source-25s.jpg')),
  ...[1, 4, 8.5, 11.5, 16, 19.5, 23, 25, 26.75, (frames - 1) / fps].map((time, i) =>
    frame(output, time, path.join(qa, `fullcraft-output-${String(i).padStart(2, '0')}.jpg`))),
];
const report = {
  generatedAt: new Date().toISOString(), variant: 'full-original-web-delivery', scriptSha256: hash(__filename),
  approval: {date: '2026-09-09', basis: '사용자 후속 지시: 이번 버전에는 옛 체험 일정도 유지하고 추후 대표가 직접 수정한다.',
    oldScheduleRetainedByExplicitRequest: true, scheduleText: '2027. 02. 11 체험 2주',
    doesNotAssertScheduleRevalidated: true},
  source: {file: source, sha256Before: sourceShaBefore, sha256After: sourceShaAfter, unchanged: true, probe: sourceInfo},
  selection: {mode: 'full', firstFrame: 0, lastFrameInclusive: frames - 1, frameCount: frames, fps,
    durationSeconds: duration, lastFrameTimestampSeconds: (frames - 1) / fps, sourceFramesOmitted: 0},
  priorTrimmedVersion: {file: trimArchive, sha256: hash(trimArchive), report: trimReport, reportSha256: hash(trimReport),
    evidencePrefix: 'craft-output-', note: '이전500프레임 판의 증거이며 현재 전체본 증거와 혼합하지 않는다.'},
  output: {file: output, sha256: hash(output), bytes, sizeMiB: bytes / 1024 / 1024, maxBytesExclusive: maxBytes, probe: info},
  poster: {file: poster, sha256: hash(poster), bytes: fs.statSync(poster).size, unchanged: true,
    source: trimArchive, atSeconds: 1, note: '앞선 파생본1초의 솜 질감 포스터를 요청대로 그대로 유지.', probe: probe(poster)},
  encoding: {crf: 22, maxrate: '6M', bufsize: '12M', preset: 'medium', audioCodec: 'copy',
    sameOriginalBgm: true, additionalMusicOrGeneration: false, additionalEndFadeSeconds: 0,
    originalAudioFadePreserved: true, sourceAudioHash, outputAudioHash},
  checks: {decodeErrors: 0, requiredDimensions: true, requiredFrameCount: true, under25MiB: true, sourceUnchanged: true,
    posterUnchanged: true, compressedAudioPayloadIdentical: true,
    overallAudio: peak(output, 0, duration),
    finalAudio: peak(output, duration - 0.08, 0.08)},
  evidence,
  visualInspection: {status: 'pending', scope: 'fullcraft 이름의 전체본 새 프레임만 확인한 뒤 갱신한다. 이전 trim판 통과를 전용하지 않는다.'},
  boundaries: ['원본·HTML·Sites 미수정', '신규 생성·과금·외부 전송 없음', '사람 청취 및 공개 재생 검증 아님'],
};
fs.writeFileSync(currentReport, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({output: report.output.file, sha256: report.output.sha256, sizeMiB: report.output.sizeMiB,
  frameCount: frames, durationSeconds: video.duration, decodeErrors: 0, report: path.join(qa, 'craft.json')}, null, 2));
