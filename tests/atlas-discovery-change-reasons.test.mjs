import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { createDiscoveryAdapter } from '../experiences/atlas-lab/discovery.mjs';

const cores = { Domain, Ask, Personalization }, api = createDiscoveryAdapter(cores);
const later = (at, ms) => new Date(Date.parse(at) + ms).toISOString();
const set = (state, field, value, extra = {}) => api.record(state, { kind: 'set', field, value, ...extra });
const shown = state => api.record(state, { kind: 'expose', candidateIds: [api.inspect(state).topCandidateId] });
const reasons = (state, at) => api.inspect(state, at ? { at } : {}).repetition.reasons;
const person = (id, values = {}) => ({ id, label: `공개 이름 ${id}`, tagline: '공개 소개', values: { consent: true, availability: 'weekend', 'self.pace': 'lead', ...values }, required: [] });
const external = pool => createDiscoveryAdapter({ ...cores, synthetic: false, ownerId: 'owner', contextId: 'change-reasons', candidates: pool });
function ready(adapter) { let state = adapter.create(); for (const [field, value] of Object.entries({ consent: true, availability: 'weekend', 'wants.pace': 'lead' })) state = adapter.record(state, { kind: 'set', field, value }); return state; }

test('explicit exposure stores a compact own basis; inspection is read-only and does not expose stored comparison keys', () => {
  let state = api.create('ready'); assert.deepEqual(reasons(state), []);
  state = shown(state); const original = structuredClone(state), basis = state.events.at(-1).shownBasis;
  assert.equal(basis.version, 1); assert.match(basis.poolKey, /^[a-f0-9]{16}$/);
  for (const secret of ['candidate-1', '가상 성인', 'planned']) {
    assert.equal(JSON.stringify(basis).includes(secret), false);
  }
  const result = api.inspect(state).repetition;
  assert.equal(result.status, 'unchanged'); assert.deepEqual(result.reasons, []);
  assert.equal(JSON.stringify(result).includes('poolKey'), false); assert.equal(JSON.stringify(result).includes('event-'), false);
  api.inspect(state, { at: later(state.events.at(-1).at, 10000) }); assert.deepEqual(state, original);
});

test('changed own answers and priorities are described as changed conditions without claiming ranking causality', () => {
  let state = shown(api.create('ready'));
  state = set(state, 'wants.contact', 'daily');
  assert.ok(reasons(state).some(item => item.kind === 'answers-changed' && item.field === 'wants.contact'));
  state = api.record(state, { kind: 'priorities', fields: ['wants.plan'], target: 'baseline' });
  assert.ok(reasons(state).some(item => item.kind === 'priorities-changed'));
  assert.ok(reasons(state).every(item => Object.keys(item).every(key => ['kind', 'text', 'field'].includes(key))));
  assert.doesNotMatch(JSON.stringify(reasons(state)), /때문에.*순위|호감|확률|효과/);
  state = shown(state); assert.deepEqual(reasons(state), []);
});

test('an explicit deadline ending at equality is distinguished from a manual answer change', () => {
  let state = api.create('ready'), at = later(state.events.at(-1).at, 1000), until = later(at, 10000);
  state = set(state, 'wants.pace', 'listen', { target: 'context', at, until }); state = shown(state);
  assert.deepEqual(reasons(state, later(until, -1)), []);
  const expired = reasons(state, until);
  assert.deepEqual(expired.filter(item => item.field === 'wants.pace').map(item => item.kind), ['answer-expired']);
  assert.equal(api.inspect(state, { at: until }).fields.find(item => item.id === 'wants.pace').value, 'lead');
  let changed = set(state, 'wants.pace', 'any', { target: 'context', at: later(state.events.at(-1).at, 1000) });
  assert.ok(reasons(changed, until).some(item => item.kind === 'answers-changed'));
  assert.ok(!reasons(changed, until).some(item => item.kind === 'answer-expired'), 'replaced declarations must not be attributed to their obsolete deadlines');
});

test('same-valued fallback still reports that the time-limited declaration expired, without claiming a new recommendation', () => {
  let state = api.create('ready'), at = later(state.events.at(-1).at, 1000), until = later(at, 5000);
  state = set(state, 'wants.pace', 'lead', { target: 'context', at, until }); state = shown(state);
  const result = api.inspect(state, { at: until }).repetition;
  assert.equal(result.status, 'unchanged'); assert.ok(result.reasons.some(item => item.kind === 'answer-expired'));
  assert.match(result.summary, /조건에는 변화.*비교 결과는.*같아요/);
});

test('a later explicit unknown or override is not explained by the older baseline deadline', () => {
  let state = api.create('ready'), at = later(state.events.at(-1).at, 1000), until = later(at, 10000);
  state = set(state, 'wants.pace', 'lead', { target: 'baseline', at, until }); state = shown(state);
  for (const action of [{ kind: 'mark-unknown', field: 'wants.pace' }, { kind: 'set', field: 'wants.pace', value: 'listen', target: 'context' }]) {
    const changed = api.record(state, action), result = reasons(changed, until);
    assert.ok(result.some(item => item.kind === 'answers-changed' && item.field === 'wants.pace'));
    assert.ok(!result.some(item => item.kind === 'answer-expired'), 'the manually replaced effective answer is the verified change');
  }
});

