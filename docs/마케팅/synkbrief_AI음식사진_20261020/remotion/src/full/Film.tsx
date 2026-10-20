// 본편(41.9초): 청금석 무대 하나 위에서 아홉 장면을 배경음 박에 착지시킨다. 장면 사이는 위로 밀기 하나(지난 편과 같은 부품).
// 소리: 배경음(본편 0~80박 + 곡 끝맺음) + 사건마다 효과음 하나 + 내레이션(범수, 10-20). 말하는 동안 배경음을 낮추고 효과음도 조금 줄인다.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile } from 'remotion';
import { beat } from '../lib/beat';
import { Stage, Whip } from '../v5/cine';
import { After06, Check07, checkT, End09, Fact02, Fix08, Guest03, Hook01, LINE_IN, PROMPT_LINES, Prompt05, Turn04 } from './scenes';
import { at, CUT, Key, seq, T, TAIL, TOTAL } from './time';
import PLACE from './vo-place.json';

export { TOTAL };

type Hit = { at: number; src: string; v: number };
const abs = (k: Key, local: number) => seq(k).from + local;

const hits = (variant: 'A' | 'B'): Hit[] => {
  const ck = checkT(variant);
  return [
    ...(variant === 'A' ? [{ at: beat(1), src: 'sfx/swish.wav', v: 0.28 }] : []),
    { at: at('hook', 3), src: 'sfx/snap.wav', v: 0.42 },
    ...(['fact', 'guest', 'turn', 'prompt', 'after', 'check', 'fix', 'end'] as const).map((k) => ({ at: seq(k).from + 2, src: 'sfx/swish.wav', v: 0.5 })),
    { at: abs('fact', at('fact', 11)), src: 'sfx/snap.wav', v: 0.4 },
    { at: abs('guest', at('guest', 17)), src: 'sfx/thud.wav', v: 0.45 },
    { at: abs('turn', at('turn', 26)), src: 'sfx/snap.wav', v: 0.42 },
    ...PROMPT_LINES.map((_, i) => ({ at: abs('prompt', LINE_IN(i) + 2), src: 'sfx/tick.wav', v: 0.22 })),
    { at: abs('prompt', at('prompt', 32)), src: 'sfx/snap.wav', v: 0.36 },
    { at: abs('after', T + 26), src: 'sfx/snap.wav', v: 0.42 },
    { at: abs('after', at('after', 43.5)), src: 'sfx/pop.wav', v: 0.3 },
    { at: abs('after', at('after', 44.5)), src: 'sfx/pop.wav', v: 0.3 },
    ...[4, 8, 12].map((d) => ({ at: abs('check', T + d), src: 'sfx/tok.wav', v: 0.3 })),
    { at: abs('check', ck.qtyMark), src: 'sfx/pop.wav', v: 0.34 },
    { at: abs('check', ck.ingMark), src: 'sfx/pop.wav', v: 0.34 },
    { at: abs('check', ck.redMark), src: 'sfx/thud.wav', v: 0.55 },
    { at: abs('fix', T + 8), src: 'sfx/tick.wav', v: 0.32 },
    { at: abs('fix', T + 30), src: 'sfx/snap.wav', v: 0.42 },
    { at: abs('fix', T + 50), src: 'sfx/earn.wav', v: 0.38 },
    { at: abs('end', at('end', 77)), src: 'sfx/pop.wav', v: 0.32 },
    { at: CUT, src: 'sfx/tok.wav', v: 0.55 },
  ];
};

const SCENES: { k: Key; el: (variant: 'A' | 'B') => React.ReactNode }[] = [
  { k: 'hook', el: (v) => <Hook01 variant={v} /> },
  { k: 'fact', el: () => <Fact02 /> },
  { k: 'guest', el: () => <Guest03 /> },
  { k: 'turn', el: () => <Turn04 /> },
  { k: 'prompt', el: () => <Prompt05 /> },
  { k: 'after', el: () => <After06 /> },
  { k: 'check', el: (v) => <Check07 variant={v} /> },
  { k: 'fix', el: () => <Fix08 /> },
  { k: 'end', el: (v) => <End09 variant={v} /> },
];

// 배경음 크기: 말 없는 곳 0.42, 말 아래 0.16(지난 편 값). 전체 0.8배(16비트 합산 잘림 방지) — scripts/finish.mjs가 리미터와 함께 되올린다.
const BGM_OPEN = 0.42;
const BGM_UNDER = 0.16;
const SFX_UNDER = 0.7;
const MASTER = 0.8;
type Clip = { id: string; at: number; speechEnd: number; end: number };
const windows = (clips: Clip[]) =>
  clips.reduce<[number, number][]>((w, c) => {
    const last = w[w.length - 1];
    if (last && c.at - last[1] <= 30) last[1] = c.speechEnd;
    else w.push([c.at, c.speechEnd]);
    return w;
  }, []);
const ducker = (clips: Clip[]) => {
  const w = windows(clips);
  return (fr: number) => Math.max(0, ...w.map(([a, e]) => interpolate(fr, [a - 6, a, e, e + 10], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
};

export const FullFilm: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const clips: Clip[] = (PLACE as unknown as Record<string, Clip[]>)[variant] || [];
  const duck = ducker(clips);
  const bgm = (fr: number) => MASTER * (BGM_OPEN - (BGM_OPEN - BGM_UNDER) * duck(fr));
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={CUT} layout="none">
        <Audio src={staticFile('bgm.mp3')} volume={(fr) => bgm(fr) * interpolate(fr, [CUT - 2, CUT], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      </Sequence>
      <Sequence from={CUT} durationInFrames={TOTAL - CUT} layout="none">
        <Audio src={staticFile('bgm.mp3')} trimBefore={TAIL.songFrame} volume={(fr) => bgm(CUT + fr) * interpolate(fr, [0, 1, TOTAL - CUT - 10, TOTAL - CUT], [0.4, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      </Sequence>
      <AbsoluteFill>
        <Stage total={TOTAL} />
        {SCENES.map(({ k, el }, i) => {
          const s = seq(k);
          return (
            <Sequence key={k} from={s.from} durationInFrames={s.len}>
              <Whip len={s.len} noIn={i === 0} noOut={k === 'end'}>
                {el(variant)}
              </Whip>
            </Sequence>
          );
        })}
      </AbsoluteFill>
      {clips.map((c) => (
        <Sequence key={c.id} from={c.at} durationInFrames={c.end - c.at + 2} layout="none">
          <Audio src={staticFile(`vo/${c.id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {hits(variant).map((h, i) => (
        <Sequence key={i} from={h.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(h.src)} volume={MASTER * h.v * (1 - (1 - SFX_UNDER) * duck(h.at))} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
