import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { createDiscoveryAdapter } from '../experiences/atlas-lab/discovery.mjs';
import { getDiscoveryGuidance } from '../experiences/atlas-lab/discovery-guidance.mjs';
const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
const set = (state, field, value, extra = {}) => api.record(state, { kind: 'set', field, value, ...extra });
const hide = (state, candidateId = 'candidate-1', days = 7, extra = {}) => api.record(state, { kind: 'hide-candidate', candidateId, days, ...extra });
const candidate = (view, id = 'candidate-1') => view.candidates.find(item => item.id === id);
const shift = (at, ms) => new Date(Date.parse(at) + ms).toISOString();
const person = (id, patch = {}) => ({ id, label: `공개 ${id}`, values: { consent: true, availability: 'weekend', 'self.pace': 'lead', ...patch }, required: [] });
const external = (candidates, ownerId = 'me') => createDiscoveryAdapter({ Domain, Ask, Personalization, synthetic: false, ownerId, contextId: 'repeat', candidates });
function ready(adapter) { let state = adapter.create(); for (const [field, value] of Object.entries({ consent: true, availability: 'weekend', 'wants.pace': 'lead' })) state = adapter.record(state, { kind: 'set', field, value }); return state; }

test('7-day hiding retains its original deadline across contexts and expires exactly at equality', () => {
  let state = api.record(api.create('ready'), { kind: 'select', candidateId: 'candidate-1' });
  const before = api.inspect(state).fields;
  state = hide(state); const first = api.inspect(state), until = first.snoozedCandidates[0].until;
  assert.equal(Date.parse(until) - Date.parse(state.events.at(-1).at), 7 * 86400000);
  assert.equal(candidate(first).reasonCode, 'snoozed'); assert.equal(candidate(first).status, 'excluded');
  assert.deepEqual(first.fields, before); assert.equal(first.selection, null); assert.equal(api.handoff(state), null);
  state = api.record(state, { kind: 'start-context' });
  assert.equal(api.inspect(state).snoozedCandidates[0].until, until);
  assert.equal(candidate(api.inspect(state, { at: shift(until, -1) })).status, 'excluded');
  const expired = api.inspect(state, { at: until });
  assert.deepEqual(expired.snoozedCandidates, []); assert.equal(candidate(expired).status, 'eligible'); assert.equal(expired.selection, null);
});

test('30-day hiding and direct withdrawal restore only current eligibility, never a selected or accepted person', () => {
  let state = hide(api.create('ready'), 'candidate-1', 30);
  assert.equal(Date.parse(api.inspect(state).snoozedCandidates[0].until) - Date.parse(state.events.at(-1).at), 30 * 86400000);
  state = set(state, 'wants.pace', 'listen', { required: true });
  state = api.record(state, { kind: 'unhide-candidate', candidateId: 'candidate-1' });
  const view = api.inspect(state);
  assert.deepEqual(view.snoozedCandidates, []); assert.equal(candidate(view).status, 'excluded'); assert.equal(candidate(view).reasonCode, undefined);
  assert.equal(view.fields.find(field => field.id === 'wants.pace').required, true); assert.equal(view.selection, null);
  assert.throws(() => api.record(state, { kind: 'select', candidateId: 'candidate-1' }), /eligible/);
});

test('expiry does not override a later hard answer or current-only skip', () => {
  let state = hide(api.create('ready')); const until = api.inspect(state).snoozedCandidates[0].until;
  state = api.record(state, { kind: 'feedback', candidateId: 'candidate-1', reason: 'no-attraction', decision: 'skip-current' });
  assert.equal(candidate(api.inspect(state, { at: until })).status, 'excluded');
  state = api.record(state, { kind: 'start-context', at: until });
  assert.equal(candidate(api.inspect(state)).status, 'eligible');
  state = set(state, 'wants.pace', 'listen', { required: true });
  assert.equal(candidate(api.inspect(state)).status, 'excluded');
});

