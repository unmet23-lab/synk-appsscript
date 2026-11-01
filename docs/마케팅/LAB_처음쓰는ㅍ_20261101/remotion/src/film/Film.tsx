// LAB E23 「처음 쓰는 ㅍ」 — 공책 위 손글씨 POV(원본 E5 「처음 쓰는 ㄹ」 1:1, E11 「처음 쓰는 ㅎ」 코드를 고쳐 씀). 전부 useCurrentFrame()으로만 움직인다.
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths';
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO, MONO } from '../lib/fonts';
import { handPath, inBox, Pt, ringPts } from './geo';
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
};
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);

// 쪽(배경 사진 안 오른쪽 쪽) — notebook.jpg 1080×1920 기준
const PAGE = { x: 56, y: 132, w: 982, h: 1621 };

// 첫 장: 2×2 칸
const S = 396;
const BOX = [
  { x: 102, y: 575, s: S },
  { x: 522, y: 575, s: S },
  { x: 102, y: 995, s: S },
  { x: 522, y: 995, s: S },
];
// 둘째 장: 큰 칸 하나
const BIG = { x: 220, y: 700, s: 640 };

// ── 획 ─────────────────────────────────────────────────────────────
// 틀린 시도 셋 — π(아래 가로 없이 다리가 말림) · #(세로가 가로를 뚫고 나감 — ㅍ의 흔한 실수) · 강아지(머리 · 꼬리가 붙음 — 사실 ㅍ에 머리 · 꼬리, 끝에서 ✓)
const ATTS: string[][] = [
  [
    handPath(inBox(BOX[1], [[0.17, 0.31], [0.83, 0.29]]), { sharp: true, seed: 'p1s1', jitter: 4 }),
    handPath(inBox(BOX[1], [[0.38, 0.31], [0.375, 0.5], [0.36, 0.64], [0.32, 0.73], [0.24, 0.77]]), { seed: 'p1s2', jitter: 2 }),
    handPath(inBox(BOX[1], [[0.62, 0.31], [0.615, 0.5], [0.625, 0.64], [0.67, 0.72], [0.75, 0.735], [0.8, 0.69]]), { seed: 'p1s3', jitter: 2 }),
  ],
  [
    handPath(inBox(BOX[2], [[0.16, 0.36], [0.84, 0.34]]), { sharp: true, seed: 'p2s1', jitter: 4 }),
    handPath(inBox(BOX[2], [[0.43, 0.12], [0.36, 0.88]]), { sharp: true, seed: 'p2s2', jitter: 4 }),
    handPath(inBox(BOX[2], [[0.67, 0.12], [0.6, 0.88]]), { sharp: true, seed: 'p2s3', jitter: 4 }),
    handPath(inBox(BOX[2], [[0.14, 0.66], [0.82, 0.64]]), { sharp: true, seed: 'p2s4', jitter: 4 }),
  ],
  [
    handPath(inBox(BOX[3], ringPts(0.19, 0.37, 0.085, { n: 12, sx: 1.3 })), { seed: 'p3s1', jitter: 3 }),
    handPath(inBox(BOX[3], [[0.29, 0.41], [0.5, 0.42], [0.71, 0.41], [0.79, 0.35], [0.82, 0.26]]), { seed: 'p3s2', jitter: 3 }),
    handPath(inBox(BOX[3], [[0.37, 0.42], [0.36, 0.73]]), { sharp: true, seed: 'p3s3', jitter: 3 }),
    handPath(inBox(BOX[3], [[0.67, 0.42], [0.68, 0.73]]), { sharp: true, seed: 'p3s4', jitter: 3 }),
    handPath(inBox(BOX[3], [[0.12, 0.75], [0.88, 0.745]]), { sharp: true, seed: 'p3s5', jitter: 3 }),
  ],
];

// 처진 귀 — 머리 뒤쪽 위에서 아래로 늘어진 물방울(칸 안 0~1 좌표 여섯 점)
const earPath = (box: { x: number; y: number; s: number }, p: Pt[]) => {
  const q = inBox(box, p);
  return `M ${q[0][0]} ${q[0][1]} C ${q[1][0]} ${q[1][1]} ${q[2][0]} ${q[2][1]} ${q[3][0]} ${q[3][1]} C ${q[4][0]} ${q[4][1]} ${q[5][0]} ${q[5][1]} ${q[0][0]} ${q[0][1]} Z`;
};

