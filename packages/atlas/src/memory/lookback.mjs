// 30일째 문장의 자리 세기(단계 4 계획 §21-7 — 설계 주인 11-15 승인 9 · 13). 손님 코치와 서버가 같은 함수를 부른다.
//
// 받는 것: 한 단위의 근거 줄 전부(처음부터 — 답 { id, at, grade } · 본인 말 { id, at, say }, memory.fold와 같은 꼴)와 창 셋.
// 내는 것: { misses, reviews, last, clean, said, pass } — misses는 앞 창(monthAgo)에서 놓친 자리 수, reviews는 뒤 창(since)의 자리 수,
// last는 뒤 창의 마지막 자리 시각(없으면 null), clean은 뒤 창의 답 줄에 놓침(again)과 힌트를 보고 맞힘(hard)이 없는가, said는 앞 창이
// 끝난 뒤 「이미 알아요」 · 「다시 배울래요」를 말했는가, pass는 네 조건(놓친 자리 둘 이상 · 뒤 창 자리 셋 이상 · 깨끗함 · 마지막 자리가
// 지난 7학습일 안)을 모두 넘고 본인 말이 없는가.
// 자리의 경계는 기억 모델과 같다(memory/index.mjs append): 자리는 그 자리 첫 답에서 sittingHours, 놓침이 하나라도 있으면 놓친 자리,
// 「이미 알아요」 뒤의 첫 답은 새 자리를 열고, 「다시 배울래요」는 그 앞의 자리를 비운다(본인이 비운 기록을 문장이 다시 꺼내지 않는다).
// 자리는 첫 답이 든 창에 센다. 창 안의 줄만 읽으면 창 직전에 열린 자리에 이어진 답을 새 자리로 세므로 단위의 줄을 처음부터 읽는다(검토 S1).
import { sortByTime } from '../fold/order.mjs';
import { GRADES } from './grade.mjs';
import { PARAMS } from '../params.mjs';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

// 창 셋 — 학습일(기기 새벽 dayStartHour 경계, offset = 현지 시각 − UTC 분)로 센다(elapsedDays · dayKey와 같은 달력).
//   monthAgo  30일 전 학습일에서 끝나는 7학습일 [오늘−36일의 시작, 오늘−29일의 시작)
//   since     앞 창이 끝난 다음 날부터 지금까지 [오늘−29일의 시작, now]
//   last7     지난 7학습일 [오늘−6일의 시작, now]
// 날 경계는 지금 시간대 차이 하나로 센다(서머타임이 있는 곳에서는 30일 전 경계가 한 시간 어긋날 수 있다 — 몽골 · 한국은 해당 없음).
export function lookbackWindows(now, { dayStartHour = PARAMS.dayStartHour, offset = 0 } = {}) {
  if (!Number.isFinite(now)) throw new TypeError('Atlas lookback: now는 시각(밀리초)이다');
  const shift = offset * MINUTE - dayStartHour * HOUR;
  const today = Math.floor((now + shift) / DAY);
  const startOf = day => day * DAY - shift;
  return Object.freeze({
    monthAgo: Object.freeze({ from: startOf(today - 36), to: startOf(today - 29) }),
    since: Object.freeze({ from: startOf(today - 29), to: now }),
    last7: Object.freeze({ from: startOf(today - 6), to: now }),
  });
}

// 문장이 말하는 조건의 하한 — 앞 창에 놓친 자리 둘 이상, 뒤 창 자리 셋 이상(§21-7). Vellum의 수 하한(COUNTS['progress.month'])과
// 같다(시험이 맞댄다). 매개변수(PARAMS)에 두지 않는다 — 두뇌 판 묶음(foldEdition)이 바뀌어 모든 요약을 다시 접게 된다.
export const MONTH_FLOOR = Object.freeze({ misses: 2, reviews: 3 });

const SAYS = new Set(['known', 'relearn']);
const SLIPS = new Set(['again', 'hard']); // 뒤 창에 있으면 「모두 혼자 맞혔다」가 아니다 — 놓침과 힌트를 보고 맞힘
const answerRow = row => Number.isFinite(row?.at) && GRADES.includes(row.grade);
const sayRow = row => Number.isFinite(row?.at) && SAYS.has(row.say);
const inside = (at, window) => at >= window.from && at <= window.to;

// 줄 하나를 자리에 얹는다 — 기억 모델(memory/index.mjs append)과 같은 경계. open은 열린 자리다(「이미 알아요」 · 「다시 배울래요」 뒤면 null).
function place(state, row, windows, sittingMs) {
  if (sayRow(row)) {
    if (row.at >= windows.since.from) state.said = true;
    state.open = null;
    if (row.say === 'relearn') state.sittings.length = 0;
    return;
  }
  if (inside(row.at, windows.since) && SLIPS.has(row.grade)) state.clean = false;
  if (!state.open || row.at - state.open.at >= sittingMs) {
    state.open = { at: row.at, missed: row.grade === 'again' };
    state.sittings.push(state.open);
  } else if (row.grade === 'again') state.open.missed = true;
}

export function lookbackOf(rows, windows, params = PARAMS) {
  const sittingMs = params.sittingHours * HOUR;
  const state = { sittings: [], open: null, clean: true, said: false };
  const sorted = sortByTime((rows ?? []).filter(row => answerRow(row) || sayRow(row)));
  for (const row of sorted) {
    if (row.at > windows.since.to) break; // 지금 뒤의 줄(시계가 앞선 기기)은 세지 않는다
    place(state, row, windows, sittingMs);
  }
  const { sittings, clean, said } = state;
  const ago = windows.monthAgo;
  const misses = sittings.filter(s => s.missed && s.at >= ago.from && s.at < ago.to).length;
  const recent = sittings.filter(s => inside(s.at, windows.since));
  const last = recent.length ? recent.at(-1).at : null;
  const pass =
    !said &&
    misses >= MONTH_FLOOR.misses &&
    recent.length >= MONTH_FLOOR.reviews &&
    clean &&
    last !== null &&
    last >= windows.last7.from;
  return Object.freeze({ misses, reviews: recent.length, last, clean, said, pass });
}
