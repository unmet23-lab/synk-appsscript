// 핵심 장면 먼저(11-12) — 같은 파일 두 벌이 짝으로 함께 켜지고(701.9GB) → 커서가 한 번 누르면 한 벌씩만 빠지고 → 남은 칸이 내려앉아 두 드라이브가 빈다.
// 숫자는 11-07 실제 정리 기록 그대로(data.ts REAL).
// v2: v1 장면 심사 「첫 1초 회색 격자만 가만 · 무슨 화면인지 모름 · 끝 노란 띠가 헷갈림 · 결과로 뒤집어라」 → 처음부터 훑기, 드라이브마다 여유 숫자(실제), 끝은 「비운 자리」로, 남김 띠는 이 장면에서 뺌.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, prog } from '../lib/motion';
import { BUTTER, C_TOP, D_TOP, Drives, PANEL_W, PANEL_X } from './Drives';
import { REAL } from './data';

const F = (s: number) => Math.round(s * 30);
export const HERO_LEN = F(5.6);
export const HB = { scan: [F(0.15), F(2.0)] as const, click: F(2.75), del: F(2.85), delLen: F(1.0), settle: F(3.9), settleLen: F(0.75), keep: F(9) };

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const Cursor: React.FC<{ x: number; y: number; press: number; o?: number }> = ({ x, y, press, o = 1 }) => (
  <svg width={64} height={64} viewBox="0 0 24 24" style={{ position: 'absolute', left: x, top: y, opacity: o, transform: `scale(${1 - 0.14 * press})`, transformOrigin: '2px 2px', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.55))' }}>
    <path d="M2 1.5 L2 19.5 L6.6 15.3 L9.6 22 L12.6 20.7 L9.7 14.2 L16 14.2 Z" fill="#FFFFFF" stroke="#0A0A0A" strokeWidth={1.3} strokeLinejoin="round" />
  </svg>
);

/** 드라이브 이름과 실제 여유 — settle(0~1)에 따라 지우기 전 → 뒤. */
export const DriveLabels: React.FC<{ settle: number; o?: number }> = ({ settle, o = 1 }) => {
  const row = (top: number, name: string, a: number, b: number) => (
    <div style={{ position: 'absolute', left: PANEL_X - 6, width: PANEL_W + 12, top: top - 66, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: KO, opacity: o }}>
      <span style={{ fontWeight: 800, fontSize: 46, color: '#FFFFFF', letterSpacing: -1 }}>{name}</span>
      <span style={{ fontWeight: 600, fontSize: 38, color: 'rgba(255,255,255,0.72)', letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>
        여유 <span style={{ fontWeight: 800, color: settle > 0.02 ? BUTTER : '#FFFFFF' }}>{fmt(a + (b - a) * settle)}GB</span>
      </span>
    </div>
  );
  return (
    <>
      {row(C_TOP, '1TB', REAL.cFreeBefore, REAL.cFreeAfter)}
      {row(D_TOP, '2TB', REAL.dFreeBefore, REAL.dFreeAfter)}
    </>
  );
};

export const HeroScene: React.FC = () => {
  const f = useCurrentFrame();
  const scanP = interpolate(f, [HB.scan[0], HB.scan[1]], [0, 1], clamp);
  const found = fmt(Math.round(REAL.total * scanP * 10) / 10);
  const push = interpolate(f, [0, HERO_LEN], [1, 1.045], clamp);
  const enter = prog(f, F(2.05), F(0.6));
  const cx = interpolate(enter, [0, 1], [1060, 610]);
  const cy = interpolate(enter, [0, 1], [1500, 880]);
  const press = f >= HB.click && f < HB.click + 5 ? 1 : 0;
  const cursorOut = 1 - prog(f, HB.del + F(0.6), F(0.3));
  const settle = interpolate(f, [HB.settle, HB.settle + HB.settleLen], [0, 1], clamp);
  const flip = f >= HB.settle;
  return (
    <AbsoluteFill style={{ background: '#0A0B0E' }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '50% 52%' }}>
        <Drives beat={{ scan: HB.scan, del: HB.del, delLen: HB.delLen, settle: HB.settle, settleLen: HB.settleLen, keep: HB.keep }} />
        <DriveLabels settle={settle} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 74, right: 74, top: 284, fontFamily: KO, fontWeight: 800, fontSize: 60, letterSpacing: -1.5, color: '#FFFFFF' }}>{flip ? '비운 자리' : '같은 파일 두 벌'}</div>
      <div style={{ position: 'absolute', left: 70, top: 352, fontFamily: KO, fontWeight: 900, fontSize: 150, lineHeight: 1, letterSpacing: -6, color: BUTTER, fontVariantNumeric: 'tabular-nums' }}>
        {flip ? fmt(REAL.total) : found}
        <span style={{ fontSize: 70, letterSpacing: -1, marginLeft: 8 }}>GB</span>
      </div>
      {f >= F(2.0) ? <Cursor x={cx} y={cy} press={press} o={cursorOut} /> : null}
      <Sequence from={HB.scan[0]} durationInFrames={HB.scan[1] - HB.scan[0]}>
        {Array.from({ length: 9 }, (_, i) => (
          <Sequence key={i} from={i * 6}>
            <Audio src={staticFile('sfx/tick2.wav')} volume={0.35 + 0.04 * i} />
          </Sequence>
        ))}
      </Sequence>
      <Sequence from={HB.click}>
        <Audio src={staticFile('sfx/tok.wav')} volume={1} />
      </Sequence>
      <Sequence from={HB.del + 2}>
        <Audio src={staticFile('sfx/swish.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={HB.settle + F(0.55)}>
        <Audio src={staticFile('sfx/thud.wav')} volume={0.8} />
      </Sequence>
    </AbsoluteFill>
  );
};
