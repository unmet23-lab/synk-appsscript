// LAB 영어 E52 「ㅋㅋㅋ」 — 본보기(영상시험_20261125/본보기_Film.tsx)의 ShotLayer로 칸을 깔고, 말풍선 · 머리 글 · ㅋ 폭포 · 끝 줄 · 소리를 얹는다.
// 칸마다 12% 천천히 다가가고 반전 칸만 짧게 흔든다(제작 절차 lab-whole-video · 「더 먹어」 S74). 말풍선은 본보기 「온전한 말풍선」(lab-lettering).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CUTS, Cut, END, FILM, FPS, fr, HEAD, POUR, SAYS, SCENE_FROM, SCENE_TO, SFX, VO } from './data';
import { 말풍선, NG } from './말풍선';

export { FPS };
const MASTER = 0.8;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const INK = '#2B1B12';
const PAPER = '#FFF8EC';
const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });

// 칸 하나 — 영상 + 그 칸 배율로 함께 움직이는 덧그림(ㅋ 폭포)
const CutLayer: React.FC<{ c: Cut; over?: React.ReactNode }> = ({ c, over }) => {
  const frame = useCurrentFrame(); // Sequence 안 — 칸 첫 프레임이 0
  const t = frame / FPS;
  const z0 = c.zoom ?? 1;
  const z = z0 * interpolate(t, [0, c.len], [1, 1.12], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const sk = c.shake != null ? c.shake - c.at : null;
  const dx = sk != null && t >= sk && t < sk + 0.4 ? Math.sin(t * 70) * 9 * (1 - (t - sk) / 0.4) : 0;
  return (
    <AbsoluteFill style={{ transform: `translateX(${dx}px) scale(${z})`, transformOrigin: `${c.ox ?? 50}% ${c.oy ?? 50}%` }}>
      <OffthreadVideo src={staticFile(`vid/${c.vid}`)} muted startFrom={fr(c.from ?? 0)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {over}
    </AbsoluteFill>
  );
};

// ㅋ 폭포 — 오린 펠트 ㅋ(img/kieuk.png)이 친구 폰에서 튀어 올라 떨어져 바닥에 쌓인다. 편 초 기준(편 frame)
const 씨앗 = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const Pour: React.FC<{ filmFrame: number }> = ({ filmFrame }) => {
  const t = filmFrame / FPS - POUR.at;
  if (t < 0) return null;
  const x0 = (POUR.from.x / 100) * 1080;
  const y0 = (POUR.from.y / 100) * 1920;
  return (
    <>
      {Array.from({ length: POUR.n }).map((_, i) => {
        const born = i * 0.16;
        const u = t - born;
        if (u < 0) return null;
        const r1 = 씨앗(i + 1);
        const r2 = 씨앗(i + 7);
        const vx = (r1 - 0.62) * 900; // 대개 왼쪽(친구 쪽)으로
        const vy = -1500 - r2 * 700;
        const g = 3200;
        const floor = 1500 + (i % 4) * 70;
        let x = x0 + vx * u;
        let y = y0 + vy * u + 0.5 * g * u * u;
        let rot = (r1 - 0.5) * 540 * u;
        if (y > floor && u > 0.3) {
          const tl = (-vy + Math.sqrt(vy * vy + 2 * g * (floor - y0))) / g; // 바닥에 닿은 때
          x = x0 + vx * tl;
          y = floor;
          rot = (r1 - 0.5) * 540 * tl;
        }
        const size = 170 + r2 * 90;
        const s = Math.min(1, u * 6);
        return (
          <Img key={i} src={staticFile('img/kieuk.png')} style={{ position: 'absolute', left: x - size / 2, top: y - size * 0.62, width: size, transform: `rotate(${rot}deg) scale(${s})`, filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.35))' }} />
        );
      })}
    </>
  );
};

const Cuts: React.FC<{ from?: number; to?: number }> = ({ from = 0, to = FILM }) => {
  const filmFrame = useCurrentFrame();
  return (
    <>
      {CUTS.filter((c) => c.at < to && c.at + c.len > from).map((c, i) => (
        <Sequence key={i} from={fr(c.at - from)} durationInFrames={fr(c.len)} layout="none">
          <CutLayer c={c} over={c.vid === 's8.mp4' ? <Pour filmFrame={filmFrame + fr(from)} /> : null} />
        </Sequence>
      ))}
    </>
  );
};

// 머리 글 — 원본의 「In Korea / we don’t say ✗」 약속(오마주.json 뼈대 훅 0.0)
const Head: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < fr(HEAD.at) || frame >= fr(HEAD.to)) return null;
  const p = pop(frame, HEAD.at);
  const strike = interpolate(frame, [fr(HEAD.at + 0.35), fr(HEAD.at + 0.6)], [0, 1], clamp);
  const o = interpolate(frame, [fr(HEAD.to) - 5, fr(HEAD.to)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, top: 230, textAlign: 'center', opacity: o, transform: `scale(${0.9 + 0.1 * p})` }}>
      <div style={{ display: 'inline-block', background: PAPER, border: `6px solid ${INK}`, borderRadius: 30, padding: '14px 34px 18px', boxShadow: '0 10px 26px rgba(0,0,0,0.35)' }}>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 56, color: INK, lineHeight: 1.15 }}>{HEAD.l1}</div>
        <div style={{ position: 'relative', display: 'inline-block', fontFamily: EN, fontWeight: 900, fontSize: 104, color: INK, lineHeight: 1.05 }}>
          “{HEAD.l2}” <span style={{ color: NG }}>✗</span>
          <div style={{ position: 'absolute', left: 0, top: '52%', height: 10, width: `${78 * strike}%`, background: NG, borderRadius: 5 }} />
        </div>
      </div>
    </div>
  );
};

