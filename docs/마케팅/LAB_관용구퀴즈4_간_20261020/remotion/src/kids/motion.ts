// v2 움직임(10-17 유호님 「그림 개그 움직임이랑 몽글 깜빡임·숨쉬기 넣은 v2」).
// 기준: 제자리에서만(화면을 가로지르지 않음), 회전·늘 떠다니기·빠른 떨림 없음, 몽글 몸 늘이기 3% 이하(10-06 「13% 이하로 줄이자 훨씬 자연스러워」보다 훨씬 작게).
// 움직임은 120 BPM 박(B = 15프레임)에 맞춘다. 영상 첫 2초(첫 문제 0~60프레임)에는 몽글을 움직이지 않는다(릴스 훅 첫 2초 몸짓 금지, 09-06).
import type { CSSProperties } from 'react';
import { B, T } from '../film/timeline';

/** 박마다 한 번 튀고 잦아드는 값(1 → 0). start 전에는 0. */
const beatHit = (f: number, start: number, decay = 4) => (f < start ? 0 : Math.exp(-((f - start) % B) / decay));
/** 박에 맞춘 깡충(0 → 1 → 0, 한 박에 한 번). */
const hop = (f: number, start: number) => (f < start ? 0 : Math.sin((Math.PI * ((f - start) % B)) / B));

const tf = (o: { dx?: number; dy?: number; sx?: number; sy?: number; skew?: number }, origin = '50% 100%'): CSSProperties => ({
  transform: `translate(${o.dx ?? 0}px, ${o.dy ?? 0}px) skewX(${o.skew ?? 0}deg) scale(${o.sx ?? 1}, ${o.sy ?? 1})`,
  transformOrigin: origin,
});

/** 글자 그대로의 그림 개그(T.guess부터 판이 덮을 때까지 약 1초, 0초 훅 판은 from부터). 그림이 관용구를 몸으로 보여 준다.
 *  관용구 퀴즈 #4(10-20): 0 콩알만 해지는 간 · 1 떨어지는 간 · 2 커다란 간. 빠른 떨림 없이 박마다 한 번만 움직인다. */
export const literalMotion = (index: number, f: number, from?: number): CSSProperties => {
  const start = from ?? T.guess + 4; // 그림이 튀어 들어와 자리 잡은 뒤(v4b처럼 0초부터 보이면 from으로 앞당김)
  if (index === 0) {
    // 간이 콩알만 해지다: 박마다 「움찔」 더 작아졌다 되돌아온다(콩알 줄과 함께)
    const h = beatHit(f, start, 4);
    return tf({ sx: 1 - 0.07 * h, sy: 1 - 0.07 * h }, '50% 55%');
  }
  if (index === 1) {
    // 간 떨어지다: 박마다 「쑥」 아래로 떨어졌다 제자리(먼지 구름까지 한 덩어리)
    const h = hop(f, start);
    return tf({ dy: 16 * h, sy: 1 + 0.02 * h });
  }
  // 간이 크다: 박마다 뿌듯하게 부풀었다 되돌아온다(바닥 고정)
  const h = beatHit(f, start, 5);
  return tf({ sx: 1 + 0.05 * h, sy: 1 + 0.06 * h });
};

/** 진짜 뜻 그림(T.art부터 문제 끝까지). */
export const meaningMotion = (index: number, f: number): CSSProperties => {
  const start = T.example; // 그림이 자리 잡은 뒤 첫 박
  if (index === 0) {
    // 겁이 난다: 이불 더미가 박마다 「움찔」 납작해진다
    const h = beatHit(f, start, 4);
    return tf({ sx: 1 + 0.03 * h, sy: 1 - 0.045 * h });
  }
  if (index === 1) {
    // 깜짝 놀란다: 고양이가 천둥에 박마다 펄쩍(땅에 닿을 때 살짝 납작)
    const h = hop(f, start);
    const land = beatHit(f, start, 2.5);
    return tf({ dy: -16 * h, sx: 1 + 0.04 * land, sy: 1 - 0.05 * land });
  }
  // 겁이 없다: 팝콘·TV가 박마다 느긋하게 통 튄다
  const h = hop(f, start);
  return tf({ dy: -8 * h, sy: 1 + 0.02 * h });
};

/** 몽글 숨쉬기: 두 박(1초)에 한 번, 바닥에 붙은 채 2.5%만. 영상 첫 2초는 멈춤. */
export const hostBreath = (f: number, globalStart: number): CSSProperties => {
  const g = f + globalStart; // 영상 전체 프레임
  if (g < 60) return {};
  const amp = Math.min(1, (g - 60) / 10);
  const s = Math.sin((2 * Math.PI * g) / (2 * B));
  return tf({ sx: 1 - 0.012 * s * amp, sy: 1 + 0.025 * s * amp });
};

/** 깜빡임: 구슬 눈 표정(궁금·집중)에서만 3프레임. 첫 문제의 첫 2초(궁금)는 깜빡이지 않는다. */
const BLINKS = [Math.round(1.2 * B), Math.round(6.4 * B)]; // 궁금(제목 뒤 · 2·3번 문제) · 집중(카운트 「2」와 「1」 사이) — 120 BPM에서 18·96프레임
// 퀴즈 #4(10-20): 퀴즈 #2 진행자 컷을 다시 쓰므로 그때 만든 눈 감은 컷(host_curious_blink · host_focused_blink)으로 다시 깜빡인다.
const HAS_BLINK = true;
export const blinkSrc = (src: string, f: number, index: number) => {
  const canBlink = HAS_BLINK && (src.endsWith('host_curious.webp') || src.endsWith('host_focused.webp'));
  if (!canBlink) return src;
  const on = BLINKS.some((b) => f >= b && f < b + 3) && !(index === 0 && f < 60);
  return on ? src.replace('.webp', '_blink.webp') : src;
};
