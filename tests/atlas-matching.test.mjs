import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import TemperOutcomes from '../atlas/temper-outcomes.js';
import { createMatchingAdapter, MATCHING_SCENARIOS, MATCHING_FIELDS } from '../experiences/atlas-lab/matching.mjs';
const api = createMatchingAdapter({ Domain, Ask, TemperOutcomes });
const act = (state, kind, person, value, extra = {}) => api.record(state, { kind, ...(person ? { person } : {}), ...(value !== undefined ? { value } : {}), ...extra });
const declare = (state, person, field, value, extra = {}) => act(state, 'declare', person, value, { field, ...extra });
const show = (state, person) => act(state, 'deliver', person);
const answer = (state, person, value) => act(state, 'intent', person, value);
const intro = (state = api.create()) => act(state, 'introduce');
const bothDelivered = state => show(show(state, 'person-a'), 'person-b');
const bothAccepted = (state = api.create()) => answer(answer(bothDelivered(intro(state)), 'person-a', 'accept'), 'person-b', 'accept');
const plus = (state, ms) => new Date(Date.parse(state.events.at(-1).at) + ms).toISOString();

test('five authored scenarios have distinct outcomes and no proposal implies delivery or acceptance', () => {
  assert.equal(MATCHING_SCENARIOS.length, 5);
  assert.equal(MATCHING_FIELDS.length, 4);
  const ready = api.inspect(api.create());
  assert.equal(ready.eligibility.canIntroduce, true); assert.equal(ready.mutual.status, 'not-introduced');
  assert.deepEqual(ready.tracking.outcomes, []); assert.deepEqual(ready.tracking.exposures, []);
  assert.equal(ready.synthetic, true); assert.equal(ready.measurement.causalClaim, false); assert.equal(ready.measurement.policyPromotion, false);
  for (const scenario of MATCHING_SCENARIOS) assert.doesNotThrow(() => api.inspect(api.create(scenario.id)));
});

test('both directions are mandatory even when one person satisfies every condition', () => {
  const state = api.create('mismatch'), view = api.inspect(state);
  assert.equal(view.eligibility.status, 'ineligible'); assert.equal(view.eligibility.canIntroduce, false);
  assert.equal(view.eligibility.directions.find(d => d.person === 'person-a').decision.status, 'ready');
  assert.equal(view.eligibility.directions.find(d => d.person === 'person-b').decision.status, 'unavailable');
  assert.throws(() => intro(state), /both conditions/);
  let reverse = declare(api.create(), 'person-b', 'self.meetingTime', 'weekday-evening');
  assert.equal(api.inspect(reverse).eligibility.status, 'ineligible'); assert.throws(() => intro(reverse), /both conditions/);
});

test('missing partner facts are unknown and Ask asks the owner, not the person who wants that answer', () => {
  const state = api.create('unknown'), view = api.inspect(state), q = view.nextQuestion;
  assert.equal(view.eligibility.status, 'needs-confirmation'); assert.throws(() => intro(state), /both conditions/);
  assert.equal(q.person, 'person-b'); assert.equal(q.field, 'self.meetingTime'); assert.ok(q.value > 0);
  assert.equal(q.basis, 'declared-decision-value');
  assert.equal(view.participants[1].facts.find(f => f.field === q.field).value, null);
  assert.equal(api.inspect(declare(state, q.person, q.field, 'weekend')).eligibility.status, 'eligible');
  assert.equal(api.inspect(declare(state, q.person, q.field, 'weekday-evening')).eligibility.status, 'ineligible');
});

test('self description never supplies a missing requirement; explicit any is distinct from missing', () => {
  let state = declare(api.create(), 'person-a', 'requires.meetingTime', null);
  assert.equal(api.inspect(state).eligibility.status, 'needs-confirmation');
  assert.equal(api.inspect(state).nextQuestion.field, 'requires.meetingTime');
  state = declare(state, 'person-a', 'requires.meetingTime', 'any');
  state = declare(state, 'person-b', 'self.meetingTime', null);
  const view = api.inspect(state); assert.equal(view.eligibility.status, 'eligible');
  assert.equal(view.participants[1].facts.find(f => f.field === 'self.meetingTime').value, null);
  assert.equal(view.nextQuestion, null);
});

test('consent is separate from compatible requirements and acceptance', () => {
  const unknown = api.create('no-consent'); assert.throws(() => intro(unknown), /both conditions/);
  assert.equal(api.inspect(unknown).nextQuestion.field, 'consent');
  const denied = act(unknown, 'consent', 'person-b', false);
  assert.equal(api.inspect(denied).eligibility.status, 'no-consent'); assert.equal(api.inspect(denied).nextQuestion, null);
  const restored = act(denied, 'consent', 'person-b', true);
  assert.equal(api.inspect(restored).eligibility.canIntroduce, true); assert.equal(api.inspect(restored).mutual.status, 'not-introduced');
});

