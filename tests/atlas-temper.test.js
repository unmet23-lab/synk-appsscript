'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Trail = require('../atlas/trail.js');
const Temper = require('../atlas/temper.js');
const scope = { domain: 'LAB', workspace: 'practice', subject: 'synthetic' };
function summary({ help = false, firstExposure = true, verdict = 'correct', itemKey = 'same', taskVersion = 'v1', subject = 'synthetic', repeat = false,
  conceptIds = ['tense.past'], arm } = {}) {
  const events = [], s = { ...scope, subject };
  const add = (type, fields) => {
    const at = new Date(Date.parse('2026-09-30T00:00:00Z') + events.length * 1000).toISOString();
    const e = { schema: 1, id: `e${events.length}`, scope: s, at, recordedAt: at, type, ...fields };
    events.push(e); return e;
  };
  const d = add('decision.made', arm ? { arm } : {});
  const p = add('practice.presented', { decisionId: d.id, taskId: 'tense', taskVersion, itemKey, conceptIds, firstExposure });
  if (help) add('practice.helped', { presentationId: p.id, helpId: 'review', level: 'cue', contentRef: 'hint.v1' });
  add('practice.attempted', { presentationId: p.id, attemptNo: 1, verdict, errorTags: [] });
  if (repeat) add('practice.attempted', { presentationId: p.id, attemptNo: 2, verdict: 'correct', errorTags: [] });
  return Trail.summarize(events, { scope: s, asOf: '2026-10-01T00:00:00Z' });
}
test('same-input runs report the measured difference without causal or learning claims', () => {
  const r = Temper.compare({ before: summary({ verdict: 'incorrect' }), after: summary() });
  assert.equal(r.status, 'measured'); assert.equal(r.independentAccuracyDifference, 1);
  assert.equal(r.before.independent.evaluated, 1); assert.equal(r.after.independent.evaluated, 1);
  assert.equal(r.comparisonUnit, 'same-input-run');
  assert.equal(r.learningEffectClaim, false); assert.equal(r.causalClaim, false);
});
test('assisted, unknown, repeats, skips and unassessed have explicit counts, not inflated denominators', () => {
  const cases = [summary({ subject: 'a', help: true }), summary({ subject: 'b', firstExposure: null }),
    summary({ subject: 'c', repeat: true }), summary({ subject: 'd', verdict: 'skipped' }), summary({ subject: 'e', verdict: 'unassessed' }),
    summary({ subject: 'f', firstExposure: false })];
  const r = Temper.measure(cases);
  assert.equal(r.attempts, 7); assert.equal(r.independent.evaluated, 1);
  assert.equal(r.assisted, 1); assert.equal(r.unknownAssistance, 2); assert.equal(r.repeat, 2); assert.equal(r.unknownExposure, 1);
  assert.equal(r.skipped, 1); assert.equal(r.unassessed, 1);
});
test('independent attempts are read per concept and per comparison arm', () => {
  const r = Temper.measure([
    summary({ subject: 'a', conceptIds: ['G207', 'skill-place'], arm: 'adapted' }),
    summary({ subject: 'b', conceptIds: ['G207'], verdict: 'incorrect', arm: 'baseline' }),
    summary({ subject: 'c', conceptIds: ['G203'] }),
    summary({ subject: 'd', conceptIds: ['G203'], help: true }),
  ]);
  assert.deepEqual(r.byConcept.G207, { evaluated: 2, correct: 1, incorrect: 1, accuracy: 0.5 });
  assert.deepEqual(r.byConcept['skill-place'], { evaluated: 1, correct: 1, incorrect: 0, accuracy: 1 });
  assert.deepEqual(r.byConcept.G203, { evaluated: 1, correct: 1, incorrect: 0, accuracy: 1 }, 'the helped attempt is not in the denominator');
  assert.deepEqual(Object.keys(r.byArm).sort(), ['adapted', 'baseline', 'unrecorded']);
  assert.equal(r.byArm.baseline.accuracy, 0); assert.equal(r.learningEffectClaim, false);
});
test('no independent sample is not zero accuracy or improvement', () => {
  const r = Temper.compare({ before: summary({ help: true }), after: summary() });
  assert.equal(r.status, 'no_sample'); assert.equal(r.before.independent.accuracy, null);
  assert.equal(r.independentAccuracyDifference, null);
  assert.equal(Temper.compare({ before: [], after: [] }).status, 'no_sample');
  assert.equal(Temper.measure([]).status, 'no_sample');
});
test('unpaired account/task/version evidence is not comparable', () => {
  for (const change of [{ subject: 'another' }, { itemKey: 'another' }, { taskVersion: 'v2' }]) {
    const r = Temper.compare({ before: summary(), after: summary(change) });
    assert.equal(r.status, 'not_comparable'); assert.equal(r.independentAccuracyDifference, null);
  }
  assert.throws(() => Temper.compare({ before: [summary(), summary()], after: summary() }), /duplicate scope/);
  assert.throws(() => Temper.measure({ ...summary(), version: 'trail-practice-1' }), /Trail practice summary/);
});
test('forged derived independent flag alone cannot turn helped success into independent evidence', () => {
  const a = summary({ help: true }); a.attempts[0].independent = true;
  assert.equal(Temper.measure(a).independent.evaluated, 0);
});
test('concept names from data cannot reach Object.prototype', () => {
  const r = Temper.measure(summary({ conceptIds: ['__proto__', 'constructor'] }));
  assert.equal(r.byConcept.__proto__.evaluated, 1); assert.equal(r.byConcept.constructor.evaluated, 1);
  assert.equal(({}).evaluated, undefined); assert.equal(({}).correct, undefined);
});

