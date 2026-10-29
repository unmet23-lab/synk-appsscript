// yuhobuilds Y22 v3(10-30) 「둘 중 하나는 깨졌어요, 들리세요? — 검사기는 잡았다」. v2 r2 시험(sonnet 「남의 작업 일지 같다」 · GPT 첫 3초 넘김 ·
// 볼 이유 3 · 「끝의 '들리세요?' 맞대기를 맨 앞으로」) 뒤 다시 짠 판 — 첫머리는 시청자 귀 시험, 내부 말(예약 · 승인 대기 · 검수)은 빼고,
// 끝에서 깨진 「turn!」을 한 번 더 들려준다(처음엔 못 들은 것이 끝에선 들리게). 원본 StXGGNlNLOk 박자 · 남색 무대 · 낱말 자막은 v1 · v2와 같다.
// 화면의 소리 · 파형 · 물결 · 조각은 전부 실제 값(../../자료/파형.py). 실화 · 숫자는 ../../음성/계획_v2.json note.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO, EN } from '../lib/fonts';
import { clamp, prog as ease } from '../lib/motion';
import { SOUND } from '../y22/data.generated';
import { at, B, CLIPS, lineEnd, ORDER, show, TOTAL, VO, words, type Spoken } from './time';

const MASTER = 0.8;
const NIGHT = '#0B1026';
const PANEL = '#141B3A';
const EDGE = '#2A3563';
const TEXT = '#F2F5FF';
const MUTED = '#8C96C0';
const CLEAN = '#3EE6C4';
const BAD = '#FF5A6E';

const X0 = 72;
const W = 920 - X0;
const CX = X0 + W / 2;
type Kind = 'broken' | 'clean';
/** 깨진 판의 깨진 조각 시각(초). */
const BAD_T = SOUND.broken.frames.filter((x) => x[1] > 0.35).map((x) => x[0]);
const playP = (f: number, start: number, dur: number) => interpolate(f, [start, start + dur * 30], [0, 1], clamp);

// ───────────── 공용 ─────────────
const Header: React.FC<{ text: React.ReactNode }> = ({ text }) => (
  <div style={{ position: 'absolute', left: X0, width: W, top: 274, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, fontFamily: KO, fontWeight: 800, fontSize: 58, letterSpacing: '-0.03em', color: TEXT }}>
    <svg width="54" height="40" viewBox="0 0 54 40">
      {[10, 26, 38, 18, 30, 12].map((h, i) => (
        <rect key={i} x={i * 9 + 1} y={20 - h / 2} width="5" height={h} rx="2.5" fill={i === 2 || i === 3 ? BAD : CLEAN} />
      ))}
    </svg>
    <span>{text}</span>
  </div>
);

