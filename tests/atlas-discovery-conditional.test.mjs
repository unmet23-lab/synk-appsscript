import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import ConditionalPreference from '../atlas/conditional-preference.js';
import { createDiscoveryAdapter } from '../experiences/atlas-lab/discovery.mjs';
const api = createDiscoveryAdapter({ Domain, Ask, Personalization, ConditionalPreference });
const set = (state, field, value, extra = {}) => api.record(state, { kind: 'set', field, value, ...extra });
const ready = () => set(api.create('ready'), 'wants.contact', 'daily');
const ruleAction = (target = 'context', extra = {}) => ({ kind: 'conditional-set', ruleId: 'contact-with-notice', target, ...extra });
const apply = (state, action) => api.applyPreview(state, api.preview(state, action));
const detail = (view, id) => view.candidates.find(row => row.id === id).reasonDetails.find(item => item.field === 'wants.contact' && item.owner === 'self');
const field = (view, id) => view.fields.find(row => row.id === id);

test('preview and cancellation are pure; only application records explicit conditional acceptance', () => {
  let state = ready(), before = api.inspect(state), snapshot = structuredClone(state);
  const preview = api.preview(state, ruleAction()); assert.deepEqual(state, snapshot); assert.deepEqual(api.inspect(state), before);
  state = api.applyPreview(state, preview); const after = api.inspect(state);
  assert.equal(after.conditionalPreference.effective.status, 'active'); assert.equal(after.conditionalPreference.target, 'context');
  assert.deepEqual(after.fields, before.fields); assert.deepEqual(after.priorities, before.priorities);
  assert.equal(detail(after, 'candidate-4').comparison, 'conditional'); assert.equal(detail(after, 'candidate-1').comparison, 'different');
  assert.equal(detail(after, 'candidate-2').comparison, 'match');
  assert.throws(() => api.record(snapshot, ruleAction()), /preview/); assert.throws(() => api.applyPreview(state, preview), /stale/);
});
test('same other facts rank primary above conditional above mismatch through existing Core Domain policy objectives', () => {
  const trace = [], instrumented = { ...Domain, decide: input => { const result = Domain.decide(input); trace.push({ input, result }); return result; } };
  const candidates = [['primary', 'daily', 'when-free'], ['conditional', 'few-days', 'advance'], ['mismatch', 'few-days', 'when-free']]
    .map(([id, contact, notice]) => ({ id, label: id, values: { consent: true, availability: 'weekend', 'self.contact': contact, 'self.notice': notice }, required: [] }));
  const local = createDiscoveryAdapter({ Domain: instrumented, Ask, Personalization, ConditionalPreference, synthetic: false, ownerId: 'owner', contextId: 'test', candidates });
  let state = local.create(); for (const [field, value] of [['consent', true], ['availability', 'weekend'], ['wants.contact', 'daily']]) state = local.record(state, { kind: 'set', field, value });
  state = local.applyPreview(state, local.preview(state, ruleAction()));
  assert.deepEqual(local.inspect(state).candidates.map(row => row.id), ['primary', 'conditional', 'mismatch']);
  const conditional = trace.find(row => row.input.contract.objectives?.[0]?.id === 'conditional.contact');
  assert.ok(conditional); assert.equal(conditional.input.contract.objectives[0].weight, 1);
  assert.equal(conditional.input.observations.find(row => row.field === 'wants.contact').value, 'daily');
  assert.equal(conditional.result.ranked[0].policyReasons[0].contribution, 1);
  assert.equal(conditional.result.ranked[0].reasons.find(row => row.field === 'wants.contact').contribution, 0);
  state = local.record(state, { kind: 'priorities', fields: ['wants.contact'], target: 'context' }); local.inspect(state);
  assert.ok(trace.some(row => row.input.contract.objectives?.[0]?.weight === 2));
});
test('missing public notice never triggers allowance and its explanatory state is unknown', () => {
  const local = createDiscoveryAdapter({ Domain, Ask, Personalization, ConditionalPreference, synthetic: false, ownerId: 'owner', contextId: 'test',
    candidates: [{ id: 'other', label: '상대', values: { consent: true, availability: 'weekend', 'self.contact': 'few-days' }, required: [] }] });
  let state = local.create(); for (const [field, value] of [['consent', true], ['availability', 'weekend'], ['wants.contact', 'daily']]) state = local.record(state, { kind: 'set', field, value });
  state = local.applyPreview(state, local.preview(state, ruleAction())); const view = local.inspect(state);
  assert.equal(detail(view, 'other').comparison, 'different'); assert.equal(detail(view, 'other').conditionStatus, 'unknown');
  assert.equal(view.candidates[0].status, 'eligible', 'a soft alternative never creates an implicit required notice answer');
});
test('my hard contact requirement and every reciprocal/other hard condition remain strict', () => {
  const state = set(ready(), 'wants.contact', 'daily', { required: true }), view = api.inspect(state);
  assert.equal(view.conditionalPreference.available, false); assert.match(view.conditionalPreference.blockReason, /필수조건/);
  assert.throws(() => api.preview(state, ruleAction()), /optional explicit/);
  const after = api.inspect(apply(ready(), ruleAction())); assert.equal(after.candidates.find(row => row.id === 'candidate-4').status, 'excluded');
  assert.equal(after.candidates.find(row => row.id === 'candidate-5').status, 'pending');
  const hardPlan = apply(set(ready(), 'wants.plan', 'planned', { required: true }), ruleAction());
  assert.equal(api.inspect(hardPlan).candidates.find(row => row.id === 'candidate-3').status, 'excluded');
});
test('clear is previewed, keeps original answers and retracts only its selected allowance layer', () => {
  let state = apply(ready(), ruleAction('baseline')), before = api.inspect(state);
  const preview = api.preview(state, { kind: 'conditional-clear', target: 'baseline' });
  assert.equal(api.inspect(state).conditionalPreference.effective.status, 'active');
  state = api.applyPreview(state, preview); const after = api.inspect(state);
  assert.equal(after.conditionalPreference.effective.status, 'none'); assert.deepEqual(after.fields, before.fields);
  assert.equal(detail(after, 'candidate-4').comparison, 'different');
  assert.throws(() => api.record(state, { kind: 'conditional-clear', target: 'baseline' }), /preview/);
});
test('same-value redeclaration permanently invalidates old allowance even after field undo', () => {
  let state = apply(ready(), ruleAction('baseline'));
  state = set(state, 'wants.contact', 'daily'); assert.equal(api.inspect(state).conditionalPreference.effective.status, 'inactive');
  const change = state.events.at(-1).id; state = api.record(state, { kind: 'undo-field', field: 'wants.contact', changeId: change });
  const view = api.inspect(state); assert.equal(field(view, 'wants.contact').value, 'daily'); assert.equal(view.conditionalPreference.effective.status, 'inactive');
  assert.equal(detail(view, 'candidate-4').comparison, 'different');
  state = apply(state, ruleAction('baseline')); assert.equal(api.inspect(state).conditionalPreference.effective.status, 'active');
});
test('unknown, override and reversion cannot revive a baseline allowance', () => {
  for (const action of [{ kind: 'mark-unknown', field: 'wants.contact' }, { kind: 'set', field: 'wants.contact', value: 'few-days', target: 'context' },
    { kind: 'clear', field: 'wants.contact', target: 'baseline' }]) {
    let state = api.record(apply(ready(), ruleAction('baseline')), action);
    if (action.kind !== 'clear') state = api.record(state, { kind: 'revert-context', field: 'wants.contact' });
    const view = api.inspect(state); assert.equal(view.conditionalPreference.effective.status, 'inactive');
    assert.notEqual(detail(view, 'candidate-4').comparison, 'conditional');
  }
});
test('baseline rule survives an unchanged new encounter; context allowance ends with its encounter', () => {
  let baseline = api.record(apply(ready(), ruleAction('baseline')), { kind: 'start-context' });
  assert.equal(api.inspect(baseline).conditionalPreference.effective.status, 'active');
  let once = api.record(apply(ready(), ruleAction()), { kind: 'start-context' });
  assert.equal(api.inspect(once).conditionalPreference.effective.status, 'none');
  baseline = api.record(baseline, { kind: 'mark-unknown', field: 'wants.contact' }); baseline = api.record(baseline, { kind: 'start-context' });
  assert.equal(api.inspect(baseline).conditionalPreference.effective.status, 'inactive');
});
test('once original preference cannot be widened by baseline allowance', () => {
  const state = set(ready(), 'wants.contact', 'daily', { target: 'context' });
  assert.deepEqual(api.inspect(state).conditionalPreference.availableTargets, ['context']);
  assert.throws(() => api.preview(state, ruleAction('baseline')), /widen/);
});
test('source deadline, own allowance deadline and stale previews fail closed without extra writes', () => {
  const until = '2026-10-07T12:00:00.000Z';
  let state = set(ready(), 'wants.contact', 'daily', { until }), p = api.preview(state, ruleAction('baseline'));
  assert.throws(() => api.applyPreview(state, p, { at: until }), /stale/);
  state = api.applyPreview(state, p); const count = state.events.length;
  assert.equal(api.inspect(state, { at: until }).conditionalPreference.effective.status, 'inactive'); assert.equal(state.events.length, count);
  assert.throws(() => api.preview(set(ready(), 'wants.contact', 'daily', { until }), ruleAction('baseline', { until: '2026-10-08T12:00:00.000Z' })), /outlives/);
  state = apply(ready(), ruleAction('baseline', { until })); p = api.preview(state, { kind: 'conditional-clear', target: 'baseline' });
  assert.throws(() => api.applyPreview(state, p, { at: until }), /stale/);
});
test('a changed or expired allowance clears selected handoff and exposes a truthful recommendation change', () => {
  let state = apply(ready(), ruleAction('baseline', { until: '2026-10-07T12:00:00.000Z' }));
  state = api.record(state, { kind: 'select', candidateId: 'candidate-2' }); state = api.record(state, { kind: 'expose', candidateIds: ['candidate-2'] });
  assert.ok(api.handoff(state)); const after = api.inspect(state, { at: '2026-10-07T12:00:00.000Z' });
  assert.equal(after.selection, null); assert.equal(api.handoff(state, { at: '2026-10-07T12:00:00.000Z' }), null);
  assert.ok(after.repetition.reasons.some(row => row.kind === 'conditional-preference-changed'));
  const ordinary = api.record(ready(), { kind: 'expose', candidateIds: ['candidate-2'] });
  assert.ok(api.inspect(apply(ordinary, ruleAction())).repetition.reasons.some(row => row.kind === 'conditional-preference-changed'));
});
test('conditional rule events reject altered source, arbitrary rules, payload fields and unavailable module', () => {
  const state = ready();
  for (const action of [{ ...ruleAction(), ruleId: 'free-form' }, { ...ruleAction(), field: 'wants.contact' }, { ...ruleAction(), target: 'other' },
    { ...ruleAction(), until: '2020-01-01T00:00:00.000Z' }]) assert.throws(() => api.preview(state, action), TypeError);
  const saved = apply(state, ruleAction()); for (const change of [event => event.rule.source.eventId = 'event-1', event => event.rule.when.value = 'when-free', event => event.rule.scope.personId = 'other', event => event.rule.secret = true]) {
    const altered = structuredClone(saved); change(altered.events.at(-1)); assert.throws(() => api.inspect(altered), TypeError);
  }
  const legacy = createDiscoveryAdapter({ Domain, Ask, Personalization }); assert.throws(() => legacy.preview(ready(), ruleAction()), /support/);
});
test('legacy comparison, Ask behavior, exposure basis and handoff remain byte-compatible without rules', () => {
  const legacy = createDiscoveryAdapter({ Domain, Ask, Personalization });
  let state = ready(); state = api.record(state, { kind: 'select', candidateId: 'candidate-2' }); state = api.record(state, { kind: 'expose', candidateIds: ['candidate-2'] });
  const { conditionalPreference, ...withModule } = api.inspect(state); assert.deepEqual(withModule, legacy.inspect(state));
  assert.equal(Object.hasOwn(state.events.at(-1).shownBasis, 'conditionalKey'), false); assert.deepEqual(api.handoff(state), legacy.handoff(state));
});
test('hiding, question controls and hypothetical answers never copy or infer acceptance', () => {
  let state = apply(ready(), ruleAction('baseline')), original = api.inspect(state).conditionalPreference.effective.rule;
  state = api.record(state, { kind: 'hide-candidate', candidateId: 'candidate-4', days: 7 }); state = api.record(state, { kind: 'question-mode', mode: 'brief' });
  const view = api.inspect(state); assert.deepEqual(view.conditionalPreference.effective.rule, original);
  assert.equal(view.candidates.find(row => row.id === 'candidate-4').status, 'excluded');
  assert.equal(view.reasons.length, 0); assert.ok(!JSON.stringify(view.candidates).includes('core-conditional-preference'));
});
