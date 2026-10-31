// 폴더 벽 — 칸 하나가 실제 폴더 하나, 넓이가 실제 크기(wall.generated.ts). 프레임만의 함수라 어느 프레임을 뽑아도 같다.
// 처음엔 노란 벽(AI가 쓰레기로 고른 것) → 무너져 비고 → 덩이째 초록으로 돌아오고 → 남은 구석만 노랗게 선다.
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import { TILES, WALL_H, WALL_W } from './wall.generated';

export const AMBER = '#FFC94D';
export const GREEN = '#1FCB83';
export const RED = '#F0403A';

export type WallBeat = {
  /** 무너지기 시작(없으면 처음부터 비어 있지 않고 서 있다). */
  fall?: number;
  /** 무너지는 데 드는 프레임 — 실제로 옮긴 0.9초면 27. */
  fallLen?: number;
  /** 덩이마다 돌아오기 시작(0 그날 밤 · 1 또 · 2 남은 부스러기). */
  back?: readonly [number, number, number];
  backLen?: readonly [number, number, number];
  /** 앞서 지나간 벽을 다시 세운다: 이 프레임부터 처음 상태(노란 벽)로. */
  reset?: number;
  /** 이 프레임부터 초록이 어두워지고 남은 구석만 밝다. */
  lone?: number;
  /** 무너지기 전 떨림(시작 프레임) — 처음부터 화면이 움직인다. */
  shake?: number;
  /** 'done'이면 처음부터 되돌린 뒤의 벽(초록 + 노란 구석)으로 서 있다. */
  base?: 'amber' | 'done';
  /** 이 프레임부터 칸이 잿빛이 된다(무너지는 칸 포함). */
  ash?: number;
  /** 빈자리: 이 구간에 벽이 있던 자리를 붉은 윤곽으로. */
  ghost?: readonly [number, number];
  /** 폴더 하나를 빼면 벽 전체가 빨갛게 번진다: at에 그 칸이 빠지고 red부터 번짐. */
  pick?: { at: number; red: number };
  /** 빈자리 윤곽 색 'r,g,b'. */
  ghostColor?: string;
};

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const lit = ([r, g, b]: [number, number, number], k: number) => `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})`;
const mixRgb = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const A = rgb(AMBER);
const G = rgb(GREEN);
const WHITE: [number, number, number] = [255, 255, 255];
const R = rgb(RED);
const ASH: [number, number, number] = [92, 94, 100];

/** 칸 하나를 실제 탐색기 폴더 꼴로: 뒤판 + 탭 + 앞판. 아주 작은 칸은 네모. 가운데가 (0,0). */
function folder(x: CanvasRenderingContext2D, tw: number, th: number, c: [number, number, number], k: number) {
  const gap = Math.min(1.6, Math.min(tw, th) * 0.1);
  const w = tw - gap * 2;
  const h = th - gap * 2;
  const L = -w / 2;
  const T = -h / 2;
  if (Math.min(w, h) < 9) {
    x.fillStyle = lit(c, k);
    x.fillRect(L, T, w, h);
    return;
  }
  const r = Math.min(w, h) * 0.07;
  const tab = h * 0.13;
  // 뒤판과 탭
  x.fillStyle = lit(c, k * 0.72);
  x.beginPath();
  x.moveTo(L + r, T);
  x.lineTo(L + w * 0.38, T);
  x.lineTo(L + w * 0.38 + tab, T + tab);
  x.lineTo(L + w - r, T + tab);
  x.quadraticCurveTo(L + w, T + tab, L + w, T + tab + r);
  x.lineTo(L + w, T + h * 0.5);
  x.lineTo(L, T + h * 0.5);
  x.lineTo(L, T + r);
  x.quadraticCurveTo(L, T, L + r, T);
  x.fill();
  // 앞판
  const top = T + tab * 1.7;
  const gr = x.createLinearGradient(0, top, 0, T + h);
  gr.addColorStop(0, lit(c, k * 1.12));
  gr.addColorStop(1, lit(c, k * 0.8));
  x.fillStyle = gr;
  x.beginPath();
  x.moveTo(L + r, top);
  x.lineTo(L + w - r, top);
  x.quadraticCurveTo(L + w, top, L + w, top + r);
  x.lineTo(L + w, T + h - r);
  x.quadraticCurveTo(L + w, T + h, L + w - r, T + h);
  x.lineTo(L + r, T + h);
  x.quadraticCurveTo(L, T + h, L, T + h - r);
  x.lineTo(L, top + r);
  x.quadraticCurveTo(L, top, L + r, top);
  x.fill();
}

/** 빼낼 칸 — 벽 가운데쯤에서 가장 큰 폴더. */
export const PICK = TILES.reduce((best, t, i) => (t[0] > 260 && t[0] < 620 && t[1] > 120 && t[1] < 520 && t[2] * t[3] > TILES[best][2] * TILES[best][3] ? i : best), 40);
export const PICK_C: readonly [number, number] = [TILES[PICK][0] + TILES[PICK][2] / 2, TILES[PICK][1] + TILES[PICK][3] / 2];

