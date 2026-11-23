// 코치가 기록(단계 3 src/record)을 부르는 한 자리(단계 4 계획 §3-2 「기록에 기대는 얇은 겹」). 단계 3 끝 판 검수로 기록 API가
// 바뀌면 이 파일만 고친다. 기록부는 저장이 끝난 사건만 근거로 보이고(add의 stored), 서버의 답을 받고(receive), 꼬리를 읽는다(refresh).
// 서버의 답 꼴(learning?view=trail POST · GET) — { accepted, clamped, rejected, rejectedCode, summary, serverTime }(GET은 summary · serverTime).
import { evidenceOf } from '../fold/evidence.mjs';
import { audiosBefore, foldEventsOf } from '../record/adapt.mjs';
import { openRecord } from '../record/log.mjs';

// 묶음은 기록부의 묶음 색인이 든다(record/groups.mjs — 든 사건 전부로 지은 groupsOf와 같은 묶음, 자식 · 제외는 포트 열쇠 차례). 계열의 만남은
// 그 계열의 제시 묶음과 옮겨 온 장부만 접는다(record.familyGroups). 묶음은 기록 전체로 지은 것이라 옛 꼴 결정을 겨눈 제외(그 결정의 제시들 답을
// 통째로 거둔다)도 든다(GPT 끝 판 둘째 E). 옛 꼴 사건의 기록 열쇠는 기록부와 같은 든 차례(position)다 — 옛 꼴 lead의 번호 글자만 열쇠 차례(i + 1)로
// 짓던 앞 판과 다르고, 측정 · 놓침 기록은 2판 제시 · 2판 답 번호와만 견주므로 결과는 같다(설계 ① · 대조 시험 coach/record-index.test.mjs).

// 묶음들([머리 번호, 묶음] 쌍)을 접은 계열마다의 만남(접기 차례)과, 접기 번호 → 그 만남이 든 묶음의 머리.
function marksOf(groups, index) {
  const folds = [];
  const sourceOf = new Map();
  for (const [source, group] of groups)
    for (const fold of foldEventsOf(group, index)) {
      folds.push(fold);
      sourceOf.set(fold.id, source);
    }
  return { marks: evidenceOf(folds).marks, sourceOf };
}

// 측정용 첫 만남(계획 §16 ② — Fable 5.2 D1 · D6). 그 계열의 만난 표 시각(at)에 선 만남 가운데 접기의 차례(시각 → 사건 번호, fold/order.mjs
// byTime)로 맨 앞 하나 — { id(그 만남의 접기 번호 = 답이면 답 사건 번호), source(그 만남이 든 묶음의 머리 — 제시 번호), carried, solo }.
// 만남의 차례는 어댑터(groupsOf · foldEventsOf)가 짓는 만남으로 짠다 — 도움 · 장부 만남 · 옛 꼴 사건의 차례가 접기와 같다.
// 그 시각의 만남이 기록부에 없으면 null(요약으로 접힌 옛 만남 — 이 제시의 것이 아니다).
function leadIn({ marks, sourceOf }, family, at) {
  return leadOfMark(
    (marks.get(family) ?? []).find(mark => mark.at === at),
    sourceOf,
  );
}
function leadOfMark(lead, sourceOf) {
  if (!lead) return null;
  return {
    id: lead.id,
    source: sourceOf.get(lead.id) ?? null,
    carried: lead.carried === true,
    solo: lead.unaided === true && lead.grade != null,
  };
}
export const leadAt = (record, family, at, index) =>
  leadIn(marksOf(record.familyGroups(family), index), family, at);

