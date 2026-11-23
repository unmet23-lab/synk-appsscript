// LAB 영어 E62 「아까워」 편(e62-en, 11-23 15시 회차) — 핵심 장면(Scene, 6.0초)으로 바로 열고 뒤에 뜻 카드 · 끝 사건을 붙인다(칸 설명은 data.ts 「편」).
// v3: 0~5.65 핵심 장면 → 5.65~9.25 뜻 카드(p7a) → 9.25~13.25 끝 사건(p9 — 끌어안고 들썩이는 별눈 몽글 · 「더 줄게~」 · 아주머니 웃음).
//   머리 글 카드와 끝 질문 띠는 없다(이해 시험 v1 9번 「같아 보임」 — 교훈 L02). 끝의 다시 매달림 · 둘째 「아까워~」도 없다(v2 「반복」). 마지막 화면 글은 「더 줄게~」다.
// 화면 글은 data.ts의 TXT 한 꾸러미에서 받는다(나라 판본은 그 칸만 바꾼다). 글자는 안전선(가로 65~920 · 세로 269~1428) 안.
// 맞음 · 틀림이 없는 편이라 초록 · 빨강을 쓰지 않는다(뜻 줄은 파랑, 뜻 카드 머리 띠는 토마토색).
// 움직이는 몽글은 빈 판 위의 층(tools/층나누기.py) — 큰 움직임은 뛰어올라 매달리는 순간뿐이고 나머지는 흔들림 · 들썩임이다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { F, FILM, FILM_SFX, FILM_VO, FPS, HUGS, SC, SCENE, SFX, TT, TXT, VO } from './data';
import { Bubble, clamp, fr, INK, MASTER, MEAN, PAPER, pop, Scene } from './Scene';

export const FILM_FRAMES = fr(FILM);
const TOMATO = '#C9452F';

// 뜻 카드 — 크림 카드 위 한국어 · 읽기 / 영어 뜻 / 한 줄 덧말. v4: 줄이 0.13초 간격으로 차례로 뜬다(한 카드의 줄은 0.4초 안 — 마지막 줄이 첫 줄 0.26초 뒤)
//   카드는 아주 작게 떠 있듯 숨쉰다(이해 시험 v3 h 「6~8초 뜻 카드가 2초 넘게 움직임 없이」).
const CARD_STEP = 0.13; // 0.2는 화면글검사가 셋째 줄을 「0.5초 뒤 새 글」로 셈(한 카드 0.4초 안)
const MeaningCard: React.FC = () => {
  const frame = useCurrentFrame() + fr(F.card); // Sequence 안 — 편 프레임으로
  const t = frame / FPS;
  if (t < TT.card || t >= TT.cardTo) return null;
  const p = pop(frame, TT.card);
  const line = (k: number) => {
    const q = pop(frame, TT.card + k * CARD_STEP);
    return { opacity: Math.min(1, q * 1.5), transform: `translateY(${(1 - q) * 14}px)` };
  };
  const breathe = 1 + 0.012 * Math.sin((t - TT.card) * Math.PI * 2 * 0.5);
  const floatY = Math.sin((t - TT.card) * Math.PI * 2 * 0.4) * 5;
  return (
    <div style={{ position: 'absolute', top: 290, left: 65, width: 855, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `translateY(${floatY}px) scale(${(0.9 + 0.1 * p) * breathe})` }}>
      <div style={{ background: PAPER, border: `6px solid ${INK}`, borderTop: `18px solid ${TOMATO}`, borderRadius: 26, padding: '10px 44px 16px', textAlign: 'center', boxShadow: '0 12px 28px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 22, ...line(0) }}>
          <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 118, color: TOMATO, lineHeight: 1.05 }}>{TXT.cardKo}</span>
          <span style={{ fontFamily: EN, fontWeight: 700, fontSize: 46, color: INK, opacity: 0.75 }}>{TXT.cardRead}</span>
        </div>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 64, color: MEAN, lineHeight: 1.1, marginTop: 2, whiteSpace: 'nowrap', ...line(1) }}>= {TXT.cardMean}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 44, color: INK, lineHeight: 1.2, marginTop: 8, whiteSpace: 'nowrap', ...line(2) }}>{TXT.cardNote}</div>
      </div>
    </div>
  );
};

