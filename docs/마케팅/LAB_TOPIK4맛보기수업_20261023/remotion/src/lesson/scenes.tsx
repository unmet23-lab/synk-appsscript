// 장면 11개. g = 전체 프레임. 시간은 time.ts의 줄 자리(at)에 묶는다 — 목소리를 구운 뒤에도 같은 코드가 그대로 맞는다.
import React from 'react';
import { Img, staticFile } from 'remotion';
import { measureText } from '@remotion/layout-utils';
import { KO, MN, MONO } from '../lib/fonts';
import { IN_OUT, mix, mixColor, prog } from '../lib/motion';
import { ANSWER, COMMENT, DRAFT, L, MARKS, PROBLEM, type Seg } from './data';
import { at, atw, end, SCENES } from './time';
import { Ar, Art, Board, BoardHead, Check, Chip, Circ, Cross, Logo, Num, Poster, Reveal, Stroke, U, XMark } from './parts';
import { focusY, LH, SHEET_TOP, SheetLines, SheetTitle } from './sheet';
import { BOARD, CORAL, CORAL_DEEP, CORAL_SOFT, INK, INK2, INK3, LINE, POSTER_INK } from './tokens';

type P = { g: number };
/** 글 속 「→」를 Inter Tight 글리프로(SUIT는 꺾쇠처럼 그린다). */
const withAr = (t: string) => t.split('→').flatMap((x, i) => (i ? [<Ar key={i} />, x] : [x]));
const fadeIn = (g: number, id: string, len = 10) => prog(g, SCENES[id].from, len);
/** 장면 내내 아주 천천히 당긴다(정지 구간을 줄이고 판이 살아 있게, 1.12배 이하). */
const push = (g: number, id: string, to = 1.025) => mix(1, to, prog(g, SCENES[id].from, SCENES[id].to - SCENES[id].from, IN_OUT));

// ───────── 공용: 문제 글·자료 표 ─────────
const SegLine: React.FC<{ parts: Seg[]; marks?: Record<string, number> }> = ({ parts, marks = {} }) => (
  <>
    {parts.map((s, k) =>
      typeof s === 'string' ? (
        <span key={k}>{s}</span>
      ) : 'u' in s ? (
        <U key={k} p={marks[s.id] ?? 0}>
          {s.u}
        </U>
      ) : (
        <span key={k}>{s.c}</span>
      ),
    )}
  </>
);

/** 조사 기관·대상. vals = 값에 긋는 밑줄(기관, 「2022년과 2026년에」, 「외국인 유학생 400명」), keys = 이름 칸 밑줄(기관, 대상). */
const Meta: React.FC<{ size?: number; vals?: number[]; keys?: number[] }> = ({ size = 29, vals, keys }) => (
  <div style={{ display: 'grid', gap: 6, fontFamily: KO, fontSize: size, color: INK, wordBreak: 'keep-all' }}>
    {PROBLEM.meta.map(([k, v], i) => {
      const [when, who] = v.split(' 각각 ');
      return (
        <div key={k} style={{ display: 'flex', gap: 18 }}>
          <span style={{ fontWeight: 700, color: INK2, minWidth: size * 5.2 }}>{keys ? <U p={keys[i] ?? 0}>{k}</U> : k}</span>
          <span style={{ fontWeight: 500 }}>
            {!vals ? (
              v
            ) : i === 0 ? (
              <U p={vals[0]}>{v}</U>
            ) : (
              <>
                <U p={vals[1]}>{when}</U> 각각 <U p={vals[2]}>{who}</U>
              </>
            )}
          </span>
        </div>
      );
    })}
  </div>
);

const cell: React.CSSProperties = { padding: '10px 18px', borderBottom: `1.5px solid ${LINE}` };
/** circ = 「예」 줄의 두 해 비율에 두르는 동그라미(48% 먼저, 63%는 조금 뒤). */
const Table1: React.FC<{ size?: number; strong?: boolean; circ?: number }> = ({ size = 28, strong, circ = 0 }) => (
  <div style={{ fontFamily: KO, fontSize: size, color: INK }}>
    <div style={{ fontWeight: 650, marginBottom: 10, wordBreak: 'keep-all' }}>{PROBLEM.t1.caption}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', borderTop: `2px solid ${INK}` }}>
      {PROBLEM.t1.cols.map((c, i) => (
        <div key={i} style={{ ...cell, fontWeight: 650, color: INK2, textAlign: i ? 'right' : 'left' }}>{c}</div>
      ))}
      {PROBLEM.t1.rows.map((r, ri) =>
        r.map((c, i) => (
          <div key={`${ri}-${i}`} style={{ ...cell, fontWeight: i ? (strong && ri === 0 ? 800 : 600) : 600, textAlign: i ? 'right' : 'left', fontVariantNumeric: 'tabular-nums', fontSize: strong && ri === 0 && i ? size * 1.25 : size }}>
            {ri === 0 && i > 0 && circ > 0 ? <Circ p={prog(circ, (i - 1) * 0.35, 0.65)}>{c}</Circ> : c}
          </div>
        )),
      )}
    </div>
  </div>
);

/** top = 가장 많은 이유(첫 줄)에 긋는 밑줄. */
const Table2: React.FC<{ size?: number; fadeEtc?: number; order?: number; top?: number }> = ({ size = 28, fadeEtc = 1, order = 0, top = 0 }) => (
  <div style={{ fontFamily: KO, fontSize: size, color: INK }}>
    <div style={{ fontWeight: 650, marginBottom: 10, lineHeight: 1.35, wordBreak: 'keep-all' }}>{PROBLEM.t2.caption}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', borderTop: `2px solid ${INK}` }}>
      {PROBLEM.t2.rows.map(([k, v], i) => (
        <React.Fragment key={k}>
          <div style={{ ...cell, fontWeight: 600, opacity: i === 3 ? fadeEtc : 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            {i < 3 && order > 0 ? <Num n={i + 1} p={prog(order, i * 0.25, 0.3)} s={38} /> : null}
            {i === 0 && top > 0 ? <U p={prog(top, 0, 0.6)}>{k}</U> : k}
          </div>
          <div style={{ ...cell, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: i === 3 ? fadeEtc : 1 }}>{i === 0 && top > 0 ? <U p={prog(top, 0.5, 0.5)}>{v}</U> : v}</div>
        </React.Fragment>
      ))}
    </div>
  </div>
);

const MnLine: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 28, color = INK3, style }) => (
  <div style={{ fontFamily: MN, fontWeight: 500, fontSize: size, color, lineHeight: 1.3, ...style }}>{children}</div>
);

