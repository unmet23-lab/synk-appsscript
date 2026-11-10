// Atlas 재설계 — 새 두뇌의 시제품 6판(설계 검증용, 제품 코드 아님). 설계 검토 네 번(아르곤 · 아스트라)과 구조 검토 한 번(Fable) 뒤 고친 판 — 2026-11-10.
// 세 부품: ① 기억(낱말 · 문형 · 문항 계열마다 FSRS 상태) ② 작업 난도(능력마다 θ) ③ 고르기(다시 → 돌아옴 → 새것 → 채우기) + 이유(종류 + 근거 칸).
// 순수 함수와 작은 상태 객체뿐이다. 저장 · 화면 · 네트워크는 없다. 같은 입력과 씨앗이면 같은 결과가 나온다.
// 상태는 모두 사건에서 다시 만들 수 있다: 단위 기억 = 그 단위의 근거 줄을 시각 순으로 접은 값, 작업 난도 = 그 능력의 답 줄을 시각 순으로 접은 값,
// 「처음 본 계열」 = 그 계열의 가장 이른 만남. 어느 계산도 다른 단위 · 다른 능력의 그때 상태를 읽지 않는다.
// 길은 둘로 갈라 둔다 — 서버는 사건에서 처음부터 접고(foldServer), 기기는 요약 줄에 내 사건을 얹거나 기다린다(applyOwn · overlay). 한 함수가 둘을 가르지 않는다.

