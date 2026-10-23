// yuhobuilds 「윈도우 PC가 괜히 느리면, 뒤에서 계속 저장하는 프로그램을 찾아보세요」(10-23 보완판 v9 — 처음 보는 사람 판). 기획·콘티는 ../../기획.md.
// v9: 이해 시험 2차(3점) 뒤 — 증거를 한 줄로 줄여 방법을 2초 앞당기고, 찾은 뒤 할 일(AI에게 묻고 안 쓰면 끄기)과 끝 요약표를 넣었다.
// v8: 이해 시험 1차(3점)에서 막힌 것 — 「쓴다」가 저장인지, 「열 이름 줄」, 풀이가 늦은 「I/O 쓰기 바이트」, 정렬하는 법, 얼마나 지켜보나, 찾은 뒤 할 일 — 을 말과 화면에 바로 넣었다.
// 10-22 판(49초)은 내부 도구 이야기와 코드·기록 줄 화면이라 처음 보는 사람이 8초에 넘겼다(이해 시험 2점). 이 판은
//  · 찾는 법(작업 관리자 다섯 단계)을 한 단계씩 크게, 우리 실화(4.3GB → 94MB)는 증거 한 마디로만 둔다.
//  · 화면 글은 말과 같은 것만 크게. 작업 관리자 메뉴 이름은 기획 「사실 대조」의 확인값(세부 정보 · 열 선택 · I/O 쓰기 바이트)만 글로 쓰고
//    나머지 칸은 글 없는 회색 막대로 둔다. 다섯째 단계의 줄 막대는 그림이라 판 아래에 「그림」을 적는다.
//  · 움직임 문법은 10-21 두 편(S22)과 같다: 판 자리는 한 편 내내 같고 내용은 컷, 판은 늘 천천히 밀린다(프레임마다 0.07%, 1.08에서 멈춤),
//    머리글은 줄 단위 올림 하나 + 처음부터 칠한 강조 낱말 하나. 숫자 세기 · 튕김 · 흐림 전환 · 형광펜 없음.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Cursor, DIM, STAGE } from '../film/parts';
import { EN, KO } from '../lib/fonts';
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
const BAR_GRAY = '#E2DFD7';
const SOFT = '#F1EFE9';

/** 지금 자리 표시: a에 6프레임 켜지고 b에 6프레임 꺼진다. */
const on = (f: number, a: number, b = Infinity) => ease(f, a, 6) * (b === Infinity ? 1 : 1 - ease(f, b, 6));
/** 지금 자리 테두리(글색). dark: 어두운 판 위. */
const Ring: React.FC<{ k: number; r: number; pad?: number; dark?: boolean }> = ({ k, r, pad = 0, dark }) => {
  if (k <= 0) return null;
  const c = dark ? '244,242,236' : '34,33,30';
  return <div style={{ position: 'absolute', inset: -pad, borderRadius: r + pad, background: `rgba(${c},${0.06 * k})`, boxShadow: `inset 0 0 0 3px rgba(${c},${k})`, pointerEvents: 'none' }} />;
};
/** 글 없는 회색 막대(메뉴 이름을 확인하지 않은 칸). */
const Bar: React.FC<{ w: number; h?: number; c?: string; style?: React.CSSProperties }> = ({ w, h = 18, c = BAR_GRAY, style }) => (
  <div style={{ display: 'inline-block', width: w, height: h, borderRadius: h / 2, background: c, verticalAlign: 'middle', ...style }} />
);

/** 커서 길: 점마다 그 프레임에 닿고, press가 붙은 점에서 누른다. */
type KF = { t: number; x: number; y: number; press?: boolean };
const CursorPath: React.FC<{ f: number; kf: KF[]; until?: number }> = ({ f, kf, until }) => {
  const first = kf[0].t;
  const end = until ?? kf[kf.length - 1].t + 14;
  if (f < first - 8 || f > end + 8) return null;
  let x = kf[0].x;
  let y = kf[0].y;
  for (let i = 1; i < kf.length; i++) {
    const a = kf[i - 1];
    const b = kf[i];
    if (f > a.t && f < b.t) {
      const p = interpolate(f, [a.t, b.t], [0, 1], { ...clamp, easing: EASE_MOVE });
      const mid: [number, number] = [mix(a.x, b.x, 0.5) + 50, mix(a.y, b.y, 0.5) - 30];
      [x, y] = bezier([a.x, a.y], mid, [b.x, b.y], p);
    } else if (f >= b.t) {
      x = b.x;
      y = b.y;
    }
  }
  let press = 0;
  let ring = 0;
  for (const k of kf) {
    if (!k.press) continue;
    press = Math.max(press, interpolate(f, [k.t - 2, k.t, k.t + 4], [0, 1, 0], clamp));
    if (f >= k.t && f <= k.t + 12) ring = interpolate(f, [k.t, k.t + 12], [0, 1], clamp);
  }
  const o = ease(f, first - 8, 5) * (1 - ease(f, end, 6));
  return <Cursor x={x} y={y} press={press} ring={ring} opacity={o} />;
};

