// 핵심 장면(10-31) — 편을 짜기 전에 맥락 없는 심사관에게 보일 6초. 무너짐 0.9초는 실제로 옮긴 데 걸린 시간 그대로.
// v2: v1 심사 「도표로 보임 · 누구의 무엇인지 모름 · 끝의 6.7이 뭔지 모름」 → 칸을 실제 폴더 꼴로, 판돈(AI의 판정 · 멈춘 프로그램)과 끝 낱말을 넣었다.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, prog } from '../lib/motion';
import { AMBER, GREEN, RED, Wall } from './Wall';

const F = (s: number) => Math.round(s * 30);
export const HERO_LEN = F(6.6);
const FALL = F(0.6);
const NIGHT = F(1.55);
const BACK = [F(2.7), F(3.9), F(4.55)] as const;
const LONE = F(4.75);

export const Big: React.FC<{ n: string; unit?: string; color: string; size?: number; y?: number; o?: number }> = ({ n, unit = 'GB', color, size = 250, y = 270, o = 1 }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: -8, color, opacity: o, fontVariantNumeric: 'tabular-nums' }}>
    {n}
    <span style={{ fontSize: size * 0.42, letterSpacing: -2, marginLeft: 10 }}>{unit}</span>
  </div>
);

export const Line: React.FC<{ text: string; color?: string; size?: number; y?: number; o?: number }> = ({ text, color = '#FFFFFF', size = 74, y = 158, o = 1 }) => (
  <div style={{ position: 'absolute', left: 40, right: 40, top: y, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.15, letterSpacing: -2, color, opacity: o }}>{text}</div>
);

export const HeroScene: React.FC = () => {
  const f = useCurrentFrame();
  const drop = prog(f, FALL, 27);
  const back0 = interpolate(f, [BACK[0], BACK[0] + 34], [0, 37.1], clamp);
  const back1 = interpolate(f, [BACK[1], BACK[1] + 18], [0, 9.2], clamp);
  return (
    <AbsoluteFill style={{ background: '#08090C' }}>
      <Wall beat={{ fall: FALL, back: BACK, shake: 0, ghost: [NIGHT, BACK[0]], lone: LONE }} scan={[0, FALL]} />
      {f < NIGHT ? (
        <>
          <Line text="AI: 전부 쓰레기입니다" />
          <Big n={Math.round(53 * (1 - drop)).toString()} color={AMBER} />
        </>
      ) : null}
      {f >= NIGHT && f < BACK[0] ? (
        <>
          <Line text="그날 밤" />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 150, letterSpacing: -5, color: RED }}>프로그램 멈춤</div>
        </>
      ) : null}
      {f >= BACK[0] && f < LONE ? (
        <>
          <Line text="쓰레기가 아니었다" />
          <Big n={Math.round(back0 + back1).toString()} color={GREEN} />
        </>
      ) : null}
      {f >= LONE ? (
        <>
          <Line text="진짜 쓰레기는" />
          <Big n="6.7" color={AMBER} />
        </>
      ) : null}
      <Audio src={staticFile('sfx/벽_장면.wav')} volume={0.8} />
    </AbsoluteFill>
  );
};