const Scene: React.FC<{ a: number; b: number; drift?: number; zoom?: number; children: React.ReactNode }> = ({ a, b, drift = 0.1, zoom = 0.00025, children }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b) return null;
  const k = f - a;
  return <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-drift * k}px) scale(${1 + zoom * k})`, transformOrigin: '50% 45%' }}>{children}</div>;
};

/** 실제 봉우리(짧은 판 120칸 · 긴 판 160칸). marks면 깨진 조각 자리를 빨갛게, cuts면 조각을 가르는 금을 긋는다. */
const Wave: React.FC<{ data: { wave: readonly number[]; clipDur: number }; kind: Kind; w: number; h: number; p: number; marks?: boolean; cuts?: number }> = ({ data, kind, w, h, p, marks = false, cuts = 0 }) => {
  const n = data.wave.length;
  const bw = w / n;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {data.wave.map((v, i) => {
        const t = ((i + 0.5) / n) * data.clipDur;
        const bad = kind === 'broken' && BAD_T.some((b) => Math.abs(b - t) < 0.02);
        const played = (i + 0.5) / n <= p;
        const bh = Math.max(4, v * h * 0.92);
        const base = kind === 'clean' ? CLEAN : bad && marks ? BAD : '#C9CFEA';
        return <rect key={i} x={i * bw + bw * 0.16} y={(h - bh) / 2} width={bw * 0.68} height={bh} rx={bw * 0.34} fill={played ? base : '#3A4472'} />;
      })}
      {cuts > 0
        ? Array.from({ length: Math.floor(data.clipDur / 0.04) }, (_, i) => {
            const x = ((i * 0.04) / data.clipDur) * w;
            return <line key={i} x1={x} x2={x} y1={0} y2={h} stroke={NIGHT} strokeWidth={2.5} opacity={cuts} />;
          })
        : null}
    </svg>
  );
};

const ZoomLine: React.FC<{ kind: Kind; w: number; h: number; color: string; span?: number; stroke?: number }> = ({ kind, w, h, color, span = 1, stroke = 5 }) => {
  const all = SOUND[kind].zoom;
  const z = all.slice(0, Math.round(all.length * span));
  const pts = z.map((v, i) => `${((i / (z.length - 1)) * w).toFixed(1)},${(h / 2 - v * h * 0.44).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

/** 소리를 자른 조각(실제 모음 조각, 긴 판 길이 안의 것만)을 실제 시각 자리에. red면 깨진 조각이 빨갛게 선다. */
const Slices: React.FC<{ kind: Kind; w: number; red: number; scan?: number }> = ({ kind, w, red, scan = 1 }) => {
  const dur = SOUND[`${kind}_long`].clipDur;
  const fr = SOUND[kind].frames.filter((x) => x[0] < dur);
  return (
    <div style={{ position: 'relative', width: w, height: 110 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 54, height: 4, borderRadius: 2, background: EDGE }} />
      {fr.map(([t, r], i) => {
        if (t / dur > scan) return null;
        const hot = r > 0.35 && red > 0;
        const hgt = hot ? 60 + 44 * red : 48;
        return <div key={i} style={{ position: 'absolute', left: (t / dur) * (w - 12), top: 56 - hgt / 2, width: 12, height: hgt, borderRadius: 4, background: hot ? BAD : CLEAN, opacity: hot ? 1 : 0.75 }} />;
      })}
    </div>
  );
};

/** 한 판 카드: 이름 · 영어 한마디(뜻) · 파형. */
const ClipCard: React.FC<{ label: string; kind: Kind; p: number; on: boolean; verdict?: React.ReactNode; vColor?: string; vp?: number; marks?: boolean; op?: number }> = ({ label, kind, p, on, verdict, vColor = BAD, vp = 0, marks = false, op = 1 }) => (
  <div style={{ position: 'relative', marginTop: 26, opacity: op, padding: '22px 28px 24px', borderRadius: 28, background: PANEL, boxShadow: `inset 0 0 0 ${on ? 5 : 2}px ${on ? TEXT : vp > 0 ? vColor : EDGE}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: KO }}>
      <span style={{ fontWeight: 800, fontSize: 52, color: TEXT }}>{label}</span>
      <span style={{ fontFamily: EN, fontWeight: 700, fontSize: 40, color: MUTED }}>
        “Your turn!” <span style={{ fontFamily: KO, fontSize: 30 }}>(네 차례!)</span>
      </span>
    </div>
    <div style={{ marginTop: 10 }}>
      <Wave data={SOUND[kind]} kind={kind} w={W - 56} h={120} p={p} marks={marks} />
    </div>
    {verdict ? (
      <div style={{ position: 'absolute', right: -10, bottom: -30, opacity: vp, transform: `rotate(-4deg) scale(${1.5 - 0.5 * vp})`, padding: '10px 26px 14px', borderRadius: 18, background: vColor, color: kind === 'clean' ? NIGHT : '#fff', fontFamily: KO, fontWeight: 900, fontSize: 50, boxShadow: '0 14px 34px rgba(0,0,0,0.5)' }}>{verdict}</div>
    ) : null}
  </div>
);

// ───────────── 장면들 ─────────────
/** 1 훅(0~4.8초): 둘 중 하나는 깨졌다 — A(0.3초) · B(1.3초) 실제 소리, 3.95초 검사기 판정 꼬리표. */
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const pa = playP(f, CLIPS[0].at, SOUND.broken.clipDur);
  const pb = playP(f, CLIPS[1].at, SOUND.clean.clipDur);
  const v = ease(f, B.flip, 6);
  const q = ease(f, at('x1', '들리세요') - 2, 7);
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 380 }}>
      <ClipCard label="A" kind="broken" p={pa} on={pa > 0 && pa < 1} verdict={<>깨짐 <span style={{ fontFamily: EN }}>20.8%</span></>} vp={v} marks={v > 0} />
      <ClipCard label="B" kind="clean" p={pb} on={pb > 0 && pb < 1} verdict={<span style={{ fontFamily: EN }}>0.0%</span>} vColor={CLEAN} vp={v} />
      <div style={{ marginTop: 40, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 70, color: v > 0 ? BAD : TEXT, opacity: Math.max(q, v), letterSpacing: '-0.03em' }}>
        {v > 0 ? '검사기: A가 깨졌다' : '들리세요?'}
      </div>
    </div>
  );
};

/** 2 공개(4.8~6.5초): 빨간 판 — 원본의 도구 이름 공개 자리. */
const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const pop = ease(f, B.reveal, 8);
  const out = interpolate(f, [B.flash, B.def], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: BAD, opacity: 1 - out * 0.85, transform: `scale(${1 - 0.18 * out})`, filter: out > 0 ? `blur(${out * 8}px)` : undefined }}>
      <div style={{ position: 'absolute', left: X0, width: W, top: 560, textAlign: 'center', fontFamily: KO, color: NIGHT }}>
        <div style={{ fontWeight: 800, fontSize: 60, letterSpacing: '-0.03em' }}>귀로는 잘 안 들려도</div>
        <div style={{ fontWeight: 900, fontSize: 210, lineHeight: 1.05, letterSpacing: '-0.05em', marginTop: 30, transform: `scale(${1.3 - 0.3 * pop})`, opacity: pop }}>
          검사기는
          <br />
          잡았다
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 3 숫자의 뜻(6.7~7.9초). */
const Def: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.def, 7);
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 600, textAlign: 'center', fontFamily: KO, opacity: p, transform: `scale(${1.1 - 0.1 * p})` }}>
      <div style={{ fontWeight: 800, fontSize: 52, color: MUTED }}>A의 깨짐</div>
      <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 210, lineHeight: 1.05, letterSpacing: '-0.04em', color: BAD, textShadow: '0 0 60px rgba(255,90,110,0.45)' }}>20.8%</div>
      <div style={{ display: 'inline-block', marginTop: 20, padding: '10px 28px 14px', borderRadius: 16, background: '#3A1F33', fontWeight: 800, fontSize: 50, color: TEXT }}>= 소리가 갈라진 순간의 비율</div>
    </div>
  );
};

/** 4 어디서(7.9~9.6초) — 원본 「써 본 사람들 주장」 꼬리표 자리. */
const Where: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.where, 8);
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 660, textAlign: 'center', fontFamily: KO, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
      <div style={{ fontWeight: 800, fontSize: 96, color: TEXT, letterSpacing: '-0.04em' }}>
        어디서 <span style={{ color: BAD }}>갈라졌냐면</span>
      </div>
      <div style={{ fontFamily: EN, fontWeight: 900, fontSize: 90, color: MUTED, marginTop: 10 }}>↓</div>
    </div>
  );
};

/** 5 확대(9.6~11.8초): A 긴 판 파형의 첫 깨진 자리에 돋보기 — 11.3 · 11.6초에 다가간다. */
const Lens: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.lens, 8);
  const z1 = ease(f, B.zoom1, 6);
  const z2 = ease(f, B.zoom2, 5);
  const r = 180 + 50 * z1 + 140 * z2; // 가장 커도 아래끝이 자막(1222) 위에 머물게
  const crackX = X0 + 30 + (0.465 / SOUND.broken_long.clipDur) * (W - 60);
  const cx = crackX + (CX - crackX) * z2;
  const cy = 830 - 20 * z2;
  return (
    <>
      <div style={{ position: 'absolute', left: X0, width: W, top: 470, padding: '22px 30px 26px', boxSizing: 'border-box', borderRadius: 28, background: PANEL, boxShadow: `inset 0 0 0 3px ${BAD}`, opacity: p * (1 - 0.6 * z2) }}>
        <div style={{ fontFamily: KO, fontWeight: 760, fontSize: 36, color: BAD, marginBottom: 10 }}>A · “Your turn! Comment your name, …”</div>
        <Wave data={SOUND.broken_long} kind="broken" w={W - 60} h={130} p={1} marks />
      </div>
      <div style={{ position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: r, overflow: 'hidden', background: '#0E1533', boxShadow: `0 0 0 14px ${TEXT}, 0 30px 70px rgba(0,0,0,0.6)`, opacity: p, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ZoomLine kind="broken" span={0.5} w={r * 1.7} h={r * 1.2} color={BAD} stroke={5 + 2 * z2} />
      </div>
      <div style={{ position: 'absolute', left: cx + r * 0.66, top: cy + r * 0.66, width: 34, height: 160 + 60 * z1, borderRadius: 17, background: TEXT, transform: 'rotate(-45deg)', transformOrigin: '50% 0', opacity: p * (1 - z2) }} />
    </>
  );
};

/** 6 조각(11.8~15.5초): 같은 파형을 잘게 자른 금 → 그 아래 조각(실제 모음 조각 자리), 13.9초에 깨진 조각이 빨갛게. */
const Cut: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.slices, 7);
  const cut = ease(f, at('x4', '잘게') - 2, 10);
  const scan = interpolate(f, [at('x4', '잘라서') - 2, B.mark - 2], [0, 1], clamp);
  const red = f >= B.mark ? ease(f, B.mark, 8) : 0;
  return (
    <>
      <div style={{ position: 'absolute', left: X0, width: W, top: 430, opacity: a, padding: '24px 28px 20px', boxSizing: 'border-box', borderRadius: 28, background: PANEL, boxShadow: `inset 0 0 0 2px ${EDGE}` }}>
        <div style={{ fontFamily: KO, fontWeight: 760, fontSize: 36, color: MUTED, marginBottom: 10 }}>A를 아주 잘게 자르면</div>
        <Wave data={SOUND.broken_long} kind="broken" w={W - 56} h={150} p={1} marks={red > 0} cuts={cut} />
        <div style={{ marginTop: 18 }}>
          <Slices kind="broken" w={W - 56} red={red} scan={scan} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: X0, width: W, top: 920, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 54, color: red > 0 ? BAD : TEXT, opacity: Math.max(cut, red) }}>
        {red > 0 ? '빨간 조각 = 소리가 갈라진 순간' : '조각마다 검사'}
      </div>
    </>
  );
};

/** 7 같은 자리 견주기(15.5~18.2초): 갈라진 순간의 실제 물결 A와, 다시 뽑은 판 B의 같은 자리. */
const Compare: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.compare, 7);
  const b = ease(f, B.compare + 10, 7);
  const panel = (kind: Kind, label: string, note: string, color: string, p: number) => (
    <div style={{ marginTop: 28, opacity: p, padding: '22px 28px 18px', borderRadius: 28, background: PANEL, boxShadow: `inset 0 0 0 4px ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: KO, fontWeight: 780, fontSize: 40, color }}>
        <span>{label}</span>
        <span style={{ color: TEXT }}>{note}</span>
      </div>
      <ZoomLine kind={kind} span={0.6} w={W - 56} h={190} color={color} stroke={5} />
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 400 }}>
      {panel('broken', 'A · 갈라진 순간', '들쭉날쭉', BAD, a)}
      {panel('clean', 'B · 같은 자리', '같은 무늬가 고르게', CLEAN, b)}
    </div>
  );
};

