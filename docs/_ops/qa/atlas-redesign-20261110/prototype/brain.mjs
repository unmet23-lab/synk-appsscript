// Atlas 재설계 — 새 두뇌의 시제품(설계 검증용, 제품 코드 아님).
// 세 부품: ① 기억(낱말·문형·문항 계열마다 FSRS 상태) ② 작업 난도(능력마다 θ) ③ 고르기(급한 것 → 새것 → 따뜻하게) + 이유(종류 + 근거 칸).
// 순수 함수와 작은 상태 객체뿐이다. 저장·화면·네트워크는 없다. 같은 입력과 씨앗이면 같은 결과가 나온다.

export const PARAMS = Object.freeze({
  version: 'brain-proto-1',
  retention: 0.9, // 08-22 확정값(request_retention)
  maxIntervalDays: 60, // 08-22 확정값(maximum_interval)
  targetSuccess: 0.8, // 순간 맞춤(flow)이 겨누는 0.75~0.8과 같은 자리
  guess: { 'binary-choice': 0.5, 'single-choice': 0.25, 'cup-compose': 0.05, action: 0.1, spoken: 0.02, unknown: 0.25 },
  difficultyLogit: { 1: -1, 2: 0, 3: 1 }, // 저작 난도 1·2·3의 출발값. 실측이 쌓이면 문항별 값으로 바뀐다.
  retryGap: 2, // 틀린 것은 다른 문항 둘 뒤에 다시
  newPerSession: 6, // 한 판에 새로 만나는 기억 단위 수
  avoidRecent: 2, // 바로 앞 두 문항과 같은 계열은 피한다
});

const DAY = 86400000;
const sigmoid = x => 1 / (1 + Math.exp(-x));

// ── ① 기억 ────────────────────────────────────────────────────────────────
// 한 답이 기억 단위에 주는 등급. Easy는 내지 않는다(걸린 시간 재료가 없다 — 08-22 확정 ⓒ).
// 스스로 만들어 낸 답(조립 · 말하기)만 Good이다. 고르는 꼴은 찍어서 맞힐 수 있어 약한 근거(Hard)이고(08-22 「guess → Hard」와 같은 뜻),
// 힌트를 본 정답도 Hard, 답을 보고 낸 정답은 떠올린 것이 아니므로 Again이다.
export const PRODUCED = Object.freeze(['cup-compose', 'spoken']);
export function gradeOf({ correct, assisted = false, answerShown = false, responseFormat = 'unknown', assessable = true }) {
  if (!assessable || typeof correct !== 'boolean') return null; // 소리가 안 났거나 판정 못 한 답은 근거가 아니다
  if (!correct || answerShown) return 1;
  if (assisted || !PRODUCED.includes(responseFormat)) return 2;
  return 3;
}

export function createMemory(tsfsrs, params = PARAMS) {
  const { fsrs, generatorParameters, createEmptyCard } = tsfsrs;
  const f = fsrs(generatorParameters({ request_retention: params.retention, maximum_interval: params.maxIntervalDays, enable_fuzz: false, enable_short_term: false }));
  const cap = card => {
    if (!card.last_review) return card;
    const limit = card.last_review.getTime() + params.maxIntervalDays * DAY;
    return card.due.getTime() <= limit ? card : { ...card, due: new Date(limit) };
  };
  return {
    // 사건이 정본이고 상태는 접어서 얻는 캐시다: 한 기억 단위의 복습 열을 시각 순으로 접는다.
    fold(reviews) {
      const rows = reviews.filter(r => Number.isFinite(r.at) && [1, 2, 3].includes(r.grade)).map((r, i) => ({ ...r, i })).sort((a, b) => a.at - b.at || a.i - b.i);
      if (!rows.length) return null;
      let card = createEmptyCard(new Date(rows[0].at));
      for (const r of rows) card = cap(f.next(card, new Date(r.at), r.grade).card);
      return { card, reviews: rows.length, misses: rows.filter(r => r.grade === 1).length, lastAt: rows.at(-1).at, firstAt: rows[0].at };
    },
    retrievability: (state, now) => (state ? Number(f.get_retrievability(state.card, new Date(now), false)) : null),
    dueAt: state => (state ? state.card.due.getTime() : null),
    stabilityDays: state => (state ? state.card.stability : 0),
  };
}

