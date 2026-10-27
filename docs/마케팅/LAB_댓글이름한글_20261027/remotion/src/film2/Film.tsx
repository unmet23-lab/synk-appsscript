// LAB E1 「댓글에 이름 → 한글로」 다시 살림(10-28) — Grace 하나를 한 칸씩 쓰며 그 소리와 숫자 1 → 4(고침 2).
// 첫 판(film/Film.tsx)에서 Grace 칸 · 소리 · 알약만 바꿨다. 전부 useCurrentFrame()으로만 움직인다.
import { evolvePath } from '@remotion/paths';
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, MONO } from '../lib/fonts';
import type { Pt } from '../film/geo';
import { at, CARDS, fr, QMARK, STICKER, T, Timed, WRITE } from './timeline';

const C = {
  coral: '#F96859',
  red: '#E4483A',
  brown: '#2B1A14',
  ink: '#161414',
  paper: '#FBFAF6',
  cream: '#FFF8EC',
  rom: '#7A6458',
};
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const INK_W = WRITE.s * 0.115;

const sec = (f: number) => f / 30;
/** 획 진행 0→1(처음과 끝만 조금 느리게) */
const prog = (t: number, [a, b]: readonly [number, number]) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: Easing.bezier(0.35, 0.05, 0.4, 1) });
/** t0부터 0.26초 동안 한 번 통통(1 → 1+amp → 1) */
const hop = (t: number, t0: number, amp = 0.13) => 1 + amp * Math.sin(Math.PI * interpolate(t, [t0, t0 + 0.26], [0, 1], clamp));

// ── 마커 자국 ─────────────────────────────────────────────────────
const InkDefs: React.FC = () => (
  <defs>
    <filter id="ink" filterUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="11" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
);

const Ink: React.FC<{ d: string; p: number }> = ({ d, p }) => {
  if (p <= 0) return null;
  const ev = evolvePath(p, d);
  return <path d={d} fill="none" stroke={C.ink} strokeWidth={INK_W} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} opacity={0.94} filter="url(#ink)" />;
};

/** 음절마다 묶어 그 자리에서 통통 튀게(「Four in Korean!」 · 「by sound」) */
const Written: React.FC<{ strokes: readonly Timed[]; t: number; sylX: readonly number[]; scale?: (i: number) => number }> = ({ strokes, t, sylX, scale }) => (
  <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
    <InkDefs />
    {sylX.map((x, i) => {
      const b = scale ? scale(i) : 1;
      return (
        <g key={i} transform={b === 1 ? undefined : `translate(${x} ${WRITE.cy}) scale(${b}) translate(${-x} ${-WRITE.cy})`}>
          {strokes.filter((s) => s.syl === i).map((s, k) => <Ink key={k} d={s.d} p={prog(t, s.t)} />)}
        </g>
      );
    })}
  </svg>
);

// ── 이름표(HELLO my name is) ───────────────────────────────────────
const Sticker: React.FC = () => (
  <div style={{ position: 'absolute', left: STICKER.x, top: STICKER.y, width: STICKER.w, height: STICKER.h, borderRadius: 34, background: C.red, boxShadow: '0 18px 30px rgba(60,35,15,0.28), 0 3px 6px rgba(60,35,15,0.25)' }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 10, textAlign: 'center', fontFamily: EN, fontWeight: 900, fontSize: 112, lineHeight: 1, letterSpacing: 6, color: '#FFFFFF' }}>HELLO</div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 122, textAlign: 'center', fontFamily: EN, fontWeight: 600, fontSize: 42, lineHeight: 1, letterSpacing: 1, color: '#FFFFFF' }}>my name is</div>
    <div style={{ position: 'absolute', left: 24, right: 24, top: STICKER.band, bottom: STICKER.foot, borderRadius: 12, background: C.paper, boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.12)' }} />
  </div>
);

