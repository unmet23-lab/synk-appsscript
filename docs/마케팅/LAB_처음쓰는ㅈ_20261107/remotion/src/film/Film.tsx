// LAB E29 「처음 쓰는 ㅈ」 — 공책 위 손글씨 POV(원본 E5 「처음 쓰는 ㄹ」 1:1, E23 「처음 쓰는 ㅍ」 코드를 고쳐 씀). 전부 useCurrentFrame()으로만 움직인다.
// 첫 장: Z(✗) → 천천히 쓴 ㅈ(✓) → 빨리 쓴 ㅈ이 ス 꼴 → 「Japanese?!」 연필로 X. 쪽 넘김 뒤: 한국 친구 쪽지의 ㅈ이 같은 꼴 → 지우개 → ✓, 두 꼴 다 맞다, Z만 아니다.
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths';
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO, PEN } from '../lib/fonts';
import { handPath, inBox, Pt } from './geo';
import { LOCALES, Loc, LocText } from './locale';
import { fr, T } from './timeline';

const LocCtx = React.createContext<LocText>(LOCALES.en);
const PlainCtx = React.createContext(false);
const useLoc = () => React.useContext(LocCtx);

const C = {
  coral: '#F96859',
  coralShade: '#AE322A',
  brown: '#2B1A14',
  graphite: '#34343A',
  grid: '#EF9488',
  red: '#D33A2C',
  ink: '#263352',
  note: '#FFE27A',
  noteEdge: '#F2C94C',
};
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);

// 쪽(배경 사진 안 오른쪽 쪽) — notebook.jpg 1080×1920 기준
const PAGE = { x: 56, y: 132, w: 982, h: 1621 };

// 첫 장: 2×2 칸
const S = 396;
type Box = { x: number; y: number; s: number };
const BOX: Box[] = [
  { x: 102, y: 575, s: S },
  { x: 522, y: 575, s: S },
  { x: 102, y: 995, s: S },
  { x: 522, y: 995, s: S },
];

// ── 획 ─────────────────────────────────────────────────────────────
// 시도 셋 — Z(위 가로 → 대각선 → 아래 가로, 한 번에) · 천천히 쓴 ㅈ(위 가로 · 왼쪽 다리 · 오른쪽 다리) · 빨리 쓴 ㅈ(위 가로가 꺾여 왼쪽 다리로 — ス 꼴, 오른쪽 다리)
const ATTS: string[][] = [
  [handPath(inBox(BOX[1], [[0.2, 0.29], [0.8, 0.28], [0.21, 0.75], [0.83, 0.74]]), { sharp: true, seed: 'z1', jitter: 4 })],
  [
    handPath(inBox(BOX[2], [[0.2, 0.3], [0.8, 0.3]]), { sharp: true, seed: 'j1', jitter: 3 }),
    handPath(inBox(BOX[2], [[0.5, 0.31], [0.46, 0.47], [0.36, 0.63], [0.2, 0.77]]), { seed: 'j2', jitter: 2 }),
    handPath(inBox(BOX[2], [[0.47, 0.45], [0.58, 0.58], [0.69, 0.68], [0.82, 0.77]]), { seed: 'j3', jitter: 2 }),
  ],
  [
    handPath(inBox(BOX[3], [[0.22, 0.31], [0.74, 0.27], [0.55, 0.47], [0.36, 0.64], [0.2, 0.78]]), { sharp: true, seed: 's1', jitter: 3 }),
    handPath(inBox(BOX[3], [[0.5, 0.52], [0.6, 0.62], [0.71, 0.71], [0.84, 0.79]]), { seed: 's2', jitter: 2 }),
  ],
];
// 배우는 사람이 ス 꼴을 틀렸다고 생각해 연필로 X
const CROSS: string[] = [
  handPath(inBox(BOX[3], [[0.12, 0.14], [0.88, 0.88]]), { sharp: true, seed: 'x1', jitter: 5 }),
  handPath(inBox(BOX[3], [[0.87, 0.13], [0.13, 0.87]]), { sharp: true, seed: 'x2', jitter: 5 }),
];

// 둘째 장: 큰 칸에 다시 써도 ス 꼴 → 또 X(장면 심사 v1 「써지는 과정 없음 · 화면이 빔」)
// 장면 심사 v3: 「칸이 왼쪽 끝에서 잘리고 쪽지가 단추 자리에 닿고 위 절반이 빔」 → 칸 · 쪽지를 안쪽 · 위로
const BIG2: Box = { x: 92, y: 680, s: 440 };
const HAND2: string[] = [
  handPath(inBox(BIG2, [[0.2, 0.3], [0.75, 0.26], [0.56, 0.46], [0.37, 0.63], [0.19, 0.78]]), { sharp: true, seed: 'h1', jitter: 3 }),
  handPath(inBox(BIG2, [[0.5, 0.51], [0.61, 0.62], [0.72, 0.71], [0.85, 0.79]]), { seed: 'h2', jitter: 2 }),
];
// 북북 낙서 — 글자와 다른 가늘고 진한 지그재그(장면 심사 v2 「X가 글자와 같은 굵기 · 색이라 이상한 글자 하나로 읽힘」)
const scribble = (seed: string, from: Pt, to: Pt, n: number, amp: number): Pt[] => {
  const [ax, ay] = from, [bx, by] = to;
  const L = Math.hypot(bx - ax, by - ay);
  const nx = -(by - ay) / L, ny = (bx - ax) / L;
  return Array.from({ length: n + 1 }, (_, k) => {
    const p = k / n;
    const side = (k % 2 ? 1 : -1) * amp * (0.75 + 0.5 * random(`${seed}${k}`));
    return [ax + (bx - ax) * p + nx * side, ay + (by - ay) * p + ny * side] as Pt;
  });
};
const CROSS2: string[] = [
  handPath(inBox(BIG2, scribble('sa', [0.14, 0.2], [0.86, 0.8], 11, 0.2)), { sharp: true, seed: 'y1', jitter: 4 }),
  handPath(inBox(BIG2, scribble('sb', [0.84, 0.74], [0.18, 0.3], 9, 0.17)), { sharp: true, seed: 'y2', jitter: 4 }),
];

const LEN = new Map<string, number>();
const len = (d: string) => {
  if (!LEN.has(d)) LEN.set(d, getLength(d));
  return LEN.get(d)!;
};
const at = (d: string, p: number): Pt => {
  const q = getPointAtLength(d, len(d) * Math.min(1, Math.max(0, p)));
  return q ? [q.x, q.y] : [0, 0];
};
const startOf = (d: string) => at(d, 0);
const endOf = (d: string) => at(d, 1);

