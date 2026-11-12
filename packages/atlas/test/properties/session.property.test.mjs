// 고르기를 임의의 판으로 확인한다(설계 §11 가상 학습자 관문 6 · 시제품 prototype/fuzz-session.mjs를 옮겼다).
// 임의의 문항 은행(단위 하나 · 여럿 · 태그 없음, 문항이 하나뿐인 단위, 「모르겠어요」가 있는 문항) · 임의의 한도 · 임의의 답과 본인 말로
// 여러 날 · 여러 판을 돌리며(판마다 앱을 다시 켠 것처럼), 문항을 낼 때마다 아래를 본다. 한도 · 자리 · 돌아옴은 시험이 따로 센 값으로 본다.
//
// 지켜야 할 것(설계 §3-5 「고르기의 불변식」)
//   가. none은 모든 후보가 「내지 않음」일 때만이다. 멈추지 않는다. 같은 상태에서 두 번 고르면 같은 것을 고른다.
//   나. 할 것(다시 · 돌아옴 · 새것)이 하나라도 있으면 채우기보다 먼저 낸다(숨 고르기 하나는 예외). idle이면 할 것도, 기다리는 다시도 없다.
//   다. 새 단위는 한 판 · 하루 한도를 넘지 않고(「더 배우기」 판은 예외), 처음 낸 단위는 꼭 세며, 한 번 센 단위를 다시 세지 않는다.
//   라. 한 단위를 「다시」로 내는 것은 한 판에 두 번까지다. 세 번 놓친 단위가 든 문항은 그 판에서 어느 층으로도 내지 않는다.
//   마. 돌아온 것으로 내는 문항은 하루 상한을 넘지 않고, 이 판에서 이미 만난 단위를 돌아온 것으로 또 내지 않는다.
//   바. 다시 · 돌아옴 · 새것으로 낸 문항에는 겨눈 단위가 있고 그 문항이 묻는 단위다. 이유의 종류가 층과 맞는다. 놓치면 실패가 그 단위 하나에만.
//   사. 층은 층 표 그대로다 — 문항마다 시험이 층 표를 따로 계산해 맞대 본다.
// 차례와 말(설계 §3-5 「차례의 속성」)
//   아. 놓친 것은 다른 문항 둘이 지난 뒤에, 놓친 순서대로(다른 문항으로 낼 수 있는 것 먼저) 다시 낸다. 당겨 내는 것은 낼 것이 없을 때뿐.
//   자. 돌아온 것은 급한 것부터, 밀린 것이 많으면 살릴 수 있는 것부터 낸다.
//   차. 돌아온 것이 셋 이어지면 새것 하나를 끼운다. 새것은 제품이 정한 진도 순이다.
//   카. 숨 고르기는 이어서 놓친 뒤에만, 이 자리에서 아직 안 만난 잘 아는 단위로만 낸다. 낼 수 있으면 건너뛰지 않는다.
//   타. 이유의 근거 칸은 기록과 같다.
//   파. 예상 성공 확률은 식 그대로다(세 항을 따로 싣고, 「모르겠어요」가 있으면 찍기 바닥이 절반).
// 씨앗 수는 기본 1,500(ATLAS_SEEDS · ATLAS_SEED_SCALE로 바꾼다).
import assert from 'node:assert/strict';
import test from 'node:test';
import { pick, rng, seedRange } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';

const {
  PARAMS,
  createMemory,
  createLearner,
  choose,
  present,
  record,
  say,
  startSession,
  unitsOf,
  dayKey,
} = await subject();
const memory = createMemory();
const DAY = 86_400_000;
const HOUR = 3_600_000;
const T0 = Date.parse('2026-12-01T09:00:00Z');
const SEEDS = seedRange({ count: 1500 });
const FORMATS = ['single-choice', 'binary-choice', 'cup-compose', 'spoken'];
const REASONS = {
  0: ['unit.retry'],
  5: ['unit.retry'],
  1: ['unit.due', 'unit.shaky'],
  2: ['unit.new', 'skill.up', 'skill.ease'],
};
const near = (a, b) => Math.abs(a - b) < 1e-9;
const sigmoid = x => 1 / (1 + Math.exp(-x));

function itemOf(r, itemKey, familyKey, units, skill, order) {
  return {
    itemKey,
    familyKey,
    ...(units ? { units } : {}),
    skillId: skill,
    difficulty: 1 + Math.floor(r() * 3),
    responseFormat: pick(r, FORMATS),
    order,
    unknownOption: r() < 0.2,
  };
}

