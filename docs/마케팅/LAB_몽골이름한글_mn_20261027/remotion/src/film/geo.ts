// 손글씨 획을 SVG 경로로 만든다. 같은 seed면 같은 떨림이 나온다(어느 프레임을 뽑아도 같다).
import { random } from 'remotion';

export type Pt = [number, number];

/** 칸(왼쪽 위 x·y, 한 변 s) 안의 0~1 좌표를 화면 px로. */
export const inBox = (box: { x: number; y: number; s: number }, pts: Pt[]): Pt[] =>
  pts.map(([u, v]) => [box.x + u * box.s, box.y + v * box.s]);

const fmt = (n: number) => n.toFixed(1);

/** 점들을 지나는 매끈한 곡선(Catmull-Rom → 3차 베지에). 첫 점의 M은 붙이지 않는다. */
const smoothThrough = (p: Pt[]) => {
  let d = '';
  for (let i = 0; i < p.length - 1; i += 1) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
};

/**
 * 손으로 그은 획.
 * sharp: 꺾이는 자리(ㄱ·Z)는 그대로 꺾고, 꺾임 사이 선만 살짝 떨리게.
 * 아니면 모든 점을 매끈하게 잇는다(2·뱀).
 * jitter: 떨림 크기(px), seed: 떨림 모양.
 */
export const handPath = (corners: Pt[], o: { sharp?: boolean; jitter?: number; seed: string }) => {
  const j = o.jitter ?? 3;
  const r = (k: string) => (random(`${o.seed}-${k}`) - 0.5) * 2;
  if (!o.sharp) {
    const pts = corners.map(([x, y], i) => [x + r(`x${i}`) * j, y + r(`y${i}`) * j] as Pt);
    return `M ${fmt(pts[0][0])} ${fmt(pts[0][1])}` + smoothThrough(pts);
  }
  let d = `M ${fmt(corners[0][0])} ${fmt(corners[0][1])}`;
  for (let s = 0; s < corners.length - 1; s += 1) {
    const [ax, ay] = corners[s], [bx, by] = corners[s + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.round(len / 60));
    const nx = -(by - ay) / len, ny = (bx - ax) / len; // 선에 수직
    const seg: Pt[] = [];
    for (let k = 0; k <= n; k += 1) {
      const t = k / n;
      const w = k === 0 || k === n ? 0 : r(`s${s}k${k}`) * j; // 끝점은 떨지 않는다(꺾임이 또렷하게)
      seg.push([ax + (bx - ax) * t + nx * w, ay + (by - ay) * t + ny * w]);
    }
    d += smoothThrough(seg);
  }
  return d;
};
