// 접는 차례(설계 §5-3 「시각과 차례」). 시각 순, 시각이 같으면 한 번 매겨지면 바뀌지 않는 번호(id) 순 —
// 2판 사건은 사건 번호, 옛 꼴 사건은 서버가 받은 차례 번호다. 번호가 없으면 받은 차례(i)로 가른다.
// 서버 접기 · 기기 얹기 · 기억 접기가 모두 이 차례를 쓴다 — 몇 번을 다시 접어도 값이 같다.
// 번호는 둘 다 글자이거나 둘 다 수여야 견줄 수 있다(글자 「10」과 수 9를 섞으면 차례가 뒤집힌다) — 섞이면 던진다.
function compareIds(a, b) {
  if (typeof a !== typeof b)
    throw new TypeError(`Atlas: 사건 번호의 꼴이 섞였다(${typeof a} · ${typeof b})`);
  return a < b ? -1 : 1;
}

export function byTime(a, b) {
  if (a.at !== b.at) return a.at - b.at;
  if (a.id != null && b.id != null && a.id !== b.id) return compareIds(a.id, b.id);
  return (a.i ?? 0) - (b.i ?? 0);
}

// 받은 차례를 i로 달아 정렬한다(원래 배열은 건드리지 않는다).
export const sortByTime = list => list.map((row, i) => ({ ...row, i })).sort(byTime);
