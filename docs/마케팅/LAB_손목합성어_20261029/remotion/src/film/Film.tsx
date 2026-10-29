// LAB E7 「손 + 목 = 손목」(10-29) — 오마주 원본(Korean Hamin wOXCfmVQz78)의 뼈대: 위 제목 · 가운데 그림 카드 · 아래 세 줄 낱말 ·
// 왼쪽 아래 진행자, 낱말 넷을 「A → B → 둘이 나란히 → 합쳐진 결과」로 4.5초마다. 우리 색은 펠트 카페 오픈 마이크 무대의 몽글,
// 펠트 낱말 카드, A는 복숭아 · B는 민트로 나눠 칠해 「손 + 목」이 딸깍 붙어 「손목」이 되는 글 줄(v2 — 이해 시험 1회 지적:
// 「+」 · Snap이 금방 지나가 뜻이 안 잡힘). 끝 한마디는 다음 문제 「손 + 바닥 = ?」와 답(v3 — 낱말은 블록 조각, 반전은 큰 딱지).
// 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { AMAZED, BEAT, FINALE, fr, ITEMS, Item, MAIN, NEXT, TOTAL, VOICE } from './timeline';

const C = {
  a: '#FFB38A', // 앞 조각(복숭아)
  b: '#8FE3D0', // 뒤 조각(민트)
  white: '#FFFFFF',
  frame: 'rgba(255,244,228,0.92)',
  beige: '#D8BF9E',
  badge: '#FFD45A',
  ink: '#0B1626',
};
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const OUT = Easing.bezier(0.22, 1, 0.36, 1);

// 그림 위 흰 글자는 어두운 테를 두른다(올리기 전 검사 ⑤ 흰 기본 글자)
const OUTLINE = (px: number, c = C.ink) =>
  [
    ...[0, 45, 90, 135, 180, 225, 270, 315].map((d) => {
      const r = (d * Math.PI) / 180;
      return `${(Math.cos(r) * px).toFixed(1)}px ${(Math.sin(r) * px).toFixed(1)}px 0 ${c}`;
    }),
    `0 ${px * 2}px ${px * 5}px rgba(0,0,0,0.6)`,
  ].join(', ');

const CARD = { x: 60, y: 196, w: 960, h: 640 };
/** 박마다 살짝 통(0.18초 안에 잦아듦) */
const beatPulse = (t: number, amp = 0.018) => 1 + amp * Math.exp(-((t % BEAT) / 0.09));

type Phase = 'a' | 'b' | 'both' | 'res' | 'next' | 'nextres';
function stateAt(t: number): { i: number; it: Item; phase: Phase } {
  let i = 0;
  for (let k = 0; k < ITEMS.length; k += 1) if (t >= ITEMS[k].t.a) i = k;
  const it = ITEMS[i];
  if (t >= NEXT.res) return { i, it, phase: 'nextres' };
  if (t >= NEXT.at) return { i, it, phase: 'next' };
  const phase = t >= it.t.res ? 'res' : t >= it.t.both ? 'both' : t >= it.t.b ? 'b' : 'a';
  return { i, it, phase };
}

// ── 배경: 오픈 마이크 무대의 몽글(박마다 노래 ↔ 웃음, 마지막 결과에서 감탄, 다음 문제에서 웃음) ─────────
const Stage: React.FC<{ t: number }> = ({ t }) => {
  const k = t >= NEXT.res ? 'B2' : t >= NEXT.at ? 'B1' : t >= AMAZED ? 'B2' : Math.floor(t / BEAT) % 2 === 0 ? 'B0' : 'B1';
  return (
    <AbsoluteFill style={{ backgroundColor: '#0A1424' }}>
      {/* 1024×1536 판을 1280×1920으로 — 왼쪽 50px만 잘라 몽글이 안쪽에 오게 */}
      <Img src={staticFile(`img/${k}.jpg`)} style={{ position: 'absolute', left: -50, top: 0, width: 1280, height: 1920 }} />
    </AbsoluteFill>
  );
};

