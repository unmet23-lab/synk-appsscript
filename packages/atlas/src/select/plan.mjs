// 활동 고르기 — 홈의 「오늘 할 것」(설계 §3-6). 활동(레슨 · 복습 · 게임 · 연습)은 자기 문항 후보를 넘기고, 엔진은 활동마다
// 고르기(choose)의 맨 앞 층과 할 것의 수를 보고 순위를 낸다. 제품은 사실만 넘긴다 — 하던 것이 있다(resume) · 먼저 할 것이 있다
// (prerequisite — 한글을 아직 못 읽는다) · 이번 주 숙제다(homework) · 지금 열 수 없다(locked). 사실이 순위를 앞지르는 규칙은
// 아래 표 한 곳에 둔다. 지금 제품(world-learning-plan.mjs)의 사실을 이 표로 옮기는 것은 단계 4다.
// 학습자 상태를 바꾸지 않는다 — 판이 열려 있지 않으면 사본에 판을 열어 본다.
import { PARAMS } from '../params.mjs';
import { REASON_CODES } from '../reason/index.mjs';
import { choose } from './choose.mjs';
import { startSession } from './session.mjs';

// 앞지르는 사실의 차례(앞이 먼저). 사실이 없는 활동은 그 뒤에 고르기 결과로 선다.
export const PLAN_FACTS = Object.freeze([
  Object.freeze({ fact: 'resume', code: REASON_CODES.resume }), // 하던 학습의 같은 자리
  Object.freeze({ fact: 'prerequisite', code: REASON_CODES.prerequisite }), // 먼저 할 것(한글 먼저)
  Object.freeze({ fact: 'homework', code: REASON_CODES.homework }), // 이번 주 숙제
]);

const factOf = facts => PLAN_FACTS.findIndex(row => facts?.[row.fact]);

function viewOf(learner, now, params) {
  if (learner.session) return learner;
  const copy = { ...learner, day: null, session: null };
  startSession(copy, now, params);
  return copy;
}

function entryOf(activity, view, memory, now, params, seed) {
  const facts = activity.facts ?? {};
  if (facts.locked) return { id: activity.id, locked: true, fact: -1, tier: 9, todo: 0 };
  const rows = activity.candidates?.length
    ? choose(activity.candidates, view, memory, now, { params, seed })
    : [];
  const top = rows[0];
  const fact = factOf(facts);
  const why =
    fact >= 0
      ? { code: PLAN_FACTS[fact].code, slots: {}, evidence: { fact: PLAN_FACTS[fact].fact } }
      : top?.why;
  return {
    id: activity.id,
    locked: false,
    fact,
    tier: top ? top.tier : 9,
    todo: rows.filter(row => row.tier <= 2).length,
    idle: Boolean(top?.idle),
    none: !top || Boolean(top.none),
    why: why ?? null,
  };
}

// 순위: 열 수 있는 것 → 사실(표 차례) → 맨 앞 층(할 것이 채우기보다 앞) → 할 것의 수 → 활동 id(사전 순, 같은 입력이면 같은 순위).
const rank = (a, b) =>
  Number(a.locked) - Number(b.locked) ||
  (a.fact < 0 ? PLAN_FACTS.length : a.fact) - (b.fact < 0 ? PLAN_FACTS.length : b.fact) ||
  a.tier - b.tier ||
  b.todo - a.todo ||
  (a.id < b.id ? -1 : Number(a.id > b.id));

export function planActivities(
  activities,
  learner,
  memory,
  now,
  { params = PARAMS, seed = 'plan' } = {},
) {
  const view = viewOf(learner, now, params);
  return activities.map(activity => entryOf(activity, view, memory, now, params, seed)).sort(rank);
}
