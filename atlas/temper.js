/* SYNK Temper: count measured practice evidence, never infer learning causality.
 * `measure` reads new-item independent attempts per concept and per comparison
 * arm (the arm recorded on each Atlas decision). `compare` checks two runs of the
 * same inputs, for example two implementations; it is not a learning measure.
 * `groups` reads the two arms of one comparison per evaluation-only group.
 * None is a significance test, a policy promotion gate or a cohort learner.
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
  return Object.freeze({ VERSION, MINIMUM_PER_CELL, measure, compare, groups });
});
