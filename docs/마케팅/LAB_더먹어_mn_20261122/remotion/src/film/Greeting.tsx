// 나라 인사 카드(11-12 유호님 「(가) 인사 카드」) — 훅 앞에 그 나라 인사 장면 한 장을 두고, 그 뒤로 원본 Film이 한 프레임도 안 바뀐 채 밀려 시작한다.
// 인사 장면은 그림 한 장이다: 펠트 하늘 · 몽글 · 그 나라 상징 하나 · 펠트 글자(「Hello / 미국! / mi-guk」)까지 장면과 한 장으로 구웠다 —
// 화면 글꼴로 얹는 글은 없다. 소리는 몽글 목소리(소진) 「Hello, 미국!」 하나와 톡 소리.
// 나라마다 다른 것은 public/greet/<KEY>.jpg · <KEY>.wav와 판본 글의 인사 칸(hello · helloName · helloRead · helloVo · helloSec)뿐이다.
// 정본 그림 · 목소리 · 지시문은 docs/마케팅/LAB_하루두편_설계_20261110/인사카드/에 있고 편마다 public/greet로 복사해 쓴다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Film, FPS } from './Film';
import { LocPack } from './판본';

const MASTER = 0.8; // Film.tsx와 같은 값
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const fr = (sec: number) => Math.round(sec * FPS);

// 인사 길이(프레임) — 인사가 없는 판본은 0
export const greetFrames = (L: LocPack) => (L.hello ? fr(L.helloSec) : 0);

const GreetCard: React.FC<{ k: string; sec: number }> = ({ k, sec }) => {
  const t = useCurrentFrame() / FPS;
  // 나라 이름을 말하는 박(목소리 0.5초쯤)에 한 번 톡 다가간다. 축은 글자 윗변 · 안전 영역 가운데(화면 492, 300) — 다가가도 글자가 위 안전선(269px) · 오른쪽 단추 자리(920px) 밖으로 밀리지 않는다
  const punch = interpolate(t, [0.46, 0.56, 0.95], [0, 1, 0], { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) });
  const z = interpolate(t, [0, sec], [1.0, 1.02], clamp) * (1 + 0.02 * punch);
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1d16' }}>
      <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: '492px 300px' }}>
        <Img src={staticFile(`greet/${k}.jpg`)} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// k = 판본 키(인사 그림 · 목소리 파일 이름) · L = 판본 글. Root가 인사 칸(hello)이 찬 판본만 이 컴포넌트로 등록한다.
export const FilmGreet: React.FC<{ L: LocPack; k: string }> = ({ L, k }) => {
  const n = greetFrames(L);
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1d16' }}>
      <Sequence durationInFrames={n}>
        <GreetCard k={k} sec={L.helloSec} />
      </Sequence>
      <Audio src={staticFile('greet/pop.wav')} volume={0.16 * MASTER} />
      <Sequence from={fr(0.06)} layout="none">
        <Audio src={staticFile(`greet/${k}.wav`)} volume={MASTER} />
      </Sequence>
      <Sequence from={n}>
        <Film L={L} />
      </Sequence>
    </AbsoluteFill>
  );
};
