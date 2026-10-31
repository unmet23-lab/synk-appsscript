// LAB 영어 E19 「4층 F」 — 4층 버튼을 찾는 몽글, 일 · 이 · 삼까지 경쾌하게 세다 「사」에서 음악이 멎고 불이 나가며 F에 불이 들어온다.
// 사 = 4 = 死. 도착한 F층 문이 열리자 작은 유령들의 찻자리가 일제히 돌아보고, 문을 닫아 안도한 몽글의 머리 위에 유령 하나가 앉아 있다.
// 문은 닫힌 문 그림을 좌우로 갈라 실제로 밀고, 몽글만 그 위에 오려 얹는다(public/img/mongle_back.png). 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BTN, COUNT, Loc, LOCS, LocPack } from './data';
import { fr, T } from './timeline';

const C = { coral: '#F96859', coralShade: '#AE322A', brown: '#2B1A14', cream: '#FFFDF8', amber: '#FFC15E' };
const KO = "'SUIT', 'Inter Tight', sans-serif";
const EN = "'Inter Tight', 'SUIT', sans-serif";
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const K = 1080 / 940; // 장면 그림(940×1672) → 화면(1080×1920)
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
// 문 자리(그림 좌표) — 판/문닫힘 그림을 보고 맞췄다
const DOOR = { x0: 178, x1: 762, y0: 281, y1: 1283, mid: 470 };

// 불 깜빡임(0 = 꺼짐, 1 = 켜짐) — flicker.wav 끊김과 같은 자리
const lightAt = (t: number) => {
  if (t < T.count[3]) return 1;
  const s = t - T.count[3];
  if (s < 0.04) return 1;
  if (s < 0.12) return 0.06;
  if (s < 0.2) return 0.85;
  if (s < 0.36) return 0.05;
  if (s < 0.42) return 0.7;
  if (s < 0.47) return 0.05;
  if (s < 0.56) return 0.8;
  if (s < 0.74) return 0.04;
  return interpolate(s, [0.74, 1.05], [0.3, 0.92], clamp);
};

// ── 몽글 안(0~1.5초) ──
const Inside: React.FC<{ t: number }> = ({ t }) => {
  const z = interpolate(t, [0, T.panel], [1.03, 1.14], { ...clamp, easing: EASE_IO });
  const tilt = 0.8 * Math.sin(t * 2.4);
  return (
    <AbsoluteFill style={{ transform: `scale(${z}) rotate(${tilt * 0.25}deg)`, transformOrigin: `${760 * K}px ${680 * K}px` }}>
      <Img src={staticFile('img/in.jpg')} style={FULL} />
    </AbsoluteFill>
  );
};

const Bounce: React.FC<{ t: number }> = ({ t }) => {
  const s = t - T.count[1];
  const hop = Math.abs(Math.sin(s * 7.2)) * 26;
  return (
    <AbsoluteFill style={{ transform: `translateY(${-hop}px) scale(1.12)`, transformOrigin: `${470 * K}px ${900 * K}px` }}>
      <Img src={staticFile('img/in.jpg')} style={FULL} />
    </AbsoluteFill>
  );
};