// 평가 전용 집단(공개판 설계 #evaluation-demographics · Atlas §7-4).
test('evaluation-only groups compare two arms person by person and flag the group a new way leaves worse', () => {
  const people = [
    ['p1', '20s', 'baseline', 'correct'], ['p2', '20s', 'baseline', 'correct'], ['p3', '20s', 'adapted', 'incorrect'], ['p4', '20s', 'adapted', 'correct'],
    ['p5', '30s', 'baseline', 'incorrect'], ['p6', '30s', 'baseline', 'correct'], ['p7', '30s', 'adapted', 'correct'], ['p8', '30s', 'adapted', 'correct'],
  ];
  const rows = people.map(([subject, , arm, verdict]) => summary({ subject, arm, verdict }));
  const labels = Object.fromEntries(people.map(([subject, ageBand]) => [`LAB/practice/${subject}`, { ageBand }]));
  const r = Temper.groups({ rows, labels, arms: ['baseline', 'adapted'], minimum: 2 });
  assert.deepEqual(r.worse, ['ageBand=20s']);
  const twenties = r.cells.find(cell => cell.value === '20s'), thirties = r.cells.find(cell => cell.value === '30s');
  assert.equal(twenties.status, 'worse'); assert.equal(twenties.difference, -0.5);
  assert.deepEqual(twenties.people, { baseline: 2, candidate: 2 });
  assert.equal(thirties.status, 'not_worse'); assert.equal(thirties.difference, 0.5);
  assert.equal(r.learningEffectClaim, false); assert.equal(r.causalClaim, false); assert.equal(r.significanceTested, false);
});
test('a group below the minimum is not compared and its size is not shown', () => {
  const rows = [summary({ subject: 'a', arm: 'baseline' }), summary({ subject: 'b', arm: 'adapted', verdict: 'incorrect' })];
  const labels = { 'LAB/practice/a': { gender: 'female' }, 'LAB/practice/b': { gender: 'female' } };
  const r = Temper.groups({ rows, labels, arms: ['baseline', 'adapted'] });
  assert.deepEqual(r.cells, [{ dimension: 'gender', value: 'female', status: 'waiting' }]);
  assert.deepEqual(r.waiting, ['gender=female']); assert.deepEqual(r.worse, []);
  assert.equal(r.minimum, Temper.MINIMUM_PER_CELL);
});
test('no answer, unlabelled people and assisted attempts do not form or fill a group', () => {
  const rows = [summary({ subject: 'a', arm: 'baseline' }), summary({ subject: 'b', arm: 'adapted', help: true }), summary({ subject: 'c', arm: 'adapted' })];
  const labels = { 'LAB/practice/a': { ageBand: 'no_answer', gender: 'male' }, 'LAB/practice/b': { gender: 'male' } };
  const r = Temper.groups({ rows, labels, arms: ['baseline', 'adapted'], minimum: 1 });
  assert.deepEqual(r.cells.map(cell => `${cell.dimension}=${cell.value}:${cell.status}`), ['gender=male:waiting'], 'b was helped, c gave no label');
  assert.throws(() => Temper.groups({ rows, labels: { 'LAB/practice/a': { 'age band': '20s' } }, arms: ['baseline', 'adapted'] }), /invalid group label/);
  assert.throws(() => Temper.groups({ rows, labels, arms: ['same', 'same'] }), /arms/);
  assert.throws(() => Temper.groups({ rows, labels, arms: ['baseline', 'adapted'], minimum: 0 }), /minimum/);
});
test('the per-cell minimum is the one in the shared contract', () => {
  const contract = JSON.parse(require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../계약/배우는이유_선택응답_계약.json'), 'utf8'));
  assert.equal(Temper.MINIMUM_PER_CELL, contract.선택응답.칸_최소인원);
});
