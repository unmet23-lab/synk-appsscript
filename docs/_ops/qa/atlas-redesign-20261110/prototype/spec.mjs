// 설계서 §3-2(기억) · §3-3(작업 난도)의 글을 그대로 옮긴 일괄 계산이다. 두뇌(brain.mjs)의 접기 코드를 쓰지 않는다 —
// 임의 시험(fuzz.mjs)이 두뇌가 낸 값과 맞대 보는 독립 기준이다. 두뇌는 답을 하나씩 얹어 가고, 여기서는 글이 말하는 차례대로
// 「줄을 자리로 묶는다 → 자리마다 결과 하나 → 한 걸음씩」 계산한다. 쓰는 것은 ts-fsrs의 기억 계산(next_state)과 매개변수뿐이다.
const DAY = 86400000, HOUR = 3600000;
const order = (a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); // 시각 순, 같으면 사건 번호 순

// 답 하나의 등급(§3-2의 표).
//   판정 못 함 → 없음 · 틀림 / 「모르겠어요」 / 답을 본 뒤 맞힘 → 놓침 · 힌트를 보고 맞힘 → Hard
//   혼자 맞힘: 고르는 꼴 → 약한 성공, 만들어 내는 꼴(조립 · 말하기) → Good
export function specGrade(answer, responseFormat) {
  if (answer.assessable === false) return null;
  if (answer.unknown === true) return 'again';
  if (answer.correct !== true && answer.correct !== false) return null;
  if (answer.correct === false || answer.answerShown === true) return 'again';
  if (answer.assisted === true) return 'hard';
  return responseFormat === 'cup-compose' || responseFormat === 'spoken' ? 'good' : 'weak';
}

// 한 단위의 근거 줄(답 { at, grade } · 본인 말 { at, say })에서 기억 상태를 낸다.
export function specUnit(tsfsrs, rows, params) {
  const f = tsfsrs.fsrs(tsfsrs.generatorParameters({ request_retention: params.retention, maximum_interval: params.maxIntervalDays, enable_fuzz: false, enable_short_term: false }));
  const GRADE = { again: 1, hard: 2, good: 3 };
  const sorted = [...rows].sort(order);
  // 「다시 배울래요」는 그 시각 앞의 답을 접기에서 뺀다. 비운 줄에도 비운 시각은 남는다.
  const cleared = sorted.map(row => row.say).lastIndexOf('relearn'), kept = sorted.slice(cleared + 1);
  if (!kept.length) return cleared >= 0 ? { empty: true, latestAt: sorted[cleared].at } : null;
  // 자리로 묶는다. 자리는 그 자리의 첫 답에서 6시간 동안이다. 「이미 알아요」는 자리가 아니고, 그 뒤의 첫 답이 새 자리를 연다.
  const steps = [];
  for (const row of kept) {
    const last = steps.at(-1);
    if (row.say === 'known') steps.push({ known: row.at });
    else if (last && !('known' in last) && row.at - last.at < params.sittingHours * HOUR) last.grades.push(row.grade);
    else steps.push({ at: row.at, grades: [row.grade] });
  }
  let state = null, sittings = 0, lapses = 0, afterKnown = false;
  for (const step of steps) {
    // 「이미 알아요」: 안정도를 60일로 둔다(난이도 값은 처음 만나 Good을 낸 것과 같게).
    if ('known' in step) { state = { stability: params.maxIntervalDays, difficulty: f.next_state(null, 0, GRADE.good).difficulty, lastAt: step.known }; afterKnown = true; continue; }
    // 한 자리의 결과는 하나다 — 한 번이라도 놓쳤으면 놓침, 아니면 첫 성공의 등급.
    const result = step.grades.includes('again') ? 'again' : step.grades[0];
    sittings += 1;
    if (result === 'again') lapses += 1;
    // 「이미 알아요」 뒤의 확인 자리에서 놓치면 처음 놓친 단위와 같게 시작한다(높은 안정도를 물려받지 않는다).
    const before = afterKnown && result === 'again' ? null : state;
    const elapsed = before ? Math.max(0, (step.at - before.lastAt) / DAY) : 0; // 지난 시간은 실제 시간(날, 실수)
    const from = before ? { stability: before.stability, difficulty: before.difficulty } : null;
    let next;
    if (result !== 'weak') next = f.next_state(from, elapsed, GRADE[result]);
    else if (!from) next = f.next_state(null, 0, GRADE.hard); // 약한 성공의 첫 만남은 Hard의 출발값
    else { // 그 뒤로는 안정도를 Good이 늘렸을 만큼의 40%만 올리고, 난이도 값은 Good과 같게 갱신한다
      const good = f.next_state(from, elapsed, GRADE.good);
      next = { stability: from.stability + params.weakWeight * (good.stability - from.stability), difficulty: good.difficulty };
    }
    state = { stability: Math.min(next.stability, params.maxIntervalDays), difficulty: next.difficulty, lastAt: step.at }; // 안정도는 60일을 넘기지 않는다
    afterKnown = false;
  }
  return { ...state, sittings, lapses, firstAt: kept[0].at, latestAt: kept.at(-1).at };
}

// 한 능력의 답 줄({ at, id, grade, unaided, lead, difficulty, responseFormat })에서 작업 난도를 낸다.
//   측정 답 = 그 계열의 첫 만남이고 도움 없이 낸 답. 측정 답만 θ와 답 수를 옮긴다(답이 적을 때 크게, 쌓이면 잔잔하게).
//   이어서 혼자 맞힌 수 = 마지막으로 놓치거나 도움을 받은 줄 뒤에 있는 측정 정답의 수.
export function specSkill(rows, params) {
  const sorted = [...rows].sort(order);
  let theta = 0, n = 0;
  for (const row of sorted) {
    if (!(row.lead && row.unaided)) continue;
    const guess = params.guess[row.responseFormat] ?? params.guess.unknown, level = params.difficultyLogit[row.difficulty] ?? 0;
    const expected = guess + (1 - guess) / (1 + Math.exp(-(theta - level)));
    theta += (0.25 + 0.9 / (1 + n / 4)) * ((row.grade === 'again' ? 0 : 1) - expected);
    n += 1;
  }
  const broken = sorted.map(row => row.grade === 'again' || !row.unaided).lastIndexOf(true);
  const streak = sorted.slice(broken + 1).filter(row => row.lead && row.unaided).length;
  return { theta, n, streak, lastAt: sorted.at(-1).at };
}
