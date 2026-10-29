// yuhobuilds Y22 v2(10-30) 「저녁에 나갈 영상, 마지막 소리 검수에서 검사기가 잡았다」. v1(게시한 r4)이 재미 3 · 3 · 볼 이유 2 · 「20.8%가 무엇인지」로
// 관문을 못 넘어(기획.md 「v2」) 무엇으로 이기나를 이야기로 바꿨다 — 실화: 10-29 유호님이 승인 전에 음성 검수를 부탁, 검사기 20.8%,
// 승인 대기이던 저녁 예약을 거두고 다른 목소리로 다시 뽑아 0.0%로 나감(커밋 86e4a62df). 전날 귀는 「다 깨진다」까지만(9dd83c717). 원본 StXGGNlNLOk 박자 · 남색 무대 · 낱말 자막은 v1과 같다.
// 화면의 소리 · 파형 · 물결 · 조각 칸은 전부 실제 값(../../자료/파형.py) — 조각 칸은 그 줄의 모음 조각을 실제 시각 자리에 늘어놓는다.
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
const F = (s: number) => Math.round(s * 30);
type Kind = 'broken' | 'clean';
const WORDS_A: [string, number][] = [['Your turn!', 0.02], ['Comment', 0.875], ['your name,', 1.302], ["and I'll write it", 2.062], ['in Korean.', 2.759]];

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

const clipAt = (kind: string) => CLIPS.find((c) => c.kind === kind)!.at;
const playP = (f: number, start: number, dur: number) => interpolate(f, [start, start + dur * 30], [0, 1], clamp);
/** 깨진 판의 깨진 조각 시각(초). */
const BAD_T = SOUND.broken.frames.filter((x) => x[1] > 0.35).map((x) => x[0]);

/** 「Your turn! Comment your name,」 긴 판의 실제 봉우리. marks 0~1이면 깨진 조각 자리를 빨갛게. */
const LongWave: React.FC<{ kind: Kind; w: number; h: number; p: number; marks?: number }> = ({ kind, w, h, p, marks = 0 }) => {
  const d = SOUND[`${kind}_long`];
  const n = d.wave.length;
  const bw = w / n;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {d.wave.map((v, i) => {
        const t = ((i + 0.5) / n) * d.clipDur;
        const bad = kind === 'broken' && BAD_T.some((b) => Math.abs(b - t) < 0.02);
        const played = (i + 0.5) / n <= p;
        const bh = Math.max(4, v * h * 0.92);
        const base = kind === 'clean' ? CLEAN : bad && marks > 0 ? BAD : '#C9CFEA';
        return <rect key={i} x={i * bw + bw * 0.16} y={(h - bh) / 2} width={bw * 0.68} height={bh} rx={bw * 0.34} fill={played ? base : '#3A4472'} transform={bad && marks > 0 && marks < 1 ? undefined : undefined} />;
      })}
    </svg>
  );
};

/** 실제 물결 30ms. */
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

/** 그 줄 전체(실제 길이)의 모음 조각을 실제 시각 자리에 세운 막대. scan 0~1까지 보이고, red 0~1이면 깨진 조각이 빨갛게 선다. */
const Timeline: React.FC<{ kind: Kind; w: number; scan: number; red: number; words?: boolean }> = ({ kind, w, scan, red, words: showWords }) => {
  const fr = SOUND[kind].frames;
  const dur = SOUND[`${kind}_long`].lineDur;
  return (
    <div style={{ position: 'relative', width: w, height: showWords ? 190 : 130 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 64, height: 4, borderRadius: 2, background: '#2A3563' }} />
      {fr.map(([t, r], i) => {
        const x = (t / dur) * (w - 10);
        if (t / dur > scan) return null;
        const bad = r > 0.35;
        const hot = bad && red > 0;
        const hgt = hot ? 64 + 46 * red : 52;
        return <div key={i} style={{ position: 'absolute', left: x, top: 66 - hgt / 2, width: 8, height: hgt, borderRadius: 4, background: hot ? BAD : CLEAN, opacity: hot ? 1 : 0.75 }} />;
      })}
      <div style={{ position: 'absolute', left: Math.min(scan, 1) * (w - 10), top: 0, width: 3, height: 132, background: TEXT, opacity: scan > 0 && scan < 1 ? 0.8 : 0 }} />
      {showWords
        ? WORDS_A.map(([wd, t], i) => (
            <div key={i} style={{ position: 'absolute', left: (t / dur) * (w - 10), top: 140, fontFamily: EN, fontWeight: 600, fontSize: 28, color: MUTED, whiteSpace: 'nowrap' }}>
              {wd}
            </div>
          ))
        : null}
    </div>
  );
};

