// 관용구 퀴즈 #3(10-19) 렌더: 번들을 한 번 만들고 판마다 영상 → 소리 마감(마감.mjs, −14.5 LUFS) → 게시 폴더로 옮기고 표지(1.3초)를 뽑는다.
//   node 렌더_q3.mjs               → ../게시/{mn,lab-cn-xiaohongshu,lab-mm-tiktok}/video.mp4 · cover.png
//   node 렌더_q3.mjs mn en         → 그 판만(en = 영어 화면판, ../게시/en/)
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
  mn: { id: 'kids-quiz-v5b-mn', dir: 'mn' },
  cn: { id: 'kids-quiz-v5b-cn', dir: 'lab-cn-xiaohongshu' },
  mmtt: { id: 'kids-quiz-v5b-mmtt', dir: 'lab-mm-tiktok' },
  en: { id: 'kids-quiz-v5b', dir: 'en' },
};
const pick = process.argv.slice(2);
const list = (pick.length ? pick : ['mn', 'cn', 'mmtt']).map((k) => ({ key: k, ...ALL[k] }));

const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'index.ts'), publicDir: path.join(ROOT, 'public') });
for (const c of list) {
  const t0 = Date.now();
  const composition = await selectComposition({ serveUrl, id: c.id, envVariables: ENV });
  const raw = path.join(ROOT, 'out', `q3_${c.key}.mp4`);
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: raw, envVariables: ENV, imageFormat: 'png', videoBitrate: '12M', x264Preset: 'slow', pixelFormat: 'yuv420p', colorSpace: 'bt709', chromiumOptions: { gl: 'angle' } });
  execFileSync('node', [path.join(ROOT, '마감.mjs'), raw], { stdio: 'inherit' });
  const dir = path.join(POST, c.dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(raw.replace(/\.mp4$/, '_final.mp4'), path.join(dir, 'video.mp4'));
  await renderStill({ composition, serveUrl, output: path.join(dir, 'cover.png'), frame: 39, envVariables: ENV });
  console.log(`${c.key} → ${dir} · ${Math.round((Date.now() - t0) / 1000)}초`);
}
