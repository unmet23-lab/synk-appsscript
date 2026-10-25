// LAB E5 「처음 쓰는 ㄹ」 — 공책 위 손글씨 POV. 전부 useCurrentFrame()으로만 움직인다.
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths';
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO, MONO } from '../lib/fonts';
import { handPath, inBox, Pt } from './geo';
import { LOCALES, Loc, LocText } from './locale';
import { fr, T } from './timeline';

// 판(en · zhs · my)의 화면 글 — Film이 판 하나를 골라 아래로 내린다(locale.ts).
const LocCtx = React.createContext<LocText>(LOCALES.en);
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
const ATT1 = handPath(
  inBox(BOX[1], [[0.26, 0.31], [0.4, 0.2], [0.58, 0.19], [0.71, 0.27], [0.72, 0.38], [0.62, 0.47], [0.45, 0.5], [0.37, 0.56], [0.3, 0.66], [0.27, 0.77], [0.45, 0.77], [0.62, 0.76], [0.78, 0.79]]),
  { seed: 'att1', jitter: 6 },
);
const ATT2 = handPath(inBox(BOX[2], [[0.24, 0.23], [0.76, 0.25], [0.27, 0.5], [0.73, 0.5], [0.25, 0.77], [0.79, 0.76]]), { sharp: true, seed: 'att2', jitter: 5 });
const ATT3 = handPath(
  inBox(BOX[3], [[0.2, 0.26], [0.33, 0.2], [0.46, 0.27], [0.59, 0.2], [0.71, 0.25], [0.78, 0.33], [0.71, 0.42], [0.58, 0.47], [0.46, 0.41], [0.34, 0.48], [0.25, 0.53], [0.23, 0.62], [0.32, 0.69], [0.44, 0.75], [0.56, 0.68], [0.68, 0.75], [0.79, 0.71]]),
  { seed: 'att3', jitter: 5 },
);
// 뱀 혀와 눈(이름표가 뜬 뒤 조금 늦게)
const SNAKE_END = inBox(BOX[3], [[0.79, 0.71]])[0];
const TONGUE = (() => {
  const [x, y] = SNAKE_END;
  return `M ${x + 6} ${y} L ${x + 34} ${y - 4} M ${x + 34} ${y - 4} L ${x + 46} ${y - 14} M ${x + 34} ${y - 4} L ${x + 47} ${y + 4}`;
})();
const SNAKE_EYE = inBox(BOX[3], [[0.745, 0.665]])[0];

const STROKES = [
  handPath(inBox(BIG, [[0.22, 0.21], [0.78, 0.21], [0.78, 0.49]]), { sharp: true, seed: 'st1', jitter: 2.5 }),
  handPath(inBox(BIG, [[0.22, 0.49], [0.78, 0.49]]), { sharp: true, seed: 'st2', jitter: 2.5 }),
  handPath(inBox(BIG, [[0.22, 0.49], [0.22, 0.79], [0.81, 0.79]]), { sharp: true, seed: 'st3', jitter: 2.5 }),
];
const BADGES: Pt[] = inBox(BIG, [[0.11, 0.21], [0.11, 0.49], [0.11, 0.66]]);
const STROKE_T = [T.st1, T.st2, T.st3];

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

