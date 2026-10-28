// LAB E6 v4 「발 · 빨 · 팔」 다시 살림 — 종이 시험(입 앞 종이띠, 0초부터) → 귀 시험 댓글 놀이(카드 ① ② ③, 답을 바로) → 종이 들고 해 보기.
// v3 Film.tsx의 그림 · 종이띠 · 숨 줄기 · 카드 · 말풍선을 그대로 가져와 순서와 글만 바꿨다. 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { fr, T } from './timelineV4';

const C = {
  coral: '#F96859',
  coralShade: '#C2392C',
  brown: '#2B1A14',
  cream: '#FFFDF8',
  mint: '#CFE7DA',
  green: '#2E9E6A',
};
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE = Easing.bezier(0.16, 1, 0.3, 1);

// ── 배경 사진(판/ 1024×1536 → 1.25배, 위아래 꽉) ─────────────────────────
// B1 종이대: 집게 아래 끝 (618, 655) · 몽글 입 (478, 772) — 왼쪽을 50px만 잘라 몽글이 화면 가장자리에 닿지 않게
const K = 1.25;
const B1_X = -50;
const CLIP: [number, number] = [618 * K + B1_X, 655 * K];
const MOUTH: [number, number] = [478 * K + B1_X + 22, 772 * K];
const PAPER = { w: 46, h: 304 }; // paper.png 202×1334 비율

const Bg: React.FC<{ src: string; x: number; zoom?: number }> = ({ src, x, zoom = 1 }) => (
  <Img
    src={staticFile(src)}
    style={{ position: 'absolute', left: x, top: 0, width: 1024 * K, height: 1536 * K, transformOrigin: `${540 - x}px 960px`, transform: `scale(${zoom})` }}
  />
);

// ── 종이띠: 집게에 매달려, 소리마다 숨에 밀린다(오른쪽으로 = 음의 각) ─────────────
// v4: 「빨」(2.35초)에서 종이가 이미 멈춰 있어야 대비가 보인다 — 팔 숨은 1초 가까이 떠 있다가 빨리 가라앉게(decay 1.9).
type Puff = { at: number; amp: number; decay: number };
const PUFFS: Puff[] = [
  { at: -0.6, amp: 14, decay: 1.6 }, // 첫 프레임부터 아주 조금 흔들리는 중(멈춘 그림이 아니게)
  { at: T.k1 + 0.07, amp: 80, decay: 1.9 }, // 팔 — 크게
  { at: T.k3 + 0.07, amp: 80, decay: 1.9 }, // 끝의 팔 — 한 번 더
];
const swing = (t: number) => {
  let a = 1.1 * Math.sin(t * 2 * Math.PI * 0.55); // 가만있어도 아주 조금 흔들린다
  for (const p of PUFFS) {
    const tau = t - p.at;
    if (tau > 0) a += p.amp * ((1 - Math.exp(-tau / 0.05)) * Math.exp(-p.decay * tau) + 0.06 * Math.sin(16 * tau) * Math.exp(-2 * tau));
  }
  return a;
};

const Paper: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const a = swing(t);
  const v = swing(t + 1 / 30) - a; // 빨리 움직일 때 종이가 조금 휜다
  return (
    <Img
      src={staticFile('img/paper.png')}
      style={{
        position: 'absolute',
        left: CLIP[0] - PAPER.w / 2,
        top: CLIP[1] - 6,
        width: PAPER.w,
        height: PAPER.h,
        transformOrigin: '50% 6px',
        transform: `rotate(${-a}deg) skewX(${Math.max(-10, Math.min(10, v * 1.6))}deg)`,
        filter: 'drop-shadow(3px 6px 6px rgba(60,40,20,0.22))',
      }}
    />
  );
};

/** 숨 줄기(💨) — 입에서 종이 쪽으로. */
const Breath: React.FC<{ at: number; lines: number; strength: number }> = ({ at: t0, lines, strength }) => {
  const f = useCurrentFrame();
  const t = f / 30 - t0;
  if (t < 0 || t > 0.7) return null;
  const go = interpolate(t, [0, 0.3], [0, 1], { ...clamp, easing: EASE });
  const fade = interpolate(t, [0.25, 0.7], [1, 0], clamp);
  const [x, y] = MOUTH;
  const L = 150 * strength;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: lines }).map((_, i) => {
        const dy = (i - (lines - 1) / 2) * 34;
        const x0 = x + 18 + go * L * 0.35;
        const x1 = x + 18 + go * L;
        const d = `M ${x0} ${y + dy} Q ${(x0 + x1) / 2} ${y + dy - 14} ${x1} ${y + dy + 4}`;
        return <path key={i} d={d} fill="none" stroke="#FFFFFF" strokeWidth={9} strokeLinecap="round" opacity={0.9 * fade} />;
      })}
    </svg>
  );
};

