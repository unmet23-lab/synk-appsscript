'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Domain = require('../atlas/domain');

// Synthetic fixtures only. The host supplies authorization/consent before these inputs.
const at = '2026-10-05T12:00:00.000Z';
const earlier = '2026-10-05T10:00:00.000Z';
const scope = { domain: 'SHIFT', workspace: 'delivery-tool', subject: 'synthetic-user' };
const contract = {
  id: 'shift.delivery', version: '1', purpose: 'work-handoff',
  fields: [
    { id: 'format', kind: 'enum', values: ['checklist', 'narrative'], minIndependent: 2 },
    { id: 'deadlineDays', kind: 'number', range: [0, 30], tolerance: 0.5 },
    { id: 'remote', kind: 'boolean' },
  ],
  criteria: [
    { id: 'format-fit', field: 'format', feature: 'format', weight: 4 },
    { id: 'due-in-time', field: 'deadlineDays', feature: 'deliveryDays', weight: 1, prefer: 'at-most', required: true },
  ],
};
const ref = c => ({ id: c.id, version: c.version, purpose: c.purpose });
const row = (id, field, value, extra = {}, c = contract, s = scope) => ({
  id, contract: ref(c), scope: { ...s }, field, value, source: 'declared', at: earlier, ...extra,
});
const observed = (id, field, value, extra = {}, c = contract, s = scope) => row(id, field, value, {
  source: 'observed', independentKey: id, quality: 'usable', ...extra,
}, c, s);
const understand = (observations, extra = {}) => Domain.understand({ contract, scope, observations, at, ...extra });
const field = (result, id = 'format') => result.fields.find(item => item.id === id);

test('large numeric histories preserve exact frequencies and independent evidence counts', () => {
  const c = { id: 'capacity', version: '1', purpose: 'planning', fields: [
    { id: 'amount', kind: 'number', range: [0, 10000], tolerance: 1 },
  ], criteria: [] };
  const observations = Array.from({ length: 10000 }, (_, i) =>
    observed(`sample.${i}`, 'amount', i % 5000, {}, c));
  const result = Domain.understand({ contract: c, scope, observations, at }).fields[0];
  assert.equal(result.independent, 10000);
  assert.equal(result.alternatives.length, 5000);
  assert.ok(result.alternatives.every((entry, i) => entry.value === i && entry.count === 2));
  assert.equal(result.status, 'conflicted');
  assert.equal(result.usable, false);
});

test('SHIFT decides from product fields and blocks impossible deadlines regardless of preference score', () => {
  const observations = [row('format-answer', 'format', 'checklist'), row('deadline-answer', 'deadlineDays', 2)];
  const result = Domain.decide({ contract, scope, observations, at, candidates: [
    { id: 'preferred-late', features: { format: 'checklist', deliveryDays: 5 } },
    { id: 'available', features: { format: 'narrative', deliveryDays: 1 } },
    { id: 'preferred-unknown-date', features: { format: 'checklist' } },
  ] });
  assert.equal(result.status, 'ready');
  assert.equal(result.selected.id, 'available');
  assert.deepEqual(result.excluded, [
    { id: 'preferred-late', reasons: ['constraint:due-in-time'] },
    { id: 'preferred-unknown-date', reasons: ['unknown:due-in-time'] },
  ]);
  assert.equal(result.calibrated, false);
  assert.deepEqual(result.selected.reasons.find(r => r.criterion === 'due-in-time').evidence, ['deadline-answer']);
});

