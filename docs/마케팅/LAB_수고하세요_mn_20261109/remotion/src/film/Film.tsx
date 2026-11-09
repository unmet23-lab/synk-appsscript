// LAB 몽골 M32 「수고하세요 ↔ 안녕히 계세요」(11-09) — 연구실을 나서는 몽글의 「교수님, 수고하세요!」에 교수 책상부터 서리가 번져 온 방이 언다(한 장면).
// 되감아 「안녕히 계세요!」 하면 같은 방 · 같은 교수님이 햇살 속에서 손을 흔든다. 끝은 교수님의 「수고해요.」에 버릇처럼 「네! 수고하…」 → 서리가 다시 번지다 「안녕히 계세요!!」에 걷힌다.
// 그림은 같은 구도로 구운 판 넷(판/*.txt — 누끼 없음). 서리는 얼음 판을 얼룩 가면으로 겹쳐 실제로 번지게 하고, 몽글 · 교수 손은 같은 판의 타원 조각으로 움직인다. 전부 useCurrentFrame()으로만.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { fr, T, TEXT, TOTAL_FRAMES, FPS, SCENE } from './data';

export { TOTAL_FRAMES, FPS, SCENE };
const FONT = "'Inter Tight', 'SUIT', sans-serif";
const INK = '#2F2420';
const COLD = '#2C6F9E';
const WARM = '#C8551B';
const CORAL = '#B83C28';
const MEAN = '#A52A4A';
const FELT = '#F6E0BC';
const MASTER = 0.8;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const FULL: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, objectFit: 'cover' };
const bump = (t: number, at: number, up = 0.06, down = 0.35) => interpolate(t, [at - 0.01, at + up, at + down], [0, 1, 0], clamp);
const kick = (t: number, at: number, decay = 5, freq = 20) => (t < at ? 0 : Math.exp(-(t - at) * decay) * Math.cos((t - at) * freq));

// 몽글 · 교수 손 자리(1080×1920)
const MONGLE = { cx: 287, cy: 1390, rx: 300, ry: 345, oy: 1650 };
const DESK = { x: 730, y: 1270 }; // 서리가 시작하는 곳

