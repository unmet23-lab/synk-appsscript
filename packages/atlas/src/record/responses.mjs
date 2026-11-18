// 판 응답 목록(단계 4 계획 §22-5) — 「내가 남긴 응답」과 짧은 연습 길이가 읽는 값. 옛 엔진(atlas/engine.js의 responses)과 같은 뜻으로 센다.
// 판(결정)마다 가장 새 응답 하나만 둔다(다른 값을 고르면 앞 응답을 대신한다). 그 뒤에 뺀 것(응답이나 그 판의 마침 · 결정을 겨눈
// record.excluded)을 거른다 — 가장 새 응답을 빼도 앞 응답이 되살아나지 않는다. 30일(RESPONSE_DAYS) 안의 응답만 새것부터 낸다.
// 새 길의 사건(새 꼴)만 센다. 옛 엔진의 응답(옛 꼴)은 셸이 옛 코치의 목록으로 따로 합친다 — 같은 응답이 두 길로 오지 않게 한다.
// 올리는 계정은 서버 읽기(talk view=trail-responses — 같은 셈을 서버에서 한 목록) 위에 기기의 사건을 얹는다. 서버 줄과 기기 사건이 같은 판이면
// 더 새 응답이 이긴다. 기기의 빼기는 서버 줄에도 듣는다(이 문서에서 뺀 응답은 앞 값에서도 바로 빠진다 — Fable새6). 서버가 이번 읽기에서 본
// 내 응답(답의 seen)은 다시 얹지 않고 서버 줄을 따른다 — 다른 기기에서 뺀 응답이 이 기기에 든 사건으로 되살아나지 않는다. 서버가 보지 못한
// 내 응답(아직 안 올렸거나 읽은 뒤에 올라감)만 얹는다(Fable 5.2 설계 검토 F1 · F2). 줄 상한에서 멈춘 읽기(답의 seenFrom이 순번)가 닿지 못한
// 내 응답(받은 표지의 순번이 seenFrom 아래)은 그 답으로 정하지 않는다 — 앞 값이 낸 응답이면 앞 값대로 두고, 앞 값도 없으면 얹지 않는다(설계
// 주인 11-18 — 「알 수 없음」은 보이지 않는 쪽).
import { EVENT_FORM, EVENT_TYPES, FEEDBACK_VALUES } from './events.mjs';

export const RESPONSE_DAYS = 30;
const DAY_MS = 86_400_000;
const ID = /^[A-Za-z0-9_.:-]{1,120}$/;
const id = value => (typeof value === 'string' && ID.test(value) ? value : null);

const later = (a, b) => {
  const at = Date.parse(a.at) - Date.parse(b.at);
  return at === 0 ? a.id > b.id : at > 0;
};

// 서버 답(나르개 responses() — { revision, serverTime, complete, seen, seenFrom, responses })에서 쓸 값만 고른다. 판이 다른 답 · 꼴이 아닌
// 답은 null. known: 서버가 이번 읽기에서 본 응답 번호(seen) — 끝까지 못 읽은 답이어도 둔다(본 응답은 서버의 판단이 맞다). seen이 없는 답(옛
// 서버)은 null — 내 응답을 다 얹는다. seenFrom: 줄 상한에서 멈춘 읽기가 마지막으로 읽은 순번(그보다 앞 순번은 읽지 않았다). 창 안을 다 읽었으면
// null이다(seen이 없는 답도 null). serverTime: 읽은 때(늦게 닿은 옛 답을 가른다 — 없으면 null).
export function serverResponses(answer, revision) {
  if (answer === null || typeof answer !== 'object' || answer.ok === false) return null;
  if (answer.revision !== revision || !Array.isArray(answer.responses)) return null;
  const rows = [];
  for (const row of answer.responses) {
    if (!id(row?.id) || !id(row.completionId) || !FEEDBACK_VALUES.includes(row.value)) continue;
    if (typeof row.at !== 'string' || !Number.isFinite(Date.parse(row.at))) continue;
    rows.push({
      id: row.id,
      at: row.at,
      value: row.value,
      completionId: row.completionId,
      decisionId: id(row.decisionId),
      variant: id(row.variant),
    });
  }
  const known = Array.isArray(answer.seen) ? new Set(answer.seen.filter(id)) : null;
  return {
    rows,
    complete: answer.complete === true,
    known,
    seenFrom: known && Number.isSafeInteger(answer.seenFrom) ? answer.seenFrom : null,
    serverTime: Number.isFinite(answer.serverTime) ? answer.serverTime : null,
  };
}