function makeBank(r) {
  const units = Array.from({ length: 2 + Math.floor(r() * 12) }, (_, i) => `u${i}`);
  const items = [];
  units.forEach((unit, i) => {
    // 문항이 하나뿐인 단위도 있고(다른 문제로 다시 낼 수 없다), 두 문항이 같은 계열의 변형인 단위도 있다
    const n = r() < 0.3 ? 1 : 2;
    const variants = r() < 0.3;
    for (let k = 0; k < n; k += 1)
      items.push(
        itemOf(r, `${unit}.${k}`, variants ? unit : `${unit}.${k}`, [unit], `s${i % 2}`, i),
      );
  });
  for (let k = 0, n = Math.floor(r() * 4); k < n && units.length >= 2; k += 1) {
    const size = 2 + Math.floor(r() * 2);
    const chosen = [...new Set(Array.from({ length: size }, () => pick(r, units)))];
    if (chosen.length >= 2)
      items.push(itemOf(r, `m${k}`, `m${k}`, chosen, `s${k % 2}`, Math.floor(r() * units.length)));
  }
  for (let k = 0, n = Math.floor(r() * 3); k < n; k += 1)
    items.push(itemOf(r, `x${k}`, `x${k}`, null, `s${k % 2}`, Math.floor(r() * units.length)));
  return items;
}

// 한 학습자의 여러 날을 돌리는 판. 시험이 따로 재는 것(기억이 있는가 · 떠올릴 확률 · 같은 자리 안인가 · 돌아왔는가)은 §3-2의 글 그대로다.
function createRun(seed) {
  const r = rng(seed);
  const bank = makeBank(r);
  const learner = createLearner();
  const P = {
    ...PARAMS,
    newPerSession: pick(r, [1, 2, 3, 6]),
    newPerDay: pick(r, [3, 8, 20]),
    reviewsPerDay: pick(r, [2, 10, 60]),
    backlog: pick(r, [1, 4, 20]),
    stubbornPerSession: pick(r, [1, 2, 4]),
  };
  const run = {
    seed,
    r,
    bank,
    learner,
    P,
    skillOf: pick(r, [0.15, 0.5, 0.75, 0.95]),
    now: T0 + Math.floor(r() * 1000),
    step: 0,
    today: { key: null, more: false, units: new Set(), reviews: 0 },
    bad: [],
    log: [], // 시험이 따로 적은 「낸 것」 기록 { at, review, units }
    shownCount: 0, // 시험이 따로 센 낸 문항 수(답한 문항 — 두뇌의 learner.shown을 읽지 않는다)
    shownFamilies: [], // 시험이 따로 적은 낸 문항의 계열(차례대로)
  };
  run.mem = unit => learner.memory.get(unit);
  run.has = unit => memory.has(run.mem(unit));
  run.recall = unit => memory.retrievability(run.mem(unit), run.now);
  run.sitting = unit =>
    run.has(unit) &&
    run.mem(unit).open.grade !== 'known' &&
    run.now - run.mem(unit).open.at < P.sittingHours * HOUR;
  run.due = unit =>
    run.has(unit) && !run.s.met.has(unit) && !run.sitting(unit) && run.recall(unit) < P.retention;
  run.fail = (rule, detail) => {
    if (run.bad.length < 50) run.bad.push(`씨앗 ${seed} · ${run.step}번째 · ${rule}: ${detail}`);
  };
  return run;
}

// 그 시각의 하루를 시험이 따로 적은 「낸 것」 기록에서 센다(새벽 4시를 넘긴 문항은 그 시각의 하루에 든다 — 설계 §3-5 · §5-4).
function todayOf(run, more) {
  const key = dayKey(run.now, run.P);
  const entries = run.log.filter(entry => dayKey(entry.at, run.P) === key);
  return {
    key,
    more: (run.today.key === key && run.today.more) || more,
    units: new Set(entries.flatMap(entry => entry.units)),
    reviews: entries.filter(entry => entry.review).length,
  };
}

// 판이 열린 채 새벽 4시를 넘으면 새 하루다 — 한도는 그 하루로 센다(GPT 끝 판 GB1 · GC1: 판을 열 때만 세면 어제 한도가 이어진다).
function rollToday(run) {
  if (run.today.key !== dayKey(run.now, run.P)) run.today = todayOf(run, run.s.more);
}

