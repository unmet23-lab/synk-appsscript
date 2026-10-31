#!/usr/bin/env node
// 드라마 말하기 로컬 시범판 — 승인 자산을 재생용으로 정리한다(2026-10-31). 새 생성 없음: 복사·자르기·메타 지우기만.
// 쓰기: node tools/build-drama-pilot-assets.mjs [--원천 <태오 원테이크 폴더>] [--확인]
//  · 원천 영상 0.3~4.0초에는 학생 모범(Hana) 소리가 구워져 있다. 그 구간은 소리 트랙 없는 듣기 고리로만 내보내고
//    (앞으로 갔다 거꾸로 돌아오는 고리 — 고정 길이로 끊지 않고 학습자가 말하는 동안 계속 돈다),
//    선배의 대답(웃음+대사)은 학생 소리가 끝난 뒤(4.05초)부터 따로 자른다. 어떤 경로로도 Hana 소리가 「내 대답」처럼 나지 않는다.
//  · mp3는 소리를 다시 인코딩하지 않는다(승인 목소리 그대로). ID3·인코더 표식만 뺀다.
//  · 결과: experiences/drama/pilot/media/ + manifest.json(파일·바이트·sha256). 원천은 덮지 않는다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'experiences/drama/pilot/media');
const SOUND = path.join(ROOT, 'experiences/drama/s1/소리');
const FONT = path.join(ROOT, 'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2');
const FONT_SHA = 'aa894a204d5a6fbae259dac6868d350cbd373a390caee0313f92946af741df23';

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const VENDOR = opt('--원천') || path.join(os.homedir(), 'Documents/synk-vendor/drama-taeo-onetake-20261031');
const CHECK_ONLY = argv.includes('--확인');

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-nostdin', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

// 메타데이터를 남기지 않는 공통 꼬리(인코더 이름·만든 도구·원천 경로 없음).
const CLEAN = ['-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact', '-metadata:s', 'encoder=', '-metadata:s', 'handler_name='];

const LISTEN = { from: 0.30, to: 3.90 };   // 듣는 연기(입 다묾). 이 구간의 소리는 버린다.
const REPLY_FROM = 4.05;                   // Hana 소리 끝(3.99초 무음 시작) 뒤
if (REPLY_FROM < 4.0) throw new Error('선배 대답은 학생 모범 소리(3.99초에 끝)가 끝난 뒤부터 잘라야 합니다');

export const JOBS = [
 { out: 'taeo-listen.mp4', kind: 'video-silent', note: '듣는 연기 고리(소리 없음, 앞뒤 왕복)',
   run: (src, dst) => ff(['-i', src, '-filter_complex',
     `[0:v]trim=start=${LISTEN.from}:end=${LISTEN.to},setpts=PTS-STARTPTS,split[a][b];[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[a][r]concat=n=2:v=1:a=0[v]`,
     '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
     '-flags:v', '+bitexact', '-bsf:v', 'filter_units=remove_types=6', ...CLEAN, dst]), src: 'onetake3-original.mp4' },
 { out: 'taeo-reply.mp4', kind: 'video', note: '선배 웃음+대사(승인 원테이크, 원래 녹음 정렬판)',
   run: (src, dst) => ff(['-i', src, '-filter_complex',
     `[0:v]trim=start=${REPLY_FROM},setpts=PTS-STARTPTS[v];[0:a]atrim=start=${REPLY_FROM},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.08[a]`,
     '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
     '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-flags:v', '+bitexact', '-bsf:v', 'filter_units=remove_types=6', '-flags:a', '+bitexact', ...CLEAN, dst]),
   src: 'onetake3-original.mp4' },
 { out: 'taeo-still.webp', kind: 'image', note: '같은 인물 정지 사진(음성만 있는 대사에 쓴다 — 립싱크 아님)',
   run: (src, dst) => ff(['-i', src, '-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libwebp', '-quality', '82', ...CLEAN, dst]),
   src: 'vid-senior-real.png' },
 { out: 'taeo-still-blur.webp', kind: 'image', note: '데스크톱 바탕용 흐린 사진',
   run: (src, dst) => ff(['-i', src, '-vf', 'scale=144:256,gblur=sigma=6,scale=288:512', '-c:v', 'libwebp', '-quality', '60', ...CLEAN, dst]),
   src: 'vid-senior-real.png' },
];

