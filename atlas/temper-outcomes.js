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
  function evaluateOutcomes({ contract, decisions = [], exposures = [], outcomes = [], revisions = [], policies,
    subjects, asOf, minimumSubjects = 5, strictProvenance = false } = {}) {
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
    const sameContract = ref => exact(ref, ['id', 'version']) && ref.id === contract.id && ref.version === contract.version;
    if (typeof strictProvenance !== 'boolean' || !Array.isArray(revisions)) fail('invalid provenance options');
    // Legacy records inherit their contract through the decision. New provenance
    // consumers bind every record explicitly so colliding product IDs cannot join.
    const trace = strictProvenance || revisions.length > 0;
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
    const es = records(exposures, 'exposures', ['decisionId', 'candidateId'], ['contract']);
    const os = records(outcomes, 'outcomes', ['exposureId', 'value'], ['contract']);
    if (trace) duplicateCounts.revisions = 0;
    const rs = records(revisions, 'revisions', ['contract', 'targetId', 'action', 'sourceRef'], ['value']);
    const costUnits = new Set(), delivered = new Map(), observed = new Map(), originalOutcomes = new Map();
    const sameParent = (row, parent) => parent && row.subject === parent.subject
      && scopeKey(row.scope) === scopeKey(parent.scope) && instant(row.at) >= instant(parent.at)
      && instant(row.recordedAt ?? row.at) >= instant(parent.recordedAt ?? parent.at);
    for (const row of ds.values()) {
      if (!sameContract(row.contract)) fail('decision outcome contract mismatch');
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
      if ((trace || Object.hasOwn(row, 'contract')) && !sameContract(row.contract)) fail('exposure outcome contract mismatch');
      const parent = ds.get(row.decisionId);
      if (!token(row.decisionId) || !token(row.candidateId) || !sameParent(row, parent)
        || row.candidateId !== parent.selectedId) fail('exposure requires the selected candidate and prior decision in the same scope and subject');
      if (delivered.has(parent.id)) fail('multiple exposures for one decision');
      delivered.set(parent.id, row);
    }
    for (const row of os.values()) {
      if ((trace || Object.hasOwn(row, 'contract')) && !sameContract(row.contract)) fail('outcome contract mismatch');
      const parent = es.get(row.exposureId);
      if (!token(row.exposureId) || !sameParent(row, parent) || !valueOk(row.value)) fail('outcome requires valid value and prior exposure in the same scope and subject');
      if (observed.has(parent.id)) fail('multiple outcomes for one exposure');
      observed.set(parent.id, row);
      originalOutcomes.set(parent.id, row);
    }
    // Revisions correct an existing reported value; they do not backdate a new
    // response. A changed intention or new behavior needs a new product observation.
    // sourceRef names the host-owned source event. The host verifies authenticity,
    // authorization and consent; this module only verifies the supplied lineage.
    const successor = new Map();
    for (const row of rs.values()) {
      if (os.has(row.id)) fail('revision id conflicts with an outcome');
      if (!sameContract(row.contract)) fail('revision outcome contract mismatch');
      if (!token(row.targetId) || !token(row.sourceRef) || !['correct', 'withdraw'].includes(row.action)
        || (row.action === 'correct' ? !valueOk(row.value) : Object.hasOwn(row, 'value'))) fail('invalid revision');
      const parent = os.get(row.targetId) || rs.get(row.targetId);
      if (!sameParent(row, parent)) fail('revision requires a prior outcome or revision in the same scope and subject');
      if (parent.action === 'withdraw') fail('withdrawn outcomes cannot be restored');
      if (successor.has(parent.id)) fail('multiple revisions for one target');
      successor.set(parent.id, row);
    }
    const checked = new Set();
    for (const row of rs.values()) {
      const path = new Set(); let current = row;
      while (current && !checked.has(current.id)) {
        if (path.has(current.id)) fail('revision cycle');
        path.add(current.id); current = rs.get(current.targetId);
      }
      for (const id of path) checked.add(id);
    }
    const histories = new Map();
    for (const original of os.values()) {
      const history = []; let current = original;
      while (successor.has(current.id)) { current = successor.get(current.id); history.push(current); }
      histories.set(original.id, history);
      if (current.action === 'withdraw') observed.delete(original.exposureId);
      else if (current !== original) observed.set(original.exposureId, { ...original, value: current.value });
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
      ...(trace ? { provenance: { version: 'temper-outcome-provenance-1', chains: [...ds.values()].sort((a, b) => a.id.localeCompare(b.id)).map(decision => {
        const exposure = delivered.get(decision.id), original = exposure && originalOutcomes.get(exposure.id);
        const history = original ? histories.get(original.id) : [], latest = history.at(-1);
        return { decisionId: decision.id, exposureId: exposure?.id || null, outcomeId: original?.id || null,
          status: decision.selectedId === null ? 'abstained' : !exposure ? 'undelivered' : !original ? 'unobserved'
            : latest?.action === 'withdraw' ? 'withdrawn' : latest ? 'corrected' : 'observed',
          effectiveOutcomeId: original && latest?.action !== 'withdraw' ? latest?.id || original.id : null,
          revisions: history.map(row => ({ id: row.id, targetId: row.targetId, action: row.action, sourceRef: row.sourceRef,
            at: row.at, recordedAt: row.recordedAt ?? row.at, ...(row.action === 'correct' ? { value: row.value } : {}) })) };
      }) } } : {}),
      comparison: { status: comparable ? 'measured' : 'insufficient_evidence', difference, directedDifference,
        direction: directedDifference === null ? 'unknown' : directedDifference < 0 ? 'worse' : directedDifference > 0 ? 'better' : 'unchanged',
        unit: 'subject-mean-of-observed-matured-outcomes' },
      causalClaim: false, significanceTested: false, calibrated: false, policyPromotion: false,
      limitations: ['The host authorizes subjects and purpose; this function does not authenticate or grant consent.',
        'Observed outcomes describe the supplied records; missing responses are unknown, not failures.',
        'Selection, nonresponse and different people can bias policy means; this is not a causal or significance test.'] };
  }
  /** A person's own preparation history, without a fabricated comparison policy.
   * The host supplies an authorized, product-scoped set. Missing self-reports stay
   * missing; these descriptive means never measure another person's feelings.
   */
  function summarizePreparation({ scope, subject, records = [], asOf } = {}) {
    const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
    const token = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
    const fail = message => { throw new TypeError(`Temper preparation: ${message}`); };
    if (!object(scope) || Object.keys(scope).sort().join(',') !== 'domain,purpose,workspace' || !Object.values(scope).every(token) || scope.domain === 'PULSE' || !token(subject)) fail('invalid boundary');
    const time = value => { const at = typeof value === 'string' ? Date.parse(value) : NaN; if (!Number.isFinite(at)) fail('invalid time'); return at; };
    const cutoff = time(asOf), seen = new Set(), durations = [], ratings = [];
    let selected = 0;
    if (!Array.isArray(records) || records.length > 10000) fail('invalid records');
    for (const row of records) {
      if (!object(row) || Object.keys(row).some(key => !['id', 'scope', 'subject', 'shownAt', 'selectedAt', 'elapsedSeconds', 'satisfaction', 'satisfactionAt'].includes(key)) || !token(row.id) || row.subject !== subject || !object(row.scope) || Object.keys(row.scope).length !== 3 || Object.keys(scope).some(key => row.scope[key] !== scope[key])) fail('foreign or invalid record');
      if (seen.has(row.id)) fail('duplicate record');
      seen.add(row.id);
      const shown = time(row.shownAt), chosen = row.selectedAt == null ? null : time(row.selectedAt);
      if (shown > cutoff || chosen !== null && (chosen < shown || chosen > cutoff)) fail('invalid selection chronology');
      if (chosen !== null) selected += 1;
      if (row.elapsedSeconds != null) {
        if (chosen === null || !Number.isSafeInteger(row.elapsedSeconds) || row.elapsedSeconds < 0 || row.elapsedSeconds > 86400 || row.elapsedSeconds > Math.floor((chosen - shown) / 1000)) fail('invalid preparation duration');
        durations.push(row.elapsedSeconds);
      }
      if ((row.satisfaction == null) !== (row.satisfactionAt == null)) fail('incomplete self-report');
      if (row.satisfaction != null) {
        const rated = time(row.satisfactionAt);
        if (chosen === null || rated < chosen || rated > cutoff || !Number.isInteger(row.satisfaction) || row.satisfaction < 1 || row.satisfaction > 5) fail('invalid self-report');
        ratings.push(row.satisfaction);
      }
    }
    const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return { version: 'temper-preparation-1', shown: records.length, selected, unselected: records.length - selected,
      timed: durations.length, averageSeconds: mean(durations), rated: ratings.length, unrated: selected - ratings.length,
      averageSatisfaction: mean(ratings), causalClaim: false, relationshipQuality: null };
  }
  return Object.freeze({ OUTCOMES_VERSION, evaluateOutcomes, summarizePreparation });
});
