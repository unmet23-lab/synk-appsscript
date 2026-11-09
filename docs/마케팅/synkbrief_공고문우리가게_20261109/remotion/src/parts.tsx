// synkbrief B36 「공고문 우리 가게」 — 장면(Scene)과 본편(Film)이 같이 쓰는 부품.
// 화면 결(장부 머리말 11-03): 원래 장면 그대로 · 위 그늘 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳(쪽수) · SUIT 하나 · 마침표 없음 · 안전선 안.
// 실제 화면(public/img — git 밖): Gemini를 휴대폰 폭 430으로 찍은 원본(1080폭)과 중기부 공고 제2026-576호 PDF 쪽(1400폭). 값 · 글은 손대지 않는다.
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
export const pageSrc = (n: number) => staticFile(`img/p/p${String(n).padStart(2, '0')}.jpg`);

// 위 그늘 — 글자 자리만 어둡게
export const Shade: React.FC<{ a?: number }> = ({ a = 0.92 }) => (
  <AbsoluteFill style={{ background: `linear-gradient(to bottom, rgba(10,10,10,${a}) 0px, rgba(10,10,10,${a * 0.87}) 470px, rgba(10,10,10,${a * 0.37}) 760px, rgba(10,10,10,0) 940px)` }} />
);

// 큰 글자가 곧 말 — 줄마다 28px 아래에서 올라오며 나타난다(줄 사이 3프레임)
export const T: React.FC<{ lines: React.ReactNode[]; from: number; to: number; size?: number; meta?: string; top?: number; fadeOut?: number; still?: boolean }> = ({ lines, from, to, size = 96, meta, top = TOP, fadeOut = 3, still }) => {
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
        <div key={i} style={{ ...up(i + (meta ? 1 : 0)), fontWeight: 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.6, color: '#fff', wordBreak: 'keep-all' }}>{l}</div>
      ))}
    </div>
  );
};
export const Y: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: BUTTER }}>{children}</span>;

// 작은 표시 — 위 안전선 줄(28px 회색), 왼쪽 · 오른쪽
export const Small: React.FC<{ text: string; from: number; to: number; right?: boolean; brand?: boolean }> = ({ text, from, to, right, brand }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const pos = right ? { right: 1080 - 1006 } : { left: X };
  // 끝의 브랜드 표시는 출처 줄과 갈리게(작게 두되 희고 굵게)
  const look = brand ? { fontWeight: 800, fontSize: 32, color: '#fff', letterSpacing: -0.8, top: 202 } : { fontWeight: 600, fontSize: 28, color: 'rgba(255,255,255,0.62)', letterSpacing: -0.4, top: 206 };
  return <div style={{ position: 'absolute', ...pos, fontFamily: KO, ...look }}>{text}</div>;
};

export const Sfx: React.FC<{ at: number; src: string; v?: number }> = ({ at, src, v = 0.5 }) => (
  <Sequence from={sec(at)}><Audio src={staticFile(`sfx/${src}.wav`)} volume={v * 0.8} /></Sequence>
);

