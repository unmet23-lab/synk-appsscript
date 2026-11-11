// 기기가 든 요약(설계 §5-3 「요약(스냅숏)」) — 서버가 내려 준 달라진 줄을 갈아 끼우고, 단계 2의 보기(createView의 요약 꼴)로 바꾼다.
//   요약 = { edition, foldedUntil, lineSeq, issued, lines: { unit, skill, family, item, cell }(Map), latestAt }
// 판 묶음이 다르거나 통째(full)로 온 답은 줄을 통째로 바꾼다. 없어진 줄(value null)은 지운다.
import { LINE_KINDS, emptyLines } from './rows.mjs';

const NEGATIVE = Number.NEGATIVE_INFINITY;

function latestOf(lines) {
  let latest = 0;
  for (const value of lines.unit.values()) latest = Math.max(latest, value.latestAt ?? 0);
  for (const value of lines.skill.values()) latest = Math.max(latest, value.lastAt ?? 0);
  for (const value of lines.family.values()) latest = Math.max(latest, value.at ?? 0);
  return latest;
}

export const emptySummary = edition => ({
  edition,
  foldedUntil: 0,
  lineSeq: 0,
  issued: [],
  lines: emptyLines(),
  latestAt: 0,
});

// 서버의 답(summaryOf의 꼴)을 지금 요약에 얹는다. 지금 요약을 바꾸지 않고 새 요약을 돌려준다.
//   부분 답(full false)은 그 답을 부른 기준 요약 위에서만 뜻이 있다 — 기준이 없거나 판 묶음이 다르면 얹지 않고 null(다음 요청이
//   통째로 받는다). 기준 없이 얹으면 앞 줄 없이 갱신 차례만 확정돼 그 뒤 부분 답도 계속 비었다(GPT 끝 판 GD1).
//   같은 판 묶음의 늦게 온 옛 답(갱신 차례가 작거나, 같은데 덜 접힘)은 지금 요약을 그대로 돌려준다 — 줄 · 차례가 되돌아가지 않게(GD2).
export function applyDelta(current, delta) {
  const sameBase = Boolean(current) && current.edition === delta.edition;
  if (!delta.full && !sameBase) return null;
  if (
    sameBase &&
    (delta.lineSeq < current.lineSeq ||
      (delta.lineSeq === current.lineSeq && delta.foldedUntil < current.foldedUntil))
  )
    return current;
  const whole = delta.full;
  const lines = whole
    ? emptyLines()
    : Object.fromEntries(LINE_KINDS.map(kind => [kind, new Map(current.lines[kind])]));
  for (const line of delta.lines) {
    if (!LINE_KINDS.includes(line.kind)) continue;
    if (line.value == null) lines[line.kind].delete(line.key);
    else lines[line.kind].set(line.key, line.value);
  }
  return {
    edition: delta.edition,
    foldedUntil: delta.foldedUntil,
    lineSeq: delta.lineSeq,
    issued: [...delta.issued],
    lines,
    latestAt: latestOf(lines),
  };
}

// 저장 포트에 쓰는 꼴(Map은 그대로 구조 복제되지만, 기록 하나를 작게 두려고 배열로).
export const packSummary = summary =>
  summary && {
    ...summary,
    lines: Object.fromEntries(LINE_KINDS.map(kind => [kind, [...summary.lines[kind]]])),
  };
export const unpackSummary = packed =>
  packed && {
    ...packed,
    lines: Object.fromEntries(LINE_KINDS.map(kind => [kind, new Map(packed.lines[kind] ?? [])])),
  };

// 단계 2 보기의 요약 꼴 — { memory, ability, met }. 첫 만남이 「어떤 만남보다 먼저」(null)면 −∞.
export function viewOf(summary) {
  if (!summary) return null;
  return {
    memory: new Map(summary.lines.unit),
    ability: new Map(summary.lines.skill),
    met: new Map([...summary.lines.family].map(([family, line]) => [family, line.at ?? NEGATIVE])),
  };
}