// ── 말풍선(댓글로 들어온 영어 이름) ─────────────────────────────────
const Bubble: React.FC<{ at: number; children: React.ReactNode; badge?: React.ReactNode }> = ({ at: t0, children, badge }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: f - fr(t0), fps, config: { damping: 14, stiffness: 190, mass: 0.6 } });
  const s = t0 <= 0 ? 1 : sp;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 492, display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 18, padding: '18px 40px 20px 30px', borderRadius: 34, background: '#FFFFFF', boxShadow: '0 10px 22px rgba(60,35,15,0.22)', transform: `scale(${0.6 + 0.4 * s})`, opacity: interpolate(s, [0, 0.4], [0, 1], clamp) }}>
        <span style={{ fontSize: 52, lineHeight: 1 }}>💬</span>
        <span style={{ fontFamily: EN, fontWeight: 800, fontSize: 70, lineHeight: 1, color: C.brown, letterSpacing: -0.5 }}>{children}</span>
        {badge}
        <div style={{ position: 'absolute', left: '50%', bottom: -20, marginLeft: -18, width: 0, height: 0, borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderTop: '22px solid #FFFFFF' }} />
      </div>
    </div>
  );
};

const PopIn: React.FC<{ at: number; until?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at: t0, until, children, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < fr(t0)) return null;
  if (until !== undefined && f >= fr(until)) return null;
  const sp = spring({ frame: f - fr(t0), fps, config: { damping: 13, stiffness: 200, mass: 0.6 } });
  return <div style={{ opacity: interpolate(sp, [0, 0.4], [0, 1], clamp), transform: `translateY(${(1 - sp) * 24}px) scale(${0.85 + 0.15 * sp})`, ...style }}>{children}</div>;
};

const Pill: React.FC<{ children: React.ReactNode; bg?: string; color?: string; size?: number; font?: string; weight?: number }> = ({ children, bg = C.cream, color = C.brown, size = 46, font = EN, weight = 700 }) => (
  <span style={{ display: 'inline-block', background: bg, color, fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.1, padding: '12px 28px 14px', borderRadius: 999, boxShadow: '0 6px 14px rgba(60,35,15,0.18)', whiteSpace: 'nowrap' }}>{children}</span>
);

/** 새 스티커를 위에 탁 붙인다: 조금 크게 떠 있다가 0.18초에 내려앉는다 */
const slap = (t: number, tin: number) => {
  if (tin < 0) return { o: 1, s: 1 };
  const p = interpolate(t, [tin, tin + T.slap], [0, 1], { ...clamp, easing: Easing.bezier(0.3, 0, 0.2, 1) });
  return { o: interpolate(p, [0, 0.35], [0, 1], clamp), s: 1.09 - 0.09 * p };
};

