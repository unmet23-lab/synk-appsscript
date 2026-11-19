// 순간 맞춤의 가드 — 손잡이를 돌리는 모든 바뀜의 마지막 말(옛 atlas/temper.js의 check를 옮김, 아틀라스 설계 §7-2 · 구현 명세 §6-3).
// 한 번에 손잡이 하나, 한 칸, 범위 안, 본인 선택만 따르는 손잡이(follows: 'declared')는 돌리지 않는다. 한 응답에 바뀜은 하나,
// 막 내린 손잡이는 두 응답 동안 다시 올리지 않는다(올린 직후 내리는 것은 늘 된다 — 편안함이 먼저다).
// frozen은 멈춤 스위치다 — 모두 내용의 시작값으로 둔다. 아무것도 부르지 않는 잎 모듈이다(flow.mjs가 이것을 읽고, 이것은 아무것도 읽지 않는다).

// 막 내린 손잡이는 이만큼의 응답 안에서 다시 올리지 않는다.
export const FLIP_WINDOW = 2;
// 무엇이든 올린 뒤에는 새 단계를 이만큼 만난 다음에야 또 올린다.
export const COOL_DOWN = 2;
const PHASES = Object.freeze(['opening', 'response', 'accepted']);

// 여는 자리(opening)는 여러 칸을 갈 수 있다 — 응답 사이의 규칙(하나씩 · 되튐 없음 · 올린 뒤 쉼)은 응답과 받아들임에만 건다.
function liveRail({ knob, from, to, step, history }) {
  const live = history.filter(c => c.phase !== 'opening');
  if (live.some(c => c.step === step)) return 'one-change-per-response';
  const recent = live.filter(c => c.knob === knob && step - c.step <= FLIP_WINDOW).at(-1);
  if (recent && to > from && recent.to < recent.from) return 'no-bounce';
  if (to > from && live.some(c => c.direction > 0 && step - c.step <= COOL_DOWN))
    return 'cool-down';
  return null;
}

function railOf({ spec, knob, from, to, step, phase, history, frozen }) {
  if (frozen) return 'hold';
  const k = spec?.knobs?.find(x => x.id === knob);
  if (!k) return 'unknown-knob';
  if (!Number.isInteger(from) || !Number.isInteger(to) || Math.abs(to - from) !== 1)
    return 'one-step';
  if (to < 0 || to >= k.values.length) return 'bounds';
  if (k.follows === 'declared') return 'declared-only';
  if (!PHASES.includes(phase) || !Number.isInteger(step) || !Array.isArray(history))
    return 'invalid';
  return phase === 'opening' ? null : liveRail({ knob, from, to, step, history });
}

export function check({
  spec,
  knob,
  from,
  to,
  step,
  phase = 'response',
  history = [],
  frozen = false,
} = {}) {
  const rail = railOf({ spec, knob, from, to, step, phase, history, frozen });
  return { ok: rail === null, rail };
}
