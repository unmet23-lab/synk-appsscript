// LAB 몽골 M54 「빨리빨리」 — 드세요(M82)의 칸 짜임을 본떠 정지 그림으로 칸을 깔고(Flow 두 계정 막힘), 말풍선 · 머리 글 · 이름표 · 표시창 숫자 · ⏪ 첫날 · 끝 줄 · 소리를 얹는다.
// 칸마다 12% 천천히 다가가고 반전 칸만 짧게 흔든다(제작 절차 lab-whole-video · 「더 먹어」 S74). 말풍선은 본보기 「온전한 말풍선」(lab-lettering).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO, MONO } from '../lib/fonts';
import { CUTS, Cut, END, FILM, FLASH, FPS, fr, HEAD, SAYS, SCENE_FROM, SCENE_TO, SFX, TAGS, Tag, VO } from './data';
import { 말풍선 } from './말풍선';

export { FPS };
const MASTER = 0.8;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const INK = '#2B1B12';
const PAPER = '#FFF8EC';
const GO = '#D9480F'; // 빨리빨리 — 맞음 · 틀림이 아닌 강조라 초록 · 빨강을 쓰지 않는다(제작 절차 「맞는 말과 틀린 말」)
const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });

// 표시창 숫자 — 그림 층 안에 둬 다가가기와 함께 움직인다
const Display: React.FC<{ c: Cut; t: number }> = ({ c, t }) => {
  const d = c.disp;
  if (!d || !d.w) return null;
  const now = c.at + t;
  const cur = [...d.seq].reverse().find(([s]) => now >= s - 0.001);
  if (!cur) return null;
  const flash = interpolate(now, [cur[0], cur[0] + 0.12], [1.5, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: d.x, top: d.y, width: d.w, height: d.h, display: 'flex', alignItems: 'center', justifyContent: 'center', ...(d.판 ? { background: '#15201A', borderRadius: 8, boxShadow: 'inset 0 0 8px rgba(0,0,0,0.8)' } : {}) }}>
      <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: d.size, color: '#8DFFB0', letterSpacing: -2, textShadow: `0 0 ${10 * flash}px rgba(120,255,170,0.9), 0 0 ${24 * flash}px rgba(80,230,140,0.6)`, filter: `brightness(${flash})` }}>{cur[1]}</span>
    </div>
  );
};

