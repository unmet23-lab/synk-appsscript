// 이 편이 쓰는 보유 자산을 public/ 에 복사하고, 전력 기록을 그래프 자료로 줄인다: node 준비.mjs  (remotion 폴더에서)
// 원본은 고치지 않는다. public/ 과 src/y7/power.generated.ts는 언제든 이 스크립트로 다시 만들 수 있다. 목소리는 node 음성시각.mjs가 복사한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(HERE, 'public');
const S16 = 'docs/마케팅/LAB_TOPIK관용구_20261013/remotion/public';
const SESSION = 'docs/마케팅/yuhobuilds_세션공유_20261017';
const EP = 'docs/마케팅/yuhobuilds_AI영상전기요금_20261026';

const 목록 = [
  ...['SUIT-Variable.woff2', 'InterTight-Bold.ttf', 'InterTight-SemiBold.ttf', 'InterTight-Medium.ttf', 'DMMono-Medium.ttf'].map((n) => [`${S16}/fonts/${n}`, `fonts/${n}`]),
  ...['tok', 'tick', 'tick2', 'swish', 'thud', 'snap'].map((n) => [`${S16}/sfx/${n}.wav`, `sfx/${n}.wav`]),
  ['docs/홍보물/BGM/SHIFT구독판_BuildingMomentum_gemini_20261017.mp3', 'bgm.mp3'],
  ['docs/디자인/SNS키트/assets/logo-synk-paper.webp', 'img/logo-synk-paper.webp'],
  [`${SESSION}/assets/yuho-profile-800.webp`, 'img/yuho-profile.webp'],
  // 10-26 실측에서 이 노트북이 만든 AI 영상(5.17초 · 768×1344 · 24fps) — 자료/실측/
  [`${EP}/자료/실측/cat.mp4`, 'clip/cat.mp4'],
];
for (const [from, to] of 목록) {
  const dst = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(REPO, from), dst);
}
console.log(`public/ 에 ${목록.length}개 복사`);

// 전력 기록(1초) → 작업 구간 0~끝 초의 그래픽카드 W만, 소수 첫째 자리로.
const csv = fs.readFileSync(path.join(REPO, EP, '자료/실측/기록_cat.csv'), 'utf8').trim().split(/\r?\n/).slice(1);
const sum = JSON.parse(fs.readFileSync(path.join(REPO, EP, '자료/실측/요약_cat.json'), 'utf8'));
const end = sum.걸린초;
const gpu = csv
  .map((l) => l.split(','))
  .filter((c) => c[1] === 'gpu')
  .map((c) => [+c[0], +c[2]])
  .filter(([t]) => t >= 0 && t <= end)
  .map(([t, w]) => [+t.toFixed(1), +w.toFixed(1)]);
const ts = `// node 준비.mjs가 자료/실측/기록_cat.csv에서 만든 파일. 고치지 말고 다시 만든다.
// 그래픽카드 전력(W) · 작업을 넣은 때부터 영상이 저장될 때까지 ${end}초 · 1초마다 ${gpu.length}점. 요금은 요약_cat.json의 Wh로 요금.mjs가 셈.
export const POWER: readonly (readonly [number, number])[] = ${JSON.stringify(gpu)};
export const POWER_END = ${end};
export const POWER_LIMIT = 175; // nvidia-smi -q -d POWER의 Current Power Limit(10-26)
export const GPU_WH = ${sum.만드는동안.gpu.Wh};
`;
fs.writeFileSync(path.join(HERE, 'src', 'y7', 'power.generated.ts'), ts);
console.log(`src/y7/power.generated.ts ${gpu.length}점 · ${end}초 · ${sum.만드는동안.gpu.Wh}Wh`);