export const PARAMS = Object.freeze({
  version: 'brain-proto-6',
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
  dayStartHour: 4, // 하루는 기기의 현지 시각으로 새벽 4시에 넘어간다 — 자정 넘어 이어 하는 사람의 하루가 끊기지 않게(시제품은 now를 현지 시각으로 본다)
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
// 시각 순. 시각이 같으면 한 번 매겨지면 바뀌지 않는 번호 순 — 설계서에서는 서버가 받은 차례 번호이고, 시제품에서는 사건 번호가 그 구실을 한다. 번호가 없으면 받은 차례.
const byTime = (a, b) => a.at - b.at || (a.id != null && b.id != null && a.id !== b.id ? (a.id < b.id ? -1 : 1) : a.i - b.i);

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
  // 「다시 배울래요」로 비운 줄도 비운 시각(latestAt)을 남긴다 — 그보다 이른 답이 늦게 오면 이어 붙이지 않고 처음부터 다시 접어야 하기 때문이다.
  function append(state, answer) {
    if (answer.say === 'relearn') return { empty: true, latestAt: answer.at };
    const had = state && !state.empty ? state : null;
    if (answer.say === 'known') return build(null, { at: answer.at, grade: 'known' }, { sittings: had?.sittings ?? 0, lapses: had?.lapses ?? 0, firstAt: had?.firstAt ?? answer.at });
    const miss = answer.grade === 'again' ? 1 : 0;
    if (!had) return build(null, { at: answer.at, grade: answer.grade }, { sittings: 1, lapses: miss, firstAt: answer.at });
    const counts = { sittings: had.sittings, lapses: had.lapses + miss, firstAt: had.firstAt };
    if (had.open.grade === 'known') { // 「이미 알아요」는 자리가 아니다: 그 뒤의 첫 답이 새 자리를 연다
      if (miss) return build(null, { at: answer.at, grade: 'again' }, { ...counts, sittings: had.sittings + 1 });
      return build({ stability: had.stability, difficulty: had.difficulty, lastAt: had.lastAt, known: true }, { at: answer.at, grade: answer.grade }, { ...counts, sittings: had.sittings + 1 });
    }
    if (answer.at - had.open.at < params.sittingHours * HOUR) { // 같은 자리: 놓친 적이 있으면 놓침, 아니면 첫 성공의 등급
      if (!miss || had.open.grade === 'again') return { ...had, latestAt: answer.at };
      // 맞힘을 물리고 앞 상태에서 놓침으로 다시 계산한다. 앞 상태가 「이미 알아요」였으면 처음 놓친 단위처럼 시작한다.
      return { ...build(had.prev?.known ? null : had.prev, { at: had.open.at, grade: 'again' }, counts), latestAt: answer.at };
    }
    return build({ stability: had.stability, difficulty: had.difficulty, lastAt: had.lastAt }, { at: answer.at, grade: answer.grade }, { ...counts, sittings: had.sittings + 1 });
  }
  const has = state => Boolean(state) && !state.empty; // 기억이 있는가(없거나 「다시 배울래요」로 비운 줄이 아닌가)
  // 요약의 줄에 이어 붙일 수 있는가: 그 줄의 마지막 사건보다 뒤인 답만. 그보다 이른 답은 가운데 끼워야 해서 그 단위의 근거 줄 전체(fold)가 있어야 한다 —
  // 서버에는 있고 기기에는 없다. 그래서 기기는 그런 답을 얹지 않고 올리기만 하며, 서버가 다시 접은 요약을 기다린다.
  const canAppend = (state, at) => !state || at > state.latestAt; // 같은 시각이면 사건 번호로 차례를 정해야 하므로 이어 붙이지 않는다
  const retrievability = (state, now) => (has(state) ? Number(f.forgetting_curve(days(state.lastAt, now), state.stability)) : null);
  const inSitting = (state, now) => has(state) && state.open.grade !== 'known' && now - state.open.at < params.sittingHours * HOUR;
  return {
    append, has, canAppend,
    // 한 기억 단위의 답 열을 시각 순으로 접는다.
    fold: answers => answers.filter(r => Number.isFinite(r.at) && (['again', 'hard', 'weak', 'good'].includes(r.grade) || ['known', 'relearn'].includes(r.say))).map((r, i) => ({ ...r, i })).sort(byTime).reduce(append, null),
    retrievability, inSitting,
    // 돌아옴: 떠올릴 확률이 목표 아래로 내려왔다(안정도 상한 때문에 60일이면 반드시 내려온다). 같은 자리 안에서는 돌아온 것으로 치지 않는다
    // (그 자리의 답은 이미 하나로 적혔다 — 놓친 것은 그 자리가 지난 뒤, 그날 저녁이나 다음 날 돌아온다).
    isDue: (state, now) => has(state) && !inSitting(state, now) && retrievability(state, now) < params.retention,
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
// 그 능력의 답 줄을 시각 순으로 접은 값이다 — θ와 답 수는 측정 답에만 움직이고, 이어서 혼자 맞힌 수는 그 능력의 어떤 답에서든 끊길 수 있어 답 줄 전체를 읽는다.
// 단위 기억의 상태는 읽지 않는다(읽으면 한 단위의 늦은 답이 다른 능력 값까지 흔든다).
// 기기는 요약의 (θ, 답 수, 이어서 맞힌 수)에 자기 새 답을 이어 붙이고, 가운데 끼는 답이 오면 서버가 그 능력만 처음부터 다시 접는다.
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

// ── 사건과 근거 줄 ────────────────────────────────────────────────────────────
// 문항이 묻는 단위(정답을 내려면 꼭 떠올려야 하는 것). 첫째가 주 단위다. 태그가 없으면 문항 계열이 곧 기억 단위다.
export const unitsOf = item => (item.kcIds?.length ? item.kcIds : [`family:${item.familyKey}`]);

// 시제품의 사건 다섯.
//   답           { kind: 'answer', id, at, item, answer: { correct, assisted, answerShown, unknown, assessable, target } }
//   도움만 봄    { kind: 'help', id, at, item } — 답 없이 나갔다
//   본인 말      { kind: 'say', id, at, unit, say: 'known' | 'relearn' }
//   제외         { kind: 'exclude', id, at, ref, touches } — 답이나 본인 말 하나를 거둔다. touches = 그 사건이 적힌 줄(만들 때 기기가 적어 둔다)
//   옮겨 온 장부 { kind: 'carry', id, at, families, after } — 옛 기기의 접힌 기록에 새로 든 계열들과, 앞 장부를 뜬 때(처음이면 없음)
// 보이기만 하고 답도 도움도 없이 닫은 제시는 여기 없다 — 만남이 아니다. 만남은 답했거나(판정 못 한 답도) 답을 봤거나 도움을 받은 것이다(지금 측정 계약 그대로).
//
// 접기의 재료는 둘뿐이다.
//   ① 단위마다의 근거 줄 — 답(성공은 문항이 묻는 모든 단위에, 실패는 사건에 적힌 겨눈 단위 하나에)과 본인 말.
//   ② 계열마다의 만남 표 — 답과 도움. 판정 못 한 답과 거둔 답도 남는다(제외는 줄을 뺄 뿐 만났다는 사실은 지우지 않는다).
//      옮겨 온 장부의 계열은 「앞 장부를 뜬 때」의 만남이다(처음 옮기는 장부면 어떤 만남보다 먼저다).
// 받은 차례는 쓰지 않는다. 시각 순(같으면 사건 번호 순)으로 놓고 본다.
const creditedOf = (item, answer, grade) => { const units = unitsOf(item); return grade === 'again' ? [answer.target && units.includes(answer.target) ? answer.target : units[0]] : units; };
// 만남 하나. unaided = 도움(힌트 · 답 보기) 없이 낸 답인가 — 도움만 보고 나간 것과 도움을 받은 답은 false다.
const markOf = (event, grade) => ({ id: event.id, at: event.at, skillId: event.item.skillId, difficulty: event.item.difficulty, responseFormat: event.item.responseFormat, grade,
  unaided: event.kind === 'answer' && event.answer.assisted !== true && event.answer.answerShown !== true });
export function evidenceOf(events) {
  const gone = new Set(events.filter(event => event.kind === 'exclude').map(event => event.ref)), rows = new Map(), marks = new Map();
  const push = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };
  for (const event of [...events].sort(byTime)) {
    if (event.kind === 'say') { if (!gone.has(event.id)) push(rows, event.unit, { id: event.id, at: event.at, say: event.say }); continue; }
    // 옮겨 온 장부: 그 계열들을 「장부에 접혀 있던 만남」으로 적는다. 그 만남의 시각은 앞 장부를 뜬 때(event.after)다 — 처음 옮기는 장부면 맨 앞(−∞).
    // 앞 장부를 뜬 때보다 이른 답은 그때 이미 사건으로 옮겨져 있던 것이라 그대로 첫 만남이고(나중 장부가 그 자격을 거두지 않는다), 그 뒤의 답은 장부에 접힌 만남보다 늦다.
    if (event.kind === 'carry') { for (const key of event.families) push(marks, key, { id: event.id, at: event.after ?? -Infinity, carried: true, grade: null, unaided: true, skillId: null }); continue; }
    if (event.kind !== 'answer' && event.kind !== 'help') continue;
    const grade = event.kind === 'help' || gone.has(event.id) ? null : gradeOf({ ...event.answer, responseFormat: event.item.responseFormat });
    push(marks, event.item.familyKey, markOf(event, grade));
    if (grade != null) for (const unit of creditedOf(event.item, event.answer, grade)) push(rows, unit, { id: event.id, at: event.at, grade });
  }
  for (const list of marks.values()) list.sort(byTime);
  return { rows, marks };
}

// ── 서버: 닿은 것을 근거 줄에서 처음부터 접는다 ──────────────────────────────────
// 서버에는 이어 붙이는 길이 없다 — 제 차례로 온 답이든 늦게 온 답이든, 제외든 본인 말이든 길이 하나다.
// 시제품은 「닿은 것」을 가리지 않고 전부 접는다. 줄마다 그 줄의 재료만 읽으므로(다른 단위 · 다른 능력의 상태를 읽지 않는다) 닿은 것만 다시 접어도 값이 같다.
// 돌려주는 것이 곧 요약이다 — 단위 줄, 능력 줄, 만난 표(계열마다 첫 만남 시각).
export function foldServer(events, memory, params = PARAMS) {
  const { rows, marks } = evidenceOf(events);
  const summary = { memory: new Map(), ability: new Map(), met: new Map() }, bySkill = new Map();
  for (const [unit, list] of rows) summary.memory.set(unit, memory.fold(list));
  for (const [key, list] of marks) {
    summary.met.set(key, list[0].at); // 첫 만남 = 그 계열의 가장 이른 만남(장부에 접혀 있던 만남도)
    list.forEach((mark, index) => {
      // 능력 줄에 서는 것: 판정된 답과, 도움을 받은 흔적(판정되지 않았어도 「이어서 혼자 맞힌 수」를 끊는다). 장부의 만남과 도움 없는 판정 못 한 답은 서지 않는다.
      if (mark.carried || (mark.grade == null && mark.unaided)) return;
      if (!bySkill.has(mark.skillId)) bySkill.set(mark.skillId, []);
      bySkill.get(mark.skillId).push({ ...mark, lead: index === 0 });
    });
  }
  for (const [id, list] of bySkill) summary.ability.set(id, abilityOf(list, params));
  return summary;
}

// ── 기기: 요약 줄에 내 사건을 얹는다 ───────────────────────────────────────────
// 기기는 근거 줄을 다 들고 있지 않다. 그래서 얹을 수 있는 것만 얹고, 나머지는 올리기만 한 채 서버가 다시 접은 요약을 기다린다 — 서버와 다른 값을 지어내지 않는다.
//   단위 줄: 그 줄의 마지막 사건보다 뒤인 답 · 본인 말만.
//   능력 줄: 그 줄의 마지막 사건보다 뒤이고, 그 답이 그 계열의 첫 만남인지 알 수 있을 때만. 만난 적 없는 계열이면 첫 만남이고,
//            만난 표의 첫 만남 시각이 내 답보다 앞이면 첫 만남이 아니다. 내 답이 그 시각보다 앞이면(다른 기기의 뒤 답이 먼저 접혔다)
//            첫 만남이 내 쪽으로 바뀌므로 그 계열의 문항이 속한 능력은 기다린다.
//   기다리기 시작한 줄은 요약 값으로 돌려놓고 요약이 올 때까지 기다린다(앞 사건을 건너뛰고 뒤 사건만 얹지 않는다).
// 학습자 보관함이 곧 기기의 보기다 — 요약에서 받은 줄(memory · ability · met) 위에 얹은 값과, 기다리는 줄(waitUnits · waitSkills · waitAll).
export function createLearner(summary = null) {
  return { base: summary, memory: new Map(summary?.memory), ability: new Map(summary?.ability), met: new Map(summary?.met), waitUnits: new Set(), waitSkills: new Set(), waitAll: false,
    shown: [], log: [], level: new Map(), day: null, session: null, seq: 0 };
}
const restore = (map, key, base) => { if (base?.has(key)) map.set(key, base.get(key)); else map.delete(key); };
const waitUnit = (view, unit) => { view.waitUnits.add(unit); restore(view.memory, unit, view.base?.memory); };
const waitSkill = (view, id) => { view.waitSkills.add(id); restore(view.ability, id, view.base?.ability); };
// 어느 줄에 닿는지 알 수 없는 사건이 밀려 있으면 아무것도 얹지 않는다 — 요약 그대로 두고 서버가 다시 접은 요약을 기다린다.
const waitEverything = view => { view.waitAll = true; view.memory = new Map(view.base?.memory); view.ability = new Map(view.base?.ability); view.met = new Map(view.base?.met); };
// 사건 하나가 적히는 줄(단위 · 능력). 제외를 만들 때 기기가 이것을 대기열의 그 제외 옆에 적어 둔다 — 부모 사건이 기기에서 사라진 뒤에도 어느 줄을 기다릴지 알 수 있게.
export function touchedBy(event) {
  if (event.kind === 'say') return { units: [event.unit], skills: [] };
  if (event.kind !== 'answer') return { units: [], skills: [] };
  const grade = gradeOf({ ...event.answer, responseFormat: event.item.responseFormat });
  return grade == null ? { units: [], skills: [] } : { units: creditedOf(event.item, event.answer, grade), skills: [event.item.skillId] };
}
// 그 계열을 만났다고 적는다. 돌려주는 값 = 이 만남이 그 계열의 첫 만남인가(기기가 아는 만큼).
function meet(view, family, at, skills) {
  const known = view.met.get(family), lead = known === undefined;
  if (!lead && at <= known) for (const id of skills) waitSkill(view, id); // 첫 만남이 내 쪽으로 바뀐다 — 앞서 첫 만남으로 센 답이 있을 수 있다
  if (lead || at < known) view.met.set(family, at);
  return lead;
}
// 내 사건 하나를 얹는다. index.familySkills = 계열 → 그 계열의 문항이 속한 능력들(문항 색인). 없으면 그 문항의 능력만 안다.
export function applyOwn(view, event, memory, params = PARAMS, index = null) {
  if (event.kind === 'say') {
    if (view.waitUnits.has(event.unit) || !memory.canAppend(view.memory.get(event.unit), event.at)) waitUnit(view, event.unit);
    else view.memory.set(event.unit, memory.append(view.memory.get(event.unit), { id: event.id, at: event.at, say: event.say }));
    return {};
  }
  if (event.kind === 'carry') { // 옮겨 온 장부: 그 계열들에 「앞 장부를 뜬 때(처음이면 맨 앞)의 만남」이 생긴다 — 그보다 늦은 답을 첫 만남으로 센 능력은 기다린다
    for (const key of event.families) meet(view, key, event.after ?? -Infinity, index?.familySkills?.get(key) || []);
    return {};
  }
  const item = event.item, grade = event.kind === 'answer' && !event.gone ? gradeOf({ ...event.answer, responseFormat: item.responseFormat }) : null, mark = markOf(event, grade);
  const lead = meet(view, item.familyKey, event.at, index?.familySkills?.get(item.familyKey) || [item.skillId]);
  if (grade == null && mark.unaided) return { grade, lead }; // 판정 못 한 답 · 거둔 답: 만남만 남는다
  const skill = view.ability.get(item.skillId) || EMPTY_SKILL;
  if (view.waitSkills.has(item.skillId) || !(event.at > skill.lastAt)) waitSkill(view, item.skillId);
  else view.ability.set(item.skillId, stepSkill(skill, { ...mark, lead }, params));
  if (grade == null) return { grade, lead }; // 도움만 본 것 · 도움을 받았지만 판정 못 한 답: 「이어서 혼자 맞힌 수」만 끊긴다
  const credited = creditedOf(item, event.answer, grade);
  for (const unit of credited) {
    if (view.waitUnits.has(unit) || !memory.canAppend(view.memory.get(unit), event.at)) waitUnit(view, unit);
    else view.memory.set(unit, memory.append(view.memory.get(unit), { id: event.id, at: event.at, grade }));
  }
  return { grade, lead, credited };
}
// 요약 위에, 아직 요약에 들지 않은 내 사건들을 시각 순으로 얹는다.
// index.lookup(번호) = 이 기기가 든 최근 사건에서 찾는다(이미 접힌 내 사건도 이틀 동안 든다).
export function overlay(summary, pending, memory, params = PARAMS, index = null) {
  const view = createLearner(summary), mine = new Set(pending.map(event => event.id));
  const gone = new Set(pending.filter(event => event.kind === 'exclude').map(event => event.ref));
  for (const event of [...pending].sort(byTime)) {
    if (event.kind === 'exclude') {
      // 아직 요약에 들지 않은 내 사건을 거두는 것은 그 사건을 얹지 않으면 된다(아래). 이미 접힌 사건의 제외는 얹을 수 없다 — 그 사건이 적힌 줄은 기다린다.
      // 닿는 줄은 기기에 남은 부모 사건에서 읽거나, 제외를 만들 때 적어 둔 것(event.touches)에서 읽는다. 둘 다 없으면 어느 줄인지 모르므로 아무것도 얹지 않는다.
      if (mine.has(event.ref)) continue;
      const target = index?.lookup?.(event.ref), touched = target ? touchedBy(target) : event.touches;
      if (!touched) { waitEverything(view); break; }
      for (const unit of touched.units) waitUnit(view, unit);
      for (const id of touched.skills) waitSkill(view, id);
      continue;
    }
    if (!gone.has(event.id)) applyOwn(view, event, memory, params, index);
    else if (event.kind === 'answer') applyOwn(view, { ...event, gone: true }, memory, params, index); // 거둔 답은 만남으로만 남는다(거둔 말은 없던 것이 된다)
  }
  return view;
}

// ── 한 판 안에서(기기) ─────────────────────────────────────────────────────────
// 예상 성공 확률 = 찍기 바닥 + (1 − 찍기 바닥) × 기억 항 × 능력 항.
//   기억 항: 상태가 있는 단위들의 떠올릴 확률의 곱.
//   능력 항: 처음 보는 계열이거나 처음 만나는 단위가 있으면 능력 대 난도, 다 만나 본 문항을 다시 만나면 1(그 문항의 기억이 지배한다).
export function predict(item, learner, memory, now, params = PARAMS) {
  const g = params.guess[item.responseFormat] ?? params.guess.unknown, b = params.difficultyLogit[item.difficulty] ?? 0;
  let recall = 1, missing = false;
  for (const unit of unitsOf(item)) { const r = memory.retrievability(learner.memory.get(unit), now); if (r == null) missing = true; else recall *= r; }
  const skill = missing || !learner.met.has(item.familyKey) ? sigmoid((learner.ability.get(item.skillId)?.theta ?? 0) - b) : 1;
  return g + (1 - g) * recall * skill;
}

// 하루의 열쇠. 한도(새 단위 · 복습)만 이 경계를 쓴다 — 기억 계산은 달력을 보지 않고 실제 지난 시간으로 센다.
export const dayKey = (now, params = PARAMS) => Math.floor((now - params.dayStartHour * HOUR) / DAY);
// 판을 연다. more = 본인이 「더 배우기」를 골랐다(이 판은 새것 한도를 넘어도 새것으로 낸다).
// 하루의 한도는 「낸 것」 기록에서 센다 — 오늘 처음 낸 단위들과 돌아온 것으로 낸 문항 수. 메모리에 든 값을 믿지 않으므로 앱을 다시 켜도 이어지고,
// 다른 기기에서 낸 것도 요약의 「낸 것」 표로 오면 같이 센다. 한 번 센 단위는 다시 세지 않는다(놓쳐서 기억이 아직 없어도, 판정 못 한 답이었어도).
export function startSession(learner, now = 0, params = PARAMS, { more = false } = {}) {
  const key = dayKey(now, params), today = learner.log.filter(entry => dayKey(entry.at, params) === key);
  learner.day = { key, reviews: today.filter(entry => entry.review).length, introduced: new Set(today.flatMap(entry => entry.units)) };
  learner.session = { start: learner.shown.length, introduced: new Set(), sinceNew: 0, missStreak: 0, more, retries: new Map(), met: new Set(), blank: new Set() };
  return params;
}

// 답 하나를 받는다: 내 사건으로 요약 줄에 얹고(applyOwn), 이 판의 상태(다시 낼 것 · 이 판에서 만난 단위 · 이어서 놓친 수)를 고친다.
// 성공은 문항이 묻는 모든 단위에, 실패는 그 문항이 겨눈 단위 하나에 적힌다 — 겨눈 단위(answer.target)는 문항을 보일 때 사건에 적힌 값이다. 없으면 주 단위다.
export function record(learner, memory, item, answer, now, params = PARAMS) {
  if (!learner.session) startSession(learner, now, params);
  const session = learner.session, units = unitsOf(item);
  learner.shown.push({ family: item.familyKey, units, at: now });
  const { grade, lead, credited } = applyOwn(learner, { kind: 'answer', id: answer.id ?? `own-${(learner.seq += 1)}`, at: now, item, answer }, memory, params);
  // 판정 못 한 답(소리가 안 났다 · 건너뛰었다)은 기억에 적지 않고, 그 단위를 「이 판에서 만났다」고도 치지 않는다.
  // 그 문항은 이 판에서 다시 내지 않는다 — 소리가 안 나는 문항이 판을 붙잡지 않게(같은 단위의 다른 문항은 낼 수 있다).
  if (grade == null) { session.blank.add(item.id); return { grade, first: lead }; }
  for (const unit of units) session.met.add(unit);
  session.missStreak = grade === 'again' ? session.missStreak + 1 : 0;
  if (grade === 'again') {
    const prior = session.retries.get(credited[0]), tries = prior ? prior.tries + 1 : 0;
    session.retries.set(credited[0], { position: learner.shown.length, family: item.familyKey, tries, pending: tries < params.retryMax });
  } else for (const unit of units) { const retry = session.retries.get(unit); if (retry) retry.pending = false; }
  return { grade, first: lead, credited };
}

// 본인 말: 「이미 알아요」(known) · 「다시 배울래요」(relearn). 그 단위의 줄에 얹고, 이 판에서 다시 낼 차례를 기다리던 것도 거둔다.
export function say(learner, memory, unit, kind, now) {
  applyOwn(learner, { kind: 'say', id: `own-${(learner.seq += 1)}`, at: now, unit, say: kind }, memory);
  learner.session?.retries.delete(unit); // 본인 말이 그 단위의 기억을 바꿨으므로 이 판의 「다시」도 거둔다
  return learner.memory.get(unit);
}

// ── ③ 고르기와 이유 ───────────────────────────────────────────────────────────
// 할 것: 0 다시(이 판에서 놓친 것, 다른 문항 둘 뒤, 단위당 두 번까지) · 1 돌아옴 · 2 새것(진도 순, 한 판 · 하루 한도 안).
// 채우기(판 길이가 정해진 게임이 할 것 없이 이어 갈 때): 3 따뜻하게(아는 것 가운데 흐려지기 시작한 것) · 4 가볍게(나머지 아는 것, 가장 오래 안 본 것부터)
//   · 5 다시 낼 차례를 기다리는 것(차례를 당겨 낸다).
// 내지 않는 것(9): 이 판의 「다시」를 다 쓴 단위, 한도를 넘는 새 단위가 든 문항(본인이 「더 배우기」를 고른 판에서는 2층),
//   하루 복습 상한에 걸린 날의 돌아온 단위, 이 판에서 판정하지 못한 문항. 이것뿐이면 none이다.
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
    const units = unitsOf(item), states = units.map(unit => { const state = learner.memory.get(unit); return memory.has(state) ? state : null; });
    const p = predict(item, learner, memory, now, params), fit = 1 - Math.abs(p - params.targetSuccess);
    const retryOf = unit => session.retries.get(unit);
    const unseen = units.filter((unit, i) => !states[i]);
    // 한도에 셀 새 단위. 하루 한도에는 오늘 아직 낸 적 없는 단위(brandNew)를, 한 판 한도에는 이 판에서 아직 낸 적 없는 기억 없는 단위(firstHere)를 센다 —
    // 어느 쪽이든 한 번 센 단위는 다시 세지 않는다. 오늘 앞 판에서 냈지만 아직 기억이 없는 단위는 하루에는 다시 세지 않고, 이 판의 한도에는 센다.
    const brandNew = unseen.filter(unit => !learner.day.introduced.has(unit)), fresh = brandNew.length, firstHere = unseen.filter(unit => !session.introduced.has(unit));
    // 밀린 것이 많으면 살릴 수 있는 것부터(떠올릴 확률이 높은 단위), 아니면 급한 것부터(낮은 단위).
    const due = units.map((unit, i) => [unit, states[i]]).filter(([unit, state]) => state && dueNow(unit)).map(([unit, state]) => [unit, state, memory.retrievability(state, now)]).sort((a, b) => (rescue ? b[2] - a[2] : a[2] - b[2]));
    // ① 내지 않을 까닭 — 넷뿐이다. 문항 안의 어느 단위든 걸리면 그 문항은 이 판에서 어느 층으로도 내지 않는다.
    const spent = units.some(unit => { const r = retryOf(unit); return r && !r.pending && r.tries >= params.retryMax; }); // 이 판의 「다시」를 다 쓴 단위
    const over = !session.more && (session.introduced.size + firstHere.length > params.newPerSession || learner.day.introduced.size + fresh > params.newPerDay); // 한도를 넘는 새 단위(모든 층에 건다)
    const held = due.length > 0 && capped; // 하루 복습 상한에 걸린 날의 돌아온 단위(그날 채우기에도 쓰지 않는다)
    const blank = session.blank.has(item.id); // 이 판에서 판정하지 못한 문항(같은 계열의 다른 문항은 낼 수 있다)
    const blocked = spent || over || held || blank;
    // ② 겨눌 단위 — 층은 겨눈 단위가 정한다. 차례: 다시 낼 차례를 기다리는 단위(5층 — 다른 후보가 없을 때만 차례를 당겨 낸다) → 다시 낼 단위(0층, 문항 둘이 지난 뒤)
    //    → 돌아온 단위(1층) → 처음 만나는 단위(2층). 겨눌 단위가 없으면 채우기(3 · 4층)다. 놓치면 실패가 겨눈 단위에 적히고, 「다시」였으면 다시 낸 횟수가 는다.
    const again = units.filter(unit => retryOf(unit)?.pending).sort((a, b) => retryOf(a).position - retryOf(b).position); // 놓친 순서
    const waiting = again.find(unit => learner.shown.length - retryOf(unit).position < params.retryGap);
    const ready = again.find(unit => learner.shown.length - retryOf(unit).position >= params.retryGap);
    const aim = blocked ? null : waiting ? [5, waiting] : ready ? [0, ready] : due.length ? [1, due[0][0]] : unseen.length ? [2, unseen[0]] : null;
    let tier = blocked ? 9 : aim ? aim[0] : 4, need = 0, promote = 0, why = { code: 'keep.warm', slots: {} };
    const target = aim ? aim[1] : null;
    if (blocked) need = -(item.order ?? 0);
    else if (tier === 0 || tier === 5) {
      const asked = retryOf(target), state = learner.memory.get(target);
      need = 1 + (item.familyKey !== asked.family ? 0.5 : 0) - asked.position / 1e6; // 같은 것을 다른 문항으로 만날 수 있으면 그쪽 먼저, 그 안에서는 놓친 순서
      why = { code: 'unit.retry', slots: { unit: target, misses: state?.lapses ?? 0, reviews: state?.sittings ?? 0, other: item.familyKey !== asked.family } };
    } else if (tier === 1) {
      const [, state, r] = due[0];
      need = rescue ? r : 1 - r / params.retention; // 급한 정도: 떠올릴 확률이 목표에서 멀수록 먼저
      promote = PRODUCED.includes(item.responseFormat) && state.stability >= params.promoteAtDays ? 1 : 0;
      const elapsed = Math.max(1, Math.round((now - state.lastAt) / DAY));
      why = state.lapses > 0 ? { code: 'unit.shaky', slots: { unit: target, misses: state.lapses, reviews: state.sittings, days: elapsed } } : { code: 'unit.due', slots: { unit: target, days: elapsed } };
    } else if (tier === 2) {
      need = -(item.order ?? 0); // 새것은 제품이 정한 진도 순(같은 묶음 안에서는 난도 맞음으로 고른다)
      const previous = learner.level.get(item.skillId), ability = learner.ability.get(item.skillId);
      // 이유가 능력 이야기여도 겨눈 단위는 근거 칸에 늘 싣는다 — 서버는 사건만 보고 실패를 적을 단위를 알아야 한다.
      why = previous != null && item.difficulty > previous && (ability?.streak || 0) >= 2 ? { code: 'skill.up', slots: { skill: item.skillId, unit: target, streak: ability.streak, from: previous, to: item.difficulty } }
        : previous != null && item.difficulty < previous && ability?.n > 0 && ability.streak === 0 ? { code: 'skill.ease', slots: { skill: item.skillId, unit: target, from: previous, to: item.difficulty } }
        : { code: 'unit.new', slots: { unit: target } };
    } else {
      // 채우기: 이 판에서 만났거나 아직 같은 자리 안인 단위는 「따뜻하게」에 들지 않는다(그 자리의 답은 이미 적혔다).
      need = Math.max(...units.map((unit, i) => (session.met.has(unit) || memory.inSitting(states[i], now) ? 0 : 1 - memory.retrievability(states[i], now))));
      if (need >= 0.03) tier = 3;
    }
    const repeat = recent.has(item.familyKey) ? 1 : 0;
    // 숨 고르기에 쓸 수 있나: 다 아는 단위이고, 이 자리에서 아직 안 만났고, 떠올릴 확률이 목표 이상이다(찍기 바닥이 섞인 예상 성공이 아니라 기억만 본다).
    const rested = !blocked && !unseen.length && units.every((unit, i) => !session.met.has(unit) && !memory.inSitting(states[i], now) && memory.retrievability(states[i], now) >= params.retention);
    rows.push({ item, at: now, tier, need, fit, p, why, target, repeat, promote, fresh, brandNew, firstHere, rested, last: lastShown.get(item.familyKey) ?? -1, tie: hash(`${seed}|${learner.shown.length}|${item.id}`) });
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
  // 기다리는 「다시」는 낼 수 있는 문항이 있을 때만 판을 붙잡는다(그 단위를 묻는 문항이 모두 「내지 않음」이면 붙잡지 않는다).
  const pending = rows.some(row => row.tier === 5);
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

// 문항을 낸다. 「낸 것」 기록(처음 낸 단위 · 돌아온 것으로 냈는가 · 시각)을 남긴다 — 하루 한도는 이 기록에서 센다(startSession).
export function present(learner, row) {
  const session = learner.session;
  learner.log.push({ at: row.at, review: row.tier === 1, units: row.fresh ? [...row.brandNew] : [] });
  if (row.tier === 1) { session.sinceNew += 1; learner.day.reviews += 1; }
  for (const unit of row.brandNew) learner.day.introduced.add(unit); // 새 단위는 어느 층의 문항으로 만나든 하루에 한 번만 센다
  for (const unit of row.firstHere) session.introduced.add(unit); // 이 판에서 처음 낸 기억 없는 단위
  if (row.tier === 2 || row.firstHere.length) session.sinceNew = 0; // 새것을 냈으면 「돌아온 것 셋에 새것 하나」를 다시 센다
  if (row.tier === 2) learner.level.set(row.item.skillId, row.item.difficulty);
}

// 이유 문장(한국어 한 벌만 — 실제 구현은 종류 × 언어 × 눈높이 × 말하는 사람 표에서 고른다).
export function reasonLine(why, label = id => id) {
  const s = why.slots, name = why.code.startsWith('skill.') ? label(s.skill) : s.unit ? label(s.unit) : '';
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
