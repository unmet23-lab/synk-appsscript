// 이 편이 쓰는 보유 자산을 public/ 에 복사한다: node 준비.mjs  (remotion 폴더에서)
// 원본은 고치지 않는다. public/ 은 언제든 이 스크립트로 다시 만들 수 있다. 목소리는 node 음성시각.mjs가 복사한다.
// 판 안에 재생하는 v7c·v8은 10-20 첫날 편의 렌더 원본(git 밖, 그 폴더 remotion/out/)이다. 없으면 그 편 기획의 「다시 만들기」로 다시 렌더한다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(HERE, 'public');
const S16 = 'docs/마케팅/LAB_TOPIK관용구_20261013/remotion/public';
const SESSION = 'docs/마케팅/yuhobuilds_세션공유_20261017';
const DAY1 = 'docs/마케팅/yuhobuilds_1일1업로드_첫날_20261020';

const 목록 = [
  ...['SUIT-Variable.woff2', 'InterTight-Bold.ttf', 'InterTight-SemiBold.ttf', 'InterTight-Medium.ttf', 'DMMono-Medium.ttf'].map((n) => [`${S16}/fonts/${n}`, `fonts/${n}`]),
  ...['tok', 'tick', 'tick2', 'swish', 'thud', 'snap'].map((n) => [`${S16}/sfx/${n}.wav`, `sfx/${n}.wav`]),
  ['docs/홍보물/BGM/SHIFT구독판_BuildingMomentum_gemini_20261017.mp3', 'bgm.mp3'],
  ['docs/디자인/SNS키트/assets/logo-synk-paper.webp', 'img/logo-synk-paper.webp'],
  [`${SESSION}/assets/yuho-profile-800.webp`, 'img/yuho-profile.webp'],
  [`${DAY1}/remotion/out/v7c_final.mp4`, 'clip/v7c.mp4'],
  [`${DAY1}/remotion/out/v8_final.mp4`, 'clip/v8.mp4'],
];
for (const [from, to] of 목록) {
  const dst = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(REPO, from), dst);
}
// 판 안 영상은 소리 없이 쓴다(우리 목소리·배경음과 겹치지 않게). 소리 줄을 뺀 사본으로 바꾼다.
for (const n of ['v7c', 'v8']) {
  const src = path.join(OUT, 'clip', `${n}.mp4`);
  const tmp = path.join(OUT, 'clip', `${n}_mute.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-an', '-c:v', 'copy', tmp]);
  fs.renameSync(tmp, src);
}
// 표지 전·후 한 장씩: 같은 순간(18.6초 「아침 7시로」 — v7c는 형광펜·흐림 팝, v8은 줄 하나)의 머리글 쪽.
fs.mkdirSync(path.join(OUT, 'still'), { recursive: true });
for (const n of ['v7c', 'v8']) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '18.6', '-i', path.join(OUT, 'clip', `${n}.mp4`), '-frames:v', '1', path.join(OUT, 'still', `${n}_18.6.png`)]);
}
console.log(`public/ 에 ${목록.length}개 복사(판 안 영상 둘은 소리 뺌) + 표지 정지컷 둘`);
