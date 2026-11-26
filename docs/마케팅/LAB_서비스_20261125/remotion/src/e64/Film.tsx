// LAB 영어 E64 「서비스」 v6 — 「더 먹어」 짜임(제작 절차 lab-video-story). 칸마다 샷을 깔고 10~15% 천천히 다가가며, 칸 6 · 10에만 짧게 흔든다.
// 굽는 영상 안의 카메라는 고정이고 앵글은 칸을 바꿔서 움직인다. 다가가기 축은 그 칸 주인공 얼굴이라 얼굴은 제자리에 남고 둘레가 밖으로 밀린다(멀미 — 큰 움직임 없음).
// 말 글씨는 온전한 말풍선(제작 절차 lab-lettering) — 꼬리를 말한 사람에게(교훈 L21), 한국어 아래 영어 뜻 줄을 같은 순간에(교훈 L08). 뜻 줄은 파랑, 빨강 · 초록은 쓰지 않는다.
// v5의 뜻 카드(가격표)와 「Later…」 띠, 관광객 장면은 뺐다(제작 절차 「뜻 카드나 「Later…」 같은 설명 칸으로 이야기를 잇지 않는다」).
import React from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { 말풍선 } from './말풍선';
import { Cell, CELLS, FILM, FPS, fr, HEAD, SAYS, SFX, VO } from './data';

export { FPS };
const MASTER = 0.8;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const INK = '#2B1B12';
const PAPER = '#FFF8EC';
const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });

// 칸 하나 — 샷을 깔고 칸 내내 천천히 다가간다(1 → z). 흔들림 칸은 첫 10프레임 동안 좌우로 줄어드는 흔들림
const CellLayer: React.FC<{ c: Cell }> = ({ c }) => {
  const frame = useCurrentFrame(); // Sequence 안이라 칸 첫머리가 0
  const n = fr(c.to) - fr(c.at);
  // 흔들림 칸은 4% 키운 채 시작한다 — 흔들 때 화면 가장자리에 바탕색 줄이 비치지 않게(시험 렌더 13.07초)
  // z0: 처음부터 당겨 잡을 칸(v7 계산서 칸 — 9:16으로 늘린 위 띠의 세로 결을 화면 밖으로)
  const z = interpolate(frame, [0, n], [c.z0 ?? (c.shake ? 1.04 : 1), c.z], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const sx = c.shake && frame < 10 ? Math.sin(frame * 2.6) * 14 * (1 - frame / 10) : 0;
  const sy = c.shake && frame < 10 ? Math.cos(frame * 3.1) * 6 * (1 - frame / 10) : 0;
  return (
    <AbsoluteFill style={{ transformOrigin: `${c.o[0]}px ${c.o[1]}px`, transform: `translate(${sx}px, ${sy}px) scale(${z})` }}>
      <OffthreadVideo src={staticFile(`vid/${c.vid}`)} muted startFrom={fr(c.from)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </AbsoluteFill>
  );
};

// 머리 글 — 원본의 위 한 줄 약속(오마주.json 뼈대 훅 0.0)
const Head: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < fr(HEAD.at) || frame >= fr(HEAD.to)) return null;
  const p = pop(frame, HEAD.at);
  const o = interpolate(frame, [fr(HEAD.to) - 5, fr(HEAD.to)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 90, right: 160, top: 275, textAlign: 'center', opacity: o, transform: `scale(${0.9 + 0.1 * p})` }}>
      <div style={{ display: 'inline-block', background: PAPER, border: `6px solid ${INK}`, borderRadius: 30, padding: '14px 30px 18px', boxShadow: '0 10px 26px rgba(0,0,0,0.35)' }}>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 50, color: INK, lineHeight: 1.15 }}>{HEAD.l1}</div>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 88, color: INK, lineHeight: 1.1 }}>{HEAD.l2}</div>
      </div>
    </div>
  );
};

// 배경음 — bgm.wav는 19초라 같은 곡을 17.5초부터 한 번 더 깔고 1.5초 겹쳐 잇는다(26.8초를 다 덮음)
const BGM_V = 0.16;
const SEAM = 17.5;
const XF = 1.5;
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => MASTER * BGM_V * interpolate(i, [fr(SEAM), fr(SEAM + XF)], [1, 0], clamp)} endAt={fr(SEAM + XF)} />
    <Sequence from={fr(SEAM)} layout="none">
      <Audio src={staticFile('bgm.wav')} volume={(i) => MASTER * BGM_V * interpolate(i, [0, fr(XF)], [0, 1], clamp) * interpolate(i, [fr(FILM - SEAM) - 15, fr(FILM - SEAM)], [1, 0], clamp)} />
    </Sequence>
    <Audio src={staticFile('sfx/bunsik.wav')} volume={(i) => MASTER * 0.2 * interpolate(i, [fr(FILM) - 10, fr(FILM)], [1, 0], clamp)} endAt={fr(FILM)} />
    {VO.map(([t, v]) => (
      <Sequence key={v} from={fr(t)} layout="none">
        <Audio src={staticFile(`vo/${v}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#5a1a12', overflow: 'hidden' }}>
    {CELLS.map((c, i) => (
      <Sequence key={i} from={fr(c.at)} durationInFrames={fr(c.to) - fr(c.at)} layout="none">
        <CellLayer c={c} />
      </Sequence>
    ))}
    <Head />
    {SAYS.map((w, i) => <말풍선 key={i} w={w} />)}
    <Sound />
  </AbsoluteFill>
);
