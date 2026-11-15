// Y54 본편 — AI 영상 지시문에 「반짝인다(twinkle)」 한 단어: 난간 등이 제멋대로 꺼졌다 켜졌다, 「처음부터 끝까지 그대로」로 고치니 0번.
// 실화(11-13): 공모전 당선 애니를 다듬다 Omni 1.2 Flash 지시문 끝의 「lights twinkle」이 난간 등 열한 개를 깜빡이게 했다(3.9초에 73번 — 게시글에만).
// 출품작은 전시 전이라, 이 편의 영상은 같은 꼴 지시문으로 새 장면을 구워 다시 잰 것이다(기획.md 「실제 화면」). 숫자 · 깜빡임 표시는 측정값(data.ts).
// 화면 결(장부 머리말): 원래 장면 그대로 · 위 그늘 위 큰 흰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳(깜빡임을 짚는 자리) · SUIT 하나.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { IN_OUT, mix, prog } from '../lib/motion';
import { ST, TW } from './data';
import { T, VO, LEN, CLIP } from './timeline';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);

const WHITE = '#FFFFFF';
const BUTTER = '#F5C445';
const SHADE = 'rgba(4,6,10,';
const SCALE = 1080 / 720; // 720×1280 영상 → 1080×1920

type Clip = typeof TW;

/** 영상 한 판(소리 없음) — 측정한 그 파일 그대로, from초부터. zoom · 초점(cx, cy — 영상 좌표)으로 천천히 다가간다. */
const Plate: React.FC<{ src: string; from: number; f0: number; f1: number; z0?: number; z1?: number; cx?: number; cy?: number; dim?: number }> = ({ src, from, f0, f1, z0 = 1.0, z1 = 1.035, cx = 360, cy = 640, dim = 0 }) => {
  const f = useCurrentFrame();
  const z = mix(z0, z1, prog(f, f0, f1 - f0, IN_OUT));
  const ox = (360 - cx) * SCALE * (z - 1);
  const oy = (640 - cy) * SCALE * (z - 1);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${ox}px, ${oy}px) scale(${z})`, transformOrigin: '50% 50%' }}>
        <OffthreadVideo muted src={staticFile(src)} startFrom={Math.round(from * FPS)} style={{ width: 1080, height: 1920, objectFit: 'cover' }} />
      </div>
      {dim > 0 ? <AbsoluteFill style={{ background: `${SHADE}${dim})` }} /> : null}
    </AbsoluteFill>
  );
};

/** 이 영상 프레임(30fps 편 시간 → 클립 프레임). */
const clipFrame = (c: Clip, f: number, segStart: number, from: number) => {
  const t = (f - F(segStart)) / FPS + from;
  return Math.max(0, Math.min(c.frames - 1, Math.floor(t * c.fps)));
};

/** 등 둘레 고리 — 등이 켜짐 · 꺼짐을 바꾼 순간 버터로 번쩍(측정값). 번호 · 꼬리표 없음. */
const Rings: React.FC<{ f: number; c: Clip; segStart: number; from: number; f0: number; f1: number; z0?: number; z1?: number; cx?: number; cy?: number; flash?: boolean }> = ({ f, c, segStart, from, f0, f1, z0 = 1, z1 = 1.035, cx = 360, cy = 640, flash = true }) => {
  if (f < f0 || f >= f1) return null;
  const z = mix(z0, z1, prog(f, f0, f1 - f0, IN_OUT));
  const k = clipFrame(c, f, segStart, from);
  const appear = prog(f, f0, 8);
  return (
    <AbsoluteFill>
      {c.lamps.map((l, i) => {
        const x = 540 + ((l.x - 360) * SCALE) * z + (360 - cx) * SCALE * (z - 1);
        const y = 960 + ((l.y - 640) * SCALE) * z + (640 - cy) * SCALE * (z - 1);
        const r = Math.max(22, l.r * SCALE * z * 1.15);
        if (x - r < 0 || y + r > 1920 || x + r > 1080) return null; // 화면 밖 등은 고리를 그리지 않는다
        // 최근 4프레임(클립) 안에 바뀌었으면 번쩍
        let hit = 0;
        if (flash) for (let d = 0; d < 4; d++) { const j = k - d; if (j > 0 && c.state[i][j] !== c.state[i][j - 1]) { hit = 1 - d / 4; break; } }
        return (
          <div key={i} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', border: `${hit > 0 ? 5 : 2.5}px solid ${hit > 0 ? BUTTER : 'rgba(255,255,255,0.55)'}`, opacity: appear, boxShadow: hit > 0 ? `0 0 ${24 * hit}px ${6 * hit}px rgba(245,196,69,0.55)` : undefined }} />
        );
      })}
    </AbsoluteFill>
  );
};

/** 위 그늘(글자 자리) — 원래 장면 위에 검은 그늘만. */
const TopShade: React.FC<{ h?: number; a?: number }> = ({ h = 980, a = 0.82 }) => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, ${SHADE}${a}) 0px, ${SHADE}${a * 0.85}) ${h * 0.45}px, ${SHADE}0) ${h}px)` }} />
);