// ── 버튼판: 세는 동안 1 → F로 올라가는 카메라, 불 들어오는 단추 ──
const YS = [BTN.y1, BTN.y2, BTN.y3, BTN.yF];
const Panel: React.FC<{ t: number }> = ({ t }) => {
  let y = YS[0];
  for (let i = 1; i < 4; i++) y = interpolate(t, [T.count[i] - 0.22, T.count[i] + 0.1], [y, YS[i]], { ...clamp, easing: EASE_IO });
  const s = 1.42 + 0.012 * Math.max(0, t - T.count[0]);
  const cy = y * K * s;
  const tx = 330 - BTN.x * K * s;
  const ty = Math.min(0, Math.max(1920 - 1920 * s, 900 - cy)); // 그림 밖이 보이지 않게
  const light = lightAt(t);
  // 올라가는 떨림 — 사에서 멎는다
  const shake = t < T.count[3] ? 1.6 * Math.sin(t * 61) : 0;
  const ghostOn = t >= T.ghost;
  const pop = interpolate(t, [T.ghost, T.ghost + 0.3], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ filter: `brightness(${light})`, backgroundColor: '#000' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty + shake}px) scale(${s})` }}>
        <Img src={staticFile(ghostOn ? 'img/panel_ghost.jpg' : 'img/panel_off.jpg')} style={FULL} />
        {!ghostOn
          ? COUNT.slice(0, 3).map((c, i) => {
              const on = interpolate(t, [T.count[i], T.count[i] + 0.1], [0, 1], clamp);
              const off = interpolate(t, [T.count[3], T.count[3] + 0.04], [1, 0], clamp);
              return <div key={i} style={{ position: 'absolute', left: (BTN.x - BTN.r * 1.1) * K, top: (YS[i] - BTN.r * 1.1) * K, width: BTN.r * 2.2 * K, height: BTN.r * 2.2 * K, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,214,120,0.72) 0%, rgba(255,184,70,0.5) 60%, rgba(255,170,50,0) 72%)', mixBlendMode: 'screen', opacity: on * off }} />;
            })
          : null}
        {ghostOn ? <div style={{ position: 'absolute', left: (BTN.x + 110) * K, top: (BTN.yF - 90) * K, width: 130 * K, height: 200 * K, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', filter: 'blur(26px)', opacity: 1 - pop, mixBlendMode: 'screen' }} /> : null}
      </div>
    </AbsoluteFill>
  );
};

// ── 세는 글 판(버튼판 오른쪽) ──
const CountBoard: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.count[0] || t >= T.eq1) return null;
  let k = 0;
  for (let i = 1; i < 4; i++) if (t >= T.count[i]) k = i;
  const s = t - T.count[k];
  const pop = interpolate(s, [0, 0.14], [0.82, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  const c = COUNT[k];
  const dark = k === 3;
  const inside = t >= T.count[1] - 0.05 && t < T.count[2] - 0.05;
  return (
    <div style={{ position: 'absolute', left: inside ? 365 : 560, top: inside ? 310 : 720, width: 350, height: 370, borderRadius: 30, background: '#140A06', border: '6px solid #8A6A2E', boxShadow: `0 0 34px rgba(255,180,70,${dark ? 0.55 : 0.3})`, transform: `scale(${pop})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 170, lineHeight: 1, color: dark ? '#FF6A4D' : C.amber, textShadow: '0 0 18px rgba(255,170,60,0.7)' }}>{c.ko}</div>
      <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 60, color: C.cream, marginTop: 10 }}>
        {c.read} · {c.n}
      </div>
    </div>
  );
};