const CardLayer: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const t = sec(f);
  const c = CARDS[i];
  if (t < c.in - 0.01 || t > c.out + T.slap + 0.05) return null;
  const covered = t >= c.out; // 다음 스티커가 덮는 동안은 이름표와 글씨만
  const { o, s } = slap(t, c.in);
  const last = i === CARDS.length - 1;
  // 칸을 다 써서 그 소리가 들릴 때 그 칸이 통통, 「Four in Korean!」에 네 칸이 차례로 한 번 더
  const scale = (k: number) => (last ? hop(t, T.syl[k] - 0.02, 0.17) * hop(t, T.four + 0.05 + k * 0.17) : 1);
  const sylEnd = c.w.sylX.map((_, k) => Math.max(...c.w.strokes.filter((s) => s.syl === k).map((s) => s.t[1])));
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: o, transform: `scale(${s})`, transformOrigin: `540px ${STICKER.y + STICKER.h / 2}px` }}>
        <Sticker />
        <Written strokes={c.w.strokes} t={t} sylX={c.w.sylX} scale={scale} />
        {/* 다시 살림: 칸을 다 쓴 박자에 그 칸 위 숫자 — 쓰는 박자 = 세는 박자 */}
        {last
          ? c.w.sylX.map((sx, k) => (
              <PopIn key={`n${k}`} at={T.syl[k]} style={{ position: 'absolute', left: sx - 26, top: STICKER.y + STICKER.band + 8, width: 52, height: 52, borderRadius: 26, background: C.coral, color: '#FFFFFF', fontFamily: EN, fontWeight: 900, fontSize: 34, lineHeight: '52px', textAlign: 'center' }}>{k + 1}</PopIn>
            ))
          : null}
        {/* 로마자가 「소리」라는 표시 */}
        <PopIn at={Math.max(0, sylEnd[0] + 0.02)} style={{ position: 'absolute', left: STICKER.x + 40, top: WRITE.cy + WRITE.s / 2 + 4, fontSize: 40, lineHeight: 1 }}>🔊</PopIn>
        {/* 음절마다 읽는 소리(칸 바로 아래) — 「한 칸 = 한 소리」 */}
        {c.w.sylX.map((sx, k) => {
          const lit = last && t >= T.syl[k];
          return (
            <PopIn key={k} at={Math.max(0, sylEnd[k] + 0.02)} style={{ position: 'absolute', left: sx - 100, width: 200, top: WRITE.cy + WRITE.s / 2 + 2, textAlign: 'center' }}>
              <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 52, lineHeight: 1, color: lit ? C.red : C.rom, display: 'inline-block', transform: `scale(${scale(k)})` }}>{c.rom[k]}</span>
            </PopIn>
          );
        })}
      </AbsoluteFill>
      {covered ? null : (
        <>
          <Bubble
            at={i === 0 ? 0 : c.in + 0.1}
            badge={last && t >= T.one ? <PopIn at={T.one} style={{ width: 52, height: 52, borderRadius: 26, background: C.coral, color: '#FFFFFF', fontFamily: EN, fontWeight: 900, fontSize: 34, lineHeight: '52px', textAlign: 'center' }}>1</PopIn> : null}
          >
            {c.en}
          </Bubble>
          {last ? (
            <div style={{ position: 'absolute', left: 0, right: 0, top: STICKER.y + STICKER.h + 34, display: 'flex', justifyContent: 'center' }}>
              {/* 다시 살림: 첫 판 v3(시험 통과)의 「1 → 4」 한 줄만 — 「sounds you hear」 알약은 빼고 쓰는 장면이 대신한다 */}
              <div style={{ display: 'flex', gap: 14 }}>
                <PopIn at={T.one}><Pill bg="#FFFFFF" size={46} weight={800}>1 sound in English</Pill></PopIn>
                <PopIn at={T.four}><Pill bg={C.coral} color="#FFFFFF" size={46} weight={900}>→ 4 in Korean!</Pill></PopIn>
              </div>
            </div>
          ) : null}
        </>
      )}
    </AbsoluteFill>
  );
};

// ── 끝: 빈 이름표 + 물음표 ─────────────────────────────────────────
const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const t = sec(f);
  if (t < T.end - 0.01) return null;
  const { o, s } = slap(t, T.end);
  const caret = Math.floor((t - T.end) * 2.2) % 2 === 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: o, transform: `scale(${s})`, transformOrigin: `540px ${STICKER.y + STICKER.h / 2}px` }}>
        <Sticker />
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <InkDefs />
          {QMARK.map((q, k) => <Ink key={k} d={q.d} p={prog(t, q.t)} />)}
        </svg>
      </AbsoluteFill>
      <Bubble at={T.end + 0.1}>
        <span>Your name<span style={{ opacity: caret ? 1 : 0, color: C.coral }}>|</span></span>
      </Bubble>
      <div style={{ position: 'absolute', left: 0, right: 0, top: STICKER.y + STICKER.h + 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <PopIn at={T.e6}><Pill bg={C.coral} color="#FFFFFF" size={56} weight={900}>Comment your name 👇</Pill></PopIn>
        <PopIn at={T.write}><Pill bg="#FFFFFF" size={42} weight={800}>I'll write it in Korean ✍️</Pill></PopIn>
      </div>
    </AbsoluteFill>
  );
};

// ── 마커 ─────────────────────────────────────────────────────────
const MK_SCALE = 0.42; // 1066×1047 원본, 촉이 (9,5)
const TIP: Pt = [9, 5];
const OFF: Pt = [1260, 2180];
const lerp = (a: Pt, b: Pt, p: number): Pt => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
const move = (t: number, a: Pt, b: Pt, [s0, s1]: readonly [number, number]) => lerp(a, b, interpolate(t, [s0, s1], [0, 1], { ...clamp, easing: EASE_IO }));