test('a purchasing product uses price and offline capability without learning or activity vocabulary', () => {
  const purchase = {
    id: 'device-choice', version: '1', purpose: 'personal-purchase',
    fields: [
      { id: 'budget', kind: 'number', range: [0, 5000] },
      { id: 'offline', kind: 'boolean' },
      { id: 'finish', kind: 'enum', values: ['matte', 'glossy'] },
    ],
    criteria: [
      { id: 'price-cap', field: 'budget', feature: 'price', weight: 1, prefer: 'at-most', required: true },
      { id: 'offline-required', field: 'offline', feature: 'worksOffline', weight: 1, required: true },
      { id: 'finish-fit', field: 'finish', feature: 'finish', weight: 2 },
    ],
  };
  const owner = { domain: 'SYNK', workspace: 'device-picker', subject: 'synthetic-buyer' };
  const observations = [row('budget', 'budget', 900, {}, purchase, owner), row('offline', 'offline', true, {}, purchase, owner), row('finish', 'finish', 'matte', {}, purchase, owner)];
  const result = Domain.decide({ contract: purchase, scope: owner, observations, at, candidates: [
    { id: 'over-budget', features: { price: 1200, worksOffline: true, finish: 'matte' } },
    { id: 'cloud-only', features: { price: 700, worksOffline: false, finish: 'matte' } },
    { id: 'fits', features: { price: 800, worksOffline: true, finish: 'matte' } },
    { id: 'unavailable-stock', eligible: false, features: { price: 750, worksOffline: true, finish: 'matte' }, exclusions: ['out-of-stock'] },
  ] });
  assert.equal(result.selected.id, 'fits');
  assert.equal(result.excluded.length, 3);
  assert.equal(result.understanding.contract.purpose, 'personal-purchase');
});

test('no usable required fact gives unavailable rather than an arbitrary recommendation', () => {
  const result = Domain.decide({ contract, scope, observations: [row('pref', 'format', 'checklist')], at,
    candidates: [{ id: 'unknown', features: { format: 'checklist', deliveryDays: 1 } }],
  });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.selected, null);
  assert.deepEqual(result.excluded[0].reasons, ['unknown:due-in-time']);
});

test('repeated events from one occasion do not become independent evidence and replay is idempotent', () => {
  const first = observed('click-1', 'format', 'checklist', { independentKey: 'same-session' });
  const observations = [first, structuredClone(first), observed('click-2', 'format', 'checklist', { independentKey: 'same-session' })];
  const one = field(understand(observations));
  assert.equal(one.status, 'insufficient');
  assert.equal(one.independent, 1);
  assert.equal(one.value, null);
  const two = field(understand([...observations, observed('next-session', 'format', 'checklist')]));
  assert.equal(two.status, 'supported');
  assert.equal(two.independent, 2);
  assert.equal(two.value, 'checklist');
  assert.throws(() => understand([first, { ...first, value: 'narrative' }]), /conflicting observation id/);
});

test('contradictory independent evidence stays unresolved with the alternatives and sources visible', () => {
  const result = understand([
    observed('a', 'format', 'checklist'), observed('b', 'format', 'narrative'),
    observed('c', 'format', 'checklist'), observed('d', 'format', 'narrative'),
  ]);
  const conflicted = field(result);
  assert.equal(conflicted.status, 'conflicted');
  assert.equal(conflicted.usable, false);
  assert.equal(conflicted.value, null);
  assert.equal(conflicted.agreement, 0.5);
  assert.deepEqual(conflicted.evidence, ['a', 'b', 'c', 'd']);
  assert.deepEqual(result.needsCheck, ['format']);
});

test('declared preference wins over observations and withdrawal cannot be undone by old or new observations', () => {
  const observations = [
    observed('a', 'format', 'narrative'), observed('b', 'format', 'narrative'),
    row('choice', 'format', 'checklist'),
  ];
  assert.equal(field(understand(observations)).value, 'checklist');
  const withdrawn = [...observations, row('forget', 'format', null, { at: '2026-10-05T11:00:00.000Z' }), observed('c', 'format', 'narrative', { at: at })];
  assert.equal(field(understand(withdrawn)).status, 'withdrawn');
  assert.equal(field(understand(withdrawn)).usable, false);
  assert.equal(field(understand([...withdrawn, row('new-choice', 'format', 'narrative', { at })])).value, 'narrative');
});

test('expired declarations and late-arriving evidence do not resurrect older preferences or enter an earlier view', () => {
  const observations = [
    row('old', 'format', 'checklist', { at: '2026-10-01T00:00:00.000Z' }),
    row('latest', 'format', 'narrative', { until: '2026-10-05T11:00:00.000Z' }),
    observed('future', 'format', 'checklist', { at: '2026-10-06T00:00:00.000Z' }),
    observed('late', 'format', 'checklist', { recordedAt: '2026-10-06T00:00:00.000Z' }),
  ];
  const result = field(understand(observations));
  assert.equal(result.status, 'expired');
  assert.equal(result.value, null);
  assert.deepEqual(result.evidence, ['latest']);
});

