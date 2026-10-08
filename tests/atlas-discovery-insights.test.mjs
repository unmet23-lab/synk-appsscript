import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { createDiscoveryAdapter, DISCOVERY_FIELDS } from '../experiences/atlas-lab/discovery.mjs';

const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
const set = (state, field, value, extra = {}) => api.record(state, { kind: 'set', field, value, ...extra });
const respond = (state, sceneId = 'contact-frequency', choice = 'a', extra = {}) => api.record(state, { kind: 'scene-respond', sceneId, choice, ...extra });
const getScene = (state, id = 'contact-frequency', options) => api.inspect(state, options).scenes.find(scene => scene.id === id);
const sceneAction = suggestion => ({ kind: 'set', field: suggestion.field, value: suggestion.value, target: suggestion.target,
  sceneResponseId: suggestion.responseId, ...(suggestion.until ? { until: suggestion.until } : {}) });
const applyScene = (state, id = 'contact-frequency') => api.applyPreview(state, api.preview(state, sceneAction(getScene(state, id).suggestion)));

test('stability reuses Ask hypothetical decisions and separates own answer coverage from probabilities', () => {
  let calls = 0, scenarios = 0;
  const observingAsk = { ...Ask, choose: input => { calls++; return Ask.choose({ ...input, decide: answers => { scenarios++; return input.decide(answers); } }); } };
  const adapter = createDiscoveryAdapter({ Domain, Ask: observingAsk, Personalization }), state = adapter.create('ready');
  calls = 0; scenarios = 0;
  const view = adapter.inspect(state);
  assert.ok(calls > 0 && scenarios > 1);
  assert.equal(view.insights.coverage.total, DISCOVERY_FIELDS.length);
  assert.equal(view.insights.coverage.known, 6);
  assert.equal(view.insights.coverage.basis, 'my-explicit-answers');
  assert.equal(view.insights.stability.status, 'sensitive');
  assert.ok(view.insights.stability.changes.some(change => change.field === 'wants.contact'));
  assert.ok(!JSON.stringify(view.insights).includes('hidden-no-consent'));
  for (const key of ['probability', 'confidence', 'accuracy']) assert.ok(!JSON.stringify(view.insights).includes(`"${key}"`));
});

test('joint leaders are compared as sets, including a tie becoming one leader', () => {
  const candidates = ['a', 'b'].map((id, index) => ({ id, label: id, values: { consent: true, availability: 'weekend', 'self.plan': index ? 'spontaneous' : 'planned' }, required: [] }));
  const adapter = createDiscoveryAdapter({ Domain, Ask, Personalization, synthetic: false, ownerId: 'me', contextId: 'test', candidates });
  let state = adapter.create();
  for (const [field, value] of Object.entries({ consent: true, availability: 'weekend' })) state = adapter.record(state, { kind: 'set', field, value });
  const view = adapter.inspect(state), change = view.insights.stability.changes.find(item => item.field === 'wants.plan');
  assert.deepEqual(view.topTierIds, ['a', 'b']); assert.ok(change);
  assert.deepEqual(change.leadingSets.find(item => item.optionId === 'planned').candidateIds, ['a']);
  assert.deepEqual(change.leadingSets.find(item => item.optionId === 'spontaneous').candidateIds, ['b']);
});

test('privacy, pause and daily allowance do not expose extra counterfactual questions or scenes', () => {
  assert.deepEqual(api.inspect(api.create()).scenes, []);
  assert.equal(api.inspect(api.create()).insights.stability.status, 'unavailable');
  let state = api.record(api.create('ready'), { kind: 'stop-questions' });
  assert.equal(api.inspect(state).insights.stability.status, 'not-checked');
  assert.deepEqual(api.inspect(state).insights.stability.checkedFields, []);
  assert.ok(api.inspect(state).scenes.every(scene => !scene.canRespond && scene.blockedReason));
  assert.throws(() => respond(state), /paused/);
  state = api.record(state, { kind: 'continue-questions' }); state = respond(state);
  assert.equal(api.inspect(state).question, null);
  assert.deepEqual(api.inspect(state).insights.stability.checkedFields, []);
  assert.throws(() => respond(state, 'advance-notice'), /daily budget/);
  assert.ok(getScene(state, 'advance-notice', { at: '2026-10-07T15:00:00.000Z' }).canRespond);
  state = set(state, 'consent', false);
  assert.deepEqual(api.inspect(state).scenes, []); assert.deepEqual(api.inspect(state).candidates, []);
});

