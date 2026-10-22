// yuhobuilds 「제가 나눠 드린 도구가 한 시간에 4.3GB를」(10-22 첫째 편). 기획·콘티는 ../../기획.md. 움직임 문법은 10-21 두 편(p1·p2)과 같다.
//  · 판(창) 자리는 한 편 내내 같고 내용은 컷. 판은 늘 천천히 밀린다(프레임마다 0.07%, 1.08에서 멈춤).
//  · 머리글은 줄 단위 올림 하나, 강조는 처음부터 칠한 낱말 하나(Type.tsx).
//  · 근거는 전부 실제: 공개 저장소 코드 두 판, 도구 기록 줄, 현장 노트 실측 값, 세션 기록 파일의 칸 이름·크기(data.ts).
//  · 폴더 격자·시간 막대는 다시 그린 그림이라 머리띠·판 아래 표시에 그렇게 적는다.
//  · 버터는 머리글 강조와 「복사」 한 뜻에만. 숫자 세기·튕김·흐림 전환·형광펜 없음.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, Cursor, DIM, INK, STAGE } from '../film/parts';
import { EN, KO, MONO } from '../lib/fonts';
import { bezier, clamp, mix } from '../lib/motion';
import { PAPER, RULE, UI_INK, UI_MUTED } from '../day1/parts';
import * as D from './data';
import { EndCard, END_FOLLOW } from './End';
import { at, lineEnd, ORDER, S, TOTAL, VO } from './time';
import { ease, EASE_MOVE, Line } from './Type';

// ───────────── 판(창) ─────────────
const VP = { x: 64, y: 600, w: 952, h: 680, r: 28 };
const W = VP.w;
const H = VP.h;
const BAR = 54;
const DARK = '#141412';
const TILE_BG = '#1E1D1A';
const TILE_EDGE = '#2E2D2A';

/** 지금 자리 표시: a에 6프레임 켜지고 b에 6프레임 꺼진다. */
const on = (f: number, a: number, b = Infinity) => ease(f, a, 6) * (b === Infinity ? 1 : 1 - ease(f, b, 6));
/** 지금 자리 테두리(글색). dark: 어두운 판 위. */
const Ring: React.FC<{ k: number; r: number; pad?: number; dark?: boolean }> = ({ k, r, pad = 0, dark }) => {
  if (k <= 0) return null;
  const c = dark ? '244,242,236' : '34,33,30';
  return <div style={{ position: 'absolute', inset: -pad, borderRadius: r + pad, background: `rgba(${c},${0.06 * k})`, boxShadow: `inset 0 0 0 3px rgba(${c},${k})`, pointerEvents: 'none' }} />;
};
const WinBar: React.FC<{ text: string; right?: string; dots?: boolean }> = ({ text, right, dots }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: BAR, background: '#1C1B19', borderBottom: '1px solid #2E2D2A' }}>
    {dots ? (
      [0, 1, 2].map((i) => <div key={i} style={{ position: 'absolute', left: 24 + i * 22, top: 21, width: 12, height: 12, borderRadius: 6, background: '#3E3C38' }} />)
    ) : (
      <div style={{ position: 'absolute', left: 24, top: 21, width: 12, height: 12, borderRadius: 6, background: '#5A5852' }} />
    )}
    <div style={{ position: 'absolute', left: dots ? 110 : 48, top: 0, lineHeight: `${BAR}px`, fontFamily: KO, fontWeight: 620, fontSize: 24, color: '#B6B3AB', whiteSpace: 'nowrap' }}>{text}</div>
    {right ? <div style={{ position: 'absolute', right: 24, top: 0, lineHeight: `${BAR}px`, fontFamily: KO, fontWeight: 560, fontSize: 21, color: '#8E8B84' }}>{right}</div> : null}
  </div>
);
const CardHead: React.FC<{ title: string; sub: string; right?: React.ReactNode }> = ({ title, sub, right }) => (
  <>
    <div style={{ position: 'absolute', left: 38, top: 32, fontFamily: KO, fontWeight: 760, fontSize: 38, color: UI_INK, letterSpacing: '-0.03em' }}>{title}</div>
    <div style={{ position: 'absolute', left: 40, top: 86, fontFamily: KO, fontWeight: 560, fontSize: 23, color: UI_MUTED }}>{sub}</div>
    {right}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 134, height: 1, background: RULE }} />
  </>
);

// ───────────── 폴더 격자(다시 그림) ─────────────
// 위: 지금 계정 폴더 한 칸. 아래: 짝 폴더 28칸(7×4). 지금 계정이 바뀔 때마다 28칸에 버터 테두리가 퍼진다.
const COLS = 7;
const GX0 = 32;
const GY0 = 196;
const TW = (W - GX0 * 2 - (COLS - 1) * 12) / COLS;
const TH = 62;
const tileXY = (j: number) => ({ x: GX0 + (j % COLS) * (TW + 12), y: GY0 + Math.floor(j / COLS) * (TH + 12) });
// 쉬게 된 짝: 로그인 기록 없는 13칸, 1~13초 스친 9칸, 남은 6칸(+ 지금 계정 = 7곳). 고르게 흩어 놓는다.
const REAL_IDX = [3, 8, 13, 15, 20, 26];
const PASS_IDX = [1, 5, 9, 11, 17, 19, 22, 24, 27];
const kindOf = (j: number) => (REAL_IDX.includes(j) ? 'real' : PASS_IDX.includes(j) ? 'pass' : 'never');