// 서리 가면 — 얼룩 62개가 책상에서 먼 순서로 자란다. p=0 없음 · p=1 온 방
const rand = (s: number) => {
  const x = Math.sin(s * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const BLOBS: { x: number; y: number; d: number; r: number }[] = [];
// 큰 얼룩 + 잘게 흩어진 작은 얼룩 — 경계가 둥근 구름이 아니라 얼음이 퍼지는 불규칙한 선으로(Fable 「구름 모양으로 잘린 레이어」)
for (let row = 0; row < 11; row++) {
  for (let col = 0; col < 6; col++) {
    const x = col * 216 + rand(row * 7 + col) * 120 - 30;
    const y = row * 200 + rand(row + col * 13) * 110 - 40;
    const dist = Math.hypot(x - DESK.x, y - DESK.y);
    BLOBS.push({ x, y, d: dist / 1500, r: 150 + rand(row * 3 + col * 5) * 110 });
  }
}
for (let k = 0; k < 150; k++) {
  const x = rand(k * 3.1 + 7) * 1180 - 50;
  const y = rand(k * 5.7 + 2) * 2020 - 50;
  const dist = Math.hypot(x - DESK.x, y - DESK.y);
  BLOBS.push({ x, y, d: dist / 1500 + (rand(k + 91) - 0.5) * 0.09, r: 44 + rand(k + 57) * 74 });
}
const frostMask = (p: number) => {
  const parts: string[] = [];
  for (const b of BLOBS) {
    const g = interpolate(p, [b.d * 0.82, b.d * 0.82 + 0.2], [0, 1], { ...clamp, easing: EASE_OUT });
    if (g <= 0) continue;
    parts.push(`radial-gradient(circle ${Math.round(b.r * g)}px at ${Math.round(b.x)}px ${Math.round(b.y)}px, black 90%, transparent 100%)`);
  }
  return parts.length ? parts.join(',') : 'linear-gradient(transparent, transparent)';
};
// 서리 끝 — 자라는 얼룩 가장자리마다 반짝(심사 답 4 「흐린 경계의 화면 전환처럼 보인다」)
const Glints: React.FC<{ p: number; t: number }> = ({ p, t }) => {
  if (p <= 0 || p >= 1) return null;
  return (
    <>
      {BLOBS.map((b, k) => {
        const g = interpolate(p, [b.d * 0.82, b.d * 0.82 + 0.2], [0, 1], clamp);
        if (g <= 0.08 || g >= 0.92) return null;
        if (k % 5) return null;
        return [0, 1].map((j) => {
          const a = rand(k * 3 + j) * Math.PI * 2 + j * 2.1;
          const x = b.x + Math.cos(a) * b.r * interpolate(g, [0, 1], [0, 0.97]);
          const y = b.y + Math.sin(a) * b.r * interpolate(g, [0, 1], [0, 0.97]);
          const s = 26 + rand(k + j * 7) * 34;
          const on = 0.55 + 0.45 * Math.sin(t * 34 + k + j);
          return (
            <div key={`${k}-${j}`} style={{ position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s, opacity: on, mixBlendMode: 'screen', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(215,238,255,0.55) 30%, rgba(210,235,255,0) 66%)' }} />
          );
        });
      })}
    </>
  );
};

const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; sx?: number; sy?: number; dx?: number; dy?: number; rot?: number; oy?: number; ox?: number }> = ({ img, cx, cy, rx, ry, sx = 1, sy = 1, dx = 0, dy = 0, rot = 0, oy, ox }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 80%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}.jpg`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})`, transformOrigin: `${ox ?? cx}px ${oy ?? cy + ry * 0.8}px` }} />;
};

// 얼음이 얼마나 덮였나(0~1)
const iceAt = (t: number) => {
  if (t < T.freeze) return 0;
  if (t < T.frozen) return interpolate(t, [T.freeze, T.frozen], [0, 1], clamp);
  if (t < T.rewind) return 1;
  if (t < T.rewind + 0.62) return interpolate(t, [T.rewind, T.rewind + 0.62], [1, 0], { ...clamp, easing: Easing.in(Easing.quad) });
  if (t < T.creep) return 0;
  if (t < T.back) return interpolate(t, [T.creep, T.a4, T.back], [0, 0.74, 0.8], clamp); // 몽글 코앞까지(볼 이유 심사 답 4)
  return interpolate(t, [T.back, T.back + 0.32], [0.8, 0], { ...clamp, easing: EASE_OUT }); // 쩍 물러난다
};

