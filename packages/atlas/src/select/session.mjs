// 한 판과 하루(설계 §3-5 · §5-4 「한도 세기」). 기기에서 돈다.
// 하루의 한도는 「낸 것」 기록(learner.log = [{ at, review, units }])에서 센다 — 오늘 처음 낸 단위들과 돌아온 것으로 낸 문항 수.
// 메모리에 든 값을 믿지 않으므로 앱을 다시 켜도 이어지고, 다른 기기에서 낸 것도 요약의 「낸 것」 표로 오면 같이 센다(단계 3이 채운다).
// 한 번 센 단위는 다시 세지 않는다(놓쳐서 기억이 아직 없어도, 판정 못 한 답이었어도).
import { levelOf } from '../ability/index.mjs';
import { applyOwn, createView } from '../fold/device.mjs';
import { unitsOf } from '../fold/units.mjs';
import { PARAMS } from '../params.mjs';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

// 하루의 열쇠. 한도(새 단위 · 복습)만 이 경계를 쓴다 — 기억 계산은 달력을 보지 않고 실제 지난 시간으로 센다.
// 하루는 기기 현지 시각 새벽 4시에 넘어간다. offset = 현지 시각 − UTC(분). 사건에 시간대를 싣지 않는다(§3-5 「하루의 경계」).
export const dayKey = (now, params = PARAMS, offset = 0) =>
  Math.floor((now + offset * MINUTE - params.dayStartHour * HOUR) / DAY);

// 기기의 학습자 = 요약 위의 보기(fold/device.mjs) + 이 기기의 판 상태(낸 문항 · 「낸 것」 기록 · 하루 · 판).
export function createLearner(summary = null) {
  return { ...createView(summary), shown: [], log: [], day: null, session: null, seq: 0 };
}

// 한 판 새것 한도: 제품이 주면 그 값, 판 길이만 주면 그 3분의 1(최소 1), 둘 다 없으면 매개변수의 출발값.
export function newLimitOf({ newLimit, length } = {}, params = PARAMS) {
  if (Number.isInteger(newLimit) && newLimit >= 0) return newLimit;
  if (Number.isInteger(length) && length > 0) return Math.max(1, Math.floor(length / 3));
  return params.newPerSession;
}

// 끈질긴 단위를 겨눠 돌아온 것으로 내는 몫: 판 길이의 5분의 1(최소 1), 판 길이가 없으면 출발값.
export function stubbornCapOf({ length } = {}, params = PARAMS) {
  if (Number.isInteger(length) && length > 0)
    return Math.max(1, Math.floor(length / params.stubbornShare));
  return params.stubbornPerSession;
}

// 자리 잡기의 선행값 θ₀ = 고른 연습 수준 범위의 윗 끝 난도(§3-3). 수준을 안 주면 0.
const priorOf = (level, params) => (level?.max != null ? levelOf(level.max, params) : 0);

// 그 하루의 한도 값을 「낸 것」 기록에서 센다 — 그날 처음 낸 단위들과 돌아온 것으로 낸 문항 수.
function countDay(learner, key, params, offset) {
  const today = learner.log.filter(entry => dayKey(entry.at, params, offset) === key);
  return {
    key,
    reviews: today.filter(entry => entry.review).length,
    introduced: new Set(today.flatMap(entry => entry.units)),
  };
}

// 지금(now)의 하루. 판이 열린 채 새벽 4시를 넘었으면 새 하루의 값을 기록에서 다시 센다 — 학습자는 바꾸지 않는다
// (고르기 · 활동 고르기가 부른다. 바꿔 끼우는 것은 present다 — GPT 끝 판 GB1).
export function dayOf(learner, now, params = PARAMS) {
  const offset = learner.dayOffset ?? 0;
  const key = dayKey(now, params, offset);
  return learner.day?.key === key ? learner.day : countDay(learner, key, params, offset);
}

// 판을 연다. options: more(본인이 「더 배우기」를 골랐다 — 새것 한도를 넘어도 새것으로 낸다) · length(판 길이) ·
// newLimit(한 판 새것 한도) · level({ min, max } — 본인이 고른 연습 수준, 범위 밖 문항은 제품이 거른다) · dayOffset(현지 − UTC, 분).
export function startSession(learner, now = 0, params = PARAMS, options = {}) {
  const offset = options.dayOffset ?? learner.dayOffset ?? 0;
  learner.dayOffset = offset;
  learner.day = countDay(learner, dayKey(now, params, offset), params, offset);
  learner.session = {
    start: learner.shown.length,
    introduced: new Set(),
    sinceNew: 0,
    missStreak: 0,
    more: Boolean(options.more),
    newLimit: newLimitOf(options, params),
    stubbornCap: stubbornCapOf(options, params),
    stubbornServed: 0,
    prior: priorOf(options.level, params),
    length: options.length ?? null,
    retries: new Map(),
    met: new Set(),
    blank: new Set(),
  };
  return params;
}

