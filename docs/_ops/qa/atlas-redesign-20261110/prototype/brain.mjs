// Atlas 재설계 — 새 두뇌의 시제품 3판(설계 검증용, 제품 코드 아님). 설계 검토(아르곤 · 아스트라 2026-11-10, 두 번) 뒤 고친 판.
// 세 부품: ① 기억(낱말 · 문형 · 문항 계열마다 FSRS 상태) ② 작업 난도(능력마다 θ) ③ 고르기(다시 → 돌아옴 → 새것 → 채우기) + 이유(종류 + 근거 칸).
// 순수 함수와 작은 상태 객체뿐이다. 저장 · 화면 · 네트워크는 없다. 같은 입력과 씨앗이면 같은 결과가 나온다.
// 상태는 모두 답 줄에서 다시 만들 수 있다: 단위 기억 = 그 단위의 답을 시각 순으로 접은 값, 작업 난도 = 그 능력의 측정 답을 시각 순으로 접은 값,
// 「처음 본 계열」 = 그 계열의 가장 이른 제시. 어느 계산도 다른 단위 · 다른 능력의 그때 상태를 읽지 않는다.

export const PARAMS = Object.freeze({
  version: 'brain-proto-3',
  retention: 0.9, // 08-22 확정값(request_retention)
  maxIntervalDays: 60, // 08-22 확정값(maximum_interval). 떠올릴 확률이 높아도 60일이 지나면 돌아온 것으로 본다
  targetSuccess: 0.8, // 순간 맞춤(flow)이 겨누는 0.75~0.8과 같은 자리
  guess: { 'binary-choice': 0.5, 'single-choice': 0.25, 'cup-compose': 0.05, action: 0.1, spoken: 0.02, unknown: 0.25 },
  difficultyLogit: { 1: -1, 2: 0, 3: 1 }, // 저작 난도 1·2·3의 출발값. 실측이 쌓이면 문항별 값으로 바뀐다
  weakWeight: 0.4, // 고르는 꼴을 혼자 맞힘 = 약한 성공: 안정도는 Good 증가분의 이만큼만 늘리고, 난이도 값은 Good과 같게 갱신한다(올리지 않는다)
  sittingHours: 6, // 같은 단위를 이 시간 안에 다시 만난 것은 같은 자리 — 한 자리의 결과는 하나다
  retryGap: 2, // 틀린 것은 다른 문항 둘 뒤에 다시
  retryMax: 2, // 한 판에서 한 단위를 다시 내는 횟수. 다 쓰면 그 판에서는 더 내지 않는다
  newPerSession: 6, // 한 판에 새로 만나는 기억 단위 수(제품이 판 길이에 맞춰 정하는 손잡이)
  newPerDay: 20, // 하루에 새로 만나는 기억 단위 수의 상한 — 게임을 잇달아 여러 판 해도 넘지 않는다
  interleave: 3, // 돌아온 것 셋에 새것 하나 — 복습이 진도를 막지 않게
  backlog: 20, // 돌아온 단위가 이보다 많으면 「살릴 수 있는 것부터」(떠올릴 확률 높은 순)
  reviewsPerDay: 60, // 하루에 돌아온 것으로 내는 문항 수의 상한
  breatherAfter: 2, // 이만큼 이어서 놓치면 다음은 잘 떠올릴 수 있는 것 하나로 숨을 고른다
  breatherSuccess: 0.85, // 돌아온 것의 예상 성공이 이보다 낮을 때만 숨 고르기를 끼운다
  avoidRecent: 2, // 바로 앞 두 문항과 같은 계열은 피한다
  promoteAtDays: 7, // 간격이 이만큼 벌어진 단위는 만들어 내는 꼴 문항을 먼저 고른다
});

const DAY = 86400000, HOUR = 3600000;
const sigmoid = x => 1 / (1 + Math.exp(-x));
const byTime = (a, b) => a.at - b.at || a.i - b.i;

