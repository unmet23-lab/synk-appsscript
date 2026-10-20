// 관용구 퀴즈 #4(10-20) 렌더: 번들을 한 번 만들고 판마다 영상 → 소리 마감(마감.mjs, −14.5 LUFS) → 게시 폴더로 옮기고 표지(1.3초)를 뽑는다.
//   node 렌더_q4.mjs               → ../게시/{01-youtube-en,02-mn}/video.mp4 · cover.png
//   node 렌더_q4.mjs cn mmtt       → 그 판만(cn = 샤오훙수 간체 03-xiaohongshu-cn, mmtt = 틱톡 미얀마 04-tiktok-mm)
// 올림 화질(제작 방식 v2 §2-4): PNG 프레임, H.264 12Mbps·slow, yuv420p·BT.709. 영상은 git 밖(*.mp4).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const POST = path.join(ROOT, '..', '게시');
const ENV = { REMOTION_TEMPO: '100' };
const ALL = {
  en: { id: 'q4-en', dir: '01-youtube-en' },
  mn: { id: 'q4-mn', dir: '02-mn' },
  cn: { id: 'q4-cn', dir: '03-xiaohongshu-cn' },
  mmtt: { id: 'q4-mmtt', dir: '04-tiktok-mm' },
};
const pick = process.argv.slice(2);
const list = (pick.length ? pick : ['en', 'mn']).map((k) => ({ key: k, ...ALL[k] }));

const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'index.ts'), publicDir: path.join(ROOT, 'public') });
for (const c of list) {
  const t0 = Date.now();
  const composition = await selectComposition({ serveUrl, id: c.id, envVariables: ENV });
  const raw = path.join(ROOT, 'out', `q4_${c.key}.mp4`);
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: raw, envVariables: ENV, imageFormat: 'png', videoBitrate: '12M', x264Preset: 'slow', pixelFormat: 'yuv420p', colorSpace: 'bt709', chromiumOptions: { gl: 'angle' } });
  execFileSync('node', [path.join(ROOT, '마감.mjs'), raw], { stdio: 'inherit' });
  const dir = path.join(POST, c.dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(raw.replace(/\.mp4$/, '_final.mp4'), path.join(dir, 'video.mp4'));
  await renderStill({ composition, serveUrl, output: path.join(dir, 'cover.png'), frame: 39, envVariables: ENV });
  console.log(`${c.key} → ${dir} · ${Math.round((Date.now() - t0) / 1000)}초`);
}
