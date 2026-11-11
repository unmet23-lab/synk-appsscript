// 독립 기준 — 설계서 §3-2(기억) · §3-3(작업 난도)의 글을 그대로 옮긴 일괄 계산이다(시제품 prototype/spec.mjs를 옮겼다).
// 두뇌(src)의 접기 코드를 쓰지 않고 src를 import하지도 않는다 — 임의 시험(fold.property.test.mjs)이 두뇌가 낸 값과 맞대 보는 기준이고,
// 변형 실행기가 src를 깨뜨려도 이 기준은 그대로다. 두뇌는 답을 하나씩 얹어 가고, 여기서는 글이 말하는 차례대로
// 「줄을 자리로 묶는다 → 자리마다 결과 하나 → 한 걸음씩」 계산한다. 쓰는 것은 ts-fsrs의 기억 계산(next_state)과 매개변수뿐이다.
// 규칙을 더하거나 고칠 때는 두뇌만 고쳐서 통과시키지 않고 이 파일도 함께 고친다(설계 §11 관문 7).
import { fsrs, generatorParameters } from 'ts-fsrs';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const GRADE = Object.freeze({ again: 1, hard: 2, good: 3 });

// 시각 순, 같으면 사건 번호 순.
export const order = (a, b) => {
  if (a.at !== b.at) return a.at - b.at;
  if (a.id < b.id) return -1;
  return a.id > b.id ? 1 : 0;
};

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

const schedulerOf = params =>
  fsrs(
    generatorParameters({
      request_retention: params.retention,
      maximum_interval: params.maxIntervalDays,
      enable_fuzz: false,
      enable_short_term: false,
    }),
  );

// 자리로 묶는다. 자리는 그 자리의 첫 답에서 6시간 동안이다. 「이미 알아요」는 자리가 아니고, 그 뒤의 첫 답이 새 자리를 연다.
function sittingsOf(kept, params) {
  const steps = [];
  for (const row of kept) {
    const last = steps.at(-1);
    if (row.say === 'known') steps.push({ known: row.at });
    else if (last && !('known' in last) && row.at - last.at < params.sittingHours * HOUR)
      last.grades.push(row.grade);
    else steps.push({ at: row.at, grades: [row.grade] });
  }
  return steps;
}

// 한 자리의 결과를 앞 상태에 적용한다.
function nextOf(f, from, elapsed, result, params) {
  if (result !== 'weak') return f.next_state(from, elapsed, GRADE[result]);
  // 약한 성공의 비중이 1 이상인 비교 설정(가상 학습자에서 견줄 때)은 처음부터 Good 그대로다(GPT 끝 판 GB4)
  if (params.weakWeight >= 1) return f.next_state(from, elapsed, GRADE.good);
  if (!from) return f.next_state(null, 0, GRADE.hard); // 약한 성공의 첫 만남은 Hard의 출발값
  // 그 뒤로는 안정도를 Good이 늘렸을 만큼의 40%만 올리고, 난이도 값은 Good과 같게 갱신한다
  const good = f.next_state(from, elapsed, GRADE.good);
  return {
    stability: from.stability + params.weakWeight * (good.stability - from.stability),
    difficulty: good.difficulty,
  };
}

// 끈질긴 단위(§3-5): 최근 창에서 놓친 자리가 기준 이상이고 z = Σ(m − q) / √Σq(1 − q)가 기준 이상.
function specStubborn(recent, params) {
  const misses = recent.filter(cell => cell.m === 1).length;
  const excess = recent.reduce((sum, cell) => sum + cell.m - cell.q, 0);
  const spread = recent.reduce((sum, cell) => sum + cell.q * (1 - cell.q), 0);
  return (
    misses >= params.stubbornMisses && spread > 0 && excess / Math.sqrt(spread) >= params.stubbornZ
  );
}

// 놓친 답의 응답 꼴 — 「다시 배울래요」 뒤의 줄에서, 가나다순 · 겹침 없이.
const specMissed = kept =>
  [
    ...new Set(
      kept
        .filter(row => row.grade === 'again' && row.responseFormat)
        .map(row => row.responseFormat),
    ),
  ].sort();

// 자리 하나를 앞 상태에 적용한다.
function sitting(f, acc, step, params) {
  // 한 자리의 결과는 하나다 — 한 번이라도 놓쳤으면 놓침, 아니면 첫 성공의 등급.
  const result = step.grades.includes('again') ? 'again' : step.grades[0];
  acc.sittings += 1;
  if (result === 'again') acc.lapses += 1;
  // 「이미 알아요」 뒤의 확인 자리에서 놓치면 처음 놓친 단위와 같게 시작한다(높은 안정도를 물려받지 않는다).
  const before = acc.afterKnown && result === 'again' ? null : acc.state;
  const elapsed = before ? Math.max(0, (step.at - before.lastAt) / DAY) : 0; // 지난 시간은 실제 시간(날, 실수)
  const from = before ? { stability: before.stability, difficulty: before.difficulty } : null;
  const next = nextOf(f, from, elapsed, result, params);
  const cell = before && {
    q: 1 - Number(f.forgetting_curve(elapsed, before.stability)),
    m: result === 'again' ? 1 : 0,
  };
  acc.recent = cell ? [...acc.recent, cell].slice(-params.stubbornWindow) : [];
  // 안정도는 60일을 넘기지 않는다
  acc.state = {
    stability: Math.min(next.stability, params.maxIntervalDays),
    difficulty: next.difficulty,
    lastAt: step.at,
  };
  acc.afterKnown = false;
}

