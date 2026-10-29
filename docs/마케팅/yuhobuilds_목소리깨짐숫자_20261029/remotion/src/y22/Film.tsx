// yuhobuilds Y22(10-29) 「AI 목소리가 「Your turn!」에서 깨질 때 — 귀 대신 숫자로」. 기획 · 칸표는 ../../../기획.md.
// 오마주 원본 StXGGNlNLOk(AI 시스메이커 「클로드 코드 토큰 49배 줄인 무료 도구」, 같은분야)의 뼈대를 1:1로 —
// 0.3초 큰 숫자 훅 → 3.7초 숫자가 바뀜 → 4.8초 밝은 공개 판 → 물음 → 원리 확대(돋보기) → 두 물결 → 한 번 돌리기 → 다섯에 하나꼴 → 목소리 B → 다시 듣기 → 두 줄 → 가져갈 것 → 끝 쪽지.
// 원본에서 가져온 꼴: 가운데 위 머리글 · 움직이는 그림 설명 · 아래 낱말 자막(지금 낱말에 칠). 무대는 지난 두 편(Y19 v2 밝은 종이 · Y9 v3 검정+노랑)과
// 다르게 남색 밤 무대 + 청록(깨끗) · 산호빨강(깨짐).
// 화면의 소리 · 파형 · 확대 물결 · 조각 칸은 전부 실제 값이다 — LAB 이름 편 해설 줄의 깨진 판 · 다시 뽑은 판(../../자료/파형.py가 뽑음).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO, EN } from '../lib/fonts';
import { clamp, prog as ease } from '../lib/motion';
import { SOUND } from './data.generated';
import { at, B, CLIP, lineEnd, ORDER, show, TOTAL, VO, words, type Spoken } from './time';

const MASTER = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 잘라 낸다 — 모든 소리에 같은 값을 곱한다(현장 노트)
const NIGHT = '#0B1026';
const PANEL = '#141B3A';
const EDGE = '#2A3563';
const TEXT = '#F2F5FF';
const MUTED = '#8C96C0';
const CLEAN = '#3EE6C4';
const BAD = '#FF5A6E';

const X0 = 72; // 글 안전 영역 x 65~920(올리기 전 검사 ⑤)
const W = 920 - X0;
const CX = X0 + W / 2;
const F = (s: number) => Math.round(s * 30);

// ───────────── 공용 ─────────────
/** 가운데 위 머리글(원본 「✳ 클로드 코드 토큰」 자리) — 작은 파형 표시 + 글. */
const Header: React.FC<{ text: React.ReactNode; color?: string }> = ({ text, color = TEXT }) => (
  <div style={{ position: 'absolute', left: X0, width: W, top: 274, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, fontFamily: KO, fontWeight: 800, fontSize: 58, letterSpacing: '-0.03em', color }}>
    <svg width="54" height="40" viewBox="0 0 54 40">
      {[10, 26, 38, 18, 30, 12].map((h, i) => (
        <rect key={i} x={i * 9 + 1} y={20 - h / 2} width="5" height={h} rx="2.5" fill={i === 2 || i === 3 ? BAD : CLEAN} />
      ))}
    </svg>
    <span>{text}</span>
  </div>
);

