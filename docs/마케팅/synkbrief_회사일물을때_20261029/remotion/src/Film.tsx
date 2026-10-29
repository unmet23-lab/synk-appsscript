// 본편(48.8초): 흰 종이 무대 위에서 여덟 장면을 배경음 박에 착지시킨다. 장면 사이는 위로 밀기 하나(원본과 같은 부품).
// 소리: 배경음 「밝은_052」(처음부터, 끝 1초 줄임) + 사건마다 효과음 하나 + 내레이션(범수). 말하는 동안 배경음을 낮춘다.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile } from 'remotion';
import { Paper, Push, Whip } from './parts';
import { End08, Extra06, Hook01, Myth02, Q1, Q2, Q3, Sum07 } from './scenes';
import { at, E, Key, land, ORDER, seq, TOTAL } from './time';
import PLACE from './vo-place.json';

export { TOTAL };

type Hit = { at: number; src: string; v: number };
const abs = (k: Key, local: number) => seq(k).from + local;

const HITS: Hit[] = [
  { at: 22, src: 'sfx/tick.wav', v: 0.28 },
  ...(['myth', 'q1', 'q2', 'q3', 'extra', 'sum', 'end'] as const).map((k) => ({ at: seq(k).from + 2, src: 'sfx/swish.wav', v: 0.45 })),
  { at: abs('myth', at('myth', E.mythNo)), src: 'sfx/snap.wav', v: 0.36 },
  { at: abs('myth', at('myth', E.mythZoom)), src: 'sfx/thud.wav', v: 0.42 },
  { at: abs('q1', land('q1')), src: 'sfx/pop.wav', v: 0.3 },
  { at: abs('q1', at('q1', E.q1Temp)), src: 'sfx/tok.wav', v: 0.3 },
  { at: abs('q1', at('q1', E.q1Pill) + 6), src: 'sfx/pop.wav', v: 0.32 },
  { at: abs('q2', land('q2')), src: 'sfx/pop.wav', v: 0.3 },
  { at: abs('q2', at('q2', E.q2Path)), src: 'sfx/tok.wav', v: 0.3 },
  { at: abs('q2', at('q2', E.q2Zoom)), src: 'sfx/tick.wav', v: 0.3 },
  { at: abs('q3', land('q3')), src: 'sfx/pop.wav', v: 0.3 },
  { at: abs('q3', at('q3', E.q3Hi)), src: 'sfx/tick.wav', v: 0.3 },
  { at: abs('extra', at('extra', E.exRing)), src: 'sfx/tick.wav', v: 0.3 },
  { at: abs('extra', at('extra', E.exDoc)), src: 'sfx/tok.wav', v: 0.3 },
  { at: abs('extra', at('extra', E.exStamp)), src: 'sfx/thud.wav', v: 0.46 },
  { at: abs('sum', land('sum') + 2), src: 'sfx/pop.wav', v: 0.32 },
  { at: abs('sum', at('sum', E.sum2)), src: 'sfx/pop.wav', v: 0.32 },
  { at: abs('sum', at('sum', E.sum3)), src: 'sfx/pop.wav', v: 0.32 },
  { at: abs('end', at('end', E.endLine)), src: 'sfx/earn.wav', v: 0.3 },
];

const SCENES: { k: Key; el: React.ReactNode }[] = [
  { k: 'hook', el: <Hook01 /> },
  { k: 'myth', el: <Myth02 /> },
  { k: 'q1', el: <Q1 /> },
  { k: 'q2', el: <Q2 /> },
  { k: 'q3', el: <Q3 /> },
  { k: 'extra', el: <Extra06 /> },
  { k: 'sum', el: <Sum07 /> },
  { k: 'end', el: <End08 /> },
];

// 배경음 크기: 말 없는 곳 0.42, 말 아래 0.14. 전체 0.8배 — scripts/finish.mjs가 리미터와 함께 되올린다.
const BGM_OPEN = 0.42;
const BGM_UNDER = 0.14;
const SFX_UNDER = 0.7;
const MASTER = 0.8;
type Clip = { id: string; at: number; speechEnd: number; end: number };
const CLIPS = PLACE as unknown as Clip[];
const windows = CLIPS.reduce<[number, number][]>((w, c) => {
  const last = w[w.length - 1];
  if (last && c.at - last[1] <= 30) last[1] = c.speechEnd;
  else w.push([c.at, c.speechEnd]);
  return w;
}, []);
const duck = (fr: number) => Math.max(0, ...windows.map(([a, e]) => interpolate(fr, [a - 6, a, e, e + 10], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));

export const Film: React.FC = () => {
  const bgm = (fr: number) => MASTER * (BGM_OPEN - (BGM_OPEN - BGM_UNDER) * duck(fr)) * interpolate(fr, [TOTAL - 36, TOTAL - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <Audio src={staticFile('bgm.mp3')} volume={bgm} />
      <AbsoluteFill>
        <Paper total={TOTAL} />
        {SCENES.map(({ k, el }, i) => {
          const s = seq(k);
          return (
            <Sequence key={k} from={s.from} durationInFrames={s.len}>
              <Whip len={s.len} noIn={i === 0} noOut={k === ORDER[ORDER.length - 1]}>
                <Push still={k === 'end' ? TOTAL - 18 - s.from : undefined}>{el}</Push>
              </Whip>
            </Sequence>
          );
        })}
      </AbsoluteFill>
      {CLIPS.map((c) => (
        <Sequence key={c.id} from={c.at} durationInFrames={c.end - c.at + 2} layout="none">
          <Audio src={staticFile(`vo/${c.id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {HITS.map((h, i) => (
        <Sequence key={i} from={h.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(h.src)} volume={MASTER * h.v * (1 - (1 - SFX_UNDER) * duck(h.at))} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
