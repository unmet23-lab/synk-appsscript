import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { createDiscoveryAdapter, DISCOVERY_FIELDS } from '../experiences/atlas-lab/discovery.mjs';

const at = '2026-10-06T12:00:00.000Z';
const basic = { consent: true, availability: 'weekend', 'self.pace': 'lead', 'self.plan': 'planned' };
const candidate = (id, values = {}, extra = {}) => ({ id, label: id, values: { ...basic, ...values }, required: [], ...extra });
const adapter = (candidates = [candidate('peer')]) => createDiscoveryAdapter({ Domain, Ask, Personalization,
  synthetic: false, ownerId: 'owner', contextId: 'fit-check', candidates });
const set = (api, state, field, value, extra = {}) => api.record(state, { kind: 'set', field, value, ...extra });
const ready = api => set(api, set(api, api.create('first', { at }), 'consent', true), 'availability', 'weekend');
const inspect = (api, state, time) => api.inspect(state, time ? { at: time } : {});
const field = (api, state, id, time) => inspect(api, state, time).fields.find(item => item.id === id);
const row = (api, state, id = 'peer', time) => inspect(api, state, time).candidates.find(item => item.id === id);
// This fixture is a saved version-one log, not a newly offered legacy choice.
const legacy = (state, field, value, required = false) => ({ ...structuredClone(state), events: [...structuredClone(state.events),
  { id: `event-${state.events.length + 1}`, at: new Date(Date.parse(state.events.at(-1)?.at || at) + 1000).toISOString(), kind: 'set', field, value, required }] });

test('relationship goal and speed are independent explicit axes and are separate from conversation pace', () => {
  const api = adapter();
  let state = ready(api);
  for (const id of ['self.relationshipGoal', 'wants.relationshipGoal', 'self.relationshipSpeed', 'wants.relationshipSpeed'])
    assert.equal(field(api, state, id).value, null);
  state = set(api, state, 'self.relationshipGoal', 'committed');
  state = set(api, state, 'self.relationshipSpeed', 'gradual');
  assert.equal(field(api, state, 'self.relationshipGoal').value, 'committed');
  assert.equal(field(api, state, 'self.relationshipSpeed').value, 'gradual');
  assert.equal(field(api, state, 'self.pace').value, null);
  assert.equal(field(api, state, 'self.purpose').value, null);
  assert.equal(field(api, state, 'wants.relationshipGoal').value, null);
  assert.equal(field(api, state, 'wants.relationshipSpeed').value, null);
});

test('explicit goals and speeds change the actual comparison and priority weighs the selected axis', () => {
  const api = adapter([
    candidate('slow-serious', { 'self.relationshipGoal': 'committed', 'self.relationshipSpeed': 'gradual' }),
    candidate('fast-social', { 'self.relationshipGoal': 'exploring', 'self.relationshipSpeed': 'steady' }),
  ]);
  let state = set(api, set(api, ready(api), 'wants.relationshipGoal', 'committed'), 'wants.relationshipSpeed', 'steady');
  assert.equal(inspect(api, state).topTierIds.length, 2);
  state = api.applyPreview(state, api.preview(state, { kind: 'priorities', fields: ['wants.relationshipGoal'], target: 'baseline' }));
  assert.equal(inspect(api, state).topCandidateId, 'slow-serious');
  state = api.applyPreview(state, api.preview(state, { kind: 'priorities', fields: ['wants.relationshipSpeed'], target: 'context' }));
  assert.equal(inspect(api, state).topCandidateId, 'fast-social');
  assert.equal(field(api, state, 'wants.relationshipGoal').value, 'committed');
});

