// LAB 영어 E20 「F · V · Z 이름」 — 탁자 위 이름 블록의 첫 글자가 굴러떨어져 시소를 치면, 반대쪽에서 한글 자음 블록이 튀어 올라 그 자리에 앉는다.
// Fiona → 피오나 · Victor → 빅터(자음이 몽글 머리를 치고) · Zara → 자라 — 그런데 자라는 거북이라, 진짜 자라가 걸어 들어와 블록을 등에 싣는다. 전부 useCurrentFrame()으로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { fr, FPS, RowT, T } from './timeline';

const C = { brown: '#2B1A14', ink: '#3B2212', coral: '#D2402F', cream: '#FFFDF8' };
const KO = "'SUIT', 'Inter Tight', sans-serif";
const EN = "'Inter Tight', 'SUIT', sans-serif";
const MASTER = 0.8;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const prog = (t: number, a: number, b: number, easing?: (n: number) => number) => interpolate(t, [a, b], [0, 1], easing ? { ...clamp, easing } : clamp);

// 탁자(판 기준 1080 폭으로 잰 값) — 윗면 1091~1293, 나무 테 1293~1373, 그 아래 바닥
const FLOOR_Y = 1284; // 블록 밑면
const PIVOT = { x: 540, y: 1702 };
const TILT = 14;
const JAMO_S = 200;
const HEAD_HIT = { x: 540, y: 470 }; // 몽글 머리 윗자리

type Syl = { ko: string; from: number[]; read: string };
type Row = { name: string; letters: string[]; jamo: string; syl: Syl[]; t: RowT; s: number; S: number; from: number; to: number; drop: boolean };
const ROWS: Row[] = [
  { name: 'Fiona', letters: ['F', 'I', 'O', 'N', 'A'], jamo: 'ㅍ', s: 180, S: 262, t: T.r1, from: 0, to: T.rule + 0.25, drop: false,
    syl: [{ ko: '피', from: [0, 1], read: 'pi' }, { ko: '오', from: [2], read: 'o' }, { ko: '나', from: [3, 4], read: 'na' }] },
  { name: 'Victor', letters: ['V', 'I', 'C', 'T', 'O', 'R'], jamo: 'ㅂ', s: 158, S: 300, t: T.r2, from: T.row2, to: T.row3, drop: true,
    syl: [{ ko: '빅', from: [0, 1, 2], read: 'bik' }, { ko: '터', from: [3, 4, 5], read: 'teo' }] },
  { name: 'Zara', letters: ['Z', 'A', 'R', 'A'], jamo: 'ㅈ', s: 190, S: 300, t: T.r3, from: T.row3, to: T.end, drop: true,
    syl: [{ ko: '자', from: [0, 1], read: 'ja' }, { ko: '라', from: [2, 3], read: 'ra' }] },
];

// 오린 나무 블록 + 글자(판 위에 태운 글씨처럼 진한 갈색)
const Block: React.FC<{ x: number; y: number; s: number; ch: string; wood: number; rot?: number; sq?: number; op?: number }> = ({ x, y, s, ch, wood, rot = 0, sq = 0, op = 1 }) => {
  const ko = /[ㄱ-ㅎ가-힣]/.test(ch);
  return (
    <div style={{ position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s, opacity: op, transform: `rotate(${rot}deg) scale(${1 + sq}, ${1 - sq})`, transformOrigin: '50% 100%', filter: 'drop-shadow(0 10px 10px rgba(70,40,10,0.32))' }}>
      <Img src={staticFile(`img/block${(wood % 4) + 1}.png`)} style={{ position: 'absolute', inset: 0, width: s, height: s }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: s * 0.05, height: s * 0.95, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ko ? KO : EN, fontWeight: 900, fontSize: s * (ko ? 0.68 : 0.7), lineHeight: 1, color: C.ink, opacity: 0.92, textShadow: '0 1.5px 0 rgba(255,235,200,0.4)' }}>{ch}</div>
    </div>
  );
};