// ── ① 기억 ────────────────────────────────────────────────────────────────
// 한 답이 기억 단위에 주는 등급. Easy는 내지 않는다(걸린 시간 재료가 없다 — 08-22 확정 ⓒ).
//   again 틀림 · 답을 본 뒤 맞힘 · 「모르겠어요」 / hard 힌트를 보고 맞힘(08-22 「낮은 확신 → Hard」와 같은 뜻)
//   weak 고르는 꼴을 혼자 맞힘(찍어서 맞힐 수 있는 약한 근거) / good 만들어 내는 꼴을 혼자 맞힘
export const PRODUCED = Object.freeze(['cup-compose', 'spoken']);
export function gradeOf({ correct, assisted = false, answerShown = false, unknown = false, responseFormat = 'unknown', assessable = true }) {
  if (!assessable) return null; // 소리가 안 났거나 판정 못 한 답은 근거가 아니다
  if (unknown) return 'again';
  if (typeof correct !== 'boolean') return null;
  if (!correct || answerShown) return 'again';
  if (assisted) return 'hard';
  return PRODUCED.includes(responseFormat) ? 'good' : 'weak';
}

export function createMemory(tsfsrs, params = PARAMS) {
  const { fsrs, generatorParameters } = tsfsrs;
  const f = fsrs(generatorParameters({ request_retention: params.retention, maximum_interval: params.maxIntervalDays, enable_fuzz: false, enable_short_term: false }));
  const FSRS_GRADE = { again: 1, hard: 2, good: 3 };
  // 지난 시간은 실제 시간(날, 실수)으로 센다. 달력 날짜 · 시간대 · 「24시간 내림」에 기대지 않는다.
  const days = (from, to) => Math.max(0, (to - from) / DAY);
  // 한 자리의 결과를 앞 상태에 적용한다. 약한 성공: 첫 만남은 Hard의 출발값(안정도 1.3일 · 난이도 값 5.1),
  // 그 뒤는 안정도 S' = S + weakWeight × (S_good − S), 난이도 값 D' = D_good(Good의 갱신 — 올리지 않는다).
  function step(before, t, sittingGrade) {
    const grade = sittingGrade === 'weak' && params.weakWeight >= 1 ? 'good' : sittingGrade; // 견줄 때만: 증가분 1 이상이면 고르는 꼴 정답을 처음부터 Good 그대로
    if (grade !== 'weak') return f.next_state(before, t, FSRS_GRADE[grade]);
    if (!before) return f.next_state(null, 0, FSRS_GRADE.hard);
    const good = f.next_state(before, t, FSRS_GRADE.good);
    return { stability: before.stability + params.weakWeight * (good.stability - before.stability), difficulty: good.difficulty };
  }
  // 단위 상태 = 「마지막 자리 앞의 상태(prev) + 마지막 자리(open)」와 거기서 계산한 값. 요약에는 이 꼴 그대로 싣는다 —
  // 같은 자리에 답이 더 오면(먼저 맞히고 이어서 놓친 경우) 앞 상태에서 그 자리만 다시 계산할 수 있어야 하기 때문이다.
  // 안정도는 최대 간격(60일)을 넘기지 않는다 — 그래서 60일째에 떠올릴 확률이 꼭 목표(0.9)에 닿고, 「돌아올 때」는 규칙 하나(확률이 목표 아래)로 끝난다.
  const KNOWN = { stability: params.maxIntervalDays, difficulty: f.next_state(null, 0, FSRS_GRADE.good).difficulty };
  function build(prev, open, counts) {
    const s = open.grade === 'known' ? KNOWN : step(prev ? { stability: prev.stability, difficulty: prev.difficulty } : null, prev ? days(prev.lastAt, open.at) : 0, open.grade);
    return { stability: Math.min(s.stability, params.maxIntervalDays), difficulty: s.difficulty, lastAt: open.at, prev, open, latestAt: open.at, ...counts };
  }
  // 답 하나를 얹는다. 지금까지의 답보다 시각이 늦은 답에만 쓴다(가운데 끼는 답은 fold로 그 단위를 처음부터 다시 접는다).
  // 본인 말도 같은 줄에 선다: 「다시 배울래요」(say: 'relearn')는 그 단위를 처음으로 돌리고, 「이미 알아요」(say: 'known')는 60일 뒤로 보낸다.
  // 「이미 알아요」 뒤의 첫 답이 놓침이면 처음 놓친 단위와 같게 시작한다(높은 안정도를 물려받지 않는다).
  function append(state, answer) {
    if (answer.say === 'relearn') return null;
    if (answer.say === 'known') return build(null, { at: answer.at, grade: 'known' }, { sittings: state?.sittings ?? 0, lapses: state?.lapses ?? 0, firstAt: state?.firstAt ?? answer.at });
    const miss = answer.grade === 'again' ? 1 : 0;
    if (!state) return build(null, { at: answer.at, grade: answer.grade }, { sittings: 1, lapses: miss, firstAt: answer.at });
    if (state.open.grade === 'known') {
      if (miss) return build(null, { at: answer.at, grade: 'again' }, { sittings: state.sittings + 1, lapses: state.lapses + 1, firstAt: state.firstAt });
    } else if (answer.at - state.open.at < params.sittingHours * HOUR) { // 같은 자리: 놓친 적이 있으면 놓침, 아니면 첫 성공의 등급
      if (!miss || state.open.grade === 'again') return { ...state, latestAt: answer.at };
      return { ...build(state.prev, { at: state.open.at, grade: 'again' }, { sittings: state.sittings, lapses: state.lapses + 1, firstAt: state.firstAt }), latestAt: answer.at };
    }
    return build({ stability: state.stability, difficulty: state.difficulty, lastAt: state.lastAt }, { at: answer.at, grade: answer.grade }, { sittings: state.sittings + 1, lapses: state.lapses + miss, firstAt: state.firstAt });
  }
  const retrievability = (state, now) => (state ? Number(f.forgetting_curve(days(state.lastAt, now), state.stability)) : null);
  const inSitting = (state, now) => Boolean(state) && state.open.grade !== 'known' && now - state.open.at < params.sittingHours * HOUR;
  return {
    append,
    // 한 기억 단위의 답 열을 시각 순으로 접는다.
    fold: answers => answers.filter(r => Number.isFinite(r.at) && (['again', 'hard', 'weak', 'good'].includes(r.grade) || ['known', 'relearn'].includes(r.say))).map((r, i) => ({ ...r, i })).sort(byTime).reduce(append, null),
    retrievability, inSitting,
    // 돌아옴: 떠올릴 확률이 목표 아래로 내려왔다(안정도 상한 때문에 60일이면 반드시 내려온다). 같은 자리 안에서는 돌아온 것으로 치지 않는다
    // (그 자리의 답은 이미 하나로 적혔다 — 놓친 것은 그 자리가 지난 뒤, 그날 저녁이나 다음 날 돌아온다).
    isDue: (state, now) => Boolean(state) && !inSitting(state, now) && retrievability(state, now) < params.retention,
    // 다음에 돌아올 때까지의 날 수(목표 보유율에 닿는 때. 같은 자리 시간보다 짧지 않고 최대 간격보다 길지 않다).
    intervalDays(state) {
      let low = params.sittingHours / 24, high = params.maxIntervalDays;
      if (Number(f.forgetting_curve(low, state.stability)) < params.retention) return low;
      if (Number(f.forgetting_curve(high, state.stability)) >= params.retention) return high;
      for (let i = 0; i < 40; i += 1) { const mid = (low + high) / 2; if (Number(f.forgetting_curve(mid, state.stability)) >= params.retention) low = mid; else high = mid; }
      return high;
    },
  };
}

