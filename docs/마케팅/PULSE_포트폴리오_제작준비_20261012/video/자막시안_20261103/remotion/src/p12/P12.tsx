// 12번 모두의코스 자막 · 모션그래픽 — 「앱 화면 결」(2026-11-03) + 섞은 판 결(11-03 밤 유호님 「세 편에 넣기」)
//   처음 제목이 크게 떴다가 위 줄로 접힘 → 컷마다 장소 칩(일차 · 장소)
//   A(큰 글자): 「그 사람」 마주친 횟수를 장소 칩 아래 한 자리에 큰 숫자로 — 컷이 바뀌면 그 자리에서 숫자만 바뀐다.
//     남자 뒤로 보내려고 컷마다 rembg 마스크를 땄지만(11-03 밤) 절반이 비거나 튀어(남자가 작거나 카메라가 돌아 들어감) 숫자는 모두 앞에 두고,
//     그 컷 마스크를 합친 자리를 피하게 ../자리찾기.py로 재서 골랐다(해녀의 집 · 우도만 머리를 피해 오른쪽, 바탕이 어두운 컷은 밝은 숫자)
//   B(색 블록 두 방): 두 폰이 같은 화면인 순간 「모두의코스 / 같은 코스」 민트 블록 + 두 폰 화면의 고리, 끝 브랜드는 아래에서 올라오는 민트 판
// 바닥 고정 자막(밈 원본 꼴)은 뺐다. 화면 · 소리는 git 밖 public(p12/picture.mp4 · sound.wav).
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { EN, KO, MONO } from '../lib/fonts';
import { EXPO, pop, ramp } from '../lib/motion';
import { Door, ProbeMeta, probeChars } from '../lib/subject';

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
// 화면은 컷 경계를 round(초 × 24) 프레임에서 자른다(comedy-montage 최종편집.py) — 초로 견주면 경계마다 한 프레임 앞 컷 칩 · 숫자가 남았다(11-03 밤)
const TT = T.map((x) => Math.round(x * FPS) / FPS);
const cutAt = (t: number) => { let i = 0; while (i < 16 && t >= TT[i + 1] - 1e-6) i++; return i; };   // 0 … 16(끝)

// 큰 숫자 자리 — PLACE 차례(컷 2~16)마다. light: 어두운 바탕 위 밝은 숫자, x: 정렬(기본 왼쪽)
// at: 남자가 늦게 드러나는 컷은 숫자도 그 순간에 튄다(「또 그 사람」이 터지는 박) — 셔틀 흐린 팬 · 요트 바닥에서 돌아 들어감 · 억새 손가락 · 식당 폰 화면
type NumAt = { y: number; size: number; x?: 'c' | 'r'; light?: boolean; at?: number };
const isRapid = (i: number) => i >= 9 && i <= 14;   // 컷 10~15 속사포(0.7초씩)
const SLOT: NumAt = { y: 400, size: 240 };
const NUM: (NumAt | null)[] = [
  null,
  { ...SLOT, light: true, at: 2.3 },   // 02 셔틀 — 밤 버스 안
  SLOT,   // 03 수영장
  { ...SLOT, at: 9.1 },   // 04 요트 — 그 앞(8.5~9.1초)은 돌아 들어오는 남자 어깨에 숫자가 얹혔다
  SLOT,   // 05 카페
  { ...SLOT, at: 17.55 },   // 06 억새
  SLOT, { ...SLOT, light: true },   // 07 ATV 뒷모습 · 07 넥게이터를 내림(뒤가 어두운 들판)
  SLOT,   // 08 비양도
  { y: 380, size: 200, x: 'r', light: true },   // 09 해녀의 집 — 왼쪽은 남자 머리, 오른쪽 바다 · 돌담 위
  { y: 380, size: 240, x: 'r' },   // 10 우도 — 왼쪽은 남자 이마, 오른쪽 하늘
  { ...SLOT, light: true }, SLOT, SLOT,   // 11 감귤밭 · 12 성산 · 13 바다 카페
  { y: 380, size: 170, light: true },   // 14 야시장 — 더 크면 남자 머리에 닿는다
  { ...SLOT, light: true, at: 31.85 },   // 15 흑돼지 식당 — 여행자 폰 화면 다음, 건너편 테이블에 그가 보일 때
];
// 그 횟수가 처음 뜬 시각(7 · 8번 컷은 같은 횟수라 다시 튀지 않는다)
const firstAt = (i: number) => NUM[i]?.at ?? TT[PLACE.findIndex((p) => p[2] === PLACE[i][2])];
const numBox = (t: number, i: number): React.CSSProperties => {
  const n = NUM[i]!;
  const a = firstAt(i);
  const p = pop(t, a, isRapid(i) ? 0.28 : 0.42);
  return { ...abs(56, n.y, 968), textAlign: n.x === 'c' ? 'center' : n.x === 'r' ? 'right' : 'left', fontFamily: KO, fontWeight: 800, fontSize: n.size, letterSpacing: '-0.06em', lineHeight: 1, whiteSpace: 'nowrap', opacity: Math.min(1, p), transform: `translateY(${(1 - p) * 90}px)` };
};
const digits = (i: number) => String(PLACE[i][2]).padStart(2, '0');
// 「번째」 알약 — 숫자와 같은 줄, 민트 바탕이라 어디서나 읽힌다
const Pill: React.FC<{ show: boolean }> = ({ show }) => (
  <span style={{ display: 'inline-block', verticalAlign: 'baseline', marginLeft: 18, fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: show ? '#fff' : 'transparent', background: show ? MINT : 'transparent', borderRadius: 40, padding: '10px 20px 12px' }}>번째</span>
);
const BigNum: React.FC<{ t: number; i: number }> = ({ t, i }) => {
  if (!NUM[i]) return null;
  const light = NUM[i]!.light;
  return (
    <div style={{ ...numBox(t, i), zIndex: 6, color: light ? PAPER : INK, textShadow: light ? '0 4px 28px #10141470' : undefined }}>{digits(i)}<Pill show /></div>
  );
};

