// 홀 위의 큰 셈 — 방문 → 로봇 → 사람. 숫자는 data.ts의 기록 값.
import React from 'react';
import { interpolate } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, OUT } from '../lib/motion';
import { BUTTER, INK, ROBOT, TOTAL_VISITS } from './data';

const fmt = (n: number) => n.toLocaleString('en-US');

/** mode: visits(차오르는 방문) · robots(로봇 셈) · humans(사람 17). */
export const BigCount: React.FC<{
  label: string;
  value: number;
  color: string;
  sub?: string;
  top?: number;
  size?: number;
  o?: number;
  pop?: number;
}> = ({ label, value, color, sub, top = 300, size = 200, o = 1, pop = 0 }) => (
  <div style={{ position: 'absolute', left: 74, top, width: 932, opacity: o, fontFamily: KO }}>
    <div style={{ fontWeight: 800, fontSize: 64, letterSpacing: -1.5, color: color === ROBOT ? '#9EA1AA' : color }}>{label}</div>
    <div style={{ fontWeight: 900, fontSize: size, lineHeight: 1.0, letterSpacing: -6, color, transform: `scale(${1 + 0.06 * pop})`, transformOrigin: '0% 60%', fontVariantNumeric: 'tabular-nums' }}>
      {fmt(value)}
      <span style={{ fontSize: size * 0.42, letterSpacing: -2, marginLeft: 10 }}>번</span>
    </div>
    {sub && <div style={{ fontWeight: 700, fontSize: 42, color: '#B9BBC2', marginTop: 8, letterSpacing: -0.8 }}>{sub}</div>}
  </div>
);

export const countUp = (t: number, a: number, b: number, to = TOTAL_VISITS) => Math.round(interpolate(t, [a, b], [0, to], { ...clamp, easing: OUT }));

export { BUTTER, INK, ROBOT };
