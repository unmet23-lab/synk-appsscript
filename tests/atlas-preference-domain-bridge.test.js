'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Domain = require('../atlas/domain');
const P = require('../atlas/personalization').preferences;
const DAY = 86400000, start = Date.parse('2026-10-06T00:00:00.000Z');
const time = days => new Date(start + days * DAY).toISOString();
const scope = { personId: 'person-a', productId: 'travel', contextId: 'preferences', domain: 'PATH' };
const domainScope = { domain: 'PATH', workspace: 'travel', subject: 'person-a' };
const contract = { id: 'trip', version: '1', purpose: 'travel-choice', fields: [
  { id: 'food', kind: 'enum', values: ['local', 'fine'], maxAgeDays: 2 },
  { id: 'budget', kind: 'number', range: [30000, 1000000] },
], criteria: [{ id: 'food-fit', field: 'food', feature: 'food', weight: 3 }] };
const initial = (events = [], extra = {}) => ({ contract, scope, events, encounterId: 'trip-1', at: time(0), ...extra });
const add = (events, id, kind, extra = {}) => P.record(initial(events, { id, kind, ...extra }));
const bridge = (events = [], extra = {}) => P.toDomain({ ...initial(events), domainScope, ...extra });
const field = (result, id) => result.understanding.fields.find(row => row.id === id);
const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; };

test('explicit until shortens but never extends a contract lifetime and retains the original declaration timestamp', () => {
  for (const [deadline, expected] of [[time(1), time(1)], [time(4), time(2)]]) {
    const events = add([], 'deadline-food', 'set', { field: 'food', value: 'local', duration: 'ongoing', until: deadline });
    const result = bridge(events, { at: time(0.5) });
    assert.equal(result.observations[0].at, time(0)); assert.equal(result.observations[0].until, expected);
    assert.equal(result.lineage[0].until, expected); assert.equal(result.layers.baseline.provenance.food.until, deadline);
    const expired = bridge(events, { at: expected }); assert.equal(field(expired, 'food').status, 'expired'); assert.equal(field(expired, 'food').usable, false);
  }
});

test('expired explicit deadlines reach Domain as expired evidence so missing hard conditions cannot silently pass', () => {
  const hard = { ...contract, criteria: [{ ...contract.criteria[0], required: true }] };
  let events = add([], 'old', 'set', { contract: hard, field: 'food', value: 'local', duration: 'ongoing' });
  events = add(events, 'deadline', 'set', { contract: hard, field: 'food', value: 'fine', duration: 'ongoing', until: time(1) });
  const result = bridge(events, { contract: hard, at: time(1) });
  assert.deepEqual(result.layers.effective.values, {}); assert.equal(result.observations[0].id, 'deadline');
  assert.equal(result.observations[0].until, time(1)); assert.equal(field(result, 'food').status, 'expired');
  const decision = Domain.decide({ contract: hard, scope: domainScope, observations: result.observations, at: time(1), candidates: [{ id: 'fine-food', features: { food: 'fine' } }] });
  assert.equal(decision.selected, null); assert.deepEqual(decision.excluded[0].reasons, ['unknown:food-fit']);
  events = add(events, 'forget', 'withdraw', { contract: hard, at: time(1), field: 'food', duration: 'ongoing' });
  assert.deepEqual(bridge(events, { contract: hard, at: time(1) }).observations, []);
});

test('once deadline restores only the current baseline and exports its original expiry rather than the ending override', () => {
  let events = add([], 'usual', 'set', { field: 'food', value: 'local', duration: 'ongoing', until: time(5) });
  events = add(events, 'this-trip', 'set', { at: time(0.5), field: 'food', value: 'fine', duration: 'once', until: time(1) });
  const restored = bridge(events, { at: time(1) });
  assert.equal(restored.observations[0].id, 'usual'); assert.equal(restored.observations[0].at, time(0)); assert.equal(restored.observations[0].until, time(2));
  assert.equal(field(restored, 'food').value, 'local'); assert.equal(restored.layers.context.expired[0].eventId, 'this-trip');
  assert.equal(field(bridge(events, { at: time(2) }), 'food').status, 'expired', 'returning to baseline does not refresh its contract age');
  const noBaseline = add([], 'only-once', 'set', { field: 'food', value: 'fine', duration: 'once', until: time(1) });
  assert.equal(bridge(noBaseline, { at: time(1) }).observations[0].id, 'only-once');
});

