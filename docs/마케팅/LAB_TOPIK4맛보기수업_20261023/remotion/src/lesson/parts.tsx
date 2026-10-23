// 판 부품 — 책상, 흰 수업 판, 선생님의 코랄 펜(밑줄·동그라미·✗·✓·번호), 기호 칩, 몽골어 자막, 코랄 포스터.
// 전부 프레임의 함수라 어느 프레임을 뽑아도 같다(CSS 애니메이션·타이머 없음).
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { KO, MN, MONO } from '../lib/fonts';
import { prog } from '../lib/motion';
import { BOARD, CORAL, CORAL_DEEP, CORAL_SOFT, DESK, INK3, PAPER, SUB_TOP, TEXT, TEXT2, TEXT3, W } from './tokens';

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const Desk: React.FC = () => (
  <AbsoluteFill style={{ background: DESK }}>
    <AbsoluteFill style={{ background: 'radial-gradient(80% 70% at 30% -10%, rgba(255,255,255,.075), transparent 60%)' }} />
  </AbsoluteFill>
);

/** 위 띠: 왼쪽 영문 라벨, 오른쪽 장면 이름(한국어 · 몽골어)과 차례. */
export const TopBar: React.FC<{ no: string; ko: string; mn: string; o?: number }> = ({ no, ko, mn, o = 1 }) => (
  <div style={{ position: 'absolute', left: BOARD.x + 4, right: W - BOARD.x - BOARD.w + 4, top: 34, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: o }}>
    <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 19, letterSpacing: '.14em', color: TEXT3 }}>SYNK LAB / TOPIK II 4 · SAMPLE CLASS</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
      <span style={{ fontFamily: KO, fontWeight: 650, fontSize: 24, color: TEXT2 }}>{ko}</span>
      <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 21, color: TEXT3 }}>{mn}</span>
      <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 19, color: CORAL, letterSpacing: '.08em', marginLeft: 6 }}>{no} / 11</span>
    </div>
  </div>
);

