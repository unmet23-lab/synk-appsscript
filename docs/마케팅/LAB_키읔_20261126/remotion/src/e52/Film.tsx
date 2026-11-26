// LAB 영어 E52 「ㅋㅋㅋ」 — 본보기(영상시험_20261125/본보기_Film.tsx)의 ShotLayer로 칸을 깔고, 말풍선 · 머리 글 · ㅋ 폭포 · 끝 줄 · 소리를 얹는다.
// 칸마다 12% 천천히 다가가고 반전 칸만 짧게 흔든다(제작 절차 lab-whole-video · 「더 먹어」 S74). 말풍선은 본보기 「온전한 말풍선」(lab-lettering).
import React from 'react';
import { AbsoluteFill, Audio, Easing, getStaticFiles, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CUTS, Cut, END, FILM, FPS, fr, HEAD, POUR, SAYS, SCENE_FROM, SCENE_TO, SFX, VO } from './data';
import { 말풍선 } from './말풍선';

export { FPS };
const MASTER = 0.8;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const INK = '#2B1B12';
const PAPER = '#FFF8EC';
const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });

// 칸 하나 — 영상 + 그 칸 배율로 함께 움직이는 덧그림(ㅋ 폭포)
// 아직 받지 못한 샷(Flow가 막힌 날)은 그 샷의 시작 그림으로 칸을 메운다 — public/still(git 밖)
const 받은샷 = new Set(getStaticFiles().map((f) => f.name));

const CutLayer: React.FC<{ c: Cut; over?: React.ReactNode }> = ({ c, over }) => {
  const frame = useCurrentFrame(); // Sequence 안 — 칸 첫 프레임이 0
  const t = frame / FPS;
  const z0 = c.zoom ?? 1;
  const z = z0 * interpolate(t, [0, c.len], [1, 1.12], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const sk = c.shake != null ? c.shake - c.at : null;
  const dx = sk != null && t >= sk && t < sk + 0.4 ? Math.sin(t * 70) * 9 * (1 - (t - sk) / 0.4) : 0;
  return (
    <AbsoluteFill style={{ transform: `translateX(${dx}px) scale(${z})`, transformOrigin: `${c.ox ?? 50}% ${c.oy ?? 50}%` }}>
      {받은샷.has(`vid/${c.vid}`) ? (
          <OffthreadVideo src={staticFile(`vid/${c.vid}`)} muted startFrom={fr(c.from ?? 0)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Img src={staticFile(`still/${c.vid.replace('.mp4', '.jpg')}`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
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
  if (t < -0.25) return null;
  const x0 = (POUR.from.x / 100) * 1080;
  const y0 = (POUR.from.y / 100) * 1920;
  const 빛 = interpolate(t, [-0.2, 0, 0.35, 0.8], [0, 1, 0.8, 0], clamp); // 친구 폰에 도착 — 화면이 환해짐
  return (
    <>
      <div style={{ position: 'absolute', left: x0 - 170, top: y0 - 120, width: 340, height: 240, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(225,245,255,0.95), rgba(160,215,255,0.5) 55%, rgba(160,215,255,0))', opacity: 빛 }} />
      {Array.from({ length: POUR.n }).map((_, i) => {
        const born = i * 0.16;
        const u = t - born;
        if (u < 0) return null;
        const r1 = 씨앗(i + 1);
        const r2 = 씨앗(i + 7);
        // 낮은 포물선 — 꼭대기가 친구 얼굴(y 1110 언저리)보다 아래에 머물게(얼굴을 가리지 않음), 대개 왼쪽 바닥으로 퍼진다
        const vx = (r1 - 0.65) * 1500;
        const vy = -700 - r2 * 250;
        const g = 3200;
        const floor = 1560 + (i % 4) * 80;
        let x = x0 + vx * u;
        let y = y0 + vy * u + 0.5 * g * u * u;
        // 많이 돌면 ㅋ이 ㅌ · ㄷ처럼 읽힌다 — ±25도 안에서만 기운다
        let rot = (r1 - 0.5) * 50 * Math.min(1, u * 3);
        if (y > floor && u > 0.3) {
          const tl = (-vy + Math.sqrt(vy * vy + 2 * g * (floor - y0))) / g; // 바닥에 닿은 때
          x = x0 + vx * tl;
          y = floor;
          rot = (r1 - 0.5) * 50;
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
  const o = interpolate(frame, [fr(HEAD.to) - 5, fr(HEAD.to)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, top: 285, textAlign: 'center', opacity: o, transform: `scale(${0.9 + 0.1 * p})` }}>
      <div style={{ display: 'inline-block', background: PAPER, border: `6px solid ${INK}`, borderRadius: 30, padding: '14px 34px 18px', boxShadow: '0 10px 26px rgba(0,0,0,0.35)' }}>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 56, color: INK, lineHeight: 1.15 }}>{HEAD.l1}</div>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 100, color: INK, lineHeight: 1.08, whiteSpace: 'nowrap' }}>{HEAD.l2}</div>
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
      <span style={{ display: 'inline-block', background: PAPER, border: `6px solid ${INK}`, borderRadius: 34, padding: '16px 40px 20px', boxShadow: '0 10px 26px rgba(0,0,0,0.35)', fontFamily: KO, fontWeight: 900, fontSize: 86, color: INK, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{END.l1}</span>
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
    {/* 보낸 문자는 장면 속 일이라 장면 판에도 둔다(머리 글 · 끝 줄은 뺀다) */}
    <Sequence from={-fr(SCENE_FROM)} layout="none">
      {SAYS.filter((s) => s.at < SCENE_TO && s.to > SCENE_FROM).map((s, i) => <말풍선 key={i} w={s} />)}
    </Sequence>
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
