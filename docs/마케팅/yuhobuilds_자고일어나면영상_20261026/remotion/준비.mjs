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
const EP = 'docs/마케팅/yuhobuilds_자고일어나면영상_20261026';
const Y5 = 'docs/마케팅/yuhobuilds_AI화면한줄_20261025';

const 목록 = [
  ...['SUIT-Variable.woff2', 'InterTight-Bold.ttf', 'InterTight-SemiBold.ttf', 'InterTight-Medium.ttf', 'DMMono-Medium.ttf'].map((n) => [`${S16}/fonts/${n}`, `fonts/${n}`]),
  ...['tok', 'tick', 'tick2', 'swish', 'thud', 'snap'].map((n) => [`${S16}/sfx/${n}.wav`, `sfx/${n}.wav`]),
  ['docs/홍보물/BGM/SHIFT구독판_BuildingMomentum_gemini_20261017.mp3', 'bgm.mp3'],
  ['docs/디자인/SNS키트/assets/logo-synk-paper.webp', 'img/logo-synk-paper.webp'],
  [`${SESSION}/assets/yuho-profile-800.webp`, 'img/yuho-profile.webp'],
  // 첫 장면 연출 사진(GPT 이미지 2.5, 화면은 빈 흰색)
  [`${EP}/그림/침실_213626.png`, 'img/bed.png'],
  // 10-26 21:2x ego에서 휴대폰 크기(393×852 · 3배)로 찍은 실제 화면 — 자료/검토화면/
  [`${EP}/자료/검토화면/검토페이지_전체.png`, 'shot/page.png'],
  [`${EP}/자료/검토화면/인스타_프로필.png`, 'shot/ig_profile.png'],
  // 검토 페이지가 트는 그 영상(Y5 올리기판, git 밖 — Y5 remotion/out)
  [`${Y5}/remotion/out/ig-v9_upload.mp4`, 'clip/y5.mp4'],
  // v2(10-27): ego에서 휴대폰 폭(430 CSS px · 가로 1080px)으로 찍은 claude.ai 시크릿 채팅 실제 화면을 자른 판 — 자료/채팅실험/
  ...['A_부탁', 'A_답', 'B_부탁', 'B_답', 'B_승인'].map((n) => [`${EP}/자료/채팅실험/${n}.jpg`, `chat/${n}.jpg`]),
];
for (const [from, to] of 목록) {
  const dst = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(REPO, from), dst);
}
console.log(`public/ 에 ${목록.length}개 복사`);
// 표지의 폰 화면에 넣을 그 영상 첫 장면(0.6초)
import { execFileSync } from 'node:child_process';
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '0.6', '-i', path.join(OUT, 'clip', 'y5.mp4'), '-frames:v', '1', path.join(OUT, 'img', 'y5_first.png')]);
console.log('public/img/y5_first.png');