/** 장면 하나: a에 들어와(원본처럼 바로 넘김) b에 사라진다. drift는 아주 느린 밀림(올리기 전 검사 ② · ⑬). */
const Scene: React.FC<{ a: number; b: number; drift?: number; zoom?: number; children: React.ReactNode }> = ({ a, b, drift = 0.1, zoom = 0.00025, children }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b) return null;
  const k = f - a;
  return <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-drift * k}px) scale(${1 + zoom * k})`, transformOrigin: '50% 45%' }}>{children}</div>;
};

/** 실제 파형(봉우리 120칸). p는 재생 위치 0~1, bad는 깨진 칸 구간(초). */
const Wave: React.FC<{ kind: 'broken' | 'clean'; w: number; h: number; p: number; lit?: number }> = ({ kind, w, h, p, lit = 1 }) => {
  const d = SOUND[kind];
  const n = d.wave.length;
  const bw = w / n;
  const badT = kind === 'broken' ? d.frames.filter((x) => x[1] > 0.35 && x[0] < d.clipDur).map((x) => x[0]) : [];
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {d.wave.map((v, i) => {
        const t = ((i + 0.5) / n) * d.clipDur;
        const isBad = badT.some((b) => Math.abs(b - t) < 0.02);
        const played = (i + 0.5) / n <= p;
        const bh = Math.max(4, v * h * 0.92);
        const base = kind === 'broken' ? (isBad ? BAD : '#C9CFEA') : CLEAN;
        const c = played ? base : '#3A4472';
        return <rect key={i} x={i * bw + bw * 0.18} y={(h - bh) / 2} width={bw * 0.64} height={bh} rx={bw * 0.32} fill={c} opacity={played ? 1 : 0.55 + 0.45 * (1 - lit)} />;
      })}
    </svg>
  );
};

const playP = (f: number, start: number, kind: 'broken' | 'clean') => interpolate(f, [start, start + SOUND[kind].clipDur * 30], [0, 1], clamp);

// ───────────── 장면들 ─────────────
/** 1 훅(0~4.8초): 실제 「Your turn!」 파형 + 깨짐 20.8% → 3.7초에 다시 뽑은 판 0.0%. */
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const flipped = f >= B.flip;
  const kind = flipped ? 'clean' : 'broken';
  const p = flipped ? playP(f, CLIP.clean1, 'clean') : playP(f, CLIP.broken1, 'broken');
  const slam = ease(f, B.hook, 6);
  const flip = ease(f, B.flip, 7);
  const numColor = flipped ? CLEAN : BAD;
  const crack = !flipped && f >= F(0.72) && f < F(0.84) ? (f % 2 === 0 ? 1 : -1) : 0;
  return (
    <>
      <div style={{ position: 'absolute', left: X0, width: W, top: 400, padding: '26px 30px 30px', boxSizing: 'border-box', borderRadius: 30, background: PANEL, boxShadow: `inset 0 0 0 2px ${flipped ? CLEAN : EDGE}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: KO, fontWeight: 700, fontSize: 32, color: MUTED }}>
          <span>AI 영어 해설 · 실제 소리</span>
          <span style={{ padding: '4px 16px 7px', borderRadius: 999, background: flipped ? CLEAN : '#2B3462', color: flipped ? NIGHT : TEXT }}>{flipped ? '목소리 B' : '목소리 A'}</span>
        </div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 64, color: TEXT, margin: '14px 0 10px', letterSpacing: '-0.02em' }}>
          “Your turn! <span style={{ color: MUTED, fontSize: 40 }}>Comment your name…”</span>
        </div>
        <Wave kind={kind} w={W - 60} h={170} p={p} lit={slam} />
      </div>
      <div style={{ position: 'absolute', left: X0, width: W, top: 790, textAlign: 'center', fontFamily: KO }}>
        <div style={{ fontWeight: 800, fontSize: 52, color: MUTED, opacity: slam }}>깨짐</div>
        <div style={{ position: 'relative', height: 250, overflow: 'hidden' }}>
          {[false, true].map((isNew) => {
            const shown = isNew ? flip : 1 - flip;
            if (!isNew && flipped && flip >= 1) return null;
            if (isNew && !flipped) return null;
            const y = isNew ? (1 - flip) * 120 : -flip * 120;
            return (
              <div key={String(isNew)} style={{ position: 'absolute', left: 0, right: 0, top: 0, transform: `translate(${isNew ? 0 : crack * 9}px, ${y}px) scale(${isNew ? 1 : 1.25 - 0.25 * slam})`, opacity: isNew ? shown : slam * shown, fontFamily: EN, fontWeight: 800, fontSize: 230, lineHeight: 1.05, letterSpacing: '-0.04em', color: isNew ? CLEAN : BAD, textShadow: `0 0 60px ${isNew ? 'rgba(62,230,196,0.45)' : 'rgba(255,90,110,0.45)'}` }}>
                {isNew ? '0.0%' : '20.8%'}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: 'absolute', left: X0, width: W, top: 1090, textAlign: 'center', fontFamily: KO, fontWeight: 760, fontSize: 40, color: numColor, opacity: slam }}>
        {flipped ? '다른 목소리로 다시 뽑은 판 · 갈라진 순간 없음' : '소리가 갈라진 순간의 비율'}
      </div>
    </>
  );
};

/** 2 공개(4.8~6.5초): 밝은 판 — 원본의 도구 이름 공개 자리. 6.5~6.7초는 줄어들며 넘김. */
const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const pop = ease(f, B.reveal, 8);
  const out = interpolate(f, [B.flash, B.ear], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: CLEAN, opacity: 1 - out * 0.85, transform: `scale(${1 - 0.18 * out})`, filter: out > 0 ? `blur(${out * 8}px)` : undefined }}>
      <div style={{ position: 'absolute', left: X0, width: W, top: 560, textAlign: 'center', fontFamily: KO, color: NIGHT }}>
        <div style={{ fontWeight: 800, fontSize: 60, letterSpacing: '-0.03em' }}>같은 글 · 다른 목소리로</div>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 300, lineHeight: 1, letterSpacing: '-0.05em', marginTop: 30, transform: `scale(${1.3 - 0.3 * pop})`, opacity: pop }}>0.0%</div>
        <div style={{ display: 'inline-block', marginTop: 40, padding: '10px 30px 14px', borderRadius: 999, background: NIGHT, color: CLEAN, fontWeight: 800, fontSize: 50 }}>깨짐 없음</div>
      </div>
    </AbsoluteFill>
  );
};

