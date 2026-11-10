// 기억 — 「기억 1판」: 단위마다 FSRS-6 기억 상태(설계 §3-2).
//
// 받는 것: 한 단위의 근거 줄(답 { id, at, grade } · 본인 말 { id, at, say }). 내는 것: 단위 상태와 떠올릴 확률 · 돌아옴 · 다음 간격.
// 정해진 값(08-22): ts-fsrs 5.4.2의 기억 계산만 쓴다(src/memory/fsrs.mjs) · 목표 보유율 0.9 · 최대 간격 60일 · 흔들기 없음 · Easy 없음.
// 지킬 것: 같은 자리(첫 답에서 6시간)의 결과는 하나 · 고르는 꼴 정답은 약한 성공 · 지난 시간은 실제 시간으로 센다 ·
// 상태는 근거 줄을 접은 값이라 언제든 사건에서 다시 만든다. 시험의 독립 기준은 test/oracle/spec.mjs다.
//
// 단위 상태 = 「마지막 자리 앞의 상태(prev) + 마지막 자리(open)」와 거기서 계산한 값(stability · difficulty · lastAt),
// 만난 자리 수(sittings) · 놓친 자리 수(lapses) · 처음 만난 때(firstAt) · 마지막 사건 시각(latestAt).
// 요약에는 이 꼴 그대로 싣는다 — 같은 자리에 답이 더 오면(먼저 맞히고 이어서 놓친 경우) 앞 상태에서 그 자리만 다시 계산할 수 있어야 한다.
// 「다시 배울래요」로 비운 줄은 { empty: true, latestAt }이다 — 그보다 이른 답이 늦게 와도 이어 붙이지 않고 처음부터 다시 접게 한다.
import { sortByTime } from '../fold/order.mjs';
import { PARAMS } from '../params.mjs';
import { GRADES } from './grade.mjs';
import { createFsrs } from './fsrs.mjs';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const FSRS_GRADE = Object.freeze({ again: 1, hard: 2, good: 3 });
const SAYS = Object.freeze(['known', 'relearn']);

