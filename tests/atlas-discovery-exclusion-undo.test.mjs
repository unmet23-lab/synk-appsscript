import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { createDiscoveryAdapter } from '../experiences/atlas-lab/discovery.mjs';
const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
const act = (state, action) => api.record(state, action);
const skip = (state, candidateId = 'candidate-1', extra = {}) => act(state, { kind: 'feedback', candidateId, reason: 'unknown', decision: 'skip-current', ...extra });
const row = (view, id = 'candidate-1') => view.candidates.find(candidate => candidate.id === id);
const ticket = (view, id = 'candidate-1') => view.excludedCandidates.find(candidate => candidate.id === id);
const restore = (state, candidateId = 'candidate-1', feedbackId = ticket(api.inspect(state), candidateId)?.feedbackId, extra = {}) => act(state, { kind: 'restore-candidate', candidateId, feedbackId, ...extra });
const person = (id, patch = {}) => ({ id, label: `현재 공개 ${id}`, tagline: '', values: { consent: true, availability: 'weekend', 'self.pace': 'lead', ...patch }, required: [] });
const external = (pool, ownerId = 'own-account', contextId = 'dating-account') => createDiscoveryAdapter({ Domain, Ask, Personalization, synthetic: false, candidates: pool, ownerId, contextId });
function ready(adapter) { return Object.entries({ consent: true, availability: 'weekend', 'self.pace': 'listen', 'wants.pace': 'lead' })
  .reduce((state, [field, value]) => adapter.record(state, { kind: 'set', field, value }), adapter.create()); }
const shift = (at, milliseconds) => new Date(Date.parse(at) + milliseconds).toISOString();

test('one explicit cancellation keeps the other exclusion, preferences, priorities and exposure without restoring a selection', () => {
  let state = act(api.create('ready'), { kind: 'set', field: 'wants.plan', value: 'spontaneous', target: 'context' });
  state = act(state, { kind: 'priorities', target: 'context', fields: ['wants.pace'] });
  state = act(state, { kind: 'select', candidateId: 'candidate-1' }); state = act(state, { kind: 'expose', candidateIds: ['candidate-1'] });
  state = skip(skip(state), 'candidate-3'); const before = api.inspect(state), source = ticket(before);
  assert.equal(before.selection, null); assert.equal(source.status, 'excluded');
  const untouched = structuredClone(state); assert.deepEqual(api.inspect(state), before); assert.deepEqual(state, untouched);
  state = restore(state); const after = api.inspect(state);
  assert.equal(row(after).status, 'eligible'); assert.equal(row(after, 'candidate-3').status, 'excluded');
  assert.deepEqual(after.fields, before.fields); assert.deepEqual(after.priorities, before.priorities); assert.deepEqual(after.exposure, before.exposure);
  assert.equal(after.context.id, before.context.id); assert.equal(after.selection, null); assert.equal(api.handoff(state), null);
  assert.deepEqual(after.excludedCandidates.map(item => item.id), ['candidate-3']);
  const history = after.feedback.find(item => item.id === source.feedbackId);
  assert.equal(history.decision, 'skip-current'); assert.equal(history.restoredAt, state.events.at(-1).at); assert.equal(history.restorationId, state.events.at(-1).id);
  assert.equal(state.events.at(-1).kind, 'restore-candidate'); assert.equal(after.feedback.length, before.feedback.length);
});

test('record-only feedback cannot cancel or replace a skip source', () => {
  let state = act(api.create('ready'), { kind: 'feedback', candidateId: 'candidate-1', reason: 'context', decision: 'record-only' });
  const firstNote = state.events.at(-1).id;
  assert.deepEqual(api.inspect(state).excludedCandidates, []); assert.throws(() => restore(state, 'candidate-1', firstNote), /latest current-context/);
  state = skip(state); const source = ticket(api.inspect(state));
  state = act(state, { kind: 'feedback', candidateId: 'candidate-1', reason: 'no-attraction', decision: 'record-only' });
  assert.equal(ticket(api.inspect(state)).feedbackId, source.feedbackId);
  assert.throws(() => restore(state, 'candidate-1', state.events.at(-1).id), /latest current-context/);
  state = restore(state, 'candidate-1', source.feedbackId); assert.equal(row(api.inspect(state)).status, 'eligible');
});

