// 정답을 그림으로 한 번 더: 선이 그어지는 순서대로 드러나는 선화(@remotion/paths evolvePath).
import { evolvePath } from '@remotion/paths';
import React from 'react';
import { interpolate } from 'remotion';
import { C } from './theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const STROKE = 7;

/** t: 0→1 그리기 진행. at: 이 선이 시작하는 t, len: 걸리는 t. */
const Line: React.FC<{ d: string; t: number; at?: number; len?: number; color?: string; width?: number; fill?: string }> = ({
  d,
  t,
  at = 0,
  len = 0.5,
  color = C.ink,
  width = STROKE,
  fill,
}) => {
  const p = interpolate(t, [at, at + len], [0, 1], clamp);
  if (p <= 0) return null;
  const { strokeDasharray, strokeDashoffset } = evolvePath(p, d);
  return (
    <>
      {fill ? <path d={d} fill={fill} opacity={interpolate(p, [0.7, 1], [0, 1], clamp)} /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
    </>
  );
};

const circle = (cx: number, cy: number, r: number) => `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;

/** 손이 크다: 그릇 위로 만두가 산처럼 쌓인다. */
const Bowl: React.FC<{ t: number }> = ({ t }) => {
  const dumplings: [number, number][] = [
    [140, 150], [195, 146], [250, 146], [305, 150],
    [168, 106], [223, 100], [278, 106],
    [196, 62], [251, 60],
    [224, 22],
  ];
  return (
    <>
      <Line d="M 70 168 L 380 168 C 370 236 316 270 225 270 C 134 270 80 236 70 168 Z" t={t} at={0} len={0.35} fill={C.card} />
      {dumplings.map(([x, y], i) => (
        <Line key={i} d={circle(x, y, 27)} t={t} at={0.25 + i * 0.05} len={0.2} fill={i === 9 ? C.accent : C.card} color={C.ink} width={6} />
      ))}
      <Line d="M 370 40 C 386 22 386 4 400 -12" t={t} at={0.8} len={0.2} color={C.accent} width={6} />
      <Line d="M 395 70 C 412 52 414 34 428 20" t={t} at={0.85} len={0.15} color={C.accent} width={6} />
    </>
  );
};

/** 발이 넓다: 가운데 사람(코랄)에서 여섯 사람으로 선이 이어진다. */
const Network: React.FC<{ t: number }> = ({ t }) => {
  const cx = 225;
  const cy = 130;
  const nodes: [number, number][] = [
    [80, 60], [225, 10], [370, 60], [400, 190], [225, 250], [50, 190],
  ];
  return (
    <>
      {nodes.map(([x, y], i) => (
        <Line key={`l${i}`} d={`M ${cx} ${cy} L ${x} ${y}`} t={t} at={0.08 + i * 0.07} len={0.25} color={C.ink} width={5} />
      ))}
      <Line d={`M 80 60 L 225 10 L 370 60`} t={t} at={0.65} len={0.2} color={C.hair} width={4} />
      <Line d={`M 400 190 L 225 250 L 50 190`} t={t} at={0.7} len={0.2} color={C.hair} width={4} />
      {nodes.map(([x, y], i) => (
        <Line key={`n${i}`} d={circle(x, y, 20)} t={t} at={0.25 + i * 0.07} len={0.15} fill={C.card} width={6} />
      ))}
      <Line d={circle(cx, cy, 34)} t={t} at={0} len={0.2} fill={C.accent} width={6} />
    </>
  );
};

/** 눈이 높다: 기준선 위로 눈이 올라간다. */
const Eye: React.FC<{ t: number }> = ({ t }) => {
  const rise = interpolate(t, [0.35, 0.85], [110, -20], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  return (
    <>
      <Line d="M 10 190 L 440 190" t={t} at={0} len={0.3} color={C.hair} width={6} />
      <g transform={`translate(0 ${rise})`}>
        <Line d="M 60 120 C 140 30 310 30 390 120 C 310 210 140 210 60 120 Z" t={t} at={0.1} len={0.35} fill={C.card} />
        <Line d={circle(225, 120, 40)} t={t} at={0.4} len={0.2} fill={C.accent} width={6} />
      </g>
      <Line d="M 432 150 L 432 20 M 404 50 L 432 20 L 460 50" t={t} at={0.7} len={0.3} color={C.accent} width={7} />
    </>
  );
};

export const Art: React.FC<{ kind: 'bowl' | 'network' | 'eye'; t: number; style?: React.CSSProperties }> = ({ kind, t, style }) => (
  <svg viewBox="0 -30 450 310" style={{ overflow: 'visible', ...style }}>
    {kind === 'bowl' ? <Bowl t={t} /> : kind === 'network' ? <Network t={t} /> : <Eye t={t} />}
  </svg>
);

/** 체크·엑스 표시(선이 그어짐). */
export const Check: React.FC<{ p: number; color: string; size: number }> = ({ p, color, size }) => {
  const d = 'M 14 52 L 40 76 L 90 22';
  if (p <= 0) return null;
  const { strokeDasharray, strokeDashoffset } = evolvePath(Math.min(1, p), d);
  return (
    <svg viewBox="0 0 104 96" width={size} height={(size * 96) / 104}>
      <path d={d} fill="none" stroke={color} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
    </svg>
  );
};
