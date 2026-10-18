// 한 번 묶어서 여러 프레임 정지컷을 뽑는다(장면마다 npx remotion still을 따로 부르면 매번 묶느라 느리다).
//   node scripts/stills.mjs <컴포지션> <출력 폴더> <프레임...>
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , id, outDir, ...frames] = process.argv;
if (!id || !outDir || !frames.length) throw new Error('쓰기: node scripts/stills.mjs <컴포지션> <출력 폴더> <프레임...>');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public') });
const composition = await selectComposition({ serveUrl, id });
for (const fr of frames.map(Number)) {
  const output = path.join(outDir, `${id}-f${String(fr).padStart(4, '0')}.png`);
  await renderStill({ serveUrl, composition, frame: fr, output, overwrite: true });
  console.log('저장', output);
}