const DOG1 = {
  eye: inBox(BOX[3], [[0.165, 0.35]])[0],
  nose: inBox(BOX[3], [[0.085, 0.375]])[0],
  ear: earPath(BOX[3], [[0.2, 0.29], [0.27, 0.27], [0.31, 0.33], [0.29, 0.45], [0.25, 0.47], [0.21, 0.4]]),
};

// 바른 ㅍ — 위 가로 → 왼쪽 세로 → 오른쪽 세로 → 아래 가로(아래가 더 길다)
const STROKES = [
  handPath(inBox(BIG, [[0.27, 0.25], [0.73, 0.25]]), { sharp: true, seed: 'st1', jitter: 2.5 }),
  handPath(inBox(BIG, [[0.38, 0.26], [0.385, 0.71]]), { sharp: true, seed: 'st2', jitter: 2.5 }),
  handPath(inBox(BIG, [[0.62, 0.26], [0.615, 0.71]]), { sharp: true, seed: 'st3', jitter: 2.5 }),
  handPath(inBox(BIG, [[0.15, 0.72], [0.85, 0.72]]), { sharp: true, seed: 'st4', jitter: 2.5 }),
];
const BADGES: Pt[] = inBox(BIG, [[0.13, 0.25], [0.26, 0.49], [0.74, 0.49], [0.06, 0.72]]);
const STROKE_T = [T.st1, T.st2, T.st3, T.st4];
// 벌리기: 위는 위로, 왼쪽 · 오른쪽 세로는 옆으로, 아래는 아래로
const SPREAD: Pt[] = [[0, -78], [-62, 0], [62, 0], [0, 78]];
// 끝 반전: 바른 ㅍ에 빨간 펜으로 머리 · 귀 · 꼬리 — 등(위 가로) · 다리 둘 · 바닥(아래 가로)
const DOG2 = {
  head: handPath(inBox(BIG, ringPts(0.165, 0.2, 0.085, { n: 12, sx: 1.3 })), { seed: 'd2h', jitter: 2 }),
  ear: earPath(BIG, [[0.18, 0.125], [0.245, 0.105], [0.29, 0.16], [0.27, 0.29], [0.23, 0.305], [0.2, 0.24]]),
  tail: handPath(inBox(BIG, [[0.73, 0.25], [0.79, 0.21], [0.82, 0.14], [0.8, 0.09]]), { seed: 'd2t', jitter: 1.5 }),
  eye: inBox(BIG, [[0.135, 0.18]])[0],
  nose: inBox(BIG, [[0.06, 0.21]])[0],
};

const TAIL_ROOT = inBox(BIG, [[0.73, 0.25]])[0];
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

// 시도 하나의 시간 [a,b]를 획 길이대로 나눈다 — 획 사이 펜을 드는 틈 0.1초
const LIFT = 0.1;
const subWins = (paths: string[], [a, b]: readonly [number, number]): [number, number][] => {
  const L = paths.reduce((acc, d) => acc + len(d), 0);
  const avail = b - a - LIFT * (paths.length - 1);
  let t = a;
  return paths.map((d) => {
    const w: [number, number] = [t, t + (avail * len(d)) / L];
    t = w[1] + LIFT;
    return w;
  });
};
const ATT_T = [T.att1, T.att2, T.att3];
const DRAWS: [string, [number, number]][] = ATTS.flatMap((paths, i) => {
  const ws = subWins(paths, ATT_T[i]);
  return paths.map((d, k) => [d, ws[k]] as [string, [number, number]]);
});

/** 초 구간 [a,b]에서 0→1(획 긋는 속도: 처음과 끝만 조금 느리게). */
const prog = (f: number, [a, b]: readonly [number, number]) => interpolate(f, [fr(a), fr(b)], [0, 1], { ...clamp, easing: Easing.bezier(0.35, 0.05, 0.4, 1) });