// 판 하나를 연다(앱을 다시 켠 것처럼 — 하루의 한도는 「낸 것」 기록에서 다시 세어야 한다).
function openSession(run) {
  const { r, P, learner } = run;
  const more = r() < 0.12;
  run.today = todayOf(run, more);
  learner.day = null;
  // 자리 잡기: 본인이 고른 연습 수준(없으면 선행값 0) — 선행값은 윗 끝 난도의 로짓이다(§3-3)
  const level = r() < 0.3 ? { min: 1, max: pick(r, [1, 2, 3]) } : undefined;
  startSession(learner, run.now, P, { more, level });
  run.s = {
    more,
    prior: level ? P.difficultyLogit[level.max] : 0,
    stubbornServed: 0, // 끈질긴 단위를 겨눠 돌아온 것으로 낸 수(시험이 따로 센다)
    session: learner.session,
    retried: new Map(),
    blanked: new Set(),
    sinceNew: 0,
    missStreak: 0,
    units: new Set(), // 이 판에서 낸 기억 없는 단위(한 판 한도는 이것으로 센다)
    // 시험이 따로 적는 판 장부(Fable 끝 판 P2-1 — 두뇌의 session.retries · session.met을 읽으면 그 장부가 틀려도 못 잡는다):
    //   ledger 단위 → { position(놓친 때까지 낸 문항 수), family, tries, pending } · met 이 판에서 판정된 답으로 만난 단위
    ledger: new Map(),
    met: new Set(),
  };
}

const pendingAt = (run, unit) => {
  const retry = run.s.ledger.get(unit);
  return retry?.pending ? run.shownCount - retry.position : null;
};

// 시험이 따로 옮긴 층 표(§3-5): 내지 않을 까닭 넷 → 기다리는 다시 → 다시 → 돌아옴 → 새것 → 따뜻하게 → 가볍게
function blockedOf(run, item) {
  const { P, s, today } = run;
  const us = unitsOf(item);
  const fresh = us.filter(unit => !run.has(unit) && !today.units.has(unit)).length;
  const here = us.filter(unit => !run.has(unit) && !s.units.has(unit)).length;
  const spent = us.some(unit => {
    const retry = s.ledger.get(unit);
    return retry && !retry.pending && retry.tries >= P.retryMax;
  });
  // 한도는 새로 셀 단위가 있는 문항만 막는다(설계 §3-5 — 「더 배우기」 판 뒤 한도를 넘은 날에도 새 단위 없는 문항은 낸다)
  const over =
    !s.more &&
    ((here > 0 && s.units.size + here > P.newPerSession) ||
      (fresh > 0 && today.units.size + fresh > P.newPerDay));
  const held = today.reviews >= P.reviewsPerDay && us.some(run.due);
  // 끈질긴 단위의 판 몫: 이 판에서 끈질긴 단위를 겨눠 돌아온 것으로 낸 수가 몫에 닿았고, 문항이 돌아온 끈질긴 단위를 묻는다
  const stubborn =
    s.stubbornServed >= P.stubbornPerSession &&
    us.some(unit => run.due(unit) && run.mem(unit).stubborn);
  return spent || over || held || stubborn || s.blanked.has(item.itemKey);
}

function tierOf(run, item) {
  const us = unitsOf(item);
  if (blockedOf(run, item)) return 9;
  if (us.some(unit => pendingAt(run, unit) != null && pendingAt(run, unit) < run.P.retryGap))
    return 5;
  if (us.some(unit => pendingAt(run, unit) != null)) return 0;
  if (us.some(run.due)) return 1;
  if (us.some(unit => !run.has(unit))) return 2;
  const faded = us.some(
    unit => !run.s.met.has(unit) && !run.sitting(unit) && 1 - run.recall(unit) >= 0.03,
  );
  return faded ? 3 : 4;
}

// 가 · 사 · 나 — 고른 목록 전체의 모양.
function checkList(run, rows) {
  const top = rows[0];
  if (rows.length !== run.bank.length) run.fail('가. 후보 수', `${rows.length}/${run.bank.length}`);
  const again = choose(run.bank, run.learner, memory, run.now, { params: run.P })[0];
  if (again.item.itemKey !== top.item.itemKey)
    run.fail('가. 같은 상태에서 다른 것을 고름', top.item.itemKey);
  if (top.none !== rows.every(row => row.tier === 9))
    run.fail('가. none', `none ${top.none} · 맨 앞 ${top.tier}층`);
  const wrong = rows.find(row => row.tier !== tierOf(run, row.item));
  if (wrong)
    run.fail(
      '사. 층이 층 표와 다름',
      `${wrong.item.itemKey} · 낸 층 ${wrong.tier} · 표 ${tierOf(run, wrong.item)}`,
    );
  const todo = rows.some(row => row.tier <= 2);
  const waiting = rows.some(row => row.tier === 5);
  if (todo && !top.breather && top.tier > 2)
    run.fail('나. 할 것이 있는데 채우기를 먼저 냄', `맨 앞 ${top.tier}층`);
  if (top.idle && (todo || waiting))
    run.fail('나. idle인데 할 것 · 기다리는 다시가 있음', `${todo} · ${waiting}`);
  if (!top.idle && !top.none && !top.breather && !todo && !waiting)
    run.fail('나. 할 것이 없는데 idle이 아님', `맨 앞 ${top.tier}층`);
  checkHeld(run, rows, top);
}