/** 3 귀 대신 숫자(6.7~7.9초). */
const Ear: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.ear, 7);
  const b = ease(f, B.ear + 8, 7);
  const row = (p: number, ok: boolean, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 34, opacity: p, transform: `translateX(${(1 - p) * -40}px)`, padding: '30px 38px', borderRadius: 28, background: PANEL, boxShadow: `inset 0 0 0 3px ${ok ? CLEAN : EDGE}` }}>
      <div style={{ width: 90, height: 90, borderRadius: 45, background: ok ? CLEAN : BAD, color: NIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: EN, fontWeight: 900, fontSize: 60 }}>{ok ? '✓' : '✕'}</div>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 62, color: ok ? TEXT : MUTED, textDecoration: ok ? undefined : 'line-through', textDecorationColor: BAD, letterSpacing: '-0.03em' }}>{label}</div>
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 520 }}>
      {row(a, false, '귀로만 고르기')}
      {row(b, true, '숫자로 거르고 고르기')}
    </div>
  );
};

/** 4 물음(7.9~9.6초) — 원본 「49배 · 499배 · 써 본 사람들 주장」 꼬리표 자리: 그 숫자가 무엇인지 묻는다(r1 세 시험관 「20.8%가 뭘 잰 값인지」). */
const Question: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.pair, 8);
  const q = ease(f, B.pair + 10, 8);
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 560, textAlign: 'center', fontFamily: KO }}>
      <div style={{ display: 'inline-block', padding: '20px 48px 26px', borderRadius: 30, background: PANEL, boxShadow: `inset 0 0 0 4px ${BAD}`, transform: `scale(${1.15 - 0.15 * p})`, opacity: p }}>
        <div style={{ fontWeight: 800, fontSize: 50, color: MUTED }}>깨짐</div>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 150, lineHeight: 1.05, color: BAD, letterSpacing: '-0.04em' }}>20.8%</div>
      </div>
      <div style={{ marginTop: 44, opacity: q, transform: `translateY(${(1 - q) * 24}px)`, fontWeight: 800, fontSize: 84, color: TEXT, letterSpacing: '-0.035em' }}>
        어떻게 쟀냐면<span style={{ color: CLEAN }}> ↓</span>
      </div>
    </div>
  );
};

