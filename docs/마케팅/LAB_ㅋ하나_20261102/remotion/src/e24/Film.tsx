// LAB 영어 E24 「ㅋ 하나」 — 몽글이 한국 친구에게 장난을 보낼 때마다 친구 답 ㅋ가 늘고, ㅋ는 폰에서 펠트 조각으로 쏟아져 카페를 덮는다.
// 마지막 「Want another joke? 😎」에 친구 답이 「ㅋ」 하나(= 'k.') — 카페가 얼어붙고 몽글은 얼음 덩어리. 끝은 친구의 「ㅋㅋㅋㅋㅋㅋㅋ jk 😂」에 얼음이 깨진다(v6).
// 그림은 장면 판 셋(카페 · 웃음 · 얼음)과 오린 ㅋ 조각 하나. 조각은 자리마다 미리 셈한 포물선으로 날아 카운터에 쌓인다. 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { fr, T } from './timeline';

const C = { coral: '#E0533F', coralShade: '#AE322A', brown: '#2B1A14', mid: '#6B4A3C', cream: '#FFFDF8', ice: '#2F6FB3', iceCard: 'rgba(236,246,255,0.97)' };
const KO = "'SUIT', 'Inter Tight', sans-serif";
const EN = "'Inter Tight', 'SUIT', 'Segoe UI Emoji', sans-serif";
const CHAT = "'SUIT', 'Inter Tight', 'Segoe UI Emoji', sans-serif";
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const BACK = Easing.out(Easing.back(2.2));
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const pop = (t: number, at: number) => interpolate(t, [at, at + 0.16], [0, 1], { ...clamp, easing: BACK });

// 판/카페 그림을 재서 맞춘 자리(1080 × 1920)
const SCREEN = { x: 141, y: 693, w: 344, h: 676 };
const PH = { x: 313, y: 1000 }; // 폰 화면 가운데(조금 위 — 아래쪽은 쌓인 ㅋ가 덮는다)
const PHONE_Z = 2.3;
const PH_Y = 1000; // 다가간 폰 화면 가운데가 올 자리 — v6은 900이라 위 딱지가 폰 머리를 덮었다
const ICE = { x: 555, y: 905, w: 500, h: 575, cx: 805, cy: 1180 };
const K_RATIO = 873 / 989; // 오린 ㅋ 조각의 높이 / 폭

// ── ㅋ 조각: 묶음마다 폰 화면에서 쏟아져 포물선으로 날아 카운터에 쌓인다(미리 셈) ──
type Piece = { s: number; x0: number; y0: number; vx: number; vy: number; r0: number; vr: number; w: number; z: number; tl: number; xl: number; yl: number; rl: number };
const G = 2600;
const BIN = 40;
const pile: number[] = new Array(Math.ceil(1080 / BIN) + 1).fill(0);
const pileCap = (x: number) => (x > 545 && x < 1060 ? 210 : 250); // v7 첫 판은 330이라 폰 속 「ㅋ」 답을 덮었다 // 몽글 얼굴 · 폰 위쪽 답 칸은 덮지 않는다
const PIECES: Piece[] = [];
const burst = (id: string, t0: number, t1: number, n: number, power: number) => {
  for (let i = 0; i < n; i++) {
    const k = `${id}${i}`;
    const s = t0 + (t1 - t0) * (n === 1 ? 0 : i / (n - 1)) + 0.03 * random(`${k}j`);
    const z = random(`${k}z`);
    const w = 150 * (0.72 + 0.48 * z) * (0.82 + 0.4 * random(`${k}w`));
    const x0 = SCREEN.x + SCREEN.w * (0.3 + 0.6 * random(`${k}x`)); // 화면 위쪽에서 튀어나온다 — 아래쪽 답 말풍선은 가리지 않게
    const y0 = SCREEN.y + 40 + 120 * random(`${k}y`);
    const vx = (-520 + 1650 * random(`${k}vx`)) * power;
    const vy = -(520 + 980 * random(`${k}vy`)) * power;
    const r0 = -22 + 44 * random(`${k}r`); // 크게 돌면 ㅌ · ㄷ처럼 읽힌다(v1) — ㅋ로 읽히는 기울기 안에서만
    const vr = -40 + 80 * random(`${k}vr`);
    // 떨어질 자리 — 그 칸의 쌓인 높이 위
    const floor = 1452 + 205 * z;
    let tl = 0;
    let xl = x0;
    let yl = floor;
    for (let it = 0; it < 3; it++) {
      const b = Math.max(0, Math.min(pile.length - 1, Math.round(xl / BIN)));
      yl = floor - Math.min(pile[b], pileCap(xl)) - (w * K_RATIO) * 0.32;
      tl = (-vy + Math.sqrt(vy * vy + 2 * G * Math.max(0, yl - y0))) / G;
      xl = x0 + vx * tl;
    }
    const out = xl < -120 || xl > 1200;
    if (!out) {
      const h = w * K_RATIO;
      for (let b = Math.floor((xl - w / 2) / BIN); b <= Math.ceil((xl + w / 2) / BIN); b++) if (b >= 0 && b < pile.length) pile[b] += h * 0.42;
    }
    PIECES.push({ s, x0, y0, vx, vy, r0, vr, w, z, tl: out ? 99 : tl, xl, yl, rl: r0 + vr * tl });
  }
};
burst('h', T.hookReply + 0.03, 2.05, 22, 1.0);
burst('a', T.s1 + 0.18, T.s1 + 0.42, 2, 0.75);
burst('b', T.s2 + 0.15, T.s2 + 0.6, 4, 0.85);
burst('c', T.s3 + 0.14, T.s4 - 0.1, 34, 1.05);
burst('d', T.s4 + 0.14, T.dive - 0.05, 55, 1.1); // v3 170 → 「양으로 미는 화려함」(볼 이유 심사 둘)
burst('e', T.end + 0.12, T.end + 1.0, 20, 1.0); // 끝 — 친구의 ㅋㅋㅋ jk
PIECES.sort((a, b) => a.z - b.z);

