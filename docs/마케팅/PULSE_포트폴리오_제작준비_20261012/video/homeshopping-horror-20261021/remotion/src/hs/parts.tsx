// 홈쇼핑 화면 부품. 일부러 촌스럽게 — 굵은 글자에 두꺼운 테두리 · 그림자, 금빛 별 딱지, 빨간 띠, 햇살 무늬, 반짝이.
// 모든 움직임은 그 장면 안 프레임(useCurrentFrame) 기준이고, 소리는 부품이 나타나는 프레임에 하나씩 붙는다.
import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { HS, HS_EN, KO } from '../lib/fonts';
import { P1, Seq } from './product';

export const FPS = 24;
export const sec = (s: number) => Math.round(s * FPS);

// 글자 테두리: 그림자를 둥글게 겹쳐 두꺼운 외곽선(HTML 글자에는 paint-order가 안 먹는 판이 있어 그림자로)
export const ol = (c: string, w: number, drop = '') => {
  const s: string[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    s.push(`${(Math.cos(a) * w).toFixed(1)}px ${(Math.sin(a) * w).toFixed(1)}px 0 ${c}`);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    s.push(`${((Math.cos(a) * w) / 2).toFixed(1)}px ${((Math.sin(a) * w) / 2).toFixed(1)}px 0 ${c}`);
  }
  if (drop) s.push(drop);
  return s.join(',');
};

// 튀어나오기(스프링, 넘쳤다 돌아옴). 시작 전에는 0
export const usePop = (start: number, damping = 9) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < start) return 0;
  return spring({ frame: f - start, fps, config: { damping, stiffness: 190, mass: 0.6 } });
};

export const Sfx: React.FC<{ at: number; src: string; vol?: number }> = ({ at, src, vol = 0.5 }) => (
  <Sequence from={at} layout="none">
    <Audio src={staticFile(`sfx/${src}.wav`)} volume={vol * 0.8} />{/* 가편집과 같은 MASTER 0.8 — Remotion은 0dBFS 넘는 표본을 자른다 */}
  </Sequence>
);

// ── 바탕: 돌아가는 햇살 무늬 + 가운데 흰 빛 ────────────────────────────────
export const PALETTES = {
  sky: { a: '#1596EF', b: '#62CBFF', glow: '#FFFFFF' },
  pop: { a: '#FF2E8A', b: '#FFC21A', glow: '#FFF6D8' },
  fire: { a: '#D40000', b: '#FF9800', glow: '#FFF1C2' },
  gold: { a: '#FFB000', b: '#FFE15A', glow: '#FFFFFF' },
};
export type Palette = keyof typeof PALETTES;

export const Sunburst: React.FC<{ palette: Palette; cx?: number; cy?: number }> = ({ palette, cx = 1250, cy = 560 }) => {
  const f = useCurrentFrame();
  const p = PALETTES[palette];
  const n = 28;
  const R = 2600;
  const wedges = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 0.5) / n) * Math.PI * 2;
    wedges.push(`M0 0 L${(Math.cos(a0) * R).toFixed(0)} ${(Math.sin(a0) * R).toFixed(0)} L${(Math.cos(a1) * R).toFixed(0)} ${(Math.sin(a1) * R).toFixed(0)} Z`);
  }
  return (
    <AbsoluteFill style={{ background: p.a }}>
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        <defs>
          <radialGradient id={`g-${palette}`} cx={cx} cy={cy} r={760} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={p.glow} stopOpacity={0.62} />
            <stop offset="0.45" stopColor={p.glow} stopOpacity={0.38} />
            <stop offset="1" stopColor={p.glow} stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`v-${palette}`} cx={960} cy={540} r={1150} gradientUnits="userSpaceOnUse">
            <stop offset="0.6" stopColor="#000" stopOpacity={0} />
            <stop offset="1" stopColor="#000" stopOpacity={0.35} />
          </radialGradient>
        </defs>
        <g transform={`translate(${cx} ${cy}) rotate(${(f * 0.35).toFixed(2)})`}>
          {wedges.map((d, i) => <path key={i} d={d} fill={p.b} />)}
        </g>
        <rect width={1920} height={1080} fill={`url(#g-${palette})`} />
        <rect width={1920} height={1080} fill={`url(#v-${palette})`} />
      </svg>
    </AbsoluteFill>
  );
};

