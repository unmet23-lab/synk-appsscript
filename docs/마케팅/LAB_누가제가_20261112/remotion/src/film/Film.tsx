// LAB E41 「누가?」엔 「제가!」 — 공책 위 시험지 손글씨 POV(원본 E5 「처음 쓰는 ㄹ」 1:1, E29 「처음 쓰는 ㅈ」 코드를 고쳐 씀). 전부 useCurrentFrame()으로만 움직인다.
// 첫 장: 1번 「뭐 먹었어요?」 → 「저는 피자 먹었어요.」 ✓ → 2번 「누가 피자 먹었어요?」에 같은 답을 베낌 → ✗ → 「저는」에 동그라미.
// 쪽 넘김 뒤: 2번만 크게 — 「누가」 = WHO? → 「제가 피자 먹었어요.」 → 「제가」 = it was ME → ✓ → 첫 장 꼴로 돌아와 두 답 ✓ ✓ → 끝: 「누가 피자 먹었어요?」 「제가요...」.
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths';
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO, PEN } from '../lib/fonts';
import { handPath, Pt, ringPts } from './geo';
import { LOCALES, Loc, LocText } from './locale';
import { fr, T } from './timeline';

const LocCtx = React.createContext<LocText>(LOCALES.en);
const useLoc = () => React.useContext(LocCtx);

const C = {
  coral: '#F96859',
  coralShade: '#AE322A',
  brown: '#2B1A14',
  graphite: '#34343A',
  print: '#2A2522',
  gloss: '#8A7D73',
  rule: '#E3B7AE',
  red: '#D33A2C',
};
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

// 쪽(배경 사진 안 오른쪽 쪽) — notebook.jpg 1080×1920 기준
const PAGE = { x: 56, y: 132, w: 982, h: 1621 };

// ── 손글씨 줄(나눔손글씨 펜) ───────────────────────────────────────
// 글자 폭(em) — NanumPenScript-Regular.ttf hmtx에서 읽은 값(11-12). 없는 글자는 0.62.
const ADV: Record<string, number> = { '(': 0.31, ')': 0.28, m: 0.621, e: 0.351, 저: 0.655, 는: 0.42, 피: 0.62, 자: 0.624, 먹: 0.694, 었: 0.599, 어: 0.538, 요: 0.479, 제: 0.7, 가: 0.665, '.': 0.199, ' ': 0.28 };
const adv = (c: string) => ADV[c] ?? 0.62;
type Line = { text: string; x: number; y: number; size: number; win: readonly [number, number] };
type Glyph = { c: string; x: number; w: number; win: [number, number] };
/** 글자마다 자리와 쓰는 시간 — 시간은 글자 폭에 비례, 띄어쓰기는 연필을 옮기는 짧은 틈. */
const glyphs = (l: Line): Glyph[] => {
  const cs = [...l.text];
  const weight = (c: string) => (c === ' ' ? adv(c) * 0.5 : c === '.' ? 0.35 : adv(c));
  const W = cs.reduce((s, c) => s + weight(c), 0);
  let x = l.x;
  let t = l.win[0];
  return cs.map((c) => {
    const w = adv(c) * l.size;
    const d = ((l.win[1] - l.win[0]) * weight(c)) / W;
    const g: Glyph = { c, x, w, win: [t, t + d] };
    x += w;
    t += d;
    return g;
  });
};
const lineEnd = (l: Line) => l.x + [...l.text].reduce((s, c) => s + adv(c), 0) * l.size;
/** 글자 k를 p만큼 쓴 때 연필 끝 자리 — 글자 칸 안에서 위아래로 획을 긋듯 오간다. */
const tipIn = (l: Line, g: Glyph, k: number, p: number): Pt => [g.x + p * g.w * 0.92, l.y - l.size * 0.4 + Math.sin(p * Math.PI * 3.2 + k * 1.3) * l.size * 0.22];

const A1: Line = { text: '저는 피자 먹었어요.', x: 150, y: 830, size: 128, win: T.a1Write };
const A2: Line = { text: '저는 피자 먹었어요.', x: 150, y: 1210, size: 128, win: T.a2Write };
// 둘째 장 — 「저는」을 쓰고 긋고, 그 뒤에 「제가 피자 먹었어요.」(이해 시험 v1 셋이 「저는이 왜 틀린지 모름」)
const P2 = { x: 105, y: 1090, size: 120 };
const JEO: Line = { text: '저는', x: P2.x, y: P2.y, size: P2.size, win: T.jeoWrite };
const FIX_X = P2.x + (0.655 + 0.42 + 0.28) * P2.size; // 「저는 」 뒤
const F1: Line = { text: '제가', x: FIX_X, y: P2.y, size: P2.size, win: T.jegaWrite };
const F2: Line = { text: '피자 먹었어요.', x: FIX_X + (0.7 + 0.665 + 0.28) * P2.size, y: P2.y, size: P2.size, win: T.restWrite };
const STRIKE = handPath([[P2.x - 10, P2.y - 44], [P2.x + 64, P2.y - 52], [P2.x + 140, P2.y - 42]], { seed: 'st', jitter: 3 });
// 끝 — 시험지 아래 크게 「제가요...」(볼 이유 v1 「펀치라인이 화면에서 가장 작다」)
const ENDL: Line = { text: '제가...', x: 140, y: 1405, size: 150, win: T.endWrite };
const ENDG: Line = { text: '(me...)', x: 140 + (0.7 + 0.665 + 0.597) * 150 + 24, y: 1400, size: 86, win: T.glossWrite };

