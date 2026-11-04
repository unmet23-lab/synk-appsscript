// 12번 모두의코스 자막 · 모션그래픽 — 「앱 화면 결」(2026-11-03) + 섞은 판 결(11-03 밤 유호님 「세 편에 넣기」)
//   처음 제목이 크게 떴다가 위 줄로 접힘 → 컷마다 장소 칩(일차 · 장소)
//   A(큰 글자): 「그 사람」 마주친 횟수를 장소 칩 아래 한 자리에 큰 숫자로 — 컷이 바뀌면 그 자리에서 숫자만 바뀐다.
//     남자 뒤로 보내려고 컷마다 rembg 마스크를 땄지만(11-03 밤) 절반이 비거나 튀어(남자가 작거나 카메라가 돌아 들어감) 숫자는 모두 앞에 두고,
//     그 컷 마스크를 합친 자리를 피하게 ../자리찾기.py로 재서 골랐다(해녀의 집 · 우도만 머리를 피해 오른쪽, 바탕이 어두운 컷은 밝은 숫자)
//   B(색 블록 한 장): 두 폰이 같은 화면인 순간 「모두의코스 / 같은 코스」 민트 블록 + 두 폰 테두리, 끝은 그 블록이 두 폰 사이 띠로 자라 브랜드까지 담고 그 사람은 멈춘 채 남는다(11-04)
// 바닥 고정 자막(밈 원본 꼴)은 뺐다. 화면 · 소리는 git 밖 public(p12/picture.mp4 · sound.wav).
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { EN, KO, MONO } from '../lib/fonts';
import { EXPO, pop, ramp } from '../lib/motion';
import { ProbeMeta, probeChars } from '../lib/subject';
import phones from './폰자리.json';

const FPS = 24;
export const P12_FRAMES = Math.round(38 * FPS);   // 끝 포스터가 다 선 뒤 1.6초 멈춘다(읽을 시간 — 11-04에 37.64에서 늘림)
const T = [0, 1.87, 3.87, 7.2, 11.73, 15.1, 18.3, 21.77, 22.87, 27.07, 27.77, 28.47, 29.17, 29.87, 30.57, 31.27, 35.14, 38];
const MINT = '#20B296', INK = '#101414', PAPER = '#F7F6F1';
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
  { ...SLOT, light: true }, { ...SLOT, light: true }, SLOT,   // 11 감귤밭 · 12 성산(올리브색 풀밭 위 짙은 글자가 약했다, 11-04 Fable) · 13 바다 카페
  { y: 380, size: 170, light: true },   // 14 야시장 — 더 크면 남자 머리에 닿는다
  { ...SLOT, light: true, at: 31.85 },   // 15 흑돼지 식당 — 여행자 폰 화면 다음, 건너편 테이블에 그가 보일 때
];
// 그 횟수가 처음 뜬 시각(7 · 8번 컷은 같은 횟수라 다시 튀지 않는다)
const firstAt = (i: number) => NUM[i]?.at ?? TT[PLACE.findIndex((p) => p[2] === PLACE[i][2])];
// 폭로 — 폰 디지털 줌으로 그 사람이 폰을 든 판이 뜨는 프레임에 한 방(소리도 여기, comedy-montage 최종편집.py ZOOM). 숫자 · 진행 선은 이 프레임에 사라진다 —
// 남아 있으면 두 폰보다 글이 먼저 보인다(11-04 GPT 검수). 먼저 그 사람과 두 폰을 보고 「같은 코스」는 0.5초 뒤(BLOCK_AT, 최종편집.py와 같은 값)
const ZOOM = (Math.round(T[15] * FPS) + phones.from) / FPS;
const BLOCK_AT = ZOOM + 0.5;
const BRAND_AT = TT[16] + 0.95;   // 끝 포스터가 닫히는 순간(딩) — 최종편집.py와 같은 값
const numBox = (t: number, i: number): React.CSSProperties => {
  const n = NUM[i]!;
  const a = firstAt(i);
  const p = pop(t, a, isRapid(i) ? 0.28 : 0.42);
  return { ...abs(56, n.y, 968), display: 'flex', flexDirection: 'column', alignItems: n.x === 'r' ? 'flex-end' : 'flex-start', fontFamily: KO, fontWeight: 800, fontSize: n.size, letterSpacing: '-0.06em', lineHeight: 1, whiteSpace: 'nowrap', opacity: Math.min(1, p), transform: `translateY(${(1 - p) * 90}px)` };
};
const digits = (i: number) => String(PLACE[i][2]).padStart(2, '0');
// 「번째」 알약 — 민트 바탕이라 어디서나 읽힌다. 숫자 옆에 두니 클로즈업 컷에서 얼굴에 얹혀(11-04 감귤밭 11) 숫자 아래로
const Pill: React.FC<{ size: number }> = ({ size }) => (
  <span style={{ marginTop: -0.06 * size, fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: '#fff', background: MINT, borderRadius: 40, padding: '10px 20px 12px' }}>번째</span>
);
const BigNum: React.FC<{ t: number; i: number }> = ({ t, i }) => {
  if (!NUM[i] || t >= ZOOM) return null;
  const light = NUM[i]!.light;
  return (
    <div style={{ ...numBox(t, i), zIndex: 6 }}><span style={{ color: light ? PAPER : INK, textShadow: light ? '0 2px 22px #101414b0' : undefined }}>{digits(i)}</span><Pill size={NUM[i]!.size} /></div>
  );
};