const CutLayer: React.FC<{ c: Cut }> = ({ c }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const pk = c.punch != null ? interpolate(t, [c.punch - c.at, c.punch - c.at + 0.12], [1, 1.07], { ...clamp, easing: Easing.out(Easing.back(2)) }) : 1; // 알약이 뜰 때 한 번 다가감(장면 심사 v3 「웃는 얼굴이 그대로 서 있다」)
  const z = (c.zoom ?? 1) * pk * interpolate(t, [0, c.len], [1, 1.12], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const sk = c.shake != null ? c.shake - c.at : null;
  const dx = (sk != null && t >= sk && t < sk + 0.4 ? Math.sin(t * 70) * 12 * (1 - (t - sk) / 0.4) : 0) + (c.lunge ? interpolate(t, [0, 0.14], [-90, 0], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0);
  return (
    <AbsoluteFill style={{ transform: `translateX(${dx}px) scale(${z})`, transformOrigin: `${c.ox ?? 50}% ${c.oy ?? 50}%` }}>
      <Img src={staticFile(`img/${c.img}.jpg`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <Display c={c} t={t} />
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

const Box: React.FC<{ children: React.ReactNode; size: number }> = ({ children, size }) => (
  <div style={{ display: 'inline-block', background: PAPER, border: `6px solid ${INK}`, borderRadius: 30, padding: '12px 32px 16px', boxShadow: '0 10px 26px rgba(0,0,0,0.35)', fontFamily: EN, fontWeight: 800, fontSize: size, color: INK, lineHeight: 1.15 }}>{children}</div>
);

// 머리 글 — 원본 「한국이 나를 망쳤다(?)」 자리
const Head: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < fr(HEAD.at) || frame >= fr(HEAD.to)) return null;
  const p = pop(frame, HEAD.at);
  const o = interpolate(frame, [fr(HEAD.to) - 5, fr(HEAD.to)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: 230, textAlign: 'center', opacity: o, transform: `scale(${0.9 + 0.1 * p})` }}>
      <Box size={74}>
        {HEAD.l1}
        <br />
        {HEAD.l2}
      </Box>
    </div>
  );
};

const TagBox: React.FC<{ g: Tag }> = ({ g }) => {
  const frame = useCurrentFrame();
  if (frame < fr(g.at) || frame >= fr(g.to)) return null;
  const p = pop(frame, g.at);
  return (
    <div style={{ position: 'absolute', ...(g.x != null ? { left: g.x, transform: `translateX(-50%) scale(${0.85 + 0.15 * p})` } : { left: 0, right: 0, textAlign: 'center' as const, transform: `scale(${0.85 + 0.15 * p})` }), top: g.y ?? 300, opacity: Math.min(1, p * 1.5) }}>
      <span style={{ display: 'inline-block', whiteSpace: 'nowrap', background: g.속 ? '#7A6352' : INK, color: PAPER, borderRadius: 999, padding: '8px 34px 12px', fontFamily: EN, fontWeight: 800, fontSize: 60, boxShadow: '0 8px 20px rgba(0,0,0,0.35)' }}>{g.t}</span>
    </div>
  );
};

// ⏪ 첫날 — 빛바랜 작은 그림(회상은 처음부터 표시로 가른다)
const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < fr(FLASH.at) || frame >= fr(FLASH.to)) return null;
  const p = pop(frame, FLASH.at);
  const h = Math.round((FLASH.w * 16) / 9);
  return (
    <div style={{ position: 'absolute', left: FLASH.x, top: FLASH.y, width: FLASH.w, transform: `scale(${0.8 + 0.2 * p}) rotate(3deg)`, opacity: Math.min(1, p * 1.5), transformOrigin: '50% 0%' }}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <span style={{ display: 'inline-block', background: INK, color: PAPER, borderRadius: 999, padding: '6px 24px 10px', fontFamily: EN, fontWeight: 800, fontSize: 50, whiteSpace: 'nowrap' }}>{FLASH.label}</span>
      </div>
      <div style={{ width: FLASH.w, height: h, borderRadius: 26, overflow: 'hidden', border: `8px solid ${PAPER}`, boxShadow: '0 12px 30px rgba(0,0,0,0.45)' }}>
        <Img src={staticFile(`img/${FLASH.img}.jpg`)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'sepia(0.55) saturate(0.8) brightness(1.05)' }} />
      </div>
    </div>
  );
};

const End: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < fr(END.at) || frame >= fr(END.to)) return null;
  const p = pop(frame, END.at);
  return (
    <div style={{ position: 'absolute', left: 40, right: 40, top: 240, textAlign: 'center', transform: `scale(${0.85 + 0.15 * p})`, opacity: Math.min(1, p * 1.5) }}>
      <span style={{ display: 'inline-block', background: PAPER, border: `6px solid ${INK}`, borderRadius: 34, padding: '16px 34px 20px', boxShadow: '0 10px 26px rgba(0,0,0,0.35)', fontFamily: EN, fontWeight: 800, fontSize: 60, color: INK, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
        {END.l1}
        <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 76, color: GO }}>{END.ko}</span>
      </span>
    </div>
  );
};

const Sound: React.FC<{ from: number; to: number; music: boolean }> = ({ from, to, music }) => (
  <>
    {music ? <Audio src={staticFile('bgm.wav')} volume={(i) => MASTER * 0.16 * interpolate(i, [fr(to - from) - 15, fr(to - from)], [1, 0], clamp)} endAt={fr(to - from)} /> : null}
    <Audio src={staticFile('sfx/room.wav')} startFrom={fr(from)} volume={(i) => MASTER * 0.16 * interpolate(i, [fr(to - from) - 10, fr(to - from)], [1, 0], clamp)} endAt={fr(to)} />
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

// 장면 심사용 — 핵심 칸(4 · 5)을 글 없이 소리째
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
    {TAGS.map((g, i) => <TagBox key={i} g={g} />)}
    <Flash />
    {SAYS.map((s, i) => <말풍선 key={i} w={s} />)}
    <End />
    <Sound from={0} to={FILM} music />
  </AbsoluteFill>
);
