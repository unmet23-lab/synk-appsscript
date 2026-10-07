'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Vellum = require('../atlas/vellum-expression');

test('visible shortening and complete emoji removal are observations, including flags and keycaps', () => {
  const result = Vellum.compareEdits({ before: 'Thank you very much for taking the time to visit. 🇰🇷 1️⃣', after: 'Thank you for visiting.' });
  assert.deepEqual(result.observations.map(item => item.kind), ['shorter', 'no-emoji']);
  assert.ok(result.observations[1].removed.includes('1️⃣'));
  assert.equal(Vellum.compareEdits({ before: 'Hello 🙂🌷', after: 'Hello 🌷' }).observations.some(item => item.kind === 'no-emoji'), false);
  for (const after of ['', '   ', 'Hello']) assert.deepEqual(Vellum.compareEdits({ before: 'Hello', after }).observations, []);
});

test('only an exact standalone deletion becomes an avoid-phrase candidate', () => {
  const before = '지민아, 힘내. 오늘 잘 보내.';
  const observation = Vellum.compareEdits({ before, after: '지민아, 오늘 잘 보내.' }).observations.find(item => item.kind === 'avoid-phrase');
  assert.equal(observation.removed, '힘내');
  assert.equal(before.slice(observation.start, observation.end), '힘내');
  for (const [a, b] of [['좋은 아침이야', '좋은 밤이야'], ['안녕하세요', '안녕요'], ['Go now now please', 'Go now please'], ['🙂 🌷', '🙂']]) {
    assert.equal(Vellum.compareEdits({ before: a, after: b }).observations.some(item => item.kind === 'avoid-phrase'), false);
  }
  assert.equal(Vellum.compareEdits({ before: 'Hola, sin prisa. Nos vemos.', after: 'Hola, Nos vemos.' }).observations.find(item => item.kind === 'avoid-phrase').removed, 'sin prisa');
});

test('literal names respect boundaries, recipient names and host-supplied suffixes', () => {
  const text = '한지민과 지민아, 지민님께. Ann met Anna. A+B님.';
  const issues = Vellum.review({ text, otherNames: ['지민', 'Ann', 'Anna', 'A+B'], recipientNames: ['Anna'], nameSuffixes: ['아', '님께', '님'] }).issues;
  assert.deepEqual(issues.map(item => item.evidence.quote), ['지민', '지민', 'Ann', 'A+B']);
  assert.ok(issues.every(item => text.slice(item.evidence.start, item.evidence.end) === item.evidence.quote));
});

test('host date observations and promises keep exact evidence and never claim overall correctness', () => {
  const text = '2026-10-07; tomorrow; I will call.';
  const result = Vellum.review({ text, expectedDate: '2026-10-06', dates: [
    { quote: '2026-10-07', start: 0, end: 10, valid: true, value: '2026-10-07' },
    { quote: 'tomorrow', start: 12, end: 20, valid: true, value: '2026-10-07', uncertain: true },
  ], promises: [{ quote: 'I will call', start: 22, end: 33 }] });
  assert.deepEqual(result.issues.map(item => item.kind), ['date-mismatch', 'date-confirmation', 'promise-confirmation']);
  assert.equal(result.needsReview, true);
  assert.equal(Vellum.review({ text: 'All good' }).needsReview, true);
  assert.equal(Vellum.review({ text: 'I will call', promises: [{ quote: 'I will call', start: 0, end: 11 }], confirmedPromises: ['I will call'] }).issues.length, 0);
  assert.throws(() => Vellum.review({ text: 'source', dates: [{ quote: 'forged', start: 0, end: 6, valid: false }] }), /source span/);
});

test('input limits fail explicitly and browser entry has the same pure contract', () => {
  assert.throws(() => Vellum.compareEdits({ before: 'a'.repeat(50001), after: 'a' }));
  assert.throws(() => Vellum.review({ text: 'a', otherNames: Array(501).fill('a') }));
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../atlas/vellum-expression'), 'utf8'), context);
  assert.equal(context.SynkVellumExpression.VERSION, Vellum.VERSION);
  assert.equal(context.SynkVellumExpression.review({ text: 'avoid', forbiddenPhrases: ['avoid'] }).issues[0].kind, 'avoid-phrase');
});
