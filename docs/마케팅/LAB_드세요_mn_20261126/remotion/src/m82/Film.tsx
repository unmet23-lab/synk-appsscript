// LAB 몽골 M82 「드세요」 — 본보기(영상시험_20261125/본보기_Film.tsx)의 ShotLayer로 칸을 깔고, 말풍선 · 머리 글 · 끝 줄 · 소리를 얹는다.
// 칸마다 12% 천천히 다가가고 반전 칸만 짧게 흔든다(제작 절차 lab-whole-video · 「더 먹어」 S74). 말풍선은 본보기 「온전한 말풍선」(lab-lettering).
import React from 'react';
import { AbsoluteFill, Audio, Easing, getStaticFiles, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CUTS, Cut, END, FILM, FPS, fr, HEAD, SAYS, SCENE_FROM, SCENE_TO, SFX, VO } from './data';
import { 말풍선, OK } from './말풍선';

export { FPS };
const MASTER = 0.8;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const INK = '#2B1B12';
const PAPER = '#FFF8EC';
const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });

// 아직 받지 못한 샷(Flow가 막힌 날)은 그 샷의 시작 그림으로 칸을 메운다 — public/still(git 밖)
const 받은샷 = new Set(getStaticFiles().map((f) => f.name));

const CutLayer: React.FC<{ c: Cut }> = ({ c }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const z = (c.zoom ?? 1) * interpolate(t, [0, c.len], [1, 1.12], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const sk = c.shake != null ? c.shake - c.at : null;
  const dx = sk != null && t >= sk && t < sk + 0.4 ? Math.sin(t * 70) * 9 * (1 - (t - sk) / 0.4) : 0;
  return (
    <AbsoluteFill style={{ transform: `translateX(${dx}px) scale(${z})`, transformOrigin: `${c.ox ?? 50}% ${c.oy ?? 50}%` }}>
      {받은샷.has(`vid/${c.vid}`) ? (
          <OffthreadVideo src={staticFile(`vid/${c.vid}`)} muted startFrom={fr(c.from ?? 0)} playbackRate={c.rate ?? 1} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Img src={staticFile(`still/${c.vid.replace('.mp4', '.jpg')}`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
    </AbsoluteFill>
  );
};

const Cuts: React.FC<{ from?: number; to?: number }> = ({ from = 0, to = FILM }) => (
  <>
    {CUTS.filter((c) => c.at < to && c.at + c.len > from).map((c, i) => (
      <Sequence key={i} from={fr(c.at - from)} durationInFrames={fr(c.len)} layout="none">
        <CutLayer c={c} />
      </Sequence>
    ))}
  </>
);

// 머리 글 — 얻는 것의 약속(원본 성함 · 계세요의 위 한 줄 자리)
const Head: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < fr(HEAD.at) || frame >= fr(HEAD.to)) return null;
  const p = pop(frame, HEAD.at);
  const o = interpolate(frame, [fr(HEAD.to) - 5, fr(HEAD.to)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: 220, textAlign: 'center', opacity: o, transform: `scale(${0.9 + 0.1 * p})` }}>
      <div style={{ display: 'inline-block', background: PAPER, border: `6px solid ${INK}`, borderRadius: 30, padding: '14px 34px 18px', boxShadow: '0 10px 26px rgba(0,0,0,0.35)' }}>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 60, color: INK, lineHeight: 1.15 }}>{HEAD.l1}</div>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 84, color: INK, lineHeight: 1.12 }}>{HEAD.l2}</div>
      </div>
    </div>
  );
};

const End: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < fr(END.at) || frame >= fr(END.to)) return null;
  const p = pop(frame, END.at);
  return (
    <div style={{ position: 'absolute', left: 50, right: 50, top: 240, textAlign: 'center', transform: `scale(${0.85 + 0.15 * p})`, opacity: Math.min(1, p * 1.5) }}>
      <span style={{ display: 'inline-block', background: PAPER, border: `6px solid ${INK}`, borderRadius: 34, padding: '16px 36px 20px', boxShadow: '0 10px 26px rgba(0,0,0,0.35)', fontFamily: KO, fontWeight: 900, fontSize: 82, color: INK, lineHeight: 1.12 }}>
        {END.l1.split('드세요')[0]}<span style={{ color: OK }}>드세요</span>{END.l1.split('드세요')[1]}
      </span>
    </div>
  );
};

const Sound: React.FC<{ from: number; to: number; music: boolean }> = ({ from, to, music }) => (
  <>
    {music ? <Audio src={staticFile('bgm.wav')} volume={(i) => MASTER * 0.16 * interpolate(i, [fr(to - from) - 15, fr(to - from)], [1, 0], clamp)} endAt={fr(to - from)} /> : null}
    <Audio src={staticFile('sfx/street.wav')} startFrom={fr(from)} volume={(i) => MASTER * 0.18 * interpolate(i, [fr(to - from) - 10, fr(to - from)], [1, 0], clamp)} endAt={fr(to)} />
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

export const SceneBare: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#1d2238' }}>
    <Cuts from={SCENE_FROM} to={SCENE_TO} />
    <Sound from={SCENE_FROM} to={SCENE_TO} music={false} />
  </AbsoluteFill>
);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#1d2238' }}>
    <Cuts />
    <Head />
    {SAYS.map((s, i) => <말풍선 key={i} w={s} />)}
    <End />
    <Sound from={0} to={FILM} music />
  </AbsoluteFill>
);
