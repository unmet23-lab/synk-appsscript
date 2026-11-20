// 폴더 벽 — 칸 하나가 실제 폴더 하나, 넓이가 실제 크기(wall.generated.ts — yuhobuilds_PC정리맡겼더니_20261031의 자료를 읽어 복사한 것).
// 이 편의 결(검정 · 흰 + 버터 한 곳)로 다시 그렸다. 처음엔 밝은 벽(AI가 치워도 된다고 고른 53기가) → 위에서부터 어두워지고 →
// 정리 대기에 남은 덩이(6.7기가)만 버터로 선다. 자료의 위아래를 뒤집어 남는 덩이를 위쪽에 둔다(아래쪽은 릴스 화면 글에 가린다). 칸은 떨어지거나 돌지 않는다(밝기만 바뀐다). 프레임만의 함수다.
// 아주 작은 칸은 틈 없이 한 덩이로 칠한다 — 작은 칸이 빽빽하게 모이면 점 무늬로 보인다.
import React, { useLayoutEffect, useRef } from 'react';
import { TILES, WALL_H, WALL_W } from './wall.generated';

const LIGHT: [number, number, number] = [226, 223, 216];
const DARK: [number, number, number] = [44, 44, 46];
const BUTTER: [number, number, number] = [245, 196, 69];
const WHITE: [number, number, number] = [255, 255, 255];
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const mix3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = ([r, g, b]: [number, number, number], k = 1) => `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})`;
const SMALL = 46; // 이보다 작은 칸은 틈 없는 네모(밝기 · 때도 이웃과 같게 — 한 덩이로 보이게)

function folder(x: CanvasRenderingContext2D, tx: number, ty: number, tw: number, th: number, c: [number, number, number], k: number) {
  if (Math.min(tw, th) < SMALL) {
    // 정수 자리에 맞춰 칠한다 — 반 픽셀 틈으로 바탕이 비치면 잔 무늬가 생긴다.
    const x0 = Math.floor(tx);
    const y0 = Math.floor(ty);
    x.fillStyle = css(c, k);
    x.fillRect(x0, y0, Math.ceil(tx + tw) - x0, Math.ceil(ty + th) - y0);
    return;
  }
  const gap = 2.2;
  const L = tx + gap;
  const T = ty + gap;
  const w = tw - gap * 2;
  const h = th - gap * 2;
  const r = Math.min(w, h) * 0.07;
  const tab = Math.min(h * 0.13, 26);
  x.fillStyle = css(c, k * 0.74);
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
  const top = T + tab * 1.7;
  const gr = x.createLinearGradient(0, top, 0, T + h);
  gr.addColorStop(0, css(c, k * 1.06));
  gr.addColorStop(1, css(c, k * 0.86));
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

/**
 * t = 장면 안 초. rise = 벽이 서는 때, dim = 남는 덩이 밖이 어두워지기 시작하는 때(위에서 아래로 1초),
 * gold = 남은 덩이가 버터로 바뀌는 때.
 */
export const Wall: React.FC<{ t: number; rise: number; dim: number; gold: number; style?: React.CSSProperties }> = ({ t, rise, dim, gold, style }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const x = c.getContext('2d');
    if (!x) return;
    x.clearRect(0, 0, WALL_W, WALL_H);
    for (const [tx, ty0, tw, th, g, r0] of TILES) {
      // 위아래를 뒤집어 그린다 — 남는 덩이(6.7기가)가 글 바로 아래(릴스 안전 구역 안)에 오게. 넓이는 그대로다.
      const ty = WALL_H - ty0 - th;
      const tiny = Math.min(tw, th) < SMALL;
      const r1 = tiny ? 0.5 : r0;
      const up = ease((t - rise - (ty / WALL_H) * 0.22 - r1 * 0.1) / 0.3);
      if (up <= 0) continue;
      const gain = tiny ? 0.93 : 0.86 + 0.14 * r1;
      let col = LIGHT;
      if (g !== 2) {
        // 아래에서 위로 어두워진다 — 남는 덩이 쪽으로 눈이 간다.
        const d = clamp01((t - dim - (1 - (ty + th) / WALL_H) * 0.75 - r1 * 0.2) / 0.38);
        col = mix3(LIGHT, DARK, ease(d));
      } else {
        const q = clamp01((t - gold - r1 * 0.12) / 0.32);
        col = mix3(LIGHT, BUTTER, ease(q));
        const flash = clamp01(1 - Math.abs(t - gold - 0.2) / 0.22) * 0.35;
        if (flash > 0) col = mix3(col, WHITE, flash);
      }
      x.globalAlpha = up;
      folder(x, tx, ty + (1 - up) * 26, tw, th, col, gain);
    }
    x.globalAlpha = 1;
  }, [t, rise, dim, gold]);
  return <canvas ref={ref} width={WALL_W} height={WALL_H} style={{ position: 'absolute', left: 0, top: 0, ...style }} />;
};
