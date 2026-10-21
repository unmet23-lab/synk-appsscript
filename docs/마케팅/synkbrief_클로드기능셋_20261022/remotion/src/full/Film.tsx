// 본편(「Claude 기능 셋 — 반복하는 말로 고르기」): 청금석 무대 하나 위에서 여덟 장면을 배경음 박에 착지시킨다. 장면 사이는 위로 밀기 하나(지난 편과 같은 부품).
// 소리: 배경음(본편 + 곡 끝맺음) + 사건마다 효과음 하나 + 내레이션(범수, 10-22). 말하는 동안 배경음을 낮추고 효과음도 조금 줄인다.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Stage, Whip } from '../v5/cine';
import { Conn06, connT, End08, Hook01, hookT, Myth05, mythT, Proj03, projT, Rule02, ruleT, Skill04, skillT, Sum07, sumT } from './scenes';
import { CUT, Key, seq, TAIL, TOTAL } from './time';
import PLACE from './vo-place.json';

export { TOTAL };

type Hit = { at: number; src: string; v: number };
const abs = (k: Key, local: number) => seq(k).from + local;

const hits = (variant: 'A' | 'B'): Hit[] => {
  const h = hookT(variant);
  const r = ruleT();
  const p = projT();
  const sk = skillT();
  const m = mythT();
  const c = connT();
  const su = sumT();
  return [
    { at: h.b2 + 2, src: 'sfx/pop.wav', v: 0.28 },
    { at: h.b3 + 2, src: 'sfx/pop.wav', v: 0.28 },
    { at: h.chip, src: 'sfx/tok.wav', v: 0.36 },
    { at: h.chip2, src: 'sfx/pop.wav', v: 0.3 },
    ...(['rule', 'proj', 'skill', 'myth', 'conn', 'sum', 'end'] as const).map((k) => ({ at: seq(k).from + 2, src: 'sfx/swish.wav', v: 0.5 })),
    ...[r.a, r.b, r.c].map((x) => ({ at: abs('rule', x), src: 'sfx/snap.wav', v: 0.3 })),
    ...[0, 1, 2].map((i) => ({ at: abs('proj', p.files + i * 4), src: 'sfx/tick.wav', v: 0.22 })),
    { at: abs('proj', p.all), src: 'sfx/tok.wav', v: 0.34 },
    { at: abs('proj', p.five), src: 'sfx/pop.wav', v: 0.32 },
    ...[0, 1, 2].map((i) => ({ at: abs('skill', sk.steps + i * 4), src: 'sfx/tick.wav', v: 0.22 })),
    { at: abs('skill', sk.ask), src: 'sfx/pop.wav', v: 0.28 },
    { at: abs('skill', sk.done), src: 'sfx/earn.wav', v: 0.3 },
    { at: abs('myth', m.no), src: 'sfx/thud.wav', v: 0.45 },
    { at: abs('myth', m.ask), src: 'sfx/pop.wav', v: 0.28 },
    { at: abs('myth', m.q), src: 'sfx/pop.wav', v: 0.28 },
    { at: abs('myth', m.file), src: 'sfx/snap.wav', v: 0.3 },
    ...[0, 1, 2].map((i) => ({ at: abs('conn', c.apps + i * 5), src: 'sfx/tick.wav', v: 0.22 })),
    { at: abs('conn', c.read), src: 'sfx/tok.wav', v: 0.34 },
    { at: abs('conn', c.ask + 11), src: 'sfx/tok.wav', v: 0.36 },
    ...[su.a, su.b, su.c].map((x) => ({ at: abs('sum', x), src: 'sfx/snap.wav', v: 0.3 })),
    { at: abs('sum', su.save + 4), src: 'sfx/thud.wav', v: 0.42 },
    { at: CUT, src: 'sfx/tok.wav', v: 0.55 },
  ];
};

const SCENES: { k: Key; el: (variant: 'A' | 'B') => React.ReactNode }[] = [
  { k: 'hook', el: (v) => <Hook01 variant={v} /> },
  { k: 'rule', el: () => <Rule02 /> },
  { k: 'proj', el: () => <Proj03 /> },
  { k: 'skill', el: () => <Skill04 /> },
  { k: 'myth', el: () => <Myth05 /> },
  { k: 'conn', el: () => <Conn06 /> },
  { k: 'sum', el: () => <Sum07 /> },
  { k: 'end', el: (v) => <End08 variant={v} /> },
];

/** 장면 전체 밀어 당기기: 프레임마다 0.08%(초당 약 2.4%, 1.12에서 멈춤). 흰 카드가 몇 픽셀 떠다니는 것만으로는 v1이 50초 중 40% 「거의 멈춤」이었다
 *  (tools/정지구간.js, 프레임 사이 밝기 차이). yuhobuilds 첫날 편 v8의 push와 같은 방법(현장 노트 영상 · 판 하나짜리 영상). still부터는 멈춘다. */
const Push: React.FC<{ children: React.ReactNode; still?: number }> = ({ children, still }) => {
  const f = useCurrentFrame();
  const ff = still === undefined ? f : Math.min(f, still);
  const z = 1 + Math.min(0.12, 0.0008 * ff);
  // 150프레임(1.12)에서 당기기가 멈춘 뒤에도 장면이 이어지면 위로 천천히 흘린다(v2에서 장면을 한 박씩 늘리자 끝 2초가 멈춰 정지 점검에 걸림).
  const drift = -0.7 * Math.max(0, ff - 150);
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
      {hits(variant).map((h, i) => (
        <Sequence key={i} from={h.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(h.src)} volume={MASTER * h.v * (1 - (1 - SFX_UNDER) * duck(h.at))} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
