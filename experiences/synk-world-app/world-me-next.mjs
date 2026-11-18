// 「나」 칸(Atlas 재설계 단계 4-5 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §22-6)의 제품 쪽 — 거름 · 나눔 · 순서. 화면 없이 자료의 꼴만 짓는다.
// 코치 요약의 단위 줄(summary().units — kind · label · last · state · lapses · lastAt, §22-2)을 받아 흔들리는 말(shaky) · 또렷한 말(clear) · 내가 안다고
// 한 말(said — 직접 말함) 셋으로 나눈다. 익히는 중(learning)은 싣지 않는다. 이름은 「내 위치」와 같은 단위 길(unitRoutes가 지은 Map — 단위 → { label })에서
// 고르고, 그 길에 이름이 없으면 요약 줄의 label을 쓴다. 둘 다 없는 단위(family: 계열 · 받지 않은 은행의 낱말)는 목록과 수에서 빼고 그 수만 센다(N3).
// 차례: 흔들리는 말은 급한 것부터 — 놓친 수가 많은 것, 같으면 마지막 자리가 오래된 것(지금 떠올릴 확률이 더 낮다). 나머지 둘은 이름 차례다. 끝에 단위
// 이름으로 가른다(같은 입력이면 늘 같은 차례).

export const ME_STATES = Object.freeze(['shaky', 'clear', 'said']);

const labelOf = (row, names) => {
  const routed = names instanceof Map ? names.get(row.unit)?.label : null;
  const label = typeof routed === 'string' && routed.trim() ? routed : row.label;
  return typeof label === 'string' && label.trim() ? label : null;
};
const finite = value => (Number.isFinite(value) ? value : 0);
const byName = (a, b) => a.label.localeCompare(b.label, 'ko') || (a.unit < b.unit ? -1 : a.unit > b.unit ? 1 : 0);
const byUrgency = (a, b) =>
  finite(b.lapses) - finite(a.lapses) || finite(a.lastAt) - finite(b.lastAt) || byName(a, b);

// summary: 코치 summary()(units가 없으면 빈 목록) · names: unitRoutes가 지은 Map(없으면 요약 줄의 label만).
// 돌려주는 것: { shaky, clear, said, counts: { shaky, clear, said }, unnamed } — 줄은 { unit, kind, label, last, lapses, lastAt }.
export function meUnits(summary, names = null) {
  const lists = { shaky: [], clear: [], said: [] };
  let unnamed = 0;
  for (const row of Array.isArray(summary?.units) ? summary.units : []) {
    if (typeof row?.unit !== 'string' || !ME_STATES.includes(row.state)) continue;
    const label = labelOf(row, names);
    if (!label) {
      unnamed += 1;
      continue;
    }
    lists[row.state].push({
      unit: row.unit,
      kind: row.kind ?? null,
      label,
      last: row.last ?? null,
      lapses: finite(row.lapses),
      lastAt: Number.isFinite(row.lastAt) ? row.lastAt : null,
    });
  }
  lists.shaky.sort(byUrgency);
  lists.clear.sort(byName);
  lists.said.sort(byName);
  return {
    ...lists,
    counts: { shaky: lists.shaky.length, clear: lists.clear.length, said: lists.said.length },
    unnamed,
  };
}
