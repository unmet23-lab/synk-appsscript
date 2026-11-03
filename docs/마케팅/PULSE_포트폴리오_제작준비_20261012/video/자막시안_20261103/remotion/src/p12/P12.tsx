// 12번 모두의코스 자막 · 모션그래픽 시안 — 「앱 화면 결」(2026-11-03)
//   처음 제목이 크게 떴다가 위 줄로 접힘 → 컷마다 장소 칩(일차 · 장소) · 「그 사람」 마주친 횟수가 하나씩 오름
//   16번에서 두 폰을 잇는 「같은 화면」 표시 → 끝은 정지 그림 대신 제주 위 코스 선이 그려지고 핀 열다섯이 찍힌 뒤 브랜드
// 바닥 고정 자막(밈 원본 꼴)은 뺐다. 화면 · 소리는 git 밖 public(p12/picture.mp4 · sound.wav).
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { EN, KO, MONO } from '../lib/fonts';
import { EXPO, pop, ramp } from '../lib/motion';

const FPS = 24;
export const P12_FRAMES = Math.round(37.64 * FPS);
const T = [0, 1.87, 3.87, 7.2, 11.73, 15.1, 18.3, 21.77, 22.87, 27.07, 27.77, 28.47, 29.17, 29.87, 30.57, 31.27, 35.14, 37.64];
const MINT = '#20B296', MINT_D = '#12846E', INK = '#101414', PAPER = '#F7F6F1';
// 컷 → [일차, 장소, 마주친 횟수] (7 · 8은 같은 곳)
const PLACE: [string, string, number][] = [
  ['1일차', '김포 → 제주 기내', 1], ['1일차', '공항 렌터카 셔틀', 2], ['1일차', '호텔 수영장', 3], ['1일차', '요트 투어', 4], ['1일차', '해변 카페', 5],
  ['2일차', '억새 오름', 6], ['2일차', 'ATV 체험', 7], ['2일차', 'ATV 체험', 7], ['2일차', '비양도 해변', 8], ['2일차', '해녀의 집', 9],
  ['3일차', '우도 해안도로', 10], ['3일차', '감귤밭', 11], ['3일차', '성산일출봉', 12], ['3일차', '바다 카페', 13], ['3일차', '야시장', 14], ['3일차', '흑돼지 식당', 15],
];
const abs = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: w, height: h });
const cutAt = (t: number) => { let i = 0; while (i < 16 && t >= T[i + 1]) i++; return i; };   // 0 … 16(끝)

const Pin: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}><path d="M12 22s7-7.2 7-12.2A7 7 0 0 0 5 9.8C5 14.8 12 22 12 22Z" fill={color} /><circle cx="12" cy="9.8" r="2.8" fill="#fff" /></svg>
);

// 두 자리 수가 위로 굴러 바뀐다
const Odo: React.FC<{ n: number; t: number; at: number }> = ({ n, t, at }) => {
  const p = ramp(t, at, 0.22, EXPO);
  const s = String(n).padStart(2, '0'), prev = String(Math.max(0, n - 1)).padStart(2, '0');
  return (
    <div style={{ display: 'flex', fontFamily: MONO, fontWeight: 500, fontSize: 64, lineHeight: 1, color: INK }}>
      {[0, 1].map((k) => (
        <div key={k} style={{ position: 'relative', width: 40, height: 66, overflow: 'hidden' }}>
          {s[k] === prev[k] ? <span style={{ position: 'absolute', top: 0 }}>{s[k]}</span> : <>
            <span style={{ position: 'absolute', top: -p * 66 }}>{prev[k]}</span>
            <span style={{ position: 'absolute', top: (1 - p) * 66 }}>{s[k]}</span>
          </>}
        </div>
      ))}
    </div>
  );
};