// ───────── 01 훅 ─────────
export const S01: React.FC<P> = ({ g }) => {
  const arrow = prog(g, atw('a1', '육십삼', 0.35), 18);
  const ask = prog(g, atw('a1', '어떻게', 0.79), 12);
  const dots = [0, 1, 2].map((i) => 1 - prog(g, end('a1') + 8 + i * 13, 6));
  const wrong = prog(g, at('a2', 0.0), 16, (t) => t);
  const cross = prog(g, atw('a2', '틀려요', 0.82), 14);
  return (
    <Board o={fadeIn(g, '01', 8)} scale={push(g, '01')} ox={30} oy={40}>
      <BoardHead ko={L('q1Head').ko} mn={L('q1Head').mn} />
      <div style={{ position: 'absolute', left: 92, top: 230, width: 700 }}>
        <Table1 size={34} strong />
        <svg style={{ position: 'absolute', left: 470, top: 128, width: 120, height: 44, overflow: 'visible' }} viewBox="0 0 120 44">
          <path d="M4 26 C 32 15, 66 15, 96 24" fill="none" stroke={CORAL} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - arrow} />
          <path d="M80 13 L 98 25 L 79 36" fill="none" stroke={CORAL} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog(arrow, 0.8, 0.2)} />
        </svg>
      </div>
      <div style={{ position: 'absolute', left: 900, top: 214, width: 640, opacity: ask, transform: `translateY(${mix(14, 0, ask)}px)` }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 76, letterSpacing: '-0.03em', color: INK }}>{L('how').ko}</div>
        <MnLine size={36} style={{ marginTop: 8 }}>{L('how').mn}</MnLine>
        <div style={{ display: 'flex', gap: 16, marginTop: 30 }}>
          {dots.map((d, i) => (
            <span key={i} style={{ width: 16, height: 16, borderRadius: 999, background: CORAL, opacity: 0.25 + 0.75 * d }} />
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 900, top: 494 }}>
        <Reveal p={wrong}>
          <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 80, letterSpacing: '-0.02em', color: INK }}>
            <Cross p={cross}>15% 증가했다</Cross>
          </div>
        </Reveal>
      </div>
    </Board>
  );
};

// ───────── 02 제목(코랄 포스터) ─────────
export const S02: React.FC<P> = ({ g }) => {
  const from = SCENES['02'].from;
  const len = SCENES['02'].to - from;
  const wipe = prog(g, from, 14, IN_OUT);
  const t1 = prog(g, from + 10, 14);
  const t2 = prog(g, from + 18, 14);
  const t3 = prog(g, atw('b1', '오십삼', 0.45), 14); // 「오늘은 53번을 같이 쓰면서」 — 무엇을 쓰는지(부제)와 원고지 그림이 그때 들어온다
  const drift = prog(g, from, len, (t) => t); // 장면 내내 아주 느리게(멈춰 보이지 않게, Fable 10-23)
  const note = prog(g, atw('b1', '틀렸는지도', 0.75), 12);
  return (
    <Poster clip={wipe}>
      <div style={{ position: 'absolute', left: 70, top: 58, fontFamily: MONO, fontWeight: 500, fontSize: 20, letterSpacing: '.14em', color: POSTER_INK, opacity: 0.72 }}>SYNK LAB · TOPIK II · SAMPLE CLASS</div>
      <div style={{ position: 'absolute', left: 70, top: 104, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderRadius: 999, background: 'rgba(255,255,255,.92)', opacity: t1 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: CORAL }} />
        <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 26, color: POSTER_INK }}>{L('sampleChip').ko}</span>
        <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 24, color: 'rgba(30,14,10,.7)' }}>{L('sampleChip').mn}</span>
      </div>
      <div style={{ position: 'absolute', left: 62, top: 230, opacity: t1, transform: `translateY(${mix(24, 0, t1)}px) scale(${mix(1, 1.02, drift)})`, transformOrigin: '0 50%' }}>
        <div style={{ fontFamily: KO, fontWeight: 820, fontSize: 230, lineHeight: 1, letterSpacing: '-0.055em', color: POSTER_INK }}>{L('title').ko}</div>
      </div>
      <div style={{ position: 'absolute', left: 70, top: 500, opacity: t3, transform: `translateY(${mix(16, 0, t3)}px)` }}>
        <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 56, letterSpacing: '-0.02em', color: POSTER_INK }}>{L('subtitle').ko}</div>
        <MnLine size={34} color="rgba(30,14,10,.72)" style={{ marginTop: 8 }}>
          {L('title').mn} · {L('subtitle').mn}
        </MnLine>
      </div>
      <div style={{ position: 'absolute', left: 70, bottom: 50, opacity: t2, fontFamily: KO, fontWeight: 650, fontSize: 26, color: 'rgba(30,14,10,.78)' }}>
        {L('levelLine').ko} <span style={{ fontFamily: MN, fontWeight: 500, marginLeft: 10 }}>{L('levelLine').mn}</span>
      </div>
      <Art name="grid" style={{ right: 110, top: 150, width: 470, transform: `rotate(${mix(-5, -4.3, drift)}deg) translateY(${mix(30, 0, t3) - 8 * drift}px)`, opacity: t3 }} />
      {/* 「왜 틀렸는지도 알려 드릴게요」 — 훅의 그 문장이 쪽지로 붙는다 */}
      <div style={{ position: 'absolute', right: 150, top: 560, padding: '14px 24px', borderRadius: 14, background: '#FFFFFF', boxShadow: '0 14px 30px rgba(30,14,10,.22)', transform: `rotate(-3deg) translateY(${mix(16, 0, note)}px)`, opacity: note }}>
        <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 40, color: POSTER_INK }}>
          <Cross p={prog(g, atw('b1', '틀렸는지도', 0.75) + 14, 14)} w={6}>
            15% 증가했다?
          </Cross>
        </span>
      </div>
    </Poster>
  );
};