// ── 카드 ────────────────────────────────────────────────────────
const Photo: React.FC<{ img: string; t: number; t0: number; wave?: boolean }> = ({ img, t, t0, wave }) => {
  const pop = interpolate(t, [t0, t0 + 0.22], [1.07, 1], { ...clamp, easing: OUT });
  const drift = interpolate(t, [t0, t0 + 4], [1, 1.035], clamp);
  // 첫 낱말 「손」은 손을 흔든다(첫 1.25초가 멈춰 보인다는 지적)
  const rot = wave ? 5 * Math.sin((2 * Math.PI * (t - t0)) / (BEAT * 2)) : 0;
  return (
    <Img
      src={staticFile(`img/${img}.jpg`)}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transformOrigin: '50% 80%', transform: `scale(${pop * drift * (wave ? 1.13 : 1)}) rotate(${rot}deg)` }}
    />
  );
};

const Mini: React.FC<{ img: string; cx: number; s: number; w?: number }> = ({ img, cx, s, w = CARD.w * 0.46 }) => {
  const h = (w * 2) / 3;
  return (
    <div
      style={{
        position: 'absolute', left: cx - w / 2, top: (CARD.h - h) / 2, width: w, height: h, borderRadius: 26, overflow: 'hidden',
        transform: `scale(${s})`, boxShadow: '0 10px 26px rgba(60,35,10,0.35)', border: `4px solid ${C.frame}`,
      }}
    >
      <Img src={staticFile(`img/${img}.jpg`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
};

const Sign: React.FC<{ ch: string; x: number; o?: number; size?: number }> = ({ ch, x, o = 1, size = 120 }) => (
  <div style={{ position: 'absolute', left: x - 100, width: 200, top: CARD.h / 2 - size * 0.62, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: size, color: '#fff', opacity: o, textShadow: OUTLINE(4, '#6B4A2A') }}>{ch}</div>
);

const Card: React.FC<{ t: number }> = ({ t }) => {
  const { i, it, phase } = stateAt(t);
  const tt = it.t;
  let body: React.ReactNode;
  if (phase === 'a') body = <Photo img={it.a.img} t={t} t0={tt.a} wave={i === 0} />;
  else if (phase === 'b') body = <Photo img={it.b.img} t={t} t0={tt.b} />;
  else if (phase === 'both') {
    // 둘이 나란히 나왔다가(0.2초) 합쳐질 때 가운데로 밀려 겹친다
    const appear = interpolate(t, [tt.both, tt.both + 0.2], [0.6, 1], { ...clamp, easing: OUT });
    const go = interpolate(t, [Math.max(tt.both + 0.15, tt.res - 0.3), tt.res], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
    const s = appear * (1 - 0.35 * go);
    body = (
      <>
        <AbsoluteFill style={{ backgroundColor: C.beige }} />
        <Mini img={it.a.img} cx={interpolate(go, [0, 1], [CARD.w * 0.26, CARD.w * 0.47])} s={s} />
        <Mini img={it.b.img} cx={interpolate(go, [0, 1], [CARD.w * 0.74, CARD.w * 0.53])} s={s} />
        <Sign ch="+" x={CARD.w / 2} o={1 - go} />
      </>
    );
  } else if (phase === 'res') body = <Photo img={it.r.img} t={t} t0={tt.res} />;
  else if (phase === 'nextres') body = <Photo img={NEXT.r.img} t={t} t0={NEXT.res} />;
  else {
    // 끝 한마디 — 다음 문제(손 + 바닥 = ?)
    const appear = interpolate(t, [NEXT.at, NEXT.at + 0.22], [0.6, 1], { ...clamp, easing: OUT });
    const q = interpolate(t, [NEXT.at + 0.35, NEXT.at + 0.55], [0, 1], { ...clamp, easing: OUT });
    body = (
      <>
        <AbsoluteFill style={{ backgroundColor: C.beige }} />
        <Mini img={NEXT.a.img} cx={CARD.w * 0.2} s={appear} w={CARD.w * 0.34} />
        <Sign ch="+" x={CARD.w * 0.395} size={96} />
        <Mini img={NEXT.b.img} cx={CARD.w * 0.59} s={appear} w={CARD.w * 0.34} />
        <Sign ch="= ?" x={CARD.w * 0.865} size={104} o={q} />
      </>
    );
  }

  const tRes = phase === 'next' ? NEXT.at : phase === 'nextres' ? NEXT.res : tt.res;
  const flash = interpolate(t, [tRes - 0.06, tRes, tRes + 0.18], [0, phase === 'next' ? 0.3 : 0.5, 0], clamp);
  const bump = phase === 'res' || phase === 'nextres' ? 1 + 0.05 * Math.sin(Math.PI * interpolate(t, [tRes, tRes + 0.3], [0, 1], clamp)) : 1;
  const last = i === ITEMS.length - 1 && phase === 'res';
  const bloom = last ? interpolate(t, [FINALE, FINALE + 0.3, MAIN], [0, 1, 0.8], clamp) : 0;
  const glowRes = phase === 'res' || phase === 'nextres' ? interpolate(t, [tRes, tRes + 0.5, tRes + 1.6], [0, 1, 0.35], clamp) : 0;
  const glow = Math.max(glowRes, bloom);
  return (
    <div
      style={{
        position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: 40, overflow: 'hidden',
        border: `6px solid ${C.frame}`, transform: `scale(${bump * beatPulse(t) * (1 + 0.03 * bloom)})`,
        boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 ${30 + 70 * glow}px rgba(255,${last ? 170 : 220},${last ? 80 : 150},${0.55 * glow})`,
      }}
    >
      {body}
      <AbsoluteFill style={{ backgroundColor: '#FFF6E0', opacity: flash }} />
      {last ? <Embers t={t} on={bloom} /> : null}
    </div>
  );
};

/** 끝 불꽃 둘레에 떠오르는 불티(코드로) */
const Embers: React.FC<{ t: number; on: number }> = ({ t, on }) => {
  if (on <= 0) return null;
  const dots = Array.from({ length: 18 }, (_, k) => {
    const seed = (k * 73) % 97;
    const x = 0.2 + ((seed * 37) % 60) / 100;
    const sp = 0.25 + (seed % 7) / 20;
    const ph = (seed % 10) / 10;
    const y = 1 - (((t - FINALE) * sp + ph) % 1);
    return { x, y, r: 5 + (seed % 5), a: Math.sin(Math.PI * y) };
  });
  return (
    <>
      {dots.map((d, k) => (
        <div key={k} style={{ position: 'absolute', left: d.x * CARD.w, top: d.y * CARD.h, width: d.r, height: d.r, borderRadius: '50%', background: '#FFD37A', boxShadow: '0 0 12px 4px rgba(255,170,60,0.8)', opacity: on * d.a }} />
      ))}
    </>
  );
};

// ── 낱말 조각: 「손」 → 「손」 + 「목」 → 딸깍 한 조각 「손목」(v3 — 판형을 지난 편의 글 줄과 다르게, Snap이 눈에 보이게) ───
/** 한글 한 조각(블록) — 위에 돌기 둘, 안에 한글과 로마자 */
const WordBrick: React.FC<{ ko: string; rom: string; bg: string; join?: 'l' | 'r'; s?: number; o?: number }> = ({ ko, rom, bg, join, s = 1, o = 1 }) => {
  const r = join === 'l' ? '22px 4px 4px 22px' : join === 'r' ? '4px 22px 22px 4px' : '22px';
  return (
    <div style={{ position: 'relative', background: bg, borderRadius: r, padding: '6px 30px 10px', minWidth: 170, textAlign: 'center', transform: `scale(${s})`, opacity: o, boxShadow: 'inset 0 -10px 0 rgba(0,0,0,0.13), 0 10px 26px rgba(0,0,0,0.5)' }}>
      {[0.28, 0.72].map((p) => (
        <div key={p} style={{ position: 'absolute', top: -14, left: `calc(${p * 100}% - 20px)`, width: 40, height: 16, borderRadius: '10px 10px 3px 3px', background: bg, boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.13)' }} />
      ))}
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 118, lineHeight: 1.12, color: C.ink }}>{ko}</div>
      <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 40, lineHeight: 1, color: 'rgba(11,22,38,0.78)', marginTop: -2 }}>{rom}</div>
    </div>
  );
};

/** 「+」 — g = 1이면 보이고 0으로 가며 틈이 닫힌다 */
const Plus: React.FC<{ g: number; w?: number }> = ({ g, w = 96 }) => (
  <div style={{ width: w * g, overflow: 'hidden', opacity: g, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: 96, color: C.white, textShadow: OUTLINE(4), alignSelf: 'center' }}>+</div>
);

/** 합쳐지는 순간의 「SNAP!」 — 조각이 끼워지는 소리 글자 */
const SnapBurst: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const k = interpolate(t, [at - 0.04, at + 0.1, at + 0.5, at + 0.68], [0, 1, 1, 0], clamp);
  if (k <= 0) return null;
  const s = interpolate(t, [at - 0.04, at + 0.14], [0.5, 1.08], { ...clamp, easing: OUT });
  return (
    <div style={{ position: 'absolute', right: 540 + 190, top: 968, transformOrigin: 'right center', transform: `rotate(-10deg) scale(${s})`, opacity: k, fontFamily: EN, fontWeight: 900, fontSize: 66, color: C.badge, textShadow: OUTLINE(4), letterSpacing: 1 }}>SNAP!</div>
  );
};

const Labels: React.FC<{ t: number }> = ({ t }) => {
  const { it, phase } = stateAt(t);
  const tt = it.t;
  const tail = phase === 'next' || phase === 'nextres';
  const A = tail ? NEXT.a : it.a, B = tail ? NEXT.b : it.b;
  const tB = tail ? NEXT.at : tt.b;
  const tRes = tail ? NEXT.res : tt.res;
  const isRes = phase === 'res' || phase === 'nextres';
  const showB = phase !== 'a';
  const bIn = interpolate(t, [tB, tB + 0.2], [0.4, 1], { ...clamp, easing: OUT });
  // 결과에서 「+」 틈이 0.2초에 닫혀 두 조각이 한 조각이 된다(딸깍)
  const g = isRes ? interpolate(t, [tRes, tRes + 0.2], [1, 0], { ...clamp, easing: Easing.in(Easing.cubic) }) : 1;
  const snapPop = isRes ? 1 + 0.1 * Math.sin(Math.PI * interpolate(t, [tRes + 0.16, tRes + 0.4], [0, 1], clamp)) : 1;
  const en = phase === 'next' ? `${A.en} + ${B.en} = ?` : phase === 'nextres' ? NEXT.r.en : phase === 'a' ? A.en : isRes ? it.r.en : `${A.en} + ${B.en}`;
  const t0 = phase === 'a' ? tt.a : isRes ? tRes : tB;
  const enOp = t0 === 0 ? 1 : interpolate(t, [t0, t0 + 0.1], [0, 1], clamp);
  const aIn = phase === 'a' && tt.a > 0 ? interpolate(t, [tt.a, tt.a + 0.2], [0.6, 1], { ...clamp, easing: OUT }) : phase === 'next' ? interpolate(t, [NEXT.at, NEXT.at + 0.2], [0.6, 1], { ...clamp, easing: OUT }) : 1;
  const q = phase === 'next' ? interpolate(t, [NEXT.at + 0.35, NEXT.at + 0.55], [0, 1], clamp) : 0;
  const badgeOn = !tail && it.badge && t >= it.badge.from && t < it.badge.to;
  const bp = it.badge ? interpolate(t, [it.badge.from, it.badge.from + 0.2], [0.4, 1], { ...clamp, easing: OUT }) : 1;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 858, textAlign: 'center' }}>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 54, color: C.white, textShadow: OUTLINE(3), letterSpacing: 0.5, opacity: enOp }}>{en}</div>
        <div style={{ marginTop: 26, display: 'flex', justifyContent: 'center', alignItems: 'stretch', transform: `scale(${snapPop})` }}>
          <WordBrick ko={A.ko} rom={A.rom} bg={C.a} join={showB ? 'l' : undefined} s={aIn} />
          {showB ? <Plus g={g} /> : null}
          {showB ? <WordBrick ko={B.ko} rom={B.rom} bg={C.b} join="r" s={bIn} o={Math.min(1, bIn * 1.4)} /> : null}
          {phase === 'next' ? <div style={{ alignSelf: 'center', marginLeft: 20, fontFamily: EN, fontWeight: 800, fontSize: 96, color: C.white, textShadow: OUTLINE(4), opacity: q }}>= ?</div> : null}
        </div>
      </div>
      {isRes ? <SnapBurst t={t} at={tRes} /> : null}
      {badgeOn ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: CARD.y + 22, display: 'flex', justifyContent: 'center' }}>
          <div style={{ transform: `rotate(-2deg) scale(${bp})`, background: C.badge, color: '#3A2400', fontFamily: KO, fontWeight: 800, fontSize: 54, padding: '12px 30px', borderRadius: 22, boxShadow: '0 8px 22px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
            {it.badge!.text}
          </div>
        </div>
      ) : null}
    </>
  );
};
// ── 머리 글: 조각 두 개가 끼워진 「KOREAN | WORD SNAP」 — 합쳐질 때마다 딸깍 ─────────────
const Brick: React.FC<{ text: string; bg: string; side: 'l' | 'r' }> = ({ text, bg, side }) => (
  <div style={{ position: 'relative', background: bg, padding: '10px 26px 8px', borderRadius: side === 'l' ? '16px 4px 4px 16px' : '4px 16px 16px 4px', boxShadow: 'inset 0 -6px 0 rgba(0,0,0,0.12), 0 6px 16px rgba(0,0,0,0.45)' }}>
    {[0.3, 0.7].map((p) => (
      <div key={p} style={{ position: 'absolute', top: -11, left: `calc(${p * 100}% - 15px)`, width: 30, height: 13, borderRadius: '8px 8px 2px 2px', background: bg, boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.12)' }} />
    ))}
    <span style={{ fontFamily: EN, fontWeight: 800, fontSize: 44, color: C.ink, letterSpacing: 1.5 }}>{text}</span>
  </div>
);

const Header: React.FC<{ t: number }> = ({ t }) => {
  let gap = 0;
  for (const it of ITEMS) gap = Math.max(gap, interpolate(t, [it.t.res - 0.25, it.t.res - 0.05, it.t.res + 0.05], [0, 16, 0], clamp));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 104, display: 'flex', justifyContent: 'center', gap: 3 + gap }}>
      <Brick text="KOREAN" bg={C.a} side="l" />
      <Brick text="WORD SNAP" bg={C.b} side="r" />
    </div>
  );
};

// ── 소리 ────────────────────────────────────────────────────────
const Sounds: React.FC = () => {
  const sfx: { f: string; at: number; v: number }[] = [];
  for (const it of ITEMS) {
    sfx.push({ f: 'tok', at: it.t.b, v: 0.35 });
    sfx.push({ f: 'pop', at: it.t.both, v: 0.45 });
    sfx.push({ f: 'tok', at: it.t.res - 0.05, v: 0.6 }); // 딸깍 — 조각이 끼워지는 소리
    sfx.push({ f: 'sparkle', at: it.t.res, v: 0.35 });
  }
  sfx.push({ f: 'whoosh', at: FINALE - 0.1, v: 0.35 });
  sfx.push({ f: 'achieve', at: FINALE + 0.05, v: 0.3 });
  sfx.push({ f: 'pop', at: NEXT.at, v: 0.5 });
  sfx.push({ f: 'ding1', at: NEXT.at + 0.38, v: 0.4 });
  sfx.push({ f: 'tok', at: NEXT.res - 0.05, v: 0.6 });
  sfx.push({ f: 'sparkle', at: NEXT.res, v: 0.4 });
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={(f) => 0.24 * MASTER * interpolate(f, [fr(TOTAL) - 12, fr(TOTAL)], [1, 0], clamp)} />
      {VOICE.map((v, k) => (
        <Sequence key={`v${k}`} from={fr(v.at)} layout="none">
          <Audio src={staticFile(`v/${v.id}.wav`)} volume={1.0 * MASTER} />
        </Sequence>
      ))}
      {sfx.map((s, k) => (
        <Sequence key={`s${k}`} from={Math.max(0, fr(s.at))} layout="none">
          <Audio src={staticFile(`sfx/${s.f}.wav`)} volume={s.v * MASTER} />
        </Sequence>
      ))}
    </>
  );
};

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  return (
    <AbsoluteFill>
      <Stage t={t} />
      <Header t={t} />
      <Card t={t} />
      <Labels t={t} />
      <Sounds />
    </AbsoluteFill>
  );
};