test('corrections replace their actual source and cannot overwrite a different field or source kind', () => {
  const original = observed('wrong-entry', 'format', 'narrative');
  const corrected = observed('corrected', 'format', 'checklist', { supersedes: original.id, at: '2026-10-05T11:00:00.000Z', independentKey: original.independentKey });
  const result = field(understand([original, corrected, observed('second', 'format', 'checklist')]));
  assert.equal(result.value, 'checklist');
  assert.equal(result.independent, 2);
  assert.equal(result.evidence.includes('wrong-entry'), false);
  assert.throws(() => understand([original, { ...corrected, field: 'remote', value: true }]), /invalid correction/);
  assert.throws(() => understand([original, { ...corrected, source: 'declared' }]), /invalid correction/);
});

test('cyclic corrections are rejected instead of silently removing every source', () => {
  assert.throws(() => understand([
    observed('a', 'format', 'checklist', { supersedes: 'b' }),
    observed('b', 'format', 'narrative', { supersedes: 'a' }),
  ]), /cycle|correction/);
});

test('same-time conflicting versions need explicit supersession instead of depending on input order', () => {
  const first = observed('a', 'format', 'checklist', { independentKey: 'episode' });
  const second = observed('b', 'format', 'narrative', { independentKey: 'episode' });
  for (const observations of [[first, second], [second, first], [row('d1', 'format', 'checklist'), row('d2', 'format', 'narrative')]]) {
    assert.throws(() => understand(observations), /ambiguous|conflict/);
  }
  assert.doesNotThrow(() => understand([first, { ...second, value: 'checklist' }]));
  assert.doesNotThrow(() => understand([first, { ...second, supersedes: 'a' }]));
  assert.equal(field(understand([row('d1', 'format', 'checklist'), row('d2', 'format', 'narrative', { supersedes: 'd1' })])).value, 'narrative');
});

test('inferred proposals need internal original evidence and remain unconfirmed rather than becoming a trait', () => {
  const source = observed('episode', 'remote', true, { refs: ['external-completion-17'] });
  const proposal = row('proposal', 'format', 'checklist', { source: 'inferred', refs: ['episode'] });
  const result = field(understand([source, proposal]));
  assert.equal(result.status, 'unconfirmed');
  assert.equal(result.usable, false);
  assert.equal(result.value, null);
  assert.deepEqual(result.proposals, [{ id: 'proposal', value: 'checklist', evidence: ['episode'] }]);
  assert.throws(() => understand([{ ...proposal, refs: [] }]), /source references/);
  assert.throws(() => understand([{ ...proposal, refs: ['missing'] }]), /invalid proposal source/);
  assert.throws(() => understand([source, proposal, { ...proposal, id: 'inference-chain', refs: ['proposal'] }]), /invalid proposal source/);
});

test('proposals cannot revive expired, confounded, withdrawn or replaced source evidence', () => {
  const proposal = row('proposal', 'format', 'checklist', { source: 'inferred', refs: ['source'], at: '2026-10-05T11:00:00.000Z' });
  const scenarios = [
    [observed('source', 'remote', true, { at: '2026-08-01T00:00:00.000Z' })],
    [observed('source', 'remote', true, { quality: 'confounded' })],
    [observed('source', 'remote', true, { quality: 'unassessed' })],
    [row('source', 'remote', true), row('withdrawn', 'remote', null, { at: '2026-10-05T11:00:00.000Z' })],
    [row('source', 'remote', null)],
    [observed('source', 'remote', true), observed('replacement', 'remote', false, { supersedes: 'source', at: '2026-10-05T11:00:00.000Z' })],
    [observed('source', 'remote', true, { independentKey: 'same-occasion' }), observed('latest', 'remote', false, { independentKey: 'same-occasion', at: '2026-10-05T11:00:00.000Z' })],
  ];
  for (const sources of scenarios) {
    const result = field(understand([...sources, proposal]));
    assert.deepEqual(result.proposals, []);
    assert.equal(result.usable, false);
    assert.ok(result.excluded.includes('proposal'));
  }
  const source = observed('source', 'remote', true);
  for (const quality of ['confounded', 'unassessed']) {
    assert.deepEqual(field(understand([source, { ...proposal, quality }])).proposals, []);
  }
});

