// 세션 공유 편 본편. A판(인스타, 52.0초) · E판(유튜브, 훅이 2박 길어 53.0초).
// 시험판(S22) 문법 그대로: 화면 하나가 끊기지 않고 변형, 실제 값, 검정 무대 · 흰 글 · 버터 한 곳, 머리글이 곧 내레이션,
// 장면 사이는 변형이 기본이고 막이 바뀌는 두 곳만 한 장으로 이어 위로 넘긴다. 사건은 잘라 붙인 배경음의 박 격자 위.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile } from 'remotion';
import { clamp } from '../lib/motion';
import { ActOne, EHook } from './ActOne';
import { ActThree, DOC_OUT, END_IN, REPO_IN } from './ActThree';
import { ActTwo } from './ActTwo';
import { STAGE, StageLabel } from './kit';
import { A1, A2, A3, A4, A5, B, C, D, E_SHIFT, F, LINES_A, LINES_E, lineEnd, M, R, S, TOTAL_A, VO, wdE, Z, type Line } from './time';
import { VOICE } from './vo.generated';

type V = 'A' | 'E';
type Hit = { at: number; src: string; v: number };

/** 효과음(A판 프레임, E판은 Sequence로 함께 밀린다). 사건마다 하나. */
const hits = (v: V): Hit[] => [
  ...(v === 'A'
    ? [
        // 00 훅: 누르자마자 빠지고 5박에 텅(시험판 S22 그대로)
        { at: A1.click, src: 'sfx/tok.wav', v: 0.6 },
        { at: A1.drain, src: 'sfx/whoosh_down.wav', v: 0.3 },
        { at: A1.empty, src: 'sfx/thud.wav', v: 0.5 },
        // 01 그대로: 빠질 때 소리를 거꾸로 틀며 되감기 → 막대가 차고 → 두 번 눌러도 그대로
        { at: Z.rew - 3, src: 'sfx/whoosh_rev.wav', v: 0.34 }, // 거꾸로 튼 소리는 끝 쪽이 커서, 줄이 돌아오는 한가운데(94~96)에 가장 크고 「지금은」(101) 전에 잦아든다
        { at: Z.fill, src: 'sfx/tick.wav', v: 0.2 },
        { at: Z.click1, src: 'sfx/tok.wav', v: 0.6 },
        { at: Z.click2, src: 'sfx/tok.wav', v: 0.6 },
        { at: Z.accent, src: 'sfx/snap.wav', v: 0.3 },
      ]
    : [
        { at: A2.fill, src: 'sfx/tick.wav', v: 0.2 },
        { at: A2.click, src: 'sfx/tok.wav', v: 0.6 },
        { at: A2.drain, src: 'sfx/whoosh_down.wav', v: 0.3 },
        { at: A2.drain + 30, src: 'sfx/thud.wav', v: 0.45 },
      ]),
  { at: S.s03, src: 'sfx/swish.wav', v: 0.35 },
  { at: A3.cards, src: 'sfx/pop.wav', v: 0.3 },
  { at: A4.home, src: 'sfx/snap.wav', v: 0.3 },
  { at: A4.link1, src: 'sfx/swish.wav', v: 0.3 },
  { at: A4.link2, src: 'sfx/swish.wav', v: 0.3 },
  { at: A5.rows, src: 'sfx/tick.wav', v: 0.2 },
  { at: A5.log, src: 'sfx/swish.wav', v: 0.35 },
  { at: A5.err + 16, src: 'sfx/snap.wav', v: 0.45 },
  { at: A5.mark, src: 'sfx/thud.wav', v: 0.5 },
  ...Array.from({ length: 12 }, (_, i) => ({ at: B.log + i * 2, src: 'sfx/tick.wav', v: 0.16 })),
  { at: B.land, src: 'sfx/snap.wav', v: 0.5 },
  { at: B.fold, src: 'sfx/swish.wav', v: 0.22 },
  ...Array.from({ length: 8 }, (_, i) => ({ at: B.grey + i * 2, src: 'sfx/tick2.wav', v: 0.13 })),
  { at: B.stamp, src: 'sfx/thud.wav', v: 0.55 },
  { at: R.back, src: 'sfx/whoosh_side.wav', v: 0.32 },
  { at: R.done, src: 'sfx/pop.wav', v: 0.38 },
  { at: S.s08, src: 'sfx/swish.wav', v: 0.5 },
  { at: M.snap, src: 'sfx/whoosh_down.wav', v: 0.3 },
  { at: M.merge, src: 'sfx/swish.wav', v: 0.3 },
  ...Array.from({ length: 5 }, (_, i) => ({ at: M.rows + i * 6, src: 'sfx/tick2.wav', v: 0.1 })),
  { at: M.same, src: 'sfx/snap.wav', v: 0.45 },
  { at: M.punch, src: 'sfx/whoosh_side.wav', v: 0.25 },
  { at: C.add, src: 'sfx/pop.wav', v: 0.42 },
  { at: C.back, src: 'sfx/whoosh_side.wav', v: 0.32 },
  ...Array.from({ length: 15 }, (_, i) => ({ at: C.ripple + 4 + i * 2, src: 'sfx/tick2.wav', v: 0.06 })),
  { at: D.zoom, src: 'sfx/swish.wav', v: 0.3 },
  { at: D.click1, src: 'sfx/tok.wav', v: 0.6 },
  { at: D.click2, src: 'sfx/tok.wav', v: 0.6 },
  { at: D.dark, src: 'sfx/swish.wav', v: 0.3 },
  ...D.lines.map((at) => ({ at, src: 'sfx/tick.wav', v: 0.16 })),
  { at: S.s11, src: 'sfx/swish.wav', v: 0.5 },
  { at: DOC_OUT, src: 'sfx/whoosh_down.wav', v: 0.25 },
  { at: REPO_IN, src: 'sfx/thud.wav', v: 0.4 },
  { at: END_IN, src: 'sfx/swish.wav', v: 0.32 },
  // 끝: 「세션」 두 글자 → 「보내」(음악 끝맺음과 같은 박)에 댓글이 올라감 → 「팔로우하면」 단추
  { at: F.type, src: 'sfx/tick2.wav', v: 0.18 },
  { at: F.type + 4, src: 'sfx/tick2.wav', v: 0.18 },
  { at: F.send, src: 'sfx/pop.wav', v: 0.42 },
  { at: F.follow, src: 'sfx/tok.wav', v: 0.55 },
];

