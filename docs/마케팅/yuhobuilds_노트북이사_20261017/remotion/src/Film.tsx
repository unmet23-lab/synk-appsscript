// 필름 전체: 무대 하나 위에 장면 열 개를 위로 밀어 넘기기로 잇고, 목소리·배경음·효과음을 얹는다.
// 훅 A(인스타)·C(유튜브)는 첫 줄 목소리(take_C.wav)와 훅 화면만 다르고 나머지는 같다.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Sequence, staticFile } from 'remotion';
import { Stage, Whip } from './lib/cine';
import { S1, S10, S2, S3, S4, S5, S6, S7, S8, S9 } from './scenes';
import { fr, ORDER, SceneId, seqLen, seqStart, TOTAL, VO, VOICE_AT } from './t';

const SCENES: Record<SceneId, React.FC<{ hook: 'A' | 'C' }>> = {
  s1: S1,
  s2: S2,
  s3: S3,
  s4: S4,
  s5: S5,
  s6: S6,
  s7: S7,
  s8: S8,
  s9: S9,
  s10: S10,
};

const tok = (id: string, i: number) => fr(VO.segs[id].tokens[i]);

/** 효과음: 사건마다 하나. 시각은 낱말(VO) 또는 전환(seqStart + 착지). */
const hits = (hook: 'A' | 'C') => {
  const land = (s: SceneId) => seqStart(s) + 5;
  const h1 = hook === 'C' && VO.variants?.h1c ? VO.variants.h1c : VO.segs.h1;
  return [
    { at: 2, src: 'sfx/synk-sound-notify.wav', v: 0.7 },
    hook === 'C' ? { at: fr(h1.tokens[6]), src: 'sfx/snap.wav', v: 0.5 } : { at: fr(h1.tokens[4]) - 2, src: 'sfx/snap.wav', v: 0.5 },
    ...ORDER.slice(1).map((s) => ({ at: land(s), src: 'sfx/swish.wav', v: 0.45 })),
    { at: tok('s1', 2) - 6, src: 'sfx/earn.wav', v: 0.4 },
    { at: tok('s1', 8), src: 'sfx/tick.wav', v: 0.5 },
    { at: tok('s1', 9), src: 'sfx/pop.wav', v: 0.4 },
    { at: tok('p1', 2) - 3, src: 'sfx/thud.wav', v: 0.5 },
    { at: tok('p2', 4) - 1, src: 'sfx/tok.wav', v: 0.6 },
    { at: tok('p2', 8) - 1, src: 'sfx/pop.wav', v: 0.4 },
    { at: tok('d1', 6) - 2, src: 'sfx/snap.wav', v: 0.4 },
    { at: tok('f1', 2) - 3, src: 'sfx/thud.wav', v: 0.5 },
    { at: tok('f1', 9), src: 'sfx/tok.wav', v: 0.7 },
    { at: tok('f2', 4) - 2, src: 'sfx/snap.wav', v: 0.45 },
    { at: tok('k1', 7) - 2, src: 'sfx/earn.wav', v: 0.4 },
    { at: tok('k1', 10) - 1, src: 'sfx/pop.wav', v: 0.4 },
    { at: tok('r1', 3) - 2, src: 'sfx/pop.wav', v: 0.35 },
    { at: tok('r1', 8), src: 'sfx/synk-sound-notify.wav', v: 0.6 },
    { at: tok('t1', 3), src: 'sfx/tok.wav', v: 0.7 },
    { at: tok('t1', 4) - 3, src: 'sfx/pop.wav', v: 0.4 },
    { at: fr(VO.segs.c2.start), src: 'sfx/tok.wav', v: 0.7 },
    { at: tok('c2', 4) + 7, src: 'sfx/earn.wav', v: 0.45 },
    // 「프로필」 첫 자음을 덮지 않게 말보다 5프레임 앞, 작게(10-17 Fable)
    { at: tok('c3', 0) - 5, src: 'sfx/synk-sound-achieve.wav', v: 0.5 },
  ];
};

/** 배경음: 지난 편과 같은 곡(48초부터), 말할 때만 −9dB, 끝 1.6초 줄임. 1초보다 짧은 틈은 낮춘 채 둔다. */
const WINS = (() => {
  const w: [number, number][] = [];
  Object.values(VO.segs).forEach((g) => {
    const a = fr(g.start), b = fr(g.end);
    const last = w[w.length - 1];
    if (last && a - last[1] < 30) last[1] = Math.max(last[1], b);
    else w.push([a, b]);
  });
  return w;
})();
const DUCK = Math.pow(10, -9 / 20);
const musicVol = (f: number) => {
  let g = 1;
  for (const [a, b] of WINS) {
    if (f >= a - 5 && f <= b + 18) {
      const inA = Math.min(1, Math.max(0, (f - (a - 5)) / 5));
      const outB = f > b + 5 ? 1 - Math.min(1, (f - (b + 5)) / 13) : 1;
      g = Math.min(g, 1 - (1 - DUCK) * Math.min(inA, outB));
    }
  }
  const fade = Math.min(1, (TOTAL - f) / 48);
  return 0.5 * g * fade;
};

export const Film: React.FC<{ hook: 'A' | 'C' }> = ({ hook }) => (
  <AbsoluteFill style={{ background: '#0a0a0a' }}>
    <Stage total={TOTAL} />
    {ORDER.map((s, i) => {
      const Scene = SCENES[s];
      return (
        <Sequence key={s} from={seqStart(s)} durationInFrames={seqLen(s)}>
          <Whip len={seqLen(s)} noIn={i === 0} noOut={i === ORDER.length - 1}>
            <Scene hook={hook} />
          </Whip>
        </Sequence>
      );
    })}
    <Sequence from={fr(VOICE_AT)} layout="none">
      <Audio src={staticFile(hook === 'C' ? 'voice/take_C.wav' : 'voice/take.wav')} />
    </Sequence>
    <Audio src={staticFile('sfx/bgm_citypop147.m4a')} trimBefore={48 * 30} volume={musicVol} />
    {hits(hook).map((h, i) => (
      <Sequence key={i} from={Math.max(0, h.at)} durationInFrames={60} layout="none">
        <Audio src={staticFile(h.src)} volume={h.v} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