// ── 연필 자국 ──────────────────────────────────────────────────────
const PencilDefs: React.FC = () => (
  <defs>
    <filter id="graphite" filterUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="rough" />
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.36" result="grain" />
      <feComposite in="rough" in2="grain" operator="in" />
    </filter>
    <filter id="redpen" filterUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920">
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="3" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
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
const GridBox: React.FC<{ box: { x: number; y: number; s: number }; w?: number }> = ({ box, w = 3 }) => (
  <g>
    <rect x={box.x} y={box.y} width={box.s} height={box.s} fill="none" stroke={C.grid} strokeWidth={w} opacity={0.75} />
    <line x1={box.x + box.s / 2} y1={box.y + 8} x2={box.x + box.s / 2} y2={box.y + box.s - 8} stroke={C.grid} strokeWidth={2} strokeDasharray="10 12" opacity={0.45} />
    <line x1={box.x + 8} y1={box.y + box.s / 2} x2={box.x + box.s - 8} y2={box.y + box.s / 2} stroke={C.grid} strokeWidth={2} strokeDasharray="10 12" opacity={0.45} />
  </g>
);

// ── 이름표(「π?」) ────────────────────────────────────────────────
const Tag: React.FC<{ text: string; at: number; box: { x: number; y: number; s: number }; plain?: boolean }> = ({ text, at: t, box, plain }) => {
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
        background: plain ? '#FFFDF8' : C.coral,
        color: C.brown,
        border: plain ? `4px solid ${C.coral}` : 'none',
        fontFamily: EN,
        fontWeight: 800,
        fontSize: plain ? L.size.tagPlain : L.size.tag,
        lineHeight: L.voice ? 1 : 1.25,
        padding: plain ? '10px 18px 12px' : '14px 22px 16px',
        borderRadius: 18,
        boxShadow: '0 6px 14px rgba(80,30,20,0.18)',
      }}
    >
      {text}
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
  if (t < T.flip[0]) {
    for (let i = 0; i < DRAWS.length; i += 1) {
      const [d, w] = DRAWS[i];
      if (t <= w[1]) {
        if (t >= w[0]) return { tip: at(d, prog(f, w)), down: 1, show: true };
        const prev = DRAWS[i - 1];
        return { tip: move(endOf(prev[0]), startOf(d), [prev[1][1] + Math.min(0.08, (w[0] - prev[1][1]) * 0.2), w[0]]), down: 0, show: true };
      }
    }
    return { tip: move(endOf(DRAWS[DRAWS.length - 1][0]), OFF, T.pencilOut), down: 0, show: t < T.pencilOut[1] };
  }
  if (t < T.st1[0]) return { tip: move(OFF, startOf(STROKES[0]), T.pencilIn), down: 0, show: t > T.pencilIn[0] };
  for (let i = 0; i < STROKES.length; i += 1) {
    const w = STROKE_T[i];
    if (t <= w[1]) {
      if (t >= w[0]) return { tip: at(STROKES[i], prog(f, w)), down: 1, show: true };
      return { tip: move(endOf(STROKES[i - 1]), startOf(STROKES[i]), [STROKE_T[i - 1][1] + 0.05, w[0]]), down: 0, show: true };
    }
  }
  return { tip: move(endOf(STROKES[3]), OFF, T.pencilAway), down: 0, show: t < T.pencilAway[1] };
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
// 판 글 속 「ㅍ」만 한글 서체로, 「\n」은 줄바꿈
const withHangul = (s: string) =>
  s.split('\n').flatMap((line, n) => [
    ...(n ? [<br key={`b${n}`} />] : []),
    ...line.split('ㅍ').flatMap((part, i) => (i ? [<span key={`h${n}-${i}`} style={HANGUL_IN_EN}>ㅍ</span>, part] : [part])),
  ]);

