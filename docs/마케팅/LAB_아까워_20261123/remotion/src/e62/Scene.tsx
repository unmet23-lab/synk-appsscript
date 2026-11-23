// LAB 영어 E62 「아까워」 핵심 장면(한 장면 먼저 v1) — 제목 · 이름표 · 설명 없이 그림 · 말풍선 · 소리만(장면 심사용).
// 판은 칸마다 바꾸고(정지 동작 꼴), 몽글은 빈 배경 위의 층만 움직인다(웅크림 → 뛰어오름 → 가장자리에 매달려 흔들림 → 떨며 외침).
// 말풍선(E58 Bubble을 본뜸)은 말한 사람 머리 곁에서 꼬리를 그 사람에게(교훈 L21), 한국어 아래 영어 뜻 줄을 같은 순간에(교훈 L08).
// 글자는 안전선(가로 65~920 · 세로 269~1428) 안. 맞음 · 틀림이 없는 장면이라 초록 · 빨강을 쓰지 않는다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CELLS, FPS, JUMP, LEAN, PLEAD, SCENE, SFX, SWING, T, TXT, VO } from './data';

export const fr = (sec: number) => Math.round(sec * FPS);
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const MASTER = 0.8;
export const SCENE_FRAMES = fr(SCENE);

export const INK = '#2A2230';
export const PAPER = '#FFF8EE';
export const MEAN = '#2F4BA0'; // 뜻 줄 — 맞음 · 틀림이 아닌 강조라 초록 · 빨강을 피한다

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

export const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.7)) });

