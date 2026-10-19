// 확인용 정지 화면 여러 장을 한 번의 번들로 뽑는다: node 정지컷.mjs [프레임,프레임,…] [컴포지션]  (remotion 폴더에서) → out/stills/f<프레임>.png
// 휴대폰 크기 확인은 out/stills/sheet.png(360px 폭 축소판 묶음)로 본다.
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const frames = (process.argv[2] || '0,70,125,180,300,390,430,600,680,740,800,850,917,960,1000,1050,1100,1215,1300,1400').split(',').map(Number);
const id = process.argv[3] || 'dm';
const out = path.join(HERE, 'out', 'stills');
fs.mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(HERE, 'src', 'index.ts'), rspack: true });
const composition = await selectComposition({ serveUrl, id });
const files = [];
for (const frame of frames) {
  const file = path.join(out, `f${frame}.png`);
  await renderStill({ serveUrl, composition, frame, output: file, chromiumOptions: { gl: 'angle' } });
  files.push(file);
}
// 360px 폭 축소판을 다섯 장씩 한 줄로 묶는다(휴대폰 격자 한 칸 크기에서 읽히는지)
const args = ['-v', 'error', '-y'];
files.forEach((f) => args.push('-i', f));
const cols = 5;
const rows = Math.ceil(files.length / cols);
const filter = files.map((_, i) => `[${i}:v]scale=360:-1[s${i}]`).join(';') + ';' + files.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${files.length}:layout=${files.map((_, i) => `${(i % cols) * 360}_${Math.floor(i / cols) * 640}`).join('|')}:fill=black[o]`;
args.push('-filter_complex', filter, '-map', '[o]', path.join(out, 'sheet.png'));
if (files.length > 1) execFileSync('ffmpeg', args);
console.log(`${files.length}장 → ${path.relative(HERE, out)} (sheet.png ${cols}×${rows}), 총 길이 ${composition.durationInFrames}프레임`);