export function createMemory(params = PARAMS) {
  const f = createFsrs({
    request_retention: params.retention,
    maximum_interval: params.maxIntervalDays,
  });
  const sittingMs = params.sittingHours * HOUR;
  // 지난 시간은 실제 시간(날, 실수)으로 센다. 달력 날짜 · 시간대 · 「24시간 내림」에 기대지 않는다.
  const days = (from, to) => Math.max(0, (to - from) / DAY);
  const curve = (elapsed, stability) => Number(f.forgetting_curve(elapsed, stability));

  // 한 자리의 결과를 앞 상태에 적용한다. 약한 성공: 첫 만남은 Hard의 출발값(안정도 1.3일 · 난이도 값 5.1),
  // 그 뒤는 안정도 S' = S + weakWeight × (S_good − S), 난이도 값 D' = D_good(Good의 갱신 — 올리지 않는다).
  // weakWeight가 1 이상이면 고르는 꼴 정답을 처음부터 Good 그대로 친다(가상 학습자 비교에서 견줄 때만 쓴다).
  function step(before, t, sittingGrade) {
    const grade = sittingGrade === 'weak' && params.weakWeight >= 1 ? 'good' : sittingGrade;
    if (grade !== 'weak') return f.next_state(before, t, FSRS_GRADE[grade]);
    if (!before) return f.next_state(null, 0, FSRS_GRADE.hard);
    const good = f.next_state(before, t, FSRS_GRADE.good);
    return {
      stability: before.stability + params.weakWeight * (good.stability - before.stability),
      difficulty: good.difficulty,
    };
  }

  // 「이미 알아요」: 안정도를 최대 간격(60일)으로, 난이도 값은 처음 만나 Good을 낸 것과 같게.
  const KNOWN = Object.freeze({
    stability: params.maxIntervalDays,
    difficulty: f.next_state(null, 0, FSRS_GRADE.good).difficulty,
  });

  // 끈질긴 단위(§3-5): 최근 자리 창에서 놓침이 예상보다 많은가. 창의 칸은 그 자리 앞 상태가 있을 때만 생긴다
  // (첫 자리 · 「이미 알아요」 뒤 첫 놓침에는 예상이 없다). 창이 회복을 맡는다 — 맞힌 자리가 쌓이면 놓침이 창 밖으로 나간다.
  function stubbornOf(recent) {
    let misses = 0;
    let excess = 0;
    let spread = 0;
    for (const { q, m } of recent) {
      misses += m;
      excess += m - q;
      spread += q * (1 - q);
    }
    return (
      misses >= params.stubbornMisses &&
      spread > 0 &&
      excess / Math.sqrt(spread) >= params.stubbornZ
    );
  }

  // 마지막 자리의 창 칸: 마지막 자리 앞 상태(prev)에서 다시 계산한다 — 같은 자리에서 맞힌 뒤 놓쳐 결과가 바뀌어도 맞게 고쳐진다.
  function recentOf(prev, open) {
    if (open.grade === 'known' || !prev) return [];
    const q = 1 - curve(days(prev.lastAt, open.at), prev.stability);
    const m = open.grade === 'again' ? 1 : 0;
    return [...(prev.recent ?? []), { q, m }].slice(-params.stubbornWindow);
  }

  // 안정도는 최대 간격을 넘기지 않는다 — 그래서 60일째에 떠올릴 확률이 꼭 목표에 닿고, 「돌아올 때」는 규칙 하나로 끝난다.
  function build(prev, open, counts) {
    const from = prev ? { stability: prev.stability, difficulty: prev.difficulty } : null;
    const s =
      open.grade === 'known'
        ? KNOWN
        : step(from, prev ? days(prev.lastAt, open.at) : 0, open.grade);
    const recent = recentOf(prev, open);
    return {
      stability: Math.min(s.stability, params.maxIntervalDays),
      difficulty: s.difficulty,
      lastAt: open.at,
      prev,
      open,
      latestAt: open.at,
      recent,
      stubborn: stubbornOf(recent),
      ...counts,
    };
  }

  const priorOf = had => ({
    stability: had.stability,
    difficulty: had.difficulty,
    lastAt: had.lastAt,
    recent: had.recent,
  });

  // 놓친 답의 응답 꼴(가나다순 · 겹침 없음) — 끈질긴 단위를 다른 꼴로 먼저 내는 재료다(§3-5).
  const missedOf = (had, answer) => {
    const missed = had?.missed ?? [];
    if (
      answer.grade !== 'again' ||
      !answer.responseFormat ||
      missed.includes(answer.responseFormat)
    )
      return missed;
    return [...missed, answer.responseFormat].sort();
  };

  // 「이미 알아요」는 자리가 아니다: 그 뒤의 첫 답이 새 자리를 연다. 그 답이 놓침이면 처음 놓친 단위와 같게 시작한다
  // (높은 안정도를 물려받지 않는다).
  function afterKnown(had, answer, counts, miss) {
    const next = { ...counts, sittings: had.sittings + 1 };
    if (miss) return build(null, { at: answer.at, grade: 'again' }, next);
    return build({ ...priorOf(had), known: true }, { at: answer.at, grade: answer.grade }, next);
  }

  // 같은 자리: 놓친 적이 있으면 놓침, 아니면 첫 성공의 등급. 맞힌 뒤 놓치면 맞힘을 물리고 앞 상태에서 놓침으로 다시 계산한다
  // (앞 상태가 「이미 알아요」였으면 처음 놓친 단위처럼 시작한다).
  function sameSitting(had, answer, counts, miss) {
    if (!miss || had.open.grade === 'again')
      return { ...had, latestAt: answer.at, missed: counts.missed };
    const prev = had.prev?.known ? null : had.prev;
    return { ...build(prev, { at: had.open.at, grade: 'again' }, counts), latestAt: answer.at };
  }

  // 「이미 알아요」: 기억을 60일 뒤로 보낸다. 만난 자리 · 놓친 자리 · 놓친 꼴은 그대로 둔다(창은 비운다).
  function sayKnown(had, answer) {
    const counts = had
      ? { sittings: had.sittings, lapses: had.lapses, firstAt: had.firstAt, missed: had.missed }
      : { sittings: 0, lapses: 0, firstAt: answer.at, missed: [] };
    return build(null, { at: answer.at, grade: 'known' }, counts);
  }

  // 답이나 본인 말 하나를 얹는다. 지금까지의 사건보다 시각이 늦은 것에만 쓴다(가운데 끼는 것은 fold로 처음부터 다시 접는다).
  function append(state, answer) {
    if (answer.say === 'relearn') return { empty: true, latestAt: answer.at };
    const had = state && !state.empty ? state : null;
    if (answer.say === 'known') return sayKnown(had, answer);
    const miss = answer.grade === 'again' ? 1 : 0;
    const missed = missedOf(had, answer);
    if (!had) {
      return build(
        null,
        { at: answer.at, grade: answer.grade },
        { sittings: 1, lapses: miss, firstAt: answer.at, missed },
      );
    }
    const counts = {
      sittings: had.sittings,
      lapses: had.lapses + miss,
      firstAt: had.firstAt,
      missed,
    };
    if (had.open.grade === 'known') return afterKnown(had, answer, counts, miss);
    if (answer.at - had.open.at < sittingMs) return sameSitting(had, answer, counts, miss);
    return build(
      priorOf(had),
      { at: answer.at, grade: answer.grade },
      { ...counts, sittings: had.sittings + 1 },
    );
  }

  const has = state => Boolean(state) && !state.empty;
  // 요약의 줄에 이어 붙일 수 있는가: 그 줄의 마지막 사건보다 뒤인 것만. 같은 시각이면 사건 번호로 차례를 정해야 하므로 붙이지 않는다.
  const canAppend = (state, at) => !state || at > state.latestAt;
  const retrievability = (state, now) =>
    has(state) ? curve(days(state.lastAt, now), state.stability) : null;
  const inSitting = (state, now) =>
    has(state) && state.open.grade !== 'known' && now - state.open.at < sittingMs;
  const folded = row =>
    Number.isFinite(row.at) && (GRADES.includes(row.grade) || SAYS.includes(row.say));

  // 다음에 돌아올 때까지의 날 수(목표 보유율에 닿는 때 — 같은 자리 시간보다 짧지 않고 최대 간격보다 길지 않다).
  function intervalDays(state) {
    let low = params.sittingHours / 24;
    let high = params.maxIntervalDays;
    if (curve(low, state.stability) < params.retention) return low;
    if (curve(high, state.stability) >= params.retention) return high;
    for (let i = 0; i < 40; i += 1) {
      const mid = (low + high) / 2;
      if (curve(mid, state.stability) >= params.retention) low = mid;
      else high = mid;
    }
    return high;
  }

  return Object.freeze({
    append,
    has,
    canAppend,
    // 한 기억 단위의 근거 줄을 시각 순으로 접는다.
    fold: rows => sortByTime(rows.filter(folded)).reduce(append, null),
    retrievability,
    inSitting,
    // 돌아옴: 떠올릴 확률이 목표 아래로 내려왔다. 같은 자리 안에서는 돌아온 것으로 치지 않는다.
    isDue: (state, now) =>
      has(state) && !inSitting(state, now) && retrievability(state, now) < params.retention,
    intervalDays,
  });
}