const Titles: React.FC = () => {
  const L = useLoc();
  const big: React.CSSProperties = { ...BIG_TXT, fontSize: L.size.big, lineHeight: L.size.lineHeight, letterSpacing: L.voice ? -1 : 0 };
  const f = useCurrentFrame();
  const t = f / 30;
  const fade = (a: number, b: number) => interpolate(t, [a, a + 0.12, b - 0.12, b], [0, 1, 1, 0], clamp);
  // 목소리 없는 판(두 채널): 영어 목소리의 말을 제목 자리 둘째 줄로 — 아래 앱 글자 자리(1428px)를 비운다(11-01 검사)
  const says = !L.voice && L.says ? (t >= T.tag3 - 0.1 ? L.says.a3 : t >= T.tag2 - 0.1 ? L.says.a2 : t >= T.tag1 - 0.1 ? L.says.a1 : null) : null;
  const saysStyle: React.CSSProperties = { display: 'inline-block', background: '#FFF8EC', border: `4px solid ${C.coral}`, borderRadius: 20, padding: '8px 22px 10px', fontFamily: EN, fontWeight: 800, fontSize: 50, lineHeight: 1.3, color: C.brown, marginTop: 16 };
  if (t < T.flip[0] + 0.1) {
    return (
      <TitleZone top={L.voice ? 310 : 300} height={260} opacity={Math.min(interpolate(t, [T.flip[0] - 0.1, T.flip[0] + 0.1], [1, 0], clamp), L.voice ? interpolate(t, [T.tag3 - 0.05, T.tag3 + 0.12], [1, 0], clamp) : 1)}>
        <div style={big}>
          {L.title.map((line, i) => (
            <React.Fragment key={i}>
              {i ? <br /> : L.kicker ? <Kicker>{L.kicker}</Kicker> : null}
              {withHangul(line)}
            </React.Fragment>
          ))}
        </div>
        {says ? (
          <Pop at={t >= T.tag3 - 0.1 ? T.tag3 - 0.1 : t >= T.tag2 - 0.1 ? T.tag2 - 0.1 : T.tag1 - 0.1}><span style={saysStyle}>{says}</span></Pop>
        ) : (
          <div style={{ fontFamily: EN, fontWeight: L.voice ? 600 : 800, fontSize: L.size.sub, lineHeight: L.voice ? undefined : 1.4, color: C.coralShade, marginTop: 14 }}>
            {L.sub.split('{pieup}').flatMap((part, i) => (i ? [<span key={i} style={{ fontFamily: MONO, fontWeight: 500 }}>pieup</span>, ...withHangul(part)] : withHangul(part)))}
          </div>
        )}
      </TitleZone>
    );
  }
  if (t < T.k1) {
    return (
      <TitleZone opacity={fade(T.f1, T.k1)}>
        <div style={{ ...big, fontSize: L.size.fix }}>
          <Pop at={T.f1 + 0.04}>{L.fix[0]}</Pop>
          <br />
          <Pop at={T.f1 + 1.0} style={{ color: C.coralShade }}>{L.fix[1]}</Pop>
        </div>
        {!L.voice && L.says?.d ? <Pop at={T.dog[0]}><span style={saysStyle}>{L.says.d}</span></Pop> : null}
      </TitleZone>
    );
  }
  if (t < T.end) {
    return (
      <TitleZone top={240} opacity={fade(T.k1 - 0.05, T.end)}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 28 }}>
          <Pop at={T.k1}><span style={{ ...HANGUL_IN_EN, fontSize: 150, color: C.brown, lineHeight: 1 }}>ㅍ</span></Pop>
          <Pop at={T.k1 + 0.08}><span style={{ fontFamily: KO, fontWeight: 800, fontSize: 120, color: C.coralShade, lineHeight: 1 }}>= 피읖</span></Pop>
        </div>
        <Pop at={T.k1 + 0.2} style={{ fontFamily: EN, fontWeight: 800, fontSize: L.size.name, color: C.brown, marginTop: 10 }}>
          {L.nameLine.split('{name}').flatMap((part, i) => (i ? [<span key={i} style={{ fontFamily: KO, fontWeight: 800 }}>피읖</span>, part] : [part]))}
        </Pop>
      </TitleZone>
    );
  }
  return (
    <TitleZone opacity={interpolate(t, [T.end, T.end + 0.12], [0, 1], clamp)}>
      <div style={big}>
        <Pop at={T.end} style={{ fontSize: L.size.end }}>{withHangul(L.end[0])}</Pop>
        {L.end[1] ? <br /> : null}
        {L.end[1] ? <Pop at={L.voice ? T.back : T.dog[1]} style={{ color: C.coralShade, fontSize: L.size.endSub }}>
          {withHangul(L.end[1])}
          <span style={{ fontFamily: "'Segoe UI Emoji', 'Noto Color Emoji', sans-serif", fontWeight: 400, marginLeft: 12 }}>🐶</span>
        </Pop> : null}
      </div>
      {!L.voice && L.says ? <Pop at={T.e1}><span style={{ ...saysStyle, fontSize: 44 }}>{L.says.e1}</span></Pop> : null}
    </TitleZone>
  );
};

