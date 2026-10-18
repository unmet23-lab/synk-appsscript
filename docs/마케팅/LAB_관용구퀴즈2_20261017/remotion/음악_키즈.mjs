// 키즈판 BGM을 영상 박자 구조에 맞춰 다시 잘라 붙인다: node 음악_키즈.mjs  (remotion 폴더에서) → public/bgm_kids.wav (30.0초)
// 원곡: Suno 「SYNK LAB Quiz 120 · Kids Party」 https://suno.com/song/c10ef6f1-ca86-4ec5-8d2d-bc3abded506a (2026-10-13 생성·WAV 공식 다운로드)
// 실측(받은 WAV): 120.12 BPM, 킥 어택은 0.294 + 0.4995k초(102박 중앙값). 59~61박 세 박 킥이 멈춤 → 31.00·31.16초 준비 타격 → 62박(31.25초)에 킥·심벌·베이스로 터짐,
// 125박 한 박 쉼 → 126·127박 마지막 타격. 이음매가 킥 앞 조용한 틈에 오도록 첫 박을 어택보다 24ms 앞(0.27초)에 둔다.
// (브라우저 플레이어 소리로 잰 첫 박 0.016초는 뒷박에 맞은 값이었다.)
// 문제마다 같은 「문제 신호」 8초(54~70박)를 쓴다: 카운트다운 셋·둘·하나(영상 5~7박)가 멈춘 세 박에, 정답(8박)이 터지는 박에 온다.
// 끝은 118~130박: 마지막 타격(126박)이 로고(끝 8박)에 온다. 이음매 박은 16박 단위로 같은 자리라 마디가 이어진다.
// 원곡을 120/120.12배로 늘여 정확히 120 BPM에 맞춘다(8초에 8ms 차이).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const SRC = path.join(REPO, 'docs/홍보물/BGM/퀴즈120_키즈파티_c10ef6f1.wav');
const OUT = path.join(HERE, 'public', 'bgm_kids.wav');

const BPM = 120.12;
const BEAT0 = Number(process.env.BEAT0 ?? 0.27); // 받은 WAV에서 잰 첫 박(초)
const TEMPO = BPM / 120; // 늘인 뒤 길이 = 원래 길이 × TEMPO (atempo = 1/TEMPO)
const beat = (k) => BEAT0 * TEMPO + k * 0.5; // 늘인 뒤 k번째 박의 시각

const SEGMENTS = [
  [54, 70], // 문제 1
  [54, 70], // 문제 2
  [54, 70], // 문제 3
  [118, 130], // 끝
].map(([a, b]) => [beat(a), beat(b)]);
const X = 0.02; // 이음매 교차 길이(초) — 다음 조각이 정확히 박에 오도록 앞 조각을 그만큼 길게 자른다

const parts = SEGMENTS.map(([s, e], i) => {
  const end = i < SEGMENTS.length - 1 ? e + X : e;
  return `[t]atrim=start=${s.toFixed(4)}:end=${end.toFixed(4)},asetpts=PTS-STARTPTS[s${i}]`;
});
const splits = `[0:a]atempo=${(1 / TEMPO).toFixed(6)},asplit=${SEGMENTS.length}${SEGMENTS.map((_, i) => `[t${i}]`).join('')}`;
const partsFixed = parts.map((p, i) => p.replace('[t]', `[t${i}]`));
let chain = '[s0]';
const fades = [];
for (let i = 1; i < SEGMENTS.length; i++) {
  const out = i === SEGMENTS.length - 1 ? '[mix]' : `[x${i}]`;
  fades.push(`${chain}[s${i}]acrossfade=d=${X}:c1=qsin:c2=qsin${out}`);
  chain = out;
}
const total = SEGMENTS.reduce((t, [s, e]) => t + (e - s), 0);
const filter = [splits, ...partsFixed, ...fades, `[mix]afade=t=out:st=${(total - 0.4).toFixed(2)}:d=0.4[a]`].join(';');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', SRC, '-filter_complex', filter, '-map', '[a]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', OUT]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUT]).toString().trim();
console.log(`public/bgm_kids.wav ${dur}초 (목표 ${total.toFixed(1)}초, 첫 박 ${BEAT0}초)`);
