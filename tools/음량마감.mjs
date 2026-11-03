#!/usr/bin/env node
// 음량 마감 공용 도구 — 회차마다 복사해 쓰던 마감.mjs·finish.mjs·렌더.mjs의 소리 마감을 합쳤다(2026-10-19). 유료 호출 없음.
//   node tools/음량마감.mjs <렌더.mp4> [<마감.mp4>] [--휴대폰 <폰.mp4>]
//   기본 출력은 같은 폴더 <이름>_final.mp4. 영상은 그대로 복사하고 소리만 다시 담는다. 이미 있는 파일은 --덮어쓰기 없이 덮지 않는다.
// 하는 일(현장 노트 영상_ffmpeg_자막.md 「띄엄띄엄 효과음」「Remotion 나레이션 믹스」):
//   ① ebur128로 통합 크기를 잰다 ② 목표와의 차이만큼 volume으로 올리고 alimiter로 봉우리만 누른다(loudnorm은 띄엄띄엄 소리에서 모자람)
//   ③ 다시 재서 목표와 0.3 넘게 다르면 그만큼 더 맞춰 한 번 더 굽는다(리미터가 누른 만큼 통합 크기가 내려간다)
//   ④ 올림 마스터(짧은 변 1080 이상)의 실제 AAC가 스테레오 320k·모노 128k 미만이면 원래 렌더에서 품질 모드로 최대 두 번 다시 굽는다.
//   ⑤ 끝내 비트레이트가 미달이면 별도 검토 폴더에 마지막 후보를 남기고 종료 코드 1. 저용량을 직접 지정한 판과 휴대폰 판은 올림 비트레이트 대상에서 뺀다.
// 기본값(가장 나중의 고침): 목표 −14.5 LUFS, 리미터 0.84(−1.5 dBFS)·attack 1·release 60, AAC 384kbps·48kHz(10-19 올림 화질).
//   휴대폰 판(30MiB 아래 보내기용)은 렌더 원본에서 같은 크기로 다시 굽는다: libx264 crf 28, AAC 96k, 리미터 0.82(96k는 봉우리가 솟는다).
//   옛 회차를 그대로 다시 만들 때는 그 회차 값을 준다: 예) 10-13~10-18 마감.mjs = --목표 -14 --다시맞춤 0 --통과 -15,-14 --소리 256k --표본율 원본
// 옵션: --목표 -14.5 · --허용 0.5 · --통과 낮은,높은 · --봉우리 -1.2 · --리미터 0.84 · --어택 1 · --릴리스 60 · --다시맞춤 0.3(0이면 한 번만)
//       --소리 384k · --표본율 48000|원본 · --휴대폰리미터 0.82 · --덮어쓰기 · --json
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { uploadAudioBitrateFloor } from './영상사전검사.mjs';
import audioRates from './lib/upload-audio-bitrate.cjs';

const run = promisify(execFile);
const PHONE_LIMIT = 30 * 1024 * 1024;
const AAC_MODES = [null, { coder: 'twoloop', quality: 3.5 }, { coder: 'fast', quality: 8 }];
export const DEFAULTS = { target: -14.5, tolerance: 0.5, window: null, ceiling: -1.2, limit: 0.84, attack: 1, release: 60, correct: 0.3, bitrate: audioRates.ENCODING_TARGET_BPS / 1000 + 'k', rate: 48000, phoneLimit: 0.82, maxPasses: 3 };

