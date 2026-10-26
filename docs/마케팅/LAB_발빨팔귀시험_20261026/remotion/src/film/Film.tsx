// LAB E6 「발 · 빨 · 팔 귀 시험」 — 귀 시험(카드 ① ② ③) → 종이 시험(입 앞 종이띠). 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { fr, T } from './timeline';

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
type Puff = { at: number; amp: number };
const PUFFS: Puff[] = [
  { at: -0.3, amp: 60 }, // 첫 화면은 방금 밀린 종이가 내려오는 중(첫 프레임부터 움직임)
  { at: T.r1 + 0.07, amp: 78 }, // 팔 — 크게, 1초 가까이 떠 있다
  { at: T.r3 + 0.07, amp: 32 }, // 발 — 조금(눈에 보이게)
];
const swing = (t: number) => {
  let a = 1.1 * Math.sin(t * 2 * Math.PI * 0.55); // 가만있어도 아주 조금 흔들린다(멈춘 그림처럼 보이지 않게)
  for (const p of PUFFS) {
    const tau = t - p.at;
    if (tau > 0) a += p.amp * ((1 - Math.exp(-tau / 0.05)) * Math.exp(-1.4 * tau) + 0.06 * Math.sin(16 * tau) * Math.exp(-2 * tau));
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

/** 숨 줄기(💨) — 입에서 종이 쪽으로. 팔은 셋 · 발은 하나. */
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

const Zone: React.FC<{ children: React.ReactNode; top?: number; height?: number; opacity?: number }> = ({ children, top = 150, height = 380, opacity = 1 }) => (
  <div style={{ position: 'absolute', left: 70, width: 940, top, height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity }}>
    {children}
  </div>
);

const ROM: React.CSSProperties = { fontFamily: EN, fontWeight: 700, fontSize: '0.62em', color: C.coralShade, letterSpacing: 0 };
const ROMA: Record<string, string> = { 팔: 'pal', 빨: 'ppal', 발: 'bal' };
const EMOJI: React.CSSProperties = { fontFamily: "'Segoe UI Emoji', 'Noto Color Emoji', sans-serif", fontWeight: 400 };

const Titles: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  if (t < T.test) {
    return (
      <Zone>
        <Kicker>10-SEC EAR TEST <span style={EMOJI}>🎧</span></Kicker>
        <div style={BIG}>Which sound<br />is {withHangul('빨')}<span style={ROM}> (ppal)</span>?</div>
      </Zone>
    );
  }
  if (t < T.x1) {
    return (
      <Zone height={330}>
        <div style={{ ...BIG, fontSize: 84 }}>Which sound is {withHangul('빨')}<span style={ROM}> (ppal)</span>?</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 48, color: C.coralShade, marginTop: 14 }}>
          Listen <span style={EMOJI}>🎧</span>
        </div>
      </Zone>
    );
  }
  if (t < T.paper) {
    return (
      <Zone height={330}>
        <Pop at={T.x1} style={{ ...BIG, fontSize: 92 }}>Can't hear it?</Pop>
      </Zone>
    );
  }
  if (t < T.r1) {
    return (
      <Zone>
        <Pop at={T.paper}>
          <Kicker bg="#FFFFFF">PAPER TEST <span style={EMOJI}>📄</span></Kicker>
        </Pop>
        <Pop at={T.paper} style={BIG}>Watch the paper!</Pop>
        <Pop at={T.paper + 0.35} style={{ fontFamily: EN, fontWeight: 800, fontSize: 54, color: C.coralShade, marginTop: 12 }}>It hangs in front of the mouth.</Pop>
      </Zone>
    );
  }
  const row = (at: number, ko: string, text: React.ReactNode, sub?: React.ReactNode, subAt?: number, subColor = C.coralShade) => (
    <>
      <Pop at={at} style={{ ...BIG, fontSize: 88 }}>
        {withHangul(ko)}<span style={ROM}> ({ROMA[ko]})</span> <span style={{ opacity: 0.45 }}>→</span> {text}
      </Pop>
      {sub ? (
        <Pop at={subAt ?? at + 0.4} style={{ fontFamily: EN, fontWeight: 800, fontSize: 62, color: subColor, marginTop: 14 }}>
          {sub}
        </Pop>
      ) : null}
    </>
  );
  if (t < T.r2) return <Zone>{row(T.r1, '팔', 'big puff!', 'The paper flies.', T.b1 + 0.1)}</Zone>;
  if (t < T.r3) return <Zone>{row(T.r2, '빨', 'no air', <>It's 2! <span style={EMOJI}>✅</span></>, T.a1 + 1.05, C.green)}</Zone>;
  if (t < T.end) return <Zone>{row(T.r3, '발', 'a little air', 'The paper moves a bit.', T.l1 + 0.2)}</Zone>;
  return (
    <Zone height={400}>
      <Pop at={T.end} style={{ ...BIG, fontSize: 84 }}>{withHangul('팔')} blows the paper.</Pop>
      <Pop at={T.end + 0.25} style={{ ...BIG, fontSize: 84, color: C.coralShade }}>{withHangul('빨')} doesn't.</Pop>
      <Pop at={T.e1 + 0.6} style={{ fontFamily: EN, fontWeight: 700, fontSize: 46, color: C.brown, marginTop: 18 }}>
        Hold a paper in front of your mouth.
      </Pop>
      <Pop at={T.e1 + 1.3} style={{ fontFamily: EN, fontWeight: 800, fontSize: 52, color: C.brown, marginTop: 10 }}>
        Try it! Did yours move? <span style={{ ...EMOJI, display: 'inline-block', transform: `translateY(${Math.sin((t - T.e1) * 5) * 9}px)` }}>👇</span>
      </Pop>
    </Zone>
  );
};

// ── 카드 ① ② ③ ─────────────────────────────────────────────────────
const SOUNDS = [
  { n: 1, ko: '팔', at: T.s1, reveal: T.r1, note: 'flies' },
  { n: 2, ko: '빨', at: T.s2, reveal: T.r2, note: 'still' },
  { n: 3, ko: '발', at: T.s3, reveal: T.r3, note: 'a little' },
] as const;

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

const Cards: React.FC<{ mode: 'test' | 'reveal' }> = ({ mode }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / 30;
  const W = mode === 'test' ? 262 : 232;
  const H = mode === 'test' ? 232 : 206;
  const top = mode === 'test' ? 1290 : 1318;
  return (
    <div style={{ position: 'absolute', left: 0, width: 1080, top, display: 'flex', justifyContent: 'center', gap: mode === 'test' ? 30 : 34, paddingRight: 70 }}>
      {SOUNDS.map((s, i) => {
        // 귀 시험: 그 소리를 내는 동안(두 번 + 사이) 카드가 커지고 막대가 춤춘다
        const on = mode === 'test' ? interpolate(t, [s.at - 0.1, s.at, s.at + 0.5, s.at + 0.66], [0, 1, 1, 0], clamp) : 0;
        const seen = mode === 'reveal' && t >= s.reveal;
        const sp = seen ? spring({ frame: f - fr(s.reveal), fps, config: { damping: 11, stiffness: 210, mass: 0.6 } }) : 0;
        const right = s.n === 2 && seen;
        const enter = spring({ frame: f - fr((mode === 'test' ? T.test : T.paper) + i * 0.08), fps, config: { damping: 16, stiffness: 190 } });
        return (
          <div
            key={s.n}
            style={{
              width: W,
              height: H,
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
              opacity: enter,
              position: 'relative',
            }}
          >
            <div style={{ position: 'absolute', top: -26, left: -14, width: 70, height: 70, borderRadius: 35, background: right ? C.green : C.coral, color: right ? '#fff' : C.brown, fontFamily: EN, fontWeight: 800, fontSize: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(80,30,20,0.2)' }}>
              {s.n}
            </div>
            {mode === 'test' ? (
              <>
                <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 96, color: C.brown, lineHeight: 1, opacity: 0.85 }}>?</div>
                <Bars on={on} seed={i * 2} />
              </>
            ) : seen ? (
              <div style={{ transform: `scale(${0.6 + 0.4 * sp})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 92, color: right ? C.green : C.brown, lineHeight: 1 }}>{s.ko}</span>
                <span style={{ fontFamily: EN, fontWeight: 700, fontSize: 30, color: C.brown, opacity: 0.7, lineHeight: 1 }}>{ROMA[s.ko]}</span>
                <span style={{ fontFamily: EN, fontWeight: 800, fontSize: 36, color: right ? C.green : C.coralShade, lineHeight: 1 }}>{s.note}</span>
              </div>
            ) : (
              <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 90, color: C.brown, opacity: 0.35, lineHeight: 1 }}>?</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// 「1, 2 or 3? 👇」 알약 — 귀 시험이 끝나면 답이 나올 때까지(카드 위). 따로 멈춰 기다리는 구간은 두지 않는다(v1 이해 시험).
const AskChip: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / 30;
  if (t < T.ask || t >= T.r2) return null;
  const sp = spring({ frame: f - fr(T.ask), fps, config: { damping: 13, stiffness: 200, mass: 0.6 } });
  const out = interpolate(t, [T.r2 - 0.15, T.r2], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, width: 1010, top: t < T.paper ? 1196 : 1222, display: 'flex', justifyContent: 'center', opacity: sp * out }}>
      <div style={{ background: C.brown, color: '#fff', fontFamily: EN, fontWeight: 800, fontSize: 46, padding: '10px 28px 12px', borderRadius: 40, transform: `scale(${0.7 + 0.3 * sp})` }}>
        Your answer: 1, 2 or 3? <span style={{ ...EMOJI, display: 'inline-block', transform: `translateY(${Math.sin((t - T.ask) * 6) * 6}px)` }}>👇</span>
      </div>
    </div>
  );
};

/** 몽글 말풍선 — 종이 시험에서 소리를 낼 때 몽글이 종이에 대고 말하는 것을 보인다(v1 이해 시험: 누가 왜 부는지 안 보였다). */
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

// ── 소리 ─────────────────────────────────────────────────────────
const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at: t, vol = 1 }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; at: number; vol: number }> = ({ file, at: t, vol }) => (
  <Sequence from={Math.max(0, fr(t))} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={vol * MASTER} />
  </Sequence>
);

// 귀 시험 소리가 날 때는 배경음을 거의 끈다(시험 소리가 묻히지 않게)
const bgmLevel = (sec: number) => {
  const quiet: [number, number][] = [[T.hq - 0.1, T.hq + 0.6], [T.s1 - 0.15, T.s3 + 0.6], [T.r1 - 0.1, T.r2 + 0.65], [T.r3 - 0.1, T.r3 + 0.55]];
  let lv = 0.16;
  for (const [a, b] of quiet) lv = Math.min(lv, interpolate(sec, [a - 0.15, a, b, b + 0.2], [0.16, 0.02, 0.02, 0.16], clamp));
  return lv;
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => bgmLevel(i / 30) * MASTER * interpolate(i, [fr(T.total) - 24, fr(T.total)], [1, 0], clamp)} />
    <Vo id="h2" at={T.h1} />
    <Vo id="kpp" at={T.hq} />
    <Sfx file="swish.wav" at={T.test - 0.08} vol={0.35} />
    {SOUNDS.map((s) => (
      <React.Fragment key={s.n}>
        <Vo id={['kp', 'kpp', 'kb'][s.n - 1]} at={s.at} />
      </React.Fragment>
    ))}
    <Sfx file="pop.wav" at={T.ask} vol={0.25} />
    <Sfx file="swish.wav" at={T.paper - 0.08} vol={0.35} />
    <Vo id="x1" at={T.x1} />
    <Vo id="kp" at={T.r1} />
    <Sfx file="whoosh_side.wav" at={T.r1 + 0.1} vol={0.32} />
    <Vo id="b1" at={T.b1} />
    <Vo id="kpp" at={T.r2} />
    <Sfx file="ding2.wav" at={T.r2 + 0.55} vol={0.3} />
    <Vo id="a2" at={T.a1} />
    <Vo id="kb" at={T.r3} />
    <Vo id="l1" at={T.l1} />
    <Sfx file="pop.wav" at={T.end} vol={0.3} />
    <Vo id="e1" at={T.e1} />
  </>
);

// ── 화면 ─────────────────────────────────────────────────────────
export const Film: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const testScene = t >= T.test && t < T.paper;
  // 종이 시험 장면은 천천히 다가간다(멈춘 화면이 되지 않게)
  const zoom = testScene
    ? interpolate(t, [T.test, T.paper], [1.0, 1.06], clamp)
    : t < T.test
      ? interpolate(t, [0, T.test], [1.0, 1.03], clamp)
      : interpolate(t, [T.paper, T.total], [1.0, 1.07], clamp);
  return (
    <AbsoluteFill style={{ background: C.mint }}>
      {testScene ? (
        <Bg src="img/listen.jpg" x={-100} zoom={zoom} />
      ) : (
        <AbsoluteFill style={{ transformOrigin: `${CLIP[0]}px ${MOUTH[1]}px`, transform: `scale(${zoom})` }}>
          <Bg src="img/stand.jpg" x={B1_X} />
          <Paper />
          <Breath at={T.r1 + 0.04} lines={3} strength={1} />
          <Breath at={T.r3 + 0.04} lines={1} strength={0.45} />
          <Say at={T.r1} ko="팔" />
          <Say at={T.r2} ko="빨" />
          <Say at={T.r3} ko="발" />
        </AbsoluteFill>
      )}
      <Titles />
      {testScene ? <Cards mode="test" /> : null}
      {t >= T.paper ? <Cards mode="reveal" /> : null}
      <AskChip />
      <Sound />
    </AbsoluteFill>
  );
};