test('hiding never turns a no-attraction reason into a general preference and does not expose nonconsenting identities', () => {
  const original = api.create('ready'); let state = api.record(original, { kind: 'feedback', candidateId: 'candidate-1', reason: 'no-attraction', decision: 'record-only' });
  state = hide(state); assert.deepEqual(api.inspect(state).fields, api.inspect(original).fields);
  for (const days of [0, 1, 7.5, 31, '7', Infinity]) assert.throws(() => hide(original, 'candidate-1', days), /period/);
  assert.throws(() => hide(original, 'hidden-no-consent'), /authorized/);
  assert.throws(() => hide(set(original, 'consent', false)), /authorized/);
  assert.throws(() => api.record(original, { kind: 'unhide-candidate', candidateId: 'candidate-1' }), /no candidate/);
});

test('removing disclosure redacts the hidden person but keeps the original private deadline if that same authorized identity returns', () => {
  const pool = [person('a'), person('b')], first = external(pool); let state = ready(first);
  state = first.record(state, { kind: 'hide-candidate', candidateId: 'a', days: 7 }); const until = first.inspect(state).snoozedCandidates[0].until;
  for (const changed of [external([pool[1]]), external([{ ...pool[0], values: { ...pool[0].values, consent: false } }, pool[1]])]) {
    const view = changed.inspect(state); assert.deepEqual(view.snoozedCandidates, []); assert.ok(!JSON.stringify(view).includes('공개 a'));
    assert.throws(() => changed.record(state, { kind: 'unhide-candidate', candidateId: 'a' }), /authorized/);
  }
  const returned = external(pool); assert.equal(returned.inspect(state).snoozedCandidates[0].until, until);
  assert.equal(candidate(returned.inspect(state), 'a').status, 'excluded');
  assert.equal(candidate(returned.inspect(state, { at: until }), 'a').status, 'eligible');
  assert.throws(() => external(pool, 'other').inspect(state), /invalid state/);
});

test('hidden lists disappear with discovery consent, stay private across reenabling, and cannot be used to restore a selection', () => {
  let state = hide(api.create('ready')); const until = api.inspect(state).snoozedCandidates[0].until;
  state = set(state, 'consent', false); assert.deepEqual(api.inspect(state).snoozedCandidates, []);
  state = set(state, 'consent', true); assert.equal(api.inspect(state).snoozedCandidates[0].until, until); assert.equal(api.inspect(state).selection, null);
  assert.throws(() => api.record(state, { kind: 'select', candidateId: 'candidate-1' }), /eligible/);
  assert.throws(() => api.record(state, { kind: 'expose', candidateIds: ['candidate-1'] }), /eligible/);
});

test('a hidden person cannot keep requiring optional answers on their behalf', () => {
  const adapter = external([{ ...person('a', { 'wants.notice': 'advance' }), required: ['wants.notice'] }, person('b')]);
  let state = ready(adapter); assert.equal(adapter.inspect(state).question.field, 'self.notice'); assert.equal(adapter.inspect(state).question.optional, false);
  state = adapter.record(state, { kind: 'hide-candidate', candidateId: 'a', days: 7 });
  assert.notEqual(adapter.inspect(state).question?.field, 'self.notice');
  state = adapter.record(state, { kind: 'skip', field: 'self.notice' });
  state = adapter.record(state, { kind: 'unhide-candidate', candidateId: 'a' });
  assert.equal(candidate(adapter.inspect(state), 'a').status, 'pending', 'skipping cannot invent the counterpart must-have answer');
  assert.equal(adapter.inspect(state).question.field, 'self.notice'); assert.equal(adapter.inspect(state).question.optional, false);
});