// ── ② 작업 난도 ─────────────────────────────────────────────────────────────
// 능력마다 θ 하나. 처음 본 문항에 혼자 낸 답으로만 움직인다(측정 계약 그대로). 어디에도 급수나 점수로 보이지 않는다.
export function updateAbility(ability = { theta: 0, n: 0 }, { correct, difficulty, responseFormat }, params = PARAMS) {
  const g = params.guess[responseFormat] ?? params.guess.unknown, b = params.difficultyLogit[difficulty] ?? 0;
  const expected = g + (1 - g) * sigmoid(ability.theta - b);
  const k = 0.25 + 0.9 / (1 + ability.n / 4); // 처음에는 크게, 답이 쌓이면 잔잔하게
  return { theta: ability.theta + k * ((correct ? 1 : 0) - expected), n: ability.n + 1 };
}

// ── 학습자 상태(시제품용 보관함) ───────────────────────────────────────────────
export function createLearner() {
  return { reviews: new Map(), memory: new Map(), ability: new Map(), seenFamilies: new Set(), shown: [], lapsed: new Map(), newThisSession: 0, lastDifficulty: new Map(), streak: new Map() };
}
export const unitsOf = item => (item.kcIds?.length ? item.kcIds : [`family:${item.familyKey}`]); // 태그가 없으면 문항 계열이 곧 기억 단위다

// 예상 성공 확률: 찍기 바닥 + (능력 대 난도) × (필요한 기억이 모두 떠오를 확률). 처음 만나는 단위는 능력 항만 쓴다.
export function predict(item, learner, memory, now, params = PARAMS) {
  const g = params.guess[item.responseFormat] ?? params.guess.unknown, b = params.difficultyLogit[item.difficulty] ?? 0;
  const theta = learner.ability.get(item.skillId)?.theta ?? 0;
  let recall = 1;
  for (const unit of unitsOf(item)) { const r = memory.retrievability(learner.memory.get(unit), now); if (r != null) recall *= r; }
  return g + (1 - g) * sigmoid(theta - b) * recall;
}

// 답 하나를 받아 상태를 고친다. 성공은 문항이 쓰는 모든 단위에, 실패는 가장 약한 단위 하나에 적는다.
export function record(learner, memory, item, answer, now, params = PARAMS) {
  const grade = gradeOf({ ...answer, responseFormat: item.responseFormat });
  const first = !learner.seenFamilies.has(item.familyKey);
  learner.seenFamilies.add(item.familyKey);
  learner.shown.push({ family: item.familyKey, units: unitsOf(item), at: now });
  if (grade == null) return { grade, first };
  const units = unitsOf(item);
  let blamed = units;
  if (grade === 1 && units.length > 1) {
    const weakest = units.map(unit => [unit, memory.retrievability(learner.memory.get(unit), now) ?? 0.5]).sort((a, b) => a[1] - b[1] || units.indexOf(a[0]) - units.indexOf(b[0]))[0][0];
    blamed = [weakest];
  }
  for (const unit of blamed) {
    const list = learner.reviews.get(unit) || [];
    list.push({ at: now, grade, family: item.familyKey });
    learner.reviews.set(unit, list);
    learner.memory.set(unit, memory.fold(list));
    if (grade === 1) learner.lapsed.set(unit, { at: now, position: learner.shown.length, family: item.familyKey, retried: false });
    else if (learner.lapsed.has(unit)) learner.lapsed.get(unit).retried = true;
  }
  if (first && answer.assisted !== true && answer.answerShown !== true) { // 측정 자격: 처음 본 계열에 혼자 낸 답
    learner.ability.set(item.skillId, updateAbility(learner.ability.get(item.skillId), { correct: answer.correct, difficulty: item.difficulty, responseFormat: item.responseFormat }, params));
    learner.streak.set(item.skillId, answer.correct ? (learner.streak.get(item.skillId) || 0) + 1 : 0);
  }
  return { grade, first, blamed };
}

