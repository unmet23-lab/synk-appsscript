// 자주 쓰는 모션 값. 전부 useCurrentFrame()으로만 움직인다 — 어느 프레임을 뽑아도 같다.
// synkbrief_AI구독계정판_20261017/remotion/src/lib/anim.tsx·v5/cine.tsx에서 이 편에 쓰는 것만 옮겼다(그 판은 고치지 않는다).
import { Easing, interpolate } from 'remotion';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1); // expo out
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** a 프레임부터 len 프레임 동안 0→1(감속). */
export const ramp = (f: number, a: number, len: number, ease = EASE_OUT) => interpolate(f, [a, a + len], [0, 1], { ...clamp, easing: ease });

/** 임계 감쇠 스프링 1-(1+wt)e^(-wt): 목표를 넘지 않고 내려앉는다(튕김 없음). */
export const settle = (f: number, at: number, w = 14) => {
  const t = (f - at) / 30;
  if (t <= 0) return 0;
  return 1 - (1 + w * t) * Math.exp(-w * t);
};

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** 한 번 커졌다 제자리(펀치). 장면당 하나, 1.25 이하. */
export const punch = (f: number, at: number, to = 1.04) => {
  if (f < at) return 1;
  const up = interpolate(f, [at, at + 2], [1, to], clamp);
  const down = interpolate(f, [at + 2, at + 22], [to, 1], { ...clamp, easing: EASE_OUT });
  return f < at + 2 ? up : down;
};