const Head: React.FC<{ t: number }> = ({ t }) => {
  // 0 ~ 1.5초 세 줄로 크게 → 1.45 ~ 1.87초 작아지며 위로 빠지고, 그 자리에 한 줄 머리글이 남는다
  // (처음엔 세 줄을 그대로 줄여 접었더니 셋째 줄이 장소 칩과 겹쳤다 — 11-03 자체 검수)
  const d = ramp(t, 1.45, 0.42, EXPO);
  return (
    <>
      <div style={{ ...abs(64, 540 - d * 330, 952), zIndex: 30, transformOrigin: 'left top', transform: `scale(${1 - d * 0.55})`, opacity: 1 - ramp(t, 1.6, 0.25) }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 118, lineHeight: 1.04, letterSpacing: '-0.05em', color: PAPER, textShadow: '0 4px 30px #0007', whiteSpace: 'pre-line', opacity: Math.min(1, pop(t, 0.0, 0.35)) }}>
          {'제주 2박 3일,\n가는 데마다\n'}<span style={{ color: '#7DF0D3' }}>또 그 사람.</span>
        </div>
      </div>
      <div style={{ ...abs(64, 200, 952), zIndex: 30, fontFamily: KO, fontWeight: 700, fontSize: 38, letterSpacing: '-0.03em', color: PAPER, textShadow: '0 2px 14px #000a', opacity: ramp(t, 1.62, 0.25), transform: `translateY(${(1 - ramp(t, 1.62, 0.3, EXPO)) * 14}px)` }}>
        제주 2박 3일, 가는 데마다 <span style={{ color: '#7DF0D3' }}>또 그 사람</span>
      </div>
      <div style={{ ...abs(64, 262, 952, 2), zIndex: 29, background: PAPER, opacity: 0.5 * d }} />
    </>
  );
};

const Chip: React.FC<{ t: number; i: number }> = ({ t, i }) => {
  const [day, name] = PLACE[i];
  const same = i > 0 && PLACE[i - 1][1] === name;
  const p = same ? 1 : ramp(t, T[i], 0.24, EXPO);
  return (
    <div style={{ ...abs(64, 300, 700), zIndex: 30, display: 'flex', alignItems: 'center', gap: 14, transform: `translateX(${(1 - p) * -60}px)`, opacity: p }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: MINT, color: '#fff', borderRadius: 40, padding: '12px 24px 12px 16px', boxShadow: '0 10px 30px #0003' }}>
        <Pin size={34} color="#fff" />
        <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 38, letterSpacing: '-0.03em' }}>{name}</span>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 26, color: PAPER, textShadow: '0 1px 10px #000a' }}>{day}</span>
    </div>
  );
};

const Counter: React.FC<{ t: number; i: number }> = ({ t, i }) => {
  const n = PLACE[i][2];
  const at = PLACE.findIndex((p) => p[2] === n);
  const bump = 1 + (1 - ramp(t, T[at], 0.25)) * 0.12;
  return (
    <div style={{ ...abs(800, 292, 216), zIndex: 30, background: PAPER, borderRadius: 26, padding: '14px 20px 16px', boxShadow: '0 12px 30px #0004', transform: `scale(${bump})`, transformOrigin: 'right top' }}>
      <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 24, color: '#5d6461' }}>그 사람 마주침</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 4 }}>
        <Odo n={n} t={t} at={T[at]} />
        <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 30, color: MINT_D, marginBottom: 8 }}>번째</span>
      </div>
    </div>
  );
};

// 16번 — 두 폰을 잇는 표시(같은 화면)
const SameScreen: React.FC<{ t: number }> = ({ t }) => {
  const a = 33.2;
  if (t < a || t >= 35.1) return null;
  const p = ramp(t, a, 0.5, EXPO);
  const his = { x: 497, y: 1020 }, mine = { x: 448, y: 1700 }, chip = { x: 640, y: 1330 };
  const len = (q: { x: number; y: number }) => Math.hypot(q.x - chip.x, q.y - chip.y);
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, zIndex: 31 }}>
        {[his, mine].map((q, k) => <line key={k} x1={chip.x} y1={chip.y} x2={q.x} y2={q.y} stroke="#fff" strokeWidth={4} strokeDasharray={len(q)} strokeDashoffset={len(q) * (1 - p)} strokeLinecap="round" />)}
        {[his, mine].map((q, k) => <circle key={k} cx={q.x} cy={q.y} r={14 * ramp(t, a + 0.35, 0.2)} fill={MINT} stroke="#fff" strokeWidth={4} />)}
      </svg>
      <div style={{ ...abs(chip.x - 10, chip.y - 46, 400), zIndex: 32, transform: `scale(${pop(t, a + 0.1, 0.4)})`, transformOrigin: 'left center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#fff', color: INK, borderRadius: 40, padding: '14px 24px', fontFamily: KO, fontWeight: 800, fontSize: 36, boxShadow: '0 12px 30px #0005' }}>
          <span style={{ color: MINT_D }}>★</span> 같은 코스
        </div>
      </div>
    </>
  );
};

