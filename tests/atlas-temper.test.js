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
