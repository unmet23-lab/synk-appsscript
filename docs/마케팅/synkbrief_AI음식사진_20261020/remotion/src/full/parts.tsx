// 이 편의 부품: 사진 카드(도장·닦아 넘기기), 인용 카드, 요청문 카드, 체크 표시, 색 칩.
// 무대·글자·밑줄·밀기는 지난 편 v5/cine.tsx 그대로 쓴다.
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_OUT } from '../lib/anim';
import { C, F } from '../theme';
import { settle } from '../v5/cine';

export const IMG = {
  before: staticFile('img/before.jpg'),
  after1: staticFile('img/after1.jpg'),
  after2: staticFile('img/after2.jpg'),
  ai: staticFile('img/ai.jpg'),
};

/** 사진 출처 도장 글(화면 아래 작은 글) */
export const CREDIT = '사진: Theodore Nguyen / Pexels';

/** 판 위 도장: 어두운 알약(기본) · 코랄(AI 생성 경고) · 흰(AI로 다듬음) */
export const Stamp: React.FC<{ children: React.ReactNode; tone?: 'dark' | 'ai' | 'light'; style?: React.CSSProperties; size?: number }> = ({ children, tone = 'dark', style, size = 24 }) => {
  const tones = {
    dark: { background: 'rgba(8,10,16,.72)', color: '#fff', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.22)' },
    ai: { background: C.crayon, color: '#fff', boxShadow: '0 6px 16px -8px rgba(0,0,0,.5)' },
    light: { background: 'rgba(255,255,255,.92)', color: C.ink, boxShadow: '0 6px 16px -8px rgba(0,0,0,.4)' },
  } as const;
  return (
    <span style={{ position: 'absolute', zIndex: 3, padding: '8px 14px', borderRadius: 10, font: `700 ${size}px/1.15 ${F.ko}`, letterSpacing: '-.02em', whiteSpace: 'nowrap', ...tones[tone], ...style }}>
      {children}
    </span>
  );
};

/** 사진 판: 3:2 사진 한 장을 둥근 판에. wipe(0~1)를 주면 under 위에 src가 왼쪽부터 덮인다(경계에 흰 선). */
export const Photo: React.FC<{
  src: string;
  w: number;
  x: number;
  y: number;
  under?: string;
  wipe?: number;
  split?: number; // 0~1: 왼쪽은 under, 오른쪽은 src (훅 반반 카드)
  radius?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ src, w, x, y, under, wipe, split, radius = 30, children, style }) => {
  const h = Math.round((w * 2) / 3);
  const edge = under !== undefined && wipe !== undefined ? wipe : under !== undefined && split !== undefined ? split : undefined;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: radius,
        overflow: 'hidden',
        background: '#0c0e13',
        boxShadow: '0 1px 0 rgba(255,255,255,.08) inset,0 0 0 1px rgba(255,255,255,.08),0 50px 90px -40px rgba(4,12,36,.75),0 18px 40px -24px rgba(4,12,36,.6)',
        ...style,
      }}
    >
      {under !== undefined ? <Img src={under} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      <Img
        src={src}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          clipPath: edge !== undefined ? (split !== undefined ? `inset(0 0 0 ${edge * 100}%)` : `inset(0 ${(1 - edge) * 100}% 0 0)`) : undefined,
        }}
      />
      {edge !== undefined && edge > 0.001 && edge < 0.999 ? (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${edge * 100}% - 2px)`, width: 4, background: '#fff', boxShadow: '0 0 18px rgba(0,0,0,.45)' }}>
          {split !== undefined ? (
            <span style={{ position: 'absolute', top: '50%', left: 2, translate: '-50% -50%', width: 46, height: 46, borderRadius: '50%', background: '#fff', boxShadow: '0 6px 16px rgba(0,0,0,.35)', display: 'grid', placeItems: 'center', font: `800 22px/1 ${F.ko}`, color: C.ink }}>
              ↔
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
};

/** 흰 인용 카드: 큰따옴표 글 + 출처 줄. 강조 부분은 노란 형광 밑칠이 왼쪽부터. */
export const Quote: React.FC<{ x: number; y: number; w: number; size?: number; parts: { t: string; em?: boolean }[]; who: string; p: number; markP: number }> = ({ x, y, w, size = 40, parts, who, p, markP }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      padding: '34px 38px 30px',
      borderRadius: 28,
      background: '#fff',
      color: C.ink,
      boxShadow: '0 30px 60px -30px rgba(4,12,36,.7)',
      opacity: interpolate(p, [0, 0.4], [0, 1], clamp),
      translate: `0 ${(1 - p) * 40}px`,
    }}
  >
    <div style={{ font: `700 ${size}px/1.42 ${F.ko}`, letterSpacing: '-.035em' }}>
      “
      {parts.map((s, i) =>
        s.em ? (
          <span key={i} style={{ backgroundImage: `linear-gradient(${C.mark},${C.mark})`, backgroundRepeat: 'no-repeat', backgroundSize: `${markP * 100}% 42%`, backgroundPosition: '0 88%' }}>
            {s.t}
          </span>
        ) : (
          <span key={i}>{s.t}</span>
        ),
      )}
      ”
    </div>
    <div style={{ marginTop: 18, font: `500 26px/1.3 ${F.ko}`, color: C.muted, letterSpacing: '-.01em' }}>{who}</div>
  </div>
);

/** 체크(✓) 또는 엑스(✗) 동그라미: at에 튀어나온다. */
export const Mark: React.FC<{ ok: boolean; at: number; size?: number; style?: React.CSSProperties }> = ({ ok, at, size = 64, style }) => {
  const f = useCurrentFrame();
  const s = settle(f, at, 18);
  if (f < at) return null;
  return (
    <span
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        background: ok ? '#2fae6b' : C.crayon,
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        font: `900 ${size * 0.56}px/1 ${F.ko}`,
        scale: String(interpolate(s, [0, 1], [0.4, 1], clamp) * (1 + 0.18 * Math.sin(Math.min(1, (f - at) / 8) * Math.PI))),
        opacity: interpolate(s, [0, 0.3], [0, 1], clamp),
        boxShadow: '0 10px 24px -10px rgba(0,0,0,.5)',
        ...style,
      }}
    >
      {ok ? '✓' : '✗'}
    </span>
  );
};

/** 색 칩: 둥근 네모에 색 + 아래 이름 */
export const Chip: React.FC<{ color: string; label: string; size?: number; dim?: boolean }> = ({ color, label, size = 92, dim }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: dim ? 0.55 : 1 }}>
    <span style={{ width: size, height: size, borderRadius: 22, background: color, boxShadow: 'inset 0 0 0 3px rgba(255,255,255,.55),0 10px 22px -12px rgba(0,0,0,.5)' }} />
    <span style={{ font: `600 24px/1.1 ${F.ko}`, color: C.ink, letterSpacing: '-.02em' }}>{label}</span>
  </div>
);

/** 요청문 줄이 하나씩 타자되듯 나타난다(글자 수에 비례). 줄마다 [시작 프레임]. */
export const typed = (f: number, start: number, text: string, cps = 30) => {
  const n = Math.max(0, Math.floor(((f - start) / 30) * cps));
  return Array.from(text).slice(0, n).join('');
};

export const fadeUp = (f: number, a: number, dist = 26) => {
  const s = settle(f, a, 15);
  return { opacity: interpolate(s, [0, 0.45], [0, 1], clamp), translate: `0 ${(1 - s) * dist}px` } as const;
};

export const ease = (f: number, a: number, len: number) => interpolate(f, [a, a + len], [0, 1], { ...clamp, easing: EASE_OUT });
