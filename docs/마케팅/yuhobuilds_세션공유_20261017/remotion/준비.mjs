// 이 편이 쓰는 보유 자산을 public/ 에 복사한다: node 준비.mjs  (remotion 폴더에서)
// 원본은 고치지 않는다. public/ 은 언제든 이 스크립트로 다시 만들 수 있다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(HERE, 'public');
const S16 = 'docs/마케팅/LAB_TOPIK관용구_20261013/remotion/public';

const 목록 = [
  // 서체(OFL): 한글 SUIT 가변, 라틴 Inter Tight, 모노 DM Mono — S16과 같은 판
  ...['SUIT-Variable.woff2', 'InterTight-Bold.ttf', 'InterTight-SemiBold.ttf', 'InterTight-Medium.ttf', 'DMMono-Medium.ttf'].map((n) => [`${S16}/fonts/${n}`, `fonts/${n}`]),
  // 효과음: S16 키트(합성 효과음 v11 · LAB ㄹ 편 · 브랜드 사운드)
  ...['tok', 'tick', 'tick2', 'swish', 'whoosh_down', 'whoosh_side', 'thud', 'snap', 'pop', 'earn'].map((n) => [`${S16}/sfx/${n}.wav`, `sfx/${n}.wav`]),
  // 목소리: 범수(결정 표 10-17), 이 편 줄마다(h1e는 유튜브판 훅)
  ...['sum', 'sum2', 'h1b', 'h1', 'h1e', 's1', 'c1', 't1', 't2', 't3', 'r1', 'm1', 'm2', 'e1', 'f1', 'cta'].map((n) => [`docs/마케팅/yuhobuilds_세션공유_20261017/음성/범수/${n}.wav`, `vo/${n}.wav`]),
  // 배경음 원곡(시험판은 그대로, 본편은 node 음악.mjs가 잘라 붙인 bgm_a·bgm_e)
  ['docs/홍보물/BGM/SHIFT구독판_BuildingMomentum_gemini_20261017.mp3', 'bgm.mp3'],
  // 끝 화면: SNS 키트 builds 승인 자산(실제 얼굴 정면, 흰 펠트 synk 로고)
  ['docs/디자인/SNS키트/assets/photo-yuho-interview-front.webp', 'img/yuho-front.webp'],
  ['docs/디자인/SNS키트/assets/logo-synk-paper.webp', 'img/logo-synk-paper.webp'],
  // 본편 끝 화면 사진: 10-18 유호님 「머리 길때 잘생긴버전 프로필 … 그걸로」 → 옛 바탕화면 「유호_프로필_800.png」을 webp로 옮긴 것
  ['docs/마케팅/yuhobuilds_세션공유_20261017/assets/yuho-profile-800.webp', 'img/yuho-profile.webp'],
];

for (const [from, to] of 목록) {
  const src = path.join(REPO, from);
  const dst = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
// 잘라 만든 줄: f1a = f1의 「공개했어요.」까지(4.0초, 끝 0.03초 줄여 딸깍 없이). 낱말 시각은 음성시각.mjs의 DERIVED와 같다.
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(OUT, 'vo/f1.wav'), '-af', 'atrim=0:4.0,afade=t=out:st=3.97:d=0.03', path.join(OUT, 'vo/f1a.wav')]);
// 되감기 소리: 목록이 빠질 때 쓴 whoosh_down을 거꾸로(빠진 줄이 거꾸로 돌아오는 01 첫 박, 10-18 「사라짐 → 그대로」)
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(OUT, 'sfx/whoosh_down.wav'), '-af', 'areverse', path.join(OUT, 'sfx/whoosh_rev.wav')]);
console.log(`public/ 에 ${목록.length}개 복사 + vo/f1a.wav 자름 + sfx/whoosh_rev.wav 뒤집음`);