/** 다섯 단계 표시: 판 오른쪽 위. 지금 단계는 채운 원. */
const StepDots: React.FC<{ f: number; n: number; sceneStart: number }> = ({ f, n, sceneStart }) => (
  <div style={{ position: 'absolute', right: 28, top: 24, display: 'flex', gap: 10 }}>
    {[1, 2, 3, 4, 5].map((i) => {
      const now = i === n;
      const done = i < n;
      const p = now ? ease(f, sceneStart, 8) : 1;
      return (
        <div
          key={i}
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            background: now ? UI_INK : done ? '#CFCBC2' : '#FFFFFF',
            boxShadow: now || done ? undefined : `inset 0 0 0 2px ${RULE}`,
            color: now || done ? '#FFFFFF' : UI_MUTED,
            fontFamily: EN,
            fontWeight: 700,
            fontSize: 24,
            lineHeight: '46px',
            textAlign: 'center',
            transform: now ? `scale(${0.82 + 0.18 * p})` : undefined,
          }}
        >
          {i}
        </div>
      );
    })}
  </div>
);
/** 왼쪽 위 작은 제목(판 안). */
const Tag: React.FC<{ text: string; dark?: boolean }> = ({ text, dark }) => (
  <div style={{ position: 'absolute', left: 36, top: 30, fontFamily: KO, fontWeight: 650, fontSize: 26, color: dark ? '#B6B3AB' : UI_MUTED, letterSpacing: '-0.01em' }}>{text}</div>
);
/** 창 모양 상자(작업 관리자 창 · 대화 상자). */
const Window: React.FC<{ x: number; y: number; w: number; h: number; title?: string; o?: number; s?: number; children?: React.ReactNode }> = ({ x, y, w, h, title, o = 1, s = 1, children }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 18, background: '#FFFFFF', boxShadow: `0 0 0 1.5px ${RULE}, 0 18px 44px rgba(34,33,30,0.10)`, overflow: 'hidden', opacity: o, transform: s !== 1 ? `scale(${s})` : undefined, transformOrigin: '50% 40%' }}>
    {title !== undefined ? (
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 58, background: SOFT, borderBottom: `1px solid ${RULE}` }}>
        <div style={{ position: 'absolute', left: 22, top: 17, width: 24, height: 24, borderRadius: 6, background: UI_INK, opacity: 0.85 }} />
        <div style={{ position: 'absolute', left: 60, top: 0, lineHeight: '58px', fontFamily: KO, fontWeight: 700, fontSize: 27, color: UI_INK }}>{title}</div>
      </div>
    ) : null}
    {children}
  </div>
);

// ───────────── 1. 훅: 프로그램 셋 중 하나가 디스크에 쉬지 않고 쓴다(그림) ─────────────
const PROG_X = [48, 358, 668];
const PROG_Y = 64;
const PROG_W = 236;
const PROG_H = 168;
const DISK_Y = 468;
const Program: React.FC<{ x: number; k?: number }> = ({ x, k = 0 }) => (
  <div style={{ position: 'absolute', left: x, top: PROG_Y, width: PROG_W, height: PROG_H, borderRadius: 16, background: '#FFFFFF', boxShadow: `0 0 0 1.5px ${RULE}` }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 36, borderRadius: '16px 16px 0 0', background: SOFT, borderBottom: `1px solid ${RULE}` }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: 'absolute', left: 16 + i * 18, top: 13, width: 10, height: 10, borderRadius: 5, background: '#CFCBC2' }} />
      ))}
    </div>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ position: 'absolute', left: 22, top: 62 + i * 30 }}>
        <Bar w={[150, 110, 130][i]} h={14} />
      </div>
    ))}
    <Ring k={k} r={16} pad={8} />
  </div>
);
const Magnifier: React.FC<{ x: number; y: number; o: number }> = ({ x, y, o }) => (
  <svg width={190} height={190} viewBox="0 0 190 190" style={{ position: 'absolute', left: x - 70, top: y - 70, opacity: o, overflow: 'visible', filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.18))' }}>
    <circle cx={70} cy={70} r={58} fill="rgba(255,255,255,0.28)" stroke={UI_INK} strokeWidth={11} />
    <path d="M113 113 L168 168" stroke={UI_INK} strokeWidth={20} strokeLinecap="round" />
  </svg>
);
const HookScene: React.FC<{ f: number }> = ({ f }) => {
  const findAt = at('h1', '찾아');
  const arrive = findAt + 2;
  const mp = interpolate(f, [arrive - 18, arrive], [0, 1], { ...clamp, easing: EASE_MOVE });
  const [mx, my] = bezier([860, 700], [760, 420], [PROG_X[1] + PROG_W / 2, PROG_Y + PROG_H / 2 + 6], mp);
  const k = on(f, arrive);
  // 칸: 가운데 프로그램은 3프레임마다, 양옆은 45프레임마다 하나(겹치지 않게 엇갈림).
  const blocks: React.ReactNode[] = [];
  const TRAVEL = 15;
  const fall = (src: number, every: number, offset: number, strong: boolean) => {
    const cx = PROG_X[src] + PROG_W / 2;
    for (let n = Math.floor((f - offset) / every); n >= 0; n--) {
      const born = offset + n * every;
      const age = f - born;
      if (age < 0) continue;
      if (age > TRAVEL) break;
      const p = age / TRAVEL;
      const y = PROG_Y + PROG_H + 6 + p * (DISK_Y - PROG_Y - PROG_H - 24);
      const jitter = strong ? ((n * 37) % 5) * 9 - 18 : 0;
      blocks.push(<div key={`${src}-${n}`} style={{ position: 'absolute', left: cx - 10 + jitter, top: y, width: 20, height: 20, borderRadius: 5, background: UI_INK, opacity: Math.min(1, age / 3) * (strong ? 1 : 0.55) }} />);
    }
  };
  fall(1, 3, 0, true);
  fall(0, 45, 11, false);
  fall(2, 45, 33, false);
  const led = f % 6 < 3 ? 1 : 0.35;
  return (
    <>
      {PROG_X.map((x, i) => (
        <Program key={i} x={x} k={i === 1 ? k : 0} />
      ))}
      {blocks}
      <div style={{ position: 'absolute', left: 48, top: DISK_Y, width: 856, height: 150, borderRadius: 22, background: UI_INK }}>
        <svg width={92} height={92} viewBox="0 0 92 92" style={{ position: 'absolute', left: 34, top: 29 }}>
          <circle cx={46} cy={46} r={40} fill="none" stroke="#5E5C56" strokeWidth={6} />
          <circle cx={46} cy={46} r={10} fill="#5E5C56" />
        </svg>
        <div style={{ position: 'absolute', left: 150, top: 0, lineHeight: '150px', fontFamily: KO, fontWeight: 760, fontSize: 48, color: '#FFFFFF', letterSpacing: '-0.02em' }}>디스크</div>
        <div style={{ position: 'absolute', right: 40, top: 63, width: 24, height: 24, borderRadius: 12, background: '#F4F2EC', opacity: led }} />
      </div>
      <Magnifier x={mx} y={my} o={ease(f, arrive - 20, 6)} />
    </>
  );
};

