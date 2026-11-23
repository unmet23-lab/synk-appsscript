// LAB 영어 E62 「아까워」 편(e62-en, 11-23 15시 회차) — 핵심 장면(Scene, 6.0초)으로 바로 열고 뒤에 뜻 카드 · 끝 사건을 붙인다(칸 설명은 data.ts 「편」).
// v2: 0~6.0 핵심 장면 → 6.0~9.6 뜻 카드(p7a) → 9.6~18.6 끝 사건(p9 — 「더 줄게~」 → 또 매달림 「아까워~」 → 꼭 끌어안고 들썩 · 아주머니 웃음).
//   머리 글 카드와 끝 질문 띠는 없다(이해 시험 v1 9번 「같아 보임」 — 교훈 L02). 마지막 화면 글은 몽글 말풍선이다.
// 화면 글은 data.ts의 TXT 한 꾸러미에서 받는다(나라 판본은 그 칸만 바꾼다). 글자는 안전선(가로 65~920 · 세로 269~1428) 안.
// 맞음 · 틀림이 없는 편이라 초록 · 빨강을 쓰지 않는다(뜻 줄은 파랑, 뜻 카드 머리 띠는 토마토색).
// 움직이는 몽글은 빈 판 위의 층(tools/층나누기.py) — 큰 움직임은 뛰어올라 매달리는 순간뿐이고 나머지는 흔들림 · 들썩임이다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { F, FILM, FILM_SFX, FILM_VO, FPS, HUGS, SC, SCENE, SFX, TT, TXT, VO } from './data';
import { Bubble, clamp, fr, INK, LayerImg, MASTER, MEAN, PAPER, pop, Scene } from './Scene';

export const FILM_FRAMES = fr(FILM);
const TOMATO = '#C9452F';

// 뜻 카드 — 크림 카드 위 한국어 · 읽기 · 영어 뜻 · 한 줄 덧말(한 번에 함께 뜬다)
const MeaningCard: React.FC = () => {
  const frame = useCurrentFrame() + fr(F.card); // Sequence 안 — 편 프레임으로
  const t = frame / FPS;
  if (t < TT.card || t >= TT.cardTo) return null;
  const p = pop(frame, TT.card);
  return (
    <div style={{ position: 'absolute', top: 290, left: 65, width: 855, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `scale(${0.9 + 0.1 * p})` }}>
      <div style={{ background: PAPER, border: `6px solid ${INK}`, borderTop: `18px solid ${TOMATO}`, borderRadius: 26, padding: '10px 44px 16px', textAlign: 'center', boxShadow: '0 12px 28px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 22 }}>
          <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 118, color: TOMATO, lineHeight: 1.05 }}>{TXT.cardKo}</span>
          <span style={{ fontFamily: EN, fontWeight: 700, fontSize: 46, color: INK, opacity: 0.75 }}>{TXT.cardRead}</span>
        </div>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 64, color: MEAN, lineHeight: 1.1, marginTop: 2, whiteSpace: 'nowrap' }}>= {TXT.cardMean}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 44, color: INK, lineHeight: 1.2, marginTop: 8, whiteSpace: 'nowrap' }}>{TXT.cardNote}</div>
      </div>
    </div>
  );
};