const Stroke: React.FC<{ d: string; p: number; width: number; color?: string; opacity?: number }> = ({ d, p, width, color = C.graphite, opacity = 0.92 }) => {
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
      filter="url(#graphite)"
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

// ── 이름표(「a 2?」) ────────────────────────────────────────────────
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
        bottom: 1920 - (box.y + box.s) - 30, // 칸 아래 테두리에 걸쳐 — 칸 안 글씨를 가리지 않고, 표지 아래 앱 글자 자리(1428px) 위에
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
  const draws: [string, readonly [number, number]][] = [
    [ATT1, T.att1], [ATT2, T.att2], [ATT3, T.att3],
  ];
  // 첫 장
  if (t < T.flip[0]) {
    for (let i = 0; i < draws.length; i += 1) {
      const [d, w] = draws[i];
      if (t <= w[1]) {
        if (t >= w[0]) return { tip: at(d, prog(f, w)), down: 1, show: true };
        const prev = draws[i - 1];
        return { tip: move(endOf(prev[0]), startOf(d), [prev[1][1] + 0.1, w[0]]), down: 0, show: true };
      }
    }
    return { tip: move(endOf(ATT3), OFF, T.pencilOut), down: 0, show: t < T.pencilOut[1] };
  }
  // 둘째 장
  if (t < T.st1[0]) return { tip: move(OFF, startOf(STROKES[0]), T.pencilIn), down: 0, show: t > T.pencilIn[0] };
  for (let i = 0; i < 3; i += 1) {
    const w = STROKE_T[i];
    if (t <= w[1]) {
      if (t >= w[0]) return { tip: at(STROKES[i], prog(f, w)), down: 1, show: true };
      return { tip: move(endOf(STROKES[i - 1]), startOf(STROKES[i]), [STROKE_T[i - 1][1] + 0.05, w[0]]), down: 0, show: true };
    }
  }
  return { tip: move(endOf(STROKES[2]), OFF, T.pencilAway), down: 0, show: t < T.pencilAway[1] };
};

const Pencil: React.FC = () => {
  const f = useCurrentFrame();
  const { tip, down, show } = usePencil(f);
  // 닿았다 떨어지는 것을 그림자로(위에서 내려다보는 구도): 들면 그림자가 멀어지고 연필이 조금 커진다
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
const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; instant?: boolean }> = ({ at: t, children, style, instant }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = instant ? 1 : spring({ frame: f - fr(t), fps, config: { damping: 16, stiffness: 170, mass: 0.7 } });
  if (!instant && f < fr(t)) return null;
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
// 판 글 속 「ㄹ」만 한글 서체로
// 판 글 속 「\n」은 줄바꿈 — 한 글자만 다음 줄로 넘어가지 않게 줄은 글에서 직접 나눈다
const withHangul = (s: string) =>
  s.split('\n').flatMap((line, n) => [
    ...(n ? [<br key={`b${n}`} />] : []),
    ...line.split('ㄹ').flatMap((part, i) => (i ? [<span key={`h${n}-${i}`} style={HANGUL_IN_EN}>ㄹ</span>, part] : [part])),
  ]);
const HANGUL_IN_EN: React.CSSProperties = { fontFamily: KO, fontWeight: 800, fontSize: '1.18em', lineHeight: 0.9 };

const Titles: React.FC = () => {
  const L = useLoc();
  const big: React.CSSProperties = { ...BIG_TXT, fontSize: L.size.big, lineHeight: L.size.lineHeight, letterSpacing: L.voice ? -1 : 0 };
  const f = useCurrentFrame();
  const t = f / 30;
  const fade = (a: number, b: number) => interpolate(t, [a, a + 0.12, b - 0.12, b], [0, 1, 1, 0], clamp);
  if (t < T.flip[0] + 0.1) {
    return (
      <TitleZone top={290} height={260} opacity={interpolate(t, [T.flip[0] - 0.1, T.flip[0] + 0.1], [1, 0], clamp)}>
        <div style={big}>
          {L.title.map((line, i) => (
            <React.Fragment key={i}>
              {i ? <br /> : L.kicker ? <Kicker>{L.kicker}</Kicker> : null}
              {withHangul(line)}
            </React.Fragment>
          ))}
        </div>
        <div style={{ fontFamily: EN, fontWeight: L.voice ? 600 : 800, fontSize: L.size.sub, lineHeight: L.voice ? undefined : 1.4, color: C.coralShade, marginTop: 14 }}>
          {L.sub.split('{rieul}').flatMap((part, i) => (i ? [<span key={i} style={{ fontFamily: MONO, fontWeight: 500 }}>rieul</span>, ...withHangul(part)] : withHangul(part)))}
        </div>
      </TitleZone>
    );
  }
  if (t < T.k1) {
    return (
      <TitleZone opacity={fade(T.f1, T.k1)}>
        <div style={{ ...big, fontSize: L.size.fix }}>
          <Pop at={T.f1 + 0.04}>{L.fix[0]}</Pop>
          <br />
          <Pop at={T.f1 + 0.99} style={{ color: C.coralShade }}>{L.fix[1]}</Pop>
        </div>
      </TitleZone>
    );
  }
  if (t < T.end) {
    return (
      <TitleZone opacity={fade(T.k1 - 0.05, T.end)}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 28 }}>
          <Pop at={T.k1}><span style={{ ...HANGUL_IN_EN, fontSize: 150, color: C.brown, lineHeight: 1 }}>ㄹ</span></Pop>
          <Pop at={T.k1 + 0.08}><span style={{ fontFamily: MONO, fontSize: 70, color: C.coralShade }}>rieul</span></Pop>
        </div>
        {L.nameLine ? (
          <Pop at={T.k1 + 0.2} style={{ fontFamily: EN, fontWeight: 800, fontSize: 52, color: C.brown, marginTop: 10 }}>
            {L.nameLine.split('{name}').flatMap((part, i) => (i ? [<span key={i} style={{ fontFamily: KO, fontWeight: 800 }}>리을</span>, part] : [part]))}
          </Pop>
        ) : null}
      </TitleZone>
    );
  }
  return (
    <TitleZone opacity={interpolate(t, [T.end, T.end + 0.12], [0, 1], clamp)}>
      <div style={big}>
        <Pop at={T.end} style={{ fontSize: L.size.end ?? undefined }}>{withHangul(L.end[0])}</Pop>
        <br />
        <Pop at={L.voice ? T.e1 + 1.15 : T.end + 0.2} style={{ color: C.coralShade, fontSize: L.size.endSub }}>
          {withHangul(L.end[1])}<span style={{ fontFamily: "'Segoe UI Emoji', 'Noto Color Emoji', sans-serif", fontWeight: 400, display: 'inline-block', transform: L.voice ? undefined : `translateY(${Math.sin((f / 30 - T.end) * 5) * 10}px)` }}>👇</span>
        </Pop>
      </div>
    </TitleZone>
  );
};

