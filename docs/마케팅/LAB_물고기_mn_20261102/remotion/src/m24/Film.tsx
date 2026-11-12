// LAB 몽골 M24 「물고기 = загас」 — 영어 편 E22를 몽골어로. 몽글의 점심 스테이크가 어항에 풍덩 빠져 헤엄친다(물 + 고기 = «усны мах»?).
// 진짜 금붕어가 와서 마주 보고(ЗАГАС), 몽글은 빈 접시 앞에서 운다(눈 + 물 = НУЛИМС). 끝은 고기와 금붕어가 친구가 되어 나란히 헤엄치고, 몽글이 「Баяртай, миний мах!」.
// 물개 세트는 뺐다(관문 조건 「세트 둘 · 18초 안」) — 그 시간표 자리는 99초.
// 11-10 판본 틀: 화면 글(뜻 · 읽는 법 · 말풍선)과 새 첫 2초 카드 · 끝 카드 · 끝 질문은 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 소리 · 박자는 그대로.
// 그림은 장면 판 넷(어항 · 놀람 · 울음 · 기쁨)과 끝 판, 물건은 오린 조각을 띠로 잘라 실제로 구부린다(Wag). 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { fr, T } from './timeline';
import { LocPack } from './판본';

const C = { coralShade: '#AE322A', brown: '#2B1A14', cream: '#FFFDF8' };
const KO = "'SUIT', 'Inter Tight', sans-serif";
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const BACK = Easing.out(Easing.back(2.2));
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
// 어항 자리(화면 좌표) — 판/어항 그림을 보고 맞췄다
const BOWL = { cx: 535, cy: 1012, rx: 440, ry: 402, water: 818, floor: 1190 };
const WATER_CLIP = `ellipse(${BOWL.rx}px ${BOWL.ry}px at ${BOWL.cx}px ${BOWL.cy}px)`;

const pop = (t: number, at: number) => interpolate(t, [at, at + 0.16], [0, 1], { ...clamp, easing: BACK });

// ── 조각을 띠로 잘라 구부린다 — 왼쪽 끝이 고정이고 오른쪽 끝으로 갈수록 크게 꺾인다 ──
const Wag: React.FC<{ src: string; w: number; h: number; t: number; amp: number; speed?: number; n?: number; mirror?: boolean }> = ({ src, w, h, t, amp, speed = 13, n = 14, mirror }) => {
  const sw = w / n;
  const strip = (i: number): React.ReactNode => {
    if (i >= n) return null;
    const a = amp * Math.sin(t * speed - i * 0.5) * (i / n);
    return (
      <div key={i} style={{ position: 'absolute', left: i === 0 ? 0 : sw, top: 0, width: sw + 7, height: h, transformOrigin: '0 50%', transform: `rotate(${a}deg)` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: sw + 7, height: h, overflow: 'hidden' }}>
          <Img src={staticFile(src)} style={{ position: 'absolute', left: -i * sw, top: 0, width: w, height: h, maxWidth: 'none', transform: mirror ? 'scaleX(-1)' : undefined }} />
        </div>
        {strip(i + 1)}
      </div>
    );
  };
  return <div style={{ position: 'relative', width: w, height: h }}>{strip(0)}</div>;
};

const At: React.FC<{ x: number; y: number; w: number; h: number; rot?: number; flip?: number; children: React.ReactNode }> = ({ x, y, w, h, rot = 0, flip = 1, children }) => (
  <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, transform: `rotate(${rot}deg) scaleX(${flip})` }}>{children}</div>
);

// ── 물속 · 물 위 나누기: 같은 조각을 두 번 그려 수면에서 잘라 물속 쪽만 푸르게 ──
const InWater: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ clipPath: `inset(${BOWL.water}px 0 0 0)` }}>
    <AbsoluteFill style={{ clipPath: WATER_CLIP, filter: 'saturate(0.84) brightness(0.93) contrast(0.95) blur(0.6px)' }}>{children}</AbsoluteFill>
  </AbsoluteFill>
);
const AboveWater: React.FC<{ children: React.ReactNode }> = ({ children }) => <AbsoluteFill style={{ clipPath: `inset(0 0 ${1920 - BOWL.water}px 0)` }}>{children}</AbsoluteFill>;
// 앞 유리 — 어항 그림을 물 자리에만 옅게 다시 얹어 조각이 유리 뒤에 있게 한다
const GlassFront: React.FC = () => (
  <AbsoluteFill style={{ clipPath: `inset(${BOWL.water}px 0 0 0)` }}>
    <AbsoluteFill style={{ clipPath: WATER_CLIP, opacity: 0.27 }}>
      <Img src={staticFile('img/bowl.jpg')} style={FULL} />
    </AbsoluteFill>
    <AbsoluteFill style={{ clipPath: WATER_CLIP, background: 'rgba(110,180,225,0.15)' }} />
  </AbsoluteFill>
);

const Splash: React.FC<{ t: number; t0: number; x: number; big?: number; id: string }> = ({ t, t0, x, big = 1, id }) => {
  const s = t - t0;
  if (s < 0 || s > 1.1) return null;
  const N = Math.round(46 * big);
  const drops = [];
  for (let i = 0; i < N; i++) {
    const a = -Math.PI * (0.08 + 0.84 * random(`${id}a${i}`));
    const v = (520 + 1250 * random(`${id}v${i}`)) * Math.sqrt(big);
    const r = 4 + 10 * random(`${id}r${i}`);
    const px = x + Math.cos(a) * v * s;
    const py = BOWL.water + Math.sin(a) * v * s + 0.5 * 3000 * s * s;
    if (py > BOWL.water + 70) continue;
    drops.push(<div key={i} style={{ position: 'absolute', left: px - r, top: py - r, width: r * 2, height: r * 2 * (1.5 + 1.6 * random(`${id}s${i}`)), borderRadius: '50%', transform: `rotate(${(Math.atan2(Math.sin(a) * v + 3000 * s, Math.cos(a) * v) * 180) / Math.PI - 90}deg)`, background: 'radial-gradient(circle at 36% 32%, rgba(255,255,255,0.95) 0%, rgba(214,239,255,0.7) 45%, rgba(130,195,235,0.32) 100%)' }} />);
  }
  const ring = interpolate(s, [0, 0.5], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: x - 380 * ring, top: BOWL.water - 34 * ring, width: 760 * ring, height: 68 * ring, borderRadius: '50%', border: '10px solid rgba(255,255,255,0.8)', opacity: 1 - ring }} />
      {drops}
    </AbsoluteFill>
  );
};