const Pin: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}><path d="M12 22s7-7.2 7-12.2A7 7 0 0 0 5 9.8C5 14.8 12 22 12 22Z" fill={color} /><circle cx="12" cy="9.8" r="2.8" fill="#fff" /></svg>
);

const Head: React.FC<{ t: number }> = ({ t }) => {
  // 0 ~ 1.5초 세 줄로 크게 → 1.45 ~ 1.87초 작아지며 위로 빠지고, 그 자리에 한 줄 머리글이 남는다
  // (처음엔 세 줄을 그대로 줄여 접었더니 셋째 줄이 장소 칩과 겹쳤다 — 11-03 자체 검수)
  const d = ramp(t, 1.45, 0.42, EXPO);
  return (
    <>
      <div style={{ ...abs(64, 540 - d * 330, 952), zIndex: 30, transformOrigin: 'left top', transform: `scale(${1 - d * 0.55})`, opacity: 1 - ramp(t, 1.6, 0.25) }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 118, lineHeight: 1.04, letterSpacing: '-0.05em', color: PAPER, textShadow: '0 4px 30px #0007', whiteSpace: 'pre-line', opacity: Math.min(1, pop(t, 0.0, 0.35)) }}>
          {'제주 2박 3일,\n가는 데마다\n'}<span style={{ color: '#7DF0D3' }}>또 그 사람</span>
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
  const p = same ? 1 : ramp(t, TT[i], 0.24, EXPO);
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

// 16번 — 두 폰이 같은 화면인 순간: 두 폰 사이 탁자 위에 「모두의코스 / 같은 코스」 블록 한 방(11번 「첨벙댕 / 구명조끼」와 같은 결) + 두 폰 화면에 고리
const SameScreen: React.FC<{ t: number }> = ({ t }) => {
  const a = 33.2;
  if (t < a || t >= TT[16]) return null;
  const p = ramp(t, a, 0.16, EXPO);
  const punch = 1 + (1 - ramp(t, a, 0.14)) * 0.08;
  const phones = [{ x: 497, y: 1020 }, { x: 448, y: 1700 }];
  return (
    <>
      {phones.map((q, k) => {
        const r = ramp(t, a + 0.12 + k * 0.08, 0.5, EXPO);
        return <div key={k} style={{ ...abs(q.x - 80, q.y - 80, 160, 160), zIndex: 31, borderRadius: '50%', border: `6px solid ${MINT}`, boxShadow: `0 0 0 4px #fff8`, transform: `scale(${0.4 + 0.6 * r})`, opacity: Math.min(1, r * 2) }} />;
      })}
      <div style={{ ...abs(0, 1176, 1080), zIndex: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transform: `scale(${punch})`, transformOrigin: 'center center' }}>
        <div style={{ fontFamily: KO, fontWeight: 750, fontSize: 48, letterSpacing: '-0.03em', color: PAPER, background: INK, padding: '8px 22px 10px', borderRadius: 10, clipPath: `inset(0 ${(1 - p) * 100}% 0 0 round 10px)` }}>모두의코스</div>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 168, letterSpacing: '-0.06em', lineHeight: 0.98, color: INK, background: MINT, padding: '6px 26px 14px', borderRadius: 16, clipPath: `inset(0 ${(1 - p) * 100}% 0 0 round 16px)` }}>같은 코스</div>
      </div>
    </>
  );
};