const HandLine: React.FC<{ l: Line; id: string; color?: string; done?: boolean }> = ({ l, id, color = C.graphite, done }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const gs = glyphs(l);
  return (
    <g filter="url(#graphite)">
      {gs.map((g, k) => {
        if (g.c === ' ') return null;
        const p = done ? 1 : interpolate(t, g.win, [0, 1], clamp);
        if (p <= 0) return null;
        const cid = `${id}-${k}`;
        return (
          <g key={k}>
            <defs>
              <clipPath id={cid}>
                <rect x={g.x - l.size * 0.06} y={l.y - l.size * 1.05} width={p >= 1 ? g.w + l.size * 0.3 : p * g.w + l.size * 0.06} height={l.size * 1.4} />
              </clipPath>
            </defs>
            <text x={g.x} y={l.y} fontFamily={PEN} fontSize={l.size} fill={color} opacity={0.93} clipPath={`url(#${cid})`}>
              {g.c}
            </text>
          </g>
        );
      })}
    </g>
  );
};

// ── 연필 자국 · 빨간 펜 ───────────────────────────────────────────
const PencilDefs: React.FC = () => (
  <defs>
    <filter id="graphite" filterUnits="userSpaceOnUse" x="-200" y="-200" width="1480" height="2320">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="rough" />
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.36" result="grain" />
      <feComposite in="rough" in2="grain" operator="in" />
    </filter>
    <filter id="redpen" filterUnits="userSpaceOnUse" x="-200" y="-200" width="1480" height="2320">
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="3" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="print" filterUnits="userSpaceOnUse" x="-200" y="-200" width="1480" height="2320">
      <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" seed="5" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="0.9" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
);

const Stroke: React.FC<{ d: string; p: number; width: number; color?: string; opacity?: number; filter?: string }> = ({ d, p, width, color = C.graphite, opacity = 0.92, filter = 'url(#graphite)' }) => {
  if (p <= 0) return null;
  const ev = evolvePath(Math.min(1, p), d);
  return (
    <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} opacity={opacity} filter={filter} />
  );
};
const Red: React.FC<{ d: string; p: number; width?: number; opacity?: number }> = ({ d, p, width = 14, opacity = 0.95 }) => (p <= 0 ? null : <Stroke d={d} p={p} width={width} color={C.red} opacity={opacity} filter="url(#redpen)" />);

/** 초 구간 [a,b]에서 0→1(획 긋는 속도: 처음과 끝만 조금 느리게). */
const prog = (f: number, [a, b]: readonly [number, number]) => interpolate(f, [fr(a), fr(b)], [0, 1], { ...clamp, easing: Easing.bezier(0.35, 0.05, 0.4, 1) });

const checkPath = (cx: number, cy: number, w: number) => `M ${cx - 0.3 * w} ${cy + 0.02 * w} L ${cx - 0.08 * w} ${cy + 0.25 * w} L ${cx + 0.34 * w} ${cy - 0.3 * w}`;
const crossPaths = (cx: number, cy: number, w: number): string[] => [
  handPath([[cx - 0.42 * w, cy - 0.4 * w], [cx + 0.44 * w, cy + 0.42 * w]], { sharp: true, seed: 'cx1', jitter: 4 }),
  handPath([[cx + 0.4 * w, cy - 0.44 * w], [cx - 0.42 * w, cy + 0.4 * w]], { sharp: true, seed: 'cx2', jitter: 4 }),
];
const ellipse = (cx: number, cy: number, rx: number, ry: number, seed: string) => handPath(ringPts(cx, cy, 1, { sx: rx, sy: ry, n: 14, over: 0.1 }), { seed, jitter: 3 });

// 빨간 펜으로 써지는 손글씨(왼쪽부터 드러난다)
const RedHand: React.FC<{ text: string; x: number; y: number; size: number; win: readonly [number, number]; rot?: number; anchor?: 'start' | 'middle'; w: number; id: string }> = ({ text, x, y, size, win, rot = -4, anchor = 'start', w, id }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [fr(win[0]), fr(win[1])], [0, 1], { ...clamp, easing: Easing.bezier(0.3, 0.1, 0.5, 1) });
  if (p <= 0) return null;
  const x0 = anchor === 'middle' ? x - w / 2 : x;
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      <defs>
        <clipPath id={id}>
          <rect x={x0 - 20} y={y - size * 1.1} width={(w + 40) * p} height={size * 1.6} />
        </clipPath>
      </defs>
      <text x={x} y={y} textAnchor={anchor} fontFamily={PEN} fontSize={size} fill={C.red} filter="url(#redpen)" clipPath={`url(#${id})`}>
        {text}
      </text>
    </g>
  );
};