const Bubbles: React.FC<{ t: number; t0: number; x: number; id: string; n?: number; dur?: number; spread?: number }> = ({ t, t0, x, id, n = 22, dur = 1.5, spread = 200 }) => {
  const s = t - t0;
  if (s < 0 || s > dur + 0.9) return null;
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = random(`${id}d${i}`) * dur;
    const p = (s - d) / 0.85;
    if (p < 0 || p > 1) continue;
    const r = 6 + 17 * random(`${id}r${i}`);
    const bx = x + (random(`${id}x${i}`) - 0.5) * spread * 2 + 12 * Math.sin(p * 8 + i);
    const by = BOWL.floor - 40 - p * (BOWL.floor - BOWL.water - 30);
    out.push(<div key={i} style={{ position: 'absolute', left: bx - r, top: by - r, width: r * 2, height: r * 2, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.85)', background: 'radial-gradient(circle at 34% 30%, rgba(255,255,255,0.75), rgba(255,255,255,0.08) 58%)' }} />);
  }
  return <>{out}</>;
};

const Ripple: React.FC<{ t: number }> = ({ t }) => {
  let a = 0;
  for (const h of [T.plunge, T.plunge2, T.burst]) if (t >= h) a = Math.max(a, 20 * Math.exp(-(t - h) * 2.6));
  if (a < 1.2) return null;
  let d = '';
  for (let x = 120; x <= 950; x += 18) {
    const y = BOWL.water + a * Math.sin(x * 0.024 - t * 11) * Math.sin(((x - 120) / 830) * Math.PI);
    d += `${x === 120 ? 'M' : 'L'}${x} ${y.toFixed(1)} `;
  }
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <path d={d} fill="none" stroke="rgba(214,240,255,0.92)" strokeWidth={8} strokeLinecap="round" />
    </svg>
  );
};

