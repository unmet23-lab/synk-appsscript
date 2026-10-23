// 장면 11개. g = 전체 프레임. 시간은 time.ts의 줄 자리(at)에 묶는다 — 목소리를 구운 뒤에도 같은 코드가 그대로 맞는다.
import React from 'react';
import { Img, staticFile } from 'remotion';
import { KO, MN, MONO } from '../lib/fonts';
import { IN_OUT, mix, prog } from '../lib/motion';
import { COMMENT, DRAFT, L, MARKS, PROBLEM, type Seg } from './data';
import { at, end, SCENES } from './time';
import { Ar, Art, Board, BoardHead, Check, Chip, Circ, Cross, Logo, Num, Poster, Reveal, U, XMark } from './parts';
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

const Meta: React.FC<{ size?: number }> = ({ size = 29 }) => (
  <div style={{ display: 'grid', gap: 6, fontFamily: KO, fontSize: size, color: INK }}>
    {PROBLEM.meta.map(([k, v]) => (
      <div key={k} style={{ display: 'flex', gap: 18 }}>
        <span style={{ fontWeight: 700, color: INK2, minWidth: size * 5.2 }}>{k}</span>
        <span style={{ fontWeight: 500 }}>{v}</span>
      </div>
    ))}
  </div>
);

const cell: React.CSSProperties = { padding: '10px 18px', borderBottom: `1.5px solid ${LINE}` };
const Table1: React.FC<{ size?: number; strong?: boolean }> = ({ size = 28, strong }) => (
  <div style={{ fontFamily: KO, fontSize: size, color: INK }}>
    <div style={{ fontWeight: 650, marginBottom: 10 }}>{PROBLEM.t1.caption}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', borderTop: `2px solid ${INK}` }}>
      {PROBLEM.t1.cols.map((c, i) => (
        <div key={i} style={{ ...cell, fontWeight: 650, color: INK2, textAlign: i ? 'right' : 'left' }}>{c}</div>
      ))}
      {PROBLEM.t1.rows.map((r, ri) =>
        r.map((c, i) => (
          <div key={`${ri}-${i}`} style={{ ...cell, fontWeight: i ? (strong && ri === 0 ? 800 : 600) : 600, textAlign: i ? 'right' : 'left', fontVariantNumeric: 'tabular-nums', fontSize: strong && ri === 0 && i ? size * 1.25 : size }}>{c}</div>
        )),
      )}
    </div>
  </div>
);

const Table2: React.FC<{ size?: number; fadeEtc?: number; order?: number }> = ({ size = 28, fadeEtc = 1, order = 0 }) => (
  <div style={{ fontFamily: KO, fontSize: size, color: INK }}>
    <div style={{ fontWeight: 650, marginBottom: 10, lineHeight: 1.35 }}>{PROBLEM.t2.caption}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', borderTop: `2px solid ${INK}` }}>
      {PROBLEM.t2.rows.map(([k, v], i) => (
        <React.Fragment key={k}>
          <div style={{ ...cell, fontWeight: 600, opacity: i === 3 ? fadeEtc : 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            {i < 3 && order > 0 ? <Num n={i + 1} p={prog(order, i * 0.25, 0.3)} s={38} /> : null}
            {k}
          </div>
          <div style={{ ...cell, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: i === 3 ? fadeEtc : 1 }}>{v}</div>
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
  const arrow = prog(g, at('a1', 0.35), 18);
  const ask = prog(g, at('a1', 0.62), 12);
  const dots = [0, 1, 2].map((i) => 1 - prog(g, end('a1') + 8 + i * 13, 6));
  const wrong = prog(g, at('a2', 0.0), 16, (t) => t);
  const cross = prog(g, at('a2', 0.55), 14);
  return (
    <Board o={fadeIn(g, '01', 8)} scale={push(g, '01')} ox={30} oy={40}>
      <BoardHead ko={`${L('virtual').ko} · 질문 1`} mn={`${L('virtual').mn} · 1-р асуулт`} />
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
  const wipe = prog(g, from, 14, IN_OUT);
  const t1 = prog(g, from + 10, 14);
  const t2 = prog(g, from + 18, 14);
  return (
    <Poster clip={wipe}>
      <div style={{ position: 'absolute', left: 70, top: 58, fontFamily: MONO, fontWeight: 500, fontSize: 20, letterSpacing: '.14em', color: POSTER_INK, opacity: 0.72 }}>SYNK LAB · TOPIK II · SAMPLE CLASS</div>
      <div style={{ position: 'absolute', left: 70, top: 104, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderRadius: 999, background: 'rgba(255,255,255,.92)', opacity: t1 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: CORAL }} />
        <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 26, color: POSTER_INK }}>맛보기 수업</span>
        <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 24, color: 'rgba(30,14,10,.7)' }}>Туршилтын хичээл</span>
      </div>
      <div style={{ position: 'absolute', left: 62, top: 230, opacity: t1, transform: `translateY(${mix(24, 0, t1)}px)` }}>
        <div style={{ fontFamily: KO, fontWeight: 820, fontSize: 230, lineHeight: 1, letterSpacing: '-0.055em', color: POSTER_INK }}>{L('title').ko}</div>
      </div>
      <div style={{ position: 'absolute', left: 70, top: 500, opacity: t2 }}>
        <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 56, letterSpacing: '-0.02em', color: POSTER_INK }}>{L('subtitle').ko}</div>
        <MnLine size={34} color="rgba(30,14,10,.72)" style={{ marginTop: 8 }}>
          {L('title').mn} · {L('subtitle').mn}
        </MnLine>
      </div>
      <div style={{ position: 'absolute', left: 70, bottom: 50, opacity: t2, fontFamily: KO, fontWeight: 650, fontSize: 26, color: 'rgba(30,14,10,.78)' }}>
        TOPIK II · 4급 온라인 반 <span style={{ fontFamily: MN, fontWeight: 500, marginLeft: 10 }}>TOPIK II · 4-р түвшний онлайн анги</span>
      </div>
      <Art name="grid" style={{ right: 110, top: 150, width: 470, transform: `rotate(-5deg) translateY(${mix(30, 0, t1)}px)`, opacity: t1 }} />
    </Poster>
  );
};