// 매달린 몽글 층 — v4(미학 맹검 「무게감 없이 쟁반 끝에 공중 부양」): 뒤에 짙은 그림자를 깔고(철판 테 · 앞치마에 떨어짐),
//   철판 테(축 높이) 위쪽 몸은 테에 눌려 조금 납작하게, 아래쪽 몸은 무게로 조금 늘어나게 둘로 나눠 같은 축으로 돌린다.
const HangLayer: React.FC<{ img: string; pivot: [number, number]; rot: number; dx?: number; dy?: number; sx: number; top: number; bottom: number }> = ({ img, pivot, rot, dx = 0, dy = 0, sx, top, bottom }) => {
  const [ox, oy] = pivot;
  const part = (clip: string, sy: number, shadow: boolean) => (
    <AbsoluteFill style={{ transformOrigin: `${ox}px ${oy}px`, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})` }}>
      <Img src={staticFile(`img/${img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, clipPath: clip, filter: shadow ? 'brightness(0) blur(16px)' : undefined, opacity: shadow ? 0.42 : 1, transform: shadow ? 'translate(14px, 26px)' : undefined }} />
    </AbsoluteFill>
  );
  const upper = `inset(0px 0px ${1920 - oy}px 0px)`;
  const lower = `inset(${oy}px 0px 0px 0px)`;
  return (
    <>
      {part('none', (top + bottom) / 2, true)}
      {part(lower, bottom, false)}
      {part(upper, top, false)}
    </>
  );
};

