// LAB 몽골 M5 「가격 읽기」 — 영수증 합계 12,000원을 3초 안에 읽어 보고(스스로 채점), 십이천 ✗ → 10,000 = 만 → 만 이천 원 ✓ → 15,000원은 댓글로.
// 소리는 배경음과 효과음뿐(몽골어 목소리가 없어서 — 장부 머리말).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO as KO_FONT } from '../lib/fonts';
import { KO, MN, NEXT, PRICE } from './data';
import { fr, T } from './timeline';

const C = {
  lapis: '#3D6BC9',
  lapisSoft: '#C5D6F5',
  lapisDeep: '#24448C',
  bake: '#3A72D7', // 구운 몽글 판의 바탕
  butter: '#F5C445',
  butterSoft: '#FFEBB0',
  meadow: '#7DB45A',
  meadowDeep: '#3F6B2E',
  pop: '#E05C97',
  popDeep: '#99295D',
  ink: '#1E1B2E',
  paper: '#FFFFFF',
  grey: '#DCDFE8',
};
const MASTER = 0.8;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const EMOJI = "'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

const useT = () => useCurrentFrame() / 30;
const useSpringAt = (t: number, cfg: { damping?: number; stiffness?: number; mass?: number } = {}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - fr(t), fps, config: { damping: 15, stiffness: 180, mass: 0.7, ...cfg } });
};
const fade = (s: number) => interpolate(s, [0, 0.5], [0, 1], clamp);

// ── 바탕 · 위 띠 ─────────────────────────────────────────────────
/** 옅은 숫자 무늬가 천천히 올라간다(정지 화면이 길어지지 않게). */
const Wallpaper: React.FC = () => {
  const f = useCurrentFrame();
  const glyphs = ['0', '₩', '1', '0', '원', '2', '0', '5'];
  const shift = (f * 2.2) % 150;
  return (
    <div style={{ position: 'absolute', left: 0, top: 400, width: 1080, height: 1520, background: C.paper, overflow: 'hidden' }}>
      {Array.from({ length: 11 * 7 }).map((_, k) => {
        const r = Math.floor(k / 7), c = k % 7;
        return (
          <div key={k} style={{ position: 'absolute', left: c * 160 + (r % 2) * 80 - 20, top: r * 150 - shift, fontFamily: KO_FONT, fontWeight: 800, fontSize: 60, color: C.lapis, opacity: 0.08 }}>
            {glyphs[(r * 3 + c) % glyphs.length]}
          </div>
        );
      })}
    </div>
  );
};

const Band: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 400, background: C.lapis }}>
    <div style={{ position: 'absolute', left: 70, width: 830, top: 296, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: 56, whiteSpace: 'nowrap', lineHeight: 1.1, color: C.paper }}>{MN.band}</div>
  </div>
);

// ── 영수증 ───────────────────────────────────────────────────────
const RC = { x: 100, y: 440, w: 800, h: 500 };
const ZIG = (() => {
  // 아래 끝 톱니
  const n = 19, w = 100 / n, pts: string[] = ['0% 0%', '100% 0%', '100% 95%'];
  for (let i = n; i > 0; i--) pts.push(`${(i - 0.5) * w}% 100%`, `${(i - 1) * w}% 95%`);
  return `polygon(${pts.join(', ')})`;
})();

/** 3 · 2 · 1 고리(영수증 오른쪽 위 모서리). */
const Countdown: React.FC = () => {
  const t = useT();
  if (t < T.count || t >= T.wrong) return null;
  const k = Math.min(2, Math.floor(t - T.count));
  const p = (t - T.count) % 1;
  const pulse = 1 + 0.12 * Math.max(0, 1 - p * 4);
  const out = interpolate(t, [T.wrong - 0.2, T.wrong], [1, 0], clamp);
  const R = 74, L = 2 * Math.PI * R;
  return (
    <div style={{ position: 'absolute', left: RC.w - 150, top: -60, width: 190, height: 190, transform: `scale(${pulse * out})`, opacity: out }}>
      <svg width={190} height={190} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={95} cy={95} r={88} fill={C.butter} />
        <circle cx={95} cy={95} r={R} fill="none" stroke={C.ink} strokeOpacity={0.15} strokeWidth={12} />
        <circle cx={95} cy={95} r={R} fill="none" stroke={C.ink} strokeWidth={12} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * ((t - T.count) / 3)} transform="rotate(-90 95 95)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: EN, fontWeight: 900, fontSize: 104, color: C.ink }}>{3 - k}</div>
    </div>
  );
};