/** 8 나갈 뻔(18.2~21.2초). */
const Almost: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.almost, 7);
  const stop = ease(f, at('x5', '다른') - 3, 7);
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 520, fontFamily: KO }}>
      <div style={{ position: 'relative', opacity: a, padding: '36px 40px 40px', borderRadius: 30, background: PANEL, boxShadow: `inset 0 0 0 4px ${BAD}` }}>
        <div style={{ fontWeight: 700, fontSize: 38, color: MUTED }}>A가 든 영상</div>
        <div style={{ fontWeight: 800, fontSize: 76, lineHeight: 1.18, color: TEXT, letterSpacing: '-0.035em', marginTop: 8 }}>
          그대로 <span style={{ color: BAD }}>나갈 뻔</span>
        </div>
        <div style={{ marginTop: 20 }}>
          <Wave data={SOUND.broken_long} kind="broken" w={W - 80} h={90} p={1} marks />
        </div>
        <div style={{ position: 'absolute', right: 26, top: -32, opacity: stop, transform: `rotate(-7deg) scale(${1.6 - 0.6 * stop})`, padding: '12px 30px 16px', borderRadius: 18, background: CLEAN, color: NIGHT, fontWeight: 900, fontSize: 54, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>다시 뽑기</div>
      </div>
    </div>
  );
};