test('only the latest active skip ticket works and cancellation never revives an older skip', () => {
  let state = skip(api.create('ready')), first = ticket(api.inspect(state)); state = skip(state); const latest = ticket(api.inspect(state));
  assert.notEqual(first.feedbackId, latest.feedbackId); assert.throws(() => restore(state, 'candidate-1', first.feedbackId), /latest current-context/);
  state = restore(state, 'candidate-1', latest.feedbackId); assert.equal(row(api.inspect(state)).status, 'eligible');
  assert.throws(() => restore(state, 'candidate-1', latest.feedbackId), /latest current-context/);
  state = skip(state); const newest = ticket(api.inspect(state)); assert.notEqual(newest.feedbackId, latest.feedbackId);
  assert.throws(() => restore(state, 'candidate-1', latest.feedbackId), /latest current-context/);
  assert.equal(row(api.inspect(restore(state, 'candidate-1', newest.feedbackId))).status, 'eligible');
});

test('a new context, explicit closure and exact context expiry reject old tickets', () => {
  let state = skip(api.create('ready')); const source = ticket(api.inspect(state));
  for (const kind of ['start-context', 'close-context']) {
    const next = act(state, { kind }); assert.deepEqual(api.inspect(next).excludedCandidates, []);
    assert.throws(() => restore(next, 'candidate-1', source.feedbackId), /latest current-context/);
  }
  const until = shift(state.events.at(-1).at, 60000); state = act(state, { kind: 'start-context', expiresAt: until }); state = skip(state);
  const current = ticket(api.inspect(state)); assert.deepEqual(api.inspect(state, { at: until }).excludedCandidates, []);
  assert.throws(() => restore(state, 'candidate-1', current.feedbackId, { at: until }), /latest current-context/);
});

test('no discovery consent hides undo records and prevents a write', () => {
  let state = skip(api.create('ready')); const source = ticket(api.inspect(state));
  state = act(state, { kind: 'set', field: 'consent', value: false }); assert.deepEqual(api.inspect(state).excludedCandidates, []);
  const before = structuredClone(state); assert.throws(() => restore(state, 'candidate-1', source.feedbackId), /latest current-context/); assert.deepEqual(state, before);
});

test('period hiding remains independent when the current-only exclusion is cancelled', () => {
  let state = skip(api.create('ready')); state = act(state, { kind: 'hide-candidate', candidateId: 'candidate-1', days: 7 });
  const before = api.inspect(state); assert.equal(before.snoozedCandidates.length, 1);
  state = restore(state); const after = api.inspect(state); assert.deepEqual(after.snoozedCandidates, before.snoozedCandidates);
  assert.deepEqual(after.excludedCandidates, []); assert.equal(row(after).status, 'excluded'); assert.equal(row(after).reasonCode, 'snoozed');
  assert.equal(row(api.inspect(state, { at: before.snoozedCandidates[0].until })).status, 'eligible'); assert.equal(after.selection, null);
});

test('a changed hard preference remains enforced after undoing an exclusion', () => {
  let state = skip(api.create('ready')); state = act(state, { kind: 'set', field: 'wants.pace', value: 'listen', required: true });
  const before = api.inspect(state); state = restore(state); const after = api.inspect(state);
  assert.deepEqual(after.fields, before.fields); assert.deepEqual(after.excludedCandidates, []); assert.equal(row(after).status, 'excluded');
  assert.throws(() => act(state, { kind: 'select', candidateId: 'candidate-1' }), /eligible/);
});

test('new public reciprocal requirements may leave a restored candidate pending instead of inventing an answer', () => {
  const first = external([person('a')]); let state = ready(first); state = first.record(state, { kind: 'feedback', candidateId: 'a', reason: 'unknown', decision: 'skip-current' });
  const source = ticket(first.inspect(state), 'a'); const changed = external([{ ...person('a', { 'wants.notice': 'advance' }), required: ['wants.notice'] }]);
  state = changed.record(state, { kind: 'restore-candidate', candidateId: 'a', feedbackId: source.feedbackId }); const view = changed.inspect(state);
  assert.deepEqual(view.excludedCandidates, []); assert.equal(row(view, 'a').status, 'pending');
  assert.equal(view.fields.find(field => field.id === 'self.notice').value, null); assert.equal(view.question.field, 'self.notice');
  assert.throws(() => changed.record(state, { kind: 'select', candidateId: 'a' }), /eligible/);
});