// 시도 하나의 시간 [a,b]를 획 길이대로 나눈다 — 획 사이 펜을 드는 틈
const LIFT = 0.1;
const subWins = (paths: string[], [a, b]: readonly [number, number], lift = LIFT): [number, number][] => {
  const L = paths.reduce((acc, d) => acc + len(d), 0);
  const avail = b - a - lift * (paths.length - 1);
  let t = a;
  return paths.map((d) => {
    const w: [number, number] = [t, t + (avail * len(d)) / L];
    t = w[1] + lift;
    return w;
  });
};
const ATT_T = [T.att1, T.att2, T.att3];
const DRAWS: [string, [number, number]][] = ATTS.flatMap((paths, i) => {
  // 천천히 쓴 ㅈ은 획 사이를 더 오래 든다(조심스럽게), 빨리 쓴 ㅈ은 거의 안 든다
  const ws = subWins(paths, ATT_T[i], i === 1 ? 0.16 : i === 2 ? 0.05 : LIFT);
  return paths.map((d, k) => [d, ws[k]] as [string, [number, number]]);
});
const CROSS_W = subWins(CROSS, T.cross, 0.06);
const ALL_DRAWS: [string, [number, number]][] = [...DRAWS, ...CROSS.map((d, k) => [d, CROSS_W[k]] as [string, [number, number]])];
const HAND2_W = subWins(HAND2, T.write2, 0.05);
const CROSS2_W = subWins(CROSS2, T.cross2, 0.06);
const P2_DRAWS: [string, [number, number]][] = [
  ...HAND2.map((d, k) => [d, HAND2_W[k]] as [string, [number, number]]),
  ...CROSS2.map((d, k) => [d, CROSS2_W[k]] as [string, [number, number]]),
];

/** 초 구간 [a,b]에서 0→1(획 긋는 속도: 처음과 끝만 조금 느리게). */
const prog = (f: number, [a, b]: readonly [number, number]) => interpolate(f, [fr(a), fr(b)], [0, 1], { ...clamp, easing: Easing.bezier(0.35, 0.05, 0.4, 1) });

// ── 연필 자국 ──────────────────────────────────────────────────────
const PencilDefs: React.FC = () => (
  <defs>
    <filter id="graphite" filterUnits="userSpaceOnUse" x="-200" y="-200" width="1480" height="2320">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="rough" />
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.36" result="grain" />
      <feComposite in="rough" in2="grain" operator="in" />
    </filter>
    <filter id="redpen" filterUnits="userSpaceOnUse" x="-200" y="-200" width="1480" height="2320">
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="3" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="inkpen" filterUnits="userSpaceOnUse" x="-200" y="-200" width="1480" height="2320">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
);

const Stroke: React.FC<{ d: string; p: number; width: number; color?: string; opacity?: number; filter?: string }> = ({ d, p, width, color = C.graphite, opacity = 0.92, filter = 'url(#graphite)' }) => {
  if (p <= 0) return null;
  const ev = evolvePath(p, d);
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={ev.strokeDasharray}
      strokeDashoffset={ev.strokeDashoffset}
      opacity={opacity}
      filter={filter}
    />
  );
};

// ── 칸(깍두기 공책 칸) ──────────────────────────────────────────────
const GridBox: React.FC<{ box: Box; w?: number }> = ({ box, w = 3 }) => (
  <g>
    <rect x={box.x} y={box.y} width={box.s} height={box.s} fill="none" stroke={C.grid} strokeWidth={w} opacity={0.75} />
    <line x1={box.x + box.s / 2} y1={box.y + 8} x2={box.x + box.s / 2} y2={box.y + box.s - 8} stroke={C.grid} strokeWidth={2} strokeDasharray="10 12" opacity={0.45} />
    <line x1={box.x + 8} y1={box.y + box.s / 2} x2={box.x + box.s - 8} y2={box.y + box.s / 2} stroke={C.grid} strokeWidth={2} strokeDasharray="10 12" opacity={0.45} />
  </g>
);

// ── 이름표(「a Z?」) ────────────────────────────────────────────────
const Tag: React.FC<{ text: string; at: number; box: Box; plain?: boolean; good?: boolean }> = ({ text, at: t, box, plain, good }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLoc();
  const sp = t <= 0 ? 1 : spring({ frame: f - fr(t), fps, config: { damping: 13, stiffness: 190, mass: 0.7 } });
  if (f < fr(t)) return null;
  return (
    <div
      style={{
        position: 'absolute',
        right: 1080 - (box.x + box.s) + 10,
        bottom: 1920 - (box.y + box.s) - 30,
        transform: `rotate(-5deg) scale(${0.6 + 0.4 * sp})`,
        transformOrigin: 'right bottom',
        opacity: interpolate(sp, [0, 0.4], [0, 1], clamp),
        background: plain ? '#FFFDF8' : good ? '#FFFDF8' : C.coral,
        color: good ? C.red : C.brown,
        border: plain ? `4px solid ${C.coral}` : good ? `4px solid ${C.red}` : 'none',
        fontFamily: EN,
        fontWeight: 800,
        fontSize: plain ? L.size.tagPlain : L.size.tag,
        lineHeight: 1,
        padding: plain || good ? '10px 18px 12px' : '14px 22px 16px',
        borderRadius: 18,
        boxShadow: '0 6px 14px rgba(80,30,20,0.18)',
      }}
    >
      {text.split('ス').flatMap((part, i) => (i ? [<span key={i} style={{ fontFamily: "'Yu Gothic', 'Meiryo', 'MS Gothic', sans-serif", fontWeight: 700, fontSize: '1.15em' }}>ス</span>, part] : [part]))}
    </div>
  );
};

