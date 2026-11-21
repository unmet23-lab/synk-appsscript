// 놓침 기록(coach.answerLog — 단계 4 계획 §25-5, 놓친 곳 카드의 재료). 이 기기 기록부에 든 2판 제시와 제시마다 첫 판정 답을 줄로 낸다.
//   줄 { eventId(답), presentationId, game(경험 이름 — 판 번호의 게임 이름), itemKey, setId, at(답 시각 ms), verdict, correct, independent, choice }
//   independent(혼자 낸 첫 답)는 접기가 고른 그 계열의 첫 만남으로 정한다 — 코치의 답 측정(measured)과 같은 길이다. 만난 표의 그 계열 시각에
//   선 만남 가운데 접기 차례 맨 앞 하나가 이 답이고 혼자 낸 판정 답일 때만 참이다. 그래서 두 탭이 같은 새 계열을 띄워 두 제시가 모두
//   firstExposure: true여도 혼자 낸 첫 답은 하나다. 접기는 부를 때마다 한 번 하고 줄마다 그 표를 읽는다(trail.meets).
//   뺀 답(그 답이나 그 제시를 겨눈 record.excluded)과 판 번호가 없는 옛 꼴 제시는 싣지 않는다.
// 창: floor는 기록부의 마지막 치우기 시각에서 KEEP_MS를 뺀 때다(치운 적이 없으면 null — 손님과 동의를 끈 계정은 사건을 치우지 않는다). 남은
// 가장 이른 사건이 아니다 — 치우기는 답이 없는 제시의 묶음과 아직 접히지 않은 사건이 든 묶음을 남긴다. 창의 시작(since)은 floor와 코치 시계 −
// days 가운데 늦은 때이고, 판을 연 시각(판 번호에 든 값)이 창의 시작 뒤인 판만 낸다(경계와 같은 때에 연 판은 창 밖이다). 치우기는 판째가
// 아니라 제시 묶음마다 하므로 남은 첫 제시로 판의 시작을 정하면 앞이 잘린 판을 온전한 판으로 읽는다.
import { itemOf } from '../record/adapt.mjs';
import { EVENT_TYPES, JUDGED } from '../record/events.mjs';
import { KEEP_MS } from '../record/log.mjs';
import { gameOfSet, openedAtOfSet } from './set-id.mjs';

const DAY_MS = 86_400_000;

// 제시의 첫 판정 답 — 묶음의 자식은 기록부에 든 차례(같은 제시의 답은 답 차례)다. 판정 못 한 답은 건너뛴다. 없으면 null.
const firstJudged = group =>
  group.children.find(
    ({ event }) => event.type === EVENT_TYPES.attempted && JUDGED.includes(event.verdict),
  )?.event ?? null;

// 혼자 낸 첫 답인가 — 접기의 그 계열 첫 만남(lead)이 이 제시의 이 답이고 혼자 낸 판정 답이다(measured와 같은 규칙).
function independentOf(presented, answer, ask) {
  const family = itemOf(presented, ask.index)?.familyKey;
  const { view } = ask;
  if (view.waitAll === true || !view.met.has(family)) return false;
  const lead = ask.leadOf(family, view.met.get(family));
  return Boolean(
    lead && !lead.carried && lead.source === presented.id && lead.id === answer.id && lead.solo,
  );
}

// 창 안의 판에 든 제시면 그 경험 이름, 아니면 null — 판 번호의 꼴 · 물은 경험 · 판을 연 시각. 묶음의 머리 가운데 판 번호를 싣는 것은 2판
// 제시뿐이다(옛 꼴 제시 · 본인 말 · 장부에는 판 번호가 없어 gameOfSet이 null이다).
function gameIn(presented, ask) {
  const game = gameOfSet(presented.setId);
  if (game == null || (ask.games && !ask.games.has(game))) return null;
  return openedAtOfSet(presented.setId) > ask.since ? game : null;
}

function rowOf(group, ask) {
  const presented = group.source.event;
  const game = gameIn(presented, ask);
  if (game == null) return null;
  const answer = firstJudged(group);
  if (!answer) return null;
  const gone = new Set([presented.id, answer.id]);
  if (group.exclusions.some(({ event }) => gone.has(event.targetId))) return null;
  return Object.freeze({
    eventId: answer.id,
    presentationId: presented.id,
    game,
    itemKey: presented.itemKey,
    setId: presented.setId,
    at: Date.parse(answer.at),
    verdict: answer.verdict,
    correct: answer.verdict === 'correct',
    independent: independentOf(presented, answer, ask),
    choice: answer.choice ? Object.freeze({ ...answer.choice }) : null,
  });
}

// host — 코치의 호스트(trail · view · now · index). days는 1 ~ 365의 정수, games는 경험 이름 배열이나 null(모든 경험) — 코치 겉이 검사한다.
export function answerLogOf(host, { days, games = null }) {
  const swept = host.trail.record.sweptAt();
  const floor = swept > 0 ? swept - KEEP_MS : null;
  const since = Math.max(floor ?? Number.NEGATIVE_INFINITY, host.now() - days * DAY_MS);
  const { groups, leadOf } = host.trail.meets();
  const ask = {
    since,
    games: games ? new Set(games) : null,
    view: host.view(),
    index: host.index,
    leadOf,
  };
  const rows = [];
  for (const group of groups.values()) {
    const row = rowOf(group, ask);
    if (row) rows.push(row);
  }
  rows.sort((a, b) => a.at - b.at || (a.eventId < b.eventId ? -1 : 1));
  return Object.freeze({ days, since, floor, rows: Object.freeze(rows) });
}
