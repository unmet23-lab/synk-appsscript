import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { createDiscoveryAdapter } from '../experiences/atlas-lab/discovery.mjs';

const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
const act = (state, action) => api.record(state, action);
const set = (state, field, value, extra = {}) => act(state, { kind: 'set', field, value, ...extra });
const field = (state, id, adapter = api) => adapter.inspect(state).fields.find(f => f.id === id);
function external(candidates, observingAsk = Ask) {
  const adapter = createDiscoveryAdapter({ Domain, Ask: observingAsk, Personalization, synthetic: false, ownerId: 'me', contextId: 'test', candidates });
  let state = adapter.create();
  for (const [field, value] of Object.entries({ consent: true, availability: 'weekend' })) state = adapter.record(state, { kind: 'set', field, value });
  return { adapter, state };
}
const person = (id, values = {}, required = []) => ({ id, label: id, values: { consent: true, availability: 'weekend', ...values }, required });

test('Ask evaluates actual reciprocal fit and explicit priorities, without inferred option or response probabilities', () => {
  const inputs = [], results = [];
  const observed = { ...Ask, choose(input) { inputs.push(input); const result = Ask.choose(input); results.push(result); return result; } };
  const pool = [person('a', { 'self.pace': 'lead', 'self.contact': 'daily' }), person('b', { 'self.pace': 'listen', 'self.contact': 'few-days' })];
  let { adapter, state } = external(pool, observed);
  state = adapter.record(state, { kind: 'priorities', fields: ['wants.contact'], target: 'baseline' });
  inputs.length = 0; results.length = 0;
  const q = adapter.inspect(state).question;
  assert.equal(q.field, 'wants.contact'); assert.equal(q.valueBasis, 'declared-decision-value'); assert.match(q.valueReason, /중요/);
  const input = inputs.at(-1), ranked = results.at(-1).ranked;
  assert.equal(typeof input.evaluate, 'function');
  assert.ok(input.questions.every(q => q.cost > 0 && !Object.hasOwn(q, 'responseProbability') && q.options.every(o => !Object.hasOwn(o, 'p'))));
  assert.ok(ranked.find(q => q.id === 'wants.contact').value > ranked.find(q => q.id === 'wants.pace').value);
  const impactOnly = Ask.choose({ ...input, evaluate: undefined, questions: input.questions.map(({ cost, ...question }) => question) });
  assert.equal(impactOnly.question.field, 'wants.pace', 'same scenario: change-count policy chooses the earlier ordinary criterion');
  assert.equal(adapter.inspect(state).fields.find(f => f.id === 'wants.contact').state, 'unknown', 'analysis never fills an answer');
  assert.equal(q.value, undefined, 'internal policy utility is not shown as compatibility');
});

test('a changed lower-candidate ordering with no better leading choice is not itself question value', () => {
  const { adapter, state: first } = external([person('a', { 'self.pace': 'lead', 'self.plan': 'planned', 'self.contact': 'daily' }),
    person('b', { 'self.pace': 'listen', 'self.plan': 'spontaneous', 'self.contact': 'few-days' }),
    person('c', { 'self.pace': 'listen', 'self.plan': 'spontaneous', 'self.contact': 'daily' })]);
  let state = first;
  for (const [field, value] of Object.entries({ 'wants.pace': 'lead', 'wants.plan': 'planned' })) state = adapter.record(state, { kind: 'set', field, value });
  assert.equal(adapter.inspect(state).topCandidateId, 'a');
  assert.equal(adapter.inspect(state).question, null, 'do not spend an answer just to reorder lower-ranked candidates');
});

test('multiple missing mandatory answers remain askable before any candidate can become eligible, even while optional questions are stopped', () => {
  let state = set(api.create('ready'), 'wants.pace', 'lead', { required: true });
  state = set(state, 'wants.plan', 'planned', { required: true });
  state = act(state, { kind: 'clear', field: 'wants.pace' }); state = act(state, { kind: 'clear', field: 'wants.plan' });
  state = act(state, { kind: 'stop-questions' });
  for (let i = 0; i < 2; i++) {
    const q = api.inspect(state).question; assert.ok(q); assert.equal(q.optional, false); assert.equal(q.valueBasis, 'declared-decision-value');
    state = set(state, q.field, q.field === 'wants.pace' ? 'lead' : 'planned', { target: q.target });
  }
  assert.equal(api.inspect(state).status, 'ready'); assert.equal(api.inspect(state).question, null);
  assert.equal(api.inspect(state).questionControl.usedToday, 0);
  const empty = external([]);
  const cleared = empty.adapter.record(empty.state, { kind: 'clear', field: 'availability' });
  assert.equal(empty.adapter.inspect(cleared).question.field, 'availability', 'clearing a formerly known schedule still requires a direct answer even with no public pool');
});

