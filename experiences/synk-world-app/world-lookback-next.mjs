// 「30일째 문장」(Atlas 재설계 단계 4-4c — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §21-7)의 제품 쪽 — 하나 고르기와 이유.
// 코치(손님과 동의를 끈 계정 — coach.lookback)나 서버 읽기(서버 길 계정 — 돌아보기 읽기, 4-4c 둘째 묶음)가 낸 「네 조건을 넘은 단위마다의 수」를
// 받아, 이름이 서는 단위만 남기고(21-4 — unitRoutes와 같은 이름) 하나를 고른다. 두 출처가 같은 함수를 쓴다(카본 설계 검토 A11 — 코치가 하나를
// 골라 내면 그 단위의 이름이 서지 않을 때 조건을 채운 다른 단위가 있어도 문장이 사라진다). 화면 없이 자료의 꼴만 짓는다.
//
// 고르기: 앞 창에 놓친 자리 수와 뒤 창 자리 수의 합이 큰 것, 같으면 (날짜 열쇠 | 단위 id)의 해시 차례(Vellum 고르기와 같은 규칙 — 같은 날에는
// 같은 말, 기기 언어 · 시각 순서를 타지 않는다). 문장은 Vellum progress.month로 셸이 짓는다(한국어부터 — 영어 · 몽골어는 세 겹 대조 뒤, 그전까지 null).

const hash = text => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const count = value => (Number.isSafeInteger(value) && value >= 0 ? value : null);

// month: [{ unit, misses, reviews, last, evidence }] · routes: unitRoutes가 지은 Map(단위 → { label }) · day: 학습일 열쇠(todayKey).
export function pickMonth({ month = [], routes = new Map(), day = 0 } = {}) {
  const named = (Array.isArray(month) ? month : [])
    .filter(row => typeof row?.unit === 'string' && count(row.misses) !== null && count(row.reviews) !== null)
    .map(row => ({ row, label: routes instanceof Map ? (routes.get(row.unit)?.label ?? null) : null }))
    .filter(entry => typeof entry.label === 'string' && entry.label.trim());
  if (!named.length) return null;
  named.sort(
    (a, b) =>
      b.row.misses + b.row.reviews - (a.row.misses + a.row.reviews) ||
      hash(`${day}|${a.row.unit}`) - hash(`${day}|${b.row.unit}`) ||
      (a.row.unit < b.row.unit ? -1 : 1),
  );
  const { row, label } = named[0];
  return Object.freeze({
    unit: row.unit,
    label,
    misses: row.misses,
    reviews: row.reviews,
    last: Number.isFinite(row.last) ? row.last : null,
    evidence: row.evidence ?? null,
  });
}

// 고른 단위 → 이유({ code, slots, evidence }) — 엔진의 monthReason과 같은 꼴이다(시험이 맞댄다). 문장은 부르는 쪽이 Vellum(say)으로 짓는다 —
// 그 화면 언어의 줄이 없으면 null(문장을 비운다).
export const monthWhy = pick =>
  pick
    ? {
        code: 'progress.month',
        slots: { unit: pick.unit, misses: pick.misses, reviews: pick.reviews },
        evidence: pick.evidence ?? {},
      }
    : null;