// ── 인쇄된 시험지 글(문제 · 뜻) ─────────────────────────────────────
const Printed: React.FC<{ x: number; y: number; size: number; children: React.ReactNode; weight?: number; color?: string; font?: string; opacity?: number }> = ({ x, y, size, children, weight = 700, color = C.print, font = KO, opacity = 0.92 }) => (
  <text x={x} y={y} fontFamily={font} fontWeight={weight} fontSize={size} fill={color} opacity={opacity} filter="url(#print)">
    {children}
  </text>
);
const RuleLine: React.FC<{ y: number; x1?: number; x2?: number }> = ({ y, x1 = 120, x2 = 960 }) => <line x1={x1} y1={y} x2={x2} y2={y} stroke={C.rule} strokeWidth={3} opacity={0.8} />;

// 첫 장 시험지 자리
const Q1 = { x: 120, y: 640 };
const Q2 = { x: 120, y: 1020 };
const MARK1 = { x: 912, y: 776, w: 150 }; // 1번 ✓
const MARK2 = { x: 905, y: 1152, w: 190 }; // 2번 ✗
const JN2 = { x: 150 + ((0.655 + 0.42) * 128) / 2, y: 1210 - 46 }; // 2번 답 「저는」 가운데
const MWO = { x: 120 + 62 * 0.746 + (62 * 0.874) / 2 + 8, y: 640 - 22 }; // 1번 문제 「뭐」 가운데(「1. 」 뒤)
const NUGA1 = { x: 120 + 62 * 0.993 + (62 * 1.748) / 2, y: 1020 - 22 }; // 2번 문제 「누가」 가운데

// ── 이름표 ────────────────────────────────────────────────────────
const Tag: React.FC<{ text: string; at: number; x: number; y: number; align: 'left' | 'right'; kind: 'good' | 'bad' | 'plain' }> = ({ text, at: t, x, y, align, kind }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLoc();
  const sp = spring({ frame: f - fr(t), fps, config: { damping: 13, stiffness: 190, mass: 0.7 } });
  if (f < fr(t)) return null;
  const pos: React.CSSProperties = align === 'right' ? { right: 1080 - x } : { left: x };
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        ...pos,
        transform: `rotate(-5deg) scale(${0.6 + 0.4 * sp})`,
        transformOrigin: align === 'right' ? 'right top' : 'left top',
        opacity: interpolate(sp, [0, 0.4], [0, 1], clamp),
        background: kind === 'bad' ? C.coral : '#FFFDF8',
        color: kind === 'good' ? C.red : C.brown,
        border: kind === 'good' ? `4px solid ${C.red}` : kind === 'plain' ? `4px solid ${C.coral}` : 'none',
        fontFamily: EN,
        fontWeight: 800,
        fontSize: L.size.tag,
        lineHeight: 1,
        padding: kind === 'bad' ? '14px 22px 16px' : '10px 18px 12px',
        borderRadius: 18,
        boxShadow: '0 6px 14px rgba(80,30,20,0.18)',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};

// ── 연필 ──────────────────────────────────────────────────────────
const OFF: Pt = [1250, 2150]; // 화면 오른쪽 아래 밖(손 전체가 나가는 자리)
// 연필이 하는 일 — 손글씨 줄 하나, 또는 낙서 획 하나
type Ev = { l: Line } | { d: string; win: readonly [number, number] };
const evWin = (e: Ev) => ('l' in e ? e.l.win : e.win);
const lineTip = (l: Line, t: number): Pt | null => {
  const gs = glyphs(l);
  for (let k = 0; k < gs.length; k += 1) {
    const g = gs[k];
    if (t <= g.win[1]) {
      if (g.c === ' ' || g.c === '.') {
        const p = interpolate(t, g.win, [0, 1], clamp);
        return [g.x + p * g.w, l.y - l.size * (g.c === '.' ? 0.05 : 0.35)];
      }
      return tipIn(l, g, k, interpolate(t, g.win, [0, 1], clamp));
    }
  }
  return null;
};
const pathPt = (d: string, p: number): Pt => {
  const q = getPointAtLength(d, getLength(d) * Math.min(1, Math.max(0, p)));
  return q ? [q.x, q.y] : [0, 0];
};
const startTip = (e: Ev): Pt => ('l' in e ? tipIn(e.l, glyphs(e.l)[0], 0, 0) : pathPt(e.d, 0));
const endTip = (e: Ev): Pt => ('l' in e ? [lineEnd(e.l), e.l.y - e.l.size * 0.05] : pathPt(e.d, 1));
const midTip = (e: Ev, t: number, f: number): Pt => ('l' in e ? lineTip(e.l, t) ?? endTip(e) : pathPt(e.d, prog(f, e.win)));

