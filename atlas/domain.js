/* Core's field-based understanding and decision policy.
 * Products supply the meaning of facts, eligible candidates and objectives.
 * This pure module owns evidence resolution and ranking, not authentication,
 * storage, model calls or an extra Atlas engine. Scores are policy utilities,
 * never probabilities or proof of a person's character or a causal effect.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkAtlasDomain = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'core-domain-1';
  const DAY = 86400000;
  const DOMAINS = ['LAB', 'SHIFT', 'PATH', 'PULSE', 'SYNK'];
  const SOURCES = ['declared', 'observed', 'inferred'];
  const own = (o, k) => Object.hasOwn(o, k);
  const plain = o => o !== null && typeof o === 'object' && !Array.isArray(o) && [Object.prototype, null].includes(Object.getPrototypeOf(o));
  const token = s => typeof s === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(s) && !['__proto__', 'prototype', 'constructor'].includes(s);
  const fail = message => { throw new TypeError(`Core domain: ${message}`); };
  const copy = value => JSON.parse(JSON.stringify(value));
  const canonical = value => JSON.stringify(value, (_key, v) => plain(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
  const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : fail('invalid time');
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const keys = (value, allowed) => plain(value) && Object.keys(value).every(k => allowed.includes(k));
  const scopeKey = scope => {
    if (!keys(scope, ['domain', 'workspace', 'subject']) || Object.keys(scope).length !== 3 || !DOMAINS.includes(scope.domain) || !token(scope.workspace) || !token(scope.subject)) fail('invalid scope');
    return canonical(scope);
  };
  function validValue(field, value) {
    if (field.kind === 'enum') return field.values.includes(value);
    if (field.kind === 'boolean') return typeof value === 'boolean';
    return finite(value) && value >= field.range[0] && value <= field.range[1];
  }
  function validateContract(contract) {
    if (!keys(contract, ['id', 'version', 'purpose', 'fields', 'criteria', 'objectives']) || !token(contract.id) || !token(contract.version) || !token(contract.purpose)
      || !Array.isArray(contract.fields) || !contract.fields.length || contract.fields.length > 100 || !Array.isArray(contract.criteria) || contract.criteria.length > 100) fail('invalid contract');
    const fields = new Map(), criteria = new Set();
    for (const field of contract.fields) {
      if (!keys(field, ['id', 'kind', 'values', 'range', 'maxAgeDays', 'minIndependent', 'minAgreement', 'tolerance']) || !token(field.id) || fields.has(field.id)
        || !['enum', 'boolean', 'number'].includes(field.kind)) fail('invalid field');
      if (field.kind === 'enum' && (!Array.isArray(field.values) || field.values.length < 2 || field.values.length > 100 || new Set(field.values).size !== field.values.length || field.values.some(v => !token(v)))) fail('invalid enum values');
      if (field.kind !== 'enum' && field.values != null) fail('values belong to an enum');
      if (field.kind === 'number' && (!Array.isArray(field.range) || field.range.length !== 2 || !field.range.every(finite) || field.range[0] >= field.range[1] || !finite(field.range[1] - field.range[0]))) fail('invalid numeric range');
      if (field.kind !== 'number' && (field.range != null || field.tolerance != null)) fail('range/tolerance belong to a number');
      if (field.maxAgeDays != null && (!finite(field.maxAgeDays) || field.maxAgeDays <= 0 || field.maxAgeDays > 36500)) fail('invalid evidence lifetime');
      if (field.minIndependent != null && (!Number.isInteger(field.minIndependent) || field.minIndependent < 1 || field.minIndependent > 10000)) fail('invalid minimum evidence');
      if (field.minAgreement != null && (!finite(field.minAgreement) || field.minAgreement <= 0.5 || field.minAgreement > 1)) fail('invalid agreement threshold');
      if (field.tolerance != null && (!finite(field.tolerance) || field.tolerance < 0 || field.tolerance > field.range[1] - field.range[0])) fail('invalid numeric tolerance');
      fields.set(field.id, field);
    }
    for (const criterion of contract.criteria) {
      if (!keys(criterion, ['id', 'field', 'feature', 'weight', 'required', 'prefer']) || !token(criterion.id) || criteria.has(criterion.id)
        || !fields.has(criterion.field) || !token(criterion.feature) || !finite(criterion.weight) || criterion.weight < 0
        || (criterion.required != null && typeof criterion.required !== 'boolean') || !['match', 'different', 'at-least', 'at-most'].includes(criterion.prefer || 'match')) fail('invalid criterion');
      if (['at-least', 'at-most'].includes(criterion.prefer) && fields.get(criterion.field).kind !== 'number') fail('numeric comparison requires a number');
      criteria.add(criterion.id);
    }
    // Policy objectives are product choices, never fabricated declarations about
    // a person. Keep them separate from criteria backed by the person's facts.
    if (own(contract, 'objectives')) {
      if (!Array.isArray(contract.objectives) || contract.objectives.length > 100) fail('invalid objectives');
      const objectives = new Set();
      for (const objective of contract.objectives) {
        if (!keys(objective, ['id', 'feature', 'range', 'weight', 'prefer']) || !token(objective.id) || objectives.has(objective.id)
          || !token(objective.feature) || !Array.isArray(objective.range) || objective.range.length !== 2
          || !objective.range.every(finite) || objective.range[0] >= objective.range[1] || !finite(objective.range[1] - objective.range[0])
          || !finite(objective.weight) || objective.weight < 0 || !['higher', 'lower'].includes(objective.prefer)) fail('invalid objective');
        objectives.add(objective.id);
      }
    }
    return fields;
  }
  function project(contract, scope, observations, at) {
    const fields = validateContract(contract), owner = scopeKey(scope), cutoff = time(at);
    if (!Array.isArray(observations) || observations.length > 10000) fail('invalid observations');
    const byId = new Map(), rows = [], replaced = new Set();
    for (const row of observations) {
      if (!keys(row, ['id', 'scope', 'contract', 'field', 'value', 'source', 'independentKey', 'at', 'recordedAt', 'until', 'refs', 'quality', 'supersedes'])
        || !token(row.id) || scopeKey(row.scope) !== owner || !fields.has(row.field) || !SOURCES.includes(row.source)) fail('invalid or foreign observation');
      if (!keys(row.contract, ['id', 'version', 'purpose']) || row.contract.id !== contract.id || row.contract.version !== contract.version || row.contract.purpose !== contract.purpose) fail('observation belongs to another contract or purpose');
      if (scope.domain === 'PULSE' && row.source !== 'declared') fail('PULSE does not derive a personal behavioral profile');
      if (row.value !== null && !validValue(fields.get(row.field), row.value)) fail('observation value is outside its field');
      if (row.value === null && row.source !== 'declared') fail('only a declaration can withdraw a field');
      if (row.source === 'observed' && !token(row.independentKey)) fail('observations need an independence key');
      if (row.independentKey != null && !token(row.independentKey)) fail('invalid independence key');
      if (row.quality != null && !['usable', 'confounded', 'unassessed'].includes(row.quality)) fail('invalid evidence quality');
      if (row.source === 'declared' && row.quality != null && row.quality !== 'usable') fail('a declaration is not a measured outcome');
      const happened = time(row.at), recorded = time(row.recordedAt ?? row.at);
      if (recorded < happened || (row.until != null && time(row.until) <= happened)) fail('invalid observation chronology');
      if (row.refs != null && (!Array.isArray(row.refs) || row.refs.length > 100 || row.refs.some(r => !token(r)) || new Set(row.refs).size !== row.refs.length)) fail('invalid evidence references');
      if (row.source === 'inferred' && !row.refs?.length) fail('an inferred proposal needs source references');
      if (row.supersedes != null && !token(row.supersedes)) fail('invalid correction reference');
      if (byId.has(row.id)) { if (canonical(byId.get(row.id)) !== canonical(row)) fail('conflicting observation id'); continue; }
      byId.set(row.id, row);
      if (happened <= cutoff && recorded <= cutoff) rows.push(row);
    }
    for (const row of rows) {
      // Observed/declared refs point to product-owned source records. The host checks
      // those records. Model proposals may only cite observations admitted here.
      for (const ref of row.source === 'inferred' ? row.refs : []) {
        const source = byId.get(ref);
        if (!source || source.id === row.id || source.source === 'inferred' || time(source.recordedAt ?? source.at) > time(row.recordedAt ?? row.at) || time(source.at) > time(row.at)) fail('invalid proposal source');
      }
      if (row.supersedes) {
        const prior = byId.get(row.supersedes);
        if (!prior || prior.id === row.id || prior.field !== row.field || prior.source !== row.source || time(prior.at) > time(row.at)
          || time(prior.recordedAt ?? prior.at) > time(row.recordedAt ?? row.at)) fail('invalid correction');
        replaced.add(prior.id);
      }
    }
    const checked = new Set();
    for (const start of rows) {
      let row = start; const path = new Set();
      while (row && !checked.has(row.id)) {
        if (path.has(row.id)) fail('correction cycle');
        path.add(row.id); row = row.supersedes ? byId.get(row.supersedes) : null;
      }
      for (const id of path) checked.add(id);
    }
    rows.sort((a, b) => time(a.at) - time(b.at) || time(a.recordedAt ?? a.at) - time(b.recordedAt ?? b.at));
    const byField = new Map(), orderedKeys = new Map(), latestDeclarations = new Map(), latestIndependent = new Map();
    for (const row of rows) if (!replaced.has(row.id)) {
      if (row.source !== 'inferred') {
        const key = canonical([row.field, row.source, row.source === 'observed' ? row.independentKey : '', time(row.at), time(row.recordedAt ?? row.at)]);
        const previous = orderedKeys.get(key);
        if (previous && (previous.value !== row.value || (previous.quality ?? 'usable') !== (row.quality ?? 'usable') || previous.until !== row.until)) fail('ambiguous observation order');
        orderedKeys.set(key, row);
      }
      if (!byField.has(row.field)) byField.set(row.field, []);
      byField.get(row.field).push(row);
      if (row.source === 'declared') latestDeclarations.set(row.field, row);
      if (row.source === 'observed') latestIndependent.set(canonical([row.field, row.independentKey]), row);
    }
    const sourceUsable = id => {
      const row = byId.get(id);
      if (!row || replaced.has(id) || row.value === null || (row.quality && row.quality !== 'usable')) return false;
      const field = fields.get(row.field);
      if (cutoff >= (row.until ? time(row.until) : time(row.at) + (field.maxAgeDays ?? 30) * DAY)) return false;
      const declared = latestDeclarations.get(row.field);
      if (declared && (declared.value === null || row.source === 'declared' && declared.id !== row.id)) return false;
      if (row.source === 'observed' && latestIndependent.get(canonical([row.field, row.independentKey]))?.id !== row.id) return false;
      return true;
    };
    const result = [];
    for (const field of fields.values()) {
      const all = byField.get(field.id) || [];
      const fresh = row => cutoff < (row.until ? time(row.until) : time(row.at) + (field.maxAgeDays ?? 30) * DAY);
      const base = { id: field.id, status: 'unknown', value: null, usable: false, evidence: [], independent: 0, agreement: null, alternatives: [], proposals: [], excluded: [] };
      const declaration = all.filter(r => r.source === 'declared').at(-1);
      if (declaration) {
        result.push({ ...base, status: declaration.value === null ? 'withdrawn' : !fresh(declaration) ? 'expired' : 'declared',
          value: declaration.value !== null && fresh(declaration) ? declaration.value : null,
          usable: declaration.value !== null && fresh(declaration), evidence: [declaration.id] });
        continue;
      }
      const independent = new Map();
      for (const row of all) {
        if (row.source === 'inferred') {
          if (fresh(row) && (!row.quality || row.quality === 'usable') && row.refs.every(sourceUsable)) base.proposals.push({ id: row.id, value: row.value, evidence: row.refs });
          else base.excluded.push(row.id);
          continue;
        }
        if (row.source === 'observed') independent.set(row.independentKey, row);
      }
      // Select the newest version of each independent observation before quality
      // and expiry checks. An unusable correction must not revive the old evidence.
      const sample = [...independent.values()].filter(row => {
        if (fresh(row) && (!row.quality || row.quality === 'usable')) return true;
        base.excluded.push(row.id); return false;
      });
      base.independent = sample.length;
      base.evidence = sample.map(r => r.id);
      if (!sample.length) {
        base.status = base.proposals.length ? 'unconfirmed' : all.some(fresh) ? 'unusable' : all.length ? 'expired' : 'unknown';
        result.push(base); continue;
      }
      let value, support;
      if (field.kind === 'number') {
        const values = sample.map(r => r.value).sort((a, b) => a - b), middle = Math.floor(values.length / 2);
        value = values.length % 2 ? values[middle] : values[middle - 1] + (values[middle] - values[middle - 1]) / 2;
        support = sample.filter(r => Math.abs(r.value - value) <= (field.tolerance ?? 0)).length;
        const counts = new Map();
        for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
        base.alternatives = [...counts].map(([v, count]) => ({ value: v, count }));
      } else {
        const counts = new Map(); for (const row of sample) counts.set(row.value, (counts.get(row.value) || 0) + 1);
        base.alternatives = [...counts].map(([v, count]) => ({ value: v, count })).sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
        value = base.alternatives[0].value; support = base.alternatives[0].count;
      }
      base.agreement = support / sample.length;
      base.status = base.agreement < (field.minAgreement ?? 0.67) ? 'conflicted' : sample.length < (field.minIndependent ?? 2) ? 'insufficient' : 'supported';
      base.usable = base.status === 'supported'; base.value = base.usable ? value : null;
      result.push(base);
    }
    return { version: VERSION, contract: { id: contract.id, version: contract.version, purpose: contract.purpose }, scope: copy(scope), at, fields: result,
      needsCheck: result.filter(f => ['conflicted', 'insufficient', 'unconfirmed', 'unusable'].includes(f.status)).map(f => f.id), calibrated: false };
  }
  function understand(input = {}) {
    return copy(project(input.contract, input.scope, input.observations ?? [], input.at));
  }
  function decide({ contract, scope, observations = [], at, candidates } = {}) {
    const understanding = project(contract, scope, observations, at), specs = new Map(contract.fields.map(f => [f.id, f]));
    const objectives = contract.objectives ?? [];
    const facts = new Map(understanding.fields.map(f => [f.id, f]));
    const allowed = new Set([...contract.criteria, ...objectives].map(c => c.feature));
    if (!Array.isArray(candidates) || candidates.length > 10000) fail('invalid candidates');
    const ids = new Set(), ranked = [], excluded = [];
    for (const candidate of candidates) {
      if (!keys(candidate, ['id', 'features', 'eligible', 'exclusions']) || !token(candidate.id) || ids.has(candidate.id) || !plain(candidate.features)
        || Object.keys(candidate.features).some(k => !allowed.has(k)) || (candidate.eligible != null && typeof candidate.eligible !== 'boolean')
        || (candidate.exclusions != null && (!Array.isArray(candidate.exclusions) || candidate.exclusions.some(r => !token(r))))) fail('invalid candidate');
      ids.add(candidate.id);
      for (const c of contract.criteria) if (own(candidate.features, c.feature) && !validValue(specs.get(c.field), candidate.features[c.feature])) fail('invalid candidate feature');
      for (const objective of objectives) if (own(candidate.features, objective.feature)) {
        const value = candidate.features[objective.feature];
        if (!finite(value) || value < objective.range[0] || value > objective.range[1]) fail('invalid objective feature');
      }
      if (candidate.eligible === false || candidate.exclusions?.length) { excluded.push({ id: candidate.id, reasons: candidate.exclusions?.length ? candidate.exclusions : ['ineligible'] }); continue; }
      let score = 0; const reasons = [], policyReasons = [], blocked = [];
      for (const c of contract.criteria) {
        const fact = facts.get(c.field), field = specs.get(c.field), has = own(candidate.features, c.feature), v = candidate.features[c.feature];
        if (!fact.usable || !has) { if (c.required) blocked.push(`unknown:${c.id}`); continue; }
        const prefer = c.prefer || 'match';
        let fit = field.kind === 'number' ? Math.max(0, 1 - Math.abs(fact.value - v) / (field.range[1] - field.range[0])) : Number(fact.value === v);
        if (prefer === 'different') fit = 1 - fit;
        if (prefer === 'at-least') fit = Number(v >= fact.value);
        if (prefer === 'at-most') fit = Number(v <= fact.value);
        const passes = field.kind === 'number' && ['match', 'different'].includes(prefer)
          ? (prefer === 'match' ? Math.abs(fact.value - v) <= (field.tolerance ?? 0) : Math.abs(fact.value - v) > (field.tolerance ?? 0)) : fit === 1;
        if (c.required && !passes) { blocked.push(`constraint:${c.id}`); continue; }
        const contribution = fit * c.weight;
        score += contribution;
        if (!finite(score)) fail('policy utility overflow');
        reasons.push({ criterion: c.id, field: c.field, value: fact.value, candidateValue: v, contribution, evidence: fact.evidence, status: fact.status });
      }
      for (const objective of objectives) {
        if (!own(candidate.features, objective.feature)) continue;
        const candidateValue = candidate.features[objective.feature];
        const fraction = (candidateValue - objective.range[0]) / (objective.range[1] - objective.range[0]);
        const contribution = (objective.prefer === 'higher' ? fraction : 1 - fraction) * objective.weight;
        score += contribution;
        if (!finite(score)) fail('policy utility overflow');
        policyReasons.push({ objective: objective.id, feature: objective.feature, candidateValue, contribution });
      }
      if (blocked.length) excluded.push({ id: candidate.id, reasons: blocked });
      else ranked.push({ id: candidate.id, score, reasons, ...(own(contract, 'objectives') ? { policyReasons } : {}) });
    }
    ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return copy({ version: VERSION, contract: understanding.contract, scope, at, status: ranked.length ? 'ready' : 'unavailable',
      selected: ranked[0] || null, ranked, excluded, understanding,
      snapshot: { candidates, contract, observations: observations.map(row => row.id) }, calibrated: false });
  }
  return Object.freeze({ VERSION, validateContract, understand, decide });
});