/** 저녁 예약 카드(사실을 적은 그림 — 실제 화면이 아니다). state: 0 예약됨 · 1 거둠 */
const Plan: React.FC<{ p: number; pulled: number }> = ({ p, pulled }) => (
  <div style={{ position: 'relative', opacity: p, transform: `translateY(${(1 - p) * 30}px)`, padding: '34px 40px', borderRadius: 30, background: PANEL, boxShadow: `inset 0 0 0 3px ${pulled > 0 ? BAD : EDGE}`, fontFamily: KO }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
      <div style={{ width: 120, height: 130, borderRadius: 20, background: '#F6F8FF', overflow: 'hidden', flex: 'none' }}>
        <div style={{ height: 34, background: BAD }} />
        <div style={{ textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: 60, color: NIGHT, marginTop: 8 }}>29</div>
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 36, color: MUTED }}>영어 해설이 든 쇼츠</div>
        <div style={{ fontWeight: 800, fontSize: 60, color: TEXT, letterSpacing: '-0.03em' }}>그날 저녁 예약 · 승인 대기</div>
      </div>
    </div>
    <div style={{ position: 'absolute', right: 30, top: -30, opacity: pulled, transform: `rotate(-8deg) scale(${1.6 - 0.6 * pulled})`, padding: '12px 30px 16px', borderRadius: 18, background: BAD, color: '#fff', fontWeight: 900, fontSize: 56, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>예약 거둠</div>
  </div>
);

// ───────────── 장면들 ─────────────
/** 1 훅(0~4.8초): 제 귀엔 멀쩡했던 한 줄(실제 소리) → 3.7초 검사기 판정 「깨짐 20.8%」, 파형에 깨진 자리가 빨갛게. */
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const flipped = f >= B.flip;
  const p = playP(f, clipAt('broken_long'), SOUND.broken_long.clipDur);
  const lit = ease(f, B.hook, 6);
  const slam = ease(f, B.flip, 6);
  return (
    <>
      <div style={{ position: 'absolute', left: X0, width: W, top: 400, padding: '26px 30px 30px', boxSizing: 'border-box', borderRadius: 30, background: PANEL, boxShadow: `inset 0 0 0 ${flipped ? 4 : 2}px ${flipped ? BAD : EDGE}`, opacity: 0.4 + 0.6 * lit }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: KO, fontWeight: 700, fontSize: 32, color: MUTED }}>
          <span>AI 영어 해설 · 실제 소리</span>
          <span style={{ padding: '4px 16px 7px', borderRadius: 999, background: flipped ? BAD : '#2B3462', color: TEXT }}>{flipped ? '검사기: 깨짐' : '마지막 소리 검수'}</span>
        </div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 58, color: TEXT, margin: '14px 0 10px', letterSpacing: '-0.02em' }}>“Your turn! Comment your name, …”</div>
        <LongWave kind="broken" w={W - 60} h={170} p={p} marks={flipped ? 1 : 0} />
      </div>
      <div style={{ position: 'absolute', left: X0, width: W, top: 850, textAlign: 'center', fontFamily: KO, opacity: slam, transform: `scale(${1.25 - 0.25 * slam})` }}>
        <div style={{ fontWeight: 800, fontSize: 48, color: MUTED }}>검사기 판정</div>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 200, lineHeight: 1.05, letterSpacing: '-0.04em', color: BAD, textShadow: '0 0 60px rgba(255,90,110,0.45)' }}>
          <span style={{ fontFamily: KO, fontSize: 120 }}>깨짐 </span>20.8%
        </div>
        <div style={{ fontWeight: 760, fontSize: 42, color: BAD, marginTop: 6 }}>소리가 갈라진 순간의 비율</div>
      </div>
    </>
  );
};

