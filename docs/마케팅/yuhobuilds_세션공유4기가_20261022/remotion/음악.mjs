// 배경음: node 음악.mjs → public/bgm_cut.wav. 원곡 「Building Momentum」 122.863 BPM(10-17 SHIFT 편 곡, 10-20·10-21 편과 같다).
// 10-23 보완판 v8(34.7초)의 사건(박, 시각표.ts 기준):
//   12 드럼 빠짐(5.9초 e1 「한 시간에 4.3GB씩」 — 큰 숫자는 조용한 데서) · 16 다시 터짐(7.9초 e2 「고치니까 94MB」) ·
//   36~44 조용한 두 마디(17.6~21.5초 「I/O 쓰기 바이트에 체크하세요. 실행된 뒤 저장한 양」 — 모를 낱말 풀이는 조용한 데서) ·
//   44 다시 터짐(21.5초 s3 「그 열 이름을 눌러」 — 정렬 누르기) · 64 끝맺음(31.3초, 끝 카드 31.1초). 자르는 곳은 마디 경계.
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
  [80, 100], // 44~64: 다시 터짐(다섯째 단계 · 찾은 뒤 · 질문)
  [108, null], // 64~: 끝맺음과 여운(끝 카드)
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
