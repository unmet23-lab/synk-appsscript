// 자주 쓰는 모션 부품. 전부 useCurrentFrame()으로만 움직인다(CSS animation 없음) — 어느 프레임을 뽑아도 같다.
import { noise2D } from '@remotion/noise';
import React from 'react';
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { beat, BEAT_SEC, FIRST_BEAT_SEC, FPS } from './beat';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1); // 「expo out」 — 요즘 모션 그래픽의 기본 감속
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 구간 진행(감속 포함). */
export const ramp = (f: number, a: number, len: number, ease = EASE_OUT) => interpolate(f, [a, a + len], [0, 1], { ...clamp, easing: ease });

export const useSpring = (at: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - at, fps, config: { damping: 15, stiffness: 170, mass: 0.8, ...config } });
};

/**
 * 블러 인: 낱말(또는 글자)마다 흐림·아래에서·작게 → 또렷하게. 요즘 키네틱 타이포의 기본 등장.
 * at 프레임부터 stagger 간격으로 하나씩.
 */
export const BlurIn: React.FC<{
  text: string;
  at: number;
  by?: 'word' | 'char';
  stagger?: number;
  rise?: number;
  blur?: number;
  style?: React.CSSProperties;
  unit?: (i: number) => React.CSSProperties | undefined;
}> = ({ text, at, by = 'word', stagger = 3, rise = 40, blur = 18, style, unit }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 빈 조각을 빼야 줄이 바뀔 때 다음 줄 앞에 빈칸이 남지 않는다
  const parts = (by === 'word' ? text.split(/(\s+)/) : Array.from(text)).filter((p) => p !== '');
  let k = -1;
  return (
    <span style={{ display: 'inline', ...style }}>
      {parts.map((p, i) => {
        if (/^\s+$/.test(p)) return <span key={i}>{p}</span>;
        k += 1;
        const s = spring({ frame: f - at - k * stagger, fps, config: { damping: 18, stiffness: 140, mass: 0.7 } });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: interpolate(s, [0, 0.6], [0, 1], clamp),
              filter: `blur(${(1 - s) * blur}px)`,
              translate: `0 ${(1 - s) * rise}px`,
              scale: `${0.92 + 0.08 * s}`,
              ...unit?.(k),
            }}
          >
            {p}
          </span>
        );
      })}
    </span>
  );
};

/** 파티클 터짐(정답 순간). 씨앗이 같으면 매번 같은 모양. */
export const Burst: React.FC<{ at: number; x: number; y: number; colors: string[]; seed: string; count?: number; spread?: number; dur?: number }> = ({
  at,
  x,
  y,
  colors,
  seed,
  count = 34,
  spread = 520,
  dur = 34,
}) => {
  const f = useCurrentFrame();
  const t = (f - at) / dur;
  if (t < 0 || t > 1) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: count }, (_, i) => {
        const a = random(`${seed}a${i}`) * Math.PI * 2;
        const v = 0.35 + random(`${seed}v${i}`) * 0.65;
        const e = 1 - Math.pow(1 - t, 3);
        const d = spread * v * e;
        const g = 260 * t * t; // 떨어짐
        const size = 10 + random(`${seed}s${i}`) * 18;
        const square = random(`${seed}q${i}`) > 0.55;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + Math.cos(a) * d - size / 2,
              top: y + Math.sin(a) * d * 0.8 + g - size / 2,
              width: size,
              height: square ? size * 0.6 : size,
              borderRadius: square ? 3 : size,
              background: colors[i % colors.length],
              opacity: 1 - t * t,
              rotate: `${random(`${seed}r${i}`) * 720 * t}deg`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** 원형 진행 링(카운트다운). */
export const Ring: React.FC<{ size: number; stroke: number; progress: number; color: string; track: string; style?: React.CSSProperties }> = ({
  size,
  stroke,
  progress,
  color,
  track,
  style,
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ rotate: '-90deg', overflow: 'visible', ...style }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
        style={{ filter: `drop-shadow(0 0 18px ${color})` }}
      />
    </svg>
  );
};

/** 천천히 흐르는 오로라 배경: 빛 덩어리 셋이 노이즈 길을 따라 떠다닌다. */
export const Aurora: React.FC<{ base: string; blobs: { color: string; size: number }[]; speed?: number; seed?: string }> = ({
  base,
  blobs,
  speed = 0.006,
  seed = 'aurora',
}) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: base, overflow: 'hidden' }}>
      {blobs.map((b, i) => {
        const nx = noise2D(`${seed}x${i}`, f * speed, i * 10);
        const ny = noise2D(`${seed}y${i}`, f * speed, i * 10 + 5);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: width * (0.5 + 0.45 * nx) - b.size / 2,
              top: height * (0.5 + 0.42 * ny) - b.size / 2,
              width: b.size,
              height: b.size,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${b.color} 0%, transparent 65%)`,
              filter: 'blur(40px)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** 움직이는 필름 그레인(2프레임마다 씨앗이 바뀜). */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.09 }) => {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 2) % 97;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='${seed}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.4 -0.2'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>`;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        opacity,
        mixBlendMode: 'overlay',
        background: `url("data:image/svg+xml;utf8,${svg.replace(/#/g, '%23').replace(/"/g, "'")}") repeat`,
      }}
    />
  );
};

/** 박자 펄스: 매 박마다 1→0으로 빠르게 줄어드는 값. 화면을 음악에 맞춰 살짝 숨 쉬게 할 때. */
export const usePulse = (every = 1, decay = 7) => {
  const f = useCurrentFrame();
  const t = f / FPS - FIRST_BEAT_SEC;
  if (t < 0) return 0;
  const period = BEAT_SEC * every;
  const since = (t % period) * FPS;
  return Math.exp(-since / decay);
};

export { beat };