/** 합계 줄 — 만 자리에서 끊으면 「1」과 「2,000」이 벌어지고 아래에 만 · 이천 · 원이 떨어진다. 끝에는 15,000원으로 바뀐다. */
const Total: React.FC = () => {
  const t = useT();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const split = useSpringAt(T.split, { damping: 14, stiffness: 160 });
  const unsplit = interpolate(t, [T.end - 0.3, T.end], [0, 1], { ...clamp, easing: EASE });
  const gap = 70 * split * (1 - unsplit);
  const isEnd = t >= T.end;
  // 끝: 「2,000」이 위로 빠지고 0.15초 뒤 「5,000」이 아래에서 올라온다(빈 칸이 보이지 않게)
  const roll = useSpringAt(T.end + 0.15, { damping: 13, stiffness: 170 });
  const leaving = interpolate(t, [T.end, T.end + 0.15], [0, 1], clamp);
  const showNew = t >= T.end + 0.15;
  const right = showNew ? NEXT.slice(1) : PRICE.right;
  const label = (txt: string, k: number, color: string) => {
    const d = spring({ frame: f - fr(T.split + 0.15 + k * 0.22), fps, config: { damping: 11, stiffness: 210, mass: 0.6 } });
    const on = t >= T.split + 0.15 + k * 0.22 && !isEnd;
    const bob = t > T.split + 1 && !isEnd ? Math.sin((t - T.split) * 6 + k * 1.2) * 6 : 0;
    return (
      <div style={{ height: 96, fontFamily: KO_FONT, fontWeight: 900, fontSize: 76, lineHeight: '96px', color, textAlign: 'center', opacity: on ? fade(d) * (1 - unsplit) : 0, transform: `translateY(${(1 - d) * -50 + bob}px)` }}>{txt}</div>
    );
  };
  const chip = (bg: string, on: number) => ({ background: bg, borderRadius: 24, padding: '0 18px', boxShadow: on > 0 ? `0 0 0 ${4 * on}px ${bg}` : 'none', transition: 'none' });
  const hi = split * (1 - unsplit);
  return (
    <div style={{ position: 'absolute', left: 0, top: 190, width: RC.w, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: gap }}>
        <div style={{ fontFamily: KO_FONT, fontWeight: 900, fontSize: 150, lineHeight: '180px', color: hi > 0.5 ? C.paper : C.ink, ...chip(hi > 0.02 ? `rgba(61,107,201,${hi})` : 'transparent', 0) }}>{PRICE.left}</div>
        {label(KO.man, 0, C.lapisDeep)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: gap * 0.5 }}>
        <div style={{ fontFamily: KO_FONT, fontWeight: 900, fontSize: 150, lineHeight: '180px', color: C.ink, ...chip(hi > 0.02 ? `rgba(245,196,69,${hi})` : 'transparent', 0), transform: showNew ? `translateY(${(1 - roll) * 60}px)` : `translateY(${-50 * leaving}px)`, opacity: showNew ? fade(roll) : 1 - leaving }}>{right}</div>
        {label(KO.ichon, 1, '#7E5A10')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontFamily: KO_FONT, fontWeight: 800, fontSize: 110, lineHeight: '180px', color: C.ink }}>{PRICE.won}</div>
        {label(PRICE.won, 2, C.ink)}
      </div>
    </div>
  );
};