// ───────────── 2. 증거: 제가 만든 프로그램 · 한 시간에 쓴 양(실측) ─────────────
const ProofBig: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  // 밝은 판(어두운 판은 검정 무대와 대비가 없어 정지 검사에 「거의 멈춤」으로 잡혔다 — v7 첫 렌더 4~6초).
  const nameAt = sceneStart + 2;
  const growFrom = at('e1', '제가');
  const growTo = at('e1', '기가') + 6;
  const g = interpolate(f, [growFrom, growTo], [0, 1], { ...clamp, easing: EASE_MOVE });
  const vAt = at('e1', '사') - 2;
  const gw = W - 80;
  return (
    <>
      <div style={{ position: 'absolute', left: 40, top: 46, width: 132, height: 96, borderRadius: 14, background: '#FFFFFF', boxShadow: `0 0 0 1.5px ${RULE}`, opacity: ease(f, nameAt, 8) }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 24, borderRadius: '14px 14px 0 0', background: SOFT, borderBottom: `1px solid ${RULE}` }} />
        <div style={{ position: 'absolute', left: 18, top: 44 }}>
          <Bar w={80} h={12} />
        </div>
        <div style={{ position: 'absolute', left: 18, top: 66 }}>
          <Bar w={56} h={12} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 200, top: 60, fontFamily: KO, fontWeight: 760, fontSize: 48, color: UI_INK, letterSpacing: '-0.03em', opacity: ease(f, nameAt, 8), transform: `translateY(${(1 - ease(f, nameAt, 10)) * 14}px)` }}>제가 만든 프로그램</div>
      <div style={{ position: 'absolute', left: 40, top: 212, fontFamily: KO, fontWeight: 650, fontSize: 30, color: UI_MUTED, opacity: ease(f, nameAt + 4, 8) }}>한 시간에 저장한 양</div>
      <div style={{ position: 'absolute', left: 40, top: 266, width: gw, height: 104, borderRadius: 16, background: '#ECEAE4', overflow: 'hidden', opacity: ease(f, nameAt + 4, 8) }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: gw * g, background: UI_INK }} />
      </div>
      <div style={{ position: 'absolute', left: 40, top: 398, fontFamily: EN, fontWeight: 700, fontSize: 112, lineHeight: 1, letterSpacing: '-0.03em', color: UI_INK, opacity: ease(f, vAt, 6), transform: `translateY(${(1 - ease(f, vAt, 10)) * 18}px)` }}>4.3GB</div>
      <div style={{ position: 'absolute', left: 44, top: 540, fontFamily: KO, fontWeight: 600, fontSize: 28, color: UI_MUTED, opacity: ease(f, vAt + 6, 8) }}>바쁠 때 4분 잰 값을 1시간으로</div>
    </>
  );
};
const ProofBars: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const k = on(f, at('e1', '구십') - 2);
  const gw = 520;
  const x0 = 290;
  const fixAt = at('e1', '고치') + 3;
  const after = Math.max(14, gw * (D.V31.mbPerHour / D.BEFORE.mbPerHour));
  return (
    <>
      <Tag text="제가 만든 프로그램 · 한 시간에 저장한 양" />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 96, height: 1, background: RULE }} />
      {/* 고치기 전 */}
      <div style={{ position: 'absolute', left: 40, top: 150, opacity: ease(f, sceneStart, 6) }}>
        <div style={{ fontFamily: KO, fontWeight: 760, fontSize: 40, color: UI_INK }}>고치기 전</div>
      </div>
      <div style={{ position: 'absolute', left: x0, top: 154, width: gw, height: 76, borderRadius: 12, background: '#CFCBC2', opacity: ease(f, sceneStart, 6) }} />
      <div style={{ position: 'absolute', left: x0 + gw - 210, top: 154, width: 190, height: 76, lineHeight: '76px', textAlign: 'right', fontFamily: EN, fontWeight: 700, fontSize: 46, color: UI_INK, opacity: ease(f, sceneStart, 6) }}>4.3GB</div>
      {/* 고친 뒤 */}
      <div style={{ position: 'absolute', left: 40, top: 340, opacity: ease(f, fixAt, 8), transform: `translateY(${(1 - ease(f, fixAt, 10)) * 14}px)` }}>
        <div style={{ fontFamily: KO, fontWeight: 760, fontSize: 40, color: UI_INK }}>고친 뒤</div>
      </div>
      <div style={{ position: 'absolute', left: x0, top: 344, width: after * ease(f, fixAt + 2, 8), height: 76, borderRadius: 8, background: UI_INK }} />
      <div style={{ position: 'absolute', left: x0 + after + 30, top: 330, padding: '6px 16px', margin: '-6px -16px', fontFamily: EN, fontWeight: 700, fontSize: 92, lineHeight: '104px', letterSpacing: '-0.03em', color: UI_INK, opacity: ease(f, at('e1', '구십') - 2, 6) }}>
        <Ring k={k} r={14} />
        94MB
      </div>
    </>
  );
};