const piecePose = (p: Piece, t: number) => {
  const s = t - p.s;
  if (s < 0) return null;
  if (s < p.tl) return { x: p.x0 + p.vx * s, y: p.y0 + p.vy * s + 0.5 * G * s * s, r: p.r0 + p.vr * s, sc: interpolate(s, [0, 0.12], [0.35, 1], clamp), landed: false };
  const a = s - p.tl;
  const hop = a < 0.3 ? 26 * Math.abs(Math.sin(a * 21)) * (1 - a / 0.3) : 0;
  return { x: p.xl, y: p.yl - hop, r: p.rl, sc: 1, landed: true };
};

const Pieces: React.FC<{ t: number; frozen?: boolean }> = ({ t, frozen }) => {
  const at = frozen ? T.freeze : t; // 얼어붙으면 그 순간 자리 그대로 멈춘다
  const out: React.ReactNode[] = [];
  PIECES.forEach((p, i) => {
    const q = piecePose(p, at);
    if (!q) return;
    // 폰으로 다가가면서 날던 조각은 사라진다 — v4는 「Knock knock」을 가렸다(얼음도 쌓인 조각만 남는다)
    const airFade = q.landed || t >= T.end ? 1 : interpolate(t, [T.dive, T.dive + 0.2], [1, 0], clamp);
    if (airFade <= 0) return;
    if (frozen && q.x > ICE.x - 30 && q.x < ICE.x + ICE.w + 30 && q.y > ICE.y - 60 && q.y < ICE.y + ICE.h - 120) return; // 얼음 속 몽글 얼굴은 가리지 않는다
    const w = p.w * q.sc;
    const h = w * K_RATIO;
    const shade = frozen
      ? 'sepia(1) hue-rotate(168deg) saturate(0.95) brightness(1.02) drop-shadow(0 0 4px rgba(235,248,255,0.8))'
      : `brightness(${(0.86 + 0.14 * p.z).toFixed(3)}) drop-shadow(0 ${q.landed ? 7 : 14}px ${q.landed ? 5 : 12}px rgba(60,30,10,${q.landed ? 0.38 : 0.22}))`;
    out.push(<Img key={i} src={staticFile('img/k.webp')} style={{ position: 'absolute', left: q.x - w / 2, top: q.y - h / 2, width: w, height: h, transform: `rotate(${q.r}deg)`, filter: shade, opacity: airFade }} />);
  });
  return <>{out}</>;
};

