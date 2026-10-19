// 배경음을 이 편 이야기에 맞춰 잘라 붙인다: node 음악.mjs  (remotion 폴더에서) → public/bgm.wav
// 원곡: 「Building Momentum」(SHIFT 편 곡, 세션 공유 편과 같음). 122.863 BPM, 첫 박 0.054초.
// 원곡 사건: 12박 드럼 빠짐 · 16박 다시 터짐 · 48~64박 조용한 구간 · 64박 다시 터짐 · 76박 드럼 빠짐 · 80박 다시 터짐 · 108박 끝맺음(52.8초~57.9초).
// 이 편의 사건(박): 12 지금 답 「걱정하지 않으셔도 돼요」 · 16 숫자 · 28~36 조용(「그런데 … 기계 같았어요」) · 36 일곱 군데 ·
//   52~56 드럼 빠짐(「에러 난다고 하면 답이 없었어요」) · 56 「다 고쳤어요」 · 76~80 드럼 빠짐(「AI 티는 기능이 아니라」) · 80 「받는 사람이 읽는 한 줄」 · 92 끝맺음(「댓글로 알려 주세요」 끝).
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
  [0, 28], // 이 편 0~28: 시작 · 12 드럼 빠짐 · 16 다시 터짐
  [56, 64], // 28~36: 조용한 구간 끝 두 마디
  [64, 76], // 36~48: 64 다시 터짐
  [72, 76], // 48~52: 앞 마디 한 번 더
  [76, 80], // 52~56: 드럼 빠짐
  [80, 100], // 56~76: 80 다시 터짐
  [76, 80], // 76~80: 드럼 빠짐 한 번 더
  [80, 92], // 80~92: 다시 터짐
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
