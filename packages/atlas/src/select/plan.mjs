// 활동 고르기 — 홈의 「오늘 할 것」(설계 §3-6). 활동(레슨 · 복습 · 게임 · 연습)은 자기 문항 후보를 넘기고, 엔진은 활동마다
// 고르기(choose)의 맨 앞 층과 할 것의 수를 보고 순위를 낸다. 제품은 사실만 넘긴다 — 하던 것이 있다(resume) · 먼저 할 것이 있다
// (prerequisite — 한글을 아직 못 읽는다) · 제품이 차례를 정하는 생활 복습이다(review — 놓친 것 · 다리, 설계 §3-5) · 지금 열 수 없다(locked) ·
// 엔진이 말할 것이 없을 때의 설명(describe) · 이 활동이 맞춘 목표들(goals — 이번 주 숙제 · 「더 배우고 싶어요」 등).
// 순위를 앞지르는 사실은 하던 것 · 한글 · 생활 복습 셋이다(아래 표 한 곳 — 단계 4 §20-6, 설계 주인 11-15). 사실은 낼 것이 있는 활동만
// 앞세운다 — 후보를 넘겼는데 모두 낼 수 없으면 사실이 없는 것처럼 선다(아르곤 A7 ②). 목표는 앞지르지 않는다 — 같은 층 안에서 맞춘
// 목표가 많은 활동이 앞이다(지금 Core 순위 「층 → 맞춘 목표 수」와 같다, 단계 4 Fable 설계 P2-4 · 조율 11-11). 무엇이 목표에 맞는지는
// 제품이 정하고 두뇌는 수만 센다(두뇌는 주제를 모른다).
// 학습자 상태를 바꾸지 않는다 — 판이 열려 있지 않으면 사본에 판을 열어 본다.
import { unitsOf } from '../fold/units.mjs';
import { PARAMS } from '../params.mjs';
import { REASON_CODES } from '../reason/index.mjs';
import { choose, dayCapped } from './choose.mjs';
import { startSession } from './session.mjs';

const REVIEW_CODES = Object.freeze({ missed: REASON_CODES.missed, bridge: REASON_CODES.bridge });
const DESCRIBE_CODES = Object.freeze({
  form: REASON_CODES.form,
  recheck: REASON_CODES.recheck,
  start: REASON_CODES.start,
  next: REASON_CODES.next,
});

// 사실의 표(앞이 먼저). 순위를 앞지르는 줄이 앞에 오고, ranks: false인 줄(describe)은 순위에 쓰지 않고 이유만 단다.
//   review   { kind: missed(놓친 것 — 혼자 맞힐 때까지) | bridge(처음 만나는 장면의 다리), unit } — 후보가 있을 때만 서고, unit은 그 활동
//            후보의 단위여야 한다(다른 활동이 이 사실로 앞지르지 않게 · 문장의 이름은 근거의 단위에서만 — 설계 주인 11-15 조건).
//   describe form · recheck · start · next — 맨 앞 줄이 없거나 할 것 없음 · 낼 것 없음일 때만 이유가 된다(목표 문장이 먼저).
export const PLAN_FACTS = Object.freeze([
  Object.freeze({ fact: 'resume', code: REASON_CODES.resume }), // 하던 학습의 같은 자리
  Object.freeze({ fact: 'prerequisite', code: REASON_CODES.prerequisite }), // 먼저 할 것(한글 먼저)
  Object.freeze({ fact: 'review', codes: REVIEW_CODES }), // 제품이 차례를 정하는 생활 복습
  Object.freeze({ fact: 'describe', ranks: false, codes: DESCRIBE_CODES }), // 엔진이 말할 것이 없을 때의 설명
]);
const RANKED = PLAN_FACTS.findIndex(row => row.ranks === false);
const own = (table, key) =>
  typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : undefined;

