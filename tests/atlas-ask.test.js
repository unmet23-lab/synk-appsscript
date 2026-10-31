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

test('equal decision changes keep authored order despite probability summation noise', () => {
  const q = (id, count) => ({ id, options: Array.from({ length: count }, (_, i) => ({ id: 'option.' + i })) });
  const result = Ask.choose({ questions: [q('first', 6), q('second', 5)], decide: answers => Object.keys(answers).length ? 'changed' : 'current' });
  assert.equal(result.question.id, 'first');
});
test('chained near ties cannot place a lower score ahead of a higher score outside its tolerance', () => {
  const questions = [0.5, 0.500000000000005, 0.50000000000001].map((p, i) => ({ id: 'question.' + i, options: [{ id: 'yes', p }, { id: 'no', p: 1 - p }] }));
  const result = Ask.choose({ questions, decide: answers => Object.values(answers).includes('yes') ? 'changed' : 'current' });
  const order = result.ranked.map(row => row.id);
  assert.notEqual(result.question.id, 'question.0'); assert.ok(order.indexOf('question.2') < order.indexOf('question.0'));
});

test('a small positive refresh impact is eligible even when its display rounds to zero', () => {
  const q = { id: 'refresh-mode', about: 'mode', kind: 'refresh', options: [{ id: 'reading', p: 0.9999 }, { id: 'listening', p: 0.0001 }] };
  const result = Ask.choose({ questions: [q], answers: { mode: 'reading' }, now: '2026-10-29T00:00:00Z', decide: a => a.mode });
  assert.equal(result.status, 'ask'); assert.equal(result.question.id, q.id);
  assert.equal(result.impact, 0, 'the existing rounded display field remains compatible');
  assert.equal(result.ranked[0].skippable, false);
});

test('small positive impacts rank by their original precision, not by display ties', () => {
  const q = (id, p) => ({ id, about: 'mode', kind: 'refresh', options: [{ id: 'reading', p: 1 - p }, { id: 'listening', p }] });
  const input = { questions: [q('weaker', 0.0001), q('stronger', 0.0002)], answers: { mode: 'reading' }, now: '2026-10-29T00:00:00Z', decide: a => a.mode };
  const result = Ask.choose(input);
  assert.equal(result.question.id, 'stronger');
  assert.deepEqual(result.ranked.map(e => e.impact), [0, 0]);
  assert.equal(Ask.choose({ ...input, usedToday: 1 }).reason, 'budget');
  assert.equal(Ask.choose({ ...input, denied: ['weaker', 'stronger'] }).status, 'none');
});

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

for (const [label, first, second] of [
  ['different context fields', { kind: 'setting', field: 'a' }, { kind: 'setting', field: 'b' }],
  ['different understanding lines', { kind: 'confirm', line: 'a' }, { kind: 'confirm', line: 'b' }],
  ['different answer kinds', { kind: 'setting', field: 'a' }, { kind: 'confirm', line: 'a' }],
]) test(`Atlas questions reject one about bound to ${label} before simulating a misleading decision`, () => {
  let calls=0;
  const engine={decide(){calls++;return {status:'ready',selected:{id:'same'},bundle:{}};}},options=[{id:'yes'},{id:'no'}];
  assert.throws(()=>Ask.fromAtlas({engine,questions:[{id:'one',about:'shared',options,...first},{id:'two',about:'shared',options,...second}]}),/ambiguous Atlas question binding/);
  assert.equal(calls,0);
});

test('Atlas questions may share an about when they address the same setting',()=>{
  let calls=0;const engine={decide(){calls++;return {status:'ready',selected:{id:'same'},bundle:{}};}},options=[{id:'yes'},{id:'no'}];
  assert.doesNotThrow(()=>Ask.fromAtlas({engine,questions:[{id:'one',about:'a',options},{id:'two',about:'a',field:'a',kind:'setting',options}]}));
  assert.ok(calls>0);
});

for(const kind of ['setting','confirm'])test(`Atlas rejects different about aliases for one ${kind} target before decide`,()=>{
  let calls=0;const engine={decide(){calls++;return {status:'ready',selected:{id:'same'},bundle:{}};}},options=[{id:'yes'},{id:'no'}];
  const binding=kind==='confirm'?{kind,line:'one-line'}:{kind,field:'one-field'};
  assert.throws(()=>Ask.fromAtlas({engine,questions:[{id:'one',about:'x',options,...binding},{id:'two',about:'y',options,...binding}],answers:{x:'yes'}}),/ambiguous Atlas question binding/);
  assert.equal(calls,0);
});
test('confirm aliases and setting/refresh aliases preserve one actual binding',()=>{
  for(const bindings of [[{kind:'confirm',line:'line'},{kind:'confirm',line:'line'}],[{kind:'setting',field:'field'},{kind:'refresh',field:'field'}]]){
    let calls=0;const engine={decide(){calls++;return {status:'ready',selected:{id:'same'},bundle:{}};}},options=[{id:'yes'},{id:'no'}];
    assert.doesNotThrow(()=>Ask.fromAtlas({engine,questions:bindings.map((binding,index)=>({id:'q'+index,about:'shared',options,...binding}))}));assert.ok(calls>0);
  }
});
