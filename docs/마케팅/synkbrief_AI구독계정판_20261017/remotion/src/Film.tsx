// 모션 시험판(약 11초): 01A 훅 → 덮개 전환 → 04 지금 확인 → 실땀 전환 → 05 급한 것만 맨 위에.
// 소리는 키트 효과음만(내레이션·배경음은 시험판 확인 뒤).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_IN_OUT } from './lib/anim';
import { Attention, ATT } from './scenes/Attention';
import { Check, CHECK_T } from './scenes/Check';
import { Hook, HOOK } from './scenes/Hook';
import { C } from './theme';

const T = 12; // 전환 길이
const A0 = 0;
const B0 = HOOK.len - T; // 96
const C0 = B0 + CHECK_T.len - T; // 204
export const TOTAL = C0 + ATT.len;

/** 덮개(patch): 청금석 펠트 띠가 앞서고 흰 종이가 아래에서 덮으며 올라온다 */
const Patch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, T], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const top = (1 - p) * 100;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(${top}% 0 0 0)` }}>{children}</AbsoluteFill>
      {p < 1 ? <div style={{ position: 'absolute', left: 0, right: 0, top: `calc(${top}% - 120px)`, height: 120, background: C.field, boxShadow: '0 -10px 30px rgba(0,0,0,.18)' }} /> : null}
    </AbsoluteFill>
  );
};

/** 실땀(seam): 새 종이가 오른쪽에서 들어오고 경계를 실땀 한 줄이 따라간다 */
const Seam: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, T], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const left = (1 - p) * 100;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${left}%)` }}>{children}</AbsoluteFill>
      {p < 1 ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `calc(${left}% - 18px)`,
            width: 36,
            borderLeft: '36px solid transparent',
            borderImage: `url(${staticFile('kit/thread-lapis.webp')}) 250 / 0 0 0 36px / 0 round`,
            filter: 'drop-shadow(-6px 0 10px rgba(0,0,0,.15))',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

type Hit = { at: number; src: string; v: number };
const HITS: Hit[] = [
  { at: A0 + 0, src: 'sfx/thud.wav', v: 0.45 },
  { at: A0 + HOOK.click, src: 'sfx/tok.wav', v: 0.7 },
  ...Array.from({ length: 6 }, (_, i) => ({ at: A0 + HOOK.rows + i * HOOK.rowGap, src: 'sfx/tick.wav', v: 0.35 })),
  { at: A0 + HOOK.mark, src: 'sfx/snap.wav', v: 0.5 },
  { at: B0, src: 'sfx/swish.wav', v: 0.5 },
  { at: B0 + CHECK_T.click, src: 'sfx/tok.wav', v: 0.7 },
  ...Array.from({ length: 6 }, (_, i) => ({ at: B0 + CHECK_T.first + i * CHECK_T.gap, src: 'sfx/pop.wav', v: 0.3 })),
  { at: B0 + CHECK_T.first + 5 * CHECK_T.gap, src: 'sfx/earn.wav', v: 0.5 },
  { at: C0, src: 'sfx/swish.wav', v: 0.5 },
  ...ATT.chips.map((c) => ({ at: C0 + c, src: 'sfx/pop.wav', v: 0.35 })),
  { at: C0 + ATT.pop, src: 'sfx/thud.wav', v: 0.6 },
  { at: C0 + ATT.circle, src: 'sfx/snap.wav', v: 0.45 },
];

export const Film: React.FC = () => (
  <AbsoluteFill style={{ background: '#fff' }}>
    <Sequence from={A0} durationInFrames={HOOK.len}>
      <Hook />
    </Sequence>
    <Sequence from={B0} durationInFrames={CHECK_T.len}>
      <Patch>
        <Check />
      </Patch>
    </Sequence>
    <Sequence from={C0} durationInFrames={ATT.len}>
      <Seam>
        <Attention />
      </Seam>
    </Sequence>
    {HITS.map((h, i) => (
      <Sequence key={i} from={h.at} durationInFrames={60} layout="none">
        <Audio src={staticFile(h.src)} volume={h.v} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