/** 9 다시 뽑은 판(21.2~25.3초) — 원본 비교 막대 자리: 같은 줄을 다른 목소리로(실제 소리), 조각에 빨강 없음 → 0.0%. */
const Again: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.again, 7);
  const start = CLIPS[2].at;
  const p = playP(f, start, SOUND.clean_long.clipDur);
  const zero = ease(f, start + 58, 8);
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 400, opacity: a }}>
      <div style={{ padding: '24px 30px 22px', borderRadius: 30, background: PANEL, boxShadow: `inset 0 0 0 4px ${CLEAN}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: KO, fontWeight: 760, fontSize: 36, color: CLEAN }}>
          <span>B · 다른 목소리로 다시 뽑은 판</span>
          <span style={{ color: TEXT }}>실제 소리</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <Wave data={SOUND.clean_long} kind="clean" w={W - 60} h={130} p={p} cuts={1} />
        </div>
        <div style={{ marginTop: 10 }}>
          <Slices kind="clean" w={W - 60} red={1} scan={p} />
        </div>
      </div>
      <div style={{ marginTop: 34, textAlign: 'center', opacity: zero, transform: `scale(${1.2 - 0.2 * zero})`, fontFamily: KO, fontWeight: 800, fontSize: 64, color: CLEAN }}>
        빨간 조각 없음 · 깨짐 <span style={{ fontFamily: EN, fontSize: 96 }}>0.0%</span>
      </div>
    </div>
  );
};

/** 10 그대로 나감(25.3~28.3초). */
const Out: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.out, 7);
  const b = ease(f, B.out + 10, 7);
  const ok = ease(f, B.out + 24, 8);
  const row = (p: number, kind: Kind, label: string, tag: string, color: string, sign: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 26, opacity: p, padding: '20px 26px', borderRadius: 26, background: PANEL, boxShadow: `inset 0 0 0 3px ${color}`, fontFamily: KO }}>
      <span style={{ flex: 'none', width: 70, height: 70, borderRadius: 35, background: color, color: NIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: EN, fontWeight: 900, fontSize: 42 }}>{sign}</span>
      <span style={{ flex: 1, fontWeight: 800, fontSize: 54, color: TEXT }}>{label}</span>
      <span style={{ fontWeight: 800, fontSize: 46, color }}>{tag}</span>
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 480 }}>
      {row(a, 'broken', 'A', '깨짐 20.8%', BAD, '✕')}
      {row(b, 'clean', 'B', '깨짐 0.0%', CLEAN, '✓')}
      <div style={{ marginTop: 44, textAlign: 'center', opacity: ok, fontFamily: KO, fontWeight: 800, fontSize: 62, color: TEXT }}>
        <span style={{ color: CLEAN }}>B</span>로 그대로 나갔어요
      </div>
    </div>
  );
};

/** 11 고르는 순서(28.3~33.3초) — 원본 「설치 = 명령 두 줄」 자리. */
const Steps: React.FC = () => {
  const f = useCurrentFrame();
  const head = ease(f, B.rule, 7);
  const s1 = ease(f, B.rule + 4, 8);
  const s2 = ease(f, at('x6', '숫자로') - 2, 8);
  const s3 = f >= B.rule2 ? ease(f, B.rule2, 7) : 0;
  const step = (p: number, n: string, label: string, color: string, hi = 0) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 26, opacity: 0.12 + 0.88 * p, transform: `translateX(${(1 - p) * -30}px) scale(${1 + 0.05 * hi})`, transformOrigin: '0 50%', padding: '24px 30px', borderRadius: 26, background: PANEL, boxShadow: `inset 0 0 0 ${3 + 3 * hi}px ${p > 0.5 ? color : EDGE}` }}>
      <span style={{ flex: 'none', width: 72, height: 72, borderRadius: 36, background: color, color: NIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: EN, fontWeight: 900, fontSize: 40 }}>{n}</span>
      <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 58, color: TEXT, letterSpacing: '-0.03em' }}>{label}</span>
    </div>
  );
  const arrow = (p: number) => <div style={{ height: 44, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: EN, fontWeight: 900, fontSize: 40, color: MUTED, opacity: p }}>↓</div>;
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 380 }}>
      <div style={{ textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 64, color: TEXT, opacity: head, letterSpacing: '-0.03em', marginBottom: 26 }}>
        듣고 <span style={{ color: BAD }}>고르기 전에</span>
      </div>
      {step(s1, '1', '목소리마다 뽑기', MUTED)}
      {arrow(s2)}
      {step(s2, '2', '숫자로 먼저 거르기', BAD)}
      {arrow(s3)}
      {step(s3, '3', '남은 것만 귀로', CLEAN, s3)}
    </div>
  );
};

/** 12 가져갈 것(33.3~35.5초). */
const Prompt: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.prompt, 8);
  const tag = ease(f, at('x7', '아래') - 2, 7);
  return (
    <div style={{ position: 'absolute', left: X0 + 20, width: W - 40, top: 470, opacity: p, transform: `translateY(${(1 - p) * 40}px) rotate(${-1.5 * p}deg)`, padding: '34px 38px 40px', boxSizing: 'border-box', borderRadius: 30, background: '#F6F8FF', boxShadow: '0 30px 70px rgba(0,0,0,0.5)', fontFamily: KO }}>
      <div style={{ fontWeight: 800, fontSize: 52, color: NIGHT, letterSpacing: '-0.03em' }}>AI한테 붙여 넣을 부탁 글</div>
      <div style={{ marginTop: 24, padding: '22px 26px', borderRadius: 18, background: '#E6EAF7', fontWeight: 700, fontSize: 44, lineHeight: 1.36, color: '#2A3150', letterSpacing: '-0.025em', wordBreak: 'keep-all' }}>
        “… 목소리 파일이 지지직 깨지는지 숫자로 재는 검사기를 파이썬으로 만들어 줘. …”
      </div>
      <div style={{ position: 'absolute', right: 10, top: -34, transform: `rotate(8deg) scale(${1.5 - 0.5 * tag})`, opacity: tag, padding: '12px 28px 16px', borderRadius: 18, background: CLEAN, color: NIGHT, fontWeight: 900, fontSize: 44 }}>영상 아래 글에</div>
    </div>
  );
};

/** 13 끝(35.5~38.8초): 이제 「턴」에서 — 36.8초 깨진 A가 다시 울리고, 그 자리 조각이 빨갛게 번쩍인다. 처음엔 못 들은 것이 이제는 들리게. */
const End: React.FC = () => {
  const f = useCurrentFrame();
  const q = ease(f, B.end, 8);
  const start = CLIPS[3].at;
  const p = playP(f, start, SOUND.broken.clipDur);
  const flash = interpolate(f, [start + Math.round(0.43 * 30), start + Math.round(0.43 * 30) + 2, start + Math.round(0.5 * 30) + 6], [0, 1, 0.4], clamp);
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 420, fontFamily: KO }}>
      <div style={{ opacity: q, transform: `translateY(${(1 - q) * 30}px)`, textAlign: 'center', fontWeight: 800, fontSize: 78, lineHeight: 1.2, color: TEXT, letterSpacing: '-0.035em' }}>
        이제 <span style={{ color: BAD }}>「턴」</span>에서
        <br />
        들어 보세요
      </div>
      <div style={{ marginTop: 40, opacity: q, padding: '22px 28px 24px', borderRadius: 28, background: PANEL, boxShadow: `inset 0 0 0 ${3 + 6 * flash}px ${BAD}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: KO, fontWeight: 800, fontSize: 46, color: BAD }}>
          <span>A</span>
          <span style={{ fontFamily: EN, color: TEXT }}>“Your turn!”</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <Wave data={SOUND.broken} kind="broken" w={W - 56} h={140} p={p} marks />
        </div>
      </div>
      <div style={{ marginTop: 40, textAlign: 'center', fontWeight: 700, fontSize: 38, color: MUTED, opacity: q }}>@yuhobuilds</div>
    </div>
  );
};