// ───────── 03 문제 ─────────
export const S03: React.FC<P> = ({ g }) => {
  const m = { 'c-len': prog(g, at('c1', 0.42), 14), 'c-title': prog(g, at('c1', 0.84), 14) };
  const veil = prog(g, at('c2', 0.45), 14);
  return (
    <Board o={fadeIn(g, '03')} scale={push(g, '03')} ox={30} oy={40}>
      <BoardHead ko={`쓰기 ${PROBLEM.no}번 · 문제`} mn="53-р даалгавар · Даалгавар" />
      <div style={{ position: 'absolute', left: 64, top: 104, width: 1490, fontFamily: KO, fontWeight: 500, fontSize: 33, lineHeight: 1.62, color: INK }}>
        {PROBLEM.instr.map((parts, i) => (
          <div key={i}>
            <SegLine parts={parts} marks={m} />
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 64, top: 236, right: 64, bottom: 44, borderRadius: 18, boxShadow: `inset 0 0 0 1.5px ${LINE}`, padding: '26px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
          <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 24, color: INK2 }}>자료({L('virtual').ko})</span>
          <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 21, color: INK3 }}>Мэдээлэл ({L('virtual').mn.toLowerCase()})</span>
        </div>
        <Meta size={26} />
        <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 44, marginTop: 22 }}>
          <Table1 size={25} />
          <Table2 size={25} />
        </div>
      </div>
      {veil > 0 ? (
        <div style={{ position: 'absolute', inset: 0, background: `rgba(255,255,255,${0.9 * veil})`, display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', opacity: veil, transform: `translateY(${mix(16, 0, veil)}px)` }}>
            <div style={{ fontFamily: KO, fontWeight: 820, fontSize: 124, letterSpacing: '-0.04em', color: INK }}>
              <U p={prog(g, at('c2', 0.62), 16)} w={9}>
                {L('onlyData').ko}
              </U>
            </div>
            <MnLine size={44} style={{ marginTop: 26 }}>{L('onlyData').mn}</MnLine>
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
export const S04: React.FC<P> = ({ g }) => {
  const n1 = prog(g, at('d2', 0.02), 16);
  const n2 = prog(g, at('d2', 0.38), 16);
  const n3 = prog(g, at('d2', 0.7), 16);
  const box = [prog(g, at('d3', 0.42), 12), prog(g, at('d3', 0.56), 12), prog(g, at('d3', 0.7), 12), prog(g, at('d3', 0.86), 12)];
  const chat = prog(g, at('d1', 0.5), 12);
  return (
    <Board o={fadeIn(g, '04')} scale={push(g, '04')} ox={30} oy={40}>
      <BoardHead ko="쓸 것 세 가지" mn="Бичих гурван зүйл" />
      <div style={{ position: 'absolute', right: 64, top: 36, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 999, boxShadow: `inset 0 0 0 2px ${CORAL}`, opacity: chat }}>
        <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 22, color: CORAL_DEEP }}>실제 수업: 채팅으로 답해요</span>
        <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 20, color: INK3 }}>Чатаар хариулна</span>
      </div>
      <div style={{ position: 'absolute', left: 120, top: 112, width: 820 }}>
        <div style={{ position: 'relative' }}>
          <Num n={1} p={n1} s={50} style={{ position: 'absolute', left: -66, top: -4 }} />
          <Meta size={27} />
        </div>
        <div style={{ position: 'relative', marginTop: 30 }}>
          <Num n={2} p={n2} s={50} style={{ position: 'absolute', left: -66, top: -6 }} />
          <Table1 size={25} />
        </div>
        <div style={{ position: 'relative', marginTop: 26 }}>
          <Num n={3} p={n3} s={50} style={{ position: 'absolute', left: -66, top: -6 }} />
          <Table2 size={23} />
        </div>
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
  <div style={{ position: 'absolute', left: 1120, top: 120, width: 436, bottom: 52, borderRadius: 20, background: '#F5F5F3', padding: '26px 28px', opacity: o }}>{children}</div>
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

export const S05: React.FC<P> = ({ g }) => (
  <Board o={fadeIn(g, '05')} scale={push(g, '05', 1.015) + 0.025 * prog(g, SCENES['05'].from, 24, IN_OUT)} ox={32} oy={focusY(g, 1, BOARD.h)}>
    <SheetTitle />
    <SheetLines g={g} upto={1} />
    <Side o={prog(g, SCENES['05'].from + 4, 12)}>
      <SideHead n={1} ko={L('box1').ko} mn={L('box1').mn} />
      <Meta size={24} />
      <div style={{ marginTop: 26, fontFamily: KO, fontSize: 25, lineHeight: 1.6, color: INK2 }}>
        <div>
          <b style={{ color: CORAL_DEEP }}>~을 대상으로</b>
        </div>
        <div>
          <b style={{ color: CORAL_DEEP }}>~에 대해 조사하였다</b>
        </div>
      </div>
    </Side>
  </Board>
);

export const S06: React.FC<P> = ({ g }) => {
  const calc = prog(g, at('f3', 0.42), 12);
  const wrong = prog(g, at('f3', 0.85), 14);
  const right = prog(g, at('f4', 0.15), 14);
  const plus = prog(g, at('f3', 0.22), 12);
  const focus = prog(g, at('f3', 0.38), 24, IN_OUT) * (1 - prog(g, at('f5', 0.0), 24, IN_OUT));
  return (
    <Board o={fadeIn(g, '06')} scale={push(g, '06', 1.015) + 0.025 * prog(g, SCENES['06'].from, 24, IN_OUT) } ox={mix(32, 55, focus)} oy={mix(focusY(g, 2, BOARD.h), 46, focus)}>
      <SheetTitle />
      <SheetLines g={g} upto={2} dimBefore={2} />
      <Side o={prog(g, SCENES['06'].from + 4, 12)}>
        <SideHead n={2} ko={L('box2').ko} mn={L('box2').mn} />
        <div style={{ fontFamily: KO, fontSize: 26, color: INK2, fontWeight: 600 }}>질문 1 · 「예」</div>
        <div style={{ position: 'relative', fontFamily: KO, fontSize: 46, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums', margin: '6px 0 18px' }}>
          <U p={prog(g, at('f3', 0.1), 14)}>
            48% <Ar /> 63%
          </U>
          <span style={{ marginLeft: 16, fontSize: 34, color: CORAL_DEEP, opacity: plus, display: 'inline-block', transform: `translateY(${mix(8, 0, plus)}px)` }}>+15</span>
        </div>
        <div style={{ opacity: calc, display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: KO, fontSize: 26, fontWeight: 650, color: INK, lineHeight: 1.45 }}>
            <XMark p={wrong} s={34} style={{ marginTop: 2, flex: 'none' }} />
            <div>
              <div style={{ color: INK2 }}>「15% 증가」 = 48의 15%(7.2)</div>
              <div>48% + 7.2 = 55.2%</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: KO, fontSize: 30, fontWeight: 800, color: INK, opacity: right > 0 ? 1 : 0.25 }}>
            <Check p={right} s={34} />
            <span>
              63 − 48 = <span style={{ color: CORAL_DEEP }}>{L('point').ko}</span>
            </span>
          </div>
          <MnLine size={24} style={{ opacity: right }}>
            {L('point').ko} = {L('point').mn}
          </MnLine>
        </div>
      </Side>
    </Board>
  );
};

export const S07: React.FC<P> = ({ g }) => {
  const order = prog(g, at('g1', 0.4), 40, (t) => t);
  const etc = 1 - 0.65 * prog(g, at('g3', 0.72), 12);
  return (
    <Board o={fadeIn(g, '07')} scale={push(g, '07', 1.015) + 0.025 * prog(g, SCENES['07'].from, 24, IN_OUT)} ox={32} oy={focusY(g, 3, BOARD.h)}>
      <SheetTitle />
      <SheetLines g={g} upto={3} dimBefore={3} />
      <Side o={prog(g, SCENES['07'].from + 4, 12)}>
        <SideHead n={3} ko={L('box3').ko} mn={L('box3').mn} />
        <Table2 size={22} order={order} fadeEtc={etc} />
        <div style={{ marginTop: 16, fontFamily: KO, fontSize: 23, fontWeight: 650, color: CORAL_DEEP, opacity: prog(g, at('g3', 0.75), 12) }}>「기타」는 쓰지 않아도 돼요</div>
      </Side>
    </Board>
  );
};

export const S08: React.FC<P> = ({ g }) => {
  const meter = prog(g, at('h3', 0.02), 14);
  const dots = prog(g, at('h3', 0.55), 14);
  return (
    <Board o={fadeIn(g, '08')} scale={push(g, '08', 1.015) + 0.025 * prog(g, SCENES['08'].from, 24, IN_OUT)} ox={32} oy={focusY(g, 4, BOARD.h)}>
      <SheetTitle />
      <SheetLines g={g} upto={4} dimBefore={4} />
      {/* 네 문장 끝 「-다」 점 */}
      {[2, 5, 9, 11].map((row, i) => (
        <div key={row} style={{ position: 'absolute', left: 40, top: SHEET_TOP + row * LH + 22, width: 12, height: 12, borderRadius: 999, background: CORAL, opacity: prog(dots, i * 0.2, 0.3) }} />
      ))}
      <Side o={prog(g, SCENES['08'].from + 4, 12)}>
        <SideHead n={4} ko={L('box4').ko} mn={L('box4').mn} />
        <div style={{ opacity: meter }}>
          <div style={{ fontFamily: KO, fontSize: 24, fontWeight: 650, color: INK2 }}>
            글자 수 <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 21, color: INK3, marginLeft: 6 }}>Тэмдэгтийн тоо</span>
          </div>
          <div style={{ fontFamily: KO, fontSize: 92, fontWeight: 820, color: INK, letterSpacing: '-0.03em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>281자</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: KO, fontSize: 26, fontWeight: 650, color: INK2 }}>
            <Check p={meter} s={30} /> 200~300
          </div>
        </div>
        <div style={{ marginTop: 30, fontFamily: KO, fontSize: 26, fontWeight: 650, color: INK, opacity: dots }}>
          네 문장 끝 · <span style={{ color: CORAL_DEEP }}>「-다」</span>
          <MnLine size={22}>Дөрвөн өгүүлбэрийн төгсгөл · «다»</MnLine>
        </div>
      </Side>
    </Board>
  );
};

// ───────── 09 첨삭 ─────────
const MARK_LINE: Record<string, string> = { 체: 'i3', 조: 'i4', 낱: 'i5', 자: 'i6', '+': 'i7' };
export const S09: React.FC<P> = ({ g }) => {
  const mp = (code: string) => prog(g, at(MARK_LINE[code], 0.05), 14);
  const card = prog(g, at('i8', 0.05), 18, IN_OUT);
  const shrink = mix(1, 0.42, card);
  return (
    <Board o={fadeIn(g, '09')} scale={push(g, '09')} ox={30} oy={40}>
      <BoardHead ko={L('draft').ko} mn={L('draft').mn} />
      <div style={{ position: 'absolute', left: 520, top: 38, display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', borderRadius: 999, boxShadow: `inset 0 0 0 2px ${CORAL}` }}>
        <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 21, color: CORAL_DEEP }}>{L('madeUp').ko}</span>
        <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 19, color: INK3 }}>{L('madeUp').mn}</span>
      </div>
      <div style={{ position: 'absolute', left: 64, top: mix(104, 96, card), width: 1060, transform: `scale(${shrink})`, transformOrigin: '0 0' }}>
        {DRAFT.map((line, i) => (
          <div key={i} style={{ fontFamily: KO, fontWeight: 500, fontSize: 33, lineHeight: 2.3, color: INK, whiteSpace: 'nowrap' }}>
            {line.map((s, k) => {
              if (typeof s === 'string') return <span key={k}>{s}</span>;
              const p = mp(s.m);
              const body = s.m === '조' ? <Circ p={p} pad={0.3}>{s.t}</Circ> : <U p={p} double={s.m === '+'}>{s.t}</U>;
              return (
                <span key={k}>
                  {s.m === '+' ? <Chip code="+" p={p} outline start /> : null}
                  {body}
                  {s.chip ? <Chip code={s.m} p={p} /> : null}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 1160, top: 112, width: 396, opacity: 1 - card }}>
        <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 24, color: INK2, marginBottom: 12 }}>
          {L('marks').ko} <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 20, color: INK3, marginLeft: 6 }}>{L('marks').mn}</span>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {MARKS.map((m) => {
            const p = mp(m.code);
            return (
              <div key={m.code} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', alignItems: 'baseline', opacity: p, transform: `translateX(${mix(12, 0, p)}px)` }}>
                <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 26, color: CORAL_DEEP }}>〔{m.code}〕</span>
                <div>
                  <div style={{ fontFamily: KO, fontWeight: 650, fontSize: 25, color: INK }}>{m.ko}</div>
                  <MnLine size={20}>{m.mn}</MnLine>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {card > 0 ? (
        <div style={{ position: 'absolute', left: 40, right: 40, bottom: 36, height: 430, borderRadius: 22, background: '#FBF4F2', boxShadow: `inset 0 0 0 2px ${CORAL_SOFT}, 0 -10px 40px rgba(8,9,12,.08)`, padding: '26px 36px', transform: `translateY(${mix(480, 0, card)}px)` }}>
          <div style={{ fontFamily: KO, fontWeight: 750, fontSize: 28, color: CORAL_DEEP, marginBottom: 14 }}>
            {L('comment').ko} <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 22, color: INK3, marginLeft: 8 }}>{L('comment').mn}</span>
          </div>
          <div style={{ display: 'grid', gap: 18 }}>
            {COMMENT.map((c, i) => (
              <div key={c.k} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, opacity: prog(g, at('i8', 0.35 + i * 0.18), 10) }}>
                <div>
                  <div style={{ fontFamily: KO, fontWeight: 750, fontSize: 26, color: INK }}>{c.k}</div>
                  <MnLine size={19}>{c.km}</MnLine>
                </div>
                <div>
                  <div style={{ fontFamily: KO, fontWeight: 500, fontSize: 25, lineHeight: 1.45, color: INK }}>{c.ko}</div>
                  <MnLine size={19} style={{ marginTop: 3 }}>{c.mn}</MnLine>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Board>
  );
};

// ───────── 10 앱(실제 WORLD 화면) ─────────
export const S10: React.FC<P & { shot?: string }> = ({ g, shot }) => {
  const t = prog(g, SCENES['10'].from + 4, 16);
  return (
    <Board o={fadeIn(g, '10')} scale={push(g, '10')} ox={30} oy={40}>
      <div style={{ position: 'absolute', left: 90, top: 200, width: 700, opacity: t }}>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 22, letterSpacing: '.14em', color: INK3 }}>SYNK WORLD</div>
        <div style={{ fontFamily: KO, fontWeight: 820, fontSize: 88, letterSpacing: '-0.04em', color: INK, marginTop: 10 }}>이번 주 과제</div>
        <MnLine size={36} style={{ marginTop: 6 }}>Энэ долоо хоногийн даалгавар</MnLine>
        <div style={{ marginTop: 40, fontFamily: KO, fontWeight: 600, fontSize: 28, lineHeight: 1.6, color: INK2 }}>
          숙제를 내고, 첨삭을 돌려받는 곳
          <MnLine size={24}>Даалгавраа өгч, засвараа авах хэсэг</MnLine>
        </div>
        <div style={{ marginTop: 40, display: 'inline-flex', gap: 10, alignItems: 'center', padding: '8px 16px', borderRadius: 999, background: '#F2F2F0', fontFamily: KO, fontWeight: 600, fontSize: 20, color: INK3 }}>
          실제 앱 화면 · 예시 학생 <span style={{ fontFamily: MN, fontWeight: 500 }}>Жинхэнэ апп · жишээ сурагч</span>
        </div>
      </div>
      <div style={{ position: 'absolute', right: 160, top: 34, width: 330, height: 688, borderRadius: 46, background: '#0C0D10', padding: 12, boxShadow: '0 30px 60px rgba(8,9,12,.28)', transform: `translateY(${mix(40, 0, t)}px)`, opacity: t }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 36, overflow: 'hidden', background: '#121317' }}>
          {shot ? (
            <Img src={staticFile(shot)} style={{ width: '100%', display: 'block' }} />
          ) : (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.5)', fontFamily: KO, fontSize: 22, textAlign: 'center' }}>
              실제 화면 캡처 자리
            </div>
          )}
        </div>
      </div>
    </Board>
  );
};

