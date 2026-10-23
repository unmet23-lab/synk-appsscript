// 이 편이 쓰는 보유 자산을 public/ 에 복사한다: node 준비.mjs  (remotion 폴더에서)
// 원본은 고치지 않는다. public/ 은 언제든 이 스크립트로 다시 만들 수 있다(git 밖).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(HERE, 'public');

const 목록 = [
  // 서체(OFL): 한글 SUIT 가변, 몽골어(키릴)·라틴 Inter Tight, 영문 라벨 DM Mono — DESIGN §3
  ['docs/브랜드_폰트/SUIT/SUIT-Variable.woff2', 'fonts/SUIT-Variable.woff2'],
  ...['Regular', 'Medium', 'SemiBold', 'Bold'].map((w) => [`docs/브랜드_폰트/InterTight/InterTight-${w}.ttf`, `fonts/InterTight-${w}.ttf`]),
  ...['Regular', 'Medium'].map((w) => [`docs/브랜드_폰트/DM_Mono/DMMono-${w}.ttf`, `fonts/DMMono-${w}.ttf`]),
  // 신청 페이지(synk.im/lab/topik4)와 같은 펠트 물건·로고 — 마스코트가 아니라 재사용한다
  ...['grid', 'list', 'cap'].map((n) => [`experiences/lab-topik4/src/art/topik4-art-${n}.webp`, `art/topik4-art-${n}.webp`]),
  ['experiences/lab-topik4/dist/lab/topik4/assets/logo-lab.webp', 'art/logo-lab.webp'],
  // 배경음 후보(보유 곡, docs/홍보물/BGM) — 목소리보다 약 20dB 아래로 깐다
  ['docs/홍보물/BGM/따뜻_118.wav', 'music/warm-118.wav'],
];
// 장면 10의 실제 WORLD 화면: node experiences/lab-topik4/qa/맛보기화면.mjs 가 공용 작업본 .tmp에 찍는다(git 밖).
const SHOT = path.join(REPO, '.tmp/topik4-sample-class-20261023/world-shot/05-학생-첨삭보기-첫화면.png');
if (fs.existsSync(SHOT)) 목록.push([path.relative(REPO, SHOT), 'shots/world-homework.png']);
else console.log('실제 화면 캡처가 없다 — 장면 10은 자리만 보인다(node experiences/lab-topik4/qa/맛보기화면.mjs)');

for (const [from, to] of 목록) {
  const dst = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(REPO, from), dst);
}
console.log(`public/ 에 ${목록.length}개 복사`);
