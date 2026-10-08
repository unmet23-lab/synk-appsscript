import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductExperience } from '../experiences/atlas-lab/product-experience.mjs';
const adapter = createProductExperience(), at = '2026-10-08T12:00:00.000Z', later = hours => new Date(Date.parse(at) + hours * 3600000).toISOString();
const snapshot = { id: 'decision-1', contextId: 'context-1', candidateIds: ['candidate-a'], selectedId: 'candidate-a' };
const view = (state, time = later(25)) => adapter.inspect(state, { workspace: 'own', at: time });
const consent = state => adapter.setting(state, { kind: 'evaluation-consent', enabled: true }, at);

test('private goal snapshot is immutable and viewing without delivery is not an observed outcome', () => {
  let state = adapter.setting(consent(adapter.create()), { kind: 'goal', value: 'intent' }, at);
  state = adapter.decide(state, snapshot, at);
  state = adapter.setting(state, { kind: 'goal', value: 'pace' }, later(1));
  assert.equal(view(state).records[0].goal, 'intent'); assert.equal(view(state).goal, 'pace');
  assert.equal(view(state).metrics.intent.byPolicy[0].counts.undelivered, 1);
  assert.throws(() => adapter.respond(state, { decisionId: 'decision-1', metric: 'intent', value: 'yes' }, later(1)), /delivered/);
  assert.equal(view(state).records[0].selectedId, undefined);
});

test('actual delivery joins own corrected responses to Temper; unknown and withdrawal are not failures', () => {
  let state = adapter.deliver(adapter.decide(consent(adapter.create()), snapshot, at), 'decision-1', later(1));
  const unchanged = adapter.deliver(state, 'decision-1', later(2)); assert.equal(unchanged.records[0].deliveredAt, later(1));
  state = adapter.respond(state, { decisionId: 'decision-1', metric: 'intent', value: 'no' }, later(2));
  state = adapter.respond(state, { decisionId: 'decision-1', metric: 'intent', value: 'partly' }, later(3));
  state = adapter.respond(state, { decisionId: 'decision-1', metric: 'burden', value: 'unknown' }, later(3));
  let result = view(state); assert.equal(result.metrics.intent.byPolicy[0].mean, 0.5); assert.equal(result.metrics.intent.byPolicy[0].subjects.observed, 1);
  assert.equal(result.metrics.intent.comparison.status, 'insufficient_evidence'); assert.equal(result.metrics.intent.causalClaim, false);
  assert.equal(result.metrics.burden.explicitUnknown, 1); assert.equal(result.metrics.burden.byPolicy[0].mean, null); assert.equal(result.metrics.burden.byPolicy[0].counts.missing, 1);
  state = adapter.respond(state, { decisionId: 'decision-1', metric: 'intent', value: null }, later(4));
  result = view(state); assert.equal(result.metrics.intent.byPolicy[0].mean, null); assert.equal(result.records[0].responses.intent, undefined);
  assert.throws(() => adapter.respond(state, { decisionId: 'other', metric: 'intent', value: 'yes' }, later(4)), /delivered/);
});

test('evaluation consent is explicit, prospective and withdrawal cannot revive old eligibility', () => {
  let state = adapter.decide(adapter.create(), snapshot, at); assert.equal(view(state).metrics, null);
  state = consent(state); assert.equal(state.records[0].evaluationEligible, false);
  state = adapter.decide(state, { ...snapshot, id: 'decision-2' }, later(1)); assert.equal(state.records[1].evaluationEligible, true);
  state = adapter.setting(state, { kind: 'evaluation-consent', enabled: false }, later(2)); assert.equal(view(state).metrics, null);
  state = adapter.setting(state, { kind: 'evaluation-consent', enabled: true }, later(3));
  assert.ok(state.records.every(row => !row.evaluationEligible)); assert.equal(view(state).metrics.intent.byPolicy[0].counts.decisions, 0);
});