// ── 회전 받침 위 제품(블렌더 알파 렌더 프레임 열 — product.ts의 Seq) ───────────────
// 1안 병은 120장(-60°→+60°)이고 1080² 프레임에서 받침 · 병이 x 298~781 · y 262~908(가운데 x 540).
// cx · bottom = 화면에서 받침 밑이 놓일 자리, h = 제품+받침 높이(px)
export const Turntable: React.FC<{ cx: number; bottom: number; h: number; first: number; dim?: number; seq?: Seq; shadow?: number }> = ({ cx, bottom, h, first, dim = 0, seq = P1.main, shadow = 0.38 }) => {
  const f = useCurrentFrame();
  const idx = Math.max(1, Math.min(seq.n, first + f));
  const s = h / (seq.bottom - seq.top);
  const size = 1080 * s;
  return (
    <Img
      src={staticFile(`${seq.dir}/${seq.prefix}_${String(idx).padStart(4, '0')}.png`)}
      style={{ position: 'absolute', width: size, height: size, left: cx - seq.cx * s, top: bottom - seq.bottom * s, filter: `drop-shadow(0 ${(16 * s).toFixed(1)}px ${(34 * s).toFixed(1)}px rgba(0,24,80,${shadow}))${dim ? ` brightness(${1 - dim})` : ''}` }}
    />
  );
};

export const Pedestal: React.FC<{ cx: number; bottom: number; w: number }> = ({ cx, bottom, w }) => {
  // 받침만 렌더(1080²)에서 받침은 x 294~785 · y 525~647
  const s = w / 491;
  return <Img src={staticFile('bottle/pedestal.png')} style={{ position: 'absolute', width: 1080 * s, height: 1080 * s, left: cx - 540 * s, top: bottom - 647 * s }} />;
};

// ── 반짝이: 네 갈래 별이 번갈아 깜빡 ─────────────────────────────────────────
export const Sparkles: React.FC<{ pts: [number, number, number][]; color?: string }> = ({ pts, color = '#FFFFFF' }) => {
  const f = useCurrentFrame();
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', pointerEvents: 'none' }}>
      {pts.map(([x, y, r], i) => {
        const ph = (f / 14 + i * 0.37) % 1;
        const k = Math.sin(ph * Math.PI) ** 2;
        const rr = r * (0.35 + 0.65 * k);
        const d = `M${x} ${y - rr} Q${x} ${y} ${x + rr} ${y} Q${x} ${y} ${x} ${y + rr} Q${x} ${y} ${x - rr} ${y} Q${x} ${y} ${x} ${y - rr} Z`;
        return <path key={i} d={d} fill={color} opacity={0.35 + 0.65 * k} style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.9))' }} />;
      })}
    </svg>
  );
};

// ── 왼쪽 위 LIVE · 방송 중 ────────────────────────────────────────────────
export const LiveBug: React.FC = () => {
  const f = useCurrentFrame();
  const on = Math.floor(f / 10) % 2 === 0;
  return (
    <div style={{ position: 'absolute', left: 46, top: 36, display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ background: '#E4001B', borderRadius: 10, padding: '4px 20px 2px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 0 #7A0010' }}>
        <div style={{ width: 20, height: 20, borderRadius: 10, background: '#FFFFFF', opacity: on ? 1 : 0.25 }} />
        <span style={{ fontFamily: HS_EN, fontSize: 44, color: '#FFFFFF', letterSpacing: 2 }}>LIVE</span>
      </div>
      <div style={{ background: 'rgba(10,20,60,0.78)', borderRadius: 10, padding: '6px 18px 4px', fontFamily: HS, fontSize: 36, color: '#FFFFFF' }}>방송 중</div>
    </div>
  );
};