// 끝 줄 — 제목만 한 크기 한 줄(가장 센 장면 위)
const End: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < fr(END.at) || frame >= fr(END.to)) return null;
  const p = pop(frame, END.at);
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: 250, textAlign: 'center', transform: `scale(${0.85 + 0.15 * p})`, opacity: Math.min(1, p * 1.5) }}>
      <span style={{ display: 'inline-block', background: PAPER, border: `6px solid ${INK}`, borderRadius: 34, padding: '16px 40px 20px', boxShadow: '0 10px 26px rgba(0,0,0,0.35)', fontFamily: KO, fontWeight: 900, fontSize: 104, color: INK, lineHeight: 1.1 }}>{END.l1}</span>
    </div>
  );
};

const Sound: React.FC<{ from: number; to: number; music: boolean }> = ({ from, to, music }) => (
  <>
    {music ? <Audio src={staticFile('bgm.wav')} volume={(i) => MASTER * 0.17 * interpolate(i, [fr(to - from) - 15, fr(to - from)], [1, 0], clamp)} endAt={fr(to - from)} /> : null}
    {VO.filter(([t]) => t >= from - 0.01 && t < to).map(([t, v, vol]) => (
      <Sequence key={v} from={fr(t - from)} layout="none">
        <Audio src={staticFile(`vo/${v}.wav`)} volume={MASTER * (vol ?? 1)} />
      </Sequence>
    ))}
    {SFX.filter(([t]) => t >= from - 0.01 && t < to).map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t - from)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

// 장면 심사용 — 글 없이 그림과 소리만(제작 절차 「한 장면 먼저」)
export const SceneBare: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#3a2a24' }}>
    <Cuts from={SCENE_FROM} to={SCENE_TO} />
    <Sound from={SCENE_FROM} to={SCENE_TO} music={false} />
  </AbsoluteFill>
);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#3a2a24' }}>
    <Cuts />
    <Head />
    {SAYS.map((s, i) => <말풍선 key={i} w={s} />)}
    <End />
    <Sound from={0} to={FILM} music />
  </AbsoluteFill>
);
