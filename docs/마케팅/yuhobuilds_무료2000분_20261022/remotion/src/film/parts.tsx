// 작은 부품: 마스크 낱말, 커서, 숫자 바퀴. 모두 프레임으로만 움직인다.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { EN } from '../lib/fonts';
import { clamp, IN, mixColor, OUT, prog } from '../lib/motion';

export const STAGE = '#0A0A0A';
export const INK = '#F4F2EC';
export const DIM = '#8C8A84';
export const BUTTER = '#F5C445';

/**
 * 마스크 낱말: 글자 칸 안에서 아래에서 올라와 착지하고, 나갈 때는 위로 빠진다.
 * 크기·흐림·투명도는 건드리지 않는다(가장자리가 늘 선명한 Linear식 등장).
 */
export const Word: React.FC<{ at: number; out?: number; outLen?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, out, outLen = 8, children, style }) => {
  const f = useCurrentFrame();
  const pin = prog(f, at, 11, OUT);
  const pout = out === undefined ? 0 : prog(f, out, outLen, IN);
  const y = (1 - pin) * 112 - pout * 112;
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', padding: '0.08em 0.02em 0.18em', margin: '-0.08em -0.02em -0.18em' }}>
      <span style={{ display: 'inline-block', transform: `translateY(${y}%)`, ...style }}>{children}</span>
    </span>
  );
};

/** 커서(검은 화살표 + 흰 테두리)와 누를 때 퍼지는 고리. press: 0~1, ring: 0~1(고리 진행). */
export const Cursor: React.FC<{ x: number; y: number; press: number; ring: number; opacity: number }> = ({ x, y, press, ring, opacity }) => (
  <div style={{ position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none' }}>
    {ring > 0 && ring < 1 ? (
      <div
        style={{
          position: 'absolute',
          left: 4 - 10 - 46 * ring,
          top: 4 - 10 - 46 * ring,
          width: 20 + 92 * ring,
          height: 20 + 92 * ring,
          borderRadius: '50%',
          border: '3px solid rgba(17,17,17,0.5)',
          opacity: 1 - ring,
        }}
      />
    ) : null}
    <svg
      width={52}
      height={68}
      viewBox="0 0 26 34"
      style={{ overflow: 'visible', transform: `scale(${1 - 0.16 * press})`, transformOrigin: '3px 3px', filter: 'drop-shadow(0 5px 8px rgba(0,0,0,0.3))' }}
    >
      <path d="M2 2 L2 26.5 L8 21.2 L12.2 30.8 L16.3 29 L12.2 19.6 L20.2 19.6 Z" fill="#111" stroke="#fff" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  </div>
);

/** 숫자 바퀴의 위치(실제 주행 거리계처럼 아래 바퀴가 9 → 0으로 넘어갈 때만 윗바퀴가 돈다). */
const wheelPos = (v: number, p: number) => {
  if (p === 0) return v;
  const base = Math.pow(10, p);
  const lower = v % base;
  return Math.floor(v / base) + (lower > base - 1 ? lower - (base - 1) : 0);
};

/**
 * 숫자 바퀴. value는 소수도 받는다(돌아가는 중). 빨리 돌수록 세로로 흐려진다.
 * 아직 닿지 않은 윗자리는 흐린 0으로 둬서 폭이 흔들리지 않는다.
 */
export const Odometer: React.FC<{
  value: number;
  prev: number;
  digits: number;
  size: number;
  color: string;
  comma?: boolean;
  weight?: number;
  /** 아직 닿지 않은 윗자리 색(검정 무대 위의 짙은 회색). 없으면 처음부터 같은 색. */
  dim?: string;
}> = ({ value, prev, digits, size, color, comma = false, weight = 700, dim }) => {
  const H = size * 0.94;
  const W = size * 0.6;
  const tone = (from: number) => (dim ? mixColor(dim, color, interpolate(value, [from - 1, from], [0, 1], clamp)) : color);
  const cells: React.ReactNode[] = [];
  for (let p = digits - 1; p >= 0; p--) {
    const pos = wheelPos(value, p);
    const speed = Math.abs(pos - wheelPos(prev, p));
    const blur = Math.min(14, speed * 5);
    const shift = (pos % 10) * H;
    cells.push(
      <span key={`d${p}`} style={{ display: 'inline-block', width: W, height: H, overflow: 'hidden', position: 'relative', color: p === 0 ? color : tone(Math.pow(10, p)) }}>
        <span style={{ position: 'absolute', left: 0, top: 0, width: W, transform: `translateY(${-shift}px)`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => (
            <span key={i} style={{ display: 'block', height: H, lineHeight: `${H}px`, textAlign: 'center' }}>
              {d}
            </span>
          ))}
        </span>
      </span>,
    );
    if (comma && p === 3) {
      cells.push(
        <span key="comma" style={{ display: 'inline-block', width: size * 0.26, height: H, lineHeight: `${H}px`, textAlign: 'center', color: tone(1000) }}>
          ,
        </span>,
      );
    }
  }
  return (
    <span style={{ display: 'inline-flex', fontFamily: EN, fontWeight: weight, fontSize: size, color, letterSpacing: 0, fontFeatureSettings: '"tnum" 1' }}>{cells}</span>
  );
};
