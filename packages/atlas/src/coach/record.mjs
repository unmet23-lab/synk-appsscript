// 코치가 기록(단계 3 src/record)을 부르는 한 자리(단계 4 계획 §3-2 「기록에 기대는 얇은 겹」). 단계 3 끝 판 검수로 기록 API가
// 바뀌면 이 파일만 고친다. 기록부는 저장이 끝난 사건만 근거로 보이고(add의 stored), 서버의 답을 받고(receive), 꼬리를 읽는다(refresh).
// 서버의 답 꼴(learning?view=trail POST · GET) — { accepted, clamped, rejected, rejectedCode, summary, serverTime }(GET은 summary · serverTime).
import { evidenceOf } from '../fold/evidence.mjs';
import { deviceKey, foldEventsOf, groupsOf, itemOf } from '../record/adapt.mjs';
import { EVENT_FORM, EVENT_TYPES } from '../record/events.mjs';
import { openRecord } from '../record/log.mjs';

const isCurrent = event => event.schema === EVENT_FORM.current;

// 기록부가 든 사건 → 어댑터의 기록(log.mjs와 같은 열쇠 — 2판은 사건 번호, 옛 꼴은 a.<적힌 시각>.l<든 차례>). 든 차례는 기록부가 든 차례 그대로다.
const entriesOf = events =>
  events.map((event, i) => ({
    event,
    key: isCurrent(event) ? event.id : deviceKey(i + 1, event),
    atMs: Date.parse(event.at),
  }));

// 그 계열의 만남(답 · 도움 · 장부 만남)이 드는 묶음만 — 그 계열의 제시 묶음과 옮겨 온 장부. 묶음은 기록 전체로 짓는다(어댑터 groupsOf —
// 전체 접기와 같은 근거): 계열 사건만 먼저 고르면 옛 꼴 결정과 그것을 겨눈 제외(그 결정의 제시들 답을 통째로 거둔다)가 빠져, 거둔 답이
// 첫 혼자 답으로 섰다(GPT 끝 판 둘째 E).
function familyGroups(entries, family, index) {
  return [...groupsOf(entries)].filter(([, group]) => {
    const event = group.source.event;
    if (event.type === EVENT_TYPES.carried) return true;
    return event.type === EVENT_TYPES.presented && itemOf(event, index)?.familyKey === family;
  });
}

// 측정용 첫 만남(계획 §16 ② — Fable 5.2 D1 · D6). 그 계열의 만난 표 시각(at)에 선 만남 가운데 접기의 차례(시각 → 사건 번호, fold/order.mjs
// byTime)로 맨 앞 하나 — { id(그 만남의 접기 번호 = 답이면 답 사건 번호), source(그 만남이 든 묶음의 머리 — 제시 번호), carried, solo }.
// 만남의 차례는 어댑터(groupsOf · foldEventsOf)가 짓는 만남으로 짠다 — 도움 · 장부 만남 · 옛 꼴 사건의 차례가 접기와 같다.
// 그 시각의 만남이 기록부에 없으면 null(요약으로 접힌 옛 만남 — 이 제시의 것이 아니다).
function leadAt(record, family, at, index) {
  const folds = [];
  const sourceOf = new Map();
  for (const [source, group] of familyGroups(entriesOf(record.heldEvents()), family, index))
    for (const fold of foldEventsOf(group, index)) {
      folds.push(fold);
      sourceOf.set(fold.id, source);
    }
  const lead = (evidenceOf(folds).marks.get(family) ?? []).find(mark => mark.at === at);
  if (!lead) return null;
  return {
    id: lead.id,
    source: sourceOf.get(lead.id) ?? null,
    carried: lead.carried === true,
    solo: lead.unaided === true && lead.grade != null,
  };
}

// exclusive: 호스트의 차례(turn) — 기록부가 차례 밖에서 시작된 손님 요약 저장에만 청한다(§18-5-1 R1).
export async function openTrail({
  port,
  revision,
  guest,
  memory,
  params,
  index,
  health,
  now,
  exclusive,
}) {
  const record = await openRecord({
    port,
    revision,
    guest,
    memory,
    params,
    index,
    health,
    ...(now ? { now } : {}),
    ...(exclusive ? { exclusive } : {}),
  });
  const clockNow = now ?? (() => Date.now());
  const nowMs = () => Math.round(clockNow() + record.clock.offsetMs);
  return {
    record,
    add: (type, fields) => record.add(type, fields),
    view: () => record.view(),
    // 「낸 것」 — 줄마다 사건 번호(id)가 실린다(단계 3 49935bb51, 계획 §16 ①). 번호 없는 서버 요약 줄은 id 칸 없이 그대로 온다.
    issued: () => record.issued(),
    leadAt: (family, at) => leadAt(record, family, at, index),
    refresh: () => record.refresh(),
    // 저장 중인 사건(부모를 기다리는 자식까지)이 다 끝날 때까지 — 올리기 전에(단계 3 bed650c2f).
    saved: () => record.saved?.() ?? Promise.resolve(),
    // 손님: 지금 든 사건까지 요약을 바로 접는다(판 끝 — 칸에 방금 푼 답이 들게). 계정은 서버가 접으므로 아무것도 안 한다.
    refold: () => record.refold?.() ?? Promise.resolve(),
    // 보낼 대기열 — skip(이 세션에 건너뛸 번호)과 그것에 기댄 사건은 빼고 그 너머를 읽는다(§18-5-2 R12 · R13).
    unsent: (limit, skip) => record.unsent(limit, skip),
    // 요약을 받을 기준(GET · POST의 since) — 판 묶음 · 줄 차례 · 세대 표지(§18-5-4).
    since: () => record.since(),
    receive: answer =>
      record.receive({
        accepted: answer?.accepted ?? [],
        clamped: answer?.clamped ?? [],
        rejected: answer?.rejected ?? [],
        // 서버가 뺀 까닭(200 답의 rejectedCode — EVENT_LINK 등) — 계기 코드가 맞게 그대로 넘긴다. 없으면 기록부의 기본(옛 동의 판).
        ...(answer?.rejectedCode ? { rejectedCode: answer.rejectedCode } : {}),
        summary: answer?.summary ?? null,
        serverTime: answer?.serverTime ?? null,
      }),
    heldEvent: id => record.heldEvent(id),
    heldEvents: () => record.heldEvents(),
    summary: () => record.summary,
    pending: () => record.pending(),
    // 호스트가 차례 안에서 일을 할 때(그 동안 기록부는 차례를 다시 청하지 않는다) · 뒤의 손님 요약 저장 · 하루 한 번 치우기(A6).
    enterTurn: () => record.enterTurn(),
    leaveTurn: () => record.leaveTurn(),
    localSaved: () => record.localSaved(),
    compactDue: () => record.compactDue(),
    compact: () => record.compact(),
    // 고르기의 지금 시각 — 서버 시각과의 차이를 고친 기기 시각(사건 시각과 같은 시계).
    now: nowMs,
  };
}
