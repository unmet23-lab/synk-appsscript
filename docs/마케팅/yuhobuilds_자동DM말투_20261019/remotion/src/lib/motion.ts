// 움직임 기본값. 전부 프레임의 함수라 어느 프레임을 뽑아도 같다(CSS 애니메이션·타이머 없음).
import { Easing, interpolate, interpolateColors } from 'remotion';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 빠르게 출발해 길고 매끈하게 멈춤. 튕김 없음(런치 영상의 「promo-out」). */
export const OUT = Easing.bezier(0.1, 0.9, 0.2, 1);
export const IN = Easing.bezier(0.7, 0, 0.84, 0);
export const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** a 프레임부터 len 동안 0 → 1. */
export const prog = (f: number, a: number, len: number, ease = OUT) => interpolate(f, [a, a + len], [0, 1], { ...clamp, easing: ease });

/** 두 값 사이. */
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const mixColor = (a: string, b: string, t: number) => interpolateColors(Math.max(0, Math.min(1, t)), [0, 1], [a, b]);

/** 2차 베지어 위의 점(커서 길). */
export const bezier = (p0: [number, number], p1: [number, number], p2: [number, number], t: number): [number, number] => {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
};

/** 앞쪽이 촘촘해지는 스태거: i번째(0부터)가 시작하는 프레임. */
export const stagger = (at: number, i: number, n: number, span: number, power = 0.8) => at + Math.round(span * Math.pow(n <= 1 ? 0 : i / (n - 1), power));
