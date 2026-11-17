// LAB E46 냉장고 메모 「케이크 먹지 마」 — 손글씨 POV(검증된 틀 E5 · E23 · E29 · E41)에 원본 Fpr5gks_sEU의 뼈대를 얹었다.
// 냉장고 문의 메모(룸메이트가 날려 쓴 한 줄)를 학습자가 한 글자씩 또박또박 옮겨 쓰며 읽는다. 「케이크」 = cake, 「먹지」 = eat까지 읽고 한입에 다 먹는다.
// 마지막 「마」를 쓰는 순간 = DON'T — 뜻이 뒤집힌다. 9.3초부터 날린 글씨와 교과서 꼴을 나란히 두고 머문다. 끝은 현관문 소리.
// 날린 글씨는 그림 엔진이 아니라 글꼴(나눔손글씨 펜)을 기울이고 겹쳐 그린다 — 글자가 틀릴 수 없게(장부 E46 「먼저 셋」 ⑵).
// 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { PEN } from '../lib/편서체';
import { handPath, Pt, ringPts } from './geo';
import { fr, T } from './timeline';

const C = {
  coral: '#F96859',
  brown: '#2B1A14',
  ink: '#202027', // 룸메이트의 검은 펜
  graphite: '#3A3A42', // 학습자의 연필
  red: '#D33A2C',
  label: '#FFFDF8',
};
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const prog = (f: number, [a, b]: readonly [number, number]) => interpolate(f, [fr(a), fr(b)], [0, 1], { ...clamp, easing: Easing.bezier(0.35, 0.05, 0.4, 1) });

// ── 메모(사진 속 빈 종이 — 1080×1920 기준 x 50~1031 · y 281~1000) ─────────────

// 룸메이트가 날려 쓴 줄 — 나눔손글씨 펜을 기울이고(skew) 좁히고(0.85) 글자끼리 겹치게, 글자마다 조금씩 돌고 들쭉날쭉.
const SCRIB = { y: 575, size: 214 };
const SCRIB_GLYPHS: { c: string; x: number; w: number }[] = [
  { c: '케', x: 176, w: 0.71 },
  { c: '이', x: 292, w: 0.501 },
  { c: '크', x: 371, w: 0.4 },
  { c: '먹', x: 486, w: 0.694 },
  { c: '지', x: 598, w: 0.57 },
  { c: '마', x: 738, w: 0.704 },
  { c: '!', x: 852, w: 0.274 },
];
const jit = (k: number, key: string, amp: number) => (random(`scrib-${key}-${k}`) - 0.5) * 2 * amp;
const scribPose = (k: number) => ({ rot: jit(k, 'r', 7) - 3, dy: jit(k, 'y', 16), sc: 1 + jit(k, 's', 0.09) });
// 한 낱말 안 글자끼리 잇는 꼬리(흘려 쓴 획) — 앞 글자 오른쪽 아래에서 다음 글자 왼쪽 가운데로
const TAILS: [number, number][] = [
  [0, 1],
  [1, 2],
  [3, 4],
];
const tailPath = ([a, b]: [number, number]) => {
  const A = SCRIB_GLYPHS[a], B = SCRIB_GLYPHS[b];
  const pa = scribPose(a), pb = scribPose(b);
  const x0 = A.x + A.w * SCRIB.size * 0.85 * 0.78, y0 = SCRIB.y + pa.dy - SCRIB.size * 0.16;
  const x1 = B.x + 10, y1 = SCRIB.y + pb.dy - SCRIB.size * 0.42;
  return handPath([[x0, y0], [lerp(x0, x1, 0.55), Math.max(y0, y1) + 14], [x1, y1]], { seed: `tail${a}`, jitter: 4 });
};