/** 2 공개(4.8~6.5초): 빨간 판 — 원본의 도구 이름 공개 자리. */
const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const pop = ease(f, B.reveal, 8);
  const out = interpolate(f, [B.flash, B.ear], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: BAD, opacity: 1 - out * 0.85, transform: `scale(${1 - 0.18 * out})`, filter: out > 0 ? `blur(${out * 8}px)` : undefined }}>
      <div style={{ position: 'absolute', left: X0, width: W, top: 560, textAlign: 'center', fontFamily: KO, color: NIGHT }}>
        <div style={{ fontWeight: 800, fontSize: 60, letterSpacing: '-0.03em' }}>마지막 검수에서 검사기가</div>
        <div style={{ fontWeight: 900, fontSize: 250, lineHeight: 1.05, letterSpacing: '-0.05em', marginTop: 30, transform: `scale(${1.3 - 0.3 * pop})`, opacity: pop }}>잡았다</div>
      </div>
    </AbsoluteFill>
  );
};

/** 4 귀 vs 검사기(7.9~9.6초) — 원본 「써 본 사람들 주장」 꼬리표 자리: 전날 귀는 「다 깨진다」(10-28 유호님), 검사기는 「이 줄 20.8%」. */
const Versus: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.stake, 7);
  const b = ease(f, B.stake + 12, 7);
  const row = (p: number, who: string, said: React.ReactNode, color: string, strike: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 34, opacity: p, transform: `translateX(${(1 - p) * -40}px)`, padding: '30px 38px', borderRadius: 28, background: PANEL, boxShadow: `inset 0 0 0 3px ${color}`, fontFamily: KO }}>
      <span style={{ fontWeight: 700, fontSize: 46, color: MUTED }}>{who}</span>
      <span style={{ fontWeight: 800, fontSize: 64, color: strike ? MUTED : color, textDecoration: strike ? 'line-through' : undefined, textDecorationColor: BAD, letterSpacing: '-0.03em' }}>{said}</span>
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 520 }}>
      {row(a, '전날 제 귀', '「다 깨진다」', EDGE, false)}
      {row(b, '검사기', <>이 줄 <span style={{ fontFamily: EN }}>20.8%</span></>, BAD, false)}
    </div>
  );
};

/** 3 그날 저녁 예약(6.7~7.9초) — 승인만 남은 21시 등록(10-29). */
const Stake: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 560 }}>
      <Plan p={ease(f, B.ear, 8)} pulled={0} />
    </div>
  );
};