test('fresh confounded or unassessed evidence is unusable and requests checking, not labeled expired', () => {
  const result = understand([
    observed('a', 'format', 'checklist', { quality: 'confounded' }),
    observed('b', 'format', 'checklist', { quality: 'unassessed' }),
  ]);
  assert.equal(field(result).status, 'unusable');
  assert.equal(field(result).usable, false);
  assert.deepEqual(field(result).excluded, ['a', 'b']);
  assert.deepEqual(result.needsCheck, ['format']);
});

test('the newest unusable entry for one occasion cannot revive an older usable entry', () => {
  const result = field(understand([
    observed('first', 'format', 'checklist', { independentKey: 'episode' }),
    observed('later', 'format', 'checklist', { independentKey: 'episode', quality: 'unassessed', at: '2026-10-05T11:00:00.000Z' }),
    observed('other', 'format', 'checklist'),
  ]));
  assert.equal(result.status, 'insufficient');
  assert.equal(result.independent, 1);
  assert.deepEqual(result.evidence, ['other']);
  assert.deepEqual(result.excluded, ['later']);
});

test('field lifetime excludes stale observations and numeric consensus uses declared tolerance', () => {
  const c = structuredClone(contract);
  c.fields.find(f => f.id === 'deadlineDays').tolerance = 1;
  const result = understand([
    observed('n1', 'deadlineDays', 10, {}, c), observed('n2', 'deadlineDays', 11, {}, c), observed('n3', 'deadlineDays', 12, {}, c),
    observed('stale', 'deadlineDays', 30, { at: '2026-08-01T00:00:00.000Z' }, c),
  ], { contract: c });
  assert.equal(field(result, 'deadlineDays').status, 'supported');
  assert.equal(field(result, 'deadlineDays').value, 11);
  assert.equal(field(result, 'deadlineDays').independent, 3);
  assert.deepEqual(field(result, 'deadlineDays').excluded, ['stale']);
});

test('the supplied scope is an isolation key, not authority to use another person, workspace or business', () => {
  const observation = row('owned', 'format', 'checklist');
  for (const changed of [{ subject: 'someone-else' }, { workspace: 'different-tool' }, { domain: 'LAB' }]) {
    assert.throws(() => understand([{ ...observation, scope: { ...scope, ...changed } }]), /foreign observation/);
  }
  assert.throws(() => understand([observation], { scope: { ...scope, consent: true } }), /invalid scope/);
});

test('observations cannot be silently repurposed across contracts, versions or purposes', () => {
  const observation = row('owned', 'format', 'checklist');
  for (const changed of [{ id: 'dating' }, { version: '2' }, { purpose: 'romantic-matching' }]) {
    assert.throws(() => understand([{ ...observation, contract: { ...observation.contract, ...changed } }]), /contract or purpose/);
  }
  const missing = { ...observation }; delete missing.contract;
  assert.throws(() => understand([missing]), /contract or purpose/);
});

test('PULSE accepts deliberate settings but never personal observation or inferred profiles', () => {
  const owner = { ...scope, domain: 'PULSE' };
  assert.equal(field(understand([row('setting', 'format', 'narrative', {}, contract, owner)], { scope: owner })).status, 'declared');
  assert.throws(() => understand([observed('tracking', 'format', 'narrative', {}, contract, owner)], { scope: owner }), /personal behavioral profile/);
});

test('malformed references, invalid source values and chronology are refused', () => {
  assert.throws(() => understand([row('n', 'deadlineDays', NaN)]), /outside its field/);
  assert.throws(() => understand([row('n', 'deadlineDays', '2')]), /outside its field/);
  assert.throws(() => understand([observed('n', 'format', null)]), /withdraw/);
  assert.throws(() => understand([observed('n', 'format', 'checklist', { independentKey: undefined })]), /independence key/);
  assert.throws(() => understand([observed('n', 'format', 'checklist', { refs: ['same', 'same'] })]), /references/);
  assert.throws(() => understand([row('n', 'format', 'checklist', { recordedAt: '2026-10-04T00:00:00.000Z' })]), /chronology/);
  assert.throws(() => understand([row('n', 'format', 'checklist', { personName: 'unexpected raw data' })]), /invalid or foreign observation/);
});