/** 쓰는 구간 하나: 들어오기 → 획 → 쉬기 → 나가기 */
const along = (t: number, strokes: readonly Timed[], tin: number, tout: number, rest: Pt): { tip: Pt; down: number } => {
  const first = strokes[0], last = strokes[strokes.length - 1];
  if (t < first.t[0]) return { tip: move(t, OFF, at(first.d, 0), [tin, first.t[0]]), down: 0 };
  for (let i = 0; i < strokes.length; i += 1) {
    const s = strokes[i];
    if (t <= s.t[1]) {
      if (t >= s.t[0]) return { tip: at(s.d, prog(t, s.t)), down: 1 };
      const p = strokes[i - 1];
      return { tip: move(t, at(p.d, 1), at(s.d, 0), [p.t[1], s.t[0]]), down: 0 };
    }
  }
  const settled = move(t, at(last.d, 1), rest, [last.t[1], last.t[1] + 0.3]);
  if (t < tout - 0.3) return { tip: [settled[0] + Math.sin(t * 3.1) * 4, settled[1] + Math.cos(t * 2.3) * 3], down: 0 };
  return { tip: move(t, rest, OFF, [tout - 0.3, tout]), down: 0 };
};

const Marker: React.FC = () => {
  const f = useCurrentFrame();
  const t = sec(f);
  let pos: { tip: Pt; down: number } | null = null;
  for (const c of CARDS) {
    if (t < c.out && t >= c.in) {
      const right = c.w.sylX[c.w.sylX.length - 1] + WRITE.s / 2;
      pos = along(t, c.w.strokes, c.in < 0 ? -1 : c.in, c.out, [Math.min(right + 60, 900), WRITE.cy + 130]);
      break;
    }
  }
  // 끝: 물음표를 쓰고 오른쪽으로 비켜 선다(아래 「Comment your name」 알약을 가리지 않게)
  if (!pos && t >= T.end) pos = along(t, QMARK, T.end, 999, [WRITE.cx + 300, WRITE.cy + 50]);
  if (!pos) return null;
  const lift = 1 - pos.down;
  return (
    <Img
      src={staticFile('img/marker.png')}
      style={{
        position: 'absolute',
        left: pos.tip[0] - TIP[0] * MK_SCALE,
        top: pos.tip[1] - TIP[1] * MK_SCALE,
        width: 1066 * MK_SCALE,
        height: 1047 * MK_SCALE,
        transformOrigin: `${TIP[0] * MK_SCALE}px ${TIP[1] * MK_SCALE}px`,
        transform: `scale(${1 + 0.04 * lift})`,
        filter: `drop-shadow(${6 + 16 * lift}px ${10 + 22 * lift}px ${6 + 6 * lift}px rgba(40,25,10,${0.32 - 0.1 * lift}))`,
      }}
    />
  );
};

// ── 맨 위 글(영상 내내) ─────────────────────────────────────────────
const Title: React.FC = () => {
  const f = useCurrentFrame();
  const t = sec(f);
  // 「Comment your name」을 말할 때 숨 쉬듯(처음 · 끝)
  const beat = (a: number) => (t >= a ? 1 + 0.045 * Math.max(0, Math.sin((t - a) * 4.2)) * interpolate(t, [a, a + 2.4], [1, 0], clamp) : 1);
  const s = Math.max(beat(CARDS[0].e), beat(T.comment), t >= T.comment + 2.4 ? 1 + 0.03 * Math.max(0, Math.sin((t - T.comment) * 3.4)) : 1);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ transform: `scale(${s})`, background: C.brown, color: '#FFFFFF', fontFamily: EN, fontWeight: 900, fontSize: 58, lineHeight: 1.05, letterSpacing: 0, padding: '14px 30px 16px', borderRadius: 22, boxShadow: '0 10px 22px rgba(40,25,10,0.3)' }}>
        COMMENT YOUR NAME 👇
      </div>
      <Pill bg={C.cream} size={38} weight={800}>✍️ I'll write it in Korean</Pill>
    </div>
  );
};

