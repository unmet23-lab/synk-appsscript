/* SYNK Temper: optional product outcome accounting. Load only in consumers that
 * evaluate decision -> exposure -> outcome; games keep the practice module. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkTemperOutcomes = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  /* Product-neutral outcome accounting. The authenticated host must first authorize
   * `subjects` for this exact product workspace and purpose; this pure function cannot
   * authenticate a person or create consent. It rejects records outside that boundary.
   * A decision is not delivery, and an unanswered delivery is not a failed outcome.
   * Only closed observation windows enter policy means. Repeated observations count
   * once per person and policy (their mean), not once per click. This is descriptive
   * evaluation, without randomization, causal inference, calibration or promotion.
   */
  const OUTCOMES_VERSION = 'temper-outcomes-1';
  function evaluateOutcomes({ contract, decisions = [], exposures = [], outcomes = [], policies,
    subjects, asOf, minimumSubjects = 5 } = {}) {
    const fail = message => { throw new TypeError(`Temper outcomes: ${message}`); };
    const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
    const token = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
    const exact = (value, required, optional = []) => object(value)
      && required.every(key => Object.hasOwn(value, key))
      && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
    const number = value => typeof value === 'number' && Number.isFinite(value);
    const instant = value => {
      const time = typeof value === 'string' && value.length <= 40 ? Date.parse(value) : NaN;
      if (!Number.isFinite(time)) fail('invalid timestamp');
      return time;
    };
    const canonical = value => JSON.stringify(value, (_key, entry) => object(entry)
      ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
    const scopeKey = scope => {
      if (!exact(scope, ['domain', 'workspace', 'purpose']) || !Object.values(scope).every(token)) fail('invalid scope');
      if (scope.domain === 'PULSE') fail('PULSE does not keep personal behavioral observations');
      return JSON.stringify([scope.domain, scope.workspace, scope.purpose]);
    };
    const policyKey = policy => {
      if (!exact(policy, ['id', 'version']) || !token(policy.id) || !token(policy.version)) fail('invalid policy');
      return JSON.stringify([policy.id, policy.version]);
    };
    if (!exact(contract, ['id', 'version', 'scope', 'outcome']) || !token(contract.id) || !token(contract.version)) fail('invalid contract');
    const boundary = scopeKey(contract.scope), target = contract.outcome;
    if (!exact(target, ['id', 'kind', 'direction', 'windowMs'], ['allowedValues', 'range']) || !token(target.id)
      || !['binary', 'numeric'].includes(target.kind) || !['higher', 'lower'].includes(target.direction)
      || !Number.isSafeInteger(target.windowMs) || target.windowMs < 0) fail('invalid outcome definition');
    if (target.kind === 'binary') {
      if (Object.hasOwn(target, 'range') || !Array.isArray(target.allowedValues) || target.allowedValues.length !== 2
        || !target.allowedValues.includes(0) || !target.allowedValues.includes(1)) fail('binary outcomes require allowedValues [0, 1]');
    } else if (Object.hasOwn(target, 'allowedValues') || !Array.isArray(target.range) || target.range.length !== 2
      || !target.range.every(number) || target.range[0] >= target.range[1]
      || !Number.isFinite(target.range[1] - target.range[0])) fail('numeric outcomes require a finite increasing range');
    const valueOk = value => number(value) && (target.kind === 'binary' ? target.allowedValues.includes(value)
      : value >= target.range[0] && value <= target.range[1]);
    if (!Array.isArray(subjects) || !subjects.every(token) || new Set(subjects).size !== subjects.length) fail('authorized subjects are required');
    if (!Array.isArray(policies) || policies.length !== 2 || new Set(policies.map(policyKey)).size !== 2) fail('two distinct policies are required');
    if (!Number.isSafeInteger(minimumSubjects) || minimumSubjects < 1) fail('invalid minimum subjects');
    const cutoff = instant(asOf), allowed = new Set(subjects), keys = policies.map(policyKey);
    const duplicateCounts = { decisions: 0, exposures: 0, outcomes: 0 };
    const records = (input, kind, required, optional = []) => {
      if (!Array.isArray(input)) fail(`${kind} must be an array`);
      const found = new Map();
      for (const row of input) {
        if (!exact(row, ['id', 'subject', 'scope', 'at', ...required], ['recordedAt', ...optional]) || !token(row.id) || !token(row.subject)) fail(`invalid ${kind} record`);
        if (scopeKey(row.scope) !== boundary || !allowed.has(row.subject)) fail('record outside authorized subject, workspace or purpose');
        const happened = instant(row.at), recorded = instant(row.recordedAt ?? row.at);
        if (recorded < happened) fail('recorded before occurrence');
        if (happened > cutoff || recorded > cutoff) fail('record occurs or arrives after evaluation time');
        if (found.has(row.id)) {
          if (canonical(found.get(row.id)) !== canonical(row)) fail(`conflicting ${kind} id`);
          duplicateCounts[kind] += 1;
        } else found.set(row.id, row);
      }
      return found;
    };
    const ds = records(decisions, 'decisions', ['contract', 'policy', 'candidateIds', 'selectedId'], ['cost', 'latencyMs']);
    const es = records(exposures, 'exposures', ['decisionId', 'candidateId']);
    const os = records(outcomes, 'outcomes', ['exposureId', 'value']);
    const costUnits = new Set(), delivered = new Map(), observed = new Map();
    const sameParent = (row, parent) => parent && row.subject === parent.subject
      && scopeKey(row.scope) === scopeKey(parent.scope) && instant(row.at) >= instant(parent.at)
      && instant(row.recordedAt ?? row.at) >= instant(parent.recordedAt ?? parent.at);
    for (const row of ds.values()) {
      if (!exact(row.contract, ['id', 'version']) || row.contract.id !== contract.id || row.contract.version !== contract.version) fail('decision outcome contract mismatch');
      if (!keys.includes(policyKey(row.policy))) fail('decision uses an unrequested policy');
      if (!Array.isArray(row.candidateIds) || !row.candidateIds.every(token)
        || new Set(row.candidateIds).size !== row.candidateIds.length
        || !(row.selectedId === null || token(row.selectedId) && row.candidateIds.includes(row.selectedId))) fail('invalid decision candidates or selection');
      if (Object.hasOwn(row, 'latencyMs') && (!number(row.latencyMs) || row.latencyMs < 0)) fail('invalid latency');
      if (Object.hasOwn(row, 'cost')) {
        if (!exact(row.cost, ['value', 'unit']) || !number(row.cost.value) || row.cost.value < 0 || !token(row.cost.unit)) fail('invalid normalized cost');
        costUnits.add(row.cost.unit);
      }
    }
    if (costUnits.size > 1) fail('incompatible cost units');
    for (const row of es.values()) {
      const parent = ds.get(row.decisionId);
      if (!token(row.decisionId) || !token(row.candidateId) || !sameParent(row, parent)
        || row.candidateId !== parent.selectedId) fail('exposure requires the selected candidate and prior decision in the same scope and subject');
      if (delivered.has(parent.id)) fail('multiple exposures for one decision');
      delivered.set(parent.id, row);
    }
    for (const row of os.values()) {
      const parent = es.get(row.exposureId);
      if (!token(row.exposureId) || !sameParent(row, parent) || !valueOk(row.value)) fail('outcome requires valid value and prior exposure in the same scope and subject');
      if (observed.has(parent.id)) fail('multiple outcomes for one exposure');
      observed.set(parent.id, row);
    }
    const sum = values => {
      const total = values.reduce((accumulated, value) => accumulated + value, 0);
      if (!Number.isFinite(total)) fail('metric total exceeds supported range');
      return total;
    };
    // Stable order keeps equivalent evidence sets identical despite log arrival order.
    // The incremental mean avoids overflowing otherwise representable averages.
    const mean = values => values.length ? [...values].sort((a, b) => a - b)
      .reduce((average, value, index) => average + (value - average) / (index + 1), 0) : null;
    const byPolicy = policies.map(policy => {
      const rows = [...ds.values()].filter(row => policyKey(row.policy) === policyKey(policy));
      const people = new Map(), costs = [], latencies = [];
      const counts = { decisions: rows.length, abstained: 0, delivered: 0, undelivered: 0, pending: 0,
        matured: 0, observed: 0, missing: 0, late: 0 };
      for (const row of rows) {
        if (row.cost) costs.push(row.cost.value);
        if (row.latencyMs != null) latencies.push(row.latencyMs);
        if (row.selectedId === null) { counts.abstained += 1; continue; }
        const exposure = delivered.get(row.id);
        if (!exposure) { counts.undelivered += 1; continue; }
        counts.delivered += 1;
        const end = instant(exposure.at) + target.windowMs, result = observed.get(exposure.id);
        if (!Number.isSafeInteger(end)) fail('observation window exceeds supported time');
        if (end > cutoff) { counts.pending += 1; continue; }
        counts.matured += 1;
        if (!result || instant(result.at) > end) {
          counts.missing += 1;
          if (result) counts.late += 1;
          continue;
        }
        counts.observed += 1;
        if (!people.has(row.subject)) people.set(row.subject, []);
        people.get(row.subject).push(result.value);
      }
      const subjectMeans = [...people.values()].map(mean), subjectCount = people.size;
      return { policy: { ...policy }, counts, subjects: { decided: new Set(rows.map(row => row.subject)).size, observed: subjectCount },
        status: !subjectCount ? 'no_sample' : subjectCount < minimumSubjects ? 'insufficient_evidence' : 'measured',
        mean: mean(subjectMeans), measurementCompletion: counts.matured ? counts.observed / counts.matured : null,
        cost: { unit: [...costUnits][0] || null, recorded: costs.length, missing: rows.length - costs.length,
          total: costs.length ? sum(costs) : null, mean: mean(costs) },
        latencyMs: { recorded: latencies.length, missing: rows.length - latencies.length, mean: mean(latencies),
          max: latencies.length ? latencies.reduce((max, value) => Math.max(max, value), 0) : null } };
    });
    const [baseline, candidate] = byPolicy;
    const comparable = byPolicy.every(row => row.status === 'measured');
    const difference = comparable ? candidate.mean - baseline.mean : null;
    const directedDifference = difference === null ? null : difference * (target.direction === 'higher' ? 1 : -1);
    return { version: OUTCOMES_VERSION, contract: { id: contract.id, version: contract.version, scope: { ...contract.scope }, outcome: JSON.parse(JSON.stringify(target)) },
      asOf, minimumSubjects, byPolicy, duplicates: duplicateCounts,
      comparison: { status: comparable ? 'measured' : 'insufficient_evidence', difference, directedDifference,
        direction: directedDifference === null ? 'unknown' : directedDifference < 0 ? 'worse' : directedDifference > 0 ? 'better' : 'unchanged',
        unit: 'subject-mean-of-observed-matured-outcomes' },
      causalClaim: false, significanceTested: false, calibrated: false, policyPromotion: false,
      limitations: ['The host authorizes subjects and purpose; this function does not authenticate or grant consent.',
        'Observed outcomes describe the supplied records; missing responses are unknown, not failures.',
        'Selection, nonresponse and different people can bias policy means; this is not a causal or significance test.'] };
  }
  return Object.freeze({ OUTCOMES_VERSION, evaluateOutcomes });
});
