// 서버 길: 닿은 것을 근거 줄에서 처음부터 접는다(설계 §5-3).
// 서버에는 이어 붙이는 길이 없다 — 제 차례로 온 답이든 늦게 온 답이든, 제외든 본인 말이든 길이 하나다.
// 줄마다 그 줄의 재료만 읽으므로(다른 단위 · 다른 능력의 상태를 읽지 않는다) 닿은 것만 다시 접어도 처음부터 전부 접은 값과 같다.
// 서버(단계 3)는 잎 함수를 줄마다 부른다: 단위 = foldUnit(그 단위의 근거 줄), 능력 = foldSkill(그 능력에 서는 만남),
// 첫 만남 = firstMeeting(그 계열의 만남). foldServer는 사건 열 전체에서 셋을 한 번에 낸다(시험 · 손님 기기 · 전부 다시 접기).
import { abilityOf } from '../ability/index.mjs';
import { PARAMS } from '../params.mjs';
import { evidenceOf } from './evidence.mjs';
import { byTime } from './order.mjs';

export const foldUnit = (memory, rows) => memory.fold(rows);

// 첫 만남 = 그 계열의 가장 이른 만남(장부에 접혀 있던 만남도).
export const firstMeeting = marks => [...marks].sort(byTime)[0]?.at;

// 능력 줄에 서는 만남: 판정된 답과, 도움을 받은 흔적(판정되지 않았어도 「이어서 혼자 맞힌 수」를 끊는다).
// 장부의 만남과 도움 없는 판정 못 한 답은 서지 않는다. lead = 그 계열의 첫 만남인가.
export function skillRowsOf(marks) {
  const sorted = [...marks].sort(byTime);
  const rows = [];
  sorted.forEach((mark, index) => {
    if (mark.carried || (mark.grade == null && mark.unaided)) return;
    rows.push({ ...mark, lead: index === 0 });
  });
  return rows;
}

export const foldSkill = (rows, params = PARAMS) => abilityOf(rows, params);

// 사건 열 → 요약 { memory: Map<단위, 상태>, ability: Map<능력, 줄>, met: Map<계열, 첫 만남 시각> }.
export function foldServer(events, memory, params = PARAMS) {
  const { rows, marks } = evidenceOf(events);
  const summary = { memory: new Map(), ability: new Map(), met: new Map() };
  const bySkill = new Map();
  for (const [unit, list] of rows) summary.memory.set(unit, foldUnit(memory, list));
  for (const [key, list] of marks) {
    summary.met.set(key, firstMeeting(list));
    for (const row of skillRowsOf(list)) {
      if (!bySkill.has(row.skillId)) bySkill.set(row.skillId, []);
      bySkill.get(row.skillId).push(row);
    }
  }
  for (const [id, list] of bySkill) summary.ability.set(id, foldSkill(list, params));
  return summary;
}
