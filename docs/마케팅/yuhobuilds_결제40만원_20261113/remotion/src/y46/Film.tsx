// Y46 본편 — AI가 고친 결제 화면: 자동 시험은 전부 통과, 손님 화면엔 395,000원이 「40만원」.
// 실화(11-10 커밋 c855a9e712): 고객 앱 방향 제안 · 결제 안내 카드의 won()이 만 원 단위로 반올림 — 그날 운영 화면에 나감, 손님 받기 전.
// 그때 시험 9개는 전부 통과(시험 값 390,000 · 290,000 · 395,500뿐). 395,000원을 넣은 시험은 고치기 전 코드에서 「40만원」으로 바로 떨어진다(11-13 다시 돌려 확인).
// 화면 캡처(public/shots)는 그 앱의 예시 의뢰 결제 화면을 고치기 전 · 뒤 코드로 다시 띄워 찍은 것 — 값만 395,000으로(기획.md 「실제 화면」).
// 끝(24.15~29.0)은 장부 머리말 「끝은 저장할 한 장」 — 고친 손님 화면 조각 + 영수증 꼴 3단계(도구 이름 없이) + 「차이 0원」, 4초 머묾.
// 이해 시험(r4) 반영: 시험 줄에 실제 시험 이름(우리말) · 0~3초 짧게 · 설명 글 크게 · 휴대폰 화면은 값 칸만 밝게 · 표 아래 까닭 한 줄 · 지난 편(어두운 무대)과 다르게 크림 무대.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { IN_OUT, mix, prog } from '../lib/motion';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const LEN = 29.0;
export const TOTAL = F(LEN);

// 시간표(초) — 목소리 낱말 시각(음성/범수/V*.json)에 맞춤
export const T = { hero: 3.3, drop: 3.75, hit: 6.4, real: 7.95, push: 8.45, day: 9.9, tests: 13.3, typeIn: 14.8, wrong: 16.7, line: 18.25, quote: 21.35, q2: 22.25, q3: 23.35, ex: 22.85, after: 24.15, card: 24.3, r1: 24.6, r2: 24.8, r3: 25.0, hit2: 25.67, same: 26.55 };
export const HERO = { from: 3.3, len: 4.6 };
export const CUT = [0, T.hero, T.real, T.tests, T.line, T.after];
export const VO: { id: string; at: number }[] = [
  { id: 'V1', at: 0.3 },
  { id: 'V2', at: 3.4 },
  { id: 'V3', at: 8.05 },
  { id: 'V4', at: 13.4 },
  { id: 'V5', at: 18.4 },
  { id: 'V6', at: 24.3 },
];

const BLACK = '#050506';
const INK = '#F4F1EA';
const CREAM = '#F3F0EA';
const INK_D = '#17191D';
const BUTTER = '#F5C445';
const GREY_D = '#6E6B64';

// 고치기 전 시험 파일의 시험 아홉(이름을 우리말로 줄임 — 둘째가 값을 보는 시험)
const TESTS = ['확인 세 단계 차례', '값 · 날짜 · 그림', '방향 화면 짜임', '다시 그려도 보던 자리', '고른 뒤 화면', '직원 화면 차례', '첫 화면 · 의뢰 글', '휴대폰 스크롤', '사진 주문 · 다시 고르기'];

const U: React.FC<{ children: React.ReactNode; c?: string; w?: number }> = ({ children, c = BUTTER, w = 1 }) => (
  <span style={{ backgroundImage: `linear-gradient(${c}, ${c})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 92%', backgroundSize: `${w * 100}% 0.2em` }}>{children}</span>
);

/** 위 큰 글 — 줄 단위로 28px 올라오며 나타남(화면 결 ③). */
const Head: React.FC<{ f: number; from: number; to: number; lines: React.ReactNode[]; size?: number; step?: number; color?: string }> = ({ f, from, to, lines, size = 92, step = 6, color = INK_D }) => {
  if (f < from || f >= to) return null;
  const out = 1 - prog(f, to - 2, 2);
  return (
    <div style={{ position: 'absolute', left: 74, width: 846, top: 286, fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.6, color }}>
      {lines.map((l, i) => {
        const p = from <= 0 && i === 0 ? 1 : prog(f, from + i * step, i === 0 ? 4 : 7);
        return (
          <div key={i} style={{ opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` }}>
            {l}
          </div>
        );
      })}
    </div>
  );
};

