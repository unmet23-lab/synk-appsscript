'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Temper = require('../atlas/temper-outcomes.js');

const scope = { domain: 'SHIFT', workspace: 'team-a', purpose: 'task-help' };
const policies = [{ id: 'rules', version: '1' }, { id: 'personalized', version: '2' }];
const T0 = Date.parse('2026-10-05T00:00:00Z');
const at = seconds => new Date(T0 + seconds * 1000).toISOString();
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  return { contract: { id: 'work-help', version: '1', scope: { ...scope },
    outcome: { id: 'helpful', kind: 'binary', direction: 'higher', allowedValues: [0, 1], windowMs: 10000 } },
  decisions: [], exposures: [], outcomes: [], policies: clone(policies), subjects: [], asOf: at(100), minimumSubjects: 2 };
}
function add(f, { id, subject = id, policy = 0, value = 1, delivered = true, exposureAt = 1, outcomeAt = 2,
  abstained = false, cost = { value: 0.01, unit: 'USD' }, latencyMs = 20 } = {}) {
  if (!f.subjects.includes(subject)) f.subjects.push(subject);
  const base = { subject, scope: { ...f.contract.scope } };
  f.decisions.push({ ...base, id: `d-${id}`, at: at(0), contract: { id: f.contract.id, version: f.contract.version },
    policy: { ...policies[policy] }, candidateIds: ['a', 'b'], selectedId: abstained ? null : 'a',
    ...(cost === null ? {} : { cost }), ...(latencyMs === null ? {} : { latencyMs }) });
  if (!delivered || abstained) return;
  f.exposures.push({ ...base, id: `e-${id}`, decisionId: `d-${id}`, candidateId: 'a', at: at(exposureAt) });
  if (value !== null) f.outcomes.push({ ...base, id: `o-${id}`, exposureId: `e-${id}`, value, at: at(outcomeAt) });
}

test('product outcomes join actual delivery and keep abstention, undelivered, pending, missing and late distinct', () => {
  const f = fixture();
  add(f, { id: 'success' }); add(f, { id: 'failure', value: 0 });
  add(f, { id: 'missing', value: null }); add(f, { id: 'late', outcomeAt: 30 });
  add(f, { id: 'pending', exposureAt: 95, outcomeAt: 96 });
  add(f, { id: 'not-seen', delivered: false }); add(f, { id: 'none-fit', abstained: true });
  const r = Temper.evaluateOutcomes(f), b = r.byPolicy[0];
  assert.deepEqual(b.counts, { decisions: 7, abstained: 1, delivered: 5, undelivered: 1, pending: 1, matured: 4, observed: 2, missing: 2, late: 1 });
  assert.equal(b.mean, 0.5, 'missing and late responses never become failures');
  assert.equal(b.measurementCompletion, 0.5);
  assert.equal(r.comparison.direction, 'unknown');
  assert.equal(r.comparison.difference, null);
  assert.equal(r.causalClaim, false); assert.equal(r.significanceTested, false);
  assert.equal(r.calibrated, false); assert.equal(r.policyPromotion, false);
});

test('policy comparison weights people equally despite repeat use and uses full policy versions', () => {
  const f = fixture();
  for (let n = 0; n < 10; n += 1) add(f, { id: `repeat-${n}`, subject: 'frequent', value: 1 });
  add(f, { id: 'once', subject: 'occasional', value: 0 });
  add(f, { id: 'new-a', policy: 1, value: 1 }); add(f, { id: 'new-b', policy: 1, value: 1 });
  const r = Temper.evaluateOutcomes(f);
  assert.equal(r.byPolicy[0].mean, 0.5);
  assert.deepEqual(r.byPolicy[0].subjects, { decided: 2, observed: 2 });
  assert.equal(r.comparison.difference, 0.5);
  assert.equal(r.comparison.direction, 'better');
  f.policies[1] = { ...policies[0], version: '3' };
  for (const d of f.decisions.filter(d => d.policy.id === 'personalized')) d.policy = { ...f.policies[1] };
  assert.equal(Temper.evaluateOutcomes(f).byPolicy[1].policy.version, '3');
});