const Scribble: React.FC = () => (
  <g filter="url(#marker)">
    {SCRIB_GLYPHS.map((g, k) => {
      const p = scribPose(k);
      return (
        <text
          key={k}
          x={0}
          y={0}
          transform={`translate(${g.x} ${SCRIB.y + p.dy}) rotate(${p.rot}) skewX(-15) scale(${0.85 * p.sc} ${p.sc})`}
          fontFamily={PEN}
          fontSize={SCRIB.size}
          fill={C.ink}
          stroke={C.ink}
          strokeWidth={3.4}
          paintOrder="stroke"
          opacity={0.95}
        >
          {g.c}
        </text>
      );
    })}
    {TAILS.map((t, i) => (
      <path key={i} d={tailPath(t)} fill="none" stroke={C.ink} strokeWidth={7} strokeLinecap="round" opacity={0.92} />
    ))}
    {/* 끝에 휙 그은 밑줄 — 서두른 메모 */}
    <path d={handPath([[200, 640], [520, 652], [880, 628]], { seed: 'swoosh', jitter: 5 })} fill="none" stroke={C.ink} strokeWidth={6} strokeLinecap="round" opacity={0.85} />
  </g>
);

// 학습자가 또박또박 옮겨 쓰는 줄(교과서 꼴 — SUIT를 연필 결로)
const NEAT = { y: 812, size: 124 };
const NEAT_GLYPHS = [
  { c: '케', x: 118 },
  { c: '이', x: 232 },
  { c: '크', x: 347 },
  { c: '먹', x: 517 },
  { c: '지', x: 631 },
  { c: '마', x: 802 },
  { c: '!', x: 916 },
];
const neatW = (c: string) => (c === '!' ? 0.278 : 0.874) * NEAT.size;
const tipIn = (k: number, p: number): Pt => {
  const g = NEAT_GLYPHS[k];
  return [g.x + p * neatW(g.c) * 0.92, NEAT.y - NEAT.size * 0.4 + Math.sin(p * Math.PI * 3.4 + k * 1.3) * NEAT.size * 0.24];
};

const NeatLine: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  return (
    <g filter="url(#graphite)">
      {NEAT_GLYPHS.map((g, k) => {
        const p = interpolate(t, T.w[k], [0, 1], clamp);
        if (p <= 0) return null;
        const w = neatW(g.c);
        return (
          <g key={k}>
            <defs>
              <clipPath id={`n${k}`}>
                <rect x={g.x - 8} y={NEAT.y - NEAT.size * 1.05} width={p >= 1 ? w + 40 : p * w + 8} height={NEAT.size * 1.4} />
              </clipPath>
            </defs>
            <text x={g.x} y={NEAT.y} fontFamily={KO} fontWeight={600} fontSize={NEAT.size} fill={C.graphite} opacity={0.93} clipPath={`url(#n${k})`}>
              {g.c}
            </text>
          </g>
        );
      })}
    </g>
  );
};

// ── 빨간 펜 ───────────────────────────────────────────────────────
const Defs: React.FC = () => (
  <defs>
    <filter id="graphite" filterUnits="userSpaceOnUse" x="-200" y="-200" width="1480" height="2320">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="rough" />
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.36" result="grain" />
      <feComposite in="rough" in2="grain" operator="in" />
    </filter>
    <filter id="marker" filterUnits="userSpaceOnUse" x="-200" y="-200" width="1480" height="2320">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="11" result="wob" />
      <feDisplacementMap in="SourceGraphic" in2="wob" scale="9" xChannelSelector="R" yChannelSelector="G" result="w" />
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="4" result="n" />
      <feDisplacementMap in="w" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="redpen" filterUnits="userSpaceOnUse" x="-200" y="-200" width="1480" height="2320">
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="3" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
);

const RedHand: React.FC<{ text: string; cx: number; y: number; size: number; win: readonly [number, number]; w: number; id: string; rot?: number }> = ({ text, cx, y, size, win, w, id, rot = -4 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [fr(win[0]), fr(win[1])], [0, 1], { ...clamp, easing: Easing.bezier(0.3, 0.1, 0.5, 1) });
  if (p <= 0) return null;
  const x0 = cx - w / 2;
  return (
    <g transform={`rotate(${rot} ${cx} ${y})`}>
      <defs>
        <clipPath id={id}>
          <rect x={x0 - 20} y={y - size * 1.1} width={(w + 40) * p} height={size * 1.6} />
        </clipPath>
      </defs>
      <text x={cx} y={y} textAnchor="middle" fontFamily={PEN} fontSize={size} fill={C.red} filter="url(#redpen)" clipPath={`url(#${id})`}>
        {text}
      </text>
    </g>
  );
};
const RedStroke: React.FC<{ d: string; p: number; width?: number }> = ({ d, p, width = 10 }) => {
  if (p <= 0) return null;
  const len = 4000;
  return <path d={d} fill="none" stroke={C.red} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - Math.min(1, p))} filter="url(#redpen)" opacity={0.95} />;
};
const ellipse = (cx: number, cy: number, rx: number, ry: number, seed: string) => handPath(ringPts(cx, cy, 1, { sx: rx, sy: ry, n: 14, over: 0.1 }), { seed, jitter: 3 });

