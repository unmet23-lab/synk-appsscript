// 실제 ChatGPT 결과 그림(../화면/, git에 있는 1080 폭 사본 — 원본은 ../시안/)을 영상이 읽는 public/screen/으로 옮긴다.
//   node scripts/화면복사.mjs
// 그림을 받은 방법은 ../기획.md 「녹화 기록」.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dst = path.join(ROOT, 'public/screen');
fs.mkdirSync(dst, { recursive: true });
const src = path.join(ROOT, '..', '화면');
const files = fs.readdirSync(src).filter((f) => f.endsWith('.jpg'));
for (const f of files) fs.copyFileSync(path.join(src, f), path.join(dst, f));
console.log('screen', files.join(' '));