const usePencil = (f: number): { tip: Pt; down: number; show: boolean } => {
  const t = f / 30;
  const mv = (a: Pt, b: Pt, [s0, s1]: readonly [number, number]): Pt => {
    const p = interpolate(t, [s0, s1], [0, 1], { ...clamp, easing: EASE_IO });
    return [lerp(a[0], b[0], p), lerp(a[1], b[1], p)];
  };
  const seq = (evs: Ev[], inWin: readonly [number, number] | null, outWin: readonly [number, number]) => {
    if (inWin && t < evWin(evs[0])[0]) return { tip: mv(OFF, startTip(evs[0]), inWin), down: 0, show: t >= inWin[0] };
    for (let i = 0; i < evs.length; i += 1) {
      const w = evWin(evs[i]);
      if (t < w[0]) {
        const prev = evs[i - 1];
        const pw = evWin(prev);
        return { tip: mv(endTip(prev), startTip(evs[i]), [pw[1] + Math.min(0.05, (w[0] - pw[1]) * 0.2), w[0]]), down: 0, show: true };
      }
      if (t <= w[1]) return { tip: midTip(evs[i], t, f), down: 1, show: true };
    }
    return { tip: mv(endTip(evs[evs.length - 1]), OFF, outWin), down: 0, show: t < outWin[1] };
  };
  if (t >= T.pencilIn3[0]) return seq([{ l: ENDL }, { l: ENDG }], T.pencilIn3, T.pencilOut3);
  if (t >= T.pencilIn2[0]) return seq([{ l: JEO }, { d: STRIKE, win: T.strike }, { l: F1 }, { l: F2 }], T.pencilIn2, T.pencilOut2);
  return seq([{ l: A1 }, { l: A2 }], null, T.pencilOut);
};