// DON'T! — 쾅 찍히는 빨간 글씨(반전)
const Dont: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < fr(T.dont)) return null;
  const sp = spring({ frame: f - fr(T.dont), fps, config: { damping: 11, stiffness: 300, mass: 0.6 } });
  // 장면 심사 v1 「작은 글씨를 다 읽어야 풀린다」 → 메모 오른쪽 아래를 크게 덮는 도장 글씨
  const cx = 846, y = 975;
  return (
    <g transform={`translate(${cx} ${y - 50}) scale(${1.7 - 0.7 * sp}) translate(${-cx} ${-(y - 50)})`} opacity={interpolate(sp, [0, 0.3], [0, 1], clamp)}>
      <text x={cx} y={y} textAnchor="middle" fontFamily={PEN} fontSize={158} fill={C.red} stroke={C.red} strokeWidth={2.5} paintOrder="stroke" filter="url(#redpen)" transform={`rotate(-7 ${cx} ${y})`}>
        DON&apos;T!
      </text>
    </g>
  );
};

// ── 연필 쥔 손(E41 손 사진 — 메모 줄을 따라 오른쪽으로 눕혀 접시를 가리지 않게) ─────
const HAND = { w: 1214, h: 1250, tipX: 4, tipY: 83, s: 0.8, rot: -22 };
const OFF: Pt = [1320, 1150];
const pencilAt = (t: number): { tip: Pt; down: number; show: boolean } => {
  const mv = (a: Pt, b: Pt, [s0, s1]: readonly [number, number]): Pt => {
    const p = interpolate(t, [s0, s1], [0, 1], { ...clamp, easing: EASE_IO });
    return [lerp(a[0], b[0], p), lerp(a[1], b[1], p)];
  };
  if (t < T.pencilIn[0]) return { tip: OFF, down: 0, show: false };
  if (t < T.w[0][0]) return { tip: mv(OFF, tipIn(0, 0), T.pencilIn), down: 0, show: true };
  for (let k = 0; k < T.w.length; k += 1) {
    const w = T.w[k];
    if (t < w[0]) {
      const pw = T.w[k - 1];
      const gap = w[0] - pw[1];
      // 긴 쉼(먹는 동안)에는 연필을 조금 들고 기다린다
      const rest: Pt = [tipIn(k - 1, 1)[0] + 30, NEAT.y - NEAT.size * 0.9];
      if (gap > 0.6) {
        if (t < pw[1] + 0.25) return { tip: mv(tipIn(k - 1, 1), rest, [pw[1], pw[1] + 0.25]), down: 0, show: true };
        if (t < w[0] - 0.3) return { tip: rest, down: 0, show: true };
        return { tip: mv(rest, tipIn(k, 0), [w[0] - 0.3, w[0]]), down: 0, show: true };
      }
      return { tip: mv(tipIn(k - 1, 1), tipIn(k, 0), [pw[1] + Math.min(0.04, gap * 0.2), w[0]]), down: 0, show: true };
    }
    if (t <= w[1]) return { tip: tipIn(k, interpolate(t, w, [0, 1], clamp)), down: 1, show: true };
  }
  // 「!」 뒤 — DON'T에 얼어붙었다가 천천히 빠진다
  const last = tipIn(T.w.length - 1, 1);
  if (t < T.pencilOut[0]) return { tip: last, down: 0, show: true };
  return { tip: mv(last, OFF, T.pencilOut), down: 0, show: t < T.pencilOut[1] };
};
const Pencil: React.FC = () => {
  const f = useCurrentFrame();
  const { tip, down, show } = pencilAt(f / 30);
  if (!show) return null;
  const lift = 1 - down;
  const s = HAND.s;
  const wob = down ? Math.sin(f * 0.9) * 0.8 : 0;
  return (
    <Img
      src={staticFile('img/hand.png')}
      style={{
        position: 'absolute',
        left: tip[0] - HAND.tipX * s,
        top: tip[1] - HAND.tipY * s,
        width: HAND.w * s,
        height: HAND.h * s,
        transformOrigin: `${HAND.tipX * s}px ${HAND.tipY * s}px`,
        transform: `rotate(${HAND.rot + wob}deg) scale(${1 + 0.03 * lift})`,
        filter: `drop-shadow(${10 + 16 * lift}px ${14 + 22 * lift}px ${12 + 10 * lift}px rgba(40,40,50,${0.24 - 0.08 * lift}))`,
      }}
    />
  );
};