type GridMode = { pulseEvery: number; pulseFrom: number; pulseTo: number; neverAt?: number; passAt?: number; realAt?: number };
const pulseLevel = (f: number, j: number, m: GridMode, alive: boolean) => {
  if (!alive || f < m.pulseFrom || f > m.pulseTo + 10) return 0;
  const delay = 1 + Math.floor(j / COLS); // 줄마다 1프레임씩 늦게
  const local = f - m.pulseFrom - delay;
  if (local < 0) return 0;
  const since = local % m.pulseEvery;
  const pulseStart = f - since;
  if (pulseStart > m.pulseTo) return 0;
  return Math.max(0, 1 - since / Math.max(3, Math.min(4, m.pulseEvery - 1)));
};
const Folder: React.FC<{ color: string; size?: number }> = ({ color, size = 26 }) => (
  <svg width={size} height={size * 0.8} viewBox="0 0 30 24">
    <path d="M2 5 Q2 3 4 3 L11 3 L14 6 L26 6 Q28 6 28 8 L28 20 Q28 22 26 22 L4 22 Q2 22 2 20 Z" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
  </svg>
);
const Grid: React.FC<{ f: number; m: GridMode; bar: string; band: React.ReactNode }> = ({ f, m, bar, band }) => {
  const srcFlash = f >= m.pulseFrom && f <= m.pulseTo ? Math.max(0, 1 - ((f - m.pulseFrom) % m.pulseEvery) / 4) : 0;
  const neverK = m.neverAt === undefined ? 0 : ease(f, m.neverAt, 10);
  const passK = m.passAt === undefined ? 0 : ease(f, m.passAt, 10);
  const realK = m.realAt === undefined ? 0 : on(f, m.realAt - 2);
  return (
    <>
      <WinBar text={bar} />
      {/* 지금 계정 폴더 */}
      <div style={{ position: 'absolute', left: W / 2 - 170, top: 82, width: 340, height: 74, borderRadius: 16, background: '#2A2925', boxShadow: `inset 0 0 0 2px rgba(244,242,236,${0.25 + 0.6 * srcFlash})`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <Folder color={INK} size={34} />
        <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 28, color: INK }}>지금 계정 폴더</span>
        <Ring k={realK} r={16} pad={6} dark />
      </div>
      <div style={{ position: 'absolute', left: W / 2 - 1, top: 158, width: 2, height: 30, background: '#3A3934' }} />
      {Array.from({ length: 28 }, (_, j) => {
        const { x, y } = tileXY(j);
        const kind = kindOf(j);
        const off = kind === 'never' ? neverK : kind === 'pass' ? passK : 0;
        const lit = pulseLevel(f, j, m, off < 0.5);
        return (
          <div key={j} style={{ position: 'absolute', left: x, top: y, width: TW, height: TH, borderRadius: 12, background: TILE_BG, boxShadow: `inset 0 0 0 ${lit > 0 ? 3 : 1.5}px ${lit > 0 ? `rgba(245,196,69,${0.25 + 0.75 * lit})` : TILE_EDGE}`, opacity: 1 - 0.72 * off, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Folder color={lit > 0.3 ? BUTTER : '#8E8B84'} />
            {kind === 'real' ? <Ring k={realK} r={12} pad={4} dark /> : null}
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 0, right: 0, top: GY0 + 4 * (TH + 12) + 6, bottom: 0, background: DARK, borderTop: '1px solid #2A2926' }}>{band}</div>
    </>
  );
};
const Stat: React.FC<{ label: string; value: string; unit?: string; left: number; k?: number; dim?: boolean }> = ({ label, value, unit, left, k = 0, dim }) => (
  <div style={{ position: 'absolute', left, top: 22, padding: '4px 12px', margin: '-4px -12px' }}>
    <Ring k={k} r={12} dark />
    <div style={{ fontFamily: KO, fontWeight: 600, fontSize: 23, color: '#8E8B84' }}>{label}</div>
    <div style={{ marginTop: 6, fontFamily: EN, fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em', color: dim ? '#8E8B84' : INK }}>
      {value}
      {unit ? <span style={{ fontFamily: KO, fontWeight: 650, fontSize: 28, marginLeft: 6, color: '#B6B3AB' }}>{unit}</span> : null}
    </div>
  </div>
);

/** 1. 훅: 바뀔 때마다 28칸으로 퍼짐 · 쓴 양. */
const HookGrid: React.FC<{ f: number }> = ({ f }) => (
  <Grid
    f={f}
    m={{ pulseEvery: 6, pulseFrom: 4, pulseTo: VO.h2 - 4 }}
    bar="세션 공유 도구 · 제 PC 폴더 29곳 · 바쁠 때 4분(다시 그림)"
    band={
      <>
        <Stat label="디스크에 쓴 양 · 1시간 꼴" value="4,279" unit="MB" left={40} />
        <Stat label="CPU 코어 하나" value="23.6" unit="%" left={380} />
        <Stat label="상태 파일" value="328" unit="번/시간" left={600} />
      </>
    }
  />
);

/** 2. 약속. */
const PROMISE = [
  { t: '어디서 샜나', s: '0.15초 · 28곳 · 통째로' },
  { t: '고친 셋', s: '5분씩 모으기 · 로그아웃 때 바로 · 쉬게' },
  { t: '내 PC에서 찾기', s: '작업 관리자 한 칸' },
] as const;
const PromiseCard: React.FC<{ f: number }> = ({ f }) => {
  const k = on(f, at('h2', '드릴') - 2);
  return (
    <>
      <CardHead title="이번 편" sub="끝에 드리는 것까지" />
      <div style={{ position: 'absolute', left: 16, right: 16, top: 150 + 2 * 150, height: 140 }}>
        <Ring k={k} r={18} />
      </div>
      {PROMISE.map((p, i) => (
        <div key={i} style={{ position: 'absolute', left: 40, right: 40, top: 168 + i * 150, height: 130, opacity: ease(f, VO.h2 + 4 + i * 5, 8), transform: `translateY(${(1 - ease(f, VO.h2 + 4 + i * 5, 8)) * 14}px)` }}>
          <div style={{ fontFamily: KO, fontWeight: 740, fontSize: 40, color: UI_INK, letterSpacing: '-0.02em' }}>{p.t}</div>
          <div style={{ marginTop: 10, fontFamily: KO, fontWeight: 560, fontSize: 27, color: UI_MUTED, filter: 'blur(7px)', opacity: 0.8, whiteSpace: 'nowrap' }}>{p.s}</div>
          {i < 2 ? <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: RULE }} /> : null}
        </div>
      ))}
    </>
  );
};

/** 3. 고치기 전 코드 두 줄 → 실제 기록 줄이 하나씩. */
const CodeLine: React.FC<{ n: number; t: string; top: number; o: number; dy?: number; ring?: [string, number] }> = ({ n, t, top, o, dy = 0, ring }) => {
  const k = ring ? t.indexOf(ring[0]) : -1;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, height: 40, opacity: o, transform: dy ? `translateY(${dy}px)` : undefined, fontFamily: MONO, fontSize: 23, lineHeight: '40px', whiteSpace: 'pre', color: '#D9D6CE' }}>
      <span style={{ display: 'inline-block', width: 84, textAlign: 'right', paddingRight: 18, color: '#5E5C56' }}>{n || ''}</span>
      {ring && k >= 0 ? (
        <>
          {t.slice(0, k)}
          <span style={{ position: 'relative', padding: '0 4px', margin: '0 -4px' }}>
            <Ring k={ring[1]} r={6} dark />
            {ring[0]}
          </span>
          {t.slice(k + ring[0].length)}
        </>
      ) : (
        t
      )}
    </div>
  );
};
const LogRows: React.FC<{ f: number; rows: readonly { t: string; m: string }[]; startAt: number; step: number; top: number; ring?: [number, string, number]; size?: number }> = ({ f, rows, startAt, step, top, ring, size = 23 }) => (
  <>
    {rows.map((r, i) => {
      const a = startAt + i * step;
      if (f < a) return null;
      const p = ease(f, a, 6);
      const isRing = ring && ring[0] === i;
      const k = isRing ? r.m.indexOf(ring![1]) : -1;
      return (
        <div key={i} style={{ position: 'absolute', left: 32, right: 24, top: top + i * (size + 22), fontFamily: MONO, fontSize: size, lineHeight: `${size + 14}px`, whiteSpace: 'nowrap', color: '#D9D6CE', opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
          <span style={{ color: '#8E8B84', marginRight: 18 }}>{r.t}</span>
          {isRing && k >= 0 ? (
            <>
              <span style={{ fontFamily: KO, fontWeight: 560 }}>{r.m.slice(0, k)}</span>
              <span style={{ position: 'relative', fontFamily: KO, fontWeight: 650, padding: '0 6px', margin: '0 -6px', color: INK }}>
                <Ring k={ring![2]} r={8} dark />
                {ring![1]}
              </span>
              <span style={{ fontFamily: KO, fontWeight: 560 }}>{r.m.slice(k + ring![1].length)}</span>
            </>
          ) : (
            <span style={{ fontFamily: KO, fontWeight: 560 }}>{r.m}</span>
          )}
        </div>
      );
    })}
  </>
);
const CodeBefore: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const k150 = on(f, at('b1', '영') - 2, at('b1', '스물') - 4);
  const k28 = on(f, at('b1', '스물') - 2);
  const logAt = sceneStart + 26; // 2차 렌더에서 8~10초가 거의 멈춤 — 코드 줄은 8프레임씩, 기록 줄은 곧바로 이어 들어온다
  return (
    <>
      <WinBar text="claude-session-share.mjs · 고치기 전 판" dots />
      <div style={{ position: 'absolute', left: 0, right: 0, top: BAR + 18 }}>
        {D.CODE_BEFORE.map((c, i) => (
          <CodeLine key={i} n={c.n} t={c.t} top={i * 42 + (i > 0 ? 14 : 0)} o={ease(f, sceneStart + 2 + i * 8, 6)} dy={(1 - ease(f, sceneStart + 2 + i * 8, 8)) * 16} ring={i === 0 ? ['150', k150] : undefined} />
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 268, bottom: 0, background: '#11110F', borderTop: '1px solid #2A2926', transform: `translateY(${(1 - ease(f, sceneStart + 16, 12)) * 420}px)` }}>
        <div style={{ position: 'absolute', left: 32, top: 18, fontFamily: KO, fontWeight: 620, fontSize: 22, color: '#8E8B84' }}>도구 기록 · 10월 20일 밤(세션 파일 이름은 자름)</div>
        <LogRows f={f} rows={D.LOG_BEFORE} startAt={logAt} step={7} top={62} ring={[2, '28개 복사', k28]} />
      </div>
    </>
  );
};

/** 4. 세션 기록 파일 한 장: 바뀌는 건 시각 두 칸, 다시 쓰는 건 110KB. */
const RecordCard: React.FC<{ f: number }> = ({ f }) => {
  const flipAt = at('b2', '오갈') - 2;
  const wholeK = on(f, at('b2', '통째') - 2);
  // 값은 그리지 않는다(회색 막대) — 칸 이름과 크기만 실제. 바뀌는 칸은 「오갈」·「다시」에 막대가 한 번씩 새로 그어진다.
  const flash = (i: number) => Math.max(on(f, flipAt + i * 3, flipAt + i * 3 + 8), on(f, at('b2', '다시') + i * 3, at('b2', '다시') + i * 3 + 8));
  const rows: { k: string; w: number; changing?: boolean }[] = [
    { k: 'title', w: 240 },
    { k: 'model', w: 150 },
    { k: D.RECORD.changing[0], w: 170, changing: true },
    { k: D.RECORD.changing[1], w: 170, changing: true },
  ];
  const total = D.RECORD.bytes;
  const toolsShare = D.RECORD.toolsBytes / total;
  const gw = W - 80;
  return (
    <>
      <CardHead title="세션 기록 파일 한 개" sub="10월 22일 이 PC · 칸 이름과 크기만" right={<div style={{ position: 'absolute', right: 40, top: 40, fontFamily: EN, fontWeight: 700, fontSize: 34, color: UI_INK }}>113KB</div>} />
      <div style={{ position: 'absolute', left: 32, right: 32, top: 156, height: 300, borderRadius: 18, background: '#FFFFFF', boxShadow: `inset 0 0 0 1.5px ${RULE}` }}>
        <Ring k={wholeK} r={18} pad={4} />
        <div style={{ position: 'absolute', left: 26, top: 18, fontFamily: MONO, fontSize: 23, color: UI_MUTED, whiteSpace: 'nowrap' }}>
          local_<span style={{ display: 'inline-block', width: 150, height: 16, borderRadius: 8, background: '#E2DFD7', verticalAlign: 'middle' }} />.json
        </div>
        {rows.map((r, i) => {
          const k = r.changing ? flash(i - 2) : 0;
          return (
            <div key={r.k} style={{ position: 'absolute', left: 26, right: 26, top: 66 + i * 50, height: 44, borderRadius: 10, background: `rgba(34,33,30,${0.07 * k})`, fontFamily: MONO, fontSize: 24, lineHeight: '44px', color: UI_INK, whiteSpace: 'nowrap' }}>
              <span style={{ marginLeft: 8 }}>"{r.k}":</span>
              <span style={{ display: 'inline-block', marginLeft: 16, width: r.w, height: 16, borderRadius: 8, background: k > 0.5 ? UI_INK : '#E2DFD7', verticalAlign: 'middle' }} />
              {r.changing ? <span style={{ position: 'absolute', right: 8, fontFamily: KO, fontWeight: 650, fontSize: 21, color: UI_MUTED }}>차례마다 바뀜</span> : null}
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: 34, top: 270, fontFamily: MONO, fontSize: 22, color: UI_MUTED }}>…</div>
      </div>
      {/* 파일을 바이트로: 도구 목록 칸이 91% */}
      <div style={{ position: 'absolute', left: 40, top: 486, width: gw, height: 56, borderRadius: 12, background: '#ECEAE4', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: gw * toolsShare * ease(f, at('b2', '기록') - 4, 14), background: '#CFCBC2' }} />
        <div style={{ position: 'absolute', left: 18, top: 0, lineHeight: '56px', fontFamily: MONO, fontSize: 22, color: UI_INK, whiteSpace: 'nowrap' }}>"{D.RECORD.toolsKey}" · 102KB · 안 바뀜</div>
      </div>
      <div style={{ position: 'absolute', left: 40, top: 556, fontFamily: KO, fontWeight: 600, fontSize: 25, color: UI_INK }}>바뀌는 건 시각 몇 글자, 다시 쓰는 건 파일 통째(113KB)</div>
    </>
  );
};

/** 5. 격자 다시: 더 촘촘히 · 한 시간 복사 수. */
const CopyGrid: React.FC<{ f: number }> = ({ f }) => {
  const k = on(f, at('b3', '삼만') - 2);
  return (
    <Grid
      f={f}
      m={{ pulseEvery: 4, pulseFrom: VO.b3 - 2, pulseTo: lineEnd('b3') + 4 }}
      bar="제 PC · 바쁠 때 4분 잰 값을 1시간으로(다시 그림)"
      band={
        <>
          <Stat label="복사" value="34,664" unit="번/시간" left={40} k={k} />
          <Stat label="상태 파일 다시 쓰기" value="328" unit="번/시간" left={540} />
        </>
      }
    />
  );
};

/** 6. 앱이 목록을 읽는 때: 로그인 두 번, 그 사이 복사는 회색 눈금. */
const TICKS = 220;
const Timeline: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const gw = W - 96;
  const x0 = 48;
  const draw = ease(f, sceneStart + 2, 26);
  const pinK = on(f, at('b4', '로그인') - 2);
  const pins = [
    { x: 0.02, t: '로그인' },
    { x: 0.64, t: '계정 바꿈 · 로그인' },
  ];
  return (
    <>
      <CardHead title="앱이 목록을 읽는 때" sub="한 시간을 한 줄로 · 다시 그림" />
      <div style={{ position: 'absolute', left: x0, top: 196, fontFamily: KO, fontWeight: 650, fontSize: 24, color: UI_MUTED }}>도구가 옮긴 복사</div>
      <div style={{ position: 'absolute', left: x0, top: 236, width: gw, height: 90 }}>
        {Array.from({ length: TICKS }, (_, i) => {
          const x = (i / (TICKS - 1)) * gw;
          if (i / TICKS > draw) return null;
          const h = 40 + ((i * 37) % 50);
          return <div key={i} style={{ position: 'absolute', left: x, bottom: 0, width: 2, height: h, background: '#CFCBC2' }} />;
        })}
      </div>
      <div style={{ position: 'absolute', left: x0, top: 340, width: gw, height: 3, background: UI_INK }} />
      {pins.map((p, i) => (
        <div key={i} style={{ position: 'absolute', left: x0 + p.x * gw - 2, top: 360, width: 260, opacity: ease(f, sceneStart + 8 + i * 8, 8) }}>
          <div style={{ position: 'absolute', left: 0, top: -36, width: 6, height: 52, borderRadius: 3, background: UI_INK }} />
          <div style={{ position: 'absolute', left: -12, top: 28, padding: '6px 12px', fontFamily: KO, fontWeight: 700, fontSize: 25, color: UI_INK, whiteSpace: 'nowrap' }}>
            <Ring k={pinK} r={10} />
            {p.t} · 목록 읽음
          </div>
        </div>
      ))}
      <div style={{ position: 'absolute', left: x0, top: 476, right: 48, fontFamily: KO, fontWeight: 600, fontSize: 25, lineHeight: 1.45, color: UI_INK, opacity: ease(f, at('b4', '읽더') - 4, 10) }}>
        그 사이 복사 34,664번은 앱이 읽지 않았어요
      </div>
      <div style={{ position: 'absolute', left: x0, top: 530, fontFamily: KO, fontWeight: 560, fontSize: 22, color: UI_MUTED, opacity: ease(f, at('b4', '읽더') + 2, 10) }}>앱은 로그인할 때 폴더를 읽는다(도구를 고치며 확인)</div>
    </>
  );
};

/** 7. 고친 판 코드 한 줄 + 30분 띠: 바뀜은 그대로, 옮김은 5분마다. */
const Batch: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const k5 = on(f, at('f1', '오') - 2);
  const gw = W - 96;
  const x0 = 48;
  // 재생 위치가 장면 내내 30분 띠를 지나간다(1차 렌더에서 띠가 다 그려진 뒤 3.5초 멈춤으로 잡혀 바꿈)
  const sweepEnd = lineEnd('f1') + 4;
  const draw = interpolate(f, [sceneStart + 6, sweepEnd], [0, 1], clamp);
  const marks = [5, 10, 15, 20, 25, 30];
  return (
    <>
      <WinBar text="claude-session-share.mjs · 고친 판" dots />
      <div style={{ position: 'absolute', left: 0, right: 0, top: BAR + 18 }}>
        {D.CODE_AFTER.map((c, i) => (
          <CodeLine key={i} n={c.n} t={c.t} top={i * 42} o={ease(f, sceneStart + 2 + i * 3, 6)} ring={i === 1 ? ['300000', k5] : undefined} />
        ))}
      </div>
      <div style={{ position: 'absolute', left: 102, top: 166, fontFamily: KO, fontWeight: 560, fontSize: 22, color: '#8E8B84' }}>300000밀리초 = 5분</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 214, bottom: 0, background: '#11110F', borderTop: '1px solid #2A2926' }}>
        <div style={{ position: 'absolute', left: x0, top: 30, fontFamily: KO, fontWeight: 620, fontSize: 23, color: '#B6B3AB' }}>기록이 바뀜</div>
        <div style={{ position: 'absolute', left: x0, top: 70, width: gw, height: 60 }}>
          {Array.from({ length: 160 }, (_, i) => {
            if (i / 160 > draw) return null;
            return <div key={i} style={{ position: 'absolute', left: (i / 159) * gw, bottom: 0, width: 3, height: 24 + ((i * 29) % 36), background: '#6A6862' }} />;
          })}
        </div>
        <div style={{ position: 'absolute', left: x0, top: 170, fontFamily: KO, fontWeight: 620, fontSize: 23, color: '#B6B3AB' }}>도구가 옮김</div>
        <div style={{ position: 'absolute', left: x0, top: 222, width: gw, height: 3, background: '#3A3934' }} />
        <div style={{ position: 'absolute', left: x0 + draw * gw - 3, top: 56, width: 6, height: 230, borderRadius: 3, background: '#D9D6CE', opacity: draw < 1 ? 0.9 : 0 }} />
        <div style={{ position: 'absolute', left: Math.max(x0 - 12, x0 + draw * gw - 64), top: 290, width: 128, textAlign: 'center', padding: '4px 0', borderRadius: 10, background: '#D9D6CE', color: '#141412', fontFamily: KO, fontWeight: 700, fontSize: 20, opacity: draw < 1 ? 1 : 0 }}>모으는 중</div>
        {marks.map((m, i) => {
          const x = x0 + (m / 30) * gw;
          const a = sceneStart + 6 + Math.round((m / 30) * (sweepEnd - sceneStart - 6));
          const p = ease(f, a, 6);
          return (
            <div key={m} style={{ position: 'absolute', left: x - 12, top: 211, width: 24, height: 24, borderRadius: 12, background: BUTTER, opacity: p, transform: `scale(${0.6 + 0.4 * p})` }}>
              {i === 0 ? (
                <div style={{ position: 'absolute', left: -14, top: -14, width: 52, height: 52 }}>
                  <Ring k={k5} r={26} dark />
                </div>
              ) : null}
            </div>
          );
        })}
        {[0, 10, 20, 30].map((m) => (
          <div key={m} style={{ position: 'absolute', left: x0 + (m / 30) * gw - 30, top: 256, width: 60, textAlign: 'center', fontFamily: EN, fontWeight: 600, fontSize: 21, color: '#8E8B84' }}>
            {m}분
          </div>
        ))}
        <div style={{ position: 'absolute', left: x0, top: 356, fontFamily: KO, fontWeight: 560, fontSize: 22, color: '#8E8B84' }}>새 파일·지운 파일은 지금도 바로 옮겨요</div>
      </div>
    </>
  );
};

/** 8. 로그아웃이 보이면 바로: 실제 기록 두 줄, 0.13초. */
const Logout: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const a = at('f2', '로그아웃') - 2;
  const kNow = on(f, at('f2', '바로') - 2);
  // 로그아웃 전에는 모으는 띠가 차고, 맞춘 뒤에는 다음 계정이 읽은 세션 54개가 차례로 찬다(1차 렌더에서 2.5초 멈춤으로 잡혀 더함)
  const gather = interpolate(f, [sceneStart, a], [0, 0.8], clamp);
  const readFrom = a + 12;
  const readTo = Math.max(readFrom + 20, lineEnd('f2') + 6);
  const nRead = Math.floor(interpolate(f, [readFrom, readTo], [0, 54], clamp));
  return (
    <>
      <WinBar text="도구 기록 · 10월 21일 00:10 · 실제 계정을 바꿀 때" dots />
      <div style={{ position: 'absolute', left: 32, top: BAR + 26, fontFamily: KO, fontWeight: 560, fontSize: 22, color: '#5E5C56', opacity: ease(f, sceneStart + 2, 6) }}>5분 모으는 중</div>
      <div style={{ position: 'absolute', left: 190, right: 32, top: BAR + 30, height: 20, borderRadius: 6, background: '#2A2926' }}>
        <div style={{ width: `${(f < a ? gather : 1) * 100}%`, height: 20, borderRadius: 6, background: f < a ? '#6A6862' : '#D9D6CE' }} />
      </div>
      <div style={{ position: 'absolute', left: 32, right: 32, top: BAR + 470, opacity: ease(f, readFrom - 4, 6) }}>
        <div style={{ fontFamily: KO, fontWeight: 620, fontSize: 22, color: '#8E8B84', marginBottom: 12 }}>다음 계정이 읽은 세션 54개</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Array.from({ length: 54 }, (_, i) => (
            <div key={i} style={{ width: 25, height: 16, borderRadius: 3, background: i < nRead ? '#D9D6CE' : '#262521' }} />
          ))}
        </div>
      </div>
      <LogRows f={f} rows={D.LOG_AFTER} startAt={a} step={4} top={BAR + 96} size={25} />
      <div style={{ position: 'absolute', left: 40, top: BAR + 250, width: 260, height: 86, opacity: ease(f, a + 6, 6) }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 3, height: 86, background: '#5E5C56' }} />
        <div style={{ position: 'absolute', left: 22, top: 18, padding: '4px 12px', fontFamily: EN, fontWeight: 700, fontSize: 40, color: INK }}>
          <Ring k={kNow} r={10} dark />
          0.13초
        </div>
      </div>
      <div style={{ position: 'absolute', left: 330, top: BAR + 270, right: 32, fontFamily: KO, fontWeight: 600, fontSize: 25, lineHeight: 1.4, color: '#B6B3AB', wordBreak: 'keep-all', opacity: ease(f, a + 10, 8) }}>
        로그아웃 줄을 보자마자 7곳을 맞춤 — 다음 계정이 세션 54개를 읽음
      </div>
    </>
  );
};

