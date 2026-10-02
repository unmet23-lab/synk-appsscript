/* SYNK Core: "오늘 물어볼 한 가지" (Atlas design §5-1, implementation spec §4-4).
 * Canonical source: SYNK-appsscript/atlas/ask.js. Owned by Core; not a ninth engine.
 * Works for any decision a content makes: a practice plan, a game's settings, the
 * recommendation of a consultation or a personalised tool. A question is worth asking only
 * if one of its answers changes what is decided; the one that changes the most is asked.
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
  const VERSION = 'ask-1';
  const KINDS = ['setting', 'confirm', 'choice', 'refresh', 'follow_up'];
  const DAY = 86400000;
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
  const canonical = value => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
  const time = value => { const n = Date.parse(value); if (typeof value !== 'string' || !Number.isFinite(n)) throw new TypeError('Ask: invalid time'); return n; };
  function validate(questions) {
    if (!Array.isArray(questions)) throw new TypeError('Ask: questions must be an array');
    const ids = new Set();
    for (const q of questions) {
      if (!q || !id(q.id) || ids.has(q.id) || !KINDS.includes(q.kind ?? 'setting') || !id(q.about ?? q.id)
        || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 12) throw new TypeError(`Ask: invalid question ${q && q.id}`);
      ids.add(q.id);
      const options = new Set();
      for (const option of q.options) {
        if (!option || !id(option.id) || options.has(option.id) || (option.p != null && !(option.p >= 0 && option.p <= 1))) throw new TypeError(`Ask: invalid option in ${q.id}`);
        options.add(option.id);
      }
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
  /* Rank the questions not yet answered. `answers` maps `about` to the chosen option value;
   * `denied` lists questions the person asked not to hear again; `asked` maps question ids to
   * when they were last shown. Unknown answer chances are taken as equal (spec §4-4). */
  function rank({ questions, decide, answers = {}, denied = [], asked = {}, now = null, quietDays = 7 } = {}) {
    validate(questions);
    if (typeof decide !== 'function' || !answers || typeof answers !== 'object' || !Array.isArray(denied) || !asked || typeof asked !== 'object') throw new TypeError('Ask: invalid input');
    const current = decide({ ...answers });
    const result = [];
    for (const q of questions) {
      const about = q.about ?? q.id;
      if (Object.hasOwn(answers, about)) continue;
      if (denied.includes(q.id)) { result.push({ id: q.id, kind: q.kind ?? 'setting', about, impact: 0, skippable: true, reason: 'denied' }); continue; }
      if (Object.hasOwn(asked, q.id) && now !== null && time(now) - time(asked[q.id]) < quietDays * DAY) {
        result.push({ id: q.id, kind: q.kind ?? 'setting', about, impact: 0, skippable: true, reason: 'asked-recently' }); continue;
      }
      const weights = q.options.map(option => option.p ?? 1), total = weights.reduce((sum, w) => sum + w, 0) || 1;
      const outcomes = {};
      let impact = 0;
      q.options.forEach((option, index) => {
        const decided = decide({ ...answers, [about]: Object.hasOwn(option, 'value') ? option.value : option.id });
        outcomes[option.id] = decided;
        impact += weights[index] / total * difference(current, decided);
      });
      const distinct = new Set(Object.values(outcomes).map(canonical)).size;
      result.push({ id: q.id, kind: q.kind ?? 'setting', about, impact: Math.round(impact * 1000) / 1000, distinct,
        skippable: impact === 0, reason: impact === 0 ? 'no-change' : 'changes-decision', outcomes });
    }
    // Most decisive first; ties keep the content's own order.
    return result.map((entry, order) => ({ ...entry, order })).sort((a, b) => b.impact - a.impact || a.order - b.order).map(({ order, ...entry }) => entry);
  }
  // The one question to ask now, or none. A daily budget of one is the default (design §5-1).
  function choose({ budget = 1, usedToday = 0, ...input } = {}) {
    if (!Number.isInteger(budget) || budget < 0 || !Number.isInteger(usedToday) || usedToday < 0) throw new TypeError('Ask: invalid budget');
    const ranked = rank(input);
    if (usedToday >= budget) return { version: VERSION, status: 'none', reason: 'budget', ranked };
    const best = ranked.find(entry => entry.impact > 0);
    if (!best) return { version: VERSION, status: 'none', reason: 'no-question-changes-the-decision', ranked };
    return { version: VERSION, status: 'ask', question: input.questions.find(q => q.id === best.id), impact: best.impact, reason: best.reason, ranked };
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
  return Object.freeze({ VERSION, KINDS, rank, choose, fromAtlas });
});
