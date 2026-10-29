// LAB E11 다시 살림 v4(10-30) 「haha → 하하」 — 줄 공책 위에 영어 haha를 쓰고 그 아래 한글 하하를 쓴다(원본 「Print vs. Cursive」의
// 한 낱말을 두 꼴로). 첫 ㅎ은 번호 1 · 2 · 3으로 한 획씩, 원본 20.1초 컷 자리(T.cut)에서 하하로 다가가 두 ㅎ이 모자 쓴 사람이 되어 웃는다.
// 전부 useCurrentFrame()으로만 움직인다.
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths';
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { handPath, inBox, Pt, ringPts } from '../film/geo';
import { fr, T } from './timeline4';

const C = {
  coral: '#F96859',
  coralShade: '#AE322A',
  brown: '#2B1A14',
  graphite: '#34343A',
  rule: '#8EA2B6',
  red: '#D33A2C',
};
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const ZOOM = 1.19;
const ZOOM_ORIGIN = '540px 880px';

// ── 줄 공책 ─────────────────────────────────────────────────────────
const RULE_Y = Array.from({ length: 11 }, (_, k) => 340 + 128 * k);

// ── 영어 haha(위 줄, 기준선 468) ──────────────────────────────────────
const EN_BASE = 468;
const EN_X0 = 392;
const ADV = 76;
const enLetter = (ch: 'h' | 'a', ox: number, k: number): string[] => {
  const b = EN_BASE;
  if (ch === 'h') {
    return [
      handPath([[ox, b - 128], [ox, b]], { sharp: true, seed: `eh${k}a`, jitter: 1.2 }),
      handPath([[ox, b - 44], [ox + 12, b - 60], [ox + 32, b - 65], [ox + 49, b - 54], [ox + 54, b - 32], [ox + 54, b]], { seed: `eh${k}b`, jitter: 1 }),
    ];
  }
  return [
    handPath([[ox + 50, b - 52], [ox + 36, b - 63], [ox + 18, b - 63], [ox + 5, b - 48], [ox + 2, b - 26], [ox + 10, b - 6], [ox + 27, b + 1], [ox + 43, b - 8], [ox + 51, b - 28]], { seed: `ea${k}a`, jitter: 1 }),
    handPath([[ox + 53, b - 64], [ox + 53, b - 6], [ox + 60, b + 1]], { seed: `ea${k}b`, jitter: 0.8 }),
  ];
};
const EN_LETTERS: string[][] = (['h', 'a', 'h', 'a'] as const).map((ch, i) => enLetter(ch, EN_X0 + ADV * i, i));
const EN_STROKES: string[] = EN_LETTERS.flat();
// 영어 줄 아래 화살표(연필) — 「이걸 한국어로?」를 머리 글 대신 그림으로(v4 haiku: 영어 질문 머리 글이 지난 편과 같다)
const ARROW = [
  handPath([[540, 500], [540, 572]], { sharp: true, seed: 'ar1', jitter: 1 }),
  handPath([[514, 546], [540, 574], [566, 546]], { sharp: true, seed: 'ar2', jitter: 1 }),
];

// ── 한글 하하(아래 줄) ───────────────────────────────────────────────
const S = 400;
const SYL = [
  { x: 128, y: 600, s: S },
  { x: 552, y: 600, s: S },
];
const H_CIRCLE = { cx: 0.32, cy: 0.64, r: 0.19 };
const sylStrokes = (box: { x: number; y: number; s: number }, k: number): string[] => [
  handPath(inBox(box, [[0.24, 0.22], [0.4, 0.22]]), { sharp: true, seed: `k${k}s1`, jitter: 2.2 }),
  handPath(inBox(box, [[0.08, 0.36], [0.56, 0.36]]), { sharp: true, seed: `k${k}s2`, jitter: 2.5 }),
  handPath(inBox(box, ringPts(H_CIRCLE.cx, H_CIRCLE.cy, H_CIRCLE.r, { n: 16, over: 0.05 })), { seed: `k${k}s3`, jitter: 2 }),
  handPath(inBox(box, [[0.77, 0.1], [0.77, 0.92]]), { sharp: true, seed: `k${k}s4`, jitter: 2 }),
  handPath(inBox(box, [[0.78, 0.5], [0.95, 0.5]]), { sharp: true, seed: `k${k}s5`, jitter: 1.6 }),
];
const KO_STROKES = SYL.map((b, k) => sylStrokes(b, k));

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