// ───────────── 3. 단계 1: Ctrl + Shift + Esc ─────────────
const KEYS = [
  { t: 'Ctrl', w: 250, word: '컨트롤' },
  { t: 'Shift', w: 290, word: '시프트' },
  { t: 'Esc', w: 200, word: '이에스씨' },
] as const;
const KeysScene: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const gap = 54;
  const total = KEYS.reduce((a, k) => a + k.w, 0) + gap * (KEYS.length - 1);
  let x = (W - total) / 2;
  const top = 250;
  const kh = 156;
  const nodes: React.ReactNode[] = [];
  KEYS.forEach((k, i) => {
    const pAt = at('s1', k.word);
    const down = ease(f, pAt - 1, 3);
    const lit = f >= pAt - 1;
    nodes.push(
      <div key={k.t} style={{ position: 'absolute', left: x, top, width: k.w, height: kh, opacity: ease(f, sceneStart + 2 + i * 3, 8), transform: `translateY(${(1 - ease(f, sceneStart + 2 + i * 3, 10)) * 20}px)` }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 12, bottom: 0, borderRadius: 22, background: '#CFCBC2' }} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: kh - 12,
            borderRadius: 22,
            background: lit ? UI_INK : '#FFFFFF',
            boxShadow: `inset 0 0 0 2px ${lit ? UI_INK : RULE}`,
            transform: `translateY(${down * 10}px)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: EN,
            fontWeight: 700,
            fontSize: 56,
            color: lit ? '#FFFFFF' : UI_INK,
            letterSpacing: '-0.01em',
          }}
        >
          {k.t}
        </div>
      </div>,
    );
    x += k.w;
    if (i < KEYS.length - 1) {
      nodes.push(
        <div key={`p${i}`} style={{ position: 'absolute', left: x, top, width: gap, height: kh - 12, lineHeight: `${kh - 12}px`, textAlign: 'center', fontFamily: EN, fontWeight: 600, fontSize: 48, color: UI_MUTED, opacity: ease(f, sceneStart + 4 + i * 3, 8) }}>
          +
        </div>,
      );
      x += gap;
    }
  });
  return (
    <>
      <Tag text="찾는 법" />
      <StepDots f={f} n={1} sceneStart={at('s1', '컨트롤') - 4} />
      {nodes}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 470, textAlign: 'center', fontFamily: KO, fontWeight: 650, fontSize: 32, color: UI_INK, opacity: ease(f, at('s1', '컨트롤'), 8) }}>세 키를 함께 누르면 작업 관리자</div>
    </>
  );
};

// ───────────── 4. 단계 2: 세부 정보 ─────────────
const NAV_ROWS = 7;
const NAV_DETAILS = 5; // 여섯째(Windows 11 작업 관리자 왼쪽 목록, 10·11 모두 여섯째 칸)
const WIN = { x: 28, y: 96, w: W - 56, h: H - 120 };
const NAV_W = 316;
const NAV_TOP = 76;
const NAV_ROW_H = 62;
const DetailsScene: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const clickAt = at('s1', '세부') + 3;
  const open = ease(f, sceneStart, 10);
  const selected = f >= clickAt;
  const k = on(f, clickAt);
  const rowY = (i: number) => NAV_TOP + i * NAV_ROW_H;
  const target: [number, number] = [WIN.x + 150, WIN.y + rowY(NAV_DETAILS) + 30];
  return (
    <>
      <StepDots f={f} n={2} sceneStart={at('s1', '세부') - 4} />
      <Tag text="작업 관리자" />
      <Window x={WIN.x} y={WIN.y} w={WIN.w} h={WIN.h} title="작업 관리자" o={open} s={0.96 + 0.04 * open}>
        <div style={{ position: 'absolute', left: 0, top: 58, bottom: 0, width: NAV_W, background: '#FAF9F6', borderRight: `1px solid ${RULE}` }} />
        {Array.from({ length: NAV_ROWS }, (_, i) => {
          const isD = i === NAV_DETAILS;
          return (
            <div key={i} style={{ position: 'absolute', left: 14, top: rowY(i), width: NAV_W - 28, height: NAV_ROW_H - 8, borderRadius: 12, background: isD && selected ? '#E9E6DF' : 'transparent' }}>
              {isD && selected ? <div style={{ position: 'absolute', left: 0, top: 14, width: 5, height: NAV_ROW_H - 36, borderRadius: 3, background: UI_INK }} /> : null}
              <div style={{ position: 'absolute', left: 20, top: (NAV_ROW_H - 8 - 26) / 2, width: 26, height: 26, borderRadius: 7, background: isD ? UI_INK : '#D9D6CE' }} />
              {isD ? (
                <div style={{ position: 'absolute', left: 62, top: 0, lineHeight: `${NAV_ROW_H - 8}px`, fontFamily: KO, fontWeight: 760, fontSize: 32, color: UI_INK, letterSpacing: '-0.02em' }}>세부 정보</div>
              ) : (
                <div style={{ position: 'absolute', left: 62, top: (NAV_ROW_H - 8 - 16) / 2 }}>
                  <Bar w={[150, 110, 130, 120, 100, 0, 110][i]} h={16} />
                </div>
              )}
              {isD ? <Ring k={k} r={12} pad={4} /> : null}
            </div>
          );
        })}
        {/* 오른쪽: 누르기 전에는 다른 화면(회색), 누른 뒤에는 세부 정보 표(회색 줄) */}
        <div style={{ position: 'absolute', left: NAV_W + 24, right: 24, top: 82 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const p = selected ? ease(f, clickAt + 2 + i * 2, 6) : 1;
            return (
              <div key={i} style={{ height: 58, borderBottom: `1px solid ${i === 0 ? RULE : '#F0EEE8'}`, background: i === 0 && selected ? SOFT : undefined, opacity: selected ? p : 0.45, display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 14 }}>
                <Bar w={selected ? [120, 150, 110, 140, 130, 100, 120][i] : [200, 160, 220, 180, 150, 210, 170][i]} h={14} c={i === 0 && selected ? '#CFCBC2' : BAR_GRAY} />
                <Bar w={selected ? 60 : 90} h={14} c={i === 0 && selected ? '#CFCBC2' : BAR_GRAY} />
                {selected ? <Bar w={70} h={14} c={i === 0 ? '#CFCBC2' : BAR_GRAY} /> : null}
              </div>
            );
          })}
        </div>
      </Window>
      <CursorPath f={f} kf={[{ t: sceneStart + 6, x: 760, y: 620 }, { t: clickAt, x: target[0], y: target[1], press: true }]} until={clickAt + 18} />
    </>
  );
};

// ───────────── 5. 단계 3: 열 이름 줄 오른쪽 클릭 → 열 선택 ─────────────
const TABLE = { x: 28, y: 96, w: W - 56, h: H - 120 };
const HEAD_H = 70;
const HeaderScene: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const rcAt = at('s2', '오른쪽') + 4;
  const headK = on(f, at('s2', '줄을') - 2, rcAt + 10);
  const menuAt = rcAt + 2;
  const menuP = ease(f, menuAt, 6);
  const hoverAt = at('s2', '열', 4) - 2;
  const pickAt = at('s2', '선택') + 2;
  const menu = { x: 420, y: TABLE.y + 64 };
  const pickXY: [number, number] = [menu.x + 120, menu.y + 108];
  return (
    <>
      <StepDots f={f} n={3} sceneStart={sceneStart + 2} />
      <Tag text="세부 정보" />
      <Window x={TABLE.x} y={TABLE.y} w={TABLE.w} h={TABLE.h}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: HEAD_H, background: SOFT, borderBottom: `1.5px solid ${RULE}` }}>
          <div style={{ position: 'absolute', left: 28, top: (HEAD_H - 18) / 2, display: 'flex', gap: 60 }}>
            {[150, 80, 110, 120, 96].map((w, i) => (
              <Bar key={i} w={w} h={18} c="#CFCBC2" />
            ))}
          </div>
          <Ring k={headK} r={0} pad={0} />
        </div>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: HEAD_H + i * 66, height: 66, borderBottom: '1px solid #F0EEE8', display: 'flex', alignItems: 'center', gap: 60, paddingLeft: 28 }}>
            <Bar w={[140, 170, 120, 150, 130, 160, 110][i]} h={14} />
            <Bar w={60} h={14} />
            <Bar w={90} h={14} />
            <Bar w={80} h={14} />
          </div>
        ))}
      </Window>
      <div style={{ position: 'absolute', left: TABLE.x + 30, top: TABLE.y + HEAD_H + 12, fontFamily: KO, fontWeight: 650, fontSize: 25, color: UI_INK, opacity: headK, whiteSpace: 'nowrap' }}>
        <span style={{ background: '#FFFFFF', padding: '4px 10px', borderRadius: 8, boxShadow: `0 0 0 1.5px ${UI_INK}` }}>맨 윗줄</span>
      </div>
      {/* 오른쪽 클릭 메뉴 */}
      <div style={{ position: 'absolute', left: menu.x, top: menu.y, width: 330, height: 160, borderRadius: 16, background: '#FFFFFF', boxShadow: `0 0 0 1.5px ${RULE}, 0 16px 36px rgba(34,33,30,0.16)`, opacity: menuP, transform: `translateY(${(1 - menuP) * -10}px)` }}>
        <div style={{ position: 'absolute', left: 26, top: 34 }}>
          <Bar w={170} h={16} />
        </div>
        <div style={{ position: 'absolute', left: 10, right: 10, top: 78, height: 66, borderRadius: 12, background: f >= hoverAt ? '#E9E6DF' : 'transparent' }}>
          <div style={{ position: 'absolute', left: 16, top: 0, lineHeight: '66px', fontFamily: KO, fontWeight: 760, fontSize: 34, color: UI_INK }}>열 선택</div>
          <Ring k={on(f, hoverAt)} r={12} pad={2} />
        </div>
      </div>
      <CursorPath
        f={f}
        kf={[
          { t: sceneStart + 4, x: 820, y: 620 },
          { t: rcAt, x: menu.x - 6, y: menu.y - 6, press: true },
          { t: hoverAt, x: menu.x - 6, y: menu.y - 6 },
          { t: pickAt, x: pickXY[0], y: pickXY[1], press: true },
        ]}
        until={pickAt + 14}
      />
    </>
  );
};

// ───────────── 6. 단계 4: 열 선택 → I/O 쓰기 바이트 체크 ─────────────
const DLG = { x: 96, y: 92, w: W - 192, h: H - 112 };
const DLG_ROW0 = 98;
const DLG_ROW_H = 70;
const IO_ROW = 2;
const ColumnsScene: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const checkAt = at('s2', '체크') + 3;
  const checked = f >= checkAt;
  const hiK = on(f, at('s2', '아이오') - 2);
  const noteAt = at('s2', '실행') - 4;
  const open = ease(f, sceneStart, 8);
  const boxXY: [number, number] = [DLG.x + 40 + 20, DLG.y + DLG_ROW0 + IO_ROW * DLG_ROW_H + 30];
  return (
    <>
      <StepDots f={f} n={4} sceneStart={sceneStart + 2} />
      <Window x={DLG.x} y={DLG.y} w={DLG.w} h={DLG.h} o={open} s={0.97 + 0.03 * open}>
        <div style={{ position: 'absolute', left: 36, top: 26, fontFamily: KO, fontWeight: 760, fontSize: 38, color: UI_INK, letterSpacing: '-0.02em' }}>열 선택</div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 88, height: 1, background: RULE }} />
        {Array.from({ length: 6 }, (_, i) => {
          const isIO = i === IO_ROW;
          const top = DLG_ROW0 + i * DLG_ROW_H;
          return (
            <div key={i} style={{ position: 'absolute', left: 16, right: 16, top, height: DLG_ROW_H - 8, borderRadius: 12, background: isIO ? `rgba(34,33,30,${0.05 * hiK})` : undefined }}>
              <div
                style={{
                  position: 'absolute',
                  left: 24,
                  top: (DLG_ROW_H - 8 - 38) / 2,
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  background: isIO && checked ? UI_INK : '#FFFFFF',
                  boxShadow: `inset 0 0 0 2.5px ${isIO ? UI_INK : '#CFCBC2'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isIO && checked ? (
                  <svg width={24} height={18} viewBox="0 0 26 20">
                    <path d="M3 10 L10 17 L23 3" fill="none" stroke="#FFFFFF" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </div>
              {isIO ? (
                <div style={{ position: 'absolute', left: 84, top: 0, lineHeight: `${DLG_ROW_H - 8}px`, fontFamily: KO, fontWeight: 780, fontSize: 38, color: UI_INK, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>I/O 쓰기 바이트</div>
              ) : (
                <div style={{ position: 'absolute', left: 84, top: (DLG_ROW_H - 8 - 16) / 2 }}>
                  <Bar w={[210, 170, 0, 230, 150, 190][i]} h={16} />
                </div>
              )}
              {isIO ? <Ring k={hiK} r={12} pad={2} /> : null}
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: 100, top: DLG_ROW0 + IO_ROW * DLG_ROW_H + DLG_ROW_H + 4, padding: '8px 16px', borderRadius: 12, background: UI_INK, color: '#FFFFFF', fontFamily: KO, fontWeight: 700, fontSize: 28, whiteSpace: 'nowrap', opacity: ease(f, noteAt, 8), transform: `translateY(${(1 - ease(f, noteAt, 10)) * 10}px)`, boxShadow: '0 10px 24px rgba(34,33,30,0.18)' }}>
          = 실행된 뒤 저장한 양
        </div>
      </Window>
      <CursorPath f={f} kf={[{ t: sceneStart + 4, x: 760, y: 640 }, { t: checkAt, x: boxXY[0], y: boxXY[1], press: true }]} until={checkAt + 16} />
    </>
  );
};

// ───────────── 7. 단계 5: 큰 순서 · 빨리 느는 줄(그림) ─────────────
const ROWS = [
  { base: 62, rate: 0.03, name: 180 },
  { base: 100, rate: 0.03, name: 150 },
  { base: 35, rate: 0.02, name: 200 },
  { base: 18, rate: 0.01, name: 130 },
  { base: 48, rate: 0.03, name: 170 },
] as const;
const SNEAKY = 4;
const S_TOP = 96 + 76;
const S_ROW_H = 84;
const SortScene: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const sortAt = at('s3', '눌러') + 2;
  const watchAt = at('s3', '몇') - 2;
  const fastFrom = at('s3', '몇') - 4;
  const ringAt = at('s4', '빨리') - 2;
  const tagAt = at('s4', '프로그램') - 2;
  const endAt = at('s4', '모르는') - 4;
  const val = (i: number, fr: number) => {
    const r = ROWS[i];
    const fast = i === SNEAKY ? Math.max(0, fr - fastFrom) * 2.2 : 0;
    return r.base + r.rate * Math.max(0, fr - sceneStart) + fast;
  };
  const rankAt = (fr: number) => {
    if (fr < sortAt) return ROWS.map((_, i) => i);
    const order = ROWS.map((_, i) => i).sort((a, b) => val(b, fr) - val(a, fr));
    const rank: number[] = [];
    order.forEach((idx, r) => (rank[idx] = r));
    return rank;
  };
  const yOf = (i: number) => {
    let s = 0;
    for (let k = 0; k < 8; k++) s += rankAt(f - k)[i];
    return S_TOP + (s / 8) * S_ROW_H;
  };
  const maxV = 240;
  const bx = 470;
  const bw = W - 56 - bx - 40;
  const arrow = ease(f, sortAt, 6);
  const ringK = on(f, ringAt);
  const watch = interpolate(f, [watchAt, endAt], [0, 1], clamp);
  return (
    <>
      <StepDots f={f} n={5} sceneStart={sceneStart + 2} />
      <Window x={28} y={96} w={W - 56} h={H - 120}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 76, background: SOFT, borderBottom: `1.5px solid ${RULE}` }}>
          <div style={{ position: 'absolute', left: 28, top: 29 }}>
            <Bar w={120} h={18} c="#CFCBC2" />
          </div>
          <div style={{ position: 'absolute', left: bx - 28, top: 0, lineHeight: '76px', fontFamily: KO, fontWeight: 780, fontSize: 32, color: UI_INK, whiteSpace: 'nowrap' }}>
            I/O 쓰기 바이트
            <svg width={26} height={18} viewBox="0 0 26 18" style={{ marginLeft: 14, opacity: arrow, transform: `translateY(${(1 - arrow) * -6}px)` }}>
              <path d="M2 3 L13 15 L24 3 Z" fill={UI_INK} />
            </svg>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 28, top: 512, fontFamily: KO, fontWeight: 650, fontSize: 25, color: UI_INK, whiteSpace: 'nowrap', opacity: ease(f, watchAt, 6) }}>몇 초 지켜보기</div>
        <div style={{ position: 'absolute', left: 230, right: 40, top: 522, height: 10, borderRadius: 5, background: '#ECEAE4', opacity: ease(f, watchAt, 6) }}>
          <div style={{ width: `${watch * 100}%`, height: 10, borderRadius: 5, background: UI_INK }} />
        </div>
      </Window>
      {ROWS.map((r, i) => {
        const y = yOf(i);
        const v = val(i, f);
        const sneaky = i === SNEAKY && f >= fastFrom;
        return (
          <div key={i} style={{ position: 'absolute', left: 28, width: W - 56, top: y, height: S_ROW_H }}>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: '#F0EEE8' }} />
            <div style={{ position: 'absolute', left: 28, top: (S_ROW_H - 30) / 2, width: 30, height: 30, borderRadius: 8, background: sneaky ? UI_INK : '#D9D6CE' }} />
            {i === SNEAKY && f >= tagAt ? (
              <div style={{ position: 'absolute', left: 74, top: (S_ROW_H - 48) / 2, height: 48, lineHeight: '48px', padding: '0 16px', borderRadius: 12, background: UI_INK, color: '#FFFFFF', fontFamily: KO, fontWeight: 720, fontSize: 25, whiteSpace: 'nowrap', opacity: ease(f, tagAt, 6) }}>몰래 저장하는 프로그램</div>
            ) : (
              <div style={{ position: 'absolute', left: 74, top: (S_ROW_H - 16) / 2 }}>
                <Bar w={r.name} h={16} />
              </div>
            )}
            <div style={{ position: 'absolute', left: bx - 28, top: (S_ROW_H - 30) / 2, width: Math.min(bw, (v / maxV) * bw), height: 30, borderRadius: 15, background: sneaky ? UI_INK : '#CFCBC2' }} />
            {i === SNEAKY ? (
              <div style={{ position: 'absolute', left: 12, right: 12, top: 6, bottom: 6 }}>
                <Ring k={ringK} r={14} />
              </div>
            ) : null}
          </div>
        );
      })}
      <CursorPath f={f} kf={[{ t: sceneStart + 4, x: 800, y: 640 }, { t: sortAt, x: bx + 60, y: 96 + 46, press: true }]} until={sortAt + 14} />
    </>
  );
};

