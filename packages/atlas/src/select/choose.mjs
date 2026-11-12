// 고르기 — 「고르기 1판」(설계 §3-5). 후보마다 층을 매기고 층 안에서 줄을 세운다. 맨 앞이 고른 것이다.
//   할 것: 0 다시(이 판에서 놓친 것, 다른 문항 둘 뒤, 단위당 두 번까지) · 1 돌아옴 · 2 새것(진도 순, 한 판 · 하루 한도 안).
//   채우기: 3 따뜻하게(아는 것 가운데 흐려지기 시작한 것) · 4 가볍게(나머지 아는 것) · 5 다시 낼 차례를 기다리는 것(차례를 당겨 낸다).
//   내지 않음(9): 이 판의 「다시」를 다 쓴 단위 · 한도를 넘는 새 단위가 든 문항 · 복습 상한에 걸려 미룬 돌아온 단위(하루 상한,
//   끈질긴 단위의 판 몫) · 이 판에서 판정하지 못한 문항. 이것뿐이면 none이다.
// idle = 할 것이 없다(위 셋이 비었고 기다리는 「다시」도 없다). none = 낼 문항이 하나도 없다 — 제품이 판을 끝낸다.
// 지킬 것: 설계 §3-5의 불변식 일곱과 차례의 속성 여섯(test/properties/session.property.test.mjs). 동점은 씨앗으로 가른다.
import { PRODUCED } from '../memory/grade.mjs';
import { unitsOf } from '../fold/units.mjs';
import { PARAMS } from '../params.mjs';
import {
  breatherReason,
  cappedReason,
  dueReason,
  freshReason,
  idleReason,
  retryReason,
  stubbornReason,
} from '../reason/index.mjs';
import { predictParts } from './predict.mjs';
import { dayOf, startSession } from './session.mjs';

// 동점을 가르는 씨앗 해시(FNV-1a). 문항 id 가나다순이나 기기 언어를 타지 않는다.
const hash = text => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
};

// 한 번 고를 때 모든 후보가 함께 보는 것.
function contextOf(learner, memory, now, params) {
  const session = learner.session;
  const from = Math.max(session.start, learner.shown.length - params.avoidRecent);
  // 「방금 본 것」은 이 판 안에서만 센다(며칠 전에 본 것은 방금이 아니다).
  const recent = new Set(learner.shown.slice(from).map(row => row.family));
  const lastShown = new Map(learner.shown.map((row, index) => [row.family, index]));
  // 이 판에서 이미 만난 단위는 돌아옴 층에 다시 들지 않는다.
  const dueNow = unit => !session.met.has(unit) && memory.isDue(learner.memory.get(unit), now);
  let backlog = 0;
  for (const unit of learner.memory.keys()) if (dueNow(unit)) backlog += 1;
  const rescue = backlog > params.backlog;
  // 지금의 하루 — 판이 열린 채 새벽 4시를 넘었으면 새 하루의 한도로 센다.
  const day = dayOf(learner, now, params);
  const capped = day.reviews >= params.reviewsPerDay;
  return {
    learner,
    memory,
    now,
    params,
    session,
    day,
    recent,
    lastShown,
    dueNow,
    backlog,
    rescue,
    capped,
  };
}

// 문항이 묻는 단위들의 지금 상태 — 기억이 없거나 비운 단위는 null.
function unitFacts(item, ctx) {
  const { learner, memory, session, now, rescue, day } = ctx;
  const units = unitsOf(item);
  const states = units.map(unit => {
    const state = learner.memory.get(unit);
    return memory.has(state) ? state : null;
  });
  const unseen = units.filter((_, i) => !states[i]);
  // 한도에 셀 새 단위: 하루 한도에는 오늘 아직 낸 적 없는 단위(brandNew), 한 판 한도에는 이 판에서 아직 낸 적 없는 기억 없는 단위(firstHere).
  const brandNew = unseen.filter(unit => !day.introduced.has(unit));
  const firstHere = unseen.filter(unit => !session.introduced.has(unit));
  // 돌아온 단위: 밀린 것이 많으면 살릴 수 있는 것부터(떠올릴 확률 높은 순), 아니면 급한 것부터(낮은 순).
  const due = units
    .map((unit, i) => [unit, states[i]])
    .filter(([unit, state]) => state && ctx.dueNow(unit))
    .map(([unit, state]) => [unit, state, memory.retrievability(state, now)])
    .sort((a, b) => (rescue ? b[2] - a[2] : a[2] - b[2]));
  return { units, states, unseen, brandNew, firstHere, due };
}

