/* SYNK Core: "오늘 물어볼 한 가지" (Atlas design §5-1, implementation spec §4-4).
 * Canonical source: SYNK-appsscript/atlas/ask.js. Owned by Core; not a ninth engine.
 * Works for any decision a content makes: a practice plan, a game's settings, the
 * recommendation of a consultation or a personalised tool. A question is worth asking only
 * if one of its answers changes what is decided. By default the most change is asked;
 * a host may instead declare decision utility/loss and the cost of asking.
 * Questions whose answers change nothing for this person are skipped, so a consultation
 * gets shorter and sharper the more it already knows.
 * Pure: the decision function belongs to the content (Core.decide, a recommendation rule...).
 * No clock, storage, model call or identity. Answers never become a test or a score.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkAsk = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'ask-1.1';
  // A six-choice multi-select can have 63 nonempty answer scenarios. Products
  // still show the six choices; this bound is for the host's decision analysis.
  const MAX_OPTIONS = 64;
  const KINDS = ['setting', 'confirm', 'choice', 'refresh', 'follow_up'];
  const DAY = 86400000;
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
  const canonical = value => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
  const time = value => { const n = Date.parse(value); if (typeof value !== 'string' || !Number.isFinite(n)) throw new TypeError('Ask: invalid time'); return n; };
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const owns = (value, key) => Object.hasOwn(value, key);
  // Answer probabilities are a complete distribution, not arbitrary weights. With none
  // supplied, equal probabilities are an explicit fallback, never learned confidence.
  function probabilities(q) {
    const supplied = q.options.filter(option => owns(option, 'p')).length;
    if (!supplied) return q.options.map(() => 1 / q.options.length);
    if (supplied !== q.options.length || q.options.some(option => !finite(option.p) || option.p < 0 || option.p > 1)) throw new TypeError(`Ask: invalid probabilities in ${q.id}`);
    const total = q.options.reduce((sum, option) => sum + option.p, 0);
    if (Math.abs(total - 1) > 1e-9) throw new TypeError(`Ask: probabilities must sum to one in ${q.id}`);
    return q.options.map(option => option.p / total);
  }
  function validate(questions) {
    if (!Array.isArray(questions)) throw new TypeError('Ask: questions must be an array');
    const ids = new Set();
    for (const q of questions) {
      if (!q || !id(q.id) || ids.has(q.id) || !KINDS.includes(q.kind ?? 'setting') || !id(q.about ?? q.id)
        || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > MAX_OPTIONS) throw new TypeError(`Ask: invalid question ${q && q.id}`);
      ids.add(q.id);
      const options = new Set();
      for (const option of q.options) {
        if (!option || !id(option.id) || options.has(option.id)) throw new TypeError(`Ask: invalid option in ${q.id}`);
        options.add(option.id);
      }
      probabilities(q);
      if (owns(q, 'cost') && (!finite(q.cost) || q.cost < 0)) throw new TypeError(`Ask: invalid question cost in ${q.id}`);
      if (owns(q, 'responseProbability') && (!finite(q.responseProbability) || q.responseProbability < 0 || q.responseProbability > 1)) throw new TypeError(`Ask: invalid response probability in ${q.id}`);
    }
    return questions;
  }
  // How much an answer changes a decision: a decision that names `content` and `shape` counts a
  // content change twice (spec §4-4); any other decision counts a change once.
  function difference(a, b) {
    if (a && b && typeof a === 'object' && typeof b === 'object' && ('content' in a || 'shape' in a)) {
      return (canonical(a.content) !== canonical(b.content) ? 2 : 0) + (canonical(a.shape) !== canonical(b.shape) ? 1 : 0);
    }
    return canonical(a) === canonical(b) ? 0 : 1;
  }
  // The host evaluates both decisions under the SAME hypothetical answer. Utility, loss
  // and question cost must share a unit across all questions. These are declared policy
  // values, not accuracy, a measured causal effect or an inference about the person.
  function decisionValue(evaluate, context) {
    const value = evaluate(context);
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some(key => !['utility', 'loss'].includes(key))
      || (!owns(value, 'utility') && !owns(value, 'loss'))
      || (owns(value, 'utility') && !finite(value.utility))
      || (owns(value, 'loss') && (!finite(value.loss) || value.loss < 0))) throw new TypeError('Ask: evaluate must return finite utility and/or nonnegative loss');
    const result = (value.utility ?? 0) - (value.loss ?? 0);
    if (!finite(result)) throw new TypeError('Ask: nonfinite decision value');
    return result;
  }
  /* Rank the questions not yet answered. `answers` maps `about` to the chosen option value;
   * `denied` lists questions the person asked not to hear again; `asked` maps question ids to
   * when they were last shown. Unknown answer chances are taken as equal (spec §4-4).
   * Optional pure evaluate({decision, answers, question, option}) returns {utility?, loss?}.
   * In this mode value = responseProbability * expectedGain - cost; no answer keeps the
   * current decision. A question is still skipped when it cannot change the decision. */
  function rank({ questions, decide, answers = {}, denied = [], asked = {}, now = null, quietDays = 7, evaluate } = {}) {
    validate(questions);
    if (typeof decide !== 'function' || !answers || typeof answers !== 'object' || !Array.isArray(denied) || !asked || typeof asked !== 'object') throw new TypeError('Ask: invalid input');
    if (evaluate !== undefined && typeof evaluate !== 'function') throw new TypeError('Ask: evaluate must be a function');
    const valued = typeof evaluate === 'function';
    if (!valued && questions.some(q => owns(q, 'cost') || owns(q, 'responseProbability'))) throw new TypeError('Ask: question cost and response probability require evaluate');
    const current = decide({ ...answers });
    const result = [];
    for (const q of questions) {
      const about = q.about ?? q.id;
      if (Object.hasOwn(answers, about)) continue;
      if (denied.includes(q.id)) { result.push({ id: q.id, kind: q.kind ?? 'setting', about, impact: 0, skippable: true, reason: 'denied' }); continue; }
      if (Object.hasOwn(asked, q.id) && now !== null && time(now) - time(asked[q.id]) < quietDays * DAY) {
        result.push({ id: q.id, kind: q.kind ?? 'setting', about, impact: 0, skippable: true, reason: 'asked-recently' }); continue;
      }
      const chances = probabilities(q);
      // Option IDs are data: even "__proto__" must remain an own, serializable key.
      const outcomes = Object.create(null);
      let impact = 0, expectedGain = 0;
      q.options.forEach((option, index) => {
        const scenario = { ...answers, [about]: owns(option, 'value') ? option.value : option.id };
        const decided = decide({ ...scenario });
        outcomes[option.id] = decided;
        impact += chances[index] * difference(current, decided);
        if (valued && chances[index] > 0) {
          const context = { answers: scenario, question: q, option };
          const gain = decisionValue(evaluate, { ...context, decision: decided }) - decisionValue(evaluate, { ...context, decision: current });
          if (!finite(gain)) throw new TypeError('Ask: nonfinite decision gain');
          expectedGain += chances[index] * gain;
        }
      });
      const distinct = new Set(Object.values(outcomes).map(canonical)).size;
      const cost = q.cost ?? 0, responseProbability = q.responseProbability ?? 1, value = responseProbability * expectedGain - cost;
      if (valued && (!finite(expectedGain) || !finite(value))) throw new TypeError('Ask: nonfinite expected decision value');
      const skippable = impact === 0 || (valued && value <= 0);
      result.push({ id: q.id, kind: q.kind ?? 'setting', about, impact: Math.round(impact * 1000) / 1000, distinct,
        skippable, reason: impact === 0 ? 'no-change' : valued ? (value > 0 ? 'positive-decision-value' : 'no-positive-decision-value') : 'changes-decision', outcomes,
        ...(valued ? { basis: 'declared-decision-value', expectedGain, responseProbability, cost, value } : {}) });
    }
    // Most valuable (or most decisive) first; ties keep the content's own order.
    const score = entry => valued ? entry.value ?? 0 : entry.impact;
    return result.map((entry, order) => ({ ...entry, order })).sort((a, b) => score(b) - score(a) || a.order - b.order).map(({ order, ...entry }) => entry);
  }
  // The one question to ask now, or none. A daily budget of one is the default (design §5-1).
  function choose({ budget = 1, usedToday = 0, ...input } = {}) {
    if (!Number.isInteger(budget) || budget < 0 || !Number.isInteger(usedToday) || usedToday < 0) throw new TypeError('Ask: invalid budget');
    const ranked = rank(input);
    if (usedToday >= budget) return { version: VERSION, status: 'none', reason: 'budget', ranked };
    const valued = typeof input.evaluate === 'function';
    const best = ranked.find(entry => !entry.skippable && (valued ? entry.value > 0 : entry.impact > 0));
    if (!best) return { version: VERSION, status: 'none', reason: valued ? 'no-question-has-positive-decision-value' : 'no-question-changes-the-decision', ranked };
    return { version: VERSION, status: 'ask', question: input.questions.find(q => q.id === best.id), impact: best.impact, reason: best.reason, ranked,
      ...(valued ? { value: best.value, basis: best.basis } : {}) };
  }
  /* For an Atlas session: a `setting` question answers a context field (`field`), a `confirm`
   * question answers an understanding line (`line`). Answers are tried as temporary events on a
   * copy; the person's log is never changed. Content counts the selected experience and content
   * levers; shape counts the other levers (spec §4-4: content 2, shape 1). */
  function fromAtlas({ engine, events = [], scope, at, experienceId, candidates, levers = [], questions, ...rest } = {}) {
    if (!engine || typeof engine.decide !== 'function') throw new TypeError('Ask: Core engine required');
    validate(questions);
    const byAbout = new Map(questions.map(q => [q.about ?? q.id, q]));
    const decide = answers => {
      const extra = [];
      for (const [about, value] of Object.entries(answers)) {
        const q = byAbout.get(about);
        if (!q) continue;
        const base = { schema: 1, id: `ask-virtual-${q.id}`, scope, at, recordedAt: at };
        if (q.kind === 'confirm') extra.push({ ...base, type: 'estimate.responded', line: q.line, value });
        else extra.push({ ...base, type: 'context.set', field: q.field ?? about, value, until: null });
      }
      const plan = engine.decide({ events: [...events, ...extra], scope, at, experienceId, candidates, levers });
      if (plan.status !== 'ready') return { content: 'unavailable', shape: null };
      const classes = Object.fromEntries(levers.map(lever => [lever.id, lever.class]));
      const content = [plan.selected.id], shape = [];
      for (const [lever, pick] of Object.entries(plan.bundle)) if (lever !== 'mode') (classes[lever] === 'content' ? content : shape).push(`${lever}=${pick.option}`);
      return { content, shape };
    };
    return choose({ ...rest, questions, decide });
  }
  return Object.freeze({ VERSION, MAX_OPTIONS, KINDS, rank, choose, fromAtlas });
});
