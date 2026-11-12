// 기기가 든 요약(설계 §5-3 「요약(스냅숏)」) — 서버가 내려 준 달라진 줄을 갈아 끼우고, 단계 2의 보기(createView의 요약 꼴)로 바꾼다.
//   요약 = { edition, gen?, foldedUntil, lineSeq, issued, lines: { unit, skill, family, item, cell }(Map), latestAt }
// 판 묶음이 다르거나 통째(full)로 온 답은 줄을 통째로 바꾼다. 없어진 줄(value null)은 지운다.
// gen(세대 표지 — 단계 4 계획 §18-5-4)은 서버가 머리를 만들 때 단다: `<머리 만든 서버 시각 13자리>.<난수>`. 같은 판 묶음 이름의 머리를
// 다시 지으면(비우기 · 판 묶음 A → B → A) 줄 차례(lineSeq)가 처음부터 다시 서므로, 차례만 견주면 새 머리의 통째 답을 옛 것으로 읽어
// 버리고(D1) 옛 머리의 늦은 답이 새 요약을 덮는다(D2). gen이 다르면 차례를 견주지 않는다 — 시각이 큰 쪽이 새 머리다.
import { LINE_KINDS, emptyLines } from './rows.mjs';

const NEGATIVE = Number.NEGATIVE_INFINITY;
const GEN = /^(\d{13})\.[0-9a-z]{1,16}$/;

// gen의 시각(머리를 만든 서버 시각). gen이 없거나(gen 전에 받은 요약) 꼴이 아니면 가장 작다(R17).
export const genTime = gen => {
  const match = typeof gen === 'string' ? GEN.exec(gen) : null;
  return match ? Number(match[1]) : NEGATIVE;
};

// 머리의 차례 — next가 current보다 새 머리면 1, 같은 머리면 0, 옛 머리면 −1. 같은 밀리초의 다른 gen은 뒤에 온 쪽(next)을 새 머리로
// 본다 — 틀렸어도 기기가 그 gen으로 묻고 서버가 지금 머리의 통째 답을 다시 주므로 스스로 맞는다(작은 쪽을 고정으로 버리면 영영 못 받는다).
export function headOrder(next, current) {
  const a = next?.gen ?? null;
  const b = current?.gen ?? null;
  if (a === b) return 0;
  return genTime(a) < genTime(b) ? -1 : 1;
}

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
//   옛 머리(작은 gen)의 답은 통째든 부분이든 지금 요약을 그대로 돌려준다(D2). 새 머리(다른 gen)의 통째 답은 차례를 견주지 않고
//   갈아 끼우고(D1 — 다시 지은 머리의 차례가 기기 것보다 작다), 부분 답은 얹지 않는다(null — 기준이 다른 머리, 다음 요청이 통째로).
//   부분 답(full false)은 그 답을 부른 기준 요약 위에서만 뜻이 있다 — 기준이 없거나 판 묶음이 다르면 얹지 않고 null(다음 요청이
//   통째로 받는다). 기준 없이 얹으면 앞 줄 없이 갱신 차례만 확정돼 그 뒤 부분 답도 계속 비었다(GPT 끝 판 GD1).
//   같은 머리 · 같은 판 묶음의 늦게 온 옛 답(갱신 차례가 작거나, 같은데 덜 접힘)은 지금 요약을 그대로 돌려준다 — 줄 · 차례가 되돌아가지 않게(GD2).
// 같은 머리 위의 답을 얹을 수 있나 — 'apply' · 'keep'(지금 요약 그대로) · 'skip'(얹지 않음 — null).
function sameHeadFit(current, delta) {
  const sameBase = Boolean(current) && current.edition === delta.edition;
  if (!delta.full && !sameBase) return 'skip';
  if (
    sameBase &&
    (delta.lineSeq < current.lineSeq ||
      (delta.lineSeq === current.lineSeq && delta.foldedUntil < current.foldedUntil))
  )
    return 'keep';
  // 같은 머리 · 같은 차례 · 같은 접은 자리면 달라진 것이 없다(빈 부분 답 · 같은 통째 답) — 지금 요약 그대로라 기록을 새로 쓰지
  // 않는다(단계 4 §18-5-5 B5). 「낸 것」도 접을 때만 바뀌므로 같다.
  if (sameBase && delta.lineSeq === current.lineSeq && delta.foldedUntil === current.foldedUntil)
    return 'keep';
  return 'apply';
}

function fitOf(current, delta) {
  const order = current ? headOrder(delta, current) : 0;
  if (order < 0) return 'keep';
  if (order > 0) return delta.full ? 'apply' : 'skip';
  return sameHeadFit(current, delta);
}

export function applyDelta(current, delta) {
  const fit = fitOf(current, delta);
  if (fit === 'keep') return current;
  if (fit === 'skip') return null;
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
    ...(delta.gen ? { gen: delta.gen } : {}),
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