/** 9. 쉬게: 13칸 · 9칸이 꺼지고 7곳만. */
const ParkGrid: React.FC<{ f: number }> = ({ f }) => {
  const neverAt = at('f3', '안') - 2;
  const passAt = at('f3', '쉬게') + 4;
  const realAt = at('f3', '일곱');
  const chip = (t: string, a: number, left: number, strong?: boolean) => (
    <div style={{ position: 'absolute', left, top: 30, padding: '10px 18px', borderRadius: 14, background: strong ? INK : '#2A2925', color: strong ? '#141412' : '#D9D6CE', fontFamily: KO, fontWeight: 700, fontSize: 25, whiteSpace: 'nowrap', opacity: ease(f, a, 8), transform: `translateY(${(1 - ease(f, a, 8)) * 10}px)` }}>{t}</div>
  );
  return (
    <Grid
      f={f}
      m={{ pulseEvery: 9, pulseFrom: VO.f3 - 2, pulseTo: lineEnd('f3') + 6, neverAt, passAt, realAt }}
      bar="짝 폴더 28곳 · 로그인 기록으로 가름(다시 그림)"
      band={
        <>
          {chip(`로그인 기록 없음 ${D.NEVER}`, neverAt, 32)}
          {chip(`1~13초 스친 짝 ${D.PASSING}`, passAt, 318)}
          {chip(`진짜 ${D.REAL}곳`, realAt, 640, true)}
          <div style={{ position: 'absolute', left: 32, top: 100, fontFamily: KO, fontWeight: 560, fontSize: 21, color: '#8E8B84' }}>쉬는 폴더는 지우지 않고 백업 폴더로 옮겨 둠</div>
        </>
      }
    />
  );
};

