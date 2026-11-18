// 한 장면 먼저(글 · 말 없이, 숫자와 「로봇 · 사람」 이름표만) — 1,039가 차오르고, 띠가 훑자 로봇 1,022, 사람 17만 남아 빛난다.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { clamp, IN_OUT } from '../lib/motion';
import { BigCount, countUp } from './Counter';
import { BUTTER, HUMANS, INK, ROBOT, STAGE } from './data';
import { Hall, HallTimes, robotsSoFar } from './Hall';

export const HERO_LEN = 6.0;
const H: HallTimes = { fillA: 0.0, fillB: 0.9, sweepA: 1.25, sweepB: 4.35, glow: 4.45 };

export const HeroScene: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const push = interpolate(t, [4.45, 6.0], [0, 1], { ...clamp, easing: IN_OUT });
  const robots = robotsSoFar(t, H);
  const phase = t < 1.1 ? 'v' : t < 4.5 ? 'r' : 'h';
  const pop = t >= 4.45 ? Math.max(0, 1 - (t - 4.45) / 0.3) : 0;
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <AbsoluteFill style={{ transform: `scale(${1 + 0.16 * push}) translateY(${-60 * push}px)`, transformOrigin: '50% 57%' }}>
        <Hall t={t} h={H} />
      </AbsoluteFill>
      {phase === 'v' && <BigCount label="방문" value={countUp(t, 0, 0.9)} color={INK} />}
      {phase === 'r' && <BigCount label="로봇" value={robots} color={ROBOT} />}
      {phase === 'h' && <BigCount label="사람" value={HUMANS} color={BUTTER} pop={pop} />}
      <Sequence from={Math.round(1.2 * 30)}>
        <Audio src={staticFile('sfx/swish.wav')} volume={0.7} />
      </Sequence>
      {[1.9, 2.6, 3.3, 4.0].map((s) => (
        <Sequence key={s} from={Math.round(s * 30)}>
          <Audio src={staticFile('sfx/tick.wav')} volume={0.45} />
        </Sequence>
      ))}
      <Sequence from={Math.round(4.45 * 30)}>
        <Audio src={staticFile('sfx/thud.wav')} volume={0.9} />
      </Sequence>
    </AbsoluteFill>
  );
};