const tools = (o = {}) => ({ ffmpeg: o.ffmpeg || process.env.SYNK_FFMPEG_EXE || 'ffmpeg', ffprobe: o.ffprobe || process.env.SYNK_FFPROBE_EXE || 'ffprobe' });
// ebur128 요약에서 마지막 I·Peak를 읽는다(peak=true면 참 봉우리). 소리가 없으면 오류.
export function parseEbur128(stderr) {
  const s = String(stderr), tail = s.slice(s.lastIndexOf('Summary:'));
  const I = [...tail.matchAll(/I:\s+(-?[\d.]+|-inf) LUFS/g)].pop(), P = [...tail.matchAll(/Peak:\s+(-?[\d.]+|-inf) dBFS/g)].pop(), L = /LRA:\s+(-?[\d.]+) LU/.exec(tail);
  if (!I || !P) throw Error('음량을 읽지 못했습니다(소리 스트림이 없거나 무음).');
  const num = (m) => (m[1] === '-inf' ? -Infinity : Number(m[1]));
  return { I: num(I), peak: num(P), LRA: L ? Number(L[1]) : null };
}
export async function measure(file, o = {}) {
  const r = await run(tools(o).ffmpeg, ['-hide_banner', '-nostats', '-nostdin', '-i', file, '-map', '0:a:0', '-vn', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], { windowsHide: true, maxBuffer: 1 << 26 });
  return parseEbur128(r.stderr);
}
export async function streams(file, o = {}) {
  const r = await run(tools(o).ffprobe, ['-v', 'error', '-show_entries', 'stream=index,codec_type,codec_name,width,height,duration,sample_rate,channels,bit_rate,nb_frames:format=duration,size', '-of', 'json', file], { windowsHide: true });
  const j = JSON.parse(r.stdout), v = j.streams.find((x) => x.codec_type === 'video'), a = j.streams.find((x) => x.codec_type === 'audio');
  return { video: v ? { codec: v.codec_name, width: v.width, height: v.height, duration: Number(v.duration), frames: v.nb_frames ? Number(v.nb_frames) : null } : null,
    audio: a ? { codec: a.codec_name, duration: Number(a.duration), rate: Number(a.sample_rate), channels: a.channels, bitrate: Number(a.bit_rate) > 0 ? Number(a.bit_rate) : null } : null,
    duration: Number(j.format.duration), size: Number(j.format.size) };
}
export function audioFilter(gain, limit, { attack, release }) {
  return `volume=${gain}dB,alimiter=limit=${limit}:attack=${attack}:release=${release}:level=false`;
}
// 다음 굽기의 크기 보정: 첫 번은 목표 − 잰 값, 그다음은 남은 차이만큼 더한다. 차이가 correct 아래면 멈춘다.
export function nextGain(gain, measured, o) {
  const off = o.target - measured;
  return Math.abs(off) > o.correct && o.correct > 0 ? +(gain + off).toFixed(2) : null;
}
export function passes(after, o) {
  const [lo, hi] = o.window || [o.target - o.tolerance, o.target + o.tolerance];
  return after.I >= lo - 1e-9 && after.I <= hi + 1e-9 && after.peak <= o.ceiling + 1e-9;
}
async function checkBitrate(file, info, o) {
  const minimumBps = uploadAudioBitrateFloor(info.video, info.audio?.channels);
  // FFmpeg accepts both decimal and binary units (e.g. 256k, 0.256M, 250Ki).
  const units = { '': 1, k: 1000, K: 1000, M: 1e6, ki: 1024, Ki: 1024, Mi: 1024 ** 2 };
  const match = /^(\d*\.?\d+(?:[eE][+-]?\d+)?)([kKM]i?)?(B?)$/.exec(String(o.bitrate).trim());
  const requestedBps = match ? Number(match[1]) * units[match[2] || ''] * (match[3] ? 8 : 1) : null;
  const enforced = minimumBps !== null && !(requestedBps > 0 && requestedBps < minimumBps);
  const known = audioRates.streamBps(info.audio?.bitrate);
  const { actualBps, measurement } = enforced ? await audioRates.measureStreamBitrate(file, tools(o).ffprobe, known)
    : { actualBps: known, measurement: known === null ? null : 'stream' };
  return { actualBps, minimumBps, enforced, measurement, ok: !enforced || (actualBps !== null && actualBps >= minimumBps) };
}