// ── 고기 자세 ──
const steakPose = (t: number) => {
  if (t < T.plunge) {
    const p = t / T.plunge;
    return { x: 815 - 280 * p, y: (1 - p) * 1475 + p * 960 - 4 * 640 * p * (1 - p), rot: 720 * p * p, flip: 1, amp: 0, sc: interpolate(p, [0, 0.12], [0.62, 1], clamp), on: true };
  }
  const s = t - T.plunge;
  if (t < T.wig) return { x: 535, y: 1000 + 46 * Math.exp(-s * 2.6) * Math.sin(s * 8), rot: 10 * Math.exp(-s * 3), flip: 1, amp: 0, sc: 1, on: true };
  if (t < T.lit) {
    const w = interpolate(t, [T.wig, T.wig + 0.5], [0, 1], clamp);
    return { x: 535 + 26 * Math.sin((t - T.wig) * 5) * w, y: 1000, rot: 0, flip: 1, amp: 5 * w, sc: 1, on: true };
  }
  if (t < T.real) {
    // 8자로 헤엄 — 방향이 바뀔 때 몸을 뒤집는다
    const u = (t - T.lit) * 2.1;
    const flip = Math.max(-1, Math.min(1, -Math.cos(u) * 3.2));
    return { x: 535 + 215 * Math.sin(u), y: 1000 + 72 * Math.sin(2 * u), rot: -10 * Math.sin(2 * u), flip, amp: 7, sc: 1.1, on: true };
  }
  if (t >= T.pals) {
    // 금붕어 곁으로 다가가 나란히 — 같은 박자로 위아래
    const p = interpolate(t, [T.pals, T.pals + 0.6], [0, 1], { ...clamp, easing: EASE_IO });
    const go = interpolate(t, [T.away, T.away + 1.4], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
    return { x: interpolate(p, [0, 1], [330, 400]) + 16 * Math.sin(t * 2.2) + go * 700, y: 1000 + 22 * Math.sin(t * 2.6) - go * 40, rot: 4 * Math.sin(t * 2.6), flip: 1, amp: 5 + 3 * go, sc: 0.95, on: true };
  }
  if (t < T.dog) {
    const p = interpolate(t, [T.real, T.real + 0.45], [0, 1], { ...clamp, easing: EASE_OUT });
    return { x: interpolate(p, [0, 1], [430, 330]), y: 1000 + 14 * Math.sin(t * 3), rot: 0, flip: -1, amp: 4, sc: 0.95, on: true };
  }
  if (t < T.burst) {
    // 강아지가 오면 오른쪽 아래로 달아난다
    const away = interpolate(t, [T.plunge2, T.plunge2 + 0.35], [0, 1], { ...clamp, easing: EASE_OUT });
    return { x: 330 + 400 * away + 18 * Math.sin(t * 4), y: 1020 + 34 * away + 12 * Math.sin(t * 5), rot: 0, flip: -1, amp: 5 + 3 * away, sc: 0.95, on: true };
  }
  return { x: 0, y: 0, rot: 0, flip: 1, amp: 0, sc: 1, on: false };
};
const Steak: React.FC<{ t: number }> = ({ t }) => {
  const p = steakPose(t);
  if (!p.on) return null;
  const w = 430 * p.sc;
  const h = w * (349 / 640);
  return (
    <At x={p.x} y={p.y} w={w} h={h} rot={p.rot} flip={p.flip}>
      <Wag src="img/steak.png" w={w} h={h} t={t} amp={p.amp} />
    </At>
  );
};

// 자갈 위 그림자 — 물속에 떠 있는 깊이
const FloorShadow: React.FC<{ t: number }> = ({ t }) => {
  const p = steakPose(t);
  if (!p.on || t < T.plunge) return null;
  return <div style={{ position: 'absolute', left: p.x - 170, top: 1150, width: 340, height: 54, borderRadius: '50%', background: 'rgba(40,50,60,0.3)', filter: 'blur(16px)' }} />;
};
// 강아지 생각 풍선 — 고기를 노린다
const DogThought: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.dog + 0.4 || t >= T.jump) return null;
  const a = pop(t, T.dog + 0.4);
  const w = 215;
  const h = w * (349 / 640);
  return (
    <>
      <div style={{ position: 'absolute', left: 176, top: 1012, width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,253,248,0.96)', transform: `scale(${a})` }} />
      <div style={{ position: 'absolute', left: 208, top: 962, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,253,248,0.96)', transform: `scale(${a})` }} />
      <div style={{ position: 'absolute', left: 60, top: 700, width: 370, height: 250, borderRadius: '50%', background: 'rgba(255,253,248,0.97)', boxShadow: '0 10px 26px rgba(40,10,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${a})`, transformOrigin: '60% 100%' }}>
        <Img src={staticFile('img/steak.png')} style={{ width: w, height: h, transform: `rotate(${6 * Math.sin(t * 6)}deg)` }} />
      </div>
    </>
  );
};

// ── 끝(v6): 빈 접시 앞 몽글이 어항 속 고기와 금붕어를 바라본다 — 판/작별(물만 든 어항 · 눈물 맺힌 채 작게 웃는 몽글) 위에 둘을 헤엄치게 얹는다 ──
const FB = { cx: 333, cy: 935, rx: 318, ry: 330, water: 800 }; // 작별 판의 어항(1080 좌표)
const Farewell: React.FC<{ t: number }> = ({ t }) => {
  const s = t - T.pals;
  const zin = interpolate(t, [T.gulp - 0.6, T.gulp - 0.2, T.gulp + 1.1, T.gulp + 1.35], [0, 1, 1, 0], { ...clamp, easing: EASE_IO });
  const z = interpolate(s, [0, 4.5], [1.0, 1.06], clamp) * (1 + 0.85 * zin) * (1 + 0.06 * interpolate(t, [T.gulp + 0.95, T.gulp + 1.03, T.gulp + 1.25], [0, 1, 0], clamp));
  const ox = interpolate(zin, [0, 1], [540, 300]);
  const oy = interpolate(zin, [0, 1], [1000, 930]);
  const u = Math.min(s, T.gulp - 0.35 - T.pals) * 1.6; // 꿀꺽 앞에서 헤엄을 멈춘다
  const sx = 300 + 110 * Math.sin(u);
  const sy = 930 + 30 * Math.sin(2 * u);
  const flip = Math.max(-1, Math.min(1, Math.cos(u) * 3.2)); // 오른쪽으로 갈 때 1
  const sw = 230;
  const sh = sw * (349 / 640);
  const g = interpolate(t, [T.gulp - 0.5, T.gulp], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) }); // 금붕어가 고기 쪽으로 돌진
  const eat = interpolate(t, [T.gulp, T.gulp + 0.15, T.gulp + 0.8, T.gulp + 0.95], [0, 0.4, 0.6, 1], clamp); // 물고 냠냠(0.4~0.6) → 꿀꺽
  const puff = t >= T.gulp + 0.95 ? 1 + 0.62 * interpolate(t, [T.gulp + 0.95, T.gulp + 1.2], [0, 1], { ...clamp, easing: BACK }) : 1; // 배가 볼록
  const after = Math.max(0, t - T.gulp - 1.25);
  const chew = t >= T.gulp && t < T.gulp + 0.95 ? 8 * Math.sin((t - T.gulp) * 38) : 0; // 냠냠 — 고기가 입에서 흔들린다
  const fw = 175 * puff;
  const fh = 175 * (412 / 560) * puff;
  const steakX = sx - 70 * flip;
  const fishX0 = sx + 120 * flip;
  const fishX = interpolate(g, [0, 1], [fishX0, steakX + 40 * flip]) + 60 * Math.sin(after * 2.2) * Math.min(1, after * 2);
  const fishY = sy - 10 + 14 * Math.sin(after * 3.1);
  const hearts = [];
  for (let i = 0; i < 4; i++) {
    const h = t - (T.pals + 0.5 + i * 0.55);
    if (h < 0 || h > 1.3 || t > T.gulp - 0.4) continue;
    hearts.push(<div key={i} style={{ position: 'absolute', left: sx + 80 * flip - 22 + 12 * Math.sin(h * 5 + i), top: sy - 70 - h * 200, fontSize: 46, opacity: interpolate(h, [0, 0.15, 1.0, 1.3], [0, 1, 1, 0], clamp) }}>💛</div>);
  }
  return (
    <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
      <Img src={staticFile('img/bye.jpg')} style={FULL} />
      <AbsoluteFill style={{ clipPath: `inset(${FB.water}px 0 0 0)` }}>
        <AbsoluteFill style={{ clipPath: `ellipse(${FB.rx}px ${FB.ry}px at ${FB.cx}px ${FB.cy}px)`, filter: 'saturate(0.86) brightness(0.95) blur(0.5px)' }}>
          {eat < 1 ? (
            <At x={interpolate(eat, [0, 1], [steakX, fishX - 40 * flip]) + chew} y={sy + 10 + chew * 0.5} w={sw * (1 - eat)} h={sh * (1 - eat)} rot={-6 * Math.sin(2 * u)} flip={flip}>
              <Wag src="img/steak.png" w={sw * (1 - eat)} h={sh * (1 - eat)} t={t} amp={6} />
            </At>
          ) : null}
          <At x={fishX} y={fishY} w={fw} h={fh} rot={5 * Math.sin(2 * u) + (t > T.gulp ? 6 * Math.sin(after * 4) : 0)} flip={flip}>
            <Wag src="img/fish.png" w={fw} h={fh} t={t} amp={5} speed={9} mirror />
          </At>
          {/* 트림 방울 */}
          {[0, 1, 2].map((i) => {
            const b = t - (T.gulp + 1.3 + i * 0.18);
            if (b < 0 || b > 1.2) return null;
            const r = 10 + 6 * i;
            return <div key={i} style={{ position: 'absolute', left: fishX - 70 * flip - r, top: fishY - 40 - b * 220 - r, width: r * 2, height: r * 2, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.9)', background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.7), rgba(255,255,255,0.05) 60%)' }} />;
          })}
          {hearts}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── 끝: 고기와 금붕어 사이에서 하트가 올라온다 ──
const Hearts: React.FC<{ t: number }> = ({ t }) => {
  const out = [];
  for (let i = 0; i < 5; i++) {
    const s = t - (T.pals + 0.6 + i * 0.28);
    if (s < 0 || s > 1.3) continue;
    out.push(<div key={i} style={{ position: 'absolute', left: 540 + 26 * Math.sin(s * 5 + i) - 30, top: 930 - s * 260, fontSize: 60, opacity: interpolate(s, [0, 0.15, 1.0, 1.3], [0, 1, 1, 0], clamp), transform: `scale(${interpolate(s, [0, 0.2], [0.4, 1], clamp)})` }}>💛</div>);
  }
  return <>{out}</>;
};

// ── 금붕어: 그림은 오른쪽을 본다. 오른쪽에서 들어와 고기와 마주 본다 ──
const Fish: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.real) return null;
  const p = interpolate(t, [T.real, T.real + 0.55], [0, 1], { ...clamp, easing: EASE_OUT });
  const go = interpolate(t, [T.plunge2, T.plunge2 + 0.5], [0, 1], { ...clamp, easing: EASE_IO }); // 강아지가 오면 피해 올라간다
  const near = interpolate(t, [T.pals, T.pals + 0.6], [0, 1], { ...clamp, easing: EASE_IO }); // 끝 — 고기 곁으로
  const away = interpolate(t, [T.away, T.away + 1.4], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) }); // 함께 떠난다
  const x = interpolate(p, [0, 1], [1160, 690]) + go * 150 - near * 30 + near * 16 * Math.sin(t * 2.2) + away * 700;
  const y = 980 + 16 * Math.sin(t * 2.6) - go * 90 + near * (6 * Math.sin(t * 2.6) - 16 * Math.sin(t * 2.6) + 20);
  const w = 340 * (t > T.dog ? 0.86 : 1);
  const h = w * (412 / 560);
  return (
    <At x={x} y={y} w={w} h={h} rot={5 * Math.sin(t * 2)}>
      <Wag src="img/fish.png" w={w} h={h} t={t} amp={5} speed={9} mirror />
    </At>
  );
};