// ───────────── 7-2. 찾은 뒤: 모르는 이름은 AI에게(그림) ─────────────
const AskAI: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const qp = ease(f, sceneStart + 2, 8);
  const askAt = at('s4', '물어');
  const rp = ease(f, askAt - 2, 8);
  return (
    <>
      <Tag text="AI에게 물어보기" />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 96, height: 1, background: RULE }} />
      <div style={{ position: 'absolute', right: 40, top: 130, width: 660, padding: '24px 30px', borderRadius: '28px 28px 8px 28px', background: UI_INK, color: '#FFFFFF', fontFamily: KO, fontWeight: 650, fontSize: 34, lineHeight: 1.45, letterSpacing: '-0.02em', opacity: qp, transform: `translateY(${(1 - qp) * 16}px)` }}>
        <span style={{ display: 'inline-block', padding: '0 14px', borderRadius: 10, border: '2px dashed rgba(255,255,255,0.65)', fontSize: 28, lineHeight: '44px', marginBottom: 10 }}>1등 프로그램 이름</span>
        <div style={{ whiteSpace: 'nowrap' }}>이건 뭐 하는 프로그램이에요?</div>
      </div>
      <div style={{ position: 'absolute', left: 40, top: 392, width: 600, padding: '30px 32px', borderRadius: '28px 28px 28px 8px', background: '#FFFFFF', boxShadow: `0 0 0 1.5px ${RULE}`, opacity: rp, transform: `translateY(${(1 - rp) * 16}px)` }}>
        {[470, 520, 340].map((w, i) => (
          <div key={i} style={{ height: 16, width: w * ease(f, askAt + 2 + i * 5, 10), borderRadius: 8, background: BAR_GRAY, marginTop: i ? 20 : 0 }} />
        ))}
      </div>
    </>
  );
};

