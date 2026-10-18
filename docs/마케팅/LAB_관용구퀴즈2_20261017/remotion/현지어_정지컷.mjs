// 나라별 채널판(10-18) 정지컷 점검: 번들을 한 번만 만들고 채널마다 화면 글이 많은 순간을 찍어 한 장 판으로 붙인다.
//   node 현지어_정지컷.mjs            → out/현지어_점검/<cc>.png (7칸 판)
//   node 현지어_정지컷.mjs th ja      → 그 채널만
// 칸: 오답 딱지(표지 자리 1.3초) · 보기 · 정답+뜻 · 따라 말하기 · 복습 · 점수 댓글 · 끝 계정.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const ROOT = path.dirname(fileURLToPath(import.meta.url)); // 한글 경로라 URL pathname을 그대로 쓰면 %EB… 로 남는다
const OUT = path.join(ROOT, 'out', '현지어_점검');
fs.mkdirSync(OUT, { recursive: true });

const FRAMES = [39, 130, 190, 230, 894, 934, 989];
const src = fs.readFileSync(path.join(ROOT, 'src', 'kids', 'locales.ts'), 'utf8');
const all = [...src.matchAll(/cc: '(\w+)'/g)].map((m) => m[1]);
const pick = process.argv.slice(2);
const ccs = pick.length ? all.filter((c) => pick.includes(c)) : all;

const ENV = { REMOTION_TEMPO: '100' }; // CLI는 REMOTION_ 환경 변수를 넘겨 주지만 Node API는 envVariables로 직접 줘야 한다
const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'index.ts'), publicDir: path.join(ROOT, 'public') });
for (const cc of ccs) {
  const id = `kids-quiz-v5b-${cc}`;
  const composition = await selectComposition({ serveUrl, id, envVariables: ENV });
  const shots = [];
  for (const frame of FRAMES) {
    const output = path.join(OUT, `${cc}_${frame}.png`);
    await renderStill({ composition, serveUrl, output, frame, scale: 0.5, envVariables: ENV });
    shots.push(output);
  }
  const sheet = path.join(OUT, `${cc}.png`);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...shots.flatMap((s) => ['-i', s]), '-filter_complex', `hstack=inputs=${shots.length}`, sheet]);
  for (const s of shots) fs.unlinkSync(s);
  console.log(cc, '→', sheet);
}
