// 순간 맞춤이 사람에게 닿는 자리(옛 atlas/vellum-flow.js를 옮김) — 바뀜을 어떻게 말하고, 도움을 언제 여는가.
//   stuckFor    「막힘」을 모두에게 같은 시계가 아니라 그 사람의 최근 답 시간에 견준다(아틀라스 설계 §8-5) — 꼼꼼히 읽는 사람을
//               일찍 끊지 않고, 빨리 하는 사람은 더 일찍 돕는다.
//   supportStep 도움을 한 칸 줄이자고 언제 물을까(설계 §5-4 · 명세 §4-6) — 묻기만 하고 정하지 않는다. 「아니요」 뒤 14일은 묻지 않고,
//               본인이 정한 도움 방식을 거스르지 않는다.
//   line        순간 맞춤의 바뀜이나 시작을 말하는 정직한 한 문장(설계 §8 — 한 일과 까닭을 말하고 사람을 판단하지 않는다).
//               내용은 제 세계의 말(words)과 눈높이(level)를 넘긴다.
// 시계 · 저장 · 신원이 없는 순수 함수다. 문장은 설정을 말하고, 능력이나 효과를 말하지 않는다.
export const VERSION = 'vellum-flow-1';
const DAY = 86_400_000;
export const STUCK = Object.freeze({ afterMs: 40000, misses: 2 });
const within = (value, min, max) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const time = value => {
  const n = Date.parse(value);
  if (typeof value !== 'string' || !Number.isFinite(n)) throw new TypeError('Vellum: invalid time');
  return n;
};

const stuckInputOk = ({ latencies, base, factor, floorMs, ceilMs, minSamples }) =>
  Array.isArray(latencies) &&
  latencies.every(ms => within(ms, 0, 600000)) &&
  !!base &&
  within(base.afterMs, 1000, 600000) &&
  Number.isInteger(base.misses) &&
  base.misses >= 1 &&
  Number.isSafeInteger(minSamples) &&
  minSamples >= 1 &&
  within(factor, 1, 10) &&
  within(floorMs, 1000, ceilMs) &&
  within(ceilMs, floorMs, 600000);

export function stuckFor({
  latencies = [],
  base = STUCK,
  factor = 2.5,
  floorMs = 8000,
  ceilMs = 90000,
  minSamples = 5,
} = {}) {
  if (!stuckInputOk({ latencies, base, factor, floorMs, ceilMs, minSamples }))
    throw new TypeError('Vellum: invalid stuck input');
  if (latencies.length < minSamples)
    return { afterMs: base.afterMs, misses: base.misses, basis: 'default', n: latencies.length };
  const sorted = [...latencies].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    afterMs: Math.round(Math.min(ceilMs, Math.max(floorMs, factor * median))),
    misses: base.misses,
    basis: 'personal',
    n: latencies.length,
  };
}

const stepInputOk = ({ at, last, streak, steady, declared, need, quietDays }) =>
  Number.isInteger(at) &&
  Number.isInteger(last) &&
  at >= 0 &&
  at <= last &&
  Number.isInteger(streak) &&
  streak >= 0 &&
  Number.isInteger(steady) &&
  steady >= 0 &&
  typeof declared === 'boolean' &&
  Number.isInteger(need) &&
  need >= 1 &&
  within(quietDays, 0, 365);

/* at은 지금 도움 단계의 자리(0 = 도움이 가장 많음), last는 도움이 가장 적은 자리다. streak은 조용한 성공이 이어진 수(start의
 * quietStreak), steady는 도움이 있든 없든 성공이 이어진 수(steadyStreak)다. 답마다 도움이 먼저 보이는 곳에서는 조용한 성공이
 * 없으므로, need보다 하나 더 이어진 성공도 물을 수 있다. 그래도 묻기만 한다. */
export function supportStep({
  at,
  last,
  streak,
  steady = 0,
  declared = false,
  declinedAt = null,
  now,
  need = 3,
  quietDays = 14,
} = {}) {
  if (!stepInputOk({ at, last, streak, steady, declared, need, quietDays }))
    throw new TypeError('Vellum: invalid support step input');
  if (declared) return { offer: false, reason: 'declared' };
  if (at >= last) return { offer: false, reason: 'least-help' };
  if (streak < need && steady < need + 1) return { offer: false, reason: 'not-yet' };
  if (declinedAt !== null && time(now) - time(declinedAt) < quietDays * DAY)
    return { offer: false, reason: 'declined-recently' };
  return {
    offer: true,
    from: at,
    to: at + 1,
    reason: streak >= need ? 'quiet-streak' : 'steady-with-help',
  };
}

// 같은 문장의 두 눈높이(설계 §8-2): 아주 짧은 말, 또는 평이한 한 문장.
export const WORDS = Object.freeze({
  easy: Object.freeze({
    'raise.pace': '조금 빨라져요.',
    'raise.content': '조금 어려워져요.',
    'ease.pace': '시간이 더 있어요.',
    'ease.content': '조금 쉬워져요.',
    'ease.support': '힌트가 먼저 나와요.',
    'accepted-less-help': '힌트가 조금 늦게 나와요.',
    'start.memory': '지난번에 이어서 해요.',
    'start.prior': '지난 연습에 맞춰 시작해요.',
    'start.returning': '가볍게 시작해요.',
    'start.tired': '오늘은 안 어려워져요.',
    'start.fixed': '정한 방식 그대로 해요.',
    'start.baseline': '이번에는 기본으로 해요.',
  }),
  standard: Object.freeze({
    'raise.pace': '조금 더 빠르게 해 볼게요.',
    'raise.content': '조금 더 어려운 것도 해 볼게요.',
    'ease.pace': '시간을 조금 더 넉넉하게 드릴게요.',
    'ease.content': '조금 더 쉬운 것부터 다시 해요.',
    'ease.support': '도움을 조금 더 일찍 보여 드릴게요.',
    'accepted-less-help': '말씀하신 대로 도움을 조금 늦게 보여 드릴게요.',
    'start.memory': '지난번에 하던 데서 이어 갈게요.',
    'start.prior': '다른 연습 기록에 맞춰 시작할게요.',
    'start.returning': '가볍게 다시 시작할게요.',
    'start.tired': '오늘은 더 어렵게 하지 않을게요.',
    'start.fixed': '정해 둔 방식 그대로 진행해요.',
    'start.baseline': '이번 판은 기본 구성으로 진행해요.',
  }),
});

const easeKey = kind =>
  kind === 'pace' ? 'ease.pace' : kind === 'support' ? 'ease.support' : 'ease.content';

// 순간 맞춤의 바뀜이나 시작 코드가 가리키는 열쇠. 모르는 코드는 짐작하지 않고 아무 말도 하지 않는다.
function keyOf(event) {
  if (!event || typeof event !== 'object') return null;
  if (typeof event.code === 'string') return event.code === 'start.default' ? null : event.code;
  if (event.because === 'accepted-less-help') return 'accepted-less-help';
  if (event.direction > 0) return event.kind === 'pace' ? 'raise.pace' : 'raise.content';
  if (event.direction < 0) return easeKey(event.kind);
  return null;
}

export function line(event, { level = 'standard', words = {} } = {}) {
  if (!Object.hasOwn(WORDS, level) || !words || typeof words !== 'object')
    throw new TypeError('Vellum: invalid line options');
  const key = keyOf(event);
  if (!key) return null;
  const text = Object.hasOwn(words, key) ? words[key] : WORDS[level][key];
  return typeof text === 'string' && text ? { key, text } : null;
}
