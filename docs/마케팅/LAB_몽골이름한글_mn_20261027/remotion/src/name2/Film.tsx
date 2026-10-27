// LAB M3 「내 몽골 이름을 한글로」 다시 살림(10-28) — 책상 위 이름표에 마커로 바트바야르를 한 칸씩 쓰며
// 몽골어 3음절 → 한글 5음절을 센다. LAB E1 다시 살림의 이름표 · 마커 · 한글 획 틀을 옮겼다. 전부 useCurrentFrame()으로만 움직인다.
// 몽골어 글 정본은 이 파일의 TXT(세 겹 검수 — ../../검문/화면글_v2.txt).
import { evolvePath } from '@remotion/paths';
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN } from '../lib/fonts';
import type { Pt } from '../film/geo';
import { at, fr, NAME, QMARK, STICKER, SYL_ID, T, Timed, W, WRITE } from './timeline';

export const TXT = {
  title: ['Монгол нэрээ', 'солонгос үсгээр бичвэл?'],
  rule: ['«т», «р» тус бүр', 'тусдаа нэг үе болсон'],
  hello: 'САЙН УУ',
  myName: 'миний нэр',
  three: 'Монгол хэлээр 3 үе',
  five: '→ Солонгос үсгээр 5 үе!',
  yourName: 'Таны нэр',
  ask: ['Солонгос үсгээр', 'хэдэн үе вэ?'],
  comment: 'Нэрээ сэтгэгдэлд бичээрэй 👇',
  link: '🔗 synk.im/name',
};

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
const prog = (t: number, [a, b]: readonly [number, number]) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: Easing.bezier(0.35, 0.05, 0.4, 1) });
const hop = (t: number, t0: number, amp = 0.13) => 1 + amp * Math.sin(Math.PI * interpolate(t, [t0, t0 + 0.26], [0, 1], clamp));

const InkDefs: React.FC = () => (
  <defs>
    <filter id="ink" filterUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="11" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
);

const Ink: React.FC<{ d: string; p: number; w?: number }> = ({ d, p, w = INK_W }) => {
  if (p <= 0) return null;
  const ev = evolvePath(p, d);
  return <path d={d} fill="none" stroke={C.ink} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} opacity={0.94} filter="url(#ink)" />;
};

const Sticker: React.FC = () => (
  <div style={{ position: 'absolute', left: STICKER.x, top: STICKER.y, width: STICKER.w, height: STICKER.h, borderRadius: 34, background: C.red, boxShadow: '0 18px 30px rgba(60,35,15,0.28), 0 3px 6px rgba(60,35,15,0.25)' }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 14, textAlign: 'center', fontFamily: EN, fontWeight: 900, fontSize: 100, lineHeight: 1, letterSpacing: 4, color: '#FFFFFF' }}>{TXT.hello}</div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 122, textAlign: 'center', fontFamily: EN, fontWeight: 600, fontSize: 42, lineHeight: 1, letterSpacing: 1, color: '#FFFFFF' }}>{TXT.myName}</div>
    <div style={{ position: 'absolute', left: 24, right: 24, top: STICKER.band, bottom: STICKER.foot, borderRadius: 12, background: C.paper, boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.12)' }} />
  </div>
);

const Bubble: React.FC<{ at: number; children: React.ReactNode }> = ({ at: t0, children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: f - fr(t0), fps, config: { damping: 14, stiffness: 190, mass: 0.6 } });
  const s = t0 <= 0 ? 1 : sp;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 500, display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 18, padding: '16px 40px 18px 30px', borderRadius: 34, background: '#FFFFFF', boxShadow: '0 10px 22px rgba(60,35,15,0.22)', transform: `scale(${0.6 + 0.4 * s})`, opacity: interpolate(s, [0, 0.4], [0, 1], clamp) }}>
        <span style={{ fontSize: 50, lineHeight: 1 }}>💬</span>
        <span style={{ fontFamily: EN, fontWeight: 800, fontSize: 68, lineHeight: 1, color: C.brown, letterSpacing: -0.5 }}>{children}</span>
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
  const sp = t0 <= 0 ? 1 : spring({ frame: f - fr(t0), fps, config: { damping: 13, stiffness: 200, mass: 0.6 } });
  return <div style={{ opacity: interpolate(sp, [0, 0.4], [0, 1], clamp), transform: `translateY(${(1 - sp) * 24}px) scale(${0.85 + 0.15 * sp})`, ...style }}>{children}</div>;
};

