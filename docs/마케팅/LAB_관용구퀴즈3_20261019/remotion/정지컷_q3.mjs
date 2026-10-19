// 관용구 퀴즈 #3(10-19) 정지컷 점검: 번들을 한 번만 만들고 판마다 화면 글이 많은 순간을 문제 셋 모두 찍어 한 장 판으로 붙인다.
//   node 정지컷_q3.mjs              → out/q3_점검/<판>.png (문제마다 오답 딱지·보기·정답+뜻·따라 말하기 4칸 × 3 + 복습·점수 댓글·끝 계정 3칸)
//   node 정지컷_q3.mjs mn cn        → 그 판만(en = 영어 화면판 kids-quiz-v5b)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out', 'q3_점검');
fs.mkdirSync(OUT, { recursive: true });

const Q = 288; // 100 BPM 문제 하나(16박 × 18프레임)
const PER_Q = [39, 130, 190, 230];
const FRAMES = [...[0, 1, 2].flatMap((i) => PER_Q.map((f) => i * Q + f)), 894, 934, 989];
const pick = process.argv.slice(2);
const ccs = pick.length ? pick : ['mn', 'cn', 'mmtt', 'en'];

const ENV = { REMOTION_TEMPO: '100' };
const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'index.ts'), publicDir: path.join(ROOT, 'public') });
for (const cc of ccs) {
  const id = cc === 'en' ? 'kids-quiz-v5b' : `kids-quiz-v5b-${cc}`;
  const composition = await selectComposition({ serveUrl, id, envVariables: ENV });
  const shots = [];
  for (const frame of FRAMES) {
    const output = path.join(OUT, `${cc}_${frame}.png`);
    await renderStill({ composition, serveUrl, output, frame, scale: 0.5, envVariables: ENV });
    shots.push(output);
  }
  // 5칸씩 3줄로 붙인다(ffmpeg xstack)
  const sheet = path.join(OUT, `${cc}.png`);
  const inputs = shots.flatMap((s) => ['-i', s]);
  const layout = shots.map((_, i) => `${(i % 5) * 540}_${Math.floor(i / 5) * 960}`).join('|');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', `xstack=inputs=${shots.length}:layout=${layout}`, sheet]);
  for (const s of shots) fs.unlinkSync(s);
  console.log(cc, '→', sheet);
}