// 복습 상한에 걸려 미룬 돌아온 단위: 하루 상한(day)이거나, 이 판에서 끈질긴 단위를 겨눠 돌아온 것으로 낸 수가 몫에 닿았는데
// 문항이 돌아온 끈질긴 단위를 묻는다(stubborn — §3-5 「끈질기게 틀리는 단위」). 다시(0 · 5층)는 몫에 세지도 막지도 않는다.
function holdOf(facts, ctx) {
  if (!facts.due.length) return null;
  if (ctx.capped) return 'day';
  const { session } = ctx;
  const full = session.stubbornServed >= session.stubbornCap;
  return full && facts.due.some(([, state]) => state.stubborn) ? 'stubborn' : null;
}

// ① 내지 않을 까닭 — 넷뿐이다. 문항 안의 어느 단위든 걸리면 그 문항은 이 판에서 어느 층으로도 내지 않는다.
function blockedOf(item, facts, held, ctx) {
  const { session, day, params } = ctx;
  const spent = facts.units.some(unit => {
    const retry = session.retries.get(unit);
    return retry && !retry.pending && retry.tries >= params.retryMax;
  });
  // 한도는 새로 셀 단위가 있는 문항만 막는다 — 「더 배우기」 판으로 하루 새 단위가 한도를 넘은 날에도 새 단위가 없는 문항(다시 ·
  // 돌아온 것 · 채우기)은 그대로 낸다(설계 §3-5 「그 밖의 까닭으로 막지 않는다」, 11-12 4-1 화면 Fable 5.2 최종 P1 · 설계 주인 승인).
  const overSession =
    facts.firstHere.length > 0 &&
    session.introduced.size + facts.firstHere.length > session.newLimit;
  const overDay =
    facts.brandNew.length > 0 && day.introduced.size + facts.brandNew.length > params.newPerDay;
  const over = !session.more && (overSession || overDay);
  const blank = session.blank.has(item.itemKey);
  return spent || over || held != null || blank;
}

// ② 겨눌 단위 — 층은 겨눈 단위가 정한다. 차례: 다시 낼 차례를 기다리는 단위(5층) → 다시 낼 단위(0층, 문항 둘이 지난 뒤)
//    → 돌아온 단위(1층) → 처음 만나는 단위(2층). 없으면 채우기(3 · 4층)다.
function aimOf(facts, ctx) {
  const { session, learner, params } = ctx;
  const retryOf = unit => session.retries.get(unit);
  const again = facts.units
    .filter(unit => retryOf(unit)?.pending)
    .sort((a, b) => retryOf(a).position - retryOf(b).position); // 놓친 순서
  const gap = unit => learner.shown.length - retryOf(unit).position;
  const waiting = again.find(unit => gap(unit) < params.retryGap);
  if (waiting) return [5, waiting];
  const ready = again.find(unit => gap(unit) >= params.retryGap);
  if (ready) return [0, ready];
  if (facts.due.length) return [1, facts.due[0][0]];
  if (facts.unseen.length) return [2, facts.unseen[0]];
  return null;
}

// 층 안의 순서(need가 클수록 앞)와 이유.
function retryShape(item, target, ctx) {
  const asked = ctx.session.retries.get(target);
  const other = item.familyKey !== asked.family;
  // 같은 것을 다른 문항으로 만날 수 있으면 그쪽 먼저, 그 안에서는 놓친 순서
  const need = 1 + (other ? 0.5 : 0) - asked.position / 1e6;
  return { need, promote: 0, why: retryReason(target, ctx.learner.memory.get(target), other) };
}