const Receipt: React.FC = () => {
  const t = useT();
  const s = useSpringAt(0, { damping: 16 });
  const sway = Math.sin(t * 1.6) * 0.8; // 영수증이 아주 살짝 흔들림
  const bars = [0.62, 0.7];
  const q = useSpringAt(T.end + 0.35, { damping: 10, stiffness: 200 });
  return (
    <div style={{ position: 'absolute', left: RC.x, top: RC.y, width: RC.w, height: RC.h, transform: `rotate(${sway}deg) translateY(${(1 - s) * 40}px)`, transformOrigin: '50% 0%' }}>
      <div style={{ position: 'absolute', inset: 0, background: C.paper, clipPath: ZIG, filter: 'drop-shadow(0 12px 22px rgba(30,27,46,0.18))' }} />
      <div style={{ position: 'absolute', inset: 0, clipPath: ZIG, boxShadow: 'inset 0 0 0 3px #E7E9F0' }} />
      {/* 품목 줄(글자 없이 막대) */}
      <div style={{ position: 'absolute', left: 70, top: 56, width: RC.w - 140 }}>
        {bars.map((w, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 26 }}>
            <div style={{ width: `${w * 100}%`, height: 22, borderRadius: 11, background: C.grey }} />
            <div style={{ width: 90, height: 22, borderRadius: 11, background: C.grey }} />
          </div>
        ))}
        <div style={{ borderTop: `5px dashed ${C.grey}`, marginTop: 6 }} />
      </div>
      <Total />
      {t >= T.end + 0.35 ? (
        <div style={{ position: 'absolute', right: 24, top: 24, width: 150, height: 150, borderRadius: 75, background: C.butter, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: EN, fontWeight: 900, fontSize: 110, color: C.ink, transform: `scale(${q}) rotate(${Math.sin(t * 4) * 6}deg)` }}>?</div>
      ) : null}
      <Countdown />
    </div>
  );
};

// ── 아래 카드 ────────────────────────────────────────────────────
const CARD = { x: 60, y: 1010, w: 840, h: 400 };

const CardShell: React.FC<{ from: number; to: number | null; bg: string; children: React.ReactNode; instant?: boolean }> = ({ from, to, bg, children, instant }) => {
  const t = useT();
  const inS = useSpringAt(from, { damping: 16, stiffness: 170 });
  const s = instant ? 1 : inS;
  if (t < from && !instant) return null;
  const out = to === null ? 0 : interpolate(t, [to, to + 0.28], [0, 1], { ...clamp, easing: EASE });
  if (out >= 1) return null;
  return (
    <div style={{ position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: 40, background: bg, boxShadow: '0 14px 34px rgba(30,27,46,0.16)', overflow: 'hidden', transform: `translateY(${(1 - s) * 80 - out * 60}px) scale(${0.96 + 0.04 * s})`, opacity: Math.min(fade(s), 1 - out) }}>
      {children}
    </div>
  );
};

/** 구운 몽글 장면. 살짝 흔들려 카드가 서 있는 동안에도 화면이 멈추지 않는다. */
const Mongle: React.FC<{ src: string; size: number; phase?: number; hop?: boolean }> = ({ src, size, phase = 0, hop }) => {
  const t = useT() + phase;
  return (
    <Img
      src={staticFile(src)}
      style={{
        width: size,
        height: size,
        objectFit: 'cover',
        WebkitMaskImage: 'radial-gradient(circle at 50% 52%, black 58%, transparent 72%)',
        transform: hop ? `translateY(${-Math.abs(Math.sin(t * 5.2)) * 16}px) rotate(${Math.sin(t * 2.6) * 4}deg)` : `translateY(${Math.sin(t * 5.6) * 9}px) rotate(${Math.sin(t * 3.6) * 4}deg)`,
      }}
    />
  );
};