// ── 글 ───────────────────────────────────────────────────────────
const HG: React.CSSProperties = { fontFamily: KO, fontWeight: 800, fontSize: '1.12em', lineHeight: 0.9 };
/** 글 속 한글(팔 · 빨 · 발)만 한글 서체로. */
const withHangul = (s: string) => s.split(/([가-힣]+)/).map((p, i) => (/[가-힣]/.test(p) ? <span key={i} style={HG}>{p}</span> : p));

const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at: t, children, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = t <= 0 ? 1 : spring({ frame: f - fr(t), fps, config: { damping: 15, stiffness: 180, mass: 0.7 } });
  if (f < fr(t)) return null;
  return (
    <span style={{ display: 'inline-block', opacity: interpolate(sp, [0, 0.5], [0, 1], clamp), transform: `translateY(${(1 - sp) * 24}px) scale(${0.92 + 0.08 * sp})`, ...style }}>
      {children}
    </span>
  );
};

const Kicker: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg = C.coral }) => (
  <div style={{ display: 'inline-block', background: bg, color: C.brown, fontFamily: EN, fontWeight: 800, fontSize: 46, lineHeight: 1.1, padding: '10px 24px 12px', borderRadius: 16, marginBottom: 18, letterSpacing: 0.5 }}>{children}</div>
);

const BIG: React.CSSProperties = { fontFamily: EN, fontWeight: 800, fontSize: 92, lineHeight: 1.08, color: C.brown, letterSpacing: -1, textShadow: '0 2px 0 rgba(255,255,255,0.35)' };

const Zone: React.FC<{ children: React.ReactNode; top?: number; height?: number }> = ({ children, top = 150, height = 400 }) => (
  <div style={{ position: 'absolute', left: 60, width: 960, top, height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
    {children}
  </div>
);

const ROM: React.CSSProperties = { fontFamily: EN, fontWeight: 700, fontSize: '0.6em', color: C.coralShade, letterSpacing: 0 };
const ROMA: Record<string, string> = { 팔: 'pal', 빨: 'ppal', 발: 'bal' };
const EMOJI: React.CSSProperties = { fontFamily: "'Segoe UI Emoji', 'Noto Color Emoji', sans-serif", fontWeight: 400 };

/** 종이 시험 한 줄: 「팔 (pal) → big puff! 💨」 — 소리가 날 때 한글이, 결과가 나올 때 뒤쪽이 뜬다. */
const Row: React.FC<{ ko: string; at: number; resAt: number; res: React.ReactNode; color: string; dim?: boolean }> = ({ ko, at, resAt, res, color, dim }) => (
  <div style={{ ...BIG, fontSize: 68, opacity: dim ? 0.55 : 1, whiteSpace: 'nowrap' }}>
    <Pop at={at}>
      {withHangul(ko)}
      <span style={ROM}> ({ROMA[ko]})</span>
    </Pop>{' '}
    <Pop at={resAt} style={{ color }}>
      <span style={{ opacity: 0.45, color: C.brown }}>→</span> {res}
    </Pop>
  </div>
);

// v5: 화면 줄은 종이가 어떻게 되는지만(「it flies! · it doesn't move.」 = 한 문장), 까닭(Big puff · No air)은 목소리로.
// v4 이해 시험에서 「big puff · no air」가 그 낱말의 뜻인지 소리 설명인지 헷갈렸다.
const Titles: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  if (t < T.test) {
    return (
      <Zone height={440}>
        <Kicker>PAPER TEST <span style={EMOJI}>📄</span></Kicker>
        {/* v6(v5 이해 시험 3점 — 「팔이 낱말인지 소리 연습인지 모름」): 소리 둘을 견주는 시험임을 0초에 */}
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 50, color: C.brown, marginBottom: 6 }}>2 Korean sounds. Watch the paper.</div>
        <Row ko="팔" at={0} resAt={T.k1 + 0.3} res="it flies!" color={C.coralShade} dim={t >= T.k2} />
        {t >= T.k2 ? <Row ko="빨" at={T.k2} resAt={T.k2 + 0.4} res="it doesn't move." color={C.green} /> : null}
      </Zone>
    );
  }
  if (t < T.reveal) {
    return (
      <Zone height={330}>
        <Pop at={T.test}>
          <Kicker bg="#FFFFFF">NOW YOU <span style={EMOJI}>🎧</span></Kicker>
        </Pop>
        <Pop at={T.test + 0.1} style={{ ...BIG, fontSize: 84 }}>
          Which one is {withHangul('빨')}<span style={ROM}> (ppal)</span>?
        </Pop>
        <Pop at={T.h1 + 1.0} style={{ fontFamily: EN, fontWeight: 800, fontSize: 52, color: C.green, marginTop: 10 }}>Hint: the sound with no air</Pop>
      </Zone>
    );
  }
  if (t < T.end) {
    return (
      <Zone height={330}>
        <Pop at={T.reveal} style={{ ...BIG, fontSize: 96, color: C.green }}>
          It's 2! <span style={EMOJI}>✅</span>
        </Pop>
        <Pop at={T.reveal + 0.25} style={{ fontFamily: EN, fontWeight: 800, fontSize: 56, color: C.brown, marginTop: 10 }}>
          {withHangul('빨')} (ppal) — no air
        </Pop>
      </Zone>
    );
  }
  return (
    <Zone height={400}>
      <Pop at={T.end} style={{ ...BIG, fontSize: 84 }}>Try it with a paper! <span style={EMOJI}>📄</span></Pop>
      <Pop at={T.end + 0.25} style={{ fontFamily: EN, fontWeight: 800, fontSize: 60, color: C.coralShade, marginTop: 12 }}>
        {withHangul('팔')} → it flies. {withHangul('빨')} → it doesn't.
      </Pop>
      {/* v6: 「Did you get 2?」가 댓글 질문인지 모호 — 종이를 해 본 결과를 댓글로 */}
      <Pop at={T.e1 + 1.0} style={{ fontFamily: EN, fontWeight: 800, fontSize: 52, color: C.brown, marginTop: 14 }}>
        Did your paper fly? Comment <span style={{ ...EMOJI, display: 'inline-block', transform: `translateY(${Math.sin((t - T.e1) * 5) * 9}px)` }}>👇</span>
      </Pop>
    </Zone>
  );
};