// ── 연필 ──────────────────────────────────────────────────────────
const PENCIL_SCALE = 0.5; // 1072×1061 원본, 촉이 (3,3)
const OFF: Pt = [1180, 2050]; // 화면 오른쪽 아래 밖
const usePencil = (f: number): { tip: Pt; down: number; show: boolean } => {
  const t = f / 30;
  const lerp = (a: Pt, b: Pt, p: number): Pt => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
  const move = (a: Pt, b: Pt, [s0, s1]: readonly [number, number]) => lerp(a, b, interpolate(t, [s0, s1], [0, 1], { ...clamp, easing: EASE_IO }));
  if (t >= T.pencilIn3[0]) {
    // 끝: 다시 들어와 아래 Z를 북북 지우고 나감(볼 이유 v2)
    if (t < T.zScrib[0]) return { tip: move(OFF, startOf(ZSCRIB), T.pencilIn3), down: 0, show: true };
    if (t <= T.zScrib[1]) return { tip: at(ZSCRIB, prog(f, T.zScrib)), down: 1, show: true };
    return { tip: move(endOf(ZSCRIB), OFF, T.pencilOut3), down: 0, show: t < T.pencilOut3[1] };
  }
  if (t >= T.pencilIn2[0]) {
    // 둘째 장: 들어와서 큰 ス 꼴 → X → 나감
    if (t < P2_DRAWS[0][1][0]) return { tip: move(OFF, startOf(P2_DRAWS[0][0]), T.pencilIn2), down: 0, show: true };
    for (let i = 0; i < P2_DRAWS.length; i += 1) {
      const [d, w] = P2_DRAWS[i];
      if (t <= w[1]) {
        if (t >= w[0]) return { tip: at(d, prog(f, w)), down: 1, show: true };
        const prev = P2_DRAWS[i - 1];
        return { tip: move(endOf(prev[0]), startOf(d), [prev[1][1] + Math.min(0.06, (w[0] - prev[1][1]) * 0.2), w[0]]), down: 0, show: true };
      }
    }
    return { tip: move(endOf(P2_DRAWS[P2_DRAWS.length - 1][0]), OFF, T.pencilOut2), down: 0, show: t < T.pencilOut2[1] };
  }
  for (let i = 0; i < ALL_DRAWS.length; i += 1) {
    const [d, w] = ALL_DRAWS[i];
    if (t <= w[1]) {
      if (t >= w[0]) return { tip: at(d, prog(f, w)), down: 1, show: true };
      const prev = ALL_DRAWS[i - 1];
      return { tip: move(endOf(prev[0]), startOf(d), [prev[1][1] + Math.min(0.08, (w[0] - prev[1][1]) * 0.2), w[0]]), down: 0, show: true };
    }
  }
  return { tip: move(endOf(ALL_DRAWS[ALL_DRAWS.length - 1][0]), OFF, T.pencilOut), down: 0, show: t < T.pencilOut[1] };
};

const Pencil: React.FC = () => {
  const f = useCurrentFrame();
  const { tip, down, show } = usePencil(f);
  const lift = interpolate(down, [0, 1], [1, 0]);
  const wob = down ? Math.sin(f * 1.7) * 1.2 : 0;
  if (!show) return null;
  return (
    <Img
      src={staticFile('img/pencil.png')}
      style={{
        position: 'absolute',
        left: tip[0] - 3 * PENCIL_SCALE,
        top: tip[1] - 3 * PENCIL_SCALE,
        width: 1072 * PENCIL_SCALE,
        height: 1061 * PENCIL_SCALE,
        transformOrigin: '0 0',
        transform: `rotate(${wob}deg) scale(${1 + 0.035 * lift})`,
        filter: `drop-shadow(${6 + 14 * lift}px ${9 + 20 * lift}px ${5 + 6 * lift}px rgba(40,25,10,${0.3 - 0.1 * lift}))`,
      }}
    />
  );
};

// ── 위 글(제목) ───────────────────────────────────────────────────
const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at: t, children, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: f - fr(t), fps, config: { damping: 16, stiffness: 170, mass: 0.7 } });
  if (f < fr(t)) return null;
  return (
    <span style={{ display: 'inline-block', opacity: interpolate(sp, [0, 0.5], [0, 1], clamp), transform: `translateY(${(1 - sp) * 26}px)`, filter: `blur(${(1 - sp) * 8}px)`, ...style }}>
      {children}
    </span>
  );
};

// 말 판(목소리 없는 판) — 뜨는 순간부터 또렷하게(이해 시험 v1: 뜨는 중의 흐림이 「못 읽음」으로 찍혔다)
const Say: React.FC<{ at: number; children: React.ReactNode }> = ({ at: t, children }) => {
  const f = useCurrentFrame();
  if (f < fr(t)) return null;
  return <span style={{ display: 'inline-block', opacity: interpolate(f - fr(t), [0, 2], [0.6, 1], clamp) }}>{children}</span>;
};

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ display: 'inline-block', background: C.coral, color: C.brown, fontFamily: EN, fontWeight: 800, fontSize: useLoc().size.kicker, lineHeight: 1.1, padding: '8px 18px 10px', borderRadius: 14, marginRight: 16, verticalAlign: 'middle', transform: 'translateY(-8px)', letterSpacing: 0 }}>{children}</span>
);

const TitleZone: React.FC<{ children: React.ReactNode; opacity?: number; top?: number; height?: number }> = ({ children, opacity = 1, top = 300, height = 300 }) => (
  <div style={{ position: 'absolute', left: 100, width: 820, top, height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity }}>
    {children}
  </div>
);

const BIG_TXT: React.CSSProperties = { fontFamily: EN, fontWeight: 800, fontSize: 84, lineHeight: 1.06, color: C.brown, letterSpacing: -1 };
const HANGUL_IN_EN: React.CSSProperties = { fontFamily: KO, fontWeight: 800, fontSize: '1.18em', lineHeight: 0.9 };
// 판 글 속 「ㅈ」만 한글 서체로, 「\n」은 줄바꿈
const withHangul = (s: string) =>
  s.split('\n').flatMap((line, n) => [
    ...(n ? [<br key={`b${n}`} />] : []),
    ...line.split('ㅈ').flatMap((part, i) => (i ? [<span key={`h${n}-${i}`} style={HANGUL_IN_EN}>ㅈ</span>, part] : [part])),
  ]);