// 사 — 미룬 까닭(하루 상한 · 끈질긴 단위의 판 몫)과 idle의 이유: 하루 상한이면 「오늘은 여기까지」, 끈질긴 단위의 몫이면
// 「자꾸 놓치는 말은 여기까지」, 아니면 「다 만났어요」(설계 §3-7 · 단계 2 계획 §8 P1-3).
function heldOf(run, item) {
  const { P, s, today } = run;
  const due = unitsOf(item).filter(run.due);
  if (!due.length) return null;
  if (today.reviews >= P.reviewsPerDay) return 'day';
  const stubborn =
    s.stubbornServed >= P.stubbornPerSession && due.some(unit => run.mem(unit).stubborn);
  return stubborn ? 'stubborn' : null;
}
function checkHeld(run, rows, top) {
  for (const row of rows) {
    if (row.tier !== 9 || row.held === heldOf(run, row.item)) continue;
    run.fail(
      '사. 미룬 까닭이 표와 다름',
      `${row.item.itemKey} · ${row.held} ≠ ${heldOf(run, row.item)}`,
    );
    break;
  }
  if (!top.idle) return;
  let want = 'idle';
  if (top.capped) want = 'day.capped';
  else if (rows.some(row => row.held === 'stubborn')) want = 'pace.stubborn';
  if (top.why.code !== want)
    run.fail('사. idle의 이유가 미룬 까닭과 다름', `${top.why.code} ≠ ${want}`);
}

// 차 — 채우기(3 · 4층) 안의 차례: 흐려진 정도(0.02 단위)가 큰 것 → 가장 오래 안 본 것(설계 §3-5 층 표).
function fillKey(run, item) {
  const faded = unitsOf(item).map(unit =>
    run.s.met.has(unit) || run.sitting(unit) ? 0 : 1 - run.recall(unit),
  );
  const last = run.shownFamilies.lastIndexOf(item.familyKey);
  return [Math.round(Math.max(...faded) * 50), last];
}
function checkFill(run, rows, top) {
  if (top.breather || !(top.tier === 3 || top.tier === 4)) return;
  const [bucket, last] = fillKey(run, top.item);
  const ahead = rows.some(row => {
    if (row === top || row.tier !== top.tier || row.repeat !== top.repeat) return false;
    const [b, l] = fillKey(run, row.item);
    return b > bucket || (b === bucket && l < last);
  });
  if (ahead) run.fail('차. 채우기 차례가 흐려진 정도 → 오래 안 본 것이 아님', top.item.itemKey);
}

// 바 — 겨눈 단위와 이유의 종류, 회차 구분.
function checkAim(run, top, units) {
  const filler = top.tier === 3 || top.tier === 4;
  if (top.arm !== (filler && !top.breather ? 'filler' : 'adaptive'))
    run.fail('바. 회차 구분이 층과 다름', `${top.tier}층 · ${top.arm}`);
  if (top.breather || !(top.tier in REASONS)) return;
  if (!top.target || !units.includes(top.target))
    run.fail('바. 겨눈 단위가 없거나 문항 밖', `${top.tier}층 · ${top.target}`);
  if (!REASONS[top.tier].includes(top.why.code))
    run.fail('바. 이유가 층과 다름', `${top.tier}층 · ${top.why.code}`);
  if (top.why.slots.unit !== top.target)
    run.fail(
      '바. 이유의 근거 칸에 겨눈 단위가 없음',
      `${top.why.code} · ${top.why.slots.unit} ≠ ${top.target}`,
    );
}

// 문항 안에서는 다시 낼 차례를 기다리는 단위가 있으면 그것(가장 먼저 놓친 것)을, 없으면 가장 먼저 놓친 단위를 겨눈다(설계 §3-5
// 차례의 속성 1 — Fable 끝 판 P3-2로 글을 코드대로 맞췄다). 다시 낼 문항이 여럿이면 다른 문항으로 낼 수 있는 것 → 먼저 놓친 것 순이다.
function retryAim(run, item) {
  const retries = run.s.ledger;
  const pending = unitsOf(item)
    .filter(unit => pendingAt(run, unit) != null)
    .sort((a, b) => retries.get(a).position - retries.get(b).position);
  return pending.find(unit => pendingAt(run, unit) < run.P.retryGap) ?? pending[0];
}
function retryRank(run, item) {
  const asked = run.s.ledger.get(retryAim(run, item));
  return [item.familyKey !== asked.family ? 0 : 1, asked.position];
}