// ───────────── 8. 질문 ─────────────
const RECAP = [
  { t: 'Ctrl + Shift + Esc', en: true },
  { t: '세부 정보' },
  { t: '맨 윗줄 오른쪽 클릭 · 열 선택' },
  { t: 'I/O 쓰기 바이트 체크' },
  { t: '큰 순서 · 빨리 느는 줄 찾기' },
] as const;
const Ask: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const kC = on(f, at('q', '댓글') - 2);
  return (
    <>
      <div style={{ position: 'absolute', left: 38, top: 22, fontFamily: KO, fontWeight: 760, fontSize: 38, color: UI_INK, letterSpacing: '-0.03em' }}>내 PC에서 찾기</div>
      <div style={{ position: 'absolute', left: 40, top: 74, fontFamily: KO, fontWeight: 560, fontSize: 24, color: UI_MUTED }}>작업 관리자 메뉴 이름 그대로</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 114, height: 1, background: RULE }} />
      {RECAP.map((r, i) => {
        const p = ease(f, sceneStart + 2 + i * 4, 8);
        return (
          <div key={i} style={{ position: 'absolute', left: 40, right: 40, top: 126 + i * 66, height: 58, opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
            <div style={{ position: 'absolute', left: 0, top: 9, width: 40, height: 40, borderRadius: 20, background: UI_INK, color: '#FFFFFF', fontFamily: EN, fontWeight: 700, fontSize: 21, lineHeight: '40px', textAlign: 'center' }}>{i + 1}</div>
            <div style={{ position: 'absolute', left: 60, top: 0, lineHeight: '58px', fontFamily: 'en' in r ? EN : KO, fontWeight: 700, fontSize: 31, color: UI_INK, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{r.t}</div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 32, right: 32, top: 478, height: 88, borderRadius: 44, background: '#FFFFFF', boxShadow: `inset 0 0 0 1.5px ${RULE}`, opacity: ease(f, sceneStart + 20, 8) }}>
        <Ring k={kC} r={44} />
        <svg width={40} height={40} viewBox="0 0 40 40" style={{ position: 'absolute', left: 28, top: 24 }}>
          <path d="M6 8 Q6 5 9 5 L31 5 Q34 5 34 8 L34 25 Q34 28 31 28 L17 28 L10 34 L10 28 L9 28 Q6 28 6 25 Z" fill="none" stroke={UI_INK} strokeWidth={2.6} strokeLinejoin="round" />
        </svg>
        <div style={{ position: 'absolute', left: 86, top: 0, lineHeight: '88px', fontFamily: KO, fontWeight: 650, fontSize: 30, color: UI_INK }}>내 PC의 1등을 댓글로</div>
      </div>
    </>
  );
};

// ───────────── 장면표 ─────────────
type K = 'hook' | 'proof' | 'bars' | 'keys' | 'details' | 'header' | 'columns' | 'sort' | 'askai' | 'ask';
type Scene = { k: K; at: number; bg: string; o: [number, number] };
const SCENES = (): Scene[] => [
  { k: 'hook', at: 0, bg: PAPER, o: [476, 300] },
  { k: 'proof', at: VO.e1 - 2, bg: PAPER, o: [300, 420] },
  { k: 'bars', at: at('e1', '고치') - 4, bg: PAPER, o: [360, 400] },
  { k: 'keys', at: VO.s1 - 2, bg: PAPER, o: [476, 330] },
  { k: 'details', at: at('s1', '작업') - 2, bg: PAPER, o: [200, 470] },
  { k: 'header', at: VO.s2 - 2, bg: PAPER, o: [520, 160] },
  { k: 'columns', at: at('s2', '선택') + 6, bg: PAPER, o: [300, 300] },
  { k: 'sort', at: VO.s3 - 2, bg: PAPER, o: [476, 360] },
  { k: 'askai', at: at('s4', '모르는') - 4, bg: PAPER, o: [476, 300] },
  { k: 'ask', at: VO.q - 2, bg: PAPER, o: [476, 520] },
];
const sceneAt = (f: number) => {
  const sc = SCENES();
  let i = 0;
  for (let j = 0; j < sc.length; j++) if (f >= sc[j].at) i = j;
  return { i, sc };
};

const Content: React.FC<{ k: K; f: number; sceneStart: number }> = ({ k, f, sceneStart }) => {
  switch (k) {
    case 'hook':
      return <HookScene f={f} />;
    case 'proof':
      return <ProofBig f={f} sceneStart={sceneStart} />;
    case 'bars':
      return <ProofBars f={f} sceneStart={sceneStart} />;
    case 'keys':
      return <KeysScene f={f} sceneStart={sceneStart} />;
    case 'details':
      return <DetailsScene f={f} sceneStart={sceneStart} />;
    case 'header':
      return <HeaderScene f={f} sceneStart={sceneStart} />;
    case 'columns':
      return <ColumnsScene f={f} sceneStart={sceneStart} />;
    case 'sort':
      return <SortScene f={f} sceneStart={sceneStart} />;
    case 'askai':
      return <AskAI f={f} sceneStart={sceneStart} />;
    case 'ask':
      return <Ask f={f} sceneStart={sceneStart} />;
    default:
      return null;
  }
};

// ───────────── 판 + 밀기 ─────────────
const CHECK_AT = () => at('s2', '체크') + 3;
const push = (f: number, start: number) => {
  const cap = 0.08;
  const drift = Math.min(cap, 0.0007 * Math.max(0, f - start));
  const punch = interpolate(f - CHECK_AT(), [0, 3, 10], [0, 0.012, 0], clamp);
  return 1 + drift + punch;
};
const Panel: React.FC = () => {
  const f = useCurrentFrame();
  const { i, sc } = sceneAt(f);
  const s = sc[i];
  const p = push(f, s.at);
  const fadeOut = 1 - ease(f, S.end - 8, 8);
  if (fadeOut <= 0) return null;
  const dark = s.bg !== PAPER;
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
        background: s.bg,
        boxShadow: dark ? '0 0 0 1.5px rgba(255,255,255,0.16), 0 26px 70px rgba(0,0,0,0.5)' : '0 0 0 1px rgba(255,255,255,0.07), 0 26px 70px rgba(0,0,0,0.5)',
        opacity: fadeOut,
        transform: `scale(${p})`,
        transformOrigin: `${s.o[0]}px ${s.o[1]}px`,
      }}
    >
      <Content k={s.k} f={f} sceneStart={s.at} />
    </div>
  );
};

// ───────────── 머리글(말과 같은 글만 크게) ─────────────
type Head = { at: number; lines: string[]; accent?: string; size?: number };
const HEADS = (): Head[] => [
  { at: -1, lines: ['윈도우 PC가 괜히 느리면,', '뒤에서 계속 저장하는', '프로그램을 찾아보세요'], accent: '뒤에서 계속 저장하는', size: 72 },
  { at: VO.e1 - 3, lines: ['제가 만든 프로그램이', '한 시간에 4.3GB'], accent: '4.3GB' },
  { at: at('e1', '고치') - 3, lines: ['고치니까', '94MB로'], accent: '94MB' },
  { at: VO.s1 - 3, lines: ['찾는 법은 이래요'], accent: '찾는 법' },
  { at: at('s1', '컨트롤') - 3, lines: ['Ctrl + Shift + Esc로', '작업 관리자 열기'], accent: 'Ctrl + Shift + Esc' },
  { at: at('s1', '세부') - 3, lines: ['세부 정보로 가기'], accent: '세부 정보' },
  { at: VO.s2 - 3, lines: ['표 맨 윗줄을', '오른쪽 클릭'], accent: '오른쪽 클릭' },
  { at: at('s2', '선택') - 3, lines: ['열 선택에서', 'I/O 쓰기 바이트 체크'], accent: 'I/O 쓰기 바이트' },
  { at: at('s2', '실행') - 3, lines: ['I/O 쓰기 바이트는', '실행된 뒤 저장한 양'], accent: '실행된 뒤 저장한 양' },
  { at: VO.s3 - 3, lines: ['그 열 이름을 눌러', '큰 순서로 놓고', '몇 초 지켜보기'], accent: '몇 초 지켜보기', size: 74 },
  { at: at('s4', '빨리') - 3, lines: ['빨리 느는 게', '그 프로그램'], accent: '빨리 느는 게' },
  { at: at('s4', '모르는') - 3, lines: ['모르는 이름은 AI에게 묻고', '안 쓰는 거면 끄기'], accent: 'AI에게 묻고', size: 70 },
  { at: VO.q - 3, lines: ['여러분 PC의 1등은', '뭐였나요?'], accent: '1등' },
];
const Heads: React.FC = () => {
  const hs = HEADS();
  return (
    <>
      {hs.map((h, i) => (
        <Line key={i} lines={h.lines} accent={h.accent} at={h.at} until={i + 1 < hs.length ? hs[i + 1].at : S.end} fade={i + 1 === hs.length} size={h.size} top={h.lines.length > 2 ? 262 : undefined} />
      ))}
    </>
  );
};

// ───────────── 판 아래 표시 ─────────────
const LABEL: Record<K, string> = {
  hook: 'Windows 작업 관리자로 찾아요',
  proof: '제 PC에서 잰 값',
  bars: '제 PC · 고치기 전 4분(바쁠 때) · 고친 뒤 30분 잰 값',
  keys: '세 키를 함께 누르기',
  details: '작업 관리자 메뉴 이름 그대로',
  header: '맨 윗줄 = 열 이름이 있는 줄',
  columns: '작업 관리자 메뉴 이름 그대로',
  sort: '그림 · 막대는 저장한 양',
  askai: '그림 · 이름을 붙여 넣고 물어보기',
  ask: '저장해 두고 따라 해 보세요 · 댓글로 1등을 알려 주세요',
};
const Label: React.FC = () => {
  const f = useCurrentFrame();
  const o = 1 - ease(f, S.end - 8, 8);
  if (o <= 0) return null;
  const { i, sc } = sceneAt(f);
  return <div style={{ position: 'absolute', left: 72, top: VP.y + VP.h + 64, fontFamily: KO, fontWeight: 560, fontSize: 26, letterSpacing: '-0.01em', color: DIM, opacity: o }}>{LABEL[sc[i].k]}</div>;
};

// ───────────── 소리 ─────────────
// 모든 소리에 같은 마스터 값을 곱한다 — Remotion은 합이 0 dBFS를 넘는 표본을 그 자리에서 자른다(현장 노트 영상).
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