export const Bubble: React.FC<{ at: number; to: number; ko: string; mean: string; x: number; y: number; tail?: number; koSize?: number; meanSize?: number; tailLen?: number }> = ({ at, to, ko, mean, x, y, tail = 0.5, koSize = 80, meanSize = 52, tailLen = 34 }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || frame >= fr(to)) return null;
  const p = pop(frame, at);
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-${tail * 100}%, -100%) scale(${0.85 + 0.15 * p})`, transformOrigin: `${tail * 100}% 100%`, opacity: Math.min(1, p * 1.5) }}>
      <div style={{ position: 'relative', background: PAPER, borderRadius: 38, padding: '12px 34px 16px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.3)', border: `5px solid ${INK}`, marginBottom: tailLen }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: koSize, color: INK, lineHeight: 1.12, whiteSpace: 'pre' }}>{ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: meanSize, color: MEAN, lineHeight: 1.15, marginTop: 2, whiteSpace: 'pre' }}>{mean}</div>
        <div style={{ position: 'absolute', left: `${tail * 100}%`, bottom: -tailLen, width: 0, height: 0, transform: 'translateX(-50%)', borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderTop: `${tailLen}px solid ${INK}` }} />
      </div>
    </div>
  );
};

// 층 — 원본과 같은 크기의 투명 PNG를 기준점(ox, oy)으로 옮기고 · 돌리고 · 키운다
export const LayerImg: React.FC<{ img: string; ox: number; oy: number; dx?: number; dy?: number; rot?: number; sx?: number; sy?: number }> = ({ img, ox, oy, dx = 0, dy = 0, rot = 0, sx = 1, sy = 1 }) => (
  <AbsoluteFill style={{ transformOrigin: `${ox}px ${oy}px`, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})` }}>
    <Img src={staticFile(`img/${img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
  </AbsoluteFill>
);

// 바닥 그림자 — 빈 판에는 몽글 그림자가 없으니 웅크린 몽글 밑에 깔고, 뛰어오르면 옅어진다
export const Shadow: React.FC<{ x: number; y: number; w: number; o: number }> = ({ x, y, w, o }) => (
  <div style={{ position: 'absolute', left: x - w / 2, top: y - 18, width: w, height: 36, borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(40,20,10,0.45), rgba(40,20,10,0) 70%)', opacity: o }} />
);

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.18 * MASTER * interpolate(i, [fr(SCENE) - 12, fr(SCENE)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/bunsik.wav')} volume={MASTER * 0.3} endAt={fr(SCENE)} />
    {VO.map(([t, v]) => (
      <Sequence key={v} from={fr(t)} layout="none">
        <Audio src={staticFile(`${v}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

export const Scene: React.FC<{ silent?: boolean }> = ({ silent = false }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const i = cellAt(t);
  const cell = CELLS[i];
  const next = i + 1 < CELLS.length ? CELLS[i + 1].at : SCENE;
  const range = cell.push || [1.0, 1.03];
  let push = interpolate(t, [cell.at, next], range, { ...clamp, easing: Easing.inOut(Easing.quad) });
  if (cell.img === 'p5.jpg') push = interpolate(t, [cell.at, cell.at + 0.12, next], [range[0], range[1], range[1]], { ...clamp, easing: Easing.out(Easing.cubic) }); // 굳는 순간 확 다가감

  let layer: React.ReactNode = null;
  let shadow: React.ReactNode = null;
  let shake = [0, 0];
  if (cell.img === 'layer/p1_bg.jpg') {
    const u = (t - LEAN.from) / (LEAN.to - LEAN.from);
    const e = Easing.inOut(Easing.quad)(Math.min(1, u * 1.4));
    const bob = Math.sin(u * Math.PI * 3) * 0.02; // 들썩 — 훌쩍이는 숨
    const [bx, by] = LEAN.base;
    layer = <LayerImg img={LEAN.img} ox={bx} oy={by} rot={LEAN.deg * e} sx={1 + bob * 0.5} sy={1 - bob} />;
    shadow = <Shadow x={bx} y={by - 6} w={440} o={0.8} />;
  } else if (cell.img === 'layer/p2_bg_f.jpg') {
    const [bx, by] = JUMP.base;
    if (t < JUMP.crouch) {
      const u = (t - JUMP.from) / (JUMP.crouch - JUMP.from);
      const e = Easing.out(Easing.quad)(Math.min(1, u * 1.3));
      layer = <LayerImg img={JUMP.img} ox={bx} oy={by} sx={1 + 0.07 * e} sy={1 - 0.14 * e} />;
      shadow = <Shadow x={bx} y={by - 6} w={520} o={0.9} />;
    } else {
      const u = Math.min(1, (t - JUMP.crouch) / (JUMP.to - JUMP.crouch));
      const e = Easing.out(Easing.cubic)(u);
      const arc = Math.sin(Math.PI * Math.min(1, u * 1.1)) * 60; // 위로 볼록한 길
      layer = <LayerImg img={JUMP.img} ox={bx} oy={by} dx={JUMP.dx * e} dy={JUMP.dy * e - arc} rot={-12 * e} sx={1 - 0.12 * Math.sin(Math.PI * u)} sy={1 + 0.2 * Math.sin(Math.PI * u)} />;
      shadow = <Shadow x={bx + JUMP.dx * e * 0.4} y={by - 6} w={520 * (1 - 0.5 * e)} o={0.9 * (1 - e)} />;
    }
  } else if (cell.img === 'layer/p3_bg.jpg') {
    const u = t - SWING.from;
    const deg = SWING.deg * Math.exp(-u * SWING.decay) * Math.cos(2 * Math.PI * SWING.hz * u);
    const land = interpolate(u, [0, 0.08, 0.2], [0.93, 1.03, 1.0], clamp); // 매달리는 순간 눌렸다 펴짐
    layer = <LayerImg img={SWING.img} ox={SWING.pivot[0]} oy={SWING.pivot[1]} dx={SWING.swayPx * (deg / SWING.deg)} rot={deg} sx={1} sy={land} />;
    if (u < 0.18) shake = [(random(`sh-${frame}`) - 0.5) * 14 * (1 - u / 0.18), (random(`sv-${frame}`) - 0.5) * 10 * (1 - u / 0.18)];
  } else if (cell.img === 'layer/p4_bg.jpg') {
    const q = Math.floor(frame / 2);
    const dx = (random(`pq-${q}`) - 0.5) * 2 * PLEAD.px;
    const dy = (random(`pv-${q}`) - 0.5) * 2 * PLEAD.px * 0.6;
    const beat = PLEAD.beats.reduce((m, b) => (t >= b ? Math.max(m, Math.exp(-(t - b) * 9)) : m), 0); // 마디마다 확 늘었다 잦아듦
    const s = 1 + 0.07 * beat;
    const rot = PLEAD.sway * Math.sin((t - PLEAD.from) * Math.PI * 2 * 1.1);
    layer = <LayerImg img={PLEAD.img} ox={PLEAD.pivot[0]} oy={PLEAD.pivot[1]} dx={dx} dy={dy} rot={rot} sx={1 - (s - 1) * 0.35} sy={s} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#e9d3b3', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: cell.origin || '50% 50%', transform: `translate(${shake[0]}px, ${shake[1]}px) scale(${push})` }}>
        <Img src={staticFile(`img/${cell.img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
        {shadow}
        {layer}
      </AbsoluteFill>
      {/* 아주머니 「다 드셨죠~?」 — 아주머니 머리 위, 꼬리가 아주머니에게 */}
      <Bubble at={T.a1} to={T.a1To} ko={TXT.a1} mean={TXT.a1m} x={250} y={690} tail={0.3} koSize={76} meanSize={50} />
      {/* 몽글 「아까워!」 — 매달린 몽글 머리 위, 꼬리가 몽글에게 */}
      <Bubble at={T.m1} to={T.m1To} ko={TXT.m1} mean={TXT.m1m} x={560} y={500} tail={0.5} koSize={96} meanSize={54} />
      {silent ? null : <Sound />}
    </AbsoluteFill>
  );
};
