// v5 모션 시험판(약 12초): 청금석 무대 하나 위에서 훅 → 지금 확인 → 급한 것만 맨 위에. 장면 사이는 위로 휙 넘기는 전환,
// 흐림은 전환에만 넣는다(카메라 모션 블러는 숫자가 바뀌는 순간 앞 글자를 겹쳐 남겨서 뺐다). 소리는 배경음 + 키트 효과음(내레이션은 아직).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Sequence, staticFile } from 'remotion';
import { ATT, ATT_START, CHECK_START, CHK, END, HOOK } from '../timeline';
import { Attention5 } from './Attention5';
import { Check5 } from './Check5';
import { Stage, Whip } from './cine';
import { Hook5 } from './Hook5';

export const TOTAL5 = END;

type Hit = { at: number; src: string; v: number };
const HITS: Hit[] = [
  ...HOOK.rows.map((r) => ({ at: r, src: 'sfx/tick.wav', v: 0.28 })),
  { at: HOOK.mark, src: 'sfx/snap.wav', v: 0.45 },
  { at: CHECK_START + 2, src: 'sfx/swish.wav', v: 0.55 },
  { at: CHECK_START + CHK.click, src: 'sfx/tok.wav', v: 0.7 },
  ...CHK.done.slice(0, 5).map((d) => ({ at: CHECK_START + d, src: 'sfx/pop.wav', v: 0.32 })),
  { at: CHECK_START + CHK.done[5], src: 'sfx/earn.wav', v: 0.45 },
  { at: ATT_START + 2, src: 'sfx/swish.wav', v: 0.55 },
  ...ATT.chips.map((c) => ({ at: ATT_START + c, src: 'sfx/pop.wav', v: 0.32 })),
  { at: ATT_START + ATT.pop, src: 'sfx/thud.wav', v: 0.55 },
  { at: ATT_START + ATT.circle, src: 'sfx/snap.wav', v: 0.42 },
];

export const Film5: React.FC = () => (
  <AbsoluteFill>
    <Audio src={staticFile('bgm.mp3')} volume={(fr) => 0.5 * Math.min(1, (END - fr) / 15)} />
    <AbsoluteFill>
        <Stage total={END} />
        <Sequence from={0} durationInFrames={HOOK.len}>
          <Whip len={HOOK.len} noIn>
            <Hook5 />
          </Whip>
        </Sequence>
        <Sequence from={CHECK_START} durationInFrames={CHK.len}>
          <Whip len={CHK.len}>
            <Check5 />
          </Whip>
        </Sequence>
        <Sequence from={ATT_START} durationInFrames={ATT.len}>
          <Whip len={ATT.len} noOut>
            <Attention5 />
          </Whip>
        </Sequence>
    </AbsoluteFill>
    {HITS.map((h, i) => (
      <Sequence key={i} from={h.at} durationInFrames={60} layout="none">
        <Audio src={staticFile(h.src)} volume={h.v} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