// ── 오른쪽 위 마감 시계(빠르게 줄어든다) ────────────────────────────────────
export const Countdown: React.FC<{ from: number; every?: number }> = ({ from, every = 6 }) => {
  const f = useCurrentFrame();
  const left = Math.max(0, from - Math.floor(f / every));
  const ss = String(left).padStart(2, '0');
  const urgent = left <= 10;
  return (
    <div style={{ position: 'absolute', right: 46, top: 34, textAlign: 'right' }}>
      <div style={{ fontFamily: HS, fontSize: 32, color: '#FFFFFF', textShadow: ol('#0B1A4A', 4) }}>주문 마감까지</div>
      <div style={{ fontFamily: HS_EN, fontSize: 88, lineHeight: 1, color: urgent ? '#FF2A2A' : '#FFE14A', textShadow: ol('#0B1A4A', 6, '0 6px 0 rgba(0,0,0,0.35)') }}>00:{ss}</div>
    </div>
  );
};

export const OrderCounter: React.FC<{ from: number; to: number; at: number }> = ({ from, to, at }) => {
  const f = useCurrentFrame();
  const n = f < at ? from : to;
  const p = usePop(at, 7);
  const fmt = n.toLocaleString('en-US');
  return (
    <div style={{ position: 'absolute', right: 46, top: 34, textAlign: 'right' }}>
      <div style={{ fontFamily: HS, fontSize: 32, color: '#FFFFFF', textShadow: ol('#0B1A4A', 4) }}>방송 중 주문</div>
      <div style={{ fontFamily: HS_EN, fontSize: 88, lineHeight: 1, color: '#FFE14A', textShadow: ol('#0B1A4A', 6, '0 6px 0 rgba(0,0,0,0.35)') }}>{fmt}건</div>
      {f >= at ? (
        <div style={{ position: 'absolute', right: -6, top: 118, transform: `scale(${p})`, transformOrigin: 'right top', fontFamily: HS_EN, fontSize: 64, color: '#FF2A2A', textShadow: ol('#FFFFFF', 5) }}>+{to - from}</div>
      ) : null}
    </div>
  );
};

// ── 상품명(왼쪽에서 미끄러져 들어옴) ──────────────────────────────────────────
export const ProductName: React.FC<{ at: number; big: string; small: string; top?: number }> = ({ at, big, small, top = 170 }) => {
  const f = useCurrentFrame();
  const x = interpolate(f, [at, at + 6, at + 9], [-900, 24, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 64 + x, top, opacity: f < at ? 0 : 1 }}>
      <div style={{ fontFamily: HS, fontSize: 104, lineHeight: 1.05, color: '#FFFFFF', textShadow: ol('#0B1A4A', 9, '0 10px 0 rgba(0,0,0,0.3)') }}>{big}</div>
      <div style={{ fontFamily: HS, fontSize: 70, lineHeight: 1.15, color: '#FFE14A', textShadow: ol('#0B1A4A', 7, '0 8px 0 rgba(0,0,0,0.3)') }}>{small}</div>
    </div>
  );
};

// ── 빨간 띠(비스듬한 평행사변형) ─────────────────────────────────────────────
export const Band: React.FC<{ at: number; text: string; top: number; left?: number; bg?: string; fg?: string; rot?: number; size?: number; fromRight?: boolean }> = ({ at, text, top, left = 40, bg = '#E4001B', fg = '#FFFFFF', rot = 0, size = 62, fromRight = false }) => {
  const f = useCurrentFrame();
  const x = interpolate(f, [at, at + 5, at + 8], [fromRight ? 1400 : -1100, fromRight ? -20 : 20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: left + x, top, opacity: f < at ? 0 : 1, transform: `rotate(${rot}deg)` }}>
      <div style={{ background: bg, transform: 'skewX(-14deg)', padding: '6px 46px 2px', border: '6px solid #FFFFFF', boxShadow: '0 10px 0 rgba(0,0,0,0.28)' }}>
        <div style={{ transform: 'skewX(14deg)', fontFamily: HS, fontSize: size, color: fg, whiteSpace: 'nowrap' }}>{text}</div>
      </div>
    </div>
  );
};

// ── 금빛 별 값 딱지 ────────────────────────────────────────────────────────
const starPath = (R: number, r: number, n: number) => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${(Math.cos(a) * rad).toFixed(1)},${(Math.sin(a) * rad).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
};

