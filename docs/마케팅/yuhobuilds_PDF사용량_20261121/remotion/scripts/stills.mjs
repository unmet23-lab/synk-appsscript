// 확인용 정지컷 — 한 번 묶고 여러 초를 뽑는다. node scripts/stills.mjs 0,1.4,3.5 [이름] [컴포지션]  → out/<이름>_<초>.jpg
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const secs = (process.argv[2] || '0').split(',').map(Number);
const name = process.argv[3] || 's';
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src/index.ts'), publicDir: path.join(ROOT, 'public'), rspack: true, enableCaching: true });
const chromiumOptions = { gl: 'angle' };
const composition = await selectComposition({ serveUrl, id: process.argv[4] || 'main', chromiumOptions });
for (const s of secs) {
  await renderStill({ serveUrl, composition, frame: Math.min(composition.durationInFrames - 1, Math.round(s * 30)), output: path.join(ROOT, `out/${name}_${s.toFixed(2)}.jpg`), imageFormat: 'jpeg', jpegQuality: 88, chromiumOptions });
}
console.log('STILLS', secs.join(','));