function dueShape(item, target, facts, ctx) {
  const [, state, r] = facts.due[0];
  const { params } = ctx;
  const need = ctx.rescue ? r : 1 - r / params.retention; // 급한 정도: 떠올릴 확률이 목표에서 멀수록 먼저
  const promote =
    PRODUCED.includes(item.responseFormat) && state.stability >= params.promoteAtDays ? 1 : 0;
  return { need, promote, why: dueReason(target, state, ctx.now) };
}

function freshShape(item, target, ctx) {
  const ability = ctx.learner.ability.get(item.skillId);
  const previous = ability?.level ?? null; // 마지막 측정 답의 난도(접힌 값 — 다시 켜도 남는다)
  // 새것은 제품이 정한 진도 순(같은 묶음 안에서는 난도 맞음으로 고른다)
  return {
    need: -(item.order ?? 0),
    promote: 0,
    why: freshReason(target, item, previous, ability),
  };
}

// 채우기: 이 판에서 만났거나 아직 같은 자리 안인 단위는 「따뜻하게」에 들지 않는다(그 자리의 답은 이미 적혔다).
function fillShape(facts, ctx) {
  const { session, memory, now } = ctx;
  const faded = facts.units.map((unit, i) =>
    session.met.has(unit) || memory.inSitting(facts.states[i], now)
      ? 0
      : 1 - memory.retrievability(facts.states[i], now),
  );
  const need = Math.max(...faded);
  return { tier: need >= 0.03 ? 3 : 4, need, promote: 0, why: idleReason() };
}

function shapeOf(item, tier, target, facts, ctx) {
  if (tier === 9) return { tier, need: -(item.order ?? 0), promote: 0, why: idleReason() };
  if (tier === 0 || tier === 5) return { tier, ...retryShape(item, target, ctx) };
  if (tier === 1) return { tier, ...dueShape(item, target, facts, ctx) };
  if (tier === 2) return { tier, ...freshShape(item, target, ctx) };
  return fillShape(facts, ctx);
}

// 숨 고르기에 쓸 수 있나: 다 아는 단위이고, 이 자리에서 아직 안 만났고, 떠올릴 확률이 목표 이상이다(기억만 본다).
const restedOf = (blocked, facts, ctx) =>
  !blocked &&
  !facts.unseen.length &&
  facts.units.every(
    (unit, i) =>
      !ctx.session.met.has(unit) &&
      !ctx.memory.inSitting(facts.states[i], ctx.now) &&
      ctx.memory.retrievability(facts.states[i], ctx.now) >= ctx.params.retention,
  );

// 겨눈 단위가 끈질긴 단위인가, 그리고 이 문항이 그 단위를 놓친 적 없는 응답 꼴인가(다른 꼴 먼저 — §3-5).
function stubbornOf(item, target, ctx) {
  const state = target ? ctx.learner.memory.get(target) : null;
  if (!state?.stubborn) return { stubborn: false, alt: 0 };
  return { stubborn: true, alt: state.missed.includes(item.responseFormat) ? 0 : 1 };
}

function rowOf(item, ctx, seed) {
  const { learner, memory, now, params } = ctx;
  const facts = unitFacts(item, ctx);
  const expected = predictParts(item, learner, memory, now, params);
  const held = holdOf(facts, ctx);
  const blocked = blockedOf(item, facts, held, ctx);
  const aim = blocked ? null : aimOf(facts, ctx);
  const target = aim ? aim[1] : null;
  const shape = shapeOf(item, blocked ? 9 : (aim?.[0] ?? 4), target, facts, ctx);
  return {
    item,
    at: now,
    ...shape,
    ...stubbornOf(item, target, ctx),
    held: blocked ? held : null,
    arm: shape.tier === 3 || shape.tier === 4 ? 'filler' : 'adaptive',
    fit: 1 - Math.abs(expected.p - params.targetSuccess),
    p: expected.p,
    expected: { floor: expected.floor, memory: expected.memory, skill: expected.skill },
    target,
    repeat: ctx.recent.has(item.familyKey) ? 1 : 0,
    fresh: facts.brandNew.length,
    brandNew: facts.brandNew,
    firstHere: facts.firstHere,
    rested: restedOf(blocked, facts, ctx),
    last: ctx.lastShown.get(item.familyKey) ?? -1,
    tie: hash(`${seed}|${learner.shown.length}|${item.itemKey}`),
  };
}