// 실제 화면 한 칸 — 프레임 묶음의 k0 → k1장을 그 칸 길이 동안 넘기며, 원본 화소(x, y, w, h)를 scale배로 top에 놓는다
export type Box = { x: number; y: number; w: number; h: number };
export const Screen: React.FC<{ dir: string; pre: string; k0: number; k1?: number; dur: number; box: Box; scale?: number; top: number; note?: string; hold?: number; ease?: 'lin' | 'out' }> = ({ dir, pre, k0, k1, dur, box, scale = 1, top, note, hold = 0, ease = 'lin' }) => {
  const f = useCurrentFrame();
  const k = k1 === undefined ? k0 : interpolate(f, [0, Math.max(1, sec(dur - hold))], [k0, k1], { ...clamp, ...(ease === 'out' ? { easing: EASE_OUT } : {}) });
  const z = interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) + f * 0.0006;
  const w = box.w * scale, h = box.h * scale;
  const left = (1080 - w) / 2;
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: `540px ${top + h * 0.45}px` }}>
        {note ? <div style={{ position: 'absolute', left: Math.max(X, left + 24), top: top - 52, fontFamily: KO, fontWeight: 600, fontSize: 30, color: '#9a9a9a', letterSpacing: -0.4 }}>{note}</div> : null}
        <div style={{ position: 'absolute', left, top, width: w, height: h, overflow: 'hidden', borderRadius: 26 }}>
          <Img src={frameSrc(dir, pre, k)} style={{ position: 'absolute', left: -box.x * scale, top: -box.y * scale, width: 1080 * scale, height: 2341 * scale, maxWidth: 'none', filter: 'brightness(1.12)' }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 답 전체 한 장(1080×6430)을 위아래로 움직인다 — lit은 그 줄 밖을 어둡게 누른다(화면 결 ⑥)
export const FULL_H = 6430;
// 답 화면 바탕이 순수 검정(#000)이라 바탕도 같게 — 잘라 낸 띠의 위아래 경계가 보이지 않는다
export const FullPan: React.FC<{ y0: number; y1?: number; dur: number; h: number; top: number; note?: string; lit?: [number, number]; ease?: boolean; zoom?: number; ox?: number; oy?: number }> = ({ y0, y1, dur, h, top, note, lit, ease = true, zoom = 0, ox = 540, oy }) => {
  const f = useCurrentFrame();
  const y = y1 === undefined ? y0 : interpolate(f, [0, sec(dur)], [y0, y1], { ...clamp, ...(ease ? { easing: EASE_IO } : {}) });
  const z = interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) + f * (zoom || 0.00025);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: `${ox}px ${oy ?? top + h * 0.45}px` }}>
        {note ? <div style={{ position: 'absolute', left: X, top: top - 52, fontFamily: KO, fontWeight: 600, fontSize: 30, color: '#9a9a9a', letterSpacing: -0.4 }}>{note}</div> : null}
        <div style={{ position: 'absolute', left: 0, top, width: 1080, height: h, overflow: 'hidden' }}>
          <Img src={staticFile('img/full.jpg')} style={{ position: 'absolute', left: 0, top: -y, width: 1080, height: FULL_H, maxWidth: 'none', filter: 'brightness(1.12)' }} />
          {lit ? (
            <>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, lit[0] - y), background: 'rgba(11,11,11,0.68)' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: lit[1] - y, bottom: 0, background: 'rgba(11,11,11,0.68)' }} />
            </>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 공고문 쪽(1400×1979) — 쪽 좌표 (px, py)를 화면 (sx, sy)에 두고 s배로 본다
export const PW = 1400, PH = 1979;
export const PageCam: React.FC<{ n: number; s: number; px: number; py: number; sx: number; sy: number; lit?: [number, number]; litA?: number; shadow?: boolean }> = ({ n, s, px, py, sx, sy, lit, litA = 0, shadow = true }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: PW, height: PH, transformOrigin: '0 0', transform: `translate(${sx - px * s}px, ${sy - py * s}px) scale(${s})`, boxShadow: shadow ? '0 30px 90px rgba(0,0,0,0.6)' : undefined }}>
    <Img src={pageSrc(n)} style={{ position: 'absolute', left: 0, top: 0, width: PW, height: PH }} />
    {lit && litA > 0 ? (
      <>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: lit[0], background: `rgba(11,11,11,${litA})` }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: lit[1], bottom: 0, background: `rgba(11,11,11,${litA})` }} />
      </>
    ) : null}
  </div>
);

// 공고문을 넘긴다 — 1쪽에서 to쪽까지, 한 장에 per프레임(왼쪽 끝을 축으로 넘어간다)
export const Flip: React.FC<{ to?: number; per?: number; w?: number; top?: number }> = ({ to = 9, per = 4, w = 900, top = 650 }) => {
  const f = useCurrentFrame();
  const s = w / PW;
  const left = (1080 - w) / 2;
  const i = Math.min(to - 1, Math.floor(f / per));
  const p = i >= to - 1 ? 0 : (f - i * per) / per;
  const cur = i + 1, nxt = Math.min(to, i + 2);
  const page = (n: number) => <Img src={pageSrc(n)} style={{ position: 'absolute', left: 0, top: 0, width: w, height: PH * s }} />;
  return (
    <AbsoluteFill style={{ background: '#0b0b0b', perspective: 2600 }}>
      <div style={{ position: 'absolute', left, top, width: w, height: PH * s, boxShadow: '0 30px 90px rgba(0,0,0,0.6)' }}>{page(nxt)}</div>
      {cur !== nxt ? (
        <div style={{ position: 'absolute', left, top, width: w, height: PH * s, transformOrigin: '0% 50%', transform: `rotateY(${-p * 112}deg)`, backfaceVisibility: 'hidden' }}>
          {page(cur)}
          <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${p * 0.5})` }} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
