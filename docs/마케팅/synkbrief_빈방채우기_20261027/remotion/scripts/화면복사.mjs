// 실제 ChatGPT 녹화 프레임(../화면/, git에 있는 원본)과 녹화에 쓴 빈 방 사진(../그림/빈방.jpg)을 영상이 읽는 public/screen/으로 옮긴다.
//   node scripts/화면복사.mjs
// 프레임 원본과 녹화 방법은 ../기획.md 「녹화 기록」.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dst = path.join(ROOT, 'public/screen');
fs.mkdirSync(dst, { recursive: true });
const src = path.join(ROOT, '..', '화면');
const files = fs.readdirSync(src).filter((f) => f.endsWith('.jpg'));
for (const f of files) fs.copyFileSync(path.join(src, f), path.join(dst, f));
fs.copyFileSync(path.join(ROOT, '..', '그림', '빈방.jpg'), path.join(dst, '빈방.jpg'));
console.log('screen', [...files, '빈방.jpg'].join(' '));