test('independent mandatory goal and speed preserve mismatch, unknown and reciprocal own-answer confirmation', () => {
  const api = adapter([
    candidate('matching', { 'self.relationshipGoal': 'committed', 'self.relationshipSpeed': 'gradual' }),
    candidate('wrong-goal', { 'self.relationshipGoal': 'exploring', 'self.relationshipSpeed': 'gradual' }),
    candidate('unknown-speed', { 'self.relationshipGoal': 'committed' }),
  ]);
  let state = set(api, set(api, ready(api), 'wants.relationshipGoal', 'committed', { required: true }), 'wants.relationshipSpeed', 'gradual', { required: true });
  assert.equal(row(api, state, 'matching').status, 'eligible');
  assert.equal(row(api, state, 'wrong-goal').status, 'excluded');
  assert.equal(row(api, state, 'unknown-speed').status, 'pending');
  state = set(api, state, 'wants.relationshipGoal', 'open', { target: 'context' });
  assert.equal(row(api, state, 'wrong-goal').status, 'excluded', 'context choices cannot replace the hard baseline');
  const reciprocal = adapter([candidate('peer', { 'wants.relationshipSpeed': 'gradual' }, { required: ['wants.relationshipSpeed'] })]);
  const awaiting = ready(reciprocal);
  assert.equal(row(reciprocal, awaiting).status, 'pending');
  assert.equal(inspect(reciprocal, awaiting).question.field, 'self.relationshipSpeed');
  assert.equal(row(reciprocal, set(reciprocal, awaiting, 'self.relationshipSpeed', 'gradual')).status, 'eligible');
});

test('speed scope, expiry, preview and undo do not rewrite goal, public facts or old version-one events', () => {
  const api = adapter([candidate('peer', { 'self.relationshipGoal': 'committed', 'self.relationshipSpeed': 'gradual' })]);
  let state = set(api, set(api, ready(api), 'wants.relationshipGoal', 'committed'), 'wants.relationshipSpeed', 'steady');
  const before = structuredClone(state), deadline = '2026-10-06T13:00:00.000Z';
  const preview = api.preview(state, { kind: 'set', field: 'wants.relationshipSpeed', value: 'gradual', target: 'context', until: deadline });
  assert.deepEqual(state, before);
  state = api.applyPreview(state, preview);
  assert.equal(field(api, state, 'wants.relationshipGoal').value, 'committed');
  assert.equal(field(api, state, 'wants.relationshipSpeed').source, 'context');
  assert.equal(field(api, state, 'wants.relationshipSpeed', deadline).value, 'steady');
  assert.equal(field(api, state, 'wants.relationshipGoal', deadline).value, 'committed');
  state = api.applyPreview(state, api.preview(state, { kind: 'undo-field', field: 'wants.relationshipSpeed', changeId: state.events.at(-1).id }));
  assert.equal(field(api, state, 'wants.relationshipSpeed').value, 'steady');
  assert.deepEqual(state.events.slice(0, before.events.length), before.events);
  assert.equal(state.version, 'discovery-demo-1');
});

test('all three legacy combined answers remain history and never fill either new axis or ranking', () => {
  const api = adapter([candidate('peer', { 'self.relationshipGoal': 'committed', 'self.relationshipSpeed': 'gradual' })]);
  const baseline = ready(api), before = inspect(api, baseline).candidates;
  for (const value of ['gradual', 'committed', 'open']) {
    const state = legacy(legacy(baseline, 'self.purpose', value), 'wants.purpose', value);
    for (const id of ['self.relationshipGoal', 'self.relationshipSpeed', 'wants.relationshipGoal', 'wants.relationshipSpeed'])
      assert.equal(field(api, state, id).value, null);
    assert.equal(field(api, state, 'self.purpose').legacy, true);
    assert.equal(field(api, state, 'wants.purpose').value, value);
    assert.deepEqual(inspect(api, state).candidates, before);
    assert.equal(inspect(api, state).legacyRelationship.status, 'needs-confirmation');
    assert.ok(!inspect(api, state).question?.field.endsWith('.purpose'));
  }
});