// ── 첫 장 ─────────────────────────────────────────────────────────
const PageOne: React.FC = () => {
  const L = useLoc();
  const f = useCurrentFrame();
  const tongue = interpolate(f, [fr(T.tag3 + 0.02), fr(T.tag3 + 0.27)], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <PencilDefs />
        {BOX.map((b, i) => (
          <GridBox key={i} box={b} />
        ))}
        {/* 본 글자(따라 쓰기 공책의 회색 본) */}
        <text x={BOX[0].x + S / 2} y={BOX[0].y + S * 0.5} textAnchor="middle" dominantBaseline="central" fontFamily="SUIT" fontWeight={500} fontSize={S * 0.74} fill="#3C3230" opacity={0.26}>
          ㄹ
        </text>
        <Stroke d={ATT1} p={prog(f, T.att1)} width={19} />
        <Stroke d={ATT2} p={prog(f, T.att2)} width={19} />
        <Stroke d={ATT3} p={prog(f, T.att3)} width={19} />
        {tongue > 0 ? (
          <>
            <path d={TONGUE} fill="none" stroke={C.red} strokeWidth={6} strokeLinecap="round" opacity={0.9} strokeDasharray={evolvePath(tongue, TONGUE).strokeDasharray} strokeDashoffset={evolvePath(tongue, TONGUE).strokeDashoffset} filter="url(#redpen)" />
            <circle cx={SNAKE_EYE[0]} cy={SNAKE_EYE[1]} r={7 * tongue} fill={C.graphite} />
          </>
        ) : null}
        {L.voice ? null : (
          <>
            <Cross box={BOX[1]} at={T.tag1 + 0.16} />
            <Cross box={BOX[2]} at={T.tag2 + 0.12} />
            <Cross box={BOX[3]} at={T.tag3 + 0.17} />
          </>
        )}
      </svg>
      <Tag text={L.tags.copy} at={-1} box={BOX[0]} plain />
      <Tag text={L.tags.a1} at={T.tag1} box={BOX[1]} />
      <Tag text={L.tags.a2} at={T.tag2} box={BOX[2]} />
      <Tag text={L.tags.a3} at={T.tag3} box={BOX[3]} />
    </AbsoluteFill>
  );
};