// 시소 — 첫 글자가 왼쪽을 치면 오른쪽이 튀어 오른다
const tiltAt = (t: number) => {
  let a = TILT;
  for (const r of ROWS) {
    if (t >= r.t.hit) a = interpolate(t, [r.t.hit, r.t.hit + 0.07, r.t.hit + 0.16], [TILT, -TILT - 3, -TILT], clamp);
    if (r.drop && t >= r.from - 0.3 && t < r.t.hit) a = interpolate(t, [r.from - 0.3, r.from - 0.05], [-TILT, TILT], { ...clamp, easing: EASE_IO });
  }
  return a;
};
const plankY = (x: number, a: number) => PIVOT.y + (x - PIVOT.x) * Math.tan((a * Math.PI) / 180);
const Seesaw: React.FC<{ t: number }> = ({ t }) => {
  const a = tiltAt(t);
  return (
    <>
      <Img src={staticFile('img/wedge.png')} style={{ position: 'absolute', left: PIVOT.x - 74, top: PIVOT.y - 6, width: 148, height: 133, filter: 'drop-shadow(0 8px 8px rgba(70,40,10,0.25))' }} />
      <Img src={staticFile('img/plank.png')} style={{ position: 'absolute', left: PIVOT.x - 470, top: PIVOT.y - 24, width: 940, height: 47, transform: `rotate(${a}deg)`, transformOrigin: '50% 50%', filter: 'drop-shadow(0 8px 8px rgba(70,40,10,0.25))' }} />
    </>
  );
};

const slot = (r: Row, i: number) => ({ x: 540 + (i - (r.letters.length - 1) / 2) * (r.s + 6), y: FLOOR_Y - r.s / 2 });
const finalSlot = (r: Row, k: number) => ({ x: 540 + (k - (r.syl.length - 1) / 2) * (r.S + 12), y: FLOOR_Y - r.S / 2 });
const REST_X = PIVOT.x + 345;

// 자음이 날아가는 자리(빅터는 몽글 머리를 치고 떨어진다)
const jamoPath = (r: Row, rowIndex: number, t: number, restY: number) => {
  const first = slot(r, 0);
  const rt = r.t;
  if (rowIndex === 1) {
    if (t < T.bonk) {
      const p = prog(t, rt.hit, T.bonk);
      return { x: interpolate(p, [0, 1], [REST_X, HEAD_HIT.x]), y: interpolate(p, [0, 1], [restY, HEAD_HIT.y]) - Math.sin(p * Math.PI) * 220, rot: Math.max(0, 1 - p * 1.8) * 360, s: JAMO_S };
    }
    const p = prog(t, T.bonk, rt.land);
    return { x: interpolate(p, [0, 1], [HEAD_HIT.x, first.x]), y: interpolate(p, [0, 1], [HEAD_HIT.y, first.y]) - Math.sin(p * Math.PI) * 170, rot: -p * 360, s: interpolate(p, [0, 1], [JAMO_S, r.s]) };
  }
  const p = prog(t, rt.hit, rt.land);
  return { x: interpolate(p, [0, 1], [REST_X, first.x]), y: interpolate(p, [0, 1], [restY, first.y]) - Math.sin(p * Math.PI) * 430, rot: Math.max(0, 1 - p * 1.8) * 360, s: interpolate(p, [0, 1], [JAMO_S, r.s]) };
};

// 거북이 — 오른쪽에서 걸어 들어와 자라 블록을 등에 싣는다
const turtleX = (t: number) => interpolate(t, [T.turtle, T.hop + 0.25], [1500, 700], { ...clamp, easing: Easing.bezier(0.2, 0.7, 0.3, 1) });
const TUR_W = 660;
const TUR_H = (TUR_W * 491) / 902;
const Turtle: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.turtle || t >= T.end) return null;
  const x = turtleX(t);
  const walking = t < T.hop + 0.25;
  const bob = walking ? Math.abs(Math.sin(t * 16)) * 9 : 0;
  return (
    <>
      <div style={{ position: 'absolute', left: x - TUR_W * 0.46, top: 1290 - 34, width: TUR_W * 0.92, height: 44, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(40,60,30,0.42), rgba(40,60,30,0))' }} />
      <Img src={staticFile('img/turtle.png')} style={{ position: 'absolute', left: x - TUR_W / 2, top: 1290 - TUR_H - bob, width: TUR_W, height: TUR_H, transform: `rotate(${walking ? Math.sin(t * 16) * 1.5 : 0}deg)` }} />
    </>
  );
};

