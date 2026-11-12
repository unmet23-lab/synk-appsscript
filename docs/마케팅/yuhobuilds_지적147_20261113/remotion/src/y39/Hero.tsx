// 핵심 장면 먼저 — 가장 높은 더미(「AI 템플릿 같다」)에 서른여덟 번째 쪽지가 떨어져 얹히고 더미가 한 번 눌린다. 숫자는 data.ts.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, prog } from '../lib/motion';
import { TALL } from './Film';
import { INK, NEVER, NOTE, PILE, TL, WALL_BG, World, countIn } from './World';

const F = (s: number) => Math.round(s * 30);
export const HERO_LEN = F(5.0);
const HT: TL = { enter: -200, sort: -400, sortLen: 40, rep: F(0.1), repLen: F(1.7), last: F(3.0), pale: NEVER, merge: NEVER, collapse: NEVER, cards: NEVER };

export const HeroScene: React.FC = () => {
  const f = useCurrentFrame();
  const push = interpolate(f, [0, HERO_LEN], [1, 1.06], clamp);
  const n = countIn(0, f, HT);
  const pop = Math.max(0, 1 - Math.abs(f - HT.last - 3) / 5);
  return (
    <AbsoluteFill style={{ background: WALL_BG }}>
      <AbsoluteFill style={{ background: 'radial-gradient(120% 80% at 50% 45%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 55%, rgba(120,100,60,0.16) 100%)' }} />
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '30% 55%' }}>
        <AbsoluteFill style={{ transform: `translate(${TALL.tx}px, ${TALL.ty}px) scale(${TALL.s})`, transformOrigin: '0 0' }}>
          <div style={{ position: 'absolute', left: 40, right: 40, top: PILE.base + 4, height: 3, background: INK, opacity: 0.85 }} />
          <World tl={HT} />
        </AbsoluteFill>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 318, top: 640, fontFamily: KO, color: INK }}>
        <div style={{ fontWeight: 800, fontSize: 84, letterSpacing: -2.4, opacity: prog(f, F(0.5), 8) }}>「AI 템플릿 같다」</div>
        <div style={{ fontWeight: 900, fontSize: 230, lineHeight: 1.02, letterSpacing: -9, fontVariantNumeric: 'tabular-nums', transform: `scale(${1 + 0.16 * pop})`, transformOrigin: '10% 60%' }}>
          <span style={{ boxShadow: `inset 0 -0.22em 0 ${NOTE}` }}>{n}</span>
          <span style={{ fontSize: 92, letterSpacing: -2, marginLeft: 10 }}>번</span>
        </div>
      </div>
      {Array.from({ length: 14 }, (_, i) => (
        <Sequence key={i} from={F(0.15) + i * 4}>
          <Audio src={staticFile(i % 2 ? 'sfx/tick.wav' : 'sfx/tick2.wav')} volume={0.3 + 0.02 * i} />
        </Sequence>
      ))}
      <Sequence from={HT.last - 14}>
        <Audio src={staticFile('sfx/swish.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={HT.last}>
        <Audio src={staticFile('sfx/tok.wav')} volume={1} />
      </Sequence>
      <Sequence from={HT.last + 1}>
        <Audio src={staticFile('sfx/thud.wav')} volume={0.7} />
      </Sequence>
    </AbsoluteFill>
  );
};
