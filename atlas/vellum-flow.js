/* SYNK Vellum: how moment-level changes reach the person, and when help opens for them.
 * stuckFor    - "stuck" measured against the person's own recent answer times, not one clock
 *               for everyone (Atlas design §8-5), so a careful reader is not interrupted early
 *               and a quick player is helped sooner.
 * supportStep - when to offer one step less help (design §5-4, spec §4-6): offered and asked,
 *               never imposed; quiet for 14 days after a "no"; never against a declared choice.
 * line        - one honest sentence for a Flow change or start (design §8: say what was done and
 *               why, never judge the person). Contents pass their own in-world words and level.
 * Pure: no clock, storage or identity. Sentences describe settings, never ability or effect.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkVellumFlow = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'vellum-flow-1';
  const DAY = 86400000;
  const STUCK = Object.freeze({ afterMs: 40000, misses: 2 });
  const within = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  const time = value => { const n = Date.parse(value); if (typeof value !== 'string' || !Number.isFinite(n)) throw new TypeError('Vellum: invalid time'); return n; };

  function stuckFor({ latencies = [], base = STUCK, factor = 2.5, floorMs = 8000, ceilMs = 90000, minSamples = 5 } = {}) {
    if (!Array.isArray(latencies) || !latencies.every(ms => within(ms, 0, 600000)) || !base || !within(base.afterMs, 1000, 600000)
      || !Number.isInteger(base.misses) || base.misses < 1 || !within(factor, 1, 10) || !within(floorMs, 1000, ceilMs) || !within(ceilMs, floorMs, 600000)) {
      throw new TypeError('Vellum: invalid stuck input');
    }
    if (latencies.length < minSamples) return { afterMs: base.afterMs, misses: base.misses, basis: 'default', n: latencies.length };
    const sorted = [...latencies].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    return { afterMs: Math.round(Math.min(ceilMs, Math.max(floorMs, factor * median))), misses: base.misses, basis: 'personal', n: latencies.length };
  }

  /* `at` is the current help level as an index (0 = the most help) and `last` the index of the
   * least help. `streak` is the run of quiet successes (Flow.quietStreak). */
  function supportStep({ at, last, streak, declared = false, declinedAt = null, now, need = 3, quietDays = 14 } = {}) {
    if (!Number.isInteger(at) || !Number.isInteger(last) || at < 0 || at > last || !Number.isInteger(streak) || streak < 0
      || typeof declared !== 'boolean' || !Number.isInteger(need) || need < 1 || !within(quietDays, 0, 365)) throw new TypeError('Vellum: invalid support step input');
    if (declared) return { offer: false, reason: 'declared' };
    if (at >= last) return { offer: false, reason: 'least-help' };
    if (streak < need) return { offer: false, reason: 'not-yet' };
    if (declinedAt !== null && time(now) - time(declinedAt) < quietDays * DAY) return { offer: false, reason: 'declined-recently' };
    return { offer: true, from: at, to: at + 1, reason: 'quiet-streak' };
  }

  // Two levels of the same sentence (design §8-2): very short words, or one plain sentence.
  const WORDS = Object.freeze({
    easy: {
      'raise.pace': '조금 빨라져요.', 'raise.content': '조금 어려워져요.',
      'ease.pace': '시간이 더 있어요.', 'ease.content': '조금 쉬워져요.', 'ease.support': '힌트가 먼저 나와요.',
      'accepted-less-help': '힌트가 조금 늦게 나와요.',
      'start.memory': '지난번에 이어서 해요.', 'start.prior': '지난 연습에 맞춰 시작해요.', 'start.returning': '가볍게 시작해요.',
      'start.tired': '오늘은 안 어려워져요.', 'start.fixed': '정한 방식 그대로 해요.', 'start.baseline': '이번에는 기본으로 해요.',
    },
    standard: {
      'raise.pace': '조금 더 빠르게 해 볼게요.', 'raise.content': '조금 더 어려운 것도 해 볼게요.',
      'ease.pace': '시간을 조금 더 넉넉하게 드릴게요.', 'ease.content': '조금 더 쉬운 것부터 다시 해요.', 'ease.support': '도움을 조금 더 일찍 보여 드릴게요.',
      'accepted-less-help': '말씀하신 대로 도움을 조금 늦게 보여 드릴게요.',
      'start.memory': '지난번에 하던 데서 이어 갈게요.', 'start.prior': '다른 연습 기록에 맞춰 시작할게요.', 'start.returning': '가볍게 다시 시작할게요.',
      'start.tired': '오늘은 더 어렵게 하지 않을게요.', 'start.fixed': '정해 둔 방식 그대로 진행해요.', 'start.baseline': '이번 판은 기본 구성으로 진행해요.',
    },
  });
  // The key a Flow change or start code maps to. Unknown codes say nothing rather than guess.
  function keyOf(event) {
    if (!event || typeof event !== 'object') return null;
    if (typeof event.code === 'string') return event.code === 'start.default' ? null : event.code;
    if (event.because === 'accepted-less-help') return 'accepted-less-help';
    if (event.direction > 0) return event.kind === 'pace' ? 'raise.pace' : 'raise.content';
    if (event.direction < 0) return event.kind === 'pace' ? 'ease.pace' : event.kind === 'support' ? 'ease.support' : 'ease.content';
    return null;
  }
  function line(event, { level = 'standard', words = {} } = {}) {
    if (!Object.hasOwn(WORDS, level) || !words || typeof words !== 'object') throw new TypeError('Vellum: invalid line options');
    const key = keyOf(event);
    if (!key) return null;
    const text = Object.hasOwn(words, key) ? words[key] : WORDS[level][key];
    return typeof text === 'string' && text ? { key, text } : null;
  }
  return Object.freeze({ VERSION, STUCK, WORDS, stuckFor, supportStep, line });
});