function reviewWhy(value, candidates) {
  const code = own(REVIEW_CODES, value?.kind);
  if (!code || !candidates.length) return null;
  const unit = value.unit ?? null;
  if (
    unit !== null &&
    (typeof unit !== 'string' || !candidates.some(item => unitsOf(item).includes(unit)))
  )
    return null;
  return {
    code,
    slots: unit === null ? {} : { unit },
    evidence: { fact: 'review', review: value.kind, ...(unit === null ? {} : { unit }) },
  };
}

// 순위를 앞지르는 사실 — 표 차례에서 처음 맞는 것. 값이 꼴에 맞지 않으면 없는 것이다.
function leadOf(facts, candidates) {
  for (let index = 0; index < RANKED; index += 1) {
    const row = PLAN_FACTS[index];
    const value = facts?.[row.fact];
    if (!value) continue;
    const why =
      row.fact === 'review'
        ? reviewWhy(value, candidates)
        : { code: row.code, slots: {}, evidence: { fact: row.fact } };
    if (why) return { index, why };
  }
  return null;
}

const describeWhy = value => {
  const code = own(DESCRIBE_CODES, value);
  return code ? { code, slots: {}, evidence: { fact: 'describe', describe: value } } : null;
};

// 목표 — 제품이 넘긴 { kind, … }들. kind: homework(이번 주 숙제 — skill · status) · interest(「더 배우고 싶어요」 — topic) ·
// 그 밖의 이름(배우는 이유의 넓은 목표 등 — 문장 없이 수에만). 같은 목표를 두 번 세지 않는다 — 겹치면 숙제 상태(review · missed)가
// 있는 쪽을 남기고, 둘 다 있거나 둘 다 없으면 앞의 것이다. 글자 칸(kind · topic · skill) 가운데 어느 하나라도 있는데 글자가 아니면 그
// 목표는 받지 않는다 — 글자로 바꿔 검사하지 않는다. 배열이 근거와 문장 칸(slots)에 들어가 화면 글과 기록이 함께 틀어지지 않게 한 검사로
// 묶는다(카본 C3 · 설계 주인 11-15).
const GOAL_KEY = /^[a-z][a-zA-Z0-9_.:-]{0,79}$/;
const HOMEWORK_STATUS = ['review', 'missed'];
const TEXT_SLOTS = ['kind', 'topic', 'skill'];
const goalOk = goal =>
  TEXT_SLOTS.every(slot => goal?.[slot] == null || typeof goal[slot] === 'string') &&
  GOAL_KEY.test(goal?.kind ?? '');
const stated = goal => HOMEWORK_STATUS.includes(goal.status);
function goalsOf(facts) {
  const seen = new Map();
  for (const goal of Array.isArray(facts?.goals) ? facts.goals : []) {
    if (!goalOk(goal)) continue;
    const key = [goal.kind, goal.skill ?? '', goal.topic ?? '', goal.id ?? ''].join('|');
    const kept = seen.get(key);
    if (!kept || (!stated(kept) && stated(goal))) seen.set(key, goal);
  }
  return [...seen.values()];
}

// 목표가 문장이 되는 때 — 엔진에게 더 구체적인 말(다시 · 흔들림 · 돌아옴 · 수준 · 숨 고르기)이 없을 때만: 맨 앞 줄이 새것이거나
// 할 것이 없거나(idle · none) 후보가 없다. 숙제가 먼저 말하고, 그다음 관심이다. 근거 칸은 사실 값의 정해진 열쇠만.
const SPEAKS = new Set([REASON_CODES.fresh, REASON_CODES.idle]);
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

// 이유 — 앞지른 사실 → 목표 문장 → (엔진이 말할 것이 없을 때) 설명 → 맨 앞 줄의 이유.
function whyOf(ruled, goals, top, none, facts) {
  if (ruled) return ruled.why;
  const quiet = !top || Boolean(top.idle) || none;
  return goalReason(goals, top) ?? (quiet ? describeWhy(facts.describe) : null) ?? top?.why ?? null;
}

