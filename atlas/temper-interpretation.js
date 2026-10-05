/* Temper's offline interpretation evaluator. The authored expected answers are
 * independent of the extractor. This module makes no model/network calls and
 * does not turn authored-case agreement into general accuracy or user outcomes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkTemperInterpretation = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'temper-interpretation-2';
  const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const token = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value)
    && !['__proto__', 'prototype', 'constructor'].includes(value);
  const fail = message => { throw new TypeError(`Temper interpretation: ${message}`); };
  const exactKeys = (value, required, optional = []) => plain(value)
    && required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
  const equal = (a, b) => a === b;
  const valueFits = (field, value) => field.kind === 'boolean' ? typeof value === 'boolean'
    : field.kind === 'enum' ? field.values.includes(value)
      : typeof value === 'number' && Number.isFinite(value) && value >= field.range[0] && value <= field.range[1];
  const ratio = (n, d) => d ? n / d : null;
  function validateDataset(dataset) {
    if (!exactKeys(dataset, ['id', 'version', 'kind', 'description', 'fields', 'cases'])
      || !token(dataset.id) || !token(dataset.version) || dataset.kind !== 'authored-synthetic-sources'
      || typeof dataset.description !== 'string' || !Array.isArray(dataset.fields) || !dataset.fields.length || dataset.fields.length > 100
      || !Array.isArray(dataset.cases) || !dataset.cases.length || dataset.cases.length > 1000) fail('invalid authored dataset');
    const fields = new Map();
    for (const field of dataset.fields) {
      if (!exactKeys(field, ['id', 'kind'], ['values', 'range']) || !token(field.id) || fields.has(field.id)
        || !['enum', 'boolean', 'number'].includes(field.kind)) fail('invalid dataset field');
      if (field.kind === 'enum' && (!Array.isArray(field.values) || field.values.length < 2 || field.values.length > 100
        || field.values.some(value => !token(value)) || new Set(field.values).size !== field.values.length)) fail('invalid enum values');
      if (field.kind === 'number' && (!Array.isArray(field.range) || field.range.length !== 2
        || field.range.some(value => !Number.isFinite(value)) || field.range[0] >= field.range[1] || !Number.isFinite(field.range[1] - field.range[0]))) fail('invalid number range');
      if (field.kind !== 'enum' && Object.hasOwn(field, 'values') || field.kind !== 'number' && Object.hasOwn(field, 'range')) fail('incompatible field limits');
      fields.set(field.id, field);
    }
    const cases = new Set();
    for (const item of dataset.cases) {
      if (!exactKeys(item, ['id', 'tags', 'source', 'expected', 'rationale']) || !token(item.id) || cases.has(item.id)
        || !Array.isArray(item.tags) || !item.tags.length || item.tags.some(tag => !token(tag))
        || !exactKeys(item.source, ['id', 'text', 'at', 'actor']) || !token(item.source.id)
        || item.source.actor !== 'self' || typeof item.source.text !== 'string' || !item.source.text.trim()
        || item.source.text.length > 4000 || typeof item.source.at !== 'string' || !Number.isFinite(Date.parse(item.source.at))
        || !exactKeys(item.expected, ['facts', 'permittedFacts', 'unknownFields', 'mustNotAssert'])
        || !plain(item.expected.facts) || !plain(item.expected.permittedFacts) || !Array.isArray(item.expected.unknownFields) || !Array.isArray(item.expected.mustNotAssert)
        || typeof item.rationale !== 'string' || !item.rationale.length) fail('invalid authored case');
      cases.add(item.id);
      for (const [field, value] of Object.entries(item.expected.facts)) if (!fields.has(field) || !valueFits(fields.get(field), value)) fail('invalid authored fact');
      for (const [field, value] of Object.entries(item.expected.permittedFacts)) {
        if (!fields.has(field) || !valueFits(fields.get(field), value) || Object.hasOwn(item.expected.facts, field)) fail('invalid permitted fact');
      }
      if (new Set(item.expected.unknownFields).size !== item.expected.unknownFields.length
        || item.expected.unknownFields.some(field => !fields.has(field) || Object.hasOwn(item.expected.facts, field) || Object.hasOwn(item.expected.permittedFacts, field))) fail('invalid authored unknown fields');
      for (const forbidden of item.expected.mustNotAssert) {
        if (!exactKeys(forbidden, ['field'], ['value']) || !fields.has(forbidden.field)
          || Object.hasOwn(forbidden, 'value') && !valueFits(fields.get(forbidden.field), forbidden.value)
          || Object.hasOwn(item.expected.facts, forbidden.field)
          && (!Object.hasOwn(forbidden, 'value') || equal(item.expected.facts[forbidden.field], forbidden.value))
          || Object.hasOwn(item.expected.permittedFacts, forbidden.field)
          && (!Object.hasOwn(forbidden, 'value') || equal(item.expected.permittedFacts[forbidden.field], forbidden.value))) fail('invalid forbidden assertion');
      }
    }
    return fields;
  }
  function proposalIssues(output, source, fields) {
    const issues = [];
    if (!exactKeys(output, ['proposals'], ['held', 'extractor']) || !Array.isArray(output.proposals)
      || output.proposals.length > 100 || output.extractor !== undefined && !token(output.extractor)) return ['invalid-output-envelope'];
    const splitSurrogate = offset => offset > 0 && offset < source.text.length
      && /[\uD800-\uDBFF]/.test(source.text[offset - 1]) && /[\uDC00-\uDFFF]/.test(source.text[offset]);
    const validSpan = span => Number.isInteger(span.start) && Number.isInteger(span.end)
      && span.start >= 0 && span.end > span.start && span.end <= source.text.length
      && typeof span.quote === 'string' && !!span.quote.trim() && source.text.slice(span.start, span.end) === span.quote
      && !splitSurrogate(span.start) && !splitSurrogate(span.end);
    if (output.held !== undefined && (!Array.isArray(output.held) || output.held.length > 100 || output.held.some(held =>
      !exactKeys(held, ['quote', 'start', 'end', 'reason']) || !validSpan(held) || typeof held.reason !== 'string' || !held.reason.trim() || held.reason.length > 240))) issues.push('invalid-held-source');
    const ids = new Set();
    output.proposals.forEach((proposal, index) => {
      if (!exactKeys(proposal, ['id', 'field', 'value', 'subject', 'stance', 'evidence'])
        || !token(proposal.id) || ids.has(proposal.id) || !fields.has(proposal.field)
        || !valueFits(fields.get(proposal.field), proposal.value)
        || !['self', 'other'].includes(proposal.subject)
        || !['current', 'past', 'hypothetical', 'uncertain'].includes(proposal.stance)
        || !Array.isArray(proposal.evidence) || !proposal.evidence.length || proposal.evidence.length > 4) {
        issues.push(`invalid-proposal:${index}`); return;
      }
      ids.add(proposal.id);
      const seen = new Set();
      if (proposal.evidence.some(span => {
        if (!exactKeys(span, ['sourceId', 'start', 'end', 'quote']) || span.sourceId !== source.id || !validSpan(span)) return true;
        const key = JSON.stringify([span.sourceId, span.start, span.end, span.quote]);
        if (seen.has(key)) return true;
        seen.add(key); return false;
      })) issues.push(`invalid-source-reference:${index}`);
    });
    return issues;
  }
  const newFieldStats = field => ({ field, expected: 0, exact: 0, missing: 0, incorrect: 0, permitted: 0,
    unsupported: 0, conflicting: 0, unknownExpected: 0, correctlyUnasserted: 0, unknownViolated: 0,
    notRun: 0, malformed: 0 });
  function evaluateInterpretations({ dataset, runs = [], backend, mode } = {}) {
    const specs = validateDataset(dataset);
    if (!['extractor-output', 'proposal-replay'].includes(mode)) fail('mode must distinguish extractor output from proposal replay');
    if (!exactKeys(backend, ['id', 'version', 'kind']) || !token(backend.id) || !token(backend.version)
      || !['local-pattern', 'model', 'manual-replay', 'not-run'].includes(backend.kind)
      || mode === 'extractor-output' && backend.kind === 'manual-replay') fail('invalid backend provenance');
    if (!Array.isArray(runs) || runs.length > dataset.cases.length) fail('invalid runs');
    if (backend.kind === 'not-run' && runs.length) fail('not-run backend cannot supply outputs');
    const caseIds = new Set(dataset.cases.map(item => item.id)), byCase = new Map();
    for (const run of runs) {
      if (!exactKeys(run, ['caseId', 'output']) || !caseIds.has(run.caseId) || byCase.has(run.caseId)) fail('unknown or duplicated case run');
      byCase.set(run.caseId, run.output);
    }
    const byField = new Map([...specs.keys()].map(field => [field, newFieldStats(field)]));
    const counts = { cases: dataset.cases.length, attempted: runs.length, notRun: 0, malformed: 0, evaluated: 0, passed: 0, failed: 0 };
    const claims = { expected: 0, exact: 0, missing: 0, incorrect: 0, permitted: 0, unsupported: 0, conflicting: 0, withheldProposals: 0, forbiddenAssertions: 0 };
    const restraint = { expected: 0, correctlyUnasserted: 0, violated: 0 };
    const cases = dataset.cases.map(item => {
      const relevant = [...new Set([...Object.keys(item.expected.facts), ...item.expected.unknownFields])];
      const base = { id: item.id, tags: [...item.tags] };
      if (!byCase.has(item.id)) {
        counts.notRun++;
        relevant.forEach(field => byField.get(field).notRun++);
        return { ...base, status: 'not_run', passed: null };
      }
      const output = byCase.get(item.id), issues = proposalIssues(output, item.source, specs);
      if (issues.length) {
        counts.malformed++; counts.failed++;
        relevant.forEach(field => byField.get(field).malformed++);
        return { ...base, status: 'malformed', passed: false, issues };
      }
      counts.evaluated++;
      const asserted = new Map();
      for (const proposal of output.proposals) {
        if (proposal.subject !== 'self' || proposal.stance !== 'current') { claims.withheldProposals++; continue; }
        if (!asserted.has(proposal.field)) asserted.set(proposal.field, []);
        const values = asserted.get(proposal.field);
        if (!values.some(value => equal(value, proposal.value))) values.push(proposal.value);
      }
      const entries = [], allFields = [...new Set([...relevant, ...asserted.keys()])];
      let passed = true;
      for (const field of allFields) {
        const stats = byField.get(field), values = asserted.get(field) || [], hasExpected = Object.hasOwn(item.expected.facts, field);
        const expected = item.expected.facts[field], hasPermitted = Object.hasOwn(item.expected.permittedFacts, field);
        const permitted = item.expected.permittedFacts[field];
        const unsupported = values.filter(value => !(hasExpected && equal(expected, value)) && !(hasPermitted && equal(permitted, value)));
        stats.unsupported += unsupported.length; claims.unsupported += unsupported.length;
        if (values.length > 1) { stats.conflicting++; claims.conflicting++; }
        let status;
        if (hasExpected) {
          stats.expected++; claims.expected++;
          if (values.length === 1 && equal(expected, values[0])) { status = 'exact'; stats.exact++; claims.exact++; }
          else if (!values.length) { status = 'missing'; stats.missing++; claims.missing++; passed = false; }
          else { status = values.length > 1 ? 'conflicting' : 'incorrect'; stats.incorrect++; claims.incorrect++; passed = false; }
        } else if (hasPermitted && values.length === 1 && equal(permitted, values[0])) {
          status = 'permitted'; stats.permitted++; claims.permitted++;
        } else {
          status = values.length ? 'unsupported' : 'correctly-unasserted';
          if (values.length) passed = false;
        }
        if (item.expected.unknownFields.includes(field)) {
          stats.unknownExpected++; restraint.expected++;
          if (values.length) { stats.unknownViolated++; restraint.violated++; }
          else { stats.correctlyUnasserted++; restraint.correctlyUnasserted++; }
        }
        entries.push({ field, status, ...(hasExpected ? { expected } : {}), ...(hasPermitted ? { permitted } : {}), asserted: values, unsupported });
      }
      const forbidden = item.expected.mustNotAssert.filter(rule => (asserted.get(rule.field) || []).some(value =>
        !Object.hasOwn(rule, 'value') || equal(rule.value, value)));
      claims.forbiddenAssertions += forbidden.length;
      if (forbidden.length) passed = false;
      counts[passed ? 'passed' : 'failed']++;
      return { ...base, status: 'evaluated', passed, fields: entries, forbiddenAssertions: forbidden,
        withheldProposals: output.proposals.filter(proposal => proposal.subject !== 'self' || proposal.stance !== 'current').length };
    });
    return { version: VERSION, dataset: { id: dataset.id, version: dataset.version, kind: dataset.kind }, backend: { ...backend }, mode,
      status: !counts.attempted ? 'not_run' : counts.notRun ? 'partial' : 'complete',
      sourceInterpretationAssessed: mode === 'extractor-output' && counts.evaluated > 0,
      counts, claims, restraint,
      rates: { attemptedCaseAgreement: ratio(counts.passed, counts.attempted),
        evaluatedFieldPrecision: ratio(claims.exact + claims.permitted, claims.exact + claims.permitted + claims.unsupported),
        evaluatedFieldRecall: ratio(claims.exact, claims.expected), unknownRestraint: ratio(restraint.correctlyUnasserted, restraint.expected) },
      byField: [...byField.values()], cases,
      generalAccuracyEstablished: false, productionEffectMeasured: false, calibrated: false,
      limitations: ['Authored synthetic cases are not a representative sample of real user language.',
        'Backend identity and run mode are supplied provenance, not an attestation of execution.',
        'Proposal replay checks scoring and contracts, not source interpretation accuracy.',
        'Field rates describe well-formed evaluated outputs only; malformed attempts remain failed cases and missing runs remain not_run.',
        'Explicitly permitted facts count as supported additions, never as required exact fields or recall denominator; absent permitted facts are not omissions.',
        'Source slices prove quotation identity, not semantic entailment; authored field expectations supply the semantic reference.',
        'Self/current proposals are scored as assertions; other subjects and non-current stances are withheld, not confirmed facts.'] };
  }
  function compareInterpretations({ baseline, candidate } = {}) {
    if (baseline?.version !== VERSION || candidate?.version !== VERSION || baseline.mode !== candidate.mode
      || ['id', 'version', 'kind'].some(key => baseline.dataset?.[key] !== candidate.dataset?.[key])
      || !Array.isArray(baseline.cases) || !Array.isArray(candidate.cases)
      || baseline.cases.length !== candidate.cases.length
      || baseline.cases.some((item, index) => item.id !== candidate.cases[index].id)) fail('comparison requires the same dataset, case order and run mode');
    const counts = { pairedAttempted: 0, pairedEvaluated: 0, improvedCases: 0, regressedCases: 0, bothPassed: 0, bothFailed: 0, unpaired: 0 };
    const empty = () => ({ exact: 0, missing: 0, incorrect: 0, permitted: 0, unsupported: 0 });
    const pairedFields = { baseline: empty(), candidate: empty() };
    const tally = (target, row) => { for (const field of row.fields) {
      if (field.status === 'exact') target.exact++;
      if (field.status === 'permitted') target.permitted++;
      if (field.status === 'missing') target.missing++;
      if (['incorrect', 'conflicting'].includes(field.status)) target.incorrect++;
      target.unsupported += field.unsupported.length;
    } };
    const cases = baseline.cases.map((before, index) => {
      const after = candidate.cases[index]; let transition = 'unpaired';
      if (before.status !== 'not_run' && after.status !== 'not_run') {
        counts.pairedAttempted++;
        transition = before.passed ? after.passed ? 'bothPassed' : 'regressedCases' : after.passed ? 'improvedCases' : 'bothFailed';
        counts[transition]++;
        if (before.status === 'evaluated' && after.status === 'evaluated') {
          counts.pairedEvaluated++; tally(pairedFields.baseline, before); tally(pairedFields.candidate, after);
        }
      } else counts.unpaired++;
      return { id: before.id, baselineStatus: before.status, candidateStatus: after.status, transition };
    });
    return { dataset: { ...baseline.dataset }, mode: baseline.mode, baseline: { ...baseline.backend }, candidate: { ...candidate.backend }, counts,
      pairedFields, fieldDifference: Object.fromEntries(Object.keys(pairedFields.baseline).map(key => [key, pairedFields.candidate[key] - pairedFields.baseline[key]])),
      cases, superiorityEstablished: false, productionEffectMeasured: false,
      limitations: ['Only the same cases attempted by both backends enter case comparisons.',
        'Field differences use the narrower set with well-formed output from both backends; malformed attempts remain case failures.',
        'Authored-case differences do not establish general superiority or statistical significance.'] };
  }
  return Object.freeze({ VERSION, validateDataset, evaluateInterpretations, compareInterpretations });
});