const Titles: React.FC = () => {
  const L = useLoc();
  const big: React.CSSProperties = { ...BIG_TXT, fontSize: L.size.big, lineHeight: L.size.lineHeight, letterSpacing: L.voice ? -1 : 0 };
  const f = useCurrentFrame();
  const t = f / 30;
  const fade = (a: number, b: number) => interpolate(t, [a, a + 0.12, b - 0.12, b], [0, 1, 1, 0], clamp);
  // 목소리 없는 판(두 채널): 영어 목소리의 말을 제목 자리 둘째 줄 말 판으로(E23 「ㅍ」 두 채널 판과 같은 꼴)
  const mute = !L.voice && !!L.says;
  const saysStyle: React.CSSProperties = { display: 'inline-block', background: '#FFF8EC', border: `4px solid ${C.coral}`, borderRadius: 20, padding: '8px 22px 10px', fontFamily: EN, fontWeight: 800, fontSize: L.size.says, lineHeight: 1.3, color: C.brown, marginTop: 16 };
  if (t < T.flip[0] + 0.1) {
    const out = interpolate(t, [T.flip[0] - 0.1, T.flip[0] + 0.1], [1, 0], clamp);
    const says = mute ? (t >= T.a3 ? L.says!.a3 : t >= T.a2 ? L.says!.a2 : t >= T.a1 ? L.says!.a1 : null) : null;
    // 셋째 이름표 펀치 인(1.2배) 동안 제목은 걷고 말 판만 남긴다 — 제목이 위 안전선을 넘지 않게
    if (mute && t >= T.tag3 - 0.05) {
      return (
        <TitleZone top={400} height={170} opacity={out}>
          <Say at={T.a3}><span style={{ ...saysStyle, marginTop: 0 }}>{L.says!.a3}</span></Say>
        </TitleZone>
      );
    }
    return (
      <TitleZone top={mute ? 340 : 310} height={mute ? 230 : 260} opacity={mute ? out : Math.min(out, interpolate(t, [T.tag3 - 0.05, T.tag3 + 0.12], [1, 0], clamp))}>
        <div style={big}>
          {L.title.map((line, i) => (
            <React.Fragment key={i}>
              {i ? <br /> : L.kicker ? <Kicker>{L.kicker}</Kicker> : null}
              {withHangul(line)}
            </React.Fragment>
          ))}
        </div>
        {says ? (
          <Say at={t >= T.a3 ? T.a3 : t >= T.a2 ? T.a2 : T.a1}><span style={saysStyle}>{says}</span></Say>
        ) : (
          <div style={{ fontFamily: EN, fontWeight: L.voice ? 600 : 800, fontSize: L.size.sub, lineHeight: L.voice ? undefined : 1.4, color: C.coralShade, marginTop: 14 }}>{L.sub}</div>
        )}
      </TitleZone>
    );
  }
  if (t < T.noteIn[0]) {
    if (!mute || t < T.r1) return null;
    const r3 = t >= T.r3;
    return (
      <TitleZone opacity={fade(T.r1, T.noteIn[0])}>
        <Say at={r3 ? T.r3 : T.r1}><span style={{ ...saysStyle, marginTop: 0, fontSize: L.size.says * 1.12 }}>{r3 ? L.says!.r3 : L.says!.r1}</span></Say>
      </TitleZone>
    );
  }
  if (t < T.check[0]) {
    return (
      <TitleZone opacity={fade(T.noteIn[0], T.check[0])}>
        <div style={{ ...big, fontSize: L.size.note }}>
          {L.voice ? <Pop at={T.noteIn[0] + 0.05}>{withHangul(L.note[0])}</Pop> : <Say at={T.noteIn[0] + 0.05}>{withHangul(L.note[0])}</Say>}
          <br />
          {L.voice ? <Pop at={T.noteIn[1] + 0.25} style={{ color: C.coralShade, fontSize: L.size.noteSub }}>{withHangul(L.note[1])}</Pop> : <Say at={T.noteIn[1] + 0.25}><span style={{ color: C.coralShade, fontSize: L.size.noteSub }}>{withHangul(L.note[1])}</span></Say>}
        </div>
      </TitleZone>
    );
  }
  if (t < T.arrange[0]) {
    return (
      <TitleZone opacity={fade(T.check[0], T.arrange[0])}>
        <div style={{ ...big, fontSize: L.size.same, color: C.red }}>
          {L.voice ? <Pop at={T.check[0]}>{withHangul(L.same)}</Pop> : <Say at={T.check[0]}>{withHangul(L.same)}</Say>}
        </div>
        {mute ? <Say at={T.s2}><span style={saysStyle}>{L.says!.s2}</span></Say> : null}
      </TitleZone>
    );
  }
  // 끝은 따로 정리 카드를 띄우지 않는다(이해 시험 v1 haiku 9번 「끝 요약 카드가 지난 편과 같아 보임」) — 「2 ways」 제목은 끝까지 두고, 끝 말은 빨간 펜 손글씨로 쪽 위에
  return (
    <TitleZone opacity={interpolate(t, [T.arrange[0], T.arrange[0] + 0.12], [0, 1], clamp)}>
      <div style={{ ...big, fontSize: L.size.two }}>
        <Pop at={T.arrange[0] + 0.05}>{withHangul(L.two)}</Pop>
      </div>
    </TitleZone>
  );
};

// 끝 — 두 꼴 아래 빨간 펜 손글씨 「both right!」(왼쪽부터 써지듯 드러난다)
const HandNote: React.FC = () => {
  const L = useLoc();
  const f = useCurrentFrame();
  const p = interpolate(f, [fr(T.hand[0]), fr(T.hand[1])], [0, 1], { ...clamp, easing: Easing.bezier(0.3, 0.1, 0.5, 1) });
  if (p <= 0) return null;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <clipPath id="handWipe">
          <rect x={150} y={1265} width={800 * p} height={170} />
        </clipPath>
      </defs>
      {/* 올리기 전 검사: 아래 끝 1448px(안전선 1428) → 26px 올리고 조금 작게 */}
      <g clipPath="url(#handWipe)" transform="rotate(-3 540 1350)">
        <text x={540} y={L.handFont ? 1378 : 1352} textAnchor="middle" dominantBaseline="central" fontFamily={L.handFont ?? PEN} fontWeight={L.handFont ? 800 : undefined} fontSize={L.size.end * (L.handFont ? 1 : 1.12)} fill={C.red} filter="url(#redpen)">
          {L.end[0]}
        </text>
      </g>
    </svg>
  );
};

// ── 첫 장 ─────────────────────────────────────────────────────────
const PageOne: React.FC = () => {
  const L = useLoc();
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <PencilDefs />
        {BOX.map((b, i) => (
          <GridBox key={i} box={b} />
        ))}
        <text x={BOX[0].x + S / 2} y={BOX[0].y + S * 0.5} textAnchor="middle" dominantBaseline="central" fontFamily="SUIT" fontWeight={500} fontSize={S * 0.74} fill="#3C3230" opacity={0.26}>
          ㅈ
        </text>
        {DRAWS.map(([d, w], i) => (
          <Stroke key={i} d={d} p={prog(f, w)} width={19} />
        ))}
        {CROSS.map((d, i) => (
          <Stroke key={`x${i}`} d={d} p={prog(f, CROSS_W[i])} width={11} opacity={0.85} />
        ))}
      </svg>
      {React.useContext(PlainCtx) ? null : <>
      {f < fr(T.tag3 - 0.1) ? <Tag text={L.tags.copy} at={-1} box={BOX[0]} plain /> : null}
      <Tag text={L.tags.a1} at={T.tag1} box={BOX[1]} />
      <Tag text={L.tags.a2} at={T.tag2} box={BOX[2]} good />
      <Tag text={L.tags.a3} at={T.tag3} box={BOX[3]} />
      </>}
    </AbsoluteFill>
  );
};