/** 실제 물결 30ms(표본 300점)를 선으로. draw 0~1만큼 왼쪽부터 그린다. */
const ZoomLine: React.FC<{ kind: 'broken' | 'clean'; w: number; h: number; color: string; draw?: number; stroke?: number; span?: number }> = ({ kind, w, h, color, draw = 1, stroke = 5, span = 1 }) => {
  const all = SOUND[kind].zoom;
  const z = all.slice(0, Math.round(all.length * span)); // span: 30ms 가운데 앞쪽 몫만(무늬가 보이게)
  const n = Math.max(2, Math.round(z.length * draw));
  const pts = z
    .slice(0, n)
    .map((v, i) => `${((i / (z.length - 1)) * w).toFixed(1)},${(h / 2 - v * h * 0.44).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

/** 5 원리 확대(9.6~11.8초): 깨끗한 판(B) 파형 카드에 돋보기 — 안에는 그 자리의 실제 물결. 11.3 · 11.6초에 더 다가간다. */
const Lens: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.lens, 8);
  const z1 = ease(f, B.zoom1, 6);
  const z2 = ease(f, B.zoom2, 5);
  const r = 200 + 50 * z1 + 170 * z2;
  const cx = CX + 40 - 40 * z2;
  const cy = 900 + 20 * z2;
  return (
    <>
      <div style={{ position: 'absolute', left: X0, width: W, top: 470, padding: '22px 28px 26px', boxSizing: 'border-box', borderRadius: 28, background: PANEL, boxShadow: `inset 0 0 0 3px ${CLEAN}`, opacity: p * (1 - 0.6 * z2) }}>
        <div style={{ fontFamily: KO, fontWeight: 760, fontSize: 36, color: CLEAN, marginBottom: 10 }}>목소리 B · 깨끗한 소리</div>
        <Wave kind="clean" w={W - 56} h={130} p={1} />
      </div>
      <div style={{ position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: r, overflow: 'hidden', background: '#0E1533', boxShadow: `0 0 0 14px ${TEXT}, 0 30px 70px rgba(0,0,0,0.6)`, opacity: p, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ZoomLine kind="clean" span={0.4} w={r * 1.7} h={r * 1.2} color={CLEAN} draw={interpolate(f, [B.lens + 4, B.lens + 26], [0, 1], clamp)} stroke={5 + 2 * z2} />
      </div>
      <div style={{ position: 'absolute', left: cx + r * 0.66, top: cy + r * 0.66, width: 34, height: 170 + 60 * z1, borderRadius: 17, background: TEXT, transform: 'rotate(-45deg)', transformOrigin: '50% 0', opacity: p * (1 - z2) }} />
    </>
  );
};

/** 6 문제(11.8~15.5초): 두 판의 실제 물결 30ms — B는 같은 무늬가 고르게, A는 들쭉날쭉(깨진 조각 첫머리). 「귀로는 얼마나?」. */
const Waves: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.broken, 7);
  const bad = ease(f, at('v3', '깨진') - 2, 8);
  const q = ease(f, at('v4', '귀로는'), 8);
  const panel = (kind: 'broken' | 'clean', label: string, note: string, color: string, p: number, hi: number) => (
    <div style={{ marginTop: 28, opacity: p, padding: '22px 28px 18px', borderRadius: 28, background: PANEL, boxShadow: `inset 0 0 0 ${2 + 4 * hi}px ${hi > 0 ? color : EDGE}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: KO, fontWeight: 780, fontSize: 38, color, marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ color: TEXT }}>{note}</span>
      </div>
      <ZoomLine kind={kind} span={0.6} w={W - 56} h={190} color={color} stroke={5} />
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 400 }}>
      {panel('clean', '목소리 B · 깨끗', '같은 무늬가 고르게', CLEAN, a, 1 - bad)}
      {panel('broken', '목소리 A · 깨짐', '들쭉날쭉', BAD, a, bad)}
      <div style={{ marginTop: 34, display: 'flex', justifyContent: 'center', gap: 22, opacity: q, transform: `translateY(${(1 - q) * 20}px)` }}>
        {['귀로는', '얼마나?'].map((t, i) => (
          <span key={i} style={{ padding: '10px 26px 13px', borderRadius: 16, background: i === 0 ? '#232C57' : PANEL, boxShadow: i === 0 ? undefined : `inset 0 0 0 2px ${EDGE}`, fontFamily: KO, fontWeight: 780, fontSize: 44, color: i === 0 ? MUTED : TEXT }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
};

/** 칸 띠: 줄 전체의 실제 모음 프레임. scan 0~1만큼 켜고, red 0~1에서 깨진 칸을 빨갛게. */
const Cells: React.FC<{ kind: 'broken' | 'clean'; cols: number; size: number; gap: number; scan: number; red: number }> = ({ kind, cols, size, gap, scan, red }) => {
  const fr = SOUND[kind].frames;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${size}px)`, gap }}>
      {fr.map((x, i) => {
        const on = i / fr.length < scan;
        const bad = x[1] > 0.35;
        const c = !on ? '#222A52' : bad && red > 0 ? BAD : CLEAN;
        return <div key={i} style={{ width: size, height: size, borderRadius: size * 0.22, background: c, opacity: on ? (bad && red > 0 ? 1 : 0.85) : 1, transform: bad && red > 0 ? `scale(${1 + 0.25 * (1 - red)})` : undefined }} />;
      })}
    </div>
  );
};

/** 7 한 번 돌리기(15.5~18.2초): 검사기가 깨진 줄의 모음 칸을 하나씩 재고, 16.9초에 깨진 칸이 빨갛게 선다. */
const Run: React.FC = () => {
  const f = useCurrentFrame();
  const pill = ease(f, B.run, 6);
  const scan = interpolate(f, [B.run + 4, B.mark - 2], [0, 1], clamp);
  const red = f >= B.mark ? ease(f, B.mark, 8) : 0;
  return (
    <>
      <div style={{ position: 'absolute', left: X0, width: W, top: 400, textAlign: 'center', opacity: pill }}>
        <span style={{ display: 'inline-block', padding: '12px 34px 16px', borderRadius: 999, background: CLEAN, color: NIGHT, fontFamily: KO, fontWeight: 800, fontSize: 50 }}>▶ 검사기 돌리기</span>
      </div>
      <div style={{ position: 'absolute', left: X0 + 4, top: 540 }}>
        <Cells kind="broken" cols={9} size={80} gap={14} scan={scan} red={red} />
      </div>
      <div style={{ position: 'absolute', left: X0, width: W, top: 1120, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 50, color: red > 0 ? BAD : TEXT }}>
        {red > 0 ? '빨간 조각 = 소리가 갈라진 순간' : '소리를 아주 잘게 잘라 조각마다 검사'}
      </div>
    </>
  );
};

/** 8 다섯에 하나꼴(18.2~21.2초): A의 실제 조각 53개(빨강 11)를 줄마다 빨강 하나씩 다시 늘어놓아 「다섯 조각에 한 조각꼴」 = 깨짐 20.8%. */
const Ratio: React.FC = () => {
  const f = useCurrentFrame();
  const fr = SOUND.broken.frames;
  const reds = fr.filter((x) => x[1] > 0.35).length;
  // 실제 개수 그대로(빨강 11 · 초록 42) — 줄마다 빨강 하나, 초록은 넷씩 앞에서부터, 남는 줄은 셋
  let g = fr.length - reds;
  const rows: boolean[][] = [];
  for (let i = 0; i < reds; i++) {
    const left = reds - 1 - i;
    const take = Math.max(0, Math.min(4, g - left * 3));
    rows.push([true, ...Array<boolean>(take).fill(false)]);
    g -= take;
  }
  const t = ease(f, B.voices + 6, 8);
  const eq = ease(f, B.voices + 30, 8);
  const S = 46;
  const G = 9;
  return (
    <>
      <div style={{ position: 'absolute', left: X0 + 10, top: 420 }}>
        {rows.map((row, i) => {
          const p = ease(f, B.voices + 2 * i, 6);
          return (
            <div key={i} style={{ display: 'flex', gap: G, marginBottom: G, opacity: p, transform: `translateX(${(1 - p) * -30}px)` }}>
              {row.map((red, k) => (
                <div key={k} style={{ width: S, height: S, borderRadius: 10, background: red ? BAD : CLEAN, opacity: red ? 1 : 0.8 }} />
              ))}
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: X0 + 330, width: W - 330, top: 560, fontFamily: KO, letterSpacing: '-0.035em' }}>
        <div style={{ opacity: t, transform: `translateY(${(1 - t) * 24}px)`, fontWeight: 800, fontSize: 70, lineHeight: 1.2, color: TEXT }}>
          다섯 조각에
          <br />
          <span style={{ color: BAD }}>한 조각꼴</span>
          <br />
          갈라짐
        </div>
        <div style={{ marginTop: 40, opacity: eq, fontWeight: 800, fontSize: 52, color: MUTED }}>
          = 깨짐 <span style={{ fontFamily: EN, color: BAD }}>20.8%</span>
        </div>
      </div>
    </>
  );
};

/** 9 목소리 B(21.2~25.3초) — 원본 비교 막대 자리: 같은 줄을 다시 뽑은 판의 실제 조각 71개, 갈라진 조각 없음. */
const CleanB: React.FC = () => {
  const f = useCurrentFrame();
  const scan = interpolate(f, [B.bars + 3, B.bars + 40], [0, 1], clamp);
  const done = ease(f, B.bars + 42, 8);
  const stamp = ease(f, B.bars + 63, 7);
  return (
    <>
      <div style={{ position: 'absolute', left: X0 + 30, top: 420 }}>
        <Cells kind="clean" cols={9} size={70} gap={14} scan={scan} red={1} />
      </div>
      <div style={{ position: 'absolute', left: X0, width: W, top: 1130, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 50, color: CLEAN, opacity: done }}>
        갈라진 조각 없음 = 깨짐 <span style={{ fontFamily: EN }}>0.0%</span>
      </div>
      <div style={{ position: 'absolute', right: 1080 - 900, top: 980, transform: `rotate(-6deg) scale(${1.6 - 0.6 * stamp})`, opacity: stamp, padding: '12px 30px 16px', borderRadius: 18, background: CLEAN, color: NIGHT, fontFamily: KO, fontWeight: 900, fontSize: 52, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>✓ 이걸로 영상에</div>
    </>
  );
};

/** 10 들어 보기(25.3~28.3초): 두 판을 다시 차례로 — 실제 소리. */
const Listen: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.listen, 7);
  const row = (kind: 'broken' | 'clean', start: number, label: string, color: string, p0: number) => {
    const p = playP(f, start, kind);
    const playing = p > 0 && p < 1;
    return (
      <div style={{ marginTop: 34, opacity: p0, padding: '24px 28px 26px', borderRadius: 28, background: PANEL, boxShadow: `inset 0 0 0 ${playing ? 5 : 2}px ${playing ? color : EDGE}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: KO, fontWeight: 780, fontSize: 42, color, marginBottom: 12 }}>
          <span style={{ width: 54, height: 54, borderRadius: 27, background: color, color: NIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>▶</span>
          {label}
        </div>
        <Wave kind={kind} w={W - 56} h={130} p={p} />
      </div>
    );
  };
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 400 }}>
      <div style={{ textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 56, color: TEXT, opacity: a }}>🎧 다시 들어 보세요</div>
      {row('broken', CLIP.broken2, '목소리 A · 깨짐', BAD, a)}
      {row('clean', CLIP.clean2, '목소리 B · 깨끗', CLEAN, ease(f, B.listen + 5, 7))}
    </div>
  );
};