// ── 사 = 4 = 死 ──
const Equation: React.FC<{ t: number; p: LocPack }> = ({ t, p }) => {
  if (t < T.eq1 || t >= T.react) return null;
  const a = interpolate(t, [T.eq1, T.eq1 + 0.16], [0, 1], { ...clamp, easing: EASE_OUT });
  const b = interpolate(t, [T.eq2, T.eq2 + 0.16], [0, 1], { ...clamp, easing: EASE_OUT });
  const hit = interpolate(t, [T.eq2, T.eq2 + 0.1, T.eq2 + 0.5], [0, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 90, width: 800, top: 1010, height: 380, borderRadius: 40, background: 'rgba(30,14,10,0.95)', boxShadow: '0 12px 30px rgba(0,0,0,0.4)', opacity: a, transform: `translateY(${(1 - a) * 24}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 112, lineHeight: 1.12, color: C.cream, whiteSpace: 'nowrap', transform: `translateY(${(1 - b) * 110}px)` }}>4 = 사</div>
      <div style={{ fontFamily: p.font, fontWeight: 800, fontSize: 112, lineHeight: 1.12, color: '#FF7A66', opacity: b, transform: `scale(${1 + 0.07 * hit})`, whiteSpace: 'nowrap' }}>
        {p.death} <span style={{ fontFamily: KO }}>= 사</span>
      </div>
      <div style={{ fontFamily: p.font, fontWeight: 800, fontSize: 54, lineHeight: p.lineH, color: C.amber, opacity: b, marginTop: 6, whiteSpace: 'nowrap' }}>{p.sameSound}</div>
    </div>
  );
};

// ── 몽글 얼굴 ──
const React_: React.FC<{ t: number }> = ({ t }) => {
  const s = t - T.react;
  const z = interpolate(s, [0, 2.2], [1.02, 1.16], { ...clamp, easing: EASE_OUT });
  const j = s < 0.5 ? 7 * Math.sin(s * 70) * (1 - s / 0.5) : 0;
  const flick = 0.92 + 0.06 * Math.sin(t * 13) * random(`f${Math.floor(t * 10)}`);
  return (
    <AbsoluteFill style={{ filter: `brightness(${flick})` }}>
      <Img src={staticFile('img/react.jpg')} style={{ ...FULL, transform: `translateX(${j}px) scale(${z})`, transformOrigin: `${470 * K}px ${760 * K}px` }} />
    </AbsoluteFill>
  );
};
const SoBoard: React.FC<{ t: number; p: LocPack }> = ({ t, p }) => {
  if (t < T.so || t >= T.arrive) return null;
  const a = interpolate(t, [T.so, T.so + 0.18], [0, 1], { ...clamp, easing: EASE_OUT });
  const pop = interpolate(t, [T.so + 0.3, T.so + 0.46], [0.7, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  const o2 = interpolate(t, [T.so + 0.3, T.so + 0.4], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: 60, width: 860, top: 300, borderRadius: 40, background: 'rgba(255,253,248,0.97)', boxShadow: '0 10px 28px rgba(0,0,0,0.3)', opacity: a, padding: '30px 30px 34px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontFamily: p.font, fontWeight: 800, fontSize: p.soSize, lineHeight: p.lineH, color: C.brown, textAlign: 'center' }}>{p.so}</div>
      <div style={{ fontFamily: p.font, fontWeight: 800, fontSize: 92, lineHeight: p.lineH, color: C.coralShade, opacity: o2, transform: `scale(${pop})`, marginTop: 8 }}>{p.soSub}</div>
    </div>
  );
};

const Patch: React.FC<{ t: number }> = ({ t }) => {
  const s = t - T.patch;
  const z = interpolate(s, [0, 1.5], [1.0, 1.12], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill>
      <Img src={staticFile('img/patch.jpg')} style={{ ...FULL, transform: `scale(${z})`, transformOrigin: `${470 * K}px ${900 * K}px` }} />
    </AbsoluteFill>
  );
};

// ── 문: 닫힌 그림을 좌우로 갈라 밀고, 뒤에 열린 그림 · 앞에 몽글 ──
const Doors: React.FC<{ t: number }> = ({ t }) => {
  const opening = interpolate(t, [T.open, T.opened], [0, 1], { ...clamp, easing: EASE_IO });
  const closing = interpolate(t, [T.slam, T.slamEnd], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const p = opening * (1 - closing);
  const w = (DOOR.mid - DOOR.x0) * K;
  const zoom = t >= T.slam ? 1.02 : interpolate(t, [T.arrive, T.opened, T.face], [1.0, 1.05, 1.42], { ...clamp, easing: EASE_IO });
  const thud = t >= T.slamEnd - 0.03 && t < T.slamEnd + 0.3 ? 11 * Math.sin((t - T.slamEnd) * 75) * (1 - (t - T.slamEnd) / 0.33) : 0;
  const clip: React.CSSProperties = { position: 'absolute', left: DOOR.x0 * K, top: DOOR.y0 * K, width: (DOOR.x1 - DOOR.x0) * K, height: (DOOR.y1 - DOOR.y0) * K, overflow: 'hidden' };
  const leaf = (side: 0 | 1) => {
    const baseLeft = side === 0 ? 0 : w;
    return (
      <div style={{ position: 'absolute', left: baseLeft + (side === 0 ? -1 : 1) * p * w, top: 0, width: side === 0 ? w : (DOOR.x1 - DOOR.mid) * K, height: '100%', overflow: 'hidden' }}>
        <Img src={staticFile('img/door_leaf.jpg')} style={{ position: 'absolute', left: -(side === 0 ? DOOR.x0 : DOOR.mid) * K, top: -DOOR.y0 * K, width: 1080, height: 1920 }} />
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ transform: `translateY(${thud}px) scale(${zoom})`, transformOrigin: `540px ${t >= T.slam ? 760 * K : 620 * K}px` }}>
      <Img src={staticFile('img/door_open.jpg')} style={FULL} />
      <Img src={staticFile('img/door_open2.jpg')} style={{ ...FULL, opacity: interpolate(t, [T.opened + 0.45, T.opened + 0.6], [0, 1], clamp) }} />
      <div style={clip}>
        {leaf(0)}
        {leaf(1)}
      </div>
      <Img src={staticFile('img/mongle_back.png')} style={FULL} />
      <div style={{ position: 'absolute', left: 470 * K - 90, top: 160 * K - 92, width: 180, height: 184, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: EN, fontWeight: 800, fontSize: 118, color: C.amber, textShadow: '0 0 26px rgba(255,190,90,0.9)' }}>F</div>
    </AbsoluteFill>
  );
};

const FloorSign: React.FC<{ t: number; p: LocPack }> = ({ t, p }) => {
  if (t < T.arrive || t >= T.face) return null;
  const a = interpolate(t, [T.arrive, T.arrive + 0.15], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 140, width: 800, top: 300, borderRadius: 30, background: '#140A06', border: '6px solid #8A6A2E', opacity: a, padding: '18px 0 22px', textAlign: 'center', fontFamily: p.font, fontWeight: 800, fontSize: 72, lineHeight: p.lineH, color: C.amber }}>{p.floorF}</div>
  );
};

const Face: React.FC<{ t: number }> = ({ t }) => {
  const s = t - T.face;
  const z = interpolate(s, [0, 0.75], [1.0, 1.1], clamp);
  const j = s < 0.4 ? 5 * Math.sin(s * 80) * (1 - s / 0.4) : 0;
  return (
    <AbsoluteFill>
      <Img src={staticFile('img/face.jpg')} style={{ ...FULL, transform: `translateX(${j}px) scale(${z})`, transformOrigin: `${470 * K}px ${760 * K}px` }} />
    </AbsoluteFill>
  );
};

// ── 안도: 머리 위 유령 ──
const Relief: React.FC<{ t: number }> = ({ t }) => {
  const push = interpolate(t, [T.relief, T.zoom], [1.0, 1.05], clamp);
  const go = interpolate(t, [T.zoom, T.pop], [0, 1], { ...clamp, easing: EASE_IO });
  const z = push * (1 + 0.62 * go);
  return (
    <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: `${470 * K}px ${640 * K}px` }}>
      <Img src={staticFile(t < T.pop ? 'img/relief_clear.jpg' : 'img/relief.jpg')} style={FULL} />
    </AbsoluteFill>
  );
};
const Phew: React.FC<{ t: number; p: LocPack }> = ({ t, p }) => {
  if (t < T.end || t >= T.zoom) return null;
  const a = interpolate(t, [T.end, T.end + 0.16], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  return (
    <div style={{ position: 'absolute', left: 70, top: 640, padding: '20px 34px 24px', borderRadius: 40, background: 'rgba(255,253,248,0.97)', boxShadow: '0 10px 26px rgba(40,10,0,0.35)', transform: `scale(${a})`, transformOrigin: '80% 100%', fontFamily: p.font, fontWeight: 800, fontSize: p.phewSize, lineHeight: p.lineH, color: C.brown, whiteSpace: 'nowrap' }}>
      {p.phew}
      <svg width={64} height={50} style={{ position: 'absolute', right: 30, bottom: -46 }}>
        <path d="M0 0 L60 0 L46 48 Z" fill="rgba(255,253,248,0.97)" />
      </svg>
    </div>
  );
};
// 유령이 작게 「사」 — 끝 글을 두지 않고 농담과 배운 말을 한 번에 닫는다(v4 볼 이유 심사)
const Whisper: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.whisper) return null;
  const a = interpolate(t, [T.whisper, T.whisper + 0.16], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  return (
    <div style={{ position: 'absolute', left: 150, top: 340, padding: '18px 40px 22px', borderRadius: 44, background: '#140A06', border: '6px solid #8A6A2E', transform: `scale(${a})`, transformOrigin: '90% 100%', textAlign: 'center' }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 120, lineHeight: 1.05, color: '#FF7A66' }}>사…</div>
      <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 54, color: C.cream }}>sa</div>
      <svg width={70} height={70} style={{ position: 'absolute', right: -6, bottom: -60 }}>
        <path d="M0 0 L58 0 L66 62 Z" fill="#140A06" />
      </svg>
    </div>
  );
};

// ── 몽글 말풍선 첫 물음 ──
const Hook: React.FC<{ t: number; p: LocPack }> = ({ t, p }) => {
  if (t >= T.panel) return null;
  const a = interpolate(t, [0.05, 0.22], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  return (
    <div style={{ position: 'absolute', left: 80, top: 450, width: 720, padding: '30px 34px 36px', borderRadius: 46, background: 'rgba(255,253,248,0.97)', boxShadow: '0 10px 26px rgba(40,10,0,0.35)', transform: `scale(${a})`, transformOrigin: '60% 100%', textAlign: 'center', fontFamily: p.font, fontWeight: 800, fontSize: p.hookSize, lineHeight: p.lineH, color: C.brown }}>
      {p.hook}
      <svg width={70} height={56} style={{ position: 'absolute', left: 400, bottom: -52 }}>
        <path d="M0 0 L66 0 L34 54 Z" fill="rgba(255,253,248,0.97)" />
      </svg>
    </div>
  );
};

// ── 소리 ──
const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at: t, vol = 1 }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; at: number; vol: number; dur?: number }> = ({ file, at: t, vol, dur }) => (
  <Sequence from={Math.max(0, fr(t))} durationInFrames={dur ? Math.max(2, fr(dur)) : undefined} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={(i) => vol * MASTER * (dur ? interpolate(i, [0, 2, Math.max(3, fr(dur) - 6), Math.max(4, fr(dur))], [0, 1, 1, 0], clamp) : 1)} />
  </Sequence>
);
const Sound: React.FC = () => (
  <>
    <Sfx file="muzak_stop.wav" at={0} vol={0.34} />
    <Sfx file="ding.wav" at={T.count[0]} vol={0.26} />
    <Sfx file="ding.wav" at={T.count[1]} vol={0.26} />
    <Sfx file="ding.wav" at={T.count[2]} vol={0.26} />
    {T.count.map((c, i) => (
      <Vo key={i} id={`c${i + 1}`} at={c + 0.04} vol={i === 3 ? 1.1 : 1} />
    ))}
    <Sfx file="flicker.wav" at={T.count[3]} vol={0.3} />
    <Vo id="c4" at={T.count[3] + 0.8} vol={0.7} />
    <Sfx file="drone.wav" at={T.count[3] + 0.4} vol={0.42} />
    <Sfx file="peek.wav" at={T.ghost + 0.02} vol={0.34} />
    <Sfx file="ding_arrive.wav" at={T.arrive} vol={0.34} />
    <Sfx file="door_open.wav" at={T.open - 0.05} vol={0.34} />
    <Sfx file="teacup.wav" at={T.opened + 0.45} vol={0.36} />
    <Sfx file="gulp.wav" at={T.face + 0.1} vol={0.42} />
    <Sfx file="door_slam.wav" at={T.slam - 0.26} vol={0.5} />
    <Sfx file="muzak_back.wav" at={T.relief} vol={0.3} dur={T.pop - T.relief} />
    <Sfx file="sigh.wav" at={T.relief + 0.1} vol={0.3} />
    <Sfx file="peek.wav" at={T.pop} vol={0.4} />
    <Vo id="c4" at={T.whisper} vol={0.85} />
  </>
);

export const Film: React.FC<{ loc?: Loc }> = ({ loc = 'en' }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const p = LOCS[loc];
  return (
    <AbsoluteFill style={{ backgroundColor: '#1a0c07' }}>
      {t < T.panel ? <Inside t={t} /> : t < T.react ? (t >= T.count[1] - 0.05 && t < T.count[2] - 0.05 ? <Bounce t={t} /> : <Panel t={t} />) : t < T.patch ? <React_ t={t} /> : t < T.arrive ? <Patch t={t} /> : t >= T.face && t < T.slam ? <Face t={t} /> : t < T.relief ? <Doors t={t} /> : <Relief t={t} />}
      <Hook t={t} p={p} />
      {t >= T.panel && t < T.react ? <CountBoard t={t} /> : null}
      <Equation t={t} p={p} />
      <SoBoard t={t} p={p} />
      <FloorSign t={t} p={p} />
      <Phew t={t} p={p} />
      <Whisper t={t} />
      <Sound />
    </AbsoluteFill>
  );
};