const Pin: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}><path d="M12 22s7-7.2 7-12.2A7 7 0 0 0 5 9.8C5 14.8 12 22 12 22Z" fill={color} /><circle cx="12" cy="9.8" r="2.8" fill="#fff" /></svg>
);

const Head: React.FC<{ t: number }> = ({ t }) => {
  // 0 ~ 1.4초 세 줄로 크게 → 제자리에서 사라지고, 위에 한 줄 머리글이 남는다
  // 11-04: 제목(y 540)이 남자 얼굴 · 눈을 덮었다 → 가슴 아래로 내리고 그 자리만 어둡게 깐다. 위로 접으면 또 얼굴을 지나가니 접지 않는다
  const d = ramp(t, 1.4, 0.35, EXPO);
  const out = 1 - ramp(t, BRAND_AT, 0.25);   // 끝 포스터는 그 사람 사진 + 민트 판 두 칸만(글자 층이 셋이면 어수선하다, 크몽 세션 Fable 재검)
  return (
    <>
      <AbsoluteFill style={{ zIndex: 11, background: 'linear-gradient(#0000 42%, #000d 66%, #000d 100%)', opacity: 1 - d }} />{/* 흰 티셔츠 위에서 약했다(11-04 Fable) */}
      <div style={{ ...abs(64, 1190, 952), zIndex: 30, transformOrigin: 'left bottom', transform: `scale(${1 - d * 0.08})`, opacity: 1 - d }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 118, lineHeight: 1.04, letterSpacing: '-0.05em', color: PAPER, textShadow: '0 4px 30px #0007', whiteSpace: 'pre-line', opacity: Math.min(1, pop(t, 0.0, 0.35)) }}>
          {'제주 2박 3일,\n가는 데마다\n'}<span style={{ color: '#7DF0D3' }}>또 그 사람</span>
        </div>
      </div>
      <div style={{ ...abs(64, 200, 952), zIndex: 30, fontFamily: KO, fontWeight: 700, fontSize: 38, letterSpacing: '-0.03em', color: PAPER, textShadow: '0 2px 14px #000a', opacity: ramp(t, TT[1], 0.2) * out, transform: `translateY(${(1 - ramp(t, TT[1], 0.3, EXPO)) * 14}px)` }}>
        제주 2박 3일, 가는 데마다 <span style={{ color: '#7DF0D3' }}>또 그 사람</span>
      </div>
      <div style={{ ...abs(64, 262, 952, 2), zIndex: 29, background: PAPER, opacity: 0.5 * d * out }} />
    </>
  );
};

const Chip: React.FC<{ t: number; i: number }> = ({ t, i }) => {
  const [day, name] = PLACE[i];
  const same = i > 0 && PLACE[i - 1][1] === name;
  const p = same ? 1 : ramp(t, TT[i], 0.24, EXPO);
  return (
    <div style={{ ...abs(64, 300, 700), zIndex: 30, display: 'flex', alignItems: 'center', gap: 14, transform: `translateX(${(1 - p) * -60}px)`, opacity: p * (1 - ramp(t, TT[16], 0.2)) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: MINT, color: '#fff', borderRadius: 40, padding: '12px 24px 12px 16px', boxShadow: '0 10px 30px #0003' }}>
        <Pin size={34} color="#fff" />
        <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 38, letterSpacing: '-0.03em' }}>{name}</span>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 26, color: PAPER, textShadow: '0 1px 10px #000e' }}>{day}</span>
    </div>
  );
};