// 끝 — 제주 위 코스 선 · 핀 열다섯 · 「알고 보니, 같은 코스.」 → 브랜드
const End: React.FC<{ t: number }> = ({ t }) => {
  const a = T[16];
  if (t < a) return null;
  const draw = ramp(t, a + 0.1, 0.85, EXPO);
  const cx = 540, cy = 760, rx = 400, ry = 230, tilt = -12 * Math.PI / 180;
  const pins = Array.from({ length: 15 }, (_, k) => {
    const g = (200 - k * 24) * Math.PI / 180;
    const x = 0.72 * rx * Math.cos(g), y = 0.66 * ry * Math.sin(g);
    return { x: cx + x * Math.cos(tilt) - y * Math.sin(tilt), y: cy + x * Math.sin(tilt) + y * Math.cos(tilt) };
  });
  const path = 'M' + pins.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L');
  const L = pins.slice(1).reduce((s, q, k) => s + Math.hypot(q.x - pins[k].x, q.y - pins[k].y), 0);
  const brand = t >= a + 1.2;
  const bp = ramp(t, a + 1.2, 0.35, EXPO);
  return (
    <AbsoluteFill style={{ zIndex: 50, background: INK }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: 1 - bp * 0.75, transform: `translateY(${-bp * 120}px) scale(${1 - bp * 0.18})`, transformOrigin: '540px 760px' }}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(-12 ${cx} ${cy})`} fill="#1A2623" stroke="#2E4A43" strokeWidth={3} />
        <ellipse cx={cx} cy={cy} rx={46} ry={46} fill="#24413A" />
        <path d={path} fill="none" stroke={MINT} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={L} strokeDashoffset={L * (1 - draw)} />
        {pins.map((q, k) => { const s = pop(t, a + 0.1 + k * 0.055, 0.3); return <g key={k} transform={`translate(${q.x} ${q.y}) scale(${s})`}><circle r={k === 0 || k === 14 ? 22 : 15} fill="#fff" stroke={MINT_D} strokeWidth={6} /></g>; })}
      </svg>
      {!brand && <div style={{ ...abs(0, 1120, 1080), textAlign: 'center', fontFamily: MONO, fontSize: 30, color: '#8fd9c6', opacity: ramp(t, a + 0.3, 0.2) }}>15곳 · 인기 1위 코스 · 12,480명</div>}
      {!brand && <div style={{ ...abs(0, 1220, 1080), textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 104, lineHeight: 1.08, letterSpacing: '-0.05em', color: PAPER, opacity: ramp(t, a + 0.35, 0.25), transform: `translateY(${(1 - ramp(t, a + 0.35, 0.35, EXPO)) * 40}px)` }}>알고 보니,<br /><span style={{ color: '#7DF0D3' }}>같은 코스.</span></div>}
      {brand && (
        <div style={{ ...abs(0, 900, 1080), textAlign: 'center', opacity: bp, transform: `translateY(${(1 - bp) * 50}px)` }}>
          <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 52, color: PAPER, letterSpacing: '-0.03em' }}>모두가 고른 제주 코스 그대로</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 30, marginTop: 50 }}>
            <Img src={staticFile('p12/appicon.png')} style={{ width: 170, height: 170, borderRadius: 40, transform: `scale(${pop(t, a + 1.25, 0.4)})` }} />
            <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 112, color: PAPER, letterSpacing: '-0.05em' }}>모두의코스</span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const P12: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const i = cutAt(t);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo src={staticFile('p12/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      {i < 16 && <>
        <AbsoluteFill style={{ zIndex: 10, background: 'linear-gradient(#000a 0%, #0000 22%)' }} />
        <Head t={t} />
        {t >= 1.6 && <Chip t={t} i={i} />}
        {t >= 1.6 && <Counter t={t} i={i} />}
        <SameScreen t={t} />
        <div style={{ ...abs(0, 1872, 1080), zIndex: 30, textAlign: 'center', fontFamily: KO, fontWeight: 500, fontSize: 22, color: '#ffffffaa' }}>가상 브랜드 · AI로 만든 가상 모델</div>
      </>}
      <End t={t} />
      <div style={{ ...abs(64, 1800, 952, 3), zIndex: 55, background: '#ffffff25' }}><div style={{ height: 3, width: `${Math.min(1, t / 37.64) * 100}%`, background: MINT }} /></div>
      <Audio src={staticFile('p12/sound.wav')} />
      <span style={{ display: 'none', fontFamily: EN }} />
    </AbsoluteFill>
  );
};
