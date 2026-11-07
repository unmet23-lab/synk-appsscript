// synkbrief B31 「요금제 1위가 바뀐다」 — 실제 화면 조각 · 1위 표시 · 누름 표시 · 소리. 장면(Scene)과 본편(Film)이 같이 쓴다.
// 화면 결(장부 머리말 11-03): 검정 · 흰 + 버터 한 곳(「1위」) · SUIT 하나 · 실제 화면은 위에 작은 회색 출처 한 줄 · 마침표 없음.
// 실제 화면 그림(public/img — git 밖)은 휴대폰 폭 430×932 @ 1080/430배로 찍은 원본이다(값 · 글은 그대로, 자리만 다시 짠다).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const sec = (s: number) => Math.round(s * 30);
export const BUTTER = '#F5C445';
export const GREY = '#A3A3A3';

// 원본 그림의 한 칸(x, y, w, h — 원본 화소)을 scale배로 보인다
export const Crop: React.FC<{ src: string; x: number; y: number; w: number; h: number; scale?: number; radius?: number; style?: React.CSSProperties }> = ({ src, x, y, w, h, scale = 1, radius = 18, style }) => (
  <div style={{ width: w * scale, height: h * scale, overflow: 'hidden', borderRadius: radius, position: 'relative', ...style }}>
    <Img src={staticFile(`img/${src}.png`)} style={{ position: 'absolute', left: -x * scale, top: -y * scale, width: 1080 * scale, height: 2341 * scale, maxWidth: 'none' }} />
  </div>
);

// 실제 화면 위 작은 회색 출처 한 줄
export const Note: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => (
  <div style={{ fontFamily: KO, fontWeight: 600, fontSize: 34, color: '#B8B8B8', letterSpacing: -0.4, ...style }}>{text}</div>
);

// 들어올 때 1.035배에서 내려앉고 아주 천천히 다가간다
export const Settle: React.FC<{ from: number; children: React.ReactNode; origin?: string; drift?: number; pan?: number }> = ({ from, children, origin = '50% 40%', drift = 0.00018, pan = 0 }) => {
  const f = useCurrentFrame() - sec(from);
  const z = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT }) + Math.max(0, f) * drift;
  return <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-Math.max(0, f) * pan}px) scale(${z})`, transformOrigin: origin }}>{children}</div>;
};

// 누른 자리 — 흰 동그라미가 퍼지며 사라진다(손가락 자리 표시)
export const Tap: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
  const f = useCurrentFrame() - sec(at);
  if (f < -2 || f > 16) return null;
  const pre = interpolate(f, [-2, 0], [0, 1], clamp);
  const p = interpolate(f, [0, 14], [0, 1], { ...clamp, easing: EASE_OUT });
  const r = 34 + p * 58;
  return (
    <>
      <div style={{ position: 'absolute', left: x - 34, top: y - 34, width: 68, height: 68, borderRadius: 34, background: 'rgba(255,255,255,0.5)', opacity: f < 0 ? pre * 0.9 : interpolate(f, [0, 6], [0.9, 0], clamp) }} />
      <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, border: '4px solid rgba(255,255,255,0.85)', opacity: f < 0 ? 0 : 1 - p }} />
    </>
  );
};

// 「1위」 — 자리를 옮길 때마다 위에서 떨어져 앉는다(시소). spots: [[초, x, y], …]
export const Crown: React.FC<{ spots: [number, number, number][]; until: number; size?: number; text?: string; right?: boolean }> = ({ spots, until, size = 92, text = '1위', right }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  if (t < spots[0][0] || t >= until) return null;
  let k = 0;
  for (let i = 0; i < spots.length; i++) if (t >= spots[i][0]) k = i;
  const [s, x, y] = spots[k];
  const g = f - sec(s);
  const drop = interpolate(g, [0, 7], [-70, 0], { ...clamp, easing: Easing.bezier(0.5, 0, 0.75, 0) });
  const squash = interpolate(g, [6, 8, 12], [1, 0.82, 1], clamp);
  const op = interpolate(g, [0, 3], [0, 1], clamp) * interpolate(f, [sec(until) - 3, sec(until)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', ...(right ? { right: 1080 - x } : { left: x }), top: y + drop, transform: `scaleY(${squash})`, transformOrigin: '50% 100%', opacity: op, fontFamily: KO, fontWeight: 800, fontSize: size, letterSpacing: -2.4, color: BUTTER, lineHeight: 1, textShadow: '0 4px 18px rgba(0,0,0,0.55)', whiteSpace: 'nowrap' }}>{text}</div>
  );
};

export const Sfx: React.FC<{ at: number; src: string; v?: number }> = ({ at, src, v = 0.5 }) => (
  <Sequence from={sec(at)}><Audio src={staticFile(`sfx/${src}.wav`)} volume={v * 0.8} /></Sequence>
);

// 위 그늘 — 글자 자리만 어둡게
export const Shade: React.FC<{ strong?: number }> = ({ strong = 0.92 }) => (
  <AbsoluteFill style={{ background: `linear-gradient(to bottom, rgba(10,10,10,${strong}) 0px, rgba(10,10,10,0.8) 470px, rgba(10,10,10,0.34) 760px, rgba(10,10,10,0) 940px)` }} />
);

// ── 실제 화면 칸 자리(원본 화소 — 휴대폰 1080×2341)
// AI 답: 묻는 말풍선부터 「매월 · 1년」 줄까지
export const AI_BOX = { x: 0, y: 180, w: 1080, h: 950 };
// 미리캔버스 Pro 칸(가격 · 멤버당/월 · 년) — 오른쪽 아래 도움말 단추는 뺀다
export const MI_BOX = { x: 40, y: 2016, w: 860, h: 325 };
// 미리캔버스 월간 · 연간 스위치
export const MI_TOGGLE = { x: 400, y: 702, w: 290, h: 112 };
// 어도비 결제 화면 「구독 선택」 두 칸
export const AD_BOX = { x: 24, y: 1128, w: 1032, h: 712 };
// 어도비 두 칸 각각(원본 화소) — 고르지 않은 칸은 어둡게 누른다
export const AD_MONTH = { x: 24, y: 1222, w: 1032, h: 286 };
export const AD_YEAR = { x: 24, y: 1514, w: 1032, h: 318 };
// AI 답의 핵심 — 「승리」 칩부터 「매월 1,700원 절약」까지
export const AI_KEY = { x: 0, y: 455, w: 1080, h: 598 };

// 한 칸 안의 띠(원본 화소 y0~y1)를 어둡게 누른다 — box는 그 칸을 보인 Crop의 원본 칸, s는 배율
export const Dim: React.FC<{ box: { x: number; y: number; w: number }; s: number; y0: number; y1: number; left: number; top: number; a?: number }> = ({ box, s, y0, y1, left, top, a = 0.62 }) => (
  <div style={{ position: 'absolute', left, top: top + (y0 - box.y) * s, width: box.w * s, height: (y1 - y0) * s, background: `rgba(11,11,11,${a})` }} />
);
