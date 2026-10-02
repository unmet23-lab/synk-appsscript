/* SYNK Temper: the checking side of Core's moment-level challenge (flow.js).
 * `check` is the last word on every knob change (Atlas design §7-2, implementation spec §6-3):
 * one knob, one step, inside bounds, never a declared-only knob, at most one change per
 * response, and a knob just eased is not raised again for two responses (easing right after
 * a raise is always allowed: comfort first). `frozen` is the stop switch: defaults for everyone.
 * `simulate` runs virtual people through the real Flow controller and the same content with
 * fixed defaults (design §7-1). Virtual people are described by behaviour only, never by age,
 * gender or nationality. Their results check the implementation; they are not evidence of
 * learning, satisfaction or effect.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(() => require('./flow'));
  else root.SynkTemperFlow = factory(() => root.SynkFlow);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (getFlow) {
  'use strict';
  const VERSION = 'temper-flow-1';
  // A knob just eased is not raised again within this many responses.
  const FLIP_WINDOW = 2;
  // After any raise, the person meets the new level at least this many times before another raise.
  const COOL_DOWN = 2;
  function check({ spec, knob, from, to, step, phase = 'response', history = [], frozen = false } = {}) {
    if (frozen) return { ok: false, rail: 'hold' };
    const k = spec?.knobs?.find(x => x.id === knob);
    if (!k) return { ok: false, rail: 'unknown-knob' };
    if (!Number.isInteger(from) || !Number.isInteger(to) || Math.abs(to - from) !== 1) return { ok: false, rail: 'one-step' };
    if (to < 0 || to >= k.values.length) return { ok: false, rail: 'bounds' };
    if (k.follows === 'declared') return { ok: false, rail: 'declared-only' };
    if (!['opening', 'response', 'accepted'].includes(phase) || !Number.isInteger(step) || !Array.isArray(history)) return { ok: false, rail: 'invalid' };
    if (phase !== 'opening') {
      const live = history.filter(c => c.phase !== 'opening');
      if (live.some(c => c.step === step)) return { ok: false, rail: 'one-change-per-response' };
      const recent = live.filter(c => c.knob === knob && step - c.step <= FLIP_WINDOW).at(-1);
      if (recent && to > from && recent.to < recent.from) return { ok: false, rail: 'no-bounce' };
      if (to > from && live.some(c => c.direction > 0 && step - c.step <= COOL_DOWN)) return { ok: false, rail: 'cool-down' };
    }
    return { ok: true, rail: null };
  }

  // ---- Simulation ------------------------------------------------------------------------
  const seeded = seed => {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i += 1) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  const normal = rng => Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
  // Standard normal CDF (Abramowitz-Stegun 7.1.26), enough for a model check.
  const phi = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2); return x >= 0 ? (1 + y) / 2 : (1 - y) / 2; };
  const sigmoid = x => 1 / (1 + Math.exp(-x));
  const SPREAD = 0.35, PACE0 = 0.55, CONTENT0 = 1.6;
  /* Behavioural profiles relative to the content's own defaults (0 = the default fits).
   * content/speed are logits; slip is a careless miss; growth is how much one quiet success
   * teaches; assist is how often help is used when an item looks too hard. */
  const PERSONAS = Object.freeze([
    { id: 'new-careful', label: '처음이라 천천히, 그러나 정확하게', content: -0.3, speed: -1.4, slip: 0.03, growth: 0.03, assist: 0.2 },
    { id: 'quick-slips', label: '빠르지만 실수가 잦은', content: 0, speed: 1.6, slip: 0.12, growth: 0.02, assist: 0.05 },
    { id: 'experienced', label: '이미 익숙한', content: 2.2, speed: 1.2, slip: 0.03, growth: 0.01, assist: 0 },
    { id: 'steady-growth', label: '하면서 빠르게 느는', content: -1.5, speed: -0.2, slip: 0.05, growth: 0.08, assist: 0.2 },
    { id: 'knows-but-rushed', label: '내용은 알지만 시간에 쫓기는', content: 1.4, speed: -1.8, slip: 0.03, growth: 0.01, assist: 0.05 },
    { id: 'returning', label: '오랜만에 다시 온', content: 1.0, speed: 0.4, slip: 0.05, growth: 0.02, assist: 0.1, pause: { at: 30, days: 30, forget: 1.0 } },
    { id: 'struggling', label: '지금은 많이 어려운', content: -2.4, speed: -0.8, slip: 0.06, growth: 0.03, assist: 0.5 },
  ].map(Object.freeze));
  const part = (spec, indices, kinds) => spec.scale * spec.knobs.reduce((sum, knob) => sum + (kinds.includes(knob.kind) ? knob.weight * (indices[knob.id] - knob.start) : 0), 0);
  // The virtual person's real chance of a quiet success under the given settings.
  // A content without pace knobs has no time limit, so nobody runs out of time there.
  function truth(spec, indices, person) {
    const content = part(spec, indices, ['content', 'support']), pace = part(spec, indices, ['pace']);
    const timed = spec.knobs.some(knob => knob.kind === 'pace');
    const correct = (1 - person.slip) * sigmoid(CONTENT0 + person.content - content);
    const median = PACE0 * Math.exp(0.5 * (pace - person.speed));
    const inTime = timed ? phi(-Math.log(median) / SPREAD) : 1;
    return { correct, inTime, success: correct * inTime, median, timed };
  }
  function run(Flow, spec, person, { steps, seed, adaptive }) {
    const rng = seeded(`${seed}|${person.id}|${adaptive ? 'adapted' : 'fixed'}`);
    const self = { ...person };
    let at = Date.parse('2026-10-02T00:00:00.000Z');
    const stamp = () => new Date(at).toISOString();
    let flow = Flow.start({ spec, now: stamp(), declared: adaptive ? {} : { mode: 'fixed' } });
    const rows = [];
    let offered = -Infinity;
    for (let step = 1; step <= steps; step += 1) {
      if (self.pause && step === self.pause.at) {
        const memory = flow.memory(stamp());
        at += self.pause.days * 86400000; self.content -= self.pause.forget; self.speed -= self.pause.forget / 2;
        flow = Flow.start({ spec, memory, now: stamp(), declared: adaptive ? {} : { mode: 'fixed' } });
      }
      const before = flow.settings(), chance = truth(spec, before.indices, self);
      let correct = chance.correct, assisted = false;
      if (correct < 0.5 && rng() < (self.assist || 0)) { assisted = true; correct = Math.max(correct, 0.8); }
      const duration = chance.median * Math.exp(SPREAD * normal(rng));
      const timeout = chance.timed && duration > 1, success = !timeout && rng() < correct;
      const outcome = timeout ? 'timeout' : success ? 'success' : 'fail';
      const result = flow.observe({ outcome, assisted, pressure: chance.timed ? Math.min(1, duration) : null, latencyMs: Math.round(duration * 10000) });
      let change = result.change;
      // The host offers less help after three quiet successes when nothing else just changed,
      // at most every ten responses (vellum-flow.supportStep decides this in a real content).
      if (adaptive && !change && flow.quietStreak() >= 3 && step - offered >= 10) { offered = step; if (rng() < (self.accepts ?? 0.6)) change = flow.acceptLessHelp(); }
      rows.push({ step, outcome, assisted, truth: chance.success, indices: before.indices, change });
      if (success && !assisted) { self.content += self.growth; self.speed += self.growth / 2; }
      at += 20000;
    }
    return { rows, final: flow.settings() };
  }
  function metrics(spec, rows, target) {
    const half = rows.slice(Math.floor(rows.length / 2));
    const off = row => Math.abs(row.truth - target);
    const adjustable = spec.knobs.filter(knob => knob.follows !== 'declared');
    // A floor is reached when every adjustable knob of one dimension (content incl. help, or pace)
    // is at its easiest: the content itself then needs an easier version for this person.
    const dimensions = [adjustable.filter(k => k.kind !== 'pace'), adjustable.filter(k => k.kind === 'pace')].filter(list => list.length);
    const atFloor = row => dimensions.some(list => list.every(k => row.indices[k.id] === 0));
    const runLength = test => { let best = 0, current = 0; for (const row of rows) { current = test(row) ? current + 1 : 0; best = Math.max(best, current); } return best; };
    let settleAt = null;
    for (let i = 0; i + 5 < rows.length && settleAt === null; i += 1) if (rows.slice(i, i + 6).every(row => off(row) <= 0.2)) settleAt = rows[i].step;
    const changes = rows.map(row => row.change).filter(Boolean);
    let bounces = 0, undone = 0;
    for (let i = 2; i < rows.length; i += 1) {
      const a = rows[i - 2].change, b = rows[i].change || rows[i - 1].change;
      if (a && b && a !== b && a.knob === b.knob && a.direction === -b.direction) bounces += 1;
    }
    // A raise taken back within two answers although the answer succeeded: the most confusing change to see.
    rows.forEach((row, i) => {
      const c = row.change;
      if (c && c.direction < 0 && row.outcome === 'success' && rows.slice(Math.max(0, i - 2), i).some(r => r.change?.knob === c.knob && r.change.direction > 0)) undone += 1;
    });
    return {
      inBand: Math.round(half.filter(row => off(row) <= 0.15).length / half.length * 100) / 100,
      meanError: Math.round(half.reduce((sum, row) => sum + off(row), 0) / half.length * 1000) / 1000,
      successRate: Math.round(rows.filter(row => row.outcome === 'success').length / rows.length * 100) / 100,
      timeouts: rows.filter(row => row.outcome === 'timeout').length,
      settleAt, changes: changes.length, bounces, undone,
      maxJump: changes.reduce((max, c) => Math.max(max, Math.abs(c.to - c.from)), 0),
      helpRaises: rows.filter(row => row.assisted && row.outcome === 'success' && row.change?.direction > 0).length,
      floorTooHard: runLength(row => atFloor(row) && row.truth < target - 0.15),
      ceilingTooEasy: runLength(row => adjustable.every(k => row.indices[k.id] === k.values.length - 1) && row.truth > target + 0.15),
    };
  }
  function simulate({ spec: input, personas = PERSONAS, steps = 60, seed = 'temper-flow', flow = null } = {}) {
    const Flow = flow || getFlow();
    if (!Flow || typeof Flow.start !== 'function') throw new Error('Temper: Flow unavailable');
    const spec = Flow.defineContent(input);
    if (!Number.isInteger(steps) || steps < 12 || steps > 2000 || typeof seed !== 'string') throw new TypeError('Temper: invalid simulation size');
    const results = personas.map(person => {
      const adapted = run(Flow, spec, person, { steps, seed, adaptive: true });
      const fixed = run(Flow, spec, person, { steps, seed, adaptive: false });
      return { id: person.id, label: person.label, adapted: metrics(spec, adapted.rows, spec.target), fixed: metrics(spec, fixed.rows, spec.target),
        final: adapted.final.values, path: adapted.rows.map(row => Math.round(row.truth * 100) / 100), fixedPath: fixed.rows.map(row => Math.round(row.truth * 100) / 100) };
    });
    const all = results.map(r => r.adapted);
    return { version: VERSION, content: `${spec.id}@${spec.version}`, policy: Flow.VERSION, steps, seed, target: spec.target, personas: results,
      invariants: { maxJump: Math.max(0, ...all.map(m => m.maxJump)), helpRaises: all.reduce((n, m) => n + m.helpRaises, 0) },
      learningEffectClaim: false,
      note: '가상 사람으로 구현과 규칙을 확인한 결과다. 실제 사람의 학습 효과·만족·성과의 증거가 아니다.' };
  }
  return Object.freeze({ VERSION, FLIP_WINDOW, COOL_DOWN, PERSONAS, check, truth, simulate });
});
