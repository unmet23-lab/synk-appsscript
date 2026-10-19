// WORLD's practice choice reads the person's answers on 「내 성향」 (world-learning-plan.mjs): an interest
// is a declared goal Core already ranks by, "not now" stops that topic from pushing an activity
// forward, and neither outranks a more urgent need or hides anything from the list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createWorldLearningPlan, worldTopicAnswers } from '../world-learning-plan.mjs';
import { LESSONS } from '../life-content.mjs';
const require = createRequire(import.meta.url);
const { recommendActivities } = require('../../../atlas/learning.js');
const now = Date.parse('2026-10-19T03:00:00.000Z');
const plan = (fields = {}) => createWorldLearningPlan({ settings: { reasons: ['travel'] }, now, recommendActivities, ...fields });

test('without answers the choice is exactly as before', () => {
  const before = plan(), empty = plan({ answers: { interested: [], notNow: [] } }), absent = plan({ answers: null });
  assert.equal(empty.selected.id, before.selected.id);assert.equal(absent.selected.id, before.selected.id);
  assert.deepEqual(empty.alternatives.map(row => row.id), before.alternatives.map(row => row.id));
  assert.equal(before.reason, empty.reason);assert.deepEqual(before.settings.goals, ['travel']);
});

test('an interest puts its situation first among equally urgent activities and says why', () => {
  const before = plan();
  assert.notEqual(before.selected.packId, 'transit');
  const wanted = plan({ answers: { interested: ['sit-travel-transport'], notNow: [] } });
  assert.equal(wanted.selected.packId, 'transit');assert.ok(wanted.matchedGoals.includes('interest.sit-travel-transport'));
  assert.equal(wanted.reason, '더 배우고 싶다고 알려 준 내용이 들어 있는 연습이에요.');
  assert.deepEqual(wanted.settings.goals, ['travel'], 'the person\'s own goals are reported unchanged');
  const named = plan({ answers: { interested: ['sit-travel-transport'], notNow: [] }, summary: { skills: [], evidenceComplete: false, asOf: new Date(now).toISOString(),
    concepts: [{ id: 'sit-travel-transport', kind: 'situation', label: '교통', status: 'checking' }] } });
  assert.equal(named.reason, '더 배우고 싶다고 알려 준 ‘교통’ 연습이에요.');
});

test('"not now" keeps a situation from being pushed forward but leaves it to choose', () => {
  const before = plan();
  assert.equal(before.selected.packId, 'cafe');
  const later = plan({ answers: { interested: [], notNow: ['sit-travel-order'] } });
  assert.notEqual(later.selected.packId, 'cafe');
  assert.ok(later.alternatives.some(row => row.packId === 'cafe'), 'the cafe lesson is still on the list');
  assert.equal(later.excluded.length, before.excluded.length, 'nothing is hidden');
  const both = plan({ answers: { interested: ['sit-travel-order'], notNow: ['sit-travel-order'] } });
  assert.equal(both.selected.packId, 'cafe', 'an interest given in the same answer set wins over a duplicate "not now"');
});

test('a review that is due stays first even for a situation the person put off', () => {
  const lesson = LESSONS.find(row => row.packId === 'cafe' && row.questions?.some(question => question.review));
  const question = lesson.questions.find(row => row.review);
  const progress = { reviews: { [question.review.id]: { id: question.review.id, lessonId: lesson.id, questionId: question.id, packId: lesson.packId, skillId: question.skillId,
    dueAt: now - 3600000, lastAt: now - 3 * 86400000, lapses: 0, streak: 1 } } };
  const due = plan({ progress, answers: { interested: ['sit-travel-transport'], notNow: ['sit-travel-order'] } });
  assert.equal(due.selected.route, 'review');assert.equal(due.selected.packId, 'cafe');
  assert.ok(due.reasons.includes('review.due'));assert.doesNotMatch(due.reason, /더 배우고 싶다고/);
});

test('answers are read only from practised-topic facets, with recent agreements as interest', () => {
  const at = iso => new Date(now - iso).toISOString(), DAY = 86400000;
  const state = { version: 2, statements: [{ id: 'not-read' }],
    overrides: [
      { id: 'a', facetId: 'learning-topic:sit-travel-order', values: ['interested'], note: '메모', at: at(DAY) },
      { id: 'b', facetId: 'learning-topic:sit-travel-shopping', values: ['not-now'], note: '', at: at(DAY) },
      { id: 'c', facetId: 'learning-topic:sit-travel-transport', values: ['practice-only'], note: '', at: at(DAY) },
      { id: 'd', facetId: 'topics', values: ['travel-food'], note: '', at: at(DAY) },
      { id: 'e', facetId: 'learning-topic:../../x', values: ['interested'], note: '', at: at(DAY) },
    ],
    reviews: [
      { id: 'f', facetId: 'learning-topic:sit-people-greeting', verdict: 'agree', note: '', at: at(2 * DAY) },
      { id: 'g', facetId: 'learning-topic:sit-career-schedule', verdict: 'agree', note: '', at: at(40 * DAY) },
      { id: 'h', facetId: 'learning-topic:sit-travel-transport', verdict: 'agree', note: '', at: at(DAY) },
      { id: 'i', facetId: 'learning-topic:sit-travel-lodging', verdict: 'disagree', note: '', at: at(DAY) },
      { id: 'j', facetId: 'practice-mode', verdict: 'agree', note: '', at: at(DAY) },
    ] };
  assert.deepEqual(worldTopicAnswers(state, { now }), { interested: ['sit-travel-order', 'sit-people-greeting'], notNow: ['sit-travel-shopping'] });
  for (const value of [null, {}, { overrides: 'x', reviews: [] }]) assert.deepEqual(worldTopicAnswers(value, { now }), { interested: [], notNow: [] });
});