// ── 소리 ─────────────────────────────────────────────────────────
const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at: t, vol = 1 }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`vo2/pick/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; at: number; vol: number; from?: number; dur?: number }> = ({ file, at: t, vol, from = 0, dur }) => (
  <Sequence from={Math.max(0, fr(t))} durationInFrames={dur ? Math.max(2, fr(dur)) : undefined} layout="none">
    <Audio
      src={staticFile(`sfx/${file}`)}
      startFrom={fr(from) + (t < 0 ? fr(-t) : 0)}
      volume={(i) => vol * MASTER * (dur ? interpolate(i, [0, 2, Math.max(3, fr(dur) - 4), Math.max(4, fr(dur))], [0, 1, 1, 0], clamp) : 1)}
    />
  </Sequence>
);

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.16 * MASTER * interpolate(i, [fr(T.total) - 30, fr(T.total)], [1, 0], clamp)} />
    <Vo id="e3g" at={CARDS[0].e} />
    <Vo id="k3" at={CARDS[0].k} />
    <Sfx file="pop.wav" at={CARDS[0].k} vol={0.2} />
    {/* 칸 사이에 쉬니 연필 소리도 칸마다 */}
    {CARDS[0].w.sylX.map((_, k) => {
      const ss = CARDS[0].w.strokes.filter((s) => s.syl === k);
      return ss.length ? <Sfx key={k} file={k % 2 ? 'pencil_b.wav' : 'pencil_a.wav'} at={ss[0].t[0]} from={0.4 + k * 0.9} dur={ss[ss.length - 1].t[1] - ss[0].t[0]} vol={0.24} /> : null;
    })}
    <Sfx file="tick.wav" at={T.one} vol={0.3} />
    {/* 칸을 다 쓴 박자에 그 소리 + 째깍(숫자) */}
    {T.syl.map((s, k) => (
      <React.Fragment key={k}>
        <Vo id={`g${k + 1}`} at={s} />
        <Sfx file="tick.wav" at={s} vol={0.26} />
      </React.Fragment>
    ))}
    <Vo id="e4s" at={T.e4} />
    {[0, 1, 2, 3].map((k) => <Sfx key={`f${k}`} file="tick.wav" at={T.four + 0.05 + k * 0.17} vol={0.3} />)}
    <Sfx file="ding1.wav" at={T.four + 0.75} vol={0.3} />
    <Vo id="e6" at={T.e6} />
    <Sfx file="page.wav" at={T.end - 0.02} vol={0.3} />
    <Sfx file="tok.wav" at={T.end + 0.12} vol={0.42} />
    <Sfx file="pencil_b.wav" at={QMARK[0].t[0]} from={2.0} dur={QMARK[1].t[1] - QMARK[0].t[0]} vol={0.24} />
    <Sfx file="sparkle.wav" at={T.write} vol={0.22} />
  </>
);

// 카메라: 이름표마다 천천히 다가가고(새 스티커가 붙으면 처음으로), 폰을 손에 든 듯 아주 약하게 떠다닌다.
// 올리기 전 검사 정지 34%(14.5~17초 설명 구간) 뒤 더함 — 위 제목 띠는 카메라 밖(고정).
const SEGS = [0, T.end, T.total];
const camera = (t: number) => {
  let k = 0;
  while (k < SEGS.length - 2 && t >= SEGS[k + 1]) k += 1;
  // Grace 칸(13초)에서도 말풍선이 위 띠에 닿지 않고, 글이 오른쪽 단추 · 아래 앱 글자 안전선을 넘지 않게
  const push = 1 + 0.004 * (t - SEGS[k]);
  const x = 7 * Math.sin(t * 1.1) + 3 * Math.sin(t * 2.3 + 0.7);
  const y = 6 * Math.sin(t * 0.8 + 1.3) + 3 * Math.sin(t * 1.9);
  return `translate(${x}px, ${y}px) scale(${push})`;
};

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#D9BE95' }}>
      <AbsoluteFill style={{ transform: camera(sec(f)), transformOrigin: `540px ${STICKER.y + STICKER.h / 2}px` }}>
        <Img src={staticFile('img/desk.jpg')} style={{ position: 'absolute', left: -60, top: -110, width: 1200, height: 2133 }} />
        {CARDS.map((_, i) => <CardLayer key={i} i={i} />)}
        <EndCard />
        <Marker />
      </AbsoluteFill>
      <Title />
      <Sound />
    </AbsoluteFill>
  );
};