// ── ② 작업 난도 ─────────────────────────────────────────────────────────────
// 능력마다 θ 하나. 처음 본 문항에 혼자 낸 답(측정 자격)으로만 움직인다. 어디에도 급수나 점수로 보이지 않는다.
// 그 능력의 측정 답을 시각 순으로 처음부터 접은 값이다. 단위 기억의 상태는 읽지 않는다(읽으면 한 단위의 늦은 답이 다른 능력 값까지 흔든다).
// 기기는 요약의 (θ, 답 수)에 자기 새 답을 이어 붙이고, 가운데 끼는 답이 오면 서버가 그 능력만 처음부터 다시 접는다.
export function stepAbility(ability, row, params = PARAMS) {
  const g = params.guess[row.responseFormat] ?? params.guess.unknown, b = params.difficultyLogit[row.difficulty] ?? 0;
  const expected = g + (1 - g) * sigmoid(ability.theta - b);
  return { theta: ability.theta + (0.25 + 0.9 / (1 + ability.n / 4)) * ((row.correct ? 1 : 0) - expected), n: ability.n + 1 }; // 처음에는 크게, 답이 쌓이면 잔잔하게
}
// 한 능력의 답 한 줄을 (θ, 답 수, 이어서 혼자 맞힌 수)에 반영한다. lead = 그 계열의 첫 제시인가.
// 이어서 혼자 맞힌 수: 처음 본 문항을 혼자 맞히면 +1, 그 능력의 어떤 문항이든 놓치거나 도움을 받으면 0, 복습을 맞힌 것은 그대로.
function stepSkill(skill, row, params) {
  const solo = row.lead && row.unaided, miss = row.grade === 'again';
  const ability = solo ? stepAbility(skill, { correct: !miss, difficulty: row.difficulty, responseFormat: row.responseFormat }, params) : { theta: skill.theta, n: skill.n };
  return { ...ability, streak: solo && !miss ? skill.streak + 1 : miss || !row.unaided ? 0 : skill.streak, lastAt: row.at };
}
const EMPTY_SKILL = Object.freeze({ theta: 0, n: 0, streak: 0, lastAt: -Infinity });
export function abilityOf(rows, params = PARAMS) { return rows.map((r, i) => ({ i, ...r })).sort(byTime).reduce((skill, row) => stepSkill(skill, row, params), EMPTY_SKILL); }