const RowView: React.FC<{ r: Row; t: number; rowIndex: number }> = ({ r, t, rowIndex }) => {
  if (t < r.from - 0.3 || t >= r.to) return null;
  const out: React.ReactNode[] = [];
  const rt = r.t;
  // 쓸려 나감(Fiona → 규칙 칸)
  const sweep = rowIndex === 0 ? prog(t, T.rule, T.rule + 0.24, Easing.in(Easing.quad)) : 0;
  const dropIn = (i: number) => (r.drop ? 1 - prog(t, r.from + i * 0.02, r.from + 0.16 + i * 0.02, Easing.bezier(0.3, 0, 0.9, 0.6)) : 0);
  // 라틴 글자
  r.letters.forEach((ch, i) => {
    const p = slot(r, i);
    const group = r.syl.findIndex((s) => s.from.includes(i));
    const mergeAt = rt.merges[group];
    const toward = finalSlot(r, group);
    const mg = prog(t, mergeAt - 0.14, mergeAt, Easing.in(Easing.quad));
    if (t >= mergeAt) return;
    if (i === 0) {
      // 첫 글자 — 흔들 → 떨어짐 → 시소를 치고 왼쪽으로 튕겨 나감
      if (t >= rt.hit + 0.55) return;
      const wob = t < rt.tip ? 0 : Math.sin((t - rt.tip) * 34) * 7 * interpolate(t, [rt.tip, rt.tip + 0.2], [0.4, 1], clamp);
      const fallT = rt.tip + (rt.hit - rt.tip) * 0.42;
      const f = prog(t, fallT, rt.hit, Easing.in(Easing.quad));
      const landY = plankY(p.x, TILT) - r.s * 0.6;
      const after = prog(t, rt.hit, rt.hit + 0.5);
      const y = t < rt.hit ? interpolate(f, [0, 1], [p.y, landY]) : landY - Math.sin(after * Math.PI) * 240 + after * 500;
      const x = p.x - after * 520;
      const rot = t < fallT ? wob : t < rt.hit ? -8 - f * 22 : -30 - after * 300;
      const d0 = dropIn(0);
      out.push(<Block key={`l${i}`} x={x} y={y - d0 * 1400} s={r.s * (1 + f * 0.12)} ch={ch} wood={i + rowIndex} rot={rot} />);
      return;
    }
    const d = dropIn(i);
    const x = interpolate(mg, [0, 1], [p.x, toward.x]) - sweep * 1200;
    const y = interpolate(mg, [0, 1], [p.y, toward.y]) - d * 1400;
    out.push(<Block key={`l${i}`} x={x} y={y} s={r.s * (1 - mg * 0.25)} ch={ch} wood={i + rowIndex} op={1 - mg * 0.6} />);
  });
  // 자음 블록 — 시소 오른쪽에 있다가 튀어 올라 첫 칸에 앉는다
  if (t < rt.merges[0]) {
    const restA = tiltAt(Math.min(t, rt.hit - 0.001));
    const restY = plankY(REST_X, restA) - JAMO_S * 0.56;
    const appear = r.drop ? prog(t, r.from - 0.25, r.from - 0.02, Easing.out(Easing.back(1.6))) : 1;
    if (t < rt.hit) {
      out.push(<Block key="j" x={REST_X} y={restY + (1 - appear) * 300} s={JAMO_S} ch={r.jamo} wood={3 + rowIndex} rot={restA} op={appear} />);
    } else {
      const flying = jamoPath(r, rowIndex, t, plankY(REST_X, TILT) - JAMO_S * 0.56);
      const landed = t - rt.land;
      const sq = landed > 0 ? 0.14 * Math.exp(-landed * 12) * Math.cos(landed * 26) : 0;
      const mg0 = prog(t, rt.merges[0] - 0.14, rt.merges[0], Easing.in(Easing.quad));
      const to = finalSlot(r, 0);
      // 날아가는 자리 점선 — 시소가 이 블록을 쳐 올렸다는 고리
      if (t < rt.land) {
        const dots = Array.from({ length: 7 }, (_, n) => {
          const back = jamoPath(r, rowIndex, Math.max(rt.hit, t - (n + 1) * 0.045), plankY(REST_X, TILT) - JAMO_S * 0.56);
          return <circle key={n} cx={back.x} cy={back.y} r={11 - n} fill={C.coral} opacity={0.5 - n * 0.06} />;
        });
        out.push(<svg key="trail" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>{dots}</svg>);
      }
      out.push(<Block key="j" x={interpolate(mg0, [0, 1], [flying.x, to.x])} y={interpolate(mg0, [0, 1], [flying.y, to.y])} s={flying.s} ch={r.jamo} wood={3 + rowIndex} rot={flying.rot} sq={sq} />);
    }
  }
  // 한글 블록
  r.syl.forEach((syl, k) => {
    const at = rt.merges[k];
    if (t < at) return;
    const p = finalSlot(r, k);
    const a = interpolate(t, [at, at + 0.26], [0.72, 1], { ...clamp, easing: Easing.out(Easing.back(2.6)) });
    let bump = 0;
    if (rowIndex === 0) bump = Math.max(...T.say1.map((b, j) => (j === k ? interpolate(t, [b - 0.02, b + 0.08, b + 0.3], [0, 1, 0], clamp) : 0)));
    const hop = rowIndex === 2 ? prog(t, T.hop, T.hop + 0.3) : 0;
    const shell = { x: turtleX(t) + 90 + (k - 0.5) * 128, y: 1290 - TUR_H + 22 - 62 };
    const x = interpolate(hop, [0, 1], [p.x, shell.x]) - sweep * 1300;
    const y = interpolate(hop, [0, 1], [p.y, shell.y]) - Math.sin(hop * Math.PI) * 120 - bump * 34;
    const s = interpolate(hop, [0, 1], [r.S, 122]);
    out.push(<Block key={`s${k}`} x={x} y={y} s={s * a * (1 + bump * 0.04)} ch={syl.ko} wood={k + 1 + rowIndex} />);
    // 읽는 소리 — 블록 위 작은 꼬리표
    const lab = prog(t, at + 0.05, at + 0.2) * (1 - prog(t, T.turtle - 0.05, T.turtle + 0.1)) * (1 - sweep);
    if (lab > 0) {
      out.push(
        <div key={`r${k}`} style={{ position: 'absolute', left: p.x - 110, width: 220, top: p.y - r.S / 2 - 92 - bump * 34, display: 'flex', justifyContent: 'center', opacity: lab }}>
          <div style={{ padding: '4px 24px 8px', borderRadius: 999, background: C.cream, boxShadow: '0 6px 12px rgba(60,20,10,0.22)', fontFamily: EN, fontWeight: 800, fontSize: 66, lineHeight: 1.1, color: C.coral }}>{syl.read}</div>
        </div>,
      );
    }
  });
  return <>{out}</>;
};

