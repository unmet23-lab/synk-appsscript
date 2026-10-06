'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Domain = require('../atlas/domain');
const scope = { domain: 'PATH', workspace: 'travel', subject: 'person-a' };
const at = '2026-10-06T00:00:00.000Z';
const base = {
  id: 'travel-choice', version: '1', purpose: 'day-plan',
  fields: [{ id: 'quiet', kind: 'boolean' }],
  criteria: [{ id: 'quiet-fit', field: 'quiet', feature: 'quiet', weight: 4 }],
};
const objective = patch => ({ id: 'save-budget', feature: 'cost', range: [0, 100], weight: 2, prefer: 'lower', ...patch });
const fact = value => ({ id: 'actual-choice', scope, contract: { id: base.id, version: base.version, purpose: base.purpose },
  field: 'quiet', value, source: 'declared', at });
const decide = (contract, candidates, observations = []) => Domain.decide({ contract, candidates, observations, scope, at });
const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; };

test('policy objectives can rank without declaring invented personal facts', () => {
  const c = { ...base, objectives: [objective()] };
  const result = decide(c, [{ id: 'expensive', features: { cost: 80 } }, { id: 'value', features: { cost: 20 } }]);
  assert.equal(result.selected.id, 'value'); assert.equal(result.selected.score, 1.6);
  assert.deepEqual(result.selected.reasons, []);
  assert.deepEqual(result.selected.policyReasons, [{ objective: 'save-budget', feature: 'cost', candidateValue: 20, contribution: 1.6 }]);
  assert.equal(result.understanding.fields[0].status, 'unknown');
  assert.deepEqual(result.snapshot.observations, []); assert.equal(result.calibrated, false);
});

test('real personal criteria and product policy keep separate explanations and sum contributions', () => {
  const c = { ...base, objectives: [objective()] };
  const result = decide(c, [{ id: 'quiet', features: { quiet: true, cost: 50 } }, { id: 'cheap', features: { quiet: false, cost: 0 } }], [fact(true)]);
  assert.equal(result.selected.id, 'quiet'); assert.equal(result.selected.score, 5);
  assert.equal(result.selected.reasons[0].field, 'quiet');
  assert.deepEqual(result.selected.reasons[0].evidence, ['actual-choice']);
  assert.equal(result.selected.policyReasons[0].contribution, 1);
  assert.equal('evidence' in result.selected.policyReasons[0], false);
});

test('higher and lower objectives normalize their declared nonzero ranges', () => {
  const c = { ...base, criteria: [], objectives: [objective({ id: 'comfort', feature: 'comfort', range: [50, 150], weight: 4, prefer: 'higher' }),
    objective({ range: [100, 200], weight: 3 })] };
  const result = decide(c, [{ id: 'middle', features: { comfort: 100, cost: 150 } }, { id: 'end', features: { comfort: 150, cost: 100 } }]);
  assert.equal(result.selected.id, 'end'); assert.equal(result.selected.score, 7);
  assert.equal(result.ranked[1].score, 3.5);
});

test('policy utility cannot rescue a failed or unknown required personal condition', () => {
  const c = { ...base, criteria: [{ ...base.criteria[0], required: true }], objectives: [objective({ weight: 1000 })] };
  const candidates = [{ id: 'fail', features: { quiet: false, cost: 0 } }, { id: 'missing', features: { cost: 0 } }, { id: 'pass', features: { quiet: true, cost: 100 } }];
  const result = decide(c, candidates, [fact(true)]);
  assert.equal(result.selected.id, 'pass'); assert.equal(result.ranked.length, 1);
  assert.deepEqual(result.excluded, [{ id: 'fail', reasons: ['constraint:quiet-fit'] }, { id: 'missing', reasons: ['unknown:quiet-fit'] }]);
  assert.equal(decide(c, candidates).status, 'unavailable');
});

test('missing objective features contribute nothing without becoming false user evidence', () => {
  const c = { ...base, objectives: [objective()] };
  const result = decide(c, [{ id: 'missing', features: {} }]);
  assert.deepEqual(result.selected, { id: 'missing', score: 0, reasons: [], policyReasons: [] });
  assert.equal(result.understanding.fields[0].status, 'unknown');
});

test('contracts without objectives preserve the previous ranked and selected shapes', () => {
  const result = decide(base, [{ id: 'candidate', features: { quiet: true } }], [fact(true)]);
  assert.deepEqual(Object.keys(result.selected).sort(), ['id', 'reasons', 'score']);
  const extended = decide({ ...base, objectives: [] }, [{ id: 'candidate', features: { quiet: true } }], [fact(true)]);
  const { policyReasons, ...withoutPolicy } = extended.selected;
  assert.deepEqual(policyReasons, []); assert.deepEqual(withoutPolicy, result.selected);
});

test('objective schema and feature values reject malformed ranges, unsupported policies and unsafe utilities', () => {
  for (const objectives of [null, {}, [objective(), objective()], [objective({ range: [1, 1] })], [objective({ range: [-1e308, 1e308] })],
    [objective({ range: [0, Infinity] })], [objective({ weight: -1 })], [objective({ prefer: 'match' })], [objective({ field: 'quiet' })]]) {
    assert.throws(() => Domain.validateContract({ ...base, objectives }), /objective/);
  }
  const c = { ...base, objectives: [objective()] };
  for (const value of [null, '50', Infinity, NaN, -1, 101]) assert.throws(() => decide(c, [{ id: 'bad', features: { cost: value } }]), /objective feature/);
  assert.throws(() => decide(c, [{ id: 'bad', features: { unrelated: 1 } }]), /candidate/);
  const huge = { ...base, criteria: [], objectives: [objective({ weight: Number.MAX_VALUE }), objective({ id: 'second', feature: 'other', weight: Number.MAX_VALUE })] };
  assert.throws(() => decide(huge, [{ id: 'overflow', features: { cost: 0, other: 0 } }]), /overflow/);
});

test('objective calculations neither mutate inputs nor alias their policy or evidence output', () => {
  const c = freeze({ ...base, objectives: [objective()] }), candidates = freeze([{ id: 'one', features: { quiet: true, cost: 20 } }]);
  const observations = freeze([fact(true)]), before = JSON.stringify({ c, candidates, observations });
  const result = decide(c, candidates, observations);
  result.selected.policyReasons[0].candidateValue = 99;
  result.snapshot.contract.objectives[0].weight = 999;
  result.selected.reasons[0].evidence.push('changed');
  assert.equal(JSON.stringify({ c, candidates, observations }), before);
  assert.equal(decide(c, candidates, observations).selected.policyReasons[0].candidateValue, 20);
});
