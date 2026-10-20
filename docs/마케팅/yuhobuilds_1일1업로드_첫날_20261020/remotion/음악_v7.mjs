// v7 배경음: node 음악_v7.mjs → public/bgm_v7.wav. 원곡 「Building Momentum」 122.863 BPM(v6와 같은 곡).
// 이 편의 사건(박): 12 드럼 빠짐(「끝에 체크리스트도」) · 16 다시 터짐(「월요일에」) · 44~48 드럼 빠짐(「사용량 한도에 걸렸는데」) ·
//   48 다시 터짐(「다시 이었어요」 → 셋째 단계) · 84 끝맺음(프로필 카드). 자르는 곳은 마디 경계.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'public', 'bgm.mp3');
const BEAT = 60 / 122.863;
const t = (k) => +(0.054 + k * BEAT).toFixed(4);
const X = 0.02;
const PLAN = [
  [0, 44], // 0~44: 시작 · 12 드럼 빠짐 · 16 다시 터짐
  [76, 80], // 44~48: 드럼 빠짐(멈춤)
  [80, 108], // 48~76: 다시 터짐(이어서)
  [104, 108], // 76~80: 끝맺음 앞 마디
  [104, 108], // 80~84: 한 번 더(체크리스트·저장)
  [108, null], // 84~: 끝맺음과 여운
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
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', SRC, '-filter_complex', [...parts, ...fades].join(';'), '-map', '[mix]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', path.join(HERE, 'public', 'bgm_v7.wav')]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(HERE, 'public', 'bgm_v7.wav')]).toString().trim();
console.log(`public/bgm_v7.wav ${(+dur).toFixed(2)}초`);