test('minimum evidence counts people, not repeated decisions, and absent samples have null means', () => {
  const f = fixture();
  for (let n = 0; n < 10; n += 1) add(f, { id: `a${n}`, subject: 'one' });
  const r = Temper.evaluateOutcomes(f);
  assert.equal(r.byPolicy[0].status, 'insufficient_evidence');
  assert.equal(r.byPolicy[1].status, 'no_sample');
  assert.equal(r.byPolicy[1].mean, null); assert.equal(r.byPolicy[1].measurementCompletion, null);
  assert.equal(r.comparison.difference, null);
  assert.equal(Temper.evaluateOutcomes(fixture()).byPolicy[0].cost.total, null);
});

test('identical outcome sets retain the same mean and direction regardless of arrival order', () => {
  const f = fixture();
  f.contract.outcome = { id: 'match', kind: 'numeric', direction: 'higher', range: [0, 1], windowMs: 10000 };
  for (let policy = 0; policy < 2; policy += 1) {
    for (const subject of ['one', 'two']) {
      const values = policy ? [0.4, 0.2, 0.1] : [0.1, 0.2, 0.4];
      values.forEach((value, index) => add(f, { id: `${policy}-${subject}-${index}`, subject, policy, value }));
    }
  }
  const first = Temper.evaluateOutcomes(f);
  assert.equal(first.comparison.difference, 0);
  assert.equal(first.comparison.direction, 'unchanged');
  f.decisions.reverse(); f.exposures.reverse(); f.outcomes.reverse();
  assert.deepEqual(Temper.evaluateOutcomes(f).byPolicy, first.byPolicy);
});

test('numeric products supply their own range and whether lower or higher is preferable', () => {
  const f = fixture(); f.contract.outcome = { id: 'effort', kind: 'numeric', direction: 'lower', range: [0, 10], windowMs: 10000 };
  add(f, { id: 'old-a', value: 8 }); add(f, { id: 'old-b', value: 6 });
  add(f, { id: 'new-a', policy: 1, value: 3 }); add(f, { id: 'new-b', policy: 1, value: 5 });
  const r = Temper.evaluateOutcomes(f);
  assert.equal(r.comparison.difference, -3); assert.equal(r.comparison.directedDifference, 3);
  assert.equal(r.comparison.direction, 'better');
  f.outcomes[0].value = 11;
  assert.throws(() => Temper.evaluateOutcomes(f), /valid value/);
});

test('cost and latency coverage remain explicit and mixed cost units are never silently converted', () => {
  const f = fixture();
  add(f, { id: 'free', cost: { value: 0, unit: 'USD' }, latencyMs: 0 });
  add(f, { id: 'paid', cost: { value: 0.2, unit: 'USD' }, latencyMs: 100 });
  add(f, { id: 'unknown', cost: null, latencyMs: null });
  const r = Temper.evaluateOutcomes(f).byPolicy[0];
  assert.deepEqual(r.cost, { unit: 'USD', recorded: 2, missing: 1, total: 0.2, mean: 0.1 });
  assert.deepEqual(r.latencyMs, { recorded: 2, missing: 1, mean: 50, max: 100 });
  f.decisions[1].cost.unit = 'KRW';
  assert.throws(() => Temper.evaluateOutcomes(f), /incompatible cost units/);
});

test('exact retries are idempotent but conflicting copies and multiple deliveries or outcomes are rejected', () => {
  const f = fixture(); add(f, { id: 'one' });
  for (const name of ['decisions', 'exposures', 'outcomes']) f[name].push(clone(f[name][0]));
  const r = Temper.evaluateOutcomes(f);
  assert.deepEqual(r.duplicates, { decisions: 1, exposures: 1, outcomes: 1 });
  assert.equal(r.byPolicy[0].counts.observed, 1);
  f.outcomes[1].value = 0;
  assert.throws(() => Temper.evaluateOutcomes(f), /conflicting outcomes id/);
  for (const [name, expected] of [['exposures', /multiple exposures/], ['outcomes', /multiple outcomes/]]) {
    const input = fixture(); add(input, { id: 'one' }); input[name].push({ ...clone(input[name][0]), id: 'another-id' });
    assert.throws(() => Temper.evaluateOutcomes(input), expected);
  }
});