// 다시 낼 차례를 고친다: 놓치면 겨눈 단위가 다시 낼 차례를 기다리고(한 판 retryMax번까지), 맞히면 그 문항의 단위들은 기다림을 푼다.
function noteRetry(learner, session, item, grade, credited, params) {
  if (grade === 'again') {
    const prior = session.retries.get(credited[0]);
    const tries = prior ? prior.tries + 1 : 0;
    session.retries.set(credited[0], {
      position: learner.shown.length,
      family: item.familyKey,
      tries,
      pending: tries < params.retryMax,
    });
    return;
  }
  for (const unit of unitsOf(item)) {
    const retry = session.retries.get(unit);
    if (retry) retry.pending = false;
  }
}

// 답 하나를 받는다: 내 사건으로 요약 줄에 얹고(applyOwn), 이 판의 상태(다시 낼 것 · 이 판에서 만난 단위 · 이어서 놓친 수)를 고친다.
// 성공은 문항이 묻는 모든 단위에, 실패는 그 문항이 겨눈 단위 하나에 적힌다 — 겨눈 단위(answer.target)는 문항을 보일 때 사건에 적힌 값이다.
export function record(learner, memory, item, answer, now, params = PARAMS) {
  if (!learner.session) startSession(learner, now, params);
  const session = learner.session;
  const units = unitsOf(item);
  learner.shown.push({ family: item.familyKey, units, at: now });
  const id = answer.id ?? `own-${(learner.seq += 1)}`;
  const event = { kind: 'answer', id, at: now, item, answer };
  const { grade, lead, credited } = applyOwn(learner, event, memory, params);
  // 판정 못 한 답(소리가 안 났다 · 건너뛰었다)은 기억에 적지 않고, 그 단위를 「이 판에서 만났다」고도 치지 않는다.
  // 그 문항은 이 판에서 다시 내지 않는다 — 소리가 안 나는 문항이 판을 붙잡지 않게(같은 단위의 다른 문항은 낼 수 있다).
  if (grade == null) {
    session.blank.add(item.itemKey);
    return { grade, first: lead };
  }
  for (const unit of units) session.met.add(unit);
  session.missStreak = grade === 'again' ? session.missStreak + 1 : 0;
  noteRetry(learner, session, item, grade, credited, params);
  return { grade, first: lead, credited };
}

// 본인 말: 「이미 알아요」(known) · 「다시 배울래요」(relearn). 그 단위의 줄에 얹고, 이 판에서 다시 낼 차례를 기다리던 것도 거둔다.
export function say(learner, memory, unit, kind, now, params = PARAMS) {
  const event = { kind: 'say', id: `own-${(learner.seq += 1)}`, at: now, unit, say: kind };
  applyOwn(learner, event, memory, params);
  learner.session?.retries.delete(unit);
  return learner.memory.get(unit);
}

// 문항을 낸다. 「낸 것」 기록(처음 낸 단위 · 돌아온 것으로 냈는가 · 시각)을 남긴다 — 하루 한도는 이 기록에서 센다.
// 판이 열린 채 하루가 넘어갔으면 새 하루로 갈아 끼운 뒤 센다(고를 때 본 하루와 같다).
export function present(learner, row, params = PARAMS) {
  const session = learner.session;
  learner.day = dayOf(learner, row.at, params);
  learner.log.push({
    at: row.at,
    review: row.tier === 1,
    units: row.fresh ? [...row.brandNew] : [],
  });
  if (row.tier === 1) {
    session.sinceNew += 1;
    learner.day.reviews += 1;
  }
  for (const unit of row.brandNew) learner.day.introduced.add(unit); // 새 단위는 어느 층으로 만나든 하루에 한 번만 센다
  for (const unit of row.firstHere) session.introduced.add(unit); // 이 판에서 처음 낸 기억 없는 단위
  if (row.tier === 2 || row.firstHere.length) session.sinceNew = 0; // 새것을 냈으면 셋에 하나를 다시 센다
  if (row.tier === 1 && row.stubborn) session.stubbornServed += 1; // 끈질긴 단위를 돌아온 것으로 낸 몫(다시는 세지 않는다)
}