// ───────── 03 문제 ─────────
export const S03: React.FC<P> = ({ g }) => {
  const m = { 'c-len': prog(g, atw('c1', '이백', 0.42), 14), 'c-title': prog(g, atw('c1', '제목은', 0.84), 14) };
  const box = prog(g, atw('c1', '조사', 0.22), 24, (t) => t); // 「조사 자료를」 — 자료 칸을 펜으로 두른다
  // c2 「내 생각을 쓰는 문제가 아니에요」 → 「자료에 있는 것만 … 정확하게」: 판을 덮고 한 박자씩
  const veil = prog(g, atw('c2', '생각을', 0.13), 14);
  const mine = prog(g, atw('c2', '아니에요', 0.36), 14);
  const only = prog(g, atw('c2', '자료에', 0.48), 14);
  const under = prog(g, atw('c2', '정확하게', 0.74), 16);
  return (
    <Board o={fadeIn(g, '03')} scale={push(g, '03')} ox={30} oy={40}>
      <BoardHead ko={L('problemHead').ko} mn={L('problemHead').mn} />
      <Stroke d="M26 5 H 1476 Q 1497 5 1497 26 V 460 Q 1497 481 1476 481 H 26 Q 5 481 5 460 V 26 Q 5 5 30 4" p={box} w={4} box={{ x: 59, y: 231, w: 1502, h: 486 }} />
      <div style={{ position: 'absolute', left: 64, top: 104, width: 1490, fontFamily: KO, fontWeight: 500, fontSize: 33, lineHeight: 1.62, color: INK, wordBreak: 'keep-all' }}>
        {PROBLEM.instr.map((parts, i) => (
          <div key={i}>
            <SegLine parts={parts} marks={m} />
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 64, top: 236, right: 64, bottom: 44, borderRadius: 18, boxShadow: `inset 0 0 0 1.5px ${LINE}`, padding: '26px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
          <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 24, color: INK2 }}>{L('dataLabel').ko}</span>
          <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 21, color: INK3 }}>{L('dataLabel').mn}</span>
        </div>
        <Meta size={26} />
        <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 44, marginTop: 22 }}>
          <Table1 size={25} />
          <Table2 size={25} />
        </div>
      </div>
      {veil > 0 ? (
        <div style={{ position: 'absolute', inset: 0, background: `rgba(255,255,255,${0.92 * veil})`, display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ opacity: veil * mix(1, 0.5, only), transform: `translateY(${mix(16, 0, veil)}px)` }}>
              <div style={{ fontFamily: KO, fontWeight: 750, fontSize: 64, letterSpacing: '-0.03em', color: INK2 }}>
                <Cross p={mine} w={6}>
                  {L('myThought').ko}
                </Cross>
              </div>
              <MnLine size={28} style={{ marginTop: 4 }}>{L('myThought').mn}</MnLine>
            </div>
            <div style={{ marginTop: 44, opacity: only, transform: `translateY(${mix(16, 0, only)}px)` }}>
              <div style={{ fontFamily: KO, fontWeight: 820, fontSize: 124, letterSpacing: '-0.04em', color: INK }}>
                <U p={under} w={9}>
                  {L('onlyData').ko}
                </U>
              </div>
              <MnLine size={44} style={{ marginTop: 26 }}>{L('onlyData').mn}</MnLine>
            </div>
          </div>
        </div>
      ) : null}
    </Board>
  );
};

// ───────── 04 쓸 것 셋 → 글의 순서 ─────────
const BOXES = [
  { n: 1, ko: L('box1').ko, mn: L('box1').mn },
  { n: 2, ko: L('box2').ko, mn: L('box2').mn },
  { n: 3, ko: L('box3').ko, mn: L('box3').mn },
  { n: 4, ko: L('box4').ko, mn: L('box4').mn },
];
/** 빈 번호 자리(점선 동그라미) — 「세 가지를 먼저 찾아요」 때 셋이 비어 있다가 d2에서 번호가 들어선다. */
const Slot: React.FC<{ p: number; s?: number; style?: React.CSSProperties }> = ({ p, s = 50, style }) => (
  <svg width={s} height={s} viewBox="0 0 40 40" style={{ overflow: 'visible', opacity: p, transform: `scale(${mix(0.8, 1, p)})`, ...style }}>
    <circle cx={20} cy={20} r={17} fill="none" stroke={CORAL} strokeWidth={3} strokeDasharray="5 4" />
  </svg>
);
/** 실제 수업이라면 채팅에 올라올 답(가상) — 한국어로 답한다. */
const CHAT = ['조사 대상은 유학생 400명', '48%에서 63%로 늘었어요', '생활비가 제일 많아요'];
export const S04: React.FC<P> = ({ g }) => {
  // 번호·칸은 그 낱말을 말할 때(구운 뒤 낱말 시각, 그 전엔 음절로 잰 자리)
  const n1 = prog(g, atw('d2', '하나,', 0.02), 16);
  const n2 = prog(g, atw('d2', '둘,', 0.38), 16);
  const n3 = prog(g, atw('d2', '셋,', 0.7), 16);
  // 「누가 언제 누구에게」 「무엇이 달라졌는지」 「무엇이 가장 많은지」 — 번호를 단 뒤 그 자리에 펜
  const who = [prog(g, atw('d2', '누가', 0.08), 12), prog(g, atw('d2', '언제', 0.13), 12), prog(g, atw('d2', '누구에게', 0.19), 12)];
  const changed = prog(g, atw('d2', '달라졌는지', 0.54), 22, (t) => t);
  const most = prog(g, atw('d2', '가장', 0.88), 20, (t) => t);
  const box = [prog(g, atw('d3', '소개,', 0.56), 12), prog(g, atw('d3', '하나,', 0.63), 12), prog(g, atw('d3', '둘,', 0.75), 12), prog(g, atw('d3', '정리.', 0.9), 12)];
  const slots = prog(g, atw('d1', '세', 0.17), 12);
  const chatOut = prog(g, at('d3', 0), 12); // 채팅 몫이 끝나면 오른쪽을 글의 순서에 내준다
  const chat = prog(g, atw('d1', '실제', 0.44), 12) * (1 - chatOut);
  const bubbles = [atw('d1', '채팅으로', 0.7), atw('d1', '여러분', 0.8), atw('d1', '답을', 0.88)].map((a) => prog(g, a, 10) * (1 - chatOut));
  const order = prog(g, atw('d3', '글의', 0.34), 12);
  return (
    <Board o={fadeIn(g, '04')} scale={push(g, '04')} ox={30} oy={40}>
      <BoardHead ko={L('findHead').ko} mn={L('findHead').mn} />
      <div style={{ position: 'absolute', right: 64, top: 36, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 999, boxShadow: `inset 0 0 0 2px ${CORAL}`, opacity: chat }}>
        <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 22, color: CORAL_DEEP }}>{L('chatPill').ko}</span>
        <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 20, color: INK3 }}>{L('chatPill').mn}</span>
      </div>
      <div style={{ position: 'absolute', left: 120, top: 112, width: 820 }}>
        <div style={{ position: 'relative' }}>
          <Slot p={slots * (1 - n1)} style={{ position: 'absolute', left: -66, top: -4 }} />
          <Num n={1} p={n1} s={50} style={{ position: 'absolute', left: -66, top: -4 }} />
          <Meta size={27} vals={who} />
        </div>
        <div style={{ position: 'relative', marginTop: 30 }}>
          <Slot p={slots * (1 - n2)} style={{ position: 'absolute', left: -66, top: -6 }} />
          <Num n={2} p={n2} s={50} style={{ position: 'absolute', left: -66, top: -6 }} />
          <Table1 size={25} circ={changed} />
        </div>
        <div style={{ position: 'relative', marginTop: 26 }}>
          <Slot p={slots * (1 - n3)} style={{ position: 'absolute', left: -66, top: -6 }} />
          <Num n={3} p={n3} s={50} style={{ position: 'absolute', left: -66, top: -6 }} />
          <Table2 size={23} top={most} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1010, top: 150, width: 546, display: 'grid', gap: 16, justifyItems: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, opacity: bubbles[0] }}>
          <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 21, color: INK3 }}>{L('chatEx').ko}</span>
          <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 19, color: INK3 }}>{L('chatEx').mn}</span>
        </div>
        {CHAT.map((c, i) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: bubbles[i], transform: `translateY(${mix(12, 0, bubbles[i])}px)` }}>
            <span style={{ width: 34, height: 34, borderRadius: 999, background: '#E7E7E4', flex: 'none' }} />
            <span style={{ padding: '12px 22px', borderRadius: 22, borderTopLeftRadius: 6, background: '#F2F2F0', fontFamily: KO, fontWeight: 600, fontSize: 27, color: INK }}>{withAr(c)}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 1012, top: 46, display: 'flex', alignItems: 'baseline', gap: 12, opacity: order }}>
        <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 26, color: CORAL_DEEP }}>{L('orderHead').ko}</span>
        <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 22, color: INK3 }}>{L('orderHead').mn}</span>
      </div>
      <div style={{ position: 'absolute', left: 1010, top: 120, width: 546, display: 'grid', gap: 16 }}>
        {BOXES.map((b, i) => (
          <div key={b.n} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '20px 24px', borderRadius: 18, background: i === 3 ? CORAL_SOFT : '#F4F4F2', opacity: box[i], transform: `translateX(${mix(24, 0, box[i])}px)` }}>
            <Num n={b.n} p={box[i]} s={48} />
            <div>
              <div style={{ fontFamily: KO, fontWeight: 750, fontSize: 36, color: INK }}>{b.ko}</div>
              <MnLine size={24}>{b.mn}</MnLine>
            </div>
          </div>
        ))}
      </div>
    </Board>
  );
};

