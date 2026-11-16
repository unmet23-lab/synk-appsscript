// 30일째 문장의 세기 — 서버 읽기(SYNK-talk · 리허설 서버)와 손님 코치가 같이 쓴다(단계 4 계획 §21-22). 저장소의 근거 줄(rows.mjs의 꼴,
// kind 'unit' · 'say')을 기억 접기의 꼴(toUnitRow)로 바꿔 lookbackOf로 센다. 세는 법이 서버와 손님 기록부에서 갈라지지 않게 한 곳에 둔다.
import { lookbackOf, MONTH_FLOOR } from '../memory/lookback.mjs';
import { PARAMS } from '../params.mjs';
import { toUnitRow } from './rows.mjs';

const byUnit = (a, b) => (a.unit < b.unit ? -1 : a.unit > b.unit ? 1 : 0);

// 한 단위 — 네 조건을 넘으면 { unit, misses, reviews, last, evidence }(손님 코치 lookback()의 month 꼴), 아니면 null.
// rows는 그 단위의 근거 줄 전부(처음부터)다. 창 안의 줄만 주면 창 직전에 열린 자리에 이어진 답을 새 자리로 센다(검토 S1).
export function unitLookback(unit, rows, windows, params = PARAMS) {
  const counts = lookbackOf((rows ?? []).map(toUnitRow), windows, params);
  if (!counts.pass) return null;
  const { misses, reviews, last } = counts;
  const evidence = Object.freeze({ ...windows, misses, reviews, last });
  return Object.freeze({ unit, misses, reviews, last, evidence });
}

// 서버 저장소(server.mjs의 store 포트)에서 센다. 첫 걸음은 앞 창 안에 놓침 줄이 있는 단위를 시각 색인으로 찾고, 둘째 걸음은 그 단위마다
// 줄을 처음부터 읽어 센다. 내는 것은 단위 이름 차례의 month 배열이다.
// 첫 걸음이 단위를 빠뜨리지 않는 까닭(설계 검토 Fable P3 — 짓다가 까닭을 바로잡음): 조건을 넘는 단위는 앞 창에 첫 답이 든 놓친 자리가
// MONTH_FLOOR.misses 이상, 곧 하나 이상 있고, 뒤 창의 답 줄에 놓침이 없다(깨끗함). 그 놓친 자리의 놓침 줄은 첫 답(앞 창 안) 뒤에 있고,
// 앞 창 끝을 넘으면 뒤 창(앞 창이 끝난 때부터 지금까지 — 두 창은 이어져 있다)에 들어 깨끗함을 깨므로 조건을 넘지 못한다. 그래서 조건을
// 넘는 단위의 놓침 줄은 반드시 앞 창 안에 있다. 하한이 1 아래로 내려가면(놓친 자리 없이 넘는 단위) 첫 걸음이 그 단위를 놓친다 —
// 하한을 내리면 이 첫 걸음도 함께 고친다(아래 막이가 그때 멈춘다).
export async function lookbackOfStore(store, windows, params = PARAMS) {
  if (!(MONTH_FLOOR.misses >= 1))
    throw new Error(
      'Atlas lookback: 서버 읽기의 첫 걸음은 놓친 자리 하한이 하나 이상일 때만 빠짐이 없다',
    );
  const units = await store.missedUnits(windows.monthAgo.from, windows.monthAgo.to);
  const rows = await store.unitRowsOf(units);
  const month = [];
  for (const unit of units) {
    const entry = unitLookback(unit, rows.get(unit) ?? [], windows, params);
    if (entry) month.push(entry);
  }
  return month.sort(byUnit);
}
