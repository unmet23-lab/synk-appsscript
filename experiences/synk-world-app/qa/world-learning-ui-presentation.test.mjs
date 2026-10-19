// Help style and explanation length are account-wide (the learning memory's presentation, saved by
// WORLD's goals form and by 「내 성향」). WORLD reads that choice first and writes it only when the
// person saves the form, so opening WORLD never puts back an older choice (world-learning-ui.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldEducation } from '../world-learning-ui.mjs';

const EMPTY = Object.freeze({ skills: [], concepts: [], evidenceComplete: false });
function setup({ chosen = null, values = { reasons: ['travel'], support: 'step', explanation: 'brief', textSize: 'large' }, status = 'active', ready = null } = {}) {
  const writes = [], plans = [], lessons = [];
  const state = { chosen };
  const preferences = { presentation: () => state.chosen ? { ...state.chosen } : null, setPresentation: value => { writes.push(value); return true; } };
  const host = { createGame: () => ({ summary: () => EMPTY, disconnect() {} }), preferences: () => preferences, ...(ready ? { ready: () => ready(state) } : {}) };
  const progress = { owner: 'account-a', learningProfile: () => ({ profile: { status, revision: 1, consent: true } }),
    learningProfileValues: () => ({ ...values }), status: () => ({ phase: 'synced', rejected: false, scoped: true, message: '' }),
    exportSnapshot: () => ({}), flush: async () => {} };
  const education = createWorldEducation({
    home: { updateStudy() {}, toast() {}, showPanel() {}, closePanel() {} },
    getProgress: () => progress,
    engine: { engine: { createGame: () => ({ summary: () => EMPTY }) }, createLearningSync: null, recommendActivities: () => null },
    createPlan: args => { plans.push(args); return { selected: { route: 'lesson', lessonId: 'cafe-apply' }, reason: '' }; },
    launchGame() {}, startLesson: id => lessons.push(id), startReview() {},
    target: { SYNKLearningHost: host, addEventListener() {}, removeEventListener() {} } });
  return { education, writes, plans, lessons, state };
}

test('opening and practising never write the presentation; the plan follows the account choice', async () => {
  const { education, writes, plans, lessons } = setup({ chosen: { support: 'independent', explanation: 'detailed' } });
  education.refresh();
  assert.equal(plans.at(-1).settings.support, 'independent');assert.equal(plans.at(-1).settings.explanation, 'detailed');
  assert.deepEqual(plans.at(-1).settings.reasons, ['travel'], 'WORLD\'s own goals stay as they are');
  assert.equal(education.applyPreferences(), true);
  await education.next();
  assert.deepEqual(lessons, ['cafe-apply']);
  assert.deepEqual(writes, [], 'nothing was written back to the account');
  assert.deepEqual(education.presentation(), { support: 'independent', explanation: 'detailed' }, 'lessons and the game tutor read the same choice');
});

test('without an account choice WORLD\'s own answers stand in, and a value outside the vocabulary is ignored', () => {
  const none = setup();
  none.education.refresh();
  assert.equal(none.plans.at(-1).settings.support, 'step');
  assert.deepEqual(none.education.presentation(), { support: 'step', explanation: 'brief' });
  const odd = setup({ chosen: { support: 'always', explanation: 'detailed' } });
  assert.deepEqual(odd.education.presentation(), { support: 'step', explanation: 'detailed' });
});

test('only the form\'s explicit save writes, over the account\'s other choices, and clearing forgets only what the form shows', () => {
  const saved = setup({ chosen: { support: 'independent', audio: 'off', motion: 'reduced' } });
  assert.equal(saved.education.applyPreferences({ explicit: true }), true);
  assert.deepEqual(saved.writes, [{ support: 'step', explanation: 'brief', textSize: 'large', audio: 'off', motion: 'reduced' }],
    'sound and motion chosen elsewhere stay');
  const fresh = setup({ status: 'new' });
  assert.equal(fresh.education.applyPreferences({ explicit: true }), true);
  assert.deepEqual(fresh.writes, [], 'a profile that was never saved writes nothing');
  for (const status of ['disabled', 'deleted']) {
    const cleared = setup({ status, values: {}, chosen: { support: 'step', explanation: 'detailed', audio: 'off' } });
    assert.equal(cleared.education.applyPreferences({ explicit: true }), true);
    assert.deepEqual(cleared.writes, [{ audio: 'off' }], `${status}: the help style and explanation are forgotten, sound stays`);
    const only = setup({ status, values: {}, chosen: { support: 'step' } });
    only.education.applyPreferences({ explicit: true });
    assert.deepEqual(only.writes, [null], 'nothing left is forgotten as a whole');
  }
});

test('the next practice waits for the account\'s first memory read', async () => {
  const { education, plans, writes } = setup({ ready: async state => { await new Promise(resolve => setTimeout(resolve, 5)); state.chosen = { support: 'choose' }; } });
  await education.next();
  assert.equal(plans.at(-1).settings.support, 'choose', 'the choice read from the account is the one planned with');
  assert.deepEqual(writes, []);
  const failing = setup({ ready: async () => { throw Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' }); } });
  await failing.education.next();
  assert.deepEqual(failing.lessons, ['cafe-apply'], 'device-local practice still starts');
});