/** 10. 시간당 쓴 양: 막대 셋 · CPU. */
const Bars: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const k = on(f, at('b5', '구십') - 2);
  const gw = W - 80 - 220;
  const rows = [
    { t: '고치기 전', s: '바쁠 때 4분', v: D.BEFORE.mbPerHour, cpu: D.BEFORE.cpu },
    { t: '첫 고침', s: '1분씩 모음 · 45분', v: D.V3.mbPerHour, cpu: D.V3.cpu },
    { t: '지금 판', s: '5분씩 모음 · 30분', v: D.V31.mbPerHour, cpu: D.V31.cpu },
  ];
  return (
    <>
      <CardHead title="디스크에 쓴 양 · 1시간 꼴" sub="같은 방법 · 4분 / 45분 / 30분 잰 값을 1시간으로" />
      {rows.map((r, i) => {
        const a = sceneStart + 4 + i * 6;
        const p = ease(f, a, 14);
        const top = 168 + i * 120;
        return (
          <div key={i} style={{ position: 'absolute', left: 40, top, width: W - 80, height: 100, opacity: ease(f, a, 6) }}>
            <div style={{ position: 'absolute', left: 0, top: 6, fontFamily: KO, fontWeight: 740, fontSize: 30, color: UI_INK }}>{r.t}</div>
            <div style={{ position: 'absolute', left: 0, top: 50, fontFamily: KO, fontWeight: 560, fontSize: 21, color: UI_MUTED }}>{r.s}</div>
            <div style={{ position: 'absolute', left: 200, top: 8, width: Math.max(6, gw * (r.v / D.BEFORE.mbPerHour) * p), height: 44, borderRadius: 8, background: i === 2 ? UI_INK : '#CFCBC2' }} />
            <div style={{ position: 'absolute', left: 200 + Math.max(6, gw * (r.v / D.BEFORE.mbPerHour)) + 14, top: 4, padding: '2px 10px', margin: '-2px -10px', fontFamily: EN, fontWeight: 700, fontSize: 36, color: UI_INK, whiteSpace: 'nowrap', opacity: ease(f, a + 6, 6), ...(i === 0 ? { left: 200 + gw - 190, color: '#141412' } : {}) }}>
              {i === 2 ? <Ring k={k} r={10} /> : null}
              {r.v.toLocaleString('en-US')}MB
            </div>
            <div style={{ position: 'absolute', left: 200, top: 62, fontFamily: KO, fontWeight: 600, fontSize: 22, color: UI_MUTED }}>CPU 코어 하나 {r.cpu}%</div>
          </div>
        );
      })}
    </>
  );
};