/** 11 고르는 순서(28.3~33.3초) — 원본 「설치 = 명령 두 줄」 자리. r3 haiku가 지난 편 「두 줄 규칙」 카드와 같아 보인다 해 세 단계 흐름으로. 31.3초에 셋째가 선다. */
const Steps: React.FC = () => {
  const f = useCurrentFrame();
  const head = ease(f, B.rule, 7);
  const s1 = ease(f, at('v6', '목소리마다') - 2, 8);
  const s2 = ease(f, at('v6', '숫자로') - 2, 8);
  const s3 = f >= B.rule2 ? ease(f, B.rule2, 7) : 0;
  const step = (p: number, n: string, label: string, color: string, icon: React.ReactNode, hi = 0) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 26, opacity: 0.12 + 0.88 * p, transform: `translateX(${(1 - p) * -30}px) scale(${1 + 0.05 * hi})`, transformOrigin: '0 50%', padding: '22px 30px', borderRadius: 26, background: PANEL, boxShadow: `inset 0 0 0 ${3 + 3 * hi}px ${p > 0.5 ? color : EDGE}` }}>
      <div style={{ flex: 'none', width: 120, height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontFamily: KO }}>
        <div style={{ fontWeight: 700, fontSize: 32, color: MUTED }}>{n}</div>
        <div style={{ fontWeight: 800, fontSize: 58, color: TEXT, letterSpacing: '-0.03em' }}>{label}</div>
      </div>
    </div>
  );
  const arrow = (p: number) => <div style={{ height: 44, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: EN, fontWeight: 900, fontSize: 40, color: MUTED, opacity: p }}>↓</div>;
  const bars = (cols: string[]) => (
    <svg width="120" height="84" viewBox="0 0 120 84">
      {cols.map((c, i) => (
        <rect key={i} x={i * 42} y="6" width="34" height="72" rx="10" fill={c} />
      ))}
    </svg>
  );
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 360 }}>
      <div style={{ textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 66, color: TEXT, opacity: head, letterSpacing: '-0.03em', marginBottom: 26 }}>
        이제 <span style={{ color: CLEAN }}>이 순서</span>로 골라요
      </div>
      {step(s1, '1', '목소리마다 뽑기', MUTED, bars(['#5E6894', '#5E6894', '#5E6894']))}
      {arrow(s2)}
      {step(s2, '2', '숫자로 거르기', BAD, bars([BAD, CLEAN, BAD]))}
      {arrow(s3)}
      {step(s3, '3', '남은 것만 귀로', CLEAN, <span style={{ fontSize: 66 }}>🎧</span>, s3)}
    </div>
  );
};