const HookCard: React.FC = () => {
  const t = useT();
  const sc = useSpringAt(T.count);
  const counting = t >= T.count;
  return (
    <CardShell from={0} to={T.wrong} bg={C.bake} instant>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <div style={{ width: 380, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mongle src="img/mongle_puzzled.jpg" size={410} />
        </div>
        <div style={{ flex: 1, paddingRight: 40 }}>
          {counting ? (
            <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 52, lineHeight: 1.12, color: C.paper, opacity: fade(sc), transform: `translateY(${(1 - sc) * 20}px)` }}>{MN.count}</div>
          ) : (
            <div style={{ fontFamily: EN, fontWeight: 900, fontSize: 70, lineHeight: 1.05, color: C.paper }}>{MN.hook}</div>
          )}
        </div>
      </div>
    </CardShell>
  );
};

/** 빨간 도장(✗) · 초록 도장(✓). 찍히듯 커졌다 앉는다. */
const Stamp: React.FC<{ at: number; mark: '✗' | '✓'; color: string; size: number; style?: React.CSSProperties }> = ({ at, mark, color, size, style }) => {
  const t = useT();
  const s = useSpringAt(at, { damping: 9, stiffness: 240, mass: 0.6 });
  if (t < at) return null;
  return (
    <div style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, border: `${size * 0.07}px solid ${color}`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: EN, fontWeight: 900, fontSize: size * 0.62, transform: `scale(${1.7 - 0.7 * s}) rotate(${-14 + 4 * Math.sin(t * 3)}deg)`, opacity: fade(s), ...style }}>
      {mark}
    </div>
  );
};

const WrongCard: React.FC = () => {
  const t = useT();
  const strike = interpolate(t, [T.wrong + 0.55, T.wrong + 0.85], [0, 1], { ...clamp, easing: EASE });
  return (
    <CardShell from={T.wrong} to={T.rule} bg={C.paper}>
      <div style={{ position: 'absolute', left: 60, top: 56, fontFamily: EN, fontWeight: 800, fontSize: 58, color: C.ink }}>{MN.wrong}</div>
      <div style={{ position: 'absolute', left: 56, top: 170, fontFamily: KO_FONT, fontWeight: 900, fontSize: 120, lineHeight: 1, color: C.ink, opacity: 1 - 0.45 * strike }}>
        {KO.wrong}
        <div style={{ position: 'absolute', left: -10, top: 62, height: 14, borderRadius: 7, width: `${strike * 104}%`, background: C.pop }} />
      </div>
      <Stamp at={T.wrong + 0.55} mark="✗" color={C.pop} size={160} style={{ right: 30, top: 150 }} />
    </CardShell>
  );
};

const RuleCard: React.FC = () => {
  const t = useT();
  const s2 = useSpringAt(T.rule + 0.45);
  const pulse = t > T.rule + 0.8 ? 1 + 0.03 * Math.sin((t - T.rule) * 5) : 1;
  return (
    <CardShell from={T.rule} to={T.answer} bg={C.paper}>
      <div style={{ position: 'absolute', inset: 0, border: `6px solid ${C.lapis}`, borderRadius: 40 }} />
      <div style={{ position: 'absolute', left: 0, width: CARD.w, top: 56, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 34, transform: `scale(${pulse})` }}>
        <div style={{ fontFamily: EN, fontWeight: 900, fontSize: 132, color: C.ink, letterSpacing: -2 }}>{KO.ruleL}</div>
        <div style={{ fontFamily: EN, fontWeight: 900, fontSize: 110, color: C.ink, opacity: 0.4 }}>=</div>
        <div style={{ fontFamily: KO_FONT, fontWeight: 900, fontSize: 168, color: C.paper, background: C.lapis, borderRadius: 30, padding: '0 30px', lineHeight: '200px' }}>{KO.man}</div>
      </div>
      <div style={{ position: 'absolute', left: 50, width: CARD.w - 100, top: 270, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: 50, lineHeight: 1.1, color: C.lapisDeep, opacity: fade(s2), transform: `translateY(${(1 - s2) * 16}px)` }}>{MN.rule}</div>
    </CardShell>
  );
};