// 뜻 카드 칸 — 아주머니가 웃고, 몽글은 철판에 매달린 채 올려다보며 작게 흔들리고 들썩인다
const P7A = { img: 'layer/p7a_m.png', pivot: [560, 1495] as [number, number] }; // 철판 가장자리에 턱을 건 자리 — 층의 가장자리 홈이 철판에 남게 이 둘레로만 돌린다
const CardCell: React.FC = () => {
  const frame = useCurrentFrame();
  const u = frame / FPS;
  const s = interpolate(u, [0, F.end - F.card], [1.0, 1.05], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const deg = 8 * Math.exp(-u * 0.6) * Math.cos(2 * Math.PI * 0.6 * u) + 2.5 * Math.sin(u * Math.PI * 2 * 0.35);
  const hop = Math.max(0, Math.sin(u * Math.PI * 2 * 0.9)) * 0.035; // 올려다보며 들썩
  return (
    <AbsoluteFill style={{ transformOrigin: '48% 60%', transform: `scale(${s})` }}>
      <Img src={staticFile('img/layer/p7a_bg.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
      <LayerImg img={P7A.img} ox={P7A.pivot[0]} oy={P7A.pivot[1]} rot={deg} sx={1 - hop * 0.4} sy={1 + hop} />
    </AbsoluteFill>
  );
};

// 끝 — 가득 얹은 철판(빈 판, 몽글 없음) → 몽글이 오른쪽 아래에서 뛰어올라 또 매달림 → 그네 · 꼭 끌어안음 · 끝까지 들썩 → 천천히 몽글에게 다가감
const P9 = { img: 'layer/p9_m.png', pivot: [575, 1410] as [number, number] }; // 턱을 건 자리(층에 남은 철판 조각 둘레) — p9는 판짜기 x0=150
const EndCell: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS + F.end; // 편 초
  const z = interpolate(t, [F.end, F.zoom, FILM], [1.0, 1.03, 1.16], { ...clamp, easing: Easing.inOut(Easing.quad) }); // 몽글 오른쪽 끝(1047)이 화면 안(기준 86% 72%)
  let layer: React.ReactNode = null;
  let shake = [0, 0];
  if (t >= F.leap) {
    if (t < F.cling) {
      const u = (t - F.leap) / (F.cling - F.leap);
      const e = Easing.out(Easing.cubic)(u);
      const arc = Math.sin(Math.PI * u) * 90;
      layer = <LayerImg img={P9.img} ox={P9.pivot[0]} oy={P9.pivot[1]} dx={260 * (1 - e)} dy={460 * (1 - e) - arc} rot={14 * (1 - e)} sx={1 - 0.1 * Math.sin(Math.PI * u)} sy={1 + 0.16 * Math.sin(Math.PI * u)} />;
    } else {
      const u = t - F.cling;
      const deg = 18 * Math.exp(-u * 0.8) * Math.cos(2 * Math.PI * 0.85 * u) + 2.2 * Math.sin(u * Math.PI * 2 * 0.45); // 또 매달려 그네 → 잦아든 뒤에도 작게 흔들림
      const land = interpolate(u, [0, 0.08, 0.2], [0.92, 1.04, 1.0], clamp);
      const hug = HUGS.reduce((m, b) => (t >= b ? Math.max(m, Math.exp(-(t - b) * 7)) : m), 0) * 0.06; // 꼭 끌어안음
      const hop = Math.max(0, Math.sin(u * Math.PI * 2 * 1.1)) * 0.025; // 좋아서 들썩 — 끝 2초도 멈추지 않게
      layer = <LayerImg img={P9.img} ox={P9.pivot[0]} oy={P9.pivot[1]} dx={22 * (deg / 18)} rot={deg} sx={1 + hug * 0.6 - hop * 0.4} sy={land - hug * 0.3 + hop} />;
      if (u < 0.18) shake = [(random(`es-${frame}`) - 0.5) * 12 * (1 - u / 0.18), (random(`ev-${frame}`) - 0.5) * 8 * (1 - u / 0.18)];
    }
  }
  const plop = t >= F.end ? Math.sin(Math.min(1, (t - F.end) / 0.22) * Math.PI) * 9 * Math.exp(-(t - F.end) * 4) : 0; // 털썩 — 화면이 살짝 흔들림
  return (
    <AbsoluteFill style={{ transformOrigin: '86% 72%', transform: `translate(${shake[0]}px, ${shake[1] + plop}px) scale(${z})` }}>
      <Img src={staticFile('img/layer/p9_bg.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
      {layer}
    </AbsoluteFill>
  );
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
      {/* 아주머니 「더 줄게~」 — 아주머니 머리 위, 꼬리가 아주머니에게 */}
      <Bubble at={TT.a2 - F.end} to={TT.a2To - F.end} ko={TXT.a2} mean={TXT.a2m} x={380} y={482} tail={0.35} koSize={76} meanSize={50} />
      {/* 몽글 「아까워~」 — 매달린 몽글 머리 위, 꼬리가 몽글에게(마지막 화면 글) */}
      <Bubble at={TT.m2 - F.end} to={TT.m2To - F.end} ko={TXT.m2} mean={TXT.m2m} x={760} y={1125} tail={0.75} koSize={92} meanSize={48} />
    </Sequence>
    <FilmSound />
  </AbsoluteFill>
);
