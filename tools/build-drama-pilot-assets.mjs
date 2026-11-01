#!/usr/bin/env node
// 드라마 말하기 로컬 시범판 — 승인 자산을 재생용으로 정리한다(2026-10-31). 새 생성 없음: 복사·자르기·메타 지우기만.
// 쓰기: node tools/build-drama-pilot-assets.mjs [--원천 <태오 원테이크 폴더>] [--쇼케이스원천 <구운 영상 폴더>] [--확인]
//  · 코치 녹음(content.mjs COACH_VOICE)과 쇼케이스 영상(SHOWCASE_CUTS)은 원천·구간이 있을 때만 만든다 — 없으면 건너뛰고 화면은 지금 판 그대로.
//    감독 녹음은 쓰지 않는다(결정 10-31 「싱크타운 다시 짜기」 ③). 앞 빌드가 남긴 director-*.mp3 사본은 지운다(재생 사본일 뿐, 원천은 s1/소리에 그대로).
//  · 원천 영상 0.3~4.0초에는 학생 모범(Hana) 소리가 구워져 있다. 그 구간은 소리 트랙 없는 듣기 고리로만 내보내고
//    (앞으로 갔다 거꾸로 돌아오는 고리 — 고정 길이로 끊지 않고 학습자가 말하는 동안 계속 돈다),
//    선배의 대답(웃음+대사)은 학생 소리가 끝난 뒤(4.05초)부터 따로 자른다. 어떤 경로로도 Hana 소리가 「내 대답」처럼 나지 않는다.
//  · mp3는 소리를 다시 인코딩하지 않는다(승인 목소리 그대로). ID3·인코더 표식만 뺀다.
//  · 결과: experiences/drama/pilot/media/ + manifest.json(파일·바이트·sha256). 원천은 덮지 않는다.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { COACH_VOICE, SHOWCASE_CUTS, cutFile, cutParts } from '../experiences/drama/pilot/content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'experiences/drama/pilot/media');
const SOUND = path.join(ROOT, 'experiences/drama/s1/소리');
const FONT = path.join(ROOT, 'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2');
const FONT_SHA = 'aa894a204d5a6fbae259dac6868d350cbd373a390caee0313f92946af741df23';
const LATIN_FONTS = [
 { src: 'docs/브랜드_폰트/InterTight/InterTight-Medium.ttf', out: 'InterTight-Medium.woff2' },
 { src: 'docs/브랜드_폰트/InterTight/InterTight-Bold.ttf', out: 'InterTight-Bold.woff2' },
 { src: 'docs/브랜드_폰트/DM_Mono/DMMono-Regular.ttf', out: 'DMMono-Regular.woff2' },
 { src: 'docs/브랜드_폰트/DM_Mono/DMMono-Medium.ttf', out: 'DMMono-Medium.woff2' },
];
const LATIN_RANGE = 'U+0020-007E,U+00A0-00FF,U+2010-2027,U+2030-203A,U+2190-2193,U+2713';

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const VENDOR = opt('--원천') || path.join(os.homedir(), 'Documents/synk-vendor/drama-taeo-onetake-20261031');
const SHOWCASE_SRC = opt('--쇼케이스원천') || path.join(os.homedir(), 'Documents/synk-vendor/drama-showcase-20261031');
const CHECK_ONLY = argv.includes('--확인');

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-nostdin', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

// 메타데이터를 남기지 않는 공통 꼬리(인코더 이름·만든 도구·원천 경로 없음).
const CLEAN = ['-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact', '-metadata:s', 'encoder=', '-metadata:s', 'handler_name='];

const LISTEN = { from: 0.30, to: 3.90 };   // 듣는 연기(입 다묾). 이 구간의 소리는 버린다.
const REPLY_FROM = 4.05;                   // Hana 소리 끝(3.99초 무음 시작) 뒤
if (REPLY_FROM < 4.0) throw new Error('선배 대답은 학생 모범 소리(3.99초에 끝)가 끝난 뒤부터 잘라야 합니다');

// 듣는 고리: [from, to] 구간을 소리 없이 앞으로 갔다 거꾸로 돌아오게. 선배 목소리 구간: from부터 to(없으면 끝)까지, 소리 포함.
const listenLoop = (from, to) => (src, dst) => ff(['-i', src, '-filter_complex',
 `[0:v]trim=start=${from}:end=${to},setpts=PTS-STARTPTS,split[a][b];[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[a][r]concat=n=2:v=1:a=0[v]`,
 '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
 '-flags:v', '+bitexact', '-bsf:v', 'filter_units=remove_types=6', ...CLEAN, dst]);
const voicedCut = (from, to = null) => (src, dst) => {
 const end = to == null ? '' : `:end=${to}`;
 ff(['-i', src, '-filter_complex',
  `[0:v]trim=start=${from}${end},setpts=PTS-STARTPTS[v];[0:a]atrim=start=${from}${end},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.08[a]`,
  '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-flags:v', '+bitexact', '-bsf:v', 'filter_units=remove_types=6', '-flags:a', '+bitexact', ...CLEAN, dst]);
};

export const JOBS = [
 { out: 'taeo-listen.mp4', kind: 'video-silent', note: '듣는 연기 고리(소리 없음, 앞뒤 왕복)', run: listenLoop(LISTEN.from, LISTEN.to), src: 'onetake3-original.mp4' },
 { out: 'taeo-reply.mp4', kind: 'video', note: '선배 웃음+대사(승인 원테이크, 원래 녹음 정렬판)', run: voicedCut(REPLY_FROM), src: 'onetake3-original.mp4' },
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
];
// 코치 녹음(Harrison) — 녹음 전이면 원천이 없어 건너뛴다.
const COACH_MP3 = Object.values(COACH_VOICE).map((v) => [v.source, v.file]);
const STALE = ['director-cut.mp3', 'director-again.mp3', 'director-wrap.mp3', 'director-better-ending.mp3'];

