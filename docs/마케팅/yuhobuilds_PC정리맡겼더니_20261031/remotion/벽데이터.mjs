// 폴더 벽 배치: node 벽데이터.mjs → src/y27/wall.generated.ts · ../자료/벽소리.json
// 원본은 ../자료/폴더벽.json(../폴더벽재기.py — 실제 옮긴 목록의 크기와 갈 곳, 이름 없음). 칸 하나가 실제 폴더 하나, 넓이가 실제 크기다.
// 세 덩이를 먼저 나눈다: 위 = 그날 밤 되돌린 것, 아래 왼쪽 = 지우기 전 확인에서 또 되돌린 것, 아래 오른쪽 = 끝까지 남은 것(진짜 지워도 되는 것).
// 처음엔 한 벽으로 보이고, 되돌릴 때 덩이째 돌아와 남은 구석이 드러난다. 넓이 비는 실제 크기 그대로다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = JSON.parse(fs.readFileSync(path.join(HERE, '..', '자료', '폴더벽.json'), 'utf8'));
export const W = 1080;
export const H = 1300;
const MIN_MB = 6; // 아주 작은 폴더도 칸이 보이게(덩이 안 비율만 고치고 덩이 넓이는 실제 크기)

// 작은 쪽 먼저 섞이지 않게 큰 폴더부터. 같은 seed면 늘 같은 배치.
let seed = 20261029;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

function squarify(items, x, y, w, h) {
  // items: [{v, ...}] 큰 것부터, v 합 = w*h
  const out = [];
  let rest = items.slice();
  while (rest.length) {
    const side = Math.min(w, h);
    const row = [];
    let sum = 0;
    let worst = Infinity;
    for (const it of rest) {
      const s = sum + it.v;
      const hi = Math.max(...row.map((r) => r.v), it.v);
      const lo = Math.min(...row.map((r) => r.v), it.v);
      const ratio = Math.max((side * side * hi) / (s * s), (s * s) / (side * side * lo));
      if (ratio > worst) break;
      worst = ratio;
      row.push(it);
      sum = s;
    }
    rest = rest.slice(row.length);
    const thick = sum / side;
    let p = 0;
    for (const it of row) {
      const len = it.v / thick;
      if (w >= h) out.push({ ...it, x, y: y + p, w: thick, h: len });
      else out.push({ ...it, x: x + p, y, w: len, h: thick });
      p += len;
    }
    if (w >= h) { x += thick; w -= thick; } else { y += thick; h -= thick; }
  }
  return out;
}

const rows = src['행'];
// 3(옮긴 목록엔 있지만 지금 정리 대기에 없는 두 곳, 0.53GiB)은 남은 469곳에 들지 않는다 — 또 되돌린 덩이로 센다.
const group = (g) => rows.filter((r) => (r[1] === 3 ? 1 : r[1]) === g).map((r) => r[0]).sort((a, b) => b - a);
const gs = [group(0), group(1), group(2)];
const mb = gs.map((g) => g.reduce((a, b) => a + b, 0));
const total = mb[0] + mb[1] + mb[2];

const topH = (H * mb[0]) / total;
const botH = H - topH;
const leftW = (W * mb[1]) / (mb[1] + mb[2]);
const boxes = [
  [0, 0, W, topH],
  [0, topH, leftW, botH],
  [leftW, topH, W - leftW, botH],
];

const tiles = [];
gs.forEach((sizes, g) => {
  const [bx, by, bw, bh] = boxes[g];
  const adj = sizes.map((s) => Math.max(s, MIN_MB));
  const sum = adj.reduce((a, b) => a + b, 0);
  const items = adj.map((s) => ({ v: (s / sum) * bw * bh, g }));
  for (const t of squarify(items, bx, by, bw, bh)) tiles.push(t);
});

const T = tiles.map((t) => [+t.x.toFixed(1), +t.y.toFixed(1), +t.w.toFixed(1), +t.h.toFixed(1), t.g, +rnd().toFixed(3), +rnd().toFixed(3)]);
const gib = mb.map((m) => +(m / 1024).toFixed(2));
const ts = `// node 벽데이터.mjs가 만든 파일. 고치지 말고 다시 만든다.
// [x, y, w, h, 덩이(0 그날 밤 · 1 또 · 2 남음), 난수, 난수] — 칸 하나가 실제 폴더 하나, 넓이가 실제 크기.
export const WALL_W = ${W};
export const WALL_H = ${H};
export const GIB = ${JSON.stringify(gib)};
export const BOXES = ${JSON.stringify(boxes.map((b) => b.map((n) => +n.toFixed(1))))};
export const TILES: readonly (readonly [number, number, number, number, number, number, number])[] = ${JSON.stringify(T)};
`;
fs.writeFileSync(path.join(HERE, 'src', 'y27', 'wall.generated.ts'), ts);
console.log(`칸 ${T.length} · 덩이 GiB ${gib.join(' · ')} · 넓이 ${gib.map((g) => ((g / (gib[0] + gib[1] + gib[2])) * 100).toFixed(1) + '%').join(' · ')} · 덩이 폴더 ${gs.map((g) => g.length).join(' · ')}`);
