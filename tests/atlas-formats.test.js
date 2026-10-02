'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, KEY } = require('../atlas/game-learning');
const { validate } = require('../atlas/trail');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const SKILL = 'ko.reading.detail';
const candidate = (id, responseFormat, difficulty = 1) => ({ id, label: id, skillIds: [SKILL], modality: 'reading', difficulty,
  ...(responseFormat === undefined ? {} : { responseFormat }) });
function fixture(storage) {
  const data = new Map();
  storage ||= { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const coach = createGame({ gameId: 'format-audit', map, storage });
  let serial = 0;
  const present = (responseFormat, extra = {}) => {
    const id = `item.${++serial}`;
    return coach.present({ id, itemKey: id, familyKey: id, skillId: SKILL, modality: 'reading', difficulty: 1,
      audioRequired: false, confounded: false, ...(responseFormat === undefined ? {} : { responseFormat }), ...extra });
  };
  const answer = (responseFormat, correct, extra = {}) => coach.answer(present(responseFormat, extra), { correct, assessable: true });
  const skill = () => coach.summary().skills.find(s => s.id === SKILL);
  return { coach, storage, present, answer, skill };
}

test('binary success cannot establish single-choice stability or lower its priority', () => {
  const f = fixture();for (let i = 0; i < 4; i++) f.answer('binary-choice', true);
  const formats = f.skill().levels[1].formats;
  assert.equal(formats['binary-choice'].status, 'recent-independent');
  assert.equal(formats['single-choice'].status, 'unseen');assert.equal(formats['single-choice'].n, 0);
  const plan = f.coach.recommend([candidate('binary', 'binary-choice'), candidate('single', 'single-choice')]);
  assert.equal(plan.selected.id, 'single');assert.equal(plan.responseFormat, 'single-choice');assert.deepEqual(plan.evidence, []);
});

test('binary errors do not establish a weakness in another response format', () => {
  const f = fixture();for (let i = 0; i < 3; i++) f.answer('binary-choice', false);
  assert.equal(f.skill().levels[1].formats['binary-choice'].status, 'practice');
  for (const format of ['single-choice', 'cup-compose', 'action', 'unknown']) {
    const plan = f.coach.recommend([candidate(`candidate.${format}`, format)]);
    assert.equal(plan.state, 'unseen', format);assert.deepEqual(plan.evidence, [], format);
  }
});

test('harder candidates require evidence from the same format at the preceding difficulty', () => {
  const f = fixture();for (let i = 0; i < 4; i++) f.answer('binary-choice', true);
  const options = [candidate('easy', 'single-choice'), candidate('hard', 'single-choice', 2)];
  assert.equal(f.coach.recommend(options).selected.id, 'easy');
  for (let i = 0; i < 4; i++) f.answer('single-choice', true);
  const plan = f.coach.recommend(options);assert.equal(plan.selected.id, 'hard');
  f.present('single-choice', { difficulty: 2 });
  const snapshot = f.coach.events().filter(e => e.type === 'decision.made').at(-1).candidateSnapshot[0].learning;
  assert.equal(snapshot.responseFormat, 'single-choice');assert.equal(snapshot.state, plan.state);assert.deepEqual(snapshot.evidence, plan.evidence);
});

test('compatibility totals show one representative format rather than a pooled success rate', () => {
  const f = fixture();for (let i = 0; i < 4; i++) f.answer('binary-choice', true);
  for (let i = 0; i < 3; i++) f.answer('single-choice', false);
  const skill = f.skill();assert.equal(skill.responseFormat, 'single-choice');assert.equal(skill.n, 3);assert.equal(skill.correct, 0);assert.equal(skill.incorrect, 3);
  assert.equal(skill.levels[1].formats['binary-choice'].n, 4);assert.equal(f.coach.summary().independent, 7);
});

test('legacy measures without a format remain unknown after reload and cannot prove a known format', () => {
  const f = fixture();for (let i = 0; i < 4; i++) f.answer(undefined, true);
  const stored = JSON.parse(f.storage.getItem(`${KEY}.device`));
  for (const event of stored.events) if (event.measure) delete event.measure.responseFormat;
  f.storage.setItem(`${KEY}.device`, JSON.stringify(stored));
  const next = createGame({ gameId: 'second-game', map, storage: f.storage });
  const formats = next.summary().skills.find(s => s.id === SKILL).levels[1].formats;
  assert.equal(formats.unknown.n, 4);assert.equal(formats['single-choice'].n, 0);
  assert.equal(next.recommend([candidate('legacy'), candidate('single', 'single-choice')]).selected.id, 'single');
});

test('matching format evidence is reused by another game and content-family exposure survives a format change', () => {
  const f = fixture();const first = f.answer('binary-choice', true, { familyKey: 'same.family' });assert.equal(first.independent, true);
  assert.equal(f.answer('single-choice', true, { familyKey: 'same.family' }).independent, false);
  const next = createGame({ gameId: 'second-game', map, storage: f.storage });
  assert.equal(next.summary().skills.find(s => s.id === SKILL).levels[1].formats['binary-choice'].n, 1);
  assert.equal(next.summary().skills.find(s => s.id === SKILL).levels[1].formats['single-choice'].n, 0);
});

test('unsupported response formats are rejected at both the host and stored-event boundaries', () => {
  const f = fixture();assert.throws(() => f.present('invented'), /invalid/);
  assert.throws(() => f.coach.recommend([candidate('bad', 'invented')]), /invalid/);
  f.present('single-choice');const event = f.coach.events().find(e => e.type === 'practice.presented');
  assert.throws(() => validate({ ...event, measure: { ...event.measure, responseFormat: 'invented' } }), /invalid/);
});

test('an unassessed action does not hide another format with usable evidence in the display summary', () => {
  const f = fixture();f.answer('cup-compose', true);
  f.answer('action', false, { confounded: true });
  const skill = f.skill();assert.equal(skill.responseFormat, 'cup-compose');assert.equal(skill.n, 1);
  assert.equal(skill.levels[1].formats.action.unassessed, 1);assert.equal(skill.levels[1].formats.action.n, 0);
  assert.equal(f.coach.recommend([candidate('action', 'action')]).state, 'unseen');
});
