// LAB 영어 E50 「눈 = eye · snow」 — 편 하나(판본 틀 없음, 영어 판). 장면 정본은 data.ts.
// 11-25 15시 회차: 정지 판 대신 Flow 영상 샷을 ShotLayer로 깐다(영상시험_20261125/본보기_Film.tsx — 카메라 밀기 없음).
// 말 글씨: 「튀는 글자」(제작 절차 lab-lettering — 유호님 11-25 「B로 가자」, 본보기를 ./튀는글자.tsx로 복사). 배우는 낱말 「눈」만 노랑. 머리 글 · 이름표 · 끝 글은 크림 글자 + 그늘.
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { FLAKE2, FPS, fr, HIT1, HIT2, SCENE, SFX, Shot, SHOTS, TAG_EYE, TAG_SNOW, TOTAL, TXT, VO } from './data';
import { 말, 튀는글자 } from './튀는글자';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8;
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const CREAM = '#FFFDF7';
const PINK = '#FFC2D0';
const DIM = 'rgba(255,248,236,0.94)';
const SH = '0 3px 0 rgba(10,14,24,0.5), 0 5px 18px rgba(6,8,16,0.62)';
const Glow: React.FC<{ x: number; y: number; w: number; h: number; a?: number }> = ({ x, y, w, h, a = 0.5 }) => <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, background: `radial-gradient(ellipse at 50% 50%, rgba(8,10,20,${a}) 0%, rgba(8,10,20,${a * 0.55}) 45%, rgba(8,10,20,0) 72%)` }} />;

const ShotLayer: React.FC<{ s: Shot; base?: number }> = ({ s, base = 0 }) => (
  <Sequence from={fr(s.at) - fr(base)} durationInFrames={fr(s.at + s.len) - fr(s.at)} layout="none">
    <AbsoluteFill>
      <OffthreadVideo src={staticFile(`vid/${s.vid}`)} muted startFrom={fr(s.from ?? 0)} playbackRate={s.rate ?? 1} style={{ width: '100%', height: '100%', objectFit: 'cover', ...(s.당김 ? { transform: `scale(${s.당김.배율})`, transformOrigin: `${s.당김.x}% ${s.당김.y}%` } : {}) }} />
    </AbsoluteFill>
  </Sequence>
);

// 둘째 눈송이 — 오려 둔 펠트 눈송이가 빨라지며 떨어져 남은 눈에 닿는 순간 s6 영상으로 넘어간다
const Flake2: React.FC<{ t: number }> = ({ t }) => {
  if (t < FLAKE2.from || t >= FLAKE2.to) return null;
  const k = interpolate(t, [FLAKE2.from, FLAKE2.to], [0, 1], { ...clamp, easing: (v) => v * v * 0.55 + v * 0.45 });
  const at = (r: number[]) => r[0] + (r[1] - r[0]) * k;
  return <Img src={staticFile('img/flake2.png')} style={{ position: 'absolute', left: at(FLAKE2.x) - FLAKE2.w / 2, top: at(FLAKE2.y) - FLAKE2.w / 2, width: FLAKE2.w, transform: `rotate(${at(FLAKE2.rot)}deg)`, filter: 'drop-shadow(0 10px 12px rgba(10,16,40,0.35))' }} />;
};

