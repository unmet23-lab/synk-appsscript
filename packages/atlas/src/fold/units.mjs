// 문항이 묻는 기억 단위(설계 §3-1). units에는 정답을 내려면 꼭 떠올려야 하는 것만 적고, 첫째가 주 단위다.
// 태그가 없는 문항은 그 문항의 계열이 곧 단위다 — 태그를 다 채우기 전에도 모든 게임에서 기억이 돈다.
export const familyUnit = familyKey => `family:${familyKey}`;

export const unitsOf = item => (item.units?.length ? item.units : [familyUnit(item.familyKey)]);

// 답 하나가 적히는 단위(§3-2 「단위가 여럿인 문항」): 성공은 문항이 묻는 모든 단위에, 실패는 그 문항이 겨눈 단위 하나에.
// 겨눈 단위(answer.target)는 문항을 보일 때 사건에 적힌 값이다. 없거나 문항 밖이면 주 단위다.
export function creditedOf(item, answer, grade) {
  const units = unitsOf(item);
  if (grade !== 'again') return units;
  return [answer.target && units.includes(answer.target) ? answer.target : units[0]];
}