test('comfort is separate from intent and binds a completed proposal; no retroactive evaluation consent', () => {
  let state = consent(adapter.create()); const completed = { id: 'meeting-1', pairId: 'pair-1', appointmentId: 'appointment-1', proposalVersion: 1, at, completedAt: later(2) };
  state = adapter.comfort(state, completed, 'mixed', later(3));
  const result = view(state, later(171)); assert.equal(result.metrics.comfort.byPolicy[0].mean, 0.5); assert.equal(result.metrics.intent.byPolicy[0].counts.decisions, 0);
  assert.throws(() => adapter.comfort(state, { ...completed, proposalVersion: 2 }, 'comfortable', later(4)), /changed/);
  assert.throws(() => adapter.comfort(state, { ...completed, completedAt: later(5) }, 'comfortable', later(4)), /completed/);
  state = adapter.comfort(state, completed, null, later(4)); assert.equal(view(state, later(171)).metrics.comfort.byPolicy[0].mean, null);
  let late = adapter.setting(adapter.create(), { kind: 'evaluation-consent', enabled: true }, later(3));
  late = adapter.comfort(late, completed, 'comfortable', later(4)); assert.equal(late.records[0].evaluationEligible, false);
});

test('corrections after the declared observation window remain late missing, not successes', () => {
  let state = adapter.deliver(adapter.decide(consent(adapter.create()), snapshot, at), snapshot.id, at);
  state = adapter.respond(state, { decisionId: snapshot.id, metric: 'intent', value: 'yes' }, later(26));
  const result = view(state, later(27)); assert.equal(result.metrics.intent.byPolicy[0].counts.late, 1); assert.equal(result.metrics.intent.byPolicy[0].mean, null);
  assert.equal(result.metrics.intent.byPolicy[1].counts.decisions, 0);
});

test('resaving the same value does not turn an on-time observation into a late correction', () => {
  let state = adapter.deliver(adapter.decide(consent(adapter.create()), snapshot, at), snapshot.id, at);
  state = adapter.respond(state, { decisionId: snapshot.id, metric: 'intent', value: 'yes' }, later(1));
  state = adapter.respond(state, { decisionId: snapshot.id, metric: 'intent', value: 'yes' }, later(25));
  state = adapter.respond(state, { decisionId: snapshot.id, metric: 'burden', value: 'much' }, later(25));
  assert.equal(state.records[0].responses.intent.at, later(1)); assert.equal(view(state, later(26)).metrics.intent.byPolicy[0].mean, 1);
  const completed = { id: 'meeting-1', pairId: 'pair-1', appointmentId: 'appointment-1', proposalVersion: 1, at, completedAt: later(2) };
  state = adapter.comfort(state, completed, 'comfortable', later(26));
  state = adapter.comfort(state, completed, 'comfortable', later(180));
  assert.equal(view(state, later(181)).metrics.comfort.byPolicy[0].mean, 1); assert.equal(state.records[1].responses.comfort.at, later(26));
});

const correction = { id: 'correction-1', sourceDecisionId: snapshot.id, contextId: snapshot.contextId, basisKey: 'a'.repeat(64),
  changes: [{ field: 'wants.pace', before: '주도하는 대화', after: '듣는 대화' }] };
function corrected({ evaluation = true } = {}) {
  let state = evaluation ? consent(adapter.create()) : adapter.create();
  state = adapter.deliver(adapter.decide(state, snapshot, at), snapshot.id, at);
  state = adapter.respond(state, { decisionId: snapshot.id, metric: 'intent', value: 'partly' }, later(1));
  return adapter.correct(state, correction, later(2), snapshot.candidateIds);
}
const linked = state => adapter.decide(state, { ...snapshot, id: 'decision-2' }, later(3), { basisKey: correction.basisKey, allowedSelectedIds: snapshot.candidateIds });

test('explicit correction links only the next matching recommendation, requires delivery and reports comparison without causality', () => {
  let state = linked(corrected());
  assert.equal(state.records[1].correctionId, correction.id);
  assert.throws(() => adapter.followup(state, { decisionId: 'decision-2', value: 'better' }, later(4)), /delivered/);
  state = adapter.deliver(state, 'decision-2', later(4));
  state = adapter.followup(state, { decisionId: 'decision-2', value: 'better' }, later(5));
  const result = view(state, later(173)); assert.equal(result.records[1].followup.valid, true); assert.equal(result.records[1].responses.followup.value, 'better');
  assert.equal(result.metrics.followup.byPolicy[0].mean, 1); assert.equal(result.metrics.followup.causalClaim, false); assert.equal(result.metrics.followup.comparison.status, 'insufficient_evidence');
  state = adapter.decide(state, { ...snapshot, id: 'decision-3' }, later(6), { basisKey: correction.basisKey });
  assert.equal(state.records[2].correctionId, undefined); assert.equal(result.corrections, undefined);
});