// 라 · 아 — 다시.
function checkRetry(run, rows, top) {
  if (top.breather || !(top.tier === 0 || top.tier === 5)) return;
  const { s, P } = run;
  if (pendingAt(run, top.target) == null)
    run.fail('라. 기다리지 않는 단위를 다시로 냄', top.target);
  if (!run.has(top.target)) run.fail('라. 기억이 없는 단위를 다시로 냄', top.target);
  s.retried.set(top.target, (s.retried.get(top.target) || 0) + 1);
  if (s.retried.get(top.target) > P.retryMax)
    run.fail('라. 한 단위를 다시로 세 번 넘게 냄', top.target);
  if (top.tier === 0 && pendingAt(run, top.target) < P.retryGap)
    run.fail('아. 문항 둘이 지나기 전에 다시 냄', top.target);
  if (top.tier === 5 && rows.some(row => row.tier <= 4 && !row.repeat))
    run.fail('아. 낼 것이 있는데 다시를 당겨 냄', top.item.itemKey);
  if (retryAim(run, top.item) !== top.target)
    run.fail('아. 문항 안에서 먼저 놓친 단위를 겨누지 않음', top.target);
  if (top.tier !== 0) return;
  const [mineFirst, mineAt] = retryRank(run, top.item);
  const earlier = rows.some(row => {
    if (row === top || row.tier !== 0 || row.repeat !== top.repeat) return false;
    const [first, at] = retryRank(run, row.item);
    return first < mineFirst || (first === mineFirst && at < mineAt);
  });
  if (earlier) run.fail('아. 다시를 놓친 순서대로 내지 않음', top.item.itemKey);
}

// 마 · 자 · 차 — 돌아온 것.
function checkDue(run, rows, top, units) {
  if (top.breather || top.tier !== 1) return;
  const { s, P, learner } = run;
  run.today.reviews += 1;
  if (s.met.has(top.target)) run.fail('마. 이 판에서 만난 단위를 돌아온 것으로 냄', top.target);
  if (!run.due(top.target)) run.fail('마. 돌아오지 않은 단위를 돌아온 것으로 냄', top.target);
  let backlog = 0;
  for (const unit of learner.memory.keys()) if (run.due(unit)) backlog += 1;
  const rescue = backlog > P.backlog;
  const edge = list => (rescue ? Math.max(...list) : Math.min(...list));
  const mine = run.recall(top.target);
  if (!near(mine, edge(units.filter(run.due).map(run.recall))))
    run.fail('자. 문항 안에서 겨눈 단위가 차례와 다름', top.target);
  const ahead = rows.some(row => {
    if (row === top || row.tier !== 1 || row.repeat !== top.repeat) return false;
    const other = edge(unitsOf(row.item).filter(run.due).map(run.recall));
    return rescue ? other > mine + 1e-9 : other < mine - 1e-9;
  });
  if (ahead)
    run.fail(
      rescue ? '자. 밀렸는데 살릴 수 있는 것부터가 아님' : '자. 급한 것부터가 아님',
      top.item.itemKey,
    );
  if (s.sinceNew >= P.interleave && rows.some(row => row.tier === 2 && !row.repeat))
    run.fail('차. 돌아온 것이 셋 이어졌는데 새것을 끼우지 않음', `이어진 수 ${s.sinceNew}`);
}

// 차 — 새것은 차례가 됐을 때만 돌아온 것 앞에, 진도 순으로.
function checkFresh(run, rows, top) {
  if (top.breather || top.tier !== 2) return;
  if (
    run.s.sinceNew < run.P.interleave &&
    rows.some(row => row.tier === 1 && row.repeat <= top.repeat)
  )
    run.fail('차. 차례가 아닌데 새것을 돌아온 것 앞에 끼움', `이어진 수 ${run.s.sinceNew}`);
  if (
    rows.some(
      row =>
        row.tier === 2 &&
        row.repeat === top.repeat &&
        (row.item.order ?? 0) < (top.item.order ?? 0),
    )
  )
    run.fail('차. 새것이 진도 순이 아님', top.item.itemKey);
}

// 카 — 숨 고르기의 자격, 그리고 낼 수 있으면 건너뛰지 않는다.
function checkBreather(run, rows, top) {
  const { s, P } = run;
  const rested = item =>
    tierOf(run, item) !== 9 &&
    unitsOf(item).every(
      unit =>
        run.has(unit) && !s.met.has(unit) && !run.sitting(unit) && run.recall(unit) >= P.retention,
    );
  if (top.breather && !(s.missStreak >= P.breatherAfter && rested(top.item)))
    run.fail('카. 숨 고르기의 자격이 없음', `${top.item.itemKey} · 이어서 놓친 수 ${s.missStreak}`);
  const calls = top.tier === 0 || top.tier === 2 || (top.tier === 1 && top.p < P.breatherSuccess);
  if (
    !top.breather &&
    s.missStreak >= P.breatherAfter &&
    calls &&
    rows.some(row => !row.repeat && rested(row.item))
  )
    run.fail('카. 숨 고르기를 건너뜀', `${top.tier}층`);
}

