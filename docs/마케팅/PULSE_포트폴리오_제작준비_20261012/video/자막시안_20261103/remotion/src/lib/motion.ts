// 시안 공통 움직임 — 초 단위로 쓴다(프레임은 화면에서만 바꾼다)
import { Easing, interpolate } from 'remotion';

export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);   // 빠르게 들어와 부드럽게 멎음
export const SNAP = Easing.bezier(0.65, 0, 0.35, 1);

// t초가 a에서 시작해 d초 동안 0 → 1
export const ramp = (t: number, a: number, d: number, ease = EXPO) =>
  interpolate(t, [a, a + d], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

// 들어옴 · 머묾 · 나감을 한 값으로(나갈 때 1 → 0)
export const life = (t: number, a: number, b: number, inD = 0.28, outD = 0.16) =>
  Math.min(ramp(t, a, inD), 1 - ramp(t, b - outD, outD, SNAP));

// 용수철 한 번 튐(0 → 1, 끝에 살짝 넘침)
export const pop = (t: number, a: number, d = 0.42) => {
  const x = Math.max(0, Math.min(1, (t - a) / d));
  if (x <= 0) return 0;
  const c = 1.70158 * 1.15;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

// 「★낱말 나머지」 — 강조 낱말과 나머지를 나눈다
export type Piece = { text: string; key: boolean };
export const pieces = (s: string): Piece[] => {
  const out: Piece[] = [];
  s.split(' ').forEach((w) => {
    if (w.startsWith('★')) out.push({ text: w.slice(1), key: true });
    else out.push({ text: w, key: false });
  });
  return out;
};
export const plain = (s: string) => s.replace(/★/g, '');