// 항목: { id, locked, fact(앞지른 사실의 표 자리 · 없으면 -1), goals, tier, todo, offered(넘긴 후보 수 — 코치는 지도에 맞춘 뒤의 수),
//        idle, none, capped(하루 복습 상한에 걸려 미룬 것이 있다 — 사실 문장이 이유를 덮어도 읽게, §20-3), why }
// 결과: 항목의 배열(순위 차례)에 capped 칸 하나를 싣는다 — 하루 상한은 plan 머리에서 한 번 센 값이고, 항목의 capped도 모두 그 값이다
// (항목의 칸은 옛 호출을 위해 남긴다 · 설계 주인 11-15, 단계4 §20-14).
function entryOf(activity, view, memory, now, params, seed, capped) {
  const facts = activity.facts ?? {};
  const candidates = activity.candidates ?? [];
  const offered = candidates.length;
  if (facts.locked)
    return { id: activity.id, locked: true, fact: -1, tier: 9, todo: 0, offered, capped };
  const rows = offered ? choose(candidates, view, memory, now, { params, seed }) : [];
  const top = rows[0];
  // 숨 고르기는 판 안의 쉼이라 순위는 그 뒤 줄(숨 고르기 앞의 맨 앞)의 층으로 매긴다 — 할 것이 있는 활동이 채우기 활동 뒤로
  // 밀리지 않게(설계 §3-6 「위 층의 가장 높은 것」, GPT 끝 판 GB2). 뒤 줄이 없으면 맨 앞 줄의 층이다(카본 C5 · 설계 주인 11-15 — 지금
  // 고르기는 숨 고르기 뒤에 늘 옛 맨 앞 줄을 두어 이 갈래에 닿지 않는다. 고르기가 바뀌어도 할 것이 있는 활동이 층 9로 떨어지지 않게 지킨다).
  const lead = top?.breather ? (rows[1] ?? top) : top;
  const none = !top || Boolean(top.none);
  // 사실은 낼 것이 있는 활동만 앞세운다 — 후보를 넘겼는데 모두 낼 수 없으면(none) 사실이 없는 것처럼 선다. 후보 없이 여는 활동
  // (하던 레슨 · 진단 · 시험 형식)은 사실이 그대로 앞세운다(진도와 화면은 제품의 것이다, 아르곤 A7 ②).
  const ruled = offered && none ? null : leadOf(facts, candidates);
  const goals = goalsOf(facts);
  return {
    id: activity.id,
    locked: false,
    fact: ruled ? ruled.index : -1,
    goals: goals.length,
    tier: lead ? lead.tier : 9,
    todo: rows.filter(row => row.tier <= 2).length,
    offered,
    idle: Boolean(top?.idle),
    none,
    capped,
    why: whyOf(ruled, goals, top, none, facts),
  };
}

// 순위: 열 수 있는 것 → 앞지르는 사실(표 차례) → 맨 앞 층(할 것이 채우기보다 앞) → 맞춘 목표 수 → 할 것의 수 → 활동 id(사전 순,
// 같은 입력이면 같은 순위). 목표는 층을 앞지르지 않는다 — 숙제여도 돌아온 복습 · 방금 놓친 것이 앞이다(설계 §1 표 1행).
const rank = (a, b) =>
  Number(a.locked) - Number(b.locked) ||
  (a.fact < 0 ? RANKED : a.fact) - (b.fact < 0 ? RANKED : b.fact) ||
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
  // 하루 복습 상한은 plan 머리에서 한 번만 센다 — 값이 나오는 곳이 하나라 항목끼리 어긋나지 않고, 후보를 넘긴 열린 활동이 없는 날에도
  // 상한을 읽는다(레슨을 다 마친 상한 날에 잠긴 듣기 짧은 연습만 남은 때 — 설계 주인 11-15, 단계4 §20-14).
  const capped = dayCapped(view, memory, now, params);
  const entries = activities
    .map(activity => entryOf(activity, view, memory, now, params, seed, capped))
    .sort(rank);
  entries.capped = capped;
  return entries;
}