// ───────── 05~08 답안 판 + 오른쪽 도움 판 ─────────
const Side: React.FC<{ children: React.ReactNode; o?: number }> = ({ children, o = 1 }) => (
  <div style={{ position: 'absolute', left: 1120, top: 120, width: 436, bottom: 52, borderRadius: 20, background: '#F5F5F3', padding: '26px 28px', opacity: o, wordBreak: 'keep-all' }}>{children}</div>
);
const SideHead: React.FC<{ n: number; ko: string; mn: string }> = ({ n, ko, mn }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
    <Num n={n} p={1} s={46} />
    <div>
      <div style={{ fontFamily: KO, fontWeight: 750, fontSize: 32, color: INK }}>{ko}</div>
      <MnLine size={22}>{mn}</MnLine>
    </div>
  </div>
);
const sheetCam = (g: number, id: string) => push(g, id, 1.015) + 0.025 * prog(g, SCENES[id].from, 24, IN_OUT);

/** 그 줄 글자의 실제 폭(답안 판 서체) — 줄 끝 ✓ 자리. */
const sheetW = (row: number) => measureText({ text: ANSWER[row].parts.map((s) => (typeof s === 'string' ? s : 'u' in s ? s.u : s.c)).join(''), fontFamily: 'SUIT', fontSize: 32, fontWeight: '500' }).width;
export const S05: React.FC<P> = ({ g }) => {
  // 표현 두 줄은 답안에 밑줄이 그어질 때 오른쪽에도 뜬다(MARK_AT과 같은 낱말). 「조사 기관과 대상이 있는 자료는」 때 그 칸에 밑줄.
  const expr = [prog(g, atw('e3', '사백', 0.04), 12), prog(g, atw('e3', '아르바이트에', 0.2), 12)];
  const keys = [prog(g, atw('e3', '기관과', 0.55), 12), prog(g, atw('e3', '대상이', 0.62), 12)];
  const ok = prog(g, atw('e3', '이렇게', 0.88), 16); // 「소개 문장을 이렇게 써요」 — 첫 문장 끝에 ✓
  return (
    <Board o={fadeIn(g, '05')} scale={sheetCam(g, '05')} ox={32} oy={focusY(g, 1, BOARD.h)}>
      <SheetTitle />
      <SheetLines g={g} upto={1} />
      <Check p={ok} s={40} style={{ position: 'absolute', left: 64 + sheetW(2) + 22, top: SHEET_TOP + 2 * LH + 2 }} />
      <Side o={prog(g, SCENES['05'].from + 4, 12)}>
        <SideHead n={1} ko={L('box1').ko} mn={L('box1').mn} />
        <Meta size={22} keys={keys} />
        <div style={{ marginTop: 26, fontFamily: KO, fontSize: 25, lineHeight: 1.6, color: INK2 }}>
          <div style={{ opacity: expr[0], transform: `translateX(${mix(10, 0, expr[0])}px)` }}>
            <b style={{ color: CORAL_DEEP }}>~을 대상으로</b>
          </div>
          <div style={{ opacity: expr[1], transform: `translateX(${mix(10, 0, expr[1])}px)` }}>
            <b style={{ color: CORAL_DEEP }}>~에 대해 조사하였다</b>
          </div>
        </div>
      </Side>
    </Board>
  );
};

