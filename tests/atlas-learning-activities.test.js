'use strict';
// Core recommendActivities: an activity whose items were all presented (no new first try) must not stay
// in the urgent tier on its 7-day 'review' state and starve a host's due review (10-19 WORLD audit:
// a TOPIK learner's life reviews waited up to 29 days behind an exhausted 바람길).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('../atlas/game-learning');
const Learning = require('../atlas/learning');
const { activityReason } = require('../atlas/vellum');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const DAY = 86400000, START = Date.parse('2026-10-02T01:00:00Z'), L = 'ko.listening.detail';
function fixture() {
  let now = START;
  const values = new Map(), storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const coach = createGame({ gameId: 'activity-test', storage, map, clock: () => new Date(now).toISOString() });
  const item = n => ({ id: `check-${n}`, itemKey: `check-${n}.v1`, familyKey: `check-${n}.v1`, skillId: L, modality: 'listening', difficulty: 1,
    responseFormat: 'single-choice', audioRequired: true, confounded: false });
  const answer = (n, correct = true) => {
    now += 1000;
    const pid = coach.present(item(n)); coach.delivery(pid, { audio: 'completed' });
    return coach.answer(pid, { correct, assessable: true });
  };
  const target = n => ({ id: `check-${n}`, skillIds: [L], difficulty: 1, modality: 'listening', responseFormat: 'single-choice', familyKeys: [`check-${n}.v1`], itemKey: `check-${n}.v1` });
  return { coach, answer, target, at: () => new Date(now).toISOString(), advance: days => { now += days * DAY; } };
}
const settings = { goals: ['exam'], audioAvailable: true };
function candidates(f, targets, { reviewAt }) {
  return [
    { id: 'game.listen', minutes: 3, targets, goals: ['exam', 'listening'], audioRequired: true },
    { id: 'host.review', minutes: 1, targets: [], goals: ['life'], reviewAt },
  ];
}

test('an activity with every item already presented leaves the urgent tier and a due host review goes first', () => {
  const f = fixture();
  for (const n of [1, 2, 3, 4]) f.answer(n, true);
  f.advance(8); // the last independent answer is older than 7 days: the item state becomes 'review'
  const reviewAt = new Date(Date.parse(f.at()) - DAY).toISOString();
  const spent = f.coach.recommendActivities(candidates(f, [1, 2, 3, 4].map(f.target), { reviewAt }), { settings, at: f.at() });
  assert.equal(spent.selected.id, 'host.review', 'the due review is not starved by the goal-matched but spent activity');
  const game = spent.assessments.find(row => row.id === 'game.listen');
  assert.ok(game.reasons.includes('practice.spent'));
  assert.ok(!game.reasons.includes('practice.review'));
  assert.equal(spent.alternatives[0].id, 'game.listen', 'the spent activity stays available, behind');
  // The same spent activity alone is still offered, and Vellum says why without calling it a need.
  const alone = f.coach.recommendActivities([candidates(f, [1, 2, 3, 4].map(f.target), { reviewAt })[0]], { settings, at: f.at() });
  assert.equal(alone.selected.id, 'game.listen');
  assert.match(alone.reason, /새 문항은 모두 만났어요/);
  assert.equal(activityReason({ reasons: ['practice.spent', 'goal.declared'] }), '이 활동의 새 문항은 모두 만났어요. 다시 해도 좋지만 연습 기록은 새 문항으로만 바뀌어요. 고른 목표와 이어지는 활동이에요.');
});

test('an activity with a new item keeps its review urgency and the declared goal still decides equal urgency', () => {
  const f = fixture();
  for (const n of [1, 2, 3, 4]) f.answer(n, true);
  f.advance(8);
  const reviewAt = new Date(Date.parse(f.at()) - DAY).toISOString();
  const fresh = f.coach.recommendActivities(candidates(f, [1, 2, 3, 4, 5].map(f.target), { reviewAt }), { settings, at: f.at() });
  assert.equal(fresh.selected.id, 'game.listen', 'a new first try is possible, so its 7-day review need stays urgent');
  assert.ok(fresh.reasons.includes('practice.review'));
  assert.ok(!fresh.reasons.includes('practice.spent'));
});

test('without the presented history Core cannot see a spent activity: the host must pass it (WORLD uses the coach call)', () => {
  const f = fixture();
  for (const n of [1, 2, 3, 4]) f.answer(n, true);
  f.advance(8);
  const reviewAt = new Date(Date.parse(f.at()) - DAY).toISOString();
  const plain = Learning.recommendActivities({ profile: f.coach.summary(), candidates: candidates(f, [1, 2, 3, 4].map(f.target), { reviewAt }), settings, at: f.at() });
  assert.equal(plain.selected.id, 'game.listen', 'the profile alone has no presentations, so this is the 10-19 starvation');
});
