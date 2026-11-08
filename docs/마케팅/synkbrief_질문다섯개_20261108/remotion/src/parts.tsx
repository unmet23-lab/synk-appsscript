// synkbrief B32 「질문 다섯 개」 — 장면(Scene)과 본편(Film)이 같이 쓰는 부품.
// 화면 결(장부 머리말 11-03): 원래 장면 그대로 · 위 그늘 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳 · SUIT 하나 · 마침표 없음 · 안전선 안.
// 실제 화면(public/img — git 밖)은 로그인 없는 ChatGPT를 휴대폰 폭 430×932 @ 1080/430배로 찍은 원본(1080×2341)이다. 값 · 글은 손대지 않는다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IO = Easing.bezier(0.45, 0, 0.25, 1);
export const sec = (s: number) => Math.round(s * 30);
export const BUTTER = '#F5C445';
export const GREY = '#CFCFCF';
export const X = 74;
export const TOP = 284;

// 프레임 묶음(public/img/<dir>/<pre>0001.jpg …)에서 k번째 장
export const frameSrc = (dir: string, pre: string, k: number) => staticFile(`img/${dir}/${pre}${String(Math.max(1, Math.round(k))).padStart(4, '0')}.jpg`);

// 위 그늘 — 글자 자리만 어둡게
export const Shade: React.FC<{ a?: number }> = ({ a = 0.92 }) => (
  <AbsoluteFill style={{ background: `linear-gradient(to bottom, rgba(10,10,10,${a}) 0px, rgba(10,10,10,${a * 0.87}) 470px, rgba(10,10,10,${a * 0.37}) 760px, rgba(10,10,10,0) 940px)` }} />
);

// 큰 글자가 곧 말 — 줄마다 28px 아래에서 올라오며 나타난다(줄 사이 3프레임). me = 사람의 말(회색)
export const T: React.FC<{ lines: React.ReactNode[]; from: number; to: number; me?: boolean; size?: number; meta?: string; top?: number; fadeOut?: number; still?: boolean }> = ({ lines, from, to, me, size = 96, meta, top = TOP, fadeOut = 3, still }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const out = interpolate(f, [b - fadeOut, b], [1, 0], clamp);
  const up = (k: number) => {
    const p = still ? 1 : interpolate(f, [a + k * 3, a + k * 3 + 9], [0, 1], { ...clamp, easing: EASE_OUT });
    return { opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` };
  };
  return (
    <div style={{ position: 'absolute', left: X, width: 920, top, fontFamily: KO, textShadow: '0 2px 14px rgba(0,0,0,0.55)' }}>
      {meta ? <div style={{ ...up(0), fontWeight: 600, fontSize: 36, letterSpacing: -0.5, color: GREY, marginBottom: 18 }}>{meta}</div> : null}
      {lines.map((l, i) => (
        <div key={i} style={{ ...up(i + (meta ? 1 : 0)), fontWeight: me ? 700 : 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.6, color: me ? GREY : '#fff', wordBreak: 'keep-all' }}>{l}</div>
      ))}
    </div>
  );
};
export const Y: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: BUTTER }}>{children}</span>;

// 작은 표시 — 위 안전선 줄(28px 회색), 왼쪽 · 오른쪽
export const Small: React.FC<{ text: string; from: number; to: number; right?: boolean }> = ({ text, from, to, right }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const pos = right ? { right: 1080 - 1006 } : { left: X };
  return <div style={{ position: 'absolute', ...pos, top: 206, fontFamily: KO, fontWeight: 600, fontSize: 28, color: 'rgba(255,255,255,0.72)', letterSpacing: -0.4 }}>{text}</div>;
};

export const Sfx: React.FC<{ at: number; src: string; v?: number }> = ({ at, src, v = 0.5 }) => (
  <Sequence from={sec(at)}><Audio src={staticFile(`sfx/${src}.wav`)} volume={v * 0.8} /></Sequence>
);

// ── 사장님 폰 장면(판 cal.png 916×1717 — 오른쪽 어깨 너머 · 두 손에 폰 · 벽에 11월 달력)
// 판을 폭 1080에 맞춘다(배율 PS). 폰 화면 자리(판 원본 화소)와 달력 자리.
export const PS = 1080 / 916;
export const PHONE = { x: 309, y: 947, w: 260, h: 566 };
export const CAL = { cx: 560, cy: 520, circle2: { x: 310, y: 474 } };

// 판 좌표(원본 화소) fx, fy를 화면 sx, sy에 두고 z배로 본다
export const camStyle = (z: number, fx: number, fy: number, sx: number, sy: number): React.CSSProperties => {
  const px = fx * PS, py = fy * PS;
  return { position: 'absolute', left: 0, top: 0, width: 1080, height: 1717 * PS, transformOrigin: '0 0', transform: `translate(${sx - px * z}px, ${sy - py * z}px) scale(${z})` };
};

// 폰 화면 안에 실제 화면 한 장을 넣는다(가림판으로 엄지 · 테두리는 그대로 남는다)
export const PhonePlate: React.FC<{ screen: string; blurPhone?: number; blurTop?: number; screenLight?: number }> = ({ screen, blurPhone = 0, blurTop = 0, screenLight = 0.86 }) => {
  const sw = PHONE.w * PS, sh = PHONE.h * PS;
  const inner = (
    <>
      <Img src={staticFile('img/cal.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1717 * PS }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1717 * PS, WebkitMaskImage: `url(${staticFile('img/cal_mask.png')})`, WebkitMaskSize: '100% 100%', maskImage: `url(${staticFile('img/cal_mask.png')})`, maskSize: '100% 100%' }}>
        <Img src={screen} style={{ position: 'absolute', left: PHONE.x * PS, top: PHONE.y * PS, width: sw, height: sh, objectFit: 'cover', objectPosition: '50% 0%', filter: `brightness(${screenLight}) contrast(0.96) blur(0.35px)` }} />
      </div>
    </>
  );
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {inner}
      {/* 초점 옮김 — 아래(폰 · 손)는 흐리게, 위(달력)는 그대로 */}
      {blurPhone > 0 ? (
        <div style={{ position: 'absolute', inset: 0, filter: `blur(${blurPhone}px)`, WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 46%, rgba(0,0,0,1) 58%)', maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 46%, rgba(0,0,0,1) 58%)' }}>{inner}</div>
      ) : null}
      {blurTop > 0 ? (
        <div style={{ position: 'absolute', inset: 0, filter: `blur(${blurTop}px)`, WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 44%, rgba(0,0,0,0) 54%)', maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 44%, rgba(0,0,0,0) 54%)' }}>{inner}</div>
      ) : null}
    </div>
  );
};