// 연필을 쥔 손(장면 심사 v1 「손 없이 떠서 미끄러지는 연필」) — GPT 이미지 2.5로 구운 흰 바탕 손 사진의 바탕만 걷은 판(판/손_160157_2.png → img/hand.png).
// 공책 비율대로 크게 얹어 소매 끝이 늘 화면 밖에 있게 한다. 연필 끝이 그림 (4, 83) 칸.
const HAND = { w: 1214, h: 1250, tipX: 4, tipY: 83, s: 0.92 };
const Pencil: React.FC = () => {
  const f = useCurrentFrame();
  const { tip, down, show } = usePencil(f);
  const lift = interpolate(down, [0, 1], [1, 0]);
  // 쓰는 동안 손목이 아주 조금 돈다(획마다 같은 각도로 굳지 않게)
  const wob = down ? Math.sin(f * 0.9) * 0.8 : 0;
  if (!show) return null;
  const s = HAND.s;
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
        transform: `rotate(${wob}deg) scale(${1 + 0.03 * lift})`,
        filter: `drop-shadow(${10 + 18 * lift}px ${16 + 26 * lift}px ${14 + 10 * lift}px rgba(40,25,10,${0.26 - 0.08 * lift}))`,
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
const TitleZone: React.FC<{ children: React.ReactNode; opacity?: number; top?: number; height?: number }> = ({ children, opacity = 1, top = 280, height = 240 }) => (
  <div style={{ position: 'absolute', left: 90, width: 900, top, height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity }}>{children}</div>
);
const BIG_TXT: React.CSSProperties = { fontFamily: EN, fontWeight: 800, fontSize: 88, lineHeight: 1.06, color: C.brown, letterSpacing: -1 };
const HANGUL_IN_EN: React.CSSProperties = { fontFamily: KO, fontWeight: 800, fontSize: '1.08em', lineHeight: 0.9 };
// 판 글 속 한글만 한글 서체로
const withHangul = (s: string) => s.split(/([가-힣]+)/).map((part, i) => (/[가-힣]/.test(part) ? <span key={i} style={HANGUL_IN_EN}>{part}</span> : <React.Fragment key={i}>{part}</React.Fragment>));

const Titles: React.FC = () => {
  const L = useLoc();
  const f = useCurrentFrame();
  const t = f / 30;
  const big: React.CSSProperties = { ...BIG_TXT, fontSize: L.size.big, lineHeight: L.size.lineHeight };
  if (t < T.flip[0] + 0.1) {
    const out = Math.min(interpolate(t, [T.flip[0] - 0.1, T.flip[0] + 0.1], [1, 0], clamp), interpolate(t, [T.tag1 - 0.15, T.tag1 + 0.05], [1, 0], clamp));
    return (
      <TitleZone opacity={out}>
        <div style={big}>
          {L.title.map((line, i) => (
            <React.Fragment key={i}>
              {i ? <br /> : L.kicker ? <Kicker>{L.kicker}</Kicker> : null}
              {line}
            </React.Fragment>
          ))}
        </div>
      </TitleZone>
    );
  }
  // 둘째 장은 위 제목 없이 시험지와 말로만(볼 이유 v4 「제목 장과 정리 장이 같은 말을 되풀이」 — 12.6초 큰 제목을 뺐다)
  if (t < T.arrange[0]) return null;
  // 두 답 나란히부터 끝까지 — 규칙 두 줄(위 「What?」은 갈색, 아래 「Who?」는 빨강)
  return (
    <TitleZone opacity={interpolate(t, [T.arrange[0], T.arrange[0] + 0.12], [0, 1], clamp)}>
      <div style={{ ...big, fontSize: 92, lineHeight: 1.18 }}>
        <Pop at={T.arrange[0] + 0.02}>{withHangul(L.rule2[0])}</Pop>
        <br />
        <Pop at={T.arrange[0] + 0.14} style={{ color: C.red }}>{withHangul(L.rule2[1])}</Pop>
      </div>
    </TitleZone>
  );
};

// ── 첫 장(시험지) ─────────────────────────────────────────────────
// a1Done · showA2: 둘째 장 「두 답 나란히」에서 첫 장 꼴을 다시 쓸 때
const Sheet: React.FC<{ part: 'all' | 'top'; a2?: boolean; hands?: boolean }> = ({ part, a2 = true, hands = true }) => {
  const L = useLoc();
  const f = useCurrentFrame();
  return (
    <g>
      <Printed x={Q1.x} y={Q1.y} size={62}>1. 뭐 먹었어요?</Printed>
      <Printed x={Q1.x + 4} y={Q1.y + 54} size={36} weight={600} color={C.gloss} font={EN} opacity={1}>{L.q1Gloss}</Printed>
      <RuleLine y={A1.y + 16} />
      <HandLine l={A1} id="a1" />
      <Red d={checkPath(MARK1.x, MARK1.y, MARK1.w)} p={prog(f, T.check1)} width={18} />
      {part === 'all' ? (
        <>
          <Printed x={Q2.x} y={Q2.y} size={62}>2. 누가 피자 먹었어요?</Printed>
          <Printed x={Q2.x + 4} y={Q2.y + 54} size={36} weight={600} color={C.gloss} font={EN} opacity={1}>{L.q2Gloss}</Printed>
          <RuleLine y={A2.y + 16} />
          {a2 ? <HandLine l={A2} id="a2" /> : null}
          {crossPaths(MARK2.x, MARK2.y, MARK2.w).map((d, i) => (
            <Red key={i} d={d} p={interpolate(prog(f, T.cross), [i * 0.45, i * 0.45 + 0.55], [0, 1], clamp)} width={20} />
          ))}
          <Red d={ellipse(JN2.x, JN2.y, 92, 66, 'ring2')} p={prog(f, T.ring)} width={10} />
          <Red d={ellipse(NUGA1.x, NUGA1.y, 74, 46, 'ring3')} p={prog(f, T.nuga)} width={9} />
          {hands ? <RedHand text={L.whoHand} x={NUGA1.x - 70} y={NUGA1.y - 76} size={116} win={[T.whoTag1, T.whoTag1 + 0.22]} w={270} id="who1" rot={-6} /> : null}
        </>
      ) : null}
      {hands ? <g opacity={interpolate(f, [fr(T.whoTag1 - 0.2), fr(T.whoTag1 + 0.1)], [1, 0.28], clamp)}>
        <Red d={ellipse(MWO.x, MWO.y, 46, 44, 'ring1')} p={prog(f, T.what)} width={9} />
        <RedHand text={L.whatHand} x={MWO.x + 62} y={MWO.y - 60} size={116} win={[T.whatTag, T.whatTag + 0.3]} w={320} id="what1" rot={-6} />
      </g> : null}
    </g>
  );
};

const PageOne: React.FC<{ plain: boolean }> = ({ plain }) => {
  const L = useLoc();
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <PencilDefs />
        <Sheet part="all" />
      </svg>
      {plain ? null : (
        <>
          <Tag text={L.tags.same} at={T.tag1} x={110} y={1252} align="left" kind="bad" />
        </>
      )}
    </AbsoluteFill>
  );
};

// ── 둘째 장 ───────────────────────────────────────────────────────
const BQ = { x: 110, y: 760, size: 86 }; // 크게 다시 쓴 2번 문제
const NUGA_W = 1.748 * BQ.size; // 「누가」 폭(SUIT-Variable hmtx 1.748em)
const JEGA_W = (0.7 + 0.665) * P2.size;
const CHECK2 = { x: 935, y: 950, w: 140 };