// ── 카드 ① ② ③(귀 시험) ──────────────────────────────────────────────
// v5: 두 소리만 — 세 소리(팔 · 발 · 빨)는 입문자 귀에 「거의 똑같아」 6.9~9초에 넘겼고, 「발」은 설명 없이 나왔다
const SOUNDS = [
  { n: 1, ko: '팔', at: T.s1, vo: 'kp' },
  { n: 2, ko: '빨', at: T.s2, vo: 'kpp' },
] as const;
const ANSWER = 2;

/** 소리 막대(카드가 소리를 낼 때만). */
const Bars: React.FC<{ on: number; seed: number }> = ({ on, seed }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'center', height: 64 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const h = 14 + on * (22 + 26 * Math.abs(Math.sin(f * 0.55 + i * 1.3 + seed)));
        return <div key={i} style={{ width: 11, height: h, borderRadius: 6, background: on > 0.05 ? C.coral : '#D9CFC8' }} />;
      })}
    </div>
  );
};

const Cards: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / 30;
  return (
    <div style={{ position: 'absolute', left: 0, width: 1080, top: 1290, display: 'flex', justifyContent: 'center', gap: 60, paddingRight: 40 }}>
      {SOUNDS.map((s, i) => {
        const on = interpolate(t, [s.at - 0.1, s.at, s.at + 0.5, s.at + 0.66], [0, 1, 1, 0], clamp);
        const seen = t >= T.reveal;
        const sp = seen ? spring({ frame: f - fr(T.reveal + i * 0.06), fps, config: { damping: 11, stiffness: 210, mass: 0.6 } }) : 0;
        const right = s.n === ANSWER && seen;
        const enter = spring({ frame: f - fr(T.test + 0.15 + i * 0.08), fps, config: { damping: 16, stiffness: 190 } });
        return (
          <div
            key={s.n}
            style={{
              width: 300,
              height: 240,
              borderRadius: 30,
              background: C.cream,
              border: `6px solid ${right ? C.green : on > 0.5 ? C.coral : 'rgba(43,26,20,0.12)'}`,
              boxShadow: '0 10px 24px rgba(60,35,20,0.20)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transform: `translateY(${(1 - enter) * 60}px) scale(${(1 + 0.08 * on + 0.1 * (right ? sp : 0)) * (0.85 + 0.15 * enter)})`,
              opacity: enter * (seen && !right ? 0.75 : 1),
              position: 'relative',
            }}
          >
            <div style={{ position: 'absolute', top: -26, left: -14, width: 70, height: 70, borderRadius: 35, background: right ? C.green : C.coral, color: right ? '#fff' : C.brown, fontFamily: EN, fontWeight: 800, fontSize: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(80,30,20,0.2)' }}>
              {s.n}
            </div>
            {seen ? (
              <div style={{ transform: `scale(${0.6 + 0.4 * sp})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 96, color: right ? C.green : C.brown, lineHeight: 1 }}>{s.ko}</span>
                <span style={{ fontFamily: EN, fontWeight: 700, fontSize: 32, color: C.brown, opacity: 0.7, lineHeight: 1 }}>{ROMA[s.ko]}</span>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 96, color: C.brown, lineHeight: 1, opacity: 0.85 }}>?</div>
                <Bars on={on} seed={i * 2} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

// 「Your answer: 1, 2 or 3? 👇」 알약 — 세 소리가 끝나면 답이 나올 때까지(카드 위).
const AskChip: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / 30;
  if (t < T.ask || t >= T.reveal) return null;
  const sp = spring({ frame: f - fr(T.ask), fps, config: { damping: 13, stiffness: 200, mass: 0.6 } });
  const out = interpolate(t, [T.reveal - 0.15, T.reveal], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, width: 1010, top: 1176, display: 'flex', justifyContent: 'center', opacity: sp * out }}>
      <div style={{ background: C.brown, color: '#fff', fontFamily: EN, fontWeight: 800, fontSize: 48, padding: '10px 28px 12px', borderRadius: 40, transform: `scale(${0.7 + 0.3 * sp})` }}>
        Your answer: 1 or 2? <span style={{ ...EMOJI, display: 'inline-block', transform: `translateY(${Math.sin((t - T.ask) * 6) * 6}px)` }}>👇</span>
      </div>
    </div>
  );
};

/** 몽글 말풍선 — 종이 시험에서 몽글이 종이에 대고 말하는 것을 보인다. */
const Say: React.FC<{ at: number; ko: string }> = ({ at: t0, ko }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / 30;
  if (t < t0 - 0.05 || t > t0 + 1.25) return null;
  const sp = spring({ frame: f - fr(t0 - 0.05), fps, config: { damping: 11, stiffness: 240, mass: 0.5 } });
  const out = interpolate(t, [t0 + 1.0, t0 + 1.25], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: MOUTH[0] - 300, top: MOUTH[1] - 330, width: 210, height: 170, opacity: out, transform: `scale(${0.5 + 0.5 * sp})`, transformOrigin: '85% 100%' }}>
      <svg width={210} height={170} style={{ position: 'absolute', inset: 0 }}>
        <path d="M 18 10 H 192 Q 204 10 204 22 V 112 Q 204 124 192 124 H 168 L 196 160 L 132 124 H 18 Q 6 124 6 112 V 22 Q 6 10 18 10 Z" fill="#FFFFFF" stroke={C.brown} strokeWidth={5} />
      </svg>
      <div style={{ position: 'absolute', left: 0, top: 10, width: 210, height: 114, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 800, fontSize: 86, color: C.brown }}>{ko}!</div>
    </div>
  );
};

/** 입과 종이 사이의 숨 꼬리표 — 팔은 「puff of air」, 빨은 「no air」(v5 이해 시험: Big puff · No air가 무엇의 설명인지 안 와닿음 → 숨을 그 자리에 글로). */
const AirTag: React.FC<{ at: number; until: number; text: string; bg: string; fg: string }> = ({ at: t0, until, text, bg, fg }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / 30;
  if (t < t0 || t > until) return null;
  const sp = spring({ frame: f - fr(t0), fps, config: { damping: 12, stiffness: 220, mass: 0.5 } });
  const out = interpolate(t, [until - 0.2, until], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: MOUTH[0] + 10, top: MOUTH[1] + 70, background: bg, color: fg, fontFamily: EN, fontWeight: 800, fontSize: 44, padding: '6px 18px 9px', borderRadius: 16, whiteSpace: 'nowrap', boxShadow: '0 6px 14px rgba(60,35,20,0.18)', transform: `scale(${0.6 + 0.4 * sp})`, opacity: interpolate(sp, [0, 0.4], [0, 1], clamp) * out, transformOrigin: 'left center' }}>
      {text}
    </div>
  );
};

// ── 소리 ─────────────────────────────────────────────────────────
const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at: t, vol = 1 }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`vo4/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; at: number; vol: number }> = ({ file, at: t, vol }) => (
  <Sequence from={Math.max(0, fr(t))} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={vol * MASTER} />
  </Sequence>
);

// 한국어 소리가 날 때는 배경음을 거의 끈다(소리가 묻히지 않게)
const bgmLevel = (sec: number) => {
  const quiet: [number, number][] = [[T.k1 - 0.1, T.k1 + 0.6], [T.k2 - 0.1, T.k2 + 0.65], [T.s1 - 0.15, T.s2 + 0.65], [T.k3 - 0.1, T.k3 + 0.6]];
  let lv = 0.16;
  for (const [a, b] of quiet) lv = Math.min(lv, interpolate(sec, [a - 0.15, a, b, b + 0.2], [0.16, 0.02, 0.02, 0.16], clamp));
  return lv;
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => bgmLevel(i / 30) * MASTER * interpolate(i, [fr(T.total) - 24, fr(T.total)], [1, 0], clamp)} />
    <Vo id="kp" at={T.k1} />
    <Sfx file="whoosh_side.wav" at={T.k1 + 0.1} vol={0.32} />
    <Vo id="b1" at={T.b1} />
    <Vo id="kpp" at={T.k2} />
    <Vo id="n1" at={T.n1} />
    <Sfx file="ding2.wav" at={T.k2 + 0.4} vol={0.22} />
    <Sfx file="swish.wav" at={T.test - 0.08} vol={0.35} />
    <Vo id="h1" at={T.h1} />
    {SOUNDS.map((s) => (
      <Vo key={s.n} id={s.vo} at={s.at} />
    ))}
    <Sfx file="pop.wav" at={T.ask} vol={0.25} />
    <Vo id="c2" at={T.ask + 0.05} />
    <Sfx file="ding2.wav" at={T.reveal} vol={0.3} />
    <Vo id="r2" at={T.r2} />
    <Sfx file="swish.wav" at={T.end - 0.08} vol={0.3} />
    <Vo id="e1" at={T.e1} />
    <Vo id="kp" at={T.k3} />
    <Sfx file="whoosh_side.wav" at={T.k3 + 0.1} vol={0.3} />
  </>
);

// ── 화면 ─────────────────────────────────────────────────────────
export const FilmV4: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const testScene = t >= T.test && t < T.end;
  // 장면마다 천천히 다가간다(멈춘 화면이 되지 않게)
  const zoom = testScene
    ? interpolate(t, [T.test, T.end], [1.0, 1.06], clamp)
    : t < T.test
      ? interpolate(t, [0, T.test], [1.0, 1.07], clamp)
      : interpolate(t, [T.end, T.total], [1.03, 1.0], clamp);
  return (
    <AbsoluteFill style={{ background: C.mint }}>
      {testScene ? (
        <Bg src="img/listen.jpg" x={-100} zoom={zoom} />
      ) : (
        <AbsoluteFill style={{ transformOrigin: `${CLIP[0]}px ${MOUTH[1]}px`, transform: `scale(${zoom})` }}>
          <Bg src="img/stand.jpg" x={B1_X} />
          <Paper />
          <Breath at={T.k1 + 0.04} lines={3} strength={1} />
          <Breath at={T.k3 + 0.04} lines={3} strength={1} />
          <Say at={T.k1} ko="팔" />
          <Say at={T.k2} ko="빨" />
          <Say at={T.k3} ko="팔" />
          <AirTag at={T.k1 + 0.15} until={T.k2 - 0.1} text="puff of air!" bg="#FFFFFF" fg={C.coralShade} />
          <AirTag at={T.k2 + 0.25} until={T.test} text="no air" bg={C.green} fg="#FFFFFF" />
          <AirTag at={T.k3 + 0.15} until={T.total} text="puff of air!" bg="#FFFFFF" fg={C.coralShade} />
        </AbsoluteFill>
      )}
      <Titles />
      {testScene ? <Cards /> : null}
      <AskChip />
      <Sound />
    </AbsoluteFill>
  );
};