/** 5 다시 들어 보기(9.6~11.8초): 파형 카드의 첫 깨진 자리에 돋보기 — 10.95초 갈라진 「turn!」이 울리고 11.3 · 11.6초에 다가간다. */
const Lens: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.lens, 8);
  const z1 = ease(f, B.zoom1, 6);
  const z2 = ease(f, B.zoom2, 5);
  const r = 190 + 60 * z1 + 180 * z2;
  const crackX = X0 + 30 + ((0.465 / SOUND.broken_long.clipDur) * (W - 60));
  const cx = crackX + (CX - crackX) * z2;
  const cy = 860 + 40 * z2;
  return (
    <>
      <div style={{ position: 'absolute', left: X0, width: W, top: 470, padding: '22px 30px 26px', boxSizing: 'border-box', borderRadius: 28, background: PANEL, boxShadow: `inset 0 0 0 3px ${BAD}`, opacity: p * (1 - 0.6 * z2) }}>
        <div style={{ fontFamily: KO, fontWeight: 760, fontSize: 36, color: BAD, marginBottom: 10 }}>다시 들어 보면 · 깨진 판</div>
        <LongWave kind="broken" w={W - 60} h={130} p={1} marks={1} />
      </div>
      <div style={{ position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: r, overflow: 'hidden', background: '#0E1533', boxShadow: `0 0 0 14px ${TEXT}, 0 30px 70px rgba(0,0,0,0.6)`, opacity: p, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ZoomLine kind="broken" span={0.5} w={r * 1.7} h={r * 1.2} color={BAD} stroke={5 + 2 * z2} />
      </div>
      <div style={{ position: 'absolute', left: cx + r * 0.66, top: cy + r * 0.66, width: 34, height: 160 + 60 * z1, borderRadius: 17, background: TEXT, transform: 'rotate(-45deg)', transformOrigin: '50% 0', opacity: p * (1 - z2) }} />
    </>
  );
};

/** 6 여기(11.8~15.5초): 갈라진 순간의 실제 물결(A)과 다시 뽑은 판의 물결(B). */
const Waves: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.waves, 7);
  const b = ease(f, at('w4', '소리가') - 2, 8);
  const panel = (kind: Kind, label: string, note: string, color: string, p: number, hi: boolean) => (
    <div style={{ marginTop: 28, opacity: p, padding: '22px 28px 18px', borderRadius: 28, background: PANEL, boxShadow: `inset 0 0 0 ${hi ? 6 : 2}px ${hi ? color : EDGE}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: KO, fontWeight: 780, fontSize: 38, color, marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ color: TEXT }}>{note}</span>
      </div>
      <ZoomLine kind={kind} span={0.6} w={W - 56} h={200} color={color} stroke={5} />
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 400 }}>
      {panel('broken', '여기 · 깨진 판', '들쭉날쭉', BAD, a, true)}
      {panel('clean', '같은 자리 · 다시 뽑은 판', '같은 무늬가 고르게', CLEAN, b, false)}
    </div>
  );
};

/** 7 검사기(15.5~18.2초): 그 줄 전체의 모음 조각을 실제 시각 자리에 — 16.9초에 깨진 조각이 빨갛게 선다. */
const Run: React.FC = () => {
  const f = useCurrentFrame();
  const pill = ease(f, B.run, 6);
  const scan = interpolate(f, [B.run + 4, B.mark - 2], [0, 1], clamp);
  const red = f >= B.mark ? ease(f, B.mark, 8) : 0;
  return (
    <>
      <div style={{ position: 'absolute', left: X0, width: W, top: 420, textAlign: 'center', opacity: pill }}>
        <span style={{ display: 'inline-block', padding: '12px 34px 16px', borderRadius: 999, background: CLEAN, color: NIGHT, fontFamily: KO, fontWeight: 800, fontSize: 50 }}>▶ 검사기 돌리기</span>
      </div>
      <div style={{ position: 'absolute', left: X0, top: 600, padding: '30px 24px 20px', borderRadius: 28, background: PANEL, boxShadow: `inset 0 0 0 2px ${EDGE}` }}>
        <div style={{ fontFamily: KO, fontWeight: 760, fontSize: 34, color: MUTED, marginBottom: 6 }}>깨진 판 · 그 줄 전체</div>
        <Timeline kind="broken" w={W - 48} scan={scan} red={red} words />
      </div>
      <div style={{ position: 'absolute', left: X0, width: W, top: 1000, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 52, color: red > 0 ? BAD : TEXT, opacity: red > 0 ? red : 0.9 }}>
        {red > 0 ? (
          <>
            빨간 조각 = 갈라진 순간 → <span style={{ fontFamily: EN }}>20.8%</span>
          </>
        ) : (
          '소리를 잘게 잘라 조각마다 검사'
        )}
      </div>
    </>
  );
};

/** 8 예약 거둠(18.2~21.2초). */
const Pull: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 560 }}>
      <Plan p={1} pulled={ease(f, at('w6', '거두고') - 3, 7)} />
    </div>
  );
};

/** 9 다시 뽑은 판(21.2~25.3초) — 원본 비교 막대 자리: 다른 목소리로 다시 뽑은 같은 줄(실제 소리), 조각에 빨강 없음 → 0.0%. */
const Again: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.again, 7);
  const p = playP(f, clipAt('clean_long'), SOUND.clean_long.clipDur);
  const scan = interpolate(f, [clipAt('clean_long'), clipAt('clean_long') + 50], [0, 1], clamp);
  const zero = ease(f, clipAt('clean_long') + 56, 8);
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 400, opacity: a }}>
      <div style={{ padding: '24px 30px 26px', borderRadius: 30, background: PANEL, boxShadow: `inset 0 0 0 4px ${CLEAN}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: KO, fontWeight: 760, fontSize: 34, color: CLEAN }}>
          <span>다른 목소리로 다시 뽑은 판</span>
          <span style={{ color: TEXT }}>실제 소리</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <LongWave kind="clean" w={W - 60} h={130} p={p} />
        </div>
        <div style={{ marginTop: 14 }}>
          <Timeline kind="clean" w={W - 60} scan={scan} red={1} />
        </div>
      </div>
      <div style={{ marginTop: 34, textAlign: 'center', opacity: zero, transform: `scale(${1.2 - 0.2 * zero})`, fontFamily: KO, fontWeight: 800, fontSize: 64, color: CLEAN }}>
        빨간 조각 없음 · 깨짐 <span style={{ fontFamily: EN, fontSize: 96 }}>0.0%</span>
      </div>
    </div>
  );
};

