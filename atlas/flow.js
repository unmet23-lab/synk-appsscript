/* SYNK Core: moment-level challenge ("순간 맞춤", Atlas design §5-2 작업 난이도).
 * Canonical source: SYNK-appsscript/atlas/flow.js. Owned by Core; not a ninth engine.
 * A content declares knobs whose values are ordered easy -> hard. Core keeps two
 * operational estimates per content: how much content challenge and how much time
 * pressure this person handles right now. After a response it turns one knob by one
 * step so the person stays near the content's target success rate.
 * Pure: no I/O, clock, network, model call or identity. The host passes time and stores memory.
 * The estimates are never a score, grade or mastery claim, and are never shown as one.
 * Only the person's own declared choices and responses move the knobs. There is no
 * field for age, gender, nationality or any demographic, and none is accepted.
 * Help never raises the challenge, and less help is offered and accepted, never imposed.
 * Temper's guard (temper-flow.js) has the last word on every change.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(() => require('./temper-flow'));
  else root.SynkFlow = factory(() => root.SynkTemperFlow);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (getGuard) {
  'use strict';
  const VERSION = 'flow-1';
  const KINDS = ['content', 'pace', 'support'];
  const OUTCOMES = ['success', 'fail', 'timeout', 'skip', 'void'];
  const MODES = ['auto', 'fixed', 'easier', 'harder'];
  const CONDITIONS = ['good', 'okay', 'tired', 'no_time'];
  const DIMENSIONS = ['content', 'pace'];
  const DAY = 86400000, RETURN_AFTER = 14 * DAY, LATENCIES = 20;
  /* Step size in logits. It shrinks when the evidence changes direction and recovers after
   * four answers in a row point the same way, so a fast-changing person is still followed. */
  const RATE = Object.freeze({ max: 1.2, half: 3, min: 0.3, recover: 4 });
  // Quiet successes in a row that earn one step up even when the estimate lags behind.
  const STREAK = 4;
  // About two quiet successes move up one step; one miss moves down (frustration costs more than ease).
  const DEADBAND = 0.75;
  // Running out of time is the most frustrating miss, so pace aims to keep it rare.
  const PACE_TARGET = 0.9;
  const ITEM = 'item.difficulty';
  const copy = value => JSON.parse(JSON.stringify(value));
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
  const scalar = value => ['number', 'string', 'boolean'].includes(typeof value) && (typeof value !== 'number' || Number.isFinite(value));
  const within = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  const sigmoid = x => 1 / (1 + Math.exp(-x));
  const logit = p => Math.log(p / (1 - p));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;
  const time = value => { const n = Date.parse(value); if (typeof value !== 'string' || !Number.isFinite(n)) throw new TypeError('Flow: invalid time'); return n; };
  const fail = message => { throw new TypeError(`Flow: ${message}`); };
  const dimensionOf = knob => (knob.kind === 'pace' ? 'pace' : 'content');

  /* A content's declaration. Each knob lists its values easiest first; `start` is the content's
   * own default. kind: 'content' (what is asked), 'pace' (time pressure) or 'support' (help).
   * `follows: 'declared'` means only the person's own choice moves it (text size, motion...).
   * `items` adds the item difficulty levels the content can draw from as the first content knob. */
  const defined = new WeakSet();
  function defineContent(input) {
    if (defined.has(input)) return input;
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('content spec required');
    if (Object.keys(input).some(key => !['id', 'version', 'target', 'scale', 'knobs', 'items'].includes(key))) fail('unknown spec field');
    const spec = { id: input.id, version: input.version ?? 1, target: input.target ?? 0.75, scale: input.scale ?? 0.5, knobs: [], items: null };
    if (!id(spec.id) || !Number.isInteger(spec.version) || spec.version < 1) fail('invalid content id or version');
    if (!within(spec.target, 0.55, 0.9) || !within(spec.scale, 0.2, 1.5)) fail('target must be 0.55-0.9 and scale 0.2-1.5');
    const knobs = input.knobs ?? [];
    if (!Array.isArray(knobs) || knobs.length > 8 || (!knobs.length && !input.items)) fail('one to eight knobs required');
    const seen = new Set([ITEM]);
    if (input.items != null) {
      const items = input.items;
      if (!items || typeof items !== 'object' || Object.keys(items).some(key => !['levels', 'weight', 'start'].includes(key))) fail('invalid item levels');
      const levels = items.levels ?? [1, 2, 3], start = items.start ?? 0, weight = items.weight ?? 2;
      if (!Array.isArray(levels) || levels.length < 2 || levels.length > 6
        || !levels.every((level, index) => Number.isInteger(level) && (index === 0 || level > levels[index - 1]))
        || !Number.isInteger(start) || start < 0 || start >= levels.length || !within(weight, 0.25, 4)) fail('invalid item levels');
      spec.items = { levels: [...levels], weight, start };
      spec.knobs.push({ id: ITEM, values: [...levels], start, weight, kind: 'content', follows: null, label: 'item difficulty' });
    }
    for (const knob of knobs) {
      const keys = ['id', 'values', 'start', 'weight', 'kind', 'follows', 'label'];
      if (!knob || typeof knob !== 'object' || Object.keys(knob).some(key => !keys.includes(key))) fail('invalid knob');
      const value = { id: knob.id, values: knob.values, start: knob.start ?? 0, weight: knob.weight ?? 1, kind: knob.kind ?? 'content', follows: knob.follows ?? null, label: knob.label ?? knob.id };
      if (!id(value.id) || seen.has(value.id) || !Array.isArray(value.values) || value.values.length < 2 || value.values.length > 12
        || !value.values.every(scalar) || !Number.isInteger(value.start) || value.start < 0 || value.start >= value.values.length
        || !within(value.weight, 0.25, 4) || !KINDS.includes(value.kind) || ![null, 'declared'].includes(value.follows)
        || typeof value.label !== 'string' || value.label.length > 60) fail(`invalid knob ${knob && knob.id}`);
      seen.add(value.id); spec.knobs.push(value);
    }
    const result = Object.freeze(copy(spec));
    defined.add(result);
    return result;
  }
  // Challenge of one dimension in logits: authored steps times the content's scale.
  const challenge = (spec, indices, dimension = null) => spec.scale * spec.knobs.reduce((sum, knob) =>
    sum + (dimension === null || dimensionOf(knob) === dimension ? knob.weight * indices[knob.id] : 0), 0);
  const defaults = spec => Object.fromEntries(spec.knobs.map(knob => [knob.id, knob.start]));
  const has = (spec, dimension) => spec.knobs.some(knob => dimensionOf(knob) === dimension && knob.follows !== 'declared');
  /* What each dimension aims for so that their product is the overall aim. At the content's own
   * target, time aims for PACE_TARGET and content for the rest. A day chosen to be easier (or a
   * harder one) moves both aims by the same factor, so neither the clock nor the content is the
   * one that gets harder sooner. */
  function targets(spec, overall) {
    const timed = has(spec, 'pace'), contented = has(spec, 'content');
    if (!(timed && contented)) return { content: contented ? overall : PACE_TARGET, pace: timed ? overall : PACE_TARGET };
    const pace = clamp(PACE_TARGET * Math.sqrt(overall / spec.target), 0.75, 0.97);
    return { content: clamp(overall / pace, 0.55, 0.95), pace };
  }

  function validMemory(spec, memory) {
    const estimate = value => value && typeof value === 'object' && within(value.theta, -20, 20) && within(value.n, 0, 1e6) && within(value.reversals, 0, 1e6);
    if (memory == null || typeof memory !== 'object' || memory.v !== 2 || memory.content !== spec.id || memory.specVersion !== spec.version
      || !estimate(memory.estimates?.content) || !estimate(memory.estimates?.pace)
      || typeof memory.at !== 'string' || !Number.isFinite(Date.parse(memory.at)) || !memory.indices || typeof memory.indices !== 'object'
      || !Array.isArray(memory.latencies) || memory.latencies.length > LATENCIES || !memory.latencies.every(ms => within(ms, 0, 600000))) return null;
    const indices = {};
    for (const knob of spec.knobs) {
      const index = memory.indices[knob.id];
      indices[knob.id] = Number.isInteger(index) && index >= 0 && index < knob.values.length ? index : knob.start;
    }
    return { estimates: copy(memory.estimates), at: memory.at, indices, latencies: [...memory.latencies] };
  }

  /* Where a person starts in a content they have not played, from Core's practice summary
   * (learning.js). Each item level whose skills are all recent independent work moves the start
   * one level up. Unseen, supported or mixed evidence keeps the content's own default. */
  function priorFromSummary(input, summary, skillIds = []) {
    const spec = defineContent(input);
    if (!spec.items || !summary || !Array.isArray(summary.skills) || !Array.isArray(skillIds) || !skillIds.length) return null;
    const skills = skillIds.map(skill => summary.skills.find(s => s.id === skill));
    if (skills.some(skill => !skill)) return null;
    let level = spec.items.start;
    for (let index = spec.items.start; index < spec.items.levels.length - 1; index += 1) {
      const authored = spec.items.levels[index];
      const steady = skills.every(skill => {
        const formats = skill.levels?.[authored]?.formats;
        return !!formats && Object.values(formats).some(f => f.status === 'recent-independent');
      });
      if (!steady) break;
      level = index + 1;
    }
    if (level === spec.items.start) return null;
    const indices = { ...defaults(spec), [ITEM]: level };
    return { content: challenge(spec, indices, 'content') + logit(targets(spec, spec.target).content), level: spec.items.levels[level], basis: 'practice-summary' };
  }

  /* The settings a person chose (Core personalization, `selectPersonalization().presentation`)
   * as this content's declared locks, design 아틀라스_순간맞춤 §9. The vocabulary is the
   * personalization adapter's; a test keeps the two equal.
   * support 'step' holds every adjustable help knob at its most help (the first value),
   * 'independent' at its least, and 'choose' leaves help to the round, where less help is
   * only offered and accepted. textSize, motion and explanation set the content's
   * `follows: 'declared'` knob of the same id when it lists that value. audio belongs to
   * choosing the session, not to the round. Nothing else is a presentation setting: minutes,
   * goals, reasons, age or any demographic are refused here. */
  const PRESENTATION = Object.freeze({
    support: Object.freeze(['choose', 'step', 'independent']),
    textSize: Object.freeze(['standard', 'large']),
    explanation: Object.freeze(['brief', 'standard', 'detailed']),
    motion: Object.freeze(['full', 'reduced']),
    audio: Object.freeze(['off', 'available']),
  });
  const FOLLOWED = ['textSize', 'motion', 'explanation'];
  function declaredFrom(input, presentation) {
    const spec = defineContent(input);
    if (!presentation || typeof presentation !== 'object' || Array.isArray(presentation)
      || Object.keys(presentation).some(key => !Object.hasOwn(PRESENTATION, key))) fail(`presentation accepts only ${Object.keys(PRESENTATION).join(', ')}`);
    for (const [key, value] of Object.entries(presentation)) if (value != null && !PRESENTATION[key].includes(value)) fail(`invalid presentation ${key}`);
    const support = presentation.support ?? 'choose', knobs = {};
    for (const knob of spec.knobs) {
      if (knob.follows === 'declared') {
        const index = FOLLOWED.includes(knob.id) && presentation[knob.id] != null ? knob.values.indexOf(presentation[knob.id]) : -1;
        if (index >= 0) knobs[knob.id] = index;
      } else if (knob.kind === 'support' && support !== 'choose') knobs[knob.id] = support === 'step' ? 0 : knob.values.length - 1;
    }
    return { knobs };
  }

  const START = ['spec', 'memory', 'prior', 'declared', 'condition', 'arm', 'now'];
  function start(options = {}) {
    // Nothing else is accepted: no profile, age, gender, nationality or other demographic input.
    if (!options || typeof options !== 'object' || Object.keys(options).some(key => !START.includes(key))) fail(`start accepts only ${START.join(', ')}`);
    const { spec: input, memory = null, prior = null, declared = {}, condition = null, arm = 'adapted', now } = options;
    const spec = defineContent(input), guard = getGuard();
    if (!guard || typeof guard.check !== 'function') throw new Error('Flow: Temper guard unavailable');
    if (!declared || typeof declared !== 'object' || Array.isArray(declared) || Object.keys(declared).some(key => !['mode', 'knobs'].includes(key))) fail('declared must be { mode, knobs }');
    const mode = declared.mode ?? 'auto', locks = { ...(declared.knobs ?? {}) };
    if (!MODES.includes(mode)) fail('invalid declared mode');
    for (const [knobId, index] of Object.entries(locks)) {
      const knob = spec.knobs.find(k => k.id === knobId);
      if (!knob || !Number.isInteger(index) || index < 0 || index >= knob.values.length) fail(`invalid declared knob ${knobId}`);
    }
    if (condition !== null && !CONDITIONS.includes(condition)) fail('invalid condition');
    if (!['adapted', 'baseline'].includes(arm)) fail('invalid arm');
    if (prior !== null && (typeof prior !== 'object' || !within(prior.content, -20, 20))) fail('invalid prior');
    const startedAt = time(now), remembered = validMemory(spec, memory);
    let overall = spec.target + (mode === 'easier' ? 0.1 : mode === 'harder' ? -0.1 : 0) + (condition === 'tired' ? 0.08 : 0);
    overall = clamp(overall, 0.55, 0.92);
    const aim = targets(spec, overall);
    // The content's own default is the anchor: a new person starts exactly there.
    const base = defaults(spec);
    const fresh = dimension => ({ theta: challenge(spec, base, dimension) + logit(targets(spec, spec.target)[dimension]), n: 0, reversals: 0, streak: 0, sign: 0 });
    const estimates = { content: fresh('content'), pace: fresh('pace') };
    let basis = 'default', indices = { ...base };
    if (remembered) {
      for (const dimension of DIMENSIONS) Object.assign(estimates[dimension], remembered.estimates[dimension], { streak: 0, sign: 0 });
      indices = { ...remembered.indices }; basis = 'memory';
    } else if (prior) { estimates.content.theta = prior.content; basis = 'prior'; }
    // Back after a long gap: quick to re-learn (the opening below starts a step lighter).
    // No count of days is kept or shown.
    const returning = !!remembered && startedAt - time(remembered.at) > RETURN_AFTER;
    if (returning) for (const dimension of DIMENSIONS) estimates[dimension].reversals = Math.min(estimates[dimension].reversals, 1);
    const adaptive = arm === 'adapted' && mode !== 'fixed';
    // A tired day (design §4-9): nothing gets harder during the round and less help is not offered.
    // Easing still happens, and the higher aims above may ease the start.
    const calm = condition === 'tired';
    const locked = knob => Object.hasOwn(locks, knob.id) || knob.follows === 'declared';
    // Where the adapted rounds had reached. A fixed or comparison round, or a knob set by hand,
    // plays elsewhere today but never overwrites this place in memory.
    const reached = { ...indices };
    for (const knob of spec.knobs) {
      if (Object.hasOwn(locks, knob.id)) indices[knob.id] = locks[knob.id];
      // A fixed or comparison round keeps the content's defaults (declared locks always hold).
      else if (!adaptive || knob.follows === 'declared') indices[knob.id] = knob.start;
    }
    const latencies = remembered ? remembered.latencies : [];
    const changes = [], trace = [];
    // `step` counts responses that were evidence: Temper's pauses are measured in those only.
    // `steady` counts successes in a row, with help or without: where help shows before every
    // answer no success can be quiet, and less help must still be askable (vellum-flow.supportStep).
    let step = 0, responses = 0, quiet = 0, steady = 0, last = null;
    // Opening steps taken only for today's choice (a tired day, a round chosen easier or harder).
    // They are undone in what is kept, so the next day starts where adapted play reached.
    const TODAY_ONLY = ['tired', 'declared-easier', 'declared-harder'];
    const todayOnly = {};
    const gap = dimension => (estimates[dimension].theta - logit(aim[dimension]) - challenge(spec, indices, dimension)) / spec.scale;
    const chance = (dimension, at = indices) => sigmoid(estimates[dimension].theta - challenge(spec, at, dimension));
    const expected = (at = indices) => (has(spec, 'content') ? chance('content', at) : 1) * (has(spec, 'pace') ? chance('pace', at) : 1);
    // An estimate never runs far beyond what the content can express, so a change of heart is met quickly.
    // A knob set by hand for today does not narrow this: the estimate is about the person, not today's choice.
    const span = dimension => {
      const knobs = spec.knobs.filter(knob => dimensionOf(knob) === dimension);
      const fixed = knob => knob.follows === 'declared' ? indices[knob.id] : null;
      const low = spec.scale * knobs.reduce((sum, k) => sum + k.weight * (fixed(k) ?? 0), 0);
      const high = spec.scale * knobs.reduce((sum, k) => sum + k.weight * (fixed(k) ?? k.values.length - 1), 0);
      return [low + logit(aim[dimension]) - 2 * spec.scale, high + logit(aim[dimension]) + 2 * spec.scale];
    };
    const bound = dimension => { const [low, high] = span(dimension); estimates[dimension].theta = clamp(estimates[dimension].theta, low, high); };
    function learn(dimension, y, weight, ceiling = Infinity) {
      const e = estimates[dimension], p = chance(dimension), sign = Math.sign(y - p);
      if (sign && e.sign && sign !== e.sign) { e.reversals += 1; e.streak = 0; }
      else if (sign) { e.streak += 1; if (e.streak >= RATE.recover) { e.reversals = Math.max(0, e.reversals - 1); e.streak = 0; } }
      if (sign) e.sign = sign;
      const rate = Math.max(RATE.min, RATE.max / (1 + e.reversals / RATE.half));
      e.theta = clamp(e.theta + Math.min(ceiling, rate * weight * (y - p)), -20, 20);
      e.n += weight;
      bound(dimension);
    }
    function because(direction, knob, observed) {
      if (direction > 0) return knob.kind === 'pace' ? 'comfortable-success' : 'steady-success';
      if (observed?.assisted && observed.outcome === 'success') return 'help-needed';
      if (knob.kind === 'pace') return observed?.outcome === 'timeout' ? 'time-ran-out' : 'time-pressure';
      if (knob.kind === 'support') return 'more-help';
      return 'content-miss';
    }
    // One knob, one step, in one dimension, inside Temper's rails. Content eases content knobs
    // before adding help; less help is never chosen here.
    function settle(dimension, direction, observed, reason, phase = 'response') {
      const pool = spec.knobs.filter(knob => dimensionOf(knob) === dimension && !locked(knob) && (direction < 0 || knob.kind !== 'support'));
      // Raise gently (the smallest step first); ease firmly (the largest relief first, help last).
      const byWeight = list => [...list].sort((a, b) => direction > 0 ? a.weight - b.weight : b.weight - a.weight);
      const ordered = [...byWeight(pool.filter(k => k.kind !== 'support')), ...byWeight(pool.filter(k => k.kind === 'support'))];
      for (const knob of ordered) {
        const from = indices[knob.id], to = from + direction;
        if (to < 0 || to >= knob.values.length) continue;
        // A raise that would land where the next answer eases it again is not taken (a big step waits
        // for a clearer lead). A quiet-streak step is tentative and checked on its own below.
        if (direction > 0 && phase === 'response' && reason !== 'quiet-streak' && gap(dimension) - knob.weight <= -DEADBAND) continue;
        if (!guard.check({ spec, knob: knob.id, from, to, step, phase, history: changes, frozen: !adaptive }).ok) continue;
        indices[knob.id] = to;
        const change = { step, phase, knob: knob.id, kind: knob.kind, dimension, from, to, direction, because: reason || because(direction, knob, observed), value: knob.values[to] };
        changes.push(change); return change;
      }
      return null;
    }
    /* Opening placement. A prior may take several steps toward the estimate. Memory resumes where
     * the person left off and only eases for today's choices; after a long gap it starts one step
     * lighter than last time, and the estimate is brought down to agree with that start.
     * A tired day's opening only eases. */
    for (const dimension of DIMENSIONS) bound(dimension);
    const opening = [];
    if (adaptive && returning) {
      for (const dimension of DIMENSIONS) {
        const change = settle(dimension, -1, null, 'returning', 'opening');
        if (change) { opening.push(change); break; }
      }
      for (const dimension of DIMENSIONS) estimates[dimension].theta = Math.min(estimates[dimension].theta, logit(aim[dimension]) + challenge(spec, indices, dimension));
    } else if (adaptive) {
      const limit = basis === 'memory' ? 2 : 12, easeOnly = basis === 'memory' || calm;
      for (let moves = 0; moves < limit; moves += 1) {
        const dimension = DIMENSIONS.filter(d => Math.abs(gap(d)) >= DEADBAND && (!easeOnly || gap(d) < 0)).sort((a, b) => Math.abs(gap(b)) - Math.abs(gap(a)))[0];
        if (!dimension) break;
        const direction = Math.sign(gap(dimension));
        const reason = direction > 0 ? (mode === 'harder' ? 'declared-harder' : 'prior')
          : condition === 'tired' ? 'tired' : mode === 'easier' ? 'declared-easier' : 'prior';
        const change = settle(dimension, direction, null, reason, 'opening');
        if (!change) break;
        opening.push(change);
        if (TODAY_ONLY.includes(change.because)) todayOnly[change.knob] = (todayOnly[change.knob] || 0) + change.direction;
      }
    }
    const intro = !adaptive ? (arm === 'baseline' ? 'baseline' : 'fixed') : returning ? 'returning' : condition === 'tired' ? 'tired' : basis;
    const settings = () => ({ content: spec.id, policy: VERSION, arm, mode, adaptive,
      values: Object.fromEntries(spec.knobs.map(knob => [knob.id, knob.values[indices[knob.id]]])),
      indices: { ...indices }, expected: round(expected(), 2), level: spec.items ? spec.items.levels[indices[ITEM]] : null });
    return {
      spec,
      settings,
      intro: () => ({ code: `start.${intro}`, opening: copy(opening) }),
      // The item level the content should draw next, or the nearest level it actually has.
      level(available) {
        if (!spec.items) return null;
        const wanted = spec.items.levels[indices[ITEM]];
        if (!Array.isArray(available) || !available.length) return wanted;
        return [...new Set(available)].sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || a - b)[0];
      },
      /* After each response. `pressure` is the share of the allowed time used (0-1) when the
       * content knows it; `assisted` means help was on screen before the answer; `repeat` means the
       * item was met before; `level` is the item level actually answered. A skipped or void
       * response (audio failed, app hidden, wrong control) is not evidence and moves nothing. */
      observe({ outcome, assisted = false, repeat = false, pressure = null, latencyMs = null, level = null } = {}) {
        if (!OUTCOMES.includes(outcome) || typeof assisted !== 'boolean' || typeof repeat !== 'boolean'
          || (pressure !== null && !within(pressure, 0, 1.5)) || (latencyMs !== null && !within(latencyMs, 0, 600000))) fail('invalid observation');
        if (level !== null && (!spec.items || !spec.items.levels.includes(level))) fail('invalid item level');
        // Content: what was answered (a timeout says nothing about content). Pace: whether there was time.
        const aboutContent = outcome === 'success' || (outcome === 'fail' && !(pressure !== null && pressure >= 1));
        const aboutPace = has(spec, 'pace') && ['success', 'fail', 'timeout'].includes(outcome);
        const evidence = aboutContent || aboutPace;
        responses += 1;
        if (evidence) step += 1;
        const shown = { ...indices };
        if (level !== null) shown[ITEM] = spec.items.levels.indexOf(level);
        const before = expected(shown), saved = { ...indices };
        indices = shown;
        if (aboutContent) {
          if (outcome === 'success') learn('content', assisted ? 0.5 : 1, repeat && !assisted ? 0.5 : 1, assisted ? 0 : Infinity);
          else learn('content', 0, 1);
        }
        // Answers near the limit count as only half in time. Without a measured share of time,
        // an answer in time still says "in time", at half weight.
        if (aboutPace) {
          if (outcome === 'timeout') learn('pace', 0, 1);
          else if (pressure !== null) learn('pace', 1 - 0.5 * clamp((pressure - 0.5) / 0.5, 0, 1), 1);
          else learn('pace', 1, 0.5);
        }
        indices = saved;
        if (outcome === 'success' && !assisted && !repeat) { quiet += 1; if (latencyMs !== null) latencies.push(Math.round(latencyMs)); }
        else if (evidence) quiet = 0;
        if (outcome === 'success') steady += 1;
        else if (outcome === 'fail' || outcome === 'timeout') steady = 0;
        while (latencies.length > LATENCIES) latencies.shift();
        last = { outcome, assisted, repeat, pressure };
        let change = null;
        if (adaptive && evidence) {
          // Easing comes first: the dimension furthest below its aim, then any raise that is due.
          const lower = DIMENSIONS.filter(d => gap(d) <= -DEADBAND).sort((a, b) => gap(a) - gap(b));
          // Only a success done alone raises: never the answer that was missed, timed out or helped,
          // even when the other dimension looks ready.
          const raise = !calm && outcome === 'success' && !assisted
            ? DIMENSIONS.filter(d => gap(d) >= DEADBAND && !(d === 'pace' && pressure !== null && pressure >= 0.85)).sort((a, b) => gap(b) - gap(a)) : [];
          for (const dimension of lower) { change = settle(dimension, -1, last); if (change) break; }
          if (!change && !lower.length) for (const dimension of raise) { change = settle(dimension, 1, last); if (change) break; }
          // "Done on their own several times in a row: one step up" (design §5-2). This also catches
          // a person who is learning faster than the estimate moves; the estimate follows the step.
          if (!change && !lower.length && quiet >= STREAK && !calm) {
            const ready = DIMENSIONS.filter(d => gap(d) >= 0 && !(d === 'pace' && pressure !== null && pressure > 0.5))
              .sort((a, b) => gap(b) - gap(a) || (a === 'content' ? -1 : 1));
            for (const dimension of ready) {
              change = settle(dimension, 1, last, 'quiet-streak');
              // Only a step the person can still meet near the aim; otherwise undo it and wait.
              if (change && chance(dimension) < aim[dimension] - 0.15) { indices[change.knob] = change.from; changes.pop(); change = null; continue; }
              if (change) {
                // A tentative step: the estimate moves just enough to hold it, so one miss brings it back.
                estimates[dimension].theta = Math.max(estimates[dimension].theta, logit(aim[dimension]) + challenge(spec, indices, dimension) - spec.scale / 2);
                quiet = 0; break;
              }
            }
          }
        }
        // A help level that just changed earns its own run of successes before less help is asked.
        if (change && change.kind === 'support') steady = 0;
        trace.push({ response: responses, step, outcome, assisted, repeat, pressure, expected: round(before, 3),
          content: round(estimates.content.theta, 3), pace: round(estimates.pace.theta, 3), change: change && copy(change) });
        return { change: change && copy(change), settings: settings(), evidence };
      },
      /* The person accepted an offer of less help (vellum-flow.supportStep). One support knob
       * moves one step toward less help; nothing else changes. Not in the same response as
       * another change, nor right after a raise, nor on a tired day; the offer can come again later. */
      lessHelpAllowed() {
        const knob = spec.knobs.find(k => k.kind === 'support' && !locked(k) && indices[k.id] < k.values.length - 1);
        return !!knob && adaptive && !calm && guard.check({ spec, knob: knob.id, from: indices[knob.id], to: indices[knob.id] + 1, step, phase: 'accepted', history: changes, frozen: false }).ok;
      },
      acceptLessHelp() {
        const knob = spec.knobs.find(k => k.kind === 'support' && !locked(k) && indices[k.id] < k.values.length - 1);
        if (!knob || !adaptive || calm) return null;
        const from = indices[knob.id], to = from + 1;
        if (!guard.check({ spec, knob: knob.id, from, to, step, phase: 'accepted', history: changes, frozen: false }).ok) return null;
        indices[knob.id] = to;
        // Held like a tentative step: the estimate moves just enough to keep the person's choice, so the
        // next opening does not quietly take it back (helped successes never raise the estimate), and a
        // miss still brings the help back.
        estimates.content.theta = Math.max(estimates.content.theta, logit(aim.content) + challenge(spec, indices, 'content') - spec.scale / 2);
        const change = { step, phase: 'accepted', knob: knob.id, kind: knob.kind, dimension: 'content', from, to, direction: 1, because: 'accepted-less-help', value: knob.values[to] };
        // The run of successes was spent on this step; the new help level earns its own.
        steady = 0;
        changes.push(change); return copy(change);
      },
      quietStreak: () => quiet,
      steadyStreak: () => steady,
      // Dimensions whose adjustable knobs are all at their easiest. When the person still struggles
      // there, the content itself has no easier step left: suggest an easier content instead.
      floor: () => DIMENSIONS.filter(d => { const knobs = spec.knobs.filter(k => dimensionOf(k) === d && !locked(k)); return knobs.length > 0 && knobs.every(k => indices[k.id] === 0); }),
      latencies: () => [...latencies],
      trace: () => copy(trace),
      changes: () => copy(changes),
      last: () => last && { ...last },
      // What the host stores for next time: per content, no identity, no answers, no text.
      // The estimates learn in every round; the place kept is only where adapted play reached,
      // without the opening steps taken for today's choice alone.
      memory: at => ({ v: 2, content: spec.id, specVersion: spec.version, policy: VERSION, at: new Date(time(at)).toISOString(),
        estimates: Object.fromEntries(DIMENSIONS.map(d => [d, { theta: round(estimates[d].theta, 4), n: round(estimates[d].n, 2), reversals: estimates[d].reversals }])),
        indices: Object.fromEntries(spec.knobs.map(k => [k.id, adaptive && !locked(k) ? clamp(indices[k.id] - (todayOnly[k.id] || 0), 0, k.values.length - 1) : reached[k.id]])),
        latencies: [...latencies] }),
    };
  }
  return Object.freeze({ VERSION, KINDS, OUTCOMES, MODES, CONDITIONS, DIMENSIONS, ITEM, PRESENTATION, defineContent, priorFromSummary, declaredFrom, start, challenge, sigmoid, logit });
});