const Pill: React.FC<{ children: React.ReactNode; bg?: string; color?: string; size?: number; weight?: number }> = ({ children, bg = C.cream, color = C.brown, size = 46, weight = 700 }) => (
  <span style={{ display: 'inline-block', background: bg, color, fontFamily: EN, fontWeight: weight, fontSize: size, lineHeight: 1.1, padding: '12px 30px 14px', borderRadius: 999, boxShadow: '0 6px 14px rgba(60,35,15,0.18)', whiteSpace: 'nowrap' }}>{children}</span>
);

const slap = (t: number, tin: number) => {
  if (tin < 0) return { o: 1, s: 1 };
  const p = interpolate(t, [tin, tin + T.slap], [0, 1], { ...clamp, easing: Easing.bezier(0.3, 0, 0.2, 1) });
  return { o: interpolate(p, [0, 0.35], [0, 1], clamp), s: 1.09 - 0.09 * p };
};

// ── 바트바야르 이름표 ─────────────────────────────────────────────
const NameLayer: React.FC = () => {
  const f = useCurrentFrame();
  const t = sec(f);
  if (t > T.end + T.slap + 0.05) return null;
  const covered = t >= T.end;
  // 칸을 다 써서 그 소리가 들릴 때 그 칸이 통통, 「바트바야르!」에 다섯 칸이 차례로 한 번 더
  const scale = (k: number) => hop(t, T.syl[k] - 0.02, 0.17) * hop(t, T.full + 0.05 + k * 0.17);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transformOrigin: `540px ${STICKER.y + STICKER.h / 2}px` }}>
        <Sticker />
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <InkDefs />
          {W.sylX.map((x, i) => {
            const b = scale(i);
            return (
              <g key={i} transform={b === 1 ? undefined : `translate(${x} ${WRITE.cy}) scale(${b}) translate(${-x} ${-WRITE.cy})`}>
                {W.strokes.filter((s) => s.syl === i).map((s, k) => <Ink key={k} d={s.d} p={prog(t, s.t)} />)}
              </g>
            );
          })}
        </svg>
        {/* 고침 2: 칸 위에 그 칸이 된 키릴 조각을 먼저 — т · р는 산호색(모음 없이 혼자 한 칸) */}
        {W.sylX.map((sx, k) => (
          <PopIn key={`s${k}`} at={Math.max(0, T.sylStart[k] - 0.15)} style={{ position: 'absolute', left: sx - 70, width: 140, top: STICKER.y + STICKER.band + 6, textAlign: 'center' }}>
            <span style={{ display: 'inline-block', background: NAME.hot[k] ? C.red : C.cream, color: NAME.hot[k] ? '#FFFFFF' : C.brown, fontFamily: EN, fontWeight: 900, fontSize: 40, lineHeight: 1, padding: '5px 18px 7px', borderRadius: 999, border: NAME.hot[k] ? 'none' : `2px solid ${C.rom}`, transform: `scale(${scale(k)})` }}>{NAME.src[k]}</span>
          </PopIn>
        ))}
        {/* 칸을 다 쓴 박자에 그 소리와 칸 아래 숫자 — 쓰는 박자 = 세는 박자 */}
        {W.sylX.map((sx, k) => (
          <PopIn key={`n${k}`} at={T.syl[k]} style={{ position: 'absolute', left: sx - 27, top: WRITE.cy + WRITE.s / 2 + 8, width: 54, height: 54, borderRadius: 27, background: C.coral, color: '#FFFFFF', fontFamily: EN, fontWeight: 900, fontSize: 36, lineHeight: '54px', textAlign: 'center' }}>{k + 1}</PopIn>
        ))}
      </AbsoluteFill>
      {covered ? null : (
        <>
          <Bubble at={0}>{NAME.mn}</Bubble>
        </>
      )}
    </AbsoluteFill>
  );
};

