import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { createDiscoveryAdapter } from '../experiences/atlas-lab/discovery.mjs';

const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
const record = (state, action) => api.record(state, action);
const set = (state, field, value, extra = {}) => record(state, { kind: 'set', field, value, ...extra });
const field = (state, id, at) => api.inspect(state, at ? { at } : {}).fields.find(item => item.id === id);
const top = state => api.inspect(state).topCandidateId;
const split = () => set(set(api.create('ready'), 'wants.pace', 'listen'), 'wants.plan', 'spontaneous');
const priorities = (state, fields, target = 'context') => record(state, { kind: 'priorities', fields, target });

test('explicit priority changes the expected tradeoff, never the hard eligibility or either answer', () => {
  const before = split(), after = priorities(before, ['wants.plan']);
  assert.equal(top(before), 'candidate-2'); assert.equal(top(after), 'candidate-3');
  assert.deepEqual(api.inspect(after).fields, api.inspect(before).fields);
  assert.deepEqual(api.inspect(after).priorities, { baseline: [], context: ['wants.plan'], effective: ['wants.plan'] });
  const hard = priorities(set(before, 'wants.pace', 'listen', { required: true }), ['wants.plan']);
  assert.equal(top(hard), 'candidate-2');
  assert.equal(api.inspect(hard).candidates.find(item => item.id === 'candidate-3').status, 'excluded');
  assert.equal(api.inspect(after).candidates.find(item => item.id === 'candidate-4').status, 'excluded', 'partner must-have unchanged');
  assert.equal(api.inspect(after).candidates.find(item => item.id === 'candidate-5').status, 'pending', 'unknown schedule stays unknown');
});

test('priority scope, empty selection, preview purity and stale application preserve explicit choices', () => {
  let state = priorities(split(), ['wants.pace'], 'baseline');
  state = record(state, { kind: 'select', candidateId: 'candidate-2' });
  const snapshot = structuredClone(state), handoff = api.handoff(state);
  const preview = api.preview(state, { kind: 'priorities', fields: ['wants.plan'], target: 'context' });
  assert.equal(preview.before.topCandidateId, 'candidate-2'); assert.equal(preview.after.topCandidateId, 'candidate-3');
  assert.equal(preview.selectionWillClear, true); assert.deepEqual(state, snapshot); assert.deepEqual(api.handoff(state), handoff);
  state = api.applyPreview(state, preview); assert.equal(api.inspect(state).selection, null);
  assert.throws(() => api.applyPreview(state, preview), /stale/);
  state = record(state, { kind: 'start-context' });
  assert.deepEqual(api.inspect(state).priorities, { baseline: ['wants.pace'], context: null, effective: ['wants.pace'] });
  state = priorities(state, []); assert.deepEqual(api.inspect(state).priorities.effective, []);
  for (const fields of [['wants.pace', 'wants.pace'], ['wants.pace', 'wants.plan', 'wants.notice'], ['self.pace'], ['fake']])
    assert.throws(() => priorities(state, fields), /at most two/);
});

test('structured explanations bind my editable answer to its actual layer and keep partner declarations read-only', () => {
  let state = set(api.create('ready'), 'wants.pace', 'listen', { target: 'context', until: '2026-10-07T12:00:00.000Z' });
  state = priorities(state, ['wants.pace']);
  const candidate = api.inspect(state).candidates.find(item => item.id === 'candidate-2');
  const mine = candidate.reasonDetails.find(item => item.owner === 'self' && item.field === 'wants.pace');
  assert.equal(mine.source, 'context'); assert.equal(mine.editable, true); assert.equal(mine.value, 'listen');
  assert.equal(mine.priority, true); assert.equal(mine.until, '2026-10-07T12:00:00.000Z'); assert.equal(mine.at, state.events.at(-2).at);
  const theirs = candidate.reasonDetails.find(item => item.owner === 'partner' && item.field === 'wants.pace');
  assert.equal(theirs.editable, false); assert.equal(theirs.at, null, 'no invented time for a public profile');
  const missing = candidate.reasonDetails.find(item => item.owner === 'self' && item.field === 'wants.notice');
  assert.equal(missing.source, 'missing'); assert.equal(missing.value, null);
});

