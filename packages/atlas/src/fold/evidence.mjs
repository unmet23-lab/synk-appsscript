// 접기 사건 → 근거 줄(설계 §5-3 「재료는 두 가지뿐이다」).
//   ① 단위마다의 근거 줄 — 답(성공은 문항이 묻는 모든 단위에, 실패는 겨눈 단위 하나에)과 본인 말.
//   ② 계열마다의 만남 표 — 답과 도움. 판정 못 한 답과 거둔 답도 남는다(제외는 줄을 뺄 뿐 만났다는 사실은 지우지 않는다).
//      옮겨 온 장부의 계열은 「앞 장부를 뜬 때」의 만남이다(처음 옮기는 장부면 어떤 만남보다 먼저 — −∞).
// 받은 차례는 쓰지 않는다. 시각 순(같으면 사건 번호 순)으로 놓고 본다.
//
// 접기 사건(단계 3의 어댑터가 2판 · 옛 꼴 사건에서 만든다 — docs/_ops/qa/atlas-redesign-20261110/단계2_계획.md §2-2):
//   답           { kind: 'answer', id, at, item, answer: { correct, assisted, answerShown, unknown, assessable, target } }
//   도움         { kind: 'help', id, at, item } — 그 제시의 첫 답보다 앞선 도움이나 답 없이 본 도움이 있으면 첫 도움 시각에 하나
//                (첫 답 뒤에 본 해설 · 정답은 되짚기라 내지 않는다 — 설계 §3-3)
//   본인 말      { kind: 'say', id, at, unit, say: 'known' | 'relearn' }
//   제외         { kind: 'exclude', id, at, ref, touches? } — 답이나 본인 말 하나를 거둔다
//   옮겨 온 장부 { kind: 'carry', id, at, families, after? }
// 보이기만 하고 답도 도움도 없이 닫은 제시는 여기 오지 않는다 — 만남이 아니다(지금 측정 계약 그대로).
import { gradeOf } from '../memory/grade.mjs';
import { byTime } from './order.mjs';
import { creditedOf } from './units.mjs';

// 만남 하나. unaided = 도움(힌트 · 답 보기) 없이 낸 답인가 — 도움만 보고 나간 것과 도움을 받은 답은 false다.
export function markOf(event, grade) {
  const item = event.item;
  const answer = event.answer;
  return {
    id: event.id,
    at: event.at,
    skillId: item.skillId,
    difficulty: item.difficulty,
    responseFormat: item.responseFormat,
    unknownOption: item.unknownOption === true,
    grade,
    unaided: event.kind === 'answer' && answer.assisted !== true && answer.answerShown !== true,
  };
}

// 단위 근거 줄 하나(답). 응답 꼴은 끈질긴 단위를 다른 꼴로 먼저 내는 재료다(§3-5) — 서버의 근거 줄에도 싣는다.
export const unitRowOf = (event, grade) => ({
  id: event.id,
  at: event.at,
  grade,
  responseFormat: event.item.responseFormat,
});

// 답 사건의 등급(거둔 답 · 도움만 본 것은 null).
export const gradeOfEvent = (event, excluded = false) =>
  event.kind !== 'answer' || excluded
    ? null
    : gradeOf({ ...event.answer, responseFormat: event.item.responseFormat });

const push = (map, key, value) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};

// 옮겨 온 장부: 그 계열들을 「장부에 접혀 있던 만남」으로 적는다. 그 만남의 시각은 앞 장부를 뜬 때(after)다 — 처음이면 맨 앞(−∞).
// 앞 장부를 뜬 때보다 이른 답은 그때 이미 사건으로 옮겨져 있던 것이라 그대로 첫 만남이고, 그 뒤의 답은 장부에 접힌 만남보다 늦다.
const carriedMark = event => ({
  id: event.id,
  at: event.after ?? Number.NEGATIVE_INFINITY,
  carried: true,
  grade: null,
  unaided: true,
  skillId: null,
});

function addEvent(event, gone, rows, marks) {
  if (event.kind === 'say') {
    if (!gone.has(event.id)) push(rows, event.unit, { id: event.id, at: event.at, say: event.say });
    return;
  }
  if (event.kind === 'carry') {
    for (const key of event.families) push(marks, key, carriedMark(event));
    return;
  }
  if (event.kind !== 'answer' && event.kind !== 'help') return;
  const grade = gradeOfEvent(event, gone.has(event.id));
  push(marks, event.item.familyKey, markOf(event, grade));
  if (grade == null) return;
  for (const unit of creditedOf(event.item, event.answer, grade))
    push(rows, unit, unitRowOf(event, grade));
}

// 사건 열 → { rows: Map<단위, 근거 줄[]>, marks: Map<계열, 만남[] (시각 순)> }.
export function evidenceOf(events) {
  const gone = new Set(events.filter(event => event.kind === 'exclude').map(event => event.ref));
  const rows = new Map();
  const marks = new Map();
  for (const event of [...events].sort(byTime)) addEvent(event, gone, rows, marks);
  for (const list of marks.values()) list.sort(byTime);
  return { rows, marks };
}