test('a shown comparison stays unchanged across a new context when declared answers and the public pool did not change', () => {
  let state = api.create('ready'); assert.equal(api.inspect(state).repetition.status, 'not-shown');
  state = api.record(state, { kind: 'expose', candidateIds: ['candidate-1'] });
  const at = state.events.at(-1).at;
  assert.match(state.events.at(-1).shownKey, /^[a-f0-9]{16}$/); assert.equal(api.inspect(state).repetition.status, 'unchanged');
  state = api.record(state, { kind: 'start-context' });
  assert.equal(api.inspect(state).repetition.status, 'unchanged'); assert.equal(api.inspect(state).repetition.lastShownAt, at);
  assert.ok(!JSON.stringify(api.inspect(state).repetition).includes('shownKey'));
  state = set(state, 'wants.contact', 'daily'); assert.equal(api.inspect(state).repetition.status, 'changed');
});

test('the historical pool fingerprint detects newly public information rather than replaying old exposure against today', () => {
  const pool = [person('a')], first = external(pool); let state = ready(first);
  state = first.record(state, { kind: 'expose', candidateIds: ['a'] });
  assert.equal(first.inspect(state).repetition.status, 'unchanged');
  assert.equal(external([...pool, person('b')]).inspect(state).repetition.status, 'changed');
  assert.equal(external([person('a', { 'self.contact': 'daily' })]).inspect(state).repetition.status, 'changed');
  assert.equal(external([]).inspect(state).repetition.status, 'changed');
  assert.equal(first.inspect(state).repetition.status, 'unchanged', 'read-only projections do not rewrite the shown basis');
});

test('rotating equally ranked people is not misreported as new conditions or a better result', () => {
  const adapter = external([person('a'), person('b')]); let state = ready(adapter);
  assert.deepEqual(adapter.inspect(state).topTierIds, ['a', 'b']);
  state = adapter.record(state, { kind: 'expose', candidateIds: ['a'] });
  const view = adapter.inspect(state); assert.equal(view.topCandidateId, 'b'); assert.equal(view.repetition.status, 'unchanged');
});

test('legacy exposures remain readable without inventing a stored historical pool and caller-supplied fingerprints are rejected', () => {
  let state = api.record(api.create('ready'), { kind: 'expose', candidateIds: ['candidate-1'] });
  const legacy = structuredClone(state); delete legacy.events.at(-1).shownKey;
  assert.equal(api.inspect(legacy).repetition.status, 'not-shown');
  assert.throws(() => api.record(state, { kind: 'expose', candidateIds: ['candidate-1'], shownKey: '0000000000000000' }), /invalid action/);
  state = set(state, 'consent', false); assert.equal(api.inspect(state).repetition.status, 'not-shown');
  state = set(state, 'consent', true); assert.equal(api.inspect(state).repetition.status, 'not-shown');
});

test('explicitly viewing an empty result records the comparison without inventing candidate exposures', () => {
  const adapter = external([]); let state = ready(adapter);
  state = adapter.record(state, { kind: 'expose', candidateIds: [] });
  const view = adapter.inspect(state); assert.equal(view.repetition.status, 'unchanged'); assert.deepEqual(view.exposure, []);
  state = adapter.record(state, { kind: 'start-context' }); assert.equal(adapter.inspect(state).repetition.status, 'unchanged');
  const withCandidate = external([person('a')]); assert.equal(withCandidate.inspect(state).repetition.status, 'changed');
  assert.equal(candidate(withCandidate.inspect(state), 'a').status, 'eligible');
  assert.throws(() => withCandidate.record(state, { kind: 'expose', candidateIds: [] }), /eligible/);
});

test('no-candidate guidance respects period hiding instead of offering a context reset as if it removed it', () => {
  const adapter = external([person('a')]); let state = ready(adapter);
  state = adapter.record(state, { kind: 'hide-candidate', candidateId: 'a', days: 7 });
  const view = adapter.inspect(state), result = getDiscoveryGuidance(view);
  assert.equal(result.id, 'candidates-temporarily-hidden'); assert.deepEqual(result.action, { kind: 'navigate', page: 'profile', label: '기간 숨김 확인하기' });
  assert.match(result.body, /새 회차에서도 유지/); assert.doesNotMatch(result.body, /조건을 낮추|필수조건을 해제/);
  const clone = structuredClone(state); getDiscoveryGuidance(view); assert.deepEqual(state, clone);
});