// ── 폰 속 메신저(카페 장면의 펠트 폰 화면) ──
type Ex = { at: number; me: string; reply: string; replyAt: number };
const EXCHANGES: Ex[] = [
  { at: T.hookMsg, me: '😜', reply: 'ㅋㅋㅋㅋㅋㅋ', replyAt: T.hookReply },
  { at: T.s1, me: '🙂', reply: 'ㅋㅋ', replyAt: T.s1 + 0.12 },
  { at: T.s2, me: '🤪', reply: 'ㅋㅋㅋ', replyAt: T.s2 + 0.12 },
  { at: T.s3, me: '🐸💃', reply: 'ㅋㅋㅋㅋㅋㅋ', replyAt: T.s3 + 0.12 },
  { at: T.s4, me: '🕺🐙🕺', reply: 'ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ', replyAt: T.s4 + 0.12 },
];
const exAt = (t: number) => {
  let e: Ex | null = null;
  for (const x of EXCHANGES) if (t >= x.at) e = x;
  return e;
};
const Bubble: React.FC<{ me?: boolean; text: string; a: number; size: number; maxW: number; ko?: boolean }> = ({ me, text, a, size, maxW, ko }) => (
  <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', marginBottom: size * 0.32 }}>
    <div style={{ maxWidth: maxW, padding: `${size * 0.26}px ${size * 0.42}px`, borderRadius: size * 0.55, background: me ? '#FEE500' : '#FFFFFF', color: '#1A1A1A', fontFamily: ko ? KO : CHAT, fontWeight: ko ? 700 : 600, fontSize: size, lineHeight: 1.18, wordBreak: ko ? 'break-all' : 'normal', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', transform: `scale(${a})`, transformOrigin: me ? '100% 50%' : '0% 50%' }}>{text}</div>
  </div>
);
// 마지막 장난 — v3까지는 납작한 전체 화면 메신저였는데 「펠트 세계에서 빠져나와 싸 보인다」(볼 이유 심사), 펠트 폰 안으로 다가가 보인다
const LastJoke: React.FC<{ t: number; frozen?: boolean }> = ({ t, frozen }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 72, padding: '0 14px' }}>
    <Bubble text="ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ" a={1} size={18} maxW={250} ko />
    <Bubble me text="🕺🐙🕺" a={1} size={18} maxW={250} />
    <div style={{ opacity: frozen ? 1 : interpolate(t, [T.chat, T.chat + 0.18], [0, 1], clamp), transform: `translateY(${frozen ? 0 : interpolate(t, [T.chat, T.chat + 0.18], [24, 0], clamp)}px)` }}>
      <Bubble me text="Want another joke? 😎" a={1} size={30} maxW={300} />
    </div>
    {!frozen && t >= T.typing && t < T.one ? (
      <div style={{ display: 'inline-flex', gap: 7, padding: '14px 18px', borderRadius: 20, background: '#fff' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: 5, background: '#8A96A3', opacity: 0.35 + 0.65 * Math.abs(Math.sin(t * 9 - i * 0.9)) }} />
        ))}
      </div>
    ) : null}
    {frozen || t >= T.one ? <Bubble text="ㅋ" a={frozen ? 1 : pop(t, T.one)} size={66} maxW={200} ko /> : null}
    {!frozen && t >= T.end ? <Bubble text="ㅋㅋㅋㅋㅋㅋㅋ jk 😂" a={pop(t, T.end)} size={30} maxW={300} /> : null}
  </div>
);
const PhoneChat: React.FC<{ t: number; frozen?: boolean }> = ({ t, frozen }) => {
  const last = frozen || t >= T.chat;
  const e = last ? null : exAt(t);
  return (
    <div style={{ position: 'absolute', left: SCREEN.x + 6, top: SCREEN.y + 6, width: SCREEN.w - 12, height: SCREEN.h - 12, borderRadius: 26, overflow: 'hidden', background: frozen ? '#C9DCEB' : '#BACEE0', opacity: 0.97 }}>
      <div style={{ height: 64, background: frozen ? 'rgba(240,248,255,0.9)' : 'rgba(255,255,255,0.88)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 14, background: '#9AA7B4' }} />
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 28, color: '#222' }}>Jiwoo</div>
      </div>
      {e ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 210, padding: '0 16px' }}>
          <Bubble me text={e.me} a={pop(t, e.at)} size={42} maxW={290} />
          {t >= e.replyAt ? <Bubble text={e.reply} a={pop(t, e.replyAt)} size={52} maxW={300} ko /> : null}
        </div>
      ) : null}
      {last ? <LastJoke t={t} frozen={frozen} /> : null}
      {frozen ? <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(240,250,255,0.35), rgba(220,238,255,0.15))' }} /> : null}
    </div>
  );
};