test('feedback until preserves provenance and current masks remain the product responsibility', () => {
  let events = add([], 'idea', 'propose', { field: 'food', value: 'fine', feedbackId: 'feedback' });
  events = add(events, 'applied', 'apply', { at: time(0.5), proposalId: 'idea', duration: 'ongoing', until: time(1) });
  const result = bridge(events, { at: time(1) });
  assert.deepEqual(result.observations[0].refs, ['applied', 'idea', 'feedback']); assert.equal(result.lineage[0].source, 'feedback-confirmed');
  assert.equal(result.observations[0].at, time(0.5)); assert.equal(result.observations[0].until, time(1));
  assert.throws(() => bridge(events, { at: time(1), unknown: ['food'] }), /unsupported/, 'an implicit mask cannot silently rewrite the bridge');
  const masked = result.observations.filter(row => row.field !== 'food');
  assert.equal(Domain.understand({ contract, scope: domainScope, observations: masked, at: time(1) }).fields.find(row => row.id === 'food').status, 'unknown');
});

test('empty or proposed-only preferences create no personal declarations', () => {
  assert.deepEqual(bridge().observations, []); assert.deepEqual(bridge().lineage, []);
  const proposed = add([], 'suggestion', 'propose', { field: 'food', value: 'fine', feedbackId: 'feedback-1' });
  const result = bridge(proposed);
  assert.deepEqual(result.observations, []); assert.equal(field(result, 'food').status, 'unknown');
  assert.equal(result.layers.effective.pendingProposals.length, 1);
});

test('explicit value, event id, original time and finite lifetime reach Domain and decision evidence', () => {
  const events = add([], 'chosen-food', 'set', { field: 'food', value: 'local', duration: 'once' });
  const result = bridge(events, { at: time(1) });
  assert.deepEqual(result.observations, [{ id: 'chosen-food', scope: domainScope, contract: { id: 'trip', version: '1', purpose: 'travel-choice' },
    field: 'food', value: 'local', source: 'declared', at: time(0), until: time(2), refs: ['chosen-food'] }]);
  assert.deepEqual(result.lineage, [{ field: 'food', eventId: 'chosen-food', source: 'explicit', duration: 'once', encounterId: 'trip-1', at: time(0), until: time(2) }]);
  const choice = Domain.decide({ contract, scope: domainScope, observations: result.observations, at: time(1), candidates: [
    { id: 'local-plan', features: { food: 'local' } }, { id: 'fine-plan', features: { food: 'fine' } }] });
  assert.equal(choice.selected.id, 'local-plan'); assert.deepEqual(choice.selected.reasons[0].evidence, ['chosen-food']);
});

test('once overrides baseline; closure restores only the surviving ongoing declaration', () => {
  let events = add([], 'usual', 'set', { field: 'food', value: 'local', duration: 'ongoing' });
  events = add(events, 'today', 'set', { field: 'food', value: 'fine', duration: 'once' });
  assert.equal(bridge(events).observations[0].id, 'today');
  assert.equal(bridge(events, { encounterId: 'trip-2' }).observations[0].id, 'usual');
  events = add(events, 'close', 'close');
  const closed = bridge(events);
  assert.equal(closed.layers.context.closed, true); assert.equal(closed.observations[0].id, 'usual');
});

test('correction and withdrawal do not resurrect superseded choices or export revoked values', () => {
  let events = add([], 'old', 'set', { field: 'food', value: 'local', duration: 'ongoing' });
  events = add(events, 'corrected', 'set', { field: 'food', value: 'fine', duration: 'ongoing' });
  assert.deepEqual(bridge(events).observations.map(row => row.id), ['corrected']);
  events = add(events, 'withdrawn', 'withdraw', { field: 'food', duration: 'ongoing' });
  assert.deepEqual(bridge(events).observations, []); assert.equal(field(bridge(events), 'food').status, 'unknown');
  events = add(events, 'new-budget', 'set', { field: 'budget', value: 200000, duration: 'once' });
  events = add(events, 'forget', 'reset');
  assert.deepEqual(bridge(events).observations, []);
});