// 계열마다의 첫 만남을 한 번에(놓침 기록 answerLog — 단계 4 계획 §25-5). 든 사건 전부를 한 번 묶고 접어, 묻는 계열 · 시각마다 leadAt과 같은
// 값을 낸다. 계열의 만남은 그 계열의 묶음과 장부만 접은 것과 같다 — 제외 접기는 답 번호를 겨누어 다른 계열에 닿지 않는다. 줄마다 leadAt을
// 부르면 부를 때마다 든 사건 전체를 다시 묶고 접는다. 묶음(제시 번호 → { source, children, exclusions })도 함께 낸다.
// 계열마다 시각 → 그 시각의 맨 앞 만남 표를 처음 물을 때 한 번 짓는다 — 첫 만남이 서버 요약에만 있는 계열도 줄마다 만남 목록을 끝까지
// 훑지 않는다(GPT GA6).
export function meetsOf(record, index) {
  const groups = record.groups();
  const { marks, sourceOf } = marksOf(groups, index);
  const byFamily = new Map();
  const firstAt = family => {
    let byAt = byFamily.get(family);
    if (!byAt) {
      byAt = new Map();
      for (const mark of marks.get(family) ?? []) if (!byAt.has(mark.at)) byAt.set(mark.at, mark);
      byFamily.set(family, byAt);
    }
    return byAt;
  };
  return { groups, leadOf: (family, at) => leadOfMark(firstAt(family).get(at), sourceOf) };
}

// 저장 뒤 그 답의 소리 전달(evidence.delivered — 단계 4 계획 §25-3 불변식 나). 기록부에 든 사건으로 그 제시의 묶음을 짓고, 접기와 같은
// 함수(audiosBefore)로 그 답 앞의 마지막 전달을 본다. 저장이 실패한 쓰기는 기록부에 없고, 제외된 전달 뒤의 소리는 「아직」이다. 소리가
// 들지 않는 문항은 늘 전달된 것이다. 그 답이 기록부에 없으면 거짓이다.
export function deliveredAt(record, presentationId, answerId) {
  const group = record.group(presentationId);
  if (!group?.children.some(entry => entry.key === answerId)) return false;
  if (group.source.event.audioRequired !== true) return true;
  return audiosBefore(group).get(answerId) === 'completed';
}

// exclusive: 호스트의 차례(turn) — 기록부가 차례 밖에서 시작된 손님 요약 저장에만 청한다(§18-5-1 R1).
// onLocalSaved: 손님 요약 저장 묶음이 끝났을 때 — 호스트가 다른 탭에 알린다(받기 알림 설계 검토 D2).
// onCleared: 다른 탭이 이 저장소를 비웠을 때(세대마다 한 번 — 단계 4 계획 §22-4 다른 탭의 은퇴 알림) — 호스트가 셸에 알린다.
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
  onLocalSaved,
  onCleared,
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
    ...(onLocalSaved ? { onLocalSaved } : {}),
    ...(onCleared ? { onCleared } : {}),
  });
  const clockNow = now ?? (() => Date.now());
  const nowMs = () => Math.round(clockNow() + record.clock.offsetMs);
  return {
    record,
    add: (type, fields, options) => record.add(type, fields, options),
    view: () => record.view(),
    // 「낸 것」 — 줄마다 사건 번호(id)가 실린다(단계 3 49935bb51, 계획 §16 ①). 번호 없는 서버 요약 줄은 id 칸 없이 그대로 온다.
    issued: () => record.issued(),
    leadAt: (family, at) => leadAt(record, family, at, index),
    meets: () => meetsOf(record, index),
    deliveredAt: (presentationId, answerId) => deliveredAt(record, presentationId, answerId),
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
    // 받은 표지 — 서버가 받은 사건의 서버 순번(아직 받지 않았으면 undefined). 판 응답 목록이 상한에서 멈춘 읽기가 닿지 못한 내 응답을 가른다(§22-5).
    acked: id => record.acked(id),
    // 단위마다의 근거 줄 전부 — 30일째 문장(coach.lookback, 단계 4 계획 §21-7). 사건을 치우지 않는 기록부만 처음부터 다 든다.
    unitRows: () => record.unitRows(),
    // 계열마다의 만남 줄과 그 판 번호 — 예상 급수의 근거(coach.firstAnswers, 단계 4 계획 §21-23의 2). 사건을 치우지 않는 기록부만.
    meetRows: () => record.meetRows(),
    // 받은 요약의 자리 { edition, gen, foldedUntil }와 그 요약의 처음 장부 칸(단계 4 계획 §21-22) — 손님 기록부 · 받은 요약이 없으면 null.
    received: () => record.received(),
    receivedCarried: () => record.receivedCarried(),
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