const AnswerCard: React.FC = () => {
  const readS = useSpringAt(T.answer + 0.4);
  const meanS = useSpringAt(T.answer + 0.8);
  const pillS = useSpringAt(T.answer + 0.2);
  const t = useT();
  return (
    <>
      <CardShell from={T.answer} to={T.end} bg={C.paper}>
        <div style={{ position: 'absolute', left: 56, top: 58, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: KO_FONT, fontWeight: 900, fontSize: 132, lineHeight: 1.05, color: C.ink }}>{KO.answer}</div>
          <div style={{ fontFamily: EN, fontWeight: 600, fontSize: 52, color: C.lapisDeep, marginTop: 8, opacity: fade(readS), transform: `translateY(${(1 - readS) * 16}px)` }}>[{MN.read}]</div>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 58, color: C.ink, marginTop: 4, opacity: fade(meanS), transform: `translateY(${(1 - meanS) * 20}px)` }}>{MN.mean}</div>
        </div>
        <Stamp at={T.answer + 1.1} mark="✓" color={C.meadow} size={150} style={{ right: 40, top: 46 }} />
      </CardShell>
      {t >= T.answer + 0.2 && t < T.end ? (
        <div style={{ position: 'absolute', left: CARD.x + 40, top: CARD.y - 46, background: C.meadow, color: C.paper, borderRadius: 28, padding: '10px 28px 12px', fontFamily: EN, fontWeight: 800, fontSize: 44, opacity: fade(pillS) * interpolate(t, [T.end - 0.1, T.end + 0.15], [1, 0], clamp), transform: `scale(${0.8 + 0.2 * pillS})`, transformOrigin: 'left center' }}>
          {MN.check}
        </div>
      ) : null}
    </>
  );
};

const EndCard: React.FC = () => {
  const s2 = useSpringAt(T.end + 0.6);
  return (
    <CardShell from={T.end} to={null} bg={C.bake}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <div style={{ width: 330, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mongle src="img/mongle_happy.jpg" size={370} hop />
        </div>
        <div style={{ flex: 1, paddingRight: 34, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontFamily: EN, fontWeight: 900, fontSize: 72, lineHeight: 1.05, color: C.paper }}>{MN.endQ}</div>
          <div style={{ alignSelf: 'flex-start', background: C.paper, borderRadius: 22, padding: '12px 20px 14px', fontFamily: EN, fontWeight: 800, fontSize: 44, lineHeight: 1.12, color: C.lapisDeep, opacity: fade(s2), transform: `scale(${0.8 + 0.2 * s2})`, transformOrigin: 'left center' }}>
            {MN.endC} <span style={{ fontFamily: EMOJI, fontWeight: 400 }}>👇</span>
          </div>
        </div>
      </div>
    </CardShell>
  );
};

// ── 소리 ─────────────────────────────────────────────────────────
const Sfx: React.FC<{ file: string; at: number; vol: number }> = ({ file, at: t, vol }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={vol * MASTER} />
  </Sequence>
);

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.4 * MASTER * interpolate(i, [fr(T.total) - 40, fr(T.total)], [1, 0], clamp)} />
    {[0, 1, 2].map((k) => (
      <Sfx key={k} file="tick.wav" at={T.count + k} vol={0.5} />
    ))}
    <Sfx file="tok.wav" at={T.wrong + 0.55} vol={0.6} />
    <Sfx file="sparkle.wav" at={T.rule} vol={0.35} />
    <Sfx file="pop.wav" at={T.split + 0.15} vol={0.45} />
    <Sfx file="pop.wav" at={T.split + 0.37} vol={0.45} />
    <Sfx file="ding1.wav" at={T.answer + 1.1} vol={0.4} />
    <Sfx file="pop.wav" at={T.end} vol={0.45} />
    <Sfx file="sparkle.wav" at={T.end + 0.6} vol={0.3} />
  </>
);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.paper }}>
    <Wallpaper />
    <Band />
    <Receipt />
    <HookCard />
    <WrongCard />
    <RuleCard />
    <AnswerCard />
    <EndCard />
    <Sound />
  </AbsoluteFill>
);