export const S06: React.FC<P> = ({ g }) => {
  // f3은 셈을 말하는 차례대로 한 조각씩: 「처음 질문」 → 48→63 밑줄 → +15 → 「15% 증가」 → = 48의 15% → 55.2% → ✗
  const recall = prog(g, atw('f3', '처음', 0.0), 12);
  const plus = prog(g, atw('f3', '십오가', 0.28), 12);
  const c1 = prog(g, atw('f3', '증가라고', 0.5), 12);
  const c2 = prog(g, atw('f3', '사십팔의', 0.62), 12);
  const c2b = prog(g, atw('f3', '늘었다는', 0.73), 12); // 「…만큼 늘었다는 뜻」 — 늘어난 몫 7.2
  const c3 = prog(g, atw('f3', '오십오', 0.9), 12);
  const wrong = prog(g, atw('f3', '정도예요', 0.95), 14);
  const minus = prog(g, atw('f4', '퍼센트끼리', 0.18), 12);
  const right = prog(g, atw('f4', '퍼센트포인트라고', 0.6), 14);
  const two = prog(g, atw('f5', '두', 0.74), 14); // 「이 두 표현도 같이 기억해요」 — 셈은 물러나고 표현 둘
  const focus = prog(g, atw('f3', '그런데', 0.38), 24, IN_OUT) * (1 - prog(g, at('f5', 0.0), 24, IN_OUT));
  return (
    <Board o={fadeIn(g, '06')} scale={sheetCam(g, '06')} ox={mix(32, 55, focus)} oy={mix(focusY(g, 2, BOARD.h), 46, focus)}>
      <SheetTitle />
      <SheetLines g={g} upto={2} dimBefore={2} />
      <Side o={prog(g, SCENES['06'].from + 4, 12)}>
        <SideHead n={2} ko={L('box2').ko} mn={L('box2').mn} />
        <div style={{ opacity: recall * mix(1, 0.4, two), transform: `translateY(${mix(10, 0, recall)}px)` }}>
          <div style={{ fontFamily: KO, fontSize: 26, color: INK2, fontWeight: 600 }}>질문 1 · 「예」</div>
          <div style={{ position: 'relative', fontFamily: KO, fontSize: 46, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums', margin: '6px 0 18px' }}>
            <U p={prog(g, atw('f3', '사십팔에서', 0.1), 14)}>
              48% <Ar /> 63%
            </U>
            <span style={{ marginLeft: 16, fontSize: 34, color: CORAL_DEEP, opacity: plus, display: 'inline-block', transform: `translateY(${mix(8, 0, plus)}px)` }}>+15</span>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 18, opacity: mix(1, 0.4, two) }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: KO, fontSize: 26, fontWeight: 650, color: INK, lineHeight: 1.45, opacity: c1 }}>
            <XMark p={wrong} s={34} style={{ marginTop: 2, flex: 'none' }} />
            <div>
              <div style={{ color: INK2 }}>
                「15% 증가」<span style={{ opacity: c2 }}> = 48의 15%</span>
                <span style={{ opacity: c2b, color: CORAL_DEEP }}>(7.2)</span>
              </div>
              <div style={{ opacity: c3 }}>
                48% + 7.2 = 55.2%
                <span style={{ opacity: wrong, color: CORAL_DEEP }}>
                  {' '}
                  <span style={{ fontFamily: MN }}>≠</span> 63%
                </span>
              </div>
            </div>
          </div>
          {/* 답은 말할 때까지 보이지 않는다(Fable 10-23) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: KO, fontSize: 30, fontWeight: 800, color: INK, opacity: minus }}>
            <Check p={right} s={34} />
            <span>
              63 − 48 = <span style={{ color: CORAL_DEEP, opacity: right }}>{L('point').ko}</span>
            </span>
          </div>
          <MnLine size={24} style={{ opacity: right }}>
            {L('point').ko} = {L('point').mn}
          </MnLine>
        </div>
        <div style={{ marginTop: 18, fontFamily: KO, fontSize: 25, lineHeight: 1.6, opacity: two, transform: `translateX(${mix(10, 0, two)}px)` }}>
          <div>
            <b style={{ color: CORAL_DEEP }}>~에서 ~로</b>
          </div>
          <div>
            <b style={{ color: CORAL_DEEP }}>~(으)ㄴ 것으로 나타났다</b>
          </div>
        </div>
      </Side>
    </Board>
  );
};

export const S07: React.FC<P> = ({ g }) => {
  const order = prog(g, at('g1', 0.4), 40, (t) => t);
  const etc = 1 - 0.65 * prog(g, atw('g3', '기타는', 0.72), 12);
  return (
    <Board o={fadeIn(g, '07')} scale={sheetCam(g, '07')} ox={32} oy={focusY(g, 3, BOARD.h)}>
      <SheetTitle />
      <SheetLines g={g} upto={3} dimBefore={3} />
      <Side o={prog(g, SCENES['07'].from + 4, 12)}>
        <SideHead n={3} ko={L('box3').ko} mn={L('box3').mn} />
        <Table2 size={22} order={order} fadeEtc={etc} />
        <div style={{ marginTop: 16, fontFamily: KO, fontSize: 23, fontWeight: 650, color: CORAL_DEEP, opacity: prog(g, atw('g3', '기타는', 0.75), 12) }}>「기타」는 쓰지 않아도 돼요</div>
      </Side>
    </Board>
  );
};

/** 네 문장 마지막 「다.」 아래 짧은 밑줄 자리 — 실제 서체로 잰다(Fable 10-23 「말은 끝을 가리키는데 점은 줄머리」). */
const ENDS = [2, 5, 9, 11].map((row) => {
  const text = ANSWER[row].parts.map((s) => (typeof s === 'string' ? s : 'u' in s ? s.u : s.c)).join('');
  const all = measureText({ text, fontFamily: 'SUIT', fontSize: 32, fontWeight: '500' }).width;
  const tail = measureText({ text: '다.', fontFamily: 'SUIT', fontSize: 32, fontWeight: '500' }).width;
  return { row, x: all - tail, w: tail };
});
export const S08: React.FC<P> = ({ g }) => {
  const outline = [0.3, 0.55, 0.8].map((f) => prog(g, at('h1', f), 12));
  const meter = prog(g, at('h3', 0.02), 14);
  const ends = prog(g, atw('h3', '네', 0.55), 18);
  return (
    <Board o={fadeIn(g, '08')} scale={sheetCam(g, '08')} ox={32} oy={focusY(g, 4, BOARD.h)}>
      <SheetTitle />
      <SheetLines g={g} upto={4} dimBefore={4} />
      {ENDS.map((e, i) => {
        const p = prog(ends, i * 0.2, 0.3);
        return <div key={e.row} style={{ position: 'absolute', left: 64 + e.x - 2, top: SHEET_TOP + e.row * LH + LH - 9, width: e.w * p, height: 5, borderRadius: 3, background: CORAL }} />;
      })}
      <Side o={prog(g, SCENES['08'].from + 4, 12)}>
        <SideHead n={4} ko={L('box4').ko} mn={L('box4').mn} />
        {/* h1 「앞의 결과를 한 문장으로 모아요」 — 결과 둘이 정리 한 문장으로 모이는 모습 */}
        <div style={{ display: 'grid', gap: 8, fontFamily: KO, fontSize: 23, fontWeight: 600, color: INK2, marginBottom: 22, opacity: 1 - 0.55 * meter }}>
          <div style={{ opacity: outline[0] }}>결과 1 · 48% <Ar /> 63%, 늘었다</div>
          <div style={{ opacity: outline[1] }}>결과 2 · 이유는 생활비 마련</div>
          <div style={{ opacity: outline[2], color: CORAL_DEEP, fontWeight: 750 }}>
            <Ar /> 이처럼 + 한 문장
          </div>
        </div>
        <div style={{ opacity: meter }}>
          <div style={{ fontFamily: KO, fontSize: 24, fontWeight: 650, color: INK2 }}>
            {L('countLabel').ko}
            <MnLine size={21}>{L('countLabel').mn}</MnLine>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <div style={{ fontFamily: KO, fontSize: 80, fontWeight: 820, color: INK, letterSpacing: '-0.03em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>281자</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: KO, fontSize: 24, fontWeight: 650, color: INK2 }}>
              <Check p={meter} s={28} /> 200~300
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18, fontFamily: KO, fontSize: 25, fontWeight: 650, color: INK, opacity: ends }}>
          {L('endsLabel').ko}
          <MnLine size={21}>{L('endsLabel').mn}</MnLine>
        </div>
      </Side>
    </Board>
  );
};

// ───────── 09 첨삭 ─────────
// 기호마다 세 박자: 그 말을 꺼낼 때 기호(mark) → 무엇이 문제인지 말할 때 설명(say) → 고칠 꼴을 말할 때 고친 꼴(fix, 한국어 그대로).
type Beat = [line: string, needle: string, frac: number];
const MARK_T: Record<string, { mark: Beat; say: Beat; fix?: Beat }> = {
  체: { mark: ['i3', '조사했습니다는', 0.08], say: ['i3', '문체가', 0.26], fix: ['i3', '습니다예요', 0.87] },
  조: { mark: ['i4', '육십삼', 0.09], say: ['i4', '이가', 0.39], fix: ['i4', '가를', 0.56] },
  낱: { mark: ['i5', '십오', 0.09], say: ['i5', '단어를', 0.41], fix: ['i5', '처음', 0.77] },
  자: { mark: ['i6', '물가가', 0.02], say: ['i6', '자료에', 0.57] },
  '+': { mark: ['i7', '잘', 0.02], say: ['i7', '잘', 0.02] },
};
const FIX: Record<string, [string, string]> = { 체: ['-습니다 → ', '-다'], 조: ['', '63%이 → 63%가'], 낱: ['', '15% → 15%포인트'] };
// 〔체〕는 두 박자로 쌓는다 — 「다른 문장은 끝이 다인데」에 「-다」가 먼저, 「여기만 습니다」에 「-습니다 →」가 그 앞에 붙는다.
const FIX_FIRST: Record<string, Beat> = { 체: ['i3', '다인데', 0.69] };
export const S09: React.FC<P> = ({ g }) => {
  const beat = (b: Beat | undefined, len = 14) => (b ? prog(g, atw(b[0], b[1], b[2]), len) : 0);
  const mp = (code: string) => beat(MARK_T[code].mark);
  // i3 「다른 문장은 끝이 「다」인데, 여기만 「습니다」예요」 — 문장 끝이 펜 색으로, i4에서 제 색으로 돌아간다
  const back = 1 - prog(g, at('i4', 0), 12);
  const endsP = (row: number) => prog(g, atw('i3', '다인데', 0.69) + (row - 2) * 4, 10) * back; // 위 줄부터 차례로
  const supP = beat(MARK_T['체'].fix, 10) * back;
  const five = prog(g, atw('i2', '다섯', 0.25), 12); // 「다섯 곳까지」 — 빈 칸 다섯이 기호로 찬다
  const card = prog(g, at('i8', 0.05), 18, IN_OUT);
  const shrink = mix(1, 0.55, card);
  const chipsOn = card < 0.5 ? 1 : 0; // 줄어든 학생 글에서는 칩을 끈다(얼룩처럼 보여서)
  const pill = prog(g, atw('i1', '예시로', 0.55), 10);
  const listHead = prog(g, atw('i2', '다섯', 0.25), 10); // 「다섯 곳까지」 — 머리와 빈 칸 다섯이 같이
  // i9 「다시 써 볼 곳은 다음 주 숙제와 함께」 — 셋째 줄을 두르고, 다음 주 숙제 표를 붙인다
  const redo = prog(g, atw('i9', '다시', 0.02), 14);
  const nextHw = prog(g, atw('i9', '숙제와', 0.47), 12);
  return (
    <Board o={fadeIn(g, '09')} scale={push(g, '09')} ox={30} oy={40}>
      <BoardHead ko={L('draft').ko} mn={L('draft').mn} />
      <div style={{ position: 'absolute', left: 520, top: 38, display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', borderRadius: 999, boxShadow: `inset 0 0 0 2px ${CORAL}`, opacity: pill }}>
        <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 21, color: CORAL_DEEP }}>{L('madeUp').ko}</span>
        <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 19, color: INK3 }}>{L('madeUp').mn}</span>
      </div>
      <div style={{ position: 'absolute', left: 64, top: mix(104, 92, card), width: 1060, transform: `scale(${shrink})`, transformOrigin: '0 0' }}>
        {DRAFT.map((line, i) => (
          // i1 동안 학생 글이 한 줄씩 나온다. 한마디 판이 오르면 앞 네 줄만 남긴다.
          <Reveal key={i} p={prog(g, at('i1', (i / DRAFT.length) * 0.8), 9, (t) => t)} style={{ opacity: i >= 4 ? 1 - card : 1 }}>
            <div style={{ fontFamily: KO, fontWeight: 500, fontSize: 33, lineHeight: 2.3, color: INK, whiteSpace: 'nowrap' }}>
              {line.map((s, k) => {
                if (typeof s === 'string') return <span key={k}>{s}</span>;
                if ('h' in s) return <span key={k} style={{ color: mixColor(INK, CORAL_DEEP, endsP(i)) }}>{s.h}</span>;
                const p = mp(s.m);
                const text = s.end ? (
                  <>
                    {s.t.slice(0, -s.end.length)}
                    <span style={{ color: mixColor(INK, CORAL_DEEP, s.m === '체' ? supP : endsP(i)) }}>{s.end}</span>
                  </>
                ) : (
                  s.t
                );
                const body = s.m === '조' ? <Circ p={p} pad={0.3}>{text}</Circ> : <U p={p} double={s.m === '+'}>{text}</U>;
                return (
                  <span key={k}>
                    {s.m === '+' ? <Chip code="+" p={p * chipsOn} outline start /> : null}
                    {body}
                    {s.chip ? <Chip code={s.m} p={p * chipsOn} /> : null}
                  </span>
                );
              })}
            </div>
          </Reveal>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 1160, top: 112, width: 396, opacity: 1 - card }}>
        <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 24, color: INK2, marginBottom: 12, opacity: listHead }}>
          {L('marks').ko} <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 20, color: INK3, marginLeft: 6 }}>{L('marks').mn}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, opacity: five }}>
          {MARKS.map((m) => {
            const p = mp(m.code);
            return (
              <span key={m.code} style={{ position: 'relative', width: 52, height: 34 }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: 9, border: '2px dashed rgba(8,9,12,.24)', opacity: 1 - p }} />
                <span style={{ position: 'absolute', inset: 0, borderRadius: 9, display: 'grid', placeItems: 'center', fontFamily: KO, fontWeight: 800, fontSize: 20, color: m.code === '+' ? CORAL_DEEP : '#FFFFFF', background: m.code === '+' ? '#FFFFFF' : CORAL, boxShadow: m.code === '+' ? `inset 0 0 0 2.5px ${CORAL}` : 'none', opacity: p, transform: `scale(${mix(0.85, 1, p)})` }}>{m.code}</span>
              </span>
            );
          })}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {MARKS.map((m) => {
            const p = mp(m.code);
            const ps = beat(MARK_T[m.code].say, 12);
            const pf = beat(MARK_T[m.code].fix, 12);
            const fix = FIX[m.code];
            const p2 = FIX_FIRST[m.code] ? beat(FIX_FIRST[m.code], 12) : pf;
            return (
              <div key={m.code} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', alignItems: 'baseline', opacity: p, transform: `translateX(${mix(12, 0, p)}px)` }}>
                <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 26, color: CORAL_DEEP }}>〔{m.code}〕</span>
                <div>
                  <div style={{ opacity: ps, transform: `translateX(${mix(8, 0, ps)}px)` }}>
                    <div style={{ fontFamily: KO, fontWeight: 650, fontSize: 28, color: INK }}>{m.ko}</div>
                    <MnLine size={24}>{m.mn}</MnLine>
                  </div>
                  {fix ? (
                    <div style={{ marginTop: 4, fontFamily: KO, fontWeight: 750, fontSize: 27, color: CORAL_DEEP }}>
                      <span style={{ opacity: pf }}>{withAr(fix[0])}</span>
                      <span style={{ opacity: p2 }}>{withAr(fix[1])}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {card > 0 ? (
        <div style={{ position: 'absolute', left: 40, right: 40, bottom: 30, height: 470, borderRadius: 22, background: '#FBF4F2', boxShadow: `inset 0 0 0 2px ${CORAL_SOFT}, 0 -10px 40px rgba(8,9,12,.08)`, padding: '24px 36px', transform: `translateY(${mix(520, 0, card)}px)`, wordBreak: 'keep-all' }}>
          <div style={{ fontFamily: KO, fontWeight: 750, fontSize: 28, color: CORAL_DEEP, marginBottom: 12 }}>
            {L('comment').ko} <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 22, color: INK3, marginLeft: 8 }}>{L('comment').mn}</span>
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            {COMMENT.map((c, i) => (
              <div
                key={c.k}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '220px 1fr',
                  gap: 20,
                  opacity: prog(g, at('i8', [0.48, 0.62, 0.78][i]), 10),
                  // 「다시 써 볼 곳」 줄을 펜 색 테두리로 두른다(자리는 그대로 — 테두리는 바깥으로)
                  borderRadius: 14,
                  boxShadow: i === 2 ? `0 0 0 ${10 * redo}px rgba(255,255,255,${0.9 * redo}), 0 0 0 ${12.5 * redo}px ${CORAL}` : 'none',
                  background: i === 2 ? `rgba(255,255,255,${0.9 * redo})` : 'transparent',
                }}
              >
                <div>
                  <div style={{ fontFamily: KO, fontWeight: 750, fontSize: 26, color: INK }}>{c.k}</div>
                  <MnLine size={21}>{c.km}</MnLine>
                </div>
                <div>
                  <div style={{ fontFamily: KO, fontWeight: 500, fontSize: 25, lineHeight: 1.42, color: INK }}>{c.ko}</div>
                  <MnLine size={22} style={{ marginTop: 3 }}>{c.mn}</MnLine>
                </div>
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', right: 36, bottom: 20, display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 16px', borderRadius: 999, background: CORAL, opacity: nextHw, transform: `translateY(${mix(10, 0, nextHw)}px)` }}>
            <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 22, color: '#FFFFFF' }}>{L('nextHw').ko}</span>
            <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 20, color: 'rgba(255,255,255,.86)' }}>{L('nextHw').mn}</span>
          </div>
        </div>
      ) : null}
    </Board>
  );
};