test('scenes respect a deferred field and mandatory unanswered prerequisites', () => {
  let state = set(api.create(), 'consent', true);
  assert.ok(api.inspect(state).scenes.every(scene => !scene.canRespond));
  assert.throws(() => respond(state), /paused/);
  state = api.create('ready');
  for (let i = 0; i < DISCOVERY_FIELDS.length; i++) {
    const q = api.inspect(state).question;
    if (q.field === 'wants.contact') break;
    state = api.record(state, { kind: 'skip', field: q.field });
  }
  state = api.record(state, { kind: 'defer-question', field: 'wants.contact' });
  assert.equal(getScene(state).canRespond, false); assert.match(getScene(state).blockedReason, /잠시/);
  assert.throws(() => respond(state), /deferred/);
  assert.ok(!api.inspect(state).insights.stability.checkedFields.includes('wants.contact'));
});

test('a private scene reaction preserves answers, ranking and selection until a pure preview is explicitly applied', () => {
  let state = api.record(api.create('ready'), { kind: 'select', candidateId: 'candidate-1' });
  const before = api.inspect(state), seed = api.handoff(state);
  state = respond(state);
  const after = api.inspect(state), suggestion = getScene(state).suggestion;
  assert.deepEqual(after.fields, before.fields); assert.deepEqual(after.candidates, before.candidates);
  assert.deepEqual(after.selection, before.selection); assert.deepEqual(api.handoff(state), seed);
  assert.equal(suggestion.value, 'daily'); assert.equal(suggestion.target, 'context');
  assert.throws(() => api.record(state, sceneAction(suggestion)), /preview/);
  const saved = structuredClone(state), preview = api.preview(state, sceneAction(suggestion));
  assert.deepEqual(state, saved); assert.deepEqual(api.handoff(state), seed);
  state = api.applyPreview(state, preview);
  const field = api.inspect(state).fields.find(item => item.id === 'wants.contact');
  assert.equal(field.value, 'daily'); assert.equal(field.source, 'context'); assert.equal(field.baseline.state, 'unknown');
  assert.deepEqual(field.sceneSource, { sceneId: 'contact-frequency', responseId: suggestion.responseId });
  assert.equal(api.inspect(state).selection, null); assert.equal(getScene(state).suggestion, null);
  assert.equal(api.inspect(state).questionControl.usedToday, 1, 'approval does not ask a second scene question');
});

test('neither and depends are reactions, never any, an invented preference or an available suggestion', () => {
  for (const choice of ['neither', 'depends']) {
    const before = api.create('ready'), after = respond(before, 'contact-frequency', choice);
    assert.deepEqual(api.inspect(after).fields, api.inspect(before).fields);
    assert.equal(getScene(after).suggestion, null); assert.equal(getScene(after).response.choice, choice);
  }
});

test('scene approval preserves hard baseline and the original deadline instead of silently extending or relaxing it', () => {
  const until = '2026-10-07T00:00:00.000Z';
  let state = set(api.create('ready'), 'wants.plan', 'planned', { required: true, until });
  state = respond(state, 'making-plans', 'b');
  const suggestion = getScene(state, 'making-plans').suggestion;
  assert.equal(suggestion.until, until);
  const altered = sceneAction(suggestion); altered.until = '2026-10-08T00:00:00.000Z';
  assert.throws(() => api.preview(state, altered), /scene suggestion/);
  state = applyScene(state, 'making-plans');
  const view = api.inspect(state), field = view.fields.find(item => item.id === 'wants.plan');
  assert.equal(field.required, true); assert.equal(field.requiredValue, 'planned');
  assert.equal(field.context.provenance.until, until); assert.equal(field.baseline.provenance.until, until);
  assert.equal(view.status, 'blocked'); assert.equal(view.topCandidateId, null);
});

