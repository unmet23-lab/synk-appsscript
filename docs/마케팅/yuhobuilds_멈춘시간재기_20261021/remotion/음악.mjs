// 배경음: node 음악.mjs → public/bgm_cut.wav. 원곡 「Building Momentum」 122.863 BPM(10-17 SHIFT 편 곡, 10-20 첫날 편과 같다).
// 이 편의 사건(박, 시각표.ts 기준): 12 드럼 빠짐(5.9초 「다 드릴게요」 끝) · 16 다시 터짐(7.9초 「맡겼더니」) ·
//   36~40 조용한 마디(17.6~19.6초 「목소리가 계속 나오니까요」 — 깨달음은 조용한 데서) · 40 다시 터짐(19.6초 「고친 건 셋」) ·
//   84 끝맺음(37.2초, 끝 카드 37.3초). 자르는 곳은 마디 경계.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'public', 'bgm.mp3');
const BEAT = 60 / 122.863;
const t = (k) => +(0.054 + k * BEAT).toFixed(4);
const X = 0.02;
const PLAN = [
  [0, 36], // 0~36: 시작 · 12 드럼 빠짐 · 16 다시 터짐
  [76, 80], // 36~40: 조용한 마디(「목소리가 계속」)
  [80, 108], // 40~68: 다시 터짐(고치는 셋 · 띠 둘 · 요청문)
  [104, 108], // 68~72
  [104, 108], // 72~76
  [108, null], // 76~: 끝맺음과 여운(끝 카드)
];
const segs = PLAN.map(([a, b], i) => [i === 0 ? 0 : t(a), b === null ? 57.9 : t(b)]);
const parts = segs.map(([s, e], i) => `[0:a]atrim=start=${s}:end=${(i < segs.length - 1 ? e + X : e).toFixed(4)},asetpts=PTS-STARTPTS[s${i}]`);
let chain = '[s0]';
const fades = [];
for (let i = 1; i < segs.length; i++) {
  const o = i === segs.length - 1 ? '[mix]' : `[x${i}]`;
  fades.push(`${chain}[s${i}]acrossfade=d=${X}:c1=qsin:c2=qsin${o}`);
  chain = o;
}
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', SRC, '-filter_complex', [...parts, ...fades].join(';'), '-map', '[mix]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', path.join(HERE, 'public', 'bgm_cut.wav')]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(HERE, 'public', 'bgm_cut.wav')]).toString().trim();
console.log(`public/bgm_cut.wav ${(+dur).toFixed(2)}초`);