// 몽글 움직임 — 숨 · 떨림 · 꾸벅 · 놀람
const mongleMove = (t: number) => {
  const breath = 1 + 0.016 * Math.sin(t * 3.2);
  let sx = 2 - breath;
  let sy = breath;
  let dx = 0;
  let dy = 0;
  let rot = 0;
  // 인사 — 첫 프레임부터 움직인다: 신나서 통 튀고 말하면서 들썩(심사 답 1)
  dy += -34 * Math.max(kick(t, 0.02, 5.5, 13), 0);
  sy += 0.035 * bump(t, T.a1, 0.06, 0.3) + 0.025 * bump(t, T.a1 + 0.72, 0.06, 0.3);
  // 얼음 — 부들부들
  const ice = iceAt(t);
  if (ice > 0.5) {
    const q = interpolate(ice, [0.5, 1], [0, 1], clamp);
    dx += 4.5 * q * Math.sin(t * 58);
    rot += 0.8 * q * Math.sin(t * 47);
  }
  // 꾸벅 — 앞(오른쪽)으로 숙였다 돌아온다
  const bow = (at: number, big = 1) => interpolate(t, [at, at + 0.16, at + 0.5, at + 0.78], [0, 1, 1, 0], { ...clamp, easing: Easing.inOut(Easing.quad) }) * big;
  const b = Math.max(bow(T.a2), bow(T.a4 + 0.02, 1.25));
  rot += 15 * b;
  sy -= 0.05 * b;
  dx += 16 * b;
  // 「네! 수고하…」 — 신나서 튀다가, 서리를 보고 굳는다
  dy += -26 * Math.max(kick(t, T.a3, 7, 12), 0);
  if (t >= T.creep && t < T.a4) {
    const q = interpolate(t, [T.creep, T.creep + 0.25], [0, 1], clamp);
    sy -= 0.03 * q;
    dx += 3.5 * q * Math.sin(t * 62);
  }
  // 끝 — 안도하며 한 번 더 꾸벅 · 작게 까딱
  if (t >= T.end) {
    const again = interpolate(t, [T.end + 0.25, T.end + 0.45, T.end + 0.8, T.end + 1.1], [0, 1, 1, 0], { ...clamp, easing: Easing.inOut(Easing.quad) });
    rot += 13 * again;
    sy -= 0.04 * again;
    dx += 14 * again;
    dy += -8 * Math.abs(Math.sin((t - T.end) * 3.2));
  }
  return { sx, sy, dx, dy, rot };
};

const Under: React.FC<{ img: string }> = ({ img }) => {
  const mask = `radial-gradient(ellipse ${MONGLE.rx + 40}px ${MONGLE.ry + 40}px at ${MONGLE.cx}px ${MONGLE.cy}px, black 86%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}.jpg`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask }} />;
};

const Scene: React.FC<{ t: number; base: string; ice?: number }> = ({ t, base, ice = 0 }) => {
  const m = mongleMove(t);
  const waving = base === 'sun';
  const wave = waving ? 8 * Math.sin((t - T.sun) * 7.5) : 0;
  return (
    <>
      <Img src={staticFile(`img/${base}.jpg`)} style={FULL} />
      {/* 몽글 자리 밑에 몽글 없는 같은 판 — 꾸벅해도 뒤에 원래 몽글이 비치지 않는다 */}
      <Under img={base === 'sun' ? 'sunEmpty' : 'roomEmpty'} />
      {waving ? <Patch img={base} cx={HAND.cx} cy={HAND.cy} rx={HAND.rx} ry={HAND.ry} rot={wave} ox={HAND.ox} oy={HAND.oy} /> : null}
      {/* 교수님 — 얼기 전까지 고개를 끄덕이며 웃는다. 얼면 그대로 멈춘다 */}
      {ice === 0 ? <Patch img={base} cx={PROF.cx} cy={PROF.cy} rx={PROF.rx} ry={PROF.ry} rot={1.8 * Math.sin(t * 3.4)} oy={PROF.oy} /> : null}
      <Patch img={base} cx={MONGLE.cx} cy={MONGLE.cy} rx={MONGLE.rx} ry={MONGLE.ry} sx={m.sx} sy={m.sy} dx={m.dx} dy={m.dy} rot={m.rot} oy={MONGLE.oy} />
      {ice > 0 ? (
        <AbsoluteFill style={{ WebkitMaskImage: frostMask(ice), maskImage: frostMask(ice) }}>
          <Img src={staticFile('img/ice.jpg')} style={FULL} />
          <Under img="iceEmpty" />
          <Patch img="ice" cx={MONGLE.cx} cy={MONGLE.cy} rx={MONGLE.rx} ry={MONGLE.ry} sx={m.sx} sy={m.sy} dx={m.dx} dy={m.dy} rot={m.rot} oy={MONGLE.oy} />
        </AbsoluteFill>
      ) : null}
      <Glints p={ice} t={t} />
    </>
  );
};
// 햇살 판의 흔드는 손(판 보고 맞춘다)
const HAND = { cx: 662, cy: 1040, rx: 84, ry: 112, ox: 690, oy: 1135 };
const PROF = { cx: 810, cy: 990, rx: 165, ry: 150, oy: 1135 };

