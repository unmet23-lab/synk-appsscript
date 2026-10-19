// 나라별 채널판(10-18) 렌더: 번들을 한 번 만들고 채널마다 영상 → 소리 마감(마감.mjs, −14.5 LUFS) → 게시 폴더로 옮기고 표지(1.3초)를 뽑는다.
//   node 현지어_렌더.mjs            → ../게시/03-나라별/<채널 id>/video.mp4 · cover.png
//   node 현지어_렌더.mjs th ru      → 그 채널(cc)만
// 소리는 판마다 같다(영어 채널 = v5b 나레이션, 나머지 = 한국어로만 말하는 v5b_mn). 영상은 git 밖(*.mp4).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { CHANNELS } from './src/kids/locales.ts';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const POST = path.join(ROOT, '..', '게시', '03-나라별');
const ENV = { REMOTION_TEMPO: '100' }; // CLI는 REMOTION_ 환경 변수를 넘겨 주지만 Node API는 envVariables로 직접 준다
const pick = process.argv.slice(2);
const list = pick.length ? CHANNELS.filter((c) => pick.includes(c.cc)) : CHANNELS;

const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'index.ts'), publicDir: path.join(ROOT, 'public') });
for (const c of list) {
  const t0 = Date.now();
  const id = `kids-quiz-v5b-${c.cc}`;
  const composition = await selectComposition({ serveUrl, id, envVariables: ENV });
  const raw = path.join(ROOT, 'out', `${id}.mp4`);
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: raw, envVariables: ENV, imageFormat: 'jpeg', jpegQuality: 92, chromiumOptions: { gl: 'angle' } });
  execFileSync('node', [path.join(ROOT, '마감.mjs'), raw], { stdio: 'inherit' });
  const dir = path.join(POST, c.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(raw.replace(/\.mp4$/, '_final.mp4'), path.join(dir, 'video.mp4'));
  await renderStill({ composition, serveUrl, output: path.join(dir, 'cover.png'), frame: 39, envVariables: ENV });
  console.log(`${c.cc} ${c.id} (${c.lang}) → ${dir} · ${Math.round((Date.now() - t0) / 1000)}초`);
}
