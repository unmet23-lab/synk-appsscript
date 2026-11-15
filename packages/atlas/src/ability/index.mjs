// 작업 난도 — 「난도 1판」: 능력마다 θ 하나(설계 §3-3 · §3-4).
//
// 받는 것: 그 능력의 답 줄(시각 순) — { at, id, grade, unaided, lead, difficulty, responseFormat, unknownOption }.
// 내는 것: { theta, n(측정 답 수), streak(이어서 혼자 맞힌 수), level(마지막 측정 답의 난도), peak(지금 streak 안의 측정 답 가운데
// 가장 높은 난도), lastAt(마지막 줄 시각) }.
// 지킬 것: θ와 답 수는 측정 자격이 있는 답(그 계열의 첫 만남에 도움 없이 낸 답)에만 움직인다 · 단위 기억의 상태를 읽지 않는다
// (읽으면 한 단위의 늦은 답이 다른 능력 값까지 흔든다) · 이어서 맞힌 수는 그 능력의 답 줄 전체를 읽는다(도움만 보고 나간 것도 끊는다) ·
// 어디에도 급수나 점수로 보이지 않는다. 기기는 요약의 줄에 자기 새 답을 이어 붙이고, 가운데 끼는 답이 오면 서버가 그 능력만 다시 접는다.
// level은 「난도가 실제로 오르내렸는가」(이유 skill.up · skill.ease — §3-7)의 기준이다. 답 줄의 함수라 다시 켜도 · 기기를 바꿔도 같다.
// peak은 「내 위치」가 처음 보는 문항이 바닥난 칸을 이어서 혼자 맞힌 수로 풀 때의 기준이다(단계 4 계획 §21-3 · 설계 주인 11-16 새벽).
// 더하는 칸일 뿐이라 θ · n · streak · level과 고르기는 이 칸을 읽지 않는다. 놓치거나 도움을 받으면 streak과 함께 비운다. 이 칸이 없던
// 옛 요약의 줄(서버 반영 전의 계정 요약 포함)에 이어 붙인 streak은 그 안의 난도를 다 모르므로 끊길 때까지 null이다.
import { sortByTime } from '../fold/order.mjs';
import { PARAMS } from '../params.mjs';

const sigmoid = x => 1 / (1 + Math.exp(-x));

export const EMPTY_SKILL = Object.freeze({
  theta: 0,
  n: 0,
  streak: 0,
  level: null,
  peak: null,
  lastAt: Number.NEGATIVE_INFINITY,
});

// 찍기 바닥: 응답 꼴마다. 「모르겠어요」가 있는 문항은 찍는 답이 줄어 절반(출발값 — §3-4).
export function floorOf(responseFormat, unknownOption = false, params = PARAMS) {
  const base = params.guess[responseFormat] ?? params.guess.unknown;
  return unknownOption ? base / 2 : base;
}
export const levelOf = (difficulty, params = PARAMS) => params.difficultyLogit[difficulty] ?? 0;
export const abilityTerm = (theta, difficulty, params = PARAMS) =>
  sigmoid(theta - levelOf(difficulty, params));

// 측정 답 하나로 θ를 한 걸음 옮긴다 — 답이 적을 때 크게, 쌓이면 잔잔하게.
export function stepAbility(ability, row, params = PARAMS) {
  const g = floorOf(row.responseFormat, row.unknownOption, params);
  const expected = g + (1 - g) * abilityTerm(ability.theta, row.difficulty, params);
  const { floor, start, half } = params.abilityGain;
  const gain = floor + start / (1 + ability.n / half);
  return { theta: ability.theta + gain * ((row.correct ? 1 : 0) - expected), n: ability.n + 1 };
}

// 측정 답(난도 difficulty)을 혼자 맞힌 뒤의 peak. 앞 streak이 0이면 이 답이 새 streak의 처음이다. 앞 streak이 있는데 그 peak을
// 모르면(peak 칸이 없던 옛 요약의 줄) 모르는 그대로 둔다 — 아는 난도만으로 풀면 앞 답의 난도를 모르는 채 칸을 푼다(조건 3).
function peakAfter(skill, difficulty) {
  if (!Number.isFinite(difficulty)) return null;
  if (!skill.streak) return difficulty;
  if (!Number.isFinite(skill.peak)) return null;
  return Math.max(skill.peak, difficulty);
}

// 한 능력의 답 한 줄을 반영한다. lead = 그 계열의 첫 만남인가.
// 이어서 혼자 맞힌 수: 처음 본 문항을 혼자 맞히면 +1, 그 능력의 어떤 문항이든 놓치거나 도움을 받으면 0, 복습을 맞힌 것은 그대로.
// 도움 줄은 어댑터가 세운 도움 만남이다 — 그 제시의 첫 답보다 앞선 도움 · 답 없이 본 도움(첫 답 뒤의 되짚기는 줄이 없다, 설계 §3-3).
export function stepSkill(skill, row, params = PARAMS) {
  const solo = row.lead && row.unaided;
  const miss = row.grade === 'again';
  if (!solo) {
    const streak = miss || !row.unaided ? 0 : skill.streak;
    return { ...skill, streak, peak: streak ? (skill.peak ?? null) : null, lastAt: row.at };
  }
  const measured = { ...row, correct: !miss };
  return {
    ...stepAbility(skill, measured, params),
    streak: miss ? 0 : skill.streak + 1,
    level: row.difficulty,
    peak: miss ? null : peakAfter(skill, row.difficulty),
    lastAt: row.at,
  };
}

// 한 능력의 답 줄을 시각 순으로 접는다.
export const abilityOf = (rows, params = PARAMS) =>
  sortByTime(rows).reduce((skill, row) => stepSkill(skill, row, params), EMPTY_SKILL);