test('expiration retains the original observation and never restarts its clock on projection', () => {
  let events = add([], 'usual', 'set', { field: 'food', value: 'local', duration: 'ongoing' });
  events = add(events, 'today', 'set', { field: 'food', value: 'fine', duration: 'once', at: time(1) });
  const expired = bridge(events, { at: time(3) });
  assert.equal(expired.observations[0].id, 'today'); assert.equal(expired.observations[0].at, time(1));
  assert.equal(expired.observations[0].until, time(3)); assert.equal(field(expired, 'food').status, 'expired');
  assert.equal(field(expired, 'food').usable, false); assert.equal(field(expired, 'food').value, null);
  assert.equal(expired.layers.effective.values.food, 'fine', 'layers remains an explicit projection; Domain owns freshness');
  assert.equal(bridge(events, { at: time(10) }).observations[0].until, time(3));
  const budget = add([], 'budget-choice', 'set', { field: 'budget', value: 100000, duration: 'once' });
  assert.equal(bridge(budget).observations[0].until, time(30));
});

test('confirmed feedback preserves application, proposal and feedback references separately from declared source', () => {
  let events = add([], 'proposal', 'propose', { field: 'food', value: 'fine', feedbackId: 'actual-feedback' });
  events = add(events, 'confirmed', 'apply', { proposalId: 'proposal', duration: 'ongoing', at: time(1) });
  const result = bridge(events, { at: time(1) });
  assert.equal(result.observations[0].source, 'declared'); assert.equal(result.observations[0].at, time(1));
  assert.deepEqual(result.observations[0].refs, ['confirmed', 'proposal', 'actual-feedback']);
  assert.equal(result.lineage[0].source, 'feedback-confirmed');
});

test('subject, domain and preference product/context/contract boundaries cannot be relabeled', () => {
  const events = add([], 'chosen', 'set', { field: 'food', value: 'local', duration: 'once' });
  for (const target of [{ ...domainScope, subject: 'person-b' }, { ...domainScope, domain: 'LAB' }, { ...domainScope, extra: true }, { ...domainScope, workspace: '' }]) {
    assert.throws(() => bridge(events, { domainScope: target }), TypeError);
  }
  for (const [key, value] of Object.entries({ productId: 'other', contextId: 'other', personId: 'person-b' })) {
    assert.throws(() => bridge(events, { scope: { ...scope, [key]: value } }), TypeError);
  }
  assert.throws(() => bridge(events, { contract: { ...contract, purpose: 'other' } }), /foreign/);
  assert.throws(() => bridge(events, { extra: true }), /unsupported/);
  assert.equal(bridge(events, { domainScope: { ...domainScope, workspace: 'host-owned-other-workspace' } }).observations[0].scope.workspace, 'host-owned-other-workspace');
});

test('bridge remains pure and cloned for frozen inputs, returned observations, layers and lineage', () => {
  const events = freeze(add([], 'chosen', 'set', { field: 'food', value: 'local', duration: 'once' }));
  const c = freeze(structuredClone(contract)), s = freeze(structuredClone(scope));
  const before = JSON.stringify({ events, c, s }), result = bridge(events, { contract: c, scope: s });
  result.observations[0].scope.subject = 'changed'; result.observations[0].refs.push('changed');
  result.layers.effective.values.food = 'fine'; result.lineage[0].source = 'changed';
  assert.equal(JSON.stringify({ events, c, s }), before);
  assert.equal(bridge(events).observations[0].value, 'local');
});

test('browser loading uses existing Core/Domain dependency paths and supports policy objectives', () => {
  const context = vm.createContext({});
  for (const file of ['engine.js', 'domain.js', 'personalization.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../atlas', file), 'utf8'), context);
  const packet = { ...initial(), domainScope, contract: { ...contract, objectives: [{ id: 'cost', feature: 'cost', range: [0, 100], weight: 1, prefer: 'lower' }] } };
  const result = vm.runInContext(`(() => {
    const input = ${JSON.stringify(packet)};
    const bridge = SynkAtlasPersonalization.preferences.toDomain(input);
    return SynkAtlasDomain.decide({contract: input.contract, scope: input.domainScope, observations: bridge.observations, at: input.at,
      candidates: [{id:'cheap',features:{cost:20}},{id:'costly',features:{cost:80}}]});
  })()`, context);
  assert.equal(result.selected.id, 'cheap'); assert.equal(result.selected.reasons.length, 0);
  assert.equal(result.selected.policyReasons[0].candidateValue, 20);
});
