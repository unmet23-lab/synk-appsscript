// 실제 ChatGPT 녹화 프레임(../화면/A·B, git에 있는 원본)을 영상이 읽는 public/screen/으로 옮기고, 프레임 시각 표를 src/full/frames.json으로 쓴다.
//   node scripts/화면복사.mjs
// 프레임 원본과 녹화 방법은 ../기획.md 「녹화 기록」, 고른 기준은 ../화면/프레임.json(ms = 보낸 뒤 시각, y = 긴 화면에서 자른 창의 위 끝).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, '..', '화면');
const meta = JSON.parse(fs.readFileSync(path.join(SRC, '프레임.json'), 'utf8'));
const out = {};
for (const k of ['A', 'B']) {
  const dst = path.join(ROOT, 'public/screen', k);
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(path.join(SRC, k))) fs.copyFileSync(path.join(SRC, k, f), path.join(dst, f));
  out[k] = {
    tall: meta[k].tall,
    typing: meta[k].rows.filter((r) => r.tag !== 'gen').map((r) => ({ f: r.f, ms: r.ms, tag: r.tag })),
    gen: meta[k].rows.filter((r) => r.tag === 'gen').map((r) => ({ f: r.f, ms: r.ms, y: r.y })),
  };
}
fs.writeFileSync(path.join(ROOT, 'src/full/frames.json'), JSON.stringify(out, null, 1) + '\n');
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { typing: v.typing.length, gen: v.gen.length, tall: v.tall }])));
