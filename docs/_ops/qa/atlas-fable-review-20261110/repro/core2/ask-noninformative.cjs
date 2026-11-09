const __ROOT = require('node:path').resolve(__dirname, '../../../../../..').split(require('node:path').sep).join('/');
// Repro: Ask asks a question whose every answer leads to the SAME decision (differs only from the no-answer default).
const Ask = require((__ROOT + '/atlas/ask.js'));
const questions = [
  { id: 'same', options: [{ id: 'yes' }, { id: 'no' }] },          // any answer -> 'B' (no information)
  { id: 'split', options: [{ id: 'yes' }, { id: 'no' }] },         // yes -> 'C', no -> stays 'A' (real information)
];
const decide = a => ('same' in a ? 'B' : a.split === 'yes' ? 'C' : 'A');
const r = Ask.choose({ questions, decide });
console.log('status', r.status, 'asked', r.question && r.question.id);
console.log(r.ranked.map(e => ({ id: e.id, impact: e.impact, distinct: e.distinct, skippable: e.skippable, reason: e.reason })));
// valued mode: both answers give the same gain; value of information is zero but Ask reports positive value
const v = Ask.choose({ questions: [questions[0]], decide, evaluate: ({ decision }) => ({ utility: decision === 'B' ? 1 : 0 }) });
console.log('valued', v.status, v.value, v.reason);