// 되감기 표시 — 뒤로 가는 화살표 둘
const Rewind: React.FC<{ t: number }> = ({ t }) => {
  const a = interpolate(t, [T.rewind, T.rewind + 0.08, T.rewind + 0.5, T.rewind + 0.62], [0, 1, 1, 0], clamp);
  const ar = (x: number) => <path d={`M ${x} 0 L ${x - 70} 52 L ${x} 104 Z`} fill="#FFF6E4" stroke="#26344F" strokeWidth={7} strokeLinejoin="round" />;
  return <svg width={200} height={110} viewBox="-64 -3 208 110" style={{ position: 'absolute', left: 440, top: 620, opacity: a, filter: 'drop-shadow(0 8px 10px rgba(20,14,30,0.4))' }}>{ar(70)}{ar(140)}</svg>;
};

// 입김 — 얼어 있는 동안 몽글 앞에서 희미하게
const Breath: React.FC<{ t: number }> = ({ t }) => {
  const a = interpolate(t, [T.why, T.why + 0.4, T.rewind - 0.2, T.rewind], [0, 1, 1, 0], clamp);
  if (a <= 0) return null;
  const k = (t * 0.8) % 1;
  return <div style={{ position: 'absolute', left: 440 + 60 * k, top: 1240 - 80 * k, width: 120 + 120 * k, height: 90 + 90 * k, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)', opacity: a * (1 - k) }} />;
};

// 햇살 — 비스듬한 빛줄기가 들어오고 먼지가 반짝인다
const Rays: React.FC<{ t: number; from: number }> = ({ t, from }) => {
  const a = interpolate(t, [from, from + 0.45], [0, 1], clamp);
  return (
    <>
      <AbsoluteFill style={{ background: 'linear-gradient(115deg, rgba(255,214,120,0) 30%, rgba(255,214,120,0.28) 52%, rgba(255,214,120,0) 74%)', opacity: a * (0.8 + 0.2 * Math.sin(t * 1.7)), mixBlendMode: 'screen' }} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => {
        const x = 300 + rand(k + 2) * 720;
        const y0 = 500 + rand(k + 9) * 800;
        const y = y0 - ((t * (24 + 16 * rand(k))) % 200);
        const s = 8 + rand(k + 5) * 12;
        return <div key={k} style={{ position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,240,190,0.95) 0%, rgba(255,240,190,0) 70%)', opacity: a * (0.5 + 0.5 * Math.sin(t * 3 + k)) }} />;
      })}
    </>
  );
};

