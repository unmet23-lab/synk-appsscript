// 근거 줄과 요약의 줄(단계 3 계획 §4-2). 서버 표(engine.atlas_trail_rows · _lines)와 손님 기기 · 시험이 같은 꼴을 쓴다.
//
// 근거 줄(묶음마다 통째로 다시 짓는다)
//   { kind: 'unit',  unit, at, key, grade, responseFormat }       답 하나가 그 단위에 적힌 것(성공은 모든 단위, 실패는 겨눈 단위)
//   { kind: 'say',   unit, at, key, say }                          본인 말
//   { kind: 'meet',  family, item, skill, at, key, grade, unaided, difficulty, responseFormat, unknownOption, bits }  만남
//   { kind: 'carry', family, at, key }                             장부에 접혀 있던 만남(at null = 어떤 만남보다 먼저)
// 요약의 줄 — { unit, skill, family, item, cell } 다섯 갈래, 값이 null이면 없어진 줄이다.
import { foldSkill, foldUnit, firstMeeting, skillRowsOf } from '../fold/server.mjs';
import { evidenceOf } from '../fold/evidence.mjs';
import { sortByTime } from '../fold/order.mjs';
import { foldEventsOf, groupBits } from './adapt.mjs';

export const LINE_KINDS = Object.freeze(['unit', 'skill', 'family', 'item', 'cell']);
const NEGATIVE = Number.NEGATIVE_INFINITY;

function unitRowsOf(rows) {
  const out = [];
  for (const [unit, list] of rows)
    for (const row of list) {
      const base = { unit, at: row.at, key: row.id };
      out.push(
        'say' in row
          ? { kind: 'say', ...base, say: row.say }
          : { kind: 'unit', ...base, grade: row.grade, responseFormat: row.responseFormat },
      );
    }
  return out;
}

function meetRowsOf(marks, itemOfMark, bits) {
  const out = [];
  for (const [family, list] of marks)
    for (const mark of list) {
      if (mark.carried) {
        out.push({
          kind: 'carry',
          family,
          at: mark.at === NEGATIVE ? null : mark.at,
          key: mark.id,
        });
        continue;
      }
      out.push({
        kind: 'meet',
        family,
        item: itemOfMark(mark.id),
        skill: mark.skillId,
        at: mark.at,
        key: mark.id,
        grade: mark.grade,
        unaided: mark.unaided,
        difficulty: mark.difficulty,
        responseFormat: mark.responseFormat,
        unknownOption: mark.unknownOption,
        bits,
      });
    }
  return out;
}

// 묶음 하나 → 그 묶음의 근거 줄(차례가 정해진 목록 — 같은 묶음이면 같은 줄).
export function rowsOfGroup(group, index) {
  const events = foldEventsOf(group, index);
  if (!events.length) return [];
  const { rows, marks } = evidenceOf(events);
  const items = new Map(events.filter(e => e.item).map(e => [e.id, e.item.itemKey]));
  const rowsOut = [
    ...unitRowsOf(rows),
    ...meetRowsOf(marks, id => items.get(id) ?? null, groupBits(group)),
  ];
  return rowsOut.sort((a, b) => rowOrder(a, b));
}

const kindOrder = { unit: 0, say: 1, meet: 2, carry: 3 };
function rowOrder(a, b) {
  return (
    kindOrder[a.kind] - kindOrder[b.kind] ||
    (a.at ?? NEGATIVE) - (b.at ?? NEGATIVE) ||
    (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) ||
    String(a.unit ?? a.family).localeCompare(String(b.unit ?? b.family))
  );
}

// 근거 줄 → 단계 2 접기의 꼴.
export const toUnitRow = row =>
  row.kind === 'say'
    ? { id: row.key, at: row.at, say: row.say }
    : { id: row.key, at: row.at, grade: row.grade, responseFormat: row.responseFormat };

export const toMark = row =>
  row.kind === 'carry'
    ? {
        id: row.key,
        at: row.at ?? NEGATIVE,
        carried: true,
        grade: null,
        unaided: true,
        skillId: null,
      }
    : {
        id: row.key,
        at: row.at,
        skillId: row.skill,
        difficulty: row.difficulty,
        responseFormat: row.responseFormat,
        unknownOption: row.unknownOption === true,
        grade: row.grade,
        unaided: row.unaided,
      };

// 단위 줄 — 그 단위의 근거 줄(답 · 본인 말)에서 처음부터. 줄이 없으면 null(없어진 줄).
export function unitLine(rows, memory) {
  if (!rows.length) return null;
  return (
    foldUnit(
      memory,
      sortByTime(rows.map(toUnitRow)).map(({ i, ...row }) => row),
    ) ?? null
  );
}