test('a legacy must-have remains pending until direct retirement, even after both new answers are supplied', () => {
  const api = adapter([candidate('peer', { 'self.relationshipGoal': 'committed', 'self.relationshipSpeed': 'gradual' })]);
  let state = legacy(ready(api), 'wants.purpose', 'committed', true);
  assert.equal(row(api, state).status, 'pending');
  state = set(api, set(api, state, 'wants.relationshipGoal', 'committed', { required: true }), 'wants.relationshipSpeed', 'gradual', { required: true });
  assert.equal(row(api, state).status, 'pending');
  assert.equal(inspect(api, state).legacyRelationship.required, true);
  assert.equal(inspect(api, state).question, null);
  const snapshot = structuredClone(state);
  const proposed = api.preview(state, { kind: 'set', field: 'wants.purpose', value: 'committed', required: false, target: 'baseline' });
  assert.deepEqual(state, snapshot);
  state = api.applyPreview(state, proposed);
  assert.equal(row(api, state).status, 'eligible');
  assert.equal(field(api, state, 'wants.purpose').value, 'committed');
  assert.equal(field(api, state, 'wants.purpose').required, false);
});

test('current actions cannot create a combined legacy answer or change its value while retiring the old requirement', () => {
  const api = adapter(), state = ready(api);
  assert.throws(() => set(api, state, 'self.purpose', 'committed'), /history-only/);
  assert.throws(() => set(api, state, 'wants.purpose', 'committed', { required: true }), /history-only/);
  const existing = legacy(state, 'wants.purpose', 'committed', true);
  assert.throws(() => api.preview(existing, { kind: 'set', field: 'wants.purpose', value: 'open', required: false, target: 'baseline' }), /history-only/);
  assert.throws(() => api.preview(existing, { kind: 'set', field: 'wants.purpose', value: 'committed', required: false, target: 'baseline', until: '2026-10-06T14:00:00.000Z' }), /history-only/);
  assert.throws(() => api.preview(existing, { kind: 'priorities', fields: ['wants.purpose'], target: 'baseline' }), /at most two/);
});

test('a historical version-one selection under a combined hard answer does not revive current recommendation rights', () => {
  const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
  const old = legacy(api.create('ready'), 'wants.purpose', 'committed', true);
  const saved = { ...structuredClone(old), events: [...structuredClone(old.events), { id: `event-${old.events.length + 1}`,
    at: new Date(Date.parse(old.events.at(-1).at) + 1000).toISOString(), kind: 'select', candidateId: 'candidate-2' }] };
  assert.equal(api.inspect(saved).selection, null);
  assert.equal(api.handoff(saved), null);
  assert.throws(() => api.record(saved, { kind: 'select', candidateId: 'candidate-2' }), /not currently eligible/);
});

test('expired or withdrawn old hard answers can be explicitly retired without setting a new legacy value', () => {
  const api = adapter();
  const old = legacy(ready(api), 'wants.purpose', 'committed', true);
  old.events.at(-1).until = '2026-10-06T13:00:00.000Z';
  const time = '2026-10-06T13:00:00.000Z';
  assert.equal(field(api, old, 'wants.purpose', time).requiredValue, null);
  assert.equal(row(api, old, 'peer', time).status, 'pending');
  const proposal = api.preview(old, { kind: 'clear', field: 'wants.purpose', target: 'baseline', required: false }, { at: time });
  const state = api.applyPreview(old, proposal, { at: time });
  assert.equal(field(api, state, 'wants.purpose', time).value, null);
  assert.equal(field(api, state, 'wants.purpose', time).required, false);
  assert.equal(row(api, state, 'peer', time).status, 'eligible');
  assert.deepEqual(state.events.slice(0, old.events.length), old.events);
  assert.throws(() => api.preview(state, { kind: 'clear', field: 'wants.relationshipGoal', target: 'baseline', required: false }), /legacy baseline retirement/);
});

test('version-one displayed bases with the historical fourteen fields replay while new records bind all fields', () => {
  const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
  let state = api.record(api.create('ready'), { kind: 'expose', candidateIds: ['candidate-1'] });
  const historic = structuredClone(state);
  historic.events.at(-1).shownBasis.fields = historic.events.at(-1).shownBasis.fields.filter(item => !item.id.includes('relationship') && item.id !== 'self.meetingRegions');
  assert.equal(historic.events.at(-1).shownBasis.fields.length, 14);
  assert.doesNotThrow(() => api.inspect(historic));
  assert.equal(state.events.at(-1).shownBasis.fields.length, DISCOVERY_FIELDS.length);
  historic.events.at(-1).shownBasis.fields.pop();
  assert.throws(() => api.inspect(historic), /explanation basis/);
});

