// 이름표 · 마커 틀의 공용 값 — LAB E1 「댓글에 이름 → 한글로」(LAB_댓글이름한글_20261027/remotion/src/film/timeline.ts)에서
// 시간표는 빼고 자리 · 경로 도구만 옮겼다(M3 다시 살림 10-28). 이름표는 E1과 같은 자리, 글자 칸은 다섯 칸이 들어가게 줄였다.
import { getLength, getPointAtLength } from '@remotion/paths';
import type { Pt } from './geo';

export const FPS = 30;
export const fr = (s: number) => Math.round(s * FPS);

// 화면 자리(1080×1920)
export const STICKER = { x: 90, y: 660, w: 900, h: 560, band: 180, foot: 46 };
// 바트바야르 다섯 칸: 5 × 156 + 4 × 8 = 812px — 이름표 안쪽(852px)에 들어간다. 칸 아래 키릴 읽기와
// 몽골어 음절 묶음 괄호(Бат · ба · яр)가 종이 안에 들어가게 E1(995)보다 조금 위로
export const WRITE = { cx: 540, cy: 978, s: 156, gap: 8 };

const LEN = new Map<string, number>();
export const len = (d: string) => {
  if (!LEN.has(d)) LEN.set(d, getLength(d));
  return LEN.get(d)!;
};
export const at = (d: string, p: number): Pt => {
  const q = getPointAtLength(d, len(d) * Math.min(1, Math.max(0, p)));
  return q ? [q.x, q.y] : [0, 0];
};

export type Timed = { d: string; syl: number; t: readonly [number, number] };