test('policy changes affect recommendations without rewriting the same personal evidence', () => {
  const observations = [row('format', 'format', 'checklist'), row('deadline', 'deadlineDays', 2)];
  const candidates = [
    { id: 'a-narrative', features: { format: 'narrative', deliveryDays: 1 } },
    { id: 'b-checklist', features: { format: 'checklist', deliveryDays: 1 } },
  ];
  const alternate = structuredClone(contract);
  alternate.criteria[0].prefer = 'different';
  const original = Domain.decide({ contract, scope, observations, at, candidates });
  const changed = Domain.decide({ contract: alternate, scope, observations, at, candidates });
  assert.equal(original.selected.id, 'b-checklist');
  assert.equal(changed.selected.id, 'a-narrative');
  assert.deepEqual(changed.understanding, original.understanding);
  original.snapshot.candidates[0].features.format = 'changed-output';
  original.understanding.fields[0].evidence.push('changed-output');
  assert.equal(candidates[0].features.format, 'narrative');
  assert.deepEqual(Domain.understand({ contract, scope, observations, at }).fields[0].evidence, ['format']);
});

test('unknown candidate features and nonfinite criterion weights cannot enter policy calculations', () => {
  const input = { contract, scope, observations: [], at };
  assert.throws(() => Domain.decide({ ...input, candidates: [{ id: 'raw', features: { age: 22 } }] }), /invalid candidate/);
  const c = structuredClone(contract); c.criteria[0].weight = Infinity;
  assert.throws(() => Domain.decide({ ...input, contract: c, candidates: [] }), /invalid criterion/);
});

test('a required numeric difference means outside tolerance, including facts inside the numeric range', () => {
  const c = structuredClone(contract);
  c.criteria = [{ id: 'different-time', field: 'deadlineDays', feature: 'deliveryDays', weight: 1, prefer: 'different', required: true }];
  const result = Domain.decide({ contract: c, scope, observations: [row('time', 'deadlineDays', 10, {}, c)], at,
    candidates: [{ id: 'near', features: { deliveryDays: 10.2 } }, { id: 'different', features: { deliveryDays: 11 } }],
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.selected.id, 'different');
  assert.deepEqual(result.excluded, [{ id: 'near', reasons: ['constraint:different-time'] }]);
});

test('numeric ranges and policy sums cannot silently turn nonfinite results into null scores', () => {
  const huge = { id: 'huge', version: '1', purpose: 'numeric-check', fields: [{ id: 'x', kind: 'number', range: [-Number.MAX_VALUE, Number.MAX_VALUE] }], criteria: [] };
  assert.throws(() => Domain.validateContract(huge), /numeric range/);
  const c = structuredClone(contract);
  c.criteria = [
    { id: 'one', field: 'format', feature: 'format', weight: Number.MAX_VALUE },
    { id: 'two', field: 'format', feature: 'format', weight: Number.MAX_VALUE },
  ];
  assert.throws(() => Domain.decide({ contract: c, scope, observations: [row('pref', 'format', 'checklist', {}, c)], at,
    candidates: [{ id: 'choice', features: { format: 'checklist' } }],
  }), /finite|overflow/);
});

test('the median of large finite numeric observations remains finite and within the declared range', () => {
  const c = { id: 'large-median', version: '1', purpose: 'numeric-check',
    fields: [{ id: 'x', kind: 'number', range: [Number.MAX_VALUE / 2, Number.MAX_VALUE], tolerance: Number.MAX_VALUE / 4 }], criteria: [],
  };
  const value = Number.MAX_VALUE * 0.75;
  const result = Domain.understand({ contract: c, scope, at, observations: [observed('x1', 'x', value, {}, c), observed('x2', 'x', value, {}, c)] });
  assert.equal(field(result, 'x').status, 'supported');
  assert.equal(field(result, 'x').value, value);
  assert.equal(Number.isFinite(field(result, 'x').value), true);
});