/** 그려지는 체크(✓) · 엑스(✕). */
const Mark: React.FC<{ p: number; kind: 'ok' | 'no'; color: string; size?: number }> = ({ p, kind, color, size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" style={{ display: 'block' }}>
    {kind === 'ok' ? (
      <polyline points="10,30 23,42 46,15" fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    ) : (
      <>
        <line x1="13" y1="13" x2="43" y2="43" stroke={color} strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, p * 2)} />
        <line x1="43" y1="13" x2="13" y2="43" stroke={color} strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0, p * 2 - 1)} />
      </>
    )}
  </svg>
);

/** 넣은 값 395,000원 아래 손님 결제 화면의 「값」 칸(실제 캡처 1:1, 배율 7.8로 찍음)을 나란히. */
const Price: React.FC<{ f: number; from: number; drop: number; hit: number; to: number; src: string; mark: 'bad' | 'good' }> = ({ f, from, drop, hit, to, src, mark }) => {
  if (f < from || f >= to) return null;
  const typed = '395,000원';
  const tp = prog(f, from + 2, 10, (x) => x);
  const shown = typed.slice(0, Math.max(1, Math.round(typed.length * tp)));
  const card = prog(f, drop, 8);
  const flow = prog(f, drop + 2, 10, IN_OUT);
  const sd = f - hit;
  const shake = mark === 'bad' && sd >= 0 && sd < 9 ? (1 - sd / 9) * 14 * Math.sin(sd * 2.4) : 0;
  const line = prog(f, hit + 2, 8);
  const glow = mark === 'good' ? prog(f, hit + 2, 14) : 0;
  const pulse = mark === 'bad' && f >= hit && f < hit + 14 ? 1 - (f - hit) / 14 : 0;
  const tag = prog(f, hit + 4, 8);
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translateX(${shake}px)` }}>
      {/* 넣은 값 */}
      <div style={{ position: 'absolute', left: 74, top: 566, fontFamily: KO, color: INK_D }}>
        <div style={{ fontWeight: 700, fontSize: 42, letterSpacing: -1, color: GREY_D }}>넣은 값</div>
        <div style={{ fontWeight: 800, fontSize: 150, letterSpacing: -4, lineHeight: 1.1, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{shown}</div>
      </div>
      {/* 넣은 값 → 손님 화면 */}
      <div style={{ position: 'absolute', left: 100, top: 790, width: 4, height: 30 * flow, background: 'rgba(23,25,29,0.4)' }} />
      <div style={{ position: 'absolute', left: 87, top: 814, width: 0, height: 0, borderLeft: '15px solid transparent', borderRight: '15px solid transparent', borderTop: '20px solid rgba(23,25,29,0.4)', opacity: flow >= 1 ? 1 : 0 }} />
      <div style={{ position: 'absolute', left: 140, top: 800, fontFamily: KO, fontWeight: 700, fontSize: 42, letterSpacing: -1, color: GREY_D, opacity: card }}>손님 결제 화면</div>
      {/* 손님 결제 화면의 값 칸 — 실제 캡처(검은 화면 조각) */}
      <div style={{ position: 'absolute', left: 54, top: 880, width: 872, height: 404, borderRadius: 26, overflow: 'hidden', background: BLACK, opacity: card, transform: `translateY(${(1 - card) * 40}px)`, boxShadow: '0 24px 50px rgba(0,0,0,0.22)' }}>
        <Img src={staticFile(src)} style={{ position: 'absolute', left: 22, top: 10, width: 832, height: 335, filter: pulse > 0 ? `brightness(${1 + 0.6 * pulse})` : undefined }} />
        <div style={{ position: 'absolute', left: 28, top: 350, height: 10, borderRadius: 5, width: (mark === 'good' ? 650 : 410) * line, background: BUTTER, boxShadow: glow > 0 ? `0 0 ${36 * glow}px ${6 * glow}px rgba(245,196,69,0.45)` : undefined }} />
        {mark === 'bad' ? (
          <div style={{ position: 'absolute', left: 474, top: 224, fontFamily: KO, fontWeight: 800, fontSize: 66, letterSpacing: -1.6, color: BUTTER, opacity: tag, transform: `translateX(${(1 - tag) * -18}px)` }}>+5,000원</div>
        ) : null}
      </div>
      <div style={{ position: 'absolute', left: 74, top: 1302, width: 846, fontFamily: KO, fontWeight: 700, fontSize: 40, lineHeight: 1.2, letterSpacing: -0.8, color: GREY_D, opacity: card }}>
        예시 의뢰로 다시 띄운 실제 앱 화면
        <br />
        {mark === 'bad' ? '고치기 전 코드' : '고친 코드'}
      </div>
    </div>
  );
};

/** 시험 9개가 차례로 통과(실제 시험 이름). */
const Tests: React.FC<{ f: number; to: number }> = ({ f, to }) => {
  if (f >= to) return null;
  const out = 1 - prog(f, to - 4, 4);
  const rowAt = (i: number) => 3 + i * 4;
  const all = prog(f, F(2.3), 8);
  return (
    <div style={{ position: 'absolute', left: 74, width: 812, top: 580, fontFamily: KO, color: INK_D, opacity: out }}>
      {TESTS.map((name, i) => {
        const p = prog(f, rowAt(i), 5);
        const m = prog(f, rowAt(i) + 3, 5);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', height: 64, borderBottom: '2px solid rgba(23,25,29,0.12)', opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
            <div style={{ fontWeight: 700, fontSize: 42, letterSpacing: -1 }}>{name}</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontWeight: 800, fontSize: 40, letterSpacing: -0.8, marginRight: 16, opacity: m }}>통과</div>
            <Mark p={m} kind="ok" color={INK_D} size={50} />
          </div>
        );
      })}
      <div style={{ marginTop: 32, fontWeight: 800, fontSize: 96, letterSpacing: -3, opacity: all, transform: `translateY(${(1 - all) * 22}px)` }}>
        9 / 9 <U w={all}>전부 통과</U>
      </div>
    </div>
  );
};

/** 시험에 넣은 값 — 390,000 · 290,000 · 395,500은 있었고 395,000은 없었다. */
const Cases: React.FC<{ f: number; from: number; typeIn: number; wrong: number; to: number }> = ({ f, from, typeIn, wrong, to }) => {
  if (f < from || f >= to) return null;
  const out = 1 - prog(f, to - 4, 4);
  const rows: { a: string; b: string }[] = [
    { a: '390,000원', b: '39만원' },
    { a: '290,000원', b: '29만원' },
    { a: '395,500원', b: '395,500원' },
  ];
  const typed = '395,000원';
  const tp = prog(f, typeIn, 16, (x) => x);
  const arrow = prog(f, typeIn + 20, 8);
  const bad = prog(f, wrong, 6);
  const why = prog(f, wrong + 5, 8);
  const sd = f - wrong;
  const shake = sd >= 0 && sd < 9 ? (1 - sd / 9) * 12 * Math.sin(sd * 2.4) : 0;
  const breathe = 0.5 + 0.5 * Math.sin(f / 5);
  const cell = (k: number): React.CSSProperties => ({ height: 146, display: 'flex', alignItems: 'center', borderBottom: '2px solid rgba(23,25,29,0.14)', opacity: prog(f, from + 4 + k * 7, 7), transform: `translateY(${(1 - prog(f, from + 4 + k * 7, 7)) * 16}px)` });
  return (
    <div style={{ position: 'absolute', left: 74, width: 812, top: 590, fontFamily: KO, color: INK_D, opacity: out }}>
      <div style={{ display: 'flex', fontWeight: 700, fontSize: 40, letterSpacing: -0.8, color: GREY_D, opacity: prog(f, from + 2, 8), paddingBottom: 10, borderBottom: '3px solid rgba(23,25,29,0.5)' }}>
        <div style={{ width: 400 }}>시험에 넣은 값</div>
        <div>화면에 뜬 값</div>
      </div>
      {rows.map((r, k) => (
        <div key={k} style={cell(k)}>
          <div style={{ width: 400, fontWeight: 800, fontSize: 62, letterSpacing: -1.6 }}>{r.a}</div>
          <div style={{ flex: 1, fontWeight: 800, fontSize: 62, letterSpacing: -1.6 }}>{r.b}</div>
          <Mark p={prog(f, from + 10 + k * 6, 7)} kind="ok" color={INK_D} size={58} />
        </div>
      ))}
      <div style={{ ...cell(3), transform: `translate(${shake}px, ${(1 - prog(f, from + 25, 7)) * 16}px)` }}>
        <div style={{ width: 400, height: 96, display: 'flex', alignItems: 'center', boxSizing: 'border-box', border: tp > 0 ? 'none' : `3px dashed rgba(23,25,29,${0.3 + 0.3 * breathe})`, borderRadius: 12, paddingLeft: tp > 0 ? 0 : 22, fontWeight: 800, fontSize: 62, letterSpacing: -1.6 }}>
          {tp > 0 ? (
            <span style={{ borderBottom: '4px dashed rgba(23,25,29,0.45)' }}>{typed.slice(0, Math.max(1, Math.round(typed.length * tp)))}</span>
          ) : (
            <span style={{ fontSize: 40, color: GREY_D, fontWeight: 700 }}>없음</span>
          )}
        </div>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 62, letterSpacing: -1.6, opacity: arrow }}>
          {bad > 0 ? <span style={{ opacity: bad, fontSize: 70 }}><U w={bad}>40만원</U></span> : <span style={{ opacity: 0.35 }}>?</span>}
        </div>
        <Mark p={bad} kind="no" color={INK_D} size={72} />
      </div>
      <div style={{ marginTop: 26, fontWeight: 700, fontSize: 40, letterSpacing: -1, color: INK_D, whiteSpace: 'nowrap', opacity: why, transform: `translateY(${(1 - why) * 14}px)` }}>
        395,000원을 만 원 단위로 줄이다 반올림해 40만원
      </div>
    </div>
  );
};

/** 한 줄 — AI에게 보낼 글 칸에 돈이 나오는 화면을 맡길 때 붙이는 요청이 쳐진다. */
const Quote: React.FC<{ f: number; from: number; to: number }> = ({ f, from, to }) => {
  if (f < from || f >= to) return null;
  const quote = F(T.quote);
  const out = 1 - prog(f, to - 4, 4);
  const box = prog(f, from + 4, 10);
  const lines: { at: number; node: React.ReactNode }[] = [
    { at: quote, node: '“반올림하지 말고,' },
    { at: F(T.q2), node: <span key="u"><U w={prog(f, F(T.q2) + 4, 10)}>끝자리 있는 값</U>으로</span> },
    { at: F(T.q3), node: '화면을 찍어 보여 줘”' },
  ];
  const caret = f < quote && Math.floor(f / 8) % 2 === 0;
  return (
    <div style={{ position: 'absolute', left: 60, width: 860, top: 600, height: 700, fontFamily: KO, color: INK_D, opacity: out * box, transform: `translateY(${(1 - box) * 24}px)` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 30, border: '3px solid rgba(23,25,29,0.16)', background: 'rgba(255,255,255,0.78)', boxSizing: 'border-box', boxShadow: '0 22px 46px rgba(0,0,0,0.08)' }} />
      <div style={{ position: 'absolute', left: 44, top: 38, fontWeight: 700, fontSize: 40, letterSpacing: -0.8, color: GREY_D }}>AI에게 보낼 글</div>
      <div style={{ position: 'absolute', left: 44, top: 118, width: 790 }}>
        {f < quote ? <div style={{ fontWeight: 400, fontSize: 80, opacity: caret ? 1 : 0 }}>|</div> : null}
        {lines.map((l, i) => {
          const p = prog(f, l.at, 8);
          return (
            <div key={i} style={{ fontWeight: 800, fontSize: 80, lineHeight: 1.26, letterSpacing: -2.4, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
              {l.node}
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 44, bottom: 44, fontWeight: 700, fontSize: 42, letterSpacing: -1, color: GREY_D, opacity: prog(f, F(T.ex), 10) }}>예) 395,000 · 105,000 · 15,000</div>
    </div>
  );
};

/** 끝 — 고친 손님 결제 화면(실제 캡처를 줄여서)과 저장할 한 장(영수증 꼴: 그대로 따라 하는 3단계 + 차이 0원). */
const EndCard: React.FC<{ f: number; from: number }> = ({ f, from }) => {
  if (f < from) return null;
  const S = 0.74;
  const card = prog(f, F(T.card), 8);
  const line = prog(f, F(T.hit2) + 2, 8);
  const glow = prog(f, F(T.hit2) + 2, 14);
  const paper = prog(f, F(T.r1) - 6, 10);
  const rows = [
    { at: F(T.r1), n: '1', text: '돈 표시는 반올림하지 않기' },
    { at: F(T.r2), n: '2', text: '끝자리 있는 값으로 화면 찍어 보기' },
    { at: F(T.r3), n: '3', text: '시험에도 그 값 넣기' },
  ];
  const total = prog(f, F(T.hit2), 8);
  const teeth = 26;
  const zig = ['0 0', '100% 0', ...Array.from({ length: teeth + 1 }, (_, i) => `${100 - (i / teeth) * 100}% ${i % 2 ? 'calc(100% - 16px)' : '100%'}`)].join(', ');
  const dash: React.CSSProperties = { position: 'absolute', left: 40, right: 44, height: 0, borderTop: '3px dashed rgba(23,25,29,0.22)' };
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: KO, color: INK_D }}>
      <div style={{ position: 'absolute', left: 64, top: 548, width: 872 * S, height: 404 * S, borderRadius: 22, overflow: 'hidden', background: BLACK, opacity: card, transform: `translateY(${(1 - card) * 30}px)`, boxShadow: '0 20px 44px rgba(0,0,0,0.2)' }}>
        <Img src={staticFile('shots/new_val.png')} style={{ position: 'absolute', left: 22 * S, top: 10 * S, width: 832 * S, height: 335 * S }} />
        <div style={{ position: 'absolute', left: 28 * S, top: 350 * S, height: 8, borderRadius: 4, width: 650 * S * line, background: BUTTER, boxShadow: glow > 0 ? `0 0 ${30 * glow}px ${5 * glow}px rgba(245,196,69,0.45)` : undefined }} />
      </div>
      <div style={{ position: 'absolute', left: 74, top: 860, fontWeight: 700, fontSize: 34, lineHeight: 1.24, letterSpacing: -0.6, color: GREY_D, opacity: card }}>
        손님 결제 화면 · 고친 코드
        <br />
        예시 의뢰로 다시 띄운 실제 앱 화면
      </div>
      <div style={{ position: 'absolute', left: 64, top: 968, width: 836, height: 458, opacity: paper, transform: `translateY(${(1 - paper) * 40}px)`, filter: 'drop-shadow(0 16px 26px rgba(0,0,0,0.10))' }}>
        <div style={{ position: 'absolute', inset: 0, background: '#FFFEFA', clipPath: `polygon(${zig})` }} />
        <div style={{ position: 'absolute', left: 40, top: 26, fontWeight: 700, fontSize: 36, letterSpacing: -0.8, color: GREY_D }}>저장 · 돈 화면을 AI에게 맡길 때</div>
        <div style={{ ...dash, top: 86 }} />
        {rows.map((r, i) => {
          const p = prog(f, r.at, 6);
          return (
            <div key={i} style={{ position: 'absolute', left: 40, top: 104 + i * 70, display: 'flex', alignItems: 'baseline', opacity: p, transform: `translateX(${(1 - p) * -16}px)` }}>
              <div style={{ width: 56, fontWeight: 800, fontSize: 40, color: GREY_D, fontVariantNumeric: 'tabular-nums' }}>{r.n}</div>
              <div style={{ fontWeight: 800, fontSize: 46, letterSpacing: -1.2 }}>{r.text}</div>
            </div>
          );
        })}
        <div style={{ ...dash, top: 322 }} />
        <div style={{ position: 'absolute', left: 40, right: 44, top: 336, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', opacity: total }}>
          <div style={{ fontWeight: 700, fontSize: 36, letterSpacing: -0.8, color: GREY_D }}>넣은 값과 화면 값 차이</div>
          <div style={{ fontWeight: 800, fontSize: 72, letterSpacing: -2, transform: `scale(${1 + 0.12 * (1 - total)})`, transformOrigin: '100% 60%' }}><U w={total}>0원</U></div>
        </div>
      </div>
    </div>
  );
};

export const Film: React.FC<{ bgm?: boolean; voice?: boolean; bare?: boolean }> = ({ bgm = true, voice = true, bare = false }) => {
  const OFF = bare ? F(HERO.from) : 0;
  const f = useCurrentFrame() + OFF;
  const t = f / FPS;
  const at = (s: number) => F(s) - OFF;

  const scene = t < T.hero ? 'A' : t < T.real ? 'B' : t < T.tests ? 'C' : t < T.line ? 'D' : t < T.after ? 'E' : 'F';
  const dark = scene === 'C';

  // 컷마다 아주 천천히 다가감 + 들어올 때 1.035배 당김(화면 결 ④)
  let ci = 0;
  for (let k = 0; k < CUT.length; k++) if (t >= CUT[k]) ci = k;
  const cEnd = ci + 1 < CUT.length ? CUT[ci + 1] : LEN;
  const inShot = Math.max(0, Math.min(1, (t - CUT[ci]) / (cEnd - CUT[ci])));
  // 올리기 전 검사(정지 41% · 4~6초 1.5초 넘는 정지) 반영 — 지난 편(Y44)과 같은 크기로 늘 다가가고 옆으로 흐른다
  // 올리기 전 검사(정지 39%) 반영 — 빛만으로는 안 잡혀, 글이 안전선(좌우 65 · 920)을 넘지 않게 왼쪽 기준으로 다가가고 위로만 흐른다
  const drift = 1 + 0.03 * inShot;
  const pan = 0;
  // 끝 장면은 머리 글과 영수증 사이가 좁아 조금만 오른다
  const rise = dark ? 0 : -(scene === 'F' ? 16 : Math.max(12, 7 * (cEnd - CUT[ci]))) * inShot;
  const lx = mix(ci % 2 === 0 ? -120 : 1200, ci % 2 === 0 ? 1200 : -120, inShot);
  const kick = CUT.slice(1).reduce((a, c) => {
    const d = f - F(c);
    return d >= 0 && d < 10 ? Math.max(a, 1 - d / 10) : a;
  }, 0);
  const pull = 1 + 0.035 * kick * kick;

  // C: 손님 휴대폰 결제 화면(고치기 전) — 값 칸만 밝히고(나머지 글은 어둡게) 그 칸으로 다가감
  const push = prog(f, F(T.push), F(4.6), IN_OUT);
  const ps = mix(1.15, 2.0, push);
  const fx = 128;
  const fy = 1712;
  const ptx = mix(300 - 1.15 * fx, 300 - 2.0 * fx, push);
  const pty = mix(1240 - 1.15 * fy, 1080 - 2.0 * fy, push);
  const hole = { x: 30, y: 1640, w: 315, h: 150 };
  const dim = 1;

  return (
    <AbsoluteFill style={{ background: dark ? BLACK : CREAM }}>
      {!dark ? <AbsoluteFill style={{ background: `radial-gradient(620px 980px at ${lx}px 900px, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 100%)` }} /> : null}
      <AbsoluteFill style={{ transform: `translate(${pan}px, ${rise}px) scale(${drift * pull})`, transformOrigin: '7% 55%' }}>
        {scene === 'A' ? <Tests f={f} to={F(T.hero)} /> : null}
        {scene === 'B' ? <Price f={f} from={F(T.hero)} drop={F(T.drop)} hit={F(T.hit)} to={F(T.real)} src="shots/old_val.png" mark="bad" /> : null}
        {scene === 'C' ? (
          <>
            <Img src={staticFile('shots/old_phone.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1996, transformOrigin: '0 0', transform: `translate(${ptx}px, ${pty}px) scale(${ps})` }} />
            <div style={{ position: 'absolute', left: ptx + ps * hole.x, top: pty + ps * hole.y, width: ps * hole.w, height: ps * hole.h, borderRadius: 16, boxShadow: `0 0 0 4000px rgba(5,5,6,${0.9 * dim})` }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 940, background: `linear-gradient(to bottom, ${BLACK} 0px, ${BLACK} 780px, rgba(5,5,6,0) 940px)` }} />
            <div style={{ position: 'absolute', left: 74, top: 560, width: 846, fontFamily: KO, fontWeight: 700, fontSize: 40, lineHeight: 1.2, letterSpacing: -0.8, color: '#9A968C', opacity: prog(f, F(T.real) + 6, 10) }}>
              예시 의뢰로 다시 띄운 실제 앱 화면
              <br />
              고치기 전 코드
            </div>
          </>
        ) : null}
        {scene === 'D' ? <Cases f={f} from={F(T.tests)} typeIn={F(T.typeIn)} wrong={F(T.wrong)} to={F(T.line)} /> : null}
        {scene === 'E' ? <Quote f={f} from={F(T.line)} to={F(T.after)} /> : null}
        {scene === 'F' ? <EndCard f={f} from={F(T.after)} /> : null}
      </AbsoluteFill>

      {!bare ? (
        <>
          <Head f={f} from={0} to={F(T.hero)} lines={['AI가 고친 결제 화면', '자동 시험은?']} size={88} step={F(0.5)} />
          <Head f={f} from={F(T.hero)} to={F(T.hit)} lines={['손님이 보는 결제 화면']} size={84} />
          <Head f={f} from={F(T.hit)} to={F(T.real)} lines={['손님 화면엔', <span key="u"><U>5천 원 더 비싸게</U></span>]} size={84} step={6} />
          <Head f={f} from={F(T.real)} to={F(T.day)} lines={['만 원 단위로', '반올림해 버렸다']} color={INK} />
          <Head f={f} from={F(T.day)} to={F(T.tests)} lines={['그날 실제 화면에 나갔다', '손님 받기 전이었다']} size={80} step={F(0.6)} color={INK} />
          <Head f={f} from={F(T.tests)} to={F(T.typeIn)} lines={['시험엔', '이 값이 없었다']} />
          <Head f={f} from={F(T.typeIn)} to={F(T.line)} lines={['넣어 보니', '바로 틀렸다']} step={F(1.7)} />
          <Head f={f} from={F(T.line)} to={F(T.after)} lines={['돈이 나오는 화면을 맡길 땐', '이 한 줄을 붙이세요']} size={76} step={F(1.4)} />
          <Head f={f} from={F(T.after)} to={TOTAL + 1} lines={['이제 손님 화면에도', <span key="u"><U w={prog(f, F(T.same), 10)}>395,000원</U> 그대로</span>]} size={84} step={F(1.3)} />
        </>
      ) : null}

      {bgm && !bare ? <Audio src={staticFile('bgm.wav')} volume={0.3} /> : null}
      {voice && !bare
        ? VO.map((v) => (
            <Sequence key={v.id} from={at(v.at)}>
              <Audio src={staticFile(`vo/${v.id}.wav`)} volume={1} />
            </Sequence>
          ))
        : null}
      {voice ? (
        <>
          {bare
            ? null
            : TESTS.map((_, i) => (
                <Sequence key={`a${i}`} from={at((3 + i * 4 + 3) / FPS)}>
                  <Audio src={staticFile(i % 2 ? 'sfx/tick.wav' : 'sfx/tick2.wav')} volume={0.3} />
                </Sequence>
              ))}
          {[T.hero].flatMap((s0) =>
            Array.from({ length: 9 }, (_, i) => (
              <Sequence key={`k${s0}${i}`} from={at(s0 + (2 + i * 1.1) / FPS)}>
                <Audio src={staticFile('sfx/tick2.wav')} volume={0.2} />
              </Sequence>
            )),
          )}
          <Sequence from={at(T.hit)}>
            <Audio src={staticFile('sfx/thud.wav')} volume={0.9} />
          </Sequence>
          {bare ? null : (
            <>
              {[T.real, T.tests, T.line, T.after].map((s) => (
                <Sequence key={`s${s}`} from={at(s)}>
                  <Audio src={staticFile('sfx/swish.wav')} volume={0.45} />
                </Sequence>
              ))}
              {Array.from({ length: 9 }, (_, i) => (
                <Sequence key={`t${i}`} from={at(T.typeIn + (i * 1.8) / FPS)}>
                  <Audio src={staticFile('sfx/tick2.wav')} volume={0.2} />
                </Sequence>
              ))}
              <Sequence from={at(T.wrong)}>
                <Audio src={staticFile('sfx/thud.wav')} volume={0.8} />
              </Sequence>
              {[T.r1, T.r2, T.r3].map((s) => (
                <Sequence key={`r${s}`} from={at(s)}>
                  <Audio src={staticFile('sfx/tick2.wav')} volume={0.28} />
                </Sequence>
              ))}
              <Sequence from={at(T.hit2)}>
                <Audio src={staticFile('sfx/tok.wav')} volume={0.85} />
              </Sequence>
              <Sequence from={at(T.same)}>
                <Audio src={staticFile('sfx/calm.wav')} volume={0.7} />
              </Sequence>
            </>
          )}
        </>
      ) : null}
    </AbsoluteFill>
  );
};
