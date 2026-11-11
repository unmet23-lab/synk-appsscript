// 활동 고르기 — 홈의 「오늘 할 것」(설계 §3-6). 활동(레슨 · 복습 · 게임 · 연습)은 자기 문항 후보를 넘기고, 엔진은 활동마다
// 고르기(choose)의 맨 앞 층과 할 것의 수를 보고 순위를 낸다. 제품은 사실만 넘긴다 — 하던 것이 있다(resume) · 먼저 할 것이 있다
// (prerequisite — 한글을 아직 못 읽는다) · 지금 열 수 없다(locked) · 이 활동이 맞춘 목표들(goals — 이번 주 숙제 · 「더 배우고 싶어요」 등).
// 순위를 앞지르는 사실은 하던 것 · 한글 둘뿐이고(아래 표 한 곳), 목표는 앞지르지 않는다 — 같은 층 안에서 맞춘 목표가 많은 활동이
// 앞이다(지금 Core 순위 「층 → 맞춘 목표 수」와 같다, 단계 4 Fable 설계 P2-4 · 조율 11-11). 무엇이 목표에 맞는지는 제품이 정하고
// 두뇌는 수만 센다(두뇌는 주제를 모른다).
// 학습자 상태를 바꾸지 않는다 — 판이 열려 있지 않으면 사본에 판을 열어 본다.
import { PARAMS } from '../params.mjs';
import { REASON_CODES } from '../reason/index.mjs';
import { choose } from './choose.mjs';
import { startSession } from './session.mjs';

// 앞지르는 사실의 차례(앞이 먼저). 사실이 없는 활동은 그 뒤에 고르기 결과로 선다.
export const PLAN_FACTS = Object.freeze([
  Object.freeze({ fact: 'resume', code: REASON_CODES.resume }), // 하던 학습의 같은 자리
  Object.freeze({ fact: 'prerequisite', code: REASON_CODES.prerequisite }), // 먼저 할 것(한글 먼저)
]);

const factOf = facts => PLAN_FACTS.findIndex(row => facts?.[row.fact]);

// 목표 — 제품이 넘긴 { kind, … }들. kind: homework(이번 주 숙제 — skill · status) · interest(「더 배우고 싶어요」 — topic) ·
// 그 밖의 이름(배우는 이유의 넓은 목표 등 — 문장 없이 수에만). 같은 목표를 두 번 세지 않는다.
const GOAL_KEY = /^[a-z][a-zA-Z0-9_.:-]{0,79}$/;
function goalsOf(facts) {
  const seen = new Map();
  for (const goal of Array.isArray(facts?.goals) ? facts.goals : []) {
    if (!GOAL_KEY.test(goal?.kind ?? '')) continue;
    const key = [goal.kind, goal.skill ?? '', goal.topic ?? '', goal.id ?? ''].join('|');
    if (!seen.has(key)) seen.set(key, goal);
  }
  return [...seen.values()];
}

// 목표가 문장이 되는 때 — 엔진에게 더 구체적인 말(다시 · 흔들림 · 돌아옴 · 수준 · 숨 고르기)이 없을 때만: 맨 앞 줄이 새것이거나
// 할 것이 없거나(idle · none) 후보가 없다. 숙제가 먼저 말하고, 그다음 관심이다. 근거 칸은 사실 값의 정해진 열쇠만.
const SPEAKS = new Set([REASON_CODES.fresh, REASON_CODES.idle]);
const HOMEWORK_STATUS = ['review', 'missed'];
function goalReason(goals, top) {
  if (top && !top.idle && !top.none && !SPEAKS.has(top.why?.code)) return null;
  // 숙제 문장은 제품이 숙제의 상태(review · missed)를 넘겼을 때만 — 모르면 「놓친 답이 있어…」처럼 사실 아닌 말을 짓지 않고
  // 관심 · 엔진의 이유로 넘긴다(목표 수에는 그대로 센다, 조율 11-11 P3).
  const homework = goals.find(
    goal =>
      goal.kind === 'homework' &&
      GOAL_KEY.test(goal.skill ?? '') &&
      HOMEWORK_STATUS.includes(goal.status),
  );
  if (homework)
    return {
      code: REASON_CODES.homework,
      slots: { skill: homework.skill, status: homework.status },
      evidence: { fact: 'homework', skill: homework.skill, status: homework.status },
    };
  const interest = goals.find(goal => goal.kind === 'interest' && GOAL_KEY.test(goal.topic ?? ''));
  if (interest)
    return {
      code: REASON_CODES.goal,
      slots: { topic: interest.topic },
      evidence: { goal: 'interest', topic: interest.topic },
    };
  return null;
}

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
  // 숨 고르기는 판 안의 쉼이라 순위는 그 뒤 줄(숨 고르기 앞의 맨 앞)의 층으로 매긴다 — 할 것이 있는 활동이 채우기 활동 뒤로
  // 밀리지 않게(설계 §3-6 「위 층의 가장 높은 것」, GPT 끝 판 GB2).
  const lead = top?.breather ? rows[1] : top;
  const fact = factOf(facts);
  const goals = goalsOf(facts);
  const why =
    fact >= 0
      ? { code: PLAN_FACTS[fact].code, slots: {}, evidence: { fact: PLAN_FACTS[fact].fact } }
      : (goalReason(goals, top) ?? top?.why);
  return {
    id: activity.id,
    locked: false,
    fact,
    goals: goals.length,
    tier: lead ? lead.tier : 9,
    todo: rows.filter(row => row.tier <= 2).length,
    idle: Boolean(top?.idle),
    none: !top || Boolean(top.none),
    why: why ?? null,
  };
}

// 순위: 열 수 있는 것 → 사실(표 차례) → 맨 앞 층(할 것이 채우기보다 앞) → 맞춘 목표 수 → 할 것의 수 → 활동 id(사전 순, 같은
// 입력이면 같은 순위). 목표는 층을 앞지르지 않는다 — 숙제여도 돌아온 복습 · 방금 놓친 것이 앞이다(설계 §1 표 1행).
const rank = (a, b) =>
  Number(a.locked) - Number(b.locked) ||
  (a.fact < 0 ? PLAN_FACTS.length : a.fact) - (b.fact < 0 ? PLAN_FACTS.length : b.fact) ||
  a.tier - b.tier ||
  (b.goals ?? 0) - (a.goals ?? 0) ||
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
