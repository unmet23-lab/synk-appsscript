// LAB 몽골 M76 「놀랐을 때 네 마디」(11-25) — 편 전체를 영상으로. 샷은 ShotLayer로 깔고(영상시험_20261125/본보기_Film.tsx) 말풍선 · 위 한 줄 · 소리를 얹는다. 카메라 밀기는 넣지 않는다.
// 글 꼴: 위 한 줄은 짙은 띠, 말은 「튀는 글자」(제작 절차 lab-lettering — 배우는 말만 노랑, 꼬리는 말한 사람 쪽 · 교훈 L21). 읽는 줄 앞 「n/4」는 머리 글 「4 хэллэг」의 몇째 마디인지(교훈 L11).
// 한글 · [읽는 법] · 뜻 세 줄(교훈 L08). 읽는 법은 [ ]로 감싼다 — 「хөл」이 몽골어 「발」로 읽히지 않게(11-25 Fable · Opus가 같이 짚음).
import React from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BGM_VOL, END, FILM, FPS, fr, HOOK, PHRASES, SCENE, SFX, Shot, SHOTS, SITS, STAFF, VO } from './data';
import { LocPack } from './판본';
import { 꼬리, 튀는글자 } from './튀는글자';

export { FPS };
export const TOTAL_FRAMES = fr(FILM);
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const INK = '#2B1524';
const PAPER = '#FFF8EC';
const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });

const ShotLayer: React.FC<{ s: Shot; base?: number }> = ({ s, base = 0 }) => (
  <Sequence from={fr(s.at - base)} durationInFrames={fr(s.len)} layout="none">
    <AbsoluteFill>
      <OffthreadVideo src={staticFile(`vid/${s.vid}`)} muted startFrom={fr(s.from ?? 0)} playbackRate={s.rate ?? 1} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </AbsoluteFill>
  </Sequence>
);

// 머리 글 — 0~4초(첫 말이 떠도 남는다)
const Hook: React.FC<{ pk: LocPack }> = ({ pk }) => {
  const frame = useCurrentFrame();
  if (frame >= fr(HOOK.to)) return null;
  const p = interpolate(frame, [0, 6], [0.94, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: 'absolute', left: 65, right: 160, top: 280, display: 'flex', justifyContent: 'center', transform: `scale(${p})` }}>
      <div style={{ background: PAPER, border: `6px solid ${INK}`, borderRadius: 28, padding: '14px 36px 18px', textAlign: 'center', boxShadow: '0 12px 30px rgba(0,0,0,0.45)', color: INK, fontFamily: pk.font, fontWeight: 900, fontSize: pk.hookSize, lineHeight: Math.max(1.14, pk.lineH), whiteSpace: 'pre-line' }}>
        {pk.hookTop.trim() ? <div style={{ fontWeight: 800, fontSize: Math.round(pk.hookSize * 0.68), color: '#7A2F63' }}>{pk.hookTop}</div> : null}
        {pk.hook}
      </div>
    </div>
  );
};

// 방마다 한 줄 — 짙은 띠
const Sit: React.FC<{ pk: LocPack; i: number }> = ({ pk, i }) => {
  const frame = useCurrentFrame();
  const { at, to } = SITS[i];
  if (frame < fr(at) || frame >= fr(to)) return null;
  const p = pop(frame, at);
  return (
    <div style={{ position: 'absolute', left: 65, right: 160, top: 285, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * -14}px)` }}>
      <div style={{ background: '#4B2745', borderRadius: 22, padding: '12px 30px 14px', textAlign: 'center', boxShadow: '0 10px 24px rgba(0,0,0,0.4)', color: PAPER, fontFamily: pk.font, fontWeight: 800, fontSize: pk.sitSize, lineHeight: Math.max(1.14, pk.lineH), whiteSpace: 'pre-line' }}>{pk.sits[i]}</div>
    </div>
  );
};

// 끝 줄 — 혼자 남은 몽글의 속말(꼬리가 몽글 머리로)
const EndLine: React.FC<{ pk: LocPack }> = ({ pk }) => {
  const frame = useCurrentFrame();
  if (frame < fr(END.at)) return null;
  const p = pop(frame, END.at);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: Math.min(1, p * 1.5), transform: `scale(${0.88 + 0.12 * p})`, transformOrigin: `${END.tip[0]}px ${END.tip[1]}px` }}>
      <꼬리 기점={[END.base, 796]} tip={END.tip} p={p} />
      <div style={{ position: 'absolute', left: 65, right: 160, bottom: 1920 - 790, textAlign: 'center', color: '#fff', WebkitTextStroke: `13px ${INK}`, paintOrder: 'stroke fill', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.35))', fontFamily: pk.font, fontWeight: 800, fontSize: pk.endSize, lineHeight: Math.max(1.18, pk.lineH), whiteSpace: 'pre-line' }}>{pk.end}</div>
    </div>
  );
};

const Sound: React.FC<{ from: number; to: number; music: boolean }> = ({ from, to, music }) => (
  <>
    {music ? <Audio src={staticFile('bgm.wav')} volume={(i) => MASTER * BGM_VOL * interpolate(i, [0, 8, fr(to - from) - 18, fr(to - from)], [0, 1, 1, 0], clamp)} endAt={fr(to - from)} /> : null}
    <Audio src={staticFile('sfx/room.wav')} volume={(i) => MASTER * 0.22 * interpolate(i, [fr(to - from) - 10, fr(to - from)], [1, 0], clamp)} endAt={fr(to - from)} />
    {VO.filter(([t]) => t >= from && t < to).map(([t, v]) => (
      <Sequence key={v} from={fr(t - from)} layout="none">
        <Audio src={staticFile(`vo/${v}.wav`)} volume={1.05 * MASTER} />
      </Sequence>
    ))}
    {SFX.filter(([t]) => t >= from && t < to).map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t - from)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

// 장면 심사용 — 글 없이 핵심 장면(h5)과 소리만
export const SceneBare: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#1d0a1c' }}>
    {SHOTS.filter((s) => s.at >= SCENE.from && s.at < SCENE.to).map((s, i) => <ShotLayer key={i} s={s} base={SCENE.from} />)}
    <Sound from={SCENE.from} to={SCENE.to} music={false} />
  </AbsoluteFill>
);

export const Film: React.FC<{ p: LocPack }> = ({ p }) => (
  <AbsoluteFill style={{ backgroundColor: '#1d0a1c' }}>
    {SHOTS.map((s, i) => <ShotLayer key={i} s={s} />)}
    <Hook pk={p} />
    {SITS.map((_, i) => <Sit key={i} pk={p} i={i} />)}
    {PHRASES.map((b) => <튀는글자 key={b.n} w={{ at: b.at, to: b.to, ko: [b.ko], key: b.key, read: `${b.n}/4  [${p.reads[b.n - 1]}]`, mean: p.means[b.n - 1], x: b.x, y: b.y, tip: b.tip, 감정: b.감정, 크기: b.크기, 글꼴: p.font, 뜻크기: p.meanSize, 줄높이: Math.max(1.16, p.lineH) }} />)}
    <튀는글자 w={{ at: STAFF.at, to: STAFF.to, ko: [STAFF.ko], key: STAFF.key, read: `[${p.reads[0]}]`, mean: p.staffMean, x: STAFF.x, y: STAFF.y, tip: STAFF.tip, 감정: STAFF.감정, 크기: STAFF.크기, 글꼴: p.font, 뜻크기: p.meanSize, 줄높이: Math.max(1.16, p.lineH) }} />
    <EndLine pk={p} />
    <Sound from={0} to={FILM} music />
  </AbsoluteFill>
);