export const PriceStar: React.FC<{ at: number; x: number; y: number; R?: number; price: string; label?: string; tone?: 'gold' | 'yellow' | 'white'; struck?: number; wobble?: boolean }> = ({ at, x, y, R = 250, price, label, tone = 'gold', struck, wobble = true }) => {
  const f = useCurrentFrame();
  const p = usePop(at, 8);
  if (f < at) return null;
  const rot = wobble ? Math.sin((f - at) / 9) * 4 : 0;
  const id = `st-${at}-${x}`;
  const digits = price.replace(/원$/, '');
  const fs = Math.min(R * 0.5, (R * 1.62) / Math.max(4, digits.length * 0.62));
  const strike = struck !== undefined && f >= struck ? interpolate(f, [struck, struck + 4], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  return (
    <div style={{ position: 'absolute', left: x - R, top: y - R, width: R * 2, height: R * 2, transform: `scale(${p}) rotate(${rot}deg)` }}>
      <svg width={R * 2} height={R * 2} viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} style={{ position: 'absolute', overflow: 'visible' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="-1" x2="0" y2="1">
            <stop offset="0" stopColor={tone === 'gold' ? '#FFF27A' : tone === 'white' ? '#FFFFFF' : '#FFFF66'} />
            <stop offset="0.55" stopColor={tone === 'gold' ? '#FFC21A' : tone === 'white' ? '#FFFFFF' : '#FFE600'} />
            <stop offset="1" stopColor={tone === 'gold' ? '#F08A00' : tone === 'white' ? '#FFE9E9' : '#FFB800'} />
          </linearGradient>
        </defs>
        <path d={starPath(R * 0.98, R * 0.8, 20)} fill="#FFFFFF" transform="translate(0 10)" opacity={0.0} />
        <path d={starPath(R * 0.98, R * 0.8, 20)} fill="#FFFFFF" />
        <path d={starPath(R * 0.9, R * 0.73, 20)} fill={`url(#${id})`} stroke="#E4001B" strokeWidth={9} strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        {label ? <div style={{ fontFamily: HS, fontSize: R * 0.17, color: '#0B1A4A', marginBottom: -6 }}>{label}</div> : null}
        <div style={{ display: 'flex', alignItems: 'baseline', position: 'relative' }}>
          <span style={{ fontFamily: HS_EN, fontSize: fs, color: '#E4001B', textShadow: ol('#FFFFFF', 6), letterSpacing: -1 }}>{digits}</span>
          <span style={{ fontFamily: HS, fontSize: fs * 0.48, color: '#E4001B', textShadow: ol('#FFFFFF', 5), marginLeft: 4 }}>원</span>
          {strike > 0 ? (
            <div style={{ position: 'absolute', left: -12, right: -12, top: '52%', height: 16, background: '#111', transform: `rotate(-9deg) scaleX(${strike})`, transformOrigin: 'left center', borderRadius: 8, boxShadow: '0 0 0 4px #FFFFFF' }} />
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ── 딱지(동그라미 · 둥근 네모 · 터짐) ────────────────────────────────────────
export const Sticker: React.FC<{ at: number; x: number; y: number; text: string; shape?: 'circle' | 'pill' | 'burst'; bg?: string; fg?: string; size?: number; rot?: number; w?: number }> = ({ at, x, y, text, shape = 'pill', bg = '#FFE14A', fg = '#E4001B', size = 54, rot = -6, w }) => {
  const f = useCurrentFrame();
  const p = usePop(at, 7);
  if (f < at) return null;
  const lines = text.split('\n');
  if (shape === 'burst') {
    const R = w ?? 150;
    return (
      <div style={{ position: 'absolute', left: x - R, top: y - R, width: R * 2, height: R * 2, transform: `scale(${p}) rotate(${rot + Math.sin((f - at) / 6) * 3}deg)` }}>
        <svg width={R * 2} height={R * 2} viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} style={{ position: 'absolute', overflow: 'visible' }}>
          <path d={starPath(R, R * 0.74, 14)} fill="#FFFFFF" />
          <path d={starPath(R * 0.9, R * 0.66, 14)} fill={bg} stroke="#0B1A4A" strokeWidth={6} strokeLinejoin="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: HS, fontSize: size, lineHeight: 1.0, color: fg, textAlign: 'center', textShadow: ol('#FFFFFF', 4) }}>
          {lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    );
  }
  const round = shape === 'circle';
  const D = w ?? 230;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${p}) rotate(${rot}deg)` }}>
      <div style={{ background: bg, color: fg, fontFamily: HS, fontSize: size, lineHeight: 1.0, textAlign: 'center', border: '7px solid #FFFFFF', boxShadow: '0 0 0 5px #0B1A4A, 0 12px 0 rgba(0,0,0,0.3)', borderRadius: round ? D : 22, width: round ? D : undefined, height: round ? D : undefined, padding: round ? 0 : '14px 30px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>
        {lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
};

// ── 도장(쾅 — 크게 날아와 박히고 화면이 흔들린다) ────────────────────────────
export const Stamp: React.FC<{ at: number; x: number; y: number; text: string; color?: string; rot?: number; size?: number }> = ({ at, x, y, text, color = '#E1001A', rot = -13, size = 120 }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const t = f - at;
  const s = t < 5 ? interpolate(t, [0, 5], [2.7, 1], { easing: (v) => v * v }) : 1 + Math.max(0, 0.06 * Math.cos((t - 5) * 1.6) * Math.exp(-(t - 5) / 3));
  const o = interpolate(t, [0, 2], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${s})`, opacity: o }}>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id={`rough-${at}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={at} />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.75" />
          <feComposite in="SourceGraphic" operator="in" />
        </filter>
      </svg>
      <div style={{ filter: `url(#rough-${at})`, border: `12px solid ${color}`, borderRadius: 26, padding: 10 }}>
        <div style={{ border: `5px solid ${color}`, borderRadius: 14, padding: '18px 44px 6px', fontFamily: HS, fontSize: size, color, whiteSpace: 'nowrap', lineHeight: 1.05 }}>{text}</div>
      </div>
    </div>
  );
};

export const shakeAt = (f: number, at: number, amp = 18) => {
  const t = f - at;
  if (t < 0 || t > 7) return { x: 0, y: 0 };
  const k = amp * (1 - t / 8);
  return { x: Math.sin(t * 2.7 + 1) * k, y: Math.cos(t * 3.3) * k };
};

// ── 아래 주문 띠(전화번호 + 흐르는 글) ────────────────────────────────────────
export const OrderBar: React.FC<{ phone?: string }> = ({ phone = P1.phone }) => {
  const f = useCurrentFrame();
  const ticker = '  ARS 주문 시 추가 할인  ·  무이자 10개월  ·  지금 이 구성 마지막  ·  방송 중 주문 폭주  ·  ARS 주문 시 추가 할인  ·  무이자 10개월  ·  지금 이 구성 마지막  ·  방송 중 주문 폭주  ·';
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 104, background: 'linear-gradient(#13286E, #08143D)', borderTop: '6px solid #FFE14A', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      <div style={{ zIndex: 2, height: '100%', display: 'flex', alignItems: 'center', gap: 18, padding: '0 34px', background: '#E4001B', boxShadow: '10px 0 20px rgba(0,0,0,0.4)' }}>
        <span style={{ fontFamily: HS, fontSize: 40, color: '#FFFFFF' }}>주문 전화</span>
        <span style={{ fontFamily: HS, fontSize: 66, color: '#FFE14A', textShadow: ol('#7A0010', 4) }}>{phone}</span>
      </div>
      <div style={{ position: 'relative', flex: 1, height: '100%' }}>
        <div style={{ position: 'absolute', top: 24, left: 40 - ((f * 9) % 1300), fontFamily: HS, fontSize: 48, color: '#FFFFFF', whiteSpace: 'nowrap' }}>{ticker}</div>
      </div>
    </div>
  );
};

export const Disclaimer: React.FC = () => (
  <div style={{ position: 'absolute', right: 30, bottom: 116, fontFamily: KO, fontWeight: 600, fontSize: 24, color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>가상 브랜드 · 가상 방송</div>
);
