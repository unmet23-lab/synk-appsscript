/* SYNK Temper: count measured practice evidence, never infer learning causality.
 * `measure` reads new-item independent attempts per concept and per comparison
 * arm (the arm recorded on each Atlas decision). `compare` checks two runs of the
 * same inputs, for example two implementations; it is not a learning measure.
 * Neither is a significance test, a policy promotion gate or a cohort learner.
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
        // Re-check provenance rather than trusting a caller's derived flag.
        if (!(a.independent === true && !a.exclusionReason && a.assisted === false && a.exposure === 'new'
          && ['correct', 'incorrect'].includes(a.verdict)
          && (!a.measure || (!a.measure.confounded && (!a.measure.audioRequired || a.audio === 'completed'))))) continue;
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
  return Object.freeze({ VERSION, measure, combine, compare });
});
