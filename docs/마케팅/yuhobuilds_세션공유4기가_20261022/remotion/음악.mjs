// 배경음: node 음악.mjs → public/bgm_cut.wav. 원곡 「Building Momentum」 122.863 BPM(10-17 SHIFT 편 곡, 10-20·10-21 편과 같다).
// 이 편의 사건(박, 시각표.ts 기준): 12 드럼 빠짐(5.9초 「드릴게요」 끝) · 16 다시 터짐(7.9초 b1 「세션 기록이」) ·
//   36~44 조용한 두 마디(17.6~21.5초 b4 「알고 보니, 앱은 로그인할 때만」 — 깨달음은 조용한 데서) · 44 다시 터짐(21.5초 f1 「고친 건 셋」) ·
//   92 끝맺음(45.0초, 끝 카드 45.7초). 자르는 곳은 마디 경계.
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
  [76, 80], // 36~40: 조용한 마디
  [76, 80], // 40~44: 조용한 마디(한 번 더)
  [80, 108], // 44~72: 다시 터짐(고친 셋 · 막대)
  [88, 108], // 72~92: 찾는 법 · 질문 · 설치 한 줄
  [108, null], // 92~: 끝맺음과 여운(끝 카드)
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