// 규칙 칸 — V · Z 블록이 위에서 떨어진다
const RuleBlocks: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.rule || t >= T.row2 - 0.05) return null;
  const v = prog(t, T.rule + 0.1, T.rule + 0.34, Easing.in(Easing.quad));
  const z = prog(t, T.rule + 0.62, T.rule + 0.86, Easing.in(Easing.quad));
  const lv = t - (T.rule + 0.34);
  const lz = t - (T.rule + 0.86);
  const S = 280;
  return (
    <>
      <Block x={370} y={interpolate(v, [0, 1], [-300, FLOOR_Y - S / 2])} s={S} ch="V" wood={0} rot={-4} sq={lv > 0 ? 0.12 * Math.exp(-lv * 12) * Math.cos(lv * 26) : 0} />
      {t >= T.rule + 0.62 ? <Block x={710} y={interpolate(z, [0, 1], [-300, FLOOR_Y - S / 2])} s={S} ch="Z" wood={2} rot={3} sq={lz > 0 ? 0.12 * Math.exp(-lz * 12) * Math.cos(lz * 26) : 0} /> : null}
    </>
  );
};

// 장면 판
const plateAt = (t: number) => {
  if (t < T.r1.tip) return 'normal';
  if (t < T.r1.land) return 'shock';
  if (t < T.r1.done) return 'normal';
  if (t < T.rule) return 'joy';
  if (t < T.row2) return 'shock';
  if (t < T.r2.tip) return 'normal';
  if (t < T.bonk) return 'shock';
  if (t < T.row3) return 'dizzy';
  if (t < T.r3.tip) return 'normal';
  if (t < T.r3.merges[1]) return 'shock';
  if (t < T.turtle) return 'joy';
  return 'shock';
};
const IMPACTS = [T.r1.hit, T.r1.land, T.r2.hit, T.bonk, T.r2.land, T.r3.hit, T.r3.land];
// 카메라 — 블록을 합칠 땐 탁자로 밀어 빈 시소를 뺀다(v2 셋이 「시소가 뭔지」, 볼 이유 「빈 장식」)
const pushAt = (t: number) => {
  // v6: 처음엔 탁자만 보이다가 글자가 떨어질 때 물러나 시소를 그제야 보이고, 자음이 앉으면 다시 민다(v4 sonnet · haiku 「시소가 뭔지」)
  const away = (r: RowT) => prog(t, r.tip + 0.02, r.tip + 0.28, EASE_IO) * (1 - prog(t, r.land + 0.05, r.land + 0.33, EASE_IO));
  return 1 - Math.max(away(T.r1), away(T.r2), away(T.r3));
};
const Plate: React.FC<{ t: number; children: React.ReactNode }> = ({ t, children }) => {
  let punch = 0;
  for (const b of IMPACTS) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.05, b + 0.34], [0, 1, 0], clamp));
  const sx = 3 * Math.sin((2 * Math.PI * t) / 3.1);
  const sy = 3 * Math.sin((2 * Math.PI * t) / 3.9 + 1);
  const shake = punch * 8 * Math.sin(t * 90);
  const z = 1 + 0.004 * t + 0.012 * punch + 0.22 * pushAt(t);
  return (
    <AbsoluteFill style={{ transform: `translate(${sx + shake}px, ${sy}px) scale(${z})`, transformOrigin: '50% 420px' }}>
      <Img src={staticFile(`img/${plateAt(t)}.jpg`)} style={FULL} />
      {children}
    </AbsoluteFill>
  );
};