// 3음절 → 5음절 알약 — 마커 위에 그린다(첫 렌더에서 마커 몸통이 알약을 가렸다)
const Pills: React.FC = () => {
  const t = sec(useCurrentFrame());
  if (t >= T.end) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: STICKER.y + STICKER.h + 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <PopIn at={0}><Pill bg="#FFFFFF" size={48} weight={800}>{TXT.three}: Бат · ба · яр</Pill></PopIn>
      <PopIn at={T.five}><Pill bg={C.coral} color="#FFFFFF" size={54} weight={900}>{TXT.five}</Pill></PopIn>
    </div>
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
          {QMARK.map((q, k) => <Ink key={k} d={q.d} p={prog(t, q.t)} w={186 * 0.115} />)}
        </svg>
      </AbsoluteFill>
      <Bubble at={T.end + 0.1}>
        <span>{TXT.yourName}<span style={{ opacity: caret ? 1 : 0, color: C.coral }}>|</span></span>
      </Bubble>
      <div style={{ position: 'absolute', left: 0, right: 0, top: STICKER.y + STICKER.h + 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <PopIn at={T.comment}><Pill bg={C.coral} color="#FFFFFF" size={54} weight={900}>{TXT.comment}</Pill></PopIn>
        <PopIn at={T.link}><Pill bg="#FFFFFF" size={40} weight={800}>{TXT.link}</Pill></PopIn>
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
  if (t < T.end) pos = along(t, W.strokes, -1, T.end, [Math.min(W.sylX[4] + WRITE.s / 2 + 40, 930), WRITE.cy + 150]);
  else pos = along(t, QMARK, T.end, 999, [WRITE.cx + 300, WRITE.cy + 50]);
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

// ── 맨 위 띠: 처음엔 「Монгол нэрээ / солонгос үсгээр бичвэл?」, 다 쓴 뒤 규칙, 끝 화면에선 「Солонгос үсгээр / хэдэн үе вэ?」 ─────────────
const Title: React.FC = () => {
  const f = useCurrentFrame();
  const t = sec(f);
  const lines = t >= T.end ? TXT.ask : t >= T.rule ? TXT.rule : TXT.title;
  const s = t >= T.end ? 1 + 0.03 * Math.max(0, Math.sin((t - T.end) * 3.4)) : hop(t, T.rule, 0.06);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 268, display: 'flex', justifyContent: 'center' }}>
      <div style={{ transform: `scale(${s})`, background: C.brown, color: '#FFFFFF', fontFamily: EN, fontWeight: 900, fontSize: 54, lineHeight: 1.12, textAlign: 'center', padding: '16px 34px 18px', borderRadius: 24, boxShadow: '0 10px 22px rgba(40,25,10,0.3)' }}>
        {lines.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
    </div>
  );
};

// ── 소리 ─────────────────────────────────────────────────────────
const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at: t, vol = 1 }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`vo/pick/${id}.wav`)} volume={vol * MASTER} />
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
    {W.sylX.map((_, k) => {
      const ss = W.strokes.filter((s) => s.syl === k);
      return (
        <React.Fragment key={k}>
          <Sfx file={k % 2 ? 'pencil_b.wav' : 'pencil_a.wav'} at={ss[0].t[0]} from={0.4 + k * 0.9} dur={ss[ss.length - 1].t[1] - ss[0].t[0]} vol={0.24} />
          <Vo id={SYL_ID[k]} at={T.syl[k]} />
          <Sfx file="tick.wav" at={T.syl[k]} vol={0.26} />
        </React.Fragment>
      );
    })}
    <Vo id="full" at={T.full} />
    {[0, 1, 2, 3, 4].map((k) => <Sfx key={`f${k}`} file="tick.wav" at={T.full + 0.05 + k * 0.17} vol={0.28} />)}
    <Sfx file="ding1.wav" at={T.five + 0.05} vol={0.3} />
    <Sfx file="pop.wav" at={T.rule} vol={0.22} />
    <Sfx file="page.wav" at={T.end - 0.02} vol={0.3} />
    <Sfx file="tok.wav" at={T.end + 0.12} vol={0.42} />
    <Sfx file="pencil_b.wav" at={QMARK[0].t[0]} from={2.0} dur={QMARK[1].t[1] - QMARK[0].t[0]} vol={0.24} />
    <Sfx file="pop.wav" at={T.comment} vol={0.22} />
    <Sfx file="sparkle.wav" at={T.link} vol={0.2} />
  </>
);

// 카메라: 천천히 다가가고(끝 화면에서 처음으로), 손에 든 듯 아주 약하게 떠다닌다 — 위 띠는 카메라 밖(고정).
const SEGS = [0, T.end, T.total];
const camera = (t: number) => {
  const k = t >= SEGS[1] ? 1 : 0;
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
        <NameLayer />
        <EndCard />
        <Marker />
        <Pills />
      </AbsoluteFill>
      <Title />
      <Sound />
    </AbsoluteFill>
  );
};