/** 흰 수업 판. 카메라는 판 안에서만 움직인다(scale ≤ 1.12, 원점 지정). */
export const Board: React.FC<{ children?: React.ReactNode; scale?: number; ox?: number; oy?: number; o?: number }> = ({ children, scale = 1, ox = 50, oy = 50, o = 1 }) => (
  <div style={{ position: 'absolute', left: BOARD.x, top: BOARD.y, width: BOARD.w, height: BOARD.h, borderRadius: BOARD.r, background: PAPER, overflow: 'hidden', opacity: o, boxShadow: '0 30px 80px rgba(0,0,0,.45)' }}>
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${scale})`, transformOrigin: `${ox}% ${oy}%` }}>{children}</div>
  </div>
);

/** 판 안 머리말(왼쪽 위): 한국어 + 몽골어 작은 줄. */
export const BoardHead: React.FC<{ ko: string; mn?: string; x?: number; y?: number }> = ({ ko, mn, x = 64, y = 46 }) => (
  <div style={{ position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'baseline', gap: 14 }}>
    <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 26, color: CORAL_DEEP }}>{ko}</span>
    {mn ? <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 22, color: INK3 }}>{mn}</span> : null}
  </div>
);

const dash = (p: number) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - Math.max(0, Math.min(1, p)) });

/** 펜 선 하나(절대 좌표 SVG). */
export const Stroke: React.FC<{ d: string; p: number; w?: number; color?: string; box: { x: number; y: number; w: number; h: number } }> = ({ d, p, w = 6, color = CORAL, box }) =>
  p <= 0 ? null : (
    <svg style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, overflow: 'visible' }} viewBox={`0 0 ${box.w} ${box.h}`}>
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" {...dash(p)} />
    </svg>
  );

/** 펜 선을 왼쪽에서 오른쪽으로 드러낸다(굵기는 늘 같게 — 늘인 그림에서도 선 굵기가 변하지 않는다). */
const wipe = (p: number): React.CSSProperties => ({ clipPath: `inset(-20% ${(1 - Math.max(0, Math.min(1, p))) * 100}% -20% -2%)` });

/** 글 속 밑줄: 말 한 덩어리를 줄바꿈 없이 감싸고 아래에 손으로 그은 선을 그린다. */
export const U: React.FC<{ children: React.ReactNode; p: number; color?: string; w?: number; double?: boolean }> = ({ children, p, color = CORAL, w = 5, double }) => (
  <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap', lineHeight: 1.22 }}>
    {children}
    {p > 0 ? (
      <svg style={{ position: 'absolute', left: -2, bottom: '-0.2em', width: 'calc(100% + 4px)', height: '0.42em', overflow: 'visible', ...wipe(p) }} viewBox="0 0 100 10" preserveAspectRatio="none">
        <path d="M1 6 C 18 3.8, 40 7.6, 62 5.2 S 92 5.6, 99 4.6" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {double ? <path d="M3 9.6 C 25 8.2, 50 10.6, 97 8.8" fill="none" stroke={color} strokeWidth={w * 0.8} strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null}
      </svg>
    ) : null}
  </span>
);

/** 글 속 동그라미: 말을 펜으로 둘러싼다. 짧은 말(한 글자)도 동그랗게 보이도록 좌우 여백을 넉넉히. */
export const Circ: React.FC<{ children: React.ReactNode; p: number; color?: string; w?: number; pad?: number }> = ({ children, p, color = CORAL, w = 5, pad = 0.32 }) => (
  <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap', lineHeight: 1.22 }}>
    {children}
    {p > 0 ? (
      <svg style={{ position: 'absolute', left: `-${pad}em`, top: '-0.26em', width: `calc(100% + ${pad * 2}em)`, height: 'calc(100% + 0.52em)', overflow: 'visible', ...wipe(p * 1.05) }} viewBox="0 0 100 40" preserveAspectRatio="none">
        <path d="M14 5 C 42 0, 84 1, 96 13 C 104 24, 86 37, 50 38.5 C 16 40, -1 31, 3 19 C 6 10, 20 4.5, 38 3.6" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    ) : null}
  </span>
);

/** 글 위 ✗(두 획 — 앞 획이 먼저). */
export const Cross: React.FC<{ children: React.ReactNode; p: number; color?: string; w?: number }> = ({ children, p, color = CORAL, w = 7 }) => {
  const box: React.CSSProperties = { position: 'absolute', left: '-0.18em', top: '-0.1em', width: 'calc(100% + 0.36em)', height: 'calc(100% + 0.2em)', overflow: 'visible' };
  return (
    <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap', lineHeight: 1.22 }}>
      {children}
      {p > 0 ? (
        <>
          <svg style={{ ...box, ...wipe(p * 2) }} viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M3 5 L 97 36" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <svg style={{ ...box, ...wipe(p * 2 - 1) }} viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M3 36 L 97 5" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </>
      ) : null}
    </span>
  );
};

/** 화살표 「→」 — SUIT는 꺾쇠처럼 그려 Inter Tight 글리프로 쓴다. */
export const Ar: React.FC = () => <span style={{ fontFamily: MN, fontWeight: 600 }}>→</span>;

/** 손으로 그은 ✓(크기 s px). */
export const Check: React.FC<{ p: number; s?: number; color?: string; style?: React.CSSProperties }> = ({ p, s = 44, color = CORAL, style }) => (
  <svg width={s} height={s} viewBox="0 0 40 40" style={{ overflow: 'visible', ...style }}>
    <path d="M6 21 L 16 31 L 35 8" fill="none" stroke={color} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" {...dash(p)} />
  </svg>
);

/** 손으로 그은 ✗(크기 s px). */
export const XMark: React.FC<{ p: number; s?: number; color?: string; style?: React.CSSProperties }> = ({ p, s = 44, color = CORAL, style }) => (
  <svg width={s} height={s} viewBox="0 0 40 40" style={{ overflow: 'visible', ...style }}>
    <path d="M8 8 L 32 32" fill="none" stroke={color} strokeWidth={5.5} strokeLinecap="round" {...dash(p * 2)} />
    <path d="M32 8 L 8 32" fill="none" stroke={color} strokeWidth={5.5} strokeLinecap="round" {...dash(p * 2 - 1)} />
  </svg>
);

/** 펜으로 쓴 번호 ①②③(동그라미 + 숫자). */
export const Num: React.FC<{ n: number; p: number; s?: number; style?: React.CSSProperties }> = ({ n, p, s = 52, style }) => (
  <div style={{ position: 'relative', width: s, height: s, opacity: p > 0 ? 1 : 0, ...style }}>
    <svg width={s} height={s} viewBox="0 0 40 40" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <path d="M20 3 C 31 3, 37 11, 37 20 C 37 30, 29 37, 20 37 C 10 37, 3 30, 3 20 C 3 11, 9 4, 21 3.4" fill="none" stroke={CORAL} strokeWidth={3.6} strokeLinecap="round" {...dash(p * 1.3)} />
    </svg>
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: KO, fontWeight: 800, fontSize: s * 0.5, color: CORAL_DEEP, opacity: prog(p, 0.45, 0.4) }}>{n}</div>
  </div>
);

/** 첨삭 기호 칩 〔체〕 — 신청 페이지 「표시한 곳」과 같은 글. 말 끝 위에 떠서 글자 자리를 밀지 않는다. outline = 잘 쓴 곳(〔+〕). */
export const Chip: React.FC<{ code: string; p: number; outline?: boolean; size?: number; start?: boolean }> = ({ code, p, outline, size = 0.5, start }) => (
  <span style={{ position: 'relative', display: 'inline-block', width: 0, height: '1em', verticalAlign: 'baseline' }}>
    {p > 0 ? (
      <span
        style={{
          position: 'absolute',
          left: start ? '0' : '-0.5em',
          bottom: '1.02em',
          padding: '0.06em 0.4em 0.1em',
          borderRadius: 999,
          fontFamily: KO,
          fontWeight: 800,
          fontSize: `${size}em`,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          color: outline ? CORAL_DEEP : '#FFFFFF',
          background: outline ? '#FFFFFF' : CORAL,
          boxShadow: outline ? `inset 0 0 0 2.5px ${CORAL}` : 'none',
          opacity: p,
          transform: `translateY(${(1 - p) * 6}px)`,
        }}
      >
        〔{code}〕
      </span>
    ) : null}
  </span>
);

/** 한 줄씩 조용히 쓰이는 글(왼쪽에서 오른쪽으로 드러남). */
export const Reveal: React.FC<{ p: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ p, children, style }) => (
  <div style={{ clipPath: `inset(-0.4em ${(1 - Math.max(0, Math.min(1, p))) * 100}% -0.6em 0)`, opacity: p > 0 ? 1 : 0, ...style }}>{children}</div>
);

/** 몽골어 자막 — 판 아래 책상 띠, 두 줄까지. */
export const Sub: React.FC<{ text: string | null; o: number }> = ({ text, o }) =>
  text ? (
    <div style={{ position: 'absolute', left: 160, right: 160, top: SUB_TOP + 4, height: 160, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', opacity: o }}>
      <div style={{ fontFamily: MN, fontWeight: 500, fontSize: 42, lineHeight: 1.3, color: TEXT, textAlign: 'center', textWrap: 'balance', maxWidth: 1580 }}>{text}</div>
    </div>
  ) : null;

/** LAB 코랄 포스터(처음·끝). 판 자리를 덮는다. */
export const Poster: React.FC<{ children?: React.ReactNode; o?: number; clip?: number }> = ({ children, o = 1, clip = 1 }) => (
  <div style={{ position: 'absolute', left: BOARD.x, top: BOARD.y, width: BOARD.w, height: BOARD.h, borderRadius: BOARD.r, overflow: 'hidden', opacity: o, clipPath: `inset(${(1 - clip) * 100}% 0 0 0 round ${BOARD.r}px)` }}>
    <AbsoluteFill style={{ background: CORAL }} />
    <AbsoluteFill style={{ background: 'radial-gradient(110% 90% at 22% -10%, rgba(255,255,255,.18), transparent 58%), linear-gradient(180deg, transparent 55%, rgba(0,0,0,.08))' }} />
    <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.32, mixBlendMode: 'multiply' }} />
    {children}
  </div>
);

export const Art: React.FC<{ name: 'grid' | 'list' | 'cap'; style: React.CSSProperties }> = ({ name, style }) => (
  <Img src={staticFile(`art/topik4-art-${name}.webp`)} style={{ position: 'absolute', filter: 'drop-shadow(0 26px 28px rgba(0,0,0,.28)) drop-shadow(0 5px 7px rgba(0,0,0,.18))', ...style }} />
);

export const Logo: React.FC<{ style: React.CSSProperties }> = ({ style }) => <Img src={staticFile('art/logo-lab.webp')} style={{ position: 'absolute', ...style }} />;

export { CORAL_SOFT, TEXT };
