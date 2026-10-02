'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../atlas/engine');
const Learning = require('../atlas/learning');
const { createGame } = require('../atlas/game-learning');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const at = '2026-10-02T01:00:00Z';
const SKILL = 'ko.reading.detail';
const mode = [{ id: 'standard', minutes: 3, pace: 'standard' }];

test('a session captures its original owner; host or returned object mutation cannot switch it', () => {
  const scope = { domain: 'LAB', workspace: 'core-review', subject: 'synthetic-a' };
  const expected = { ...scope };
  let serial = 0;
  const session = Core.createSession({ scope, clock: () => at, id: () => `owner.${++serial}` });
  session.set('time', 'short');
  scope.subject = 'synthetic-b';
  scope.workspace = 'other';
  scope.domain = 'SHIFT';
  assert.deepEqual(session.state().scope, expected);
  assert.equal(session.state().context.time, 'short');
  session.state().scope.subject = 'mutated-state';
  session.events()[0].scope.subject = 'mutated-event';
  const plan = session.plan('owner-test', mode);
  plan.scope.subject = 'mutated-plan';
  const event = session.set('support', 'step');
  event.scope.subject = 'mutated-return';
  assert.ok(session.events().every(e => JSON.stringify(e.scope) === JSON.stringify(expected)));
  assert.deepEqual(session.state().scope, expected);
});

function learningFixture() {
  const values = new Map();
  const coach = createGame({ gameId: 'core-review', map, clock: () => at,
    storage: { getItem: k => values.get(k) ?? null, setItem: (k, value) => values.set(k, value) } });
  return coach;
}
const candidate = (id, fields = {}) => ({ id, skillIds: [SKILL], difficulty: 1,
  modality: 'reading', responseFormat: 'single-choice', ...fields });

test('recommendation avoids a recently shown content family even when item and choice IDs differ', () => {
  const coach = learningFixture();
  coach.present({ id: 'original', itemKey: 'original.item', familyKey: 'same.family', skillId: SKILL,
    difficulty: 1, modality: 'reading', responseFormat: 'single-choice' });
  const result = coach.recommend([
    candidate('a.variant', { itemKey: 'variant.item', familyKey: 'same.family' }),
    candidate('z.fresh', { itemKey: 'fresh.item', familyKey: 'fresh.family' }),
  ]);
  assert.equal(result.selected.id, 'z.fresh');
  assert.equal(result.alternatives[0].id, 'a.variant');
  assert.equal(result.state, 'unseen', 'exposure alone creates no language weakness');
});

test('matching task, item and family count one presentation, with legacy item matching intact', () => {
  const coach = learningFixture();
  const result = Learning.recommend({ profile: coach.summary(),
    candidates: [candidate('a.same', { itemKey: 'same.item', familyKey: 'same.family' }), candidate('z.other', { itemKey: 'other.item' })],
    presentations: [{ taskId: 'a.same', itemKey: 'same.item', measure: { familyKey: 'same.family' } },
      { taskId: 'z.other', itemKey: 'other.item' }] });
  assert.equal(result.selected.id, 'a.same', 'equal one-time counts keep the deterministic ID tie break');
});

test('a correct result with help and an exclusion reason is not a supported language success', () => {
  for (const reason of ['motor', 'demo', 'visual', 'audio', 'storage']) {
    const coach = learningFixture();
    const pid = coach.present({ id: `excluded.${reason}`, itemKey: `excluded.${reason}`, skillId: SKILL,
      difficulty: 1, modality: 'reading', responseFormat: 'single-choice' });
    coach.help(pid, 'hint');
    coach.answer(pid, { correct: true, assessable: true, reason });
    const state = coach.summary().skills.find(s => s.id === SKILL).levels[1].formats['single-choice'];
    assert.equal(state.assisted, 0, reason);
    assert.equal(state.status, 'unseen', reason);
    assert.equal(state.n, 0, reason);
  }
  const coach = learningFixture();
  const pid = coach.present({ id: 'valid.help', itemKey: 'valid.help', skillId: SKILL,
    difficulty: 1, modality: 'reading', responseFormat: 'single-choice' });
  coach.help(pid, 'hint');
  coach.answer(pid, { correct: true, assessable: true });
  const state = coach.summary().skills.find(s => s.id === SKILL).levels[1].formats['single-choice'];
  assert.equal(state.assisted, 1);
  assert.equal(state.status, 'supported');
});
