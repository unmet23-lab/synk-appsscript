#!/usr/bin/env node
/** 싱크타운 머무는 모드의 SYNK 음악 — 유호님이 고른 곡을 원곡에서 앱 파일로 만든다(세로 조각 W7b, 곡 후보
 * docs/디자인/싱크타운_머무는모드_곡후보_20261025.md).
 *
 *   node tools/town-music-build.mjs --원본 "<원곡 WAV·FLAC>" --장부 <번호> --제목 "<화면에 보일 곡 제목>" [--id <영문 이름>] [--실행]
 *
 * 기본은 미리 보기다(원곡의 길이·표지와 만들 파일 이름만 보인다). --실행이면:
 *  ① 원곡의 메타데이터에서 Suno 공식 내려받기본의 표지(comment = made with suno; created=…; id=…)를 읽는다 — 표지가
 *     없으면 권리를 확인할 수 없어 멈춘다(음악 원본 장부의 Suno 약관 줄).
 *  ② ffmpeg loudnorm 두 번(재기 → 맞추기)으로 −16 LUFS·최대 −1.5 dBTP, 44.1kHz 스테레오 MP3 128kbps를 만든다. 태그는
 *     싣지 않는다(공개 화면에 제작 도구 이름이 남지 않게).
 *  ③ experiences/synk-town/assets/music/<id>-<파일 해시 앞 8자>.mp3에 쓰고(git 밖 — 공개 사이트에만 올린다),
 *     town/data/music.json에 그 곡의 항목을 더하거나 바꾼 뒤 생성물(town/data.gen.mjs)을 다시 쓴다.
 * 방송 묶음(크로스페이드·음량 맞춤이 든 판)은 넣지 않는다 — 원곡만(장부 「원본 위치」 줄).
 * 시험·다른 자리에 쓸 때: --목록 <music.json> --폴더 <앱 파일 폴더> --생성물생략.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TARGET_LUFS = -16, TARGET_PEAK = -1.5, BITRATE = '128k', RATE = 44100;
const SUNO = /made with suno; created=([^;]+); id=([0-9a-f-]{36})/;

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new Error(`${cmd}를 찾을 수 없어요: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${cmd} 실패: ${(result.stderr || '').split('\n').slice(-6).join(' ')}`);
  return result;
};
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
/** 원곡의 길이와 Suno 표지. */
export function probe(file) {
  const info = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:format_tags', '-of', 'json', file]).stdout);
  const tags = info.format?.tags || {}, comment = tags.comment ?? tags.COMMENT ?? '';
  const mark = SUNO.exec(comment);
  return { durationMs: Math.round(Number(info.format?.duration) * 1000), suno: mark ? { created: mark[1], id: mark[2] } : null };
}
/** loudnorm이 stderr 끝에 적는 JSON 한 덩어리. */
function loudness(stderr) {
  const block = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1);
  return JSON.parse(block);
}
export function slugOf(file) {
  const base = path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return /^[a-z][a-z0-9-]{1,40}$/.test(base) ? base : null;
}

/** 앱 파일 하나와 그 목록 항목을 만든다. 돌려주는 값은 목록 항목. */
export function buildTrack({ original, ledger, title, id = slugOf(original), folder, list, write = true, regenerate = true }) {
  if (!fs.existsSync(original)) throw new Error(`원곡이 없어요: ${original}`);
  if (!Number.isSafeInteger(ledger) || ledger < 1) throw new Error('--장부는 음악 원본 장부의 곡 번호예요.');
  if (!title?.trim()) throw new Error('--제목을 적어 주세요(화면에 보일 곡 제목).');
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(id ?? '')) throw new Error('--id로 영문 이름을 주세요(소문자·숫자·-).');
  const { durationMs, suno } = probe(original);
  if (!suno) throw new Error('Suno 공식 내려받기본의 표지(made with suno; created; id)가 없어요 — 권리를 확인할 수 없어 멈춰요.');
  const preview = { id, title: title.trim(), durationMs, source: { ledger, original: path.basename(original), suno } };
  if (!write) return preview;
  fs.mkdirSync(folder, { recursive: true });
  const filter = `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_PEAK}:LRA=11`;
  const first = loudness(run('ffmpeg', ['-hide_banner', '-nostats', '-i', original, '-af', `${filter}:print_format=json`, '-f', 'null', '-']).stderr);
  const temp = path.join(folder, `${id}.part.mp3`);
  run('ffmpeg', ['-hide_banner', '-nostats', '-y', '-i', original, '-af', `${filter}:measured_I=${first.input_i}:measured_TP=${first.input_tp}:measured_LRA=${first.input_lra}:measured_thresh=${first.input_thresh}:offset=${first.target_offset}:linear=true`,
    '-ar', String(RATE), '-ac', '2', '-c:a', 'libmp3lame', '-b:a', BITRATE, '-map_metadata', '-1', '-id3v2_version', '0', '-write_id3v1', '0', temp]);
  const check = loudness(run('ffmpeg', ['-hide_banner', '-nostats', '-i', temp, '-af', `${filter}:print_format=json`, '-f', 'null', '-']).stderr);
  const fileSha256 = sha256(temp), file = `assets/music/${id}-${fileSha256.slice(0, 8)}.mp3`, target = path.join(folder, path.basename(file));
  for (const old of fs.readdirSync(folder)) if (old.startsWith(`${id}-`) && old.endsWith('.mp3') && old !== path.basename(file)) fs.rmSync(path.join(folder, old));
  fs.renameSync(temp, target);
  const track = { id, title: title.trim(), file, durationMs: probe(target).durationMs, bytes: fs.statSync(target).size, fileSha256,
    lufsTenths: Math.round(Number(check.input_i) * 10), peakTenths: Math.min(0, Math.round(Number(check.input_tp) * 10)), rights: 'suno-paid-official-download',
    source: { ledger, original: path.basename(original), sha256: sha256(original), suno } };
  const data = JSON.parse(fs.readFileSync(list, 'utf8'));
  data.tracks = [...data.tracks.filter(t => t.id !== id), track];
  fs.writeFileSync(list, `${JSON.stringify(data, null, 2)}\n`);
  if (regenerate) {
    const generator = spawnSync(process.execPath, [path.join(ROOT, 'tools/town-data-build.mjs')], { encoding: 'utf8' });
    if (generator.status !== 0) throw new Error(`생성물을 다시 쓰지 못했어요: ${generator.stderr}`);
  }
  return track;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2), value = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  try {
    const write = argv.includes('--실행');
    const track = buildTrack({ original: value('--원본'), ledger: Number(value('--장부')), title: value('--제목'), id: value('--id') ?? slugOf(value('--원본') ?? ''),
      folder: path.resolve(value('--폴더') ?? path.join(ROOT, 'experiences/synk-town/assets/music')),
      list: path.resolve(value('--목록') ?? path.join(ROOT, 'experiences/synk-town/town/data/music.json')), write, regenerate: !argv.includes('--생성물생략') });
    console.log(`${write ? '[만듦]' : '[미리 보기 — --실행을 붙이면 만든다]'}\n${JSON.stringify(track, null, 2)}`);
  } catch (error) { console.error(`town music: ${error.message}`); process.exitCode = 1; }
}