// 틀린 칸의 빨간 펜 ✗(목소리가 없는 판 — 「That's a two.」 같은 말 대신 틀렸다는 것을 보인다, 10-25 첫 렌더 이해 시험)
const Cross: React.FC<{ box: { x: number; y: number; s: number }; at: number }> = ({ box, at: t }) => {
  const f = useCurrentFrame();
  const x = box.x + box.s - 74;
  const y = box.y + 30;
  const a = `M ${x} ${y} L ${x + 46} ${y + 46}`;
  const b = `M ${x + 46} ${y} L ${x} ${y + 46}`;
  const p1 = interpolate(f, [fr(t), fr(t + 0.12)], [0, 1], clamp);
  const p2 = interpolate(f, [fr(t + 0.12), fr(t + 0.24)], [0, 1], clamp);
  if (p1 <= 0) return null;
  const ev = (p: number, d: string) => evolvePath(p, d);
  return (
    <g filter="url(#redpen)">
      <path d={a} fill="none" stroke={C.red} strokeWidth={8} strokeLinecap="round" strokeDasharray={ev(p1, a).strokeDasharray} strokeDashoffset={ev(p1, a).strokeDashoffset} />
      {p2 > 0 ? <path d={b} fill="none" stroke={C.red} strokeWidth={8} strokeLinecap="round" strokeDasharray={ev(p2, b).strokeDasharray} strokeDashoffset={ev(p2, b).strokeDashoffset} /> : null}
    </g>
  );
};

// ── 둘째 장 ───────────────────────────────────────────────────────
const GUIDE_AT = T.flip[1] + 0.05; // 쪽을 넘기자마자 — 빈 칸으로 2초를 두지 않는다(v2 이해 시험)
const RECAP = [0, 1, 2].map((i) => T.explode[1] + 0.3 + i * 0.32); // 벌린 채로 1 · 2 · 3을 한 번 더 짚는다
const Badge: React.FC<{ n: number; p: Pt; at: number; active: readonly [number, number]; dy: number; recap: number }> = ({ n, p, at: t, active, dy, recap }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: f - fr(t), fps, config: { damping: 12, stiffness: 200, mass: 0.6 } });
  // 그 획을 긋는 동안 번호가 살짝 커진다
  const on = spring({ frame: f - fr(active[0]), fps, config: { damping: 14, stiffness: 220 } }) - spring({ frame: f - fr(active[1] + 0.1), fps, config: { damping: 14, stiffness: 220 } });
  const bump = spring({ frame: f - fr(recap), fps, config: { damping: 10, stiffness: 260 } }) - spring({ frame: f - fr(recap + 0.2), fps, config: { damping: 12, stiffness: 220 } });
  if (f < fr(t)) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: p[0] - 36,
        top: p[1] - 36 + dy,
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
        transform: `scale(${sp * (1 + 0.22 * on + 0.35 * bump)})`,
        boxShadow: '0 4px 10px rgba(80,30,20,0.18)',
      }}
    >
      {n}
    </div>
  );
};