test('private contact background creates a separate notice suggestion without changing ranking, selection or fields', () => {
  let state = record(api.create('ready'), { kind: 'select', candidateId: 'candidate-1' });
  const before = api.inspect(state), seed = api.handoff(state);
  state = record(state, { kind: 'reason', field: 'wants.contact', value: 'predictability' });
  const after = api.inspect(state);
  assert.deepEqual(after.fields, before.fields); assert.deepEqual(after.candidates, before.candidates);
  assert.deepEqual(after.selection, before.selection); assert.deepEqual(api.handoff(state), seed);
  assert.equal(after.noticeSuggestion.field, 'wants.notice'); assert.equal(after.noticeSuggestion.value, 'advance');
  assert.equal(after.noticeSuggestion.sourceReasonId, state.events.at(-1).id);
  assert.equal(JSON.stringify(after.candidates).includes('predictability'), false);
  state = set(state, 'wants.notice', 'advance', { target: 'context' });
  assert.equal(field(state, 'self.notice').value, null); assert.equal(field(state, 'wants.notice').source, 'context');
  assert.equal(top(state), 'candidate-2', 'the independently confirmed notice preference changes the actual comparison');
  assert.equal(api.inspect(state).noticeSuggestion, null);
  state = record(state, { kind: 'reason', field: 'wants.contact', value: 'temporary' });
  assert.match(api.inspect(state).reasonGuidance, /이번 추천/);
  assert.throws(() => record(state, { kind: 'reason', field: 'self.contact', value: 'predictability' }), /private choice reason/);
});

test('brief optional budget uses Ask, stops after two and does not backfill legacy answers or reset on context/mode changes', () => {
  let state = api.create('ready'); assert.equal(api.inspect(state).questionControl.mode, null);
  state = record(state, { kind: 'question-mode', mode: 'brief' });
  assert.equal(api.inspect(state).questionControl.usedToday, 0);
  for (let i = 0; i < 2; i++) {
    const q = api.inspect(state).question; assert.equal(q.optional, true);
    state = record(state, { kind: 'skip', field: q.field });
  }
  assert.equal(api.inspect(state).question, null); assert.equal(api.inspect(state).questionControl.remaining, 0);
  state = record(state, { kind: 'start-context' }); assert.equal(api.inspect(state).question, null);
  state = record(state, { kind: 'question-mode', mode: 'thorough' });
  assert.equal(api.inspect(state).questionControl.remaining, 3); assert.notEqual(api.inspect(state).question, null);
  state = record(state, { kind: 'question-mode', mode: 'brief' }); assert.equal(api.inspect(state).question, null);
  state = record(state, { kind: 'clear', field: 'availability' });
  assert.equal(api.inspect(state).question.field, 'availability'); assert.equal(api.inspect(state).question.optional, false);
  assert.throws(() => record(state, { kind: 'defer-question', field: 'availability' }), /optional/);
});

test('the selected optional question can rest seven days across contexts, without becoming false or any', () => {
  let state = api.create('ready'), q = api.inspect(state).question;
  state = record(state, { kind: 'defer-question', field: q.field });
  const deferred = api.inspect(state).questionControl.deferred[0];
  assert.equal(field(state, q.field).state, 'unknown'); assert.notEqual(api.inspect(state).question?.field, q.field);
  state = record(state, { kind: 'start-context' });
  assert.notEqual(api.inspect(state).question?.field, q.field); assert.equal(api.inspect(state).questionControl.deferred.length, 1);
  assert.equal(api.inspect(state, { at: deferred.until }).questionControl.deferred.length, 0);
  assert.equal(api.inspect(state, { at: deferred.until }).question.field, q.field);
  assert.throws(() => record(state, { kind: 'defer-question', field: 'wants.notice' }), /selected optional/);
});