// ───────── 10 앱(실제 WORLD 화면) ─────────
// 휴대폰을 크게(판 아래로 잘려도 됨) 두고, 캡처를 글 상자에서 한마디 세 줄까지 천천히 내린다(Fable 10-23).
const PHONE_W = 540;
const SHOT_H = ((PHONE_W - 24) * 2532) / 1170; // 캡처 1170×2532(390×844의 3배)
export const S10: React.FC<P & { shot?: string }> = ({ g, shot }) => {
  const { from, to } = SCENES['10'];
  const t = prog(g, from + 4, 16);
  const pan = prog(g, from + 24, Math.max(30, to - from - 40), IN_OUT);
  const where = prog(g, atw('j1', '앱의', 0.3), 12);
  const visible = BOARD.h - 40 - 12;
  return (
    <Board o={fadeIn(g, '10')} scale={push(g, '10')} ox={30} oy={40}>
      <div style={{ position: 'absolute', left: 90, top: 190, width: 560, opacity: t, wordBreak: 'keep-all' }}>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 22, letterSpacing: '.14em', color: INK3 }}>SYNK WORLD</div>
        <div style={{ fontFamily: KO, fontWeight: 820, fontSize: 84, letterSpacing: '-0.04em', color: INK, marginTop: 10 }}>{L('top10').ko}</div>
        <MnLine size={34} style={{ marginTop: 6 }}>{L('top10').mn}</MnLine>
        <div style={{ marginTop: 36, fontFamily: KO, fontWeight: 600, fontSize: 28, lineHeight: 1.6, color: INK2 }}>
          {L('worldSub').ko}
          <MnLine size={24}>{L('worldSub').mn}</MnLine>
        </div>
        {/* 「싱크 월드 앱의」 — 무엇이고 어디서 여는지(이해 시험 10-23: 두 시청자 모두 「앱이 뭔지, 어디서 받는지」) */}
        <div style={{ marginTop: 22, fontFamily: KO, fontWeight: 700, fontSize: 26, color: CORAL_DEEP, opacity: where, transform: `translateY(${mix(8, 0, where)}px)` }}>
          {L('worldWhere').ko}
          <MnLine size={22} style={{ marginTop: 2, textWrap: 'balance' }}>{L('worldWhere').mn}</MnLine>
        </div>
        <div style={{ marginTop: 36, display: 'inline-flex', gap: 10, alignItems: 'center', padding: '8px 16px', borderRadius: 999, background: '#F2F2F0', fontFamily: KO, fontWeight: 600, fontSize: 20, color: INK3 }}>
          {L('worldPill').ko} <span style={{ fontFamily: MN, fontWeight: 500 }}>{L('worldPill').mn}</span>
        </div>
      </div>
      <div style={{ position: 'absolute', right: 110, top: 40, width: PHONE_W, height: SHOT_H + 24, borderRadius: 64, background: '#0C0D10', padding: 12, boxShadow: '0 30px 60px rgba(8,9,12,.28)', transform: `translateY(${mix(40, 0, t)}px)`, opacity: t }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 52, overflow: 'hidden', background: '#121317' }}>
          {shot ? (
            <Img src={staticFile(shot)} style={{ width: '100%', display: 'block', transform: `translateY(${-Math.max(0, SHOT_H - visible + 20) * pan}px)` }} />
          ) : (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.5)', fontFamily: KO, fontSize: 22, textAlign: 'center' }}>실제 화면 캡처 자리</div>
          )}
        </div>
      </div>
    </Board>
  );
};

