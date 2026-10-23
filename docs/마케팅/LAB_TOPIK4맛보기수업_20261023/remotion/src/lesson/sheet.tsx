// 05~08 답안 판 — 예시답이 문장마다 한 줄씩 써지고, 선생님 펜이 표현에 밑줄을 긋는다. 오른쪽은 그 문장의 도움 판.
import React from 'react';
import { measureText } from '@remotion/layout-utils';
import { KO, MN } from '../lib/fonts';
import { prog } from '../lib/motion';
import { ANSWER, L, type Seg } from './data';
import { atw, lineTime } from './time';
import { Circ, Reveal, U } from './parts';
import { CORAL, CORAL_DEEP, INK, INK3, RULE } from './tokens';

/** 읽기 줄(e2·f2·g2·h2)이 소리 내어 읽히는 동안 그 문장 줄들을 글자 수 비율로 나눠 드러낸다. */
const READ: Record<number, string> = { 1: 'e2', 2: 'f2', 3: 'g2', 4: 'h2' };
const segText = (s: Seg) => (typeof s === 'string' ? s : 'u' in s ? s.u : s.c);
const lineLen = (i: number) => ANSWER[i].parts.map(segText).join('').length;

export const revealOf = (g: number, i: number) => {
  const s = ANSWER[i].s;
  const id = READ[s];
  const span = lineTime[id];
  const idx = ANSWER.map((l, k) => ({ l, k })).filter((x) => x.l.s === s);
  const total = idx.reduce((a, x) => a + lineLen(x.k), 0);
  let before = 0;
  for (const x of idx) {
    if (x.k === i) break;
    before += lineLen(x.k);
  }
  const a = span.from + ((span.to - span.from) * before) / total;
  const len = ((span.to - span.from) * lineLen(i)) / total;
  return prog(g, a, Math.max(6, len), (t) => t);
};

/** 밑줄·동그라미가 그어지는 자리(id → 줄, 그 줄 안의 자리). */
export const MARK_AT: Record<string, [string, string, number]> = {
  'e-target': ['e3', '사백', 0.04],
  'e-survey': ['e3', '아르바이트에', 0.2],
  'f-point': ['f2', '퍼센트포인트', 0.8],
  'f-from': ['f5', '사십팔', 0.02],
  'f-to': ['f5', '육십삼', 0.16],
  'f-found': ['f5', '증가한', 0.36],
  'g-top': ['g3', '높았으며', 0.21],
  'g-next': ['g3', '뒤를', 0.42],
  'h-thus': ['h2', '이처럼', 0.02],
};
const markP = (g: number, id: string) => {
  const [line, needle, frac] = MARK_AT[id];
  return prog(g, atw(line, needle, frac), 14);
};

/** 펜 끝 — 지금 써지는 자리(방송 수업에서 선생님 펜 커서처럼). 줄 폭은 실제 서체로 잰다. */
const lineWidth = (t: string) => measureText({ text: t, fontFamily: 'SUIT', fontSize: 32, fontWeight: '500' }).width;
const PenTip: React.FC<{ p: number; w?: number }> = ({ p, w = 0 }) => (
  <div style={{ position: 'absolute', left: w * p - 6, bottom: 4, width: 13, height: 13, borderRadius: 999, background: CORAL, boxShadow: '0 0 0 6px rgba(249,104,89,.18), 0 4px 10px rgba(201,65,47,.35)' }} />
);
export const LH = 50;
export const SHEET_TOP = 116;
export const SheetLines: React.FC<{ g: number; upto: number; x?: number; y?: number; w?: number; dimBefore?: number }> = ({ g, upto, x = 64, y = SHEET_TOP, w = 1000, dimBefore = 0 }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w }}>
    {ANSWER.map((line, i) => {
      if (line.s > upto) return null;
      const p = revealOf(g, i);
      const dim = line.s < dimBefore ? 0.5 : 1;
      return (
        <div key={i} style={{ position: 'relative', height: LH, borderBottom: `1.5px solid ${RULE}` }}>
          {p > 0 && p < 1 ? <PenTip p={p} w={lineWidth(line.parts.map(segText).join(''))} /> : null}
          <Reveal p={p} style={{ position: 'absolute', left: 0, bottom: 9, fontFamily: KO, fontWeight: 500, fontSize: 32, color: INK, opacity: dim, whiteSpace: 'nowrap' }}>
            {line.parts.map((s, k) =>
              typeof s === 'string' ? (
                <span key={k}>{s}</span>
              ) : 'u' in s ? (
                <U key={k} p={markP(g, s.id)}>
                  {s.u}
                </U>
              ) : (
                <Circ key={k} p={markP(g, s.id)}>
                  <span style={{ color: markP(g, s.id) > 0 ? CORAL_DEEP : INK, fontWeight: 700 }}>{s.c}</span>
                </Circ>
              ),
            )}
          </Reveal>
        </div>
      );
    })}
  </div>
);

/** 문장 번호 띠(왼쪽 여백의 작은 ①②③④). */
export const SheetTitle: React.FC = () => (
  <div style={{ position: 'absolute', left: 64, top: 46, display: 'flex', alignItems: 'baseline', gap: 14 }}>
    <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 26, color: CORAL_DEEP }}>{L('sheetTitle').ko}</span>
    <span style={{ fontFamily: MN, fontWeight: 500, fontSize: 22, color: INK3 }}>{L('sheetTitle').mn}</span>
  </div>
);

/** 카메라 따라가기: 그 문장까지 써진 줄 가운데 마지막 줄의 판 안 높이(0~100%). 줄이 바뀌면 20프레임에 걸쳐 옮겨 간다. */
export const focusY = (g: number, upto: number, boardH: number) => {
  let y = SHEET_TOP + LH * 0.5;
  for (let i = 0; i < ANSWER.length; i++) {
    if (ANSWER[i].s > upto) break;
    const p = revealOf(g, i);
    if (p <= 0) break;
    const target = SHEET_TOP + LH * (i + 0.5);
    y = y + (target - y) * prog(p, 0, 0.25);
  }
  return (y / boardH) * 100;
};