test('single-schedule alternatives preserve every other must-have and exactly match the ordinary read-only preview', () => {
  const state = api.create('boundary'), saved = structuredClone(state), view = api.inspect(state);
  assert.equal(view.whatIf.status, 'available'); assert.match(view.whatIf.summary, /주말·평일 저녁/);
  for (const option of view.whatIf.options) {
    assert.deepEqual(Object.keys(option.action).sort(), ['field', 'kind', 'target', 'value']);
    assert.equal(option.action.field, 'availability'); assert.equal(option.action.target, 'context');
    const preview = api.preview(state, option.action);
    assert.equal(option.result.status, preview.after.status); assert.equal(option.result.eligibleCount, preview.after.eligibleIds.length);
    assert.equal(option.result.topCandidateId, preview.after.topCandidateId);
    const after = api.applyPreview(state, preview);
    assert.equal(field(after, 'wants.pace').required, true); assert.equal(field(after, 'wants.pace').requiredValue, 'lead');
    assert.equal(field(after, 'availability').baseline.value, 'weekday'); assert.equal(field(after, 'availability').context.value, option.value);
    assert.equal(api.inspect(after).candidates.find(c => c.id === 'candidate-2').status, 'excluded');
    assert.equal(api.inspect(after).selection, null);
  }
  assert.deepEqual(state, saved); assert.equal(view.whatIf.options.find(o => o.value === 'weekend').result.eligibleCount, 2);
});

test('a current schedule override and the earlier of field and context deadlines are preserved by what-if and actual preview', () => {
  for (const until of ['2026-10-07T00:00:00.000Z', '2026-10-09T00:00:00.000Z']) {
    const expiresAt = '2026-10-08T00:00:00.000Z';
    let state = act(api.create('ready'), { kind: 'start-context', expiresAt });
    state = set(state, 'availability', 'weekday', { target: 'context', until });
    for (const option of api.inspect(state).whatIf.options) {
      assert.equal(option.action.until, until < expiresAt ? until : expiresAt);
      const preview = api.preview(state, option.action);
      assert.equal(option.result.status, preview.after.status); assert.equal(option.result.eligibleCount, preview.after.eligibleIds.length);
      const after = api.applyPreview(state, preview); assert.equal(field(after, 'availability').baseline.value, 'weekend');
      assert.equal(field(after, 'availability').context.provenance.until, option.action.until);
      assert.throws(() => api.applyPreview(state, preview, { at: option.action.until }), /expired|stale|closed/);
    }
  }
  const baselineUntil = '2026-10-07T00:00:00.000Z', contextUntil = '2026-10-09T00:00:00.000Z';
  let state = set(api.create('ready'), 'availability', 'weekend', { until: baselineUntil });
  state = set(state, 'availability', 'weekday', { target: 'context', until: contextUntil });
  const view = api.inspect(state, { at: baselineUntil });
  assert.equal(view.fields.find(f => f.id === 'availability').baseline.state, 'expired');
  assert.equal(view.whatIf.status, 'available', 'a separately explicit, live current schedule does not need an expired baseline schedule');
  const alternative = view.whatIf.options.find(o => o.value === 'weekend');
  const preview = api.preview(state, alternative.action, { at: baselineUntil });
  assert.equal(alternative.result.eligibleCount, preview.after.eligibleIds.length);
  assert.equal(alternative.action.until, contextUntil);
});

test('no-change alternatives are honest and cannot remove reciprocal must-haves, skips or period hiding', () => {
  let { adapter, state } = external([person('a', { 'wants.pace': 'lead' }, ['wants.pace'])]);
  state = adapter.record(state, { kind: 'set', field: 'self.pace', value: 'listen' });
  const alternatives = adapter.inspect(state).whatIf.options;
  assert.equal(alternatives.length, 2); assert.ok(alternatives.every(o => !o.changesResult && o.result.eligibleCount === 0 && /같아요/.test(o.summary)));
  state = adapter.record(state, { kind: 'hide-candidate', candidateId: 'a', days: 7 });
  assert.equal(adapter.inspect(state).whatIf.reason, 'candidates-hidden-or-skipped'); assert.deepEqual(adapter.inspect(state).whatIf.options, []);
  state = adapter.record(state, { kind: 'unhide-candidate', candidateId: 'a' });
  state = adapter.record(state, { kind: 'feedback', candidateId: 'a', reason: 'unknown', decision: 'skip-current' });
  assert.equal(adapter.inspect(state).whatIf.reason, 'candidates-hidden-or-skipped');
});

