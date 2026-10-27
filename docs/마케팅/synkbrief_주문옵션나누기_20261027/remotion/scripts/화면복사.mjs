// 실제 녹화 프레임(../화면/G·X, git에 있는 잘라 낸 판 — 고른 법은 ../화면/고르기.py)을 영상이 읽는 public/screen/으로 옮기고, 프레임 표를 src/full/frames.json으로 쓴다.
//   node scripts/화면복사.mjs
// G = ChatGPT(입력 칸 t*, 생성 중 g*, 다 쓴 답 전체.jpg), X = 엑셀(x01 빈 B2 → x02~04 B2 · C2 · D2 붙임 → x05 첫 줄 고름 → x06 채움 → x07 다 나뉨).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, '..', '화면');
const meta = JSON.parse(fs.readFileSync(path.join(SRC, '프레임.json'), 'utf8'));
for (const k of ['G', 'X']) {
  const dst = path.join(ROOT, 'public/screen', k);
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(path.join(SRC, k))) fs.copyFileSync(path.join(SRC, k, f), path.join(dst, f));
}
const G = meta.G.rows;
const sent = G.find((r) => r.tag === 'sent').ms;
const out = {
  G: {
    typing: G.filter((r) => ['empty', 'type', 'typed'].includes(r.tag)).map((r) => ({ f: r.f, ms: r.ms, tag: r.tag })),
    gen: G.filter((r) => r.tag === 'gen').map((r) => ({ f: r.f, ms: r.ms - sent })),
  },
  X: Object.fromEntries(meta.X.rows.map((r) => [r.tag, r.f])),
  XH: meta.X.size[1],
};
fs.writeFileSync(path.join(ROOT, 'src/full/frames.json'), JSON.stringify(out, null, 1) + '\n');
console.log({ typing: out.G.typing.length, gen: out.G.gen.length, X: out.X, XH: out.XH });
