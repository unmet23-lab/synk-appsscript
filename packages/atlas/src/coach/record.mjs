// 코치가 기록(단계 3 src/record)을 부르는 한 자리(단계 4 계획 §3-2 「기록에 기대는 얇은 겹」). 단계 3 끝 판 검수로 기록 API가
// 바뀌면 이 파일만 고친다. 기록부는 저장이 끝난 사건만 근거로 보이고(add의 stored), 서버의 답을 받고(receive), 꼬리를 읽는다(refresh).
// 서버의 답 꼴(learning?view=trail POST)은 단계 3 서버 반영 뒤 굳힌다 — 지금은 { accepted, clamped, rejected, summary, serverTime }.
import { openRecord } from '../record/log.mjs';

export async function openTrail({ port, revision, guest, memory, params, index, health, now }) {
  const record = await openRecord({
    port,
    revision,
    guest,
    memory,
    params,
    index,
    health,
    ...(now ? { now } : {}),
  });
  const clockNow = now ?? (() => Date.now());
  return {
    record,
    add: (type, fields) => record.add(type, fields),
    view: () => record.view(),
    issued: () => record.issued(),
    refresh: () => record.refresh(),
    // 손님: 지금 든 사건까지 요약을 바로 접는다(판 끝 — 칸에 방금 푼 답이 들게). 계정은 서버가 접으므로 아무것도 안 한다.
    refold: () => record.refold?.() ?? Promise.resolve(),
    unsent: limit => record.unsent(limit),
    receive: answer =>
      record.receive({
        accepted: answer?.accepted ?? [],
        clamped: answer?.clamped ?? [],
        rejected: answer?.rejected ?? [],
        summary: answer?.summary ?? null,
        serverTime: answer?.serverTime ?? null,
      }),
    heldEvent: id => record.heldEvent(id),
    heldEvents: () => record.heldEvents(),
    summary: () => record.summary,
    pending: () => record.pending(),
    // 고르기의 지금 시각 — 서버 시각과의 차이를 고친 기기 시각(사건 시각과 같은 시계).
    now: () => Math.round(clockNow() + record.clock.offsetMs),
  };
}