/** 11. 내 PC에서 찾기: 작업 관리자 메뉴 이름 그대로. */
const STEPS = [
  { k: 'Ctrl + Shift + Esc', t: '작업 관리자 열기', word: '작업' },
  { k: '세부 정보', t: '왼쪽 메뉴에서', word: '세부' },
  { k: '열 선택', t: '열 이름 줄을 오른쪽 클릭', word: '아이오' },
  { k: 'I/O 쓰기 바이트', t: '체크해서 켜기', word: '켜' },
  { k: '큰 순서로', t: '그 열을 눌러 두고, 빨리 느는 줄', word: '빨리' },
] as const;
const CHECK_XY: [number, number] = [72, 168 + 3 * 82 + 30];
const TaskCard: React.FC<{ f: number }> = ({ f }) => {
  const checkAt = at('c0', '켜');
  const checked = f >= checkAt;
  return (
    <>
      <CardHead title="내 PC에서 찾기" sub="Windows 작업 관리자 · 메뉴 이름 그대로" />
      {STEPS.map((s, i) => {
        const a = s.word ? at('c0', s.word) - 6 : checkAt + 10;
        const p = ease(f, Math.min(a, VO.c0 + 4 + i * 30), 8);
        const top = 160 + i * 82;
        const isCheck = i === 3;
        return (
          <div key={i} style={{ position: 'absolute', left: 40, right: 40, top, height: 70, opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
            <div style={{ position: 'absolute', left: 0, top: 14, width: 44, height: 44, borderRadius: isCheck ? 8 : 22, background: isCheck ? (checked ? UI_INK : '#FFFFFF') : '#ECEAE4', boxShadow: isCheck && !checked ? `inset 0 0 0 2.5px ${UI_INK}` : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: EN, fontWeight: 700, fontSize: 24, color: UI_INK }}>
              {isCheck ? (
                checked ? (
                  <svg width={26} height={20} viewBox="0 0 26 20">
                    <path d="M3 10 L10 17 L23 3" fill="none" stroke="#FFFFFF" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null
              ) : (
                i + 1
              )}
            </div>
            <div style={{ position: 'absolute', left: 66, top: 8, fontFamily: KO, fontWeight: 760, fontSize: 32, color: UI_INK, whiteSpace: 'nowrap' }}>
              {s.k.startsWith('Ctrl') ? <span style={{ fontFamily: EN }}>{s.k}</span> : `「${s.k}」`}
              <span style={{ marginLeft: 16, fontWeight: 560, fontSize: 24, color: UI_MUTED }}>{s.t}</span>
            </div>
            {i < STEPS.length - 1 ? <div style={{ position: 'absolute', left: 66, right: 0, bottom: -6, height: 1, background: RULE }} /> : null}
          </div>
        );
      })}
    </>
  );
};
const CursorLayer: React.FC<{ f: number; target: [number, number]; pressAt: number; from: [number, number] }> = ({ f, target, pressAt, from }) => {
  const s0 = pressAt - 17;
  if (f < s0 - 4 || f > pressAt + 16) return null;
  const t = ease(f, s0, pressAt - 1 - s0, EASE_MOVE);
  const mid: [number, number] = [mix(from[0], target[0], 0.5) + 70, mix(from[1], target[1], 0.5) - 40];
  const [cx, cy] = bezier(from, mid, target, t);
  const press = interpolate(f, [pressAt - 2, pressAt, pressAt + 4], [0, 1, 0], clamp);
  const o = ease(f, s0 - 4, 5) * (1 - ease(f, pressAt + 8, 6));
  const r = interpolate(f, [pressAt, pressAt + 12], [0, 1], clamp);
  return <Cursor x={cx} y={cy} press={press} ring={r} opacity={o} />;
};

/** 12. 설치 한 줄을 다시: PowerShell. */
const TYPE_CPS = 2.2;
const Install: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const n = Math.max(0, Math.min(D.INSTALL.length, Math.floor((f - sceneStart - 4) * TYPE_CPS)));
  const doneAt = sceneStart + 4 + Math.ceil(D.INSTALL.length / TYPE_CPS);
  const kLine = on(f, at('cta', '한') - 2);
  return (
    <>
      <WinBar text="PowerShell · 도구를 받은 PC에서" dots />
      <div style={{ position: 'absolute', left: 32, right: 32, top: BAR + 30, padding: '10px 14px', margin: '-10px -14px', fontFamily: MONO, fontSize: 26, lineHeight: 1.6, color: '#D9D6CE', wordBreak: 'break-all', transform: `translateY(${(1 - ease(f, sceneStart, 10)) * 140}px)` }}>
        <Ring k={kLine} r={10} dark />
        <span style={{ color: '#8E8B84' }}>PS&gt; </span>
        {D.INSTALL.slice(0, n)}
        {n < D.INSTALL.length ? <span style={{ display: 'inline-block', width: 13, height: 28, background: '#D9D6CE', verticalAlign: 'middle', marginLeft: 2 }} /> : null}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ position: 'absolute', left: 32, top: BAR + 210 + i * 40, width: [520, 610, 450, 580][i], height: 22, borderRadius: 8, background: '#3A3934', opacity: ease(f, doneAt + 2 + i * 2, 4) }} />
      ))}
      <div style={{ position: 'absolute', left: 32, top: BAR + 380, fontFamily: KO, fontWeight: 700, fontSize: 32, color: INK, opacity: ease(f, doneAt + 10, 4), transform: `translateY(${(1 - ease(f, doneAt + 10, 8)) * 30}px)` }}>업데이트했습니다.</div>
      <div style={{ position: 'absolute', left: 32, top: BAR + 450, right: 32, fontFamily: KO, fontWeight: 560, fontSize: 22, color: '#8E8B84', opacity: ease(f, doneAt + 22, 8) }}>설치 줄과 같은 줄 — 다시 붙여 넣으면 새 판으로 바뀜</div>
    </>
  );
};

