/* SYNK Temper: count measured practice evidence, never infer learning causality.
 * `measure` reads new-item independent attempts per concept and per comparison
 * arm (the arm recorded on each Atlas decision). `compare` checks two runs of the
 * same inputs, for example two implementations; it is not a learning measure.
 * `groups` reads the two arms of one comparison per evaluation-only group.
 * None is a significance test, a policy promotion gate or a cohort learner.
 * `check` is the guard of Core's moment-level challenge (flow.js reads it; the simulation
 * in temper-flow.js re-exports it). It depends on nothing, so neither depends on the other.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkTemper = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'temper-practice-2';
  const TRAIL = 'trail-practice-2';
  const scopeKey = scope => `${scope.domain}/${scope.workspace}/${scope.subject}`;
  const taskKey = p => JSON.stringify([p.taskId, p.taskVersion, p.itemKey, [...p.conceptIds].sort(), p.firstExposure,
    p.measure ? [p.measure.skillId, p.measure.modality, p.measure.difficulty, p.measure.familyKey,
      p.measure.audioRequired, p.measure.confounded, p.measure.responseFormat || 'unknown'] : null]);
  function summaries(input) {
    const rows = Array.isArray(input) ? input : [input];
    const seen = new Set();
    for (const row of rows) {
      if (!row || row.version !== TRAIL || !row.scope || !Array.isArray(row.attempts) || !Array.isArray(row.presentations)
        || !Array.isArray(row.help)) throw new TypeError('Temper: use a Trail practice summary');
      const key = scopeKey(row.scope);
      if (seen.has(key)) throw new TypeError('Temper: duplicate scope would double-count evidence');
      seen.add(key);
    }
    return rows;
  }
  const bucket = () => ({ evaluated: 0, correct: 0, incorrect: 0, accuracy: null });
  const close = b => { if (b.evaluated) b.accuracy = b.correct / b.evaluated; return b; };
  // Re-check provenance rather than trusting a caller's derived flag.
  const counted = a => a.independent === true && !a.exclusionReason && a.assisted === false && a.exposure === 'new'
    && ['correct', 'incorrect'].includes(a.verdict)
    && (!a.measure || (!a.measure.confounded && (!a.measure.audioRequired || a.audio === 'completed')));
  function measure(input) {
    const rows = summaries(input);
    // Concept and arm names come from data, so their tables have no prototype to overwrite.
    const result = { scopes: rows.length, presented: 0, attempts: 0, independent: bucket(), byConcept: Object.create(null), byArm: Object.create(null),
      assisted: 0, unknownAssistance: 0, repeat: 0, unknownExposure: 0, unassessed: 0, skipped: 0, excludedAttempts: 0 };
    for (const row of rows) {
      result.presented += row.presentations.length;
      result.excludedAttempts += row.excludedAttempts || 0;
      const seen = new Set();
      for (const a of row.attempts) {
        if (seen.has(a.eventId)) throw new TypeError('Temper: duplicate attempt');
        seen.add(a.eventId); result.attempts += 1;
        if (a.assisted === true) result.assisted += 1;
        else if (a.assisted === null) result.unknownAssistance += 1;
        if (a.exposure === 'repeat') result.repeat += 1;
        else if (a.exposure === 'unknown') result.unknownExposure += 1;
        if (a.verdict === 'unassessed') result.unassessed += 1;
        if (a.verdict === 'skipped') result.skipped += 1;
        if (!counted(a)) continue;
        const slot = (table, name) => table[name] || (table[name] = bucket());
        const targets = [result.independent, ...a.conceptIds.map(id => slot(result.byConcept, id)), slot(result.byArm, a.arm || 'unrecorded')];
        for (const b of targets) { b.evaluated += 1; b[a.verdict] += 1; }
      }
    }
    close(result.independent);
    Object.values(result.byConcept).forEach(close);
    Object.values(result.byArm).forEach(close);
    return { ...result, status: result.independent.evaluated ? 'measured' : 'no_sample', learningEffectClaim: false };
  }
  // The sum of two measures over disjoint attempts (for example a folded ledger and the log after it).
  function combine(a, b) {
    if (!a) return b; if (!b) return a;
    const sum = (x, y) => close({ evaluated: x.evaluated + y.evaluated, correct: x.correct + y.correct, incorrect: x.incorrect + y.incorrect, accuracy: null });
    const table = (x, y) => {
      const out = Object.create(null);
      for (const [k, v] of Object.entries(x || {})) out[k] = sum(v, bucket());
      for (const [k, v] of Object.entries(y || {})) out[k] = sum(out[k] || bucket(), v);
      return out;
    };
    const result = { scopes: Math.max(a.scopes, b.scopes), presented: a.presented + b.presented, attempts: a.attempts + b.attempts,
      independent: sum(a.independent, b.independent), byConcept: table(a.byConcept, b.byConcept), byArm: table(a.byArm, b.byArm),
      assisted: a.assisted + b.assisted, unknownAssistance: a.unknownAssistance + b.unknownAssistance, repeat: a.repeat + b.repeat,
      unknownExposure: a.unknownExposure + b.unknownExposure, unassessed: a.unassessed + b.unassessed, skipped: a.skipped + b.skipped,
      excludedAttempts: a.excludedAttempts + b.excludedAttempts };
    return { ...result, status: result.independent.evaluated ? 'measured' : 'no_sample', learningEffectClaim: false };
  }
  function compare({ before, after } = {}) {
    const left = summaries(before), right = summaries(after);
    const tasks = rows => new Map(rows.map(row => [scopeKey(row.scope), row.presentations.map(taskKey).sort()]));
    const l = tasks(left), r = tasks(right), reasons = [];
    if (JSON.stringify([...l.keys()].sort()) !== JSON.stringify([...r.keys()].sort())) reasons.push('scope_mismatch');
    else for (const [scope, set] of l) if (JSON.stringify(set) !== JSON.stringify(r.get(scope))) { reasons.push('task_mismatch'); break; }
    const b = measure(left), a = measure(right), comparable = reasons.length === 0;
    const measured = b.status === 'measured' && a.status === 'measured';
    return { version: VERSION, comparable, status: !comparable ? 'not_comparable' : !measured ? 'no_sample' : 'measured', reasons,
      before: b, after: a, independentAccuracyDifference: comparable && measured ? a.independent.accuracy - b.independent.accuracy : null,
      comparisonUnit: 'same-input-run', learningEffectClaim: false, causalClaim: false,
      limitations: ['Same inputs run twice: a check of the implementation, not of learning.',
        'Learning is read from new-item independent attempts per concept and per arm with measure().'] };
  }
  // Evaluation-only groups (공개판 설계 #evaluation-demographics, Atlas §7-4): before a new way is
  // widened, check that it is not worse for any group, including age bands and genders people
  // chose to give for statistics. The aggregation host joins `labels` (scope key → {dimension:
  // value}) from a store kept apart from Trail, Core and personalization; nothing here reads or
  // keeps who a person is. Each person counts once per arm (the mean of their new-item
  // independent accuracy), so a frequent user cannot speak for a group. A cell with fewer than
  // `minimum` people in either arm is not compared and its size is not reported. This shows where
  // a way looks worse; it is not a significance test and it does not promote anything.
  const MINIMUM_PER_CELL = 30;
  const label = value => typeof value === 'string' && /^[a-zA-Z0-9_.+-]{1,40}$/.test(value);
  function groups({ rows, labels, arms, minimum = MINIMUM_PER_CELL, tolerance = 0 } = {}) {
    const input = summaries(rows);
    if (!labels || typeof labels !== 'object' || Array.isArray(labels)) throw new TypeError('Temper: labels by scope are required');
    if (!Array.isArray(arms) || arms.length !== 2 || !arms.every(label) || arms[0] === arms[1]) throw new TypeError('Temper: name the baseline and candidate arms');
    if (!Number.isSafeInteger(minimum) || minimum < 1) throw new TypeError('Temper: minimum must be a positive integer');
    if (!(typeof tolerance === 'number' && tolerance >= 0 && tolerance < 1)) throw new TypeError('Temper: tolerance must be within [0, 1)');
    const [baseline, candidate] = arms;
    const cells = new Map();
    for (const row of input) {
      const given = Object.hasOwn(labels, scopeKey(row.scope)) ? labels[scopeKey(row.scope)] : null;
      if (!given) continue;
      if (typeof given !== 'object' || Array.isArray(given)) throw new TypeError('Temper: labels must be {dimension: value}');
      const tally = { [baseline]: [0, 0], [candidate]: [0, 0] };
      for (const a of row.attempts) {
        const arm = a.arm || 'unrecorded';
        if (!Object.hasOwn(tally, arm) || !counted(a)) continue;
        tally[arm][0] += 1; if (a.verdict === 'correct') tally[arm][1] += 1;
      }
      if (!tally[baseline][0] && !tally[candidate][0]) continue;
      for (const [dimension, value] of Object.entries(given)) {
        if (value == null || value === 'no_answer') continue;
        if (!label(dimension) || !label(value)) throw new TypeError('Temper: invalid group label');
        const key = `${dimension}=${value}`;
        if (!cells.has(key)) cells.set(key, { dimension, value, people: { [baseline]: [], [candidate]: [] } });
        for (const arm of arms) if (tally[arm][0]) cells.get(key).people[arm].push(tally[arm][1] / tally[arm][0]);
      }
    }
    const mean = list => list.reduce((sum, value) => sum + value, 0) / list.length;
    const report = [...cells.keys()].sort().map(key => {
      const cell = cells.get(key), before = cell.people[baseline], after = cell.people[candidate];
      if (before.length < minimum || after.length < minimum) return { dimension: cell.dimension, value: cell.value, status: 'waiting' };
      const difference = mean(after) - mean(before);
      return { dimension: cell.dimension, value: cell.value, status: difference < -tolerance ? 'worse' : 'not_worse',
        people: { baseline: before.length, candidate: after.length }, accuracy: { baseline: mean(before), candidate: mean(after) }, difference };
    });
    const named = status => report.filter(cell => cell.status === status).map(cell => `${cell.dimension}=${cell.value}`);
    return { version: VERSION, arms: { baseline, candidate }, minimum, tolerance, cells: report, worse: named('worse'), waiting: named('waiting'),
      unit: 'person-mean-of-new-item-independent-accuracy', learningEffectClaim: false, causalClaim: false, significanceTested: false };
  }
  // Personal observation opportunities, not assigned experiments or proof of effect. The
  // original reading chooses anchors before exclusions; the current reading can withdraw
  // them, never silently replace an excluded error with a more favourable later answer.
  const FOLLOWUP = Object.freeze({ version: 'temper-followup-1', maxAnchors: 24, keepDays: 45,
    windows: Object.freeze([['d1', 1, 3], ['d7', 7, 10], ['d30', 30, 37]].map(Object.freeze)) });
  function followups({ events, summary, original = summary, prior = null, complete = true, asOf = summary?.asOf } = {}) {
    summaries(summary); summaries(original);
    const now = Date.parse(asOf), day = 86400000, own = scopeKey(summary.scope);
    if (!Array.isArray(events) || !Number.isFinite(now) || scopeKey(original.scope) !== own) throw new TypeError('Temper: invalid follow-up evidence');
    const visible = events.filter(e => scopeKey(e.scope) === own && Date.parse(e.at) <= now && Date.parse(e.recordedAt) <= now);
    const byId = new Map(visible.map(e => [e.id, e])), position = new Map(visible.map((e, i) => [e.id, i]));
    const excluded = new Set(visible.filter(e => e.type === 'record.excluded').map(e => e.targetId));
    const completion = new Map(visible.filter(e => e.type === 'experience.completed').map(e => [e.decisionId, e]));
    const current = new Map(summary.attempts.map(a => [a.eventId, a]));
    const stamp = a => Date.parse(a.at), before = (a, b) => position.get(a.eventId ?? a.id) < position.get(b.eventId ?? b.id)
      && stamp(a) <= stamp(b) && Date.parse(a.recordedAt) <= Date.parse(b.recordedAt);
    const game = a => byId.get(a.decisionId)?.experienceId;
    const tuple = a => JSON.stringify([game(a), a.taskVersion, a.measure?.skillId, a.measure?.difficulty,
      a.measure?.responseFormat, a.measure?.modality, a.measure?.audioRequired]);
    const framed = a => {
      const p = byId.get(a.presentationId), d = byId.get(a.decisionId), done = completion.get(a.decisionId);
      return p?.type === 'practice.presented' && d?.type === 'decision.made' && done && before(d, p) && before(p, a) && before(a, done);
    };
    const qualified = a => a?.attemptNo === 1 && a.measure && a.measure.responseFormat !== 'unknown'
      && !a.exclusionReason && [true, false].includes(a.assisted) && ['correct', 'incorrect'].includes(a.verdict) && framed(a);
    const invalidated = a => [a.eventId, a.presentationId, a.decisionId, completion.get(a.decisionId)?.id].some(id => excluded.has(id))
      || visible.some(e => excluded.has(e.id) && ['practice.helped', 'practice.delivery'].includes(e.type)
        && e.presentationId === a.presentationId && before(e, a));
    const shown = new Map(), foldedShown = new Set();
    const trace = p => [`item:${p.itemKey}`, `family:${p.measure?.familyKey || p.itemKey}`];
    for (const p of visible.filter(e => e.type === 'practice.presented')) for (const key of trace(p)) {
      if (!shown.has(key) || before(p, shown.get(key))) shown.set(key, p);
    }
    for (const [, item, family] of prior?.presented || []) { foldedShown.add(`item:${item}`); foldedShown.add(`family:${family}`); }
    const fresh = a => trace(byId.get(a.presentationId)).every(key => !foldedShown.has(key) && shown.get(key)?.id === a.presentationId);
    const ordered = [...original.attempts].sort((a, b) => stamp(a) - stamp(b) || position.get(a.eventId) - position.get(b.eventId));
    const anchors = new Map();
    for (const a of ordered) if (qualified(a) && now - stamp(a) <= FOLLOWUP.keepDays * day && !anchors.has(tuple(a))) anchors.set(tuple(a), a);
    const all = [...anchors.values()], selected = all.slice(0, FOLLOWUP.maxAnchors), retain = new Set(), items = [];
    const adjusted = prior?.adjusted || 0, usable = complete === true && !adjusted;
    for (const source of selected) {
      retain.add(source.decisionId);
      const measure = { ...source.measure, taskVersion: source.taskVersion };
      delete measure.familyKey; delete measure.confounded;
      const targets = ordered.filter(a => a.eventId !== source.eventId && a.attemptNo === 1 && tuple(a) === tuple(source)
        && framed(a) && before(source, byId.get(a.presentationId)) && a.measure.familyKey !== source.measure.familyKey
        && a.itemKey !== source.itemKey && fresh(a));
      for (const [window, start, end] of FOLLOWUP.windows) {
        const due = stamp(source) + start * day, expires = stamp(source) + end * day;
        const target = targets.find(a => stamp(a) >= due && stamp(a) < expires);
        if (target) retain.add(target.decisionId);
        const actualSource = current.get(source.eventId), actualTarget = target && current.get(target.eventId);
        let status = now < due ? 'not_due' : now < expires ? 'due' : 'missed', outcome = null, reason = null;
        if (!usable) { status = 'unavailable'; reason = adjusted ? 'adjusted-history' : 'incomplete-history'; }
        else if (invalidated(source) || !actualSource || !qualified(actualSource)) { status = 'invalidated'; reason = 'source-withdrawn'; }
        else if (target && (invalidated(target) || !actualTarget)) { status = 'invalidated'; reason = 'target-withdrawn'; }
        else if (target) {
          if (!qualified(actualTarget) || actualTarget.exposure !== 'new' || actualTarget.assisted === false && !counted(actualTarget)) {
            status = 'unavailable'; reason = actualTarget.exclusionReason || 'unassessable-target';
          } else { status = 'observed'; outcome = `${actualTarget.assisted ? 'assisted' : 'independent'}-${actualTarget.verdict}`; }
        }
        const correctionEventIds = summary.help.filter(h => h.presentationId === source.presentationId && ['answer', 'explanation'].includes(h.level)
          && before(source, h) && (!target || before(h, byId.get(target.presentationId)))).map(h => h.eventId);
        items.push({ id: `${source.eventId}:${window}`, sourceAttemptId: source.eventId, sourceAt: source.at, gameId: game(source), measure,
          kind: counted(source) && source.verdict === 'correct' ? 'retention' : 'recovery', window,
          dueAt: new Date(due).toISOString(), expiresAt: new Date(expires).toISOString(), status, reason,
          targetAttemptId: target?.eventId || null, targetAt: target?.at || null, outcome, correctionEventIds });
      }
    }
    return { policy: FOLLOWUP.version, asOf, observationOpportunities: true, evidenceComplete: usable,
      coverage: { folded: prior?.folded || 0, adjusted, limited: all.length > selected.length,
        excludedAnchors: all.length - selected.length, reason: !usable ? adjusted ? 'adjusted-history' : 'incomplete-history' : prior?.folded ? 'older-source-unavailable' : null },
      items, retainDecisionIds: [...retain], learningEffectClaim: false, causalClaim: false, policyPromotion: false };
  }
  /* The last word on every knob change (Atlas design §7-2, implementation spec §6-3): one knob, one
   * step, inside bounds, never a declared-only knob, at most one change per response, and a knob just
   * eased is not raised again for two responses (easing right after a raise is always allowed:
   * comfort first). `frozen` is the stop switch: defaults for everyone. */
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
  return Object.freeze({ VERSION, MINIMUM_PER_CELL, measure, combine, compare, groups, FOLLOWUP, followups, FLIP_WINDOW, COOL_DOWN, check });
});