const PageTwo: React.FC<{ plain: boolean }> = ({ plain }) => {
  const L = useLoc();
  const f = useCurrentFrame();
  const t = f / 30;
  const { fps } = useVideoConfig();
  const ar = interpolate(t, T.arrange, [0, 1], { ...clamp, easing: EASE_IO });
  const bump = t >= T.check2[0] ? spring({ frame: f - fr(T.check2[0]), fps, config: { damping: 9, stiffness: 260, mass: 0.6 } }) : 0;
  const bumpSc = 1 + 0.05 * Math.sin(Math.min(1, bump) * Math.PI);
  // 문제: 큰 자리(BQ, 78px) → 첫 장 2번 자리(Q2, 62px)
  const qs = lerp(1, 62 / BQ.size, ar);
  const qx = lerp(0, Q2.x - BQ.x * (62 / BQ.size), ar);
  const qy = lerp(0, Q2.y - BQ.y * (62 / BQ.size), ar);
  // 답: 둘째 장 자리(「제가」가 FIX_X, 120px) → 첫 장 2번 답 자리(A2, 128px)
  const k = A2.size / P2.size;
  const as = lerp(1, k, ar) * bumpSc;
  const ax = lerp(0, A2.x - FIX_X * k, ar);
  const ay = lerp(0, A2.y - P2.y * k, ar);
  const extra = 1 - interpolate(ar, [0, 0.5], [0, 1], clamp); // 밑줄 · WHO? · 네모 · ME는 나란히에서 걷힌다
  const top = interpolate(ar, [0.3, 1], [0, 1], clamp); // 1번 문제 · 답이 위에서 다시 나타난다
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <PencilDefs />
        {top > 0 ? (
          <g opacity={top} transform={`translate(0 ${(1 - top) * -40})`}>
            <Sheet part="top" hands={false} />
          </g>
        ) : null}
        <g transform={`translate(${qx} ${qy}) scale(${qs})`}>
          <Printed x={BQ.x} y={BQ.y} size={BQ.size}>{ar > 0.5 ? '2. ' : ''}누가 피자 먹었어요?</Printed>
          <Printed x={BQ.x + 4} y={BQ.y + 80} size={48} weight={600} color={C.gloss} font={EN} opacity={1}>{L.q2Gloss}</Printed>
          {extra > 0 ? (
            <g opacity={extra}>
              <Red d={handPath([[BQ.x - 6, BQ.y + 20], [BQ.x + NUGA_W * 0.5, BQ.y + 25], [BQ.x + NUGA_W + 8, BQ.y + 18]], { seed: 'ul', jitter: 2 })} p={prog(f, T.under)} width={12} />
              {plain ? null : <RedHand text={L.who} x={BQ.x} y={BQ.y - 108} size={140} win={[T.whoTag, T.whoTag + 0.35]} w={300} id="who" rot={-6} />}
            </g>
          ) : null}
        </g>
        {extra > 0 ? (
          <g opacity={extra}>
            <HandLine l={JEO} id="jeo" />
            <Stroke d={STRIKE} p={prog(f, T.strike)} width={9} color="#17171C" />
            {plain ? null : <RedHand text={L.asFor} x={P2.x - 6} y={P2.y - 124} size={104} win={T.asfor} w={460} id="asfor" rot={-4} />}
          </g>
        ) : null}
        {ar > 0 ? <RuleLine y={A2.y + 16} /> : null}
        <g transform={`translate(${ax} ${ay}) scale(${as})`} style={{ transformOrigin: '0 0' }}>
          <HandLine l={F1} id="f1" />
          <HandLine l={F2} id="f2" />
          {extra > 0 ? (
            <g opacity={extra}>
              <Red d={handPath([[F1.x - 14, P2.y - P2.size * 0.9], [F1.x + JEGA_W + 16, P2.y - P2.size * 0.92], [F1.x + JEGA_W + 12, P2.y + 22], [F1.x - 12, P2.y + 24], [F1.x - 14, P2.y - P2.size * 0.9]], { sharp: true, seed: 'box', jitter: 3 })} p={prog(f, T.box)} width={10} />
              {plain ? null : <RedHand text={L.me} x={F1.x - 4} y={P2.y + 128} size={108} win={[T.meTag, T.meTag + 0.45]} w={560} id="me" rot={-3} />}
            </g>
          ) : null}
        </g>
        {/* ✓ — 큰 자리에서 찍히고, 나란히에서는 첫 장 2번 ✗ 자리로 옮겨 간다 */}
        <Red d={checkPath(lerp(CHECK2.x, MARK2.x, ar), lerp(CHECK2.y, MARK2.y - 20, ar), lerp(CHECK2.w, MARK1.w, ar))} p={prog(f, T.check2)} width={lerp(22, 18, ar)} />
        {/* 끝 — 시험지 아래에 연필로 크게 「제가...」 + 작게 「(me...)」(옆에 먹다 남은 꼬투리) */}
        {t >= T.endWrite[0] ? <HandLine l={ENDL} id="endl" /> : null}
        {t >= T.glossWrite[0] ? <HandLine l={ENDG} id="endg" /> : null}
      </svg>
    </AbsoluteFill>
  );
};