test('source correction or withdrawal invalidates followup irreversibly even when the same value is restored at the same timestamp', () => {
  let state = adapter.deliver(linked(corrected()), 'decision-2', later(4));
  state = adapter.followup(state, { decisionId: 'decision-2', value: 'same' }, later(4));
  state = adapter.respond(state, { decisionId: snapshot.id, metric: 'intent', value: null }, later(4));
  state = adapter.respond(state, { decisionId: snapshot.id, metric: 'intent', value: 'partly' }, later(4));
  const result = view(state); assert.equal(result.records[1].followup.valid, false); assert.equal(result.records[1].responses.followup.value, 'same');
  assert.equal(result.metrics.followup.byPolicy[0].counts.decisions, 0);
  assert.throws(() => adapter.followup(state, { decisionId: 'decision-2', value: 'better' }, later(5)), /no longer/);
  state = adapter.followup(state, { decisionId: 'decision-2', value: null }, later(5)); assert.equal(view(state).records[1].responses.followup, undefined);
});

test('changed basis, context or withdrawn source candidate never acquires a correction link', () => {
  const state = corrected();
  for (const [next, options] of [
    [{ ...snapshot, id: 'other-1' }, { basisKey: 'b'.repeat(64) }],
    [{ ...snapshot, id: 'other-2', contextId: 'context-2' }, { basisKey: correction.basisKey }],
    [{ ...snapshot, id: 'other-3' }, { basisKey: correction.basisKey, allowedSelectedIds: [] }]
  ]) assert.equal(adapter.decide(state, next, later(3), options).records[1].correctionId, undefined);
  let delivered = adapter.deliver(linked(state), 'decision-2', later(4));
  assert.throws(() => adapter.followup(delivered, { decisionId: 'decision-2', value: 'better' }, later(5), { allowedSelectedIds: [] }), /no longer/);
  assert.equal(adapter.inspect(delivered, { workspace: 'own', at: later(5), allowedSelectedIds: [] }).records[1].followup.valid, false);
});

test('comparison consent stays prospective, unknown is separate, and withdrawing then reenabling cannot restore comparison eligibility', () => {
  let state = adapter.deliver(linked(corrected()), 'decision-2', later(4));
  state = adapter.followup(state, { decisionId: 'decision-2', value: 'unknown' }, later(5));
  assert.equal(view(state).metrics.followup.explicitUnknown, 1); assert.equal(view(state).metrics.followup.byPolicy[0].mean, null);
  state = adapter.setting(state, { kind: 'evaluation-consent', enabled: false }, later(6)); assert.equal(view(state).metrics, null);
  state = adapter.setting(state, { kind: 'evaluation-consent', enabled: true }, later(7)); assert.equal(view(state).metrics.followup.byPolicy[0].counts.decisions, 0);
  let late = adapter.setting(corrected({ evaluation: false }), { kind: 'evaluation-consent', enabled: true }, later(3));
  late = adapter.deliver(linked(late), 'decision-2', later(4));
  late = adapter.followup(late, { decisionId: 'decision-2', value: 'better' }, later(5));
  assert.equal(view(late).metrics.followup.byPolicy[0].counts.decisions, 0);
});

test('legacy experience remains valid without invented correction history and malformed comparison records are rejected', () => {
  let legacy = adapter.deliver(adapter.decide(adapter.create(), snapshot, at), snapshot.id, at);
  assert.equal(view(legacy).records[0].followup, undefined);
  assert.throws(() => adapter.correct(legacy, correction, later(2)), /partly\/no/);
  legacy.records[0].responses.followup = { value: 'better', at };
  assert.throws(() => view(legacy), /correction link/);
});