test('authorization scope, purpose and person must hold across the entire decision to outcome chain', () => {
  const mutations = [
    f => { f.subjects = []; },
    f => { f.decisions[0].scope.workspace = 'team-b'; },
    f => { f.exposures[0].scope.purpose = 'dating'; },
    f => { f.outcomes[0].scope.domain = 'LAB'; },
    f => { f.subjects.push('other'); f.outcomes[0].subject = 'other'; },
    f => { f.subjects.push('other'); f.exposures[0].subject = 'other'; },
  ];
  for (const mutate of mutations) {
    const f = fixture(); add(f, { id: 'one' }); mutate(f);
    assert.throws(() => Temper.evaluateOutcomes(f), /authorized|same scope and subject/);
  }
  const pulse = fixture(); pulse.contract.scope.domain = 'PULSE';
  assert.throws(() => Temper.evaluateOutcomes(pulse), /PULSE/);
});

test('forged, unselected and out-of-order evidence cannot acquire a successful result', () => {
  const mutations = [
    f => { f.exposures[0].candidateId = 'b'; },
    f => { f.exposures[0].decisionId = 'unknown'; },
    f => { f.outcomes[0].exposureId = 'unknown'; },
    f => { f.exposures[0].at = at(-1); },
    f => { f.outcomes[0].at = at(0); },
    f => { f.outcomes[0].at = at(101); },
    f => { f.decisions[0].selectedId = 'outside-pool'; },
    f => { f.decisions[0].policy.version = 'unregistered'; },
    f => { f.decisions[0].contract.version = 'old-outcome-definition'; },
    f => { f.outcomes[0].value = null; },
    f => { f.outcomes[0].value = true; },
    f => { f.outcomes[0].rawText = 'unnecessary private text'; },
  ];
  for (const mutate of mutations) {
    const f = fixture(); add(f, { id: 'one' }); mutate(f);
    assert.throws(() => Temper.evaluateOutcomes(f), /Temper outcomes:/);
  }
});

test('malformed contracts and non-finite metrics fail closed without mutating caller records', () => {
  const f = fixture(); add(f, { id: 'one' }); const before = clone(f);
  const result = Temper.evaluateOutcomes(f);
  assert.deepEqual(f, before);
  result.contract.scope.workspace = 'other'; result.byPolicy[0].policy.id = 'other';
  assert.deepEqual(f, before);
  for (const mutate of [
    f => { f.contract.outcome.allowedValues = [0, 0]; },
    f => { f.contract.outcome.windowMs = -1; },
    f => { f.minimumSubjects = 0; },
    f => { f.decisions[0].latencyMs = Infinity; },
    f => { f.decisions[0].cost.value = NaN; },
    f => { f.subjects.push(f.subjects[0]); },
    f => { f.policies[1] = { ...f.policies[0] }; },
  ]) {
    const input = clone(f); mutate(input);
    assert.throws(() => Temper.evaluateOutcomes(input), /Temper outcomes:/);
  }
});

test('late ingestion cannot be inserted into an earlier evaluation snapshot or precede its parent record', () => {
  const f = fixture(); add(f, { id: 'one' });
  f.outcomes[0].recordedAt = at(120);
  assert.throws(() => Temper.evaluateOutcomes(f), /arrives after evaluation time/);
  f.asOf = at(130);
  assert.equal(Temper.evaluateOutcomes(f).byPolicy[0].counts.observed, 1,
    'a later report can establish an in-window outcome in a later snapshot');
  f.outcomes[0].recordedAt = at(1);
  assert.throws(() => Temper.evaluateOutcomes(f), /recorded before occurrence/);
  f.outcomes[0].recordedAt = at(2); f.exposures[0].recordedAt = at(3);
  assert.throws(() => Temper.evaluateOutcomes(f), /prior exposure/);
});