// 쇼케이스 영상: 구간을 채운 자리만. 듣는 고리는 학생 목소리 구간이라 소리를 버리고, 선배 구간은 그 뒤부터여야 한다.
export function showcaseJobs(cuts = SHOWCASE_CUTS) {
 const jobs = [];
 for (const c of cuts) {
  for (const part of cutParts(c)) {
   const [from, to = null] = c[part];
   if (!(Number.isFinite(from) && from >= 0 && (to == null || (Number.isFinite(to) && to > from)))) throw new Error(`${c.cut} ${part} 구간이 이상합니다: ${JSON.stringify(c[part])}`);
   if (part === 'listen' && to == null) throw new Error(`${c.cut} listen은 끝(초)이 있어야 합니다`);
   // 학생 목소리가 든 자리(listenFor)는 listen을 재지 않고 선배 구간만 채우면 Hana 소리가 선배 영상에 실릴 수 있어 막는다.
   if (part !== 'listen' && c.listenFor && !Array.isArray(c.listen)) throw new Error(`${c.cut} ${part}를 채우려면 학생 목소리 구간 listen([시작, 끝])도 재어 채워야 합니다`);
   if (part !== 'listen' && Array.isArray(c.listen) && from < c.listen[1]) throw new Error(`${c.cut} ${part}는 학생 목소리 구간(listen, ${c.listen[1]}초에 끝)이 끝난 뒤부터 잘라야 합니다`);
   jobs.push({ out: cutFile(c, part), kind: part === 'listen' ? 'video-silent' : 'video', note: `쇼케이스 ${c.cut} ${part}`, src: c.src,
    run: part === 'listen' ? listenLoop(from, to) : voicedCut(from, to) });
  }
 }
 return jobs;
}

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
 const waiting = [];
 for (const [from, to] of COACH_MP3) {
  const src = path.join(SOUND, from); const dst = path.join(OUT, to);
  if (!fs.existsSync(src)) { waiting.push(`코치 ${from}`); if (!CHECK_ONLY) fs.rmSync(dst, { force: true }); continue; }
  if (!CHECK_ONLY) ff(['-i', src, '-map', '0:a', '-c:a', 'copy', ...CLEAN, '-id3v2_version', '0', '-write_id3v1', '0', '-write_xing', '0', dst]);
  files.push({ file: to, kind: 'audio', source: `s1/소리/${from}`, sourceSha256: sha(src) });
 }
 const sc = showcaseJobs();
 for (const c of SHOWCASE_CUTS) {
  if (!cutParts(c).length) waiting.push(`쇼케이스 ${c.cut}`);
  // 구간을 비운(null) 자리의 앞 빌드 사본은 지운다 — 화면은 채운 자리만 쓰지만 media에 낡은 영상을 남기지 않게.
  if (!CHECK_ONLY) for (const p of ['listen', 'reply', 'reask']) if (!Array.isArray(c[p])) fs.rmSync(path.join(OUT, cutFile(c, p)), { force: true });
 }
 for (const j of sc) {
  const src = path.join(SHOWCASE_SRC, j.src); const dst = path.join(OUT, j.out);
  if (!fs.existsSync(src)) throw new Error(`쇼케이스 원천 없음: ${j.src} — 구간을 채웠으면 --쇼케이스원천 <폴더>로 알려 주세요`);
  if (!CHECK_ONLY) j.run(src, dst);
  files.push({ file: j.out, kind: j.kind, note: j.note, source: `showcase/${j.src}`, sourceSha256: sha(src) });
 }
 if (!CHECK_ONLY) for (const f of STALE) fs.rmSync(path.join(OUT, f), { force: true });
 if (sha(FONT) !== FONT_SHA) throw new Error('SUIT 글꼴 지문이 다릅니다');
 if (!CHECK_ONLY) fs.copyFileSync(FONT, path.join(OUT, 'SUIT-Variable.woff2'));
 files.push({ file: 'SUIT-Variable.woff2', kind: 'font', source: 'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2', sourceSha256: FONT_SHA });
 // 장면 화면(11-02 시네마 자막)의 영문 Inter Tight · 영문 라벨 DM Mono — 영문·숫자·문장부호만 남긴 woff2(한글은 SUIT가 맡는다).
 for (const f of LATIN_FONTS) {
  const src = path.join(ROOT, f.src); const dst = path.join(OUT, f.out);
  if (!CHECK_ONLY) {
   const r = spawnSync('python', ['-m', 'fontTools.subset', src, `--unicodes=${LATIN_RANGE}`, `--output-file=${dst}`, '--flavor=woff2', '--layout-features=*', '--no-hinting'], { encoding: 'utf8' });
   if (r.status !== 0) { console.error(`${f.out}: 글꼴을 줄이지 못했다(python fontTools 필요) — 화면은 SUIT로 대신한다\n${r.stderr || r.error || ''}`); fs.rmSync(dst, { force: true }); continue; }
  }
  if (fs.existsSync(dst)) files.push({ file: f.out, kind: 'font', source: f.src, sourceSha256: sha(src) });
 }

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
 if (waiting.length) console.log(`아직 없는 자리(녹음·굽기 전 — 화면은 지금 판 그대로): ${waiting.join(' · ')}`);
 console.log('시범판 서버가 떠 있으면 다시 띄워야 새 코치 녹음·영상 자리가 붙는다(content.mjs가 시작 때 한 번 본다).');
 if (problems.length) { console.error('문제:\n - ' + problems.join('\n - ')); process.exit(1); }
 console.log('메타·소리 트랙 검사 통과');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