/** 12 가져갈 것(33.3~35.5초) — 원본 「무료로 드려요」 카드 자리. 카드 글은 영상 아래 글에 붙인 실제 부탁 글의 첫 문장(r3 세 시험관 「작은 글씨 못 읽음」 — 크게 한 문장만). */
const Prompt: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.prompt, 8);
  const tag = ease(f, at('v7', '통째로') - 2, 7);
  return (
    <div style={{ position: 'absolute', left: X0 + 20, width: W - 40, top: 470, opacity: p, transform: `translateY(${(1 - p) * 40}px) rotate(${-1.5 * p}deg)`, padding: '34px 38px 40px', boxSizing: 'border-box', borderRadius: 30, background: '#F6F8FF', boxShadow: '0 30px 70px rgba(0,0,0,0.5)', fontFamily: KO }}>
      <div style={{ fontWeight: 800, fontSize: 52, color: NIGHT, letterSpacing: '-0.03em' }}>AI한테 붙여 넣을 부탁 글</div>
      <div style={{ marginTop: 24, padding: '22px 26px', borderRadius: 18, background: '#E6EAF7', fontWeight: 700, fontSize: 44, lineHeight: 1.36, color: '#2A3150', letterSpacing: '-0.025em', wordBreak: 'keep-all' }}>
        “… 목소리 파일이 지지직 깨지는지 숫자로 재는 검사기를 파이썬으로 만들어 줘. …”
      </div>
      <div style={{ position: 'absolute', right: 10, top: -34, transform: `rotate(8deg) scale(${1.5 - 0.5 * tag})`, opacity: tag, padding: '12px 28px 16px', borderRadius: 18, background: CLEAN, color: NIGHT, fontWeight: 900, fontSize: 44 }}>영상 아래 글에 통째로</div>
    </div>
  );
};