// ── 먹다 남은 피자 꼬투리 ─────────────────────────────────────────
// 볼 이유 v1 「끝 「제가요…」가 웃음이 되려면 누가 피자를 먹었는지 따지는 상황이 앞에 있어야」 → 처음부터 시험지 아래에 둔다(GPT 이미지 2.5 · 판/꼬투리_161707.png의 바탕만 걷음).
// 쪽을 넘길 때 종이와 같이 들렸다가 새 쪽에 다시 내려앉는다.
// 볼 이유 v3 「피자가 장면마다 한 입씩 줄다가 끝에 꼬투리만 남게」 → 첫 장 한 입 먹은 조각 · 쪽 넘김 뒤 반쯤 먹은 조각 · 끝에 손이 덮는 동안 꼬투리
// (셋 다 GPT 이미지 2.5 — 판/조각_한입 · 조각_반은 꼬투리를 참고 그림으로 같은 피자로 구움). 「오려 붙인 그림 같다」 → 종이에 닿는 그늘을 깐다.
const CRUST = { x: 845, y: 1400, rot: 8 };
const PIZZA_STAGE = [
  { src: 'img/slice1.png', w: 380 },
  { src: 'img/slice2.png', w: 350 },
  { src: 'img/crust.png', w: 330 },
];
const Crust: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const p = interpolate(f, [fr(T.flip[0]), fr(T.flip[1])], [0, 1], clamp);
  const hop = Math.sin(Math.PI * p);
  const k = t < (T.flip[0] + T.flip[1]) / 2 ? 0 : t < T.endWrite[0] + 0.3 ? 1 : 2;
  const st = PIZZA_STAGE[k];
  return (
    <div
      style={{
        position: 'absolute',
        left: CRUST.x - 34 * hop,
        top: CRUST.y - 28 * hop,
        width: st.w,
        transform: `translate(-50%, -50%) rotate(${CRUST.rot + 7 * hop}deg)`,
      }}
    >
      <div style={{ position: 'absolute', left: '12%', top: '22%', width: '78%', height: '60%', borderRadius: '50%', background: `rgba(70,40,15,${0.28 - 0.12 * hop})`, filter: `blur(${16 + 10 * hop}px)`, transform: `translate(${10 + 14 * hop}px, ${14 + 20 * hop}px)` }} />
      <Img
        src={staticFile(st.src)}
        style={{
          position: 'relative',
          display: 'block',
          width: st.w,
          filter: `drop-shadow(${3 + 8 * hop}px ${5 + 12 * hop}px ${4 + 6 * hop}px rgba(40,25,10,${0.32 - 0.1 * hop}))`,
        }}
      />
    </div>
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
const fadeRange = (n: number) => { const b = Math.min(2, n * 0.25); const c = Math.max(b + 0.5, n - 5); return [0, b, c, Math.max(c + 0.5, n)]; };
const Sfx: React.FC<{ file: string; at: number; vol: number; from?: number; dur?: number }> = ({ file, at: t, vol, from = 0, dur }) => (
  <Sequence from={Math.max(0, fr(t))} durationInFrames={dur ? Math.max(1, fr(dur)) : undefined} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} startFrom={fr(from) + (t < 0 ? fr(-t) : 0)} volume={(i) => vol * MASTER * (dur ? interpolate(i, fadeRange(Math.max(1, fr(dur))), [0, 1, 1, 0], clamp) : 1)} />
  </Sequence>
);
/** 손글씨 줄을 쓰는 동안 연필 소리 — 띄어쓰기마다 끊는다(낱말마다 다른 녹음 자리). */
const WriteSfx: React.FC<{ l: Line; seed: number; vol?: number }> = ({ l, seed, vol = 0.5 }) => {
  const gs = glyphs(l);
  const words: [number, number][] = [];
  let cur: [number, number] | null = null;
  for (const g of gs) {
    if (g.c === ' ') {
      if (cur) words.push(cur);
      cur = null;
    } else cur = cur ? [cur[0], g.win[1]] : [g.win[0], g.win[1]];
  }
  if (cur) words.push(cur);
  return (
    <>
      {words.map(([a, b], i) => {
        const s = Math.max(0, a);
        if (b - s < 0.12) return null;
        return <Sfx key={i} file={(i + seed) % 2 ? 'pencil_b.wav' : 'pencil_a.wav'} at={s} from={[0.6, 2.4, 1.5, 3.1, 0.2, 4.2][(i + seed) % 6] + (a < 0 ? -a : 0)} dur={b - s} vol={vol} />;
      })}
    </>
  );
};

