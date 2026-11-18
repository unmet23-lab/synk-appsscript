// 방문 홀 — 한 점(사람 그림)이 방문 한 번. 1,039개가 원근으로 선 홀을 버터 스캔 띠가 위에서 아래로 훑으면
// 지나간 줄은 로봇 그림(회색)으로 바뀌고, 사람 17만 남아 노랗게 빛난다. 모든 값은 프레임의 함수다.
import React from 'react';
import { interpolate } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, IN_OUT, OUT } from '../lib/motion';
import { BUTTER, FIGS, HALL_BOTTOM, HALL_TOP, INK, ROBOT, ROWS as ROWS_N, rowY } from './data';

/** 그림 크기 — 장면 심사(11-18) 「휴대폰에서 점처럼 보인다」로 키움. */
const FIG = 1.22;

export type HallTimes = {
  fillA: number; // 사람 그림이 차오르기 시작(초)
  fillB: number; // 다 참
  sweepA: number; // 띠가 맨 위에서 출발
  sweepB: number; // 맨 아래 도착
  glow?: number; // 사람 17이 노랗게
  meAt?: number; // 「아마 나」 10에 테두리
  bandIn?: number; // 띠가 출발 전 맨 위에 서는 초(r8 · 6.8초 박자)
  qAt?: number; // 남은 사람 자리 위에 노란 「?」(r8 · 끝)
};

/** 스캔 띠가 지금 닿은 y. */
export const sweepY = (t: number, h: HallTimes) =>
  interpolate(t, [h.sweepA, h.sweepB], [HALL_TOP - 30, HALL_BOTTOM + 10], { ...clamp, easing: IN_OUT });

/** 띠가 이 줄을 지난 초. */
const flipT = (y: number, h: HallTimes) => {
  const p = (y - (HALL_TOP - 30)) / (HALL_BOTTOM + 10 - (HALL_TOP - 30));
  // IN_OUT의 거꾸로를 대략 이분법으로.
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 18; k++) {
    const m = (lo + hi) / 2;
    if (IN_OUT(m) < p) lo = m;
    else hi = m;
  }
  return h.sweepA + (h.sweepB - h.sweepA) * lo;
};

/** 지금까지 로봇으로 바뀐 수. */
export const robotsSoFar = (t: number, h: HallTimes) => {
  const y = sweepY(t, h);
  let n = 0;
  for (const f of FIGS) if (!f.human && f.y <= y) n++;
  return n;
};

/** 끝 홀(「여러분 홈페이지」)의 남는 자리 — 우리 17과 다른 자리 · 다른 수(답은 보는 사람 몫이라 숫자를 세지 않는다). */
export const END_HUMANS: Set<number> = (() => {
  let seed = 2211;
  const pick = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const chosen: { r: number; c: number; i: number }[] = [];
  let guard = 0;
  while (chosen.length < 7 && guard++ < 5000) {
    const r = 6 + Math.floor(pick() * 25);
    const c = 3 + Math.floor(pick() * (31 - 6));
    const f = FIGS.find((g) => g.r === r && g.c === c);
    if (!f) continue;
    if (chosen.some((g) => Math.abs(g.r - r) <= 3 && Math.abs(g.c - c) <= 5)) continue;
    chosen.push({ r, c, i: f.i });
  }
  return new Set(chosen.map((g) => g.i));
})();

const Human: React.FC<{ x: number; y: number; s: number; fill: string; o: number; k: number }> = ({ x, y, s, fill, o, k }) => (
  <g opacity={o} transform={`translate(${x} ${y}) scale(${s}) scale(1 ${k})`}>
    <circle cx={0} cy={-19} r={5.6} fill={fill} />
    <path d="M-8 -2 Q-8 -11 0 -11 Q8 -11 8 -2 L8 6 L-8 6 Z" fill={fill} />
  </g>
);

const Robot: React.FC<{ x: number; y: number; s: number; o: number; k: number }> = ({ x, y, s, o, k }) => (
  <g opacity={o} transform={`translate(${x} ${y}) scale(${s}) scale(1 ${k})`}>
    <rect x={-1} y={-30} width={2} height={5} fill={ROBOT} />
    <rect x={-6} y={-25} width={12} height={10} rx={1.5} fill={ROBOT} />
    <rect x={-8} y={-12} width={16} height={18} rx={1} fill={ROBOT} />
  </g>
);