// 한 구간 [a,b]를 획 길이대로 나눈다 — 획 사이 펜을 드는 틈
const subWins = (paths: string[], [a, b]: readonly [number, number], lift: number): [number, number][] => {
  const L = paths.reduce((acc, d) => acc + len(d), 0);
  const avail = b - a - lift * (paths.length - 1);
  let t = a;
  return paths.map((d) => {
    const w: [number, number] = [t, t + (avail * len(d)) / L];
    t = w[1] + lift;
    return w;
  });
};

type Draw = { d: string; w: readonly [number, number]; width: number };
const EN_W = subWins(EN_STROKES, T.en, 0.07);
const EN_DRAWS: Draw[] = EN_STROKES.map((d, i) => ({ d, w: EN_W[i], width: 12 }));
const ARROW_W = subWins(ARROW, T.arrow, 0.06);
const ARROW_DRAWS: Draw[] = ARROW.map((d, i) => ({ d, w: ARROW_W[i], width: 9 }));
const K1_W = [T.st1, T.st2, T.st3, T.a1, T.a2];
const K2_W = subWins(KO_STROKES[1], T.s2, 0.06);
const KO_DRAWS: Draw[][] = [KO_STROKES[0].map((d, i) => ({ d, w: K1_W[i], width: 30 })), KO_STROKES[1].map((d, i) => ({ d, w: K2_W[i], width: 30 }))];
const ALL_DRAWS: Draw[] = [...EN_DRAWS, ...ARROW_DRAWS, ...KO_DRAWS[0], ...KO_DRAWS[1]];

// 영어 글자 하나가 내려앉을 자리 — h는 ㅎ 밑, a는 ㅏ 밑(하하 아래 기준선)
const DROP_BASE = SYL[0].y + S + 150;
const dropFor = (i: number): Pt => {
  const k = Math.floor(i / 2);
  const tx = SYL[k].x + (i % 2 ? 0.83 : 0.32) * S;
  const cx = EN_X0 + ADV * i + 28;
  return [tx - cx, DROP_BASE - EN_BASE];
};

/** 초 구간 [a,b]에서 0→1(획 긋는 속도: 처음과 끝만 조금 느리게). */
const prog = (f: number, [a, b]: readonly [number, number]) => interpolate(f, [fr(a), Math.max(fr(a) + 1, fr(b))], [0, 1], { ...clamp, easing: Easing.bezier(0.35, 0.05, 0.4, 1) });

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
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} opacity={opacity} filter={filter} />;
};

