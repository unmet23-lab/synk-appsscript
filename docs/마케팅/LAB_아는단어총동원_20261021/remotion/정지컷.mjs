// 「아는 단어 총동원」 정지컷 점검: 번들을 한 번 만들고 판마다 0초·낱말마다·끝 장면을 찍어 한 장 판으로 붙인다.
//   node 정지컷.mjs [en mn]  → out/점검/<판>.png (5칸씩)
// 찍는 순간은 schedule.ts와 같은 셈(낱말 시작 + 0.25초)으로 vo.generated.ts에서 다시 구한다.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out', '점검');
fs.mkdirSync(OUT, { recursive: true });

const src = fs.readFileSync(path.join(ROOT, 'src', 'vocab', 'vo.generated.ts'), 'utf8');
const VO = JSON.parse(src.match(/VO = (\[[\s\S]*\]) as const/)[1]);
const dur = (id) => VO.find((l) => l.id === id).dur;
const cats = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4];
let t = 0.05 + dur('ask') + 0.22;
const at = [];
cats.forEach((c, i) => {
  if (i > 0 && c !== cats[i - 1]) t += c === 4 ? 0.25 : 0.22;
  at.push(t);
  t += Math.max(dur(`w${String(i + 1).padStart(2, '0')}`) + 0.08, 0.56);
});
const laugh = t; t += 0.8; const slow = t; t += dur('slow') + 0.18; const ok = t; t += dur('ok') + 0.12; const turn = t;
const secs = [0, 0.6, ...at.map((x) => x + 0.25), laugh + 0.25, slow + 0.8, ok + 0.8, turn + 0.5, turn + 1.6];
const FRAMES = secs.map((s) => Math.round(s * 30));

const pick = process.argv.slice(2);
const ccs = pick.length ? pick : ['en', 'mn'];
const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'index.ts'), publicDir: path.join(ROOT, 'public') });
for (const cc of ccs) {
  const composition = await selectComposition({ serveUrl, id: `vocab-${cc}` });
  const shots = [];
  for (const frame of FRAMES) {
    const output = path.join(OUT, `${cc}_${frame}.png`);
    await renderStill({ composition, serveUrl, output, frame: Math.min(frame, composition.durationInFrames - 1), scale: 0.5 });
    shots.push(output);
  }
  const sheet = path.join(OUT, `${cc}.png`);
  const inputs = shots.flatMap((s) => ['-i', s]);
  const layout = shots.map((_, i) => `${(i % 5) * 540}_${Math.floor(i / 5) * 960}`).join('|');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', `xstack=inputs=${shots.length}:layout=${layout}:fill=black`, sheet]);
  for (const s of shots) fs.unlinkSync(s);
  console.log(cc, '→', sheet, `· ${composition.durationInFrames}프레임 = ${(composition.durationInFrames / 30).toFixed(2)}초`);
}