const Plate: React.FC<{ t: number }> = ({ t }) => {
  const ice = iceAt(t);
  // 칸 고르기
  if (t >= T.close && t < T.why) {
    const z = interpolate(t, [T.close, T.why], [1.0, 1.07], clamp);
    const sx = 2.4 * Math.sin(t * 41) * interpolate(t, [T.close, T.close + 0.4], [1, 0], clamp);
    return (
      <AbsoluteFill style={{ transform: `translate(${sx}px, 0) scale(${z})`, transformOrigin: '540px 1150px' }}>
        <Img src={staticFile('img/profIce.jpg')} style={FULL} />
      </AbsoluteFill>
    );
  }
  if (t >= T.rule && t < T.gag) return <Split t={t} />;
  const inSun = (t >= T.sun && t < T.rule) || t >= T.gag;
  const base = inSun ? 'sun' : 'room';
  // 카메라 — 서리가 번질 때 살짝 다가가고, 얼면 떠는 몽글로 조금씩
  let z = 1;
  let oy = 1100;
  let ox = 540;
  if (t < T.close) z = interpolate(t, [0, T.freeze, T.close], [1.0, 1.015, 1.06], clamp);
  else if (t < T.rewind) {
    z = interpolate(t, [T.why, T.rewind], [1.03, 1.1], clamp);
    ox = 380;
    oy = 1300;
  } else if (t < T.sun) z = interpolate(t, [T.rewind, T.sun], [1.03, 1.0], clamp);
  else if (t < T.rule) {
    z = interpolate(t, [T.sun, T.sun + 0.2, T.rule], [1.05, 1.0, 1.03], { ...clamp, easing: Easing.out(Easing.cubic) });
  } else if (t >= T.creep && t < T.a4) {
    z = interpolate(t, [T.creep, T.a4], [1.0, 1.06], clamp);
    ox = 700;
    oy = 1200;
  } else if (t >= T.a4) z = interpolate(t, [T.a4, T.a4 + 0.1, T.a4 + 0.6], [1.06, 1.1, 1.0], clamp);
  const shake = t >= T.freeze && t < T.frozen + 0.15 ? 3 * Math.sin(t * 73) : 0;
  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.6}px) scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
      <Scene t={t} base={base} ice={ice} />
      {inSun ? <Rays t={t} from={t >= T.gag ? T.gag - 1 : T.sun} /> : null}
    </AbsoluteFill>
  );
};

// 위아래 판 — 같은 방 · 같은 교수님. 둘 다 얼어 있다가 ✓와 함께 아래 판만 녹아 햇살이 된다(볼 이유 심사 「슬라이드 같다」)
const Split: React.FC<{ t: number }> = ({ t }) => {
  const p = interpolate(t, [T.rule, T.rule + 0.3], [0, 1], { ...clamp, easing: EASE_OUT });
  const melt = interpolate(t, [T.rule + 1.0, T.rule + 1.7], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const z = interpolate(t, [T.rule, T.gag], [1.0, 1.05], clamp);
  const wave = 8 * Math.sin((t - T.rule) * 7.5);
  const shiver = 3.5 * Math.sin(t * 58);
  return (
    <AbsoluteFill style={{ background: '#222' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 954, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: (1 - p) * -60, top: -520, width: 1080, height: 1920, transform: `scale(${z})`, transformOrigin: '540px 1000px' }}>
          <Img src={staticFile('img/ice.jpg')} style={FULL} />
          <Under img="iceEmpty" />
          <Patch img="ice" cx={MONGLE.cx} cy={MONGLE.cy} rx={MONGLE.rx} ry={MONGLE.ry} dx={shiver} oy={MONGLE.oy} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, top: 966, width: 1080, height: 954, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: (1 - p) * 60, top: -546, width: 1080, height: 1920, transform: `scale(${z})`, transformOrigin: '540px 1000px' }}>
          <Img src={staticFile('img/sun.jpg')} style={FULL} />
          <Patch img="sun" cx={HAND.cx} cy={HAND.cy} rx={HAND.rx} ry={HAND.ry} rot={melt * wave} ox={HAND.ox} oy={HAND.oy} />
          {melt < 1 ? <Img src={staticFile('img/ice.jpg')} style={{ ...FULL, WebkitMaskImage: frostMask(1 - melt), maskImage: frostMask(1 - melt) }} /> : null}
          <Glints p={1 - melt} t={t} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 눈송이 — 얼어 있는 동안 천천히 내린다(6~8초가 멈춘 설명판이 되지 않게)
const Snow: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.frozen || t >= T.rewind + 0.2) return null;
  const a = interpolate(t, [T.frozen, T.frozen + 0.4, T.rewind - 0.1, T.rewind + 0.2], [0, 1, 1, 0], clamp);
  return (
    <>
      {Array.from({ length: 30 }).map((_, k) => {
        const sp = 90 + rand(k + 4) * 120;
        const y = ((rand(k + 11) * 2100 + (t - T.frozen) * sp) % 2100) - 90;
        const x = rand(k + 23) * 1080 + 26 * Math.sin(t * (0.8 + rand(k) * 0.9) + k);
        const s = 12 + rand(k + 31) * 22;
        return <div key={k} style={{ position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.5) 42%, rgba(255,255,255,0) 72%)', opacity: a * (0.55 + 0.45 * rand(k + 41)) }} />;
      })}
    </>
  );
};