test('a decision is not exposure, and acceptance cannot precede actual delivery', () => {
  const state = intro(), view = api.inspect(state);
  assert.equal(view.tracking.decisions.length, 2); assert.equal(view.tracking.exposures.length, 0);
  assert.equal(view.measurement.byPolicy[0].counts.undelivered, 2);
  assert.throws(() => answer(state, 'person-a', 'accept'), /prior delivery/);
  assert.throws(() => act(state, 'result-delivered', 'person-a'), /mutual acceptance/);
  assert.throws(() => intro(state), /already active/);
});

test('no response remains unknown after a closed observation window, not a zero outcome', () => {
  const state = answer(bothDelivered(intro()), 'person-a', 'accept');
  const view = api.inspect(state, { at: plus(state, 31 * 60000) });
  assert.equal(view.mutual.status, 'awaiting-response'); assert.equal(view.participants[1].intent.value, 'unanswered');
  assert.deepEqual(view.tracking.outcomes, []);
  assert.equal(view.measurement.byPolicy[0].counts.missing, 2); assert.equal(view.measurement.byPolicy[0].mean, null);
});

test('mutual acceptance and delivering the result are separately recorded', () => {
  let state = bothAccepted(), view = api.inspect(state);
  assert.equal(view.mutual.status, 'mutual'); assert.equal(view.tracking.outcomes.length, 2);
  assert.ok(view.tracking.outcomes.every(o => o.value === 1)); assert.equal(view.tracking.resultDeliveries.length, 0);
  state = act(state, 'result-delivered', 'person-a'); view = api.inspect(state);
  assert.equal(view.participants[0].resultDelivered, true); assert.equal(view.participants[1].resultDelivered, false);
  assert.equal(view.tracking.resultDeliveries.length, 1); assert.throws(() => act(state, 'result-delivered', 'person-a'), /mutual acceptance/);
  const matured = api.inspect(state, { at: plus(state, 31 * 60000) }).measurement;
  assert.equal(matured.byPolicy[0].counts.observed, 2); assert.equal(matured.byPolicy[0].mean, 1);
  assert.equal(matured.comparison.status, 'insufficient_evidence'); assert.equal(matured.byPolicy[1].status, 'no_sample');
});

test('only an explicit decline permits a negative mutual outcome; changing it requires fresh result delivery', () => {
  let state = answer(bothDelivered(intro()), 'person-a', 'decline');
  assert.equal(api.inspect(state).mutual.status, 'declined'); assert.ok(api.inspect(state).tracking.outcomes.every(o => o.value === 0));
  state = answer(answer(state, 'person-a', 'accept'), 'person-b', 'accept');
  state = act(state, 'result-delivered', 'person-a');
  state = answer(state, 'person-b', 'decline');
  assert.equal(api.inspect(state).participants[0].resultDelivered, false);
  state = answer(state, 'person-b', 'accept'); assert.equal(api.inspect(state).mutual.status, 'mutual');
  assert.equal(api.inspect(state).tracking.resultDeliveries.length, 0);
});

test('withdrawal invalidates prior acceptance and result delivery without erasing historical delivery', () => {
  const state = api.create('withdrawn'), view = api.inspect(state);
  assert.equal(view.mutual.status, 'withdrawn'); assert.equal(view.round.active, false);
  assert.equal(view.tracking.outcomes.length, 0); assert.equal(view.tracking.resultDeliveries.length, 0);
  assert.equal(view.tracking.historicalResultDeliveries.length, 1);
  assert.equal(view.tracking.historicalResultDeliveries[0].introductionInvalidated, true);
  assert.throws(() => answer(state, 'person-b', 'accept'), /no current introduction/);
  const newRound = intro(state); assert.equal(api.inspect(newRound).participants[0].intent.value, 'unanswered');
});

test('consent off and on cannot revive an old acceptance or a previously delivered result', () => {
  let state = act(bothAccepted(), 'result-delivered', 'person-a');
  const originalRound = api.inspect(state).round.id;
  state = act(state, 'consent', 'person-b', null);
  assert.equal(api.inspect(state).eligibility.status, 'no-consent'); assert.equal(api.inspect(state).tracking.outcomes.length, 0);
  state = act(state, 'consent', 'person-b', true);
  assert.equal(api.inspect(state).mutual.status, 'invalidated'); assert.throws(() => answer(state, 'person-a', 'accept'), /no current introduction/);
  state = intro(state); assert.notEqual(api.inspect(state).round.id, originalRound);
  assert.ok(api.inspect(state).participants.every(p => p.intent.value === 'unanswered' && !p.delivered && !p.resultDelivered));
});

test('changed or withdrawn requirements invalidate the whole prior introduction', () => {
  let state = bothAccepted(); state = declare(state, 'person-a', 'requires.conversationPace', 'lively');
  assert.equal(api.inspect(state).eligibility.status, 'ineligible'); assert.equal(api.inspect(state).tracking.outcomes.length, 0);
  state = declare(state, 'person-a', 'requires.conversationPace', 'slow');
  assert.equal(api.inspect(state).eligibility.canIntroduce, true); assert.equal(api.inspect(state).mutual.status, 'invalidated');
  state = declare(state, 'person-a', 'requires.conversationPace', null);
  assert.equal(api.inspect(state).eligibility.status, 'needs-confirmation');
});