test('optional allowance resets at Korean midnight, never at UTC midnight and never by changing modes', () => {
  let state = record(api.create('ready'), { kind: 'question-mode', mode: 'brief', at: '2026-10-06T14:59:00.000Z' });
  for (let i = 0; i < 2; i++) state = record(state, { kind: 'defer-question', field: api.inspect(state).question.field });
  const before = api.inspect(state, { at: '2026-10-06T14:59:59.999Z' }).questionControl;
  assert.equal(before.day, '2026-10-06'); assert.equal(before.remaining, 0); assert.equal(before.timeZone, 'Asia/Seoul');
  const midnight = api.inspect(state, { at: '2026-10-06T15:00:00.000Z' }).questionControl;
  assert.equal(midnight.day, '2026-10-07'); assert.equal(midnight.usedToday, 0); assert.equal(midnight.remaining, 2);
  assert.equal(api.inspect(state, { at: '2026-10-07T00:00:00.000Z' }).questionControl.day, '2026-10-07');
});

test('self notice is optional unless explicitly required by a public counterpart', () => {
  const candidates = [{ id: 'other', label: '상대', values: { consent: true, availability: 'weekend', 'wants.notice': 'advance' }, required: ['wants.notice'] }];
  const external = createDiscoveryAdapter({ Domain, Ask, Personalization, synthetic: false, ownerId: 'me', contextId: 'test', candidates });
  let state = external.create();
  state = external.record(state, { kind: 'set', field: 'consent', value: true });
  state = external.record(state, { kind: 'set', field: 'availability', value: 'weekend' });
  state = external.record(state, { kind: 'stop-questions' });
  assert.equal(external.inspect(state).question.field, 'self.notice'); assert.equal(external.inspect(state).question.optional, false);
  assert.throws(() => external.record(state, { kind: 'defer-question', field: 'self.notice' }), /selected optional/);
  assert.throws(() => external.record(state, { kind: 'skip', field: 'self.notice' }), /optional/);
});

test('optional self notice can be deferred without inventing a declaration or changing the candidate comparison', () => {
  const candidates = ['advance', 'when-free'].map((notice, i) => ({ id: `other-${i}`, label: `상대 ${i}`, values: { consent: true, availability: 'weekend', 'wants.notice': notice }, required: [] }));
  const external = createDiscoveryAdapter({ Domain, Ask, Personalization, synthetic: false, ownerId: 'me', contextId: 'test', candidates });
  let state = external.create();
  state = external.record(state, { kind: 'set', field: 'consent', value: true });
  state = external.record(state, { kind: 'set', field: 'availability', value: 'weekend' });
  const before = external.inspect(state); assert.equal(before.question.field, 'self.notice'); assert.equal(before.question.optional, true);
  state = external.record(state, { kind: 'defer-question', field: 'self.notice' });
  assert.equal(external.inspect(state).fields.find(item => item.id === 'self.notice').value, null);
  assert.deepEqual(external.inspect(state).candidates, before.candidates);
});

test('once deadline returns to baseline with accurate source and invalidates the prior selection even if still eligible', () => {
  let state = set(api.create('ready'), 'wants.pace', 'listen', { target: 'context', until: '2026-10-07T00:00:00.000Z' });
  state = record(state, { kind: 'select', candidateId: 'candidate-2' });
  assert.equal(field(state, 'wants.pace').source, 'context');
  const view = api.inspect(state, { at: '2026-10-07T00:00:00.000Z' }), f = view.fields.find(item => item.id === 'wants.pace');
  assert.equal(f.value, 'lead'); assert.equal(f.source, 'baseline'); assert.equal(f.context.state, 'expired');
  assert.equal(f.context.expired[0].value, 'listen'); assert.equal(view.topCandidateId, 'candidate-1');
  assert.equal(view.selection, null); assert.equal(api.handoff(state, { at: '2026-10-07T00:00:00.000Z' }), null);
});