// 두 폰 테두리는 뺐다 — 고리는 화면을 덮었고, 얇게 해도 화면 녹화 강조 상자처럼 보여 이 편에서 가장 싸 보였다(11-04 GPT · Fable). 두 폰은 같은 그림 자체로 보인다
// 16번 → 끝: 민트 블록 한 장 — 두 폰 사이에 「모두의코스 / 같은 코스」로 닦여 나왔다가(11번 「첨벙댕 / 구명조끼」와 같은 결), 끝에서 가로 띠로 자라고 화면 아래 끝까지 내려가 포스터로 닫힌다.
// 예전 끝은 그 사람을 끊고 검은 화면 + 추상 지도로 닫혀 「또 그 사람」의 여운이 없었다(크몽 세션 Fable 맹검 · 11-04). 띠를 두 폰 사이에 멈춰 앞 폰을 끝까지 남긴 판은 로고가 폰 머리글과 두 겹이고
// 떠 있는 스티커처럼 덜 닫혔다(Fable 재검) → 두 폰은 멈춤 첫 1초(띠 아래)까지 보이고, 딩에서 판이 아래를 다 덮어 그 사람 + 브랜드로 끝난다
const BAND = { top: 1196, mid: 1520 };
const Block: React.FC<{ t: number }> = ({ t }) => {
  if (t < BLOCK_AT) return null;
  const a = TT[16], b0 = BRAND_AT;
  const p = ramp(t, BLOCK_AT, 0.16, EXPO);
  const punch = 1 + (1 - ramp(t, BLOCK_AT, 0.14)) * 0.08;
  const g = t >= a ? ramp(t, a, 0.34, EXPO) : 0;
  const h = t >= b0 ? ramp(t, b0, 0.3, EXPO) : 0;
  const mix = (x: number, y: number) => x + (y - x) * g;
  const [l, r0, top, bottom] = [mix(262, 0), mix(818, 1080), mix(1258, BAND.top), mix(1420, BAND.mid) + (1920 - BAND.mid) * h];
  const right = l + (r0 - l) * p;
  // 앱 지도와 같은 섬 · 코스 — 그 폰 화면을 그대로 떼어 온 꼴이라 눈이 잇는다(물결선 + 흰 원은 템플릿 같았다, GPT 검수). 핀은 소리 틱과 같은 시각(0.1초부터 0.055초 간격)
  const draw = ramp(t, a + 0.1, 14 * 0.055, (x) => x);
  const cx = 104, cy = 56, rx = 96, ry = 50, tilt = -12 * Math.PI / 180;
  const pins = Array.from({ length: 15 }, (_, k) => {
    const c = (200 - k * 24) * Math.PI / 180;
    const x = 0.76 * rx * Math.cos(c), y = 0.66 * ry * Math.sin(c);
    return { x: cx + x * Math.cos(tilt) - y * Math.sin(tilt), y: cy + x * Math.sin(tilt) + y * Math.cos(tilt) };
  });
  const path = 'M' + pins.map((n) => `${n.x.toFixed(1)} ${n.y.toFixed(1)}`).join(' L');
  const q = pop(t, b0 + 0.06, 0.42);
  return (
    <>
      <div style={{ ...abs(0, 1176, 1080), zIndex: 32, display: 'flex', justifyContent: 'center', opacity: 1 - ramp(t, a, 0.12), transform: `scale(${punch})`, transformOrigin: '540px 160px' }}>
        <div style={{ fontFamily: KO, fontWeight: 750, fontSize: 44, letterSpacing: '-0.03em', color: PAPER, background: INK, padding: '8px 22px 10px', borderRadius: 10, clipPath: `inset(0 ${(1 - p) * 100}% 0 0 round 10px)` }}>모두의코스</div>
      </div>
      <AbsoluteFill style={{ zIndex: 33, background: MINT, clipPath: `inset(${top}px ${1080 - right}px ${1920 - bottom}px ${l}px round ${16 * (1 - g)}px)`, transform: `scale(${punch})`, transformOrigin: '540px 1339px' }}>
        {/* 끝에서는 브랜드가 가장 크게 — 「같은 코스」는 줄여 위로(둘 다 무거우면 시선이 갈린다, GPT 검수) */}
        <div style={{ ...abs(0, mix(1262, 1236), 1080), textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 148, letterSpacing: '-0.06em', lineHeight: 0.98, color: INK, transform: `scale(${mix(1, 124 / 148)})`, transformOrigin: '540px 0' }}>같은 코스</div>
        {t >= a && (
          <div style={{ ...abs(0, 1380, 1080), display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22 }}>
            <svg width={208} height={112} style={{ opacity: ramp(t, a + 0.05, 0.2) }}>
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(-12 ${cx} ${cy})`} fill="#EAF8F3" />
              <path d={path} fill="none" stroke="#12846E" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} />
              {pins.map((n, k) => { const s2 = pop(t, a + 0.1 + k * 0.055, 0.3); return <g key={k} transform={`translate(${n.x} ${n.y}) scale(${s2})`}><circle r={k === 0 || k === 14 ? 8 : 5.5} fill="#fff" stroke="#12846E" strokeWidth={3} /></g>; })}
            </svg>
            <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 46, letterSpacing: '-0.03em', color: INK, opacity: ramp(t, a + 0.35, 0.25) }}>12,480명이 이 코스로</span>
          </div>
        )}
        {t >= b0 && (
          <div style={{ ...abs(0, 1590, 1080), display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28, opacity: Math.min(1, q), transform: `translateY(${(1 - Math.min(1, q)) * 40}px) scale(${0.94 + 0.06 * Math.min(1, q)})` }}>
            {/* 민트 판 위라 아이콘 네모가 사라져 흰 핀만 남았다 — 흰 테로 앱 아이콘을 살린다 */}
            <Img src={staticFile('p12/appicon.png')} style={{ width: 156, height: 156, borderRadius: 42, border: '6px solid #fff', boxShadow: '0 12px 30px #0003' }} />
            <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 138, color: INK, letterSpacing: '-0.06em' }}>모두의코스</span>
          </div>
        )}
      </AbsoluteFill>
    </>
  );
};

// 가림 검사용(../가림검사.py --편 p12): 큰 숫자만 글자마다 다른 순색으로 검은 바탕에 — 낱말 번호는 PLACE 차례 − 1
const Probe: React.FC<{ t: number }> = ({ t }) => {
  const i = cutAt(t);
  if (i < 1 || i >= 16 || !NUM[i] || t >= ZOOM) return null;
  return (
    <>
      <ProbeMeta i={i - 1} behind={false} light={NUM[i]!.light} />
      <div style={numBox(t, i)}><span>{probeChars(digits(i))}</span></div>
    </>
  );
};

// 끝 CG 시안(11-04) — 납작한 민트 판 대신 장면 안 CG(comedy-montage 끝CG.py · 끝CG합성.py가 판에 구움). 여기는 자막만: 간판 아래 숫자 한 줄
const CgProof: React.FC<{ t: number }> = ({ t }) => {
  const at = BRAND_AT + 0.28;
  if (t < at) return null;
  const q = Math.min(1, pop(t, at, 0.36));
  return (
    <div style={{ ...abs(0, 322, 1080), zIndex: 30, display: 'flex', justifyContent: 'center', opacity: q, transform: `translateY(${(1 - q) * 18}px)` }}>
      <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 42, letterSpacing: '-0.03em', color: '#fff', background: MINT, borderRadius: 40, padding: '10px 28px 12px', boxShadow: '0 10px 30px #0004' }}>12,480명이 이 코스로</span>
    </div>
  );
};

export const P12: React.FC<{ probe?: boolean; cg?: boolean }> = ({ probe, cg }) => {
  const t = useCurrentFrame() / FPS;
  const i = cutAt(t);
  if (probe) return <AbsoluteFill style={{ background: '#000' }}><Probe t={t} /></AbsoluteFill>;
  // 끝에서는 멈춘 그림으로 천천히 들어간다(판이 올라와도 그 사람이 살아 있게) — 두 폰 테두리도 그림에 붙어 함께
  const push = 1 + 0.03 * ramp(t, TT[16], P12_FRAMES / FPS - TT[16]);
  const legalRight = t >= ZOOM;   // 폭로부터는 앞 폰 위를 가로지르지 않게 오른쪽 어두운 바닥으로
  const onPanel = !cg && t >= BRAND_AT + 0.1;   // 포스터가 닫히면 판 안 어두운 글자로
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '500px 680px' }}>
        <OffthreadVideo src={staticFile(cg ? 'p12/picture_cg.mp4' : 'p12/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ zIndex: 10, background: 'linear-gradient(#000a 0%, #0000 22%)', opacity: 1 - ramp(t, BRAND_AT, 0.25) }} />
      {i < 16 && t >= TT[1] && <BigNum t={t} i={i} />}
      <Head t={t} />
      {t >= TT[1] && <Chip t={t} i={Math.min(i, 15)} />}{/* 첫 컷에 칩을 띄우면 0.2초 깜빡이고 끝나 못 읽었다(11-04 Fable) — 머리 줄 · 칩은 둘째 컷부터 */}
      {cg ? <CgProof t={t} /> : <Block t={t} />}
      {t < ZOOM && <div style={{ ...abs(64, 1800, 952, 3), zIndex: 55, background: '#ffffff25' }}><div style={{ height: 3, width: `${Math.min(1, t / 38) * 100}%`, background: MINT }} /></div>}
      <div style={{ ...abs(0, 1872, legalRight ? 1036 : 1080), zIndex: 56, textAlign: legalRight ? 'right' : 'center', fontFamily: KO, fontWeight: 500, fontSize: 24, color: onPanel ? '#14221F' : '#ffffffeb' }}><span style={{ background: onPanel ? undefined : '#0E132073', padding: '4px 14px 5px', borderRadius: 8 }}>가상 브랜드 · AI로 만든 가상 모델</span></div>
      <Audio src={staticFile('p12/sound.wav')} />
      <span style={{ display: 'none', fontFamily: EN }} />
    </AbsoluteFill>
  );
};