// ── 둘째 장 ───────────────────────────────────────────────────────
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** 첫 장 칸 하나의 연필 자국을 (cx, cy) 중심 · sc 배율로 다시 그린다(칸 테두리 · 깍두기 선 포함). */
const Card: React.FC<{ k: 0 | 1 | 2; cx: number; cy: number; sc: number; rot?: number; opacity?: number; cross?: number; children?: React.ReactNode }> = ({ k, cx, cy, sc, rot = 0, opacity = 1, cross = 0, children }) => {
  const box = BOX[k + 1];
  const tx = cx - (box.x + box.s / 2) * sc;
  const ty = cy - (box.y + box.s / 2) * sc;
  return (
    <g opacity={opacity} transform={`rotate(${rot} ${cx} ${cy})`}>
      <rect x={cx - (box.s * sc) / 2} y={cy - (box.s * sc) / 2} width={box.s * sc} height={box.s * sc} fill="#FFFDF6" opacity={0.55} />
      <g transform={`translate(${tx} ${ty}) scale(${sc})`}>
        <GridBox box={box} />
        {ATTS[k].map((d, i) => <path key={i} d={d} fill="none" stroke={C.graphite} strokeWidth={19} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} filter="url(#graphite)" />)}
        {k === 2 && cross > 0 ? CROSS.map((d, i) => <path key={`x${i}`} d={d} fill="none" stroke={C.graphite} strokeWidth={11} strokeLinecap="round" opacity={0.85 * cross} filter="url(#graphite)" />) : null}
      </g>
      {children}
    </g>
  );
};

const checkPath = (cx: number, cy: number, w: number) => `M ${cx - 0.3 * w} ${cy + 0.02 * w} L ${cx - 0.08 * w} ${cy + 0.25 * w} L ${cx + 0.34 * w} ${cy - 0.3 * w}`;
// 칸 오른쪽 아래 모서리에 걸친 ✓ — 글자를 덮지 않게(첫 판은 ✓가 글자 위에 얹혀 지운 것처럼 보였다)
const cornerCheck = (cx: number, cy: number, w: number) => checkPath(cx + 0.42 * w, cy + 0.36 * w, w * 0.55);

const RedMark: React.FC<{ d: string; p: number; width?: number }> = ({ d, p, width = 16 }) => (p <= 0 ? null : <Stroke d={d} p={p} width={width} color={C.red} opacity={0.95} filter="url(#redpen)" />);

