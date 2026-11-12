// 이유 — 종류와 근거 칸(설계 §3-7). 고르기는 문장이 아니라 { code, slots, evidence }를 낸다.
//   code     이유의 종류(아래 표). 층과 맞는다(설계 §3-5 불변식 6).
//   slots    문장에 들어가는 값(단위 · 능력 · 며칠 만에 · 횟수). 문장은 Vellum이 화면 언어 · 눈높이 · 말하는 사람에 맞춰 표에서 고른다(단계 4).
//   evidence 그 값을 낸 기록의 원값(단위 상태의 만난 자리 수 · 놓친 자리 수 · 마지막 만남, 능력의 답 수 · 이어서 맞힌 수, 난도의 전 · 후).
// 근거 칸은 기록에 있는 사실만 쓴다. 능력이나 성향을 단정하는 말, 남과 견주는 말은 표에 없다. 실행 중에 모델을 부르지 않는다.
// 횟수는 만난 자리로 센다(같은 판 안에서 다시 낸 것은 한 자리다).
const DAY = 86_400_000;

export const REASON_CODES = Object.freeze({
  retry: 'unit.retry',
  shaky: 'unit.shaky',
  due: 'unit.due',
  fresh: 'unit.new',
  up: 'skill.up',
  ease: 'skill.ease',
  breather: 'pace.breather',
  goal: 'goal.match',
  resume: 'host.resume',
  prerequisite: 'host.prerequisite',
  homework: 'host.homework',
  idle: 'idle',
  capped: 'day.capped',
  stubborn: 'pace.stubborn',
});

const unitEvidence = state => ({
  sittings: state?.sittings ?? 0,
  lapses: state?.lapses ?? 0,
  lastAt: state?.lastAt ?? null,
  stubborn: state?.stubborn === true,
});

// 「며칠 만에」 — 마지막 만남과 지금 사이의 하루 수. 하루는 한도의 하루와 같은 달력(기기 현지 새벽 4시 경계 — offset은 현지 시각 − UTC,
// 분)이고 같은 하루면 0이다 — 그때 이유 줄은 날 수를 말하지 않는다(「오늘 놓친 …」). 반올림 · 최소 1일로 세면 아침에 놓친 말을 그날
// 오후에 다시 만나도 「1일 만에」라고 했다(Fable 5.2 끝 판 F4 · 설계 주인 11-13 — 근거 칸은 기록에 있는 사실만, 설계 §3-7).
const HOUR = 3_600_000;
const MINUTE = 60_000;
export const elapsedDays = (state, now, { dayStartHour = 4, offset = 0 } = {}) => {
  const dayOf = at => Math.floor((at + offset * MINUTE - dayStartHour * HOUR) / DAY);
  return Math.max(0, dayOf(now) - dayOf(state.lastAt));
};

// 방금 놓친 단위를 다시(0층 · 당겨 낸 5층). other = 놓친 문항과 다른 계열의 문항인가.
export const retryReason = (unit, state, other) => ({
  code: REASON_CODES.retry,
  slots: { unit, misses: state?.lapses ?? 0, reviews: state?.sittings ?? 0, other },
  evidence: unitEvidence(state),
});

// 돌아온 단위(1층). 놓친 적이 있으면 「흔들리는 것」, 없으면 「돌아온 것」. day: 하루 경계({ dayStartHour, offset } — elapsedDays).
export function dueReason(unit, state, now, day = {}) {
  const days = elapsedDays(state, now, day);
  const evidence = unitEvidence(state);
  if (state.lapses > 0) {
    return {
      code: REASON_CODES.shaky,
      slots: { unit, misses: state.lapses, reviews: state.sittings, days },
      evidence,
    };
  }
  return { code: REASON_CODES.due, slots: { unit, days }, evidence };
}

// 새것(2층). 이유가 능력 이야기여도 겨눈 단위는 근거 칸에 늘 싣는다 — 서버는 사건만 보고 실패를 적을 단위를 알아야 한다.
//   skill.up   처음 본 문항을 둘 이상 이어서 혼자 맞힌 뒤 실제로 난도가 오른 문항
//   skill.ease 방금 놓친 뒤(이어서 맞힌 수 0) 실제로 난도가 내려간 문항
export function freshReason(unit, item, previous, ability) {
  const streak = ability?.streak || 0;
  const evidence = { n: ability?.n ?? 0, streak, from: previous ?? null, to: item.difficulty };
  if (previous != null && item.difficulty > previous && streak >= 2) {
    return {
      code: REASON_CODES.up,
      slots: { skill: item.skillId, unit, streak, from: previous, to: item.difficulty },
      evidence,
    };
  }
  if (previous != null && item.difficulty < previous && ability?.n > 0 && streak === 0) {
    return {
      code: REASON_CODES.ease,
      slots: { skill: item.skillId, unit, from: previous, to: item.difficulty },
      evidence,
    };
  }
  return { code: REASON_CODES.fresh, slots: { unit }, evidence };
}

export const breatherReason = (unit, misses) => ({
  code: REASON_CODES.breather,
  slots: { unit, misses },
  evidence: { misses },
});

// 할 것이 없을 때 채우기(3 · 4층)의 이유 — 「오늘 돌아온 것은 다 만났어요. 가볍게 이어가요」.
export const idleReason = () => ({ code: REASON_CODES.idle, slots: {}, evidence: {} });
// 하루 복습 상한에 걸렸다 — 「오늘은 여기까지예요」.
export const cappedReason = () => ({ code: REASON_CODES.capped, slots: {}, evidence: {} });
// 끈질긴 단위의 이 판 몫을 다 썼다 — 남은 할 것이 그것뿐일 때.
export const stubbornReason = () => ({ code: REASON_CODES.stubborn, slots: {}, evidence: {} });