// ── 카페(따뜻한 장면) ──
const shakeAt = (t: number, h: number, a: number, dur = 0.32) => (t >= h && t < h + dur ? a * Math.sin((t - h) * 62) * (1 - (t - h) / dur) : 0);
// 원본 박자 자리(6.2 · 7.5 · 8.1 · 9.2 · 10.0)에서 화면이 한 번에 바뀌게 — 들어갔다 나왔다(v5 나란히 박자 50%)
const BEATS: [number, number][] = [[T.s2, 0.08], [T.s3, -0.08], [T.s3b, 0.08], [T.s4, -0.08], [T.s4b, 0.08]];
const cafeZ = (t: number) => {
  if (t < T.reveal) return interpolate(t, [0, T.reveal], [1.0, 1.05], clamp);
  let z = interpolate(t, [T.s1, T.dive], [1.02, 1.1], clamp);
  for (const [b, d] of BEATS) z += d * interpolate(t, [b, b + 0.05], [0, 1], clamp);
  return z;
};
const Cafe: React.FC<{ t: number }> = ({ t }) => {
  const z = cafeZ(t);
  const sx = shakeAt(t, T.s4 + 0.12, 10) + shakeAt(t, T.s4b, 8) + (t > T.s4 && t < T.dive ? 3 * Math.sin(t * 47) : 0);
  const sy = shakeAt(t, T.s3 + 0.12, 6) + (t > T.s4 && t < T.dive ? 3 * Math.cos(t * 41) : 0);
  const laugh = t >= T.s3;
  const hop = laugh && t < T.dive ? 10 * Math.abs(Math.sin(t * 9)) : 0;
  let tf = `translate(${sx}px, ${sy - hop * 0.3}px) scale(${z})`;
  let origin = '540px 1150px';
  if (t >= T.dive) {
    // 원점을 폰 화면 가운데로 옮기며 이어지게(그 순간 같은 그림이 되도록 d0을 셈) — 폰을 화면 가운데로 끌어와 크게
    const p = interpolate(t, [T.dive, T.chat], [0, 1], { ...clamp, easing: EASE_IO });
    const z0 = cafeZ(T.dive);
    const zz = interpolate(p, [0, 1], [z0, PHONE_Z]);
    const d0 = [(540 - PH.x) * (1 - z0), (1150 - PH.y) * (1 - z0)];
    const d1 = [540 - PH.x, PH_Y - PH.y];
    tf = `translate(${interpolate(p, [0, 1], [d0[0], d1[0]])}px, ${interpolate(p, [0, 1], [d0[1], d1[1]])}px) scale(${zz})`;
    origin = `${PH.x}px ${PH.y}px`;
  }
  return (
    <AbsoluteFill style={{ transform: tf, transformOrigin: origin }}>
      <Img src={staticFile(laugh ? 'img/laugh.jpg' : 'img/cafe.jpg')} style={FULL} />
      <PhoneChat t={t} />
      <Pieces t={t} />
    </AbsoluteFill>
  );
};

// ── 컷: 카운터 위로 ㅋ 한 조각이 크게 떨어지고(keu), 둘이 더 떨어져 ㅋㅋㅋ — v3의 흐린 배경은 「ㅋ 하나만 3초」(볼 이유 심사) ──
const Reveal: React.FC<{ t: number }> = ({ t }) => {
  const s = t - T.reveal;
  const fall = interpolate(s, [0, 0.24], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const sq = (s0: number) => (s0 > 0 && s0 < 0.36 ? 1 - 0.16 * Math.sin(s0 * 28) * Math.exp(-s0 * 9) : 1);
  const three = interpolate(t, [T.rule, T.rule + 0.28], [0, 1], { ...clamp, easing: EASE_OUT });
  const W1 = interpolate(three, [0, 1], [560, 320]);
  const xs = [interpolate(three, [0, 1], [540, 215]), 540, interpolate(three, [0, 1], [540, 865])];
  const yLand = interpolate(three, [0, 1], [1180, 1250]);
  const y = interpolate(fall, [0, 1], [-400, yLand]);
  const drop = (i: number) => (i === 1 ? 0 : interpolate(t, [T.rule, T.rule + 0.24], [-1500, 0], { ...clamp, easing: Easing.in(Easing.quad) }));
  const z = interpolate(s, [0, 2.9], [1.32, 1.38], clamp) * (1 + 0.03 * interpolate(t, [T.rule + 0.24, T.rule + 0.3], [0, 1], clamp));
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a160c' }}>
      <Img src={staticFile('img/cafe.jpg')} style={{ ...FULL, transform: `scale(${z})`, transformOrigin: '540px 1520px' }} />
      {[0, 1, 2].map((i) => {
        if (i !== 1 && t < T.rule) return null;
        const w = W1;
        const h = w * K_RATIO;
        const k = sq(i === 1 ? s - 0.24 : t - T.rule - 0.24);
        return <Img key={i} src={staticFile('img/k.webp')} style={{ position: 'absolute', left: xs[i] - w / 2, top: y + drop(i) - h / 2, width: w, height: h, transform: `rotate(${3 * Math.sin(t * 5) + (i - 1) * 5}deg) scaleY(${k}) scaleX(${2 - k})`, transformOrigin: '50% 90%', filter: 'drop-shadow(0 22px 16px rgba(40,15,0,0.5))' }} />;
      })}
    </AbsoluteFill>
  );
};