// ── 위 글(사진 위 흰 이름표 — 원본의 흰 글 상자 꼴) ─────────────────────────
const Label: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 70, style }) => (
  <div
    style={{
      display: 'inline-block',
      background: C.label,
      color: C.brown,
      fontFamily: EN,
      fontWeight: 800,
      fontSize: size,
      lineHeight: 1.12,
      padding: '14px 30px 18px',
      borderRadius: 18,
      boxShadow: '0 6px 18px rgba(40,40,60,0.16)',
      textAlign: 'center',
      ...style,
    }}
  >
    {children}
  </div>
);
const HANGUL: React.CSSProperties = { fontFamily: KO, fontWeight: 800 };
const Titles: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const { fps } = useVideoConfig();
  const zone = (o: number, children: React.ReactNode, key: string) => (
    <div key={key} style={{ position: 'absolute', left: 40, width: 1000, top: 46, height: 196, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: o }}>
      {children}
    </div>
  );
  if (t < T.dont) {
    return zone(
      interpolate(t, [0, 0.12], [0.001, 1], clamp),
      <Label>
        POV: my Korean roommate
        <br />
        left me a note 📝
      </Label>,
      'a',
    );
  }
  if (t < T.hold) {
    const sp = spring({ frame: f - fr(T.dont), fps, config: { damping: 13, stiffness: 240, mass: 0.6 } });
    return zone(
      1,
      <Label size={96} style={{ transform: `scale(${0.8 + 0.2 * sp})` }}>
        <span style={HANGUL}>먹지 마</span> = <span style={{ color: C.red }}>DON&apos;T</span> eat!
      </Label>,
      'b',
    );
  }
  return zone(
    1,
    <Label size={78}>
      Could YOU read
      <br />
      this note? 👇
    </Label>,
    'c',
  );
};

// 나란히(9.3초~) 이름표 — 날린 글씨 = 실제 손글씨, 아래 줄 = 교과서 꼴
const Tag: React.FC<{ text: string; x: number; y: number; kind: 'real' | 'book' }> = ({ text, x, y, kind }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < fr(T.hold)) return null;
  const sp = spring({ frame: f - fr(T.hold), fps, config: { damping: 14, stiffness: 220, mass: 0.6 } });
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `rotate(-3deg) scale(${0.7 + 0.3 * sp})`,
        transformOrigin: 'left center',
        background: kind === 'real' ? C.coral : C.label,
        border: kind === 'book' ? `4px solid ${C.coral}` : 'none',
        color: C.brown,
        fontFamily: EN,
        fontWeight: 800,
        fontSize: 44,
        lineHeight: 1,
        padding: '10px 18px 12px',
        borderRadius: 14,
        boxShadow: '0 4px 10px rgba(80,30,20,0.18)',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};

// ── 카메라 ─────────────────────────────────────────────────────────
type Cam = [number, number, number, number]; // 초 · 배율 · 중심 x · 중심 y
const CAM: Cam[] = [
  // 첫 렌더 나란히(박자 9 · 컷 7)가 카메라가 움직인 자리마다 잡혀서, 카메라는 반전(7.05)과 나란히(9.3) 두 순간에만 움직인다.
  [0, 1.0, 540, 960],
  [T.dont - 0.02, 1.0, 540, 960],
  [T.dont + 0.16, 1.06, 540, 880], // 메모와 빈 접시가 한 화면에 남는 만큼만(장면 심사 v2)
  [T.hold - 0.02, 1.06, 540, 880],
  [T.hold + 0.16, 1.0, 540, 960],
  [T.total, 1.0, 540, 960],
];
const camAt = (t: number) => {
  const k = CAM.findIndex((c, i) => i === CAM.length - 1 || t < CAM[i + 1][0]);
  const a = CAM[k], b = CAM[Math.min(k + 1, CAM.length - 1)];
  const p = b[0] === a[0] ? 1 : interpolate(t, [a[0], b[0]], [0, 1], { ...clamp, easing: EASE_IO });
  return [1, 2, 3].map((j) => a[j] + (b[j] - a[j]) * p) as [number, number, number];
};