// 계열 줄 — 첫 만남 시각(어떤 만남보다 먼저면 null) · 세 비트 · 그 계열에 만남이 있는 능력들. 만남이 없으면 null.
// 능력들은 기기가 쓴다 — 내 이른 답이 그 계열의 첫 만남을 가져가면 그 능력 줄들의 첫 만남(lead)이 바뀌므로 기다린다.
export function familyLine(rows) {
  if (!rows.length) return null;
  const first = firstMeeting(rows.map(toMark));
  const bits = rows.reduce((sum, row) => sum | (row.bits ?? 0), 0);
  const skills = [...new Set(rows.filter(row => row.skill).map(row => row.skill))].sort();
  return { at: first === NEGATIVE ? null : first, bits, skills };
}

export function itemLine(rows) {
  const bits = rows.reduce((sum, row) => sum | (row.bits ?? 0), 0);
  return rows.length ? { bits } : null;
}

// 한 능력에 서는 답 줄 — 그 능력에 만남이 있는 계열마다 skillRowsOf(계열의 첫 만남 lead를 붙임) 가운데 그 능력의 것.
export function skillRowsFor(skill, familyRows) {
  const out = [];
  for (const rows of familyRows)
    for (const row of skillRowsOf(rows.map(toMark))) if (row.skillId === skill) out.push(row);
  return out;
}

export const skillLine = (rows, params) => (rows.length ? foldSkill(rows, params) : null);

// 칸별 측정 요약(설계 §5-2 「지금 꼴 그대로」) — 혼자 낸 첫 답 수 · 맞힌 수 · 도움받은 수 · 마지막 때.
// 계열의 첫 만남(lead)만 센다: 판정된 혼자 낸 답이면 혼자 낸 첫 답(놓침이 아니면 맞힘), 도움이 든 첫 만남이면 도움받은 것.
export function cellLines(skill, rows) {
  const cells = new Map();
  for (const row of rows) {
    if (!row.lead) continue;
    const solo = row.unaided && row.grade != null;
    if (!solo && row.unaided) continue;
    const key = `${skill}|${row.difficulty}`;
    const cell = cells.get(key) ?? {
      skillId: skill,
      difficulty: row.difficulty,
      independent: 0,
      correct: 0,
      helped: 0,
      lastAt: null,
    };
    if (solo) {
      cell.independent += 1;
      if (row.grade !== 'again') cell.correct += 1;
    } else cell.helped += 1;
    cell.lastAt = Math.max(cell.lastAt ?? NEGATIVE, row.at);
    cells.set(key, cell);
  }
  return cells;
}

// 기록 전부 → 요약의 줄 전부(손님 기기 · 시험의 기준). 서버의 「닿은 것만 다시 접기」는 이것과 같아야 한다.
export function linesOfGroups(groups, { memory, params, index }) {
  const rows = [...groups.values()].flatMap(group => rowsOfGroup(group, index));
  const byUnit = groupBy(
    rows.filter(r => r.kind === 'unit' || r.kind === 'say'),
    r => r.unit,
  );
  const byFamily = groupBy(
    rows.filter(r => r.kind === 'meet' || r.kind === 'carry'),
    r => r.family,
  );
  const byItem = groupBy(
    rows.filter(r => r.kind === 'meet' && r.item),
    r => r.item,
  );
  const lines = emptyLines();
  for (const [unit, list] of byUnit) setLine(lines.unit, unit, unitLine(list, memory));
  for (const [family, list] of byFamily) setLine(lines.family, family, familyLine(list));
  for (const [item, list] of byItem) setLine(lines.item, item, itemLine(list));
  const skills = new Set(rows.filter(r => r.kind === 'meet').map(r => r.skill));
  for (const skill of skills) {
    const families = [...byFamily.values()].filter(list => list.some(r => r.skill === skill));
    const skillRows = skillRowsFor(skill, families);
    setLine(lines.skill, skill, skillLine(skillRows, params));
    for (const [key, cell] of cellLines(skill, skillRows)) lines.cell.set(key, cell);
  }
  return lines;
}

export const emptyLines = () => Object.fromEntries(LINE_KINDS.map(kind => [kind, new Map()]));
const setLine = (map, key, value) => {
  if (value != null) map.set(key, value);
};

export function groupBy(list, keyOf) {
  const out = new Map();
  for (const item of list) {
    const key = keyOf(item);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(item);
  }
  return out;
}