// ── 학습자 상태(시제품용 보관함) ───────────────────────────────────────────────
export function createLearner() {
  return { answers: new Map(), memory: new Map(), families: new Map(), ability: new Map(), seenFamilies: new Set(), shown: [], level: new Map(), day: null, session: null };
}
// 문항이 묻는 단위(정답을 내려면 꼭 떠올려야 하는 것). 첫째가 주 단위다. 태그가 없으면 문항 계열이 곧 기억 단위다.
export const unitsOf = item => (item.kcIds?.length ? item.kcIds : [`family:${item.familyKey}`]);

// 예상 성공 확률 = 찍기 바닥 + (1 − 찍기 바닥) × 기억 항 × 능력 항.
//   기억 항: 상태가 있는 단위들의 떠올릴 확률의 곱.
//   능력 항: 처음 보는 계열이거나 처음 만나는 단위가 있으면 능력 대 난도, 다 만나 본 문항을 다시 만나면 1(그 문항의 기억이 지배한다).
export function predict(item, learner, memory, now, params = PARAMS) {
  const g = params.guess[item.responseFormat] ?? params.guess.unknown, b = params.difficultyLogit[item.difficulty] ?? 0;
  let recall = 1, missing = false;
  for (const unit of unitsOf(item)) { const r = memory.retrievability(learner.memory.get(unit), now); if (r == null) missing = true; else recall *= r; }
  const skill = missing || !learner.seenFamilies.has(item.familyKey) ? sigmoid((learner.ability.get(item.skillId)?.theta ?? 0) - b) : 1;
  return g + (1 - g) * recall * skill;
}

// 판을 연다. more = 본인이 「더 배우기」를 골랐다(이 판은 새것 한도를 넘어도 새것으로 낸다).
export function startSession(learner, now = 0, params = PARAMS, { more = false } = {}) {
  const key = Math.floor(now / DAY);
  if (learner.day?.key !== key) learner.day = { key, reviews: 0, newUnits: 0 };
  learner.session = { start: learner.shown.length, newUnits: 0, sinceNew: 0, missStreak: 0, more, retries: new Map(), met: new Set() };
  return params;
}