// ── 얼어붙은 카페 ──
const SNOW = Array.from({ length: 70 }, (_, i) => ({ x: 1080 * random(`sx${i}`), y0: -200 + 2200 * random(`sy${i}`), v: 90 + 140 * random(`sv${i}`), r: 4 + 9 * random(`sr${i}`), ph: 6 * random(`sp${i}`) }));
const Snow: React.FC<{ t: number }> = ({ t }) => {
  const s = t - T.freeze;
  return (
    <>
      {SNOW.map((f, i) => {
        const y = ((f.y0 + f.v * s) % 2100) - 100;
        const x = f.x + 26 * Math.sin(s * 1.4 + f.ph);
        return <div key={i} style={{ position: 'absolute', left: x - f.r, top: y - f.r, width: f.r * 2, height: f.r * 2, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', filter: 'blur(1px)' }} />;
      })}
    </>
  );
};
const CRACKS = ['M805 1000 L760 1080 L790 1150 L735 1240', 'M805 1000 L870 1060 L850 1130 L915 1190', 'M805 1000 L820 940 L790 900', 'M760 1080 L690 1100'];
const Frozen: React.FC<{ t: number }> = ({ t }) => {
  const s = t - T.freeze;
  const flash = interpolate(s, [0, 0.18], [0.85, 0], clamp);
  let z = interpolate(s, [0.45, 2.4], [1.12, 1.04], { ...clamp, easing: EASE_OUT });
  let tf = '';
  let origin = `${ICE.cx}px ${ICE.cy - 60}px`;
  if (s < 0.45) {
    // 폰 화면 가까이(그 「ㅋ」)에서 빠져나온다 — 원점은 폰, 끝 순간 ICE 원점의 그림과 같아지게 d1을 셈
    const p = interpolate(s, [0, 0.45], [0, 1], { ...clamp, easing: EASE_OUT });
    const zz = interpolate(p, [0, 1], [PHONE_Z, 1.12]);
    const d0 = [540 - PH.x, PH_Y - PH.y];
    const d1 = [(ICE.cx - PH.x) * (1 - 1.12), (ICE.cy - 60 - PH.y) * (1 - 1.12)];
    tf = `translate(${interpolate(p, [0, 1], [d0[0], d1[0]])}px, ${interpolate(p, [0, 1], [d0[1], d1[1]])}px) `;
    z = zz;
    origin = `${PH.x}px ${PH.y}px`;
  }
  const ring = interpolate(s, [0.05, 0.75], [0, 1], { ...clamp, easing: EASE_OUT });
  if (t >= T.zoom) z = interpolate(t, [T.zoom, T.zoom + 0.22], [1.04, 1.5], { ...clamp, easing: EASE_IO });
  const shiver = s > 0.4 ? 2.2 * Math.sin(t * 115) : 0;
  const crack = interpolate(t, [T.zoom + 0.05, T.zoom + 0.35], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: '#0d1824' }}>
      <AbsoluteFill style={{ transform: `${tf}scale(${z})`, transformOrigin: origin }}>
        <Img src={staticFile('img/frozen.jpg')} style={FULL} />
        <AbsoluteFill style={{ clipPath: `inset(${ICE.y}px ${1080 - ICE.x - ICE.w}px ${1920 - ICE.y - ICE.h}px ${ICE.x}px)`, transform: `translateX(${shiver}px)` }}>
          <Img src={staticFile('img/frozen.jpg')} style={FULL} />
        </AbsoluteFill>
        <PhoneChat t={t} frozen />
        <Pieces t={t} frozen />
        {crack > 0 ? (
          <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 0 5px rgba(150,210,255,0.95))' }}>
            {CRACKS.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - crack} />
            ))}
          </svg>
        ) : null}
        <Snow t={t} />
        {ring > 0 && ring < 1 ? <div style={{ position: 'absolute', left: PH.x - 1700 * ring, top: PH.y - 1700 * ring, width: 3400 * ring, height: 3400 * ring, borderRadius: '50%', border: `${60 * (1 - ring) + 6}px solid rgba(225,244,255,${0.85 * (1 - ring)})`, boxShadow: `0 0 80px rgba(200,235,255,${0.8 * (1 - ring)})` }} /> : null}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#EAF6FF', opacity: flash }} />
    </AbsoluteFill>
  );
};