// ── 강아지 ──
const DogSit: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.dog || t >= T.jump) return null;
  const up = interpolate(t, [T.dog, T.dog + 0.3], [0, 1], { ...clamp, easing: BACK });
  const w = 330;
  const h = w * (747 / 560);
  const squash = (b: number) => interpolate(t, [b - 0.04, b + 0.03, b + 0.12], [1, 0.84, 1], clamp);
  const sy = squash(T.wag1) * squash(T.wag2) * interpolate(t, [T.jump - 0.18, T.jump], [1, 0.8], clamp);
  const tilt = -5 + 5 * Math.sin(t * 2.2);
  return (
    <div style={{ position: 'absolute', left: 8, top: 1490 - h, width: w, height: h, transformOrigin: '50% 100%', transform: `translateY(${(1 - up) * 360}px) scaleY(${sy}) scaleX(${2 - sy}) rotate(${tilt}deg)` }}>
      <div style={{ position: 'absolute', left: 10, bottom: -12, width: w - 20, height: 50, borderRadius: '50%', background: 'rgba(70,40,20,0.42)', filter: 'blur(14px)' }} />
      <Img src={staticFile('img/dog_sit.png')} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, transform: 'scaleX(-1)', filter: 'sepia(0.16) saturate(1.06) brightness(0.96)' }} />
    </div>
  );
};
const dogPose = (t: number) => {
  if (t < T.jump || t >= T.burst) return null;
  if (t < T.plunge2) {
    const p = (t - T.jump) / (T.plunge2 - T.jump);
    return { x: 170 + (540 - 170) * p, y: 1290 + (850 - 1290) * p - 800 * p * (1 - p), rot: interpolate(p, [0, 1], [-34, 34]), amp: 0 };
  }
  const s = t - T.plunge2;
  const dip = 70 * Math.exp(-s * 5);
  return { x: 540 + 90 * Math.min(s, 1.4) + 12 * Math.sin(t * 8), y: 840 + dip + 8 * Math.sin(t * 13), rot: 5 * Math.sin(t * 13), amp: 5 };
};
const DogSwim: React.FC<{ t: number }> = ({ t }) => {
  const p = dogPose(t);
  if (!p) return null;
  const w = 400;
  const h = w * (458 / 640);
  return (
    <At x={p.x} y={p.y} w={w} h={h} rot={p.rot} flip={-1}>
      <Wag src="img/dog_swim.png" w={w} h={h} t={t} amp={p.amp} speed={16} mirror />
    </At>
  );
};