/** 위 큰 글 — 줄 단위로 28px 올라오며 나타남(화면 결 ③). 줄마다 시작초를 따로 준다. */
const Head: React.FC<{ f: number; from: number; to: number; lines: { at: number; node: React.ReactNode }[]; size?: number }> = ({ f, from, to, lines, size = 96 }) => {
  if (f < F(from) || f >= F(to)) return null;
  const out = 1 - prog(f, F(to) - 3, 3);
  return (
    <div style={{ position: 'absolute', left: 74, width: 860, top: 284, fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.4, color: WHITE, textShadow: '0 2px 18px rgba(0,0,0,0.35)' }}>
      {lines.map((l, i) => {
        const p = f <= F(from) && l.at <= from ? 1 : prog(f, F(l.at), 7);
        return (
          <div key={i} style={{ opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` }}>
            {l.node}
          </div>
        );
      })}
    </div>
  );
};

const U: React.FC<{ children: React.ReactNode; p?: number }> = ({ children, p = 1 }) => (
  <span style={{ backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 94%', backgroundSize: `${p * 100}% 0.13em` }}>{children}</span>
);

/** 바뀐 횟수 — 측정 누적값을 그 프레임 그대로(버터 한 곳). */
const Counter: React.FC<{ f: number; c: Clip; segStart: number; from: number; f0: number; f1: number; label: string; top?: number; left?: number; fixed?: number }> = ({ f, c, segStart, from, f0, f1, label, top = 1090, left = 520, fixed }) => {
  if (f < f0 || f >= f1) return null;
  const k = clipFrame(c, f, segStart, from);
  const base = c.offCum[Math.min(c.offCum.length - 1, Math.max(0, Math.floor(from * c.fps)))];
  const n = fixed != null ? fixed : c.offCum[k] - base;
  const ap = prog(f, f0, 8);
  const out = 1 - prog(f, f1 - 3, 3);
  return (
    <div style={{ position: 'absolute', left, top, fontFamily: KO, color: WHITE, opacity: ap * out, transform: `translateY(${(1 - ap) * 20}px)`, textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}>
      <div style={{ fontWeight: 700, fontSize: 42, letterSpacing: -1 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 180, lineHeight: 1, letterSpacing: -6, color: BUTTER, fontVariantNumeric: 'tabular-nums' }}>
        {n}
        <span style={{ fontSize: 90, letterSpacing: -2, marginLeft: 6 }}>번</span>
      </div>
    </div>
  );
};

/** 지시문 한 줄 — 받은 영상에 실제로 넣은 영어 그대로 + 우리말 뜻. 낱말 하나를 짚고, ✕로 긋거나 새 줄을 친다. */
const Prompt: React.FC<{ f: number; f0: number; f1: number; old: boolean; strike?: number; typeFrom?: number; typeEnd?: number; top?: number }> = ({ f, f0, f1, old, strike, typeFrom, typeEnd, top = 900 }) => {
  if (f < F(f0) || f >= F(f1)) return null;
  const ap = prog(f, F(f0), 8);
  const out = 1 - prog(f, F(f1) - 3, 3);
  const NEW = 'All the small round lamps on the railing glow steadily from the first frame to the last; once lit, no lamp ever goes dark, blinks or dims.';
  const tp = typeFrom != null && typeEnd != null ? prog(f, F(typeFrom), F(typeEnd) - F(typeFrom), (x) => x) : 1;
  const shown = NEW.slice(0, Math.round(NEW.length * tp));
  const s = strike != null ? prog(f, F(strike), 9) : 0;
  return (
    <div style={{ position: 'absolute', left: 74, width: 846, top, fontFamily: KO, color: WHITE, opacity: ap * out }}>
      <div style={{ fontWeight: 700, fontSize: 40, letterSpacing: -0.8, color: 'rgba(255,255,255,0.72)', marginBottom: 18 }}>영상 AI에 넣은 지시문 · {old ? '그 한 줄' : '고친 한 줄'}</div>
      {old ? (
        <div style={{ position: 'relative' }}>
          <div style={{ fontWeight: 600, fontSize: 64, lineHeight: 1.22, letterSpacing: -1.2 }}>
            The small round lamps on the railing <U p={prog(f, F(f0) + 6, 10)}>twinkle.</U>
          </div>
          <div style={{ fontWeight: 700, fontSize: 36, letterSpacing: -0.6, color: 'rgba(255,255,255,0.62)', marginTop: 26 }}>우리말 뜻</div>
          <div style={{ fontWeight: 800, fontSize: 70, lineHeight: 1.2, letterSpacing: -1.6, marginTop: 4 }}>
            난간 불빛이 <U p={prog(f, F(f0) + 10, 10)}>반짝인다.</U>
          </div>
          {s > 0 ? (
            <svg width={846} height={330} style={{ position: 'absolute', left: 0, top: 0 }}>
              <line x1={0} y1={64} x2={700 * s} y2={64 + 210 * s} stroke={WHITE} strokeWidth={9} strokeLinecap="round" />
            </svg>
          ) : null}
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: 600, fontSize: 48, lineHeight: 1.24, letterSpacing: -1, minHeight: 300 }}>
            {shown}
            {tp < 1 ? <span style={{ opacity: Math.floor(f / 8) % 2 ? 1 : 0.2 }}>|</span> : null}
          </div>
          <div style={{ fontWeight: 700, fontSize: 36, letterSpacing: -0.6, color: 'rgba(255,255,255,0.62)', marginTop: 18, opacity: prog(f, F(typeEnd ?? f0), 8) }}>우리말 뜻</div>
          <div style={{ fontWeight: 800, fontSize: 70, lineHeight: 1.2, letterSpacing: -1.6, marginTop: 4, opacity: prog(f, F(typeEnd ?? f0), 8) }}>
            등은 <U p={prog(f, F(typeEnd ?? f0) + 4, 10)}>처음부터 끝까지 켜진 채 그대로.</U>
          </div>
        </div>
      )}
    </div>
  );
};

/** 작은 출처 줄 — 이 영상이 무엇인지(새로 구워 잰 것). */
const Source: React.FC<{ f: number; f0: number; f1: number; text: string; top?: number }> = ({ f, f0, f1, text, top = 1380 }) => {
  if (f < F(f0) || f >= F(f1)) return null;
  return <div style={{ position: 'absolute', left: 74, top, width: 846, fontFamily: KO, fontWeight: 700, fontSize: 40, textShadow: '0 1px 10px rgba(0,0,0,0.6)', letterSpacing: -0.8, color: 'rgba(255,255,255,0.88)', opacity: prog(f, F(f0), 8) * (1 - prog(f, F(f1) - 3, 3)) }}>{text}</div>;
};

/** 켜진 등 수 — 5초 동안 프레임마다(측정값). 0~10 계단선, 왼쪽에서 오른쪽으로 그려진다. */
const LitChart: React.FC<{ f: number; c: Clip; f0: number; f1: number; draw: number; top?: number }> = ({ f, c, f0, f1, draw, top = 760 }) => {
  if (f < f0 || f >= f1) return null;
  const W = 846, H = 420;
  const n = c.lit.length;
  const upto = Math.max(1, Math.floor(n * prog(f, f0, draw, (x) => x)));
  const xs = (j: number) => (j / (n - 1)) * W;
  const ys = (v: number) => H - (v / 10) * H;
  let d = `M 0 ${ys(c.lit[0])}`;
  for (let j = 1; j < upto; j++) d += ` H ${xs(j)} V ${ys(c.lit[j])}`;
  const area = `${d} H ${xs(upto - 1)} V ${H} H 0 Z`;
  const ap = prog(f, f0, 6);
  const out = 1 - prog(f, f1 - 3, 3);
  return (
    <div style={{ position: 'absolute', left: 74, top, width: W, opacity: ap * out, fontFamily: KO }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 42, color: WHITE, letterSpacing: -1, marginBottom: 14 }}>
        <span>켜진 등 수</span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 38 }}>10개 중</span>
      </div>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        <line x1={0} y1={0} x2={W} y2={0} stroke="rgba(255,255,255,0.35)" strokeWidth={2} strokeDasharray="8 8" />
        <line x1={0} y1={H} x2={W} y2={H} stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
        <path d={area} fill="rgba(255,241,207,0.16)" />
        <path d={d} fill="none" stroke="#FFF1CF" strokeWidth={6} strokeLinejoin="round" />
        <text x={W - 4} y={H - 12} textAnchor="end" fill="rgba(255,255,255,0.7)" fontSize={34} fontWeight={700}>0</text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontWeight: 700, fontSize: 38, color: 'rgba(255,255,255,0.75)' }}>
        <span>0초</span>
        <span>5초</span>
      </div>
    </div>
  );
};

/** 끝 — 같은 첫 장면의 두 판을 나란히(왼쪽 twinkle · 오른쪽 고친 한 줄). 판 아래 꺼진 횟수(측정값). */
const Pair: React.FC<{ len: number }> = ({ len }) => {
  const f = useCurrentFrame();
  const W = 394, H = 700, top = 590;
  const box = (x: number, src: string, delay: number) => {
    const p = prog(f, delay, 9);
    return (
      <div style={{ position: 'absolute', left: x, top, width: W, height: H, borderRadius: 18, overflow: 'hidden', background: '#000', opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
        <OffthreadVideo muted src={staticFile(src)} startFrom={0} style={{ width: W, height: H, objectFit: 'cover', transform: `scale(${mix(1.0, 1.05, prog(f, 0, F(len), IN_OUT))})` }} />
      </div>
    );
  };
  const lab = (x: number, a: string, b: React.ReactNode, delay: number) => {
    const p = prog(f, delay, 8);
    return (
      <div style={{ position: 'absolute', left: x, top: top + H + 18, width: W, fontFamily: KO, color: WHITE, opacity: p }}>
        <div style={{ fontWeight: 700, fontSize: 38, letterSpacing: -0.8, color: 'rgba(255,255,255,0.78)' }}>{a}</div>
        <div style={{ fontWeight: 800, fontSize: 64, letterSpacing: -1.6, lineHeight: 1.1 }}>{b}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      {box(74, CLIP.A, 0)}
      {box(526, CLIP.D, 4)}
      {lab(74, 'twinkle', <><span style={{ color: BUTTER }}>{TW.offTotal}번</span> 꺼짐</>, 8)}
      {lab(526, '처음부터 끝까지 켜진 채', <><span style={{ color: BUTTER }}>{ST.offTotal}번</span> 꺼짐</>, 12)}
    </AbsoluteFill>
  );
};

/** 켜진 등 열 개 — 측정 상태 그대로 점 열 개가 켜지고 꺼진다(휴대폰 크기에서도 깜빡임이 보이게). */
const Dots: React.FC<{ f: number; c: Clip; segStart: number; from: number; f0: number; f1: number; top?: number }> = ({ f, c, segStart, from, f0, f1, top = 548 }) => {
  if (f < f0 || f >= f1) return null;
  const k = clipFrame(c, f, segStart, from);
  const ap = prog(f, f0, 8);
  const out = 1 - prog(f, f1 - 3, 3);
  const on = c.state.reduce((n, row) => n + (row[k] === '1' ? 1 : 0), 0);
  return (
    <div style={{ position: 'absolute', left: 74, top, display: 'flex', alignItems: 'center', gap: 12, opacity: ap * out, fontFamily: KO }}>
      <div style={{ fontWeight: 800, fontSize: 40, letterSpacing: -1, color: WHITE, marginRight: 8, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>켜진 등</div>
      {c.state.map((row, i) => {
        const lit = row[k] === '1';
        return <div key={i} style={{ width: 44, height: 44, borderRadius: '50%', background: lit ? '#FFF1CF' : 'rgba(255,255,255,0.12)', boxShadow: lit ? '0 0 22px 6px rgba(255,214,140,0.55)' : 'inset 0 0 0 2px rgba(255,255,255,0.28)' }} />;
      })}
      <div style={{ marginLeft: 14, fontWeight: 800, fontSize: 44, letterSpacing: -1, color: WHITE, fontVariantNumeric: 'tabular-nums', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>{on}/10</div>
    </div>
  );
};

/** 첫 화면 — 받은 영상에 실제로 넣은 지시문 끝 한 줄(영어 그대로 · 짚는 낱말 밑줄). */
const HookLine: React.FC<{ f: number; f0: number; f1: number; top?: number }> = ({ f, f0, f1, top = 548 }) => {
  if (f < F(f0) || f >= F(f1)) return null;
  const ap = prog(f, F(f0), 8);
  const out = 1 - prog(f, F(f1) - 3, 3);
  return (
    <div style={{ position: 'absolute', left: 74, width: 846, top, fontFamily: KO, color: WHITE, opacity: ap * out, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
      <div style={{ fontWeight: 700, fontSize: 36, letterSpacing: -0.6, color: 'rgba(255,255,255,0.7)' }}>지시문에 넣은 한 줄</div>
      <div style={{ fontWeight: 600, fontSize: 44, lineHeight: 1.22, letterSpacing: -0.8, marginTop: 8, whiteSpace: 'nowrap' }}>“…lamps on the railing <U p={prog(f, F(f0) + 10, 10)}>twinkle</U>.”</div>
    </div>
  );
};

export const Film: React.FC<{ bgm: boolean; voice: boolean; bare: boolean; hero?: boolean }> = ({ bgm, voice, bare, hero = false }) => {
  const fr = useCurrentFrame();
  const off = hero ? F(T.count) : 0; // 핵심 장면만(장면 심사): 편 시간 T.count부터
  const f = fr + off;
  const lamp = { cx: CLIP.lampCx, cy: CLIP.lampCy };
  const seg = (a: number, b: number) => ({ from: F(a) - off, durationInFrames: F(b) - F(a) });
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* 기 — 「twinkle」 판 그대로(전) */}
      {!hero ? <Sequence {...seg(0, T.count)}><Plate src={CLIP.C} from={0} f0={0} f1={F(T.count)} z0={1.0} z1={1.05} /></Sequence> : null}
      {/* 핵심 장면 — 등 줄로 다가가 바뀔 때마다 고리가 번쩍 · 횟수가 오른다(측정값) */}
      <Sequence {...seg(T.count, T.map)}><Plate src={CLIP.A} from={0} f0={0} f1={F(T.map) - F(T.count)} z0={1.3} z1={1.4} {...lamp} /></Sequence>
      {!hero ? (
        <>
          {/* 켜짐 지도 */}
          <Sequence {...seg(T.map, T.why)}><Plate src={CLIP.C} from={2.4} f0={0} f1={F(T.why) - F(T.map)} z0={1.08} z1={1.12} dim={0.62} /></Sequence>
          {/* 전 — 그날 그 한 줄 → ✕ */}
          <Sequence {...seg(T.why, T.fix)}><Plate src={CLIP.A} from={0} f0={0} f1={F(T.fix) - F(T.why)} z0={1.12} z1={1.16} dim={0.72} /></Sequence>
          {/* 전 — 고친 한 줄 */}
          <Sequence {...seg(T.fix, T.after)}><Plate src={CLIP.A} from={1.1} f0={0} f1={F(T.after) - F(T.fix)} z0={1.18} z1={1.24} dim={0.74} /></Sequence>
          {/* 결 — 같은 첫 장면, 한 줄만 바꾼 판(후) — 끝에서 처음 보인다 */}
          <Sequence {...seg(T.after, T.card)}><Plate src={CLIP.B} from={0} f0={0} f1={F(T.card) - F(T.after)} z0={1.0} z1={1.04} /></Sequence>
          <Sequence {...seg(T.card, LEN)}><Pair len={LEN - T.card} /></Sequence>
        </>
      ) : null}

      {!bare ? (
        <>
          {!hero && (f < F(T.count) || (f >= F(T.map) && f < F(T.why)) || (f >= F(T.after) && f < F(T.card))) ? <TopShade /> : null}
          {!hero && f >= F(T.count) && f < F(T.map) ? <TopShade h={720} a={0.78} /> : null}

          {!hero ? <Head f={f} from={0} to={T.count} lines={[{ at: 0, node: <>영상 AI 지시문에</> }, { at: T.hook2, node: <><U p={prog(f, F(T.hook2) + 2, 8)}>twinkle</U>(반짝인다)</> }]} /> : null}
          {!hero ? <Head f={f} from={T.count} to={T.map} lines={[{ at: T.count, node: <>난간 등이 한꺼번에</> }, { at: T.count2, node: <>꺼졌다 켜졌다</> }]} size={92} /> : null}
          <Rings f={f} c={TW} segStart={T.count} from={0} f0={F(T.count)} f1={F(T.map)} z0={1.3} z1={1.4} cx={lamp.cx} cy={lamp.cy} />
          <Dots f={f} c={TW} segStart={T.count} from={0} f0={F(T.count) + 2} f1={F(T.map)} top={hero ? 300 : 548} />
          <Counter f={f} c={TW} segStart={T.count} from={0} f0={F(T.count) + 4} f1={F(T.map)} label={hero ? "" : "등이 꺼진 횟수 · 10개 합"} />

          {!hero ? (
            <>
              <Head f={f} from={T.map} to={T.why} lines={[{ at: T.map, node: <>등 열 개가 {CLIP.span}초 동안</> }, { at: T.map2, node: <><span style={{ color: BUTTER }}>{TW.offTotal}번</span> 꺼졌다</> }]} />
              <LitChart f={f} c={TW} f0={F(T.map) + 3} f1={F(T.why)} draw={F(1.4)} />

              <Head f={f} from={T.why} to={T.fix} lines={[{ at: T.why, node: <>이 영상 AI는 twinkle을</> }, { at: T.why2, node: <>껐다 켜기로 그렸다</> }]} />
              <Prompt f={f} f0={T.why} f1={T.fix} old strike={T.strike} />
              <Head f={f} from={T.fix} to={T.after} lines={[{ at: T.fix, node: <>그래서</> }, { at: T.fix2, node: <>이 한 줄로 바꿨다</> }]} />
              <Prompt f={f} f0={T.fix} f1={T.after} old={false} typeFrom={T.fix + 0.3} typeEnd={T.typeEnd} />

              <Head f={f} from={T.after} to={T.card} lines={[{ at: T.after, node: <>한 줄만 바꿨더니</> }, { at: T.after2, node: <>꺼진 횟수 <span style={{ color: BUTTER }}>{ST.offTotal}번</span></> }]} />
              <Rings f={f} c={ST} segStart={T.after} from={0} f0={F(T.after)} f1={F(T.card)} z0={1.0} z1={1.04} flash={false} />
              <Head f={f} from={T.card} to={LEN + 1} lines={[{ at: T.card, node: <>꺼지면 안 되는 불은</> }, { at: T.card2, node: <><U p={prog(f, F(T.card2) + 2, 8)}>「처음부터 끝까지</U></> }, { at: T.card2 + 0.25, node: <><U p={prog(f, F(T.card2 + 0.25) + 2, 8)}>켜진 채 그대로」</U></> }]} size={74} />

              <HookLine f={f} f0={0.5} f1={T.count} />
              <Source f={f} f0={0.8} f1={T.count} top={690} text="같은 지시문으로 새로 만들어 센 실제 영상" />
              <Source f={f} f0={T.after + 0.3} f1={T.card} top={640} text="같은 첫 장면, 그 한 줄만 바꿔 다시 만든 영상" />
              <Dots f={f} c={ST} segStart={T.after} from={0} f0={F(T.after) + 2} f1={F(T.card)} top={548} />
            </>
          ) : null}
        </>
      ) : null}

      {voice && !hero ? VO.map((v) => <Sequence key={v.id} from={F(v.at)}><Audio src={staticFile(`vo/${v.id}.wav`)} /></Sequence>) : null}
      {bgm && !hero ? <Audio src={staticFile('bgm.wav')} volume={(x) => (x < F(0.6) ? mix(0, 0.26, x / F(0.6)) : x > F(LEN) - F(1.2) ? mix(0.26, 0, (x - (F(LEN) - F(1.2))) / F(1.2)) : 0.26)} /> : null}
      {!hero ? CLIP.sfx.map((s, i) => <Sequence key={i} from={F(s.at)}><Audio src={staticFile(`sfx/${s.id}.wav`)} volume={s.vol} /></Sequence>) : null}
    </AbsoluteFill>
  );
};