/** 10 그대로 나감(25.3~28.3초): 두 판의 조각을 위아래로 — 위는 제 귀가 넘긴 판, 아래는 나간 판. */
const Out: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.out, 7);
  const b = ease(f, B.out + 10, 7);
  const ok = ease(f, B.out + 24, 8);
  const card = (p: number, kind: Kind, label: string, tag: string, color: string) => (
    <div style={{ marginTop: 26, opacity: p, padding: '20px 26px 10px', borderRadius: 26, background: PANEL, boxShadow: `inset 0 0 0 3px ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: KO, fontWeight: 780, fontSize: 36, color }}>
        <span>{label}</span>
        <span style={{ color: TEXT }}>{tag}</span>
      </div>
      <Timeline kind={kind} w={W - 52} scan={1} red={1} />
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 380 }}>
      {card(a, 'broken', '처음 판(예약했던)', '깨짐 20.8%', BAD)}
      {card(b, 'clean', '다시 뽑은 판', '깨짐 0.0%', CLEAN)}
      <div style={{ marginTop: 34, textAlign: 'center', opacity: ok, fontFamily: KO, fontWeight: 800, fontSize: 58, color: TEXT }}>
        <span style={{ color: CLEAN }}>✓</span> 이 판이 그대로 나갔어요
      </div>
    </div>
  );
};

/** 11 고르는 순서(28.3~33.3초) — 원본 「설치 = 명령 두 줄」 자리. */
const Steps: React.FC = () => {
  const f = useCurrentFrame();
  const head = ease(f, B.rule, 7);
  const s1 = ease(f, B.rule + 4, 8);
  const s2 = ease(f, at('w7', '숫자로') - 2, 8);
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
  const tag = ease(f, at('w8', '아래') - 2, 7);
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

/** 13 끝(35.5~38.8초): 이어폰으로 다시 — 36.85초 깨진 「turn!」, 37.85초 다시 뽑은 「turn!」이 울릴 때 그 줄이 켜진다. */
const End: React.FC = () => {
  const f = useCurrentFrame();
  const q = ease(f, B.end, 8);
  const cA = CLIPS[3].at;
  const cB = CLIPS[4].at;
  const row = (kind: Kind, color: string, ok: boolean, start: number, dur: number) => {
    const pl = playP(f, start, dur);
    const on = pl > 0 && pl < 1;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 24, opacity: 0.35 + 0.65 * Math.max(on ? 1 : 0, pl >= 1 ? 1 : 0), padding: '16px 24px', borderRadius: 24, background: PANEL, boxShadow: `inset 0 0 0 ${on ? 6 : 3}px ${color}` }}>
        <span style={{ flex: 'none', width: 70, height: 70, borderRadius: 35, background: color, color: NIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: EN, fontWeight: 900, fontSize: 42 }}>{ok ? '✓' : '✕'}</span>
        <ZoomLine kind={kind} span={0.45} w={W - 170} h={100} color={color} stroke={4} />
      </div>
    );
  };
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 400, fontFamily: KO }}>
      <div style={{ opacity: q, transform: `translateY(${(1 - q) * 30}px)`, textAlign: 'center', fontWeight: 800, fontSize: 76, lineHeight: 1.2, color: TEXT, letterSpacing: '-0.035em' }}>
        <span style={{ fontSize: 96 }}>🎧</span>
        <br />
        이어폰으로 다시 —
        <br />
        <span style={{ color: BAD }}>들리세요?</span>
      </div>
      <div style={{ marginTop: 34 }}>
        {row('broken', BAD, false, cA, SOUND.broken.clipDur)}
        {row('clean', CLEAN, true, cB, SOUND.clean.clipDur)}
      </div>
      <div style={{ marginTop: 34, textAlign: 'center', fontWeight: 700, fontSize: 38, color: MUTED, opacity: q }}>@yuhobuilds</div>
    </div>
  );
};

// ───────────── 머리글 · 자막 ─────────────
const HEADS: { a: number; b: number; text: React.ReactNode }[] = [
  { a: 0, b: B.reveal, text: '저녁에 나갈 영상의 한 줄' },
  { a: B.lens, b: B.run, text: '다시 들어 보면' },
  { a: B.pull, b: B.again, text: '그래서' },
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
  const reveal = f >= B.reveal && f < B.ear;
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
  { at: B.ear, src: 'sfx/tick.wav', v: 0.12 },
  { at: B.stake, src: 'sfx/tick2.wav', v: 0.12 },
  { at: B.lens - 1, src: 'sfx/swish.wav', v: 0.12 },
  { at: B.waves, src: 'sfx/snap.wav', v: 0.13 },
  { at: B.run, src: 'sfx/tick2.wav', v: 0.12 },
  { at: B.mark, src: 'sfx/thud.wav', v: 0.26 },
  { at: B.again, src: 'sfx/swish.wav', v: 0.12 },
  { at: B.out, src: 'sfx/tok.wav', v: 0.24 },
  { at: B.rule2, src: 'sfx/tick2.wav', v: 0.14 },
  { at: B.prompt, src: 'sfx/swish.wav', v: 0.13 },
  { at: B.end, src: 'sfx/tok.wav', v: 0.28 },
];

// ───────────── 본편 ─────────────
export const VoiceFilmV2: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const f0 = useCurrentFrame();
  void f0;
  const voice = ORDER.map((id) => [VO[id], lineEnd(id)] as [number, number]);
  const clips = CLIPS.map((c) => [c.at, c.at + Math.round(SOUND[c.kind].clipDur * 30)] as [number, number]);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (TOTAL - fr) / 15);
    const v = Math.max(0, ...voice.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    const c = Math.max(0, ...clips.map(([a, b]) => interpolate(fr, [a - 8, a, b, b + 8], [0, 1, 1, 0], clamp)));
    return (0.36 - 0.14 * v - 0.33 * c) * tail * MASTER; // 실제 소리 토막 동안은 배경음을 거의 뺀다(갈라짐이 들리게)
  };
  // 7.9 · 18.2초 장면 사이 「Plan」 카드 위치 다름 없음 — 18.2초는 같은 카드에 도장만 찍힌다
  void Stake;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 70% at 50% 42%, #18214A 0%, ${NIGHT} 62%)` }}>
      <Scene a={0} b={B.reveal}>
        <Hook />
      </Scene>
      <Scene a={B.reveal} b={B.ear} drift={0} zoom={0}>
        <Reveal />
      </Scene>
      <Scene a={B.ear} b={B.stake}>
        <Stake />
      </Scene>
      <Scene a={B.stake} b={B.lens}>
        <Versus />
      </Scene>
      <Scene a={B.lens} b={B.waves} drift={0} zoom={0}>
        <Lens />
      </Scene>
      <Scene a={B.waves} b={B.run} drift={0.12} zoom={0.0003}>
        <Waves />
      </Scene>
      <Scene a={B.run} b={B.pull}>
        <Run />
      </Scene>
      <Scene a={B.pull} b={B.again} drift={0.12} zoom={0.0004}>
        <Pull />
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
          <Audio src={staticFile(`vo2/${id}.wav`)} volume={MASTER} />
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

/** 표지: 4초 장면(머리글 + 깨진 파형 + 검사기 판정). */
export const CoverStillV2: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 70% at 50% 42%, #18214A 0%, ${NIGHT} 62%)` }}>
    <Header text="저녁에 나갈 영상의 한 줄" />
    <Sequence from={-F(4.3)} layout="none">
      <Hook />
    </Sequence>
  </AbsoluteFill>
);