/** 칸 아래 「ㄱ + ― + ㄴ」 — 그 획을 긋는 동안 코랄로. */
const Formula: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const active = (i: number) => (t >= STROKE_T[i][0] && t < STROKE_T[i][1] + 0.25) || (t >= RECAP[i] && t < RECAP[i] + 0.32);
  const seen = (i: number) => t >= STROKE_T[i][0];
  const piece = (i: number, node: React.ReactNode) => (
    <Pop at={STROKE_T[i][0]}>
      <span style={{ color: active(i) ? C.coral : C.brown, display: 'inline-flex', alignItems: 'center', height: 120 }}>{node}</span>
    </Pop>
  );
  const plus = (i: number) => (seen(i) ? <span style={{ color: C.brown, opacity: 0.5, margin: '0 20px' }}>+</span> : null);
  return (
    <div style={{ position: 'absolute', left: 100, width: 820, top: BIG.y + BIG.s + 40, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: KO, fontWeight: 800, fontSize: 108, lineHeight: 1 }}>
      {piece(0, 'ㄱ')}
      {plus(1)}
      {piece(1, <span style={{ display: 'inline-block', width: 100, height: 16, borderRadius: 8, background: 'currentColor' }} />)}
      {plus(2)}
      {piece(2, 'ㄴ')}
      {t >= T.explode[0] ? (
        <Pop at={T.explode[0]}>
          <span style={{ color: C.brown, opacity: 0.5, margin: '0 20px' }}>=</span>
          <span style={{ color: C.coralShade }}>ㄹ</span>
        </Pop>
      ) : null}
    </div>
  );
};

