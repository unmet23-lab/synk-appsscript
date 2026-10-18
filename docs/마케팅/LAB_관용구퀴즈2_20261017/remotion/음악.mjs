// BGM을 영상 박자 구조에 맞춰 다시 잘라 붙인다: node 음악.mjs  (remotion 폴더에서) → public/bgm.wav (30.0초)
// 원곡: Suno 「SYNK LAB Quiz 120 · Tech-pop」 https://suno.com/song/f4f3682d-7b6b-445e-9301-ec63e181e585 (2026-10-13 생성·WAV 공식 다운로드)
// 실측: 119.99 BPM, 마디 첫 박 0.812 + 2k초. 9.31·37.31·67.31초에서 두 박 멈춤 → 한 박 쌓기 → 10.81·38.81·68.81초에 다시 터짐.
// 문제마다 [보통 마디 · 멈춤 마디(카운트다운) · 터지는 마디(정답) · 보통 마디]가 오도록 고른다. 이음매는 장면이 바뀌는 8·16·24초.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const SRC = path.join(REPO, 'docs/홍보물/BGM/퀴즈120_테크팝_f4f3682d.wav');
const OUT = path.join(HERE, 'public', 'bgm.wav');

const SEGMENTS = [
  [6.812, 14.812], // 문제 1
  [34.812, 42.812], // 문제 2
  [64.812, 72.812], // 문제 3
  [14.812, 20.812], // 끝(쉬는 곳 없음)
];
const X = 0.02; // 이음매 교차 길이(초) — 다음 조각이 정확히 마디 첫 박에 오도록 앞 조각을 그만큼 길게 자른다

const parts = SEGMENTS.map(([s, e], i) => {
  const end = i < SEGMENTS.length - 1 ? e + X : e;
  return `[0:a]atrim=start=${s}:end=${end.toFixed(3)},asetpts=PTS-STARTPTS[s${i}]`;
});
let chain = '[s0]';
const fades = [];
for (let i = 1; i < SEGMENTS.length; i++) {
  const out = i === SEGMENTS.length - 1 ? '[mix]' : `[x${i}]`;
  fades.push(`${chain}[s${i}]acrossfade=d=${X}:c1=qsin:c2=qsin${out}`);
  chain = out;
}
const total = SEGMENTS.reduce((t, [s, e]) => t + (e - s), 0);
const filter = [...parts, ...fades, `[mix]afade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8[a]`].join(';');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', SRC, '-filter_complex', filter, '-map', '[a]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', OUT]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUT]).toString().trim();
console.log(`public/bgm.wav ${dur}초 (목표 ${total.toFixed(1)}초)`);