// 호스트에 둘 서버 값(코치 responses({ server })) — 판이 맞고 꼴이 맞는 답이면 그 값, 아니면 앞 값(prev). 앞 값보다 서버 시각이 앞선 답(읽기 둘이
// 날아가 늦게 닿은 옛 답)은 버린다 — 옛 답의 seen에는 그 사이에 올라간 응답이 없어 그 응답이 숨던 것(Fable 5.2 설계 검토 F2).
// 줄 상한에서 멈춘 답(seenFrom이 순번)은 앞 값이 낸 응답 가운데 이번 읽기가 보지 못한 것의 번호를 held로 이어 든다 — 이번 읽기가 닿지 못한 내
// 응답은 앞 값대로 둔다(설계 주인 11-18). 창 안을 다 읽은 답은 이어 들 것이 없다.
export function storedRead(prev, answer, revision) {
  const read = serverResponses(answer, revision);
  if (!read) return prev;
  const stale =
    Number.isFinite(prev?.serverTime) &&
    Number.isFinite(read.serverTime) &&
    read.serverTime < prev.serverTime;
  if (stale) return prev;
  if (read.seenFrom == null) return read;
  const shown = [...(prev?.rows ?? []).map(row => row.id), ...(prev?.held ?? [])];
  return { ...read, held: new Set(shown.filter(shownId => !read.known.has(shownId))) };
}

// 내 응답을 서버 줄 위에 얹나(설계 주인 11-18의 넷). 서버가 이번 읽기에서 본 응답은 서버 줄을 따른다. 아직 올리지 않은 응답(받은 표지 없음)은
// 언제나 얹는다. 받은 표지의 순번이 seenFrom 아래면 이번 읽기가 닿지 못한 것이다 — 앞 값이 낸 응답(held)이면 얹고, 아니면 얹지 않는다. 그 밖은
// 읽은 뒤에 올라간 응답이라 얹는다.
function layered(event, { known, seenFrom, held, acked }) {
  if (known?.has(event.id)) return false;
  const seq = acked?.(event.id);
  if (!Number.isSafeInteger(seq)) return true;
  if (seenFrom != null && seq < seenFrom) return held?.has(event.id) === true;
  return true;
}

// 판의 바탕 — 마침 번호 → { decisionId, variant }와 뺀 번호. 기기가 이틀이 지나 치운 마침은 서버 줄이 그 결정 · 판 종류를 준다(같은 판에 이 기기가
// 아직 안 올린 응답도 그 판으로 묶는다).
function setsOf(own, server) {
  const sets = new Map();
  const excluded = new Set();
  for (const event of own) {
    if (event.type === EVENT_TYPES.setCompleted)
      sets.set(event.id, { decisionId: event.decisionId, variant: event.variant });
    else if (event.type === EVENT_TYPES.excluded) excluded.add(event.targetId);
  }
  for (const row of server ?? [])
    if (!sets.has(row.completionId))
      sets.set(row.completionId, { decisionId: row.decisionId, variant: row.variant });
  return { sets, excluded };
}

const feedbackRow = event => ({
  id: event.id,
  at: event.at,
  value: event.value,
  completionId: event.completionId,
  decisionId: event.decisionId ?? null,
  variant: null,
});

// events: 기기에 든 사건(저장 중인 내 쓰기 포함), server: serverResponses의 rows(없으면 null), known: 서버 줄을 따를 내 응답 번호(storedRead —
// 없으면 null), seenFrom · held: storedRead의 값(없으면 null), acked: 사건 번호 → 받은 표지의 서버 순번(올리지 않았으면 undefined),
// now: 코치 시계.
export function responseRows({
  events = [],
  server = null,
  known = null,
  seenFrom = null,
  held = null,
  acked = null,
  now,
}) {
  const since = now - RESPONSE_DAYS * DAY_MS;
  const own = events.filter(event => event?.schema === EVENT_FORM.current);
  const { sets, excluded } = setsOf(own, server);
  const setOf = row => sets.get(row.completionId)?.decisionId ?? row.decisionId ?? row.completionId;
  const latest = new Map(); // 판(결정) → 그 판의 가장 새 응답
  const read = { known, seenFrom, held, acked };
  const given = own
    .filter(event => event.type === EVENT_TYPES.feedback && layered(event, read))
    .map(feedbackRow);
  for (const row of [...(server ?? []), ...given]) {
    if (!(Date.parse(row.at) >= since)) continue;
    const key = setOf(row);
    const before = latest.get(key);
    if (!before || later(row, before)) latest.set(key, row);
  }
  return [...latest.values()]
    .filter(row => ![row.id, row.completionId, setOf(row)].some(target => excluded.has(target)))
    .map(row =>
      Object.freeze({
        id: row.id,
        at: row.at,
        // 판 종류 — 코치 finishSet이 마침에 싣는 variant(short · diagnostic · mock), 모르면 null
        kind: sets.get(row.completionId)?.variant ?? row.variant ?? null,
        value: row.value,
        completionId: row.completionId,
      }),
    )
    .sort((a, b) => (later(a, b) ? -1 : later(b, a) ? 1 : 0));
}