// 머리 글 — 쪽빛 펠트 + 바늘땀(지난 두 편의 카페 천 이름표 · 채팅 띠와 다르게)
const Sign: React.FC<{ t: number; at: number; until: number; top?: number; size?: number; children: React.ReactNode }> = ({ t, at, until, top = 262, size = 60, children }) => {
  if (t < at || t >= until) return null;
  const a = interpolate(t, [at, at + 0.16], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 60, width: 960, top, transform: `translateY(${(1 - a) * 14}px)`, opacity: a, filter: 'drop-shadow(0 10px 14px rgba(20,12,4,0.42))' }}>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 30, padding: '24px 30px 28px', boxSizing: 'border-box', fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.18, color: '#FFF6E4', textAlign: 'center', whiteSpace: 'pre-line', textShadow: '0 2px 2px rgba(10,10,20,0.5)' }}>
        <Img src={staticFile('img/clothBlue.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 10, borderRadius: 22, border: '3px dashed rgba(255,240,215,0.5)' }} />
        <div style={{ position: 'relative' }}>{children}</div>
      </div>
    </div>
  );
};

// 말풍선 — 크림 펠트 + 바늘땀. 한글 크게 · 키릴 읽기 · 몽골 뜻. shout면 기울어 튀어나온다
const Bubble: React.FC<{ t: number; from: number; until: number; left: number; top: number; w: number; h: number; tip: [number, number]; color?: string; size?: number; ko: React.ReactNode; read?: string; mn?: string; shout?: number }> = ({ t, from, until, left, top, w, h, tip, color = INK, size = 76, ko, read, mn, shout = 0 }) => {
  if (t < from || t >= until) return null;
  const a = shout ? interpolate(t, [from, from + 0.07, from + 0.2, from + 0.4], [0.3, 1.18, 0.97, 1], clamp) : interpolate(t, [from, from + 0.16], [0.82, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  const rx = Math.min(50, h / 2);
  const down = tip[1] > top + h / 2;
  const bx = Math.min(left + w - 90, Math.max(left + 90, tip[0]));
  const by = down ? top + h - 7 : top + 7;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `rotate(${shout}deg) scale(${a})`, transformOrigin: `${bx}px ${by}px`, filter: 'drop-shadow(0 8px 12px rgba(30,16,6,0.36))' }}>
      <div style={{ position: 'absolute', left, top, width: w, height: h, borderRadius: rx, overflow: 'hidden', boxSizing: 'border-box', border: `5px solid ${color}`, background: FELT }}>
        <Img src={staticFile('img/clothCream.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <rect x={left + 13} y={top + 13} width={w - 26} height={h - 26} rx={Math.min(40, h / 2 - 13)} fill="none" stroke={color} strokeOpacity={0.38} strokeWidth={3} strokeDasharray="12 9" strokeLinecap="round" />
        <path d={`M ${bx - 30} ${by} L ${tip[0]} ${tip[1]} L ${bx + 30} ${by}`} fill={FELT} stroke={color} strokeWidth={5} strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', left, top, width: w, height: h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 4, boxSizing: 'border-box', textAlign: 'center' }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.1, color, whiteSpace: 'nowrap' }}>{ko}</div>
        {read ? <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 42, lineHeight: 1.18, color: '#5F4E42', whiteSpace: 'nowrap' }}>{read}</div> : null}
        {mn ? <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 44, lineHeight: 1.16, color: MEAN, whiteSpace: 'nowrap' }}>{mn}</div> : null}
      </div>
    </div>
  );
};