// ───────── 11 정리 · 안내 ─────────
export const S11: React.FC<P> = ({ g }) => {
  const r = [0.08, 0.38, 0.66].map((f) => prog(g, at('k1', f), 12));
  const card = prog(g, at('k2', 0.0), 16, IN_OUT);
  const t = prog(g, at('k2', 0.1), 16);
  const cta = prog(g, at('k3', 0.1), 14);
  const recap = [L('recap1'), L('recap2'), L('recap3')];
  return (
    <>
      <Board o={fadeIn(g, '11')} scale={push(g, '11')} ox={30} oy={40}>
        <BoardHead ko="오늘 배운 것" mn="Өнөөдөр сурсан зүйл" />
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
          <div style={{ position: 'absolute', left: 70, top: 150, opacity: t, transform: `translateY(${mix(20, 0, t)}px)` }}>
            <div style={{ fontFamily: KO, fontWeight: 820, fontSize: 112, lineHeight: 1.04, letterSpacing: '-0.045em', color: POSTER_INK }}>{L('endTitle').ko}</div>
            <MnLine size={34} color="rgba(30,14,10,.74)" style={{ marginTop: 10 }}>{L('endTitle').mn}</MnLine>
            <div style={{ marginTop: 40, fontFamily: KO, fontWeight: 650, fontSize: 38, color: POSTER_INK }}>{L('endFacts').ko}</div>
            <MnLine size={26} color="rgba(30,14,10,.74)" style={{ marginTop: 6, maxWidth: 980 }}>{L('endFacts').mn}</MnLine>
          </div>
          <div style={{ position: 'absolute', left: 70, top: 548, display: 'flex', alignItems: 'center', gap: 22, opacity: cta }}>
            <div style={{ padding: '16px 32px', borderRadius: 999, background: '#FFFFFF', fontFamily: MN, fontWeight: 700, fontSize: 44, color: POSTER_INK, letterSpacing: '-0.01em' }}>synk.im/lab/topik4</div>
            <div>
              <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 28, color: POSTER_INK }}>{L('endCta').ko}</div>
              <MnLine size={22} color="rgba(30,14,10,.74)">{L('endCta').mn}</MnLine>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 70, bottom: 34, opacity: cta, fontFamily: KO, fontWeight: 500, fontSize: 21, color: 'rgba(30,14,10,.7)' }}>
            {L('voiceNote').ko} <span style={{ fontFamily: MN, marginLeft: 8 }}>{L('voiceNote').mn}</span>
          </div>
          <Art name="list" style={{ right: 120, top: 120, width: 400, transform: `rotate(4deg) translateY(${mix(26, 0, t)}px)`, opacity: t }} />
        </Poster>
      ) : null}
    </>
  );
};

export const SCENE_VIEW: Record<string, React.FC<P & { shot?: string }>> = { '01': S01, '02': S02, '03': S03, '04': S04, '05': S05, '06': S06, '07': S07, '08': S08, '09': S09, '10': S10, '11': S11 };

/** 위 띠 장면 이름. */
export const TOP: Record<string, [string, string]> = {
  '01': ['53번 · 조사 결과 쓰기', '53-р даалгавар'],
  '02': ['', ''],
  '03': ['문제 읽기', 'Даалгавар унших'],
  '04': ['쓸 것 찾기', 'Бичих зүйлээ олох'],
  '05': ['① 소개', 'Танилцуулга'],
  '06': ['② 결과 1 · 변화', 'Үр дүн 1 · Өөрчлөлт'],
  '07': ['③ 결과 2 · 이유', 'Үр дүн 2 · Шалтгаан'],
  '08': ['④ 정리', 'Дүгнэлт'],
  '09': ['첨삭', 'Засвар'],
  '10': ['이번 주 과제', 'Энэ долоо хоногийн даалгавар'],
  '11': ['오늘 배운 것', 'Өнөөдөр сурсан зүйл'],
};