// 타 — 이유의 근거 칸과 근거는 기록과 같다.
function reasonWrong(run, top) {
  const { learner, s } = run;
  const slots = top.why.slots;
  const state = top.target ? run.mem(top.target) : null;
  const ability = learner.ability.get(top.item.skillId);
  const level = ability?.level ?? null;
  const elapsed =
    state && run.has(top.target) ? Math.max(1, Math.round((run.now - state.lastAt) / DAY)) : null;
  switch (top.why.code) {
    case 'unit.retry':
      return (
        slots.misses !== (state?.lapses ?? 0) ||
        slots.reviews !== (state?.sittings ?? 0) ||
        slots.other !== (top.item.familyKey !== s.ledger.get(top.target)?.family)
      );
    case 'unit.shaky':
      return (
        !(state.lapses > 0) ||
        slots.misses !== state.lapses ||
        slots.reviews !== state.sittings ||
        slots.days !== elapsed
      );
    case 'unit.due':
      return state.lapses !== 0 || slots.days !== elapsed;
    case 'skill.up':
      return !(
        level != null &&
        top.item.difficulty > level &&
        ability?.streak >= 2 &&
        slots.streak === ability.streak &&
        slots.from === level &&
        slots.to === top.item.difficulty
      );
    case 'skill.ease':
      return !(
        level != null &&
        top.item.difficulty < level &&
        ability?.n > 0 &&
        ability.streak === 0 &&
        slots.from === level &&
        slots.to === top.item.difficulty
      );
    case 'unit.new':
      return run.has(top.target);
    default:
      return false;
  }
}
function evidenceWrong(run, top) {
  const ev = top.why.evidence;
  if (!ev) return true;
  if (!['unit.retry', 'unit.shaky', 'unit.due'].includes(top.why.code)) return false;
  const state = run.mem(top.target);
  return (
    ev.sittings !== (state?.sittings ?? 0) ||
    ev.lapses !== (state?.lapses ?? 0) ||
    ev.lastAt !== (state?.lastAt ?? null)
  );
}
function checkReason(run, top) {
  if (top.breather) return;
  if (reasonWrong(run, top))
    run.fail(
      '타. 이유의 근거 칸이 기록과 다름',
      `${top.why.code} ${JSON.stringify(top.why.slots)}`,
    );
  if (evidenceWrong(run, top))
    run.fail(
      '타. 이유의 근거가 기록과 다름',
      `${top.why.code} ${JSON.stringify(top.why.evidence)}`,
    );
}

// 파 — 예상 성공 확률 = 찍기 바닥 + (1 − 찍기 바닥) × 기억 항 × 능력 항(처음 보는 계열이거나 처음 만나는 단위가 있을 때만).
function checkPredict(run, top, units) {
  const { P, learner } = run;
  const base = P.guess[top.item.responseFormat] ?? P.guess.unknown;
  const floor = top.item.unknownOption ? base / 2 : base;
  const known = units.filter(run.has);
  const ability = learner.ability.get(top.item.skillId);
  const theta = (ability?.theta ?? 0) + run.s.prior / (1 + (ability?.n ?? 0));
  const fresh = known.length < units.length || !learner.met.has(top.item.familyKey);
  const skill = fresh ? sigmoid(theta - (P.difficultyLogit[top.item.difficulty] ?? 0)) : 1;
  const recall = known.reduce((product, unit) => product * run.recall(unit), 1);
  const want = floor + (1 - floor) * recall * skill;
  if (!near(top.p, want)) run.fail('파. 예상 성공 확률이 식과 다름', `낸 값 ${top.p} · 식 ${want}`);
  const e = top.expected;
  if (!near(e.floor, floor) || !near(e.memory, recall) || !near(e.skill, skill))
    run.fail('파. 예상의 세 항이 식과 다름', JSON.stringify(e));
}

// 끈질긴 단위: 줄의 표시가 기억 상태와 같고, 겨눠 돌아온 것으로 낸 수를 센다(다시는 세지 않는다).
function countStubborn(run, top) {
  if (top.breather) return;
  const aimed = top.target ? run.mem(top.target) : null;
  if ([0, 1, 5].includes(top.tier) && top.stubborn !== Boolean(aimed?.stubborn))
    run.fail('카. 끈질긴 단위 표시가 기억 상태와 다름', top.target);
  if (top.tier === 1 && aimed?.stubborn) run.s.stubbornServed += 1;
}