// 답 하나를 받아 상태를 고친다. 성공은 문항이 묻는 모든 단위에 적는다. 실패는 그 문항이 겨눈 단위 하나에 적는다 —
// 겨눈 단위(answer.target)는 문항을 보일 때 사건에 적힌 값이라, 접을 때 다른 단위의 상태를 읽지 않는다. 없으면 주 단위다.
export function record(learner, memory, item, answer, now, params = PARAMS) {
  if (!learner.session) startSession(learner, now, params);
  const session = learner.session, units = unitsOf(item);
  const grade = gradeOf({ ...answer, responseFormat: item.responseFormat });
  // 「처음 본 계열」은 받은 차례가 아니라 시각 순으로 가린다 — 그 계열의 가장 이른 제시가 첫 만남이다(판정 못 한 제시도 만난 것으로 친다. 지금 계약과 같다).
  const shows = learner.families.get(item.familyKey) || [];
  const show = { at: now, i: learner.shown.length, skillId: item.skillId, difficulty: item.difficulty, responseFormat: item.responseFormat, grade, unaided: answer.assisted !== true && answer.answerShown !== true };
  const leadBefore = shows[0];
  shows.push(show); shows.sort(byTime);
  learner.families.set(item.familyKey, shows);
  const first = shows[0] === show;
  learner.seenFamilies.add(item.familyKey);
  learner.shown.push({ family: item.familyKey, units, at: now });
  if (grade == null) return { grade, first }; // 판정 못 한 답은 기억에 적지 않고, 그 단위를 「이 판에서 만났다」고도 치지 않는다
  // 능력: 제 차례로 온 답은 이어 붙이고, 늦게 온 답(더 이른 시각이거나 그 계열의 첫 만남을 바꾼 답)은 그 능력의 답 전체에서 다시 접는다.
  const skill = learner.ability.get(item.skillId) || EMPTY_SKILL;
  if (now >= skill.lastAt && (first ? !leadBefore : true)) learner.ability.set(item.skillId, stepSkill(skill, { ...show, lead: first }, params));
  else {
    const rows = [];
    for (const list of learner.families.values()) for (const s of list) if (s.skillId === item.skillId && s.grade != null) rows.push({ ...s, lead: s === list[0] });
    learner.ability.set(item.skillId, abilityOf(rows, params));
  }
  for (const unit of units) session.met.add(unit);
  session.missStreak = grade === 'again' ? session.missStreak + 1 : 0;
  const target = answer.target && units.includes(answer.target) ? answer.target : units[0];
  const credited = grade === 'again' ? [target] : units;
  for (const unit of credited) {
    const list = learner.answers.get(unit) || [], state = learner.memory.get(unit);
    list.push({ at: now, grade });
    learner.answers.set(unit, list);
    learner.memory.set(unit, !state || now >= state.latestAt ? memory.append(state, { at: now, grade }) : memory.fold(list)); // 늦게 온 답은 처음부터 다시 접는다
  }
  if (grade === 'again') {
    const prior = session.retries.get(target), tries = prior ? prior.tries + 1 : 0;
    session.retries.set(target, { position: learner.shown.length, family: item.familyKey, tries, pending: tries < params.retryMax });
  } else for (const unit of units) { const retry = session.retries.get(unit); if (retry) retry.pending = false; }
  return { grade, first, credited };
}

// 본인 말: 「이미 알아요」(known) · 「다시 배울래요」(relearn). 답과 같은 줄에 시각 순으로 서고, 그 단위만 다시 접는다.
export function say(learner, memory, unit, kind, now) {
  const list = learner.answers.get(unit) || [];
  list.push({ at: now, say: kind });
  learner.answers.set(unit, list);
  const state = memory.fold(list);
  if (state) learner.memory.set(unit, state); else learner.memory.delete(unit);
  return state;
}