// 차례: 할 것(0~2층)이 늘 채우기보다 앞이고, 내지 않는 것은 맨 뒤다. 그 안에서 방금 본 계열을 피하고, 층 → 층 안의 순서.
//   다시 · 돌아온 것: 급한 정도 → 만들어 내는 꼴 먼저(간격이 벌어진 단위) → 끈질긴 단위는 놓친 적 없는 꼴 먼저 → 난도 맞음.
//   새것: 진도 순 → 난도 맞음(예상 성공 0.8 근처).
//   따뜻하게 · 가볍게: 흐려진 정도(0.02 단위) → 가장 오래 안 본 것.
const groupOf = row => {
  if (row.tier <= 2) return 0;
  return row.tier === 9 ? 2 : 1;
};
const bucket = value => Math.round(value * 50);
const within = (a, b) =>
  a.tier === 3 || a.tier === 4
    ? bucket(b.need) - bucket(a.need) || a.last - b.last
    : b.need - a.need || b.promote - a.promote || b.alt - a.alt || b.fit - a.fit;
const byRank = (a, b) =>
  groupOf(a) - groupOf(b) ||
  a.repeat - b.repeat ||
  a.tier - b.tier ||
  within(a, b) ||
  a.tie - b.tie;

// 돌아온 것이 이어지면 셋에 하나는 새것을 끼운다(한도 안에서).
function interleave(rows, ctx) {
  if (!rows.length || rows[0].tier !== 1 || ctx.session.sinceNew < ctx.params.interleave) return;
  const index = rows.findIndex(row => row.tier === 2 && !row.repeat);
  if (index > 0) rows.unshift(...rows.splice(index, 1));
}

// 맨 앞 줄에 판의 소식을 단다. 기다리는 「다시」는 낼 수 있는 문항이 있을 때만 판을 붙잡는다.
function markTop(rows, ctx) {
  if (!rows.length) return;
  const top = rows[0];
  const pending = rows.some(row => row.tier === 5);
  top.idle = top.tier >= 3 && !pending;
  top.none = top.tier === 9;
  top.capped = ctx.capped && ctx.backlog > 0;
  top.backlog = ctx.backlog;
  if (!top.idle) return;
  // 다 만난 것이 아니라 하루 상한에 걸렸거나, 끈질긴 단위의 이 판 몫을 다 쓴 것이다
  if (top.capped) top.why = cappedReason();
  else if (rows.some(row => row.held === 'stubborn')) top.why = stubbornReason();
}

// 숨 고르기: 이어서 놓친 뒤에는 「다시」나 새것보다 잘 떠올릴 수 있는 것 하나를 먼저 낸다. 없으면 그대로 간다.
function breathe(rows, ctx) {
  const { session, params } = ctx;
  if (!rows.length || session.missStreak < params.breatherAfter) return;
  const top = rows[0];
  const hard = top.tier === 1 && top.p < params.breatherSuccess;
  if (!(top.tier === 0 || top.tier === 2 || hard)) return;
  const easy = rows.findIndex(row => row.rested && !row.repeat);
  if (easy <= 0) return;
  const [row] = rows.splice(easy, 1);
  const why = breatherReason(unitsOf(row.item)[0], session.missStreak);
  rows.unshift({
    ...row,
    arm: 'adaptive',
    breather: true,
    idle: false,
    none: false,
    backlog: ctx.backlog,
    why,
  });
}

export function choose(candidates, learner, memory, now, { params = PARAMS, seed = 'seed' } = {}) {
  if (!learner.session) startSession(learner, now, params);
  const ctx = contextOf(learner, memory, now, params);
  const rows = candidates.map(item => rowOf(item, ctx, seed));
  rows.sort(byRank);
  interleave(rows, ctx);
  markTop(rows, ctx);
  breathe(rows, ctx);
  return rows;
}