// 한국 친구가 내 공책에 파란 펜으로 바로 쓴 「잘했어!」(나눔손글씨 펜 — 위 가로가 꺾여 내려가는 ㅈ)
// 이해 시험 v2 haiku 9번: 붙임 쪽지가 지난 편(「지마」)의 쪽지와 같은 끝 장치로 보임 → 쪽지 없이 쪽 위에 바로 쓴다
const NoteText: React.FC = () => (
  <>
    <text x={-4} y={-22} textAnchor="middle" dominantBaseline="central" fontFamily={PEN} fontSize={136} fill="#2443A6" filter="url(#inkpen)">
      잘했어!
    </text>
    <path d="M 96 96 c -12 -19 -41 -7 -26 15 c 7 10 22 19 26 24 c 3 -5 19 -14 26 -24 c 15 -22 -14 -34 -26 -15 z" fill="none" stroke="#2443A6" strokeWidth={5} strokeLinejoin="round" opacity={0.85} filter="url(#inkpen)" />
  </>
);
// 글 중심 기준 「잘」의 ㅈ 자리 — 빨간 동그라미가 둘러싼다
const NOTE_J: Pt = [-112, -50];
const R = 0.78; // 동그라미 크기
/** drop: 써지는 정도(0 → 1, 왼쪽부터 드러난다) */
const Note: React.FC<{ cx: number; cy: number; sc: number; rot: number; drop: number; circle: number }> = ({ cx, cy, sc, rot, drop, circle }) => {
  const q = (dx: number, dy: number) => `${NOTE_J[0] + dx * R} ${NOTE_J[1] + dy * R}`;
  const ring = `M ${q(4, -78)} C ${q(70, -80)} ${q(82, 40)} ${q(10, 66)} C ${q(-62, 84)} ${q(-92, -10)} ${q(-44, -62)} C ${q(-28, -78)} ${q(10, -86)} ${q(30, -74)}`;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${sc})`}>
      <defs>
        <clipPath id="inkWipe">
          <rect x={-240} y={-160} width={480 * drop} height={320} />
        </clipPath>
      </defs>
      <g clipPath="url(#inkWipe)">
        <NoteText />
      </g>
      <RedMark d={ring} p={circle} width={10} />
    </g>
  );
};

// 지우개 — 분홍 고무(파란 종이 띠)가 X 위를 오가며 문지른다
const Eraser: React.FC<{ cx: number; cy: number; w: number }> = ({ cx, cy, w }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const p = interpolate(t, [T.erase[0] - 0.14, T.erase[1] + 0.14], [0, 1], clamp);
  if (p <= 0 || p >= 1) return null;
  const rub = Math.sin(p * Math.PI * 8);
  const x = cx + rub * w * 0.26 + lerp(-0.2, 0.2, p) * w;
  const y = cy + lerp(-0.24, 0.26, p) * w + Math.cos(p * Math.PI * 8) * 10;
  const enter = interpolate(p, [0, 0.12, 0.88, 1], [0, 1, 1, 0], clamp);
  const lift = 1 - enter;
  return (
    <g transform={`translate(${x + 40 * lift} ${y - 90 * lift}) rotate(${-28 + rub * 4})`} opacity={Math.min(1, enter * 2)}>
      <defs>
        <linearGradient id="rubber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD3D8" />
          <stop offset="0.5" stopColor="#F5A8B1" />
          <stop offset="1" stopColor="#D98591" />
        </linearGradient>
        <linearGradient id="sleeve" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5A8BD0" />
          <stop offset="1" stopColor="#2C5596" />
        </linearGradient>
      </defs>
      <rect x={-92} y={-44} width={184} height={88} rx={20} fill={`rgba(50,25,25,${0.3 - 0.15 * lift})`} transform={`translate(${12 + 30 * lift} ${18 + 40 * lift})`} filter={`blur(${7 + 10 * lift}px)`} />
      <rect x={-92} y={-44} width={184} height={88} rx={20} fill="url(#rubber)" />
      <rect x={-88} y={-40} width={176} height={20} rx={10} fill="#FFFFFF" opacity={0.28} />
      <rect x={-20} y={-46} width={78} height={92} rx={4} fill="url(#sleeve)" />
      <rect x={-20} y={-46} width={78} height={14} fill="#FFFFFF" opacity={0.18} />
    </g>
  );
};
// 지우개 밥 — 말린 고무 부스러기가 칸 아래에 쌓였다가 두 꼴 나란히에서 사라진다
const Shavings: React.FC<{ cx: number; cy: number; w: number }> = ({ cx, cy, w }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  if (t < T.erase[0]) return null;
  const gone = interpolate(t, [T.arrange[0] - 0.1, T.arrange[0] + 0.2], [1, 0], clamp);
  if (gone <= 0) return null;
  return (
    <g opacity={gone}>
      {Array.from({ length: 9 }).map((_, i) => {
        const t0 = T.erase[0] + random(`c${i}`) * (T.erase[1] - T.erase[0]);
        const age = t - t0;
        if (age < 0) return null;
        const fall = Math.min(1, age / 0.35);
        const x = cx + (random(`cx${i}`) - 0.5) * w * 0.8;
        const y0 = cy + (random(`cy${i}`) - 0.6) * w * 0.5;
        const y = y0 + fall * (w * 0.12 + random(`cd${i}`) * 26);
        const L = 16 + 14 * random(`cl${i}`);
        const a = random(`ca${i}`) * 180;
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
            <rect x={-L / 2 + 2} y={-3} width={L} height={7} rx={3.5} fill="rgba(60,30,30,0.22)" transform="translate(2 3)" />
            <rect x={-L / 2} y={-3.5} width={L} height={7} rx={3.5} fill="#E7A9B0" />
            <rect x={-L / 2 + 2} y={-3} width={L - 4} height={2.5} rx={1.2} fill="#F9D2D6" />
          </g>
        );
      })}
    </g>
  );
};

// 둘째 장 자리(쪽지 · 카드)
const G = { x: BIG2.x + BIG2.s / 2, y: BIG2.y + BIG2.s / 2 }; // 큰 칸 가운데
const A = { note: { x: 735, y: 900, sc: 1.08 } }; // 큰 ス 꼴 칸 옆에 쪽지
// 친구의 ㅈ을 빨간 펜이 내 글자 위에 그대로 겹쳐 따라 긋는다 — 한국어를 못 읽어도 「같은 꼴」이 1초 안에(장면 심사 v3 「내 ㅈ과 「잘」의 ㅈ을 크게 포개라」)
const TRACE: string[] = [
  handPath(inBox(BIG2, [[0.19, 0.28], [0.76, 0.24], [0.57, 0.45], [0.38, 0.62], [0.2, 0.77]]), { sharp: true, seed: 'r1', jitter: 2 }),
  handPath(inBox(BIG2, [[0.5, 0.5], [0.61, 0.61], [0.73, 0.7], [0.86, 0.77]]), { seed: 'r2', jitter: 1.5 }),
];
const B = { note: { x: 735, y: 900, sc: 1.08 }, hand: { x: 735, y: 1160 }, print: { x: 300, y: 1160 } }; // 두 꼴 나란히(친구 손글씨는 쓴 자리 그대로)
const CARD_SC = 0.78;
const HAND_SC = (S * CARD_SC) / BIG2.s;
const Z_AT = { x: 540, y: 1565, sc: 0.5 };
// 끝 — 그 연필로 Z를 북북(볼 이유 v2)
const ZSCRIB: string = handPath(scribble('zz', [Z_AT.x - 82, Z_AT.y - 70], [Z_AT.x + 84, Z_AT.y + 72], 10, 46), { sharp: true, seed: 'zs', jitter: 3 });

const PageTwo: React.FC = () => {
  const L = useLoc();
  const f = useCurrentFrame();
  const t = f / 30;
  const { fps } = useVideoConfig();
  const drop = interpolate(t, T.noteIn, [0, 1], { ...clamp, easing: Easing.bezier(0.35, 0.05, 0.4, 1) }); // 파란 펜으로 써지듯 왼쪽부터
  const circle = prog(f, T.circle);
  const crossLeft = interpolate(t, [T.erase[0] + 0.05, T.erase[1]], [1, 0], clamp);
  const check = prog(f, T.check);
  const eq = prog(f, T.eq);
  const ar = interpolate(t, T.arrange, [0, 1], { ...clamp, easing: EASE_IO });
  const printCheck = prog(f, [T.arrange[1] - 0.05, T.arrange[1] + 0.25]);
  const zIn = spring({ frame: f - fr(T.zIn[0]), fps, config: { damping: 14, stiffness: 160, mass: 0.8 } });
  const zScrib = prog(f, T.zScrib);
  // ✓가 찍히는 순간 큰 칸이 한 번 튄다
  const bump = t >= T.check[0] ? spring({ frame: f - fr(T.check[0]), fps, config: { damping: 9, stiffness: 260, mass: 0.6 } }) : 0;
  const bumpSc = 1 + 0.06 * Math.sin(Math.min(1, bump) * Math.PI);

  const noteX = lerp(A.note.x, B.note.x, ar);
  const noteY = lerp(A.note.y, B.note.y, ar);
  const noteSc = lerp(A.note.sc, B.note.sc, ar);
  const traceGone = 1 - ar; // 빨간 덧그림은 두 꼴 나란히까지 그대로(이해 시험 v2 「Same이 무엇과 같은지」)
  // 큰 칸 묶음: 가운데 G → B.hand, 배율 1 → HAND_SC
  const gx = lerp(G.x, B.hand.x, ar);
  const gy = lerp(G.y, B.hand.y, ar);
  const gs = lerp(1, HAND_SC, ar) * bumpSc;
  const w = S * CARD_SC;
  const printX = lerp(-300, B.print.x, ar);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <PencilDefs />
        <g transform={`translate(${gx} ${gy}) scale(${gs}) translate(${-G.x} ${-G.y})`}>
          <rect x={BIG2.x} y={BIG2.y} width={BIG2.s} height={BIG2.s} fill="#FFFDF6" opacity={0.5 * ar} />
          <GridBox box={BIG2} w={4} />
          {HAND2.map((d, i) => (
            <Stroke key={i} d={d} p={prog(f, HAND2_W[i])} width={28} />
          ))}
          {CROSS2.map((d, i) => (crossLeft > 0 ? <Stroke key={`x${i}`} d={d} p={prog(f, CROSS2_W[i])} width={8} color="#17171C" opacity={0.95 * crossLeft} /> : null))}
          {eq > 0 && traceGone > 0 ? (
            <g opacity={0.78 * traceGone}>
              {TRACE.map((d, i) => (
                <Stroke key={`r${i}`} d={d} p={interpolate(eq, [i * 0.55, i * 0.55 + 0.45], [0, 1], clamp)} width={12} color={C.red} opacity={1} filter="url(#redpen)" />
              ))}
            </g>
          ) : null}
          <RedMark d={cornerCheck(G.x, G.y, BIG2.s)} p={check} width={26} />
        </g>
        {ar < 1 ? <Shavings cx={G.x} cy={G.y} w={BIG2.s} /> : null}
        {drop > 0 ? <Note cx={noteX} cy={noteY} sc={noteSc} rot={-4} drop={drop} circle={circle} /> : null}
        {ar > 0 ? (
          <Card k={1} cx={printX} cy={B.print.y} sc={CARD_SC} rot={lerp(-6, 0, ar)}>
            <RedMark d={cornerCheck(printX, B.print.y, w)} p={printCheck} width={20} />
          </Card>
        ) : null}
        {t >= T.zIn[0] ? (
          <g transform={`translate(0 ${(1 - zIn) * 420})`}>
            <Card k={0} cx={Z_AT.x} cy={Z_AT.y} sc={Z_AT.sc}>
              <Stroke d={ZSCRIB} p={zScrib} width={7} color="#17171C" opacity={0.95} />
            </Card>
          </g>
        ) : null}
        {/* 이해 시험 v3 haiku 답 1 「Z처럼 써도 된다」 — 끝 「never a Z」를 Z 옆 빨간 손글씨로도 */}
        {t >= (L.voice ? T.zScrib[1] : T.zIn[1]) ? (
          <g>
            <defs>
              <clipPath id="neverWipe">
                <rect x={110} y={1490} width={340 * interpolate(t, L.voice ? [T.zScrib[1], T.zScrib[1] + 0.5] : [T.zIn[1], T.zIn[1] + 0.5], [0, 1], clamp)} height={160} />
              </clipPath>
            </defs>
            <text x={118} y={1570} dominantBaseline="central" fontFamily={L.handFont ?? PEN} fontWeight={L.handFont ? 800 : undefined} fontSize={L.handSize ?? 84} fill={C.red} filter="url(#redpen)" clipPath="url(#neverWipe)" transform="rotate(-4 118 1570)">
              {L.never}
            </text>
          </g>
        ) : null}
        {ar < 0.5 ? <Eraser cx={G.x} cy={G.y} w={BIG2.s} /> : null}
      </svg>
    </AbsoluteFill>
  );
};

// ── 쪽 넘김: 첫 장 종이가 왼쪽 접힘선을 축으로 넘어간다 ───────────────
const FlipSheet: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [fr(T.flip[0]), fr(T.flip[1])], [0, 1], { ...clamp, easing: Easing.bezier(0.5, 0, 0.3, 1) });
  if (p >= 1) return null;
  const deg = -180 * p;
  const shade = Math.sin(Math.PI * Math.min(p, 0.5)) * 0.35;
  return (
    <div style={{ position: 'absolute', left: PAGE.x, top: PAGE.y, width: PAGE.w, height: PAGE.h, perspective: 2600, perspectiveOrigin: '0% 50%' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: '0% 50%',
          transform: `rotateY(${deg}deg)`,
          backfaceVisibility: 'hidden',
          backgroundImage: `url(${staticFile('img/notebook.jpg')})`,
          backgroundPosition: `${-PAGE.x}px ${-PAGE.y}px`,
          backgroundSize: '1080px 1920px',
          overflow: 'hidden',
          boxShadow: p > 0 ? `${-30 * p}px 0 60px rgba(0,0,0,${0.25 * Math.sin(Math.PI * p)})` : 'none',
        }}
      >
        <div style={{ position: 'absolute', left: -PAGE.x, top: -PAGE.y, width: 1080, height: 1920 }}>{children}</div>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, rgba(0,0,0,${shade * 0.4}), rgba(0,0,0,${shade}))` }} />
      </div>
    </div>
  );
};