// ── ③ 고르기와 이유 ───────────────────────────────────────────────────────────
// 할 것: 0 다시(이 판에서 놓친 것, 다른 문항 둘 뒤, 단위당 두 번까지) · 1 돌아옴 · 2 새것(진도 순, 한 판 · 하루 한도 안).
// 채우기(판 길이가 정해진 게임이 할 것 없이 이어 갈 때): 3 따뜻하게(아는 것 가운데 흐려지기 시작한 것) · 4 가볍게(나머지 아는 것, 가장 오래 안 본 것부터)
//   · 5 다시 낼 차례를 기다리는 것(차례를 당겨 낸다).
// 내지 않는 것(9): 이 판의 「다시」를 다 쓴 단위, 한도를 넘는 새 단위가 든 문항(본인이 「더 배우기」를 고른 판에서는 2층). 이것뿐이면 none이다.
// idle = 할 것이 없다(위 셋이 비었고 기다리는 「다시」도 없다). none = 낼 문항이 하나도 없다 — 제품이 판을 끝낸다.
const hash = text => { let h = 2166136261; for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

export function choose(candidates, learner, memory, now, { params = PARAMS, seed = 'seed' } = {}) {
  if (!learner.session) startSession(learner, now, params);
  const session = learner.session;
  // 「방금 본 것」은 이 판 안에서만 센다(며칠 전에 본 것은 방금이 아니다).
  const recent = new Set(learner.shown.slice(Math.max(session.start, learner.shown.length - params.avoidRecent)).map(row => row.family));
  const lastShown = new Map(learner.shown.map((row, index) => [row.family, index]));
  const dueNow = unit => !session.met.has(unit) && memory.isDue(learner.memory.get(unit), now); // 이 판에서 이미 만난 단위는 돌아옴 층에 다시 들지 않는다
  let backlog = 0;
  for (const unit of learner.memory.keys()) if (dueNow(unit)) backlog += 1;
  const rescue = backlog > params.backlog, capped = learner.day.reviews >= params.reviewsPerDay;
  const rows = [];
  for (const item of candidates) {
    const units = unitsOf(item), states = units.map(unit => learner.memory.get(unit));
    const p = predict(item, learner, memory, now, params), fit = 1 - Math.abs(p - params.targetSuccess);
    const retryOf = unit => session.retries.get(unit);
    const retry = units.map(unit => [unit, retryOf(unit)]).find(([, r]) => r?.pending && learner.shown.length - r.position >= params.retryGap);
    const waiting = units.some(unit => retryOf(unit)?.pending && learner.shown.length - retryOf(unit).position < params.retryGap);
    const spent = units.some(unit => { const r = retryOf(unit); return r && !r.pending && r.tries >= params.retryMax; });
    const unseen = units.filter((unit, i) => !states[i]), fresh = unseen.length;
    // 밀린 것이 많으면 살릴 수 있는 것부터(떠올릴 확률이 높은 단위), 아니면 급한 것부터(낮은 단위).
    const due = units.map((unit, i) => [unit, states[i]]).filter(([unit, state]) => state && dueNow(unit)).map(([unit, state]) => [unit, state, memory.retrievability(state, now)]).sort((a, b) => (rescue ? b[2] - a[2] : a[2] - b[2]));
    // 새것 한도는 모든 층에 건다: 한도를 넘는 새 단위가 든 문항은 다시 · 돌아옴으로도 내지 않는다(그 단위는 새 단위가 없는 문항으로 낸다).
    const over = fresh > 0 && !session.more && (session.newUnits + fresh > params.newPerSession || learner.day.newUnits + fresh > params.newPerDay);
    let tier = 4, need = 0, promote = 0, target = null, why = { code: 'keep.warm', slots: {} };
    if (spent || over || (due.length && capped)) { tier = 9; need = -(item.order ?? 0); } // 하루 복습 상한으로 미룬 것은 그날 채우기에도 쓰지 않는다
    else if (retry) {
      const state = learner.memory.get(retry[0]);
      tier = 0; target = retry[0]; need = 1 + (item.familyKey !== retry[1].family ? 0.5 : 0); // 같은 것을 다른 문항으로 만날 수 있으면 그쪽 먼저
      why = { code: 'unit.retry', slots: { unit: target, misses: state.lapses, reviews: state.sittings, other: item.familyKey !== retry[1].family } };
    } else if (waiting) { tier = 5; } // 방금 틀린 것은 문항 둘이 지난 뒤에
    else if (due.length && !capped) {
      const [unit, state, r] = due[0];
      tier = 1; target = unit; need = rescue ? r : Math.max(0.01, 1 - r / params.retention);
      promote = PRODUCED.includes(item.responseFormat) && state.stability >= params.promoteAtDays ? 1 : 0;
      const elapsed = Math.max(1, Math.round((now - state.lastAt) / DAY));
      why = state.lapses > 0 ? { code: 'unit.shaky', slots: { unit, misses: state.lapses, reviews: state.sittings, days: elapsed } } : { code: 'unit.due', slots: { unit, days: elapsed } };
    } else if (fresh) {
      tier = 2; target = unseen[0]; need = -(item.order ?? 0); // 새것은 제품이 정한 진도 순(같은 묶음 안에서는 난도 맞음으로 고른다)
      const previous = learner.level.get(item.skillId), ability = learner.ability.get(item.skillId);
      why = previous != null && item.difficulty > previous && (ability?.streak || 0) >= 2 ? { code: 'skill.up', slots: { skill: item.skillId, streak: ability.streak, from: previous, to: item.difficulty } }
        : previous != null && item.difficulty < previous && ability?.n > 0 && ability.streak === 0 ? { code: 'skill.ease', slots: { skill: item.skillId, from: previous, to: item.difficulty } }
        : { code: 'unit.new', slots: { unit: target } };
    } else {
      // 채우기: 이 판에서 만났거나 아직 같은 자리 안인 단위는 「따뜻하게」에 들지 않는다(그 자리의 답은 이미 적혔다).
      need = Math.max(...units.map((unit, i) => (session.met.has(unit) || memory.inSitting(states[i], now) ? 0 : 1 - memory.retrievability(states[i], now))));
      if (need >= 0.03) tier = 3;
    }
    const repeat = recent.has(item.familyKey) ? 1 : 0;
    // 숨 고르기에 쓸 수 있나: 다 아는 단위이고, 이 자리에서 아직 안 만났고, 떠올릴 확률이 목표 이상이다(찍기 바닥이 섞인 예상 성공이 아니라 기억만 본다).
    const rested = tier !== 9 && !fresh && units.every((unit, i) => !session.met.has(unit) && !memory.inSitting(states[i], now) && memory.retrievability(states[i], now) >= params.retention);
    rows.push({ item, tier, need, fit, p, why, target, repeat, promote, fresh, rested, last: lastShown.get(item.familyKey) ?? -1, tie: hash(`${seed}|${learner.shown.length}|${item.id}`) });
  }
  // 차례: 할 것(0~2층)이 늘 채우기보다 앞이고, 내지 않는 것은 맨 뒤다. 그 안에서 방금 본 계열을 피하고, 층 → 층 안의 순서.
  //   다시 · 돌아온 것: 급한 정도 → 만들어 내는 꼴 먼저(간격이 벌어진 단위) → 난도 맞음. 새것: 진도 순 → 난도 맞음(예상 성공 0.8 근처).
  //   따뜻하게 · 가볍게: 흐려진 정도(0.02 단위) → 가장 오래 안 본 것.
  const group = row => (row.tier <= 2 ? 0 : row.tier === 9 ? 2 : 1), bucket = value => Math.round(value * 50);
  const within = (a, b) => (a.tier === 3 || a.tier === 4 ? bucket(b.need) - bucket(a.need) || a.last - b.last : b.need - a.need || b.promote - a.promote || b.fit - a.fit);
  rows.sort((a, b) => group(a) - group(b) || a.repeat - b.repeat || a.tier - b.tier || within(a, b) || a.tie - b.tie);
  // 돌아온 것이 이어지면 셋에 하나는 새것을 끼운다(한도 안에서).
  if (rows.length && rows[0].tier === 1 && session.sinceNew >= params.interleave) {
    const index = rows.findIndex(row => row.tier === 2 && !row.repeat);
    if (index > 0) rows.unshift(...rows.splice(index, 1));
  }
  const pending = [...session.retries.values()].some(r => r.pending);
  if (rows.length) {
    rows[0].idle = rows[0].tier >= 3 && !pending; rows[0].none = rows[0].tier === 9; rows[0].capped = capped && backlog > 0; rows[0].backlog = backlog;
    if (rows[0].idle && rows[0].capped) rows[0].why = { code: 'day.capped', slots: {} }; // 다 만난 것이 아니라 하루 상한에 걸린 것이다
  }
  // 숨 고르기: 이어서 놓친 뒤에는 「다시」나 새것보다 잘 떠올릴 수 있는 것(이 자리에서 아직 안 만난 아는 단위) 하나를 먼저 낸다.
  // 그런 것이 없으면 그대로 간다. 다시 낼 것은 그 뒤에 온다.
  if (rows.length && session.missStreak >= params.breatherAfter && (rows[0].tier === 0 || rows[0].tier === 2 || (rows[0].tier === 1 && rows[0].p < params.breatherSuccess))) {
    const easy = rows.findIndex(row => row.rested && !row.repeat);
    if (easy > 0) {
      const [row] = rows.splice(easy, 1);
      rows.unshift({ ...row, breather: true, idle: false, none: false, backlog, why: { code: 'pace.breather', slots: { unit: unitsOf(row.item)[0], misses: session.missStreak } } });
    }
  }
  return rows;
}

export function present(learner, row) {
  const session = learner.session;
  if (row.tier === 1) { session.sinceNew += 1; learner.day.reviews += 1; }
  if (row.fresh) { session.newUnits += row.fresh; learner.day.newUnits += row.fresh; session.sinceNew = 0; } // 새 단위는 어느 층의 문항으로 만나든 한도에 센다
  if (row.tier === 2) learner.level.set(row.item.skillId, row.item.difficulty);
}

// 이유 문장(한국어 한 벌만 — 실제 구현은 종류 × 언어 × 눈높이 × 말하는 사람 표에서 고른다).
export function reasonLine(why, label = id => id) {
  const s = why.slots, name = s.unit ? label(s.unit) : s.skill ? label(s.skill) : '';
  switch (why.code) {
    case 'unit.retry': return s.other ? `방금 놓친 「${name}」, 다른 문제로 한 번 더 만나요.` : `방금 놓친 「${name}」, 한 번 더 만나요.`;
    case 'unit.shaky': return s.reviews === 1 ? `지난번에 놓친 「${name}」, ${s.days}일 만에 다시 만나요.` : `「${name}」 ${s.reviews}번 중 ${s.misses}번 놓쳤어요. ${s.days}일 만에 다시 만나요.`;
    case 'unit.due': return `「${name}」 본 지 ${s.days}일 됐어요. 잊기 전에 한 번 더 만나요.`;
    case 'skill.up': return `「${name}」 ${s.streak}번 이어서 혼자 맞혔어요. 한 단계 올려 볼게요.`;
    case 'skill.ease': return `「${name}」 조금 쉬운 것부터 다시 잡아 볼게요.`;
    case 'unit.new': return `「${name}」 처음 만나요.`;
    case 'pace.breather': return `${s.misses}번 이어서 놓쳤어요. 잘 아는 「${name}」로 숨을 고르고 가요.`;
    case 'day.capped': return '오늘은 여기까지예요. 남은 것은 내일 만나요.';
    default: return '오늘 돌아온 것은 다 만났어요. 가볍게 이어가요.';
  }
}
