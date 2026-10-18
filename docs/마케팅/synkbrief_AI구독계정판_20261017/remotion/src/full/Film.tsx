// 본편(약 45.8초): 청금석 무대 하나 위에서 11장면을 배경음 박에 착지시킨다. 장면 사이는 위로 밀기 하나.
// 소리: 배경음(본편 0~88박 + 곡 끝맺음 108박부터) + 사건마다 효과음 하나. 내레이션은 장면 확인 뒤에 얹는다.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile } from 'remotion';
import { beat } from '../lib/beat';
import { Attention5 } from '../v5/Attention5';
import { Check5 } from '../v5/Check5';
import { Stage, Whip } from '../v5/cine';
import { Hook5 } from '../v5/Hook5';
import { HOOK } from '../timeline';
import { Before02, BEFORE_HITS } from './Before02';
import { Benefit03 } from './Benefit03';
import { End11 } from './End11';
import { Guide10 } from './Guide10';
import { LIGHT, Official09 } from './Official09';
import { Reset07 } from './Reset07';
import { Spare06 } from './Spare06';
import { at, B, CUT, seq, T, TAIL, TOTAL } from './time';
import { Week08 } from './Week08';

export { TOTAL };

// 지금 확인·급한 것: 시험판(Fable 승인 v5d)과 같은 박 간격을 본편 박에 옮긴다
const CHK_FULL = { click: at('check', 23), done: [25, 26, 27, 28, 29, 30].map((b) => at('check', b)), len: seq('check').len };
const ATT_FULL = { chips: [10, 20], pop: at('attention', 34), back: at('attention', 36.5), circle: at('attention', 37) };

type Hit = { at: number; src: string; v: number };
const abs = (k: Parameters<typeof seq>[0], local: number) => seq(k).from + local;
const HITS: Hit[] = [
  ...HOOK.rows.map((r) => ({ at: r, src: 'sfx/tick.wav', v: 0.28 })),
  { at: HOOK.mark, src: 'sfx/snap.wav', v: 0.45 },
  ...(['before', 'benefit', 'check', 'attention', 'spare', 'reset', 'week', 'official', 'guide', 'end'] as const).map((k) => ({ at: seq(k).from + 2, src: 'sfx/swish.wav', v: 0.5 })),
  ...BEFORE_HITS.map((h) => ({ ...h, at: abs('before', h.at) })),
  { at: abs('benefit', at('benefit', 18)), src: 'sfx/snap.wav', v: 0.42 },
  { at: abs('check', CHK_FULL.click), src: 'sfx/tok.wav', v: 0.7 },
  ...CHK_FULL.done.slice(0, 5).map((d) => ({ at: abs('check', d), src: 'sfx/pop.wav', v: 0.32 })),
  { at: abs('check', CHK_FULL.done[5]), src: 'sfx/earn.wav', v: 0.45 },
  ...ATT_FULL.chips.map((c) => ({ at: abs('attention', c), src: 'sfx/pop.wav', v: 0.32 })),
  { at: abs('attention', ATT_FULL.pop), src: 'sfx/thud.wav', v: 0.55 },
  { at: abs('attention', ATT_FULL.circle), src: 'sfx/snap.wav', v: 0.42 },
  { at: abs('spare', at('spare', 42)), src: 'sfx/snap.wav', v: 0.42 },
  { at: abs('reset', at('reset', 47.5)), src: 'sfx/tick.wav', v: 0.4 },
  { at: abs('reset', at('reset', 50)), src: 'sfx/snap.wav', v: 0.42 },
  { at: abs('week', at('week', 54.5)), src: 'sfx/pop.wav', v: 0.32 },
  { at: abs('week', at('week', 55)), src: 'sfx/pop.wav', v: 0.32 },
  { at: abs('official', at('official', 62.5)), src: 'sfx/snap.wav', v: 0.42 },
  ...LIGHT.map((b) => ({ at: abs('official', at('official', b)), src: 'sfx/tick.wav', v: 0.32 })),
  { at: abs('guide', at('guide', 73)), src: 'sfx/tick.wav', v: 0.4 },
  { at: abs('guide', at('guide', 76)), src: 'sfx/snap.wav', v: 0.42 },
  { at: abs('end', at('end', 80.5)), src: 'sfx/earn.wav', v: 0.4 },
  { at: abs('end', at('end', 84)), src: 'sfx/pop.wav', v: 0.32 },
  { at: CUT, src: 'sfx/tok.wav', v: 0.55 },
];

const SCENES: { k: Parameters<typeof seq>[0]; el: (variant: 'A' | 'B') => React.ReactNode }[] = [
  { k: 'hook', el: (v) => <Hook5 variant={v} /> },
  { k: 'before', el: () => <Before02 /> },
  { k: 'benefit', el: () => <Benefit03 /> },
  { k: 'check', el: () => <Check5 t={CHK_FULL} /> },
  { k: 'attention', el: () => <Attention5 t={ATT_FULL} /> },
  { k: 'spare', el: () => <Spare06 /> },
  { k: 'reset', el: () => <Reset07 /> },
  { k: 'week', el: () => <Week08 /> },
  { k: 'official', el: () => <Official09 /> },
  { k: 'guide', el: () => <Guide10 /> },
  { k: 'end', el: () => <End11 /> },
];

const SONG_TAIL_FROM = TAIL.songFrame; // 곡 끝맺음 첫 타격(53.0초) — time.ts TAIL

export const FullFilm: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => (
  <AbsoluteFill>
    {/* 배경음: 본편 0~88박, 이어서 곡의 끝맺음. 잇는 자리는 1~2프레임만 줄였다 키워 딸깍 소리를 막는다. */}
    <Sequence from={0} durationInFrames={CUT} layout="none">
      <Audio src={staticFile('bgm.mp3')} volume={(fr) => 0.5 * interpolate(fr, [CUT - 2, CUT], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
    </Sequence>
    <Sequence from={CUT} durationInFrames={TOTAL - CUT} layout="none">
      <Audio src={staticFile('bgm.mp3')} trimBefore={SONG_TAIL_FROM} volume={(fr) => 0.5 * interpolate(fr, [0, 1, TOTAL - CUT - 10, TOTAL - CUT], [0.4, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
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
    {HITS.map((h, i) => (
      <Sequence key={i} from={h.at} durationInFrames={60} layout="none">
        <Audio src={staticFile(h.src)} volume={h.v} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

// 확인용: 장면 착지 프레임(영상 기준)
export const LANDINGS = Object.fromEntries(Object.entries(B).map(([k, b]) => [k, beat(b)]));
export { T };