// ───────── 11 정리 · 안내 ─────────
export const S11: React.FC<P> = ({ g }) => {
  const r = [atw('k1', '글의', 0.37), atw('k1', '정확한', 0.5), atw('k1', '자료에', 0.77)].map((a) => prog(g, a, 12));
  const card = prog(g, at('k2', 0.0), 16, IN_OUT);
  const t = prog(g, at('k2', 0.1), 16);
  // 「8주 동안 토요일마다 … 매주 첨삭」 — 안내 셋은 말할 때 하나씩, 그림은 「이렇게 같이 쓰고」 때
  const facts = [atw('k2', '팔', 0.0), atw('k2', '토요일마다', 0.16), atw('k2', '매주', 0.62)].map((a) => prog(g, a, 12));
  const art = prog(g, atw('k2', '이렇게', 0.33), 16);
  const cta = prog(g, at('k3', 0.1), 14);
  const url = prog(g, atw('k3', '주소에서', 0.6), 16); // 「화면의 주소에서」 — 주소에 밑줄
  const note = prog(g, end('k3') + 8, 14); // 합성 목소리 한 줄은 말이 끝난 뒤 끝 화면에서 읽히게
  const factKo = L('endFacts').ko.split(' · ');
  const factMn = L('endFacts').mn.split(' · ');
  const recap = [L('recap1'), L('recap2'), L('recap3')];
  return (
    <>
      <Board o={fadeIn(g, '11')} scale={push(g, '11')} ox={30} oy={40}>
        <BoardHead ko={L('top11').ko} mn={L('top11').mn} />
        <div style={{ position: 'absolute', left: 110, top: 170, display: 'grid', gap: 44 }}>
          {recap.map((x, i) => (
            <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 26, opacity: r[i], transform: `translateX(${mix(20, 0, r[i])}px)` }}>
              <Check p={r[i]} s={56} />
              <div>
                <div style={{ fontFamily: KO, fontWeight: 780, fontSize: 56, letterSpacing: '-0.02em', color: INK }}>{withAr(x.ko)}</div>
                <MnLine size={28}>{x.mn}</MnLine>
              </div>
            </div>
          ))}
        </div>
      </Board>
      {card > 0 ? (
        <Poster clip={card}>
          <Logo style={{ left: 70, top: 56, width: 156, opacity: t }} />
          <div style={{ position: 'absolute', left: 70, top: 140, opacity: t, transform: `translateY(${mix(20, 0, t)}px)` }}>
            <div style={{ fontFamily: KO, fontWeight: 820, fontSize: 112, lineHeight: 1.04, letterSpacing: '-0.045em', color: POSTER_INK }}>{L('endTitle').ko}</div>
            <MnLine size={34} color="rgba(30,14,10,.74)" style={{ marginTop: 10 }}>{L('endTitle').mn}</MnLine>
            <div style={{ marginTop: 36, fontFamily: KO, fontWeight: 650, fontSize: 38, color: POSTER_INK }}>
              {factKo.map((x, i) => (
                <span key={x} style={{ opacity: facts[i] }}>
                  {i ? ' · ' : ''}
                  {x}
                </span>
              ))}
            </div>
            <MnLine size={26} color="rgba(30,14,10,.74)" style={{ marginTop: 6, maxWidth: 980 }}>
              {factMn.map((x, i) => (
                <span key={x} style={{ opacity: facts[i] }}>
                  {i ? ' · ' : ''}
                  {x}
                </span>
              ))}
            </MnLine>
          </div>
          <div style={{ position: 'absolute', left: 70, top: 492, display: 'flex', alignItems: 'center', gap: 22, opacity: cta }}>
            <div style={{ padding: '16px 32px', borderRadius: 999, background: '#FFFFFF', fontFamily: MN, fontWeight: 700, fontSize: 44, color: POSTER_INK, letterSpacing: '-0.01em' }}>
              <U p={url} w={6}>
                synk.im/lab/topik4
              </U>
            </div>
            <div>
              <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 28, color: POSTER_INK }}>{L('endCta').ko}</div>
              <MnLine size={24} color="rgba(30,14,10,.74)">{L('endCta').mn}</MnLine>
              {/* 관심 등록이 무엇인지 — 신청 페이지 글 그대로(이해 시험 10-23 「신청인지 대기 명단인지」) */}
              <div style={{ marginTop: 10, fontFamily: KO, fontWeight: 600, fontSize: 23, color: POSTER_INK }}>{L('openRule').ko}</div>
              <MnLine size={22} color="rgba(30,14,10,.74)">{L('openRule').mn}</MnLine>
            </div>
          </div>
          {/* 합성 목소리 한 줄 — 휴대폰에서도 읽히게 크게(Fable 10-23) */}
          <div style={{ position: 'absolute', left: 70, bottom: 30, opacity: note, transform: `translateY(${mix(8, 0, note)}px)`, color: 'rgba(30,14,10,.85)' }}>
            <div style={{ fontFamily: KO, fontWeight: 600, fontSize: 26 }}>{L('voiceNote').ko}</div>
            <div style={{ fontFamily: MN, fontWeight: 500, fontSize: 24, marginTop: 4 }}>{L('voiceNote').mn}</div>
          </div>
          <Art name="list" style={{ right: 120, top: 110, width: 380, transform: `rotate(4deg) translateY(${mix(26, 0, art)}px)`, opacity: art }} />
        </Poster>
      ) : null}
    </>
  );
};

export const SCENE_VIEW: Record<string, React.FC<P & { shot?: string }>> = { '01': S01, '02': S02, '03': S03, '04': S04, '05': S05, '06': S06, '07': S07, '08': S08, '09': S09, '10': S10, '11': S11 };

/** 위 띠 장면 이름(한국어 · 몽골어) — 글은 자막/대사.json labels. */
export const TOP: Record<string, [string, string]> = Object.fromEntries(
  ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'].map((id) => [id, id === '02' ? ['', ''] : [L(`top${id}`).ko, L(`top${id}`).mn]]),
);
