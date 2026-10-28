'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Learning = require('../atlas/game-learning');
const { createMap } = require('../strata');
const map = createMap(require('../strata/topik-i').topikMap());
function fixture() {
  const values = new Map(); let at = Date.parse('2026-10-28T00:00:00Z');
  return Learning.createGame({ gameId: 'prior-audit', map,
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    clock: () => new Date(at += 1000).toISOString() });
}
const item = (id, responseFormat = 'single-choice') => ({ id, itemKey: id, familyKey: id,
  skillId: 'ko.listening.detail', difficulty: 1, modality: 'listening', responseFormat, audioRequired: false });

test('real café candidates do not inherit an untried response format from multiple-choice success', async () => {
  const { FLOW_PRACTICE, FLOW_SKILLS, orderCandidates } = await import('../experiences/order-rush/learning.mjs');
  const { ORDERS } = await import('../experiences/order-rush/core.mjs');
  const coach = fixture();
  for (const skillId of FLOW_SKILLS) for (const difficulty of [1, 2]) for (let n = 0; n < 4; n++) {
    const id = `${skillId}-${difficulty}-${n}`;
    const pid = coach.present({ ...item(id), skillId, difficulty });
    coach.answer(pid, { correct: true, assessable: true });
  }
  const live = coach.live(FLOW_PRACTICE, { skillIds: FLOW_SKILLS, responseFormat: 'cup-compose' });
  assert.equal(live.intro().code, 'start.default');
  assert.equal(live.settings().level, 1);
  assert.equal(live.pick(orderCandidates(ORDERS)).selected.difficulty, 1);
  for (const skill of coach.summary().skills.filter(s => FLOW_SKILLS.includes(s.id))) {
    assert.equal(skill.levels[1].formats['single-choice'].status, 'recent-independent');
    assert.equal(skill.levels[1].formats['cup-compose'].status, 'unseen');
  }
});

test('explanation help keeps its exact level, affects independence only before the answer, and deduplicates', () => {
  const coach = fixture(), before = coach.present(item('before'));
  const explanation = coach.help(before, 'explanation');
  assert.equal(explanation.level, 'explanation');
  assert.equal(coach.help(before, 'explanation'), null);
  assert.equal(coach.answer(before, { correct: true, assessable: true }).independent, false);
  const after = coach.present(item('after'));
  assert.equal(coach.answer(after, { correct: true, assessable: true }).independent, true);
  coach.help(after, 'explanation');
  assert.equal(coach.summary().counts.independent.evaluated, 1);
  for (const kind of ['text', 'hint', 'replay']) {
    const pid = coach.present(item(`cue-${kind}`));
    assert.equal(coach.help(pid, kind).level, 'cue');
  }
  assert.equal(coach.help(coach.present(item('answer')), 'answer').level, 'answer');
});