test('a new context is factual even if the comparison stayed the same; once-only loss is not misreported as a manual edit', () => {
  let state = shown(api.create('ready')); state = api.record(state, { kind: 'start-context' });
  let result = api.inspect(state).repetition;
  assert.equal(result.status, 'unchanged'); assert.deepEqual(result.reasons.map(item => item.kind), ['context-changed']);
  state = set(state, 'wants.pace', 'listen', { target: 'context' }); state = shown(state);
  state = api.record(state, { kind: 'start-context' }); result = api.inspect(state).repetition;
  assert.ok(result.reasons.some(item => item.kind === 'context-changed'));
  assert.ok(!result.reasons.some(item => item.kind === 'answers-changed' && item.field === 'wants.pace'));
});

test('public candidate changes expose only a generic verified change, never old identities or old public values', () => {
  const first = external([person('withdrawn-sensitive-id', { 'self.contact': 'daily' }), person('remaining')]);
  let state = ready(first); state = first.record(state, { kind: 'expose', candidateIds: ['withdrawn-sensitive-id'] });
  const original = structuredClone(state), result = external([person('remaining')]).inspect(state).repetition;
  assert.deepEqual(result.reasons.map(item => item.kind), ['public-candidates-changed']);
  assert.doesNotMatch(JSON.stringify(result), /withdrawn-sensitive-id|공개 이름|daily|poolKey/); assert.deepEqual(state, original);
  const added = external([person('withdrawn-sensitive-id', { 'self.contact': 'few-days' }), person('remaining')]).inspect(state).repetition;
  assert.deepEqual(added.reasons.map(item => item.kind), ['public-candidates-changed']);
});

test('hidden and skipped choices use private aggregate keys and ordinary public withdrawal is not attributed to a new skip', () => {
  let state = shown(api.create('ready'));
  state = api.record(state, { kind: 'hide-candidate', candidateId: 'candidate-1', days: 7 });
  assert.ok(reasons(state).some(item => item.kind === 'visibility-choice-changed'));
  state = shown(state); const until = api.inspect(state).snoozedCandidates[0].until;
  assert.ok(reasons(state, until).some(item => item.kind === 'visibility-choice-changed'));
  const first = external([person('removed'), person('remaining')]); let externalState = ready(first);
  externalState = first.record(externalState, { kind: 'feedback', candidateId: 'removed', reason: 'unknown', decision: 'skip-current' });
  externalState = first.record(externalState, { kind: 'expose', candidateIds: ['remaining'] });
  const result = external([person('remaining')]).inspect(externalState).repetition;
  assert.deepEqual(result.reasons.map(item => item.kind), ['public-candidates-changed']);
});

test('legacy shownKey-only exposure never infers historical reasons; consent withdrawal clears comparison before reenabling', () => {
  let state = shown(api.create('ready')); delete state.events.at(-1).shownBasis;
  state = set(state, 'wants.contact', 'daily');
  assert.equal(api.inspect(state).repetition.status, 'changed'); assert.deepEqual(reasons(state), []);
  state = shown(state); state = set(state, 'consent', false);
  assert.equal(api.inspect(state).repetition.status, 'not-shown'); assert.deepEqual(reasons(state), []);
  state = set(state, 'consent', true); assert.deepEqual(reasons(state), []); assert.equal(api.inspect(state).repetition.status, 'not-shown');
});

test('callers cannot supply a historical explanation basis and malformed own evidence cannot be replayed', () => {
  const state = shown(api.create('ready'));
  assert.throws(() => api.record(state, { kind: 'expose', candidateIds: ['candidate-1'], shownBasis: state.events.at(-1).shownBasis }), /invalid action/);
  for (const mutate of [basis => { basis.fields[0].key = '0'.repeat(16); }, basis => { basis.contextId = 'invented'; }, basis => { basis.poolKey = 'candidate-name'; }, basis => { basis.leakedName = 'old'; }]) {
    const invalid = structuredClone(state); mutate(invalid.events.at(-1).shownBasis); assert.throws(() => api.inspect(invalid), /explanation basis/);
  }
});

test('tie rotation and merely reading a new public pool do not rewrite the old basis', () => {
  const first = external([person('a'), person('b')]); let state = ready(first);
  state = first.record(state, { kind: 'expose', candidateIds: ['a'] });
  assert.equal(first.inspect(state).topCandidateId, 'b'); assert.deepEqual(first.inspect(state).repetition.reasons, []);
  assert.equal(external([person('b'), person('a')]).inspect(state).repetition.status, 'unchanged');
  const original = structuredClone(state); external([]).inspect(state); assert.deepEqual(state, original);
  assert.deepEqual(first.inspect(state).repetition.reasons, []);
});