// ── 첫 장 ─────────────────────────────────────────────────────────
const PageOne: React.FC = () => {
  const L = useLoc();
  const f = useCurrentFrame();
  const face = interpolate(f, [fr(T.att3[1] + 0.05), fr(T.att3[1] + 0.4)], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <PencilDefs />
        {BOX.map((b, i) => (
          <GridBox key={i} box={b} />
        ))}
        <text x={BOX[0].x + S / 2} y={BOX[0].y + S * 0.5} textAnchor="middle" dominantBaseline="central" fontFamily="SUIT" fontWeight={500} fontSize={S * 0.74} fill="#3C3230" opacity={0.26}>
          ㅍ
        </text>
        {DRAWS.map(([d, w], i) => (
          <Stroke key={i} d={d} p={prog(f, w)} width={19} />
        ))}
        {face > 0 ? (
          <>
            <path d={DOG1.ear} fill={C.graphite} opacity={0.88 * Math.min(1, face * 1.6)} filter="url(#graphite)" />
            <circle cx={DOG1.eye[0]} cy={DOG1.eye[1]} r={8 * Math.min(1, face * 2)} fill={C.graphite} />
            <circle cx={DOG1.nose[0]} cy={DOG1.nose[1]} r={10 * Math.min(1, Math.max(0, face * 2 - 0.4))} fill={C.graphite} />
          </>
        ) : null}
      </svg>
      {React.useContext(PlainCtx) ? null : <>
      <Tag text={L.tags.copy} at={-1} box={BOX[0]} plain />
      <Tag text={L.tags.a1} at={T.tag1} box={BOX[1]} />
      <Tag text={L.tags.a2} at={T.tag2} box={BOX[2]} />
      <Tag text={L.tags.a3} at={T.tag3} box={BOX[3]} />
      </>}
    </AbsoluteFill>
  );
};

// ── 둘째 장 ───────────────────────────────────────────────────────
const GUIDE_AT = T.flip[1] + 0.05; // 쪽을 넘기자마자 — 빈 칸으로 2초를 두지 않는다