// ── 반전: ㅎ 하나가 모자 쓴 사람 — 짧은 줄과 긴 줄 사이를 검게 칠해 높은 모자, 동그라미 안에 웃는 눈 · 크게 웃는 입 ─────────────
// 모자 몸통은 위(짧은 줄)에서 아래(긴 줄)로 칠해 내려간다.
const hatBody = (box: { x: number; y: number; s: number }) => {
  const [[x0, y0], [x1, y1]] = inBox(box, [[0.25, 0.22], [0.39, 0.36]]);
  return { x0, y0, x1, y1 };
};
const laughEyes = (box: { x: number; y: number; s: number }) =>
  [0.26, 0.38].map((u) => {
    const [[ax, ay], [cx, cy], [bx, by]] = inBox(box, [[u - 0.035, 0.6], [u, 0.555], [u + 0.035, 0.6]]);
    return `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
  });
const laughMouth = (box: { x: number; y: number; s: number }) => {
  const [[ax, ay], [cx, cy], [bx, by]] = inBox(box, [[0.245, 0.665], [0.32, 0.79], [0.395, 0.665]]);
  return `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by} Z`;
};
const HAT = SYL.map(hatBody);
const EYES = SYL.map(laughEyes);
const MOUTH = SYL.map(laughMouth);
const HAT_T = [T.hat1, T.hat2];
const FACE_T = [T.face1, T.face2];

// 모자 몸통 — 짧은 줄 · 긴 줄을 그은 바로 뒤 위에서 아래로 칠해 내려간다(목소리 「a hat」)
const HatFill: React.FC<{ k: number }> = ({ k }) => {
  const f = useCurrentFrame();
  const hp = prog(f, HAT_T[k]);
  const h = HAT[k];
  if (hp <= 0) return null;
  return <rect x={h.x0} y={h.y0} width={h.x1 - h.x0} height={(h.y1 - h.y0) * hp} rx={3} fill={C.graphite} opacity={0.9} filter="url(#graphite)" />;
};

// 얼굴 — 동그라미가 닫히는 순간 웃는 눈 · 크게 웃는 입(목소리 「a face!」)
const FaceMarks: React.FC<{ k: number }> = ({ k }) => {
  const f = useCurrentFrame();
  const [f0, f1] = FACE_T[k];
  const ep = (i: number) => prog(f, [f0 + i * 0.08, f0 + i * 0.08 + 0.16]);
  const mp = prog(f, [f0 + 0.18, f1]);
  const fill = interpolate(f, [fr(f1 - 0.1), fr(f1 + 0.12)], [0, 0.85], clamp);
  return (
    <g>
      {EYES[k].map((d, i) => (
        <Stroke key={`e${i}`} d={d} p={ep(i)} width={11} color={C.graphite} opacity={0.95} filter="url(#redpen)" />
      ))}
      {mp > 0 ? <path d={MOUTH[k]} fill={C.red} fillOpacity={fill} stroke={C.red} strokeWidth={9} strokeLinejoin="round" strokeDasharray={evolvePath(mp, MOUTH[k]).strokeDasharray} strokeDashoffset={evolvePath(mp, MOUTH[k]).strokeDashoffset} filter="url(#redpen)" /> : null}
    </g>
  );
};

// 웃음 — 두 사람이 번갈아 들썩인다(ㅎ만, ㅏ는 그대로). 천천히 커진다 — 한 번에 바뀌는 박자가 컷 하나로 남게
const useLaugh = (k: number) => {
  const f = useCurrentFrame();
  const t = f / 30 - T.laugh;
  if (t <= 0) return '';
  const amp = interpolate(t, [0, 1.2], [0, 1], { ...clamp, easing: EASE_IO });
  const ph = t * 2 * Math.PI * 2.4 + (k ? Math.PI * 0.8 : 0);
  const box = SYL[k];
  const cx = box.x + H_CIRCLE.cx * box.s;
  const cy = box.y + 0.92 * box.s;
  return `translate(0 ${-Math.abs(Math.sin(ph)) * 9 * amp}) rotate(${Math.sin(ph) * 3 * amp} ${cx} ${cy})`;
};

// 모자 인사 — 모자(짧은 줄 · 몸통 · 긴 줄)만 들었다 내려놓는다. 두 사람이 조금씩 엇갈려.
// 끝(tip2)은 한 방(v6 볼 이유 심사 「끝도 모자가 살짝 기울 뿐」) — 모자가 높이 튀어 한 바퀴 돌고 제자리에 떨어지며 얼굴이 눌린다.
const useTip = (k: number) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const off = k * 0.14;
  const p1 = Math.sin(Math.PI * interpolate(t, [T.tip1[0] + off, T.tip1[1] + off], [0, 1], clamp)) ** 0.8;
  const q = interpolate(t, [T.tip2[0] + off, T.tip2[1] + off], [0, 1], clamp);
  const up = Math.sin(Math.PI * q); // 올라갔다 내려온다
  const spin = interpolate(q, [0.15, 0.85], [0, -360], { ...clamp, easing: EASE_IO });
  const box = SYL[k];
  const px = box.x + 0.08 * box.s;
  const py = box.y + 0.36 * box.s;
  const hx = box.x + 0.32 * box.s;
  const hy = box.y + 0.29 * box.s;
  if (q > 0 && q < 1) return `translate(0 ${-190 * up}) rotate(${spin} ${hx} ${hy})`;
  if (p1 <= 0) return '';
  return `translate(${6 * p1} ${-62 * p1}) rotate(${-15 * p1} ${px} ${py})`;
};
// 모자가 떨어지는 순간 얼굴이 살짝 눌렸다 돌아온다
const useSquash = (k: number) => {
  const f = useCurrentFrame();
  const land = T.tip2[1] + k * 0.14;
  const s = interpolate(f / 30, [land - 0.02, land + 0.08, land + 0.3], [0, 1, 0], clamp);
  if (s <= 0) return '';
  const box = SYL[k];
  const cx = box.x + H_CIRCLE.cx * box.s;
  const cy = box.y + 0.83 * box.s;
  return `translate(${cx} ${cy}) scale(${1 + 0.08 * s} ${1 - 0.12 * s}) translate(${-cx} ${-cy})`;
};

// 「hat」 · 「face」 이름표 — 목소리가 그 낱말을 말하는 동안(v6: 모자 · 얼굴이 글자의 어느 부분인지 세 시험관이 짚음)
const LabelTag: React.FC<{ text: string; x: number; y: number; at: number; until: number }> = ({ text, x, y, at: t, until }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [fr(t), fr(t + 0.25)], [0, 1], { ...clamp, easing: EASE_IO }) * interpolate(f, [fr(until), fr(until + 0.3)], [1, 0], clamp);
  if (p <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: x - 70, width: 140, top: y, textAlign: 'center', opacity: p, transform: `scale(${0.85 + 0.15 * p})` }}>
      <span style={{ display: 'inline-block', background: C.coral, color: C.brown, fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, fontSize: 40, lineHeight: 1, padding: '8px 18px 10px', borderRadius: 14 }}>{text}</span>
    </div>
  );
};
const Syllable: React.FC<{ k: number }> = ({ k }) => {
  const f = useCurrentFrame();
  const laugh = useLaugh(k);
  const tip = useTip(k);
  const squash = useSquash(k);
  const draws = KO_DRAWS[k];
  return (
    <g>
      <g transform={laugh}>
        <g transform={tip}>
          {draws.slice(0, 2).map((x, i) => (
            <Stroke key={i} d={x.d} p={prog(f, x.w)} width={x.width} />
          ))}
          <HatFill k={k} />
        </g>
        <g transform={squash}>
          <Stroke d={draws[2].d} p={prog(f, draws[2].w)} width={draws[2].width} />
          <FaceMarks k={k} />
        </g>
      </g>
      {draws.slice(3).map((x, i) => (
        <Stroke key={`a${i}`} d={x.d} p={prog(f, x.w)} width={x.width} />
      ))}
    </g>
  );
};
// ── 끝: 두 사람 머리 위 「하!」 말풍선(끝 글 카드 대신 — v4 haiku: 한 줄 결과 카드가 지난 편과 같다) ────────
const Bubble: React.FC<{ k: number }> = ({ k }) => {
  const f = useCurrentFrame();
  const t0 = T.bubble + k * 0.18;
  const p = interpolate(f, [fr(t0), fr(t0 + 0.7)], [0, 1], { ...clamp, easing: EASE_IO });
  if (p <= 0) return null;
  const x = SYL[k].x + 0.56 * S;
  const y = SYL[k].y - 0.08 * S;
  return (
    <div style={{ position: 'absolute', left: x - 82, top: y - 80, width: 164, height: 122, opacity: p, transform: `translateY(${(1 - p) * 14}px) rotate(${k ? 6 : -6}deg)` }}>
      <div style={{ position: 'absolute', inset: '0 0 22px 0', background: '#FFFDF8', border: `5px solid ${C.coral}`, borderRadius: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 800, fontSize: 62, color: C.coralShade }}>하!</div>
      <div style={{ position: 'absolute', left: k ? 30 : 34, bottom: 4, width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: `22px solid ${C.coral}` }} />
    </div>
  );
};

const Page: React.FC = () => {
  const f = useCurrentFrame();
  const arrowGone = interpolate(f, [fr(T.drop[0]), fr(T.drop[0] + 0.4)], [1, 0], clamp);
  return (
    <AbsoluteFill>
      <Img src={staticFile('img/notebook.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <PencilDefs />
        {RULE_Y.map((y) => (
          <line key={y} x1={96} y1={y} x2={1000} y2={y} stroke={C.rule} strokeWidth={2.4} opacity={0.42} />
        ))}
        {EN_LETTERS.map((_, li) => {
          // 글자마다 조금씩 늦게 내려앉는다
          const w = 0.55;
          const t0 = T.drop[0] + li * ((T.drop[1] - T.drop[0] - w) / 3);
          const p = interpolate(f, [fr(t0), fr(t0 + w)], [0, 1], { ...clamp, easing: EASE_IO });
          const [dx, dy] = dropFor(li);
          return (
            <g key={li} transform={`translate(${dx * p} ${dy * p})`}>
              {EN_DRAWS.slice(li * 2, li * 2 + 2).map((x, i) => (
                <Stroke key={i} d={x.d} p={prog(f, x.w)} width={x.width} color={p > 0.5 ? C.coralShade : C.graphite} />
              ))}
            </g>
          );
        })}
        <g opacity={arrowGone}>
          {ARROW_DRAWS.map((x, i) => (
            <Stroke key={i} d={x.d} p={prog(f, x.w)} width={x.width} />
          ))}
        </g>
        <Syllable k={0} />
        <Syllable k={1} />
      </svg>
      <Bubble k={0} />
      <Bubble k={1} />
      <LabelTag text="hat" x={SYL[0].x + 0.32 * S} y={SYL[0].y + 0.02 * S} at={T.hat1[0]} until={T.s2[0]} />
      <LabelTag text="face" x={SYL[0].x + 0.32 * S} y={SYL[0].y + 0.86 * S} at={T.face1[0] - 0.1} until={T.s2[0]} />
    </AbsoluteFill>
  );
};

// ── 연필(위에서 내려다보는 구도) ─────────────────────────────────────
const PENCIL_SCALE = 0.5; // 1072×1061 원본, 촉이 (3,3)
const OFF: Pt = [1180, 2050];
const usePencil = (f: number): { tip: Pt; down: number; show: boolean } => {
  const t = f / 30;
  const lerp = (a: Pt, b: Pt, p: number): Pt => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
  const move = (a: Pt, b: Pt, [s0, s1]: readonly [number, number]) => lerp(a, b, interpolate(t, [s0, s1], [0, 1], { ...clamp, easing: EASE_IO }));
  for (let i = 0; i < ALL_DRAWS.length; i += 1) {
    const { d, w } = ALL_DRAWS[i];
    if (t <= w[1]) {
      if (t >= w[0]) return { tip: at(d, prog(f, w)), down: 1, show: true };
      if (i === 0) return { tip: startOf(d), down: 1, show: true };
      const prev = ALL_DRAWS[i - 1];
      return { tip: move(endOf(prev.d), startOf(d), [prev.w[1] + Math.min(0.08, (w[0] - prev.w[1]) * 0.2), w[0]]), down: 0, show: true };
    }
  }
  const last = ALL_DRAWS[ALL_DRAWS.length - 1];
  return { tip: move(endOf(last.d), OFF, T.pencilOut), down: 0, show: t < T.pencilOut[1] };
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

// ── 소리 ─────────────────────────────────────────────────────────
const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at: t, vol = 1 }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; at: number; vol: number; from?: number; dur?: number }> = ({ file, at: t, vol, from = 0, dur }) => (
  <Sequence from={Math.max(0, fr(t))} durationInFrames={dur ? Math.max(2, fr(dur)) : undefined} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} startFrom={fr(from)} volume={(i) => vol * MASTER * (dur ? interpolate(i, [0, 2, Math.max(3, fr(dur) - 5), Math.max(4, fr(dur))], [0, 1, 1, 0], clamp) : 1)} />
  </Sequence>
);
const PENCIL_FROM = [0.6, 2.4, 0.2, 1.5, 4.2, 0.6, 3.1, 1.1, 2.8];

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.11 * MASTER * interpolate(i, [fr(T.total) - 30, fr(T.total)], [1, 0], clamp)} />
    <Vo id="g1" at={T.g1} />
    <Vo id="m1" at={T.m1} />
    <Vo id="m2" at={T.m2} />
    <Vo id="m3" at={T.m3} />
    <Vo id="k2" at={T.k2} />
    <Vo id="k2" at={T.k2b} />
    <Vo id="g3" at={T.g3} />
    {/* 연필 — 실제 녹음 조각, 획마다 다른 자리 */}
    {ALL_DRAWS.map(({ w }, i) => (w[1] - w[0] >= 0.15 ? <Sfx key={i} file={i % 2 ? 'pencil_b.wav' : 'pencil_a.wav'} at={w[0]} from={PENCIL_FROM[i % 9]} dur={w[1] - w[0]} vol={i < EN_DRAWS.length ? 0.4 : 0.55} /> : null))}
    {/* 반전 — 빨간 펜 */}
    {[0, 1].map((k) => (
      <Sfx key={`f${k}`} file="pencil_b.wav" at={HAT_T[k][0]} from={2.2 + k} dur={FACE_T[k][1] - HAT_T[k][0]} vol={0.32} />
    ))}
    <Sfx file="tok.wav" at={T.cut} vol={0.25} />
    <Sfx file="pop.wav" at={T.bubble} vol={0.22} />
    <Sfx file="sparkle.wav" at={T.tip2[0]} vol={0.2} />
    <Sfx file="tok.wav" at={T.tip2[1]} vol={0.4} />
    <Sfx file="tok.wav" at={T.tip2[1] + 0.14} vol={0.35} />
    <Vo id="k2" at={T.tip2[1] + 0.05} />
    <Sfx file="pop.wav" at={T.bubble + 0.18} vol={0.22} />
  </>
);

export const Film4: React.FC = () => {
  const f = useCurrentFrame();
  const after = f >= fr(T.cut);
  // 컷 뒤에는 하하로 다가간 채 아주 천천히 더 다가간다(끝까지 완전히 멈춘 화면이 되지 않게)
  const z = after ? ZOOM + interpolate(f, [fr(T.cut), fr(T.total)], [0, 0.035], clamp) : 1;
  return (
    <AbsoluteFill style={{ backgroundColor: '#E9DCC4' }}>
      <AbsoluteFill style={{ transform: z === 1 ? undefined : `scale(${z})`, transformOrigin: ZOOM_ORIGIN }}>
        <Page />
        <Pencil />
      </AbsoluteFill>
      <Sound />
    </AbsoluteFill>
  );
};