// 끝 판 — 거북이가 자라 블록을 싣고 있고 몽글이 놀란다 → 물음표 블록을 실은 거북이가 나를 본다 → 블록이 뒤집혀 「너는?」
const EndPlate: React.FC<{ t: number }> = ({ t }) => {
  const from = t < T.ask ? T.end : T.ask;
  const to = t < T.ask ? T.ask : T.total;
  const step = t >= T.you ? 1.12 : t >= T.cta ? 1.06 : 1;
  const z = interpolate(t, [from, to], [1.0, t < T.ask ? 1.06 : 1.04], { ...clamp, easing: EASE_IO }) * step;
  const pop = interpolate(t, [from, from + 0.3], [1.05, 1], { ...clamp, easing: EASE_OUT });
  const sx = 3 * Math.sin((2 * Math.PI * t) / 3.3);
  // 물음표 → 밥을 먹는 판 → 너 · 는 (블록이 차례로 뒤집힌다)
  const face = (at: number, dx: number, f0: string, f1: string) => {
    const p = prog(t, at + dx, at + dx + 0.28, EASE_IO);
    return { sx: Math.abs(1 - 2 * p), ch: p < 0.5 ? f0 : f1 };
  };
  const left = face(T.you, 0, '?', '너');
  const right = face(T.you, 0.08, '?', '는');
  return (
    <AbsoluteFill style={{ background: '#F6D97A', transform: `translateX(${sx}px) scale(${z * pop})`, transformOrigin: '50% 45%' }}>
      {t < T.ask ? (
        <Img src={staticFile('img/end.jpg')} style={{ position: 'absolute', left: 0, top: -120, width: 1080, height: 2160 }} />
      ) : t >= T.cta && t < T.you ? (
        <Img src={staticFile('img/end3.jpg')} style={FULL} />
      ) : (
        <Img src={staticFile('img/end2.jpg')} style={FULL} />
      )}
      {t >= T.you ? (
        <>
          <div style={{ position: 'absolute', inset: 0, transform: `scaleX(${left.sx})`, transformOrigin: '408px 50%' }}>
            <Block x={408} y={678} s={404} ch={left.ch} wood={1} />
          </div>
          <div style={{ position: 'absolute', inset: 0, transform: `scaleX(${right.sx})`, transformOrigin: '800px 50%' }}>
            <Block x={800} y={678} s={404} ch={right.ch} wood={2} />
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// 위 글(벽이 비어 있어 판 없이 진한 갈색)
const Head: React.FC<{ t: number; from: number; until: number; size?: number; top?: number; children: React.ReactNode }> = ({ t, from, until, size = 90, top = 276, children }) => {
  if (t < from || t >= until) return null;
  const a = interpolate(t, [from, from + 0.12], [0, 1], { ...clamp, easing: EASE_OUT });
  const s = interpolate(t, [from, from + 0.2], [0.86, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return <div style={{ position: 'absolute', left: 30, right: 30, top, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: size, lineHeight: 1.1, letterSpacing: -1, color: C.brown, opacity: a, transform: `scale(${s})` }}>{children}</div>;
};
const R: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: C.coral }}>{children}</span>;
const Sub: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ fontSize: '0.62em', fontWeight: 700, color: C.brown }}>{children}</span>;

const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at, vol = 1 }) => (
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
    <Audio src={staticFile('sfx/bgm.wav')} volume={(i) => 0.17 * MASTER * interpolate(i, [fr(T.total) - 14, fr(T.total)], [1, 0], clamp)} />
    <Vo id="e1b" at={0.05} />
    <Vo id="q1" at={T.q1} />
    <Vo id="k1" at={T.ko1} />
    <Vo id="k1b" at={T.say1[0] - 0.05} />
    <Vo id="e2" at={T.rule + 0.02} />
    <Vo id="q2" at={T.row2 + 0.02} />
    <Vo id="k2" at={T.r2.merges[1] + 0.08} />
    <Vo id="q3" at={T.row3 + 0.02} />
    <Vo id="k3" at={T.r3.merges[1] + 0.08} />
    <Vo id="e3" at={T.end + 0.05} />
    <Vo id="e4b" at={T.ask + 0.02} />
    <Vo id="q4" at={T.cta + 0.04} />
    <Vo id="k5" at={T.cta + 0.62} />
    <Vo id="e6" at={T.cta + 1.14} />
    <Vo id="k4" at={T.you + 0.12} />
    <Vo id="e5b" at={T.you + 0.86} />
    {[T.r1, T.r2, T.r3].map((r, i) => (
      <React.Fragment key={i}>
        <Sfx file="thud.wav" at={r.hit} vol={0.55} />
        <Sfx file="boing.wav" at={r.hit + 0.02} vol={0.4} />
        <Sfx file="clack.wav" at={r.land} vol={0.6} />
        {r.merges.map((m, j) => (
          <Sfx key={j} file="pop.wav" at={m} vol={0.26} />
        ))}
      </React.Fragment>
    ))}
    <Sfx file="whoosh.wav" at={T.rule} vol={0.26} />
    <Sfx file="clack.wav" at={T.rule + 0.34} vol={0.5} />
    <Sfx file="clack.wav" at={T.rule + 0.86} vol={0.5} />
    <Sfx file="clack.wav" at={T.row2 + 0.16} vol={0.35} />
    <Sfx file="thud.wav" at={T.bonk} vol={0.5} />
    <Sfx file="sting.wav" at={T.bonk + 0.02} vol={0.2} />
    <Sfx file="clack.wav" at={T.row3 + 0.16} vol={0.35} />
    {[0, 0.16, 0.32, 0.48].map((d, i) => (
      <Sfx key={i} file="pat.wav" at={T.turtle + d} vol={0.4} />
    ))}
    <Sfx file="clack.wav" at={T.hop + 0.3} vol={0.4} />
    <Sfx file="sting.wav" at={T.end} vol={0.32} />
    <Sfx file="whoosh.wav" at={T.ask - 0.06} vol={0.22} />
    <Sfx file="pop.wav" at={T.cta} vol={0.3} />
    <Sfx file="tok.wav" at={T.cta + 0.75} vol={0.25} />
    <Sfx file="tok.wav" at={T.cta + 0.95} vol={0.25} />
    <Sfx file="tok.wav" at={T.cta + 1.15} vol={0.25} />
    <Sfx file="clack.wav" at={T.you + 0.14} vol={0.45} />
    <Sfx file="clack.wav" at={T.you + 0.22} vol={0.45} />
  </>
);

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const Ko: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ fontFamily: KO }}>{children}</span>;
  return (
    <AbsoluteFill style={{ background: '#F6D97A' }}>
      {t < T.end ? (
        <Plate t={t}>
          <Seesaw t={t} />
          <Turtle t={t} />
          {ROWS.map((r, i) => (
            <RowView key={i} r={r} t={t} rowIndex={i} />
          ))}
          <RuleBlocks t={t} />
        </Plate>
      ) : (
        <EndPlate t={t} />
      )}
      <Head t={t} from={0} until={T.r1.hit}>There's no <R>F</R> in Korean.</Head>
      <Head t={t} from={T.r1.hit} until={T.r1.done} size={136} top={238}><R>F</R> → <R><span style={{ fontSize: '1.25em' }}>ㅍ</span></R> <Sub>"p"</Sub></Head>
      <Head t={t} from={T.r1.done} until={T.rule}>Fiona → <Ko>피오나</Ko></Head>
      <Head t={t} from={T.rule} until={T.row2}>No <R>V</R>. No <R>Z</R>, either.</Head>
      <Head t={t} from={T.row2} until={T.r2.hit}>Victor?</Head>
      <Head t={t} from={T.r2.hit} until={T.r2.done} size={136} top={238}><R>V</R> → <R><span style={{ fontSize: '1.25em' }}>ㅂ</span></R> <Sub>"b"</Sub></Head>
      <Head t={t} from={T.r2.done} until={T.row3}>Victor → <Ko>빅터</Ko></Head>
      <Head t={t} from={T.row3} until={T.r3.hit}>Zara?</Head>
      <Head t={t} from={T.r3.hit} until={T.r3.done} size={136} top={238}><R>Z</R> → <R><span style={{ fontSize: '1.25em' }}>ㅈ</span></R> <Sub>"j"</Sub></Head>
      <Head t={t} from={T.r3.done} until={T.turtle}>Zara → <Ko>자라</Ko></Head>
      <Head t={t} from={T.turtle} until={T.ask} size={104}><Ko>자라</Ko> = a turtle 🐢</Head>
      <Head t={t} from={T.ask} until={T.cta} size={90}><R>YOUR</R> name in Korean?</Head>
      <Head t={t} from={T.ask + 0.8} until={T.cta} size={56} top={374}>Hopefully not a turtle.</Head>
      <Head t={t} from={T.cta} until={T.you} size={94} top={230}>Bob → <Ko>밥</Ko> <Sub>= rice</Sub></Head>
      <Head t={t} from={T.you} until={99} size={96} top={205}><Ko>너는?</Ko> <Sub>= And you?</Sub></Head>
      <Head t={t} from={T.you + 0.7} until={99} size={60} top={316}>Comment your name <R>↓</R></Head>
      <Sound />
    </AbsoluteFill>
  );
};
