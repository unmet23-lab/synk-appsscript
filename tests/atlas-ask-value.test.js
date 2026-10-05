'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Ask = require('../atlas/ask');
const Atlas = require('../atlas/engine');

// A rarely needed print copy has a much larger consequence than a colour preference.
const questions = [
  { id: 'theme', options: [{ id: 'light' }, { id: 'dark' }] },
  { id: 'delivery', options: [{ id: 'screen', p: 0.9 }, { id: 'print', p: 0.1 }] },
];
const decide = answers => ({ format: answers.delivery === 'print' ? 'pdf' : 'web', theme: answers.theme ?? 'light' });
const evaluate = ({ decision, answers }) => ({
  utility: decision.theme === answers.theme ? 1 : 0,
  loss: answers.delivery === 'print' && decision.format !== 'pdf' ? 100 : 0,
});

test('declared decision loss can prioritize a rare important answer over frequent cosmetic changes', () => {
  assert.equal(Ask.choose({ questions, decide }).question.id, 'theme');
  const result = Ask.choose({ questions, decide, evaluate });
  assert.equal(result.question.id, 'delivery');
  assert.equal(result.impact, 0.1, 'change frequency remains a separate legacy measure');
  assert.equal(result.value, 10);
  assert.equal(result.basis, 'declared-decision-value');
  assert.equal(result.ranked[0].expectedGain, 10);
  assert.equal(result.ranked[1].value, 0.5);
});

test('the current and proposed decisions are valued against the same hypothetical answer', () => {
  const calls = [];
  const result = Ask.choose({ questions: [questions[1]], decide, evaluate: context => {
    calls.push({ decision: context.decision.format, answer: context.answers.delivery });
    return { loss: context.answers.delivery === 'print' && context.decision.format !== 'pdf' ? 100 : 0 };
  } });
  assert.equal(result.value, 10);
  assert.deepEqual(calls, [
    { decision: 'web', answer: 'screen' }, { decision: 'web', answer: 'screen' },
    { decision: 'pdf', answer: 'print' }, { decision: 'web', answer: 'print' },
  ]);
});

test('answer availability and question burden can make an otherwise useful question not worth asking', () => {
  const costly = { ...questions[1], responseProbability: 0.01, cost: 0.2 };
  const result = Ask.choose({ questions: [questions[0], costly], decide, evaluate });
  assert.equal(result.question.id, 'theme');
  const entry = result.ranked.find(q => q.id === 'delivery');
  assert.equal(entry.expectedGain, 10);
  assert.equal(entry.value, -0.1);
  assert.equal(entry.skippable, true);
  assert.equal(Ask.choose({ questions: [costly], decide, evaluate }).reason, 'no-question-has-positive-decision-value');
  assert.equal(Ask.choose({ questions: [{ ...questions[1], responseProbability: 0 }], decide, evaluate }).status, 'none');
});

test('a changed but worse recommendation is skipped and an unchanged decision gains no question', () => {
  const worse = Ask.choose({ questions: [questions[0]], decide, evaluate: ({ decision }) => ({ utility: decision.theme === 'light' ? 2 : 0 }) });
  assert.equal(worse.status, 'none');
  assert.equal(worse.ranked[0].value, -1);
  const unchanged = Ask.choose({ questions: [questions[0]], decide: () => 'fixed', evaluate: () => ({ utility: 100 }) });
  assert.equal(unchanged.status, 'none');
  assert.equal(unchanged.ranked[0].reason, 'no-change');
});

test('denied, recently asked, answered and budgeted questions stay closed in value mode', () => {
  const input = { questions, decide, evaluate };
  assert.equal(Ask.choose({ ...input, denied: ['delivery', 'theme'] }).status, 'none');
  assert.equal(Ask.choose({ ...input, answers: { delivery: 'print', theme: 'dark' } }).status, 'none');
  assert.equal(Ask.choose({ ...input, usedToday: 1 }).reason, 'budget');
  const recent = Ask.choose({ ...input, denied: ['theme'], now: '2026-10-05T00:00:00.000Z', asked: { delivery: '2026-10-04T00:00:00.000Z' } });
  assert.equal(recent.status, 'none');
});

test('complete probabilities are normalized within rounding tolerance and impossible answers give no value', () => {
  const q = { id: 'theme', options: [{ id: 'light', p: 1 }, { id: 'dark', p: 0 }] };
  const none = Ask.choose({ questions: [q], decide, evaluate });
  assert.equal(none.status, 'none');
  assert.equal(none.ranked[0].value, 0);
  assert.equal(none.ranked[0].impact, 0);
  const rounded = { ...q, options: [{ id: 'light', p: 0.5 }, { id: 'dark', p: 0.50000000001 }] };
  assert.doesNotThrow(() => Ask.rank({ questions: [rounded], decide }));
});