const MP3 = [
 ['ep01-senior-01.mp3', 'senior-01.mp3'], ['ep01-senior-03.mp3', 'senior-03.mp3'], ['ep01-senior-04.mp3', 'senior-04.mp3'],
 ['ep01-senior-05.mp3', 'senior-ask-1.mp3'], ['ep01-senior-06.mp3', 'senior-ask-2.mp3'], ['ep01-senior-07.mp3', 'senior-ask-3.mp3'],
 ['ep01-model-06.mp3', 'model-6.mp3'], ['ep01-model-07.mp3', 'model-7.mp3'], ['ep01-model-08.mp3', 'model-8.mp3'],
 ['ep01-director-02.mp3', 'director-cut.mp3'], ['ep01-director-04.mp3', 'director-again.mp3'],
 ['ep01-director-06.mp3', 'director-wrap.mp3'], ['ep01-director-08.mp3', 'director-better-ending.mp3'],
];

function probeTags(p) {
 const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format_tags:stream_tags', '-of', 'json', p], { encoding: 'utf8' });
 const j = JSON.parse(out);
 const tags = { ...(j.format?.tags || {}) };
 for (const s of j.streams || []) Object.assign(tags, s.tags || {});
 // 장치 의존이 아닌 무해한 꼬리표(언어·핸들러 이름 기본값)는 허용.
 for (const k of Object.keys(tags)) if (/^(language|handler_name|vendor_id|major_brand|minor_version|compatible_brands)$/i.test(k)) delete tags[k];
 return tags;
}

function main() {
 if (!fs.existsSync(VENDOR)) { console.error(`원천 폴더가 없습니다: --원천 <폴더>로 알려 주세요.`); process.exit(2); }
 fs.mkdirSync(OUT, { recursive: true });
 const files = [];
 for (const j of JOBS) {
  const src = path.join(VENDOR, j.src); const dst = path.join(OUT, j.out);
  if (!fs.existsSync(src)) throw new Error(`원천 없음: ${j.src}`);
  if (!CHECK_ONLY) j.run(src, dst);
  files.push({ file: j.out, kind: j.kind, note: j.note, source: j.src, sourceSha256: sha(src) });
 }
 for (const [from, to] of MP3) {
  const src = path.join(SOUND, from); const dst = path.join(OUT, to);
  if (!CHECK_ONLY) ff(['-i', src, '-map', '0:a', '-c:a', 'copy', ...CLEAN, '-id3v2_version', '0', '-write_id3v1', '0', '-write_xing', '0', dst]);
  files.push({ file: to, kind: 'audio', source: `s1/소리/${from}`, sourceSha256: sha(src) });
 }
 if (sha(FONT) !== FONT_SHA) throw new Error('SUIT 글꼴 지문이 다릅니다');
 if (!CHECK_ONLY) fs.copyFileSync(FONT, path.join(OUT, 'SUIT-Variable.woff2'));
 files.push({ file: 'SUIT-Variable.woff2', kind: 'font', source: 'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2', sourceSha256: FONT_SHA });

 const problems = [];
 for (const f of files) {
  const p = path.join(OUT, f.file);
  if (!fs.existsSync(p)) { problems.push(`${f.file}: 없음`); continue; }
  f.bytes = fs.statSync(p).size; f.sha256 = sha(p);
  if (f.kind !== 'font') { const t = probeTags(p); if (Object.keys(t).length) problems.push(`${f.file}: 메타 남음 ${JSON.stringify(t)}`); }
  if (f.kind === 'video-silent') {
   const a = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', p], { encoding: 'utf8' }).trim();
   if (a) problems.push(`${f.file}: 소리 트랙이 있으면 안 됩니다`);
  }
  if (f.kind === 'audio' || f.kind === 'video') {
   const head = fs.readFileSync(p).subarray(0, 3).toString('latin1');
   if (f.kind === 'audio' && head === 'ID3') problems.push(`${f.file}: ID3 머리가 남음`);
  }
  // 바이트 안에 PC 경로·도구 이름이 남았는지 거칠게 본다.
  const raw = fs.readFileSync(p).toString('latin1');
  for (const needle of ['Lavf', 'Lavc', 'x264', 'Users\\', 'Users/', 'higgsfield', 'elevenlabs', 'synk-vendor']) if (raw.includes(needle)) problems.push(`${f.file}: 「${needle}」 문자열이 남음`);
 }
 const manifest = { made: new Date().toISOString(), note: '승인 자산 재사용(새 생성 0). 원천 경로·생성 도구 이름은 싣지 않는다.', files: files.map(({ sourceSha256, ...rest }) => ({ ...rest, sourceSha256 })) };
 if (!CHECK_ONLY) fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
 const total = files.reduce((s, f) => s + (f.bytes || 0), 0);
 console.log(`파일 ${files.length}개 · ${(total / 1024 / 1024).toFixed(2)}MB`);
 if (problems.length) { console.error('문제:\n - ' + problems.join('\n - ')); process.exit(1); }
 console.log('메타·소리 트랙 검사 통과');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