const Sound: React.FC<{ scene?: boolean }> = ({ scene }) => {
  const L = useLoc();
  const voice = L.voice && !scene;
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={(i) => L.bgm * MASTER * interpolate(i, [fr(T.total) - 30, fr(T.total)], [1, 0], clamp)} />
      {voice ? (
        <>
          <Vo id="h1" at={T.h1} />
          <Vo id="a3" at={T.a3} />
          <Vo id="r0" at={T.r0} />
          <Vo id="r1" at={T.r1} />
          <Vo id="k0" at={T.k0} />
          <Vo id="r3" at={T.r3} />
          <Vo id="k2" at={T.k2} />
          <Vo id="s1" at={T.s1} />
          <Vo id="k1" at={T.k1} />
          <Vo id="e1" at={T.e1} />
          <Vo id="e2" at={T.e2} />
        </>
      ) : null}
      <WriteSfx l={A2} seed={3} vol={0.55} />
      <Sfx file="stamp.wav" at={T.cross[0]} vol={0.6} />
      <Sfx file="thud.wav" at={T.cross[0] + 0.02} vol={0.45} />
      <Sfx file="pencil_b.wav" at={T.ring[0]} from={1.2} dur={T.ring[1] - T.ring[0]} vol={0.4} />
      <Sfx file="pop.wav" at={T.tag1} vol={0.3} />
      <Sfx file="pencil_a.wav" at={T.what[0]} from={1.4} dur={T.what[1] - T.what[0]} vol={0.38} />
      <Sfx file="pencil_b.wav" at={T.nuga[0]} from={0.5} dur={T.nuga[1] - T.nuga[0]} vol={0.38} />
      <Sfx file="page.wav" at={T.flip[0] - 0.05} vol={0.9} />
      <Sfx file="pencil_a.wav" at={T.under[0]} from={2.5} dur={T.under[1] - T.under[0]} vol={0.35} />
      <WriteSfx l={JEO} seed={1} vol={0.55} />
      <Sfx file="pencil_b.wav" at={T.strike[0]} from={2.2} dur={T.strike[1] - T.strike[0]} vol={0.6} />
      <WriteSfx l={F1} seed={2} vol={0.55} />
      <WriteSfx l={F2} seed={5} vol={0.55} />
      <Sfx file="pencil_b.wav" at={T.box[0]} from={0.9} dur={T.box[1] - T.box[0]} vol={0.35} />
      <Sfx file="tok.wav" at={T.check2[0]} vol={0.42} />
      <Sfx file="sparkle.wav" at={T.check2[0] + 0.1} vol={0.3} />
      <Sfx file="tok.wav" at={T.arrange[1] - 0.05} vol={0.3} />
      <WriteSfx l={ENDL} seed={4} vol={0.45} />
      <WriteSfx l={ENDG} seed={2} vol={0.38} />
    </>
  );
};

// 카메라 — 이름표가 뜨는 순간 그 자리로 다가간다(펀치 인)
type Cam = [number, number, number, number]; // 초 · 배율 · 중심 x · 중심 y
const CAM: Cam[] = [
  [0, 1.1, 560, 1000],
  [T.cross[0] - 0.02, 1.1, 560, 1000],
  [T.cross[0] + 0.12, 1.16, 580, 1110],
  [T.tag1 - 0.04, 1.16, 580, 1110],
  [T.tag1 + 0.16, 1.16, 570, 1150],
  [T.whatTag - 0.06, 1.16, 570, 1150],
  [T.whatTag + 0.14, 1.24, 560, 740],
  [T.whoTag1 - 0.06, 1.24, 560, 740],
  [T.whoTag1 + 0.14, 1.2, 600, 1080],
  [T.flip[0], 1.2, 600, 1080],
  [T.flip[1], 1.12, 540, 900],
  [T.jeoWrite[0], 1.12, 520, 960],
  [T.restWrite[1], 1.12, 560, 980],
  [T.check2[0] - 0.02, 1.12, 560, 980],
  [T.check2[0] + 0.18, 1.16, 560, 1000],
  [T.arrange[0], 1.16, 560, 1000],
  [T.arrange[1], 1, 540, 960],
  [T.e1 + 0.4, 1, 540, 960],
  [T.pencilIn3[0] + 0.3, 1.16, 560, 1480],
  [T.total, 1.19, 560, 1480],
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
  const [cs, cx, cy] = camAt(f);
  const cam = cs === 1 ? undefined : `translate(${(1 - cs) * cx}px, ${(1 - cs) * cy}px) scale(${cs})`;
  return (
    <LocCtx.Provider value={L}>
      <AbsoluteFill style={{ backgroundColor: '#E9DCC4', ...(L.font ? ({ '--kids-font': L.font } as React.CSSProperties) : {}) }}>
        <AbsoluteFill style={{ transformOrigin: '0 0', transform: cam }}>
          <Img src={staticFile('img/notebook.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
          {flipped ? <PageTwo plain={plain} /> : <PageOne plain={plain} />}
          {flipped ? (
            <FlipSheet>
              <PageOne plain />
            </FlipSheet>
          ) : null}
          <Crust />
          <Pencil />
          {/* 책상 스탠드 불빛 · 가장자리 그늘 — 사진처럼 깊이를 준다(E29 장면 심사 v2 「클립아트처럼 평평」) */}
          <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 55% at 30% 34%, rgba(255,226,170,0.34), rgba(255,226,170,0) 70%)', mixBlendMode: 'soft-light' }} />
          <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse 85% 75% at 46% 50%, rgba(0,0,0,0) 55%, rgba(45,28,12,0.32) 100%)', mixBlendMode: 'multiply' }} />
          {plain ? null : <Titles />}
        </AbsoluteFill>
        <Sound scene={scene} />
      </AbsoluteFill>
    </LocCtx.Provider>
  );
};
