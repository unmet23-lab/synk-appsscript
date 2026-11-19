// 한 장면 먼저(제목 · 이름표 · 설명 말 없이) — 해 질 녘 네 벌이 구운 시각과 함께 놓이고, 노란 테가 거꾸로 훑어 와 맨 처음 벌에 앉는다.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { STAGE } from './data';
import { Sunset, SunsetTimes } from './Sunset';

export const HERO_LEN = 6.0;
const H: SunsetTimes = { put: [0.15, 0.75, 1.35, 1.95], scan: 2.7, hop: 0.36, land: 3.78 };
const SFX = [
  { f: 'tok', at: 0.15 },
  { f: 'tok', at: 0.75 },
  { f: 'tok', at: 1.35 },
  { f: 'tok', at: 1.95 },
  { f: 'tick', at: 2.7 },
  { f: 'tick', at: 3.06 },
  { f: 'tick', at: 3.42 },
  { f: 'thud', at: 3.78 },
];

export const HeroScene: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <AbsoluteFill style={{ background: `radial-gradient(110% 60% at 50% 50%, #221C15 0%, ${STAGE} 70%)` }} />
      <AbsoluteFill style={{ transform: `translateY(-120px) scale(${1 + 0.03 * (t / HERO_LEN)})` }}>
        <Sunset t={t} h={H} big />
      </AbsoluteFill>
      {SFX.map((x, i) => (
        <Sequence key={i} from={Math.round(x.at * 30)}>
          <Audio src={staticFile(`sfx/${x.f}.wav`)} volume={x.f === 'thud' ? 0.85 : 0.5} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