// ── 물개: 물이 터지며 솟는다, 코에 고기 ──
const SEAL_W = 560;
const SEAL_H = SEAL_W * (921 / 640);
const sealY = (t: number) => {
  const up = interpolate(t, [T.burst, T.burst + 0.42], [0, 1], { ...clamp, easing: BACK });
  return interpolate(up, [0, 1], [1560, 800]) + 10 * Math.sin(t * 5);
};
const Seal: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.burst) return null;
  return (
    <At x={520} y={sealY(t)} w={SEAL_W} h={SEAL_H} rot={2.5 * Math.sin(t * 5)}>
      <Img src={staticFile('img/seal.png')} style={{ width: SEAL_W, height: SEAL_H }} />
    </At>
  );
};
const SteakOnNose: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.burst) return null;
  const s = t - T.toss;
  const hop = s > 0 && s < 0.7 ? 150 * 4 * (s / 0.7) * (1 - s / 0.7) : 0;
  const land = s >= 0.7 && s < 1.0 ? 14 * Math.sin((s - 0.7) * 22) * (1 - (s - 0.7) / 0.3) : 0;
  const w = 360;
  const h = w * (349 / 640);
  return (
    <At x={520 + 12 * Math.sin(t * 5)} y={sealY(t) - SEAL_H / 2 - 22 - hop + land} w={w} h={h} rot={7 * Math.sin(t * 5) + (hop > 0 ? (s / 0.7) * 360 : 0)}>
      <Img src={staticFile('img/steak.png')} style={{ width: w, height: h }} />
    </At>
  );
};

// 박자 펀치 인 — 그 박마다 한 칸 가까이(원본 박자 자리), 작은 튐을 더해 한 번에 바뀌게
const punch = (t: number, beats: number[], step: number) => {
  let z = 1;
  for (const b of beats) if (t >= b) z += step * interpolate(t, [b, b + 0.06], [0, 1], clamp);
  return z;
};
const BEATS_A = [T.w1, T.w2, T.wig, T.plus];
const BEATS_B = [T.dogL, T.wag1, T.wag2];
const BEATS_C = [T.fishT];

// 어항 옆 빈 접시 — 울음 판의 접시를 오려 얹는다(그 고기가 여기서 나갔다)
const Plate: React.FC = () => (
  <>
    <div style={{ position: 'absolute', left: 618, top: 1552, width: 400, height: 56, borderRadius: '50%', background: 'rgba(70,40,20,0.36)', filter: 'blur(14px)' }} />
    <Img src={staticFile('img/plate.png')} style={{ position: 'absolute', left: 625, top: 1420, width: 380, height: 158 }} />
  </>
);

// ── 어항 장면 ──
const BowlScene: React.FC<{ t: number }> = ({ t }) => {
  let z = interpolate(t, [0, T.whip], [1, 1.04], clamp);
  if (t >= T.whip) z = interpolate(t, [T.whip, T.lit], [1.04, 1.2], { ...clamp, easing: EASE_IO });
  if (t >= T.real) z = 1.1;
  if (t >= T.dog) z = interpolate(t, [T.dog, T.jump], [1.0, 1.05], clamp);
  if (t >= T.plunge2) z = interpolate(t, [T.plunge2, T.burst], [1.05, 1.12], clamp);
  if (t >= T.burst) z = 1.0;
  const hit = (h: number, a: number) => (t >= h && t < h + 0.32 ? a * Math.sin((t - h) * 62) * (1 - (t - h) / 0.32) : 0);
  if (t < T.whip) z *= punch(t, BEATS_A, 0.05);
  else if (t >= T.real && t < T.eye) z *= punch(t, BEATS_C, 0.08);
  else if (t >= T.dog && t < T.jump) z *= punch(t, BEATS_B, 0.06);
  const shake = hit(T.plunge, 11) + hit(T.plunge2, 11) + hit(T.burst, 18);
  return (
    <AbsoluteFill style={{ transform: `translateY(${shake}px) scale(${z})`, transformOrigin: `${BOWL.cx}px ${BOWL.cy}px` }}>
      <Img src={staticFile('img/bowl.jpg')} style={FULL} />
      <Plate />
      <InWater>
        <FloorShadow t={t} />
        <Fish t={t} />
        {t >= T.plunge ? <Steak t={t} /> : null}
        <DogSwim t={t} />
        <Seal t={t} />
        <Hearts t={t} />
        <Bubbles t={t} t0={T.plunge} x={535} id="b1" n={20} dur={0.8} />
        <Bubbles t={t} t0={T.lit} x={535} id="b2" n={16} dur={2.2} spread={250} />
        <Bubbles t={t} t0={T.real} x={520} id="b3" n={14} dur={2.0} spread={300} />
        <Bubbles t={t} t0={T.plunge2} x={560} id="b4" n={24} dur={1.5} spread={280} />
        <Bubbles t={t} t0={T.burst} x={520} id="b5" n={30} dur={1.6} spread={330} />
      </InWater>
      <GlassFront />
      <AboveWater>
        <DogSwim t={t} />
        <Seal t={t} />
      </AboveWater>
      {t < T.plunge ? <Steak t={t} /> : null}
      <SteakOnNose t={t} />
      <DogSit t={t} />
      <DogThought t={t} />
      <Ripple t={t} />
      <Splash t={t} t0={T.plunge} x={535} id="s1" />
      <Splash t={t} t0={T.plunge2} x={540} id="s2" />
      <Splash t={t} t0={T.burst} x={520} big={1.7} id="s3" />
    </AbsoluteFill>
  );
};