// 한 단위의 근거 줄(답 { at, grade, responseFormat } · 본인 말 { at, say })에서 기억 상태를 낸다.
// 창(recent): 자리마다 그 자리 앞 상태가 있을 때만 { q = 1 − 그 자리 앞 상태의 떠올릴 확률, m = 놓침 1 }을 남기고 최근 stubbornWindow자리를 든다.
// 앞 상태가 없는 자리(첫 자리 · 「이미 알아요」 뒤 첫 놓침)와 「이미 알아요」는 창을 비운다.
export function specUnit(rows, params) {
  const f = schedulerOf(params);
  const sorted = [...rows].sort(order);
  // 「다시 배울래요」는 그 시각 앞의 답을 접기에서 뺀다. 비운 줄에도 비운 시각은 남는다.
  const cleared = sorted.map(row => row.say).lastIndexOf('relearn');
  const kept = sorted.slice(cleared + 1);
  if (!kept.length) return cleared >= 0 ? { empty: true, latestAt: sorted[cleared].at } : null;
  const acc = { state: null, sittings: 0, lapses: 0, afterKnown: false, recent: [] };
  for (const step of sittingsOf(kept, params)) {
    // 「이미 알아요」: 안정도를 60일로 둔다(난이도 값은 처음 만나 Good을 낸 것과 같게).
    if ('known' in step) {
      const difficulty = f.next_state(null, 0, GRADE.good).difficulty;
      acc.state = { stability: params.maxIntervalDays, difficulty, lastAt: step.known };
      acc.afterKnown = true;
      acc.recent = [];
    } else sitting(f, acc, step, params);
  }
  const { state, sittings, lapses, recent } = acc;
  return {
    ...state,
    sittings,
    lapses,
    firstAt: kept[0].at,
    latestAt: kept.at(-1).at,
    recent,
    stubborn: specStubborn(recent, params),
    missed: specMissed(kept),
  };
}

// 「도움을 받으면 0」의 도움(§3-3) — 그 답을 내는 데 쓴 도움, 곧 그 제시의 첫 답보다 앞선 도움과 답 없이 본 도움이다. 첫 답 뒤에
// 정답 · 풀이를 본 것은 되짚기라 「이어서」를 끊지 않는다. 제시 하나의 도움 · 답({ kind: 'help' | 'answer', id, at })에서 능력 줄에
// 설 도움 만남(그 첫 도움)을 낸다 — 없으면 null. 아래 능력 줄의 「도움을 받은 줄」이 이것이다(어댑터 시험이 맞댄다).
export function specHelpMeeting(steps) {
  const sorted = [...steps].sort(order);
  const answered = sorted.findIndex(step => step.kind === 'answer');
  const before = answered < 0 ? sorted : sorted.slice(0, answered);
  return before.find(step => step.kind === 'help') ?? null;
}

// 한 능력의 답 줄({ at, id, grade, unaided, lead, difficulty, responseFormat, unknownOption })에서 작업 난도를 낸다.
//   측정 답 = 그 계열의 첫 만남이고 도움 없이 낸 답. 측정 답만 θ와 답 수를 옮긴다(답이 적을 때 크게, 쌓이면 잔잔하게).
//   찍기 바닥은 응답 꼴마다, 「모르겠어요」가 있는 문항이면 절반. level = 마지막 측정 답의 난도.
//   이어서 혼자 맞힌 수 = 마지막으로 놓치거나 도움을 받은 줄 뒤에 있는 측정 정답의 수.
export function specSkill(rows, params) {
  const sorted = [...rows].sort(order);
  let theta = 0;
  let n = 0;
  let level = null;
  for (const row of sorted) {
    if (!(row.lead && row.unaided)) continue;
    const base = params.guess[row.responseFormat] ?? params.guess.unknown;
    const guess = row.unknownOption ? base / 2 : base;
    const logit = params.difficultyLogit[row.difficulty] ?? 0;
    const expected = guess + (1 - guess) / (1 + Math.exp(-(theta - logit)));
    const { floor, start, half } = params.abilityGain;
    theta += (floor + start / (1 + n / half)) * ((row.grade === 'again' ? 0 : 1) - expected);
    n += 1;
    level = row.difficulty;
  }
  const broken = sorted.map(row => row.grade === 'again' || !row.unaided).lastIndexOf(true);
  const streak = sorted.slice(broken + 1).filter(row => row.lead && row.unaided).length;
  return { theta, n, streak, level, lastAt: sorted.at(-1).at };
}