test('both missing meeting areas retain legacy comparison; a public declared area requires my direct answer', () => {
  const api = adapter(), state = ready(api);
  assert.equal(row(api, state).status, 'eligible');
  assert.equal(inspect(api, state).meetingRegions.status, 'inactive');
  const declared = adapter([candidate('peer', { 'self.meetingRegions': ['busan'] })]), current = ready(declared);
  assert.equal(row(declared, current).status, 'pending');
  assert.equal(inspect(declared, current).meetingRegions.needsOwnAnswer, true);
  const detail = row(declared, current).reasonDetails.find(item => item.field === 'self.meetingRegions');
  assert.equal(detail.value, null); assert.equal(detail.comparison, 'unknown');
  assert.equal(detail.owner, 'self'); assert.equal(detail.required, true);
});

test('only exact voluntary area intersection admits a recommendation; broad text does not fill IDs', () => {
  const api = adapter([
    candidate('overlap', { 'self.meetingRegions': ['busan', 'seoul-southwest'] }, { region: '공개 소개 지역' }),
    candidate('disjoint', { 'self.meetingRegions': ['seoul-southeast'] }, { region: '서울' }),
    candidate('unknown', {}, { region: '서울 서남권 근처' }),
  ]);
  const state = set(api, ready(api), 'self.meetingRegions', ['busan', 'seoul-southwest']);
  assert.equal(row(api, state, 'overlap').status, 'eligible');
  assert.equal(row(api, state, 'disjoint').status, 'excluded');
  assert.equal(row(api, state, 'unknown').status, 'pending');
  assert.equal(row(api, state, 'overlap').region, '공개 소개 지역');
  assert.match(row(api, state, 'unknown').unknown.join(' '), /공개 지역.*미확인/);
  assert.doesNotMatch(JSON.stringify(inspect(api, state)), /GPS|kilometers|latitude|longitude|distanceKm/);
});

test('regions normalize and copy only validated sets and cannot be supplied as a partner private wish', () => {
  const api = adapter([candidate('peer', { 'self.meetingRegions': ['busan', 'seoul-center'] })]);
  const source = ['busan', 'seoul-center'], state = set(api, ready(api), 'self.meetingRegions', source);
  source.pop();
  assert.deepEqual(field(api, state, 'self.meetingRegions').value, ['seoul-center', 'busan']);
  for (const value of [[], ['busan', 'busan'], ['everywhere'], 'busan', null])
    assert.throws(() => set(api, state, 'self.meetingRegions', value), /Meeting regions/);
  assert.throws(() => adapter([candidate('peer', { 'wants.meetingRegions': ['busan'] })]), /public candidate/);
  assert.throws(() => adapter([candidate('peer', {}, { privateRegions: ['busan'] })]), /public candidate/);
  assert.throws(() => adapter([candidate('peer', {}, { required: ['self.meetingRegions'] })]), /public candidate/);
});

test('private meeting area baseline/context masks, expiry and undo preserve explicit lifetime without backfill', () => {
  const api = adapter([candidate('peer', { 'self.meetingRegions': ['busan'] })]);
  let state = set(api, ready(api), 'self.meetingRegions', ['busan']);
  const deadline = '2026-10-06T13:00:00.000Z';
  state = api.applyPreview(state, api.preview(state, { kind: 'set', field: 'self.meetingRegions', value: ['seoul-center'], target: 'context', until: deadline }));
  assert.equal(row(api, state).status, 'excluded');
  assert.equal(field(api, state, 'self.meetingRegions').source, 'context');
  assert.equal(row(api, state, 'peer', deadline).status, 'eligible');
  state = api.applyPreview(state, api.preview(state, { kind: 'undo-field', field: 'self.meetingRegions', changeId: state.events.at(-1).id }));
  assert.deepEqual(field(api, state, 'self.meetingRegions').value, ['busan']);
  state = api.record(state, { kind: 'mark-unknown', field: 'self.meetingRegions' });
  assert.equal(field(api, state, 'self.meetingRegions').value, null);
  assert.equal(row(api, state).status, 'pending');
  state = api.record(state, { kind: 'start-context' });
  assert.deepEqual(field(api, state, 'self.meetingRegions').value, ['busan']);
  state = set(api, state, 'self.meetingRegions', ['seoul-center'], { until: deadline });
  assert.equal(field(api, state, 'self.meetingRegions', deadline).value, null);
  assert.equal(row(api, state, 'peer', deadline).status, 'pending', 'expired latest baseline never revives older Busan');
});