/** 13. 댓글로: 내 PC 「I/O 쓰기 바이트」 1·2·3등은? */
const Ask: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const kC = on(f, at('q', '댓글') - 2);
  return (
    <>
      <CardHead title="여러분 PC의 1등은?" sub="「I/O 쓰기 바이트」 큰 순서" />
      {[0, 1, 2].map((i) => {
        const p = ease(f, sceneStart + 4 + i * 5, 8);
        return (
          <div key={i} style={{ position: 'absolute', left: 40, right: 40, top: 166 + i * 92, height: 76, borderRadius: 16, background: '#FFFFFF', boxShadow: `inset 0 0 0 1.5px ${RULE}`, opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
            <div style={{ position: 'absolute', left: 24, top: 0, lineHeight: '76px', fontFamily: EN, fontWeight: 700, fontSize: 32, color: UI_INK }}>{i + 1}</div>
            <div style={{ position: 'absolute', left: 80, top: 28, width: [300, 240, 270][i], height: 20, borderRadius: 10, background: '#ECEAE4' }} />
            <div style={{ position: 'absolute', right: 26, top: 0, lineHeight: '76px', fontFamily: EN, fontWeight: 700, fontSize: 32, color: UI_MUTED }}>?</div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 32, right: 32, top: 460, height: 84, borderRadius: 42, background: '#FFFFFF', boxShadow: `inset 0 0 0 1.5px ${RULE}`, opacity: ease(f, sceneStart + 16, 8) }}>
        <Ring k={kC} r={42} />
        <svg width={40} height={40} viewBox="0 0 40 40" style={{ position: 'absolute', left: 26, top: 22 }}>
          <path d="M6 8 Q6 5 9 5 L31 5 Q34 5 34 8 L34 25 Q34 28 31 28 L17 28 L10 34 L10 28 L9 28 Q6 28 6 25 Z" fill="none" stroke={UI_INK} strokeWidth={2.6} strokeLinejoin="round" />
        </svg>
        <div style={{ position: 'absolute', left: 84, top: 0, lineHeight: '84px', fontFamily: KO, fontWeight: 600, fontSize: 28, color: UI_MUTED }}>댓글 달기…</div>
      </div>
    </>
  );
};

// ───────────── 장면표 ─────────────
type K = 'hook' | 'promise' | 'code' | 'record' | 'copies' | 'timeline' | 'batch' | 'logout' | 'park' | 'bars' | 'task' | 'install' | 'ask';
type Scene = { k: K; at: number; bg: string; o: [number, number] };
const SCENES: Scene[] = [
  { k: 'hook', at: 0, bg: DARK, o: [476, 200] },
  { k: 'promise', at: VO.h2 - 2, bg: PAPER, o: [476, 420] },
  { k: 'code', at: VO.b1 - 2, bg: DARK, o: [300, 200] },
  { k: 'record', at: VO.b2 - 2, bg: PAPER, o: [476, 300] },
  { k: 'copies', at: VO.b3 - 2, bg: DARK, o: [476, 600] },
  { k: 'timeline', at: VO.b4 - 2, bg: PAPER, o: [200, 360] },
  { k: 'batch', at: VO.f1 - 2, bg: DARK, o: [300, 300] },
  { k: 'logout', at: VO.f2 - 2, bg: DARK, o: [300, 300] },
  { k: 'park', at: VO.f3 - 2, bg: DARK, o: [476, 600] },
  { k: 'bars', at: VO.b5 - 2, bg: PAPER, o: [300, 420] },
  { k: 'task', at: VO.c0 - 2, bg: PAPER, o: [200, 420] },
  { k: 'ask', at: VO.q - 2, bg: PAPER, o: [476, 500] },
  { k: 'install', at: VO.cta - 2, bg: DARK, o: [300, 200] },
];
const sceneAt = (f: number) => {
  let i = 0;
  for (let j = 0; j < SCENES.length; j++) if (f >= SCENES[j].at) i = j;
  return i;
};

const Content: React.FC<{ k: K; f: number; sceneStart: number }> = ({ k, f, sceneStart }) => {
  switch (k) {
    case 'hook':
      return <HookGrid f={f} />;
    case 'promise':
      return <PromiseCard f={f} />;
    case 'code':
      return <CodeBefore f={f} sceneStart={sceneStart} />;
    case 'record':
      return <RecordCard f={f} />;
    case 'copies':
      return <CopyGrid f={f} />;
    case 'timeline':
      return <Timeline f={f} sceneStart={sceneStart} />;
    case 'batch':
      return <Batch f={f} sceneStart={sceneStart} />;
    case 'logout':
      return <Logout f={f} sceneStart={sceneStart} />;
    case 'park':
      return <ParkGrid f={f} />;
    case 'bars':
      return <Bars f={f} sceneStart={sceneStart} />;
    case 'task':
      return <TaskCard f={f} />;
    case 'install':
      return <Install f={f} sceneStart={sceneStart} />;
    case 'ask':
      return <Ask f={f} sceneStart={sceneStart} />;
    default:
      return null;
  }
};

// ───────────── 판 + 밀기 ─────────────
const CHECK_AT = () => at('c0', '켜');
const push = (f: number, i: number) => {
  const cap = 0.08;
  const drift = Math.min(cap, 0.0007 * Math.max(0, f - SCENES[i].at));
  const punch = interpolate(f - CHECK_AT(), [0, 3, 10], [0, 0.012, 0], clamp);
  return 1 + drift + punch;
};
const Panel: React.FC = () => {
  const f = useCurrentFrame();
  const i = sceneAt(f);
  const sc = SCENES[i];
  const p = push(f, i);
  const fadeOut = 1 - ease(f, S.end - 8, 8);
  if (fadeOut <= 0) return null;
  const dark = sc.bg !== PAPER;
  return (
    <div
      style={{
        position: 'absolute',
        left: VP.x,
        top: VP.y,
        width: W,
        height: H,
        borderRadius: VP.r,
        overflow: 'hidden',
        background: sc.bg,
        boxShadow: dark ? '0 0 0 1.5px rgba(255,255,255,0.16), 0 26px 70px rgba(0,0,0,0.5)' : '0 0 0 1px rgba(255,255,255,0.07), 0 26px 70px rgba(0,0,0,0.5)',
        opacity: fadeOut,
        transform: `scale(${p})`,
        transformOrigin: `${sc.o[0]}px ${sc.o[1]}px`,
      }}
    >
      <Content k={sc.k} f={f} sceneStart={sc.at} />
      {sc.k === 'task' ? <CursorLayer f={f} target={CHECK_XY} pressAt={CHECK_AT()} from={[620, 560]} /> : null}
    </div>
  );
};

// ───────────── 머리글 ─────────────
type Head = { at: number; lines: string[]; accent?: string; size?: number };
const HEADS = (): Head[] => [
  { at: -1, lines: ['제가 나눠 드린 도구가,', '디스크를 한 시간에 4.3GB씩', '쓰고 있었어요'], accent: '4.3GB씩', size: 70 },
  { at: VO.h2 - 3, lines: ['어디서 샜는지,', '내 PC에서 찾는 법까지'], accent: '찾는 법' },
  { at: VO.b1 - 3, lines: ['바뀌면 0.15초 안에,', '28곳에 복사'], accent: '28곳' },
  { at: VO.b2 - 3, lines: ['앱은 한 번 오갈 때마다', '통째로 다시 써요'], accent: '통째로', size: 74 },
  { at: VO.b3 - 3, lines: ['한 시간에 복사만,', '3만 4천 번'], accent: '3만 4천 번' },
  { at: VO.b4 - 3, lines: ['앱은 로그인할 때만', '목록을 읽어요'], accent: '로그인할 때만' },
  { at: VO.f1 - 3, lines: ['하나, 고쳐 쓴 기록은', '5분씩 모아서'], accent: '5분씩' },
  { at: VO.f2 - 3, lines: ['둘, 앱이 로그아웃하면', '그때 바로'], accent: '그때 바로' },
  { at: VO.f3 - 3, lines: ['셋, 안 쓰는 폴더는 쉬게', '진짜 쓰는 곳은 7곳뿐'], accent: '7곳뿐', size: 72 },
  { at: VO.b5 - 3, lines: ['한 시간에 4.3GB 쓰던 게', '94MB가 됐어요'], accent: '94MB', size: 74 },
  { at: VO.c0 - 3, lines: ['작업 관리자 세부 정보에서,', 'I/O 쓰기 바이트 열을 켜고', '빨리 느는 걸 보세요'], accent: 'I/O 쓰기 바이트', size: 64 },
  { at: VO.q - 3, lines: ['여러분 PC의 1등은', '뭐였나요?'], accent: '1등' },
  { at: VO.cta - 3, lines: ['받으신 분은', '설치 한 줄만 다시'], accent: '한 줄' },
];
const Heads: React.FC = () => {
  const hs = HEADS();
  return (
    <>
      {hs.map((h, i) => (
        <Line key={i} lines={h.lines} accent={h.accent} at={h.at} until={i + 1 < hs.length ? hs[i + 1].at : S.end} fade={i + 1 === hs.length} size={h.size} top={h.lines.length > 2 ? 264 : undefined} />
      ))}
    </>
  );
};

// ───────────── 판 아래 표시 ─────────────
const LABEL: Record<K, string> = {
  hook: '끝에 내 PC에서 찾는 법을 드려요',
  promise: '끝에 드리는 것',
  code: '지난 편 도구 · 고치기 전 코드 · 실제 기록',
  record: '실제 기록 파일의 칸 이름·크기 · 값은 안 보임',
  copies: '제 PC · 바쁠 때 4분 잰 값 · 1시간 꼴',
  timeline: '그림 · 앱이 목록을 읽는 때',
  batch: '고친 판 코드 · 아래 띠는 그림',
  logout: '실제 기록 · 10월 21일 00:10',
  park: '29곳 중 7곳',
  bars: '같은 방법으로 잰 값 · CPU는 코어 하나 기준',
  task: '내 PC에서 찾기 · 작업 관리자 메뉴 이름 그대로',
  install: '도구 받으신 분',
  ask: '댓글로 알려 주세요',
};
const Label: React.FC = () => {
  const f = useCurrentFrame();
  const o = 1 - ease(f, S.end - 8, 8);
  if (o <= 0) return null;
  const k = SCENES[sceneAt(f)].k;
  return <div style={{ position: 'absolute', left: 72, top: VP.y + VP.h + 64, fontFamily: KO, fontWeight: 560, fontSize: 25, letterSpacing: '-0.01em', color: DIM, opacity: o }}>{LABEL[k]}</div>;
};

// ───────────── 소리 ─────────────
// 모든 소리에 같은 마스터 값을 곱한다 — Remotion은 합이 0 dBFS를 넘는 표본을 그 자리에서 자른다(현장 노트 영상, 1차 렌더 0.1 dBFS).
const MASTER = 0.8;
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  { at: CHECK_AT(), src: 'sfx/tok.wav', v: 0.3 },
  { at: END_FOLLOW, src: 'sfx/tok.wav', v: 0.42 },
];

export const SessionFilm: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const ranges = ORDER.map((id) => [VO[id], lineEnd(id)] as [number, number])
    .sort((p, q) => p[0] - q[0])
    .reduce<[number, number][]>((acc, [a, b]) => {
      const last = acc[acc.length - 1];
      if (last && a - last[1] < 20) last[1] = Math.max(last[1], b);
      else acc.push([a, b]);
      return acc;
    }, []);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (TOTAL - fr) / 20);
    const voice = Math.max(0, ...ranges.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.42 - 0.14 * voice) * tail * MASTER;
  };
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <Panel />
      <Label />
      <Heads />
      <EndGate />
      {ORDER.map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {hits().map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm_cut.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

const EndGate: React.FC = () => {
  const f = useCurrentFrame();
  if (f < S.end) return null;
  return (
    <AbsoluteFill style={{ opacity: ease(f, S.end, 8) }}>
      <EndCard />
    </AbsoluteFill>
  );
};