// 위아래 판 위 이름표
const Label: React.FC<{ t: number; at: number; top: number; color: string; mark: string; children: React.ReactNode }> = ({ t, at, top, color, mark, children }) => {
  const a = interpolate(t, [at, at + 0.14], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: 90, width: 900, top, opacity: a, filter: 'drop-shadow(0 8px 12px rgba(20,12,4,0.4))' }}>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 26, border: `5px solid ${color}`, padding: '10px 22px 14px', boxSizing: 'border-box', textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 64, lineHeight: 1.16, color, background: FELT, whiteSpace: 'nowrap' }}>
        <Img src={staticFile('img/clothCream.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <span style={{ position: 'relative', marginRight: 16 }}>{mark}</span>
        <span style={{ position: 'relative' }}>{children}</span>
      </div>
    </div>
  );
};

const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at, vol = 1.3 }) => (
  <Sequence from={fr(at)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; at: number; vol: number }> = ({ file, at, vol }) => (
  <Sequence from={Math.max(0, fr(at))} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={vol * MASTER} />
  </Sequence>
);

const Sound: React.FC = () => (
  <>
    {/* 음악은 얼음일 때도 멎지 않게 절반 위로만 낮추고 그 밑에 바람을 깐다(제작 절차 「만들기」 · 검사 ⑲) */}
    <Audio src={staticFile('sfx/bgm.wav')} volume={(f) => MASTER * interpolate(f / FPS, [0, T.freeze, T.frozen, T.rewind, T.a2, T.total - 0.5, T.total], [0.19, 0.19, 0.17, 0.17, 0.2, 0.2, 0], clamp)} />
    <Audio src={staticFile('sfx/air.wav')} volume={(f) => 0.16 * MASTER * interpolate(f / FPS, [0, T.total - 0.4, T.total], [1, 1, 0], clamp)} />
    <Sfx file="wind.wav" at={T.frozen - 0.4} vol={0.42} />
    <Vo id="a1" at={T.a1} />
    <Sfx file="freeze.wav" at={T.freeze} vol={0.55} />
    <Sfx file="ting.wav" at={T.close} vol={0.3} />
    <Sfx file="shiver.wav" at={T.why + 0.2} vol={0.3} />
    <Sfx file="shiver.wav" at={T.why + 1.6} vol={0.3} />
    <Sfx file="rewind.wav" at={T.rewind} vol={0.65} />
    <Vo id="a2" at={T.a2} />
    <Sfx file="pop.wav" at={T.a2} vol={0.2} />
    <Sfx file="sunup.wav" at={T.sun} vol={0.6} />
    <Sfx file="birds.wav" at={T.sun + 0.2} vol={0.32} />
    <Vo id="b1" at={T.b1} />
    <Sfx file="pop.wav" at={T.rule} vol={0.24} />
    <Sfx file="ting.wav" at={T.rule + 0.15} vol={0.2} />
    <Sfx file="sunup.wav" at={T.rule + 1.0} vol={0.5} />
    <Sfx file="pop.wav" at={T.gag - 0.05} vol={0.2} />
    <Sfx file="birds.wav" at={T.gag} vol={0.2} />
    <Vo id="b2" at={T.gag + 0.12} />
    <Vo id="a3" at={T.a3} />
    <Sfx file="freeze.wav" at={T.creep} vol={0.45} />
    <Vo id="a4" at={T.a4} vol={1.4} />
    <Sfx file="rewind.wav" at={T.back} vol={0.5} />
    <Sfx file="sunup.wav" at={T.back + 0.12} vol={0.5} />
  </>
);

export const Film: React.FC<{ scene?: boolean }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{ background: '#20262e' }}>
      <Plate t={t} />
      <Breath t={t} />
      <Snow t={t} />
      {/* 온 방이 얼어붙는 순간 희게 번쩍 */}
      {t >= T.frozen - 0.05 && t < T.frozen + 0.3 ? <AbsoluteFill style={{ background: '#EAF6FF', opacity: interpolate(t, [T.frozen - 0.05, T.frozen, T.frozen + 0.3], [0, 0.45, 0], clamp) }} /> : null}
      {t >= T.sun && t < T.sun + 0.3 ? <AbsoluteFill style={{ background: '#FFF2CC', opacity: interpolate(t, [T.sun, T.sun + 0.03, T.sun + 0.3], [0.6, 0.7, 0], clamp) }} /> : null}
      {!scene ? <Sign t={t} at={-1} until={T.freeze} size={58}>{TEXT.hook}</Sign> : null}
      <Bubble t={t} from={T.a1} until={T.frozen} left={50} top={700} w={740} h={272} tip={[300, 1112]} color={CORAL} size={72} ko={TEXT.a1Ko} read={TEXT.a1Read} mn={TEXT.a1Mn} />
      {!scene ? (
        <>
          <Sign t={t} at={T.why} until={T.rewind} size={54}>
            {TEXT.whyKo}
            {'\n'}
            {TEXT.whyMn}
          </Sign>
          <Sign t={t} at={T.rewind} until={T.sun} size={52}>{TEXT.again}</Sign>
          {t >= T.rewind && t < T.rewind + 0.62 ? <Rewind t={t} /> : null}
          <Bubble t={t} from={T.a2} until={T.b1} left={70} top={700} w={640} h={272} tip={[330, 1112]} color={INK} size={84} ko={TEXT.a2Ko} read={TEXT.a2Read} mn={TEXT.a2Mn} />
          <Bubble t={t} from={T.b1} until={T.rule} left={330} top={520} w={690} h={250} tip={[800, 860]} color={WARM} size={72} ko={TEXT.b1Ko} read={TEXT.b1Read} mn={TEXT.b1Mn} />
          {t >= T.rule && t < T.gag ? (
            <>
              <Sign t={t} at={T.rule} until={T.gag} size={48}>
                {TEXT.ruleFriend}
                {': '}
                <span style={{ fontFamily: KO, fontWeight: 900 }}>수고하세요</span>
                {'\n'}
                {TEXT.ruleElder}
                {': '}
                <span style={{ fontFamily: KO, fontWeight: 900 }}>안녕히 계세요</span>
              </Sign>
              <Label t={t} at={T.rule + 0.15} top={812} color={COLD} mark="✕">{TEXT.no}</Label>
              <Label t={t} at={T.rule + 1.0} top={1000} color={WARM} mark="✓">{TEXT.yes}</Label>
            </>
          ) : null}
          <Sign t={t} at={T.gag + 0.1} until={T.a3} size={54}>{TEXT.gagMn}</Sign>
          <Bubble t={t} from={T.gag + 0.12} until={T.a3 + 0.1} left={430} top={560} w={560} h={210} tip={[810, 860]} color={WARM} size={84} ko={TEXT.b2Ko} read={TEXT.b2Read} />
          <Bubble t={t} from={T.a3} until={T.a4} left={70} top={760} w={560} h={210} tip={[320, 1112]} color={CORAL} size={84} ko={TEXT.a3Ko} read={TEXT.a3Read} />
          <Bubble t={t} from={T.a4} until={T.end} left={50} top={700} w={700} h={250} tip={[330, 1112]} color={INK} size={96} ko={TEXT.a4Ko} read={TEXT.a4Read} shout={-3} />
          <Sign t={t} at={T.end} until={T.total + 1} size={62}>
            {TEXT.end}{' '}
            <span style={{ fontFamily: KO, fontWeight: 900 }}>{TEXT.endKo}</span>
          </Sign>
        </>
      ) : null}
      <Sound />
    </AbsoluteFill>
  );
};

export const SceneFilm: React.FC = () => <Film scene />;