// 끝 — 제주 위 코스 선 · 핀 열다섯 · 「알고 보니, 같은 코스」 → 아래에서 민트 판이 올라와 브랜드(11번 끝 레몬 판과 같은 결, 글자는 한 번에)
const End: React.FC<{ t: number }> = ({ t }) => {
  const a = TT[16];
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
  const b0 = a + 1.2;
  const brand = t >= b0;
  const bp = ramp(t, b0, 0.22, EXPO);
  const q = pop(t, b0 + 0.06, 0.42);
  return (
    <AbsoluteFill style={{ zIndex: 50, background: INK }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: 1 - bp * 0.35, transform: `translateY(${-bp * 160}px) scale(${1 - bp * 0.12})`, transformOrigin: '540px 760px' }}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(-12 ${cx} ${cy})`} fill="#1A2623" stroke="#2E4A43" strokeWidth={3} />
        <ellipse cx={cx} cy={cy} rx={46} ry={46} fill="#24413A" />
        <path d={path} fill="none" stroke={MINT} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={L} strokeDashoffset={L * (1 - draw)} />
        {pins.map((q2, k) => { const s = pop(t, a + 0.1 + k * 0.055, 0.3); return <g key={k} transform={`translate(${q2.x} ${q2.y}) scale(${s})`}><circle r={k === 0 || k === 14 ? 22 : 15} fill="#fff" stroke={MINT_D} strokeWidth={6} /></g>; })}
      </svg>
      {!brand && <div style={{ ...abs(0, 1120, 1080), textAlign: 'center', fontFamily: MONO, fontSize: 30, color: '#8fd9c6', opacity: ramp(t, a + 0.3, 0.2) }}>15곳 · 인기 1위 코스 · 12,480명</div>}
      {!brand && <div style={{ ...abs(0, 1220, 1080), textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 104, lineHeight: 1.08, letterSpacing: '-0.05em', color: PAPER, opacity: ramp(t, a + 0.35, 0.25), transform: `translateY(${(1 - ramp(t, a + 0.35, 0.35, EXPO)) * 40}px)` }}>알고 보니,<br /><span style={{ color: '#7DF0D3' }}>같은 코스</span></div>}
      {brand && (
        <>
          <div style={{ ...abs(0, 1920 - bp * 640, 1080, 660), background: MINT }} />
          <div style={{ ...abs(0, 1392, 1080), textAlign: 'center', fontFamily: KO, fontWeight: 700, fontSize: 46, color: INK, letterSpacing: '-0.03em' }}>모두가 고른 제주 코스 그대로</div>
          <div style={{ ...abs(0, 1480, 1080), display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 30, transform: `scale(${0.94 + 0.06 * Math.min(1, q)})` }}>
            {/* 민트 판 위라 아이콘 네모가 사라져 흰 핀만 남았다 — 흰 테로 앱 아이콘을 살린다 */}
            <Img src={staticFile('p12/appicon.png')} style={{ width: 170, height: 170, borderRadius: 44, border: '6px solid #fff', boxShadow: '0 12px 30px #0003' }} />
            <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 124, color: INK, letterSpacing: '-0.06em' }}>모두의코스</span>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

// 가림 검사용(../가림검사.py --편 p12): 큰 숫자만 글자마다 다른 순색으로 검은 바탕에 — 낱말 번호는 PLACE 차례 − 1
const Probe: React.FC<{ t: number }> = ({ t }) => {
  const i = cutAt(t);
  if (i < 1 || i >= 16 || !NUM[i]) return null;
  return (
    <>
      <ProbeMeta i={i - 1} behind={false} light={NUM[i]!.light} />
      <div style={numBox(t, i)}>{probeChars(digits(i))}<Pill show={false} /></div>
    </>
  );
};

export const P12: React.FC<{ probe?: boolean }> = ({ probe }) => {
  const t = useCurrentFrame() / FPS;
  const i = cutAt(t);
  if (probe) return <AbsoluteFill style={{ background: '#000' }}><Probe t={t} /></AbsoluteFill>;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo src={staticFile('p12/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      {i < 16 && <>
        <AbsoluteFill style={{ zIndex: 10, background: 'linear-gradient(#000a 0%, #0000 22%)' }} />
        {t >= TT[1] && <BigNum t={t} i={i} />}
        <Head t={t} />
        {t >= 1.6 && <Chip t={t} i={i} />}
        <SameScreen t={t} />
        <div style={{ ...abs(0, 1872, 1080), zIndex: 30, textAlign: 'center', fontFamily: KO, fontWeight: 500, fontSize: 22, color: '#ffffffaa' }}>가상 브랜드 · AI로 만든 가상 모델</div>
      </>}
      <End t={t} />
      <Door t={t} at={TT[16]} color={INK} />
      {!(t >= TT[16] + 1.2) && <div style={{ ...abs(64, 1800, 952, 3), zIndex: 55, background: '#ffffff25' }}><div style={{ height: 3, width: `${Math.min(1, t / 37.64) * 100}%`, background: MINT }} /></div>}
      {t >= TT[16] + 1.2 && <div style={{ ...abs(0, 1872, 1080), zIndex: 56, textAlign: 'center', fontFamily: KO, fontWeight: 500, fontSize: 22, color: '#101414aa' }}>가상 브랜드 · AI로 만든 가상 모델</div>}
      <Audio src={staticFile('p12/sound.wav')} />
      <span style={{ display: 'none', fontFamily: EN }} />
    </AbsoluteFill>
  );
};