// ── ③ 고르기와 이유 ───────────────────────────────────────────────────────────
// 층: 0 방금 틀린 것 다시(다른 문항 둘 뒤, 되도록 다른 문항으로) · 1 잊을 때가 된 것 · 2 새것(진도 순, 한 판 한도) · 3 따뜻하게.
const hash = text => { let h = 2166136261; for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

export function choose(candidates, learner, memory, now, { params = PARAMS, seed = 'seed' } = {}) {
  // 「방금 본 것」은 이 판 안에서만 센다(며칠 전에 본 것은 방금이 아니다).
  const recent = new Set(learner.shown.slice(Math.max(learner.sessionStart || 0, learner.shown.length - params.avoidRecent)).map(row => row.family));
  const lastShown = new Map(learner.shown.map((row, index) => [row.family, index]));
  const rows = [];
  for (const item of candidates) {
    const units = unitsOf(item), states = units.map(unit => learner.memory.get(unit));
    const p = predict(item, learner, memory, now, params), fit = 1 - Math.abs(p - params.targetSuccess);
    let tier = 3, need = 0, why = { code: 'keep.warm', slots: {} };
    const retry = units.map(unit => [unit, learner.lapsed.get(unit)]).find(([, lapse]) => lapse && !lapse.retried && learner.shown.length - lapse.position >= params.retryGap);
    const waitingRetry = units.some(unit => { const lapse = learner.lapsed.get(unit); return lapse && !lapse.retried && learner.shown.length - lapse.position < params.retryGap; });
    const unseen = units.filter((unit, i) => !states[i]);
    if (retry) {
      const state = learner.memory.get(retry[0]);
      tier = 0; need = 1 + (item.familyKey !== retry[1].family ? 0.5 : 0); // 같은 것을 다른 문항으로 만날 수 있으면 그쪽 먼저
      why = { code: 'unit.retry', slots: { unit: retry[0], misses: state.misses, reviews: state.reviews, other: item.familyKey !== retry[1].family } };
    } else if (waitingRetry) { tier = 5; } // 방금 틀린 것은 문항 둘이 지난 뒤에
    else if (unseen.length === units.length) {
      const within = learner.newThisSession < params.newPerSession;
      tier = within ? 2 : 3; // 한도를 넘긴 새것은 「따뜻하게」 층에서 흐려진 것 다음에 온다
      need = within ? -(item.order ?? 0) : 0.05; // 새것은 제품이 정한 진도 순
      const previous = learner.lastDifficulty.get(item.skillId);
      const streak = learner.streak.get(item.skillId) || 0;
      why = previous != null && item.difficulty > previous ? { code: 'skill.up', slots: { skill: item.skillId, streak, from: previous, to: item.difficulty } }
        : previous != null && item.difficulty < previous && streak === 0 ? { code: 'skill.ease', slots: { skill: item.skillId, from: previous, to: item.difficulty } }
        : { code: 'unit.new', slots: { unit: units[0] } };
    } else {
      const worst = units.map((unit, i) => [unit, states[i], memory.retrievability(states[i], now)]).filter(row => row[1]).sort((a, b) => a[2] - b[2])[0];
      const due = worst[2] < params.retention;
      if (due) {
        tier = 1; need = 1 - worst[2] / params.retention;
        const days = Math.max(1, Math.round((now - worst[1].lastAt) / DAY));
        why = worst[1].misses > 0 ? { code: 'unit.shaky', slots: { unit: worst[0], misses: worst[1].misses, reviews: worst[1].reviews, days } } : { code: 'unit.due', slots: { unit: worst[0], days } };
      } else { need = 1 - worst[2]; }
    }
    const repeat = recent.has(item.familyKey) ? 1 : 0;
    rows.push({ item, tier, need, fit, p, why, repeat, last: lastShown.get(item.familyKey) ?? -1, tie: hash(`${seed}|${learner.shown.length}|${item.id}`) });
  }
  // 층 안의 순서 — 다시·돌아온 것: 급한 정도 → 난도 맞음. 새것: 진도 순 → 지금 실력에 맞는 난도(예상 성공 0.8 근처).
  // 따뜻하게: 흐려진 정도(0.02 단위) → 가장 오래 안 본 것. 급한 것도 새것도 없으면 맨 위 줄의 idle이 참이다(제품이 판을 끝내거나 자유롭게 고른다).
  const within = (a, b) => (a.tier === 2 ? b.need - a.need || b.fit - a.fit : a.tier === 3 ? Math.round(b.need * 50) - Math.round(a.need * 50) || a.last - b.last : b.need - a.need || b.fit - a.fit);
  rows.sort((a, b) => a.repeat - b.repeat || a.tier - b.tier || within(a, b) || a.tie - b.tie);
  if (rows.length) rows[0].idle = rows[0].tier >= 3 && rows[0].need < 0.03;
  return rows;
}

export function present(learner, row) {
  if (row.tier === 2) learner.newThisSession += 1;
  learner.lastDifficulty.set(row.item.skillId, Math.max(learner.lastDifficulty.get(row.item.skillId) ?? 0, row.item.difficulty));
}
export const startSession = learner => { learner.newThisSession = 0; learner.lapsed.clear(); learner.sessionStart = learner.shown.length; };

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
    default: return '지금은 급한 것이 없어요. 가볍게 이어가요.';
  }
}
