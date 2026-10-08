import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductExperience } from '../experiences/atlas-lab/product-experience.mjs';
const api = createProductExperience(), at = '2026-10-07T03:00:00.000Z';
const later = minutes => new Date(Date.parse(at) + minutes * 60000).toISOString();
const binding = 'a'.repeat(64);
const allowance = { id: 'contact-with-notice', target: 'baseline', description: '미리 알려주는 공개 답이 있으면 며칠 간격도 허용', capturedAt: at, until: later(60),
  binding, ruleKey: 'b'.repeat(64), ruleAt: at, source: { eventId: 'event-1', at, duration: 'ongoing', encounterId: 'context-1' },
  contextId: 'context-1', candidatePublicKey: 'c'.repeat(64), ownerGeneration: 0, ownKey: 'd'.repeat(64), responseRevision: 0 };
const snapshot = { id: 'decision-1', contextId: 'context-1', candidateIds: ['candidate-1'], selectedId: 'candidate-1', allowance };
const issued = () => api.decide(api.create(), snapshot, at);
const delivered = () => api.deliver(issued(), snapshot.id, later(1));
const review = (state, value, minutes = 2, key = binding) => api.allowanceReview(state, { kind: 'allowance-review', decisionId: snapshot.id, value }, later(minutes), { binding: key });
const view = (state, key = binding, minutes = 3) => api.inspect(state, { workspace: 'self', at: later(minutes), allowedSelectedIds: ['candidate-1'], allowanceBindings: { [snapshot.id]: key } });

test('only a newly captured and delivered allowance can receive a private review; keep and unknown do not change the rule', () => {
  assert.throws(() => review(issued(), 'keep'), /delivered/);
  const pending = view(issued()).records[0].allowance;
  assert.equal(pending.valid, true); assert.equal(pending.canReview, true); assert.equal(pending.canRespond, false); assert.equal(pending.canPreviewClear, false);
  const legacy = api.deliver(api.decide(api.create(), { ...snapshot, allowance: undefined }, at), snapshot.id, later(1));
  assert.equal(view(legacy).records[0].allowance, undefined); assert.throws(() => review(legacy, 'keep'), /allowance record/);
  const original = delivered(), kept = review(original, 'keep'), unknown = review(kept, 'unknown', 3);
  assert.deepEqual(original.records[0].allowance, allowance);
  for (const state of [kept, unknown]) {
    const result = view(state).records[0].allowance;
    assert.equal(result.valid, true); assert.equal(result.canPreviewClear, false); assert.equal(result.until, later(60));
    assert.equal(state.records[0].allowance.ruleKey, allowance.ruleKey); assert.deepEqual(state.records[0].responses, {});
  }
});

test('stop is a separate response and requires an unchanged bound source to preview clear', () => {
  const stopped = review(delivered(), 'stop'); assert.equal(view(stopped).records[0].allowance.canPreviewClear, true);
  assert.equal(api.allowanceSource(stopped, snapshot.id, later(3), { binding, requireStop: true }).target, 'baseline');
  assert.throws(() => api.allowanceSource(review(delivered(), 'unknown'), snapshot.id, later(3), { binding, requireStop: true }), /source/);
  assert.throws(() => review(stopped, 'keep', 3, 'd'.repeat(64)), /source/);
  assert.equal(view(stopped, 'd'.repeat(64)).records[0].allowance.valid, false);
  const again = review(stopped, 'stop', 4); assert.equal(again.records[0].allowance.response.at, later(2));
  assert.equal(again.records[0].allowance.responseRevision, 1);
});

test('expiry at equality fails closed while withdrawing own response remains possible with missing current source', () => {
  const stopped = review(delivered(), 'stop');
  assert.throws(() => review(stopped, 'keep', 60), /source/);
  assert.equal(view(stopped, binding, 60).records[0].allowance.valid, false);
  const cleared = review(stopped, null, 61, undefined); assert.equal(cleared.records[0].allowance.response, undefined);
  assert.equal(cleared.records[0].allowance.responseRevision, 2);
  assert.deepEqual(review(cleared, null, 62), cleared);
});

test('projection hides source hashes and generations and never mixes allowance answers into Temper outcomes', () => {
  let state = api.setting(api.create(), { kind: 'evaluation-consent', enabled: true }, at);
  state = api.deliver(api.decide(state, snapshot, at), snapshot.id, later(1)); state = review(state, 'keep');
  const result = view(state), projected = result.records[0].allowance;
  for (const key of ['binding', 'ruleKey', 'ruleAt', 'source', 'contextId', 'candidatePublicKey', 'ownerGeneration', 'ownKey', 'responseRevision']) assert.equal(projected[key], undefined);
  assert.equal(result.metrics.allowance, undefined); assert.equal(result.metrics.intent.byPolicy[0].subjects.observed, 0);
  projected.response.value = 'stop'; assert.equal(state.records[0].allowance.response.value, 'keep');
});

test('strict snapshots reject forged scope, source, expiry, responses and extra review fields', () => {
  for (const bad of [ { ...allowance, contextId: 'other' }, { ...allowance, target: 'other' }, { ...allowance, until: at },
    { ...allowance, binding: 'x' }, { ...allowance, source: { ...allowance.source, until: later(10) } },
    { ...allowance, source: { ...allowance.source, duration: 'once' } }, { ...allowance, source: { ...allowance.source, secret: true } },
    { ...allowance, response: { value: 'keep', at }, responseRevision: 1 } ]) assert.throws(() => api.decide(api.create(), { ...snapshot, allowance: bad }, at), /allowance/);
  assert.throws(() => api.allowanceReview(delivered(), { decisionId: snapshot.id, value: 'keep', candidateId: 'other' }, later(2), { binding }), /invalid/);
  assert.throws(() => api.allowanceReview(delivered(), { decisionId: 'other', value: null }, later(2)), /own delivered/);
});
