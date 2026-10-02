'use strict';
// Core's account summary for other SYNK products (atlas/account-summary.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMap } = require('../strata');
const curriculum = require('../strata/maps/topik-i.json');
const learning = require('../atlas/game-learning');
const { summarizeAccount, VERSION } = require('../atlas/account-summary');

const map = createMap(curriculum);
const memoryStorage = () => { const data = new Map(); return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };
const clockFrom = start => { let t = Date.parse(start); return () => new Date(t += 60000).toISOString(); };
let serial = 0;
const item = (skillId, difficulty = 1) => { const id = `s-${++serial}`; return { id, itemKey: `${id}:v1`, skillId, difficulty, modality: skillId.split('.')[1], responseFormat: 'single-choice', audioRequired: false }; };

test('an empty account says nothing about the person beyond what they chose', () => {
  const empty = summarizeAccount({ events: [], map, asOf: '2026-10-02T12:00:00.000Z' });
  assert.equal(empty.version, VERSION);
  assert.equal(empty.basis, 'cold-start');
  assert.deepEqual(empty.practice, { answered: 0, independent: 0, assisted: 0, lastAt: null, skills: [], content: [] });
  assert.deepEqual([empty.abilityClaim, empty.learningEffectClaim, empty.grade], [false, false, null]);
  const declared = summarizeAccount({ events: [], map, asOf: '2026-10-02T12:00:00.000Z', presentation: { support: 'step' }, reasons: ['travel'] });
  assert.equal(declared.basis, 'self-declared');
  assert.deepEqual(declared.presentation, { support: 'step' });
  assert.deepEqual(declared.reasons, ['travel']);
});

test('practice is read by the same rules as the games, with the ability that needs practice first', () => {
  const clock = clockFrom('2026-10-01T09:00:00.000Z');
  const coach = learning.createGame({ gameId: 'g', map, storage: memoryStorage(), clock, storageScope: 'account', accountKey: 'acct-1', historyComplete: true });
  for (let i = 0; i < 3; i += 1) coach.answer(coach.present(item('ko.listening.detail')), { correct: i === 0, assessable: true });
  for (let i = 0; i < 4; i += 1) coach.answer(coach.present(item('ko.reading.vocabulary')), { correct: true, assessable: true });
  const helped = coach.present(item('ko.reading.vocabulary')); coach.help(helped, 'hint'); coach.answer(helped, { correct: true, assessable: true });
  const asOf = clock();
  const summary = summarizeAccount({ events: coach.events(), map, asOf });
  assert.equal(summary.basis, 'practice');
  assert.equal(summary.practice.answered, 8);
  assert.equal(summary.practice.assisted, 1);
  assert.equal(summary.practice.independent, 7);
  const [first, second] = summary.practice.skills;
  assert.equal(first.id, 'ko.listening.detail');
  assert.equal(first.status, 'practice');
  assert.match(first.line, /연습해 봐요/);
  assert.equal(second.id, 'ko.reading.vocabulary');
  assert.equal(second.status, 'recent-independent');
  // The game's own view of the same log agrees cell by cell.
  const own = coach.summary().skills.find(s => s.id === 'ko.listening.detail');
  assert.deepEqual([own.status, own.n, own.correct], [first.status, first.recent, first.correct]);
  assert.ok(!JSON.stringify(summary).includes('acct-1'), 'no identity in the summary');
});