export const Hall: React.FC<{ t: number; h: HallTimes; showBand?: boolean; dimHumans?: number; humans?: Set<number> }> = ({ t, h, showBand = true, dimHumans = 0, humans }) => {
  // bandIn이 있으면 띠가 그 초에 위에서 떨어져 출발선에 선다(6.8초 박자).
  const drop = h.bandIn !== undefined && t < h.sweepA ? -110 * (1 - interpolate(t, [h.bandIn, h.bandIn + 0.28], [0, 1], { ...clamp, easing: OUT })) : 0;
  const by = sweepY(t, h) + drop;
  const bandStart = h.bandIn === undefined ? h.sweepA - 0.3 : h.bandIn;
  const bandOn = showBand && t >= bandStart && t <= h.sweepB + 0.25;
  const bandO =
    h.bandIn === undefined
      ? interpolate(t, [h.sweepA - 0.3, h.sweepA, h.sweepB, h.sweepB + 0.25], [0, 1, 1, 0], clamp)
      : interpolate(t, [h.bandIn, h.bandIn + 0.15, h.sweepB, h.sweepB + 0.25], [0, 1, 1, 0], clamp);
  const glow = h.glow === undefined ? 0 : interpolate(t, [h.glow, h.glow + 0.35], [0, 1], clamp);
  const me = h.meAt === undefined ? 0 : interpolate(t, [h.meAt, h.meAt + 0.3], [0, 1], clamp);
  const q = h.qAt === undefined ? 0 : interpolate(t, [h.qAt, h.qAt + 0.22], [0, 1], clamp);
  const isHuman = (f: { i: number; human: boolean }) => (humans ? humans.has(f.i) : f.human);
  const n = FIGS.length;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
      <defs>
        <radialGradient id="g66" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BUTTER} stopOpacity={0.55} />
          <stop offset="100%" stopColor={BUTTER} stopOpacity={0} />
        </radialGradient>
        <linearGradient id="band66" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BUTTER} stopOpacity={0} />
          <stop offset="80%" stopColor={BUTTER} stopOpacity={0.28} />
          <stop offset="100%" stopColor={BUTTER} stopOpacity={0.9} />
        </linearGradient>
      </defs>
      {/* 바닥 줄 — 홀의 깊이 */}
      {rowY.map((y, r) => (r % 3 === 0 ? <line key={r} x1={60} x2={1020} y1={y + 9} y2={y + 9} stroke="#1B1D22" strokeWidth={1} /> : null))}
      {glow > 0 &&
        FIGS.filter(isHuman).map((f) => <circle key={`g${f.i}`} cx={f.x} cy={f.y - 10 * f.s} r={34 * f.s * (0.7 + 0.3 * glow) * (1 + 0.7 * q)} fill="url(#g66)" opacity={glow} />)}
      {FIGS.map((f0) => {
        // 띠가 출발하기 전(본편 3.2~7.9초): 위에서 아래로 물결이 1.4초마다 홀을 지나간다 — 「사람인지, 로봇인지」 살피는 동안 군중이 멈춰 보이지 않게(r8).
        const preOn = h.bandIn !== undefined && t > h.fillB + 0.2 && t < h.sweepA ? 1 : 0;
        const ph = ((t - h.fillB) / 1.4 - f0.r / ROWS_N) % 1;
        const ripple = preOn * 9 * f0.s * Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 6);
        const f = { ...f0, x: f0.x + 2.2 * f0.s * Math.sin(t * 1.9 + f0.i * 1.37), y: f0.y + 6 * f0.s * Math.sin(t * 3.1 + f0.i * 0.83) - ripple };
        // 차오름: 줄마다 순서대로 톡.
        const at = h.fillA + (h.fillB - h.fillA) * (f.i / n);
        const pop = interpolate(t, [at, at + 0.12], [0, 1], clamp);
        if (pop <= 0) return null;
        const k0 = 0.4 + 0.6 * pop;
        if (isHuman(f0)) {
          const fill = glow > 0 ? (glow >= 1 ? BUTTER : glow > 0.5 ? BUTTER : INK) : INK;
          const o = pop * (1 - dimHumans * 0.75);
          // 끝 홀: 「?」가 뜨면 남은 자리가 1.5배로 커진다 — 끝 그림이 가장 세게(r8).
          const grow = 1 + 0.5 * q;
          // 띠가 지나간 뒤 남은 사람은 두리번거리듯 들썩이고(r8 최종본 검사 「구간굳음」 10.5초~), h.glow 0.8초 전에 흰 테가 한 번 퍼진다.
          const ft0 = flipT(f0.y, h);
          const alive = t > ft0 ? Math.min(1, (t - ft0) / 0.3) : 0;
          const bob = alive * 7 * f.s * Math.abs(Math.sin(t * 6.2 + f.i * 0.9));
          const ringP = h.glow === undefined ? 0 : interpolate(t, [h.glow - 0.8, h.glow - 0.2], [0, 1], clamp);
          return (
            <g key={f.i}>
              {ringP > 0 && ringP < 1 && <circle cx={f.x} cy={f.y - 10 * f.s} r={(14 + 40 * ringP) * f.s} fill="none" stroke={INK} strokeWidth={3} opacity={0.8 * (1 - ringP)} />}
              <Human x={f.x} y={f.y - bob} s={f.s * FIG * grow} fill={fill} o={o} k={k0} />
              {f.me && me > 0 && <circle cx={f.x} cy={f.y - 10 * f.s} r={19 * f.s} fill="none" stroke={INK} strokeWidth={3.6} strokeDasharray="5 4" opacity={me} />}
              {q > 0 && (
                <text
                  x={f.x}
                  y={f.y - 44 * f.s * FIG * grow - 10 * (1 - q)}
                  textAnchor="middle"
                  fontFamily={KO}
                  fontWeight={900}
                  fontSize={84 * f.s * FIG * (0.6 + 0.4 * q)}
                  fill={BUTTER}
                  opacity={q}
                >
                  ?
                </text>
              )}
            </g>
          );
        }
        const ft = flipT(f.y, h);
        const p = interpolate(t, [ft, ft + 0.14], [0, 1], clamp);
        const squash = p > 0 && p < 1 ? 1 - 0.35 * Math.sin(Math.PI * p) : 1;
        return (
          <g key={f.i}>
            {p < 1 && <Human x={f.x} y={f.y} s={f.s * FIG} fill={INK} o={pop * (1 - p)} k={k0 * squash} />}
            {p > 0 && <Robot x={f.x} y={f.y} s={f.s * FIG} o={p} k={squash} />}
          </g>
        );
      })}
      {bandOn && (
        <g opacity={bandO}>
          <rect x={0} y={by - 120} width={1080} height={120} fill="url(#band66)" />
          <rect x={0} y={by - 3} width={1080} height={6} fill={BUTTER} />
        </g>
      )}
    </svg>
  );
};