export const Wall: React.FC<{ beat: WallBeat; scan?: [number, number]; style?: React.CSSProperties }> = ({ beat, scan, style }) => {
  const f = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const { fall, fallLen = 27, back, backLen = [48, 30, 15], reset, lone, shake, ghost, base = 'amber', ash, ghostColor = '240,64,58', pick } = beat;

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const x = c.getContext('2d');
    if (!x) return;
    x.clearRect(0, 0, WALL_W, WALL_H);
    const standing = reset !== undefined && f >= reset;
    const loneP = lone === undefined ? 0 : clamp01((f - lone) / 14);
    if (ghost && f >= ghost[0] && f < ghost[1]) {
      const a = Math.min(clamp01((f - ghost[0]) / 6), clamp01((ghost[1] - f) / 5)) * (0.8 + 0.2 * Math.sin(f * 0.7));
      x.strokeStyle = `rgba(${ghostColor},${a})`;
      x.lineWidth = 2.2;
      // 빈자리는 폴더 꼴 윤곽으로 — 네모 격자는 뜻이 안 읽혔다(r2 · r4 시험관 둘)
      for (const [tx, ty, tw, th] of TILES) {
        if (tw <= 11 || th <= 11) continue;
        const L = tx + 2;
        const T = ty + 2;
        const w = tw - 4;
        const h = th - 4;
        const tab = h * 0.13;
        x.beginPath();
        x.moveTo(L, T);
        x.lineTo(L + w * 0.38, T);
        x.lineTo(L + w * 0.38 + tab, T + tab);
        x.lineTo(L + w, T + tab);
        x.lineTo(L + w, T + h);
        x.lineTo(L, T + h);
        x.closePath();
        x.stroke();
      }
    }
    let index = -1;
    for (const [tx, ty, tw, th, g, r1, r2] of TILES) {
      index += 1;
      const picked = pick !== undefined && index === PICK;
      let pickHit = 0;
      let dy = 0;
      let dx = 0;
      let rot = 0;
      let alpha = 1;
      let col = base === 'done' && g !== 2 ? G : A;
      let flash = 0;
      const away = fall !== undefined && !standing && f >= fall;
      if (away) {
        const span = fallLen * 0.62;
        const delay = (1 - ty / WALL_H) * 0.6 * span + r1 * 0.4 * span;
        const len = fallLen * (0.28 + 0.1 * r2);
        const p = clamp01((f - fall - delay) / len);
        const start = back ? back[g] : Infinity;
        if (f >= start) {
          const bl = backLen[g];
          const bd = (ty / WALL_H) * 0.25 * bl + r1 * 0.45 * bl;
          const q = clamp01((f - start - bd) / (bl * 0.34));
          if (q <= 0) continue;
          const e = ease(q);
          dy = (1 - e) * (WALL_H + 160 - ty);
          rot = (1 - e) * (r2 - 0.5) * 0.9;
          col = g === 2 ? A : G;
          flash = clamp01(1 - (f - start - bd - bl * 0.34) / 9);
        } else {
          if (p >= 1) continue;
          dy = p * p * (WALL_H + 200 - ty);
          rot = p * p * (r2 - 0.5) * 1.1;
          alpha = 1 - p * 0.15;
        }
      }
      if (shake !== undefined && !away && f >= shake && (fall === undefined || f < fall) && !standing) {
        const amp = fall === undefined ? 2 : 1.5 + 6 * clamp01((f - shake) / Math.max(1, fall - shake));
        dx += Math.sin(f * 2.1 + r1 * 40) * amp;
        dy += Math.cos(f * 1.7 + r2 * 40) * amp;
        rot += Math.sin(f * 1.3 + r2 * 20) * 0.012 * amp;
      }
      const gain = 0.9 + 0.2 * r1;
      let k = gain;
      if (scan && !away) {
        const yy = (((f - scan[0]) / Math.max(1, scan[1] - scan[0])) * (WALL_H + 500) - 250);
        k += 0.5 * Math.max(0, 1 - Math.abs(ty + th / 2 - yy) / 250);
      }
      if (loneP > 0) k *= g === 2 ? 1 + 0.25 * loneP : 1 - 0.8 * loneP;
      if (pick) {
        if (picked && f >= pick.at) {
          const q = (f - pick.at) / 12;
          dy += q * q * (WALL_H + 300 - ty);
          rot += q * q * 0.6;
        } else if (!picked && f >= pick.red) {
          const [px, py] = PICK_C;
          const dist = Math.hypot(tx + tw / 2 - px, ty + th / 2 - py);
          pickHit = clamp01(((f - pick.red) * 62 - dist) / 150);
        }
      }
      const ashP = ash === undefined ? 0 : clamp01((f - ash) / 8);
      const paint = pickHit > 0 ? mixRgb(col, R, pickHit) : ashP > 0 ? mixRgb(col, ASH, ashP) : flash > 0 ? mixRgb(col, WHITE, flash) : col;
      x.save();
      x.globalAlpha = alpha;
      x.translate(tx + tw / 2 + dx, ty + th / 2 + dy);
      if (rot) x.rotate(rot);
      folder(x, tw, th, paint, pickHit > 0 ? k * (1 - 0.25 * pickHit) : k);
      if (picked && f < pick.at) {
        x.strokeStyle = '#FFFFFF';
        x.lineWidth = 7 + 2 * Math.sin(f * 0.5);
        x.strokeRect(-tw / 2 - 3, -th / 2 - 3, tw + 6, th + 6);
      }
      x.restore();
    }
  }, [f, fall, fallLen, back, backLen, reset, lone, scan, shake, ghost, base, ash, ghostColor]);

  return <canvas ref={ref} width={WALL_W} height={WALL_H} style={{ position: 'absolute', left: 0, top: 620, ...style }} />;
};