// 뜻 카드 칸 — 아주머니가 웃고, 몽글은 철판에 매달린 채 올려다보며 계속 그네처럼 흔들리고 들썩인다(v4: 잔흔들림을 키움)
const P7A = { img: 'layer/p7a_m.png', pivot: [560, 1495] as [number, number] }; // 철판 가장자리에 턱을 건 자리 — 층의 가장자리 홈이 철판에 남게 이 둘레로만 돌린다
const CardCell: React.FC = () => {
  const frame = useCurrentFrame();
  const u = frame / FPS;
  const s = interpolate(u, [0, F.end - F.card], [1.0, 1.05], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const deg = 9 * Math.exp(-u * 0.45) * Math.cos(2 * Math.PI * 0.6 * u) + 4.5 * Math.sin(u * Math.PI * 2 * 0.55);
  const hop = Math.abs(Math.sin(u * Math.PI * (1 / 0.7))) * 0.04; // 올려다보며 들썩(0.7초마다)
  return (
    <AbsoluteFill style={{ transformOrigin: '48% 60%', transform: `scale(${s})` }}>
      <Img src={staticFile('img/layer/p7a_bg.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
      <HangLayer img={P7A.img} pivot={P7A.pivot} rot={deg} sx={1 - hop * 0.3} top={0.95} bottom={1.03 + hop} />
    </AbsoluteFill>
  );
};

// 끝 — 밥을 가득 얹은 철판에 매달린 별눈 몽글(처음부터 층으로 있음) → 1.2초마다 꼭 끌어안고 끝까지 들썩 · 흔들림 → 아주 천천히 다가감
// v4(미학 맹검 「8칸 내내 미동도 없이 정지」): 들썩 주기 0.6초 · 끌어안기 눌림 · 늘어남 8% · 흔들림 5° 안팎으로 0.25초 칸마다 보이게.
const P9 = { img: 'layer/p9_m.png', pivot: [575, 1410] as [number, number] }; // 턱을 건 자리(층에 남은 철판 조각 둘레) — p9는 판짜기 x0=150
const EndCell: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS + F.end; // 편 초
  const u = t - F.end;
  const z = interpolate(t, [F.end, FILM], [1.0, 1.1], { ...clamp, easing: Easing.inOut(Easing.quad) }); // 몽글 오른쪽 끝(1047)이 화면 안(기준 86% 72%)
  const deg = 7 * Math.exp(-u * 1.0) * Math.cos(2 * Math.PI * 0.9 * u) + 4.5 * Math.sin(u * Math.PI * 2 * 0.6);
  const hug = HUGS.reduce((m, b) => (t >= b ? Math.max(m, Math.exp(-(t - b) * 5)) : m), 0) * 0.08; // 꼭 끌어안음 — 눌림 · 늘어남 8%
  const hop = Math.abs(Math.sin(u * Math.PI * (1 / 0.6))) * 0.06; // 좋아서 들썩 — 0.6초마다
  const plop = Math.sin(Math.min(1, u / 0.22) * Math.PI) * 9 * Math.exp(-u * 4); // 털썩 — 화면이 살짝 흔들림
  return (
    <AbsoluteFill style={{ transformOrigin: '86% 72%', transform: `translateY(${plop}px) scale(${z})` }}>
      <Img src={staticFile('img/layer/p9_bg.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
      <HangLayer img={P9.img} pivot={P9.pivot} rot={deg} dx={18 * (deg / 9)} dy={-hop * 60} sx={1 + hug * 0.7 - hop * 0.3} top={0.95 - hug * 0.4} bottom={1.03 + hop - hug * 0.3} />
    </AbsoluteFill>
  );
};

// 통통 튀며 뜨는 말풍선 — v4: 「더 줄게~」가 뜬 뒤에도 0.9초마다 살짝 통통(마지막 화면 글이 멈춰 보이지 않게)
const Bouncy: React.FC<{ from: number; children: React.ReactNode }> = ({ from, children }) => {
  const frame = useCurrentFrame();
  const u = frame / FPS - from;
  const b = u > 0.3 ? Math.abs(Math.sin((u - 0.3) * Math.PI / 0.9)) * -10 : 0;
  return <AbsoluteFill style={{ transform: `translateY(${b}px)` }}>{children}</AbsoluteFill>;
};

const FilmSound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.18 * MASTER * interpolate(i, [fr(FILM) - 18, fr(FILM)], [1, 0], clamp)} endAt={fr(FILM)} />
    <Audio src={staticFile('sfx/bunsik.wav')} volume={(i) => MASTER * 0.3 * interpolate(i, [fr(FILM) - 18, fr(FILM)], [1, 0], clamp)} endAt={fr(FILM)} />
    {[...VO.map(([t, v]) => [t + SC, v] as [number, string]), ...FILM_VO].map(([t, v]) => (
      <Sequence key={`${t}-${v}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`${v}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {[...SFX.map(([t, f, v]) => [t + SC, f, v] as [number, string, number]), ...FILM_SFX].map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#e9d3b3', overflow: 'hidden' }}>
    <Sequence from={fr(SC)} durationInFrames={fr(SCENE)}>
      <Scene silent />
    </Sequence>
    <Sequence from={fr(F.card)} durationInFrames={fr(F.end - F.card)}>
      <CardCell />
      <MeaningCard />
    </Sequence>
    <Sequence from={fr(F.end)} durationInFrames={fr(FILM - F.end)}>
      <EndCell />
      {/* 아주머니 「더 줄게~」 — 아주머니 머리 위, 꼬리가 아주머니에게(마지막 화면 글) */}
      <Bouncy from={TT.a2 - F.end}>
        <Bubble at={TT.a2 - F.end} to={TT.a2To - F.end} ko={TXT.a2} mean={TXT.a2m} x={380} y={482} tail={0.35} koSize={76} meanSize={50} />
      </Bouncy>
    </Sequence>
    <FilmSound />
  </AbsoluteFill>
);