// 말 — 튀는 글자(감정마다 글자가 튄다). y는 글자 덩어리 아래, tip은 말한 사람 머리 쪽
const SAY: 말[] = [
  { at: 0.85, to: 3.0, ko: [TXT.m1], key: '눈', mean: 'snow?', 뜻크기: 68, x: 800, y: 1050, tip: [790, 1110], 감정: '기쁨', 크기: 120 },
  { at: 1.72, to: 3.0, ko: [TXT.f1], key: '눈', mean: 'eye?', 뜻크기: 68, x: 610, y: 870, tip: [430, 820], 감정: '담담', 크기: 120 },
  { at: 3.08, to: 6.5, ko: [TXT.f2], key: '눈', read: TXT.f2r, mean: TXT.f2m, x: 470, y: 520, tip: [400, 600], 감정: '담담', 폭: 780 },
  { at: 6.58, to: 9.25, ko: [TXT.m2], key: '눈', read: TXT.m2r, mean: TXT.m2m, x: 360, y: 800, tip: [420, 900], 감정: '기쁨', 폭: 560 }, // 위의 큰 눈송이를 가리지 않게 왼쪽 아래
  { at: 10.12, to: 12.65, ko: [TXT.m3], key: '눈', read: TXT.m3r, mean: TXT.m3m, x: 560, y: 790, tip: [520, 960], 감정: '놀람', 크기: 150, 폭: 780 },
  { at: 12.7, to: 14.65, ko: [TXT.f3], key: '눈', read: TXT.f3r, mean: TXT.f3m, x: 470, y: 530, tip: [480, 620], 감정: '웃음', 폭: 780 },
  { at: 18.68, to: 20.5, ko: [TXT.m4], read: TXT.m4r, mean: TXT.m4m, x: 500, y: 830, tip: [520, 960], 감정: '당황', 크기: 140, 폭: 780 },
];

// 이름표 — 가는 선 하나로 그림 속 자리를 가리킨다(점 · 고리 없음)
const Tag: React.FC<{ t: number; from: number; until: number; x: number; y: number; lx: number; ly: number; text: string }> = ({ t, from, until, x, y, lx, ly, text }) => {
  if (t < from || t >= until) return null;
  const a = interpolate(t, [from, from + 0.2], [0, 1], clamp);
  return (
    <>
      <Glow x={lx} y={ly} w={560} h={300} a={0.5 * a} />
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: a }}>
        <line x1={lx} y1={ly + 48} x2={x} y2={y} stroke={CREAM} strokeWidth={5} strokeLinecap="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(6,8,16,0.6))' }} />
      </svg>
      <div style={{ position: 'absolute', left: lx - 220, top: ly - 40, width: 440, textAlign: 'center', opacity: a, fontFamily: KO, fontWeight: 900, fontSize: 76, color: CREAM, textShadow: SH, whiteSpace: 'nowrap' }}>{text}</div>
    </>
  );
};

const Sound: React.FC<{ from: number; to: number; music: boolean }> = ({ from, to, music }) => (
  <>
    {music ? <Audio src={staticFile('sfx/bgm.wav')} volume={(f) => MASTER * interpolate(f / FPS, [0, TOTAL - 0.6, TOTAL], [0.16, 0.16, 0], clamp)} /> : null}
    <Audio src={staticFile('sfx/air.wav')} volume={(f) => 0.22 * MASTER * interpolate(f / FPS, [0, to - from - 0.4, to - from], [1, 1, 0], clamp)} endAt={fr(to - from)} />
    {SFX.filter(([at]) => at >= from && at < to).map(([at, file, v], k) => (
      <Sequence key={k} from={fr(at - from)} layout="none">
        <Audio src={staticFile(`sfx/${file}`)} volume={v * MASTER} />
      </Sequence>
    ))}
    {VO.filter(([at]) => at >= from && at < to).map(([at, f], k) => (
      <Sequence key={`v${k}`} from={fr(at - from)} layout="none">
        <Audio src={staticFile(`${f}.wav`)} volume={1.1 * MASTER} />
      </Sequence>
    ))}
  </>
);

