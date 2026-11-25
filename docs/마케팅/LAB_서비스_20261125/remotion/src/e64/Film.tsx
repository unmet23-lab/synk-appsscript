// LAB 영어 E64 「서비스」 — 본보기(영상시험_20261125/본보기_Film.tsx)의 ShotLayer로 샷을 깔고, 말 글씨 · 머리 글 · 뜻 카드 · 소리를 얹는다.
// 카메라 밀기는 넣지 않는다(제작 절차 lab-whole-video · 11-20 멀미). 말 글씨는 온전한 말풍선(제작 절차 lab-lettering, 11-26) — 꼬리를 말한 사람에게(교훈 L21), 한국어 아래 영어 뜻 줄을 같은 순간에(교훈 L08).
// 뜻 줄 색은 파랑(맞음 · 틀림이 아닌 강조 — 제작 절차 「맞는 말과 틀린 말」: 초록 · 빨강은 쓰지 않는다).
import React from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { 말풍선 } from './말풍선';
import { CARD, FILM, FPS, fr, HEAD, LATER, SAYS, SCENE, SFX, Shot, SHOTS, VO } from './data';

export { FPS };
const MASTER = 0.8;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const INK = '#2B1B12';
const PAPER = '#FFF8EC';
const MEAN = '#2F4BA0';
const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });

const ShotLayer: React.FC<{ s: Shot }> = ({ s }) => (
  <Sequence from={fr(s.at)} durationInFrames={fr(s.len)} layout="none">
    <AbsoluteFill>
      <OffthreadVideo src={staticFile(`vid/${s.vid}`)} muted startFrom={fr(s.from ?? 0)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </AbsoluteFill>
  </Sequence>
);

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

// 뜻 카드 — 한 장 4초 안(교훈 L07). v2: 사장님 옆 벽에 걸린 크라프트 가격표(₩0) — 위쪽 종이 카드는 지난 편 「아까워」와 같은 꼴로 읽혔다
const KRAFT = '#F1D7A6';
const Card: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < fr(CARD.at) || frame >= fr(CARD.to)) return null;
  const p = pop(frame, CARD.at);
  const o = interpolate(frame, [fr(CARD.to) - 5, fr(CARD.to)], [1, 0], clamp);
  const line = (k: number) => Math.min(1, pop(frame, CARD.at + k * 0.13) * 1.4);
  const sway = Math.sin(((frame - fr(CARD.at)) / FPS) * Math.PI * 1.1) * 1.6 * Math.exp(-((frame - fr(CARD.at)) / FPS) * 0.8);
  const W = 465;
  const H = 360;
  return (
    <div style={{ position: 'absolute', left: 450, top: 300, width: W, height: H, opacity: o, transformOrigin: '50% -40px', transform: `rotate(${5 + sway}deg) scale(${0.85 + 0.15 * p})` }}>
      {/* 걸린 끈 — 가는 선 하나 */}
      <div style={{ position: 'absolute', left: W / 2 - 2, top: -40, width: 4, height: 44, background: INK, borderRadius: 2 }} />
      <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.35))' }}>
        <path d={`M 30 6 L ${W - 30} 6 Q ${W - 6} 6 ${W - 6} 30 L ${W - 6} ${H - 30} Q ${W - 6} ${H - 6} ${W - 30} ${H - 6} L 30 ${H - 6} Q 6 ${H - 6} 6 ${H - 30} L 6 30 Q 6 6 30 6 Z`} fill={KRAFT} stroke={INK} strokeWidth={6} />
        <path d={`M 22 22 L ${W - 22} 22 L ${W - 22} ${H - 22} L 22 ${H - 22} Z`} fill="none" stroke="#B88A4A" strokeWidth={3} strokeDasharray="10 9" />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 30, textAlign: 'center' }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 96, color: INK, lineHeight: 1.05 }}>{CARD.ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 600, fontSize: 44, color: '#5A4636', lineHeight: 1.2, opacity: line(1) }}>{CARD.read}</div>
        <div style={{ fontFamily: EN, fontWeight: 900, fontSize: 66, color: MEAN, lineHeight: 1.15, opacity: line(2) }}>{CARD.mean}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 46, color: INK, lineHeight: 1.2, opacity: line(3) }}>{CARD.sub}</div>
      </div>
    </div>
  );
};

// 시간이 넘어가는 한 줄(교훈 L05)
const Later: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < fr(LATER.at) || frame >= fr(LATER.to)) return null;
  const p = pop(frame, LATER.at);
  const o = interpolate(frame, [fr(LATER.to) - 5, fr(LATER.to)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 90, right: 160, top: 300, textAlign: 'center', opacity: o * Math.min(1, p * 1.5) }}>
      <span style={{ display: 'inline-block', background: INK, color: PAPER, fontFamily: EN, fontWeight: 800, fontSize: 56, lineHeight: 1.2, padding: '12px 30px 14px', borderRadius: 999 }}>{LATER.text}</span>
    </div>
  );
};

const Sound: React.FC<{ until: number; music: boolean }> = ({ until, music }) => (
  <>
    {music ? <Audio src={staticFile('bgm.wav')} volume={(i) => MASTER * 0.16 * interpolate(i, [fr(until) - 15, fr(until)], [1, 0], clamp)} endAt={fr(until)} /> : null}
    <Audio src={staticFile('sfx/bunsik.wav')} volume={(i) => MASTER * 0.2 * interpolate(i, [fr(until) - 10, fr(until)], [1, 0], clamp)} endAt={fr(until)} />
    {VO.filter(([t]) => t < until).map(([t, v]) => (
      <Sequence key={v} from={fr(t)} layout="none">
        <Audio src={staticFile(`vo/${v}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.filter(([t]) => t < until).map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

// 장면 심사용 — 글 없이 그림과 소리만(제작 절차 「한 장면 먼저」)
export const SceneBare: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#5a1a12' }}>
    {SHOTS.filter((s) => s.at < SCENE).map((s, i) => <ShotLayer key={i} s={s} />)}
    <Sound until={SCENE} music={false} />
  </AbsoluteFill>
);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#5a1a12' }}>
    {SHOTS.map((s, i) => <ShotLayer key={i} s={s} />)}
    <Head />
    {SAYS.map((w, i) => <말풍선 key={i} w={w} />)}
    <Card />
    <Later />
    <Sound until={FILM} music />
  </AbsoluteFill>
);
