// 한 장면 먼저(제목 · 설명 말 없이, 이름표 1화 · 2화 · 3화만) — 마크 세 장이 박마다 놓이고 꼭지마다 버터 테가 앉는다.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { STAGE } from './data';
import { Strips } from './Film';

export const HERO_LEN = 5.0;
const SFX = [
  { f: 'thud', at: 0.3, v: 0.55 },
  { f: 'thud', at: 0.8, v: 0.55 },
  { f: 'thud', at: 1.3, v: 0.6 },
  { f: 'tok', at: 2.0, v: 0.5 },
  { f: 'tok', at: 2.45, v: 0.5 },
  { f: 'tok', at: 2.9, v: 0.55 },
];

export const HeroScene: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <AbsoluteFill style={{ background: `radial-gradient(130% 80% at 50% 45%, #F7F4EE 0%, ${STAGE} 55%, #E2DDD3 100%)` }} />
      <AbsoluteFill style={{ transform: `translateY(-150px)` }}>
        <Strips t={t} at={[0.3, 0.8, 1.3]} rings={[2.0, 2.45, 2.9]} top={560} />
      </AbsoluteFill>
      {SFX.map((x, i) => (
        <Sequence key={i} from={Math.round(x.at * 30)}>
          <Audio src={staticFile(`sfx/${x.f}.wav`)} volume={x.v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