/** E판 훅 효과음(E판 프레임): 거절 줄이 쏟아지는 틱, 멈출 때 탁. */
const E_HOOK_HITS: Hit[] = [...Array.from({ length: 10 }, (_, i) => ({ at: 4 + i * 6, src: 'sfx/tick.wav', v: 0.12 })), { at: 72, src: 'sfx/snap.wav', v: 0.5 }];

const lines = (v: V): readonly Line[] => (v === 'A' ? LINES_A : LINES_E);

/**
 * 배경음 크기(10-18 유호님 「배경음 키운 판이랑 뺀 판 둘 다 만들어줘」).
 * normal: 지금까지 판(말 없을 때 0.3, 말할 때 0.2 → 목소리보다 10dB쯤 낮음, 줄 사이마다 6프레임으로 오르내림).
 * up: 말할 때 0.31(목소리보다 6dB쯤 낮음), 말 없을 때 0.45. 줄 사이가 20프레임 안이면 이어진 말로 보고 오르내리지 않는다(펌핑 없이).
 * none: 배경음 없이 목소리·효과음만.
 */
export type Bgm = 'normal' | 'up' | 'none';

export const FullFilm: React.FC<{ variant: V; bgm?: Bgm }> = ({ variant: v, bgm = 'normal' }) => {
  const shift = v === 'E' ? E_SHIFT : 0;
  const total = TOTAL_A + shift;
  const ranges: [number, number][] = [
    ...(v === 'E' ? [[3, 3 + Math.round(VOICE.h1e.dur * 30)] as [number, number]] : []),
    ...lines(v).map((id) => [VO[id] + shift, lineEnd(id) + shift] as [number, number]),
  ];
  // 키운 판은 가까운 줄을 하나로 합친다
  const merged = ranges
    .slice()
    .sort((p, q) => p[0] - q[0])
    .reduce<[number, number][]>((acc, [a, b]) => {
      const last = acc[acc.length - 1];
      if (last && a - last[1] < 20) last[1] = Math.max(last[1], b);
      else acc.push([a, b]);
      return acc;
    }, []);
  // A판 00: 목록이 텅 비는 5박부터 되감기 박 직전까지 배경음을 비운다(「사라졌어요」가 꺼진 자리에 떨어지고, 6박 되감기 박에 다시 다 들어온다)
  const hollow = (fr: number) => (v === 'A' ? interpolate(fr, [A1.empty - 3, A1.empty + 1, Z.rew - 2, Z.rew], [1, 0.4, 0.4, 1], clamp) : 1);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (total - fr) / 20) * hollow(fr);
    if (bgm === 'up') {
      const voice = Math.max(0, ...merged.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
      return (0.45 - 0.14 * voice) * tail;
    }
    const voice = Math.max(0, ...ranges.map(([a, b]) => interpolate(fr, [a - 6, a, b, b + 6], [0, 1, 1, 0], clamp)));
    return (0.3 - 0.1 * voice) * tail;
  };
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      {/* 무대에 붙은 한 줄은 맨 아래 겹 — 전환 중 지나가는 판에 가려질 뿐 위에 그려지지 않는다 */}
      <StageLabel hideAt={END_IN + shift} />
      {v === 'E' ? <EHook until={S.s02 + E_SHIFT} wdE={wdE} /> : null}
      <Sequence from={shift}>
        <ActOne v={v} />
        <ActTwo />
        <ActThree />
        {lines(v).map((id) => (
          <Sequence key={id} from={VO[id]} layout="none">
            <Audio src={staticFile(`vo/${id}.wav`)} />
          </Sequence>
        ))}
        {hits(v).map((h, i) => (
          <Sequence key={i} from={h.at} durationInFrames={60} layout="none">
            <Audio src={staticFile(h.src)} volume={h.v} />
          </Sequence>
        ))}
      </Sequence>
      {v === 'E' ? (
        <>
          <Sequence from={3} layout="none">
            <Audio src={staticFile('vo/h1e.wav')} />
          </Sequence>
          {E_HOOK_HITS.map((h, i) => (
            <Sequence key={`e${i}`} from={h.at} durationInFrames={60} layout="none">
              <Audio src={staticFile(h.src)} volume={h.v} />
            </Sequence>
          ))}
        </>
      ) : null}
      {bgm !== 'none' ? <Audio src={staticFile(v === 'E' ? 'bgm_e.wav' : 'bgm_a.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};