test('stale, withdrawn and foreign scene sources cannot be applied; a manual correction wins', () => {
  let state = respond(api.create('ready')), action = sceneAction(getScene(state).suggestion), preview = api.preview(state, action);
  assert.throws(() => api.preview(state, { ...action, sceneResponseId: 'event-999' }), /scene suggestion/);
  assert.throws(() => api.preview(state, { ...action, field: 'wants.plan', value: 'planned' }), /scene suggestion/);
  state = api.record(state, { kind: 'scene-withdraw', sceneId: 'contact-frequency' });
  assert.throws(() => api.applyPreview(state, preview), /stale/);
  assert.throws(() => api.preview(state, action), /scene suggestion/);
  state = respond(api.create('ready')); action = sceneAction(getScene(state).suggestion);
  state = set(state, 'wants.contact', 'few-days');
  assert.equal(getScene(state).suggestion, null); assert.throws(() => api.preview(state, action), /scene suggestion/);
});

test('withdrawing a reaction keeps a separately approved setting, and next context ends that temporary setting', () => {
  let state = applyScene(respond(api.create('ready')));
  state = api.record(state, { kind: 'scene-withdraw', sceneId: 'contact-frequency' });
  assert.equal(getScene(state).response, null); assert.equal(api.inspect(state).fields.find(field => field.id === 'wants.contact').value, 'daily');
  state = api.record(state, { kind: 'start-context' });
  assert.equal(getScene(state).response, null); assert.equal(api.inspect(state).fields.find(field => field.id === 'wants.contact').value, null);
});

test('reconfirming the same answer or changing it away and back cannot revive an old scene proposal', () => {
  for (const values of [['planned'], ['spontaneous', 'planned']]) {
    let state = respond(api.create('ready'), 'making-plans', 'a');
    const action = sceneAction(getScene(state, 'making-plans').suggestion);
    for (const value of values) state = set(state, 'wants.plan', value);
    assert.equal(getScene(state, 'making-plans').suggestion, null);
    assert.throws(() => api.preview(state, action), /scene suggestion/);
  }
});

test('new context, revoked discovery consent and elapsed source deadline retire unapproved scene suggestions', () => {
  for (const action of [{ kind: 'start-context' }, { kind: 'set', field: 'consent', value: false }]) {
    let state = respond(api.create('ready')); const source = sceneAction(getScene(state).suggestion);
    state = api.record(state, action);
    if (action.kind === 'set') state = set(state, 'consent', true);
    assert.equal(getScene(state).response, null); assert.throws(() => api.preview(state, source), /scene suggestion/);
  }
  let state = set(api.create('ready'), 'wants.contact', 'few-days', { until: '2026-10-07T00:00:00.000Z' });
  state = respond(state); const source = sceneAction(getScene(state).suggestion);
  assert.equal(getScene(state, 'contact-frequency', { at: '2026-10-07T00:00:00.000Z' }).suggestion, null);
  assert.throws(() => api.preview(state, source, { at: '2026-10-07T00:00:00.000Z' }), /scene suggestion/);
});

test('comparison metadata comes from matching values, not Korean text parsing', () => {
  const view = api.inspect(api.create('ready'));
  const one = view.candidates.find(item => item.id === 'candidate-1'), two = view.candidates.find(item => item.id === 'candidate-2');
  assert.equal(one.reasonDetails.find(item => item.field === 'wants.pace' && item.owner === 'self').comparison, 'match');
  assert.equal(two.reasonDetails.find(item => item.field === 'wants.pace' && item.owner === 'self').comparison, 'different');
  assert.equal(one.reasonDetails.find(item => item.field === 'wants.pace' && item.owner === 'partner').comparison, 'any');
  assert.equal(one.reasonDetails.find(item => item.field === 'wants.notice' && item.owner === 'self').comparison, 'unknown');
});