test('expired ongoing hard answer remains required and unknown, without old baseline or context substitution', () => {
  let state = set(api.create('ready'), 'wants.pace', 'listen', { required: true, until: '2026-10-07T00:00:00.000Z' });
  state = set(state, 'wants.pace', 'listen', { target: 'context' });
  const view = api.inspect(state, { at: '2026-10-07T00:00:00.000Z' }), f = view.fields.find(item => item.id === 'wants.pace');
  assert.equal(f.value, 'listen'); assert.equal(f.baseline.state, 'expired'); assert.equal(f.required, true); assert.equal(f.requiredValue, null);
  assert.equal(view.topCandidateId, null); assert.ok(view.candidates.every(item => item.status !== 'eligible'));
  assert.equal(view.question.field, 'wants.pace'); assert.equal(view.question.target, 'baseline');
});

test('undo preserves the original deadline and cannot resurrect a value after it elapsed', () => {
  let state = set(api.create('ready'), 'wants.contact', 'daily', { until: '2026-10-07T00:00:00.000Z' });
  state = set(state, 'wants.contact', 'few-days');
  const changeId = api.inspect(state).changes.at(-1).id;
  const restored = record(state, { kind: 'undo-field', field: 'wants.contact', changeId });
  assert.equal(field(restored, 'wants.contact').baseline.provenance.until, '2026-10-07T00:00:00.000Z');
  assert.equal(field(restored, 'wants.contact', '2026-10-07T00:00:00.000Z').state, 'expired');
  const late = record(state, { kind: 'undo-field', field: 'wants.contact', changeId, at: '2026-10-07T00:00:00.000Z' });
  assert.equal(field(late, 'wants.contact').value, null);
});

test('an explicit unknown masks an expired baseline without falsely calling the new answer expired', () => {
  let state = set(api.create('ready'), 'wants.contact', 'daily', { until: '2026-10-07T00:00:00.000Z' });
  state = record(state, { kind: 'mark-unknown', field: 'wants.contact', at: '2026-10-07T01:00:00.000Z' });
  const answer = field(state, 'wants.contact');
  assert.equal(answer.baseline.state, 'expired'); assert.equal(answer.source, 'explicit-unknown');
  assert.equal(answer.state, 'unknown'); assert.equal(answer.effective.state, 'unknown'); assert.equal(answer.effective.value, null);
});

test('time-only preference expiry invalidates a preview and deadlines are canonical future instants', () => {
  let state = set(api.create('ready'), 'wants.contact', 'daily', { until: '2026-10-07T00:00:00.000Z' });
  const preview = api.preview(state, { kind: 'priorities', fields: ['wants.plan'], target: 'context' });
  assert.throws(() => api.applyPreview(state, preview, { at: '2026-10-07T00:00:00.000Z' }), /stale preview/);
  for (const until of ['2026-10-06T12:00:00.000Z', '2026-10-07T00:00:00+00:00', 'tomorrow'])
    assert.throws(() => set(state, 'wants.pace', 'listen', { until }), /preference|time/);
});

test('a fresh preview made after expiry applies using its current comparison, without replaying the pre-expiry result', () => {
  const state = set(api.create('ready'), 'wants.pace', 'listen', { target: 'context', until: '2026-10-07T00:00:00.000Z' });
  const at = '2026-10-07T00:00:01.000Z';
  const preview = api.preview(state, { kind: 'set', field: 'wants.plan', value: 'spontaneous', target: 'context' }, { at });
  assert.equal(preview.evaluatedAt, at); assert.equal(preview.before.topCandidateId, 'candidate-1');
  assert.equal(preview.after.topCandidateId, 'candidate-3');
  const applied = api.applyPreview(state, preview, { at });
  assert.equal(top(applied), 'candidate-3'); assert.equal(field(applied, 'wants.pace').value, 'lead');
});