const Badge: React.FC<{ n: number; p: Pt; at: number; active: readonly [number, number]; off: Pt }> = ({ n, p, at: t, active, off }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: f - fr(t), fps, config: { damping: 12, stiffness: 200, mass: 0.6 } });
  const on = spring({ frame: f - fr(active[0]), fps, config: { damping: 14, stiffness: 220 } }) - spring({ frame: f - fr(active[1] + 0.1), fps, config: { damping: 14, stiffness: 220 } });
  if (f < fr(t)) return null;
  // 번호 1은 머리가 그려질 때(첫 획 뒤) 걷힌다 — 머리를 가리지 않게
  const gone = n === 1 ? interpolate(f, [fr(T.dog[0]), fr(T.dog[0] + 0.15)], [1, 0], clamp) : interpolate(f, [fr(T.end - 0.1), fr(T.end + 0.1)], [1, 0], clamp);
  if (gone <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        opacity: gone,
        left: p[0] - 36 + off[0],
        top: p[1] - 36 + off[1],
        width: 72,
        height: 72,
        borderRadius: 36,
        background: C.coral,
        color: C.brown,
        fontFamily: EN,
        fontWeight: 800,
        fontSize: 46,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${sp * (1 + 0.22 * on)})`,
        boxShadow: '0 4px 10px rgba(80,30,20,0.18)',
      }}
    >
      {n}
    </div>
  );
};

/** 칸 위 「top › left › right › bottom」 — 쪽을 넘기자마자 흐리게 깔고(번지는 등장 없이), 그 획을 긋는 동안 코랄 · 그은 뒤 진하게. */
const StrokeRow: React.FC = () => {
  const L = useLoc();
  const f = useCurrentFrame();
  const t = f / 30;
  const show = interpolate(t, [GUIDE_AT, GUIDE_AT + 0.25], [0, 1], clamp);
  if (show <= 0) return null;
  const color = (i: number) => (t >= STROKE_T[i][0] && t < STROKE_T[i][1] + 0.2 ? C.coral : t >= STROKE_T[i][0] ? C.brown : 'rgba(43,26,20,0.5)');
  return (
    <div style={{ position: 'absolute', left: 60, width: 960, top: BIG.y - 92, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontFamily: EN, fontWeight: 800, fontSize: L.size.strokes, lineHeight: 1, opacity: show }}>
      {L.strokes.map((w, i) => (
        <React.Fragment key={i}>
          {i ? <span style={{ color: C.brown, opacity: 0.4, margin: '0 10px' }}>›</span> : null}
          <span style={{ color: color(i), display: 'inline-block', transform: `scale(${t >= STROKE_T[i][0] && t < STROKE_T[i][1] ? 1.12 : 1})` }}>{w}</span>
        </React.Fragment>
      ))}
    </div>
  );
};

// 바른 획마다 붙는 빨간 펜 이름 — 「이게 뭐지?」를 쌓다가 끝에 머리 · 꼬리로 강아지(v4 볼 이유 심사 · 셋이 같이 짚은 「왜 강아지」)
const PART: { text: string; at: Pt; anchor: 'start' | 'middle' | 'end' }[] = [
  { text: 'back', at: inBox(BIG, [[0.5, 0.165]])[0], anchor: 'middle' },
  { text: 'leg', at: inBox(BIG, [[0.33, 0.6]])[0], anchor: 'end' },
  { text: 'leg', at: inBox(BIG, [[0.67, 0.6]])[0], anchor: 'start' },
  { text: 'floor', at: inBox(BIG, [[0.5, 0.86]])[0], anchor: 'middle' },
];
const LEG_TOP = inBox(BIG, [[0.38, 0.26], [0.62, 0.26]]);
const legWiggle = (f: number, i: number) => {
  if (i !== 1 && i !== 2) return '';
  const w = interpolate(f, [fr(T.wiggle[0]), fr(T.wiggle[1])], [0, 1], clamp);
  if (w <= 0 || w >= 1) return '';
  const a = Math.sin(w * Math.PI * 4) * 7 * Math.sin(w * Math.PI) * (i === 1 ? 1 : -1);
  const [x, y] = LEG_TOP[i - 1];
  return `rotate(${a} ${x} ${y})`;
};
const FAIL_AT = T.back + 0.35;
const FailRow: React.FC = () => {
  const f = useCurrentFrame();
  if (f < fr(FAIL_AT)) return null;
  // 11-01: 둘 이상이 「끝 그림이 작다」고 짚어 키움(글 · 크기만 — 다시 시험 안 함)
  const scs = [0.5, 0.5, 0.74];
  const cxs = [190, 440, 775];
  const cy = useLoc().voice ? 1555 : 1665;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <PencilDefs />
      {[1, 2, 3].map((b, k) => {
        const box = BOX[b];
        const t0 = FAIL_AT + k * 0.14;
        const o = interpolate(f, [fr(t0), fr(t0 + 0.15)], [0, 1], clamp);
        const sc = scs[k];
        const tx = cxs[k] - (box.x + box.s / 2) * sc;
        const ty = cy - (box.y + box.s / 2) * sc;
        const x = cxs[k], y = cy;
        const cross = interpolate(f, [fr(t0 + 0.12), fr(t0 + 0.3)], [0, 1], clamp);
        const ok = k === 2;
        return (
          <g key={k} opacity={o}>
            <g transform={`translate(${tx} ${ty}) scale(${sc})`}>
              {ATTS[k].map((d, i) => <path key={i} d={d} fill="none" stroke={C.graphite} strokeWidth={19} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />)}
            </g>
            {ok && cross > 0 ? <path d={`M ${x - 110} ${y + 10} L ${x - 40} ${y + 90} L ${x + 120} ${y - 110}`} stroke={C.red} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.9} filter="url(#redpen)" strokeDasharray={evolvePath(cross, `M ${x - 110} ${y + 10} L ${x - 40} ${y + 90} L ${x + 120} ${y - 110}`).strokeDasharray} strokeDashoffset={evolvePath(cross, `M ${x - 110} ${y + 10} L ${x - 40} ${y + 90} L ${x + 120} ${y - 110}`).strokeDashoffset} /> : null}
            {!ok && cross > 0 ? <path d={`M ${x - 75} ${y - 75} L ${x - 75 + 150 * cross} ${y - 75 + 150 * cross}`} stroke={C.red} strokeWidth={7} strokeLinecap="round" opacity={0.8} filter="url(#redpen)" /> : null}
            {!ok && cross >= 1 ? <path d={`M ${x + 75} ${y - 75} L ${x - 75} ${y + 75}`} stroke={C.red} strokeWidth={7} strokeLinecap="round" opacity={0.8} filter="url(#redpen)" /> : null}
          </g>
        );
      })}
    </svg>
  );
};

const PageTwo: React.FC = () => {
  const L = useLoc();
  const f = useCurrentFrame();
  const snap = interpolate(f, [fr(T.snap[0]), fr(T.snap[1])], [0, 1], { ...clamp, easing: EASE_IO });
  const drift = 0.3 * interpolate(f, [fr(T.explode[1]), fr(T.snap[0])], [0, 1], clamp);
  const ex = (interpolate(f, [fr(T.explode[0]), fr(T.explode[1])], [0, 1], { ...clamp, easing: EASE }) + drift) * (1 - snap);
  const dp = (a: number, b: number) => prog(f, [a, b]);
  const D = T.dog;
  const step = (D[1] - D[0]) / 4;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <PencilDefs />
        <GridBox box={BIG} w={4} />
        {STROKES.map((d, i) => {
          const g = interpolate(f, [fr(GUIDE_AT + i * 0.2), fr(GUIDE_AT + i * 0.2 + 0.35)], [0, 1], { ...clamp, easing: EASE });
          const gone = interpolate(f, [fr(STROKE_T[i][1]), fr(STROKE_T[i][1] + 0.2)], [1, 0], clamp);
          if (g <= 0 || gone <= 0) return null;
          const ev = evolvePath(g, d);
          return <path key={`g${i}`} d={d} fill="none" stroke={C.coral} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" opacity={0.32 * gone} strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />;
        })}
        {STROKES.map((d, i) => (
          <g key={i} transform={`translate(${SPREAD[i][0] * ex} ${SPREAD[i][1] * ex}) ${legWiggle(f, i)}`}>
            <Stroke d={d} p={prog(f, STROKE_T[i])} width={32} />
            {i === 0 && f >= fr(D[0]) ? (
              <g>
                <Stroke d={DOG2.head} p={dp(D[0], D[0] + step * 1.3)} width={12} color={C.red} opacity={1} filter="url(#redpen)" />
                <path d={DOG2.ear} fill={C.red} opacity={0.92 * interpolate(f, [fr(D[0] + step * 1.35), fr(D[0] + step * 2)], [0, 1], clamp)} filter="url(#redpen)" />
                <circle cx={DOG2.eye[0]} cy={DOG2.eye[1]} r={10 * interpolate(f, [fr(D[0] + step * 2), fr(D[0] + step * 2.2)], [0, 1], clamp)} fill={C.red} />
                <circle cx={DOG2.nose[0]} cy={DOG2.nose[1]} r={11 * interpolate(f, [fr(D[0] + step * 2.2), fr(D[0] + step * 2.4)], [0, 1], clamp)} fill={C.red} />
                <g transform={`rotate(${f > fr(D[1]) ? Math.sin((f - fr(D[1])) * 0.55) * 14 : 0} ${TAIL_ROOT[0]} ${TAIL_ROOT[1]})`}>
                  <Stroke d={DOG2.tail} p={dp(D[0] + step * 2.5, D[1])} width={12} color={C.red} opacity={1} filter="url(#redpen)" />
                </g>
              </g>
            ) : null}
            {f >= fr(STROKE_T[i][1] - 0.05) ? (
              <text x={PART[i].at[0]} y={PART[i].at[1]} textAnchor={PART[i].anchor} dominantBaseline="central" fontFamily={L.partFont ?? "Inter Tight"} fontWeight={800} fontSize={(L.partSize ?? 64) * Math.min(1, 0.5 + 0.5 * interpolate(f, [fr(STROKE_T[i][1] - 0.05), fr(STROKE_T[i][1] + 0.15)], [0, 1], clamp))} fill={C.red} transform={`rotate(-4 ${PART[i].at[0]} ${PART[i].at[1]})`}>
                {L.parts[i]}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      {BADGES.map((p, i) => (
        <Badge key={i} n={i + 1} p={p} at={GUIDE_AT + i * 0.2} active={STROKE_T[i]} off={[SPREAD[i][0] * ex, SPREAD[i][1] * ex]} />
      ))}
      <StrokeRow />
      <FailRow />
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

const Sound: React.FC = () => {
  const L = useLoc();
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={(i) => L.bgm * MASTER * interpolate(i, [fr(T.total) - 30, fr(T.total)], [1, 0], clamp)} />
      {L.voice ? (
        <>
          <Vo id="h1" at={T.h1} />
          <Vo id="a1" at={T.a1} />
          <Vo id="a2" at={T.a2} />
          <Vo id="a3" at={T.a3} />
          <Vo id="f1" at={T.f1} />
          <Vo id="n1" at={T.st1[0]} />
          <Vo id="n2" at={T.st2[0]} />
          <Vo id="n3" at={T.st3[0]} />
          <Vo id="n4" at={T.st4[0]} />
          <Vo id="e2" at={T.e1} />
        </>
      ) : null}
      <Vo id="k1" at={T.k1} />
      {/* 연필 — 실제 녹음 조각, 획마다 다른 자리 */}
      {DRAWS.map(([, w], i) => (w[1] - Math.max(0, w[0]) >= 0.2 ? <Sfx key={i} file={i % 2 ? 'pencil_b.wav' : 'pencil_a.wav'} at={Math.max(0, w[0])} from={[0.6, 2.4, 0.2, 1.5, 4.2, 0.6, 3.1, 1.1, 2.8][i % 9] + (w[0] < 0 ? -w[0] : 0)} dur={w[1] - Math.max(0, w[0])} vol={0.5} /> : null))}
      {STROKE_T.map((w, i) => (
        <Sfx key={`s${i}`} file={i % 2 ? 'pencil_a.wav' : 'pencil_b.wav'} at={w[0]} from={[1.5, 4.2, 0.6, 2.8][i]} dur={w[1] - w[0]} vol={0.55} />
      ))}
      <Sfx file="tick.wav" at={T.wiggle[0]} vol={0.25} />
      <Sfx file="tick.wav" at={T.wiggle[0] + 0.17} vol={0.22} />
      <Sfx file="pencil_b.wav" at={T.dog[0]} from={2.2} dur={T.dog[1] - T.dog[0]} vol={0.35} />
      <Sfx file="pop.wav" at={T.tag1} vol={0.32} />
      <Sfx file="pop.wav" at={T.tag2} vol={0.32} />
      <Sfx file="pop.wav" at={T.tag3} vol={0.32} />
      <Sfx file="page.wav" at={T.flip[0] - 0.05} vol={0.9} />
      <Sfx file="tok.wav" at={T.explode[0]} vol={0.3} />
      <Sfx file="tok.wav" at={T.snap[1] - 0.05} vol={0.35} />
      <Sfx file="sparkle.wav" at={T.snap[1]} vol={0.22} />
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
  [T.tag3 + 0.16, 1.22, 720, 1193],
  [T.flip[0], 1.22, 720, 1193],
  [T.flip[1], 1, 540, 960],
];
const camAt = (f: number) => {
  const t = f / 30;
  const k = CAM.findIndex((c, i) => i === CAM.length - 1 || t < CAM[i + 1][0]);
  const a = CAM[k], b = CAM[Math.min(k + 1, CAM.length - 1)];
  const p = b[0] === a[0] ? 1 : interpolate(t, [a[0], b[0]], [0, 1], { ...clamp, easing: EASE_IO });
  return [1, 2, 3].map((j) => a[j] + (b[j] - a[j]) * p) as [number, number, number];
};

export const Film: React.FC<{ loc?: Loc; plain?: boolean }> = ({ loc = 'en', plain = false }) => {
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
        {flipped ? (
          <FlipSheet>
            <PageOne />
          </FlipSheet>
        ) : null}
        <Pencil />
        {plain ? null : <Titles />}
        </AbsoluteFill>
        <Sound />
      </AbsoluteFill>
    </LocCtx.Provider>
  );
};
