// 배경음을 이 편 이야기에 맞춰 잘라 붙인다: node 음악.mjs  (remotion 폴더에서) → public/bgm.wav
// 원곡: 「Building Momentum」(SHIFT 편 곡, 세션 공유·자동 DM 편과 같음). 122.863 BPM, 첫 박 0.054초.
// 원곡 사건: 12박 드럼 빠짐 · 16박 다시 터짐 · 48~64박 조용한 구간 · 64박 다시 터짐 · 76박 드럼 빠짐 · 80박 다시 터짐 · 108박 끝맺음(52.8초~57.9초).
// 이 편의 사건(박): 12 드럼 빠짐(판이 세션 목록으로) · 16 다시 터짐(새 세션 세 줄) · 24 되감기(음량으로 비움) ·
//   56~60 드럼 빠짐(「샤오훙수 … 열렸어요」 뒤 숨) · 60 다시 터짐(「그 답을 듣고 정했어요」) · 92 끝맺음(프로필 카드).
// 자르는 곳은 모두 마디 경계(4의 배수)라 박 격자와 마디가 그대로 이어진다.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'public', 'bgm.mp3');
const BEAT = 60 / 122.863;
const t = (k) => +(0.054 + k * BEAT).toFixed(4);
const X = 0.02; // 이음매 교차 길이(초)
// [원곡 시작 박, 원곡 끝 박] 차례대로 이어 붙인다(첫 조각은 0초부터, 마지막 조각은 곡 끝까지)
const PLAN = [
  [0, 48], // 이 편 0~48: 시작 · 12 드럼 빠짐 · 16 다시 터짐 · 막힌 곳 ①②
  [40, 48], // 48~56: 앞 두 마디 한 번 더(③)
  [76, 80], // 56~60: 드럼 빠짐
  [80, 108], // 60~88: 80 다시 터짐
  [104, 108], // 88~92: 끝맺음 앞 마디 한 번 더
  [108, null], // 92~: 끝맺음과 여운
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
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', SRC, '-filter_complex', [...parts, ...fades].join(';'), '-map', '[mix]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', path.join(HERE, 'public', 'bgm.wav')]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(HERE, 'public', 'bgm.wav')]).toString().trim();
console.log(`public/bgm.wav ${(+dur).toFixed(2)}초`);