// 다 · 마 — 낸 뒤의 한도. 시험이 따로 센다: 기억이 없고 오늘 아직 낸 적 없는 단위가 「처음 낸 단위」다.
function presentAndCount(run, top, units) {
  const { s, P, learner, today } = run;
  const fresh = units.filter(unit => !run.has(unit) && !today.units.has(unit));
  const here = units.filter(unit => !run.has(unit) && !s.units.has(unit));
  // 끈질긴 단위: 줄의 표시가 기억 상태와 같고, 겨눠 돌아온 것으로 낸 수를 센다(다시는 세지 않는다)
  countStubborn(run, top);
  present(learner, top);
  if (s.stubbornServed !== s.session.stubbornServed)
    run.fail(
      '다. 두뇌가 센 끈질긴 단위 몫이 시험이 센 것과 다름',
      `${s.session.stubbornServed}/${s.stubbornServed}`,
    );
  for (const unit of fresh) today.units.add(unit);
  run.log.push({ at: run.now, review: !top.breather && top.tier === 1, units: fresh });
  for (const unit of here) s.units.add(unit);
  if ((!top.breather && top.tier === 2) || here.length) s.sinceNew = 0;
  else if (!top.breather && top.tier === 1) s.sinceNew += 1;
  checkLimits(run, here, fresh);
}

// 다 · 마 — 한도를 넘지 않고, 두뇌가 센 수가 시험이 센 수와 같다.
function checkLimits(run, here, fresh) {
  const { s, P, learner, today } = run;
  if (!s.more && here.length && s.units.size > P.newPerSession)
    run.fail('다. 한 판 새 단위 한도를 넘김', `${s.units.size}/${P.newPerSession}`);
  if (!today.more && today.units.size > P.newPerDay)
    run.fail('다. 하루 새 단위 한도를 넘김', `${today.units.size}/${P.newPerDay}`);
  if (!s.more && fresh.length && today.units.size > P.newPerDay)
    run.fail('다. 한도가 찬 날에 새 단위를 더 냄', `${today.units.size}`);
  if (
    today.units.size !== learner.day.introduced.size ||
    s.units.size !== s.session.introduced.size
  )
    run.fail(
      '다. 두뇌가 센 새 단위 수가 시험이 센 것과 다름',
      `${learner.day.introduced.size}/${today.units.size}`,
    );
  if (today.reviews > P.reviewsPerDay)
    run.fail('마. 돌아온 것으로 낸 문항이 하루 상한을 넘음', `${today.reviews}/${P.reviewsPerDay}`);
  if (today.reviews !== learner.day.reviews)
    run.fail(
      '마. 두뇌가 센 돌아온 것 수가 시험이 센 것과 다름',
      `${learner.day.reviews}/${today.reviews}`,
    );
}

// 바 — 놓치면 실패가 겨눈 단위 하나에만 적힌다.
function checkCredit(run, top, units, result, lapses) {
  const aim = top.target && units.includes(top.target) ? top.target : units[0];
  if (result.credited.length !== 1 || result.credited[0] !== aim)
    run.fail('바. 실패가 겨눈 단위가 아닌 곳에 적힘', `${result.credited} ≠ ${aim}`);
  for (const unit of units)
    if (unit !== aim && (run.mem(unit)?.lapses ?? 0) !== lapses.get(unit))
      run.fail('바. 겨누지 않은 단위의 놓침이 늘어남', unit);
}

// 시험의 판 장부를 고친다(설계 §3-5): 판정된 답이면 문항의 단위들을 이 판에서 만났고, 놓치면 겨눈 단위가 다시 낼 차례를 기다린다
// (한 판 retryMax번까지, 놓친 때 = 그때까지 낸 문항 수), 맞히면 그 문항의 단위들은 기다림을 푼다. 판정 못 한 답은 아무것도 안 바꾼다.
function noteLedger(run, top, units, result) {
  const { s, P } = run;
  if (result.grade == null) return;
  for (const unit of units) s.met.add(unit);
  if (result.grade !== 'again') {
    for (const unit of units) if (s.ledger.has(unit)) s.ledger.get(unit).pending = false;
    return;
  }
  const aim = top.target && units.includes(top.target) ? top.target : units[0];
  const prior = s.ledger.get(aim);
  const tries = prior ? prior.tries + 1 : 0;
  s.ledger.set(aim, {
    position: run.shownCount,
    family: top.item.familyKey,
    tries,
    pending: tries < P.retryMax,
  });
}

// 두뇌의 판 장부가 시험이 따로 적은 장부와 같은가.
function checkLedger(run) {
  const { s } = run;
  const mine = JSON.stringify([...s.ledger].sort());
  const brain = JSON.stringify([...s.session.retries].sort());
  if (mine !== brain)
    run.fail('아. 두뇌의 다시 장부가 시험이 적은 것과 다름', `${brain} ≠ ${mine}`);
  const met = [...s.session.met].sort().join(',');
  if (met !== [...s.met].sort().join(','))
    run.fail('마. 두뇌가 적은 이 판에서 만난 단위가 시험과 다름', met);
  if (run.learner.shown.length !== run.shownCount)
    run.fail('아. 두뇌가 센 낸 문항 수가 시험과 다름', `${run.learner.shown.length}`);
}