test('what-if distinguishes unknown prerequisites, empty public pool and missing public schedules without identity leakage', () => {
  assert.equal(api.inspect(api.create()).whatIf.reason, 'consent-required');
  let state = set(api.create(), 'consent', true); assert.equal(api.inspect(state).whatIf.reason, 'own-schedule-unknown');
  state = set(api.create('boundary'), 'wants.plan', 'planned', { required: true }); state = act(state, { kind: 'clear', field: 'wants.plan' });
  assert.equal(api.inspect(state).whatIf.reason, 'required-answer-unknown');
  for (const [pool, reason] of [[[], 'public-pool-empty'], [[{ id: 'unknown', label: 'unknown', values: { consent: true }, required: [] }], 'public-schedule-unknown'],
    [[person('private', { consent: false })], 'public-pool-empty'], [[person('other', { 'wants.pace': 'lead' }, ['wants.pace'])], 'reciprocal-answer-unknown']]) {
    const { adapter, state } = external(pool), view = adapter.inspect(state).whatIf;
    assert.equal(view.reason, reason); assert.deepEqual(view.options, []); assert.ok(!JSON.stringify(view).includes('private'));
  }
});

test('previewing one exact field undo preserves other edits, current requirements and selection invalidation', () => {
  let state = set(api.create('ready'), 'wants.contact', 'daily', { required: true });
  state = set(state, 'wants.contact', 'few-days'); const changeId = state.events.at(-1).id;
  state = set(state, 'wants.plan', 'any');
  const before = structuredClone(state), preview = api.preview(state, { kind: 'undo-field', field: 'wants.contact', changeId });
  assert.deepEqual(state, before);
  const after = api.applyPreview(state, preview);
  assert.equal(field(after, 'wants.contact').value, 'daily'); assert.equal(field(after, 'wants.contact').required, true);
  assert.equal(field(after, 'wants.plan').value, 'any'); assert.equal(api.inspect(after).selection, null);
  assert.throws(() => api.preview(after, preview.action), /latest/);
  const newer = set(state, 'wants.contact', 'flexible'); assert.throws(() => api.applyPreview(newer, preview), /stale/);
});

test('an inactive answer expiring after an undo preview cannot be silently replaced by missing at apply', () => {
  const until = '2026-10-07T00:00:00.000Z';
  let state = set(api.create('ready'), 'wants.contact', 'daily', { until });
  state = set(state, 'wants.contact', 'few-days'); const changeId = state.events.at(-1).id;
  const action = { kind: 'undo-field', field: 'wants.contact', changeId }, preview = api.preview(state, action);
  assert.throws(() => api.applyPreview(state, preview, { at: until }), /prior answer.*expired/);
  const fresh = api.preview(state, action, { at: until }), after = api.applyPreview(state, fresh, { at: until });
  assert.equal(field(after, 'wants.contact').state, 'unknown');
});

test('priority undo restores only its latest source layer and never revives a selection or an ended context override', () => {
  let state = act(api.create('ready'), { kind: 'priorities', fields: ['wants.pace'], target: 'baseline' });
  state = act(state, { kind: 'priorities', fields: ['wants.contact'], target: 'baseline' }); const changeId = state.events.at(-1).id;
  state = set(state, 'wants.plan', 'any'); state = act(state, { kind: 'select', candidateId: 'candidate-1' });
  const saved = structuredClone(state), preview = api.preview(state, { kind: 'undo-priorities', changeId });
  assert.deepEqual(state, saved); assert.equal(preview.selectionWillClear, true);
  const after = api.applyPreview(state, preview);
  assert.deepEqual(api.inspect(after).priorities.effective, ['wants.pace']); assert.equal(field(after, 'wants.plan').value, 'any');
  assert.equal(api.inspect(after).selection, null); assert.equal(api.inspect(after).priorityChanges.find(c => c.id === changeId).canUndo, false);
  assert.throws(() => api.preview(after, preview.action), /latest/);
  state = act(after, { kind: 'priorities', fields: [], target: 'context' }); const temporary = state.events.at(-1).id;
  const cleared = api.applyPreview(state, api.preview(state, { kind: 'undo-priorities', changeId: temporary }));
  assert.equal(api.inspect(cleared).priorities.context, null); assert.deepEqual(api.inspect(cleared).priorities.effective, ['wants.pace']);
  const next = act(state, { kind: 'start-context' }); assert.throws(() => api.preview(next, { kind: 'undo-priorities', changeId: temporary }), /latest/);
});