// ── 소리 ─────────────────────────────────────────────────────────
const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at: t, vol = 1 }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
// 짧은 조각에서도 0 → 1 → 1 → 0 꼴이 늘 커지게
const fadeRange = (n: number) => { const b = Math.min(2, n * 0.25); const c = Math.max(b + 0.5, n - 5); return [0, b, c, Math.max(c + 0.5, n)]; };
const Sfx: React.FC<{ file: string; at: number; vol: number; from?: number; dur?: number }> = ({ file, at: t, vol, from = 0, dur }) => (
  <Sequence from={Math.max(0, fr(t))} durationInFrames={dur ? fr(dur) : undefined} layout="none">
    <Audio
      src={staticFile(`sfx/${file}`)}
      startFrom={fr(from) + (t < 0 ? fr(-t) : 0)}
      volume={(i) => vol * MASTER * (dur ? interpolate(i, fadeRange(fr(dur)), [0, 1, 1, 0], clamp) : 1)}
    />
  </Sequence>
);

const Sound: React.FC<{ scene?: boolean }> = ({ scene }) => {
  const L = useLoc();
  const voice = L.voice && !scene;
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={(i) => L.bgm * MASTER * interpolate(i, [fr(T.total) - 30, fr(T.total)], [1, 0], clamp)} />
      {voice ? (
        <>
          <Vo id="h1" at={T.h1} />
          <Vo id="a1" at={T.a1} />
          <Vo id="a2" at={T.a2} />
          <Vo id="a3" at={T.a3} />
          <Vo id="r1" at={T.r1} />
          <Vo id="r3" at={T.r3} />
          <Vo id="f2" at={T.f1} />
          <Vo id="s1" at={T.s1} />
          <Vo id="s2" at={T.s2} />
          <Vo id="e1" at={T.e1} />
          <Vo id="e2" at={T.e2} />
        </>
      ) : null}
      {/* 연필 — 실제 녹음 조각, 획마다 다른 자리 */}
      {ALL_DRAWS.map(([, w], i) => (w[1] - Math.max(0, w[0]) >= 0.15 ? <Sfx key={i} file={i % 2 ? 'pencil_b.wav' : 'pencil_a.wav'} at={Math.max(0, w[0])} from={[0.6, 2.4, 0.2, 1.5, 4.2, 0.6, 3.1, 1.1, 2.8][i % 9] + (w[0] < 0 ? -w[0] : 0)} dur={w[1] - Math.max(0, w[0])} vol={0.5} /> : null))}
      <Sfx file="pop.wav" at={T.tag1} vol={0.32} />
      <Sfx file="ding1.wav" at={T.tag2} vol={0.3} />
      <Sfx file="pop.wav" at={T.tag3} vol={0.32} />
      <Sfx file="page.wav" at={T.flip[0] - 0.05} vol={0.9} />
      {/* 둘째 장 큰 칸 연필 · 쪽지가 철썩 내려앉는 소리 · 빨간 펜 동그라미와 「=」 · 지우개 · ✓ */}
      {P2_DRAWS.map(([, w], i) => <Sfx key={`p2${i}`} file={i % 2 ? 'pencil_a.wav' : 'pencil_b.wav'} at={w[0]} from={[1.9, 0.4, 3.3, 2.1][i % 4]} dur={w[1] - w[0]} vol={0.55} />)}
      <Sfx file="pencil_a.wav" at={T.noteIn[0]} from={1.6} dur={T.noteIn[1] - T.noteIn[0]} vol={0.4} />
      <Sfx file="pencil_b.wav" at={T.circle[0]} from={1.2} dur={T.circle[1] - T.circle[0]} vol={0.4} />
      <Sfx file="pencil_a.wav" at={T.eq[0]} from={2.5} dur={T.eq[1] - T.eq[0]} vol={0.35} />
      <Sfx file="pencil_a.wav" at={T.erase[0]} from={3.0} dur={T.erase[1] - T.erase[0] + 0.05} vol={0.6} />
      <Sfx file="tok.wav" at={T.check[0]} vol={0.4} />
      <Sfx file="sparkle.wav" at={T.check[0] + 0.12} vol={0.3} />
      <Sfx file="tok.wav" at={T.arrange[1] - 0.05} vol={0.3} />
      <Sfx file="ding1.wav" at={T.arrange[1] + 0.05} vol={0.22} />
      <Sfx file="pencil_b.wav" at={T.hand[0]} from={0.9} dur={T.hand[1] - T.hand[0]} vol={0.4} />
      <Sfx file="pop.wav" at={T.zIn[0]} vol={0.28} />
      <Sfx file="pencil_b.wav" at={T.zScrib[0]} from={2.6} dur={T.zScrib[1] - T.zScrib[0]} vol={0.6} />
    </>
  );
};