/** 13 끝(35.5~38.8초) — 원본 「구독 + 댓글로 남겨 주세요」 자리. 규칙을 되풀이하지 않고(r3 haiku) 저장 표시 + 두 판의 실제 물결(✕ · ✓). */
const End: React.FC = () => {
  const f = useCurrentFrame();
  const q = ease(f, B.end, 8);
  const pair = ease(f, B.end + 12, 9);
  const mark = ease(f, at('v7', '저장') - 2, 8);
  const row = (kind: 'broken' | 'clean', color: string, ok: boolean, p: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 22, opacity: p, padding: '14px 24px', borderRadius: 22, background: PANEL, boxShadow: `inset 0 0 0 3px ${color}` }}>
      <span style={{ flex: 'none', width: 64, height: 64, borderRadius: 32, background: color, color: NIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: EN, fontWeight: 900, fontSize: 40 }}>{ok ? '✓' : '✕'}</span>
      <ZoomLine kind={kind} span={0.45} w={W - 160} h={96} color={color} stroke={4} />
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 400, fontFamily: KO }}>
      <div style={{ display: 'flex', justifyContent: 'center', opacity: q }}>
        <div style={{ width: 96, height: 130 * (0.5 + 0.5 * mark), background: CLEAN, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 76%, 0 100%)' }} />
      </div>
      <div style={{ marginTop: 26, opacity: q, transform: `translateY(${(1 - q) * 30}px)`, fontWeight: 800, fontSize: 72, lineHeight: 1.2, color: TEXT, letterSpacing: '-0.035em', textAlign: 'center' }}>
        다음에 AI 목소리
        <br />
        고를 때 <span style={{ color: CLEAN }}>꺼내 보기</span>
      </div>
      <div style={{ marginTop: 40 }}>
        {row('broken', BAD, false, pair)}
        {row('clean', CLEAN, true, ease(f, B.end + 18, 9))}
      </div>
      <div style={{ marginTop: 40, textAlign: 'center', fontWeight: 700, fontSize: 38, color: MUTED, opacity: pair }}>@yuhobuilds</div>
    </div>
  );
};

// ───────────── 머리글 · 자막 ─────────────
const HEADS: { a: number; b: number; text: React.ReactNode }[] = [
  { a: 0, b: B.reveal, text: '목소리 깨짐 재기' },
  { a: B.ear, b: B.pair, text: '목소리 깨짐 재기' },
  { a: B.lens, b: B.run, text: '소리를 확대해 보면' },
  { a: B.bars, b: B.listen, text: '목소리 B도 재 보면' },
  { a: B.prompt, b: B.end, text: '가져갈 것' },
];
const Heads: React.FC = () => {
  const f = useCurrentFrame();
  const h = HEADS.find((x) => f >= x.a && f < x.b);
  return h ? <Header text={h.text} /> : null;
};