// 접시를 입으로 — 카메라는 그대로 두고 접시 든 손(사진 왼쪽 아래)만 입 쪽(위 · 앞)으로 들어 올려 두 입에 먹고 천천히 내려놓는다.
// 같은 사진을 왼쪽 아래 모서리를 축으로 부드러운 가림으로 떠서 움직인다 — 둘레는 무늬 없는 냉장고 문이라 가장자리가 안 보인다.
const liftAt = (t: number) => {
  if (t < T.biteIn[0] || t > T.biteOut[1]) return 0;
  if (t <= T.biteIn[1]) return interpolate(t, T.biteIn, [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  if (t < T.biteOut[0]) return 1;
  return interpolate(t, T.biteOut, [1, 0], { ...clamp, easing: EASE_IO });
};
const chompAt = (t: number) => Math.max(...[T.swap1, T.swap2].map((s) => (t >= s && t < s + 0.16 ? Math.sin((Math.PI * (t - s)) / 0.16) : 0)));
const PlateLift: React.FC<{ src: string }> = ({ src }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const l = liftAt(t);
  const ch = chompAt(t);
  // 문소리 뒤 — 접시 든 손만 움찔
  const tremble = interpolate(t, [T.door + 0.1, T.door + 0.3, T.door + 1.4], [0, 1, 0.25], clamp);
  // 왼쪽 아래 모서리(손목이 화면 밖으로 나가는 자리)를 축으로 돌고 커지기만 한다 — 옮기면 손목 밑에 빈 냉장고 띠가 드러난다
  const rot = Math.sin(f * 2.3) * 0.8 * tremble;
  if (l <= 0 && tremble <= 0) return null;
  const sc = 1 + 0.26 * l + 0.03 * ch;
  // 접시 자리(메모 아래 · 왼쪽 60%)만 떠낸다 — 위는 y 1040~1110, 오른쪽은 x 700~800에서 부드럽게 사라진다
  const MASK = 'linear-gradient(to bottom, transparent 1040px, #000 1110px), linear-gradient(to right, #000 700px, transparent 800px)';
  const masked: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, WebkitMaskImage: MASK, maskImage: MASK, WebkitMaskComposite: 'source-in', maskComposite: 'intersect' };
  return (
    <>
      {/* 들어 올린 접시 밑 — 접시를 지운 같은 냉장고 문(판/빈냉장고를 첫 장에 맞춤) */}
      <Img src={staticFile('img/fridge_empty.jpg')} style={masked} />
      <Img
        src={staticFile(src)}
        style={{
          ...masked,
          transformOrigin: '0px 1920px',
          transform: `rotate(${rot}deg) scale(${sc})`,
          filter: l > 0 ? `drop-shadow(0 ${18 * l}px ${24 * l}px rgba(30,30,45,${0.18 * l}))` : undefined,
        }}
      />
    </>
  );
};

// ── 소리 ─────────────────────────────────────────────────────────
const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at: t, vol = 1 }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; at: number; vol: number; from?: number; dur?: number }> = ({ file, at: t, vol, from = 0, dur }) => (
  <Sequence from={fr(t)} durationInFrames={dur ? Math.max(1, fr(dur)) : undefined} layout="none">
    <Audio
      src={staticFile(`sfx/${file}`)}
      startFrom={fr(from)}
      volume={(i) => {
        if (!dur) return vol * MASTER;
        const n = Math.max(1, fr(dur));
        const b = Math.min(2, n * 0.25);
        return vol * MASTER * interpolate(i, [0, b, Math.max(b + 0.5, n - 4), Math.max(b + 1, n)], [0, 1, 1, 0], clamp);
      }}
    />
  </Sequence>
);

