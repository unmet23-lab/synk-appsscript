// 이 편이 쓰는 자산을 public/ 에 복사한다: node 준비.mjs  (remotion 폴더에서)
// 원본은 고치지 않는다. public/ 은 언제든 이 스크립트로 다시 만들 수 있다. 목소리는 node 음성시각.mjs가 복사한다.
// Y19(yuhobuilds_없는후기한줄_20261028/remotion/준비.mjs)에서 옮겼다 — 실제 화면 · 그림은 편 폴더 자료/(다듬기.py), 배경음은 Y19 · synkbrief가 쓴 곡과 다른 「밝은_052」.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(HERE, 'public');
const S16 = 'docs/마케팅/LAB_TOPIK관용구_20261013/remotion/public';
const EP = 'docs/마케팅/yuhobuilds_SNS맡겼더니_20261029/자료';

const 목록 = [
  ...['SUIT-Variable.woff2', 'InterTight-Bold.ttf', 'InterTight-SemiBold.ttf', 'InterTight-Medium.ttf', 'DMMono-Medium.ttf'].map((n) => [`${S16}/fonts/${n}`, `fonts/${n}`]),
  ...['pop', 'tok', 'tick', 'swish', 'thud', 'snap'].map((n) => [`${S16}/sfx/${n}.wav`, `sfx/${n}.wav`]),
  ['docs/홍보물/BGM/밝은_052.wav', 'bgm.wav'],
  ...fs.readdirSync(path.join(REPO, EP, '실제화면')).filter((n) => n.endsWith('.jpg')).map((n) => [`${EP}/실제화면/${n}`, `img/${n}`]),
  ...fs.readdirSync(path.join(REPO, EP, '그림')).filter((n) => n.endsWith('.jpg')).map((n) => [`${EP}/그림/${n}`, `img/${n}`]),
];
for (const [from, to] of 목록) {
  const dst = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(REPO, from), dst);
}
console.log(`public/ 에 ${목록.length}개 복사`);