const meetingCriteria = { pairId: 'pair-1', contextId: 'context-1', priorityKey: 'b'.repeat(64),
  criteria: [{ field: 'wants.pace', label: '대화 방식', value: 'lead', valueLabel: '주도', declarationId: 'event-1' }] };
test('private criterion snapshots are fixed at connection; completed response is separate and never changes preferences', () => {
  let state = adapter.captureCriteria(adapter.create(), meetingCriteria, at);
  const unchanged = adapter.captureCriteria(state, { ...meetingCriteria, criteria: [] }, later(1));
  assert.deepEqual(unchanged, state);
  const response = { pairId: 'pair-1', appointmentId: 'appointment-1', proposalVersion: 1, completedAt: later(2), field: 'wants.pace', value: 'less-important' };
  assert.throws(() => adapter.criterion(state, response, later(1)), /invalid private criterion/);
  state = adapter.criterion(state, response, later(3));
  assert.equal(adapter.criterionSource(state, response, later(3)).criterion.declarationId, 'event-1');
  assert.deepEqual(state.meetingCriteria[0].criteria, meetingCriteria.criteria);
  assert.equal(view(state).records.length, 0); assert.equal(view(state).metrics, null);
  state = adapter.criterion(state, response, later(4)); assert.equal(state.meetingCriteria[0].reviews[0].response.at, later(3));
  assert.throws(() => adapter.criterion(state, { ...response, proposalVersion: 2 }, later(4)), /changed completed/);
  state = adapter.criterion(state, { pairId: 'pair-1', appointmentId: 'appointment-1', field: 'wants.pace', value: null }, later(4));
  assert.equal(state.meetingCriteria[0].reviews.length, 0);
  assert.throws(() => adapter.criterionSource(state, response, later(4)), /less-important/);
});

test('legacy and malformed criterion histories do not infer past importance', () => {
  assert.throws(() => adapter.criterion(adapter.create(), { pairId: 'pair-1', appointmentId: 'appointment-1', field: 'wants.pace', value: 'helped' }, at), /known meeting/);
  assert.throws(() => adapter.captureCriteria(adapter.create(), { ...meetingCriteria, criteria: [{ ...meetingCriteria.criteria[0], until: at }] }, at), /snapshot/);
  const state = adapter.captureCriteria(adapter.create(), { ...meetingCriteria, criteria: [] }, at);
  assert.equal(state.meetingCriteria[0].criteria.length, 0);
});

test('restoration requires worse on a delivered linked record and an explicit original change; withdrawal and repeat cannot revive it', () => {
  let state = adapter.deliver(adapter.decide(adapter.create(), snapshot, at), snapshot.id, at);
  state = adapter.respond(state, { decisionId: snapshot.id, metric: 'intent', value: 'no' }, later(1));
  state = adapter.correct(state, { ...correction, restore: { kind: 'undo-field', field: 'wants.pace', changeId: 'event-2' } }, later(2));
  state = adapter.deliver(linked(state), 'decision-2', later(4));
  assert.throws(() => adapter.restoreSource(state, 'decision-2', later(4)), /worse/);
  state = adapter.followup(state, { decisionId: 'decision-2', value: 'worse' }, later(5));
  assert.deepEqual(adapter.restoreSource(state, 'decision-2', later(5)).action, { kind: 'undo-field', field: 'wants.pace', changeId: 'event-2' });
  assert.throws(() => adapter.restoreSource(state, 'decision-2', later(5), []), /worse/);
  const withdrawn = adapter.respond(state, { decisionId: snapshot.id, metric: 'intent', value: null }, later(6));
  assert.throws(() => adapter.restoreSource(withdrawn, 'decision-2', later(6)), /worse/);
  const restored = adapter.restored(state, 'decision-2', later(6));
  assert.throws(() => adapter.restoreSource(restored, 'decision-2', later(7)), /worse/);
  const legacy = adapter.followup(adapter.deliver(linked(corrected()), 'decision-2', later(4)), { decisionId: 'decision-2', value: 'worse' }, later(5));
  assert.throws(() => adapter.restoreSource(legacy, 'decision-2', later(5)), /worse/);
});