const Sound: React.FC<{ scene?: boolean }> = ({ scene }) => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.34 * MASTER * interpolate(i, [fr(T.total) - 24, fr(T.total)], [1, 0], clamp)} />
    {scene ? null : (
      <>
        <Vo id="e0" at={T.e0} />
        <Vo id="e1" at={T.e1} />
        <Vo id="e2" at={T.e2} />
        <Vo id="k3" at={T.k3} />
        <Vo id="e3" at={T.e3} />
        <Vo id="e4" at={T.e4} />
      </>
    )}
    {T.w.map(([a, b], k) => (
      <Sfx key={k} file={k % 2 ? 'pencil_b.wav' : 'pencil_a.wav'} at={a} from={[0.6, 2.4, 1.5, 3.1, 0.2, 4.2, 1.0][k]} dur={b - a} vol={0.55} />
    ))}
    <Sfx file="pencil_b.wav" at={T.cake[0]} from={1.2} dur={T.cake[1] - T.cake[0]} vol={0.35} />
    <Sfx file="pencil_a.wav" at={T.eat[0]} from={2.6} dur={T.eat[1] - T.eat[0]} vol={0.35} />
    <Sfx file="munch.wav" at={T.swap1 - 0.05} dur={0.42} vol={0.8} />
    <Sfx file="munch.wav" at={T.swap2 - 0.05} from={0.3} dur={0.5} vol={0.8} />
    <Sfx file="gulp.wav" at={T.biteOut[0] + 0.1} vol={0.6} />
    <Sfx file="stamp.wav" at={T.dont} vol={0.6} />
    <Sfx file="thud.wav" at={T.dont + 0.02} vol={0.5} />
    <Sfx file="pencil_b.wav" at={T.ringNeat[0]} from={0.9} dur={T.ringNeat[1] - T.ringNeat[0]} vol={0.4} />
    <Sfx file="pencil_a.wav" at={T.ringScrib[0]} from={1.8} dur={T.ringScrib[1] - T.ringScrib[0]} vol={0.4} />
    <Sfx file="pop.wav" at={T.hold} vol={0.32} />
    <Sfx file="tok.wav" at={T.hold + 0.14} vol={0.3} />
    <Sfx file="door_open.wav" at={T.door} vol={0.8} />
  </>
);

export const Film: React.FC<{ plain?: boolean; scene?: boolean }> = ({ plain = false, scene = false }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const [cs, cx, cy] = camAt(t);
  const cam = `translate(${540 - cx * cs}px, ${960 - cy * cs}px) scale(${cs})`;
  const stage = t >= T.swap2 ? 2 : t >= T.swap1 ? 1 : 0;
  const neatMa = { x: 802 + 54, y: NEAT.y - 44 };
  const scribMa = { x: 738 + 70, y: SCRIB.y - 70 };
  return (
    <AbsoluteFill style={{ backgroundColor: '#E8E8EC' }}>
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: cam }}>
        <Img src={staticFile(`img/fridge${stage}.jpg`)} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
        <PlateLift src={`img/fridge${stage}.jpg`} />
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <Defs />
          <Scribble />
          <NeatLine />
          <RedHand text="cake" cx={288} y={934} size={112} win={T.cake} w={230} id="g-cake" />
          <RedHand text="eat" cx={600} y={934} size={112} win={T.eat} w={170} id="g-eat" />
          <Dont />
          <RedStroke d={ellipse(neatMa.x, neatMa.y, 78, 74, 'ringN')} p={prog(f, T.ringNeat)} width={9} />
          <RedStroke d={ellipse(scribMa.x, scribMa.y, 96, 96, 'ringS')} p={prog(f, T.ringScrib)} width={9} />
          <RedStroke d={handPath([[scribMa.x - 92, SCRIB.y + 34], [scribMa.x + 10, SCRIB.y + 44], [scribMa.x + 120, SCRIB.y + 30]], { seed: 'ulS', jitter: 3 })} p={prog(f, T.underline)} width={10} />
        </svg>
        <Pencil />
        {plain ? null : (
          <>
            <Tag text="real Korean handwriting" x={70} y={318} kind="real" />
            <Tag text="textbook" x={70} y={640} kind="book" />
          </>
        )}
        {/* 부엌 빛 · 가장자리 그늘 — 사진처럼 깊이 */}
        <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse 90% 75% at 46% 45%, rgba(0,0,0,0) 60%, rgba(30,30,45,0.22) 100%)', mixBlendMode: 'multiply' }} />
      </AbsoluteFill>
      {plain ? null : <Titles />}
      <Sound scene={scene} />
    </AbsoluteFill>
  );
};
