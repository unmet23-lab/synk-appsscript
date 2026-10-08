import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { createDiscoveryAdapter } from '../experiences/atlas-lab/discovery.mjs';

const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
const scenes = [
  { id: 'relationship-goal', field: 'wants.relationshipGoal', values: ['committed', 'exploring'], other: 'wants.relationshipSpeed' },
  { id: 'relationship-goal-open', field: 'wants.relationshipGoal', values: ['committed', 'open'], other: 'wants.relationshipSpeed' },
  { id: 'relationship-speed', field: 'wants.relationshipSpeed', values: ['gradual', 'steady'], other: 'wants.relationshipGoal' },
  { id: 'relationship-speed-flexible', field: 'wants.relationshipSpeed', values: ['gradual', 'flexible'], other: 'wants.relationshipGoal' },
];
const set = (state, field, value, extra = {}) => api.record(state, { kind: 'set', field, value, ...extra });
const getScene = (state, id, options) => api.inspect(state, options).scenes.find(item => item.id === id);
const getField = (state, field, options) => api.inspect(state, options).fields.find(item => item.id === field);
const respond = (state, id, choice = 'a') => api.record(state, { kind: 'scene-respond', sceneId: id, choice });
const sceneAction = suggestion => ({ kind: 'set', field: suggestion.field, value: suggestion.value, target: suggestion.target,
  sceneResponseId: suggestion.responseId, ...(suggestion.until ? { until: suggestion.until } : {}) });
const ready = () => api.create('ready');

test('relationship examples cover the three independently declared values on each axis and vary only their target', () => {
  const state = ready(), view = api.inspect(state), selected = view.scenes.filter(item => item.id.startsWith('relationship-'));
  assert.deepEqual(selected.map(item => item.id), scenes.map(item => item.id));
  for (const scene of scenes) {
    const authored = getScene(state, scene.id);
    assert.equal(authored.field, scene.field); assert.match(authored.intro, /연락 간격과 이번 약속은 같/);
    assert.equal(authored.options.length, 4);
    if (scene.field.endsWith('Goal')) assert.match(authored.intro, /시간에 여유를 두고/);
    else assert.match(authored.intro, /둘 다 진지한 관계/);
    for (const [index, choice] of ['a', 'b'].entries()) {
      const after = respond(state, scene.id, choice), suggestion = getScene(after, scene.id).suggestion;
      assert.equal(suggestion.field, scene.field); assert.equal(suggestion.value, scene.values[index]);
      assert.equal(suggestion.target, 'context'); assert.equal(getField(after, scene.other).value, null);
      assert.equal(getField(after, scene.field.replace('wants.', 'self.')).value, null);
    }
  }
});

for (const scene of scenes) test(`${scene.id}: a private response and preview preserve answers, ranking and selection until explicit application`, () => {
  let state = api.record(ready(), { kind: 'select', candidateId: 'candidate-1' });
  state = set(state, scene.other, scene.other.endsWith('Goal') ? 'committed' : 'gradual');
  state = api.record(state, { kind: 'select', candidateId: api.inspect(state).topCandidateId });
  const before = api.inspect(state), beforeSeed = api.handoff(state);
  state = respond(state, scene.id, 'b');
  const reaction = api.inspect(state), suggestion = getScene(state, scene.id).suggestion;
  assert.deepEqual(reaction.fields, before.fields); assert.deepEqual(reaction.candidates, before.candidates);
  assert.deepEqual(reaction.selection, before.selection); assert.deepEqual(api.handoff(state), beforeSeed);
  assert.equal(reaction.questionControl.usedToday, before.questionControl.usedToday + 1);
  const action = sceneAction(suggestion); assert.throws(() => api.record(state, action), /preview/);
  const saved = structuredClone(state), preview = api.preview(state, action);
  assert.deepEqual(state, saved); assert.equal(getField(state, scene.field).value, null);
  assert.deepEqual(api.handoff(state), beforeSeed);
  state = api.applyPreview(state, preview); const after = api.inspect(state), answer = getField(state, scene.field);
  assert.equal(answer.value, scene.values[1]); assert.equal(answer.source, 'context'); assert.equal(answer.baseline.state, 'unknown');
  assert.deepEqual(answer.sceneSource, { sceneId: scene.id, responseId: suggestion.responseId });
  assert.deepEqual(getField(state, scene.other), before.fields.find(item => item.id === scene.other));
  assert.equal(getField(state, scene.field.replace('wants.', 'self.')).value, null);
  assert.equal(getField(state, 'wants.purpose').value, null); assert.equal(after.selection, null);
  assert.equal(after.questionControl.usedToday, reaction.questionControl.usedToday, 'approval does not charge another question');
});

test('neither and depends never become a relationship declaration or an assumed cross-axis answer', () => {
  for (const scene of scenes) for (const choice of ['neither', 'depends']) {
    const before = ready(), after = respond(before, scene.id, choice);
    assert.deepEqual(api.inspect(after).fields, api.inspect(before).fields);
    assert.deepEqual(api.inspect(after).candidates, api.inspect(before).candidates);
    assert.equal(getScene(after, scene.id).response.choice, choice); assert.equal(getScene(after, scene.id).suggestion, null);
    assert.equal(getField(after, scene.field).value, null); assert.equal(getField(after, scene.other).value, null);
  }
});