test('meeting area preview leaves state/selection unchanged until apply and expiry rejects stale restoration', () => {
  const api = adapter([candidate('peer', { 'self.meetingRegions': ['busan'] })]);
  let state = set(api, ready(api), 'self.meetingRegions', ['busan'], { until: '2026-10-06T13:00:00.000Z' });
  state = api.record(state, { kind: 'select', candidateId: 'peer' });
  const original = structuredClone(state);
  const proposal = api.preview(state, { kind: 'set', field: 'self.meetingRegions', value: ['seoul-center'], target: 'context' });
  assert.deepEqual(state, original); assert.equal(inspect(api, state).selection.candidateId, 'peer');
  assert.equal(proposal.selectionWillClear, true);
  state = api.applyPreview(state, proposal);
  assert.equal(inspect(api, state).selection, null);
  const undo = api.preview(state, { kind: 'undo-field', field: 'self.meetingRegions', changeId: state.events.at(-1).id });
  assert.throws(() => api.applyPreview(state, undo, { at: '2026-10-06T13:00:00.000Z' }), /stale preview/);
});

test('time-limited priority expires to the current baseline and never resurrects an earlier context priority', () => {
  const api = adapter([
    candidate('slow-serious', { 'self.relationshipGoal': 'committed', 'self.relationshipSpeed': 'gradual' }),
    candidate('fast-social', { 'self.relationshipGoal': 'exploring', 'self.relationshipSpeed': 'steady' }),
  ]);
  let state = set(api, set(api, ready(api), 'wants.relationshipGoal', 'committed'), 'wants.relationshipSpeed', 'steady');
  state = api.record(state, { kind: 'priorities', fields: ['wants.relationshipGoal'], target: 'baseline' });
  state = api.record(state, { kind: 'priorities', fields: ['wants.relationshipGoal'], target: 'context' });
  const deadline = '2026-10-06T13:00:00.000Z';
  const proposal = api.preview(state, { kind: 'priorities', fields: ['wants.relationshipSpeed'], target: 'context', until: deadline });
  state = api.applyPreview(state, proposal);
  assert.equal(inspect(api, state).topCandidateId, 'fast-social');
  assert.deepEqual(inspect(api, state, deadline).priorities.effective, ['wants.relationshipGoal']);
  assert.equal(inspect(api, state, deadline).priorities.expired.context, true);
  state = api.record(state, { kind: 'start-context' });
  assert.deepEqual(inspect(api, state).priorities.effective, ['wants.relationshipGoal']);
});

test('priority deadlines cannot outlive selected answer/context and equal expiry is allowed', () => {
  const api = adapter();
  let state = ready(api);
  state = api.record(state, { kind: 'start-context', expiresAt: '2026-10-06T15:00:00.000Z' });
  state = set(api, state, 'wants.relationshipGoal', 'committed', { until: '2026-10-06T14:00:00.000Z' });
  assert.throws(() => api.preview(state, { kind: 'priorities', fields: ['wants.relationshipGoal'], target: 'context', until: '2026-10-06T14:30:00.000Z' }), /exceeds/);
  assert.throws(() => api.preview(state, { kind: 'priorities', fields: [], target: 'context', until: '2026-10-06T16:00:00.000Z' }), /exceeds/);
  assert.doesNotThrow(() => api.preview(state, { kind: 'priorities', fields: ['wants.relationshipGoal'], target: 'baseline', until: '2026-10-06T14:00:00.000Z' }));
  assert.throws(() => api.record(state, { kind: 'priorities', fields: [], target: 'baseline', until: state.events.at(-1).at }), /future/);
});