test('same-time contradictory consent, requirement or intention is rejected, leaving the original immutable', () => {
  const state = api.create(), original = JSON.stringify(state), at = state.events.at(-1).at;
  assert.throws(() => act(state, 'consent', 'person-b', false, { at }), /same-time/); assert.equal(JSON.stringify(state), original);
  const accepted = answer(show(intro(), 'person-a'), 'person-a', 'accept');
  assert.throws(() => act(accepted, 'intent', 'person-a', 'withdraw', { at: accepted.events.at(-1).at }), /same-time/);
  const changed = declare(state, 'person-a', 'requires.meetingTime', 'any');
  assert.throws(() => declare(changed, 'person-a', 'requires.meetingTime', 'weekend', { at: changed.events.at(-1).at }), /same-time/);
});

test('expired consent cannot support introduction; expired rounds cannot accept or notify', () => {
  const state = bothAccepted(), at = plus(state, 2 * 86400000), view = api.inspect(state, { at });
  assert.equal(view.eligibility.status, 'needs-confirmation'); assert.equal(view.round.active, false);
  assert.equal(view.tracking.outcomes.length, 0);
  assert.throws(() => act(state, 'intent', 'person-a', 'accept', { at }), /no current introduction/);
  assert.throws(() => act(state, 'result-delivered', 'person-a', undefined, { at }), /no current introduction/);
});

test('equivalent timezone spellings cannot turn simultaneous contradictions into later permission', () => {
  let state = answer(answer(bothDelivered(intro()), 'person-a', 'accept'), 'person-b', 'decline');
  const alternate = state.events.at(-1).at.replace('Z', '+00:00');
  assert.throws(() => act(state, 'intent', 'person-b', 'accept', { at: alternate }), /same-time/);
  assert.equal(api.inspect(state).mutual.status, 'declined');
  state = api.create();
  assert.throws(() => act(state, 'consent', 'person-b', false, { at: state.events.at(-1).at.replace('Z', '+00:00') }), /same-time/);
  state = declare(state, 'person-a', 'requires.meetingTime', 'any');
  assert.throws(() => declare(state, 'person-a', 'requires.meetingTime', 'weekend', { at: state.events.at(-1).at.replace('Z', '+00:00') }), /same-time/);
  const malformed = structuredClone(state); malformed.events.at(-1).at = malformed.events.at(-1).at.replace('Z', '+00:00');
  assert.throws(() => api.inspect(malformed), /canonical UTC/);
});

test('repeating the same acceptance does not undo a result that was actually delivered', () => {
  let state = act(bothAccepted(), 'result-delivered', 'person-a');
  const at = plus(state, 31 * 60000), before = api.inspect(state, { at });
  state = act(state, 'intent', 'person-b', 'accept', { at });
  assert.equal(api.inspect(state).participants[0].resultDelivered, true);
  assert.equal(api.inspect(state).tracking.resultDeliveries.length, 1);
  assert.deepEqual(api.inspect(state).tracking.outcomes, before.tracking.outcomes);
  assert.equal(api.inspect(state).measurement.byPolicy[0].counts.observed, 2);
  assert.equal(api.inspect(state).measurement.byPolicy[0].mean, 1);
  assert.throws(() => act(state, 'intent', 'person-b', 'decline', { at }), /same-time/);
});

test('foreign actors, scopes, inferred fields and old introduction IDs cannot be smuggled into replay', () => {
  const state = api.create();
  assert.throws(() => declare(state, 'foreign', 'self.meetingTime', 'weekend'), /actor/);
  assert.throws(() => declare(state, 'person-a', 'health', 'healthy'), /declared value/);
  assert.throws(() => api.record(state, { kind: 'consent', person: 'person-a', value: true, scope: 'other' }), /invalid action/);
  const selected = bothDelivered(intro()), corrupted = structuredClone(selected);
  corrupted.events.at(-1).roundId = 'event-1'; assert.throws(() => api.inspect(corrupted), /no current introduction/);
  const inferred = structuredClone(state); inferred.events[0].source = 'inferred'; assert.throws(() => api.inspect(inferred), /invalid event/);
});

test('no arbitrary answers or extra selection criteria are added by repeated pure inspection', () => {
  const state = api.create('unknown'), before = JSON.stringify(state);
  assert.deepEqual(api.inspect(state), api.inspect(state)); assert.equal(JSON.stringify(state), before);
  assert.equal(api.inspect(state).participants[1].facts.find(f => f.field === 'self.meetingTime').value, null);
  assert.throws(() => api.record(state, { kind: 'deliver', person: 'person-a' }), /no current introduction/);
});