const stagingPath = (out) => path.join(path.dirname(out), '.synk-audio-' + randomUUID() + '.part' + path.extname(out));
async function encode(src, stage, args, o) {
  await run(tools(o).ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', src, ...args, '-movflags', '+faststart', stage], { windowsHide: true, maxBuffer: 1 << 26 });
}
function publish(stage, out, overwrite) {
  if (overwrite) return fs.renameSync(stage, out);
  try {
    fs.linkSync(stage, out);
  } catch (error) {
    if (error.code === 'EEXIST') throw error;
    fs.copyFileSync(stage, out, fs.constants.COPYFILE_EXCL);
  }
}

async function masterPasses(src, stage, before, rateArgs, o) {
  const attempts = [];
  let gain = +(o.target - before.I).toFixed(2), gainPass = 1, qualityIndex = 0;
  for (;;) {
    const mode = AAC_MODES[qualityIndex];
    const encoding = mode ? ['-aac_coder', mode.coder, '-q:a', String(mode.quality)] : ['-b:a', o.bitrate];
    await encode(src, stage, ['-map', '0:v:0?', '-map', '0:a:0', '-c:v', 'copy', '-af', audioFilter(gain, o.limit, o), '-c:a', 'aac', ...encoding, ...rateArgs], o);
    const [after, info] = await Promise.all([measure(stage, o), streams(stage, o)]);
    const bitrate = await checkBitrate(stage, info, o);
    attempts.push({ gain, I: after.I, peak: after.peak, bitrateBps: bitrate.actualBps, aacQuality: mode?.quality ?? null, aacCoder: mode?.coder ?? null });
    const next = gainPass < o.maxPasses ? nextGain(gain, after.I, o) : null;
    if (next !== null) { gain = next; gainPass++; continue; }
    if (!bitrate.ok && bitrate.actualBps !== null && qualityIndex < AAC_MODES.length - 1) { qualityIndex++; continue; }
    return { attempts, after, info, gain, bitrate };
  }
}
// 같은 파일인지: 윈도우는 대소문자를 가리지 않고, 있으면 파일 번호(ino·dev)로도 본다(다른 이름의 링크까지).
export function sameFile(a, b) {
  const x = path.resolve(a), y = path.resolve(b);
  if (process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y) return true;
  try { const s = fs.statSync(x, { bigint: true }), t = fs.statSync(y, { bigint: true }); return s.ino !== 0n && s.ino === t.ino && s.dev === t.dev; } catch { return false; }
}
export async function finish(src, out, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (!Number.isSafeInteger(o.maxPasses) || o.maxPasses < 1) throw Error('음량 보정 횟수는 1 이상의 정수여야 합니다.');
  src = path.resolve(src); out = path.resolve(out || src.replace(/(\.[^.]+)$/, '_final$1'));
  const phone = o.phone && path.resolve(o.phone);
  if (!fs.existsSync(src)) throw Error('렌더 파일이 없습니다: ' + src);
  if (!/\.(mp4|mov|m4v|mkv|webm)$/i.test(out) || (o.phone && !/\.(mp4|mov|m4v)$/i.test(o.phone))) throw Error('출력 파일 이름은 .mp4 같은 영상 확장자로 끝나야 합니다.');
  if (sameFile(out, src) || (phone && sameFile(phone, src))) throw Error('렌더 원본을 덮어쓸 수 없습니다. 다른 출력 이름을 주세요.');
  if (phone && sameFile(out, phone)) throw Error('마감본과 휴대폰 판은 서로 다른 출력 이름을 주세요.');
  for (const f of [out, phone].filter(Boolean)) if (fs.existsSync(f) && !o.overwrite) throw Error(`이미 있는 파일입니다: ${f}\n  다시 만들려면 --덮어쓰기를 주세요(완성본을 지우지 않게 기본은 멈춤).`);
  const srcInfo = await streams(src, o);
  if (!srcInfo.audio) throw Error('소리 스트림이 없습니다: ' + src);
  const before = await measure(src, o);
  const rateArgs = o.rate === 'source' ? [] : ['-ar', String(o.rate)];
  const stage = stagingPath(out), phoneStage = phone && stagingPath(phone);
  try {
    const { attempts, after, info, gain, bitrate } = await masterPasses(src, stage, before, rateArgs, o);
    const report = { src, out, before, gain, passes: attempts, after, bitrate, ok: bitrate.ok && passes(after, o), written: false,
      target: o.target, window: o.window || [o.target - o.tolerance, o.target + o.tolerance], ceiling: o.ceiling,
      settings: { limit: o.limit, attack: o.attack, release: o.release, bitrate: o.bitrate, rate: o.rate },
      duration: { srcVideo: srcInfo.video?.duration ?? null, outVideo: info.video?.duration ?? null, srcAudio: srcInfo.audio.duration, outAudio: info.audio?.duration ?? null } };
    // 비트레이트 미달은 항상 별도 폴더에 둔다. 음량만 벗어난 새 출력은 종전 계약대로 지정한 이름에 남기고 종료 코드 1로 알린다.
    if (!bitrate.ok || (!report.ok && (fs.existsSync(out) || (phone && fs.existsSync(phone))))) {
      const reviewDir = fs.mkdtempSync(path.join(path.dirname(out), '음량마감-검토-'));
      report.reviewPath = path.join(reviewDir, path.basename(out));
      try { fs.renameSync(stage, report.reviewPath); }
      catch (error) { fs.rmdirSync(reviewDir); throw error; }
      return report;
    }
    if (phone) {
      await encode(src, phoneStage, ['-map', '0:v:0?', '-map', '0:a:0', '-c:v', 'libx264', '-crf', '28', '-preset', 'medium', '-pix_fmt', 'yuv420p',
        '-af', audioFilter(gain, o.phoneLimit, o), '-c:a', 'aac', '-b:a', '96k', ...rateArgs], o);
      const m = await measure(phoneStage, o), size = fs.statSync(phoneStage).size;
      report.phone = { out: phone, ...m, size, underLimit: size < PHONE_LIMIT };
    }
    publish(stage, out, o.overwrite && report.ok);
    if (phone) publish(phoneStage, phone, o.overwrite && report.ok);
    report.written = true;
    return report;
  } finally {
    fs.rmSync(stage, { force: true });
    if (phoneStage) fs.rmSync(phoneStage, { force: true });
  }
}

function parseArgs(argv) {
  const o = {}, files = [];
  const num = (name, v) => { const n = Number(v); if (!Number.isFinite(n)) throw Error(`${name}에는 숫자를 주세요: ${v}`); return n; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => { if (argv[i + 1] === undefined) throw Error(`${a} 뒤에 값이 필요합니다.`); return argv[++i]; };
    if (a === '--휴대폰') o.phone = v();
    else if (a === '--목표') o.target = num(a, v());
    else if (a === '--허용') o.tolerance = num(a, v());
    else if (a === '--통과') { const [lo, hi] = v().split(',').map((x) => num(a, x)); o.window = [lo, hi]; }
    else if (a === '--봉우리') o.ceiling = num(a, v());
    else if (a === '--리미터') o.limit = num(a, v());
    else if (a === '--어택') o.attack = num(a, v());
    else if (a === '--릴리스') o.release = num(a, v());
    else if (a === '--다시맞춤') o.correct = num(a, v());
    else if (a === '--소리') o.bitrate = v();
    else if (a === '--표본율') { const x = v(); o.rate = x === '원본' ? 'source' : num(a, x); }
    else if (a === '--휴대폰리미터') o.phoneLimit = num(a, v());
    else if (a === '--덮어쓰기') o.overwrite = true;
    else if (a === '--json') o.json = true;
    else if (a === '--도움' || a === '--help') o.help = true;
    else if (a.startsWith('--')) throw Error('모르는 인자: ' + a);
    else files.push(a);
  }
  return { o, files };
}
export async function main(argv = process.argv.slice(2)) {
  const { o, files } = parseArgs(argv);
  if (o.help || !files.length || files.length > 2) {
    const out = [];
    for (const l of fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n')) { if (l.startsWith('//')) out.push(l.replace(/^\/\/ ?/, '')); else if (out.length) break; }
    console.log(out.join('\n'));
    return o.help ? 0 : 1;
  }
  const r = await finish(files[0], files[1], o);
  if (o.json) console.log(JSON.stringify(r));
  else {
    console.log(`${r.before.I} LUFS / ${r.before.peak} dBFS → ${r.passes.map((p) => `${p.gain >= 0 ? '+' : ''}${p.gain}dB → ${p.I} LUFS / ${p.peak} dBFS · AAC ${p.bitrateBps ?? '미확인'}bps`).join(' → ')}`);
    if (!r.bitrate.ok) console.log(`  ⚠ 게시 통과 기준 ${r.bitrate.minimumBps / 1000}kbps 이상 · 인코딩 목표 ${r.settings.bitrate} · 실측 ${r.bitrate.actualBps === null ? '측정 불가' : r.bitrate.actualBps / 1000 + 'kbps'}`);
    if (!passes(r.after, r)) console.log(`  ⚠ 음량 범위 밖(${r.window.join('~')} LUFS · 최대 ${r.ceiling} dBFS)`);
    console.log(`  ${r.ok ? '통과' : '미통과'} · ${r.written ? '저장' : '미저장'} ${r.out} · 영상 ${r.duration.srcVideo}→${r.duration.outVideo}초 · 소리 ${r.duration.srcAudio}→${r.duration.outAudio}초`);
    if (r.reviewPath) console.log(`  검토용 파일 ${r.reviewPath}`);
    if (r.phone) console.log(`  휴대폰 ${r.phone.out} · ${r.phone.I} LUFS / ${r.phone.peak} dBFS · ${(r.phone.size / 1048576).toFixed(1)}MiB${r.phone.underLimit ? '' : ' ⚠ 30MiB 넘음(휴대폰에 안 뜰 수 있음)'}`);
  }
  return r.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }).catch((error) => { console.error(error.message); process.exitCode = 2; });
}
