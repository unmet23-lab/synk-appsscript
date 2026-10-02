'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Ask = require('../atlas/ask');
const Atlas = require('../atlas/engine');
const Experiences = require('../atlas/experiences');

// A consultation-like rule: what to recommend depends on budget and use, never on colour.
const questions = [
  { id: 'colour', about: 'colour', options: [{ id: 'black' }, { id: 'white' }] },
  { id: 'use', about: 'use', options: [{ id: 'web' }, { id: 'local-ai' }] },
  { id: 'budget', about: 'budget', options: [{ id: 'low' }, { id: 'high' }] },
];
const recommend = answers => answers.use === 'local-ai' ? (answers.budget === 'low' ? 'desktop-used-gpu' : 'desktop-new-gpu') : 'laptop-basic';

test('a question whose answers change nothing for this person is skipped', () => {
  const ranked = Ask.rank({ questions, decide: recommend });
  assert.equal(ranked[0].id, 'use', 'the most decisive question comes first');
  assert.equal(ranked.find(q => q.id === 'colour').skippable, true);
  assert.equal(ranked.find(q => q.id === 'budget').skippable, true, 'budget matters only once local AI is chosen');
  const after = Ask.rank({ questions, decide: recommend, answers: { use: 'local-ai' } });
  assert.equal(after.find(q => q.id === 'budget').skippable, false, 'now it changes the recommendation');
  assert.equal(after.some(q => q.id === 'use'), false, 'answered questions are not asked again');
});

test('one question a day, never one the person declined, never one asked within seven days', () => {
  const chosen = Ask.choose({ questions, decide: recommend });
  assert.equal(chosen.status, 'ask');
  assert.equal(chosen.question.id, 'use');
  assert.equal(Ask.choose({ questions, decide: recommend, usedToday: 1 }).reason, 'budget');
  assert.equal(Ask.choose({ questions, decide: recommend, denied: ['use'] }).status, 'none');
  const now = '2026-10-02T00:00:00.000Z';
  assert.equal(Ask.choose({ questions, decide: recommend, asked: { use: '2026-09-30T00:00:00.000Z' }, now }).status, 'none');
  assert.equal(Ask.choose({ questions, decide: recommend, asked: { use: '2026-09-20T00:00:00.000Z' }, now }).question.id, 'use');
  const decided = Ask.choose({ questions, decide: recommend, answers: { use: 'web' } });
  assert.equal(decided.status, 'none');
  assert.equal(decided.reason, 'no-question-changes-the-decision');
});

test('a change of content counts twice a change of shape', () => {
  const q = [
    { id: 'shape', about: 'shape', options: [{ id: 'a' }, { id: 'b' }] },
    { id: 'content', about: 'content', options: [{ id: 'a' }, { id: 'b' }] },
  ];
  const decide = answers => ({ content: answers.content === 'b' ? 'hard' : 'easy', shape: answers.shape === 'b' ? 'short' : 'long' });
  const ranked = Ask.rank({ questions: q, decide });
  assert.equal(ranked[0].id, 'content');
  assert.equal(ranked[0].impact, 1);
  assert.equal(ranked[1].impact, 0.5);
});

test('with an Atlas session, an empty setting that would change the plan is asked; a known one is not', () => {
  const scope = { domain: 'LAB', workspace: 'letter', subject: 'ask-test' };
  const at = '2026-10-02T00:00:00.000Z';
  const candidates = Experiences.modesFor('LAB'), levers = Experiences.leversFor('LAB');
  const goal = { id: 'goal', about: 'goal', kind: 'setting', field: 'goal', options: [{ id: 'work' }, { id: 'expression' }, { id: 'clarity' }] };
  const time = { id: 'time', about: 'time', kind: 'setting', field: 'time', options: [{ id: 'short' }, { id: 'standard' }] };
  const result = Ask.fromAtlas({ engine: Atlas, events: [], scope, at, experienceId: 'letter', candidates, levers, questions: [goal, time] });
  assert.equal(result.status, 'ask');
  assert.ok(result.ranked.every(entry => entry.impact > 0));
  const session = Atlas.createSession({ scope, clock: () => at });
  session.set('goal', 'work'); session.set('time', 'short');
  const known = Ask.fromAtlas({ engine: Atlas, events: session.events(), scope, at, experienceId: 'letter', candidates, levers, questions: [goal, time], answers: { goal: 'work', time: 'short' } });
  assert.equal(known.status, 'none');
});