// 답한다.
function replyOf(run, top) {
  const { r } = run;
  if (r() < 0.07) return { correct: null, assessable: false };
  return {
    correct: r() < run.skillOf,
    assisted: r() < 0.1,
    answerShown: r() < 0.03,
    unknown: top.item.unknownOption && r() < 0.1,
  };
}

function answer(run, top, units) {
  const { r, s, learner, P } = run;
  const reply = replyOf(run, top);
  if (s.blanked.has(top.item.itemKey))
    run.fail('사. 판정하지 못한 문항을 그 판에서 다시 냄', top.item.itemKey);
  if (reply.assessable === false) s.blanked.add(top.item.itemKey);
  const lapses = new Map(units.map(unit => [unit, run.mem(unit)?.lapses ?? 0]));
  const result = record(learner, memory, top.item, { ...reply, target: top.target }, run.now, P);
  run.shownCount += 1;
  run.shownFamilies.push(top.item.familyKey);
  noteLedger(run, top, units, result);
  if (result.grade != null) s.missStreak = result.grade === 'again' ? s.missStreak + 1 : 0;
  if (result.grade === 'again') checkCredit(run, top, units, result, lapses);
  if (learner.waitUnits.size || learner.waitSkills.size)
    run.fail('가. 제 차례로 쓰는 기기에 기다리는 줄이 생김', 'wait');
  // 판정 못 한 답은 다시 낸 횟수에 세지 않고(다시 낼 차례가 그대로 남는다), 본인 말은 그 단위의 다시를 거둔다.
  if (result.grade == null && !top.breather && (top.tier === 0 || top.tier === 5))
    s.retried.set(top.target, s.retried.get(top.target) - 1);
  if (r() < 0.05) {
    const unit = pick(r, units);
    say(learner, memory, unit, r() < 0.5 ? 'known' : 'relearn', run.now + 500, P);
    s.retried.delete(unit);
    s.ledger.delete(unit); // 본인 말은 그 단위의 다시를 거둔다
  }
  checkLedger(run);
}

// 한 걸음: 고르고, 보고, 내고, 답한다. 판을 끝내야 하면 false.
function stepOnce(run) {
  run.step += 1;
  rollToday(run);
  let rows;
  try {
    rows = choose(run.bank, run.learner, memory, run.now, { params: run.P });
  } catch (error) {
    run.fail('가. 고르다 멈춤', String(error?.message || error));
    return false;
  }
  checkList(run, rows);
  const top = rows[0];
  if (top.none) return false;
  const units = unitsOf(top.item);
  for (const unit of units) {
    const retry = run.s.ledger.get(unit);
    if (retry && !retry.pending && retry.tries >= run.P.retryMax)
      run.fail('라. 다시를 다 쓴 단위를 또 냄', unit);
  }
  checkAim(run, top, units);
  checkRetry(run, rows, top);
  checkDue(run, rows, top, units);
  checkFresh(run, rows, top);
  checkFill(run, rows, top);
  checkBreather(run, rows, top);
  checkReason(run, top);
  checkPredict(run, top, units);
  presentAndCount(run, top, units);
  answer(run, top, units);
  return true;
}

function runLearner(seed) {
  const run = createRun(seed);
  const { r } = run;
  const days = 1 + Math.floor(r() * 4);
  for (let day = 0; day < days; day += 1) {
    const rounds = 1 + Math.floor(r() * 3);
    for (let round = 0; round < rounds; round += 1) {
      openSession(run);
      for (let i = 0, length = 3 + Math.floor(r() * 30); i < length; i += 1) {
        if (!stepOnce(run)) break;
        // 판 안에서 같은 자리(6시간)가 끝나는 갈래: 이 판에서 만난 단위가 자리 밖으로 나가도 돌아온 것으로 또 내지 않는다
        run.now += r() < 0.03 ? 7 * HOUR : 15000 + Math.floor(r() * 30000);
      }
      run.now += pick(r, [60000, 20 * 60000, 3 * HOUR, 7 * HOUR]);
    }
    const skip = pick(r, [1, 1, 2, 5, 30, 70]);
    run.now =
      (Math.floor(run.now / DAY) + skip) * DAY +
      Math.floor(r() * 12) * HOUR +
      Math.floor(r() * 1000);
  }
  return run;
}

test('고르기의 불변식 일곱 · 차례의 속성 여섯 — 임의의 학습자로 어긋남 0', () => {
  const bad = [];
  let shown = 0;
  for (const seed of SEEDS) {
    const run = runLearner(seed);
    shown += run.step;
    bad.push(...run.bad);
  }
  assert.ok(shown > SEEDS.length, '시험이 문항을 실제로 냈다');
  assert.equal(bad.length, 0, `어긋난 것 ${bad.length}:\n${bad.slice(0, 8).join('\n')}`);
});
