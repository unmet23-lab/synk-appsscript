// 실제 결과 화면(../시안/, git에 있는 1080 폭 JPG — 받은 방법은 ../기획.md 「녹화 기록」)을 영상이 읽는 public/screen/으로 옮긴다.
//   node scripts/화면복사.mjs
// Gemini 긴 화면은 답이 끝나는 4300px까지만 자른다(아래는 빈 화면).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(ROOT, '..', '시안');
const dst = path.join(ROOT, 'public/screen');
fs.mkdirSync(dst, { recursive: true });
const jobs = [
  ['1_Gemini_넣음.jpg', 'gem_in.jpg', null],
  ['1_Gemini_답_길게.jpg', 'gem.jpg', 'crop=1080:4300:0:0'],
  ['1_ChatGPT_넣음.jpg', 'gpt_in.jpg', null],
  ['1_ChatGPT_답_길게.jpg', 'gpt.jpg', null],
];
for (const [a, b, vf] of jobs) {
  if (!vf) fs.copyFileSync(path.join(src, a), path.join(dst, b));
  else execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(src, a), '-vf', vf, '-q:v', '2', path.join(dst, b)]);
}
console.log('screen', jobs.map((j) => j[1]).join(' '));