// ── 녹음 — 친구의 ㅋㅋㅋ jk에 얼음이 깨지고 카페가 다시 따뜻해진다(v5 볼 이유 「금이 간 뒤 아무 일도 없어 끝이 멈춘다」) ──
const SHARDS = Array.from({ length: 28 }, (_, i) => ({ a: -Math.PI * (0.05 + 0.9 * random(`ia${i}`)), v: 700 + 1100 * random(`iv${i}`), r: 22 + 40 * random(`ir${i}`), r0: 360 * random(`it${i}`), vr: -700 + 1400 * random(`iw${i}`), k: Math.floor(3 * random(`ik${i}`)) }));
const SHARD_PATHS = ['polygon(50% 0%, 100% 70%, 20% 100%)', 'polygon(0% 20%, 80% 0%, 100% 100%, 30% 80%)', 'polygon(10% 0%, 100% 40%, 60% 100%, 0% 70%)'];
const Thaw: React.FC<{ t: number }> = ({ t }) => {
  const s = t - T.end;
  const z = interpolate(s, [0, 0.35], [1.5, 1.04], { ...clamp, easing: EASE_OUT });
  const flash = interpolate(s, [0, 0.22], [0.9, 0], clamp);
  const hop = 10 * Math.abs(Math.sin(t * 9));
  return (
    <AbsoluteFill style={{ backgroundColor: '#1a0c07' }}>
      <AbsoluteFill style={{ transform: `translateY(${-hop * 0.3}px) scale(${z})`, transformOrigin: `${ICE.cx}px ${ICE.cy - 60}px` }}>
        <Img src={staticFile('img/laugh.jpg')} style={FULL} />
        <PhoneChat t={t} />
        <Pieces t={t} />
        {SHARDS.map((d, i) => {
          if (s > 1.2) return null;
          const x = ICE.cx + Math.cos(d.a) * d.v * s * 1.2;
          const y = ICE.cy - 150 + Math.sin(d.a) * d.v * s + 0.5 * 2600 * s * s;
          return <div key={i} style={{ position: 'absolute', left: x - d.r, top: y - d.r, width: d.r * 2, height: d.r * 2, clipPath: SHARD_PATHS[d.k], background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(190,228,255,0.7) 55%, rgba(140,200,240,0.55))', transform: `rotate(${d.r0 + d.vr * s}deg)`, opacity: interpolate(s, [0.8, 1.2], [1, 0], clamp) }} />;
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#FFF6E8', opacity: flash }} />
    </AbsoluteFill>
  );
};

// ── 글 판 — 친구 답 말풍선(ㅋ) + 뜻 딱지. v3까지의 크림 카드는 지난 두 편과 같은 틀로 보였다(haiku 9번) ──
const Say: React.FC<{ a: number; y: number; ko: string; size: number; tags: { s: string; a: number; ice?: boolean }[]; ice?: boolean }> = ({ a, y, ko, size, tags, ice }) => (
  <div style={{ position: 'absolute', left: 64, top: y, width: 952, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', transform: `scale(${a})`, transformOrigin: '0% 100%', opacity: Math.min(1, a * 2) }}>
    <div style={{ position: 'relative', maxWidth: 900, padding: '16px 44px 22px', borderRadius: 64, background: ice ? '#EEF7FF' : '#FFFFFF', border: ice ? '5px solid #BFE3FF' : 'none', boxShadow: ice ? '0 10px 28px rgba(10,30,60,0.4)' : '0 10px 26px rgba(40,10,0,0.32)', fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.12, color: ice ? C.ice : C.coralShade, letterSpacing: -2, wordBreak: 'break-all' }}>
      {ko}
      <svg width={64} height={54} style={{ position: 'absolute', left: 18, bottom: -40 }}>
        <path d="M6 0 L58 0 L2 50 Z" fill={ice ? '#EEF7FF' : '#FFFFFF'} />
      </svg>
    </div>
    {tags.map((g, i) =>
      g.a > 0 ? (
        <div key={i} style={{ marginTop: i === 0 ? 30 : 14, marginLeft: 150 + i * 40, padding: '10px 36px 14px', borderRadius: 999, background: g.ice ? '#173E66' : C.brown, color: C.cream, fontFamily: EN, fontWeight: 800, fontSize: 74, lineHeight: 1.1, boxShadow: '0 8px 20px rgba(0,0,0,0.3)', transform: `rotate(-3deg) scale(${g.a})`, transformOrigin: '0% 50%' }}>
          {g.s}
        </div>
      ) : null,
    )}
  </div>
);
const Pill: React.FC<{ a: number; y: number; s: string; ice?: boolean }> = ({ a, y, s: text, ice }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center' }}>
    <div style={{ padding: '12px 40px 16px', borderRadius: 999, background: ice ? '#173E66' : C.brown, color: C.cream, fontFamily: EN, fontWeight: 800, fontSize: 78, lineHeight: 1.1, boxShadow: '0 8px 20px rgba(0,0,0,0.35)', transform: `rotate(-2deg) scale(${a})` }}>{text}</div>
  </div>
);
// 그림 위 큰 글 — 판 없이 굵은 테와 그림자(흰 기본 글자가 아니다, 올리기 전 검사 ⑤)
const Big: React.FC<{ a: number; y: number; lines: React.ReactNode[]; size: number; color: string; stroke: string; glow: string }> = ({ a, y, lines, size, color, stroke, glow }) => (
  <div style={{ position: 'absolute', left: 30, right: 30, top: y, textAlign: 'center', fontFamily: EN, fontWeight: 900, fontSize: size, lineHeight: 1.12, color, WebkitTextStroke: `12px ${stroke}`, paintOrder: 'stroke fill', textShadow: `0 6px 22px ${glow}`, transform: `scale(${a})`, transformOrigin: '50% 50%', opacity: Math.min(1, a * 2) }}>
    {lines.map((l, i) => (
      <div key={i}>{l}</div>
    ))}
  </div>
);

const STEPS = [
  { at: T.s1 + 0.12, end: T.s2 + 0.12, ko: 'ㅋㅋ', mean: '= haha 🙂', size: 128 },
  { at: T.s2 + 0.12, end: T.s3 + 0.12, ko: 'ㅋㅋㅋ', mean: '= LOL 😆', size: 128 },
  { at: T.s3 + 0.12, end: T.s4 + 0.12, ko: 'ㅋㅋㅋㅋㅋㅋ', mean: '= LMAO 🤣', size: 120 },
  { at: T.s4 + 0.12, end: T.dive, ko: 'ㅋㅋㅋㅋㅋㅋㅋㅋㅋ', mean: "= I'm DEAD 💀", size: 96 },
];
const Words: React.FC<{ t: number }> = ({ t }) => (
  <>
    {t < T.reveal ? (
      <Big a={1} y={285} size={86} color={C.cream} stroke={C.brown} glow="rgba(40,10,0,0.45)" lines={['Korean friends', <>laugh in <span style={{ fontFamily: KO }}>ㅋ</span>…</>, <span style={{ color: '#FFD3C8' }}>but how many? 🤔</span>]} />
    ) : null}
    {t >= T.reveal + 0.3 && t < T.s1 ? (
      <Say a={pop(t, T.reveal + 0.3)} y={275} ko="ㅋ" size={150} tags={[{ s: "= a 'k' sound (keu)", a: pop(t, T.reveal + 0.5) }, { s: 'Type it again & again = a laugh 😆', a: pop(t, T.rule + 0.3) }]} />
    ) : null}
    {STEPS.map((st, i) =>
      t >= st.at && t < st.end ? <Say key={i} a={pop(t, st.at)} y={275} ko={st.ko} size={st.size} tags={[{ s: st.mean, a: pop(t, st.at + 0.08) }]} /> : null,
    )}
    {t >= T.cold && t < T.zoom ? (
      <Say a={pop(t, T.cold)} y={275} ko="ㅋ" size={150} ice tags={[{ s: "= 'k.' 😐", a: pop(t, T.cold + 0.08), ice: true }, { s: '= cold 🥶', a: pop(t, T.why), ice: true }]} />
    ) : null}
    {t >= T.one + 0.15 && t < T.freeze ? <Pill a={pop(t, T.one + 0.15)} y={275} s="Just ONE ㅋ…? 😶" /> : null}
    {t >= T.end + 0.12 ? <Say a={pop(t, T.end + 0.12)} y={275} ko="ㅋㅋㅋㅋㅋㅋㅋ" size={120} tags={[{ s: 'jk 😂 (just kidding)', a: pop(t, T.end + 0.22) }]} /> : null}
  </>
);

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
const VO_AT: [string, number][] = [
  ['k2', T.s1 + 0.16],
  ['k3', T.s2 + 0.16],
  ['k6', T.s3 + 0.16],
  ['k10', T.s4 + 0.16],
  ['k1', T.one + 0.06],
  ['k6', T.end + 0.25],
];
const VO_LEN: Record<string, number> = { k2: 0.6, k3: 0.67, k6: 1.32, k10: 1.52, k1: 0.41 };
// 목소리 아래로 배경음을 낮춘다
const bgmVol = (f: number) => {
  const t = f / 30;
  let v = 0.3;
  for (const [id, at] of VO_AT) if (t > at - 0.1 && t < at + VO_LEN[id] + 0.1) v = 0.16;
  return v * MASTER * interpolate(t, [T.one - 0.04, T.one + 0.02], [1, 0], clamp);
};
const Sound: React.FC = () => (
  <>
    <Sequence from={0} durationInFrames={fr(T.one + 0.1)} layout="none">
      <Audio src={staticFile('sfx/bgm.wav')} volume={(i) => bgmVol(i)} />
    </Sequence>
    <Sfx file="whoosh.wav" at={T.hookMsg - 0.08} vol={0.3} />
    <Sfx file="ding.wav" at={T.hookReply} vol={0.42} />
    <Sfx file="pour_m.wav" at={T.hookReply + 0.1} vol={0.5} />
    <Sfx file="whoosh.wav" at={T.reveal - 0.12} vol={0.32} />
    <Sfx file="puff.wav" at={T.reveal + 0.24} vol={0.7} />
    <Sfx file="pop.wav" at={T.reveal + 0.45} vol={0.3} />
    <Sfx file="puff.wav" at={T.rule + 0.24} vol={0.6} />
    <Sfx file="pop.wav" at={T.rule + 0.2} vol={0.28} />
    {[T.s1, T.s2, T.s3, T.s4].map((s, i) => (
      <Sfx key={i} file="ding.wav" at={s + 0.1} vol={0.36} />
    ))}
    <Sfx file="pour_s.wav" at={T.s1 + 0.3} vol={0.42} />
    <Sfx file="pour_s.wav" at={T.s2 + 0.3} vol={0.48} />
    <Sfx file="pour_m.wav" at={T.s3 + 0.3} vol={0.55} />
    <Sfx file="pop.wav" at={T.s3b} vol={0.3} />
    <Sfx file="pour_l.wav" at={T.s4 + 0.3} vol={0.55} />
    <Sfx file="pop.wav" at={T.s4b} vol={0.3} />
    {VO_AT.map(([id, at]) => (
      <Vo key={`${id}${at}`} id={id} at={at} />
    ))}
    <Sfx file="whoosh.wav" at={T.dive - 0.02} vol={0.34} />
    <Sfx file="pop.wav" at={T.chat} vol={0.28} />
    <Sfx file="type.wav" at={T.typing + 0.02} vol={0.3} />
    <Sfx file="ding.wav" at={T.one - 0.02} vol={0.3} />
    <Sfx file="scratch.wav" at={T.one - 0.02} vol={0.45} />
    <Sfx file="freeze.wav" at={T.freeze - 0.02} vol={0.75} />
    <Sfx file="wind.wav" at={T.freeze} vol={0.42} dur={T.end - T.freeze + 0.1} />
    <Sfx file="sparkle.wav" at={T.cold} vol={0.35} />
    <Sfx file="crack.wav" at={T.zoom + 0.04} vol={0.6} />
    <Sfx file="ding.wav" at={T.end - 0.08} vol={0.4} />
    <Sfx file="shatter.wav" at={T.end - 0.02} vol={0.8} />
    <Sfx file="pour_m.wav" at={T.end + 0.3} vol={0.5} />
    <Sequence from={fr(T.end)} durationInFrames={fr(T.total - T.end)} layout="none">
      <Audio src={staticFile('sfx/bgm.wav')} startFrom={fr(5)} volume={(i) => MASTER * interpolate(i, [0, 4], [0, 1], clamp) * (i > fr(0.15) && i < fr(1.65) ? 0.16 : 0.3)} />
    </Sequence>
  </>
);

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  return (
    <AbsoluteFill style={{ backgroundColor: '#1a0c07' }}>
      {t < T.reveal || (t >= T.s1 && t < T.freeze) ? <Cafe t={t} /> : null}
      {t >= T.reveal && t < T.s1 ? <Reveal t={t} /> : null}
      {t >= T.freeze && t < T.end ? <Frozen t={t} /> : null}
      {t >= T.end ? <Thaw t={t} /> : null}
      <Words t={t} />
      <Sound />
    </AbsoluteFill>
  );
};