test('new scenes share the existing daily budget across axes and remain blocked by pause, defer and mandatory confirmation', () => {
  let state = api.record(ready(), { kind: 'question-mode', mode: 'brief' });
  state = respond(state, 'relationship-goal'); state = respond(state, 'relationship-speed');
  assert.equal(api.inspect(state).questionControl.usedToday, 2);
  assert.ok(api.inspect(state).scenes.every(scene => !scene.canRespond));
  assert.throws(() => respond(state, 'relationship-speed-flexible'), /budget/);
  state = api.record(ready(), { kind: 'stop-questions' });
  assert.ok(api.inspect(state).scenes.every(scene => !scene.canRespond)); assert.throws(() => respond(state, 'relationship-goal'), /paused/);
  state = api.record(ready(), { kind: 'defer-question', field: 'wants.relationshipGoal' });
  for (const id of ['relationship-goal', 'relationship-goal-open']) {
    assert.equal(getScene(state, id).canRespond, false); assert.throws(() => respond(state, id), /deferred/);
  }
  state = api.record(ready(), { kind: 'clear', field: 'availability' });
  assert.ok(api.inspect(state).scenes.every(scene => !scene.canRespond)); assert.throws(() => respond(state, 'relationship-speed'), /paused|deferred|budget/);
});

test('withdrawing a relationship reaction invalidates its proposal but preserves a separately approved answer until its context ends', () => {
  for (const scene of scenes) {
    let state = respond(ready(), scene.id, 'b'), action = sceneAction(getScene(state, scene.id).suggestion);
    const preview = api.preview(state, action);
    const withdrawn = api.record(state, { kind: 'scene-withdraw', sceneId: scene.id });
    assert.equal(getScene(withdrawn, scene.id).suggestion, null); assert.throws(() => api.applyPreview(withdrawn, preview), /stale/);
    assert.throws(() => api.preview(withdrawn, action), /scene suggestion/);
    state = api.applyPreview(state, preview); state = api.record(state, { kind: 'scene-withdraw', sceneId: scene.id });
    assert.equal(getScene(state, scene.id).response, null); assert.equal(getField(state, scene.field).value, scene.values[1]);
    state = api.record(state, { kind: 'start-context' }); assert.equal(getField(state, scene.field).value, null);
    assert.equal(getScene(state, scene.id).response, null);
  }
});

test('two comparisons on the same relationship axis cannot revive stale or changed private sources', () => {
  let state = api.record(ready(), { kind: 'question-mode', mode: 'thorough' });
  state = respond(state, 'relationship-goal', 'b'); const earlier = sceneAction(getScene(state, 'relationship-goal').suggestion);
  state = respond(state, 'relationship-goal-open', 'b'); const latest = sceneAction(getScene(state, 'relationship-goal-open').suggestion);
  assert.throws(() => api.preview(state, { ...earlier, field: latest.field, value: latest.value }), /scene suggestion/);
  state = api.applyPreview(state, api.preview(state, latest));
  assert.equal(getField(state, 'wants.relationshipGoal').value, 'open'); assert.equal(getScene(state, 'relationship-goal').suggestion, null);
  assert.throws(() => api.preview(state, earlier), /scene suggestion/);
  const current = set(state, 'wants.relationshipGoal', 'exploring');
  assert.equal(getScene(current, 'relationship-goal').suggestion, null); assert.equal(getScene(current, 'relationship-goal-open').suggestion, null);
});

test('scene confirmation keeps the goal must-have and source deadline while changing only the temporary goal', () => {
  const until = '2026-10-07T00:00:00.000Z';
  let state = set(ready(), 'wants.relationshipGoal', 'committed', { required: true, until });
  state = set(state, 'wants.relationshipSpeed', 'gradual'); state = respond(state, 'relationship-goal', 'b');
  const action = sceneAction(getScene(state, 'relationship-goal').suggestion); assert.equal(action.until, until);
  assert.throws(() => api.preview(state, { ...action, until: '2026-10-08T00:00:00.000Z' }), /scene suggestion/);
  const beforeSpeed = getField(state, 'wants.relationshipSpeed'); state = api.applyPreview(state, api.preview(state, action));
  const goal = getField(state, 'wants.relationshipGoal'); assert.equal(goal.requiredValue, 'committed'); assert.equal(goal.required, true);
  assert.equal(goal.context.value, 'exploring'); assert.equal(goal.context.provenance.until, until);
  assert.deepEqual(getField(state, 'wants.relationshipSpeed'), beforeSpeed); assert.equal(api.inspect(state).status, 'blocked');
  assert.equal(getScene(state, 'relationship-goal', { at: until }).suggestion, null);
});

test('private relationship reactions stay out of candidate and handoff projections and do not survive revoked consent', () => {
  let state = api.record(ready(), { kind: 'select', candidateId: 'candidate-1' }), before = api.handoff(state);
  state = respond(state, 'relationship-speed', 'a'); const suggestion = sceneAction(getScene(state, 'relationship-speed').suggestion);
  assert.deepEqual(api.handoff(state), before); assert.ok(!JSON.stringify(api.inspect(state).candidates).includes('relationship-speed'));
  state = set(state, 'consent', false); assert.deepEqual(api.inspect(state).scenes, []); assert.deepEqual(api.inspect(state).candidates, []);
  state = set(state, 'consent', true); assert.equal(getScene(state, 'relationship-speed').response, null);
  assert.throws(() => api.preview(state, suggestion), /scene suggestion/);
});