// 장면 심사용 — 글 없이 핵심 장면 둘(한쪽 눈에 쏙 → 다른 눈에도 쏙)과 소리만
const 앞길이 = SCENE.to - SCENE.from;
export const SCENE_FRAMES = fr(앞길이 + SCENE.뒤끝 - SCENE.뒤);
const SceneFlake: React.FC = () => <Flake2 t={useCurrentFrame() / FPS + SCENE.뒤 - 앞길이} />;
export const SceneBare: React.FC = () => (
  <AbsoluteFill style={{ background: '#0e1220' }}>
    {SHOTS.filter((s) => s.at >= SCENE.from && s.at < SCENE.to).map((s, k) => <ShotLayer key={k} s={s} base={SCENE.from} />)}
    {SHOTS.filter((s) => s.at >= SCENE.뒤 && s.at < SCENE.뒤끝).map((s, k) => <ShotLayer key={`b${k}`} s={s} base={SCENE.뒤 - 앞길이} />)}
    <SceneFlake />
    <Sequence durationInFrames={fr(앞길이)} layout="none"><Sound from={SCENE.from} to={SCENE.to} music={false} /></Sequence>
    <Sequence from={fr(앞길이)} layout="none"><Sound from={SCENE.뒤} to={SCENE.뒤끝} music={false} /></Sequence>
  </AbsoluteFill>
);

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{ background: '#0e1220' }}>
      {SHOTS.map((s, k) => <ShotLayer key={k} s={s} />)}
      <Flake2 t={t} />
      {/* 쏙 — 눈송이가 붙는 순간 하얗게 번쩍 */}
      {[HIT1, HIT2].map((at) => (t >= at - 0.02 && t < at + 0.16 ? <AbsoluteFill key={at} style={{ background: '#F2FAFF', opacity: interpolate(t, [at - 0.02, at + 0.03, at + 0.16], [0, 0.14, 0], clamp) }} /> : null))}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 700, background: 'linear-gradient(to bottom, rgba(6,8,16,0.5) 0%, rgba(6,8,16,0.28) 58%, rgba(6,8,16,0) 100%)' }} />
      {/* 머리(0~3초) — 큰 「눈」 · 읽는 법 · 물음 */}
      {t < 3.0 ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 262, textAlign: 'center', textShadow: SH }}>
          <Glow x={540} y={200} w={900} h={520} a={0.55} />
          <div style={{ position: 'relative', fontFamily: KO, fontWeight: 900, fontSize: 210, color: CREAM, lineHeight: 1 }}>{TXT.hookKo}</div>
          <div style={{ position: 'relative', fontFamily: EN, fontWeight: 700, fontSize: 60, color: DIM, fontStyle: 'italic', lineHeight: 1.2 }}>{TXT.hookRead}</div>
          <div style={{ position: 'relative', fontFamily: EN, fontWeight: 800, fontSize: 64, color: PINK, lineHeight: 1.2 }}>{TXT.hookQ}</div>
        </div>
      ) : null}
      {/* 14.65~18.05 — 그림 속 열린 눈과 눈송이를 차례로 가리키는 이름표 둘(0.85초 사이) */}
      <Tag t={t} from={14.7} until={18.05} x={TAG_EYE.x} y={TAG_EYE.y} lx={770} ly={760} text={TXT.tagEye} />
      <Tag t={t} from={15.55} until={18.05} x={TAG_SNOW.x} y={TAG_SNOW.y} lx={520} ly={560} text={TXT.tagSnow} />
      {t >= 20.5 ? (
        <div style={{ position: 'absolute', left: 60, right: 160, top: 330, textAlign: 'center', textShadow: SH, opacity: interpolate(t, [20.5, 20.65], [0, 1], clamp) }}>
          <Glow x={430} y={120} w={1000} h={420} a={0.6} />
          <div style={{ position: 'relative', fontFamily: KO, fontWeight: 900, fontSize: 130, color: CREAM, lineHeight: 1.1 }}>눈에 눈</div>
          <div style={{ position: 'relative', fontFamily: EN, fontWeight: 800, fontSize: 60, color: PINK, lineHeight: 1.2 }}>snow in your eye</div>
        </div>
      ) : null}
      {SAY.map((w) => <튀는글자 key={w.at} w={w} />)}
      <Sound from={0} to={TOTAL} music />
    </AbsoluteFill>
  );
};