test('withdrawn or unavailable public profiles disappear and a stale ticket cannot address them', () => {
  const pool = [person('a'), person('b')], first = external(pool); let state = ready(first);
  state = first.record(state, { kind: 'feedback', candidateId: 'a', reason: 'context', decision: 'skip-current' }); const source = ticket(first.inspect(state), 'a');
  for (const changed of [external([pool[1]]), external([{ ...pool[0], values: { ...pool[0].values, consent: false } }, pool[1]])]) {
    const view = changed.inspect(state); assert.deepEqual(view.excludedCandidates, []); assert.ok(!JSON.stringify(view).includes('현재 공개 a'));
    assert.throws(() => changed.record(state, { kind: 'restore-candidate', candidateId: 'a', feedbackId: source.feedbackId }), /currently authorized/);
  }
  const returned = external(pool); assert.equal(ticket(returned.inspect(state), 'a').feedbackId, source.feedbackId);
  const restored = returned.record(state, { kind: 'restore-candidate', candidateId: 'a', feedbackId: source.feedbackId }); assert.equal(row(returned.inspect(restored), 'a').status, 'eligible');
});

test('historical restoration survives a later pool withdrawal and JSON restart without revealing old profile labels', () => {
  const pool = [person('a'), person('b')], first = external(pool); let state = ready(first);
  state = first.record(state, { kind: 'feedback', candidateId: 'a', reason: 'unknown', decision: 'skip-current' });
  state = first.record(state, { kind: 'restore-candidate', candidateId: 'a', feedbackId: ticket(first.inspect(state), 'a').feedbackId });
  const persisted = JSON.parse(JSON.stringify(state)), restarted = external(pool); assert.deepEqual(restarted.inspect(persisted), first.inspect(state));
  const withdrawn = external([pool[1]]).inspect(persisted); assert.deepEqual(withdrawn.excludedCandidates, []); assert.ok(!JSON.stringify(withdrawn).includes('현재 공개 a'));
  assert.equal(row(restarted.inspect(persisted), 'a').status, 'eligible');
  assert.throws(() => restarted.record(persisted, { kind: 'restore-candidate', candidateId: 'a', feedbackId: state.events.at(-1).feedbackId }), /latest current-context/);
});

test('current public labels are projected without raw preferences or an old alias', () => {
  const first = external([person('a')]); let state = ready(first); state = first.record(state, { kind: 'feedback', candidateId: 'a', reason: 'unknown', decision: 'skip-current' });
  const current = external([{ ...person('a'), label: '현재 새 이름' }]).inspect(state), source = ticket(current, 'a');
  assert.equal(source.label, '현재 새 이름'); assert.deepEqual(Object.keys(source).sort(), ['id', 'label', 'feedbackId', 'at', 'status', 'reason'].sort());
  assert.ok(!JSON.stringify(current).includes('현재 공개 a'));
});

test('forged, malformed, foreign-candidate and injected source tickets fail without changing legacy state', () => {
  const state = skip(api.create('ready')), before = structuredClone(state), source = ticket(api.inspect(state));
  for (const feedbackId of [undefined, null, '', 'event-0', 'event-999', 1]) assert.throws(() => act(state, { kind: 'restore-candidate', candidateId: 'candidate-1', feedbackId }), /candidate exclusion|latest current-context/);
  assert.throws(() => restore(state, 'candidate-2', source.feedbackId), /latest current-context/);
  assert.throws(() => restore(state, 'candidate-1', source.feedbackId, { value: true }), /invalid or unordered/);
  assert.throws(() => restore(state, 'candidate-1', source.feedbackId, { contextId: 'foreign-context' }), /invalid action/);
  assert.deepEqual(state, before); assert.equal(state.version, 'discovery-demo-1');
  const other = external([person('a')], 'other-account'); assert.throws(() => other.inspect(ready(external([person('a')]))), /invalid state/);
});