test('priority undo preserves old deadline and cannot revive a priority whose earlier deadline ended', () => {
  const api = adapter();
  let state = ready(api);
  state = api.record(state, { kind: 'priorities', fields: ['wants.relationshipGoal'], target: 'baseline', until: '2026-10-06T13:00:00.000Z' });
  state = api.record(state, { kind: 'priorities', fields: ['wants.relationshipSpeed'], target: 'baseline' });
  const proposal = api.preview(state, { kind: 'undo-priorities', changeId: state.events.at(-1).id });
  assert.throws(() => api.applyPreview(state, proposal, { at: '2026-10-06T13:00:00.000Z' }), /prior priority scope has expired/);
  state = api.record(state, { kind: 'undo-priorities', changeId: state.events.at(-1).id, at: '2026-10-06T13:00:00.000Z' });
  assert.deepEqual(inspect(api, state).priorities.effective, []);
});

test('thin meeting declaration reads no peer ranking or Ask, copies only the owner area set and does not mutate the log', () => {
  const normal = adapter([candidate('peer', { 'self.meetingRegions': ['busan'] })]);
  let state = set(normal, ready(normal), 'self.meetingRegions', ['busan']);
  state = normal.record(state, { kind: 'expose', candidateIds: ['peer'] });
  state = normal.record(state, { kind: 'select', candidateId: 'peer' });
  const snapshot = structuredClone(state);
  const thin = createDiscoveryAdapter({ Domain: { ...Domain, decide() { throw new Error('no peer decisions'); } },
    Ask: { ...Ask, choose() { throw new Error('no hypothetical questions'); } }, Personalization,
    synthetic: false, ownerId: 'owner', contextId: 'fit-check', candidates: [] });
  const output = thin.meetingRegionDeclaration(state);
  assert.deepEqual(output, ['busan']);
  output.push('jeju');
  assert.deepEqual(thin.meetingRegionDeclaration(state), ['busan']);
  assert.deepEqual(state, snapshot);
});

test('thin meeting declaration keeps current consent, explicit unknown and active context gates', () => {
  const api = adapter();
  let state = set(api, api.create('first', { at }), 'self.meetingRegions', ['busan']);
  assert.equal(api.meetingRegionDeclaration(state), null);
  state = set(api, state, 'consent', true);
  assert.deepEqual(api.meetingRegionDeclaration(state), ['busan']);
  const denied = set(api, state, 'consent', false);
  assert.equal(api.meetingRegionDeclaration(denied), null);
  const unknown = api.record(state, { kind: 'mark-unknown', field: 'self.meetingRegions' });
  assert.equal(api.meetingRegionDeclaration(unknown), null);
  const ended = api.record(state, { kind: 'close-context' });
  assert.equal(api.meetingRegionDeclaration(ended), null);
  assert.deepEqual(api.meetingRegionDeclaration(api.record(ended, { kind: 'start-context' })), ['busan']);
});

test('thin meeting declaration honors latest baseline expiry and context fallback without reviving older declarations', () => {
  const api = adapter(), deadline = '2026-10-06T13:00:00.000Z';
  let state = set(api, ready(api), 'self.meetingRegions', ['busan']);
  state = set(api, state, 'self.meetingRegions', ['seoul-center'], { target: 'context', until: deadline });
  assert.deepEqual(api.meetingRegionDeclaration(state), ['seoul-center']);
  assert.deepEqual(api.meetingRegionDeclaration(state, { at: deadline }), ['busan']);
  state = set(api, state, 'self.meetingRegions', ['jeju'], { until: deadline });
  assert.equal(api.meetingRegionDeclaration(state, { at: deadline }), null);
  state = api.record(state, { kind: 'start-context', expiresAt: '2026-10-06T12:30:00.000Z' });
  assert.equal(api.meetingRegionDeclaration(state, { at: '2026-10-06T12:30:00.000Z' }), null);
});
