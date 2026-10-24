// 이 편이 쓰는 보유 자산을 public/ 에 복사한다: node 준비.mjs  (remotion 폴더에서)
// 원본은 고치지 않는다. public/ 은 언제든 이 스크립트로 다시 만들 수 있다. 목소리는 node 음성시각.mjs가 복사한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(HERE, 'public');
const S16 = 'docs/마케팅/LAB_TOPIK관용구_20261013/remotion/public';
const SESSION = 'docs/마케팅/yuhobuilds_세션공유_20261017';
const EP = 'docs/마케팅/yuhobuilds_AI화면한줄_20261025';

const 목록 = [
  ...['SUIT-Variable.woff2', 'InterTight-Bold.ttf', 'InterTight-SemiBold.ttf', 'InterTight-Medium.ttf', 'DMMono-Medium.ttf'].map((n) => [`${S16}/fonts/${n}`, `fonts/${n}`]),
  ...['tok', 'tick', 'tick2', 'swish', 'thud', 'snap'].map((n) => [`${S16}/sfx/${n}.wav`, `sfx/${n}.wav`]),
  ['docs/홍보물/BGM/SHIFT구독판_BuildingMomentum_gemini_20261017.mp3', 'bgm.mp3'],
  ['docs/디자인/SNS키트/assets/logo-synk-paper.webp', 'img/logo-synk-paper.webp'],
  [`${SESSION}/assets/yuho-profile-800.webp`, 'img/yuho-profile.webp'],
  // 10-25 실험 화면(휴대폰 390×844 · 2배) — 자료/실험/
  ...[
    ['기준/빵집_s_1_폰.png', 'b_base1'],
    ['기준/빵집_s_2_폰.png', 'b_base2'],
    ['한줄B/빵집_s_1_폰.png', 'b_one'],
    ['기준/꽃집_s_1_폰.png', 'f_base'],
    ['한줄B/꽃집_s_1_폰.png', 'f_one'],
    ['기준/세무사_s_1_폰.png', 't_base'],
    ['한줄B/세무사_s_1_폰_가림.png', 't_one'], // 머리글 사람 이름 흐림
  ].map(([from, to]) => [`${EP}/자료/실험/${from}`, `shot/${to}.png`]),
];
for (const [from, to] of 목록) {
  const dst = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(REPO, from), dst);
}
console.log(`public/ 에 ${목록.length}개 복사`);