/** 아래 낱말 자막 — 원본처럼 그 줄 전체를 띄우고 지금 낱말에만 칠. 읽는 숫자(「이십 점 팔 퍼센트」)는 화면 꼴 「20.8%」 하나로 묶는다. */
const Caption: React.FC = () => {
  const f = useCurrentFrame();
  const id = [...ORDER].reverse().find((x) => f >= VO[x] - 3) as Spoken | undefined;
  if (!id || f > lineEnd(id) + 12 || f >= B.end) return null;
  const toks: { t: string; a: number; b: number }[] = [];
  for (const w of words(id)) {
    const t = show(w[0]);
    const a = VO[id] + Math.round(w[1] * 30);
    const b = VO[id] + Math.round(w[2] * 30);
    if (t === '' || t === '.' || t === ',') {
      if (toks.length) toks[toks.length - 1].b = b;
      continue;
    }
    toks.push({ t, a, b });
  }
  const reveal = f >= B.reveal && f < B.ear;
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 1222, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 12px', fontFamily: KO, fontWeight: 760, fontSize: 47, lineHeight: 1.25, letterSpacing: '-0.025em' }}>
      {toks.map((k, i) => {
        const now = f >= k.a && f < (toks[i + 1]?.a ?? k.b + 6);
        const said = f >= k.a;
        const bg = now ? (reveal ? NIGHT : CLEAN) : 'transparent';
        const color = now ? (reveal ? CLEAN : NIGHT) : said ? (reveal ? NIGHT : TEXT) : reveal ? 'rgba(11,16,38,0.45)' : '#5E6894';
        return (
          <span key={i} style={{ padding: '2px 12px 6px', borderRadius: 12, background: bg, color }}>
            {k.t}
          </span>
        );
      })}
    </div>
  );
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const HITS: Hit[] = [
  { at: B.reveal - 1, src: 'sfx/swish.wav', v: 0.14 },
  { at: B.ear, src: 'sfx/tick.wav', v: 0.12 },
  { at: B.lens - 1, src: 'sfx/swish.wav', v: 0.12 },
  { at: B.broken, src: 'sfx/snap.wav', v: 0.13 },
  { at: B.run, src: 'sfx/tick2.wav', v: 0.12 },
  { at: B.mark, src: 'sfx/thud.wav', v: 0.26 },
  { at: B.bars + 63, src: 'sfx/thud.wav', v: 0.28 },
  { at: B.rule2, src: 'sfx/tick2.wav', v: 0.14 },
  { at: B.prompt, src: 'sfx/swish.wav', v: 0.13 },
  { at: B.end, src: 'sfx/tok.wav', v: 0.3 },
];
const CLIPS: { at: number; kind: 'broken' | 'clean' }[] = [
  { at: CLIP.broken1, kind: 'broken' },
  { at: CLIP.clean1, kind: 'clean' },
  { at: CLIP.broken2, kind: 'broken' },
  { at: CLIP.clean2, kind: 'clean' },
];

// ───────────── 본편 ─────────────
export const VoiceFilm: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const voice = ORDER.map((id) => [VO[id], lineEnd(id)] as [number, number]);
  const clips = CLIPS.map((c) => [c.at, c.at + Math.round(SOUND[c.kind].clipDur * 30)] as [number, number]);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (TOTAL - fr) / 15);
    const v = Math.max(0, ...voice.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    const c = Math.max(0, ...clips.map(([a, b]) => interpolate(fr, [a - 8, a, b, b + 8], [0, 1, 1, 0], clamp)));
    return (0.36 - 0.14 * v - 0.33 * c) * tail * MASTER; // 실제 소리 한마디 동안은 배경음을 거의 뺀다(갈라짐이 들리게)
  };
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 70% at 50% 42%, #18214A 0%, ${NIGHT} 62%)` }}>
      <Scene a={0} b={B.reveal}>
        <Hook />
      </Scene>
      <Scene a={B.reveal} b={B.ear} drift={0} zoom={0}>
        <Reveal />
      </Scene>
      <Scene a={B.ear} b={B.pair}>
        <Ear />
      </Scene>
      <Scene a={B.pair} b={B.lens}>
        <Question />
      </Scene>
      <Scene a={B.lens} b={B.broken} drift={0} zoom={0}>
        <Lens />
      </Scene>
      <Scene a={B.broken} b={B.run} drift={0.12} zoom={0.0003}>
        <Waves />
      </Scene>
      <Scene a={B.run} b={B.voices}>
        <Run />
      </Scene>
      <Scene a={B.voices} b={B.bars}>
        <Ratio />
      </Scene>
      <Scene a={B.bars} b={B.listen} drift={0.12} zoom={0.0003}>
        <CleanB />
      </Scene>
      <Scene a={B.listen} b={B.rule}>
        <Listen />
      </Scene>
      <Scene a={B.rule} b={B.prompt} drift={0.14}>
        <Steps />
      </Scene>
      <Scene a={B.prompt} b={B.end}>
        <Prompt />
      </Scene>
      <Scene a={B.end} b={TOTAL} drift={0.12} zoom={0.0003}>
        <End />
      </Scene>
      <Heads />
      <Caption />
      {ORDER.map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {CLIPS.map((c, i) => (
        <Sequence key={i} from={c.at} layout="none">
          <Audio src={staticFile(`clip/${c.kind}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {HITS.map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

/** 표지: 0.5초 훅 장면(머리글 + 깨진 파형 + 20.8%). */
export const CoverStill: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 70% at 50% 42%, #18214A 0%, ${NIGHT} 62%)` }}>
    <Header text="AI 목소리 깨짐" />
    <Sequence from={-F(1.2)} layout="none">
      <Hook />
    </Sequence>
  </AbsoluteFill>
);
