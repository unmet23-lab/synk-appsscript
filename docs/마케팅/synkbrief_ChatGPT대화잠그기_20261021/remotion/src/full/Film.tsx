// 본편 v4(약 25.7초, 「ChatGPT 대화 잠그기」 10-23 알아듣기 판): 청금석 무대 하나 위에서 다섯 장면을 배경음 박에 착지시킨다. 장면 사이는 위로 밀기 하나(지난 편과 같은 부품).
// 소리: 배경음(본편 0~48박 + 곡 끝맺음) + 사건마다 효과음 하나 + 내레이션(범수, 10-23). 말하는 동안 배경음을 낮추고 효과음도 조금 줄인다.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Stage, Whip } from '../v5/cine';
import { End5, Hook1, hookT, How2, howT, Open4, openT, Warn3, warnT } from './scenes';
import { CUT, Key, seq, TAIL, TOTAL } from './time';
import PLACE from './vo-place.json';

export { TOTAL };

type Hit = { at: number; src: string; v: number };
const abs = (k: Key, local: number) => seq(k).from + local;

const hits = (): Hit[] => {
  const h = hookT();
  const ho = howT();
  const w = warnT();
  const o = openT();
  return [
    { at: h.glow, src: 'sfx/tick.wav', v: 0.3 },
    { at: h.lock, src: 'sfx/tok.wav', v: 0.42 },
    { at: h.lock + 10, src: 'sfx/swish.wav', v: 0.26 },
    ...(['how', 'warn', 'open', 'end'] as const).map((k) => ({ at: seq(k).from + 2, src: 'sfx/swish.wav', v: 0.5 })),
    { at: abs('how', ho.dots), src: 'sfx/pop.wav', v: 0.32 },
    { at: abs('how', ho.menu), src: 'sfx/pop.wav', v: 0.32 },
    ...[0, 1, 2, 3].map((i) => ({ at: abs('how', ho.pin + 4 + i * 4), src: 'sfx/tick.wav', v: 0.22 })),
    { at: abs('how', ho.locked + 17), src: 'sfx/tok.wav', v: 0.4 },
    { at: abs('warn', w.del), src: 'sfx/thud.wav', v: 0.55 },
    { at: abs('warn', w.note - 4), src: 'sfx/pop.wav', v: 0.32 },
    { at: abs('open', o.folder), src: 'sfx/pop.wav', v: 0.3 },
    ...[0, 1, 2, 3].map((i) => ({ at: abs('open', o.pin + 2 + i * 4), src: 'sfx/tick.wav', v: 0.22 })),
    { at: abs('open', o.show), src: 'sfx/snap.wav', v: 0.3 },
    { at: CUT, src: 'sfx/tok.wav', v: 0.55 },
  ];
};

const SCENES: { k: Key; el: (variant: 'A' | 'B') => React.ReactNode }[] = [
  { k: 'hook', el: () => <Hook1 /> },
  { k: 'how', el: () => <How2 /> },
  { k: 'warn', el: () => <Warn3 /> },
  { k: 'open', el: () => <Open4 /> },
  { k: 'end', el: (v) => <End5 variant={v} /> },
];

/** 장면 전체 밀어 당기기: 프레임마다 0.08%(초당 약 2.4%, 1.12에서 멈춤). 흰 카드가 몇 픽셀 떠다니는 것만으로는 v1이 50초 중 40% 「거의 멈춤」이었다
 *  (tools/정지구간.js, 프레임 사이 밝기 차이). yuhobuilds 첫날 편 v8의 push와 같은 방법(현장 노트 영상 · 판 하나짜리 영상). still부터는 멈춘다. */
const Push: React.FC<{ children: React.ReactNode; still?: number }> = ({ children, still }) => {
  const f = useCurrentFrame();
  const ff = still === undefined ? f : Math.min(f, still);
  // v4: 0.95에서 시작해 1.0 바로 아래까지만 당긴다 — v3(1.00 → 1.12)는 키운 만큼 글이 안전선 밖(왼쪽 56px · 오른쪽 945px)으로 나가 올리기 전 검사에 걸렸다.
  const z = 0.95 * (1 + Math.min(0.05, 0.0008 * ff));
  // 당기기가 멈춘 뒤(약 62프레임)에도 장면이 이어지면 위로 천천히 흘린다(synkbrief 「Claude 기능 셋」 편 v3와 같은 고침 — 현장 노트 영상 「당기기 상한 1.12」).
  const drift = -0.6 * Math.max(0, ff - 62);
  return <AbsoluteFill style={{ scale: String(z), translate: `0 ${drift}px`, transformOrigin: '50% 50%' }}>{children}</AbsoluteFill>;
};

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
                <Push still={k === 'end' ? TOTAL - 18 - s.from : undefined}>{el(variant)}</Push>
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
      {hits().map((h, i) => (
        <Sequence key={i} from={h.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(h.src)} volume={MASTER * h.v * (1 - (1 - SFX_UNDER) * duck(h.at))} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