// ───────────── 머리글 · 자막 ─────────────
const HEADS: { a: number; b: number; text: React.ReactNode }[] = [
  { a: 0, b: B.reveal, text: '둘 중 하나는 깨졌다' },
  { a: B.lens, b: B.compare, text: '다시 들어 보면' },
  { a: B.again, b: B.out, text: '다시 뽑기' },
  { a: B.prompt, b: B.end, text: '가져갈 것' },
];
const Heads: React.FC = () => {
  const f = useCurrentFrame();
  const h = HEADS.find((x) => f >= x.a && f < x.b);
  return h ? <Header text={h.text} /> : null;
};

const Caption: React.FC = () => {
  const f = useCurrentFrame();
  const id = [...ORDER].reverse().find((x) => f >= VO[x] - 3) as Spoken | undefined;
  if (!id || f > lineEnd(id) + 12) return null;
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
  const reveal = f >= B.reveal && f < B.def;
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 1222, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 12px', fontFamily: KO, fontWeight: 760, fontSize: 47, lineHeight: 1.25, letterSpacing: '-0.025em' }}>
      {toks.map((k, i) => {
        const now = f >= k.a && f < (toks[i + 1]?.a ?? k.b + 6);
        const said = f >= k.a;
        const bg = now ? (reveal ? NIGHT : CLEAN) : 'transparent';
        const color = now ? (reveal ? BAD : NIGHT) : said ? (reveal ? NIGHT : TEXT) : reveal ? 'rgba(11,16,38,0.45)' : '#5E6894';
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
  { at: B.flip, src: 'sfx/thud.wav', v: 0.26 },
  { at: B.reveal - 1, src: 'sfx/swish.wav', v: 0.14 },
  { at: B.def, src: 'sfx/tick.wav', v: 0.12 },
  { at: B.where, src: 'sfx/tick2.wav', v: 0.12 },
  { at: B.lens - 1, src: 'sfx/swish.wav', v: 0.12 },
  { at: B.slices, src: 'sfx/snap.wav', v: 0.13 },
  { at: B.mark, src: 'sfx/thud.wav', v: 0.24 },
  { at: B.compare, src: 'sfx/tick2.wav', v: 0.12 },
  { at: B.again, src: 'sfx/swish.wav', v: 0.12 },
  { at: B.out, src: 'sfx/tok.wav', v: 0.24 },
  { at: B.rule2, src: 'sfx/tick2.wav', v: 0.14 },
  { at: B.prompt, src: 'sfx/swish.wav', v: 0.13 },
  { at: B.end, src: 'sfx/tok.wav', v: 0.26 },
];

// ───────────── 본편 ─────────────
export const VoiceFilmV3: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const voice = ORDER.map((id) => [VO[id], lineEnd(id)] as [number, number]);
  const clips = CLIPS.map((c) => [c.at, c.at + Math.round(SOUND[c.kind].clipDur * 30)] as [number, number]);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (TOTAL - fr) / 15);
    const v = Math.max(0, ...voice.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    const c = Math.max(0, ...clips.map(([a, b]) => interpolate(fr, [a - 8, a, b, b + 8], [0, 1, 1, 0], clamp)));
    return (0.36 - 0.14 * v - 0.33 * c) * tail * MASTER; // 실제 소리 토막 동안은 배경음을 거의 뺀다(갈라짐이 들리게)
  };
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 70% at 50% 42%, #18214A 0%, ${NIGHT} 62%)` }}>
      <Scene a={0} b={B.reveal}>
        <Hook />
      </Scene>
      <Scene a={B.reveal} b={B.def} drift={0} zoom={0}>
        <Reveal />
      </Scene>
      <Scene a={B.def} b={B.where}>
        <Def />
      </Scene>
      <Scene a={B.where} b={B.lens}>
        <Where />
      </Scene>
      <Scene a={B.lens} b={B.slices} drift={0} zoom={0}>
        <Lens />
      </Scene>
      <Scene a={B.slices} b={B.compare} drift={0.1}>
        <Cut />
      </Scene>
      <Scene a={B.compare} b={B.almost} drift={0.12} zoom={0.0003}>
        <Compare />
      </Scene>
      <Scene a={B.almost} b={B.again} drift={0.12} zoom={0.0004}>
        <Almost />
      </Scene>
      <Scene a={B.again} b={B.out} drift={0.1}>
        <Again />
      </Scene>
      <Scene a={B.out} b={B.rule} drift={0.12}>
        <Out />
      </Scene>
      <Scene a={B.rule} b={B.prompt} drift={0.14}>
        <Steps />
      </Scene>
      <Scene a={B.prompt} b={B.end}>
        <Prompt />
      </Scene>
      <Scene a={B.end} b={TOTAL} drift={0.1} zoom={0.0003}>
        <End />
      </Scene>
      <Heads />
      <Caption />
      {ORDER.map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo3/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {CLIPS.map((c, i) => (
        <Sequence key={i} from={c.at} layout="none">
          <Audio src={staticFile(c.src)} volume={MASTER} />
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

/** 표지: 4.3초 장면(A · B 카드와 판정 꼬리표). */
export const CoverStillV3: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 70% at 50% 42%, #18214A 0%, ${NIGHT} 62%)` }}>
    <Header text="둘 중 하나는 깨졌다" />
    <Sequence from={-Math.round(4.3 * 30)} layout="none">
      <Hook />
    </Sequence>
  </AbsoluteFill>
);