const Shock: React.FC<{ t: number }> = ({ t }) => {
  const s = t - T.shock;
  const z = interpolate(s, [0, 0.14, 1], [1.0, 1.08, 1.13], clamp);
  const j = s < 0.45 ? 9 * Math.sin(s * 75) * (1 - s / 0.45) : 0;
  return <Img src={staticFile('img/shock.jpg')} style={{ ...FULL, transform: `translateX(${j}px) scale(${z})`, transformOrigin: '660px 900px' }} />;
};

// ── 울음: 눈을 크게 → 뒤로 빠지며 빈 접시 ──
const EYE = { x: 416, y: 772 };
const PLATE = { x: 530, y: 1250 };
const TearDrop: React.FC<{ t: number; t0: number; x: number; id: number }> = ({ t, t0, x, id }) => {
  const s = t - t0;
  if (s < 0 || s > 1.15) return null;
  const slide = interpolate(s, [0, 0.72], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const y = interpolate(slide, [0, 1], [808, 1085]);
  const fall = s > 0.72 ? 0.5 * 3200 * (s - 0.72) ** 2 : 0;
  const r = 15 + ((id * 37) % 5) * 1.6;
  return <div style={{ position: 'absolute', left: x - r, top: y + fall - r, width: r * 2, height: r * 2.3, borderRadius: '50% 50% 50% 50% / 62% 62% 42% 42%', background: 'radial-gradient(circle at 36% 62%, rgba(255,255,255,0.8) 0%, rgba(232,247,255,0.34) 34%, rgba(170,220,250,0.3) 68%, rgba(120,180,225,0.55) 100%)', border: '1.5px solid rgba(255,255,255,0.65)', boxShadow: '0 3px 8px rgba(40,70,100,0.25)' }} />;
};
const TEARS = [T.waterL - 0.5, T.waterL - 0.05, T.waterL + 0.4, T.waterL + 0.85, T.cry + 0.1, T.cry + 0.4, T.cry + 0.7].map((t0, i) => ({ t0, x: i % 2 ? 690 : 390 }));
const Cry: React.FC<{ t: number }> = ({ t }) => {
  let z = interpolate(t, [T.eye, T.eyeL], [1.02, 1.05], clamp);
  if (t >= T.eyeL) z = interpolate(t, [T.eyeL, T.eyeL + 0.2], [1.05, 3.3], { ...clamp, easing: EASE_IO });
  if (t >= T.eyeL) z *= punch(t, [T.tear], 0.09);
  const onPlate = t >= T.waterL && t < T.whip2;
  if (onPlate) z = interpolate(t, [T.waterL, T.whip2], [2.05, 2.25], clamp);
  if (t >= T.whip2) z = interpolate(t, [T.whip2, T.cry], [3.3, 1.02], { ...clamp, easing: EASE_IO });
  if (t >= T.cry) z = interpolate(t, [T.cry, T.cryEnd], [1.02, 1.07], clamp);
  const zoomed = interpolate(z, [1.05, 2.9], [0, 1], clamp);
  const ox = onPlate ? PLATE.x : interpolate(zoomed, [0, 1], [540, EYE.x]);
  const oy = onPlate ? PLATE.y : interpolate(zoomed, [0, 1], [930, EYE.y]);
  const sob = t < T.eyeL || t >= T.cry ? 7 * Math.abs(Math.sin(t * 6.4)) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#1a0c07' }}>
      <AbsoluteFill style={{ transform: `translateY(${sob}px) scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
        <Img src={staticFile('img/cry.jpg')} style={FULL} />
        <TearDrop t={t} t0={T.tear} x={392} id={1} />
        {TEARS.map((d, i) => (
          <TearDrop key={i} t={t} t0={d.t0} x={d.x} id={i + 2} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 「내 점심!」 — 빠진 고기가 몽글 것임을 알린다(시험관 셋 · 볼 이유 심사 「왜 우는지」)
const Lunch: React.FC<{ t: number; p: LocPack }> = ({ t, p }) => {
  if (t < T.shock + 0.12 || t >= T.real) return null;
  const a = pop(t, T.shock + 0.12);
  return (
    <div style={{ position: 'absolute', left: 120, top: 400, width: 760, padding: '24px 20px 28px', borderRadius: 46, background: 'rgba(255,253,248,0.97)', boxShadow: '0 10px 26px rgba(40,10,0,0.35)', transform: `scale(${a})`, transformOrigin: '70% 100%', textAlign: 'center', fontFamily: p.font, fontWeight: 800, fontSize: p.lunchSize, lineHeight: p.lineH, color: C.coralShade }}>
      {p.lunch}
      <svg width={70} height={56} style={{ position: 'absolute', left: 500, bottom: -52 }}>
        <path d="M0 0 L66 0 L34 54 Z" fill="rgba(255,253,248,0.97)" />
      </svg>
    </div>
  );
};

const Joy: React.FC<{ t: number }> = ({ t }) => {
  const s = t - T.joy;
  const hop = Math.abs(Math.sin(s * 11)) * 22;
  return <Img src={staticFile('img/joy.jpg')} style={{ ...FULL, transform: `translateY(${-hop}px) scale(1.08)`, transformOrigin: '660px 1000px' }} />;
};

const Bye: React.FC<{ t: number; p: LocPack }> = ({ t, p }) => {
  if (t < T.bye || (t > T.gulp - 0.6 && t < T.gulp + 1.3)) return null;
  const a = t >= T.gulp + 1.3 ? pop(t, T.gulp + 1.3) : pop(t, T.bye);
  return (
    <div style={{ position: 'absolute', left: 250, top: 470, width: 790, padding: '24px 20px 28px', borderRadius: 46, background: 'rgba(255,253,248,0.97)', boxShadow: '0 10px 26px rgba(40,10,0,0.35)', transform: `scale(${a})`, transformOrigin: '80% 100%', textAlign: 'center', fontFamily: `${p.font}, 'Segoe UI Emoji'`, fontWeight: 800, fontSize: p.byeSize, lineHeight: p.lineH, color: C.coralShade }}>
      {t >= T.gulp ? <span style={{ fontSize: p.byeSize + 30 }}>…?! 😳</span> : p.bye}
      <svg width={110} height={190} style={{ position: 'absolute', left: 520, bottom: -186 }}>
        <path d="M0 0 L70 0 L104 186 Z" fill="rgba(255,253,248,0.97)" />
      </svg>
    </div>
  );
};

const EndScene: React.FC<{ t: number }> = ({ t }) => {
  const s = t - T.end;
  const z = interpolate(s, [0, 1.7], [1.0, 1.05], clamp);
  const pulse = 1 + 0.012 * Math.abs(Math.sin(s * 5.2));
  return (
    <AbsoluteFill>
      <Img src={staticFile('img/end.jpg')} style={{ ...FULL, transform: `scale(${z * pulse})`, transformOrigin: '500px 900px' }} />
      <Splash t={t} t0={T.end} x={420} big={0.8} id="s4" />
    </AbsoluteFill>
  );
};

// ── 글 판 ──
const Box: React.FC<{ ko: string; read: string; mean?: string; p: LocPack; x: number; w: number; y: number; a: number; koSize?: number; meanColor?: string; meanSize?: number }> = ({ ko, read, mean, p, x, w, y, a, koSize = 124, meanColor = C.brown, meanSize }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, borderRadius: 38, background: 'rgba(255,253,248,0.97)', boxShadow: '0 10px 28px rgba(40,10,0,0.3)', padding: '16px 14px 20px', textAlign: 'center', transform: `scale(${a})`, transformOrigin: '50% 40%', opacity: Math.min(1, a * 2) }}>
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: koSize, lineHeight: 1.08, color: C.coralShade, whiteSpace: 'nowrap' }}>{ko}</div>
    <div style={{ fontFamily: "'Inter Tight', 'SUIT', sans-serif", fontWeight: 700, fontSize: 52, lineHeight: 1.12, color: '#6B4A3C' }}>{read}</div>
    {mean ? <div style={{ fontFamily: `${p.font}, 'Segoe UI Emoji'`, fontWeight: 800, fontSize: meanSize ?? p.mean, lineHeight: p.lineH, color: meanColor, whiteSpace: 'pre', marginTop: 2 }}>{mean}</div> : null}
  </div>
);
const Pair: React.FC<{ t: number; p: LocPack; a0: number; b0: number; plus0: number; end: number; a: [string, string, string]; b: [string, string, string] }> = ({ t, p, a0, b0, plus0, end, a, b }) => {
  if (t < Math.min(a0, b0) || t >= end) return null;
  return (
    <>
      {t >= a0 ? <Box ko={a[0]} read={a[1]} mean={a[2]} p={p} x={68} w={380} y={286} a={pop(t, a0)} /> : null}
      {t >= b0 ? <Box ko={b[0]} read={b[1]} mean={b[2]} p={p} x={534} w={382} y={286} a={pop(t, b0)} /> : null}
      {t >= plus0 ? <div style={{ position: 'absolute', left: 448, width: 86, top: 330, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 128, lineHeight: 1, color: C.cream, WebkitTextStroke: '10px #AE322A', paintOrder: 'stroke fill', transform: `scale(${pop(t, plus0)})` }}>+</div> : null}
    </>
  );
};
const Title: React.FC<{ t: number; p: LocPack; at: number; end: number; ko: string; read: string; mean: string; strong?: boolean; y?: number }> = ({ t, p, at, end, ko, read, mean, strong, y = 286 }) => {
  if (t < at || t >= end) return null;
  return <Box ko={ko} read={read} mean={mean} p={p} x={68} w={848} y={y} a={pop(t, at)} koSize={132} meanColor={strong ? C.coralShade : C.brown} meanSize={strong ? p.mean + 40 : p.mean + 8} />;
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
    <Sfx file="bgm_a.wav" at={0} vol={0.3} dur={T.eye + 0.3} />
    <Sfx file="splash_big.wav" at={T.plunge - 0.04} vol={0.8} />
    <Sfx file="pop.wav" at={T.w1} vol={0.32} />
    <Vo id="w" at={T.w1 + 0.04} />
    <Sfx file="pop.wav" at={T.w2} vol={0.32} />
    <Vo id="g" at={T.w2 + 0.04} />
    <Sfx file="tok.wav" at={T.plus} vol={0.4} />
    <Sfx file="whoosh.wav" at={T.whip - 0.12} vol={0.34} />
    <Vo id="fq" at={T.lit + 0.12} />
    <Sfx file="bubbles.wav" at={T.lit + 0.3} vol={0.4} />
    <Sfx file="sting.wav" at={T.shock} vol={0.3} />
    <Sfx file="bubbles.wav" at={T.real} vol={0.34} />
    <Sfx file="pop.wav" at={T.fishT} vol={0.34} />
    <Vo id="f" at={T.fishT + 0.04} />
    <Sfx file="sad.wav" at={T.eye - 0.02} vol={0.42} dur={T.pals - T.eye + 0.3} />
    <Sfx file="sniff.wav" at={T.eye + 0.05} vol={0.34} />
    <Sfx file="pop.wav" at={T.eyeL} vol={0.3} />
    <Vo id="n" at={T.eyeL + 0.04} />
    <Sfx file="plip.wav" at={T.tear + 0.72} vol={0.34} />
    <Sfx file="pop.wav" at={T.waterL} vol={0.3} />
    <Vo id="w" at={T.waterL + 0.04} />
    <Sfx file="whoosh.wav" at={T.whip2 - 0.1} vol={0.26} />
    <Vo id="t" at={T.cry + 0.14} />
    <Sfx file="sniff.wav" at={T.cry + 1.5} vol={0.3} />
    {TEARS.map((d, i) => (
      <Sfx key={i} file="plip.wav" at={d.t0 + 0.98} vol={0.22} />
    ))}
    <Sfx file="bgm_b.wav" at={T.pals} vol={0.3} dur={T.total - T.pals} />
    <Sfx file="bubbles.wav" at={T.pals + 0.1} vol={0.34} />
    <Sfx file="pop.wav" at={T.pals + 0.6} vol={0.26} />
    <Sfx file="sniff.wav" at={T.bye - 0.35} vol={0.3} />
    <Sfx file="pop.wav" at={T.bye} vol={0.32} />
    <Sfx file="whoosh.wav" at={T.gulp - 0.6} vol={0.3} />
    <Sfx file="tok.wav" at={T.gulp} vol={0.42} />
    <Sfx file="tok.wav" at={T.gulp + 0.3} vol={0.36} />
    <Sfx file="tok.wav" at={T.gulp + 0.58} vol={0.36} />
    <Sfx file="pop.wav" at={T.gulp + 0.95} vol={0.6} />
    <Sfx file="sting.wav" at={T.gulp + 1.3} vol={0.32} />
    <Sfx file="bubbles.wav" at={T.gulp + 1.35} vol={0.36} />
  </>
);

// ── 첫 2초 카드(판본 hook, 선택) — 「물」 칸이 뜨는 0.62초부터 「물고기」 제목(3.0초) 앞까지, 낱말 칸 둘 바로 아래 · 어항 물 위.
// 0~0.62초는 스테이크가 튀어 어항에 빠지는 장면이라 비워 둔다. 비우면 그리지 않는다(몽골판 그대로).
const HookBand: React.FC<{ t: number; p: LocPack }> = ({ t, p }) => {
  if (!p.hook || t < T.w1 || t >= T.lit) return null;
  const a = interpolate(t, [T.w1, T.w1 + 0.2], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 68, width: 848, top: 630, padding: '18px 26px 22px', borderRadius: 40, background: 'rgba(43,26,20,0.92)', boxShadow: '0 10px 28px rgba(40,10,0,0.3)', opacity: a, transform: `translateY(${(1 - a) * 16}px)`, textAlign: 'center', fontFamily: `${p.font}, 'Segoe UI Emoji'`, fontWeight: 800, fontSize: p.hookSize, lineHeight: p.lineH, color: C.cream, whiteSpace: 'pre-line' }}>
      {p.hook}
    </div>
  );
};

// ── 끝 카드 · 끝 질문(판본 endCard · ask, 선택) — 꿀꺽 뒤 「…?!」(16.2초)와 함께, 그 말풍선(470px) 위 줄. 한 줄씩만 들어간다(아래 끝 460px).
const END_AT = T.gulp + 1.3;
const EndCard: React.FC<{ t: number; p: LocPack }> = ({ t, p }) => {
  if (t < END_AT || (!p.endCard && !p.ask)) return null;
  const a = pop(t, END_AT);
  return (
    <div style={{ position: 'absolute', left: 110, top: 290, width: 800, padding: '14px 20px 18px', borderRadius: 38, background: 'rgba(43,26,20,0.92)', boxShadow: '0 10px 28px rgba(40,10,0,0.3)', transform: `scale(${a})`, transformOrigin: '50% 0%', textAlign: 'center', fontFamily: `${p.font}, 'Segoe UI Emoji'`, fontWeight: 800, lineHeight: p.lineH, whiteSpace: 'pre-line' }}>
      {p.endCard ? <div style={{ fontSize: p.endSize, color: '#FFC15E' }}>{p.endCard}</div> : null}
      {p.ask ? <div style={{ fontSize: p.askSize, color: C.cream, marginTop: p.endCard ? 6 : 0 }}>{p.ask}</div> : null}
    </div>
  );
};

// p = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 m24-<KEY>로 넘긴다. 읽는 법 reads는 물 · 고기 · 물고기 · 눈 · 눈물 차례
export const Film: React.FC<{ p: LocPack }> = ({ p }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const [rMul, rGogi, rMulgogi, rNun, rNunmul] = p.reads;
  const bowl = t < T.shock || (t >= T.real && t < T.eye) || (t >= T.cryEnd && t < T.pals);
  return (
    <AbsoluteFill style={{ backgroundColor: '#1a0c07' }}>
      {bowl ? <BowlScene t={t} /> : null}
      {t >= T.shock && t < T.real ? <Shock t={t} /> : null}
      {t >= T.eye && t < T.cryEnd ? <Cry t={t} /> : null}
      {t >= T.joy && t < T.end ? <Joy t={t} /> : null}
      {t >= T.pals ? <Farewell t={t} /> : null}
      {t >= T.end ? <EndScene t={t} /> : null}
      <Pair t={t} p={p} a0={T.w1} b0={T.w2} plus0={T.plus} end={T.lit} a={['물', rMul, p.water]} b={['고기', rGogi, p.meat]} />
      <Title t={t} p={p} at={T.lit} end={T.shock} ko="물고기" read={rMulgogi} mean={p.litFish} />
      <Title t={t} p={p} at={T.fishT} end={T.eye} ko="물고기" read={rMulgogi} mean={p.fish} />
      <Pair t={t} p={p} a0={T.eyeL} b0={T.waterL} plus0={T.waterL + 0.3} end={T.whip2} a={['눈', rNun, p.eye]} b={['물', rMul, p.water]} />
      <Title t={t} p={p} at={T.cry} end={T.cryEnd} ko="눈물" read={rNunmul} mean={p.tears} strong />
      <Lunch t={t} p={p} />
      <Bye t={t} p={p} />
      <HookBand t={t} p={p} />
      <EndCard t={t} p={p} />
      <Sound />
    </AbsoluteFill>
  );
};