// 분해 장면: 다 그은 뒤 ㄱ은 위로, ㄴ은 아래로 벌렸다가 다시 붙인다 — 세 획이 각각 무엇인지 보이게(v2 이해 시험)
const DY = [-64, 0, 64];
const PageTwo: React.FC = () => {
  const L = useLoc();
  const f = useCurrentFrame();
  const snap = interpolate(f, [fr(T.snap[0]), fr(T.snap[1])], [0, 1], { ...clamp, easing: EASE_IO });
  // 벌린 채 멈춰 있지 않게, 다시 붙이기 전까지 조금씩 더 벌어진다
  const drift = 0.3 * interpolate(f, [fr(T.explode[1]), fr(T.snap[0])], [0, 1], clamp);
  const ex = (interpolate(f, [fr(T.explode[0]), fr(T.explode[1])], [0, 1], { ...clamp, easing: EASE }) + drift) * (1 - snap);
  const grade = interpolate(f, [fr(T.grade[0]), fr(T.grade[1])], [0, 1], { ...clamp, easing: EASE });
  const ring = `M 868 668 C 930 676 936 772 866 790 C 800 806 742 770 748 722 C 754 676 820 650 880 676`;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <PencilDefs />
        <GridBox box={BIG} w={4} />
        {STROKES.map((d, i) => {
          // 획순 길잡이(따라 쓰기 공책의 연한 본) — 쪽을 넘기자마자 하나씩, 그 획을 다 그으면 걷힌다
          const g = interpolate(f, [fr(GUIDE_AT + i * 0.22), fr(GUIDE_AT + i * 0.22 + 0.35)], [0, 1], { ...clamp, easing: EASE });
          const gone = interpolate(f, [fr(STROKE_T[i][1]), fr(STROKE_T[i][1] + 0.2)], [1, 0], clamp);
          if (g <= 0 || gone <= 0) return null;
          const ev = evolvePath(g, d);
          return <path key={`g${i}`} d={d} fill="none" stroke={C.coral} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" opacity={0.32 * gone} strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />;
        })}
        {STROKES.map((d, i) => (
          <g key={i} transform={`translate(0 ${DY[i] * ex})`}>
            <Stroke d={d} p={prog(f, STROKE_T[i])} width={32} />
          </g>
        ))}
        {grade > 0 && L.grade !== false ? <path d={ring} fill="none" stroke={C.red} strokeWidth={7} strokeLinecap="round" filter="url(#redpen)" strokeDasharray={evolvePath(grade, ring).strokeDasharray} strokeDashoffset={evolvePath(grade, ring).strokeDashoffset} /> : null}
      </svg>
      {BADGES.map((p, i) => (
        <Badge key={i} n={i + 1} p={p} at={GUIDE_AT + i * 0.22} active={STROKE_T[i]} dy={DY[i] * ex} recap={RECAP[i]} />
      ))}
      {f >= fr(T.grade[0] + 0.15) && L.grade !== false ? (
        <div style={{ position: 'absolute', left: 760, top: 694, width: 150, textAlign: 'center', transform: `rotate(-8deg) scale(${interpolate(f, [fr(T.grade[0] + 0.15), fr(T.grade[0] + 0.45)], [0.2, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) })})`, fontFamily: EN, fontWeight: 800, fontSize: 52, color: C.red, opacity: interpolate(f, [fr(T.grade[0] + 0.15), fr(T.grade[0] + 0.3)], [0, 1], clamp) }}>?/10</div>
      ) : null}
      <Formula />
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
const Sfx: React.FC<{ file: string; at: number; vol: number; from?: number; dur?: number }> = ({ file, at: t, vol, from = 0, dur }) => (
  <Sequence from={Math.max(0, fr(t))} durationInFrames={dur ? fr(dur) : undefined} layout="none">
    <Audio
      src={staticFile(`sfx/${file}`)}
      startFrom={fr(from) + (t < 0 ? fr(-t) : 0)}
      volume={(i) => vol * MASTER * (dur ? interpolate(i, [0, 2, fr(dur) - 5, fr(dur)], [0, 1, 1, 0], clamp) : 1)}
    />
  </Sequence>
);

const Sound: React.FC = () => {
  const L = useLoc();
  return (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => L.bgm * MASTER * interpolate(i, [fr(T.total) - 30, fr(T.total)], [1, 0], clamp)} />
    {/* 영어 진행 목소리는 영어판에만(제작 방식 v2 §4-3). 「리을.」 한국어 한 줄은 모든 판 */}
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
      </>
    ) : null}
    <Vo id="k1b" at={T.k1} />
    {L.voice ? <Vo id="e1" at={T.e1} /> : null}
    {/* 연필 — 실제 녹음(Fairlight) 조각, 획마다 다른 자리 */}
    <Sfx file="pencil_a.wav" at={T.att1[0]} from={0.6} dur={T.att1[1] - T.att1[0]} vol={0.5} />
    <Sfx file="pencil_a.wav" at={T.att2[0]} from={2.4} dur={T.att2[1] - T.att2[0]} vol={0.5} />
    <Sfx file="pencil_b.wav" at={T.att3[0]} from={0.2} dur={T.att3[1] - T.att3[0]} vol={0.5} />
    <Sfx file="pencil_b.wav" at={T.st1[0]} from={1.5} dur={T.st1[1] - T.st1[0]} vol={0.55} />
    <Sfx file="pencil_a.wav" at={T.st2[0]} from={4.2} dur={T.st2[1] - T.st2[0]} vol={0.55} />
    <Sfx file="pencil_b.wav" at={T.st3[0]} from={0.6} dur={T.st3[1] - T.st3[0]} vol={0.55} />
    {L.grade !== false ? <Sfx file="pencil_b.wav" at={T.grade[0]} from={2.2} dur={T.grade[1] - T.grade[0]} vol={0.35} /> : null}
    {/* 이름표 · 쪽 넘김 · 번호 */}
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

export const Film: React.FC<{ loc?: Loc }> = ({ loc = 'en' }) => {
  const f = useCurrentFrame();
  const flipped = f >= fr(T.flip[0]);
  const L = LOCALES[loc];
  // 목소리 없는 판의 끝 화면은 천천히 다가간다(끝까지 완전히 멈춘 화면이 되지 않게)
  const push = L.voice ? 1 : interpolate(f, [fr(T.end), fr(T.total)], [1, 1.035], clamp);
  return (
    <LocCtx.Provider value={L}>
    <AbsoluteFill style={{ backgroundColor: '#E9DCC4', transform: push === 1 ? undefined : `scale(${push})`, ...(L.font ? ({ '--kids-font': L.font } as React.CSSProperties) : {}) }}>
      <Img src={staticFile('img/notebook.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
      {flipped ? <PageTwo /> : <PageOne />}
      {flipped ? (
        <FlipSheet>
          <PageOne />
        </FlipSheet>
      ) : null}
      <Pencil />
      <Titles />
      <Sound />
    </AbsoluteFill>
    </LocCtx.Provider>
  );
};