test('mixed, impossible, nonnumeric and nonfinite answer distributions are rejected', () => {
  for (const probabilities of [[0, 0], [1, 1], [0.2, 0.3], [0.4, 'missing'], [null, 1], [undefined, 1], ['0.5', 0.5], [NaN, 0.5], [Infinity, 0], [-0.1, 1.1]]) {
    const options = probabilities.map((p, index) => ({ id: `answer-${index}`, ...(p === 'missing' ? {} : { p }) }));
    assert.throws(() => Ask.rank({ questions: [{ id: 'q', options }], decide }), /probabilit/);
  }
});

test('utility, loss, response chance and burden require finite values and a declared evaluator', () => {
  for (const value of [{}, { utility: NaN }, { utility: Infinity }, { utility: '1' }, { loss: -1 }, { loss: null }, { loss: Infinity }, { utility: 1, confidence: 0.9 }, 1]) {
    assert.throws(() => Ask.rank({ questions, decide, evaluate: () => value }), /evaluate/);
  }
  for (const field of ['cost', 'responseProbability']) {
    for (const value of [NaN, Infinity, -1, null, '0.5']) {
      assert.throws(() => Ask.rank({ questions: [{ ...questions[0], [field]: value }], decide, evaluate }), /invalid/);
    }
    assert.throws(() => Ask.rank({ questions: [{ ...questions[0], [field]: 0 }], decide }), /require evaluate/);
  }
  assert.throws(() => Ask.rank({ questions: [{ ...questions[0], responseProbability: 1.1 }], decide, evaluate }), /invalid/);
  assert.throws(() => Ask.rank({ questions, decide, evaluate: null }), /evaluate/);
});

test('finite inputs whose subtraction overflows are refused rather than producing an infinite priority', () => {
  assert.throws(() => Ask.rank({ questions: [questions[0]], decide,
    evaluate: ({ decision }) => ({ utility: decision.theme === 'dark' ? Number.MAX_VALUE : -Number.MAX_VALUE }),
  }), /nonfinite/);
});

test('small positive policy values are not rounded out of the decision', () => {
  const result = Ask.choose({ questions: [questions[0]], decide,
    evaluate: ({ decision, answers }) => ({ utility: decision.theme === answers.theme ? 0.00001 : 0 }),
  });
  assert.equal(result.status, 'ask');
  assert.equal(result.value, 0.000005);
});

test('the Core adapter forwards value evaluation while preserving real event history', () => {
  const scope = { domain: 'SYNK', workspace: 'ask-value', subject: 'local-test' };
  const at = '2026-10-05T00:00:00.000Z';
  const session = Atlas.createSession({ scope, clock: () => at });
  const events = session.events(), original = structuredClone(events);
  const result = Ask.fromAtlas({ engine: Atlas, scope, at, events, experienceId: 'practice',
    candidates: [
      { id: 'short', minutes: 3, pace: 'short' },
      { id: 'standard', minutes: 10, pace: 'standard' },
    ],
    questions: [{ id: 'time', options: [{ id: 'short' }, { id: 'standard' }], cost: 0.1 }],
    evaluate: ({ decision, answers }) => ({ loss: answers.time === 'short' && !decision.content.includes('short') ? 2 : 0 }),
  });
  assert.equal(result.status, 'ask');
  assert.equal(result.value, 0.9);
  assert.deepEqual(events, original);
});

test('all option IDs remain own outcomes through ranking and serialization without changing the prototype', () => {
  const options = [{ id: '__proto__', value: 'first' }, { id: 'constructor', value: 'second' }, { id: 'ordinary', value: 'third' }];
  const result = Ask.choose({ questions: [{ id: 'q', options }], decide: answers => ({ selected: answers.q ?? 'current' }) });
  const ranked = result.ranked[0];
  assert.equal(result.status, 'ask');
  assert.equal(ranked.distinct, 3);
  assert.equal(Object.getPrototypeOf(ranked.outcomes), null);
  assert.deepEqual(Object.keys(ranked.outcomes), options.map(option => option.id));
  const saved = JSON.parse(JSON.stringify(ranked.outcomes));
  for (const option of options) {
    assert.equal(Object.hasOwn(saved, option.id), true);
    assert.deepEqual(saved[option.id], { selected: option.value });
  }
  assert.equal(({}).selected, undefined);
});

test('bounded scenario options support all six-choice multi-select combinations', () => {
  const options = Array.from({ length: 64 }, (_, index) => ({ id: `scenario-${index}`, value: index }));
  const input = { questions: [{ id: 'q', options }], decide: answers => answers.q ?? -1,
    evaluate: ({ decision, answers }) => ({ loss: decision === answers.q ? 0 : 1 }) };
  assert.equal(Ask.MAX_OPTIONS, 64);
  const result = Ask.choose(input);
  assert.equal(result.ranked[0].distinct, 64);
  assert.equal(result.value, 1);
  assert.throws(() => Ask.choose({ ...input, questions: [{ id: 'q', options: [...options, { id: 'overflow' }] }] }), /invalid question/);
});