// 카메라 — 이름표가 뜨는 순간 그 칸으로 다가간다(펀치 인). 원본의 이름표 웃음 박자를 화면이 한 번에 바뀌는 순간으로 살린다.
type Cam = [number, number, number, number]; // 초 · 배율 · 중심 x · 중심 y
const CAM: Cam[] = [
  [0, 1, 540, 960],
  [T.tag1 - 0.02, 1, 540, 960],
  [T.tag1 + 0.16, 1.12, 720, 773],
  [T.tag2 - 0.02, 1.12, 720, 773],
  [T.tag2 + 0.18, 1.12, 300, 1193],
  [T.tag3 - 0.02, 1.12, 300, 1193],
  [T.tag3 + 0.16, 1.2, 660, 1193],
  [T.flip[0], 1.2, 660, 1193],
  // 둘째 장: 큰 칸을 채우며 다가가고(장면 심사 v1 「넓은 종이에 작은 칸만」), 쪽지가 닿으면 가운데로, ✓ 순간 큰 칸으로 펀치 인, 두 꼴 나란히에서 제자리
  [T.flip[1], 1.1, 330, 900],
  [T.noteIn[0], 1.1, 330, 900],
  [T.noteIn[1] + 0.1, 1.04, 540, 900],
  [T.check[0] - 0.02, 1.04, 540, 900],
  [T.check[0] + 0.18, 1.14, 330, 900],
  [T.arrange[0], 1.14, 330, 900],
  [T.arrange[1], 1, 540, 960],
  // 끝(원본 15.0 끝 제목 박자): 두 꼴 · Z 쪽으로 톡 다가간다 — 나란히 v3 「끝 자리에 바뀌는 순간이 없다」
  [T.end - 0.02, 1, 540, 960],
  [T.end + 0.16, 1.1, 540, 1300],
  [T.total, 1.1, 540, 1300],
];
const camAt = (f: number) => {
  const t = f / 30;
  const k = CAM.findIndex((c, i) => i === CAM.length - 1 || t < CAM[i + 1][0]);
  const a = CAM[k], b = CAM[Math.min(k + 1, CAM.length - 1)];
  const p = b[0] === a[0] ? 1 : interpolate(t, [a[0], b[0]], [0, 1], { ...clamp, easing: EASE_IO });
  return [1, 2, 3].map((j) => a[j] + (b[j] - a[j]) * p) as [number, number, number];
};

export const Film: React.FC<{ loc?: Loc; plain?: boolean; scene?: boolean }> = ({ loc = 'en', plain = false, scene = false }) => {
  const f = useCurrentFrame();
  const flipped = f >= fr(T.flip[0]);
  const L = LOCALES[loc];
  // 끝 화면은 천천히 다가간다(끝까지 완전히 멈춘 화면이 되지 않게)
  const push = interpolate(f, [fr(T.end), fr(T.total)], [1, 1.03], clamp);
  const [cs, cx, cy] = camAt(f);
  const cam = cs === 1 ? undefined : `translate(${(1 - cs) * cx}px, ${(1 - cs) * cy}px) scale(${cs})`;
  return (
    <LocCtx.Provider value={L}>
      <AbsoluteFill style={{ backgroundColor: '#E9DCC4', transform: push === 1 ? undefined : `scale(${push})`, ...(L.font ? ({ '--kids-font': L.font } as React.CSSProperties) : {}) }}>
        <AbsoluteFill style={{ transformOrigin: '0 0', transform: cam }}>
        <Img src={staticFile('img/notebook.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
        {flipped ? <PageTwo /> : <PlainCtx.Provider value={plain}><PageOne /></PlainCtx.Provider>}
        {flipped && !plain ? <HandNote /> : null}
        {flipped ? (
          <FlipSheet>
            <PlainCtx.Provider value={plain}><PageOne /></PlainCtx.Provider>
          </FlipSheet>
        ) : null}
        <Pencil />
        {/* 책상 스탠드 불빛 · 가장자리 그늘 — 사진처럼 깊이를 준다(장면 심사 v2 「클립아트처럼 평평」) */}
        <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 55% at 30% 34%, rgba(255,226,170,0.34), rgba(255,226,170,0) 70%)', mixBlendMode: 'soft-light' }} />
        <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse 85% 75% at 46% 50%, rgba(0,0,0,0) 55%, rgba(45,28,12,0.32) 100%)', mixBlendMode: 'multiply' }} />
        {plain ? null : <Titles />}
        </AbsoluteFill>
        <Sound scene={scene} />
      </AbsoluteFill>
    </LocCtx.Provider>
  );
};
