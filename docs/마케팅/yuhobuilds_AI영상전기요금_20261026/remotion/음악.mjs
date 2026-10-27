// 배경음: node 음악.mjs → public/bgm_ig.wav · public/bgm_yt.wav. 원곡 「Building Momentum」 122.863 BPM(10-17 SHIFT 편 곡, yuhobuilds 지난 편들과 같다).
// 원곡 그대로의 사건: 12박 드럼 빠짐(5.9초 — 「그래픽카드 전기를 재 봤어요」 끝) · 16박 다시 터짐(7.9초 — 「맞혀 보세요」 끝, 답 바로 앞).
// 끝맺음(원곡 108박부터)은 판마다 끝 카드에 가장 가까운 마디 경계에 붙인다(시각표: npx tsx 시각표.ts).
//   셋째 판: ig 끝 카드 22.47초 · yt 끝 카드 21.13초 → 둘 다 44박(21.54초).
//   다시 살림 v2(10-27): 끝 카드 16.80초 → 34박(16.66초 — 이해 시험 1회 뒤 답 줄이 길어짐), public/bgm_v2.wav.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'public', 'bgm.mp3');
const BEAT = 60 / 122.863;
const t = (k) => +(0.054 + k * BEAT).toFixed(4);
const X = 0.02;
const CUTS = { ig: 44, yt: 44, v2: 34 };

for (const [cut, k] of Object.entries(CUTS)) {
  const segs = [
    [0, t(k)], // 처음부터 k박까지(드럼 빠짐 · 다시 터짐 포함)
    [t(108), 57.9], // 끝맺음과 여운
  ];
  const parts = segs.map(([s, e], i) => `[0:a]atrim=start=${s}:end=${(i < segs.length - 1 ? e + X : e).toFixed(4)},asetpts=PTS-STARTPTS[s${i}]`);
  const out = path.join(HERE, 'public', `bgm_${cut}.wav`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', SRC, '-filter_complex', [...parts, `[s0][s1]acrossfade=d=${X}:c1=qsin:c2=qsin[mix]`].join(';'), '-map', '[mix]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', out]);
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
  console.log(`public/bgm_${cut}.wav ${(+dur).toFixed(2)}초 · 끝맺음 ${t(k).toFixed(2)}초부터`);
}
